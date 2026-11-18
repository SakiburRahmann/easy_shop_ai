'use client';

/**
 * Theme gallery — how a seller's storefront gets its look.
 *
 * Same model as Shopify's theme store / Odoo's theme picker: the platform ships
 * finished presets, the human chooses one, then edits copy and colours. There is
 * no generation step, so what the seller previews is exactly what renders.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  shopSchema,
  themeLibraryPageSchema,
  type Shop,
  type StorefrontTheme,
  type ThemePreset,
  type ThemeTokens,
} from '@easyshop/shared';
import { Badge, Button, ErrorNote, Field, OkNote, Skeleton, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { api } from '@/lib/api';
import type { Api } from './Dashboard';

const RADIUS_PX: Record<ThemeTokens['radius'], number> = { sharp: 2, soft: 12, round: 18 };

function ThemeThumb({ preset, active }: { preset: ThemePreset; active?: boolean }) {
  const { tokens, layout } = preset;
  const radius = RADIUS_PX[tokens.radius];
  const photographic = layout.hero !== 'browse';
  return (
    <div
      className={`overflow-hidden border ${active ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-zinc-200'}`}
      style={{ backgroundColor: tokens.surface, borderRadius: radius + 6 }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between px-2.5 py-2" style={{ color: tokens.ink }}>
        <span
          className="h-1.5 w-10"
          style={{ backgroundColor: tokens.ink, borderRadius: radius / 2 }}
        />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-3"
              style={{ backgroundColor: tokens.muted, opacity: 0.6, borderRadius: 1 }}
            />
          ))}
        </span>
      </div>
      <div
        className="mx-2.5 flex items-end px-2 pb-2"
        style={{
          height: photographic ? 62 : 34,
          backgroundColor: photographic ? tokens.ink : 'transparent',
          borderRadius: radius,
        }}
      >
        <span
          className="h-1.5"
          style={{
            width: photographic ? '55%' : '45%',
            backgroundColor: photographic ? tokens.surface : tokens.ink,
            borderRadius: 1,
          }}
        />
      </div>
      <div
        className={`grid gap-1.5 p-2.5 ${layout.catalog === 'atelier' ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        {[0, 1, 2, 3, 4, 5].slice(0, layout.catalog === 'atelier' ? 4 : 3).map((i) => (
          <span
            key={i}
            style={{
              backgroundColor: tokens.muted,
              opacity: 0.22,
              borderRadius: radius,
              aspectRatio: layout.catalog === 'dense' ? '1 / 1' : '3 / 4',
            }}
          />
        ))}
      </div>
      <div className="flex gap-1 px-2.5 pb-2.5">
        {preset.palette.slice(0, 3).map((hex) => (
          <span
            key={hex}
            className="h-2 w-2 rounded-full border border-black/10"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ThemeGallery({
  auth,
  shop,
  onShopChange,
}: {
  auth: Api;
  shop: Shop;
  onShopChange: (shop: Shop) => void;
}) {
  const [themes, setThemes] = useState<ThemePreset[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyMyType, setOnlyMyType] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ThemePreset | null>(null);
  const [headline, setHeadline] = useState(
    shop.storefront?.copy.headline ?? shop.description ?? '',
  );
  const [subhead, setSubhead] = useState(shop.storefront?.copy.subhead ?? '');
  const [ctaLabel, setCtaLabel] = useState(shop.storefront?.copy.ctaLabel ?? 'Browse the catalog');
  const [announcement, setAnnouncement] = useState(shop.storefront?.copy.announcement ?? '');
  const [primary, setPrimary] = useState(shop.storefront?.tokens.primary ?? '');
  const [accent, setAccent] = useState(shop.storefront?.tokens.accent ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // No synchronous state writes here: the previous page stays visible while a
  // new filter loads, which also keeps the compiler's effect rules happy.
  useEffect(() => {
    let cancelled = false;
    const sp = new URLSearchParams({ limit: '48' });
    if (query.trim()) sp.set('q', query.trim());
    if (category) sp.set('category', category);
    if (onlyMyType) sp.set('businessType', shop.businessType);
    api<unknown>(`/themes?${sp.toString()}`)
      .then((raw) => {
        if (cancelled) return;
        const parsed = themeLibraryPageSchema.safeParse(raw);
        if (!parsed.success) {
          setLoadError('The theme library returned an unexpected response.');
          return;
        }
        setThemes(parsed.data.themes);
        setCategories(parsed.data.categories);
        setTotal(parsed.data.total);
        setLoadError(null);
      })
      .catch(
        (err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Load failed'),
      )
      .finally(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [query, category, onlyMyType, shop.businessType]);

  const pick = useCallback((preset: ThemePreset) => {
    setSelected(preset);
    setNotice(null);
    setError(null);
    setPrimary(preset.tokens.primary);
    setAccent(preset.tokens.accent);
    setCtaLabel(preset.ctaLabel);
  }, []);

  const applied: StorefrontTheme | null = shop.storefront ?? null;

  const apply = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = shopSchema.parse(
        await auth(`/shops/${shop.id}/storefront`, {
          method: 'PATCH',
          body: {
            themeId: selected.id,
            copy: {
              ...(headline.trim() ? { headline: headline.trim() } : {}),
              ...(subhead.trim() ? { subhead: subhead.trim() } : {}),
              ...(announcement.trim() ? { announcement: announcement.trim() } : {}),
              ...(ctaLabel.trim() ? { ctaLabel: ctaLabel.trim() } : {}),
            },
            tokens: {
              ...(/^#[0-9a-fA-F]{6}$/.test(primary) ? { primary } : {}),
              ...(/^#[0-9a-fA-F]{6}$/.test(accent) ? { accent } : {}),
            },
          },
        }),
      );
      onShopChange(updated);
      setNotice(`“${selected.name}” is live on your store.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply the theme');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon.Palette size={17} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Storefront themes</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
              Pick a finished theme. Your catalog, cart, COD checkout, delivery zones and AI sales
              agent come with every theme — only the layout and styling change. You can switch at
              any time; products and orders are untouched.
            </p>
          </div>
          {applied ? <Badge tone="green">Theme applied</Badge> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Search themes">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={inputClass}
              placeholder="minimal, bakery, editorial"
              maxLength={120}
            />
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClass}
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-[12px] text-zinc-600">
            <input
              type="checkbox"
              checked={onlyMyType}
              onChange={(event) => setOnlyMyType(event.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
            Recommended for {shop.businessType}
          </label>
        </div>

        <p className="mt-2 text-[11px] text-zinc-400">
          {themes ? `${total} themes in the library` : 'Loading the library…'}
        </p>
        <div className="mt-3">
          <ErrorNote message={loadError} />
        </div>

        {!themes ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : themes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-[13px] text-zinc-500">
            No theme matches that filter. Try clearing the search.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {themes.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pick(preset)}
                className="group flex flex-col gap-2 text-left"
                aria-label={`Preview ${preset.name}`}
              >
                <ThemeThumb
                  preset={preset}
                  active={selected?.id === preset.id || applied?.themeId === preset.id}
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-[12px] font-medium leading-snug text-zinc-800">
                    {preset.name}
                  </span>
                  {preset.curated ? <Badge tone="blue">Curated</Badge> : null}
                </span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-400">
                  {preset.category}
                  {preset.style.length ? ` · ${preset.style.slice(0, 2).join(' · ')}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="w-full max-w-xs">
              <ThemeThumb preset={selected} />
            </div>
            <div className="min-w-[220px] flex-1">
              <h3 className="text-sm font-semibold text-zinc-900">{selected.name}</h3>
              <p className="mt-1 text-[12px] text-zinc-500">
                {selected.layout.header} header · {selected.layout.hero} hero ·{' '}
                {selected.layout.catalog} catalog · {selected.layout.density} spacing ·{' '}
                {selected.tokens.radius} corners
              </p>
              <p className="mt-2 text-[11px] text-zinc-400">
                Blocks: {selected.layout.sections.join(' → ')}
              </p>
              <div className="mt-3 flex gap-1.5">
                {selected.palette.map((hex) => (
                  <span
                    key={hex}
                    title={hex}
                    className="h-5 w-5 rounded-md border border-zinc-200"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={() => void apply()} disabled={busy} icon={<Icon.Check size={15} />}>
              {busy
                ? 'Applying…'
                : applied?.themeId === selected.id
                  ? 'Update this theme'
                  : 'Use this theme'}
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Headline" hint="Shown at the top of the storefront">
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                className={inputClass}
                maxLength={90}
                placeholder={shop.name}
              />
            </Field>
            <Field label="Button label">
              <input
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
                className={inputClass}
                maxLength={32}
              />
            </Field>
            <Field label="Sub-headline">
              <input
                value={subhead}
                onChange={(event) => setSubhead(event.target.value)}
                className={inputClass}
                maxLength={180}
              />
            </Field>
            <Field label="Announcement bar" hint="Optional — delivery facts work well here">
              <input
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                className={inputClass}
                maxLength={120}
              />
            </Field>
            <Field label="Primary colour" hint="Buttons and accents">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : selected.tokens.primary}
                  onChange={(event) => setPrimary(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white"
                  aria-label="Primary colour"
                />
                <span className="font-mono text-[11px] text-zinc-500">
                  {/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : selected.tokens.primary}
                </span>
              </div>
            </Field>
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : selected.tokens.accent}
                  onChange={(event) => setAccent(event.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-zinc-200 bg-white"
                  aria-label="Accent colour"
                />
                <span className="font-mono text-[11px] text-zinc-500">
                  {/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : selected.tokens.accent}
                </span>
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <ErrorNote message={error} />
            <OkNote message={notice} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
