// Встроенные SVG-иконки (без эмодзи — они по-разному выглядят на разных ОС).
const S = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
// Рисованная иконка (src/assets/ui/*.png) в SVG-обёртке — работают все правила размеров для svg
const P = (name) => S('0 0 64 64', `<image href="assets/ui/${name}.png" xlink:href="assets/ui/${name}.png" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`);

export const ICONS = {
  pause: S('0 0 24 24', '<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="currentColor"/>'),
  play: S('0 0 24 24', '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/>'),
  home: S('0 0 24 24', '<path d="M12 3.2 2.8 11a1 1 0 0 0 .65 1.76H5V20a1 1 0 0 0 1 1h4v-5.5h4V21h4a1 1 0 0 0 1-1v-7.24h1.55A1 1 0 0 0 21.2 11z" fill="currentColor"/>'),
  map: S('0 0 24 24', '<path d="M9 4 3.6 6.1A1 1 0 0 0 3 7v12.6a.7.7 0 0 0 .96.65L9 18.3l6 2 5.4-2.1a1 1 0 0 0 .6-.93V4.7a.7.7 0 0 0-.96-.65L15 6zm0 2.2 6 2v10.6l-6-2z" fill="currentColor"/>'),
  retry: S('0 0 24 24', '<path d="M12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35A7.95 7.95 0 0 0 12 4z" fill="currentColor"/>'),
  soundOn: S('0 0 24 24', '<path d="M4 9.2v5.6c0 .55.45 1 1 1h3l4.3 3.7c.65.56 1.7.1 1.7-.76V5.26c0-.86-1.05-1.32-1.7-.76L8 8.2H5c-.55 0-1 .45-1 1z" fill="currentColor"/><path d="M16.5 8.2a5 5 0 0 1 0 7.6M18.8 5.6a8.6 8.6 0 0 1 0 12.8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>'),
  soundOff: S('0 0 24 24', '<path d="M4 9.2v5.6c0 .55.45 1 1 1h3l4.3 3.7c.65.56 1.7.1 1.7-.76V5.26c0-.86-1.05-1.32-1.7-.76L8 8.2H5c-.55 0-1 .45-1 1z" fill="currentColor"/><path d="m16.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  music: S('0 0 24 24', '<path d="M19 3.5v11.2a3.3 3.3 0 1 1-2-3.03V7.4l-7 1.6v7.7a3.3 3.3 0 1 1-2-3.03V6.4a1 1 0 0 1 .78-.98l9-2a1 1 0 0 1 1.22.98z" fill="currentColor"/>'),
  vibro: S('0 0 24 24', '<rect x="7.5" y="3" width="9" height="18" rx="2.2" fill="currentColor"/><path d="M4 8v8M20 8v8M1.8 10v4M22.2 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  gear: S('0 0 24 24', '<path d="M13.8 2.5h-3.6l-.5 2.6a7.6 7.6 0 0 0-1.9 1.1l-2.5-.9-1.8 3.1 2 1.7a7.7 7.7 0 0 0 0 2.2l-2 1.7 1.8 3.1 2.5-.9c.58.46 1.22.84 1.9 1.1l.5 2.6h3.6l.5-2.6a7.6 7.6 0 0 0 1.9-1.1l2.5.9 1.8-3.1-2-1.7a7.7 7.7 0 0 0 0-2.2l2-1.7-1.8-3.1-2.5.9a7.6 7.6 0 0 0-1.9-1.1zM12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z" fill="currentColor"/>'),
  cart: S('0 0 24 24', '<path d="M2.5 3.5h2.3l2.4 11.1c.1.5.55.9 1.06.9h9.9c.48 0 .9-.34 1-.8l1.6-7.2H6.1" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.2" cy="19.6" r="1.8" fill="currentColor"/><circle cx="17" cy="19.6" r="1.8" fill="currentColor"/>'),
  gift: S('0 0 64 64', '<rect x="8" y="26" width="48" height="32" rx="5" fill="#ff5f9e"/><rect x="5" y="17" width="54" height="13" rx="4" fill="#ff86b8"/><rect x="28" y="17" width="8" height="41" fill="#ffd23f"/><path d="M32 17c-4-9-15-11-15-4 0 5 9 5 15 4zm0 0c4-9 15-11 15-4 0 5-9 5-15 4z" fill="#ffd23f" stroke="#e09b00" stroke-width="2"/>'),
  trophy: S('0 0 64 64', '<path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#ffc83d"/><path d="M18 13H9c0 9 4 14 11 15M46 13h9c0 9-4 14-11 15" stroke="#e09b00" stroke-width="4" fill="none"/><rect x="28" y="35" width="8" height="11" fill="#e09b00"/><rect x="19" y="46" width="26" height="9" rx="3" fill="#a66be0"/><path d="M26 15l2 4 4.5.6-3.3 3 .9 4.4-4.1-2.2-4 2.2.8-4.4-3.3-3 4.5-.6z" fill="#fff4bf" transform="translate(6 -1)"/>'),
  infinity: S('0 0 64 64', '<path d="M21 22c-6 0-10 4.5-10 10s4 10 10 10c8.5 0 13.5-20 22-20 6 0 10 4.5 10 10s-4 10-10 10c-8.5 0-13.5-20-22-20z" stroke="currentColor" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  close: S('0 0 24 24', '<path d="m6.5 6.5 11 11m0-11-11 11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  starOn: S('0 0 64 64', '<path d="M32 4.5l8.4 17 18.8 2.8-13.6 13.2 3.2 18.7L32 47.4l-16.8 8.8 3.2-18.7L4.8 24.3l18.8-2.8z" fill="#ffd23f" stroke="#e8920c" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 20c3-1 6-1 8 0" stroke="#fff6c4" stroke-width="3" stroke-linecap="round"/>'),
  starOff: S('0 0 64 64', '<path d="M32 4.5l8.4 17 18.8 2.8-13.6 13.2 3.2 18.7L32 47.4l-16.8 8.8 3.2-18.7L4.8 24.3l18.8-2.8z" fill="#d9d2ea" stroke="#b4abc9" stroke-width="3.5" stroke-linejoin="round"/>'),
  // Монета с лапкой (без знака рубля — игровая валюта не должна напоминать реальные деньги, п. 3.7)
  coin: P('coin'),
  video: S('0 0 24 24', '<rect x="2.5" y="5.5" width="13.5" height="13" rx="3" fill="currentColor"/><path d="m16.8 10.3 4-2.6c.5-.3 1.2.05 1.2.66v7.3c0 .6-.7.97-1.2.66l-4-2.6z" fill="currentColor"/><path d="M7.6 9.4v5.2l4.3-2.6z" fill="#ff9a1f"/>'),
  lock: S('0 0 24 24', '<rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2.6" fill="none"/>'),
  help: S('0 0 24 24', '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1.1-1.5 2.1v.6" stroke="#fff" stroke-width="2.3" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.8" r="1.4" fill="#fff"/>'),
  user: S('0 0 24 24', '<circle cx="12" cy="8.2" r="4.3" fill="currentColor"/><path d="M3.8 20.5c.6-4.4 4-7 8.2-7s7.6 2.6 8.2 7z" fill="currentColor"/>'),
  noads: S('0 0 64 64', '<circle cx="32" cy="32" r="27" fill="#fff" stroke="#ff3b5c" stroke-width="6"/><text x="32" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" fill="#3a2463">AD</text><path d="M13 13l38 38" stroke="#ff3b5c" stroke-width="6"/>'),
  bomb: P('bomb'),
  rainbow: P('rainbow'),
  fire: P('fire'),
  kitten: S('0 0 64 64', '<path d="M10 30 12 6l16 12zM54 30 52 6 36 18z" fill="#ffb35c"/><path d="M15 24l1.6-12 8.5 6.5zM49 24l-1.6-12-8.5 6.5z" fill="#ff9fb4"/><ellipse cx="32" cy="36" rx="23" ry="20" fill="#ffb35c"/><ellipse cx="23" cy="34" rx="4" ry="5.2" fill="#2b2233"/><ellipse cx="41" cy="34" rx="4" ry="5.2" fill="#2b2233"/><circle cx="21.8" cy="32" r="1.6" fill="#fff"/><circle cx="39.8" cy="32" r="1.6" fill="#fff"/><path d="M29.5 41h5l-2.5 3z" fill="#ff7f9f"/><path d="M27.5 45c1.5 2 3.2 2 4.5 0 1.3 2 3 2 4.5 0" stroke="#5a4050" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  bubbles: S('0 0 64 64', '<circle cx="22" cy="38" r="15" fill="#3d8bff"/><circle cx="42" cy="24" r="13" fill="#ff4f64"/><circle cx="44" cy="48" r="10" fill="#45d16b"/><ellipse cx="17" cy="32" rx="5" ry="3" fill="#fff" opacity=".7" transform="rotate(-30 17 32)"/><ellipse cx="38" cy="19" rx="4.5" ry="2.6" fill="#fff" opacity=".7" transform="rotate(-30 38 19)"/>'),
  stone: S('0 0 64 64', '<path d="M12 36l6-18 18-8 16 10 4 18-10 14H22z" fill="#9aa2b3" stroke="#5d6577" stroke-width="3" stroke-linejoin="round"/><path d="M24 30l8 6 2 10M32 36l10-4" stroke="#5d6577" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  aim: S('0 0 64 64', '<circle cx="32" cy="50" r="10" fill="#ff4f64"/><path d="M32 38 46 8" stroke="#c4562e" stroke-width="4" stroke-dasharray="4 5" stroke-linecap="round"/><path d="M40 6l8-1-2 8" stroke="#c4562e" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  swap: S('0 0 64 64', '<circle cx="18" cy="40" r="11" fill="#3d8bff"/><circle cx="46" cy="40" r="11" fill="#ffcf2e"/><path d="M18 22c4-8 24-8 28 0" stroke="#c4562e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M41 17l5 5 4-6" stroke="#c4562e" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  bounce: S('0 0 64 64', '<rect x="4" y="4" width="6" height="56" rx="3" fill="#b9b3cc"/><path d="M40 58 12 32 40 8" stroke="#c4562e" stroke-width="4" stroke-dasharray="4 5" fill="none" stroke-linecap="round"/><circle cx="44" cy="10" r="7" fill="#45d16b"/>'),
  check: S('0 0 24 24', '<path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  hand: S('0 0 64 64', '<path d="M24 34V12a4.5 4.5 0 0 1 9 0v16l12.6 2.3c3.5.7 5.8 4 5.2 7.5L48.5 52c-.6 3.3-3.4 6-6.8 6H31c-2.1 0-4.1-1-5.4-2.7L14.3 41a4.3 4.3 0 0 1 6.6-5.5z" fill="#fff" stroke="#3a2463" stroke-width="3.2" stroke-linejoin="round"/>'),
};

export function icon(name) { return ICONS[name] || ''; }
