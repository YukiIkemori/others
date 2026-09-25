#!/usr/bin/env node
// Contact sheets for the post-game art of src/art/postgame.js (owner: art-rare A15b):
// the two post-game base sprites 虚無の騎士 'mon:void_wraith' (48) and 混沌の獣
// 'mon:chaos_beast' (64), the rare monster プリズマ 'mon:rare_prism' (48, 深き坑道) and
// Crest's superboss 'mon:boss_abyss' (128x112, kept registered; the stone tablet in
// 忘却の底 only mentions it). Art review tool.
//
//   node tools/sheet_postgame.js [--out DIR] [--only zoom,context,variants,lineage,check]
//                                [--ids a,b,...] [--scale N] [--crop x,y,w,h] [--cscale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   zoom        each sprite at --scale (default 4) on a checker cell (--crop x,y,w,h limits it
//               to that sprite-pixel rectangle; use with --ids for close inspection); the two
//               base sprites also show their composition anchors (R.Art.MON_ANCHORS) as dots
//   context     battle frames at --cscale (default 3) in the DESIGN §11.11.3 layout: four
//               party windows (xs 3/66/129/192, y 5, 61x46), the message box, feet on
//               GROUND 130 sunk by clamp(round((h-64)/2.4),0,20); bbg:oblivion (its §11.2.13
//               fallback until drawn) with the real 忘却の底 groups, bbg:mine for プリズマ
//   variants    the two base sprites in their default palette and hue-shifted (compose
//               recolours them), to check the outline and eyes survive the shift
//   lineage     the composed lineage 'mon:void_1..3' and 'mon:chaos_1..3' (A14a's
//               R.Art.compose with crown / cape / aura / crystals) beside the bases
//   check       size / bbox / bottom row / colour count / semi-transparency, and that the
//               lineage renders at the base size (not a placeholder); exit 1 on a problem
// Sprite sheets load only core + data + art sources (no game boot).
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/postgame'));
const ONLY = opt('only', 'zoom,context,variants,lineage,check').split(',');
const SCALE = +opt('scale', 4);
const CSCALE = +opt('cscale', 3);
const CROP = opt('crop', '') ? opt('crop', '').split(',').map(Number) : null;
// sprite id → expected size
const SPRITES = { void_wraith: [48, 48], chaos_beast: [64, 64], rare_prism: [48, 48], boss_abyss: [128, 112] };
const IDS = opt('ids', '') ? opt('ids', '').split(',') : Object.keys(SPRITES);
const LINEAGE = ['void_1', 'void_2', 'void_3', 'chaos_1', 'chaos_2', 'chaos_3'];
const VARIANTS = [{ hue: 0 }, { hue: 70 }, { hue: 150 }, { hue: -110 }, { hue: 40, sat: 1.1 }, { bri: 0.9 }];
const BBG_FALLBACK = { mine: 'cave', oblivion: 'demon', ring: 'oblivion' };

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
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, BOX = { x: 8, y: 150, w: 240, h: 68 }, GROUND = 130;
  function img(id, v) {
    const t0 = performance.now();
    let im = v ? G.variant('mon:' + id, v) : G.get('mon:' + id);
    if (!(id in times)) times[id] = Math.round(performance.now() - t0);
    return Array.isArray(im) ? im[0] : im;
  }
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    if (bg !== null) { c.fillStyle = bg || '#3a3a48'; c.fillRect(0, 0, w, h); }
    return [cv, c];
  }
  function label(c, s, x, y, col, px) {
    c.font = (px || 12) + 'px monospace'; c.fillStyle = col || '#e8e8f0'; c.textBaseline = 'top'; c.fillText(s, x, y);
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
  /** the anchor table of a base as a flat list [key, x, y] */
  function anchorPts(id) {
    const a = (R.Art.MON_ANCHORS || {})[id];
    if (!a) return [];
    const out = [];
    for (const k in a) {
      const v = a[k];
      if (!Array.isArray(v)) continue;
      if (Array.isArray(v[0])) v.forEach((q, i) => out.push([k + i, q[0], q[1]]));
      else out.push([k, v[0], v[1]]);
    }
    return out;
  }
  function zoom(ids, s, crop) {
    const imgs = ids.map((id) => img(id));
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
    let w = 8;
    const pos = imgs.map((im) => { const x = w; w += im.width * s + 8; return x; });
    const mh = Math.max(...imgs.map((i) => i.height));
    const [cv, c] = canvas(w, mh * s + 28);
    imgs.forEach((im, k) => {
      const oy = 20 + (mh - im.height) * s;
      label(c, ids[k] + ' ' + im.width + 'x' + im.height + ' ' + colours(im) + 'c ' + times[ids[k]] + 'ms', pos[k], 4);
      cell(c, pos[k], oy, im.width * s, im.height * s, s);
      c.drawImage(im, pos[k], oy, im.width * s, im.height * s);
      for (const [key, ax, ay] of anchorPts(ids[k])) {
        c.fillStyle = '#ff2080'; c.fillRect(pos[k] + ax * s + s / 4, oy + ay * s + s / 4, s / 2, s / 2);
        label(c, key, pos[k] + ax * s + s, oy + ay * s - 2, '#ffe0f0', 10);
      }
    });
    return cv.toDataURL();
  }
  function frameWin(c, x, y, w, h, s) {
    c.fillStyle = '#0b1024'; c.fillRect((x + 1) * s, y * s, (w - 2) * s, h * s); c.fillRect(x * s, (y + 1) * s, w * s, (h - 2) * s);
    c.fillStyle = '#16203e'; c.fillRect((x + 2) * s, (y + 2) * s, (w - 4) * s, (h - 4) * s);
    c.fillStyle = '#f0e8d0';
    c.fillRect((x + 2) * s, (y + 1) * s, (w - 4) * s, s); c.fillRect((x + 2) * s, (y + h - 2) * s, (w - 4) * s, s);
    c.fillRect((x + 1) * s, (y + 2) * s, s, (h - 4) * s); c.fillRect((x + w - 2) * s, (y + 2) * s, s, (h - 4) * s);
  }
  function bbg(bg) {
    const FB = ${JSON.stringify(BBG_FALLBACK)};
    let id = bg;
    while (!G.has('bbg:' + id) && FB[id]) id = FB[id];
    let b = G.has('bbg:' + id) ? G.get('bbg:' + id) : null;
    if (Array.isArray(b)) b = b[0];
    return [b, id];
  }
  /** one battle screen: sprites [{id, v}] laid out like battle_scene (total ≤ 244, gap ≤ 8) */
  function screen(c, list, bg, s, title) {
    const W = 256, H = 224;
    c.fillStyle = '#000'; c.fillRect(0, 0, W * s, H * s);
    const [b, used] = bbg(bg);
    if (b) c.drawImage(b, 0, 0, W * s, 144 * s);
    const ims = list.map((e) => img(e.id, e.v));
    const total = ims.reduce((a, im) => a + im.width, 0);
    const gap = ims.length > 1 ? Math.min(8, (244 - total) / (ims.length - 1)) : 0;
    let x = 128 - (total + gap * (ims.length - 1)) / 2;
    ims.forEach((im) => {
      const feet = GROUND + Math.max(0, Math.min(20, Math.round((im.height - 64) / 2.4)));
      c.drawImage(im, Math.round(x) * s, (feet - im.height) * s, im.width * s, im.height * s);
      x += im.width + gap;
    });
    for (const wx of WIN.xs) frameWin(c, wx, WIN.y, WIN.w, WIN.h, s);
    frameWin(c, BOX.x, BOX.y, BOX.w, BOX.h, s);
    label(c, title, 20 * s, 158 * s, '#f0e8d0', 4 * s);
    if (used !== bg) label(c, '(bbg:' + bg + ' not drawn yet: fallback ' + used + ')', 20 * s, 172 * s, '#a0a8c0', 3 * s);
  }
  function context(scenes, s) {
    const W = 256, H = 224;
    const [cv, c] = canvas(2 * (W * s + 6), Math.ceil(scenes.length / 2) * (H * s + 6), '#000');
    scenes.forEach((sc, k) => {
      c.save(); c.translate((k % 2) * (W * s + 6), Math.floor(k / 2) * (H * s + 6));
      screen(c, sc.list, sc.bg, s, sc.title);
      c.restore();
    });
    return cv.toDataURL();
  }
  function variants(ids, vs, s) {
    const rows = ids.map((id) => vs.map((v) => img(id, v)));
    const cw = Math.max(...rows.flat().map((i) => i.width)) * s + 8;
    const rh = rows.map((r) => r[0].height * s + 30);
    const [cv, c] = canvas(vs.length * cw + 8, rh.reduce((a, b) => a + b, 0) + 8);
    let y = 4;
    rows.forEach((r, k) => {
      r.forEach((im, j) => {
        const x = 8 + j * cw;
        label(c, ids[k] + ' ' + JSON.stringify(vs[j]), x, y);
        c.fillStyle = j % 2 ? '#1a1424' : '#2c2638'; c.fillRect(x, y + 16, im.width * s, im.height * s);
        c.drawImage(im, x, y + 16, im.width * s, im.height * s);
      });
      y += rh[k];
    });
    return cv.toDataURL();
  }
  /** the bases and their composed lineage side by side (grey and grass backgrounds) */
  function lineage(rows, s) {
    const all = rows.flat();
    const ims = all.map((id) => (G.has('mon:' + id) ? img(id) : null));
    const cw = 64 * s + 10, rh = 64 * s + 30;
    const [cv, c] = canvas(4 * cw + 8, rows.length * rh + 8, '#1c1a26');
    let k = 0;
    rows.forEach((row, j) => row.forEach((id, i) => {
      const im = ims[k++], x = 8 + i * cw, y = 4 + j * rh;
      c.fillStyle = i % 2 ? '#2e3a2a' : '#2a2838'; c.fillRect(x, y + 16, 64 * s, 64 * s);
      label(c, id + (im ? ' ' + im.width + 'x' + im.height : ' (not registered)'), x, y, im ? '#f0e8d0' : '#ff8080');
      if (im) c.drawImage(im, x + (64 - im.width) * s / 2, y + 16 + (64 - im.height) * s, im.width * s, im.height * s);
    }));
    return cv.toDataURL();
  }
  function check(ids, sizes, lineageIds) {
    const res = ids.map((id) => {
      const im = img(id), d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
      let x0 = im.width, y0 = im.height, x1 = -1, y1 = -1, semi = 0;
      for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const a = d[(y * im.width + x) * 4 + 3];
        if (!a) continue;
        if (a < 255) semi++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const want = sizes[id] || [im.width, im.height];
      const probs = [];
      if (im.width !== want[0] || im.height !== want[1]) probs.push('size ' + im.width + 'x' + im.height + ' (want ' + want.join('x') + ')');
      if (y1 !== im.height - 1) probs.push('feet: lowest row ' + y1);
      if (semi) probs.push(semi + ' semi-transparent px');
      const an = (R.Art.MON_ANCHORS || {})[id];
      if ((id === 'void_wraith' || id === 'chaos_beast') && !an) probs.push('no MON_ANCHORS entry');
      return { id, size: im.width + 'x' + im.height, bbox: [x0, y0, x1, y1], colours: colours(im), ms: times[id], probs };
    });
    for (const id of lineageIds) {
      if (!G.has('mon:' + id)) { res.push({ id, size: '-', bbox: [], colours: 0, ms: 0, probs: [], note: 'not registered yet (A14a)' }); continue; }
      const im = img(id), base = id.startsWith('void') ? 'void_wraith' : 'chaos_beast';
      const b = img(base), probs = [];
      if (im.width !== b.width || im.height !== b.height) probs.push('size ' + im.width + 'x' + im.height + ' != base ' + b.width + 'x' + b.height);
      res.push({ id, size: im.width + 'x' + im.height, bbox: [], colours: colours(im), ms: times[id], probs });
    }
    return res;
  }
  return { zoom, context, variants, lineage, check, times };
})();
`;

function save(name, url) {
  const f = path.join(OUT, name + '.png');
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log('sheet →', f);
}

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
  let bad = false;
  try {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
    const errors = [];
    const mine = /postgame\.js|rare_monsters|_sheet_page/;
    page.on('pageerror', (e) => { if (mine.test(String(e.stack || e))) errors.push(String(e.stack || e)); else console.log('[other file]', String(e).slice(0, 160)); });
    // (Chrome's willReadFrequently notice comes from this tool's own pixel readback)
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text()); });
    await page.goto('file://' + pageFile);
    await page.waitForTimeout(200);
    const run = (js) => page.evaluate(js);
    const ids = JSON.stringify(IDS);
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${ids}, ${SCALE}, ${JSON.stringify(CROP)})`));
    if (ONLY.includes('context')) {
      const has = await run(`(${JSON.stringify(LINEAGE)}).filter((id) => RPG.Gfx.has('mon:' + id))`);
      const V = (id, fb) => (has.includes(id) ? { id } : fb);
      const scenes = [
        { bg: 'oblivion', title: '忘却の底: void_1 x2 + chaos_1', list: [V('void_1', { id: 'void_wraith' }), V('chaos_1', { id: 'chaos_beast' }), V('void_1', { id: 'void_wraith' })] },
        { bg: 'oblivion', title: '忘却の底(深): void_3 + chaos_3 + void_2', list: [V('void_3', { id: 'void_wraith' }), V('chaos_3', { id: 'chaos_beast' }), V('void_2', { id: 'void_wraith' })] },
        { bg: 'mine', title: '深き坑道: rare_prism', list: [{ id: 'rare_prism' }] },
        { bg: 'oblivion', title: 'boss_abyss (Crest, kept registered)', list: [{ id: 'boss_abyss' }] },
      ].filter((sc) => sc.list.every((e) => IDS.includes(e.id) || LINEAGE.includes(e.id) || e.id === 'void_wraith' || e.id === 'chaos_beast'));
      for (let i = 0; i < scenes.length; i += 4) save('context_' + (i / 4 + 1), await run(`SHEET.context(${JSON.stringify(scenes.slice(i, i + 4))}, ${CSCALE})`));
    }
    if (ONLY.includes('variants')) {
      const vids = IDS.filter((id) => id === 'void_wraith' || id === 'chaos_beast');
      if (vids.length) save('variants', await run(`SHEET.variants(${JSON.stringify(vids)}, ${JSON.stringify(VARIANTS)}, 3)`));
    }
    if (ONLY.includes('lineage')) save('lineage', await run(`SHEET.lineage(${JSON.stringify([['void_wraith', 'void_1', 'void_2', 'void_3'], ['chaos_beast', 'chaos_1', 'chaos_2', 'chaos_3']])}, 3)`));
    if (ONLY.includes('check')) {
      const res = await run(`SHEET.check(${ids}, ${JSON.stringify(SPRITES)}, ${JSON.stringify(LINEAGE)})`);
      for (const r of res) {
        console.log(`${r.id.padEnd(12)} ${r.size.padEnd(8)} bbox ${r.bbox.join(',').padEnd(14)} ${String(r.colours).padStart(3)} colours ${r.ms}ms ${r.probs.length ? 'PROBLEM: ' + r.probs.join('; ') : r.note || 'ok'}`);
        if (r.probs.length) bad = true;
      }
    }
    const info = await run(`(() => ({ warned: Object.keys(RPG.Gfx._warned) }))()`);
    const own = info.warned.filter((k) => /^mon:(void_wraith|chaos_beast|rare_prism|boss_abyss)$/.test(k));
    console.log('missing (own):', own.join(' ') || '-', ' (others):', info.warned.filter((k) => !own.includes(k)).join(' ') || '-');
    for (const e of errors) console.log('[page]', e);
    if (errors.length || own.length) bad = true;
  } finally {
    await browser.close();
  }
  if (bad) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
