// Player model: stats, overall rating, wages, market value, names.
import { POSITIONS, OVR_MODE, ORIGINAL_OVR_KEYS, STAT_KEYS, COUNTRY_WAGE_MULT, EUR_IDR } from './config.js';
import { clamp, gauss, pick, randint, round1 } from './util.js';
import { leagueQuality, splitKey } from './world.js';
import { ageAt } from './time.js';

export function overall(p) {
  if (OVR_MODE === 'original' && p.position !== 'GK') {
    return Math.round(ORIGINAL_OVR_KEYS.reduce((a, k) => a + p.stats[k], 0) / ORIGINAL_OVR_KEYS.length);
  }
  const w = POSITIONS[p.position].weights;
  return Math.round(Object.entries(w).reduce((a, [k, v]) => a + p.stats[k] * v, 0));
}

export const age = (state) => ageAt(state.player.dob, state.week);

// Stats for a new player whose positional overall lands near `target`.
export function generateStats(position, target) {
  const w = POSITIONS[position].weights;
  const maxW = Math.max(...Object.values(w));
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = 18 * ((w[k] ?? 0) / maxW) + gauss() * 3;
  const cur = Object.entries(w).reduce((a, [k, v]) => a + stats[k] * v, 0);
  for (const k of STAT_KEYS) stats[k] = clamp(Math.round(stats[k] + (target - cur)), 20, 99);
  if (position !== 'GK') stats.goalkeeping = randint(5, 12);
  else for (const k of ['shooting', 'dribbling']) stats[k] = clamp(stats[k] - 8, 15, 99);
  return stats;
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
  indo: { first: ['Rizky', 'Andi', 'Bayu', 'Dimas', 'Fajar', 'Hendra', 'Ilham', 'Yudha', 'Arif', 'Teguh', 'Fachri', 'Gilang', 'Rafi', 'Aditya', 'Reza', 'Wahyu'], last: ['Pratama', 'Saputra', 'Wijaya', 'Nugroho', 'Siregar', 'Simanjuntak', 'Hutapea', 'Firmansyah', 'Kurniawan', 'Setiawan', 'Lubis', 'Rahman', 'Hidayat', 'Santoso', 'Ramadhan', 'Tanjung'], female: ['Ayu', 'Dinda', 'Nadia', 'Putri', 'Salsabila', 'Citra', 'Anisa', 'Laras'] },
  latin: { first: ['Carlos', 'Diego', 'Mateo', 'Lucas', 'Rafael', 'Gabriel', 'Bruno', 'Thiago', 'Javier', 'Andrés', 'Iker', 'Tomás'], last: ['Silva', 'Fernández', 'González', 'Rodríguez', 'Pereira', 'Costa', 'Martínez', 'López', 'Souza', 'Romero', 'Ortega', 'Navarro'], female: ['Lucía', 'Camila', 'Valentina', 'Mariana', 'Sofía', 'Inés'] },
  euro: { first: ['James', 'Tom', 'Luca', 'Jonas', 'Mikkel', 'Pieter', 'Marco', 'Stefan', 'Erik', 'Liam', 'Niklas', 'Bram'], last: ['Walker', 'Hughes', 'Bakker', 'de Vries', 'Rossi', 'Novak', 'Jansen', 'Keller', 'Larsen', 'Petrov', 'Moreau', 'Kowalski'], female: ['Emma', 'Sophie', 'Lena', 'Chloé', 'Giulia', 'Freya'] },
  japan: { first: ['Kenta', 'Haruto', 'Yuto', 'Sota', 'Ren', 'Daiki', 'Takumi', 'Kaito'], last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Nakamura', 'Kobayashi'], female: ['Yui', 'Aoi', 'Hina', 'Sakura'] },
  korea: { first: ['Min-jun', 'Seo-jun', 'Do-yun', 'Ha-jun', 'Ji-ho', 'Joon-young'], last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang'], female: ['Seo-yeon', 'Ji-woo', 'Min-seo', 'Ha-eun'] },
  arabic: { first: ['Ahmed', 'Faisal', 'Salem', 'Khalid', 'Omar', 'Yousef', 'Hamad', 'Nasser'], last: ['Al-Harbi', 'Al-Qahtani', 'Al-Dosari', 'Al-Otaibi', 'Al-Shehri', 'Haddad', 'Mansour', 'Saleh'], female: ['Layla', 'Noor', 'Mariam', 'Sara'] },
  african: { first: ['Kwame', 'Ibrahim', 'Samuel', 'Moussa', 'Chinedu', 'Thabo', 'Youssef', 'Emmanuel'], last: ['Mensah', 'Okafor', 'Diallo', 'Traoré', 'Ndlovu', 'Boateng', 'Koné', 'Adeyemi'], female: ['Amara', 'Zola', 'Ama', 'Fatou'] },
  sea: { first: ['Nguyen', 'Somchai', 'Hafiz', 'Arif', 'Thanh', 'Kittipong'], last: ['Tran', 'Srisuk', 'Rahim', 'Ismail', 'Pham', 'Wongsa'], female: ['Linh', 'Mai', 'Aisyah', 'Ploy'] },
};
const COUNTRY_POOL = {
  Indonesia: 'indo', Japan: 'japan', 'South Korea': 'korea', Thailand: 'sea', Vietnam: 'sea', Malaysia: 'sea', Singapore: 'sea', Philippines: 'sea',
  'Saudi Arabia': 'arabic', Qatar: 'arabic', 'United Arab Emirates': 'arabic', Iraq: 'arabic', Jordan: 'arabic', Egypt: 'arabic', Morocco: 'arabic', Algeria: 'arabic', Tunisia: 'arabic', Kuwait: 'arabic', Oman: 'arabic',
  Spain: 'latin', Portugal: 'latin', Brazil: 'latin', Argentina: 'latin', Mexico: 'latin', Colombia: 'latin', Chile: 'latin', Uruguay: 'latin', Peru: 'latin', Ecuador: 'latin', Paraguay: 'latin', Bolivia: 'latin', Venezuela: 'latin', 'Costa Rica': 'latin',
  Nigeria: 'african', Ghana: 'african', 'South Africa': 'african', Senegal: 'african', "Côte d'Ivoire": 'african', Cameroon: 'african', Kenya: 'african', Tanzania: 'african',
};
export function personName(country, female = false) {
  const pool = POOLS[COUNTRY_POOL[country] ?? 'euro'];
  return `${pick(female ? pool.female : pool.first)} ${pick(pool.last)}`;
}
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

export const statLabel = (k) => ({ pace: 'Pace', shooting: 'Shooting', passing: 'Passing', dribbling: 'Dribbling', defending: 'Defending', physical: 'Physical', mental: 'Mental', goalkeeping: 'Goalkeeping' }[k]);

export function relevantStats(position) {
  return Object.entries(POSITIONS[position].weights).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

export const r1 = round1;
