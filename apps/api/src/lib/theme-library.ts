/**
 * The storefront theme library.
 *
 * Every entry is a PRESET: composition (which blocks, in what order), palette,
 * typography and one call-to-action. No theme carries code, and no theme is
 * generated at request time — the library is derived deterministically from the
 * design metadata extracted out of the vendored template archives
 * (`scripts/build-design-catalog.mjs`), plus the three curated house presets.
 *
 * This is the Shopify/Odoo model: a seller picks a theme, the platform renders
 * it with shared, tested components, and the seller then customises settings.
 */
import {
  THEME_PRESETS,
  businessTypeSchema,
  storefrontThemeSchema,
  themePresetSchema,
  type BusinessType,
  type Shop,
  type StorefrontTheme,
  type ThemeApplyInput,
  type ThemeLayout,
  type ThemePreset,
  type ThemeSectionId,
  type ThemeTokens,
  type TemplateId,
} from '@easyshop/shared';
import { TEMPLATE_CATALOG } from '../data/design-catalog.generated';

/* ═══════════════════════════════════════════════════════ colours ═══════ */

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  if (![r, g, b].every(Number.isFinite)) return 0;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1…21). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/i;

function usableAccent(candidate: string | undefined, fallback: string): string {
  return candidate && HEX.test(candidate) && contrast(candidate, '#ffffff') >= 2.5
    ? candidate.toLowerCase()
    : fallback;
}

/* ═══════════════════════════════════════════════════ preset builder ════ */

type CatalogRecord = (typeof TEMPLATE_CATALOG)[number];

const SECTIONS: Record<ThemeLayout['hero'], readonly ThemeSectionId[]> = {
  collage: ['hero', 'categoryCollage', 'rail', 'catalog', 'story', 'trust'],
  editorial: ['announcement', 'hero', 'categoryIndex', 'catalog', 'story', 'policies'],
  browse: ['announcement', 'intro', 'catalog', 'trust', 'policies'],
};

/**
 * Maps one catalogue record to a preset. Purely functional and stable: the same
 * archive always yields the same library, so the gallery does not reshuffle.
 */
export function presetFromRecord(record: CatalogRecord): ThemePreset {
  const style = new Set(record.style);
  const dark = style.has('dark');
  const serif = style.has('serif') || style.has('editorial');
  const photographic = style.has('fullbleed-hero') || style.has('carousel') || style.has('video');

  const hero: ThemeLayout['hero'] = serif ? 'editorial' : photographic ? 'collage' : 'browse';
  const header: ThemeLayout['header'] =
    hero === 'editorial' ? 'masthead' : hero === 'collage' ? 'overlay' : 'compact';
  const catalog: ThemeLayout['catalog'] =
    hero === 'editorial' ? 'atelier' : hero === 'collage' ? 'gallery' : 'dense';
  const density: ThemeLayout['density'] = serif
    ? 'airy'
    : style.has('square')
      ? 'compact'
      : 'balanced';
  const radius: ThemeTokens['radius'] = serif ? 'sharp' : style.has('cards') ? 'soft' : 'sharp';

  const palette = record.palette.filter((hex) => HEX.test(hex));
  const primary = usableAccent(palette[0], dark ? '#e8e6e3' : '#111214');
  const accent = usableAccent(palette[1], '#c2703f');

  const tokens: ThemeTokens = {
    primary,
    accent,
    surface: dark ? '#0d0e10' : '#ffffff',
    ink: dark ? '#f5f5f4' : '#111214',
    muted: dark ? '#a6a7ab' : '#6d7076',
    font: serif ? 'serif' : 'sans',
    radius,
  };

  return themePresetSchema.parse({
    id: record.id,
    name: record.name.slice(0, 70),
    category: record.category,
    ourType: businessTypeSchema.safeParse(record.ourType).success ? record.ourType : 'other',
    style: record.style.slice(0, 8),
    palette: [tokens.primary, tokens.accent, tokens.surface].slice(0, 5),
    curated: false,
    layout: {
      header,
      hero,
      catalog,
      display: serif ? 'serif' : 'neutral',
      density,
      nav: hero === 'editorial' ? 'collections' : 'categories',
      sections: [...SECTIONS[hero]],
    },
    tokens,
    ctaLabel: hero === 'editorial' ? 'View the collection' : 'Browse the catalog',
  });
}

const HOUSE_IDS: Record<TemplateId, string> = {
  classic: 'house-classic',
  modern: 'house-modern',
  boutique: 'house-boutique',
};

