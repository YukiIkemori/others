#!/usr/bin/env node
// check_oblivion.js (owner OB) — conformance of 忘却の底 oblivion_1..5 with DESIGN §10.12 / §10.6.2 / §10.6.4 /
// §8.12.4 / §10.13.5, plus an isolated reachability BFS over the five floors (the whole-game progress.js needs
// every region; this one starts at the foot of archive_1's post-game stairs with game_clear set).
//
//   node tools/check_oblivion.js            all checks, exit 1 on any failure
//   node tools/check_oblivion.js --verbose  also print the BFS numbers per floor
//
// Checks
//   O1  floor keys: type dungeon · theme oblivion · bgm postgame · bbg oblivion · location archive · region postgame ·
//       escape world/archive_1 · chestTier 9 · outside is a wall · size ≥ 34×30
//   O2  zones and levels: 1–2F z_postgame_oblivion_lo, 3–5F z_postgame_oblivion_hi; lvOff 2 on 2F/4F, none on
//       1F and the boss floors 3F/5F; the 4F den zone = hi's groups with the rare monster ×3
//   O3  stairs chain: archive_1 ⇄ 1F ⇄ 2F ⇄ 3F ⇄ 4F ⇄ 5F, every warp's spawn exists, spawns stand on floor
//   O4  chests: 3–5 per floor, exactly one p_rare per floor, ids <map>_c<n>, known pools, the §8.12.4 mix
//   O5  休息の灯: on 2F and 4F (奥), and on the boss floors reachable before the boss band (§10.6.2-5)
//   O6  bosses: 3F tr_b_valzard_echo / 5F tr_b_ouroboros exist with tier 9; the visible boss NPC (fixed) and
//       the step band lead to the events; the events exist and declare pg_echo / pg_ouroboros + pg_clear
//   O7  secret passages (§10.6.4): exactly oblivion_2 and oblivion_4, 1–3 cells each; behind 2F only the p_rare,
//       behind 4F only the den (its zone and its chest); nothing a story needs lies behind them
//   O8  reachability: from oblivion_1 from_prev every floor, chest, sign and 休息の灯 is reached, pg_echo opens
//       the 3F seal, pg_clear is given on 5F; 4F's loop is solvable without stepping on a loop tile, and every
//       loop tile sends the party back to the first room
'use strict';
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps');
const Cond = require('./lib/cond');

const VERBOSE = process.argv.includes('--verbose');
const DB = R.DB;
const K = R.Oblivion || {};
const FLOORS = ['oblivion_1', 'oblivion_2', 'oblivion_3', 'oblivion_4', 'oblivion_5'];
let fails = 0, passes = 0;
const out = [];
function ok(tag, cond, msg) {
  if (cond) passes++;
  else { fails++; out.push(`FAIL ${tag} ${msg}`); }
  return !!cond;
}
const info = (s) => { if (VERBOSE) out.push('     ' + s); };

const P = {};
for (const id of FLOORS) P[id] = M.parseMap(R, id);
for (const id of FLOORS) ok('O1', P[id], `map ${id} is not registered`);
if (fails) { console.log(out.join('\n')); process.exit(1); }

const tileDef = (id) => DB.tiles[id] || {};
const isWallTile = (id) => id === 'wall' || id === 'wall_torch' || id === 'void';

// ---------------------------------------------------------------- O1 floor keys
for (const id of FLOORS) {
  const d = P[id].def, p = P[id];
  ok('O1', d.type === 'dungeon', `${id}: type ${d.type}`);
  ok('O1', d.theme === 'oblivion', `${id}: theme ${d.theme}`);
  ok('O1', d.bgm === 'postgame', `${id}: bgm ${d.bgm}`);
  ok('O1', d.bbg === 'oblivion' || (DB.themes.oblivion && DB.themes.oblivion.bbg === 'oblivion'), `${id}: battle backdrop`);
  ok('O1', d.location === 'archive', `${id}: location ${d.location} (§10.6.3: archive)`);
  ok('O1', d.region === 'postgame', `${id}: region ${d.region}`);
  ok('O1', d.escape && d.escape.to === 'world' && d.escape.spawn === 'archive_1', `${id}: escape ${JSON.stringify(d.escape)}`);
  ok('O1', d.chestTier === 9, `${id}: chestTier ${d.chestTier}`);
  ok('O1', isWallTile(p.outside), `${id}: outside '${p.outside}' is not a wall`);
  ok('O1', p.w >= 34 && p.h >= 30, `${id}: ${p.w}×${p.h} below 34×30`);
  ok('O1', !p.issues.length, `${id}: compile issues: ${p.issues.join(' | ')}`);
}

