// Rendering: turns state + story into HTML.
import { escapeHtml as e, compact, ordinal } from './util.js';
import { EUR_IDR, POSITIONS, STAT_KEYS } from './config.js';
import { overall, statLabel, wealthLevel } from './player.js';
import { dateLabel, shortDate, yearOf } from './time.js';
import { standings, nextFixtures } from './season.js';
import { ageNow, currentSeason, legacy } from './engine.js';

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
const roleChip = { starter: 'chip-good', rotation: 'chip-accent', bench: 'chip-warn', outcast: 'chip-bad' };

export function renderPlayer(state, world, story) {
  const p = state.player;
  const changes = state.last?.statChanges ?? {};
  const statsShown = STAT_KEYS.filter((k) => k !== 'goalkeeping' || p.position === 'GK');
  const club = p.club;
  const nt = p.national;
  $('col-player').innerHTML = `
    <section class="card">
      <div class="pc-head">
        <div class="pc-number">${p.number}</div>
        <div>
          <div class="pc-name">${e(p.name)}${p.nickname ? ` <span class="muted">"${e(p.nickname)}"</span>` : ''}</div>
          <div class="pc-sub">${p.flag} ${e(p.nationality)} · ${POSITIONS[p.position].name} · Age ${ageNow(state)}</div>
          <div class="pc-sub">${club ? `${e(club.name)}${club.loan ? ' <span class="chip chip-accent">loan</span>' : ''}` : '<b>Free agent</b>'}</div>
        </div>
      </div>
      <div class="ovr"><b>${overall(p)}</b><span class="muted">overall</span></div>
      <div class="chips">
        <span class="chip ${roleChip[p.squadRole]}">${p.squadRole}</span>
        <span class="chip">${e(p.mood)}</span>
        ${p.injury ? `<span class="chip chip-bad">🩹 ${p.injury.weeksLeft}w out</span>` : ''}
        ${p.suspension ? `<span class="chip chip-bad">Suspended</span>` : ''}
        ${p.transferListed ? `<span class="chip chip-warn">Transfer listed</span>` : ''}
      </div>
      <h3>Attributes</h3>
      ${statsShown.map((k) => `<div class="stat"><span>${statLabel(k)}</span>${bar(p.stats[k], 99, statColor(p.stats[k]))}<span class="v ${changes[k] > 0 ? 'up' : ''}">${p.stats[k]}${changes[k] > 0 ? '▲' : changes[k] < 0 ? '▼' : ''}</span></div>`).join('')}
      <h3>Condition</h3>
      <div class="stat" title="Performance Fitness Meter. The red line is your body's ceiling — it falls with age from 33."><span>PFM</span>${bar(p.pfm, 100, p.pfm < 50 ? 'var(--bad)' : 'var(--good)', p.pfmCeiling < 100 ? p.pfmCeiling : null)}<span class="v">${Math.round(p.pfm)}</span></div>
      <div class="stat" title="Average of recent match ratings"><span>Form</span>${bar(p.form - 4, 6, p.form >= 7 ? 'var(--good)' : p.form < 6.2 ? 'var(--bad)' : 'var(--info)')}<span class="v">${p.form.toFixed(1)}</span></div>
      <div class="stat" title="Manager: ${e(p.manager.name)}"><span>Trust</span>${bar(p.manager.trust, 100, p.manager.trust >= 60 ? 'var(--good)' : p.manager.trust < 30 ? 'var(--bad)' : 'var(--warn)')}<span class="v">${p.manager.trust}</span></div>
      <div class="stat" title="Global recognition"><span>Reputation</span>${bar(p.reputation, 100, 'var(--accent)')}<span class="v">${Math.round(p.reputation)}</span></div>
    </section>
    <section class="card">
      <h3 style="margin-top:0">Money & market</h3>
      <dl class="kv">
        <dt>Savings</dt><dd>${money(state, p.wealthEUR)}</dd>
        <dt>Status</dt><dd>${wealthLevel(p.wealthEUR)}</dd>
        <dt>Wage</dt><dd>${club ? `${money(state, club.wageWeekly, { eurOnly: true })}/wk` : '—'}</dd>
        <dt>Contract</dt><dd>${club ? (club.loan ? `Loan to ${shortDate(club.loan.untilWeek)}` : `to ${shortDate(club.contractEndWeek)}`) : '—'}</dd>
        <dt>Market value</dt><dd>€${compact(p.marketValue)}</dd>
        <dt>Followers</dt><dd>${compact(p.followers)}</dd>
        ${p.endorsements.length ? `<dt>Sponsors</dt><dd>${p.endorsements.map((x) => e(x.brand)).join(', ')}</dd>` : ''}
      </dl>
      <h3>People</h3>
      <dl class="kv">
        <dt>Manager</dt><dd>${e(p.manager.name)}</dd>
        <dt>Agent</dt><dd>${p.agent ? `${e(p.agent.name)} (${p.agent.cut}%)` : 'None'}</dd>
        <dt>Partner</dt><dd>${p.partner.status === 'none' ? 'Single' : `${e(p.partner.name)} · ${p.partner.status}`}</dd>
        <dt>Family support</dt><dd>${p.family.parentalSupport}/100</dd>
        ${p.keyTeammates.map((t) => `<dt>${e(t.name)}</dt><dd><span class="chip ${t.relationship === 'ally' ? 'chip-good' : t.relationship === 'enemy' ? 'chip-bad' : t.relationship === 'rival' ? 'chip-warn' : ''}">${t.relationship}</span></dd>`).join('')}
      </dl>
      <h3>National team</h3>
      <dl class="kv">
        <dt>Status</dt><dd>${nt.status === 'none' ? 'Not selected' : nt.status}${nt.team !== 'none' ? ` · ${nt.team}` : ''}</dd>
        <dt>Senior caps</dt><dd>${nt.caps} (${nt.goals} goals)</dd>
        <dt>Youth caps</dt><dd>${nt.youthCaps}</dd>
      </dl>
    </section>`;
}

