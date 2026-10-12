// Rendering: turns state + story into HTML.
import { escapeHtml as e, compact, ordinal } from './util.js';
import { EUR_IDR, POSITIONS, STAT_KEYS } from './config.js';
import { overall, statLabel, wealthLevel, scoutEstimate } from './player.js';
import { dateLabel, shortDate, yearOf } from './time.js';
import { standings, nextFixtures } from './season.js';
import { ageNow, currentSeason, legacy, transferOutlook } from './engine.js';
import { activeDeals } from './sponsors.js';
import { lifeLegacy, epilogue } from './epilogue.js';
import { METERS, meter, meterWord, lifeTokens } from './life.js';
import { icon, ASPECT_ICON, ASPECT_LABEL, ARENA_STYLE } from './icons.js';

const $ = (id) => document.getElementById(id);

export function money(state, eur, opts = {}) {
  const sign = eur < 0 ? '-' : '';
  const a = Math.abs(eur);
  const euro = `${sign}€${a >= 1000 ? compact(a) : Math.round(a)}`;
  if (state.player.nationality !== 'Indonesia' || opts.eurOnly) return euro;
  return `${sign}Rp ${compact(a * EUR_IDR)} <span class="muted">(${euro})</span>`;
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
const STAT_ICON = { pace: 'zap', shooting: 'target', passing: 'share', dribbling: 'ball', defending: 'flag', physical: 'dumbbell', mental: 'spark', goalkeeping: 'user' };

// ── Little "what changed" chips: icon, label, ±n, coloured good/bad ──
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
  for (const [k, v] of Object.entries(extra)) if (v > 0) out.push(`<span class="dchip up">${icon('spark')}<span>${e(statLabel(k) ?? k)}</span><b>+${v}</b></span>`);
  return out.length ? `<div class="dchips">${out.join('')}</div>` : '';
}

function ripplesHtml(state, ripples = []) {
  if (!ripples.length) return '';
  return `<ul class="ripples">${ripples.map((r) => `<li>${icon('ripple')}<div><span>${e(r.text)}</span>${changeChips(state, r.changes)}</div></li>`).join('')}</ul>`;
}

// Scouts' view of his ceiling (a range that narrows with age).
function scoutHtml(state) {
  const s = scoutEstimate(state.player, ageNow(state));
  const stars = '★'.repeat(Math.floor(s.stars)) + (s.stars % 1 ? '½' : '');
  return `<div class="scout" title="Scouts' estimate of your ceiling. It narrows as you get older. Disciplined hard work with a clear head can raise it; chaos, burnout and partying lower it.">
    <span>${icon('target')} Potential</span><b>${s.lo}–${s.hi}</b><span class="stars">${stars}</span><em>${e(s.label)}</em></div>`;
}

function sponsorsHtml(state) {
  const deals = activeDeals(state);
  if (!deals.length) return `<p class="hint">${icon('briefcase')} No sponsors yet. Fame, followers and a clean image bring brands; an agent helps.</p>`;
  return `<h3>${icon('briefcase')} Sponsors</h3><ul class="deals">${deals.map((d) => `<li>
    <div class="deal-top"><b>${e(d.brand)}</b><span>${money(state, d.annualValue, { eurOnly: true })}/yr · to ${shortDate(d.expiryWeek)}</span></div>
    ${d.duty ? `<div class="deal-duty">Posts ${d.done?.posts ?? 0}/${d.duty.posts} this month · Appearances ${d.done?.events ?? 0}/${d.duty.events} this year · happiness ${d.sat ?? 65}</div>${bar(d.sat ?? 65, 100, (d.sat ?? 65) >= 55 ? 'var(--good)' : (d.sat ?? 65) >= 30 ? 'var(--warn)' : 'var(--bad)')}` : ''}
  </li>`).join('')}</ul>`;
}

