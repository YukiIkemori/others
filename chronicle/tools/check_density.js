#!/usr/bin/env node
// check_density.js (owner qa A22) — interior density of every town / castle / village / house map (DESIGN §11.2.7,
// §11.12.1-5). Rooms are the 4-connected regions of interior floor (floor · wood · carpet and the furniture standing
// on it) closed by walls and doors. Per room it measures, and warns outside the target:
//   blocking furniture (impassable furniture tiles + impassable decor) / room cells ........ 15–25 %  (> 30 %: thin it out)
//   walkable props (chairs + passable decor: rugs, flowers, straw, leaves) / room cells ... 5–15 %
//   wall decor on the visible (north) wall face .............................................. 1 per 3–4 wall cells
//   aisle: door → the front of a counter is ≥ 2 wide in rooms with a counter (shop / inn / tavern); 1 wide elsewhere,
//          and no floor cell cut off by furniture (dead ends made of furniture)
//   empty: no 3×3 block of bare floor (halls with a throne, and the cells in front of a door, excepted)
//
//   node tools/check_density.js               every map; warnings; exit 0 (exit 1 only on load errors)
//   node tools/check_density.js --map lute    one map, with a per-room table      --strict  exit 1 on any warning
//   node tools/check_density.js --owner R3    only the maps of one owner          --quiet   totals only
'use strict';
const M = require('./lib/maps');

const INTERIOR = new Set(['floor', 'wood', 'carpet']);
const FURNITURE = new Set(['counter', 'table', 'bed', 'bookshelf', 'shelf', 'pot', 'barrel', 'crate', 'throne', 'pillar', 'altar', 'statue', 'sign', 'well', 'pedestal', 'grave']);
const SOFT = new Set(['chair']);
const WALLS = new Set(['wall', 'wall_torch', 'housewall', 'roof', 'void', 'rock', 'pillar']);
const TARGET = { block: [0.15, 0.25], blockMax: 0.30, soft: [0.05, 0.15], wallDecor: [1 / 4, 1 / 3] };

function analyseMap(R, P) {
  const DB = R.DB;
  const W = P.w, H = P.h;
  const tile = (x, y) => (P.inMap(x, y) ? P.tileAt(x, y) : null);
  const isDoor = (x, y) => { const t = tile(x, y) || ''; return /door|stairs/.test(t) || P.warps.some((w) => w.x === x && w.y === y); };
  const roomCell = (x, y) => { const t = tile(x, y); return !!t && (INTERIOR.has(t) || FURNITURE.has(t) || SOFT.has(t) || !!(DB.tiles[t] && DB.tiles[t].counter)) && !isDoor(x, y); };
  const occupied = new Set();
  for (const o of [].concat(P.npcs, P.chests, P.events.filter((e) => e.trigger !== 'step'), P.signs)) occupied.add(o.x + ',' + o.y);
  const seen = new Uint8Array(W * H);
  const rooms = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !roomCell(x, y) || !INTERIOR.has(tile(x, y))) continue;
    const cells = [];
    const q = [[x, y]];
    seen[y * W + x] = 1;
    while (q.length) {
      const [cx, cy] = q.pop();
      cells.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!P.inMap(nx, ny) || seen[ny * W + nx] || !roomCell(nx, ny)) continue;
        seen[ny * W + nx] = 1;
        q.push([nx, ny]);
      }
    }
    if (cells.length < 6) continue;
    // an interior is closed by walls and doors; paved streets (town floor) touch water, grass, sand or the map edge
    const inside = new Set(cells.map(([cx, cy]) => cx + ',' + cy));
    let wallB = 0, openB = 0;
    for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (inside.has(nx + ',' + ny)) continue;
      if (!P.inMap(nx, ny)) { openB++; continue; }
      const t = tile(nx, ny), td = DB.tiles[t] || {};
      if (isDoor(nx, ny) || WALLS.has(t) || (!td.pass && !/water|bog|lava/.test(t) && !FURNITURE.has(t))) wallB++; else openB++;
    }
    if (openB > 0.2 * (wallB + openB)) continue;
    rooms.push(measure(R, P, cells, { tile, isDoor, occupied }));
  }
  return rooms;
}

