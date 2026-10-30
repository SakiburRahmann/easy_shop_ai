import type { Context, Next } from 'hono';
import { notFound } from './validation';
import type { Db } from './db';
import type { EnvShape } from './env';
import { toShop } from './serialize';
import type { Shop } from '@easyshop/shared';

/**
 * Auth: sellers authenticate with a Supabase access token. The token is
 * verified against Supabase Auth on each request; tenancy is enforced by
 * looking up shops owned by the authenticated user.
 */
export async function requireAuth(c: Context<EnvShape>, next: Next) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return c.json({ error: 'Missing bearer token' }, 401);

  const db = c.get('db');
  const { data, error } = await db.auth.getUser(token);
  const user = data?.user;
  if (error || !user || !user.email) return c.json({ error: 'Invalid or expired token' }, 401);

  c.set('authUser', { id: user.id, email: user.email });
  await next();
}

/**
 * Fetches `shopId` and ensures it belongs to the authenticated owner.
 * Returns the shop on success, a Response (403/404) otherwise — call sites
 * MUST `return` the response when they see it.
 */
export async function ownedShop(c: Context<EnvShape>, shopId: string): Promise<Shop | Response> {
  const db = c.get('db');
  const authUser = c.get('authUser');
  if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

  const { data, error } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
  if (error || !data) return notFound(c, 'Shop');
  const shop = toShop(data);
  if (shop.ownerId !== authUser.id) return c.json({ error: 'You do not have access to this shop' }, 403);
  return shop;
}

export async function ownerShopIdOf(db: Db, userId: string): Promise<string | null> {
  const { data, error } = await db.from('shops').select('id').eq('owner_id', userId).limit(1).maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return typeof r.id === 'string' ? r.id : null;
}
