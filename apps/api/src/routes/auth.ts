import { Hono } from 'hono';
import {
  signUpInputSchema,
  signInInputSchema,
  sessionSchema,
  meResponseSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { parseBody } from '../lib/validation';
import { requireAuth } from '../lib/auth';
import { toShop } from '../lib/serialize';

export const authRoutes = new Hono<EnvShape>();

authRoutes.post('/auth/signup', async (c) => {
  const input = await parseBody(c, signUpInputSchema);
  const db = c.get('db');

  // Admin API creates the user immediately confirmed (no email round-trip).
  const { error: createError } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.name ? { name: input.name, role: 'seller' } : { role: 'seller' },
  });
  if (createError)
    return c.json({ error: createError.message }, createError.status === 422 ? 422 : 400);

  const { data: signInData, error: signInError } = await db.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError || !signInData.session || !signInData.user) {
    return c.json({ error: 'Account created. Please log in.' }, 500);
  }

  await db
    .from('profiles')
    .upsert({ id: signInData.user.id, email: input.email }, { ignoreDuplicates: true });

  const session = sessionSchema.parse({
    user: { id: signInData.user.id, email: String(signInData.user.email ?? input.email) },
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
  });
  return c.json(session, 201);
});

authRoutes.post('/auth/login', async (c) => {
  const input = await parseBody(c, signInInputSchema);
  const db = c.get('db');

  const { data, error } = await db.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (error || !data.session || !data.user)
    return c.json({ error: 'Invalid email or password' }, 401);

  const session = sessionSchema.parse({
    user: { id: data.user.id, email: String(data.user.email ?? input.email) },
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
  return c.json(session);
});

authRoutes.get('/auth/me', requireAuth, async (c) => {
  const authUser = c.get('authUser');
  const db = c.get('db');
  const { data: shopRow } = await db
    .from('shops')
    .select('*')
    .eq('owner_id', authUser.id)
    .limit(1)
    .maybeSingle();
  const me = meResponseSchema.parse({
    user: { id: authUser.id, email: authUser.email },
    shop: shopRow ? toShop(shopRow) : null,
  });
  return c.json(me);
});
