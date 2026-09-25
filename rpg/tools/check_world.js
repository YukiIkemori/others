#!/usr/bin/env node
// Overworld checker (src/maps/world.js + src/data/locations.js).
//
//   node tools/check_world.js                 validate, exit 1 on errors
//   node tools/check_world.js --png out.png   also render the map (4 px/tile)
//   node tools/check_world.js --png out.png --scale 6
//
// Checks: size & sea border, legend chars, spawns/warps/icons, docks, the
// location table, encounter zones (every walkable cell → its region's land
// zone, every sailable cell → a sea zone), and reachability:
//   1. on foot from regnas_castle before the gate (west region only)
//   2. on foot from east_gate_e (east region: porta, bandit fort, porta_dock)
//   3. by ship from porta_dock: every dock but the demon ring's; each dock
//      reaches its locations on foot; nothing of the demon island
//   4. with barrier_broken: edge shrine and the demon castle; every icon.
// require('./check_world').checkWorld(R, mapDef) → {errors, notes} (tests).
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICON_MAPS = {
  regnas_castle: 'loc_castle', regnas_town: 'loc_town', milt_village: 'loc_village', wind_cave_1: 'loc_cave',
  porta_town: 'loc_town', bandit_fort_1: null, elfin_village: 'loc_village', water_cave_1: 'loc_cave',
  salva_town: 'loc_town', pyramid_1: 'loc_pyramid', frost_village: 'loc_village', ice_cave_1: 'loc_cave',
  volcano_1: 'loc_volcano', arcana_city: null, star_tower_1: 'loc_tower', light_temple: 'loc_temple',
  edge_shrine: 'loc_shrine', demon_castle_1: 'loc_demon',
};
const WEST = ['regnas_castle', 'regnas_town', 'milt_village', 'wind_cave_1'];
const DOCK_OF = {
  regnas_dock: ['regnas_castle', 'regnas_town'], milt_dock: ['milt_village'],
  porta_dock: ['porta_town', 'bandit_fort_1'], elfin_dock: ['elfin_village', 'water_cave_1'],
  salva_dock: ['salva_town', 'pyramid_1'], frost_dock: ['frost_village', 'ice_cave_1'], volcano_dock: ['volcano_1'],
  arcana_dock: ['arcana_city', 'star_tower_1'], light_temple_dock: ['light_temple'], edge_shrine_dock: ['edge_shrine'],
};
const LOCS = 'regnas milt porta elfin salva frost arcana light_temple edge_shrine'.split(' ');
const LAND_ZONES = ['w_start', 'w_east', 'w_forest', 'w_desert', 'w_snow', 'w_volcano', 'w_arcana', 'w_demon'];
const SEA_ZONES = ['w_sea1', 'w_sea2', 'w_sea3'];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function checkWorld(R, map) {
  const DB = R.DB;
  const errors = [], notes = [];
  const E = (m) => errors.push(m);
  const legend = DB.legends.world;
  const rows = map.rows || [];
  const H = rows.length, W = H ? rows[0].length : 0;

  // ---------------------------------------------------------- structure
  if (W !== 128 || H !== 112) E(`size ${W}x${H} (expected 128x112)`);
  rows.forEach((r, y) => { if (r.length !== W) E(`row ${y} length ${r.length}`); });
  if (map.type !== 'world' || map.legend !== 'world') E('map must be type/legend world');
  const marks = map.marks || {};
  for (const ch in marks) if (!R.MARK_CHARS_WORLD.includes(ch)) E(`mark char '${ch}' not free`);
  const tileId = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return 'sea';
    const ch = rows[y][x];
    if (marks[ch]) return legend[marks[ch].under || '.'];
    return legend[ch];
  };
  const badChars = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!tileId(x, y)) badChars.add(rows[y][x]);
  if (badChars.size) E('unknown chars: ' + [...badChars].join(' '));
  let border = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if ((x < 3 || y < 3 || x >= W - 3 || y >= H - 3) && tileId(x, y) !== 'sea') { if (!border++) E(`border not sea at ${x},${y}`); }
  }
  const T = (x, y) => DB.tiles[tileId(x, y)] || {};
  const walk = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !!T(x, y).pass;
  const sail = (x, y, barrier) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = T(x, y);
    return !!t.ship || !!(barrier && t.flagPass === 'barrier_broken' && t.shipWhenFlag);
  };

  // ---------------------------------------------------------- objects
  const spawns = Object.assign({}, map.spawns || {});
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const mk = marks[rows[y][x]];
    if (mk && mk.spawn) spawns[typeof mk.spawn === 'string' ? mk.spawn : mk.spawn.name] = { x, y, dir: mk.dir };
  }
  const warps = (map.warps || []).slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const mk = marks[rows[y][x]];
    if (mk && mk.warp) warps.push(Object.assign({ x, y }, mk.warp));
  }
  const need = Object.keys(ICON_MAPS).concat(['east_gate_w', 'east_gate_e'], Object.keys(DOCK_OF));
  for (const s of need) if (!spawns[s]) E(`spawn ${s} missing`);
  for (const k in spawns) {
    const s = spawns[k];
    if (!(s.x >= 0 && s.y >= 0 && s.x < W && s.y < H)) E(`spawn ${k} out of bounds`);
  }
  const warpAt = (x, y) => warps.find((w) => w.x === x && w.y === y);
  const iconCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (T(x, y).warpIcon) iconCells.push([x, y]);
  for (const m in ICON_MAPS) {
    const s = spawns[m];
    if (!s) continue;
    if (!T(s.x, s.y).warpIcon) E(`spawn ${m} is not on an icon (${tileId(s.x, s.y)})`);
    if (ICON_MAPS[m] && tileId(s.x, s.y) !== ICON_MAPS[m]) E(`spawn ${m} on ${tileId(s.x, s.y)}, expected ${ICON_MAPS[m]}`);
    const w = warpAt(s.x, s.y);
    if (!w || w.to !== m || w.spawn !== 'entrance') E(`icon ${m}: warp must be {to:'${m}', spawn:'entrance'}`);
  }
  for (const [s, sp] of [['east_gate_w', 'west'], ['east_gate_e', 'east']]) {
    const p = spawns[s];
    if (!p) continue;
    if (!T(p.x, p.y).warpIcon) E(`${s} not on an icon`);
    const w = warpAt(p.x, p.y);
    if (!w || w.to !== 'east_gate' || w.spawn !== sp) E(`${s}: warp must be {to:'east_gate', spawn:'${sp}'}`);
  }
  for (const [x, y] of iconCells) {
    if (!warpAt(x, y)) E(`icon at ${x},${y} has no warp`);
    if (N4.some(([dx, dy]) => T(x + dx, y + dy).warpIcon)) E(`icons touch at ${x},${y}`);
    if (!N4.some(([dx, dy]) => walk(x + dx, y + dy) && !T(x + dx, y + dy).warpIcon)) E(`icon at ${x},${y} has no open neighbour`);
  }
  for (const w of warps) if (!T(w.x, w.y).warpIcon) E(`warp at ${w.x},${w.y} not on an icon`);
  for (const k in spawns) {
    const s = spawns[k];
    if (/_dock$/.test(k)) {
      if (!T(s.x, s.y).ship) E(`dock ${k} not on sea`);
      if (!N4.some(([dx, dy]) => walk(s.x + dx, s.y + dy))) E(`dock ${k} not next to land`);
    } else if (T(s.x, s.y).warpIcon && DIR[s.dir]) {
      const [dx, dy] = DIR[s.dir];
      if (!walk(s.x + dx, s.y + dy)) E(`spawn ${k} faces ${s.dir} into ${tileId(s.x + dx, s.y + dy)}`);
    }
  }

  // ---------------------------------------------------------- locations
  for (const l of LOCS) {
    const L = DB.locations[l];
    if (!L) { E(`location ${l} missing`); continue; }
    if (L.map !== 'world') E(`location ${l}: map must be 'world'`);
    if (!spawns[L.spawn]) E(`location ${l}: spawn ${L.spawn} missing`);
    if (L.dock && !spawns[L.dock]) E(`location ${l}: dock ${L.dock} missing`);
    if (!L.name) E(`location ${l}: no name`);
  }

  // ---------------------------------------------------------- reachability
  /** flood from starts: on foot; with o.ship also sailing (landing anywhere, never boarding from land) */
  function flood(starts, o) {
    o = o || {};
    const seen = new Set(), q = [];
    const add = (x, y) => { const k = y * W + x; if (seen.has(k)) return; seen.add(k); q.push([x, y]); };
    for (const [x, y] of starts) add(x, y);
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (walk(nx, ny)) add(nx, ny);
        else if (o.ship && sail(nx, ny, o.barrier) && sail(x, y, o.barrier)) add(nx, ny);
      }
    }
    return seen;
  }
  const has = (set, s) => !!s && set.has(s.y * W + s.x);
  const at = (n) => spawns[n] && [spawns[n].x, spawns[n].y];
  const shoreOf = (s) => N4.map(([dx, dy]) => [s.x + dx, s.y + dy]).filter(([x, y]) => walk(x, y));

  if (spawns.regnas_castle) {
    const west = flood([at('regnas_castle')]);
    for (const m of WEST.concat(['east_gate_w'])) if (!has(west, spawns[m])) E(`on foot: ${m} unreachable from regnas_castle`);
    for (const m of Object.keys(ICON_MAPS).concat(['east_gate_e'])) {
      if (!WEST.includes(m) && has(west, spawns[m])) E(`on foot: ${m} reachable from regnas_castle without the gate`);
    }
    notes.push(`west region: ${west.size} walkable cells`);
  }
  if (spawns.east_gate_e) {
    const east = flood([at('east_gate_e')]);
    for (const m of ['porta_town', 'bandit_fort_1']) if (!has(east, spawns[m])) E(`on foot: ${m} unreachable from east_gate_e`);
    for (const m of Object.keys(ICON_MAPS).concat(['east_gate_w'])) {
      if (!['porta_town', 'bandit_fort_1'].includes(m) && has(east, spawns[m])) E(`on foot: ${m} reachable from the east region`);
    }
    const pd = spawns.porta_dock;
    if (pd && !shoreOf(pd).some(([x, y]) => has(east, { x, y }))) E('porta_dock not next to the east region');
    notes.push(`east region: ${east.size} walkable cells`);
  }
  if (spawns.porta_dock) {
    const sea = flood([at('porta_dock')], { ship: true });
    const isSea = (k) => !!T(k % W, (k / W) | 0).ship;
    for (const d in DOCK_OF) {
      const s = spawns[d];
      if (!s) continue;
      const inSea = has(sea, s);
      if (d === 'edge_shrine_dock') { if (inSea) E('edge_shrine_dock reachable by ship without barrier_broken'); }
      else if (!inSea) E(`by ship: ${d} unreachable from porta_dock`);
      const land = flood(shoreOf(s));
      for (const m of DOCK_OF[d]) if (!has(land, spawns[m])) E(`${d}: ${m} not reachable on foot from the dock`);
    }
    for (const k in spawns) if (/_dock$/.test(k) && k !== 'edge_shrine_dock' && !has(sea, spawns[k])) E(`by ship: ${k} unreachable from porta_dock`);
    for (const m of ['demon_castle_1', 'edge_shrine']) if (has(sea, spawns[m])) E(`${m} reachable by ship before barrier_broken`);
    const all = flood([at('porta_dock'), at('regnas_castle'), at('east_gate_e')].filter(Boolean), { ship: true, barrier: true });
    for (const m of Object.keys(ICON_MAPS).concat(['east_gate_w', 'east_gate_e'])) if (!has(all, spawns[m])) E(`${m} unreachable even with ship + barrier_broken`);
    if (spawns.edge_shrine_dock && !has(all, spawns.edge_shrine_dock)) E('edge_shrine_dock unreachable after barrier_broken');
    let lost = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (walk(x, y) && !all.has(y * W + x)) lost++;
    notes.push(`sea by ship before the barrier: ${[...sea].filter(isSea).length} cells; walkable cells never reachable: ${lost}`);
  }

  // ---------------------------------------------------------- zones
  const zoneAt = (x, y) => {
    for (const z of map.zones || []) if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h) return z.zone;
    return map.defaultZone || null;
  };
  for (const z of map.zones || []) if (!LAND_ZONES.includes(z.zone) && !SEA_ZONES.includes(z.zone)) E(`unknown zone id ${z.zone}`);
  if (map.defaultZone && !SEA_ZONES.includes(map.defaultZone)) E(`defaultZone ${map.defaultZone} is not a sea zone`);
  const regionZone = {};
  const claim = (starts, zone) => { if (starts.length) for (const k of flood(starts)) regionZone[k] = zone; };
  if (spawns.regnas_castle) claim([at('regnas_castle')], 'w_start');
  if (spawns.east_gate_e) claim([at('east_gate_e')], 'w_east');
  const byDock = { elfin_dock: 'w_forest', salva_dock: 'w_desert', frost_dock: 'w_snow', volcano_dock: 'w_volcano', arcana_dock: 'w_arcana', edge_shrine_dock: 'w_demon' };
  for (const d in byDock) if (spawns[d]) claim(shoreOf(spawns[d]), byDock[d]);
  if (spawns.demon_castle_1) claim([at('demon_castle_1')], 'w_demon');
  let badSea = 0, badLand = 0;
  const counts = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = T(x, y), z = zoneAt(x, y);
    if (t.pass) {
      if (t.warpIcon) continue;
      counts[z] = (counts[z] || 0) + 1;
      if (!LAND_ZONES.includes(z)) { if (!badLand++) E(`walkable ${x},${y} (${tileId(x, y)}) has zone ${z}`); continue; }
      const want = regionZone[y * W + x];
      if (want && z !== want) { if (!badLand++) E(`${x},${y} has zone ${z}, its region wants ${want}`); }
    } else if (t.ship || t.flagPass) {
      counts[z] = (counts[z] || 0) + 1;
      if (!SEA_ZONES.includes(z)) { if (!badSea++) E(`sea ${x},${y} has zone ${z}`); }
    }
  }
  if (badLand) E(`${badLand} walkable cell(s) with a wrong zone`);
  if (badSea) E(`${badSea} sea cell(s) with a non-sea zone`);
  notes.push('zone cells: ' + Object.keys(counts).sort().map((k) => `${k} ${counts[k]}`).join(', '));
  notes.push(`${(map.zones || []).length} zone rects, default ${map.defaultZone}`);
  if (DB.encounters && Object.keys(DB.encounters).length) {
    const missing = [...new Set((map.zones || []).map((r) => r.zone).concat(map.defaultZone || []))].filter((z) => !DB.encounters[z]);
    if (missing.length) notes.push('encounter tables not defined yet: ' + missing.join(' '));
  }
  return { errors, notes, tileId, spawns, W, H };
}

