# Festival Manager: MVP specification

This is the build spec for the MVP. Content (bands, emails, lines) is in CONTENT.md. All money is in pounds. Satisfaction, reputation, hype and legacy are 0 to 100 in the UI and 0 to 1 inside the formulas.

## 1. Scope

**First playable (milestone 1):** festival 1 only (Village Green), about 12 minutes including the tutorial.
**Full MVP (milestone 4):** festivals 1 to 3, with the promoter advance, festival reputation carried between festivals, emerging bands that grow, and festival 3's second stage.

**Not in the MVP:** sponsorship; rewarded ads; merch discount and last-minute ticket levers; full escalating mentor tips (the MVP has one basic tip per star); the shop and HQ upgrades; camping, security and staff; festivals 4 to 10; weather beyond one light-rain event; the shareable front page; accessibility options; new game+; multiplayer; analytics services.

## 2. Game flow

1. **Main menu (poster):** the next festival's poster is the menu. It fills in as bands are booked. Buttons: Continue planning, New game, Settings.
2. **Preparation hub (inbox):** like Football Manager. An inbox plus a menu list: Inbox, Lineup, Negotiations, Site, Tickets, Finances. A countdown shows days to gates. Continue moves time to the next email or deadline.
3. **Festival day (live):** the festival runs in the background from noon to midnight. Time runs until a decision pops up, then pauses. The top bar shows the clock, the three star meters and alert chips.
4. **Results (newspaper):** a local newspaper review with the stars, then Next festival or Replay.

## 3. Time

- **Preparation length:** festival 1 is 30 days; festivals 2 and 3 are 60 days.
- **Continue:** jumps to the next email or deadline. Preparation should take about 6 to 7 minutes of real time.
- **Festival day:** noon to midnight in at least 5 minutes of real time (about 25 seconds per game hour at normal speed), with a 2x speed button. Time pauses at every decision.
- **Deadlines:** facilities can be booked at the normal price until day 3; after that only as emergency units at 1.5 times the price. The lineup locks the day before the festival.

## 4. Economy formulas

Constants live in one tuning config file (src/data/tuning.json) with these defaults.

| Constant | Default |
| --- | --- |
| Multi-day price uplift per extra day | 0.5 |
| Food, drink and merch spend per head (share of ticket price) | 0.45 |
| Lineup cost coefficient (used for lineup quality) | 0.85 |
| Facilities cost coefficient | 0.30 |
| Fixed overhead (share of full-scale ticket revenue) | 0.37 |
| Promoter advance top-up (share of full-scale ticket revenue) | 1.1 |
| Advance fee / fee on 3 stars | 12% / 6% |
| Reputation carry-over | 0.7 |
| Base event penalty to customer satisfaction | 0.06 |
| Noise fine (share of full-scale ticket revenue) / chance if ignored | 5% / 25% |

**Definitions**
- `Pt` (ticket price for the festival at fair value) = fair price x (1 + 0.5 x (days - 1))
- `R` (full-scale ticket revenue) = capacity x Pt
- `price` = the ticket price the player sets

**Budget**
- Festival 1: budget = cash (starts at £20,000).
- From festival 2: if cash < 1.1 x R, the promoter advances the difference, so budget = 1.1 x R. After the festival, the advance is repaid plus a fee of 12% of the advance (6% if the festival earns 3 stars).

**Costs (spend)**
- Lineup: the fees actually agreed in negotiation.
- Facilities: units bought x unit cost. Each unit of each type serves 100 people. Unit cost = 0.30 x Pt / 1.25 x 100 / number of facility types in play (2 at festival 1, 3 at festivals 2 and 3). This gives £300, £240 and £320 per unit.
- Fixed overhead: 0.37 x R (staff, upkeep and ground hire; covers the stage).
- Event costs: the cost of each event option chosen (a share of R).
- Spend = lineup + facilities + overhead + event costs.

