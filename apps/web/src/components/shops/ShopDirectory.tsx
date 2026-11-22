'use client';

/**
 * Public shop directory (`/shops`), per SPEC §3 "shop directory with business
 * type, catalog images and product counts". Reachable from the home seller
 * band's "Browse shops" button. Data comes from the public `GET /shops`
 * endpoint; every card links to the storefront and to that shop's AI agent
 * (`/s?shop=slug&chat=1`), the same deep link the AI chooser uses.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPE_PRESETS,
  shopDirectoryItemSchema,
  type BusinessType,
  type ShopDirectoryItem,
} from '@easyshop/shared';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { EmptyState, Skeleton } from '@/components/ui';
import { SiteFooter, SiteHeader } from '@/components/site/header';
import { MarketplaceGuide } from '@/components/site/concierge';

export default function ShopDirectory() {
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [type, setType] = useState<BusinessType | ''>('');
  const [guide, setGuide] = useState(false);

  useEffect(() => {
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
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const typeCounts = useMemo(() => {
    const counts = new Map<BusinessType, number>();
    for (const shop of shops ?? [])
      counts.set(shop.businessType, (counts.get(shop.businessType) ?? 0) + 1);
    return counts;
  }, [shops]);

  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      (shops ?? []).filter((shop) => {
        if (type && shop.businessType !== type) return false;
        if (!needle) return true;
        return (
          shop.name.toLowerCase().includes(needle) ||
          (shop.description ?? '').toLowerCase().includes(needle) ||
          BUSINESS_TYPE_PRESETS[shop.businessType].label.toLowerCase().includes(needle)
        );
      }),
    [shops, needle, type],
  );

  const filtered = Boolean(q.trim() || type);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-2 pb-5 pt-8">
          <h1 className="text-[clamp(2.1rem,3.6vw,2.6rem)] font-extrabold tracking-[-0.045em] text-ink">
            Browse shops
          </h1>
          <p className="pb-1.5 text-[12px] text-muted">
            {shops === null
              ? 'Loading…'
              : `${visible.length.toLocaleString('en-US')} shop${visible.length === 1 ? '' : 's'}${
                  filtered ? ' found' : ' on the marketplace'
                }`}
          </p>
        </div>

        {/* ─────────────────────────── filter bar ───────────────────────── */}
        <div className="flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-center">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 lg:max-w-[320px]">
            <Icon.Search size={14} className="shrink-0 text-muted" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search shops by name or what they sell…"
              aria-label="Search shops"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted/70"
            />
          </label>
          <label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 lg:w-[196px]">
            <span className="text-[12.5px] font-medium text-ink/70">Categories</span>
            <select
              value={type}
              onChange={(event) => setType((event.target.value || '') as BusinessType | '')}
              aria-label="Filter shops by category"
              className="ml-auto max-w-[120px] cursor-pointer bg-transparent text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="">All</option>
              {(Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[]).map((value) => (
                <option key={value} value={value}>
                  {BUSINESS_TYPE_PRESETS[value].label
                    .replace(' & apparel', '')
                    .replace(' & care', '')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setGuide(true)}
            className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3.5 text-[12.5px] font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
          >
            <Icon.Spark size={14} />
            Ask the marketplace AI
          </button>
        </div>

        {/* ─────────────────────────── shop cards ───────────────────────── */}
        <div className="mt-5">
          {shops === null && !failed ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : failed ? (
            <p className="rounded-xl bg-wash px-4 py-6 text-center text-[13px] text-muted">
              We couldn&apos;t reach the marketplace API. Check that it&apos;s running, then reload.
            </p>
          ) : visible.length === 0 ? (
            <EmptyState
              title="No shops match that yet"
              body="Try a different name or category — new sellers open storefronts every week."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setType('');
                  }}
                  className="text-[12.5px] font-semibold text-brand-600 hover:underline"
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
      <MarketplaceGuide open={guide} onClose={() => setGuide(false)} />
    </div>
  );
}

function ShopCard({ shop }: { shop: ShopDirectoryItem }) {
  const [first, second, third, fourth] = shop.topImages;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-16px_rgba(14,20,36,.2)]">
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-[16px] font-bold text-white"
          style={{ backgroundColor: shop.theme.primaryColor || '#2f5bf0' }}
        >
          {first ? (
            <img src={first} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            shop.name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-ink">
            {shop.name}
          </p>
          <p className="text-[11.5px] text-muted">
            {BUSINESS_TYPE_PRESETS[shop.businessType].label} · {shop.productCount}{' '}
            {shop.productCount === 1 ? 'product' : 'products'}
          </p>
        </div>
        {shop.productCount === 0 ? (
          <span className="shrink-0 rounded-full bg-wash px-2.5 py-1 text-[10.5px] font-semibold text-muted">
            Setting up
          </span>
        ) : null}
      </div>

      <p className="min-h-[34px] text-[12.5px] leading-relaxed text-muted">
        {shop.description ?? 'This seller is setting up their storefront.'}
      </p>

      {first || second || third || fourth ? (
        <div className="grid grid-cols-4 gap-2">
          {[first, second, third, fourth].map((image, index) =>
            image ? (
              <img
                key={index}
                src={image}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full rounded-lg border border-line bg-wash object-cover"
              />
            ) : (
              <span
                key={index}
                aria-hidden="true"
                className="aspect-[4/3] w-full rounded-lg border border-dashed border-line bg-wash/60"
              />
            ),
          )}
        </div>
      ) : (
        <div className="flex h-[72px] items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-wash/60 text-[11.5px] text-muted">
          <Icon.Package size={16} className="text-zinc-300" />
          First products are on their way
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-3">
        <Link
          href={`/s?shop=${shop.slug}`}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink transition hover:text-brand-600"
        >
          Visit storefront
          <Icon.ArrowRight size={13} />
        </Link>
        <Link
          href={`/s?shop=${shop.slug}&chat=1`}
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 transition hover:text-brand-700"
        >
          <Icon.Spark size={13} />
          Ask its AI
        </Link>
      </div>
    </div>
  );
}
