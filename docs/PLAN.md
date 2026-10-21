# Plan: spec changes of 21 October (milestone 1a, playtest revision)

## Context
The first playtests found the inbox felt like admin, and the competitor research says to get players to a real decision fast. The spec changes (now written into docs/MVP_SPEC.md and docs/CONTENT.md) replace the inbox with a Promoter's Board of action cards. They also:
- show the forecast as a range with break-even and cash at risk
- name the causes of the result as Your call or Luck
- add a standby set that unlocks a better option on the day
- make saves survive phones
- confirm one food queue rule

This plan changes the existing milestone 1 code to match, in small steps with the Board first. Each step is one PR, and `npm test` and `npm run build` pass before each push.

**Your answers to the open questions:**
- Demand variation is **±8%** (TUNE), rolled once at the gates.
- The **opener** stands by. The day option becomes "The opener plays their standby set".
- Results causes come in **one list**: plan choices, day choices and luck, measured against a fair-value baseline so every star change adds up.
- **npm run content** is built in the last step.

## Step 0: this PR (docs only, no code)
- Fix the docs to match your answers:
  - The standby set comes from the opener's agent and needs an opener booked.
  - Day option D is "The opener plays their standby set".
  - The demand variation is ±8% (TUNE).
- Move the milestone 1 plan to `docs/PLAN_MILESTONE1.md` (DECISIONS.md links to it) and save this plan as `docs/PLAN.md`.
- Add decisions 66 onward to `docs/DECISIONS.md`: the four answers, and the shortened welcome line.
- Run tests and build, commit, push, open the PR.

## Step 1: Promoter's Board (split into 1a, 1b, 1c)

### 1a. Core: cards, the summary and Continue (save version 2)
- **New `src/data/cards.json`** replaces `emails.json`. Each card has: id, type (decision, negotiation, task, warning, summary), from, trigger, `when` condition, deadline rule, title, body, button action. Summary lines live in the same file. New types go in `src/core/content.ts`.
- **New `src/core/cards.ts`:**
  - `Card` holds id, templateId, type, shownDay, deadlineDay, vars, status (open, done or expired), and optional bandId and decision.
  - `refreshCards(state)` runs after every action and every day. It adds cards whose triggers fire and closes cards whose job is done (for example, book-headliner closes when a headliner signs). It turns book-headliner into no-headliner at day 10, and expires cards past their deadline.
  - `boardCards(state)` returns the open cards, at most 4, most urgent first: due today, then decision, warning, negotiation, task, then deadline.
  - It reuses `fillTemplate` (`src/core/format.ts`) and the condition logic now in `game.ts` (`conditionMet`, `sendStopEmails`).
- **`src/core/game.ts`:**
  - `inbox` becomes `cards`, plus `summary: SinceLastTime | null` and `history: HistoryEntry[]`.
  - `sendEmail` is replaced by `addCard` and `addSummaryLine`.
  - `continueTime` builds the summary by comparing the state before and after: days, tickets sold since the last stop, the forecast range, and new cards.
  - Continue stops on the next day with a new card, a deadline or the gates.
  - `pendingDecisionEmail` becomes `cardDueToday`, which drives "Decide first".
  - `chooseDecision` takes a card id.
  - New actions: `dismissSummary` and `openHistory` (the latter for the log).
- **`src/core/save.ts`:**
  - `SAVE_VERSION` becomes 2.
  - `migrate()` chains v1 → v2:
    - Pending decision emails become decision cards.
    - A standing counter becomes a negotiation card.
    - Info emails go to history.
    - Then `refreshCards` runs.
  - A save it can't migrate gets a clear message.
- **Tests:**
  - Rewrite the email assertions in `tests/game.test.ts` as card assertions.
  - New `tests/cards.test.ts`:
    - A new game has exactly one card, "Book your headliner".
    - Cards close and expire as they should.
    - The Board shows at most 4 cards, in priority order.
    - The summary lines are right.
  - A v1 save fixture migrates in `tests/save.test.ts`.

### 1b. UI: the Board, tabs and Randy on cards
- **New `src/screens/Board.tsx`** replaces `PrepHub.tsx` and `Inbox.tsx` (both deleted). It holds:
  - the top bar (countdown, and Continue or "Decide first", which scrolls to the due card)
  - `ForecastStrip` (tap it to open the full `ForecastPanel` in a sheet)
  - the action cards
  - the dismissible "Since last time" panel
