# BEAUTIFUL GRIND

A text-based football career RPG: from a 16-year-old nobody to retirement, one week at a time.
No AI, no account, no internet needed to play. Everything is prepared game content.

## ▶ How to play

**Online:** https://kuroyamihz.github.io/beautiful-grind/

**On your computer:** double-click **`start-game.bat`**. A black window opens (keep it open) and your
browser opens the game at http://localhost:3000.

Each week:
- **Answer the decisions.** Each week brings 1-4, from different parts of your life: football, media, love, friends, family, lifestyle and club politics. The icons under each answer show what it can affect.
- **Watch the ripples.** Next week, *What your choices caused* shows every consequence, including the knock-on effects: what you told the press reaches your partner, how you treat your friends can reach the papers, how the fans feel reaches the boardroom.
- **Use your free time** (2 actions a week): call home, date night, see your best friend, extra gym, coffee with a journalist… These happen instantly and don't move the clock.
- **Press Play.** About a third of the time, life interrupts first with a small mid-week scene (an *interlude*). Answer it and see what happens straight away; time only moves when you play on.
- **Key moments** (marked *in-match*) are split-second decisions about next week's match. They change what actually happens in it.
- **Plan your training**: *Train hard* (more growth, more fatigue, stress and injury risk), *Balanced*, *Light* or *Rest*.
- **Look after your circle.** The *Circle* tab shows how the manager, board, dressing room, fans, press, family, partner and friends feel about you, plus your morale and stress. People you ignore drift away. High stress hurts your football.

Your career saves automatically in the browser. **⚙ Settings → Export save** downloads a backup.

## What's in the game
- ~2,000 real clubs in 160+ countries and regions, with real league formats, cups and transfer windows (2025-26 start)
- 600+ hand-written scenarios: training, dressing room, manager, 47 in-match key moments, media and press conferences, family, love, friends, club politics, lifestyle, money, culture, national team, health, veteran years
- ~100 interludes (mid-week scenes that don't advance time) and 20 free-time activities
- A life web: 11 relationships and moods that react to each other, a cast of people (parents, sibling, best friend, captain, president, journalist, partner, agent), and long weekly stories with press clippings and phone messages
- Transfers, loans, contracts, injuries and rehab choices, national team call-ups, promotion and relegation, retirement and a legacy rating

## Adding your own scenarios
Scenarios are plain data files in [data/scenarios/](data/scenarios/). The format is explained in
[data/scenarios/README.md](data/scenarios/README.md). After editing, run:

```bash
npm run validate
```

The weekly story, press clippings and phone messages come from phrase banks in [data/text/story.json](data/text/story.json) and [data/text/narration.json](data/text/narration.json). Ripple lines, free-time activities and random words live in [data/text/life.json](data/text/life.json).

## Folder guide

| Path | What it is |
|---|---|
| `start-game.bat` | Double-click to play on your computer |
| `public/` | The game page and code (`js/engine.js` = rules, `js/config.js` = balancing numbers) |
| `data/world/` | Leagues, clubs, competitions, national teams |
| `data/scenarios/` | Story scenarios |
| `data/text/` | Phrase banks for the weekly story, ripples, free time and the social feed |
| `docs/` | Your original design and open design questions |
| `tools/` | `npm run simtest` plays whole careers to find bugs · `npm run validate` checks scenarios · `npm run build` builds the website |
| `.github/workflows/pages.yml` | Publishes the game to GitHub Pages automatically |

## Publishing (GitHub Pages)
Every time changes are pushed to the `main` branch on GitHub, the game is checked, built and published
automatically to **https://kuroyamihz.github.io/beautiful-grind/** (via the `gh-pages` branch).
