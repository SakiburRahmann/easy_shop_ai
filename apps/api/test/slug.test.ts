import { describe, expect, it } from 'vitest';
import { slugify, slugVariants } from '../src/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Rahman Fashion House')).toBe('rahman-fashion-house');
  });
  it('strips punctuation and trims hyphens', () => {
    expect(slugify("Rifat's -- Store!")).toBe('rifat-s-store');
  });
  it('falls back to empty for non-latin names', () => {
    expect(slugify('রহমান ফ্যাশন')).toBe('');
  });
  it('handles mixed names using latin part', () => {
    expect(slugify('নূর Fashion')).toBe('fashion');
  });
  it('caps length at 50', () => {
    const slug = slugify('a'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(50);
  });
});

describe('slugVariants', () => {
  it('returns base then -2..-50 suffixed variants', () => {
    const variants = slugVariants('shop');
    expect(variants[0]).toBe('shop');
    expect(variants[1]).toBe('shop-2');
    expect(variants.length).toBe(50);
    expect(variants[49]).toBe('shop-50');
  });
});
