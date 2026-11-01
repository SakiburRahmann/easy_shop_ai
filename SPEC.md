# EasyShopAI — Canonical Specification

> Living document. Trimmed from `docs/proposals/CSE-327-Project-Proposal-Two-Project-Ideas.pdf`.
> Any change to a contract (data model, API, AI tools) must update this file in the same PR.

## 1. Product summary

Multi-tenant platform for small online sellers (F-commerce, starting Bangladesh):

1. **Store builder** — a seller signs up, chooses their business type, names the shop, picks a
   template + theme, sets delivery zones and AI rules, and gets a live store at
   `easyshopai.app/s/<shop-slug>` within minutes. The platform seeds starter categories for the
   chosen business type, so the store and its AI agent are useful from minute one.
2. **Marketplace discovery** — customers also arrive through EasyShopAI itself: the home page lists
   all shops (`GET /shops`) and searches products across every shop
   (`GET /search/products`) so the platform is a buying destination, not only a set of storefronts
   (Shopify-like: sellers open their store, customers browse shops and products).
3. **AI sales assistant** — a chat agent on every storefront that talks to customers in
   Bangla, English or Banglish. It finds products from the real catalog, answers questions about
   price, stock, delivery (`get_shop_info` returns zones, charges, ETA) and policies, negotiates
   within the seller's rules, and collects COD order details — acting as the shop's full
   customer-service agent.

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

- Seller signup/login; store builder (business type, shop profile, logo, contact, delivery zones
  and charges, return policy); starter categories seeded from the business type
- Product catalog: name, description, images, price, `floor_price`, variants (size, color), stock, category
- Buyer cart: add products (with variant and quantity), edit quantities, then one combined COD checkout; variantless products decrement their own stock
- 3 storefront templates (`classic`, `modern`, `boutique`); primary/accent colors, display font
  and logo customization; switching templates keeps all data
- Public storefront: home, category, product search, product deep links, COD checkout with a
  delivery-zone selector
- Public marketplace product search across every shop, with prices and shop cards
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
- **Templates:** three visually distinct storefront shells driven by a shared template config
  (`apps/web/src/components/storefront/templates.ts`); adding a template = adding an entry and a
  DB constraint value, not generating code.
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
shops          (id, owner_id, name, slug, business_type, logo, template_id, theme, contact, delivery_rules, policies)
categories     (id, shop_id, name)
products       (id, shop_id, name, description, category_id, price, floor_price, stock, images, active)
variants       (id, product_id, size, color, stock, price_override)
orders         (id, shop_id, customer_name, phone, address, total, status, payment_method, source)
order_items    (id, order_id, variant_id, qty, unit_price)
conversations  (id, shop_id, visitor_id, status, needs_owner)
messages       (id, conversation_id, role, content, tool_calls, created_at)
ai_settings    (shop_id, tone, languages, max_discount_pct, extra_instructions)
device_tokens  (user_id, token, platform)
```

Order statuses: `pending → confirmed → shipped → delivered` (+ `cancelled`).

`business_type` is one of `fashion | electronics | beauty | groceries | home | kids | other`.
`template_id` is one of `classic | modern | boutique`. `theme` is JSONB with optional
`primaryColor`, `accentColor` and `font` (`sans | serif`). Variant stock is reserved atomically when
an order is placed (`adjust_variant_stock` SQL function) and restored when an order is cancelled.
Products without variants use their own `stock` column and the matching
`adjust_product_stock` function; variant products ignore it.

## 7. API surface (draft — refine as endpoints are built)

- `POST /auth/*` — via Supabase
- `GET /shops` (public marketplace directory: shop cards with business type, product counts and catalog images; `?q=&businessType=&limit=&offset=`)
- `GET /search/products` (public cross-shop product search: `?q=&category=&shopSlug=&minPrice=&maxPrice=&sort=&limit=&offset=`; returns product + shop card)
- `POST /shops` (seller; stores business type, seeds starter categories), `GET/PATCH /shops/:id` (seller)
- `GET /s/:slug` (public storefront payload), `GET /s/:slug/products`, `GET /products/:id` (public product detail `{ product, shop }`)
- Storefront URLs on the static site: `/s?shop=<slug>` (Cloudflare Pages normalizes deep
  `/s/<slug>` paths to `/s`; the shell reads the slug from the query)
- Templates render distinct storefront layouts: `classic` (clean catalog grid) and `modern`
  (hero banner + editorial product cards), both using `theme.primaryColor`
- `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` (seller, shop-scoped)
- `POST /uploads` — image upload (Supabase Storage)
- `POST /s/:slug/orders` (public COD; optional `deliveryZone` when the shop has zones), `GET /shops/:id/orders` (seller), `PATCH /orders/:id/status`
- `POST /chat` — AI assistant turn (SSE/streaming), `GET /shops/:id/conversations` (seller)
- `GET/PATCH /ai-settings`, `POST /handoff/:conversationId`

All request/response shapes are Zod schemas in `packages/shared`.

## 8. AI assistant contract

**Tools (server-executed, shop-scoped):**

| Tool                                                       | Purpose                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `search_products(query, max_price, color, size, category)` | Find matching products; returns real items with images and prices |
| `get_product(id)`                                          | Full details and variant stock                                    |
| `get_shop_info()`                                          | Business type, categories, delivery zones, charges, return policy |
| `check_discount(product_id, offered_price)`                | Server-side floor-price check; accept / reject / counter          |
| `create_order(items, name, phone, address, delivery_zone)` | Creates a pending order with a server-priced delivery charge      |
| `handoff_to_owner(reason)`                                 | Flags the conversation for the seller                             |

**Flow example:** "ekta lal t-shirt lagbe, 1000 takar moddhe" → `search_products(color=red,
category=t-shirt, max_price=1000)` → reply with short product cards (rendered from tool results)

- one follow-up question.

**Guardrails:**

- If a tool returns nothing, say so; never guess.
- Prices/stock stated by the AI must come from tool results (target: zero hallucinated facts).
- The model never decides prices; `check_discount` does. The model phrases accept/reject/counter.
- `create_order` only after explicit customer confirmation of items, delivery charge, total and
  address. Delivery is priced from the shop's zones, never from model text. When the shop has
  zones, `create_order` requires the zone name and fails with the available zones if missing.
- Rate limit per IP and per shop; cap messages per conversation.
- Product cards are streamed from tool results; the UI never renders a product from model prose.
- Customer text is untrusted; permissions come from the system prompt and server.
- Every conversation is logged for seller review.
- Policies/FAQs go in the prompt for MVP; pgvector retrieval when shops grow.

## 9. Non-functional requirements

- **NFR-01** AI starts replying within 3s under normal load (time to first token).
- **NFR-02** 100% of prices and stock stated by the AI come from database results.
- **NFR-03** Every query is limited to the authenticated shop (tenant isolation).
- **NFR-04** Data changed on one client appears on the other within 5s.
- **NFR-05** An order can never oversell stock: variant (or product-level, for variantless
  products) stock is reserved atomically before the order row is created, and restored if the
  customer (or seller) cancels.

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
