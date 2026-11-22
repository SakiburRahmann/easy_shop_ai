'use client';

/**
 * Customer storefront. The seller's applied theme (or the `templateId` house
 * preset) drives the whole composition: header architecture, hero style,
 * catalogue density and type pairing come from `visualsFromStorefront`, and
 * the section registry renders the preset's ordered blocks. Product data
 * always comes from API responses — never from model text.
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
import { SiteFooter } from '@/components/site/header';
import { Icon } from '@/lib/icons';
import { Button, CardSkeletonGrid, Skeleton } from '@/components/ui';
import { TEMPLATE_VISUALS, storefrontFont } from '@/components/storefront/templates';
import {
  storefrontOf,
  visualsFromStorefront,
  type ThemeVisuals,
} from '@/components/storefront/theme';
import { StorefrontHeader } from '@/components/storefront/header';
import { StorefrontCatalog } from '@/components/storefront/catalog';
import { decorFor } from '@/components/storefront/decor';
import {
  AnnouncementBar,
  CategoryCollage,
  CategoryIndex,
  CollageHero,
  EditorialHero,
  FeaturedRail,
  IntroStrip,
  PoliciesSection,
  StoryBand,
  TrustRow,
} from '@/components/storefront/sections';

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
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
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

  const openProduct = (productId: string) => router.push(`/product?id=${productId}&shop=${slug}`);
  const goCatalog = () =>
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });

  /** The seller's applied theme, or the templateId house preset as fallback. */
  const visuals: ThemeVisuals | null = useMemo(() => {
    if (!data) return null;
    const applied = storefrontOf(data);
    if (applied) return visualsFromStorefront(applied);
    return {
      ...TEMPLATE_VISUALS[data.shop.templateId],
      radius: 'soft' as const,
      density: 'balanced' as const,
      copy: { ctaLabel: 'Browse the catalog', headline: '' },
    };
  }, [data]);

  const decor = useMemo(() => (data ? decorFor(data.shop) : null), [data]);

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

  if (notFound || loadError || !data || !visuals || !decor) {
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

  const shop = data.shop;
  const primary = shop.storefront?.tokens.primary ?? shop.theme.primaryColor ?? '#2f5bf0';
  const accent = shop.storefront?.tokens.accent ?? shop.theme.accentColor ?? '#f59e0b';
  const font = storefrontFont(shop.theme.font, visuals.display);
  const ink = visuals.ink;
  const muted = visuals.muted;
  const copy = visuals.copy;
  const products = data.products;

  const openCart = () => router.push(`/cart?shop=${slug}`);

  const sectionFor = (section: string) => {
    switch (section) {
      case 'announcement':
        return (
          <AnnouncementBar
            key="announcement"
            shop={shop}
            primary={primary}
            announcement={copy.announcement}
          />
        );
      case 'intro':
        return (
          <IntroStrip
            key="intro"
            shop={shop}
            products={products}
            decor={decor}
            primary={primary}
            ink={ink}
            muted={muted}
            font={font}
            headline={copy.headline || undefined}
            subhead={copy.subhead}
            ctaLabel={copy.ctaLabel}
          />
        );
      case 'hero':
        if (visuals.hero === 'collage') {
          return (
            <CollageHero
              key="hero"
              shop={shop}
              products={products}
              decor={decor}
              primary={primary}
              font={font}
              headline={copy.headline || undefined}
              subhead={copy.subhead}
              ctaLabel={copy.ctaLabel}
            />
          );
        }
        return (
          <EditorialHero
            key="hero"
            shop={shop}
            products={products}
            decor={decor}
            primary={primary}
            ink={ink}
            muted={muted}
            font={font}
            headline={copy.headline || undefined}
            subhead={copy.subhead}
          />
        );
      case 'categoryCollage':
        return (
          <CategoryCollage
            key="categoryCollage"
            categories={data.categories}
            products={products}
            decor={decor}
            ink={ink}
            muted={muted}
            font={font}
            onPick={setCategoryId}
          />
        );
      case 'categoryIndex':
        return (
          <CategoryIndex
            key="categoryIndex"
            categories={data.categories}
            products={products}
            ink={ink}
            muted={muted}
            font={font}
            onPick={setCategoryId}
          />
        );
      case 'rail':
        return (
          <FeaturedRail
            key="rail"
            products={products}
            primary={primary}
            ink={ink}
            muted={muted}
            font={font}
            onOpen={openProduct}
            onViewAll={goCatalog}
          />
        );
      case 'story':
        return (
          <StoryBand
            key="story"
            shop={shop}
            decor={decor}
            primary={primary}
            font={font}
            story={copy.story}
          />
        );
      case 'trust':
        return <TrustRow key="trust" shop={shop} primary={primary} ink={ink} muted={muted} />;
      case 'policies':
        return <PoliciesSection key="policies" shop={shop} ink={ink} muted={muted} font={font} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ backgroundColor: visuals.surface }}
      data-es-radius={visuals.radius}
      data-es-density={visuals.density}
    >
      <StorefrontHeader
        data={data}
        preset={visuals}
        primary={primary}
        font={font}
        ink={ink}
        muted={muted}
        cartUnits={cartUnits}
        onCart={openCart}
        onPick={setCategoryId}
      />

      {visuals.sections.map((section) => sectionFor(section))}

      <StorefrontCatalog
        data={data}
        slug={slug}
        preset={visuals}
        primary={primary}
        font={font}
        ink={ink}
        muted={muted}
        categoryId={categoryId}
        onCategory={setCategoryId}
        onBuy={openProduct}
      />

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
          return [...current.slice(0, -1), { ...last, text: '…', streaming: false }];
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
