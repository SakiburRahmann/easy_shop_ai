'use client';

import type { ReactNode } from 'react';
import {
  BUSINESS_TYPE_PRESETS,
  STOREFRONT_TEMPLATES,
  type BusinessType,
  type DeliveryZone,
  type TemplateId,
} from '@easyshop/shared';
import { Button, Field, inputClass } from '@/components/ui';
import { Icon } from '@/lib/icons';
import { TEMPLATE_VISUALS, storefrontFont } from '@/components/storefront/templates';

export const BUSINESS_ICONS: Record<BusinessType, ReactNode> = {
  fashion: <Icon.Shirt size={18} />,
  electronics: <Icon.Laptop size={18} />,
  beauty: <Icon.Heart size={18} />,
  groceries: <Icon.Leaf size={18} />,
  home: <Icon.Home size={18} />,
  kids: <Icon.Smiley size={18} />,
  other: <Icon.Store size={18} />,
};

export interface ThemeValue {
  primaryColor: string;
  accentColor: string;
  font: 'sans' | 'serif';
}

const PRIMARY_SWATCHES = ['#059669', '#0EA5E9', '#7C3AED', '#D97706', '#E11D48', '#334155'];
const ACCENT_SWATCHES = ['#F59E0B', '#EC4899', '#38BDF8', '#A3E635', '#F97316', '#64748B'];

