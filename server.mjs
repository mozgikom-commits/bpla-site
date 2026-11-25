/**
 * Локальный статический HTTP-сервер для демо-сайта БПЛА.
 *
 * Запуск:  node server.mjs           (порт по умолчанию 4173, автоподбор свободного)
 *          PORT=8080 node server.mjs (явный порт)
 *
 * Отдаёт статические файлы из корня проекта и поддерживает «чистые» маршруты
 * без расширения .html (например, /about -> about.html). Неизвестные маршруты
 * возвращают кастомную страницу 404 с корректным HTTP-кодом 404.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

/** «Чистые» маршруты страниц без расширения. */
const ROUTES = new Map([
  ['/', 'index.html'],
  ['/index', 'index.html'],
  ['/about', 'about.html'],
  ['/materials', 'materials.html'],
  ['/faq', 'faq.html'],
  ['/contacts', 'contacts.html']
]);

function resolveSafePath(urlPath) {
  let pathname = urlPath;
  const queryIndex = pathname.indexOf('?');
  if (queryIndex !== -1) pathname = pathname.slice(0, queryIndex);

  pathname = decodeURIComponent(pathname);

  // Защита от path traversal: результирующий путь обязан оставаться внутри ROOT.
  let filePath = normalize(join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + '/')) {
    filePath = join(ROOT, '404.html');
  }
  return filePath;
}

async function fileExists(path) {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function serveFile(res, filePath, statusCode = 200) {
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    res.writeHead(statusCode, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Ошибка чтения файла: ' + err.message);
  }
}

export async function handleRequest(req, res) {
  const url = req.url || '/';
  let pathname = url;
  const q = pathname.indexOf('?');
  if (q !== -1) pathname = pathname.slice(0, q);

  // Чистый маршрут.
  if (ROUTES.has(pathname)) {
    return serveFile(res, join(ROOT, ROUTES.get(pathname)));
  }

  let filePath = resolveSafePath(pathname);

  // Если запрошен файл — отдаём его.
  if (extname(filePath)) {
    if (await fileExists(filePath)) {
      return serveFile(res, filePath);
    }
    return serveFile(res, join(ROOT, '404.html'), 404);
  }

  // Служебный корень: каталог -> index.html.
  if (pathname.endsWith('/')) {
    const indexFile = join(filePath, 'index.html');
    if (await fileExists(indexFile)) {
      return serveFile(res, indexFile);
    }
    return serveFile(res, join(ROOT, '404.html'), 404);
  }

  // Возможная страница без расширения.
  const candidate = join(ROOT, pathname + '.html');
  if (await fileExists(candidate)) {
    return serveFile(res, candidate);
  }

  return serveFile(res, join(ROOT, '404.html'), 404);
}

function findFreePort(start) {
  return new Promise((resolvePort) => {
    const net = createServer();
    net.once('error', () => {
      resolvePort(findFreePort(start + 1));
    });
    net.listen(start, () => {
      const { port } = net.address();
      net.close(() => resolvePort(port));
    });
  });
}

export async function startServer(port) {
  const preferred =
    port !== undefined
      ? Number(port)
      : process.env.PORT !== undefined
        ? Number(process.env.PORT)
        : 4173;
  const actualPort = await findFreePort(preferred);
  const server = createServer(handleRequest);
  return new Promise((resolveServer) => {
    server.listen(actualPort, () => {
      resolveServer({ server, port: actualPort });
    });
  });
}

// Запуск только при прямом вызове (node server.mjs), не при импорте.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { server, port } = await startServer();
  console.log('');
  console.log('  Локальный предпросмотр «Беспилотная авиация» запущен.');
  console.log(`  → http://127.0.0.1:${port}/`);
  console.log('  Остановить: Ctrl+C');
  console.log('');
}
