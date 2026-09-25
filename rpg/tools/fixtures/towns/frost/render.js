#!/usr/bin/env node
// Whole-map render of town maps with the decor layer, chests and NPCs
// (review tool for the フロスト redesign; loads src/ directly, no build needed).
//
//   node tools/fixtures/towns/regnas/render.js --maps regnas_castle,regnas_town [--out DIR]
//        [--scale 2] [--grid] [--frame F] [--flags a,b] [--rect x,y,w,h]
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '../../../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/frost/render'));
const MAPS = opt('maps', 'frost_village,frost_house_elder,frost_house').split(',');
const SCALE = +opt('scale', 2);
const GRID = args.includes('--grid');
const FRAME = +opt('frame', 0);
const FLAGS = (opt('flags', '') || '').split(',').filter(Boolean);
const RECT = opt('rect', null);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [];
  for (const d of ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems']) {
    const dir = path.join(ROOT, 'src', d);
    if (!fs.existsSync(dir)) continue;
    let list = walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b));
    if (d === 'core') list = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'].map((f) => path.join(dir, f)).concat(list.filter((f) => !/\/(ns|input|gfx|engine|save)\.js$/.test(f)));
    files.push(...list);
  }
  const page = `
window.RENDER = function (id, flags, frame, scale, grid, rect) {
  const R = window.RPG, G = R.Gfx, A = R.Art;
  R.State.newGame();
  for (const f of flags) R.Game.flags[f] = true;
  const m = R.FieldMap.compile(id);
  const cv = document.createElement('canvas'); cv.width = m.w * 16; cv.height = m.h * 16;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const pick = (g) => Array.isArray(g) ? g[frame % g.length] : g;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    let g = A && A.localTile ? A.localTile(m, x, y) : null;
    if (!g) { const t = m.tileAt(x, y); if (t === 'void') continue; g = m.theme && G.has('tile:' + m.theme + ':' + t) ? G.get('tile:' + m.theme + ':' + t) : G.get('tile:' + t); }
    g = pick(g); if (g) c.drawImage(g, x * 16, y * 16);
  }
  if (m.decor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const id2 = m.decorAt(x, y); if (!id2) continue;
    let g = (A.decorTile && A.decorTile(m, x, y)) || G.get('decor:' + id2);
    g = pick(g); if (g) c.drawImage(g, x * 16 + ((16 - g.width) >> 1), y * 16 + 16 - g.height);
  }
  const chest = G.get('obj:chest');
  for (const ch of m.chests) if (ch.present) c.drawImage(Array.isArray(chest) ? chest[0] : chest, ch.x * 16, ch.y * 16);
  const list = m.npcs.filter((n) => n.present).sort((a, b) => a.y - b.y);
  for (const n of list) {
    let s = G.get(n.sprite);
    if (s && !s.getContext && !Array.isArray(s)) s = s[n.dir] || s.down;
    s = Array.isArray(s) ? s[0] : s;
    if (s) c.drawImage(s, n.x * 16 + 8 - (s.width >> 1), n.y * 16 + 16 - s.height);
    if (n.move === 'wander') { c.fillStyle = '#ff0'; c.fillRect(n.x * 16 + 13, n.y * 16 + 1, 2, 2); }
  }
  const box = (x, y, col) => { c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(x * 16 + 1.5, y * 16 + 1.5, 13, 13); };
  for (const w of m.warps) box(w.x, w.y, '#40f0ff');
  for (const k in m.spawns) box(m.spawns[k].x, m.spawns[k].y, '#40ff60');
  for (const s of m.signs || []) box(s.x, s.y, '#ff9040');
  let sx = 0, sy = 0, sw = m.w, sh = m.h;
  if (rect) { [sx, sy, sw, sh] = rect.split(',').map(Number); }
  const out = document.createElement('canvas'); out.width = sw * 16 * scale; out.height = sh * 16 * scale;
  const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
  o.drawImage(cv, sx * 16, sy * 16, sw * 16, sh * 16, 0, 0, out.width, out.height);
  if (grid) {
    o.font = (5 * scale) + 'px monospace'; o.fillStyle = 'rgba(255,255,255,0.9)';
    o.strokeStyle = 'rgba(255,255,255,0.15)';
    for (let x = 0; x <= sw; x++) { o.beginPath(); o.moveTo(x * 16 * scale + 0.5, 0); o.lineTo(x * 16 * scale + 0.5, out.height); o.stroke(); }
    for (let y = 0; y <= sh; y++) { o.beginPath(); o.moveTo(0, y * 16 * scale + 0.5); o.lineTo(out.width, y * 16 * scale + 0.5); o.stroke(); }
    for (let x = 0; x < sw; x++) o.fillText(String(sx + x), x * 16 * scale + 2, 6 * scale);
    for (let y = 0; y < sh; y++) o.fillText(String(sy + y), 2, y * 16 * scale + 12 * scale);
  }
  return out.toDataURL();
};`;
  fs.writeFileSync(path.join(OUT, '_page.js'), page);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${files.filter((f) => !f.endsWith('main.js')).map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_page.js')}"></script></body></html>`;
  fs.writeFileSync(path.join(OUT, '_page.html'), html);
  const browser = await playwright.chromium.launch();
  const pg = await (await browser.newContext()).newPage();
  pg.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).split('\n')[0]));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
  await pg.goto('file://' + path.join(OUT, '_page.html'));
  await pg.waitForTimeout(300);
  for (const id of MAPS) {
    const url = await pg.evaluate(([i, f, fr, sc, gr, rc]) => window.RENDER(i, f, fr, sc, gr, rc), [id, FLAGS, FRAME, SCALE, GRID, RECT]);
    const f = path.join(OUT, id + (RECT ? '_' + RECT.replace(/,/g, '-') : '') + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('png →', f);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(2); });
