// A simple, flat avatar for the player: skin tone, hair style and colour, facial hair, accessories.
// Drawn as one small SVG (no images to download). Edit it on the setup screen or by clicking the portrait.
export const AVATAR_OPTIONS = {
  skin: [['#f6d9c5', 'Fair'], ['#ecc4a2', 'Light'], ['#d8a57f', 'Medium'], ['#c08a62', 'Tan'], ['#94603d', 'Brown'], ['#6b4128', 'Deep'], ['#4a2c1b', 'Dark']],
  hair: [['short', 'Short'], ['buzz', 'Buzz cut'], ['fade', 'Fade'], ['quiff', 'Quiff'], ['curly', 'Curly'], ['afro', 'Afro'], ['wavy', 'Wavy'], ['long', 'Long'], ['bun', 'Man bun'], ['mohawk', 'Mohawk'], ['braids', 'Cornrows'], ['spiky', 'Spiky'], ['bald', 'Bald']],
  hairColor: [['#151515', 'Black'], ['#3a2417', 'Dark brown'], ['#6b4325', 'Brown'], ['#a8743f', 'Light brown'], ['#d9b46a', 'Blonde'], ['#efe0b0', 'Platinum'], ['#a5462a', 'Red'], ['#8e8e8e', 'Grey'], ['#2f6fdb', 'Dyed blue'], ['#d94b8a', 'Dyed pink']],
  beard: [['none', 'Clean-shaven'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['goatee', 'Goatee'], ['chinstrap', 'Chinstrap'], ['full', 'Full beard']],
  acc: [['headband', 'Headband'], ['earring', 'Earring'], ['glasses', 'Glasses'], ['shades', 'Sunglasses'], ['chain', 'Chain'], ['cap', 'Cap'], ['bandana', 'Bandana']],
};

const SKIN_BY_NATION = { Indonesia: 2, Malaysia: 2, Thailand: 2, Vietnam: 1, Philippines: 2, Japan: 1, 'South Korea': 1, 'China PR': 1, Brazil: 3, Nigeria: 5, Ghana: 5, Senegal: 6, Cameroon: 5, "Côte d'Ivoire": 5, 'South Africa': 4, Egypt: 3, Morocco: 3, 'Saudi Arabia': 3, India: 3, Mexico: 3, Colombia: 3, Argentina: 1 };

export function defaultAvatar(nationality = '') {
  const s = SKIN_BY_NATION[nationality] ?? 1;
  return { skin: AVATAR_OPTIONS.skin[s][0], hair: s >= 4 ? 'fade' : 'short', hairColor: '#151515', beard: 'none', acc: [] };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * f))));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Hair drawn behind the head (long styles) and on top of it.