function housePreset(templateId: TemplateId, businessType: BusinessType): ThemePreset {
  const preset = THEME_PRESETS[templateId];
  const palette: Record<BusinessType, { primary: string; accent: string }> = {
    fashion: { primary: '#111214', accent: '#c2703f' },
    electronics: { primary: '#1d4ed8', accent: '#0ea5e9' },
    beauty: { primary: '#a8456b', accent: '#d9b08c' },
    groceries: { primary: '#15803d', accent: '#f59e0b' },
    home: { primary: '#8a6f4d', accent: '#3f6152' },
    kids: { primary: '#2563eb', accent: '#f97316' },
    other: { primary: '#059669', accent: '#f59e0b' },
  };
  const colours = palette[businessType] ?? palette.other;
  return themePresetSchema.parse({
    id: HOUSE_IDS[templateId],
    name:
      templateId === 'classic'
        ? 'Classic retail'
        : templateId === 'modern'
          ? 'Modern collage'
          : 'Boutique editorial',
    category: 'house',
    ourType: businessType,
    style:
      templateId === 'classic'
        ? ['retail', 'grid']
        : templateId === 'modern'
          ? ['dark', 'editorial']
          : ['serif', 'minimal'],
    palette: [colours.primary, colours.accent, preset.surface],
    curated: true,
    layout: {
      header: preset.header,
      hero: preset.hero,
      catalog: preset.catalog,
      display: preset.display,
      density: preset.density,
      nav: preset.nav,
      sections: [...preset.sections],
    },
    tokens: {
      primary: colours.primary,
      accent: colours.accent,
      surface: preset.surface,
      ink: preset.ink,
      muted: preset.muted,
      font: preset.font,
      radius: preset.radius,
    },
    ctaLabel: templateId === 'classic' ? 'Browse the catalog' : 'View the collection',
  });
}

/** The full library: curated house presets first, then the archive-derived ones. */
export const THEME_LIBRARY: readonly ThemePreset[] = (() => {
  const house = [
    housePreset('classic', 'other'),
    housePreset('modern', 'fashion'),
    housePreset('boutique', 'beauty'),
  ];
  const seen = new Set(house.map((preset) => preset.id));
  const derived: ThemePreset[] = [];
  for (const record of TEMPLATE_CATALOG) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    derived.push(presetFromRecord(record));
  }
  return [...house, ...derived];
})();

export const THEME_CATEGORIES: readonly string[] = [
  ...new Set(THEME_LIBRARY.map((preset) => preset.category)),
].sort((a, b) => a.localeCompare(b));

export function themeById(id: string | null | undefined): ThemePreset | undefined {
  if (!id) return undefined;
  return THEME_LIBRARY.find((preset) => preset.id === id);
}

export interface ThemeQuery {
  q?: string;
  category?: string;
  businessType?: BusinessType;
  limit?: number;
  offset?: number;
}

/**
 * Gallery search. Ordering is deterministic and useful: curated first, then the
 * seller's own business type, then name. No model, no personalisation, no
 * randomness — two sellers with the same filter see the same list.
 */
