# BEAUTIFUL GRIND — Football Career Text RPG

## Vision
A text-based football career simulation that is better than anything else on the market:
one week per turn, age 16 to retirement, brutal and realistic, every decision has consequences
that pay off weeks or seasons later. Default story focus is an Indonesian player, but any
nationality and any country's football pyramid must work.

## The owner
The project owner is a beginner programmer and the game designer. Explain technical choices in
plain language, keep changes small and playable, and ask before big design changes.

## Architecture (built, v0.1 playable)
- Browser game, plain ES modules, no build step. `server.js` (Node, no framework) serves `public/`
  and `data/`, and proxies Claude at `/api/narrate`. Run: `start-game.bat` or `npm start` → http://localhost:3000.
  Node.js v24 and git are installed. Python is not.
- **Hybrid engine:** `public/js/engine.js` owns every number (calendar, fixtures, tables, stats,
  money, injuries, trust, transfers, contracts, national team). Narrators only tell the story:
  `narrator-offline.js` (templates, free) or Claude via `ai.js` + `server.js`
  (model `claude-opus-5-5`, effort from `CLAUDE_EFFORT`, server-side fallbacks on, system prompt cached).
  `ai.js mergeAI()` clamps every Claude-suggested delta and drops Claude transfer/contract decisions.
- Decisions are serializable (`state.pending`); `kind` = template | offer | renewal | rehab | retire | ai.
  Template events live in `events.js` (build + resolve per choice); delayed consequences via `state.threads`.
- Narrator modes: `offline`, `ai-major` (Claude only on big weeks), `ai` (every week).
- Saves: browser localStorage key `beautifulGrind.save.v1`, plus export/import JSON.

## Key files
- `public/js/engine.js` — rules; `config.js` — balancing numbers; `events.js` — story events
- `public/js/world.js` / `season.js` — league data access, fixtures, simulation, tables
- `prompts/engine.md` — narrator/game-engine system prompt (owner's design, corrected; see its CHANGELOG)
- `data/world/*.json` — world database (leagues, clubs, cups, windows, players), baseline 2025-26
- `data/world/_README.md` — how the world data works, `verify` / `complete` flags
- `docs/OPEN-QUESTIONS.md` — design questions waiting for the owner's decision
- `tools/sim-test.mjs` — `npm run simtest [n]` plays n full careers headlessly; run after engine changes

## Rules
- Never invent damaging personal storylines for real people (REAL PEOPLE RULE in engine.md).
- World data baseline is the 2025-26 season; after kick-off the simulation diverges from reality.
- Keep JSON valid. Run a validation pass after editing anything in `data/world/`.
- Commit after each working step (git = save points).
