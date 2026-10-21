# Decisions

Decisions made where the spec was unclear or needed a concrete choice.

- **Step 0, base path:** the site is published at `/festival-manager/` on GitHub Pages, so `vite.config.ts` uses that base path everywhere (the dev server is at http://localhost:5173/festival-manager/). If the repository is renamed, update the base path to match.

## Milestone 1 plan (approved 19 October 2026)

The full list is in section 9 of [PLAN_MILESTONE1.md](PLAN_MILESTONE1.md). In short:

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


## Step 4: preparation phase (21 October 2026)

27. **Content data** for this step was written by hand into `src/data` (all 18 bands, festival 1, facilities, the two preparation decisions, the festival 1 emails, Randy's festival 1 tutorial lines and the festival 1 timeline). Step 3 (the `npm run content` generator and festivals 2 and 3 as drafts) hasn't been built yet; when it is, it should produce these same shapes.
28. **The live forecast panel and the two preparation decision emails** are included, as the approved plan puts them in this step, even though the step 4 prompt didn't name them.
29. **Continue** moves one day at a time and stops on a timeline day or as soon as any email arrives, so a condition email (for example "Mind the queues") is also a stop. It won't move while a decision email is unanswered.
30. **"Mind the queues"** is sent the first time tickets sold exceed the people the site can serve, so with no facilities built it arrives with the first sales (day 24).
31. **"Sales are slow"** (email 10) is checked only on the sales update days, once per festival, so it doesn't fire before the player has had a chance to book anyone.
32. **The tutorial "Forecast panel first shown" line** is cued with the targets line the first time the hub opens. "Site map opens" uses `{capacity}` instead of a fixed 500.
33. **Randy's Skip button** first shows his skip line ("Want to skip the chat?…") with Skip the chat and Keep chatting.
34. **{cash} in the welcome email and the budget line** is the budget (£20,000), not cash after the overhead; the top bar shows cash after the overhead.
35. **Before tickets go on sale** (day 26) a price change applies at once; after that, from the next day.
36. **Counter-offers** are valid until three days after they're made and then lapse silently (the email's buttons switch off). A new offer replaces any standing counter.
37. **A player walking away** sends no email and cues no Randy line; the "Band walks away" line and emails are for the band running out of patience.
38. **Festival day** shows a placeholder with the forecast snapshot until step 5. There is no save yet (step 6), so reloading the page starts again.
39. **New tuning numbers** in `tuning.json`: `decisions.salesSlowEmailThreshold` (0.6) and a `prep` group (counter expiry 3 days, nearly sold out 90%, ticket price slider £10 to £50 in £1 steps, negotiation fee step £10).

## Step 5: festival day (21 October 2026)

40. **The clock** lives in the core: the screen sends `tick` actions with real elapsed seconds (every 250 ms, at most 1 second per tick so a backgrounded tab doesn't skip the day). 12 game hours take 300 real seconds at 1x (`tuning.festivalDay`); 2x halves that.
41. **The day waits for the player** to tap Open the gates, so it doesn't start running behind Randy's "Gates open tomorrow" email.
42. **Response time** is the real seconds a decision card was open, counted by the ticks that arrive while the clock is held. It's stored with each choice for the playtest log (step 6).
43. **Festival 1 timings** are data in `timeline.json`: food queue at 13:00 (only if food can't cover 1.2 x attendees), band running late at 14:30, noise complaint at 20:00, the support act on at 15:00 and the headliner at 21:00.
44. **Prevented problems:** the sound limiter or the early finish stops the noise complaint, and enough food stops the food queue. Both are recorded in `day.prevented`, shown as chips and in the results, and Randy says his "prevented" line.
45. **Event card text** for the food queue and the band running late isn't in CONTENT.md, so the cards use a short line built from the event table ("There's a long queue at the food stall…", "Your support act is stuck on the A-road…"). The noise complaint uses Mrs Hartley's email text.
46. **Randy's "Queue fixed" line** follows option A on the food queue. Option A on any event cues `fixed:<event>`; only the food queue has a line for it in festival 1.
47. **The star meters** show the live outcome (the plan plus every choice so far) against the targets. Each bar is drawn relative to its target, with the target marker two-thirds of the way along, so the 5% profit target is as readable as the satisfaction targets.
48. **At midnight** the phase moves to `results`, and a placeholder results screen shows the stars, the figures and each choice with its response time until the newspaper (step 6).

## Step 6: results, save and playtest log (21 October 2026)

49. **Results are derived, not stored.** `festivalResults(state)` works the result and the review out from the final state. The headline variant is picked with a generator seeded from the game seed and attempt, so a loaded save shows exactly the same review and nothing extra needs saving.
50. **Cash after the festival** is the budget plus profit (festival 1 has no advance). A negative figure is shown as a shortfall.
51. **The opening line** (best area) appears only when that area met its target. In a festival that misses every target, praise would contradict the stars. The closing line, event line and success line follow the spec.
52. **"{weakest_issue} spoil the mood"** starts a sentence, so the template uses a capitalised version (`{weakest_issue_cap}`). With no headliner booked, headlines that name the headliner aren't picked.
53. **Causes** are ranked by a rough size in satisfaction points: queues (0.35 × the unserved share), an overpriced ticket, empty slots, low pay, options that cost goodwill, a noise fine and a loss. The top three are shown. "Went well" names a prevented problem first, otherwise the best area.
54. **The success line** picks, in order: sold out, no food queue, the sound limiter (option A only, since the line names the limiter), then a delighted headliner.
55. **Randy's results lines and the tip** show on the results screen even when the tutorial was skipped, because the tip is part of the result.
56. **Replay** starts the festival again from day 30 with a new seed taken from the old generator, attempt + 1, and everything else reset. Randy doesn't repeat lines already seen. Next festival is disabled: "coming soon" after a pass, "needs 2 stars" after a fail.
57. **Autosave** writes during preparation on every change (not just each day, so a reload never loses a booking), once when the gates are about to open (so closing mid-day resumes at the gates and never rerolls an event), and once on reaching the results. Storage errors are ignored so the game keeps running in private browsing.
58. **The playtest log** is kept in localStorage (`fm.log`, capped at `tuning.playtestLog.maxRecords`, 5,000, oldest dropped). Records for game actions are worked out by comparing the state before and after each action, so the reducer stays free of logging. A "quit" is starting a new game over an unfinished one. Preparation decisions are logged as `prep_decision`.
59. **Downloads** (the log as .jsonl and the save export) use the device share sheet where the browser can share files, otherwise a normal download.
60. **Reduced motion** is a switch in Settings (stored in `fm.settings`) as well as the system setting. It stops the festival scene animating.
61. **Bug fixed:** an accepted offer's round was overwritten when the band was booked, so it was missing from the band's rounds and from the log.

## Step 7: milestone 1 check (21 October 2026)

62. **Milestone 1 against spec section 13.1:** everything in the criteria is built and was checked in a browser end to end. The playtest link was not published: every deploy on main failed at the Pages step with "404 Not Found… Ensure GitHub Pages has been enabled". The build itself passes. GitHub Pages has to be switched on in the repository settings (Source: GitHub Actions); that can't be done from code.
63. **Step 6 was not on main:** PR #4 was merged before the results, save and log commits were pushed, so this step's PR carries them.
64. **Fixes from the check:** Next festival was an active-looking button that did nothing after a pass (now plainly disabled); bands paid exactly their asking fee were listed as underpaid because of floating-point rounding; the "Crowd area" label on the site map had too little contrast (4.2:1, now above 4.5:1); the main menu's continue button now says what it does in each phase.
65. **Layout audit:** every screen was checked at 360 × 740 and 820 × 1180 for sideways overflow, touch targets under 44 px and text contrast below WCAG AA. There's a short playtester checklist in `docs/PLAYTEST.md`.

## Spec changes of 21 October (milestone 1a plan, approved 21 October 2026)

The changes from the playtests and competitor research are written into MVP_SPEC.md and CONTENT.md, and the build plan is in [PLAN.md](PLAN.md). The milestone 1 plan moved to [PLAN_MILESTONE1.md](PLAN_MILESTONE1.md).

66. **Demand variation** is ±8% (TUNE), rolled once with the seeded random module when the gates open. The forecast's middle value uses no variation; its range uses the two extremes.
67. **The standby set comes from the opener**, not the support act, because the band running late is the support act. The day option is "The opener plays their standby set". The card needs an opener booked.
68. **Results causes come in one list**, measured against a fair-value baseline, so plan choices (such as the ticket price), day choices and luck all appear. Causes are worked out by removing one factor at a time so their sizes add up exactly to the difference; anything beyond the top 2 or 3 goes in one "Other" line.
69. **npm run content** (never built in milestone 1) is built as the last step of the plan. Until then the JSON in src/data stays hand-written.
70. **Randy's welcome** was cut to two sentences for the "first two minutes" rule: "Randy Popping, forty years of muddy fields and missing headliners. Let's get you through your first festival without either."
71. **Emails that only gave information** became "Since last time" summary lines (sales, deals, lapsed offers, the headliner news) or were cut (booking confirmed, the venue's noise reminder, the review email). The sales-slow, nearly-sold-out and tickets-live emails are summary lines.
72. **New tip lines** for Randy, one per kind of Your call cause (price, queues, a thin bill, band pay, day decisions, spending), are drafts for review in CONTENT.md section 5. The weakest-star tips stay as the fallback.
