# BEAUTIFUL GRIND

A text-based football career RPG: from a 16-year-old nobody to retirement, one week at a time.

## ▶ How to play

1. Double-click **`start-game.bat`** in this folder.
2. A black window opens (that's the game server; keep it open) and your browser opens the game at **http://localhost:3000**.
3. Create your player, pick a starting club, and press **Play week ▶**.
4. To stop: close the black window. Your career is saved automatically in your browser.

Each week:
- **Answer the decisions** (cards with a green border). Their consequences show up next week, sometimes weeks later.
- **Plan your training**: *Train hard* (more growth, more fatigue and injury risk), *Balanced*, *Light* or *Rest*. Watch your **PFM** fitness bar.
- Read what happened: matches, ratings, the dressing room, the feed.

Tip: **⚙ Settings → Export save** downloads a backup of your career.

## 🌐 Play online (no install)

The game is published on claude.ai: **https://claude.ai/artifact/QXoZxnvGS1NfgFBc6sT6r4**

- Works on any device, including phones, when you're signed in to claude.ai.
- **The Claude narrator works there without an API key.** Turn it on in ⚙ Settings → Narrator. It uses your Claude account's usage, and Claude asks you once to allow it.
- Saves live in that browser. Use ⚙ Settings → Export save to move a career between devices (Import save on the other one).
- The link is private. To let friends play, use the page's **Share** menu on claude.ai. Each friend's Claude narrator runs on their own account.
- To publish an updated version after changing the game: `npm run build:hosted`, then ask Claude to republish `dist/` to the same link.

## ✦ Turn on the Claude narrator locally (optional)

The game plays fully without it. The offline narrator is free. With Claude, every week becomes uniquely written journalism using the rules in `prompts/engine.md`.

1. Go to **https://console.anthropic.com**, create an account, add some credit, and create an **API key** (Settings → API Keys).
2. In this folder, copy **`.env.example`**, rename the copy to **`.env`**, open it in Notepad and paste your key after `ANTHROPIC_API_KEY=`.
3. Restart the game with `start-game.bat`. The first time, it installs the Claude connector automatically.
4. In the game: **⚙ Settings → Narrator** → choose:
   - **Claude: big moments**: Claude writes only the important weeks (goals, transfers, injuries, season finales). Cheapest way to get the magic.
   - **Claude: every week**: every week is Claude-written.

**Cost:** each Claude-written week costs a few cents, so a whole career on "every week" can add up to tens of dollars. Settings shows your real spend so far. To make it cheaper, add `CLAUDE_EFFORT=low` to `.env`.

**Never share your `.env` file.** It contains your key. It is excluded from git automatically.

## How the game works (short version)

- **The game code is the referee.** Fixtures, results, league tables, stats, money, injuries, transfers and contracts are all calculated by code, so they stay consistent across a whole career.
- **The narrator is the storyteller.** Claude (or the offline narrator) turns those facts into the story. Claude can add small consequences and its own decisions, but the code limits how much any single week can change.

## What's in this folder

| Path | What it is |
|---|---|
| `start-game.bat` | Double-click to play |
| `public/` | The game (the page and its code) |
| `public/js/engine.js` | The rules: weeks, matches, growth, money, transfers, injuries |
| `public/js/events.js` | Story events and decisions (easy to add more!) |
| `public/js/config.js` | Balancing numbers: growth caps, injury rates, league strengths |
| `prompts/engine.md` | The Claude narrator's rules (your original design, corrected) |
| `data/world/` | The football world: ~2,000 real clubs in 160+ countries and regions |
| `docs/OPEN-QUESTIONS.md` | Design decisions still waiting for you |
| `tools/sim-test.mjs` | Plays whole careers automatically to catch bugs (`npm run simtest`) |

## Current limits (next steps)

- Continental club competitions (Champions League, AFC, Libertadores…) aren't simulated yet. Domestic leagues, domestic cups and national teams are.
- Lower leagues with incomplete club lists can't be chosen as a starting club yet (for example Indonesia's Championship and Liga 4).
- Teammates and managers are fictional in offline mode. Claude mode can bring in real players.
- Balancing follows the original design (+8 stat growth per season max at ages 16-23). See `docs/OPEN-QUESTIONS.md`.
