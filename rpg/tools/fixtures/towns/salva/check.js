#!/usr/bin/env node
// Decor-aware checks for the サルバ maps (castle, town, house interiors):
// check_towns.js ignores the decor layer, so this BFS uses the runtime
// R.FieldMap walkability (decor furniture blocks, counter decor talks across).
//   node tools/fixtures/towns/regnas/check.js      (exit 1 on errors)
// Checks: everything reachable from 'entrance' (spawns, warps, NPCs talkable,
// chests/signs usable), doors passable on both sides, nothing placed on doors/
// warps/spawns, wanderers have room to move, the ending walk in the throne room.
'use strict';
const path = require('path');
const load = require(path.resolve(__dirname, '../../../lib/load'));
const R = load({ quiet: true });
const MAPS = process.argv.slice(2).length ? process.argv.slice(2) : ['salva_town', 'salva_house'];
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
R.State.newGame();

for (const id of MAPS) {
  const m = R.FieldMap.compile(id);
  const npcs = m.npcs.filter((n) => n.cond == null);
  const still = new Set(npcs.filter((n) => (n.move || 'still') !== 'wander').map((n) => n.x + ',' + n.y));
  const chestAt = new Set(m.chests.map((c) => c.x + ',' + c.y));
  const door = (x, y) => /^door/.test(m.tileAt(x, y));
  const ok = (x, y) => m.inBounds(x, y) && m.walkable(x, y) && !still.has(x + ',' + y) && !chestAt.has(x + ',' + y);
  const seen = new Set();
  const ent = m.spawns.entrance;
  const q = [[ent.x, ent.y]];
  seen.add(ent.x + ',' + ent.y);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !ok(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const S = (x, y) => seen.has(x + ',' + y);
  const adj = (x, y, across) => D4.some(([dx, dy]) => S(x + dx, y + dy) || (across && m.counterAt(x + dx, y + dy) && S(x + 2 * dx, y + 2 * dy)));
  for (const k in m.spawns) { const s = m.spawns[k]; if (!S(s.x, s.y)) E(`${id}: spawn ${k} @${s.x},${s.y} unreachable`); }
  for (const w of m.warps) if (!S(w.x, w.y)) E(`${id}: warp @${w.x},${w.y} unreachable`);
  for (const n of npcs) {
    if (!adj(n.x, n.y, true) && !S(n.x, n.y)) E(`${id}: npc ${n.id} @${n.x},${n.y} cannot be talked to`);
    const dd = m.decorDef(n.x, n.y);
    if (dd && !dd.pass) E(`${id}: npc ${n.id} stands on furniture ${m.decorAt(n.x, n.y)}`);
    if (n.move === 'wander') {
      let room = 0;
      for (let y = n.y - 2; y <= n.y + 2; y++) for (let x = n.x - 2; x <= n.x + 2; x++) if (ok(x, y) && !/^door|stairs/.test(m.tileAt(x, y)) && !m.warpAt(x, y)) room++;
      if (room < 6) W(`${id}: wanderer ${n.id} @${n.x},${n.y} has little room (${room} cells)`);
    }
  }
  for (const c of m.chests) if (!adj(c.x, c.y, false)) E(`${id}: chest ${c.id} @${c.x},${c.y} unreachable`);
  for (const s of m.signs || []) if (!adj(s.x, s.y, true)) E(`${id}: sign @${s.x},${s.y} unreadable`);
  // doors: walkable on both sides (vertical or horizontal), no decor on them
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (door(x, y)) {
      const ns = ok(x, y - 1) || door(x, y - 1) || !m.inBounds(x, y - 1), ss = ok(x, y + 1) || door(x, y + 1) || !m.inBounds(x, y + 1);
      const ws = ok(x - 1, y) || door(x - 1, y), es = ok(x + 1, y) || door(x + 1, y);
      const warp = !!m.warpAt(x, y);
      if (!warp && !((ns && ss) || (ws && es))) E(`${id}: door @${x},${y} blocked on one side`);
      if (!S(x, y) && !warp) E(`${id}: door @${x},${y} unreachable`);
      if (m.decorAt(x, y)) E(`${id}: decor ${m.decorAt(x, y)} on door @${x},${y}`);
    }
    const d = m.decorAt(x, y);
    if (d && (m.warpAt(x, y) || chestAt.has(x + ',' + y))) E(`${id}: decor ${d} on warp/chest @${x},${y}`);
  }
  for (const k in m.spawns) { const s = m.spawns[k], dd = m.decorDef(s.x, s.y); if (dd && !dd.pass) E(`${id}: spawn ${k} on furniture`); }
  // unreachable walkable pockets (dead floor) are a layout smell
  let pockets = 0; const pk = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.walkable(x, y) && !S(x, y) && !still.has(x + ',' + y) && !chestAt.has(x + ',' + y)) { pockets++; pk.push(x + ',' + y); }
  if (pockets) W(`${id}: ${pockets} walkable cell(s) not reachable from the entrance: ${pk.slice(0, 40).join(" ")}`);
  if (id === 'regnas_castle') {
    const king = m.npc('king');
    if (!king || king.x !== 19 || king.y !== 2) E('castle: king must sit at 19,2');
    if (m.spawns.start.x !== 19 || m.spawns.start.y !== 3) E('castle: spawn start must be 19,3 (ending.js)');
    for (let y = 3; y <= 9; y++) if (!m.walkable(19, y)) E(`castle: ending walk blocked at 19,${y}`);
    const cheer = R.DB.maps.regnas_castle.npcs;
    for (const c of cheer) if (c.x === 19 && c.y >= 3 && c.y <= 9) E(`castle: ${c.id} stands on the ending walk`);
  }
  console.log(`${id.padEnd(20)} ${m.w}x${m.h} reach ${seen.size} npcs ${npcs.length} chests ${m.chests.length} signs ${(m.signs || []).length}`);
}
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('ERROR', e);
console.log(`\nsalva check: ${errors.length} error(s), ${warns.length} warning(s)`);
process.exitCode = errors.length ? 1 : 0;
