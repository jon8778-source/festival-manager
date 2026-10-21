import { newGame, pendingDecisionEmail, reduce, type GameAction, type GameState } from '../src/core/game';
import type { OptionKey } from '../src/core/events';

export const run = (state: GameState, ...actions: GameAction[]) => actions.reduce((s, a) => reduce(s, a), state);

/** Book a full lineup at asking price, build facilities, answer the decisions and open the gates. */
export function playToGates(opts: { seed?: number; limiter?: OptionKey; foodUnits?: number; toilets?: number; price?: number } = {}): GameState {
  const { seed = 7, limiter = 'C', foodUnits = 5, toilets = 5, price } = opts;
  let s = run(
    newGame(seed),
    { type: 'submitOffer', bandId: 'the-mud-pies', offer: { fee: 380, slot: 'opener', merchPct: 10 } },
    { type: 'submitOffer', bandId: 'amber-lights', offer: { fee: 2100, slot: 'support', merchPct: 15 } },
    { type: 'submitOffer', bandId: 'dust-and-diesel', offer: { fee: 4500, slot: 'headliner', merchPct: 20 } },
  );
  if (price !== undefined) s = reduce(s, { type: 'setTicketPrice', price });
  for (let i = 0; i < toilets; i++) s = reduce(s, { type: 'placeFacility', plot: i, facilityId: 'toilets' });
  for (let i = 0; i < foodUnits; i++) s = reduce(s, { type: 'placeFacility', plot: toilets + i, facilityId: 'food' });
  while (s.phase === 'prep') {
    const decision = pendingDecisionEmail(s);
    if (decision) {
      const option = decision.decision?.eventId === 'sound-limiter' ? limiter : 'C';
      s = reduce(s, { type: 'chooseDecision', emailId: decision.id, option });
    } else s = reduce(s, { type: 'continue' });
  }
  return reduce(s, { type: 'openGates' });
}

/** Run the day to midnight, answering every card with `option` (B when the card has no such option). */
export function playDay(state: GameState, option: OptionKey = 'A'): GameState {
  let s = state;
  for (let i = 0; i < 5000 && s.phase === 'day'; i++) {
    s = s.day?.active ? reduce(s, { type: 'chooseOption', option: s.day.active.eventId === 'noise-complaint' && option === 'C' ? 'B' : option }) : reduce(s, { type: 'tick', realSeconds: 1 });
  }
  return s;
}
