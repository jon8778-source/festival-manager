# Festival Manager (MVP)

A festival management sim played in portrait on phones and tablets, built as a web game that runs in the browser. The player books bands through Football Manager-style negotiations, builds a small festival site, runs the festival day live with decisions popping up, and reads the verdict in a local newspaper. This repo holds the MVP: festival 1 as the first playable, then festivals 1 to 3 as the full MVP.

## Read these before starting any task
- @docs/MVP_SPEC.md: systems, formulas, screens, save format, test vectors and milestone acceptance criteria
- @docs/CONTENT.md: all MVP game content (bands, festivals, events, emails, Randy Popping's lines, newspaper templates, timelines)
- docs/economy_model.xlsx: the tuning spreadsheet the formulas come from (reference only; the numbers are already in the spec)

## Tech stack
- TypeScript (strict mode), Vite, React for the screens, plain CSS (CSS modules or one stylesheet per screen)
- Vitest for unit tests
- Content and tuning as JSON files under src/data, with TypeScript types for each
- Save and playtest log stored in the browser (localStorage and IndexedDB)
- Published as a static site to GitHub Pages by a GitHub Actions workflow on every push to main
- Made installable as a progressive web app (manifest and service worker) in milestone 5

## Ground rules
- Build only what the current milestone asks for. Anything listed under "Not in the MVP" in the spec stays out.
- Data-driven: bands, festivals, facilities, events, emails, Randy's lines and newspaper templates live in JSON under src/data, never hard-coded in logic or components.
- Every tuning number lives in src/data/tuning.json. No magic numbers in logic.
- Game rules live in plain TypeScript modules under src/core with no React or browser APIs, so they are easy to unit test. React components stay thin: they read state and call core functions.
- Game state is one serialisable object, changed only through core functions, so saving, loading and replays are simple.
- All randomness goes through one seeded random module, so tests and replays are deterministic.
- Every formula and the negotiation rules get unit tests. Use the test vectors in the spec, and keep all tests passing.
- No ads, analytics services, sponsorship or network calls other than loading the game itself. The only logging is the local playtest log described in the spec.
- Mobile first: portrait layouts from 360px wide up to tablet size, touch targets at least 44px, no hover-only interactions, respect safe areas.
- Player-facing text is British English. Money is shown in pounds (£), rounded to whole pounds.
- Placeholder art only: simple shapes, solid colours, emoji or text labels.
- Keep dependencies few. Ask before adding a library beyond React, Vite and Vitest.

## Folder structure
- src/core: economy, negotiation, events, calendar, stars, results, save, playtestLog, random
- src/data: tuning.json, bands.json, festivals.json, facilities.json, events.json, emails.json, lines.json, newspaper.json, timeline.json
- src/screens: one component per screen (MainMenu, PrepHub, Inbox, Lineup, Negotiation, Site, Tickets, Finances, FestivalDay, Results, Settings)
- src/components: shared UI pieces (buttons, bars, cards, email list)
- src/styles: global styles and design tokens
- tests: unit tests (or *.test.ts next to the code)
- .github/workflows: the deploy workflow

## Commands
- npm install, then npm run dev for local development
- npm test to run the unit tests
- npm run build for a production build
- Run npm test and npm run build before every commit; both must pass.

## How to work
- Start each milestone in plan mode. Propose the plan and the list of files, then wait for approval before writing code.
- Work in small steps. After each step, run the tests and the build, and fix any failures before moving on.
- Commit after each working step with a clear message, and push so the playtest link updates.
- If the spec is unclear or two parts disagree, ask rather than invent. Record any decision in docs/DECISIONS.md.
