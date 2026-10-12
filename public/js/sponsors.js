// Sponsors: real brands (data/text/brands.json) that approach the player, pay him, and expect things in return.
// Each deal has duties (sponsored posts a month, appearances a year), a satisfaction level, and a morality clause:
// if his public image collapses, the brand can walk away. Happy brands renew with a raise.
import { chance, clamp, pick, randint, weightedPick } from './util.js';
import { meter } from './life.js';
import { SPONSOR } from './config.js';
import { sponsorTerms, sponsorSheet } from './contracts.js';

const eur = (v) => `€${Math.round(v).toLocaleString('en')}`;

export const activeDeals = (state) => (state.player.endorsements ?? []).filter((e) => e.expiryWeek > state.week);

function regionOf(world, country) { return world.byName[country]?.region ?? null; }

// Brands that would want him right now (not one he holds, not a category he's tied to).
export function eligibleBrands(state, world, { ignoreCat = false } = {}) {
  const p = state.player;
  const places = new Set([p.nationality, p.club?.country, regionOf(world, p.nationality), regionOf(world, p.club?.country)].filter(Boolean));
  const held = new Set(activeDeals(state).map((e) => e.cat));
  const names = new Set(activeDeals(state).map((e) => e.brand));
  const cool = p.brandCooldown ?? {};
  const img = p.life ? meter(p, 'image') : 55;
  return (world.brands?.brands ?? []).filter((b) => !names.has(b.name) && (ignoreCat || !held.has(b.cat)) && (cool[b.name] ?? -1) < state.week
    && p.reputation >= b.rep && img >= b.img && p.followers >= b.fol * 0.5
    && (!b.where?.length || b.where.some((w) => places.has(w))));
}

export function brandValue(state, b) {
  const p = state.player;
  const tier = SPONSOR.tier[b.tier] ?? 5000;
  const fame = Math.exp((p.reputation - 40) / 15);
  const reach = 0.7 + Math.log10(p.followers + 10) / 7;
  const agent = p.agent ? 1 + p.agent.quality / 300 : 0.9;
  return Math.round(tier * fame * reach * agent * (0.85 + Math.random() * 0.35) / 100) * 100;
}

// A random brand for scenario text ({BRAND}); falls back to any brand.
export function flavourBrand(state, world) {
  const list = eligibleBrands(state, world, { ignoreCat: true });
  const b = pick(list.length ? list : (world.brands?.brands ?? [{ name: 'a sportswear brand', ind: 'sportswear' }]));
  return { BRAND: b.name, BRANDind: world.brands?.industries?.[b.ind] ?? b.ind };
}

// ── Monthly: approaches, duties, morality clauses, expiry and renewals ──
export function sponsorMonth(state, world, res, push) {
  const p = state.player;
  p.endorsements = p.endorsements ?? [];
  const img = p.life ? meter(p, 'image') : 55;
  res.sponsorNotes = res.sponsorNotes ?? [];
  for (const e of activeDeals(state)) {
    if (!e.duty) continue; // older/simple deals from scenarios have no duties
    // Sponsored posts this month
    const missing = Math.max(0, e.duty.posts - (e.done?.posts ?? 0));
    e.sat = clamp((e.sat ?? 65) + (missing ? -SPONSOR.missPost * missing : SPONSOR.keepPost), 0, 100);
    if (missing) res.sponsorNotes.push(`${e.brand} noticed you missed ${missing} sponsored post${missing > 1 ? 's' : ''} this month.`);
    e.done = { ...(e.done ?? {}), posts: 0 };
    // Appearances: checked once a year of the deal
    if (state.week - (e.yearStart ?? e.since ?? state.week) >= 52) {
      const missEv = Math.max(0, e.duty.events - (e.done.events ?? 0));
      e.sat = clamp(e.sat - missEv * SPONSOR.missEvent, 0, 100);
      if (missEv) res.sponsorNotes.push(`${e.brand} are unhappy: you skipped ${missEv} appearance${missEv > 1 ? 's' : ''} this year.`);
      e.done.events = 0; e.yearStart = state.week;
    }
    // Morality clause
    if (img < SPONSOR.moralityAt && chance(img < 20 ? 0.5 : 0.22)) { endDeal(state, e, res, `${e.brand} invoke the morality clause in your contract and end the deal. "Our values" is mentioned twice in the statement.`); continue; }
    if (e.sat < SPONSOR.terminateAt) { endDeal(state, e, res, `${e.brand} end the partnership early. Their email says "not aligned". It means you didn't do the work.`); continue; }
    // Expiry soon: happy brands renew
    if (e.expiryWeek - state.week <= 5 && !e.renewOffered) {
      e.renewOffered = true;
      if (e.sat >= SPONSOR.renewAt && p.reputation >= (e.minRep ?? 0) * 0.8) push(renewalDecision(state, world, e));
      else res.sponsorNotes.push(`${e.brand} won't renew when the deal ends. ${e.sat < SPONSOR.renewAt ? 'They wanted more effort.' : 'Your profile has dropped.'}`);
    }
  }
  // New approach
  if (state.pending.some((d) => d.kind === 'sponsor')) return;
  const ch = SPONSOR.approachBase + p.reputation / 250 + Math.log10(p.followers + 10) / 60 + (p.agent ? p.agent.quality / 600 : 0) + (img > 70 ? 0.05 : img < 35 ? -0.06 : 0);
  if (!chance(clamp(ch, 0, 0.45))) return;
  const all = eligibleBrands(state, world, { ignoreCat: true });
  if (!all.length) return;
  // Bigger brands come first if you qualify; occasionally a rival brand tries to poach you from a deal you hold.
  const heldCats = new Set(activeDeals(state).map((e) => e.cat));
  const b = weightedPick(all, (x) => (SPONSOR.tier[x.tier] ?? 5000) ** 0.35 * (heldCats.has(x.cat) ? 0.35 : 1));
  push(offerDecision(state, world, b));
}

