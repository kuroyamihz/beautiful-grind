// Balancing numbers and lookup tables. Tweak the game here.

// Week 0 of every career = Monday 7 July 2025 (start of 2025-26 pre-season).
export const START_DATE_UTC = Date.UTC(2025, 6, 7);
export const START_AGE = 16;

// ── Attributes: every position has its own set ────────────────
// A goalkeeper is judged on reflexes and handling, not dribbling; a centre-back on tackling, positioning,
// heading and ball-playing. Each position has seven attributes; the overall rating is a weighted mix of them.
export const ATTRS = {
  pace: { label: 'Pace', icon: 'zap' },
  physical: { label: 'Strength & stamina', icon: 'dumbbell' },
  mental: { label: 'Composure', icon: 'spark' },
  finishing: { label: 'Finishing', icon: 'target' },
  longShots: { label: 'Long shots', icon: 'target' },
  dribbling: { label: 'Dribbling', icon: 'ball' },
  passing: { label: 'Passing', icon: 'share' },
  vision: { label: 'Vision', icon: 'map' },
  crossing: { label: 'Crossing', icon: 'share' },
  offBall: { label: 'Movement', icon: 'arrow' },
  aerial: { label: 'Heading', icon: 'user' },
  tackling: { label: 'Tackling', icon: 'flag' },
  marking: { label: 'Positioning', icon: 'target' },
  ballPlaying: { label: 'Ball-playing', icon: 'share' },
  reflexes: { label: 'Reflexes', icon: 'zap' },
  handling: { label: 'Handling', icon: 'user' },
  gkPositioning: { label: 'Positioning', icon: 'target' },
  command: { label: 'Command of area', icon: 'megaphone' },
  distribution: { label: 'Distribution', icon: 'share' },
};
export const STAT_KEYS = Object.keys(ATTRS);

export const POSITIONS = {
  GK: { name: 'Goalkeeper', weights: { reflexes: 0.28, handling: 0.2, gkPositioning: 0.2, command: 0.1, distribution: 0.1, mental: 0.08, physical: 0.04 } },
  CB: { name: 'Centre-back', weights: { tackling: 0.25, marking: 0.25, aerial: 0.15, physical: 0.15, pace: 0.08, ballPlaying: 0.07, mental: 0.05 } },
  FB: { name: 'Full-back', weights: { pace: 0.22, tackling: 0.2, crossing: 0.16, marking: 0.12, physical: 0.12, dribbling: 0.1, mental: 0.08 } },
  DM: { name: 'Defensive midfielder', weights: { tackling: 0.24, marking: 0.2, passing: 0.2, physical: 0.14, vision: 0.1, mental: 0.08, pace: 0.04 } },
  CM: { name: 'Central midfielder', weights: { passing: 0.26, vision: 0.18, dribbling: 0.14, physical: 0.12, tackling: 0.1, longShots: 0.1, mental: 0.1 } },
  AM: { name: 'Attacking midfielder', weights: { vision: 0.24, passing: 0.2, dribbling: 0.2, finishing: 0.14, longShots: 0.08, mental: 0.08, pace: 0.06 } },
  W: { name: 'Winger', weights: { pace: 0.24, dribbling: 0.24, crossing: 0.14, finishing: 0.14, passing: 0.1, offBall: 0.08, mental: 0.06 } },
  ST: { name: 'Striker', weights: { finishing: 0.32, offBall: 0.2, pace: 0.14, aerial: 0.1, physical: 0.1, dribbling: 0.08, mental: 0.06 } },
};

