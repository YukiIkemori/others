// tiny static server: node tools/serve.mjs [port]   (serves the monastery-hd2d folder)
//   /play  -> the game assembled from src/page.html + every script in src/core and src/areas (rebuilt on every request)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { devPage } from './pagegen.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/play' || p === '/') { try { res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' }); return res.end(devPage()); } catch (e) { res.writeHead(500); return res.end(String(e.stack)); } }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(d); });
}).listen(port, () => console.log('serving ' + root + ' on http://localhost:' + port));
