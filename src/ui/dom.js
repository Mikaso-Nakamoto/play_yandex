// Минимальные помощники для DOM
function flatten(arr, out = []) {
  for (const x of arr) { if (Array.isArray(x)) flatten(x, out); else out.push(x); }
  return out;
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of flatten(children)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

let toastTimer = 0;
export function toast(msg, ms = 2200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('off');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('off'), ms);
}

export function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/**
 * Своя прокрутка содержимого (перетаскивание + колесо мыши) без системной прокрутки страницы.
 * Возвращает объект с методами update() и scrollTo().
 */
export function makeScroller(viewport, content, opts = {}) {
  let y = 0, vy = 0, dragging = false, lastY = 0, lastT = 0, startY = 0, moved = 0, raf = 0, frameT = 0;
  let pid = null; // палец, который ведёт прокрутку (второй палец игнорируем)
  const min = () => Math.min(0, viewport.clientHeight - content.scrollHeight - (opts.padBottom || 0));
  const apply = () => { content.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`; if (opts.onScroll) opts.onScroll(y); };
  const clampY = () => { y = Math.max(min(), Math.min(0, y)); };
  // инерция по реальному времени кадра: одинаковая на 60 и 120 Гц и при просадках кадров
  const tick = (now) => {
    if (dragging) { raf = 0; return; }
    const dt = Math.min(50, Math.max(0, now - frameT));
    frameT = now;
    if (Math.abs(vy) < 0.02) { raf = 0; return; }
    y += vy * dt; vy *= Math.pow(0.94, dt / 16.7);
    const m = min();
    if (y > 0 || y < m) { clampY(); vy = 0; }
    apply();
    raf = requestAnimationFrame(tick);
  };
  viewport.addEventListener('pointerdown', (e) => {
    if (dragging && e.pointerId !== pid && !e.isPrimary) return; // второй палец
    pid = e.pointerId;
    dragging = true; moved = 0; startY = lastY = e.clientY; lastT = performance.now(); vy = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pid) return;
    const dy = e.clientY - lastY;
    const now = performance.now();
    moved = Math.max(moved, Math.abs(e.clientY - startY));
    y += dy; clampY(); apply();
    // сглаженная скорость: один «рваный» отсчёт не превращается в бросок
    const inst = dy / Math.max(8, now - lastT);
    vy = vy * 0.3 + inst * 0.7;
    lastY = e.clientY; lastT = now;
  });
  const end = (e) => {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false; pid = null;
    // палец остановился перед отпусканием — без броска
    if (e.type === 'pointercancel' || performance.now() - lastT > 80) vy = 0;
    if (Math.abs(vy) > 0.05) { frameT = performance.now(); raf = requestAnimationFrame(tick); }
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    y -= e.deltaY * (e.deltaMode === 1 ? 30 : 1);
    clampY(); apply();
  }, { passive: false });
  // клик после перетаскивания не считается нажатием
  viewport.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } }, true);
  return {
    update() { clampY(); apply(); },
    scrollTo(v) { y = v; clampY(); apply(); },
    get y() { return y; },
    get canScroll() { return min() < 0; },
  };
}
