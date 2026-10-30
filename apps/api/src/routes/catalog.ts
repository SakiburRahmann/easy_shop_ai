import { Hono } from 'hono';
import {
  productAdminSchema,
  productInputSchema,
  productUpdateInputSchema,
  uploadInputSchema,
  uploadResultSchema,
  variantInputSchema,
  variantSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { requireAuth, ownedShop } from '../lib/auth';
import { notFound, param, parseBody } from '../lib/validation';
import { ownerShopIdOf } from '../lib/auth';
import { uploadImage } from '../lib/storage';
import { str, toProductAdmin, toVariant } from '../lib/serialize';

export const catalogRoutes = new Hono<EnvShape>();

const PRODUCT_FIELDS =
  'id, shop_id, category_id, name, description, price, floor_price, images, active, created_at, updated_at, variants(id, product_id, size, color, stock, price_override, created_at)';

interface SellerProductListQuery {
  q?: string;
  categoryId?: string;
  activeOnly: boolean;
  limit: number;
  offset: number;
}

function sellerListQuery(c: { req: { url: string } }): SellerProductListQuery {
  const sp = new URL(c.req.url).searchParams;
  const limitRaw = Number(sp.get('limit') ?? '');
  const offsetRaw = Number(sp.get('offset') ?? '');
  return {
    q: sp.get('q')?.slice(0, 120) || undefined,
    categoryId: sp.get('categoryId') || undefined,
    activeOnly: sp.get('active') === 'true',
    limit: Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 20,
    offset: Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0,
  };
}

/** Seller product list (includes floor prices and variants). */
catalogRoutes.get('/shops/:shopId/products', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (shop instanceof Response) return shop;
  const q = sellerListQuery(c);
  const db = c.get('db');

  let query = db.from('products').select(PRODUCT_FIELDS).eq('shop_id', shop.id).limit(q.limit);
  if (q.offset) query = query.range(q.offset, q.offset + q.limit - 1);
  if (q.q) query = query.ilike('name', `%${q.q.replace(/[%_]/g, ' ')}%`);
  if (q.categoryId) query = query.eq('category_id', q.categoryId);
  if (q.activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const list = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return productAdminSchema.parse(
      toProductAdmin(row, Array.isArray(r.variants) ? r.variants : []),
    );
  });
  return c.json(list);
});

catalogRoutes.post('/shops/:shopId/products', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (shop instanceof Response) return shop;
  const input = await parseBody(c, productInputSchema);
  const db = c.get('db');

  if (input.categoryId) {
    const { data: cat } = await db
      .from('categories')
      .select('shop_id')
      .eq('id', input.categoryId)
      .eq('shop_id', shop.id)
      .maybeSingle();
    if (!cat) return c.json({ error: 'Category does not belong to this shop' }, 400);
  }

  const { data: productRow, error } = await db
    .from('products')
    .insert({
      shop_id: shop.id,
      category_id: input.categoryId ?? null,
      name: input.name,
      description: input.description ?? null,
      price: input.price.toFixed(2),
      floor_price: (input.floorPrice ?? 0).toFixed(2),
      images: input.images ?? [],
      active: input.active ?? true,
    })
    .select(PRODUCT_FIELDS)
    .single();
  if (error || !productRow)
    return c.json({ error: error?.message ?? 'Product creation failed' }, 500);

  let row = productRow as Record<string, unknown>;
  if (input.variants?.length) {
    const { error: varError } = await db.from('variants').insert(
      input.variants.map((v) => ({
        product_id: row.id,
        size: v.size ?? null,
        color: v.color ?? null,
        stock: v.stock ?? 0,
        price_override: v.priceOverride != null ? v.priceOverride.toFixed(2) : null,
      })),
    );
    if (varError)
      return c.json({ error: `Product created but variants failed: ${varError.message}` }, 500);
    const { data: fresh, error: refetchError } = await db
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('id', row.id)
      .single();
    if (refetchError || !fresh) return c.json({ error: 'Product created but reload failed' }, 500);
    row = fresh as Record<string, unknown>;
  }
  return c.json(
    productAdminSchema.parse(toProductAdmin(row, Array.isArray(row.variants) ? row.variants : [])),
    201,
  );
});

async function productAndShop(
  c: Parameters<typeof ownedShop>[0],
  productId: string,
): Promise<string | Response> {
  const db = c.get('db');
  const { data, error } = await db
    .from('products')
    .select('shop_id')
    .eq('id', productId)
    .maybeSingle();
  if (error || !data) return notFound(c, 'Product');
  const shop = await ownedShop(c, str((data as Record<string, unknown>).shop_id));
  if (shop instanceof Response) return shop;
  return productId;
}

