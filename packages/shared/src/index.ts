/**
 * @easyshop/shared — contracts for the whole platform.
 *
 * Every API request/response shape lives here as a Zod schema. Apps never
 * redefine shared types — they import from this package (AGENTS.md rule #1).
 * The API validates everything it receives with these schemas (rule #2).
 */
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

export const userRoleSchema = z.enum(['seller', 'customer', 'admin']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const shopSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'lowercase letters, digits and hyphens');
export type ShopSlug = z.infer<typeof shopSlugSchema>;

const uuidSchema = z.uuid();
const isoDateTimeSchema = z.iso.datetime();
/** Money amounts in BDT (৳). Numbers over the wire. */
const moneySchema = z.number().min(0).max(10_000_000);
const phoneSchema = z
  .string()
  .min(6)
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, 'digits, spaces, +, - only');

/* -------------------------------------------------------------------------- */
/* Shop                                                                       */
/* -------------------------------------------------------------------------- */

export const templateIdSchema = z.enum(['classic', 'modern', 'boutique']);
export type TemplateId = z.infer<typeof templateIdSchema>;

/** Storefront layouts a seller can launch with. */
export const STOREFRONT_TEMPLATES = {
  classic: {
    label: 'Classic',
    description: 'Catalog-first: a dense retail bar and an even product grid, no hero.',
  },
  modern: {
    label: 'Modern',
    description: 'Collage: a full-bleed hero, category mosaic, product rail and gallery grid.',
  },
  boutique: {
    label: 'Boutique',
    description:
      'Editorial: a centred serif masthead, oversized hero and roomy two-column catalog.',
  },
} as const satisfies Record<TemplateId, { label: string; description: string }>;

export const businessTypeSchema = z.enum([
  'fashion',
  'electronics',
  'beauty',
  'groceries',
  'home',
  'kids',
  'other',
]);
export type BusinessType = z.infer<typeof businessTypeSchema>;

/**
 * Store-builder presets: every business type gets a starter category tree and
 * a sensible default template. The API seeds these categories when a shop is
 * created, so the AI has a real catalog structure from minute one.
 */
export const BUSINESS_TYPE_PRESETS = {
  fashion: {
    label: 'Fashion & apparel',
    blurb: 'Clothing, sarees, panjabis and accessories',
    categories: ['T-Shirts', 'Shirts', 'Sarees', 'Panjabi', 'Kids', 'Accessories'],
    suggestedTemplate: 'modern',
  },
  electronics: {
    label: 'Electronics',
    blurb: 'Phones, audio, chargers and gadgets',
    categories: ['Phones', 'Audio', 'Chargers', 'Accessories'],
    suggestedTemplate: 'classic',
  },
  beauty: {
    label: 'Beauty & care',
    blurb: 'Skincare, makeup, haircare and fragrance',
    categories: ['Skincare', 'Makeup', 'Haircare', 'Fragrance'],
    suggestedTemplate: 'boutique',
  },
  groceries: {
    label: 'Groceries',
    blurb: 'Staples, snacks, beverages and household',
    categories: ['Rice & staples', 'Snacks', 'Beverages', 'Household'],
    suggestedTemplate: 'classic',
  },
  home: {
    label: 'Home & living',
    blurb: 'Kitchen, decor, bedding and storage',
    categories: ['Kitchen', 'Decor', 'Bedding', 'Storage'],
    suggestedTemplate: 'boutique',
  },
  kids: {
    label: 'Kids & toys',
    blurb: 'Clothing, toys and school supplies',
    categories: ['Clothing', 'Toys', 'School'],
    suggestedTemplate: 'modern',
  },
  other: {
    label: 'Something else',
    blurb: 'Start with a general store and shape it yourself',
    categories: ['New arrivals', 'Best sellers', 'Accessories'],
    suggestedTemplate: 'classic',
  },
} as const satisfies Record<
  BusinessType,
  {
    label: string;
    blurb: string;
    categories: readonly string[];
    suggestedTemplate: TemplateId;
  }
