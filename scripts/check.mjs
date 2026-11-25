/**
 * Статическая проверка проекта (build/check).
 *
 * Проверяет:
 *  - наличие всех обязательных страниц и ассетов;
 *  - синтаксис JS (node --check);
 *  - что внутренние ссылки (href/src) в HTML указывают на существующие файлы;
 *  - базовую структуру HTML (doctype, lang="ru", title, viewport, meta description).
 *
 * Запуск: node scripts/check.mjs
 */

import { readFile, readdir, stat, access } from 'node:fs/promises';
import { dirname, join, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PAGES = [
  'index.html',
  'about.html',
  'materials.html',
  'faq.html',
  'contacts.html',
  '404.html'
];

const REQUIRED_FILES = [
  ...PAGES,
  'css/styles.css',
  'js/main.js',
  'server.mjs',
  'package.json'
];

let failures = 0;
let warnings = 0;

function ok(msg) {
  console.log('  \u2713 ' + msg);
}
function fail(msg) {
  failures += 1;
  console.error('  \u2717 ' + msg);
}
function warn(msg) {
  warnings += 1;
  console.warn('  \u26A0 ' + msg);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function collectJsFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      out.push(...(await collectJsFiles(full)));
    } else if (/\.(js|mjs)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function checkJsSyntax() {
  const files = await collectJsFiles(ROOT);
  for (const f of files) {
    try {
      await execFileAsync(process.execPath, ['--check', f]);
      ok(`синтаксис JS: ${relative(ROOT, f)}`);
    } catch (err) {
      fail(`синтаксис JS: ${relative(ROOT, f)} — ${(err.stderr || err.message).trim()}`);
    }
  }
}

async function checkRequiredFiles() {
  for (const f of REQUIRED_FILES) {
    const full = join(ROOT, f);
    if (await exists(full)) {
      ok(`файл присутствует: ${f}`);
    } else {
      fail(`файл отсутствует: ${f}`);
    }
  }
}

async function checkHtmlStructure() {
  for (const page of PAGES) {
    const full = join(ROOT, page);
    if (!(await exists(full))) continue;
    const html = await readFile(full, 'utf8');
    const checks = [
      ['doctype', /<!doctype html>/i.test(html)],
      ['lang="ru"', /<html[^>]*\blang=["']ru["']/i.test(html)],
      ['</html>', /<\/html>\s*$/i.test(html)],
      ['<title>', /<title>[^<]+<\/title>/i.test(html)],
      ['viewport', /<meta[^>]*name=["']viewport["']/i.test(html)],
      ['meta description', /<meta[^>]*name=["']description["']/i.test(html)]
    ];
    const failed = checks.filter(([, pass]) => !pass).map(([name]) => name);
    if (failed.length === 0) {
      ok(`структура HTML: ${page}`);
    } else {
      fail(`структура HTML: ${page} — не хватает: ${failed.join(', ')}`);
    }
  }
}

async function checkInternalLinks() {
  for (const page of PAGES) {
    const full = join(ROOT, page);
    if (!(await exists(full))) continue;
    const html = await readFile(full, 'utf8');
    const base = dirname(full);
    const refs = [];
    const hrefRe = /(?:href|src)=["']([^"']+)["']/g;
    let m;
    while ((m = hrefRe.exec(html)) !== null) {
      refs.push(m[1]);
    }
    let broken = 0;
    for (const raw of refs) {
      if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(raw)) continue;
      const pathname = raw.split('#')[0].split('?')[0];
      if (!pathname) continue;
      const target = resolve(base, pathname);
      if (!(await exists(target))) {
        fail(`битая ссылка в ${page}: ${raw}`);
        broken += 1;
      }
    }
    if (broken === 0) {
      ok(`внутренние ссылки: ${page}`);
    }
  }
}

async function checkAssets() {
  const assetsDir = join(ROOT, 'assets');
  if (!(await exists(assetsDir))) {
    warn('папка assets/ отсутствует (допустимо, если весь визуал в CSS/SVG inline)');
    return;
  }
  const files = await readdir(assetsDir);
  if (files.length === 0) {
    warn('папка assets/ пуста');
    return;
  }
  ok(`ассеты: ${files.length} файл(ов) в assets/`);
}

console.log('Проверка проекта «Беспилотная авиация» (демо-превью)\n');
await checkRequiredFiles();
console.log('');
await checkHtmlStructure();
console.log('');
await checkInternalLinks();
console.log('');
await checkJsSyntax();
console.log('');
await checkAssets();

console.log('');
if (failures === 0) {
  console.log(`РЕЗУЛЬТАТ: OK (предупреждений: ${warnings})`);
  process.exit(0);
} else {
  console.error(`РЕЗУЛЬТАТ: ОШИБОК ${failures}, предупреждений ${warnings}`);
  process.exit(1);
}
