// The festival result and the newspaper review (spec section 8). Everything here is derived from
// the final game state, so a loaded save always shows the same review.

import { defaultContent, getBand, getEvent, getFacility, type Content } from './content';
import type { FestivalOutcome } from './economy';
import { bandGenerosity } from './economy';
import { fillTemplate, formatNumber, type TemplateVars } from './format';
import { budgetOf, festivalOf, liveOutcome, unitsOf, type GameState } from './game';
import { createRng, pick } from './random';
import {
  bandMoodLabel,
  bestArea,
  computeStars,
  festivalPassed,
  nextReputation,
  weakestArea,
  type BandMood,
  type StarArea,
  type Stars,
} from './stars';
import { defaultTuning, type Tuning } from './tuning';

export type ClosingKind = 'queues' | 'price' | 'bands' | 'money';

export interface Newspaper {
  paper: string;
  headline: string;
  opening: string;
  closing: string;
  /** One line about a big event, if one happened. */
  eventLine: string | null;
  /** One line about a prevented problem or a highlight, if there was one. */
  successLine: string | null;
  stats: { profit: number; attendance: number; bandMood: string; stars: number };
}

export interface FestivalResults {
  outcome: FestivalOutcome;
  forecast: FestivalOutcome | null;
  stars: Stars;
  passed: boolean;
  /** Cash after the festival; negative is a shortfall. */
  cashAfter: number;
  reputationBefore: number;
  reputationAfter: number;
  weakest: StarArea;
  best: StarArea;
  bandMood: BandMood;
  /** Up to three things that held the result back, biggest first. */
  causes: string[];
  /** One thing that went well. */
  wentWell: string;
  newspaper: Newspaper;
  randy: string[];
  /** Randy's basic tip on the weakest star, after a failed festival. */
  tip: string | null;
}

function headlinerName(state: GameState, c: Content): string | null {
  const b = state.lineup.headliner;
  return b ? getBand(c, b.bandId).name : null;
}

/** Which closing line fits the worst area: for customers, price if the ticket felt overpriced, else queues. */
export function closingKind(worst: StarArea, outcome: FestivalOutcome, ticketPrice: number): ClosingKind {
  if (worst === 'profit') return 'money';
  if (worst === 'bands') return 'bands';
  return ticketPrice > outcome.perceivedValue ? 'price' : 'queues';
}

/** The booked band with the lowest fee generosity, for the "looked like they'd rather be elsewhere" line. */
function unhappiestBand(state: GameState, c: Content, t: Tuning): string {
  const bookings = Object.values(state.lineup).filter((b) => b !== undefined);
  const worst = bookings.reduce<(typeof bookings)[number] | null>(
    (w, b) => (!w || bandGenerosity({ feePaid: b.fee, requiredFee: b.requiredFee }, t) < bandGenerosity({ feePaid: w.fee, requiredFee: w.requiredFee }, t) ? b : w),
    null,
  );
  return worst ? getBand(c, worst.bandId).name : 'The opening act';
}

