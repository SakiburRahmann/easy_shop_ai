'use client';

/**
 * Maps a shop's applied theme onto the pre-built storefront kit.
 *
 * A theme is a preset document (composition + palette + type + copy) chosen by
 * the seller from the library. Every field below maps to a component or class
 * that already exists — no model output, no generated markup.
 */
import {
  THEME_PRESETS,
  type Storefront as StorefrontPayload,
  type StorefrontTheme,
} from '@easyshop/shared';
import type { StorefrontSection, TemplateVisuals } from '@/components/storefront/templates';

export interface ThemeVisuals extends TemplateVisuals {
  /** Corner language applied through `data-es-radius` (see globals.css). */
  radius: StorefrontTheme['tokens']['radius'];
  density: StorefrontTheme['layout']['density'];
  /** Shop copy the seller wrote for this theme. */
  copy: StorefrontTheme['copy'];
}

const GRID: Record<StorefrontTheme['layout']['catalog'], string> = {
  dense: 'grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4',
  gallery: 'grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3',
  atelier: 'grid grid-cols-1 gap-x-12 gap-y-16 sm:grid-cols-2',
};

const ASPECT: Record<StorefrontTheme['layout']['catalog'], string> = {
  dense: 'aspect-square',
  gallery: 'aspect-[3/4]',
  atelier: 'aspect-[4/5]',
};

export function visualsFromStorefront(storefront: StorefrontTheme): ThemeVisuals {
  const preset = THEME_PRESETS.classic;
  const sections = storefront.layout.sections.filter(
    (section): section is StorefrontSection => typeof section === 'string',
  );

  return {
    header: storefront.layout.header,
    hero: storefront.layout.hero,
    catalog: storefront.layout.catalog,
    display: storefront.layout.display,
    sections: sections.length >= 3 ? sections : [...preset.sections],
    surface: storefront.tokens.surface,
    ink: storefront.tokens.ink,
    muted: storefront.tokens.muted,
    defaultFont: storefront.tokens.font,
    cardAspect: ASPECT[storefront.layout.catalog],
    grid: GRID[storefront.layout.catalog],
    radius: storefront.tokens.radius,
    density: storefront.layout.density,
    copy: storefront.copy,
  };
}

/** The theme applied to this shop, if any. */
export function storefrontOf(data: StorefrontPayload): StorefrontTheme | null {
  return data.shop.storefront ?? null;
}
