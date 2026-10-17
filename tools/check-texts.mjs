// Проверка текстов черновика (promo/texts/<lang>.md) на ограничения консоли Яндекс Игр.
//   node tools/check-texts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setLang, t } from '../src/core/i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'promo/texts');
let failed = 0;
const fail = (lang, field, msg) => { failed++; console.log(`  ✗ ${lang} · ${field}: ${msg}`); };

function parse(md) {
  const out = {};
  const re = /^## ([^\n(]+?)\s*(?:\([^\n]*\))?\n```text\n([\s\S]*?)\n```/gm;
  let m;
  while ((m = re.exec(md))) out[m[1].trim()] = m[2];
  return out;
}

const RULES = {
  'Название': { min: 1, max: 50 },
  'Описание для SEO': { min: 50, max: 160 },
  'Короткое описание': { min: 1, max: 70 },
  'Об игре': { min: 100, max: 1000 },
  'Как играть': { min: 100, max: 1000 },
  'Ключевые слова': { min: 1, max: 100 },
};

for (const file of fs.readdirSync(dir).filter((f) => /^[a-z]{2}\.md$/.test(f)).sort()) {
  const lang = file.slice(0, 2);
  const f = parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  setLang(lang);
  const title = t('title');
  for (const [name, r] of Object.entries(RULES)) {
    const s = f[name];
    if (s === undefined) { fail(lang, name, 'поле не найдено'); continue; }
    const len = [...s].length;
    if (len < r.min || len > r.max) fail(lang, name, `длина ${len}, нужно ${r.min}–${r.max}`);
    if (/ {2,}|-{3,}|\.{4,}/.test(s)) fail(lang, name, 'повторяющиеся символы');
  }
  const T = f['Название'] || '';
  if (T !== title) fail(lang, 'Название', `не совпадает с названием в игре («${title}»)`);
  if (T && T[0] !== T[0].toLocaleUpperCase(lang)) fail(lang, 'Название', 'должно начинаться с заглавной буквы');
  if (/free|top|best|бесплатн|ücretsiz/i.test(T)) fail(lang, 'Название', 'запрещённые слова');
  if (/игра|game|oyun/i.test(T)) fail(lang, 'Название', 'не рекомендуется слово «игра»/«game»');
  const seo = f['Описание для SEO'] || '';
  if (!/[.!]$/.test(seo)) fail(lang, 'Описание для SEO', 'должно заканчиваться точкой или «!»');
  if (/[(=/\\+_]/.test(seo.slice(1, -1))) fail(lang, 'Описание для SEO', 'спецсимволы (=/\\+_ в середине текста');
  const sh = f['Короткое описание'] || '';
  if (sh.includes(T)) fail(lang, 'Короткое описание', 'дублирует название');
  if (sh && sh[0] !== sh[0].toLocaleUpperCase(lang)) fail(lang, 'Короткое описание', 'должно начинаться с заглавной буквы');
  if (/бесплатн|на русском|free|ücretsiz/i.test(sh)) fail(lang, 'Короткое описание', 'запрещённые слова');
  const kw = f['Ключевые слова'] || '';
  if (kw !== kw.toLocaleLowerCase(lang)) fail(lang, 'Ключевые слова', 'только строчные буквы');
  if (!/^[^,]+(, ?[^,]+)*$/.test(kw)) fail(lang, 'Ключевые слова', 'слова через запятую');
  // Дублирующиеся тексты в разных полях (п. 5.11)
  const vals = Object.entries(f).filter(([k]) => k !== 'Название');
  for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) {
    if (vals[i][1].includes(vals[j][1]) || vals[j][1].includes(vals[i][1])) fail(lang, vals[i][0], `дублирует поле «${vals[j][0]}»`);
  }
  console.log(`  ${lang}: ` + Object.keys(RULES).map((k) => `${k} ${f[k] ? [...f[k]].length : '—'}`).join(' · '));
}
if (failed) { console.log(`Ошибок: ${failed}`); process.exit(1); }
console.log('✓ Тексты черновика соответствуют ограничениям');