// His agent pitches him to brands: an approach now, if any brand would have him.
export function forceSponsorApproach(state, world, push) {
  if (state.pending.some((d) => d.kind === 'sponsor')) return false;
  const all = eligibleBrands(state, world, { ignoreCat: false });
  if (!all.length) return false;
  push(offerDecision(state, world, weightedPick(all, (x) => (SPONSOR.tier[x.tier] ?? 5000) ** 0.3)));
  return true;
}

function endDeal(state, e, res, text) {
  e.expiryWeek = state.week;
  res.sponsorNotes.push(text);
  state.player.brandCooldown = { ...(state.player.brandCooldown ?? {}), [e.brand]: state.week + 104 };
}

function dutyText(d) {
  return `${d.posts} sponsored post${d.posts === 1 ? '' : 's'} a month${d.events ? `, ${d.events} appearance${d.events === 1 ? '' : 's'} a year` : ''}`;
}

function offerDecision(state, world, b) {
  const p = state.player;
  const value = brandValue(state, b);
  const years = b.tier === 'local' ? randint(1, 2) : randint(1, 3);
  const ind = world.brands?.industries?.[b.ind] ?? b.ind;
  const conflict = activeDeals(state).find((e) => e.cat === b.cat);
  const buyout = conflict ? Math.round(conflict.annualValue * 0.5 / 100) * 100 : 0;
  const pitch = pick(SPONSOR_PITCH[b.ind] ?? SPONSOR_PITCH.default);
  const terms = sponsorTerms(b, value, years);
  const choices = [
    { id: 'sign', label: conflict ? `Switch from ${conflict.brand} to ${b.name}` : `Sign with ${b.name}`, description: `€${value.toLocaleString()} a year for ${years} year${years > 1 ? 's' : ''}.${conflict ? ` Ending ${conflict.brand} early costs about €${buyout.toLocaleString()}.` : ''}`, risk: conflict ? 'medium' : 'low', consequence: `Duties: ${dutyText(b.duty)}. Skip them and the brand cools.`, aspects: ['money', 'image', 'social'] },
    { id: 'negotiate', label: p.agent ? `Let ${p.agent.name} negotiate` : 'Negotiate yourself', description: 'Push for a better number.', risk: 'medium', consequence: 'More money — or they walk away.', aspects: ['money'] },
    { id: 'decline', label: 'Decline', description: b.tier === 'luxury' ? 'Not your style.' : 'Not the right fit.', risk: 'low', consequence: `${b.name} won't ask again for a while.`, aspects: [] },
  ];
  return {
    kind: 'sponsor', type: 'sponsor', arena: 'lifestyle', ui: 'letter', cat: 'money',
    headline: `${b.name} Want ${p.jerseyName}`,
    scene: `${pitch.replace(/\{BRAND\}/g, b.name).replace(/\{J\}/g, p.jerseyName)} ${b.name} is a ${b.tier === 'local' ? 'local' : b.tier === 'regional' ? 'regional' : b.tier === 'luxury' ? 'luxury' : 'global'} ${ind} brand.`,
    prompt: `${b.name} offer €${value.toLocaleString()} a year (${years} yr). Duties: ${dutyText(b.duty)}.`,
    data: { brand: b.name, ind: b.ind, cat: b.cat, tier: b.tier, value, years, duty: b.duty, minRep: b.rep, conflict: conflict?.brand ?? null, buyout, terms },
    sheet: sponsorSheet({ value, years, duty: b.duty, terms }, eur),
    choices,
  };
}

