// Calendar: every game week is a Monday, counted from START_DATE_UTC.
import { START_DATE_UTC } from './config.js';

const DAY = 86400000;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

export const weekDate = (w) => new Date(START_DATE_UTC + w * 7 * DAY);
export const weekOfDate = (ms) => Math.floor((ms - START_DATE_UTC) / (7 * DAY));
export const monthOf = (w) => weekDate(w).getUTCMonth();
export const yearOf = (w) => weekDate(w).getUTCFullYear();

export function dateLabel(w) {
  const d = weekDate(w);
  return `Wk ${w + 1}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function shortDate(w) {
  const d = weekDate(w);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Week index of the n-th Monday (1-based) of a month.
export function nthMondayWeek(year, month, n) {
  const first = Date.UTC(year, month, 1);
  const dow = new Date(first).getUTCDay();
  const offset = (8 - dow) % 7; // days until Monday
  return weekOfDate(first + (offset + (n - 1) * 7) * DAY);
}

// FIFA international windows (approximate weeks).
const fifaCache = new Map();
function fifaWeeks(year) {
  if (!fifaCache.has(year)) {
    fifaCache.set(year, new Set([
      nthMondayWeek(year, 2, 4), nthMondayWeek(year, 5, 2),
      nthMondayWeek(year, 8, 2), nthMondayWeek(year, 9, 2), nthMondayWeek(year, 10, 3),
    ]));
  }
  return fifaCache.get(year);
}
export const isFifaWeek = (w) => fifaWeeks(yearOf(w)).has(w);

export function ageAt(dobMs, w) {
  const d = weekDate(w), b = new Date(dobMs);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function inRange(w, isoFrom, isoTo) {
  const t = weekDate(w).getTime();
  return t >= Date.parse(isoFrom) - 6 * DAY && t <= Date.parse(isoTo);
}