function measure(R, P, cells, h) {
  const DB = R.DB;
  const inRoom = new Set(cells.map(([x, y]) => x + ',' + y));
  let block = 0, soft = 0, counters = 0, throne = false;
  const free = new Set();
  for (const [x, y] of cells) {
    const t = h.tile(x, y), td = DB.tiles[t] || {};
    const dd = P.decorDef(x, y);
    if (t === 'throne') throne = true;
    if (td.counter || (dd && dd.counter)) counters++;
    if (FURNITURE.has(t) || (dd && !dd.pass && !dd.wall)) block++;
    else if (SOFT.has(t) || (dd && dd.pass)) { soft++; free.add(x + ',' + y); }
    else free.add(x + ',' + y);
  }
  // visible wall face: wall cells right above a room cell; wall decor on them (or wall-mounted decor anywhere on the face)
  const face = new Set();
  for (const [x, y] of cells) {
    const t = h.tile(x, y - 1), td = DB.tiles[t] || {};
    if (t && !td.pass && !inRoom.has(x + ',' + (y - 1)) && !FURNITURE.has(t) && !h.isDoor(x, y - 1)) face.add(x + ',' + (y - 1));
  }
  let wallDecor = 0;
  for (const k of face) { const [x, y] = k.split(',').map(Number); const dd = P.decorDef(x, y); if (dd && (dd.wall || !dd.pass)) wallDecor++; }
  // doors of the room
  const doors = [];
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (h.isDoor(x + dx, y + dy)) doors.push([x, y]);
  // reachability from the doors (1 wide) and 2-wide aisle to the counter front
  const reach = bfs(free, doors.filter(([x, y]) => free.has(x + ',' + y)), () => true);
  // unreachable pockets, except the staff side of a counter (a pocket with an NPC or touching a counter)
  const cut = [];
  const pocketSeen = new Set();
  for (const k of free) {
    if (reach.has(k) || pocketSeen.has(k)) continue;
    const [px, py] = k.split(',').map(Number);
    const pocket = bfs(free, [[px, py]], (kk) => !reach.has(kk));
    for (const kk of pocket) pocketSeen.add(kk);
    const staff = [...pocket].some((kk) => {
      if (h.occupied.has(kk)) return true;
      const [x, y] = kk.split(',').map(Number);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const td = DB.tiles[h.tile(x + dx, y + dy)] || {}, dd = P.decorDef(x + dx, y + dy); return td.counter || (dd && dd.counter); });
    });
    if (!staff) cut.push(...pocket);
  }
  let aisle = null;
  if (counters) {
    const wide = (k) => { const [x, y] = k.split(',').map(Number); return [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([ox, oy]) => [[0, 0], [1, 0], [0, 1], [1, 1]].every(([ax, ay]) => free.has((x + ox + ax) + ',' + (y + oy + ay)))); };
    const r2 = bfs(free, doors.filter(([x, y]) => free.has(x + ',' + y)), wide);
    const fronts = [];
    for (const [x, y] of cells) {
      const td = DB.tiles[h.tile(x, y)] || {}, dd = P.decorDef(x, y);
      if (!(td.counter || (dd && dd.counter))) continue;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const k = (x + dx) + ',' + (y + dy); if (free.has(k) && !h.occupied.has(k)) fronts.push(k); }
    }
    aisle = fronts.length ? fronts.some((k) => r2.has(k)) : null;
    // the NPC side of the counter is also "front": only one side needs a wide aisle
  }
  // empty 3×3 blocks of bare floor (not in front of a door, not in a throne hall)
  let empty3 = 0;
  const bare = (x, y) => { const k = x + ',' + y; return free.has(k) && !P.decorAt(x, y) && !h.occupied.has(k) && !SOFT.has(h.tile(x, y)); };
  const nearDoor = (x, y) => doors.some(([dx, dy]) => Math.abs(dx - x) <= 2 && Math.abs(dy - y) <= 2);
  if (!throne) for (const [x, y] of cells) {
    let ok = true;
    for (let j = 0; j < 3 && ok; j++) for (let i = 0; i < 3 && ok; i++) if (!bare(x + i, y + j)) ok = false;
    if (ok && !nearDoor(x + 1, y + 1)) empty3++;
  }
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  return {
    size: cells.length, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    block: block / cells.length, soft: soft / cells.length, face: face.size, wallDecor, counters, doors: doors.length,
    cut: cut.length, aisle, empty3, throne,
  };
}