- **New components:** `ActionCard` (portrait emoji, name, title, deadline chip, one button; red when the deadline is 2 days or less), `TabBar` (Board, Lineup, Site, Tickets, Money; safe-area padding), `SummaryPanel`, `ForecastStrip`. Decision cards expand in place using the existing `DecisionCard`.
- **Other screens:**
  - Lineup gains an "In talks" section. `NegotiationList` is removed.
  - `Finances.tsx` becomes `Money.tsx`, with a History list.
- **Randy:** tutorial lines carry a `showsOn` anchor (the card or tab) in `lines.json`. `RandyBubble` takes an anchor and renders inside that card or tab. The welcome bubble is the only line before the first card.
- **Routes in `src/app/store.tsx`:** tabs replace the back stack for the top level; Negotiation and Settings stay as pushed screens.

### 1c. Playtest log additions
- New log kinds in `src/core/playtestLog.ts`:
  - `first_negotiation` (seconds from new game; the start time is held in `src/app/store.tsx`)
  - `card_shown`, `card_acted` (seconds shown, past deadline or not), `card_expired`
  - `history_opened`
- Tests in `tests/playtestLog.test.ts`.

**Step 1 acceptance:**
- No preparation screen shows text that needs no action and can't be dismissed in one tap.
- A scripted new player reaches a negotiation within 90 seconds of starting.
- Layout audit at 360 and 820 px.

## Step 2: Saves that survive phones
- **When it saves (`src/core/save.ts`):** `shouldAutosave` saves after every commitment: a band signed, a facility placed or removed, the price set, a card decided, a festival-day card opening and each day decision. Clock ticks between commitments aren't saved, so a reload resumes at the last committed moment and never rerolls.
- **Text code:** `exportCode` / `importCode` turn the save into a text code (`FM1:` plus UTF-8-safe base64 of the JSON) and back.
- **Settings:** Export save copies the code (with a Copy button); Import save is a paste box with a clear error message. The file download stays only for the playtest log.
- **Persistent storage:** `src/app/storage.ts` calls `navigator.storage.persist()` on first launch and ignores a refusal. It also saves on `visibilitychange` (hidden) and `pagehide`.
- Tests: the code round-trip, a damaged code, saving after each commitment, and a mid-card reload.
- A manual real-phone check (lock, switch apps, refresh, offline) goes on the playtest checklist.

## Step 3: Forecast range, break-even, cash at risk, demand luck, one food queue rule (save version 3)
- **Tuning:** add `attendance.demandVariation: 0.08` (TUNE) to `src/data/tuning.json`.
- **`src/core/economy.ts`:**
  - `evaluateFestival` takes an optional `demandFactor` (1 + v), applied to the attendance share before the cap.
  - New `breakEvenAttendees(plan)`: fixed costs / (price + net vendor income per head), where net vendor income is the per-head spend at full service less the bands' merch cut.
  - New `cashAtRisk(lowOutcome)`.
- **`src/core/game.ts`:**
  - `forecastRange(state)` gives low, middle and high.
  - The gates-open snapshot stores all three.
  - `newDay` rolls v with the seeded generator and stores it as `day.demandRoll`.
  - `liveOutcome` uses it.
- **Food queue rule:** `eventFires('foodShort')` and the forecast both use `economy.foodQueueRisk` (they already share the 1.2 × attendees rule). The day uses the actual attendees, the forecast the middle value. Add a test that both agree for the same attendees, and note the rule in the spec's test vectors.
- **UI:** the forecast strip, panel, compact forecast and Money show the range, break-even, a red "capacity below break-even" warning and cash at risk.
- **Save v3:** `migrate` v2 → v3 sets `demandRoll = 0` for saves already on the day or at results, so no outcome changes.
- **Tests:** range ordering, the break-even formula (festival 1 vector), cash at risk, and deterministic rolls. The section 12 vectors are unchanged at v = 0.

