// Player model: stats, overall rating, wages, market value, names.
import { POSITIONS, ATTRS, LEGACY_STATS, FROM_LEGACY, SIMILAR_ATTRS, COUNTRY_WAGE_MULT, EUR_IDR } from './config.js';
import { clamp, gauss, pick, randint, round1 } from './util.js';
import { leagueQuality, splitKey } from './world.js';
import { ageAt } from './time.js';

export function overall(p) {
  const w = POSITIONS[p.position].weights;
  return Math.round(Object.entries(w).reduce((a, [k, v]) => a + (p.stats[k] ?? 40) * v, 0));
}

export const age = (state) => ageAt(state.player.dob, state.week);

// The seven attributes of his position, most important first.
export const attrsOf = (position) => Object.entries(POSITIONS[position].weights).sort((a, b) => b[1] - a[1]).map(([k]) => k);

// Translate any stat name (new attribute, or an old general stat like 'shooting') to one this position has.
export function attrFor(position, key) {
  const w = POSITIONS[position].weights;
  if (w[key] !== undefined) return key;
  for (const k of LEGACY_STATS[key] ?? SIMILAR_ATTRS[key] ?? []) if (w[k] !== undefined) return k;
  return 'mental';
}
export const attrValue = (p, key) => p.stats[attrFor(p.position, key)] ?? 40;

// Attributes for a new player whose positional overall lands near `target`.
export function generateStats(position, target) {
  const w = POSITIONS[position].weights;
  const maxW = Math.max(...Object.values(w));
  const stats = {};
  for (const k of Object.keys(w)) stats[k] = 14 * (w[k] / maxW) + gauss() * 3.5;
  const cur = Object.entries(w).reduce((a, [k, v]) => a + stats[k] * v, 0);
  for (const k of Object.keys(w)) stats[k] = clamp(Math.round(stats[k] + (target - cur)), 20, 99);
  return stats;
}

// v0.4 saves had eight general stats. Rebuild them as this position's attributes (overall stays about the same).
export function convertLegacyStats(position, old) {
  const out = {};
  for (const k of Object.keys(POSITIONS[position].weights)) {
    const src = FROM_LEGACY[k].map((s) => old[s]).filter((v) => typeof v === 'number');
    out[k] = clamp(Math.round(src.length ? src.reduce((a, b) => a + b, 0) / src.length : 45), 15, 99);
  }
  return out;
}

export function weeklyWage(ovr, key) {
  const { country } = splitKey(key);
  const q = leagueQuality(key);
  const w = 50 * Math.exp((ovr - 40) / 9) * Math.exp((q - 55) / 8) * (COUNTRY_WAGE_MULT[country] ?? 1);
  return Math.max(40, Math.round(w / 10) * 10);
}

export function marketValue(p, ageYears, key, contractYearsLeft) {
  const ovr = overall(p);
  const q = leagueQuality(key);
  const ageF = ageYears <= 18 ? 1.7 : ageYears <= 21 ? 1.5 : ageYears <= 24 ? 1.35 : ageYears <= 27 ? 1.15 : ageYears <= 29 ? 0.9 : ageYears <= 31 ? 0.6 : ageYears <= 33 ? 0.35 : 0.15;
  const formF = p.form >= 7.2 ? 1.2 : p.form >= 6.9 ? 1.08 : p.form <= 6.1 ? 0.82 : 1;
  const injF = p.injury ? (p.injury.weeksLeft > 20 ? 0.65 : p.injury.weeksLeft > 6 ? 0.85 : 0.95) : 1;
  const contractF = contractYearsLeft <= 0 ? 0.5 : contractYearsLeft <= 1 ? 0.85 : 1;
  const repF = 1 + p.reputation / 200;
  const v = 3000 * Math.exp((ovr - 40) / 6) * ageF * Math.exp((q - 55) / 12) * formF * injF * contractF * repF;
  return Math.round(v / 1000) * 1000;
}

export const ROLE_ORDER = ['outcast', 'bench', 'rotation', 'starter'];