function hairBack(style, col) {
  if (style === 'afro') return `<circle cx="50" cy="36" r="27" fill="${col}"/>`;
  if (style === 'long') return `<path d="M27 40 Q26 18 50 16 Q74 18 73 40 L75 68 Q62 62 50 63 Q38 62 25 68 Z" fill="${col}"/>`;
  if (style === 'curly') return `<g fill="${col}">${[[32, 28], [40, 21], [50, 18], [60, 21], [68, 28], [29, 37], [71, 37]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5"/>`).join('')}</g>`;
  return '';
}
function hairFront(style, col) {
  switch (style) {
    case 'buzz': return `<path d="M29.5 41 Q29 19.5 50 19.5 Q71 19.5 70.5 41 Q68 29 50 28 Q32 29 29.5 41Z" fill="${col}" opacity=".75"/>`;
    case 'fade': return `<path d="M29.5 41 Q29 18 50 17.5 Q71 18 70.5 41 Q69 30 64 27 Q50 24 36 27 Q31 30 29.5 41Z" fill="${col}"/><path d="M29.5 41 Q29.3 36 30.5 32 L31.5 42Z M70.5 41 Q70.7 36 69.5 32 L68.5 42Z" fill="${col}" opacity=".45"/>`;
    case 'quiff': return `<path d="M29.5 40 Q28 20 44 15 Q58 9 68 18 Q72 24 70.5 40 Q68 28 58 26 Q48 25 40 28 Q32 31 29.5 40Z" fill="${col}"/>`;
    case 'curly': return `<path d="M30 38 Q32 26 50 25 Q68 26 70 38 Q66 30 50 30 Q34 30 30 38Z" fill="${col}"/>`;
    case 'afro': return `<path d="M30 40 Q31 28 50 27 Q69 28 70 40 Q64 33 50 33 Q36 33 30 40Z" fill="${col}"/>`;
    case 'wavy': return `<path d="M29 42 Q27 18 50 16 Q73 18 71 42 Q68 33 62 31 Q57 35 51 31 Q45 35 39 31 Q33 33 29 42Z" fill="${col}"/>`;
    case 'long': return `<path d="M29 42 Q28 19 50 17 Q72 19 71 42 Q66 28 50 27 Q40 27 34 31 Q30 35 29 42Z" fill="${col}"/>`;
    case 'bun': return `<circle cx="50" cy="14" r="7" fill="${col}"/><path d="M29.5 41 Q29 19 50 19 Q71 19 70.5 41 Q68 29 50 28 Q32 29 29.5 41Z" fill="${col}"/>`;
    case 'mohawk': return `<path d="M44 30 Q44 12 50 9 Q56 12 56 30Z" fill="${col}"/><path d="M29.5 41 Q29 22 44 20 L44 29 Q34 31 29.5 41Z M70.5 41 Q71 22 56 20 L56 29 Q66 31 70.5 41Z" fill="${col}" opacity=".35"/>`;
    case 'braids': return `<path d="M29.5 41 Q29 18.5 50 18.5 Q71 18.5 70.5 41 Q68 29 50 28 Q32 29 29.5 41Z" fill="${col}"/><g stroke="${shade(col, 1.6)}" stroke-width="1" opacity=".55">${[38, 44, 50, 56, 62].map((x) => `<path d="M${x} 20 Q${x + (x - 50) * 0.3} 26 ${x + (x - 50) * 0.5} 30"/>`).join('')}</g>`;
    case 'spiky': return `<path d="M29.5 41 L30 26 L35 28 L37 17 L42 24 L46 13 L50 22 L54 13 L58 24 L63 17 L65 28 L70 26 L70.5 41 Q68 30 50 29 Q32 30 29.5 41Z" fill="${col}"/>`;
    case 'bald': return '';
    case 'short': default: return `<path d="M29.5 41 Q28.5 18 50 17.5 Q71.5 18 70.5 41 Q69 30 60 28.5 Q55 31 47 28.5 Q35 29 29.5 41Z" fill="${col}"/>`;
  }
}
function beardSvg(kind, col) {
  switch (kind) {
    case 'stubble': return `<path d="M31 50 Q33 66 50 68 Q67 66 69 50 Q66 61 50 62 Q34 61 31 50Z" fill="${col}" opacity=".28"/>`;
    case 'moustache': return `<path d="M42 56.5 Q50 52.5 58 56.5 Q50 55 42 56.5Z" fill="${col}" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case 'goatee': return `<path d="M43 56 Q50 53 57 56 Q50 55.5 43 56Z" fill="${col}" stroke="${col}" stroke-width="1.4"/><path d="M45.5 62 Q50 60.5 54.5 62 Q54 67 50 68 Q46 67 45.5 62Z" fill="${col}"/>`;
    case 'chinstrap': return `<path d="M30.5 46 Q31 65 50 68 Q69 65 69.5 46 L68 46 Q66 62 50 64.5 Q34 62 32 46Z" fill="${col}"/>`;
    case 'full': return `<path d="M30.5 46 Q30 68 50 71 Q70 68 69.5 46 Q67 54 62 56 Q56 53 50 54 Q44 53 38 56 Q33 54 30.5 46Z" fill="${col}"/><path d="M44 59 Q50 61 56 59" stroke="${shade(col, 0.6)}" stroke-width="1.2" fill="none"/>`;
    default: return '';
  }
}

