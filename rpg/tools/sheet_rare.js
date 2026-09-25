#!/usr/bin/env node
// Contact sheets for the rare-monster sprites (src/art/rare_monsters.js, art review tool).
//
//   node tools/sheet_rare.js [--out DIR] [--only sheet,context,zoom,check] [--ids a,b,...] [--scale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   sheet        every rare sprite at --scale (default 4) on black, then a checker cell,
//                1x copies on black / grey / grass, and the white hit-flash and red
//                target tints the battle applies
//   context_<id> the sprite alone on each backdrop of its region at the game's 3x scale,
//                laid out like battle_scene.js (party windows on top, feet on the
//                ground line y=130, bottom message window); the first frame is the
//                region's main backdrop, the last one shows it beside that region's
//                regular monsters for scale
//   zoom         base sprites at --scale 3 per row (close inspection)
//   check        prints size / bbox / centring / bottom rows / colour count and exits 1 on a
//                size, feet, centring or semi-transparency problem
// Ids may be given with or without the 'rare_' prefix. Loads only core + data + art
// sources (no game boot), so it works while other systems are mid-edit.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/rare'));
const ONLY = opt('only', 'sheet,context,check').split(',');
const SCALE = +opt('scale', 4);
// sprite id → size, backdrops of its region (main first) and regular neighbours for scale
const RARE = {
  rare_hare: { size: 48, bgs: ['grass', 'cave', 'fort'], mates: ['goblin', 'wolf'] },
  rare_lizard: { size: 48, bgs: ['desert', 'forest', 'pyramid'], mates: ['scorpion', 'cactus'] },
  rare_bird: { size: 48, bgs: ['snow', 'ice', 'volcano'], mates: ['frostling', 'harpy'] },
  rare_whale: { size: 64, bgs: ['tower', 'sea', 'grass'], mates: ['darkmage', 'golem'] },
  rare_idol: { size: 48, bgs: ['demon', 'wasteland', 'castle'], mates: ['demon', 'armor'] },
};
const IDS = opt('ids', '')
  ? opt('ids', '').split(',').map((s) => (s.startsWith('rare_') ? s : 'rare_' + s))
  : Object.keys(RARE);

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
  function tinted(im, color, amt) {
    const [t, tc] = canvas(im.width, im.height);
    tc.clearRect(0, 0, im.width, im.height);
    tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, im.width, im.height);
    const [o, oc] = canvas(im.width, im.height); oc.clearRect(0, 0, im.width, im.height);
    oc.drawImage(im, 0, 0); oc.globalAlpha = amt; oc.drawImage(t, 0, 0);
    return o;
  }
  /** one row per sprite: s-x on black, s-x on a checker, then 1x copies and battle tints */
  function sheet(ids, s) {
    const imgs = ids.map(img);
    const mw = 64, mh = 64;
    const cw = mw * s + 12, ch = mh * s + 26;
    const [cv, c] = canvas(2 * cw + 3 * (mw + 12) + 16, ids.length * ch + 8);
    ids.forEach((id, k) => {
      const im = imgs[k];
      const y = 4 + k * ch;
      label(c, id + ' ' + im.width + 'x' + im.height + '  ' + times[id] + 'ms  ' + colours(im) + ' colours', 8, y);
      const ox = 8 + Math.round((mw - im.width) / 2) * s, oy = y + 18 + (mh - im.height) * s;
      c.fillStyle = '#000'; c.fillRect(8, y + 18, mw * s, mh * s);
      c.drawImage(im, ox, oy, im.width * s, im.height * s);
      cell(c, 8 + cw, y + 18, mw * s, mh * s, s);
      c.drawImage(im, ox + cw, oy, im.width * s, im.height * s);
      const bx = 8 + 2 * cw;
      [['#000', 0], ['#5a5a66', 1], ['#4a7a3a', 2]].forEach(([bg, j]) => {
        c.fillStyle = bg; c.fillRect(bx + j * (mw + 12), y + 18, mw + 8, mh + 8);
        c.drawImage(im, bx + j * (mw + 12) + 4 + (mw - im.width) / 2, y + 22 + mh - im.height);
      });
      const ty = y + 18 + mh + 16;
      if (ty + mh <= y + ch) {
        c.fillStyle = '#000'; c.fillRect(bx, ty, 3 * (mw + 12) - 4, mh + 8);
        c.drawImage(tinted(im, '#ffffff', 0.9), bx + 4, ty + 4 + mh - im.height);
        c.drawImage(tinted(im, '#ff4030', 0.6), bx + mw + 16, ty + 4 + mh - im.height);
        c.drawImage(tinted(im, '#ffffff', 0.3), bx + 2 * (mw + 12) + 4, ty + 4 + mh - im.height);
      }
    });
    return cv.toDataURL();
  }
  function window_(c, x, y, w, h, s) {
    c.fillStyle = '#000'; c.fillRect((x + 2) * s, y * s, (w - 4) * s, h * s); c.fillRect(x * s, (y + 2) * s, w * s, (h - 4) * s);
    c.fillStyle = '#fff';
    c.fillRect((x + 4) * s, (y + 2) * s, (w - 8) * s, s); c.fillRect((x + 4) * s, (y + h - 3) * s, (w - 8) * s, s);
    c.fillRect((x + 2) * s, (y + 4) * s, s, (h - 8) * s); c.fillRect((x + w - 3) * s, (y + 4) * s, s, (h - 8) * s);
  }
  /** one battle frame: backdrop, monsters on the ground line (battle_scene layout), windows */
  function frame(c, ox, oy, bg, mons, s, text) {
    const W = 256, H = 224, GROUND = 130;
    c.save(); c.translate(ox, oy);
    c.fillStyle = '#000'; c.fillRect(0, 0, W * s, H * s);
    let b = G.has('bbg:' + bg) ? G.get('bbg:' + bg) : null;
    if (Array.isArray(b)) b = b[0];
    if (b) c.drawImage(b, 0, 0, W * s, 144 * s);
    else { c.fillStyle = '#4a4a5a'; c.fillRect(0, 0, W * s, 144 * s); }
    const imgs = mons.map(img);
    const total = imgs.reduce((a, i) => a + i.width, 0);
    const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
    let x = 128 - (total + gap * (imgs.length - 1)) / 2;
    imgs.forEach((im) => {
      const feet = GROUND + (im.height > 64 ? Math.min(14, Math.round((im.height - 64) / 3)) : 0);
      c.drawImage(im, Math.round(x) * s, (feet - im.height) * s, im.width * s, im.height * s);
      x += im.width + gap;
    });
    for (const wx of [6, 88, 170]) window_(c, wx, 6, 80, 44, s);
    window_(c, 8, 150, 240, 68, s);
    label(c, text, 24 * s, 160 * s);
    c.restore();
  }
  /** 2x2 frames: each region backdrop, then the main one with regular neighbours */
  function context(id, bgs, mates, s) {
    const W = 256 * s + 6, H = 224 * s + 6;
    const [cv, c] = canvas(2 * W, 2 * H, '#000');
    const list = bgs.map((bg) => [bg, [id]]).concat([[bgs[0], [mates[0], id, mates[1]]]]);
    list.slice(0, 4).forEach(([bg, mons], k) => frame(c, (k % 2) * W, Math.floor(k / 2) * H, bg, mons, s, id + ' on bbg:' + bg));
    return cv.toDataURL();
  }
  function zoom(ids, s) {
    const imgs = ids.map(img);
    const per = 3, mw = 64, mh = 64;
    const [cv, c] = canvas(per * (mw * s + 8) + 8, Math.ceil(ids.length / per) * (mh * s + 24) + 4, '#000');
    imgs.forEach((im, k) => {
      const x = 8 + (k % per) * (mw * s + 8), y = 4 + Math.floor(k / per) * (mh * s + 24);
      label(c, ids[k], x, y);
      cell(c, x, y + 18, mw * s, mh * s, s);
      c.drawImage(im, x + Math.round((mw - im.width) / 2) * s, y + 18 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  /** QA numbers per sprite: size, opaque bbox, bottom-row coverage, colour count */
  function check(ids) {
    return ids.map((id) => {
      const im = img(id), w = im.width, h = im.height;
      const d = im.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, bottom = 0, above = 0, semi = 0;
      const cols = new Set();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = d[(y * w + x) * 4 + 3];
        if (!a) continue;
        if (a < 255) semi++;
        cols.add(d[(y * w + x) * 4] << 16 | d[(y * w + x) * 4 + 1] << 8 | d[(y * w + x) * 4 + 2]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (y === h - 1) bottom++;
        if (y === h - 2) above++;
      }
      return { id, w, h, bbox: [x0, y0, x1, y1], centre: (x0 + x1 + 1) / 2 - w / 2, bottom, above, colours: cols.size, semi };
    });
  }
  return { sheet, context, zoom, check, times };
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
  if (ONLY.includes('check')) {
    const rows = await run(`SHEET.check(${ids})`);
    for (const r of rows) {
      const probs = [];
      const want = RARE[r.id] ? RARE[r.id].size : null;
      if (r.w !== want || r.h !== want) probs.push('size ' + r.w + 'x' + r.h + ' != ' + want);
      if (r.bbox[3] !== r.h - 1 || r.bottom < 3 || r.above < 3) probs.push('feet not on the bottom rows');
      if (r.bbox[0] < 0 || r.bbox[1] < 0) probs.push('touches the edge');
      if (Math.abs(r.centre) > 2) probs.push('off-centre by ' + r.centre);
      if (r.semi) probs.push(r.semi + ' semi-transparent px');
      if (probs.length) process.exitCode = 1;
      console.log(r.id.padEnd(12), (r.w + 'x' + r.h).padEnd(6), 'bbox', JSON.stringify(r.bbox).padEnd(16), 'centre', String(r.centre).padEnd(5),
        'bottom', String(r.bottom).padEnd(3), 'colours', r.colours, probs.length ? '  <-- ' + probs.join('; ') : '');
    }
  }
  if (ONLY.includes('sheet')) save('sheet', await run(`SHEET.sheet(${ids}, ${SCALE})`));
  if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${ids}, ${SCALE === 4 ? 5 : SCALE})`));
  if (ONLY.includes('context')) {
    for (const id of IDS) {
      const r = RARE[id];
      if (!r) continue;
      save('context_' + id.replace('rare_', ''), await run(`SHEET.context(${JSON.stringify(id)}, ${JSON.stringify(r.bgs)}, ${JSON.stringify(r.mates)}, 3)`));
    }
  }
  const info = await run(`(() => ({ times: SHEET.times, warned: Object.keys(RPG.Gfx._warned || {}) }))()`);
  console.log('build ms:', Object.entries(info.times).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('missing:', info.warned.join(' ') || '-');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length || info.warned.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
