#!/usr/bin/env node
// Contact sheets for the tile & backdrop art (art review tool).
//
//   node tools/sheet_tiles.js [--out DIR] [--only a,b,...] [--scale N] [--frame F]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   tiles    every 'tile:<id>' (animated tiles: all frames side by side)
//   themes   every themed tile ('tile:<theme>:<id>') — one row per theme
//   objects  furniture/objects on every theme floor (tile:<theme>:<obj>)
//   world    a sample overworld composed with R.Art.worldTile (autotiling)
//   worldmap the real world map (src/maps) if one is defined, at 1x
//   town     a fake town / castle / cave composed from local tiles
//            (left: R.Art.localTile context tiles, right: plain per-id tiles)
//   bbg      every battle backdrop, with the battle status windows overlaid
// Loads only core + data + art sources (no game boot), so it works while
// other systems are mid-edit.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/tiles'));
const ONLY = (opt('only', 'tiles,themes,objects,world,worldmap,town,bbg')).split(',');
const SCALE = +opt('scale', 3);
const FRAME = +opt('frame', 0);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = [];
  const core = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  list.push(...core);
  for (const d of ['data', 'art', 'maps']) {
    const dir = path.join(ROOT, 'src', d);
    if (!fs.existsSync(dir)) continue;
    list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

// ---------------------------------------------------------------- page code
// Runs in the browser. Everything returns data URLs.
const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#202028'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col) {
    c.font = '10px monospace'; c.fillStyle = col || '#d8d8e0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  const first = (g) => Array.isArray(g) ? g : [g];

  function tiles(scale) {
    const ids = Object.keys(R.DB.tiles);
    const cols = 8, cw = 16 * scale * 4 + 12, ch = 16 * scale + 20;
    const rows = Math.ceil(ids.length / cols);
    const [cv, c] = canvas(cols * cw, rows * ch);
    ids.forEach((id, i) => {
      const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4;
      const fr = first(G.get('tile:' + id));
      fr.forEach((f, k) => c.drawImage(f, x + k * (16 * scale + 2), y, 16 * scale, 16 * scale));
      label(c, id + (fr.length > 1 ? ' x' + fr.length : ''), x, y + 16 * scale + 2);
    });
    return cv.toDataURL();
  }
  function themes(scale, extra) {
    const th = Object.keys(R.DB.themes);
    const ids = extra || R.TILE_THEMED;
    const cw = 16 * scale + 4, lw = 60;
    const [cv, c] = canvas(lw + ids.length * cw * (extra ? 1 : 1.0) + 8, th.length * (cw + 4) + 24);
    ids.forEach((id, k) => label(c, id.slice(0, 9), lw + k * cw, 4));
    th.forEach((t, j) => {
      const y = 18 + j * (cw + 4);
      label(c, t, 4, y + 10);
      ids.forEach((id, k) => {
        const key = G.has('tile:' + t + ':' + id) ? 'tile:' + t + ':' + id : 'tile:' + id;
        const g = first(G.get(key));
        c.drawImage(g[Math.min(g.length - 1, ${FRAME})], lw + k * cw, y, 16 * scale, 16 * scale);
        if (!G.has('tile:' + t + ':' + id)) { c.fillStyle = '#ff0'; c.fillRect(lw + k * cw, y, 3, 3); }
      });
    });
    return cv.toDataURL();
  }
  // tile grid from rows+legend. mode: 'ctx' uses R.Art.worldTile/localTile
  function fakeMap(rows, legendName, theme, isWorld) {
    const legend = R.DB.legends[legendName];
    const h = rows.length, w = rows[0].length;
    const tiles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push(legend[rows[y][x]] || (isWorld ? 'grass' : 'floor'));
    return {
      id: 'sheet', w, h, tiles, theme, isWorld, legendName, outside: isWorld ? 'sea' : 'void', type: isWorld ? 'world' : 'town',
      inBounds(x, y) { return x >= 0 && y >= 0 && x < w && y < h; },
      idx(x, y) { return y * w + x; },
      tileAt(x, y) { return this.inBounds(x, y) ? tiles[y * w + x] : this.outside; },
    };
  }
  function drawMap(m, ctx, scale, frame) {
    const [cv, c] = canvas(m.w * 16, m.h * 16, '#000');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      let g = null;
      if (ctx && m.isWorld && R.Art && R.Art.worldTile) g = R.Art.worldTile(m, x, y);
      else if (ctx && !m.isWorld && R.Art && R.Art.localTile) g = R.Art.localTile(m, x, y);
      if (!g) {
        const id = m.tileAt(x, y);
        if (id === 'void') continue;
        g = m.theme && G.has('tile:' + m.theme + ':' + id) ? G.get('tile:' + m.theme + ':' + id) : G.get('tile:' + id);
      }
      if (Array.isArray(g)) g = g[frame % g.length];
      c.drawImage(g, x * 16, y * 16);
    }
    if (scale === 1) return cv;
    const [out, oc] = canvas(m.w * 16 * scale, m.h * 16 * scale, '#000');
    oc.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }
  function mapSheet(list, scale, frame, both) {
    const parts = list.map((d) => {
      const m = fakeMap(d.rows, d.legend, d.theme, d.legend === 'world');
      const a = drawMap(m, true, scale, frame);
      const b = both ? drawMap(m, false, scale, frame) : null;
      return { a, b, name: d.name };
    });
    const W = Math.max(...parts.map((p) => p.a.width + (p.b ? p.b.width + 12 : 0))) + 8;
    const H = parts.reduce((s, p) => s + p.a.height + 18, 4);
    const [cv, c] = canvas(W, H);
    let y = 4;
    for (const p of parts) {
      label(c, p.name, 4, y); y += 14;
      c.drawImage(p.a, 4, y);
      if (p.b) c.drawImage(p.b, 16 + p.a.width, y);
      y += p.a.height + 4;
    }
    return cv.toDataURL();
  }
  function worldmap(frame) {
    const def = R.DB.maps.world;
    if (!def) return null;
    const m = fakeMap(def.rows, 'world', null, true);
    const marks = def.marks || {};
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const ch = def.rows[y][x], mk = marks[ch];
      if (mk) m.tiles[y * m.w + x] = R.DB.legends.world[mk.under != null ? mk.under : '.'] || 'grass';
    }
    return drawMap(m, true, 1, frame).toDataURL();
  }
  function bbg(scale) {
    const ids = ['grass', 'forest', 'hills', 'desert', 'snow', 'swamp', 'wasteland', 'sea', 'cave', 'fort',
      'watercave', 'pyramid', 'ice', 'volcano', 'tower', 'shrine', 'castle', 'demon', 'throne'];
    const cols = 3, cw = 256 * scale + 8, ch = 144 * scale + 22;
    const [cv, c] = canvas(cols * cw, Math.ceil(ids.length / cols) * ch);
    ids.forEach((id, i) => {
      const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4;
      let g = G.get('bbg:' + id);
      if (Array.isArray(g)) g = g[0];
      c.drawImage(g, x, y, 256 * scale, 144 * scale);
      // battle UI overlay: status windows (y 6..50) and ground line
      c.globalAlpha = 0.85; c.fillStyle = '#000';
      for (const wx of [6, 88, 170]) c.fillRect(x + wx * scale, y + 6 * scale, 80 * scale, 44 * scale);
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,0,0,0.6)'; c.fillRect(x, y + 130 * scale, 4 * scale, scale);
      label(c, id, x, y + 144 * scale + 4);
    });
    return cv.toDataURL();
  }
  return { tiles, themes, mapSheet, worldmap, bbg };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
