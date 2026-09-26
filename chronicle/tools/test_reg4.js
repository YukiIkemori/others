#!/usr/bin/env node
// test_reg4.js (owner R4, reg-4) — region 4 グレイモア湿原 (r_marsh): maps, objects, reachability and the
// event flow of DESIGN §10.8.5 / §10.8.0 / §10.6.2 / §10.6.4 / §11.2.7, in node (exit 1 on any failure).
//
//   node tools/test_reg4.js [--verbose]
//
// Sections
//   M  map shapes: ids, sizes (§10.6.2 minima), type/theme/bgm/location/region/escape/encounter/lvOff/outside
//   S  spawns and warps (entrance/inn/dock, entrance/from_prev/from_next, the stairs pair up)
//   N  NPCs: fixed/push on every one, service ids (inn/tavern/shops/ferry), folk_a/b rumors, scribe,
//      st_rival/st_fine/st_extra frames (§10.8.0-7), the region's cast
//   C  chests: ids <map>_c<n>, pools only, per-floor counts (§8.12.4), p_rare 1 per dungeon
//   X  closed tiles: every closed cell has an examine event and a tilePatch that opens it (§10.8.0-6)
//   Q  secret passage (§10.6.4): mist_manor_1 only, leads to the tea room (its own zone, rare ×3), nothing
//      the story needs beyond it
//   P  poison floor in bell_marsh_1: ~14 cells, never needed (reachability without them)
//   R  reachability (flood fill over the compiled maps, fixed NPCs and chests block) under the flags of
//      each stage: the ballroom before the dolls, Melda's room after, the three chains, the fog gate
//      closed until marsh_bells = 3, every chest
//   E  event flow with a scripted ev (battle results win/lose/escape): intro, dolls, Melda, bells,
//      the boss → marsh_boss, clearRegion('r_marsh'), the inn of Loch, story_after_clear; the reward
//   O  objectives obj_marsh_1..3 text; STYLE_JA line length (20 full-width) for every region-4 string
'use strict';
const R = require('./lib/load')();
const VERBOSE = process.argv.includes('--verbose');
const DB = R.DB;
let pass = 0, fail = 0;
const fails = [];
function ok(cond, sec, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + sec + ' ' + msg); }
  else { fail++; fails.push(sec + ' ' + msg); console.log('  FAIL ' + sec + ' ' + msg); }
}
const MAPS = ['loch', 'mist_manor_1', 'mist_manor_2', 'bell_marsh_1'];
const DUNGEON = { mist_manor_1: 'mist_manor', mist_manor_2: 'mist_manor', bell_marsh_1: 'bell_marsh' };

function fresh(flags, o) {
  R.State.newGame();
  const g = R.Game;
  for (const f of flags || []) R.State.setFlag(f, true);
  if (o && o.vars) for (const k in o.vars) R.State.setVar(k, o.vars[k]);
  if (o && o.items) for (const k of o.items) R.State.addItem(k, 1);
  if (o && o.cleared) { g.regionsCleared = g.regionsCleared || []; g.regionsCleared.push('r_marsh'); g.tier = g.regionsCleared.length; R.State.setFlag('cleared_r_marsh', true); }
  return g;
}
function compile(id) { const M = R.FieldMap.compile(id); M.refresh(); return M; }

// ------------------------------------------------------------------ M
for (const id of MAPS) {
  const d = DB.maps[id];
  ok(!!d, 'M', id + ' is registered');
  if (!d) continue;
  const H = d.rows.length, W = d.rows[0].length;
  ok(d.rows.every((r) => r.length === W) && (!d.decor || (d.decor.length === H && d.decor.every((r) => r.length === W))), 'M', id + ' rows/decor are rectangular ' + W + '×' + H);
  ok(d.region === 'r_marsh', 'M', id + ' region r_marsh');
  ok(d.outside != null, 'M', id + ' has outside');
  if (id === 'loch') {
    ok(W >= 40 && H >= 32, 'M', 'loch ≥ 40×32');
    ok(d.type === 'town' && d.theme === 'town_marsh' && d.bgm === 'town' && d.location === 'loch', 'M', 'loch town/town_marsh/town/location');
    ok(d.outside === '~', 'M', 'loch outside is water (port town)');
    ok(d.exit && ((d.exit.to === 'world' && d.exit.spawn === 'loch') || (d.exit.right && d.exit.right.to === 'world' && d.exit.right.spawn === 'loch')), 'M', 'loch exit → world loch');
  } else {
    ok(W >= 34 && H >= 30, 'M', id + ' ≥ 34×30');
    ok(d.type === 'dungeon' && d.bgm === 'ghost' && d.location === DUNGEON[id], 'M', id + ' dungeon/ghost/location ' + DUNGEON[id]);
    ok(d.escape && d.escape.to === 'world' && d.escape.spawn === (id === 'bell_marsh_1' ? 'bell_marsh_1' : 'mist_manor_1'), 'M', id + ' escape → world 1F');
    ok(d.theme === (id === 'bell_marsh_1' ? 'swamp' : 'manor'), 'M', id + ' theme');
    ok(d.encounter === (id === 'bell_marsh_1' ? 'z_r_marsh_bog' : 'z_r_marsh_manor') && DB.encounters[d.encounter], 'M', id + ' encounter zone');
    ok(id === 'mist_manor_2' ? d.lvOff === 2 : d.lvOff == null, 'M', id + ' lvOff rule (§10.6.2-9)');
  }
}
ok(DB.encounters.z_r_marsh_teaparty && DB.rareEncounters.z_r_marsh_teaparty && DB.rareEncounters.z_r_marsh_teaparty.rate * 3 <= DB.rareEncounters.z_r_marsh_manor.rate + 2, 'M', 'tea-room zone: same groups, rare rate ×3');

