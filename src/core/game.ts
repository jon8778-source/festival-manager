// The game state and the reducer that changes it. Every player input is an action; the state
// is plain JSON so it can be saved, replayed and logged. It covers preparation and the festival day.

import {
  facilityDeadlinePassed,
  isStopDay,
  lineupLocked,
  ticketsSoldByDay,
} from './calendar';
import {
  bandPool,
  defaultContent,
  festivalTimeline,
  getBand,
  getEmail,
  getEvent,
  getFacility,
  getFestival,
  type Band,
  type Content,
  type EmailTemplate,
  type Festival,
} from './content';
import {
  emergencyUnitCost,
  evaluateFestival,
  facilityUnitCost,
  fairTicketPrice,
  fullScaleRevenue,
  overhead,
  type BookedBand,
  type FestivalOutcome,
} from './economy';
import { combineEffects, resolveOption, type OptionEffect, type OptionKey } from './events';
import { advanceClock, newDay, recordChoice, type DayState, type ScheduledEvent } from './festivalDay';
import { fillTemplate, formatNumber, type TemplateVars } from './format';
import { clamp, sum } from './math';
import {
  acceptCounter as acceptCounterTalks,
  adjustedRequiredFee,
  gateOpen,
  marketRateHint,
  newTalks,
  requiredFee,
  respond,
  walkAway as walkAwayTalks,
  type BandProfile,
  type CounterTerm,
  type Offer,
  type Response,
  type Slot,
  type Talks,
} from './negotiation';
import { createRng, nextInt, type RngState } from './random';
import { computeStars, type Stars } from './stars';
import { cueLines, dismissLine, newTutorial, skipTutorial, type TutorialState } from './tutorial';
import { defaultTuning, type Tuning } from './tuning';

export const GAME_TITLE = 'Festival Manager';
export const SAVE_VERSION = 1;

export interface Booking extends Offer {
  bandId: string;
  /** The band's ask at festival reputation, for lineup quality. */
  askAtRep: number;
  /** Required fee after the slot, merch and emerging adjustments, for fee generosity. */
  requiredFee: number;
}

export interface OfferRound {
  offer: Offer;
  score: number;
  result: Response['kind'];
  day: number;
}

export interface PendingCounter {
  offer: Offer;
  term: CounterTerm;
  /** The counter lapses once days to gates drop below this. */
  expiresDay: number;
}

export interface BandTalks extends Talks {
  counter: PendingCounter | null;
  rounds: OfferRound[];
}

export interface Plot {
  facilityId: string;
  paid: number;
  emergency: boolean;
}

export interface Email {
  id: string;
  templateId: string;
  /** Days to gates when it arrived. */
  day: number;
  vars: TemplateVars;
  read: boolean;
  /** Its buttons have been used, or it no longer applies. */
  done: boolean;
  bandId?: string;
  decision?: { eventId: string; chosen: OptionKey | null };
}

export interface PrepDecision {
  eventId: string;
  option: OptionKey;
  effect: OptionEffect;
  day: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: RngState;
  festivalId: string;
  attempt: number;
  /** 'results' once the festival day ends at midnight. */
  phase: 'prep' | 'day' | 'results';
  /** Festival reputation, 0 to 100. */
  reputation: number;
  daysToGates: number;
  ticketPrice: number;
  /** A new price takes effect from the next day. */
  pendingTicketPrice: number | null;
  ticketsSold: number;
  talks: Record<string, BandTalks>;
  lineup: Partial<Record<Slot, Booking>>;
  plots: (Plot | null)[];
  /** Facility ids booked today, for the booking confirmation email. */
  bookedToday: string[];
  inbox: Email[];
  emailSeq: number;
  /** Template ids sent so far, for emails sent at most once. */
  sent: string[];
  decisions: PrepDecision[];
  tutorial: TutorialState;
  /** Why the last action did nothing, for the screen to show. */
  notice: string | null;
  /** Forecast stored when the gates open, for the results screen. */
  forecastAtGates: FestivalOutcome | null;
  /** The festival day, from the gates opening. */
  day: DayState | null;
}

