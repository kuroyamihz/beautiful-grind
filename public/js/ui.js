// Rendering: turns state + story into HTML. Every section can fold away (its open/closed state is remembered),
// free time, posts, purchases and people actions report back as small pop-ups instead of scrolling the page.
import { escapeHtml as e, compact, ordinal } from './util.js';
import { EUR_IDR, POSITIONS, ATTRS } from './config.js';
import { overall, statLabel, wealthLevel, scoutEstimate, attrsOf, careerLevel, LEVELS } from './player.js';
import { dateLabel, shortDate, yearOf } from './time.js';
import { standings, nextFixtures } from './season.js';
import { ageNow, currentSeason, legacy, transferOutlook } from './engine.js';
import { activeDeals } from './sponsors.js';
import { lifeLegacy, epilogue } from './epilogue.js';
import { METERS, meter, meterWord, standingCap } from './life.js';
import { icon, ASPECT_ICON, ASPECT_LABEL, ARENA_STYLE } from './icons.js';
import { contractSheet, sponsorSheet, ROLE_PROMISE } from './contracts.js';
import { netWorth, ownedAssets, shopItems, catOf, giftTargets } from './assets.js';
import { PLATFORMS } from './media.js';
import { digest, monthStory, monthsAvailable, monthLabel, monthKeyOf } from './journal.js';
import { personWord } from './people.js';
import { avatarSvg, AVATAR_OPTIONS } from './avatar.js';

const $ = (id) => document.getElementById(id);

export function money(state, eur, opts = {}) {
  const sign = eur < 0 ? '-' : '';
  const a = Math.abs(eur);
  const euro = `${sign}€${a >= 1000 ? compact(a) : Math.round(a)}`;
  if (state.player.nationality !== 'Indonesia' || opts.eurOnly) return euro;
  return `${sign}Rp ${compact(a * EUR_IDR)} <span class="muted">(${euro})</span>`;
}
const eur = (v) => `€${Math.round(v).toLocaleString('en')}`;

// ── Collapsible sections ──────────────────────────────────────────
const FOLD_KEY = 'beautifulGrind.folds';
let folds = {};
try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch { folds = {}; }
export function fold(id, title, body, { open = true, cls = '', right = '' } = {}) {
  const isOpen = folds[id] ?? open;
  return `<details class="fold ${cls}" data-fold="${e(id)}" ${isOpen ? 'open' : ''}><summary><span class="fold-title">${title}</span>${right ? `<span class="fold-right">${right}</span>` : ''}<span class="fold-chev">${icon('chevron')}</span></summary><div class="fold-body">${body}</div></details>`;
}
export function initFolds() {
  document.addEventListener('toggle', (ev) => {
    const d = ev.target;
    if (!d.matches?.('details[data-fold]')) return;
    folds[d.dataset.fold] = d.open;
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch {}
  }, true);
}

function bar(value, max = 100, color = 'var(--info)', marker = null) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar"><i style="width:${w}%;background:${color}"></i>${marker !== null ? `<s style="left:${marker}%"></s>` : ''}</div>`;
}
const statColor = (v) => (v >= 80 ? 'var(--accent)' : v >= 65 ? 'var(--good)' : v >= 50 ? 'var(--info)' : 'var(--warn)');
const meterColor = (k, v) => {
  const good = METERS[k]?.inverse ? 100 - v : v;
  return good >= 65 ? 'var(--good)' : good >= 40 ? 'var(--info)' : good >= 25 ? 'var(--warn)' : 'var(--bad)';
};
const roleChip = { starter: 'chip-good', rotation: 'chip-accent', bench: 'chip-warn', outcast: 'chip-bad' };
const ratingClass = (r) => (r >= 8 ? 'r-great' : r >= 7.1 ? 'r-good' : r >= 6.5 ? 'r-ok' : r >= 5.6 ? 'r-mid' : 'r-bad');

// ── "What changed" chips ──
const CHANGE_ORDER = ['trust', 'board', 'dressing', 'fans', 'press', 'image', 'family', 'love', 'friends', 'morale', 'stress', 'followers', 'reputation', 'wealthEUR', 'pfm', 'form'];
export function changeChips(state, changes = {}, extra = {}) {
  const out = [];
  for (const k of CHANGE_ORDER) {
    const v = changes[k];
    if (!v) continue;
    const good = k === 'stress' ? v < 0 : v > 0;
    const val = k === 'wealthEUR' ? money(state, v, { eurOnly: true }).replace(/^(?!-)/, '+') : k === 'followers' ? `${v > 0 ? '+' : ''}${compact(v)}` : `${v > 0 ? '+' : ''}${v}`;
    out.push(`<span class="dchip ${good ? 'up' : 'down'}" title="${e(ASPECT_LABEL[k] ?? k)}">${icon(ASPECT_ICON[k] ?? 'spark')}<span>${e(ASPECT_LABEL[k] ?? k)}</span><b>${val}</b></span>`);
  }
  for (const [k, v] of Object.entries(extra ?? {})) if (v) out.push(`<span class="dchip ${v > 0 ? 'up' : 'down'}">${icon('spark')}<span>${e(statLabel(k))}</span><b>${v > 0 ? '+' : ''}${v}</b></span>`);
  return out.length ? `<div class="dchips">${out.join('')}</div>` : '';
}
function ripplesHtml(state, ripples = []) {
  if (!ripples.length) return '';
  return `<ul class="ripples">${ripples.map((r) => `<li>${icon('ripple')}<div><span>${e(r.text)}</span>${changeChips(state, r.changes)}</div></li>`).join('')}</ul>`;
}

