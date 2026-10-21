import { describe, expect, it } from 'vitest';
import { cashOf, replayFestival } from '../src/core/game';
import { closingKind, festivalResults } from '../src/core/results';
import type { FestivalOutcome } from '../src/core/economy';
import { playDay, playToGates } from './helpers';

describe('festival results', () => {
  it('a well-run festival passes with a matching review', () => {
    const s = playDay(playToGates({ limiter: 'A', foodUnits: 6 }), 'A');
    const r = festivalResults(s);
    expect(s.phase).toBe('results');
    expect(r.stars.count).toBeGreaterThanOrEqual(2);
    expect(r.passed).toBe(true);
    expect(r.tip).toBeNull();
    expect(r.newspaper.paper).toBe('The Village Gazette');
    expect(r.newspaper.headline).not.toMatch(/\{/);
    expect(r.newspaper.opening).toBeTruthy();
    expect(r.newspaper.successLine).toBe('Plenty of food stalls meant no one queued long for lunch.');
    expect(r.wentWell).toContain('avoided');
    expect(r.randy[0]).toBe(`Here's how you did: ${r.stars.count} stars out of three.`);
    expect(r.cashAfter).toBeCloseTo(20000 + r.outcome.profit);
  });

  it('the review is the same every time for the same game', () => {
    const s = playDay(playToGates(), 'C');
    expect(festivalResults(s).newspaper).toEqual(festivalResults(JSON.parse(JSON.stringify(s))).newspaper);
  });

  it('a poor festival fails with a tip on the weakest star and causes', () => {
    const s = playDay(playToGates({ foodUnits: 1, toilets: 1, price: 45 }), 'C');
    const r = festivalResults(s);
    expect(r.passed).toBe(false);
    expect(r.tip).toBeTruthy();
    expect(r.causes.length).toBeGreaterThan(0);
    expect(r.causes.length).toBeLessThanOrEqual(3);
    expect(r.causes.join(' ')).toMatch(/Queues|overpriced/);
    expect(r.randy[1]).toMatch(/Not this time/);
    expect(r.newspaper.opening === null).toBe(!r.stars[r.best]);
  });

  it('shows a noise fine in the event line', () => {
    const fined = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map((seed) => playDay({ ...playToGates({ foodUnits: 6 }), rng: seed }, 'C'))
      .find((s) => s.day?.choices.some((ch) => ch.effect.fined));
    expect(fined).toBeDefined();
    expect(festivalResults(fined!).newspaper.eventLine).toBe('The council has since fined organisers £625 over noise.');
  });

  it('closing line follows the worst area', () => {
    const o = { perceivedValue: 26 } as FestivalOutcome;
    expect(closingKind('profit', o, 25)).toBe('money');
    expect(closingKind('bands', o, 25)).toBe('bands');
    expect(closingKind('customers', o, 30)).toBe('price');
    expect(closingKind('customers', o, 25)).toBe('queues');
  });
});

describe('replay', () => {
  it('resets the festival to its start with a new attempt', () => {
    const done = playDay(playToGates(), 'A');
    const again = replayFestival(done);
    expect(again.phase).toBe('prep');
    expect(again.daysToGates).toBe(30);
    expect(again.attempt).toBe(2);
    expect(again.lineup).toEqual({});
    expect(again.reputation).toBe(50);
    expect(cashOf(again)).toBe(20000 - 4375);
    expect(again.seed).not.toBe(done.seed);
    expect(again.tutorial.queue).toHaveLength(0);
  });
});
