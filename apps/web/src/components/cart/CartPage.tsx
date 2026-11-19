'use client';

/**
 * Cart + COD checkout for one shop at a time (the platform takes one order per
 * seller). Layout follows the reference: a white item card, a quiet grey order
 * summary, then the delivery details the courier needs.
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createOrderInputSchema, storefrontSchema, type Storefront } from '@easyshop/shared';
import { api, money } from '@/lib/api';
import {
  cartSubtotal,
  cartUnits,
  lineStock,
  lineUnitPrice,
  readCart,
  removeCartLine,
  setCartQty,
  shopsWithCarts,
  variantOf,
  type CartLine,
} from '@/lib/cart';
import { Icon } from '@/lib/icons';
import { ErrorNote, Skeleton, inputClass } from '@/components/ui';
import { SiteFooter, SiteHeader } from '@/components/site/header';

export default function CartPage() {
  const params = useSearchParams();
  const requested = params.get('shop') ?? '';

  const [slugs, setSlugs] = useState<string[]>([]);
  const [slug, setSlug] = useState(requested);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [store, setStore] = useState<Storefront | null>(null);
  const [storeFailed, setStoreFailed] = useState(false);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; total: number; phone: string } | null>(null);

  const refresh = useCallback(() => {
    const known = shopsWithCarts();
    setSlugs(known);
    setLines(slug ? readCart(slug) : []);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const known = shopsWithCarts();
      setSlugs(known);
      const next = requested && known.includes(requested) ? requested : (known[0] ?? '');
      setSlug(next);
    });
    return () => {
      cancelled = true;
    };
  }, [requested]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLines(slug ? readCart(slug) : []);
      setStoreFailed(false);
      if (!slug) {
        setStore(null);
        return;
      }
      api<unknown>(`/s/${slug}`)
        .then((raw) => {
          const parsed = storefrontSchema.safeParse(raw);
          if (!cancelled && parsed.success) setStore(parsed.data);
        })
        .catch(() => !cancelled && setStoreFailed(true));
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    api<Array<{ slug: string; name: string }>>('/shops?limit=50')
      .then((rows) => {
        if (cancelled) return;
        setShopNames(Object.fromEntries(rows.map((row) => [row.slug, row.name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const first = store?.shop.deliveryRules.zones[0]?.name;
    if (!first) return;
    void Promise.resolve().then(() => setZoneName((current) => current || first));
  }, [store]);

  const zones = store?.shop.deliveryRules.zones ?? [];
  const subtotal = cartSubtotal(lines);
  const deliveryCharge = zones.find((zone) => zone.name === zoneName)?.charge ?? 0;
  const total = subtotal + deliveryCharge;
  const units = lines.reduce((sum, line) => sum + line.qty, 0);

  const ordersLeft = useMemo(() => slugs.filter((entry) => entry !== slug), [slugs, slug]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!slug) return;
    if (zones.length > 0 && !zoneName) {
      setError('Choose your delivery area');
      return;
    }
    if (!lines.length) return;
    const input = createOrderInputSchema.safeParse({
      items: lines.map((line) => ({
        productId: line.product.id,
        ...(line.variantId ? { variantId: line.variantId } : {}),
        qty: line.qty,
      })),
      customer: { name, phone, address },
      ...(zoneName ? { deliveryZone: zoneName } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Check your order details');
      return;
    }
    setBusy(true);
    try {
      const order = await api<{ id: string; total: number }>(`/s/${slug}/orders`, {
        body: input.data,
      });
      setPlaced({ id: order.id, total: order.total, phone });
      setLines([]);
      setSlugs((current) => current.filter((entry) => entry !== slug));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place the order');
    } finally {
      setBusy(false);
    }
  };

  const empty = slugs.length === 0 && !placed;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-12">
        <div className="pb-6 pt-9">
          <h1 className="text-[clamp(2.1rem,3.6vw,2.6rem)] font-extrabold tracking-[-0.045em] text-ink">
            {placed ? 'Order placed' : 'Your cart'}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Items are confirmed by the seller by phone and paid in cash on delivery.
          </p>
        </div>

        {placed ? (
          <div className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-4 rounded-xl border border-line p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint text-mint-ink">
              <Icon.Check size={26} />
            </span>
            <div>
              <p className="text-[18px] font-extrabold tracking-tight text-ink">
                Thank you. Your order is placed.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                Order <span className="font-mono text-ink">#{placed.id.slice(0, 8)}</span> · total{' '}
                <span className="font-semibold text-ink">{money(placed.total)}</span>. The shop will
                call <span className="font-semibold text-ink">{placed.phone}</span> to confirm
                delivery.
              </p>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {ordersLeft.length > 0 ? (
                <Link
                  href={`/cart?shop=${ordersLeft[0]}`}
                  className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white"
                >
                  Checkout {ordersLeft[0]} ({cartUnits(readCart(ordersLeft[0]))} items)
                </Link>
              ) : null}
              <Link
                href="/search"
                className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-[12.5px] font-semibold text-ink-soft transition hover:bg-wash"
              >
                Keep shopping
              </Link>
            </div>
          </div>
        ) : empty ? (
          <div className="mt-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-wash text-ink/50">
              <Icon.Bag size={22} />
            </span>
            <p className="text-[13px] font-semibold text-ink">Your cart is empty</p>
            <p className="max-w-sm text-[12px] text-muted">
              Add a product from any storefront, or ask a shop&apos;s AI agent to find what you
              need.
            </p>
            <Link
              href="/search"
              className="mt-1 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            {slugs.length > 1 ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {slugs.map((entry) => (
                  <Link
                    key={entry}
                    href={`/cart?shop=${entry}`}
                    className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-semibold transition ${
                      entry === slug
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-line text-ink-soft hover:bg-wash'
                    }`}
                  >
                    {shopNames[entry] ?? entry} · {cartUnits(readCart(entry))}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_336px]">
              <div className="flex flex-col gap-6">
                <div className="overflow-hidden rounded-xl border border-line bg-white">
                  {lines.length === 0 ? (
                    <p className="p-6 text-[13px] text-muted">This cart is empty.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {lines.map((line) => {
                        const max = lineStock(line.product, line.variantId);
                        const variant = variantOf(line.product, line.variantId);
                        const label =
                          [variant?.color, variant?.size].filter(Boolean).join(' · ') || 'Standard';
                        return (
                          <li key={line.key} className="flex gap-4 p-5">
                            <Link
                              href={`/product?id=${line.product.id}&shop=${slug}`}
                              className="h-[80px] w-[100px] shrink-0 overflow-hidden rounded-lg bg-[#f4f5f7]"
                            >
                              {line.product.images[0] ? (
                                <img
                                  src={line.product.images[0]}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-zinc-300">
                                  <Icon.Package size={18} />
                                </span>
                              )}
                            </Link>

                            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_110px_96px]">
                              <div className="min-w-0">
                                <Link
                                  href={`/product?id=${line.product.id}&shop=${slug}`}
                                  className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink hover:text-brand-700"
                                >
                                  {line.product.name}
                                </Link>
                                <p className="mt-0.5 text-[11.5px] text-muted">
                                  Sold by {store?.shop.name ?? slug}
                                </p>
                                {variant ? <p className="text-[11px] text-muted">{label}</p> : null}
                                <p className="mt-1.5 text-[13.5px] font-bold text-ink">
                                  {money(lineUnitPrice(line.product, line.variantId) * line.qty)}
                                </p>
                              </div>

                              <div className="flex h-9 items-center justify-self-start rounded-md border border-line sm:justify-self-center">
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  onClick={() => {
                                    setCartQty(slug, line.key, line.qty - 1);
                                    refresh();
                                  }}
                                  className="flex h-full w-8 items-center justify-center text-muted transition hover:bg-wash"
                                >
                                  <Icon.Minus size={12} />
                                </button>
                                <span className="w-7 text-center text-[12px] font-semibold tabular-nums">
                                  {line.qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  disabled={line.qty >= max}
                                  onClick={() => {
                                    setCartQty(slug, line.key, line.qty + 1);
                                    refresh();
                                  }}
                                  className="flex h-full w-8 items-center justify-center text-muted transition hover:bg-wash disabled:opacity-40"
                                >
                                  <Icon.Plus size={12} />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  removeCartLine(slug, line.key);
                                  refresh();
                                }}
                                className="flex items-center gap-1.5 justify-self-end text-[12px] font-medium text-muted transition hover:text-red-600"
                              >
                                <Icon.Trash size={13} />
                                Remove
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <Link
                  href={slug ? `/s?shop=${slug}` : '/search'}
                  className="flex w-fit items-center gap-2 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Icon.ArrowLeft size={14} />
                  Continue shopping
                </Link>

                <form
                  onSubmit={submit}
                  id="checkout"
                  className="flex flex-col gap-4 rounded-xl border border-line bg-white p-5"
                >
                  <div>
                    <h2 className="text-[15px] font-extrabold tracking-tight text-ink">
                      Delivery details
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-muted">
                      The shop calls this number to confirm the order.
                    </p>
                  </div>

                  {storeFailed ? (
                    <ErrorNote message="Could not load the shop's delivery zones. Reload the page before ordering." />
                  ) : null}

                  {zones.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-ink-soft">Delivery area</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {zones.map((zone) => (
                          <button
                            key={zone.name}
                            type="button"
                            onClick={() => setZoneName(zone.name)}
                            aria-pressed={zoneName === zone.name}
                            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                              zoneName === zone.name
                                ? 'border-brand-600 bg-brand-50'
                                : 'border-line hover:border-brand-300'
                            }`}
                          >
                            <span>
                              <span className="block text-[12px] font-semibold text-ink">
                                {zone.name}
                              </span>
                              <span className="block text-[10.5px] text-muted">
                                {zone.etaDays} day{zone.etaDays === 1 ? '' : 's'}
                              </span>
                            </span>
                            <span className="text-[12px] font-bold text-ink">
                              {money(zone.charge)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-wash px-3 py-2.5 text-[11px] text-muted">
                      <Icon.Truck size={13} className="mr-1 inline" />
                      This shop charges delivery on the phone — nothing added to the total now.
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-ink-soft">Full name</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className={inputClass}
                        required
                        maxLength={80}
                        autoComplete="name"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-ink-soft">Phone</span>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+1 555 000 1234"
                        className={inputClass}
                        required
                        maxLength={20}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-ink-soft">
                      Delivery address
                    </span>
                    <textarea
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      rows={2}
                      className={inputClass}
                      required
                      minLength={5}
                      maxLength={300}
                      placeholder="Street, apartment, city"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-ink-soft">
                      Note for the shop (optional)
                    </span>
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className={inputClass}
                      maxLength={500}
                      placeholder="e.g. call before delivery"
                    />
                  </label>

                  <ErrorNote message={error} />
                </form>
              </div>

              {/* ─────────────────────── order summary ─────────────────────── */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="flex flex-col gap-4 rounded-xl bg-[#f5f6f9] p-6">
                  <h2 className="text-[17px] font-extrabold tracking-[0.01em] text-ink">
                    Order summary
                  </h2>
                  <div className="flex flex-col gap-2.5 text-[12.5px]">
                    <span className="flex items-center justify-between text-[#6b7280]">
                      <span>
                        Subtotal ({units} item{units === 1 ? '' : 's'})
                      </span>
                      <span className="font-medium text-ink">{money(subtotal)}</span>
                    </span>
                    <span className="flex items-center justify-between text-[#6b7280]">
                      <span>Shipping {zoneName ? `· ${zoneName}` : ''}</span>
                      <span className="font-medium text-ink">
                        {zones.length ? money(deliveryCharge) : 'On the phone'}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#e0e3ea] pt-3.5">
                    <span className="text-[14px] font-bold text-ink">Total</span>
                    <span className="text-[21px] font-extrabold tracking-[-0.03em] text-ink">
                      {money(total)}
                    </span>
                  </div>
                  <button
                    type="submit"
                    form="checkout"
                    disabled={busy || lines.length === 0}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 text-[13px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? 'Placing order…' : 'Proceed to checkout'}
                    {!busy ? <Icon.ArrowRight size={15} /> : null}
                  </button>

                  <ul className="flex flex-col gap-4 border-t border-[#e0e3ea] pt-4">
                    <TrustRow
                      icon={<Icon.Shield size={16} />}
                      title="Secure checkout"
                      body="Your information is protected."
                    />
                    <TrustRow
                      icon={<Icon.Truck size={16} />}
                      title="Cash on delivery"
                      body="Pay the courier when it arrives."
                    />
                    <TrustRow
                      icon={<Icon.Store size={16} />}
                      title="One seller, one order"
                      body="Items from another shop checkout separately."
                    />
                  </ul>
                </div>

                {store ? (
                  <Link
                    href={`/s?shop=${store.shop.slug}`}
                    className="mt-3 flex items-center gap-2 rounded-lg border border-line px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
                      {store.shop.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-ink">
                        {store.shop.name}
                      </span>
                      <span className="block text-[10.5px] text-muted">Visit the storefront</span>
                    </span>
                    <Icon.ArrowRight size={14} className="text-muted" />
                  </Link>
                ) : store === null && slug && !storeFailed ? (
                  <Skeleton className="mt-3 h-14 w-full rounded-lg" />
                ) : null}
              </aside>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function TrustRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-ink">{icon}</span>
      <span>
        <span className="block text-[11.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[10.5px] leading-relaxed text-muted">{body}</span>
      </span>
    </li>
  );
}
