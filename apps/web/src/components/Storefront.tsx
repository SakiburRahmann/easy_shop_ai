'use client';

/**
 * Customer storefront, matched to the reference: photographic banner, shop
 * identity row with tabs, a three-panel featured collection, the full product
 * grid and the shop's AI agent. Product data always comes from API responses —
 * never from model text.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  storefrontSchema,
  type ChatEvent,
  type ChatProductCard,
  type Storefront as StorefrontPayload,
} from '@easyshop/shared';
import { ApiError, api, streamChat, money, visitorId } from '@/lib/api';
import { useShopCartUnits } from '@/lib/cart';
import { SiteFooter, SiteHeader } from '@/components/site/header';
import { ProductTile } from '@/components/market/product-tile';
import { photo, poolFor, rotate, seedHash } from '@/components/storefront/image-library';
import { Icon } from '@/lib/icons';
import { Button, CardSkeletonGrid, Skeleton } from '@/components/ui';

function readSlug(): string {
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search);
  const match = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  return search.get('shop') ?? (match ? decodeURIComponent(match[1]) : '');
}

export default function Storefront() {
  const router = useRouter();
  const [slug] = useState(readSlug);
  const [data, setData] = useState<StorefrontPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [chatOpen, setChatOpen] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('chat') === '1',
  );

  const cartUnits = useShopCartUnits(slug);

  useEffect(() => {
    if (!slug) {
      void Promise.resolve().then(() => {
        setNotFound(true);
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    api<unknown>(`/s/${slug}`)
      .then((raw) => {
        if (cancelled) return;
        const parsed = storefrontSchema.safeParse(raw);
        if (parsed.success) setData(parsed.data);
        else setNotFound(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
        else setLoadError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /** Legacy marketplace deep link: /s?shop=x&product=y → product screen. */
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    const productId = new URLSearchParams(window.location.search).get('product');
    if (productId && slug) {
      redirected.current = true;
      router.replace(`/product?id=${productId}&shop=${slug}`);
    }
  }, [router, slug]);

  const openProduct = (productId: string) =>
    router.push(`/product?id=${productId}&shop=${slug}`);

  const visibleProducts = useMemo(() => {
    const list = [...(data?.products ?? [])];
    if (sortBy === 'price_asc') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'price_desc') list.sort((a, b) => b.price - a.price);
    if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [data, sortBy]);

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-white">
        <Skeleton className="h-16 w-full rounded-none" />
        <div className="mx-auto w-full max-w-[1120px] px-5 py-8">
          <CardSkeletonGrid count={8} />
        </div>
      </div>
    );
  }

  if (notFound || loadError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon.Store size={22} />
        </div>
        <h1 className="text-[17px] font-bold tracking-tight">
          {loadError ? 'Shop unavailable' : 'Shop not found'}
        </h1>
        <p className="max-w-sm text-[13px] text-muted">
          {loadError
            ? 'We could not reach this store. Check the API connection and try again.'
            : 'No storefront lives at this address.'}
        </p>
        {loadError ? (
          <Button onClick={() => window.location.reload()}>Try again</Button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:underline"
          >
            <Icon.ArrowLeft size={14} />
            Back to the marketplace
          </Link>
        )}
      </div>
    );
  }

  const primary = data.shop.theme.primaryColor ?? '#2f5bf0';
  const accent = data.shop.theme.accentColor ?? '#f59e0b';
  const tagline =
    {
      fashion: ['Style that feels like you.', 'Everyday', 'Style', 'Simple.', 'Comfort.', 'You.'],
      electronics: ['Sound that moves with you.', 'Everyday', 'Sound', 'Clear.', 'Crisp.', 'Sound.'],
      home: ['Home feels better here.', 'Everyday', 'Comforts', 'Simple.', 'Natural.', 'Home.'],
      beauty: ['Care for your everyday glow.', 'Everyday', 'Care', 'Glow.', 'Soft.', 'Daily.'],
      groceries: ['Fresh picks, delivered.', 'Everyday', 'Fresh', 'Fresh.', 'Local.', 'Daily.'],
      kids: ['Made for little adventures.', 'Everyday', 'Play', 'Play.', 'Learn.', 'Grow.'],
      other: ['Thoughtful things, chosen well.', 'Everyday', 'Finds', 'Made.', 'With.', 'Care.'],
    }[data.shop.businessType] ?? ['Home feels better here.', 'Everyday', 'Comforts', 'Simple.', 'Natural.', 'Home.'];
  const pool = poolFor(data.shop.businessType);
  const heroPhoto = photo(rotate(pool.hero, seedHash(slug))[0] ?? pool.hero[0], 1600, 520);
  const lookA = photo(pool.looks[0] ?? pool.hero[0], 900, 620);
  const lookB = photo(pool.looks[1] ?? pool.looks[0] ?? pool.hero[0], 700, 460);
  const zones = data.shop.deliveryRules.zones;
  const shopInitial = data.shop.name.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-12">
        {/* ───────────────────────────── banner ───────────────────────────── */}
        <div className="relative mt-4 h-[190px] overflow-hidden rounded-xl">
          <img src={heroPhoto} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#eef1ec]/90 via-[#eef1ec]/35 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center px-7 sm:px-9">
            <h1 className="max-w-[16ch] text-[30px] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#173a2e] sm:text-[34px]">
              {data.shop.name}
            </h1>
            <p className="mt-2 max-w-[34ch] text-[12px] leading-relaxed text-[#3f5b4f]">
              {data.shop.description ||
                'Thoughtful essentials for a more comfortable home, delivered with care.'}
            </p>
          </div>
          <p className="absolute right-7 top-1/2 hidden max-w-[12ch] -translate-y-1/2 text-right text-[21px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#173a2e] md:block">
            {tagline[0]}
          </p>
        </div>

        {/* ─────────────────────────── identity row ───────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 border-b border-line py-4">
          <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dbe4dc] bg-[#e6ece7] text-[20px] font-bold text-[#173a2e]">
            {data.shop.logoUrl ? (
              <img src={data.shop.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              shopInitial
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.035em] text-ink">
              {data.shop.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
              <span>
                {data.products.length} product{data.products.length === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span>Cash on delivery</span>
              <span>·</span>
              <span>{data.categories.length} collections</span>
            </p>
          </div>

          <nav className="order-last flex w-full items-center gap-7 border-t border-line pt-3 text-[12.5px] font-semibold text-ink/70 sm:order-none sm:mx-auto sm:w-auto sm:border-0 sm:pt-0">
            <button
              type="button"
              onClick={() =>
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="-mb-px border-b-2 border-brand-600 pb-2 text-brand-600 sm:pb-1"
            >
              Products
            </button>
            <Link href="#about-shop" className="pb-2 text-ink/60 transition hover:text-ink sm:pb-1">
              About
            </Link>
            {data.ai.enabled ? (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="pb-2 text-ink/60 transition hover:text-ink sm:pb-1"
              >
                Ask AI
              </button>
            ) : null}
          </nav>

          <Link
            href={`/cart?shop=${slug}`}
            className="ml-auto hidden h-10 shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-700 sm:flex"
          >
            <Icon.Bag size={14} />
            View cart{cartUnits > 0 ? ` (${cartUnits})` : ''}
          </Link>
        </div>

        {/* ─────────────────────── featured collection ────────────────────── */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
            Featured collection
          </h2>
          <button
            type="button"
            onClick={() =>
              document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-600 hover:text-brand-700"
          >
            View collection
            <Icon.ArrowRight size={12} />
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[300px_minmax(0,1fr)_276px]">
          <div className="flex flex-col justify-between rounded-lg bg-[#e3ece7] p-5">
            <div>
              <p className="text-[19px] font-extrabold leading-[1.15] tracking-[-0.03em] text-[#173a2e]">
                {tagline[1]}
                <br />
                {tagline[2]}
              </p>
              <p className="mt-1.5 max-w-[22ch] text-[11px] leading-relaxed text-[#3f5b4f]">
                Timeless pieces for the spaces you love.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })
              }
              className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[11px] font-semibold text-white transition hover:bg-brand-700"
            >
              Shop the collection
              <Icon.ArrowRight size={12} />
            </button>
          </div>
          <img
            src={lookA}
            alt=""
            aria-hidden="true"
            className="h-[190px] w-full rounded-lg object-cover md:h-[210px]"
          />
          <div className="relative overflow-hidden rounded-lg">
            <img
              src={lookB}
              alt=""
              aria-hidden="true"
              className="h-[190px] w-full object-cover md:h-[210px]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />
            <p className="absolute left-5 top-5 text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] text-white">
              {tagline[3]}
              <br />
              {tagline[4]}
              <br />
              {tagline[5]}
            </p>
          </div>
        </div>

        {/* ─────────────────────────── all products ───────────────────────── */}
        <div id="catalog" className="mt-7 flex scroll-mt-24 items-end justify-between gap-3">
          <h2 className="text-[16px] font-extrabold tracking-[-0.025em] text-ink">All products</h2>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-line px-3">
            <span className="text-[11px] text-muted">Sort by</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              aria-label="Sort products"
              className="w-[100px] cursor-pointer appearance-none bg-transparent text-[11.5px] font-semibold text-ink outline-none"
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
            <Icon.Chevron size={12} className="text-muted" />
          </label>
        </div>

        {visibleProducts.length === 0 ? (
          <p className="mt-5 rounded-lg bg-wash px-4 py-10 text-center text-[12.5px] text-muted">
            This shop has not listed any products yet.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
            {visibleProducts.map((item) => (
              <ProductTile
                key={item.id}
                product={item}
                href={`/product?id=${item.id}&shop=${slug}`}
              />
            ))}
          </div>
        )}

        {/* ───────────────────────────── about ────────────────────────────── */}
        <section
          id="about-shop"
          className="mt-10 grid scroll-mt-24 gap-6 border-t border-line pt-7 md:grid-cols-[1.3fr_0.7fr]"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              About this shop
            </p>
            <h2 className="mt-2 text-[20px] font-extrabold tracking-[-0.03em] text-ink">
              {data.shop.name}
            </h2>
            <p className="mt-2 max-w-[62ch] text-[12.5px] leading-[1.7] text-ink-soft/85">
              {data.shop.description ||
                data.shop.policies.notes ||
                'A small shop on EasyShopAI. Ask the AI assistant anything about the catalog.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11.5px] text-muted">
              {data.shop.contact.phone ? (
                <span className="flex items-center gap-1.5">
                  <Icon.Phone size={12} /> {data.shop.contact.phone}
                </span>
              ) : null}
              {data.shop.contact.email ? (
                <span className="flex items-center gap-1.5">
                  <Icon.Globe size={12} /> {data.shop.contact.email}
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg bg-wash p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/60">
              Delivery
            </p>
            {zones.length ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {zones.map((zone) => (
                  <li
                    key={zone.name}
                    className="flex items-center justify-between text-[12px] text-ink"
                  >
                    <span>{zone.name}</span>
                    <span className="text-muted">
                      {money(zone.charge)} · {zone.etaDays}d
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-muted">Confirmed by the shop on the phone.</p>
            )}
            <p className="mt-3 border-t border-line pt-3 text-[11.5px] leading-relaxed text-muted">
              {data.shop.policies.returnPolicy || 'Ask the shop about returns before ordering.'}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />

      <ChatWidget
        shop={data}
        primary={primary}
        accent={accent}
        open={chatOpen}
        onOpenChange={setChatOpen}
        onSelectProduct={openProduct}
      />
    </div>
  );
}

/* ──────────────────────────── AI chat widget ───────────────────────────── */

interface ChatMsg {
  role: 'user' | 'assistant' | 'error';
  text: string;
  cards?: ChatProductCard[];
  streaming?: boolean;
}

function ChatWidget({
  shop,
  primary,
  accent,
  open,
  onOpenChange,
  onSelectProduct,
}: {
  shop: StorefrontPayload;
  primary: string;
  accent: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProduct: (productId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>(() =>
    shop.ai.enabled && shop.ai.greeting ? [{ role: 'assistant', text: shop.ai.greeting }] : [],
  );
  const conversationKey = `easyshopai.conv.${shop.shop.slug}`;
  const [conversationId, setConversationId] = useState<string | undefined>(() =>
    typeof window === 'undefined'
      ? undefined
      : (window.localStorage.getItem(conversationKey) ?? undefined),
  );
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
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
    setMsgs((current) => [
      ...current,
      { role: 'user', text },
      { role: 'assistant', text: '', streaming: true },
    ]);

    const onEvent = (event: ChatEvent) => {
      if (event.type === 'start') {
        setConversationId(event.conversationId);
        try {
          window.localStorage.setItem(conversationKey, event.conversationId);
        } catch {
          /* storage may be unavailable */
        }
        return;
      }
      if (event.type === 'token') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role !== 'assistant') return current;
          return [...current.slice(0, -1), { ...last, text: last.text + event.text }];
        });
        return;
      }
      if (event.type === 'cards') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role === 'assistant') {
            return [...current.slice(0, -1), { ...last, cards: event.cards }];
          }
          return [...current, { role: 'assistant', text: '', cards: event.cards }];
        });
        return;
      }
      if (event.type === 'done') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...current.slice(0, -1), { ...last, streaming: false }];
          }
          return current;
        });
        return;
      }
      if (event.type === 'error') {
        setMsgs((current) => [...current, { role: 'error', text: event.message }]);
      }
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
      setMsgs((current) => {
        const last = current[current.length - 1];
        if (last?.role === 'assistant' && !last.text && !last.cards && last.streaming) {
          return [...current.slice(0, -1), { role: 'assistant', text: '…', streaming: false }];
        }
        return current;
      });
    }
  };

  if (!shop.ai.enabled) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => onOpenChange(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_18px_36px_-16px_rgba(14,20,36,.55)] transition hover:brightness-110 sm:bottom-7 sm:right-7"
          style={{ backgroundColor: primary }}
          aria-label={`Chat with ${shop.shop.name}`}
        >
          <Icon.Spark size={16} />
          Ask the shop AI
        </button>
      ) : null}

      {open ? (
        <div
          className="pop-in fixed bottom-3 right-3 z-40 flex h-[min(620px,88vh)] max-h-[88dvh] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl sm:bottom-5 sm:right-5"
          role="dialog"
          aria-label="AI agent chat"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold text-white"
              style={{ backgroundColor: primary }}
            >
              {shop.shop.name.slice(0, 1)}
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[13px] font-bold leading-tight text-ink">
                {shop.shop.name} assistant
              </span>
              <span className="text-[11px] text-muted">Stock, prices and cash on delivery</span>
            </div>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 text-muted transition hover:bg-wash hover:text-ink"
            >
              <Icon.X size={17} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-wash px-3 py-4"
          >
            {msgs.map((message, index) => (
              <div
                key={index}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                {message.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {message.text}
                  </div>
                ) : message.role === 'error' ? (
                  <div className="flex max-w-[92%] items-start gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    <Icon.Alert size={13} className="mt-0.5 shrink-0" />
                    {message.text}
                  </div>
                ) : (
                  <div className="flex max-w-[94%] flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: primary }}
                      >
                        {shop.shop.name.slice(0, 1)}
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink shadow-sm">
                        {message.text}
                        {message.streaming ? (
                          <span className="ml-0.5 inline-flex items-center gap-0.5 align-middle">
                            {['0ms', '150ms', '300ms'].map((delay) => (
                              <span
                                key={delay}
                                className="h-1 w-1 animate-bounce rounded-full bg-zinc-400"
                                style={{ animationDelay: delay }}
                              />
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {message.cards?.length ? (
                      <div
                        className={`grid gap-2 ${
                          message.cards.length === 1 ? 'max-w-[70%]' : 'grid-cols-2'
                        }`}
                      >
                        {message.cards.map((card) => (
                          <ChatCard
                            key={card.id}
                            card={card}
                            primary={primary}
                            onSelect={() => onSelectProduct(card.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-line bg-white px-3 py-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
              }}
              placeholder="Ask about stock, prices or delivery…"
              className="h-10 flex-1 rounded-full border border-line bg-wash px-4 text-[13px] outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ backgroundColor: primary }}
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

function ChatCard({
  card,
  primary,
  onSelect,
}: {
  card: ChatProductCard;
  primary: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="overflow-hidden rounded-2xl border border-line bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`View ${card.name}`}
    >
      <div className="aspect-square w-full bg-wash">
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
        <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-ink">
          {card.name}
        </span>
        <span className="flex items-center justify-between gap-1">
          <span className="text-[12.5px] font-bold" style={{ color: primary }}>
            {money(card.price)}
          </span>
          {card.stock !== null && card.stock !== undefined ? (
            <span
              className={`text-[10px] ${card.stock > 0 ? 'text-muted' : 'font-semibold text-red-500'}`}
            >
              {card.stock > 0 ? `${card.stock} left` : 'sold out'}
            </span>
          ) : null}
        </span>
      </div>
    </button>
  );
}
