# EasyShopAI

CI (format check, lint, typecheck, tests and build) runs on every push and pull request — see the
[Actions tab](https://github.com/SakiburRahmann/easy_shop_ai/actions/workflows/ci.yml). GitHub does
not render workflow badges for private repositories, so the status is linked rather than embedded.

EasyShopAI is a **two-sided commerce platform** (CSE 327 project): a **Shopify-style store builder**
for sellers and an **Amazon-style marketplace** for buyers, with an AI sales agent inside every
store. Sellers sign up, choose their business type, build a store with one of three templates and a
custom theme, set delivery zones and get a live storefront with an AI assistant that answers
customers in Bangla, English or Banglish, searches the real catalog, bargains within seller-set
floor prices, and collects cash-on-delivery orders. Buyers browse every shop, search products across
the whole marketplace, fill a cart and check out several items in one COD order. One account and one
data source across web and mobile.

## Architecture

```
Customer → Storefront (Next.js) ──┐
Seller web → Dashboard (Next.js) ──┼──► REST API (Hono on Cloudflare Workers) ──► PostgreSQL (Supabase, + pgvector)
Seller app → Mobile (Expo) ────────┘        │
                                            ├──► Gemini API (Google AI Studio)
                                            └──► Supabase (auth, storage, realtime)
```

One backend, one database, two clients. Web and mobile never talk to each other; both call the same
API, so they always show the same data.

## Repository layout

```
apps/web       Next.js — customer storefront + seller dashboard (deploys to Cloudflare)
apps/mobile    Expo / React Native — seller app (EAS builds)
apps/api       Hono on Cloudflare Workers — the single REST API
packages/shared  Shared types, Zod schemas and API client imported by all apps
docs/proposals   Original proposal documents (PDFs)
SPEC.md        Canonical spec: features, data model, API, AI contract
```

## Prerequisites

- Node.js 24 (see `.nvmrc`) and pnpm (repo targets pnpm 12)
- For deployment: Cloudflare account (web/api), Supabase project (db/auth/storage),
  Google AI Studio key (Gemini), Expo/EAS account (mobile builds)

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in your own values; never commit .env

pnpm dev                        # run everything (web + mobile + api)
pnpm --filter @easyshop/web dev       # storefront + dashboard  → http://localhost:3000
pnpm --filter @easyshop/api dev       # API                     → http://localhost:8787
pnpm --filter @easyshop/mobile start  # Expo dev server (scan with Expo Go / dev build)
```

## Common commands

| Command                                                     | What it does                                        |
| ----------------------------------------------------------- | --------------------------------------------------- |
| `pnpm run ci`                                               | Everything CI runs: lint → typecheck → test → build |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` | Individual task across all packages                 |
| `pnpm format`                                               | Format everything with Prettier                     |
| `pnpm --filter @easyshop/api run deploy`                    | Deploy the API to Cloudflare Workers                |

## Contributing

The repository owner works directly on `main`. Teammates and AI agents use a branch and pull request
unless the owner explicitly authorizes a direct `main` change. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the full workflow, branch and commit conventions.

## Documentation

- [SPEC.md](SPEC.md) — canonical spec (features, data model, API, AI guardrails)
- [CONTRIBUTING.md](CONTRIBUTING.md) — how we work on this repo
- [AGENTS.md](AGENTS.md) — conventions for AI coding tools
- [docs/proposals](docs/proposals) — original project proposal documents