// ---------------------------------------------------------------- O2 zones & levels
const ZONE = { oblivion_1: 'z_postgame_oblivion_lo', oblivion_2: 'z_postgame_oblivion_lo', oblivion_3: 'z_postgame_oblivion_hi', oblivion_4: 'z_postgame_oblivion_hi', oblivion_5: 'z_postgame_oblivion_hi' };
const LVOFF = { oblivion_1: undefined, oblivion_2: 2, oblivion_3: undefined, oblivion_4: 2, oblivion_5: undefined };
for (const id of FLOORS) {
  const p = P[id], fm = p.fm;
  const zones = new Map();
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (!tileDef(p.tileAt(x, y)).pass) continue;
    const z = fm.zoneAt(x, y);
    zones.set(z, (zones.get(z) || 0) + 1);
  }
  const main = [...zones.entries()].sort((a, b) => b[1] - a[1])[0];
  ok('O2', main && main[0] === ZONE[id], `${id}: main zone ${main && main[0]} (want ${ZONE[id]})`);
  for (const z of zones.keys()) ok('O2', z == null || z === ZONE[id] || (id === 'oblivion_4' && z === K.ZONE_DEN), `${id}: unexpected zone ${z}`);
  for (const z of zones.keys()) if (z) ok('O2', !!DB.encounters[z], `${id}: zone ${z} not registered`);
  ok('O2', p.def.lvOff === LVOFF[id], `${id}: lvOff ${p.def.lvOff} (want ${LVOFF[id]})`);
  info(`${id}: zones ${[...zones.entries()].map(([z, n]) => `${z || '(none)'}×${n}`).join(' ')}`);
}
{
  const hi = DB.encounters.z_postgame_oblivion_hi, den = DB.encounters[K.ZONE_DEN];
  ok('O2', den && JSON.stringify(den.groups) === JSON.stringify(hi.groups) && den.tier === hi.tier && den.lvOff === hi.lvOff, 'den zone is not a copy of z_postgame_oblivion_hi');
  const rh = DB.rareEncounters.z_postgame_oblivion_hi, rd = DB.rareEncounters[K.ZONE_DEN];
  ok('O2', rd && rd.mon === rh.mon && Math.abs(rh.rate / rd.rate - 3) < 0.1, `den rare ${JSON.stringify(rd)} vs hi ${JSON.stringify(rh)} (want ×3)`);
  ok('O2', DB.rareEncounters.z_postgame_oblivion_lo && DB.rareEncounters.z_postgame_oblivion_lo.mon === 'rm_memory_fish', 'lo zone rare monster rm_memory_fish (§9.10)');
  ok('O2', rh && rh.mon === 'rm_dream_tapir', 'hi zone rare monster rm_dream_tapir (§9.10)');
  // 5F: no random battles inside the circle, the hi zone on the ring
  ok('O2', P.oblivion_5.fm.zoneAt(20, 20) == null && P.oblivion_5.fm.zoneAt(20, 5) === 'z_postgame_oblivion_hi', '5F: the dragon\'s bed must be free of random battles, the ring in the hi zone');
}

