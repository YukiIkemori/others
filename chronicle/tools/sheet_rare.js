#!/usr/bin/env node
// Contact sheets for the 23 rare-monster sprites (src/art/rare_monsters*.js and
// rare_prism in src/art/postgame.js). Art review tool (owner: art-rare A15b).
//
//   node tools/sheet_rare.js [--out DIR] [--only sheet,lineup,context,battles,zoom,check]
//                            [--ids a,b,...] [--scale N] [--cscale N]
//
// Sheets (PNG, nearest-neighbour upscaled):
//   sheet_<n>    six sprites per page: each at --scale (default 4) on black and on a
//                checker cell, 1x copies on black / grey / grass, and the white hit-flash,
//                the red target tint and the pale "acting" blink the battle applies
//   lineup       all sprites side by side at 2x and 1x (size classes s 32 / m 48 / l 64),
//                grouped by region, to compare weight, palette and "rare" read at a glance
//   context_<id> the sprite in a 256x224 battle frame at --cscale (default 3): its zone's
//                backdrop, the four party windows of DESIGN §11.11.3 (WIN xs 3/66/129/192,
//                y 5, 61x46), the message box (8,150,240,68), feet on GROUND 130 (sunk by
//                clamp(round((h-64)/2.4),0,20)), the battle's rare-monster twinkles; frame 2
//                shows it between two regular monsters of its zone, frames 3-4 on the other
//                backdrops of its region (a missing backdrop uses the §11.2.13 fallback)
//   battles      overview: every sprite between two neighbours of its zone on its main
//                backdrop, in the same battle frame, four frames per row at 1x
//   zoom         sprites at --scale (default 5) three per row on a checker (close inspection)
//   check        size / bbox / centring / bottom rows / colours / "rare" marks (white glint,
//                saturated jewel or gold pixels) / semi-transparency; exit 1 on a problem
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
const ONLY = opt('only', 'sheet,lineup,check').split(',');
const SCALE = +opt('scale', 4);
const CSCALE = +opt('cscale', 3);

