'use client';

/**
 * Customer storefront: shop branding, catalog with search/filters, COD order
 * form, and the AI sales assistant chat. Product data rendered here ALWAYS
 * comes from API responses (storefront GET /s/:slug/products and chat `cards`
 * events) — never from model text.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  type ChatEvent,
  type ChatProductCard,
  type ProductPublic,
  type Storefront,
  createOrderInputSchema,
  productPublicSchema,
  storefrontSchema,
} from '@easyshop/shared';
import { api, streamChat, taka, visitorId } from '@/lib/api';
import { Badge, Button, ErrorNote, Field, Modal, Spinner, inputClass } from '@/components/ui';

function slugFromPath(): string {
  // Canonical storefront URL: /s?shop=<slug>. The pretty form /s/<slug>
  // client-side is still parsed for future custom-domain deployments where
  // the platform does not normalize deep paths.
  const sp = new URLSearchParams(window.location.search);
  const fromQuery = sp.get('shop');
  if (fromQuery) return fromQuery;
  const match = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function Storefront() {
  const [slug] = useState(() => (typeof window !== 'undefined' ? slugFromPath() : ''));
  const [data, setData] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const s = slugFromPath();
    if (!s) {
      // Async hop so no state updates run synchronously inside the effect.
      void Promise.resolve().then(() => {
        setNotFound(true);
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    api<unknown>(`/s/${s}`)
      .then((raw) => {
        if (cancelled) return;
        const parsed = storefrontSchema.safeParse(raw);
        if (parsed.success) setData(parsed.data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading shop…" />;
  if (notFound || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="text-xl font-semibold">Shop not found</h1>
        <p className="text-sm text-zinc-500">No storefront lives at this address.</p>
        <Link href="/" className="text-sm font-medium text-emerald-600 hover:underline">
          ← EasyShopAI home
        </Link>
      </div>
    );
  }

  const accent = data.shop.theme.primaryColor ?? '#059669';

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <header
        className="flex flex-wrap items-center gap-4 px-6 py-6 text-white"
        style={{ backgroundColor: accent }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4">
          <div className="flex flex-1 flex-col">
            <h1 className="text-2xl font-bold">{data.shop.name}</h1>
            {data.shop.description ? (
              <p className="mt-1 max-w-xl text-sm text-white/80">{data.shop.description}</p>
            ) : null}
          </div>
          {data.shop.contact.phone ? (
            <div className="text-sm text-white/90">📞 {data.shop.contact.phone}</div>
          ) : null}
        </div>
      </header>

      <Catalog data={data} slug={slug} accent={accent} />

      <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-center text-xs text-zinc-500">
        {data.shop.policies.notes ? (
          <p className="mx-auto max-w-2xl whitespace-pre-line">{data.shop.policies.notes}</p>
        ) : null}
        <p className="mt-1">{data.shop.name} · powered by EasyShopAI</p>
      </footer>

      <ChatWidget shop={data} accent={accent} />
    </div>
  );
}
/* ─────────────────────────── catalog + orders ──────────────────────────── */

