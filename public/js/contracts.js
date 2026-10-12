// Contracts, line by line. A club contract is more than a weekly wage: signing-on fee, appearance, goal,
// clean-sheet and win bonuses, a yearly loyalty bonus, the release clause, image rights, a yearly raise,
// relegation and promotion clauses, and the role the club promised him. All of it is paid out by the engine.
import { chance, pick, randint } from './util.js';
import { yearOf } from './time.js';

const ATT = ['ST', 'W', 'AM'], MID = ['CM', 'DM'], DEF = ['CB', 'FB'];
const r10 = (x) => Math.round(x / 10) * 10;
const r1k = (x) => Math.round(x / 1000) * 1000;

export const ROLE_PROMISE = { key: 'Key player', rotation: 'Rotation player', squad: 'Squad player', prospect: 'Young prospect' };

// Terms for a new contract. `kind`: youth | permanent | free | loan | renewal | return.
export function clubTerms(state, { wage, years, kind, tier = 1, country = '', release = null, qualityDelta = 0, age = 20 }) {
  const p = state.player;
  const pos = p.position;
  const u = (a, b) => a + Math.random() * (b - a);
  const goalB = ATT.includes(pos) ? u(0.18, 0.4) : MID.includes(pos) ? u(0.1, 0.25) : DEF.includes(pos) ? u(0.06, 0.15) : 0;
  const csB = pos === 'GK' ? u(0.15, 0.35) : DEF.includes(pos) ? u(0.08, 0.2) : pos === 'DM' ? u(0.03, 0.08) : 0;
  const loan = kind === 'loan';
  const c = {
    wage, years, kind,
    signingFee: loan || kind === 'return' ? 0 : r10(wage * (kind === 'free' ? randint(8, 20) : kind === 'youth' ? randint(1, 3) : kind === 'renewal' ? randint(3, 8) : randint(4, 12))),
    appBonus: r10(wage * u(0.04, 0.14)),
    goalBonus: r10(wage * goalB),
    assistBonus: r10(wage * goalB * 0.5),
    cleanSheetBonus: r10(wage * csB),
    winBonus: r10(wage * u(0.05, 0.15)),
    loyaltyBonus: !loan && years >= 3 && kind !== 'youth' ? r10(wage * u(2, 6)) : 0,
    releaseClause: release ?? (loan ? null : country === 'Spain' || chance(0.6) ? null : 0), // 0 = to be set from market value by the engine; null = none
    imageRights: loan ? 100 : pick([100, 100, 100, 90, 80, 70, 50]),
    wageRise: loan ? 0 : pick([0, 0, 3, 5, 5, 8, 10]),
    relegationCut: loan || tier >= 3 ? 0 : chance(0.65) ? pick([20, 25, 30, 40, 50]) : 0,
    promotionRaise: !loan && tier >= 2 && chance(0.7) ? pick([20, 25, 30, 50]) : 0,
    promisedRole: qualityDelta <= -4 ? 'key' : qualityDelta <= 0 ? 'rotation' : age <= 20 ? 'prospect' : 'squad',
    buyOption: null,
  };
  if (country === 'Spain' && !loan) c.releaseClause = 0; // every Spanish contract has one
  return c;
}