// ---------------------------------------------------------------- O3 stairs chain
const spawnOf = (map, name) => { const q = map === 'archive_1' ? M.parseMap(R, 'archive_1') : P[map]; return q && q.spawns[name]; };
const warpTo = (id, to) => P[id].warps.filter((w) => w.to === to);
const CHAIN = [['archive_1', 'oblivion_1'], ['oblivion_1', 'oblivion_2'], ['oblivion_2', 'oblivion_3'], ['oblivion_3', 'oblivion_4'], ['oblivion_4', 'oblivion_5']];
for (const [a, b] of CHAIN) {
  if (a !== 'archive_1') {
    const down = warpTo(a, b);
    ok('O3', down.length === 1 && down[0].spawn === 'from_prev', `${a} → ${b}: ${JSON.stringify(down)}`);
    ok('O3', down[0] && P[a].tileAt(down[0].x, down[0].y) === 'stairs_down', `${a}: the way down is not on stairs_down`);
    ok('O3', !!spawnOf(a, 'from_next'), `${a}: no spawn from_next`);
  } else {
    const A = M.parseMap(R, 'archive_1');
    if (A) ok('O3', A.warps.some((w) => w.to === 'oblivion_1' && w.spawn === 'from_prev'), 'archive_1 has no warp to oblivion_1 from_prev (story A19)');
    else info('archive_1 not registered yet (story A19): the archive side of the stairs is not checked');
  }
  const up = warpTo(b, a);
  ok('O3', up.length === 1, `${b} → ${a}: ${up.length} warps`);
  if (up[0]) {
    ok('O3', P[b].tileAt(up[0].x, up[0].y) === 'stairs_up', `${b}: the way up is not on stairs_up`);
    const want = a === 'archive_1' ? null : 'from_next';
    if (want) ok('O3', up[0].spawn === want, `${b} → ${a} spawn ${up[0].spawn}`);
    if (a === 'archive_1' && M.parseMap(R, 'archive_1')) ok('O3', !!spawnOf('archive_1', up[0].spawn), `archive_1 has no spawn ${up[0].spawn}`);
  }
  ok('O3', !!spawnOf(b, 'from_prev'), `${b}: no spawn from_prev`);
}
ok('O3', !!P.oblivion_1.spawns.entrance, 'oblivion_1: no spawn entrance (§10.6.2-1)');
for (const id of FLOORS) for (const [n, s] of Object.entries(P[id].spawns)) ok('O3', tileDef(P[id].tileAt(s.x, s.y)).pass, `${id}: spawn ${n} stands on ${P[id].tileAt(s.x, s.y)}`);

// ---------------------------------------------------------------- O4 chests
const mix = {};
let nonRare = 0;
for (const id of FLOORS) {
  const ch = P[id].def.chests || [];
  ok('O4', ch.length >= 3 && ch.length <= 5, `${id}: ${ch.length} chests (3–5, §8.12.4)`);
  ok('O4', ch.filter((c) => c.pool === 'p_rare').length === 1, `${id}: ${ch.filter((c) => c.pool === 'p_rare').length} p_rare (one per floor)`);
  for (const c of ch) {
    ok('O4', new RegExp(`^${id}_c\\d+$`).test(c.id), `${id}: chest id ${c.id}`);
    ok('O4', !!DB.pools[c.pool], `${id}: pool ${c.pool} unknown`);
    ok('O4', !c.item && c.gold == null, `${id}: chest ${c.id} has fixed contents`);
    if (c.pool !== 'p_rare') { mix[c.pool] = (mix[c.pool] || 0) + 1; nonRare++; }
  }
}
{
  const f = (k) => (mix[k] || 0) / nonRare;
  const gear = f('p_gear') + f('p_weapon') + f('p_armor') + f('p_acc');
  ok('O4', Math.abs(f('p_supply') - 0.5) <= 0.1 && Math.abs(gear - 0.2) <= 0.1 && Math.abs(f('p_gold') - 0.2) <= 0.1 && Math.abs(f('p_stone') - 0.1) <= 0.1,
    `chest mix ${JSON.stringify(mix)} is off §8.12.4 (5:2:2:1)`);
  info(`chest mix (non-rare ${nonRare}): ${Object.entries(mix).map(([k, n]) => `${k} ${n}`).join(', ')} + p_rare 5`);
}

