import { Hono } from 'hono';
import {
  aiSettingsSchema,
  aiSettingsUpdateInputSchema,
  categorySchema,
  categoryInputSchema,
  conversationSchema,
  conversationUpdateInputSchema,
  messageSchema,
  shopCreateInputSchema,
  shopSchema,
  shopUpdateInputSchema,
} from '@easyshop/shared';
import type { EnvShape } from '../lib/env';
import { requireAuth, ownedShop } from '../lib/auth';
import { notFound, param, parseBody } from '../lib/validation';
import { slugify, slugVariants } from '../lib/slug';
import { iso, num, str, strArr, strOrNull, toCategory, toMessage, toShop } from '../lib/serialize';
import type { AiSettings, Category, Conversation } from '@easyshop/shared';

export const shopRoutes = new Hono<EnvShape>();

shopRoutes.post('/shops', requireAuth, async (c) => {
  const input = await parseBody(c, shopCreateInputSchema);
  if (!input) return;
  const db = c.get('db');
  const authUser = c.get('authUser');

  const base = slugify(input.name) || 'shop';
  const { data: taken, error: slugError } = await db
    .from('shops')
    .select('slug')
    .in('slug', slugVariants(base).slice(0, 50));
  if (slugError) return c.json({ error: slugError.message }, 500);
  const slugs = new Set((taken ?? []).map((r) => str((r as Record<string, unknown>).slug)));
  const slug = slugVariants(base).find((s) => !slugs.has(s));
  if (!slug)
    return c.json({ error: 'Could not allocate a shop slug, please pick another name' }, 409);

  const { data: shopRow, error: shopError } = await db
    .from('shops')
    .insert({
      owner_id: authUser.id,
      name: input.name,
      slug,
      description: input.description ?? null,
      template_id: input.templateId ?? 'classic',
      theme: input.theme ?? {},
      contact: input.contact ?? {},
      delivery_rules: input.deliveryRules ?? { zones: [] },
      policies: input.policies ?? {},
    })
    .select('*')
    .single();
  if (shopError || !shopRow)
    return c.json({ error: shopError?.message ?? 'Shop creation failed' }, 500);

  const shop = toShop(shopRow);
  await db
    .from('ai_settings')
    .upsert({ shop_id: shop.id }, { onConflict: 'shop_id', ignoreDuplicates: true });
  return c.json(shopSchema.parse(shop), 201);
});

shopRoutes.get('/shops/:shopId', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  return c.json(shopSchema.parse(shop));
});

shopRoutes.patch('/shops/:shopId', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  const input = await parseBody(c, shopUpdateInputSchema);
  if (!input) return;
  const db = c.get('db');

  const { data, error } = await db
    .from('shops')
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.templateId !== undefined ? { template_id: input.templateId } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.contact !== undefined ? { contact: input.contact } : {}),
      ...(input.deliveryRules !== undefined ? { delivery_rules: input.deliveryRules } : {}),
      ...(input.policies !== undefined ? { policies: input.policies } : {}),
    })
    .eq('id', shop.id)
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Update failed' }, 500);
  return c.json(shopSchema.parse(toShop(data)));
});

/* ------------------------------------------------------------- categories -- */

shopRoutes.post('/shops/:shopId/categories', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  const input = await parseBody(c, categoryInputSchema);
  if (!input) return;
  const db = c.get('db');
  const { data, error } = await db
    .from('categories')
    .insert({ shop_id: shop.id, name: input.name })
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Category creation failed' }, 500);
  return c.json(categorySchema.parse(toCategory(data)), 201);
});

async function categoryAndShop(c: Parameters<typeof ownedShop>[0]): Promise<Category | null> {
  const db = c.get('db');
  const { data, error } = await db
    .from('categories')
    .select('*')
    .eq('id', c.req.param('categoryId'))
    .maybeSingle();
  if (error || !data) {
    void notFound(c, 'Category');
    return null;
  }
  const category = toCategory(data);
  const shop = await ownedShop(c, category.shopId);
  if (!shop) return null;
  return category;
}

shopRoutes.patch('/categories/:categoryId', requireAuth, async (c) => {
  const category = await categoryAndShop(c);
  if (!category) return;
  const input = await parseBody(c, categoryInputSchema);
  if (!input) return;
  const db = c.get('db');
  const { data, error } = await db
    .from('categories')
    .update({ name: input.name })
    .eq('id', category.id)
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Update failed' }, 500);
  return c.json(categorySchema.parse(toCategory(data)));
});

