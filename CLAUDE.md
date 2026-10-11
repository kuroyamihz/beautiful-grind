# BEAUTIFUL GRIND — Football Career Text RPG

## Vision
A text-based football career simulation that is better than anything else on the market:
one week per turn, age 16 to retirement, brutal and realistic, every decision has consequences
that pay off weeks or seasons later. Default story focus is an Indonesian player, but any
nationality and any country's football pyramid must work.

## The owner
The project owner is a beginner programmer and the game designer. Explain technical choices in
plain language, keep changes small and playable, and ask before big design changes.

## Architecture (v0.2, fully standalone, no AI)
- The owner decided (2026-10-11): NO AI at play time. All content is prepared data. Do not add Claude/LLM features back.
- Browser game, plain ES modules, no build step. `server.js` is a tiny static server for local play (start-game.bat).
  Online: GitHub Pages via .github/workflows/pages.yml (validates scenarios, runs tools/build-site.mjs, deploys dist/).
- `public/js/engine.js` owns every number. `scenarios.js` picks and resolves data-driven scenarios
  (conditions, weighted/skill-check outcomes, chains, triggers, in-match key moments via state.matchMod).
- `narrator-offline.js` writes the weekly story from engine facts + phrase banks in data/text/narration.json.
- Saves: browser localStorage key `beautifulGrind.save.v1`, plus export/import JSON.

## Key files
- `public/js/engine.js` — rules; `config.js` — balancing numbers; `scenarios.js` — scenario engine
- `public/js/world.js` / `season.js` — league data access, fixtures, simulation, tables
- `docs/original-design.md` — the owner's original design document (written as an AI prompt; now a design reference)
- `data/scenarios/*.json` + README.md — scenario library and format; `npm run validate` after edits
- `data/world/*.json` — world database (leagues, clubs, cups, windows, players), baseline 2025-26
- `data/world/_README.md` — how the world data works, `verify` / `complete` flags
- `docs/OPEN-QUESTIONS.md` — design questions waiting for the owner's decision
- `tools/sim-test.mjs` — `npm run simtest [n]` plays n full careers headlessly; run after engine changes

## Rules
- Never invent damaging personal storylines for real people (see REAL PEOPLE RULE in docs/original-design.md).
- World data baseline is the 2025-26 season; after kick-off the simulation diverges from reality.
- Keep JSON valid. Run a validation pass after editing anything in `data/world/`.
- Commit after each working step (git = save points).
