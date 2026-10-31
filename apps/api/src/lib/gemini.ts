/**
 * Model-rotation Gemini client over the REST API (streaming, function
 * calling). Implemented with plain fetch so it runs on Workers without
 * SDK/AI-flag issues, and stays injectable for tests.
 *
 * ── Model rotation (rate-limit resilience) ───────────────────────────────
 * Ported from the AI Education Platform's quota-first router, adapted to this
 * project's raw-REST round loop and single-key setup:
 *
 *  1. The chain is QUOTA-FIRST. Each free-tier model has its own pool, so the
 *     lite tiers (large pools) carry the traffic and gemma models are
 *     reserves:
 *       gemini-3.5-flash-lite  primary; thinks; large pool
 *       gemini-3.1-flash-lite  second separate pool
 *       gemma-4-26b-a4b-it     largest pool, cannot think — reserve
 *       gemma-4-31b-it         measured 40-50s to first token in the sibling
 *                              project — LAST resort
 *     Override with GEMINI_MODELS (comma separated). GEMINI_MODEL (single)
 *     still works as a one-model chain.
 *  2. Rotation happens at the ROUND level inside `streamGeminiRound`: a model
 *     that fails BEFORE emitting anything (429 minute, 429 daily, 5xx,
 *     404/400 model complaints, network) transparently hands the request to
 *     the next model — never retried in place (the chain IS the retry
 *     mechanism, like the sibling router). Failures AFTER tokens streamed
 *     cannot restart cleanly and are reported as errors.
 *  3. Circuits: per-model cooldowns in isolate memory. Minute-limits cool
 *     with full-jitter backoff (honoring Retry-After), daily quotas cool
 *     until Pacific midnight (Google's free-tier reset), auth failures and
 *     unknown model ids disable the model for this isolate. NOT
 *     cross-isolate persisted — the sibling's Supabase pair-state is out of
 *     MVP scope; the worst case is one wasted probe per isolate restart.
 */
import { type ApiBindings } from './env';

export interface GeminiPart {
  text?: string;
  /** 3.x models mark internal thinking parts; they are not shown or replayed. */
  thought?: boolean;
  /** Required by 3.x models when replaying function-call turns. */
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, GeminiSchemaProperty>;
    required?: string[];
  };
}

export interface GeminiSchemaProperty {
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'ARRAY' | 'OBJECT';
  description: string;
  items?: GeminiSchemaProperty;
  properties?: Record<string, GeminiSchemaProperty>;
  required?: string[];
}

export interface GeminiRequest {
  systemPrompt: string;
  contents: GeminiContent[];
  tools: GeminiToolDeclaration[];
  maxOutputTokens?: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiRoundResult {
  text: string;
  toolCalls: ToolCall[];
  /**
   * The model's parts for THIS round, preserved verbatim (minus thought
   * parts) so the next round can replay them with the required
   * thoughtSignature fields intact.
   */
  parts: GeminiPart[];
  error?: string;
}

export interface StreamHandlers {
  onToken?: (text: string) => void;
}

/* ═══════════════════════════════════════════════════════ model chain ════ */

/** Quota-first default chain — see the module header comment. */
export const DEFAULT_MODEL_CHAIN: readonly string[] = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
];

/** Parses a comma-separated chain from env; empty/invalid entries collapse. */
export function parseModelChain(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw) return [...fallback];
  const parsed = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
  return parsed.length > 0 ? parsed : [...fallback];
}

/** The rated model chain for this worker. */
export function geminiModelChain(env: ApiBindings): string[] {
  return parseModelChain(
    env.GEMINI_MODELS,
    env.GEMINI_MODEL ? [env.GEMINI_MODEL] : DEFAULT_MODEL_CHAIN,
  );
}

/* ════════════════════════════════════════════════════════ circuits ════ */

export type ErrorKind =
  | 'rate_limit_minute' // per-minute RPM/TPM exhausted → short cooldown
  | 'rate_limit_daily' // daily quota exhausted → cool until Pacific midnight
  | 'auth' // 401/403: invalid key → nothing will ever work
  | 'model_not_found' // bad model id → disable the model
  | 'bad_request' // request rejected for this model → next model
  | 'server' // 408/5xx transient → next model
  | 'network' // connection errors → next model
  | 'unknown';