// ═══════════════════════════ LEFT: THE PLAYER ═══════════════════════════
export function renderPlayer(state, world) {
  const p = state.player;
  const changes = state.last?.statChanges ?? {};
  const statsShown = STAT_KEYS.filter((k) => k !== 'goalkeeping' || p.position === 'GK');
  const club = p.club;
  const nt = p.national;
  const ovr = overall(p);
  $('col-player').innerHTML = `
    <section class="card player-card">
      <div class="pc-head">
        <div class="pc-shirt">${icon('shirt')}<span>${p.number}</span></div>
        <div class="pc-id">
          <div class="pc-name">${e(p.name)}${p.nickname ? ` <span class="muted">"${e(p.nickname)}"</span>` : ''}</div>
          <div class="pc-sub">${p.flag} ${e(p.nationality)} · ${POSITIONS[p.position].name}</div>
          <div class="pc-sub">${club ? `${e(club.name)}${club.loan ? ' <span class="chip chip-accent">loan</span>' : ''}` : '<b>Free agent</b>'} · Age ${ageNow(state)}</div>
        </div>
        <div class="ovr-ring" style="--p:${ovr}"><b>${ovr}</b><span>OVR</span></div>
      </div>
      <div class="chips">
        <span class="chip ${roleChip[p.squadRole]}">${e(p.squadRole)}</span>
        <span class="chip">${icon('smile')} ${e(p.mood)}</span>
        ${p.injury ? `<span class="chip chip-bad">${icon('bandage')} ${p.injury.weeksLeft}w out</span>` : ''}
        ${p.suspension ? `<span class="chip chip-bad">Suspended</span>` : ''}
        ${p.transferListed ? `<span class="chip chip-warn">Transfer listed</span>` : ''}
      </div>
      ${scoutHtml(state)}
      <h3>${icon('spark')} Attributes</h3>
      ${statsShown.map((k) => `<div class="stat"><span>${icon(STAT_ICON[k])}${statLabel(k)}</span>${bar(p.stats[k], 99, statColor(p.stats[k]))}<span class="v ${changes[k] > 0 ? 'up' : ''}">${p.stats[k]}${changes[k] > 0 ? '▲' : changes[k] < 0 ? '▼' : ''}</span></div>`).join('')}
      <h3>${icon('pulse')} Condition</h3>
      <div class="stat" title="Performance Fitness Meter. The red line is your body's ceiling — it falls with age from 33."><span>${icon('pulse')}Fitness</span>${bar(p.pfm, 100, p.pfm < 50 ? 'var(--bad)' : 'var(--good)', p.pfmCeiling < 100 ? p.pfmCeiling : null)}<span class="v">${Math.round(p.pfm)}</span></div>
      <div class="stat" title="Average of recent match ratings"><span>${icon('chart')}Form</span>${bar(p.form - 4, 6, p.form >= 7 ? 'var(--good)' : p.form < 6.2 ? 'var(--bad)' : 'var(--info)')}<span class="v">${p.form.toFixed(1)}</span></div>
      ${p.life ? ['morale', 'stress'].map((k) => `<div class="stat" title="${e(METERS[k].tip)}"><span>${icon(METERS[k].icon)}${METERS[k].label}</span>${bar(meter(p, k), 100, meterColor(k, meter(p, k)))}<span class="v">${meter(p, k)}</span></div>`).join('') : ''}
      <div class="stat" title="Global recognition"><span>${icon('star')}Fame</span>${bar(p.reputation, 100, 'var(--accent)')}<span class="v">${Math.round(p.reputation)}</span></div>
    </section>
    <section class="card">
      <h3 class="first">${icon('wallet')} Money & market</h3>
      <dl class="kv">
        <dt>Savings</dt><dd>${money(state, p.wealthEUR)}</dd>
        <dt>Status</dt><dd>${wealthLevel(p.wealthEUR)}</dd>
        <dt>Wage</dt><dd>${club ? `${money(state, club.wageWeekly, { eurOnly: true })}/wk` : '—'}</dd>
        <dt>Contract</dt><dd>${club ? (club.loan ? `Loan to ${shortDate(club.loan.untilWeek)}` : `to ${shortDate(club.contractEndWeek)}`) : '—'}</dd>
        <dt>Market value</dt><dd>€${compact(p.marketValue)}</dd>
        <dt>Followers</dt><dd>${compact(p.followers)}</dd>
        <dt>Lifestyle</dt><dd>${p.lifestyle <= 0.8 ? 'Frugal' : p.lifestyle <= 1.2 ? 'Normal' : p.lifestyle <= 1.8 ? 'Comfortable' : 'Lavish'}</dd>
      </dl>
      ${sponsorsHtml(state)}
      <h3>${icon('flag')} National team</h3>
      <dl class="kv">
        <dt>Status</dt><dd>${nt.status === 'none' ? 'Not selected' : nt.status}${nt.team !== 'none' ? ` · ${nt.team}` : ''}</dd>
        <dt>Senior caps</dt><dd>${nt.caps} (${nt.goals} goals)</dd>
        <dt>Youth caps</dt><dd>${nt.youthCaps}</dd>
      </dl>
    </section>`;
}

// ═══════════════════════════ TOP BAR ═══════════════════════════
export function renderTopbar(state) {
  const p = state.player;
  $('top-date').innerHTML = `${icon('calendar')} ${dateLabel(state.week)} <span class="muted">· ${e(p.jerseyName)}, ${ageNow(state)}</span>`;
  $('top-meters').innerHTML = p.life ? ['morale', 'stress'].map((k) => `<span class="tm" title="${e(METERS[k].tip)}">${icon(METERS[k].icon)}<i style="--w:${meter(p, k)}%;--c:${meterColor(k, meter(p, k))}"></i></span>`).join('') + `<span class="tm" title="Fitness">${icon('pulse')}<i style="--w:${Math.round(p.pfm)}%;--c:${p.pfm < 50 ? 'var(--bad)' : 'var(--good)'}"></i></span>` : '';
}

