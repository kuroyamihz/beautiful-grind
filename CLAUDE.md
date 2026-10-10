# BEAUTIFUL GRIND — Football Career Text RPG

## Vision
A text-based football career simulation that is better than anything else on the market:
one week per turn, age 16 to retirement, brutal and realistic, every decision has consequences
that pay off weeks or seasons later. Default story focus is an Indonesian player, but any
nationality and any country's football pyramid must work.

## The owner
The project owner is a beginner programmer and the game designer. Explain technical choices in
plain language, keep changes small and playable, and ask before big design changes.

## Architecture (planned)
- Browser game (runs locally; HTML/JS via Node tooling). Node.js v24 and git are installed. Python is not.
- **Hybrid engine (recommended, not yet confirmed by owner):** game code owns the numbers
  (calendar, fixtures, standings, stats, money, injury rolls, trust, transfer windows). The AI
  (Claude API) owns the story: narrative, dialogue, social feed, decision options, consequences.
  The AI proposes deltas; code validates and clamps them against the rules in `prompts/engine.md`.
  Reason: LLMs drift with arithmetic and long-term state; code doesn't.
- Each week the frontend sends: player state, last decision, recent log, open story threads,
  and ONLY the relevant slice of `data/world/` (keeps cost low).

## Key files
- `prompts/engine.md` — narrator/game-engine system prompt (owner's design, corrected; see its CHANGELOG)
- `data/world/*.json` — world database (leagues, clubs, cups, windows, players), baseline 2025-26
- `data/world/_README.md` — how the world data works, `verify` / `complete` flags
- `docs/OPEN-QUESTIONS.md` — design questions waiting for the owner's decision

## Rules
- Never invent damaging personal storylines for real people (REAL PEOPLE RULE in engine.md).
- World data baseline is the 2025-26 season; after kick-off the simulation diverges from reality.
- Keep JSON valid. Run a validation pass after editing anything in `data/world/`.
- Commit after each working step (git = save points).
