'use client';

/** COD order management: list with items, status transitions. */
import { useEffect, useState } from 'react';
import { type OrderView, type Shop, orderViewSchema } from '@easyshop/shared';
import { Badge, Spinner, inputClass } from '@/components/ui';
import { taka } from '@/lib/api';
import type { Api } from './Dashboard';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
const TONE: Record<string, 'amber' | 'green' | 'zinc' | 'red'> = {
  pending: 'amber',
  confirmed: 'green',
  shipped: 'green',
  delivered: 'zinc',
  cancelled: 'red',
};

export default function OrdersTab({ auth, shop }: { auth: Api; shop: Shop }) {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    auth<unknown[]>(`/shops/${shop.id}/orders?limit=50`)
      .then((list) => {
        if (cancelled) return;
        setError(null);
        setOrders(list.map((o) => orderViewSchema.parse(o)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load orders');
      });
    return () => {
      cancelled = true;
    };
  }, [auth, shop.id]);

  /** Handler-invoked refresh (never called directly inside an effect). */
  const refetch = () => {
    auth<unknown[]>(`/shops/${shop.id}/orders?limit=50`)
      .then((list) => {
        setError(null);
        setOrders(list.map((o) => orderViewSchema.parse(o)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load orders'));
  };

  const setStatus = async (id: string, status: string) => {
    await auth(`/orders/${id}/status`, { method: 'PATCH', body: { status } });
    refetch();
  };

  const visible = (orders ?? []).filter((o) => filter === 'all' || o.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Orders ({orders?.length ?? 0})</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}
      {orders === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">
          No orders yet. They arrive from the AI chat and the storefront.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((o) => (
            <li key={o.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">#{o.id.slice(0, 8)}</span>
                <select
                  value={o.status}
                  onChange={(e) => void setStatus(o.id, e.target.value)}
                  className={`${inputClass} w-auto py-1 text-xs`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <Badge tone={TONE[o.status] ?? 'zinc'}>{o.status}</Badge>
                <span className="text-xs text-zinc-400">
                  {o.source === 'ai' ? '🤖 via AI chat' : '🛍️ via storefront'} ·{' '}
                  {new Date(o.createdAt).toLocaleString()}
                </span>
                <span className="ml-auto text-sm font-bold">{taka(o.total)}</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <span>
                  <span className="font-medium">{o.customerName}</span> · {o.customerPhone}
                </span>
                <span className="text-zinc-500">{o.customerAddress}</span>
              </div>
              <ul className="mt-2 flex flex-col gap-1 border-t border-zinc-100 pt-2 text-xs">
                {o.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2">
                    {it.image ? (
                      <img src={it.image} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : null}
                    <span className="flex-1">
                      {it.qty} × {it.name}
                      {it.size || it.color
                        ? ` (${[it.size, it.color].filter(Boolean).join(', ')})`
                        : ''}
                    </span>
                    <span className="text-zinc-500">{taka(it.unitPrice * it.qty)}</span>
                  </li>
                ))}
              </ul>
              {o.note ? (
                <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  📝 {o.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
