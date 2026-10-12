// Assets: what he owns. Cars, watches, jewellery, fashion, tech, property, yachts, jets, art, investments and
// businesses, all real brands (data/text/assets.json). Things change value every month (cars lose it, good
// watches and property can gain it, shares and crypto swing), cost upkeep, and some pay an income.
// Buying is never free of consequences: a supercar after a defeat lands badly, a house for your parents doesn't.
import { chance, clamp, gauss, pick, uid } from './util.js';
import { meter } from './life.js';

const DEFAULT_CAT = { label: 'Other', icon: 'star', growth: 0, vol: 0.02, upkeep: 0, sell: 0.8 };
export const catOf = (world, c) => world.assets?.categories?.[c] ?? DEFAULT_CAT;
export const itemById = (world, id) => (world.assets?.items ?? []).find((x) => x.id === id) ?? null;
export const ownedAssets = (state) => state.player.assets ?? [];

export function netWorth(state) {
  return Math.round(state.player.wealthEUR + ownedAssets(state).reduce((a, x) => a + x.value, 0));
}

// The car he actually drives (scenario text uses it for {CAR}).
export function ownedCar(state) {
  const cars = ownedAssets(state).filter((x) => x.cat === 'car' || x.cat === 'supercar');
  return cars.sort((a, b) => b.cost - a.cost)[0] ?? null;
}

export function shopItems(state, world, cat = null) {
  const p = state.player;
  const items = (world.assets?.items ?? []).filter((x) => !cat || x.cat === cat);
  return items.map((x) => {
    const owned = ownedAssets(state).filter((a) => a.id === x.id).length;
    const minBuy = x.invest ? 1000 : x.price;
    return { ...x, owned, affordable: p.wealthEUR >= minBuy, locked: (x.minRep ?? 0) > p.reputation };
  });
}

// Recipients a gift can go to right now.
export function giftTargets(state) {
  const p = state.player, c = p.circle ?? {};
  const t = [['self', 'Keep it']];
  if (p.partner.status !== 'none') t.push(['partner', p.partner.name.split(' ')[0]]);
  t.push(['mum', c.mum ?? 'Mum'], ['dad', c.dad ?? 'Dad'], ['sibling', c.sibling?.name ?? 'Sibling'], ['friend', c.bestFriend?.name?.split(' ')[0] ?? 'Best friend']);
  if (p.crush) t.push(['crush', p.crush.name.split(' ')[0]]);
  return t;
}

// Buy something. `amount` is for investments; `to` = who it's for (gifts). Returns { fx, text, headline } or an error.
export function buyAsset(state, world, id, { amount = null, to = 'self' } = {}) {
  const p = state.player;
  const x = itemById(world, id);
  if (!x) return { error: 'Not found.' };
  if ((x.minRep ?? 0) > p.reputation) return { error: `${x.brand} only sells this to famous clients.` };
  const cost = x.invest ? Math.round(amount ?? 1000) : x.price;
  if (cost > p.wealthEUR) return { error: 'Not enough savings.' };
  const cat = catOf(world, x.cat);
  const lastLoss = p.lastMatch?.result === 'L';
  const share = cost / Math.max(1, p.wealthEUR);
  const fx = { wealth: -cost };
  const J = p.jerseyName;
  let text;
  p.assets = p.assets ?? [];
  if (to !== 'self') {
    // A gift: it's theirs now.
    const k = clamp(Math.log10(Math.max(cost, 100)) - 2, 0.5, 4.5); // €1K → 1, €100K → 3
    if (to === 'partner') { fx.love = Math.round(3 + k * 2.2); if (p.partner.style === 'public') fx.followers = Math.round(300 + p.followers * 0.004); }
    else if (to === 'mum' || to === 'dad') { fx.family = Math.round(3 + k * 2.4); if (x.forParents) fx.family += 8; }
    else if (to === 'sibling') { fx.family = Math.round(2 + k * 1.6); }
    else if (to === 'friend') { fx.friends = Math.round(3 + k * 2); }
    else if (to === 'crush') { fx.crushHeat = Math.round(6 + k * 4); }
    fx.morale = 2;
    if (x.forParents && (to === 'mum' || to === 'dad')) fx.flag = 'parents_house';
    const who = giftTargets(state).find((t) => t[0] === to)?.[1] ?? 'them';
    text = pick(GIFT_LINES).replace(/\{WHO\}/g, who).replace(/\{ITEM\}/g, `${x.brand} ${x.name}`).replace(/\{J\}/g, J);
    p.giftLog = [...(p.giftLog ?? []), { week: state.week, to, item: `${x.brand} ${x.name}`, cost }].slice(-30);
    return { fx, text, headline: `A gift for ${who}`, item: x, cost, gift: true };
  }
  const owned = { uid: uid(), id: x.id, name: x.name, brand: x.brand, cat: x.cat, bought: state.week, cost, value: Math.round(cost * (x.invest ? 1 : 0.97)), invest: !!x.invest };
  p.assets.push(owned);
  // How it lands
  const flex = x.flex ?? 0;
  if (flex > 0) {
    fx.followers = Math.round((400 + p.followers * 0.003) * flex);
    fx.friends = 1;
    if (lastLoss && flex >= 2) { fx.fans = -3; fx.image = -2; }
    else if (flex >= 3 && meter(p, 'image') < 40) fx.image = -1;
  }
  if (share > 0.6 && !x.invest && x.cat !== 'property') { fx.family = (fx.family ?? 0) - 2; fx.stress = 2; }
  if (x.cat === 'property' && x.home) { fx.morale = 4; fx.stress = -3; }
  if (x.invest) fx.stress = cost > p.wealthEUR * 0.5 ? 2 : 0;
  if (x.flag) fx.flag = x.flag;
  else fx.flag = `owns_${x.cat}`;
  text = pick(BUY_LINES[x.cat] ?? BUY_LINES.default).replace(/\{ITEM\}/g, `${x.brand} ${x.name}`).replace(/\{J\}/g, J).replace(/\{PRICE\}/g, `€${Math.round(cost).toLocaleString('en')}`);
  if (lastLoss && flex >= 2) text += ' The timing, two days after a defeat, does not go unnoticed.';
  return { fx, text, headline: x.invest ? `Invested in ${x.brand}` : `New: ${x.brand} ${x.name}`, item: x, cost };
}

