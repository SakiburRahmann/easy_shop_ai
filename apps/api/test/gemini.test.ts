import { describe, expect, it, vi } from 'vitest';
import type { ApiBindings } from '../src/lib/env';
import {
  DEFAULT_MODEL_CHAIN,
  ModelCircuits,
  classifyFailure,
  endOfPacificDayMs,
  parseBodyDelayMs,
  parseModelChain,
  parseRetryAfterMs,
  streamGeminiRound,
  type GeminiPart,
} from '../src/lib/gemini';

const BINDINGS: ApiBindings = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  GEMINI_API_KEY: 'key_test',
};

describe('parseModelChain', () => {
  it('falls back to the default chain when unset', () => {
    expect(parseModelChain(undefined, DEFAULT_MODEL_CHAIN)).toEqual([
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemma-4-26b-a4b-it',
      'gemma-4-31b-it',
    ]);
  });

  it('parses, trims and dedupes the env chain', () => {
    expect(parseModelChain(' a, b ,a,  ,c', [])).toEqual(['a', 'b', 'c']);
  });

  it('falls back when the env value has no usable entries', () => {
    expect(parseModelChain(',,', DEFAULT_MODEL_CHAIN)).toEqual([...DEFAULT_MODEL_CHAIN]);
  });

  it('caps the chain at 8 models to keep worst-case latency sane', () => {
    expect(parseModelChain('1,2,3,4,5,6,7,8,9,10', [])).toHaveLength(8);
  });
});

describe('classifyFailure', () => {
  it('sees daily quota exhaustion in Google 429 bodies', () => {
    const body =
      '{"error":{"code":429,"message":"You exceeded your current quota... * Quota exceeded for metric: ' +
      'generate_content_free_tier_requests, limit: 20... Generate content requests per day limit exceeded on ' +
      'Free Tier. Please retry in 23h29m34.766s."}}';
    const f = classifyFailure(429, body);
    expect(f.kind).toBe('rate_limit_daily');
    expect(f.retryAfterMs).toBe((23 * 3600 + 29 * 60 + 34.766) * 1000);
  });

  it('treats plain 429s as minute rate limits', () => {
    const f = classifyFailure(429, '{"error":{"message":"Rate limit reached"}}');
    expect(f.kind).toBe('rate_limit_minute');
  });

  it('parses the retryDelay quota field with s/m/h units', () => {
    expect(parseBodyDelayMs('"retryDelay": "30s"')).toBe(30_000);
    expect(parseBodyDelayMs('"retryDelay": "1m"')).toBe(60_000);
    expect(parseBodyDelayMs('"retryDelay": "1h"')).toBe(3_600_000);
    expect(parseRetryAfterMs('12')).toBe(12_000);
    expect(parseRetryAfterMs(null)).toBeNull();
  });

  it('routes 401/403 to auth, 404 and "no longer available" 400s to model_not_found', () => {
    expect(classifyFailure(401, '').kind).toBe('auth');
    expect(classifyFailure(404, '').kind).toBe('model_not_found');
    expect(
      classifyFailure(400, 'models/m is no longer available. Please update your code.').kind,
    ).toBe('model_not_found');
    expect(classifyFailure(400, 'thinkingConfig is not supported for this model').kind).toBe(
      'bad_request',
    );
  });

  it('routes 408/5xx to server', () => {
    expect(classifyFailure(500, '').kind).toBe('server');
    expect(classifyFailure(408, '').kind).toBe('server');
  });
});

describe('endOfPacificDayMs', () => {
  it('lands on Pacific midnight (PDT week: 07:00Z)', () => {
    // Oct 30 2026, 16:30Z == 09:30 Pacific → next midnight LA = Oct 31 07:00Z.
    const now = Date.parse('2026-10-30T16:30:00Z');
    expect(endOfPacificDayMs(now)).toBe(Date.parse('2026-10-31T07:00:00Z'));
  });

  it('lands on Pacific midnight (PST week: 08:00Z)', () => {
    const now = Date.parse('2026-11-05T20:00:00Z');
    expect(endOfPacificDayMs(now)).toBe(Date.parse('2026-11-06T08:00:00Z'));
  });
});

