// Turns docs/CONTENT.md into the game's JSON content. Run with `npm run content`.
// Errors name the table and row, so a typo in the doc is easy to find.

import type {
  Band,
  ClosingIssue,
  Content,
  EmailButton,
  EmailTemplate,
  EventOptionContent,
  Facility,
  Festival,
  FestivalTimeline,
  GameEvent,
  Line,
  Lines,
  Newspaper,
  SalesWindow,
  ScheduleEntry,
  Timeline,
  TimelineMoment,
  Trend,
} from '../../src/core/content';
import type { OptionKey } from '../../src/core/events';
import {
  amount,
  camel,
  cell,
  festivalNumbers,
  onlyTable,
  percent,
  prose,
  section,
  sections,
  slug,
  tables,
  unquote,
  type Row,
  type Section,
} from './markdown.ts';
import * as structure from './structure.ts';

export function convertContent(markdown: string): Content {
  const all = sections(markdown);
  const draftFestivals = parseDrafts(markdown);
  const bands = parseBands(section(all, 'Bands'));
  const { festivals, facilities } = parseFestivals(section(all, 'Festivals'), draftFestivals);
  const dayEvents = parseDayEvents(section(all, 'Events and decisions'), festivals.length);
  const prepDecisions = parsePrepDecisions(section(all, 'Preparation decisions'), dayEvents);
  return {
    bands,
    festivals,
    facilities,
    events: [...dayEvents, ...prepDecisions],
    emails: parseEmails(section(all, 'Inbox emails')),
    lines: parseLines(all),
    newspaper: parseNewspaper(section(all, 'Newspaper review templates')),
    timeline: parseTimeline(section(all, 'Preparation timeline')),
  };
}

/** "Festivals 2 and 3 are drafts" in the introduction. */
function parseDrafts(markdown: string): number[] {
  const match = /Festivals? ([\d ,and]+?) (?:are|is) drafts?/.exec(markdown);
  return match ? festivalNumbers(match[1]!) : [];
}

// Bands

const trends: Record<string, Trend> = {
  steady: 'steady',
  rising: 'rising',
  'rising fast': 'risingFast',
  falling: 'falling',
};

function parseBands(lines: string[]): Band[] {
  const intro = prose(lines);
  const emergingMatch = /Emerging bands: (.+?)\./.exec(intro);
  if (!emergingMatch) throw new Error('CONTENT.md: the Bands section must list "Emerging bands: ..."');
  const emerging = emergingMatch[1]!.split(/, | and /).map((name) => name.trim());

  const { rows } = onlyTable(lines, 'Bands');
  const bands = rows.map((row): Band => {
    const what = 'Bands';
    const name = cell(row, 0, what);
    const trendText = cell(row, 7, what).toLowerCase();
    const trend = trends[trendText];
    if (!trend) throw new Error(`CONTENT.md: band "${name}" has an unknown trend "${trendText}"`);
    const festivalsText = cell(row, 10, what);
    return {
      id: slug(name),
      name,
      genre: cell(row, 1, what),
      tier: amount(cell(row, 2, what), `${name} tier`),
      reputation: amount(cell(row, 3, what), `${name} reputation`),
      legacy: amount(cell(row, 4, what), `${name} legacy`),
      hype: amount(cell(row, 5, what), `${name} hype`),
      monthlyListeners: amount(cell(row, 6, what), `${name} monthly listeners`),
      trend,
      feeAsk: amount(cell(row, 8, what), `${name} fee ask`),
      merchAsk: amount(cell(row, 9, what), `${name} merch ask`),
      festivals: festivalNumbers(festivalsText),
      stretch: /stretch/i.test(festivalsText),
      emerging: emerging.includes(name),
      notes: cell(row, 11, what),
    };
  });
  for (const name of emerging) {
    if (!bands.some((b) => b.name === name)) throw new Error(`CONTENT.md: emerging band "${name}" isn't in the Bands table`);
  }
  return bands;
}

// Festivals and facilities