// ═══════════════════════════ CENTRE: THE WEEK ═══════════════════════════
function ratingClass(r) { return r >= 8 ? 'r-great' : r >= 7.1 ? 'r-good' : r >= 6.5 ? 'r-ok' : r >= 5.6 ? 'r-mid' : 'r-bad'; }

function matchBox(m, J) {
  const home = m.home ? m.club : m.opp, away = m.home ? m.opp : m.club;
  const mine = (n) => (n === m.club ? 'mine' : '');
  const player = m.minutes > 0
    ? `<span class="rating ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span><span class="chip">${icon('clock')} ${m.minutes}'</span>${m.goals ? `<span class="chip chip-good">${icon('ball')} ${m.goals}</span>` : ''}${m.assists ? `<span class="chip chip-accent">${icon('share')} ${m.assists}</span>` : ''}${m.motm ? `<span class="chip chip-accent">${icon('star')} MOTM</span>` : ''}${m.red ? '<span class="chip chip-bad">🟥</span>' : m.yellow ? '<span class="chip chip-warn">🟨</span>' : ''}${m.keyMoment ? `<span class="chip">${icon('target')} key moment</span>` : ''}`
    : `<span class="chip">${m.reason === 'injured' ? 'Injured' : m.reason === 'suspended' ? 'Suspended' : 'Did not play'}</span>`;
  return `<div class="match res-${m.result}">
    <div class="match-comp">${icon(m.international ? 'flag' : 'ball')} ${e(m.competition)}${m.round && !m.international ? ` · ${e(m.round)}` : ''}</div>
    <div class="match-score"><span class="home ${mine(home)}">${e(home)}</span><span class="sc">${m.hs}–${m.as}</span><span class="${mine(away)}">${e(away)}</span></div>
    ${m.penalties ? `<div class="hint">Penalties: ${m.penalties}</div>` : ''}
    <div class="match-player"><b>${e(J)}</b> ${player}</div>
  </div>`;
}

function outcomeCard(state, o) {
  const arena = o.kind === 'offer' || o.kind === 'renewal' ? 'transfer' : o.moment ? 'match' : (CAT_TO_ARENA[o.cat] ?? 'football');
  const st = ARENA_STYLE[arena] ?? ARENA_STYLE.football;
  return `<div class="outcome" style="--ac:${st.color}">
    <div class="outcome-head">${icon(st.icon)}<span>You chose <b>${e(o.label)}</b></span></div>
    ${o.text ? `<p>${e(o.text)}</p>` : ''}
    ${changeChips(state, o.changes)}
    ${ripplesHtml(state, o.ripples)}
  </div>`;
}
const CAT_TO_ARENA = { training: 'football', manager: 'football', dressing: 'football', body: 'football', national: 'football', milestone: 'football', veteran: 'football', media: 'media', love: 'love', friends: 'friends', family: 'family', culture: 'family', money: 'lifestyle', lifestyle: 'lifestyle', politics: 'politics', transfer: 'transfer', 'in-match': 'match', tactical: 'football', personal: 'football' };

// Your social post, as it would look on the app, with likes and comments.
function postCard(state, a) {
  const x = a.post, p = state.player;
  return `<div class="aside aside-post card-in">
    <div class="aside-head">${icon('camera')}<span>You posted on ${e(x.platform)}</span><span class="aside-tag">${icon('clock')} time didn't move</span></div>
    <div class="igpost">
      <div class="ig-top"><span class="pav" style="background:#c6f432">${e(p.jerseyName[0])}</span><b>${e(p.jerseyName.toLowerCase())}</b>${p.social?.verified ? `<span class="verified">${icon('check')}</span>` : ''}<span class="muted">· ${e(x.label)}</span></div>
      <p class="ig-cap">${e(x.caption)}</p>
      <div class="ig-meta">${icon('heart')} ${compact(x.likes)} likes · +${compact(Math.max(0, x.gained))} followers${x.viral ? ' · <b class="viral">VIRAL</b>' : ''} · <span class="${x.positive ? 'up' : 'down'}">${x.positive ? 'mostly loved' : 'mostly negative'}</span></div>
      <ul class="ig-comments">${x.comments.map((c) => `<li><b>${e(c.handle)}</b> ${e(c.text)}</li>`).join('')}</ul>
    </div>
    ${changeChips(state, a.changes, a.stats)}
    ${ripplesHtml(state, a.ripples)}
    ${a.milestones?.length ? `<p class="hint">${icon('star')} Milestone: ${a.milestones.map(e).join(', ')}</p>` : ''}
  </div>`;
}

