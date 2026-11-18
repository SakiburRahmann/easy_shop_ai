import { THEME_PRESETS, type TemplateId } from '@easyshop/shared';

/**
 * A template is a *composition*, not a recolour — the Shopify "sections" and
 * Odoo "building blocks" model. Each preset chooses its own section order,
 * header architecture, catalogue density and type pairing, while sharing one
 * catalogue, cart, COD checkout and AI agent.
 *
 * Deliberately avoided (generated-page tells): gradient heroes, blur blobs,
 * pills above headings, one radius on every surface, icon tiles in a row,
 * cream-as-tastefulness, decorative 01/02 numbering.
 */

export type HeaderStyle = 'compact' | 'overlay' | 'masthead';
export type HeroStyle = 'browse' | 'collage' | 'editorial';
export type CatalogStyle = 'dense' | 'gallery' | 'atelier';
export type DisplayFace = 'neutral' | 'grotesque' | 'serif';

export type StorefrontSection =
  | 'announcement'
  | 'intro'
  | 'hero'
  | 'categoryCollage'
  | 'categoryIndex'
  | 'rail'
  | 'catalog'
  | 'story'
  | 'trust'
  | 'policies';

export interface TemplateVisuals {
  /** Retail bar, cinematic overlay bar, or a centred serif masthead. */
  header: HeaderStyle;
  hero: HeroStyle;
  /** Catalogue presentation: square retail grid, gallery, or atelier. */
  catalog: CatalogStyle;
  /** Display typeface role for headings and product names. */
  display: DisplayFace;
  /** Ordered home sections. `catalog` appears exactly once. */
  sections: readonly StorefrontSection[];
  surface: string;
  /** Primary text colour on the surface. */
  ink: string;
  muted: string;
  defaultFont: 'sans' | 'serif';
  /** Tile aspect used by the seller-side builder preview. */
  cardAspect: string;
  grid: string;
}

export const TEMPLATE_VISUALS: Record<TemplateId, TemplateVisuals> = {
  /** Retail: type-led opener, square product grid, no hero photography. */
  classic: {
    header: THEME_PRESETS.classic.header,
    hero: THEME_PRESETS.classic.hero,
    catalog: THEME_PRESETS.classic.catalog,
    display: THEME_PRESETS.classic.display,
    sections: THEME_PRESETS.classic.sections,
    surface: THEME_PRESETS.classic.surface,
    ink: THEME_PRESETS.classic.ink,
    muted: THEME_PRESETS.classic.muted,
    defaultFont: THEME_PRESETS.classic.font,
    cardAspect: 'aspect-square',
    grid: 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
  },
  /** Editorial motion: cinematic hero, mosaic, rail, gallery. */
  modern: {
    header: THEME_PRESETS.modern.header,
    hero: THEME_PRESETS.modern.hero,
    catalog: THEME_PRESETS.modern.catalog,
    display: THEME_PRESETS.modern.display,
    sections: THEME_PRESETS.modern.sections,
    surface: THEME_PRESETS.modern.surface,
    ink: THEME_PRESETS.modern.ink,
    muted: THEME_PRESETS.modern.muted,
    defaultFont: THEME_PRESETS.modern.font,
    cardAspect: 'aspect-[3/4]',
    grid: 'grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3',
  },
  /** Atelier: serif display, asymmetric hero, lookbook, two-column catalogue. */
  boutique: {
    header: THEME_PRESETS.boutique.header,
    hero: THEME_PRESETS.boutique.hero,
    catalog: THEME_PRESETS.boutique.catalog,
    display: THEME_PRESETS.boutique.display,
    sections: THEME_PRESETS.boutique.sections,
    surface: THEME_PRESETS.boutique.surface,
    ink: THEME_PRESETS.boutique.ink,
    muted: THEME_PRESETS.boutique.muted,
    defaultFont: THEME_PRESETS.boutique.font,
    cardAspect: 'aspect-[4/5]',
    grid: 'grid-cols-1 gap-y-10 sm:grid-cols-2',
  },
};

/** CSS font stack for a shop's chosen display style. */
export function storefrontFont(
  font: 'sans' | 'serif' | undefined,
  display: DisplayFace = 'neutral',
): string | undefined {
  if (font === 'serif' || display === 'serif') {
    return 'var(--font-display), var(--font-bangla), Georgia, serif';
  }
  if (display === 'grotesque') {
    return 'var(--font-grotesque), var(--font-inter), ui-sans-serif, sans-serif';
  }
  return undefined;
}
