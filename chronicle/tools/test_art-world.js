#!/usr/bin/env node
// Unit tests for art-world (A16a): world tile data & legend (src/data/tiles_world.js),
// world renderer registration (src/art/tiles_world*.js) and battle backdrops
// (src/art/battlebg*.js). Node only (art is registered, not built — pixel checks
// are in tools/check_art-world.js). Exit 1 on any failure.
//
//   node tools/test_art-world.js [-v]
'use strict';
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const VERBOSE = process.argv.includes('-v');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) { if (cond) { pass++; if (VERBOSE) console.log('  ok  ', msg); } else { fail++; failures.push(msg); console.log('  FAIL', msg); } }
function section(name) { if (VERBOSE) console.log('\n# ' + name); }

const T = R.DB.tiles, L = R.DB.legends.world, G = R.Gfx, A = R.Art;
const mine = (f) => !f || /tiles_world|battlebg|sheet_tiles|art-world/.test(f);
const myErrors = (R._nodeLoadErrors || []).filter((e) => /tiles_world|battlebg/.test(e));
ok(myErrors.length === 0, 'my files load without errors' + (myErrors.length ? ': ' + myErrors.join(' | ') : ''));

// ------------------------------------------------------------ §11.2.3 tiles
section('world tile definitions (§11.2.3, §10.5.3, §3.3.10)');
const REUSE = ['sea', 'reef', 'grass', 'plain', 'forest', 'hills', 'mountain', 'desert', 'snow', 'snowforest', 'swamp', 'beach', 'wasteland', 'magma', 'bridge_h', 'bridge_v',
  'loc_town', 'loc_village', 'loc_cave', 'loc_tower', 'loc_shrine', 'loc_pyramid', 'loc_volcano', 'loc_temple', 'loc_castle', 'barrier', 'loc_demon'];
const SPEC = {
  road: { ch: 'r', pass: true, enc: 0.5, bbg: 'grass' },
  marsh: { ch: 'm', pass: true, enc: 1.2, bbg: 'swamp' },
  ash: { ch: 'a', pass: true, enc: 1.2, bbg: ['wasteland', 'ashland'] },
  fog: { ch: 'g', pass: false, ship: false, anim: 4 },
  sandstorm: { ch: 'z', pass: true, enc: 1.3, bbg: 'desert', anim: 4 },
  marsh_fog: { ch: 'e', pass: true, enc: 1.3, bbg: 'swamp', anim: 2 },
  jungle: { ch: 'j', pass: true, enc: 1.3, bbg: ['forest', 'jungle'] },
  deadforest: { ch: 't', pass: true, enc: 1.3, bbg: 'swamp' },
  river: { ch: 'u', pass: false, ship: false, anim: 4 },
  cliff: { ch: 'c', pass: false },
  ruins: { ch: 'o', pass: true, enc: 1.0, bbg: 'grass' },
  loc_forest: { ch: 'G', pass: true, enc: 0, warpIcon: true },
  loc_manor: { ch: 'Q', pass: true, enc: 0, warpIcon: true },
  loc_library: { ch: 'U', pass: true, enc: 0, warpIcon: true },
  loc_port: { ch: 'W', pass: true, enc: 0, warpIcon: true },
  loc_mine: { ch: 'N', pass: true, enc: 0, warpIcon: true },
  secret_forest: { ch: '%', pass: true, secret: true },
  secret_rock: { ch: '&', pass: true, secret: true },
};
for (const id of REUSE) ok(!!T[id] && typeof T[id].name === 'string', 'reused tile ' + id + ' defined');
for (const id in SPEC) {
  const t = T[id], s = SPEC[id];
  ok(!!t, 'new tile ' + id + ' defined');
  if (!t) continue;
  ok(typeof t.name === 'string' && t.name.length > 0 && t.name.length <= 6, id + ' has a short Japanese name (' + t.name + ')');
  ok(!!t.pass === s.pass, id + ' pass = ' + s.pass);
  if ('ship' in s) ok(!!t.ship === s.ship, id + ' ship = ' + s.ship);
  if ('enc' in s) ok(t.enc === s.enc, id + ' enc = ' + s.enc + ' (is ' + t.enc + ')');
  if ('bbg' in s) ok([].concat(s.bbg).includes(t.bbg), id + ' bbg in ' + [].concat(s.bbg).join('/') + ' (is ' + t.bbg + ')');
  if ('anim' in s) ok(t.anim === s.anim, id + ' anim = ' + s.anim);
  if (s.warpIcon) ok(t.warpIcon === true, id + ' is a location icon');
  if (s.secret) ok(t.secret === true, id + ' is flagged secret');
  ok(L[s.ch] === id, 'legend "' + s.ch + '" → ' + id + ' (is ' + L[s.ch] + ')');
}
ok(T.swamp.damagePct === 2 && !T.swamp.damage, 'swamp uses damagePct 2 instead of a fixed damage (§3.3.10-10)');
ok(!T.marsh.damage && !T.marsh.damagePct, 'marsh does no damage (毒なし)');
ok(T.loc_pyramid.name === '王墓', 'loc_pyramid is named 王墓 (this world has no pyramids)');
for (const id of Object.keys(T).filter((k) => k.startsWith('loc_'))) ok(T[id].warpIcon && T[id].enc === 0 && T[id].pass, id + ' walkable icon without encounters');

