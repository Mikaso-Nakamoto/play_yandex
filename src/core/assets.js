// Картинки-ресурсы: рисованные фоны миров (стиль ключевого арта).
// Грузятся лениво и никогда не блокируют игру: пока картинки нет, рендер рисует процедурный фон (art.js).
// Вертикальный фон есть у каждого мира; горизонтальный (для компьютеров) — у миров из LANDSCAPE,
// для остальных рендер собирает широкий кадр из вертикальной картинки (размытые края + чёткий центр).

const WORLDS = 8;
const LANDSCAPE = [0, 1, 2];
const cache = new Map();
// рисованные иконки и кот (src/assets/ui, src/assets/cat; пересборка — tools/art/make-ui.sh)
const UI = [
  'coin', 'bomb', 'fire', 'rainbow',
].map((n) => 'ui/' + n).concat(['cat/idle', 'cat/happy', 'cat/sad']);
const listeners = [];

const urlFor = (w, land) => `assets/bg/w${w}-${land ? 'l' : 'p'}.jpg`;
const norm = (w) => ((w % WORLDS) + WORLDS) % WORLDS;

function load(url) {
  let rec = cache.get(url);
  if (rec) return rec;
  rec = { img: null, ok: false, failed: false, promise: null };
  rec.promise = new Promise((resolve) => {
    const img = new Image();
    const done = () => {
      rec.img = img; rec.ok = true; resolve(true);
      listeners.forEach((fn) => { try { fn(url); } catch (e) { /* ignore */ } });
    };
    img.onload = () => {
      // decode() — чтобы первая отрисовка большой картинки не давала рывок (где поддерживается)
      if (img.decode) img.decode().then(done, done); else done();
    };
    img.onerror = () => { rec.failed = true; resolve(false); };
    img.src = url;
  });
  cache.set(url, rec);
  return rec;
}

export const assets = {
  /** Подписка на загрузку любой картинки (рендер перерисовывает фон, если он изменился) */
  onLoad(fn) { listeners.push(fn); },

  /**
   * Готовый фон мира: { img, landscape } или null (тогда загрузка уже запущена).
   * landscape — нужен ли широкий кадр (экран шире, чем высокий).
   */
  background(world, landscape) {
    const w = norm(world);
    const wantL = !!landscape && LANDSCAPE.includes(w);
    const rec = load(urlFor(w, wantL));
    if (rec.ok) return { img: rec.img, landscape: wantL };
    if (wantL) {
      // пока грузится горизонтальный — подойдёт уже загруженный вертикальный
      const p = cache.get(urlFor(w, false));
      if (p && p.ok) return { img: p.img, landscape: false };
    }
    return null;
  },

  /** Загрузить фон мира заранее; промис завершается по загрузке или по таймауту (игра не ждёт сеть) */
  preload(world, landscape, timeoutMs = 0) {
    const w = norm(world);
    const rec = load(urlFor(w, !!landscape && LANDSCAPE.includes(w)));
    if (!timeoutMs) return rec.promise;
    return Promise.race([rec.promise, new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
  },

  /**
   * Рисованные иконки и кот: прогреваем кэш во время экрана загрузки, чтобы они появились сразу. Не дольше timeoutMs — игра не ждёт сеть.
   */
  preloadUI(timeoutMs = 0) {
    const all = Promise.all(UI.map((n) => load(`assets/${n}.png`).promise));
    if (!timeoutMs) return all;
    return Promise.race([all, new Promise((r) => setTimeout(() => r(false), timeoutMs))]);
  },

  /** Спрайт кота для настроения 'idle' | 'happy' | 'sad' (или null, пока не загружен) */
  cat(mood) {
    const rec = load(`assets/cat/${mood === 'happy' || mood === 'sad' ? mood : 'idle'}.png`);
    return rec.ok ? rec.img : null;
  },

  /** Все начатые загрузки завершены (для тестового стенда и промо-скриншотов) */
  idle() { return Promise.all([...cache.values()].map((r) => r.promise)); },
};
