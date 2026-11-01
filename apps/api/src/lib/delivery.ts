import type { DeliveryZone } from '@easyshop/shared';

/**
 * Delivery pricing is server-owned: the storefront checkout and the AI
 * `create_order` tool both go through this resolver. A client never sends an
 * amount — only a zone name.
 */
export type DeliveryResolution =
  { ok: true; charge: number; zone: DeliveryZone | null } | { ok: false; error: string };

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveDeliveryCharge(
  zones: DeliveryZone[],
  requested?: string | null,
): DeliveryResolution {
  if (zones.length === 0) {
    // A shop may not have configured delivery yet. The storefront shows
    // "to be confirmed"; the order total simply has no delivery line.
    return { ok: true, charge: 0, zone: null };
  }

  const name = requested?.trim();
  if (!name) {
    return {
      ok: false,
      error: `Choose a delivery zone: ${zones.map((z) => `${z.name} (৳${z.charge})`).join(', ')}`,
    };
  }

  const needle = normalize(name);
  const zone =
    zones.find((z) => normalize(z.name) === needle) ??
    zones.find((z) => normalize(z.name).includes(needle) || needle.includes(normalize(z.name)));

  if (!zone) {
    return {
      ok: false,
      error: `Unknown delivery zone "${name}". Available zones: ${zones
        .map((z) => `${z.name} (৳${z.charge})`)
        .join(', ')}`,
    };
  }

  return { ok: true, charge: zone.charge, zone };
}