// ═══════════════════════════ POP-UP NOTIFICATIONS ═══════════════════════════
// Results of things that don't move the clock appear for 10 seconds in the corner.
export function toast(state, a, { ms = 10000 } = {}) {
  const box = $('toasts');
  if (!box || !a) return;
  const el = document.createElement('div');
  el.className = `toast toast-${e(a.kind ?? 'free')}`;
  let body = '';
  if (a.kind === 'post' && a.post) {
    const x = a.post;
    body = `<p class="toast-cap">“${e(x.caption)}”</p><div class="toast-meta">${icon('heart')} ${compact(x.likes)} · +${compact(Math.max(0, x.gained))} followers${x.viral ? ' · <b class="viral">VIRAL</b>' : ''} · <span class="${x.positive ? 'up' : 'down'}">${x.positive ? 'mostly loved' : 'mostly negative'}</span></div>${x.comments[0] ? `<div class="toast-comment"><b>${e(x.comments[0].handle)}</b> ${e(x.comments[0].text)}</div>` : ''}`;
  } else body = `${a.label ? `<div class="toast-label">${e(a.label)}</div>` : ''}${a.text ? `<p>${e(a.text)}</p>` : ''}`;
  const rip = (a.ripples ?? []).slice(0, 2).map((r) => `<li>${icon('ripple')}${e(r.text)}</li>`).join('');
  el.innerHTML = `<div class="toast-head">${icon(a.icon ?? 'clock')}<b>${e(a.headline ?? '')}</b><span class="toast-tag">${icon('clock')} no time passed</span><button class="toast-x" aria-label="Close">${icon('close')}</button></div>
    ${body}${changeChips(state, a.changes, a.stats)}${rip ? `<ul class="toast-rip">${rip}</ul>` : ''}${(a.milestones ?? []).length ? `<div class="toast-label">${icon('star')} ${a.milestones.map(e).join(', ')}</div>` : ''}
    <div class="toast-bar"><i style="animation-duration:${ms}ms"></i></div>`;
  let timer = null, left = ms, started = Date.now();
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  const start = () => { started = Date.now(); timer = setTimeout(close, left); el.classList.remove('paused'); };
  el.addEventListener('mouseenter', () => { clearTimeout(timer); left -= Date.now() - started; el.classList.add('paused'); });
  el.addEventListener('mouseleave', start);
  el.querySelector('.toast-x').addEventListener('click', close);
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  start();
}
export function toastError(msg) {
  const box = $('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast toast-error';
  el.innerHTML = `<div class="toast-head">${icon('alert')}<b>${e(msg)}</b></div>`;
  box.prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ═══════════════════════════ LEFT: THE PLAYER ═══════════════════════════
function scoutHtml(state) {
  const s = scoutEstimate(state.player, ageNow(state));
  const stars = '★'.repeat(Math.floor(s.stars)) + (s.stars % 1 ? '½' : '');
  return `<div class="scout" title="Scouts' estimate of your ceiling. It narrows as you get older. Disciplined hard work with a clear head can raise it; chaos, burnout and partying lower it.">
    <span>${icon('target')} Potential</span><b>${s.lo}–${s.hi}</b><span class="stars">${stars}</span><em>${e(s.label)}</em></div>`;
}

function contractHtml(state) {
  const p = state.player, c = p.club?.contract;
  if (!p.club) return '<p class="hint">No club, no contract. Offers come to free agents quickly.</p>';
  const rows = contractSheet(c ?? { wage: p.club.wageWeekly, years: 1, kind: 'permanent', imageRights: 100 }, eur).filter(([k]) => k !== 'Length');
  return `<dl class="kv kv-contract"><dt>Club</dt><dd>${e(p.club.name)}${p.club.loan ? ' (loan)' : ''}</dd><dt>Runs until</dt><dd>${shortDate(p.club.contractEndWeek)}</dd>${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}
    <dt>Bonuses this season</dt><dd>${eur(p.season.bonuses ?? 0)}</dd></dl>
    ${c?.promisedRole && ['key', 'rotation'].includes(c.promisedRole) && ['bench', 'outcast'].includes(p.squadRole) ? `<p class="hint warn">${icon('alert')} The club promised a ${ROLE_PROMISE[c.promisedRole].toLowerCase()} role. Right now that promise is broken.</p>` : ''}`;
}

function sponsorsHtml(state) {
  const deals = activeDeals(state);
  if (!deals.length) return `<p class="hint">${icon('briefcase')} No sponsors yet. Fame, followers and a clean image bring brands; an agent helps.</p>`;
  return `<ul class="deals">${deals.map((d) => `<li>
    <div class="deal-top"><b>${e(d.brand)}</b><span>${money(state, d.annualValue, { eurOnly: true })}/yr · to ${shortDate(d.expiryWeek)}</span></div>
    ${d.duty ? `<div class="deal-duty">Posts ${d.done?.posts ?? 0}/${d.duty.posts} this month · Appearances ${d.done?.events ?? 0}/${d.duty.events} this year · happiness ${d.sat ?? 65}</div>${bar(d.sat ?? 65, 100, (d.sat ?? 65) >= 55 ? 'var(--good)' : (d.sat ?? 65) >= 30 ? 'var(--warn)' : 'var(--bad)')}` : ''}
    ${d.terms ? fold(`deal-${d.brand}`, 'Contract details', `<dl class="kv kv-contract">${sponsorSheet({ ...d, years: d.years }, eur).map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>`, { open: false, cls: 'fold-mini' }) : ''}
  </li>`).join('')}</ul>`;
}

export function renderPlayer(state, world, { onAvatar } = {}) {
  const p = state.player;
  const changes = state.last?.statChanges ?? {};
  const club = p.club;
  const nt = p.national;
  const ovr = overall(p);
  const lvl = careerLevel(p, ageNow(state));
  const attrs = attrsOf(p.position);
  $('col-player').innerHTML = `
    <section class="card player-card">
      <div class="pc-head">
        <button class="pc-avatar" id="btn-avatar" title="Edit your look">${avatarSvg(p.avatar, { size: 58 })}<span class="pc-num">${p.number}</span></button>
        <div class="pc-id">
          <div class="pc-name">${e(p.name)}${p.nickname ? ` <span class="muted">"${e(p.nickname)}"</span>` : ''}</div>
          <div class="pc-sub">${p.flag} ${e(p.nationality)} · ${POSITIONS[p.position].name}</div>
          <div class="pc-sub">${club ? `${e(club.name)}${club.loan ? ' <span class="chip chip-accent">loan</span>' : ''}` : '<b>Free agent</b>'} · Age ${ageNow(state)}</div>
        </div>
        <div class="ovr-ring" style="--p:${ovr}"><b>${ovr}</b><span>OVR</span></div>
      </div>
      <div class="chips">
        <span class="chip ${roleChip[p.squadRole]}">${e(p.squadRole)}</span>
        <span class="chip" title="Career level: how established you are. Fame alone isn't enough: seniority comes with age and games.">${icon('star')} ${LEVELS[lvl]}</span>
        <span class="chip">${icon('smile')} ${e(p.mood)}</span>
        ${state.squad?.captainIsMe ? '<span class="chip chip-accent">Captain</span>' : ''}
        ${p.injury ? `<span class="chip chip-bad">${icon('bandage')} ${p.injury.weeksLeft}w out</span>` : ''}
        ${p.suspension ? '<span class="chip chip-bad">Suspended</span>' : ''}
        ${p.transferListed ? '<span class="chip chip-warn">Transfer listed</span>' : ''}
      </div>
      ${scoutHtml(state)}
      ${fold('attributes', `${icon('spark')} ${POSITIONS[p.position].name} attributes`, attrs.map((k) => `<div class="stat"><span>${icon(ATTRS[k]?.icon ?? 'spark')}${statLabel(k)}</span>${bar(p.stats[k], 99, statColor(p.stats[k]))}<span class="v ${changes[k] > 0 ? 'up' : ''}">${p.stats[k]}${changes[k] > 0 ? '▲' : changes[k] < 0 ? '▼' : ''}</span></div>`).join('') + `<p class="hint small">Only what matters for a ${POSITIONS[p.position].name.toLowerCase()}. Heavier weight first.</p>`)}
      ${fold('condition', `${icon('pulse')} Condition`, `
        <div class="stat" title="Performance Fitness Meter. The red line is your body's ceiling: it falls with age from 33."><span>${icon('pulse')}Fitness</span>${bar(p.pfm, 100, p.pfm < 50 ? 'var(--bad)' : 'var(--good)', p.pfmCeiling < 100 ? p.pfmCeiling : null)}<span class="v">${Math.round(p.pfm)}</span></div>
        <div class="stat" title="Average of recent match ratings"><span>${icon('chart')}Form</span>${bar(p.form - 4, 6, p.form >= 7 ? 'var(--good)' : p.form < 6.2 ? 'var(--bad)' : 'var(--info)')}<span class="v">${p.form.toFixed(1)}</span></div>
        ${p.life ? ['morale', 'stress'].map((k) => `<div class="stat" title="${e(METERS[k].tip)}"><span>${icon(METERS[k].icon)}${METERS[k].label}</span>${bar(meter(p, k), 100, meterColor(k, meter(p, k)))}<span class="v">${meter(p, k)}</span></div>`).join('') : ''}
        <div class="stat" title="Global recognition"><span>${icon('star')}Fame</span>${bar(p.reputation, 100, 'var(--accent)')}<span class="v">${Math.round(p.reputation)}</span></div>`)}
    </section>
    <section class="card">
      ${fold('money', `${icon('wallet')} Money & market`, `<dl class="kv">
        <dt>Savings</dt><dd>${money(state, p.wealthEUR)}</dd>
        <dt>Net worth</dt><dd>${money(state, netWorth(state), { eurOnly: true })}</dd>
        <dt>Status</dt><dd>${wealthLevel(p.wealthEUR)}</dd>
        <dt>Wage</dt><dd>${club ? `${money(state, club.wageWeekly, { eurOnly: true })}/wk` : '—'}</dd>
        <dt>Market value</dt><dd>€${compact(p.marketValue)}</dd>
        <dt>Followers</dt><dd>${compact(p.followers)}</dd>
        <dt>Lifestyle</dt><dd>${p.lifestyle <= 0.8 ? 'Frugal' : p.lifestyle <= 1.2 ? 'Normal' : p.lifestyle <= 1.8 ? 'Comfortable' : 'Lavish'}</dd>
      </dl>`)}
      ${fold('contract', `${icon('letter')} Club contract`, contractHtml(state), { open: false })}
      ${fold('sponsors', `${icon('briefcase')} Sponsors <span class="count">${activeDeals(state).length}</span>`, sponsorsHtml(state), { open: false })}
      ${fold('national', `${icon('flag')} National team`, `<dl class="kv">
        <dt>Status</dt><dd>${nt.status === 'none' ? 'Not selected' : nt.status}${nt.team !== 'none' ? ` · ${nt.team}` : ''}</dd>
        <dt>Senior caps</dt><dd>${nt.caps} (${nt.goals} goals)</dd>
        <dt>Youth caps</dt><dd>${nt.youthCaps}</dd>
      </dl>`, { open: false })}
    </section>`;
  $('btn-avatar')?.addEventListener('click', () => onAvatar?.());
}

// ═══════════════════════════ TOP BAR ═══════════════════════════
export function renderTopbar(state) {
  const p = state.player;
  $('top-date').innerHTML = `${icon('calendar')} ${dateLabel(state.week)} <span class="muted">· ${e(p.jerseyName)}, ${ageNow(state)}</span>`;
  $('top-meters').innerHTML = p.life ? ['morale', 'stress'].map((k) => `<span class="tm" title="${e(METERS[k].tip)}">${icon(METERS[k].icon)}<i style="--w:${meter(p, k)}%;--c:${meterColor(k, meter(p, k))}"></i></span>`).join('') + `<span class="tm" title="Fitness">${icon('pulse')}<i style="--w:${Math.round(p.pfm)}%;--c:${p.pfm < 50 ? 'var(--bad)' : 'var(--good)'}"></i></span>` : '';
}

// ═══════════════════════════ CENTRE: THE WEEK ═══════════════════════════
let matchSeq = 0;
function matchBox(state, m) {
  const p = state.player;
  const J = p.jerseyName;
  const home = m.home ? m.club : m.opp, away = m.home ? m.opp : m.club;
  const mine = (n) => (n === m.club ? 'mine' : '');
  const d = m.detail;
  const player = m.minutes > 0
    ? `<span class="rating ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span><span class="chip">${icon('clock')} ${m.minutes}'</span>${m.goals ? `<span class="chip chip-good">${icon('ball')} ${m.goals}</span>` : ''}${m.assists ? `<span class="chip chip-accent">${icon('share')} ${m.assists}</span>` : ''}${m.motm ? `<span class="chip chip-accent">${icon('star')} MOTM</span>` : ''}${m.red ? '<span class="chip chip-bad">🟥</span>' : m.yellow ? '<span class="chip chip-warn">🟨</span>' : ''}${m.keyMoment ? `<span class="chip">${icon('target')} key moment</span>` : ''}`
    : `<span class="chip">${m.reason === 'injured' ? 'Injured' : m.reason === 'suspended' ? 'Suspended' : 'Did not play'}</span>`;
  const xg = d ? `<div class="match-xg">xG <b>${m.home ? d.stats.my.xg : d.stats.opp.xg}</b> – <b>${m.home ? d.stats.opp.xg : d.stats.my.xg}</b></div>` : '';
  return `<div class="match res-${m.result}">
    <div class="match-comp">${icon(m.international ? 'flag' : 'ball')} ${e(m.competition)}${m.round && !m.international ? ` · ${e(m.round)}` : ''}</div>
    <div class="match-score"><span class="home ${mine(home)}">${e(home)}</span><span class="sc">${m.hs}–${m.as}</span><span class="${mine(away)}">${e(away)}</span></div>
    ${xg}
    ${m.penalties ? `<div class="hint">Penalties: ${m.penalties}</div>` : ''}
    <div class="match-player"><b>${e(J)}</b> ${player}</div>
    ${d ? fold('matchcentre', `${icon('chart')} Match centre`, matchCentre(state, m), { open: false, cls: 'fold-mini' }) : ''}
  </div>`;
}

function matchCentre(state, m) {
  const d = m.detail;
  const id = `mc${++matchSeq}`;
  const ev = d.events.map((x) => {
    const side = x.side === 'my' ? 'l' : 'r';
    const txt = x.type === 'goal' ? `${icon('ball')} <b>${e(x.scorer)}</b>${x.pen ? ' (pen)' : ''}${x.assist ? ` <span class="muted">· ${e(x.assist)}</span>` : ''}`
      : x.type === 'sub' ? `${icon('swap')} <span class="up">${e(x.on)}</span> <span class="muted">for</span> <span class="down">${e(x.off)}</span>`
        : `<span class="card-${x.type}"></span> ${e(x.name)}`;
    return `<li class="ev ev-${side} ev-${x.type}"><span class="ev-min">${x.min}'</span><span class="ev-txt">${txt}</span></li>`;
  }).join('');
  const S = d.stats;
  const row = (label, a, b, pct = false) => {
    const av = Number(String(a).replace('%', '')) || 0, bv = Number(String(b).replace('%', '')) || 0;
    const w = av + bv > 0 ? Math.round((av / (av + bv)) * 100) : 50;
    return `<div class="srow"><span class="sa">${a}${pct ? '%' : ''}</span><span class="sl">${label}<i style="--w:${w}%"></i></span><span class="sb">${b}${pct ? '%' : ''}</span></div>`;
  };
  const stats = [row('Possession', S.my.possession, S.opp.possession, true), row('Expected goals (xG)', S.my.xg, S.opp.xg), row('Shots', S.my.shots, S.opp.shots), row('On target', S.my.onTarget, S.opp.onTarget),
    row('Big chances', S.my.bigChances, S.opp.bigChances), row('Passes', S.my.passes, S.opp.passes), row('Pass accuracy', S.my.passAcc, S.opp.passAcc, true), row('Saves', S.my.saves, S.opp.saves),
    row('Corners', S.my.corners, S.opp.corners), row('Fouls', S.my.fouls, S.opp.fouls), row('Offsides', S.my.offsides, S.opp.offsides), row('Yellow cards', S.my.yellows, S.opp.yellows)].join('');
  const team = (t, title) => `<div class="lu"><div class="lu-h">${e(title)} <span class="muted">${e(t.formation)}</span></div><ol>${t.xi.map((x) => `<li class="${x.me ? 'me' : ''}"><span class="lu-n">${x.num}</span><span class="lu-p">${e(x.pos)}</span><span class="lu-name">${e(x.name)}${x.name === d.motm ? ` ${icon('star')}` : ''}</span><span class="rating mini ${ratingClass(x.rating)}">${x.rating.toFixed(1)}</span></li>`).join('')}</ol>
    <div class="lu-bench">Bench</div><ol>${t.bench.map((x) => `<li class="${x.me ? 'me' : ''} ${x.on === null ? 'unused' : ''}"><span class="lu-n">${x.num}</span><span class="lu-p">${e(x.pos)}</span><span class="lu-name">${e(x.name)}${x.on !== null ? ` <span class="muted">${x.on}'</span>` : ''}</span>${x.rating ? `<span class="rating mini ${ratingClass(x.rating)}">${x.rating.toFixed(1)}</span>` : '<span></span>'}</li>`).join('')}</ol></div>`;
  const mine = m.club, theirs = m.opp;
  const personal = d.personal ? `<div class="ps-head"><span class="rating ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span> ${m.minutes} minutes${m.goals ? ` · ${m.goals} goal${m.goals > 1 ? 's' : ''}` : ''}${m.assists ? ` · ${m.assists} assist${m.assists > 1 ? 's' : ''}` : ''}</div><dl class="kv ps">${d.personal.map((x) => `<dt>${e(x.label)}</dt><dd>${e(x.value)}</dd>`).join('')}</dl>` : '<p class="hint">He didn\'t play, so there are no personal stats.</p>';
  return `<div class="mc">
    <input type="radio" name="${id}" id="${id}a" checked><label for="${id}a">Summary</label>
    <input type="radio" name="${id}" id="${id}b"><label for="${id}b">Line-ups</label>
    <input type="radio" name="${id}" id="${id}c"><label for="${id}c">His stats</label>
    <div class="mc-p mc-sum"><div class="mc-teams"><span>${e(mine)}</span><span>${e(theirs)}</span></div><ul class="events">${ev || '<li class="hint">No events.</li>'}</ul><div class="stats">${stats}</div>${d.motm ? `<p class="hint">${icon('star')} Man of the match: <b>${e(d.motm)}</b></p>` : ''}</div>
    <div class="mc-p mc-lu"><div class="lus">${team(d.lineups.my, mine)}${team(d.lineups.opp, theirs)}</div></div>
    <div class="mc-p mc-ps">${personal}</div>
  </div>`;
}

function outcomeCard(state, o) {
  const arena = o.kind === 'offer' || o.kind === 'renewal' ? 'transfer' : o.moment ? 'match' : (CAT_TO_ARENA[o.cat] ?? 'football');
  const st = ARENA_STYLE[arena] ?? ARENA_STYLE.football;
  return `<div class="outcome" style="--ac:${st.color}">
    <div class="outcome-head">${icon(st.icon)}<span>You chose <b>${e(o.label)}</b>${o.auto ? ' <span class="chip">instinct</span>' : ''}</span></div>
    ${o.text ? `<p>${e(o.text)}</p>` : ''}
    ${changeChips(state, o.changes)}
    ${ripplesHtml(state, o.ripples)}
  </div>`;
}
const CAT_TO_ARENA = { training: 'football', manager: 'football', dressing: 'football', body: 'football', national: 'football', milestone: 'football', veteran: 'football', media: 'media', love: 'love', friends: 'friends', family: 'family', culture: 'family', money: 'lifestyle', lifestyle: 'lifestyle', politics: 'politics', transfer: 'transfer', 'in-match': 'match', tactical: 'football', personal: 'football', sponsor: 'lifestyle' };

function asidesList(state) {
  const list = state.weekAsides ?? [];
  if (!list.length) return '';
  return fold('asides', `${icon('clock')} Earlier this week <span class="count">${list.length}</span>`, `<ul class="asides">${list.map((a) => `<li><b>${e(a.headline)}</b>${a.label ? ` <span class="muted">· ${e(a.label)}</span>` : ''}${a.text ? `<span>${e(a.text)}</span>` : ''}${changeChips(state, a.changes)}</li>`).join('')}</ul>`, { open: false, cls: 'fold-mini' });
}

export function renderWeek(state, world, story) {
  matchSeq = 0;
  const p = state.player;
  const res = state.last;
  const wk = res ? res.week : state.week;
  let html = asidesList(state);
  html += `<div class="week-meta">
      <span>${icon('calendar')} ${story?.monthly ? e(story.dek ?? '') : dateLabel(wk)}</span><span>Age ${res?.age ?? ageNow(state)}</span>
      ${story?.eventType ? `<span class="chip">${e(story.eventType)}</span>` : ''}
      ${story?.isMajorEvent ? `<span class="chip chip-accent">${icon('star')} Major</span>` : ''}
    </div>`;
  html += `<h1 class="headline">${e(story?.headline ?? '')}</h1>`;
  if (story?.dek && !story.monthly) html += `<p class="dek">${e(story.dek)}</p>`;
  if (story?.monthly) {
    html += `<div class="narrative">${(story.sections ?? []).map((s) => fold(`month-${s.id}`, `${icon(s.icon)} ${e(s.title)}`, s.paras.map((x) => `<p>${e(x)}</p>`).join(''))).join('')}</div>`;
    if (story.weeks?.length) html += fold('month-weeks', `${icon('list')} The weeks`, story.weeks.map((w) => `<div class="mweek"><b>${e(w.date)}</b> ${e(w.headline)}</div>`).join(''), { open: false });
    if (res?.matches?.length) html += `<h2 class="sec-title">${icon('ball')} Last match</h2>` + res.matches.map((m) => matchBox(state, m)).join('');
    $('week-card').innerHTML = html;
    return;
  }
  const outs = (res?.outcomes ?? []).filter((o) => o.text || o.ripples?.length);
  if (outs.length) html += fold('consequences', `${icon('ripple')} What your choices caused <span class="count">${outs.length}</span>`, outs.map((o) => outcomeCard(state, o)).join(''), { cls: 'consequences' });
  if (res?.ripples?.length && !outs.length) html += ripplesHtml(state, res.ripples);
  for (const m of [...(res?.matches ?? []), ...(res?.intl ?? [])]) html += matchBox(state, m);
  const sections = story?.sections ?? [{ id: 'p', icon: 'spark', title: '', paras: story?.paragraphs ?? [] }];
  html += `<div class="narrative">${sections.map((s, i) => (i === 0 || !s.title ? `<section class="story-sec sec-${e(s.id)}">${s.paras.map((x) => `<p>${e(x)}</p>`).join('')}</section>` : fold(`story-${s.id}`, `${icon(s.icon)} ${e(s.title)}`, `<section class="story-sec sec-${e(s.id)}">${s.paras.map((x) => `<p>${e(x)}</p>`).join('')}</section>`, { cls: 'story-fold' }))).join('')}</div>`;
  if (story?.clippings?.length) html += fold('clippings', `${icon('newspaper')} In the papers`, `<div class="clip-grid">${story.clippings.map((c) => `<div class="clip tone-${e(c.tone)}"><span class="clip-outlet">${e(c.outlet)}</span><span class="clip-head">${e(c.headline)}</span></div>`).join('')}</div>`);
  if (story?.messages?.length) html += fold('messages', `${icon('phone')} Messages`, story.messages.map((m) => `<div class="msg"><span class="msg-from">${icon(m.icon)} ${e(m.from)}</span><span class="bubble">${e(m.text)}</span></div>`).join(''));
  if (res?.squadNews?.length) html += `<div class="box">${icon('users')}<div><h4>Squad news</h4>${res.squadNews.map((n) => e(n.text)).join(' · ')}</div></div>`;
  if (res?.seasonEnd) {
    const s = res.seasonEnd;
    html += `<div class="box">${icon('trophy')}<div><h4>Season ${e(s.label)} review</h4>${e(s.league)}: ${ordinal(s.pos)} of ${s.teams}${s.movement ? ` · <b>${s.movement}</b>` : ''} · Champions: ${e(s.champion)}<br>${s.apps} apps · ${s.goals} goals · ${s.assists} assists · ${s.motms} MOTM${s.avgRating ? ` · avg ${s.avgRating}` : ''}${s.awards.length ? `<br>🏅 ${s.awards.map(e).join(' · ')}` : ''}</div></div>`;
  }
  if (res?.trophies?.length) html += `<div class="box box-gold">${icon('trophy')}<div><h4>Trophy</h4>${res.trophies.map(e).join(' · ')}</div></div>`;
  if (res?.money) {
    const m = res.money;
    const parts = [`Wage ${money(state, m.wage ?? m.gross, { eurOnly: true })}`, m.bonuses ? `Bonuses ${money(state, m.bonuses, { eurOnly: true })}` : '', m.sponsors ? `Sponsors ${money(state, m.sponsors, { eurOnly: true })}` : '', m.imageCut ? `Club's image-rights share −${money(state, m.imageCut, { eurOnly: true })}` : '',
      `Tax ${money(state, m.tax, { eurOnly: true })}`, m.agentFee ? `Agent ${money(state, m.agentFee, { eurOnly: true })}` : '', `Living ${money(state, m.living, { eurOnly: true })}`, m.family ? `Family ${money(state, m.family, { eurOnly: true })}` : '',
      m.upkeep ? `Upkeep ${money(state, m.upkeep, { eurOnly: true })}` : '', m.assetIncome ? `Rent & business ${money(state, m.assetIncome, { eurOnly: true })}` : '', m.interest ? `Interest ${money(state, m.interest, { eurOnly: true })}` : ''].filter(Boolean);
    html += `<div class="box ${m.net < 0 ? 'box-bad' : ''}">${icon('wallet')}<div><h4>Monthly finances</h4>${parts.join(' · ')} → <b>${m.net >= 0 ? '+' : ''}${money(state, m.net)}</b>${m.assetChange ? `<br><span class="muted">Your assets ${m.assetChange >= 0 ? 'gained' : 'lost'} ${money(state, Math.abs(m.assetChange), { eurOnly: true })} in value.</span>` : ''}</div></div>`;
  }
  $('week-card').innerHTML = html;
}

// ═══════════════════════════ DECISIONS ═══════════════════════════
function arenaOf(d) {
  if (d.kind === 'offer' || d.kind === 'renewal') return 'transfer';
  if (d.type === 'in-match') return 'match';
  return d.arena ?? CAT_TO_ARENA[d.cat ?? d.type] ?? 'football';
}
const UI_ICON = { phone: 'phone', press: 'mic', social: 'camera', boardroom: 'building', letter: 'letter' };

function choiceButtons(choices, chosen = null) {
  return `<div class="choices">${choices.map((c) => `
    <button class="choice ${chosen === c.id ? 'selected' : ''}" data-choice="${e(c.id)}">
      <span class="choice-top"><span>${e(c.label)}</span>${c.risk ? `<span class="risk risk-${e(c.risk)}">${e(c.risk)}</span>` : ''}</span>
      ${c.description ? `<span class="choice-desc">${e(c.description)}</span>` : ''}
      ${c.consequence ? `<span class="choice-cons">${e(c.consequence)}</span>` : ''}
      ${c.aspects?.length ? `<span class="aspects">${c.aspects.map((a) => `<span title="Can affect: ${e(ASPECT_LABEL[a] ?? a)}">${icon(ASPECT_ICON[a] ?? 'spark')}</span>`).join('')}</span>` : ''}
    </button>`).join('')}</div>`;
}

export function renderDecisions(state, onChoose) {
  const box = $('decisions');
  const open = state.pending.filter((d) => !d.chosen).length;
  box.innerHTML = state.pending.length ? `<div class="dec-head"><h2>${icon('target')} Decisions this week</h2><span class="hint">${open ? `${open} to answer` : 'All answered: play the week'}</span></div>` + state.pending.map((d) => {
    const st = ARENA_STYLE[arenaOf(d)] ?? ARENA_STYLE.football;
    const picked = d.chosen ? d.choices.find((c) => c.id === d.chosen) : null;
    const body = `${d.scene ? `<p class="scene">${e(d.scene)}</p>` : ''}
      ${d.sheet?.length ? fold(`sheet-${d.kind}`, `${icon('letter')} The contract, line by line`, `<dl class="kv kv-contract">${d.sheet.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>`, { cls: 'fold-mini sheet' }) : ''}
      <div class="decision-prompt">${e(d.prompt)}</div>${choiceButtons(d.choices, d.chosen)}`;
    return `
    <div class="card decision ui-${e(d.ui ?? 'plain')} ${d.chosen ? 'is-done' : ''}" data-id="${d.id}" style="--ac:${st.color}">
      <details class="dec-fold" ${d.chosen ? '' : 'open'}><summary>
        <div class="dec-top"><span class="arena">${icon(st.icon)} ${st.label}</span>${d.ui ? `<span class="arena-ui">${icon(UI_ICON[d.ui] ?? 'spark')}</span>` : ''}${d.critical ? '<span class="chip chip-warn">big moment</span>' : ''}${picked ? `<span class="picked">${icon('check')} ${e(picked.label)}</span>` : ''}<span class="fold-chev">${icon('chevron')}</span></div>
        ${d.headline ? `<h3 class="dec-title">${e(d.headline)}</h3>` : ''}
      </summary>${body}</details>
    </div>`;
  }).join('') : '';
  box.querySelectorAll('.decision').forEach((el) => el.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => onChoose(el.dataset.id, btn.dataset.choice))));
}

// ═══════════════════════════ YOUR WEEK: FREE TIME · PEOPLE · SOCIAL ═══════════════════════════
export function renderActions(state, data, h) {
  const el = $('actions');
  if (state.ended) { el.innerHTML = ''; return; }
  const { tab, free, slots, posts, postsLeft, people } = data;
  const p = state.player;
  const tabs = [['free', 'Free time', 'clock', `${slots} left`], ['people', 'People', 'users', `${people.length}`], ['social', 'Social', 'camera', `${postsLeft}/3`]];
  let body = '';
  if (tab === 'people') {
    body = `<p class="hint">Act, don't just react: choose someone and start something. Each action uses a free-time slot (${slots} left).</p>
      <ul class="plist">${people.map((x) => `<li><button class="prow" data-who="${e(x.key)}">${avatarInitials(x.name, x.key)}<div><b>${e(x.name)}</b><span>${icon(x.icon)} ${e(x.role)}</span></div><div class="prow-r">${x.value !== null ? `${bar(x.value, 100, x.value >= 65 ? 'var(--good)' : x.value >= 40 ? 'var(--info)' : x.value >= 25 ? 'var(--warn)' : 'var(--bad)')}<em>${personWord(x.value)}</em>` : ''}</div></button></li>`).join('')}
      <li><button class="prow" data-who="teammate-list">${avatarInitials('Squad', 'teammate')}<div><b>Teammates</b><span>${icon('users')} Open the Squad tab to pick someone</span></div></button></li></ul>`;
  } else if (tab === 'social') {
    body = `<div class="ft-sub">${compact(p.followers)} followers${p.social?.verified ? ' · verified' : ''} · ${postsLeft} of 3 posts left this week · doesn't move time</div>
      ${postsLeft ? `<div class="ft-grid post-grid">${posts.map((o) => `<button class="ft post-btn" data-key="${e(o.key)}">${icon(o.icon)}<span class="ft-label">${e(o.label)}</span><span class="ft-desc">${e(o.desc)}</span></button>`).join('')}</div>` : '<p class="hint">You\'ve posted three times this week. Timing matters more than volume, and the same kind of post twice in a week lands worse.</p>'}`;
  } else {
    body = `<div class="ft-sub"><span class="ft-left">${Array.from({ length: Math.max(slots, 0) }, () => '<i></i>').join('')}</span> ${slots} left this week (shared with People) · doesn't move time</div>
      <div class="ft-grid">${free.map((a) => `<button class="ft" data-id="${e(a.id)}" ${a.done || slots <= 0 ? 'disabled' : ''}>${icon(a.icon)}<span class="ft-label">${e(a.label)}</span><span class="ft-desc">${e(a.desc)}</span>${a.done ? `<span class="ft-done">${icon('check')}</span>` : ''}</button>`).join('')}</div>`;
  }
  el.innerHTML = fold('yourweek', `${icon('spark')} Your week`, `<nav class="seg seg-tabs">${tabs.map(([k, l, ic, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(ic)}<span>${l}</span><em>${n}</em></button>`).join('')}</nav><div class="act-body">${body}</div>`);
  el.querySelectorAll('.seg-tabs button').forEach((b) => b.addEventListener('click', () => h.onTab(b.dataset.tab)));
  el.querySelectorAll('.ft[data-id]').forEach((b) => b.addEventListener('click', () => h.onFree(b.dataset.id)));
  el.querySelectorAll('.post-btn').forEach((b) => b.addEventListener('click', () => h.onPost(b.dataset.key)));
  el.querySelectorAll('.prow').forEach((b) => b.addEventListener('click', () => h.onPerson(b.dataset.who)));
}

function avatarInitials(name, key) {
  const colors = { partner: '#ff7aa2', crush: '#ffb547', ex: '#b69cff', parents: '#f5c84c', sibling: '#f5c84c', bestfriend: '#ffb547', kid: '#3ddc97', manager: '#5aa9ff', president: '#ff8a5c', journalist: '#b69cff', agent: '#5aa9ff', teammate: '#3ddc97' };
  const ini = String(name ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('');
  return `<span class="pav" style="background:${colors[key] ?? '#5aa9ff'}">${e(ini)}</span>`;
}

// ═══════════════════════════ PLANNER ═══════════════════════════
export function renderPlanner(state, plan, onChange, onPlay, onPlayMonth) {
  const p = state.player;
  const season = currentSeason(state);
  const fix = season && p.club ? nextFixtures(season, p.club.name, state.week, 1)[0] : null;
  const cupRound = state.cup?.alive ? state.cup.rounds.find((r) => r.week >= state.week) : null;
  const unanswered = state.pending.filter((d) => !d.chosen).length;
  const opts = [['hard', 'Train hard', 'dumbbell', 'More growth, −3 fitness, more stress and injury risk'], ['balanced', 'Balanced', 'target', 'Steady work, −1 fitness'], ['light', 'Light', 'pulse', 'Recover a little, +3 fitness, less stress'], ['rest', 'Rest', 'bed', 'No growth, +7 fitness, much less stress']];
  const relevant = attrsOf(p.position);
  const bigOpen = state.pending.some((d) => !d.chosen && (['offer', 'renewal', 'sponsor', 'rehab', 'retire'].includes(d.kind) || d.critical));
  $('planner').innerHTML = `
    <h2>${icon('calendar')} Your week ahead</h2>
    ${p.injury ? `<p class="hint">${icon('bandage')} Injured: rehab replaces training (${p.injury.weeksLeft} week${p.injury.weeksLeft > 1 ? 's' : ''} left).</p>` : `
    <div class="seg" id="seg-plan">${opts.map(([k, l, ic, t]) => `<button type="button" data-k="${k}" title="${t}" class="${plan.intensity === k ? 'on' : ''}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>
    <div class="planner-row">
      <label>Training focus<select id="sel-focus"><option value="auto">Automatic (best for position)</option>${relevant.map((k) => `<option value="${k}" ${plan.focus === k ? 'selected' : ''}>${statLabel(k)}</option>`).join('')}</select></label>
      <span class="hint">${opts.find((o) => o[0] === plan.intensity)?.[3] ?? ''}</span>
    </div>`}
    <div class="play-row">
      <div class="next-fix">${icon('ball')} ${fix ? `Next: ${fix.week === state.week ? '<b>this week</b>' : shortDate(fix.week)} · ${fix.home ? 'vs' : '@'} ${e(fix.opp)}` : p.club ? 'No league match scheduled' : 'Free agent: waiting for offers'}${cupRound && cupRound.week === state.week ? ` · <b>${e(state.cup.name)} ${e(cupRound.name)}</b>` : ''}</div>
      <div class="play-btns">
        <button id="btn-month" class="btn btn-month" ${bigOpen ? 'disabled' : ''} title="Play until the end of the month. Small decisions are left to instinct (the lowest-risk choice); the game stops for anything big. You get a monthly report.">${icon('fast')} Play month</button>
        <button id="btn-play" class="btn btn-primary btn-play" ${unanswered ? 'disabled' : ''}>${unanswered ? `Answer ${unanswered} decision${unanswered > 1 ? 's' : ''} first` : `Play week ${state.week + 1} ${icon('play')}`}</button>
      </div>
    </div>`;
  $('planner').querySelectorAll('#seg-plan button').forEach((b) => b.addEventListener('click', () => onChange({ ...plan, intensity: b.dataset.k })));
  $('sel-focus')?.addEventListener('change', (ev) => onChange({ ...plan, focus: ev.target.value }));
  $('btn-play').addEventListener('click', onPlay);
  $('btn-month').addEventListener('click', onPlayMonth);
}

// ═══════════════════════════ INTERLUDE (time stands still) ═══════════════════════════
export function renderInterlude(state, it, onChoose) {
  $('interlude-body').innerHTML = `
    <div class="il-top">${icon('pause')}<span>Meanwhile · ${e(it.time)}</span><span class="aside-tag">${icon('clock')} time stands still</span></div>
    <h2 class="il-title">${e(it.headline)}</h2>
    <p class="il-text">${e(it.text)}</p>
    ${choiceButtons(it.choices)}`;
  $('interlude-body').querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => onChoose(b.dataset.choice)));
}

