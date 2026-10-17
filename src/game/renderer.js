import {
  FIELD_W, D, R, ROW_H, PALETTE, T_KITTEN, T_STONE, T_BOMB, S_BOMB, S_RAINBOW, S_FIRE,
  LAUNCH_AREA, LAUNCH_FROM_BOTTOM, ENDLESS_MAX_ROWS,
} from './constants.js';
import {
  makeCanvas, drawBubble, drawKittenBubble, drawKittenFace, drawStone, drawBomb, drawSpark,
  drawRainbow, drawFireball, drawCat, drawBackground, THEMES, star, heart,
} from './art.js';
import { NEXT_OFFSET } from './engine.js';
import { pointAt, pathLength } from './board.js';
import { audio, vibrate } from '../core/audio.js';
import { t, fmt } from '../core/i18n.js';

const TAU = Math.PI * 2;
const FONT = "'Nunito', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
const CAT_X = 58;            // мировые координаты кошки (по X)
const CAT_H = 92;            // высота кошки в мировых единицах

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1; this.w = 1; this.h = 1;
    this.L = null;
    this.world = 0;
    this.bg = null; this.bgKey = '';
    this.sprites = new Map(); this.spriteR = 0;
    this.engine = null;
    this.time = 0;
    this.parts = [];
    this.popping = [];
    this.wobble = new Map();
    this.squash = new Map();
    this.ambient = [];
    this.praise = null;
    this.catMood = 'idle'; this.catMoodT = 0;
    this.catBlink = 0; this.catBlinkT = 2.5;
    this.kBlink = 0;
    this.vibro = true;
    this.counter = 0;
    this.lowFx = false;
  }

  // ---------- Размеры ----------
  resize(w, h, dpr, layout) {
    this.w = w; this.h = h; this.dpr = dpr; this.L = layout;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.bgKey = '';
    const r = Math.max(4, Math.round(R * layout.scale * dpr));
    if (r !== this.spriteR) { this.spriteR = r; this.sprites.clear(); }
    this.ensureBg();
    if (!this.ambient.length) this.initAmbient();
  }

  setWorld(i) { if (i !== this.world) { this.world = i; this.bgKey = ''; this.ensureBg(); } }

  ensureBg() {
    const key = `${this.world}|${this.w}x${this.h}|${this.dpr}`;
    if (key === this.bgKey) return;
    this.bgKey = key;
    const s = Math.min(this.dpr, 1.5);
    const c = makeCanvas(this.w * s, this.h * s);
    const x = c.getContext('2d');
    x.scale(s, s);
    drawBackground(x, this.w, this.h, this.world);
    this.bg = c;
  }

  initAmbient() {
    this.ambient = [];
    for (let i = 0; i < 14; i++) this.ambient.push(this.newAmbient(true));
  }

  newAmbient(anywhere) {
    return {
      x: Math.random(), y: anywhere ? Math.random() : 1.1,
      r: 4 + Math.random() * 14, v: 0.012 + Math.random() * 0.025, ph: Math.random() * 6,
    };
  }

  setEngine(engine) {
    this.engine = engine;
    this.parts.length = 0;
    this.popping.length = 0;
    this.wobble.clear();
    this.squash.clear();
    this.praise = null;
    this.catMood = 'idle';
  }

  // ---------- Координаты ----------
  sx(wx) { return this.L.fx + wx * this.L.scale; }
  sy(wy) { return this.L.fy + (wy - (this.engine ? this.engine.camY : 0)) * this.L.scale; }

  // ---------- Спрайты ----------
  sprite(key, draw) {
    let s = this.sprites.get(key);
    if (!s) {
      const r = this.spriteR;
      const size = Math.ceil(r * 2.7);
      s = makeCanvas(size, size);
      const x = s.getContext('2d');
      draw(x, size / 2, size / 2, r);
      this.sprites.set(key, s);
    }
    return s;
  }

  bubbleSprite(color, type = 0, kitten = 0, blink = false) {
    if (type === T_KITTEN) {
      return this.sprite(`k${color}_${kitten}_${blink ? 1 : 0}`, (x, cx, cy, r) => drawKittenBubble(x, cx, cy, r, PALETTE[color], kitten, blink));
    }
    if (type === T_STONE) return this.sprite('stone', (x, cx, cy, r) => drawStone(x, cx, cy, r));
    if (type === T_BOMB) return this.sprite('bomb', (x, cx, cy, r) => drawBomb(x, cx, cy, r));
    if (color === 'rainbow') return this.sprite('rainbow', (x, cx, cy, r) => drawRainbow(x, cx, cy, r));
    if (color === 'fire') return this.sprite('fire', (x, cx, cy, r) => drawFireball(x, cx, cy, r));
    if (color === 'bombshot') return this.sprite('bomb', (x, cx, cy, r) => drawBomb(x, cx, cy, r));
    return this.sprite(`b${color}`, (x, cx, cy, r) => drawBubble(x, cx, cy, r, PALETTE[color] || PALETTE[0]));
  }

  kittenFace(fur, happy) {
    return this.sprite(`kf${fur}_${happy ? 1 : 0}`, (x, cx, cy, r) => drawKittenFace(x, cx, cy + r * 0.1, r * 0.62, fur, false, happy));
  }

  drawSprite(spr, x, y, scale = 1, alpha = 1) {
    const ctx = this.ctx;
    const size = (spr.width / this.dpr) * scale;
    if (alpha !== 1) ctx.globalAlpha = alpha;
    ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  specialSprite(sp) {
    if (sp === S_BOMB) return this.bubbleSprite('bombshot');
    if (sp === S_RAINBOW) return this.bubbleSprite('rainbow');
    if (sp === S_FIRE) return this.bubbleSprite('fire');
    return null;
  }

  // ---------- События движка ----------
  onEvent(type, d) {
    const e = this.engine;
    switch (type) {
      case 'shoot':
        audio.play(d.special === S_FIRE ? 'fire' : 'shoot');
        break;
      case 'bounce': audio.play('bounce'); this.burst(d.x, d.y, '#ffffff', 4, 60, 0.25); break;
      case 'land': {
        audio.play('land');
        this.squash.set(d.b.id, 0);
        this.impulse(d.x, d.y, d.removed > 0 ? 1.4 : 1);
        break;
      }
      case 'pop': {
        const base = this.time;
        const step = Math.min(0.045, 0.5 / Math.max(1, d.list.length));
        d.list.forEach((it, i) => {
          this.popping.push({ b: it.b, x: it.xy[0], y: it.xy[1], at: base + i * step, idx: i, kind: 'pop' });
        });
        if (this.vibro) vibrate(12);
        break;
      }
      case 'explode': {
        const base = this.time;
        d.list.forEach((it, i) => {
          this.popping.push({ b: it.b, x: it.xy[0], y: it.xy[1], at: base + (d.fire ? 0 : i * 0.015), idx: i, kind: d.fire ? 'burn' : 'explode' });
        });
        if (!d.fire) { audio.play('bomb'); this.shake = 0.35; this.ring(d.x, d.y, '#ffb347', 2.6); if (this.vibro) vibrate(40); }
        break;
      }
      case 'burn': this.burst(d.x, d.y, '#ff8a2b', 8, 160, 0.5); break;
      case 'bomb': break;
      case 'rainbow': audio.play('rainbow'); this.ring(d.x, d.y, '#ffffff', 2); break;
      case 'drop': {
        d.list.forEach((it, i) => {
          const b = it.b;
          this.parts.push({
            k: 'fall', x: it.xy[0], y: it.xy[1], vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 140,
            color: b.color, type: b.type === T_KITTEN ? 0 : b.type, delay: d.final ? i * 0.012 : 0, life: 3,
          });
        });
        if (d.list.length) audio.play('drop');
        break;
      }
      case 'kittens': {
        d.list.forEach((it, i) => {
          const pend = this.popping.find((p) => p.b.id === it.b.id);
          const delay = pend ? Math.max(0, pend.at - this.time) : 0.05 + i * 0.12;
          this.parts.push({ k: 'kitten', x0: it.xy[0], y0: it.xy[1], t: -delay, dur: 1.05, fur: it.b.kitten || 0, life: 9 });
        });
        break;
      }
      case 'score': {
        if (d.amount > 0) this.parts.push({ k: 'text', x: d.x, y: d.y, vy: -55, life: 1.1, max: 1.1, text: '+' + fmt(d.amount), size: d.amount >= 300 ? 26 : 20 });
        break;
      }
      case 'praise': {
        const txt = t('praise' + d.level);
        this.praise = { text: txt, t: 0, level: d.level };
        audio.play('praise', d.level);
        this.mood('happy', 1.2);
        break;
      }
      case 'swap': audio.play('swap'); break;
      case 'special': audio.play('special'); break;
      case 'goalReached': {
        audio.play('win');
        this.mood('happy', 3);
        this.confetti();
        break;
      }
      case 'bonusShot': {
        const [lx, ly] = e.launcher();
        const n = d.count || 1;
        for (let i = 0; i < Math.min(n, 12); i++) {
          this.parts.push({ k: 'bonus', x: lx, y: ly, vx: (Math.random() - 0.5) * 260, vy: -700 - Math.random() * 250, life: 0.45 + i * 0.03, color: Math.floor(Math.random() * 7), amount: (n > 12 && i === 0) ? n * 100 : 100 });
        }
        audio.play('bonus', this.counter++);
        break;
      }
      case 'push': audio.play('push'); this.shake = 0.25; break;
      case 'outOfShots': this.mood('sad', 99); audio.play('lose'); break;
      case 'gameOver': this.mood('sad', 99); audio.play('lose'); break;
      case 'failed': this.mood('sad', 99); break;
      case 'complete': this.mood('happy', 99); break;
      case 'ready': this.mood('idle', 0); break;
      default: break;
    }
  }

  mood(m, dur) { this.catMood = m; this.catMoodT = dur; }

  impulse(x, y, strength) {
    const e = this.engine;
    const lim = D * 2.4;
    e.board.forEach((b, r, c) => {
      const bx = e.board.x(r, c), by = e.board.y(r);
      const dx = bx - x, dy = by - y;
      const d = Math.hypot(dx, dy);
      if (d < 1 || d > lim) return;
      const f = (1 - d / lim) * 190 * strength;
      let w = this.wobble.get(b.id);
      if (!w) { w = { ox: 0, oy: 0, vx: 0, vy: 0 }; this.wobble.set(b.id, w); }
      w.vx += (dx / d) * f; w.vy += (dy / d) * f;
    });
  }

  burst(x, y, color, n, speed, life) {
    if (this.lowFx) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({ k: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, r: 2.2 + Math.random() * 3 });
    }
  }

  ring(x, y, color, size) { this.parts.push({ k: 'ring', x, y, life: 0.45, max: 0.45, color, size }); }

  confetti() {
    const cols = PALETTE.map((p) => p.base);
    const n = this.lowFx ? 40 : 80;
    for (let i = 0; i < n; i++) {
      this.parts.push({
        k: 'confetti', sx: this.w * (0.2 + Math.random() * 0.6), sy: this.h * 0.35, vx: (Math.random() - 0.5) * this.w * 1.2,
        vy: -this.h * (0.4 + Math.random() * 0.6), life: 2.6, max: 2.6, color: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 5 + Math.random() * 6,
      });
    }
  }

  // ---------- Кадр ----------
  frame(dt) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    this.drawAmbient(dt);
    if (this.engine && this.L) {
      ctx.save();
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        const m = this.shake * 10;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      }
      this.drawGame(dt);
      ctx.restore();
    }
    this.drawScreenParts(dt);
  }

  drawAmbient(dt) {
    const ctx = this.ctx;
    const th = THEMES[this.world % THEMES.length];
    const snow = th.deco === 'snow';
    for (const a of this.ambient) {
      a.y -= a.v * dt * (snow ? -1 : 1);
      if (!snow && a.y < -0.1) Object.assign(a, this.newAmbient(false));
      if (snow && a.y > 1.1) { Object.assign(a, this.newAmbient(false)); a.y = -0.1; }
      const x = (a.x + Math.sin(this.time * 0.6 + a.ph) * 0.015) * this.w;
      const y = a.y * this.h;
      if (snow) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x, y, a.r * 0.3, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, a.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(x - a.r * 0.35, y - a.r * 0.35, a.r * 0.2, 0, TAU); ctx.fill();
      }
    }
  }

  drawGame(dt) {
    const ctx = this.ctx, e = this.engine, L = this.L;
    const s = L.scale;
    const launchTop = L.fy + (L.viewH - LAUNCH_AREA) * s;
    const [lxW, lyW] = e.launcher();
    const lx = this.sx(lxW), ly = this.sy(lyW);
    const groundY = ly + 22 * s;

    // Панель поля
    const top = Math.max(L.fy - 2, this.sy(-8));
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, L.fx + 1, top, L.fw - 2, groundY - top + 4, Math.min(18, 14 * s));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Обрезка по полю
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.fx, L.fy, L.fw, groundY - L.fy);
    ctx.clip();

    // Потолок
    const ceilY = this.sy(0);
    if (ceilY > L.fy - 20 * s) {
      const th = THEMES[this.world % THEMES.length];
      ctx.fillStyle = th.accent;
      ctx.globalAlpha = 0.85;
      roundRect(ctx, L.fx + 4, ceilY - 7 * s, L.fw - 8, 7 * s, 3 * s);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Пружинки «покачивания»
    this.updateWobble(dt);
    this.kBlink -= dt;
    const blinkOn = this.kBlink < 0.12 && this.kBlink > 0;
    if (this.kBlink < 0) this.kBlink = 2.5 + Math.random() * 2.5;

    // Шарики на поле
    const board = e.board;
    const rowMin = Math.max(0, Math.floor((e.camY - D) / ROW_H) - 1);
    for (let r = rowMin; r < board.rows.length; r++) {
      const row = board.rows[r];
      const y0 = board.y(r);
      const syy = this.sy(y0);
      if (syy < L.fy - D * s) continue;
      if (syy > groundY + D * s) break;
      for (let c = 0; c < row.length; c++) {
        const b = row[c];
        if (!b) continue;
        const w = this.wobble.get(b.id);
        const x = this.sx(board.x(r, c) + (w ? w.ox : 0));
        const y = this.sy(y0 + (w ? w.oy : 0));
        let sc = 1;
        const sq = this.squash.get(b.id);
        if (sq !== undefined) {
          const tt = sq / 0.22;
          sc = 1 + 0.16 * Math.sin(tt * Math.PI) * (1 - tt);
          if (sq > 0.22) this.squash.delete(b.id); else this.squash.set(b.id, sq + dt);
        }
        const blink = b.type === T_KITTEN && blinkOn && ((b.id * 7) % 3 === 0);
        this.drawSprite(this.bubbleSprite(b.color, b.type, b.kitten, blink), x, y, sc);
        if (b.type === T_BOMB) drawSpark(ctx, x + R * 0.48 * s, y - R * 0.98 * s, R * 0.32 * s, this.time + b.id);
      }
    }

    // Лопающиеся шарики (ещё видимые до своей очереди)
    this.updatePopping();

    // Прицел
    this.drawAim(lx, ly);

    // Снаряд
    const p = e.projectile;
    if (p) {
      const spr = p.special ? this.specialSprite(p.special) : this.bubbleSprite(p.color);
      // шлейф
      for (let i = 1; i <= 4; i++) {
        const [tx, ty] = pointAt(p.pts, Math.max(0, p.dist - i * 14));
        this.drawSprite(spr, this.sx(tx), this.sy(ty), 1 - i * 0.12, 0.35 - i * 0.07);
      }
      this.drawSprite(spr, this.sx(p.x), this.sy(p.y));
      if (p.special === S_FIRE && Math.random() < 0.9) {
        this.parts.push({ k: 'shard', x: p.x + (Math.random() - 0.5) * 14, y: p.y + (Math.random() - 0.5) * 14, vx: 0, vy: 40, life: 0.35, max: 0.35, color: Math.random() < 0.5 ? '#ffd23f' : '#ff6a1f', r: 3 + Math.random() * 4 });
      }
      if (p.special === S_BOMB) drawSpark(ctx, this.sx(p.x) + R * 0.48 * s, this.sy(p.y) - R * 0.98 * s, R * 0.32 * s, this.time);
    }

    // Линия опасности (бесконечный режим)
    if (e.mode === 'endless') {
      const dy = this.sy(R + ENDLESS_MAX_ROWS * ROW_H - R * 0.9);
      const danger = board.lowestRow() >= ENDLESS_MAX_ROWS - 2;
      ctx.strokeStyle = danger ? `rgba(255,40,60,${0.6 + 0.4 * Math.sin(this.time * 8)})` : 'rgba(255,70,90,0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(L.fx + 4, dy); ctx.lineTo(L.fx + L.fw - 4, dy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Частицы в мире
    this.drawWorldParts(dt, groundY);
    ctx.restore();

    // Земля и зона запуска
    this.drawLaunchArea(dt, lx, ly, groundY, launchTop);
    this.drawFlyingKittens(dt);
  }

  updateWobble(dt) {
    const K = 420, C = 16;
    for (const [id, w] of this.wobble) {
      w.vx += (-K * w.ox - C * w.vx) * dt;
      w.vy += (-K * w.oy - C * w.vy) * dt;
      w.ox += w.vx * dt; w.oy += w.vy * dt;
      if (Math.abs(w.ox) < 0.05 && Math.abs(w.oy) < 0.05 && Math.abs(w.vx) < 1 && Math.abs(w.vy) < 1) this.wobble.delete(id);
    }
  }

  updatePopping() {
    const now = this.time;
    const s = this.L.scale;
    for (let i = this.popping.length - 1; i >= 0; i--) {
      const p = this.popping[i];
      const x = this.sx(p.x), y = this.sy(p.y);
      if (now < p.at) {
        this.drawSprite(this.bubbleSprite(p.b.color, p.b.type, p.b.kitten), x, y);
        continue;
      }
      this.popping.splice(i, 1);
      const pal = PALETTE[p.b.color];
      const col = p.b.type === T_STONE ? '#a3abbb' : p.b.type === T_BOMB ? '#444' : pal ? pal.base : '#fff';
      if (p.kind === 'pop') {
        audio.play('pop', p.idx);
        this.burst(p.x, p.y, col, 9, 220, 0.55);
        this.ring(p.x, p.y, pal ? pal.light : '#fff', 1);
      } else if (p.kind === 'burn') {
        audio.play('pop', 2);
        this.burst(p.x, p.y, '#ff8a2b', 7, 200, 0.5);
        this.burst(p.x, p.y, col, 5, 160, 0.5);
      } else {
        this.burst(p.x, p.y, col, 7, 300, 0.6);
        this.burst(p.x, p.y, '#ffcf5a', 4, 250, 0.4);
      }
      void s;
    }
  }

  drawAim(lx, ly) {
    const e = this.engine;
    const tr = e.aimTrace();
    if (!tr) return;
    const ctx = this.ctx, s = this.L.scale;
    const pts = tr.pts;
    const total = pathLength(pts);
    const fire = e.special === S_FIRE;
    const col = e.special ? (fire ? { base: '#ff7b2e', light: '#ffd8a8' } : { base: '#ffffff', light: '#ffffff' }) : PALETTE[e.cur];
    const gap = 21;
    const off = (this.time * 70) % gap;
    const maxLen = fire ? Math.min(total, 1600) : total;
    for (let d = 30 + off; d < maxLen - 8; d += gap) {
      const [x, y] = pointAt(pts, d);
      const k = 1 - d / (maxLen + 400) * 0.45;
      const rr = 4.4 * s * k;
      ctx.fillStyle = col.light;
      ctx.beginPath(); ctx.arc(this.sx(x), this.sy(y), rr, 0, TAU); ctx.fill();
      ctx.lineWidth = Math.max(1, 1.4 * s);
      ctx.strokeStyle = col.base;
      ctx.stroke();
    }
    if (!fire && tr.cell) {
      const [r, c] = tr.cell;
      const gx = this.sx(e.board.x(r, c)), gy = this.sy(e.board.y(r));
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(this.time * 6);
      ctx.setLineDash([5 * s, 4 * s]);
      ctx.lineWidth = 2.4 * s;
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(gx, gy, R * 0.86 * s, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  drawLaunchArea(dt, lx, ly, groundY, launchTop) {
    const ctx = this.ctx, e = this.engine, L = this.L, s = L.scale;
    const th = THEMES[this.world % THEMES.length];
    // земля во всю ширину
    const g = ctx.createLinearGradient(0, groundY, 0, this.h);
    g.addColorStop(0, th.ground[0]);
    g.addColorStop(1, th.ground[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, this.h);
    for (let x = 0; x <= this.w + 20; x += 20) {
      ctx.lineTo(x, groundY + Math.sin(x * 0.03 + 1.3) * 3 * s + (Math.abs(x - lx) < 70 * s ? -4 * s * Math.cos((x - lx) / (70 * s) * Math.PI / 2) : 0));
    }
    ctx.lineTo(this.w, this.h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();

    // кошка-мама
    this.catBlinkT -= dt;
    if (this.catBlinkT < 0) { this.catBlink = 0.13; this.catBlinkT = 2.5 + Math.random() * 3; }
    if (this.catBlink > 0) this.catBlink -= dt;
    if (this.catMoodT > 0) { this.catMoodT -= dt; if (this.catMoodT <= 0) this.catMood = 'idle'; }
    const look = e.aim.active ? e.aim.angle : null;
    const catX = this.sx(CAT_X), catY = groundY + 4 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(catX, catY, 34 * s, 6 * s, 0, 0, TAU); ctx.fill();
    drawCat(ctx, catX, catY, CAT_H * s, this.time, this.catMood, look, this.catBlink > 0);

    // подставка пушки
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath(); ctx.ellipse(lx, groundY + 3 * s, 30 * s, 6 * s, 0, 0, TAU); ctx.fill();
    const ringG = ctx.createLinearGradient(0, ly - 28 * s, 0, ly + 28 * s);
    ringG.addColorStop(0, '#fff7e6');
    ringG.addColorStop(1, '#e8c79a');
    ctx.strokeStyle = ringG;
    ctx.lineWidth = 6 * s;
    ctx.beginPath(); ctx.arc(lx, ly, R * 1.3 * s, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,80,40,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(lx, ly, R * 1.3 * s + 3 * s, 0, TAU); ctx.stroke();
    // стрелка направления
    if (e.aim.active && e.state === 'aim') {
      const a = e.aim.angle;
      const ax = lx + Math.cos(a) * R * 1.9 * s, ay = ly - Math.sin(a) * R * 1.9 * s;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(-a + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -7 * s); ctx.lineTo(6 * s, 3 * s); ctx.lineTo(-6 * s, 3 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // следующий шарик
    const nx = lx + NEXT_OFFSET[0] * s, ny = ly + NEXT_OFFSET[1] * s;
    const showBubbles = e.state !== 'won' && e.state !== 'lost' && e.state !== 'over';
    if (showBubbles && e.mode !== 'none') {
      const swapK = e.swapT;
      const reload = e.reloadT;
      // текущий
      let cx = lx, cy = ly;
      let ncx = nx, ncy = ny, nScale = 0.74 * (1 - reload);
      if (reload > 0) { cx = nx + (lx - nx) * (1 - reload); cy = ny + (ly - ny) * (1 - reload) - Math.sin((1 - reload) * Math.PI) * 14 * s; }
      if (swapK > 0) {
        const k = 1 - swapK;
        cx = nx + (lx - nx) * k; cy = ny + (ly - ny) * k - Math.sin(k * Math.PI) * 16 * s;
        ncx = lx + (nx - lx) * k; ncy = ly + (ny - ly) * k + Math.sin(k * Math.PI) * 10 * s;
        nScale = 1 - 0.26 * k;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath(); ctx.ellipse(nx, ny + R * 0.8 * s, 15 * s, 4 * s, 0, 0, TAU); ctx.fill();
      if (e.state !== 'win-seq' || e.shotsLeft > 0) {
        if (nScale > 0.02 && e.shotsLeft > 1) this.drawSprite(this.bubbleSprite(e.next), ncx, ncy, nScale);
        if (e.special && !e.projectile) this.drawSprite(this.specialSprite(e.special), lx, ly, 1 + Math.sin(this.time * 8) * 0.04);
        else if (e.shotsLeft > 0 && (e.state !== 'flying' || reload < 1)) this.drawSprite(this.bubbleSprite(e.cur), cx, cy, 1);
        if (e.special === S_BOMB && !e.projectile) drawSpark(ctx, lx + R * 0.48 * s, ly - R * 0.98 * s, R * 0.32 * s, this.time);
      }
      // значок «поменять»
      if (e.state === 'aim' && !e.special && e.shotsLeft > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
        const ax = (lx + nx) / 2, ay = ly - 4 * s;
        ctx.beginPath(); ctx.arc(ax, ay + 10 * s, 13 * s, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax + 7.5 * s, ay - 1.5 * s); ctx.lineTo(ax + 11 * s, ay + 0.5 * s); ctx.lineTo(ax + 8 * s, ay + 3.5 * s); ctx.stroke();
        ctx.restore();
      }
    }

    // счётчик выстрелов
    if (e.mode === 'level') {
      const n = e.shotsLeft;
      const txt = String(n);
      const bw = Math.max(34, 18 + txt.length * 11) * s, bh = 22 * s;
      const bx = lx - bw / 2, by = ly + R * 1.3 * s + 5 * s;
      const warn = n <= 3 && e.state === 'aim';
      ctx.fillStyle = warn ? `rgba(230,40,70,${0.85 + 0.15 * Math.sin(this.time * 9)})` : 'rgba(40,30,70,0.72)';
      roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${Math.round(16 * s)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, lx, by + bh / 2 + 1);
    } else if (e.mode === 'endless') {
      // точки «до нового ряда»
      const left = e.missLimit - e.misses;
      const n = e.missLimit;
      const y = ly + R * 1.3 * s + 14 * s;
      for (let i = 0; i < n; i++) {
        const x = lx + (i - (n - 1) / 2) * 12 * s;
        ctx.fillStyle = i < left ? '#fff' : 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, TAU); ctx.fill();
        if (i < left && left <= 1) { ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }
  }

  drawWorldParts(dt, groundY) {
    const ctx = this.ctx, s = this.L.scale;
    const groundW = this.engine.camY + (groundY - this.L.fy) / s;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (p.k === 'kitten' || p.k === 'confetti') continue;
      if (p.delay > 0) { p.delay -= dt; if (p.k === 'fall') this.drawSprite(this.bubbleSprite(p.color, p.type), this.sx(p.x), this.sy(p.y)); continue; }
      p.life -= dt;
      if (p.life <= 0) {
        if (p.k === 'bonus') {
          this.burst(p.x, p.y, PALETTE[p.color].base, 10, 240, 0.6);
          this.parts.push({ k: 'text', x: p.x, y: p.y, vy: -40, life: 0.9, max: 0.9, text: '+' + fmt(p.amount), size: 18 });
          audio.play('pop', 4 + (this.counter % 5));
        }
        this.parts.splice(i, 1);
        continue;
      }
      switch (p.k) {
        case 'shard': {
          p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          const a = p.life / p.max;
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), p.r * s * (0.5 + a * 0.5), 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'ring': {
          const k = 1 - p.life / p.max;
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = p.color; ctx.lineWidth = 3 * s * (1 - k) + 1;
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), R * s * (0.6 + k * p.size), 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'fall': {
          p.vy += 1700 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < R) { p.x = R; p.vx = Math.abs(p.vx) * 0.5; }
          if (p.x > FIELD_W - R) { p.x = FIELD_W - R; p.vx = -Math.abs(p.vx) * 0.5; }
          if (p.y > groundW - R * 0.5) {
            const pal = PALETTE[p.color];
            this.parts.splice(i, 1);
            this.burst(p.x, groundW - R * 0.6, pal ? pal.base : '#aab', 6, 180, 0.4);
            this.parts.push({ k: 'star', x: p.x, y: groundW - R, vy: -90, life: 0.6, max: 0.6 });
            audio.play('thud');
            break;
          }
          this.drawSprite(this.bubbleSprite(p.color, p.type), this.sx(p.x), this.sy(p.y));
          break;
        }
        case 'star': {
          p.y += p.vy * dt;
          const a = p.life / p.max;
          ctx.globalAlpha = a;
          ctx.fillStyle = '#fff6b0';
          star(ctx, this.sx(p.x), this.sy(p.y), 6 * s, 2.6 * s, 4, this.time * 3);
          ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'text': {
          p.y += p.vy * dt;
          const a = Math.min(1, p.life / p.max * 2);
          const k = 1 + Math.max(0, (p.life - p.max + 0.15)) * 3;
          ctx.globalAlpha = a;
          ctx.font = `900 ${Math.round(p.size * s * k)}px ${FONT}`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4 * s; ctx.strokeStyle = 'rgba(60,30,90,0.8)';
          ctx.strokeText(p.text, this.sx(p.x), this.sy(p.y));
          ctx.fillStyle = '#fff';
          ctx.fillText(p.text, this.sx(p.x), this.sy(p.y));
          ctx.globalAlpha = 1;
          break;
        }
        case 'bonus': {
          p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          this.drawSprite(this.bubbleSprite(p.color), this.sx(p.x), this.sy(p.y), 0.8);
          break;
        }
        default: break;
      }
    }
  }

  drawFlyingKittens(dt) {
    const ctx = this.ctx, s = this.L.scale, e = this.engine;
    const groundY = this.sy(e.launcher()[1]) + 22 * s;
    const tx = this.sx(CAT_X), ty = groundY - CAT_H * s * 0.62;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (p.k !== 'kitten') continue;
      p.t += dt;
      if (p.t < 0) continue;
      const k = Math.min(1, p.t / p.dur);
      const x0 = this.sx(p.x0), y0 = this.sy(p.y0);
      const cx = (x0 + tx) / 2, cy = Math.min(y0, ty) - 90 * s;
      const e1 = 1 - (1 - k) * (1 - k);
      const x = (1 - e1) * (1 - e1) * x0 + 2 * (1 - e1) * e1 * cx + e1 * e1 * tx;
      const y = (1 - e1) * (1 - e1) * y0 + 2 * (1 - e1) * e1 * cy + e1 * e1 * ty;
      if (k === 1 || p.t < dt * 1.01) {
        if (p.t < dt * 1.01) { audio.play('kitten'); this.burstScreen(x0, y0, '#ffffff', 10); }
      }
      if (k >= 1) {
        this.parts.splice(i, 1);
        for (let h = 0; h < 5; h++) this.parts.push({ k: 'heartS', x: tx + (Math.random() - 0.5) * 40 * s, y: ty, vy: -60 - Math.random() * 60, vx: (Math.random() - 0.5) * 40, life: 1.1, max: 1.1, s: (5 + Math.random() * 4) * s });
        this.mood('happy', 1.1);
        continue;
      }
      const sc = 1.15 - 0.45 * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(p.t * 10) * 0.25);
      const spr = this.kittenFace(p.fur, true);
      this.drawSprite(spr, 0, 0, sc);
      ctx.restore();
    }
  }

  burstScreen(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = 80 + Math.random() * 140;
      this.parts.push({ k: 'sparkS', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, color });
    }
  }

  drawScreenParts(dt) {
    const ctx = this.ctx;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      if (p.k !== 'confetti' && p.k !== 'heartS' && p.k !== 'sparkS') continue;
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const a = Math.min(1, p.life / p.max * 2.5);
      ctx.globalAlpha = a;
      if (p.k === 'confetti') {
        p.vy += this.h * 0.9 * dt; p.vx *= 0.985; p.sx += p.vx * dt; p.sy += p.vy * dt; p.rot += p.vr * dt;
        ctx.save(); ctx.translate(p.sx, p.sy); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      } else if (p.k === 'heartS') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.fillStyle = '#ff5c8a';
        heart(ctx, p.x, p.y, p.s); ctx.fill();
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.fillStyle = p.color;
        star(ctx, p.x, p.y, 5, 2, 4, p.life * 6); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Похвала
    if (this.praise && this.L) {
      const pr = this.praise;
      pr.t += dt;
      const dur = 1.25;
      if (pr.t > dur) { this.praise = null; return; }
      const k = pr.t / dur;
      const sc = k < 0.15 ? 0.4 + (k / 0.15) * 0.8 : k < 0.25 ? 1.2 - ((k - 0.15) / 0.1) * 0.2 : 1;
      const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const x = this.L.fx + this.L.fw / 2, y = this.L.fy + this.L.viewH * this.L.scale * 0.42 - k * 30;
      const size = Math.round(Math.min(this.L.fw * 0.12, 54) * sc);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = size * 0.16; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7b2fbf';
      ctx.strokeText(pr.text, x, y);
      const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      g.addColorStop(0, '#fff6a8'); g.addColorStop(1, '#ffb22e');
      ctx.fillStyle = g;
      ctx.fillText(pr.text, x, y);
      ctx.restore();
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
