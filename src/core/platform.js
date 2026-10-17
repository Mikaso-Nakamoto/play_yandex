// Обёртка над SDK Яндекс Игр. Игра продолжает работать, даже если SDK недоступен
// (например, при локальном запуске без /sdk.js) — тогда реклама и облако просто отключены.

const withTimeout = (p, ms) => new Promise((resolve, reject) => {
  const id = setTimeout(() => reject(new Error('timeout')), ms);
  p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
});

const LB_NAME = 'endless';

class Platform {
  constructor() {
    this.ysdk = null;
    this.player = null;
    this.payments = null;
    this.catalog = [];
    this.lang = '';
    this.gameplayOn = false;
    this.adActive = false;
    this.noAds = false;
    this.handlers = {};
    this.lastInterstitial = 0;
    this.bannerShown = false;
    this.lbAvailable = null;
    this.lastScoreSent = 0;
    this.deviceType = 'desktop';
  }

  on(evt, fn) { (this.handlers[evt] = this.handlers[evt] || []).push(fn); }
  emit(evt, data) { (this.handlers[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

  get hasSdk() { return !!this.ysdk; }

  async init() {
    if (typeof window === 'undefined' || typeof window.YaGames === 'undefined') {
      this.lang = (navigator.language || 'ru').slice(0, 2);
      return false;
    }
    try {
      this.ysdk = await withTimeout(window.YaGames.init(), 10000);
    } catch (e) {
      console.warn('[sdk] init failed:', e && e.message);
      this.lang = (navigator.language || 'ru').slice(0, 2);
      return false;
    }
    const env = this.ysdk.environment || {};
    this.lang = (env.i18n && env.i18n.lang) || 'ru';
    try { this.deviceType = (this.ysdk.deviceInfo && this.ysdk.deviceInfo.type) || 'desktop'; } catch (e) { /* ignore */ }
    try {
      this.ysdk.on('game_api_pause', () => this.emit('pause'));
      this.ysdk.on('game_api_resume', () => this.emit('resume'));
    } catch (e) { /* старые версии SDK */ }
    try {
      const ev = this.ysdk.EVENTS && this.ysdk.EVENTS.ACCOUNT_SELECTION_DIALOG_CLOSED;
      if (ev) this.ysdk.on(ev, () => this.emit('accountChanged'));
    } catch (e) { /* ignore */ }
    return true;
  }

  /** Игра загружена и готова к взаимодействию */
  loadingReady() {
    try { this.ysdk && this.ysdk.features && this.ysdk.features.LoadingAPI && this.ysdk.features.LoadingAPI.ready(); } catch (e) { /* ignore */ }
  }

  gameplayStart() {
    if (this.gameplayOn) return;
    this.gameplayOn = true;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.start(); } catch (e) { /* ignore */ }
  }

  gameplayStop() {
    if (!this.gameplayOn) return;
    this.gameplayOn = false;
    try { this.ysdk && this.ysdk.features.GameplayAPI && this.ysdk.features.GameplayAPI.stop(); } catch (e) { /* ignore */ }
  }

  async serverTime() {
    try { if (this.ysdk && this.ysdk.serverTime) return this.ysdk.serverTime(); } catch (e) { /* ignore */ }
    return Date.now();
  }

  // ---------- Игрок и сохранения ----------
  async initPlayer() {
    if (!this.ysdk) return null;
    try {
      this.player = await withTimeout(this.ysdk.getPlayer({ scopes: false }), 8000);
    } catch (e) {
      console.warn('[sdk] getPlayer failed:', e && e.message);
      this.player = null;
    }
    return this.player;
  }

  isAuthorized() {
    if (!this.player) return false;
    try {
      if (typeof this.player.isAuthorized === 'function') return this.player.isAuthorized();
      return this.player.getMode() !== 'lite';
    } catch (e) { return false; }
  }

  playerName() {
    try { return (this.player && this.player.getName()) || ''; } catch (e) { return ''; }
  }

  async loadCloud() {
    if (!this.player) return null;
    try { return await withTimeout(this.player.getData(), 8000); } catch (e) { return null; }
  }

  async saveCloud(data, flush) {
    if (!this.player) return false;
    try { await this.player.setData(data, !!flush); return true; } catch (e) { return false; }
  }

  canLogin() { return !!(this.ysdk && this.ysdk.auth && !this.isAuthorized()); }

  async login() {
    if (!this.ysdk) return false;
    try {
      await this.ysdk.auth.openAuthDialog();
    } catch (e) { return false; }
    await this.initPlayer();
    return this.isAuthorized();
  }

  // ---------- Реклама ----------
  /** Полноэкранная реклама. Всегда резолвится (true — реклама была показана). */
  showInterstitial() {
    return new Promise((resolve) => {
      if (!this.ysdk || this.noAds || this.adActive) { resolve(false); return; }
      let done = false;
      let opened = false;
      const finish = (shown) => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (this.adActive) { this.adActive = false; this.emit('adEnd'); }
        if (shown) this.lastInterstitial = Date.now();
        resolve(!!shown);
      };
      // Если SDK так и не открыл рекламу — не держим игру на паузе
      const guard = setTimeout(() => { if (!opened) finish(false); }, 6000);
      this.adActive = true;
      this.emit('adStart');
      try {
        this.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: () => { opened = true; },
            onClose: (wasShown) => finish(wasShown),
            onError: () => finish(false),
            onOffline: () => finish(false),
          },
        });
      } catch (e) { finish(false); }
    });
  }

  /** Видео за награду. Резолвится 'rewarded' | 'closed' | 'error'. Награду выдаём только при 'rewarded'. */
  showRewarded() {
    return new Promise((resolve) => {
      if (!this.ysdk) { resolve('error'); return; }
      if (this.adActive) { resolve('closed'); return; }
      let done = false;
      let rewarded = false;
      let opened = false;
      let failed = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        if (this.adActive) { this.adActive = false; this.emit('adEnd'); }
        resolve(rewarded ? 'rewarded' : failed || !opened ? 'error' : 'closed');
      };
      const guard = setTimeout(() => { if (!opened) { failed = true; finish(); } }, 8000);
      this.adActive = true;
      this.emit('adStart');
      try {
        this.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => { opened = true; },
            onRewarded: () => { rewarded = true; },
            onClose: () => finish(),
            onError: () => { failed = true; finish(); },
          },
        });
      } catch (e) { failed = true; finish(); }
    });
  }

  get rewardedAvailable() { return !!this.ysdk; }

  showBanner() {
    if (!this.ysdk || this.noAds) return;
    try {
      const adv = this.ysdk.adv;
      if (adv && adv.showBannerAdv) {
        adv.showBannerAdv();
        this.bannerShown = true;
      }
    } catch (e) { /* ignore */ }
  }

  hideBanner() {
    if (!this.ysdk) return;
    try {
      const adv = this.ysdk.adv;
      if (adv && adv.hideBannerAdv) adv.hideBannerAdv();
      this.bannerShown = false;
    } catch (e) { /* ignore */ }
  }

  // ---------- Покупки ----------
  async initPayments() {
    if (!this.ysdk) return false;
    try {
      this.payments = await withTimeout(this.ysdk.getPayments({ signed: false }), 8000);
      this.catalog = await withTimeout(this.payments.getCatalog(), 8000);
      return true;
    } catch (e) {
      this.payments = null;
      this.catalog = [];
      return false;
    }
  }

  async getPurchases() {
    if (!this.payments) return [];
    try { return await this.payments.getPurchases(); } catch (e) { return []; }
  }

  async purchase(id) {
    if (!this.payments) return null;
    try { return await this.payments.purchase({ id }); } catch (e) { return null; }
  }

  async consume(token) {
    if (!this.payments || !token) return false;
    try { await this.payments.consumePurchase(token); return true; } catch (e) { return false; }
  }

  product(id) { return this.catalog.find((p) => p.id === id) || null; }

  // ---------- Лидерборд ----------
  async submitScore(score) {
    if (!this.ysdk || !this.isAuthorized() || !this.ysdk.leaderboards) return false;
    try {
      if (this.ysdk.isAvailableMethod) {
        const ok = await this.ysdk.isAvailableMethod('leaderboards.setScore');
        if (!ok) return false;
      }
      const now = Date.now();
      if (now - this.lastScoreSent < 1200) return false;
      this.lastScoreSent = now;
      await this.ysdk.leaderboards.setScore(LB_NAME, Math.floor(score));
      return true;
    } catch (e) { return false; }
  }

  async getLeaderboard() {
    if (!this.ysdk || !this.ysdk.leaderboards) return null;
    try {
      return await withTimeout(this.ysdk.leaderboards.getEntries(LB_NAME, {
        quantityTop: 10, includeUser: this.isAuthorized(), quantityAround: 2,
      }), 8000);
    } catch (e) { return null; }
  }
}

export const platform = new Platform();
