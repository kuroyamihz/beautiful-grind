# Open Design Questions

Design questions waiting for your decision. Nothing here has been changed yet. Each one is your call.

## 1. Players develop too slowly
The rules cap growth at **+8 total across all stats per season** for ages 16-23.
In test careers that trained hard every single week, the best peak overall was **78**, and most players
topped out between 60 and 74. That means the **"Icon"** legacy (needs a peak of 80+) is effectively impossible.

**Proposal:** add a hidden `potential` stat (for example 60-95, revealed slowly by coaches and scouts).
Growth per season = 8 to 20 depending on potential, training choices, minutes played and coaching
quality. Most players never reach their potential, which is realistic and dramatic.

## 2. Overall rating ignores position (and goalkeepers)
**Current state:** the game uses a position-weighted OVR by default (`OVR_MODE = 'positional'` in
`public/js/config.js`). Change it to `'original'` to get the original plain average back.

## 3. Transfers can happen very often
Random test players sometimes moved three times in about a year. Real rules let a player be
registered with three clubs per season and play official matches for two of them.
**Proposal:** a limit like that, so every move is a bigger decision.

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
