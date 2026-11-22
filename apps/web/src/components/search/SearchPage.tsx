'use client';

/**
 * Marketplace search, matched to the reference: a page title with the result
 * count, a filter bar holding the category select, the search field and sort,
 * a left filter column and a four-up product grid with pill pagination.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPE_PRESETS,
  marketplaceProductSchema,
  shopDirectoryItemSchema,
  type BusinessType,
  type MarketplaceProduct,
  type ShopDirectoryItem,
} from '@easyshop/shared';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { CardSkeletonGrid } from '@/components/ui';
import { SiteFooter, SiteHeader } from '@/components/site/header';
import { ProductTile } from '@/components/market/product-tile';

const PAGE_SIZE = 12;
const SORTS = [
  ['newest', 'Relevance'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
] as const;

const PRICE_BANDS = [
  { id: 'u50', label: 'Under $50', min: undefined, max: 50 },
  { id: '50-100', label: '$50 – $100', min: 50, max: 100 },
  { id: '100-200', label: '$100 – $200', min: 100, max: 200 },
  { id: '200-500', label: '$200 – $500', min: 200, max: 500 },
  { id: 'o500', label: 'Over $500', min: 500, max: undefined },
] as const;

interface SearchState {
  q: string;
  businessType: BusinessType | '';
  shopSlug: string;
  sort: string;
  price: string;
  page: number;
}

const DEFAULTS: SearchState = {
  q: '',
  businessType: '',
  shopSlug: '',
  sort: 'newest',
  price: '',
  page: 1,
};

/**
 * Filters live in the URL but are read from `location` (the same pattern the
 * storefront uses) so the static export never depends on a Suspense boundary
 * resolving for a search route.
 */
function readParams(): SearchState {
  if (typeof window === 'undefined') return DEFAULTS;
  const sp = new URLSearchParams(window.location.search);
  const type = sp.get('businessType') ?? '';
  const sort = sp.get('sort') ?? 'newest';
  return {
    q: sp.get('q') ?? '',
    businessType: Object.prototype.hasOwnProperty.call(BUSINESS_TYPE_PRESETS, type)
      ? (type as BusinessType)
      : '',
    shopSlug: (sp.get('shop') ?? '').trim().slice(0, 80),
    sort: SORTS.some(([value]) => value === sort) ? sort : 'newest',
    price: sp.get('price') ?? '',
    page: Math.max(1, Number(sp.get('page') ?? '1') || 1),
  };
}

