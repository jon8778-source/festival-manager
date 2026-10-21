// Negotiation rules from spec section 5, with the decisions in docs/DECISIONS.md:
// emerging bands get a discount and expect one slot higher; slot and merch adjustments are
// linear per step and multiply together; a rejection costs a round rather than ending talks.

import { clamp } from './math';
import { defaultTuning, type Tuning } from './tuning';

/** Festival 1 bill positions, lowest first. */
export const SLOTS = ['opener', 'support', 'headliner'] as const;
export type Slot = (typeof SLOTS)[number];

export function slotRank(slot: Slot): number {
  return SLOTS.indexOf(slot);
}

/** The band stats negotiation needs. */
export interface BandProfile {
  tier: number;
  /** 0 to 100. */
  reputation: number;
  feeAsk: number;
  /** Points (10 for 10%). */
  merchAsk: number;
  emerging: boolean;
}

export interface Offer {
  fee: number;
  slot: Slot;
  /** Points (0 to 30). */
  merchPct: number;
}

export type TalksStatus = 'open' | 'signed' | 'closed';

export interface Talks {
  status: TalksStatus;
  patience: number;
  /** 0 to 100, display only. */
  mood: number;
}

export function newTalks(t: Tuning = defaultTuning): Talks {
  return { status: 'open', patience: t.negotiation.patience, mood: t.negotiation.moodStart };
}

/** False if festival reputation is below the band's tier minimum ("Not at this festival yet."). */
export function gateOpen(tier: number, festivalReputation: number, t: Tuning = defaultTuning): boolean {
  const gate = t.negotiation.tierGate;
  const minimum = gate[clamp(tier, 1, gate.length) - 1] ?? 0;
  return festivalReputation >= minimum;
}

/** The band's ask at festival reputation, clamped to 0.8 to 1.4 times the ask. */
export function requiredFee(feeAsk: number, bandReputation: number, festivalReputation: number, t: Tuning = defaultTuning): number {
  const n = t.negotiation;
  const factor = clamp(1 + (bandReputation - festivalReputation) / n.repDivisor, n.requiredFeeMin, n.requiredFeeMax);
  return feeAsk * factor;
}

/** Required fee at the band's expected slot and merch ask, after the emerging discount. */
export function baseRequiredFee(band: BandProfile, festivalReputation: number, t: Tuning = defaultTuning): number {
  const fee = requiredFee(band.feeAsk, band.reputation, festivalReputation, t);
  return band.emerging ? fee * (1 - t.negotiation.emergingDiscount) : fee;
}

/** Tier 3+ expect to headline at festival 1, tier 2 support, tier 1 opener; emerging bands want one slot higher. */
export function expectedSlot(band: BandProfile, t: Tuning = defaultTuning): Slot {
  const ranks = t.negotiation.expectedSlotRankByTier;
  const rank = ranks[clamp(band.tier, 1, ranks.length) - 1] ?? 0;
  return SLOTS[clamp(rank + (band.emerging ? 1 : 0), 0, SLOTS.length - 1)] as Slot;
}

/** Fee multiplier for the bill position: +10% per slot below expected, -5% per slot above. */
export function slotMultiplier(offered: Slot, expected: Slot, t: Tuning = defaultTuning): number {
  const diff = slotRank(offered) - slotRank(expected);
  const n = t.negotiation;
  return diff < 0 ? 1 + n.slotBelowPremium * -diff : 1 - n.slotAboveDiscount * diff;
}

/** Fee multiplier for the merch split: +4% per 5 points below the ask, -2% per 5 points above. */
export function merchMultiplier(offeredPct: number, askPct: number, t: Tuning = defaultTuning): number {
  const n = t.negotiation;
  const steps = (offeredPct - askPct) / n.merchStep;
  return steps < 0 ? 1 + n.merchBelowPremium * -steps : 1 - n.merchAboveDiscount * steps;
}

/** Required fee after the bill position and merch adjustments. */
export function adjustedRequiredFee(band: BandProfile, festivalReputation: number, offer: Offer, t: Tuning = defaultTuning): number {
  return (
    baseRequiredFee(band, festivalReputation, t) *
    slotMultiplier(offer.slot, expectedSlot(band, t), t) *
    merchMultiplier(offer.merchPct, band.merchAsk, t)
  );
}

export function scoreOffer(band: BandProfile, festivalReputation: number, offer: Offer, t: Tuning = defaultTuning): number {
  return offer.fee / adjustedRequiredFee(band, festivalReputation, offer, t);
}

export type CounterTerm = 'fee' | 'slot' | 'merch';

export interface Counter {
  offer: Offer;
  /** The term the band moved, for "and says why". */
  term: CounterTerm;
}

/**
 * The band moves the one term with the biggest gap just enough to reach a score of 1.0.
 * Gaps are fee-equivalent multipliers. Merch can move above the band's ask, up to the 30% maximum.
 * If that term alone cannot reach 1.0 (the slot is taken, or merch would pass 30%), the rest is
 * made up on the fee.
 * `openSlots` lists the slots the band could be moved to (the offered slot is always allowed).
 */