export function asideCard(state, a) {
  if (!a) return '';
  if (a.kind === 'post') return postCard(state, a);
  return `<div class="aside card-in">
    <div class="aside-head">${icon(a.kind === 'free' ? (a.icon ?? 'clock') : 'pause')}<span>${a.kind === 'free' ? 'Free time' : `Meanwhile · ${e(a.time ?? '')}`}</span><span class="aside-tag">${icon('clock')} time didn't move</span></div>
    <h4>${e(a.headline)}</h4>
    ${a.label ? `<div class="aside-choice">You chose <b>${e(a.label)}</b></div>` : ''}
    ${a.text ? `<p>${e(a.text)}</p>` : ''}
    ${changeChips(state, a.changes, a.stats)}
    ${ripplesHtml(state, a.ripples)}
  </div>`;
}

export function renderWeek(state, world, story) {
  const p = state.player;
  const res = state.last;
  const wk = res ? res.week : state.week;
  let html = asideCard(state, state.lastAside);
  html += `<div class="week-meta">
      <span>${icon('calendar')} ${dateLabel(wk)}</span><span>Age ${res?.age ?? ageNow(state)}</span>
      ${story?.eventType ? `<span class="chip">${e(story.eventType)}</span>` : ''}
      ${story?.isMajorEvent ? `<span class="chip chip-accent">${icon('star')} Major</span>` : ''}
    </div>`;
  html += `<h1 class="headline">${e(story?.headline ?? '')}</h1>`;
  if (story?.dek) html += `<p class="dek">${e(story.dek)}</p>`;
  const outs = (res?.outcomes ?? []).filter((o) => o.text || o.ripples?.length);
  if (outs.length) html += `<section class="consequences"><h2 class="sec-title">${icon('ripple')} What your choices caused</h2>${outs.map((o) => outcomeCard(state, o)).join('')}</section>`;
  if (res?.ripples?.length && !outs.length) html += ripplesHtml(state, res.ripples);
  for (const m of [...(res?.matches ?? []), ...(res?.intl ?? [])]) html += matchBox(m, p.jerseyName);
  const sections = story?.sections ?? [{ id: 'p', icon: 'spark', title: '', paras: story?.paragraphs ?? [] }];
  html += `<div class="narrative">${sections.map((s, i) => `<section class="story-sec sec-${e(s.id)}">${s.title && i > 0 ? `<h3 class="story-h">${icon(s.icon)} ${e(s.title)}</h3>` : ''}${s.paras.map((x) => `<p>${e(x)}</p>`).join('')}</section>`).join('')}</div>`;
  if (story?.clippings?.length) html += `<section class="clippings"><h2 class="sec-title">${icon('newspaper')} In the papers</h2><div class="clip-grid">${story.clippings.map((c) => `<div class="clip tone-${e(c.tone)}"><span class="clip-outlet">${e(c.outlet)}</span><span class="clip-head">${e(c.headline)}</span></div>`).join('')}</div></section>`;
  if (story?.messages?.length) html += `<section class="phone-msgs"><h2 class="sec-title">${icon('phone')} Messages</h2>${story.messages.map((m) => `<div class="msg"><span class="msg-from">${icon(m.icon)} ${e(m.from)}</span><span class="bubble">${e(m.text)}</span></div>`).join('')}</section>`;
  if (res?.seasonEnd) {
    const s = res.seasonEnd;
    html += `<div class="box">${icon('trophy')}<div><h4>Season ${e(s.label)} review</h4>${e(s.league)}: ${ordinal(s.pos)} of ${s.teams}${s.movement ? ` · <b>${s.movement}</b>` : ''} · Champions: ${e(s.champion)}<br>${s.apps} apps · ${s.goals} goals · ${s.assists} assists · ${s.motms} MOTM${s.avgRating ? ` · avg ${s.avgRating}` : ''}${s.awards.length ? `<br>🏅 ${s.awards.map(e).join(' · ')}` : ''}</div></div>`;
  }
  if (res?.trophies?.length) html += `<div class="box box-gold">${icon('trophy')}<div><h4>Trophy</h4>${res.trophies.map(e).join(' · ')}</div></div>`;
  if (res?.money) html += `<div class="box ${res.money.net < 0 ? 'box-bad' : ''}">${icon('wallet')}<div><h4>Monthly finances</h4>Income ${money(state, res.money.gross, { eurOnly: true })} · Tax ${money(state, res.money.tax, { eurOnly: true })}${res.money.agentFee ? ` · Agent ${money(state, res.money.agentFee, { eurOnly: true })}` : ''} · Living ${money(state, res.money.living, { eurOnly: true })}${res.money.family ? ` · Family ${money(state, res.money.family, { eurOnly: true })}` : ''}${res.money.interest ? ` · Interest ${money(state, res.money.interest, { eurOnly: true })}` : ''} → <b>${res.money.net >= 0 ? '+' : ''}${money(state, res.money.net)}</b></div></div>`;
  $('week-card').innerHTML = html;
}

