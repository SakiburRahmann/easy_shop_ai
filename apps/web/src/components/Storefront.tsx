'use client';

/**
 * Customer storefront: shop branding, catalog with search/filters, COD order
 * flow, and the AI sales agent chat. Product data rendered here ALWAYS comes
 * from API responses (public storefront payload and chat `cards` events) —
 * never from model text.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
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
import { Icon } from '@/lib/icons';
import {
  Button,
  CardSkeletonGrid,
  ErrorNote,
  Field,
  Modal,
  Skeleton,
  inputClass,
} from '@/components/ui';

function slugFromPath(): string {
  // Canonical storefront URL: /s?shop=<slug>. The pretty form /s/<slug>
  // still parses for future custom-domain deployments.
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

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-[#f7f7f6]">
        <Skeleton className="h-[76px] w-full rounded-none" />
        <div className="mx-auto w-full max-w-5xl px-5 py-10">
          <CardSkeletonGrid count={8} />
        </div>
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon.Store size={22} />
        </div>
        <h1 className="text-lg font-semibold">Shop not found</h1>
        <p className="text-sm text-zinc-500">No storefront lives at this address.</p>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <Icon.ArrowLeft size={14} />
          Back to the marketplace
        </Link>
      </div>
    );
  }

  const accent = data.shop.theme.primaryColor ?? '#059669';

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f7f6]">
      {/* Header */}
      <header
        className="sticky top-0 z-30 text-white shadow-sm"
        style={{ backgroundColor: accent }}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/15 text-lg font-bold backdrop-blur">
            {data.shop.logoUrl ? (
              <img src={data.shop.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              data.shop.name.slice(0, 1)
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-lg font-bold leading-tight">{data.shop.name}</h1>
            {data.shop.description ? (
              <p className="line-clamp-1 text-[13px] text-white/80">{data.shop.description}</p>
            ) : null}
          </div>
          {data.shop.contact.phone ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-medium backdrop-blur sm:flex">
              <Icon.Phone size={13} />
              {data.shop.contact.phone}
            </span>
          ) : null}
          {data.shop.policies.returnPolicy ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur lg:flex">
              <Icon.Shield size={13} />
              Returns accepted
            </span>
          ) : null}
        </div>
      </header>

      <Catalog data={data} slug={slug} accent={accent} />

      <footer className="border-t border-zinc-200/80 bg-white px-5 py-6 text-center text-xs text-zinc-400">
        {data.shop.policies.notes ? (
          <p className="mx-auto mb-1.5 max-w-2xl whitespace-pre-line text-zinc-500">
            {data.shop.policies.notes}
          </p>
        ) : null}
        <p>
          {data.shop.name} · shop on{' '}
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            EasyShopAI
          </Link>
        </p>
      </footer>

      <ChatWidget shop={data} accent={accent} />
    </div>
  );
}

/* ─────────────────────────── catalog + orders ──────────────────────────── */

interface BuyTarget {
  product: ProductPublic;
}

type Filters = { q?: string; categoryId?: string; sort?: string };

