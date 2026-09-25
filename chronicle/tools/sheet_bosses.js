#!/usr/bin/env node
// Contact sheets for the boss sprites (art review tool).
//
//   node tools/sheet_bosses.js [--out DIR] [--only sheet,context,zoom] [--ids a,b,...] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   sheet        every boss at --scale (default 3) on a checker cell, plus a 1x copy
//                on black and on a mid-tone field, with build time and colour count
//   context      each boss alone on its real battle backdrop at the game's 3x scale,
//                placed exactly like battle_scene.js (feet on the ground line, big
//                sprites sink up to 14px) with the three party windows drawn on top,
//                and the white hit-flash / targeted tint the battle applies
//   zoom         base sprites only at --scale (use with --ids for close inspection);
//                --crop x,y,w,h limits it to that sprite-pixel rectangle
// Ids may be given with or without the 'boss_' prefix. Loads only core + data + art
// sources (no game boot), so it works while other systems are mid-edit.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/bosses'));
const ONLY = opt('only', 'sheet,context').split(',');
const SCALE = +opt('scale', 3);
const CROP = opt('crop', '') ? opt('crop', '').split(',').map(Number) : null;
// sprite id → backdrop of the troop that uses it (DESIGN §7.4)
const BOSSES = {
  boss_goblin_chief: 'cave', boss_bandit: 'fort', boss_serpent: 'watercave', boss_sphinx: 'pyramid',
  boss_frost_giant: 'ice', boss_flame_lord: 'volcano', boss_star_guardian: 'tower', boss_general_a: 'demon',
  boss_general_b: 'demon', boss_demon_king: 'throne', boss_demon_king2: 'throne',
};
const IDS = opt('ids', '')
  ? opt('ids', '').split(',').map((s) => (s.startsWith('boss_') ? s : 'boss_' + s))
  : Object.keys(BOSSES);

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
  const times = {};
  function img(id) {
    const t0 = performance.now();
    let v = G.get('mon:' + id);
    if (!(id in times)) times[id] = Math.round(performance.now() - t0);
    return Array.isArray(v) ? v[0] : v;
  }
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
  function colours(im) {
    const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data, set = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) set.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return set.size;
  }
  /** two sprites per row at scale s, each followed by 1x copies */
  function sheet(ids, s) {
    const cols = 2, cw = 128 * s + 150, ch = 112 * s + 26;
    const rows = Math.ceil(ids.length / cols);
    const [cv, c] = canvas(cols * cw + 8, rows * ch + 8);
    ids.forEach((id, k) => {
      const im = img(id);
      const x = 8 + (k % cols) * cw, y = 4 + Math.floor(k / cols) * ch;
      label(c, id + ' ' + im.width + 'x' + im.height + '  ' + times[id] + 'ms  ' + colours(im) + ' colours', x, y);
      cell(c, x, y + 16, im.width * s, im.height * s, s);
      c.drawImage(im, x, y + 16, im.width * s, im.height * s);
      const bx = x + 128 * s + 8;
      c.fillStyle = '#000'; c.fillRect(bx, y + 16, im.width + 8, im.height + 8);
      c.drawImage(im, bx + 4, y + 20);
      c.fillStyle = '#5a6a4a'; c.fillRect(bx, y + 28 + im.height, im.width + 8, im.height + 8);
      if (y + 36 + im.height * 2 <= y + ch + 4) c.drawImage(im, bx + 4, y + 32 + im.height);
    });
    return cv.toDataURL();
  }
  function window_(c, x, y, w, h, s) {
    c.fillStyle = '#000'; c.fillRect((x + 2) * s, y * s, (w - 4) * s, h * s); c.fillRect(x * s, (y + 2) * s, w * s, (h - 4) * s);
    c.fillStyle = '#fff';
    c.fillRect((x + 4) * s, (y + 2) * s, (w - 8) * s, s); c.fillRect((x + 4) * s, (y + h - 3) * s, (w - 8) * s, s);
    c.fillRect((x + 2) * s, (y + 4) * s, s, (h - 8) * s); c.fillRect((x + w - 3) * s, (y + 4) * s, s, (h - 8) * s);
  }
  function tinted(im, color, amt) {
    const [t, tc] = canvas(im.width, im.height, 'rgba(0,0,0,0)');
    tc.clearRect(0, 0, im.width, im.height);
    tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, im.width, im.height);
    const [o, oc] = canvas(im.width, im.height); oc.clearRect(0, 0, im.width, im.height);
    oc.drawImage(im, 0, 0); oc.globalAlpha = amt; oc.drawImage(t, 0, 0);
    return o;
  }
  /** battle-scene placement on the troop's backdrop at 3x (+ hit flash thumbnails) */
  function context(ids, bgs, s) {
    const W = 256, H = 224, GROUND = 130;
    const [cv, c] = canvas(ids.length > 1 ? 2 * (W * s + 6) : W * s, Math.ceil(ids.length / 2) * (H * s + 6), '#000');
    ids.forEach((id, k) => {
      const ox = (k % 2) * (W * s + 6), oy = Math.floor(k / 2) * (H * s + 6);
      c.save(); c.translate(ox, oy);
      c.fillStyle = '#000'; c.fillRect(0, 0, W * s, H * s);
      let b = G.has('bbg:' + bgs[k]) ? G.get('bbg:' + bgs[k]) : null;
      if (Array.isArray(b)) b = b[0];
      if (b) c.drawImage(b, 0, 0, W * s, 144 * s);
      else { c.fillStyle = '#4a4a5a'; c.fillRect(0, 0, W * s, 144 * s); }
      const im = img(id);
      const feet = GROUND + (im.height > 64 ? Math.min(14, Math.round((im.height - 64) / 3)) : 0);
      const x = Math.round(128 - im.width / 2), y = feet - im.height;
      c.drawImage(im, x * s, y * s, im.width * s, im.height * s);
      for (const wx of [6, 88, 170]) window_(c, wx, 6, 80, 44, s);
      window_(c, 8, 150, 240, 68, s);
      label(c, id + ' on bbg:' + bgs[k], 24 * s, 158 * s);
      // hit flash and target tint, 1x, in the message box
      c.drawImage(tinted(im, '#ffffff', 0.9), 24 * s, 170 * s);
      c.drawImage(tinted(im, '#ff4030', 0.6), 24 * s + im.width + 8, 170 * s);
      c.drawImage(tinted(im, '#ffffff', 0.3), 24 * s + (im.width + 8) * 2, 170 * s);
      c.restore();
    });
    return cv.toDataURL();
  }
  function zoom(ids, s, crop) {
    const imgs = ids.map(img);
    if (crop) {
      const [cx, cy, cw, ch] = crop;
      const [cv, c] = canvas(ids.length * (cw * s + 8) + 8, ch * s + 28);
      imgs.forEach((im, k) => {
        const x = 8 + k * (cw * s + 8);
        label(c, ids[k] + ' [' + crop.join(',') + ']', x, 4);
        cell(c, x, 20, cw * s, ch * s, s);
        c.drawImage(im, cx, cy, cw, ch, x, 20, cw * s, ch * s);
      });
      return cv.toDataURL();
    }
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const [cv, c] = canvas(ids.length * (mw * s + 8) + 8, mh * s + 28);
    imgs.forEach((im, k) => {
      const x = 8 + k * (mw * s + 8);
      label(c, ids[k], x, 4);
      cell(c, x, 20, mw * s, mh * s, s);
      c.drawImage(im, x + Math.round((mw - im.width) / 2) * s, 20 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  return { sheet, context, zoom, times };
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
  const ids = JSON.stringify(IDS);
  if (ONLY.includes('sheet')) save('sheet', await run(`SHEET.sheet(${ids}, ${SCALE})`));
  if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${ids}, ${SCALE}, ${JSON.stringify(CROP)})`));
  if (ONLY.includes('context')) {
    for (let i = 0; i < IDS.length; i += 4) {
      const part = IDS.slice(i, i + 4);
      save('context_' + (i / 4 + 1), await run(`SHEET.context(${JSON.stringify(part)}, ${JSON.stringify(part.map((id) => BOSSES[id] || 'cave'))}, 3)`));
    }
  }
  const info = await run(`(() => ({ times: SHEET.times, warned: Object.keys(RPG.Gfx._warned) }))()`);
  console.log('build ms:', Object.entries(info.times).map(([k, v]) => k.replace('boss_', '') + ' ' + v).join(', '));
  console.log('missing:', info.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length || info.warned.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