export interface ClassifiedFailure {
  kind: ErrorKind;
  status?: number;
  retryAfterMs: number | null;
  message: string;
}

/** RFC 9110 Retry-After: delta-seconds or HTTP-date; null when absent. */
export function parseRetryAfterMs(headerValue?: string | null): number | null {
  if (!headerValue) return null;
  const raw = headerValue.trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Number(raw) * 1000);
  const date = Date.parse(raw);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/**
 * Parses Google's delay style found in 429 bodies — the quota detail field
 * (`"retryDelay": "30s" | "1m" | "23h29m34.76s"`) or free text ("Please retry
 * in 23h29m34.76s"). Returns ms or null.
 */
export function parseBodyDelayMs(body: string): number | null {
  const field = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)(s|m|h)"/i.exec(body);
  if (field) {
    const n = Number(field[1]);
    const unit = (field[2] ?? 's').toLowerCase();
    if (Number.isFinite(n))
      return Math.round(n * (unit === 'h' ? 3_600_000 : unit === 'm' ? 60_000 : 1_000));
  }
  const free = /\b(\d+)h(\d+)?m?((?:\d|\.)+)?s?\b/.exec(body);
  if (free) {
    const h = Number(free[1]);
    const m = Number(free[2] ?? 0);
    const s = Number(free[3] ?? 0);
    return (h * 3600 + m * 60 + s) * 1000;
  }
  return null;
}

/**
 * Classifies a provider failure so the router decides: back off, how long,
 * and whether to disable the model (port of the sibling project's
 * errors.ts/classifyError, shaped for raw REST responses).
 */
export function classifyFailure(
  status: number | undefined,
  body: string,
  retryAfterHeader?: string | null,
): ClassifiedFailure {
  const bodyLower = body.toLowerCase();
  const after = parseRetryAfterMs(retryAfterHeader) ?? parseBodyDelayMs(body);

  if (status === 429) {
    const daily =
      bodyLower.includes('quota_exceeded') ||
      bodyLower.includes('daily_quota') ||
      bodyLower.includes('daily quota') ||
      bodyLower.includes('per-day') ||
      bodyLower.includes('per day') ||
      bodyLower.includes('requests per day') ||
      bodyLower.includes('quota exhausted') ||
      (bodyLower.includes('resource_exhausted') && bodyLower.includes('day'));
    return {
      kind: daily ? 'rate_limit_daily' : 'rate_limit_minute',
      status,
      retryAfterMs: after,
      message: daily ? 'Daily quota reached for this model.' : 'Rate limit reached for this model.',
    };
  }
  if (status === 401 || status === 403) {
    return { kind: 'auth', status, retryAfterMs: after, message: 'The API key was rejected.' };
  }
  if (status === 404) {
    return {
      kind: 'model_not_found',
      status,
      retryAfterMs: after,
      message: 'Model id is unavailable.',
    };
  }
  if (status === 400) {
    // "no longer available to new users" style 400s behave like model-not-found.
    const notAvailable =
      bodyLower.includes('model') &&
      (bodyLower.includes('not found') ||
        bodyLower.includes('does not exist') ||
        bodyLower.includes('no longer available'));
    return notAvailable
      ? {
          kind: 'model_not_found',
          status,
          retryAfterMs: after,
          message: 'Model id is unavailable.',
        }
      : {
          kind: 'bad_request',
          status,
          retryAfterMs: after,
          message: 'Request rejected by the provider.',
        };
  }
  if (status === 408 || (status !== undefined && status >= 500)) {
    return { kind: 'server', status, retryAfterMs: after, message: 'Temporary provider failure.' };
  }
  return {
    kind: 'unknown',
    status,
    retryAfterMs: after,
    message: 'Unexpected provider error.',
  };
}

/** AWS-style full-jitter delay: random(0, min(maxMs, base * 2^attempt)). */
export function fullJitterDelay(attempt: number, baseMs = 1500, maxMs = 30_000): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.random() * ceiling;
}

/** Milliseconds until the end of the current Pacific day (free-tier reset). */
export function endOfPacificDayMs(now: number = Date.now()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const hourMs = 60 * 60 * 1000;
  for (let t = Math.floor(now / hourMs) * hourMs + hourMs; t < now + 48 * hourMs; t += hourMs) {
    if (fmt.format(new Date(t)) === '00') return t;
  }
  return now + 24 * 60 * 60 * 1000; // safety fallback
}

