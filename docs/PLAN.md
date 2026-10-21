# Milestone 1 plan: first playable (festival 1, Village Green)

## Context
The repository has the step 0 scaffold: Vite, React, strict TypeScript, Vitest, the Pages deploy, a placeholder `MainMenu` and `src/core/game.ts`. Milestone 1 (spec §13.1) is a playable festival 1: Randy's welcome, booking three bands through negotiation, placing facilities, setting a ticket price, Continue through 30 preparation days, a live festival day with three decisions, a newspaper review with stars, Replay, save and load, and the playtest log.

This plan was approved on 19 October 2026 and updated on 21 October for the spec revision (see section 11). Its decisions are also recorded in `docs/DECISIONS.md`. It was updated after approval for the spec and content changes uploaded to main (fee generosity, merch split and the food queue event). Building happens in later sessions, following PROMPTS steps 2 to 7. Each step is one PR, and `npm test` and `npm run build` must pass before each push.

## 1. Architecture

There are three layers. Rules never touch React or the browser.

```
src/data/*.json ──► src/core (pure TS: rules, state, reducer) ──► src/app (store, storage adapters) ──► src/screens + src/components (thin React)
```

- **One game state object**, serialisable JSON, changed only by `reduce(state, action, content) → state` in `src/core/game.ts`. Every player input and every tick is an action. This makes save, replay and logging simple, and lets a whole playthrough be tested in one unit test.
- **Randomness** goes only through `src/core/random.ts`, a seeded mulberry32 generator. The generator state is kept inside the game state (`rng: number`), so a saved game resumes deterministically.
- **Browser APIs** (localStorage, Blob download, `navigator.share`, timers) live only in `src/app/`. CLAUDE.md doesn't list this folder; it is the only addition. It keeps `src/core/save.ts` and `src/core/playtestLog.ts` pure: they build and parse JSON and records, and the adapters store them.
- **Navigation** is a small screen switch in `App.tsx`: a `screen` state plus a back stack. No router library. The current screen is not saved: loading a game opens the main menu.
- **Festival day clock:** React calls `dispatch({type:'tick', realSeconds, speed})` about every 250 ms. The core moves game time forward (12 game hours = 300 real seconds at 1×) and stops at the next scheduled decision. While a card is open, the state is paused.

## 2. Core modules (`src/core`)

| Module | Responsibility |
| --- | --- |
| `random.ts` | `createRng(seed)`, `nextFloat(rng) → {value, rng}`, `chance(rng, p)`, `pick(rng, list)`. Pure, takes and returns the generator state. |
| `tuning.ts` | The `Tuning` type and a typed loader for `tuning.json`. |
| `content.ts` | Types for every data file, plus `loadContent()`, which bundles the JSON imports into one `Content` object. |
| `economy.ts` | `ticketPriceAtFairValue` (Pt), `fullScaleRevenue` (R), `facilityUnitCost`, `lineupQuality` (L), `capacityServed`, `phi`, `queueRatio`, `perceivedValue`, `priceEffect`, `attendance`, `income`, `spend`, `customerSatisfaction`, `feeGenerosity`, `bandSatisfaction`, `budget`, `advance` (the advance is tested now and used from milestone 4). All are pure, take numbers or plain objects, and read constants from `tuning`. |
| `negotiation.ts` | `gateCheck`, `requiredFee` (reputation adjustment and clamp), `emergingDiscount`, `expectedSlot`, `slotAdjustment`, `merchAdjustment`, `scoreOffer`, `respond` (accept, counter or reject), `buildCounter` (moves the term with the biggest gap), `applyPatience`, `marketRateHint`, `termVerdicts` (OK, Close or Low). |
| `calendar.ts` | Preparation timeline: `nextStop(state)` (the next email day or deadline), `advanceDay`, the facility deadline, the lineup lock, `ticketsSoldByDay` (the curve × forecast). |
| `emails.ts` | Decides which emails trigger on a day or an action and fills in their templates. Emails are data; this module only matches triggers and fills `{placeholders}`. |
| `events.ts` | Festival day schedule (scripted events from `timeline.json`), `resolveOption` (cost share × R, customer, band and reputation changes), the noise fine roll. |
| `stars.ts` | `computeStars(results, targets)`, `passed`, `weakestStar`, `bestArea`, `bandMoodLabel`. |
| `results.ts` | `finaliseFestival(state)`: final attendance, income, spend, satisfactions, stars, reputation update, cash. `projectLive(state)`: the same maths, including the events so far, for the live meters. `buildNewspaper(results, content, rng)`: headline, opening, closing, event line and stats box. |
| `tutorial.ts` | Which of Randy's lines is due for a trigger (`welcome`, `lineupOpened`, …), with each line shown once and a skip-all flag. |
| `game.ts` | `newGame(seed, content)`, `reduce(state, action, content)`, `replayFestival(state)`. It replaces the placeholder `GAME_TITLE` export; the title moves to `festivals.json`/`lines.json`. |
| `save.ts` | `SAVE_VERSION`, `serialise(state)`, `deserialise(json)` (validates the version and shape, with a migration hook), and the export file name. |
| `playtestLog.ts` | Log record types and `makeRecord(kind, payload, sessionId, now)`, plus `toJsonl(records)`. |

