#!/usr/bin/env node
// World checker (src/maps/world.js + src/data/{locations,regions}.js + src/events/world*.js). Owner: world (A18a).
//
//   node tools/check_world.js                 check, exit 1 on errors
//   node tools/check_world.js --png out.png   also write a flat-colour map (4 px per cell; --scale n)
//   node tools/check_world.js --verbose       print every note
// require('./check_world').checkWorld(R) → {errors, warnings, notes, stats} (tools/test_world.js).
//
// DESIGN §10.5 / §12.1: size 128×112, wraps, ≥3 tiles of sea at every edge; every location icon at its
// §10.5.3 cell (±3), on the right icon tile, with its warp and a sensible arrival facing; the
// drawbridge and 潮見橋; LOOP-AWARE reachability per story state (the peninsula only through the
// drawbridge, the continent as one ring walkable both ways round, マレア諸島 and ビブリア島 by ferry
// only); the tilePatches of §10.5.6 (look or shortcut only — they never change which place can be
// reached); encounter zones (§10.5.7); the three hidden passages (§10.6.4); DB.locations (§10.6.3).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

let Cond = null;
try { Cond = require('./lib/cond'); } catch (e) { Cond = null; }

// §10.5.3 — spawn (= map id), icon tile(s), cell, zone of its region
const LOCS = [
  ['roa', ['loc_village'], 38, 54, 'zw_prologue'], ['lute', ['loc_town', 'loc_port'], 46, 58, 'zw_prologue'],
  ['lighthouse_1', ['loc_tower'], 54, 66, 'zw_prologue'],
  ['fern', ['loc_village'], 18, 50, 'zw_forest'], ['verda_maze_1', ['loc_forest'], 14, 42, 'zw_forest'],
  ['kasim', ['loc_town'], 26, 86, 'zw_desert'], ['sand_tomb_1', ['loc_pyramid'], 14, 98, 'zw_desert'],
  ['yule', ['loc_village'], 22, 18, 'zw_snow'], ['frost_peak_1', ['loc_cave'], 10, 10, 'zw_snow'],
  ['loch', ['loc_town', 'loc_port'], 94, 54, 'zw_marsh'], ['mist_manor_1', ['loc_manor'], 110, 50, 'zw_marsh'],
  ['bell_marsh_1', ['loc_shrine'], 114, 66, 'zw_marsh'],
  ['coral', ['loc_town', 'loc_port'], 106, 90, 'zw_isles'], ['nerei', ['loc_village'], 118, 98, 'zw_isles'],
  ['tide_cave_1', ['loc_cave'], 114, 94, 'zw_isles'],
  ['dovan', ['loc_town'], 58, 22, 'zw_mine'], ['deep_mine_1', ['loc_cave', 'loc_mine'], 66, 14, 'zw_mine'],
  ['caldera', ['loc_town'], 70, 90, 'zw_ash'], ['ash_volcano_1', ['loc_volcano'], 78, 102, 'zw_ash'],
  ['orbis', ['loc_town'], 98, 22, 'zw_star'], ['stargaze_1', ['loc_tower'], 110, 14, 'zw_star'],
  ['biblia', ['loc_town', 'loc_port'], 70, 58, 'zw_center'], ['archive_1', ['loc_library'], 74, 54, 'zw_center'],
];
const PENIN = ['roa', 'lute', 'lighthouse_1'];
const ISLES = ['coral', 'nerei', 'tide_cave_1'];
const CENTER = ['biblia', 'archive_1'];
const CONTINENT = LOCS.map((l) => l[0]).filter((s) => !PENIN.includes(s) && !ISLES.includes(s) && !CENTER.includes(s));
const ZONES = ['zw_prologue', 'zw_forest', 'zw_desert', 'zw_snow', 'zw_mine', 'zw_star', 'zw_marsh', 'zw_ash', 'zw_isles', 'zw_center'];
const RING = ['zw_forest', 'zw_mine', 'zw_star', 'zw_marsh', 'zw_ash', 'zw_desert']; // + zw_snow on the side
// §10.13.1 — DB.locations, in this order
const LOC_ORDER = 'roa lute lighthouse fern verda_maze kasim sand_tomb yule frost_peak loch mist_manor bell_marsh coral nerei tide_cave dovan deep_mine caldera ash_volcano orbis stargaze biblia archive'.split(' ');
const REGION_ORDER = ['prologue', 'r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star', 'finale'];
const TOWNS = ['roa', 'lute', 'fern', 'kasim', 'yule', 'loch', 'coral', 'nerei', 'dovan', 'caldera', 'orbis', 'biblia'];
// §10.6.4 — the world's hidden passages
const SECRETS = { world_c1: { pool: 'p_gear', tile: 'secret_forest' }, world_c2: { pool: 'p_gold', tile: 'secret_rock' }, world_c3: { pool: 'p_rare', tile: 'secret_rock' } };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = N4.concat([[1, 1], [-1, 1], [1, -1], [-1, -1]]);
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** minimal §3.2.3 evaluator when tools/lib/cond.js is missing */
function localCheck(cond, st) {
  if (cond == null || cond === true) return true;
  if (cond === false) return false;
  if (typeof cond === 'string') return cond[0] === '!' ? !st.flags.has(cond.slice(1)) : st.flags.has(cond);
  if (Array.isArray(cond)) return cond.every((c) => localCheck(c, st));
  const c = cond;
  if (c.flag != null && !st.flags.has(c.flag)) return false;
  if (c.notFlag != null && st.flags.has(c.notFlag)) return false;
  if (c.tier != null && !(st.tier >= c.tier)) return false;
  if (c.tierBelow != null && !(st.tier < c.tierBelow)) return false;
  if (c.cleared != null && !st.cleared.has(c.cleared)) return false;
  if (c.notCleared != null && st.cleared.has(c.notCleared)) return false;
  if (c.all && !c.all.every((x) => localCheck(x, st))) return false;
  if (c.any && !c.any.some((x) => localCheck(x, st))) return false;
  if (c.postgame != null && !!st.flags.has('game_clear') !== !!c.postgame) return false;
  return true;
}
function makeState(o) {
  const cleared = new Set(o.cleared || []);
  const flags = new Set(o.flags || []);
  for (const r of cleared) flags.add('cleared_' + r);
  const st = { flags, cleared, tier: o.tier != null ? o.tier : cleared.size };
  if (Cond && Cond.fromSets) {
    const S = Cond.fromSets({ flags: [...flags], cleared: [...cleared], tier: st.tier, postgame: flags.has('game_clear') });
    st.check = (c) => Cond.check(c, S);
  } else st.check = (c) => localCheck(c, st);
  return st;
}