// ═══════════════════════════ DECISIONS ═══════════════════════════
function arenaOf(d) {
  if (d.kind === 'offer' || d.kind === 'renewal') return 'transfer';
  if (d.type === 'in-match') return 'match';
  return d.arena ?? CAT_TO_ARENA[d.cat ?? d.type] ?? 'football';
}
const UI_ICON = { phone: 'phone', press: 'mic', social: 'camera', boardroom: 'building', letter: 'letter' };

export function renderDecisions(state, onChoose) {
  const box = $('decisions');
  const open = state.pending.filter((d) => !d.chosen).length;
  box.innerHTML = state.pending.length ? `<div class="dec-head"><h2>${icon('target')} Decisions this week</h2><span class="hint">${open ? `${open} to answer` : 'All answered — play the week'}</span></div>` + state.pending.map((d) => {
    const st = ARENA_STYLE[arenaOf(d)] ?? ARENA_STYLE.football;
    return `
    <div class="card decision ui-${e(d.ui ?? 'plain')} ${d.chosen ? 'is-done' : ''}" data-id="${d.id}" style="--ac:${st.color}">
      <div class="dec-top"><span class="arena">${icon(st.icon)} ${st.label}</span>${d.ui ? `<span class="arena-ui">${icon(UI_ICON[d.ui] ?? 'spark')}</span>` : ''}${d.chosen ? `<span class="done">${icon('check')}</span>` : ''}</div>
      ${d.headline ? `<h3 class="dec-title">${e(d.headline)}</h3>` : ''}
      ${d.scene ? `<p class="scene">${e(d.scene)}</p>` : ''}
      <div class="decision-prompt">${e(d.prompt)}</div>
      <div class="choices">${d.choices.map((c) => `
        <button class="choice ${d.chosen === c.id ? 'selected' : ''}" data-choice="${e(c.id)}">
          <span class="choice-top"><span>${e(c.label)}</span><span class="risk risk-${e(c.risk ?? 'medium')}">${e(c.risk ?? 'medium')}</span></span>
          ${c.description ? `<span class="choice-desc">${e(c.description)}</span>` : ''}
          ${c.consequence ? `<span class="choice-cons">${e(c.consequence)}</span>` : ''}
          ${c.aspects?.length ? `<span class="aspects">${c.aspects.map((a) => `<span title="Can affect: ${e(ASPECT_LABEL[a] ?? a)}">${icon(ASPECT_ICON[a] ?? 'spark')}</span>`).join('')}</span>` : ''}
        </button>`).join('')}</div>
    </div>`;
  }).join('') : '';
  box.querySelectorAll('.decision').forEach((el) => el.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => onChoose(el.dataset.id, btn.dataset.choice))));
}

// ═══════════════════════════ FREE TIME ═══════════════════════════
export function renderFreeTime(state, options, left, onAction) {
  const el = $('freetime');
  if (state.ended) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="ft-head"><h2>${icon('clock')} Free time</h2><span class="ft-left">${Array.from({ length: Math.max(left, 0) }, () => '<i></i>').join('')}<span class="hint">${left} left this week · doesn't move time</span></span></div>
    <div class="ft-grid">${options.map((a) => `<button class="ft" data-id="${e(a.id)}" ${a.done || left <= 0 ? 'disabled' : ''}>${icon(a.icon)}<span class="ft-label">${e(a.label)}</span><span class="ft-desc">${e(a.desc)}</span>${a.done ? `<span class="ft-done">${icon('check')}</span>` : ''}</button>`).join('')}</div>`;
  el.querySelectorAll('.ft').forEach((b) => b.addEventListener('click', () => onAction(b.dataset.id)));
}

// ═══════════════════════════ SOCIAL MEDIA ═══════════════════════════
export function renderSocial(state, options, canPost, onPost) {
  const el = $('social');
  const p = state.player;
  if (state.ended) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="ft-head"><h2>${icon('camera')} Social media</h2><span class="hint">${compact(p.followers)} followers${p.social?.verified ? ' · verified' : ''} · ${canPost ? "1 post this week · doesn't move time" : 'Posted this week'}</span></div>
    ${canPost ? `<div class="ft-grid post-grid">${options.map((o) => `<button class="ft post-btn" data-key="${e(o.key)}">${icon(o.icon)}<span class="ft-label">${e(o.label)}</span><span class="ft-desc">${e(o.desc)}</span></button>`).join('')}</div>`
    : '<p class="hint">Your next post is available next week. Posting every single week slowly wears out your audience; timing matters more than volume.</p>'}`;
  el.querySelectorAll('.post-btn').forEach((b) => b.addEventListener('click', () => onPost(b.dataset.key)));
}

