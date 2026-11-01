'use client';

/**
 * Marketplace landing: customers discover shops AND products across every
 * EasyShopAI store. Both searches go through the public API; floor prices and
 * AI rule settings never appear in either contract.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BUSINESS_TYPE_PRESETS,
  STOREFRONT_TEMPLATES,
  marketplaceProductSchema,
  shopDirectoryItemSchema,
  type MarketplaceProduct,
  type ShopDirectoryItem,
} from '@easyshop/shared';
import { api, taka } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';
import { Icon } from '@/lib/icons';

type Mode = 'shops' | 'products';

export default function Marketplace() {
  const [mode, setMode] = useState<Mode>('shops');
  const [q, setQ] = useState('');
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);

  const search = async (nextMode: Mode, query: string) => {
    const requestId = ++requestRef.current;
    setMode(nextMode);
    setError(false);
    if (nextMode === 'shops') setShops(null);
    else setProducts(null);

    const sp = new URLSearchParams({ limit: '24' });
    if (query.trim()) sp.set('q', query.trim());

    try {
      if (nextMode === 'shops') {
        const raw = await api<unknown[]>(`/shops?${sp.toString()}`);
        const items: ShopDirectoryItem[] = [];
        for (const row of raw) {
          const parsed = shopDirectoryItemSchema.safeParse(row);
          if (parsed.success) items.push(parsed.data);
        }
        if (requestRef.current === requestId) setShops(items);
      } else {
        const raw = await api<unknown[]>(`/search/products?${sp.toString()}`);
        const items: MarketplaceProduct[] = [];
        for (const row of raw) {
          const parsed = marketplaceProductSchema.safeParse(row);
          if (parsed.success) items.push(parsed.data);
        }
        if (requestRef.current === requestId) setProducts(items);
      }
    } catch {
      if (requestRef.current === requestId) {
        setError(true);
        if (nextMode === 'shops') setShops([]);
        else setProducts([]);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestRef.current;
    api<unknown[]>('/shops?limit=24')
      .then((raw) => {
        if (cancelled || requestRef.current !== requestId) return;
        const items: ShopDirectoryItem[] = [];
        for (const row of raw) {
          const parsed = shopDirectoryItemSchema.safeParse(row);
          if (parsed.success) items.push(parsed.data);
        }
        setShops(items);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setShops([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = mode === 'shops' ? shops === null : products === null;

  return (
    <div className="flex flex-1 flex-col bg-[#f7f7f6]">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Icon.Store size={16} />
            </span>
            <span className="text-[17px] font-bold tracking-tight">
              Easy<span className="text-brand-600">Shop</span>AI
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden rounded-xl px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 sm:block"
            >
              Seller sign in
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-brand-600/25 transition hover:bg-brand-700"
            >
              <Icon.Plus size={15} />
              Open your shop
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-zinc-200/60 bg-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #059669 1.6px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-16 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <Icon.Spark size={13} />
            Every shop comes with an AI sales agent
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-[46px]">
            Open a real online store
            <br className="hidden sm:block" /> in <span className="text-brand-600">minutes</span>,
            not weeks
          </h1>
          <p className="max-w-xl text-base text-zinc-500">
            Pick your business, choose a storefront, set delivery and let the AI agent sell in
            বাংলা, English or Banglish. Customers can also search every shop right here.
          </p>

          <form
            className="flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/[0.04] sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              void search(mode, q);
            }}
          >
            <div className="flex rounded-xl bg-zinc-100 p-1">
              {(
                [
                  ['shops', 'Shops'],
                  ['products', 'Products'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => void search(key, q)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mode === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2">
              <Icon.Search size={18} className="ml-2 shrink-0 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  mode === 'shops'
                    ? 'Search shops — fashion, electronics, beauty…'
                    : 'Search products across every shop…'
                }
                className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
              <button
                type="submit"
                className="h-9 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
              >
                Search
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 transition hover:border-zinc-300"
            >
              <Icon.Store size={13} /> I&apos;m a seller
            </Link>
            <button
              onClick={() => void search('products', '')}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 transition hover:border-zinc-300"
            >
              <Icon.Search size={13} /> Browse all products
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              {mode === 'shops' ? 'Shops to discover' : 'Products to buy'}
              {q ? <span className="text-zinc-400"> · “{q}”</span> : null}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {mode === 'shops'
                ? 'Browse stores built on EasyShopAI — every one has its own AI agent.'
                : 'Search the live catalogs of every shop. Click a product to visit its store.'}
            </p>
          </div>
          {!loading && !error ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-500 shadow-sm ring-1 ring-zinc-200">
              {(mode === 'shops' ? shops?.length : products?.length) ?? 0} results
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-zinc-100 bg-white"
              >
                <Skeleton className="aspect-[16/10] w-full rounded-none" />
                <div className="flex flex-col gap-2.5 p-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <Icon.Alert size={16} className="mt-0.5 shrink-0" />
            Could not reach EasyShopAI. Refresh to retry.
          </p>
        ) : mode === 'shops' && !shops?.length ? (
          <EmptyResult
            title={q ? `No shops matching “${q}”` : 'No shops yet'}
            body="Be the first seller on EasyShopAI — your store and AI agent go live in minutes."
          />
        ) : mode === 'products' && !products?.length ? (
          <EmptyResult
            title={q ? `No products matching “${q}”` : 'No products yet'}
            body="Shops are still stocking their shelves. Try another search, or open your own store."
          />
        ) : mode === 'shops' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shops?.map((shop) => (
              <a
                key={shop.id}
                href={`/s?shop=${shop.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-900/[0.06]"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
                  {shop.topImages.length > 1 ? (
                    <div className="grid h-full w-full grid-cols-2 gap-0.5">
                      {shop.topImages.slice(0, 4).map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ))}
                    </div>
                  ) : shop.topImages[0] ? (
                    <img
                      src={shop.topImages[0]}
                      alt={shop.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="text-4xl font-black"
                        style={{ color: shop.theme.primaryColor ?? '#059669' }}
                      >
                        {shop.name.slice(0, 1)}
                      </span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 shadow-sm backdrop-blur">
                    {BUSINESS_TYPE_PRESETS[shop.businessType].label}
                  </div>
                  <div
                    className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur"
                    style={{ color: shop.theme.primaryColor ?? '#059669' }}
                  >
                    {shop.productCount} products
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <span className="font-semibold text-zinc-900">{shop.name}</span>
                  <span className="line-clamp-2 text-[13px] leading-relaxed text-zinc-500">
                    {shop.description ?? 'A shop on EasyShopAI.'}
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-3 text-[11px] text-zinc-400">
                    <Icon.Palette size={12} />
                    {STOREFRONT_TEMPLATES[shop.templateId].label} template
                    {shop.contact.phone ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        {shop.contact.phone}
                      </>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1 text-[13px] font-medium text-brand-700">
                    Visit store
                    <Icon.ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products?.map(({ product, shop, categoryName }) => (
              <a
                key={product.id}
                href={`/s?shop=${shop.slug}&product=${product.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-900/[0.06]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <Icon.Package size={30} />
                    </div>
                  )}
                  <div
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: shop.theme.primaryColor ?? '#059669' }}
                  >
                    {taka(product.price)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <span className="line-clamp-2 font-semibold leading-snug text-zinc-900">
                    {product.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Icon.Store size={11} />
                      {shop.name}
                    </span>
                    {categoryName ? (
                      <>
                        <span className="h-1 w-1 rounded-full bg-zinc-300" />
                        {categoryName}
                      </>
                    ) : null}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-3">
                    <span
                      className="text-base font-bold"
                      style={{ color: shop.theme.primaryColor ?? '#059669' }}
                    >
                      {taka(product.price)}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] font-medium text-brand-700">
                      Buy from this shop
                      <Icon.ArrowRight
                        size={13}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Icon.Palette size={19} />,
              title: 'A store that fits your business',
              body: 'Pick fashion, beauty, groceries or something else — the platform seeds categories and picks a matching template.',
            },
            {
              icon: <Icon.Spark size={19} />,
              title: 'An AI agent that actually sells',
              body: 'It searches the live catalog, checks stock, quotes delivery, bargains within your floor and takes COD orders.',
            },
            {
              icon: <Icon.Truck size={19} />,
              title: 'Built for Bangladesh',
              body: 'Bangla, Banglish or English. Delivery zones with real charges, cash on delivery, phone confirmation.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                {feature.icon}
              </div>
              <h3 className="mt-3.5 text-sm font-semibold text-zinc-900">{feature.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 flex flex-col items-center justify-between gap-4 rounded-3xl bg-zinc-900 px-6 py-7 text-center sm:flex-row sm:text-left">
          <div>
            <h3 className="text-base font-semibold text-white">Ready to sell online?</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Create your shop, add products, and your AI agent starts working immediately.
            </p>
          </div>
          <Link href="/dashboard">
            <Button size="lg" icon={<Icon.ArrowRight size={15} />}>
              Open your shop
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 bg-white py-7 text-center text-xs text-zinc-500">
        EasyShopAI — a marketplace with an AI agent in every store.
      </footer>
    </div>
  );
}

function EmptyResult({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon.Search size={22} />
      </div>
      <p className="text-sm font-semibold text-zinc-700">{title}</p>
      <p className="max-w-xs text-xs text-zinc-500">{body}</p>
      <Link href="/dashboard" className="mt-1">
        <Button icon={<Icon.Plus size={15} />}>Open your shop</Button>
      </Link>
    </div>
  );
}