export function trustRole(trust) {
  return trust >= 60 ? 'starter' : trust >= 40 ? 'rotation' : trust >= 20 ? 'bench' : 'outcast';
}
export function abilityRole(ovr, clubStr) {
  const gap = ovr - clubStr;
  return gap >= -2 ? 'starter' : gap >= -7 ? 'rotation' : gap >= -14 ? 'bench' : 'outcast';
}
export const minRole = (a, b) => ROLE_ORDER[Math.min(ROLE_ORDER.indexOf(a), ROLE_ORDER.indexOf(b))];

export function wealthLevel(eur) {
  const idr = eur * EUR_IDR;
  if (idr < 0) return 'In debt';
  if (idr < 50e6) return 'Struggling';
  if (idr < 500e6) return 'Comfortable';
  if (idr < 5e9) return 'Well-off';
  if (idr < 50e9) return 'Wealthy';
  return 'Elite';
}

// ── Name pools for fictional characters (managers, teammates, agents, partners) ──
const POOLS = {
  indo: {
    first: ['Rizky', 'Andi', 'Bayu', 'Dimas', 'Fajar', 'Hendra', 'Ilham', 'Yudha', 'Arif', 'Teguh', 'Fachri', 'Gilang', 'Rafi', 'Aditya', 'Reza', 'Wahyu', 'Asnawi', 'Witan', 'Egy', 'Ricky', 'Marselino', 'Rachmat', 'Arkhan', 'Dony', 'Saddil', 'Irfan', 'Yakob', 'Evan', 'Ferdinan', 'Hokky', 'Kadek', 'Komang', 'Made', 'Wayan', 'Ernando', 'Nadeo', 'Alfeandra', 'Beckham', 'Rifqi', 'Septian', 'Taufik', 'Zanadin', 'Muhammad', 'Abdul', 'Galih', 'Haikal', 'Yance', 'Ronaldo', 'Sandy'],
    last: ['Pratama', 'Saputra', 'Wijaya', 'Nugroho', 'Siregar', 'Simanjuntak', 'Hutapea', 'Firmansyah', 'Kurniawan', 'Setiawan', 'Lubis', 'Rahman', 'Hidayat', 'Santoso', 'Ramadhan', 'Tanjung', 'Nasution', 'Harahap', 'Sitompul', 'Manurung', 'Sihombing', 'Panjaitan', 'Wanggai', 'Mofu', 'Rumbiak', 'Wenda', 'Kogoya', 'Putra', 'Maulana', 'Syahputra', 'Hakim', 'Fauzi', 'Gunawan', 'Susanto', 'Wibowo', 'Utomo', 'Prasetyo', 'Darmawan', 'Pangestu', 'Rusdi', 'Kusuma', 'Halim', 'Akbar', 'Iskandar', 'Pane', 'Sembiring', 'Ginting', 'Tarigan'],
    female: ['Ayu', 'Dinda', 'Nadia', 'Putri', 'Salsabila', 'Citra', 'Anisa', 'Laras', 'Kirana', 'Alya', 'Shafira', 'Tiara', 'Nabila', 'Rania', 'Aurel', 'Febby', 'Intan', 'Maya', 'Sekar', 'Wulan', 'Zahra', 'Bunga', 'Cinta', 'Dewi', 'Gita', 'Keisha'],
  },
  latin: {
    first: ['Carlos', 'Diego', 'Mateo', 'Lucas', 'Rafael', 'Gabriel', 'Bruno', 'Thiago', 'Javier', 'Andrés', 'Iker', 'Tomás', 'Santiago', 'Nicolás', 'Matías', 'Joaquín', 'Felipe', 'Rodrigo', 'Vinícius', 'Gustavo', 'Pedro', 'João', 'Miguel', 'Álvaro', 'Pablo', 'Sergio', 'Hugo', 'Emiliano', 'Facundo', 'Lautaro', 'Enzo', 'Cristian', 'Raúl', 'Héctor', 'Leandro', 'Murilo', 'Caio', 'Renan', 'Danilo', 'Éder'],
    last: ['Silva', 'Fernández', 'González', 'Rodríguez', 'Pereira', 'Costa', 'Martínez', 'López', 'Souza', 'Romero', 'Ortega', 'Navarro', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Herrera', 'Medina', 'Castro', 'Vargas', 'Rojas', 'Mendes', 'Oliveira', 'Santos', 'Almeida', 'Carvalho', 'Ribeiro', 'Lima', 'Araújo', 'Barbosa', 'Moreno', 'Molina', 'Suárez', 'Cabrera', 'Acosta', 'Benítez', 'Aguirre'],
    female: ['Lucía', 'Camila', 'Valentina', 'Mariana', 'Sofía', 'Inés', 'Isabela', 'Martina', 'Julia', 'Renata', 'Gabriela', 'Daniela', 'Carolina', 'Paula', 'Elena', 'Beatriz', 'Luana', 'Bianca'],
  },
  euro: {
    first: ['James', 'Tom', 'Luca', 'Jonas', 'Mikkel', 'Pieter', 'Marco', 'Stefan', 'Erik', 'Liam', 'Niklas', 'Bram', 'Oliver', 'Harry', 'Jack', 'Kieran', 'Mason', 'Declan', 'Florian', 'Leon', 'Timo', 'Mats', 'Lorenzo', 'Matteo', 'Federico', 'Alessandro', 'Antoine', 'Théo', 'Hugo', 'Kylian', 'Jan', 'Milan', 'Luka', 'Ivan', 'Nikola', 'Dušan', 'Sander', 'Daan', 'Kasper', 'Rasmus', 'Viktor', 'Filip', 'Jakub', 'Piotr', 'Andrei', 'Callum', 'Ryan', 'Ben'],
    last: ['Walker', 'Hughes', 'Bakker', 'de Vries', 'Rossi', 'Novak', 'Jansen', 'Keller', 'Larsen', 'Petrov', 'Moreau', 'Kowalski', 'Smith', 'Taylor', 'Brown', 'Wilson', 'Clarke', 'Evans', 'Müller', 'Schmidt', 'Wagner', 'Becker', 'Hoffmann', 'Ricci', 'Bianchi', 'Romano', 'Colombo', 'Dubois', 'Lambert', 'Laurent', 'Fontaine', 'Visser', 'Mulder', 'Nielsen', 'Andersen', 'Johansson', 'Lindqvist', 'Horvat', 'Kovačić', 'Jovanović', 'Nowak', 'Popescu', 'Fischer', 'Murphy', 'Kelly', 'Doyle'],
    female: ['Emma', 'Sophie', 'Lena', 'Chloé', 'Giulia', 'Freya', 'Mia', 'Hannah', 'Charlotte', 'Amelie', 'Isla', 'Ella', 'Clara', 'Alice', 'Elena', 'Nora', 'Ines', 'Maja'],
  },
  japan: {
    first: ['Kenta', 'Haruto', 'Yuto', 'Sota', 'Ren', 'Daiki', 'Takumi', 'Kaito', 'Riku', 'Hiroki', 'Shota', 'Yuki', 'Kaoru', 'Ritsu', 'Wataru', 'Junya', 'Ayase', 'Daichi', 'Koki', 'Takuma'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Mori', 'Endo'],
    female: ['Yui', 'Aoi', 'Hina', 'Sakura', 'Mei', 'Rin', 'Yuna', 'Mio', 'Saki', 'Nanami'],
  },
  korea: {
    first: ['Min-jun', 'Seo-jun', 'Do-yun', 'Ha-jun', 'Ji-ho', 'Joon-young', 'Hyun-woo', 'Ji-hoon', 'Sung-min', 'Dong-hyun', 'Kang-in', 'Jae-sung', 'Woo-young', 'Seung-ho', 'Tae-hwan', 'Young-woo'],
    last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang'],
    female: ['Seo-yeon', 'Ji-woo', 'Min-seo', 'Ha-eun', 'Soo-ah', 'Ye-jin', 'Da-eun', 'Yu-na'],
  },
  arabic: {
    first: ['Ahmed', 'Faisal', 'Salem', 'Khalid', 'Omar', 'Yousef', 'Hamad', 'Nasser', 'Abdullah', 'Saud', 'Fahad', 'Ali', 'Hassan', 'Mohammed', 'Sultan', 'Turki', 'Majed', 'Rayan', 'Ziyad', 'Karim', 'Achraf', 'Hakim', 'Sofiane', 'Youssef'],
    last: ['Al-Harbi', 'Al-Qahtani', 'Al-Dosari', 'Al-Otaibi', 'Al-Shehri', 'Haddad', 'Mansour', 'Saleh', 'Al-Ghamdi', 'Al-Zahrani', 'Al-Mutairi', 'Al-Malki', 'Benali', 'El Amrani', 'Bouzid', 'Hamdi', 'Nasri', 'Khalil', 'Darwish', 'Farouk'],
    female: ['Layla', 'Noor', 'Mariam', 'Sara', 'Yasmin', 'Lina', 'Rania', 'Amira', 'Salma', 'Hana'],
  },
  african: {
    first: ['Kwame', 'Ibrahim', 'Samuel', 'Moussa', 'Chinedu', 'Thabo', 'Youssef', 'Emmanuel', 'Victor', 'Sadio', 'Kalidou', 'Idrissa', 'Wilfried', 'Franck', 'Thomas', 'Joseph', 'Kelechi', 'Ademola', 'Teboho', 'Percy', 'Mohammed', 'Abdou', 'Serge', 'Patson'],
    last: ['Mensah', 'Okafor', 'Diallo', 'Traoré', 'Ndlovu', 'Boateng', 'Koné', 'Adeyemi', 'Osei', 'Owusu', 'Sarr', 'Ndiaye', 'Mbeki', 'Dlamini', 'Nwosu', 'Eze', 'Ibe', 'Bamba', 'Touré', 'Cissé', 'Asante', 'Onyango', 'Zulu', 'Mokoena'],
    female: ['Amara', 'Zola', 'Ama', 'Fatou', 'Ngozi', 'Thandi', 'Aisha', 'Nia', 'Adwoa', 'Chioma'],
  },
  sea: {
    first: ['Nguyen', 'Somchai', 'Hafiz', 'Arif', 'Thanh', 'Kittipong', 'Supachok', 'Theerathon', 'Chanathip', 'Quang', 'Van', 'Duc', 'Faisal', 'Safawi', 'Akhyar', 'Ikhsan', 'Irfan', 'Joshua', 'Ekanit', 'Suphanat'],
    last: ['Tran', 'Srisuk', 'Rahim', 'Ismail', 'Pham', 'Wongsa', 'Le', 'Hoang', 'Bunmathan', 'Sarachat', 'Songkrasin', 'Rashid', 'Halim', 'Fandi', 'Mohamad', 'Ahmad', 'Vo', 'Do', 'Chaiyawong', 'Phala'],
    female: ['Linh', 'Mai', 'Aisyah', 'Ploy', 'Nurul', 'Siti', 'Thao', 'Mook', 'Farah', 'Lan'],
  },
};
const COUNTRY_POOL = {
  Indonesia: 'indo', Japan: 'japan', 'South Korea': 'korea', Thailand: 'sea', Vietnam: 'sea', Malaysia: 'sea', Singapore: 'sea', Philippines: 'sea',
  'Saudi Arabia': 'arabic', Qatar: 'arabic', 'United Arab Emirates': 'arabic', Iraq: 'arabic', Jordan: 'arabic', Egypt: 'arabic', Morocco: 'arabic', Algeria: 'arabic', Tunisia: 'arabic', Kuwait: 'arabic', Oman: 'arabic',
  Spain: 'latin', Portugal: 'latin', Brazil: 'latin', Argentina: 'latin', Mexico: 'latin', Colombia: 'latin', Chile: 'latin', Uruguay: 'latin', Peru: 'latin', Ecuador: 'latin', Paraguay: 'latin', Bolivia: 'latin', Venezuela: 'latin', 'Costa Rica': 'latin',
  Nigeria: 'african', Ghana: 'african', 'South Africa': 'african', Senegal: 'african', "Côte d'Ivoire": 'african', Cameroon: 'african', Kenya: 'african', Tanzania: 'african',
};
export function personName(country, female = false, rng = Math.random) {
  const pool = POOLS[poolKey(country)];
  const pk = (a) => a[Math.floor(rng() * a.length)];
  return `${pk(female ? pool.female : pool.first)} ${pk(pool.last)}`;
}
const poolKey = (country) => COUNTRY_POOL[country] ?? (EXTRA_POOL[country] ?? 'euro');
// A footballer from somewhere else (foreign signings, opponents' imports).
const FOREIGN = ['Brazil', 'Argentina', 'Japan', 'South Korea', 'Nigeria', 'Ghana', 'Spain', 'Portugal', 'Netherlands', 'England', 'Senegal', 'Colombia', 'Serbia', 'Croatia', 'France', 'Morocco', 'Australia', 'Uruguay'];
export function foreignCountry(rng = Math.random, not = null) {
  const list = FOREIGN.filter((c) => c !== not);
  return list[Math.floor(rng() * list.length)];
}
const EXTRA_POOL = { France: 'euro', Serbia: 'euro', Croatia: 'euro', Australia: 'euro', England: 'euro', Germany: 'euro', Italy: 'euro', Netherlands: 'euro' };
export function managerName(country) {
  return Math.random() < 0.3 ? personName('England') : personName(country);
}

export function moodFrom(p, extra = null) {
  if (extra) return extra;
  if (p.injury && p.injury.weeksLeft > 8) return 'Broken';
  if (p.injury) return 'Frustrated';
  // The life web: stress and morale colour everything.
  if (p.life?.stress >= 82) return pick(['Anxious', 'Numb']);
  if (p.life?.morale <= 20) return 'Lost';
  if (p.life?.morale >= 82 && p.form >= 7) return 'On Fire';
  if (p.form >= 7.6) return 'On Fire';
  if (p.form >= 7.1) return 'Confident';
  if (p.squadRole === 'outcast') return 'Lost';
  if (p.squadRole === 'bench' && p.manager.trust < 40) return 'Frustrated';
  if (p.form <= 6.0) return 'Anxious';
  return pick(['Focused', 'Determined', 'Motivated']);
}

// What scouts think his potential is: a range that narrows as he gets older (and is slightly off, like real scouting).
export function scoutEstimate(p, ageYears) {
  const pot = p.potential ?? 70;
  const bias = p.scoutBias ?? 0;
  const width = Math.max(2, Math.round(14 - (ageYears - 16) * 1.6));
  const lo = Math.max(overall(p), Math.round(pot + bias - width / 2));
  const hi = Math.max(lo, Math.round(pot + bias + width / 2));
  const stars = Math.max(0.5, Math.min(5, Math.round(((lo + hi) / 2 - 45) / 9 * 2) / 2));
  return { lo, hi, stars, label: hi >= 88 ? 'World-class prospect' : hi >= 80 ? 'Top-level potential' : hi >= 72 ? 'Solid professional' : hi >= 64 ? 'Squad player' : 'Limited ceiling' };
}

export const statLabel = (k) => ATTRS[k]?.label ?? ({ shooting: 'Shooting', defending: 'Defending', goalkeeping: 'Goalkeeping' }[k] ?? k);

export const relevantStats = attrsOf;

// How established he is: 1 Prospect · 2 Squad player · 3 Established · 4 Star · 5 Icon.
// Fame alone is not enough for the senior roles: leading a dressing room takes years and games.
export const LEVELS = ['', 'Prospect', 'Squad player', 'Established', 'Star', 'Icon'];
export function careerLevel(p, ageYears) {
  const rep = p.reputation ?? 0, apps = p.career?.apps ?? 0;
  const byFame = rep >= 70 ? 5 : rep >= 45 ? 4 : rep >= 22 ? 3 : rep >= 8 ? 2 : 1;
  const bySeniority = apps >= 250 ? 5 : apps >= 120 ? 4 : apps >= 45 ? 3 : apps >= 8 ? 2 : 1;
  return Math.max(1, Math.min(byFame, bySeniority + (ageYears >= 24 ? 1 : 0)));
}

export const r1 = round1;