>;

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const deliveryZoneSchema = z.object({
  name: z.string().min(1).max(60),
  charge: moneySchema,
  etaDays: z.number().int().min(0).max(30),
});
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;
export const shopContactSchema = z.object({
  phone: phoneSchema.optional(),
  email: z.email().optional(),
  facebook: z.string().max(200).optional(),
});
export const shopThemeSchema = z
  .object({
    primaryColor: hexColorSchema.optional(),
    accentColor: hexColorSchema.optional(),
    font: z.enum(['sans', 'serif']).optional(),
  })
  .catch({});
export const shopPoliciesSchema = z.object({
  returnPolicy: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const shopSchema = z.object({
  id: uuidSchema,
  ownerId: uuidSchema,
  name: z.string().min(1).max(80),
  slug: shopSlugSchema,
  businessType: businessTypeSchema,
  description: z.string().max(1000).nullish(),
  logoUrl: z.url().nullish(),
  templateId: templateIdSchema,
  theme: shopThemeSchema,
  contact: shopContactSchema,
  /** Delivery zones with charges; empty = shop has no detail yet. */
  deliveryRules: z.object({ zones: z.array(deliveryZoneSchema).max(20) }),
  policies: shopPoliciesSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Shop = z.infer<typeof shopSchema>;

export const shopCreateInputSchema = z.object({
  name: z.string().min(1).max(80),
  businessType: businessTypeSchema.optional(),
  description: z.string().max(1000).optional(),
  templateId: templateIdSchema.optional(),
  theme: shopThemeSchema.optional(),
  contact: shopContactSchema.optional(),
  deliveryRules: z.object({ zones: z.array(deliveryZoneSchema).max(20) }).optional(),
  policies: shopPoliciesSchema.optional(),
});
export type ShopCreateInput = z.infer<typeof shopCreateInputSchema>;

export const shopUpdateInputSchema = shopCreateInputSchema
  .partial()
  .extend({ logoUrl: z.url().nullish() });
export type ShopUpdateInput = z.infer<typeof shopUpdateInputSchema>;

/* -------------------------------------------------------------------------- */
/* Marketplace directory (public discovery)                                   */
/* -------------------------------------------------------------------------- */

/** Public shop-card payload for the marketplace. No per-shop secrets. */
export const shopDirectoryItemSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(80),
  slug: shopSlugSchema,
  businessType: businessTypeSchema,
  description: z.string().max(1000).nullish(),
  templateId: templateIdSchema,
  theme: shopThemeSchema,
  contact: shopContactSchema,
  /** Number of active catalog items — lets the marketplace rank full shops. */
  productCount: z.number().int().min(0),
  /** Up to four product images for the shop card collage. */
  topImages: z.array(z.url().max(500)).max(4),
});
export type ShopDirectoryItem = z.infer<typeof shopDirectoryItemSchema>;

export const shopDirectoryQuerySchema = z.object({
  q: z.string().max(120).optional(),
  /** Narrow the marketplace to one kind of business. */
  businessType: businessTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).default(24),
  offset: z.number().int().min(0).default(0),
});
export type ShopDirectoryQuery = z.infer<typeof shopDirectoryQuerySchema>;

/* -------------------------------------------------------------------------- */
/* AI settings (per shop)                                                     */
/* -------------------------------------------------------------------------- */

export const aiToneSchema = z.enum(['friendly', 'formal', 'playful']);
export type AiTone = z.infer<typeof aiToneSchema>;

/** Value languages the assistant may converse in (Banglish is auto-detected). */
export const aiLanguageSchema = z.enum(['bn', 'en']);
export type AiLanguage = z.infer<typeof aiLanguageSchema>;

export const aiSettingsSchema = z.object({
  shopId: uuidSchema,
  tone: aiToneSchema,
  languages: z.array(aiLanguageSchema).min(1),
  /** Hard cap on the relative discount the assistant may negotiate. */
  maxDiscountPct: z.number().int().min(0).max(90),
  extraInstructions: z.string().max(2000).nullish(),
  updatedAt: isoDateTimeSchema,
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const aiSettingsUpdateInputSchema = z
  .object({
    tone: aiToneSchema,
    languages: z.array(aiLanguageSchema).min(1),
    maxDiscountPct: z.number().int().min(0).max(90),
    extraInstructions: z.string().max(2000).nullish(),
  })
  .partial();
export type AiSettingsUpdateInput = z.infer<typeof aiSettingsUpdateInputSchema>;

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export const categorySchema = z.object({
  id: uuidSchema,
  shopId: uuidSchema,
  name: z.string().min(1).max(60),
  createdAt: isoDateTimeSchema,
});
export type Category = z.infer<typeof categorySchema>;
export const categoryInputSchema = z.object({ name: z.string().min(1).max(60) });
export type CategoryInput = z.infer<typeof categoryInputSchema>;

/* -------------------------------------------------------------------------- */
/* Products & variants                                                        */
/* -------------------------------------------------------------------------- */

export const variantSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  size: z.string().max(40).nullish(),
  color: z.string().max(40).nullish(),
  stock: z.number().int().min(0),
  priceOverride: moneySchema.nullish(),
  createdAt: isoDateTimeSchema,
});
export type Variant = z.infer<typeof variantSchema>;

export const variantInputSchema = z
  .object({
    size: z.string().max(40).optional(),
    color: z.string().max(40).optional(),
    stock: z.number().int().min(0).optional(),
    priceOverride: moneySchema.nullish(),
  })
  .partial();
export type VariantInput = z.infer<typeof variantInputSchema>;

export const productSchema = z.object({
  id: uuidSchema,
  shopId: uuidSchema,
  categoryId: uuidSchema.nullish(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullish(),
  price: moneySchema,
  /** Seller's confidential bargaining floor. Never exposed publicly. */
  floorPrice: moneySchema,
  /**
   * Stock for products sold without variants. Products WITH variants keep
   * their inventory per variant and ignore this field.
   */
  stock: z.number().int().min(0).max(1_000_000),
  images: z.array(z.url().max(500)).max(8),
  active: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Product = z.infer<typeof productSchema>;

/** Seller-facing product including floor price and management fields. */
export const productAdminSchema = productSchema.extend({ variants: z.array(variantSchema) });
export type ProductAdmin = z.infer<typeof productAdminSchema>;

/**
 * Public (storefront/customer-facing) product. Deliberately omits
 * `floorPrice` and `shopId` — the floor must never leak to the customer.
 */
export const productPublicSchema = productSchema
  .omit({ floorPrice: true, shopId: true })
  .extend({ variants: z.array(variantSchema) });
export type ProductPublic = z.infer<typeof productPublicSchema>;

export const productInputSchema = z.object({
  categoryId: uuidSchema.nullish(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  price: moneySchema,
  floorPrice: moneySchema.optional(),
  /** Stock used when the product has no variants (defaults to 0 on create). */
  stock: z.number().int().min(0).max(1_000_000).optional(),
  images: z.array(z.url().max(500)).max(8).optional(),
  active: z.boolean().optional(),
  variants: z.array(variantInputSchema).max(30).optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;
export const productUpdateInputSchema = productInputSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateInputSchema>;

/**
 * Customer-facing availability. Variant products sum their variants; plain
 * products use their own stock. Shared by the storefront, checkout and the AI
 * cards so every surface agrees on what "in stock" means.
 */
export function productAvailableStock(product: Pick<ProductPublic, 'stock' | 'variants'>): number {
  return product.variants.length
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : product.stock;
}

/** True when a product cannot be ordered at all (no purchasable unit). */
export function productSoldOut(product: Pick<ProductPublic, 'stock' | 'variants'>): boolean {
  if (product.variants.length) return product.variants.every((variant) => variant.stock <= 0);
  return product.stock <= 0;
}

export const productQuerySchema = z.object({
  q: z.string().max(120).optional(),
  categoryId: uuidSchema.optional(),
  maxPrice: moneySchema.optional(),
  minPrice: moneySchema.optional(),
  color: z.string().max(40).optional(),
  size: z.string().max(40).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

/* -------------------------------------------------------------------------- */
/* Marketplace product search (cross-shop, public)                            */
/* -------------------------------------------------------------------------- */

/** A public product plus the shop that sells it, for marketplace results. */
export const marketplaceProductSchema = z.object({
  product: productPublicSchema,
  shop: z.object({
    id: uuidSchema,
    name: z.string().min(1).max(80),
    slug: shopSlugSchema,
    businessType: businessTypeSchema,
    templateId: templateIdSchema,
    theme: shopThemeSchema,
  }),
  categoryName: z.string().max(60).nullish(),
});
export type MarketplaceProduct = z.infer<typeof marketplaceProductSchema>;

export const marketplaceProductQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(60).optional(),
  shopSlug: shopSlugSchema.optional(),
  minPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
export type MarketplaceProductQuery = z.infer<typeof marketplaceProductQuerySchema>;

/** Public product detail, used by the storefront deep-link/order modal. */
export const publicProductDetailSchema = z.object({
  product: productPublicSchema,
  shop: z.object({
    id: uuidSchema,
    name: z.string().min(1).max(80),
    slug: shopSlugSchema,
  }),
});
export type PublicProductDetail = z.infer<typeof publicProductDetailSchema>;

/* -------------------------------------------------------------------------- */
/* Orders                                                                     */
/* -------------------------------------------------------------------------- */

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export const orderSourceSchema = z.enum(['ai', 'storefront']);
export type OrderSource = z.infer<typeof orderSourceSchema>;

export const orderSchema = z.object({
  id: uuidSchema,
  shopId: uuidSchema,
  customerName: z.string().min(1).max(80),
  customerPhone: phoneSchema,
  customerAddress: z.string().min(5).max(300),
  note: z.string().max(500).nullish(),
  subtotal: moneySchema,
  deliveryCharge: moneySchema,
  total: moneySchema,
  status: orderStatusSchema,
  paymentMethod: z.literal('cod'),
  source: orderSourceSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Order = z.infer<typeof orderSchema>;

/** Order item enriched with product display info for owners/storefront. */
export const orderItemViewSchema = z.object({
  id: uuidSchema,
  orderId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema.nullish(),
  qty: z.number().int().min(1),
  unitPrice: moneySchema,
  name: z.string().min(1).max(120),
  image: z.url().max(500).nullish(),
  size: z.string().max(40).nullish(),
  color: z.string().max(40).nullish(),
});
export type OrderItemView = z.infer<typeof orderItemViewSchema>;

export const orderViewSchema = orderSchema.extend({ items: z.array(orderItemViewSchema) });
export type OrderView = z.infer<typeof orderViewSchema>;

export const createOrderInputSchema = z.object({
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        variantId: uuidSchema.optional(),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
  customer: z.object({
    name: z.string().min(1).max(80),
    phone: phoneSchema,
    address: z.string().min(5).max(300),
  }),
  /** Name of the seller-defined delivery zone. Required when the shop has zones. */
  deliveryZone: z.string().min(1).max(60).optional(),
  note: z.string().max(500).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const orderStatusUpdateInputSchema = z.object({ status: orderStatusSchema });
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateInputSchema>;

/** Server-side verdict on a customer's bargaining offer. */
export const discountVerdictSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('accept'),
    unitPrice: moneySchema,
    message: z.string().max(200),
  }),
  z.object({
    decision: z.literal('counter'),
    unitPrice: moneySchema,
    originalPrice: moneySchema,
    floorPrice: moneySchema,
    maxDiscountPct: z.number(),
    message: z.string().max(200),
  }),
  z.object({ decision: z.literal('reject'), message: z.string().max(200) }),
]);
export type DiscountVerdict = z.infer<typeof discountVerdictSchema>;

/* -------------------------------------------------------------------------- */
/* Uploads                                                                    */
/* -------------------------------------------------------------------------- */

export const uploadInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[^/\\]+$/, 'plain filename, no path parts'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  /** base64-encoded file bytes, max ~4.5 MB encoded. */
  dataBase64: z.string().max(6_400_000),
});
export type UploadInput = z.infer<typeof uploadInputSchema>;
export const uploadResultSchema = z.object({ url: z.url() });

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export const signUpInputSchema = z.object({
  email: z.email().max(120),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(80).optional(),
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const signInInputSchema = z.object({
  email: z.email().max(120),
  password: z.string().min(8).max(72),
});
export type SignInInput = z.infer<typeof signInInputSchema>;

export const authUserSchema = z.object({ id: uuidSchema, email: z.email().max(120) });
export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type Session = z.infer<typeof sessionSchema>;

export const meResponseSchema = z.object({ user: authUserSchema, shop: shopSchema.nullish() });
export type MeResponse = z.infer<typeof meResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Storefront (public)                                                        */
/* -------------------------------------------------------------------------- */

/** Public shop payload — excludes nothing sensitive; policies shown to customers. */
export const storefrontSchema = z.object({
  shop: shopSchema,
  categories: z.array(categorySchema),
  products: z.array(productPublicSchema),
  ai: z.object({
    enabled: z.boolean(),
    tone: aiToneSchema,
    languages: z.array(aiLanguageSchema),
    greeting: z.string().max(500),
  }),
});
export type Storefront = z.infer<typeof storefrontSchema>;

/* -------------------------------------------------------------------------- */
/* Chat (AI assistant)                                                        */
/* -------------------------------------------------------------------------- */

export const chatRequestSchema = z.object({
  shopSlug: shopSlugSchema,
  message: z.string().min(1).max(1000),
  /** Stable, client-generated anonymous id, e.g. crypto.randomUUID(). */
  visitorId: z.string().min(8).max(64).optional(),
  conversationId: uuidSchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Product card rendered by the UI from tool output — never from model text. */
export const chatProductCardSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  price: moneySchema,
  image: z.url().max(500).nullish(),
  stock: z.number().int().min(0).nullish(),
});
export type ChatProductCard = z.infer<typeof chatProductCardSchema>;

/**
 * SSE event stream sent by POST /chat. Product data travels ONLY inside
 * `cards` events (from tool results) — rule #3 and NFR-02 are architectural:
 * the model's text alone can never render a product.
 */
export const chatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), conversationId: uuidSchema }),
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('cards'), cards: z.array(chatProductCardSchema).max(6) }),
  z.object({
    type: z.literal('tool'),
    name: z.string().max(40),
    status: z.enum(['running', 'done']),
  }),
  z.object({ type: z.literal('done'), messageId: uuidSchema.nullish() }),
  z.object({ type: z.literal('error'), message: z.string().max(300) }),
]);
export type ChatEvent = z.infer<typeof chatEventSchema>;

/* -------------------------------------------------------------------------- */
/* Conversations (seller side)                                                */
/* -------------------------------------------------------------------------- */

export const conversationStatusSchema = z.enum(['active', 'needs_owner', 'closed']);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const conversationSchema = z.object({
  id: uuidSchema,
  shopId: uuidSchema,
  visitorId: z.string().min(8).max(64),
  status: conversationStatusSchema,
  messageCount: z.number().int().min(0),
  lastMessage: z.string().max(8000).nullish(),
  lastMessageAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageRoleSchema = z.enum(['customer', 'assistant', 'system', 'owner']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageSchema = z.object({
  id: uuidSchema,
  conversationId: uuidSchema,
  role: messageRoleSchema,
  content: z.string().max(8000),
  createdAt: isoDateTimeSchema,
});
export type Message = z.infer<typeof messageSchema>;

export const conversationUpdateInputSchema = z.object({ status: conversationStatusSchema });
export type ConversationUpdateInput = z.infer<typeof conversationUpdateInputSchema>;

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export const errorResponseSchema = z.object({
  error: z.string().max(300),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