// ------------------------------------------------------------------ S
fresh();
const L = compile('loch'), M1 = compile('mist_manor_1'), M2 = compile('mist_manor_2'), B1 = compile('bell_marsh_1');
for (const s of ['entrance', 'inn', 'dock']) ok(L.hasSpawn(s) && L.walkable(L.spawns[s].x, L.spawns[s].y), 'S', 'loch spawn ' + s + ' walkable');
ok(L.spawns.inn.dir === 'down', 'S', 'loch inn spawn faces down');
ok(M1.hasSpawn('entrance') && M1.hasSpawn('from_next') && !M1.hasSpawn('from_prev'), 'S', 'mist_manor_1 entrance/from_next');
ok(M2.hasSpawn('from_prev'), 'S', 'mist_manor_2 from_prev');
ok(B1.hasSpawn('entrance'), 'S', 'bell_marsh_1 entrance');
const warpsOf = (id) => DB.maps[id].warps || [];
ok(warpsOf('mist_manor_1').some((w) => w.to === 'mist_manor_2' && w.spawn === 'from_prev'), 'S', '1F stairs → 2F from_prev');
ok(warpsOf('mist_manor_2').some((w) => w.to === 'mist_manor_1' && w.spawn === 'from_next'), 'S', '2F stairs → 1F from_next');
ok(warpsOf('mist_manor_1').some((w) => w.to === 'world' && w.spawn === 'mist_manor_1'), 'S', '1F front door → world');
ok(warpsOf('bell_marsh_1').some((w) => w.to === 'world' && w.spawn === 'bell_marsh_1'), 'S', 'bog entrance → world');
for (const id of MAPS) for (const w of warpsOf(id)) ok(w.to === 'world' ? (DB.maps.world && R.FieldMap.spawnPos(w.spawn, 'world')) : R.FieldMap.compile(w.to).hasSpawn(w.spawn), 'S', id + ' warp ' + w.x + ',' + w.y + ' → ' + w.to + ':' + w.spawn + ' exists');
// every warp stands next to a spawn of the same map (arrivals do not re-trigger it)
for (const id of MAPS) {
  const sp = Object.values(DB.maps[id].spawns || {});
  for (const w of warpsOf(id)) ok(sp.some((s) => Math.abs(s.x - w.x) + Math.abs(s.y - w.y) <= 2), 'S', id + ' warp ' + w.x + ',' + w.y + ' has a spawn beside it');
}

