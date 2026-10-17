import {
  FIELD_W, D, R, ROW_H, MIN_ANGLE, SHOT_SPEED, LAUNCH_FROM_BOTTOM, VIEW_MIN_H,
  T_KITTEN, T_NORMAL, S_NONE, S_BOMB, S_RAINBOW, S_FIRE, PTS_DROP, PTS_SHOT_LEFT,
  ENDLESS_MAX_ROWS, cameraTarget,
} from './constants.js';
import { Board, makeBubble, traceShot, traceFire, pathLength, pointAt, isColored } from './board.js';
import { resolveShot, resolveFire, removedCount } from './rules.js';

export const NEXT_OFFSET = [-64, 12];

/**
 * Игровая логика одного уровня (или партии бесконечного режима).
 * Ничего не рисует — только состояние и события для рендера/интерфейса.
 */
export class Engine {
  constructor(opts) {
    this.mode = opts.mode || 'level';
    this.level = opts.level || null;
    this.onEvent = opts.onEvent || (() => {});
    this.random = opts.random || Math.random;
    this.viewH = VIEW_MIN_H;
    this.score = 0;
    this.special = S_NONE;
    this.state = 'intro';
    this.timer = 0;
    this.aim = { active: false, angle: Math.PI / 2, valid: false, trace: null, key: '' };
    this.projectile = null;
    this.pendingSwap = false;
    this.downInfo = null;
    this.pressHeld = null;   // палец на поле: { swap, x, y, lx, ly } (касание могло начаться, пока шарик летел)
    this.queued = null;      // выстрел, отпущенный во время перезарядки: { x, y, angle, t }
    this.shotsFired = 0;
    this.continues = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.stats = { popped: 0, dropped: 0, kittens: 0 };
    this.reloadT = 0;
    this.swapT = 0;

    if (this.mode === 'level') {
      const L = this.level;
      this.board = L.board;
      this.goal = L.goal;
      this.shotsLeft = L.shots;
      this.shotsTotal = L.shots;
      this.kittensTotal = this.board.countWhere((b) => b.type === T_KITTEN);
      this.kittensFreed = 0;
      this.stars = L.stars;
    } else {
      this.goal = 'endless';
      this.board = new Board(0);
      this.colorCount = 4;
      this.missLimit = 5;
      this.misses = 0;
      this.shotsLeft = Infinity;
      this.kittensTotal = 0;
      this.kittensFreed = 0;
      this.endlessColors = [0, 1, 2, 3, 4, 5, 6];
      for (let i = 0; i < 6; i++) this.board.pushRowTop((c) => this._endlessCell(c));
      this.board.trim();
    }
    this.boardVersion = 0;
    this.cur = this._randColor();
    this.next = this._randColor();
    this.camY = 0;
    this.camTarget = 0;
    this._updateCamTarget();
    this.introCam = this.camTarget;
  }

  // ---------- Геометрия ----------
  setViewH(h) {
    this.viewH = Math.max(VIEW_MIN_H, h);
    this._updateCamTarget();
    if (this.state === 'intro') this.introCam = this.camTarget;
    else this.camY = this.camTarget;
    this.aim.key = '';
  }

  /** Центр пушки в мировых координатах (пушка закреплена внизу экрана) */
  launcher() { return [FIELD_W / 2, this.camY + this.viewH - LAUNCH_FROM_BOTTOM]; }

  get cameraSettled() { return Math.abs(this.camY - this.camTarget) < 0.5; }

  _updateCamTarget() {
    this.camTarget = this.mode === 'endless' ? 0 : cameraTarget(this.board.lowestRow(), this.viewH);
  }

  // ---------- Цвета ----------
  _randColor() {
    const cols = this.board.colorsPresent();
    if (!cols.length) {
      if (this.mode === 'endless') return this.endlessColors[Math.floor(this.random() * this.colorCount)];
      return this.level && this.level.params ? this.level.params.palette[0] : 0;
    }
    return cols[Math.floor(this.random() * cols.length)];
  }

