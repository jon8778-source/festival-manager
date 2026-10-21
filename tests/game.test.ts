import { describe, expect, it } from 'vitest';
import { bandPool, defaultContent, getFestival } from '../src/core/content';
import {
  cashOf,
  emailText,
  forecastOf,
  newGame,
  nextUnitCost,
  pendingDecisionEmail,
  reduce,
  type GameAction,
  type GameState,
} from '../src/core/game';
import { formatPounds } from '../src/core/format';

const run = (state: GameState, ...actions: GameAction[]) => actions.reduce((s, a) => reduce(s, a), state);
const templates = (s: GameState) => s.inbox.map((e) => e.templateId);
const answerDecisions = (s: GameState, option: 'A' | 'B' | 'C' = 'C') => {
  let next = s;
  for (let e = pendingDecisionEmail(next); e; e = pendingDecisionEmail(next)) {
    next = reduce(next, { type: 'chooseDecision', emailId: e.id, option });
  }
  return next;
};
const continueTo = (s: GameState, day: number) => {
  let next = s;
  while (next.daysToGates > day) next = reduce(answerDecisions(next), { type: 'continue' });
  return next;
};

describe('new game', () => {
  it('starts festival 1 on day 30 with Randy welcome', () => {
    const s = newGame(1);
    expect(s.daysToGates).toBe(30);
    expect(templates(s)).toEqual(['welcome']);
    expect(emailText(s.inbox[0]!).body).toBe(
      "Right then. You've 30 days, £20,000 and a field. Book a headliner first; everything else follows.",
    );
    expect(s.tutorial.queue.map((q) => q.lineId)).toEqual(['welcome']);
  });

  it('commits the overhead from the first day', () => {
    expect(cashOf(newGame(1))).toBe(20000 - 4375);
  });

  it('has the twelve festival 1 bands', () => {
    expect(bandPool(defaultContent, getFestival(defaultContent, 'village-green'))).toHaveLength(12);
  });
});

describe('Continue', () => {
  it('jumps to the next email or deadline', () => {
    let s = newGame(1);
    s = reduce(s, { type: 'continue' });
    expect(s.daysToGates).toBe(26);
    expect(templates(s)).toContain('ticketsLive');
    s = reduce(s, { type: 'continue' });
    // Sales have passed the (zero) facility capacity, so Randy warns about queues.
    expect(s.daysToGates).toBe(24);
    expect(templates(s).at(-1)).toBe('mindQueues');
    s = reduce(s, { type: 'continue' });
    expect(s.daysToGates).toBe(20);
    expect(templates(s)).toEqual(expect.arrayContaining(['soundLimiter', 'emergingContact']));
  });

  it('waits for a preparation decision', () => {
    const s = continueTo(newGame(1), 20);
    expect(pendingDecisionEmail(s)?.templateId).toBe('soundLimiter');
    const blocked = reduce(s, { type: 'continue' });
    expect(blocked.daysToGates).toBe(20);
    expect(blocked.notice).toMatch(/decision/);
  });

  it('reaches the festival day with a forecast snapshot', () => {
    const s = continueTo(newGame(1), 0);
    expect(s.phase).toBe('day');
    expect(s.forecastAtGates).not.toBeNull();
    expect(templates(s)).toEqual(expect.arrayContaining(['noHeadliner', 'emptySlot', 'gatesTomorrow']));
  });
});

describe('negotiation through the reducer', () => {
  it('books The Mud Pies at £380 for the opener (spec section 5)', () => {
    const s = reduce(newGame(1), {
      type: 'submitOffer',
      bandId: 'the-mud-pies',
      offer: { fee: 380, slot: 'opener', merchPct: 10 },
    });
    expect(s.lineup.opener?.bandId).toBe('the-mud-pies');
    expect(s.talks['the-mud-pies']?.status).toBe('signed');
    expect(templates(s)).toContain('dealDone');
    expect(cashOf(s)).toBe(20000 - 4375 - 380);
  });

  it('Dust & Diesel counter at £4,500, and accepting it books the headliner', () => {
    let s = reduce(newGame(1), {
      type: 'submitOffer',
      bandId: 'dust-and-diesel',
      offer: { fee: 3900, slot: 'headliner', merchPct: 20 },
    });
    expect(s.talks['dust-and-diesel']?.counter?.offer.fee).toBe(4500);
    expect(templates(s)).toContain('counter');
    expect(s.tutorial.seen).toContain('counter');
    s = reduce(s, { type: 'acceptCounter', bandId: 'dust-and-diesel' });
    expect(s.lineup.headliner?.fee).toBe(4500);
    expect(templates(s)).toEqual(expect.arrayContaining(['headlinerNews', 'noiseLimits']));
  });

  it('a counter lapses after three days', () => {
    let s = continueTo(newGame(1), 20);
    s = reduce(s, { type: 'submitOffer', bandId: 'dust-and-diesel', offer: { fee: 3900, slot: 'headliner', merchPct: 20 } });
    expect(s.talks['dust-and-diesel']?.counter?.expiresDay).toBe(17);
    s = continueTo(s, 16);
    expect(s.daysToGates).toBe(16);
    expect(s.talks['dust-and-diesel']?.counter).toBeNull();
  });

  it('three low offers end talks with a "not this time" email', () => {
    const low = { type: 'submitOffer', bandId: 'amber-lights', offer: { fee: 500, slot: 'support', merchPct: 15 } } as const;
    const s = run(newGame(1), low, low, low);
    expect(s.talks['amber-lights']?.status).toBe('closed');
    expect(templates(s)).toContain('rejected');
    expect(run(s, low).notice).toMatch(/closed/);
  });

  it('blocks a taken slot', () => {
    const s = run(
      newGame(1),
      { type: 'submitOffer', bandId: 'the-mud-pies', offer: { fee: 380, slot: 'opener', merchPct: 10 } },
      { type: 'submitOffer', bandId: 'the-hedgerows', offer: { fee: 400, slot: 'opener', merchPct: 10 } },
    );
    expect(s.lineup.opener?.bandId).toBe('the-mud-pies');
    expect(s.notice).toMatch(/taken/);
  });
});