export function buildCounter(
  band: BandProfile,
  festivalReputation: number,
  offer: Offer,
  openSlots: readonly Slot[] = SLOTS,
  t: Tuning = defaultTuning,
): Counter {
  const base = baseRequiredFee(band, festivalReputation, t);
  const expected = expectedSlot(band, t);
  const gaps: Record<CounterTerm, number> = {
    fee: offer.fee > 0 ? base / offer.fee : Infinity,
    slot: slotMultiplier(offer.slot, expected, t),
    merch: merchMultiplier(offer.merchPct, band.merchAsk, t),
  };
  const term = (['fee', 'slot', 'merch'] as const).reduce((a, b) => (gaps[b] > gaps[a] ? b : a));
  const score = (o: Offer) => scoreOffer(band, festivalReputation, o, t);
  let counter: Offer = { ...offer };

  if (term === 'slot') {
    for (let rank = slotRank(offer.slot) + 1; rank <= slotRank(expected) && score(counter) < 1; rank++) {
      const slot = SLOTS[rank] as Slot;
      if (openSlots.includes(slot)) counter = { ...counter, slot };
    }
  } else if (term === 'merch') {
    const n = t.negotiation;
    const multiplierNeeded = offer.fee / (base * slotMultiplier(offer.slot, expected, t));
    const merchNeeded =
      multiplierNeeded >= 1
        ? band.merchAsk - ((multiplierNeeded - 1) / n.merchBelowPremium) * n.merchStep
        : band.merchAsk + ((1 - multiplierNeeded) / n.merchAboveDiscount) * n.merchStep;
    counter = { ...counter, merchPct: clamp(Math.ceil(merchNeeded), offer.merchPct, n.merchMax) };
  }

  if (score(counter) < 1) {
    counter = { ...counter, fee: Math.ceil(adjustedRequiredFee(band, festivalReputation, counter, t)) };
  }
  return { offer: counter, term };
}

export type Response =
  | { kind: 'refused'; talks: Talks }
  | { kind: 'accept'; score: number; talks: Talks }
  | { kind: 'counter'; score: number; counter: Counter; talks: Talks }
  | { kind: 'reject'; score: number; talks: Talks }
  /** Patience ran out on this offer: talks are closed for this festival. */
  | { kind: 'walkedAway'; score: number; talks: Talks };

/** The band's response to an offer, with the updated talks state. */
export function respond(
  band: BandProfile,
  festivalReputation: number,
  offer: Offer,
  talks: Talks,
  openSlots: readonly Slot[] = SLOTS,
  t: Tuning = defaultTuning,
): Response {
  const n = t.negotiation;
  if (!gateOpen(band.tier, festivalReputation, t)) return { kind: 'refused', talks };
  if (talks.status !== 'open') throw new Error(`Talks are ${talks.status}`);

  const score = scoreOffer(band, festivalReputation, offer, t);
  if (score >= n.acceptAt) return { kind: 'accept', score, talks: { ...talks, status: 'signed' } };

  let next = talks;
  if (score < n.roundCostBelow) {
    next = { ...talks, patience: talks.patience - 1, mood: Math.max(0, talks.mood - n.moodDropPerBadRound) };
    if (next.patience <= 0) return { kind: 'walkedAway', score, talks: { ...next, patience: 0, status: 'closed' } };
  }
  if (score >= n.counterAt) {
    return { kind: 'counter', score, counter: buildCounter(band, festivalReputation, offer, openSlots, t), talks: next };
  }
  return { kind: 'reject', score, talks: next };
}

/** The player accepts the band's counter: talks are signed. */
export function acceptCounter(talks: Talks): Talks {
  return { ...talks, status: 'signed' };
}

/** The player walks away: talks close for this festival. */
export function walkAway(talks: Talks): Talks {
  return { ...talks, status: 'closed' };
}

/** Randy's market-rate hint: the required fee plus or minus 15% (8% for bands booked before), in whole pounds. */
export function marketRateHint(
  band: BandProfile,
  festivalReputation: number,
  bookedBefore: boolean,
  t: Tuning = defaultTuning,
): { low: number; high: number } {
  const fee = baseRequiredFee(band, festivalReputation, t);
  const spread = bookedBefore ? t.negotiation.hintSpreadKnown : t.negotiation.hintSpread;
  return { low: Math.round(fee * (1 - spread)), high: Math.round(fee * (1 + spread)) };
}

export type Verdict = 'ok' | 'close' | 'low';

/** The OK, Close or Low verdict on each term of an offer, compared with what the band wants. */
export function termVerdicts(
  band: BandProfile,
  festivalReputation: number,
  offer: Offer,
  t: Tuning = defaultTuning,
): Record<CounterTerm, Verdict> {
  const n = t.negotiation;
  const feeRatio = offer.fee / baseRequiredFee(band, festivalReputation, t);
  const slotsShort = slotRank(expectedSlot(band, t)) - slotRank(offer.slot);
  const merchShort = band.merchAsk - offer.merchPct;
  return {
    fee: feeRatio >= 1 ? 'ok' : feeRatio >= n.verdictCloseAt ? 'close' : 'low',
    slot: slotsShort <= 0 ? 'ok' : slotsShort === 1 ? 'close' : 'low',
    merch: merchShort <= 0 ? 'ok' : merchShort <= n.merchStep ? 'close' : 'low',
  };
}
