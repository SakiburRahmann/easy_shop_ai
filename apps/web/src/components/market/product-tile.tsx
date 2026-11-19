'use client';

/**
 * Marketplace product card, matched to the reference: 4:3 photograph on a warm
 * grey plate, name, seller line and price. Sizes follow the reference cards
 * (12.5px name and price) so a six-up row reads exactly like the design.
 */
import Link from 'next/link';
import { productAvailableStock, productSoldOut, type ProductPublic } from '@easyshop/shared';
import { money } from '@/lib/api';
import { Icon } from '@/lib/icons';

export function ProductTile({
  product,
  href,
  shopName,
}: {
  product: ProductPublic;
  href?: string;
  shopName?: string;
}) {
  const soldOut = productSoldOut(product);
  const stock = productAvailableStock(product);
  const low = !soldOut && stock <= 5;
  const target = href ?? `/product?id=${product.id}`;

  return (
    <Link href={target} className="group flex flex-col gap-2" aria-label={`View ${product.name}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[#f4f5f7]">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Icon.Package size={24} />
          </div>
        )}
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-ink/55 shadow-[0_1px_3px_rgba(16,19,28,.08)]"
        >
          <Icon.Heart size={13} />
        </span>
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
            Sold out
          </span>
        ) : low ? (
          <span className="absolute left-2 top-2 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            Only {stock} left
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="line-clamp-1 text-[12.5px] font-semibold leading-snug text-ink">
          {product.name}
        </span>
        {shopName ? (
          <span className="line-clamp-1 text-[11px] text-muted">By {shopName}</span>
        ) : null}
        <span className="text-[12.5px] font-bold text-ink">{money(product.price)}</span>
      </div>
    </Link>
  );
}
