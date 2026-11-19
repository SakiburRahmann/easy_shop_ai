'use client';

/**
 * Per-shop cart storage.
 *
 * One cart per seller, because the platform takes one COD order per shop
 * (SPEC §7). The product snapshot is kept for display only — the server always
 * re-prices every line and re-checks stock when the order is placed.
 */
import { useEffect, useState } from 'react';
import { productSoldOut, type ProductPublic } from '@easyshop/shared';

export interface CartLine {
  key: string;
  product: ProductPublic;
  variantId?: string;
  qty: number;
}

const CART_PREFIX = 'easyshopai.cart.';
const CART_EVENT = 'easyshopai:cart';

export function cartKey(slug: string): string {
  return CART_PREFIX + slug;
}

export function cartLineKey(productId: string, variantId?: string): string {
  return `${productId}:${variantId ?? 'base'}`;
}

export function variantOf(product: ProductPublic, variantId?: string) {
  return variantId ? product.variants.find((variant) => variant.id === variantId) : undefined;
}

/** Units a single line may buy, from live variant/product stock. */
export function lineStock(product: ProductPublic, variantId?: string): number {
  const variant = variantOf(product, variantId);
  if (variant) return variant.stock;
  return product.variants.length ? 0 : product.stock;
}

export function lineUnitPrice(product: ProductPublic, variantId?: string): number {
  return variantOf(product, variantId)?.priceOverride ?? product.price;
}

export function readCart(slug: string): CartLine[] {
  if (typeof window === 'undefined' || !slug) return [];
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
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

export function writeCart(slug: string, lines: CartLine[]): void {
  if (typeof window === 'undefined' || !slug) return;
  try {
    window.localStorage.setItem(cartKey(slug), JSON.stringify(lines));
    window.dispatchEvent(new Event(CART_EVENT));
  } catch {
    /* storage may be unavailable; checkout still works */
  }
}

/** Adds a line, merging quantities up to available stock. */
export function addCartLine(
  slug: string,
  product: ProductPublic,
  variantId: string | undefined,
  qty: number,
): boolean {
  if (productSoldOut(product) || (product.variants.length > 0 && !variantId)) return false;
  const max = lineStock(product, variantId);
  if (max <= 0) return false;
  const key = cartLineKey(product.id, variantId);
  const current = readCart(slug);
  const existing = current.find((line) => line.key === key);
  const next = existing
    ? current.map((line) =>
        line.key === key ? { ...line, qty: Math.min(max, line.qty + qty) } : line,
      )
    : [
        ...current,
        { key, product, ...(variantId ? { variantId } : {}), qty: Math.min(max, qty) },
      ];
  writeCart(slug, next);
  return true;
}

export function setCartQty(slug: string, key: string, qty: number): void {
  const next = readCart(slug).flatMap((line) => {
    if (line.key !== key) return [line];
    const max = lineStock(line.product, line.variantId);
    const value = Math.min(max, Math.max(0, qty));
    return value <= 0 ? [] : [{ ...line, qty: value }];
  });
  writeCart(slug, next);
}

export function removeCartLine(slug: string, key: string): void {
  writeCart(
    slug,
    readCart(slug).filter((line) => line.key !== key),
  );
}

export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineUnitPrice(line.product, line.variantId) * line.qty, 0);
}

export function cartUnits(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** Every shop that currently has at least one cart line. */
export function shopsWithCarts(): string[] {
  if (typeof window === 'undefined') return [];
  const slugs: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CART_PREFIX)) {
        const slug = key.slice(CART_PREFIX.length);
        if (readCart(slug).length) slugs.push(slug);
      }
    }
  } catch {
    return [];
  }
  return slugs;
}

/** Live unit count for one shop's cart (storefront cart button). */
export function useShopCartUnits(slug: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(cartUnits(readCart(slug)));
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [slug]);
  return count;
}

/** Live cart count for the header badge. */
export function useCartCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(shopsWithCarts().reduce((sum, slug) => sum + cartUnits(readCart(slug)), 0));
    refresh();
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return count;
}
