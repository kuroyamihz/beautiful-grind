# Scenario format

Every story event in the game is a scenario in one of these JSON files. To add content, add
scenarios to a file (or create a file and list it in `index.json`), then run
`npm run validate` to catch mistakes.

```json
{
  "id": "trn_extra_finishing",            // unique, never reuse
  "cat": "training",                     // category (see below); decides which part of life it belongs to
  "w": 5,                                // weight: higher = more likely when eligible (default 5)
  "when": { "age": [16, 21], "role": ["bench", "rotation"] },   // conditions (all must match)
  "cd": 60,                              // cooldown in weeks before it can fire again (default 60)
  "once": true,                          // fire at most once per career (use it for life events: a wedding, a sibling's academy...)
  "group": "sib_money",                  // stories about the same situation share one cooldown...
  "groupCd": 104,                        // ...of this many weeks (default: the scenario's cd)
  "groupOnce": true,                     // ...or the whole group can only ever happen once
  "trigger": "debut",                    // only fires right after this happens (see triggers)
  "moment": true,                        // an in-match key moment, asked the week before a match
  "chainOnly": true,                     // only fires as a follow-up from another scenario's "chain"
  "uses": { "T": "ally" },               // T = existing ally (or "rival", "any", "new"); F = "partner"; A = "agent"
  "vars": { "cost": ["wealthPct", 20, 150] },   // amounts: wealthPct %,min | wageWeeks n,min | fixed n | endorse base | range a,b
  "ui": "phone",                         // optional look of the card: phone | press | social | letter | boardroom
  "time": "Tuesday, 22:40",              // interludes only: when it happens (otherwise a random time)
  "title": "Headline with {J}",
  "text": ["Variant one…", "Variant two…"],    // the scene; one variant is picked
  "prompt": "Question shown on the decision card (defaults to the title)",
  "fx": { "followers": 500 },            // effects applied immediately (optional)
  "choices": [ … ]                       // optional; without choices it's a scene with effects only
}
```

## How a week is built

Each week brings 1-4 decisions, each from a **different part of life** (an "arena"):

| Arena | Categories |
|---|---|
| Football | `training manager dressing body national milestone veteran` |
| Media | `media` |
| Love | `love` |
| Friends | `friends` |
| Family & roots | `family culture` |
| Lifestyle | `money lifestyle` |
| Club politics | `politics` |

Plus: in-match key moments (`moment`), transfer offers and contracts (made by the engine), and
**interludes** (`interlude`): small mid-week scenes that pop up when you press Play and do **not**
advance time. They're answered on the spot and the result is shown immediately.

Scenarios that have fired before are picked less often, and so is the same category as last week.

## Text that adapts to his life

Any `text` (the scene or an outcome) can mix plain strings with variants that only appear when their
conditions hold. Matching variants are preferred:

```json
"text": [
  "Plain version, always possible.",
  { "when": { "lastResult": ["L"] }, "t": "Version after a defeat." },
  { "when": { "partnerStyle": ["private"] }, "t": "Version when his partner hates the spotlight." }
]
```

## Long storylines

Use flags plus `since` to make a story come back years later, and `cast` to remember who it was about:

```json
"fx": { "flag": "rival_respect", "cast": { "rival": "T" } }
"when": { "flags": ["rival_respect"], "since": { "rival_respect": [150, 9999] } }
```

Stage 1 remembers `{T}` as `{RIVAL}`; stage 2 needs that flag and 150+ weeks to have passed.
Remembered people: `{RIVAL} {MENTEE} {EXFLAME} {FIXER} {OLDBOSS}` (his first manager is remembered automatically).
Flags the epilogue reads: `rival_friend rival_enemy mentee_star promise_kept promise_broken foundation captain secret_exposed dad_passed`
and more (see `public/js/epilogue.js`). The storylines themselves are in `arcs.json`.

## Choices (three forms)

