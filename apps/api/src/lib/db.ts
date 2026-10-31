import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApiBindings } from './env';

/**
 * Server-side Supabase client using the secret key. Runs with RLS-bypassing
 * privileges, so EVERY query in this app must be shop-scoped explicitly
 * (AGENTS.md rule #6 and NFR-03). RLS in the database is defense-in-depth.
 */
export type Db = SupabaseClient;
export function createDb(bindings: ApiBindings): Db {
  return createClient(bindings.SUPABASE_URL, bindings.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