/**
 * Per-model circuit state for one isolate (the sibling persists pair state to
 * Supabase cross-isolate; that is out of MVP scope here — a fresh isolate
 * re-probes at worst). Minute-limits cool with full-jitter backoff honoring
 * Retry-After; daily quotas cool until Pacific midnight; auth/model-id
 * problems disable the model entirely (in this isolate).
 *
 * Exported as a class so tests can build isolated instances; `defaultModelCircuits`
 * is the production singleton.
 */
export class ModelCircuits {
  private cooldown = new Map<string, { until: number; failures: number }>();
  private daily = new Map<string, number>();
  private disabled = new Map<string, string>();

  isDisabled(modelId: string): boolean {
    return this.disabled.has(modelId);
  }

  isAvailable(modelId: string, now: number = Date.now()): boolean {
    if (this.disabled.has(modelId)) return false;
    const c = this.cooldown.get(modelId);
    if (c && now >= c.until) this.cooldown.delete(modelId);
    if (this.cooldown.has(modelId)) return false;
    const d = this.daily.get(modelId);
    if (d !== undefined && now >= d) this.daily.delete(modelId);
    return !this.daily.has(modelId);
  }

  recordSuccess(modelId: string): void {
    this.cooldown.delete(modelId);
  }

  recordFailure(modelId: string, failure: ClassifiedFailure, now = Date.now()): void {
    switch (failure.kind) {
      case 'rate_limit_daily':
        this.daily.set(modelId, endOfPacificDayMs(now));
        this.cooldown.delete(modelId);
        break;
      case 'auth':
        this.disabled.set(modelId, 'auth');
        break;
      case 'model_not_found':
        this.disabled.set(modelId, 'model-not-found');
        break;
      case 'bad_request':
        // The request shape may not fit this model; the model itself is fine.
        break;
      default: {
        const prev = this.cooldown.get(modelId)?.failures ?? 0;
        const backoff = fullJitterDelay(prev, 1500, 30_000);
        const delay = Math.max(failure.retryAfterMs ?? 0, backoff);
        this.cooldown.set(modelId, { until: now + delay, failures: prev + 1 });
      }
    }
  }
}

export const defaultModelCircuits = new ModelCircuits();

/* ═══════════════════════════════════════════════════════ streaming ════ */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

interface AttemptDone {
  kind: 'done';
  result: GeminiRoundResult;
}
/** Provider returned 200 but neither text nor tool calls — rotate. */
interface AttemptEmpty {
  kind: 'empty';
}
interface AttemptFailed {
  kind: 'failed';
  failure: ClassifiedFailure;
  /** Tokens already streamed to the caller — the answer cannot restart. */
  emitted: boolean;
  /** Partial output kept only so an interruption reports what was seen. */
  text: string;
  parts: GeminiPart[];
}
type Attempt = AttemptDone | AttemptEmpty | AttemptFailed;

/**
 * Streams one model round with model-chain rotation. Resolves with the full
 * text plus any tool calls, after all tokens were delivered to
 * `handlers.onToken`. A model that fails or returns nothing BEFORE streaming
 * is transparently replaced by the next in the chain.
 */
export async function streamGeminiRound(
  bindings: ApiBindings,
  request: GeminiRequest,
  handlers: StreamHandlers,
  fetchImpl: typeof fetch = fetch,
  circuits: ModelCircuits = defaultModelCircuits,
): Promise<GeminiRoundResult> {
  const chain = geminiModelChain(bindings);
  let lastFailure: ClassifiedFailure | null = null;
  let sawEmpty = false;
  let attemptedAny = false;

  for (const modelId of chain) {
    if (circuits.isDisabled(modelId) || !circuits.isAvailable(modelId)) continue;

    attemptedAny = true;
    const attempt = await runRoundAttempt(modelId, bindings, request, handlers, fetchImpl);
    if (attempt.kind === 'done') {
      circuits.recordSuccess(modelId);
      return attempt.result;
    }
    if (attempt.kind === 'empty') {
      sawEmpty = true;
      continue;
    }

    lastFailure = attempt.failure;
    circuits.recordFailure(modelId, attempt.failure);
    if (attempt.emitted) {
      // Text already reached the user: restarting on another model would
      // duplicate or mix answers — report the interruption instead.
      return {
        text: attempt.text,
        toolCalls: [],
        parts: attempt.parts,
        error: chatMessageFor(attempt.failure),
      };
    }
    // Nothing emitted: fall through to the next model. bad_request falls
    // through as well — the request was validated before the provider call,
    // so a 400 here is model-specific (unsupported feature, safety filter)
    // and the next model usually accepts the same request.
  }

  if (!attemptedAny) {
    return {
      text: '',
      toolCalls: [],
      parts: [],
      error: 'The AI assistant is cooling down — please try again in a few minutes.',
    };
  }
  if (lastFailure) {
    return { text: '', toolCalls: [], parts: [], error: chatMessageFor(lastFailure) };
  }
  if (sawEmpty) return { text: '', toolCalls: [], parts: [], error: undefined };
  return { text: '', toolCalls: [], parts: [], error: 'All assistant models failed.' };
}