shopRoutes.delete('/categories/:categoryId', requireAuth, async (c) => {
  const category = await categoryAndShop(c);
  if (!category) return;
  const db = c.get('db');
  const { error } = await db.from('categories').delete().eq('id', category.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

/* ------------------------------------------------------------ ai settings -- */

const DEFAULT_AI: AiSettings = {
  shopId: '',
  tone: 'friendly',
  languages: ['bn', 'en'],
  maxDiscountPct: 10,
  extraInstructions: null,
  updatedAt: iso(new Date().toISOString()),
};

async function ensureAiSettings(
  c: Parameters<typeof ownedShop>[0],
  shopId: string,
): Promise<AiSettings | null> {
  const db = c.get('db');
  await db
    .from('ai_settings')
    .upsert({ shop_id: shopId }, { onConflict: 'shop_id', ignoreDuplicates: true });
  const { data, error } = await db
    .from('ai_settings')
    .select('*')
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error || !data) return null;
  return aiSettingsSchema.parse({
    shopId,
    tone: str((data as Record<string, unknown>).tone, 'friendly'),
    languages: strArr((data as Record<string, unknown>).languages),
    maxDiscountPct: num((data as Record<string, unknown>).max_discount_pct),
    extraInstructions: strOrNull((data as Record<string, unknown>).extra_instructions),
  });
}

shopRoutes.get('/shops/:shopId/ai-settings', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  const settings = await ensureAiSettings(c, shop.id);
  if (!settings) return c.json({ error: 'Failed to load settings' }, 500);
  return c.json(settings);
});

shopRoutes.patch('/shops/:shopId/ai-settings', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  const input = await parseBody(c, aiSettingsUpdateInputSchema);
  if (!input) return;
  const db = c.get('db');
  await db
    .from('ai_settings')
    .upsert({ shop_id: shop.id }, { onConflict: 'shop_id', ignoreDuplicates: true });
  const { data, error } = await db
    .from('ai_settings')
    .update({
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.languages !== undefined ? { languages: input.languages } : {}),
      ...(input.maxDiscountPct !== undefined ? { max_discount_pct: input.maxDiscountPct } : {}),
      ...(input.extraInstructions !== undefined
        ? { extra_instructions: input.extraInstructions }
        : {}),
    })
    .eq('shop_id', shop.id)
    .select('*')
    .single();
  if (error || !data) return c.json({ error: error?.message ?? 'Update failed' }, 500);
  const settings = await ensureAiSettings(c, shop.id);
  return c.json(settings ?? DEFAULT_AI);
});

/* ---------------------------------------------------------- conversations -- */

shopRoutes.get('/shops/:shopId/conversations', requireAuth, async (c) => {
  const shop = await ownedShop(c, param(c, 'shopId'));
  if (!shop) return;
  const db = c.get('db');
  const status = c.req.query('status');

  let query = db.from('conversations').select('*').eq('shop_id', shop.id).limit(100);
  if (status && status !== 'all') query = query.eq('status', status);
  const { data: convRows, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  const convs = (convRows ?? []) as Record<string, unknown>[];
  if (!convs.length) return c.json([]);

  const ids = convs.map((r) => String(r.id));
  const { data: msgRows, error: msgError } = await db
    .from('messages')
    .select('conversation_id, content, created_at')
    .in('conversation_id', ids);
  if (msgError) return c.json({ error: msgError.message }, 500);

  const byConversation = new Map<string, { count: number; last: string | null }>();
  for (const m of (msgRows ?? []) as Record<string, unknown>[]) {
    const id = str(m.conversation_id);
    const entry = byConversation.get(id) ?? { count: 0, last: null };
    entry.count += 1;
    entry.last = str(m.content, entry.last ?? '');
    byConversation.set(id, entry);
  }

  const list: Conversation[] = convs.map((r) => {
    const stat = byConversation.get(String(r.id)) ?? { count: 0, last: null };
    return conversationSchema.parse({
      id: str(r.id),
      shopId: str(r.shop_id),
      visitorId: str(r.visitor_id),
      status: str(r.status, 'active'),
      messageCount: stat.count,
      lastMessage: stat.last ?? null,
      lastMessageAt: iso(r.last_message_at),
      createdAt: iso(r.created_at),
    });
  });
  list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return c.json(list);
});

async function conversationOwned(c: Parameters<typeof ownedShop>[0]): Promise<string | null> {
  const db = c.get('db');
  const { data, error } = await db
    .from('conversations')
    .select('shop_id')
    .eq('id', param(c, 'conversationId'))
    .maybeSingle();
  if (error || !data) {
    void notFound(c, 'Conversation');
    return null;
  }
  const shop = await ownedShop(c, str((data as Record<string, unknown>).shop_id));
  if (!shop) return null;
  return param(c, 'conversationId');
}

shopRoutes.patch('/conversations/:conversationId', requireAuth, async (c) => {
  const conversationId = await conversationOwned(c);
  if (!conversationId) return;
  const input = await parseBody(c, conversationUpdateInputSchema);
  if (!input) return;
  const db = c.get('db');
  const { error } = await db
    .from('conversations')
    .update({ status: input.status })
    .eq('id', conversationId);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

shopRoutes.get('/conversations/:conversationId/messages', requireAuth, async (c) => {
  const conversationId = await conversationOwned(c);
  if (!conversationId) return;
  const db = c.get('db');
  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return c.json({ error: error.message }, 500);
  const messages = (data ?? []).map((m) => messageSchema.parse(toMessage(m)));
  return c.json(messages);
});