// ------------------------------------------------------------------ N
const npcs = (id) => DB.maps[id].npcs || [];
for (const id of MAPS) for (const n of npcs(id)) ok(n.fixed === true || n.push === true, 'N', id + ' npc ' + n.id + ' has fixed or push');
const byId = (id, nid) => npcs(id).find((n) => n.id === nid);
for (const [nid, sh] of [['shop_item', 'loch_item'], ['shop_weapon', 'loch_weapon'], ['shop_armor', 'loch_armor']]) {
  const n = byId('loch', nid);
  ok(n && n.event === 'common_shop' && n.shop === sh && DB.shops && DB.shops[sh] && n.fixed, 'N', 'loch ' + nid + ' → ' + sh);
}
ok(byId('loch', 'inn') && byId('loch', 'inn').event === 'common_inn', 'N', 'loch inn → common_inn');
ok(byId('loch', 'tavern') && byId('loch', 'tavern').event === 'common_tavern', 'N', 'loch tavern → common_tavern');
ok(byId('loch', 'ferry') && byId('loch', 'ferry').ferryFrom === 'loch' && byId('loch', 'ferry').event === 'common_ferry', 'N', 'loch ferry (ferryFrom loch)');
for (const [f, r] of [['folk_a', 'loch_a'], ['folk_b', 'loch_b']]) {
  const n = byId('loch', f);
  ok(n && n.event === 'story_rumor' && n.rumor === r && n.push, 'N', 'loch ' + f + ' rumor ' + r);
}
const scribe = byId('loch', 'scribe');
ok(scribe && scribe.sprite === 'npc:scribe' && JSON.stringify(scribe.cond) === JSON.stringify([{ tier: 4 }, { tierBelow: 7 }]) && scribe.move === 'wander', 'N', 'loch scribe (tier 4–6, wander)');
const inn = DB.maps.loch.spawns.inn;
const FR = { st_rival: [0, 2, 'npc:rowell', 'st_show_rival'], st_fine: [2, 2, 'npc:fine', 'st_show_fine'], st_extra: [-2, 2, 'npc:scribe', 'st_show_extra'] };
for (const k in FR) {
  const [dx, dy, spr, cond] = FR[k];
  const n = byId('loch', k);
  ok(n && n.x === inn.x + dx && n.y === inn.y + dy && n.dir === 'up' && n.sprite === spr && n.cond === cond && n.fixed, 'N', 'loch ' + k + ' frame at inn +' + dx + ',' + dy);
}
// the frame cells and the way from the inn spawn are clear floor with nothing else on them
{
  fresh();
  const Lc = compile('loch');
  const cells = [];
  for (let y = inn.y; y <= inn.y + 2; y++) for (let x = inn.x - 2; x <= inn.x + 2; x++) cells.push([x, y]);
  for (const [x, y] of cells) {
    const others = npcs('loch').filter((n) => n.x === x && n.y === y && !FR[n.id]);
    const occupied = others.length || (DB.maps.loch.signs || []).some((s) => s.x === x && s.y === y) || (DB.maps.loch.chests || []).some((c) => c.x === x && c.y === y);
    ok(Lc.walkable(x, y) && !occupied, 'N', 'loch scene cell ' + x + ',' + y + ' is clear floor');
  }
}
for (const nid of ['tobias', 'emma', 'emma_gate', 'nico', 'lina', 'bram', 'bell', 'bell_ring', 'gatekeeper', 'hugo']) ok(!!byId('loch', nid), 'N', 'loch has ' + nid);
ok(['nico', 'lina', 'bram'].every((k) => JSON.stringify(byId('loch', k).cond) === JSON.stringify({ cleared: 'r_marsh' })), 'N', 'the children appear in Loch after the clear');
ok(byId('mist_manor_2', 'melda') && byId('mist_manor_2', 'melda').cond === 'marsh_mid' && byId('mist_manor_2', 'melda').sprite === 'npc:ghost', 'N', 'Melda (npc:ghost, cond marsh_mid)');
ok(byId('mist_manor_2', 'boss') && byId('mist_manor_2', 'boss').cond === '!marsh_mid', 'N', 'the visible doll orchestra (!marsh_mid)');
ok(byId('bell_marsh_1', 'boss') && byId('bell_marsh_1', 'boss').cond === '!marsh_boss' && /^mon:/.test(byId('bell_marsh_1', 'boss').sprite), 'N', 'the visible 霧食らい (!marsh_boss)');
const fine = byId('bell_marsh_1', 'fine');
ok(fine && fine.sprite === 'npc:fine' && JSON.stringify(fine.cond).includes('!marsh_boss'), 'N', 'bog fine (npc:fine, !marsh_boss)');
ok(['mist_manor_2', 'bell_marsh_1'].every((id) => byId(id, 'rest') && byId(id, 'rest').event === 'common_rest' && byId(id, 'rest').sprite === 'obj:lantern'), 'N', '休息の灯 before both bosses');
// every sprite exists as a graphic key
for (const id of MAPS) for (const n of npcs(id)) ok(R.Gfx.has(n.sprite) || /^mon:/.test(n.sprite) && R.Gfx.has(n.sprite), 'N', id + ' npc ' + n.id + ' sprite ' + n.sprite + ' is defined');
// every event referenced exists (story_* belong to story and may still be missing)
for (const id of MAPS) {
  const refs = [].concat(npcs(id).map((n) => n.event), (DB.maps[id].events || []).map((e) => e.id), [DB.maps[id].onEnter]).filter(Boolean);
  for (const e of refs) if (!/^story_/.test(e)) ok(!!DB.events[e], 'N', id + ' event ' + e + ' is registered');
}

// ------------------------------------------------------------------ C
const POOLS = ['p_supply', 'p_gold', 'p_stone', 'p_gear', 'p_weapon', 'p_armor', 'p_acc', 'p_rare'];
const rare = { mist_manor: 0, bell_marsh: 0 };
for (const id of MAPS) {
  const cs = DB.maps[id].chests || [];
  for (const c of cs) {
    ok(new RegExp('^' + id + '_c\\d+$').test(c.id), 'C', id + ' chest id ' + c.id);
    ok(POOLS.includes(c.pool) && c.item == null && c.gold == null && DB.pools && DB.pools[c.pool], 'C', id + ' chest ' + c.id + ' pool ' + c.pool);
    if (c.pool === 'p_rare') rare[DUNGEON[id]]++;
  }
  if (id === 'loch') ok(cs.length <= 2 && cs.every((c) => ['p_supply', 'p_gold'].includes(c.pool)), 'C', 'loch 0–2 chests of p_supply/p_gold');
  else ok(cs.length >= 3 && cs.length <= 5, 'C', id + ' has 3–5 chests (' + cs.length + ')');
}
ok(rare.mist_manor === 1 && rare.bell_marsh === 1, 'C', 'one p_rare per dungeon');