function parseFestivals(lines: string[], drafts: number[]): { festivals: Festival[]; facilities: Facility[] } {
  const { header, rows } = onlyTable(lines, 'Festivals');
  const item = (label: string): Row => {
    const row = rows.find((r) => r[0]?.startsWith(label));
    if (!row) throw new Error(`CONTENT.md: the Festivals table needs a "${label}" row`);
    return row;
  };
  const firstFestival = new Map<string, number>();

  const festivals = header.slice(1).map((title, i): Festival => {
    const col = i + 1;
    const match = /Festival (\d+): (.+)/.exec(title);
    if (!match) throw new Error(`CONTENT.md: festival column "${title}" should read "Festival N: Name"`);
    const number = Number(match[1]);
    const name = match[2]!.trim();
    const value = (label: string) => cell(item(label), col, `Festivals "${label}"`);
    const what = (label: string) => `${name} ${label}`;

    const stagesText = value('Stages and slots');
    const stages = /second stage|two stages|main and second/i.test(stagesText) ? 2 : 1;
    const slotCount = amount(/(\d+) slots/.exec(stagesText)?.[1] ?? '', what('slots')) * (/each/.test(stagesText) ? stages : 1);
    const slots = structure.slotIds[number];
    if (!slots || slots.length !== slotCount) {
      throw new Error(`CONTENT.md: ${name} has ${slotCount} slots but scripts/content/structure.ts lists ${slots?.length ?? 0}`);
    }

    const facilitiesText = value('Facilities');
    const [namesText, costText] = facilitiesText.split(/,\s*(?=£)/);
    const facilityTypes = (namesText ?? '').split(/,\s*|\s+and\s+/).map((n) => facilityId(n, name));
    for (const id of facilityTypes) if (!firstFestival.has(id)) firstFestival.set(id, number);

    const targets = [...value('Targets').matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100);
    if (targets.length !== 3) throw new Error(`CONTENT.md: ${name} targets should be three percentages`);
    const startingCash = /starting cash/i.test(value('Budget')) ? amount(value('Budget'), what('budget')) : null;
    const reputationText = value('Starting reputation');

    return {
      id: structure.festivalIds[number] ?? slug(name),
      number,
      name,
      draft: drafts.includes(number),
      capacity: amount(value('Capacity'), what('capacity')),
      days: amount(value('Days'), what('days')),
      fairPrice: amount(value('Fair ticket price'), what('fair ticket price')),
      fullScaleRevenue: amount(value('Full-scale ticket revenue'), what('R')),
      startingCash,
      budgetNote: value('Budget'),
      stages,
      slots,
      facilityTypes,
      unitCost: amount(costText ?? '', what('unit cost')),
      bandPoolSize: amount(value('Band pool'), what('band pool')),
      startingReputation: /\d/.test(reputationText) ? amount(reputationText, what('starting reputation')) : null,
      targets: { customers: targets[0]!, bands: targets[1]!, profit: targets[2]! },
      decisionCount: amount(value('Decisions on the day'), what('decisions')),
      decisionNote: value('Decisions on the day').replace(/^\d+:\s*/, ''),
      prepDays: amount(value('Preparation days'), what('preparation days')),
      newspaper: value('Newspaper'),
      referencePlan: value('Reference plan'),
    };
  });

  const facilities = structure.facilities
    .filter((f) => firstFestival.has(f.id))
    .map(({ names: _names, ...f }): Facility => ({ ...f, firstFestival: firstFestival.get(f.id)! }));
  return { festivals, facilities };
}

function facilityId(text: string, festival: string): string {
  const name = text.trim().toLowerCase();
  const found = structure.facilities.find((f) => f.names.includes(name));
  if (!found) throw new Error(`CONTENT.md: ${festival} lists an unknown facility "${text}" (add it to scripts/content/structure.ts)`);
  return found.id;
}

// Events and preparation decisions

/** Group rows into records: a row with a first cell starts a record, blank first cells continue it. */
function records(rows: Row[]): Row[][] {
  const result: Row[][] = [];
  for (const row of rows) {
    if (row[0]) result.push([row]);
    else if (result.length) result[result.length - 1]!.push(row);
    else throw new Error(`CONTENT.md: a table starts with a continuation row "${row.join(' | ')}"`);
  }
  return result;
}

function optionKey(text: string, event: string): OptionKey {
  if (text === 'A' || text === 'B' || text === 'C') return text;
  throw new Error(`CONTENT.md: event "${event}" has an option "${text}" (expected A, B or C)`);
}

function points(text: string, what: string): number {
  return Math.round(amount(text, what));
}

function parseDayEvents(lines: string[], festivalCount: number): GameEvent[] {
  const { rows } = onlyTable(lines, 'Events');
  return records(rows).map((group): GameEvent => {
    const first = group[0]!;
    const what = 'Events';
    const name = cell(first, 0, what);
    const id = slug(name);
    const when = cell(first, 2, what);
    const options = group.map((row): EventOptionContent => {
      const label = cell(row, 4, what);
      const costText = cell(row, 5, what);
      const risksFine = /chance of a fine/i.test(label);
      const option: EventOptionContent = {
        key: optionKey(cell(row, 3, what), name),
        label,
        effect: null,
        costShareR: risksFine ? 0 : percent(costText, `${name} cost`),
        customers: points(cell(row, 6, what), `${name} customers`),
        bands: points(cell(row, 7, what), `${name} bands`),
        reputation: points(cell(row, 8, what), `${name} reputation`),
      };
      if (risksFine) option.risksFine = true;
      return option;
    });
    return {
      id,
      name,
      phase: 'day',
      from: null,
      when,
      schedule: daySchedule(id, cell(first, 1, what), when, festivalCount),
      options,
    };
  });
}