function checkWorld(R) {
  const DB = R.DB;
  const errors = [], warnings = [], notes = [], stats = {};
  const E = (m) => errors.push(m), Wn = (m) => warnings.push(m);
  const def = DB.maps.world;
  if (!def) { E('no world map (src/maps/world.js)'); return { errors, warnings, notes, stats }; }
  const legend = DB.legends.world || {};
  const rows = def.rows || [];
  const H = rows.length, W = H ? rows[0].length : 0;

  // ---------------------------------------------------------- structure
  if (W !== 128 || H !== 112) E(`size ${W}x${H} (expected 128x112)`);
  rows.forEach((r, y) => { if (r.length !== W) E(`row ${y} length ${r.length}`); });
  if (def.type !== 'world') E('type must be world');
  if (def.wrap !== true) E('wrap must be true (the world loops, §10.5.1)');
  if (!def.name) E('no name');
  if (def.marks && Object.keys(def.marks).length) Wn('world uses mark chars (not expected)');
  const bad = new Set();
  for (const r of rows) for (const ch of r) if (!legend[ch] || !DB.tiles[legend[ch]]) bad.add(ch);
  if (bad.size) E('chars not in the world legend / tiles: ' + [...bad].join(' '));
  const base = rows.map((r) => [...r].map((ch) => legend[ch] || 'grass'));
  const wx = (x) => ((x % W) + W) % W, wy = (y) => ((y % H) + H) % H;

  // the game's own compile agrees with our reading of the rows
  let M = null;
  try { M = R.FieldMap && R.FieldMap.compile('world'); } catch (e) { E('FieldMap.compile(world) throws: ' + e.message); }
  if (M) {
    if (!M.wrap) E('compiled world does not wrap');
    let diff = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M.base && M.base[M.idx(x, y)] !== base[y][x]) diff++;
    if (M.base && diff) E(`${diff} cells differ between FieldMap.compile and the legend`);
  }

  // border: every cell within 3 of an edge is sea (the seam never makes a new road)
  let bord = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x < 3 || y < 3 || x >= W - 3 || y >= H - 3) && base[y][x] !== 'sea' && !bord++) E(`border cell ${x},${y} is ${base[y][x]} (≥3 sea tiles at every edge)`);
  }
  if (bord) E(`${bord} border cell(s) not sea`);
  for (let y = 0; y < H; y++) if (base[y][0] !== 'sea' || base[y][W - 1] !== 'sea') { E('the east/west seam is not open sea'); break; }

  // ---------------------------------------------------------- patches + a tile reader per state
  const patches = def.tilePatches || [];
  for (const p of patches) {
    const id = p.tile || legend[p.ch];
    if (!DB.tiles[id]) E(`tilePatch ${JSON.stringify(p)}: unknown tile`);
    if (Cond && Cond.validate) for (const q of Cond.validate(p.cond)) E(`tilePatch cond ${JSON.stringify(p.cond)}: ${q}`);
  }
  function tilesFor(st) {
    const t = base.map((r) => r.slice());
    for (const p of patches) {
      if (!st.check(p.cond)) continue;
      const id = p.tile || legend[p.ch];
      for (let y = p.y; y < p.y + (p.h || 1); y++) for (let x = p.x; x < p.x + (p.w || 1); x++) t[wy(y)][wx(x)] = id;
    }
    return t;
  }
  const passOf = (id) => !!(DB.tiles[id] && DB.tiles[id].pass);
  const isSecret = (id) => !!(DB.tiles[id] && DB.tiles[id].secret) || id === 'secret_forest' || id === 'secret_rock';
  const isIcon = (id) => !!(DB.tiles[id] && DB.tiles[id].warpIcon);
  const chestAt = {};
  for (const c of def.chests || []) chestAt[wy(c.y) * W + wx(c.x)] = c;

  /** loop-aware 4-neighbour flood (the game's 8-way steps never cut corners, so 4-way is exact) */
  function flood(t, starts, o) {
    o = o || {};
    const seen = new Uint8Array(W * H), q = [];
    const ok = (x, y) => {
      const id = t[y][x];
      if (!passOf(id)) return false;
      if (o.noSecrets && isSecret(id)) return false;
      if (chestAt[y * W + x]) return false; // a chest is an object: it blocks its cell
      if (o.block && o.block(x, y)) return false;
      return true;
    };
    for (const [sx, sy] of starts) { const k = wy(sy) * W + wx(sx); if (!seen[k]) { seen[k] = 1; q.push(k); } }
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % W, y = (q[i] / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = wx(x + dx), ny = wy(y + dy), k = ny * W + nx;
        if (seen[k] || !ok(nx, ny)) continue;
        seen[k] = 1; q.push(k);
      }
    }
    return seen;
  }
  /** steps between two cells in the game's 8-way walking (a diagonal only when both sides are open) */
  function steps(t, a, b) {
    const dist = new Int32Array(W * H).fill(-1), q = [];
    const open = (x, y) => passOf(t[wy(y)][wx(x)]) && !chestAt[wy(y) * W + wx(x)];
    const k0 = wy(a[1]) * W + wx(a[0]); dist[k0] = 0; q.push(k0);
    const kb = wy(b[1]) * W + wx(b[0]);
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % W, y = (q[i] / W) | 0;
      if (q[i] === kb) return dist[kb];
      for (const [dx, dy] of N8) {
        const nx = wx(x + dx), ny = wy(y + dy), k = ny * W + nx;
        if (dist[k] >= 0 || !open(nx, ny)) continue;
        if (dx && dy && !(open(x + dx, y) && open(x, y + dy))) continue;
        dist[k] = dist[q[i]] + 1; q.push(k);
      }
    }
    return -1;
  }

  /** the least encounter load between two cells: the sum of the entered tiles' `enc` (8-way
   *  walking as above). The forest road is a shortcut in this sense: forest (enc 1.3) → road (0.5). */
  function encLoad(t, a, b) {
    const cost = (x, y) => { const d = DB.tiles[t[wy(y)][wx(x)]] || {}; return Math.round((d.enc != null ? d.enc : 1) * 10); };
    const open = (x, y) => passOf(t[wy(y)][wx(x)]) && !chestAt[wy(y) * W + wx(x)];
    const dist = new Int32Array(W * H).fill(-1), buckets = [[wy(a[1]) * W + wx(a[0])]];
    const kb = wy(b[1]) * W + wx(b[0]);
    for (let c = 0; c < buckets.length; c++) {
      for (const k of buckets[c] || []) {
        if (dist[k] >= 0) continue;
        dist[k] = c;
        if (k === kb) return c / 10;
        const x = k % W, y = (k / W) | 0;
        for (const [dx, dy] of N8) {
          const nx = wx(x + dx), ny = wy(y + dy), nk = ny * W + nx;
          if (dist[nk] >= 0 || !open(nx, ny)) continue;
          if (dx && dy && !(open(x + dx, y) && open(x, y + dy))) continue;
          const nc = c + cost(nx, ny);
          (buckets[nc] = buckets[nc] || []).push(nk);
        }
      }
    }
    return -1;
  }

  // ---------------------------------------------------------- spawns / icons / warps
  const spawns = def.spawns || {};
  const warps = def.warps || [];
  const warpAt = (x, y) => warps.find((w) => wx(w.x) === x && wy(w.y) === y);
  for (const [name, icons, ex, ey] of LOCS) {
    const s = spawns[name];
    if (!s) { E(`spawn ${name} missing`); continue; }
    if (Math.abs(s.x - ex) > 3 || Math.abs(s.y - ey) > 3) E(`spawn ${name} at ${s.x},${s.y}: more than 3 off §10.5.3 (${ex},${ey})`);
    else if (s.x !== ex || s.y !== ey) notes.push(`spawn ${name} moved to ${s.x},${s.y} (§10.5.3: ${ex},${ey})`);
    const id = base[s.y][s.x];
    if (!icons.includes(id)) E(`spawn ${name} on ${id}, expected ${icons.join('/')}`);
    const w = warpAt(s.x, s.y);
    if (!w || w.to !== name || w.spawn !== 'entrance') E(`icon ${name}: needs the warp {to:'${name}', spawn:'entrance'}`);
    const d = DIRV[s.dir];
    if (!d) E(`spawn ${name}: bad dir ${s.dir}`);
    else {
      const nid = base[wy(s.y + d[1])][wx(s.x + d[0])];
      if (!passOf(nid) || isIcon(nid) || isSecret(nid)) E(`spawn ${name} faces ${s.dir} into ${nid}`);
    }
  }
  const expectSpawns = new Set(LOCS.map((l) => l[0]));
  for (const k in spawns) if (!expectSpawns.has(k)) Wn(`extra world spawn ${k} (§10.13.3 lists 23)`);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!isIcon(base[y][x])) continue;
    if (!warpAt(x, y)) E(`icon at ${x},${y} has no warp`);
    if (N4.some(([dx, dy]) => isIcon(base[wy(y + dy)][wx(x + dx)]))) E(`icons touch at ${x},${y}`);
  }
  for (const w of warps) {
    if (!isIcon(base[wy(w.y)][wx(w.x)])) E(`warp at ${w.x},${w.y} is not on an icon`);
    if (!DB.maps[w.to]) notes.push(`warp target map ${w.to} not defined yet`);
  }
  stats.icons = warps.length;

  // ---------------------------------------------------------- bridges (§10.5.3)
  for (let y = 40; y <= 43; y++) if (base[y][42] !== 'bridge_v') E(`drawbridge: ${42},${y} is ${base[y][42]} (bridge_v)`);
  for (let y = 40; y <= 43; y++) for (const x of [41, 43]) if (base[y][x] !== 'sea') E(`drawbridge: ${x},${y} should be sea beside the bridge`);
  if (!passOf(base[39][42]) || !passOf(base[44][42])) E('drawbridge: its ends (42,39) and (42,44) must be land');
  for (let x = 88; x <= 91; x++) {
    if (base[74][x] !== 'bridge_h') E(`潮見橋: ${x},74 is ${base[74][x]} (bridge_h)`);
    if (base[73][x] !== 'sea' || base[75][x] !== 'sea') E(`潮見橋: water must run under ${x},74`);
  }
  if (!passOf(base[74][87]) || !passOf(base[74][92])) E('潮見橋: its ends (87,74) and (92,74) must be land');

  // ---------------------------------------------------------- reachability per state
  const at = (n) => spawns[n] ? [spawns[n].x, spawns[n].y] : null;
  const has = (seen, n) => !!spawns[n] && !!seen[spawns[n].y * W + spawns[n].x];
  const ALL_CLEARED = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
  const STATES = {
    start: makeState({}),
    prologue_done: makeState({ flags: ['prologue_done'] }),
    tier4: makeState({ flags: ['prologue_done'], cleared: ALL_CLEARED.slice(0, 4) }),
    final_open: makeState({ flags: ['prologue_done', 'final_open', 'st_fine_reveal'], cleared: ALL_CLEARED }),
    postgame: makeState({ flags: ['prologue_done', 'final_open', 'final_arrived', 'game_clear'], cleared: ALL_CLEARED }),
  };
  const T = {};
  for (const k in STATES) T[k] = tilesFor(STATES[k]);
  if (at('roa')) {
    const s0 = flood(T.start, [at('roa')]);
    for (const n of PENIN) if (!has(s0, n)) E(`new game: ${n} unreachable from ロアの里`);
    for (const [n] of LOCS) if (!PENIN.includes(n) && has(s0, n)) E(`new game: ${n} reachable before the drawbridge comes down`);
    if (!s0[44 * W + 42]) E('new game: the step event cell (42,44) in front of the drawbridge is unreachable');
    stats.peninsulaCells = s0.reduce((a, b) => a + b, 0);
    const d = steps(T.start, at('roa'), at('lute'));
    stats.roaToLute = d;
    if (d < 7 || d > 16) Wn(`ロア → ファロス is ${d} steps (§10.7 P3: about 10)`);
  }
  for (const k of ['prologue_done', 'tier4', 'final_open', 'postgame']) {
    const t = T[k];
    const s = flood(t, [at('roa')]);
    for (const n of PENIN.concat(CONTINENT)) if (!has(s, n)) E(`${k}: ${n} unreachable on foot from ロアの里`);
    for (const n of ISLES.concat(CENTER)) if (has(s, n)) E(`${k}: ${n} reachable on foot (ferry only)`);
    const si = flood(t, [at('coral')]);
    for (const n of ISLES) if (!has(si, n)) E(`${k}: ${n} unreachable on foot from 港町コーラル`);
    for (const [n] of LOCS) if (!ISLES.includes(n) && has(si, n)) E(`${k}: ${n} reachable from マレア諸島 on foot`);
    const sc = flood(t, [at('biblia')]);
    for (const n of CENTER) if (!has(sc, n)) E(`${k}: ${n} unreachable on foot from 書の都ビブリア`);
    for (const [n] of LOCS) if (!CENTER.includes(n) && has(sc, n)) E(`${k}: ${n} reachable from ビブリア島 on foot`);
  }

  // ---------------------------------------------------------- zones (§10.5.7)
  const zones = def.zones || [];
  const zoneAt = (x, y) => { x = wx(x); y = wy(y); for (const z of zones) if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) return z.zone; return def.defaultZone || null; };
  if (def.defaultZone !== 'zw_forest') E(`defaultZone is ${def.defaultZone} (§10.5.7: zw_forest)`);
  for (const z of zones) if (!ZONES.includes(z.zone)) E(`unknown zone ${z.zone}`);
  const walkSomewhen = new Uint8Array(W * H);
  for (const k in T) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (passOf(T[k][y][x]) && !isIcon(T[k][y][x])) walkSomewhen[y * W + x] = 1;
  const zcount = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkSomewhen[y * W + x]) { const z = zoneAt(x, y); zcount[z] = (zcount[z] || 0) + 1; }
  stats.zoneCells = zcount;
  stats.zoneRects = zones.length;
  for (const [n, , , , zone] of LOCS) {
    const s = spawns[n];
    if (!s) continue;
    const d = DIRV[s.dir] || [0, 1];
    const z = zoneAt(s.x + d[0], s.y + d[1]);
    if (z !== zone) E(`the ground in front of ${n} is in ${z} (expected ${zone})`);
  }
  // each zone's walkable cells on the continent form one connected piece (no stray rectangle)
  const reachAll = flood(T.postgame, [at('roa'), at('coral'), at('biblia')].filter(Boolean));
  for (const zone of ZONES) {
    const cells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walkSomewhen[y * W + x] && reachAll[y * W + x] && zoneAt(x, y) === zone) cells.push([x, y]);
    if (!cells.length) { E(`zone ${zone} covers no reachable cell`); continue; }
    // split into pieces (walking inside the zone only); all but the biggest are strays
    const left = new Set(cells.map(([x, y]) => y * W + x)), pieces = [];
    while (left.size) {
      const k0 = left.values().next().value;
      const s = flood(T.postgame, [[k0 % W, (k0 / W) | 0]], { block: (x, y) => zoneAt(x, y) !== zone || !walkSomewhen[y * W + x] });
      const piece = [...left].filter((k) => s[k]);
      if (!piece.length) piece.push(k0);
      for (const k of piece) left.delete(k);
      pieces.push(piece);
    }
    pieces.sort((a, b) => b.length - a.length);
    const strays = pieces.slice(1).flat();
    if (strays.length) E(`zone ${zone}: ${strays.length} reachable cell(s) apart from the rest, e.g. ${strays[0] % W},${(strays[0] / W) | 0}`);
  }
  const bz = zoneAt(42, 41);
  if (bz !== 'zw_forest' && bz !== 'zw_prologue') E(`the drawbridge is in ${bz}`);
  if (DB.encounters && Object.keys(DB.encounters).length) {
    const missing = ZONES.filter((z) => !DB.encounters[z]);
    if (missing.length) Wn('encounter tables not defined yet: ' + missing.join(' '));
  }

  // ---------------------------------------------------------- the ring (どちら回りでも, §10.5.2)
  const t1 = T.prologue_done;
  const zoneSpawns = {};
  for (const [n, , , , zone] of LOCS) if (CONTINENT.includes(n)) (zoneSpawns[zone] = zoneSpawns[zone] || []).push(n);
  for (const cut of RING) {
    const others = CONTINENT.filter((n) => LOCS.find((l) => l[0] === n)[4] !== cut);
    const seeds = others.filter((n) => at(n)).map(at);
    const s = flood(t1, [seeds[0]], { block: (x, y) => zoneAt(x, y) === cut && !isIcon(t1[y][x]) });
    const lost = others.filter((n) => !has(s, n));
    if (lost.length) E(`with ${cut} closed the continent breaks: ${others[0]} cannot reach ${lost.join(' ')} the other way round`);
  }
  // the peninsula hangs on the drawbridge alone
  {
    const s = flood(T.prologue_done, [at('roa')], { block: (x, y) => x === 42 && y >= 40 && y <= 43 });
    for (const n of CONTINENT) if (has(s, n)) { E(`${n} reachable from the peninsula without the drawbridge`); break; }
  }

  // ---------------------------------------------------------- tilePatches (§10.5.6)
  const byCond = {};
  for (const p of patches) { const k = JSON.stringify(p.cond) + '→' + (p.tile || legend[p.ch]); (byCond[k] = byCond[k] || []).push(p); }
  const cellsOf = (list) => { const out = []; for (const p of list) for (let y = p.y; y < p.y + (p.h || 1); y++) for (let x = p.x; x < p.x + (p.w || 1); x++) out.push([wx(x), wy(y)]); return out; };
  const want = [
    ['"!prologue_done"→sea', (x, y) => x === 42 && y >= 40 && y <= 43, 4, 4],
    ['"!final_open"→fog', (x, y) => base[y][x] === 'sea', 20, 400],
    ['[{"tier":4},"!final_open"]→fog', (x, y) => base[y][x] === 'sea', 20, 500],
    ['{"cleared":"r_forest"}→road', (x, y) => passOf(base[y][x]), 8, 60],
    ['{"notCleared":"r_desert"}→sandstorm', (x, y) => base[y][x] === 'desert' && Math.hypot(x - 14, y - 98) <= 5.01, 20, 81],
    ['{"cleared":"r_snow"}→plain', (x, y) => base[y][x] === 'snow' && Math.hypot(x - 22, y - 18) <= 6.01, 20, 113],
    ['{"notCleared":"r_marsh"}→marsh_fog', (x, y) => base[y][x] === 'marsh' && (Math.hypot(x - 110, y - 50) <= 5.01 || Math.hypot(x - 114, y - 66) <= 5.01), 20, 162],
    ['{"cleared":"r_mine"}→road', (x, y) => y === 20 && x >= 70 && x <= 80 && base[y][x] === 'mountain', 11, 11],
    ['{"cleared":"r_ash"}→grass', (x, y) => base[y][x] === 'ash' && Math.hypot(x - 70, y - 90) <= 6.01, 20, 113],
  ];
  const known = new Set(want.map((w) => w[0]));
  for (const k in byCond) if (!known.has(k)) E(`unexpected tilePatch group ${k}`);
  for (const [k, okCell, lo, hi] of want) {
    const cells = cellsOf(byCond[k] || []);
    if (cells.length < lo || cells.length > hi) E(`tilePatch ${k}: ${cells.length} cell(s) (expected ${lo}..${hi})`);
    const badc = cells.filter(([x, y]) => !okCell(x, y));
    if (badc.length) E(`tilePatch ${k}: ${badc.length} cell(s) where it should not be, e.g. ${badc[0].join(',')} (${base[badc[0][1]][badc[0][0]]})`);
    stats['patch ' + k] = cells.length;
  }
  // the fog closes the island in (every sea cell next to ビブリア島 is fog until final_open)
  {
    const t = T.prologue_done, isle = flood(t, [at('biblia')]);
    let open = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isle[y * W + x]) continue;
      for (const [dx, dy] of N8) { const nx = wx(x + dx), ny = wy(y + dy); if (base[ny][nx] === 'sea' && t[ny][nx] !== 'fog') open++; }
    }
    if (open) E(`${open} sea cell(s) beside ビブリア島 are not fogged before final_open`);
    const fog4 = T.tier4.flat().filter((id) => id === 'fog').length, fog0 = t.flat().filter((id) => id === 'fog').length;
    if (!(fog4 > fog0)) E('the fog does not thicken at tier 4');
    if (T.final_open.flat().includes('fog')) E('fog remains after final_open');
    stats.fogCells = [fog0, fog4];
  }
  // shortcuts really are shortcuts; the forest road is walkable forest before
  if (at('dovan') && at('orbis')) {
    const a = steps(T.prologue_done, at('dovan'), at('orbis'));
    const b = steps(makeState({ flags: ['prologue_done'], cleared: ['r_mine'] }) && tilesFor(makeState({ flags: ['prologue_done'], cleared: ['r_mine'] })), at('dovan'), at('orbis'));
    stats.dovanToOrbis = [a, b];
    if (!(a > 0 && b > 0 && b < a)) E(`ドヴァンの抜け道 is no shortcut (${a} → ${b} steps)`);
  }
  if (at('fern')) {
    const f = [42, 37];
    const a = steps(T.prologue_done, f, at('fern'));
    const b = steps(tilesFor(makeState({ flags: ['prologue_done'], cleared: ['r_forest'] })), f, at('fern'));
    stats.forkToFern = [a, b];
    if (!(a > 0 && b > 0 && b <= a)) E(`the forest road breaks the way to フェルン (${a} → ${b})`);
    const la = encLoad(T.prologue_done, f, at('fern'));
    const lb = encLoad(tilesFor(makeState({ flags: ['prologue_done'], cleared: ['r_forest'] })), f, at('fern'));
    stats.forkToFernLoad = [la, lb];
    if (!(la > 0 && lb > 0 && lb <= la * 0.8)) E(`the forest road is no shortcut to フェルン (encounter load ${la} → ${lb}; want at most 80%)`);
  }

  // ---------------------------------------------------------- events (§10.5.6)
  const evs = def.events || [];
  const bridgeEv = evs.find((e) => e.id === 'world_bridge_closed');
  if (!bridgeEv) E('event world_bridge_closed missing');
  else {
    if (bridgeEv.x !== 42 || bridgeEv.y !== 44 || bridgeEv.trigger !== 'step' || bridgeEv.cond !== '!prologue_done') E('world_bridge_closed must be a step event at (42,44) with cond !prologue_done');
  }
  for (const e of evs) if (!DB.events[e.id]) E(`world event ${e.id} not defined in DB.events`);

  // ---------------------------------------------------------- hidden passages (§10.6.4)
  const chests = def.chests || [];
  const ids = chests.map((c) => c.id).sort();
  if (ids.join() !== Object.keys(SECRETS).sort().join()) E(`world chests ${ids.join(' ')} (expected ${Object.keys(SECRETS).join(' ')})`);
  let secretCells = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isSecret(base[y][x])) secretCells++;
  stats.secretCells = secretCells;
  for (const c of chests) {
    const want2 = SECRETS[c.id];
    if (!want2) continue;
    if (c.pool !== want2.pool) E(`${c.id}: pool ${c.pool} (expected ${want2.pool})`);
    if (c.item) E(`${c.id}: fixed item (§8.12.1: pools only)`);
    if (c.tier != null) E(`${c.id}: world chests take the current tier (no tier)`);
    if (DB.pools && Object.keys(DB.pools).length && !DB.pools[c.pool]) E(`${c.id}: unknown pool ${c.pool}`);
    const around = N4.map(([dx, dy]) => [wx(c.x + dx), wy(c.y + dy)]).filter(([x, y]) => passOf(base[y][x]) && !isSecret(base[y][x]));
    const withS = flood(T.prologue_done, [at('roa'), at('coral'), at('biblia')]);
    const noS = flood(T.prologue_done, [at('roa'), at('coral'), at('biblia')], { noSecrets: true });
    if (!around.some(([x, y]) => withS[y * W + x])) E(`${c.id} at ${c.x},${c.y} cannot be reached`);
    if (around.some(([x, y]) => noS[y * W + x])) E(`${c.id} at ${c.x},${c.y} is reachable without its hidden passage`);
    // the passage: secret cells between the open ground and the pocket, 1..3 long, of the right kind
    const pocket = flood(T.prologue_done, around, { block: (x, y) => isSecret(T.prologue_done[y][x]) });
    const pass = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isSecret(base[y][x])) continue;
      if (N4.some(([dx, dy]) => pocket[wy(y + dy) * W + wx(x + dx)])) pass.push([x, y]);
    }
    const run = flood(T.prologue_done, pass, { block: (x, y) => !isSecret(T.prologue_done[y][x]) });
    const len = run.reduce((a, b) => a + b, 0);
    if (len < 1 || len > 3) E(`${c.id}: hidden passage of ${len} tile(s) (1..3)`);
    for (let k = 0; k < run.length; k++) if (run[k] && base[(k / W) | 0][k % W] !== want2.tile) E(`${c.id}: passage tile ${base[(k / W) | 0][k % W]} (expected ${want2.tile})`);
    stats[c.id] = `${c.pool} at ${c.x},${c.y}, passage ${len}`;
  }
  if (secretCells !== chests.reduce((n, c) => n + (stats[c.id] ? +stats[c.id].split('passage ')[1] : 0), 0)) Wn(`${secretCells} secret tile(s) on the world, not all of them lead to a chest`);

  // ---------------------------------------------------------- DB.locations (§10.6.3)
  const locIds = Object.keys(DB.locations || {});
  if (locIds.join(' ') !== LOC_ORDER.join(' ')) E('DB.locations order/ids differ from §10.13.1: ' + locIds.join(' '));
  let lastRegion = -1, lastKind = 'town';
  for (const id of locIds) {
    const L = DB.locations[id];
    if (L.map !== 'world') E(`location ${id}: map must be 'world'`);
    if (!spawns[L.spawn]) E(`location ${id}: world spawn ${L.spawn} missing`);
    if (L.dock) E(`location ${id}: dock is not used in this game`);
    if (L.kind !== 'town' && L.kind !== 'dungeon') E(`location ${id}: kind ${L.kind}`);
    if ((L.kind === 'town') !== TOWNS.includes(id)) E(`location ${id}: kind ${L.kind} is wrong`);
    const ri = REGION_ORDER.indexOf(L.region);
    if (ri < 0) E(`location ${id}: region ${L.region}`);
    if (ri < lastRegion || (ri === lastRegion && lastKind === 'dungeon' && L.kind === 'town')) E(`location ${id}: out of order (regions, then towns before dungeons)`);
    if (ri !== lastRegion) lastKind = L.kind; else if (L.kind === 'dungeon') lastKind = 'dungeon';
    lastRegion = ri;
    if (L.region.startsWith('r_') && DB.regions && !DB.regions[L.region]) E(`location ${id}: unknown region ${L.region}`);
    const w = R.Text && R.Text.approxWidth ? R.Text.approxWidth(L.name) / (32 / 3) : [...L.name].length;
    if (w > 10) E(`location ${id}: name ${L.name} longer than 10 characters`);
  }
  if (locIds.filter((id) => DB.locations[id].kind === 'town').length !== 12) E('DB.locations: 12 towns expected');
  if (locIds.filter((id) => DB.locations[id].kind === 'dungeon').length !== 11) E('DB.locations: 11 dungeon entrances expected');
  for (const id in DB.regions || {}) {
    const r = DB.regions[id];
    for (const t of r.locations || []) if (!DB.locations[t] || DB.locations[t].region !== id) E(`region ${id}: location ${t} is not one of its DB.locations`);
  }

  // ---------------------------------------------------------- the look
  let bare = 0, lonely = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = base[y][x];
    if (passOf(id) && !reachAll[y * W + x] && !isIcon(id)) bare++;
    if (id === 'mountain') {
      let ground = false;
      for (let j = -2; j <= 2 && !ground; j++) for (let i = -2; i <= 2; i++) {
        const q = base[wy(y + j)][wx(x + i)];
        if (q !== 'mountain' && q !== 'hills' && q !== 'magma' && !isIcon(q) && q !== 'cliff') { ground = true; break; }
      }
      if (!ground) lonely++;
    }
  }
  stats.unreachableWalkable = bare; // the islets out at sea
  stats.deepMountainCells = lonely;
  if (bare > 60) Wn(`${bare} walkable cells nobody can reach`);
  const count = {};
  for (const r of base) for (const id of r) count[id] = (count[id] || 0) + 1;
  stats.tiles = count;
  for (const id of ['road', 'marsh', 'ash', 'bridge_h', 'bridge_v']) if (!count[id]) E(`no ${id} on the world`);
  const fogAny = patches.some((p) => p.tile === 'fog'), ssAny = patches.some((p) => p.tile === 'sandstorm'), mfAny = patches.some((p) => p.tile === 'marsh_fog');
  if (!fogAny || !ssAny || !mfAny) E('fog / sandstorm / marsh_fog patches missing');
  return { errors, warnings, notes, stats, base, W, H, spawns, chests };
}

