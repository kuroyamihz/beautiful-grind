# Open Design Questions

Problems or gaps found in the original design. None of these has been changed yet. Each one is your call.

## 1. Players develop too slowly
The rules cap growth at **+8 total across all stats per season** for ages 16-23.
That is about +1.3 per stat per season. A 16-year-old with 55 overall would reach roughly 64 by 23.
Real wonderkids go from 60 to 85. Even a normal pro gains 10-15 points in those years.

**Proposal:** add a hidden `potential` stat (for example 60-95, revealed slowly by coaches and scouts).
Growth per season = 8 to 20 depending on potential, training choices, minutes played and coaching
quality. Most players never reach their potential, which is realistic and dramatic.

## 2. Overall rating ignores position (and goalkeepers)
OVR = the average of pace/shooting/passing/dribbling/defending/physical. That means:
- A world-class centre-back with shooting 40 looks mediocre.
- Goalkeepers have no goalkeeping stats at all. (A `goalkeeping` stat has been added to the state; the formula still needs deciding.)

**Current state:** the game uses a position-weighted OVR by default (`OVR_MODE = 'positional'` in
`public/js/config.js`). Change it to `'original'` to get the original formula back.

**Proposal:** a position-weighted OVR. For example, a striker weights shooting/pace/dribbling heavily,
a centre-back weights defending/physical/mental, and a goalkeeper mostly weights goalkeeping + mental.

## 3. PFM does nothing until age 33
PFM has no decay from 16-32, so it only matters at the end of a career. Option: make it a
"freshness/fitness" meter all career long (drops with heavy fixture loads, rises with rest), while
the age-based decay becomes its maximum ceiling. That would make rotation, rest and burnout matter at every age.

## 4. Who does the maths: code or AI?
The original prompt asks the AI to track everything. AIs are good storytellers but drift with
numbers over hundreds of weeks: stats creep, money doesn't add up, tables don't sum.
**Recommendation:** code owns the numbers; the AI writes the story and suggests changes, and the code checks them.
(See CLAUDE.md, "Architecture".)
**Current state:** built this way in v0.1. You can still change it.

## 5. Real journalists and real players in the social feed
Having real people (Fabrizio Romano, real players) post fake things can mislead if screenshots
get shared, and is unfair to them. Current rule: real accounts only post neutral football news;
anything hostile or gossipy comes from fictional accounts; no invented scandals for real people.
Alternative: parody handles (for example "@FabriziRumorno"). Your choice.

## 6. Starting point
- Start date: July 2025 (world data matches perfectly), or a later date?
- Can the player choose any nationality and starting country, or always start as an Indonesian at an EPA academy / Liga 4 club?

## 7. Cost per week
Each week is one AI call. Its cost depends on the model and on how much text is sent and generated.
We'll measure the real cost once the first version runs, then tune it (smaller model for quiet
weeks, bigger model for big moments).
