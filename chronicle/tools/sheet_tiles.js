#!/usr/bin/env node
// Contact sheets for the tile & backdrop art (art review tool). Owner: A16a.
//
//   node tools/sheet_tiles.js [--out DIR] [--only a,b,...] [--scale N] [--frame F]
//                             [--samples FILE] [--crop x,y,w,h] [--ids a,b]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   tiles    every 'tile:<id>' (animated tiles: all frames side by side)
//   world    sample overworlds composed with R.Art.worldTile, with people
//            (party:/npc:) standing on them to check they read against the ground
//   anim     the animated world sample (sea fog, sandstorm, marsh fog, rivers),
//            8 consecutive field frames (one per 16 game frames)
//   zoom     one world sample (--sample N) cropped with --crop x,y,w,h at --scale
//   icons    every location icon at 4x on grass / desert / snow / marsh
//   worldmap the real world map (src/maps) if one is defined, at 1x
//            (--crop x,y,w,h in cells renders that part at --scale; --state
//            start|tier4|final|raw picks which tilePatches apply, default start)
//   themes   every themed tile ('tile:<theme>:<id>') — one row per theme
//   objects  furniture/objects on every theme floor (tile:<theme>:<obj>)
//   town     a fake town / castle / cave composed from local tiles
//            (left: R.Art.localTile context tiles, right: plain per-id tiles)
//   bbg      every battle backdrop with the battle layout of §11.5.1 over it
//            (4 status windows y5–51, WIN_BOTTOM 56, GROUND 130, help 133,
//            command box 150) and a few monsters standing on the ground line
//            (--cols N, --plain: backdrop and monsters only, no UI)
// Loads only core + data + art + maps sources (no game boot) and runs the data
// hooks (src/data/tiles_world.js applies the world legend there), so it works
// while other systems are mid-edit. Samples: tools/fixtures/art-world/samples.js
// (+ tools/fixtures/art-local/samples.js for towns when that file exists).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/tiles'));
const ONLY = (opt('only', 'tiles,world,anim,icons,worldmap,themes,objects,town,bbg')).split(',');
const SCALE = +opt('scale', 3);
const FRAME = +opt('frame', 0);
const CROP = opt('crop', '');
const IDS = opt('ids', '');
const SAMPLES = [path.resolve(opt('samples', path.join(__dirname, 'fixtures/art-world/samples.js')))];
const LOCAL_SAMPLES = path.join(__dirname, 'fixtures/art-local/samples.js');
if (fs.existsSync(LOCAL_SAMPLES)) SAMPLES.push(LOCAL_SAMPLES);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = [];
  list.push(...['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f)));
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
  const frameOf = (g, f) => Array.isArray(g) ? g[f % g.length] : g;

  function tiles(scale, ids) {
    ids = ids || Object.keys(R.DB.tiles);
    const cols = 6, cw = 16 * scale * 4 + 24, ch = 16 * scale + 20;
    const rows = Math.ceil(ids.length / cols);
    const [cv, c] = canvas(cols * cw, rows * ch);
    ids.forEach((id, i) => {
      const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4;
      const fr = first(G.get('tile:' + id));
      const n = Math.min(fr.length, 4);
      for (let k = 0; k < n; k++) c.drawImage(fr[Math.round(k * fr.length / n)], x + k * (16 * scale + 2), y, 16 * scale, 16 * scale);
      label(c, id + (fr.length > 1 ? ' x' + fr.length : ''), x, y + 16 * scale + 2);
    });
    return cv.toDataURL();
  }
  function themes(scale, extra) {
    const th = Object.keys(R.DB.themes);
    const ids = extra || R.TILE_THEMED;
    const cw = 16 * scale + 4, lw = 60;
    const [cv, c] = canvas(lw + ids.length * cw + 8, th.length * (cw + 4) + 24);
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
  // tile grid from rows+legend
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
  function drawMap(m, ctx, scale, frame, crop) {
    const [x0, y0, cw, chh] = crop || [0, 0, m.w, m.h];
    const [cv, c] = canvas(cw * 16, chh * 16, '#000');
    for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) {
      let g = null;
      if (ctx && m.isWorld && R.Art && R.Art.worldTile) g = R.Art.worldTile(m, x, y);
      else if (ctx && !m.isWorld && R.Art && R.Art.localTile) g = R.Art.localTile(m, x, y);
      if (!g) {
        const id = m.tileAt(x, y);
        if (id === 'void') continue;
        g = m.theme && G.has('tile:' + m.theme + ':' + id) ? G.get('tile:' + m.theme + ':' + id) : G.get('tile:' + id);
      }
      c.drawImage(frameOf(g, frame), (x - x0) * 16, (y - y0) * 16);
    }
    if (scale === 1) return cv;
    const [out, oc] = canvas(cv.width * scale, cv.height * scale, '#000');
    oc.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }
  /** people standing on world cells: [[x, y, key]] (field draws 16x24 sprites feet on the cell bottom) */
  function actors(c, list, scale, x0, y0) {
    for (const [x, y, key] of list || []) {
      if (!G.has(key)) continue;
      let g = G.get(key);
      if (g && g.down) g = g.down[0];
      g = first(g)[0];
      if (!g) continue;
      const sh = G.has('obj:shadow') ? first(G.get('obj:shadow'))[0] : null;
      const px = ((x - x0) * 16 + 8 - g.width / 2) * scale, py = ((y - y0) * 16 + 16 - g.height) * scale;
      if (sh) c.drawImage(sh, ((x - x0) * 16 + 8 - sh.width / 2) * scale, ((y - y0) * 16 + 13) * scale, sh.width * scale, sh.height * scale);
      c.drawImage(g, px, py - 2 * scale, g.width * scale, g.height * scale);
    }
  }
  function mapSheet(list, scale, frame, both) {
    const parts = list.map((d) => {
      const m = fakeMap(d.rows, d.legend, d.theme, d.legend === 'world');
      const a = drawMap(m, true, scale, frame);
      if (d.actors) actors(a.getContext('2d'), d.actors, scale, 0, 0);
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
  /** 8 consecutive field frames of a crop of the animated sample */
  function anim(list, scale) {
    const d = list.find((q) => q.anim) || list[0];
    const m = fakeMap(d.rows, 'world', null, true);
    const crop = d.anim || [0, 0, Math.min(m.w, 14), Math.min(m.h, 10)];
    const frames = [];
    for (let f = 0; f < 8; f++) frames.push(drawMap(m, true, scale, f, crop));
    const fw = frames[0].width, fh = frames[0].height;
    const [cv, c] = canvas(fw * 4 + 5 * 6, fh * 2 + 3 * 18);
    frames.forEach((fr, f) => {
      const x = 6 + (f % 4) * (fw + 6), y = 16 + Math.floor(f / 4) * (fh + 18);
      label(c, 'frame ' + f + ' (t=' + f * 16 + ')', x, y - 12);
      c.drawImage(fr, x, y);
    });
    return cv.toDataURL();
  }
  /** one sample (index) cropped [x,y,w,h] at a big scale, with its actors */
  function zoom(list, idx, crop, scale) {
    const d = list[idx || 0];
    const m = fakeMap(d.rows, 'world', null, true);
    crop = crop || [0, 0, m.w, m.h];
    const a = drawMap(m, true, scale, ${FRAME}, crop);
    if (d.actors) actors(a.getContext('2d'), d.actors, scale, crop[0], crop[1]);
    return a.toDataURL();
  }
  function icons(scale) {
    const ids = Object.keys(R.DB.tiles).filter((id) => id.startsWith('loc_'));
    const grounds = ['grass', 'desert', 'snow', 'marsh'];
    const cell = 16 * 3;
    const [cv, c] = canvas(ids.length * (cell * scale / 1 + 8) / 1 + 8, grounds.length * (cell * scale + 20) + 8);
    grounds.forEach((gnd, j) => {
      ids.forEach((id, i) => {
        const rows = [gnd + gnd + gnd, gnd + id + gnd, gnd + gnd + gnd];
        const m = { id: 'icons', w: 3, h: 3, isWorld: true, outside: gnd, tileAt(x, y) { return x === 1 && y === 1 ? id : gnd; } };
        const a = drawMap(Object.assign(m, { inBounds: () => true }), true, scale, 0, [0, 0, 3, 3]);
        const x = 4 + i * (cell * scale + 8), y = 4 + j * (cell * scale + 20);
        c.drawImage(a, x, y);
        if (j === grounds.length - 1) label(c, id.slice(4), x, y + cell * scale + 3);
      });
    });
    return cv.toDataURL();
  }
  // world states for the preview: which tilePatches apply (§10.5.6)
  const STATES = {
    raw: null,
    start: { flags: { prologue_done: true }, tier: 0, cleared: [] },
    tier4: { flags: { prologue_done: true }, tier: 4, cleared: ['r_forest', 'r_desert', 'r_snow', 'r_marsh'] },
    final: { flags: { prologue_done: true, final_open: true }, tier: 8, cleared: ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'] },
  };
  function condOk(c, st) {
    if (c == null) return true;
    if (Array.isArray(c)) return c.every((q) => condOk(q, st));
    if (typeof c === 'string') return c[0] === '!' ? !st.flags[c.slice(1)] : !!st.flags[c];
    if (c.tier != null) return st.tier >= c.tier;
    if (c.cleared) return st.cleared.includes(c.cleared);
    if (c.notCleared) return !st.cleared.includes(c.notCleared);
    if (c.flag) return !!st.flags[c.flag];
    return true;
  }
  function worldmap(frame, crop, scale, state) {
    const def = R.DB.maps.world;
    if (!def) return null;
    const m = fakeMap(def.rows, 'world', null, true);
    m.id = 'world';
    const marks = def.marks || {};
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const ch = def.rows[y][x], mk = marks[ch];
      if (mk) m.tiles[y * m.w + x] = R.DB.legends.world[mk.under != null ? mk.under : '.'] || 'grass';
    }
    const st = STATES[state || 'start'];
    if (st) for (const p of def.tilePatches || []) {
      if (!condOk(p.cond, st) || p.x < 0 || p.y < 0 || p.x >= m.w || p.y >= m.h) continue;
      const tid = R.DB.tiles[p.tile] ? p.tile : R.DB.legends.world[p.tile];
      if (tid) m.tiles[p.y * m.w + p.x] = tid;
    }
    if (def.wrap !== false) { m.tileAt = function (x, y) { x = ((x % this.w) + this.w) % this.w; y = ((y % this.h) + this.h) % this.h; return this.tiles[y * this.w + x]; }; m.wrap = true; }
    return drawMap(m, true, crop ? scale : 1, frame, crop).toDataURL();
  }
  // battle layout (§11.5.1 / §11.11.3)
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, WIN_BOTTOM = 56, GROUND = 130;
  function bbg(scale, only, cols, plain) {
    const ids = only || (R.Art.BBG_IDS || []);
    const mons = ['mon:goblin', 'mon:wolf', 'mon:skeleton', 'mon:jelly'].filter((k) => G.has(k));
    cols = cols || 3;
    const cw = 256 * scale + 8, ch = (plain ? 144 : 224) * scale + 22;
    const [cv, c] = canvas(cols * cw, Math.ceil(ids.length / cols) * ch);
    ids.forEach((id, i) => {
      const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4;
      c.fillStyle = '#000'; c.fillRect(x, y, 256 * scale, 224 * scale);
      const g = frameOf(G.get('bbg:' + id), 0);
      c.drawImage(g, x, y, 256 * scale, 144 * scale);
      // monsters on the ground line
      let mx = 128 - mons.reduce((s, k) => s + first(G.get(k))[0].width + 6, -6) / 2;
      for (const k of mons) {
        const im = first(G.get(k))[0];
        c.drawImage(im, x + mx * scale, y + (GROUND - im.height) * scale, im.width * scale, im.height * scale);
        mx += im.width + 6;
      }
      if (plain) { label(c, id, x, y + 144 * scale + 4); return; }
      // status windows (ink theme) and their bottom tags
      for (const wx of WIN.xs) {
        c.globalAlpha = 0.97; c.fillStyle = '#16203e'; c.fillRect(x + wx * scale, y + WIN.y * scale, WIN.w * scale, WIN.h * scale);
        c.globalAlpha = 1; c.strokeStyle = '#f0e8d0'; c.lineWidth = scale; c.strokeRect(x + (wx + 1) * scale, y + (WIN.y + 1) * scale, (WIN.w - 2) * scale, (WIN.h - 2) * scale);
        c.fillStyle = '#0b1024'; c.fillRect(x + (wx + 4) * scale, y + (WIN.y + 39) * scale, 15 * scale, 8 * scale);
      }
      c.fillStyle = 'rgba(255,255,0,0.5)'; c.fillRect(x, y + WIN_BOTTOM * scale, 256 * scale, 1);
      c.fillStyle = 'rgba(255,0,0,0.7)'; c.fillRect(x, y + GROUND * scale, 6 * scale, scale); c.fillRect(x + 250 * scale, y + GROUND * scale, 6 * scale, scale);
      // help band and command box
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.strokeRect(x + 8 * scale, y + 133 * scale, 240 * scale, 19 * scale);
      c.globalAlpha = 0.97; c.fillStyle = '#16203e'; c.fillRect(x + 8 * scale, y + 150 * scale, 240 * scale, 68 * scale); c.globalAlpha = 1;
      label(c, id + (R.Art.BBG_FALLBACK && R.Art.BBG_FALLBACK[id] ? '  (fallback ' + R.Art.BBG_FALLBACK[id] + ')' : ''), x + 12 * scale, y + 156 * scale, '#f0e8d0');
    });
    return cv.toDataURL();
  }
  return { tiles, themes, mapSheet, anim, zoom, icons, worldmap, bbg };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script>window.RPG && RPG.runDataHooks && RPG.runDataHooks();</script>
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
${SAMPLES.map((f) => `<script src="file://${f}"></script>`).join('\n')}
</body></html>`;
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const page_file = path.join(OUT, '_sheet.html');
  fs.writeFileSync(page_file, html);

  const browser = await playwright.chromium.launch();
  try {
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
    const ids = IDS ? JSON.stringify(IDS.split(',')) : 'null';
    const crop = CROP ? JSON.stringify(CROP.split(',').map(Number)) : 'null';
    if (ONLY.includes('tiles')) save('tiles', await run(`SHEET.tiles(${SCALE}, ${ids})`));
    if (ONLY.includes('world')) save('world', await run(`SHEET.mapSheet(window.SAMPLES.world, ${Math.max(1, SCALE - 1)}, ${FRAME}, false)`));
    if (ONLY.includes('anim')) save('anim', await run(`SHEET.anim(window.SAMPLES.world, ${Math.max(1, SCALE - 1)})`));
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(window.SAMPLES.world, ${+opt('sample', 0)}, ${crop}, ${SCALE})`));
    if (ONLY.includes('icons')) save('icons', await run(`SHEET.icons(${Math.max(1, SCALE - 1)})`));
    if (ONLY.includes('worldmap')) save('worldmap', await run(`SHEET.worldmap(${FRAME}, ${crop}, ${SCALE}, ${JSON.stringify(opt('state', 'start'))})`));
    if (ONLY.includes('themes')) save('themes', await run(`SHEET.themes(${SCALE})`));
    if (ONLY.includes('objects')) save('objects', await run(`window.SAMPLES.objects ? SHEET.themes(${Math.max(2, SCALE - 1)}, window.SAMPLES.objects) : null`));
    if (ONLY.includes('town')) save('town', await run(`window.SAMPLES.town ? SHEET.mapSheet(window.SAMPLES.town, ${Math.max(1, SCALE - 1)}, ${FRAME}, true) : null`));
    if (ONLY.includes('bbg')) save('bbg', await run(`SHEET.bbg(${Math.max(1, SCALE - 1)}, ${ids}, ${+opt('cols', 3)}, ${args.includes('--plain')})`));
    const stats = await run(`(() => { const G = RPG.Gfx; return { defs: Object.keys(G._defs).length, cached: Object.keys(G._cache).length, warned: Object.keys(G._warned), world: RPG.Art.worldTileCacheSize ? RPG.Art.worldTileCacheSize() : 0 }; })()`);
    console.log('gfx defs', stats.defs, 'built', stats.cached, 'world cells cached', stats.world, 'missing', stats.warned.join(' ') || '-', 'in', Date.now() - t0, 'ms');
    for (const e of errors) console.log('[page]', e);
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