**Lineup quality `L` (0 to 1)**
- `L` = min(1, (sum of the booked bands' fee asks at festival reputation / (0.85 x R))^(2/3)). It uses the asks, not the fees paid, so a good negotiation gets the same quality for less money.
- At festival 1, a typical lineup (about £6,600 of asks) gives L of about 0.75.

**Facilities investment `phi`**
- Capacity served = 100 x the smallest number of units across the facility types in play (one toilet block and one food stall together serve 100 people at festival 1). In milestone 1 this is one facilities score; milestone 3 tracks queues per type.
- `phi` = capacity served / (1.25 x capacity). Queue ratio = min(1, capacity served / attendees).

**Attendance (share of capacity)**
- Perceived value = Pt x (0.6 + 0.6 x L)
- Price effect = max(0.3, 1 - 1.1 x (price / perceived value - 1))
- Attendance = clamp((0.2 + 0.8 x L) x (0.75 + 0.5 x reputation) x price effect, 0, 1)
- Attendees = attendance x capacity

**Income**
- Tickets = attendees x price
- Food, drink and merch = attendees x 0.45 x Pt x min(1, capacity served / attendees)^0.5
- Merch decision results (festivals 2 and 3) as in CONTENT.md
- Profit = income - spend - noise fine (if fined)

**Satisfaction**
- Fair-price factor = clamp(1 - 2 x max(0, price / perceived value - 1), 0, 1)
- Customer satisfaction = clamp(0.35 x queue ratio + 0.30 x L + 0.08 x fair-price factor + 0.15 x reputation - 0.06 + event customer changes, 0, 1)
- Fee generosity per band = clamp((fee paid / fee ask - 0.8) / 0.4, 0, 1); use the fee-weighted average across booked bands
- Band satisfaction = clamp(0.25 + 0.40 x fee generosity + 0.20 x min(1, phi / 0.8) + 0.10 x attendance + event band changes, 0, 1)

**Stars**
- Profit star: profit / spend >= the festival's profit target
- Customer star: customer satisfaction >= target
- Band star: band satisfaction >= target
- 2 or more stars passes the festival. Fewer than 2 stars, or cash below zero after repaying the advance, is a soft fail: the player replays that festival from its start with everything reset (cash, reputation, bookings).

**Reputation**
- Festival reputation starts at 50.
- After a festival: reputation = 0.7 x reputation + 0.3 x average(customer satisfaction, band satisfaction) + any event reputation change.

## 5. Negotiation

- **Flow:** the player opens a band and makes the first offer on three terms: fee, bill position (with the other bands on the bill shown) and merch split (0 to 30%). The band's ask is hidden. Randy shows a market-rate hint: the required fee plus or minus 15% (narrower, plus or minus 8%, for bands the player has booked before). The band then accepts, counters or rejects.
- **Gate:** a band refuses outright if festival reputation is below its tier minimum (tier 1: 0, tier 2: 15, tier 3: 30, tier 4: 50, tier 5: 75): "Not at this festival yet."
- **Required fee** = ask x (1 + (band reputation - festival reputation) / 200), clamped to 0.8 to 1.4 times the ask. Reputations here are 0 to 100.
- **Bill position:** one slot below what the band expects needs 10% more; one slot higher allows 5% less.
- **Merch split:** each 5 points below the band's merch ask needs 4% more on the fee; each 5 points above allows 4% less.
- **Score** = offered fee / required fee after adjustments. 1.0 or more: accept. 0.8 to 1.0: counter (the band moves the one term with the biggest gap just enough to reach 1.0 and says why). Below 0.8: reject.
- **Patience:** 3 rounds. An offer scoring below 0.9 costs a round and lowers the band's mood. When patience runs out, talks with that band close for this festival only; every other band stays open.
- **Mood carries into the festival** through fee generosity in band satisfaction.
- **Expected slot:** tier 3 and above expect to headline at festival 1; tier 2 expects support; tier 1 expects opener. Emerging bands accept a lower fee but want one slot higher than their tier suggests.

**Test vectors**
- The Mud Pies (ask £450, reputation 18) at festival reputation 50: required fee = £378. An offer of £380 for the opener slot at their 10% merch ask is accepted.
- Dust & Diesel (ask £4,500, reputation 50) at festival reputation 50, headline slot, 20% merch: an offer of £3,900 scores about 0.87 and the band counters at £4,500.
- The Royal Mile (tier 4) at festival reputation 45: refused.

## 6. Events and decisions

- **Decisions per festival day:** 3 at festival 1, 4 at festival 2, 5 at festival 3, mixing scripted and random events (see CONTENT.md).
- Each event pauses time and shows a card with three options: A (pay to fix it), B (a cheap workaround) or C (do nothing). Each option applies: a cost as a share of R, a change to customer satisfaction, a change to band satisfaction, and sometimes a reputation change.
- **Noise complaint:** turn it down (customers -3, bands -5) or ignore it (25% chance of a fine of 5% of R).
- **Merch decision (festivals 2 and 3):** as in CONTENT.md.
- Record each choice and how long the player took to respond (for the newspaper and the playtest log).

## 7. Bands

- Stats: tier (1 to 5), reputation, legacy, hype (0 to 100), monthly listeners and a trend, fee ask, merch ask, emerging flag. The player sees reputation, hype and monthly listeners; legacy appears from festival 3.
- **After a festival (full MVP):** if a band's slot went well (customer and band satisfaction both beat their targets), its monthly listeners rise by about 20% (emerging acts) or 5% (others). Emerging bands also gain hype and reputation and move up a tier when they pass the next tier's reputation. Their agent sends the "are flying" email, and the newspaper can run a spotlight from festival 2.

## 8. Results

- The newspaper review is built from: a headline chosen by star count, an opening line from the best area, a closing line from the worst area, one event line if a big event happened, and a stats box (profit, crowd, band mood, stars). Templates are in CONTENT.md.
- **Band mood labels:** Delighted (75 and over), Happy (60 to 74), Grumbling (45 to 59), Furious (under 45).
- After a failed festival, Randy gives one basic tip on the weakest star (CONTENT.md).
- **Buttons:** Next festival (if passed) and Replay.

## 9. Ticket sales during preparation

- Sales build along the curve in CONTENT.md, scaled to the forecast attendance for the current lineup, price and reputation.
- A new ticket price takes effect from the next day. Signing a strong headliner early pulls sales forward.
- **Lineup announcement (festivals 2 and 3):** once the headliner is signed, the player can announce the lineup for a hype boost that pulls sales forward. Announcing late loses most of the boost.
- Emails from the box office report sales on the schedule in CONTENT.md.

## 10. Screens (portrait)

- **Main menu:** the festival poster (headliner large, then the other acts), days to gates, Continue planning, New game, Settings.
- **Preparation hub:** top bar with days to gates and cash; Randy's latest message; menu rows for Inbox (unread count), Lineup (slots filled), Negotiations (open), Site, Tickets (price), Finances; a Continue button.
- **Inbox:** a list of emails; each opens with its buttons, which jump to the right screen.
- **Lineup:** headliner, support and opener slots; a band list with tier, genre, monthly listeners and hype; a selected band card with Randy's market-rate hint and a Make an offer button; a summary line with ticket price, forecast attendance and forecast profit.
- **Negotiation:** band header (name, tier, genre, monthly listeners), festival and band reputation bars, legacy (from festival 3), hype and mood; an offer table with rows for fee, bill position (showing who else is on the bill) and merch split, each with Randy's market rate, the player's offer and a verdict (OK, Close, Low); the band's response with mood and rounds left; buttons Submit offer, Accept counter and Walk away.
- **Site:** a fixed map (no zoom) with the main stage, crowd area and facility plots; a build tray (food stall and toilets at £300 per unit at festival 1, the bar from festival 2); capacity and queue status. Tap a tray item, then tap a plot.
- **Tickets:** price slider with Randy's fair-price hint and the forecast attendance.
- **Finances:** budget, spend so far by category, forecast profit and the profit target; from festival 2, the promoter advance and its fee.
- **Festival day:** clock, Paused chip, speed button; three star meters (profit, crowd, bands); a live placeholder scene; alert chips; event cards with three stacked options.
- **Results:** the newspaper review, then Next festival or Replay.

## 11. Save and playtest log

- **Save:** one slot, stored as JSON in the browser's localStorage, autosaved at the end of each phase (preparation day, festival day, results). Include a version number, and add an export and import button in Settings so a save survives clearing the browser.
- **Playtest log:** store one JSON record per event in the browser (IndexedDB, or localStorage if small): session start and end, screen changes, each negotiation round (band, offer, score, result), each event choice (event, option, seconds to respond), festival results (stars, profit percentage, customer and band satisfaction, attendance), replays and quits. Add a button in Settings that downloads the log as a .jsonl file (and uses the device share sheet where available).

## 12. Test vectors (festival 1, no events)

Use these to check the economy code. Inputs: capacity 500, fair price £25 (so Pt = £25 and R = £12,500), reputation 0.5, price £25, booked fee asks totalling £6,900 (so L is about 0.75), fees paid equal to the asks (fee generosity 0.5), 4.69 units each of toilets and food (capacity served 469, so phi = 0.75).
- Perceived value = £26.25; price effect = about 1.052
- Attendance = about 84% (about 421 people)
- Customer satisfaction = about 67%; band satisfaction = about 72%
- Overhead £4,625; facilities about £2,814; lineup £6,900; spend about £14,340
- Income about £15,260 (tickets about £10,520; food, drink and merch about £4,740); profit about £920, about 6.4% of spend, which beats the 5% target
- With the advance rules at festival 2 (capacity 1,500, fair price £30, cash £20,500): R = £45,000, budget = £49,500, advance = £29,000, fee = £3,480 (or £1,740 with 3 stars)

## 13. Milestones and acceptance criteria

1. **Greybox (first playable):** a new game starts festival 1 with Randy's welcome. The player can book three bands through negotiation, place facilities, set a ticket price, Continue through preparation, play the festival day with its three decisions, and see the newspaper review with stars. Replay works. Save, load and the playtest log work. All unit tests pass, and the build is published to the playtest link.
2. **Economy:** every income and cost line is visible in Finances; ticket sales follow the curve; the box office emails show real numbers.
3. **Facilities:** food stalls and toilets are tracked separately, with queues per facility (the bar arrives at festival 2).
4. **Progression (full MVP):** festivals 2 and 3, the promoter advance, reputation carried over, emerging band growth and listener spikes, the lineup announcement, the weather forecast email, the merch decision, festival 3's second stage with clashes and sound bleed, and the newspaper spotlight.
5. **Polish:** real UI styling, basic audio, a tidy tutorial, the game installable from the browser (a progressive web app), and a playtest link shared with 5 or more playtesters.
