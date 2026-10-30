import type { Context } from 'hono';
import { z } from 'zod';
import type { EnvShape } from './env';

/**
 * Validation helpers (AGENTS.md rule #2: parse, never trust).
 */

/** Route params are `string | undefined`; empty string drives the 404 path. */
export function param(c: Context<EnvShape>, name: string): string {
  return (c.req.param(name as never) as string | undefined) ?? '';
}

export function badRequest(c: Context<EnvShape>, error: string, details?: unknown) {
  return c.json({ error, details }, 400);
}

export function notFound(c: Context<EnvShape>, what = 'Resource') {
  return c.json({ error: `${what} not found` }, 404);
}

export function forbidden(c: Context<EnvShape>) {
  return c.json({ error: 'You do not have access to this shop' }, 403);
}

/** Validates a JSON body with a Zod schema; on failure responds 400 and returns null. */
export async function parseBody<T extends z.ZodTypeAny>(
  c: Context<EnvShape>,
  schema: T,
): Promise<z.output<T> | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    await badRequest(c, 'Body must be valid JSON');
    return null;
  }
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  await badRequest(c, 'Validation failed', z.flattenError(result.error));
  return null;
}
