// Процедурная графика: шарики, котята, камни, бомбы, кошка-мама, фоны миров.
import { PALETTE, KITTEN_FURS } from './constants.js';

const TAU = Math.PI * 2;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// ---------- Шарики ----------
export function drawBubble(ctx, cx, cy, r, pal, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r * 1.02);
  g.addColorStop(0, pal.light);
  g.addColorStop(0.42, pal.base);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.stroke();
  glossy(ctx, cx, cy, r);
  ctx.restore();
}

function glossy(ctx, cx, cy, r) {
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.33, cy - r * 0.45, r * 0.33, r * 0.19, -0.55, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(cx - r * 0.6, cy - r * 0.12, r * 0.075, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0.2 * Math.PI, 0.62 * Math.PI); ctx.stroke();
}

export function drawKittenFace(ctx, cx, cy, s, furIdx, blink = false, happy = false) {
  const f = KITTEN_FURS[furIdx % KITTEN_FURS.length];
  ctx.save();
  // уши
  ctx.fillStyle = f.fur;
  ctx.strokeStyle = 'rgba(60,40,50,0.35)';
  ctx.lineWidth = s * 0.07;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * s * 0.88, cy - s * 0.12);
    ctx.lineTo(cx + side * s * 0.72, cy - s * 1.02);
    ctx.lineTo(cx + side * s * 0.12, cy - s * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = f.ear;
    ctx.beginPath();
    ctx.moveTo(cx + side * s * 0.72, cy - s * 0.3);
    ctx.lineTo(cx + side * s * 0.66, cy - s * 0.8);
    ctx.lineTo(cx + side * s * 0.32, cy - s * 0.62);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = f.fur;
  }
  // голова
  ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.95, s * 0.82, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // окрас
  if (f.patch && furIdx === 3) {
    ctx.fillStyle = f.patch;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.32, s * 0.5, s * 0.36, 0, 0, TAU); ctx.fill();
  } else if (f.patch) {
    ctx.strokeStyle = f.patch; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
    for (const dx of [-0.22, 0, 0.22]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * s, cy - s * 0.78); ctx.lineTo(cx + dx * s * 0.8, cy - s * 0.5); ctx.stroke();
    }
  }
  // щёчки
  ctx.fillStyle = 'rgba(255,120,150,0.35)';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + side * s * 0.58, cy + s * 0.28, s * 0.17, s * 0.11, 0, 0, TAU); ctx.fill(); }
  // глаза
  const ey = cy - s * 0.04;
  const dark = furIdx === 3;
  if (blink || happy) {
    ctx.strokeStyle = dark ? '#fff' : '#2b2233';
    ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      if (happy) ctx.arc(cx + side * s * 0.36, ey + s * 0.06, s * 0.14, Math.PI * 1.15, Math.PI * 1.85);
      else { ctx.moveTo(cx + side * s * 0.36 - s * 0.14, ey); ctx.lineTo(cx + side * s * 0.36 + s * 0.14, ey); }
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#2b2233';
      ctx.beginPath(); ctx.ellipse(cx + side * s * 0.36, ey, s * 0.16, s * 0.21, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + side * s * 0.36 - s * 0.05, ey - s * 0.08, s * 0.065, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + side * s * 0.36 + s * 0.05, ey + s * 0.07, s * 0.03, 0, TAU); ctx.fill();
    }
  }
  // носик и рот
  ctx.fillStyle = '#ff7f9f';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.09, cy + s * 0.17); ctx.lineTo(cx + s * 0.09, cy + s * 0.17); ctx.lineTo(cx, cy + s * 0.27);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dark ? '#fff' : '#5a4050'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx - s * 0.09, cy + s * 0.28, s * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.arc(cx + s * 0.09, cy + s * 0.28, s * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  // усы
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(80,60,70,0.55)';
  ctx.lineWidth = s * 0.035;
  for (const side of [-1, 1]) {
    for (const dy of [-0.04, 0.08]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * s * 0.5, cy + s * (0.22 + dy));
      ctx.lineTo(cx + side * s * 1.02, cy + s * (0.16 + dy * 1.8));
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawKittenBubble(ctx, cx, cy, r, pal, fur, blink) {
  ctx.save();
  // цветная оболочка
  const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, pal.light);
  g.addColorStop(0.74, pal.base);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.07);
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.stroke();
  drawKittenFace(ctx, cx, cy + r * 0.15, r * 0.6, fur, blink);
  // блик поверх — котёнок «внутри» пузыря
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.38, cy - r * 0.55, r * 0.3, r * 0.14, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawStone(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#d9dde6');
  g.addColorStop(0.5, '#9aa2b3');
  g.addColorStop(1, '#5d6577');
  ctx.fillStyle = g;
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU + 0.3;
    const rr = r * (0.9 + 0.07 * Math.sin(i * 2.7));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,45,60,0.45)'; ctx.lineWidth = r * 0.08; ctx.stroke();
  ctx.strokeStyle = 'rgba(50,55,70,0.5)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.1); ctx.lineTo(cx, cy + r * 0.1); ctx.lineTo(cx + r * 0.1, cy + r * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.1); ctx.lineTo(cx + r * 0.35, cy - r * 0.05); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.45, r * 0.25, r * 0.12, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawBomb(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy + r * 0.1, r);
  g.addColorStop(0, '#7b7f93');
  g.addColorStop(0.5, '#3b3e4f');
  g.addColorStop(1, '#16171f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.08, r * 0.86, 0, TAU); ctx.fill();
  // горлышко
  ctx.fillStyle = '#555a6e';
  ctx.fillRect(cx - r * 0.2, cy - r * 0.86, r * 0.4, r * 0.24);
  // фитиль
  ctx.strokeStyle = '#c8955a'; ctx.lineWidth = r * 0.11; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.86); ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 1.1, cx + r * 0.45, cy - r * 0.95); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.33, cy - r * 0.25, r * 0.22, r * 0.13, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawSpark(ctx, x, y, r, t) {
  ctx.save();
  const k = 0.75 + 0.25 * Math.sin(t * 30);
  ctx.fillStyle = '#ffd23f';
  star(ctx, x, y, r * k, r * 0.45 * k, 5, t * 4);
  ctx.fill();
  ctx.fillStyle = '#ff7b2e';
  ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawRainbow(ctx, cx, cy, r) {
  ctx.save();
  const cols = PALETTE.map((p) => p.base);
  const n = cols.length;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r * 0.97, (i / n) * TAU - Math.PI / 2, ((i + 1) / n) * TAU - Math.PI / 2 + 0.02);
    ctx.closePath(); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, 0, TAU); ctx.fill();
  ctx.lineWidth = r * 0.07; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.stroke();
  glossy(ctx, cx, cy, r);
  ctx.restore();
}