<script src="file://${path.join(__dirname, 'fixtures/tiles/samples.js')}"></script>
</body></html>`;
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const page_file = path.join(OUT, '_sheet.html');
  fs.writeFileSync(page_file, html);

  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + page_file);
  await page.waitForTimeout(300);
  const save = (name, url) => {
    if (!url) { console.log('(skipped ' + name + ')'); return; }
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('sheet →', f);
  };
  const t0 = Date.now();
  const run = (js) => page.evaluate(js);
  if (ONLY.includes('tiles')) save('tiles', await run(`SHEET.tiles(${SCALE})`));
  if (ONLY.includes('themes')) save('themes', await run(`SHEET.themes(${SCALE})`));
  if (ONLY.includes('objects')) save('objects', await run(`SHEET.themes(${Math.max(2, SCALE - 1)}, window.SAMPLES.objects)`));
  if (ONLY.includes('world')) save('world', await run(`SHEET.mapSheet(window.SAMPLES.world, ${Math.max(1, SCALE - 1)}, ${FRAME}, false)`));
  if (ONLY.includes('worldmap')) save('worldmap', await run(`SHEET.worldmap(${FRAME})`));
  if (ONLY.includes('town')) save('town', await run(`SHEET.mapSheet(window.SAMPLES.town, ${Math.max(1, SCALE - 1)}, ${FRAME}, true)`));
  if (ONLY.includes('bbg')) save('bbg', await run(`SHEET.bbg(${Math.max(1, SCALE - 1)})`));
  const stats = await run(`(() => { const G = RPG.Gfx; return { defs: Object.keys(G._defs).length, cached: Object.keys(G._cache).length, warned: Object.keys(G._warned) }; })()`);
  console.log('gfx defs', stats.defs, 'built', stats.cached, 'missing', stats.warned.join(' ') || '-', 'in', Date.now() - t0, 'ms');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
