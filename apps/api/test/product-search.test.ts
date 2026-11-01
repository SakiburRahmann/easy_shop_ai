import { describe, expect, it } from 'vitest';
import {
  canonicalPhrase,
  filterProductRows,
  textTokens,
  type ProductSearchRow,
} from '../src/lib/product-search';

function product(overrides: Partial<Record<string, unknown>> & { name: string }): ProductSearchRow {
  const { name, ...rest } = overrides;
  return {
    id: name,
    name,
    description: '',
    price: 500,
    category_id: 'cat-tees',
    variants: [],
    ...rest,
  };
}

const redTee = product({
  name: 'Red Cotton T-Shirt',
  description: '100% cotton mid-weight tee',
  price: 650,
  category_id: 'cat-tees',
  variants: [
    { size: 'S', color: 'Red', stock: 10, price_override: null },
    { size: 'M', color: 'Red', stock: 8, price_override: null },
  ],
});

const blackTee = product({
  name: 'Black Oversized T-Shirt',
  price: 750,
  category_id: 'cat-tees',
  variants: [{ size: 'M', color: 'Black', stock: 5, price_override: null }],
});

const premiumRed = product({
  name: 'Red Premium Tee',
  price: 1200,
  category_id: 'cat-tees',
  variants: [{ size: 'L', color: 'Red', stock: 2, price_override: 700 }],
});

const saree = product({
  name: 'Jamdani Saree',
  description: 'Handwoven jamdani in merlot',
  price: 3500,
  category_id: 'cat-sarees',
  variants: [{ size: null, color: 'Merlot', stock: 4, price_override: null }],
});

const rows = [redTee, blackTee, premiumRed, saree];

const baseFilters = {
  tokens: [] as string[],
  categoryIds: null as string[] | null,
  color: '',
  size: '',
  maxPrice: undefined as number | undefined,
};

describe('textTokens / canonicalPhrase', () => {
  it('normalizes Banglish and drops price/filler words', () => {
    expect(textTokens('lal t-shirt 1000 takar moddhe')).toEqual(['red', 't-shirt']);
  });

  it('maps Bangla color words to English', () => {
    expect(canonicalPhrase('লাল cotton')).toBe('red cotton');
    expect(canonicalPhrase('কালো')).toBe('black');
  });
});

describe('filterProductRows', () => {
  it('applies color AND max price together (regression)', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      color: 'red',
      maxPrice: 660,
    });
    expect(matched.map((row) => row.name)).toEqual(['Red Cotton T-Shirt']);
  });

  it('respects a tighter budget even when the color matches', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      color: 'red',
      maxPrice: 500,
    });
    expect(matched).toHaveLength(0);
  });

  it('applies size and max price together', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      size: 'm',
      maxPrice: 700,
    });
    expect(matched.map((row) => row.name)).toEqual(['Red Cotton T-Shirt']);
  });

  it('uses variant price overrides when checking the budget', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      color: 'red',
      maxPrice: 800,
    });
    expect(matched.map((row) => row.name)).toEqual(['Red Cotton T-Shirt', 'Red Premium Tee']);
  });

  it('accepts a Bangla color phrase from the model', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      color: canonicalPhrase('লাল'),
      maxPrice: 660,
    });
    expect(matched.map((row) => row.name)).toEqual(['Red Cotton T-Shirt']);
  });

  it('filters by category id', () => {
    const { matched } = filterProductRows(rows, {
      ...baseFilters,
      categoryIds: ['cat-sarees'],
    });
    expect(matched.map((row) => row.name)).toEqual(['Jamdani Saree']);
  });

  it('falls back to name/description when attributes do not match', () => {
    const result = filterProductRows(rows, {
      ...baseFilters,
      tokens: textTokens('saree'),
      color: 'blue',
    });
    expect(result.matched.map((row) => row.name)).toEqual(['Jamdani Saree']);
    expect(result.note).toContain('No exact color/size match');
  });

  it('returns the newest products when the model gives no filters', () => {
    const result = filterProductRows(rows, baseFilters);
    expect(result.matched).toHaveLength(4);
    expect(result.note).toContain('newest products');
  });
});
