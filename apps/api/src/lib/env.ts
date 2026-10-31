/**
 * Environment bindings for the Worker. Secrets are set via
 * `wrangler secret put` in production and `.dev.vars` in local dev.
 */
export interface ApiBindings {
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  GEMINI_API_KEY: string;
  /**
   * Model rotation chain, comma separated (first entry is primary). Takes
   * precedence over GEMINI_MODEL; unset → DEFAULT_MODEL_CHAIN in lib/gemini.
   */
  GEMINI_MODELS?: string;
  /** Single-model chain (legacy/compat knob). */
  GEMINI_MODEL?: string;
  /** Max customer chat requests per minute per IP (default 20). */
  CHAT_RATE_LIMIT_PER_MIN?: string;
  /** Allowed browser origins for dashboard/storefront (comma separated, default *). */
  ALLOWED_ORIGINS?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface EnvShape {
  Bindings: ApiBindings;
  Variables: {
    authUser: AuthUser;
    db: import('./db').Db;
    chatLimiter: import('./rate-limit').RateLimiter;
  };
}
