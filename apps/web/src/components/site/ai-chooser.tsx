'use client';

/**
 * "Chat with AI" entry point. Every assistant is scoped to one seller, so the
 * chooser asks which shop to talk to, then opens that storefront with its chat
 * already expanded (`/s?shop=slug&chat=1`).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BUSINESS_TYPE_PRESETS, shopDirectoryItemSchema, type ShopDirectoryItem } from '@easyshop/shared';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { Modal, Spinner } from '@/components/ui';

export function AiChooser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [shops, setShops] = useState<ShopDirectoryItem[] | null>(null);
  const [q, setQ] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || shops) return;
    let cancelled = false;
    api<unknown[]>('/shops?limit=50')
      .then((rows) => {
        if (cancelled) return;
        const items = rows
          .map((row) => shopDirectoryItemSchema.safeParse(row))
          .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
        setShops(items);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open, shops]);

  const needle = q.trim().toLowerCase();
  const visible = (shops ?? []).filter(
    (shop) =>
      !needle ||
      shop.name.toLowerCase().includes(needle) ||
      BUSINESS_TYPE_PRESETS[shop.businessType].label.toLowerCase().includes(needle),
  );

  return (
    <Modal open={open} onClose={onClose} title="Chat with a shop">
      <p className="-mt-1 mb-4 text-[12.5px] leading-relaxed text-muted">
        Each assistant only knows its own shop&apos;s catalog, stock, delivery zones and prices.
        Pick a shop to start.
      </p>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-wash px-3">
        <Icon.Search size={15} className="text-muted" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Find a shop…"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
          autoFocus
        />
      </div>

      {failed ? (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
          Could not load shops right now. Try again from a storefront.
        </p>
      ) : shops === null ? (
        <Spinner label="Loading shops…" />
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No shop matches that search yet.</p>
      ) : (
        <ul className="flex max-h-[52vh] flex-col gap-1.5 overflow-y-auto">
          {visible.map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/s?shop=${shop.slug}&chat=1`);
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left transition hover:border-line hover:bg-wash"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-50 text-[15px] font-bold text-brand-700">
                  {shop.topImages[0] ? (
                    <img src={shop.topImages[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    shop.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">
                    {shop.name}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {BUSINESS_TYPE_PRESETS[shop.businessType].label} · {shop.productCount}{' '}
                    {shop.productCount === 1 ? 'product' : 'products'}
                  </span>
                </span>
                <Icon.ArrowRight size={15} className="shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
