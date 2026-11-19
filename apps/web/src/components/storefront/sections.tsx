'use client';

/**
 * Storefront section registry. Every template composes the storefront from
 * these blocks (the Shopify "sections" / Odoo "building blocks" model):
 * marquee, retail intro, immersive hero, editorial hero, category mosaic and
 * index, product rail, story split, trust strip, policy block and catalogue
 * cards.
 *
 * Rules that keep this out of generated-page territory:
 *  - no gradient text, no blur blobs, no pills above headings, no icon boxes;
 *  - one deliberate motion moment per screen, never a fade on every element;
 *  - shape carries meaning: retail cards are square-cornered, gallery cards
 *    are soft, editorial cards are frameless;
 *  - product cards only ever show the seller's own product photography.
 */
import type { Category, ProductPublic, Shop } from '@easyshop/shared';
import { productAvailableStock, productSoldOut } from '@easyshop/shared';
import { money } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { Reveal } from '@/components/storefront/motion';
import type { DecorSet } from '@/components/storefront/decor';

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8';

/**
 * Decorative photography with a safety net: if the CDN refuses an id, the frame
 * swaps to another verified shot, and only hides itself if that also fails — a
 * storefront never shows a broken image icon.
 */
function DecorImg({
  src,
  fallback,
  className,
}: {
  src: string;
  fallback: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={className}
      onError={(event) => {
        const image = event.currentTarget;
        if (image.dataset.fallback === '1') {
          image.style.visibility = 'hidden';
          return;
        }
        image.dataset.fallback = '1';
        image.src = fallback;
      }}
    />
  );
}

function productImage(products: readonly ProductPublic[]): string | undefined {
  return products.find((product) => product.images[0])?.images[0];
}

function categoryImage(category: Category, products: readonly ProductPublic[]): string | undefined {
  return products.find((product) => product.categoryId === category.id && product.images[0])
    ?.images[0];
}

/**
 * Fallback line for shops that have not written their own. Built from the
 * shop's numbers, so it cannot be pasted onto a different shop's page.
 */
function shopNote(shop: Shop, products: readonly ProductPublic[]): string {
  const zone = shop.deliveryRules.zones[0];
  const count = `${products.length} ${products.length === 1 ? 'item' : 'items'} listed`;
  if (!zone) return `${count}. Cash on delivery across Bangladesh.`;
  return `${count}. Delivery $${zone.charge} in ${zone.name}, about ${zone.etaDays} ${
    zone.etaDays === 1 ? 'day' : 'days'
  }.`;
}

/* ─────────────────────────────── product cards ────────────────────────── */

export type CardVariant = 'dense' | 'tall' | 'editorial';