export type GameAction =
  | { type: 'continue' }
  | { type: 'openScreen'; screen: string; bandId?: string }
  | { type: 'submitOffer'; bandId: string; offer: Offer }
  | { type: 'acceptCounter'; bandId: string }
  | { type: 'walkAway'; bandId: string }
  | { type: 'placeFacility'; plot: number; facilityId: string }
  | { type: 'removeFacility'; plot: number }
  | { type: 'setTicketPrice'; price: number }
  | { type: 'readEmail'; emailId: string }
  | { type: 'dismissEmail'; emailId: string }
  | { type: 'chooseDecision'; emailId: string; option: OptionKey }
  | { type: 'dismissLine' }
  | { type: 'skipTutorial' }
  | { type: 'openGates' }
  | { type: 'tick'; realSeconds: number }
  | { type: 'setSpeed'; speed: number }
  | { type: 'chooseOption'; option: OptionKey }
  | { type: 'replay' };

// ---------------------------------------------------------------- derived values

export function festivalOf(state: GameState, c: Content = defaultContent): Festival {
  return getFestival(c, state.festivalId);
}

export function revenueAtScale(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): number {
  const f = festivalOf(state, c);
  return fullScaleRevenue(f.capacity, fairTicketPrice(f.fairPrice, f.days, t));
}

export function profileOf(band: Band): BandProfile {
  return { tier: band.tier, reputation: band.reputation, feeAsk: band.feeAsk, merchAsk: band.merchAsk, emerging: band.emerging };
}

export function talksFor(state: GameState, bandId: string, t: Tuning = defaultTuning): BandTalks {
  return state.talks[bandId] ?? { ...newTalks(t), counter: null, rounds: [] };
}

export function bookingSlot(state: GameState, bandId: string): Slot | null {
  const entry = Object.entries(state.lineup).find(([, b]) => b?.bandId === bandId);
  return entry ? (entry[0] as Slot) : null;
}

export function openSlots(state: GameState, c: Content = defaultContent): Slot[] {
  return festivalOf(state, c).slots.filter((s) => !state.lineup[s]);
}

/** Units of each facility type in play, in the festival's order. */
export function facilityUnits(state: GameState, c: Content = defaultContent): number[] {
  return festivalOf(state, c).facilityTypes.map((id) => state.plots.filter((p) => p?.facilityId === id).length);
}

export function unitsOf(state: GameState, facilityId: string): number {
  return state.plots.filter((p) => p?.facilityId === facilityId).length;
}

export function normalUnitCost(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): number {
  const f = festivalOf(state, c);
  return facilityUnitCost(fairTicketPrice(f.fairPrice, f.days, t), f.facilityTypes.length, t);
}

/** What the next unit costs today: the normal price until the deadline, then emergency units. */
export function nextUnitCost(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): number {
  const unit = normalUnitCost(state, c, t);
  return isEmergencyPricing(state, c) ? emergencyUnitCost(unit, t) : unit;
}

export function isEmergencyPricing(state: GameState, c: Content = defaultContent): boolean {
  return facilityDeadlinePassed(state.daysToGates, festivalTimeline(c, festivalOf(state, c)));
}

export function isLineupLocked(state: GameState, c: Content = defaultContent): boolean {
  return lineupLocked(state.daysToGates, festivalTimeline(c, festivalOf(state, c)));
}

/** The price the plan uses: the pending price if one is set. */
export function planTicketPrice(state: GameState): number {
  return state.pendingTicketPrice ?? state.ticketPrice;
}

export interface SpendSoFar {
  overhead: number;
  lineup: number;
  facilities: number;
  decisions: number;
  total: number;
}

/** Money committed during preparation. The overhead is committed from the first day. */
export function spendSoFar(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): SpendSoFar {
  const fixed = overhead(revenueAtScale(state, c, t), t);
  const lineup = sum(Object.values(state.lineup).map((b) => b?.fee ?? 0));
  const facilities = sum(state.plots.map((p) => p?.paid ?? 0));
  const decisions = sum(state.decisions.map((d) => d.effect.cost));
  return { overhead: fixed, lineup, facilities, decisions, total: fixed + lineup + facilities + decisions };
}

export function budgetOf(state: GameState, c: Content = defaultContent): number {
  return festivalOf(state, c).startingCash;
}

export function cashOf(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): number {
  return budgetOf(state, c) - spendSoFar(state, c, t).total;
}

export function bookedBands(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): BookedBand[] {
  const weights = t.merchSlotWeights[String(festivalOf(state, c).number)] ?? {};
  return Object.entries(state.lineup).flatMap(([slot, b]) =>
    b
      ? [{ feePaid: b.fee, requiredFee: b.requiredFee, askAtReputation: b.askAtRep, merchPct: b.merchPct, slotWeight: weights[slot] ?? 0 }]
      : [],
  );
}

