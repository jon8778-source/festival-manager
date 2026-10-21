// Playtest log records (spec section 11). Records are plain JSON; src/app stores them and offers
// them as a .jsonl download. Records about game actions are worked out by comparing the state
// before and after an action, so the reducer stays free of logging.

import { defaultContent, type Content } from './content';
import type { GameAction, GameState } from './game';
import { festivalResults } from './results';
import { defaultTuning, type Tuning } from './tuning';

export type LogKind =
  | 'session_start'
  | 'session_end'
  | 'screen'
  | 'negotiation_round'
  | 'prep_decision'
  | 'event_choice'
  | 'festival_result'
  | 'replay'
  | 'quit';

export interface LogRecord {
  /** ISO time. */
  t: string;
  session: string;
  festival: string | null;
  attempt: number | null;
  kind: LogKind;
  [key: string]: unknown;
}

export interface LogContext {
  session: string;
  now: string;
}

export function makeRecord(kind: LogKind, payload: Record<string, unknown>, ctx: LogContext, state: GameState | null): LogRecord {
  return {
    t: ctx.now,
    session: ctx.session,
    festival: state?.festivalId ?? null,
    attempt: state?.attempt ?? null,
    kind,
    ...payload,
  };
}

const round = (value: number, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

/** Log records for what an action did. */
export function recordsForAction(
  prev: GameState,
  next: GameState,
  action: GameAction,
  ctx: LogContext,
  c: Content = defaultContent,
  t: Tuning = defaultTuning,
): LogRecord[] {
  const records: LogRecord[] = [];

  if (action.type === 'submitOffer') {
    const before = prev.talks[action.bandId]?.rounds.length ?? 0;
    const rounds = next.talks[action.bandId]?.rounds ?? [];
    for (const r of rounds.slice(before)) {
      records.push(makeRecord('negotiation_round', { band: action.bandId, offer: r.offer, score: round(r.score), result: r.result }, ctx, next));
    }
  }

  for (const d of next.decisions.slice(prev.decisions.length)) {
    records.push(makeRecord('prep_decision', { event: d.eventId, option: d.option, daysToGates: d.day }, ctx, next));
  }

  const prevChoices = prev.day?.choices.length ?? 0;
  for (const ch of next.day?.choices.slice(prevChoices) ?? []) {
    records.push(makeRecord('event_choice', { event: ch.eventId, option: ch.option, seconds: round(ch.seconds, 1), fined: ch.effect.fined }, ctx, next));
  }

  if (action.type === 'replay') records.push(makeRecord('replay', { fromAttempt: prev.attempt }, ctx, next));

  if (prev.phase !== 'results' && next.phase === 'results') {
    const r = festivalResults(next, c, t);
    records.push(
      makeRecord(
        'festival_result',
        {
          stars: r.stars.count,
          passed: r.passed,
          profitPct: round(r.outcome.profitPct),
          customerSat: round(r.outcome.customerSatisfaction),
          bandSat: round(r.outcome.bandSatisfaction),
          attendance: round(r.outcome.attendance),
          prevented: next.day?.prevented ?? [],
        },
        ctx,
        next,
      ),
    );
  }
  return records;
}

export function toJsonl(records: readonly LogRecord[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
}

/** Keep the newest records when the log grows past its cap. */
export function capLog(records: readonly LogRecord[], max: number): LogRecord[] {
  return records.length > max ? records.slice(records.length - max) : [...records];
}
