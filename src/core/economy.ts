// Economy formulas from spec section 4. Satisfactions, attendance and reputation inside the
// formulas run from 0 to 1, except where a parameter says it is in points (0 to 100).

import { clamp, sum } from './math';
import { defaultTuning, type Tuning } from './tuning';

/** Ticket price for the festival at fair value (Pt). */
export function fairTicketPrice(fairPrice: number, days: number, t: Tuning = defaultTuning): number {
  return fairPrice * (1 + t.economy.multiDayUplift * (days - 1));
}

/** Full-scale ticket revenue (R). */
export function fullScaleRevenue(capacity: number, pt: number): number {
  return capacity * pt;
}

/** Cost of one facility unit at the normal price. */
export function facilityUnitCost(pt: number, facilityTypeCount: number, t: Tuning = defaultTuning): number {
  const e = t.economy;
  return ((e.facilitiesCostCoef * pt) / e.facilityOverbuild) * e.unitServes / facilityTypeCount;
}

export function emergencyUnitCost(unitCost: number, t: Tuning = defaultTuning): number {
  return unitCost * t.economy.emergencyMultiplier;
}

export function overhead(r: number, t: Tuning = defaultTuning): number {
  return t.economy.overheadShare * r;
}

/** Lineup quality L from the sum of the booked bands' asks at festival reputation. */
export function lineupQuality(asksAtReputation: number, r: number, t: Tuning = defaultTuning): number {
  if (asksAtReputation <= 0) return 0;
  const e = t.economy;
  return Math.min(1, Math.pow(asksAtReputation / (e.lineupCostCoef * r), e.lineupExponent));
}

/** People served: 100 x the smallest number of units across the facility types in play. */
export function capacityServed(unitsPerType: readonly number[], t: Tuning = defaultTuning): number {
  if (unitsPerType.length === 0) return 0;
  return t.economy.unitServes * Math.min(...unitsPerType);
}

/** Facilities investment phi. */
export function facilitiesInvestment(served: number, capacity: number, t: Tuning = defaultTuning): number {
  return served / (t.economy.facilityOverbuild * capacity);
}

export function queueRatio(served: number, attendees: number): number {
  if (attendees <= 0) return 1;
  return Math.min(1, served / attendees);
}

export function perceivedValue(pt: number, lineup: number, t: Tuning = defaultTuning): number {
  const a = t.attendance;
  return pt * (a.perceivedBase + a.perceivedPerLineup * lineup);
}

export function priceEffect(price: number, perceived: number, t: Tuning = defaultTuning): number {
  const a = t.attendance;
  return Math.max(a.priceEffectFloor, 1 - a.priceSensitivity * (price / perceived - 1));
}

/**
 * Attendance as a share of capacity. `reputation` is 0 to 1. `bonus` is a flat addition
 * (for example posters from the slow-sales decision), applied before the cap at 100%.
 */
export function attendanceShare(
  lineup: number,
  reputation: number,
  effect: number,
  bonus = 0,
  t: Tuning = defaultTuning,
): number {
  const a = t.attendance;
  const base = (a.lineupBase + a.lineupWeight * lineup) * (a.reputationBase + a.reputationWeight * reputation) * effect;
  return clamp(base + bonus, 0, 1);
}

function servedFactor(served: number, attendees: number, t: Tuning): number {
  return Math.pow(queueRatio(served, attendees), t.economy.foodIncomeExponent);
}

/** Food, drink and merch income (merch included). */
export function foodDrinkMerchIncome(attendees: number, pt: number, served: number, t: Tuning = defaultTuning): number {
  return attendees * t.economy.spendPerHead * pt * servedFactor(served, attendees, t);
}

/** The merch part of the food, drink and merch income. */
export function merchIncome(attendees: number, pt: number, served: number, t: Tuning = defaultTuning): number {
  return attendees * t.economy.merchSharePerHead * pt * servedFactor(served, attendees, t);
}

export interface MerchShare {
  /** Slot weight from tuning.merchSlotWeights. */
  slotWeight: number;
  /** Agreed merch split in points (0 to 30). */
  merchPct: number;
}

/** Weighted merch split across booked bands, as a share (0.165 for 16.5%). */
export function weightedMerchSplit(shares: readonly MerchShare[]): number {
  return sum(shares.map((s) => s.slotWeight * (s.merchPct / 100)));
}