// ------------------------------------------------------------ §11.11.2 legend
section('world legend (§11.11.2)');
const CRE = { '~': 'sea', '^': 'reef', 'w': 'barrier', '.': 'grass', ',': 'plain', 'T': 'forest', 'n': 'hills', 'M': 'mountain', 'd': 'desert', '*': 'snow', 'f': 'snowforest', 'x': 'swamp', 'b': 'beach', 'k': 'wasteland', 'L': 'magma', '=': 'bridge_h', '|': 'bridge_v', 'C': 'loc_castle', 'V': 'loc_town', 'v': 'loc_village', 'O': 'loc_cave', 'I': 'loc_tower', 'A': 'loc_shrine', 'P': 'loc_pyramid', 'Y': 'loc_volcano', 'X': 'loc_demon', 'H': 'loc_temple' };
for (const ch in CRE) ok(L[ch] === CRE[ch], 'Crest legend "' + ch + '" still → ' + CRE[ch]);
for (const ch in L) ok(!!T[L[ch]], 'legend "' + ch + '" points at a defined tile (' + L[ch] + ')');
const ids = Object.values(L);
ok(new Set(ids).size === ids.length, 'no world tile has two legend characters');
const marks = R.MARK_CHARS_WORLD || '';
const clash = marks.split('').filter((ch) => ch in L);
ok(clash.length === 0, 'R.MARK_CHARS_WORLD has no legend characters' + (clash.length ? ' (clash: ' + clash.join('') + ')' : ''));
ok(marks === '@0123456789!?$<>{}[]();-/EJZhilpqsy', 'R.MARK_CHARS_WORLD is the Crest set minus the 18 new characters (' + marks + ')');
ok(R.TilesWorld && R.TilesWorld.charOf('road') === 'r' && R.TilesWorld.charOf('secret_rock') === '&', 'R.TilesWorld.charOf maps ids to legend characters');
ok(R.TilesWorld.ids.length === Object.keys(L).length, 'every world tile id has a legend character (' + R.TilesWorld.ids.length + ')');

