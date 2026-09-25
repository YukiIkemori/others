#!/usr/bin/env node
// Contact sheets for monster base sprites part C (the 14 new bases of DESIGN §9.4.2).
//
//   node tools/sheet_monsters_c.js [--out DIR] [--only sheet,context,...] [--ids a,b,...] [--scale N]
//
// Modes (PNG, nearest-neighbour upscaled):
//   sheet            (default) one row per base: the base at --scale (4), then every palette
//                    variant the lineage table actually uses (§9.4.6: stages 2..5, the doll
//                    band bosses of §9.11.6) and the golden tint (§9.8), then 1x on black and
//                    on grass green. Variant labels are the {hue,sat,bri} of the stage.
//   hue              generic stress variants (hue ±60/±120/180, sat 0.25, bri 0.6/1.3)
//   zoom             bases only, 4 per row at --scale (close inspection)
//   grid             bases only, 7 per row at 3x (overview)
//   anchors          bases at 6x with the R.Art.monstersC.anchors points drawn on top
//   context_<bg>     full battle screens (256x224 at 4x = 1024x896, like the game) with the
//                    4 party windows of §11.11.3 (WIN xs 3/66/129/192, y 5, 61x46), the
//                    command box, and the sprites standing on GROUND = 130 (§11.4.2 layout)
//   check            prints per base: size, opaque bbox, centring, bottom-row coverage,
//                    colour count, semi-transparent pixels, outline colour share, headroom
//                    above the head anchor, value range; exits 1 on a problem
// Loads only core + art sources (no data, no game boot), so it works while other
// systems are mid-edit; page errors from other owners' files are listed but do not fail the run.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/monsters_c'));
const ONLY = opt('only', 'sheet,context').split(',');
const SCALE = +opt('scale', 4);
const BASES = ['beetle', 'fairy', 'book', 'crystal', 'frog', 'doll', 'seabird', 'mole', 'automaton', 'scribe', 'owl', 'spider', 'treant', 'mammoth'];
const IDS = opt('ids', '') ? opt('ids', '').split(',') : null;
// palette steps the lineage table uses for each base (§9.4.6, §9.11.6) — what the sprite must survive
const USED = {
  beetle: [{ sat: 0.2, bri: 0.7 }, { hue: -40, sat: 1.2 }, { sat: 0.3, bri: 1.3 }],
  fairy: [{ hue: 300 }, { hue: 180, sat: 0.6, bri: 1.1 }, { hue: 40, sat: 0.7, bri: 1.2 }],
  book: [{ hue: 250, sat: 1.2, bri: 0.8 }, { sat: 0, bri: 1.3 }],
  crystal: [{ hue: -60, sat: 1.4 }, { hue: 180, sat: 1.3 }, { hue: 250, sat: 1.3, bri: 0.85 }],
  frog: [{ hue: 180, sat: 1.3 }, { hue: 40, sat: 0.8, bri: 0.9 }, { hue: 20, sat: 0.7, bri: 0.95 }],
  doll: [{ hue: 300, sat: 0.9 }, { sat: 0.4, bri: 0.7 }, { hue: 200, sat: 0.8 }, { sat: 0.4, bri: 0.9 }, { hue: 330, sat: 0.8 }, { hue: 90, sat: 0.7 }],
  seabird: [{ sat: 0.3, bri: 0.75 }, { hue: 30, sat: 0.7 }, { bri: 1.15 }],
  mole: [{ hue: -10, sat: 0.8 }, { hue: 10, sat: 1.1 }, { hue: 20, sat: 0.7, bri: 0.85 }],
  automaton: [{ hue: 20, sat: 0.8 }, { hue: 160, sat: 0.8 }, { hue: 20, sat: 1.1 }],
  scribe: [],
  owl: [{ hue: 30, sat: 0.7 }, { hue: 270, sat: 1.1 }, { hue: 200, sat: 0.8 }],
  spider: [{ hue: 250, sat: 1.1 }, { sat: 0.3, bri: 0.4 }, { hue: 40, sat: 1.3, bri: 0.9 }],
  treant: [{ hue: -30, sat: 0.9, bri: 0.9 }, { hue: 30, sat: 0.8 }, { hue: 50, sat: 0.7, bri: 0.9 }],
  mammoth: [{ hue: -10, sat: 0.8, bri: 0.85 }, { sat: 0.2, bri: 1.25 }],
};
const GOLD = { tint: '#ffd24a' };
const HUE = [{ hue: 60 }, { hue: -60 }, { hue: 120 }, { hue: -120 }, { hue: 180 }, { sat: 0.25 }, { bri: 0.6 }, { bri: 1.3 }];
// bases whose stages put a head part on them (§9.4.6): the check wants headroom above `head`
const HEADROOM = { fairy: 5, beetle: 4, doll: 8, seabird: 6, mole: 8, automaton: 8, scribe: 4, owl: 7, treant: 10, mammoth: 10 };

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
    if (!(id in times)) times[id] = Math.round(performance.now() - t);
    return img;
  }
  const vlabel = (v) => Object.entries(v).map(([k, x]) => k + ':' + x).join(' ');
  /** rows of [id, [variants]]: base + variants at scale s, then 1x on black and on green */
  function sheet(rows, s) {
    const imgs = rows.map(([id]) => build(id));
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const cw = mw * s + 8, ch = mh * s + 22;
    const n = 1 + Math.max(...rows.map((r) => r[1].length));
    const [cv, c] = canvas(n * cw + mw + 24, rows.length * ch + 8);
    rows.forEach(([id, vars], r) => {
      const y = r * ch + 4;
      const list = [imgs[r]].concat(vars.map((v) => G.variant('mon:' + id, v)));
      list.forEach((img, k) => {
        const x = 8 + k * cw;
        label(c, k ? vlabel(vars[k - 1]) : id + ' ' + img.width + 'x' + img.height, x, y);
        cell(c, x, y + 16, mw * s, mh * s, s);
        c.drawImage(img, x + (mw - img.width) * s / 2, y + 16 + (mh - img.height) * s, img.width * s, img.height * s);
      });
      const x = 8 + n * cw;
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
  /** bases only, 'per' per row at scale s */
  function grid(ids, s, per) {
    const imgs = ids.map(build);
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const cw = mw * s + 8, ch = mh * s + 22, rows = Math.ceil(ids.length / per);
    const [cv, c] = canvas(Math.min(per, ids.length) * cw + 8, rows * ch + 8);
    imgs.forEach((img, k) => {
      const x = 8 + (k % per) * cw, y = 4 + Math.floor(k / per) * ch;
      label(c, ids[k] + ' ' + img.width + 'x' + img.height, x, y);
      cell(c, x, y + 16, mw * s, mh * s, s);
      c.drawImage(img, x + (mw - img.width) * s / 2, y + 16 + (mh - img.height) * s, img.width * s, img.height * s);
    });
    return cv.toDataURL();
  }
  /** bases at scale s with their anchor points (§9.4.3) marked */
  function anchors(ids, s) {
    const AN = (R.Art.monstersC && R.Art.monstersC.anchors) || {};
    const imgs = ids.map(build);
    const mw = Math.max(...imgs.map((i) => i.width)), mh = Math.max(...imgs.map((i) => i.height));
    const per = 4, cw = mw * s + 8, ch = mh * s + 22, rows = Math.ceil(ids.length / per);
    const [cv, c] = canvas(Math.min(per, ids.length) * cw + 8, rows * ch + 8);
    const COL = { head: '#ff3030', brow: '#ff9030', eyes: '#ffff40', mouth: '#ff40ff', neck: '#40ffff', back: '#4080ff', body: '#40ff40', hand: '#ffffff', hand2: '#c0c0c0', tail: '#ff80c0', feet: '#000000' };
    imgs.forEach((img, k) => {
      const x = 8 + (k % per) * cw, y = 4 + Math.floor(k / per) * ch, id = ids[k];
      label(c, id, x, y);
      cell(c, x, y + 16, mw * s, mh * s, s);
      const ox = x + (mw - img.width) * s / 2, oy = y + 16 + (mh - img.height) * s;
      c.drawImage(img, ox, oy, img.width * s, img.height * s);
      const a = AN[id] || {};
      for (const key in COL) {
        const pts = key === 'eyes' ? a.eyes || [] : a[key] ? [a[key]] : [];
        for (const p of pts) {
          c.fillStyle = '#000'; c.fillRect(ox + p[0] * s - 1, oy + p[1] * s - 1, s + 2, s + 2);
          c.fillStyle = COL[key]; c.fillRect(ox + p[0] * s, oy + p[1] * s, s, s);
        }
      }
    });
    let lx = 8;
    return cv.toDataURL();
  }
  // ---- the battle screen of §11.5.1 / §11.11.3 (4 party windows)
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, BOX = { x: 8, y: 150, w: 240, h: 68 }, GROUND = 130;
  function win(c, x, y, w, h, s) {
    c.fillStyle = '#f0e8d0'; c.fillRect(x * s, y * s, w * s, h * s);
    c.fillStyle = '#0b1024'; c.fillRect((x + 1) * s, (y + 1) * s, (w - 2) * s, (h - 2) * s);
    c.fillStyle = '#16203e'; c.fillRect((x + 2) * s, (y + 2) * s, (w - 4) * s, (h - 4) * s);
  }
  function screen(c, oy, bg, sprites, s, names) {
    c.fillStyle = '#000'; c.fillRect(0, oy, 256 * s, 224 * s);
    let b = G.has('bbg:' + bg) ? G.get('bbg:' + bg) : null;
    if (Array.isArray(b)) b = b[0];
    if (b) c.drawImage(b, 0, oy, 256 * s, 144 * s);
    else { c.fillStyle = '#5a8a4a'; c.fillRect(0, oy, 256 * s, 144 * s); }
    // monsters: layout of battle_scene (total ≤ 244, gap ≤ 8), feet on GROUND, tall ones sink
    const imgs = sprites.map((m) => (typeof m === 'string' ? G.get('mon:' + m) : G.variant('mon:' + m[0], m[1])));
    const total = imgs.reduce((a, i) => a + i.width, 0);
    const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
    let x = 128 - (total + gap * (imgs.length - 1)) / 2;
    imgs.forEach((img) => {
      const feet = GROUND + Math.max(0, Math.min(20, Math.round((img.height - 64) / 2.4)));
      c.drawImage(img, Math.round(x) * s, oy + (feet - img.height) * s, img.width * s, img.height * s);
      x += img.width + gap;
    });
    // party windows + command box
    c.save(); c.translate(0, oy);
    WIN.xs.forEach((wx, i) => {
      win(c, wx, WIN.y, WIN.w, WIN.h, s);
      c.font = (8 * s) + 'px monospace'; c.fillStyle = '#f0e8d0'; c.textBaseline = 'top';
      c.fillText(names[i], (wx + 5) * s, (WIN.y + 4) * s);
      c.fillStyle = '#b0e8a0'; c.fillText('HP 123', (wx + 5) * s, (WIN.y + 16) * s);
      c.fillStyle = '#a0c8ff'; c.fillText('MP  45', (wx + 5) * s, (WIN.y + 26) * s);
      c.fillStyle = '#ffd890'; c.fillText('WP  12', (wx + 5) * s, (WIN.y + 36) * s);
    });
    win(c, BOX.x, BOX.y, BOX.w, BOX.h, s);
    c.restore();
  }
  function context(bg, groups, s) {
    const [cv, c] = canvas(256 * s, groups.length * (224 * s + 8), '#000');
    groups.forEach((g, gi) => screen(c, gi * (224 * s + 8), bg, g, s, ['Arun', 'Brigi', 'Marta', 'Sylva']));
    return cv.toDataURL();
  }
  /** QA numbers per base */
  function check(ids, sizes, headroom) {
    const AN = (R.Art.monstersC && R.Art.monstersC.anchors) || {};
    const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return ids.map((id) => {
      const img = build(id), w = img.width, h = img.height;
      const d = img.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, bottom = 0, semi = 0, edge = 0, edgeDark = 0;
      const cols = new Set(), L = [];
      const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
      // transparent pixels connected to the canvas border (the outside; enclosed holes such as
      // see-through wing checkers or key rings are not "outside")
      const outside = new Uint8Array(w * h), stack = [];
      for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
      for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= w || y >= h || outside[y * w + x] || at(x, y)) continue;
        outside[y * w + x] = 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      const out = (x, y) => x >= 0 && y >= 0 && x < w && y < h && outside[y * w + x];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, a = d[i + 3];
        if (!a) continue;
        if (a < 255) semi++;
        cols.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
        const l = lum(d[i], d[i + 1], d[i + 2]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (y === h - 1) bottom++;
        const border = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        if (!border && (out(x - 1, y) || out(x + 1, y) || out(x, y - 1) || out(x, y + 1))) { edge++; if (l < 0.09) edgeDark++; }
        else if (at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1)) L.push(l);
      }
      L.sort((a, b) => a - b);
      const q = (t) => L[Math.min(L.length - 1, Math.floor(t * L.length))] || 0;
      const a = AN[id];
      const head = a && a.head ? a.head[1] - y0 : null;
      return { id, w, h, want: sizes[id], bbox: [x0, y0, x1, y1], centre: (x0 + x1 + 1) / 2 - w / 2, bottom, colours: cols.size, semi,
        outline: +(edgeDark / Math.max(1, edge)).toFixed(3), headroom: a && a.head ? a.head[1] : null, needHead: headroom[id] || 0,
        value: +(q(0.95) - q(0.05)).toFixed(2), float: !!(a && a.float) };
    });
  }
  return { sheet, grid, anchors, context, check, times };
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
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto('file://' + pageFile);
    await page.waitForTimeout(150);
    const save = (name, url) => {
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('sheet →', f);
    };
    const run = (js) => page.evaluate(js);
    const ids = IDS || BASES;
    const J = JSON.stringify;
    if (ONLY.includes('sheet')) {
      const rows = ids.map((id) => [id, (USED[id] || []).concat([GOLD])]);
      for (let i = 0, k = 0; i < rows.length; i += 7, k++) save('sheet' + (rows.length > 7 ? '_' + k : ''), await run(`SHEET.sheet(${J(rows.slice(i, i + 7))}, ${SCALE})`));
    }
    if (ONLY.includes('hue')) {
      const rows = ids.map((id) => [id, HUE]);
      for (let i = 0, k = 0; i < rows.length; i += 7, k++) save('hue' + (rows.length > 7 ? '_' + k : ''), await run(`SHEET.sheet(${J(rows.slice(i, i + 7))}, 3)`));
    }
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.grid(${J(ids)}, ${SCALE}, 4)`));
    if (ONLY.includes('grid')) save('grid', await run(`SHEET.grid(${J(ids)}, 3, 7)`));
    if (ONLY.includes('anchors')) save('anchors', await run(`SHEET.anchors(${J(ids)}, 6)`));
    if (ONLY.includes('context')) {
      const groups = {
        forest: [['fairy', 'treant', 'fairy'], [['fairy', { hue: 300 }], 'spider', ['treant', { hue: 30, sat: 0.8 }]]],
        swamp: [['frog', 'doll', 'frog'], ['spider', ['frog', { hue: 180, sat: 1.3 }], ['doll', { sat: 0.4, bri: 0.7 }], 'spider']],
        snow: [['owl', 'mammoth', 'owl'], [['owl', { hue: 270, sat: 1.1 }], ['mammoth', { sat: 0.2, bri: 1.25 }]]],
        sea: [['seabird', 'seabird', 'seabird'], [['seabird', { sat: 0.3, bri: 0.75 }], 'crab', ['seabird', { hue: 30, sat: 0.7 }]]],
        cave: [['beetle', 'mole', 'crystal', 'beetle'], [['mole', { hue: 10, sat: 1.1 }], ['crystal', { hue: 180, sat: 1.3 }], ['beetle', { hue: -40, sat: 1.2 }], ['mole', { hue: 20, sat: 0.7, bri: 0.85 }]]],
        tower: [['automaton', 'crystal', 'automaton'], [['automaton', { hue: 160, sat: 0.8 }], ['crystal', { hue: 250, sat: 1.3, bri: 0.85 }], 'darkmage']],
        shrine: [['scribe', 'book', 'scribe', 'book'], [['book', { hue: 250, sat: 1.2, bri: 0.8 }], 'scribe', ['book', { sat: 0, bri: 1.3 }]]],
      };
      const only = (g) => g.map((row) => row.filter((m) => !IDS || IDS.includes(typeof m === 'string' ? m : m[0]))).filter((row) => row.length);
      for (const bg in groups) {
        const g = only(groups[bg]);
        if (g.length) save('context_' + bg, await run(`SHEET.context(${J(bg)}, ${J(g)}, 4)`));
      }
    }
    if (ONLY.includes('check')) {
      const rows = await run(`SHEET.check(${J(ids)}, RPG.Art.monstersC.sizes, ${J(HEADROOM)})`);
      let bad = 0;
      for (const r of rows) {
        const probs = [];
        if (r.w !== r.want || r.h !== r.want) probs.push('size ' + r.w + 'x' + r.h + ' != ' + r.want);
        if (!r.float && (r.bbox[3] !== r.h - 1 || r.bottom < 4)) probs.push('feet not on the bottom row');
        if (r.float && r.bbox[3] < r.h - 8) probs.push('floats too high (' + (r.h - 1 - r.bbox[3]) + 'px)');
        if (Math.abs(r.centre) > 3) probs.push('off-centre by ' + r.centre);
        if (r.semi) probs.push(r.semi + ' semi-transparent px');
        if (r.outline < 0.9) probs.push('outline dark share ' + r.outline);
        if (r.colours < 10 || r.colours > 72) probs.push('colour count ' + r.colours);
        if (r.needHead && (r.headroom == null || r.headroom < r.needHead)) probs.push('headroom ' + r.headroom + ' < ' + r.needHead);
        if (r.value < 0.4) probs.push('value range ' + r.value);
        if (probs.length) bad++;
        console.log(r.id.padEnd(10), (r.w + 'x' + r.h).padEnd(6), 'bbox', J(r.bbox).padEnd(14), 'ctr', String(r.centre).padEnd(4), 'btm', String(r.bottom).padEnd(3),
          'cols', String(r.colours).padEnd(3), 'outl', String(r.outline).padEnd(5), 'head', String(r.headroom).padEnd(3), 'val', r.value, probs.length ? '  <-- ' + probs.join('; ') : '');
      }
      if (bad) process.exitCode = 1;
    }
    const stats = await run(`(() => { const G = RPG.Gfx; return { warned: Object.keys(G._warned), times: SHEET.times }; })()`);
    console.log('build ms:', Object.entries(stats.times).map(([k, v]) => k + ' ' + v).join(', '));
    console.log('missing:', stats.warned.join(' ') || '-');
    for (const e of errors) console.log('[page]', e.split('\n').slice(0, 3).join(' | '));
    if (errors.some((e) => /monsters_[abc]\.js|_sheet_page/.test(e) || !/file:\/\//.test(e))) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