export function bandMerchPayout(merch: number, shares: readonly MerchShare[]): number {
  return merch * weightedMerchSplit(shares);
}

export function fairPriceFactor(price: number, perceived: number, t: Tuning = defaultTuning): number {
  return clamp(1 - t.satisfaction.fairPriceSensitivity * Math.max(0, price / perceived - 1), 0, 1);
}

export interface CustomerInputs {
  queueRatio: number;
  lineup: number;
  fairPriceFactor: number;
  /** 0 to 1. */
  reputation: number;
  /** Sum of the event changes, 0 to 1 scale (-0.05 for -5 points). */
  eventDelta: number;
}

export function customerSatisfaction(i: CustomerInputs, t: Tuning = defaultTuning): number {
  const s = t.satisfaction;
  return clamp(
    s.customerQueueWeight * i.queueRatio +
      s.customerLineupWeight * i.lineup +
      s.customerFairPriceWeight * i.fairPriceFactor +
      s.customerReputationWeight * i.reputation +
      i.eventDelta,
    0,
    1,
  );
}

export interface FeePaid {
  feePaid: number;
  /** Required fee after bill position and merch adjustments (negotiation.adjustedRequiredFee). */
  requiredFee: number;
}

/** Fee generosity for one band. */
export function bandGenerosity(fee: FeePaid, t: Tuning = defaultTuning): number {
  const s = t.satisfaction;
  return clamp((fee.feePaid / fee.requiredFee - s.generosityFloor) / s.generosityRange, 0, 1);
}

/** Fee-weighted average generosity across booked bands (0 with no bands). */
export function feeGenerosity(fees: readonly FeePaid[], t: Tuning = defaultTuning): number {
  const totalPaid = sum(fees.map((f) => f.feePaid));
  if (totalPaid <= 0) return 0;
  return sum(fees.map((f) => f.feePaid * bandGenerosity(f, t))) / totalPaid;
}

export interface BandInputs {
  generosity: number;
  phi: number;
  attendance: number;
  /** Sum of the event changes, 0 to 1 scale. */
  eventDelta: number;
}

export function bandSatisfaction(i: BandInputs, t: Tuning = defaultTuning): number {
  const s = t.satisfaction;
  return clamp(
    s.bandBase +
      s.bandGenerosityWeight * i.generosity +
      s.bandFacilitiesWeight * Math.min(1, i.phi / s.bandFacilitiesFull) +
      s.bandAttendanceWeight * i.attendance +
      i.eventDelta,
    0,
    1,
  );
}

export interface Budget {
  budget: number;
  advance: number;
}

/** Festival 1 uses cash as the budget; from festival 2 the promoter tops cash up to 1.1 x R. */
export function festivalBudget(cash: number, r: number, promoterAdvance: boolean, t: Tuning = defaultTuning): Budget {
  const target = t.economy.advanceTopUp * r;
  if (!promoterAdvance || cash >= target) return { budget: cash, advance: 0 };
  return { budget: target, advance: target - cash };
}

export function advanceFee(advance: number, threeStars: boolean, t: Tuning = defaultTuning): number {
  return advance * (threeStars ? t.economy.advanceFeeThreeStars : t.economy.advanceFee);
}

/** Food capacity needed for the lunchtime peak; below this the food queue event triggers. */
export function foodQueuePeakDemand(attendees: number, t: Tuning = defaultTuning): number {
  return t.economy.foodQueuePeak * attendees;
}

export function foodQueueRisk(foodUnits: number, attendees: number, t: Tuning = defaultTuning): boolean {
  return foodUnits * t.economy.unitServes < foodQueuePeakDemand(attendees, t);
}

/** One booked band, as the economy needs it. */
export interface BookedBand extends FeePaid, MerchShare {
  /** The band's ask at festival reputation (negotiation.requiredFee), used for lineup quality. */
  askAtReputation: number;
}

/** Totals of the event options chosen (see events.combineEffects). */
export interface EventTotals {
  cost: number;
  /** 0 to 1 scale. */
  customerDelta: number;
  /** 0 to 1 scale. */
  bandDelta: number;
  /** Points. */
  reputationDelta: number;
  fine: number;
  attendanceBonus: number;
}

export const noEvents: EventTotals = {
  cost: 0,
  customerDelta: 0,
  bandDelta: 0,
  reputationDelta: 0,
  fine: 0,
  attendanceBonus: 0,
};