## Step 4: Standby set and the prepared response (save version 4)
- **Data:**
  - `events.json` gets a `standby-set` prep decision (from the opener's agent; A costs 0.5% of R, TUNE; B free, bands −2, `agreeChance: 0.5`; C declines).
  - `band-late` gets option D, "The opener plays their standby set" (cost 0, customers 0, bands +2 TUNE, `requires: 'standby'`).
  - `cards.json` gets the standby card (day 12, once an opener is booked) and a standby-answer summary line.
- **`src/core/events.ts`:** `OptionKey` adds `'D'`. `resolveOption` rolls `agreeChance` and returns `agreed`. Options with `requires` are filtered by a new `availableOptions(event, state)`.
- **Other code:** `game.ts` records `standbyAgreed`. `results.ts` adds a "prepared response" success line to `newspaper.json`. `DecisionCard` and the festival day card show up to 4 options.
- **Save v4:** standby defaults to not agreed.
- **Balance:** new `tests/balance.test.ts` with scripted careless, average and skilled players. It checks that preparing is about as good as reacting on the day or slightly better, never required: skilled with standby ≥ skilled without, by at most a small margin, and both pass.

## Step 5: Results with named causes (Your call or Luck)
- **New `attributeCauses(state)` in `src/core/results.ts`:** start from the actual outcome and remove one factor at a time, in a fixed order, back to a fair-value baseline. The order is:
  1. Luck: the demand roll, then the noise fine roll and the standby answer.
  2. Your call: each day choice (option chosen vs the best option), the ticket price vs the fair price, facilities vs serving the crowd, empty slots, and band pay vs the asking fee.

  Because the removal is sequential, each factor's change in attendance, profit and both satisfactions adds up exactly to actual minus baseline.
- **Showing the causes:**
  - Show the 2 or 3 largest by their effect on star scores, each with its size ("−38 attendees", "−6 crowd points") and a Your call or Luck tag.
  - If more remain, add one "Other" line, so nothing is unexplained.
  - Every star whose score changed lists at least one cause.
- **Randy's tip:** maps the largest Your call cause to the new tips table in `lines.json`, falling back to the weakest star.
- **`src/screens/Results.tsx`** shows the causes with their tags and the forecast range against the actual.
- **Tests:** the causes sum to the difference for several seeds, each changed star has a cause, the tags are right, and the tip picks the largest Your call cause.

## Step 6: npm run content
- New `scripts/build-content.ts` (run by Node 22; no new dependency) parses the CONTENT.md tables into the JSON files: bands, festivals, events, cards, lines, newspaper, timeline. Festivals 2 and 3 are marked as drafts.
- Hand-only fields (ids, trigger keys) come from columns added to the tables where needed.
- New `content` script in `package.json`.
- Test: the generator's output equals the committed JSON.

## Step 7: Check
- Run through the 1a acceptance criteria.
- Layout audit at both sizes (the existing Playwright audit script).
- Update `docs/PLAYTEST.md` with the real-phone save checks and the questions the spec now asks: can players explain their result, and do they start another festival.

## Save migration summary
Version 1 is today's save.
- **v2 (step 1):** inbox becomes cards and history.
- **v3 (step 3):** demand roll, 0 for saves already on the day or at results.
- **v4 (step 4):** standby flags.

`deserialise` runs the migrations in order. A save from a newer version, or one that fails to migrate, shows a clear message and is left untouched in storage.

## Critical files
- **Core:** `src/core/game.ts`, new `src/core/cards.ts`, `src/core/save.ts`, `src/core/economy.ts`, `src/core/events.ts`, `src/core/results.ts`, `src/core/content.ts`, `src/core/playtestLog.ts`.
- **Data:** `src/data/cards.json` (new; `emails.json` removed), `events.json`, `lines.json`, `newspaper.json`, `tuning.json`.
- **Screens:** new `src/screens/Board.tsx` and `src/screens/Money.tsx`; `PrepHub`, `Inbox` and `Finances` removed.
- **Components:** new `TabBar`, `ActionCard`, `SummaryPanel`, `ForecastStrip`; `RandyBubble` and `DecisionCard` change.
- **App:** `src/app/store.tsx`, `src/app/storage.ts`, `src/app/App.tsx`.

## Verification
- **Every step:** `npm test` and `npm run build`, and the Playwright playthrough and layout audit in Chromium at 360 × 740 and 820 × 1180.
- **After step 1:** time from a new game to the first negotiation, and no info-only text.
- **After step 2:** reload mid-card and import a pasted code.
- **After steps 3 to 5:** check that the causes add up on the results screen.
- **After merging:** the deploy run is green and the playtest link updates.
