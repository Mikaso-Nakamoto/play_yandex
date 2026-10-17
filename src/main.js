// Точка входа: инициализация SDK → язык → игрок и сохранения → покупки → интерфейс → LoadingAPI.ready()
import { platform } from './core/platform.js';
import { store } from './core/storage.js';
import { setLang, t } from './core/i18n.js';
import { App } from './app.js';
import { chooseShot } from './game/bot.js';
import { assets } from './core/assets.js';
import { worldOf } from './game/levels.js';

// Простейший полифилл Pointer Events для старых iOS (Safari < 13)
function pointerShim() {
  if (window.PointerEvent) return;
  const fire = (type, src, pt, id, ptype, buttons) => {
    const ev = document.createEvent('Event');
    ev.initEvent(type, true, true);
    ev.clientX = pt.clientX; ev.clientY = pt.clientY; ev.pointerId = id; ev.pointerType = ptype; ev.buttons = buttons;
    (src.target || document).dispatchEvent(ev);
  };
  const map = { touchstart: 'pointerdown', touchmove: 'pointermove', touchend: 'pointerup', touchcancel: 'pointercancel' };
  Object.keys(map).forEach((k) => document.addEventListener(k, (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const tch = e.changedTouches[i];
      fire(map[k], e, tch, tch.identifier + 2, 'touch', k === 'touchend' || k === 'touchcancel' ? 0 : 1);
    }
  }, { passive: false, capture: true }));
  const mm = { mousedown: 'pointerdown', mousemove: 'pointermove', mouseup: 'pointerup' };
  Object.keys(mm).forEach((k) => document.addEventListener(k, (e) => fire(mm[k], e, e, 1, 'mouse', e.buttons), true));
}

function waitFonts(ms) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    Promise.all([document.fonts.load('900 20px Nunito'), document.fonts.load('800 20px Nunito')]).catch(() => {}),
    new Promise((r) => setTimeout(r, ms)),
  ]);
}

const safe = async (fn) => { try { return await fn(); } catch (e) { console.warn(e); return null; } };

async function boot() {
  pointerShim();
  await safe(() => platform.init());
  let qLang = null;
  try { qLang = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  setLang(qLang || platform.lang);
  const logo = document.querySelector('.loader-logo');
  if (logo) logo.textContent = t('title');
  document.title = t('title');

  await safe(() => platform.initPlayer());
  await safe(() => store.load());

  const app = new App();
  window.__app = app;
  if (/[?&]test=1/.test(location.search)) window.__bot = { chooseShot };
  app.assets = assets;
  app.init();
  // Рисованный фон стартового мира грузим, пока виден загрузчик (не дольше 1,5 с — дальше подменится сам)
  const wide = window.innerWidth > window.innerHeight * 1.1;
  const startWorld = worldOf(store.data.level);
  await Promise.all([safe(() => app.syncTime()), safe(() => platform.initPayments()), waitFonts(1200), assets.preload(startWorld, wide, 1500)]);
  await safe(() => app.processPurchases());
  app.start();

  const loader = document.getElementById('loader');
  if (loader) { loader.classList.add('fade'); setTimeout(() => loader.remove(), 450); }
  // Игра готова к взаимодействию — сообщаем платформе
  platform.loadingReady();
  if (!store.data.noAds) platform.showBanner();
  // следующий мир — заранее, чтобы на карте и при переходе фон появился сразу
  setTimeout(() => assets.preload(startWorld + 1, wide), 2500);
}

window.addEventListener('error', (e) => { console.warn('[game error]', e.message); });
window.addEventListener('unhandledrejection', (e) => { console.warn('[game promise]', e.reason); });

boot();
