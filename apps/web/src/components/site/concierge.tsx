'use client';

/**
 * Marketplace guide — the buyer-facing entry point on marketplace surfaces
 * (home seller band, /shops). Unlike the per-shop assistant, this panel does
 * not run the Gemini agent: it searches the PUBLIC cross-shop catalog
 * (`GET /search/products`) and the shop directory (`GET /shops`) and hands the
 * buyer off to the right shop's AI (`/s?shop=slug&chat=1`). Every product,
 * price and shop shown comes from those API responses — the UI never invents
 * catalog facts (SPEC §8 guardrails).
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUSINESS_TYPE_PRESETS,
  marketplaceProductSchema,
  shopDirectoryItemSchema,
  type BusinessType,
  type MarketplaceProduct,
  type ShopDirectoryItem,
} from '@easyshop/shared';
import { api, money } from '@/lib/api';
import { Icon } from '@/lib/icons';

/** A shop as shown in guide cards — search results carry a lighter payload
 * than the directory (no contact / counts / images), so both fit this shape. */
interface GuideShop {
  name: string;
  slug: string;
  theme: ShopDirectoryItem['theme'];
  productCount?: number;
  topImages?: string[];
}

interface GuideMsg {
  role: 'user' | 'assistant';
  text: string;
  products?: MarketplaceProduct[];
  shops?: GuideShop[];
}

const CHIPS = ['Gifts under $50', 'Tech under $100', 'Show all shops'];

const TYPE_WORDS: Array<[RegExp, BusinessType]> = [
  [/\b(fashion|clothes?|shirt|dress|jacket|wear)\b/, 'fashion'],
  [/\b(tech|gadget|electronic|phone|earbud|headphone|audio|charger)\b/, 'electronics'],
  [/\b(home|kitchen|decor|lamp|furniture|planter|basket)\b/, 'home'],
  [/\b(beauty|skincare|cosmetic)\b/, 'beauty'],
  [/\b(grocer|food|snack|coffee)\b/, 'groceries'],
  [/\b(kids?|toy|baby)\b/, 'kids'],
];

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'for',
  'and',
  'with',
  'some',
  'any',
  'me',
  'my',
  'our',
  'show',
  'find',
  'need',
  'want',
  'get',
  'give',
  'buy',
  'looking',
  'under',
  'over',
  'below',
  'less',
  'than',
  'max',
  'budget',
  'around',
  'about',
  'please',
  'would',
  'could',
  'can',
  'you',
  'i',
  'of',
  'to',
  'in',
  'on',
  'gifts',
  'gift',
  'present',
  'options',
  'products',
  'product',
  'items',
  'tech',
  'electronics',
  'home',
  'fashion',
  'beauty',
  'groceries',
  'kids',
]);

