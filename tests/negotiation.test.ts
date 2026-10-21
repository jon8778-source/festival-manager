import { describe, expect, it } from 'vitest';
import {
  acceptCounter,
  adjustedRequiredFee,
  baseRequiredFee,
  buildCounter,
  expectedSlot,
  gateOpen,
  marketRateHint,
  merchMultiplier,
  newTalks,
  requiredFee,
  respond,
  scoreOffer,
  slotMultiplier,
  termVerdicts,
  walkAway,
  type BandProfile,
  type Talks,
} from '../src/core/negotiation';

// Bands from CONTENT.md section 1.
const mudPies: BandProfile = { tier: 1, reputation: 18, feeAsk: 450, merchAsk: 10, emerging: true };
const dustAndDiesel: BandProfile = { tier: 3, reputation: 50, feeAsk: 4500, merchAsk: 20, emerging: false };
const royalMile: BandProfile = { tier: 4, reputation: 70, feeAsk: 12000, merchAsk: 25, emerging: false };
const hedgerows: BandProfile = { tier: 1, reputation: 15, feeAsk: 300, merchAsk: 10, emerging: false };
const corduroyKings: BandProfile = { tier: 2, reputation: 35, feeAsk: 1800, merchAsk: 15, emerging: false };
const lastHeatwave: BandProfile = { tier: 5, reputation: 88, feeAsk: 30000, merchAsk: 30, emerging: false };

describe('spec section 5 test vectors', () => {
  it('The Mud Pies at festival reputation 50: required fee £378, and £380 for the opener at 10% merch is accepted', () => {
    expect(requiredFee(mudPies.feeAsk, mudPies.reputation, 50)).toBeCloseTo(378);
    const response = respond(mudPies, 50, { fee: 380, slot: 'opener', merchPct: 10 }, newTalks());
    expect(response.kind).toBe('accept');
    expect(response.talks.status).toBe('signed');
  });

  it('Dust & Diesel: £3,900 for the headline slot at 20% merch scores about 0.87 and counters at £4,500', () => {
    const offer = { fee: 3900, slot: 'headliner' as const, merchPct: 20 };
    expect(scoreOffer(dustAndDiesel, 50, offer)).toBeCloseTo(0.867, 3);
    const response = respond(dustAndDiesel, 50, offer, newTalks());
    expect(response.kind).toBe('counter');
    if (response.kind !== 'counter') return;
    expect(response.counter.term).toBe('fee');
    expect(response.counter.offer).toEqual({ fee: 4500, slot: 'headliner', merchPct: 20 });
  });

  it('The Royal Mile (tier 4) at festival reputation 45 is refused', () => {
    expect(gateOpen(royalMile.tier, 45)).toBe(false);
    const talks = newTalks();
    const response = respond(royalMile, 45, { fee: 20000, slot: 'headliner', merchPct: 30 }, talks);
    expect(response).toEqual({ kind: 'refused', talks });
  });
});

describe('gate', () => {
  it('uses the tier minimums 0, 15, 30, 50 and 75', () => {
    expect(gateOpen(1, 0)).toBe(true);
    expect(gateOpen(2, 14)).toBe(false);
    expect(gateOpen(2, 15)).toBe(true);
    expect(gateOpen(3, 30)).toBe(true);
    expect(gateOpen(4, 50)).toBe(true);
    expect(gateOpen(5, 74)).toBe(false);
    expect(gateOpen(5, 75)).toBe(true);
  });
});

describe('required fee', () => {
  it('moves by half a percent per point of reputation difference', () => {
    expect(requiredFee(1000, 60, 50)).toBeCloseTo(1050);
    expect(requiredFee(1000, 40, 50)).toBeCloseTo(950);
  });

  it('is clamped to 0.8 to 1.4 times the ask', () => {
    expect(requiredFee(1000, 0, 100)).toBeCloseTo(800);
    expect(requiredFee(1000, 100, 0)).toBeCloseTo(1400);
    expect(requiredFee(lastHeatwave.feeAsk, lastHeatwave.reputation, 0)).toBeCloseTo(42000);
  });

  it('emerging bands get a 10% discount', () => {
    expect(baseRequiredFee(mudPies, 50)).toBeCloseTo(378 * 0.9);
    expect(baseRequiredFee(hedgerows, 50)).toBeCloseTo(requiredFee(300, 15, 50));
  });
});

