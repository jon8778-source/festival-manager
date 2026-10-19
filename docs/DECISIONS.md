# Decisions

Decisions made where the spec was unclear or needed a concrete choice.

- **Step 0, base path:** the site is published at `/festival-manager/` on GitHub Pages, so `vite.config.ts` uses that base path everywhere (the dev server is at http://localhost:5173/festival-manager/). If the repository is renamed, update the base path to match.

## Milestone 1 plan (approved 19 October 2026)

The full list is in section 9 of [PLAN.md](PLAN.md). In short:

1. **Emerging bands** get a 10% discount on the required fee (`emergingDiscount` in tuning.json) and expect one slot higher than their tier. This makes the Mud Pies test vector work: £378 × 0.9 × 1.1 = £374, so £380 for the opener is accepted.
2. **A rejection** (score below 0.8) costs a round of patience and lowers mood. It doesn't end talks; talks close only when patience runs out.
3. **Fee generosity** uses the required fee after the slot, merch and emerging adjustments, following the updated spec §4. Lineup quality L uses the ask at festival reputation.
4. **Merch** offered above the band's ask doesn't lower the fee (updated spec §5).
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
