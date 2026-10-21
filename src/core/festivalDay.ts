// The festival day clock (spec sections 3 and 6). Time is game minutes after the gates open.
// The clock only moves through `advanceClock`, which the reducer calls on each tick; it stops at
// every scheduled event, so a decision card always pauses the day.

import type { FestivalTimeline } from './content';
import type { OptionEffect, OptionKey } from './events';
import { defaultTuning, type Tuning } from './tuning';

export interface ScheduledEvent {
  eventId: string;
  /** Minutes after the gates open. */
  at: number;
  onlyIf?: string;
  status: 'pending' | 'fired' | 'prevented';
}

export interface ActiveEvent {
  eventId: string;
  at: number;
  /** Real seconds the card has been open, for the playtest log. */
  seconds: number;
}

export interface DayChoice {
  eventId: string;
  option: OptionKey;
  /** Real seconds the player took to respond. */
  seconds: number;
  at: number;
  effect: OptionEffect;
}

export interface DayState {
  started: boolean;
  finished: boolean;
  minutes: number;
  speed: number;
  schedule: ScheduledEvent[];
  active: ActiveEvent | null;
  choices: DayChoice[];
  /** Problems that didn't happen thanks to preparation, for the results. */
  prevented: string[];
  headlinerOn: number;
  headlinerStarted: boolean;
}

/** "13:00" → minutes after the gates open. */
export function minutesAfterGates(clock: string, t: Tuning = defaultTuning): number {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return (h - t.festivalDay.startHour) * 60 + m;
}

export function dayLength(t: Tuning = defaultTuning): number {
  return (t.festivalDay.endHour - t.festivalDay.startHour) * 60;
}

/** Minutes after the gates → "13:05". */
export function clockLabel(minutes: number, t: Tuning = defaultTuning): string {
  const total = t.festivalDay.startHour * 60 + Math.floor(minutes);
  const h = Math.floor(total / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Game minutes per real second at normal speed (12 hours in 300 seconds is 2.4). */
export function minutesPerRealSecond(t: Tuning = defaultTuning): number {
  return dayLength(t) / t.festivalDay.realSecondsAtNormalSpeed;
}

export function newDay(timeline: FestivalTimeline, t: Tuning = defaultTuning): DayState {
  return {
    started: false,
    finished: false,
    minutes: 0,
    speed: 1,
    schedule: timeline.day.events
      .map((e) => ({ eventId: e.eventId, at: minutesAfterGates(e.at, t), status: 'pending' as const, ...(e.onlyIf ? { onlyIf: e.onlyIf } : {}) }))
      .sort((a, b) => a.at - b.at),
    active: null,
    choices: [],
    prevented: [],
    headlinerOn: minutesAfterGates(timeline.day.headlinerOn, t),
    headlinerStarted: false,
  };
}

/** What happened as the clock moved, so the reducer can cue Randy's lines. */
export type Happening =
  | { kind: 'event'; eventId: string }
  | { kind: 'prevented'; eventId: string }
  | { kind: 'headlinerOn' }
  | { kind: 'end' };

/**
 * Move the clock on by `realSeconds`. While a card is open, time stays put and the seconds count
 * towards the response time. `shouldFire` decides, when an event's time comes, whether it fires
 * or was prevented by preparation.
 */
export function advanceClock(
  day: DayState,
  realSeconds: number,
  shouldFire: (event: ScheduledEvent) => boolean,
  t: Tuning = defaultTuning,
): { day: DayState; happenings: Happening[] } {
  if (!day.started || day.finished || realSeconds <= 0) return { day, happenings: [] };
  if (day.active) return { day: { ...day, active: { ...day.active, seconds: day.active.seconds + realSeconds } }, happenings: [] };

  const end = dayLength(t);
  const happenings: Happening[] = [];
  let d = day;
  let budget = realSeconds * day.speed * minutesPerRealSecond(t);

  while (budget > 0) {
    const next = d.schedule.find((e) => e.status === 'pending');
    const points = [end, next?.at ?? Infinity, d.headlinerStarted ? Infinity : d.headlinerOn];
    const stop = Math.min(...points);
    if (d.minutes + budget < stop) {
      d = { ...d, minutes: d.minutes + budget };
      break;
    }
    budget -= stop - d.minutes;
    d = { ...d, minutes: stop };

    if (next && stop === next.at) {
      const fires = shouldFire(next);
      const status = fires ? ('fired' as const) : ('prevented' as const);
      d = { ...d, schedule: d.schedule.map((e) => (e === next ? { ...e, status } : e)) };
      if (fires) {
        happenings.push({ kind: 'event', eventId: next.eventId });
        return { day: { ...d, active: { eventId: next.eventId, at: stop, seconds: 0 } }, happenings };
      }
      d = { ...d, prevented: [...d.prevented, next.eventId] };
      happenings.push({ kind: 'prevented', eventId: next.eventId });
    } else if (!d.headlinerStarted && stop === d.headlinerOn) {
      d = { ...d, headlinerStarted: true };
      happenings.push({ kind: 'headlinerOn' });
    } else {
      happenings.push({ kind: 'end' });
      return { day: { ...d, finished: true }, happenings };
    }
  }
  return { day: d, happenings };
}

/** Record the player's choice on the open card; the clock can run again. */
export function recordChoice(day: DayState, option: OptionKey, effect: OptionEffect): DayState {
  if (!day.active) return day;
  const { eventId, at, seconds } = day.active;
  return { ...day, active: null, choices: [...day.choices, { eventId, option, seconds, at, effect }] };
}
