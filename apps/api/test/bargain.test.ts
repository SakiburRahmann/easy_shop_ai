import { describe, expect, it } from 'vitest';
import { effectiveFloor, resolveOffer } from '../src/lib/bargain';

const base = { listPrice: 1000, floorPrice: 800, maxDiscountPct: 20 };

describe('effectiveFloor', () => {
  it('binds to the higher of floor price and global cap', () => {
    // cap 20% => 800; product floor 800 → effective 800
    expect(effectiveFloor({ listPrice: 1000, floorPrice: 800, maxDiscountPct: 20 })).toBe(800);
  });
  it('floor price wins when it is stricter', () => {
    expect(effectiveFloor({ listPrice: 1000, floorPrice: 900, maxDiscountPct: 50 })).toBe(900);
  });
  it('global cap wins when floor is loose', () => {
    expect(effectiveFloor({ listPrice: 1000, floorPrice: 100, maxDiscountPct: 10 })).toBe(900);
  });
  it('clamps invalid percentages', () => {
    expect(effectiveFloor({ listPrice: 100, floorPrice: 0, maxDiscountPct: 150 })).toBe(0);
    expect(effectiveFloor({ listPrice: 100, floorPrice: 0, maxDiscountPct: -5 })).toBe(100);
  });
});

describe('resolveOffer', () => {
  it('accepts an offer at the effective floor', () => {
    const v = resolveOffer(base, 840);
    expect(v.decision).toBe('accept');
    if (v.decision === 'accept') expect(v.unitPrice).toBe(840);
  });

  it('accepts an offer above list price at list price', () => {
    const v = resolveOffer(base, 1200);
    expect(v.decision).toBe('accept');
    if (v.decision === 'accept') expect(v.unitPrice).toBe(1000);
  });

  it('counters an offer below the effective floor', () => {
    const v = resolveOffer({ listPrice: 1000, floorPrice: 850, maxDiscountPct: 10 }, 820);
    expect(v.decision).toBe('counter');
    if (v.decision === 'counter') expect(v.unitPrice).toBe(900); // cap floor 900 > product floor 850
  });

  it('rejects abusive lowballs', () => {
    const v = resolveOffer({ listPrice: 1000, floorPrice: 100, maxDiscountPct: 50 }, 100);
    expect(v.decision).toBe('reject');
  });

  it('rejects invalid amounts', () => {
    expect(resolveOffer(base, 0).decision).toBe('reject');
    expect(resolveOffer(base, -5).decision).toBe('reject');
    expect(resolveOffer(base, Number.NaN).decision).toBe('reject');
  });

  it('never allows a price below the product floor price', () => {
    for (const offer of [0, 10, 500, 799.99]) {
      const v = resolveOffer({ listPrice: 1000, floorPrice: 800, maxDiscountPct: 90 }, offer);
      if (v.decision === 'accept') expect(v.unitPrice).toBeGreaterThanOrEqual(800);
    }
  });
});