/** The live "Forecast before events": the current plan through the core formulas. */
export function forecastOf(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): FestivalOutcome {
  return outcomeWith(state, state.decisions.map((d) => d.effect), c, t);
}

/** The festival as it stands on the day: the plan plus every festival-day choice so far. */
export function liveOutcome(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): FestivalOutcome {
  const dayEffects = state.day?.choices.map((ch) => ch.effect) ?? [];
  return outcomeWith(state, [...state.decisions.map((d) => d.effect), ...dayEffects], c, t);
}

export function liveStars(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): Stars {
  return computeStars(liveOutcome(state, c, t), festivalOf(state, c).targets);
}

function outcomeWith(state: GameState, effects: OptionEffect[], c: Content, t: Tuning): FestivalOutcome {
  const f = festivalOf(state, c);
  return evaluateFestival(
    {
      capacity: f.capacity,
      fairPrice: f.fairPrice,
      days: f.days,
      reputation: state.reputation,
      ticketPrice: planTicketPrice(state),
      bands: bookedBands(state, c, t),
      facilityUnits: facilityUnits(state, c),
      foodUnits: unitsOf(state, 'food'),
      facilitiesCost: spendSoFar(state, c, t).facilities,
      events: combineEffects(effects),
    },
    t,
  );
}

export function forecastStars(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): Stars {
  const fc = forecastOf(state, c, t);
  return computeStars(fc, festivalOf(state, c).targets);
}

export function pendingDecisionEmail(state: GameState): Email | undefined {
  return state.inbox.find((e) => e.decision && e.decision.chosen === null);
}

export function unreadCount(state: GameState): number {
  return state.inbox.filter((e) => !e.read).length;
}

/** Randy's market-rate hint for a band at this festival. */
export function hintFor(state: GameState, band: Band, t: Tuning = defaultTuning): { low: number; high: number } {
  return marketRateHint(profileOf(band), state.reputation, false, t);
}

/** Why an offer can't be made, or null if it can. */
export function offerBlocked(state: GameState, bandId: string, offer: Offer, c: Content = defaultContent, t: Tuning = defaultTuning): string | null {
  if (state.phase !== 'prep') return 'Preparation is over.';
  if (isLineupLocked(state, c)) return 'The lineup is locked.';
  const band = getBand(c, bandId);
  if (!bandPool(c, festivalOf(state, c)).includes(band)) return `${band.name} can't play this festival.`;
  if (!gateOpen(band.tier, state.reputation, t)) return 'Not at this festival yet.';
  const talks = talksFor(state, bandId, t);
  if (talks.status === 'signed') return `${band.name} are already booked.`;
  if (talks.status === 'closed') return `Talks with ${band.name} are closed for this festival.`;
  if (state.lineup[offer.slot]) return `The ${offer.slot} slot is taken.`;
  if (!(offer.fee > 0)) return 'Offer a fee.';
  if (offer.merchPct < t.negotiation.merchMin || offer.merchPct > t.negotiation.merchMax) return 'Merch split is out of range.';
  if (offer.fee > cashOf(state, c, t)) return "You haven't the cash for that fee.";
  return null;
}

// ---------------------------------------------------------------- new game

export function newGame(seed: number, c: Content = defaultContent, t: Tuning = defaultTuning, festivalId = 'village-green'): GameState {
  const f = getFestival(c, festivalId);
  const timeline = festivalTimeline(c, f);
  let state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: createRng(seed),
    festivalId,
    attempt: 1,
    phase: 'prep',
    reputation: f.startingReputation,
    daysToGates: timeline.prepDays,
    ticketPrice: f.fairPrice,
    pendingTicketPrice: null,
    ticketsSold: 0,
    talks: {},
    lineup: {},
    plots: Array.from({ length: f.plotCount }, () => null),
    bookedToday: [],
    inbox: [],
    emailSeq: 0,
    sent: [],
    decisions: [],
    tutorial: newTutorial(),
    notice: null,
    forecastAtGates: null,
    day: null,
  };
  state = cue(state, c, 'gameStart');
  return sendStopEmails(state, c, t);
}

// ---------------------------------------------------------------- emails