// ---------------------------------------------------------------- BFS model
const S0 = { flags: new Set(['game_clear']), vars: {} };
const condS = (S) => Cond.fromSets({ flags: [...S.flags], items: [], vars: S.vars, cleared: [], tier: 8, members: [], recruited: [], postgame: true });
function blocked(p, S, x, y, opts) {
  if (!p.inMap(x, y)) return true;
  const t = p.patchedAt ? p.patchedAt(x, y, (c) => Cond.check(c, condS(S))) : p.tileAt(x, y);
  if (M.isSecret(R, t) && opts && opts.noSecret) return true;
  if (!tileDef(t).pass) return true;
  const dd = p.decorDef && p.decorDef(x, y);
  if (dd && !dd.pass) return true;
  if (p.chests.some((c) => c.x === x && c.y === y)) return true;
  if (p.npcs.some((n) => n.x === x && n.y === y && Cond.check(n.cond, condS(S)))) return true;
  return false;
}
/** flood one floor from a cell; step events whose cond holds are recorded (and, if noEvents, not entered) */
function flood(id, S, start, opts) {
  opts = opts || {};
  const p = P[id], seen = new Set(), q = [start], evs = [], warps = [];
  const key = (x, y) => x + ',' + y;
  const stepEvents = (x, y) => p.events.filter((e) => e.x === x && e.y === y && (e.trigger || 'step') === 'step' && Cond.check(e.cond, condS(S)));
  seen.add(key(start.x, start.y));
  while (q.length) {
    const c = q.shift();
    const w = p.warps.find((w0) => w0.x === c.x && w0.y === c.y);
    if (w && !(c.x === start.x && c.y === start.y)) { warps.push(w); continue; }
    const se = stepEvents(c.x, c.y);
    if (se.length && !(c.x === start.x && c.y === start.y)) {
      evs.push(...se.map((e) => ({ e, x: c.x, y: c.y })));
      if (opts.noEvents || se.some((e) => DB.events[e.id] && DB.events[e.id].meta && DB.events[e.id].meta.warp)) continue;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny);
      if (seen.has(k) || blocked(p, S, nx, ny, opts)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return { seen, evs, warps, has: (x, y) => seen.has(key(x, y)), near: (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(x + dx, y + dy))) };
}

// ---------------------------------------------------------------- O8 reachability (whole dungeon, fixpoint)
const S = { flags: new Set(S0.flags), vars: {} };
const reached = new Set(), cellsBy = {};
for (let round = 0; round < 10; round++) {
  const before = S.flags.size;
  reached.clear();
  const todo = [['oblivion_1', 'from_prev']], done = new Set();
  while (todo.length) {
    const [m, sp] = todo.shift();
    if (!P[m] || done.has(m + ':' + sp)) continue;
    done.add(m + ':' + sp);
    reached.add(m);
    const s = P[m].spawns[sp];
    const f = flood(m, S, { x: s.x, y: s.y });
    cellsBy[m] = cellsBy[m] ? new Set([...cellsBy[m], ...f.seen]) : f.seen;
    for (const w of f.warps) if (P[w.to]) todo.push([w.to, w.spawn]);
    for (const { e } of f.evs) {
      const meta = (DB.events[e.id] || {}).meta || {};
      for (const g of meta.gives || []) if (g.startsWith('flag:')) S.flags.add(g.slice(5));
      if (meta.warp && P[meta.warp.to]) todo.push([meta.warp.to, meta.warp.spawn]);
    }
    // talking to NPCs (the bosses can also be spoken to)
    for (const n of P[m].npcs) {
      if (!n.event || !Cond.check(n.cond, condS(S))) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => f.seen.has((n.x + dx) + ',' + (n.y + dy)))) continue;
      const meta = (DB.events[n.event] || {}).meta || {};
      for (const g of meta.gives || []) if (g.startsWith('flag:')) S.flags.add(g.slice(5));
    }
  }
  if (S.flags.size === before && round > 0) break;
}
for (const id of FLOORS) ok('O8', reached.has(id), `${id} is never reached`);
ok('O8', S.flags.has('pg_echo'), 'pg_echo is never given');
ok('O8', S.flags.has('pg_ouroboros') && S.flags.has('pg_clear'), 'pg_ouroboros / pg_clear are never given');
const near = (m, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cellsBy[m] && cellsBy[m].has((x + dx) + ',' + (y + dy)));
for (const id of FLOORS) {
  for (const c of P[id].chests) ok('O8', near(id, c.x, c.y), `${id}: chest ${c.id} unreachable`);
  for (const s of P[id].signs) ok('O8', near(id, s.x, s.y) || (cellsBy[id] && cellsBy[id].has(s.x + ',' + s.y)), `${id}: sign @${s.x},${s.y} unreachable`);
  for (const n of P[id].npcs) ok('O8', near(id, n.x, n.y), `${id}: npc ${n.id} unreachable`);
  info(`${id}: ${cellsBy[id] ? cellsBy[id].size : 0} cells reached`);
}
// the 3F seal opens with pg_echo only
{
  const p = P.oblivion_3;
  const t0 = p.patchedAt(31, 4, (c) => Cond.check(c, condS(S0)));
  const t1 = p.patchedAt(31, 4, (c) => Cond.check(c, condS({ flags: new Set(['game_clear', 'pg_echo']), vars: {} })));
  ok('O8', !tileDef(t0).pass && tileDef(t1).pass, `3F seal: before ${t0}, after pg_echo ${t1}`);
  const f = flood('oblivion_3', S0, P.oblivion_3.spawns.from_prev, { noEvents: true });
  const down = P.oblivion_3.warps.find((w) => w.to === 'oblivion_4');
  ok('O8', !f.has(down.x, down.y), '3F: the way down is open before 魔王の残影 is beaten');
}
// 4F: the loop is solvable; every loop tile returns to room 1
{
  const p = P.oblivion_4, loops = p.events.filter((e) => e.id === 'oblivion_4_loop');
  ok('O8', loops.length === 3, `4F: ${loops.length} loop tiles (one wrong exit per room)`);
  const f = flood('oblivion_4', S0, p.spawns.from_prev, { noEvents: true });
  const down = p.warps.find((w) => w.to === 'oblivion_5');
  ok('O8', f.has(down.x, down.y) || f.warps.includes(down), '4F: the stairs down cannot be reached without a loop tile');
  const meta = DB.events.oblivion_4_loop && DB.events.oblivion_4_loop.meta;
  ok('O8', meta && meta.warp && meta.warp.to === 'oblivion_4' && p.spawns[meta.warp.spawn], '4F: the loop event must warp to a spawn on 4F');
  // the spawn `loop` is in room 1, and room 1 → loop tiles are all reachable (the trap is on the path)
  const fl = flood('oblivion_4', S0, p.spawns.loop, {});
  for (const e of loops) ok('O8', fl.evs.some((x) => x.x === e.x && x.y === e.y) || f.evs.some((x) => x.x === e.x && x.y === e.y), `4F: loop tile @${e.x},${e.y} is never stepped on`);
}