// ------------------------------------------------------------ png
const COL = {
  sea: '#1d3458', reef: '#6a88a8', fog: '#dcdee8', river: '#3c5e86', grass: '#547a34', plain: '#949a54', road: '#a08c64',
  forest: '#2c4a26', hills: '#7a8a40', mountain: '#6a5a48', cliff: '#6a5a48', desert: '#c8aa74', sandstorm: '#d8be8e', snow: '#cad0da',
  snowforest: '#6a8898', swamp: '#5e4c68', marsh: '#4c5838', marsh_fog: '#7a8470', beach: '#dac49a', wasteland: '#7c6652',
  ash: '#5c5450', magma: '#e04818', jungle: '#2e6030', deadforest: '#5a5040', ruins: '#8c8878', bridge_h: '#b07840', bridge_v: '#b07840',
  secret_forest: '#ff40ff', secret_rock: '#ff40ff',
};
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function writePng(file, res, S) {
  const { W, H, base, chests } = res;
  const w = W * S, h = H * S;
  const buf = Buffer.alloc(w * h * 3);
  const put = (px, py, c) => { if (px < 0 || py < 0 || px >= w || py >= h) return; const i = (py * w + px) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = base[y][x];
    const icon = id.startsWith('loc_');
    const c = icon ? [255, 255, 255] : rgb(COL[id] || '#ff00ff');
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let cc = c;
      if (id === 'mountain' && (i + j) % 3 === 0) cc = [60, 44, 30];
      if (id === 'forest' && (i + j) % 2 === 0) cc = [20, 50, 22];
      if (icon && (i === 0 || j === 0 || i === S - 1 || j === S - 1)) cc = [220, 20, 20];
      put(x * S + i, y * S + j, cc);
    }
  }
  for (const c of chests || []) for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) put(c.x * S + i, c.y * S + j, [255, 230, 0]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x % (16 * S) === 0 || y % (16 * S) === 0) && (x + y) % 2 === 0) put(x, y, [0, 0, 0]);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) buf.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const crcT = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('png →', file);
}