export function MarketplaceGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<GuideMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Deferred like SiteHeader does: lint forbids synchronous setState in an effect.
    void Promise.resolve().then(() => {
      if (msgs.length === 0) {
        setMsgs([
          {
            role: 'assistant',
            text: "Hi! I'm the EasyShopAI guide. I can search every shop's public catalog and point you to the right store — then that shop's AI takes over for stock, prices and ordering. Try “gifts under $50”.",
          },
        ]);
      }
    });
    if (!shops) {
      let cancelled = false;
      api<unknown[]>('/shops?limit=50')
        .then((rows) => {
          if (cancelled) return;
          setShops(
            rows.flatMap((row) => {
              const parsed = shopDirectoryItemSchema.safeParse(row);
              return parsed.success ? [parsed.data] : [];
            }),
          );
        })
        .catch(() => !cancelled && setShops([]));
      return () => {
        cancelled = true;
      };
    }
  }, [open, msgs.length, shops]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [msgs, open, busy]);

  const push = (msg: GuideMsg) => setMsgs((current) => [...current, msg]);

  const send = async (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text || busy) return;
    setDraft('');
    push({ role: 'user', text });
    setBusy(true);
    try {
      const lower = text.toLowerCase();
      const maxPrice = Number(
        (lower.match(/(?:under|below|less than|max|budget of?)\s*\$?(\d+)/) ?? [])[1] ?? NaN,
      );
      const type = TYPE_WORDS.find(([pattern]) => pattern.test(lower))?.[1];

      const shopHit = (shops ?? []).find((shop) =>
        shop.name
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.length > 2 && lower.includes(word)),
      );

      await new Promise((resolve) => setTimeout(resolve, 450));

      if (/\b(shops?|stores?|sellers?|marketplace|which shop)\b/.test(lower) && !shopHit) {
        if (!shops?.length) {
          push({
            role: 'assistant',
            text: "I couldn't load the shop directory right now — please try again in a moment.",
          });
          return;
        }
        push({
          role: 'assistant',
          text: `There ${shops.length === 1 ? 'is' : 'are'} ${shops.length} shop${shops.length === 1 ? '' : 's'} on the marketplace right now. Tap one and its own AI takes over.`,
          shops: shops,
        });
        return;
      }

      const params = new URLSearchParams({ limit: '8' });
      const words = lower
        .split(/[^a-z0-9$]+/)
        .filter((word) => word.length > 2 && !STOPWORDS.has(word) && !/^\$?\d+$/.test(word));
      if (words.length) params.set('q', words.join(' '));
      if (Number.isFinite(maxPrice)) params.set('maxPrice', String(maxPrice));
      if (shopHit) params.set('shopSlug', shopHit.slug);

      const rows = await api<unknown[]>(`/search/products?${params.toString()}`);
      let products = rows.flatMap((row) => {
        const parsed = marketplaceProductSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      });
      if (type) products = products.filter((item) => item.shop.businessType === type);

      if (shopHit) {
        push({
          role: 'assistant',
          text: `${shopHit.name} — ${shopHit.productCount} product${shopHit.productCount === 1 ? '' : 's'} on the marketplace. Here's the public catalog; tap “Ask its AI” for stock, prices and ordering.`,
          products: products.slice(0, 4),
          shops: [shopHit],
        });
        return;
      }

      if (products.length === 0) {
        push({
          role: 'assistant',
          text: 'Nothing public matches that yet — sellers add items every week. Try a broader word, or pick a shop and ask its AI directly.',
          shops: (shops ?? []).slice(0, 3),
        });
        return;
      }

      const sellers = [
        ...new Map(products.map((item) => [item.shop.slug, item.shop])).values(),
      ].slice(0, 3);
      const scope = [
        Number.isFinite(maxPrice) ? `under $${maxPrice}` : '',
        type ? `in ${BUSINESS_TYPE_PRESETS[type].label.toLowerCase()}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      push({
        role: 'assistant',
        text: `Found ${products.length} item${products.length === 1 ? '' : 's'} ${scope || 'across the marketplace'}:`,
        products: products.slice(0, 6),
        shops: sellers,
      });
    } catch {
      push({
        role: 'assistant',
        text: "I couldn't reach the marketplace API just now. Check the connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="pop-in fixed bottom-3 right-3 z-40 flex h-[min(620px,88vh)] max-h-[88dvh] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-2xl sm:bottom-5 sm:right-5"
      role="dialog"
      aria-label="Marketplace guide"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon.Spark size={15} />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-[13px] font-bold leading-tight text-ink">EasyShopAI guide</span>
          <span className="text-[11px] text-muted">Searches every shop&apos;s public catalog</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close guide"
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
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                {message.text}
              </div>
            ) : (
              <div className="flex max-w-[94%] flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Icon.Spark size={11} />
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-line bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ink shadow-sm">
                    {message.text}
                    {busy && index === msgs.length - 1 ? (
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
                {message.products?.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {message.products.map((item) => (
                      <GuideProductCard
                        key={item.product.id}
                        item={item}
                        onOpen={() =>
                          router.push(`/product?id=${item.product.id}&shop=${item.shop.slug}`)
                        }
                      />
                    ))}
                  </div>
                ) : null}
                {message.shops?.length ? (
                  <div className="flex flex-col gap-1.5">
                    {message.shops.map((shop) => (
                      <GuideShopCard
                        key={shop.slug}
                        shop={shop}
                        onOpen={() => router.push(`/s?shop=${shop.slug}&chat=1`)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}

        {msgs.length <= 1 ? (
          <div className="flex flex-wrap gap-1.5 pl-9">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void send(chip)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft transition hover:border-brand-300 hover:text-brand-600"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-white px-3 py-2.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) void send();
          }}
          placeholder="Describe what you need…"
          aria-label="Ask the marketplace guide"
          className="h-10 flex-1 rounded-full border border-line bg-wash px-4 text-[13px] outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"
          aria-label="Send message"
        >
          <Icon.Send size={16} />
        </button>
      </div>
    </div>
  );
}

function GuideProductCard({ item, onOpen }: { item: MarketplaceProduct; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="overflow-hidden rounded-2xl border border-line bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`View ${item.product.name}`}
    >
      <div className="aspect-square w-full bg-wash">
        {item.product.images[0] ? (
          <img
            src={item.product.images[0]}
            alt={item.product.name}
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
          {item.product.name}
        </span>
        <span className="line-clamp-1 text-[10.5px] text-muted">By {item.shop.name}</span>
        <span className="text-[12.5px] font-bold text-brand-600">{money(item.product.price)}</span>
      </div>
    </button>
  );
}

function GuideShopCard({ shop, onOpen }: { shop: GuideShop; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-white px-2.5 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[12px] font-bold text-white"
        style={{ backgroundColor: shop.theme.primaryColor || '#2f5bf0' }}
      >
        {shop.topImages?.[0] ? (
          <img src={shop.topImages[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          shop.name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-ink">{shop.name}</span>
        <span className="block text-[10.5px] text-muted">
          {typeof shop.productCount === 'number'
            ? `${shop.productCount} ${shop.productCount === 1 ? 'product' : 'products'} · `
            : ''}
          ask its AI
        </span>
      </span>
      <Icon.ArrowRight size={14} className="shrink-0 text-muted" />
    </button>
  );
}
