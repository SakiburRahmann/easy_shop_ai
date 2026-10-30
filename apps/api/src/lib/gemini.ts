/**
 * Minimal Gemini client over the REST API (streaming, function calling).
 * Implemented with plain fetch so it runs on Workers without SDK/AI flag
 * issues, and stays injectable for tests.
 */
import { geminiModel, type ApiBindings } from './env';

export interface GeminiPart {
  text?: string;
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

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': bindings.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    return {
      text: '',
      toolCalls: [],
      error: `Gemini API error (${res.status}): ${detail.slice(0, 300)}`,
    };
  }

  let text = '';
  const toolCalls: ToolCall[] = [];
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
        if (typeof part.text === 'string' && part.text) {
          text += part.text;
          handlers.onToken?.(part.text);
        }
        if (part.functionCall?.name) {
          toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
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

  return { text, toolCalls };
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
