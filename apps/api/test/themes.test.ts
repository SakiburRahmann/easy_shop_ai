import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { themeLibraryPageSchema, themePresetSchema, type Shop } from '@easyshop/shared';
import {
  THEME_CATEGORIES,
  THEME_LIBRARY,
  buildStorefront,
  contrast,
  normalizeSections,
  presetFromRecord,
  readableTokens,
  searchThemes,
  storefrontShopPatch,
  themeById,
} from '../src/lib/theme-library';
import { themeRoutes } from '../src/routes/themes';
import type { Db } from '../src/lib/db';
import type { EnvShape } from '../src/lib/env';

const ownerId = '10e8cee7-0000-4000-8000-000000000000';
const shopId = '10e8cee7-0000-4000-8000-000000000001';

const shopRow = {
  id: shopId,
  owner_id: ownerId,
  name: 'Dhaka Threads',
  slug: 'dhaka-threads',
  description: 'Hand-printed cotton sarees',
  logo_url: null,
  business_type: 'fashion',
  template_id: 'modern',
  theme: {},
  contact: {},
  delivery_rules: { zones: [] },
  policies: {},
  storefront: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const shop = {
  id: shopId,
  ownerId,
  name: 'Dhaka Threads',
  slug: 'dhaka-threads',
  businessType: 'fashion',
  description: 'Hand-printed cotton sarees',
  logoUrl: null,
  templateId: 'modern',
  theme: {},
  contact: {},
  deliveryRules: { zones: [] },
  policies: {},
  storefront: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Shop;

describe('theme library', () => {
  it('ships hundreds of presets with unique ids and valid documents', () => {
    expect(THEME_LIBRARY.length).toBeGreaterThan(150);
    const ids = new Set(THEME_LIBRARY.map((preset) => preset.id));
    expect(ids.size).toBe(THEME_LIBRARY.length);
    for (const preset of THEME_LIBRARY.slice(0, 40)) {
      expect(themePresetSchema.safeParse(preset).success).toBe(true);
      expect(preset.layout.sections).toContain('catalog');
    }
  });

  it('lists curated house themes first', () => {
    expect(THEME_LIBRARY.slice(0, 3).every((preset) => preset.curated)).toBe(true);
    expect(THEME_LIBRARY.filter((preset) => preset.curated)).toHaveLength(3);
  });

  it('derives presets deterministically from catalogue records', () => {
    const record = {
      id: 'demo',
      name: 'Demo',
      category: 'fashion',
      ourType: 'fashion',
      stack: 'bootstrap',
      style: ['dark', 'fullbleed-hero', 'cards'] as const,
      palette: ['#c2185b', '#ffb300'] as const,
      source: 'test',
    };
    const first = presetFromRecord(record);
    const second = presetFromRecord(record);
    expect(first).toEqual(second);
    expect(first.layout.header).toBe('overlay');
    expect(first.layout.hero).toBe('collage');
    expect(first.tokens.surface).toBe('#0d0e10');
    expect(first.tokens.ink).toBe('#f5f5f4');
    // Dark surface needs a light button or a readable primary.
    expect(first.tokens.primary).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('never emits a section the chosen hero cannot render', () => {
    for (const preset of THEME_LIBRARY) {
      if (preset.layout.hero !== 'collage') {
        expect(preset.layout.sections).not.toContain('categoryCollage');
      }
      if (preset.layout.hero !== 'editorial') {
        expect(preset.layout.sections).not.toContain('categoryIndex');
      }
      expect(preset.layout.sections.filter((id) => id === 'catalog')).toHaveLength(1);
    }
  });

  it('keeps a stable, filterable gallery order', () => {
    const page = searchThemes({ businessType: 'fashion', limit: 12 });
    expect(page.themes.length).toBeLessThanOrEqual(12);
    // Curated themes are always offered, plus every fashion preset.
    expect(page.total).toBeGreaterThanOrEqual(6);
    expect(page.total).toBeGreaterThanOrEqual(page.themes.length);
    expect(page.themes[0]?.curated).toBe(true);
    expect(searchThemes({ businessType: 'fashion', limit: 12 }).themes.map((t) => t.id)).toEqual(
      page.themes.map((t) => t.id),
    );

    const fashionOnly = searchThemes({ category: 'fashion', limit: 50 });
    expect(fashionOnly.themes.every((preset) => preset.category === 'fashion')).toBe(true);

    const searched = searchThemes({ q: 'editorial', limit: 50 });
    expect(searched.themes.length).toBeGreaterThan(0);

    const second = searchThemes({ limit: 5, offset: 5 });
    expect(second.themes[0]?.id).not.toBe(searchThemes({ limit: 5 }).themes[0]?.id);
    expect(THEME_CATEGORIES).toContain('house');
  });
});

describe('applying a theme', () => {
  it('builds a storefront from preset defaults and the shop’s own words', () => {
    const preset = themeById('house-classic')!;
    const storefront = buildStorefront('house-classic', {}, shop, '2026-02-02T00:00:00.000Z');

    expect(storefront.themeId).toBe(preset.id);
    expect(storefront.layout.sections).toEqual(preset.layout.sections);
    expect(storefront.copy.headline).toBe('Hand-printed cotton sarees');
    expect(storefront.copy.ctaLabel).toBe(preset.ctaLabel);
    expect(storefront.appliedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('honours seller copy and colour overrides, and strips markup', () => {
    const storefront = buildStorefront(
      'house-boutique',
      {
        copy: {
          headline: '<script>alert(1)</script>Eid collection',
          ctaLabel: 'Shop Eid',
          announcement: 'Free delivery inside Dhaka',
        },
        tokens: { primary: '#0f766e', accent: '#f97316' },
      },
      shop,
    );

    expect(storefront.copy.headline).toBe('alert(1) Eid collection');
    expect(storefront.copy.ctaLabel).toBe('Shop Eid');
    expect(storefront.copy.announcement).toBe('Free delivery inside Dhaka');
    expect(storefront.tokens.primary).toBe('#0f766e');
    expect(storefront.tokens.accent).toBe('#f97316');
  });

  it('falls back to the house preset for an unknown theme id', () => {
    const storefront = buildStorefront('does-not-exist', {}, shop);
    expect(storefront.themeId.startsWith('house-')).toBe(true);
  });

  it('repairs unreadable colour combinations instead of publishing them', () => {
    const tokens = readableTokens(
      { surface: '#eeeeee', ink: '#f0f0f0', muted: '#f1f1f1', primary: '#efefef' },
      themeById('house-modern')!.tokens,
    );
    expect(contrast(tokens.ink, tokens.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.muted, tokens.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens.primary, '#ffffff')).toBeGreaterThanOrEqual(2.5);
  });

  it('keeps catalog exactly once and drops impossible blocks', () => {
    expect(normalizeSections(['intro', 'trust'], 'browse', ['intro', 'catalog', 'trust'])).toEqual([
      'intro',
      'catalog',
      'trust',
    ]);
    expect(
      normalizeSections(['categoryCollage', 'catalog'], 'browse', ['hero', 'catalog', 'trust']),
    ).not.toContain('categoryCollage');
  });

  it('syncs the marketplace template/theme columns', () => {
    const preset = themeById('house-modern')!;
    const patch = storefrontShopPatch(buildStorefront(preset.id, {}, shop), preset);
    expect(patch.template_id).toBe('modern');
    expect(patch.theme.primaryColor).toBe(patch.storefront.tokens.primary);
    expect(patch.storefront.themeId).toBe(preset.id);
  });
});

describe('theme routes', () => {
  const db = {
    auth: {
      getUser: async () => ({
        data: { user: { id: ownerId, email: 'owner@example.com' } },
        error: null,
      }),
    },
    from(table: string) {
      if (table !== 'shops') throw new Error(`Unexpected table in test: ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: shopRow, error: null }) }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: shopRow, error: null }),
            }),
          }),
        }),
      };
    },
  } as unknown as Db;

  function testApp() {
    const app = new Hono<EnvShape>();
    app.use('*', async (c, next) => {
      c.set('db', db);
      c.set('authUser', { id: ownerId, email: 'owner@example.com' });
      await next();
    });
    app.route('/', themeRoutes);
    return app;
  }

  it('serves the gallery with the shape the dashboard parses', async () => {
    const res = await testApp().request('/themes?businessType=fashion&limit=6');
    expect(res.status).toBe(200);
    const parsed = themeLibraryPageSchema.parse(await res.json());
    expect(parsed.themes.length).toBe(6);
    expect(parsed.total).toBeGreaterThan(6);
    expect(parsed.categories.length).toBeGreaterThan(3);
  });

  it('serves one theme and 404s an unknown id', async () => {
    const ok = await testApp().request('/themes/house-classic');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { id: string }).id).toBe('house-classic');

    const missing = await testApp().request('/themes/nope');
    expect(missing.status).toBe(404);
  });

  it('applies a theme to the owner’s shop', async () => {
    const res = await testApp().request(`/shops/${shopId}/storefront`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({
        themeId: 'house-boutique',
        copy: { headline: 'Sarees for every occasion' },
        tokens: { primary: '#0f766e' },
      }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: shopId });
  });

  it('rejects an unknown theme id and an invalid body', async () => {
    const unknown = await testApp().request(`/shops/${shopId}/storefront`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 'not-a-theme' }),
    });
    expect(unknown.status).toBe(404);

    const invalid = await testApp().request(`/shops/${shopId}/storefront`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ themeId: 42 }),
    });
    expect(invalid.status).toBe(400);
  });
});