interface BuyTarget {
  product: ProductPublic;
}
function Catalog({ data, slug, accent }: { data: Storefront; slug: string; accent: string }) {
  const [products, setProducts] = useState<ProductPublic[]>(data.products);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [buyTarget, setBuyTarget] = useState<BuyTarget | null>(null);

  const refetch = useCallback(
    (next?: { q?: string; categoryId?: string; sort?: string }) => {
      setLoading(true);
      const sp = new URLSearchParams({ limit: '24' });
      if (next?.q) sp.set('q', next.q);
      if (next?.sort) sp.set('sort', next.sort);
      if (next?.categoryId) sp.set('categoryId', next.categoryId);
      api<unknown>(`/s/${slug}/products?${sp.toString()}`)
        .then((raw) => {
          if (Array.isArray(raw)) setProducts(raw as ProductPublic[]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [slug],
  );

  const openBuy = async (productId: string) => {
    try {
      const parsed = productPublicSchema.safeParse(await api<unknown>(`/products/${productId}`));
      if (parsed.success) setBuyTarget({ product: parsed.data });
    } catch {
      /* item vanished; ignore */
    }
  };

  const modern = data.shop.templateId === 'modern';

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      {modern ? (
        <section
          className="mb-8 flex flex-col gap-4 rounded-3xl px-8 py-10 text-white"
          style={{ background: `linear-gradient(120deg, ${accent}, ${accent}99 70%, #0f172acc)` }}
        >
          <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
            {data.shop.name} · new drops weekly
          </span>
          <p className="max-w-lg text-xl font-semibold leading-snug">
            {data.shop.description || 'Explore our latest collection — curated for you.'}
          </p>
          <p className="text-sm text-white/75">
            Need help choosing? The AI assistant (💬 bottom-right) knows every item, size and price.
          </p>
        </section>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && refetch({ q, sort, categoryId })}
          placeholder="Search products…"
          className={`${inputClass} max-w-xs`}
        />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            refetch({ q, sort: e.target.value, categoryId });
          }}
          className={`${inputClass} w-auto`}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>
        {data.categories.map((c) => (
          <button
            key={c.id}
            style={categoryId === c.id ? { backgroundColor: accent, color: 'white' } : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              categoryId === c.id
                ? 'border-transparent'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            onClick={() => {
              const next = categoryId === c.id ? undefined : c.id;
              setCategoryId(next);
              refetch({ q, sort, categoryId: next });
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          No products found. Ask the assistant in chat!
        </p>
      ) : (
        <div
          className={
            modern
              ? 'grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4'
              : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'
          }
        >
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => openBuy(p.id)}
              className={`group flex flex-col rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 ${
                modern ? 'overflow-hidden hover:shadow-lg' : 'hover:shadow-md'
              }`}
            >
              <div
                className={`${modern ? 'aspect-[3/4]' : 'aspect-square'} w-full overflow-hidden bg-zinc-100`}
              >
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-300">
                    🛍️
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="font-semibold" style={{ color: accent }}>
                  {taka(p.price)}
                </span>
                <span className="text-xs text-zinc-400">
                  {p.variants.reduce((s, v) => s + v.stock, 0)} in stock
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {buyTarget ? (
        <OrderModal
          key={buyTarget.product.id}
          product={buyTarget.product}
          onClose={() => setBuyTarget(null)}
          slug={slug}
          accent={accent}
        />
      ) : null}
    </main>
  );
}

function OrderModal({
  product,
  onClose,
  slug,
  accent,
}: {
  product: ProductPublic;
  onClose: () => void;
  slug: string;
  accent: string;
}) {
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const unit = useMemo(() => {
    const v = product.variants.find((x) => x.id === variantId);
    return v?.priceOverride ?? product.price;
  }, [product, variantId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = createOrderInputSchema.safeParse({
      items: [{ productId: product.id, ...(variantId ? { variantId } : {}), qty }],
      customer: { name, phone, address },
      ...(note ? { note } : {}),
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Invalid order details');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<unknown>(`/s/${slug}/orders`, { body: input.data });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  const total = unit * qty;
  return (
    <Modal open onClose={onClose} title={done ? 'Order placed 🎉' : 'Order details'}>
      {done ? (
        <div className="flex flex-col gap-4 text-sm">
          <p>
            ধন্যবাদ! Your cash-on-delivery order is placed. The shop will call you on{' '}
            <span className="font-medium">{phone}</span> to confirm.
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : null}
            <div>
              <div className="text-sm font-medium">{product.name}</div>
              <div className="text-sm" style={{ color: accent }}>
                {taka(unit)} × {qty} = <span className="font-semibold">{taka(total)}</span>
              </div>
            </div>
          </div>

          {product.variants.filter((v) => v.stock > 0).length > 0 ? (
            <Field label="Size / color">
              <select
                value={variantId ?? ''}
                onChange={(e) => setVariantId(e.target.value || undefined)}
                className={inputClass}
              >
                <option value="">Choose…</option>
                {product.variants
                  .filter((v) => v.stock > 0)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.size, v.color].filter(Boolean).join(' · ')} —{' '}
                      {taka(v.priceOverride ?? product.price)} ({v.stock} left)
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}

          <Field label="Quantity">
            <input
              type="number"
              min={1}
              max={20}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className={inputClass}
            />
          </Field>
          <Field label="Your name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Address">
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={inputClass}
              required
              minLength={5}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              maxLength={500}
            />
          </Field>
          <ErrorNote message={error} />
          <div className="flex items-center justify-between">
            <Badge tone="green">Cash on delivery</Badge>
            <Button type="submit" disabled={busy}>
              {busy ? 'Placing…' : `Place COD order · ${taka(total)}`}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ──────────────────────────── AI chat widget ───────────────────────────── */

interface ChatMsg {
  role: 'user' | 'assistant' | 'error';
  text: string;
  cards?: ChatProductCard[];
  streaming?: boolean;
}

function ChatWidget({ shop, accent }: { shop: Storefront; accent: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>(() =>
    shop.ai.enabled && shop.ai.greeting ? [{ role: 'assistant', text: shop.ai.greeting }] : [],
  );
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs, open, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !shop.ai.enabled) return;
    setDraft('');
    setBusy(true);
    setMsgs((m) => [
      ...m,
      { role: 'user', text },
      { role: 'assistant', text: '', streaming: true },
    ]);

    const onEvent = (ev: ChatEvent) => {
      if (ev.type === 'start') {
        setConversationId(ev.conversationId);
        return;
      }
      if (ev.type === 'token') {
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last?.role !== 'assistant') return m;
          return [...m.slice(0, -1), { ...last, text: last.text + ev.text }];
        });
        return;
      }
      if (ev.type === 'cards') {
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last?.role === 'assistant') return [...m.slice(0, -1), { ...last, cards: ev.cards }];
          return [...m, { role: 'assistant', text: '', cards: ev.cards }];
        });
        return;
      }
      if (ev.type === 'done') {
        setMsgs((m) => {
          const last = m[m.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...m.slice(0, -1), { ...last, streaming: false }];
          }
          return m;
        });
        return;
      }
      if (ev.type === 'error') setMsgs((m) => [...m, { role: 'error', text: ev.message }]);
    };

    try {
      await streamChat(
        {
          shopSlug: shop.shop.slug,
          message: text,
          visitorId: visitorId(),
          ...(conversationId ? { conversationId } : {}),
        },
        onEvent,
      );
    } finally {
      setBusy(false);
      setMsgs((m) => {
        const last = m[m.length - 1];
        if (last?.role === 'assistant' && !last.text && !last.cards && last.streaming) {
          return [...m.slice(0, -1), { role: 'assistant', text: '…', streaming: false }];
        }
        return m;
      });
    }
  };

  if (!shop.ai.enabled) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white shadow-lg transition hover:scale-105"
          style={{ backgroundColor: accent }}
          aria-label="Chat with the AI assistant"
        >
          💬
        </button>
      ) : null}

      {open ? (
        <div className="fixed right-3 bottom-3 z-40 flex h-[min(560px,80vh)] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:right-5 sm:bottom-5">
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: accent }}
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold">AI assistant</span>
              <span className="text-[11px] text-white/80">{shop.shop.name}</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-white/80 hover:bg-white/20"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-zinc-50 p-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                {m.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 px-3 py-2 text-sm text-white">
                    {m.text}
                  </div>
                ) : m.role === 'error' ? (
                  <div className="max-w-[90%] rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    {m.text}
                  </div>
                ) : (
                  <div className="flex max-w-[92%] flex-col gap-2">
                    <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm ring-1 ring-zinc-100">
                      {m.text}
                      {m.streaming ? (
                        <span className="ml-0.5 inline-block animate-pulse">▍</span>
                      ) : null}
                    </div>
                    {m.cards?.length ? (
                      <div className="grid grid-cols-2 gap-2">
                        {m.cards.map((c) => (
                          <ChatCard key={c.id} card={c} accent={accent} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-200 p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
              }}
              placeholder="Message… (বাংলা / English / Banglish)"
              className="flex-1 rounded-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ backgroundColor: accent }}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChatCard({ card, accent }: { card: ChatProductCard; accent: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="aspect-square w-full bg-zinc-100">
        {card.image ? (
          <img src={card.image} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-300">
            🛍️
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <span className="line-clamp-2 text-[11px] font-medium leading-tight">{card.name}</span>
        <span className="text-xs font-bold" style={{ color: accent }}>
          {taka(card.price)}
        </span>
        {card.stock !== null && card.stock !== undefined ? (
          <span className="text-[10px] text-zinc-400">{card.stock} in stock</span>
        ) : null}
      </div>
    </div>
  );
}
