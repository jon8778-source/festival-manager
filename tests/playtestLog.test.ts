import { describe, expect, it } from 'vitest';
import { newGame, reduce, type GameAction } from '../src/core/game';
import { capLog, makeRecord, recordsForAction, toJsonl } from '../src/core/playtestLog';
import { playToGates } from './helpers';

const ctx = { session: 's1', now: '2026-10-21T10:00:00.000Z' };
const step = (s: ReturnType<typeof newGame>, action: GameAction) => {
  const next = reduce(s, action);
  return { next, records: recordsForAction(s, next, action, ctx) };
};

describe('playtest log', () => {
  it('records each negotiation round with its score and result', () => {
    const { records } = step(newGame(1), {
      type: 'submitOffer',
      bandId: 'dust-and-diesel',
      offer: { fee: 3900, slot: 'headliner', merchPct: 20 },
    });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'negotiation_round', band: 'dust-and-diesel', result: 'counter', festival: 'village-green', attempt: 1 });
    expect(records[0]?.score).toBeCloseTo(0.867, 2);
  });

  it('records an accepted offer too', () => {
    const { next, records } = step(newGame(1), {
      type: 'submitOffer',
      bandId: 'the-mud-pies',
      offer: { fee: 380, slot: 'opener', merchPct: 10 },
    });
    expect(next.talks['the-mud-pies']?.rounds.map((r) => r.result)).toEqual(['accept']);
    expect(records[0]).toMatchObject({ kind: 'negotiation_round', band: 'the-mud-pies', result: 'accept' });
  });

  it('records festival-day choices with the seconds taken, and the result at midnight', () => {
    let s = playToGates({ foodUnits: 1 });
    while (!s.day?.active) s = reduce(s, { type: 'tick', realSeconds: 1 });
    s = reduce(s, { type: 'tick', realSeconds: 4.2 });
    const choice = step(s, { type: 'chooseOption', option: 'B' });
    expect(choice.records[0]).toMatchObject({ kind: 'event_choice', event: 'food-queue', option: 'B', seconds: 4.2 });

    let next = choice.next;
    const all = [];
    while (next.phase === 'day') {
      const action: GameAction = next.day?.active ? { type: 'chooseOption', option: 'A' } : { type: 'tick', realSeconds: 1 };
      const r = step(next, action);
      all.push(...r.records);
      next = r.next;
    }
    const result = all.find((r) => r.kind === 'festival_result');
    expect(result).toMatchObject({ kind: 'festival_result' });
    expect(typeof result?.stars).toBe('number');
  });

  it('records replays', () => {
    const done = { ...playToGates(), phase: 'results' as const };
    expect(step(done, { type: 'replay' }).records.map((r) => r.kind)).toEqual(['replay']);
  });

  it('writes one JSON record per line and keeps the newest records', () => {
    const recs = [1, 2, 3].map((i) => makeRecord('screen', { screen: `s${i}` }, ctx, null));
    expect(toJsonl(recs).split('\n')).toHaveLength(4);
    expect(JSON.parse(toJsonl(recs).split('\n')[0]!)).toMatchObject({ kind: 'screen', screen: 's1', festival: null });
    expect(capLog(recs, 2).map((r) => r.screen)).toEqual(['s2', 's3']);
  });
});