// ------------------------------------------------------------ png
const COL = {
  sea: '#2850b8', reef: '#7890c0', barrier: '#7a2ab0', grass: '#48a838', plain: '#88c050', forest: '#1c6a28',
  hills: '#8aa048', mountain: '#7a6448', desert: '#e0c070', snow: '#eef2fa', snowforest: '#6a98a8', swamp: '#6a3a88',
  beach: '#f0e0a0', wasteland: '#8a6a48', magma: '#e04818', bridge_h: '#b07840', bridge_v: '#b07840',
};
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function writePng(file, res, DB, S) {
  const { W, H, tileId, spawns } = res;
  const w = W * S, h = H * S;
  const buf = Buffer.alloc(w * h * 3);
  const put = (px, py, c) => { if (px < 0 || py < 0 || px >= w || py >= h) return; const i = (py * w + px) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const id = tileId(x, y), t = DB.tiles[id] || {};
    const c = t.warpIcon ? [255, 255, 255] : rgb(COL[id] || '#ff00ff');
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      let cc = c;
      if (id === 'mountain' && (i + j) % 3 === 0) cc = [60, 44, 30];
      if (id === 'forest' && (i + j) % 2 === 0) cc = [14, 80, 30];
      if (id === 'hills' && j === S - 1) cc = [100, 120, 50];
      if (t.warpIcon && (i === 0 || j === 0 || i === S - 1 || j === S - 1)) cc = [220, 20, 20];
      put(x * S + i, y * S + j, cc);
    }
  }
  for (const k in spawns) {
    if (!/_dock$/.test(k)) continue;
    const s = spawns[k];
    for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) put(s.x * S + i, s.y * S + j, [255, 230, 0]);
  }
  // dotted grid every 16 tiles
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

module.exports = { checkWorld };

if (require.main === module) {
  const R = require('./lib/load')({ quiet: true });
  const map = R.DB.maps.world;
  if (!map) { console.log('ERROR no world map'); process.exit(1); }
  const res = checkWorld(R, map);
  const pi = process.argv.indexOf('--png');
  if (pi > 0) {
    const si = process.argv.indexOf('--scale');
    writePng(path.resolve(process.argv[pi + 1]), res, R.DB, si > 0 ? +process.argv[si + 1] : 4);
  }
  for (const n of res.notes) console.log('  ' + n);
  for (const e of res.errors) console.log('ERROR', e);
  console.log(`check_world: ${res.errors.length} error(s)`);
  process.exitCode = res.errors.length ? 1 : 0;
}
