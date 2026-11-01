import { describe, expect, it } from 'vitest';
import {
  productAvailableStock,
  productSoldOut,
  type ProductPublic,
  type Variant,
} from '../src/index';

function variant(stock: number, id = `v-${stock}`): Variant {
  return {
    id,
    productId: 'p1',
    size: null,
    color: null,
    stock,
    priceOverride: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function product(overrides: Partial<ProductPublic> & { variants: Variant[] }): ProductPublic {
  return {
    id: 'p1',
    categoryId: null,
    name: 'Test product',
    description: null,
    price: 500,
    stock: 0,
    images: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('productAvailableStock', () => {
  it('uses product stock when the product has no variants', () => {
    expect(productAvailableStock(product({ stock: 7, variants: [] }))).toBe(7);
  });

  it('sums variant stock when variants exist (product stock is ignored)', () => {
    expect(
      productAvailableStock(
        product({ stock: 999, variants: [variant(3, 'a'), variant(4, 'b'), variant(0, 'c')] }),
      ),
    ).toBe(7);
  });
});

describe('productSoldOut', () => {
  it('is true when a variantless product has no stock', () => {
    expect(productSoldOut(product({ stock: 0, variants: [] }))).toBe(true);
  });

  it('is false when a variantless product has stock', () => {
    expect(productSoldOut(product({ stock: 1, variants: [] }))).toBe(false);
  });

  it('is true only when every variant is out of stock', () => {
    expect(productSoldOut(product({ variants: [variant(0, 'a'), variant(2, 'b')] }))).toBe(false);
    expect(productSoldOut(product({ variants: [variant(0, 'a'), variant(0, 'b')] }))).toBe(true);
  });
});
