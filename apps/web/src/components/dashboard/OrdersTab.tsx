'use client';

/** COD order management: stat cards, filterable table, inline order details. */
import { useEffect, useState } from 'react';
import { type OrderView, type Shop, orderViewSchema } from '@easyshop/shared';
import { Badge, EmptyState, ErrorNote, Spinner, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { money } from '@/lib/api';
import type { Api } from './Dashboard';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
const TONE: Record<string, 'amber' | 'green' | 'zinc' | 'red' | 'blue'> = {
  pending: 'amber',
  confirmed: 'blue',
  shipped: 'blue',
  delivered: 'green',
  cancelled: 'red',
};

export default function OrdersTab({ auth, shop }: { auth: Api; shop: Shop }) {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

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
      icon: <Icon.Clock size={17} />,
    },
    {
      label: 'In progress',
      value: live.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length,
      tone: 'bg-brand-50 text-brand-700',
      icon: <Icon.Truck size={17} />,
    },
    {
      label: 'Delivered',
      value: live.filter((o) => o.status === 'delivered').length,
      tone: 'bg-mint text-mint-ink',
      icon: <Icon.Check size={17} />,
    },
    {
      label: 'Revenue',
      value: live.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
      money: true,
      tone: 'bg-[#fff1e6] text-[#a9651c]',
      icon: <Icon.Wallet size={17} />,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight text-ink">Orders</h2>
          <p className="text-[12px] text-muted">
            {orders?.length ?? 0} total · confirm, ship and close cash-on-delivery orders
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${inputClass} h-10 w-auto py-0`}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {orders !== null ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full ${s.tone}`}>
                {s.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-ink">
                  {'money' in s && s.money ? money(s.value) : s.value}
                </span>
                <span className="text-[11.5px] text-muted">{s.label}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {orders === null ? (
        <Spinner label="Loading orders…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No orders here yet"
          body="Orders arrive from the AI chat and the storefront — cash on delivery, phone-confirmed."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="hidden grid-cols-[90px_1fr_1fr_130px_110px_40px] gap-3 border-b border-line bg-wash/70 px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted lg:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Date / source</span>
            <span>Status</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          <ul className="divide-y divide-line">
            {visible.map((o) => {
              const open = expanded === o.id;
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : o.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-wash/60 lg:grid-cols-[90px_1fr_1fr_130px_110px_40px]"
                  >
                    <span className="hidden font-mono text-[11.5px] font-semibold text-ink lg:block">
                      #{o.id.slice(0, 6)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {o.customerName}
                      </span>
                      <span className="block truncate text-[11px] text-muted lg:hidden">
                        #{o.id.slice(0, 6)} · {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                      <span className="hidden truncate text-[11px] text-muted lg:block">
                        {o.customerPhone}
                      </span>
                    </span>
                    <span className="hidden min-w-0 lg:block">
                      <span className="block text-[11.5px] text-ink-soft">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 text-[10.5px] text-muted">
                        {o.source === 'ai' ? <Icon.Spark size={11} /> : <Icon.Bag size={11} />}
                        {o.source === 'ai' ? 'AI chat' : 'Storefront'}
                      </span>
                    </span>
                    <span className="hidden lg:block">
                      <Badge tone={TONE[o.status] ?? 'zinc'}>{o.status}</Badge>
                    </span>
                    <span className="flex items-center justify-end gap-2 text-[13px] font-bold text-ink">
                      <span className="lg:hidden">
                        <Badge tone={TONE[o.status] ?? 'zinc'}>{o.status}</Badge>
                      </span>
                      {money(o.total)}
                    </span>
                    <Icon.Chevron
                      size={15}
                      className={`hidden text-muted transition lg:block ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {open ? (
                    <div className="border-t border-line bg-wash/40 px-4 py-3.5">
                      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                        <div className="flex flex-col gap-2">
                          <ul className="flex flex-col gap-1.5">
                            {o.items.map((it) => (
                              <li key={it.id} className="flex items-center gap-2.5">
                                {it.image ? (
                                  <img
                                    src={it.image}
                                    alt=""
                                    className="h-9 w-9 rounded-lg object-cover"
                                  />
                                ) : (
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-300">
                                    <Icon.Package size={14} />
                                  </span>
                                )}
                                <span className="flex-1 text-[12px] text-ink-soft">
                                  {it.qty} × {it.name}
                                  {it.size || it.color
                                    ? ` (${[it.size, it.color].filter(Boolean).join(', ')})`
                                    : ''}
                                </span>
                                <span className="text-[12px] font-semibold text-ink">
                                  {money(it.unitPrice * it.qty)}
                                </span>
                              </li>
                            ))}
                            {o.deliveryCharge > 0 ? (
                              <li className="flex items-center justify-between border-t border-line pt-2 text-[11.5px] text-muted">
                                <span className="flex items-center gap-1.5">
                                  <Icon.Truck size={12} /> Delivery
                                </span>
                                <span>{money(o.deliveryCharge)}</span>
                              </li>
                            ) : null}
                          </ul>
                          {o.note ? (
                            <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[11.5px] text-amber-800">
                              <Icon.Message size={12} className="mt-0.5 shrink-0" />
                              {o.note}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <p className="text-[11px] text-muted">Deliver to</p>
                          <p className="text-[12px] leading-relaxed text-ink-soft">
                            {o.customerAddress}
                          </p>
                          <p className="text-[12px] text-ink-soft">{o.customerPhone}</p>
                          <label className="mt-1 flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">
                              Update status
                            </span>
                            <select
                              value={o.status}
                              onChange={(e) => void setStatus(o.id, e.target.value)}
                              aria-label={`Order ${o.id.slice(0, 6)} status`}
                              className={`${inputClass} h-9 py-0 text-[12px]`}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