export function renderInterludeResult(state, r, onPlay, onClose) {
  $('interlude-body').innerHTML = `
    <div class="il-top">${icon('pause')}<span>Meanwhile · ${e(r.time ?? '')}</span><span class="aside-tag">${icon('clock')} time stands still</span></div>
    <h2 class="il-title">${e(r.headline)}</h2>
    ${r.label ? `<div class="aside-choice">You chose <b>${e(r.label)}</b></div>` : ''}
    ${r.text ? `<p class="il-text">${e(r.text)}</p>` : ''}
    ${changeChips(state, r.changes, r.stats)}
    ${ripplesHtml(state, r.ripples)}
    <div class="il-actions"><button class="btn" id="il-close">Back to the week</button><button class="btn btn-primary" id="il-play">Play week ${state.week + 1} ${icon('play')}</button></div>`;
  $('il-close').addEventListener('click', onClose);
  $('il-play').addEventListener('click', onPlay);
}

// ═══════════════════════════ MEDIA ═══════════════════════════
const PLATFORM_COLOR = { news: '#efe9dc', x: '#e8eef8', instagram: '#ff7aa2', tiktok: '#5ff2e8', youtube: '#ff5c5c', blog: '#ffb547', podcast: '#b69cff', magazine: '#f5c84c', tv: '#5aa9ff', forum: '#3ddc97' };
export function renderMedia(state, filter, onFilter, showAll, onMore) {
  const items = state.media?.items ?? [];
  const el = $('media');
  const counts = {};
  for (const x of items) counts[x.platform] = (counts[x.platform] ?? 0) + 1;
  const list = items.filter((x) => filter === 'all' || x.platform === filter);
  const shown = showAll ? list.slice(0, 120) : list.slice(0, 18);
  const thisWeek = items.filter((x) => x.week === state.last?.week).length;
  const ago = (w) => { const d = (state.last?.week ?? state.week) - w; return d <= 0 ? 'this week' : d === 1 ? 'last week' : `${d} weeks ago`; };
  const row = (x) => `<article class="mi mi-${e(x.platform)} tone-${e(x.tone)}">
    <div class="mi-head"><span class="mi-badge" style="--pc:${PLATFORM_COLOR[x.platform] ?? '#888'}">${icon(PLATFORMS[x.platform]?.icon ?? 'message')}</span><b>${e(x.source?.name ?? '')}</b>${x.source?.verified ? `<span class="verified">${icon('check')}</span>` : ''}${x.source?.handle ? ` <span class="muted">${e(x.source.handle)}</span>` : ''}${x.source?.tag ? ` <span class="muted">· ${e(x.source.tag)}</span>` : ''}${x.source?.show ? ` <span class="muted">· ${e(x.source.show)}</span>` : ''}<span class="mi-when">${ago(x.week)}</span></div>
    ${x.title ? `<div class="mi-title">${e(x.title)}</div>` : ''}<div class="mi-text">${e(x.text)}</div>
    <div class="mi-meta">${x.views ? `${icon('eye')} ${compact(x.views)} views · ` : ''}${x.likes ? `${icon('heart')} ${compact(x.likes)} · ` : ''}${icon('message')} ${compact(x.replies ?? 0)}</div>
  </article>`;
  const chips = [['all', 'All', items.length], ...Object.keys(PLATFORMS).filter((k) => counts[k]).map((k) => [k, PLATFORMS[k].label, counts[k]])];
  el.innerHTML = fold('media', `${icon('share')} Media & social <span class="count">${thisWeek} this week</span>`, `
    <div class="chipbar">${chips.map(([k, l, n]) => `<button class="fchip ${filter === k ? 'on' : ''}" data-f="${k}">${e(l)} <em>${n}</em></button>`).join('')}</div>
    <div class="mlist">${shown.map(row).join('') || '<p class="hint">Nothing yet. Play a week: the media will notice you as soon as there\'s something to notice.</p>'}</div>
    ${list.length > shown.length ? `<button class="btn btn-small" id="media-more">Show ${list.length - shown.length} more</button>` : ''}`);
  el.querySelectorAll('.fchip').forEach((b) => b.addEventListener('click', () => onFilter(b.dataset.f)));
  $('media-more')?.addEventListener('click', onMore);
}