describe('expected slot', () => {
  it('tier 1 expects opener, tier 2 support, tier 3 and above headliner', () => {
    expect(expectedSlot(hedgerows)).toBe('opener');
    expect(expectedSlot(corduroyKings)).toBe('support');
    expect(expectedSlot(dustAndDiesel)).toBe('headliner');
    expect(expectedSlot(royalMile)).toBe('headliner');
  });

  it('emerging bands want one slot higher, up to headliner', () => {
    expect(expectedSlot(mudPies)).toBe('support');
    expect(expectedSlot({ ...corduroyKings, emerging: true })).toBe('headliner');
    expect(expectedSlot({ ...dustAndDiesel, emerging: true })).toBe('headliner');
  });
});

describe('bill position and merch adjustments', () => {
  it('each slot below expected needs 10% more; each slot above allows 5% less', () => {
    expect(slotMultiplier('headliner', 'headliner')).toBe(1);
    expect(slotMultiplier('support', 'headliner')).toBeCloseTo(1.1);
    expect(slotMultiplier('opener', 'headliner')).toBeCloseTo(1.2);
    expect(slotMultiplier('support', 'opener')).toBeCloseTo(0.95);
    expect(slotMultiplier('headliner', 'opener')).toBeCloseTo(0.9);
  });

  it('each 5 points of merch below the ask needs 4% more; each 5 points above allows 2% less', () => {
    expect(merchMultiplier(20, 20)).toBe(1);
    expect(merchMultiplier(15, 20)).toBeCloseTo(1.04);
    expect(merchMultiplier(10, 20)).toBeCloseTo(1.08);
    expect(merchMultiplier(25, 20)).toBeCloseTo(0.98);
    expect(merchMultiplier(30, 20)).toBeCloseTo(0.96);
  });

  it('the adjustments multiply the required fee', () => {
    const fee = adjustedRequiredFee(dustAndDiesel, 50, { fee: 0, slot: 'support', merchPct: 15 });
    expect(fee).toBeCloseTo(4500 * 1.1 * 1.04);
  });
});

describe('responses', () => {
  const offer = (fee: number) => ({ fee, slot: 'headliner' as const, merchPct: 20 });

  it('accepts at a score of 1.0 or more', () => {
    expect(respond(dustAndDiesel, 50, offer(4500), newTalks()).kind).toBe('accept');
    expect(respond(dustAndDiesel, 50, offer(5000), newTalks()).kind).toBe('accept');
  });

  it('counters from 0.8 to just under 1.0', () => {
    expect(respond(dustAndDiesel, 50, offer(3600), newTalks()).kind).toBe('counter');
    expect(respond(dustAndDiesel, 50, offer(4499), newTalks()).kind).toBe('counter');
  });

  it('rejects below 0.8', () => {
    expect(respond(dustAndDiesel, 50, offer(3599), newTalks()).kind).toBe('reject');
  });

  it('cannot respond once talks are signed or closed', () => {
    expect(() => respond(dustAndDiesel, 50, offer(4500), walkAway(newTalks()))).toThrow();
    expect(() => respond(dustAndDiesel, 50, offer(4500), acceptCounter(newTalks()))).toThrow();
  });
});

describe('patience and mood', () => {
  const offer = (fee: number) => ({ fee, slot: 'headliner' as const, merchPct: 20 });

  it('an offer scoring 0.9 or more costs nothing', () => {
    const response = respond(dustAndDiesel, 50, offer(4100), newTalks());
    expect(response.kind).toBe('counter');
    expect(response.talks).toEqual(newTalks());
  });

  it('an offer scoring below 0.9 costs a round and lowers mood, including a rejection', () => {
    const counter = respond(dustAndDiesel, 50, offer(3900), newTalks());
    expect(counter.talks).toEqual({ status: 'open', patience: 2, mood: 55 });
    const reject = respond(dustAndDiesel, 50, offer(1000), newTalks());
    expect(reject.kind).toBe('reject');
    expect(reject.talks).toEqual({ status: 'open', patience: 2, mood: 55 });
  });

  it('talks close when patience runs out, and only for that band', () => {
    let talks: Talks = newTalks();
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const response = respond(dustAndDiesel, 50, offer(1000), talks);
      kinds.push(response.kind);
      talks = response.talks;
    }
    expect(kinds).toEqual(['reject', 'reject', 'walkedAway']);
    expect(talks).toEqual({ status: 'closed', patience: 0, mood: 25 });
    expect(respond(corduroyKings, 50, { fee: 2000, slot: 'support', merchPct: 15 }, newTalks()).kind).toBe('accept');
  });

  it('accepting a counter or walking away ends talks', () => {
    expect(acceptCounter(newTalks()).status).toBe('signed');
    expect(walkAway(newTalks()).status).toBe('closed');
  });
});