/** Variables every email can use. */
function commonVars(state: GameState, c: Content, t: Tuning): TemplateVars {
  const f = festivalOf(state, c);
  const fc = forecastOf(state, c, t);
  return {
    festival: f.name,
    newspaper: f.newspaper,
    venue: f.venue,
    days_to_gates: String(state.daysToGates),
    cash: formatNumber(budgetOf(state, c)),
    price: formatNumber(planTicketPrice(state)),
    capacity: formatNumber(f.capacity),
    tickets_sold: formatNumber(state.ticketsSold),
    sold_pct: String(Math.round((state.ticketsSold / f.capacity) * 100)),
    remaining: formatNumber(Math.max(0, f.capacity - state.ticketsSold)),
    forecast: formatNumber(fc.attendees),
    forecast_pct: String(Math.round(fc.attendance * 100)),
    capacity_served: formatNumber(fc.capacityServed),
  };
}

function optionCost(state: GameState, c: Content, t: Tuning, eventId: string, key: OptionKey): number {
  const option = getEvent(c, eventId).options.find((o) => o.key === key);
  return option ? option.costShareR * revenueAtScale(state, c, t) : 0;
}

function decisionVars(state: GameState, c: Content, t: Tuning, eventId: string): TemplateVars {
  const f = festivalOf(state, c);
  if (eventId === 'sound-limiter') return { cost: formatNumber(optionCost(state, c, t, eventId, 'A')) };
  if (eventId === 'slow-sales') {
    const cut = getEvent(c, eventId).options.find((o) => o.key === 'A')?.priceCutShareOfFair ?? 0;
    return { price_cut: formatNumber(cut * f.fairPrice), poster_cost: formatNumber(optionCost(state, c, t, eventId, 'B')) };
  }
  return {};
}

function bandVars(band: Band): TemplateVars {
  return { band_name: band.name, listeners: formatNumber(band.monthlyListeners) };
}

function sendEmail(
  state: GameState,
  c: Content,
  t: Tuning,
  templateId: string,
  extra: TemplateVars = {},
  bandId?: string,
): GameState {
  const template = getEmail(c, templateId);
  if (template.once && state.sent.includes(templateId)) return state;
  const vars: TemplateVars = {
    ...commonVars(state, c, t),
    ...(bandId ? bandVars(getBand(c, bandId)) : {}),
    ...(template.decision ? decisionVars(state, c, t, template.decision) : {}),
    ...extra,
  };
  const email: Email = {
    id: `${templateId}-${state.emailSeq + 1}`,
    templateId,
    day: state.daysToGates,
    vars,
    read: false,
    done: false,
    ...(bandId ? { bandId } : {}),
    ...(template.decision ? { decision: { eventId: template.decision, chosen: null } } : {}),
  };
  return {
    ...state,
    inbox: [...state.inbox, email],
    emailSeq: state.emailSeq + 1,
    sent: state.sent.includes(templateId) ? state.sent : [...state.sent, templateId],
  };
}

/** Is a timeline email's extra condition met? */
function conditionMet(state: GameState, c: Content, t: Tuning, template: EmailTemplate, bandId?: string): boolean {
  switch (template.when) {
    case undefined:
      return true;
    case 'noHeadliner':
      return !state.lineup.headliner;
    case 'bandAvailable':
      return !!bandId && talksFor(state, bandId, t).status === 'open' && openSlots(state, c).length > 0;
    case 'forecastBelowSlow':
      return forecastOf(state, c, t).attendance < t.decisions.salesSlowEmailThreshold;
    case 'forecastBelowDecision':
      return forecastOf(state, c, t).attendance < t.decisions.slowSalesThreshold;
    case 'emptySlot':
      return openSlots(state, c).length > 0;
    default:
      throw new Error(`Unknown email condition: ${template.when}`);
  }
}

function sendStopEmails(state: GameState, c: Content, t: Tuning): GameState {
  const stop = festivalTimeline(c, festivalOf(state, c)).stops.find((s) => s.day === state.daysToGates);
  if (!stop) return state;
  return stop.emails.reduce((s, entry) => {
    const template = getEmail(c, entry.id);
    if (!conditionMet(s, c, t, template, entry.bandId)) return s;
    if (template.when === 'emptySlot') {
      return openSlots(s, c).reduce((acc, slot) => sendEmail(acc, c, t, entry.id, { slot }), s);
    }
    return sendEmail(s, c, t, entry.id, {}, entry.bandId);
  }, state);
}

/** Emails sent when sales pass a threshold. */
function sendConditionEmails(state: GameState, c: Content, t: Tuning): GameState {
  const f = festivalOf(state, c);
  let s = state;
  if (s.ticketsSold > t.prep.nearlySoldOutShare * f.capacity) s = sendEmail(s, c, t, 'nearlySoldOut');
  if (s.ticketsSold > 0 && s.ticketsSold > forecastOf(s, c, t).capacityServed) s = sendEmail(s, c, t, 'mindQueues');
  return s;
}

