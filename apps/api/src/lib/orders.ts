/**
 * Order creation service shared by the storefront checkout and the AI
 * `create_order` tool. Totals and delivery are ALWAYS computed from database
 * prices — client-supplied amounts are never trusted (AGENTS.md rules #2, #4,
 * #5). Variant stock is reserved atomically through the
 * `adjust_variant_stock` SQL function.
 */
import { CreateOrderInput, OrderView, Product, Shop, Variant } from '@easyshop/shared';
import type { Db } from './db';
import { resolveDeliveryCharge } from './delivery';
import { toOrderItemView, toOrderView, toProduct, toVariant } from './serialize';

export interface CreateOrderParams {
  db: Db;
  shop: Shop;
  items: CreateOrderInput['items'];
  customer: CreateOrderInput['customer'];
  /** Seller-defined zone name. Required when the shop has delivery zones. */
  deliveryZone?: string;
  note?: string;
  source: 'ai' | 'storefront';
  /** Server-verified negotiated unit prices (conversation-scoped). */
  negotiated?: Record<string, number>;
}

export type CreateOrderResult =
  { ok: true; order: OrderView } | { ok: false; status: number; error: string };

/** Atomic variant-stock delta. Returns the new stock, or null when it would go negative. */
async function adjustStock(db: Db, variantId: string, delta: number): Promise<number | null> {
  const { data, error } = await db.rpc('adjust_variant_stock', {
    p_variant_id: variantId,
    p_delta: delta,
  });
  if (error) throw new Error(`Stock update failed: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

/** Atomic product-stock delta for products sold without variants. */
async function adjustProductStock(
  db: Db,
  productId: string,
  delta: number,
): Promise<number | null> {
  const { data, error } = await db.rpc('adjust_product_stock', {
    p_product_id: productId,
    p_delta: delta,
  });
  if (error) throw new Error(`Product stock update failed: ${error.message}`);
  return typeof data === 'number' ? data : null;
}

interface Reservation {
  kind: 'variant' | 'product';
  id: string;
  qty: number;
}

export async function createOrderForShop(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { db, shop, items, customer, deliveryZone, note, source, negotiated } = params;

  const delivery = resolveDeliveryCharge(shop.deliveryRules.zones, deliveryZone);
  if (!delivery.ok) return { ok: false, status: 400, error: delivery.error };

  // Same product in two sizes is fine; the same product+variant twice is not.
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.productId}:${item.variantId ?? 'base'}`;
    if (seen.has(key)) {
      return { ok: false, status: 400, error: 'Duplicate product/variant in order' };
    }
    seen.add(key);
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
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
    if (entry.variants.length > 0 && !variant) {
      return {
        ok: false,
        status: 400,
        error: `Choose a size/color for ${entry.product.name}`,
      };
    }
    const available = entry.variants.length ? (variant?.stock ?? 0) : entry.product.stock;
    if (available < item.qty) {
      return {
        ok: false,
        status: 400,
        error: `Only ${available} left in stock for ${entry.product.name}`,
      };
    }
    const negotiatedPrice = negotiated?.[item.productId];
    const unitPrice = negotiatedPrice ?? variant?.priceOverride ?? entry.product.price;
    subtotal += unitPrice * item.qty;
    resolved.push({ item, unitPrice, product: entry.product, variant });
  }

  // Reserve stock before creating the order. The SQL function is atomic, so
  // concurrent checkouts cannot both take the last unit.
  const reservations: Reservation[] = [];
  const restoreReservations = async () => {
    for (const reservation of reservations) {
      try {
        if (reservation.kind === 'variant') {
          await adjustStock(db, reservation.id, reservation.qty);
        } else {
          await adjustProductStock(db, reservation.id, reservation.qty);
        }
      } catch (error) {
        console.error('[orders] failed to restore stock:', error);
      }
    }
  };

  for (const line of resolved) {
    const reservation: Reservation = line.variant
      ? { kind: 'variant', id: line.variant.id, qty: line.item.qty }
      : { kind: 'product', id: line.product.id, qty: line.item.qty };
    try {
      const remaining =
        reservation.kind === 'variant'
          ? await adjustStock(db, reservation.id, -reservation.qty)
          : await adjustProductStock(db, reservation.id, -reservation.qty);
      if (remaining === null) {
        await restoreReservations();
        return {
          ok: false,
          status: 409,
          error: `Just sold out: ${line.product.name}. Ask the customer to choose another option.`,
        };
      }
      reservations.push(reservation);
    } catch (error) {
      await restoreReservations();
      return {
        ok: false,
        status: 500,
        error: error instanceof Error ? error.message : 'Could not reserve stock',
      };
    }
  }

  const deliveryCharge = delivery.charge;
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
  if (orderError || !orderRow) {
    await restoreReservations();
    return {
      ok: false,
      status: 500,
      error: `Order insert failed: ${orderError?.message ?? 'unknown'}`,
    };
  }

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
  if (itemError) {
    // Roll back both the order and the stock reservations.
    await db.from('orders').delete().eq('id', orderRow.id);
    await restoreReservations();
    return { ok: false, status: 500, error: `Order items insert failed: ${itemError.message}` };
  }

  const lineItems = (itemRows ?? []).map((row, index) => {
    const entry = resolved[index];
    return toOrderItemView(
      row,
      productMap.get(entry?.item.productId ?? '')?.product,
      entry?.variant,
    );
  });
  return { ok: true, order: toOrderView(orderRow, lineItems) };
}

/**
 * Puts stock back when a seller cancels an order. Called by the status route
 * only on a genuine transition into `cancelled`, so repeated patches don't
 * inflate inventory.
 */
export async function restoreStockForOrder(db: Db, orderId: string): Promise<void> {
  const { data, error } = await db
    .from('order_items')
    .select('variant_id, qty')
    .eq('order_id', orderId);
  if (error) {
    console.error('[orders] could not load items for restock:', error.message);
    return;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const missingProductIds = rows
    .filter((row) => !row.variant_id)
    .map((row) => (typeof row.product_id === 'string' ? row.product_id : ''))
    .filter(Boolean);
  const productIds = [...new Set(missingProductIds)];
  const hasVariants = new Set<string>();
  if (productIds.length) {
    const { data: variantRows } = await db
      .from('variants')
      .select('product_id')
      .in('product_id', productIds);
    for (const row of variantRows ?? []) {
      hasVariants.add(String((row as Record<string, unknown>).product_id));
    }
  }

  for (const row of rows) {
    const variantId = typeof row.variant_id === 'string' ? row.variant_id : '';
    const productId = typeof row.product_id === 'string' ? row.product_id : '';
    const qty = Number(row.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    try {
      if (variantId) {
        await adjustStock(db, variantId, qty);
      } else if (productId && !hasVariants.has(productId)) {
        await adjustProductStock(db, productId, qty);
      }
    } catch (restockError) {
      console.error('[orders] failed to restock item:', restockError);
    }
  }
}
