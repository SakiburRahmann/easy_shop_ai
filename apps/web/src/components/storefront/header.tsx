'use client';

/**
 * Storefront headers. Three different architectures rather than one bar with
 * another colour: a typographic retail bar, a cinematic overlay bar for the
 * photographic hero, and a serif masthead. No pills, no coloured icon tiles.
 */
import Link from 'next/link';
import type { Storefront as StorefrontPayload } from '@easyshop/shared';
import { Icon } from '@/lib/icons';
import type { TemplateVisuals } from '@/components/storefront/templates';

export function StorefrontHeader({
  data,
  preset,
  primary,
  font,
  ink,
  muted,
  cartUnits,
  onCart,
  onPick,
}: {
  data: StorefrontPayload;
  preset: TemplateVisuals;
  primary: string;
  font?: string;
  ink: string;
  muted: string;
  cartUnits: number;
  onCart: () => void;
  onPick: (categoryId?: string) => void;
}) {
  const nav = data.categories.slice(0, 5);
  const shop = data.shop;
  const cartLabel = `Open cart (${cartUnits} items)`;

  if (preset.header === 'masthead') {
    return (
      <header
        className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur"
        style={{ borderColor: `${ink}14` }}
      >
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div
            className="flex items-center justify-between gap-3 py-2.5 text-[10px] uppercase tracking-[0.22em]"
            style={{ color: muted }}
          >
            <button type="button" onClick={() => onPick(undefined)} className="es-link">
              {shop.businessType}
            </button>
            <span className="hidden sm:block">{shop.contact.phone ?? ''}</span>
            <button
              type="button"
              onClick={onCart}
              aria-label={cartLabel}
              className="es-link font-medium"
              style={{ color: ink }}
            >
              Bag{cartUnits ? ` (${cartUnits})` : ''}
            </button>
          </div>

          <div className="border-t py-5 text-center" style={{ borderColor: `${ink}10` }}>
            <Link
              href="/"
              className="text-[9px] uppercase tracking-[0.34em]"
              style={{ color: muted }}
            >
              EasyShopAI
            </Link>
            <h1
              className="mt-1.5 text-[clamp(1.55rem,6.2vw,2.75rem)] font-normal leading-[1.05] tracking-[0.01em]"
              style={{ fontFamily: font, color: ink }}
            >
              {shop.name}
            </h1>
          </div>

          {nav.length ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 border-t py-3.5 text-[10px] uppercase tracking-[0.2em]"
              style={{ borderColor: `${ink}10`, color: muted }}
            >
              {nav.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onPick(category.id)}
                  className="es-link transition-colors hover:text-current"
                >
                  {category.name}
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
    );
  }

  if (preset.header === 'overlay') {
    return (
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0d0e10]/75 text-white backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-4 sm:gap-8 sm:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-baseline gap-2"
            aria-label="EasyShopAI marketplace"
          >
            <span
              className="truncate text-[12px] uppercase leading-none tracking-[0.2em] sm:tracking-[0.26em]"
              style={{ fontFamily: font }}
            >
              {shop.name}
            </span>
            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: primary }} />
          </Link>

          {nav.length ? (
            <nav className="ml-2 hidden items-center gap-6 text-[11px] text-white/50 md:flex">
              {nav.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onPick(category.id)}
                  className="es-link transition-colors hover:text-white"
                >
                  {category.name}
                </button>
              ))}
            </nav>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-5">
            {shop.contact.phone ? (
              <span className="hidden text-[10px] uppercase tracking-[0.18em] text-white/45 lg:block">
                {shop.contact.phone}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onCart}
              aria-label={cartLabel}
              className="es-link flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
            >
              <Icon.Bag size={12} />
              Bag{cartUnits ? ` (${cartUnits})` : ''}
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className="sticky top-0 z-30 border-b bg-white/88 backdrop-blur"
      style={{ borderColor: `${ink}10` }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-5 py-4 sm:gap-8 sm:px-8">
        <Link
          href="/"
          className="flex min-w-0 flex-col leading-none"
          aria-label="EasyShopAI marketplace"
        >
          <span
            className="truncate text-[17px] font-medium tracking-[-0.02em]"
            style={{ color: ink }}
          >
            {shop.name}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.24em]" style={{ color: muted }}>
            {shop.businessType}
          </span>
        </Link>

        {nav.length ? (
          <nav className="hidden items-center gap-6 md:flex" style={{ color: muted }}>
            {nav.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onPick(category.id)}
                className="es-link text-[11px] uppercase tracking-[0.14em] transition-colors hover:text-[color:var(--ink)]"
                style={{ ['--ink' as string]: ink }}
              >
                {category.name}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-4 sm:gap-6">
          {shop.contact.phone ? (
            <span
              className="hidden text-[10px] uppercase tracking-[0.16em] lg:block"
              style={{ color: muted }}
            >
              {shop.contact.phone}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onCart}
            aria-label={cartLabel}
            className="flex items-center gap-2 border-b pb-1 text-[10px] uppercase tracking-[0.2em]"
            style={{ borderColor: `${ink}26`, color: ink }}
          >
            <Icon.Bag size={12} />
            Bag{cartUnits ? ` (${cartUnits})` : ''}
          </button>
        </div>
      </div>
    </header>
  );
}
