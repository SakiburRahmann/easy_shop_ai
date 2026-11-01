import { Hono } from 'hono';
import {
  businessTypeSchema,
  marketplaceProductQuerySchema,
  marketplaceProductSchema,
  productPublicSchema,
  shopThemeSchema,
  templateIdSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { sanitizePostgrestIlike } from '../lib/directory';
import { PUBLIC_PRODUCT_FIELDS } from '../lib/product-fields';
import { str, toProductPublic } from '../lib/serialize';

export const marketplaceRoutes = new Hono<EnvShape>();

function categoryNameOf(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    return typeof first?.name === 'string' ? first.name : null;
  }
  if (typeof value === 'object') {
    const name = (value as Record<string, unknown>).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

/**
 * Public product discovery across every shop. Customers can search by keyword,
 * category, shop and price range; each result carries its brand-safe shop card
 * so the marketplace can link straight into the seller's storefront.
 */
marketplaceRoutes.get('/search/products', async (c) => {
  const parsed = marketplaceProductQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid search' }, 400);
  }
  const { q, category, shopSlug, minPrice, maxPrice, sort, limit, offset } = parsed.data;
  const db = c.get('db');

  let shopId: string | null = null;
  if (shopSlug) {
    const { data: shopRow, error: shopError } = await db
      .from('shops')
      .select('id')
      .eq('slug', shopSlug)
      .maybeSingle();
    if (shopError) return c.json({ error: shopError.message }, 500);
    if (!shopRow) return c.json([]);
    shopId = str((shopRow as Record<string, unknown>).id);
  }

  let categoryIds: string[] | null = null;
  if (category) {
    const safeCategory = sanitizePostgrestIlike(category);
    if (!safeCategory) return c.json([]);
    const { data: categoryRows, error: categoryError } = await db
      .from('categories')
      .select('id')
      .ilike('name', `%${safeCategory}%`)
      .limit(100);
    if (categoryError) return c.json({ error: categoryError.message }, 500);
    categoryIds = (categoryRows ?? []).map((row) => str((row as Record<string, unknown>).id));
    if (categoryIds.length === 0) return c.json([]);
  }

  let query = db
    .from('products')
    .select(
      `${PUBLIC_PRODUCT_FIELDS}, shops(id, name, slug, business_type, template_id, theme), categories(name)`,
    )
    .eq('active', true);

  if (shopId) query = query.eq('shop_id', shopId);
  if (categoryIds) query = query.in('category_id', categoryIds);
  if (minPrice != null) query = query.gte('price', minPrice);
  if (maxPrice != null) query = query.lte('price', maxPrice);

  if (q) {
    const safe = sanitizePostgrestIlike(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 500);

  const items = (data ?? []).flatMap((row) => {
    const r = row as Record<string, unknown>;
    const shopRow = r.shops as Record<string, unknown> | null;
    if (!shopRow) return [];

    const product = productPublicSchema.safeParse(
      toProductPublic(row, Array.isArray(r.variants) ? r.variants : []),
    );
    if (!product.success) return [];

    const businessType = businessTypeSchema.safeParse(shopRow.business_type);
    const templateId = templateIdSchema.safeParse(shopRow.template_id);
    const parsedItem = marketplaceProductSchema.safeParse({
      product: product.data,
      shop: {
        id: shopRow.id,
        name: shopRow.name,
        slug: shopRow.slug,
        businessType: businessType.success ? businessType.data : 'other',
        templateId: templateId.success ? templateId.data : 'classic',
        theme: shopThemeSchema.parse(shopRow.theme ?? {}),
      },
      categoryName: categoryNameOf(r.categories),
    });
    return parsedItem.success ? [parsedItem.data] : [];
  });

  return c.json(items, { headers: { 'cache-control': 'public, max-age=5' } });
});
