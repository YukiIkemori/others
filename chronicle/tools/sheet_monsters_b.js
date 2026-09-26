#!/usr/bin/env node
// Contact sheets for monster sprites part B (art review tool).
//
//   node tools/sheet_monsters_b.js [--out DIR] [--only sheet,context] [--ids a,b,...] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   medium / large   every sprite at 4x (default) on a checker cell, followed by three
//                    palette variants (hue +110, hue -120, hue 40 / sat 0.6 / bri 0.8),
//                    a 1x copy on black and a 1x copy on grass green
//   context_<bg>     full battle screens (256x224 at the game's 4x = 1024x896) drawn by the shared
//                    mock tools/fixtures/mons-base/battle_screen.js with the real R.Gfx windows and
//                    font: backdrop, the lineage stages (mon:<spriteId>: the base with A14a's parts,
//                    falling back to the bare recoloured base) laid out like battle_scene (feet on
//                    GROUND = 130, tall ones sink, §11.4.2), the 4 party windows of DESIGN §11.11.3,
//                    the command list and the enemy names
//   zoom / grid      base sprites only (--only zoom: 3 per row at --scale; grid: 6 per row at 3x)
//   check            prints size / bbox / centring / bottom-row coverage / colour count per
//                    sprite and exits 1 on a size, feet or centring problem
// Loads core + data + art sources (no game boot; data only for the monster names), so it works while
// other systems are mid-edit; page errors from other owners' files are listed but do not fail the run. Prints build time per sprite and any page errors.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const CTX = require('./fixtures/mons-base/node/context');

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
  for (const d of ['data', 'art']) {
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
  return { sheet, times, check };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = sources();
  fs.writeFileSync(path.join(OUT, '_sheet_page.js'), PAGE);
  const pageFile = path.join(OUT, '_sheet.html');
  fs.writeFileSync(path.join(OUT, '_context_page.js'), CTX.PAGE);
  fs.writeFileSync(pageFile, `<!DOCTYPE html><html><head><meta charset="utf-8">${CTX.head()}</head><body>
${src.map((f) => `<script src="file://${f}"></script>`).join('\n')}
${CTX.script()}
<script src="file://${path.join(OUT, '_sheet_page.js')}"></script>
<script src="file://${path.join(OUT, '_context_page.js')}"></script>
</body></html>`);

  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text()); });
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
    // lineage stages where they live (§9.5 regions → §11.2.13 backdrops); '*' = golden; raw base ids
    // (the reserve bases harpy / minotaur) are drawn bare
    const groups = {
      sea: [['crab_1', 'merman_1', 'crab_2'], ['kraken_1', 'merman_3', 'crab_4*'], ['merman_4', 'kraken_3']],
      desert: [['cactus_1', 'sandworm_1', 'cactus_2'], ['cactus_4', 'sandworm_3', 'cactus_3*']],
      snow: [['frostling_1', 'yeti_1', 'frostling_2'], ['frostling_5', 'yeti_3', 'frostling_4*']],
      volcano: [['salamander_1', 'orc_1', 'gargoyle_1'], ['chimera_1', 'salamander_5'], ['orc_3', 'gargoyle_4', 'salamander_2*']],
      mine: [['golem_1', 'golem_2'], ['golem_3', 'golem_1*']],
      tower: [['armor_1', 'darkmage_1', 'armor_2'], ['wyvern_1', 'darkmage_4', 'armor_4*']],
      demon: [['demon_1', 'chimera_3'], ['demon_3', 'paper_4']],
      grass: [['harpy', 'minotaur'], ['paper_3', 'harpy', 'crab_3']],
    };
    const table = CTX.compose();
    const base = (e) => { const id = Array.isArray(e) ? e[0] : e.replace(/\*$/, ''); return table[id] ? table[id][0] : id; };
    const only = (g) => g.map((row) => row.filter((m) => !IDS || IDS.includes(base(m)))).filter((row) => row.length);
    await run(CTX.FONT_READY);
    for (const bg in groups) {
      const g = only(groups[bg]);
      if (g.length) save('context_' + bg, await run(`CONTEXT(${JSON.stringify(bg)}, ${JSON.stringify(g)}, 4, ${JSON.stringify(table)})`));
    }
  }
  const stats = await run(`(() => { const G = RPG.Gfx; return { warned: Object.keys(G._warned), times: SHEET.times }; })()`);
  console.log('build ms:', Object.entries(stats.times).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('missing:', stats.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e.split('\n').slice(0, 3).join(' | '));
  await browser.close();
  if (errors.some((e) => /monsters_[abc]\.js|_sheet_page|_context_page|battle_screen\.js/.test(e) || !/file:\/\//.test(e))) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
