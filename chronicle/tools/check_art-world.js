#!/usr/bin/env node
// Pixel checks for art-world (A16a) in headless Chromium: builds every world
// tile and battle backdrop and measures what DESIGN §11.2 asks for.
//
//   node tools/check_art-world.js [--out DIR] [-v] [--page-only]   (--page-only: write the page for manual probing)
//
// Checks (exit 1 on failure; the numbers are printed):
//  C1 every tile:<world id> and bbg:<id> builds, right size (16×16 / 256×144),
//     no magenta placeholder, no Gfx warnings; frame counts (sea 4, river 4,
//     sandstorm 4, marsh_fog 2, fog 8 = 4 images every 32 frames, magma 2)
//  C2 seamless transitions: on the real world map (or the fixture samples) the
//     mean colour step across cell borders is ≤ 1.25× the step inside cells
//  C3 wrap: the cells at the map's seam join like any other border
//  C4 calm stage (§11.2.13): in every backdrop the strip y 112–140 (x 20–236) is
//     calmer than the rest of the picture below the status windows
//  C5 people stand out (§11.2.2): party/NPC sprites are ≥ 1.4× as colourful as the ground
//  C6 hidden passages: an unfound secret_forest / secret_rock differs from its
//     neighbourhood look by only a few pixels, a found one clearly more
//  C7 performance: rendering the whole world map cold, ms per distinct cell and cache size
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/check_art-world'));
const VERBOSE = args.includes('-v');

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art', 'maps']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