  _endlessCell(c) {
    // Новые ряды бесконечного режима: цвета слегка «слипаются» с соседом слева
    const row0 = this.board.rows[0];
    const left = c > 0 && row0 ? row0[c - 1] : null;
    if (left && isColored(left) && this.random() < 0.45) return makeBubble(left.color);
    return makeBubble(this.endlessColors[Math.floor(this.random() * this.colorCount)]);
  }

  _fixColors() {
    const present = this.board.colorsPresent();
    if (!present.length) return;
    if (!present.includes(this.cur)) { this.cur = this._randColor(); this.emit('recolor', { which: 'cur' }); }
    if (!present.includes(this.next)) { this.next = this._randColor(); this.emit('recolor', { which: 'next' }); }
  }

  emit(type, data = {}) { this.onEvent(type, data, this); }

  get canShoot() {
    return this.state === 'aim' && !this.projectile && this.reloadT <= 0 &&
      this.cameraSettled && this.shotsLeft > 0;
  }

  // ---------- Ввод (мировые координаты) ----------
  _angleTo(wx, wy) {
    const [lx, ly] = this.launcher();
    const dy = ly - wy, dx = wx - lx;
    if (dy < R * 0.6) return null;
    const a = Math.atan2(dy, dx);
    return Math.max(MIN_ANGLE, Math.min(Math.PI - MIN_ANGLE, a));
  }

  _nearLauncher(wx, wy) {
    const [lx, ly] = this.launcher();
    const dl = Math.hypot(wx - lx, wy - ly);
    const dn = Math.hypot(wx - (lx + NEXT_OFFSET[0]), wy - (ly + NEXT_OFFSET[1]));
    return dl < D * 0.95 || dn < D * 0.8;
  }

  pointerDown(wx, wy) {
    if (this.state === 'intro') { this.skipIntro(); return; }
    if (this.state === 'win-seq') { this.skipWinSequence(); return; }
    this.queued = null;
    // касание засчитываем даже во время полёта шарика: как только можно целиться, палец «подхватится»
    const near = this._nearLauncher(wx, wy);
    // lx/ly — последняя точка пальца относительно экрана (не зависит от сдвига камеры)
    this.pressHeld = { swap: near, x: wx, y: wy, lx: wx, ly: wy - this.camY };
    if (this.state !== 'aim') return;
    if (near) {
      this.downInfo = { swap: true, x: wx, y: wy };
      this.aim.active = false;
      return;
    }
    this.downInfo = { swap: false, x: wx, y: wy };
    this.pointerMove(wx, wy, true);
  }

  pointerMove(wx, wy, pressed) {
    if (this.state !== 'aim') {
      if (this.pressHeld && pressed) { this.pressHeld.lx = wx; this.pressHeld.ly = wy - this.camY; }
      this.aim.active = false;
      return;
    }
    // палец коснулся, пока шарик летел, и всё ещё на поле — теперь это обычное прицеливание
    if (!this.downInfo && this.pressHeld && pressed) this.downInfo = { ...this.pressHeld };
    if (this.downInfo && this.downInfo.swap) {
      if (Math.hypot(wx - this.downInfo.x, wy - this.downInfo.y) > D) this.downInfo.swap = false;
      else return;
    }
    const a = this._angleTo(wx, wy);
    if (a === null || (this._nearLauncher(wx, wy) && !pressed)) {
      this.aim.active = false; this.aim.valid = false; return;
    }
    this.aim.active = true;
    this.aim.valid = true;
    this.aim.angle = a;
  }

