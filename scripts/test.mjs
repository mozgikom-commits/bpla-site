/**
 * Интеграционный тест: запускает локальный сервер на свободном порту и
 * проверяет HTTP-коды для всех основных маршрутов + 404.
 *
 * Запуск: node scripts/test.mjs
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const ROUTES = [
  { path: '/', expect: 200 },
  { path: '/index.html', expect: 200 },
  { path: '/about', expect: 200 },
  { path: '/materials', expect: 200 },
  { path: '/faq', expect: 200 },
  { path: '/contacts', expect: 200 },
  { path: '/css/styles.css', expect: 200 },
  { path: '/js/main.js', expect: 200 },
  { path: '/assets/favicon.svg', expect: 200 },
  { path: '/does-not-exist', expect: 404 }
];

async function fetchCode(base, path) {
  const res = await fetch(base + path, { redirect: 'manual' });
  return res.status;
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((res, rej) => {
    const tick = async () => {
      try {
        const r = await fetch(url);
        if (r.ok || r.status === 404) return res();
      } catch {
        /* ещё не поднялся */
      }
      if (Date.now() - start > timeoutMs) return rej(new Error('Сервер не поднялся за ' + timeoutMs + ' мс'));
      setTimeout(tick, 150);
    };
    tick();
  });
}

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: ROOT,
  env: { ...process.env, PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let port = null;
let output = '';

child.stdout.on('data', (d) => {
  output += d.toString();
  const m = output.match(/127\.0\.0\.1:(\d+)/);
  if (m && !port) port = Number(m[1]);
});

child.stderr.on('data', (d) => {
  output += d.toString();
});

try {
  // Дождёмся, пока в stdout появится порт.
  const start = Date.now();
  while (!port && Date.now() - start < 15000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!port) throw new Error('Не удалось определить порт сервера. Вывод:\n' + output);

  const base = `http://127.0.0.1:${port}`;
  await waitForServer(base + '/');

  console.log('Интеграционный тест маршрутов\n');
  let failures = 0;
  for (const r of ROUTES) {
    const code = await fetchCode(base, r.path);
    const pass = code === r.expect;
    if (pass) {
      console.log(`  \u2713 ${r.path} -> ${code}`);
    } else {
      failures += 1;
      console.error(`  \u2717 ${r.path} -> ${code} (ожидалось ${r.expect})`);
    }
  }

  console.log('');
  if (failures === 0) {
    console.log('РЕЗУЛЬТАТ: OK — все маршруты отвечают корректно.');
  } else {
    console.error(`РЕЗУЛЬТАТ: ОШИБОК ${failures}.`);
  }
  process.exitCode = failures === 0 ? 0 : 1;
} catch (err) {
  console.error('Ошибка теста:', err.message);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
