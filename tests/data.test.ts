import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { convertContent } from '../scripts/content/convert.ts';
import { contentFiles } from '../scripts/content/files.ts';
import { content } from '../src/core/content';
import { facilityUnitCost, fairTicketPrice, fullScaleRevenue } from '../src/core/economy';
import { defaultTuning } from '../src/core/tuning';

const root = join(__dirname, '..');
const markdown = readFileSync(join(root, 'docs', 'CONTENT.md'), 'utf8');

// A tiny shape checker: each validator adds a message per problem.
type Validator = (value: unknown, path: string, errors: string[]) => void;

const text: Validator = (v, p, e) => {
  if (typeof v !== 'string' || v.trim() === '') e.push(`${p} should be non-empty text`);
};
const anyText: Validator = (v, p, e) => {
  if (typeof v !== 'string') e.push(`${p} should be text`);
};
const num: Validator = (v, p, e) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) e.push(`${p} should be a number`);
};
const int: Validator = (v, p, e) => {
  if (!Number.isInteger(v)) e.push(`${p} should be a whole number`);
};
const bool: Validator = (v, p, e) => {
  if (typeof v !== 'boolean') e.push(`${p} should be true or false`);
};
const nullable =
  (inner: Validator): Validator =>
  (v, p, e) => {
    if (v !== null) inner(v, p, e);
  };
const optional =
  (inner: Validator): Validator =>
  (v, p, e) => {
    if (v !== undefined) inner(v, p, e);
  };
const oneOf =
  (...values: unknown[]): Validator =>
  (v, p, e) => {
    if (!values.includes(v)) e.push(`${p} should be one of ${values.join(', ')} (got ${String(v)})`);
  };
const arrayOf =
  (inner: Validator, min = 0): Validator =>
  (v, p, e) => {
    if (!Array.isArray(v)) return void e.push(`${p} should be a list`);
    if (v.length < min) e.push(`${p} should have at least ${min} entries`);
    v.forEach((item, i) => inner(item, `${p}[${i}]`, e));
  };
const recordOf =
  (inner: Validator, keys?: string[]): Validator =>
  (v, p, e) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return void e.push(`${p} should be an object`);
    if (keys) expect(Object.keys(v).sort(), `${p} keys`).toEqual([...keys].sort());
    for (const [k, item] of Object.entries(v)) inner(item, `${p}.${k}`, e);
  };
const obj =
  (shape: Record<string, Validator>): Validator =>
  (v, p, e) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return void e.push(`${p} should be an object`);
    const record = v as Record<string, unknown>;
    for (const key of Object.keys(record)) if (!(key in shape)) e.push(`${p}.${key} is not in the type`);
    for (const [key, check] of Object.entries(shape)) check(record[key], `${p}.${key}`, e);
  };
const tagged =
  (shapes: Record<string, Record<string, Validator>>): Validator =>
  (v, p, e) => {
    const type = (v as { type?: string } | null)?.type;
    const shape = type ? shapes[type] : undefined;
    if (!shape) return void e.push(`${p}.type should be one of ${Object.keys(shapes).join(', ')}`);
    obj({ type: text, ...shape })(v, p, e);
  };

const band = obj({
  id: text,
  name: text,
  genre: text,
  tier: oneOf(1, 2, 3, 4, 5),
  reputation: int,
  legacy: int,
  hype: int,
  monthlyListeners: int,
  trend: oneOf('steady', 'rising', 'risingFast', 'falling'),
  feeAsk: int,
  merchAsk: int,
  festivals: arrayOf(oneOf(1, 2, 3), 1),
  stretch: bool,
  emerging: bool,
  notes: anyText,
});

const festival = obj({
  id: text,
  number: int,
  name: text,
  draft: bool,
  capacity: int,
  days: int,
  fairPrice: num,
  fullScaleRevenue: num,
  startingCash: nullable(num),
  budgetNote: text,
  stages: oneOf(1, 2),
  slots: arrayOf(text, 3),
  facilityTypes: arrayOf(text, 2),
  unitCost: num,
  bandPoolSize: int,
  startingReputation: nullable(num),
  targets: obj({ customers: num, bands: num, profit: num }),
  decisionCount: int,
  decisionNote: text,
  prepDays: int,
  newspaper: text,
  referencePlan: text,
});

