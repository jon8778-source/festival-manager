# Festival Manager: Claude Code prompts for the MVP (web game)

You can do all of this from an Android tablet. Claude Code runs in the cloud and works on a GitHub repository; you start sessions from the Code tab in the Claude app (or claude.ai/code in the browser), then play the result in your tablet's browser.

Paste the prompts below one at a time, in order. Start a new session for each step so it begins with a clean context; CLAUDE.md and the docs load automatically. Wait until each step works and its tests pass before moving on.

## Before you start (on the tablet)

1. **GitHub:** create a free GitHub account if you don't have one, then create a new empty repository called festival-manager. Make it public, because GitHub Pages (the free playtest link) needs a public repository on a free account.
2. **Upload the pack:** in the repository, use Add file, then Upload files, and upload CLAUDE.md, MVP_SPEC.md, CONTENT.md, PROMPTS.md and economy_model.xlsx. They can all go in the top folder; step 0 moves them into place.
3. **Connect Claude Code:** open the Claude app, go to the Code tab, connect your GitHub account (install the Claude GitHub App when asked) and pick the festival-manager repository. When it asks you to set up an environment, keep the default, and check that its network access allows installing npm packages.
4. **How changes reach you:** Claude Code works on a branch and opens a pull request. Merge the pull request on GitHub (in the browser) to update the main branch, which republishes the playtest link.

## Step 0: Set up the project

> Move MVP_SPEC.md, CONTENT.md, PROMPTS.md and economy_model.xlsx into a docs folder and keep CLAUDE.md at the top level. Then read CLAUDE.md and set up the project as it describes: Vite, React and TypeScript in strict mode, Vitest, the folder structure, and a GitHub Actions workflow that builds and publishes the site to GitHub Pages on every push to main. Add a placeholder home screen that says "Festival Manager" and a sample test so the pipeline can be checked. Make sure npm test and npm run build pass, then open a pull request and tell me exactly how to switch on GitHub Pages and where the playtest link will be.

After merging: in the repository's Settings, open Pages and set the source to GitHub Actions. Open the playtest link on your tablet to check it works.

## Step 1: Plan the first playable

> Read CLAUDE.md, docs/MVP_SPEC.md and docs/CONTENT.md. We are building milestone 1, the first playable (festival 1 only). In plan mode, propose the architecture: the core modules and their responsibilities, the shape of the game state, the data file formats, the screens and how they connect, the save and playtest log formats, and the order you will build things in. List every file you will create. Flag anything in the spec that is unclear or contradictory. Don't write code yet.

## Step 2: Core rules and tests

> Build the core game rules as plain TypeScript under src/core, with unit tests: the tuning config (with the defaults from section 4 of the spec), the seeded random module, the economy (budget, costs, lineup quality, facilities, attendance, income, satisfaction, profit, stars, reputation), the negotiation rules (gate, required fee, bill position and merch adjustments, score, counter-offers, patience, Randy's market-rate hint) and event resolution (options A, B, C and the noise fine). Write tests for every rule, including the test vectors in sections 5 and 12 of the spec. Run the tests and fix any failures. No screens yet.

## Step 3: Content as data

> Turn docs/CONTENT.md into JSON data files under src/data, with a TypeScript type for each (bands, festivals, facilities, events, emails, Randy's lines, newspaper templates, timeline). Add a script (npm run content) that regenerates the JSON from docs/CONTENT.md, so I can edit the doc and rebuild the data. Add a test that checks the data is complete and matches the types. Festival 1's content must all be present; include festivals 2 and 3 too, marked as drafts.

## Step 4: Preparation phase

> Build the preparation phase screens in React, as described in section 10 of the spec: the main menu (festival poster), the preparation hub (inbox plus menu list and Continue), the inbox, lineup, negotiation, site (fixed map and build tray), tickets and finances. Wire them to the core rules: the countdown, with Continue jumping to the next email, decision or deadline; the live forecast panel (section 9 of the spec), recalculating instantly from the core formulas; the preparation decision emails (sound limiter and slow sales), using the same three-option card as the festival day; emails triggering on the festival 1 timeline; ticket sales following the curve; negotiations through the negotiation rules; and facility booking with the day 3 deadline. Use placeholder art and a portrait, mobile-first layout that also works on a tablet. Show Randy's tutorial lines at the right moments, with a skip button.

## Step 5: Festival day

> Build the festival day screen: a simple animated placeholder scene (CSS or SVG), the clock running noon to midnight in about 5 minutes (with a 2x speed button), the three star meters and alert chips, and time pausing for each decision card with its three options. Festival 1's three decisions are the food queue (midday), the band running late (early afternoon) and the noise complaint (evening). Apply each choice through the event rules and record it, with the seconds taken to respond.

## Step 6: Results, save and logging

> Build the results screen as a newspaper review using the templates in CONTENT.md (headline by stars, opening and closing lines from the best and worst areas, an event line, the stats box), plus Randy's basic tip on the weakest star after a failed festival. Add Next festival and Replay (which resets everything to the start of the festival). Add the save (one slot in localStorage, autosaved at the end of each phase, with a version number, plus export and import in Settings) and the playtest log (as in section 11 of the spec), with a Settings button to download the log. Then play through festival 1 end to end and fix anything that breaks.

## Step 7: First playable check

> Check milestone 1 against the acceptance criteria in section 13 of the spec. List anything missing or broken and fix it. Check the layout at phone and tablet sizes in portrait. Make sure the playtest link works after merging, and give me a short checklist for my first playtest.

## Later milestones

Use the same pattern for each: plan first, then build, test and check against section 13.

- **Milestone 2, economy:** "Plan and build milestone 2 from the spec: every income and cost line visible in Finances, ticket sales following the curve, and the box office emails showing real numbers."
- **Milestone 3, facilities:** "Plan and build milestone 3: track toilets and food stalls separately with their own queues, ready for the bar at festival 2."
- **Milestone 4, full MVP:** "Plan and build milestone 4: switch on festivals 2 and 3 from the data, then add the promoter advance, reputation carried between festivals, emerging band growth and listener spikes, the lineup announcement, the weather forecast email, the merch decision, festival 3's second stage with clashes and sound bleed, and the newspaper spotlight."
- **Milestone 5, polish:** "Plan and build milestone 5: real UI styling, basic sound, a tidy tutorial, and make the game installable as a progressive web app so playtesters can add it to their home screen."

## Tips

- Keep each step small. If a step grows, ask Claude Code to split it.
- Read the summary of each pull request before merging, and merge after each working step.
- When you change the design, edit docs/CONTENT.md or docs/MVP_SPEC.md first, then run npm run content (or ask Claude Code to) so the game data follows.
- To test on the tablet, open the playtest link in Chrome and use Add to Home screen for a full-screen view.
- Turning the web game into a Google Play or App Store app is a later step (for example by wrapping it with Capacitor), after the MVP proves the game is fun.
