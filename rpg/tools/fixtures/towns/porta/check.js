#!/usr/bin/env node
// Porta layout checks with the decor layer taken into account (check_towns.js
// ignores decor): reachability of every NPC / chest / sign / warp from the
// entrance, wander room, doors kept clear, walkable edge cells (map exits),
// wall hangings vs. house windows, tall pieces vs. hangings above them.
//   node tools/fixtures/towns/porta/check.js [mapId ...]
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true });
const { parseMap } = require(path.join(ROOT, 'tools/lib/maps'));
const DB = R.DB;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['porta_town', 'porta_house'];
let errs = 0;
for (const id of ids) {
  const P = parseMap(R, id);
  const out = (lvl, m) => { if (lvl === 'E') errs++; console.log(`${lvl} ${id}: ${m}`); };
  for (const i of P.issues) out('E', i);
  const dd = (x, y) => { const d = P.decorAt(x, y); return d ? DB.decor[d] : null; };
  const tile = (x, y) => DB.tiles[P.tileAt(x, y)] || {};
  const pass = (x, y) => { const t = tile(x, y); const d = dd(x, y); return !!t.pass && (!d || !!d.pass); };
  const counter = (x, y) => { const d = dd(x, y); return !!(tile(x, y).counter || (d && d.counter)); };
  const block = new Set(P.npcs.filter((n) => (n.move || 'still') !== 'wander' && n.cond == null).map((n) => n.x + ',' + n.y));
  for (const c of P.chests) block.add(c.x + ',' + c.y);
  for (const s of P.signs) block.add(s.x + ',' + s.y);
  const ent = P.spawns.entrance;
  const seen = new Set([ent.x + ',' + ent.y]);
  const q = [[ent.x, ent.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || nx < 0 || ny < 0 || nx >= P.w || ny >= P.h || !pass(nx, ny) || block.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const talk = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)) || (counter(x + dx, y + dy) && seen.has((x + 2 * dx) + ',' + (y + 2 * dy))));
  for (const n of P.npcs) {
    if (/^obj:/.test(n.sprite || '')) continue;
    if (!talk(n.x, n.y)) out('E', `npc ${n.id} @${n.x},${n.y} cannot be talked to`);
    if (dd(n.x, n.y) && !dd(n.x, n.y).pass) out('E', `npc ${n.id} stands on decor ${P.decorAt(n.x, n.y)}`);
    if (n.move === 'wander') {
      let room = 0;
      for (let y = n.y - 2; y <= n.y + 2; y++) for (let x = n.x - 2; x <= n.x + 2; x++) if (pass(x, y) && !block.has(x + ',' + y) && !/^door|stairs/.test(P.tileAt(x, y))) room++;
      if (room < 6) out('W', `npc ${n.id} @${n.x},${n.y} has little room to wander (${room})`);
    }
  }
  for (const c of P.chests) if (!talk(c.x, c.y)) out('E', `chest ${c.id} @${c.x},${c.y} unreachable`);
  for (const s of P.signs) if (!talk(s.x, s.y)) out('E', `sign @${s.x},${s.y} unreachable`);
  for (const w of P.warps) if (!seen.has(w.x + ',' + w.y)) out('E', `warp @${w.x},${w.y} unreachable`);
  // doors: open floor on both sides (north/south)
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const t = P.tileAt(x, y);
    if (/^door/.test(t) && !P.warps.some((w) => w.x === x && w.y === y)) for (const dy of [-1, 1]) if (!pass(x, y + dy)) out('E', `door @${x},${y}: blocked at ${x},${y + dy}`);
  }
  // exits: walkable edge cells
  const edges = [];
  for (const k of seen) { const [x, y] = k.split(',').map(Number); if (x === 0 || y === 0 || x === P.w - 1 || y === P.h - 1) edges.push(k); }
  if (P.def.exit) console.log(`  ${id}: exit edge cells ${edges.join(' ')}`);
  // decor sanity
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const d = P.decorAt(x, y); if (!d) continue;
    const def = DB.decor[d], t = P.tileAt(x, y);
    if (def.wall && tile(x, y).pass) out('E', `wall decor ${d} on walkable ${t} @${x},${y}`);
    if (!def.wall && !tile(x, y).pass) out('W', `floor decor ${d} on ${t} @${x},${y}`);
    if (def.wall && t === 'housewall' && P.tileAt(x, y + 1) !== 'housewall' && x % 3 !== 0) out('W', `hanging ${d} over a house window @${x},${y}`);
    if (def.tall && P.decorAt(x, y - 1) && DB.decor[P.decorAt(x, y - 1)].wall) out('W', `tall ${d} @${x},${y} covers hanging ${P.decorAt(x, y - 1)} above`);
  }
  // unreached walkable cells (dead pockets)
  const pockets = [];
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (pass(x, y) && !seen.has(x + ',' + y) && !block.has(x + ',' + y)) pockets.push(x + ',' + y);
  if (pockets.length) console.log(`  ${id}: walkable but unreachable: ${pockets.join(' ')}`);
  console.log(`  ${id}: ${seen.size} reachable cells, npcs ${P.npcs.length}, chests ${P.chests.length}`);
}
console.log(errs ? `${errs} error(s)` : 'ok');
process.exit(errs ? 1 : 0);