function ratingClass(r) { return r >= 8 ? 'r-great' : r >= 7.1 ? 'r-good' : r >= 6.5 ? 'r-ok' : r >= 5.6 ? 'r-mid' : 'r-bad'; }

function matchBox(m, J) {
  const home = m.home ? m.club : m.opp, away = m.home ? m.opp : m.club;
  const mine = (n) => (n === m.club ? 'mine' : '');
  const player = m.minutes > 0
    ? `<span class="rating ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span><span class="chip">${m.minutes}'</span>${m.goals ? `<span class="chip chip-good">⚽ ${m.goals}</span>` : ''}${m.assists ? `<span class="chip chip-accent">🅰 ${m.assists}</span>` : ''}${m.motm ? '<span class="chip chip-accent">⭐ MOTM</span>' : ''}${m.red ? '<span class="chip chip-bad">🟥</span>' : m.yellow ? '<span class="chip chip-warn">🟨</span>' : ''}`
    : `<span class="chip">${m.reason === 'injured' ? 'Injured' : m.reason === 'suspended' ? 'Suspended' : 'Did not play'}</span>`;
  return `<div class="match">
    <div class="match-comp">${e(m.competition)}${m.round && !m.international ? ` · ${e(m.round)}` : ''}</div>
    <div class="match-score"><span class="home ${mine(home)}">${e(home)}</span><span class="sc">${m.hs}–${m.as}</span><span class="${mine(away)}">${e(away)}</span></div>
    ${m.penalties ? `<div class="hint">Penalties: ${m.penalties}</div>` : ''}
    <div class="match-player"><b>${e(J)}</b> ${player}</div>
  </div>`;
}

