import { describe, expect, it } from 'vitest';
import {
  advanceFee,
  attendanceShare,
  bandGenerosity,
  bandMerchPayout,
  bandSatisfaction,
  capacityServed,
  customerSatisfaction,
  emergencyUnitCost,
  evaluateFestival,
  facilitiesInvestment,
  facilityUnitCost,
  fairPriceFactor,
  fairTicketPrice,
  feeGenerosity,
  festivalBudget,
  foodQueueRisk,
  fullScaleRevenue,
  lineupQuality,
  overhead,
  perceivedValue,
  priceEffect,
  queueRatio,
  weightedMerchSplit,
  type BookedBand,
  type FestivalPlan,
} from '../src/core/economy';
import { defaultTuning } from '../src/core/tuning';

const weights = defaultTuning.merchSlotWeights['1']!;

// Spec section 12: asks totalling £6,900, fees paid equal to the required fees,
// merch splits of 20%, 15% and 10%, and 4.69 units each of toilets and food.
const vectorBands: BookedBand[] = [
  { askAtReputation: 4500, feePaid: 4500, requiredFee: 4500, merchPct: 20, slotWeight: weights.headliner! },
  { askAtReputation: 1500, feePaid: 1500, requiredFee: 1500, merchPct: 15, slotWeight: weights.support! },
  { askAtReputation: 900, feePaid: 900, requiredFee: 900, merchPct: 10, slotWeight: weights.opener! },
];

const vectorPlan: FestivalPlan = {
  capacity: 500,
  fairPrice: 25,
  days: 1,
  reputation: 50,
  ticketPrice: 25,
  bands: vectorBands,
  facilityUnits: [4.69, 4.69],
};