const facility = obj({ id: text, name: text, plural: text, emoji: text, firstFestival: int });

const option = obj({
  key: oneOf('A', 'B', 'C'),
  label: text,
  effect: nullable(text),
  costShareR: num,
  customers: int,
  bands: int,
  reputation: int,
  risksFine: optional(oneOf(true)),
  prevents: optional(arrayOf(text, 1)),
  attendanceBonus: optional(num),
  priceCutShareOfFair: optional(num),
});

const scheduleEntry = obj({
  festival: oneOf(1, 2, 3),
  kind: oneOf('scripted', 'random'),
  chance: nullable(num),
  at: nullable((v, p, e) => {
    if (typeof v !== 'string' || !/^\d\d:\d\d$/.test(v)) e.push(`${p} should be a clock time (HH:MM)`);
  }),
  day: nullable(int),
  condition: nullable(text),
});

const gameEvent = obj({
  id: text,
  name: text,
  phase: oneOf('day', 'prep'),
  from: nullable(text),
  when: text,
  schedule: arrayOf(scheduleEntry, 1),
  options: arrayOf(option, 2),
});

const emailAction = tagged({
  screen: { screen: oneOf('lineup', 'negotiation', 'tickets', 'site', 'results') },
  option: { option: oneOf('A', 'B', 'C') },
  game: { action: oneOf('acceptCounter', 'walkAway', 'startFestival', 'dismiss') },
});

const email = obj({
  id: text,
  number: int,
  from: text,
  when: text,
  subject: text,
  body: nullable(text),
  note: nullable(text),
  buttons: arrayOf(obj({ label: text, action: emailAction }), 1),
  trigger: tagged({
    moment: { moment: text },
    action: { action: text },
    condition: { condition: text },
    event: { eventId: text },
  }),
  festivals: nullable(arrayOf(oneOf(1, 2, 3), 1)),
});

const line = obj({ id: text, step: nullable(text), when: text, text: text });

const lines = obj({
  tutorial: arrayOf(line, 1),
  festival2: arrayOf(line, 1),
  festival3: arrayOf(line, 1),
  events: arrayOf(line, 1),
  tips: recordOf(text, ['profit', 'customers', 'bands']),
});

const newspaper = obj({
  papers: recordOf(text, ['1', '2', '3']),
  weakestIssues: recordOf(text, ['queues', 'price', 'bands', 'money']),
  headlines: recordOf(arrayOf(text, 1), ['0', '1', '2', '3']),
  opening: recordOf(text, ['profit', 'customers', 'bands']),
  closing: recordOf(text, ['queues', 'price', 'bands', 'money']),
  events: recordOf(text),
  success: recordOf(text),
  successNote: text,
  spotlight: obj({ template: text, growthEvents: arrayOf(text, 1) }),
  statsBox: text,
  moodLabels: recordOf(text, ['delighted', 'happy', 'grumbling', 'furious']),
});

const timeline = obj({
  festivals: arrayOf(
    obj({
      festival: int,
      prepDays: int,
      moments: arrayOf(obj({ id: text, days: arrayOf(int), text: text }), 1),
      inheritsFrom: nullable(int),
      text: text,
    }),
    3,
  ),
  salesCurve: arrayOf(obj({ label: text, from: nullable(int), to: int, share: num }), 1),
  rules: arrayOf(text),
});

function check(validator: Validator, value: unknown, name: string): string[] {
  const errors: string[] = [];
  validator(value, name, errors);
  return errors;
}

describe('the data matches docs/CONTENT.md', () => {
  it('every JSON file in src/data is what `npm run content` would write', () => {
    for (const [file, expected] of Object.entries(contentFiles(markdown))) {
      const actual = readFileSync(join(root, 'src', 'data', file), 'utf8');
      expect(actual, `src/data/${file} is out of date: run npm run content`).toBe(expected);
    }
  });
});

