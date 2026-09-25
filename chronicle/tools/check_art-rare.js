#!/usr/bin/env node
// Pixel-level conformance check for the rare-monster and post-game sprites (area art-rare
// A15b). Builds every sprite in headless Chromium from core + data + art sources only (no
// game boot) and measures it against DESIGN §9.10.3 / §11.4.2 and the Crest sprite
// contract (design/notes/art.md §3.2). Exit 1 on any failure; prints the measured numbers.
//
//   node tools/check_art-rare.js [--ids a,b] [-v]
//
//   C1  size = R.Art.RARE_SPRITES (32 / 48 / 64) or the post-game sizes
//   C2  feet: the outline closes on the last row, body pixels on the row above it
//   C3  opaque pixels only (no semi-transparency)
//   C4  centred: bbox centre within ±2.5 px of the canvas centre
//   C5  "rare at a glance": ≥ 3 white glints and (≥ 8 jewel / gold pixels or ≥ 6 hues)
//   C6  a dark silhouette: ≥ 50% of the edge pixels are near-black (the §11.4.2 outline);
//       the rest are the loose, unoutlined effects (sparkles, steam, dream bubbles)
//   C7  palette 16..110 colours
//   C8  fills its canvas: bbox height ≥ 70% of the canvas, opaque cover ≥ 15%
//   C9  deterministic: a second build is pixel-identical
//   C10 fast: build ≤ 80 ms (300 for the 128x112 boss; the faster of two builds)
//   C11 all 23 rare sprites distinct; 'mon:rm_*' aliases give the same pixels
//   C12 post-game bases survive hue shifts (outline stays dark), and the composed lineage
//       'mon:void_1..3' / 'mon:chaos_1..3' (A14a) builds at the base size
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes('-v');
const TMP = path.join(require('os').tmpdir(), 'check_art-rare-' + process.pid);
const PG_SIZES = { void_wraith: [48, 48], chaos_beast: [64, 64], boss_abyss: [128, 112] };

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

