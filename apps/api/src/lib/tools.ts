/**
 * Server-executed AI tools (SPEC §8). Every tool is scoped to the current
 * shop — the shop id is set by the server, never by client input (rule #6).
 * The model can only ask for these actions; the server decides and executes.
 */
import {
  productAvailableStock,
  type AiSettings,
  type ChatProductCard,
  type DiscountVerdict,
  type Shop,
} from '@easyshop/shared';
import type { Db } from './db';
import { cardFromProduct, num, toProductPublic } from './serialize';
import { resolveOffer } from './bargain';
import { createOrderForShop } from './orders';
import { canonicalPhrase, cleanQuery, filterProductRows, textTokens } from './product-search';
import type { GeminiToolDeclaration, GeminiSchemaProperty } from './gemini';

export interface AiToolContext {
  db: Db;
  shop: Shop;
  aiSettings: AiSettings;
  conversationId: string;
  /** Product cards to stream to the storefront UI while tools run. */
  onCards: (cards: ChatProductCard[]) => void;
}

const stringProp = (description: string): GeminiSchemaProperty => ({ type: 'STRING', description });
const numberProp = (description: string): GeminiSchemaProperty => ({ type: 'NUMBER', description });

export const toolDeclarations: GeminiToolDeclaration[] = [
  {
    name: 'search_products',
    description:
      'Search this shop\'s product catalog. Use for "any red t-shirt under 1000?" style queries. Returns real products or an empty list.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: stringProp('Free text to match product name or description'),
        category: stringProp('Category name hint, e.g. t-shirt, saree'),
        color: stringProp(
          "Color the customer asked for (pass it as spoken — 'red', 'lal' or 'লাল' are all fine)",
        ),
        size: stringProp('Size the customer asked for'),
        max_price: numberProp('Maximum price per unit the customer will consider'),
      },
    },
  },
  {
    name: 'get_product',
    description:
      'Get full details of ONE product: description, images, per-variant stock and prices. Requires the product id from a previous search.',
    parameters: {
      type: 'OBJECT',
      properties: { product_id: stringProp('Product id from search_products results') },
      required: ['product_id'],
    },
  },
  {
    name: 'get_shop_info',
    description:
      'Get shop-level info: business type, categories, delivery zones, charges, delivery time, return policy, contact details.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'check_discount',
    description:
      "REQUIRED whenever a customer asks for a discount or offers a price. The server decides accept/counter/reject from the seller's rules; you only phrase the verdict.",
    parameters: {
      type: 'OBJECT',
      properties: {
        product_id: stringProp('Product id'),
        offered_price: numberProp("Customer's offered price for ONE unit"),
      },
      required: ['product_id', 'offered_price'],
    },
  },
  {
    name: 'create_order',
    description:
      'Create a COD order. ONLY call this AFTER summarizing items, delivery charge, total and address to the customer and receiving explicit confirmation (confirmed=true). When the shop has delivery zones you must pass the zone the customer chose.',
    parameters: {
      type: 'OBJECT',
      properties: {
        items: {
          type: 'ARRAY',
          description: 'Ordered items',
          items: {
            type: 'OBJECT',
            description: 'One line item',
            properties: {
              product_id: stringProp('Product id'),
              variant_id: stringProp('Variant id if the customer chose a size/color'),
              qty: numberProp('Quantity (1-20)'),
            },
            required: ['product_id', 'qty'],
          },
        },
        name: stringProp('Customer full name'),
        phone: stringProp('Customer phone number'),
        address: stringProp('Customer full delivery address'),
        delivery_zone: stringProp(
          'Delivery zone name exactly as returned by get_shop_info (required when the shop has zones)',
        ),
        confirmed: {
          type: 'BOOLEAN',
          description: 'True only after the customer explicitly confirmed the summarized order',
        },
      },
      required: ['items', 'name', 'phone', 'address', 'confirmed'],
    },
  },
  {
    name: 'handoff_to_owner',
    description:
      'Flag this conversation for the human seller: custom requests, complaints, payment issues, products you could not find.',
    parameters: {
      type: 'OBJECT',
      properties: { reason: stringProp('Why the owner is needed') },
      required: ['reason'],
    },
  },
];

const MODEL_FIELDS =
  'id, shop_id, category_id, name, description, price, stock, images, active, created_at, updated_at, variants(id, product_id, size, color, stock, price_override, created_at)';

export async function executeTool(
  ctx: AiToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case 'search_products':
        return await searchProducts(ctx, args);
      case 'get_product':
        return await getProduct(ctx, args);
      case 'get_shop_info':
        return await shopInfo(ctx);
      case 'check_discount':
        return await checkDiscount(ctx, args);
      case 'create_order':
        return await createOrder(ctx, args);
      case 'handoff_to_owner':
        return await handoff(ctx, args);
      default:
        return { error: `Unknown tool ${name}` };
    }
  } catch (error) {
    return { error: `Tool failed: ${error instanceof Error ? error.message : 'unknown error'}` };
  }
}