describe('the data matches the types', () => {
  it('bands', () => expect(check(arrayOf(band, 1), content.bands, 'bands')).toEqual([]));
  it('festivals', () => expect(check(arrayOf(festival, 3), content.festivals, 'festivals')).toEqual([]));
  it('facilities', () => expect(check(arrayOf(facility, 2), content.facilities, 'facilities')).toEqual([]));
  it('events', () => expect(check(arrayOf(gameEvent, 1), content.events, 'events')).toEqual([]));
  it('emails', () => expect(check(arrayOf(email, 1), content.emails, 'emails')).toEqual([]));
  it("Randy's lines", () => expect(check(lines, content.lines, 'lines')).toEqual([]));
  it('newspaper', () => expect(check(newspaper, content.newspaper, 'newspaper')).toEqual([]));
  it('timeline', () => expect(check(timeline, content.timeline, 'timeline')).toEqual([]));

  it('ids are unique', () => {
    const lists: [string, { id: string }[]][] = [
      ['bands', content.bands],
      ['festivals', content.festivals],
      ['facilities', content.facilities],
      ['events', content.events],
      ['emails', content.emails],
      ['tutorial lines', content.lines.tutorial],
      ['festival 2 lines', content.lines.festival2],
      ['festival 3 lines', content.lines.festival3],
      ['event lines', content.lines.events],
    ];
    for (const [name, list] of lists) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size, `${name} ids`).toBe(ids.length);
    }
    const numbers = content.emails.map((e) => e.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});

const festival1 = content.festivals.find((f) => f.number === 1)!;

describe('festival 1 is complete', () => {
  it('is Village Green, not a draft, with the CONTENT.md numbers', () => {
    expect(festival1).toMatchObject({
      id: 'village-green',
      name: 'Village Green',
      draft: false,
      capacity: 500,
      fairPrice: 25,
      startingCash: 20000,
      startingReputation: 50,
      slots: ['opener', 'support', 'headliner'],
      facilityTypes: ['toilets', 'food'],
      targets: { customers: 0.65, bands: 0.6, profit: 0.05 },
      decisionCount: 3,
      prepDays: 30,
      newspaper: 'The Village Gazette',
    });
  });

  it('has its band pool of 12, with the four emerging bands marked', () => {
    const pool = content.bands.filter((b) => b.festivals.includes(1));
    expect(pool).toHaveLength(festival1.bandPoolSize);
    expect(content.bands).toHaveLength(18);
    expect(content.bands.filter((b) => b.emerging).map((b) => b.name)).toEqual([
      'The Mud Pies',
      'Kettle Logic',
      'Velvet Static',
      'Neon Harbour',
    ]);
    expect(content.bands.find((b) => b.id === 'the-royal-mile')!.monthlyListeners).toBe(1_200_000);
  });

  it('has its three festival day decisions, at clock times', () => {
    const day1 = content.events.filter((e) => e.phase === 'day' && e.schedule.some((s) => s.festival === 1));
    expect(day1.map((e) => e.id)).toEqual(['food-stall-queue', 'band-running-late', 'noise-complaint']);
    expect(day1).toHaveLength(festival1.decisionCount);
    for (const event of day1) {
      const entry = event.schedule.find((s) => s.festival === 1)!;
      expect(entry.kind).toBe('scripted');
      expect(entry.at).not.toBeNull();
    }
    expect(day1[0]!.schedule[0]!.condition).toBe('food-short');
  });

  it('has the sound limiter and slow-sales decisions on days 20 and 14', () => {
    const limiter = content.events.find((e) => e.id === 'sound-limiter')!;
    const slow = content.events.find((e) => e.id === 'slow-sales')!;
    expect(limiter.schedule.find((s) => s.festival === 1)!.day).toBe(20);
    expect(slow.schedule.find((s) => s.festival === 1)).toMatchObject({ day: 14, condition: 'forecast-below-threshold' });
    expect(limiter.options.filter((o) => o.prevents?.includes('noise-complaint')).map((o) => o.key)).toEqual(['A', 'B']);
    expect(slow.options.map((o) => [o.key, o.priceCutShareOfFair ?? 0, o.attendanceBonus ?? 0])).toEqual([
      ['A', 0.08, 0],
      ['B', 0, 0.03],
      ['C', 0, 0],
    ]);
  });

  it('has its preparation timeline', () => {
    const t1 = content.timeline.festivals.find((f) => f.festival === 1)!;
    const days = Object.fromEntries(t1.moments.map((m) => [m.id, m.days]));
    expect(days).toEqual({
      welcome: [30],
      'tickets-on-sale': [26],
      'sales-update': [16, 14, 7, 3],
      'sound-limiter': [20],
      'slow-sales-check': [14],
      'no-headliner-reminder': [10],
      'empty-slot-reminder': [3],
      'facility-deadline': [3],
      'gates-tomorrow': [1],
      'festival-day': [0],
    });
    expect(t1.prepDays).toBe(festival1.prepDays);
  });

  it('has a ticket sales curve that adds up to 100%', () => {
    const total = content.timeline.salesCurve.reduce((sum, w) => sum + w.share, 0);
    expect(total).toBeCloseTo(1);
  });

  it("has all of Randy's tutorial lines", () => {
    expect(content.lines.tutorial.map((l) => l.id)).toEqual([
      'game-starts',
      'budget-screen-opens',
      'targets-panel',
      'lineup-screen-opens',
      'first-negotiation-opens',
      'offer-table',
      'band-counters',
      'deal-accepted',
      'band-walks-away',
      'headliner-booked',
      'site-map-opens',
      'forecast-panel-first-shown',
      'sound-limiter-email',
      'ticket-price',
      'gates-open',
      'food-queue',
      'queue-fixed',
      'no-queue',
      'band-running-late',
      'complaint-prevented',
      'noise-complaint',
      'headliner-goes-on',
      'results-screen',
      'passed',
      'failed',
      'skip-button',
    ]);
    for (const l of content.lines.tutorial) expect(l.text).not.toMatch(/^"|"$/);
  });

  it('has every email, with triggers that point at real moments and events', () => {
    expect(content.emails.map((e) => e.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 23 }, (_, i) => i + 1),
    );
    const eventIds = new Set(content.events.map((e) => e.id));
    for (const e of content.emails) {
      if (e.trigger.type === 'event') {
        expect(eventIds.has(e.trigger.eventId), `email ${e.number} event`).toBe(true);
        const event = content.events.find((x) => x.id === (e.trigger as { eventId: string }).eventId)!;
        expect(e.buttons.map((b) => b.action), `email ${e.number} buttons`).toEqual(
          event.options.map((o) => ({ type: 'option', option: o.key })),
        );
      }
      if (e.trigger.type === 'moment') {
        const festivals = e.festivals ?? [1];
        for (const n of festivals) {
          const t = content.timeline.festivals.find((f) => f.festival === n)!;
          const inherited = content.timeline.festivals.find((f) => f.festival === t.inheritsFrom);
          const ids = [...t.moments, ...(inherited?.moments ?? [])].map((m) => m.id);
          expect(ids, `email ${e.number} moment at festival ${n}`).toContain(e.trigger.moment);
        }
      }
    }
  });

  it('has the newspaper templates', () => {
    expect(content.newspaper.papers['1']).toBe(festival1.newspaper);
    for (const stars of ['0', '1', '2', '3']) expect(content.newspaper.headlines[stars]!.length).toBeGreaterThan(0);
    expect(Object.keys(content.newspaper.success)).toEqual(['noQueue', 'limiter', 'headlinerDelighted', 'soldOut']);
    expect(content.newspaper.events.noiseFine).toContain('{fine}');
  });

  it('only uses known placeholders', () => {
    const known = new Set([
      'days_to_gates', 'cash', 'band_name', 'slot', 'fee', 'merch_pct', 'counter_fee', 'counter_slot',
      'counter_merch', 'days_left', 'listeners', 'price', 'sold_pct', 'tickets_sold', 'capacity', 'forecast',
      'forecast_pct', 'remaining', 'units', 'facility', 'cost', 'capacity_served', 'day', 'rain_chance',
      'price_cut', 'poster_cost', 'old_listeners', 'new_listeners', 'rate_low', 'rate_high', 'fair_price',
      'stars', 'advance', 'fee3', 'reputation', 'headliner', 'festival', 'weakest_issue', 'fine',
      'last_festival', 'growth_event', 'profit', 'attendance',
    ]);
    const all = JSON.stringify([content.emails, content.lines, content.newspaper]);
    const used = [...all.matchAll(/\{([a-z_0-9]+)\}/g)].map((m) => m[1]!);
    expect(used.filter((p) => !known.has(p))).toEqual([]);
  });
});

