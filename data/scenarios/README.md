# Scenario format

Every story event in the game is a scenario in one of these JSON files. To add content, add
scenarios to a file (or create a file and list it in `index.json`), then run
`npm run validate` to catch mistakes.

```json
{
  "id": "trn_extra_finishing",            // unique, never reuse
  "cat": "training",                     // category (see below); the same category never fires twice in a row
  "w": 5,                                // weight: higher = more likely when eligible (default 5)
  "when": { "age": [16, 21], "role": ["bench", "rotation"] },   // conditions (all must match)
  "cd": 40,                              // cooldown in weeks before it can fire again (default 40)
  "once": true,                          // fire at most once per career
  "trigger": "debut",                    // only fires right after this happens (see triggers)
  "moment": true,                        // an in-match key moment, asked the week before a match
  "chainOnly": true,                     // only fires as a follow-up from another scenario's "chain"
  "uses": { "T": "ally" },               // T = existing ally (or "rival", "any", "new"); F = "partner"; A = "agent"
  "vars": { "cost": ["wealthPct", 20, 150] },   // amounts: wealthPct %,min | wageWeeks n,min | fixed n | endorse base | range a,b
  "title": "Headline with {J}",
  "text": ["Variant one…", "Variant two…"],    // the scene; one variant is picked
  "prompt": "Question shown on the decision card (defaults to the title)",
  "fx": { "followers": 500 },            // effects applied immediately (optional)
  "choices": [ … ]                       // optional; without choices it's a scene with effects only
}
```

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

## Text tokens

`{J}` shirt name · `{first}` first name · `{name}` full name · `{M}` manager · `{Mf}` manager surname ·
`{club}` · `{league}` · `{nation}` · `{pos}` position · `{age}` · `{num}` shirt number ·
`{T}` `{T2}` teammates (`{Tl}` `{T2l}` surnames) · `{F}` a woman's name (`{Ff}` first name) · `{P}` partner ·
`{A}` agent (`{Al}` surname) · `{K}` an academy kid (`{Kl}` surname) · `{R}` a rival club · `{opp}` last opponent ·
`{cost}` etc. any var, shown as money.

## Effects (`fx`)

| Key | Example | Meaning |
|---|---|---|
| trust | `3` | manager trust |
| rep | `0.5` | reputation (0-100) |
| followers | `5000` | social followers |
| wealth | `-500` or `"-cost"` | savings in € (can use vars, `"cost*1.5"`) |
| pfm | `-5` | fitness |
| form | `0.2` | recent form |
| tacticalFit, parental | `5` | manager tactical fit, family support |
| monthlySupport | `"cost"` | add a monthly transfer to family |
| growth | `["mental"]` or `["rel"]` | +1 to a stat (respects season growth caps; `rel` = best stat for position) |
| stat | `{ "mental": -1 }` | direct stat change |
| mood | `"Determined"` | Confident, Motivated, Anxious, Frustrated, Determined, Broken, On Fire, Lost, Focused, Numb, Homesick, Angry, Relieved |
| teammate | `{ "who": "T", "rel": "ally" }` | ally / neutral / rival / enemy |
| partner | `{ "who": "F", "status": "dating" }` | none / dating / serious / married |
| agent | `{ "who": "A", "quality": [20, 40], "cut": 15 }` | hire an agent |
| endorsement | `{ "brand": "…", "value": "deal", "years": 2 }` | sponsorship |
| injury | `"minor"` / `"moderate"` | causes an injury |
| suspension | `1` | matches banned |
| listed | `true` / `false` | transfer listed |
| lifestyle | `0.2` | living-cost multiplier change |
| flag / unflag | `"bought_car"` | story flags for later conditions |
| chain | `{ "id": "x_followup", "in": [6, 12] }` | follow-up scenario after N weeks (keeps names and vars) |
| matchMod | `{ "rating": 0.5, "goals": 1, "assists": 1, "card": "yellow", "concede": 1, "injury": "minor" }` | key moments only: changes next match |

## Conditions (`when`)

Ranges `[min, max]`: `age trust form rep wealth followers leagueQ tier caps apps seasonApps contractYears parental lastRating trophies ovr pfm goalsSeason`
Lists: `role` (starter, rotation, bench, outcast) · `partner` · `phase` (pre, in, off) · `nt` (none, monitoring, called, regular) · `lastResult` (W, D, L) · `country` / `notCountry` (club's country) · `nationality` / `notNationality` · `pos` (GK CB FB DM CM AM W ST or DEF MID ATT) · `months` (1-12) · `flags` / `notFlags`
True/false: `injured abroad ramadan agent listed played matchWeek freeAgent hasAlly hasRival loan`

`leagueQ` is league strength: ~56 Indonesia, ~63 Thailand/Australia, ~69 Championship/MLS, ~82 Premier League.

## Triggers

`start seasonStart seasonEnd champion trophy promoted relegated debut firstGoal goalStreak hatTrick nightmare redCard badRun benchStreak moved loanStart loanReturn freeAgent injured longInjury recovered returnLong callup ntWatch ntDropped ntDebut roleStarter roleOutcast roleChange birthday18 birthday21 birthday25 birthday30 birthday33`

## Categories

`milestone training dressing manager moment media family love money culture national body veteran`
