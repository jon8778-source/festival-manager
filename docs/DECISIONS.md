# Decisions

Decisions made where the spec was unclear or needed a concrete choice.

- **Step 0, base path:** the site is published at `/festival-manager/` on GitHub Pages, so `vite.config.ts` uses that base path everywhere (the dev server is at http://localhost:5173/festival-manager/). If the repository is renamed, update the base path to match.

## Milestone 1 plan (approved 19 October 2026)

The full list is in section 9 of [PLAN.md](PLAN.md). In short:

1. **Emerging bands** get a 10% discount on the required fee (`emergingDiscount` in tuning.json) and expect one slot higher than their tier. This makes the Mud Pies test vector work: £378 × 0.9 × 1.1 = £374, so £380 for the opener is accepted.
2. **A rejection** (score below 0.8) costs a round of patience and lowers mood. It doesn't end talks; talks close only when patience runs out.
3. **Fee generosity** uses the required fee after the slot, merch and emerging adjustments, following the updated spec §4. Lineup quality L uses the ask at festival reputation.
4. **Merch** offered above the band's ask allows 2% less on the fee for every 5 points (spec revised 21 October).
5. **Ticket sales in milestone 1:** tickets sold = forecast attendance × cumulative curve share, and the box office emails show these numbers. Price-change timing and the early-headliner pull come in milestone 2.
6. **Slot distance** is linear: +10% for each slot below what the band expects, -5% for each slot above.
7. **A counter** changes the single term with the biggest fee-equivalent gap. If that term alone can't reach 1.0, the rest goes on the fee. Counters expire after 3 days. Only empty slots can be offered.
8. **Mood** is display only (starts at 70, -15 for each offer below 0.9).
9. **The noise complaint** has two options, so events support two or three.
10. **Spending** can't take cash below zero during preparation. The overhead is committed from day 30.
11. **Ticket price slider:** £10 to £50 in £1 steps. All tickets are charged at the final price.
12. **Facilities:** 12 plots with one unit each, refundable until the deadline (days to gates ≥ 3), then 1.5× on days 2 and 1.
13. **The lineup locks** at days to gates 1. The emerging-band email arrives on day 20 (The Mud Pies).
14. **Replay** resets to day 30 with a new seed. Next festival shows "Coming soon" in milestone 1.
15. **Hype** is display only in milestone 1.
16. **The playtest log** uses localStorage (capped at 5,000 records) instead of IndexedDB in milestone 1.
17. **Browser APIs** live in `src/app/`, a folder CLAUDE.md doesn't list, so `src/core` stays pure.

## Step 2: core rules (21 October 2026)

18. **Slot and merch adjustments** are linear per step and multiply the required fee. Merch moves the fee in proportion to the points (2 points below a 10% ask is 0.4 of a step, so +1.6%), not in whole 5-point jumps.
19. **A merch counter** may ask for more than the band's merch ask, up to the 30% maximum, because the spec says the band moves the one term "just enough to reach 1.0". Only past 30% does the rest go on the fee. A slot counter never asks for more than the band's expected slot.
20. **Gaps for counters** are fee-equivalent multipliers: fee gap = base required fee ÷ offered fee, slot gap = the slot multiplier, merch gap = the merch multiplier. Ties go to fee, then slot, then merch.
21. **Counter fees** are rounded up to the whole pound so the counter always scores at least 1.0. The market-rate hint is rounded to the nearest pound.
22. **Attendees** stay fractional inside the core (420.9 in the section 12 vector) so the formulas match the spreadsheet; screens round them.
23. **Reputation** uses 0.7 × reputation + 0.3 × the average satisfaction (0.3 = 1 − carry), clamped to 0 to 100.
24. **Worst and best areas** compare each area's margin over its target (profit ÷ spend − target, satisfaction − target). Ties go to profit, then customers, then bands.
25. **The noise fine's** chance and size come from tuning.json; the event option only says it risks the fine (`risksFine`).
26. **Spec note:** section 4 says a £6,600 lineup gives L of about 0.75, but the formula gives 0.73 (£6,900 gives 0.75, as in section 12). The code follows the formula.


## Step 3: content as data (21 October 2026)

**How to edit content:** change `docs/CONTENT.md`, run `npm run content`, then `npm test`. If the doc and `src/data` don't match, the tests fail with "run npm run content". If the converter can't read something, it names the table and row.

27. **What comes from the doc and what doesn't.** Names, numbers, costs, effects, text and timings all come from CONTENT.md. A few things the doc doesn't spell out live in `scripts/content/structure.ts`:
    - stable ids for festivals and emails, and the slot ids;
    - placeholder art for facilities;
    - which screen each email button opens;
    - email triggers;
    - event conditions;
    - the phrases that name timeline moments.

    Adding a new email or a new kind of button means adding a line there too; the converter says so if it's missing.
28. **Festival day clock times** for the phrases in the events table: midday 13:00, early afternoon 14:30, afternoon 15:00, mid-afternoon 15:30, evening 20:00, during the headline set 21:30.
29. **Ids** are made from the names ("Food stall queue" becomes `food-stall-queue`), so renaming a band or event in the doc changes its id. Randy's line ids come from the "When" column with the bracketed part dropped (`food-queue`), unless that would clash (`lineup-screen-slots`).
30. **Preparation decisions** live in `events.json` with `phase: 'prep'` alongside the festival day events (`phase: 'day'`), because they use the same three-option card. Their `schedule` gives days to gates instead of a clock time.
31. **Decision email buttons** choose options A, B and C in order.
32. **The noise complaint after festival 1** ("then up to once per festival (50%)") is read as a 50% random event at festivals 2 and 3.
33. **Ticket sales windows** are stored as days to gates: on sale to 14, 14 to 7, 7 to 3, 3 to 0, and the festival day (0).
34. **Email 7** (an emerging band gets in touch) and email 10 (sales below 60%) are triggered by conditions the game checks in step 4. The 60% threshold will go into tuning.json then.
35. **Festivals 2 and 3** come from the doc as written and are marked `draft: true`, because the doc's introduction says so. Their slot ids (`support2`, `secondOpener` and so on) match `tuning.merchSlotWeights`.
