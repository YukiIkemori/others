#!/usr/bin/env node
// Unit + spec-conformance tests for art-local (A16b, DESIGN §13.1): local tiles,
// legends, themes, decor, the RS1 palette and the art registry. Node only (no DOM:
// art is registered, not built — tools/check_art-local.js builds every piece in a
// browser). Tables are parsed from DESIGN.md where the spec gives them, so the data
// cannot drift from the spec silently.
//   node tools/test_art-local.js [-v]        exit 1 on any failure
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true });

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); }
  else { fail++; fails.push(msg); console.log('  FAIL ' + msg); }
}
function section(name) { if (VERBOSE) console.log('\n# ' + name); }
const DESIGN = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
/** lines of a DESIGN.md section from a heading prefix up to the next heading of the same depth */
function sectionLines(head) {
  const lines = DESIGN.split('\n');
  const i = lines.findIndex((l) => l.startsWith(head));
  if (i < 0) return [];
  const depth = head.match(/^#+/)[0].length;
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].match(/^(#+) /);
    if (m && m[1].length <= depth) break;
    out.push(lines[j]);
  }
  return out;
}
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const hexes = (s) => (s.match(/0x[0-9a-fA-F]{6}/g) || []).map((h) => parseInt(h, 16));
const T = R.DB.tiles, D = R.DB.decor, TH = R.DB.themes, L = R.DB.legends, A = R.Art;

// ------------------------------------------------------------ load
section('load');
ok(!(R._nodeLoadErrors || []).some((e) => /src\/(data\/tiles|art\/(tiles|decor))/.test(e)), 'my files load without errors: ' + (R._nodeLoadErrors || []).filter((e) => /tiles|decor/.test(e)).join(' | '));

// ------------------------------------------------------------ local tiles §11.2.9
section('local tiles (§11.2.9)');
{
  const rows = sectionLines('#### 11.2.9').filter((l) => /^\| `/.test(l));
  ok(rows.length === 9, '§11.2.9 lists 9 new local tiles (got ' + rows.length + ')');
  for (const r of rows) {
    const [idc, chc, name, passc, other] = cells(r);
    const id = idc.replace(/`/g, ''), ch = chc.replace(/`/g, '');
    const t = T[id];
    ok(!!t, id + ' defined');
    if (!t) continue;
    ok(L.local[ch] === id, id + ' has local legend char ' + ch);
    ok(t.name === name, id + ' name ' + name + ' (got ' + t.name + ')');
    ok(!!t.pass === (passc === '○'), id + ' pass ' + passc);
    if (/themed/.test(other)) ok(t.themed === true, id + ' themed');
    const an = other.match(/anim (\d)/);
    if (an) ok(t.anim === +an[1], id + ' anim ' + an[1]);
  }
  // secret passage §3.3.10-11
  ok(T.secret_wall && T.secret_wall.pass === true && T.secret_wall.themed === true && T.secret_wall.secret === true, 'secret_wall: pass, themed, secret');
  ok(L.local['%'] === 'secret_wall', "secret_wall on local '%'");
  // closed tiles carry `closed`
  for (const id of ['lockdoor', 'vine_wall', 'ice_wall', 'fog_wall', 'rock_door', 'seal']) ok(T[id].closed === true && T[id].pass === false, id + ' closed & impassable');
  // lockdoor must not open like a door (the field opens ids starting with "door")
  ok(!/^door/.test('lockdoor') && !T.lockdoor.lock, 'lockdoor is not a door the field auto-opens');
  // damage floors §3.3.10-10
  ok(T.lava.damagePct === 4 && T.lava.damage == null, 'lava damagePct 4, no fixed damage');
  ok(T.poison.damagePct === 2 && T.poison.damage == null, 'poison damagePct 2, no fixed damage');
  ok(T.swamp.damagePct === 2 && T.swamp.damage == null, 'world swamp damagePct 2, no fixed damage');
  // every Crest local tile kept
  for (const id of ['void', 'floor', 'wall', 'wall_torch', 'lgrass', 'dirt', 'wood', 'carpet', 'sand', 'snowfloor', 'ice', 'water', 'lava', 'poison', 'tree', 'flowers', 'fence', 'door', 'door_silver', 'door_gold', 'seal', 'counter', 'table', 'chair', 'bed', 'bookshelf', 'shelf', 'pot', 'barrel', 'crate', 'throne', 'pillar', 'altar', 'stairs_up', 'stairs_down', 'lbridge_h', 'lbridge_v', 'rock', 'statue', 'sign', 'well', 'grave', 'warp_pad', 'pedestal', 'housewall', 'roof', 'pit']) ok(!!T[id], 'kept ' + id);
  // brief A2: chairs and trees are walkable
  ok(T.chair.pass && T.tree.pass && T.flowers.pass, 'chair / tree / flowers walkable (brief A2)');
}

// ------------------------------------------------------------ legends §11.11.2
section('legends (§11.11.2)');
{
  const lines = sectionLines('#### 11.11.2');
  const parse = (label) => {
    const l = lines.find((x) => x.startsWith('- ' + label));
    const out = {};
    for (const m of l.matchAll(/`([^`]+)` ([a-z_]+)/g)) out[m[1]] = m[2];
    return out;
  };
  const loc = parse('局所');
  ok(Object.keys(loc).length === 10, '§11.11.2 local: 10 chars');
  for (const ch in loc) ok(L.local[ch] === loc[ch], 'local ' + ch + ' → ' + loc[ch]);
  const dec = parse('飾り');
  ok(Object.keys(dec).length === 28, '§11.11.2 decor: 28 chars (got ' + Object.keys(dec).length + ')');
  for (const ch in dec) ok(L.decor[ch] === dec[ch], 'decor ' + ch + ' → ' + dec[ch]);
  for (const ch of '|:,') ok(!(ch in L.decor), "decor spare char '" + ch + "' left free");
  ok(R.DECOR_SPARE_CHARS === '|:,', 'R.DECOR_SPARE_CHARS');
  // mark chars
  for (const ch of R.MARK_CHARS_LOCAL) ok(!(ch in L.local), 'mark char ' + JSON.stringify(ch) + ' is not a local legend char');
  for (const ch of 'EVIGOQUwz%') ok(!R.MARK_CHARS_LOCAL.includes(ch), 'MARK_CHARS_LOCAL drops ' + ch);
  for (const ch of '@0456789!?$&<>{}[]();"\'`-/\\AHJMNXZnvy') ok(R.MARK_CHARS_LOCAL.includes(ch), 'MARK_CHARS_LOCAL keeps ' + JSON.stringify(ch));
  for (const ch of '%&') ok(!R.MARK_CHARS_WORLD.includes(ch), 'MARK_CHARS_WORLD drops ' + ch + ' (world secrets)');
  for (const ch of R.MARK_CHARS_WORLD) ok(!(ch in L.world), 'world mark char ' + ch + ' free');
  // every legend entry resolves
  for (const [n, leg] of Object.entries(L)) for (const [ch, id] of Object.entries(leg)) ok(n === 'decor' ? !!D[id] : !!T[id], n + ' ' + JSON.stringify(ch) + ' → ' + id + ' exists');
  // Crest's world legend entries survive the merge (tiles_world.js may extend but not lose them)
  for (const [ch, id] of Object.entries({ '~': 'sea', '.': 'grass', T: 'forest', M: 'mountain', V: 'loc_town' })) ok(L.world[ch] === id, 'world legend keeps ' + ch + ' → ' + id);
}

// ------------------------------------------------------------ themes §11.2.6 / §11.2.8
section('themes (§11.2.6, §11.2.8)');
{
  const want = {};
  // DB.themes rows given in §11.2.8
  const line = sectionLines('#### 11.2.8').find((l) => l.startsWith('- `DB.themes` に足す行'));
  for (const m of line.matchAll(/([a-z_]+):\{name:'([^']+)', bbg:'([a-z_]+)', fallback:'([a-z_]+)'\}/g)) want[m[1]] = { name: m[2], bbg: m[3], fallback: m[4] };
  ok(Object.keys(want).length === 9, '§11.2.8 gives 9 dungeon theme rows');
  for (const id in want) {
    const t = TH[id];
    ok(!!t, 'theme ' + id);
    if (!t) continue;
    ok(t.name === want[id].name && t.bbg === want[id].bbg && t.fallback === want[id].fallback, id + ' = {' + want[id].name + ', ' + want[id].bbg + ', ' + want[id].fallback + '}');
  }
  const towns = ['town_roa', 'town_forest', 'town_sand', 'town_snow', 'town_marsh', 'town_isle', 'town_mine', 'town_ash', 'town_star', 'town_white'];
  for (const id of towns) ok(TH[id] && TH[id].bbg === 'grass' && TH[id].fallback === 'town' && TH[id].town === true, id + ' {bbg grass, fallback town, town}');
  // §10.6.1: every town / dungeon theme used by the places table exists
  for (const l of sectionLines('#### 10.6.1').concat(sectionLines('#### 10.6.2'))) {
    for (const m of l.matchAll(/\| (town(?:_[a-z]+)?|tower|forest|tree|pyramid|ice|snow|manor|swamp|water|ship|mine|volcano|library|oblivion)(?:（新）)? \|/g)) ok(!!TH[m[1]], '§10.6 theme ' + m[1] + ' registered');
  }
  // art rows: every data theme has its own theme art row (no fallback needed any more)
  for (const id of Object.keys(TH)) {
    ok(!!A.THEME_DEFS[id], 'theme art row for ' + id);
    ok(A.themeOf(id) === id, 'themeOf(' + id + ') = itself');
  }
  // fallback chain for themes added later without art (§11.1.3)
  TH.__t1 = { name: 't', bbg: 'grass', fallback: '__t2' }; TH.__t2 = { name: 't', bbg: 'grass', fallback: 'manor' };
  ok(A.themeOf('__t1') === 'manor', 'themeOf follows a fallback chain');
  TH.__t3 = { name: 't', bbg: 'grass', fallback: '__t3' };
  ok(A.themeOf('__t3') === 'generic', 'themeOf survives a fallback loop');
  ok(A.themeOf('nope') === 'generic' && A.themeOf(null) === 'generic', 'themeOf unknown → generic');
  delete TH.__t1; delete TH.__t2; delete TH.__t3;
  ok(A.isTownTheme('town') && A.isTownTheme('town_ash') && !A.isTownTheme('castle') && !A.isTownTheme('forest'), 'isTownTheme');
  ok(A.isOutdoorTheme('forest') && A.isOutdoorTheme('snow') && A.isOutdoorTheme('swamp') && !A.isOutdoorTheme('mine'), 'outdoor dungeon themes');

  // §11.2.8 P1 ramps (fl, wl) are the ones the theme rows use
  for (const r of sectionLines('#### 11.2.8').filter((l) => /^\| `[a-z]+` \|/.test(l))) {
    const c = cells(r), id = c[0].replace(/`/g, '');
    const fl = hexes(c[3]), wl = hexes(c[4]), th = A.THEME_DEFS[id];
    ok(th && fl.every((v, i) => th.fl[i] === v), id + ' floor ramp = §11.2.8');
    ok(th && wl.every((v, i) => th.wl[i] === v), id + ' wall ramp = §11.2.8');
  }
  // §11.2.6 roof colours (dark → light pair) and wall/floor kinds
  const KIND = { dirt: 'dirt', cobble: 'cobble', blocks: 'blocks', planks: 'planks', flags: 'flags', slabs: 'slabs', basalt: 'basalt', diamond: 'diamond', marble: 'marble' };
  for (const r of sectionLines('#### 11.2.6').filter((l) => /^\| [^|]+ \| `town/.test(l))) {
    const c = cells(r), id = c[1].replace(/`/g, '').replace(/（.*$/, ''), th = A.THEME_DEFS[id];
    ok(!!th, 'town theme row ' + id);
    if (!th) continue;
    const fk = (c[2].match(/`([a-z]+)`/) || [])[1];
    if (fk && KIND[fk]) ok(th.floor === KIND[fk], id + ' street kind ' + fk + ' (got ' + th.floor + ')');
    const roof = hexes(c[4]);
    if (roof.length === 2) ok(th.roof && th.roof[0] === roof[0] && th.roof[1] === roof[1], id + ' roof ' + roof.map((v) => v.toString(16)).join('→'));
    ok(!!th.hw && !!th.roofKind, id + ' has a house-wall and roof style');
  }
  ok(A.THEME_DEFS.town.fl.join() === [0x46423a, 0x6e685a, 0x8e8674, 0xaaa28c, 0xc4bca6].join(), 'town street ramp = §11.2.2');
}

// ------------------------------------------------------------ palette §11.2.2
section('palette (§11.2.2)');
{
  const P = A.TK.PAL;
  let n = 0;
  for (const r of sectionLines('#### 11.2.2').filter((l) => /^\| `[a-z]+`/.test(l))) {
    const c = cells(r), key = c[0].replace(/`/g, '').replace(/（.*$/, ''), vals = hexes(c[1]);
    n++;
    ok(Array.isArray(P[key]) && P[key].length === vals.length && vals.every((v, i) => P[key][i] === v), 'PAL.' + key + ' = §11.2.2');
  }
  ok(n === 21, '§11.2.2 has 21 palette rows (got ' + n + ')');
  // unchanged ramps keep their step counts (callers index into them)
  const STEPS = { magma: 6, crust: 4, wood: 6, red: 6, gold: 6, silver: 6, purple: 6, blue: 6, skin: 3, leaf: 5 };
  for (const k in STEPS) ok(P[k] && P[k].length === STEPS[k], 'PAL.' + k + ' keeps ' + STEPS[k] + ' steps');
}

// ------------------------------------------------------------ decor §11.2.10
section('decor (§11.2.10)');
{
  const lines = sectionLines('#### 11.2.10');
  const rows = lines.filter((l) => /^\| `[a-z_]+` \|/.test(l));
  const global = rows.filter((l) => cells(l).length === 7), perMap = rows.filter((l) => cells(l).length === 5);
  ok(global.length === 28, '28 global decor rows (got ' + global.length + ')');
  ok(perMap.length === 17, '17 map-legend decor rows (got ' + perMap.length + ')');
  const props = (s) => ({ tall: /tall/.test(s), pass: /pass/.test(s), wall: /wall/.test(s), auto: /auto/.test(s), counter: /counter/.test(s), anim: (s.match(/anim (\d)/) || [])[1] });
  for (const r of global.concat(perMap)) {
    const c = cells(r), id = c[0].replace(/`/g, ''), d = D[id];
    ok(!!d, 'decor ' + id);
    if (!d) continue;
    const want = props(c[c.length === 7 ? 3 : 2]);
    // names follow STYLE_JA §2 (no kanji outside the jōyō list + the allowed set): 舵 → かじ
    const specName = c[c.length === 7 ? 2 : 1], STYLE_FIX = { '舵輪': '船のかじ' };
    ok(d.name === (STYLE_FIX[specName] || specName), id + ' name ' + specName);
    for (const k of ['tall', 'pass', 'wall', 'auto', 'counter']) ok(!!d[k] === want[k], id + ' ' + k + '=' + want[k]);
    if (want.anim) ok(d.anim === +want.anim, id + ' anim ' + want.anim);
    if (c.length === 5) ok(!Object.values(L.decor).includes(id) && R.DECOR_MAP_ONLY.includes(id), id + ' is map-legend only');
  }
  // regional set pieces (§11.2.11 見せ場) added by art-local
  for (const id of ['sunken_bell', 'mural_firebird']) ok(!!D[id] && R.DECOR_MAP_ONLY.includes(id), id + ' registered (map legend)');
  for (const id of ['arch_over', 'leaves_over']) ok(D[id] && D[id].over === true && D[id].pass === true && R.DECOR_MAP_ONLY.includes(id), id + ' over-layer decor (walkable, map legend)');
  // brief A2: seats, trees and soft small things are walkable
  for (const id of ['stool', 'bench', 'rug', 'rug_blue', 'rug_round', 'straw', 'leaves', 'flowers_low', 'plant', 'flowerbed', 'haystack', 'bush', 'palm', 'snowpile', 'laundry', 'paper_drift', 'mushrooms', 'cobweb', 'rope_coil', 'broken_chair', 'ash_pile', 'stage', 'rails', 'ember', 'hot_spring', 'ivy'])
    ok(D[id] && D[id].pass === true, id + ' walkable (brief A2)');
  // every Crest decor kept
  for (const id of ['banner_red', 'window', 'sconce', 'rug', 'dais', 'fireplace', 'table_long', 'plant', 'candelabra', 'clock', 'flowerbed', 'hedge', 'lamp', 'stall', 'fountain', 'well_small']) ok(!!D[id], 'kept decor ' + id);
  ok(D.lamp.anim === 4, 'lamp anim matches its 4 frames');
}

// ------------------------------------------------------------ art registry
section('art registry');
{
  const G = R.Gfx;
  const WORLD = new Set(Object.values(L.world).concat(R.TilesWorld ? R.TilesWorld.ids : []));
  const local = Object.keys(T).filter((id) => !WORLD.has(id) || Object.values(L.local).includes(id));
  for (const id of local) ok(G.has('tile:' + id), 'tile:' + id + ' registered');
  for (const theme of Object.keys(TH)) for (const id of R.TILE_THEMED) ok(G.has('tile:' + theme + ':' + id), 'tile:' + theme + ':' + id);
  for (const id of Object.keys(D)) ok(G.has('decor:' + id), 'decor:' + id + ' registered');
  for (const id of Object.keys(D).filter((k) => D[k].auto)) ok(typeof A.decorAuto[id] === 'function', 'decorAuto.' + id);
  for (const theme of Object.keys(TH).filter((k) => TH[k].town)) ok(G.has('tile:' + theme + ':housewall') || theme === 'town', 'house wall art for ' + theme);
  ok(typeof A.localTile === 'function' && A.localTile._exterior === true, 'R.Art.localTile (with the outdoor wrapper)');
  for (const fn of ['themeOf', 'secretWallArt', 'lockDoorArt', 'rockDoorArt', 'lockOverlay', 'themeTorch', 'houseWallArt', 'roofArt', 'wallFace', 'wallTop', 'floorVariant'])
    ok(typeof A[fn] === 'function', 'R.Art.' + fn);
  ok(Array.isArray(A.LIFE_DECOR) && Array.isArray(A.OUTDOOR_DECOR) && Array.isArray(A.DUNGEON_DECOR), 'decor id lists for the sheet tools');
  ok(!(A.PENDING || []).some((k) => /^(tile|decor):/.test(k)), 'no tile/decor id waiting for art (R.Art.PENDING)');
}

// ------------------------------------------------------------ context tiler (no DOM: stub canvases)
section('context tiler');
{
  // swap the canvas factory for a stub so factories can run in node
  const G = R.Gfx, real = G.makeCanvas;
  let made = 0;
  G.makeCanvas = (w, h) => { made++; const d = new Uint8ClampedArray(w * h * 4); return { width: w, height: h, getContext: () => ({ createImageData: (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) }), putImageData() {}, drawImage() {}, fillRect() {} }), _d: d }; };
  const mapOf = (theme, rows, decor) => ({
    id: 'test_' + theme, theme, w: rows[0].length, h: rows.length, outside: 'wall',
    tileAt(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? this.outside : L.local[rows[y][x]] || 'floor'; },
    decorAt(x, y) { return decor && x >= 0 && y >= 0 && x < this.w && y < this.h ? L.decor[decor[y][x]] || null : null; },
    decor: decor || null,
  });
  const rows = ['########', '#i#E#O%#', '#......#', '#V.I.G.#', '#.zz.ww#', '##%##.##', '#..Q.U.#', '########'];
  let errs = 0, nulls = [];
  for (const theme of Object.keys(TH)) {
    const m = mapOf(theme, rows);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      try {
        const g = A.localTile(m, x, y);
        const id = m.tileAt(x, y);
        if (!g && /^(wall|wall_torch|lockdoor|rock_door|secret_wall|vine_wall|ice_wall|fog_wall|story_stone|story_stone_blank|bog|mud)$/.test(id)) nulls.push(theme + ':' + id);
      } catch (e) { errs++; if (errs < 4) console.log('    ' + theme + ' ' + x + ',' + y + ': ' + e.message); }
    }
  }
  ok(errs === 0, 'localTile renders every study cell in every theme (' + errs + ' errors)');
  ok(nulls.length === 0, 'context art for every wall / closed / secret cell (' + nulls.slice(0, 5).join(' ') + ')');
  // found secrets draw differently (cache key includes R.Game.secrets)
  R.Game = R.Game || {}; R.Game.secrets = {};
  const m = mapOf('cave', rows);
  const a0 = A.localTile(m, 6, 1);
  R.Game.secrets[m.id + ':6,1'] = true;
  const a1 = A.localTile(m, 6, 1);
  ok(a0 && a1 && a0 !== a1, 'secret_wall shows the "found" look once R.Game.secrets has the cell');
  // decor builders run for every id in a few themes
  let derr = 0;
  const drows = ['#######', '#.....#', '#.....#', '#######'];
  for (const theme of ['house', 'town', 'tree', 'ship', 'town_isle']) for (const id of Object.keys(D)) {
    const ch = Object.keys(L.decor).find((k) => L.decor[k] === id) || '|';
    const dl = Object.assign({}, L.decor, { '|': id });
    const dm = mapOf(theme, drows, ['.......', '..' + ch + ch + '...', '..' + ch + '....', '.......']);
    dm.decorAt = function (x, y) { const r = this.decor[y]; return r && dl[r[x]] || null; };
    try { if (A.decorTile) A.decorTile(dm, 2, 1); } catch (e) { derr++; if (derr < 4) console.log('    decor ' + id + ' on ' + theme + ': ' + e.message); }
  }
  ok(derr === 0, 'decor context builders run for every id (' + derr + ' errors)');
  // themeAreas: patchwork maps (§11.2.11 継ぎはぎの森)
  const pm = mapOf('oblivion', rows);
  pm.def = { themeAreas: [{ x: 0, y: 0, w: 4, h: 8, theme: 'forest' }, { x: 2, y: 5, w: 2, h: 2, theme: 'snow' }] };
  ok(A.themeAt(pm, 1, 1) === 'forest' && A.themeAt(pm, 3, 6) === 'snow' && A.themeAt(pm, 6, 2) === 'oblivion', 'themeAt honours def.themeAreas (last area wins)');
  const fm = mapOf('forest', rows); fm.id = pm.id; fm._artSalt = undefined;
  const fa = A.localTile(pm, 1, 2), fb = A.localTile(fm, 1, 2);
  ok(fa === fb, 'a forest area inside an oblivion map draws forest art');
  G.makeCanvas = real;
  if (VERBOSE) console.log('    (' + made + ' stub canvases)');
}

// ------------------------------------------------------------ text (STYLE_JA §2, §7.3)
section('text');
{
  const joyoFile = path.join(ROOT, 'tools/lib/joyo.txt');
  if (fs.existsSync(joyoFile)) {
    const joyo = new Set([...fs.readFileSync(joyoFile, 'utf8').trim()]);
    for (const ch of '杖槍斧鞭鎧兜棍閃狼巫砦傭鷹槌吠沌翔淵獅鷲狐樺蓮凪叉') joyo.add(ch);
    const worldIds = new Set(R.TilesWorld ? R.TilesWorld.ids : []); // art-world's names are theirs
    const names = [].concat(Object.keys(T).filter((k) => !worldIds.has(k)).map((k) => T[k].name), Object.keys(D).map((k) => D[k].name), Object.keys(TH).map((k) => TH[k].name));
    const bad = new Set();
    for (const n of names) for (const ch of String(n || '')) { const c = ch.codePointAt(0); if (c >= 0x4e00 && c <= 0x9fff && !joyo.has(ch)) bad.add(ch + '(' + n + ')'); }
    ok(bad.size === 0, 'tile / decor / theme names use jōyō kanji only: ' + [...bad].join(' '));
  }
  const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', 'スライム', 'メタル', 'ジョブ', 'アビリティ', '魔法', '魔力', '教会'];
  for (const f of ['src/data/tiles.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const strs = src.match(/'[^'\n]*'/g) || [];
    const hit = BANNED.filter((w) => strs.some((q) => q.includes(w)));
    ok(hit.length === 0, f + ': no banned words in strings (' + hit.join(' ') + ')');
  }
}

section('outside trees & tree species (field draws outside cells with tile:<theme>:<outside>)');
{
  const A = R.Art, TH = R.DB.themes;
  ok(typeof A.natGround === 'function' && typeof A.treeStyle === 'function' && typeof A.outsideTile === 'function', 'R.Art.natGround / treeStyle / outsideTile');
  for (const th of Object.keys(TH)) ok(R.Gfx.has('tile:' + th + ':tree'), 'tile:' + th + ':tree registered (outside trees follow the theme)');
  const NG = { town_snow: 'snowfloor', town_sand: 'sand', town_ash: 'dirt', town: 'lgrass', town_roa: 'lgrass', town_forest: 'lgrass', town_isle: 'lgrass', town_white: 'lgrass', forest: 'floor', swamp: 'floor', snow: 'floor' };
  for (const th in NG) ok(A.natGround(th) === NG[th], 'natural ground of ' + th + ' = ' + NG[th] + ' (got ' + A.natGround(th) + ')');
  const TS = { town_snow: 'snow', snow: 'snow', ice: 'snow', town_ash: 'ash', volcano: 'ash', forest: 'deep', tree: 'deep', swamp: 'deep', town: '', town_forest: '', town_sand: '', town_isle: '' };
  for (const th in TS) ok(A.treeStyle(th, 'lgrass') === TS[th], 'tree species in ' + th + ' = ' + (TS[th] || 'broadleaf'));
  ok(A.treeStyle('town', 'snowfloor') === 'snow', 'a tree on snow is a fir in any theme');
  ok(typeof A.ashTreeArt === 'function', 'scorched tree art (R.Art.ashTreeArt)');
}

console.log('\ntest_art-local: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log(fails.slice(0, 40).map((f) => ' - ' + f).join('\n')); process.exit(1); }
