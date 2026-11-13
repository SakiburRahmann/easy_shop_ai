import type { TemplateId } from '@easyshop/shared';

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
    header: 'compact',
    hero: 'browse',
    catalog: 'dense',
    display: 'neutral',
    sections: ['announcement', 'intro', 'catalog', 'trust', 'policies'],
    surface: '#ffffff',
    ink: '#111214',
    muted: '#6d7076',
    defaultFont: 'sans',
    cardAspect: 'aspect-square',
    grid: 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
  },
  /** Editorial motion: cinematic hero, mosaic, rail, gallery. */
  modern: {
    header: 'overlay',
    hero: 'collage',
    catalog: 'gallery',
    display: 'grotesque',
    sections: ['hero', 'categoryCollage', 'rail', 'catalog', 'story', 'trust'],
    surface: '#f4f4f3',
    ink: '#0d0e10',
    muted: '#5c6066',
    defaultFont: 'sans',
    cardAspect: 'aspect-[3/4]',
    grid: 'grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3',
  },
  /** Atelier: serif display, asymmetric hero, lookbook, two-column catalogue. */
  boutique: {
    header: 'masthead',
    hero: 'editorial',
    catalog: 'atelier',
    display: 'serif',
    sections: ['hero', 'categoryIndex', 'catalog', 'story', 'policies'],
    surface: '#ffffff',
    ink: '#171512',
    muted: '#7b746b',
    defaultFont: 'serif',
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