// sprite id → zone backdrops (main first; §9.7.3 / §11.2.11) and two regular neighbours
// of that zone (§9.7.4; drawn as 'mon:<id>' when composed, else the base sprite)
const RARE = {
  rare_hare: { zone: 'zw_prologue', bgs: ['grass', 'sea', 'tower'], mates: ['jelly_1', 'crab_1'] },
  rare_fawn: { zone: 'zw_forest', bgs: ['forest', 'grass', 'tree'], mates: ['mushroom_1', 'fairy_1'] },
  rare_glassmoth: { zone: 'z_r_forest_maze', bgs: ['forest', 'tree', 'grass'], mates: ['bee_1', 'plant_1'] },
  rare_acorn: { zone: 'z_r_forest_tree', bgs: ['tree', 'forest', 'grass'], mates: ['mushroom_1', 'treant_1'] },
  rare_lizard: { zone: 'zw_desert', bgs: ['desert', 'pyramid', 'wasteland'], mates: ['scorpion_1', 'cactus_1'] },
  rare_idol: { zone: 'z_r_desert_tomb', bgs: ['pyramid', 'desert', 'cave'], mates: ['mummy_1', 'bat_1'] },
  rare_bird: { zone: 'zw_snow', bgs: ['snow', 'ice', 'peak'], mates: ['wolf_1', 'owl_1'] },
  rare_icefox: { zone: 'z_r_snow_peak', bgs: ['ice', 'snow', 'peak'], mates: ['frostling_1', 'wolf_1'] },
  rare_lotus: { zone: 'zw_marsh', bgs: ['swamp', 'forest', 'grass'], mates: ['frog_1', 'wisp_1'] },
  rare_teapot: { zone: 'z_r_marsh_manor', bgs: ['manor', 'castle', 'swamp'], mates: ['doll_1', 'ghost_1'] },
  rare_bellsnail: { zone: 'z_r_marsh_bog', bgs: ['swamp', 'forest', 'manor'], mates: ['frog_1', 'mushroom_1'] },
  rare_whale: { zone: 'zw_isles', bgs: ['beach', 'grass', 'sea'], mates: ['seabird_1', 'crab_1'] },
  rare_hermit: { zone: 'z_r_isles_ship', bgs: ['ship', 'sea', 'watercave'], mates: ['skeleton_1', 'mimic_1'] },
  rare_hedgehog: { zone: 'zw_mine', bgs: ['hills', 'mine', 'cave'], mates: ['mole_1', 'beetle_1'] },
  rare_prism: { zone: 'z_r_mine_mine', bgs: ['mine', 'cave', 'hills'], mates: ['crystal_1', 'goblin_1'] },
  rare_monkey: { zone: 'zw_ash', bgs: ['ashland', 'wasteland', 'volcano'], mates: ['salamander_1', 'imp_1'] },
  rare_turtle: { zone: 'z_r_ash_volcano', bgs: ['volcano', 'ashland', 'wasteland'], mates: ['gargoyle_1', 'salamander_1'] },
  rare_sheep: { zone: 'zw_star', bgs: ['grass', 'hills', 'tower'], mates: ['eyeball_1', 'automaton_1'] },
  rare_clockbird: { zone: 'z_r_star_tower', bgs: ['tower', 'grass', 'shrine'], mates: ['automaton_1', 'armor_1'] },
  rare_bookworm: { zone: 'z_finale_archive_lo', bgs: ['library', 'castle', 'shrine'], mates: ['book_1', 'scribe_1'] },
  rare_quill: { zone: 'z_finale_archive_hi', bgs: ['library', 'hollow', 'castle'], mates: ['scribe_2', 'book_2'] },
  rare_goldfish: { zone: 'z_postgame_oblivion_lo', bgs: ['oblivion', 'demon', 'ring'], mates: ['void_1', 'platinum_1'] },
  rare_tapir: { zone: 'z_postgame_oblivion_hi', bgs: ['oblivion', 'ring', 'demon'], mates: ['void_2', 'chaos_2'] },
};
const REGION_ORDER = Object.keys(RARE);
const IDS = opt('ids', '')
  ? opt('ids', '').split(',').map((s) => (s.startsWith('rare_') ? s : 'rare_' + s))
  : REGION_ORDER;
