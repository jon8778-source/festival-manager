import { describe, expect, it } from 'vitest';
import {
  areaMargins,
  bandMoodLabel,
  bestArea,
  computeStars,
  festivalPassed,
  nextReputation,
  weakestArea,
} from '../src/core/stars';

// Festival 1 targets from CONTENT.md: customers 65%, bands 60%, profit 5%.
const targets = { profit: 0.05, customers: 0.65, bands: 0.6 };
// The spec section 12 result.
const vector = { profitPct: 0.061, customerSatisfaction: 0.73, bandSatisfaction: 0.72 };

describe('stars', () => {
  it('the section 12 plan earns all three stars at festival 1', () => {
    expect(computeStars(vector, targets)).toEqual({ profit: true, customers: true, bands: true, count: 3 });
  });

  it('a star needs the value to reach its target', () => {
    const stars = computeStars({ profitPct: 0.05, customerSatisfaction: 0.649, bandSatisfaction: 0.6 }, targets);
    expect(stars).toEqual({ profit: true, customers: false, bands: true, count: 2 });
  });

  it('two or more stars passes', () => {
    expect(festivalPassed(computeStars(vector, targets), 1000)).toBe(true);
    const one = computeStars({ profitPct: -0.1, customerSatisfaction: 0.5, bandSatisfaction: 0.7 }, targets);
    expect(one.count).toBe(1);
    expect(festivalPassed(one, 1000)).toBe(false);
  });

  it('cash below zero is a soft fail even with three stars', () => {
    expect(festivalPassed(computeStars(vector, targets), -1)).toBe(false);
    expect(festivalPassed(computeStars(vector, targets), 0)).toBe(true);
  });
});

describe('best and weakest areas', () => {
  it('compare each area with its target', () => {
    const margins = areaMargins(vector, targets);
    expect(margins.profit).toBeCloseTo(0.011);
    expect(margins.customers).toBeCloseTo(0.08);
    expect(margins.bands).toBeCloseTo(0.12);
    expect(bestArea(vector, targets)).toBe('bands');
    expect(weakestArea(vector, targets)).toBe('profit');
  });

  it('finds the weakest star after a failed festival', () => {
    const failed = { profitPct: 0.02, customerSatisfaction: 0.5, bandSatisfaction: 0.62 };
    expect(weakestArea(failed, targets)).toBe('customers');
  });
});

describe('reputation', () => {
  it('is 0.7 x reputation + 0.3 x average satisfaction + event changes', () => {
    expect(nextReputation(50, 0.73, 0.72, 0)).toBeCloseTo(0.7 * 50 + 0.3 * 72.5);
    expect(nextReputation(50, 0.73, 0.72, -5)).toBeCloseTo(0.7 * 50 + 0.3 * 72.5 - 5);
  });

  it('stays between 0 and 100', () => {
    expect(nextReputation(0, 0, 0, -10)).toBe(0);
    expect(nextReputation(100, 1, 1, 10)).toBe(100);
  });
});

describe('band mood labels', () => {
  it('Delighted at 75+, Happy 60 to 74, Grumbling 45 to 59, Furious under 45', () => {
    expect(bandMoodLabel(0.75)).toBe('delighted');
    expect(bandMoodLabel(0.74)).toBe('happy');
    expect(bandMoodLabel(0.6)).toBe('happy');
    expect(bandMoodLabel(0.59)).toBe('grumbling');
    expect(bandMoodLabel(0.45)).toBe('grumbling');
    expect(bandMoodLabel(0.44)).toBe('furious');
  });
});
