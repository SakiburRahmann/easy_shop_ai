# EasyShopAI — Canonical Specification

> Living document. Trimmed from `docs/proposals/CSE-327-Project-Proposal-Two-Project-Ideas.pdf`.
> Any change to a contract (data model, API, AI tools) must update this file in the same PR.

## 1. Product summary

Multi-tenant platform for small online sellers (F-commerce, starting Bangladesh):

1. **Instant storefront** — a seller signs up, adds shop details and products, picks a template,
   and gets a live store at `easyshopai.app/s/<shop-slug>` within minutes.
2. **AI sales assistant** — a chat assistant on every storefront that talks to customers in
   Bangla, English or Banglish. It finds products from the real catalog, answers questions about
   price, stock, delivery and policies, negotiates within the seller's rules, and collects COD
   order details.

One account and one data source across web and mobile. Future work (not in MVP): Meta Messenger
integration, live payments, courier APIs, voice.

## 2. Users and roles

| Role     | Description                                            | Clients                    |
| -------- | ------------------------------------------------------ | -------------------------- |
| Seller   | Manages shop, products, AI rules, orders               | Web dashboard + mobile app |
| Customer | Browses storefront, chats with AI, orders (no account) | Web storefront             |
| Admin    | Manages sellers, templates, abuse reports (basic)      | Web                        |

## 3. MVP scope

**In scope**

- Seller signup/login; shop profile (name, logo, contact, delivery zones & charges, return policy)
- Product catalog: name, description, images, price, `floor_price`, variants (size, color), stock, category
- 2–3 storefront templates; theme color and logo customization
- Public storefront: home, category, product page, cart, COD checkout
- AI assistant: natural-language product search, answers from shop data, order capture, bargaining,
  human handoff
- Seller dashboard (web) + mobile app: orders list/status, product quick edit, AI conversation
  logs, push notifications for new orders
- AI settings per shop: tone, languages, max discount % / floor prices, policies the AI may state
- Conversation logging; rate limits; message caps

**Out of scope (roadmap only)**

- Messenger/Facebook page integration (demo in Meta dev mode only if reached)
- Live payment gateways, courier APIs, voice input
- CSV import, analytics dashboard (stretch)

## 4. Architecture

```
Customer → Storefront (Next.js) ──┐
Seller web → Dashboard (Next.js) ──┼──► API (Hono, Cloudflare Workers) ──► PostgreSQL (Supabase + pgvector)
Seller app → Mobile (Expo) ────────┘        │
                                            ├──► Gemini (Google AI Studio), server-side only
                                            ├──► Supabase Auth + Storage
                                            └──► Supabase Realtime / Expo Push
```

- **Single source of truth:** the API and database. A product edited on the phone appears on the
  storefront.
- **Auth:** one Supabase account system; the same login works on web and mobile.
- **Multi-tenancy:** every table has `shop_id`, every query is filtered server-side. AI tools are
  scoped to a server-set shop ID.
- **Templates:** React components receiving shop data as props; adding a template = adding a
  component, not generating code.
- **Monorepo:** pnpm workspaces + Turborepo, `apps/web`, `apps/mobile`, `apps/api`,
  `packages/shared`.

## 5. Tech stack

| Layer           | Choice                                                                      |
| --------------- | --------------------------------------------------------------------------- |
| Language        | TypeScript everywhere                                                       |
| Web             | Next.js (App Router), React, Tailwind CSS                                   |
| Mobile          | React Native + Expo (EAS builds)                                            |
| API             | Hono on Cloudflare Workers, Zod validation                                  |
| Database        | PostgreSQL (Supabase), pgvector; Drizzle-style SQL access via Supabase      |
| Auth / storage  | Supabase Auth, Supabase Storage                                             |
| AI              | Google AI Studio (Gemini), tool calling, server-side only                   |
| Realtime / push | Supabase Realtime (web), Expo Push (mobile)                                 |
| CI/CD           | GitHub Actions (lint, typecheck, test, build); Cloudflare deploy; EAS Build |
| Tests           | Vitest (api, shared); test conversations for AI; Playwright later for e2e   |

## 6. Data model (draft)