describe('ModelCircuits', () => {
  const c = new ModelCircuits();
  const minuteFailure = { kind: 'rate_limit_minute', retryAfterMs: 5_000, message: '' } as const;
  const dailyFailure = { kind: 'rate_limit_daily', retryAfterMs: 99_000, message: '' } as const;
  const now = Date.now();

  it('cools a minute-limited model for at least the requested backoff', () => {
    c.recordFailure('m1', minuteFailure, now);
    expect(c.isAvailable('m1', now + 4_999)).toBe(false);
    expect(c.isAvailable('m1', now + 31_000)).toBe(true);
  });

  it('cools a daily-exhausted model until the next Pacific midnight', () => {
    c.recordFailure('m2', dailyFailure, now);
    expect(c.isAvailable('m2', now + 10)).toBe(false);
    expect(c.isAvailable('m2', now + 3_600_000)).toBe(false);
    expect(c.isAvailable('m2', endOfPacificDayMs(now) + 1)).toBe(true);
  });

  it('closes the circuit for auth failures and bad model ids even after success', () => {
    c.recordFailure('m3', { kind: 'auth', retryAfterMs: null, message: '' }, now);
    c.recordSuccess('m3');
    expect(c.isAvailable('m3')).toBe(false);
  });

  it('leaves bad_request models usable on this isolate', () => {
    c.recordFailure('m4', { kind: 'bad_request', retryAfterMs: null, message: '' }, now);
    expect(c.isAvailable('m4')).toBe(true);
  });
});

/* ═══════════════ rotation loop (injectable fetch) ═════════════════════════ */

function sseResponse(events: Array<string | Record<string, unknown>>, status = 200): Response {
  const payload =
    events
      .map((raw) =>
        typeof raw === 'string' ? raw : `data: ${JSON.stringify({ candidates: [raw] })}`,
      )
      .join('\n\n') + '\n\n';
  return new Response(payload, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const textChunk = { content: { role: 'model', parts: [{ text: 'ok' }] } };

function fakeFetchScript(script: Array<() => Response>): {
  fetch: typeof fetch;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    urls.push(String(input));
    const step = script[urls.length - 1];
    if (!step) throw new Error('unexpected extra fetch');
    return step();
  }) as unknown as typeof fetch;
  return { fetch: fetchMock, urls };
}

