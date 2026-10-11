# BEAUTIFUL GRIND

A text-based football career RPG: from a 16-year-old nobody to retirement, one week at a time.
No AI, no account, no internet needed to play. Everything is prepared game content.

## ▶ How to play

**Online:** open the game's GitHub Pages link (see "Publishing" below once it's set up).

**On your computer:** double-click **`start-game.bat`**. A black window opens (keep it open) and your
browser opens the game at http://localhost:3000.

Each week:
- **Answer the decisions** (cards with a green border). Their consequences show up next week, sometimes weeks or seasons later.
- **Key moments** (marked *in-match*) are split-second decisions about next week's match. They change what actually happens in it.
- **Plan your training**: *Train hard* (more growth, more fatigue and injury risk), *Balanced*, *Light* or *Rest*. Watch your **PFM** fitness bar.

Your career saves automatically in the browser. **⚙ Settings → Export save** downloads a backup.

## What's in the game
- ~2,000 real clubs in 160+ countries and regions, with real league formats, cups and transfer windows (2025-26 start)
- 465 hand-written scenarios: training, dressing room, manager, 47 in-match key moments, media, family, love, money, culture, national team, health, veteran years
- Transfers, loans, contracts, injuries and rehab choices, national team call-ups, promotion and relegation, retirement and a legacy rating

## Adding your own scenarios
Scenarios are plain data files in [data/scenarios/](data/scenarios/). The format is explained in
[data/scenarios/README.md](data/scenarios/README.md). After editing, run:

```bash
npm run validate
```

Match-report and fan-post lines live in [data/text/narration.json](data/text/narration.json).

## Folder guide

| Path | What it is |
|---|---|
| `start-game.bat` | Double-click to play on your computer |
| `public/` | The game page and code (`js/engine.js` = rules, `js/config.js` = balancing numbers) |
| `data/world/` | Leagues, clubs, competitions, national teams |
| `data/scenarios/` | Story scenarios |
| `data/text/` | Phrase banks for match reports and the social feed |
| `docs/` | Your original design and open design questions |
| `tools/` | `npm run simtest` plays whole careers to find bugs · `npm run validate` checks scenarios · `npm run build` builds the website |
| `.github/workflows/pages.yml` | Publishes the game to GitHub Pages automatically |

## Publishing (GitHub Pages)
Every time changes are pushed to the `main` branch on GitHub, the game is checked, built and published
automatically to `https://<your-github-username>.github.io/<repository-name>/`.
