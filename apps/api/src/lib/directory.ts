import {
  businessTypeSchema,
  shopDirectoryItemSchema,
  type ShopDirectoryItem,
} from '@easyshop/shared';

/**
 * PostgREST `or=` value sanitization: `,`, `(`, `)`, `"` and among other
 * syntax characters change filter structure, so untrusted search text must
 * never reach the API layer verbatim.
 */
export function sanitizePostgrestIlike(q: string): string {
  return q
    .replace(/[(),"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ShopRow = Record<string, unknown>;
type ProductRow = { shop_id: unknown; images: unknown };

/**
 * Shapes marketplace directory items from shop rows plus the active product
 * rows of the same shops (per-shop aggregate). Pure; the route calls this
 * after fetching — invalid rows are dropped, never thrown to the client.
 */
export function toDirectoryItems(
  rows: readonly ShopRow[],
  productRows: readonly ProductRow[],
): ShopDirectoryItem[] {
  const byShop = new Map<string, { count: number; images: string[] }>();
  for (const p of productRows) {
    const shopId = typeof p.shop_id === 'string' ? p.shop_id : String(p.shop_id ?? '');
    const entry = byShop.get(shopId) ?? { count: 0, images: [] };
    entry.count += 1;
    const images = Array.isArray(p.images)
      ? p.images.filter((u): u is string => typeof u === 'string')
      : [];
    if (entry.images.length < 4 && images[0]) entry.images.push(images[0]);
    byShop.set(shopId, entry);
  }
  const items: ShopDirectoryItem[] = [];
  for (const result of rows.map((r) =>
    shopDirectoryItemSchema.safeParse({
      id: r.id,
      name: r.name,
      slug: r.slug,
      businessType: businessTypeSchema.safeParse(r.business_type).data ?? 'other',
      description: r.description ?? null,
      templateId: r.template_id === 'modern' ? 'modern' : 'classic',
      theme: r.theme ?? {},
      contact: r.contact ?? {},
      productCount: byShop.get(String(r.id ?? ''))?.count ?? 0,
      topImages: byShop.get(String(r.id ?? ''))?.images ?? [],
    }),
  )) {
    if (result.success) items.push(result.data);
  }
  return items;
}