// Older scenarios talk about eight general stats (shooting, passing, dribbling, defending, goalkeeping…).
// Each is translated to the first attribute in its list that the player's position actually has.
export const LEGACY_STATS = {
  pace: ['pace', 'reflexes', 'command'],
  shooting: ['finishing', 'longShots', 'ballPlaying', 'distribution'],
  passing: ['passing', 'ballPlaying', 'vision', 'crossing', 'distribution'],
  dribbling: ['dribbling', 'ballPlaying', 'offBall', 'distribution'],
  defending: ['tackling', 'marking', 'gkPositioning'],
  physical: ['physical'],
  mental: ['mental'],
  goalkeeping: ['reflexes', 'handling'],
};
// When a scene tests an attribute this position doesn't have, use the closest one it does.
export const SIMILAR_ATTRS = {
  finishing: ['longShots', 'offBall', 'dribbling'], longShots: ['finishing', 'passing', 'vision'], dribbling: ['ballPlaying', 'offBall', 'pace'],
  passing: ['ballPlaying', 'vision', 'distribution', 'crossing'], vision: ['passing', 'ballPlaying', 'mental'], crossing: ['passing', 'distribution'],
  offBall: ['pace', 'finishing', 'mental'], aerial: ['physical', 'command'], tackling: ['marking', 'physical'], marking: ['tackling', 'gkPositioning', 'mental'],
  ballPlaying: ['passing', 'distribution', 'vision'], reflexes: ['pace', 'mental'], handling: ['reflexes', 'mental'], gkPositioning: ['marking', 'mental'],
  command: ['aerial', 'physical'], distribution: ['passing', 'ballPlaying'],
};
// How to build the new attributes from an old (v0.4) save's eight stats.
export const FROM_LEGACY = {
  pace: ['pace'], physical: ['physical'], mental: ['mental'], finishing: ['shooting'], longShots: ['shooting', 'passing'], dribbling: ['dribbling'],
  passing: ['passing'], vision: ['passing', 'mental'], crossing: ['passing', 'dribbling'], offBall: ['pace', 'mental', 'shooting'], aerial: ['physical', 'defending'],
  tackling: ['defending'], marking: ['defending', 'mental'], ballPlaying: ['passing', 'defending'], reflexes: ['goalkeeping'], handling: ['goalkeeping'],
  gkPositioning: ['goalkeeping', 'mental'], command: ['goalkeeping', 'physical'], distribution: ['passing', 'goalkeeping'],
};

// Share of the team's goals / assists a player in this position typically gets.
export const GOAL_SHARE = { GK: 0, CB: 0.05, FB: 0.04, DM: 0.05, CM: 0.1, AM: 0.2, W: 0.22, ST: 0.36 };
export const ASSIST_SHARE = { GK: 0.01, CB: 0.03, FB: 0.1, DM: 0.07, CM: 0.15, AM: 0.24, W: 0.22, ST: 0.12 };

// ── Growth (original design rules) ─────────────────────────────
export const GROWTH = {
  maxPerWeek: 2,
  // Growth per season depends on age and on the gap between ability (OVR) and hidden potential.
  // A 17-year-old 30 points below his potential can add ~17 stat points a season; a 27-year-old near it, 1-2.
  seasonCap: (age, gap) => Math.max(1, Math.round(age <= 19 ? 6 + 0.7 * gap : age <= 22 ? 4 + 0.6 * gap : age <= 25 ? 2 + 0.45 * gap : age <= 28 ? 1 + 0.25 * gap : 1)),
  training: { hard: 0.5, balanced: 0.32, light: 0.12, rest: 0 },  // weekly chance of a training gain (before modifiers)
  matchGrowth: 0.28,                                              // chance per match of 45+ minutes (more with a good rating)
  potential: { mean: 72, sd: 9, min: 54, max: 97 },              // hidden potential at 16
};

// ── PFM (Performance Fitness Meter) ────────────────────────────
// Weekly load/recovery. The age decay lowers the CEILING permanently (career clock).
export const PFM = {
  plan: { hard: -3, balanced: -1, light: 3, rest: 7 },
  matchFull: -4,
  naturalRecovery: 2,
  ageDecay: (age) => (age >= 39 ? 1.5 : age >= 36 ? 0.8 : age >= 33 ? 0.3 : 0),
};

// ── Injury chance per week (original design) ───────────────────
export const INJURY = { base: 0.03, heavy: 0.06, age30: 0.02, lowPfm: 0.05, hardPlan: 0.015 };