```
users          (id, email, role, created_at)
shops          (id, owner_id, name, slug, logo, template_id, theme, contact, delivery_rules, policies)
categories     (id, shop_id, name)
products       (id, shop_id, name, description, category_id, price, floor_price, images, active)
variants       (id, product_id, size, color, stock, price_override)
orders         (id, shop_id, customer_name, phone, address, total, status, payment_method, source)
order_items    (id, order_id, variant_id, qty, unit_price)
conversations  (id, shop_id, visitor_id, status, needs_owner)
messages       (id, conversation_id, role, content, tool_calls, created_at)
ai_settings    (shop_id, tone, languages, max_discount_pct, extra_instructions)
device_tokens  (user_id, token, platform)
```

Order statuses: `pending → confirmed → shipped → delivered` (+ `cancelled`).

## 7. API surface (draft — refine as endpoints are built)

- `POST /auth/*` — via Supabase
- `POST /shops`, `GET/PATCH /shops/:id` (seller)
- `GET /shops/:slug/storefront` (public), `GET /shops/:slug/products`, `GET /products/:id`
- `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (seller, shop-scoped)
- `POST /uploads` — image upload (Supabase Storage)
- `POST /orders`, `GET /orders` (seller), `PATCH /orders/:id/status`
- `POST /chat` — AI assistant turn (SSE/streaming), `GET /conversations` (seller)
- `GET/PATCH /ai-settings`, `POST /handoff/:conversationId`

All request/response shapes are Zod schemas in `packages/shared`.

## 8. AI assistant contract

**Tools (server-executed, shop-scoped):**

| Tool                                                       | Purpose                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `search_products(query, max_price, color, size, category)` | Find matching products; returns real items with images and prices |
| `get_product(id)`                                          | Full details and variant stock                                    |
| `get_shop_info()`                                          | Delivery zones, charges, times, return policy, hours              |
| `check_discount(product_id, offered_price)`                | Server-side floor-price check; accept / reject / counter          |
| `create_order(items, name, phone, address)`                | Creates a pending order                                           |
| `handoff_to_owner(reason)`                                 | Flags the conversation for the seller                             |

**Flow example:** "ekta lal t-shirt lagbe, 1000 takar moddhe" → `search_products(color=red,
category=t-shirt, max_price=1000)` → reply with short product cards (rendered from tool results)

- one follow-up question.

**Guardrails:**

- If a tool returns nothing, say so; never guess.
- Prices/stock stated by the AI must come from tool results (target: zero hallucinated facts).
- The model never decides prices; `check_discount` does. The model phrases accept/reject/counter.
- `create_order` only after explicit customer confirmation of items, total and address.
- Rate limit per IP and per shop; cap messages per conversation.
- Customer text is untrusted; permissions come from the system prompt and server.
- Every conversation is logged for seller review.
- Policies/FAQs go in the prompt for MVP; pgvector retrieval when shops grow.

## 9. Non-functional requirements

- **NFR-01** AI starts replying within 3s under normal load (time to first token).
- **NFR-02** 100% of prices and stock stated by the AI come from database results.
- **NFR-03** Every query is limited to the authenticated shop (tenant isolation).
- **NFR-04** Data changed on one client appears on the other within 5s.

## 10. Evaluation plan

- Task success: share of test conversations that find the right product / complete an order
- Hallucination rate: answers with facts not in tool results (target: 0)
- Bargaining safety: offers below floor accepted (target: 0)
- Latency: time to first token
- Setup time: minutes from signup to live store
- Test set: 30–50 conversations in Bangla, English, Banglish (kept in repo once AI lands)

## 11. Timeline (12 weeks, team of 4)

1. **W1** Setup: spec, repo, monorepo, CI, deploy "hello" apps ✔ (this scaffold)
2. **W2** Auth + shops (web + mobile)
3. **W3–4** Catalog (products, variants, images, categories, seed data)
4. **W4–5** Storefront (templates, pages, cart, COD checkout, order status)
5. **W5–6** Seller tools (orders on web + mobile, status updates, push)
6. **W6–8** AI assistant (tools, streaming chat, product cards, bargaining, order capture, handoff; test conversations)
7. **W9** AI settings + logs (tone, discount limits, conversation viewer, handoff inbox)
8. **W10** Hardening (rate limits, validation, error states, isolation tests)
9. **W11** Evaluation + demo prep (run test conversations, backup video)
10. **W12** Presentation
