import type { DiscountVerdict } from '@easyshop/shared';

/**
 * Server-side bargaining rules (AGENTS.md rule #4): the model NEVER decides
 * prices. `resolveOffer` is pure and unit tested.
 *
 * A seller sets a per-product floor price, and additionally caps the AI with
 * `maxDiscountPct` (percentage off list price). The effective floor is the
 * HIGHER of the two — a generous floor price or a tight global cap both bind.
 */
export interface OfferContext {
  listPrice: number;
  floorPrice: number;
  maxDiscountPct: number;
}

/** The lowest price the assistant may ever agree to for one unit. */
export function effectiveFloor({ listPrice, floorPrice, maxDiscountPct }: OfferContext): number {
  const capFloor = listPrice * (1 - clampPct(maxDiscountPct) / 100);
  return round2(Math.max(floorPrice, capFloor, 0));
}

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** BDT sentences are injected by the model; these messages are model-facing. */
export function resolveOffer(ctx: OfferContext, offered: number): DiscountVerdict {
  const { listPrice } = ctx;
  const floor = effectiveFloor(ctx);

  if (!Number.isFinite(offered) || offered <= 0) {
    return {
      decision: 'reject',
      message: `Offer is not a valid amount. List price is ৳${round2(listPrice)}.`,
    };
  }

  // Offering above list price: sell at list price.
  if (offered >= listPrice) {
    return {
      decision: 'accept',
      unitPrice: round2(listPrice),
      message: 'Offer meets or exceeds list price — accept at list price.',
    };
  }

  const exact = round2(offered);
  if (exact >= floor) {
    return { decision: 'accept', unitPrice: exact, message: `Offer accepted at ৳${exact}.` };
  }

  // Lowballs far below the floor get a flat rejection.
  if (exact < round2(listPrice * 0.2)) {
    return {
      decision: 'reject',
      message: `Offer too far below the floor (৳${exact} vs floor ৳${floor}). Explain politely that this is not possible.`,
    };
  }

  return {
    decision: 'counter',
    unitPrice: floor,
    originalPrice: round2(listPrice),
    floorPrice: floor,
    maxDiscountPct: ctx.maxDiscountPct,
    message: `Offer below floor. Counter at ৳${floor} (effective floor). Do not go lower; if the customer declines, politely hold list price ৳${round2(listPrice)}.`,
  };
}
