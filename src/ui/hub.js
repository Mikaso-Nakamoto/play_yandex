// Главный экран: карта уровней со своей прокруткой, верхняя и нижняя панели.
import { h, makeScroller, bump } from './dom.js';
import { icon } from './icons.js';
import { t, fmt } from '../core/i18n.js';
import { store } from '../core/storage.js';
import { LEVELS_PER_WORLD, worldOf, WORLD_COUNT } from '../game/levels.js';

export class Hub {
  constructor(app) {
    this.app = app;
    this.el = h('div', { id: 'hub', class: 'hidden' });
    this.viewport = h('div', { style: { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0' } });
    this.map = h('div', { id: 'map' });
    this.viewport.appendChild(this.map);
    this.el.appendChild(this.viewport);
    this.chunks = new Map();

    this.coinsVal = h('b', null, '0');
    this.starsVal = h('b', null, '0');
    this.coinsPill = h('div', { class: 'pill coins-pill', onclick: () => app.openShop() }, h('span', { html: icon('coin') }), this.coinsVal, h('span', { class: 'plus' }, '+'));
    this.top = h('div', { id: 'hub-top' },
      this.coinsPill,
      h('div', { class: 'pill' }, h('span', { html: icon('starOn') }), this.starsVal),
      h('div', { class: 'hub-spacer' }),
      h('button', { class: 'round', 'aria-label': 'settings', html: icon('gear'), onclick: () => app.openSettings() }),
    );
    this.playBtn = h('button', { class: 'btn btn-green play-btn', onclick: () => app.playCurrent() });
    this.dailyBadge = h('span', { class: 'badge dot hidden' });
    const hb = (ico, label, fn, extra) => h('button', { class: 'hub-btn', onclick: fn },
      h('span', { class: 'round hb-' + ico, html: icon(ico) }, extra || null), h('span', { class: 'lbl' }, label));
    this.lbBtn = hb('trophy', t('leaderboard'), () => app.openLeaderboard());
    this.bottom = h('div', { id: 'hub-bottom' },
      this.playBtn,
      h('div', { class: 'hub-row' },
        hb('cart', t('shop'), () => app.openShop()),
        hb('gift', t('daily'), () => app.openDaily(), this.dailyBadge),
        hb('infinity', t('endless'), () => app.startEndless()),
        this.lbBtn,
      ),
    );
    // иконка корзины в цвет
    this.bottom.querySelector('.hub-row .round').style.color = '#ff4f9a';
    this.fade = h('div', { class: 'hub-fade' });
    this.el.append(this.fade, this.top, this.bottom);

    this.scroller = makeScroller(this.viewport, this.map, {
      onScroll: () => this.onScroll(),
    });
  }

  get gap() { return this.fs * 6.4; }

  build() {
    this.fs = parseFloat(getComputedStyle(document.body).fontSize) || 15;
    const d = store.data;
    const maxLevel = Math.max(d.level + 14, 30);
    this.levels = Math.ceil(maxLevel / LEVELS_PER_WORLD) * LEVELS_PER_WORLD;
    this.topPad = this.fs * 9;
    this.bottomPad = this.fs * 17;
    this.totalH = this.topPad + this.levels * this.gap + this.bottomPad;
    this.map.style.height = this.totalH + 'px';
    for (const [, c] of this.chunks) c.remove();
    this.chunks.clear();
    this.refreshBars();
    this.scroller.update();
  }

  nodeY(n) { return this.totalH - this.bottomPad - (n - 0.5) * this.gap; }

  nodeX(n) {
    const W = this.viewport.clientWidth || window.innerWidth;
    const amp = Math.min(W * 0.27, this.fs * 8.5);
    return W / 2 + Math.sin(n * 0.85) * amp;
  }

  show() {
    this.el.classList.remove('hidden');
    this.build();
    this.centerOn(store.data.level);
  }

  hide() { this.el.classList.add('hidden'); clearTimeout(this.bgTimer); }

  centerOn(n) {
    const vh = this.viewport.clientHeight || window.innerHeight;
    this.scroller.scrollTo(-(this.nodeY(n) - vh * 0.52));
    this.onScroll();
  }

  refreshBars() {
    const d = store.data;
    this.coinsVal.textContent = fmt(d.coins);
    this.starsVal.textContent = fmt(store.totalStars());
    this.playBtn.innerHTML = '';
    this.playBtn.append(h('span', { html: icon('play') }), h('span', null, `${t('play')} · ${d.level}`));
    this.dailyBadge.classList.toggle('hidden', !this.app.dailyState().available);
    this.lbBtn.classList.toggle('hidden', !this.app.leaderboardEnabled);
  }

  bumpCoins() { bump(this.coinsPill); }

  onScroll() {
    const vh = this.viewport.clientHeight || window.innerHeight;
    const y0 = -this.scroller.y - vh * 0.5;
    const y1 = -this.scroller.y + vh * 1.5;
    const worlds = this.levels / LEVELS_PER_WORLD;
    for (let w = 0; w < worlds; w++) {
      const top = this.nodeY((w + 1) * LEVELS_PER_WORLD) - this.gap * 0.8;
      const bottom = this.nodeY(w * LEVELS_PER_WORLD + 1) + this.gap * 0.6;
      const visible = bottom > y0 && top < y1;
      if (visible && !this.chunks.has(w)) this.buildChunk(w);
      else if (!visible && this.chunks.has(w)) { this.chunks.get(w).remove(); this.chunks.delete(w); }
    }
    // фон карты — мир уровня в центре экрана
    const centerY = -this.scroller.y + vh * 0.5;
    const n = Math.max(1, Math.min(this.levels, Math.round((this.totalH - this.bottomPad - centerY) / this.gap + 0.5)));
    clearTimeout(this.bgTimer);
    this.bgTimer = setTimeout(() => { if (this.app.screen === 'hub') this.app.renderer.setWorld(worldOf(n)); }, 120);
  }

  buildChunk(w) {
    const d = store.data;
    const first = w * LEVELS_PER_WORLD + 1;
    const last = first + LEVELS_PER_WORLD - 1;
    const W = this.viewport.clientWidth || window.innerWidth;
    const chunk = h('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', height: '0' } });
    // дорожка
    const pts = [];
    for (let n = Math.max(1, first - 1); n <= last + 1 && n <= this.levels; n++) pts.push([this.nodeX(n), this.nodeY(n)]);
    let dpath = '';
    pts.forEach(([x, y], i) => {
      if (i === 0) dpath += `M${x.toFixed(1)} ${y.toFixed(1)}`;
      else {
        const [px, py] = pts[i - 1];
        const my = (py + y) / 2;
        dpath += ` C${px.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    const svg = `<svg class="map-path" width="${W}" height="${this.totalH}" viewBox="0 0 ${W} ${this.totalH}">` +
      // песчаная тропинка: тёплая кромка, песок, светлые «камешки»
      `<path d="${dpath}" stroke="rgba(120,72,40,.30)" stroke-width="${this.fs * 1.75}" fill="none" stroke-linecap="round"/>` +
      `<path d="${dpath}" stroke="rgba(250,228,183,.92)" stroke-width="${this.fs * 1.3}" fill="none" stroke-linecap="round"/>` +
      `<path d="${dpath}" stroke="#fffaf0" stroke-width="${this.fs * 0.5}" stroke-dasharray="${this.fs * 0.25} ${this.fs * 0.85}" fill="none" stroke-linecap="round"/></svg>`;
    chunk.insertAdjacentHTML('beforeend', svg);
    // баннер мира
    const banner = h('div', { class: 'world-banner', style: { top: (this.nodeY(first) + this.gap * 0.55) + 'px' } },
      t('world_' + (w % WORLD_COUNT)));
    chunk.appendChild(banner);
    for (let n = first; n <= last; n++) {
      const stars = d.stars[n] || 0;
      const state = n < d.level ? 'done' : n === d.level ? 'cur' : 'lock';
      const node = h('button', {
        class: 'map-node ' + state,
        style: { left: this.nodeX(n) + 'px', top: this.nodeY(n) + 'px' },
        onclick: () => this.app.onMapNode(n),
        'aria-label': t('level', { n }),
      });
      if (state === 'lock') node.innerHTML = icon('lock');
      else node.appendChild(h('span', { class: 'num' }, String(n)));
      if (state === 'done') {
        const st = h('div', { class: 'stars' });
        for (let i = 0; i < 3; i++) st.insertAdjacentHTML('beforeend', icon(i < stars ? 'starOn' : 'starOff'));
        node.appendChild(st);
      }
      if (state === 'cur') node.appendChild(h('img', { class: 'avatar', src: 'assets/cat/idle.png', alt: '' }));
      chunk.appendChild(node);
    }
    this.map.appendChild(chunk);
    this.chunks.set(w, chunk);
  }
}
