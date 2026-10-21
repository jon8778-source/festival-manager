// What the game needs that docs/CONTENT.md doesn't spell out: stable ids, which screen each
// email button opens, slot ids, placeholder art and clock times for phrases like "midday".
// Everything else (names, numbers, text and timings) comes from the doc itself.

import type { EmailAction, EmailTrigger, Facility } from '../../src/core/content';

/** Festival ids by festival number. */
export const festivalIds: Record<number, string> = {
  1: 'village-green',
  2: 'local-field',
  3: 'two-stages',
};

/** Slot ids per festival, lowest first. They match the keys of tuning.merchSlotWeights. */
export const slotIds: Record<number, string[]> = {
  1: ['opener', 'support', 'headliner'],
  2: ['opener', 'support', 'support2', 'headliner'],
  3: ['opener', 'support', 'headliner', 'secondOpener', 'secondSupport', 'secondHeadliner'],
};

/** Facility types, matched by the names used in the festivals table. */
export const facilities: (Omit<Facility, 'firstFestival'> & { names: string[] })[] = [
  { id: 'toilets', name: 'Toilet block', plural: 'toilets', emoji: '🚻', names: ['toilets'] },
  { id: 'food', name: 'Food stall', plural: 'food stalls', emoji: '🍔', names: ['food stalls'] },
  { id: 'bar', name: 'Bar', plural: 'bars', emoji: '🍺', names: ['the bar', 'bar'] },
];

/** Festival day clock times for the phrases in the events table. Longer phrases first. */
export const timesOfDay: [phrase: string, time: string][] = [
  ['early afternoon', '14:30'],
  ['mid-afternoon', '15:30'],
  ['during the headline set', '21:30'],
  ['midday', '13:00'],
  ['afternoon', '15:00'],
  ['evening', '20:00'],
];

/** Conditions the game checks before an event happens, by event id. */
export const eventConditions: Record<string, string> = {
  'food-stall-queue': 'food-short',
  'sound-bleed': 'loud-acts-overlap',
  'slow-sales': 'forecast-below-threshold',
};

/** Timeline moment ids, matched by phrases in the timeline table. */
export const moments: [phrase: string, id: string][] = [
  ['welcome', 'welcome'],
  ['tickets on sale', 'tickets-on-sale'],
  ['sales updates', 'sales-update'],
  ['sound limiter', 'sound-limiter'],
  ['slow-sales', 'slow-sales-check'],
  ['no headliner', 'no-headliner-reminder'],
  ['empty slot', 'empty-slot-reminder'],
  ['last day to book facilities', 'facility-deadline'],
  ['gates open tomorrow', 'gates-tomorrow'],
  ['festival day', 'festival-day'],
  ['promoter advance', 'promoter-advance'],
  ['lineup announcement', 'lineup-announcement'],
  ['weather forecast', 'weather-forecast'],
  ['second stage', 'second-stage-unlocked'],
  ['set times', 'set-times-locked'],
];

export interface EmailStructure {
  id: string;
  trigger: EmailTrigger;
  festivals?: number[];
}

/** Email ids and triggers, by the email's number in CONTENT.md. */
export const emails: Record<number, EmailStructure> = {
  1: { id: 'welcome', trigger: { type: 'moment', moment: 'welcome' }, festivals: [1] },
  2: { id: 'no-headliner', trigger: { type: 'moment', moment: 'no-headliner-reminder' } },
  3: { id: 'deal-accepted', trigger: { type: 'action', action: 'offer-accepted' } },
  4: { id: 'counter-offer', trigger: { type: 'action', action: 'offer-countered' } },
  5: { id: 'offer-rejected', trigger: { type: 'action', action: 'offer-rejected' } },
  6: { id: 'band-moved-on', trigger: { type: 'action', action: 'patience-ran-out' } },
  7: { id: 'emerging-band', trigger: { type: 'condition', condition: 'emerging-band-approach' } },
  8: { id: 'tickets-live', trigger: { type: 'moment', moment: 'tickets-on-sale' } },
  9: { id: 'sales-update', trigger: { type: 'moment', moment: 'sales-update' } },
  10: { id: 'sales-slow', trigger: { type: 'condition', condition: 'forecast-below-60' } },
  11: { id: 'nearly-sold-out', trigger: { type: 'condition', condition: 'over-90-sold' } },
  12: { id: 'facilities-booked', trigger: { type: 'action', action: 'facilities-booked' } },
  13: { id: 'mind-the-queues', trigger: { type: 'condition', condition: 'sales-exceed-facilities' } },
  14: { id: 'headliner-announced', trigger: { type: 'action', action: 'headliner-booked' }, festivals: [1] },
  15: { id: 'empty-slot', trigger: { type: 'moment', moment: 'empty-slot-reminder' } },
  16: { id: 'gates-tomorrow', trigger: { type: 'moment', moment: 'gates-tomorrow' } },
  17: { id: 'review', trigger: { type: 'action', action: 'festival-finished' }, festivals: [1] },
  18: { id: 'noise-limits', trigger: { type: 'action', action: 'headliner-booked' }, festivals: [1] },
  19: { id: 'noise-complaint', trigger: { type: 'event', eventId: 'noise-complaint' } },
  20: { id: 'weather-forecast', trigger: { type: 'moment', moment: 'weather-forecast' }, festivals: [2] },
  21: { id: 'band-flying', trigger: { type: 'action', action: 'emerging-band-grew' } },
  22: { id: 'sound-limiter', trigger: { type: 'event', eventId: 'sound-limiter' } },
  23: { id: 'slow-sales', trigger: { type: 'event', eventId: 'slow-sales' } },
};

/**
 * What each email button does, by its label. Buttons on decision emails (trigger type 'event')
 * don't need an entry: they choose options A, B and C in order.
 */
export const buttonActions: Record<string, EmailAction> = {
  'Open lineup': { type: 'screen', screen: 'lineup' },
  'View lineup': { type: 'screen', screen: 'lineup' },
  'View contract': { type: 'screen', screen: 'lineup' },
  'Find another act': { type: 'screen', screen: 'lineup' },
  Negotiate: { type: 'screen', screen: 'negotiation' },
  'Make an offer': { type: 'screen', screen: 'negotiation' },
  'Change price': { type: 'screen', screen: 'tickets' },
  'View tickets': { type: 'screen', screen: 'tickets' },
  'Open site': { type: 'screen', screen: 'site' },
  'View site': { type: 'screen', screen: 'site' },
  'Read the review': { type: 'screen', screen: 'results' },
  Accept: { type: 'game', action: 'acceptCounter' },
  'Walk away': { type: 'game', action: 'walkAway' },
  'Start festival': { type: 'game', action: 'startFestival' },
  'Not now': { type: 'game', action: 'dismiss' },
  Read: { type: 'game', action: 'dismiss' },
  'Got it': { type: 'game', action: 'dismiss' },
};