// §11.2.13 backdrop fallbacks (the sheet shows what the game would draw today)
const BBG_FALLBACK = { tree: 'forest', manor: 'castle', ship: 'sea', mine: 'cave', library: 'castle', oblivion: 'demon', ashland: 'wasteland', jungle: 'forest', beach: 'sea', peak: 'snow', hollow: 'library', ring: 'oblivion' };

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
  function img(id) {
    const t0 = performance.now();
    const v = G.get('mon:' + id);
    if (!(id in times)) times[id] = Math.round(performance.now() - t0);
    return Array.isArray(v) ? v[0] : v;
  }
  /** a regular neighbour: the composed 'mon:<id>' if registered, else its base sprite */
  function mate(id) {
    if (G.has('mon:' + id)) return img(id);
    const base = id.replace(/_\d+$/, '');
    const alias = { quicksilver: 'jelly', mirror: 'beetle', platinum: 'wisp', void: 'void_wraith', chaos: 'chaos_beast', paper: 'imp' }[base] || base;
    return G.has('mon:' + alias) ? img(alias) : img(id);
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
  function tinted(im, color, amt) {
    const [t, tc] = canvas(im.width, im.height, null);
    tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, im.width, im.height);
    const [o, oc] = canvas(im.width, im.height, null);
    oc.drawImage(im, 0, 0); oc.globalAlpha = amt; oc.drawImage(t, 0, 0);
    return o;
  }
  /** six sprites per page: s-x on black and on a checker, 1x copies and the battle tints */
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
        c.drawImage(tinted(im, '#ffffff', 0.55), bx + 2 * (mw + 12) + 4, ty + 4 + mh - im.height);
      }
    });
    return cv.toDataURL();
  }
  /** every sprite at 2x (top) and 1x (bottom), feet on one line, grouped by region */
  function lineup(ids) {
    const imgs = ids.map(img);
    const per = 8, s = 2, cw = 64 * s + 10, rh = 64 * s + 64 + 40;
    const rows = Math.ceil(ids.length / per);
    const [cv, c] = canvas(per * cw + 10, rows * rh + 8, '#1c1a26');
    imgs.forEach((im, k) => {
      const x = 8 + (k % per) * cw, y = 6 + Math.floor(k / per) * rh;
      c.fillStyle = '#2a2838'; c.fillRect(x, y + 16, 64 * s, 64 * s);
      c.drawImage(im, x + (64 - im.width) * s / 2, y + 16 + (64 - im.height) * s, im.width * s, im.height * s);
      c.fillStyle = '#48703a'; c.fillRect(x, y + 20 + 64 * s, 64 * s, 68);
      c.drawImage(im, x + (64 * s - im.width) / 2, y + 20 + 64 * s + 66 - im.height);
      label(c, ids[k].replace('rare_', ''), x, y + 2, '#f0e8d0');
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
    let id = bg;
    if (!G.has('bbg:' + id) && ${JSON.stringify(BBG_FALLBACK)}[id]) id = ${JSON.stringify(BBG_FALLBACK)}[id];
    if (!G.has('bbg:' + id)) id = ${JSON.stringify(BBG_FALLBACK)}[id] || id;
    let b = G.has('bbg:' + id) ? G.get('bbg:' + id) : null;
    if (Array.isArray(b)) b = b[0];
    return [b, id];
  }
  /** one 256x224 battle frame: backdrop, monsters on the ground line, four windows, box */
  function frame(c, ox, oy, bg, mons, s, text, F) {
    const W = 256, H = 224;
    c.save(); c.translate(ox, oy);
    c.fillStyle = '#000'; c.fillRect(0, 0, W * s, H * s);
    const [b, used] = bbg(bg);
    if (b) c.drawImage(b, 0, 0, W * s, 144 * s);
    else { c.fillStyle = '#4a4a5a'; c.fillRect(0, 0, W * s, 144 * s); }
    const imgs = mons.map((m) => (m.rare ? img(m.id) : mate(m.id)));
    const total = imgs.reduce((a, i) => a + i.width, 0);
    const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
    let x = 128 - (total + gap * (imgs.length - 1)) / 2;
    imgs.forEach((im, k) => {
      const feet = GROUND + Math.max(0, Math.min(20, Math.round((im.height - 64) / 2.4)));
      const X = Math.round(x), Y = feet - im.height;
      c.drawImage(im, X * s, Y * s, im.width * s, im.height * s);
      if (mons[k].rare) {
        // battle_scene drawSparkles: five white / pale-gold crosses on a 90-frame cycle
        for (let q = 0; q < 5; q++) {
          const t = (F + q * 37) % 90;
          if (t > 30) continue;
          const px = X + ((q * 53 + Math.floor((F + q * 37) / 90) * 29) % Math.max(8, im.width));
          const py = Y + ((q * 31 + Math.floor((F + q * 37) / 90) * 17) % Math.max(8, im.height - 4));
          const r = t < 15 ? Math.ceil(t / 5) : Math.ceil((30 - t) / 5);
          c.fillStyle = q % 2 ? '#fff6c0' : '#ffffff';
          c.fillRect(px * s, (py - r) * s, s, (r * 2 + 1) * s); c.fillRect((px - r) * s, py * s, (r * 2 + 1) * s, s);
        }
      }
      x += im.width + gap;
    });
    for (const wx of WIN.xs) frameWin(c, wx, WIN.y, WIN.w, WIN.h, s);
    frameWin(c, BOX.x, BOX.y, BOX.w, BOX.h, s);
    label(c, text, 20 * s, 158 * s, '#f0e8d0', 4 * s);
    if (used !== bg) label(c, '(bbg:' + bg + ' not drawn yet: fallback ' + used + ')', 20 * s, 172 * s, '#a0a8c0', 3 * s);
    c.restore();
  }
  /** 2x2 frames: main backdrop, main with neighbours, then the other region backdrops */
  function context(id, bgs, mates, s) {
    const W = 256 * s + 6, H = 224 * s + 6;
    const [cv, c] = canvas(2 * W, 2 * H, '#000');
    const list = [
      [bgs[0], [{ id, rare: true }], 12],
      [bgs[0], [{ id: mates[0] }, { id, rare: true }, { id: mates[1] }], 40],
      [bgs[1], [{ id, rare: true }], 70],
      [bgs[2], [{ id, rare: true }], 5],
    ];
    list.forEach(([bg, mons, F], k) => frame(c, (k % 2) * W, Math.floor(k / 2) * H, bg, mons, s, id.replace('rare_', '') + ' / bbg:' + bg, F));
    return cv.toDataURL();
  }
  /** overview: every sprite between two neighbours of its zone on its main backdrop, 4 per row */
  function battles(list, s) {
    const W = 256 * s + 4, H = 224 * s + 4, per = 4;
    const [cv, c] = canvas(per * W, Math.ceil(list.length / per) * H, '#000');
    list.forEach(([id, bg, mates], k) => frame(c, (k % per) * W, Math.floor(k / per) * H, bg, [{ id: mates[0] }, { id, rare: true }, { id: mates[1] }], s, id.replace('rare_', ''), 20 + k * 7));
    return cv.toDataURL();
  }
  function zoom(ids, s) {
    const imgs = ids.map(img);
    const per = Math.min(3, ids.length), mw = 64, mh = 64;
    const [cv, c] = canvas(per * (mw * s + 8) + 8, Math.ceil(ids.length / per) * (mh * s + 24) + 4, '#000');
    imgs.forEach((im, k) => {
      const x = 8 + (k % per) * (mw * s + 8), y = 4 + Math.floor(k / per) * (mh * s + 24);
      label(c, ids[k], x, y);
      cell(c, x, y + 18, mw * s, mh * s, s);
      c.drawImage(im, x + Math.round((mw - im.width) / 2) * s, y + 18 + (mh - im.height) * s, im.width * s, im.height * s);
    });
    return cv.toDataURL();
  }
  /** QA numbers per sprite */
  function check(ids) {
    return ids.map((id) => {
      const im = img(id), w = im.width, h = im.height;
      const d = im.getContext('2d').getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, bottom = 0, above = 0, semi = 0, glint = 0, jewel = 0, px = 0, dark = 0;
      const cols = new Set(), hues = new Set();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, a = d[i + 3];
        if (!a) continue;
        px++;
        if (a < 255) semi++;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        cols.add(r << 16 | g << 8 | b);
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mn >= 236) glint++;
        if (mx >= 200 && (mx - mn) / mx >= 0.55) jewel++;
        if (mx >= 150 && (mx - mn) / mx >= 0.22) {
          const d = mx - mn, hh = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          hues.add(Math.floor(hh * 2));
        }
        if (mx < 40) dark++;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        if (y === h - 1) bottom++;
        if (y === h - 2) above++;
      }
      return { id, w, h, bbox: [x0, y0, x1, y1], centre: (x0 + x1 + 1) / 2 - w / 2, bottom, above, colours: cols.size, semi, glint, jewel, hues: hues.size, px, dark };
    });
  }
  return { sheet, lineup, context, battles, zoom, check, times, sizes: () => (R.Art.RARE_SPRITES || {}) };
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
    const mine = /rare_monsters|postgame\.js|_sheet_page/;
    page.on('pageerror', (e) => { if (mine.test(String(e.stack || e))) errors.push(String(e.stack || e)); else console.log('[other file]', String(e).slice(0, 160)); });
    page.on('console', (m) => {
      // the check's own getImageData readbacks trigger a harmless performance hint
      if ((m.type() === 'error' || m.type() === 'warning') && !/willReadFrequently/.test(m.text())) errors.push(m.text());
    });
    await page.goto('file://' + pageFile);
    await page.waitForTimeout(200);
    const save = (name, url) => {
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log('sheet →', f);
    };
    const run = (js) => page.evaluate(js);
    const ids = JSON.stringify(IDS);
    const sizes = await run('SHEET.sizes()');
    if (ONLY.includes('check')) {
      const rows = await run(`SHEET.check(${ids})`);
      for (const r of rows) {
        const probs = [];
        const want = sizes[r.id];
        if (!want) probs.push('not in R.Art.RARE_SPRITES');
        else if (r.w !== want || r.h !== want) probs.push('size ' + r.w + 'x' + r.h + ' != ' + want);
        if (r.bbox[3] !== r.h - 1 || !r.above) probs.push('feet not on the bottom rows');
        if (r.bbox[0] < 0 || r.bbox[1] < 0) probs.push('touches the edge');
        if (Math.abs(r.centre) > 2.5) probs.push('off-centre by ' + r.centre);
        if (r.semi) probs.push(r.semi + ' semi-transparent px');
        if (r.glint < 3) probs.push('no white glints (' + r.glint + ')');
        if (r.jewel < 8 && r.hues < 6) probs.push('no jewel/gold colours (' + r.jewel + ') or rainbow (' + r.hues + ' hues)');
        if (r.colours < 16 || r.colours > 110) probs.push('colour count ' + r.colours);
        if (probs.length) process.exitCode = 1;
        console.log(r.id.padEnd(15), (r.w + 'x' + r.h).padEnd(6), 'bbox', JSON.stringify(r.bbox).padEnd(16), 'centre', String(r.centre).padEnd(5),
          'bottom', String(r.bottom).padEnd(3), 'colours', String(r.colours).padEnd(4), 'glint', String(r.glint).padEnd(4), 'jewel', String(r.jewel).padEnd(4), 'hues', String(r.hues).padEnd(3),
          probs.length ? '  <-- ' + probs.join('; ') : 'ok');
      }
      const missing = Object.keys(sizes).filter((id) => !IDS.includes(id) && !opt('ids', ''));
      if (missing.length) { console.log('registered but not in the sheet table:', missing.join(' ')); process.exitCode = 1; }
    }
    if (ONLY.includes('sheet')) for (let i = 0; i < IDS.length; i += 6) save('sheet_' + (i / 6 + 1), await run(`SHEET.sheet(${JSON.stringify(IDS.slice(i, i + 6))}, ${SCALE})`));
    if (ONLY.includes('lineup')) save('lineup', await run(`SHEET.lineup(${ids})`));
    if (ONLY.includes('battles')) save('battles', await run(`SHEET.battles(${JSON.stringify(IDS.filter((id) => RARE[id]).map((id) => [id, RARE[id].bgs[0], RARE[id].mates]))}, 1)`));
    if (ONLY.includes('zoom')) save('zoom', await run(`SHEET.zoom(${ids}, ${opt('scale', '') ? SCALE : 5})`));
    if (ONLY.includes('context')) {
      for (const id of IDS) {
        const r = RARE[id];
        if (!r) continue;
        save('context_' + id.replace('rare_', ''), await run(`SHEET.context(${JSON.stringify(id)}, ${JSON.stringify(r.bgs)}, ${JSON.stringify(r.mates)}, ${CSCALE})`));
      }
    }
    const info = await run(`(() => ({ times: SHEET.times, warned: Object.keys(RPG.Gfx._warned || {}) }))()`);
    console.log('build ms:', Object.entries(info.times).map(([k, v]) => k + ' ' + v).join(', '));
    // missing keys of other areas (backdrops, neighbours) are reported but do not fail the sheet
    const own = info.warned.filter((k) => /^mon:(rare_|rm_)/.test(k));
    console.log('missing (own):', own.join(' ') || '-', ' (others):', info.warned.filter((k) => !own.includes(k)).join(' ') || '-');
    for (const e of errors) console.log('[page]', e);
    if (errors.length || own.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error(e); process.exit(2); });
