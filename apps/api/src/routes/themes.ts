/**
 * Storefront theme library.
 *
 * The seller browses themes and applies one — the platform never generates a
 * site. `PATCH /shops/:shopId/storefront` writes the applied preset document
 * (`shops.storefront`) and keeps `template_id` / `theme` in sync so marketplace
 * cards, deep links and the legacy preset path stay coherent.
 */
import { Hono } from 'hono';
import {
  shopSchema,
  themeApplyInputSchema,
  themeLibraryPageSchema,
  themeLibraryQuerySchema,
  themePresetSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { ownedShop, requireAuth } from '../lib/auth';
import { notFound, param, parseBody } from '../lib/validation';
import { toShop } from '../lib/serialize';
import {
  THEME_CATEGORIES,
  buildStorefront,
  searchThemes,
  storefrontShopPatch,
  themeById,
} from '../lib/theme-library';

export const themeRoutes = new Hono<EnvShape>();

/** Public gallery listing: filters, deterministic ordering, no personal data. */
themeRoutes.get('/themes', async (c) => {
  const parsed = themeLibraryQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' }, 400);
  }
  const { themes, total } = searchThemes(parsed.data);
  return c.json(themeLibraryPageSchema.parse({ themes, total, categories: THEME_CATEGORIES }), {
    headers: { 'cache-control': 'public, max-age=60' },
  });
});

themeRoutes.get('/themes/:themeId', async (c) => {
  const preset = themeById(param(c, 'themeId'));
  if (!preset) return notFound(c, 'Theme');
  return c.json(themePresetSchema.parse(preset), {
    headers: { 'cache-control': 'public, max-age=300' },
  });
});

/** Applies (or re-applies with new copy/colours) a theme on the seller's shop. */
themeRoutes.patch('/shops/:shopId/storefront', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (shop instanceof Response) return shop;

  const input = await parseBody(c, themeApplyInputSchema);
  const preset = themeById(input.themeId);
  if (!preset) return notFound(c, 'Theme');

  const storefront = buildStorefront(
    input.themeId,
    { copy: input.copy, tokens: input.tokens },
    shop,
  );
  const db = c.get('db');
  const { data, error } = await db
    .from('shops')
    .update(storefrontShopPatch(storefront, preset))
    .eq('id', shop.id)
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Could not apply the theme' }, 500);
  return c.json(shopSchema.parse(toShop(data)));
});