export function ProductCard({
  product,
  variant,
  primary,
  ink,
  muted,
  font,
  onOpen,
}: {
  product: ProductPublic;
  variant: CardVariant;
  primary: string;
  ink: string;
  muted: string;
  font?: string;
  onOpen: (productId: string) => void;
}) {
  const soldOut = productSoldOut(product);
  const stock = productAvailableStock(product);
  const lowStock = !soldOut && stock <= 5;

  if (variant === 'editorial') {
    return (
      <button
        onClick={() => onOpen(product.id)}
        className="group block w-full text-left"
        aria-label={`View ${product.name}`}
      >
        <div className="relative w-full overflow-hidden bg-[#efede9]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="aspect-[4/5] h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center" style={{ color: muted }}>
              <Icon.Package size={24} />
            </div>
          )}
          {soldOut ? (
            <span className="absolute inset-x-0 bottom-0 bg-[#171512]/85 py-2 text-center text-[10px] uppercase tracking-[0.22em] text-white">
              Sold out
            </span>
          ) : null}
        </div>
        <div
          className="mt-5 flex items-baseline justify-between gap-4 border-b pb-3"
          style={{ borderColor: `${ink}18` }}
        >
          <span className="text-[17px] leading-snug" style={{ fontFamily: font, color: ink }}>
            {product.name}
          </span>
          <span className="shrink-0 text-[12px] tabular-nums" style={{ color: muted }}>
            {money(product.price)}
          </span>
        </div>
        {lowStock ? (
          <span
            className="mt-2 block text-[10px] uppercase tracking-[0.2em]"
            style={{ color: primary }}
          >
            Only {stock} left
          </span>
        ) : null}
      </button>
    );
  }

  if (variant === 'tall') {
    return (
      <button
        onClick={() => onOpen(product.id)}
        className="group block w-full text-left"
        aria-label={`View ${product.name}`}
      >
        <div className="relative w-full overflow-hidden rounded-2xl bg-[#f2f4f9]">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="aspect-[3/4] h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center" style={{ color: muted }}>
              <Icon.Package size={24} />
            </div>
          )}
          {soldOut ? (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0e1424]">
              Sold out
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-start justify-between gap-2">
          <span
            className="text-[13px] font-semibold leading-snug"
            style={{ fontFamily: font, color: ink }}
          >
            {product.name}
          </span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: ink }}>
            {money(product.price)}
          </span>
        </div>
        {lowStock ? (
          <span className="mt-0.5 block text-[10px]" style={{ color: muted }}>
            {stock} left
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      onClick={() => onOpen(product.id)}
      className="group text-left"
      aria-label={`View ${product.name}`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#f2f4f9]">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: `${primary}66` }}
          >
            <Icon.Package size={24} />
          </div>
        )}
        {soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-[#17181a]/82 py-1.5 text-center text-[10px] uppercase tracking-[0.18em] text-white">
            Sold out
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span
          className="text-[13px] font-semibold leading-snug"
          style={{ color: ink, fontFamily: font }}
        >
          {product.name}
        </span>
        <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: ink }}>
          {money(product.price)}
        </span>
      </div>
      {lowStock ? (
        <span
          className="mt-0.5 block text-[10px] uppercase tracking-[0.16em]"
          style={{ color: muted }}
        >
          {stock} left
        </span>
      ) : null}
    </button>
  );
}

/* ───────────────────────────────── sections ───────────────────────────── */

