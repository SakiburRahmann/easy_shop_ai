/**
 * Minimal Gemini client over the REST API (streaming, function calling).
 * Implemented with plain fetch so it runs on Workers without SDK/AI flag
 * issues, and stays injectable for tests.
 */
import { geminiModel, type ApiBindings } from './env';

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

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Streams one model round. Resolves with the full text plus any tool calls,
 * after all tokens were delivered to `handlers.onToken`.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Respects Gemini's retryDelay hint when present; never waits more than 45s. */
function retryDelayMs(detail: string): number {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)(s|m)"/i.exec(detail);
  if (!m) return 10_000;
  const n = parseFloat(m[1] ?? '10') * (m[2]?.toLowerCase() === 'm' ? 60_000 : 1000);
  return Math.min(Math.max(n, 1_000), 45_000);
}

export async function streamGeminiRound(
  bindings: ApiBindings,
  request: GeminiRequest,
  handlers: StreamHandlers,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiRoundResult> {
  const url = `${GEMINI_BASE}/${geminiModel(bindings)}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: request.systemPrompt }] },
    contents: request.contents,
    tools: [{ functionDeclarations: request.tools }],
    generationConfig: { temperature: 0.6, maxOutputTokens: request.maxOutputTokens ?? 1024 },
    safetySettings: blockNothing(),
  };

  const start = () =>
    fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': bindings.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });

  // One paced retry on rate-limit/5xx before any token is streamed — safe
  // because nothing has been delivered to the chat stream yet.
  let res = await start();
  if ((!res.ok || !res.body) && (res.status === 429 || res.status >= 500)) {
    const detail = await safeText(res);
    await sleep(retryDelayMs(detail));
    res = await start();
  }

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    return {
      text: '',
      toolCalls: [],
      parts: [],
      error: `Gemini API error (${res.status}): ${detail.slice(0, 300)}`,
    };
  }

  let text = '';
  const toolCalls: ToolCall[] = [];
  const roundParts: GeminiPart[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleChunkJson = (json: string) => {
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
          handlers.onToken?.(part.text);
          roundParts.push({
            text: part.text,
            ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
          });
        }
        if (part.functionCall?.name) {
          toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
          roundParts.push({
            functionCall: { name: part.functionCall.name, args: part.functionCall.args },
            ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
          });
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line.startsWith('data:')) handleChunkJson(line.slice(5).trim());
    }
  }
  if (buffer.trim().startsWith('data:')) handleChunkJson(buffer.trim().slice(5).trim());

  return { text, toolCalls, parts: roundParts, error: undefined };
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
