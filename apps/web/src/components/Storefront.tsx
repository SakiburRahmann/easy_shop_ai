'use client';

/**
 * Customer storefront. Three templates share one catalog, one COD checkout and
 * one AI sales agent; product data rendered here ALWAYS comes from API
 * responses (storefront payload, product detail, chat `cards` events) — never
 * from model text.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  createOrderInputSchema,
  productAvailableStock,
  productSoldOut,
  publicProductDetailSchema,
  storefrontSchema,
  type ChatEvent,
  type ChatProductCard,
  type ProductPublic,
  type Shop,
  type Storefront as StorefrontPayload,
} from '@easyshop/shared';
import { ApiError, api, streamChat, taka, visitorId } from '@/lib/api';
import { Icon } from '@/lib/icons';
import {
  Button,
  CardSkeletonGrid,
  ErrorNote,
  Field,
  Modal,
  Skeleton,
  inputClass,
  useBodyScrollLock,
} from '@/components/ui';
import { TEMPLATE_VISUALS, storefrontFont } from '@/components/storefront/templates';
import { visualsFromStorefront } from '@/components/storefront/theme';
import { decorFor } from '@/components/storefront/decor';
import { StorefrontHeader } from '@/components/storefront/header';
import { StorefrontCatalog } from '@/components/storefront/catalog';
import {
  AnnouncementBar,
  CategoryCollage,
  CategoryIndex,
  CollageHero,
  EditorialHero,
  FeaturedRail,
  IntroStrip,
  PoliciesSection,
  StoryBand,
  TrustRow,
} from '@/components/storefront/sections';

interface StoreRoute {
  slug: string;
  productId: string;
}

interface CartLine {
  key: string;
  product: ProductPublic;
  variantId?: string;
  qty: number;
}

const CART_PREFIX = 'easyshopai.cart.';

function cartLineKey(productId: string, variantId?: string): string {
  return `${productId}:${variantId ?? 'base'}`;
}

function variantOf(product: ProductPublic, variantId?: string) {
  return variantId ? product.variants.find((variant) => variant.id === variantId) : undefined;
}

/** Units a single line may buy, from live variant/product stock. */
function lineStock(product: ProductPublic, variantId?: string): number {
  const variant = variantOf(product, variantId);
  if (variant) return variant.stock;
  return product.variants.length ? 0 : product.stock;
}

function lineUnitPrice(product: ProductPublic, variantId?: string): number {
  return variantOf(product, variantId)?.priceOverride ?? product.price;
}

function readCart(slug: string): CartLine[] {
  if (typeof window === 'undefined' || !slug) return [];
  try {
    const raw = window.localStorage.getItem(CART_PREFIX + slug);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (line): line is CartLine =>
        Boolean(line) &&
        typeof line === 'object' &&
        typeof (line as CartLine).key === 'string' &&
        typeof (line as CartLine).qty === 'number' &&
        Boolean((line as CartLine).product),
    );
  } catch {
    return [];
  }
}

/** Canonical URL is /s?shop=<slug>; /s/<slug> is parsed for deep links. */
function routeFromLocation(): StoreRoute {
  if (typeof window === 'undefined') return { slug: '', productId: '' };
  const search = new URLSearchParams(window.location.search);
  const match = window.location.pathname.match(/^\/s\/([^/]+)\/?$/);
  return {
    slug: search.get('shop') ?? (match ? decodeURIComponent(match[1]) : ''),
    productId: search.get('product') ?? '',
  };
}

