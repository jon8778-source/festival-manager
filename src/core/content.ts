// Types for the game content in src/data. The JSON is generated from docs/CONTENT.md by
// `npm run content` (scripts/build-content.ts); tests/data.test.ts checks it matches these types.

import bandsJson from '../data/bands.json';
import emailsJson from '../data/emails.json';
import eventsJson from '../data/events.json';
import facilitiesJson from '../data/facilities.json';
import festivalsJson from '../data/festivals.json';
import linesJson from '../data/lines.json';
import newspaperJson from '../data/newspaper.json';
import timelineJson from '../data/timeline.json';
import type { EventOption, OptionKey } from './events';
import type { BandMood, StarArea } from './stars';

export type Trend = 'steady' | 'rising' | 'risingFast' | 'falling';

export interface Band {
  id: string;
  name: string;
  genre: string;
  tier: number;
  /** 0 to 100. */
  reputation: number;
  legacy: number;
  hype: number;
  monthlyListeners: number;
  trend: Trend;
  feeAsk: number;
  /** Points (10 for 10%). */
  merchAsk: number;
  /** Festival numbers where the band can be booked. */
  festivals: number[];
  /** A stretch booking (The Last Heatwave at festival 3). */
  stretch: boolean;
  emerging: boolean;
  notes: string;
}

export interface Targets {
  /** 0 to 1. */
  customers: number;
  /** 0 to 1. */
  bands: number;
  /** Profit as a share of spend. */
  profit: number;
}

export interface Festival {
  id: string;
  number: number;
  name: string;
  /** Festivals 2 and 3 are drafts until they're reviewed after the first playable. */
  draft: boolean;
  capacity: number;
  days: number;
  fairPrice: number;
  /** R as written in CONTENT.md (checked against capacity x Pt by the tests). */
  fullScaleRevenue: number;
  /** Festival 1 only; later festivals carry cash over. */
  startingCash: number | null;
  budgetNote: string;
  stages: number;
  /** Slot ids, lowest first; they match the keys of tuning.merchSlotWeights. */
  slots: string[];
  /** Facility ids in play. */
  facilityTypes: string[];
  /** Unit cost as written in CONTENT.md (checked against the economy formula by the tests). */
  unitCost: number;
  bandPoolSize: number;
  /** Festival 1 only; later festivals carry reputation over. */
  startingReputation: number | null;
  targets: Targets;
  decisionCount: number;
  decisionNote: string;
  prepDays: number;
  newspaper: string;
  referencePlan: string;
}

export interface Facility {
  id: string;
  name: string;
  plural: string;
  /** Placeholder art. */
  emoji: string;
  firstFestival: number;
}

export interface EventOptionContent extends EventOption {
  label: string;
  /** What the option does, for preparation decisions. */
  effect: string | null;
}

export interface ScheduleEntry {
  festival: number;
  kind: 'scripted' | 'random';
  /** 0 to 1, for random events. */
  chance: number | null;
  /** Festival day clock time (HH:MM), for day events. */
  at: string | null;
  /** Days to gates, for preparation decisions. */
  day: number | null;
  /** A condition the game checks before the event happens (for example 'food-short'). */
  condition: string | null;
}

export interface GameEvent {
  id: string;
  name: string;
  /** 'day' for festival day events, 'prep' for preparation decisions. */
  phase: 'day' | 'prep';
  from: string | null;
  when: string;
  schedule: ScheduleEntry[];
  options: EventOptionContent[];
}

export type ScreenId = 'lineup' | 'negotiation' | 'tickets' | 'site' | 'results';

export type EmailAction =
  | { type: 'screen'; screen: ScreenId }
  | { type: 'option'; option: OptionKey }
  | { type: 'game'; action: 'acceptCounter' | 'walkAway' | 'startFestival' | 'dismiss' };

export interface EmailButton {
  label: string;
  action: EmailAction;
}

export type EmailTrigger =
  /** A preparation timeline moment (timeline.json). */
  | { type: 'moment'; moment: string }
  /** Something the player did, such as an accepted offer. */
  | { type: 'action'; action: string }
  /** A condition the game checks, such as slow sales. */
  | { type: 'condition'; condition: string }
  /** A decision card for an event (events.json). */
  | { type: 'event'; eventId: string };

export interface EmailTemplate {
  id: string;
  number: number;
  from: string;
  when: string;
  subject: string;
  /** The message, or null when the email opens a screen instead (the review). */
  body: string | null;
  note: string | null;
  buttons: EmailButton[];
  trigger: EmailTrigger;
  /** Festival numbers the email belongs to, or null for every festival. */
  festivals: number[] | null;
}

export interface Line {
  id: string;
  /** Tutorial step, for the festival 1 tutorial lines. */
  step: string | null;
  when: string;
  text: string;
}

export interface Lines {
  tutorial: Line[];
  festival2: Line[];
  festival3: Line[];
  /** Lines for festival 2 and 3 events. */
  events: Line[];
  /** The basic tip after a failed festival, by weakest star. */
  tips: Record<StarArea, string>;
}

export type ClosingIssue = 'queues' | 'price' | 'bands' | 'money';

export interface Newspaper {
  /** Paper name by festival number. */
  papers: Record<string, string>;
  /** {weakest_issue} text by issue. */
  weakestIssues: Record<ClosingIssue, string>;
  /** Headline options by star count (0 to 3). */
  headlines: Record<string, string[]>;
  opening: Record<StarArea, string>;
  closing: Record<ClosingIssue, string>;
  events: Record<string, string>;
  success: Record<string, string>;
  successNote: string;
  spotlight: { template: string; growthEvents: string[] };
  statsBox: string;
  moodLabels: Record<BandMood, string>;
}

export interface TimelineMoment {
  id: string;
  /** Days to gates (empty when the doc doesn't give a fixed day). */
  days: number[];
  text: string;
}

export interface FestivalTimeline {
  festival: number;
  prepDays: number;
  moments: TimelineMoment[];
  /** "Otherwise as festival N." */
  inheritsFrom: number | null;
  text: string;
}

export interface SalesWindow {
  label: string;
  /** Days to gates the window starts at, or null for "on sale". */
  from: number | null;
  /** Days to gates the window ends at (0 is the festival day). */
  to: number;
  share: number;
}

export interface Timeline {
  festivals: FestivalTimeline[];
  salesCurve: SalesWindow[];
  rules: string[];
}

export interface Content {
  bands: Band[];
  festivals: Festival[];
  facilities: Facility[];
  events: GameEvent[];
  emails: EmailTemplate[];
  lines: Lines;
  newspaper: Newspaper;
  timeline: Timeline;
}

/** All the game content. JSON imports widen string unions, so the shapes are checked by tests/data.test.ts. */
export const content: Content = {
  bands: bandsJson as Band[],
  festivals: festivalsJson as Festival[],
  facilities: facilitiesJson as Facility[],
  events: eventsJson as GameEvent[],
  emails: emailsJson as EmailTemplate[],
  lines: linesJson as Lines,
  newspaper: newspaperJson as Newspaper,
  timeline: timelineJson as Timeline,
};
