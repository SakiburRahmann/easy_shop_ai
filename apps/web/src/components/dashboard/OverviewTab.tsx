'use client';

/**
 * Store overview, matched to the reference: three stat cards, the recent-order
 * table, the top-performing product list and two growth cards. Every figure is
 * derived from the seller's own orders and products — no sample data.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  orderViewSchema,
  productAdminSchema,
  type OrderView,
  type ProductAdmin,
  type Shop,
} from '@easyshop/shared';
import { money } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { ErrorNote, Spinner } from '@/components/ui';
import type { Api } from './Dashboard';

export type DashboardTab = 'overview' | 'products' | 'orders' | 'chats' | 'theme' | 'settings';

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-brand-50 text-brand-700',
  shipped: 'bg-[#f0edff] text-[#5a4bc4]',
  delivered: 'bg-mint text-mint-ink',
  cancelled: 'bg-red-50 text-red-600',
};

const RANK_LABEL = ['Top seller', 'Strong sales', 'Steady sales', 'Growing', 'New'];

export default function OverviewTab({
  auth,
  shop,
  onTab,
}: {
  auth: Api;
  shop: Shop;
  onTab: (tab: DashboardTab) => void;
}) {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [products, setProducts] = useState<ProductAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      auth<unknown[]>(`/shops/${shop.id}/orders?limit=50`),
      auth<unknown[]>(`/shops/${shop.id}/products?limit=100`),
    ])
      .then(([orderRows, productRows]) => {
        if (cancelled) return;
        setError(null);
        setOrders(orderRows.map((row) => orderViewSchema.parse(row)));
        setProducts(productRows.map((row) => productAdminSchema.parse(row)));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load overview');
      });
    return () => {
      cancelled = true;
    };
  }, [auth, shop.id]);

  const stats = useMemo(() => {
    const live = (orders ?? []).filter((order) => order.status !== 'cancelled');
    const sales = live.reduce((sum, order) => sum + order.total, 0);
    const pending = (orders ?? []).filter((order) => order.status === 'pending').length;
    const active = (products ?? []).filter((product) => product.active).length;
    return [
      {
        label: 'Total sales',
        value: orders === null ? '—' : money(sales),
        hint: `${live.length} cash-on-delivery orders`,
        tone: 'bg-[#e7f3ec] text-[#2f7a54]',
        icon: <Icon.Wallet size={17} />,
      },
      {
        label: 'Total orders',
        value: orders === null ? '—' : String(orders.length),
        hint: pending ? `${pending} waiting to confirm` : 'All caught up',
        tone: 'bg-brand-50 text-brand-700',
        icon: <Icon.Bag size={17} />,
      },
      {
        label: 'Active products',
        value: products === null ? '—' : String(active),
        hint: `${products?.length ?? 0} currently listed`,
        tone: 'bg-[#fdeee4] text-[#bd6a34]',
        icon: <Icon.Package size={17} />,
      },
    ];
  }, [orders, products]);

  /** Real units sold per product, from order line items. */
  const topProducts = useMemo(() => {
    const sold = new Map<string, { units: number; revenue: number }>();
    for (const order of orders ?? []) {
      if (order.status === 'cancelled') continue;
      for (const item of order.items) {
        const entry = sold.get(item.productId) ?? { units: 0, revenue: 0 };
        entry.units += item.qty;
        entry.revenue += item.unitPrice * item.qty;
        sold.set(item.productId, entry);
      }
    }
    return [...sold.entries()]
      .map(([id, value]) => ({
        product: (products ?? []).find((product) => product.id === id),
        id,
        ...value,
      }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [orders, products]);

  const recent = (orders ?? []).slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-3.5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-start gap-3 rounded-xl border border-line bg-white p-4"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stat.tone}`}
            >
              {stat.icon}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[12px] font-semibold text-ink">{stat.label}</span>
              <span className="mt-0.5 truncate text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-ink">
                {stat.value}
              </span>
              <span className="mt-0.5 text-[10.5px] text-muted">{stat.hint}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.35fr_1fr]">
        {/* recent orders */}
        <div className="min-w-0 rounded-xl border border-line bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold tracking-[-0.02em] text-ink">
              Recent orders
            </h2>
            <button
              type="button"
              onClick={() => onTab('orders')}
              className="text-[11px] font-semibold text-brand-600 hover:underline"
            >
              View all orders
            </button>
          </div>

          {orders === null ? (
            <Spinner label="Loading orders…" />
          ) : recent.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted">
              No orders yet. Share your storefront to get the first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[10.5px] font-medium text-muted">
                    <th className="pb-1.5 font-medium">Order #</th>
                    <th className="pb-1.5 font-medium">Date</th>
                    <th className="pb-1.5 font-medium">Customer</th>
                    <th className="pb-1.5 font-medium">Status</th>
                    <th className="pb-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id} className="border-b border-line/70 last:border-0">
                      <td className="py-2 text-[11.5px] font-semibold text-ink">
                        #{order.id.slice(0, 4)}
                      </td>
                      <td className="py-2 text-[11.5px] text-muted">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="max-w-[120px] truncate py-2 text-[11.5px] text-ink-soft">
                        {order.customerName}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            STATUS_CLASS[order.status] ?? 'bg-wash text-ink-soft'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2 text-right text-[11.5px] font-semibold text-ink">
                        {money(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* top products */}
        <div className="min-w-0 rounded-xl border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold tracking-[-0.02em] text-ink">
              Top performing products
            </h2>
            <button
              type="button"
              onClick={() => onTab('products')}
              className="text-[11px] font-semibold text-brand-600 hover:underline"
            >
              View all
            </button>
          </div>

          {products === null ? (
            <Spinner label="Loading products…" />
          ) : topProducts.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted">
              Your best sellers will appear here after the first orders.
            </p>
          ) : (
            <ul className="flex flex-col">
              {topProducts.map((entry, index) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2.5 border-b border-line/70 py-2 last:border-0"
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[#f4f5f7]">
                    {entry.product?.images[0] ? (
                      <img
                        src={entry.product.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-zinc-300">
                        <Icon.Package size={13} />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-semibold text-ink">
                      {entry.product?.name ?? 'Removed product'}
                    </span>
                    <span className="block truncate text-[10px] text-muted">
                      {entry.units} unit{entry.units === 1 ? '' : 's'} sold · {money(entry.revenue)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-semibold ${
                      index === 0 ? 'text-brand-600' : 'text-muted'
                    }`}
                  >
                    {RANK_LABEL[index] ?? 'Growing'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* growth cards */}
      <div className="grid gap-3.5 md:grid-cols-2">
        <div className="flex items-center justify-between gap-3 overflow-hidden rounded-xl bg-[#e6f2ea] p-5">
          <div>
            <p className="text-[15px] font-extrabold tracking-[-0.02em] text-[#173a2e]">
              Add more products
            </p>
            <p className="mt-1 max-w-[24ch] text-[11px] leading-relaxed text-[#3f5b4f]">
              Reach more customers and grow your store on EasyShopAI.
            </p>
            <button
              type="button"
              onClick={() => onTab('products')}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[11.5px] font-semibold text-white transition hover:bg-brand-700"
            >
              <Icon.Plus size={13} />
              Add product
            </button>
          </div>
          <img
            src="/images/dash-boxes.jpg"
            alt=""
            aria-hidden="true"
            className="hidden h-[96px] w-[132px] shrink-0 rounded-lg object-cover sm:block"
          />
        </div>

        <div className="flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-line bg-white p-5">
          <div>
            <p className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
              Tips for seller success
            </p>
            <p className="mt-1 max-w-[26ch] text-[11px] leading-relaxed text-muted">
              Your AI assistant answers stock, price and delivery questions 24/7.
            </p>
            <button
              type="button"
              onClick={() => onTab('chats')}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[11.5px] font-semibold text-ink transition hover:border-brand-300"
            >
              View chat history
              <Icon.ArrowRight size={12} />
            </button>
          </div>
          <img
            src="/images/dash-desk.jpg"
            alt=""
            aria-hidden="true"
            className="hidden h-[96px] w-[132px] shrink-0 rounded-lg object-cover sm:block"
          />
        </div>
      </div>
    </div>
  );
}