  pointerUp(wx, wy) {
    let info = this.downInfo;
    const held = this.pressHeld;
    this.downInfo = null;
    this.pressHeld = null;
    if (this.state !== 'aim') { this.aim.active = false; return; }
    // касание началось во время полёта шарика, а отпущено, когда уже можно стрелять
    if (!info && held) info = held;
    if (info && info.swap && this._nearLauncher(wx, wy)) { this.swap(); return; }
    if (!info) return; // отпускание без нажатия на поле (например, после всплывающего окна)
    const a = this._angleTo(wx, wy);
    if (a === null) { this.aim.active = false; return; } // отпустили ниже пушки — отмена выстрела
    this.aim.angle = a;
    // пушка ещё перезаряжается или камера доезжает — не теряем выстрел, а выполняем, как только будет можно.
    // Запоминаем точку под пальцем: если камера сдвинется, полетим в тот же шарик, а не просто под тем же углом.
    if (!this.shoot(a) && this.shotsLeft > 0) this.queued = { x: wx, y: wy, angle: a, t: 1 };
  }

  /** Жест отменён (системный жест, второй палец, окно поверх поля) — без выстрела */
  pointerCancel() {
    this.downInfo = null;
    this.pressHeld = null;
    this.queued = null;
    this.aim.active = false;
  }

  pointerLeave() { if (!this.downInfo) this.aim.active = false; }

  /** Трасса прицела (кэшируется по углу и состоянию поля) */
  aimTrace() {
    if (!this.aim.active || !this.aim.valid || this.state !== 'aim' || !this.cameraSettled) return null;
    const [lx, ly] = this.launcher();
    const key = `${this.aim.angle.toFixed(4)}|${ly.toFixed(1)}|${this.boardVersion || 0}|${this.special}`;
    if (this.aim.key !== key) {
      this.aim.key = key;
      this.aim.trace = this.special === S_FIRE
        ? traceFire(this.board, lx, ly, this.aim.angle)
        : traceShot(this.board, lx, ly, this.aim.angle);
    }
    return this.aim.trace;
  }

  swap() {
    if (this.state !== 'aim' || this.projectile || this.special) return;
    const t = this.cur; this.cur = this.next; this.next = t;
    this.swapT = 1;
    this.emit('swap');
  }

  activateSpecial(type) {
    if (this.state !== 'aim' || this.projectile) return false;
    if (this.special === type) { this.special = S_NONE; this.emit('special', { type: '' }); return 'cancel'; }
    const prev = this.special;
    this.special = type;
    this.emit('special', { type, prev });
    return prev ? { replaced: prev } : true;
  }

  // ---------- Выстрел ----------
  shoot(angle) {
    if (!this.canShoot) return false;
    const [lx, ly] = this.launcher();
    const special = this.special;
    let proj;
    if (special === S_FIRE) {
      const tr = traceFire(this.board, lx, ly, angle);
      proj = { pts: tr.pts, burned: tr.burned, special, color: -1 };
    } else {
      const tr = traceShot(this.board, lx, ly, angle);
      proj = { pts: tr.pts, cell: tr.cell, special, color: special ? -1 : this.cur };
    }
    proj.len = pathLength(proj.pts);
    proj.dist = 0;
    proj.x = lx; proj.y = ly;
    proj.burnIdx = 0;
    // Дистанции до точек отскока (для звука «тук» о стенку)
    proj.vertexDists = [];
    let acc = 0;
    for (let i = 2; i < proj.pts.length - 2; i += 2) {
      acc += Math.hypot(proj.pts[i] - proj.pts[i - 2], proj.pts[i + 1] - proj.pts[i - 1]);
      proj.vertexDists.push([acc, proj.pts[i], proj.pts[i + 1]]);
    }
    proj.nextVertex = 0;
    this.projectile = proj;
    this.aim.active = false;
    this.state = 'flying';
    if (!special) {
      this.shotsLeft--;
      this.shotsFired++;
      this.cur = this.next;
      this.next = this._randColor();
      this.reloadT = 1;
    } else {
      this.special = S_NONE;
    }
    this.emit('shoot', { special, color: proj.color, angle });
    this.emit('shots');
    return true;
  }