/**
 * Read "When" text such as "Scripted at festival 2 (evening); random at festival 3 (50%)".
 * Each clause applies to the festivals it names, or to the festivals not yet covered.
 */
function daySchedule(id: string, festivalText: string, when: string, festivalCount: number): ScheduleEntry[] {
  let remaining = festivalNumbers(festivalText);
  if (/then/i.test(festivalText)) {
    const start = remaining[0] ?? 1;
    remaining = Array.from({ length: festivalCount - start + 1 }, (_, i) => start + i);
  }
  const entries: ScheduleEntry[] = [];
  for (const clause of when.split(';')) {
    const named = [...clause.matchAll(/festivals? ([\d ,and]+)/gi)].flatMap((m) => festivalNumbers(m[1]!));
    const applies = named.length ? named : remaining;
    remaining = remaining.filter((n) => !applies.includes(n));
    const chanceMatch = /\((\d+)%\)/.exec(clause);
    const chance = chanceMatch ? Number(chanceMatch[1]) / 100 : null;
    const kind = /scripted/i.test(clause) || chance === null ? 'scripted' : 'random';
    const time = structure.timesOfDay.find(([phrase]) => clause.toLowerCase().includes(phrase));
    for (const festival of applies) {
      entries.push({
        festival,
        kind,
        chance,
        at: time ? time[1] : null,
        day: null,
        condition: structure.eventConditions[id] ?? null,
      });
    }
  }
  return entries;
}

function parsePrepDecisions(lines: string[], dayEvents: GameEvent[]): GameEvent[] {
  const { rows } = onlyTable(lines, 'Preparation decisions');
  return records(rows).map((group): GameEvent => {
    const first = group[0]!;
    const what = 'Preparation decisions';
    const name = cell(first, 0, what);
    const id = slug(name);
    const when = cell(first, 2, what);
    const options = group.map((row): EventOptionContent => {
      const label = cell(row, 4, what);
      const effect = cell(row, 6, what);
      const option: EventOptionContent = {
        key: optionKey(cell(row, 3, what), name),
        label,
        effect,
        costShareR: percent(cell(row, 5, what), `${name} cost`),
        customers: signedPoints(effect, 'customers'),
        bands: signedPoints(effect, 'bands'),
        reputation: signedPoints(effect, 'reputation'),
      };
      const prevents = preventedEvents(effect, dayEvents);
      if (prevents.length) option.prevents = prevents;
      const attendance = /attendance \+(\d+) points/i.exec(effect);
      if (attendance) option.attendanceBonus = Number(attendance[1]) / 100;
      const priceCut = /by (\d+(?:\.\d+)?)% of the fair price/i.exec(label);
      if (priceCut) option.priceCutShareOfFair = Number(priceCut[1]) / 100;
      return option;
    });
    const schedule: ScheduleEntry[] = [...when.matchAll(/festivals? ([\d ,and]+?):? day (\d+)/gi)].flatMap((m) =>
      festivalNumbers(m[1]!).map((festival) => ({
        festival,
        kind: 'scripted' as const,
        chance: null,
        at: null,
        day: Number(m[2]),
        condition: structure.eventConditions[id] ?? null,
      })),
    );
    if (!schedule.length) throw new Error(`CONTENT.md: decision "${name}" needs "festival N: day D" in its When column`);
    return { id, name, phase: 'prep', from: cell(first, 1, what), when, schedule, options };
  });
}

/** "Bands -3" in an effect -> -3. */
function signedPoints(effect: string, label: string): number {
  const match = new RegExp(`${label} ([+-]\\d+)`, 'i').exec(effect);
  return match ? Number(match[1]) : 0;
}

/** Events named before "cannot happen" (by full name, or by its last word: "the complaint"). */
function preventedEvents(effect: string, events: GameEvent[]): string[] {
  const text = effect.toLowerCase();
  if (!text.includes('cannot happen')) return [];
  return events
    .filter((e) => {
      const name = e.name.toLowerCase();
      const lastWord = name.split(' ').pop()!;
      return text.includes(`${name} cannot happen`) || text.includes(`${lastWord} cannot happen`);
    })
    .map((e) => e.id);
}

