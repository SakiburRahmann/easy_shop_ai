'use client';

/**
 * Marketplace landing: customers discover shops on EasyShopAI itself.
 * Public `GET /shops` directory (soft-validated at the edge of this file;
 * secrets like floor prices never appear in the contract).
 */
import { useEffect, useState } from 'react';
import { shopDirectoryItemSchema, type ShopDirectoryItem } from '@easyshop/shared';
import { api } from '@/lib/api';
import { Spinner, inputClass } from '@/components/ui';

export default function Marketplace() {
  const [q, setQ] = useState('');
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [error, setError] = useState(false);

  const search = (query: string) => {
    setError(false);
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
        setShops(items);
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
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">
            Easy<span className="text-emerald-600">Shop</span>AI
          </span>
          <a
            href="/dashboard"
            className="ml-auto rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Create your shop
          </a>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-5 px-4 py-14 text-center">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
            Shops on EasyShopAI — browse, ask the AI, order cash-on-delivery
          </h1>
          <form
            className="flex w-full max-w-md items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              search(q);
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search shops — fashion, electronics, groceries…"
              className={inputClass}
            />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Search
            </button>
          </form>
          <p className="text-sm text-zinc-500">
            Every shop comes with a full website and an AI sales agent — Bangla, English or
            Banglish.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        {shops === null && !error ? (
          <Spinner label="Loading shops…" />
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            Could not reach EasyShopAI. Refresh to retry.
          </p>
        ) : (shops ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 p-14 text-center">
            <p className="text-sm text-zinc-500">
              No shops{q ? ` matching “${q}”` : ' yet'}. Be the first seller!
            </p>
            <a href="/dashboard" className="text-sm font-medium text-emerald-600 hover:underline">
              Open your shop →
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(shops ?? []).map((s) => (
              <a
                key={s.id}
                href={`/s?shop=${s.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="flex aspect-[16/8] w-full items-center justify-center bg-zinc-100"
                  style={
                    s.theme.primaryColor
                      ? { backgroundColor: `${s.theme.primaryColor}18` }
                      : undefined
                  }
                >
                  {s.topImages[0] ? (
                    <img src={s.topImages[0]} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="text-3xl font-black"
                      style={{ color: s.theme.primaryColor ?? '#059669' }}
                    >
                      {s.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <span className="font-semibold">{s.name}</span>
                  {s.description ? (
                    <span className="line-clamp-2 text-xs text-zinc-500">{s.description}</span>
                  ) : null}
                  <span className="mt-auto flex items-center justify-between pt-2 text-xs">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                      {s.productCount} products
                    </span>
                    <span className="text-emerald-600 opacity-0 transition group-hover:opacity-100">
                      Visit store →
                    </span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: '🌐',
              t: 'A whole website per shop',
              b: 'Sellers pick a template and colors in minutes — their storefront is generated for them.',
            },
            {
              icon: '🤖',
              t: 'A real AI sales agent',
              b: 'It searches the actual catalog, checks stock and prices, bargains within seller set limits, and takes COD orders.',
            },
            {
              icon: '🇧🇩',
              t: 'Built for Bangladesh',
              b: 'Bengali, Banglish or English conversation. Cash on delivery, phone confirmation, home delivery zones.',
            },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="text-xl">{f.icon}</div>
              <h3 className="mt-2 text-sm font-semibold">{f.t}</h3>
              <p className="mt-1 text-xs text-zinc-600">{f.b}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
        EasyShopAI — a marketplace with an AI agent in every store.
      </footer>
    </div>
  );
}