function Catalog({ data, slug, accent }: { data: Storefront; slug: string; accent: string }) {
  const [products, setProducts] = useState<ProductPublic[] | null>(data.products);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [buyTarget, setBuyTarget] = useState<BuyTarget | null>(null);
  const modern = data.shop.templateId === 'modern';

  const refetch = useCallback(
    (next?: Filters) => {
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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      {modern ? (
        <section
          className="mb-9 overflow-hidden rounded-3xl px-8 py-12 text-white shadow-lg"
          style={
            {
              background: `linear-gradient(125deg, ${accent} 0%, #17181acc 65%)`,
            } as React.CSSProperties
          }
        >
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            {data.shop.name} · নতুন কালেকশন
          </span>
          <h2 className="mt-4 max-w-xl text-3xl font-bold leading-snug tracking-tight">
            {data.shop.description || 'Explore our latest collection — curated for you.'}
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {data.categories.length > 0 ? (
              <span>
                {data.categories
                  .slice(0, 4)
                  .map((c) => c.name)
                  .join(' · ')}{' '}
                — and more.
              </span>
            ) : null}{' '}
            Ask the assistant anything — prices, sizes, delivery.
          </p>
        </section>
      ) : null}

      {/* Filter bar */}
      <div className="mb-7 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Icon.Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refetch({ q, sort, categoryId })}
            placeholder="Search products…"
            className={`${inputClass} w-64 pl-9`}
          />
        </div>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              refetch({ q, sort: e.target.value, categoryId });
            }}
            className={`${inputClass} w-auto appearance-none pr-9`}
            aria-label="Sort products"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
          <Icon.Chevron
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
        </div>
        <div className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block" />
        {data.categories.map((c) => (
          <button
            key={c.id}
            style={
              categoryId === c.id
                ? { backgroundColor: accent, color: 'white', borderColor: accent }
                : undefined
            }
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              categoryId === c.id
                ? 'shadow-sm'
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
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
        <CardSkeletonGrid />
      ) : !products?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-16 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: accent }}
          >
            <Icon.Package size={20} />
          </div>
          <p className="text-sm font-semibold text-zinc-700">No products found</p>
          <p className="max-w-xs text-xs text-zinc-500">
            Ask the AI assistant in chat — it knows the full catalog.
          </p>
        </div>
      ) : (
        <div
          className={`grid ${modern ? 'grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'}`}
        >
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => openBuy(p.id)}
              className="group text-left"
              aria-label={`View ${p.name}`}
            >
              <div
                className={`relative w-full overflow-hidden rounded-2xl bg-zinc-100 ${
                  modern
                    ? 'aspect-[3/4] shadow-md shadow-zinc-900/[0.06]'
                    : 'aspect-square shadow-sm'
                }`}
              >
                {p.images[0] ? (
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    style={modern ? undefined : { filter: 'saturate(1.02)' }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-300">
                    <Icon.Package size={28} />
                  </div>
                )}
                {modern ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-0 transition group-hover:opacity-100"
                    style={{ background: `linear-gradient(to top, ${accent}d9, transparent)` }}
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5 px-0.5 pt-3">
                <span
                  className={`line-clamp-2 font-medium text-zinc-800 ${modern ? 'text-[13px] leading-snug' : 'text-[13px]'}`}
                >
                  {p.name}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-[15px] font-bold" style={{ color: accent }}>
                    {taka(p.price)}
                  </span>
                  {p.variants.length > 1 ? (
                    <span className="text-[11px] text-zinc-400">
                      {p.variants.reduce((s, v) => s + v.stock, 0)} in stock
                    </span>
                  ) : null}
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
  const variantOpts = product.variants.filter((v) => v.stock > 0);

  return (
    <Modal open onClose={onClose} title={done ? 'Order placed' : 'Order details'} wide>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <Icon.Check size={26} />
          </div>
          <h4 className="text-base font-semibold">ধন্যবাদ! Order confirmed pending</h4>
          <p className="max-w-sm text-sm text-zinc-500">
            Your cash-on-delivery order is in. The shop will call you on{' '}
            <span className="font-medium text-zinc-800">{phone}</span> to confirm.
          </p>
          <Button variant="ghost" onClick={onClose} className="mt-2">
            Done
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          {/* product summary */}
          <div className="flex flex-col gap-2">
            <div className="aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100">
              {product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-zinc-300">
                  <Icon.Package size={24} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold leading-snug">{product.name}</span>
              <span className="text-sm font-bold" style={{ color: accent }}>
                {taka(unit)}
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-brand-700">
              <Icon.Truck size={13} /> Cash on delivery
            </p>
          </div>

          {/* form */}
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            {variantOpts.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-zinc-700">Size / color</span>
                <div className="flex flex-wrap gap-1.5">
                  {variantOpts.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id === variantId ? undefined : v.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        variantId === v.id
                          ? 'text-white shadow-sm'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                      }`}
                      style={
                        variantId === v.id
                          ? { backgroundColor: accent, borderColor: accent }
                          : undefined
                      }
                    >
                      {[v.size, v.color].filter(Boolean).join(' · ') || '—'} ·{' '}
                      {taka(v.priceOverride ?? product.price)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-zinc-700">Quantity</span>
              <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
                  disabled={qty <= 1}
                >
                  <Icon.Minus size={14} />
                </button>
                <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((n) => Math.min(20, n + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
                  disabled={qty >= 20}
                >
                  <Icon.Plus size={14} />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <Field label="Delivery address">
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
                placeholder="e.g. deliver in the evening"
              />
            </Field>

            <ErrorNote message={error} />

            <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-3">
              <span className="text-sm text-zinc-500">
                Total <span className="text-zinc-300">·</span> {taka(unit)} × {qty}
              </span>
              <span className="text-lg font-bold" style={{ color: accent }}>
                {taka(total)}
              </span>
            </div>
            <Button
              type="submit"
              size="lg"
              onClick={undefined}
              disabled={busy}
              className="w-full"
              icon={<Icon.Bag size={16} />}
            >
              {busy ? 'Placing order…' : `Place COD order`}
            </Button>
          </form>
        </div>
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
    if (open) {
      // Defer to next frame via rAF so scrolling follows render.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
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
          className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-4 py-3.5 text-sm font-semibold text-white shadow-xl transition hover:scale-[1.03] active:scale-95"
          style={{ backgroundColor: accent, boxShadow: `0 10px 30px -6px ${accent}66` }}
          aria-label="Chat with the AI agent"
        >
          <Icon.Chat size={18} />
          <span className="hidden sm:inline">Ask the AI agent</span>
          <span
            className="absolute inset-0 -z-10 animate-ping rounded-full opacity-[0.07]"
            style={{ backgroundColor: accent }}
          />
        </button>
      ) : null}

      {open ? (
        <div
          className="pop-in fixed bottom-3 right-3 z-40 flex h-[min(600px,86vh)] w-[min(392px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-2xl sm:bottom-5 sm:right-5"
          role="dialog"
          aria-label="AI agent chat"
        >
          {/* header */}
          <div
            className="flex items-center gap-3 px-4 py-3.5 text-white"
            style={{ backgroundColor: accent }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Icon.Spark size={17} />
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold leading-tight">AI agent</span>
              <span className="text-[11px] text-white/75">instant replies · COD orders</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-white/85 transition hover:bg-white/15"
            >
              <Icon.X size={17} />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7f7f6] px-3 py-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                {m.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {m.text}
                  </div>
                ) : m.role === 'error' ? (
                  <div className="flex max-w-[92%] items-start gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    <Icon.Alert size={13} className="mt-0.5 shrink-0" />
                    {m.text}
                  </div>
                ) : (
                  <div className="flex max-w-[94%] flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: accent }}
                      >
                        <Icon.Spark size={12} />
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-zinc-200/70 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 shadow-sm">
                        {m.text}
                        {m.streaming ? (
                          <span className="ml-0.5 inline-flex items-center gap-0.5 align-middle">
                            <span
                              className="h-1 w-1 animate-bounce rounded-full bg-zinc-400"
                              style={{ animationDelay: '0ms' }}
                            />
                            <span
                              className="h-1 w-1 animate-bounce rounded-full bg-zinc-400"
                              style={{ animationDelay: '150ms' }}
                            />
                            <span
                              className="h-1 w-1 animate-bounce rounded-full bg-zinc-400"
                              style={{ animationDelay: '300ms' }}
                            />
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {m.cards?.length ? (
                      <div
                        className={`grid gap-2 ${m.cards.length === 1 ? 'max-w-[70%]' : 'grid-cols-2'}`}
                      >
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

          {/* composer */}
          <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
              }}
              placeholder="বাংলা / English / Banglish…"
              className="h-10 flex-1 rounded-full border border-zinc-200 bg-[#f7f7f6] px-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ backgroundColor: accent }}
              aria-label="Send message"
            >
              <Icon.Send size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChatCard({ card, accent }: { card: ChatProductCard; accent: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-sm transition hover:shadow-md">
      <div className="aspect-square w-full bg-zinc-100">
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Icon.Package size={22} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-800">
          {card.name}
        </span>
        <span className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-bold" style={{ color: accent }}>
            {taka(card.price)}
          </span>
          {card.stock !== null && card.stock !== undefined ? (
            <span className="text-[10px] text-zinc-400">{card.stock} left</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