export function renderWeek(state, world, story, aiBusy = false) {
  const p = state.player;
  const res = state.last;
  const wk = res ? res.week : state.week;
  let html = `<div class="week-meta">
      <span>${dateLabel(wk)}</span>·<span>Age ${res?.age ?? ageNow(state)}</span>
      ${story?.eventType ? `<span class="chip">${e(story.eventType)}</span>` : ''}
      ${story?.isMajorEvent ? '<span class="chip chip-accent">Major</span>' : ''}
      ${story?.source === 'claude' ? '<span class="badge badge-ai">✦ Claude</span>' : ''}
    </div>`;
  if (aiBusy) return void ($('week-card').innerHTML = html + `<h1 class="headline"><span class="spinner"></span> Claude is writing this week…</h1>`);
  html += `<h1 class="headline">${e(story?.headline ?? '')}</h1>`;
  const outs = (res?.outcomes ?? []).filter((o) => o.text);
  if (outs.length) html +=outs.map((o) => `<div class="box"><h4>Consequence · you chose "${e(o.label)}"</h4>${e(o.text)}</div>`).join('');
  for (const m of [...(res?.matches ?? []), ...(res?.intl ?? [])]) html += matchBox(m, p.jerseyName);
  html += `<div class="narrative">${(story?.paragraphs ?? []).map((x) => `<p>${e(x)}</p>`).join('')}</div>`;
  if (res?.seasonEnd) {
    const s = res.seasonEnd;
    html += `<div class="box"><h4>Season ${e(s.label)} review</h4>${e(s.league)}: ${ordinal(s.pos)} of ${s.teams}${s.movement ? ` · <b>${s.movement}</b>` : ''} · Champions: ${e(s.champion)}<br>${s.apps} apps · ${s.goals} goals · ${s.assists} assists · ${s.motms} MOTM${s.avgRating ? ` · avg ${s.avgRating}` : ''}${s.awards.length ? `<br>🏅 ${s.awards.map(e).join(' · ')}` : ''}</div>`;
  }
  if (res?.trophies?.length) html += `<div class="box"><h4>Trophy</h4>🏆 ${res.trophies.map(e).join(' · ')}</div>`;
  if (res?.money) html += `<div class="box ${res.money.net < 0 ? 'box-bad' : ''}"><h4>Monthly finances</h4>Income ${money(state, res.money.gross, { eurOnly: true })} · Tax ${money(state, res.money.tax, { eurOnly: true })}${res.money.agentFee ? ` · Agent ${money(state, res.money.agentFee, { eurOnly: true })}` : ''} · Living ${money(state, res.money.living, { eurOnly: true })}${res.money.family ? ` · Family ${money(state, res.money.family, { eurOnly: true })}` : ''} → <b>${res.money.net >= 0 ? '+' : ''}${money(state, res.money.net)}</b></div>`;
  if (story?.aiError) html += `<div class="ai-note">Claude narrator unavailable this week (${e(story.aiError)}), so the offline narrator was used.</div>`;
  $('week-card').innerHTML = html;
}

export function renderDecisions(state, onChoose) {
  const box = $('decisions');
  box.innerHTML = state.pending.map((d) => `
    <div class="card decision" data-id="${d.id}">
      <span class="chip chip-accent">${e(d.type ?? 'decision')}</span>
      <div class="decision-prompt">${e(d.prompt)}</div>
      <div class="choices">${d.choices.map((c) => `
        <button class="choice ${d.chosen === c.id ? 'selected' : ''}" data-choice="${e(c.id)}">
          <span class="choice-top"><span>${e(c.label)}</span><span class="risk risk-${e(c.risk ?? 'medium')}">${e(c.risk ?? 'medium')} risk</span></span>
          <span class="choice-desc">${e(c.description ?? '')}</span>
          ${c.consequence ? `<span class="choice-cons">${e(c.consequence)}</span>` : ''}
        </button>`).join('')}</div>
    </div>`).join('');
  box.querySelectorAll('.decision').forEach((el) => el.querySelectorAll('.choice').forEach((btn) => btn.addEventListener('click', () => onChoose(el.dataset.id, btn.dataset.choice))));
}

