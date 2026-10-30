/**
 * Order creation service shared by the storefront checkout and the AI
 * `create_order` tool. Totals are ALWAYS computed from database prices —
 * client-supplied prices/totals are never trusted (AGENTS.md rules #2, #4, #5).
 */
import { CreateOrderInput, OrderView, Product, Shop, Variant } from '@easyshop/shared';
import type { Db } from './db';
import { toOrderItemView, toOrderView, toProduct, toVariant } from './serialize';

export interface CreateOrderParams {
  db: Db;
  shop: Shop;
  items: CreateOrderInput['items'];
  customer: CreateOrderInput['customer'];
  note?: string;
  source: 'ai' | 'storefront';
  /** Server-verified negotiated unit prices (conversation-scoped). */
  negotiated?: Record<string, number>;
}

export type CreateOrderResult =
  { ok: true; order: OrderView } | { ok: false; status: number; error: string };

export async function createOrderForShop(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { db, shop, items, customer, note, source, negotiated } = params;

  const productIds = [...new Set(items.map((i) => i.productId))];
  if (productIds.length !== items.length)
    return { ok: false, status: 400, error: 'Duplicate products in order' };

  const { data: productRows, error: productError } = await db
    .from('products')
    .select('*, variants(*)')
    .in('id', productIds)
    .eq('shop_id', shop.id)
    .eq('active', true);
  if (productError)
    return { ok: false, status: 500, error: `Failed to load products: ${productError.message}` };

  const productMap = new Map<string, { product: Product; variants: Variant[] }>();
  for (const row of productRows ?? []) {
    const r = row as Record<string, unknown>;
    productMap.set(String(r.id), {
      product: toProduct(row),
      variants: Array.isArray(r.variants) ? r.variants.map((v) => toVariant(v)) : [],
    });
  }

  // Validate availability; compute the real total from DB prices.
  let subtotal = 0;
  const resolved: Array<{
    item: CreateOrderInput['items'][number];
    unitPrice: number;
    product: Product;
    variant?: Variant;
  }> = [];
  for (const item of items) {
    const entry = productMap.get(item.productId);
    if (!entry) return { ok: false, status: 400, error: 'Product unavailable in this shop' };
    const variant = item.variantId
      ? entry.variants.find((v) => v.id === item.variantId)
      : undefined;
    if (item.variantId && !variant)
      return { ok: false, status: 400, error: 'Product variant not found' };
    if (variant && variant.stock < item.qty) {
      return {
        ok: false,
        status: 400,
        error: `Only ${variant.stock} left in stock for ${entry.product.name}`,
      };
    }
    const negotiatedPrice = negotiated?.[item.productId];
    const unitPrice = negotiatedPrice ?? variant?.priceOverride ?? entry.product.price;
    subtotal += unitPrice * item.qty;
    resolved.push({ item, unitPrice, product: entry.product, variant });
  }

  // MVP: delivery charge is quoted by the assistant / shop info; checkout charges 0 until zones are selected in UI.
  const deliveryCharge = 0;

  const { data: orderRow, error: orderError } = await db
    .from('orders')
    .insert({
      shop_id: shop.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address,
      note: note ?? null,
      subtotal: subtotal.toFixed(2),
      delivery_charge: deliveryCharge.toFixed(2),
      total: (subtotal + deliveryCharge).toFixed(2),
      status: 'pending',
      source,
    })
    .select('*')
    .single();
  if (orderError || !orderRow)
    return {
      ok: false,
      status: 500,
      error: `Order insert failed: ${orderError?.message ?? 'unknown'}`,
    };

  const { data: itemRows, error: itemError } = await db
    .from('order_items')
    .insert(
      resolved.map((r) => ({
        order_id: orderRow.id,
        product_id: r.item.productId,
        variant_id: r.item.variantId ?? null,
        qty: r.item.qty,
        unit_price: r.unitPrice.toFixed(2),
      })),
    )
    .select('*');
  if (itemError)
    return { ok: false, status: 500, error: `Order items insert failed: ${itemError.message}` };

  const items2 = (itemRows ?? []).map((row, index) => {
    const entry = resolved[index];
    return toOrderItemView(
      row,
      productMap.get(entry?.item.productId ?? '')?.product,
      entry?.variant,
    );
  });
  return { ok: true, order: toOrderView(orderRow, items2) };
}