function renewalDecision(state, world, e) {
  const p = state.player;
  const b = (world.brands?.brands ?? []).find((x) => x.name === e.brand) ?? { tier: 'global', duty: e.duty, rep: 0 };
  const value = Math.round(Math.max(e.annualValue * (1 + e.sat / 300), brandValue(state, b)) / 100) * 100;
  const years = randint(1, 3);
  const terms = e.terms ? { ...e.terms, years } : sponsorTerms(b, value, years);
  return {
    kind: 'sponsor', type: 'sponsor', arena: 'lifestyle', ui: 'letter', cat: 'money', renewal: true,
    headline: `${e.brand} Want to Extend`,
    scene: `${e.brand}'s marketing team are happy: your posts landed, you turned up when it mattered. They want to keep you.`,
    prompt: `${e.brand} offer a new deal: €${value.toLocaleString()} a year (was €${e.annualValue.toLocaleString()}).`,
    data: { brand: e.brand, ind: e.ind, cat: e.cat, tier: e.tier, value, years, duty: e.duty, minRep: e.minRep, renewal: true, terms },
    sheet: sponsorSheet({ value, years, duty: e.duty, terms }, eur),
    choices: [
      { id: 'sign', label: 'Renew', description: `€${value.toLocaleString()} a year.`, risk: 'low', consequence: 'Same duties, more money.', aspects: ['money'] },
      { id: 'negotiate', label: 'Ask for more', description: 'They want you. Use it.', risk: 'medium', consequence: 'A raise — or a polite goodbye.', aspects: ['money'] },
      { id: 'decline', label: 'Let it end', description: 'Time for something new.', risk: 'low', consequence: 'Frees the category for another brand.', aspects: [] },
    ],
  };
}

// The player's answer. Returns the outcome text; fx(e) applies effects with ripples.
export function resolveSponsor(state, world, d, choiceId, res, fx) {
  const p = state.player;
  const J = p.jerseyName;
  const sign = (value) => {
    if (d.conflict) {
      const old = activeDeals(state).find((e) => e.brand === d.conflict);
      if (old) { old.expiryWeek = state.week; p.wealthEUR -= d.buyout; }
    }
    if (d.renewal) p.endorsements = p.endorsements.filter((e) => e.brand !== d.brand || e.expiryWeek <= state.week);
    p.endorsements.push({ brand: d.brand, ind: d.ind, cat: d.cat, tier: d.tier, type: d.tier, annualValue: value, years: d.years, expiryWeek: state.week + 52 * d.years, since: state.week, yearStart: state.week, duty: d.duty, done: { posts: 0, events: 0 }, sat: 65, minRep: d.minRep, terms: d.terms ?? null });
    const big = d.tier === 'global' || d.tier === 'luxury';
    fx({ followers: Math.round(p.followers * (big ? 0.03 : 0.01)) + 500, image: big ? 2 : 1, board: big ? 2 : 0, morale: 3 });
  };
  if (choiceId === 'sign') { sign(d.value); return d.renewal ? `${J} renews with ${d.brand}. The new numbers arrive in a PDF with a lot of exclamation marks.` : `${J} signs with ${d.brand}.${d.conflict ? ` Leaving ${d.conflict} costs €${d.buyout.toLocaleString()}, and their reply is one word long.` : ''} The first photo shoot is booked before the ink is dry.`; }
  if (choiceId === 'negotiate') {
    const q = p.agent?.quality ?? 25;
    if (chance(0.35 + q / 180)) { const v = Math.round(d.value * (1.15 + q / 400) / 100) * 100; sign(v); return `${p.agent ? p.agent.name : J} plays it perfectly. ${d.brand} go up to €${v.toLocaleString()} a year.`; }
    if (chance(0.5)) { sign(d.value); return `${d.brand} won't move. ${J} signs the original offer anyway.`; }
    p.brandCooldown = { ...(p.brandCooldown ?? {}), [d.brand]: state.week + 52 };
    fx({ stress: 2 });
    return `${d.brand} thank ${J} for his time and sign someone else.`;
  }
  p.brandCooldown = { ...(p.brandCooldown ?? {}), [d.brand]: state.week + 40 };
  return d.renewal ? `${J} lets the ${d.brand} deal run out.` : `${J} turns down ${d.brand}.`;
}

// Duties done through free time (appearances) or posts (social.js).
export function sponsorEventOptions(state) {
  return activeDeals(state).filter((e) => e.duty && (e.done?.events ?? 0) < e.duty.events).map((e) => ({
    id: `sponsor:${e.brand}`, icon: 'briefcase', label: `${e.brand} appearance`, desc: `Contract duty (${e.done?.events ?? 0}/${e.duty.events} this year). Pays a fee, costs energy.`, sponsor: true,
  }));
}

