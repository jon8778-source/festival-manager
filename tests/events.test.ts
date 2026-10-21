import { describe, expect, it } from 'vitest';
import { evaluateFestival } from '../src/core/economy';
import {
  combineEffects,
  foodQueueTriggers,
  preventedEvents,
  resolveOption,
  slowSalesTriggers,
  type EventOption,
} from '../src/core/events';
import { createRng, nextFloat } from '../src/core/random';

const R = 12500;
const FAIR = 25;
const rng = createRng(1);

// Festival 1 events and preparation decisions from CONTENT.md sections 3 and 3b.
const foodQueue: Record<'A' | 'B' | 'C', EventOption> = {
  A: { key: 'A', costShareR: 0.03, customers: 0, bands: 0, reputation: 0 },
  B: { key: 'B', costShareR: 0.005, customers: -2, bands: 0, reputation: 0 },
  C: { key: 'C', costShareR: 0, customers: -8, bands: 0, reputation: 0 },
};
const bandLate: Record<'A' | 'B' | 'C', EventOption> = {
  A: { key: 'A', costShareR: 0.005, customers: 0, bands: 0, reputation: 0 },
  B: { key: 'B', costShareR: 0, customers: -3, bands: 0, reputation: 0 },
  C: { key: 'C', costShareR: 0, customers: -1, bands: -5, reputation: 0 },
};
const noise: Record<'A' | 'B', EventOption> = {
  A: { key: 'A', costShareR: 0, customers: -3, bands: -5, reputation: 0 },
  B: { key: 'B', costShareR: 0, customers: 0, bands: 0, reputation: 0, risksFine: true },
};
const soundLimiter: Record<'A' | 'B' | 'C', EventOption> = {
  A: { key: 'A', costShareR: 0.006, customers: 0, bands: 0, reputation: 0, prevents: ['noise-complaint'] },
  B: { key: 'B', costShareR: 0, customers: 0, bands: -3, reputation: 0, prevents: ['noise-complaint'] },
  C: { key: 'C', costShareR: 0, customers: 0, bands: 0, reputation: 0 },
};
const slowSales: Record<'A' | 'B' | 'C', EventOption> = {
  A: { key: 'A', costShareR: 0, customers: 0, bands: 0, reputation: 0, priceCutShareOfFair: 0.08 },
  B: { key: 'B', costShareR: 0.012, customers: 0, bands: 0, reputation: 0, attendanceBonus: 0.03 },
  C: { key: 'C', costShareR: 0, customers: 0, bands: 0, reputation: 0 },
};

describe('options A, B and C', () => {
  it('food queue: A costs about £375, B about £60 and customers -2, C customers -8', () => {
    expect(resolveOption(foodQueue.A, R, FAIR, rng).effect).toMatchObject({ cost: 375, customerDelta: 0, bandDelta: 0 });
    expect(resolveOption(foodQueue.B, R, FAIR, rng).effect).toMatchObject({ cost: 62.5, customerDelta: -0.02 });
    expect(resolveOption(foodQueue.C, R, FAIR, rng).effect).toMatchObject({ cost: 0, customerDelta: -0.08 });
  });

  it('band running late: C costs the bands 5 points', () => {
    expect(resolveOption(bandLate.A, R, FAIR, rng).effect.cost).toBeCloseTo(62.5);
    expect(resolveOption(bandLate.C, R, FAIR, rng).effect).toMatchObject({ customerDelta: -0.01, bandDelta: -0.05 });
  });

  it('reputation changes pass through in points', () => {
    const option: EventOption = { key: 'C', costShareR: 0, customers: -10, bands: 0, reputation: -5 };
    expect(resolveOption(option, R, FAIR, rng).effect.reputationDelta).toBe(-5);
  });

  it('a negative cost is a net gain', () => {
    const merchRush: EventOption = { key: 'A', costShareR: -0.001, customers: 0, bands: 0, reputation: 0 };
    expect(resolveOption(merchRush, 45000, 30, rng).effect.cost).toBeCloseTo(-45);
  });

  it('options without a fine leave the random state alone', () => {
    expect(resolveOption(foodQueue.C, R, FAIR, rng).rng).toBe(rng);
  });
});