```json
{ "label": "Apologise", "desc": "What it means", "risk": "low", "hint": "Honest likely consequence",
  "text": "Outcome text", "fx": { "trust": 2 } }

{ "label": "Confront him", "risk": "high", "hint": "…",
  "out": [ { "w": 1, "text": "Good outcome", "fx": {} }, { "w": 1, "text": "Bad outcome", "fx": {} } ] }

{ "label": "Take the penalty", "risk": "high", "hint": "…",
  "check": { "stat": "mental", "dc": 60 },
  "ok": { "text": "Success", "fx": {} }, "bad": { "text": "Failure", "fx": {} } }
```

A check rolls the player's stat (or `trust`, `rep`, `parental`, `pfm`, `agent`, `tacticalFit`, `ovr`)
plus a random swing of about ±10 against `dc`. Risk is `low | medium | high | extreme`.
The icons under each choice (which parts of life it can affect) are worked out from its `fx` automatically.

## Ripples: every decision affects other things

You only write the **direct** effects. The game then adds ripples automatically (rules in
`public/js/life.js`, wording in `data/text/life.json`). Examples:

- lots of new followers or a big press moment → your partner reacts (a private partner hates it, a public one loves it)
- your public image drops → your family worries, the board and sponsors notice
- a public clash with the manager → the dressing room picks a side, the press loves it
- family / partner / friends going up or down → morale and stress follow
- the fans turning → the board cools; the dressing room turning → the manager hears about it

So `{ "followers": 8000 }` on its own already reaches the partner and the family.

## Text tokens

`{J}` shirt name · `{first}` first name · `{name}` full name · `{M}` manager · `{Mf}` manager surname ·
`{club}` · `{league}` · `{nation}` · `{pos}` position · `{age}` · `{num}` shirt number ·
`{T}` `{T2}` teammates (`{Tl}` `{T2l}` surnames) · `{F}` a woman's name (`{Ff}` first name) · `{P}` partner (`{Pf}` first name) ·
`{A}` agent (`{Al}` surname) · `{K}` an academy kid (`{Kl}` surname) · `{R}` a rival club · `{opp}` last opponent ·
`{cost}` etc. any var, shown as money.

The player's circle: `{MUM}` `{DAD}` (what he calls his parents, e.g. Ibu/Bapak) · `{SIB}` sibling's name, `{SIBr}` "brother"/"sister" ·
`{BF}` best friend (`{BFf}` first name, `{BFjob}` his job) · `{JR}` the local journalist (`{JRl}` surname), `{OUT}` his outlet ·
`{CAP}` captain (`{CAPl}`) · `{PRES}` club president (`{PRESl}`) · `{SIBage}` `{SIBhe}` `{SIBhis}` `{SIBhim}` `{SIBlil}` ("little " while under 18) `{SIBplace}` (school/campus/work) · `{MUMage}` `{DADage}` · `{KID}` `{KIDage}` · `{FIRSTCLUB}`.

Real brands: `{BRAND}` (a brand that would want him) or `{BRAND_boots}`, `{BRAND_tech}`, `{BRAND_fintech}`... (any industry in `data/text/brands.json`). Only use real brands in neutral or positive roles; scams, betting and anything shady must use fictional names.

Random words (picked once per scenario, so scene and outcome agree; lists in `data/text/life.json`):
`{PLACE} {FOOD} {DAY} {TIME} {SET} {APP} {CAR} {SHOW} {GIFT} {WEATHER} {HOBBY}`.

## Effects (`fx`)