// ═══════════════════════════ RIGHT: TABS ═══════════════════════════
const TABS = [['circle', 'Circle', 'users'], ['squad', 'Squad', 'shirt'], ['table', 'Table', 'table'], ['assets', 'Assets', 'shop'], ['career', 'Career', 'trophy'], ['reports', 'Reports', 'report']];

function circleTab(state, world, h) {
  const p = state.player;
  if (!p.life) return '<p class="hint">Start a new career to meet your circle.</p>';
  const groups = [['club', 'At the club', 'building'], ['public', 'In public', 'newspaper'], ['private', 'Private life', 'heart'], ['self', 'You', 'user']];
  let html = '';
  for (const [g, title, ic] of groups) {
    const keys = Object.keys(METERS).filter((k) => METERS[k].group === g && meter(p, k) !== null);
    if (!keys.length) continue;
    html += fold(`circle-${g}`, `${icon(ic)} ${title}`, keys.map((k) => {
      const v = meter(p, k);
      const d = state.last?.life?.[k];
      const cap = k === 'dressing' ? standingCap(state) : 100;
      return `<div class="meter" title="${e(METERS[k].tip)}${cap < 100 ? ` Your standing can't go above ${Math.round(cap)} yet: it grows with age and games played.` : ''}"><span class="m-l">${icon(METERS[k].icon)}${METERS[k].label}</span>${bar(v, 100, meterColor(k, v), cap < 100 ? cap : null)}<span class="m-v">${v}${d ? `<em class="${(k === 'stress' ? d < 0 : d > 0) ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</em>` : ''}</span><span class="m-w">${meterWord(k, v)}</span></div>`;
    }).join(''));
  }
  const people = h.people ?? [];
  html += fold('circle-people', `${icon('user')} People <span class="count">${people.length}</span>`, `<ul class="plist">${people.map((x) => `<li><button class="prow" data-who="${e(x.key)}">${avatarInitials(x.name, x.key)}<div><b>${e(x.name)}</b><span>${icon(x.icon)} ${e(x.role)}</span></div><div class="prow-r">${x.value !== null ? `${bar(x.value, 100, x.value >= 65 ? 'var(--good)' : x.value >= 40 ? 'var(--info)' : x.value >= 25 ? 'var(--warn)' : 'var(--bad)')}<em>${personWord(x.value)}</em>` : ''}</div></button></li>`).join('')}</ul>
    ${(p.formerTeammates ?? []).length ? `<p class="hint small">Old friends from former clubs: ${p.formerTeammates.slice(-5).map((f) => `${e(f.name)} (${e(f.club)})`).join(', ')}</p>` : ''}`);
  return html;
}