  // ---------- Обновление ----------
  update(dt) {
    if (dt > 0.05) dt = 0.05;
    // Камера
    if (this.state === 'intro') {
      this.timer += dt;
      const pan = this.introCam > 1;
      if (pan && this.timer > 0.5) {
        const t = Math.min(1, (this.timer - 0.5) / 1.0);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.camY = this.introCam * e;
      }
      if (this.timer >= (pan ? 1.55 : 0.6)) {
        this.camY = this.introCam;
        this.camTarget = this.introCam;
        this.state = 'aim';
        this.emit('ready');
      }
    } else {
      const k = 1 - Math.pow(0.0025, dt);
      this.camY += (this.camTarget - this.camY) * k;
      if (Math.abs(this.camTarget - this.camY) < 0.3) this.camY = this.camTarget;
    }
    if (this.reloadT > 0) this.reloadT = Math.max(0, this.reloadT - dt * 6);
    if (this.swapT > 0) this.swapT = Math.max(0, this.swapT - dt * 6);
    // отложенный выстрел (отпустили во время перезарядки или доводки камеры): стреляем, как только можно, но не позже 1 с
    if (this.queued) {
      const q = this.queued;
      q.t -= dt;
      if (this.state !== 'aim' || q.t <= 0) this.queued = null;
      else if (this.canShoot) {
        this.queued = null;
        const a = this._angleTo(q.x, q.y) ?? q.angle;
        this.aim.angle = a;
        this.shoot(a);
      }
    }
    // палец держат с полёта и не двигают — как только можно целиться, показываем прицел под ним
    const held = this.pressHeld;
    if (held && !held.swap && !this.downInfo && this.state === 'aim') this.pointerMove(held.lx, held.ly + this.camY, true);

    if (this.state === 'flying') this._updateProjectile(dt);
    else if (this.state === 'win-seq') this._updateWinSequence(dt);
    else if (this.state === 'settle') {
      this.timer -= dt;
      if (this.timer <= 0) this._afterSettle();
    }
  }

  _updateProjectile(dt) {
    const p = this.projectile;
    const speed = p.special === S_FIRE ? SHOT_SPEED * 0.9 : SHOT_SPEED;
    const prevDist = p.dist;
    p.dist = Math.min(p.len, p.dist + speed * dt);
    const [x, y] = pointAt(p.pts, p.dist);
    // Отскоки от стен — для звука
    while (p.nextVertex < p.vertexDists.length && p.dist >= p.vertexDists[p.nextVertex][0]) {
      const v = p.vertexDists[p.nextVertex++];
      this.emit('bounce', { x: v[1], y: v[2] });
    }
    p.x = x; p.y = y;
    if (p.special === S_FIRE) {
      // Сжигаем шарики по мере полёта
      while (p.burnIdx < p.burned.length && p.burned[p.burnIdx].dist <= p.dist + R) {
        const { b } = p.burned[p.burnIdx++];
        this.emit('burn', { b, x: this.board.x(b.r, b.c), y: this.board.y(b.r) });
      }
    }
    if (p.dist >= p.len || prevDist === p.len) this._land();
  }

  _land() {
    const p = this.projectile;
    this.projectile = null;
    let res;
    if (p.special === S_FIRE) {
      const snapshot = p.burned.map(({ b, dist }) => ({ b, dist, x: this.board.x(b.r, b.c), y: this.board.y(b.r) }));
      res = resolveFire(this.board, p.burned);
      res.positions = new Map(snapshot.map((s) => [s.b.id, [s.x, s.y]]));
    } else {
      const [r, c] = p.cell;
      const positions = new Map();
      this.board.forEach((b, br, bc) => positions.set(b.id, [this.board.x(br, bc), this.board.y(br)]));
      const ox = this.board.x(r, c), oy = this.board.y(r);
      res = resolveShot(this.board, r, c, p.color, p.special);
      if (res.placed) positions.set(res.placed.id, [ox, oy]);
      res.positions = positions;
      res.ox = ox; res.oy = oy;
    }
    this.boardVersion = (this.boardVersion || 0) + 1;
    this._applyResult(res, p);
  }

