'use client';

/**
 * Marketplace landing: customers discover shops on EasyShopAI itself.
 * Public `GET /shops` directory (soft-validated here; secrets like floor
 * prices never appear in the contract).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { shopDirectoryItemSchema, type ShopDirectoryItem } from '@easyshop/shared';
import { api } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';
import { Icon } from '@/lib/icons';

export default function Marketplace() {
  const [q, setQ] = useState('');
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [error, setError] = useState(false);

  const search = (query: string) => {
    setError(false);
    setShops(null);
    const sp = new URLSearchParams({ limit: '24' });
    if (query.trim()) sp.set('q', query.trim());
    api<unknown[]>(`/shops?${sp.toString()}`)
      .then((raw) => {
        if (!Array.isArray(raw)) return;
        const items: ShopDirectoryItem[] = [];
        for (const r of raw) {
          const parsed = shopDirectoryItemSchema.safeParse(r);
          if (parsed.success) items.push(parsed.data);
        }
        setShops(items);
      })
      .catch(() => {
        setError(true);
        setShops([]);
      });
  };

  useEffect(() => {
    let cancelled = false;
    api<unknown[]>('/shops?limit=24')
      .then((raw) => {
        if (cancelled || !Array.isArray(raw)) return;
        const items: ShopDirectoryItem[] = [];
        for (const r of raw) {
          const parsed = shopDirectoryItemSchema.safeParse(r);
          if (parsed.success) items.push(parsed.data);
        }
        if (!cancelled) setShops(items);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setShops([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
              Create your shop
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
            An AI sales agent in every store
          </span>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.15] tracking-tight text-zinc-900 sm:text-[44px]">
            Discover shops that <span className="text-brand-600">sell like humans</span>,
            <br className="hidden sm:block" /> assisted by AI
          </h1>
          <p className="max-w-xl text-base text-zinc-500">
            Browse real Bangladeshi stores. Ask any question in বাংলা, English or Banglish — buying
            is a conversation, ending in cash-on-delivery.
          </p>
          <form
            className="flex w-full max-w-lg items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/[0.04]"
            onSubmit={(e) => {
              e.preventDefault();
              search(q);
            }}
          >
            <Icon.Search size={18} className="ml-2 shrink-0 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search shops — fashion, electronics, groceries…"
              className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
            <button
              type="submit"
              className="h-9 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-700"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        {shops === null && !error ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-zinc-100 bg-white">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
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
        ) : !shops?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Icon.Store size={22} />
            </div>
            <p className="text-sm font-semibold text-zinc-700">
              No shops{q ? ` matching “${q}”` : ' yet'}
            </p>
            <p className="max-w-xs text-xs text-zinc-500">
              Be the first seller on EasyShopAI — your store and AI agent go live in minutes.
            </p>
            <Link href="/dashboard" className="mt-1">
              <Button icon={<Icon.ArrowRight size={15} />}>Open your shop</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <a
                key={s.id}
                href={`/s?shop=${s.slug}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-900/[0.06]"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
                  {s.topImages[0] ? (
                    <img
                      src={s.topImages[0]}
                      alt={s.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="text-4xl font-black"
                        style={{ color: s.theme.primaryColor ?? '#059669' }}
                      >
                        {s.name.slice(0, 1)}
                      </span>
                    </div>
                  )}
                  <div
                    className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur"
                    style={{ color: s.theme.primaryColor ?? '#059669' }}
                  >
                    {s.productCount} products
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-5">
                  <span className="font-semibold text-zinc-900">{s.name}</span>
                  <span className="line-clamp-2 text-[13px] leading-relaxed text-zinc-500">
                    {s.description ?? 'A shop on EasyShopAI.'}
                  </span>
                  <span className="mt-auto flex items-center gap-1 pt-3 text-[13px] font-medium text-brand-700">
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
        )}

        <section className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Icon.Palette size={19} />,
              t: 'A whole website per shop',
              b: 'Sellers pick a template and colors in minutes — their storefront is generated for them.',
            },
            {
              icon: <Icon.Spark size={19} />,
              t: 'A real AI sales agent',
              b: 'It searches the live catalog, checks stock and prices, bargains within seller limits, and takes COD orders.',
            },
            {
              icon: <Icon.Truck size={19} />,
              t: 'Built for Bangladesh',
              b: 'Bengali, Banglish or English. Cash on delivery, phone confirmation, home delivery zones.',
            },
          ].map((f) => (
            <div key={f.t} className="rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                {f.icon}
              </div>
              <h3 className="mt-3.5 text-sm font-semibold text-zinc-900">{f.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{f.b}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 bg-white py-7 text-center text-xs text-zinc-500">
        EasyShopAI — a marketplace with an AI agent in every store.
      </footer>
    </div>
  );
}
