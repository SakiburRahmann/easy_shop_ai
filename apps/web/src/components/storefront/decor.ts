import type { Shop } from '@easyshop/shared';

/**
 * Curated Unsplash photography used to art-direct storefronts that have no
 * catalogue photography yet. These are decorative surfaces only — product
 * cards always render the seller's own images, never stock photos, so the
 * catalogue never implies a product that does not exist.
 *
 * Every id below was verified to resolve (HTTP 200). Sellers replace these by
 * adding their own product images; the shop's own photography always wins.
 */
const shot = (id: string, width = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

export interface DecorSet {
  hero: string;
  story: string;
  looks: readonly string[];
}

const FASHION: DecorSet = {
  hero: shot('1490481651871-ab68de25d43d', 1900),
  story: shot('1441986300917-64674bd600d8', 1200),
  looks: [
    shot('1483985988355-763728e1935b', 900),
    shot('1469334031218-e382a71b716b', 900),
    shot('1489987707025-afc232f7ea0f', 900),
  ],
};

const TECH: DecorSet = {
  hero: shot('1519389950473-47ba0277781c', 1900),
  story: shot('1498049794561-7780e7231661', 1200),
  looks: [
    shot('1526170375885-4d8ecf77b99f', 900),
    shot('1523275335684-37898b6baf30', 900),
    shot('1517336714731-489689fd1ca8', 900),
  ],
};

const HOME: DecorSet = {
  hero: shot('1524758631624-e2822e304c36', 1900),
  story: shot('1487222477894-8943e31ef7b2', 1200),
  looks: [
    shot('1538688525198-9b88f6f53126', 900),
    shot('1519710164239-da123dc03ef4', 900),
    shot('1555041469-a586c61ea9bc', 900),
  ],
};

/** Picks an editorial set for a business type; unknown types get fashion. */
export function decorFor(shop: Pick<Shop, 'businessType'>): DecorSet {
  switch (shop.businessType) {
    case 'electronics':
      return TECH;
    case 'home':
    case 'groceries':
    case 'beauty':
    case 'kids':
      return HOME;
    default:
      return FASHION;
  }
}