/** Maps a provider failure to a safe, customer-appropriate chat message. */
function chatMessageFor(failure: ClassifiedFailure): string {
  switch (failure.kind) {
    case 'rate_limit_daily':
      return 'The AI assistant reached its daily capacity — please try again later.';
    case 'rate_limit_minute':
      return 'The AI assistant is busy — please try again in a moment.';
    default:
      return 'The AI service is temporarily unavailable.';
  }
}

async function runRoundAttempt(
  modelId: string,
  bindings: ApiBindings,
  request: GeminiRequest,
  handlers: StreamHandlers,
  fetchImpl: typeof fetch,
): Promise<Attempt> {
  const url = `${GEMINI_BASE}/${modelId}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: request.systemPrompt }] },
    contents: request.contents,
    tools: [{ functionDeclarations: request.tools }],
    generationConfig: { temperature: 0.6, maxOutputTokens: request.maxOutputTokens ?? 1024 },
    safetySettings: blockNothing(),
  };

  let res: Response;
  let detail = '';
  let text = '';
  let emitted = false;
  const toolCalls: ToolCall[] = [];
  const roundParts: GeminiPart[] = [];

  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': bindings.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      detail = await safeText(res);
      return {
        kind: 'failed',
        failure: classifyFailure(res.status, detail, res.headers.get('retry-after')),
        emitted,
        text,
        parts: roundParts,
      };
    }
  } catch (error) {
    return {
      kind: 'failed',
      failure: {
        kind: 'network',
        retryAfterMs: null,
        message: `AI provider unreachable (${error instanceof Error ? error.message : 'network error'})`,
      },
      emitted,
      text,
      parts: roundParts,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamClosed = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      emitLines();
    }
    buffer += decoder.decode();
    emitLines();
  } catch (error) {
    streamClosed = true;
    return {
      kind: 'failed',
      failure: {
        kind: 'network',
        retryAfterMs: null,
        message: `Connection to the AI provider lost (${error instanceof Error ? error.message : 'network error'})`,
      },
      emitted,
      text,
      parts: roundParts,
    };
  } finally {
    if (!streamClosed) {
      try {
        await reader.cancel();
      } catch {
        /* stream already consumed */
      }
    }
  }

  if (buffer.trim().startsWith('data:')) emitLine(buffer.trim());

  if (text === '' && toolCalls.length === 0) return { kind: 'empty' };

  return {
    kind: 'done',
    result: { text, toolCalls, parts: roundParts, error: undefined },
  };

  function emitLines() {
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line.startsWith('data:')) emitLine(line.slice(5).trim());
    }
  }

  function emitLine(json: string) {
    let parsed: { candidates?: Array<{ content?: { parts?: GeminiPart[]; role?: string } }> };
    try {
      parsed = JSON.parse(json);
    } catch {
      return;
    }
    for (const candidate of parsed.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        // Internal 3.x thinking is neither streamed nor replayed.
        if (part.thought === true) continue;
        if (typeof part.text === 'string' && part.text) {
          text += part.text;
          emitted = true;
          handlers.onToken?.(part.text);
          roundParts.push({
            text: part.text,
            ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
          });
        }
        if (part.functionCall?.name) {
          toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
          emitted = true;
          roundParts.push({
            functionCall: { name: part.functionCall.name, args: part.functionCall.args },
            ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
          });
        }
      }
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}

/** Keep the assistant helpful for a sales chat; only highest blocking stays. */
function blockNothing() {
  const thresholds = [
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
  ];
  return thresholds.map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));
}