export function BusinessTypePicker({
  value,
  onChange,
}: {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(BUSINESS_TYPE_PRESETS) as BusinessType[]).map((key) => {
        const preset = BUSINESS_TYPE_PRESETS[key];
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
              selected
                ? 'border-brand-400 bg-brand-50/70 ring-1 ring-brand-300'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                selected ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {BUSINESS_ICONS[key]}
            </span>
            <span className="text-[13px] font-semibold text-zinc-900">{preset.label}</span>
            <span className="text-xs leading-relaxed text-zinc-500">{preset.blurb}</span>
            <span className="mt-auto line-clamp-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              {preset.categories.slice(0, 3).join(' · ')}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TemplateThumbnail({
  id,
  primary,
  accent,
}: {
  id: TemplateId;
  primary: string;
  accent: string;
}) {
  const visuals = TEMPLATE_VISUALS[id];
  const gridClass = visuals.header === 'centered' ? 'grid-cols-3' : 'grid-cols-4';
  return (
    <div
      className="flex h-32 w-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white"
      style={{ backgroundColor: visuals.surface }}
    >
      {visuals.header === 'centered' ? (
        <div className="flex flex-col items-center gap-1 border-b border-black/5 px-2 py-2">
          <span className="h-1.5 w-16 rounded-full" style={{ backgroundColor: primary }} />
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-5 rounded-full bg-zinc-300" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2 py-2" style={{ backgroundColor: primary }}>
          <span className="h-3 w-3 rounded bg-white/25" />
          <span className="h-1.5 w-14 rounded-full bg-white/70" />
          <span className="ml-auto h-3 w-8 rounded-full bg-white/20" />
        </div>
      )}
      {visuals.hero === 'gradient' ? (
        <div
          className="mx-2 mt-2 h-7 rounded px-2 py-1"
          style={{ background: `linear-gradient(110deg, ${primary}, ${accent})` }}
        >
          <span className="block h-1 w-20 rounded-full bg-white/80" />
        </div>
      ) : null}
      {visuals.hero === 'editorial' ? (
        <div className="mx-2 mt-2 flex gap-1.5">
          <div className="flex flex-1 flex-col justify-center gap-1">
            <span className="h-1.5 w-16 rounded-full" style={{ backgroundColor: primary }} />
            <span className="h-1 w-12 rounded-full bg-zinc-300" />
          </div>
          <div
            className="h-8 w-12 rounded"
            style={{ backgroundColor: `${accent}55`, border: `1px solid ${accent}88` }}
          />
        </div>
      ) : null}
      <div className={`mt-2 grid flex-1 ${gridClass} gap-1 px-2 pb-2`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span
              className={`block rounded bg-zinc-200 ${
                visuals.card === 'editorial' ? 'h-7' : 'h-6'
              }`}
              style={i === 0 ? { backgroundColor: `${primary}22` } : undefined}
            />
            <span className="h-0.5 w-4/5 rounded-full bg-zinc-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplatePicker({
  value,
  onChange,
  primary = '#059669',
  accent = '#F59E0B',
}: {
  value: TemplateId;
  onChange: (value: TemplateId) => void;
  primary?: string;
  accent?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(Object.keys(STOREFRONT_TEMPLATES) as TemplateId[]).map((id) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-col gap-2 rounded-2xl border p-3 text-left transition ${
              selected
                ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-300'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <TemplateThumbnail id={id} primary={primary} accent={accent} />
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-zinc-900">
                {STOREFRONT_TEMPLATES[id].label}
              </span>
              {selected ? <Icon.Check size={14} className="text-brand-600" /> : null}
            </span>
            <span className="text-xs leading-relaxed text-zinc-500">
              {STOREFRONT_TEMPLATES[id].description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-zinc-700">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            onClick={() => onChange(color)}
            className={`h-7 w-7 rounded-full transition ${
              value.toLowerCase() === color.toLowerCase()
                ? 'ring-2 ring-zinc-900 ring-offset-2'
                : 'hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-zinc-300"
          aria-label={`Custom ${label.toLowerCase()}`}
        />
        <span className="font-mono text-[11px] text-zinc-400">{value}</span>
      </div>
    </div>
  );
}

export function ThemeControls({
  value,
  onChange,
}: {
  value: ThemeValue;
  onChange: (value: ThemeValue) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Swatches
        label="Primary color"
        colors={PRIMARY_SWATCHES}
        value={value.primaryColor}
        onChange={(primaryColor) => onChange({ ...value, primaryColor })}
      />
      <Swatches
        label="Accent color"
        colors={ACCENT_SWATCHES}
        value={value.accentColor}
        onChange={(accentColor) => onChange({ ...value, accentColor })}
      />
      <Field label="Display font" hint="Serif gives the store a boutique, editorial feel.">
        <div className="flex gap-2">
          {(
            [
              ['sans', 'Modern sans'],
              ['serif', 'Editorial serif'],
            ] as const
          ).map(([font, label]) => (
            <button
              key={font}
              type="button"
              onClick={() => onChange({ ...value, font })}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                value.font === font
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

export function DeliveryZoneEditor({
  zones,
  onChange,
}: {
  zones: DeliveryZone[];
  onChange: (zones: DeliveryZone[]) => void;
}) {
  const update = (index: number, patch: Partial<DeliveryZone>) => {
    onChange(zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));
  };

  return (
    <div className="flex flex-col gap-2">
      {zones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white/70 px-3 py-4 text-center text-xs text-zinc-500">
          No delivery zones yet. Customers will be told the charge is confirmed by the shop.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 sm:grid sm:grid-cols-[1fr_100px_86px_32px]">
            <span>Zone</span>
            <span>Charge (৳)</span>
            <span>ETA (days)</span>
            <span />
          </div>
          {zones.map((zone, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-2 sm:grid-cols-[1fr_100px_86px_32px] sm:items-center"
            >
              <input
                value={zone.name}
                onChange={(event) => update(index, { name: event.target.value })}
                placeholder="e.g. Inside Dhaka"
                maxLength={60}
                className={`${inputClass} py-2`}
              />
              <input
                type="number"
                min={0}
                value={zone.charge}
                onChange={(event) => update(index, { charge: Number(event.target.value) || 0 })}
                className={`${inputClass} py-2`}
                aria-label={`Charge for ${zone.name || 'zone'}`}
              />
              <input
                type="number"
                min={0}
                max={30}
                value={zone.etaDays}
                onChange={(event) => update(index, { etaDays: Number(event.target.value) || 0 })}
                className={`${inputClass} py-2`}
                aria-label={`Delivery days for ${zone.name || 'zone'}`}
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() => onChange(zones.filter((_, i) => i !== index))}
                aria-label="Remove delivery zone"
              >
                <Icon.Trash size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => onChange([...zones, { name: '', charge: 0, etaDays: 1 }])}
        disabled={zones.length >= 20}
        icon={<Icon.Plus size={13} />}
      >
        Add delivery zone
      </Button>
    </div>
  );
}

export function MiniStorePreview({
  name,
  description,
  templateId,
  theme,
  categories,
}: {
  name: string;
  description: string;
  templateId: TemplateId;
  theme: ThemeValue;
  categories?: readonly string[];
}) {
  const visuals = TEMPLATE_VISUALS[templateId];
  const font = storefrontFont(theme.font);
  const samples = (
    categories?.length ? categories : ['New arrivals', 'Best sellers', 'Featured']
  ).slice(0, 4);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm"
      style={{ backgroundColor: visuals.surface, fontFamily: font }}
    >
      {visuals.header === 'centered' ? (
        <div className="border-b border-black/5 px-4 py-3 text-center">
          <p
            className="text-sm font-semibold tracking-[0.18em] uppercase"
            style={{ color: theme.primaryColor }}
          >
            {name || 'Your shop'}
          </p>
          <div className="mt-1 flex justify-center gap-2 text-[9px] uppercase tracking-wider text-zinc-400">
            {(categories ?? ['Shop', 'New in', 'Contact']).slice(0, 3).map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-4 py-3 text-white"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-xs font-bold">
            {(name || 'S').slice(0, 1)}
          </span>
          <span className="text-xs font-bold">{name || 'Your shop'}</span>
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[9px]">AI agent</span>
        </div>
      )}

      {visuals.hero === 'gradient' ? (
        <div
          className="mx-3 mt-3 rounded-xl px-4 py-4 text-white"
          style={{
            background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.accentColor})`,
          }}
        >
          <p className="text-[9px] uppercase tracking-widest text-white/70">New collection</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
            {description || 'Curated pieces for every day.'}
          </p>
        </div>
      ) : null}

      {visuals.hero === 'editorial' ? (
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-black/5 bg-white/60 p-3">
          <div className="flex-1">
            <p
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: theme.primaryColor }}
            >
              The collection
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-zinc-800">
              {description || 'Quietly beautiful things, chosen with care.'}
            </p>
          </div>
          <div
            className="h-14 w-14 shrink-0 rounded-full"
            style={{ backgroundColor: `${theme.accentColor}44` }}
          />
        </div>
      ) : null}

      <div className={`grid ${visuals.grid} px-3 py-3`}>
        {samples.map((label, index) => (
          <div key={label} className="flex flex-col gap-1">
            <div
              className={`${visuals.cardAspect} flex items-center justify-center rounded-lg`}
              style={{
                backgroundColor:
                  index === 0 ? `${theme.primaryColor}1f` : index === 1 ? '#ecebe7' : '#e8e6e1',
              }}
            >
              <Icon.Package size={16} style={{ color: `${theme.primaryColor}99` }} />
            </div>
            <span className="line-clamp-1 text-[10px] font-medium text-zinc-700">{label}</span>
            <span className="text-[10px] font-bold" style={{ color: theme.primaryColor }}>
              ৳{(index + 2) * 450}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-black/5 px-3 py-2 text-center text-[9px] text-zinc-400">
        Powered by EasyShopAI
      </div>
    </div>
  );
}
