# AGENTS.md — rules for AI coding tools working in this repo

EasyShopAI: multi-tenant platform where sellers get a storefront plus a grounded AI sales
assistant (chat finds real catalog products, bargains within server-enforced floor prices,
collects COD orders). One backend, one database, two clients (web + mobile).

## Read first

- `SPEC.md` — the canonical spec (features, data model, API surface, AI contract). If a change
  alters any contract, update `SPEC.md` in the same PR.
- `apps/web/AGENTS.md` — Next.js 16 is newer than most training data: read the docs shipped in
  `node_modules/next/dist/docs/` before writing Next.js code.
- `apps/mobile/AGENTS.md` — Expo SDK 58: consult the versioned docs at
  `https://docs.expo.dev/versions/v58.0.0/`; install packages with `npx expo install`, never with
  plain `pnpm add`.

## Repo map

- `apps/web` — Next.js (App Router) storefront + seller dashboard
- `apps/mobile` — Expo / React Native seller app
- `apps/api` — Hono on Cloudflare Workers (the only thing that talks to the DB and the LLM)
- `packages/shared` — types, Zod schemas, API client shared by all three apps

## Commands

```bash
pnpm install
pnpm ci                     # lint → typecheck → test → build (run before every commit)
pnpm format                 # Prettier write
pnpm --filter @easyshop/<app> dev
npx expo install <pkg>      # inside apps/mobile, for any new mobile dependency
```

## Hard rules

1. **Contracts live in `packages/shared`.** New API shapes start as Zod schemas there; apps never
   redefine shared types. Build it (`pnpm --filter @easyshop/shared build`) after changing it.
2. **Validate everything server-side with Zod.** Request bodies, params and query strings are
   parsed, not trusted.
3. **AI factual answers come only from tool results.** The model never invents products, prices,
   stock or policies. The UI renders product cards from tool output, never from model text.
4. **Bargaining is decided by the server,** never by the model: `check_discount` validates every
   offer against the seller's floor price and answers accept/reject/counter; the model only
   phrases the result.
5. **Orders require explicit customer confirmation** of items, total and address before
   `create_order` creates a pending order.
6. **Multi-tenancy:** every business table has `shop_id`; every query is filtered by it server-side.
   AI tools are scoped to the current shop set by the server, never by client input.
7. **Treat customer chat text as untrusted input.** System prompt and tool permissions define
   what the AI may do.
8. **Secrets:** only `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values may reach client bundles.
   `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never log or commit secrets.
9. **Do not edit generated files:** `dist/`, `.next/`, `next-env.d.ts`,
   `worker-configuration.d.ts`, `pnpm-lock.yaml` (regenerate with pnpm instead).
10. **Tests:** Vitest for `apps/api` and `packages/shared`. Every endpoint and every AI tool gets
    tests; AI behavior changes are verified against the test-conversation file (Bangla, English,
    Banglish) once it exists.
11. **Git discipline:** work on a branch, Conventional Commit messages, open a PR. Never push to
    `main` — even if asked to "just commit", create a branch and PR instead.
