'use client';

/**
 * Catalogue block. One data path (API search + category + sort) with three
 * presentations: `dense` retail grid, `gallery` image-first grid, and
 * `atelier` two-column editorial grid. Controls are typographic — text tabs
 * and a hairline search field, not pill chips.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductPublic, Storefront as StorefrontPayload } from '@easyshop/shared';
import { api } from '@/lib/api';
import { Icon } from '@/lib/icons';
import { CardSkeletonGrid } from '@/components/ui';
import type { TemplateVisuals } from '@/components/storefront/templates';
import { ProductCard, type CardVariant } from '@/components/storefront/sections';

type Filters = { q?: string; categoryId?: string; sort?: string };

const GRID: Record<TemplateVisuals['catalog'], string> = {
  dense: 'grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4',
  gallery: 'grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3',
  atelier: 'grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2',
};

const CARD: Record<TemplateVisuals['catalog'], CardVariant> = {
  dense: 'dense',
  gallery: 'tall',
  atelier: 'editorial',
};

export function StorefrontCatalog({
  data,
  slug,
  preset,
  primary,
  font,
  ink,
  muted,
  categoryId,
  onCategory,
  onBuy,
}: {
  data: StorefrontPayload;
  slug: string;
  preset: TemplateVisuals;
  primary: string;
  font?: string;
  ink: string;
  muted: string;
  categoryId?: string;
  onCategory: (categoryId?: string) => void;
  onBuy: (productId: string) => void;
}) {
  const [products, setProducts] = useState<ProductPublic[] | null>(data.products);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(false);

  const latest = useRef({ q, sort });
  const lastCategory = useRef(categoryId);

  useEffect(() => {
    latest.current = { q, sort };
  }, [q, sort]);

  const refetch = useCallback(
    (next: Filters) => {
      setLoading(true);
      const sp = new URLSearchParams({ limit: '24' });
      if (next.q) sp.set('q', next.q);
      if (next.sort) sp.set('sort', next.sort);
      if (next.categoryId) sp.set('categoryId', next.categoryId);
      api<unknown>(`/s/${slug}/products?${sp.toString()}`)
        .then((raw) => {
          if (Array.isArray(raw)) setProducts(raw as ProductPublic[]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [slug],
  );

  // Category changes can come from the header, a mosaic tile or the index.
  useEffect(() => {
    if (lastCategory.current === categoryId) return;
    lastCategory.current = categoryId;
    refetch({ ...latest.current, categoryId });
  }, [categoryId, refetch]);

  const activeCategory = data.categories.find((category) => category.id === categoryId);
  const count = products ? products.length : data.products.length;
  const title = activeCategory
    ? activeCategory.name
    : preset.catalog === 'atelier'
      ? 'The collection'
      : preset.catalog === 'gallery'
        ? 'The catalogue'
        : 'All products';

  return (
    <main
      id="catalog"
      className="mx-auto w-full max-w-7xl flex-1 scroll-mt-20 px-5 pb-8 pt-4 sm:px-8"
    >
      <div
        className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-t pt-10"
        style={{ borderColor: `${ink}14` }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: muted }}>
            {count} {count === 1 ? 'piece' : 'pieces'}
            {activeCategory ? ' · filtered' : ''}
          </p>
          <h2
            className={
              preset.catalog === 'atelier'
                ? 'mt-2 text-[30px] font-normal leading-none sm:text-[38px]'
                : 'mt-2 text-[26px] font-medium tracking-[-0.03em]'
            }
            style={{ fontFamily: font, color: ink }}
          >
            {title}
          </h2>
        </div>

        <div className="flex items-end gap-6">
          <label
            className="group flex items-center gap-2 border-b pb-1.5"
            style={{ borderColor: `${ink}1f` }}
          >
            <Icon.Search size={14} style={{ color: muted }} />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && refetch({ q, sort, categoryId })}
              placeholder="Search"
              className="w-28 bg-transparent text-[12px] outline-none placeholder:uppercase placeholder:tracking-[0.16em] sm:w-40"
              style={{ color: ink }}
            />
          </label>
          <label
            className="flex items-center gap-1.5 border-b pb-1.5"
            style={{ borderColor: `${ink}1f` }}
          >
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                refetch({ q, sort: event.target.value, categoryId });
              }}
              aria-label="Sort products"
              className="cursor-pointer appearance-none bg-transparent pr-1 text-[11px] uppercase tracking-[0.14em] outline-none"
              style={{ color: muted }}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
            <Icon.Chevron size={12} style={{ color: muted }} />
          </label>
        </div>
      </div>

      {preset.catalog !== 'atelier' && data.categories.length ? (
        <div className="mt-7 flex gap-6 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => onCategory(undefined)}
            className="relative shrink-0 pb-2 text-[11px] uppercase tracking-[0.16em] transition"
            style={{ color: categoryId ? muted : ink }}
          >
            All
            {!categoryId ? (
              <span
                className="absolute inset-x-0 -bottom-px h-px"
                style={{ backgroundColor: ink }}
              />
            ) : null}
          </button>
          {data.categories.map((category) => {
            const active = categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onCategory(active ? undefined : category.id)}
                className="relative shrink-0 pb-2 text-[11px] uppercase tracking-[0.16em] transition"
                style={{ color: active ? ink : muted }}
              >
                {category.name}
                {active ? (
                  <span
                    className="absolute inset-x-0 -bottom-px h-px"
                    style={{ backgroundColor: ink }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-9">
        {loading ? (
          <CardSkeletonGrid />
        ) : !products?.length ? (
          <div
            className="flex flex-col items-start gap-3 border-t py-16"
            style={{ borderColor: `${ink}10` }}
          >
            <p className="text-[20px]" style={{ fontFamily: font, color: ink }}>
              Nothing here yet
            </p>
            <p className="max-w-sm text-[12px] leading-relaxed" style={{ color: muted }}>
              {q || activeCategory
                ? 'Try another search or category — or ask the agent in chat; it knows the full catalogue.'
                : 'This shop has not published products yet. The AI agent can still answer questions.'}
            </p>
            {activeCategory ? (
              <button
                type="button"
                onClick={() => onCategory(undefined)}
                className="es-link text-[11px] uppercase tracking-[0.18em]"
                style={{ color: primary }}
              >
                Clear filter
              </button>
            ) : null}
          </div>
        ) : (
          <div className={GRID[preset.catalog]}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant={CARD[preset.catalog]}
                primary={primary}
                ink={ink}
                muted={muted}
                font={font}
                onOpen={onBuy}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