// ------------------------------------------------------------ renderer registration
section('world art registration');
ok(typeof A.worldTile === 'function', 'R.Art.worldTile exists');
ok(Array.isArray(A.WORLD_TILE_IDS), 'R.Art.WORLD_TILE_IDS exported');
for (const id of R.TilesWorld.ids) {
  ok(G.has('tile:' + id), 'tile:' + id + ' registered');
  ok((A.WORLD_TILE_IDS || []).includes(id), id + ' has a standalone world rendering');
  const k = A.WORLD_CLASS.clsOf(id);
  ok(typeof k === 'number' && (k >= 0 ? k < A.WORLD_CLASS.NAMES.length : true), id + ' maps to a ground class (' + (k >= 0 ? A.WORLD_CLASS.NAMES[k] : 'derived') + ')');
}
ok(A.WORLD_CLASS.isWater(A.WORLD_CLASS.clsOf('fog')), 'fog is water to the renderer (§11.2.3)');
const icons = A.WORLD_ICONS || {};
for (const id of R.TilesWorld.ids.filter((k) => k.startsWith('loc_'))) ok(typeof icons[id] === 'function', 'location icon builder for ' + id);
// §11.2.2 world palette (normative values)
const PAL_SPEC = {
  grass: [0x223a18, 0x30501f, 0x406628, 0x547a34, 0x6c8e44, 0x8ca45e], plain: [0x4c5428, 0x646c34, 0x7c8442, 0x949a54, 0xacae6c],
  forest: [0x0e1a10, 0x162a16, 0x20381e, 0x2c4a26, 0x3c5e30, 0x587642], trunk: [0x281a0e, 0x40291a, 0x5a3c26],
  sea: [0x0e1a36, 0x152648, 0x1d3458, 0x28466c, 0x3c5e86, 0x6a88a8], shallow: [0x24425e, 0x305670, 0x466e86, 0x6c8ea0], foam: [0xb4c4cc, 0xe0e8ec],
  sand: [0x9a8458, 0xb49c6c, 0xc8b282, 0xdac49a, 0xe8d8b8], desert: [0x8c6c40, 0xa4824e, 0xb89860, 0xc8aa74, 0xd8be8e],
  snow: [0x6a7488, 0x8a94a8, 0xaab2c2, 0xcad0da, 0xe8ecf0], swamp: [0x281c30, 0x3a2a44, 0x4c3a56, 0x5e4c68, 0x76627e],
  waste: [0x4c3c2e, 0x645040, 0x7c6652, 0x947c66, 0xac947e], rock: [0x2a2018, 0x44382a, 0x5e4e3a, 0x7a684e, 0x968466, 0xb2a082],
  grey: [0x2a2a2e, 0x46464e, 0x66666e, 0x88888e, 0xaaaab0, 0xd0d0d4], marsh: [0x1c2418, 0x2a3422, 0x3a462c, 0x4c5838, 0x606c48, 0x7a8660],
  marshwater: [0x28343a, 0x364650, 0x4a5c64, 0x60747a], ash: [0x2a2624, 0x3c3634, 0x504846, 0x665c58, 0x7e746c, 0x988e84],
  road: [0x5a4630, 0x745c40, 0x8e7452, 0xa68c68], jungle: [0x0e2414, 0x16361c, 0x204a26, 0x2e6030, 0x42783a, 0x60904c], fog: [0xb8bcc8, 0xd0d4dc, 0xe4e6ec, 0xf4f4f8],
};
for (const k in PAL_SPEC) ok(JSON.stringify(A.WORLD_PAL[k]) === JSON.stringify(PAL_SPEC[k]), 'world palette ' + k + ' = §11.2.2');
// the RS1 table is less saturated than Crest's (average HSL saturation of the ground ramps)
const CREST = { grass: [0x1e4a14, 0x2e7020, 0x3f922a, 0x56ae36, 0x78c650, 0xa4de74], plain: [0x4a6a1c, 0x6c8e2c, 0x8cae3c, 0xa8c654, 0xc4dc78], forest: [0x0c2c10, 0x184c18, 0x266c20, 0x3a8a2a, 0x58a83a, 0x86c85a], sea: [0x10287c, 0x1a3ca8, 0x2652c4, 0x3c6edc, 0x6a98ec, 0xa8c8f8], desert: [0x9c7434, 0xbc9448, 0xd6b060, 0xe8c878, 0xf6e0a0] };
const sat = (c) => { const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
const val = (c) => Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) / 255;
const mean = (a, f) => a.reduce((s, c) => s + f(c), 0) / a.length;
for (const k in CREST) {
  const ds = 1 - mean(A.WORLD_PAL[k], sat) / mean(CREST[k], sat), dv = 1 - mean(A.WORLD_PAL[k], val) / mean(CREST[k], val);
  ok(ds >= 0.25, k + ': saturation −' + Math.round(ds * 100) + '% vs Crest (target −25–35%)');
  ok(dv >= 0.04, k + ': value −' + Math.round(dv * 100) + '% vs Crest (target −5–10%)');
}

