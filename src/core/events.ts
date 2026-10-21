// Event and decision resolution (spec sections 6 and 9). The event and decision text and
// numbers are content (src/data/events.json); this module only applies an option.

import type { EventTotals } from './economy';
import { foodQueueRisk, noEvents } from './economy';
import { chance, type RngState } from './random';
import { defaultTuning, type Tuning } from './tuning';

export type OptionKey = 'A' | 'B' | 'C';

/** One option on an event or preparation decision card, as written in CONTENT.md. */
export interface EventOption {
  key: OptionKey;
  /** Cost as a share of R (0.036 for 3.6%); negative for a net gain. */
  costShareR: number;
  /** Points. */
  customers: number;
  /** Points. */
  bands: number;
  /** Points. */
  reputation: number;
  /** True if this option risks the noise fine (chance and size from tuning). */
  risksFine?: boolean;
  /** Event ids this choice prevents (the sound limiter prevents the noise complaint). */
  prevents?: string[];
  /** Flat addition to attendance share (posters: 0.03 for 3 points). */
  attendanceBonus?: number;
  /** Ticket price cut as a share of the fair price (0.08 for 8%), from the next day. */
  priceCutShareOfFair?: number;
}

export interface OptionEffect {
  cost: number;
  /** 0 to 1 scale. */
  customerDelta: number;
  /** 0 to 1 scale. */
  bandDelta: number;
  /** Points. */
  reputationDelta: number;
  fine: number;
  fined: boolean;
  prevents: string[];
  attendanceBonus: number;
  priceCut: number;
}

/**
 * Apply a chosen option. `r` is the festival's full-scale ticket revenue and `fairPrice` its
 * fair ticket price. The random state only moves when the option risks a fine.
 */
export function resolveOption(
  option: EventOption,
  r: number,
  fairPrice: number,
  rng: RngState,
  t: Tuning = defaultTuning,
): { effect: OptionEffect; rng: RngState } {
  let fine = 0;
  let fined = false;
  let next = rng;
  if (option.risksFine) {
    const roll = chance(rng, t.economy.noiseFineChance);
    next = roll.state;
    fined = roll.hit;
    fine = fined ? t.economy.noiseFineShare * r : 0;
  }
  return {
    effect: {
      cost: option.costShareR * r,
      customerDelta: option.customers / 100,
      bandDelta: option.bands / 100,
      reputationDelta: option.reputation,
      fine,
      fined,
      prevents: option.prevents ?? [],
      attendanceBonus: option.attendanceBonus ?? 0,
      priceCut: (option.priceCutShareOfFair ?? 0) * fairPrice,
    },
    rng: next,
  };
}

/** Add up the effects of every option chosen so far, for the economy. */
export function combineEffects(effects: readonly OptionEffect[]): EventTotals {
  return effects.reduce<EventTotals>(
    (total, e) => ({
      cost: total.cost + e.cost,
      customerDelta: total.customerDelta + e.customerDelta,
      bandDelta: total.bandDelta + e.bandDelta,
      reputationDelta: total.reputationDelta + e.reputationDelta,
      fine: total.fine + e.fine,
      attendanceBonus: total.attendanceBonus + e.attendanceBonus,
    }),
    { ...noEvents },
  );
}

/** Event ids prevented by the choices made so far. */
export function preventedEvents(effects: readonly OptionEffect[]): Set<string> {
  return new Set(effects.flatMap((e) => e.prevents));
}

/** The food queue triggers only if food capacity served is below 1.2 x attendees. */
export function foodQueueTriggers(foodUnits: number, attendees: number, t: Tuning = defaultTuning): boolean {
  return foodQueueRisk(foodUnits, attendees, t);
}

/** The slow-sales decision appears only if forecast attendance is below 80% of capacity. */
export function slowSalesTriggers(forecastAttendance: number, t: Tuning = defaultTuning): boolean {
  return forecastAttendance < t.decisions.slowSalesThreshold;
}
