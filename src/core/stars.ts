// Stars, pass or fail, reputation and band mood (spec sections 4 and 8).

import { clamp } from './math';
import { defaultTuning, type Tuning } from './tuning';

export type StarArea = 'profit' | 'customers' | 'bands';

export interface Targets {
  /** Profit as a share of spend (0.05 for 5%). */
  profit: number;
  /** 0 to 1. */
  customers: number;
  /** 0 to 1. */
  bands: number;
}

export interface StarInputs {
  profitPct: number;
  customerSatisfaction: number;
  bandSatisfaction: number;
}

export interface Stars {
  profit: boolean;
  customers: boolean;
  bands: boolean;
  count: number;
}

export function computeStars(result: StarInputs, targets: Targets): Stars {
  const profit = result.profitPct >= targets.profit;
  const customers = result.customerSatisfaction >= targets.customers;
  const bands = result.bandSatisfaction >= targets.bands;
  return { profit, customers, bands, count: Number(profit) + Number(customers) + Number(bands) };
}

/** Two or more stars passes, unless cash is below zero after repaying any advance. */
export function festivalPassed(stars: Stars, cashAfter: number): boolean {
  return stars.count >= 2 && cashAfter >= 0;
}

/** How far each area is above (positive) or below (negative) its target. */
export function areaMargins(result: StarInputs, targets: Targets): Record<StarArea, number> {
  return {
    profit: result.profitPct - targets.profit,
    customers: result.customerSatisfaction - targets.customers,
    bands: result.bandSatisfaction - targets.bands,
  };
}

const AREAS: readonly StarArea[] = ['profit', 'customers', 'bands'];

/** The area furthest below its target (or least above it). Ties go to the earlier area in profit, customers, bands. */
export function weakestArea(result: StarInputs, targets: Targets): StarArea {
  const m = areaMargins(result, targets);
  return AREAS.reduce((worst, area) => (m[area] < m[worst] ? area : worst));
}

/** The area furthest above its target. */
export function bestArea(result: StarInputs, targets: Targets): StarArea {
  const m = areaMargins(result, targets);
  return AREAS.reduce((best, area) => (m[area] > m[best] ? area : best));
}

/**
 * Festival reputation after a festival, in points (0 to 100). Satisfactions are 0 to 1;
 * the event reputation change is in points.
 */
export function nextReputation(
  reputation: number,
  customerSatisfaction: number,
  bandSatisfaction: number,
  eventReputationDelta: number,
  t: Tuning = defaultTuning,
): number {
  const carry = t.reputation.carry;
  const average = (customerSatisfaction + bandSatisfaction) / 2;
  return clamp(carry * reputation + (1 - carry) * average * 100 + eventReputationDelta, 0, 100);
}

export type BandMood = 'delighted' | 'happy' | 'grumbling' | 'furious';

/** Band mood label from band satisfaction (0 to 1). */
export function bandMoodLabel(bandSatisfaction: number, t: Tuning = defaultTuning): BandMood {
  const points = bandSatisfaction * 100;
  if (points >= t.bandMood.delighted) return 'delighted';
  if (points >= t.bandMood.happy) return 'happy';
  if (points >= t.bandMood.grumbling) return 'grumbling';
  return 'furious';
}