export default function Storefront() {
  const [route] = useState<StoreRoute>(routeFromLocation);
  const [data, setData] = useState<StorefrontPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [buyTarget, setBuyTarget] = useState<ProductPublic | null>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [cart, setCart] = useState<CartLine[]>(() => readCart(route.slug));
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!route.slug) return;
    try {
      window.localStorage.setItem(CART_PREFIX + route.slug, JSON.stringify(cart));
    } catch {
      /* storage may be unavailable; checkout still works */
    }
  }, [cart, route.slug]);

  const addToCart = useCallback(
    (product: ProductPublic, variantId: string | undefined, qty: number) => {
      if (productSoldOut(product) || (product.variants.length > 0 && !variantId)) return false;
      const key = cartLineKey(product.id, variantId);
      const max = lineStock(product, variantId);
      if (max <= 0) return false;
      setCart((current) => {
        const existing = current.find((line) => line.key === key);
        if (existing) {
          return current.map((line) =>
            line.key === key ? { ...line, qty: Math.min(max, line.qty + qty) } : line,
          );
        }
        return [
          ...current,
          { key, product, ...(variantId ? { variantId } : {}), qty: Math.min(max, qty) },
        ];
      });
      setNotice(`${product.name} added to cart`);
      return true;
    },
    [],
  );

  const setLineQty = useCallback((key: string, qty: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.key !== key) return [line];
        const max = lineStock(line.product, line.variantId);
        const next = Math.min(max, Math.max(0, qty));
        return next <= 0 ? [] : [{ ...line, qty: next }];
      }),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setCart((current) => current.filter((line) => line.key !== key));
  }, []);

  const buyNow = (product: ProductPublic, variantId: string | undefined, qty: number) => {
    if (!addToCart(product, variantId, qty)) return;
    setBuyTarget(null);
    setCartOpen(true);
  };

  const cartUnits = cart.reduce((sum, line) => sum + line.qty, 0);

  useEffect(() => {
    if (!route.slug) {
      void Promise.resolve().then(() => {
        setNotFound(true);
        setLoading(false);
      });
      return;
    }
    let cancelled = false;
    api<unknown>(`/s/${route.slug}`)
      .then((raw) => {
        if (cancelled) return;
        const parsed = storefrontSchema.safeParse(raw);
        if (parsed.success) setData(parsed.data);
        else setNotFound(true);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
        else setLoadError(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [route.slug]);

  const openBuy = useCallback(
    async (productId: string) => {
      try {
        const parsed = publicProductDetailSchema.safeParse(
          await api<unknown>(`/products/${productId}`),
        );
        if (!parsed.success || parsed.data.shop.slug !== route.slug) return;
        setBuyTarget(parsed.data.product);
      } catch {
        /* product vanished; ignore */
      }
    },
    [route.slug],
  );

  /** Marketplace deep links carry ?product=<id>; open it once data is ready. */
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!data || !route.productId || openedInitial.current) return;
    openedInitial.current = true;
    void openBuy(route.productId);
  }, [data, route.productId, openBuy]);

  const closeBuy = () => {
    setBuyTarget(null);
    if (typeof window !== 'undefined' && window.location.search.includes('product=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('product');
      window.history.replaceState({}, '', url);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-full flex-1 flex-col bg-[#f7f7f6]">
        <Skeleton className="h-[76px] w-full rounded-none" />
        <div className="mx-auto w-full max-w-5xl px-5 py-10">
          <CardSkeletonGrid count={8} />
        </div>
      </div>
    );
  }

  if (notFound || loadError || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon.Store size={22} />
        </div>
        <h1 className="text-lg font-semibold">
          {loadError ? 'Shop unavailable' : 'Shop not found'}
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          {loadError
            ? 'We could not reach this store. Check the API connection and try again.'
            : 'No storefront lives at this address.'}
        </p>
        {loadError ? (
          <Button onClick={() => window.location.reload()}>Try again</Button>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            <Icon.ArrowLeft size={14} />
            Back to the marketplace
          </Link>
        )}
      </div>
    );
  }

  // A shop with an applied theme renders that preset; everyone else keeps the
  // template preset. Both paths use the same section kit.
  const storefront = data.shop.storefront ?? null;
  const preset = storefront
    ? visualsFromStorefront(storefront)
    : TEMPLATE_VISUALS[data.shop.templateId];
  const primary = storefront?.tokens.primary ?? data.shop.theme.primaryColor ?? '#059669';
  const accent = storefront?.tokens.accent ?? data.shop.theme.accentColor ?? '#F59E0B';
  const font = storefrontFont(storefront?.tokens.font ?? data.shop.theme.font, preset.display);
  const radius = storefront?.tokens.radius;
  const density = storefront?.layout.density;
  const copy = storefront?.copy;
  const ink = preset.ink;
  const muted = preset.muted;
  const decor = decorFor(data.shop);

  const pickCategory = (next?: string) => {
    setCategoryId(next);
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ backgroundColor: preset.surface, color: ink }}
      data-es-radius={radius}
      data-es-density={density}
    >
      <StorefrontHeader
        data={data}
        preset={preset}
        primary={primary}
        font={font}
        ink={ink}
        muted={muted}
        cartUnits={cartUnits}
        onCart={() => setCartOpen(true)}
        onPick={pickCategory}
      />

      {preset.sections.map((section) => {
        switch (section) {
          case 'announcement':
            return (
              <AnnouncementBar
                key="announcement"
                shop={data.shop}
                primary={primary}
                {...(copy?.announcement ? { announcement: copy.announcement } : {})}
              />
            );
          case 'intro':
            return (
              <IntroStrip
                key="intro"
                shop={data.shop}
                products={data.products}
                decor={decor}
                primary={primary}
                ink={ink}
                muted={muted}
                font={font}
                {...(copy?.headline ? { headline: copy.headline } : {})}
                {...(copy?.subhead ? { subhead: copy.subhead } : {})}
                {...(copy?.ctaLabel ? { ctaLabel: copy.ctaLabel } : {})}
              />
            );
          case 'hero':
            return preset.hero === 'collage' ? (
              <CollageHero
                key="hero"
                shop={data.shop}
                products={data.products}
                decor={decor}
                primary={primary}
                font={font}
                {...(copy?.headline ? { headline: copy.headline } : {})}
                {...(copy?.subhead ? { subhead: copy.subhead } : {})}
                {...(copy?.ctaLabel ? { ctaLabel: copy.ctaLabel } : {})}
              />
            ) : (
              <EditorialHero
                key="hero"
                shop={data.shop}
                products={data.products}
                decor={decor}
                primary={primary}
                ink={ink}
                muted={muted}
                font={font}
                {...(copy?.headline ? { headline: copy.headline } : {})}
                {...(copy?.subhead ? { subhead: copy.subhead } : {})}
              />
            );
          case 'categoryCollage':
            return (
              <CategoryCollage
                key="categoryCollage"
                categories={data.categories}
                products={data.products}
                ink={ink}
                muted={muted}
                font={font}
                onPick={pickCategory}
              />
            );
          case 'categoryIndex':
            return (
              <CategoryIndex
                key="categoryIndex"
                categories={data.categories}
                products={data.products}
                ink={ink}
                muted={muted}
                font={font}
                onPick={pickCategory}
              />
            );
          case 'rail':
            return (
              <FeaturedRail
                key="rail"
                products={data.products}
                primary={primary}
                ink={ink}
                muted={muted}
                font={font}
                onOpen={openBuy}
                onViewAll={() => pickCategory(undefined)}
              />
            );
          case 'catalog':
            return (
              <StorefrontCatalog
                key="catalog"
                data={data}
                slug={route.slug}
                preset={preset}
                primary={primary}
                font={font}
                ink={ink}
                muted={muted}
                categoryId={categoryId}
                onCategory={pickCategory}
                onBuy={openBuy}
              />
            );
          case 'story':
            return (
              <StoryBand
                key="story"
                shop={data.shop}
                decor={decor}
                primary={primary}
                font={font}
                {...(copy?.story ? { story: copy.story } : {})}
              />
            );
          case 'trust':
            return (
              <TrustRow key="trust" shop={data.shop} primary={primary} ink={ink} muted={muted} />
            );
          case 'policies':
            return (
              <PoliciesSection
                key="policies"
                shop={data.shop}
                ink={ink}
                muted={muted}
                font={font}
              />
            );
          default:
            return null;
        }
      })}

      <footer
        className="border-t px-5 py-7 text-center text-[11px]"
        style={{ borderColor: `${ink}10`, color: muted }}
      >
        <p style={{ fontFamily: font }}>
          {data.shop.name} · shop on{' '}
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            EasyShopAI
          </Link>
        </p>
      </footer>

      {buyTarget ? (
        <ProductModal
          key={buyTarget.id}
          product={buyTarget}
          onClose={closeBuy}
          primary={primary}
          font={font}
          onAdd={addToCart}
          onBuyNow={buyNow}
        />
      ) : null}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart}
        shop={data.shop}
        slug={route.slug}
        primary={primary}
        font={font}
        onQty={setLineQty}
        onRemove={removeLine}
        onPlaced={() => setCart([])}
      />

      {notice ? (
        <div className="pop-in fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-xl">
          {notice}
        </div>
      ) : null}

      <ChatWidget
        shop={data}
        primary={primary}
        accent={accent}
        onSelectProduct={(id) => void openBuy(id)}
      />
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  primary,
  font,
  onAdd,
  onBuyNow,
}: {
  product: ProductPublic;
  onClose: () => void;
  primary: string;
  font?: string;
  onAdd: (product: ProductPublic, variantId: string | undefined, qty: number) => boolean;
  onBuyNow: (product: ProductPublic, variantId: string | undefined, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const chosen = variantOf(product, variantId);
  const needsVariant = product.variants.length > 0;
  const soldOut = productSoldOut(product);
  const totalAvailable = productAvailableStock(product);
  const max = needsVariant ? (chosen?.stock ?? 0) : product.stock;
  const unit = chosen?.priceOverride ?? product.price;
  const canBuy = !soldOut && (!needsVariant || Boolean(chosen)) && max > 0;

  return (
    <Modal open onClose={onClose} title={product.name} wide>
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <div className="flex flex-col gap-2">
          <div className="aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100">
            {product.images[0] ? (
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-300">
                <Icon.Package size={26} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold leading-snug" style={{ fontFamily: font }}>
              {product.name}
            </span>
            <span className="text-sm font-bold" style={{ color: primary }}>
              {taka(unit)}
            </span>
            {soldOut ? (
              <span className="text-xs font-medium text-red-500">Sold out</span>
            ) : (
              <span className="text-[11px] text-zinc-400">
                {needsVariant && !chosen ? totalAvailable : max} available
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-brand-700">
            <Icon.Truck size={13} /> Cash on delivery
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          {product.description ? (
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-zinc-500">
              {product.description}
            </p>
          ) : null}

          {needsVariant ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-zinc-700">Size / color</span>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((variant) => {
                  const label = [variant.size, variant.color].filter(Boolean).join(' · ') || '—';
                  const disabled = variant.stock <= 0;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setVariantId(variant.id);
                        setQty(1);
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                        variantId === variant.id
                          ? 'text-white shadow-sm'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                      } ${disabled ? 'cursor-not-allowed line-through opacity-40' : ''}`}
                      style={
                        variantId === variant.id
                          ? { backgroundColor: primary, borderColor: primary }
                          : undefined
                      }
                    >
                      {label} · {taka(variant.priceOverride ?? product.price)}
                    </button>
                  );
                })}
              </div>
              {!variantId ? (
                <span className="text-[11px] text-zinc-400">Choose an option to continue.</span>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-zinc-700">Quantity</span>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
                disabled={qty <= 1}
              >
                <Icon.Minus size={14} />
              </button>
              <span className="w-7 text-center text-sm font-semibold">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((n) => Math.min(Math.max(1, max), n + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40"
                disabled={qty >= max}
              >
                <Icon.Plus size={14} />
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="soft"
                size="lg"
                className="flex-1"
                disabled={!canBuy}
                onClick={() => {
                  if (onAdd(product, variantId, qty)) onClose();
                }}
                icon={<Icon.Bag size={16} />}
              >
                Add to cart
              </Button>
              <Button
                size="lg"
                className="flex-1"
                disabled={!canBuy}
                onClick={() => onBuyNow(product, variantId, qty)}
              >
                {soldOut ? 'Sold out' : 'Buy now'}
              </Button>
            </div>
            <span className="text-center text-[10px] text-zinc-400">
              No online payment — pay cash when it arrives.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CartDrawer({
  open,
  onClose,
  lines,
  shop,
  slug,
  primary,
  font,
  onQty,
  onRemove,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  shop: Shop;
  slug: string;
  primary: string;
  font?: string;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onPlaced: () => void;
}) {
  const zones = shop.deliveryRules.zones;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ total: number; count: number; phone: string } | null>(
    null,
  );

  useBodyScrollLock(open);

  if (!open) return null;

  const subtotal = lines.reduce(
    (sum, line) => sum + lineUnitPrice(line.product, line.variantId) * line.qty,
    0,
  );
  const deliveryCharge = zones.find((zone) => zone.name === zoneName)?.charge ?? 0;
  const total = subtotal + deliveryCharge;

  const close = () => {
    setPlaced(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (zones.length > 0 && !zoneName) {
      setError('Please choose your delivery area');
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
      ...(note ? { note } : {}),
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? 'Invalid order details');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api<unknown>(`/s/${slug}/orders`, { body: input.data });
      setPlaced({ total, count: lines.reduce((sum, line) => sum + line.qty, 0), phone });
      onPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-zinc-900/35 backdrop-blur-[2px]"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        className="pop-in fixed right-0 top-0 z-50 flex h-full max-h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl"
        role="dialog"
        aria-label="Shopping cart"
      >
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{ backgroundColor: primary }}
        >
          <div>
            <h3 className="text-base font-semibold" style={{ fontFamily: font }}>
              Your cart
            </h3>
            <p className="text-[11px] text-white/75">
              {lines.reduce((sum, line) => sum + line.qty, 0)} item
              {lines.reduce((sum, line) => sum + line.qty, 0) === 1 ? '' : 's'} · cash on delivery
            </p>
          </div>
          <button
            onClick={close}
            aria-label="Close cart"
            className="rounded-full p-1.5 text-white/85 transition hover:bg-white/15"
          >
            <Icon.X size={18} />
          </button>
        </div>

        {placed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: primary }}
            >
              <Icon.Check size={26} />
            </div>
            <h4 className="text-base font-semibold" style={{ fontFamily: font }}>
              ধন্যবাদ! Order placed
            </h4>
            <p className="max-w-xs text-sm text-zinc-500">
              {placed.count} item{placed.count === 1 ? '' : 's'} · total{' '}
              <span className="font-semibold text-zinc-800">{taka(placed.total)}</span>. The shop
              will call you on <span className="font-medium text-zinc-800">{placed.phone}</span> to
              confirm.
            </p>
            <Button variant="ghost" onClick={close} className="mt-2">
              Keep shopping
            </Button>
          </div>
        ) : lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <Icon.Bag size={22} />
            </div>
            <p className="text-sm font-semibold text-zinc-700">Your cart is empty</p>
            <p className="max-w-xs text-xs text-zinc-500">
              Add a product from the catalog, or ask the AI agent to find what you need.
            </p>
            <Button variant="ghost" onClick={close}>
              Browse products
            </Button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="flex flex-1 flex-col overflow-y-auto overscroll-contain"
          >
            <ul className="flex flex-col gap-3 px-4 py-4">
              {lines.map((line) => {
                const max = lineStock(line.product, line.variantId);
                const variant = variantOf(line.product, line.variantId);
                return (
                  <li
                    key={line.key}
                    className="flex gap-3 rounded-2xl border border-zinc-200 p-2.5"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {line.product.images[0] ? (
                        <img
                          src={line.product.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-300">
                          <Icon.Package size={18} />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-800">
                        {line.product.name}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {[variant?.size, variant?.color].filter(Boolean).join(' · ') || 'Standard'}
                      </span>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-0.5">
                          <button
                            type="button"
                            aria-label="Decrease cart quantity"
                            onClick={() => onQty(line.key, line.qty - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
                          >
                            <Icon.Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{line.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase cart quantity"
                            disabled={line.qty >= max}
                            onClick={() => onQty(line.key, line.qty + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
                          >
                            <Icon.Plus size={12} />
                          </button>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: primary }}>
                          {taka(lineUnitPrice(line.product, line.variantId) * line.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(line.key)}
                          className="text-[11px] text-zinc-400 underline hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-3 border-t border-zinc-100 px-4 py-4">
              {zones.length ? (
                <Field label="Delivery area" hint="The AI and checkout use the same zone charges">
                  <select
                    value={zoneName}
                    onChange={(event) => setZoneName(event.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="">Choose your area…</option>
                    {zones.map((zone) => (
                      <option key={zone.name} value={zone.name}>
                        {zone.name} — {taka(zone.charge)} · {zone.etaDays} day
                        {zone.etaDays === 1 ? '' : 's'}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                  <Icon.Truck size={13} className="mr-1 inline" />
                  Delivery charge will be confirmed by the shop on the call.
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your name">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClass}
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="01XXXXXXXXX"
                    className={inputClass}
                    required
                    maxLength={20}
                  />
                </Field>
              </div>
              <Field label="Delivery address">
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  rows={2}
                  className={inputClass}
                  required
                  minLength={5}
                  maxLength={300}
                />
              </Field>
              <Field label="Note (optional)">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={inputClass}
                  maxLength={500}
                  placeholder="e.g. deliver in the evening"
                />
              </Field>

              <ErrorNote message={error} />
            </div>

            <div className="mt-auto flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-4">
              <span className="flex items-center justify-between text-sm text-zinc-500">
                <span>Subtotal</span>
                <span>{taka(subtotal)}</span>
              </span>
              <span className="flex items-center justify-between text-sm text-zinc-500">
                <span>Delivery {zoneName ? `· ${zoneName}` : ''}</span>
                <span>{zones.length ? taka(deliveryCharge) : 'To be confirmed'}</span>
              </span>
              <span className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-800">
                <span>Total</span>
                <span style={{ color: primary }}>{taka(total)}</span>
              </span>
              <Button
                type="submit"
                size="lg"
                disabled={busy}
                className="mt-1 w-full"
                icon={<Icon.Bag size={16} />}
              >
                {busy ? 'Placing order…' : 'Place COD order'}
              </Button>
              <span className="text-center text-[10px] text-zinc-400">
                No online payment — pay cash when it arrives.
              </span>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
/* ──────────────────────────── AI chat widget ───────────────────────────── */

interface ChatMsg {
  role: 'user' | 'assistant' | 'error';
  text: string;
  cards?: ChatProductCard[];
  streaming?: boolean;
}

function ChatWidget({
  shop,
  primary,
  accent,
  onSelectProduct,
}: {
  shop: StorefrontPayload;
  primary: string;
  accent: string;
  onSelectProduct: (productId: string) => void;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('chat') === '1';
  });
  const [draft, setDraft] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>(() =>
    shop.ai.enabled && shop.ai.greeting ? [{ role: 'assistant', text: shop.ai.greeting }] : [],
  );
  const conversationKey = `easyshopai.conv.${shop.shop.slug}`;
  const [conversationId, setConversationId] = useState<string | undefined>(() =>
    typeof window === 'undefined'
      ? undefined
      : (window.localStorage.getItem(conversationKey) ?? undefined),
  );
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [msgs, open, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy || !shop.ai.enabled) return;
    setDraft('');
    setBusy(true);
    setMsgs((current) => [
      ...current,
      { role: 'user', text },
      { role: 'assistant', text: '', streaming: true },
    ]);

    const onEvent = (event: ChatEvent) => {
      if (event.type === 'start') {
        setConversationId(event.conversationId);
        try {
          window.localStorage.setItem(conversationKey, event.conversationId);
        } catch {
          /* storage may be unavailable; chat still works */
        }
        return;
      }
      if (event.type === 'token') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role !== 'assistant') return current;
          return [...current.slice(0, -1), { ...last, text: last.text + event.text }];
        });
        return;
      }
      if (event.type === 'cards') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role === 'assistant') {
            return [...current.slice(0, -1), { ...last, cards: event.cards }];
          }
          return [...current, { role: 'assistant', text: '', cards: event.cards }];
        });
        return;
      }
      if (event.type === 'done') {
        setMsgs((current) => {
          const last = current[current.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            return [...current.slice(0, -1), { ...last, streaming: false }];
          }
          return current;
        });
        return;
      }
      if (event.type === 'error') {
        setMsgs((current) => [...current, { role: 'error', text: event.message }]);
      }
    };

    try {
      await streamChat(
        {
          shopSlug: shop.shop.slug,
          message: text,
          visitorId: visitorId(),
          ...(conversationId ? { conversationId } : {}),
        },
        onEvent,
      );
    } finally {
      setBusy(false);
      setMsgs((current) => {
        const last = current[current.length - 1];
        if (last?.role === 'assistant' && !last.text && !last.cards && last.streaming) {
          return [...current.slice(0, -1), { role: 'assistant', text: '…', streaming: false }];
        }
        return current;
      });
    }
  };

  if (!shop.ai.enabled) return null;

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 text-[13px] font-medium text-white transition hover:brightness-110 sm:bottom-6 sm:right-6"
          style={{ backgroundColor: primary }}
          aria-label={`Chat with ${shop.shop.name}`}
        >
          <Icon.Chat size={15} />
          Chat
        </button>
      ) : null}

      {open ? (
        <div
          className="pop-in fixed bottom-3 right-3 z-40 flex h-[min(620px,88vh)] max-h-[88dvh] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-2xl sm:bottom-5 sm:right-5"
          role="dialog"
          aria-label="AI agent chat"
        >
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3.5">
            <div
              className="flex h-8 w-8 items-center justify-center text-[13px] font-semibold text-white"
              style={{ backgroundColor: primary }}
            >
              {shop.shop.name.slice(0, 1)}
            </div>
            <div className="flex flex-1 flex-col">
              <span className="text-[13px] font-medium leading-tight text-zinc-900">
                {shop.shop.name}
              </span>
              <span className="text-[11px] text-zinc-500">Stock, prices and cash on delivery</span>
            </div>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="p-1.5 text-zinc-500 transition hover:bg-zinc-100"
            >
              <Icon.X size={17} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f7f7f6] px-3 py-4"
          >
            {msgs.map((message, index) => (
              <div
                key={index}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                {message.role === 'user' ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {message.text}
                  </div>
                ) : message.role === 'error' ? (
                  <div className="flex max-w-[92%] items-start gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs text-red-600">
                    <Icon.Alert size={13} className="mt-0.5 shrink-0" />
                    {message.text}
                  </div>
                ) : (
                  <div className="flex max-w-[94%] flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: primary }}
                      >
                        {shop.shop.name.slice(0, 1)}
                      </div>
                      <div className="rounded-2xl rounded-tl-md border border-zinc-200/70 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-zinc-800 shadow-sm">
                        {message.text}
                        {message.streaming ? (
                          <span className="ml-0.5 inline-flex items-center gap-0.5 align-middle">
                            {['0ms', '150ms', '300ms'].map((delay) => (
                              <span
                                key={delay}
                                className="h-1 w-1 animate-bounce rounded-full bg-zinc-400"
                                style={{ animationDelay: delay }}
                              />
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {message.cards?.length ? (
                      <div
                        className={`grid gap-2 ${
                          message.cards.length === 1 ? 'max-w-[70%]' : 'grid-cols-2'
                        }`}
                      >
                        {message.cards.map((card) => (
                          <ChatCard
                            key={card.id}
                            card={card}
                            primary={primary}
                            onSelect={() => onSelectProduct(card.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-2.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
              }}
              placeholder="বাংলা / English / Banglish…"
              className="h-10 flex-1 rounded-full border border-zinc-200 bg-[#f7f7f6] px-4 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ backgroundColor: primary }}
              aria-label="Send message"
            >
              <Icon.Send size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ChatCard({
  card,
  primary,
  onSelect,
}: {
  card: ChatProductCard;
  primary: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label={`View ${card.name}`}
    >
      <div className="aspect-square w-full bg-zinc-100">
        {card.image ? (
          <img
            src={card.image}
            alt={card.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Icon.Package size={22} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-xs font-semibold leading-tight text-zinc-800">
          {card.name}
        </span>
        <span className="flex items-center justify-between gap-1">
          <span className="text-[13px] font-bold" style={{ color: primary }}>
            {taka(card.price)}
          </span>
          {card.stock !== null && card.stock !== undefined ? (
            <span
              className={`text-[10px] ${card.stock > 0 ? 'text-zinc-400' : 'font-medium text-red-500'}`}
            >
              {card.stock > 0 ? `${card.stock} left` : 'sold out'}
            </span>
          ) : null}
        </span>
      </div>
    </button>
  );
}