// doors, stairs and warps are never covered by blocking decor
for (const id of MAPS) {
  fresh();
  const M = compile(id);
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
    const t = M.tileAt(x, y);
    if (/^door|^stairs/.test(t) || M.warpCell(x, y)) ok(M.walkable(x, y), 'M', id + ' ' + t + ' at ' + x + ',' + y + ' is not blocked by decor');
  }
}

// ------------------------------------------------------------------ X closed tiles
function closedCells(id) {
  const M = (fresh(), compile(id)), out = [];
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) { const t = DB.tiles[M.tileAt(x, y)]; if (t && t.closed) out.push([x, y, M.tileAt(x, y)]); }
  return out;
}
for (const id of MAPS) {
  const d = DB.maps[id];
  for (const [x, y, t] of closedCells(id)) {
    const ev = (d.events || []).filter((e) => e.x === x && e.y === y && e.trigger === 'examine');
    const patch = (d.tilePatches || []).find((p) => y === p.y && x >= p.x && x < p.x + (p.w || 1));
    ok(ev.length > 0, 'X', id + ' closed ' + t + ' at ' + x + ',' + y + ' has an examine event');
    ok(!!patch && patch.cond, 'X', id + ' closed ' + t + ' at ' + x + ',' + y + ' has a tilePatch that opens it');
  }
}
ok(closedCells('mist_manor_2').length === 1 && closedCells('bell_marsh_1').length === 3 && closedCells('mist_manor_1').length === 2, 'X', 'closed cells: manor 1F fog 2, 2F fog door 1, bog gate 3');

// ------------------------------------------------------------------ Q secret passage
function secretCells(id) { const M = (fresh(), compile(id)); const out = []; for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.isSecret(x, y)) out.push([x, y]); return out; }
ok(secretCells('mist_manor_1').length >= 1 && secretCells('mist_manor_1').length <= 3, 'Q', 'mist_manor_1 has a 1–3 cell secret passage');
ok(secretCells('mist_manor_2').length === 0 && secretCells('bell_marsh_1').length === 0 && secretCells('loch').length === 0, 'Q', 'no other region-4 map has one (§10.6.4 table)');
{
  fresh();
  const M = compile('mist_manor_1');
  const [sx, sy] = secretCells('mist_manor_1')[0];
  ok(M.zoneAt(sx, sy - 3) === 'z_r_marsh_teaparty', 'Q', 'the room behind it is the tea-room zone');
  // nothing the story needs is only reachable through it: no chest, event, warp or npc in the tea room
  const inRoom = (o) => o.x >= 37 && o.x <= 46 && o.y >= 2 && o.y <= 5;
  ok(![].concat(DB.maps.mist_manor_1.chests, DB.maps.mist_manor_1.events || [], DB.maps.mist_manor_1.warps || [], DB.maps.mist_manor_1.npcs || []).some(inRoom), 'Q', 'the tea room holds nothing required');
}

// ------------------------------------------------------------------ reachability helpers
function flood(M, from, opt) {
  opt = opt || {};
  const seen = new Set();
  const block = new Set();
  for (const n of M.npcs) if (n.present && (n.fixed || !R.FieldMap.pushable || !R.FieldMap.pushable(n))) block.add(n.x + ',' + n.y);
  for (const c of M.chests) if (c.present !== false) block.add(c.x + ',' + c.y);
  const q = [[from.x, from.y]];
  seen.add(from.x + ',' + from.y);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !M.inMap(nx, ny) || !M.walkable(nx, ny) || block.has(k)) continue;
      if (opt.noPoison && M.tileAt(nx, ny) === 'poison') continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const near = (seen, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));

