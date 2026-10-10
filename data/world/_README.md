# World Database

This replaces the original "Football World Knowledge Prompt". It is split into files
so the game only sends the AI the part it needs each week (cheaper and more accurate):

| File | Contents |
|---|---|
| `europe.json` | All 55 UEFA nations: leagues (top 3 tiers for big nations), clubs, cups, transfer windows, star players |
| `asia.json` | AFC nations (Australia is here because it plays in the AFC) |
| `south-america.json` | All 10 CONMEBOL nations |
| `north-central-america.json` | CONCACAF nations |
| `africa.json` | CAF nations |
| `oceania.json` | OFC nations |
| `competitions.json` | Continental club competitions, international tournaments, awards, global calendar |
| `national-teams.json` | National team coaches, key players, current context |
| `economics.json` | Transfer fee and wage reference bands |

## Baseline: the 2025-26 season

The game world starts at the **2025-26 season** (for calendar-year leagues: the 2025 or 2026 season, as each entry says).
Once a career starts, the simulation takes over: promotions, relegations, transfers and
sackings happen inside the game, so the real world only needs to be accurate at kick-off.

## The `verify` flag

Anything marked `"verify": true` (or with a `verify` note) is something I am less certain about:
a late-season change, a recent rename, or a coach who may have been replaced. It is still a
sensible starting point; check it if you care about that detail.

`"complete": false` on a club list means only notable clubs are listed. The game fills in the rest
with real clubs from that league.

## Players

Star players are listed per league (`stars`) and per national team (`national-teams.json`) as of
the start of 2025-26 unless noted. The AI narrator also knows thousands more real players. These
lists are anchors that correct outdated knowledge (for example, Trent Alexander-Arnold at Real Madrid
and Kevin De Bruyne at Napoli).
