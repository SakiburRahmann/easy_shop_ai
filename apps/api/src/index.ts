/**
 * EasyShopAI API — the single REST backend (Hono on Cloudflare Workers).
 * Everything web, mobile and storefront clients need flows through here.
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { userRoleSchema } from '@easyshop/shared';
import type { ApiBindings, EnvShape } from './lib/env';
import { createDb } from './lib/db';
import { createRateLimiter } from './lib/rate-limit';
import { authRoutes } from './routes/auth';
import { shopRoutes } from './routes/shops';
import { catalogRoutes } from './routes/catalog';
import { orderRoutes } from './routes/orders';
import { storefrontRoutes } from './routes/storefront';
import { marketplaceRoutes } from './routes/marketplace';
import { chatRoutes } from './routes/chat';
import { themeRoutes } from './routes/themes';

export function createApp(): Hono<EnvShape> {
  const app = new Hono<EnvShape>();

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const bindings = c.env as ApiBindings | undefined;
        if (!bindings) return origin ?? '*';
        const allowed = (bindings.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
        if (allowed.includes('*')) return origin ?? '*';
        if (origin && allowed.includes(origin)) return origin;
        return null;
      },
      allowHeaders: ['content-type', 'authorization'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
    }),
  );

  // Per-request services.
  app.use('*', async (c, next) => {
    const bindings = c.env as ApiBindings | undefined;
    if (bindings) {
      c.set('db', createDb(bindings));
      const perMin = Math.max(1, Number(bindings.CHAT_RATE_LIMIT_PER_MIN ?? '20') || 20);
      c.set('chatLimiter', createRateLimiter(perMin));
    }
    await next();
  });

  app.get('/', (c) => c.json({ service: 'easyshop-api', status: 'ok' }));
  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/roles', (c) => c.json({ roles: userRoleSchema.options }));

  app.route('/', authRoutes);
  app.route('/', shopRoutes);
  app.route('/', catalogRoutes);
  app.route('/', orderRoutes);
  app.route('/', storefrontRoutes);
  app.route('/', marketplaceRoutes);
  app.route('/', chatRoutes);
  app.route('/', themeRoutes);

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error('Unhandled API error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  return app;
}

export default createApp();
export type AppType = ReturnType<typeof createApp>;
export type { ApiBindings };
