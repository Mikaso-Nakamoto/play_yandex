import { platform } from './core/platform.js';
import { store } from './core/storage.js';
import { audio } from './core/audio.js';
import { t, fmt, kittensWord } from './core/i18n.js';
import { Engine } from './game/engine.js';
import { Renderer } from './game/renderer.js';
import { getLevel, worldOf } from './game/levels.js';
import { FIELD_W, VIEW_MIN_H, S_NONE } from './game/constants.js';
import { h, $, toast } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { Popups } from './ui/popups.js';
import { Hub } from './ui/hub.js';
import { Hud, BOOSTERS } from './ui/hud.js';

const VERSION = '1.1.0';
const DAILY = [
  { coins: 50 }, { coins: 80 }, { bomb: 1 }, { coins: 120 }, { rainbow: 1, coins: 50 }, { coins: 180 }, { coins: 300, bomb: 1, fire: 1 },
];
const BOOSTER_PRICE = { bomb: 150, rainbow: 120, fire: 200 };
const CONTINUE_PRICES = [150, 250, 400, 600];
const CONTINUE_SHOTS = 5;
const RV_COINS = 50;
const INTERSTITIAL_GAP = 65000;
const FIRST_AD_LEVEL = 3;

const dateKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class App {
  constructor() {
    this.screen = 'loading';
    this.pause = new Set();
    this.engine = null;
    this.levelNum = 1;
    this.lastAd = Date.now();
    this.timeOffset = 0;
    this.leaderboardEnabled = false;
    this.tut = null;
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  }

  // ================= Запуск =================
  init() {
    this.buildUI();
    this.bindEvents();
    this.onResize();
  }

  start() {
    audio.setSfx(store.data.sound);
    audio.setMusic(store.data.music);
    platform.noAds = !!store.data.noAds;
    this.showHub();
    this.loop();
    this.checkLeaderboard();
    if (store.data.level >= 3 && this.dailyState().available) setTimeout(() => { if (this.screen === 'hub' && !this.popups.isOpen) this.openDaily(); }, 600);
  }

  async syncTime() {
    try {
      const st = await platform.serverTime();
      if (typeof st === 'number' && st > 1e12) this.timeOffset = st - Date.now();
    } catch (e) { /* ignore */ }
  }

  buildUI() {
    const app = $('#app');
    this.cv = $('#cv');
    this.renderer = new Renderer(this.cv);
    const ui = $('#ui');
    this.hub = new Hub(this);
    this.hud = new Hud(this);
    ui.append(this.hub.el, this.hud.el);
    this.popups = new Popups($('#popups'), () => { this.updateGameplay(); });
    void app;
  }

  bindEvents() {
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => this.onResize(), 60); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

    // Запрет системных жестов, меню и выделения
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('selectstart', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => audio.unlock(), true);
    document.addEventListener('touchend', () => audio.unlock(), true);

    // Пауза: потеря фокуса, сворачивание, реклама, события платформы
    document.addEventListener('visibilitychange', () => {
      this.setPause('hidden', document.hidden);
      if (document.hidden) store.flushCloud(true);
    });
    window.addEventListener('pagehide', () => store.flushCloud(true));
    window.addEventListener('blur', () => this.setPause('blur', true));
    window.addEventListener('focus', () => this.setPause('blur', false));
    platform.on('pause', () => this.setPause('sdk', true));
    platform.on('resume', () => this.setPause('sdk', false));
    platform.on('adStart', () => this.setPause('ad', true));
    platform.on('adEnd', () => this.setPause('ad', false));
    platform.on('accountChanged', () => this.onAccountChanged());

    // Ввод на поле
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (!this.inputAllowed) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const [x, y] = this.toWorld(e);
      this.engine.pointerDown(x, y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.inputAllowed) return;
      const [x, y] = this.toWorld(e);
      this.engine.pointerMove(x, y, e.pointerType !== 'mouse' || e.buttons > 0);
    });
    cv.addEventListener('pointerup', (e) => {
      if (!this.inputAllowed) { if (this.engine) this.engine.downInfo = null; return; }
      const [x, y] = this.toWorld(e);
      this.engine.pointerUp(x, y);
    });
    cv.addEventListener('pointercancel', () => { if (this.engine) { this.engine.downInfo = null; this.engine.aim.active = false; } });
    cv.addEventListener('pointerleave', () => { if (this.engine) this.engine.pointerLeave(); });

    // Клавиатура (раскладка не важна — используем e.code)
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape') {
        const top = this.popups.top;
        if (top) { if (top.opts.closable) top.close(); }
        else if (this.screen === 'game' && this.engine && ['aim', 'flying', 'settle', 'intro'].includes(this.engine.state)) this.openPause();
        return;
      }
      if (!this.inputAllowed) return;
      if (e.code === 'Space' || e.code === 'KeyS') this.engine.swap();
      if (e.code === 'Digit1' || e.code === 'Numpad1') this.onBoosterTap('bomb');
      if (e.code === 'Digit2' || e.code === 'Numpad2') this.onBoosterTap('rainbow');
      if (e.code === 'Digit3' || e.code === 'Numpad3') this.onBoosterTap('fire');
    });

    // Звук нажатия на любые кнопки интерфейса
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b) audio.play('click');
    }, true);
  }

  get inputAllowed() {
    return this.screen === 'game' && !!this.engine && !this.popups.isOpen && this.pause.size === 0;
  }

  toWorld(e) {
    const rect = this.cv.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const L = this.L;
    return [(x - L.fx) / L.scale, (y - L.fy) / L.scale + (this.engine ? this.engine.camY : 0)];
  }

  // ================= Раскладка =================
  computeLayout() {
    const W = Math.max(200, window.innerWidth), H = Math.max(200, window.innerHeight);
    const fs = clamp(Math.min(W / 25, H / 40), 11, 18);
    const hudH = Math.round(clamp(fs * 3.6, 44, 68));
    const availH = H - hudH;
    const scale = Math.min(W / FIELD_W, availH / VIEW_MIN_H);
    const fw = FIELD_W * scale;
    return { W, H, fs, hudH, fx: (W - fw) / 2, fy: hudH, fw, fh: availH, scale, viewH: availH / scale };
  }

  onResize() {
    const L = this.computeLayout();
    this.L = L;
    document.body.style.fontSize = L.fs.toFixed(1) + 'px';
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.renderer.resize(L.W, L.H, dpr, L);
    if (this.engine) this.engine.setViewH(L.viewH);
    this.hud.layout(L);
    if (this.screen === 'hub') { const y = this.hub.scroller.y; this.hub.build(); this.hub.scroller.scrollTo(y); this.hub.onScroll(); }
  }

  // ================= Цикл =================
  loop() {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const hardPause = this.pause.size > 0;
      const frozen = hardPause || this.popups.isOpen;
      if (this.engine && this.screen === 'game' && !frozen) this.engine.update(dt);
      if (!this.pause.has('hidden')) {
        try { this.renderer.frame(hardPause ? 0 : dt); } catch (e) { console.error(e); }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ================= Пауза и разметка геймплея =================
  setPause(reason, on) {
    const had = this.pause.has(reason);
    if (on === had) return;
    if (on) this.pause.add(reason); else this.pause.delete(reason);
    if (this.pause.size > 0) audio.suspend(); else audio.resume();
    if (on && this.engine) { this.engine.downInfo = null; this.engine.aim.active = false; }
    this.updateGameplay();
  }

  updateGameplay() {
    const e = this.engine;
    const active = this.screen === 'game' && !!e && ['intro', 'aim', 'flying', 'settle'].includes(e.state) &&
      !this.popups.isOpen && this.pause.size === 0;
    if (active) platform.gameplayStart(); else platform.gameplayStop();
  }

  // ================= Экраны =================
  setScreen(name) {
    this.screen = name;
    if (name === 'hub') this.hub.el.classList.remove('hidden'); else this.hub.hide();
    if (name === 'game') this.hud.show(); else this.hud.hide();
    this.updateGameplay();
  }

  showHub() {
    this.cleanupLevel();
    this.hub.el.classList.remove('hidden');
    this.engine = null;
    this.renderer.setEngine(null);
    this.setScreen('hub');
    this.hub.show();
  }

  cleanupLevel() {
    const e = this.engine;
    if (e && e.special) { store.data.boosters[e.special] = (store.data.boosters[e.special] || 0) + 1; e.special = S_NONE; store.save(); }
    this.hud.hideTip();
    this.tut = null;
  }

  onMapNode(n) {
    if (n > store.data.level) { toast(t('locked')); audio.play('error'); return; }
    this.goLevel(n);
  }

  playCurrent() { this.goLevel(store.data.level); }

  async goLevel(n) {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.interstitial();
      this.startLevel(n);
    } finally { this.busy = false; }
  }

  startLevel(n) {
    this.popups.closeAll();
    this.cleanupLevel();
    const L = getLevel(n);
    this.levelNum = n;
    this.x2used = false;
    this.engine = new Engine({ mode: 'level', level: L, onEvent: (tp, d) => this.onEngine(tp, d) });
    this.engine.setViewH(this.L.viewH);
    this.renderer.setWorld(worldOf(n));
    this.renderer.setEngine(this.engine);
    this.renderer.vibro = store.data.vibro;
    this.setScreen('game');
    this.hud.setup(this.engine, n);
    this.hud.showBanner(t('level', { n }), this.hud.goalText(this.engine), this.engine.goal === 'kittens' ? 'kitten' : 'bubbles');
    store.data.stats.played++;
    store.save();
    this.prepareTutorial(n);
    this.updateGameplay();
  }

  async startEndless() {
    if (this.busy) return;
    this.busy = true;
    try { await this.interstitial(true); } finally { this.busy = false; }
    this.popups.closeAll();
    this.cleanupLevel();
    this.levelNum = 0;
    this.engine = new Engine({ mode: 'endless', onEvent: (tp, d) => this.onEngine(tp, d) });
    this.engine.setViewH(this.L.viewH);
    this.renderer.setWorld(5);
    this.renderer.setEngine(this.engine);
    this.renderer.vibro = store.data.vibro;
    this.setScreen('game');
    this.hud.setup(this.engine, 0);
    this.hud.showBanner(t('endless_title'), t('endless_hint'), 'bubbles');
    this.updateGameplay();
  }

  // ================= События движка =================
  onEngine(type, d) {
    this.renderer.onEvent(type, d);
    switch (type) {
      case 'score': case 'shots': case 'board': case 'kittens': case 'misses': case 'push':
        this.hud.update();
        break;
      case 'shoot':
        store.data.stats.shots++;
        this.hud.updateBoosters();
        this.tutorialOnShot(d);
        break;
      case 'swap': this.tutorialOnSwap(); break;
      case 'special': this.hud.updateBoosters(); break;
      case 'ready': this.onReady(); this.updateGameplay(); break;
      case 'goalReached': this.hud.hideTip(); this.updateGameplay(); break;
      case 'complete': setTimeout(() => this.onLevelComplete(d.score, d.stars), 250); break;
      case 'outOfShots': this.updateGameplay(); setTimeout(() => this.openOutOfShots(), 500); break;
      case 'failed': this.updateGameplay(); break;
      case 'gameOver': this.updateGameplay(); setTimeout(() => this.onEndlessOver(), 700); break;
      default: break;
    }
  }

  // ================= Реклама =================
  async interstitial(force = false) {
    if (store.data.noAds || !platform.hasSdk) return false;
    if (!force && store.data.level < FIRST_AD_LEVEL) return false;
    if (Date.now() - this.lastAd < INTERSTITIAL_GAP) return false;
    const shown = await platform.showInterstitial();
    if (shown) this.lastAd = Date.now();
    return shown;
  }

  /** Видео за награду: callback вызывается только если награда положена */
  async rewarded(onReward) {
    if (!platform.hasSdk) { toast(t('ad_unavailable')); return false; }
    const res = await platform.showRewarded();
    if (res === 'rewarded') { onReward(); return true; }
    if (res === 'error') toast(t('ad_unavailable'));
    return false;
  }

  // ================= Уровень пройден / не пройден =================
  onLevelComplete(score, stars) {
    const n = this.levelNum;
    const d = store.data;
    const first = n >= d.level;
    const prevStars = d.stars[n] || 0;
    d.stars[n] = Math.max(prevStars, stars);
    const prevBest = d.best[n] || 0;
    d.best[n] = Math.max(prevBest, score);
    if (n >= d.level) d.level = n + 1;
    const coins = 10 + stars * 5 + (first ? 10 : 0);
    d.coins += coins;
    d.stats.won++;
    d.stats.kittens += this.engine.stats.kittens;
    store.save(true);
    this.updateGameplay();
    this.openWin({ n, score, stars, coins, best: Math.max(prevBest, score), record: score > prevBest && prevBest > 0 });
  }

  openWin({ n, score, stars, coins, best, record }) {
    const starsEl = h('div', { class: 'stars-big' });
    for (let i = 0; i < 3; i++) {
      const on = i < stars;
      const s = h('span', { class: on ? 'on' : '', html: icon(on ? 'starOn' : 'starOff'), style: { animationDelay: (0.25 + i * 0.3) + 's' } });
      starsEl.appendChild(s);
      if (on) setTimeout(() => audio.play('star', i), 300 + i * 300);
    }
    const coinVal = h('b', null, '+' + coins);
    const x2 = h('button', { class: 'btn btn-orange wide' },
      h('span', { html: icon('video') }),
      h('span', { class: 'col' }, h('span', null, `${t('double_reward')}  +${coins}`), h('span', { class: 'sub' }, t('for_ad'))));
    x2.onclick = () => this.rewarded(() => {
      store.data.coins += coins;
      store.save(true);
      coinVal.textContent = '+' + coins * 2;
      x2.disabled = true;
      audio.play('coin');
    });
    const body = h('div', null,
      starsEl,
      h('div', { class: 'score-big' }, fmt(score)),
      h('div', { class: 'muted' }, record ? t('new_record') : `${t('best')}: ${fmt(best)}`),
      h('div', { class: 'reward-row' }, h('span', { html: icon('coin') }), coinVal),
      h('div', { class: 'btns' },
        platform.hasSdk ? x2 : null,
        h('div', { class: 'btns-row', style: { marginTop: '0' } },
          h('button', { class: 'btn btn-gray', onclick: () => this.leaveToHub(true) }, h('span', { html: icon('map') }), t('map')),
          h('button', { class: 'btn btn-green', onclick: () => this.goLevel(n + 1) }, t('next'), h('span', { html: icon('play') })),
        ),
      ),
    );
    this.popups.open({ title: t('level_complete'), titleClass: 'green', body, id: 'win' });
    audio.play('coin');
  }

  openOutOfShots() {
    const e = this.engine;
    if (!e || e.state !== 'out') return;
    const price = CONTINUE_PRICES[Math.min(e.continues, CONTINUE_PRICES.length - 1)];
    const left = e.goalLeft;
    const info = e.goal === 'kittens' ? t('out_left_kittens', { n: left }) : t('out_left_bubbles', { n: left });
    let p = null;
    const proceed = () => { if (p) this.popups.close(p, true); e.addShots(CONTINUE_SHOTS); this.renderer.mood('happy', 1); this.updateGameplay(); };
    const rv = h('button', { class: 'btn btn-orange wide' },
      h('span', { html: icon('video') }),
      h('span', { class: 'col' }, h('span', null, t('plus_shots', { n: CONTINUE_SHOTS })), h('span', { class: 'sub' }, t('for_ad'))));
    rv.onclick = () => this.rewarded(proceed);
    const buy = h('button', { class: 'btn btn-blue wide' },
      h('span', null, t('plus_shots', { n: CONTINUE_SHOTS })),
      h('span', { class: 'price' }, h('span', { html: icon('coin') }), fmt(price)));
    buy.onclick = () => {
      if (store.data.coins < price) { toast(t('not_enough_coins')); audio.play('error'); this.openShop(); return; }
      store.data.coins -= price;
      store.save(true);
      audio.play('coin');
      proceed();
    };
    const body = h('div', null,
      h('img', { class: 'pop-cat', src: 'assets/cat/sad.png', alt: '' }),
      h('p', null, info),
      h('div', { class: 'btns' },
        platform.hasSdk ? rv : null,
        buy,
        h('button', { class: 'btn btn-gray small', onclick: () => { this.popups.close(p, true); e.fail(); this.openFail(); } }, t('give_up')),
      ),
    );
    p = this.popups.open({ title: t('out_of_shots'), body, id: 'out' });
  }

  openFail() {
    const n = this.levelNum;
    const body = h('div', null,
      h('img', { class: 'pop-cat', src: 'assets/cat/sad.png', alt: '' }),
      h('p', null, t('level_failed_sub')),
      h('div', { class: 'btns-row' },
        h('button', { class: 'btn btn-gray', onclick: () => this.leaveToHub(true) }, h('span', { html: icon('map') }), t('map')),
        h('button', { class: 'btn btn-green', onclick: () => this.goLevel(n) }, h('span', { html: icon('retry') }), t('retry')),
      ),
    );
    this.popups.open({ title: t('level_failed'), body, id: 'fail' });
  }

  async leaveToHub(withAd) {
    if (this.busy) return;
    this.busy = true;
    this.popups.closeAll();
    this.cleanupLevel();
    try { if (withAd) await this.interstitial(); } finally { this.busy = false; }
    this.showHub();
  }

  // ================= Пауза =================
  openPause() {
    if (this.popups.isOpen || this.screen !== 'game' || !this.engine) return;
    const endless = this.engine.mode === 'endless';
    const body = h('div', null,
      this.settingsToggles(),
      h('div', { class: 'btns' },
        h('button', { class: 'btn btn-green wide', onclick: () => this.popups.closeById('pause') }, h('span', { html: icon('play') }), t('resume')),
        h('div', { class: 'btns-row', style: { marginTop: '0' } },
          h('button', { class: 'btn btn-blue', onclick: () => (endless ? this.startEndless() : this.goLevel(this.levelNum)) }, h('span', { html: icon('retry') }), t('restart')),
          h('button', { class: 'btn btn-gray', onclick: () => this.leaveToHub(true) }, h('span', { html: icon('map') }), t('map')),
        ),
        h('button', { class: 'btn btn-gray small', onclick: () => this.openHowTo() }, h('span', { html: icon('help') }), t('how_to_play')),
      ),
    );
    this.popups.open({ title: t('pause'), titleClass: 'purple', body, closable: true, id: 'pause' });
  }

  settingsToggles() {
    const d = store.data;
    const row = (ico, label, get, set) => {
      const sw = h('button', { class: 'switch' + (get() ? ' on' : ''), 'aria-label': label });
      sw.onclick = () => { set(!get()); sw.classList.toggle('on', get()); store.save(); };
      return h('div', { class: 'toggle-row' }, h('span', { class: 'lbl' }, h('span', { html: icon(ico) }), label), sw);
    };
    return h('div', null,
      row('soundOn', t('sound'), () => d.sound, (v) => { d.sound = v; audio.setSfx(v); }),
      row('music', t('music'), () => d.music, (v) => { d.music = v; audio.setMusic(v); }),
      this.isTouch ? row('vibro', t('vibration'), () => d.vibro, (v) => { d.vibro = v; this.renderer.vibro = v; }) : null,
    );
  }

  // ================= Настройки, вход =================
  openSettings() {
    const auth = h('div', { style: { marginTop: '.6em' } });
    const fillAuth = () => {
      auth.innerHTML = '';
      if (!platform.hasSdk) return;
      if (platform.isAuthorized()) {
        auth.append(h('p', { class: 'muted' }, t('logged_in_as', { name: platform.playerName() || t('player') })));
      } else if (platform.canLogin()) {
        auth.append(
          h('p', { class: 'muted' }, t('login_benefits')),
          h('button', { class: 'btn btn-blue wide', onclick: () => this.doLogin(fillAuth) }, h('span', { html: icon('user') }), t('login')),
        );
      }
    };
    fillAuth();
    const body = h('div', null,
      this.settingsToggles(),
      auth,
      h('div', { class: 'btns' },
        h('button', { class: 'btn btn-gray', onclick: () => this.openHowTo() }, h('span', { html: icon('help') }), t('how_to_play')),
      ),
      h('p', { class: 'muted', style: { fontSize: '.8em', marginTop: '.8em' } }, t('feedback')),
      h('p', { class: 'muted', style: { fontSize: '.75em' } }, `${t('version')} ${VERSION}`),
    );
    this.popups.open({ title: t('settings'), titleClass: 'purple', body, closable: true, id: 'settings' });
  }

  async doLogin(after) {
    const ok = await platform.login();
    if (ok) {
      await store.reloadFromCloud();
      await this.processPurchases();
      platform.noAds = !!store.data.noAds;
      if (platform.noAds) platform.hideBanner();
      this.refreshAll();
    }
    if (after) after();
  }

  async onAccountChanged() {
    await platform.initPlayer();
    await store.reloadFromCloud();
    await this.processPurchases();
    this.refreshAll();
  }

  refreshAll() {
    if (this.screen === 'hub') { this.hub.build(); this.hub.centerOn(store.data.level); }
    this.hud.updateBoosters();
    audio.setSfx(store.data.sound);
    audio.setMusic(store.data.music);
  }

  openHowTo() {
    const item = (ico, txt) => h('div', { class: 'how-item' }, h('span', { class: 'ico', html: icon(ico) }), h('span', null, txt));
    const body = h('div', { class: 'how-list' },
      item('aim', t('how_1')),
      item('bubbles', t('how_2')),
      item('kitten', t('how_3')),
      item('bounce', t('how_4')),
      item('stone', t('how_5')),
      item('starOn', t('how_6')),
    );
    this.popups.open({ title: t('how_to_play'), titleClass: 'blue', body, closable: true, id: 'howto' });
  }

  // ================= Бустеры =================
  onBoosterTap(type) {
    const e = this.engine;
    if (!e || this.screen !== 'game' || this.popups.isOpen) return;
    if (e.state !== 'aim' || e.projectile) return;
    const inv = store.data.boosters;
    if (e.special === type) {
      e.activateSpecial(type);
      inv[type] = (inv[type] || 0) + 1;
      store.save();
      this.hud.updateBoosters();
      return;
    }
    if ((inv[type] || 0) <= 0) { this.openBoosterOffer(type); return; }
    if (e.special) inv[e.special] = (inv[e.special] || 0) + 1;
    e.activateSpecial(type);
    inv[type]--;
    store.save();
    this.hud.updateBoosters();
    if (this.tut === 'boosters') this.finishTut('boosters');
  }

  openBoosterOffer(type) {
    const price = BOOSTER_PRICE[type];
    let p = null;
    const give = () => {
      store.data.boosters[type] = (store.data.boosters[type] || 0) + 1;
      store.save(true);
      this.hud.updateBoosters();
      audio.play('coin');
      if (p) this.popups.close(p, true);
    };
    const rv = h('button', { class: 'btn btn-orange wide' }, h('span', { html: icon('video') }),
      h('span', { class: 'col' }, h('span', null, t('get_one')), h('span', { class: 'sub' }, t('for_ad'))));
    rv.onclick = () => this.rewarded(give);
    const buy = h('button', { class: 'btn btn-blue wide' }, h('span', null, t('buy')),
      h('span', { class: 'price' }, h('span', { html: icon('coin') }), fmt(price)));
    buy.onclick = () => {
      if (store.data.coins < price) { toast(t('not_enough_coins')); audio.play('error'); return; }
      store.data.coins -= price;
      give();
    };
    const body = h('div', null,
      h('div', { style: { width: '4.5em', height: '4.5em', margin: '0 auto .3em' }, html: icon(type) }),
      h('p', null, t('booster_' + type + '_desc')),
      h('p', { class: 'muted' }, h('span', { class: 'price' }, h('span', { html: icon('coin') }), fmt(store.data.coins))),
      h('div', { class: 'btns' }, platform.hasSdk ? rv : null, buy),
    );
    p = this.popups.open({ title: t('booster_' + type), titleClass: 'blue', body, closable: true, id: 'booster' });
  }

  // ================= Магазин и покупки =================
  openShop() {
    if (this.popups.top && this.popups.top.id === 'shop') return;
    const d = store.data;
    const coinsEl = h('b', null, fmt(d.coins));
    const refreshCoins = () => { coinsEl.textContent = fmt(store.data.coins); this.hub.refreshBars(); };
    const sec = (title) => h('div', { class: 'shop-sec' }, title);
    const item = (ico, title, desc, btn) => h('div', { class: 'shop-item' },
      h('div', { class: 'ico', html: typeof ico === 'string' ? icon(ico) : '' }, typeof ico === 'string' ? null : ico),
      h('div', { class: 'info' }, h('b', null, title), desc ? h('span', null, desc) : null), btn);

    const list = h('div', null);
    list.append(h('div', { class: 'reward-row' }, h('span', { html: icon('coin') }), coinsEl));
    if (platform.hasSdk) {
      const rv = h('button', { class: 'btn btn-orange' }, h('span', { html: icon('video') }), '+' + RV_COINS);
      rv.onclick = () => this.rewarded(() => { store.data.coins += RV_COINS; store.save(true); refreshCoins(); audio.play('coin'); });
      list.append(item('coin', t('free_coins', { n: RV_COINS }), t('for_ad'), rv));
    }
    // Покупки за реальные деньги — только то, что есть в каталоге консоли
    const products = (platform.catalog || []).filter((p) => p.id === 'noads' || /^coins\d+$/.test(p.id) || /^boosters\d+$/.test(p.id));
    if (products.length) {
      list.append(sec(t('offers')));
      products.sort((a, b) => (a.id === 'noads' ? -1 : b.id === 'noads' ? 1 : (parseFloat(a.priceValue) || 0) - (parseFloat(b.priceValue) || 0)));
      for (const p of products) {
        const owned = p.id === 'noads' && d.noAds;
        const btn = owned
          ? h('button', { class: 'btn btn-gray', disabled: true, html: icon('check') })
          : h('button', { class: 'btn btn-green', onclick: () => this.buyProduct(p, refreshCoins) }, this.priceEl(p));
        let ico = p.id === 'noads' ? 'noads' : /^boosters/.test(p.id) ? 'bomb' : 'coin';
        if (p.imageURI && p.id !== 'noads') ico = h('img', { src: p.imageURI, alt: '' });
        const title = p.id === 'noads' ? t('no_ads') : (p.title || p.id);
        const desc = p.id === 'noads' ? (owned ? t('no_ads_owned') : t('no_ads_desc')) : (p.description || '');
        list.append(item(ico, title, desc, btn));
      }
    }
    list.append(sec(t('boosters')));
    for (const b of BOOSTERS) {
      const price = BOOSTER_PRICE[b];
      const cnt = h('span', null, `×${d.boosters[b] || 0}`);
      const btn = h('button', { class: 'btn btn-blue' }, h('span', { class: 'price' }, h('span', { html: icon('coin') }), fmt(price)));
      btn.onclick = () => {
        if (store.data.coins < price) { toast(t('not_enough_coins')); audio.play('error'); return; }
        store.data.coins -= price;
        store.data.boosters[b] = (store.data.boosters[b] || 0) + 1;
        store.save(true);
        cnt.textContent = `×${store.data.boosters[b]}`;
        refreshCoins();
        this.hud.updateBoosters();
        audio.play('coin');
      };
      list.append(item(b, h('span', null, t('booster_' + b), ' ', cnt), t('booster_' + b + '_desc'), btn));
    }
    this.popups.open({ title: t('shop'), titleClass: 'green', body: list, closable: true, id: 'shop', onClose: () => this.hub.refreshBars() });
  }

  priceEl(p) {
    const el = h('span', { class: 'price' });
    let img = '';
    try { img = p.getPriceCurrencyImage ? p.getPriceCurrencyImage('svg') : ''; } catch (e) { img = ''; }
    if (img) { el.append(h('img', { src: img, alt: '' }), String(p.priceValue)); } else el.append(String(p.price || p.priceValue || ''));
    return el;
  }

  async buyProduct(p, after) {
    if (this.buying) return;
    this.buying = true;
    try {
      const res = await platform.purchase(p.id);
      if (!res) { toast(t('purchase_failed')); return; }
      await this.grantPurchase(res);
      toast(t('purchased'));
      audio.play('coin');
      if (after) after();
      if (this.popups.top && this.popups.top.id === 'shop') { this.popups.close(this.popups.top, true); this.openShop(); }
    } finally { this.buying = false; }
  }

  /** Начисление покупки: сначала сохранить награду (в т.ч. в облако), потом consume */
  async grantPurchase(p) {
    const d = store.data;
    const id = p.productID;
    if (id === 'noads') {
      if (!d.noAds) { d.noAds = true; platform.noAds = true; platform.hideBanner(); store.save(true); await store.flushCloud(true); }
      return; // постоянная покупка — не потребляем
    }
    if (p.purchaseToken && d.processed.includes(p.purchaseToken)) { await platform.consume(p.purchaseToken); return; }
    const mc = /^coins(\d+)$/.exec(id);
    const mb = /^boosters(\d+)$/.exec(id);
    if (!mc && !mb) return;
    if (mc) d.coins += parseInt(mc[1], 10);
    if (mb) for (const b of BOOSTERS) d.boosters[b] = (d.boosters[b] || 0) + parseInt(mb[1], 10);
    if (p.purchaseToken) d.processed.push(p.purchaseToken);
    store.save(true);
    await store.flushCloud(true);
    await platform.consume(p.purchaseToken);
    this.hud.updateBoosters();
    this.hub.refreshBars();
  }

  /** Необработанные покупки при запуске (обязательная проверка по требованиям) */
  async processPurchases() {
    const list = await platform.getPurchases();
    for (const p of list || []) {
      try { await this.grantPurchase(p); } catch (e) { /* ignore */ }
    }
    platform.noAds = !!store.data.noAds;
  }

  // ================= Ежедневный подарок =================
  dailyState() {
    const now = Date.now() + this.timeOffset;
    const today = dateKey(now), yest = dateKey(now - 86400000);
    const d = store.data.daily;
    if (d.last === today) return { available: false, day: d.streak || 1, today };
    const day = d.last === yest ? ((d.streak || 0) % 7) + 1 : 1;
    return { available: true, day, today };
  }

  openDaily() {
    const st = this.dailyState();
    const grid = h('div', { class: 'daily-grid' });
    DAILY.forEach((r, i) => {
      const day = i + 1;
      const got = st.available ? day < st.day : day <= st.day;
      const cls = 'daily-cell' + (day === 7 ? ' big' : '') + (got ? ' got' : '') + (st.available && day === st.day ? ' today' : '');
      const cell = h('div', { class: cls }, h('span', null, t('day_n', { n: day })));
      const icons = h('div', { style: { display: 'flex', gap: '.2em', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' } });
      if (r.coins) icons.append(h('span', { html: icon('coin') }));
      for (const b of BOOSTERS) if (r[b]) icons.append(h('span', { html: icon(b) }));
      cell.append(icons, h('b', null, r.coins ? '+' + r.coins : '×1'));
      grid.append(cell);
    });
    let p = null;
    const claim = (mult) => {
      const s2 = this.dailyState();
      if (!s2.available) return;
      const r = DAILY[s2.day - 1];
      const d = store.data;
      if (r.coins) d.coins += r.coins * mult;
      for (const b of BOOSTERS) if (r[b]) d.boosters[b] = (d.boosters[b] || 0) + r[b] * mult;
      d.daily.last = s2.today;
      d.daily.streak = s2.day;
      store.save(true);
      audio.play('coin');
      this.hub.refreshBars();
      this.hub.bumpCoins();
      if (p) this.popups.close(p, true);
    };
    const btns = h('div', { class: 'btns' });
    if (st.available) {
      if (platform.hasSdk) {
        const rv = h('button', { class: 'btn btn-orange wide' }, h('span', { html: icon('video') }),
          h('span', { class: 'col' }, h('span', null, t('claim_x2')), h('span', { class: 'sub' }, t('for_ad'))));
        rv.onclick = () => this.rewarded(() => claim(2));
        btns.append(rv);
      }
      btns.append(h('button', { class: 'btn btn-green wide', onclick: () => claim(1) }, t('claim')));
    } else {
      btns.append(h('button', { class: 'btn btn-gray wide', onclick: () => this.popups.close(p) }, t('ok')));
    }
    const body = h('div', null, h('p', { class: 'muted' }, t('daily_sub')), grid, btns);
    p = this.popups.open({ title: t('daily'), body, closable: true, id: 'daily', onClose: () => this.hub.refreshBars() });
  }

  // ================= Бесконечный режим =================
  onEndlessOver() {
    const e = this.engine;
    if (!e || e.state !== 'over') return;
    const d = store.data;
    const score = e.score;
    const record = score > d.endlessBest;
    if (record) {
      d.endlessBest = score;
      store.save(true);
      platform.submitScore(score);
    }
    let p = null;
    const rv = h('button', { class: 'btn btn-orange wide' }, h('span', { html: icon('video') }),
      h('span', { class: 'col' }, h('span', null, t('continue_ad')), h('span', { class: 'sub' }, `${t('continue_sub')} · ${t('for_ad')}`)));
    rv.onclick = () => this.rewarded(() => {
      if (p) this.popups.close(p, true);
      e.endlessRescue(5);
      this.renderer.mood('happy', 1);
      this.hud.update();
      this.updateGameplay();
    });
    const body = h('div', null,
      h('div', { class: 'score-big' }, fmt(score)),
      h('div', { class: 'muted' }, record ? t('new_record') : `${t('best')}: ${fmt(d.endlessBest)}`),
      h('div', { class: 'btns' },
        platform.hasSdk && e.continues < 1 ? rv : null,
        h('div', { class: 'btns-row', style: { marginTop: '0' } },
          h('button', { class: 'btn btn-gray', onclick: () => this.leaveToHub(true) }, h('span', { html: icon('home') }), t('menu')),
          h('button', { class: 'btn btn-green', onclick: () => this.startEndless() }, h('span', { html: icon('retry') }), t('retry')),
        ),
      ),
    );
    p = this.popups.open({ title: t('game_over'), titleClass: 'purple', body, id: 'over' });
  }

  // ================= Лидерборд =================
  async checkLeaderboard() {
    if (!platform.hasSdk || !platform.ysdk.leaderboards) return;
    try {
      const lb = platform.ysdk.leaderboards;
      if (lb.getDescription) await lb.getDescription('endless');
      this.leaderboardEnabled = true;
    } catch (e) {
      this.leaderboardEnabled = false;
    }
    this.hub.refreshBars();
  }

  async openLeaderboard() {
    const list = h('div', { class: 'lb-list' }, h('p', { class: 'muted' }, t('loading')));
    const auth = h('div');
    if (!platform.isAuthorized() && platform.canLogin()) {
      auth.append(h('p', { class: 'muted' }, t('leaderboard_login')),
        h('button', { class: 'btn btn-blue wide', onclick: () => this.doLogin(() => { this.popups.closeById('lb'); this.openLeaderboard(); }) }, h('span', { html: icon('user') }), t('login')));
    }
    const body = h('div', null, h('p', { class: 'muted' }, t('leaderboard_sub')), list, h('div', { style: { marginTop: '.6em' } }, auth),
      h('p', { class: 'muted' }, `${t('best')}: ${fmt(store.data.endlessBest)}`));
    this.popups.open({ title: t('leaderboard'), titleClass: 'purple', body, closable: true, id: 'lb' });
    const res = await platform.getLeaderboard();
    list.innerHTML = '';
    if (!res) { list.append(h('p', { class: 'muted' }, t('leaderboard_error'))); return; }
    const entries = res.entries || [];
    if (!entries.length) { list.append(h('p', { class: 'muted' }, t('leaderboard_empty'))); return; }
    let myId = '';
    try { myId = platform.player && platform.player.getUniqueID(); } catch (e) { myId = ''; }
    for (const en of entries) {
      const pl = en.player || {};
      let ava = '';
      try { ava = pl.getAvatarSrc ? pl.getAvatarSrc('small') : ''; } catch (e) { ava = ''; }
      const me = myId && pl.uniqueID === myId;
      list.append(h('div', { class: 'lb-row' + (me ? ' me' : '') },
        h('span', { class: 'rk' }, String(en.rank)),
        ava ? h('img', { src: ava, alt: '' }) : h('span', { style: { width: '2em', height: '2em', color: '#b9b3cc' }, html: icon('user') }),
        h('span', { class: 'nm' }, me ? t('you') : (pl.publicName || t('player'))),
        h('span', { class: 'sc' }, fmt(en.score))));
    }
  }

  // ================= Обучение =================
  prepareTutorial(n) {
    const d = store.data.tut;
    this.tut = null;
    this.tutShots = 0;
    if (n === 1 && !d.aim) this.tut = 'aim';
    else if (n === 2 && !d.kittens) this.tut = 'kittens';
    else if (n === 3 && !d.swap) this.tut = 'swap';
    else if (n === 4 && !d.boosters) {
      this.tut = 'boosters';
      const inv = store.data.boosters;
      for (const b of BOOSTERS) inv[b] = Math.max(inv[b] || 0, 1);
      store.save();
      this.hud.updateBoosters();
    } else if (n === 6 && !d.bank) this.tut = 'bank';
  }

  onReady() {
    if (!this.tut || !this.engine) return;
    const L = this.L, e = this.engine;
    const [lxW, lyW] = e.launcher();
    const lx = L.fx + lxW * L.scale;
    const ly = L.fy + (lyW - e.camY) * L.scale;
    // подсказка — сразу под шариками, рука — между подсказкой и пушкой
    const low = e.board.lowestRow();
    const boardBottom = L.fy + ((low >= 0 ? e.board.y(low) + 24 : 40) - e.camY) * L.scale;
    const tipY = Math.min(Math.max(L.fy + 8, boardBottom + 12), ly - 260 * L.scale);
    switch (this.tut) {
      case 'aim':
        this.hud.showTip(this.isTouch ? t('tut_aim_touch') : t('tut_aim_mouse'), tipY,
          { x0: lx + 30 * L.scale, y0: ly - 60 * L.scale, x1: lx - 70 * L.scale, y1: ly - 175 * L.scale });
        break;
      case 'kittens': this.hud.showTip(t('tut_kittens'), tipY); break;
      case 'swap':
        this.hud.showTip(t('tut_swap'), tipY, { x0: lx, y0: ly - 12 * L.scale, x1: lx, y1: ly - 4 * L.scale });
        break;
      case 'boosters': {
        const btn = this.hud.boostBtns.bomb;
        const r = btn.getBoundingClientRect();
        this.hud.showTip(t('tut_boosters'), tipY, { x0: r.left + r.width / 2, y0: r.top - 34, x1: r.left + r.width / 2, y1: r.top - 8 });
        break;
      }
      case 'bank': this.hud.showTip(t('tut_bank'), tipY); break;
      default: break;
    }
  }

  tutorialOnShot() {
    if (!this.tut) return;
    this.tutShots++;
    if (this.tut === 'aim') {
      if (this.tutShots === 1) {
        this.hud.showTip(t('tut_match'), parseFloat(this.hud.tip.style.top) || this.L.fy + 10);
      } else if (this.tutShots >= 3) this.finishTut('aim');
    } else if (this.tut === 'kittens' && this.tutShots >= 2) this.finishTut('kittens');
    else if (this.tut === 'swap' && this.tutShots >= 3) this.finishTut('swap');
    else if (this.tut === 'boosters' && this.tutShots >= 4) this.finishTut('boosters');
    else if (this.tut === 'bank' && this.tutShots >= 2) this.finishTut('bank');
  }

  tutorialOnSwap() { if (this.tut === 'swap') this.finishTut('swap'); }

  finishTut(name) {
    store.data.tut[name] = true;
    store.save();
    this.hud.hideTip();
    this.tut = null;
  }
}