function bfs(free, starts, okFn) {
  const out = new Set();
  const q = [];
  for (const [x, y] of starts) { const k = x + ',' + y; if (free.has(k) && okFn(k) && !out.has(k)) { out.add(k); q.push([x, y]); } }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (y + dy);
      if (out.has(k) || !free.has(k) || !okFn(k)) continue;
      out.add(k); q.push([x + dx, y + dy]);
    }
  }
  return out;
}

function run(opts) {
  opts = opts || {};
  const V = require('./validate');
  let R = opts.R, prov = opts.prov;
  if (!R) { const L = V.loadTracked({ with: opts.with }); R = L.R; prov = L.prov; }
  const DB = R.DB;
  const findings = [], table = {};
  const own = (id) => { const f = prov && prov.maps && prov.maps[id]; return f ? V.ownerOfFile(f) : V.expectedMapOwner(id) || '?'; };
  const pct = (x) => Math.round(100 * x) + '%';
  for (const id of Object.keys(DB.maps || {})) {
    if (opts.map && id !== opts.map) continue;
    const d = DB.maps[id];
    if (!['town', 'castle', 'village'].includes(d.type || 'town') && !/_house/.test(id)) continue;
    const P = M.parseMap(R, id);
    if (!P) continue;
    const rooms = analyseMap(R, P);
    table[id] = rooms;
    const o = own(id);
    const W = (msg) => findings.push({ level: 'warn', owner: o, map: id, msg: `map ${id}: ${msg}` });
    rooms.forEach((r, i) => {
      const where = `room ${i + 1} (${r.size} cells @${r.bbox[0]},${r.bbox[1]}–${r.bbox[2]},${r.bbox[3]})`;
      if (r.block > TARGET.blockMax) W(`${where}: blocking furniture ${pct(r.block)} (> 30%: thin it out; target 15–25%)`);
      else if (r.block < TARGET.block[0] || r.block > TARGET.block[1]) W(`${where}: blocking furniture ${pct(r.block)} (target 15–25%)`);
      if (r.soft < TARGET.soft[0] || r.soft > TARGET.soft[1]) W(`${where}: walkable props ${pct(r.soft)} (target 5–15%)`);
      if (r.face >= 3) { const per = r.wallDecor / r.face; if (per < 1 / 5) W(`${where}: ${r.wallDecor} wall decor on ${r.face} wall cells (target 1 per 3–4)`); else if (per > 1 / 2) W(`${where}: ${r.wallDecor} wall decor on ${r.face} wall cells (crowded; target 1 per 3–4)`); }
      if (r.aisle === false) W(`${where}: no 2-wide aisle from the door to the counter`);
      if (r.cut) W(`${where}: ${r.cut} floor cell(s) cut off by furniture (dead end)`);
      if (r.empty3) W(`${where}: ${r.empty3} bare 3×3 floor block(s)`);
      if (!r.doors) W(`${where}: no door into the room`);
    });
  }
  return { findings, table };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : null; };
  const owners = arg('owner') ? arg('owner').split(',') : null;
  const res = run({ map: arg('map'), with: arg('with') ? arg('with').split(',') : null });
  let list = res.findings;
  if (owners) list = list.filter((f) => owners.includes(f.owner));
  if (!argv.includes('--quiet')) for (const f of list) console.log(`WARN  [${f.owner}] ${f.msg}`);
  if (arg('map') && res.table[arg('map')]) {
    console.log(`\n${arg('map')}: room  size  block  soft  wall-decor/face  counters  aisle  cut  bare3x3`);
    res.table[arg('map')].forEach((r, i) => console.log(`  ${String(i + 1).padStart(4)} ${String(r.size).padStart(5)} ${String(Math.round(100 * r.block)).padStart(5)}% ${String(Math.round(100 * r.soft)).padStart(4)}%  ${String(r.wallDecor).padStart(4)}/${String(r.face).padEnd(4)}        ${String(r.counters).padStart(4)}  ${r.aisle == null ? '  - ' : r.aisle ? '  ok' : '  NO'} ${String(r.cut).padStart(4)} ${String(r.empty3).padStart(7)}`));
  }
  const nMaps = Object.keys(res.table).length, nRooms = Object.values(res.table).reduce((s, r) => s + r.length, 0);
  console.log(`\ncheck_density: ${list.length} warning(s) over ${nRooms} room(s) in ${nMaps} town/house map(s)`);
  process.exitCode = argv.includes('--strict') && list.length ? 1 : 0;
}

module.exports = { run, analyseMap };
if (require.main === module) main();
