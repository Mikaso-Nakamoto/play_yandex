// Запуск headless Chrome/Chromium для автотестов, промо-скриншотов и видео.
// Где ищется браузер:
//   1) переменная окружения CHROME_PATH (путь к chrome / chromium / msedge);
//   2) установленный Google Chrome, Chromium или Edge в стандартных местах (Linux, macOS, Windows);
//   3) @sparticuz/chromium из TOOLS_NODE_MODULES (по умолчанию /tmp/hc/node_modules) — для серверов без браузера.
// puppeteer-core берётся из node_modules проекта (ставится через npm install), иначе из TOOLS_NODE_MODULES.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const NM = process.env.TOOLS_NODE_MODULES || '/tmp/hc/node_modules';
const SYSTEM_BROWSERS = [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/snap/bin/chromium', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const COMMON_ARGS = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu'];

const importFile = async (p) => (await import(pathToFileURL(p).href)).default;

async function loadPuppeteer() {
  try {
    return (await import('puppeteer-core')).default;
  } catch {
    const p = path.join(NM, 'puppeteer-core/lib/puppeteer/puppeteer-core.js');
    if (!fs.existsSync(p)) throw new Error('Не найден puppeteer-core: выполните npm install');
    return importFile(p);
  }
}

export async function launch() {
  const puppeteer = await loadPuppeteer();
  const exe = process.env.CHROME_PATH || SYSTEM_BROWSERS.find((p) => fs.existsSync(p));
  if (exe) {
    return puppeteer.launch({
      executablePath: exe, headless: true, defaultViewport: null,
      args: COMMON_ARGS.concat(['--mute-audio', '--hide-scrollbars']),
    });
  }
  const sparticuz = path.join(NM, '@sparticuz/chromium/build/index.js');
  if (!fs.existsSync(sparticuz)) {
    throw new Error('Не найден Chrome/Chromium. Установите Google Chrome или укажите путь: CHROME_PATH=/путь/к/chrome');
  }
  // Серверный Chromium без системных библиотек (песочница сборки)
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', '/tmp', process.env.LD_LIBRARY_PATH || ''].join(':');
  process.env.FONTCONFIG_PATH = process.env.FONTCONFIG_PATH || '/tmp/fonts';
  const chromium = await importFile(sparticuz);
  const executablePath = await chromium.executablePath();
  const drop = ['--single-process', '--use-gl', '--use-angle', '--enable-unsafe-swiftshader', '--in-process-gpu', '--ignore-gpu-blocklist'];
  const args = chromium.args.filter((a) => !drop.some((d) => a.startsWith(d)))
    .concat(COMMON_ARGS, ['--disable-accelerated-2d-canvas', '--disable-gpu-compositing']);
  return puppeteer.launch({ executablePath, args, headless: true, defaultViewport: null });
}
