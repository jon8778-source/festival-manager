import { describe, expect, it } from 'vitest';
import { defaultTuning as t } from '../src/core/tuning';

describe('tuning defaults (spec section 4)', () => {
  it('match the spec table', () => {
    expect(t.economy.multiDayUplift).toBe(0.5);
    expect(t.economy.spendPerHead).toBe(0.45);
    expect(t.economy.lineupCostCoef).toBe(0.85);
    expect(t.economy.facilitiesCostCoef).toBe(0.3);
    expect(t.economy.overheadShare).toBe(0.35);
    expect(t.economy.advanceTopUp).toBe(1.1);
    expect(t.economy.advanceFee).toBe(0.12);
    expect(t.economy.advanceFeeThreeStars).toBe(0.06);
    expect(t.reputation.carry).toBe(0.7);
    expect(t.economy.merchSharePerHead).toBe(0.17);
    expect(t.economy.foodQueuePeak).toBe(1.2);
    expect(t.economy.noiseFineShare).toBe(0.05);
    expect(t.economy.noiseFineChance).toBe(0.25);
    expect(t.reputation.start).toBe(50);
  });

  it('match the negotiation rules (spec section 5)', () => {
    expect(t.negotiation.tierGate).toEqual([0, 15, 30, 50, 75]);
    expect(t.negotiation.patience).toBe(3);
    expect(t.negotiation.hintSpread).toBe(0.15);
    expect(t.negotiation.hintSpreadKnown).toBe(0.08);
    expect(t.negotiation.merchMax).toBe(30);
  });

  it('merch slot weights add up to 1 for each festival', () => {
    for (const weights of Object.values(t.merchSlotWeights)) {
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1);
    }
  });
});