export const INJURY_TYPES = [
  { type: 'Muscle strain', severity: 'minor', weeks: [1, 2], stat: 'physical', w: 30 },
  { type: 'Ankle sprain (grade 1)', severity: 'minor', weeks: [1, 3], stat: 'pace', w: 20 },
  { type: 'Hamstring tear', severity: 'moderate', weeks: [4, 8], stat: 'pace', w: 15 },
  { type: 'Ankle sprain (grade 2/3)', severity: 'moderate', weeks: [4, 8], stat: 'pace', w: 10 },
  { type: 'Metatarsal fracture', severity: 'moderate', weeks: [6, 10], stat: 'pace', w: 6 },
  { type: 'Knee ligament (MCL) tear', severity: 'severe', weeks: [8, 12], stat: 'physical', w: 7 },
  { type: 'Broken leg', severity: 'severe', weeks: [20, 32], stat: 'pace', w: 2 },
  { type: 'ACL rupture', severity: 'career-threatening', weeks: [32, 48], stat: 'pace', w: 4 },
];

// ── League strength (comparable to player overall) ─────────────
export const LEAGUE_QUALITY = {
  'England|1': 82, 'England|2': 69, 'England|3': 61, 'England|4': 56,
  'Spain|1': 81, 'Spain|2': 67, 'Spain|3': 58,
  'Germany|1': 79, 'Germany|2': 67, 'Germany|3': 59,
  'Italy|1': 79, 'Italy|2': 66, 'Italy|3': 57,
  'France|1': 77, 'France|2': 65, 'France|3': 56,
  'Portugal|1': 72, 'Portugal|2': 61, 'Netherlands|1': 71, 'Netherlands|2': 60,
  'Belgium|1': 70, 'Belgium|2': 60, 'Turkey|1': 71, 'Turkey|2': 60,
  'Scotland|1': 66, 'Scotland|2': 56, 'Scotland|3': 50,
  'Austria|1': 68, 'Switzerland|1': 67, 'Denmark|1': 67, 'Czech Republic|1': 66, 'Greece|1': 67,
  'Croatia|1': 65, 'Serbia|1': 64, 'Ukraine|1': 65, 'Russia|1': 68, 'Poland|1': 64, 'Norway|1': 64,
  'Sweden|1': 63, 'Romania|1': 62, 'Cyprus|1': 62, 'Israel|1': 62, 'Hungary|1': 61, 'Slovakia|1': 59,
  'Bulgaria|1': 59, 'Slovenia|1': 57,
  'Brazil|1': 74, 'Brazil|2': 63, 'Brazil|3': 56, 'Argentina|1': 72, 'Argentina|2': 60,
  'Colombia|1': 65, 'Uruguay|1': 64, 'Ecuador|1': 64, 'Chile|1': 63, 'Paraguay|1': 61, 'Peru|1': 60,
  'Bolivia|1': 56, 'Venezuela|1': 56,
  'United States|1': 69, 'United States|2': 58, 'Mexico|1': 70, 'Mexico|2': 58, 'Canada|1': 52, 'Costa Rica|1': 57,
  'Saudi Arabia|1': 70, 'Qatar|1': 63, 'United Arab Emirates|1': 64, 'Iran|1': 62, 'Iraq|1': 58,
  'Japan|1': 68, 'Japan|2': 60, 'Japan|3': 53, 'South Korea|1': 66, 'South Korea|2': 57, 'China PR|1': 62,
  'Australia|1': 63, 'Uzbekistan|1': 58,
  'Indonesia|1': 56, 'Indonesia|2': 48, 'Thailand|1': 57, 'Vietnam|1': 55, 'Malaysia|1': 55, 'Singapore|1': 49, 'India|1': 50,
  'Egypt|1': 63, 'Morocco|1': 63, 'Algeria|1': 60, 'Tunisia|1': 60, 'South Africa|1': 61, 'Nigeria|1': 52, 'Ghana|1': 52,
};
export const DEFAULT_TIER_QUALITY = [0, 55, 47, 42, 38];