/* ------------------------------------------------------------------ impls -- */

interface ProductRow extends Record<string, unknown> {
  variants?: unknown[];
}

async function searchProducts(ctx: AiToolContext, args: Record<string, unknown>) {
  // Fetch the shop's active products once and filter in JS — resilient to
  // how the model phrases free-text queries in Bangla/Banglish/English.
  const { data, error } = await ctx.db
    .from('products')
    .select(MODEL_FIELDS)
    .eq('shop_id', ctx.shop.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { error: `Search failed: ${error.message}` };
  const rows: ProductRow[] = data ?? [];

  // Category hints resolve against this shop's categories only.
  const categoryHint = cleanQuery(args.category);
  let categoryIds: string[] | null = null;
  if (categoryHint) {
    const { data: cats, error: catErr } = await ctx.db
      .from('categories')
      .select('id')
      .eq('shop_id', ctx.shop.id)
      .ilike('name', `%${categoryHint}%`)
      .limit(10);
    if (catErr) return { error: `Category lookup failed: ${catErr.message}` };
    categoryIds = (cats ?? []).map((c) => String((c as Record<string, unknown>).id));
    if (categoryIds.length === 0) return { products: [], note: 'No such category in this shop' };
  }

  const color = cleanQuery(args.color) ?? '';
  const size = cleanQuery(args.size) ?? '';
  const maxPrice = args.max_price != null ? num(args.max_price) : undefined;
  const tokens = textTokens(cleanQuery(args.query));

  const { matched, note: searchNote } = filterProductRows(rows, {
    tokens,
    categoryIds,
    color: color ? canonicalPhrase(color) : '',
    size: size.toLowerCase(),
    maxPrice,
  });

  const publicProducts = matched.map((r) => toProductPublic(r, r.variants ?? []));
  if (publicProducts.length) ctx.onCards(publicProducts.map(cardFromProduct));

  return {
    products: publicProducts.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: productAvailableStock(p),
      in_stock: productAvailableStock(p) > 0,
      description_short: (p.description ?? '').slice(0, 160),
      category_id: p.categoryId ?? null,
      image: p.images[0] ?? null,
      variants: p.variants.map((v) => ({
        id: v.id,
        size: v.size ?? null,
        color: v.color ?? null,
        stock: v.stock,
        price: v.priceOverride ?? p.price,
      })),
    })),
    note: publicProducts.length
      ? searchNote ||
        'Availability/size answers must come from the variants list above, never from guesses.'
      : 'No products matched. Tell the customer honestly and suggest searching another keyword.',
  };
}

async function getProduct(ctx: AiToolContext, args: Record<string, unknown>) {
  const id = typeof args.product_id === 'string' ? args.product_id : '';
  if (!id) return { error: 'product_id is required' };
  const { data, error } = await ctx.db
    .from('products')
    .select(MODEL_FIELDS)
    .eq('id', id)
    .eq('shop_id', ctx.shop.id)
    .eq('active', true)
    .maybeSingle();
  if (error) return { error: `Lookup failed: ${error.message}` };
  if (!data) return { error: 'Product not found in this shop. Tell the customer honestly.' };

  const publicProduct = toProductPublic(
    data,
    Array.isArray((data as ProductRow).variants) ? (data as ProductRow).variants! : [],
  );
  ctx.onCards([cardFromProduct(publicProduct)]);
  return { product: publicProduct };
}

async function shopInfo(ctx: AiToolContext) {
  const { shop, aiSettings } = ctx;
  const { data: categoryRows } = await ctx.db
    .from('categories')
    .select('name')
    .eq('shop_id', shop.id)
    .order('name', { ascending: true })
    .limit(50);
  return {
    name: shop.name,
    business_type: shop.businessType,
    description: shop.description ?? null,
    categories: (categoryRows ?? []).map((row) => String((row as Record<string, unknown>).name)),
    contact: shop.contact,
    delivery_zones: shop.deliveryRules.zones.map((z) => ({
      name: z.name,
      charge: z.charge,
      eta_days: z.etaDays,
    })),
    return_policy: shop.policies.returnPolicy ?? null,
    extra_policies: shop.policies.notes ?? null,
    languages: aiSettings.languages,
  };
}

