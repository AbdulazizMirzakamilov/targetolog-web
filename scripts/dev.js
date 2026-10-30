// Локальная разработка: пересборка при изменениях + Tailwind watch + сервер на http://localhost:3000
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const run = (args) => spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
const tw = path.join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs');

const buildHtml = () => new Promise((res) => run(['scripts/build.js']).on('exit', res));
await buildHtml();
const cssBuild = () => new Promise((res) => run([tw, '-i', 'src/css/input.css', '-o', 'dist/assets/styles.css']).on('exit', res));
await cssBuild();

// build.js чистит dist, поэтому css пересобираем после каждой пересборки html
let timer;
const rebuild = () => { clearTimeout(timer); timer = setTimeout(async () => { await buildHtml(); await cssBuild(); console.log('Пересобрано'); }, 150); };
for (const dir of ['src', 'public', 'site.config.json']) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, rebuild);
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') { res.writeHead(302, { Location: '/ru/' }); return res.end(); }
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': types['.html'] }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(3000, () => console.log('Открой http://localhost:3000  (Ctrl+C для остановки)'));
