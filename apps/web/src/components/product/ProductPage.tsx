'use client';

/**
 * Product detail, matched to the reference: thumbnail rail, large photo,
 * buy column and a quiet facts card on the right. Every price and stock figure
 * comes from the public API; the seller's floor price never leaves the server.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  productAvailableStock,
  productSoldOut,
  publicProductDetailSchema,
  storefrontSchema,
  type ProductPublic,
  type PublicProductDetail,
  type Storefront,
} from '@easyshop/shared';
import { ApiError, api, money } from '@/lib/api';
import { addCartLine, variantOf } from '@/lib/cart';
import { Icon } from '@/lib/icons';
import { Spinner } from '@/components/ui';
import { SiteFooter, SiteHeader } from '@/components/site/header';
import { ProductTile } from '@/components/market/product-tile';

const SWATCHES: Record<string, string> = {
  white: '#f4f1ec',
  natural: '#e4dccd',
  sand: '#d9c7a7',
  cream: '#efe6d6',
  beige: '#dccdb4',
  sage: '#a9b5a0',
  olive: '#8d9570',
  green: '#6f7f5e',
  charcoal: '#4a4a4a',
  black: '#1b1b1b',
  grey: '#a9a9a9',
  gray: '#a9a9a9',
  indigo: '#3d4b6b',
  blue: '#7d95bb',
  navy: '#2b3a55',
  terracotta: '#b96a4b',
  brown: '#8b5e3c',
  pink: '#e3b6b6',
  burgundy: '#6d2f38',
};

function swatch(name?: string): string {
  if (!name) return '#dcd8d1';
  return SWATCHES[name.toLowerCase()] ?? '#dcd8d1';
}

export default function ProductPage() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('id') ?? '';
  const shopHint = params.get('shop') ?? '';

  const [detail, setDetail] = useState<PublicProductDetail | null>(null);
  const [store, setStore] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [qty, setQty] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      void Promise.resolve().then(() => {
        setLoading(false);
        setFailed('This product link is missing its product id.');
      });
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setFailed(null);
    });
    api<unknown>(`/products/${id}`)
      .then(async (raw) => {
        const parsed = publicProductDetailSchema.safeParse(raw);
        if (!parsed.success) throw new Error('Unexpected product response');
        if (cancelled) return;
        setDetail(parsed.data);
        try {
          const storefront = storefrontSchema.safeParse(
            await api<unknown>(`/s/${parsed.data.shop.slug}`),
          );
          if (!cancelled && storefront.success) setStore(storefront.data);
        } catch {
          /* zones and related items are optional enhancements */
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setFailed(
          error instanceof ApiError && error.status === 404
            ? 'This product is no longer available.'
            : 'Could not load this product. Try again in a moment.',
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const product = detail?.product ?? null;
  const shopSlug = detail?.shop.slug ?? shopHint;

  const chosen = product ? variantOf(product, variantId) : undefined;
  const needsVariant = Boolean(product && product.variants.length > 0);
  const soldOut = product ? productSoldOut(product) : false;
  const totalStock = product ? productAvailableStock(product) : 0;
  const maxQty = product ? (needsVariant ? (chosen?.stock ?? 0) : product.stock) : 0;
  const unitPrice = chosen?.priceOverride ?? product?.price ?? 0;
  const canBuy = Boolean(product) && !soldOut && (!needsVariant || Boolean(chosen)) && maxQty > 0;

  const zones = store?.shop.deliveryRules.zones ?? [];
  const cheapestZone = useMemo(() => [...zones].sort((a, b) => a.charge - b.charge)[0], [zones]);
  const related = (store?.products ?? []).filter((item) => item.id !== product?.id).slice(0, 6);

  const add = (thenCart: boolean) => {
    if (!product || !shopSlug || !canBuy) return;
    const ok = addCartLine(shopSlug, product, variantId, qty);
    if (!ok) return;
    if (thenCart) {
      router.push(`/cart?shop=${shopSlug}`);
      return;
    }
    setNotice('Added to your cart');
  };

  const gallery = product ? (product.images.length ? product.images : ['']) : [''];

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-10">
        <nav className="flex flex-wrap items-center gap-1.5 py-4 text-[11.5px] text-muted">
          <Link href="/" className="hover:text-brand-600">
            Home
          </Link>
          <span className="text-[#c6cad3]">&gt;</span>
          <Link href="/search" className="hover:text-brand-600">
            Products
          </Link>
          {detail ? (
            <>
              <span className="text-[#c6cad3]">&gt;</span>
              <Link href={`/s?shop=${detail.shop.slug}`} className="hover:text-brand-600">
                {detail.shop.name}
              </Link>
            </>
          ) : null}
          {product ? (
            <>
              <span className="text-[#c6cad3]">&gt;</span>
              <span className="line-clamp-1 max-w-[40vw] text-ink-soft">{product.name}</span>
            </>
          ) : null}
        </nav>

        {loading ? (
          <div className="py-10">
            <Spinner label="Loading product…" />
          </div>
        ) : failed || !product || !detail ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-16 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-wash text-ink/50">
              <Icon.Package size={20} />
            </div>
            <p className="text-[13px] font-semibold text-ink">{failed ?? 'Product not found'}</p>
            <Link
              href="/search"
              className="mt-1 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-[12.5px] font-semibold text-white"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)_198px] lg:gap-7">
              {/* gallery + thumbnails */}
              <div className="flex gap-3">
                {gallery.length > 1 ? (
                  <div className="flex w-[64px] shrink-0 flex-col gap-2">
                    {gallery.slice(0, 5).map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setImageIndex(index)}
                        aria-label={`View image ${index + 1}`}
                        aria-pressed={imageIndex === index}
                        className={`h-[64px] w-[64px] overflow-hidden rounded-lg border bg-wash transition ${
                          imageIndex === index
                            ? 'border-brand-600'
                            : 'border-line hover:border-[#c9cede]'
                        }`}
                      >
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-xl bg-[#f4f5f7]">
                  {gallery[imageIndex] ? (
                    <img
                      src={gallery[imageIndex]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300">
                      <Icon.Package size={40} />
                    </div>
                  )}
                  {soldOut ? (
                    <span className="absolute left-3 top-3 rounded bg-white/95 px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink">
                      Sold out
                    </span>
                  ) : null}
                </div>
              </div>

              {/* buy column */}
              <div className="flex min-w-0 flex-col">
                <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-[-0.035em] text-ink">
                  {product.name}
                </h1>
                <p className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-ink">
                  {money(unitPrice)}
                </p>
                {!soldOut ? (
                  <p className="mt-1 text-[11.5px] font-medium text-mint-ink">
                    {needsVariant && !chosen ? `${totalStock} in stock` : `${maxQty} in stock`}
                  </p>
                ) : null}

                <Link
                  href={`/s?shop=${detail.shop.slug}`}
                  className="group mt-4 flex items-center gap-2.5 border-y border-line py-3 transition hover:border-[#c9cede]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#101828] text-[11px] font-bold text-white">
                    {detail.shop.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {detail.shop.name}
                    </span>
                    <span className="block text-[11px] text-muted">Trusted seller</span>
                  </span>
                  <Icon.Chevron size={15} className="-rotate-90 text-muted" />
                </Link>

                <p className="mt-3.5 text-[12.5px] leading-[1.65] text-ink-soft/90">
                  {product.description || 'The seller has not added a description yet.'}
                </p>

                {needsVariant ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-[12px] font-semibold text-ink">
                      {product.variants.some((variant) => variant.color) ? 'Color' : 'Option'}
                      {chosen?.color || chosen?.size ? (
                        <span className="ml-1.5 font-normal text-muted">
                          : {chosen.color ?? chosen.size}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant) => {
                        const active = variant.id === variantId;
                        const disabled = variant.stock <= 0;
                        const label = variant.color ?? variant.size ?? 'Standard';
                        return (
                          <button
                            key={variant.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setVariantId(variant.id);
                              setQty(1);
                            }}
                            title={`${label} · ${money(variant.priceOverride ?? product.price)}`}
                            aria-label={label}
                            aria-pressed={active}
                            className={`flex h-8 w-8 items-center justify-center rounded-full border p-0.5 transition ${
                              active ? 'border-brand-600' : 'border-line hover:border-[#c9cede]'
                            } ${disabled ? 'cursor-not-allowed opacity-35' : ''}`}
                          >
                            {variant.color ? (
                              <span
                                className="block h-6 w-6 rounded-full"
                                style={{ backgroundColor: swatch(variant.color) }}
                              />
                            ) : (
                              <span className="text-[10.5px] font-semibold text-ink-soft">
                                {label.slice(0, 3)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {!variantId ? (
                      <span className="text-[11px] text-muted">Choose an option to continue.</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-ink">Quantity</span>
                  <div className="flex h-9 items-center rounded-lg border border-line">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQty((value) => Math.max(1, value - 1))}
                      disabled={qty <= 1}
                      className="flex h-full w-8 items-center justify-center text-muted transition hover:bg-wash disabled:opacity-40"
                    >
                      <Icon.Minus size={13} />
                    </button>
                    <span className="w-8 text-center text-[12.5px] font-semibold tabular-nums">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQty((value) => Math.min(Math.max(1, maxQty), value + 1))}
                      disabled={qty >= maxQty}
                      className="flex h-full w-8 items-center justify-center text-muted transition hover:bg-wash disabled:opacity-40"
                    >
                      <Icon.Plus size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => add(false)}
                    disabled={!canBuy}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {soldOut ? 'Sold out' : 'Add to cart'}
                  </button>
                  <button
                    type="button"
                    onClick={() => add(true)}
                    disabled={!canBuy}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-300 bg-white text-[13px] font-semibold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Buy now
                  </button>
                </div>
                <p className="mt-2 text-[10.5px] text-muted">
                  No online payment — pay cash when it arrives.
                </p>
              </div>

              {/* facts card */}
              <aside className="flex h-fit flex-col gap-4 rounded-xl bg-[#f7f8fa] p-5">
                <Fact
                  icon={<Icon.Truck size={16} />}
                  title="Cash on delivery"
                  body={
                    cheapestZone
                      ? `From ${money(cheapestZone.charge)} · ${cheapestZone.name}, ${cheapestZone.etaDays} day${cheapestZone.etaDays === 1 ? '' : 's'}`
                      : 'The shop confirms the delivery charge on the phone.'
                  }
                />
                <Fact
                  icon={<Icon.Tag size={16} />}
                  title="Easy returns"
                  body={
                    store?.shop.policies.returnPolicy ||
                    'Ask the shop about returns before ordering.'
                  }
                />
                <Fact
                  icon={<Icon.Shield size={16} />}
                  title="Secure checkout"
                  body="Your information is protected."
                />
                <div className="border-t border-[#e3e6ec] pt-4">
                  <Fact
                    icon={<Icon.Store size={16} />}
                    title={`Sold by ${detail.shop.name}`}
                    body="Quality products for a better everyday."
                  />
                  <Link
                    href={`/s?shop=${detail.shop.slug}`}
                    className="mt-3 flex h-9 items-center justify-center rounded-lg bg-brand-50 text-[12px] font-semibold text-brand-700 transition hover:bg-brand-100"
                  >
                    View store
                  </Link>
                </div>
              </aside>
            </div>

            {related.length > 0 ? (
              <section className="mt-12">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="text-[19px] font-extrabold tracking-[-0.03em] text-ink">
                    You might also like
                  </h2>
                  <Link
                    href={`/s?shop=${detail.shop.slug}`}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View all products
                    <Icon.Spark size={12} />
                  </Link>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-6">
                  {related.map((item: ProductPublic) => (
                    <ProductTile
                      key={item.id}
                      product={item}
                      href={`/product?id=${item.id}&shop=${detail.shop.slug}`}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      {notice ? (
        <div className="pop-in fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-xl">
          {notice}
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}

function Fact({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-ink">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11.5px] font-bold leading-snug text-ink">{title}</span>
        <span className="mt-0.5 text-[10.5px] leading-[1.5] text-muted">{body}</span>
      </span>
    </div>
  );
}