// ---------------------------------------------------------------- O5 休息の灯
for (const id of FLOORS) {
  const rests = P[id].npcs.filter((n) => n.id === 'rest');
  const want = id === 'oblivion_1' ? 0 : 1;
  ok('O5', rests.length === want, `${id}: ${rests.length} 休息の灯 (want ${want})`);
  for (const r0 of rests) {
    ok('O5', r0.event === 'common_rest' && r0.sprite === 'obj:lantern' && P[id].def.npcs.find((n) => n.id === 'rest').fixed === true, `${id}: rest must be obj:lantern / common_rest / fixed`);
    if (id === 'oblivion_3' || id === 'oblivion_5') {
      const f = flood(id, S0, P[id].spawns.from_prev, { noEvents: true });
      ok('O5', f.near(r0.x, r0.y), `${id}: 休息の灯 is not reachable before the boss band`);
    } else {
      // 「奥に」: nearer the way down than the way up
      const up = P[id].warps.find((w) => P[w.to] ? FLOORS.indexOf(w.to) < FLOORS.indexOf(id) : true);
      const dn = P[id].warps.find((w) => FLOORS.indexOf(w.to) > FLOORS.indexOf(id));
      const d = (a) => Math.abs(a.x - r0.x) + Math.abs(a.y - r0.y);
      ok('O5', dn && up && d(dn) < d(up), `${id}: 休息の灯 is not at the far end (奥)`);
    }
  }
}

