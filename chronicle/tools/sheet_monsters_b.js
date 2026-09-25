#!/usr/bin/env node
// Contact sheets for monster sprites part B (art review tool).
//
//   node tools/sheet_monsters_b.js [--out DIR] [--only sheet,context] [--ids a,b,...] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   medium / large   every sprite at 4x (default) on a checker cell, followed by three
//                    palette variants (hue +110, hue -120, hue 40 / sat 0.6 / bri 0.8),
//                    a 1x copy on black and a 1x copy on grass green
//   context_<bg>     full battle screens (256x224 at the game's 4x = 1024x896): backdrop,
//                    sprites laid out like the battle scene (feet on GROUND = 130), the 4 party
//                    windows of DESIGN §11.11.3 and the command box
//   zoom / grid      base sprites only (--only zoom: 3 per row at --scale; grid: 6 per row at 3x)
//   check            prints size / bbox / centring / bottom-row coverage / colour count per
//                    sprite and exits 1 on a size, feet or centring problem
// Loads only core + art sources (no data, no game boot), so it works while other
// systems are mid-edit; page errors from other owners' files are listed but do not fail the run. Prints build time per sprite and any page errors.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/monsters_b'));
const ONLY = opt('only', 'sheet,context').split(',');
const SCALE = +opt('scale', 4);
const MEDIUM = ['crab', 'merman', 'harpy', 'darkmage', 'armor', 'gargoyle', 'salamander', 'cactus', 'frostling'];
const LARGE = ['orc', 'golem', 'wyvern', 'chimera', 'yeti', 'kraken', 'demon', 'sandworm', 'minotaur'];
const IDS = opt('ids', '') ? opt('ids', '').split(',') : null;
const VARIANTS = [{ hue: 110 }, { hue: -120 }, { hue: 40, sat: 0.6, bri: 0.8 }];

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  return list;
}

