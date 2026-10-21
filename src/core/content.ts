// Types for the game content in src/data, and the bundled Content object the rules read.

import bandsJson from '../data/bands.json';
import emailsJson from '../data/emails.json';
import eventsJson from '../data/events.json';
import facilitiesJson from '../data/facilities.json';
import festivalsJson from '../data/festivals.json';
import linesJson from '../data/lines.json';
import timelineJson from '../data/timeline.json';
import type { EventOption } from './events';
import type { Slot } from './negotiation';
import type { Targets } from './stars';

export interface Band {
  id: string;
  name: string;
  genre: string;
  tier: number;
  reputation: number;
  legacy: number;
  hype: number;
  monthlyListeners: number;
  trend: string;
  feeAsk: number;
  merchAsk: number;
  /** Festival numbers where the band can be booked. */
  festivals: number[];
  emerging: boolean;
  notes: string;
}

export interface Festival {
  id: string;
  number: number;
  name: string;
  capacity: number;
  days: number;
  fairPrice: number;
  startingCash: number;
  promoterAdvance: boolean;
  /** Bill positions, top of the bill first. */
  slots: Slot[];
  /** Facility ids in play. */
  facilityTypes: string[];
  plotCount: number;
  targets: Targets;
  decisionCount: number;
  prepDays: number;
  newspaper: string;
  venue: string;
  startingReputation: number;
  draft: boolean;
}

export interface Facility {
  id: string;
  name: string;
  singular: string;
  plural: string;
  emoji: string;
  servesPerUnit: number;
}

export interface DecisionOption extends EventOption {
  label: string;
  /** Plain description of what the option does. */
  effect: string;
}

export interface GameEvent {
  id: string;
  kind: 'prep' | 'day';
  festivals: number[];
  title: string;
  /** Who raises it, for festival-day cards (the venue, a resident). */
  from?: string;
  /** What the festival-day card says. */
  body?: string;
  options: DecisionOption[];
}

/** What an email button does: open a screen, answer a counter, or just mark it done. */
export type EmailAction =
  | 'lineup'
  | 'site'
  | 'tickets'
  | 'finances'
  | 'negotiate'
  | 'acceptCounter'
  | 'walkAway'
  | 'continue'
  | 'dismiss';

export interface EmailTemplate {
  id: string;
  /** Number in CONTENT.md section 4. */
  number: number;
  from: string;
  /** "day" emails come from the timeline; the rest are sent by a game action or condition. */
  trigger: string;
  /** Extra check before a timeline or condition email is sent. */
  when?: string;
  /** Send at most once per festival. */
  once?: boolean;
  /** Id of the preparation decision this email carries. */
  decision?: string;
  subject: string;
  body: string;
  buttons: { label: string; action: EmailAction }[];
}

export interface TutorialLine {
  id: string;
  step: string;
  trigger: string;
  text: string;
}

export interface Lines {
  skip: string;
  tutorial: TutorialLine[];
}

export interface TimelineStop {
  day: number;
  emails: { id: string; bandId?: string }[];
}

export interface ScheduledDayEvent {
  eventId: string;
  /** Clock time on the day, "13:00". */
  at: string;
  /** Extra check when the time comes: "foodShort" fires only if food can't cover the lunchtime peak. */
  onlyIf?: string;
}

export interface FestivalTimeline {
  prepDays: number;
  onSaleDay: number;
  /** Last day (days to gates) facilities can be booked at the normal price. */
  facilityDeadline: number;
  /** The lineup locks when days to gates reach this. */
  lineupLock: number;
  stops: TimelineStop[];
  /** The festival day: scripted events in time order, and when the support and headliner go on. */
  day: { events: ScheduledDayEvent[]; supportOn: string; headlinerOn: string };
}

export interface SalesWindow {
  fromDay: number;
  toDay: number;
  share: number;
}

export interface Timeline {
  festivals: Record<string, FestivalTimeline>;
  salesCurve: SalesWindow[];
  walkUpShare: number;
}

export interface Content {
  bands: Band[];
  festivals: Festival[];
  facilities: Facility[];
  events: GameEvent[];
  emails: EmailTemplate[];
  lines: Lines;
  timeline: Timeline;
}

export const defaultContent: Content = {
  bands: bandsJson,
  festivals: festivalsJson as Festival[],
  facilities: facilitiesJson,
  events: eventsJson as GameEvent[],
  emails: emailsJson as EmailTemplate[],
  lines: linesJson,
  timeline: timelineJson,
};

function find<T extends { id: string }>(items: readonly T[], id: string, what: string): T {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown ${what}: ${id}`);
  return item;
}

export const getBand = (c: Content, id: string) => find(c.bands, id, 'band');
export const getFestival = (c: Content, id: string) => find(c.festivals, id, 'festival');
export const getFacility = (c: Content, id: string) => find(c.facilities, id, 'facility');
export const getEvent = (c: Content, id: string) => find(c.events, id, 'event');
export const getEmail = (c: Content, id: string) => find(c.emails, id, 'email');

export function festivalTimeline(c: Content, festival: Festival): FestivalTimeline {
  const t = c.timeline.festivals[String(festival.number)];
  if (!t) throw new Error(`No timeline for festival ${festival.number}`);
  return t;
}

/** Bands that can be booked at this festival. */
export function bandPool(c: Content, festival: Festival): Band[] {
  return c.bands.filter((b) => b.festivals.includes(festival.number));
}