describe('noise complaint and fine', () => {
  it('turning it down costs customers 3 and bands 5, with no fine', () => {
    const { effect, rng: next } = resolveOption(noise.A, R, FAIR, rng);
    expect(effect).toMatchObject({ customerDelta: -0.03, bandDelta: -0.05, fine: 0, fined: false });
    expect(next).toBe(rng);
  });

  it('ignoring it fines 5% of R (£625) when the 25% roll hits', () => {
    // Find seeds whose first roll lands either side of 0.25.
    let hitSeed = -1;
    let missSeed = -1;
    for (let seed = 0; seed < 100 && (hitSeed < 0 || missSeed < 0); seed++) {
      const roll = nextFloat(createRng(seed)).value;
      if (roll < 0.25 && hitSeed < 0) hitSeed = seed;
      if (roll >= 0.25 && missSeed < 0) missSeed = seed;
    }
    const hit = resolveOption(noise.B, R, FAIR, createRng(hitSeed));
    expect(hit.effect).toMatchObject({ fine: 625, fined: true, customerDelta: 0, bandDelta: 0 });
    expect(hit.rng).not.toBe(createRng(hitSeed));
    const miss = resolveOption(noise.B, R, FAIR, createRng(missSeed));
    expect(miss.effect).toMatchObject({ fine: 0, fined: false });
  });

  it('is fined about a quarter of the time', () => {
    let state = createRng(42);
    let fines = 0;
    const runs = 4000;
    for (let i = 0; i < runs; i++) {
      const result = resolveOption(noise.B, R, FAIR, state);
      state = result.rng;
      if (result.effect.fined) fines++;
    }
    expect(fines / runs).toBeGreaterThan(0.22);
    expect(fines / runs).toBeLessThan(0.28);
  });

  it('is deterministic for the same seed', () => {
    const a = resolveOption(noise.B, R, FAIR, createRng(7));
    const b = resolveOption(noise.B, R, FAIR, createRng(7));
    expect(a).toEqual(b);
  });
});

describe('preparation decisions', () => {
  it('the sound limiter (A) costs about £75 and prevents the noise complaint', () => {
    const { effect } = resolveOption(soundLimiter.A, R, FAIR, rng);
    expect(effect.cost).toBeCloseTo(75);
    expect(preventedEvents([effect]).has('noise-complaint')).toBe(true);
  });

  it('finishing at 10:30 (B) costs the bands 3 and prevents the complaint; declining (C) prevents nothing', () => {
    const early = resolveOption(soundLimiter.B, R, FAIR, rng).effect;
    expect(early.bandDelta).toBeCloseTo(-0.03);
    expect(preventedEvents([early]).has('noise-complaint')).toBe(true);
    expect(preventedEvents([resolveOption(soundLimiter.C, R, FAIR, rng).effect]).size).toBe(0);
  });

  it('slow sales: A cuts the price by 8% of the fair price (£2), B costs about £150 and adds 3 points of attendance', () => {
    expect(resolveOption(slowSales.A, R, FAIR, rng).effect.priceCut).toBeCloseTo(2);
    const posters = resolveOption(slowSales.B, R, FAIR, rng).effect;
    expect(posters.cost).toBeCloseTo(150);
    expect(posters.attendanceBonus).toBeCloseTo(0.03);
  });

  it('the slow-sales decision appears only below 80% forecast attendance', () => {
    expect(slowSalesTriggers(0.79)).toBe(true);
    expect(slowSalesTriggers(0.8)).toBe(false);
  });
});

describe('food queue trigger', () => {
  it('triggers only if food capacity is below 1.2 x attendees', () => {
    expect(foodQueueTriggers(4.69, 420)).toBe(true);
    expect(foodQueueTriggers(5, 420)).toBe(true);
    expect(foodQueueTriggers(6, 420)).toBe(false);
  });
});

describe('combining effects for the economy', () => {
  it('adds up every chosen option', () => {
    const effects = [
      resolveOption(soundLimiter.A, R, FAIR, rng).effect,
      resolveOption(slowSales.B, R, FAIR, rng).effect,
      resolveOption(foodQueue.B, R, FAIR, rng).effect,
      resolveOption(bandLate.C, R, FAIR, rng).effect,
    ];
    const totals = combineEffects(effects);
    expect(totals.cost).toBeCloseTo(75 + 150 + 62.5);
    expect(totals.customerDelta).toBeCloseTo(-0.03);
    expect(totals.bandDelta).toBeCloseTo(-0.05);
    expect(totals.attendanceBonus).toBeCloseTo(0.03);
    expect(totals.fine).toBe(0);
  });

  it('feeds through evaluateFestival', () => {
    const plan = {
      capacity: 500,
      fairPrice: 25,
      days: 1,
      reputation: 50,
      ticketPrice: 25,
      bands: [{ askAtReputation: 6900, feePaid: 6900, requiredFee: 6900, merchPct: 20, slotWeight: 0.5 }],
      facilityUnits: [5, 5],
    };
    const before = evaluateFestival(plan);
    const after = evaluateFestival({ ...plan, events: combineEffects([resolveOption(foodQueue.C, R, FAIR, rng).effect]) });
    expect(after.customerSatisfaction).toBeCloseTo(before.customerSatisfaction - 0.08);
  });
});