/** load the game (with the stand-in world tiles of tools/fixtures/world when the real ones are absent) */
function loadGame() {
  const stub = path.join(__dirname, 'fixtures', 'world', 'tiles_stub.js');
  return require('./lib/load')({ quiet: true, extra: fs.existsSync(stub) ? [stub] : [] });
}

module.exports = { checkWorld, loadGame, LOCS, LOC_ORDER };

if (require.main === module) {
  const R = loadGame();
  const res = checkWorld(R);
  const pi = process.argv.indexOf('--png');
  if (pi > 0 && res.base) {
    const si = process.argv.indexOf('--scale');
    writePng(path.resolve(process.argv[pi + 1]), res, si > 0 ? +process.argv[si + 1] : 4);
  }
  const verbose = process.argv.includes('--verbose');
  const st = res.stats;
  console.log(`  icons ${st.icons}, zone rects ${st.zoneRects}, peninsula ${st.peninsulaCells} cells, ロア→ファロス ${st.roaToLute} steps, ` +
    `ドヴァン→オルビス ${st.dovanToOrbis && st.dovanToOrbis.join('→')} steps, 分かれ道→フェルン ${st.forkToFern && st.forkToFern.join('→')} steps ` +
    `(encounter load ${st.forkToFernLoad && st.forkToFernLoad.join('→')})`);
  console.log(`  fog ${st.fogCells && st.fogCells.join('/')} cells, secret tiles ${st.secretCells}, deep mountain cells ${st.deepMountainCells}, unreachable walkable ${st.unreachableWalkable}`);
  for (const k of ['world_c1', 'world_c2', 'world_c3']) if (st[k]) console.log(`  ${k}: ${st[k]}`);
  console.log('  zone cells: ' + Object.keys(st.zoneCells || {}).sort().map((k) => `${k} ${st.zoneCells[k]}`).join(', '));
  if (verbose) { for (const n of res.notes) console.log('  note:', n); console.log('  tiles:', JSON.stringify(st.tiles)); }
  for (const w of res.warnings) console.log('WARN', w);
  for (const e of res.errors) console.log('ERROR', e);
  console.log(`check_world: ${res.errors.length} error(s), ${res.warnings.length} warning(s)`);
  process.exitCode = res.errors.length ? 1 : 0;
}