// Hidden boost for big clubs (everyone else gets a small random spread).
export const CLUB_BONUS = {
  'Liverpool': 9, 'Arsenal': 9, 'Manchester City': 9, 'Chelsea': 7, 'Manchester United': 5, 'Newcastle United': 5,
  'Tottenham Hotspur': 4, 'Aston Villa': 4, 'Real Madrid CF': 11, 'FC Barcelona': 11, 'Atlético de Madrid': 7, 'Athletic Club': 3,
  'Villarreal CF': 3, 'FC Bayern München': 11, 'Borussia Dortmund': 6, 'Bayer 04 Leverkusen': 5, 'RB Leipzig': 4,
  'Inter': 8, 'SSC Napoli': 7, 'Juventus': 6, 'AC Milan': 6, 'Atalanta': 4, 'AS Roma': 3,
  'Paris Saint-Germain': 13, 'Olympique de Marseille': 5, 'AS Monaco': 5, 'LOSC Lille': 3,
  'SL Benfica': 7, 'FC Porto': 7, 'Sporting CP': 7, 'SC Braga': 3, 'PSV': 6, 'AFC Ajax': 6, 'Feyenoord': 6,
  'Club Brugge KV': 5, 'Royale Union Saint-Gilloise': 4, 'Celtic': 9, 'Rangers': 7, 'Galatasaray': 7, 'Fenerbahçe': 6, 'Beşiktaş': 3,
  'FC Red Bull Salzburg': 5, 'SK Sturm Graz': 3, 'FK Crvena zvezda (Red Star Belgrade)': 7, 'GNK Dinamo Zagreb': 4, 'Olympiacos': 5, 'PAOK': 4,
  'FC København': 4, 'SK Slavia Praha': 4,
  'Persib Bandung': 6, 'Persija Jakarta': 4, 'Dewa United Banten FC': 3, 'Persebaya Surabaya': 3, 'Borneo FC Samarinda': 3, 'Malut United': 2, 'Bali United FC': 2,
  'Buriram United': 7, 'Johor Darul Ta\'zim': 11, 'Thép Xanh Nam Định': 4, 'Lion City Sailors': 5,
  'Al-Hilal': 9, 'Al-Nassr': 8, 'Al-Ittihad': 8, 'Al-Ahli': 8, 'Al-Qadsiah': 4,
  'Flamengo': 7, 'Palmeiras': 7, 'Cruzeiro': 3, 'Botafogo': 3, 'River Plate': 6, 'Boca Juniors': 6, 'Racing Club': 3,
  'Inter Miami CF': 5, 'Los Angeles FC': 4, 'Club América': 5, 'Deportivo Toluca': 5, 'Tigres UANL': 4, 'C.F. Monterrey': 4, 'Cruz Azul': 4,
  'Vissel Kobe': 3, 'Kashima Antlers': 3, 'Sanfrecce Hiroshima': 3, 'Ulsan HD': 3, 'Jeonbuk Hyundai Motors': 4,
  'Melbourne City': 3, 'Mamelodi Sundowns': 9, 'Orlando Pirates': 4, 'Kaizer Chiefs': 2,
};

// Wages in the Gulf/China are inflated relative to playing level.
export const COUNTRY_WAGE_MULT = { 'Saudi Arabia': 3, 'Qatar': 2, 'United Arab Emirates': 2, 'China PR': 1.5, 'Japan': 0.9, 'Indonesia': 1.1 };

// Effective income tax for footballers (simplified).
export const TAX = {
  'Indonesia': 0.15, 'Saudi Arabia': 0, 'United Arab Emirates': 0, 'Qatar': 0, 'England': 0.4, 'Spain': 0.42, 'Italy': 0.4,
  'Germany': 0.42, 'France': 0.42, 'Netherlands': 0.42, 'Portugal': 0.3, 'Japan': 0.35, 'United States': 0.32, 'Thailand': 0.2,
};
export const DEFAULT_TAX = 0.25;

// Fans and followers: huge football-obsessed online audiences grow faster.
export const SOCIAL_BOOST = { 'Indonesia': 4, 'Brazil': 3, 'Argentina': 3, 'India': 3, 'Vietnam': 3, 'Nigeria': 2.5, 'Egypt': 2.5, 'Mexico': 2.5, 'Turkey': 2.5 };

export const EUR_IDR = 19000;

