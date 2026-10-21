import { describe, expect, it } from 'vitest';
import { defaultContent } from '../src/core/content';
import { advanceClock, clockLabel, minutesAfterGates, minutesPerRealSecond, newDay } from '../src/core/festivalDay';
import {
  festivalOf,
  liveOutcome,
  newGame,
  pendingDecisionEmail,
  reduce,
  type GameAction,
  type GameState,
} from '../src/core/game';

const f1 = defaultContent.timeline.festivals['1']!;
const run = (state: GameState, ...actions: GameAction[]) => actions.reduce((s, a) => reduce(s, a), state);

/** Book a lineup, build `foodUnits` food stalls and 5 toilets, answer the limiter, then open the gates. */
function gatesOpen(limiter: 'A' | 'C' = 'C', foodUnits = 5): GameState {
  let s = run(
    newGame(7),
    { type: 'submitOffer', bandId: 'the-mud-pies', offer: { fee: 380, slot: 'opener', merchPct: 10 } },
    { type: 'submitOffer', bandId: 'amber-lights', offer: { fee: 2100, slot: 'support', merchPct: 15 } },
    { type: 'submitOffer', bandId: 'dust-and-diesel', offer: { fee: 4500, slot: 'headliner', merchPct: 20 } },
  );
  for (let i = 0; i < 5; i++) s = reduce(s, { type: 'placeFacility', plot: i, facilityId: 'toilets' });
  for (let i = 0; i < foodUnits; i++) s = reduce(s, { type: 'placeFacility', plot: 5 + i, facilityId: 'food' });
  while (s.phase === 'prep') {
    const decision = pendingDecisionEmail(s);
    if (decision) {
      const option = decision.decision?.eventId === 'sound-limiter' ? limiter : 'C';
      s = reduce(s, { type: 'chooseDecision', emailId: decision.id, option });
    } else s = reduce(s, { type: 'continue' });
  }
  return reduce(s, { type: 'openGates' });
}

/** Tick in quarter-second steps, as the screen does, until a card opens or the day ends. */
function runUntilStop(state: GameState, maxSeconds = 400): GameState {
  let s = state;
  for (let i = 0; i < maxSeconds * 4 && s.phase === 'day' && !s.day?.active; i++) s = reduce(s, { type: 'tick', realSeconds: 0.25 });
  return s;
}

describe('festival day clock', () => {
  it('runs noon to midnight in 300 real seconds at normal speed', () => {
    expect(minutesPerRealSecond()).toBeCloseTo(2.4);
    expect(minutesAfterGates('13:00')).toBe(60);
    expect(clockLabel(0)).toBe('12:00');
    expect(clockLabel(545)).toBe('21:05');
    expect(clockLabel(720)).toBe('00:00');
  });

  it('schedules festival 1 events in order', () => {
    expect(newDay(f1).schedule.map((e) => [e.eventId, e.at])).toEqual([
      ['food-queue', 60],
      ['band-late', 150],
      ['noise-complaint', 480],
    ]);
  });

  it('does not move until the gates open, and stops at the next event', () => {
    const day = newDay(f1);
    expect(advanceClock(day, 10, () => true).day.minutes).toBe(0);
    const started = { ...day, started: true };
    const { day: after, happenings } = advanceClock(started, 100, () => true);
    expect(after.minutes).toBe(60);
    expect(after.active?.eventId).toBe('food-queue');
    expect(happenings).toEqual([{ kind: 'event', eventId: 'food-queue' }]);
  });

  it('runs twice as fast at 2x', () => {
    const day = { ...newDay(f1), started: true, speed: 2 };
    expect(advanceClock(day, 10, () => true).day.minutes).toBeCloseTo(48);
  });

  it('pauses while a card is open and counts the response time', () => {
    const day = { ...newDay(f1), started: true };
    const open = advanceClock(day, 30, () => true).day;
    const later = advanceClock(open, 4.5, () => true).day;
    expect(later.minutes).toBe(60);
    expect(later.active?.seconds).toBeCloseTo(4.5);
  });

  it('skips prevented events and records them', () => {
    const day = { ...newDay(f1), started: true };
    const { day: after, happenings } = advanceClock(day, 100, (e) => e.eventId !== 'food-queue');
    expect(after.prevented).toEqual(['food-queue']);
    expect(after.active?.eventId).toBe('band-late');
    expect(happenings[0]).toEqual({ kind: 'prevented', eventId: 'food-queue' });
  });
});