  _applyResult(res, p) {
    const pos = (b) => res.positions.get(b.id) || [this.board.x(b.r, b.c), this.board.y(b.r)];
    const removed = removedCount(res);
    if (res.placed) this.emit('land', { b: res.placed, x: res.ox, y: res.oy, removed });
    if (p.special === S_BOMB) this.emit('bomb', { x: res.ox, y: res.oy });
    if (p.special === S_RAINBOW) this.emit('rainbow', { x: res.ox, y: res.oy });
    if (res.popped.length) this.emit('pop', { list: res.popped.map((b) => ({ b, xy: pos(b) })), x: res.ox, y: res.oy });
    if (res.exploded.length) this.emit('explode', { list: res.exploded.map((b) => ({ b, xy: pos(b) })), x: res.ox, y: res.oy, fire: p.special === S_FIRE });
    if (res.dropped.length) this.emit('drop', { list: res.dropped.map((b) => ({ b, xy: pos(b) })) });
    const kittensNow = [...res.popped, ...res.exploded, ...res.dropped].filter((b) => b.type === T_KITTEN);
    if (kittensNow.length) {
      this.kittensFreed += kittensNow.length;
      this.stats.kittens += kittensNow.length;
      this.emit('kittens', { list: kittensNow.map((b) => ({ b, xy: pos(b) })) });
    }
    this.stats.popped += res.popped.length + res.exploded.length;
    this.stats.dropped += res.dropped.length;
    if (res.score > 0) {
      this.score += res.score;
      const [sx, sy] = res.ox !== undefined ? [res.ox, res.oy] : [FIELD_W / 2, this.camY + 200];
      this.emit('score', { amount: res.score, x: sx, y: sy });
    }
    if (removed > 0) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (removed >= 8) this.emit('praise', { level: removed >= 22 ? 3 : removed >= 14 ? 2 : 1 });
    } else if (!p.special) {
      this.combo = 0;
    }

    if (this.mode === 'endless') this._endlessAfterShot(removed, p);