/** Within `tolerance` of the spec's rounded figure. */
function about(actual: number, expected: number, tolerance: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe('spec section 12 test vectors (festival 1, no events)', () => {
  const out = evaluateFestival(vectorPlan);

  it('Pt and R', () => {
    expect(out.pt).toBe(25);
    expect(out.r).toBe(12500);
  });

  it('lineup quality is about 0.75 and phi is 0.75', () => {
    about(out.lineup, 0.75, 0.005);
    expect(out.capacityServed).toBeCloseTo(469);
    expect(out.phi).toBeCloseTo(0.75);
  });

  it('perceived value £26.25 and price effect about 1.052', () => {
    about(out.perceivedValue, 26.25, 0.01);
    about(out.priceEffect, 1.052, 0.001);
  });

  it('attendance about 84% (about 420 people)', () => {
    about(out.attendance, 0.84, 0.005);
    about(out.attendees, 420, 1.5);
  });

  it('customer satisfaction about 73% and band satisfaction about 72%', () => {
    about(out.customerSatisfaction, 0.73, 0.005);
    about(out.bandSatisfaction, 0.72, 0.005);
    expect(out.generosity).toBeCloseTo(0.5);
  });

  it('income about £15,260 (tickets £10,520, food, drink and merch £4,740, of which merch £1,790)', () => {
    about(out.income, 15260, 10);
    about(out.ticketIncome, 10520, 10);
    about(out.foodDrinkMerchIncome, 4740, 10);
    about(out.merchIncome, 1790, 5);
  });

  it('band merch payout about £295 (16.5% of merch income)', () => {
    expect(weightedMerchSplit(vectorBands)).toBeCloseTo(0.165);
    about(out.merchPayout, 295, 2);
  });

  it('costs: overhead £4,375, facilities about £2,814, lineup £6,900, spend about £14,385', () => {
    expect(out.overhead).toBe(4375);
    about(out.facilitiesCost, 2814, 1);
    expect(out.lineupCost).toBe(6900);
    about(out.spend, 14385, 5);
  });

  it('profit about £875, about 6.1% of spend', () => {
    about(out.profit, 875, 10);
    about(out.profitPct, 0.061, 0.001);
    expect(out.profitPct).toBeGreaterThanOrEqual(0.05);
  });

  it('the food queue triggers: 469 is below 1.2 x 420 = 504', () => {
    expect(out.foodQueueRisk).toBe(true);
  });

  it('promoter advance at festival 2', () => {
    const r = fullScaleRevenue(1500, fairTicketPrice(30, 1));
    expect(r).toBe(45000);
    const { budget, advance } = festivalBudget(20500, r, true);
    expect(budget).toBeCloseTo(49500);
    expect(advance).toBeCloseTo(29000);
    expect(advanceFee(advance, false)).toBeCloseTo(3480);
    expect(advanceFee(advance, true)).toBeCloseTo(1740);
  });
});

describe('definitions and costs', () => {
  it('multi-day festivals raise Pt by half the fair price per extra day', () => {
    expect(fairTicketPrice(25, 1)).toBe(25);
    expect(fairTicketPrice(25, 3)).toBe(50);
  });

  it('facility unit cost is £300, £240 and £320 at festivals 1 to 3', () => {
    expect(facilityUnitCost(25, 2)).toBeCloseTo(300);
    expect(facilityUnitCost(30, 3)).toBeCloseTo(240);
    expect(facilityUnitCost(40, 3)).toBeCloseTo(320);
  });

  it('emergency units cost 1.5 times the price', () => {
    expect(emergencyUnitCost(300)).toBeCloseTo(450);
  });

  it('overhead is 35% of R', () => {
    expect(overhead(12500)).toBe(4375);
  });

  it('facilities cost can be overridden (for emergency units)', () => {
    const out = evaluateFestival({ ...vectorPlan, facilityUnits: [5, 5], facilitiesCost: 3150 });
    expect(out.facilitiesCost).toBe(3150);
  });
});

describe('budget', () => {
  it('festival 1 budget is cash', () => {
    expect(festivalBudget(20000, 12500, false)).toEqual({ budget: 20000, advance: 0 });
  });

  it('no advance when cash already covers 1.1 x R', () => {
    expect(festivalBudget(60000, 45000, true)).toEqual({ budget: 60000, advance: 0 });
  });
});

describe('lineup quality', () => {
  it('is 0 with no bands', () => {
    expect(lineupQuality(0, 12500)).toBe(0);
  });

  it('a typical lineup of about £6,600 gives about 0.73', () => {
    about(lineupQuality(6600, 12500), 0.73, 0.01);
  });

  it('is capped at 1', () => {
    expect(lineupQuality(20000, 12500)).toBe(1);
  });
});

describe('facilities', () => {
  it('capacity served is 100 x the smallest unit count', () => {
    expect(capacityServed([5, 3])).toBe(300);
    expect(capacityServed([])).toBe(0);
  });

  it('phi is capacity served over 1.25 x capacity', () => {
    expect(facilitiesInvestment(625, 500)).toBeCloseTo(1);
  });

  it('queue ratio is capped at 1 and is 1 with no attendees', () => {
    expect(queueRatio(300, 400)).toBeCloseTo(0.75);
    expect(queueRatio(600, 400)).toBe(1);
    expect(queueRatio(0, 0)).toBe(1);
  });

  it('food queue risk compares food capacity with 1.2 x attendees', () => {
    expect(foodQueueRisk(5, 420)).toBe(true);
    expect(foodQueueRisk(6, 420)).toBe(false);
  });
});

describe('attendance', () => {
  it('price effect falls as the price rises above perceived value, with a floor of 0.3', () => {
    expect(priceEffect(26.25, 26.25)).toBeCloseTo(1);
    expect(priceEffect(31.5, 26.25)).toBeCloseTo(0.78);
    expect(priceEffect(200, 26.25)).toBe(0.3);
  });

  it('perceived value grows with lineup quality', () => {
    expect(perceivedValue(25, 0)).toBeCloseTo(15);
    expect(perceivedValue(25, 1)).toBeCloseTo(30);
  });

  it('attendance is capped at 100%, including the posters bonus', () => {
    expect(attendanceShare(1, 1, 1.5)).toBe(1);
    expect(attendanceShare(0.75, 0.5, 1, 0.03)).toBeCloseTo(0.83);
  });
});

describe('satisfaction', () => {
  it('fair-price factor drops 2 points per point of overpricing', () => {
    expect(fairPriceFactor(25, 26.25)).toBe(1);
    expect(fairPriceFactor(28.875, 26.25)).toBeCloseTo(0.8);
    expect(fairPriceFactor(100, 26.25)).toBe(0);
  });

  it('customer satisfaction has no general event penalty, only chosen events', () => {
    const base = { queueRatio: 1, lineup: 0.75, fairPriceFactor: 1, reputation: 0.5, eventDelta: 0 };
    expect(customerSatisfaction(base)).toBeCloseTo(0.73);
    expect(customerSatisfaction({ ...base, eventDelta: -0.08 })).toBeCloseTo(0.65);
    expect(customerSatisfaction({ ...base, eventDelta: -2 })).toBe(0);
  });

  it('fee generosity is 0.5 at the required fee, 0 at 80% and 1 at 120%', () => {
    expect(bandGenerosity({ feePaid: 100, requiredFee: 100 })).toBeCloseTo(0.5);
    expect(bandGenerosity({ feePaid: 70, requiredFee: 100 })).toBe(0);
    expect(bandGenerosity({ feePaid: 130, requiredFee: 100 })).toBe(1);
  });

  it('fee generosity is fee-weighted across bands', () => {
    const g = feeGenerosity([
      { feePaid: 3000, requiredFee: 2500 }, // 1.0
      { feePaid: 1000, requiredFee: 1000 }, // 0.5
    ]);
    expect(g).toBeCloseTo((3000 * 1 + 1000 * 0.5) / 4000);
    expect(feeGenerosity([])).toBe(0);
  });

  it('band satisfaction caps the facilities term at phi 0.8', () => {
    const base = { generosity: 0.5, phi: 0.8, attendance: 1, eventDelta: 0 };
    expect(bandSatisfaction(base)).toBeCloseTo(0.75);
    expect(bandSatisfaction({ ...base, phi: 2 })).toBeCloseTo(0.75);
    expect(bandSatisfaction({ ...base, eventDelta: -0.05 })).toBeCloseTo(0.7);
  });
});

describe('income and profit', () => {
  it('band merch payout is merch income x the slot-weighted split', () => {
    expect(bandMerchPayout(1000, [{ slotWeight: 0.5, merchPct: 20 }])).toBeCloseTo(100);
  });

  it('short facilities cut food, drink and merch income by the square root of the queue ratio', () => {
    const full = evaluateFestival({ ...vectorPlan, facilityUnits: [10, 10] });
    const short = evaluateFestival({ ...vectorPlan, facilityUnits: [2, 2] });
    expect(short.foodDrinkMerchIncome / full.foodDrinkMerchIncome).toBeCloseTo(Math.sqrt(200 / full.attendees));
  });

  it('event costs and a fine come off profit', () => {
    const base = evaluateFestival(vectorPlan);
    const out = evaluateFestival({
      ...vectorPlan,
      events: { cost: 375, customerDelta: -0.02, bandDelta: -0.05, reputationDelta: 0, fine: 625, attendanceBonus: 0 },
    });
    expect(out.spend - base.spend).toBeCloseTo(375);
    expect(base.profit - out.profit).toBeCloseTo(1000);
    expect(out.customerSatisfaction).toBeCloseTo(base.customerSatisfaction - 0.02);
    expect(out.bandSatisfaction).toBeCloseTo(base.bandSatisfaction - 0.05);
  });

  it('works with nothing booked', () => {
    const out = evaluateFestival({ ...vectorPlan, bands: [], facilityUnits: [0, 0] });
    expect(out.lineup).toBe(0);
    expect(out.generosity).toBe(0);
    expect(Number.isFinite(out.profitPct)).toBe(true);
  });
});