export default function SearchPage() {
  const [params, setParams] = useState<SearchState>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const { q, businessType, shopSlug, sort, price: band, page } = params;

  const [draft, setDraft] = useState(q);
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setParams(readParams());
      setReady(true);
    });
    const sync = () => setParams(readParams());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => setDraft(q));
  }, [q]);

  const activeBand = PRICE_BANDS.find((entry) => entry.id === band);

  const navigate = (next: Partial<Record<keyof SearchState, string | undefined>>) => {
    const merged: SearchState = {
      q: 'q' in next ? (next.q ?? '') : params.q,
      businessType:
        'businessType' in next
          ? ((next.businessType ?? '') as BusinessType | '')
          : params.businessType,
      shopSlug: 'shopSlug' in next ? (next.shopSlug ?? '') : params.shopSlug,
      sort: 'sort' in next ? (next.sort ?? 'newest') : params.sort,
      price: 'price' in next ? (next.price ?? '') : params.price,
      page: 'page' in next ? Math.max(1, Number(next.page ?? '1') || 1) : 1,
    };
    const sp = new URLSearchParams();
    if (merged.q) sp.set('q', merged.q);
    if (merged.businessType) sp.set('businessType', merged.businessType);
    if (merged.shopSlug) sp.set('shop', merged.shopSlug);
    if (merged.sort !== 'newest') sp.set('sort', merged.sort);
    if (merged.price) sp.set('price', merged.price);
    if (merged.page > 1) sp.set('page', String(merged.page));
    const qs = sp.toString();
    window.history.replaceState({}, '', qs ? `/search?${qs}` : '/search');
    setParams(merged);
  };

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
      .catch(() => !cancelled && setShops([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setProducts(null);
      setFailed(false);
    });
    const sp = new URLSearchParams({ sort, limit: '48' });
    if (q) sp.set('q', q);
    if (shopSlug) sp.set('shopSlug', shopSlug);
    if (activeBand?.min !== undefined) sp.set('minPrice', String(activeBand.min));
    if (activeBand?.max !== undefined) sp.set('maxPrice', String(activeBand.max));
    api<unknown[]>(`/search/products?${sp.toString()}`)
      .then((rows) => {
        if (cancelled) return;
        setProducts(
          rows.flatMap((row) => {
            const parsed = marketplaceProductSchema.safeParse(row);
            return parsed.success ? [parsed.data] : [];
          }),
        );
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [q, sort, shopSlug, activeBand?.min, activeBand?.max]);

  /**
   * Category counts and filtering come straight from each result's
   * `shop.businessType` — the API already returns it with every product, so
   * there is no second fetch to race against.
   */
  const typeCounts = useMemo(() => {
    const counts = new Map<BusinessType, number>();
    for (const item of products ?? []) {
      counts.set(item.shop.businessType, (counts.get(item.shop.businessType) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  const filtered = useMemo(() => {
    const list = products ?? [];
    if (!businessType) return list;
    return list.filter((item) => item.shop.businessType === businessType);
  }, [products, businessType]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const clearAll = () => {
    window.history.replaceState({}, '', '/search');
    setParams(DEFAULTS);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader query={q} />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-2 pb-5 pt-8">
          <h1 className="text-[clamp(2.1rem,3.6vw,2.6rem)] font-extrabold tracking-[-0.045em] text-ink">
            Explore products
          </h1>
          <p className="pb-1.5 text-[12px] text-muted">
            {products === null
              ? 'Loading…'
              : `${filtered.length.toLocaleString('en-US')} result${filtered.length === 1 ? '' : 's'}${
                  q ? ` for “${q}”` : ''
                }`}
          </p>
        </div>

        {/* ─────────────────────────── filter bar ───────────────────────── */}
        <div className="flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-center">
          <label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line px-3 lg:w-[196px]">
            <span className="text-[12.5px] font-medium text-ink/70">Categories</span>
            <select
              value={businessType}
              onChange={(event) => navigate({ businessType: event.target.value || undefined })}
              aria-label="Filter by category"
              className="ml-auto max-w-[120px] cursor-pointer bg-transparent text-[12.5px] font-semibold text-ink outline-none"
            >
              <option value="">All</option>
              {(Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[]).map((type) => (
                <option key={type} value={type}>
                  {BUSINESS_TYPE_PRESETS[type].label
                    .replace(' & apparel', '')
                    .replace(' & care', '')}
                </option>
              ))}
            </select>
            <Icon.Chevron size={13} className="shrink-0 text-muted" />
          </label>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              navigate({ q: draft.trim() || undefined });
            }}
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line pl-3.5 pr-1"
          >
            <Icon.Search size={15} className="shrink-0 text-muted" />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
            />
            {draft ? (
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  navigate({ q: undefined });
                }}
                aria-label="Clear search"
                className="rounded-full p-1 text-muted hover:text-ink"
              >
                <Icon.X size={13} />
              </button>
            ) : null}
            <button
              type="submit"
              className="h-8 shrink-0 rounded-md bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition hover:bg-brand-700"
            >
              Search
            </button>
          </form>

          <label className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 lg:w-[198px]">
            <span className="text-[12px] text-muted">Sort by</span>
            <select
              value={sort}
              onChange={(event) => navigate({ sort: event.target.value })}
              aria-label="Sort results"
              className="ml-auto w-[112px] cursor-pointer appearance-none truncate bg-transparent text-[12.5px] font-semibold text-ink outline-none"
            >
              {SORTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Icon.Chevron size={13} className="shrink-0 text-muted" />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-7 lg:flex-row lg:gap-8">
          {/* ───────────────────────────── filters ───────────────────────── */}
          <aside className="lg:w-[210px] lg:shrink-0">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-ink lg:hidden"
            >
              <span className="flex items-center gap-2">
                <Icon.Search size={14} />
                Filters
              </span>
              <Icon.Chevron size={14} className={`transition ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`${filtersOpen ? 'mt-3 flex' : 'hidden'} flex-col lg:mt-0 lg:flex`}>
              <div className="flex items-center justify-between pb-2">
                <span className="text-[13px] font-bold text-ink">Filters</span>
                {q || businessType || band || shopSlug ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[11px] font-semibold text-brand-600 hover:underline"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <FilterGroup title="Categories">
                <FilterCheck
                  checked={!businessType}
                  label="All categories"
                  count={products?.length}
                  onChange={() => navigate({ businessType: undefined })}
                />
                {(Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[]).map((type) => (
                  <FilterCheck
                    key={type}
                    checked={businessType === type}
                    label={BUSINESS_TYPE_PRESETS[type].label
                      .replace(' & apparel', '')
                      .replace(' & care', '')}
                    count={typeCounts.get(type)}
                    onChange={() => navigate({ businessType: type })}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Price">
                {PRICE_BANDS.map((entry) => (
                  <FilterCheck
                    key={entry.id}
                    checked={band === entry.id}
                    label={entry.label}
                    count={
                      products?.filter(
                        (item) =>
                          (entry.min === undefined || item.product.price >= entry.min) &&
                          (entry.max === undefined || item.product.price <= entry.max),
                      ).length
                    }
                    onChange={() => navigate({ price: band === entry.id ? undefined : entry.id })}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Shops">
                {(shops ?? []).map((shop) => (
                  <FilterCheck
                    key={shop.id}
                    checked={shopSlug === shop.slug}
                    label={shop.name}
                    count={shop.productCount}
                    onChange={() =>
                      navigate({
                        shopSlug: shopSlug === shop.slug ? undefined : shop.slug,
                        businessType: undefined,
                      })
                    }
                  />
                ))}
              </FilterGroup>

              <div className="mt-5 rounded-lg bg-wash p-3">
                <p className="text-[11.5px] font-semibold text-ink">Know the exact item?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Ask the shop&apos;s assistant and it will find it in the real catalog.
                </p>
                <Link
                  href="/#about"
                  className="mt-2 inline-flex text-[11.5px] font-semibold text-brand-600 hover:underline"
                >
                  How the assistant works
                </Link>
              </div>
            </div>
          </aside>

          {/* ───────────────────────────── results ───────────────────────── */}
          <div className="min-w-0 flex-1">
            {failed ? (
              <div className="rounded-xl bg-wash px-4 py-10 text-center">
                <p className="text-[13px] font-semibold text-ink">
                  Search is unavailable right now
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  The marketplace API did not respond. Check the connection and try again.
                </p>
              </div>
            ) : !ready || products === null ? (
              <CardSkeletonGrid count={8} />
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-16 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-wash text-ink/50">
                  <Icon.Search size={19} />
                </div>
                <p className="text-[13px] font-semibold text-ink">Nothing matched that search</p>
                <p className="max-w-sm text-[12px] text-muted">
                  Try a broader keyword, another category, or a different price range.
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="mt-2 h-9 rounded-lg bg-brand-600 px-4 text-[12px] font-semibold text-white"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                  {visible.map((item) => (
                    <ProductTile
                      key={item.product.id}
                      product={item.product}
                      shopName={item.shop.name}
                      href={`/product?id=${item.product.id}&shop=${item.shop.slug}`}
                    />
                  ))}
                </div>

                {pages > 1 ? (
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
                    <button
                      type="button"
                      disabled={current === 1}
                      onClick={() => navigate({ page: String(current - 1) })}
                      aria-label="Previous page"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-ink/50 transition hover:bg-wash disabled:opacity-30"
                    >
                      <Icon.ArrowLeft size={14} />
                    </button>
                    {Array.from({ length: pages })
                      .slice(0, 8)
                      .map((_, index) => {
                        const number = index + 1;
                        return (
                          <button
                            key={number}
                            type="button"
                            onClick={() => navigate({ page: String(number) })}
                            className={`h-8 min-w-8 rounded-md px-2 text-[12px] font-semibold transition ${
                              number === current
                                ? 'bg-brand-600 text-white'
                                : 'text-ink-soft hover:bg-wash'
                            }`}
                          >
                            {number}
                          </button>
                        );
                      })}
                    <button
                      type="button"
                      disabled={current === pages}
                      onClick={() => navigate({ page: String(current + 1) })}
                      aria-label="Next page"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-ink/50 transition hover:bg-wash disabled:opacity-30"
                    >
                      <Icon.ArrowRight size={14} />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 last:border-0">
      <span className="flex items-center justify-between text-[12.5px] font-bold text-ink">
        {title}
        <Icon.Chevron size={13} className="text-muted" />
      </span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FilterCheck({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[12px] leading-tight">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-[14px] w-[14px] shrink-0 cursor-pointer appearance-none rounded-[3px] border border-[#cfd3dd] bg-white checked:border-brand-600 checked:bg-brand-600 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22><path d=%22M20 6 9 17l-5-5%22/></svg>')] checked:bg-[length:11px_11px] checked:bg-center checked:bg-no-repeat"
      />
      <span className="min-w-0 flex-1 truncate text-ink/80">{label}</span>
      {typeof count === 'number' ? (
        <span className="shrink-0 text-[11px] text-muted">({count.toLocaleString('en-US')})</span>
      ) : null}
    </label>
  );
}