async function checkDiscount(
  ctx: AiToolContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const productId = typeof args.product_id === 'string' ? args.product_id : '';
  const offered = num(args.offered_price);
  if (!productId) return { error: 'product_id is required' };

  const { data, error } = await ctx.db
    .from('products')
    .select('id, price, floor_price, name')
    .eq('id', productId)
    .eq('shop_id', ctx.shop.id)
    .eq('active', true)
    .maybeSingle();
  if (error) return { error: `Lookup failed: ${error.message}` };
  if (!data) return { error: 'Product not found in this shop. Tell the customer honestly.' };

  const row = data as Record<string, unknown>;
  const verdict: DiscountVerdict = resolveOffer(
    {
      listPrice: num(row.price),
      floorPrice: num(row.floor_price),
      maxDiscountPct: ctx.aiSettings.maxDiscountPct,
    },
    offered,
  );
  if (verdict.decision === 'accept') {
    await rememberNegotiated(ctx, String(row.id), verdict.unitPrice);
    return { decision: 'accept', unit_price: verdict.unitPrice, message: verdict.message };
  }
  if (verdict.decision === 'counter') {
    await rememberNegotiated(ctx, String(row.id), verdict.unitPrice);
    return {
      decision: 'counter',
      unit_price: verdict.unitPrice,
      original_price: verdict.originalPrice,
      message: verdict.message,
    };
  }
  // reject: drop any previously stored negotiated price for this product
  await ctx.db
    .from('negotiated_prices')
    .delete()
    .eq('conversation_id', ctx.conversationId)
    .eq('product_id', String(row.id));
  return { decision: 'reject', message: verdict.message };
}

/** Stores the server-verified price the customer may buy at within this conversation. */
async function rememberNegotiated(ctx: AiToolContext, productId: string, unitPrice: number) {
  const { error } = await ctx.db.from('negotiated_prices').upsert(
    {
      conversation_id: ctx.conversationId,
      product_id: productId,
      unit_price: unitPrice.toFixed(2),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id,product_id' },
  );
  if (error) console.error('Failed to store negotiated price:', error.message);
}

/** Conversation-scoped negotiated prices for the given product ids. */
async function loadNegotiated(
  ctx: AiToolContext,
  productIds: string[],
): Promise<Record<string, number>> {
  if (!productIds.length) return {};
  const { data, error } = await ctx.db
    .from('negotiated_prices')
    .select('product_id, unit_price')
    .eq('conversation_id', ctx.conversationId)
    .in('product_id', productIds);
  if (error || !data) return {};
  const map: Record<string, number> = {};
  for (const row of data as Array<Record<string, unknown>>) {
    map[String(row.product_id)] = num(row.unit_price);
  }
  return map;
}

async function createOrder(ctx: AiToolContext, args: Record<string, unknown>) {
  const confirmed = args.confirmed === true;
  if (!confirmed) {
    return {
      error:
        'NOT_CONFIRMED: You must summarize items, total and address and receive an explicit yes from the customer BEFORE creating the order. Ask again and confirm.',
    };
  }
  const rawItems = Array.isArray(args.items) ? args.items : [];
  const items = rawItems
    .slice(0, 20)
    .map((i) => {
      const r = i as Record<string, unknown>;
      return {
        productId: String(r.product_id ?? ''),
        variantId: typeof r.variant_id === 'string' ? r.variant_id : undefined,
        qty: Math.max(1, Math.min(20, Math.round(num(r.qty) || 1))),
      };
    })
    .filter((i) => i.productId);

  if (!items.length) return { error: 'No valid items provided' };

  const name = typeof args.name === 'string' ? args.name.slice(0, 80) : '';
  const phone = typeof args.phone === 'string' ? args.phone.slice(0, 20) : '';
  const address = typeof args.address === 'string' ? args.address.slice(0, 300) : '';
  const deliveryZone =
    typeof args.delivery_zone === 'string' && args.delivery_zone.trim()
      ? args.delivery_zone.trim().slice(0, 60)
      : undefined;
  if (!name || !phone || address.length < 5)
    return { error: 'Customer name, valid phone and address are required' };

  // Server-verified negotiated prices for this conversation (bargaining result).
  const negotiated = await loadNegotiated(
    ctx,
    items.map((i) => i.productId),
  );

  const result = await createOrderForShop({
    db: ctx.db,
    shop: ctx.shop,
    items,
    customer: { name, phone, address },
    deliveryZone,
    source: 'ai',
    negotiated,
  });
  if (!result.ok) return { error: result.error };

  return {
    order_created: true,
    order: {
      id: result.order.id,
      total: result.order.total,
      delivery_charge: result.order.deliveryCharge,
      items: result.order.items.map((i) => ({ name: i.name, qty: i.qty, unit_price: i.unitPrice })),
      status: result.order.status,
    },
    note: 'Tell the customer the order is placed and pay on delivery. Provide no payment links.',
  };
}

async function handoff(ctx: AiToolContext, args: Record<string, unknown>) {
  const reason =
    typeof args.reason === 'string' && args.reason.trim()
      ? args.reason.slice(0, 300)
      : 'Seller assistance requested';
  await ctx.db.from('messages').insert({
    conversation_id: ctx.conversationId,
    role: 'system',
    content: `[handoff] ${reason}`,
  });
  const { error } = await ctx.db
    .from('conversations')
    .update({ status: 'needs_owner' })
    .eq('id', ctx.conversationId)
    .eq('shop_id', ctx.shop.id);
  if (error) return { error: `Handoff failed: ${error.message}` };
  return {
    handoff: true,
    note: 'Conversation flagged for the owner. Tell the customer the owner will contact them soon.',
  };
}