// ------------------------------------------------------------ §11.2.13 backdrops
section('battle backdrops (§11.2.13)');
const BBG_REUSE = ['grass', 'forest', 'hills', 'desert', 'snow', 'swamp', 'wasteland', 'sea', 'cave', 'fort', 'watercave', 'pyramid', 'ice', 'volcano', 'tower', 'shrine', 'castle', 'demon', 'throne'];
const BBG_NEW = { tree: 'forest', manor: 'castle', ship: 'sea', mine: 'cave', library: 'castle', oblivion: 'demon', ashland: 'wasteland', jungle: 'forest', beach: 'sea', peak: 'snow', hollow: 'library', ring: 'oblivion' };
for (const id of BBG_REUSE.concat(Object.keys(BBG_NEW))) {
  ok(G.has('bbg:' + id), 'bbg:' + id + ' registered');
  ok((A.BBG_IDS || []).includes(id), id + ' in R.Art.BBG_IDS');
}
for (const id in BBG_NEW) {
  ok(A.BBG_FALLBACK && A.BBG_FALLBACK[id] === BBG_NEW[id], 'fallback of ' + id + ' is ' + BBG_NEW[id]);
  ok(typeof (A.BBG_SCENES || {})[id] === 'function', id + ' has its own scene (not the fallback)');
}
ok(typeof (A.BBG_SCENES || {}).swamp === 'function', 'swamp is redrawn as the misty fen (§11.0 0.15)');
const pend = (A.PENDING || []).filter((k) => /^bbg:/.test(k) || R.TilesWorld.ids.some((id) => k === 'tile:' + id));
ok(pend.length === 0, 'no art-world id is still pending' + (pend.length ? ': ' + pend.join(' ') : ''));
ok(A.BBG && typeof A.BBG.sky === 'function' && typeof A.BBG.stageShadow === 'function', 'backdrop helpers exported as R.Art.BBG');

// ------------------------------------------------------------ every backdrop the data asks for
section('backdrop references in data');
const refs = new Map();
const want = (bg, where) => { if (bg) (refs.get(bg) || refs.set(bg, []).get(bg)).push(where); };
for (const id in T) want(T[id].bbg, 'tile ' + id);
for (const id in R.DB.themes) want(R.DB.themes[id].bbg, 'theme ' + id);
for (const id in R.DB.encounters || {}) want((R.DB.encounters[id] || {}).bg, 'zone ' + id);
for (const id in R.DB.troops || {}) want((R.DB.troops[id] || {}).bg, 'troop ' + id);
for (const id in R.DB.maps || {}) want((R.DB.maps[id] || {}).bbg, 'map ' + id);
for (const [bg, where] of refs) ok(G.has('bbg:' + bg), 'bbg:' + bg + ' exists (used by ' + where.slice(0, 3).join(', ') + (where.length > 3 ? ' …' : '') + ')');

// ------------------------------------------------------------ the real world map
section('world map tiles');
const W = R.DB.maps && R.DB.maps.world;
if (W) {
  const used = new Set();
  for (const row of W.rows) for (const ch of row) if (L[ch]) used.add(L[ch]);
  for (const p of W.tilePatches || []) used.add(T[p.tile] ? p.tile : L[p.tile]);
  for (const id of used) ok((A.WORLD_TILE_IDS || []).includes(id), 'world map tile ' + id + ' is drawn by the world renderer');
  ok(W.wrap !== false, 'world map wraps (renderer reads neighbours through map.tileAt)');
} else console.log('  (no src/maps/world.js yet: world map checks skipped)');

console.log(`\ntest_art-world: ${pass} passed, ${fail} failed`);
if (fail) { console.log(failures.map((f) => '  - ' + f).join('\n')); process.exit(1); }
void path; void mine;
