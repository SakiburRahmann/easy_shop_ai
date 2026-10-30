import { Hono } from 'hono';
import { chatRequestSchema, type ChatEvent } from '@easyshop/shared';
import type { ApiBindings, EnvShape } from '../lib/env';
import { notFound, parseBody } from '../lib/validation';
import { createDb } from '../lib/db';
import { iso, num, str, strArr, strOrNull, toShop } from '../lib/serialize';
import { buildSystemPrompt } from '../lib/system-prompt';
import { streamGeminiRound, type GeminiContent, type GeminiRoundResult } from '../lib/gemini';
import { executeTool, toolDeclarations } from '../lib/tools';
import type { AiToolContext } from '../lib/tools';

export const chatRoutes = new Hono<EnvShape>();

const MAX_TOOL_ROUNDS = 6;
const MAX_MESSAGES_PER_CONVERSATION = 100;

function sseChunk(event: ChatEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

chatRoutes.post('/chat', async (c) => {
  const bindings = c.env as ApiBindings | undefined;
  const input = await parseBody(c, chatRequestSchema);
  if (!input) return;
  const db = createDb(bindings ?? ({ SUPABASE_URL: '', SUPABASE_SECRET_KEY: '' } as ApiBindings));

  if (!bindings?.GEMINI_API_KEY) {
    return c.json({ error: 'AI assistant is not configured yet' }, 503);
  }

  const ip =
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'anonymous';
  if (!c.get('chatLimiter').hit(`chat:${ip}`)) {
    return c.json({ error: 'Too many messages, please slow down' }, 429);
  }

  // --- resolve shop + AI settings (shop comes from the slug, server-side) ---
  const { data: shopRow, error: shopError } = await db
    .from('shops')
    .select('*')
    .eq('slug', input.shopSlug)
    .maybeSingle();
  if (shopError || !shopRow) {
    void notFound(c, 'Shop');
    return;
  }
  const shop = toShop(shopRow);

  const { data: aiRow } = await db
    .from('ai_settings')
    .select('*')
    .eq('shop_id', shop.id)
    .maybeSingle();
  const ai = {
    tone: str((aiRow as Record<string, unknown> | null)?.tone ?? 'friendly', 'friendly') as
      'friendly' | 'formal' | 'playful',
    languages: (strArr((aiRow as Record<string, unknown> | null)?.languages) || [
      'bn',
      'en',
    ]) as Array<'bn' | 'en'>,
    maxDiscountPct: num((aiRow as Record<string, unknown> | null)?.max_discount_pct ?? 10) || 10,
    extraInstructions: strOrNull(
      (aiRow as Record<string, unknown> | null)?.extra_instructions ?? null,
    ),
  };

  // --- resolve conversation (verify ownership when provided) ---
  let conversationId = input.conversationId ?? '';
  const visitorId = input.visitorId ?? crypto.randomUUID();
  if (conversationId) {
    const { data: convRow } = await db
      .from('conversations')
      .select('id, shop_id')
      .eq('id', conversationId)
      .eq('shop_id', shop.id)
      .maybeSingle();
    if (!convRow) conversationId = '';
  }
  if (!conversationId) {
    const { data: created, error: createError } = await db
      .from('conversations')
      .insert({ shop_id: shop.id, visitor_id: visitorId })
      .select('id')
      .single();
    if (createError || !created) return c.json({ error: 'Failed to start conversation' }, 500);
    conversationId = str((created as Record<string, unknown>).id);
  }

  // --- per-conversation message cap ---
  const { count } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);
  if ((count ?? 0) >= MAX_MESSAGES_PER_CONVERSATION) {
    return c.json({ error: 'This conversation is full — please start a new chat' }, 429);
  }

  // --- log the customer message, load recent history ---
  await db
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'customer', content: input.message });
  const { data: historyRows } = await db
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(40);

  const history: GeminiContent[] = ((historyRows ?? []) as Record<string, unknown>[])
    .filter((m) => m.role === 'customer' || m.role === 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: str(m.content) }],
    }));

  const contents: GeminiContent[] = [
    ...history,
    { role: 'user', parts: [{ text: input.message }] },
  ];

  // --- stream setup ---
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const send = (event: ChatEvent) => writer.write(encoder.encode(sseChunk(event)));

  void (async () => {
    let messageId: string | null = null;
    let assistantText = '';
    const toolTrace: Array<{ name: string; args: unknown; decision?: unknown }> = [];
    let flagged = false;

    try {
      await send({ type: 'start', conversationId });

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        let result: GeminiRoundResult;
        try {
          result = await streamGeminiRound(
            bindings,
            {
              systemPrompt: buildSystemPrompt(shop, {
                shopId: shop.id,
                tone: ai.tone,
                languages: ai.languages,
                maxDiscountPct: ai.maxDiscountPct,
                extraInstructions: ai.extraInstructions,
                updatedAt: iso(new Date().toISOString()),
              }),
              contents,
              tools: toolDeclarations,
            },
            {
              onToken: (text) => {
                assistantText += text;
                void send({ type: 'token', text });
              },
            },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          await send({ type: 'error', message: `AI service error: ${message.slice(0, 200)}` });
          break;
        }

        if (result.error && !result.text && result.toolCalls.length === 0) {
          await send({ type: 'error', message: 'AI service is temporarily unavailable' });
          break;
        }

        if (result.toolCalls.length === 0) break;

        contents.push({
          role: 'model',
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...result.toolCalls.map((call) => ({
              functionCall: { name: call.name, args: call.args },
            })),
          ],
        });

        for (const call of result.toolCalls) {
          await send({ type: 'tool', name: call.name, status: 'running' });

          const toolContext: AiToolContext = {
            db,
            shop,
            aiSettings: {
              shopId: shop.id,
              tone: ai.tone,
              languages: ai.languages,
              maxDiscountPct: ai.maxDiscountPct,
              extraInstructions: ai.extraInstructions,
              updatedAt: iso(new Date().toISOString()),
            },
            conversationId,
            onCards: (cards) => {
              void send({ type: 'cards', cards });
            },
          };

          const outcome = await executeTool(toolContext, call.name, call.args);
          toolTrace.push({ name: call.name, args: call.args, decision: outcome });
          if (call.name === 'handoff_to_owner') flagged = true;
          await send({ type: 'tool', name: call.name, status: 'done' });

          contents.push({
            role: 'user',
            parts: [{ functionResponse: { name: call.name, response: outcome } }],
          });
        }
      }

      if (assistantText.trim()) {
        const { data: inserted } = await db
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText.slice(0, 8000),
            tool_calls: toolTrace,
          })
          .select('id')
          .single();
        if (inserted) messageId = str((inserted as Record<string, unknown>).id) || null;
        await db
          .from('conversations')
          .update({
            last_message_at: iso(new Date().toISOString()),
            ...(flagged ? { status: 'needs_owner' } : {}),
          })
          .eq('id', conversationId);
      }

      await send({ type: 'done', messageId });
    } catch (error) {
      try {
        await send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unexpected error',
        });
      } catch {
        // stream already closed
      }
    } finally {
      try {
        await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
});