// ═══════════════════════════ PLANNER ═══════════════════════════
export function renderPlanner(state, plan, onChange, onPlay) {
  const p = state.player;
  const season = currentSeason(state);
  const fix = season && p.club ? nextFixtures(season, p.club.name, state.week, 1)[0] : null;
  const cupRound = state.cup?.alive ? state.cup.rounds.find((r) => r.week >= state.week) : null;
  const unanswered = state.pending.filter((d) => !d.chosen).length;
  const opts = [['hard', 'Train hard', 'dumbbell', 'More growth, −3 fitness, more stress and injury risk'], ['balanced', 'Balanced', 'target', 'Steady work, −1 fitness'], ['light', 'Light', 'pulse', 'Recover a little, +3 fitness, less stress'], ['rest', 'Rest', 'bed', 'No growth, +7 fitness, much less stress']];
  const relevant = Object.keys(POSITIONS[p.position].weights);
  $('planner').innerHTML = `
    <h2>${icon('calendar')} Your week ahead</h2>
    ${p.injury ? `<p class="hint">${icon('bandage')} Injured: rehab replaces training (${p.injury.weeksLeft} week${p.injury.weeksLeft > 1 ? 's' : ''} left).</p>` : `
    <div class="seg" id="seg-plan">${opts.map(([k, l, ic, t]) => `<button type="button" data-k="${k}" title="${t}" class="${plan.intensity === k ? 'on' : ''}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>
    <div class="planner-row">
      <label>Training focus<select id="sel-focus"><option value="auto">Automatic (best for position)</option>${relevant.map((k) => `<option value="${k}" ${plan.focus === k ? 'selected' : ''}>${statLabel(k)}</option>`).join('')}</select></label>
      <span class="hint">${opts.find((o) => o[0] === plan.intensity)?.[3] ?? ''}</span>
    </div>`}
    <div class="play-row">
      <div class="next-fix">${icon('ball')} ${fix ? `Next: ${fix.week === state.week ? '<b>this week</b>' : shortDate(fix.week)} · ${fix.home ? 'vs' : '@'} ${e(fix.opp)}` : p.club ? 'No league match scheduled' : 'Free agent — waiting for offers'}${cupRound && cupRound.week === state.week ? ` · <b>${e(state.cup.name)} ${e(cupRound.name)}</b>` : ''}</div>
      <button id="btn-play" class="btn btn-primary btn-play" ${unanswered ? 'disabled' : ''}>${unanswered ? `Answer ${unanswered} decision${unanswered > 1 ? 's' : ''} first` : `Play week ${state.week + 1} ${icon('play')}`}</button>
    </div>`;
  $('planner').querySelectorAll('#seg-plan button').forEach((b) => b.addEventListener('click', () => onChange({ ...plan, intensity: b.dataset.k })));
  $('sel-focus')?.addEventListener('change', (ev) => onChange({ ...plan, focus: ev.target.value }));
  $('btn-play').addEventListener('click', onPlay);
}

// ═══════════════════════════ INTERLUDE (time stands still) ═══════════════════════════
export function renderInterlude(state, it, onChoose) {
  $('interlude-body').innerHTML = `
    <div class="il-top">${icon('pause')}<span>Meanwhile · ${e(it.time)}</span><span class="aside-tag">${icon('clock')} time stands still</span></div>
    <h2 class="il-title">${e(it.headline)}</h2>
    <p class="il-text">${e(it.text)}</p>
    <div class="choices">${it.choices.map((c) => `
      <button class="choice" data-choice="${e(c.id)}">
        <span class="choice-top"><span>${e(c.label)}</span>${c.risk ? `<span class="risk risk-${e(c.risk)}">${e(c.risk)}</span>` : ''}</span>
        ${c.description ? `<span class="choice-desc">${e(c.description)}</span>` : ''}
        ${c.consequence ? `<span class="choice-cons">${e(c.consequence)}</span>` : ''}
        ${c.aspects?.length ? `<span class="aspects">${c.aspects.map((a) => `<span title="Can affect: ${e(ASPECT_LABEL[a] ?? a)}">${icon(ASPECT_ICON[a] ?? 'spark')}</span>`).join('')}</span>` : ''}
      </button>`).join('')}</div>`;
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

// ═══════════════════════════ FEED ═══════════════════════════
const AVATAR_COLORS = ['#c6f432', '#5aa9ff', '#3ddc97', '#ffb547', '#ff8fa3', '#b69cff'];
export function renderFeed(story) {
  const posts = story?.socialFeed ?? [];
  $('feed').innerHTML = `<h2>${icon('share')} Feed</h2>` + (posts.length ? posts.map((x, i) => `
    <div class="post">
      <div class="avatar" style="background:${AVATAR_COLORS[(x.handle?.length ?? i) % AVATAR_COLORS.length]}">${e((x.displayName ?? '?')[0])}</div>
      <div>
        <div><span class="post-name">${e(x.displayName)}</span> ${x.verified ? `<span class="verified">${icon('check')}</span>` : ''} <span class="post-handle">${e(x.handle)}</span></div>
        <div class="post-text">${e(x.text)}</div>
        <div class="post-meta">${x.platform === 'instagram' ? `${icon('camera')} Instagram` : '𝕏'} · ${icon('heart')} ${compact(Number(x.likes) || 0)}</div>
      </div>
    </div>`).join('') : '<p class="hint">Nothing yet.</p>');
}

// ═══════════════════════════ RIGHT: TABS ═══════════════════════════
const TABS = [['circle', 'Circle', 'users'], ['table', 'Table', 'table'], ['career', 'Career', 'trophy'], ['log', 'Log', 'list']];

function avatar(name, color) {
  const ini = String(name ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('');
  return `<span class="pav" style="background:${color}">${e(ini)}</span>`;
}

function circleTab(state) {
  const p = state.player;
  if (!p.life) return '<p class="hint">Start a new career to meet your circle.</p>';
  const t = lifeTokens(state);
  const groups = [['club', 'At the club', 'building'], ['public', 'In public', 'newspaper'], ['private', 'Private life', 'heart'], ['self', 'You', 'user']];
  let html = '';
  for (const [g, title, ic] of groups) {
    const keys = Object.keys(METERS).filter((k) => METERS[k].group === g && meter(p, k) !== null);
    if (!keys.length) continue;
    html += `<h3>${icon(ic)} ${title}</h3>` + keys.map((k) => {
      const v = meter(p, k);
      const d = state.last?.life?.[k];
      return `<div class="meter" title="${e(METERS[k].tip)}"><span class="m-l">${icon(METERS[k].icon)}${METERS[k].label}</span>${bar(v, 100, meterColor(k, v))}<span class="m-v">${v}${d ? `<em class="${(k === 'stress' ? d < 0 : d > 0) ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</em>` : ''}</span><span class="m-w">${meterWord(k, v)}</span></div>`;
    }).join('');
  }
  const people = [
    [p.manager.name, 'Manager', 'whistle', AVATAR_COLORS[1]],
    p.circle?.captain ? [p.circle.captain, 'Captain', 'users', AVATAR_COLORS[2]] : null,
    p.circle?.president ? [p.circle.president, 'President', 'building', AVATAR_COLORS[4]] : null,
    p.circle?.journalist ? [p.circle.journalist.name, `Journalist · ${p.circle.journalist.outlet}`, 'newspaper', AVATAR_COLORS[5]] : null,
    p.partner.status !== 'none' ? [p.partner.name, `Partner · ${p.partner.status}`, 'heart', AVATAR_COLORS[4]] : null,
    [`${t.MUM} & ${t.DAD}`, 'Parents', 'home', AVATAR_COLORS[3]],
    [t.SIB, `${t.SIBr[0].toUpperCase()}${t.SIBr.slice(1)} · ${t.SIBage}`, "home", AVATAR_COLORS[3]],
    p.circle?.bestFriend ? [p.circle.bestFriend.name, `Best friend · ${p.circle.bestFriend.job}`, 'friends', AVATAR_COLORS[0]] : null,
    p.agent ? [p.agent.name, `Agent · ${p.agent.cut}%`, 'briefcase', AVATAR_COLORS[1]] : null,
    ...p.keyTeammates.map((tm) => [tm.name, `Teammate · ${tm.relationship}`, 'users', tm.relationship === 'ally' ? 'var(--good)' : ['rival', 'enemy'].includes(tm.relationship) ? 'var(--bad)' : AVATAR_COLORS[1]]),
  ].filter(Boolean);
  html += `<h3>${icon('user')} People</h3><ul class="people">${people.map(([n, role, ic, col]) => `<li>${avatar(n, col)}<div><b>${e(n)}</b><span>${icon(ic)} ${e(role)}</span></div></li>`).join('')}</ul>`;
  return html;
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
  html += `<h3>${icon('calendar')} Fixtures</h3><ul class="list">${fx.map((f) => `<li><span class="wk">${shortDate(f.week)}</span>${f.home ? 'vs' : '@'} ${e(f.opp)}</li>`).join('') || '<li class="hint">None scheduled</li>'}
    ${state.cup ? `<li><span class="wk">${e(state.cup.name)}</span>${state.cup.alive ? `Next: ${e(state.cup.rounds.find((r) => r.week >= state.week)?.name ?? '—')}` : state.cup.results.at(-1)?.result === 'W' ? '🏆 Winners' : `Out (${e(state.cup.results.at(-1)?.round ?? '')})`}</li>` : ''}</ul>`;
  return html;
}

function careerTab(state, world) {
  const p = state.player, c = p.career;
  const t = transferOutlook(state, world);
  const cls = { '+': 'up', '-': 'down', tip: 'tip', i: 'info' };
  return `<h3 class="first">${icon('map')} Transfer outlook</h3>
    <div class="outlook"><div><span>Offers</span><b>${t.weekly >= 0.2 ? 'Likely' : t.weekly >= 0.07 ? 'Possible' : 'Unlikely'}</b></div><div><span>From abroad</span><b>${Math.round(t.abroad * 100)}%</b></div><div><span>Window</span><b>${t.windowNow ? 'Open' : 'Closed'}</b></div></div>
    <ul class="notes">${t.notes.map(([k, n]) => `<li class="n-${cls[k]}">${e(n)}</li>`).join('')}</ul>
    <h3>${icon('trophy')} Record</h3>
    <dl class="kv">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals</dt><dd>${c.goals}</dd><dt>Assists</dt><dd>${c.assists}</dd><dt>Man of the Match</dt><dd>${c.motms}</dd>
      <dt>This season</dt><dd>${p.season.apps} apps · ${p.season.goals} G · ${p.season.assists} A</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak value</dt><dd>€${compact(c.peakMarketValue)}</dd>
    </dl>
    ${c.trophies.length ? `<h3>${icon('trophy')} Trophies</h3><ul class="list">${c.trophies.map((t) => `<li>🏆 ${e(t)}</li>`).join('')}</ul>` : ''}
    ${c.awards.length ? `<h3>${icon('star')} Awards</h3><ul class="list">${c.awards.map((t) => `<li>🏅 ${e(t)}</li>`).join('')}</ul>` : ''}
    <h3>${icon('shirt')} Clubs</h3><ul class="list">${c.clubHistory.map((h) => `<li>${e(h.club)}${h.type === 'loan' ? ' (loan)' : ''} <span class="muted">· ${yearOf(h.from)}–${h.to !== null ? yearOf(h.to) : 'now'} · ${h.apps} apps, ${h.goals} G</span></li>`).join('')}</ul>`;
}

function logTab(state) {
  return `<ul class="list">${state.log.slice(-25).reverse().map((l) => `<li><span class="wk">Wk ${l.week + 1}</span>${e(l.headline)}</li>`).join('') || '<li class="hint">Your story starts now.</li>'}</ul>
    ${state.history?.length ? `<h3>${icon('target')} Recent decisions</h3><ul class="list">${state.history.slice(-10).reverse().map((h) => `<li>${e(h)}</li>`).join('')}</ul>` : ''}`;
}

export function renderWorld(state, world, tab, onTab) {
  const body = { circle: circleTab, table: tableTab, career: (s) => careerTab(s, world), log: logTab }[tab] ?? circleTab;
  $('col-world').innerHTML = `<section class="card tabs-card">
    <nav class="tabs">${TABS.map(([k, l, ic]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>
    <div class="tab-body">${body(state)}</div></section>`;
  $('col-world').querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => onTab(b.dataset.tab)));
}

// ═══════════════════════════ RETIREMENT ═══════════════════════════
export function renderRetirement(state, world) {
  const p = state.player, c = p.career, L = legacy(state), LL = lifeLegacy(state), ep = world ? epilogue(state, world) : [];
  const reason = { retirement: 'Retired', injury: 'Career-ending injury', pfm: 'The body gave out (fitness 0)', age: 'Age 40' }[state.ended.reason] ?? 'Career over';
  $('decisions').innerHTML = '';
  $('freetime').innerHTML = '';
  $('social').innerHTML = '';
  $('planner').innerHTML = `<div class="legacy">
    ${icon('trophy', 'big')}
    <div class="label">${reason} · age ${ageNow(state)}</div>
    <div class="legacy-label">${e(L.label)} · ${e(LL.label)}</div>
    <p class="hint">Football legacy ${L.score} · Life legacy ${LL.score}</p>
    ${ep.length ? `<div class="epilogue"><h3>${icon('clock')} What happened next</h3>${ep.map((x) => `<div class="ep">${icon(x.icon)}<div><b>${e(x.title)}</b><p>${e(x.text)}</p></div></div>`).join('')}</div>` : ''}
    <dl class="kv" style="max-width:360px;margin:16px auto;text-align:left">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals / assists</dt><dd>${c.goals} / ${c.assists}</dd><dt>MOTM awards</dt><dd>${c.motms}</dd>
      <dt>International caps</dt><dd>${p.national.caps} (${p.national.goals} goals)</dd><dt>Trophies</dt><dd>${c.trophies.length}</dd><dt>Awards</dt><dd>${c.awards.length}</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak market value</dt><dd>€${compact(c.peakMarketValue)}</dd><dt>Clubs</dt><dd>${new Set(c.clubHistory.map((h) => h.club)).size}</dd>
      ${p.life ? `<dt>Family</dt><dd>${meterWord('family', meter(p, 'family'))}</dd><dt>Friends</dt><dd>${meterWord('friends', meter(p, 'friends'))}</dd><dt>Public image</dt><dd>${meterWord('image', meter(p, 'image'))}</dd>` : ''}
    </dl>
    <button id="btn-new-career" class="btn btn-primary">Start a new career</button>
  </div>`;
}
