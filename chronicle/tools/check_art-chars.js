#!/usr/bin/env node
// Pixel checks for art-chars (A13) in headless Chromium: builds every party / NPC
// sheet, object, icon and face and checks the §11.3.1 contract:
//   - sheets are {down,up,left,right} × 2 frames of 16x24, left = mirrored right
//   - opaque pixels only (except the ghostly types and the fading girl)
//   - feet on the bottom: lowest opaque row is 23 (the outline under row-22 feet)
//   - the silhouette outline is the 1px ink colour, and no figure touches the frame edge
//   - colour counts, build times
//   - distinguishability: pixel difference between every pair of down-facing frames
//     (party × party and party × townsfolk), reported with the closest pairs
//   - objects / icons / faces have the sizes and frame counts of §3.1.2 / §11.2.12 / §11.3.6
//
//   node tools/check_art-chars.js [--out DIR] [--min N]     (exit 1 on a failure)
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/check_art-chars'));
const MIN_DIFF = +opt('min', 24);

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
window.CHECK = function (minDiff) {
  const R = window.RPG, G = R.Gfx, CA = R.Art.Chars;
  const res = { fail: [], warn: [], stats: {} };
  const F = (m) => res.fail.push(m), W = (m) => res.warn.push(m);
  const px = (cv) => { const c = cv.getContext('2d', { willReadFrequently: true }); return c.getImageData(0, 0, cv.width, cv.height).data; };
  const OUTL = CA.OUTLINE.toLowerCase();
  const hex = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
  const GHOSTLY = new Set(['spirit', 'ghost', 'fine_fade']);
  const ANIMAL = new Set(['cat', 'dog', 'sheep', 'chicken', 'ghost']);
  const downs = {}, edgeOf = {};
  let tBuild = 0, nSheets = 0, maxColors = 0, sumColors = 0, edgeHits = 0;
  function sheetCheck(key, name, opts) {
    const t0 = performance.now();
    const sh = G.get(key);
    tBuild += performance.now() - t0; nSheets++;
    if (!sh || !sh.down) { F(key + ': not a sheet'); return; }
    const colors = new Set();
    for (const d of ['down', 'up', 'left', 'right']) {
      if (!Array.isArray(sh[d]) || sh[d].length !== 2) { F(key + ': ' + d + ' must have 2 frames'); continue; }
      sh[d].forEach((cv, f) => {
        if (cv.width !== 16 || cv.height !== 24) { F(key + ' ' + d + f + ': size ' + cv.width + 'x' + cv.height); return; }
        const p = px(cv);
        let low = -1, semi = 0, badOutline = 0, edge = 0;
        for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
          const i = (y * 16 + x) * 4, a = p[i + 3];
          if (!a) continue;
          low = Math.max(low, y);
          if (a !== 255) semi++;
          colors.add(hex(p, i));
          const tr = (xx, yy) => xx >= 0 && yy >= 0 && xx < 16 && yy < 24 && !p[(yy * 16 + xx) * 4 + 3];
          if ((tr(x - 1, y) || tr(x + 1, y) || tr(x, y - 1) || tr(x, y + 1)) && hex(p, i) !== OUTL && a === 255) badOutline++;
          if ((x === 0 || x === 15 || y === 0) && hex(p, i) !== OUTL) edge++;
        }
        if (!opts.ghostly && semi) F(key + ' ' + d + f + ': ' + semi + ' semi-transparent pixels');
        if (!opts.ghostly && low !== 23) F(key + ' ' + d + f + ': lowest row ' + low + ' (feet must end on row 22 + outline)');
        if (!opts.ghostly && badOutline) F(key + ' ' + d + f + ': ' + badOutline + ' silhouette pixels not in the outline colour');
        if (edge) { edgeHits++; edgeOf[key] = (edgeOf[key] || []).concat(d + f + ':' + edge); }
      });
    }
    // left = mirrored right
    for (let f = 0; f < 2; f++) {
      const l = px(sh.left[f]), r = px(sh.right[f]);
      let diff = 0;
      for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) { const a = (y * 16 + x) * 4, b = (y * 16 + 15 - x) * 4; if (l[a + 3] !== r[b + 3] || l[a] !== r[b]) diff++; }
      if (diff) F(key + ': left' + f + ' is not the mirrored right (' + diff + ' px)');
    }
    // walking frames differ (the figure steps) for humans
    if (!opts.still) for (const d of ['down', 'right']) {
      const a = px(sh[d][0]), b = px(sh[d][1]);
      let diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i + 3] !== b[i + 3] || a[i] !== b[i]) diff++;
      if (diff < 4) F(key + ': ' + d + ' frames 0/1 are (almost) the same (' + diff + ' px)');
    }
    maxColors = Math.max(maxColors, colors.size); sumColors += colors.size;
    if (colors.size > 40) W(key + ': ' + colors.size + ' colours');
    downs[name] = px(sh.down[0]);
  }
  for (const id of CA.PARTY_IDS) sheetCheck('party:' + id, id, { party: true });
  for (const t of CA.NPC_TYPES) sheetCheck('npc:' + t, 'npc:' + t, { ghostly: GHOSTLY.has(t), still: t === 'fine_fade' });
  res.stats.sheets = nSheets; res.stats.buildMs = Math.round(tBuild); res.stats.maxColors = maxColors; res.stats.avgColors = Math.round(sumColors / nSheets);
  res.stats.edgeFrames = edgeHits;
  for (const k in edgeOf) (/^party:/.test(k) ? F : W)(k + ': colour pixels on the frame edge, outline cut off (' + edgeOf[k].join(' ') + ')');

  // distinguishability: pixels that differ (colour distance > 40 or opacity) between down frames
  const dist = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.length; i += 4) {
      const oa = a[i + 3] > 0, ob = b[i + 3] > 0;
      if (oa !== ob) { n++; continue; }
      if (!oa) continue;
      const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (d > 40) n++;
    }
    return n;
  };
  const party = CA.PARTY_IDS, town = CA.NPC_TYPES.filter((t) => !ANIMAL.has(t) && !['spirit', 'demon', 'fine_fade'].includes(t)).map((t) => 'npc:' + t);
  const pairs = [];
  for (let i = 0; i < party.length; i++) for (let j = i + 1; j < party.length; j++) {
    const a = party[i], b = party[j];
    const heroSameType = /^hero_/.test(a) && /^hero_/.test(b) && a.slice(7) === b.slice(7);
    pairs.push({ a, b, d: dist(downs[a], downs[b]), kind: heroSameType ? 'hero m/f' : 'party' });
  }
  for (const a of party) for (const b of town) pairs.push({ a, b, d: dist(downs[a], downs[b]), kind: 'town' });
  for (let i = 0; i < town.length; i++) for (let j = i + 1; j < town.length; j++) pairs.push({ a: town[i], b: town[j], d: dist(downs[town[i]], downs[town[j]]), kind: 'npc' });
  pairs.sort((p, q) => p.d - q.d);
  const byKind = {};
  for (const p of pairs) (byKind[p.kind] = byKind[p.kind] || []).push(p);
  res.stats.closest = {};
  for (const k in byKind) res.stats.closest[k] = byKind[k].slice(0, 5).map((p) => p.a + '~' + p.b + ' ' + p.d);
  for (const p of pairs) if (p.kind !== 'npc' && p.d < minDiff) F('too similar (' + p.kind + '): ' + p.a + ' ~ ' + p.b + ' differ in only ' + p.d + ' px');

  // objects (§3.1.2, §11.2.12)
  const want = { chest: [2, 16, 16], chest_rare: [2, 16, 16], sparkle: [4, 16, 16], glimmer: [2, 16, 16], lantern: [2, 16, 24], page: [4, 16, 16], crest_glow: [4, 16, 16] };
  for (const k in want) {
    const v = G.get('obj:' + k), [n, w, h] = want[k];
    if (!Array.isArray(v) || v.length !== n) { F('obj:' + k + ': want ' + n + ' frames'); continue; }
    for (const cv of v) if (cv.width !== w || cv.height !== h) F('obj:' + k + ': frame ' + cv.width + 'x' + cv.height + ' (want ' + w + 'x' + h + ')');
  }
  const q = G.get('obj:quill'); if (!q || q.width !== 16 || q.height !== 16) F('obj:quill must be one 16x16 canvas');
  const sd = G.get('obj:shadow'); if (!sd || sd.width !== 14 || sd.height !== 5) F('obj:shadow must be 14x5');
  const ln = G.get('obj:lantern'); if (!ln.down || ln.down.length !== 2 || !ln.left) F('obj:lantern must also answer .down/.left (NPC form)');
  const ship = G.get('obj:ship'); if (!ship || !ship.down || ship.down[0].width !== 32) F('obj:ship kept as 32x32 sheet');
  // closed/open chests differ; the rare chest reads differently from the plain one
  const c0 = px(G.get('obj:chest')[0]), r0 = px(G.get('obj:chest_rare')[0]);
  let cd = 0; for (let i = 0; i < c0.length; i += 4) if (Math.abs(c0[i] - r0[i]) + Math.abs(c0[i + 1] - r0[i + 1]) + Math.abs(c0[i + 2] - r0[i + 2]) > 60) cd++;
  res.stats.chestVsRare = cd; if (cd < 60) F('obj:chest_rare too close to obj:chest (' + cd + ' px)');

  // icons (8x8, not empty, opaque)
  const icons = Object.keys(G._defs).filter((k) => k.startsWith('icon:'));
  for (const k of icons) {
    const cv = G.get(k);
    if (cv.width !== 8 || cv.height !== 8) { F(k + ': ' + cv.width + 'x' + cv.height); continue; }
    const p = px(cv); let n = 0, semi = 0;
    for (let i = 0; i < p.length; i += 4) { if (p[i + 3]) n++; if (p[i + 3] && p[i + 3] !== 255) semi++; }
    if (n < 10) F(k + ': only ' + n + ' pixels'); if (semi) F(k + ': semi-transparent');
  }
  res.stats.icons = icons.length;
  // faces
  const faces = Object.keys(G._defs).filter((k) => k.startsWith('face:'));
  for (const k of faces) { const cv = G.get(k); if (cv.width !== 32 || cv.height !== 32) F(k + ': ' + cv.width + 'x' + cv.height); }
  res.stats.faces = faces.length;
  // the hero's quill: white pixels in the upper head area of every hero sprite, every direction
  for (const id of CA.HERO_IDS) for (const d of ['down', 'up', 'right']) {
    const p = px(G.get('party:' + id)[d][0]); let white = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4; if (p[i + 3] && p[i] > 240 && p[i + 1] > 240 && p[i + 2] > 240) white++; }
    if (white < 3) F('party:' + id + ' ' + d + ': quill not visible (' + white + ' white px)');
  }
  return res;
};
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_check_page.js'), PAGE);
  const file = path.join(OUT, '_check.html');
  fs.writeFileSync(file, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_check_page.js')}"></script></body></html>`);
  const browser = await playwright.chromium.launch();
  let res;
  const errors = [];
  try {
    const page = await (await browser.newContext()).newPage();
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /char art|missing graphic/.test(m.text()))) errors.push(m.text()); });
    await page.goto('file://' + file);
    res = await page.evaluate(`CHECK(${MIN_DIFF})`);
  } finally { await browser.close(); }
  const s = res.stats;
  console.log(`sheets ${s.sheets} built in ${s.buildMs} ms · colours avg ${s.avgColors} max ${s.maxColors} · icons ${s.icons} · faces ${s.faces} · chest vs rare ${s.chestVsRare} px · frames touching the edge ${s.edgeFrames}`);
  for (const k in s.closest) console.log(`closest ${k}: ${s.closest[k].join(' | ')}`);
  for (const w of res.warn) console.log('  warn', w);
  for (const f of res.fail) console.log('  FAIL', f);
  for (const e of errors) console.log('  [page]', e);
  const bad = res.fail.length + errors.length;
  console.log(bad ? bad + ' problem(s)' : 'art-chars pixel checks OK');
  process.exitCode = bad ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(2); });
