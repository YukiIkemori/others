#!/usr/bin/env node
// Contact sheets for monster sprites part A (art review tool).
//
//   node tools/sheet_monsters_a.js [--out DIR] [--only sheet,context] [--ids a,b,...] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   small / medium   every sprite at 4x (default) on a checker cell, followed by three
//                    palette variants (hue +110, hue -120, hue 40 / sat 0.6 / bri 0.8)
//                    and a 1x copy on black
//   zoom             (--only zoom --ids a,b) base sprites only at --scale, for close inspection
//   context_<bg>     full battle screens (256x224 at the game's 4x = 1024x896) drawn by the shared
//                    mock tools/fixtures/mons-base/battle_screen.js with the real R.Gfx windows and
//                    font: backdrop, the lineage stages (mon:<spriteId>: the base with A14a's parts,
//                    falling back to the bare recoloured base) laid out like battle_scene (feet on
//                    GROUND = 130, tall ones sink, §11.4.2), the 4 party windows of DESIGN §11.11.3,
//                    the command list and the enemy names
// Loads core + data + art sources (no game boot; data only for the monster names), so it works while
// other systems are mid-edit; page errors from other owners' files are listed but do not fail the run.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const CTX = require('./fixtures/mons-base/node/context');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/monsters_a'));
const ONLY = opt('only', 'sheet,context').split(',');
const SCALE = +opt('scale', 4);
const SMALL = ['jelly', 'bat', 'rat', 'mushroom', 'bee', 'wisp', 'imp', 'mimic', 'eyeball'];
const MEDIUM = ['goblin', 'snake', 'wolf', 'plant', 'skeleton', 'ghost', 'lizardman', 'scorpion', 'mummy'];
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
  /** one row per sprite: base + variants at scale s, then 1x on black */
  function sheet(ids, s, variants) {
    const imgs = ids.map((id) => G.get('mon:' + id));
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const cw = mw * s + 8, ch = mh * s + 22;
    const n = 1 + variants.length;
    const [cv, c] = canvas(n * cw + mw * 2 + 40, ids.length * ch + 8);
    ids.forEach((id, r) => {
      const y = r * ch + 4;
      const list = [G.get('mon:' + id)].concat(variants.map((v) => G.variant('mon:' + id, v)));
      list.forEach((img, k) => {
        const x = 8 + k * cw;
        label(c, k ? JSON.stringify(variants[k - 1]) : id + ' ' + img.width + 'x' + img.height, x, y);
        cell(c, x, y + 16, mw * s, mh * s, s);
        c.drawImage(img, x + (mw - img.width) * s / 2, y + 16 + (mh - img.height) * s, img.width * s, img.height * s);
      });
      const x = 8 + n * cw;
      c.fillStyle = '#000'; c.fillRect(x, y + 16, mw + 8, mh + 8);
      c.drawImage(list[0], x + 4, y + 20);
      c.fillStyle = '#4a7a3a'; c.fillRect(x, y + 16 + mh + 12, mw + 8, mh + 8);
      if (y + 16 + mh + 12 + mh + 8 < y + ch) c.drawImage(list[0], x + 4, y + 20 + mh + 12);
    });
    return cv.toDataURL();
  }
  /** base sprites only, large, side by side (close inspection) */
  function zoom(ids, s) {
    const imgs = ids.map((id) => G.get('mon:' + id));
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const [cv, c] = canvas(ids.length * (mw * s + 8) + 8, mh * s + 28);
    imgs.forEach((img, k) => {
      const x = 8 + k * (mw * s + 8);
      label(c, ids[k], x, 4);
      cell(c, x, 20, mw * s, mh * s, s);
      c.drawImage(img, x + (mw - img.width) * s / 2, 20 + (mh - img.height) * s, img.width * s, img.height * s);
    });
    return cv.toDataURL();
  }
  return { sheet, zoom };
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
  const t0 = Date.now();
  const small = IDS ? IDS.filter((i) => SMALL.includes(i)) : SMALL;
  const medium = IDS ? IDS.filter((i) => MEDIUM.includes(i)) : MEDIUM;
  const V = JSON.stringify(VARIANTS);
  if (ONLY.includes('sheet')) {
    if (small.length) save('small', await run(`SHEET.sheet(${JSON.stringify(small)}, ${SCALE}, ${V})`));
    if (medium.length) save('medium', await run(`SHEET.sheet(${JSON.stringify(medium)}, ${SCALE}, ${V})`));
  }
  if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${JSON.stringify(IDS || SMALL)}, ${SCALE})`));
  if (ONLY.includes('context')) {
    // lineage stages where they live (§9.5 regions → §11.2.13 backdrops); '*' = golden
    const groups = {
      grass: [['jelly_1', 'rat_1', 'bat_1', 'jelly_2'], ['mimic_1', 'jelly_4', 'rat_4', 'bat_5*']],
      forest: [['bee_1', 'mushroom_1', 'plant_1', 'bee_2'], ['plant_5', 'mushroom_4', 'bee_5']],
      swamp: [['wisp_1', 'ghost_1', 'lizardman_1'], ['ghost_5', 'lizardman_4', 'wisp_3*']],
      snow: [['wolf_1', 'wolf_2', 'wolf_1'], ['wolf_5', 'wolf_3*']],
      mine: [['goblin_1', 'goblin_2', 'goblin_3'], ['goblin_4', 'goblin_5', 'goblin_1*']],
      desert: [['scorpion_1', 'snake_1', 'mummy_1'], ['mummy_5', 'snake_4', 'scorpion_5*']],
      sea: [['skeleton_1', 'skeleton_2', 'skeleton_3'], ['skeleton_5', 'skeleton_4', 'skeleton_1*']],
      volcano: [['imp_1', 'imp_2', 'imp_3'], ['imp_5', 'paper_1', 'imp_4*']],
      tower: [['eyeball_1', 'eyeball_2', 'eyeball_3'], ['eyeball_5', 'eyeball_4', 'mimic_4*']],
      cave: [['quicksilver_1', 'platinum_1', 'quicksilver_2'], ['paper_2', 'mimic_2', 'platinum_2']],
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
  const stats = await run(`(() => { const G = RPG.Gfx; return { warned: Object.keys(G._warned) }; })()`);
  console.log('built in', Date.now() - t0, 'ms; missing:', stats.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e.split('\n').slice(0, 3).join(' | '));
  await browser.close();
  if (errors.some((e) => /monsters_[abc]\.js|_sheet_page|_context_page|battle_screen\.js/.test(e) || !/file:\/\//.test(e))) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