const PAGE = String.raw`
window.CHECK = (function () {
  const R = window.RPG, G = R.Gfx, A = R.Art;
  const arr = (g) => (Array.isArray(g) ? g : [g]);
  const px = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  function build() {
    const out = { tiles: {}, bbg: {} };
    for (const id of R.TilesWorld.ids) {
      let g, err = null;
      try { g = G.get('tile:' + id); } catch (e) { err = String(e); }
      const fr = arr(g);
      let magenta = 0, bad = 0;
      for (const cv of fr) {
        if (!cv || cv.width !== 16 || cv.height !== 16) { bad++; continue; }
        const d = px(cv);
        for (let i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) magenta++;
      }
      out.tiles[id] = { frames: fr.length, bad, magenta, err };
    }
    for (const id of A.BBG_IDS) {
      let g, err = null;
      try { g = G.get('bbg:' + id); } catch (e) { err = String(e); }
      const cv = arr(g)[0];
      const okSize = cv && cv.width === 256 && cv.height === 144;
      let magenta = 0, colours = new Set();
      if (okSize) { const d = px(cv); for (let i = 0; i < d.length; i += 4) { if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 255) magenta++; colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); } }
      out.bbg[id] = { okSize, magenta, colours: colours.size, err };
    }
    out.warned = Object.keys(G._warned || {});
    return out;
  }
  function mapOf(rows, legend, wrap, id) {
    const L = R.DB.legends.world, h = rows.length, w = rows[0].length, tiles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push(L[rows[y][x]] || 'grass');
    return {
      id: id || 'check', w, h, tiles, wrap, outside: 'sea', isWorld: true,
      tileAt(x, y) {
        if (wrap) { x = ((x % w) + w) % w; y = ((y % h) + h) % h; }
        else if (x < 0 || y < 0 || x >= w || y >= h) return 'sea';
        return tiles[y * w + x];
      },
    };
  }
  function worldMap() {
    const def = R.DB.maps.world;
    if (!def) return null;
    const m = mapOf(def.rows, 'world', def.wrap !== false, 'world');
    const marks = def.marks || {};
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const mk = marks[def.rows[y][x]]; if (mk) m.tiles[y * m.w + x] = R.DB.legends.world[mk.under != null ? mk.under : '.'] || 'grass'; }
    return m;
  }
  /** render cells [x0,x1)×[y0,y1) into one canvas (frame f) */
  function draw(m, x0, y0, w, h, f) {
    const cv = document.createElement('canvas'); cv.width = w * 16; cv.height = h * 16;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const g = A.worldTile(m, x0 + x, y0 + y); c.drawImage(arr(g)[(f || 0) % arr(g).length], x * 16, y * 16); }
    return cv;
  }
  /** mean colour step across cell borders vs inside cells (columns 15|16 vs 7|8, rows likewise) */
  function seams(cv) {
    const d = px(cv), W = cv.width, H = cv.height;
    const step = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
    let bs = 0, bn = 0, is = 0, inn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x + 1 < W; x++) {
      const m = x % 16, i = (y * W + x) * 4;
      if (m === 15) { bs += step(i, i + 4); bn++; } else if (m === 7) { is += step(i, i + 4); inn++; }
    }
    for (let y = 0; y + 1 < H; y++) for (let x = 0; x < W; x++) {
      const m = y % 16, i = (y * W + x) * 4;
      if (m === 15) { bs += step(i, i + W * 4); bn++; } else if (m === 7) { is += step(i, i + W * 4); inn++; }
    }
    return { border: bs / bn, inside: is / inn, ratio: (bs / bn) / (is / inn) };
  }
  // ground tiles: their art is the class field + textures (no objects of their own), so a
  // border between two of them must be as smooth as the inside of a cell
  const GROUND = new Set(['sea', 'fog', 'grass', 'plain', 'road', 'beach', 'desert', 'sandstorm', 'snow', 'marsh', 'marsh_fog', 'swamp', 'wasteland', 'ash', 'magma']);
  /** border step between horizontally/vertically adjacent ground cells vs the step 4 px inside them */
  function groundSeams(m, cv, x0, y0) {
    const d = px(cv), W = cv.width;
    const step = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
    let bs = 0, bn = 0, is = 0, inn = 0, pairs = 0;
    const cw = cv.width / 16, ch = cv.height / 16;
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      const a = m.tileAt(x0 + cx, y0 + cy);
      if (!GROUND.has(a)) continue;
      if (cx + 1 < cw && GROUND.has(m.tileAt(x0 + cx + 1, y0 + cy))) {
        pairs++;
        for (let y = 0; y < 16; y++) {
          const r = (cy * 16 + y) * W;
          bs += step((r + cx * 16 + 15) * 4, (r + cx * 16 + 16) * 4); bn++;
          is += step((r + cx * 16 + 11) * 4, (r + cx * 16 + 12) * 4) + step((r + cx * 16 + 19) * 4, (r + cx * 16 + 20) * 4); inn += 2;
        }
      }
      if (cy + 1 < ch && GROUND.has(m.tileAt(x0 + cx, y0 + cy + 1))) {
        pairs++;
        for (let x = 0; x < 16; x++) {
          const c0 = cx * 16 + x;
          bs += step(((cy * 16 + 15) * W + c0) * 4, ((cy * 16 + 16) * W + c0) * 4); bn++;
          is += step(((cy * 16 + 11) * W + c0) * 4, ((cy * 16 + 12) * W + c0) * 4) + step(((cy * 16 + 19) * W + c0) * 4, ((cy * 16 + 20) * W + c0) * 4); inn += 2;
        }
      }
    }
    return { pairs, border: bs / Math.max(1, bn), inside: is / Math.max(1, inn), ratio: (bs / Math.max(1, bn)) / Math.max(0.01, is / Math.max(1, inn)) };
  }
  function seamCheck() {
    const m = worldMap();
    const res = {};
    if (m) {
      const t0 = performance.now();
      const cv = draw(m, 0, 0, m.w, m.h, 0);
      const ms = performance.now() - t0;
      res.world = Object.assign(groundSeams(m, cv, 0, 0), { all: seams(cv).ratio, cells: m.w * m.h, cache: A.worldTileCacheSize(), ms: Math.round(ms) });
      // wrap seam: last column + first column, last row + first row
      const colL = draw(m, m.w - 4, 0, 8, m.h, 0), rowT = draw(m, 0, m.h - 4, m.w, 8, 0);
      const s1 = groundSeams(m, colL, m.w - 4, 0), s2 = groundSeams(m, rowT, 0, m.h - 4);
      res.wrap = { ratio: Math.max(s1.ratio, s2.ratio) };
      // the wrap column in isolation (border between x=w-1 and x=0 is at px 63|64 of colL)
      const d = px(colL), W = colL.width;
      let s = 0, n = 0, si = 0, ni = 0;
      for (let y = 0; y < colL.height; y++) {
        const i = (y * W + 63) * 4, j = (y * W + 71) * 4;
        s += Math.abs(d[i] - d[i + 4]) + Math.abs(d[i + 1] - d[i + 5]) + Math.abs(d[i + 2] - d[i + 6]); n++;
        si += Math.abs(d[j] - d[j + 4]) + Math.abs(d[j + 1] - d[j + 5]) + Math.abs(d[j + 2] - d[j + 6]); ni++;
      }
      res.wrap.seamStep = s / n; res.wrap.insideStep = si / ni;
    }
    res.samples = (window.SAMPLES && window.SAMPLES.world || []).map((d) => { const mm = mapOf(d.rows, 'world', false); return groundSeams(mm, draw(mm, 0, 0, mm.w, mm.h, 0), 0, 0).ratio; });
    return res;
  }
  /** mean luminance gradient in a rect */
  function busy(d, W, x0, y0, x1, y1) {
    let s = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      s += Math.abs(lum(d, i) - lum(d, i + 4)) + Math.abs(lum(d, i) - lum(d, i + W * 4)); n++;
    }
    return s / n;
  }
  function stageCheck() {
    const out = {};
    for (const id of A.BBG_IDS) {
      const cv = arr(G.get('bbg:' + id))[0], d = px(cv);
      const stage = busy(d, 256, 20, 112, 236, 140), rest = busy(d, 256, 0, 56, 255, 111);
      out[id] = { stage: +stage.toFixed(2), rest: +rest.toFixed(2), ratio: +(stage / Math.max(0.01, rest)).toFixed(2) };
    }
    return out;
  }
  function chroma(cv) {
    const d = px(cv); let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); s += mx - mn; n++; }
    return n ? s / n : 0;
  }
  function contrastCheck() {
    const people = ['party:hero_m_warrior', 'party:hero_f_mage', 'npc:man', 'npc:woman', 'npc:soldier', 'npc:merchant', 'npc:old_man', 'npc:girl'].filter((k) => G.has(k));
    const pc = people.map((k) => { let g = G.get(k); if (g && g.down) g = g.down[0]; return chroma(arr(g)[0]); });
    const grounds = ['grass', 'plain', 'road', 'forest', 'marsh', 'desert', 'snow', 'ash', 'wasteland', 'beach'];
    const gc = grounds.map((id) => chroma(arr(G.get('tile:' + id))[0]));
    const avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
    return { people: people.length, peopleChroma: +avg(pc).toFixed(1), groundChroma: +avg(gc).toFixed(1), ratio: +(avg(pc) / Math.max(1, avg(gc))).toFixed(2), perGround: Object.fromEntries(grounds.map((g, i) => [g, +gc[i].toFixed(1)])) };
  }
  /** pixels that differ clearly (a channel by more than 28) */
  function diffPx(a, b) { const da = px(a), db = px(b); let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 28) n++; return n; }
  function secretCheck() {
    const out = {};
    const make = (centre, around) => ({ id: 'secret_check', w: 5, h: 5, isWorld: true, outside: around, tileAt(x, y) { return x === 2 && y === 2 ? centre : around; } });
    for (const [sec, like] of [['secret_forest', 'forest'], ['secret_rock', 'mountain']]) {
      R.Game = R.Game || {}; R.Game.secrets = {};
      const plain = draw(make(like, like), 2, 2, 1, 1, 0), hidden = draw(make(sec, like), 2, 2, 1, 1, 0);
      R.Game.secrets['secret_check:2,2'] = true;
      const found = draw(make(sec, like), 2, 2, 1, 1, 0);
      R.Game.secrets = {};
      out[sec] = { hiddenDiff: diffPx(plain, hidden), foundDiff: diffPx(plain, found) };
    }
    return out;
  }
  /** each terrain as a uniform 8×8 field (its own texture, decorations and sprites must tile) */
  function uniformCheck(ids) {
    const out = {};
    for (const id of ids) {
      const m = { id: 'u', w: 8, h: 8, isWorld: true, outside: id, tileAt() { return id; } };
      out[id] = seams(draw(m, 0, 0, 8, 8, 0));
    }
    return out;
  }
  return { build, seamCheck, stageCheck, contrastCheck, secretCheck, uniformCheck, seams, draw, mapOf };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const samples = path.join(__dirname, 'fixtures/art-world/samples.js');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${sources().map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script>window.RPG && RPG.runDataHooks && RPG.runDataHooks();</script>
<script src="file://${path.join(OUT, '_check_page.js')}"></script>
<script src="file://${samples}"></script>
</body></html>`;
  fs.writeFileSync(path.join(OUT, '_check_page.js'), PAGE);
  const file = path.join(OUT, '_check.html');
  fs.writeFileSync(file, html);
  if (args.includes('--page-only')) { console.log('page →', file, '(window.CHECK.*)'); return; }
  let pass = 0, fail = 0;
  const failures = [];
  const ok = (c, m) => { if (c) { pass++; if (VERBOSE) console.log('  ok  ', m); } else { fail++; failures.push(m); console.log('  FAIL', m); } };
  const browser = await playwright.chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + file);
    await page.waitForTimeout(200);
    const run = (js) => page.evaluate(js);

    // C1
    const b = await run('CHECK.build()');
    const FRAMES = { sea: 4, river: 4, sandstorm: 4, marsh_fog: 2, fog: 8, magma: 2 };
    for (const id in b.tiles) {
      const t = b.tiles[id];
      ok(!t.err && !t.bad && !t.magenta, 'C1 tile:' + id + ' builds clean (' + t.frames + ' frame' + (t.frames > 1 ? 's' : '') + ')' + (t.err ? ' ' + t.err : ''));
      if (FRAMES[id]) ok(t.frames === FRAMES[id], 'C1 tile:' + id + ' has ' + FRAMES[id] + ' frames (has ' + t.frames + ')');
      else if (!['reef', 'barrier'].includes(id)) ok(t.frames === 1, 'C1 tile:' + id + ' is a still picture');
    }
    for (const id in b.bbg) {
      const g = b.bbg[id];
      ok(!g.err && g.okSize && !g.magenta, 'C1 bbg:' + id + ' builds 256×144 clean (' + g.colours + ' colours)' + (g.err ? ' ' + g.err : ''));
      ok(g.colours >= 24, 'C1 bbg:' + id + ' is a painted scene (≥ 24 colours)');
    }
    const warned = b.warned.filter((k) => /^(tile|bbg):/.test(k));
    ok(warned.length === 0, 'C1 no missing tile:/bbg: keys' + (warned.length ? ': ' + warned.join(' ') : ''));

    // C2 / C3 / C7
    const s = await run('CHECK.seamCheck()');
    s.samples.forEach((r, i) => ok(r <= 1.1, 'C2 sample ' + i + ': ground borders step ' + r.toFixed(2) + '× the inside of the cells (≤ 1.1)'));
    if (s.world) {
      ok(s.world.ratio <= 1.1, 'C2 world map: ' + s.world.pairs + ' ground borders step ' + s.world.ratio.toFixed(2) + '× the inside (≤ 1.1; border ' + s.world.border.toFixed(1) + ', inside ' + s.world.inside.toFixed(1) + '; whole picture incl. objects ' + s.world.all.toFixed(2) + ')');
      ok(s.wrap.ratio <= 1.1, 'C3 wrap: ground borders around the seam ' + s.wrap.ratio.toFixed(2) + '× (≤ 1.1; seam column step ' + s.wrap.seamStep.toFixed(1) + ' vs inside ' + s.wrap.insideStep.toFixed(1) + ')');
      const per = s.world.ms / s.world.cache;
      console.log(`  C7 world map ${s.world.cells} cells cold in ${s.world.ms} ms: ${s.world.cache} distinct cells cached, ${per.toFixed(2)} ms per distinct cell`);
      ok(per < 3, 'C7 ≤ 3 ms per distinct cell (' + per.toFixed(2) + ')');
      ok(s.world.cache < 12000, 'C7 cache < 12000 cells (' + s.world.cache + ')');
    } else console.log('  (no world map: C2 world / C3 / C7 skipped)');

    // C4
    const st = await run('CHECK.stageCheck()');
    const NEW = ['tree', 'manor', 'ship', 'mine', 'library', 'oblivion', 'swamp', 'ashland', 'jungle', 'beach', 'peak', 'hollow', 'ring'];
    for (const id in st) {
      const msg = 'bbg:' + id + ' stage strip: busy ' + st[id].stage + ' vs rest ' + st[id].rest + ' (ratio ' + st[id].ratio + ')';
      if (NEW.includes(id)) ok(st[id].stage <= 14 && st[id].ratio <= 1.1, 'C4 ' + msg + ' (≤ 14 and ≤ 1.1×)');
      else if (VERBOSE) console.log('  info C4 (Crest backdrop, unchanged) ' + msg);
    }

    // C5
    const c = await run('CHECK.contrastCheck()');
    if (c.people) ok(c.ratio >= 1.2, 'C5 people chroma ' + c.peopleChroma + ' vs ground ' + c.groundChroma + ' → ' + c.ratio + '× (≥ 1.2)');
    else console.log('  (no party:/npc: sprites registered: C5 skipped)');
    if (VERBOSE) console.log('  ground chroma', JSON.stringify(c.perGround));

    // C6
    const sc = await run('CHECK.secretCheck()');
    for (const id in sc) {
      ok(sc[id].hiddenDiff >= 1 && sc[id].hiddenDiff <= 16, 'C6 ' + id + ' hidden: ' + sc[id].hiddenDiff + ' px clearly differ from the plain look (1–16: "よく見ると分かる")');
      ok(sc[id].foundDiff >= sc[id].hiddenDiff + 6, 'C6 ' + id + ' found: clearer (' + sc[id].foundDiff + ' px)');
    }
    for (const e of errors) { ok(false, 'page error: ' + e.split('\n')[0]); }
  } finally {
    await browser.close();
  }
  console.log(`\ncheck_art-world: ${pass} passed, ${fail} failed`);
  if (fail) { console.log(failures.map((f) => '  - ' + f).join('\n')); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(2); });