/** Delivery and payment facts, set still. Nothing moves on its own. */
export function AnnouncementBar({
  shop,
  primary,
  announcement,
}: {
  shop: Shop;
  primary: string;
  announcement?: string;
}) {
  const zones = shop.deliveryRules.zones;
  const facts = [
    ...(announcement ? [announcement] : []),
    ...zones.slice(0, 3).map((zone) => `${zone.name} · $${zone.charge} · ${zone.etaDays}d`),
    'Cash on delivery',
    shop.contact.phone ? `Call ${shop.contact.phone}` : 'Order by chat',
  ];

  return (
    <div className="bg-[#111214] text-white">
      <div
        className={`${CONTAINER} flex flex-wrap items-center gap-x-6 gap-y-1 py-2.5 text-[10px] uppercase tracking-[0.18em] text-white/70`}
      >
        {facts.map((fact) => (
          <span key={fact} style={{ borderColor: primary }}>
            {fact}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Retail opener: type-led, with two real product images offset for rhythm. */
export function IntroStrip({
  shop,
  products,
  decor,
  primary,
  ink,
  muted,
  font,
  headline,
  subhead,
  ctaLabel,
}: {
  shop: Shop;
  products: readonly ProductPublic[];
  decor: DecorSet;
  primary: string;
  ink: string;
  muted: string;
  font?: string;
  /** AI design copy; falls back to the seller's own words. */
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
}) {
  const shots = [
    productImage(products) ?? decor.looks[0],
    products.filter((product) => product.images[0])[1]?.images[0] ?? decor.looks[1],
  ];

  return (
    <section className="border-b" style={{ borderColor: `${ink}12` }}>
      <div className={`${CONTAINER} grid gap-12 py-12 sm:py-16 lg:grid-cols-12 lg:gap-10`}>
        <div className="lg:col-span-7">
          <h1
            className="max-w-[19ch] text-[clamp(2.3rem,4.6vw,3.9rem)] font-medium leading-[1.04] tracking-[-0.015em]"
            style={{ color: ink, fontFamily: font }}
          >
            {headline ?? (shop.description || shop.name)}
          </h1>
          <p className="mt-6 max-w-md text-[13px] leading-relaxed" style={{ color: muted }}>
            {subhead ?? (shop.policies.notes || shopNote(shop, products))}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="#catalog"
              className="rounded-[2px] px-5 py-3 text-[12px] font-medium text-white transition-transform duration-300 hover:-translate-y-0.5"
              style={{ backgroundColor: ink }}
            >
              {ctaLabel ?? 'Browse the catalog'}
            </a>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: muted }}>
              {shop.deliveryRules.zones[0]
                ? `Cash on delivery · ${shop.deliveryRules.zones[0].name}`
                : 'Cash on delivery · Bangladesh'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          {shots[0] ? (
            <Reveal variant="unveil" className="mt-0 sm:mt-6">
              <DecorImg
                src={shots[0]}
                fallback={decor.fallback}
                className="aspect-[3/4] w-full object-cover"
              />
            </Reveal>
          ) : null}
          {shots[1] ? (
            <Reveal variant="unveil" delay={120}>
              <DecorImg
                src={shots[1]}
                fallback={decor.looks[0] ?? decor.fallback}
                className="aspect-[3/4] w-full object-cover"
              />
            </Reveal>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Immersive photographic hero for the modern template. */
export function CollageHero({
  shop,
  products,
  decor,
  primary,
  font,
  headline,
  subhead,
  ctaLabel,
}: {
  shop: Shop;
  products: readonly ProductPublic[];
  decor: DecorSet;
  primary: string;
  font?: string;
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
}) {
  // Real catalogue photography leads; the curated set is the fallback.
  const hero = products.find((product) => product.images[0])?.images[0] ?? decor.hero;
  const words = [
    shop.businessType,
    ...products.slice(0, 3).map((product) => product.name),
    'Cash on delivery',
  ];

  return (
    <section className="relative isolate flex min-h-[78svh] flex-col justify-end overflow-hidden bg-[#0d0e10] text-white">
      <DecorImg
        src={hero}
        fallback={decor.looks[0] ?? decor.fallback}
        className="es-drift absolute inset-0 -z-10 h-full w-full object-cover opacity-[0.62]"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d0e10] via-[#0d0e10]/45 to-[#0d0e10]/70" />

      <div className={`${CONTAINER} relative pb-14 pt-28 sm:pb-20`}>
        <h1
          className="max-w-[16ch] text-[clamp(2.7rem,7.2vw,6.2rem)] font-medium leading-[0.94] tracking-[-0.02em]"
          style={{ fontFamily: font }}
        >
          {headline ?? (shop.description || shop.name)}
        </h1>
        {subhead ? (
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/70">{subhead}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
          <a href="#catalog" className="es-link text-[13px] font-medium tracking-wide">
            {ctaLabel ?? 'Shop the collection'}
          </a>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
            {products.length} pieces · COD
          </span>
        </div>
      </div>

      <div className="relative border-t border-white/15 py-3">
        <div
          className={`${CONTAINER} flex flex-wrap gap-x-6 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-white/55`}
        >
          {words.map((word) => (
            <span key={word}>{word}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Editorial hero: oversized serif type beside a tall image, then a lookbook. */
export function EditorialHero({
  shop,
  products,
  decor,
  primary,
  ink,
  muted,
  font,
  headline,
  subhead,
}: {
  shop: Shop;
  products: readonly ProductPublic[];
  decor: DecorSet;
  primary: string;
  ink: string;
  muted: string;
  font?: string;
  headline?: string;
  subhead?: string;
}) {
  const main = productImage(products) ?? decor.hero;
  const looks = [
    products.filter((product) => product.images[0])[1]?.images[0] ?? decor.looks[0],
    decor.looks[1],
    decor.looks[2],
  ];

  return (
    <section className="pt-10 sm:pt-14">
      <div
        className={`${CONTAINER} grid items-end gap-8 border-b pb-10 lg:grid-cols-12`}
        style={{ borderColor: `${ink}14` }}
      >
        <div className="lg:col-span-8">
          <h1
            className="max-w-[20ch] text-[clamp(2.6rem,7vw,5.4rem)] leading-[0.96] tracking-[-0.015em]"
            style={{ fontFamily: font, color: ink }}
          >
            {headline ?? (shop.description || shop.name)}
          </h1>
        </div>
        <div className="lg:col-span-4">
          <p className="max-w-xs text-[12px] leading-relaxed lg:ml-auto" style={{ color: muted }}>
            {subhead ?? (shop.policies.notes || shopNote(shop, products))}
          </p>
          <a
            href="#catalog"
            className="es-link mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] lg:ml-auto"
            style={{ color: ink }}
          >
            View the collection <Icon.ArrowRight size={12} />
          </a>
        </div>
      </div>

      <div className={`${CONTAINER} mt-8 grid gap-3 lg:grid-cols-12`}>
        <Reveal variant="unveil" className="lg:col-span-7">
          {main ? (
            <DecorImg
              src={main}
              fallback={decor.looks[0] ?? decor.fallback}
              className="h-[52vw] max-h-[560px] w-full object-cover sm:h-[420px]"
            />
          ) : null}
        </Reveal>
        <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-1">
          {looks.slice(0, 2).map((look, index) => (
            <DecorImg
              key={`${look}-${index}`}
              src={look}
              fallback={decor.categories[index] ?? decor.fallback}
              className="h-full w-full object-cover"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Asymmetric category mosaic — variable spans, never an even three-across. */
export function CategoryCollage({
  categories,
  products,
  decor,
  ink,
  muted,
  font,
  onPick,
}: {
  categories: readonly Category[];
  products: readonly ProductPublic[];
  decor: DecorSet;
  ink: string;
  muted: string;
  font?: string;
  onPick: (categoryId: string) => void;
}) {
  const tiles = categories.slice(0, 4);
  if (!tiles.length) return null;

  return (
    <section className={`${CONTAINER} py-14 sm:py-20`}>
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h2
          className="text-[26px] font-medium tracking-[-0.03em]"
          style={{ fontFamily: font, color: ink }}
        >
          Shop by category
        </h2>
        <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: muted }}>
          {tiles.length} collections
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:gap-4">
        {tiles.map((category, index) => {
          const image =
            categoryImage(category, products) ??
            decor.categories[index % Math.max(decor.categories.length, 1)];
          const wide = index === 0;
          return (
            <button
              key={category.id}
              onClick={() => onPick(category.id)}
              className={`group relative overflow-hidden ${
                wide ? 'col-span-2 sm:col-span-7 sm:row-span-2' : 'sm:col-span-5'
              }`}
              aria-label={`Browse ${category.name}`}
            >
              {image ? (
                <DecorImg
                  src={image}
                  fallback={
                    decor.categories[(index + 1) % decor.categories.length] ?? decor.fallback
                  }
                  className={`w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05] ${
                    wide ? 'aspect-[4/3] sm:aspect-[4/5]' : 'aspect-[4/3] sm:aspect-[16/10]'
                  }`}
                />
              ) : (
                <div
                  className={`w-full ${wide ? 'aspect-[4/3] sm:aspect-[4/5]' : 'aspect-[4/3] sm:aspect-[16/10]'}`}
                  style={{ backgroundColor: `${ink}0f` }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
              <span className="absolute inset-x-5 bottom-5 flex items-center justify-between text-white">
                <span className="text-[15px] font-medium" style={{ fontFamily: font }}>
                  {category.name}
                </span>
                <Icon.ArrowRight
                  size={16}
                  className="transition-transform duration-500 group-hover:translate-x-1"
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Editorial category index — names and counts, no decorative numbering. */
export function CategoryIndex({
  categories,
  products,
  ink,
  muted,
  font,
  onPick,
}: {
  categories: readonly Category[];
  products: readonly ProductPublic[];
  ink: string;
  muted: string;
  font?: string;
  onPick: (categoryId: string) => void;
}) {
  if (!categories.length) return null;
  return (
    <section className={`${CONTAINER} max-w-5xl py-14 sm:py-16`}>
      <div className="flex items-center gap-4">
        <span className="text-[10px] uppercase tracking-[0.32em]" style={{ color: muted }}>
          Collections
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: `${ink}14` }} />
      </div>
      <ul className="mt-2">
        {categories.map((category) => {
          const count = products.filter((product) => product.categoryId === category.id).length;
          return (
            <li key={category.id}>
              <button
                onClick={() => onPick(category.id)}
                className="group flex w-full items-center justify-between gap-4 border-b py-5 text-left"
                style={{ borderColor: `${ink}12` }}
              >
                <span
                  className="text-[24px] leading-none transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-x-1.5"
                  style={{ fontFamily: font, color: ink }}
                >
                  {category.name}
                </span>
                <span
                  className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: muted }}
                >
                  {count} {count === 1 ? 'piece' : 'pieces'}
                  <Icon.ArrowRight
                    size={14}
                    className="opacity-0 transition duration-500 group-hover:opacity-100"
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FeaturedRail({
  products,
  primary,
  ink,
  muted,
  font,
  onOpen,
  onViewAll,
}: {
  products: readonly ProductPublic[];
  primary: string;
  ink: string;
  muted: string;
  font?: string;
  onOpen: (productId: string) => void;
  onViewAll: () => void;
}) {
  const rail = products.slice(0, 8);
  if (rail.length < 2) return null;
  return (
    <section className="py-14 sm:py-16">
      <div className={`${CONTAINER} mb-7 flex items-end justify-between gap-4`}>
        <div>
          <h2
            className="text-[26px] font-medium tracking-[-0.02em]"
            style={{ fontFamily: font, color: ink }}
          >
            Picked by this shop
          </h2>
        </div>
        <button
          onClick={onViewAll}
          className="es-link text-[11px] uppercase tracking-[0.18em]"
          style={{ color: muted }}
        >
          View all
        </button>
      </div>
      <div
        className={`${CONTAINER} flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none]`}
      >
        {rail.map((product) => (
          <div key={product.id} className="w-[64%] shrink-0 snap-start sm:w-[36%] lg:w-[23%]">
            <ProductCard
              product={product}
              variant="tall"
              primary={primary}
              ink={ink}
              muted={muted}
              font={font}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Story split: photography on one side, the shop's own words on the other. */
export function StoryBand({
  shop,
  decor,
  primary,
  font,
  story,
}: {
  shop: Shop;
  decor: DecorSet;
  primary: string;
  font?: string;
  story?: string;
}) {
  const zones = shop.deliveryRules.zones;
  return (
    <section className="bg-[#0d0e10] text-white">
      <div className="mx-auto grid w-full max-w-7xl gap-0 lg:grid-cols-2">
        <Reveal variant="unveil" className="order-2 lg:order-1">
          <DecorImg
            src={decor.story}
            fallback={decor.categories[0] ?? decor.fallback}
            className="h-full min-h-[320px] w-full object-cover lg:min-h-[520px]"
          />
        </Reveal>
        <div className="order-1 flex flex-col justify-center px-5 py-14 sm:px-10 lg:order-2 lg:py-20">
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-white/45">
            <span className="h-px w-6" style={{ backgroundColor: primary }} />
            The shop
          </p>
          <p
            className="mt-6 max-w-md text-[clamp(1.35rem,2.4vw,1.9rem)] italic leading-[1.35] text-white/90"
            style={{ fontFamily: font }}
          >
            {story ?? (shop.policies.notes || shop.description || 'A small shop, run with care.')}
          </p>
          {shop.policies.returnPolicy ? (
            <p className="mt-5 max-w-sm text-[12px] leading-relaxed text-white/45">
              {shop.policies.returnPolicy}
            </p>
          ) : null}
          <dl className="mt-9 max-w-sm text-[12px]">
            {zones.length ? (
              zones.map((zone) => (
                <div
                  key={zone.name}
                  className="flex items-baseline justify-between gap-4 border-t border-white/12 py-2.5"
                >
                  <dt className="text-white/80">{zone.name}</dt>
                  <dd className="tabular-nums text-white/45">
                    ${zone.charge} · {zone.etaDays}d
                  </dd>
                </div>
              ))
            ) : (
              <div className="border-t border-white/12 py-2.5 text-white/50">
                Delivery charge confirmed by phone.
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Hairline trust strip — no icon tiles, no equal-card row. */
export function TrustRow({
  shop,
  ink,
  muted,
}: {
  shop: Shop;
  primary: string;
  ink: string;
  muted: string;
}) {
  const zones = shop.deliveryRules.zones;
  const items = [
    {
      label: 'Delivery',
      value: zones.length
        ? zones.map((zone) => `${zone.name} $${zone.charge}`).join('  ·  ')
        : 'Confirmed on the phone',
    },
    { label: 'Payment', value: 'Cash on delivery, nationwide' },
    { label: 'Returns', value: shop.policies.returnPolicy || 'Ask the shop before ordering' },
  ];
  return (
    <section className={`${CONTAINER} py-12`}>
      <dl className="grid gap-px sm:grid-cols-3" style={{ backgroundColor: `${ink}12` }}>
        {items.map((item) => (
          <div key={item.label} className="bg-white px-1 py-5 sm:px-6 sm:first:pl-0">
            <dt className="text-[10px] uppercase tracking-[0.24em]" style={{ color: muted }}>
              {item.label}
            </dt>
            <dd className="mt-2 text-[12px] leading-relaxed" style={{ color: ink }}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PoliciesSection({
  shop,
  ink,
  muted,
  font,
}: {
  shop: Shop;
  ink: string;
  muted: string;
  font?: string;
}) {
  const zones = shop.deliveryRules.zones;
  const hasReturn = Boolean(shop.policies.returnPolicy);
  const hasNotes = Boolean(shop.policies.notes);
  if (!hasReturn && !hasNotes && !zones.length) return null;

  return (
    <section className={`${CONTAINER} max-w-5xl pb-16 pt-6`}>
      <div
        className="grid gap-10 border-t pt-10 sm:grid-cols-2"
        style={{ borderColor: `${ink}14` }}
      >
        {hasReturn || hasNotes ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
              Good to know
            </p>
            <p
              className="mt-4 max-w-md text-[15px] leading-relaxed"
              style={{ fontFamily: font, color: ink }}
            >
              {shop.policies.returnPolicy || shop.policies.notes}
            </p>
          </div>
        ) : null}
        {zones.length ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
              Delivery
            </p>
            <ul className="mt-4 max-w-sm text-[12px]" style={{ color: ink }}>
              {zones.map((zone) => (
                <li
                  key={zone.name}
                  className="flex items-baseline justify-between gap-4 border-b py-2.5"
                  style={{ borderColor: `${ink}10` }}
                >
                  <span>{zone.name}</span>
                  <span className="tabular-nums" style={{ color: muted }}>
                    ${zone.charge} · {zone.etaDays}d
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