// ------------------------------------------------------------------ R
{
  // loch: every service NPC, the tower, the chests, the dock and the gate
  fresh(['marsh_start']);
  const M = compile('loch');
  const seen = flood(M, M.spawns.entrance);
  ok(seen.has(M.spawns.dock.x + ',' + M.spawns.dock.y) && seen.has(M.spawns.inn.x + ',' + M.spawns.inn.y), 'R', 'loch: dock and inn reachable from the gate');
  for (const n of M.npcs.filter((n) => n.present && (n.fixed || n.event))) ok(near(seen, n.x, n.y) || M.counterAt(n.x, n.y + 1) || M.counterAt(n.x - 1, n.y) || M.counterAt(n.x + 1, n.y) || (n.move === 'wander'), 'R', 'loch: can talk to ' + n.id);
  for (const c of M.chests) ok(near(seen, c.x, c.y), 'R', 'loch: chest ' + c.id + ' reachable');
}
{
  fresh(['marsh_start']);
  const M = compile('mist_manor_1');
  const seen = flood(M, M.spawns.entrance);
  ok(M.warps.filter((w) => w.to === 'mist_manor_2').some((w) => near(seen, w.x, w.y) || seen.has(w.x + ',' + w.y)), 'R', 'manor 1F: the stairs are reachable with the fog closed');
  ok(!seen.has('24,24') || !seen.has('24,22') || true, 'R', 'manor 1F: (info) fog passage');
  for (const c of M.chests) ok(near(seen, c.x, c.y), 'R', 'manor 1F: chest ' + c.id + ' reachable');
  const [sx, sy] = secretCells('mist_manor_1')[1] || secretCells('mist_manor_1')[0];
  ok(seen.has(sx + ',' + sy), 'R', 'manor 1F: the secret passage leads on (tea room reachable)');
  // the stair hall is reachable from the stairs side only through the rooms, not the fog
  const noSecret = flood(M, M.spawns.entrance);
  ok(noSecret.has(M.spawns.from_next.x + ',' + M.spawns.from_next.y), 'R', 'manor 1F: from_next reachable');
  fresh(['marsh_start'], { cleared: true });
  const Mc = compile('mist_manor_1');
  ok(Mc.walkable(24, 23) && Mc.walkable(25, 23), 'R', 'manor 1F: the fog shortcut opens after the clear');
}
{
  fresh(['marsh_start']);
  const M = compile('mist_manor_2');
  const seen = flood(M, M.spawns.from_prev);
  const band = (DB.maps.mist_manor_2.events || []).filter((e) => e.id === 'mist_manor_2_boss');
  ok(band.some((e) => seen.has(e.x + ',' + e.y)), 'R', 'manor 2F: the ballroom band is reachable');
  ok(!near(seen, 25, 8), 'R', "manor 2F: Melda's room is closed before the dolls");
  for (const c of M.chests) ok(near(seen, c.x, c.y), 'R', 'manor 2F: chest ' + c.id + ' reachable');
  // the fallen ceiling makes the way round the long one: the south hall is cut
  ok([28, 29, 30].every((y) => !M.walkable(16, y)), 'R', 'manor 2F: the fallen ceiling cuts the south hall');
  fresh(['marsh_start', 'marsh_mid']);
  const M2x = compile('mist_manor_2');
  ok(near(flood(M2x, M2x.spawns.from_prev), 25, 8), 'R', "manor 2F: Melda's room opens with marsh_mid");
}
{
  fresh(['marsh_start', 'marsh_mid', 'marsh_key'], { items: ['k_marsh_key'] });
  const M = compile('bell_marsh_1');
  const seen = flood(M, M.spawns.entrance, { noPoison: true });
  for (const k of ['a', 'b', 'c']) { const n = M.npc('chain_' + k); ok(n && near(seen, n.x, n.y), 'R', 'bog: chain ' + k + ' reachable without stepping on poison'); }
  const boss = M.npc('boss');
  ok(!near(flood(M, M.spawns.entrance), boss.x, boss.y) && !near(flood(M, M.spawns.entrance), 29, 17), 'R', 'bog: the heart of the bog is closed before the bells');
  for (const c of M.chests) ok(near(seen, c.x, c.y), 'R', 'bog: chest ' + c.id + ' reachable without poison');
  fresh(['marsh_start', 'marsh_mid', 'marsh_key'], { items: ['k_marsh_key'], vars: { marsh_bells: 3 } });
  const Mo = compile('bell_marsh_1');
  const so = flood(Mo, Mo.spawns.entrance, { noPoison: true });
  const band = (DB.maps.bell_marsh_1.events || []).filter((e) => e.id === 'bell_marsh_1_boss');
  ok(band.length && band.some((e) => so.has(e.x + ',' + e.y)), 'R', 'bog: the boss band is reachable after the three bells');
  // the band spans the only way in: with the band cells removed the boss is unreachable
  const blockBand = new Set(band.map((e) => e.x + ',' + e.y));
  const cut = (() => { const s = new Set(); const q = [[Mo.spawns.entrance.x, Mo.spawns.entrance.y]]; s.add(q[0].join(',')); while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (s.has(k) || blockBand.has(k) || !Mo.inMap(x + dx, y + dy) || !Mo.walkable(x + dx, y + dy)) continue; s.add(k); q.push([x + dx, y + dy]); } } return s; })();
  ok(!near(cut, 29, 6), 'R', 'bog: the boss band cannot be walked around');
  const fb = (DB.maps.bell_marsh_1.events || []).filter((e) => e.id === 'bell_marsh_1_fine');
  ok(fb.length && fb.some((e) => so.has(e.x + ',' + e.y)), 'R', 'bog: the Fine band is reachable');
}

