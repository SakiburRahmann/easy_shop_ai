'use client';

/**
 * Marketplace home, rebuilt against the reference: pale-blue hero band with the
 * headline, shopper photo and mint seller card; the ten-tile category rail; and
 * a six-up featured row. All product, shop and price data comes from the API.
 */
import { useEffect, useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui';
import { SiteFooter, SiteHeader } from '@/components/site/header';
import { ProductTile } from '@/components/market/product-tile';

const CATEGORY_MEDIA: Record<BusinessType, { image?: string; tint: string }> = {
  electronics: { image: '/images/cat-electronics.jpg', tint: '#eef1f7' },
  home: { image: '/images/cat-home.jpg', tint: '#f0ebe3' },
  fashion: { image: '/images/cat-fashion.jpg', tint: '#e7eef7' },
  beauty: { image: '/images/cat-beauty.jpg', tint: '#f8efea' },
  groceries: { image: '/images/cat-groceries.jpg', tint: '#eaf2ea' },
  kids: { tint: '#f6eaea' },
  other: { tint: '#f1f2f6' },
};

const CATEGORY_LABEL: Record<BusinessType, string> = {
  electronics: 'Electronics',
  home: 'Home',
  fashion: 'Fashion',
  beauty: 'Beauty',
  groceries: 'Groceries',
  kids: 'Kids',
  other: 'More',
};

export default function Marketplace() {
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<unknown[]>('/shops?limit=50'), api<unknown[]>('/search/products?limit=12')])
      .then(([shopRows, productRows]) => {
        if (cancelled) return;
        setShops(
          shopRows.flatMap((row) => {
            const parsed = shopDirectoryItemSchema.safeParse(row);
            return parsed.success ? [parsed.data] : [];
          }),
        );
        setProducts(
          productRows.flatMap((row) => {
            const parsed = marketplaceProductSchema.safeParse(row);
            return parsed.success ? [parsed.data] : [];
          }),
        );
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () =>
      (Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[])
        .filter((type) => type !== 'other')
        .map((type) => ({ type })),
    [],
  );

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="flex-1">
        {/* ───────────────────────────── hero ───────────────────────────── */}
        <section className="bg-wash-blue">
          <div className="mx-auto grid w-full max-w-[1120px] items-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)_280px] lg:gap-6 lg:py-9">
            <div>
              <h1 className="max-w-[9ch] text-[clamp(2.5rem,4.8vw,3.15rem)] font-extrabold leading-[1.02] tracking-[-0.045em] text-ink">
                Find what you need
              </h1>
              <p className="mt-4 max-w-[34ch] text-[14.5px] leading-[1.55] text-[#5d6474]">
                Shop from thousands of independent stores and unique brands, all in one place.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-[13px] font-semibold text-white transition hover:bg-brand-700"
                >
                  Start shopping
                  <Icon.ArrowRight size={15} />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center rounded-lg border border-brand-500/70 px-5 text-[13px] font-semibold text-brand-600 transition hover:bg-white/70"
                >
                  Create your store
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[11.5px] font-medium text-[#6b7280]">
                <TrustItem icon={<Icon.Shield size={14} />} label="Trusted sellers" />
                <TrustItem icon={<Icon.Truck size={14} />} label="Secure shopping" />
                <TrustItem icon={<Icon.Spark size={14} />} label="A bigger tomorrow" />
              </ul>
            </div>

            <div className="relative hidden h-full min-h-[280px] items-end justify-center self-stretch lg:flex">
              <div className="h-[292px] [mask-image:radial-gradient(ellipse_at_50%_46%,black_62%,transparent_96%)]">
                <img
                  src="/images/hero-shopper.png"
                  alt="A shopper carrying bags from independent stores"
                  className="h-full w-auto max-w-full object-contain object-bottom"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <p className="text-[14.5px] leading-[1.5] text-[#3f4552]">
                Great products.
                <br />
                Brighter businesses.
                <br />
                A more open marketplace.
              </p>
              <div className="relative mt-5 min-h-[188px] overflow-hidden rounded-xl bg-mint p-5 pr-[80px]">
                <p className="text-[18px] font-extrabold leading-[1.15] tracking-[-0.03em] text-mint-ink">
                  Turn your passion
                  <br />
                  into a business
                </p>
                <p className="mt-2 max-w-[18ch] text-[11px] leading-[1.55] text-mint-ink/75">
                  Create your store and reach millions of shoppers.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#12463a] px-3.5 text-[11px] font-semibold text-white transition hover:bg-[#0d382e]"
                >
                  Create your store
                  <Icon.ArrowRight size={13} />
                </Link>
                <img
                  src="/images/cat-home.jpg"
                  alt=""
                  aria-hidden="true"
                  className="absolute bottom-3 right-3 h-[92px] w-[72px] rounded-lg object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────── categories ───────────────────────── */}
        <section id="categories" className="mx-auto w-full max-w-[1120px] scroll-mt-24 px-5 pt-9">
          <div className="flex items-center gap-6">
            <h2 className="w-[130px] shrink-0 text-[22px] font-extrabold leading-[1.15] tracking-[-0.04em] text-ink">
              Browse
              <br />
              categories
            </h2>
            <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:justify-between">
              {categories.map(({ type }) => {
                const media = CATEGORY_MEDIA[type];
                return (
                  <Link
                    key={type}
                    href={`/search?businessType=${type}`}
                    className="group flex w-[64px] shrink-0 flex-col items-center gap-2 text-center"
                  >
                    <span
                      className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-[14px] transition group-hover:-translate-y-0.5"
                      style={{ backgroundColor: media.tint }}
                    >
                      {media.image ? (
                        <img
                          src={media.image}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Icon.Store size={24} className="text-ink/45" />
                      )}
                    </span>
                    <span className="text-[10.5px] font-medium leading-tight text-ink/80">
                      {CATEGORY_LABEL[type]}
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/search"
              aria-label="Browse all products"
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink/60 transition hover:border-brand-300 hover:text-brand-600 sm:flex"
            >
              <Icon.ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ───────────────────────── featured products ──────────────────── */}
        <section className="mx-auto w-full max-w-[1120px] px-5 pb-4 pt-10">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[20px] font-extrabold tracking-[-0.035em] text-ink">
              Featured products
            </h2>
            <Link
              href="/search"
              className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-700"
            >
              View all products
              <Icon.ArrowRight size={13} />
            </Link>
          </div>

          <div className="mt-5">
            {products === null && !failed ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="aspect-[4/3] w-full rounded-[10px]" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))}
              </div>
            ) : failed ? (
              <p className="rounded-xl bg-wash px-4 py-6 text-center text-[13px] text-muted">
                We couldn&apos;t reach the marketplace API. Check that it&apos;s running, then
                reload.
              </p>
            ) : products && products.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
                {products.slice(0, 6).map((item) => (
                  <ProductTile
                    key={item.product.id}
                    product={item.product}
                    shopName={item.shop.name}
                    href={`/product?id=${item.product.id}&shop=${item.shop.slug}`}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-wash px-4 py-10 text-center text-[13px] text-muted">
                No products listed yet. Sellers add their first items from the dashboard.
              </p>
            )}
          </div>
        </section>

        {/* Two-up seller band, kept in the reference's colour language. */}
        <section className="mx-auto w-full max-w-[1120px] px-5 py-10">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#f6f7fa] px-6 py-5">
              <div>
                <p className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
                  {shops?.length ?? 0} independent shops, one marketplace
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Every storefront is run by a real seller and has an AI assistant.
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 text-[12px] font-semibold text-ink transition hover:border-brand-300"
              >
                Browse shops
                <Icon.ArrowRight size={13} />
              </Link>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#e9f1fd] px-6 py-5">
              <p className="text-[13px] font-semibold leading-snug text-ink">
                Not sure what to buy?
                <span className="mt-0.5 block text-[11.5px] font-normal text-ink/60">
                  Ask any shop&apos;s AI assistant.
                </span>
              </p>
              <Icon.Spark size={26} className="shrink-0 text-brand-600" />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="text-ink/55">{icon}</span>
      {label}
    </li>
  );
}