export function renderPlanner(state, plan, onChange, onPlay) {
  const p = state.player;
  const season = currentSeason(state);
  const fix = season && p.club ? nextFixtures(season, p.club.name, state.week, 1)[0] : null;
  const cupRound = state.cup?.alive ? state.cup.rounds.find((r) => r.week >= state.week) : null;
  const unanswered = state.pending.filter((d) => !d.chosen).length;
  const opts = [['hard', 'Train hard', 'More growth, −3 PFM, higher injury risk'], ['balanced', 'Balanced', 'Steady work, −1 PFM'], ['light', 'Light', 'Recover a little, +3 PFM'], ['rest', 'Rest', 'No growth, +7 PFM']];
  const relevant = Object.keys(POSITIONS[p.position].weights);
  $('planner').innerHTML = `
    <h2>Your week ahead</h2>
    ${p.injury ? `<p class="hint">🩹 Injured: rehab replaces training (${p.injury.weeksLeft} week${p.injury.weeksLeft > 1 ? 's' : ''} left).</p>` : `
    <div class="seg" id="seg-plan">${opts.map(([k, l, t]) => `<button type="button" data-k="${k}" title="${t}" class="${plan.intensity === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="planner-row">
      <label>Training focus<select id="sel-focus"><option value="auto">Automatic (best for position)</option>${relevant.map((k) => `<option value="${k}" ${plan.focus === k ? 'selected' : ''}>${statLabel(k)}</option>`).join('')}</select></label>
      <span class="hint">${opts.find((o) => o[0] === plan.intensity)?.[2] ?? ''}</span>
    </div>`}
    <div class="play-row">
      <div class="next-fix">${fix ? `Next: ${fix.week === state.week ? '<b>this week</b>' : shortDate(fix.week)} · ${fix.home ? 'vs' : '@'} ${e(fix.opp)}` : p.club ? 'No league match scheduled' : 'Free agent — waiting for offers'}${cupRound && cupRound.week === state.week ? ` · <b>${e(state.cup.name)} ${e(cupRound.name)}</b>` : ''}</div>
      <button id="btn-play" class="btn btn-primary btn-play" ${unanswered ? 'disabled' : ''}>${unanswered ? `Answer ${unanswered} decision${unanswered > 1 ? 's' : ''} first` : `Play week ${state.week + 1} ▶`}</button>
    </div>`;
  $('planner').querySelectorAll('#seg-plan button').forEach((b) => b.addEventListener('click', () => onChange({ ...plan, intensity: b.dataset.k })));
  $('sel-focus')?.addEventListener('change', (ev) => onChange({ ...plan, focus: ev.target.value }));
  $('btn-play').addEventListener('click', onPlay);
}

const AVATAR_COLORS = ['#c6f432', '#5aa9ff', '#3ddc97', '#ffb547', '#ff8fa3', '#b69cff'];
export function renderFeed(story) {
  const posts = story?.socialFeed ?? [];
  $('feed').innerHTML = `<h2>Feed</h2>` + (posts.length ? posts.map((x, i) => `
    <div class="post">
      <div class="avatar" style="background:${AVATAR_COLORS[(x.handle?.length ?? i) % AVATAR_COLORS.length]}">${e((x.displayName ?? '?')[0])}</div>
      <div>
        <div><span class="post-name">${e(x.displayName)}</span> ${x.verified ? '<span class="verified">✔</span>' : ''} <span class="post-handle">${e(x.handle)}</span></div>
        <div class="post-text">${e(x.text)}</div>
        <div class="post-meta">${x.platform === 'instagram' ? '📷 Instagram' : '𝕏'} · ♥ ${compact(Number(x.likes) || 0)}</div>
      </div>
    </div>`).join('') : '<p class="hint">Nothing yet.</p>');
}

export function renderWorld(state, world) {
  const p = state.player;
  const season = currentSeason(state);
  let html = '';
  if (season) {
    const rows = standings(season);
    html += `<section class="card"><h2>${e(season.name)} <span class="muted">${e(season.label)}</span></h2>
      ${season.rounds[0].week > state.week ? `<p class="hint">Season starts ${shortDate(season.rounds[0].week)}.</p>` : ''}
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Club</th><th class="n">P</th><th class="n">GD</th><th class="n">Pts</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.club === p.club?.name ? 'me' : ''}"><td>${r.pos}</td><td class="club">${e(r.club)}</td><td class="n">${r.p}</td><td class="n">${r.gd > 0 ? '+' : ''}${r.gd}</td><td class="n">${r.pts}</td></tr>`).join('')}
      </tbody></table></div></section>`;
    const fx = nextFixtures(season, p.club.name, state.week, 4);
    html += `<section class="card"><h2>Fixtures</h2><ul class="list">${fx.map((f) => `<li><span class="wk">${shortDate(f.week)}</span>${f.home ? 'vs' : '@'} ${e(f.opp)}</li>`).join('') || '<li class="hint">None scheduled</li>'}
      ${state.cup ? `<li><span class="wk">${e(state.cup.name)}</span>${state.cup.alive ? `Next: ${e(state.cup.rounds.find((r) => r.week >= state.week)?.name ?? '—')}` : state.cup.results.at(-1)?.result === 'W' ? '🏆 Winners' : `Out (${e(state.cup.results.at(-1)?.round ?? '')})`}</li>` : ''}</ul></section>`;
  }
  const c = p.career;
  html += `<section class="card"><h2>Career</h2><dl class="kv">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals</dt><dd>${c.goals}</dd><dt>Assists</dt><dd>${c.assists}</dd><dt>Man of the Match</dt><dd>${c.motms}</dd>
      <dt>This season</dt><dd>${p.season.apps} apps · ${p.season.goals} G · ${p.season.assists} A</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak value</dt><dd>€${compact(c.peakMarketValue)}</dd>
    </dl>
    ${c.trophies.length ? `<h3>Trophies</h3><ul class="list">${c.trophies.map((t) => `<li>🏆 ${e(t)}</li>`).join('')}</ul>` : ''}
    ${c.awards.length ? `<h3>Awards</h3><ul class="list">${c.awards.map((t) => `<li>🏅 ${e(t)}</li>`).join('')}</ul>` : ''}
    <h3>Clubs</h3><ul class="list">${c.clubHistory.map((h) => `<li>${e(h.club)}${h.type === 'loan' ? ' (loan)' : ''} <span class="muted">· ${yearOf(h.from)}–${h.to !== null ? yearOf(h.to) : 'now'} · ${h.apps} apps, ${h.goals} G</span></li>`).join('')}</ul>
    </section>`;
  html += `<section class="card"><h2>Headlines</h2><ul class="list">${state.log.slice(-10).reverse().map((l) => `<li><span class="wk">Wk ${l.week + 1}</span>${e(l.headline)}</li>`).join('') || '<li class="hint">Your story starts now.</li>'}</ul></section>`;
  $('col-world').innerHTML = html;
}

export function renderRetirement(state) {
  const p = state.player, c = p.career, L = legacy(state);
  const reason = { retirement: 'Retired', injury: 'Career-ending injury', pfm: 'The body gave out (PFM 0)', age: 'Age 40' }[state.ended.reason] ?? 'Career over';
  $('decisions').innerHTML = '';
  $('planner').innerHTML = `<div class="legacy">
    <div class="label">${reason} · age ${ageNow(state)}</div>
    <div class="legacy-label">${e(L.label)}</div>
    <p class="hint">Legacy score ${L.score}</p>
    <dl class="kv" style="max-width:360px;margin:16px auto;text-align:left">
      <dt>Appearances</dt><dd>${c.apps}</dd><dt>Goals / assists</dt><dd>${c.goals} / ${c.assists}</dd><dt>MOTM awards</dt><dd>${c.motms}</dd>
      <dt>International caps</dt><dd>${p.national.caps} (${p.national.goals} goals)</dd><dt>Trophies</dt><dd>${c.trophies.length}</dd><dt>Awards</dt><dd>${c.awards.length}</dd>
      <dt>Peak overall</dt><dd>${c.peakOverall}</dd><dt>Peak market value</dt><dd>€${compact(c.peakMarketValue)}</dd><dt>Clubs</dt><dd>${new Set(c.clubHistory.map((h) => h.club)).size}</dd>
    </dl>
    <button id="btn-new-career" class="btn btn-primary">Start a new career</button>
  </div>`;
}
