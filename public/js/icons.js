// Line icons drawn for the game (24×24, stroke = currentColor). No downloads needed.
const P = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3.8 2.8-1.5 4.4H9.7l-1.5-4.4z"/><path d="M12 3v4.5M15.8 10.3l4.6-1.4M14.3 14.7l2.8 3.9M9.7 14.7l-2.8 3.9M8.2 10.3L3.6 8.9"/>',
  whistle: '<circle cx="8.5" cy="14.5" r="5"/><path d="M12 11l9-4.5V10l-6.5 3"/><path d="M5 5.5l2 2.5M9 3.5v3"/>',
  building: '<path d="M4 21V8l8-4.5L20 8v13"/><path d="M2.5 21h19M9.5 21v-4.5h5V21M8 10.5h2M14 10.5h2M8 13.5h2M14 13.5h2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.6a5.5 5.5 0 0 1 5 5.4"/>',
  megaphone: '<path d="M3 10v4h3l9 5V5l-9 5z"/><path d="M18.5 9a4 4 0 0 1 0 6"/><path d="M6 14l1.5 5h2.5l-1-4.4"/>',
  newspaper: '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2h-1"/><path d="M7 8h7M7 12h7M7 16h4"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
  heart: '<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
  friends: '<circle cx="8" cy="8.5" r="3"/><circle cx="16" cy="8.5" r="3"/><path d="M2 20c.5-3 3-5 6-5 1.6 0 3 .5 4 1.4 1-.9 2.4-1.4 4-1.4 3 0 5.5 2 6 5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a5 5 0 0 0 8 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  dumbbell: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
  bandage: '<rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  spark: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 3v4M17 5h4M18 16v3M16.5 17.5h3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9.5 17h5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7 10v4M5 12h4M15.5 11h.01M18 13h.01"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  book: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5V19"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  bed: '<path d="M3 19V7M21 19v-6a3 3 0 0 0-3-3h-8v5"/><path d="M3 15h18"/><circle cx="6.5" cy="11.5" r="1.5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  chart: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  ripple: '<path d="M4 4v9a4 4 0 0 0 4 4h11"/><path d="M15 13l4 4-4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  shirt: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 9v11"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
};

// Which icon each part of life uses everywhere in the UI.
export const ASPECT_ICON = {
  trust: 'whistle', board: 'building', dressing: 'users', fans: 'megaphone', press: 'newspaper', image: 'star',
  family: 'home', love: 'heart', friends: 'friends', morale: 'smile', stress: 'zap', social: 'share', followers: 'share',
  money: 'coin', wealthEUR: 'coin', body: 'pulse', pfm: 'pulse', skills: 'spark', form: 'chart', reputation: 'star', match: 'ball',
};
export const ASPECT_LABEL = {
  trust: 'Manager', board: 'Board', dressing: 'Dressing room', fans: 'Fans', press: 'Press', image: 'Image', family: 'Family',
  love: 'Partner', friends: 'Friends', morale: 'Morale', stress: 'Stress', social: 'Followers', followers: 'Followers', money: 'Money',
  wealthEUR: 'Money', body: 'Body', pfm: 'Fitness', skills: 'Skills', form: 'Form', reputation: 'Fame', match: 'Next match',
};
// Arena = the part of life a decision comes from (colour + icon on its card).
export const ARENA_STYLE = {
  football: { icon: 'ball', label: 'Football', color: 'var(--a-football)' },
  media: { icon: 'newspaper', label: 'Media', color: 'var(--a-media)' },
  love: { icon: 'heart', label: 'Love', color: 'var(--a-love)' },
  friends: { icon: 'friends', label: 'Friends', color: 'var(--a-friends)' },
  family: { icon: 'home', label: 'Family & roots', color: 'var(--a-family)' },
  lifestyle: { icon: 'coin', label: 'Lifestyle', color: 'var(--a-lifestyle)' },
  politics: { icon: 'building', label: 'Club politics', color: 'var(--a-politics)' },
  transfer: { icon: 'briefcase', label: 'Contract', color: 'var(--a-transfer)' },
  match: { icon: 'target', label: 'In-match', color: 'var(--a-match)' },
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.spark}</svg>`;
}