export function avatarSvg(av = {}, { size = 48, shirt = '#c6f432', bg = '#1c2a46', cls = '' } = {}) {
  const a = { ...defaultAvatar(), ...av };
  const acc = new Set(a.acc ?? []);
  const skin = a.skin, hc = a.hairColor;
  const hat = acc.has('cap') || acc.has('bandana');
  return `<svg class="avatar-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="50" fill="${bg}"/>
  <clipPath id="avc"><circle cx="50" cy="50" r="50"/></clipPath>
  <g clip-path="url(#avc)">
    <path d="M14 104 Q16 78 36 74 L50 80 L64 74 Q84 78 86 104Z" fill="${shirt}"/>
    <path d="M42 74 L50 84 L58 74" fill="none" stroke="${shade(shirt, 0.7)}" stroke-width="2"/>
    <rect x="43" y="60" width="14" height="16" rx="5" fill="${shade(skin, 0.9)}"/>
    ${acc.has('chain') ? '<path d="M41 74 Q50 83 59 74" fill="none" stroke="#e8c24a" stroke-width="1.8"/>' : ''}
    ${hat ? '' : hairBack(a.hair, hc)}
    <ellipse cx="30" cy="46" rx="3.6" ry="5" fill="${shade(skin, 0.93)}"/><ellipse cx="70" cy="46" rx="3.6" ry="5" fill="${shade(skin, 0.93)}"/>
    ${acc.has('earring') ? '<circle cx="29.5" cy="51" r="1.6" fill="#e8c24a"/>' : ''}
    <ellipse cx="50" cy="44" rx="20" ry="23" fill="${skin}"/>
    ${hat ? '' : hairFront(a.hair, hc)}
    <path d="M39 38.5 Q43 36.5 46 38.2 M54 38.2 Q57 36.5 61 38.5" stroke="${a.hair === 'bald' ? shade(skin, 0.55) : hc}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="43" cy="44" r="1.9" fill="#1b1b1b"/><circle cx="57" cy="44" r="1.9" fill="#1b1b1b"/>
    <path d="M49 47 Q48 51 50.5 51.5" stroke="${shade(skin, 0.75)}" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    ${beardSvg(a.beard, hc === '#efe0b0' || hc === '#d94b8a' || hc === '#2f6fdb' ? '#3a2417' : hc)}
    <path d="M45 57.5 Q50 60.5 55 57.5" stroke="#5a2f22" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${acc.has('glasses') && !acc.has('shades') ? '<g fill="none" stroke="#222" stroke-width="1.5"><rect x="36.5" y="40" width="12" height="9" rx="3"/><rect x="51.5" y="40" width="12" height="9" rx="3"/><path d="M48.5 44 H51.5"/></g>' : ''}
    ${acc.has('shades') ? '<g fill="#111" stroke="#111" stroke-width="1.2"><rect x="36" y="40" width="12.5" height="8.5" rx="3"/><rect x="51.5" y="40" width="12.5" height="8.5" rx="3"/><path d="M48.5 43.5 H51.5"/></g>' : ''}
    ${acc.has('headband') && !hat ? `<rect x="29.5" y="29" width="41" height="4.5" rx="2" fill="${shirt}"/>` : ''}
    ${acc.has('cap') ? `<path d="M29 38 Q29 17 50 17 Q71 17 71 38Z" fill="${shade(shirt, 0.8)}"/><path d="M29 37 Q50 33 78 39 Q76 42 71 41 Q50 38 29 40Z" fill="${shade(shirt, 0.6)}"/>` : ''}
    ${acc.has('bandana') && !acc.has('cap') ? `<path d="M29 38 Q29 18 50 18 Q71 18 71 38 Q60 33 50 33 Q40 33 29 38Z" fill="#b8322f"/><g fill="#fff" opacity=".6"><circle cx="40" cy="25" r="1"/><circle cx="50" cy="22" r="1"/><circle cx="60" cy="25" r="1"/><circle cx="45" cy="29" r="1"/><circle cx="56" cy="29" r="1"/></g>` : ''}
  </g>
</svg>`;
}