export function drawFireball(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.3, '#ffd23f');
  g.addColorStop(0.7, '#ff6a1f');
  g.addColorStop(1, '#d8231c');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.95, 0, TAU); ctx.fill();
  // язычки пламени
  ctx.fillStyle = 'rgba(255,240,180,0.85)';
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i - 1) * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, r * 0.14, r * 0.28, a + Math.PI / 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function star(ctx, x, y, R, r, n = 5, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r : R;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

// ---------- Кошка-мама ----------
/**
 * Рисованный кот (спрайт): x, y — середина низа, h — высота «ожидания» в пикселях экрана.
 * Все эмоции нарезаны в одном масштабе, поэтому масштаб общий: по высоте спрайта idle (371 px).
 * Оживление: дыхание, прыжки от радости, лёгкое «оседание» в грусти.
 */
export function drawCatSprite(ctx, img, x, y, h, t, mood = 'idle') {
  const k = h / 371;
  const w = img.naturalWidth * k, hh = img.naturalHeight * k;
  const breathe = Math.sin(t * 2.2) * 0.014;
  const hop = mood === 'happy' ? -Math.abs(Math.sin(t * 7)) * h * 0.07 : 0;
  const squash = mood === 'sad' ? 0.97 : 1;
  ctx.save();
  ctx.translate(x, y + hop);
  ctx.scale(1 - breathe * 0.5, (1 + breathe) * squash);
  ctx.drawImage(img, -w / 2, -hh, w, hh);
  ctx.restore();
}

/**
 * x, y — точка «сидения» (низ), s — высота кошки в пикселях.
 * mood: 'idle' | 'happy' | 'sad'; look — угол взгляда (рад) или null.
 */
export function drawCat(ctx, x, y, s, t, mood = 'idle', look = null, blink = false) {
  const u = s / 100;
  ctx.save();
  ctx.translate(x, y);
  const breathe = 1 + Math.sin(t * 2.2) * 0.012;
  const hop = mood === 'happy' ? Math.abs(Math.sin(t * 9)) * -6 * u : 0;
  ctx.translate(0, hop);
  ctx.scale(1, breathe);
  const fur = '#ffa94d', furDark = '#f08a24', belly = '#fff1dc', line = 'rgba(120,60,20,0.45)';
  ctx.lineWidth = 2.2 * u; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // хвост
  const sway = Math.sin(t * 1.8) * 0.25;
  ctx.save();
  ctx.strokeStyle = furDark; ctx.lineWidth = 9 * u;
  ctx.beginPath();
  ctx.moveTo(24 * u, -8 * u);
  ctx.bezierCurveTo(52 * u, -6 * u, 50 * u + sway * 20 * u, -40 * u, 36 * u + sway * 30 * u, -58 * u);
  ctx.stroke();
  ctx.strokeStyle = fur; ctx.lineWidth = 6 * u;
  ctx.stroke();
  ctx.restore();

  // тело
  ctx.fillStyle = fur;
  ctx.beginPath(); ctx.ellipse(0, -30 * u, 30 * u, 32 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(0, -24 * u, 17 * u, 22 * u, 0, 0, TAU); ctx.fill();
  // лапки
  ctx.fillStyle = belly;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 12 * u, -3 * u, 9 * u, 6 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }

  // голова
  const hy = -70 * u;
  const tilt = mood === 'sad' ? 0.08 : look !== null ? Math.max(-0.12, Math.min(0.12, (look - Math.PI / 2) * -0.15)) : 0;
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(tilt);
  ctx.fillStyle = fur;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 27 * u, -6 * u);
    ctx.lineTo(side * 25 * u, -38 * u);
    ctx.lineTo(side * 6 * u, -24 * u);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3c4';
    ctx.beginPath();
    ctx.moveTo(side * 23 * u, -12 * u); ctx.lineTo(side * 22 * u, -31 * u); ctx.lineTo(side * 11 * u, -22 * u);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = fur;
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 31 * u, 27 * u, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // полоски
  ctx.strokeStyle = furDark; ctx.lineWidth = 3.5 * u;
  for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(dx * u, -26 * u); ctx.lineTo(dx * 0.8 * u, -17 * u); ctx.stroke(); }
  // мордочка
  ctx.fillStyle = belly;
  ctx.beginPath(); ctx.ellipse(0, 9 * u, 15 * u, 11 * u, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,150,0.4)';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * 19 * u, 7 * u, 5 * u, 3.4 * u, 0, 0, TAU); ctx.fill(); }
  // глаза
  const lx = look !== null ? Math.cos(look) * 2.2 * u : 0;
  const ly = look !== null ? -Math.sin(look) * 2.2 * u : 0;
  ctx.strokeStyle = '#2b2233'; ctx.lineWidth = 3 * u;
  for (const side of [-1, 1]) {
    const ex = side * 11 * u, ey = -3 * u;
    if (mood === 'happy') {
      ctx.beginPath(); ctx.arc(ex, ey + 2 * u, 5 * u, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (blink) {
      ctx.beginPath(); ctx.moveTo(ex - 5 * u, ey); ctx.lineTo(ex + 5 * u, ey); ctx.stroke();
    } else {
      ctx.fillStyle = '#2b2233';
      ctx.beginPath(); ctx.ellipse(ex + lx, ey + ly + (mood === 'sad' ? 1.5 * u : 0), 4.6 * u, (mood === 'sad' ? 4.6 : 6) * u, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex + lx - 1.4 * u, ey + ly - 2 * u, 1.7 * u, 0, TAU); ctx.fill();
      if (mood === 'sad') {
        ctx.beginPath(); ctx.moveTo(ex - 6 * u, ey - 8 * u + side * 0); ctx.lineTo(ex + 5 * u, ey - 9.5 * u - side * 1.5 * u); ctx.stroke();
      }
    }
  }
  // нос, рот
  ctx.fillStyle = '#ff7f9f';
  ctx.beginPath(); ctx.moveTo(-3.2 * u, 5 * u); ctx.lineTo(3.2 * u, 5 * u); ctx.lineTo(0, 8.5 * u); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 1.8 * u;
  ctx.beginPath();
  if (mood === 'sad') { ctx.arc(0, 15 * u, 4 * u, Math.PI * 1.15, Math.PI * 1.85); }
  else if (mood === 'happy') { ctx.fillStyle = '#c94a63'; ctx.arc(0, 10 * u, 4.5 * u, 0, Math.PI); ctx.fill(); }
  else { ctx.arc(-3 * u, 9 * u, 3 * u, 0.1 * Math.PI, 0.9 * Math.PI); ctx.moveTo(6 * u, 9 * u); ctx.arc(3 * u, 9 * u, 3 * u, 0.1 * Math.PI, 0.9 * Math.PI); }
  ctx.stroke();
  // усы
  ctx.strokeStyle = 'rgba(90,58,42,0.6)'; ctx.lineWidth = 1.2 * u;
  for (const side of [-1, 1]) {
    for (const dy of [-1.5, 2.5]) {
      ctx.beginPath(); ctx.moveTo(side * 13 * u, (8 + dy) * u); ctx.lineTo(side * 33 * u, (5 + dy * 1.8) * u); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

// ---------- Миры (фоны) ----------
export const THEMES = [
  { sky: ['#6fcfff', '#d6f5ff'], hills: ['#b6ec95', '#86d872', '#5fbf5f'], deco: 'meadow', ground: ['#78c95a', '#4fa845'], accent: '#3c8f3a' },
  { sky: ['#ff9fd0', '#ffe3f1'], hills: ['#ffc2e2', '#ff9dcf', '#f27bb9'], deco: 'candy', ground: ['#f78cc4', '#d9609f'], accent: '#c2457f' },
  { sky: ['#43c9ea', '#c4f5ff'], hills: ['#fbe7ac', '#f4d27e', '#e8bd5c'], deco: 'sea', ground: ['#f2d37c', '#d9b257'], accent: '#1f9fc4' },
  { sky: ['#ffbe73', '#fff0d4'], hills: ['#f4b067', '#e68a3a', '#c96a25'], deco: 'autumn', ground: ['#d9853b', '#b0632a'], accent: '#9a4f1c' },
  { sky: ['#8fcaff', '#eef8ff'], hills: ['#ffffff', '#e4f1ff', '#cfe3f7'], deco: 'snow', ground: ['#f4f9ff', '#d7e6f5'], accent: '#5d8fc4' },
  { sky: ['#1a2257', '#4b3a8f'], hills: ['#33408a', '#28336f', '#1d2658'], deco: 'night', ground: ['#2d3a7c', '#1f2a60'], accent: '#ffd76a' },
  { sky: ['#b99bff', '#f1e8ff'], hills: ['#cdb3ff', '#a988f0', '#8a64d8'], deco: 'lavender', ground: ['#9b78e0', '#7a56c4'], accent: '#6b45b5' },
  { sky: ['#ff8a5c', '#ffd89e'], hills: ['#f08f6a', '#d86c55', '#b0504a'], deco: 'sunset', ground: ['#c45f4f', '#9e4440'], accent: '#7d3333' },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

/**
 * Рисованный фон из картинки.
 * extend = false: «cover» с привязкой к низу (земля, на которой сидит кошка, всегда видна).
 * extend = true: вертикальная картинка на широком экране — размытая подложка на весь экран
 * и чёткая картинка по центру (под полем) с растушёванными краями.
 * s — масштаб холста (чтобы центральная картинка оставалась чёткой на экранах с высокой плотностью).
 */
export function drawPictureBg(ctx, img, w, h, extend, s = 1) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!extend) {
    const k = Math.max(w / iw, h / ih);
    ctx.drawImage(img, (w - iw * k) / 2, h - ih * k, iw * k, ih * k);
    return;
  }
  // 1) подложка: картинка по высоте экрана + зеркальные копии слева и справа (горизонт совпадает),
  //    затем мягкое размытие ступенчатым уменьшением/увеличением (работает везде, без ctx.filter)
  const cw = iw * (h / ih);
  const q = 8;
  const m = makeCanvas(w / q, h / q);
  const mx = m.getContext('2d');
  const tile = cw / q, th = h / q, x0 = (m.width - tile) / 2;
  for (let i = -Math.ceil(x0 / tile) - 1; x0 + i * tile < m.width; i++) {
    const x = x0 + i * tile;
    if (i % 2 === 0) mx.drawImage(img, x, 0, tile, th);
    else { mx.save(); mx.translate(x + tile, 0); mx.scale(-1, 1); mx.drawImage(img, 0, 0, tile, th); mx.restore(); }
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(softBlur(m, 3), 0, 0, w, h);
  ctx.fillStyle = 'rgba(255,250,240,0.16)';
  ctx.fillRect(0, 0, w, h);
  // 2) чёткая картинка по центру (под полем), края растушёваны
  const c = makeCanvas(cw * s, h * s);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, c.width, c.height);
  cx.globalCompositeOperation = 'destination-in';
  const g = cx.createLinearGradient(0, 0, c.width, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.16, 'rgba(0,0,0,1)');
  g.addColorStop(0.84, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(c, (w - cw) / 2, 0, cw, h);
  ctx.restore();
}

/** Мягкое размытие: steps раз уменьшить вдвое и столько же раз увеличить (близко к гауссову, без «квадратов») */
function softBlur(src, steps) {
  let c = src;
  const chain = [];
  for (let i = 0; i < steps; i++) {
    const d = makeCanvas(c.width / 2, c.height / 2);
    const x = d.getContext('2d'); x.imageSmoothingEnabled = true;
    x.drawImage(c, 0, 0, d.width, d.height);
    chain.push(c); c = d;
  }
  for (let i = steps - 1; i >= 0; i--) {
    const u = makeCanvas(chain[i].width, chain[i].height);
    const x = u.getContext('2d'); x.imageSmoothingEnabled = true;
    x.drawImage(c, 0, 0, u.width, u.height);
    c = u;
  }
  return c;
}

export function drawBackground(ctx, w, h, worldIdx) {
  const th = THEMES[worldIdx % THEMES.length];
  const R = rng(worldIdx * 977 + 13);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const m = Math.min(w, h);

  // солнце / луна / звёзды
  if (th.deco === 'night') {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`;
      const s = 0.6 + R() * 1.8;
      ctx.beginPath(); ctx.arc(R() * w, R() * h * 0.75, s, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fff4c2';
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.14, m * 0.07, 0, TAU); ctx.fill();
    ctx.fillStyle = th.sky[0];
    ctx.beginPath(); ctx.arc(w * 0.82 + m * 0.03, h * 0.14 - m * 0.02, m * 0.06, 0, TAU); ctx.fill();
  } else {
    const sg = ctx.createRadialGradient(w * 0.82, h * 0.12, 0, w * 0.82, h * 0.12, m * 0.22);
    sg.addColorStop(0, 'rgba(255,255,230,0.95)');
    sg.addColorStop(0.35, 'rgba(255,250,200,0.6)');
    sg.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    // облака
    for (let i = 0; i < 6; i++) {
      const cx = R() * w, cy = h * (0.06 + R() * 0.35), s = m * (0.05 + R() * 0.05);
      ctx.fillStyle = th.deco === 'sunset' ? 'rgba(255,230,210,0.7)' : 'rgba(255,255,255,0.75)';
      cloud(ctx, cx, cy, s);
    }
  }

  // холмы
  const base = [0.62, 0.72, 0.82];
  th.hills.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const amp = h * (0.035 + i * 0.01), freq = 1.5 + i * 0.7, ph = R() * 6;
    for (let x = 0; x <= w + 10; x += 10) {
      const y = h * base[i] + Math.sin(x / w * Math.PI * freq + ph) * amp + Math.sin(x / w * Math.PI * freq * 2.3 + ph) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    // декор на холмах
    decorate(ctx, th, i, w, h, base[i], R, m);
  });
}

function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.arc(x + s * 0.9, y + s * 0.15, s * 0.8, 0, TAU);
  ctx.arc(x - s * 0.9, y + s * 0.2, s * 0.7, 0, TAU);
  ctx.arc(x + s * 0.3, y - s * 0.45, s * 0.7, 0, TAU);
  ctx.fill();
}

function decorate(ctx, th, layer, w, h, base, R, m) {
  const n = 5 + layer * 3;
  for (let i = 0; i < n; i++) {
    const x = R() * w;
    const y = h * base + h * 0.02 + R() * h * 0.06 + layer * h * 0.015;
    const s = m * (0.012 + layer * 0.006) * (0.8 + R() * 0.5);
    switch (th.deco) {
      case 'meadow': {
        const cols = ['#fff', '#ffe066', '#ff8fab', '#b197fc'];
        ctx.fillStyle = cols[i % 4];
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s, y + Math.sin(a) * s, s * 0.7, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, TAU); ctx.fill();
        break;
      }
      case 'candy': {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - s * 0.15, y - s * 3, s * 0.3, s * 3);
        ctx.fillStyle = ['#ff6fb5', '#7ad3ff', '#ffd23f'][i % 3];
        ctx.beginPath(); ctx.arc(x, y - s * 3.2, s * 1.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.3;
        ctx.beginPath(); ctx.arc(x, y - s * 3.2, s * 0.6, 0, Math.PI * 1.5); ctx.stroke();
        break;
      }
      case 'sea': {
        if (layer === 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.ellipse(x, y, s * 2, s * 0.4, 0, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#ff9f6b';
          star(ctx, x, y, s * 1.2, s * 0.5, 5, R()); ctx.fill();
        }
        break;
      }
      case 'autumn': {
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x - s * 0.25, y - s * 3, s * 0.5, s * 3);
        ctx.fillStyle = ['#e8590c', '#f08c00', '#d9480f'][i % 3];
        ctx.beginPath(); ctx.arc(x, y - s * 3.6, s * 1.8, 0, TAU); ctx.arc(x - s, y - s * 2.8, s * 1.2, 0, TAU); ctx.arc(x + s, y - s * 2.8, s * 1.2, 0, TAU); ctx.fill();
        break;
      }
      case 'snow': {
        ctx.fillStyle = '#7fa8c9';
        ctx.beginPath(); ctx.moveTo(x, y - s * 4); ctx.lineTo(x - s * 1.6, y); ctx.lineTo(x + s * 1.6, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(x, y - s * 4); ctx.lineTo(x - s * 0.7, y - s * 2.3); ctx.lineTo(x + s * 0.7, y - s * 2.3); ctx.closePath(); ctx.fill();
        break;
      }
      case 'night': {
        ctx.fillStyle = 'rgba(255,230,120,0.85)';
        ctx.beginPath(); ctx.arc(x, y - s * 2, s * 0.35, 0, TAU); ctx.fill();
        break;
      }
      case 'lavender': {
        ctx.strokeStyle = '#5c940d'; ctx.lineWidth = s * 0.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 3); ctx.stroke();
        ctx.fillStyle = '#9775fa';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x, y - s * (2.2 + k * 0.5), s * 0.35, s * 0.25, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'sunset': {
        ctx.fillStyle = 'rgba(80,30,40,0.55)';
        ctx.fillRect(x - s * 0.2, y - s * 4, s * 0.4, s * 4);
        ctx.beginPath(); ctx.ellipse(x, y - s * 4.2, s * 1.8, s * 0.5, 0.3, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y - s * 4.2, s * 1.8, s * 0.5, -0.3, 0, TAU); ctx.fill();
        break;
      }
      default: break;
    }
  }
}
