import type { TemplateId } from '@easyshop/shared';

/**
 * Visual configuration for each storefront template. The storefront renders
 * from this config, and the seller-facing builder renders the same config in
 * its live preview — so what a seller picks is what customers see.
 */
export interface TemplateVisuals {
  header: 'bar' | 'centered';
  hero: 'none' | 'gradient' | 'editorial';
  grid: string;
  cardAspect: string;
  card: 'plain' | 'editorial';
  surface: string;
  defaultFont: 'sans' | 'serif';
}

export const TEMPLATE_VISUALS: Record<TemplateId, TemplateVisuals> = {
  classic: {
    header: 'bar',
    hero: 'none',
    grid: 'grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
    cardAspect: 'aspect-square',
    card: 'plain',
    surface: '#f7f7f6',
    defaultFont: 'sans',
  },
  modern: {
    header: 'bar',
    hero: 'gradient',
    grid: 'grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4',
    cardAspect: 'aspect-[3/4]',
    card: 'editorial',
    surface: '#f7f7f6',
    defaultFont: 'sans',
  },
  boutique: {
    header: 'centered',
    hero: 'editorial',
    grid: 'grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3',
    cardAspect: 'aspect-[4/5]',
    card: 'editorial',
    surface: '#fbf8f3',
    defaultFont: 'serif',
  },
};

/** CSS font stack for a shop's chosen display style. */
export function storefrontFont(font: 'sans' | 'serif' | undefined): string | undefined {
  return font === 'serif' ? 'var(--font-display), var(--font-bangla), Georgia, serif' : undefined;
}