const REL_CLS = { ally: 'chip-good', rival: 'chip-warn', enemy: 'chip-bad', neutral: '' };
function squadTab(state, world, h) {
  const rows = h.squad ?? [];
  const sq = state.squad;
  if (!sq) return '<p class="hint">No club, no squad. Your old friends are in the Circle tab.</p>';
  const p = state.player;
  const me = `<li class="sq me"><span class="sq-n">${p.number}</span><span class="sq-p">${p.position}</span><div><b>${e(p.name)} (you)</b><span>${ageNow(state)} · ${e(p.nationality)}${state.squad.captainIsMe ? ' · captain' : ''}</span></div><span class="sq-o">${overall(p)}</span><span></span></li>`;
  const byPos = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
  const list = byPos.map((pos) => {
    const r = rows.filter((x) => x.pos === pos);
    if (!r.length && pos !== p.position) return '';
    return `<li class="sq-h">${POSITIONS[pos].name}s</li>${pos === p.position ? me : ''}${r.map((x) => `<li class="sq" data-id="${e(x.id)}" role="button" tabindex="0" title="${e(x.traits.join(' · '))}"><span class="sq-n">${x.num}</span><span class="sq-p">${x.pos}</span><div><b>${e(x.name)}${x.captain ? ' <span class="cap">C</span>' : ''}</b><span>${x.age} · ${e(x.nat)}${x.inj ? ` · ${icon('bandage')} ${x.inj}w` : ''}${x.competitor ? ' · fighting you for the shirt' : ''} · ${x.apps} apps${x.goals ? `, ${x.goals} G` : ''}</span></div><span class="sq-o">${x.ovr}</span><span class="chip ${REL_CLS[x.rel]}">${x.rel}</span></li>`).join('')}`;
  }).join('');
  const news = (sq.news ?? []).slice(-12).reverse();
  return `<p class="hint">${e(sq.club)} · ${e(sq.formation)} · ${rows.length + 1} players. Tap a teammate to talk to them, train with them, or settle a score.</p>
    <ul class="squad">${list}</ul>
    ${news.length ? fold('squad-news', `${icon('swap')} Comings and goings`, `<ul class="list">${news.map((n) => `<li><span class="wk">${shortDate(n.week)}</span>${e(n.text)}</li>`).join('')}</ul>`, { open: false }) : ''}`;
}

