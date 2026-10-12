// Balancing numbers and lookup tables. Tweak the game here.

// Week 0 of every career = Monday 7 July 2025 (start of 2025-26 pre-season).
export const START_DATE_UTC = Date.UTC(2025, 6, 7);
export const START_AGE = 16;

// ── Overall rating ─────────────────────────────────────────────
// 'positional' = weighted by position (default; fixes goalkeepers/defenders, see docs/OPEN-QUESTIONS.md #2)
// 'original'   = plain average of pace/shooting/passing/dribbling/defending/physical (original design)
export const OVR_MODE = 'positional';

export const POSITIONS = {
  GK: { name: 'Goalkeeper', weights: { goalkeeping: 0.7, mental: 0.15, physical: 0.1, passing: 0.05 } },
  CB: { name: 'Centre-back', weights: { defending: 0.45, physical: 0.25, mental: 0.15, pace: 0.1, passing: 0.05 } },
  FB: { name: 'Full-back', weights: { defending: 0.3, pace: 0.25, physical: 0.15, passing: 0.15, dribbling: 0.1, mental: 0.05 } },
  DM: { name: 'Defensive midfielder', weights: { defending: 0.3, passing: 0.25, physical: 0.2, mental: 0.2, pace: 0.05 } },
  CM: { name: 'Central midfielder', weights: { passing: 0.35, mental: 0.2, dribbling: 0.15, physical: 0.1, defending: 0.1, shooting: 0.1 } },
  AM: { name: 'Attacking midfielder', weights: { passing: 0.3, dribbling: 0.25, shooting: 0.2, mental: 0.15, pace: 0.1 } },
  W:  { name: 'Winger', weights: { pace: 0.3, dribbling: 0.3, shooting: 0.15, passing: 0.15, mental: 0.1 } },
  ST: { name: 'Striker', weights: { shooting: 0.4, pace: 0.2, dribbling: 0.15, physical: 0.15, mental: 0.1 } },
};

export const STAT_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'mental', 'goalkeeping'];
export const ORIGINAL_OVR_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

// Share of the team's goals / assists a player in this position typically gets.
export const GOAL_SHARE = { GK: 0, CB: 0.05, FB: 0.04, DM: 0.05, CM: 0.1, AM: 0.2, W: 0.22, ST: 0.36 };
export const ASSIST_SHARE = { GK: 0.01, CB: 0.03, FB: 0.1, DM: 0.07, CM: 0.15, AM: 0.24, W: 0.22, ST: 0.12 };

// ── Growth (original design rules) ─────────────────────────────
export const GROWTH = {
  maxPerWeek: 2,
  seasonCapByAge: (age) => (age <= 23 ? 8 : age <= 28 ? 4 : 1), // 29+: mental only
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
  neglect: { family: 5, love: 3, friends: 4 }, // weeks without contact before that relationship starts sliding
  freeTimePerWeek: 2,                         // free-time actions per week (+1 while injured)
  stressInjury: 0.02,                         // extra weekly injury chance when stress is above 75
  interludeChance: 0.3,                       // share of "Play week" clicks that open a mid-week scene instead (time stands still)
  weeklyDecisions: { 1: 14, 2: 34, 3: 34, 4: 18 }, // how many story decisions a week brings (weights)
  maxPending: 5,                              // never more open decisions than this
  repeatPenalty: 0.5,                         // each time a scenario has fired, its weight is divided by (1 + this × times)
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