// Emails

function parseEmails(lines: string[]): EmailTemplate[] {
  const { rows } = onlyTable(lines, 'Inbox emails');
  return rows.map((row): EmailTemplate => {
    const what = 'Inbox emails';
    const number = amount(cell(row, 0, what), 'email number');
    const shape = structure.emails[number];
    if (!shape) throw new Error(`CONTENT.md: email ${number} needs an id and trigger in scripts/content/structure.ts`);
    const message = cell(row, 4, what);
    const quoted = /^"(.*)"\s*(.*)$/.exec(message);
    const labels = cell(row, 5, what).split(/,\s*/);
    const buttons = labels.map((label, i): EmailButton => {
      if (shape.trigger.type === 'event') {
        return { label, action: { type: 'option', option: optionKey('ABC'[i] ?? '', `email ${number}`) } };
      }
      const action = structure.buttonActions[label];
      if (!action) throw new Error(`CONTENT.md: email ${number} has a button "${label}" with no action in scripts/content/structure.ts`);
      return { label, action };
    });
    return {
      id: shape.id,
      number,
      from: cell(row, 1, what),
      when: cell(row, 2, what),
      subject: cell(row, 3, what),
      body: quoted ? quoted[1]! : null,
      note: quoted ? quoted[2]!.replace(/^\((.*)\)$/, '$1') || null : message,
      buttons,
      trigger: shape.trigger,
      festivals: shape.festivals ?? null,
    };
  });
}

// Randy's lines

function lineIds(whens: string[]): string[] {
  const short = whens.map((w) => slug(w.replace(/\s*\(.*?\)\s*/g, ' ')));
  return whens.map((w, i) => (short.filter((s) => s === short[i]).length > 1 ? slug(w) : short[i]!));
}

function lineRows(rows: Row[], what: string, withStep: boolean): Line[] {
  const whenCol = withStep ? 1 : 0;
  const whens = rows.map((r) => cell(r, whenCol, what));
  const ids = lineIds(whens);
  return rows.map((row, i) => ({
    id: ids[i]!,
    step: withStep ? cell(row, 0, what) : null,
    when: whens[i]!,
    text: unquote(cell(row, whenCol + 1, what)),
  }));
}

function parseLines(all: Section[]): Lines {
  const tutorial = onlyTable(section(all, 'Festival 1 tutorial lines'), 'Festival 1 tutorial lines');
  const festival2 = onlyTable(section(all, 'Festival 2 lines'), 'Festival 2 lines');
  const festival3Tables = tables(section(all, 'Festival 3 lines'));
  if (festival3Tables.length !== 2) throw new Error('CONTENT.md: Festival 3 lines should have two tables (lines, then event lines)');
  const tips = onlyTable(section(all, 'Basic tip after a failed festival'), 'Basic tip');
  const tip = (label: string) => {
    const row = tips.rows.find((r) => r[0]?.toLowerCase() === label);
    if (!row) throw new Error(`CONTENT.md: the basic tip table needs a "${label}" row`);
    return unquote(cell(row, 1, 'Basic tip'));
  };
  return {
    tutorial: lineRows(tutorial.rows, 'Festival 1 tutorial lines', true),
    festival2: lineRows(festival2.rows, 'Festival 2 lines', false),
    festival3: lineRows(festival3Tables[0]!.rows, 'Festival 3 lines', false),
    events: lineRows(festival3Tables[1]!.rows, 'Festival 3 event lines', false),
    tips: { profit: tip('profit'), customers: tip('customers'), bands: tip('bands') },
  };
}

// Newspaper