| Key | Example | Meaning |
|---|---|---|
| trust | `3` | manager trust |
| board, dressing, fans | `4` | the board, the dressing room, the club's fans (0-100) |
| press, image | `-3` | relationship with journalists, public image (clean ↔ controversial) |
| family (or parental), love, friends | `5` | family, partner, friends (0-100) |
| morale, stress | `-4` | happiness and pressure (high stress is bad) |
| rep | `0.5` | reputation / fame (0-100) |
| followers | `5000` | social followers |
| wealth | `-500` or `"-cost"` | savings in € (can use vars, `"cost*1.5"`) |
| pfm | `-5` | fitness |
| form | `0.2` | recent form |
| tacticalFit | `5` | manager tactical fit |
| monthlySupport | `"cost"` | add a monthly transfer to family |
| growth | `["mental"]` or `["rel"]` | +1 to a stat (respects season growth caps; `rel` = a key stat for his position) |
| stat | `{ "mental": -1 }` | direct stat change |
| mood | `"Determined"` | Confident, Motivated, Anxious, Frustrated, Determined, Broken, On Fire, Lost, Focused, Numb, Homesick, Angry, Relieved |
| teammate | `{ "who": "T", "rel": "ally" }` | ally / neutral / rival / enemy (also moves the dressing room) |
| partner | `{ "who": "F", "status": "dating" }` | none / dating / serious / engaged / married |
| newPartner | `true` | start dating someone new (a name is made up) |
| agent | `{ "who": "A", "quality": [20, 40], "cut": 15 }` | hire an agent |
| endorsement | `{ "brand": "…", "value": "deal", "years": 2 }` | sponsorship |
| injury | `"minor"` / `"moderate"` | causes an injury |
| suspension | `1` | matches banned |
| listed | `true` / `false` | transfer listed |
| lifestyle | `0.2` | living-cost multiplier change |
| potential | `1` / `-2` | hidden potential (the ceiling of his growth) |
| abroadWish | `true` / `false` | he wants to play abroad (offers from abroad become much likelier) |
| offerAbroad | `true` | a club abroad makes an offer now |
| offerHome | `true` | his first club makes a homecoming offer (keeps or breaks a promise) |
| cast | `{ "rival": "T" }` | remember this person by name for later stages |
| agent | `null` | fires the agent |
| flag / unflag | `"bought_car"` | story flags for later conditions |
| chain | `{ "id": "x_followup", "in": [6, 12] }` | follow-up scenario after N weeks (keeps names and vars) |
| matchMod | `{ "rating": 0.5, "goals": 1, "assists": 1, "card": "yellow", "concede": 1, "injury": "minor" }` | key moments only: changes next match |

Getting a meter higher gets harder near the top (and lower near the bottom), so big numbers matter.

## Conditions (`when`)

Ranges `[min, max]`: `age trust form rep wealth followers leagueQ tier caps apps seasonApps contractYears parental lastRating trophies ovr pfm goalsSeason tacticalFit board dressing fans press image family love friends morale stress`
Lists: `role` (starter, rotation, bench, outcast) · `partner` · `partnerStyle` (private, public) · `phase` (pre, in, off) · `nt` (none, monitoring, called, regular) · `lastResult` (W, D, L) · `country` / `notCountry` (club's country) · `nationality` / `notNationality` · `pos` (GK CB FB DM CM AM W ST or DEF MID ATT) · `months` (1-12) · `flags` / `notFlags`
True/false: `injured abroad ramadan agent listed played matchWeek freeAgent hasAlly hasRival loan debt wantsAbroad`
Ages and time: `sibAge mumAge dadAge kidAge partnerYears potential sponsors` (ranges) · `sibKind` (brother, sister) · `since` ({ flag: [minWeeks, maxWeeks] })

`leagueQ` is league strength: ~56 Indonesia, ~63 Thailand/Australia, ~69 Championship/MLS, ~82 Premier League.

## Triggers

`start seasonStart seasonEnd champion trophy promoted relegated debut firstGoal goalStreak hatTrick nightmare redCard badRun benchStreak moved loanStart loanReturn freeAgent injured longInjury recovered returnLong callup ntWatch ntDropped ntDebut roleStarter roleOutcast roleChange birthday18 birthday21 birthday25 birthday30 birthday33 debt`

Social: `followers100K followers1M` · Life web (fire once when a meter crosses a line, again only after it recovers):
`partnerCrisis familyRift friendsDrift dressingRevolt boardAngry fansTurn pressWar scandal lowMorale burnout` (red lines) ·
`fanFavourite pressDarling deepLove leader roleModel` (peaks)

## Categories

`milestone training dressing manager moment media family love money culture national body veteran friends politics lifestyle interlude`

## Free-time activities

The free-time buttons (2 a week, 3 when injured) live in `data/text/life.json` → `actions`. Each has
`id`, `icon`, `label`, `desc`, `when` (same conditions as above) and `out` (weighted outcomes with
`text` variants and `fx`; `wealthWeeks: 1` = costs one week's wage).
