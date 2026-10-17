// Сохранение прогресса: сразу в localStorage + в облако Яндекса (player.setData).
// Облачная запись идёт с короткой задержкой и ограничением частоты (лимит SDK — 100 вызовов за 5 минут).
import { platform } from './platform.js';

const KEY = 'meow_bubbles_save_v1';
const CLOUD_MIN_INTERVAL = 3500;

export function defaultSave() {
  return {
    v: 1,
    ts: 0,
    level: 1,            // максимальный открытый уровень
    stars: {},           // номер уровня -> звёзды
    best: {},            // номер уровня -> лучший счёт
    coins: 150,
    boosters: { bomb: 0, rainbow: 0, fire: 0 },
    noAds: false,
    sound: true,
    music: true,
    vibro: true,
    daily: { streak: 0, last: '' },
    endlessBest: 0,
    tut: {},
    stats: { played: 0, won: 0, kittens: 0, shots: 0 },
    processed: [],       // обработанные токены покупок (защита от двойного начисления)
  };
}

function sanitize(d) {
  const def = defaultSave();
  if (!d || typeof d !== 'object') return def;
  const out = { ...def, ...d };
  out.boosters = { ...def.boosters, ...(d.boosters || {}) };
  out.daily = { ...def.daily, ...(d.daily || {}) };
  out.stats = { ...def.stats, ...(d.stats || {}) };
  out.tut = { ...(d.tut || {}) };
  out.stars = { ...(d.stars || {}) };
  out.best = { ...(d.best || {}) };
  out.processed = Array.isArray(d.processed) ? d.processed.slice(-50) : [];
  out.level = Math.max(1, Number(out.level) || 1);
  out.coins = Math.max(0, Number(out.coins) || 0);
  return out;
}

function totalStars(d) {
  let s = 0;
  for (const k in d.stars) s += d.stars[k] || 0;
  return s;
}

/** Выбор между локальным и облачным сохранением: больше прогресса → новее */
function pickBest(a, b) {
  if (!a) return b;
  if (!b) return a;
  const pa = a.level * 1000 + totalStars(a);
  const pb = b.level * 1000 + totalStars(b);
  if (pa !== pb) {
    // Прогресс берём больший, но покупки «без рекламы» не теряем
    const best = pa > pb ? { ...a } : { ...b };
    best.noAds = !!(a.noAds || b.noAds);
    best.endlessBest = Math.max(a.endlessBest || 0, b.endlessBest || 0);
    return best;
  }
  const best = (a.ts || 0) >= (b.ts || 0) ? { ...a } : { ...b };
  best.noAds = !!(a.noAds || b.noAds);
  best.endlessBest = Math.max(a.endlessBest || 0, b.endlessBest || 0);
  return best;
}

class Store {
  constructor() {
    this.data = defaultSave();
    this.cloudTimer = null;
    this.lastCloud = 0;
    this.cloudDirty = false;
    this.listeners = [];
  }

  readLocal() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  writeLocal() {
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* приватный режим и т.п. */ }
  }

  async load() {
    const local = this.readLocal();
    let cloud = null;
    if (platform.player) {
      cloud = await platform.loadCloud();
      if (cloud && !Object.keys(cloud).length) cloud = null;
    }
    this.data = sanitize(pickBest(local && sanitize(local), cloud && sanitize(cloud)));
    this.writeLocal();
    return this.data;
  }

  /** Перезагрузка из облака (после входа в аккаунт / смены аккаунта) */
  async reloadFromCloud() {
    const cloud = platform.player ? await platform.loadCloud() : null;
    if (cloud && Object.keys(cloud).length) {
      this.data = sanitize(pickBest(this.data, sanitize(cloud)));
      this.writeLocal();
    }
    this.save(true);
    this.emitChange();
  }

  onChange(fn) { this.listeners.push(fn); }
  emitChange() { this.listeners.forEach((fn) => fn(this.data)); }

  /** Сохранить сразу (локально) и запланировать облачную запись */
  save(important = false) {
    this.data.ts = Date.now();
    this.writeLocal();
    this.cloudDirty = true;
    this.scheduleCloud(important ? 300 : 1200);
    this.emitChange();
  }

  scheduleCloud(delay) {
    if (!platform.player) return;
    const now = Date.now();
    const wait = Math.max(delay, this.lastCloud + CLOUD_MIN_INTERVAL - now);
    if (this.cloudTimer) {
      if (this.cloudDue && this.cloudDue <= now + wait) return;
      clearTimeout(this.cloudTimer);
    }
    this.cloudDue = now + wait;
    this.cloudTimer = setTimeout(() => this.flushCloud(), wait);
  }

  async flushCloud(force = false) {
    if (this.cloudTimer) { clearTimeout(this.cloudTimer); this.cloudTimer = null; }
    this.cloudDue = 0;
    if (!platform.player || (!this.cloudDirty && !force)) return true;
    const now = Date.now();
    if (!force && now - this.lastCloud < 1000) { this.scheduleCloud(1000); return false; }
    this.lastCloud = now;
    this.cloudDirty = false;
    const ok = await platform.saveCloud(this.data, true);
    if (!ok) { this.cloudDirty = true; this.scheduleCloud(CLOUD_MIN_INTERVAL); }
    return ok;
  }

  totalStars() { return totalStars(this.data); }
}

export const store = new Store();
