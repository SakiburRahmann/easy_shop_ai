'use client';

/** COD order management: stats, list with items, status transitions. */
import { useEffect, useState } from 'react';
import { type OrderView, type Shop, orderViewSchema } from '@easyshop/shared';
import { Badge, EmptyState, ErrorNote, Spinner, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
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

  const live = orders ?? [];
  const stats = [
    {
      label: 'Pending',
      value: live.filter((o) => o.status === 'pending').length,
      tone: 'bg-amber-50 text-amber-700',
      icon: <Icon.Clock size={15} />,
    },
    {
      label: 'In progress',
      value: live.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length,
      tone: 'bg-sky-50 text-sky-700',
      icon: <Icon.Truck size={15} />,
    },
    {
      label: 'Delivered',
      value: live.filter((o) => o.status === 'delivered').length,
      tone: 'bg-brand-50 text-brand-700',
      icon: <Icon.Check size={15} />,
    },
    {
      label: 'Revenue',
      value: live.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
      money: true,
      tone: 'bg-zinc-100 text-zinc-800',
      icon: <Icon.Wallet size={15} />,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Orders ({orders?.length ?? 0})</h2>
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

      {!orders ? null : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-1 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}>
                {s.icon}
              </span>
              <span className="mt-1 text-lg font-bold tracking-tight text-zinc-900">
                {'money' in s && s.money ? taka(s.value) : s.value}
              </span>
              <span className="text-xs text-zinc-500">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {error ? <ErrorNote message={error} /> : null}
      {orders === null ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No orders here yet"
          body="Orders arrive from the AI chat and the storefront — cash on delivery, phone-confirmed."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">#{o.id.slice(0, 8)}</span>
                <Badge tone={TONE[o.status] ?? 'zinc'}>{o.status}</Badge>
                <select
                  value={o.status}
                  onChange={(e) => void setStatus(o.id, e.target.value)}
                  aria-label={`Order ${o.id.slice(0, 8)} status`}
                  className={`${inputClass} w-auto px-2 py-1 text-xs`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-400">
                  {new Date(o.createdAt).toLocaleString()}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500">
                  {o.source === 'ai' ? <Icon.Spark size={12} /> : <Icon.Bag size={12} />}
                  {o.source === 'ai' ? 'via AI chat' : 'via storefront'}
                </span>
                <span className="min-w-[72px] text-right text-sm font-bold">{taka(o.total)}</span>
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
                      <img src={it.image} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-300">
                        <Icon.Package size={13} />
                      </span>
                    )}
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
                <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <Icon.Message size={12} className="mt-0.5 shrink-0" />
                  {o.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
