// Поиск ffmpeg для промо-скриптов.
// Порядок: переменная окружения FFMPEG → ffmpeg из PATH → бинарник из Python-пакета imageio-ffmpeg
// (pip install --user imageio-ffmpeg — он содержит статическую сборку ffmpeg).
import { execFileSync, spawnSync } from 'node:child_process';

let cached = null;

export function ffmpegPath() {
  if (cached) return cached;
  const candidates = [];
  if (process.env.FFMPEG) candidates.push(process.env.FFMPEG);
  candidates.push('ffmpeg');
  try {
    const p = execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (p) candidates.push(p);
  } catch (e) { /* нет python/imageio-ffmpeg */ }
  for (const c of candidates) {
    const r = spawnSync(c, ['-version'], { stdio: 'ignore' });
    if (r.status === 0) { cached = c; return c; }
  }
  throw new Error('ffmpeg не найден. Установите ffmpeg или выполните: pip install --user imageio-ffmpeg (или задайте FFMPEG=/путь/к/ffmpeg)');
}

/** Запуск ffmpeg с аргументами; бросает ошибку при неудаче. */
export function ffmpeg(args, opts = {}) {
  const r = spawnSync(ffmpegPath(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'], ...opts });
  if (r.status !== 0) throw new Error('ffmpeg завершился с ошибкой: ' + args.join(' '));
}

/** Пересохранить PNG как 24-битный RGB (без альфа-канала), опционально с масштабированием/кадрированием. */
export function toRgbPng(src, dst, vf = null) {
  ffmpeg(['-i', src, ...(vf ? ['-vf', vf] : []), '-frames:v', '1', '-pix_fmt', 'rgb24', dst]);
}