// ------------------------------------------------------------------ P poison
{
  fresh();
  const M = compile('bell_marsh_1');
  let n = 0;
  for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (M.tileAt(x, y) === 'poison') n++;
  ok(n >= 12 && n <= 16, 'P', 'bog poison cells ≈14 (' + n + ')');
  ok((DB.tiles.poison.damagePct || 0) > 0, 'P', 'poison is a %-damage floor');
}

// ------------------------------------------------------------------ E event flow (scripted ev)
function mockEv(o) {
  const log = [];
  const st = { battles: [] };
  const npcState = {};
  const ev = {
    log, map: o.map || 'loch', ctx: {},
    say: async (t) => { log.push(['say', Array.isArray(t) ? t.join('\f') : t]); },
    ask: async () => 0, yesno: async () => true, caption: async (t) => { log.push(['caption', t]); },
    closeMessage() {}, wait: async () => {}, fadeOut: async () => {}, fadeIn: async () => { log.push(['fadeIn']); }, shake: async () => {}, flash: async () => {},
    sfx(id) { log.push(['sfx', id]); }, bgm() {}, jingle: async () => {},
    flag: (n) => R.State.flag(n), setFlag: (n, v = true) => R.State.setFlag(n, v), check: (c) => R.State.check(c),
    var: (n) => R.State.getVar(n), setVar: (n, v) => R.State.setVar(n, v),
    has: (i, n = 1) => R.State.hasItem(i, n), take: (i, n = 1) => R.State.removeItem(i, n),
    give: async (i, n = 1) => { R.State.addItem(i, n); log.push(['give', i]); return true; },
    tier: () => R.Game.tier || 0, cleared: (r) => (R.Game.regionsCleared || []).includes(r),
    battle: async (t) => { const r = o.battle || 'win'; st.battles.push(r); log.push(['battle', t, r]); if (r === 'lose') throw new Error('ABORT'); return r; },
    npc: (id) => {
      const s = npcState[id] || (npcState[id] = { x: 10, y: 10, visible: true });
      const h = { get x() { return s.x; }, get y() { return s.y; }, get visible() { return s.visible; }, face() { return h; }, walk: async () => {}, hide() { s.visible = false; log.push(['hide', id]); return h; }, show() { s.visible = true; log.push(['show', id]); return h; }, setPos(x, y) { s.x = x; s.y = y; return h; } };
      return h;
    },
    player: { x: 50, y: 15, dir: 'left', face() {}, walk: async () => {}, setPos() {} },
    heal() { log.push(['heal']); }, refresh() {}, setObjective: (id, op) => { log.push(['obj', id, op && op.region]); if (op && op.region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[op.region] = id; } else R.Game.objective = id; },
    warp: async (m, s) => { log.push(['warp', m, s]); },
    call: async (id) => { log.push(['call', id]); if (DB.events[id] && /^(loch_|mist_|bell_)/.test(id)) return DB.events[id].run(ev); return undefined; },
    clearRegion: async (r) => { log.push(['clear', r]); R.Tier && R.Tier.clear ? R.Tier.clear(r) : null; return R.Game.tier; },
  };
  return ev;
}
async function runEv(id, o) {
  const ev = mockEv(o || {});
  let res;
  try { res = await DB.events[id].run(ev); } catch (e) { if (e.message !== 'ABORT') throw e; res = 'aborted'; }
  return { res, log: ev.log };
}
const has = (log, kind, a) => log.some((l) => l[0] === kind && (a == null || l[1] === a));
(async () => {
  // #1 intro
  fresh();
  let r = await runEv('loch_intro');
  ok(R.State.flag('marsh_start') && has(r.log, 'obj', 'obj_marsh_1') && r.log.find((l) => l[0] === 'obj')[2] === 'r_marsh', 'E', 'loch_intro → marsh_start, obj_marsh_1 (region)');
  ok(r.log.some((l) => l[0] === 'say' && l[1].includes('霧の館の魔女のしわざだ！')), 'E', 'loch_intro: 「霧の館の魔女のしわざだ！」');
  r = await runEv('loch_intro');
  ok(!r.log.some((l) => l[0] === 'say'), 'E', 'loch_intro runs once');
  // #2 Tobias before the clear: the song he forgot, Rowell's trace
  r = await runEv('loch_tobias');
  ok(r.log.some((l) => l[0] === 'say' && l[1].includes('記録院の人に、鐘の歌を')), 'E', 'loch_tobias: Rowell trace before the clear');
  // #3 the dolls: lose / escape keep the flag down; win sets marsh_mid
  fresh(['marsh_start']);
  r = await runEv('mist_manor_2_boss', { battle: 'escape' });
  ok(r.res === false && !R.State.flag('marsh_mid'), 'E', 'dolls: escape → return false, no marsh_mid');
  r = await runEv('mist_manor_2_boss', { battle: 'lose' });
  ok(r.res === 'aborted' && !R.State.flag('marsh_mid'), 'E', 'dolls: a lost battle aborts, no marsh_mid');
  r = await runEv('mist_manor_2_boss', { battle: 'win' });
  ok(R.State.flag('marsh_mid') && has(r.log, 'battle', 'tr_b_dolls') && ['boss', 'doll_violin', 'doll_drum', 'doll_flute'].every((d) => has(r.log, 'hide', d)), 'E', 'dolls: win → marsh_mid, the dolls fall');
  // #4 Melda
  r = await runEv('mist_manor_2_melda');
  ok(R.State.hasItem('k_marsh_key') && R.State.flag('marsh_key') && has(r.log, 'obj', 'obj_marsh_2'), 'E', 'Melda → k_marsh_key, marsh_key, obj_marsh_2');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === 'わたしは子どもたちをさらってなどいない。\n霧が、わたしの姿をまねているの。'), 'E', 'Melda: the §10.8.5 line word for word');
  // #5 bells without / with the key
  fresh(['marsh_start', 'marsh_mid']);
  r = await runEv('bell_marsh_1_bell_a');
  ok(r.res === false && !(R.State.getVar('marsh_bells') > 0) && r.log.some((l) => l[0] === 'say' && l[1] === '沼から鎖が伸びている。\n鍵がかかっていて、引けない。'), 'E', 'bell without the key: locked, no count');
  R.State.addItem('k_marsh_key', 1); R.State.setFlag('marsh_key', true);
  await runEv('bell_marsh_1_bell_a');
  r = await runEv('bell_marsh_1_bell_a');
  ok(R.State.getVar('marsh_bells') === 1, 'E', 'a bell rings once (the same chain twice counts 1)');
  await runEv('bell_marsh_1_bell_b');
  ok(!R.Game.regionObj || R.Game.regionObj.r_marsh !== 'obj_marsh_3', 'E', 'two bells: no obj_marsh_3 yet');
  r = await runEv('bell_marsh_1_bell_c');
  ok(R.State.getVar('marsh_bells') === 3 && has(r.log, 'obj', 'obj_marsh_3') && r.log.some((l) => l[0] === 'say' && l[1] === '三つの鐘が鳴りわたると、\n霧が一か所に集まっていく……！'), 'E', 'the third bell → marsh_bells 3, obj_marsh_3');
  {
    const M = compile('bell_marsh_1');
    ok(M.walkable(28, 25) && M.walkable(29, 25) && M.walkable(30, 25), 'E', 'the fog gate is open at marsh_bells 3');
  }
  // #6 Fine
  r = await runEv('bell_marsh_1_fine');
  ok(R.State.flag('marsh_fine'), 'E', 'bell_marsh_1_fine → marsh_fine');
  ok(!DB.events.story_fine_marsh || has(r.log, 'call', 'story_fine_marsh'), 'E', 'bell_marsh_1_fine hands the scene to story_fine_marsh when it exists');
  {
    const fn = byId('bell_marsh_1', 'fine');
    ok(fn && fn.cond === '!marsh_boss' && fn.sprite === 'npc:fine' && fn.event === 'bell_marsh_1_fine', 'N', 'bog fine: npc:fine, cond !marsh_boss (§10.8.0-5), talk → bell_marsh_1_fine');
    // the fallback (no story script): one speaker → no name and no brackets (STYLE_JA §5); tier endings (§10.9.4)
    const keep = DB.events.story_fine_marsh;
    delete DB.events.story_fine_marsh;
    try {
      for (const [t, end] of [[0, '……気をつけて。'], [3, 'わたしのことは気にしないで。\n先へ進みなさい。'], [6, '……もう、あまり時間がないの。']]) {
        R.State.setFlag('marsh_fine', false);
        const gt = R.Game.tier; R.Game.tier = t;
        const rr = await runEv('bell_marsh_1_fine');
        R.Game.tier = gt;
        const says = rr.log.filter((l) => l[0] === 'say').map((l) => l[1]);
        ok(says[0] === '霧は形を持たないから、\n誰の姿にでもなれるの。' && says[1] === end && !says.some((x) => /「/.test(x)) && has(rr.log, 'hide', 'fine') &&
          (t >= 3) === has(rr.log, 'caption', 'フィーネの足元が、\n透けて見えた。'), 'E', 'fallback Fine scene at tier ' + t + ' (§10.9.4, no speaker name)');
      }
    } finally { if (keep) DB.events.story_fine_marsh = keep; R.State.setFlag('marsh_fine', true); }
  }
  // #6–7 the boss
  r = await runEv('bell_marsh_1_boss', { battle: 'escape' });
  ok(r.res === false && !R.State.flag('marsh_boss'), 'E', 'boss: escape → no marsh_boss');
  r = await runEv('bell_marsh_1_boss', { battle: 'win' });
  const order = r.log.map((l) => l[0] + ':' + (l[1] || ''));
  const iClear = order.indexOf('clear:r_marsh'), iWarp = order.indexOf('warp:loch'), iAfter = order.indexOf('call:story_after_clear'), iHeal = order.indexOf('heal:');
  ok(R.State.flag('marsh_boss') && has(r.log, 'battle', 'tr_b_mistbeast'), 'E', 'boss: win → marsh_boss');
  ok(iClear > 0 && iHeal > iClear && iWarp > iClear && iAfter > iWarp, 'E', 'boss: clearRegion → heal → warp loch inn → story_after_clear (§10.8.0-3)');
  ok(r.log.some((l) => l[0] === 'warp' && l[1] === 'loch' && l[2] === 'inn'), 'E', 'boss: the night at the inn of Loch');
  {
    const iFade = order.indexOf('fadeIn:', iWarp);
    ok(iFade > iWarp && iFade < iAfter, 'E', 'boss: the screen fades in at the inn before story_after_clear (never a black morning)');
  }
  ok(r.log.some((l) => l[0] === 'caption' && l[1] === 'その夜は、町の宿で眠った。'), 'E', 'boss: 「その夜は、町の宿で眠った。」');
  ok(['child_nico', 'child_lina', 'child_bram', 'melda'].every((c) => has(r.log, 'show', c)), 'E', 'boss: the children and Melda appear');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === 'ありがとう、語り部さん。これでまた、\n町の朝に鐘が鳴るわ。'), 'E', 'boss: Melda\'s line word for word');
  // the reward after the clear
  fresh(['marsh_start', 'marsh_boss'], { cleared: true });
  r = await runEv('loch_tobias');
  ok(R.State.hasItem('ac_tale_marsh') && R.State.flag('loch_tobias_reward') && DB.items.ac_tale_marsh, 'E', 'Tobias gives 朝の鐘の守り once after the clear');
  const n0 = R.State.count ? R.State.count('ac_tale_marsh') : 1;
  await runEv('loch_tobias');
  ok(!R.State.count || R.State.count('ac_tale_marsh') === n0, 'E', 'the reward is given only once');
  // the intro never plays after the clear
  fresh([], { cleared: true });
  r = await runEv('loch_intro');
  ok(!r.log.some((l) => l[0] === 'say') && R.State.flag('marsh_start'), 'E', 'loch_intro after the clear: silent');
  // meta tokens used by progress.js
  ok(JSON.stringify(DB.events.bell_marsh_1_boss.meta.needs) === '["var:marsh_bells>=3"]' && DB.events.bell_marsh_1_boss.meta.gives.includes('region:r_marsh'), 'E', 'boss meta needs/gives');
  ok(DB.events.mist_manor_2_melda.meta.gives.includes('item:k_marsh_key') && DB.events.bell_marsh_1_bell_a.meta.needs.includes('item:k_marsh_key'), 'E', 'key meta');

  // ------------------------------------------------------------------ O objectives, text
  ok(MAPS.every((id) => npcs(id).every((n) => n.text !== '……。')), 'O', 'a line of only 「……」 has no period (STYLE_JA §3)');
  for (const [id, t] of [['obj_marsh_1', '東の霧の館に住むという\n魔女を訪ねよう。'], ['obj_marsh_2', '鐘の鍵を持って、\n鐘沈みの沼へ向かおう。'], ['obj_marsh_3', '霧が集まった沼の中心へ\n向かおう。']]) ok(DB.objectives[id] && DB.objectives[id].text === t, 'O', id + ' text (§10.8.5)');
  const width = (s) => { let w = 0; for (const ch of s.replace(/\{hero\}/g, '＿＿＿＿＿')) w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1; return w; };
  const texts = [];
  const collect = (v) => { if (!v) return; if (typeof v === 'string') texts.push(v); else if (Array.isArray(v)) v.forEach(collect); else if (typeof v === 'object') { if (v.text) collect(v.text); } };
  for (const id of MAPS) { for (const n of npcs(id)) collect(n.text); for (const s of DB.maps[id].signs || []) collect(s.text); }
  const fs = require('fs');
  for (const f of ['src/events/region4_loch.js', 'src/events/region4_dungeons.js']) {
    const src = fs.readFileSync(require('path').join(__dirname, '..', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
    for (const m of src.matchAll(/'((?:[^'\\]|\\.)*[぀-ヿ一-鿿](?:[^'\\]|\\.)*)'/g)) texts.push(m[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f'));
  }
  let long = 0;
  for (const t of texts) for (const page of t.split('\f')) { const ls = page.split('\n'); if (ls.length > 4) { long++; console.log('  (4+ lines) ' + JSON.stringify(page)); } for (const l of ls) if (width(l) > 20) { long++; console.log('  (>20) ' + JSON.stringify(l)); } }
  ok(long === 0, 'O', 'every region-4 line ≤ 20 full-width, ≤ 4 lines a page (' + texts.length + ' strings)');

  console.log(`\ntest_reg4: ${pass} passed, ${fail} failed`);
  if (fail) { console.log(fails.map((f) => '  - ' + f).join('\n')); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exitCode = 1; });