**Actions (the `GameAction` union):** `continue`, `openScreen` (for tutorial triggers and the log), `submitOffer`, `acceptCounter`, `walkAway`, `placeFacility`, `removeFacility`, `setTicketPrice`, `readEmail`, `skipTutorial`, `dismissLine`, `startFestival`, `tick`, `setSpeed`, `chooseOption`, `replay`, `newGame`.

## 3. Game state shape

```ts
interface GameState {
  version: number;                 // SAVE_VERSION
  seed: number; rng: number;       // seeded random state
  festivalId: 'village-green';
  attempt: number;                 // 1, then +1 per replay
  phase: 'prep' | 'day' | 'results';
  cash: number;                    // starts at 20,000
  reputation: number;              // 0..100, starts at 50
  daysToGates: number;             // 30 → 0
  ticketPrice: number;             // pending price takes effect next day
  pendingTicketPrice: number | null;
  ticketsSold: number;             // from the curve, for display and emails
  bands: Record<BandId, BandRuntime>;  // talks state per band
  lineup: { headliner?: Booking; support?: Booking; opener?: Booking };
  facilities: { plots: (FacilityTypeId | null)[]; emergencyUnits: Record<FacilityTypeId, number>; spent: number };
  inbox: Email[];                  // {id, templateId, day, vars, read, buttons}
  tutorial: { skipped: boolean; seen: string[]; current: string | null };
  day: { minutes: number; speed: 1 | 2; paused: boolean; queue: ScheduledEvent[];
         active: ActiveEvent | null; choices: EventChoice[]; eventCost: number;
         customerDelta: number; bandDelta: number; repDelta: number; fine: number } | null;
  results: FestivalResults | null; // stars, money lines, satisfactions, newspaper
}
interface BandRuntime { talks: 'open' | 'countered' | 'signed' | 'closed'; patience: number; mood: number;
  counter?: Offer & { expiresDay: number }; rounds: OfferRound[] }
interface Offer { fee: number; slot: Slot; merchPct: number }
interface Booking extends Offer { bandId: BandId; askAtRep: number; requiredFee: number } // askAtRep feeds L; requiredFee (after slot, merch and emerging adjustments) feeds fee generosity
```

## 4. Data files (`src/data`)

Each file has a matching type in `src/core/content.ts`. The JSON is hand-written from CONTENT.md in step 3, with an `npm run content` script that regenerates it (Node 22 runs `.ts` directly, so no new dependency).

