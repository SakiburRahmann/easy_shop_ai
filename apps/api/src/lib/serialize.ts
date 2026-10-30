import type {
  AiSettings,
  Category,
  ChatProductCard,
  Conversation,
  Message,
  Order,
  OrderItemView,
  OrderView,
  Product,
  ProductAdmin,
  ProductPublic,
  Shop,
  Variant,
} from '@easyshop/shared';

/**
 * Row → DTO mappers. PostgREST returns numeric columns as strings and
 * timestamps with +00:00 offsets; DTOs promise numbers and strict ISO "Z"
 * timestamps, so every value is coerced defensively here.
 */

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null | undefined {
  if (v === null || v === undefined) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function strOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

/** Normalizes a timestamp (string or Date) to strict ISO-8601 zulu form. */
export function iso(v: unknown): string {
  const d = v ? new Date(v as string) : new Date(0);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function obj(v: unknown): Record<string, unknown> {
  return rec(v);
}

export function toShop(row: unknown): Shop {
  const r = rec(row);
  const contact = obj(r.contact);
  const delivery = obj(r.delivery_rules);
  const zones = Array.isArray(delivery.zones)
    ? delivery.zones.map((z) => {
        const zz = rec(z);
        return { name: str(zz.name), charge: num(zz.charge), etaDays: num(zz.etaDays) };
      })
    : [];
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    name: str(r.name),
    slug: str(r.slug),
    description: strOrNull(r.description),
    logoUrl: strOrNull(r.logo_url),
    templateId: (str(r.template_id, 'classic') as Shop['templateId']) || 'classic',
    theme: obj(r.theme) as Shop['theme'],
    contact: {
      phone: strOrNull(contact.phone) ?? undefined,
      email: strOrNull(contact.email) ?? undefined,
      facebook: strOrNull(contact.facebook) ?? undefined,
    },
    deliveryRules: { zones },
    policies: obj(r.policies) as Shop['policies'],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toCategory(row: unknown): Category {
  const r = rec(row);
  return {
    id: str(r.id),
    shopId: str(r.shop_id),
    name: str(r.name),
    createdAt: iso(r.created_at),
  };
}

export function toVariant(row: unknown): Variant {
  const r = rec(row);
  return {
    id: str(r.id),
    productId: str(r.product_id),
    size: strOrNull(r.size),
    color: strOrNull(r.color),
    stock: num(r.stock),
    priceOverride: numOrNull(r.price_override),
    createdAt: iso(r.created_at),
  };
}

export function toProduct(row: unknown): Product {
  const r = rec(row);
  return {
    id: str(r.id),
    shopId: str(r.shop_id),
    categoryId: strOrNull(r.category_id),
    name: str(r.name),
    description: strOrNull(r.description),
    price: num(r.price),
    floorPrice: num(r.floor_price),
    images: strArr(r.images),
    active: r.active !== false,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toProductAdmin(row: unknown, variants: unknown[]): ProductAdmin {
  return { ...toProduct(row), variants: variants.map(toVariant) };
}

/** Public products never carry floorPrice/shopId (bargaining integrity). */
export function toProductPublic(row: unknown, variants: unknown[]): ProductPublic {
  const { floorPrice: _floor, shopId: _shopId, ...rest } = toProduct(row);
  void _floor;
  void _shopId;
  return { ...rest, variants: variants.map(toVariant) };
}

export function toAiSettings(row: unknown): AiSettings {
  const r = rec(row);
  return {
    shopId: str(r.shop_id),
    tone: (str(r.tone, 'friendly') as AiSettings['tone']) || 'friendly',
    languages: (strArr(r.languages) as AiSettings['languages']).length
      ? (strArr(r.languages) as AiSettings['languages'])
      : ['bn', 'en'],
    maxDiscountPct: num(r.max_discount_pct),
    extraInstructions: strOrNull(r.extra_instructions),
    updatedAt: iso(r.updated_at),
  };
}

export function toOrder(row: unknown): Order {
  const r = rec(row);
  return {
    id: str(r.id),
    shopId: str(r.shop_id),
    customerName: str(r.customer_name),
    customerPhone: str(r.customer_phone),
    customerAddress: str(r.customer_address),
    note: strOrNull(r.note),
    subtotal: num(r.subtotal),
    deliveryCharge: num(r.delivery_charge),
    total: num(r.total),
    status: (str(r.status, 'pending') as Order['status']) || 'pending',
    paymentMethod: 'cod',
    source: (str(r.source, 'storefront') as Order['source']) || 'storefront',
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toOrderItemView(row: unknown, product?: unknown, variant?: unknown): OrderItemView {
  const r = rec(row);
  const p = rec(product);
  const v = rec(variant);
  const images = strArr(p.images);
  return {
    id: str(r.id),
    orderId: str(r.order_id),
    productId: str(r.product_id),
    variantId: strOrNull(r.variant_id),
    qty: num(r.qty),
    unitPrice: num(r.unit_price),
    name: str(p.name, ''),
    image: images[0] ?? null,
    size: strOrNull(v.size),
    color: strOrNull(v.color),
  };
}

export function toOrderView(row: unknown, items: unknown[]): OrderView {
  return { ...toOrder(row), items: items.map((i) => toOrderItemView(i)) };
}

export function toConversation(
  row: unknown,
  messageCount: number,
  lastMessageContent?: string | null,
): Conversation {
  const r = rec(row);
  return {
    id: str(r.id),
    shopId: str(r.shop_id),
    visitorId: str(r.visitor_id),
    status: (str(r.status, 'active') as Conversation['status']) || 'active',
    messageCount,
    lastMessage: lastMessageContent ?? undefined,
    lastMessageAt: iso(r.last_message_at),
    createdAt: iso(r.created_at),
  };
}

export function toMessage(row: unknown): Message {
  const r = rec(row);
  return {
    id: str(r.id),
    conversationId: str(r.conversation_id),
    role: (str(r.role, 'customer') as Message['role']) || 'customer',
    content: str(r.content),
    createdAt: iso(r.created_at),
  };
}

export function cardFromProduct(p: ProductPublic): ChatProductCard {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.images[0] ?? null,
    stock: p.variants.length ? p.variants.reduce((s, v) => s + v.stock, 0) : null,
  };
}
