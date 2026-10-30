import type { Context, Next } from 'hono';
import { forbidden, notFound } from './validation';
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

/** Fetches `shopId` and ensures it belongs to the authenticated owner. */
export async function ownedShop(c: Context<EnvShape>, shopId: string): Promise<Shop | null> {
  const db = c.get('db');
  const authUser = c.get('authUser');
  if (!authUser || !authUser.id) {
    void forbidden(c);
    return null;
  }
  const { data, error } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
  if (error || !data) {
    void notFound(c, 'Shop');
    return null;
  }
  const shop = toShop(data);
  if (shop.ownerId !== authUser.id) {
    void forbidden(c);
    return null;
  }
  return shop;
}

export async function ownerShopIdOf(db: Db, userId: string): Promise<string | null> {
  const { data, error } = await db.from('shops').select('id').eq('owner_id', userId).maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  return typeof r.id === 'string' ? r.id : null;
}
