import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPE_PRESETS,
  STOREFRONT_TEMPLATES,
  businessTypeSchema,
  createOrderInputSchema,
  marketplaceProductQuerySchema,
  shopCreateInputSchema,
  shopThemeSchema,
  templateIdSchema,
} from '../src/index';

describe('store-builder contracts', () => {
  it('supports the three storefront templates', () => {
    expect(templateIdSchema.options).toEqual(['classic', 'modern', 'boutique']);
    expect(Object.keys(STOREFRONT_TEMPLATES)).toHaveLength(3);
  });

  it('has a complete preset for every business type', () => {
    for (const type of businessTypeSchema.options) {
      const preset = BUSINESS_TYPE_PRESETS[type];
      expect(preset.categories.length).toBeGreaterThan(0);
      expect(templateIdSchema.safeParse(preset.suggestedTemplate).success).toBe(true);
    }
  });

  it('accepts business type, template, richer theme and delivery on shop create', () => {
    const parsed = shopCreateInputSchema.parse({
      name: 'Rahman Fashion',
      businessType: 'fashion',
      templateId: 'boutique',
      theme: { primaryColor: '#059669', accentColor: '#F59E0B', font: 'serif' },
      deliveryRules: { zones: [{ name: 'Inside Dhaka', charge: 60, etaDays: 1 }] },
    });
    expect(parsed.businessType).toBe('fashion');
    expect(parsed.theme?.font).toBe('serif');
  });

  it('rejects an unknown template', () => {
    expect(templateIdSchema.safeParse('magazine').success).toBe(false);
  });

  it('drops malformed theme fields instead of failing the whole shop', () => {
    expect(shopThemeSchema.parse({ primaryColor: 'not-a-color', font: 'serif' })).toEqual({});
  });
});

describe('marketplace + delivery contracts', () => {
  it('coerces query-string numbers and applies limits', () => {
    const parsed = marketplaceProductQuerySchema.parse({
      q: 'saree',
      minPrice: '1000',
      maxPrice: '3500',
      limit: '12',
      offset: '24',
    });
    expect(parsed).toMatchObject({ minPrice: 1000, maxPrice: 3500, limit: 12, offset: 24 });
  });

  it('rejects limits above the public cap', () => {
    expect(marketplaceProductQuerySchema.safeParse({ limit: '100' }).success).toBe(false);
  });

  it('accepts a delivery zone on COD checkout', () => {
    const parsed = createOrderInputSchema.parse({
      items: [
        {
          productId: '2f5d2f8a-6a1d-4d1d-8b0a-1e2f3a4b5c6d',
          variantId: '3a5d2f8a-6a1d-4d1d-8b0a-1e2f3a4b5c6d',
          qty: 1,
        },
      ],
      customer: {
        name: 'Ayesha',
        phone: '01700000000',
        address: 'House 12, Road 3, Dhanmondi, Dhaka',
      },
      deliveryZone: 'Inside Dhaka',
    });
    expect(parsed.deliveryZone).toBe('Inside Dhaka');
  });
});
