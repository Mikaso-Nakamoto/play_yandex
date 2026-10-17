// Интерфейс уровня: верхняя панель, бустеры, баннер уровня, подсказки обучения.
import { h, bump } from './dom.js';
import { icon } from './icons.js';
import { t, fmt, kittensWord } from '../core/i18n.js';
import { store } from '../core/storage.js';
import { FIELD_W, LAUNCH_FROM_BOTTOM } from '../game/constants.js';

export const BOOSTERS = ['bomb', 'rainbow', 'fire'];

export class Hud {
  constructor(app) {
    this.app = app;
    this.el = h('div', { id: 'game-ui', class: 'hidden', style: { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', pointerEvents: 'none' } });
    this.levelLbl = h('b', null, '');
    this.goalIcon = h('span', { html: icon('kitten') });
    this.goalVal = h('b', null, '0');
    this.scoreVal = h('div', { class: 'val' }, h('b', null, '0'));
    this.fill = h('div', { class: 'fill' });
    this.mk2 = h('span', { class: 'mk', html: icon('starOff') });
    this.mk3 = h('span', { class: 'mk', html: icon('starOff') });
    this.mk1 = h('span', { class: 'mk', html: icon('starOn') });
    this.starbar = h('div', { class: 'starbar' }, this.fill, this.mk1, this.mk2, this.mk3);
    this.goalPill = h('div', { class: 'pill hud-goal' }, this.goalIcon, this.goalVal);
    this.levelPill = h('div', { class: 'pill hud-level' }, this.levelLbl);
    this.scorePill = h('div', { class: 'pill hud-score' }, this.scoreVal, this.starbar);
    this.pauseBtn = h('button', { class: 'round', 'aria-label': 'pause', html: icon('pause'), onclick: () => app.openPause() });
    this.top = h('div', { id: 'hud' },
      this.pauseBtn,
      h('div', { class: 'hud-mid' }, this.levelPill, this.goalPill),
      this.scorePill,
    );
    this.boostWrap = h('div', { id: 'boosters' });
    this.boostBtns = {};
    BOOSTERS.forEach((b, i) => {
      const badge = h('span', { class: 'badge' }, '0');
      const btn = h('button', { class: 'boost', 'aria-label': b, html: icon(b), onclick: () => app.onBoosterTap(b) });
      btn.appendChild(badge);
      btn._badge = badge;
      btn._i = i;
      this.boostBtns[b] = btn;
      this.boostWrap.appendChild(btn);
    });
    this.banner = h('div', { id: 'banner', class: 'hidden' });
    this.tip = h('div', { id: 'tip', class: 'off' });
    this.hand = h('div', { id: 'hand', class: 'hidden', html: icon('hand') });
    this.el.append(this.top, this.boostWrap, this.banner, this.tip, this.hand);
    this.top.style.pointerEvents = 'none';
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); this.hideTip(); }

  layout(L) {
    this.L = L;
    this.top.style.height = L.hudH + 'px';
    const maxW = Math.max(L.fw, Math.min(L.W, 560));
    this.top.style.left = Math.max(0, (L.W - maxW) / 2) + 'px';
    this.top.style.right = Math.max(0, (L.W - maxW) / 2) + 'px';
    const size = Math.max(40, Math.round(48 * L.scale));
    const cy = L.fy + (L.viewH - LAUNCH_FROM_BOTTOM + 4) * L.scale;
    BOOSTERS.forEach((b, i) => {
      const btn = this.boostBtns[b];
      const cx = L.fx + Math.min(FIELD_W - 30, 300 + i * 54) * L.scale;
      Object.assign(btn.style, { width: size + 'px', height: size + 'px', left: (cx - size / 2) + 'px', top: (cy - size / 2) + 'px', fontSize: Math.max(11, size * 0.3) + 'px' });
    });
    Object.assign(this.boostWrap.style, { left: '0', top: '0', right: '0', bottom: '0' });
  }

  setup(engine, levelNum) {
    this.engine = engine;
    const endless = engine.mode === 'endless';
    this.levelLbl.textContent = endless ? t('endless_title') : t('level', { n: levelNum });
    this.goalPill.classList.toggle('hidden', endless);
    this.goalIcon.innerHTML = icon(engine.goal === 'kittens' ? 'kitten' : 'bubbles');
    this.starbar.classList.toggle('hidden', endless);
    if (!endless) {
      const s = engine.stars;
      const max = s[2] * 1.12;
      this.starMax = max;
      this.mk1.style.left = '0%';
      this.mk2.style.left = (s[1] / max * 100) + '%';
      this.mk3.style.left = (s[2] / max * 100) + '%';
      this.mk1.style.display = 'none';
    }
    this.boostWrap.classList.toggle('hidden', false);
    this.update();
    this.updateBoosters();
  }

  update() {
    const e = this.engine;
    if (!e) return;
    if (e.mode === 'endless') {
      this.scoreVal.innerHTML = '';
      this.scoreVal.append(h('b', null, fmt(e.score)));
      this.scoreVal.append(h('div', { style: { fontSize: '.7em', opacity: '.85' } }, `${t('best')}: ${fmt(Math.max(store.data.endlessBest, e.score))}`));
      return;
    }
    const left = e.goalLeft;
    const txt = e.goal === 'kittens' ? `${e.kittensFreed}/${e.kittensTotal}` : String(left);
    if (this.goalVal.textContent !== txt) { this.goalVal.textContent = txt; bump(this.goalPill); }
    const sc = fmt(e.score);
    const b = this.scoreVal.firstChild;
    if (b && b.textContent !== sc) b.textContent = sc;
    const pct = Math.min(100, e.score / this.starMax * 100);
    this.fill.style.width = pct + '%';
    const s = e.stars;
    const on2 = e.score >= s[1], on3 = e.score >= s[2];
    if (on2 !== this._on2) { this.mk2.innerHTML = icon(on2 ? 'starOn' : 'starOff'); if (on2) bump(this.mk2); this._on2 = on2; }
    if (on3 !== this._on3) { this.mk3.innerHTML = icon(on3 ? 'starOn' : 'starOff'); if (on3) bump(this.mk3); this._on3 = on3; }
  }

  updateBoosters() {
    const inv = store.data.boosters;
    const e = this.engine;
    BOOSTERS.forEach((b) => {
      const btn = this.boostBtns[b];
      const n = inv[b] || 0;
      btn._badge.textContent = n > 0 ? String(n) : '+';
      btn._badge.classList.toggle('plus', n <= 0);
      btn.classList.toggle('active', !!e && e.special === b);
    });
  }

  showBanner(title, goalText, goalIcon) {
    const b = this.banner;
    b.innerHTML = '';
    b.append(h('div', { class: 'b-title' }, title));
    if (goalText) b.append(h('div', { class: 'b-goal' }, h('span', { html: icon(goalIcon) }), goalText));
    b.classList.remove('hidden', 'show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.add('hidden'), 1950);
  }

  goalText(engine) {
    if (engine.goal === 'kittens') {
      const n = engine.kittensTotal;
      return t('goal_kittens', { n, kittens: kittensWord(n) });
    }
    return t('goal_clear');
  }

  /** Подсказка: text, anchorY (px) — где показать, hand: {x0,y0,x1,y1} */
  showTip(text, anchorY, hand) {
    this.tip.textContent = text;
    this.tip.style.top = Math.max(8, anchorY) + 'px';
    this.tip.classList.remove('off');
    if (hand) {
      this.hand.classList.remove('hidden');
      const size = this.hand.offsetWidth || 50;
      if (this.handAnim) this.handAnim.cancel();
      const kf = [
        { transform: `translate(${hand.x0 - size * 0.3}px, ${hand.y0}px) scale(1)`, opacity: 0 },
        { transform: `translate(${hand.x0 - size * 0.3}px, ${hand.y0}px) scale(.9)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${hand.x1 - size * 0.3}px, ${hand.y1}px) scale(.9)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${hand.x1 - size * 0.3}px, ${hand.y1}px) scale(1.05)`, opacity: 0, offset: 1 },
      ];
      Object.assign(this.hand.style, { left: '0px', top: '0px' });
      if (this.hand.animate) this.handAnim = this.hand.animate(kf, { duration: 1900, iterations: Infinity, easing: 'ease-in-out' });
      else this.hand.style.transform = kf[2].transform;
    } else {
      this.hand.classList.add('hidden');
    }
  }

  hideTip() {
    this.tip.classList.add('off');
    this.hand.classList.add('hidden');
    if (this.handAnim) { this.handAnim.cancel(); this.handAnim = null; }
  }
}