    this._updateCamTarget();
    this._fixColors();
    this.emit('board');
    this.state = 'settle';
    this.timer = 0.08;
  }

  _afterSettle() {
    if (this.mode === 'level') {
      if (this._goalDone()) { this._startWinSequence(); return; }
      if (this.shotsLeft <= 0) { this.state = 'out'; this.emit('outOfShots'); return; }
    } else if (this.board.lowestRow() >= ENDLESS_MAX_ROWS) {
      this.state = 'over';
      this.emit('gameOver');
      return;
    }
    this.state = 'aim';
  }

  _goalDone() {
    if (this.goal === 'kittens') return this.kittensFreed >= this.kittensTotal;
    return this.board.count() === 0;
  }

  get goalLeft() {
    if (this.goal === 'kittens') return Math.max(0, this.kittensTotal - this.kittensFreed);
    return this.board.count();
  }

  // ---------- Победа ----------
  _startWinSequence() {
    this.state = 'win-seq';
    this.winPhase = 0;
    this.timer = 0.55;
    this.emit('goalReached');
  }

  _updateWinSequence(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    if (this.winPhase === 0) {
      // Обрушиваем оставшиеся шарики
      const rest = this.board.all();
      if (rest.length) {
        const list = rest.map((b) => ({ b, xy: [this.board.x(b.r, b.c), this.board.y(b.r)] }));
        for (const b of rest) this.board.remove(b);
        this.board.trim();
        const pts = rest.length * PTS_DROP;
        this.score += pts;
        this.emit('drop', { list, final: true });
        this.emit('score', { amount: pts, x: FIELD_W / 2, y: this.camY + this.viewH * 0.35 });
        this.boardVersion++;
        this.timer = 0.9;
      } else this.timer = 0.2;
      this.winPhase = 1;
      return;
    }
    if (this.winPhase === 1) {
      if (this.shotsLeft > 0) {
        this.shotsLeft--;
        this.score += PTS_SHOT_LEFT;
        this.emit('bonusShot', { color: this.cur });
        this.cur = Math.floor(this.random() * 7);
        this.emit('shots');
        this.timer = 0.13;
        return;
      }
      this.winPhase = 2;
      this.timer = 0.7;
      return;
    }
    if (this.winPhase === 2) {
      this.state = 'won';
      this.emit('complete', { score: this.score, stars: this.starsFor(this.score) });
    }
  }

  skipWinSequence() {
    if (this.state !== 'win-seq' || this.winPhase < 1) return;
    if (this.shotsLeft > 0) {
      const n = this.shotsLeft;
      this.score += n * PTS_SHOT_LEFT;
      this.shotsLeft = 0;
      this.emit('bonusShot', { color: this.cur, count: n });
      this.emit('shots');
    }
    this.winPhase = 2;
    this.timer = 0.25;
  }

  skipIntro() {
    if (this.state !== 'intro') return;
    this.timer = 99;
  }

  /** Слегка «пошатать» сетку (визуальный эффект) — используется рендером */
  get isBusy() { return this.state === 'flying' || this.state === 'settle' || this.state === 'win-seq'; }

  starsFor(score) {
    if (!this.stars) return 1;
    if (score >= this.stars[2]) return 3;
    if (score >= this.stars[1]) return 2;
    return 1;
  }

  /** Сколько звёзд «уже заработано» по текущему счёту (для полоски прогресса) */
  starProgress() {
    if (!this.stars) return 0;
    return Math.min(1, this.score / this.stars[2]);
  }

  // ---------- Продолжение / проигрыш ----------
  addShots(n) {
    if (this.state !== 'out') return;
    this.shotsLeft += n;
    this.continues++;
    this.state = 'aim';
    this.emit('shots');
  }

  fail() {
    this.state = 'lost';
    this.emit('failed');
  }

  // ---------- Бесконечный режим ----------
  _endlessAfterShot(removed, p) {
    if (this.board.count() === 0) {
      this.score += 1000;
      this.emit('score', { amount: 1000, x: FIELD_W / 2, y: 200 });
      this.emit('praise', { level: 3 });
      for (let i = 0; i < 4; i++) this.board.pushRowTop((c) => this._endlessCell(c));
      this.board.trim();
      this.emit('push', { rows: 4 });
      return;
    }
    // Рост сложности со счётом
    const s = this.score;
    this.colorCount = s < 1500 ? 4 : s < 5000 ? 5 : s < 12000 ? 6 : 7;
    this.missLimit = s < 3000 ? 5 : s < 9000 ? 4 : 3;
    if (removed === 0 && !p.special) {
      this.misses++;
      if (this.misses >= this.missLimit) {
        this.misses = 0;
        this.board.pushRowTop((c) => this._endlessCell(c));
        this.board.trim();
        this.boardVersion++;
        this.emit('push', { rows: 1 });
      }
    }
    this.emit('misses');
  }

  /** Продолжение в бесконечном режиме: убрать нижние ряды */
  endlessRescue(rowsToClear = 5) {
    if (this.state !== 'over') return;
    const low = this.board.lowestRow();
    const from = Math.max(1, low - rowsToClear + 1);
    const list = [];
    this.board.forEach((b, r, c) => { if (r >= from) list.push({ b, xy: [this.board.x(r, c), this.board.y(r)] }); });
    for (const { b } of list) this.board.remove(b);
    const floating = this.board.floating();
    for (const b of floating) { list.push({ b, xy: [this.board.x(b.r, b.c), this.board.y(b.r)] }); this.board.remove(b); }
    this.board.trim();
    this.boardVersion++;
    this.misses = 0;
    this.continues++;
    this.emit('drop', { list, final: true });
    this._fixColors();
    this.state = 'aim';
    this.emit('board');
  }
}