| File | Shape |
| --- | --- |
| `tuning.json` | Every constant in spec §4 plus the negotiation, decision and band mood numbers, grouped as `economy`, `attendance`, `satisfaction`, `reputation`, `merchSlotWeights` (per festival), `negotiation`, `decisions` and `bandMood`. Built in step 2; see the file itself for the full list. Game-flow numbers (counter expiry, day length, price slider) are added in the step that uses them. |
| `bands.json` | `[{id, name, genre, tier, reputation, legacy, hype, monthlyListeners, trend, feeAsk, merchAsk, festivals:[1,2,3], emerging, notes}]` (all 18 bands) |
| `festivals.json` | `[{id, number, name, capacity, days, fairPrice, startingCash, slots:['opener','support','headliner'], facilityTypes:['toilets','food'], plotCount, targets:{customers, bands, profit}, decisionCount, prepDays, newspaper, startingReputation, draft}]`. Festival 1 is complete; 2 and 3 are `draft: true`. |
| `facilities.json` | `[{id, name, emoji, servesPerUnit}]` |
| `events.json` | `[{id, festivals, trigger:'scripted'|'random', chance?, title, body, randyLineId?, options:[{key:'A'|'B'|'C', label, costShareR, customers, bands, reputation, fine?:{chance, shareR}}]}]` |
| `emails.json` | `[{id, from, subject, body, trigger:{type:'day'|'action'|'condition', ...}, buttons:[{label, action:{screen?|game?}}]}]` (the 21 emails) |
| `lines.json` | `{tutorial:[{id, trigger, text}], festival2:[…], festival3:[…], tips:{profit, customers, bands}, skip:"…"}` |
| `newspaper.json` | `{papers:{1:'The Village Gazette',…}, headlines:{0:[…],1:[…],2:[…],3:[…]}, opening:{customers,bands,profit}, closing:{queues,price,bands,money}, events:{noiseFine,…}, weakestIssue:{queues:'long queues',…}, spotlight}` |
| `timeline.json` | `{festivals:{1:{prepDays:30, stops:[{day:30, emails:['welcome']}, {day:26, …}], facilityDeadline:3, lineupLock:1, dayEvents:[{eventId:'food-queue', at:'13:00'}, {eventId:'band-late', at:'14:30'}, {eventId:'noise', at:'20:00'}], headlinerOn:'21:00'}}, salesCurve:[{fromDay, toDay, share}]}` |

## 5. Screens and how they connect

```
MainMenu (poster) ─Continue planning / New game─► PrepHub ─► Inbox ─► (an email's buttons jump to a screen)
   ▲  └─Settings                                    ├─► Lineup ─Make an offer─► Negotiation
   │                                                ├─► Site · Tickets · Finances
   │                                                └─Continue (day 0) ─► FestivalDay ─► Results ─Replay─► PrepHub (day 30)
   └──────────────────────────────── Settings (export/import save, download log, tutorial on/off)
```

- **Shared components** (`src/components`): `Button` (at least 44px), `TopBar` (days to gates and cash, safe-area padding), `MenuRow`, `StarMeter`, `RandyBubble` (line plus Skip), `EmailList`, `EmailView`, `BandCard`, `OfferRow`, `Slider`, `DecisionCard`, `PlotGrid`, `NewspaperReview`.
- **Next festival** on Results stays disabled with "Coming soon" in milestone 1, because festival 2 arrives in milestone 4. Replay always works.
- **Screen files:** each screen in `src/screens` is `X.tsx` with a matching `X.module.css`. Global tokens live in `src/styles/global.css`.

## 6. Save and playtest log

- **Save:** key `fm.save.v1` in localStorage holds `{version, savedAt, state}`. It autosaves after every preparation day advance, at the start of the festival day (closing mid-day resumes at gates open), and on reaching results. Settings has **Export** (downloads `festival-manager-save-YYYY-MM-DD.json`) and **Import** (file picker; checks the version and shape, then loads).
- **Playtest log:** one JSON record per event, kept in localStorage under `fm.log`, capped at 5,000 records with the oldest dropped first. The spec allows localStorage when the log is small, which avoids IndexedDB in milestone 1.
  - **Record:** `{t: ISO time, session: id, festival, attempt, kind, ...payload}`
  - **Kinds:** `session_start`, `session_end` (on `pagehide`), `screen`, `negotiation_round {band, offer, score, result}`, `event_choice {event, option, seconds}`, `festival_result {stars, profitPct, customerSat, bandSat, attendance}`, `replay`, `quit`.
- **Log download:** Settings → Download log builds a `.jsonl` Blob and uses `navigator.share` with a file where available, otherwise an `<a download>` link.

## 7. Build order (one PR each, tests and build green before every push)

1. **Step 2, core rules and tests:** `random`, `tuning.json` + `tuning.ts`, `economy`, `negotiation`, `events`, `stars`, with the spec §5 and §12 test vectors. No screens.
2. **Step 3, content as data:** all the JSON files with their types, `scripts/build-content.ts` (`npm run content`), and a data completeness test.
3. **Step 4, preparation phase:** `game.ts` reducer, `calendar`, `emails`, `tutorial`, `app/store`, then the MainMenu poster, PrepHub, Inbox, Lineup, Negotiation, Site, Tickets and Finances screens.
4. **Step 5, festival day:** the clock tick, the event schedule and `projectLive`, then the FestivalDay screen with its scene, meters, chips and decision cards.
5. **Step 6, results, save and logging:** `results.ts` and the newspaper, the Results screen, `save.ts` and its adapter, `playtestLog.ts` and its adapter, and Settings. Then play through festival 1 end to end.
6. **Step 7, milestone check:** the §13.1 checklist, phone and tablet layouts, the playtest link, and the playtester checklist.

