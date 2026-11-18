import type { Shop } from '@easyshop/shared';
import { photo, poolFor, rotate, seedHash } from '@/components/storefront/image-library';

/**
 * Curated Unsplash photography used to art-direct storefronts that have no
 * catalogue photography yet. Every id comes from the verified library in
 * `image-library.ts`, and the rotation is derived from the shop's own slug, so
 * two shops of the same trade never open on the same hero or lookbook.
 *
 * These are decorative surfaces only — product cards always render the
 * seller's own images, never stock photos, so the catalogue never implies a
 * product that does not exist.
 */
export interface DecorSet {
  hero: string;
  story: string;
  looks: readonly string[];
  /** One image per category tile, so a shop with no photos still shows tiles. */
  categories: readonly string[];
  /** Last-resort image if a CDN request fails; never leaves a broken frame. */
  fallback: string;
}

const WIDE = 1900;
const TALL = 1200;
const TILE = 1100;

/** Picks an editorial set for a business type, rotated per shop. */
export function decorFor(shop: Pick<Shop, 'businessType' | 'slug'>): DecorSet {
  const pool = poolFor(shop.businessType);
  const offset = seedHash(shop.slug || shop.businessType || 'shop');

  const heroes = rotate(pool.hero, offset);
  const looks = rotate(pool.looks, offset);
  const tiles = rotate(pool.categories, offset);
  const stories = rotate(pool.story, offset);

  return {
    hero: photo(heroes[0], WIDE),
    story: photo(stories[0], TALL),
    looks: looks.slice(0, 6).map((id) => photo(id, TALL)),
    categories: tiles.slice(0, 4).map((id) => photo(id, TILE)),
    fallback: photo(heroes[0] ?? looks[0], 800),
  };
}