/** The facility type with the fewest units, for the queue line. */
function shortestFacility(state: GameState, c: Content): string {
  const types = festivalOf(state, c).facilityTypes;
  const id = types.reduce((a, b) => (unitsOf(state, b) < unitsOf(state, a) ? b : a));
  return getFacility(c, id).plural;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface Cause {
  text: string;
  /** Rough size in points of satisfaction (or of profit as a share of spend). */
  weight: number;
}

/** Up to three causes, from the real values. */
function findCauses(state: GameState, outcome: FestivalOutcome, c: Content, t: Tuning): string[] {
  const s = t.satisfaction;
  const causes: Cause[] = [];
  if (outcome.queueRatio < 1) {
    causes.push({
      text: `Queues: the site could serve ${formatNumber(outcome.capacityServed)} of ${formatNumber(outcome.attendees)} people.`,
      weight: s.customerQueueWeight * (1 - outcome.queueRatio),
    });
  }
  if (outcome.fairPriceFactor < 1) {
    causes.push({
      text: `An overpriced ticket: £${formatNumber(state.ticketPrice)} against about £${formatNumber(outcome.perceivedValue)} that the lineup felt worth.`,
      weight: s.customerFairPriceWeight * (1 - outcome.fairPriceFactor),
    });
  }
  const empty = festivalOf(state, c).slots.filter((slot) => !state.lineup[slot]);
  if (empty.length > 0) {
    causes.push({ text: `An empty ${empty.join(' and ')} slot on the bill.`, weight: s.customerLineupWeight * (1 - outcome.lineup) });
  }
  if (outcome.generosity < 0.5 && Object.keys(state.lineup).length > 0) {
    causes.push({ text: 'Bands paid below what they wanted.', weight: s.bandGenerosityWeight * (0.5 - outcome.generosity) });
  }
  for (const ch of state.day?.choices ?? []) {
    const hit = -(ch.effect.customerDelta + ch.effect.bandDelta);
    if (hit <= 0) continue;
    const event = getEvent(c, ch.eventId);
    const option = event.options.find((o) => o.key === ch.option);
    causes.push({ text: `${event.title}: "${option?.label ?? ch.option}" cost you goodwill.`, weight: hit });
  }
  for (const ch of state.day?.choices ?? []) {
    if (ch.effect.fined) causes.push({ text: `A £${formatNumber(ch.effect.fine)} noise fine.`, weight: outcome.spend > 0 ? ch.effect.fine / outcome.spend : 0 });
  }
  if (outcome.profit < 0) {
    causes.push({ text: `Spend of £${formatNumber(outcome.spend)} against income of £${formatNumber(outcome.income)}.`, weight: -outcome.profitPct });
  }
  return causes
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((cause) => cause.text);
}

function successKey(state: GameState, outcome: FestivalOutcome, c: Content, t: Tuning): keyof Content['newspaper']['success'] | null {
  if (outcome.attendance >= 1) return 'soldOut';
  const prevented = state.day?.prevented ?? [];
  if (prevented.includes('food-queue')) return 'noQueue';
  const limiter = state.decisions.some((d) => d.eventId === 'sound-limiter' && d.option === 'A');
  if (limiter && prevented.includes('noise-complaint')) return 'limiter';
  if (headlinerName(state, c) && bandMoodLabel(outcome.bandSatisfaction, t) === 'delighted') return 'headlinerDelighted';
  return null;
}

function wentWell(state: GameState, outcome: FestivalOutcome, best: StarArea, c: Content): string {
  const prevented = state.day?.prevented ?? [];
  if (prevented.length > 0) {
    return prevented.map((id) => `${getEvent(c, id).title}: avoided thanks to your planning.`).join(' ');
  }
  if (best === 'profit') return `Takings: a profit of £${formatNumber(outcome.profit)}.`;
  if (best === 'customers') return `The crowd: ${Math.round(outcome.customerSatisfaction * 100)}% happy.`;
  return `The bands: ${Math.round(outcome.bandSatisfaction * 100)}% happy.`;
}

/** The result of a finished festival, with its newspaper review. */
export function festivalResults(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): FestivalResults {
  const f = festivalOf(state, c);
  const outcome = liveOutcome(state, c, t);
  const stars = computeStars(outcome, f.targets);
  const cashAfter = budgetOf(state, c) + outcome.profit;
  const passed = festivalPassed(stars, cashAfter);
  const weakest = weakestArea(outcome, f.targets);
  const best = bestArea(outcome, f.targets);
  const mood = bandMoodLabel(outcome.bandSatisfaction, t);
  const repDelta = (state.day?.choices ?? []).reduce((a, ch) => a + ch.effect.reputationDelta, 0);
  const n = c.newspaper;

  const headliner = headlinerName(state, c);
  const closing = closingKind(weakest, outcome, state.ticketPrice);
  const fine = (state.day?.choices ?? []).reduce((a, ch) => a + ch.effect.fine, 0);
  const vars: TemplateVars = {
    festival: f.name,
    headliner: headliner ?? 'The headliner',
    weakest_issue: n.weakestIssue[closing],
    weakest_issue_cap: capitalise(n.weakestIssue[closing]),
    facility: shortestFacility(state, c),
    price: formatNumber(state.ticketPrice),
    band_name: unhappiestBand(state, c, t),
    fine: formatNumber(fine),
  };

  // The headline variant is seeded from the game, so it never changes for the same festival.
  const options = (n.headlines[String(stars.count)] ?? []).filter((h) => headliner || !h.includes('{headliner}'));
  const headline = options.length ? pick(createRng(state.seed + state.attempt), options).value : f.name;
  const success = successKey(state, outcome, c, t);

  const randy = [fillTemplate(c.lines.results.intro, { stars: String(stars.count) }), passed ? c.lines.results.passed : c.lines.results.failed];

  return {
    outcome,
    forecast: state.forecastAtGates,
    stars,
    passed,
    cashAfter,
    reputationBefore: state.reputation,
    reputationAfter: nextReputation(state.reputation, outcome.customerSatisfaction, outcome.bandSatisfaction, repDelta, t),
    weakest,
    best,
    bandMood: mood,
    causes: findCauses(state, outcome, c, t),
    wentWell: wentWell(state, outcome, best, c),
    newspaper: {
      paper: n.papers[String(f.number)] ?? f.newspaper,
      headline: fillTemplate(headline, vars),
      opening: n.opening[best],
      closing: fillTemplate(n.closing[closing], vars),
      eventLine: fine > 0 ? fillTemplate(n.events.noiseFine, vars) : null,
      successLine: success ? fillTemplate(n.success[success], vars) : null,
      stats: { profit: outcome.profit, attendance: outcome.attendees, bandMood: n.bandMood[mood], stars: stars.count },
    },
    randy,
    tip: passed ? null : c.lines.tips[weakest],
  };
}
