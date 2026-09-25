#!/usr/bin/env node
// Town-exterior decor review (src/art/decor_exterior.js + the town grounds,
// fences and canals of src/art/tiles_local.js).
//
//   node tools/sheet_decor_ext.js [--out DIR] [--scale N] [--html FILE] [--only sheet,grounds,demo,game]
//                                 [--ids lamp,stall,...]   (sheet: only these pieces / combos)
//                                 [--grounds ',.:*']       (sheet: grounds under each piece)
//                                 [--maps regnas_town,...]  (also render real maps whole)
//
// Loads the built game (default dist/index.html — run `node tools/build.js` first),
// injects small maps at runtime and renders them with the same art entry points
// the field uses (R.Art.localTile for the ground, R.Art.decorTile /
// 'decor:<id>' bottom-aligned for the decor layer). Outputs (PNG):
//   decor_ext_sheet.png    every exterior decor piece on grass / cobbles / dirt / snow
//                          (all animation frames) + joined pieces (hedges, beds,
//                          stalls, fountains 1x1..3x3, cart / bush variants)
//   decor_ext_grounds.png  town ground variety, kerbs, worn edges, fences, canals
//   decor_ext_demo_fN.png  a composed demo town square, whole map, frames 0..3
//   decor_ext_map_<id>.png a real map (--maps), whole, frame 0
//   decor_ext_game_N.png   the demo square in the running game (real field
//                          renderer, NPCs walking), a few views and frames
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('out', '/tmp/claude-0/decor_ext'));
const SCALE = +opt('scale', 3);
const HTML = path.resolve(opt('html', path.join(ROOT, 'dist/index.html')));
const ONLY = opt('only', 'sheet,grounds,demo,game').split(',');
const IDS = opt('ids', '');
const GROUNDS = opt('grounds', ',.:*');
const MAPS = opt('maps', ''); // also render these real maps whole: decor_ext_map_<id>.png // sheet: ground chars under each piece (grass cobble dirt snow) // sheet filter: comma list of decor ids / combo names (substring)

// ---------------------------------------------------------------- demo town square
// local legend: . cobbles (town floor)  , grass  : dirt  f flowers  ~ water  | = bridges
//               T tree  F fence  B house wall  R roof  D door  W well  m sign
// decor legend: 1 flowerbed 2 hedge 3 lamp 4-8 shop signs 9 stall J fountain E cart
//               M haystack h bush u small well
const DEMO = {
  name: 'デコの広場', type: 'town', legend: 'local', theme: 'town', bgm: 'town', outside: 'T',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T,,,RRRRRRRR,,,::,,,RRRRRRRR,T',
    'T,,,RRRRRRRR,,,::,,,RRRRRRRR,T',
    'T,,,BBBDBBBB,,,::,,,BBBBDBBB,T',
    'T,,,,,,.,,,,,,,::,,,,,,,.,,,,T',
    'T,,,,..............,,.....,,,T',
    'T,,,,.......................,T',
    'T,,,,.......................,T',
    'T:::::......................:T',
    'T,,,,.......................,T',
    'T,,,,.......................,T',
    'T,,,,.......................,T',
    'T,,,,,.........:............,T',
    'T~~~~~~~~~~~~~~|~~~~~~~~~~~~~T',
    'T,,,,,,,,,,,,,,:,,,,,,,,,,,,,T',
    'T,FFFFFFFF,,,,,:,,,,,,,,,f,,,T',
    'T,F,,,,,,F,,,,,:,,,,,,,,,,,,,T',
    'T,F,,,,,,F,,,,,::::::::::::::T',
    'T,FFFF,FFF,,,,,:,,,,,ff,,,,,,T',
    'T,,,,,,,,,,,,,,:,,,,,,,,,,,,,T',
    'TTTTTTTTTTTTTTT:TTTTTTTTTTTTTT',
  ],
  decor: [
    '                              ',
    '                              ',
    '                              ',
    '                              ',
    '      3 5    h  h    3  7     ',
    '     11            h 11  11   ',
    '                              ',
    '  2        1  JJJ  1       h  ',
    '       3      JJJ      3      ',
    '           1  JJJ  1          ',
    '                              ',
    '      999          9999       ',
    '     3                   3    ',
    '                              ',
    '  2222222     3  2222222      ',
    '                         u    ',
    '   M  E                       ',
    '   h     h               h    ',
    '                              ',
    '   h                     E    ',
    '                              ',
  ],
  marks: {},
  npcs: [
    { id: 'v1', x: 7, y: 10, sprite: 'npc:merchant', dir: 'down', text: 'いらっしゃい！' },
    { id: 'v2', x: 21, y: 10, sprite: 'npc:woman', dir: 'down', text: '新鮮な果物はいかが？' },
    { id: 'w1', x: 11, y: 6, sprite: 'npc:man', move: 'wander', text: 'いい天気だ。' },
    { id: 'w2', x: 18, y: 10, sprite: 'npc:girl', move: 'wander', text: '噴水がきれいでしょ？' },
    { id: 'w3', x: 5, y: 16, sprite: 'npc:old_man', move: 'wander', text: '畑仕事はいいぞ。' },
  ],
  spawns: { entrance: { x: 15, y: 19, dir: 'up' }, plaza: { x: 15, y: 11, dir: 'up' } },
};

