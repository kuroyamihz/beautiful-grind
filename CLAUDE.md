# BEAUTIFUL GRIND — Football Career Text RPG

## Vision
A text-based football career simulation that is better than anything else on the market:
one week per turn, age 16 to retirement, brutal and realistic, every decision has consequences
that pay off weeks or seasons later. Default story focus is an Indonesian player, but any
nationality and any country's football pyramid must work.

## The owner
The project owner is a beginner programmer and the game designer. Explain technical choices in
plain language, keep changes small and playable, and ask before big design changes.

## Architecture (v0.5, fully standalone, no AI)
- The owner decided (2026-10-11): NO AI at play time. All content is prepared data. Do not add Claude/LLM features back.
- Browser game, plain ES modules, no build step. `server.js` is a tiny static server for local play (start-game.bat).
  Online: GitHub Pages via .github/workflows/pages.yml (validates scenarios, runs tools/build-site.mjs, deploys dist/).
- `public/js/engine.js` owns every number. `scenarios.js` picks and resolves data-driven scenarios
  (conditions, weighted/skill-check outcomes, chains, triggers, in-match key moments via state.matchMod).
- `life.js` is the life web: 11 meters (manager trust, board, dressing room, fans, press, image, family, partner, friends, morale, stress),
  the cast, ripple rules (one decision's knock-on effects), weekly drift/neglect/stress, red-line triggers, free-time actions.
- A week = 1-4 decisions from different arenas (engine.js `ARENAS`) + optional key moment. Interludes (cat `interlude`) and free time
  never advance time. Balance numbers live in config.js `LIFE`.
- Growth: hidden `potential` (config.js GROWTH) with a scouts' estimate in the UI; habits move it. Transfers: `transferOutlook()`
  explains offer/abroad chances (notes shown in the Career tab). `sponsors.js` = real-brand deals (data/text/brands.json) with duties,
  satisfaction, morality clauses, renewals. `social.js` = one post a week, likes/comments, follower ceiling by fame.
  `epilogue.js` = life legacy + end-of-career epilogue (data/text/epilogue.json). Long storylines live in data/scenarios/arcs.json.
- Immersion: the cast ages (sibling, parents, children); life events use `once`/`group`; text variants can have `when`.
- `narrator-offline.js` writes the long sectioned weekly story from engine facts + phrase banks in data/text/story.json and narration.json,
  avoiding recently used lines. `ui.js` + `icons.js` (hand-drawn SVG icons) render it.
- Saves: browser localStorage key `beautifulGrind.save.v1`, plus export/import JSON. `state.version` (now 3) + `migrate()` in engine.js
  upgrade older saves; bump the version and extend migrate() whenever the state shape changes.

## v0.5 systems
- Position attributes (config.js ATTRS/POSITIONS, 7 per position; old stat names in scenarios map via LEGACY_STATS/SIMILAR_ATTRS).
- `squad.js`: real squad (state.squad), transfers in/out each window, lineups, match detail (events, xG, team + personal stats). Scenario {T} comes from the squad.
- `contracts.js`: full club/sponsor contract terms, bonuses, clauses. `assets.js` + data/text/assets.json: shop/owned assets (assets.json is still a small placeholder).
- `people.js` + data/text/interactions.json: actions the player starts toward people (free-time slots). Love interests via p.crush, affairs via flag affair.
- `media.js` + data/text/media.json: weekly media timeline scaled by fame (media.json is still a small placeholder).
- `journal.js`: weekly records, monthly digests, Play month (main.js) with autoAnswer for non-critical decisions.
- Partner location (partner.near/visitWeek, conditions partnerNear/longDistance), familyNear, career level (player.js careerLevel).
- SAVE_VERSION 5; migrate() converts v4 saves.

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
- Never invent damaging personal storylines for real people (see REAL PEOPLE RULE in docs/original-design.md). Agents, journalists and
  outlets stay fictional for that reason. Real brands are fine as sponsors, but only in neutral/positive roles (no scams, betting, scandals).
- World data baseline is the 2025-26 season; after kick-off the simulation diverges from reality.
- Keep JSON valid. Run a validation pass after editing anything in `data/world/`.
- Commit after each working step (git = save points).