function sendBookingEmails(state: GameState, c: Content, t: Tuning): GameState {
  return state.bookedToday.reduce((s, facilityId) => {
    const facility = getFacility(c, facilityId);
    const units = unitsOf(s, facilityId);
    if (units === 0) return s;
    const cost = sum(s.plots.map((p) => (p?.facilityId === facilityId ? p.paid : 0)));
    return sendEmail(s, c, t, 'bookingConfirmed', {
      units: String(units),
      facility: units === 1 ? facility.singular : facility.plural,
      cost: formatNumber(cost),
    });
  }, state);
}

function markBandEmailsDone(state: GameState, bandId: string, templateId: string): GameState {
  return {
    ...state,
    inbox: state.inbox.map((e) => (e.bandId === bandId && e.templateId === templateId ? { ...e, done: true } : e)),
  };
}

// ---------------------------------------------------------------- tutorial

function cue(state: GameState, c: Content, trigger: string, vars: TemplateVars = {}): GameState {
  return { ...state, tutorial: cueLines(state.tutorial, c.lines, trigger, vars) };
}

function screenCue(state: GameState, c: Content, t: Tuning, screen: string, bandId?: string): GameState {
  const f = festivalOf(state, c);
  switch (screen) {
    case 'hub':
      return cue(state, c, 'hubOpened');
    case 'lineup':
      return cue(state, c, 'lineupOpened');
    case 'site':
      return cue(state, c, 'siteOpened', { capacity: formatNumber(f.capacity) });
    case 'tickets':
      return cue(state, c, 'ticketsOpened', { fair_price: formatNumber(f.fairPrice) });
    case 'finances':
      return cue(state, c, 'financesOpened', { cash: formatNumber(budgetOf(state, c)) });
    case 'negotiation': {
      if (!bandId) return state;
      const band = getBand(c, bandId);
      const hint = hintFor(state, band, t);
      return cue(state, c, 'negotiationOpened', {
        band_name: band.name,
        rate_low: formatNumber(hint.low),
        rate_high: formatNumber(hint.high),
      });
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------- time

function advanceDay(state: GameState, c: Content, t: Tuning): GameState {
  const f = festivalOf(state, c);
  const timeline = festivalTimeline(c, f);
  let s: GameState = state;
  if (s.pendingTicketPrice !== null) s = { ...s, ticketPrice: s.pendingTicketPrice, pendingTicketPrice: null };
  s = sendBookingEmails(s, c, t);
  s = { ...s, bookedToday: [], daysToGates: s.daysToGates - 1 };

  // Counters lapse after their expiry day.
  for (const [bandId, talks] of Object.entries(s.talks)) {
    if (talks.counter && s.daysToGates < talks.counter.expiresDay) {
      s = markBandEmailsDone({ ...s, talks: { ...s.talks, [bandId]: { ...talks, counter: null } } }, bandId, 'counter');
    }
  }

  const fc = forecastOf(s, c, t);
  s = { ...s, ticketsSold: ticketsSoldByDay(s.daysToGates, fc.attendees, s.ticketsSold, timeline, c.timeline) };
  s = sendStopEmails(s, c, t);
  s = sendConditionEmails(s, c, t);
  if (s.daysToGates === 0) s = { ...s, phase: 'day', forecastAtGates: forecastOf(s, c, t), day: newDay(timeline, t) };
  return s;
}

/** Continue: move time to the next email, decision or deadline. */
function continueTime(state: GameState, c: Content, t: Tuning): GameState {
  if (state.phase !== 'prep') return state;
  if (pendingDecisionEmail(state)) return { ...state, notice: 'Answer the decision in your inbox first.' };
  const timeline = festivalTimeline(c, festivalOf(state, c));
  let s = state;
  do {
    const before = s.inbox.length;
    s = advanceDay(s, c, t);
    if (s.inbox.length > before) break;
  } while (s.daysToGates > 0 && !isStopDay(s.daysToGates, timeline));
  return s;
}

// ---------------------------------------------------------------- negotiation

function updateTalks(state: GameState, bandId: string, talks: BandTalks): GameState {
  return { ...state, talks: { ...state.talks, [bandId]: talks } };
}

function book(state: GameState, c: Content, t: Tuning, bandId: string, offer: Offer, talks: Talks): GameState {
  const band = getBand(c, bandId);
  const profile = profileOf(band);
  const booking: Booking = {
    ...offer,
    bandId,
    askAtRep: requiredFee(band.feeAsk, band.reputation, state.reputation, t),
    requiredFee: adjustedRequiredFee(profile, state.reputation, offer, t),
  };
  let s: GameState = { ...state, lineup: { ...state.lineup, [offer.slot]: booking } };
  s = updateTalks(s, bandId, { ...talksFor(s, bandId, t), ...talks, counter: null });
  s = markBandEmailsDone(s, bandId, 'counter');
  s = markBandEmailsDone(s, bandId, 'emergingContact');
  s = sendEmail(s, c, t, 'dealDone', { slot: offer.slot, fee: formatNumber(offer.fee), merch_pct: String(offer.merchPct) }, bandId);
  s = cue(s, c, 'dealSigned');
  if (offer.slot === 'headliner') {
    s = sendEmail(s, c, t, 'headlinerNews', {}, bandId);
    s = sendEmail(s, c, t, 'noiseLimits');
    s = cue(s, c, 'headlinerSigned');
  }
  // A band whose counter needed a slot that has just been filled can't keep it.
  for (const [otherId, other] of Object.entries(s.talks)) {
    if (otherId !== bandId && other.counter?.offer.slot === offer.slot) {
      s = markBandEmailsDone(updateTalks(s, otherId, { ...other, counter: null }), otherId, 'counter');
    }
  }
  return s;
}

function submitOffer(state: GameState, c: Content, t: Tuning, bandId: string, offer: Offer): GameState {
  const blocked = offerBlocked(state, bandId, offer, c, t);
  if (blocked) return { ...state, notice: blocked };
  const band = getBand(c, bandId);
  const current = talksFor(state, bandId, t);
  const response = respond(profileOf(band), state.reputation, offer, current, openSlots(state, c), t);
  const round: OfferRound = { offer, score: 'score' in response ? response.score : 0, result: response.kind, day: state.daysToGates };
  let s = markBandEmailsDone(state, bandId, 'counter');
  s = updateTalks(s, bandId, { ...current, ...response.talks, counter: null, rounds: [...current.rounds, round] });

  switch (response.kind) {
    case 'refused':
      return { ...s, notice: 'Not at this festival yet.' };
    case 'accept':
      return book(s, c, t, bandId, offer, response.talks);
    case 'counter': {
      const counter: PendingCounter = {
        offer: response.counter.offer,
        term: response.counter.term,
        expiresDay: state.daysToGates - t.prep.counterExpiryDays,
      };
      s = updateTalks(s, bandId, { ...talksFor(s, bandId, t), counter });
      s = sendEmail(
        s,
        c,
        t,
        'counter',
        {
          counter_fee: formatNumber(counter.offer.fee),
          counter_slot: counter.offer.slot,
          counter_merch: String(counter.offer.merchPct),
          days_left: String(t.prep.counterExpiryDays),
        },
        bandId,
      );
      return cue(s, c, 'bandCountered');
    }
    case 'reject':
      return s;
    case 'walkedAway':
      s = markBandEmailsDone(s, bandId, 'emergingContact');
      s = sendEmail(s, c, t, response.score < t.negotiation.counterAt ? 'rejected' : 'movedOn', {}, bandId);
      return cue(s, c, 'bandWalked');
  }
}

function acceptCounter(state: GameState, c: Content, t: Tuning, bandId: string): GameState {
  const talks = talksFor(state, bandId, t);
  const counter = talks.counter;
  if (!counter) return { ...state, notice: 'That offer has lapsed.' };
  if (isLineupLocked(state, c)) return { ...state, notice: 'The lineup is locked.' };
  if (state.lineup[counter.offer.slot]) return { ...state, notice: `The ${counter.offer.slot} slot is taken.` };
  if (counter.offer.fee > cashOf(state, c, t)) return { ...state, notice: "You haven't the cash for that fee." };
  return book(state, c, t, bandId, counter.offer, acceptCounterTalks(talks));
}

function walkAway(state: GameState, t: Tuning, bandId: string): GameState {
  const talks = talksFor(state, bandId, t);
  if (talks.status !== 'open') return state;
  const s = updateTalks(state, bandId, { ...talks, ...walkAwayTalks(talks), counter: null });
  return markBandEmailsDone(markBandEmailsDone(s, bandId, 'counter'), bandId, 'emergingContact');
}

// ---------------------------------------------------------------- site, tickets and decisions

function placeFacility(state: GameState, c: Content, t: Tuning, plot: number, facilityId: string): GameState {
  const f = festivalOf(state, c);
  if (state.phase !== 'prep') return state;
  if (!f.facilityTypes.includes(facilityId)) return { ...state, notice: 'Not available at this festival.' };
  if (plot < 0 || plot >= state.plots.length || state.plots[plot]) return state;
  const cost = nextUnitCost(state, c, t);
  if (cost > cashOf(state, c, t)) return { ...state, notice: "You haven't the cash for that." };
  const plots = state.plots.map((p, i) => (i === plot ? { facilityId, paid: cost, emergency: isEmergencyPricing(state, c) } : p));
  const bookedToday = state.bookedToday.includes(facilityId) ? state.bookedToday : [...state.bookedToday, facilityId];
  return { ...state, plots, bookedToday };
}

function removeFacility(state: GameState, c: Content, plot: number): GameState {
  const current = state.plots[plot];
  if (!current || state.phase !== 'prep') return state;
  if (isEmergencyPricing(state, c)) return { ...state, notice: 'Too late to cancel: the hire firm has your booking.' };
  const plots = state.plots.map((p, i) => (i === plot ? null : p));
  const bookedToday = state.bookedToday.includes(current.facilityId) ? state.bookedToday : [...state.bookedToday, current.facilityId];
  return { ...state, plots, bookedToday };
}

function setTicketPrice(state: GameState, c: Content, t: Tuning, price: number): GameState {
  if (state.phase !== 'prep') return state;
  const p = t.prep;
  const rounded = clamp(Math.round(price / p.ticketPriceStep) * p.ticketPriceStep, p.ticketPriceMin, p.ticketPriceMax);
  const timeline = festivalTimeline(c, festivalOf(state, c));
  // Before tickets go on sale the price changes at once; after that, from the next day.
  if (state.daysToGates > timeline.onSaleDay) return { ...state, ticketPrice: rounded, pendingTicketPrice: null };
  return { ...state, pendingTicketPrice: rounded === state.ticketPrice ? null : rounded };
}

function chooseDecision(state: GameState, c: Content, t: Tuning, emailId: string, key: OptionKey): GameState {
  const email = state.inbox.find((e) => e.id === emailId);
  if (!email?.decision || email.decision.chosen !== null) return state;
  const option = getEvent(c, email.decision.eventId).options.find((o) => o.key === key);
  if (!option) return state;
  const f = festivalOf(state, c);
  const r = revenueAtScale(state, c, t);
  if (option.costShareR * r > cashOf(state, c, t)) return { ...state, notice: "You haven't the cash for that." };
  const { effect, rng } = resolveOption(option, r, f.fairPrice, state.rng, t);
  let s: GameState = {
    ...state,
    rng,
    decisions: [...state.decisions, { eventId: email.decision.eventId, option: key, effect, day: state.daysToGates }],
    inbox: state.inbox.map((e) =>
      e.id === emailId ? { ...e, read: true, done: true, decision: { eventId: email.decision!.eventId, chosen: key } } : e,
    ),
  };
  if (effect.priceCut > 0) s = setTicketPrice(s, c, t, planTicketPrice(s) - effect.priceCut);
  return s;
}

function readEmail(state: GameState, c: Content, emailId: string): GameState {
  const email = state.inbox.find((e) => e.id === emailId);
  if (!email) return state;
  let s: GameState = { ...state, inbox: state.inbox.map((e) => (e.id === emailId ? { ...e, read: true } : e)) };
  if (email.templateId === 'soundLimiter') s = cue(s, c, 'soundLimiterOpened');
  return s;
}

// ---------------------------------------------------------------- festival day

/** Does a scheduled event fire, or did preparation prevent it? */
function eventFires(state: GameState, c: Content, t: Tuning, event: ScheduledEvent): boolean {
  const prevented = new Set(state.decisions.flatMap((d) => d.effect.prevents));
  if (prevented.has(event.eventId)) return false;
  switch (event.onlyIf) {
    case undefined:
      return true;
    case 'foodShort':
      return liveOutcome(state, c, t).foodQueueRisk;
    default:
      throw new Error(`Unknown event condition: ${event.onlyIf}`);
  }
}

function openGates(state: GameState, c: Content): GameState {
  if (state.phase !== 'day' || !state.day || state.day.started) return state;
  return cue({ ...state, day: { ...state.day, started: true } }, c, 'gatesOpened');
}

function tick(state: GameState, c: Content, t: Tuning, realSeconds: number): GameState {
  if (state.phase !== 'day' || !state.day) return state;
  const { day, happenings } = advanceClock(state.day, realSeconds, (e) => eventFires(state, c, t, e), t);
  let s: GameState = { ...state, day };
  for (const h of happenings) {
    if (h.kind === 'event') s = cue(s, c, `event:${h.eventId}`);
    else if (h.kind === 'prevented') s = cue(s, c, `prevented:${h.eventId}`);
    else if (h.kind === 'headlinerOn') s = cue(s, c, 'headlinerOn');
    else s = { ...s, phase: 'results' };
  }
  return s;
}

function setSpeed(state: GameState, t: Tuning, speed: number): GameState {
  if (!state.day || (speed !== 1 && speed !== t.festivalDay.fastSpeed)) return state;
  return { ...state, day: { ...state.day, speed } };
}

function chooseOption(state: GameState, c: Content, t: Tuning, key: OptionKey): GameState {
  const active = state.day?.active;
  if (!state.day || !active) return state;
  const option = getEvent(c, active.eventId).options.find((o) => o.key === key);
  if (!option) return state;
  const f = festivalOf(state, c);
  const { effect, rng } = resolveOption(option, revenueAtScale(state, c, t), f.fairPrice, state.rng, t);
  const s: GameState = { ...state, rng, day: recordChoice(state.day, key, effect) };
  // Option A pays to fix the problem; Randy has a line for some of those.
  return key === 'A' ? cue(s, c, `fixed:${active.eventId}`) : s;
}

// ---------------------------------------------------------------- replay

/**
 * Replay the festival from its start with everything reset (cash, reputation, bookings). The new
 * seed comes from the old generator, so a replay is still deterministic. Randy doesn't repeat
 * lines the player has already seen.
 */
export function replayFestival(state: GameState, c: Content = defaultContent, t: Tuning = defaultTuning): GameState {
  const { value: seed } = nextInt(state.rng, 1, 0x7fffffff);
  const fresh = newGame(seed, c, t, state.festivalId);
  return { ...fresh, attempt: state.attempt + 1, tutorial: { ...state.tutorial, queue: [] } };
}

// ---------------------------------------------------------------- reducer

export function reduce(state: GameState, action: GameAction, c: Content = defaultContent, t: Tuning = defaultTuning): GameState {
  const s: GameState = state.notice === null ? state : { ...state, notice: null };
  switch (action.type) {
    case 'continue':
      return continueTime(s, c, t);
    case 'openScreen':
      return screenCue(s, c, t, action.screen, action.bandId);
    case 'submitOffer':
      return submitOffer(s, c, t, action.bandId, action.offer);
    case 'acceptCounter':
      return acceptCounter(s, c, t, action.bandId);
    case 'walkAway':
      return walkAway(s, t, action.bandId);
    case 'placeFacility':
      return placeFacility(s, c, t, action.plot, action.facilityId);
    case 'removeFacility':
      return removeFacility(s, c, action.plot);
    case 'setTicketPrice':
      return setTicketPrice(s, c, t, action.price);
    case 'readEmail':
      return readEmail(s, c, action.emailId);
    case 'dismissEmail':
      return { ...s, inbox: s.inbox.map((e) => (e.id === action.emailId ? { ...e, read: true, done: true } : e)) };
    case 'chooseDecision':
      return chooseDecision(s, c, t, action.emailId, action.option);
    case 'dismissLine':
      return { ...s, tutorial: dismissLine(s.tutorial) };
    case 'skipTutorial':
      return { ...s, tutorial: skipTutorial(s.tutorial) };
    case 'openGates':
      return openGates(s, c);
    case 'tick':
      return tick(s, c, t, action.realSeconds);
    case 'setSpeed':
      return setSpeed(s, t, action.speed);
    case 'chooseOption':
      return chooseOption(s, c, t, action.option);
    case 'replay':
      return replayFestival(s, c, t);
  }
}

/** Subject and body of an email with its placeholders filled. */
export function emailText(email: Email, c: Content = defaultContent): { from: string; subject: string; body: string } {
  const template = getEmail(c, email.templateId);
  return {
    from: fillTemplate(template.from, email.vars),
    subject: fillTemplate(template.subject, email.vars),
    body: fillTemplate(template.body, email.vars),
  };
}
