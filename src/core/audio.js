// Все звуки синтезируются WebAudio «на лету» — никаких аудиофайлов и системного плеера.

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.musicBus = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.suspended = false;    // пауза по причине фокуса/рекламы
    this.noise = null;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.lastPlay = {};
  }

  /** Создаём контекст по первому жесту пользователя */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.55 : 0;
      this.sfx.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.16 : 0;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 1;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.startMusic();
    }
    if (!this.suspended && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Полная тишина (потеря фокуса, реклама) */
  suspend() {
    this.suspended = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.suspended = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, 0.1);
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running' && !this.suspended; }

  // ---------- Примитивы ----------
  tone(freq, dur, { type = 'sine', vol = 0.3, attack = 0.005, slide = 0, delay = 0, bus = null } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', sweep = 0, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // ---------- Игровые звуки ----------
  play(name, arg = 0) {
    if (!this.ctx || !this.sfxOn || this.suspended || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // защита от «каши» одинаковых звуков
    const minGap = name === 'pop' ? 0.025 : 0.04;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap && name !== 'star') return;
    this.lastPlay[name] = now;
    try { this['_' + name] && this['_' + name](arg); } catch (e) { /* ignore */ }
  }

  _shoot() { this.noiseBurst(0.14, { vol: 0.16, freq: 700, sweep: 3.5, q: 0.8 }); this.tone(380, 0.1, { type: 'triangle', vol: 0.08, slide: 1.8 }); }
  _bounce() { this.tone(520, 0.05, { type: 'triangle', vol: 0.12, slide: 0.7 }); }
  _land() { this.tone(240, 0.09, { vol: 0.18, slide: 0.55 }); }
  _pop(i) {
    const semi = PENTA[Math.min(i, PENTA.length - 1)];
    const f = 523.25 * Math.pow(2, semi / 12);
    this.tone(f, 0.11, { type: 'sine', vol: 0.22, slide: 1.25 });
    this.tone(f * 2, 0.05, { type: 'triangle', vol: 0.05 });
    this.noiseBurst(0.03, { vol: 0.05, freq: 3000, q: 2 });
  }
  _drop() {
    for (let i = 0; i < 4; i++) this.tone(900 - i * 120, 0.12, { type: 'triangle', vol: 0.07, delay: i * 0.06, slide: 0.6 });
  }
  _thud() { this.tone(160, 0.08, { vol: 0.08, slide: 0.6 }); }
  _swap() { this.tone(660, 0.06, { type: 'triangle', vol: 0.12 }); this.tone(880, 0.06, { type: 'triangle', vol: 0.12, delay: 0.05 }); }
  _kitten() {
    // Синтезированное «мяу»: пила через полосовой фильтр с «гласной» огибающей
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(950, t + 0.12);
    o.frequency.linearRampToValueAtTime(560, t + 0.42);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1900, t + 0.15);
    f.frequency.linearRampToValueAtTime(1000, t + 0.42);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(f); f.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + 0.5);
  }
  _bomb() {
    this.noiseBurst(0.7, { vol: 0.5, freq: 900, type: 'lowpass', sweep: 0.12, q: 0.7 });
    this.tone(120, 0.6, { vol: 0.4, slide: 0.3 });
  }
  _fire() { this.noiseBurst(0.6, { vol: 0.3, freq: 500, sweep: 4, q: 0.6 }); this.tone(200, 0.5, { type: 'sawtooth', vol: 0.05, slide: 2 }); }
  _rainbow() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(659 * Math.pow(2, s / 12), 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.045 })); }
  _star(i) { const f = [880, 1108.7, 1318.5][Math.min(2, i)]; this.tone(f, 0.35, { vol: 0.2 }); this.tone(f * 2, 0.25, { type: 'triangle', vol: 0.06 }); }
  _win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.28, { type: 'triangle', vol: 0.18, delay: i * 0.11 })); this.tone(1318.5, 0.5, { vol: 0.12, delay: 0.46 }); }
  _lose() { [392, 329.6, 261.6].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.16, delay: i * 0.16, slide: 0.97 })); }
  _click() { this.tone(700, 0.045, { type: 'triangle', vol: 0.12, slide: 1.3 }); }
  _coin() { this.tone(987.8, 0.08, { type: 'square', vol: 0.05 }); this.tone(1318.5, 0.18, { type: 'square', vol: 0.05, delay: 0.07 }); }
  _praise(l) { [0, 5, 9, 12 + l * 2].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); }
  _push() { this.tone(110, 0.25, { vol: 0.25, slide: 0.6 }); this.noiseBurst(0.2, { vol: 0.08, freq: 300, type: 'lowpass' }); }
  _bonus(i) { this.tone(600 + (i % 12) * 60, 0.09, { type: 'triangle', vol: 0.1, slide: 1.4 }); }
  _special() { this.tone(440, 0.12, { type: 'triangle', vol: 0.12, slide: 2 }); }
  _error() { this.tone(200, 0.15, { type: 'square', vol: 0.05, slide: 0.8 }); }

  // ---------- Музыка: мягкая «музыкальная шкатулка» ----------
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    this.nextNoteTime = this.ctx.currentTime + 0.3;
    this.step = 0;
    this.musicTimer = setInterval(() => this.schedule(), 60);
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextNoteTime < c.currentTime - 0.5) this.nextNoteTime = c.currentTime + 0.05;
    const spb = 60 / 96 / 2; // восьмые при 96 BPM
    // I–vi–IV–V в до мажоре; по 8 восьмых на аккорд
    const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
    const melody = [76, 0, 79, 76, 74, 0, 72, 0, 72, 0, 76, 74, 72, 0, 69, 0, 69, 72, 77, 76, 74, 0, 72, 0, 71, 0, 74, 72, 71, 0, 67, 0,
      76, 0, 79, 81, 79, 0, 76, 0, 72, 0, 74, 76, 72, 0, 69, 0, 77, 76, 74, 72, 74, 0, 77, 0, 79, 0, 77, 74, 72, 0, 0, 0];
    while (this.nextNoteTime < c.currentTime + 0.25) {
      const s = this.step % 64;
      const chord = chords[Math.floor(s / 8) % 4];
      const t = this.nextNoteTime - c.currentTime;
      const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
      // арпеджио
      const arp = chord[[0, 1, 2, 1][s % 4]];
      this.tone(mf(arp), spb * 1.6, { type: 'triangle', vol: 0.12, delay: t, bus: this.musicBus, attack: 0.01 });
      // бас на сильные доли
      if (s % 4 === 0) this.tone(mf(chord[0] - 24), spb * 3.5, { type: 'sine', vol: 0.22, delay: t, bus: this.musicBus, attack: 0.02 });
      // мелодия
      const m = melody[s];
      if (m) this.tone(mf(m), spb * 1.8, { type: 'sine', vol: 0.16, delay: t, bus: this.musicBus, attack: 0.01 });
      this.step++;
      this.nextNoteTime += spb;
    }
  }
}

export const audio = new Audio();

export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