describe('festivals 2 and 3 are present as drafts', () => {
  it('are marked as drafts', () => {
    expect(content.festivals.map((f) => [f.number, f.draft])).toEqual([
      [1, false],
      [2, true],
      [3, true],
    ]);
  });

  it('have their band pools and events', () => {
    for (const f of content.festivals) {
      expect(content.bands.filter((b) => b.festivals.includes(f.number)), `festival ${f.number} pool`).toHaveLength(
        f.bandPoolSize,
      );
    }
    expect(content.events.filter((e) => e.schedule.some((s) => s.festival === 3)).length).toBeGreaterThanOrEqual(5);
  });
});

describe('the data agrees with the rules and tuning', () => {
  it('R and the unit cost match the economy formulas', () => {
    for (const f of content.festivals) {
      const pt = fairTicketPrice(f.fairPrice, f.days);
      expect(fullScaleRevenue(f.capacity, pt), `${f.name} R`).toBeCloseTo(f.fullScaleRevenue);
      expect(facilityUnitCost(pt, f.facilityTypes.length), `${f.name} unit cost`).toBeCloseTo(f.unitCost);
    }
  });

  it('slots match the merch slot weights', () => {
    for (const f of content.festivals) {
      expect([...f.slots].sort(), `${f.name} slots`).toEqual(Object.keys(defaultTuning.merchSlotWeights[String(f.number)]!).sort());
    }
  });

  it('"Needs reputation N" matches the tier gate', () => {
    for (const b of content.bands) {
      const needs = /Needs reputation (\d+)/.exec(b.notes);
      if (needs) expect(Number(needs[1]), b.name).toBe(defaultTuning.negotiation.tierGate[b.tier - 1]);
    }
  });

  it('the thresholds written in the events match tuning.json', () => {
    const food = content.events.find((e) => e.id === 'food-stall-queue')!;
    expect(food.when).toContain(`${defaultTuning.economy.foodQueuePeak} x attendees`);
    const slow = content.events.find((e) => e.id === 'slow-sales')!;
    expect(slow.when).toContain(`below ${defaultTuning.decisions.slowSalesThreshold * 100}%`);
    const ignore = content.events.find((e) => e.id === 'noise-complaint')!.options.find((o) => o.risksFine)!;
    expect(ignore.label).toContain(`${defaultTuning.economy.noiseFineChance * 100}% chance of a fine of ${defaultTuning.economy.noiseFineShare * 100}% of R`);
  });
});

describe('the converter reports problems in the doc', () => {
  it('names a band with an unknown trend', () => {
    const broken = markdown.replace('| 4,200 | Steady |', '| 4,200 | Wobbly |');
    expect(() => convertContent(broken)).toThrow(/The Hedgerows.*unknown trend "wobbly"/);
  });

  it('names an email button with no action', () => {
    const broken = markdown.replace('| Open lineup |\n| 2 |', '| Open the pod bay doors |\n| 2 |');
    expect(() => convertContent(broken)).toThrow(/email 1 has a button "Open the pod bay doors"/);
  });

  it('names a missing section', () => {
    expect(() => convertContent(markdown.replace('## 7. Preparation timeline', '## 7. Timetable'))).toThrow(
      /can't find the "Preparation timeline" section/,
    );
  });

  it('picks up an edited number', () => {
    const edited = markdown.replace('| The Hedgerows | Folk | 1 | 15 | 10 | 20 | 4,200 | Steady | £300 |', '| The Hedgerows | Folk | 1 | 15 | 10 | 20 | 4,200 | Steady | £350 |');
    expect(convertContent(edited).bands.find((b) => b.id === 'the-hedgerows')!.feeAsk).toBe(350);
  });
});