describe('facilities and the day 3 deadline', () => {
  it('costs £300 a unit and can be cancelled before the deadline', () => {
    let s = reduce(newGame(1), { type: 'placeFacility', plot: 0, facilityId: 'food' });
    expect(s.plots[0]?.paid).toBe(300);
    s = reduce(s, { type: 'removeFacility', plot: 0 });
    expect(s.plots[0]).toBeNull();
  });

  it('sends a booking confirmation the next day', () => {
    const s = run(
      newGame(1),
      { type: 'placeFacility', plot: 0, facilityId: 'toilets' },
      { type: 'placeFacility', plot: 1, facilityId: 'toilets' },
      { type: 'continue' },
    );
    const email = s.inbox.find((e) => e.templateId === 'bookingConfirmed')!;
    expect(emailText(email).subject).toBe('Booking confirmed: 2 toilet blocks');
    expect(emailText(email).body).toContain('Total: £600.');
  });

  it('charges 1.5 times after day 3 and no longer cancels', () => {
    let s = continueTo(newGame(1), 3);
    expect(nextUnitCost(s)).toBe(300);
    s = reduce(answerDecisions(s), { type: 'continue' });
    expect(s.daysToGates).toBe(1);
    expect(nextUnitCost(s)).toBe(450);
    s = reduce(s, { type: 'placeFacility', plot: 0, facilityId: 'food' });
    expect(s.plots[0]).toMatchObject({ paid: 450, emergency: true });
    s = reduce(s, { type: 'removeFacility', plot: 0 });
    expect(s.plots[0]).not.toBeNull();
  });
});

describe('tickets and the forecast', () => {
  it('a new price takes effect from the next day once tickets are on sale', () => {
    let s = reduce(newGame(1), { type: 'continue' });
    s = reduce(s, { type: 'setTicketPrice', price: 30 });
    expect(s.ticketPrice).toBe(25);
    expect(s.pendingTicketPrice).toBe(30);
    expect(forecastOf(s).ticketIncome).toBeCloseTo(forecastOf(s).attendees * 30);
    s = reduce(s, { type: 'continue' });
    expect(s.ticketPrice).toBe(30);
  });

  it('ticket sales follow the curve and the box office reports them', () => {
    let s = run(
      newGame(1),
      { type: 'submitOffer', bandId: 'the-mud-pies', offer: { fee: 380, slot: 'opener', merchPct: 10 } },
      { type: 'submitOffer', bandId: 'amber-lights', offer: { fee: 2100, slot: 'support', merchPct: 15 } },
      { type: 'submitOffer', bandId: 'dust-and-diesel', offer: { fee: 4500, slot: 'headliner', merchPct: 20 } },
    );
    s = continueTo(s, 14);
    const attendees = forecastOf(s).attendees;
    expect(s.ticketsSold).toBe(Math.floor(attendees * 0.2));
    const update = [...s.inbox].reverse().find((e) => e.templateId === 'salesUpdate')!;
    expect(emailText(update).body).toContain(`${s.ticketsSold} of 500 tickets sold with 14 days to go`);
  });

  it('the slow-sales decision appears only when the forecast is below 80%', () => {
    const empty = continueTo(newGame(1), 14);
    expect(templates(empty)).toContain('slowSalesDecision');
    expect(templates(empty)).toContain('salesSlow');
  });

  it('cutting the price in the slow-sales decision lowers it by £2', () => {
    let s = continueTo(newGame(1), 14);
    const email = pendingDecisionEmail(s)!;
    expect(emailText(email).body).toContain('drop the price by £2, put posters up around the area for £150');
    s = reduce(s, { type: 'chooseDecision', emailId: email.id, option: 'A' });
    expect(s.pendingTicketPrice).toBe(23);
  });

  it('the sound limiter costs £75 and is recorded', () => {
    let s = continueTo(newGame(1), 20);
    const email = pendingDecisionEmail(s)!;
    s = reduce(s, { type: 'chooseDecision', emailId: email.id, option: 'A' });
    expect(s.decisions[0]?.effect.prevents).toEqual(['noise-complaint']);
    expect(formatPounds(cashOf(s))).toBe('£15,550');
  });
});

describe('tutorial cues', () => {
  it('fires lines when screens open and skip clears them', () => {
    let s = run(newGame(1), { type: 'dismissLine' }, { type: 'openScreen', screen: 'lineup' });
    expect(s.tutorial.queue.map((q) => q.lineId)).toEqual(['lineup']);
    s = reduce(s, { type: 'openScreen', screen: 'negotiation', bandId: 'dust-and-diesel' });
    expect(s.tutorial.queue.map((q) => q.lineId)).toEqual(['lineup', 'firstNegotiation', 'offerTable']);
    s = reduce(s, { type: 'skipTutorial' });
    expect(s.tutorial.queue).toHaveLength(0);
  });
});
