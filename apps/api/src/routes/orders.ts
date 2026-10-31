import { Hono } from 'hono';
import { z } from 'zod';
import {
  createOrderInputSchema,
  orderSchema,
  orderStatusUpdateInputSchema,
  orderViewSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { requireAuth, ownedShop } from '../lib/auth';
import { notFound, param, parseBody } from '../lib/validation';
import { str, toOrder, toOrderItemView, toOrderView, toShop } from '../lib/serialize';
import { createOrderForShop } from '../lib/orders';

export const orderRoutes = new Hono<EnvShape>();

/** Public COD checkout (source: storefront). */
orderRoutes.post('/s/:slug/orders', async (c) => {
  const db = c.get('db');
  const { data: shopRow, error: shopError } = await db
    .from('shops')
    .select('*')
    .eq('slug', param(c, 'slug') ?? '')
    .maybeSingle();
  if (shopError || !shopRow) return notFound(c, 'Shop');
  const input = await parseBody(c, createOrderInputSchema);

  const result = await createOrderForShop({
    db,
    shop: toShop(shopRow),
    items: input.items,
    customer: input.customer,
    note: input.note,
    source: 'storefront',
  });
  if (!result.ok) return c.json({ error: result.error }, result.status as 400 | 404 | 500);
  const parsed = orderViewSchema.safeParse(result.order);
  if (!parsed.success) {
    console.error('Order view contract violation:', z.flattenError(parsed.error));
    return c.json({ error: 'Order created but response did not match contract' }, 500);
  }
  return c.json(parsed.data, 201);
});

/** Seller order list (newest first) with item details. */
orderRoutes.get('/shops/:shopId/orders', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (shop instanceof Response) return shop;
  const db = c.get('db');
  const limit = Math.min(100, Number(c.req.query('limit') ?? '50') || 50);
  const offset = Math.max(0, Number(c.req.query('offset') ?? '0') || 0);
  const status = c.req.query('status');

  let query = db
    .from('orders')
    .select('*')
    .eq('shop_id', shop.id)
    .limit(limit)
    .order('created_at', { ascending: false });
  if (offset) query = query.range(offset, offset + limit - 1);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data: orderRows, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const orders = (orderRows ?? []) as Record<string, unknown>[];
  if (!orders.length) return c.json([]);

  const ids = orders.map((o) => str(o.id));
  const { data: itemRows, error: itemError } = await db
    .from('order_items')
    .select('*, products(id, name, images), variants(id, size, color)')
    .in('order_id', ids);
  if (itemError) return c.json({ error: itemError.message }, 500);

  const itemsByOrder = new Map<string, unknown[]>();
  for (const row of (itemRows ?? []) as Record<string, unknown>[]) {
    const orderId = str(row.order_id);
    const list = itemsByOrder.get(orderId) ?? [];
    list.push(row);
    itemsByOrder.set(orderId, list);
  }

  const views = orders.map((o) => {
    const items = (itemsByOrder.get(str(o.id)) ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return toOrderItemView(row, r.products, r.variants);
    });
    return orderViewSchema.parse(toOrderView(o, items));
  });
  return c.json(views);
});

/** Seller status update: pending → confirmed → shipped → delivered (+ cancelled). */
orderRoutes.patch('/orders/:orderId/status', requireAuth, async (c) => {
  const db = c.get('db');
  const { data, error } = await db
    .from('orders')
    .select('shop_id')
    .eq('id', param(c, 'orderId'))
    .maybeSingle();
  if (error || !data) return notFound(c, 'Order');
  const shop = await ownedShop(c, str((data as Record<string, unknown>).shop_id));
  if (shop instanceof Response) return shop;

  const input = await parseBody(c, orderStatusUpdateInputSchema);
  const { data: updated, error: updateError } = await db
    .from('orders')
    .update({ status: input.status })
    .eq('id', param(c, 'orderId'))
    .select('*')
    .single();
  if (updateError || !updated)
    return c.json({ error: updateError?.message ?? 'Update failed' }, 500);
  return c.json(orderSchema.parse(toOrder(updated)));
});