## 8. Files to create

**Config and scripts:** `scripts/build-content.ts`, `scripts/content/markdown.ts` (table reading), `scripts/content/convert.ts` (CONTENT.md to content), `scripts/content/structure.ts` (ids, button actions and clock times the doc doesn't spell out) and `scripts/content/files.ts`, plus edits to `package.json` (`content` script) and `tsconfig.json` (include `scripts`, allow `.ts` imports for Node).

**src/core:** `random.ts`, `math.ts` (clamp and sum), `tuning.ts`, `content.ts`, `economy.ts`, `negotiation.ts`, `calendar.ts`, `emails.ts`, `events.ts`, `stars.ts`, `results.ts`, `tutorial.ts`, `game.ts` (replaces the placeholder), `save.ts`, `playtestLog.ts`, `types.ts` (shared ids and unions).

**src/data:** `tuning.json`, `bands.json`, `festivals.json`, `facilities.json`, `events.json`, `emails.json`, `lines.json`, `newspaper.json`, `timeline.json`.

**src/app:** `App.tsx`, `store.tsx` (context, `useGame`, dispatch, autosave and log hooks), `storage.ts` (localStorage save and log), `files.ts` (download, share, import), `useFestivalClock.ts`.

**src/screens** (each with a `.module.css`): `MainMenu`, `PrepHub`, `Inbox`, `Lineup`, `Negotiation`, `Site`, `Tickets`, `Finances`, `FestivalDay`, `Results`, `Settings`.

**src/components** (each with a `.module.css` where it needs one): `Button`, `TopBar`, `MenuRow`, `StarMeter`, `RandyBubble`, `EmailList`, `EmailView`, `BandCard`, `OfferRow`, `Slider`, `DecisionCard`, `PlotGrid`, `NewspaperReview`, `AlertChip`.

**src/styles:** `global.css` (extend the tokens).

**tests:** `random.test.ts`, `economy.test.ts`, `negotiation.test.ts`, `events.test.ts`, `stars.test.ts`, `results.test.ts`, `calendar.test.ts`, `emails.test.ts`, `tutorial.test.ts`, `save.test.ts`, `playtestLog.test.ts`, `data.test.ts`, `game.test.ts` (a full scripted playthrough of festival 1, deterministic from a fixed seed). The placeholder `tests/game.test.ts` is replaced.

**docs:** `PLAN.md` (this plan), plus additions to `DECISIONS.md`.

## 9. Spec issues and decisions

**Decided with you:**
1. **Mud Pies test vector vs the emerging-band rule.** Emerging bands get a 10% discount on the required fee (`emergingDiscount`) and expect one slot higher. £378 × 0.9 × 1.1 = £374, so £380 for the opener is accepted.
2. **Rejection (score below 0.8)** costs a round and lowers mood. Talks close only when patience runs out. Email 5 is sent when the last round ends in a rejection.
3. **Fee generosity and L.** L uses the ask at festival reputation (ask × the reputation adjustment). Fee generosity follows the updated spec §4: fee paid ÷ the required fee after the slot, merch and emerging adjustments, so a deal accepted at a score of exactly 1.0 gives 0.5. This replaces the answer given during planning, because the spec uploaded to main now states it explicitly.
3a. **Merch above the ask** allows 2% less on the fee for every 5 points (spec revised 21 October). The band's share is paid out of real merch sales.
4. **Ticket sales in milestone 1:** tickets sold = forecast attendance × cumulative curve share. The box office emails show those numbers. Milestone 2 adds price-change timing and the early-headliner pull.

**My proposals** (you can override any of them):

5. **Slot distance:** +10% for each slot below what the band expects and -5% for each slot above, so a headline act offered the opener slot needs +20%.
6. **Counter-offer:** each term's gap is converted to its fee-equivalent multiplier, and the band changes the single term with the biggest one. If changing that term alone can't reach 1.0 (for example, a slot that is already taken or at the end of the bill), the band sets that term as close as it can and makes up the rest on the fee. Counters expire after 3 days (the email's `{days_left}`). Only empty slots can be offered or countered.
7. **Mood** is display only: it starts at 70 and drops by 15 for each offer scoring below 0.9. The spec says mood reaches the festival only through fee generosity, so it has no other effect on the numbers.
8. **Randy's market-rate hint** is centred on the required fee for the band's expected slot and merch ask (after the emerging discount). The OK, Close and Low verdicts compare each term with what the band wants: fee at 1.0 or more is OK and 0.9 to 1.0 is Close; slot and merch are OK when they meet or beat the band's wish, Close one step short, and Low beyond that.
9. **Noise complaint** has two options (A and B), unlike the "three options" rule in spec §6. Events support two or three options.
10. **The food queue event** triggers only if food capacity is below 1.2 × attendees (spec revised 21 October); otherwise Randy notes there was no queue and it counts as a prevented problem. Options: A is a pop-up food van (3% of R), B is a water and snacks point (0.5%, customers -2), and C is do nothing (customers -8). Option A adds no capacity.
11. **Best and worst area** for the newspaper: compare each area's margin over its target (satisfaction minus target; profit/spend minus target). If customers are the worst area, the closing line uses "Price" when the ticket price is above perceived value, otherwise "Queues". `{facility}` is the type with the fewest units, and `{band_name}` is the booked band with the lowest fee generosity. The headline variant is picked with the seeded random generator.
12. **Spending:** the overhead (£4,625) is committed from day 30, and offers or facilities that would take cash below zero are blocked, with a message.
13. **Ticket price:** the slider runs from £10 to £50 in £1 steps, starting at the fair price (£25). All tickets are charged at the final price; the spec has a single `price` in the income formula.
14. **Facilities:** the map has 12 plots, one unit per plot. Units can be removed for a full refund until the deadline (days to gates ≥ 3). On days 2 and 1 new units cost 1.5×. Email 12 is sent once per day in which bookings changed.
15. **The lineup locks** when days to gates reach 1. Email 7 (emerging band gets in touch) isn't on the festival 1 timeline, so I propose The Mud Pies on day 20. The tutorial "Targets panel" is the targets row on PrepHub, and "Budget screen" means Finances.
16. **Replay** resets to day 30 with a new seed derived from the old one, increments `attempt` and logs `replay`. The festival 1 Next festival button shows "Coming soon".
17. **Hype** has no effect on the numbers in milestone 1 (it isn't in any formula). The headliner announcement's "small hype boost" is display only until milestone 4.
18. **No base event penalty.** The spec revision removed the flat -0.06 from customer satisfaction; only the event options chosen change it.

## 10. Verification
- `npm test`: the economy matches every §12 figure within rounding (the advance vector included). The negotiation results match the three §5 vectors. The full scripted playthrough reaches results with the same stars from the same seed, and replay resets correctly. The save round-trips.
- `npm run build` passes, and the CI deploy goes green.
- Manual playthrough in Chromium at 360×740 and 820×1180 (Playwright screenshots). On the playtest link: new game, book three bands, place facilities, set a price, Continue to day 0, make the three decisions, read the review, Replay. Then reload mid-preparation to check the autosave, and export, import and download the log from Settings.

## 11. Spec revision of 21 October

The spec and content uploaded to main on 21 October change the plan as follows.

- **Economy:** overhead is 0.35 × R. Bands get their merch split of real merch income (17% of Pt per head), weighted by slot (festival 1: headliner 0.5, support 0.3, opener 0.2), and the payout is part of spend. The section 12 test vectors were updated to match.
- **Preparation decisions:** the sound limiter (day 20, always) and slow sales (day 14, only if forecast attendance is below 80%) arrive as inbox emails with the same three-option card as the festival day. They're resolved by `events.resolveOption`, built in step 2. Step 3 adds them to `events.json` and `emails.json` (emails 22 and 23), and step 4 wires them into the inbox.
- **Prevented problems:** a sound limiter or early finish stops the noise complaint, and enough food skips the food queue. Both are recorded as successes for the results and the newspaper's new success line.
- **Live forecast:** a "Forecast before events" panel on PrepHub (compact on Lineup, Site, Tickets and Finances) uses `economy.evaluateFestival` with no events. It shows attendance, income, spend, profit, both satisfactions, the stars the plan would earn, and the queue risk. Gates opening store a snapshot. New component in step 4: `ForecastPanel`.
- **Results:** forecast against actual, up to three causes plus one thing that went well, and cash shown as a shortfall when negative. Built in step 6.
- **Save:** must also hold the random seed and any pending decision, so loading never rerolls an outcome. The game state already holds the generator state; step 6 adds the pending decision.
- **Accessibility basics:** readable text, contrast, never colour alone, a reduced-motion setting in Settings, and 44px touch targets.

