import tuningJson from '../data/tuning.json';

export interface Tuning {
  economy: {
    multiDayUplift: number;
    spendPerHead: number;
    merchSharePerHead: number;
    lineupCostCoef: number;
    lineupExponent: number;
    facilitiesCostCoef: number;
    facilityOverbuild: number;
    unitServes: number;
    overheadShare: number;
    emergencyMultiplier: number;
    advanceTopUp: number;
    advanceFee: number;
    advanceFeeThreeStars: number;
    foodQueuePeak: number;
    foodIncomeExponent: number;
    noiseFineShare: number;
    noiseFineChance: number;
  };
  attendance: {
    perceivedBase: number;
    perceivedPerLineup: number;
    priceSensitivity: number;
    priceEffectFloor: number;
    lineupBase: number;
    lineupWeight: number;
    reputationBase: number;
    reputationWeight: number;
  };
  satisfaction: {
    customerQueueWeight: number;
    customerLineupWeight: number;
    customerFairPriceWeight: number;
    customerReputationWeight: number;
    fairPriceSensitivity: number;
    generosityFloor: number;
    generosityRange: number;
    bandBase: number;
    bandGenerosityWeight: number;
    bandFacilitiesWeight: number;
    bandFacilitiesFull: number;
    bandAttendanceWeight: number;
  };
  reputation: { start: number; carry: number };
  /** Per festival number, the merch weight of each slot id. Each festival's weights add up to 1. */
  merchSlotWeights: Record<string, Record<string, number>>;
  negotiation: {
    /** Minimum festival reputation per tier, index 0 = tier 1. */
    tierGate: number[];
    /** Expected slot rank per tier at festival 1 (0 opener, 1 support, 2 headliner), index 0 = tier 1. */
    expectedSlotRankByTier: number[];
    repDivisor: number;
    requiredFeeMin: number;
    requiredFeeMax: number;
    emergingDiscount: number;
    slotBelowPremium: number;
    slotAboveDiscount: number;
    merchStep: number;
    merchBelowPremium: number;
    merchAboveDiscount: number;
    merchMin: number;
    merchMax: number;
    acceptAt: number;
    counterAt: number;
    roundCostBelow: number;
    patience: number;
    moodStart: number;
    moodDropPerBadRound: number;
    hintSpread: number;
    hintSpreadKnown: number;
    verdictCloseAt: number;
  };
  decisions: { slowSalesThreshold: number };
  bandMood: { delighted: number; happy: number; grumbling: number };
}

export const defaultTuning: Tuning = tuningJson;
