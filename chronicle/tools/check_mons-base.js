#!/usr/bin/env node
// Pixel checks for area A14b mons-base: all 50 monster base sprites (36 Crest bases of
// §9.4.1 in monsters_a/b.js + the 14 new bases of §9.4.2 in monsters_c.js) in headless
// Chromium, plus every palette step the lineage compose tables use on them (§9.4.6 mobs,
// §9.11.6 bosses, parsed from DESIGN.md) and the golden tint (§9.8).
//
//   node tools/check_mons-base.js [--ids a,b] [--update-hashes] [--verbose]
//
// Per base (exit 1 on any failure):
//   C1 canvas size = the size in R.Art.monstersA/B/C (32/48/64)
//   C2 opaque pixels only (§11.4.2)
//   C3 feet: a standing base has ≥ 4 outline px on row H-1 (lowest body row H-2);
//      a floating base hovers at most 8 px up (and matches anchors.float for the new ones)
//   C4 centred: bbox centre within ±3 px of the canvas centre
//   C5 outline: ≥ 90 % of the silhouette's outer edge (canvas border, enclosed holes and
//      1-px tips/hairlines excluded) is darker than luminance 0.09 (§11.4.2)
//   C6 10–72 colours
//   C7 value structure: interior luminance spread p5..p95 ≥ 0.40 for the base; every lineage
//      recolour keeps ≥ 65 % of it (after its own bri scaling) and ≥ 0.20 absolute, so the
//      forms read by value, not by hue
//   C8 the outline survives every lineage recolour and the golden tint (C5 with luminance
//      < 0.13: a desaturated, brightened #120c16 is ~0.10 and still reads as outline)
//   C9 new bases: anchor points sit on the sprite (eyes, body, mouth on opaque pixels; hand, hand2,
//      neck, back, brow, tail within 2 px of one; head within 2 px of the silhouette top in its
//      column, feet within 1 px of the bottom)
//   C10 build time ≤ 150 ms per base (typical 2–15 ms; the limit only catches runaway factories
//       on a busy shared machine)
//   C11 Crest bases unchanged: canvas hash equals tools/fixtures/mons-base/hashes.json
//       (--update-hashes rewrites it after a deliberate touch-up)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const IDS = opt('ids', '') ? opt('ids', '').split(',') : null;
const VERBOSE = args.includes('--verbose');
const HASHES = path.join(ROOT, 'tools/fixtures/mons-base/hashes.json');

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  return ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f))
    .concat(walk(path.join(ROOT, 'src/art')).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
}
/** lineage recolours per base, from the compose tables in DESIGN.md */
function recolours() {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const out = {};
  for (const m of md.matchAll(/^\s+([a-z0-9_]+): \['([a-z_]+)', (\{[^}]*\}), \[/gm)) {
    const hsb = Function('return (' + m[3] + ')')();
    if (!Object.keys(hsb).length) continue;
    const k = JSON.stringify(hsb);
    (out[m[2]] = out[m[2]] || {})[k] = hsb;
  }
  for (const b in out) out[b] = Object.values(out[b]);
  return out;
}

const PAGE = String.raw`
const HEAD_UNDER = ['beetle', 'spider'];
window.CHECK = function (ids, variants) {
  const R = window.RPG, G = R.Gfx, A = R.Art;
  const sizes = Object.assign({}, A.monstersA.sizes, A.monstersB.sizes, A.monstersC.sizes);
  const AN = A.monstersC.anchors;
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  function measure(img, darkBelow) {
    darkBelow = darkBelow || 0.09;
    const w = img.width, h = img.height, d = img.getContext('2d').getImageData(0, 0, w, h).data;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    const outside = new Uint8Array(w * h), st = [];
    for (let x = 0; x < w; x++) st.push(x, 0, x, h - 1);
    for (let y = 0; y < h; y++) st.push(0, y, w - 1, y);
    while (st.length) {
      const y = st.pop(), x = st.pop();
      if (x < 0 || y < 0 || x >= w || y >= h || outside[y * w + x] || at(x, y)) continue;
      outside[y * w + x] = 1; st.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    const out = (x, y) => x >= 0 && y >= 0 && x < w && y < h && outside[y * w + x];
    let x0 = w, y0 = h, x1 = -1, y1 = -1, bottom = 0, semi = 0, edge = 0, dark = 0;
    const cols = new Set(), L = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3];
      if (!a) continue;
      if (a < 255) semi++;
      cols.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
      const l = lum(d[i], d[i + 1], d[i + 2]);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (y === h - 1) bottom++;
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      // silhouette edge toward the outside; 1-px tips and hairlines (whiskers, sparks, drawn
      // after the outline in the Crest style) are not outline: count only pixels in a 2x2 block
      const blk = [[-1, -1], [0, -1], [-1, 0], [0, 0]].some(([ox, oy]) => at(x + ox, y + oy) && at(x + ox + 1, y + oy) && at(x + ox, y + oy + 1) && at(x + ox + 1, y + oy + 1));
      if (!border && blk && (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1))) { edge++; if (l < darkBelow) dark++; }
      else if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) L.push(l);
    }
    L.sort((a, b) => a - b);
    const q = (t) => L[Math.min(L.length - 1, Math.floor(t * L.length))] || 0;
    let hash = 0x811c9dc5;
    for (let i = 0; i < d.length; i++) { hash ^= d[i]; hash = Math.imul(hash, 16777619) >>> 0; }
    return { w, h, bbox: [x0, y0, x1, y1], bottom, semi, colours: cols.size, outline: dark / Math.max(1, edge), value: q(0.95) - q(0.05), hash: hash.toString(16), at, top: (x) => { for (let y = 0; y < h; y++) if (at(x, y)) return y; return -1; } };
  }
  return ids.map((id) => {
    const t0 = performance.now();
    const img = G.get('mon:' + id);
    const ms = performance.now() - t0;
    const m = measure(img);
    // recolours: the outline must stay near-black (a desaturated, brightened #120c16 lands
    // around luminance 0.10, still an outline); value is compared to the base's
    const vs = (variants[id] || []).map((v) => { const r = measure(G.variant('mon:' + id, v), 0.13); return { v, value: r.value, rel: r.value / Math.max(0.01, m.value * Math.min(1, v.bri == null ? 1 : v.bri)), outline: r.outline }; });
    const gold = measure(G.variant('mon:' + id, { tint: '#ffd24a' }), 0.13);
    const res = { id, size: sizes[id], ms: Math.round(ms), w: m.w, h: m.h, bbox: m.bbox, bottom: m.bottom, semi: m.semi, colours: m.colours,
      outline: +m.outline.toFixed(3), value: +m.value.toFixed(2), hash: m.hash, variants: vs, gold: +gold.outline.toFixed(3), anchor: [] };
    const a = AN[id];
    if (a) {
      res.float = !!a.float;
      for (const [k, p] of [['body', a.body], ['mouth', a.mouth]].concat(a.eyes.map((e, i) => ['eye' + i, e])))
        if (!m.at(p[0], p[1])) res.anchor.push(k + ' ' + p + ' off the sprite');
      // the beetle's horn and the spider's abdomen rise above their heads
      const top = HEAD_UNDER.includes(id) ? a.head[1] - 1 : m.top(a.head[0]);
      if (top < 0 || Math.abs(top + 1 - a.head[1]) > 2) res.anchor.push('head ' + a.head + ' vs silhouette top ' + (top + 1));
      if (Math.abs(a.feet[1] - (m.bbox[3] - 1)) > 1) res.anchor.push('feet ' + a.feet + ' vs bottom ' + (m.bbox[3] - 1));
      // weapons, shields, bells and capes hang on these: within 2 px of the sprite
      const near = (p) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m.at(p[0] + dx, p[1] + dy)) return true; return false; };
      for (const k of ['hand', 'hand2', 'neck', 'back', 'brow', 'tail']) if (!near(a[k])) res.anchor.push(k + ' ' + a[k] + ' more than 2 px off the sprite');
    }
    return res;
  });
};
`;

async function main() {
  const OUT = fs.mkdtempSync(path.join(require('os').tmpdir(), 'check_mons_base_'));
  fs.writeFileSync(path.join(OUT, 'page.js'), PAGE);
  const pageFile = path.join(OUT, 'page.html');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${sources().map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, 'page.js')}"></script></body></html>`);
  const variants = recolours();
  const browser = await playwright.chromium.launch();
  let rows, pageErrors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e.stack || e)));
    await page.goto('file://' + pageFile);
    const ids = IDS || await page.evaluate(() => RPG.Art.monstersA.ids.concat(RPG.Art.monstersB.ids, RPG.Art.monstersC.ids));
    rows = await page.evaluate(([ids, v]) => CHECK(ids, v), [ids, variants]);
  } finally {
    await browser.close();
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  const mine = pageErrors.filter((e) => /monsters_[abc]\.js|page\.js/.test(e));
  const NEW = new Set(['beetle', 'fairy', 'book', 'crystal', 'frog', 'doll', 'seabird', 'mole', 'automaton', 'scribe', 'owl', 'spider', 'treant', 'mammoth']);
  const hashes = fs.existsSync(HASHES) ? JSON.parse(fs.readFileSync(HASHES, 'utf8')) : {};
  if (args.includes('--update-hashes')) {
    const h = {};
    for (const r of rows) if (!NEW.has(r.id)) h[r.id] = r.hash;
    fs.mkdirSync(path.dirname(HASHES), { recursive: true });
    fs.writeFileSync(HASHES, JSON.stringify(h, null, 1) + '\n');
    console.log('hashes →', path.relative(ROOT, HASHES));
    Object.assign(hashes, h);
  }
  let bad = 0, nVar = 0, minVal = 9, minVarVal = 9, minOut = 9, minRel = 9;
  for (const r of rows) {
    const p = [];
    const float = r.bbox[3] < r.h - 1;
    if (r.w !== r.size || r.h !== r.size) p.push(`C1 size ${r.w}x${r.h} != ${r.size}`);
    if (r.semi) p.push(`C2 ${r.semi} semi-transparent px`);
    if (!float && r.bottom < (NEW.has(r.id) ? 4 : 1)) p.push('C3 feet not on the bottom row');
    if (float && r.bbox[3] < r.h - 9) p.push(`C3 floats ${r.h - 1 - r.bbox[3]} px`);
    if (NEW.has(r.id) && float !== r.float) p.push(`C3 anchors.float=${r.float} but sprite ${float ? 'floats' : 'stands'}`);
    const ctr = (r.bbox[0] + r.bbox[2] + 1) / 2 - r.w / 2;
    if (Math.abs(ctr) > 3) p.push('C4 off-centre ' + ctr);
    if (r.outline < 0.9) p.push('C5 outline ' + r.outline);
    if (r.colours < 6 || r.colours > 72) p.push('C6 colours ' + r.colours);
    if (r.value < 0.4) p.push('C7 value ' + r.value);
    for (const v of r.variants) {
      nVar++; minVarVal = Math.min(minVarVal, v.value);
      minRel = Math.min(minRel, v.rel);
      if (v.value < 0.2 || v.rel < 0.65) p.push('C7 value ' + v.value.toFixed(2) + ' (x' + v.rel.toFixed(2) + ') at ' + JSON.stringify(v.v));
      if (v.outline < 0.9) p.push('C8 outline ' + v.outline.toFixed(3) + ' at ' + JSON.stringify(v.v));
    }
    if (r.gold < 0.9) p.push('C8 outline under the golden tint ' + r.gold);
    for (const a of r.anchor) p.push('C9 ' + a);
    if (r.ms > 150) p.push('C10 build ' + r.ms + ' ms');
    if (!NEW.has(r.id) && hashes[r.id] && hashes[r.id] !== r.hash) p.push('C11 Crest base changed (hash ' + r.hash + ' != ' + hashes[r.id] + ')');
    if (!NEW.has(r.id) && !hashes[r.id]) p.push('C11 no reference hash (run --update-hashes)');
    minVal = Math.min(minVal, r.value); minOut = Math.min(minOut, r.outline);
    if (p.length) bad++;
    if (p.length || VERBOSE) console.log((r.id + (NEW.has(r.id) ? '*' : '')).padEnd(12), String(r.size).padEnd(3), 'cols', String(r.colours).padEnd(3), 'outl', r.outline.toFixed(3), 'val', r.value.toFixed(2), 'vars', r.variants.length, 'ms', r.ms, p.length ? ' <-- ' + p.join('; ') : '');
  }
  for (const e of mine) { console.log('[page]', e); bad++; }
  console.log(`check_mons-base: ${rows.length} bases, ${nVar} lineage recolours + ${rows.length} golden; ${rows.length - bad} ok, ${bad} failing` +
    ` (min value ${minVal.toFixed(2)}, min recolour value ${minVarVal.toFixed(2)} / kept x${minRel.toFixed(2)}, min outline ${minOut.toFixed(3)})`);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