function tableTab(state) {
  const p = state.player;
  const season = currentSeason(state);
  if (!season) return '<p class="hint">No league right now.</p>';
  const rows = standings(season);
  let html = `<h3 class="first">${e(season.name)} <span class="muted">${e(season.label)}</span></h3>
    ${season.rounds[0].week > state.week ? `<p class="hint">Season starts ${shortDate(season.rounds[0].week)}.</p>` : ''}
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Club</th><th class="n">P</th><th class="n">GD</th><th class="n">Pts</th></tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.club === p.club?.name ? 'me' : ''}"><td>${r.pos}</td><td class="club">${e(r.club)}</td><td class="n">${r.p}</td><td class="n">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="n">${r.pts}</td></tr>`).join('')}
    </tbody></table></div>`;
  const fx = nextFixtures(season, p.club.name, state.week, 5);
  html += fold('fixtures', `${icon('calendar')} Fixtures`, `<ul class="list">${fx.map((f) => `<li><span class="wk">${shortDate(f.week)}</span>${f.home ? 'vs' : '@'} ${e(f.opp)}</li>`).join('') || '<li class="hint">None scheduled</li>'}
    ${state.cup ? `<li><span class="wk">${e(state.cup.name)}</span>${state.cup.alive ? `Next: ${e(state.cup.rounds.find((r) => r.week >= state.week)?.name ?? '—')}` : state.cup.results.at(-1)?.result === 'W' ? '🏆 Winners' : `Out (${e(state.cup.results.at(-1)?.round ?? '')})`}</li>` : ''}</ul>`);
  return html;
}

const CAT_ICON = { car: 'car', supercar: 'car', moto: 'car', watch: 'watch', jewellery: 'gem', fashion: 'shirt', tech: 'phone', property: 'house', yacht: 'boat', jet: 'plane', art: 'palette', invest: 'chart', business: 'briefcase' };
function assetsTab(state, world, h) {
  const p = state.player;
  const owned = ownedAssets(state);
  const cats = Object.keys(world.assets?.categories ?? {});
  const cat = h.shopCat && cats.includes(h.shopCat) ? h.shopCat : cats[0];
  const value = owned.reduce((a, x) => a + x.value, 0);
  const upkeep = owned.reduce((a, x) => a + Math.round(x.cost * ((world.assets.items.find((i) => i.id === x.id)?.upkeep) ?? catOf(world, x.cat).upkeep ?? 0)), 0);
  const items = shopItems(state, world, cat).sort((a, b) => a.price - b.price);
  const gifts = giftTargets(state);
  const shopRow = (x) => {
    const amounts = [1000, 10000, 100000, 1000000].filter((a) => a <= p.wealthEUR);
    const action = x.locked ? `<span class="hint small">Fame ${x.minRep} needed</span>`
      : x.invest ? `<div class="inv">${amounts.length ? amounts.map((a) => `<button class="btn btn-small buy" data-id="${e(x.id)}" data-amt="${a}">+€${compact(a)}</button>`).join('') : '<span class="hint small">€1K minimum</span>'}</div>`
        : `<div class="buyrow">${x.gift ? `<select class="gift-to" data-id="${e(x.id)}">${gifts.map(([k, l]) => `<option value="${k}">${k === 'self' ? 'For me' : `Gift: ${e(l)}`}</option>`).join('')}</select>` : ''}<button class="btn btn-small buy" data-id="${e(x.id)}" ${x.affordable ? '' : 'disabled'}>${x.affordable ? 'Buy' : 'Too expensive'}</button></div>`;
    return `<li class="shop-i ${x.affordable || x.invest ? '' : 'dim'}"><div><b>${e(x.brand)}</b> ${e(x.name)}${x.owned ? ` <span class="chip">owned ×${x.owned}</span>` : ''}<span class="si-d">${e(x.desc ?? '')}${x.yield ? ` · income ~${(x.yield * 1200).toFixed(1)}%/yr` : ''}${x.invest ? ` · expected ${Math.round((x.growth ?? 0) * 100)}%/yr, swings ±${Math.round((x.vol ?? 0) * 100)}%` : ''}</span></div><div class="si-r"><span class="price">${x.invest ? 'any amount' : eur(x.price)}</span>${action}</div></li>`;
  };
  return `<div class="worth"><div><span>Savings</span><b>${money(state, p.wealthEUR, { eurOnly: true })}</b></div><div><span>Assets</span><b>${money(state, value, { eurOnly: true })}</b></div><div><span>Net worth</span><b>${money(state, netWorth(state), { eurOnly: true })}</b></div></div>
    ${upkeep ? `<p class="hint small">Upkeep: about ${eur(upkeep)} a month (insurance, staff, mooring, maintenance).</p>` : ''}
    ${fold('owned', `${icon('star')} What you own <span class="count">${owned.length}</span>`, owned.length ? `<ul class="owned">${owned.map((a) => { const ch = a.cost ? Math.round((a.value / a.cost - 1) * 100) : 0; return `<li>${icon(CAT_ICON[a.cat] ?? 'star')}<div><b>${e(a.brand)}</b> ${e(a.name)}<span>bought ${shortDate(a.bought)} for ${eur(a.cost)}</span></div><div class="si-r"><span class="price">${eur(a.value)} <em class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch}%</em></span><button class="btn btn-small sell" data-uid="${e(a.uid)}">Sell</button></div></li>`; }).join('')}</ul>` : '<p class="hint">Nothing yet. Everything you buy is in the story: the car you drive, the house your parents live in, the watch on your wrist.</p>')}
    ${fold('shop', `${icon('shop')} Shop`, `<div class="chipbar">${cats.map((c) => `<button class="fchip ${c === cat ? 'on' : ''}" data-cat="${c}">${icon(CAT_ICON[c] ?? 'star')} ${e(catOf(world, c).label)}</button>`).join('')}</div>
      <ul class="shop">${items.map(shopRow).join('')}</ul>`)}`;
}

function careerTab(state, world) {
  const p = state.player, c = p.career;
  const t = transferOutlook(state, world);
  const cls = { '+': 'up', '-': 'down', tip: 'tip', i: 'info' };
  return fold('outlook', `${icon('map')} Transfer outlook`, `<div class="outlook"><div><span>Offers</span><b>${t.weekly >= 0.2 ? 'Likely' : t.weekly >= 0.07 ? 'Possible' : 'Unlikely'}</b></div><div><span>From abroad</span><b>${Math.round(t.abroad * 100)}%</b></div><div><span>Window</span><b>${t.windowNow ? 'Open' : 'Closed'}</b></div></div>
    <ul class="notes">${t.notes.map(([k, n]) => `<li class="n-${cls[k]}">${e(n)}</li>`).join('')}</ul>`)
    + fold('record', `${icon('trophy')} Record`, `<dl class="kv">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals</dt><dd>${c.goals}</dd><dt>Assists</dt><dd>${c.assists}</dd><dt>Man of the Match</dt><dd>${c.motms}</dd>
      <dt>This season</dt><dd>${p.season.apps} apps · ${p.season.goals} G · ${p.season.assists} A</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak value</dt><dd>€${compact(c.peakMarketValue)}</dd>
    </dl>`)
    + (c.trophies.length ? fold('trophies', `${icon('trophy')} Trophies <span class="count">${c.trophies.length}</span>`, `<ul class="list">${c.trophies.map((x) => `<li>🏆 ${e(x)}</li>`).join('')}</ul>`, { open: false }) : '')
    + (c.awards.length ? fold('awards', `${icon('star')} Awards <span class="count">${c.awards.length}</span>`, `<ul class="list">${c.awards.map((x) => `<li>🏅 ${e(x)}</li>`).join('')}</ul>`, { open: false }) : '')
    + fold('clubs', `${icon('shirt')} Clubs`, `<ul class="list">${c.clubHistory.map((x) => `<li>${e(x.club)}${x.type === 'loan' ? ' (loan)' : ''} <span class="muted">· ${yearOf(x.from)}–${x.to !== null ? yearOf(x.to) : 'now'} · ${x.apps} apps, ${x.goals} G</span></li>`).join('')}</ul>`, { open: false })
    + (c.seasons.length ? fold('seasons', `${icon('chart')} Season by season`, `<div class="table-wrap"><table><thead><tr><th>Season</th><th>Club</th><th class="n">Apps</th><th class="n">G</th><th class="n">A</th><th class="n">Avg</th></tr></thead><tbody>${c.seasons.map((s) => `<tr><td>${e(s.label)}</td><td class="club">${e(s.club)}</td><td class="n">${s.apps}</td><td class="n">${s.goals}</td><td class="n">${s.assists}</td><td class="n">${s.avgRating ?? '—'}</td></tr>`).join('')}</tbody></table></div>`, { open: false }) : '');
}

function weekReport(state, w) {
  const lines = [];
  for (const m of w.matches) lines.push(`<li>${icon(m.intl ? 'flag' : 'ball')} ${m.home ? `${e(m.club)} ${m.hs}-${m.as} ${e(m.opp)}` : `${e(m.opp)} ${m.hs}-${m.as} ${e(m.club)}`} <span class="muted">${e(m.comp)}</span> ${m.minutes ? `<span class="rating mini ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span> ${m.minutes}'${m.goals ? ` · ${m.goals}G` : ''}${m.assists ? ` · ${m.assists}A` : ''}` : '<span class="muted">didn\'t play</span>'}${m.xg !== null ? ` <span class="muted">· xG ${m.xg}–${m.xga}</span>` : ''}</li>`);
  for (const d of w.decisions) lines.push(`<li>${icon('target')} ${e(d.prompt)} → <b>${e(d.label)}</b>${d.auto ? ' <span class="chip">instinct</span>' : ''}</li>`);
  for (const a of w.asides ?? []) lines.push(`<li>${icon('clock')} ${e(a.headline)}</li>`);
  const life = Object.entries(w.life ?? {}).filter(([, v]) => Math.abs(v) >= 2).map(([k, v]) => `${METERS[k]?.label ?? k} ${v > 0 ? '+' : ''}${v}`).join(' · ');
  if (life) lines.push(`<li>${icon('users')} ${e(life)}</li>`);
  if (w.money) lines.push(`<li>${icon('wallet')} Month's money: ${w.money.net >= 0 ? '+' : ''}${eur(w.money.net)}</li>`);
  if (w.media?.count) lines.push(`<li>${icon('share')} ${w.media.count} media stories${w.media.top?.[0] ? `: “${e(w.media.top[0])}”` : ''}</li>`);
  for (const n of w.squad ?? []) lines.push(`<li>${icon('swap')} ${e(n)}</li>`);
  return `<ul class="wr">${lines.join('') || '<li class="hint">A quiet week.</li>'}</ul>`;
}

