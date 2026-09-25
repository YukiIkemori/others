#!/usr/bin/env node
// Completability checker: proves the game can be finished from a new game.
// BFS over every map (tile passability, locks, NPC blockers, tilePatches, warps,
// exits, ship, barrier flag), collecting chests and firing events whose
// meta.needs are satisfied, until a fixpoint. Expects flag 'game_clear'.
//   node tools/progress.js [--verbose]
'use strict';
const load = require('./lib/load');
const { parseMap } = require('./lib/maps');
const R = load({ quiet: true });
const DB = R.DB;
const verbose = process.argv.includes('--verbose');

const maps = {};
for (const id in DB.maps) maps[id] = parseMap(R, id);
const S = { items: new Set(), flags: new Set(), ship: null };
for (const it of ['herb']) S.items.add(it);
const log = [];

function check(cond) {
  if (cond == null || cond === true) return true;
  if (typeof cond === 'string') return cond[0] === '!' ? !S.flags.has(cond.slice(1)) : S.flags.has(cond);
  if (Array.isArray(cond)) return cond.every(check);
  if (cond.flag && !S.flags.has(cond.flag)) return false;
  if (cond.notFlag && S.flags.has(cond.notFlag)) return false;
  if (cond.item && !S.items.has(cond.item)) return false;
  if (cond.notItem && S.items.has(cond.notItem)) return false;
  if (cond.all && !cond.all.every(check)) return false;
  if (cond.any && !cond.any.some(check)) return false;
  return true;
}
function needsOk(needs) {
  return (needs || []).every((n) => {
    const [k, v] = n.split(':');
    if (k === 'flag') return S.flags.has(v);
    if (k === 'item') return S.items.has(v);
    return true;
  });
}
let changed = false;
function give(g, why) {
  if (g === 'ship') g = 'flag:has_ship';
  const [k, v] = g.split(':');
  const set = k === 'item' ? S.items : S.flags;
  if (k !== 'item' && k !== 'flag') return;
  if (set.has(v)) return;
  set.add(v); changed = true;
  log.push(`${g}  ← ${why}`);
  if (g === 'flag:has_ship' && !S.ship) S.ship = shipSpawn();
}
function shipSpawn() {
  const w = maps.world;
  return w && (w.spawns.porta_dock ? { map: 'world', ...w.spawns.porta_dock } : null);
}

function tileId(P, x, y) {
  let t = P.tileAt(x, y);
  for (const tp of P.def.tilePatches || []) if (tp.x === x && tp.y === y && check(tp.cond)) t = P.legend[tp.ch] || t;
  return t;
}
function blockedByNpc(P, x, y) {
  return P.npcs.some((n) => n.x === x && n.y === y && (n.move || 'still') !== 'wander' && check(n.cond));
}
function walkable(P, x, y, fromSea) {
  const id = tileId(P, x, y);
  const t = id && DB.tiles[id];
  if (!t) return null;
  if (blockedByNpc(P, x, y)) return null;
  const dec = P.decorAt(x, y);
  if (dec && DB.decor[dec] && !DB.decor[dec].pass) return null;
  if (t.flagPass && !S.flags.has(t.flagPass)) return null;
  const barrierOpen = t.flagPass && S.flags.has(t.flagPass) && t.shipWhenFlag;
  if (t.pass) {
    if (t.lock && !S.items.has(t.lock)) return null;
    return 'land';
  }
  if ((t.ship || barrierOpen) && S.flags.has('has_ship')) return 'sea';
  return null;
}