// ---------------------------------------------------------------- O6 bosses
{
  const B = [['oblivion_3', 'tr_b_valzard_echo', 'oblivion_3_echo', ['pg_echo'], 'b_valzard_echo'],
    ['oblivion_5', 'tr_b_ouroboros', 'oblivion_5_ouroboros', ['pg_ouroboros', 'pg_clear'], 'b_ouroboros']];
  for (const [m, tr, evId, flags, mon] of B) {
    const t = DB.troops[tr];
    ok('O6', t && t.tier === 9, `${tr}: tier ${t && t.tier} (9 固定, §10.13.5)`);
    ok('O6', t && t.mons && t.mons.some((x) => x[0] === mon), `${tr}: monster ${mon}`);
    const e = DB.events[evId];
    ok('O6', e && typeof e.run === 'function', `event ${evId} missing`);
    const gives = (e && e.meta && e.meta.gives) || [];
    for (const f of flags) ok('O6', gives.includes('flag:' + f), `${evId}: meta.gives lacks flag:${f}`);
    const boss = P[m].def.npcs.find((n) => n.id === 'boss');
    ok('O6', boss && boss.fixed && boss.event === evId && /^mon:/.test(boss.sprite), `${m}: visible boss NPC`);
    ok('O6', boss && R.Gfx.has(boss.sprite), `${m}: boss sprite ${boss && boss.sprite} not registered`);
    const band = P[m].events.filter((x) => x.id === evId);
    ok('O6', band.length >= 3, `${m}: the step band before the boss has ${band.length} cells`);
    ok('O6', band.every((x) => typeof x.cond === 'string' && x.cond[0] === '!'), `${m}: the band must end when the boss is beaten`);
  }
  for (const id of FLOORS) {
    const d = P[id].def;
    ok('O6', !d.onEnter || (DB.events[d.onEnter] && DB.events[d.onEnter].meta), `${id}: onEnter ${d.onEnter} missing`);
    for (const e of P[id].events) ok('O6', DB.events[e.id] && DB.events[e.id].meta, `${id}: event ${e.id} missing or without meta`);
    for (const n of P[id].npcs) if (n.event) ok('O6', !!DB.events[n.event], `${id}: npc ${n.id} event ${n.event} missing`);
    for (const n of P[id].def.npcs || []) ok('O6', n.fixed || n.push, `${id}: npc ${n.id} without fixed/push`);
  }
}

// ---------------------------------------------------------------- O7 secret passages
{
  const secretFloors = [];
  for (const id of FLOORS) {
    const p = P[id], cells = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (M.isSecret(R, p.tileAt(x, y))) cells.push([x, y]);
    if (cells.length) secretFloors.push(id);
    if (cells.length) ok('O7', cells.length >= 1 && cells.length <= 3, `${id}: secret passage of ${cells.length} cells (1–3)`);
    const all = flood(id, S0, p.spawns.from_prev, {});
    const no = flood(id, S0, p.spawns.from_prev, { noSecret: true });
    const only = [...all.seen].filter((k) => !no.seen.has(k));
    const onlyChests = p.chests.filter((c) => all.near(c.x, c.y) && !no.near(c.x, c.y));
    if (id === 'oblivion_2') ok('O7', onlyChests.length === 1 && onlyChests[0].pool === 'p_rare', `2F: behind the secret: ${onlyChests.map((c) => c.pool).join(',') || 'nothing'} (want the p_rare)`);
    if (id === 'oblivion_4') {
      ok('O7', only.length > 10 && only.every((k) => { const [x, y] = k.split(',').map(Number); return M.isSecret(R, p.tileAt(x, y)) || p.fm.zoneAt(x, y) === K.ZONE_DEN; }), `4F: the cells behind the secret must be the den (zone ${K.ZONE_DEN})`);
      ok('O7', only.length > 0 && [...only].some((k) => { const [x, y] = k.split(',').map(Number); return p.fm.zoneAt(x, y) === K.ZONE_DEN; }), '4F: the den is not behind the secret');
    }
    // nothing the story needs lies behind a secret: no warp, no event with gives, no boss
    const behindWarp = p.warps.filter((w) => all.has(w.x, w.y) && !no.has(w.x, w.y) || (all.warps.includes(w) && !no.warps.includes(w)));
    ok('O7', !behindWarp.length, `${id}: a warp lies behind a secret passage`);
    const behindEv = p.events.filter((e) => only.includes(e.x + ',' + e.y) && ((DB.events[e.id] || {}).meta || {}).gives && DB.events[e.id].meta.gives.length);
    ok('O7', !behindEv.length, `${id}: an event with gives lies behind a secret passage`);
  }
  ok('O7', JSON.stringify(secretFloors) === JSON.stringify(['oblivion_2', 'oblivion_4']), `secret passages on ${secretFloors.join(' ')} (§10.6.4: oblivion_2 oblivion_4)`);
}

// ---------------------------------------------------------------- report
for (const l of out) console.log(l);
console.log(`check_oblivion: ${passes} passed, ${fails} failed — floors ${FLOORS.length}, chests ${FLOORS.reduce((n, id) => n + P[id].chests.length, 0)}, flags ${[...S.flags].filter((f) => /^pg_/.test(f)).join(' ')}`);
process.exit(fails ? 1 : 0);
