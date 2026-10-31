import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { EnvShape } from './env';

/**
 * Validation helpers (AGENTS.md rule #2: parse, never trust).
 *
 * Helpers either THROW a Hono HTTPException (always delivered, never lost) or
 * RETURN a Response that call sites must `return` — handlers must not
 * `return;` bare after a helper wrote a response, which loses the response in
 * composed routes ("Context is not finalized").
 */

/** Throwing variant used internally by `parseBody`. */
function validationError(status: 400, error: string, details?: unknown): never {
  const payload = { error, ...(details !== undefined ? { details } : {}) };
  const body = JSON.stringify(payload);
  throw new HTTPException(status, {
    message: body,
    res: new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  });
}

export function notFound(c: Context<EnvShape>, what = 'Resource') {
  return c.json({ error: `${what} not found` }, 404);
}

/** Route params, defaulting to '' instead of undefined. */
export function param(c: Context<EnvShape>, name: string): string {
  return c.req.param(name) ?? '';
}

export function forbidden(c: Context<EnvShape>) {
  return c.json({ error: 'You do not have access to this shop' }, 403);
}

/**
 * Validates a JSON body with a Zod schema; on failure throws a 400
 * HTTPException whose response carries the flattened field errors.
 */
export async function parseBody<T extends z.ZodTypeAny>(
  c: Context<EnvShape>,
  schema: T,
): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    validationError(400, 'Body must be valid JSON');
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    validationError(400, 'Validation failed', z.flattenError(result.error));
  }
  return result.data;
}
