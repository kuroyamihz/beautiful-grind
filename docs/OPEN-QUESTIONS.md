# Open Design Questions

Design questions waiting for your decision. Nothing here has been changed yet. Each one is your call.

## 1. Potential (done in v0.4 — tune if you like)
Players now have a hidden potential; world class (85+) is reachable for the most talented with good habits.
Numbers: `GROWTH` in `public/js/config.js`.

## 2. Overall rating ignores position (and goalkeepers)
**Current state:** the game uses a position-weighted OVR by default (`OVR_MODE = 'positional'` in
`public/js/config.js`). Change it to `'original'` to get the original plain average back.

## 3. Transfers
New signings now usually stay about 40 weeks before clubs bid again (`TRANSFER_SETTLE` in engine.js). Moving abroad is easier
and explained in the Career tab. Want a hard limit like the real "three clubs per season" rule as well?

## 4. Real journalists and real players in the social feed
Real accounts only post neutral football news; anything hostile or gossipy comes from fictional
accounts; no invented scandals for real people. All journalists and outlets in the life web are fictional.
Alternative: parody handles (for example "@FabriziRumorno"). Your choice.

## 5. Starting point
- Start date: July 2025 (world data matches perfectly), or a later date?
- Can the player choose any nationality and starting country (current), or always start as an Indonesian at an EPA academy / Liga 4 club?

## 6. How much should the life web punish neglect?
Relationships cool slowly unless you invest free time in them, and red-line events (a partner leaving,
a family rift, a dressing-room revolt, burnout) fire when a meter drops far enough. The numbers are in
`public/js/config.js` → `LIFE` (`neglect`, `coolAbove`, `softCap`, `stressRest`). Too harsh, too soft, or about right?

## 7. Interlude frequency
About 30% of "Play week" clicks open a mid-week interlude first (`LIFE.interludeChance`). More, fewer?
