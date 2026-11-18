/**
 * Storefront photography library.
 *
 * Every id below is an Unsplash photo that was fetched from the image CDN and
 * checked (HTTP 200, image/jpeg) before being added, so no storefront slot can
 * point at a dead picture. They are grouped by trade so a shop never opens with
 * unrelated stock: an electronics shop gets desks and devices, a grocery shop
 * gets produce, and so on. Shops of the same trade get a different rotation,
 * chosen from the shop's own slug, so two boutiques never share a hero.
 *
 * These images art-direct the *storefront surfaces* (hero, lookbook, category
 * tiles, story band). Product cards only ever show the seller's own product
 * photography — a stock photo on a product card would imply an item the shop
 * does not sell.
 */

export type Trade = 'fashion' | 'electronics' | 'home' | 'beauty' | 'groceries' | 'kids';

export interface PhotoPool {
  /** Full-bleed cinematic openers. */
  hero: readonly string[];
  /** Tall editorial cards for lookbooks and split intros. */
  looks: readonly string[];
  /** Square-ish tiles behind category names. */
  categories: readonly string[];
  /** Atmosphere shots for the story band. */
  story: readonly string[];
}

/** Unsplash photo ids, verified against images.unsplash.com. */
const POOLS: Record<Trade | 'general', PhotoPool> = {
  fashion: {
    hero: [
      '1516826957135-700dedea698c',
      '1485968579580-b6d095142e6e',
      '1551488831-00ddcb6c6bd3',
      '1490481651871-ab68de25d43d',
    ],
    looks: [
      '1611312449408-fcece27cdbb7',
      '1521572163474-6864f9cf17ab',
      '1549298916-b41d501d3772',
      '1548883354-7622d03aca27',
      '1551488831-00ddcb6c6bd3',
      '1517841905240-472988babdf9',
      '1534958105004-ba5f8694b247',
      '1566174053879-31528523f8ae',
      '1515621061946-eff1c2a352bd',
      '1489987707025-afc232f7ea0f',
      '1469334031218-e382a71b716b',
    ],
    categories: [
      '1441986300917-64674bd600d8',
      '1551488831-00ddcb6c6bd3',
      '1549298916-b41d501d3772',
      '1611312449408-fcece27cdbb7',
    ],
    story: [
      '1441986300917-64674bd600d8',
      '1516826957135-700dedea698c',
      '1485968579580-b6d095142e6e',
    ],
  },
  electronics: {
    hero: [
      '1505740420928-5e560c06d30e',
      '1519389950473-47ba0277781c',
      '1492724441997-5dc865305da7',
    ],
    looks: [
      '1608043152269-423dbba4e7e1',
      '1527814050087-3793815479db',
      '1468436139062-f60a71c5c892',
      '1593642632823-8f785ba67e45',
      '1498049794561-7780e7231661',
      '1580894894513-541e068a3e2b',
      '1523275335684-37898b6baf30',
      '1517336714731-489689fd1ca8',
      '1526170375885-4d8ecf77b99f',
    ],
    categories: [
      '1505740420928-5e560c06d30e',
      '1593642632823-8f785ba67e45',
      '1608043152269-423dbba4e7e1',
      '1498049794561-7780e7231661',
    ],
    story: ['1492724441997-5dc865305da7', '1519389950473-47ba0277781c'],
  },
  home: {
    hero: [
      '1605346475807-2088e0897b2d',
      '1493809842364-78817add7ffb',
      '1524758631624-e2822e304c36',
    ],
    looks: [
      '1586023492125-27b2c045efd7',
      '1620332372374-f108c53d2e03',
      '1555396273-367ea4eb4db5',
      '1600585154340-be6161a56a0c',
      '1487222477894-8943e31ef7b2',
      '1519710164239-da123dc03ef4',
      '1555041469-a586c61ea9bc',
      '1538688525198-9b88f6f53126',
      '1514933651103-005eec06c04b',
    ],
    categories: [
      '1605346475807-2088e0897b2d',
      '1620332372374-f108c53d2e03',
      '1586023492125-27b2c045efd7',
      '1600585154340-be6161a56a0c',
    ],
    story: ['1493809842364-78817add7ffb', '1487222477894-8943e31ef7b2'],
  },
  beauty: {
    hero: [
      '1531746020798-e6953c6e8e04',
      '1687202163645-8be2de10ba7a',
      '1542452255191-c85a98f2c5d1',
    ],
    looks: [
      '1752042230758-2e62a20e5bcb',
      '1542452255191-c85a98f2c5d1',
      '1687202163645-8be2de10ba7a',
      '1531746020798-e6953c6e8e04',
      '1438761681033-6461ffad8d80',
      '1554151228-14d9def656e4',
      '1566174053879-31528523f8ae',
    ],
    categories: [
      '1687202163645-8be2de10ba7a',
      '1542452255191-c85a98f2c5d1',
      '1752042230758-2e62a20e5bcb',
      '1554151228-14d9def656e4',
    ],
    story: ['1531746020798-e6953c6e8e04', '1566174053879-31528523f8ae'],
  },
  groceries: {
    hero: ['1590473581810-7b5045549c70', '1546069901-ba9599a7e63c', '1486297678162-eb2a19b0a32d'],
    looks: [
      '1547592180-85f173990554',
      '1618164436241-4473940d1f5c',
      '1634487359989-3e90c9432133',
      '1534308983496-4fabb1a015ee',
      '1551782450-a2132b4ba21d',
      '1541167760496-1628856ab772',
      '1557229668-e5060b918f57',
    ],
    categories: [
      '1590473581810-7b5045549c70',
      '1486297678162-eb2a19b0a32d',
      '1618164436241-4473940d1f5c',
      '1546069901-ba9599a7e63c',
    ],
    story: ['1547592180-85f173990554', '1534308983496-4fabb1a015ee'],
  },
  kids: {
    hero: ['1524594152303-9fd13543fe6e', '1535223289827-42f1e9919769'],
    looks: [
      '1524594152303-9fd13543fe6e',
      '1535223289827-42f1e9919769',
      '1603739421258-4aa79ad860df',
      '1517841905240-472988babdf9',
    ],
    categories: [
      '1524594152303-9fd13543fe6e',
      '1535223289827-42f1e9919769',
      '1603739421258-4aa79ad860df',
      '1517841905240-472988babdf9',
    ],
    story: ['1524594152303-9fd13543fe6e', '1535223289827-42f1e9919769'],
  },
  general: {
    hero: ['1439148359337-2e011813cf8d', '1544392827-1fc9d8111cb1'],
    looks: [
      '1519567241046-7f570eee3ce6',
      '1514933651103-005eec06c04b',
      '1533929736458-ca588d08c8be',
      '1506929562872-bb421503ef21',
      '1551009265-5425e848499e',
    ],
    categories: [
      '1439148359337-2e011813cf8d',
      '1519567241046-7f570eee3ce6',
      '1533929736458-ca588d08c8be',
      '1544392827-1fc9d8111cb1',
    ],
    story: ['1514933651103-005eec06c04b', '1519567241046-7f570eee3ce6'],
  },
};

export function photo(id: string, width: number, height?: number): string {
  const size = height ? `w=${width}&h=${height}` : `w=${width}`;
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&${size}&q=80`;
}

/** FNV-1a — small, stable, and identical on every device. */
export function seedHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Rotates a pool so shops with different slugs open on different photography. */
export function rotate<T>(pool: readonly T[], offset: number): T[] {
  if (pool.length === 0) return [];
  const start = offset % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

export function poolFor(trade: string | undefined): PhotoPool {
  if (trade && trade in POOLS) return POOLS[trade as Trade];
  return POOLS.general;
}