export interface FestivalPlan {
  capacity: number;
  fairPrice: number;
  days: number;
  /** Festival reputation in points (0 to 100). */
  reputation: number;
  ticketPrice: number;
  bands: readonly BookedBand[];
  /** Units of each facility type in play (one entry per type). */
  facilityUnits: readonly number[];
  /** Units of food, for the food queue check. Defaults to the smallest facility count. */
  foodUnits?: number;
  /** What was paid for facilities. Defaults to all units at the normal price. */
  facilitiesCost?: number;
  events?: EventTotals;
}

export interface FestivalOutcome {
  pt: number;
  r: number;
  lineup: number;
  perceivedValue: number;
  priceEffect: number;
  attendance: number;
  attendees: number;
  capacityServed: number;
  phi: number;
  queueRatio: number;
  fairPriceFactor: number;
  foodQueueRisk: boolean;
  ticketIncome: number;
  foodDrinkMerchIncome: number;
  merchIncome: number;
  income: number;
  lineupCost: number;
  facilitiesCost: number;
  overhead: number;
  eventCosts: number;
  merchPayout: number;
  spend: number;
  fine: number;
  profit: number;
  /** Profit as a share of spend. */
  profitPct: number;
  generosity: number;
  customerSatisfaction: number;
  bandSatisfaction: number;
}

/** The full festival calculation, used for the live forecast and the final result. */
export function evaluateFestival(plan: FestivalPlan, t: Tuning = defaultTuning): FestivalOutcome {
  const events = plan.events ?? noEvents;
  const pt = fairTicketPrice(plan.fairPrice, plan.days, t);
  const r = fullScaleRevenue(plan.capacity, pt);
  const lineup = lineupQuality(sum(plan.bands.map((b) => b.askAtReputation)), r, t);
  const served = capacityServed(plan.facilityUnits, t);
  const phi = facilitiesInvestment(served, plan.capacity, t);
  const perceived = perceivedValue(pt, lineup, t);
  const effect = priceEffect(plan.ticketPrice, perceived, t);
  const reputation = plan.reputation / 100;
  const attendance = attendanceShare(lineup, reputation, effect, events.attendanceBonus, t);
  const attendees = attendance * plan.capacity;
  const queue = queueRatio(served, attendees);
  const fairness = fairPriceFactor(plan.ticketPrice, perceived, t);

  const ticketIncome = attendees * plan.ticketPrice;
  const fdm = foodDrinkMerchIncome(attendees, pt, served, t);
  const merch = merchIncome(attendees, pt, served, t);
  const income = ticketIncome + fdm;

  const lineupCost = sum(plan.bands.map((b) => b.feePaid));
  const unitCost = facilityUnitCost(pt, plan.facilityUnits.length || 1, t);
  const facilitiesCost = plan.facilitiesCost ?? sum(plan.facilityUnits) * unitCost;
  const fixed = overhead(r, t);
  const payout = bandMerchPayout(merch, plan.bands);
  const spend = lineupCost + facilitiesCost + fixed + events.cost + payout;
  const profit = income - spend - events.fine;

  const generosity = feeGenerosity(plan.bands, t);
  const foodUnits = plan.foodUnits ?? (plan.facilityUnits.length ? Math.min(...plan.facilityUnits) : 0);

  return {
    pt,
    r,
    lineup,
    perceivedValue: perceived,
    priceEffect: effect,
    attendance,
    attendees,
    capacityServed: served,
    phi,
    queueRatio: queue,
    fairPriceFactor: fairness,
    foodQueueRisk: foodQueueRisk(foodUnits, attendees, t),
    ticketIncome,
    foodDrinkMerchIncome: fdm,
    merchIncome: merch,
    income,
    lineupCost,
    facilitiesCost,
    overhead: fixed,
    eventCosts: events.cost,
    merchPayout: payout,
    spend,
    fine: events.fine,
    profit,
    profitPct: spend > 0 ? profit / spend : 0,
    generosity,
    customerSatisfaction: customerSatisfaction(
      { queueRatio: queue, lineup, fairPriceFactor: fairness, reputation, eventDelta: events.customerDelta },
      t,
    ),
    bandSatisfaction: bandSatisfaction({ generosity, phi, attendance, eventDelta: events.bandDelta }, t),
  };
}