// ---------------------------------------------------------------- page code
const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#3a3a48'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col) {
    c.font = '12px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
  }
  function cell(c, x, y, w, h, s) {
    for (let j = 0; j < h; j += 4 * s) for (let i = 0; i < w; i += 4 * s) {
      c.fillStyle = ((i + j) / (4 * s)) % 2 ? '#8ea4b8' : '#9cb2c4';
      c.fillRect(x + i, y + j, Math.min(4 * s, w - i), Math.min(4 * s, h - j));
    }
  }
  const times = {};
  function build(id) {
    const t = performance.now();
    const img = G.get('mon:' + id);
    times[id] = Math.round(performance.now() - t);
    return img;
  }
  /** one row per sprite: base + variants at scale s, then 1x on black and on green */
  function sheet(ids, s, variants, cols) {
    const imgs = ids.map(build);
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const cw = mw * s + 8, ch = mh * s + 22;
    const n = cols ? 1 : 1 + variants.length;
    const per = cols || 1;
    const rows = Math.ceil(ids.length / per);
    const [cv, c] = canvas(per * (n * cw + (cols ? 0 : mw + 16)) + 8, rows * ch + 8);
    ids.forEach((id, r) => {
      const col = r % per, row = Math.floor(r / per);
      const ox = col * (n * cw + (cols ? 0 : mw + 16));
      const y = row * ch + 4;
      const list = [imgs[r]].concat(cols ? [] : variants.map((v) => G.variant('mon:' + id, v)));
      list.forEach((img, k) => {
        const x = ox + 8 + k * cw;
        label(c, k ? JSON.stringify(variants[k - 1]) : id + ' ' + img.width + 'x' + img.height, x, y);
        cell(c, x, y + 16, mw * s, mh * s, s);
        c.drawImage(img, x + (mw - img.width) * s / 2, y + 16 + (mh - img.height) * s, img.width * s, img.height * s);
      });
      if (cols) return;
      const x = ox + 8 + n * cw;
      c.fillStyle = '#000'; c.fillRect(x, y + 16, mw + 8, mh + 8);
      c.drawImage(list[0], x + 4 + (mw - list[0].width) / 2, y + 20 + mh - list[0].height);
      const y2 = y + 16 + mh + 12;
      if (y2 + mh + 8 <= y + ch) {
        c.fillStyle = '#4a7a3a'; c.fillRect(x, y2, mw + 8, mh + 8);
        c.drawImage(list[0], x + 4 + (mw - list[0].width) / 2, y2 + 4 + mh - list[0].height);
      }
    });
    return cv.toDataURL();
  }
  // ---- the battle screen of §11.5.1 / §11.11.3: 256x224, 4 party windows, command box
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, BOX = { x: 8, y: 150, w: 240, h: 68 }, GROUND = 130;
  function win(c, x, y, w, h, s) {
    c.fillStyle = '#f0e8d0'; c.fillRect(x * s, y * s, w * s, h * s);
    c.fillStyle = '#0b1024'; c.fillRect((x + 1) * s, (y + 1) * s, (w - 2) * s, (h - 2) * s);
    c.fillStyle = '#16203e'; c.fillRect((x + 2) * s, (y + 2) * s, (w - 4) * s, (h - 4) * s);
  }
  /** battle-scene layout on a backdrop at scale s (the game draws at 4x): feet on GROUND,
   *  sprites taller than 64 sink (§11.4.2), the 4 party windows and the command box on top */
  function context(bg, groups, s) {
    const names = ['Arun', 'Brigi', 'Marta', 'Sylva'];
    const [cv, c] = canvas(256 * s, groups.length * (224 * s + 8), '#000');
    groups.forEach((g, gi) => {
      const oy = gi * (224 * s + 8);
      c.fillStyle = '#000'; c.fillRect(0, oy, 256 * s, 224 * s);
      let b = G.has('bbg:' + bg) ? G.get('bbg:' + bg) : null;
      if (Array.isArray(b)) b = b[0];
      if (b) c.drawImage(b, 0, oy, 256 * s, 144 * s);
      else { c.fillStyle = '#5a8a4a'; c.fillRect(0, oy, 256 * s, 144 * s); }
      const imgs = g.map((m) => (typeof m === 'string' ? G.get('mon:' + m) : G.variant('mon:' + m[0], m[1])));
      const total = imgs.reduce((a, i) => a + i.width, 0);
      const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
      let x = 128 - (total + gap * (imgs.length - 1)) / 2;
      imgs.forEach((img) => {
        const feet = GROUND + Math.max(0, Math.min(20, Math.round((img.height - 64) / 2.4)));
        c.drawImage(img, Math.round(x) * s, oy + (feet - img.height) * s, img.width * s, img.height * s);
        x += img.width + gap;
      });
      c.save(); c.translate(0, oy);
      WIN.xs.forEach((wx, i) => {
        win(c, wx, WIN.y, WIN.w, WIN.h, s);
        c.font = (8 * s) + 'px monospace'; c.textBaseline = 'top';
        c.fillStyle = '#f0e8d0'; c.fillText(names[i], (wx + 5) * s, (WIN.y + 4) * s);
        c.fillStyle = '#b0e8a0'; c.fillText('HP 123', (wx + 5) * s, (WIN.y + 16) * s);
        c.fillStyle = '#a0c8ff'; c.fillText('MP  45', (wx + 5) * s, (WIN.y + 26) * s);
        c.fillStyle = '#ffd890'; c.fillText('WP  12', (wx + 5) * s, (WIN.y + 36) * s);
      });
      win(c, BOX.x, BOX.y, BOX.w, BOX.h, s);
      c.restore();
    });
    return cv.toDataURL();
  }
  /** QA numbers per sprite: size, opaque bbox, bottom-row coverage, colour count */
  function check(ids, sizes) {
    return ids.map((id) => {
      const img = build(id), w = img.width, h = img.height;
      const d = img.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, bottom = 0, semi = 0;
      const cols = new Set();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3];
        if (!a) continue;
        if (a < 255) semi++;
        cols.add(d[(y * w + x) * 4] << 16 | d[(y * w + x) * 4 + 1] << 8 | d[(y * w + x) * 4 + 2]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (y === h - 1) bottom++;
      }
      return { id, w, h, want: sizes[id], bbox: [x0, y0, x1, y1], centre: (x0 + x1 + 1) / 2 - w / 2, bottom, colours: cols.size, semi };
    });
  }
  return { sheet, context, times, check };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const pageFile = path.join(OUT, '_sheet.html');
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
</body></html>`);

  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + pageFile);
  await page.waitForTimeout(200);
  const save = (name, url) => {
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('sheet →', f);
  };
  const run = (js) => page.evaluate(js);
  const medium = IDS ? IDS.filter((i) => MEDIUM.includes(i)) : MEDIUM;
  const large = IDS ? IDS.filter((i) => LARGE.includes(i)) : LARGE;
  const V = JSON.stringify(VARIANTS);
  if (ONLY.includes('sheet')) {
    if (medium.length) save('medium', await run(`SHEET.sheet(${JSON.stringify(medium)}, ${SCALE}, ${V})`));
    if (large.length) save('large', await run(`SHEET.sheet(${JSON.stringify(large)}, ${SCALE}, ${V})`));
  }
  if (ONLY.includes('zoom')) {
    // base sprites only, 3 per row at --scale (close inspection)
    const all = medium.concat(large);
    if (all.length) save('zoom', await run(`SHEET.sheet(${JSON.stringify(all)}, ${SCALE}, [], 3)`));
  }
  if (ONLY.includes('grid')) {
    // all base sprites side by side at 3x (quick overview)
    const all = medium.concat(large);
    if (all.length) save('grid', await run(`SHEET.sheet(${JSON.stringify(all)}, 3, [], 6)`));
  }
  if (ONLY.includes('check')) {
    const all = medium.concat(large);
    const rows = await run(`SHEET.check(${JSON.stringify(all)}, RPG.Art.monstersB.sizes)`);
    let bad = 0;
    for (const r of rows) {
      const probs = [];
      if (r.w !== r.want || r.h !== r.want) probs.push('size ' + r.w + 'x' + r.h + ' != ' + r.want);
      if (r.bbox[3] !== r.h - 1 || r.bottom < 4) probs.push('feet not on the bottom row');
      if (Math.abs(r.centre) > 3) probs.push('off-centre by ' + r.centre);
      if (r.semi) probs.push(r.semi + ' semi-transparent px');
      if (probs.length) bad++;
      console.log(r.id.padEnd(11), (r.w + 'x' + r.h).padEnd(6), 'bbox', JSON.stringify(r.bbox).padEnd(16), 'centre', String(r.centre).padEnd(5), 'bottom', String(r.bottom).padEnd(3), 'colours', r.colours, probs.length ? '  <-- ' + probs.join('; ') : '');
    }
    if (bad) process.exitCode = 1;
  }
  if (ONLY.includes('context')) {
    const groups = {
      sea: [['crab', 'merman', 'crab'], ['kraken', ['merman', { hue: -120 }]]],
      desert: [['cactus', 'sandworm', 'salamander'], [['cactus', { hue: 40, sat: 0.6, bri: 0.8 }], ['sandworm', { hue: 110 }]]],
      snow: [['frostling', 'yeti', 'frostling'], [['harpy', { hue: -120 }], ['wyvern', { hue: 110 }]]],
      castle: [['armor', 'darkmage', 'gargoyle'], ['minotaur', 'orc']],
      demon: [['demon', 'chimera'], ['golem', ['darkmage', { hue: 110 }], ['armor', { hue: -120 }]]],
      grass: [['orc', 'harpy', ['crab', { hue: 110 }]], ['wyvern', 'minotaur']],
    };
    const only = (g) => g.map((row) => row.filter((m) => !IDS || IDS.includes(typeof m === 'string' ? m : m[0]))).filter((row) => row.length);
    for (const bg in groups) {
      const g = only(groups[bg]);
      if (g.length) save('context_' + bg, await run(`SHEET.context(${JSON.stringify(bg)}, ${JSON.stringify(g)}, 4)`));
    }
  }
  const stats = await run(`(() => { const G = RPG.Gfx; return { warned: Object.keys(G._warned), times: SHEET.times }; })()`);
  console.log('build ms:', Object.entries(stats.times).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('missing:', stats.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e.split('\n').slice(0, 3).join(' | '));
  await browser.close();
  if (errors.some((e) => /monsters_[abc]\.js|_sheet_page/.test(e) || !/file:\/\//.test(e))) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