catalogRoutes.patch('/products/:productId', requireAuth, async (c) => {
  const productId = await productAndShop(c, param(c, 'productId'));
  if (productId instanceof Response) return productId;
  const input = await parseBody(c, productUpdateInputSchema);
  const db = c.get('db');

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.price !== undefined) patch.price = input.price.toFixed(2);
  if (input.floorPrice !== undefined) patch.floor_price = input.floorPrice.toFixed(2);
  if (input.images !== undefined) patch.images = input.images;
  if (input.active !== undefined) patch.active = input.active;
  if (Object.prototype.hasOwnProperty.call(input, 'categoryId'))
    patch.category_id = input.categoryId ?? null;

  if (Object.keys(patch).length) {
    const { error } = await db.from('products').update(patch).eq('id', productId);
    if (error) return c.json({ error: error.message }, 500);
  }
  // Replace-all variant semantics when variants provided.
  if (input.variants !== undefined) {
    const { error: delError } = await db.from('variants').delete().eq('product_id', productId);
    if (delError) return c.json({ error: delError.message }, 500);
    if (input.variants.length) {
      const { error: insError } = await db.from('variants').insert(
        input.variants.map((v) => ({
          product_id: productId,
          size: v.size ?? null,
          color: v.color ?? null,
          stock: v.stock ?? 0,
          price_override: v.priceOverride != null ? v.priceOverride.toFixed(2) : null,
        })),
      );
      if (insError) return c.json({ error: `Variants replace failed: ${insError.message}` }, 500);
    }
  }

  const { data: fresh, error: reloadError } = await db
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('id', productId)
    .single();
  if (reloadError || !fresh) return c.json({ error: 'Product not found after update' }, 404);
  const r = fresh as Record<string, unknown>;
  return c.json(
    productAdminSchema.parse(toProductAdmin(fresh, Array.isArray(r.variants) ? r.variants : [])),
  );
});

catalogRoutes.delete('/products/:productId', requireAuth, async (c) => {
  const productId = await productAndShop(c, param(c, 'productId'));
  if (productId instanceof Response) return productId;
  const db = c.get('db');
  const { error } = await db.from('products').delete().eq('id', productId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/* ---------------------------------------------------------------- variants -- */

catalogRoutes.post('/products/:productId/variants', requireAuth, async (c) => {
  const productId = await productAndShop(c, param(c, 'productId'));
  if (productId instanceof Response) return productId;
  const input = await parseBody(c, variantInputSchema);
  const db = c.get('db');
  const { data, error } = await db
    .from('variants')
    .insert({
      product_id: productId,
      size: input.size ?? null,
      color: input.color ?? null,
      stock: input.stock ?? 0,
      price_override: input.priceOverride != null ? input.priceOverride.toFixed(2) : null,
    })
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Variant creation failed' }, 500);
  return c.json(variantSchema.parse(toVariant(data)), 201);
});

async function variantAndShop(c: Parameters<typeof ownedShop>[0]): Promise<string | Response> {
  const db = c.get('db');
  const { data, error } = await db
    .from('variants')
    .select('product_id')
    .eq('id', param(c, 'variantId'))
    .maybeSingle();
  if (error || !data) return notFound(c, 'Variant');
  return productAndShop(c, str((data as Record<string, unknown>).product_id));
}

catalogRoutes.patch('/variants/:variantId', requireAuth, async (c) => {
  const productId = await variantAndShop(c);
  if (productId instanceof Response) return productId;
  const input = await parseBody(c, variantInputSchema);
  const db = c.get('db');
  const patch: Record<string, unknown> = {};
  if (input.size !== undefined) patch.size = input.size ?? null;
  if (input.color !== undefined) patch.color = input.color ?? null;
  if (input.stock !== undefined) patch.stock = input.stock;
  if (input.priceOverride !== undefined)
    patch.price_override = input.priceOverride != null ? input.priceOverride.toFixed(2) : null;
  if (!Object.keys(patch).length) return c.json({ error: 'Nothing to update' }, 400);
  const { data, error } = await db
    .from('variants')
    .update(patch)
    .eq('id', param(c, 'variantId'))
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Update failed' }, 500);
  return c.json(variantSchema.parse(toVariant(data)));
});

catalogRoutes.delete('/variants/:variantId', requireAuth, async (c) => {
  const productId = await variantAndShop(c);
  if (productId instanceof Response) return productId;
  const db = c.get('db');
  const { error } = await db.from('variants').delete().eq('id', param(c, 'variantId'));
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/* ----------------------------------------------------------------- uploads -- */

catalogRoutes.post('/uploads', requireAuth, async (c) => {
  const input = await parseBody(c, uploadInputSchema);
  const db = c.get('db');
  const shopId = await ownerShopIdOf(db, c.get('authUser').id);
  if (!shopId) return c.json({ error: 'Create your shop before uploading images' }, 400);

  const result = await uploadImage(db, shopId, input.contentType, input.dataBase64);
  if ('error' in result) return c.json({ error: result.error }, 400);
  return c.json(uploadResultSchema.parse(result), 201);
});