// The table shown on offers and in the Contracts panel.
export function contractSheet(c, money, { loanFee = null, fee = null } = {}) {
  if (!c) return [];
  const rows = [['Weekly wage', money(c.wage)], ['Length', c.kind === 'loan' ? 'Until the end of the season' : `${c.years} year${c.years > 1 ? 's' : ''}`]];
  if (fee) rows.push(['Transfer fee', money(fee)]);
  if (loanFee) rows.push(['Loan fee (club to club)', money(loanFee)]);
  if (c.signingFee) rows.push(['Signing-on fee', money(c.signingFee)]);
  if (c.appBonus) rows.push(['Appearance bonus', money(c.appBonus)]);
  if (c.goalBonus) rows.push(['Goal bonus', money(c.goalBonus)]);
  if (c.assistBonus) rows.push(['Assist bonus', money(c.assistBonus)]);
  if (c.cleanSheetBonus) rows.push(['Clean-sheet bonus', money(c.cleanSheetBonus)]);
  if (c.winBonus) rows.push(['Win bonus (when he plays)', money(c.winBonus)]);
  if (c.loyaltyBonus) rows.push(['Loyalty bonus (yearly)', money(c.loyaltyBonus)]);
  if (c.wageRise) rows.push(['Yearly raise', `+${c.wageRise}%`]);
  rows.push(['Release clause', c.releaseClause ? money(c.releaseClause) : c.releaseClause === 0 ? 'Set at signing' : 'None']);
  rows.push(['Image rights he keeps', `${c.imageRights}%${c.imageRights < 100 ? ' (the club takes the rest of sponsor income)' : ''}`]);
  if (c.relegationCut) rows.push(['Relegation clause', `wage −${c.relegationCut}%`]);
  if (c.promotionRaise) rows.push(['Promotion clause', `wage +${c.promotionRaise}%`]);
  rows.push(['Promised role', ROLE_PROMISE[c.promisedRole] ?? '—']);
  if (c.buyOption) rows.push(['Option to buy', money(c.buyOption)]);
  return rows;
}

// Negotiating: the agent pushes on money, or on the small print.
export function improveTerms(c, how, agentQ = 30) {
  const out = { ...c };
  if (how === 'money') {
    const k = 1.08 + agentQ / 500 + Math.random() * 0.1;
    out.wage = r10(c.wage * k); out.signingFee = r10(c.signingFee * (1.2 + agentQ / 300)); out.goalBonus = r10(c.goalBonus * 1.15); out.appBonus = r10(c.appBonus * 1.15);
  } else {
    if (c.releaseClause) out.releaseClause = r1k(c.releaseClause * 0.65); else if (c.releaseClause === null && c.kind !== 'loan') out.releaseClause = 0;
    out.imageRights = Math.max(c.imageRights, 90);
    out.relegationCut = Math.round(c.relegationCut / 2);
    out.wageRise = Math.max(c.wageRise, 5);
    out.loyaltyBonus = c.loyaltyBonus || (c.kind !== 'loan' ? r10(c.wage * 2) : 0);
  }
  return out;
}

// After each club match: the bonuses written into his contract.
export function matchBonus(state, m) {
  const c = state.player.club?.contract;
  if (!c || !m.minutes) return 0;
  let b = c.appBonus + m.goals * c.goalBonus + m.assists * c.assistBonus;
  if (m.ga === 0 && m.minutes >= 60) b += c.cleanSheetBonus;
  if (m.result === 'W') b += c.winBonus;
  state.player.season.bonuses = (state.player.season.bonuses ?? 0) + b;
  return b;
}

// Every contract anniversary: the yearly raise. Every season end: the loyalty bonus.
export function contractYear(state, res) {
  const club = state.player.club;
  const c = club?.contract;
  if (!c || c.kind === 'loan') return;
  const since = club.contractStart ?? club.joinedWeek;
  if (state.week > since && (state.week - since) % 52 === 0 && c.wageRise) {
    club.wageWeekly = r10(club.wageWeekly * (1 + c.wageRise / 100));
    c.wage = club.wageWeekly;
    res.notes.push(`Contract anniversary: the yearly raise kicks in. ${state.player.jerseyName} now earns €${club.wageWeekly.toLocaleString('en')} a week.`);
  }
}

