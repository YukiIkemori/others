#!/usr/bin/env node
// Browser check for art-local (A16b): builds EVERY local tile, themed tile, decor
// piece and context tile in headless Chromium and verifies sizes, frame counts,
// no placeholder / exception, the secret-passage hint (subtle until found), that
// every Chronicle theme has its own art (not its fallback's), that town themes
// have their own houses and roofs, and the colour budget. Prints measured numbers.
//   node tools/check_art-local.js [-v]      exit 1 on any failure
// Loads core(ns,input,gfx) + src/data + src/art + systems/field_map.js only, so it
// works while other areas are broken.
'use strict';
const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const OUT = path.join(require('os').tmpdir(), 'check_art-local-' + process.pid);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  for (const d of ['data', 'art']) list.push(...walk(path.join(ROOT, 'src', d)).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  list.push(path.join(ROOT, 'src/systems/field_map.js'));
  return list;
}

const PAGE = String.raw`
window.CHECK = function () {
  const R = window.RPG, G = R.Gfx, A = R.Art, T = R.DB.tiles, D = R.DB.decor, TH = R.DB.themes, L = R.DB.legends;
  const res = { fails: [], notes: [], n: {} };
  const fail = (m) => res.fails.push(m);
  const frames = (g) => (Array.isArray(g) ? g : [g]);
  const px = (cv) => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  function diff(a, b) {
    const p = px(a), q = px(b);
    if (p.length !== q.length) return 1;
    let d = 0;
    for (let i = 0; i < p.length; i += 4) if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2] || p[i + 3] !== q[i + 3]) d++;
    return d / (p.length / 4);
  }
  function colours(cv) { const p = px(cv), s = new Set(); for (let i = 0; i < p.length; i += 4) if (p[i + 3]) s.add((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]); return s.size; }
  function magenta(cv) { const p = px(cv); let n = 0; for (let i = 0; i < p.length; i += 4) if (p[i] === 255 && p[i + 1] === 0 && p[i + 2] === 255 && p[i + 3] === 255) n++; return n; }
  const worldIds = new Set(R.TilesWorld ? R.TilesWorld.ids : []);
  const isLocal = (id) => !worldIds.has(id) || Object.values(L.local).includes(id);
  const t0 = performance.now();
  // ---------------------------------------------------------- plain tiles
  let tiles = 0, maxCol = 0, maxColKey = '';
  const keys = Object.keys(G._reg || {}).length ? Object.keys(G._reg) : null;
  const tileKeys = [];
  for (const id of Object.keys(T).filter(isLocal)) {
    tileKeys.push('tile:' + id);
    if (T[id].themed) for (const th of Object.keys(TH)) tileKeys.push('tile:' + th + ':' + id);
  }
  for (const th of Object.keys(TH)) if (TH[th].town) { tileKeys.push('tile:' + th + ':housewall', 'tile:' + th + ':roof'); }
  for (const key of tileKeys) {
    if (!G.has(key)) { if (!/:(housewall|roof)$/.test(key) || !/tile:town:/.test(key)) fail('missing ' + key); continue; }
    let g;
    try { g = G.get(key); } catch (e) { fail(key + ' threw ' + e.message); continue; }
    const id = key.split(':').pop();
    const fr = frames(g);
    tiles++;
    for (const cv of fr) {
      if (!cv || cv.width !== 16 || cv.height !== 16) { fail(key + ' size ' + (cv && cv.width) + 'x' + (cv && cv.height)); break; }
      if (magenta(cv) > 200) fail(key + ' looks like the placeholder');
      const c = colours(cv);
      if (c > maxCol) { maxCol = c; maxColKey = key; }
    }
    const want = T[id] && T[id].anim ? T[id].anim : 1;
    if (T[id] && fr.length % want !== 0) fail(key + ' has ' + fr.length + ' frames, data anim ' + want);
  }
  res.n.tiles = tiles; res.n.maxTileColours = maxCol + ' (' + maxColKey + ')';
  // ---------------------------------------------------------- decor
  let decor = 0, maxDW = 0, maxDH = 0;
  for (const id of Object.keys(D)) {
    const key = 'decor:' + id;
    if (!G.has(key)) { fail('missing ' + key); continue; }
    let g;
    try { g = G.get(key); } catch (e) { fail(key + ' threw ' + e.message); continue; }
    const fr = frames(g), d = D[id];
    decor++;
    for (const cv of fr) {
      if (!cv) { fail(key + ' empty frame'); break; }
      maxDW = Math.max(maxDW, cv.width); maxDH = Math.max(maxDH, cv.height);
      if (cv.width > 48 || cv.height > 48) fail(key + ' too big ' + cv.width + 'x' + cv.height);
      if (!d.tall && (cv.width !== 16 || cv.height !== 16)) fail(key + ' is not tall but ' + cv.width + 'x' + cv.height);
      if (d.tall && cv.height > 32) fail(key + ' tall piece over 32px: ' + cv.height);
      if (magenta(cv) > 100) fail(key + ' looks like the placeholder');
      // something is drawn
      const p = px(cv); let op = 0; for (let i = 3; i < p.length; i += 4) if (p[i] > 20) op++;
      if (op < 6) fail(key + ' is (almost) empty');
    }
    const want = d.anim || 1;
    if (fr.length !== want) fail(key + ' has ' + fr.length + ' frames, data anim ' + want);
  }
  res.n.decor = decor; res.n.decorMax = maxDW + 'x' + maxDH;
  // ---------------------------------------------------------- context tiles on real map compiles
  const STUDY = [
    '################',
    '#i##D##E##O##%##',
    '#..............#',
    '#.l..r...S..s..#',
    '#..............#',
    '####%####.######',
    '#......#.......#',
    '#.VV.II#GGG.Q.U#',
    '#......#.......#',
    '#.zz...%..www..#',
    '#.zzz.....w~w..#',
    '################',
  ];
  let ctx = 0, ctxNull = 0, ctxBad = 0;
  const WALLY = /^(wall|wall_torch|door|lockdoor|rock_door|secret_wall|vine_wall|ice_wall|fog_wall|story_stone|story_stone_blank|bog|mud)$/;
  for (const th of Object.keys(TH)) {
    R.DB.maps.__chk = { name: 'c', type: 'dungeon', legend: 'local', theme: th, outside: '#', rows: STUDY, spawns: { e: { x: 2, y: 2 } } };
    const m = R.FieldMap.compile('__chk');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      let g;
      try { g = A.localTile(m, x, y); } catch (e) { ctxBad++; if (ctxBad < 5) fail('localTile ' + th + ' ' + x + ',' + y + ' threw ' + e.message); continue; }
      ctx++;
      if (!g) { if (WALLY.test(m.tileAt(x, y))) { ctxNull++; if (ctxNull < 5) fail('no context art for ' + th + ':' + m.tileAt(x, y)); } continue; }
      for (const cv of frames(g)) if (cv.width !== 16 || cv.height !== 16) { ctxBad++; fail('context tile size ' + th + ' ' + x + ',' + y); break; }
    }
  }
  delete R.DB.maps.__chk;
  res.n.contextCells = ctx;
  // ---------------------------------------------------------- secret passages: subtle until found
  let minHint = 1, maxHint = 0, minFound = 1;
  for (const th of Object.keys(TH)) {
    const wall = A.wallFace(th, true, 0).toCanvas();
    const hid = A.secretWallArt(th, { capTop: true, x: 0, found: false }).toCanvas();
    const fnd = A.secretWallArt(th, { capTop: true, x: 0, found: true }).toCanvas();
    const h = diff(wall, hid), f = diff(wall, fnd);
    minHint = Math.min(minHint, h); maxHint = Math.max(maxHint, h); minFound = Math.min(minFound, f);
    if (h <= 0) fail('secret wall of ' + th + ' has no hint at all');
    if (h > 0.16) fail('secret wall of ' + th + ' is too obvious (' + (h * 100).toFixed(1) + '% of pixels differ)');
    if (f <= h) fail('found secret of ' + th + ' does not stand out more than the hidden one');
    const top0 = A.wallTop(th, { n: true }).toCanvas(), top1 = A.secretWallArt(th, { top: true, edges: { n: true } }).toCanvas();
    if (diff(top0, top1) > 0.16) fail('secret wall top of ' + th + ' too obvious');
  }
  res.n.secretHint = (minHint * 100).toFixed(1) + '–' + (maxHint * 100).toFixed(1) + '% px (found ≥ ' + (minFound * 100).toFixed(1) + '%)';
  // ---------------------------------------------------------- each Chronicle theme has its own art
  let own = 0;
  for (const th of Object.keys(TH)) {
    const fb = TH[th].fallback;
    if (!fb) continue;
    const df = diff(G.get('tile:' + th + ':floor'), G.get('tile:' + fb + ':floor'));
    const dw = diff(frames(G.get('tile:' + th + ':wall'))[0], frames(G.get('tile:' + fb + ':wall'))[0]);
    if (df < 0.3 && dw < 0.3) fail(th + ' still looks like its fallback ' + fb + ' (floor ' + df.toFixed(2) + ', wall ' + dw.toFixed(2) + ')');
    else own++;
    if (TH[th].town) {
      const dh = diff(A.houseWallArt({ window: true }, th).toCanvas(), A.houseWallArt({ window: true }, 'town').toCanvas());
      const dr = diff(A.roofArt({ ridge: true }, th).toCanvas(), A.roofArt({ ridge: true }, 'town').toCanvas());
      if (dh < 0.2 && TH[th] && A.THEME_DEFS[th].hw !== 'timber') fail(th + ' house wall looks like the Crest town');
      if (dr < 0.2) fail(th + ' roof looks like the Crest town');
    }
  }
  res.n.themesWithOwnArt = own;
  // ---------------------------------------------------------- outside trees & tree species
  // The field draws cells beyond the edge with 'tile:<theme>:<outside>'; a wood's
  // border must continue the trees inside the map (a tree in the middle of a wood).
  const WOOD = ['TTTTT', 'TTTTT', 'TTTTT', 'TTTTT', 'TTTTT'];
  let outTrees = 0;
  const treeOf = {};
  for (const th of Object.keys(TH)) {
    const key = 'tile:' + th + ':tree';
    if (!G.has(key)) { fail('no outside tree ' + key); continue; }
    const cv = frames(G.get(key))[0];
    if (!cv || cv.width !== 16 || cv.height !== 16) { fail(key + ' is not 16x16'); continue; }
    R.DB.maps.__wood = { name: 'w', type: TH[th].town ? 'town' : 'dungeon', legend: 'local', theme: th, outside: 'T', rows: WOOD, spawns: { e: { x: 2, y: 2 } } };
    const inner = frames(A.localTile(R.FieldMap.compile('__wood'), 2, 2))[0];
    if (diff(cv, inner) > 0) fail(key + ' differs from a tree inside a wood (' + (diff(cv, inner) * 100).toFixed(0) + '% px)');
    treeOf[th] = cv;
    outTrees++;
  }
  for (const th of ['town_snow', 'town_ash', 'town_sand']) if (treeOf[th] && diff(treeOf[th], G.get('tile:tree')) < 0.2) fail(th + ' outside tree looks like the plain lawn tree');
  if (treeOf.town_snow && treeOf.snow && diff(treeOf.town_snow, treeOf.snow) > 0.6) fail('the snow village and the snow peak grow different firs');
  // canal bank beside a wood: the theme's natural ground, never a lawn lip in snow / sand / ash
  const POND = ['TTTTT', 'T~~~T', 'T~~~T', 'T~~~T', 'TTTTT'];
  const greenLip = (cv) => { const p = px(cv); let n = 0; for (let i = 0; i < p.length; i += 4) if (p[i + 1] > p[i] + 18 && p[i + 1] > p[i + 2] + 18) n++; return n; };
  let banks = 0;
  for (const th of ['town_snow', 'town_sand', 'town_ash']) {
    R.DB.maps.__pond = { name: 'p', type: 'town', legend: 'local', theme: th, outside: 'T', rows: POND, spawns: { e: { x: 2, y: 2 } } };
    const pm = R.FieldMap.compile('__pond');
    for (const [x, y] of [[1, 1], [3, 1], [1, 3], [3, 3], [2, 1], [1, 2]]) {
      const cv = frames(A.localTile(pm, x, y))[0];
      const g = cv ? greenLip(cv) : 0;
      banks++;
      if (g > 6) fail(th + ' pond bank at ' + x + ',' + y + ' has a green lawn lip (' + g + ' px)');
    }
  }
  // the ember is a glowing red crack: a hot core in both frames, no pale-straw sticks
  let emberHot = 99, emberPale = 0;
  if (G.has('decor:ember')) for (const cv of frames(G.get('decor:ember'))) {
    const p = px(cv); let hot = 0, pale = 0;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 128) continue;
      if (p[i] > 170 && p[i + 1] < 150 && p[i + 2] < 90) hot++;
      if (p[i] > 200 && p[i + 1] > 190 && p[i + 2] > 120) pale++;
    }
    emberHot = Math.min(emberHot, hot); emberPale = Math.max(emberPale, pale);
  }
  if (emberHot < 10) fail('decor:ember has only ' + emberHot + ' red-hot px');
  if (emberPale > 6) fail('decor:ember has ' + emberPale + ' pale px (reads as sticks)');
  // ---------------------------------------------------------- readability on pale floors
  // a fog bank must read as a barrier on snow / marble / paper (not as more floor), and
  // a snow-covered wall top must be a step darker than the open snow underfoot
  const lum = (cv) => { const p = px(cv); let s = 0, n = 0; for (let i = 0; i < p.length; i += 4) if (p[i + 3] > 128) { s += p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11; n++; } return n ? s / n : 0; };
  const apart = (cv, ref) => { const p = px(cv); let n = 0; for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11 - ref) > 30) n++; return n; };
  const FOG = ['#######', '#.....#', '#.GGG.#', '#.....#', '#######'];
  let fogMin = 999;
  for (const th of ['snow', 'library', 'oblivion', 'town_white', 'town_isle']) {
    R.DB.maps.__fog = { name: 'f', type: TH[th].town ? 'town' : 'dungeon', legend: 'local', theme: th, outside: '#', rows: FOG, spawns: { e: { x: 1, y: 1 } } };
    const fm = R.FieldMap.compile('__fog');
    const floorL = lum(frames(A.localTile(fm, 1, 1))[0]);
    const cv = frames(A.localTile(fm, 3, 2))[0];
    const n = apart(cv, floorL);
    fogMin = Math.min(fogMin, n);
    if (n < 70) fail(th + ': fog_wall has only ' + n + ' px set apart from the floor (hard to see)');
  }
  const SNOWM = ['#####', '#####', '#####', '#...#', '#...#', '#...#', '#####'];
  R.DB.maps.__snow = { name: 's', type: 'dungeon', legend: 'local', theme: 'snow', outside: '#', rows: SNOWM, spawns: { e: { x: 2, y: 4 } } };
  const sm = R.FieldMap.compile('__snow');
  const snowFloorL = lum(frames(A.localTile(sm, 2, 4))[0]), snowTopL = lum(frames(A.localTile(sm, 2, 1))[0]);
  if (snowTopL > snowFloorL - 12) fail('snow: wall top (' + snowTopL.toFixed(0) + ') is not darker than the snow floor (' + snowFloorL.toFixed(0) + ')');
  res.n.pale = 'fog ≥ ' + fogMin + ' px set apart from pale floors; snow top ' + snowTopL.toFixed(0) + ' vs floor ' + snowFloorL.toFixed(0);
  res.n.outside = outTrees + ' themed outside trees, ' + banks + ' bank cells, ember ' + emberHot + ' hot / ' + emberPale + ' pale px';
  res.ms = Math.round(performance.now() - t0);
  res.warned = Object.keys(G._warned || {});
  return res;
};
`;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'page.js'), PAGE);
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>\n' +
    sources().map((f) => `<script src="file://${f}"></script>`).join('\n') + `\n<script src="file://${path.join(OUT, 'page.js')}"></script></body></html>`;
  fs.writeFileSync(path.join(OUT, 'check.html'), html);
  const browser = await playwright.chromium.launch();
  let code = 0;
  try {
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + path.join(OUT, 'check.html'));
    await page.waitForTimeout(200);
    const res = await page.evaluate(() => window.CHECK());
    const mine = errors.filter((e) => /src\/(data\/tiles|art\/(tiles|decor))/.test(e) || !/file:\/\//.test(e));
    for (const e of errors) if (VERBOSE || mine.includes(e)) console.log('[page] ' + e.split('\n')[0]);
    console.log('built: ' + res.n.tiles + ' tile keys, ' + res.n.decor + ' decor pieces, ' + res.n.contextCells + ' context cells in ' + res.ms + ' ms');
    console.log('max colours in a tile: ' + res.n.maxTileColours + ';  largest decor: ' + res.n.decorMax);
    console.log('secret hint: ' + res.n.secretHint + ';  themes with their own art: ' + res.n.themesWithOwnArt);
    console.log('outside: ' + res.n.outside);
    console.log('pale floors: ' + res.n.pale);
    if (res.warned.length) console.log('placeholder warnings: ' + res.warned.join(' '));
    for (const f of res.fails) console.log('  FAIL ' + f);
    const bad = res.fails.length + res.warned.filter((k) => /^(tile|decor):/.test(k)).length + mine.length;
    console.log(bad ? 'check_art-local: ' + bad + ' problem(s)' : 'check_art-local: all good');
    code = bad ? 1 : 0;
  } finally {
    await browser.close();
    fs.rmSync(OUT, { recursive: true, force: true });
  }
  process.exit(code);
}
main().catch((e) => { console.error(e); process.exit(2); });
