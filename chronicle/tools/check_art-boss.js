#!/usr/bin/env node
// Pixel checks of every boss sprite in a headless browser (owner art-boss A15a). exit 1 on failure.
//
//   node tools/check_art-boss.js [--ids a,b] [-v]
//
// For the 35 sprites of the Chronicle bosses (§9.11.4 / §9.11.6) and the 8 Crest bosses kept registered:
//   P1 builds without a page error / warning, returns a canvas of the §9.11.6 size (compose rows: the size
//      of their base), build time
//   P2 opaque pixels only (alpha 0 or 255, §11.4.2)
//   P3 stands on the ground: the lowest opaque row is the bottom row (H−1, the outline) — flyers may float
//      up to 4 rows
//   P4 outline: ≥ 85 % of the silhouette's outer ring is near black (luma < 0.2); the see-through shades
//      use the light outline of §9.11.6 instead (#a0b0e0)
//   P5 colour count within 8..256 (SFC palette discipline), fill ≥ 18 % of the canvas, bbox ≥ 55 % wide
//   P6 horizontal balance: the centre of mass within ±22 % of the width from the centre
//   P7 the battle band (§11.4.2): the rows hidden under the windows (y < 56 after the sink) hold no eye —
//      the eye row of R.Art.bossesB.face (new sprites) must land at screen y ≥ 56
//   P8 aliases: mon:<bossId> is the very canvas of mon:<sprite>; the compose stand-in (used while
//      art-mons' R.Art.compose is missing) returns a canvas of the right size too
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROSTER = require('./fixtures/art-boss/roster');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes('-v');
const OUT = path.resolve(opt('out', '/tmp/claude-0/check_art-boss'));
const ALL = Object.keys(ROSTER.SPRITES).concat(Object.keys(ROSTER.LEGACY));
const IDS = opt('ids', '') ? opt('ids', '').split(',') : ALL;
const LIGHT_OUTLINE = new Set(['boss_shade_sword', 'boss_shade_prayer', 'boss_shade_star', 'b_mist_double', 'b_valzard_echo']);
const FLYERS = new Set(Object.keys(ROSTER.SPRITES).filter((id) => ROSTER.SPRITES[id][4]));

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
window.CHECK = function (ids, bosses) {
  const R = window.RPG, G = R.Gfx, out = {};
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  for (const id of ids) {
    const t0 = performance.now();
    let cv = G.get('mon:' + id);
    const ms = performance.now() - t0;
    if (Array.isArray(cv)) cv = cv[0];
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    let semi = 0, n = 0, sx = 0, x0 = w, x1 = -1, y0 = h, y1 = -1, ring = 0, dark = 0;
    const cols = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3];
      if (!a) continue;
      if (a !== 255) semi++;
      n++; sx += x; cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) {
        // outer ring only: the empty neighbour must reach the canvas edge through empty pixels horizontally or vertically
        ring++;
        if (lum(d[i], d[i + 1], d[i + 2]) < 0.2) dark++;
      }
    }
    out[id] = { w, h, ms: Math.round(ms), semi, n, fill: n / (w * h), cols: cols.size, bbox: [x0, y0, x1, y1], lowest: y1, com: n ? sx / n : 0, ring, dark };
  }
  // aliases and the stand-in
  const alias = [];
  for (const [bid, sp] of Object.entries(bosses)) {
    if (bid === sp) continue;
    if (G.get('mon:' + bid) !== G.get('mon:' + sp)) alias.push(bid);
  }
  const stand = [];
  if (R.Art.bossComposeStandIn) for (const id in R.Art.MON_COMPOSE_BOSSES) {
    const c = R.Art.bossComposeStandIn(id), base = G.get('mon:' + R.Art.MON_COMPOSE_BOSSES[id][0]);
    const b0 = Array.isArray(base) ? base[0] : base;
    if (!c || c.width !== b0.width || c.height !== b0.height) stand.push(id);
  }
  return { out, alias, stand, face: (R.Art.bossesB || {}).face || {}, compose: R.Art.MON_COMPOSE_BOSSES, warned: Object.keys(G._warned) };
};
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, '_check_page.js'), PAGE);
  const pageFile = path.join(OUT, '_check.html');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${sources().map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_check_page.js')}"></script></body></html>`);
  const browser = await playwright.chromium.launch();
  let fails = 0;
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + pageFile);
    const bosses = Object.fromEntries(Object.entries(ROSTER.BOSSES).map(([k, v]) => [k, v[0]]));
    const res = await page.evaluate(([ids, b]) => window.CHECK(ids, b), [IDS, bosses]);
    const fail = (id, m) => { fails++; console.log('FAIL', id, m); };
    const sink = (h) => Math.max(0, Math.min(20, Math.round((h - 64) / 2.4)));
    const rows = [];
    for (const id of IDS) {
      const r = res.out[id], ros = ROSTER.SPRITES[id];
      const want = ros ? ros[2] : null;
      if (!r) { fail(id, 'not built'); continue; }
      // P1
      if (want && (r.w !== want[0] || r.h !== want[1])) fail(id, `P1 size ${r.w}x${r.h}, want ${want.join('x')}`);
      if (r.ms > 400) fail(id, `P1 build ${r.ms} ms`);
      // P2
      if (r.semi) fail(id, `P2 ${r.semi} semi-transparent pixels`);
      // P3
      const floatOk = FLYERS.has(id) ? 4 : 0;
      if (r.lowest < r.h - 1 - floatOk) fail(id, `P3 lowest row ${r.lowest}, want ${r.h - 1}${floatOk ? ' (flyer: ≥ ' + (r.h - 1 - floatOk) + ')' : ''}`);
      // P4
      const darkShare = r.dark / Math.max(1, r.ring);
      if (!LIGHT_OUTLINE.has(id) && darkShare < 0.85) fail(id, `P4 outer ring only ${(darkShare * 100).toFixed(0)} % dark`);
      // P5
      if (r.cols < 8 || r.cols > 256) fail(id, `P5 ${r.cols} colours`);
      if (r.fill < 0.18) fail(id, `P5 fill ${(r.fill * 100).toFixed(0)} %`);
      if ((r.bbox[2] - r.bbox[0] + 1) / r.w < 0.55) fail(id, `P5 bbox width ${r.bbox[2] - r.bbox[0] + 1}/${r.w}`);
      // P6
      const off = (r.com - (r.w - 1) / 2) / r.w;
      if (Math.abs(off) > 0.22) fail(id, `P6 centre of mass off by ${(off * 100).toFixed(0)} %`);
      // P7
      const top = 130 + sink(r.h) - r.h, hidden = Math.max(0, 56 - top);
      const f = res.face[id];
      if (f != null && top + f < 56) fail(id, `P7 eye row ${f} is under the window band (hidden rows 0..${hidden - 1})`);
      rows.push([id, r.w + 'x' + r.h, r.ms + 'ms', r.cols + 'c', (r.fill * 100).toFixed(0) + '%', (darkShare * 100).toFixed(0) + '%dark', 'hidden ' + hidden + (f != null ? ' eye@' + (top + f) : ''), (off * 100).toFixed(0) + '%com']);
    }
    // P8
    if (res.alias.length) fail('P8', 'aliases not identical: ' + res.alias.join(','));
    if (res.stand.length) fail('P8', 'stand-in size mismatch: ' + res.stand.join(','));
    const mine = (e) => /bosses|_check_page|mon:(b_|boss_)/.test(e) || !/\/src\//.test(e);
    for (const e of errors) { if (mine(e)) fail('page', e.slice(0, 300)); else if (VERBOSE) console.log('[other owner]', e.slice(0, 200)); }
    const warned = res.warned.filter((k) => IDS.includes(k.replace(/^mon:/, '')));
    if (warned.length) fail('page', 'missing graphics: ' + warned.join(','));
    if (VERBOSE || fails) for (const r of rows) console.log(r.join('  '));
    const t = rows.map((r) => parseInt(r[2], 10));
    console.log(`check_art-boss: ${IDS.length} sprites, build ${Math.min(...t)}–${Math.max(...t)} ms (sum ${t.reduce((a, b) => a + b, 0)}), ${fails} failed`);
  } finally {
    await browser.close();
  }
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
