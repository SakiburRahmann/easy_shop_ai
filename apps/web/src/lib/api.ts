'use client';

/**
 * Browser-side API client for easyshop-api (Cloudflare Worker). All requests go
 * to NEXT_PUBLIC_API_URL (baked at build time); the API echoes any origin via
 * CORS, so static hosting on any domain works out of the box.
 */
import {
  type ChatEvent,
  chatEventSchema,
  errorResponseSchema,
  type SignInInput,
  sessionSchema,
  type Session,
} from '@easyshop/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = errorResponseSchema.safeParse(await res.json());
      if (body.success) message = body.data.error;
    } catch {
      /* keep generic message */
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal } = {},
): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  return unwrap<T>(res);
}

export async function signIn(input: SignInInput): Promise<Session> {
  return sessionSchema.parse(await api<unknown>('/auth/login', { body: input }));
}

/**
 * Streams one /chat SSE round. Server-sent events are validated with the
 * shared chatEventSchema before reaching the UI.
 */
export async function streamChat(
  body: { shopSlug: string; message: string; visitorId: string; conversationId?: string },
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    onEvent({
      type: 'error',
      message: `Network error: ${error instanceof Error ? error.message : 'could not reach the shop assistant'}`,
    });
    return;
  }

  if (!res.ok || !res.body) {
    let message = `Chat failed (${res.status})`;
    try {
      const parsed = errorResponseSchema.safeParse(await res.json());
      if (parsed.success) message = parsed.data.error;
    } catch {
      /* keep generic message */
    }
    onEvent({ type: 'error', message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (chunk: string) => {
    for (const raw of chunk.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const event = chatEventSchema.parse(JSON.parse(payload));
        onEvent(event);
      } catch {
        /* skip malformed event */
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      dispatch(buffer.slice(0, splitAt));
      buffer = buffer.slice(splitAt + 2);
      splitAt = buffer.indexOf('\n\n');
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) dispatch(buffer);
}

/** Stable anonymous visitor id for chat (localStorage-backed). */
export function visitorId(): string {
  const key = 'easyshopai.visit';
  let id = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  if (!id) {
    id = `v-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

export function taka(amount: number): string {
  return `৳${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}
