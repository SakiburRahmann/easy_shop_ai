import { Hono } from 'hono';
import {
  aiSettingsSchema,
  aiToneSchema,
  aiLanguageSchema,
  categorySchema,
  storefrontSchema,
  productPublicSchema,
} from '@easyshop/shared';
import type { ApiBindings, EnvShape } from '../lib/env';
import { notFound, param } from '../lib/validation';
import { iso, num, str, strOrNull, toCategory, toProductPublic, toShop } from '../lib/serialize';
import { greetingFor } from '../lib/system-prompt';

export const storefrontRoutes = new Hono<EnvShape>();

const PUBLIC_PRODUCT_FIELDS =
  'id, shop_id, category_id, name, description, price, images, active, created_at, updated_at, variants(id, product_id, size, color, stock, price_override, created_at)';

/** Full storefront payload: shop + categories + first page of products + AI settings. */
storefrontRoutes.get('/s/:slug', async (c) => {
  const db = c.get('db');
  const slug = param(c, 'slug');
  const { data: shopRow, error: shopError } = await db
    .from('shops')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (shopError || !shopRow) {
    void notFound(c, 'Shop');
    return;
  }
  const shop = toShop(shopRow);

  const [
    { data: categoryRows, error: catError },
    { data: productRows, error: prodError },
    { data: aiRow, error: aiError },
  ] = await Promise.all([
    db
      .from('categories')
      .select('*')
      .eq('shop_id', shop.id)
      .order('name', { ascending: true })
      .limit(50),
    db
      .from('products')
      .select(PUBLIC_PRODUCT_FIELDS)
      .eq('shop_id', shop.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(24),
    db.from('ai_settings').select('*').eq('shop_id', shop.id).maybeSingle(),
  ]);
  if (catError || prodError || aiError) {
    return c.json({ error: 'Failed to load storefront' }, 500);
  }

  const aiSettings = aiSettingsSchema.parse({
    shopId: shop.id,
    tone: str((aiRow as Record<string, unknown> | null)?.tone ?? '') || 'friendly',
    languages: Array.isArray((aiRow as Record<string, unknown> | null)?.languages)
      ? ((aiRow as Record<string, unknown>).languages as string[])
      : ['bn', 'en'],
    maxDiscountPct: num((aiRow as Record<string, unknown> | null)?.max_discount_pct ?? 10),
    extraInstructions: strOrNull(
      (aiRow as Record<string, unknown> | null)?.extra_instructions ?? null,
    ),
    updatedAt: iso(
      (aiRow as Record<string, unknown> | null)?.created_at ?? new Date().toISOString(),
    ),
  });

  const payload = storefrontSchema.parse({
    shop,
    categories: (categoryRows ?? []).map((row) => categorySchema.parse(toCategory(row))),
    products: (productRows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return productPublicSchema.parse(
        toProductPublic(row, Array.isArray(r.variants) ? r.variants : []),
      );
    }),
    ai: {
      enabled: Boolean((c.env as ApiBindings | undefined)?.GEMINI_API_KEY),
      tone: aiToneSchema.parse(aiSettings.tone),
      languages: aiSettings.languages.map((l) => aiLanguageSchema.parse(l)),
      greeting: greetingFor(shop),
    },
  });
  return c.json(payload, { headers: { 'cache-control': 'public, max-age=30' } });
});

/** Public, filterable catalog for a shop. */
storefrontRoutes.get('/s/:slug/products', async (c) => {
  const db = c.get('db');
  const slug = param(c, 'slug');
  const { data: shopRow, error: shopError } = await db
    .from('shops')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (shopError || !shopRow) {
    void notFound(c, 'Shop');
    return;
  }
  const shopId = str((shopRow as Record<string, unknown>).id);

  const sp = new URL(c.req.url).searchParams;
  const limitRaw = Number(sp.get('limit') ?? '20');
  const offsetRaw = Number(sp.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  const maxPrice = Number(sp.get('maxPrice') ?? '');
  const minPrice = Number(sp.get('minPrice') ?? '');
  const q = sp.get('q')?.slice(0, 120).replace(/[%_]/g, ' ') || undefined;
  const categoryId = sp.get('categoryId') || undefined;
  const sort = sp.get('sort') || 'newest';

  let query = db
    .from('products')
    .select(PUBLIC_PRODUCT_FIELDS)
    .eq('shop_id', shopId)
    .eq('active', true)
    .limit(limit);
  if (offset) query = query.range(offset, offset + limit - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (Number.isFinite(minPrice) && sp.has('minPrice')) query = query.gte('price', minPrice);
  if (Number.isFinite(maxPrice) && sp.has('maxPrice')) query = query.lte('price', maxPrice);
  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const list = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return productPublicSchema.parse(
      toProductPublic(row, Array.isArray(r.variants) ? r.variants : []),
    );
  });
  return c.json(list, { headers: { 'cache-control': 'public, max-age=30' } });
});

/** Public product detail (any shop's active product). */
storefrontRoutes.get('/products/:productId', async (c) => {
  const db = c.get('db');
  const { data, error } = await db
    .from('products')
    .select(`${PUBLIC_PRODUCT_FIELDS}, shops(id, slug)`)
    .eq('id', param(c, 'productId'))
    .eq('active', true)
    .maybeSingle();
  if (error || !data) {
    void notFound(c, 'Product');
    return;
  }
  const r = data as Record<string, unknown>;
  const shop = r.shops as Record<string, unknown> | null;
  if (!shop) {
    void notFound(c, 'Product');
    return;
  }
  const product = productPublicSchema.parse(
    toProductPublic(data, Array.isArray(r.variants) ? r.variants : []),
  );
  return c.json(
    { ...product, shopSlug: str(shop.slug) },
    { headers: { 'cache-control': 'public, max-age=30' } },
  );
});