function bfs() {
  const seen = new Set();
  const reachedMaps = new Set();
  const q = [];
  const push = (map, x, y) => {
    const k = map + ':' + x + ',' + y;
    if (seen.has(k)) return; seen.add(k); q.push([map, x, y]); reachedMaps.add(map);
  };
  const start = maps[R.State.START.map];
  if (!start) return { seen, reachedMaps };
  const sp = start.spawns[R.State.START.spawn];
  if (!sp) { console.log('start spawn missing'); return { seen, reachedMaps }; }
  push(R.State.START.map, sp.x, sp.y);
  if (S.flags.has('has_ship') && S.ship) push('world', S.ship.x, S.ship.y);
  const goSpawn = (to, spawn) => {
    const P = maps[to];
    if (!P) return;
    const s = typeof spawn === 'string' ? P.spawns[spawn] : spawn;
    if (s) push(to, s.x, s.y);
  };
  while (q.length) {
    const [mid, x, y] = q.shift();
    const P = maps[mid];
    // warp on this tile (not for the arrival tile of the start… warps fire on step, approximated as always)
    const wp = P.warps.find((w) => w.x === x && w.y === y && check(w.cond));
    if (wp) goSpawn(wp.to, wp.spawn);
    const here = walkable(P, x, y) || 'land';
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= P.w || ny >= P.h) {
        if (P.def.exit) goSpawn(P.def.exit.to, P.def.exit.spawn);
        continue;
      }
      const k = walkable(P, nx, ny);
      if (!k) continue;
      if (k === 'sea' && here === 'land' && !S.flags.has('has_ship')) continue;
      push(mid, nx, ny);
    }
  }
  return { seen, reachedMaps };
}

function near(seen, map, x, y, P) {
  if (seen.has(`${map}:${x},${y}`)) return true;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (seen.has(`${map}:${x + dx},${y + dy}`)) return true;
    // across a counter
    const mid = P && DB.tiles[tileId(P, x + dx, y + dy)];
    const md = P && P.decorAt(x + dx, y + dy);
    const counter = (mid && mid.counter) || (md && DB.decor[md] && DB.decor[md].counter);
    if (counter && seen.has(`${map}:${x + 2 * dx},${y + 2 * dy}`)) return true;
  }
  return false;
}

let rounds = 0, reach;
do {
  changed = false; rounds++;
  reach = bfs();
  for (const mid of reach.reachedMaps) {
    const P = maps[mid];
    if (P.def.onEnter) fire(P.def.onEnter, `onEnter ${mid}`);
    if (P.def.location) give('flag:visited_' + P.def.location, `enter ${mid}`);
    for (const c of P.chests) if (near(reach.seen, mid, c.x, c.y, P) && check(c.cond) && c.item) give('item:' + c.item, `chest ${c.id} @${mid}`);
    for (const h of P.hidden) if (near(reach.seen, mid, h.x, h.y, P)) give('item:' + h.item, `hidden ${h.id} @${mid}`);
    for (const n of P.npcs) if (n.event && check(n.cond) && near(reach.seen, mid, n.x, n.y, P)) fire(n.event, `npc ${n.id} @${mid}`);
    for (const e of P.events) if (check(e.cond) && (e.trigger === 'step' ? reach.seen.has(`${mid}:${e.x},${e.y}`) : near(reach.seen, mid, e.x, e.y, P))) fire(e.id, `event @${mid} ${e.x},${e.y}`);
  }
} while (changed && rounds < 200);

function fire(id, why) {
  const ev = DB.events[id];
  if (!ev || !ev.meta) return;
  if (!needsOk(ev.meta.needs)) return;
  for (const g of ev.meta.gives || []) give(g, `${id} (${why})`);
}

// ----------------------------------------------------------------- report
console.log('Acquisition order:');
for (const l of log) if (verbose || !l.includes('chest ') && !l.includes('hidden ')) console.log('  ' + l);
const unreachedMaps = Object.keys(maps).filter((m) => !reach.reachedMaps.has(m));
if (unreachedMaps.length) console.log('\nUNREACHED MAPS:', unreachedMaps.join(', '));
const missingChests = [];
for (const mid in maps) for (const c of maps[mid].chests) if (!near(reach.seen, mid, c.x, c.y, maps[mid])) missingChests.push(`${mid}:${c.id}`);
if (missingChests.length) console.log('\nUNREACHABLE CHESTS:', missingChests.join(', '));
const keys = ['crest_wind', 'crest_water', 'crest_earth', 'crest_fire', 'crest_star', 'light_crest', 'silver_key', 'gold_key'];
console.log('\nkey items:', keys.map((k) => (S.items.has(k) ? '✓' : '✗') + k).join(' '));
console.log('flags:', [...S.flags].sort().join(' '));
const ok = S.flags.has('game_clear');
console.log(ok ? '\nCOMPLETABLE ✓ (flag game_clear reached)' : '\nNOT COMPLETABLE ✗ (game_clear never reached)');
process.exitCode = ok && !unreachedMaps.length ? 0 : 1;