describe('festival 1 day through the reducer', () => {
  it('fires all three decisions when food is short and the limiter was declined', () => {
    let s = gatesOpen('C', 3);
    expect(s.tutorial.seen).toContain('gatesOpen');
    const seen: string[] = [];
    while (s.phase === 'day') {
      s = runUntilStop(s);
      if (s.day?.active) {
        seen.push(s.day.active.eventId);
        s = run(s, { type: 'tick', realSeconds: 2 }, { type: 'chooseOption', option: 'A' });
      }
    }
    expect(seen).toEqual(['food-queue', 'band-late', 'noise-complaint']);
    expect(s.phase).toBe('results');
    expect(s.day?.choices.map((ch) => [ch.eventId, ch.option])).toEqual([
      ['food-queue', 'A'],
      ['band-late', 'A'],
      ['noise-complaint', 'A'],
    ]);
    // Response time is real seconds, counted while the card was open.
    expect(s.day?.choices[0]?.seconds).toBeCloseTo(2);
    expect(s.tutorial.seen).toEqual(expect.arrayContaining(['foodQueue', 'queueFixed', 'bandLate', 'noiseComplaint', 'headlinerOn']));
  });

  it('enough food and a sound limiter prevent two problems', () => {
    let s = gatesOpen('A', 6);
    s = runUntilStop(s);
    expect(s.day?.active?.eventId).toBe('band-late');
    s = reduce(s, { type: 'chooseOption', option: 'B' });
    s = runUntilStop(s);
    expect(s.phase).toBe('results');
    expect(s.day?.prevented).toEqual(['food-queue', 'noise-complaint']);
    expect(s.tutorial.seen).toEqual(expect.arrayContaining(['noQueue', 'complaintPrevented']));
  });

  it('choices change the live outcome through the event rules', () => {
    let s = runUntilStop(gatesOpen('C', 3));
    const before = liveOutcome(s);
    s = reduce(s, { type: 'chooseOption', option: 'C' });
    const after = liveOutcome(s);
    expect(after.customerSatisfaction).toBeCloseTo(before.customerSatisfaction - 0.08);
    s = runUntilStop(s);
    s = reduce(s, { type: 'chooseOption', option: 'A' });
    // Stretching the opener costs 0.5% of R (£62.50).
    expect(liveOutcome(s).eventCosts).toBeCloseTo(62.5);
  });

  it('ignoring the noise complaint rolls the seeded fine', () => {
    const fines = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      let s: GameState = { ...gatesOpen('C', 6), rng: seed };
      s = runUntilStop(s);
      s = reduce(s, { type: 'chooseOption', option: 'A' });
      s = runUntilStop(s);
      s = reduce(s, { type: 'chooseOption', option: 'B' });
      return s.day!.choices[1]!.effect.fine;
    });
    const r = festivalOf(newGame(1)).capacity * 25;
    for (const fine of fines) expect([0, 0.05 * r]).toContain(fine);
    expect(fines.some((f) => f > 0)).toBe(true);
  });

  it('2x speed reaches midnight in half the time', () => {
    let s = gatesOpen('A', 6);
    s = reduce(s, { type: 'setSpeed', speed: 2 });
    s = runUntilStop(s);
    s = reduce(s, { type: 'chooseOption', option: 'A' });
    let seconds = 0;
    while (s.phase === 'day' && seconds < 400) {
      s = reduce(s, { type: 'tick', realSeconds: 1 });
      seconds++;
    }
    expect(s.phase).toBe('results');
    // 570 game minutes from 14:30 to midnight at 4.8 minutes a second is 118.75 seconds.
    expect(seconds).toBe(119);
  });
});