export function doSponsorEvent(state, brand) {
  const e = activeDeals(state).find((x) => x.brand === brand);
  if (!e) return null;
  e.done = { ...(e.done ?? {}), events: (e.done?.events ?? 0) + 1 };
  e.sat = clamp((e.sat ?? 65) + SPONSOR.eventBoost, 0, 100);
  const fee = Math.round(e.annualValue * 0.03 / 10) * 10;
  return { fee, text: pick(SPONSOR_EVENT).replace(/\{BRAND\}/g, brand) };
}

const SPONSOR_PITCH = {
  boots: ['{BRAND} want {J} in their next boot campaign: a colourway with his initials, a launch video, a billboard.', 'A {BRAND} representative watched {J} for three months. They want him in their boots, and only their boots.'],
  sportswear: ['{BRAND} are building a new training range and want {J} as its face.', '{BRAND} have sent a box of kit and a contract. The kit fits better than the contract reads.'],
  tech: ['{BRAND} want {J} to launch their new phone: a TV advert, a camera test, and a lot of slow-motion.', '{BRAND} love his social numbers. They want him unboxing their flagship on launch day.'],
  audio: ['{BRAND} want the shot of {J} walking off the team bus wearing their headphones.', '{BRAND} propose a pre-match playlist series, headphones on, eyes closed.'],
  gaming: ['{BRAND} want {J} in their next campaign and at a launch event with famous streamers.', '{BRAND} would like him to play their game live with fans once a month.'],
  drinks: ['{BRAND} want {J} in a summer TV advert: sweat, sunshine, a can held at exactly the right angle.', '{BRAND} propose a campaign around his matchday routine.'],
  food: ['{BRAND} want a funny TV advert. The script involves {J} sprinting to catch a delivery.', '{BRAND} think {J} has "national appeal". They want him on the packaging.'],
  coffee: ['{BRAND} want {J} as the face of their morning campaign: early training, first coffee.'],
  fintech: ['{BRAND} are launching a feature for young people and want {J} to explain it in a funny video.'],
  banking: ['{BRAND} want {J} for a campaign about saving and building a future.'],
  telecom: ['{BRAND} want {J} for their national campaign: "Connected to the people who matter."'],
  ecommerce: ['{BRAND} want {J} for their big sale-day campaign, including a live-stream with fans.'],
  ride: ['{BRAND} want {J} in a video riding to training with their drivers, chatting with fans.'],
  travel: ['{BRAND} want {J} to share his off-season trips with their app.'],
  hotel: ['{BRAND} want {J} as an ambassador: off-season stays, a photo series, a loyalty campaign.'],
  airline: ['{BRAND} want {J} as an ambassador: a safety-video cameo, a premium-cabin photo shoot, and a lot of handshakes.'],
  auto: ['{BRAND} want {J} as an ambassador, with a car of his own for the length of the deal.'],
  moto: ['{BRAND} want {J} riding their new model in a TV advert, helmet on, visor up.'],
  fashion: ['{BRAND} want {J} in their next season\'s campaign. The stylist has opinions about his posture.'],
  luxury: ['{BRAND} have invited {J} to Paris. They want him front row, then in their next global campaign.'],
  watch: ['{BRAND} want {J} as a friend of the brand: a watch on his wrist at every press conference.'],
  grooming: ['{BRAND} want {J} in a campaign about confidence. The make-up artist will be very busy.'],
  nutrition: ['{BRAND} want {J} to share his post-training shakes with his followers.'],
  fitness: ['{BRAND} want {J} to share his recovery data and routines with fans.'],
  streaming: ['{BRAND} want {J} in a campaign trailer and an exclusive behind-the-scenes series.'],
  insurance: ['{BRAND} want {J} for a campaign about protecting the people you love.'],
  eyewear: ['{BRAND} want {J} in their summer collection shoot.'],
  education: ['{BRAND} want {J} to show fans he is learning something new, one lesson at a time.'],
  logistics: ['{BRAND} want {J} in a global campaign about "delivering under pressure".'],
  tyres: ['{BRAND} want {J} for a calendar shoot and a racing-day appearance.'],
  default: ['{BRAND} want {J} as an ambassador.'],
};

const SPONSOR_EVENT = [
  'A morning at a {BRAND} store: three hundred fans, two hundred selfies, one marker that runs out halfway.',
  'A {BRAND} shoot in a studio so cold he can see his breath. Forty outfits, one smile, repeated until it hurts.',
  'A {BRAND} launch event: a short speech, a cake shaped like a football, and a CEO who wants to talk tactics.',
  'He records a {BRAND} advert in eleven takes. The director says take four was best. They use take nine.',
  'A {BRAND} meet-and-greet in a shopping mall. A grandmother asks him to sign her walking stick. He does.',
];
