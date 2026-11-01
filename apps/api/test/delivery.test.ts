import { describe, expect, it } from 'vitest';
import { resolveDeliveryCharge } from '../src/lib/delivery';
import type { DeliveryZone } from '@easyshop/shared';

const zones: DeliveryZone[] = [
  { name: 'Inside Dhaka', charge: 60, etaDays: 1 },
  { name: 'Outside Dhaka', charge: 120, etaDays: 3 },
];

describe('resolveDeliveryCharge', () => {
  it('charges the exact zone selected by name', () => {
    expect(resolveDeliveryCharge(zones, 'Inside Dhaka')).toEqual({
      ok: true,
      charge: 60,
      zone: zones[0],
    });
  });

  it('matches a zone case-insensitively and tolerates a spoken hint', () => {
    expect(resolveDeliveryCharge(zones, 'outside dhaka')).toMatchObject({ ok: true, charge: 120 });
    expect(resolveDeliveryCharge(zones, 'Dhaka')).toMatchObject({ ok: true, charge: 60 });
  });

  it('requires a zone when the shop has configured delivery', () => {
    const result = resolveDeliveryCharge(zones, '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Inside Dhaka');
  });

  it('rejects an unknown zone instead of silently charging zero', () => {
    const result = resolveDeliveryCharge(zones, 'Sylhet');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Unknown delivery zone');
  });

  it('allows a zero charge when the shop has no zones', () => {
    expect(resolveDeliveryCharge([], undefined)).toEqual({
      ok: true,
      charge: 0,
      zone: null,
    });
  });
});