// ── Life web (relationships, stress, interludes) ───────────────
export const LIFE = {
  maxRipples: 3,                              // side-effect lines shown per decision
  neglect: { family: 3, love: 2, friends: 3 }, // weeks without contact before that relationship starts sliding
  coolAbove: 60,                              // above this, family/friends/partner cool by about 1 a week unless you keep investing
  softCap: 60,                                // above this (or below 100 minus this), each step further is harder
  stressRest: 30,                             // the level stress drifts back to on its own
  freeTimePerWeek: 3,                         // free-time actions per week, shared by activities and people (+1 while injured)
  stressInjury: 0.02,                         // extra weekly injury chance when stress is above 75
  interludeChance: 0.38,                      // share of "Play week" clicks that open a mid-week scene instead (time stands still)
  weeklyDecisions: { 1: 14, 2: 34, 3: 34, 4: 18 }, // how many story decisions a week brings (weights)
  maxPending: 5,                              // never more open decisions than this
  potentialUp: 0.03,                          // weekly chance that disciplined, happy hard work raises potential by 1 (age 26 and under)
  potentialDown: 0.04,                        // weekly chance that stress above 85 lowers it by 1
  repeatPenalty: 0.5,                         // each time a scenario has fired, its weight is divided by (1 + this × times)
};

// ── Sponsors (real brands in data/text/brands.json) ────────────
export const SPONSOR = {
  tier: { local: 4000, regional: 15000, global: 50000, luxury: 110000 }, // yearly € base at fame 40 (grows fast with fame and followers)
  approachBase: 0.06,   // monthly chance a brand approaches you (plus fame, followers, agent, image)
  missPost: 8, keepPost: 4, missEvent: 12, eventBoost: 12, // brand satisfaction changes
  moralityAt: 30,       // public image below this can trigger a morality clause
  terminateAt: 20,      // satisfaction below this: the brand walks
  renewAt: 55,          // satisfaction needed for a renewal offer
};

// ── Social media ───────────────────────────────────────────────
export const SOCIAL = {
  engagement: 0.05,     // share of followers who like an average post
  conversion: 0.06,     // new followers per like
  viralBase: 0.03,      // chance any post goes viral (more for goals, trends, replies)
  ceilingBase: 1500,    // follower ceiling = this × e^(fame/9) × country boost (fame 60 ≈ 1-5M, fame 90 ≈ 30-130M)
  adFatigueAfter: 3,    // sponsored posts per month before fans start calling you a billboard
  perWeek: 3,           // posts per week
  mult: { goal: 1.6, matchday: 1.1, training: 0.8, fans: 1, teammate: 0.8, family: 1.1, partner: 1.3, flex: 1.2, charity: 1, trend: 1.2, cryptic: 1.1, reply: 1, throwback: 1.1, greeting: 0.9, nation: 1.3, sponsor: 1 },
};

// ── Debt ───────────────────────────────────────────────────────
// Savings below zero cost interest each month, and a debt story comes back every few months until it's cleared.
export const DEBT = { monthlyInterest: 0.015, storyEveryMonths: 3 };

// Ramadan (approximate, ±1 day) — used for culturally relevant events. Covers a full career from 2025.
export const RAMADAN = [
  ['2026-02-18', '2026-03-19'], ['2027-02-08', '2027-03-09'], ['2028-01-28', '2028-02-26'],
  ['2029-01-16', '2029-02-14'], ['2030-01-06', '2030-02-04'], ['2030-12-26', '2031-01-24'],
  ['2031-12-15', '2032-01-13'], ['2032-12-04', '2033-01-02'], ['2033-11-23', '2033-12-22'],
  ['2034-11-12', '2034-12-11'], ['2035-11-01', '2035-11-30'], ['2036-10-20', '2036-11-18'],
  ['2037-10-10', '2037-11-08'], ['2038-09-29', '2038-10-28'], ['2039-09-19', '2039-10-18'],
  ['2040-09-07', '2040-10-06'], ['2041-08-28', '2041-09-26'], ['2042-08-17', '2042-09-15'],
  ['2043-08-06', '2043-09-04'], ['2044-07-26', '2044-08-24'], ['2045-07-15', '2045-08-13'],
];

// Season strings that need help being read (see data/world).
export const SEASON_OVERRIDE = {
  'Mexico|1': [6, 4], 'Colombia|1': [0, 11], 'Brazil|2': [3, 10], 'South Korea|1': [2, 10],
};
