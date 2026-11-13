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
import { Skeleton } from '@/components/ui';
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
            <span className="text-[17px] font-semibold tracking-[-0.01em]">
              Easy<span className="text-brand-600">Shop</span>AI
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden text-sm text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-900 sm:block"
            >
              Seller sign in
            </Link>
            <Link
              href="/dashboard"
              className="bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Open a shop
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-200/70 bg-white">
        <div className="relative mx-auto grid w-full max-w-6xl gap-7 px-5 pb-12 pt-14 sm:pt-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
            Marketplace <span className="px-1 text-zinc-300">/</span> {shops?.length ?? 0} shop
            {shops?.length === 1 ? '' : 's'} listing now
          </p>
          <h1 className="max-w-[26ch] text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-zinc-900 sm:text-[56px]">
            Every shop keeps its own counter, and answers its own questions.
          </h1>
          <p className="max-w-[58ch] text-[15px] leading-relaxed text-zinc-600">
            Sellers list what they actually stock. Prices, delivery charges and cash-on-delivery
            orders come from that same list. Ask a shop in Bangla, English or Banglish and it
            answers from there.
          </p>

          <form
            className="flex w-full max-w-3xl flex-col border border-zinc-300 bg-white sm:flex-row sm:items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              void search(mode, q);
            }}
          >
            <div className="flex shrink-0 border-b border-zinc-200 sm:border-b-0 sm:border-r">
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
                  className={`px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] transition ${
                    mode === key
                      ? 'text-zinc-900 underline decoration-zinc-900 decoration-2 underline-offset-[6px]'
                      : 'text-zinc-400 hover:text-zinc-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2 px-3">
              <Icon.Search size={16} className="shrink-0 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={mode === 'shops' ? 'Shop name or type' : 'Product or brand'}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            </div>
            <button
              type="submit"
              className="h-12 shrink-0 bg-zinc-900 px-6 text-[13px] font-medium text-white transition hover:bg-zinc-700"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-zinc-600">
            <button
              onClick={() => void search('products', '')}
              className="underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-900"
            >
              Browse every product
            </button>
            <Link
              href="/dashboard"
              className="underline decoration-zinc-300 underline-offset-4 transition hover:decoration-zinc-900"
            >
              Open a shop
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              {mode === 'shops' ? 'Shops' : 'Products'}
              {q ? <span className="normal-case tracking-normal text-zinc-500"> “{q}”</span> : null}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {mode === 'shops'
                ? 'Open a shop to see its catalogue, delivery charges and chat.'
                : 'Each result is live stock from one shop; open it to buy there.'}
            </p>
          </div>
          {!loading && !error ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              {(mode === 'shops' ? shops?.length : products?.length) ?? 0} listed
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="border border-zinc-200 bg-white">
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
          <p className="flex items-start gap-2 border-l-2 border-red-500 bg-red-50/60 px-3 py-2.5 text-sm text-red-700">
            <Icon.Alert size={15} className="mt-0.5 shrink-0" />
            Could not reach EasyShopAI. Refresh to retry.
          </p>
        ) : mode === 'shops' && !shops?.length ? (
          <EmptyResult
            title={q ? `No shops matching “${q}”` : 'No shops yet'}
            body="Nothing here yet. Shops appear once a seller adds products."
          />
        ) : mode === 'products' && !products?.length ? (
          <EmptyResult
            title={q ? `No products matching “${q}”` : 'No products yet'}
            body="Shops are still stocking their shelves. Try another search, or open your own store."
          />
        ) : mode === 'shops' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shops?.map((shop) => (
              <a key={shop.id} href={`/s?shop=${shop.slug}`} className="group flex flex-col">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                  {shop.topImages.length > 1 ? (
                    <div className="grid h-full w-full grid-cols-2 gap-px">
                      {shop.topImages.slice(0, 4).map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt=""
                          className="h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04]"
                        />
                      ))}
                    </div>
                  ) : shop.topImages[0] ? (
                    <img
                      src={shop.topImages[0]}
                      alt={shop.name}
                      className="h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end p-4">
                      <span className="text-3xl font-semibold text-zinc-300">
                        {shop.name.slice(0, 1)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2.5">
                  <span className="text-[15px] font-medium text-zinc-900">{shop.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                    {BUSINESS_TYPE_PRESETS[shop.businessType].label}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">
                  {shop.description ?? 'No description yet.'}
                </p>
                <span className="mt-2 text-[12px] text-zinc-500">
                  {shop.productCount} {shop.productCount === 1 ? 'product' : 'products'}
                  {shop.contact.phone ? ` · ${shop.contact.phone}` : ''}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {products?.map(({ product, shop, categoryName }) => (
              <a
                key={product.id}
                href={`/s?shop=${shop.slug}&product=${product.id}`}
                className="group flex flex-col"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end p-4">
                      <span className="text-3xl font-semibold text-zinc-300">
                        {product.name.slice(0, 1)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-zinc-200 pt-2.5">
                  <span className="line-clamp-1 text-[15px] font-medium text-zinc-900">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-[13px] text-zinc-900">{taka(product.price)}</span>
                </div>
                <span className="mt-1.5 text-[12px] text-zinc-500">
                  {shop.name}
                  {categoryName ? ` · ${categoryName}` : ''}
                </span>
              </a>
            ))}
          </div>
        )}

        <section className="mt-20 grid gap-10 border-t border-zinc-200 pt-8 sm:grid-cols-3">
          {[
            {
              title: 'One catalogue, two doors',
              body: 'The storefront and the chat read the same product list, so what a customer is told is what the shop has.',
            },
            {
              title: 'Delivery is a real number',
              body: 'Zones, charges and delivery days come from the seller, not from a template.',
            },
            {
              title: 'Cash on delivery, in Bangla',
              body: 'Chats run in Bangla, Banglish or English, and orders arrive with a phone number to confirm.',
            },
          ].map((feature) => (
            <div key={feature.title} className="border-t border-zinc-900/70 pt-3">
              <h3 className="text-[13px] font-medium text-zinc-900">{feature.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">{feature.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 flex flex-col items-start justify-between gap-5 border-t border-zinc-200 pt-8 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-900">
              Open your shop
            </h3>
            <p className="mt-2 max-w-[46ch] text-sm text-zinc-600">
              Pick a business type, keep the categories that fit, add your products. The storefront,
              delivery zones and chat are generated from that.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 border-b border-zinc-900 pb-0.5 text-sm font-medium text-zinc-900"
          >
            Start with a template
          </Link>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 bg-white py-7">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 text-[11px] uppercase tracking-[0.14em] text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span>EasyShopAI · Dhaka</span>
          <span>Storefronts and cash-on-delivery orders for small sellers</span>
        </div>
      </footer>
    </div>
  );
}

function EmptyResult({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-t border-zinc-200 py-12">
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-600">{body}</p>
      <Link
        href="/dashboard"
        className="mt-4 inline-block border-b border-zinc-900 pb-0.5 text-[13px] font-medium text-zinc-900"
      >
        Open a shop
      </Link>
    </div>
  );
}