// Clauses that fire with promotion or relegation.
export function divisionClause(state, movement, res) {
  const club = state.player.club;
  const c = club?.contract;
  if (!c) return;
  if (movement === 'relegated' && c.relegationCut) {
    club.wageWeekly = r10(club.wageWeekly * (1 - c.relegationCut / 100)); c.wage = club.wageWeekly;
    res.notes.push(`The relegation clause bites: his wage drops ${c.relegationCut}% to €${club.wageWeekly.toLocaleString('en')} a week.`);
  }
  if (movement === 'promoted' && c.promotionRaise) {
    club.wageWeekly = r10(club.wageWeekly * (1 + c.promotionRaise / 100)); c.wage = club.wageWeekly;
    res.notes.push(`The promotion clause pays: his wage rises ${c.promotionRaise}% to €${club.wageWeekly.toLocaleString('en')} a week.`);
  }
}

// Was the promised role kept? (Used by the transfer outlook and the story.)
export function promiseBroken(state) {
  const p = state.player, c = p.club?.contract;
  if (!c) return false;
  const role = p.squadRole;
  return (c.promisedRole === 'key' && ['bench', 'outcast'].includes(role)) || (c.promisedRole === 'rotation' && role === 'outcast');
}

// ── Sponsor deal terms ──
const BONUS_BY_IND = { boots: 'goal', sportswear: 'goal', nutrition: 'goal', drinks: 'trophy', watch: 'trophy', luxury: 'trophy', auto: 'trophy', telecom: 'cap', banking: 'cap', airline: 'cap' };
export function sponsorTerms(b, value, years) {
  const kind = BONUS_BY_IND[b.ind] ?? pick(['goal', 'cap', 'trophy', 'followers']);
  const bonus = { [kind]: kind === 'goal' ? r10(value * 0.008) : kind === 'cap' ? r10(value * 0.01) : kind === 'trophy' ? r10(value * 0.1) : r10(value * 0.05) };
  return {
    bonus, allowance: r10(value * (b.tier === 'luxury' ? 0.15 : 0.06)), exitFee: r10(value * 0.5), renewalOption: chance(0.5),
    exclusive: b.cat, morality: true, years,
  };
}

export function sponsorSheet(d, money) {
  const rows = [['Yearly fee', money(d.value ?? d.annualValue)], ['Length', `${d.years ?? '?'} year${(d.years ?? 1) > 1 ? 's' : ''}`]];
  if (d.duty) rows.push(['Sponsored posts', `${d.duty.posts} a month`], ['Appearances', `${d.duty.events} a year`]);
  const t = d.terms;
  if (t) {
    for (const [k, v] of Object.entries(t.bonus ?? {})) rows.push([{ goal: 'Bonus per goal', cap: 'Bonus per international cap', trophy: 'Bonus per trophy', followers: 'Bonus per 1M new followers' }[k], money(v)]);
    rows.push(['Free products (yearly value)', money(t.allowance)], ['Exclusivity', `No rival ${t.exclusive} brand`], ['Morality clause', 'Yes: a scandal can end the deal'], ['Leaving early costs', money(t.exitFee)]);
    if (t.renewalOption) rows.push(['Renewal option', 'The brand can extend at +15%']);
  }
  return rows;
}

// Monthly sponsor bonuses from what he did this month.
export function sponsorBonuses(state) {
  const p = state.player;
  const tally = p.tally ?? { goals: 0, caps: 0, trophies: 0, followersM: 0 };
  let total = 0;
  const lines = [];
  for (const e of p.endorsements ?? []) {
    if (e.expiryWeek <= state.week || !e.terms?.bonus) continue;
    const b = e.terms.bonus;
    const x = (b.goal ?? 0) * tally.goals + (b.cap ?? 0) * tally.caps + (b.trophy ?? 0) * tally.trophies + (b.followers ?? 0) * Math.floor(tally.followersM);
    if (x > 0) { total += x; lines.push(`${e.brand} bonus €${Math.round(x).toLocaleString('en')}`); }
  }
  p.tally = { goals: 0, caps: 0, trophies: 0, followersM: tally.followersM % 1 };
  return { total: Math.round(total), lines };
}

export const contractEndYear = (club) => (club ? yearOf(club.contractEndWeek) : null);