export function searchThemes(query: ThemeQuery): { themes: ThemePreset[]; total: number } {
  const words = (query.q ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);

  const matches = THEME_LIBRARY.filter((preset) => {
    if (query.category && preset.category !== query.category) return false;
    if (query.businessType && preset.ourType !== query.businessType && !preset.curated) {
      return false;
    }
    if (!words.length) return true;
    const haystack = `${preset.name} ${preset.category} ${preset.style.join(' ')}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  const ranked = [...matches].sort((a, b) => {
    if (a.curated !== b.curated) return a.curated ? -1 : 1;
    if (query.businessType) {
      const aMatch = a.ourType === query.businessType ? 1 : 0;
      const bMatch = b.ourType === query.businessType ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
    }
    return a.name.localeCompare(b.name);
  });

  const limit = Math.min(60, Math.max(1, query.limit ?? 24));
  const offset = Math.max(0, query.offset ?? 0);
  return { themes: ranked.slice(offset, offset + limit), total: ranked.length };
}

/* ═════════════════════════════════════════════ applying a theme ════════ */

function flatText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .replace(/<[^>]*>/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

const SECTION_SET = new Set<string>([
  'announcement',
  'intro',
  'hero',
  'categoryCollage',
  'categoryIndex',
  'rail',
  'catalog',
  'story',
  'trust',
  'policies',
]);

/** Keeps `catalog` exactly once, drops blocks the chosen hero cannot render. */
export function normalizeSections(
  raw: readonly string[],
  hero: ThemeLayout['hero'],
  fallback: readonly ThemeSectionId[],
): ThemeSectionId[] {
  const usable = (id: ThemeSectionId) =>
    id === 'categoryCollage'
      ? hero === 'collage'
      : id === 'categoryIndex'
        ? hero === 'editorial'
        : true;

  const out: ThemeSectionId[] = [];
  for (const item of raw) {
    if (!SECTION_SET.has(item)) continue;
    const id = item as ThemeSectionId;
    if (out.includes(id) || !usable(id)) continue;
    out.push(id);
  }
  if (!out.includes('catalog')) {
    const at = out.findIndex((id) => id === 'trust' || id === 'policies');
    out.splice(at >= 0 ? at : out.length, 0, 'catalog');
  }
  const bounded = out.slice(0, 10);
  return bounded.length >= 3 ? bounded : [...fallback];
}

/** Repairs colours so text is always readable, whatever the preset carried. */
export function readableTokens(tokens: Partial<ThemeTokens>, fallback: ThemeTokens): ThemeTokens {
  const surface =
    tokens.surface && HEX.test(tokens.surface) ? tokens.surface.toLowerCase() : fallback.surface;
  let ink = tokens.ink && HEX.test(tokens.ink) ? tokens.ink.toLowerCase() : fallback.ink;
  let muted = tokens.muted && HEX.test(tokens.muted) ? tokens.muted.toLowerCase() : fallback.muted;
  let primary =
    tokens.primary && HEX.test(tokens.primary) ? tokens.primary.toLowerCase() : fallback.primary;

  const light = luminance(surface) > 0.5;
  if (contrast(ink, surface) < 4.5) ink = light ? '#111214' : '#f7f7f6';
  if (contrast(muted, surface) < 3) muted = light ? '#5c6066' : '#c9cbcf';
  if (contrast(primary, '#ffffff') < 2.5 || primary === surface) primary = fallback.primary;

  return {
    primary,
    accent:
      tokens.accent && HEX.test(tokens.accent) ? tokens.accent.toLowerCase() : fallback.accent,
    surface,
    ink,
    muted,
    font: tokens.font === 'serif' || tokens.font === 'sans' ? tokens.font : fallback.font,
    radius: tokens.radius ?? fallback.radius,
  };
}

/**
 * Builds the document a shop stores when it applies a theme: preset defaults,
 * the seller's overrides, and the shop's own words as placeholder copy.
 * Total function — an unknown theme id falls back to the house preset.
 */
export function buildStorefront(
  themeId: string,
  overrides: Omit<ThemeApplyInput, 'themeId'>,
  shop: Pick<Shop, 'name' | 'description' | 'templateId' | 'storefront'>,
  now = new Date().toISOString(),
): StorefrontTheme {
  const preset = themeById(themeId) ?? housePreset('classic', 'other');
  const existing = shop.storefront;
  const sameTheme = existing?.themeId === preset.id;

  const tokens = readableTokens({ ...preset.tokens, ...(overrides.tokens ?? {}) }, preset.tokens);
  // Composition is the theme's identity; sellers change copy and colours, not
  // the block order (the gallery is the design decision).
  const sections = normalizeSections(
    existing && sameTheme ? existing.layout.sections : preset.layout.sections,
    preset.layout.hero,
    preset.layout.sections,
  );

  const copy = {
    ...(existing && sameTheme ? existing.copy : {}),
    headline:
      flatText(overrides.copy?.headline, 90) ??
      flatText(shop.description, 90) ??
      shop.name.slice(0, 90),
    ctaLabel:
      flatText(overrides.copy?.ctaLabel, 32) ??
      (existing && sameTheme ? existing.copy.ctaLabel : undefined) ??
      preset.ctaLabel,
  };
  const announcement =
    flatText(overrides.copy?.announcement, 120) ??
    (existing && sameTheme ? existing.copy.announcement : undefined);
  const subhead =
    flatText(overrides.copy?.subhead, 180) ??
    (existing && sameTheme ? existing.copy.subhead : undefined);
  const story =
    flatText(overrides.copy?.story, 400) ??
    (existing && sameTheme ? existing.copy.story : undefined);

  return storefrontThemeSchema.parse({
    version: 1,
    themeId: preset.id,
    layout: { ...preset.layout, sections },
    tokens,
    copy: {
      headline: copy.headline,
      ctaLabel: copy.ctaLabel,
      ...(announcement ? { announcement } : {}),
      ...(subhead ? { subhead } : {}),
      ...(story ? { story } : {}),
    },
    appliedAt: now,
  });
}

/** The shop columns a theme change implies (marketplace cards read them too). */
export function storefrontShopPatch(storefront: StorefrontTheme, preset: ThemePreset) {
  const templateId: TemplateId =
    preset.layout.hero === 'editorial'
      ? 'boutique'
      : preset.layout.hero === 'collage'
        ? 'modern'
        : 'classic';
  return {
    storefront,
    template_id: templateId,
    theme: {
      primaryColor: storefront.tokens.primary,
      accentColor: storefront.tokens.accent,
      font: storefront.tokens.font,
    },
  };
}