describe('counter-offers', () => {
  it('moves the slot when the slot has the biggest gap', () => {
    // Fee covers the headline ask, but the slot is two below expected (needs 20% more).
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4500, slot: 'opener', merchPct: 20 });
    expect(counter.term).toBe('slot');
    expect(counter.offer).toEqual({ fee: 4500, slot: 'headliner', merchPct: 20 });
    expect(scoreOffer(dustAndDiesel, 50, counter.offer)).toBeGreaterThanOrEqual(1);
  });

  it('moves the slot only as far as needed', () => {
    // At support (x1.1) a fee of £4,950 is enough, so the band stops at support.
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4950, slot: 'opener', merchPct: 20 });
    expect(counter.offer.slot).toBe('support');
    expect(counter.offer.fee).toBe(4950);
  });

  it('makes up the rest on the fee when the slot it wants is taken', () => {
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4500, slot: 'opener', merchPct: 20 }, ['opener', 'support']);
    expect(counter.term).toBe('slot');
    expect(counter.offer.slot).toBe('support');
    expect(counter.offer.fee).toBe(Math.ceil(4500 * 1.1));
  });

  it('raises merch just enough when merch has the biggest gap', () => {
    // 5% merch against a 20% ask is x1.12; the fee is above the ask, so merch only needs to reach 18%.
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4600, slot: 'headliner', merchPct: 5 });
    expect(counter.term).toBe('merch');
    expect(counter.offer).toEqual({ fee: 4600, slot: 'headliner', merchPct: 18 });
    expect(scoreOffer(dustAndDiesel, 50, counter.offer)).toBeGreaterThanOrEqual(1);
    expect(scoreOffer(dustAndDiesel, 50, { ...counter.offer, merchPct: 17 })).toBeLessThan(1);
  });

  it('can ask for more than its merch ask to cover a short fee', () => {
    // The fee is 3% short at the merch ask; 28% merch (x0.968) covers it.
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4369, slot: 'headliner', merchPct: 0 });
    expect(counter.term).toBe('merch');
    expect(counter.offer).toEqual({ fee: 4369, slot: 'headliner', merchPct: 28 });
  });

  it('makes up the rest on the fee when merch at 30% is not enough', () => {
    const counter = buildCounter(dustAndDiesel, 50, { fee: 4000, slot: 'headliner', merchPct: 0 });
    expect(counter.term).toBe('merch');
    expect(counter.offer.merchPct).toBe(30);
    expect(counter.offer.fee).toBe(Math.ceil(4500 * 0.96));
  });

  it('every counter scores at least 1.0', () => {
    for (const fee of [3600, 4000, 4400]) {
      for (const slot of ['opener', 'support', 'headliner'] as const) {
        for (const merchPct of [0, 10, 20, 30]) {
          const offer = { fee, slot, merchPct };
          const counter = buildCounter(dustAndDiesel, 50, offer);
          expect(scoreOffer(dustAndDiesel, 50, counter.offer)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("Randy's market-rate hint", () => {
  it('is the required fee plus or minus 15%', () => {
    expect(marketRateHint(dustAndDiesel, 50, false)).toEqual({ low: 3825, high: 5175 });
  });

  it('narrows to plus or minus 8% for bands booked before', () => {
    expect(marketRateHint(dustAndDiesel, 50, true)).toEqual({ low: 4140, high: 4860 });
  });

  it('includes the emerging discount', () => {
    const fee = 378 * 0.9;
    expect(marketRateHint(mudPies, 50, false)).toEqual({ low: Math.round(fee * 0.85), high: Math.round(fee * 1.15) });
  });
});

describe('term verdicts', () => {
  it('marks each term OK, Close or Low against what the band wants', () => {
    expect(termVerdicts(dustAndDiesel, 50, { fee: 4500, slot: 'headliner', merchPct: 20 })).toEqual({
      fee: 'ok',
      slot: 'ok',
      merch: 'ok',
    });
    expect(termVerdicts(dustAndDiesel, 50, { fee: 4100, slot: 'support', merchPct: 15 })).toEqual({
      fee: 'close',
      slot: 'close',
      merch: 'close',
    });
    expect(termVerdicts(dustAndDiesel, 50, { fee: 3000, slot: 'opener', merchPct: 10 })).toEqual({
      fee: 'low',
      slot: 'low',
      merch: 'low',
    });
  });
});