describe('streamGeminiRound rotation', () => {
  const chainBindings: ApiBindings = { ...BINDINGS, GEMINI_MODELS: 'model-a,model-b,model-c' };

  it('rotates to the next model after a pre-stream 429 and succeeds', async () => {
    const circuits = new ModelCircuits();
    const { fetch: f, urls } = fakeFetchScript([
      () => sseResponse(['{"error":{"code":429,"message":"...per day limit exceeded..."}}'], 429),
      () => sseResponse(['{"error":{"code":429,"message":"Rate limit reached"}}'], 429),
      () => sseResponse([textChunk], 200),
    ]);
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      f,
      circuits,
    );
    expect(result.error).toBeUndefined();
    expect(result.text).toBe('ok');
    const served = urls.map((u) => /models\/([^:]+):/.exec(u)?.[1] ?? 'unknown');
    expect(served).toEqual(['model-a', 'model-b', 'model-c']);
    expect(urls[0]).toContain('streamGenerateContent?alt=sse');
  });

  it('rotates when a model answers 200 with neither text nor tool calls', async () => {
    const circuits = new ModelCircuits();
    const { fetch: f, urls } = fakeFetchScript([
      () => sseResponse([], 200),
      () =>
        sseResponse(
          [
            {
              content: {
                role: 'model',
                parts: [{ functionCall: { name: 'search_products', args: { query: 'x' } } }],
              },
            },
          ],
          200,
        ),
    ]);
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      f,
      circuits,
    );
    expect(result.error).toBeUndefined();
    expect(result.toolCalls).toEqual([{ name: 'search_products', args: { query: 'x' } }]);
    expect(urls).toHaveLength(2);
  });

  it('stops rotating once tokens streamed — interruption is reported, no restart', async () => {
    const circuits = new ModelCircuits();
    let calls = 0;
    const tokenThenThrow = () => {
      calls += 1;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'hél' }] } }] })}\n\n`,
            ),
          );
          setTimeout(() => controller.error(new Error('aborted')), 1);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    };
    const fetchMock = vi.fn(async () => {
      return tokenThenThrow();
    }) as unknown as typeof fetch;
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      fetchMock,
      circuits,
    );
    expect(calls).toBe(1);
    expect(result.error).toBeTruthy();
    expect(result.text).toBe('hél');
  });

  it('reports a daily-capacity message when every model hits its daily quota', async () => {
    const circuits = new ModelCircuits();
    const { fetch: f, urls } = fakeFetchScript([
      () => sseResponse(['{"error":{"code":429,"message":"...per day limit exceeded..."}}'], 429),
      () =>
        sseResponse(['{"error":{"code":429,"message":"...quota_exceeded... per day..."}}'], 429),
      () => sseResponse(['{"error":{"code":429,"message":"...requests per day..."}}'], 429),
    ]);
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      f,
      circuits,
    );
    expect(result.error).toBe(
      'The AI assistant reached its daily capacity — please try again later.',
    );
    expect(urls).toHaveLength(3);
  });

  it('skips cooled-down models entirely without contacting the provider', async () => {
    const circuits = new ModelCircuits();
    circuits.recordFailure('model-a', {
      kind: 'rate_limit_daily',
      retryAfterMs: null,
      message: '',
    });
    circuits.recordFailure('model-b', { kind: 'auth', retryAfterMs: null, message: '' });
    circuits.recordFailure('model-c', {
      kind: 'rate_limit_daily',
      retryAfterMs: null,
      message: '',
    });
    const fetchMock = vi.fn(async () => {
      throw new Error('must not be called');
    }) as unknown as typeof fetch;
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      fetchMock,
      circuits,
    );
    expect(result.error).toBe(
      'The AI assistant is cooling down — please try again in a few minutes.',
    );
  });

  it('falls through a model-specific 400 to the next model', async () => {
    const circuits = new ModelCircuits();
    const { fetch: f, urls } = fakeFetchScript([
      () =>
        sseResponse(
          ['{"error":{"code":400,"message":"tools are not supported for this model"}}'],
          400,
        ),
      () => sseResponse([textChunk], 200),
    ]);
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      {},
      f,
      circuits,
    );
    expect(result.error).toBeUndefined();
    expect(result.text).toBe('ok');
    expect(urls).toHaveLength(2);
    expect(circuits.isAvailable('model-a')).toBe(true);
  });

  it('skips 3.x thinking parts and keeps thoughtSignature for replay', async () => {
    const circuits = new ModelCircuits();
    const { fetch: f } = fakeFetchScript([
      () =>
        sseResponse(
          [
            {
              content: {
                role: 'model',
                parts: [
                  { text: 'internal reasoning', thought: true },
                  { text: 'final' },
                  { functionCall: { name: 't', args: {} }, thoughtSignature: 'sig-1' },
                ],
              },
            },
          ],
          200,
        ),
    ]);
    const tokens: string[] = [];
    const result = await streamGeminiRound(
      chainBindings,
      { systemPrompt: 's', contents: [], tools: [] },
      { onToken: (t) => tokens.push(t) },
      f,
      circuits,
    );
    expect(tokens).toEqual(['final']);
    expect(result.text).toBe('final');
    expect(result.toolCalls[0]?.name).toBe('t');
    const call: GeminiPart | undefined = result.parts[1];
    expect(call?.functionCall?.name).toBe('t');
    expect(call?.thoughtSignature).toBe('sig-1');
  });
});