const PAGE = String.raw`
window.CHECK = (function () {
  const R = window.RPG, G = R.Gfx;
  function build(key) {
    delete G._cache[key];
    const t0 = performance.now();
    let im = G.get(key);
    const ms = performance.now() - t0;
    if (Array.isArray(im)) im = im[0];
    return { im, ms };
  }
  function data(im) { return im.getContext('2d').getImageData(0, 0, im.width, im.height).data; }
  function hashOf(d) { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
  function measure(im) {
    const w = im.width, h = im.height, d = data(im);
    let x0 = w, y0 = h, x1 = -1, y1 = -1, semi = 0, glint = 0, jewel = 0, px = 0, above = 0, edge = 0, edgeDark = 0;
    const cols = new Set(), hues = new Set();
    const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3];
      if (!a) continue;
      px++;
      if (a < 255) semi++;
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      cols.add(r << 16 | g << 8 | b);
      if (mn >= 236) glint++;
      if (mx >= 200 && (mx - mn) / mx >= 0.55) jewel++;
      if (mx >= 150 && (mx - mn) / mx >= 0.22) { const dd = mx - mn, hh = mx === r ? ((g - b) / dd + 6) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hues.add(Math.floor(hh * 2)); }
      if (!A(x - 1, y) || !A(x + 1, y) || !A(x, y - 1) || !A(x, y + 1)) { edge++; if (0.299 * r + 0.587 * g + 0.114 * b < 48) edgeDark++; }
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (y === h - 2) above++;
    }
    return { w, h, bbox: [x0, y0, x1, y1], centre: (x0 + x1 + 1) / 2 - w / 2, above, semi, glint, jewel, hues: hues.size, colours: cols.size,
      cover: px / (w * h), edgeDark: edge ? edgeDark / edge : 0, hash: hashOf(d) };
  }
  function run(ids, pg, lineage) {
    const out = { rare: [], pg: [], alias: [], lineage: [], variants: [] };
    const sizes = R.Art.RARE_SPRITES || {};
    for (const id of ids) {
      const a = build('mon:' + id), b = build('mon:' + id);
      const m = measure(a.im);
      m.id = id; m.ms = Math.round(Math.min(a.ms, b.ms) * 10) / 10; m.want = sizes[id]; m.same = measure(b.im).hash === m.hash;
      out.rare.push(m);
    }
    for (const rm in (R.Art.RARE_BY_MON || {})) {
      const sp = R.Art.RARE_BY_MON[rm];
      if (!ids.includes(sp)) continue;
      out.alias.push({ rm, sp, same: measure(build('mon:' + rm).im).hash === measure(G.get('mon:' + sp)).hash });
    }
    for (const id of pg) {
      const a = build('mon:' + id), b = build('mon:' + id), m = measure(a.im);
      m.id = id; m.ms = Math.round(Math.min(a.ms, b.ms) * 10) / 10; m.same = measure(b.im).hash === m.hash;
      out.pg.push(m);
      if (id === 'void_wraith' || id === 'chaos_beast') {
        for (const v of [{ hue: 150 }, { hue: -110 }, { hue: 40, sat: 1.1 }]) {
          const vm = measure(G.variant('mon:' + id, v));
          out.variants.push({ id, v, edgeDark: vm.edgeDark, cover: vm.cover, base: m.cover, baseEdge: m.edgeDark });
        }
      }
    }
    for (const id of lineage) {
      if (!G.has('mon:' + id)) { out.lineage.push({ id, missing: true }); continue; }
      const im = build('mon:' + id).im, base = id.startsWith('void') ? 'void_wraith' : 'chaos_beast', bi = G.get('mon:' + base);
      out.lineage.push({ id, w: im.width, h: im.height, bw: bi.width, bh: bi.height, colours: measure(im).colours });
    }
    return out;
  }
  return { run };
})();
`;

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(path.join(TMP, 'page.js'), PAGE);
  const html = path.join(TMP, 'check.html');
  fs.writeFileSync(html, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${sources().map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(TMP, 'page.js')}"></script></body></html>`);
  const browser = await playwright.chromium.launch();
  let fails = 0, passes = 0;
  const ok = (c, name, detail) => { if (c) { passes++; if (VERBOSE) console.log('  ok  ', name); } else { fails++; console.log('  FAIL', name, detail != null ? '— ' + detail : ''); } };
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => { if (/rare_monsters|postgame\.js|page\.js/.test(String(e.stack || e))) errors.push(String(e.stack || e)); });
    page.on('console', (m) => { if (m.type() === 'error' && /rare|postgame|void_|chaos_/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + html);
    await page.waitForTimeout(150);
    const sizes = await page.evaluate('RPG.Art.RARE_SPRITES || {}');
    const ids = opt('ids', '') ? opt('ids', '').split(',').map((s) => (s.startsWith('rare_') ? s : 'rare_' + s)) : Object.keys(sizes);
    const all = !opt('ids', '');
    const res = await page.evaluate(`CHECK.run(${JSON.stringify(ids)}, ${JSON.stringify(all ? Object.keys(PG_SIZES) : [])}, ${JSON.stringify(all ? ['void_1', 'void_2', 'void_3', 'chaos_1', 'chaos_2', 'chaos_3'] : [])})`);
    console.log('id              size   bbox              centre cover edge  glint jewel hues colours ms');
    for (const m of res.rare.concat(res.pg)) {
      console.log(m.id.padEnd(15), (m.w + 'x' + m.h).padEnd(7), JSON.stringify(m.bbox).padEnd(17), String(m.centre).padEnd(6), m.cover.toFixed(2).padEnd(5), m.edgeDark.toFixed(2).padEnd(5),
        String(m.glint).padEnd(5), String(m.jewel).padEnd(5), String(m.hues).padEnd(4), String(m.colours).padEnd(7), m.ms);
    }
    for (const m of res.rare) {
      const n = m.id;
      ok(m.w === m.want && m.h === m.want, 'C1 ' + n + ' size ' + m.w + 'x' + m.h, 'want ' + m.want);
      ok(m.bbox[3] === m.h - 1 && m.above > 0, 'C2 ' + n + ' feet on the ground line', 'lowest ' + m.bbox[3]);
      ok(m.semi === 0, 'C3 ' + n + ' opaque', m.semi + ' semi px');
      ok(Math.abs(m.centre) <= 2.5, 'C4 ' + n + ' centred', m.centre);
      ok(m.glint >= 3 && (m.jewel >= 8 || m.hues >= 6), 'C5 ' + n + ' reads as rare', `glint ${m.glint} jewel ${m.jewel} hues ${m.hues}`);
      ok(m.edgeDark >= 0.5, 'C6 ' + n + ' dark silhouette', m.edgeDark.toFixed(2));
      ok(m.colours >= 16 && m.colours <= 110, 'C7 ' + n + ' palette', m.colours);
      ok((m.bbox[3] - m.bbox[1] + 1) / m.h >= 0.7 && m.cover >= 0.15, 'C8 ' + n + ' fills its canvas', `h ${m.bbox[3] - m.bbox[1] + 1}/${m.h} cover ${m.cover.toFixed(2)}`);
      ok(m.same, 'C9 ' + n + ' deterministic');
      ok(m.ms <= 80, 'C10 ' + n + ' builds fast', m.ms + ' ms');
    }
    if (all) {
      const hs = new Set(res.rare.map((m) => m.hash));
      ok(hs.size === res.rare.length && res.rare.length === 23, 'C11 23 distinct rare sprites', hs.size + '/' + res.rare.length);
    }
    for (const a of res.alias) ok(a.same, 'C11 mon:' + a.rm + ' = mon:' + a.sp);
    for (const m of res.pg) {
      const want = PG_SIZES[m.id];
      ok(m.w === want[0] && m.h === want[1], 'C1 ' + m.id + ' size', m.w + 'x' + m.h);
      ok(m.bbox[3] === m.h - 1, 'C2 ' + m.id + ' feet');
      ok(m.semi === 0, 'C3 ' + m.id + ' opaque');
      ok(m.same, 'C9 ' + m.id + ' deterministic');
      ok(m.ms <= (m.h > 64 ? 300 : 80), 'C10 ' + m.id + ' builds fast', m.ms + ' ms');
    }
    for (const v of res.variants) ok(v.edgeDark >= v.baseEdge - 0.02 && Math.abs(v.cover - v.base) < 1e-9, 'C12 ' + v.id + ' ' + JSON.stringify(v.v) + ' keeps its outline', v.edgeDark.toFixed(2) + ' vs ' + v.baseEdge.toFixed(2));
    for (const l of res.lineage) {
      if (l.missing) { console.log('  (skip) mon:' + l.id + ' not registered yet (A14a)'); continue; }
      ok(l.w === l.bw && l.h === l.bh && l.w > 16, 'C12 mon:' + l.id + ' composed at the base size', l.w + 'x' + l.h);
    }
    for (const e of errors) { fails++; console.log('  FAIL page error', e); }
  } finally {
    await browser.close();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(`\ncheck_art-rare: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
