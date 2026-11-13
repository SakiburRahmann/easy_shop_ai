import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { shopRoutes } from '../src/routes/shops';
import type { Db } from '../src/lib/db';
import type { EnvShape } from '../src/lib/env';

const ownerId = '10e8cee7-0000-4000-8000-000000000000';
const shopId = '10e8cee7-0000-4000-8000-000000000001';

const shopRow = {
  id: shopId,
  owner_id: ownerId,
  name: 'Test Shop',
  slug: 'test-shop',
  description: null,
  logo_url: null,
  business_type: 'fashion',
  template_id: 'classic',
  theme: {},
  contact: {},
  delivery_rules: { zones: [] },
  policies: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const aiRow = {
  shop_id: shopId,
  tone: 'friendly',
  languages: ['bn', 'en'],
  max_discount_pct: 10,
  extra_instructions: null,
  updated_at: '2026-01-02T03:04:05.000Z',
};

const db = {
  auth: {
    getUser: async () => ({
      data: { user: { id: ownerId, email: 'owner@example.com' } },
      error: null,
    }),
  },
  from(table: string) {
    if (table === 'shops') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: shopRow, error: null }),
          }),
        }),
      };
    }
    if (table === 'ai_settings') {
      return {
        upsert: async () => ({ data: null, error: null }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: aiRow, error: null }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: aiRow, error: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  },
} as unknown as Db;

function testApp() {
  const app = new Hono<EnvShape>();
  app.use('*', async (c, next) => {
    c.set('db', db);
    c.set('authUser', { id: ownerId, email: 'owner@example.com' });
    await next();
  });
  app.route('/', shopRoutes);
  return app;
}

describe('GET /shops/:shopId/ai-settings', () => {
  it('returns initialized settings including the required updatedAt field', async () => {
    const res = await testApp().request(`/shops/${shopId}/ai-settings`, {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      shopId,
      tone: 'friendly',
      languages: ['bn', 'en'],
      maxDiscountPct: 10,
      updatedAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('saves settings through the same validated contract', async () => {
    const res = await testApp().request(`/shops/${shopId}/ai-settings`, {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tone: 'playful', languages: ['en'], maxDiscountPct: 20 }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ shopId });
  });
});