/** 'Label: "text" Label: "text"' -> { label: text }, plus any text after the last quote. */
function labelledQuotes(text: string): { parts: Record<string, string>; rest: string } {
  const parts: Record<string, string> = {};
  let end = 0;
  for (const m of text.matchAll(/([A-Z][^:"]*?):\s*"([^"]*)"/g)) {
    parts[camel(m[1]!)] = m[2]!;
    end = m.index + m[0].length;
  }
  return { parts, rest: text.slice(end).trim() };
}

function parseNewspaper(lines: string[]): Newspaper {
  const intro = prose(lines);
  const papers: Record<string, string> = {};
  for (const m of intro.matchAll(/(The [A-Z][\w ]+?) \(festival (\d+)\)/g)) papers[m[2]!] = m[1]!;

  const [headlineTable, partsTable] = tables(lines);
  if (!headlineTable || !partsTable) throw new Error('CONTENT.md: the newspaper section needs a headline table and a parts table');
  const headlines: Record<string, string[]> = {};
  for (const row of headlineTable.rows) {
    headlines[String(amount(cell(row, 0, 'Headlines'), 'stars'))] = cell(row, 1, 'Headlines')
      .split(/"\s+or\s+"/)
      .map(unquote)
      .map((h) => h.replace(/^"|"$/g, ''));
  }
  const part = (label: string) => {
    const row = partsTable.rows.find((r) => r[0]?.startsWith(label));
    if (!row) throw new Error(`CONTENT.md: the newspaper parts table needs a "${label}" row`);
    return cell(row, 1, 'Newspaper parts');
  };

  const closing = labelledQuotes(part('Closing')).parts;
  const closingKeys = Object.keys(closing);
  const issuesMatch = /\{weakest_issue\} comes from the weakest star: (.+?)\.?$/.exec(intro);
  if (!issuesMatch) throw new Error('CONTENT.md: the newspaper section must say what {weakest_issue} comes from');
  const issues = issuesMatch[1]!.split(/,\s*|\s+or\s+/);
  if (issues.length !== closingKeys.length) throw new Error('CONTENT.md: {weakest_issue} needs one phrase per closing line');
  const weakestIssues = Object.fromEntries(closingKeys.map((k, i) => [k, issues[i]!])) as Record<ClosingIssue, string>;

  const success = labelledQuotes(part('Success'));
  const spotlightText = part('Spotlight');
  const growth = /Growth events: (.+?)\.?$/.exec(spotlightText);
  const statsBox = part('Stats box');
  const moods = /\(([^)]+)\)/.exec(statsBox)?.[1]?.split(/,\s*|\s+or\s+/) ?? [];
  if (moods.length !== 4) throw new Error('CONTENT.md: the stats box should list four band moods in brackets');

  return {
    papers,
    weakestIssues,
    headlines,
    opening: labelledQuotes(part('Opening')).parts as Newspaper['opening'],
    closing: closing as Newspaper['closing'],
    events: labelledQuotes(part('Event line')).parts,
    success: success.parts,
    successNote: success.rest,
    spotlight: {
      template: /"([^"]+)"/.exec(spotlightText)?.[1] ?? '',
      growthEvents: growth ? growth[1]!.split(/,\s*(?:or\s+)?/) : [],
    },
    statsBox,
    moodLabels: { delighted: moods[0]!, happy: moods[1]!, grumbling: moods[2]!, furious: moods[3]! },
  };
}

// Timeline

function parseTimeline(lines: string[]): Timeline {
  const [festivalTable, salesTable] = tables(lines);
  if (!festivalTable || !salesTable) throw new Error('CONTENT.md: the timeline section needs a festival table and a ticket sales table');

  const festivals = festivalTable.rows.map((row): FestivalTimeline => {
    const what = 'Preparation timeline';
    const festival = amount(cell(row, 0, what), 'festival');
    const text = cell(row, 2, what);
    const moments: TimelineMoment[] = [];
    let inheritsFrom: number | null = null;
    for (const sentence of text.split(/(?<=[."])\s+(?=[A-Z])/)) {
      const inherits = /Otherwise as festival (\d+)/i.exec(sentence);
      if (inherits) {
        inheritsFrom = Number(inherits[1]);
        continue;
      }
      const days = [...sentence.matchAll(/\bdays? ((?:\d+(?:, | and )?)+)/gi)].flatMap((m) => festivalNumbers(m[1]!));
      const lower = sentence.toLowerCase();
      const ids = structure.moments.filter(([phrase]) => lower.includes(phrase)).map(([, id]) => id);
      for (const id of ids.length ? ids : [slug(sentence.replace(/^Day \d+:\s*/i, ''))]) {
        moments.push({ id, days, text: sentence.replace(/\.$/, '') });
      }
    }
    return { festival, prepDays: amount(cell(row, 1, what), 'preparation days'), moments, inheritsFrom, text };
  });

  const salesCurve = salesTable.rows.map((row): SalesWindow => {
    const label = cell(row, 0, 'Ticket sales');
    const numbers = [...label.matchAll(/\d+/g)].map((m) => Number(m[0]));
    let from: number | null;
    let to: number;
    if (/^on sale/i.test(label)) [from, to] = [null, numbers[0] ?? 0];
    else if (/^last/i.test(label)) [from, to] = [numbers[0] ?? 0, 0];
    else if (/on the day/i.test(label)) [from, to] = [0, 0];
    else [from, to] = [numbers[0] ?? 0, numbers[1] ?? 0];
    return { label, from, to, share: percent(cell(row, 1, 'Ticket sales'), label) };
  });

  const rules = lines.filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, '').trim());
  return { festivals, salesCurve, rules };
}
