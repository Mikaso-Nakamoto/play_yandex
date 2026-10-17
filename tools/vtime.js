// Виртуальное время для покадровой записи промо (скриншоты и видео).
// Функция внедряется в страницу через page.evaluateOnNewDocument(installVirtualTime) ДО загрузки игры.
//
// Пока режим «auto» — время идёт синхронно с реальным (игра загружается как обычно).
// После window.__vt.manual(true, seed) время стоит на месте и двигается только вызовами
// window.__vt.step(ms): срабатывают таймеры, кадры requestAnimationFrame и CSS-анимации
// (через Web Animations API они ставятся на паузу и перематываются вручную).
// Так видео получается плавным независимо от того, сколько реально длится снятие кадра,
// а сцены воспроизводимы (Math.random пересевается детерминированным генератором).
export function installVirtualTime() {
  const W = window;
  const rRAF = W.requestAnimationFrame.bind(W);
  const rPerfNow = performance.now.bind(performance);
  const rDateNow = Date.now.bind(Date);
  const basePerf = rPerfNow();
  const baseDate = rDateNow();
  let vt = 0;
  let manual = false;
  let lastReal = rPerfNow();
  const rafQ = new Map();
  let rafSeq = 1;
  const timers = new Map();
  let tSeq = 1;
  const hooks = [];

  performance.now = () => basePerf + vt;
  Date.now = () => baseDate + vt;
  W.requestAnimationFrame = (cb) => { const id = rafSeq++; rafQ.set(id, cb); return id; };
  W.cancelAnimationFrame = (id) => { rafQ.delete(id); };
  W.setTimeout = (fn, ms, ...args) => { const id = tSeq++; timers.set(id, { at: vt + Math.max(0, Number(ms) || 0), fn, args, every: 0 }); return id; };
  W.setInterval = (fn, ms, ...args) => { const id = tSeq++; const every = Math.max(4, Number(ms) || 0); timers.set(id, { at: vt + every, fn, args, every }); return id; };
  W.clearTimeout = (id) => { timers.delete(id); };
  W.clearInterval = (id) => { timers.delete(id); };

  function runTimers(upTo) {
    for (let guard = 0; guard < 5000; guard++) {
      let best = null;
      for (const [id, t] of timers) {
        if (t.at <= upTo && (!best || t.at < best[1].at || (t.at === best[1].at && id < best[0]))) best = [id, t];
      }
      if (!best) break;
      const [id, t] = best;
      if (t.at > vt) vt = t.at;
      if (t.every) t.at += t.every; else timers.delete(id);
      try { if (typeof t.fn === 'function') t.fn(...t.args); } catch (e) { console.error(e); }
    }
    vt = upTo;
  }

  function runFrame() {
    const cbs = [...rafQ.values()];
    rafQ.clear();
    const ts = basePerf + vt;
    for (const cb of cbs) { try { cb(ts); } catch (e) { console.error(e); } }
  }

  const seenAnim = new WeakSet();
  function syncAnimations(ms) {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      try {
        if (!seenAnim.has(a)) { seenAnim.add(a); a.pause(); a.currentTime = 0; } else { a.pause(); a.currentTime = (Number(a.currentTime) || 0) + ms; }
      } catch (e) { /* ignore */ }
    }
  }

  function autoTick() {
    if (manual) return;
    const now = rPerfNow();
    const dt = Math.min(100, now - lastReal);
    lastReal = now;
    runTimers(vt + dt);
    runFrame();
    rRAF(autoTick);
  }
  rRAF(autoTick);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  W.__vt = {
    now: () => vt,
    isManual: () => manual,
    seed(s) { Math.random = mulberry32(s >>> 0); },
    manual(on, seed) {
      if (seed !== undefined) this.seed(seed);
      if (on && !manual) {
        manual = true;
        if (document.getAnimations) for (const a of document.getAnimations()) { try { seenAnim.add(a); a.pause(); } catch (e) { /* ignore */ } }
      } else if (!on && manual) {
        manual = false;
        lastReal = rPerfNow();
        if (document.getAnimations) for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* ignore */ } }
        rRAF(autoTick);
      }
    },
    /** Продвинуть время на ms (один кадр) */
    step(ms) {
      runTimers(vt + ms);
      for (const h of hooks) { try { h(ms); } catch (e) { console.error(e); } }
      runFrame();
      syncAnimations(ms);
    },
    /** Несколько кадров подряд без съёмки */
    run(totalMs, frameMs = 1000 / 30) { for (let t = 0; t < totalMs - 1e-6; t += frameMs) this.step(frameMs); },
    /** Хук, вызываемый перед каждым кадром (режиссёр сцены) */
    onStep(fn) { hooks.push(fn); },
    clearHooks() { hooks.length = 0; },
  };
}