function reportsTab(state, world, h) {
  const view = h.reportView ?? 'week';
  const seg = `<nav class="seg seg-small">${[['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button data-view="${k}" class="${view === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
  if (view === 'month') {
    const keys = monthsAvailable(state);
    if (!keys.length) return seg + '<p class="hint">Play a few weeks: each month gets its own report.</p>';
    const key = keys.includes(h.reportMonth) ? h.reportMonth : keys[0];
    const d = digest(state, key);
    const ms = monthStory(state, d, state.player.jerseyName);
    const inProgress = key === monthKeyOf(state.week) && !state.journal.months.some((m) => m.key === key);
    return `${seg}<label class="month-pick">Month<select id="sel-month">${keys.map((k) => `<option value="${k}" ${k === key ? 'selected' : ''}>${monthLabel(k)}</option>`).join('')}</select></label>
      ${inProgress ? '<p class="hint small">This month is still being played. The report fills in as the weeks go by.</p>' : ''}
      <div class="mgrid"><div><span>Results</span><b>${d.w}-${d.d}-${d.l}</b></div><div><span>Apps</span><b>${d.apps}</b></div><div><span>Goals · assists</span><b>${d.goals} · ${d.assists}</b></div><div><span>Avg rating</span><b>${d.avg ?? '—'}</b></div><div><span>Team xG</span><b>${d.xg} – ${d.xga}</b></div><div><span>Money</span><b>${d.money >= 0 ? '+' : '−'}€${compact(Math.abs(d.money))}</b></div><div><span>Followers</span><b>${d.followersChange >= 0 ? '+' : ''}${compact(d.followersChange)}</b></div><div><span>Media</span><b>${d.mediaCount}</b></div></div>
      <h3>${e(ms.headline)}</h3>${ms.sections.map((s) => fold(`rep-${s.id}`, `${icon(s.icon)} ${e(s.title)}`, s.paras.map((x) => `<p class="rp">${e(x)}</p>`).join(''))).join('')}
      ${d.results?.length ? fold('rep-results', `${icon('ball')} Results`, `<ul class="list">${d.results.map((r) => `<li>${r.home ? 'vs' : '@'} ${e(r.opp)} <b>${r.score}</b> ${r.result} ${r.rating ? `<span class="rating mini ${ratingClass(r.rating)}">${r.rating.toFixed(1)}</span>` : ''}${r.goals ? ` ${r.goals}G` : ''}${r.assists ? ` ${r.assists}A` : ''}</li>`).join('')}</ul>`, { open: false }) : ''}`;
  }
  const weeks = [...(state.journal?.weeks ?? [])].reverse().slice(0, 16);
  return `${seg}${weeks.length ? weeks.map((w, i) => fold(`wk-${i === 0 ? 'latest' : 'older'}`, `<span class="wk">${e(w.date)}</span> ${e(w.headline)}`, weekReport(state, w), { open: i === 0, cls: 'fold-mini' })).join('') : '<p class="hint">Your story starts now. Each week you play is filed here.</p>'}
    ${state.history?.length ? fold('recent-decisions', `${icon('target')} Recent decisions`, `<ul class="list">${state.history.slice(-10).reverse().map((x) => `<li>${e(x)}</li>`).join('')}</ul>`, { open: false }) : ''}`;
}

export function renderWorld(state, world, tab, onTab, h = {}) {
  const body = { circle: circleTab, squad: squadTab, table: tableTab, assets: assetsTab, career: careerTab, reports: reportsTab }[tab] ?? circleTab;
  $('col-world').innerHTML = `<section class="card tabs-card">
    <nav class="tabs">${TABS.map(([k, l, ic]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>
    <div class="tab-body">${body(state, world, h)}</div></section>`;
  const root = $('col-world');
  root.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => onTab(b.dataset.tab)));
  root.querySelectorAll('.prow').forEach((b) => b.addEventListener('click', () => h.onPerson?.(b.dataset.who)));
  root.querySelectorAll('.sq[data-id]').forEach((b) => { const go = () => h.onTeammate?.(b.dataset.id); b.addEventListener('click', go); b.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); }); });
  root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => h.onShopCat?.(b.dataset.cat)));
  root.querySelectorAll('.buy').forEach((b) => b.addEventListener('click', () => {
    const to = root.querySelector(`.gift-to[data-id="${CSS.escape(b.dataset.id)}"]`)?.value ?? 'self';
    h.onBuy?.(b.dataset.id, { amount: b.dataset.amt ? Number(b.dataset.amt) : null, to });
  }));
  root.querySelectorAll('.sell').forEach((b) => b.addEventListener('click', () => h.onSell?.(b.dataset.uid)));
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => h.onReportView?.(b.dataset.view)));
  root.querySelector('#sel-month')?.addEventListener('change', (ev) => h.onReportMonth?.(ev.target.value));
}

// ═══════════════════════════ PEOPLE DIALOG ═══════════════════════════
export function renderPerson(state, person, actions, slots, onAct, onClose) {
  const box = $('person-body');
  box.innerHTML = `<div class="pd-head">${avatarInitials(person.name, person.key)}<div><h2>${e(person.name)}</h2><span class="muted">${e(person.role)}</span></div><button class="btn btn-small pd-x" aria-label="Close">${icon('close')}</button></div>
    ${person.value !== null && person.value !== undefined ? `<div class="pd-bar"><span>${person.key === 'manager' ? 'Trust' : person.key === 'crush' ? 'Chemistry' : 'Closeness'}</span>${bar(person.value, 100, person.value >= 65 ? 'var(--good)' : person.value >= 40 ? 'var(--info)' : person.value >= 25 ? 'var(--warn)' : 'var(--bad)')}<b>${person.value}</b><em>${personWord(person.value)}</em></div>` : ''}
    ${person.facts?.length ? `<ul class="pd-facts">${person.facts.map((f) => `<li>${e(f)}</li>`).join('')}</ul>` : ''}
    <div class="pd-slots">${icon('clock')} ${slots} free-time slot${slots === 1 ? '' : 's'} left this week</div>
    <div class="pd-acts">${actions.length ? actions.map((a) => `<button class="choice pd-act" data-id="${e(a.id)}" ${a.cooling || slots < a.cost ? 'disabled' : ''}>
      <span class="choice-top"><span>${icon(a.icon)} ${e(a.label)}</span><span class="risk risk-${e(a.risk)}">${a.big ? 'big move' : e(a.risk)}</span></span>
      ${a.desc ? `<span class="choice-desc">${e(a.desc)}</span>` : ''}
      ${a.cooling ? `<span class="choice-cons">Not again yet (${a.weeksLeft} week${a.weeksLeft > 1 ? 's' : ''})</span>` : a.hint ? `<span class="choice-cons">${e(a.hint)}</span>` : ''}
    </button>`).join('') : '<p class="hint">Nothing to do with them right now.</p>'}</div>`;
  box.querySelectorAll('.pd-act').forEach((b) => b.addEventListener('click', () => onAct(b.dataset.id)));
  box.querySelector('.pd-x').addEventListener('click', onClose);
}

// ═══════════════════════════ AVATAR EDITOR ═══════════════════════════
export function renderAvatarEditor(el, av, onChange) {
  const sw = (key, list) => `<div class="av-row"><span>${{ skin: 'Skin tone', hairColor: 'Hair colour' }[key]}</span><div class="swatches">${list.map(([v, l]) => `<button type="button" class="sw ${av[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}" title="${e(l)}" style="background:${v}"></button>`).join('')}</div></div>`;
  const pills = (key, list, label) => `<div class="av-row"><span>${label}</span><div class="pills">${list.map(([v, l]) => `<button type="button" class="pill ${av[key] === v ? 'on' : ''}" data-k="${key}" data-v="${v}">${e(l)}</button>`).join('')}</div></div>`;
  const acc = new Set(av.acc ?? []);
  el.innerHTML = `<div class="av-ed"><div class="av-prev">${avatarSvg(av, { size: 120 })}</div><div class="av-opts">
    ${sw('skin', AVATAR_OPTIONS.skin)}${pills('hair', AVATAR_OPTIONS.hair, 'Hair')}${sw('hairColor', AVATAR_OPTIONS.hairColor)}${pills('beard', AVATAR_OPTIONS.beard, 'Facial hair')}
    <div class="av-row"><span>Accessories</span><div class="pills">${AVATAR_OPTIONS.acc.map(([v, l]) => `<button type="button" class="pill ${acc.has(v) ? 'on' : ''}" data-acc="${v}">${e(l)}</button>`).join('')}</div></div>
  </div></div>`;
  el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => onChange({ ...av, [b.dataset.k]: b.dataset.v })));
  el.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => {
    const s = new Set(av.acc ?? []);
    const v = b.dataset.acc;
    if (s.has(v)) s.delete(v); else { s.add(v); if (v === 'cap') { s.delete('headband'); s.delete('bandana'); } if (v === 'bandana') { s.delete('cap'); s.delete('headband'); } if (v === 'headband') { s.delete('cap'); s.delete('bandana'); } if (v === 'shades') s.delete('glasses'); if (v === 'glasses') s.delete('shades'); }
    onChange({ ...av, acc: [...s] });
  }));
}

// ═══════════════════════════ RETIREMENT ═══════════════════════════
export function renderRetirement(state, world) {
  const p = state.player, c = p.career, L = legacy(state), LL = lifeLegacy(state), ep = world ? epilogue(state, world) : [];
  const reason = { retirement: 'Retired', injury: 'Career-ending injury', pfm: 'The body gave out (fitness 0)', age: 'Age 40' }[state.ended.reason] ?? 'Career over';
  $('decisions').innerHTML = '';
  $('actions').innerHTML = '';
  $('planner').innerHTML = `<div class="legacy">
    ${avatarSvg(p.avatar, { size: 84 })}
    <div class="label">${reason} · age ${ageNow(state)}</div>
    <div class="legacy-label">${e(L.label)} · ${e(LL.label)}</div>
    <p class="hint">Football legacy ${L.score} · Life legacy ${LL.score}</p>
    ${ep.length ? `<div class="epilogue"><h3>${icon('clock')} What happened next</h3>${ep.map((x) => `<div class="ep">${icon(x.icon)}<div><b>${e(x.title)}</b><p>${e(x.text)}</p></div></div>`).join('')}</div>` : ''}
    <dl class="kv" style="max-width:360px;margin:16px auto;text-align:left">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals / assists</dt><dd>${c.goals} / ${c.assists}</dd><dt>MOTM awards</dt><dd>${c.motms}</dd>
      <dt>International caps</dt><dd>${p.national.caps} (${p.national.goals} goals)</dd><dt>Trophies</dt><dd>${c.trophies.length}</dd><dt>Awards</dt><dd>${c.awards.length}</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak market value</dt><dd>€${compact(c.peakMarketValue)}</dd><dt>Clubs</dt><dd>${new Set(c.clubHistory.map((x) => x.club)).size}</dd>
      <dt>Net worth</dt><dd>€${compact(netWorth(state))}</dd>
      ${p.life ? `<dt>Family</dt><dd>${meterWord('family', meter(p, 'family'))}</dd><dt>Friends</dt><dd>${meterWord('friends', meter(p, 'friends'))}</dd><dt>Public image</dt><dd>${meterWord('image', meter(p, 'image'))}</dd>` : ''}
    </dl>
    <button id="btn-new-career" class="btn btn-primary">Start a new career</button>
  </div>`;
}