export function sellAsset(state, world, assetUid) {
  const p = state.player;
  const a = ownedAssets(state).find((x) => x.uid === assetUid);
  if (!a) return { error: 'Not found.' };
  const rate = a.invest ? 0.99 : catOf(world, a.cat).sell ?? 0.8;
  const cash = Math.round(a.value * rate);
  p.assets = p.assets.filter((x) => x !== a);
  const gain = cash - a.cost;
  const fx = { wealth: cash };
  if (!a.invest && (itemById(world, a.id)?.flex ?? 0) >= 2) fx.followers = 0;
  const text = `${p.jerseyName} sells the ${a.brand} ${a.name} for €${cash.toLocaleString('en')} (${gain >= 0 ? 'a profit of' : 'a loss of'} €${Math.abs(gain).toLocaleString('en')}).`;
  return { fx, text, headline: `Sold: ${a.brand} ${a.name}` };
}

// Once a month: values move, upkeep is paid, rent and business income come in, and the odd business fails.
export function assetsMonth(state, world, res) {
  const p = state.player;
  let upkeep = 0, income = 0, change = 0;
  const notes = [];
  for (const a of [...ownedAssets(state)]) {
    const x = itemById(world, a.id) ?? {};
    const cat = catOf(world, a.cat);
    const g = x.growth ?? cat.growth ?? 0, v = x.vol ?? cat.vol ?? 0.02;
    const before = a.value;
    a.value = Math.max(0, Math.round(a.value * (1 + g / 12 + (v / Math.sqrt(12)) * gauss())));
    change += a.value - before;
    upkeep += Math.round((a.cost * (x.upkeep ?? cat.upkeep ?? 0)));
    const y = x.yield ?? cat.yield ?? 0;
    if (y) income += Math.round(a.value * y * (0.7 + Math.random() * 0.6));
    if (a.cat === 'business' && chance(x.fail ?? 0.004)) {
      notes.push(`${a.brand === 'Own business' ? 'Your' : a.brand} ${a.name} closes down. What's left is worth very little.`);
      a.value = Math.round(a.value * 0.1);
    }
  }
  if (!ownedAssets(state).length) return null;
  return { upkeep, income, change: Math.round(change), notes };
}

const GIFT_LINES = [
  '{WHO} opens the box and goes completely silent. Then the hug. The {ITEM} is a hit.',
  '{J} hands {WHO} a small bag. Inside: {ITEM}. "You didn\'t have to," {WHO} says, already putting it on.',
  'A surprise delivery for {WHO}: {ITEM}, with a handwritten card that took {J} longer than the shopping.',
  '{WHO} pretends to be angry about how much it cost. The {ITEM} is worn the very next day.',
];
const BUY_LINES = {
  car: ['The {ITEM} is delivered on a Tuesday. {J} drives it round the block four times before he dares park it.', '{J} picks up the keys to a {ITEM}. The salesman asks for a selfie. The neighbours ask for a ride.', 'A {ITEM} in the driveway. {PRICE} well spent, or so he tells himself on the first drive.'],
  supercar: ['The {ITEM} arrives on a flatbed, under a cover, like a secret. It isn\'t one for long: the photos are online by lunch.', '{J} signs for a {ITEM}. It is loud, it is low, it does not fit through the training-ground gate without scraping.'],
  moto: ['A {ITEM} in the garage. The club\'s insurance people would like a word.', '{J} buys a {ITEM}. He promises himself he\'ll only ride it in the off-season.'],
  watch: ['The {ITEM} sits on his wrist like it was always meant to. He checks the time far more often than he needs to.', '{J} walks out of the boutique with a {ITEM}. The box is nicer than his first flat.'],
  jewellery: ['{J} buys a {ITEM}. It catches the light in every photo.'],
  fashion: ['A {ITEM} for the tunnel walk. The club photographer will be pleased.', '{J} adds a {ITEM} to the wardrobe. The fashion pages notice before his teammates do.'],
  tech: ['A {ITEM}, unboxed on camera. Ten thousand people watch him peel off the plastic.', '{J} gets a {ITEM}. It\'s for "recovery and focus". It is mostly for fun.'],
  property: ['The keys to a {ITEM}. {J} walks through the empty rooms and can\'t stop smiling.', '{J} signs for a {ITEM}. {PRICE}. The notary calls it "a sensible decision". It doesn\'t feel sensible. It feels enormous.'],
  yacht: ['A {ITEM} with his name painted on the back. The marina has never seen him before; it will now.'],
  jet: ['A {ITEM}. Owning a plane is a phrase he never expected to say out loud.'],
  art: ['A {ITEM} goes up on his living-room wall. He looks at it every morning and still isn\'t sure what it means.'],
  invest: ['{J} puts {PRICE} into {ITEM}. His adviser nods. His dad asks if it\'s a scam. It isn\'t.', '{PRICE} into {ITEM}. Not glamorous. Possibly the smartest thing he does all year.'],
  business: ['{J} becomes the owner of a {ITEM}. Opening day: a ribbon, a speech, his mum in the front row.', 'A {ITEM}, with his name above the door. Now it has to make money.'],
  default: ['{J} buys a {ITEM}.'],
};