// ---------------------------------------------------------------- page code
const PAGE = String.raw`
window.DSHEET = (function () {
  const R = window.RPG, G = R.Gfx, A = R.Art;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#202028'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col) { c.font = '11px monospace'; c.fillStyle = col || '#d8d8e0'; c.textBaseline = 'top'; c.fillText(s, x, y); }
  let seq = 0;
  function compile(def) {
    const id = '__dsheet_' + (seq++);
    R.DB.maps[id] = Object.assign({ name: 'sheet', type: 'town', legend: 'local', theme: 'town', outside: ',' }, def);
    const m = R.FieldMap.compile(id);
    delete R.DB.maps[id];
    return m;
  }
  const pick = (g, f) => (Array.isArray(g) ? g[f % g.length] : g);
  function plain(m, id) {
    if (id === 'void') return null;
    return m.theme && G.has('tile:' + m.theme + ':' + id) ? G.get('tile:' + m.theme + ':' + id) : G.get('tile:' + id);
  }
  /** whole map through the field's art entry points (ground pass, then decor pass bottom-aligned) */
  function render(m, frame, scale) {
    const [cv, c] = canvas(m.w * 16, m.h * 16, '#000');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      let g = (A.localTile && A.localTile(m, x, y)) || plain(m, m.tileAt(x, y));
      g = pick(g, frame);
      if (g) c.drawImage(g, x * 16, y * 16);
    }
    if (m.decor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const id = m.decorAt(x, y);
      if (!id) continue;
      let g = (A.decorTile && A.decorTile(m, x, y)) || G.get('decor:' + id);
      g = pick(g, frame);
      if (g) c.drawImage(g, x * 16 + ((16 - g.width) >> 1), y * 16 + 16 - g.height);
    }
    if (scale === 1) return cv;
    const [out, oc] = canvas(cv.width * scale, cv.height * scale, '#000');
    oc.drawImage(cv, 0, 0, out.width, out.height);
    return out;
  }
  function nframes(m) {
    let n = 1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const id = m.decorAt(x, y);
      if (!id) continue;
      const g = (A.decorTile && A.decorTile(m, x, y)) || G.get('decor:' + id);
      if (Array.isArray(g)) n = Math.max(n, g.length);
    }
    return n;
  }
  // a column of grounds: grass, cobbles, dirt, snow
  let GROUNDS = [',', '.', ':', '*'];
  function pieceStrip(dch, scale) {
    // one map per ground: 3 wide x 3 high, decor in the middle of the bottom row
    const parts = [];
    for (const gch of GROUNDS) {
      const rows = [gch.repeat(3), gch.repeat(3), gch.repeat(3)];
      const m = compile({ rows, decor: ['   ', '   ', ' ' + dch + ' '] });
      const n = nframes(m);
      for (let f = 0; f < n; f++) parts.push(render(m, f, scale));
    }
    return parts;
  }
  function sheet(scale, filter, grounds) {
    if (grounds) GROUNDS = grounds.split('');
    const want = (name) => !filter || filter.split(',').some((f) => name.includes(f));
    const ids = (A.DECOR_EXTERIOR || []).filter(want);
    const legend = R.DB.legends.decor, ch = {};
    for (const k in legend) ch[legend[k]] = k;
    const rows = [];
    for (const id of ids) rows.push({ name: id + ' (' + (R.DB.decor[id] || {}).name + ')', parts: pieceStrip(ch[id], scale) });
    // joined / context pieces
    const combos = [
      ['hedges', [',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,'],
        ['              ', ' 2222  2  22  ', '       2  22  ', ' 2  2  2      ', '    22222  2  ', '              ']],
      ['flowerbeds', ['..............', '..............', '..............', '..............', '..............'],
        ['              ', ' 1111  1  11  ', '       1  11  ', ' 1  1  1   11 ', '              ']],
      ['stalls (merchants stand in the row behind)', ['..............', '..............', '..............', '..............'],
        ['              ', '              ', ' 9  99  999   ', '              ']],
      ['fountains 1x1 2x2 3x3', ['..............', '..............', '..............', '..............', '..............'],
        ['              ', ' J  JJ   JJJ  ', '    JJ   JJJ  ', '         JJJ  ', '              ']],
      ['carts / bushes / haystacks / wells', [',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,', ',,,,,,,,,,,,,,'],
        ['              ', ' E E E E E E  ', ' h h h h h h  ', ' M u M u 3 3  ']],
    ];
    for (const [name, r, d] of combos) {
      if (filter && !filter.split(',').includes(name.split(' ')[0])) continue;
      const m = compile({ rows: r, decor: d });
      const n = nframes(m), parts = [];
      for (let f = 0; f < Math.min(n, 4); f++) parts.push(render(m, f, scale));
      rows.push({ name, parts, wide: true });
    }
    // lay out: rows wrap at MAXW
    const MAXW = 2000;
    const lines = [];
    for (const r of rows) {
      let line = { name: r.name, parts: [] }, w = 4;
      for (const p of r.parts) {
        if (line.parts.length && w + p.width > MAXW) { lines.push(line); line = { name: '', parts: [] }; w = 4; }
        line.parts.push(p); w += p.width + 6;
      }
      lines.push(line);
    }
    const W = Math.min(MAXW, Math.max(...lines.map((l) => l.parts.reduce((s, p) => s + p.width + 6, 8))));
    const H = lines.reduce((s, l) => s + Math.max(...l.parts.map((p) => p.height)) + (l.name ? 22 : 6), 8);
    const [cv, c] = canvas(W, H);
    let y = 4;
    for (const l of lines) {
      if (l.name) { label(c, l.name, 4, y); y += 16; }
      let x = 4;
      for (const p of l.parts) { c.drawImage(p, x, y); x += p.width + 6; }
      y += Math.max(...l.parts.map((p) => p.height)) + 6;
    }
    return cv.toDataURL();
  }
  function grounds(scale, filter) {
    const sets = [
      ['town grounds: cobble plaza, dirt path, grass (variety by position), kerbs & worn edges', {
        rows: [
          ',,,,,,,,,,,,,,,,,,,,',
          ',,,,............,,,,',
          ',,,,............,,,,',
          '::::............::::',
          '::::............::::',
          ',,,,............,,,,',
          ',,,,,,,,,::,,,,,,,,,',
          ',,,,,,,,,::,,,,ff,,,',
          ',,,,,,,,,::,,,,,,,,,',
          ':::::::::::::::::::: ',
        ].map((s) => s.slice(0, 20)) }],
      ['canals: stone edges by cobbles, earth banks by grass, bridges', {
        rows: [
          '....................',
          '....................',
          '~~~~~~~|~~~~~~~~~~~~',
          '~~~~~~~|~~~~~~~~~~~~',
          '.......:......~~~,,,',
          '.......:......~~~,,,',
          ',,,,,,,:,,,,,,~~~,,,',
          ',,,,~~~|~~~~~~~~~,,,',
          ',,,,,,,:,,,,,,,,,,,,',
        ] }],
      ['fences over the ground they stand on (grass, dirt, cobble, snow), joins and corners', {
        rows: [
          ',,,,,,,,,,::::::::::',
          ',FFFFFF,,,:FFFFFF:::',
          ',F,,,,F,,,:F::::F:::',
          ',F,,,,F,,,:FFF:FF:::',
          ',FFF,FF,,,::::::::::',
          '....................',
          '.FFFF..F....********',
          '....F..F....*FFFFF**',
          '....FFFF....*F***F**',
        ] }],
      ['snow / sand grounds', { rows: ['********dddddddd', '********dddddddd', '****::::dddd::::', '********dddddddd'] }],
    ];
    const parts = sets.filter(([name]) => !filter || filter.split(',').includes(name.split(/[ :]/)[0]))
      .map(([name, def]) => ({ name, img: render(compile(def), 0, scale) }));
    const W = Math.max(...parts.map((p) => p.img.width)) + 8;
    const H = parts.reduce((s, p) => s + p.img.height + 22, 8);
    const [cv, c] = canvas(W, H);
    let y = 4;
    for (const p of parts) { label(c, p.name, 4, y); y += 16; c.drawImage(p.img, 4, y); y += p.img.height + 6; }
    return cv.toDataURL();
  }
  function demo(def, frame, scale) {
    const m = compile(def);
    return render(m, frame, scale).toDataURL();
  }
  /** a real map from src/maps, whole, through the same art entry points */
  function realMap(id, frame, scale) {
    const m = R.FieldMap.compile(id);
    return m ? render(m, frame, scale).toDataURL() : null;
  }
  return { sheet, grounds, demo, realMap };
})();
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + HTML);
  await page.waitForTimeout(1200);
  await page.evaluate(PAGE);
  const save = (name, url) => {
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('sheet →', f);
  };
  const t0 = Date.now();
  if (ONLY.includes('sheet')) save('decor_ext_sheet', await page.evaluate(`DSHEET.sheet(${SCALE}, ${JSON.stringify(IDS)}, ${JSON.stringify(GROUNDS)})`));
  if (ONLY.includes('grounds')) save('decor_ext_grounds', await page.evaluate(`DSHEET.grounds(${SCALE}, ${JSON.stringify(IDS)})`));
  if (ONLY.includes('demo')) for (let f = 0; f < 4; f++) save('decor_ext_demo_f' + f, await page.evaluate(`DSHEET.demo(${JSON.stringify(DEMO)}, ${f}, ${Math.max(1, SCALE - 1)})`));
  for (const id of MAPS.split(',').filter(Boolean)) {
    const url = await page.evaluate(`DSHEET.realMap(${JSON.stringify(id)}, 0, ${Math.max(1, SCALE - 1)})`);
    if (url) save('decor_ext_map_' + id, url); else console.log('(no map ' + id + ')');
  }
  if (ONLY.includes('game')) {
    // the real field renderer: inject the map, start a game on it, walk a little
    await page.evaluate(`(() => { RPG.DB.maps.__decor_demo = ${JSON.stringify(DEMO)}; RPG.debug.newGameAt('__decor_demo', 'plaza'); RPG.debug.noEncounter(true); })()`);
    await page.waitForTimeout(2600); // map-name banner
    const shots = [['plaza', 0], ['plaza', 330], [{ x: 8, y: 16, dir: 'up' }, 0], [{ x: 22, y: 9, dir: 'left' }, 0]];
    let k = 0;
    for (const [sp, wait] of shots) {
      if (typeof sp === 'object') { await page.evaluate(`RPG.debug.warp('__decor_demo', ${JSON.stringify(sp)})`); await page.waitForTimeout(400); }
      if (wait) await page.waitForTimeout(wait);
      const f = path.join(OUT, 'decor_ext_game_' + (k++) + '.png');
      await page.locator('#screen').screenshot({ path: f });
      console.log('shot  →', f);
    }
  }
  console.log('done in', Date.now() - t0, 'ms');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
