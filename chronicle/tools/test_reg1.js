#!/usr/bin/env node
// Region 1 ヴェルダの森 tests (owner R1; node, no DOM, exit 1 on failure). DESIGN §10.8.0, §10.8.2, §10.6.
//   static — the five maps: ids, sizes (§10.6.2 minima), outside, type/theme/bgm/bbg/zone/lvOff/escape/location/
//            region, spawns and warps (targets exist), the scene slots st_* (§10.8.0-7), folk_a/folk_b, scribe,
//            services, NPC fixed/push, chests (pool only, ids, counts per floor, one p_rare per dungeon),
//            secret passages (§10.6.4), closed tile + tilePatch + examine (§10.8.0-6), boss / rest / fine NPCs,
//            events and their meta, objectives, tier lines (before / after the clear on every town NPC)
//   reach  — BFS on the compiled maps per story state: services and story NPCs reachable; Dan blocks the
//            narrows until spoken to; the moth blocks the way north until beaten; the vines hold until the
//            third verse; the boss floor is entered only through the lantern room (fine) and the boss band;
//            what lies beyond each secret passage is reached only through it, and nothing the story needs is
//   text   — every Japanese string in region1_*.js: 20 full-width per line ({hero} = 5), 4 lines per page
//   play   — the whole region on the real field + event runtime (stand-in battles): fern (intro) → リタ →
//            迷いの森 (stone 1, Dan, stone 2, the moth — lost once, then won — stone 3, the vines) → 千年樹
//            (fine, 根食らい, エルム, clearRegion, the night at the inn, story_after_clear) → the reward;
//            flags, vars, items, objectives, tier and the map checked at every step
//   route  — walking distances of the main route (steps), for the time budget (§10.14: dungeon 60–80 min)
//
//   node tools/test_reg1.js                all sections
//   node tools/test_reg1.js static reach   only the named sections
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools/fixtures/reg1');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(FX, 'node/stubs.js')] });
console.warn = origWarn;
const DB = R.DB;
const ownLoadErrors = (R._nodeLoadErrors || []).filter((e) => /region1_/.test(e));

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
const report = [];
const measure = (k, v) => { report.push([k, v]); };

const MAPS = ['fern', 'verda_maze_1', 'verda_maze_2', 'elder_tree_1', 'elder_tree_2'];
const DUNGEON = { verda_maze_1: 'verda_maze', verda_maze_2: 'verda_maze', elder_tree_1: 'elder_tree', elder_tree_2: 'elder_tree' };
const EXTERNAL_EVENTS = /^(common_|story_)/; // world (A18a) and story (A19) scripts placed or called here
const PROLOGUE = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];

// ============================================================ helpers
const compileQuiet = (id) => { const w = R.warn; const out = []; R.warn = (...a) => out.push(a.join(' ')); try { return { m: R.FieldMap.compile(id), warns: out }; } finally { R.warn = w; } };
function withState(o, fn) {
  const g0 = R.Game;
  R.State.newGame();
  const g = R.Game;
  for (const f of PROLOGUE) g.flags[f] = true;
  for (const f of o.flags || []) g.flags[f] = true;
  for (const k in o.vars || {}) g.vars[k] = o.vars[k];
  if (o.clear) { g.regionsCleared = ['r_forest']; g.tier = 1; g.flags.cleared_r_forest = true; }
  if (o.tier) { g.regionsCleared = Object.keys(DB.regions || {}).slice(0, o.tier); g.tier = g.regionsCleared.length; }
  if (o.postgame) { g.gameClear = true; g.flags.game_clear = true; }
  try { return fn(); } finally { R.Game = g0; }
}
/** BFS over a compiled map: 4-neighbour, tile + decor walkability, non-pushable NPCs block; secret tiles optional */
function reach(m, sx, sy, o) {
  o = o || {};
  const blockNpc = new Set();
  for (const n of m.npcs) if (n.present && !R.FieldMap.pushable(n)) blockNpc.add(n.x + ',' + n.y);
  const block = new Set((o.block || []).map((c) => c[0] + ',' + c[1]));
  const pass = (x, y) => {
    if (!m.inMap(x, y)) return false;
    if (block.has(x + ',' + y)) return false;
    if (o.noSecret && m.isSecret(x, y)) return false;
    if (blockNpc.has(x + ',' + y)) return false;
    if (m.chests.some((c) => c.present && c.x === x && c.y === y)) return false;
    return m.walkable(x, y);
  };
  const dist = new Map();
  const q = [[sx, sy]];
  dist.set(sx + ',' + sy, 0);
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist.get(x + ',' + y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (dist.has(k) || !pass(nx, ny)) continue;
      dist.set(k, d + 1);
      q.push([nx, ny]);
    }
  }
  return { has: (x, y) => dist.has(x + ',' + y), d: (x, y) => dist.get(x + ',' + y), size: dist.size,
    /** some 4-neighbour of (x,y) is reached (talk / examine / open from there) */
    adj: (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => dist.has((x + dx) + ',' + (y + dy))),
    /** a counter between: reached two cells away in a straight line with a counter in the middle */
    across: (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.counterAt(x + dx, y + dy) && dist.has((x + 2 * dx) + ',' + (y + 2 * dy))),
    dAdj: (x, y) => Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => dist.get((x + dx) + ',' + (y + dy)) ?? Infinity)) };
}
const sp = (m, name) => m.spawns[name];
function compileIn(o, id) { return withState(o, () => { const { m } = compileQuiet(id); m.refresh(); return m; }); }

// ============================================================ route
// The main route is short on purpose (the maze twists and dead ends make it long to find); what fills
// the §10.14 budget (dungeon 60–80 min) is exploring. This measures a greedy sweep per floor: from the
// way in, the nearest unvisited chest / examine spot each time, then the way on (4-way steps, an upper
// bound of the 8-way walk). Random battles ≈ steps / encRate (22, §4.11.1).
function testRoute() {
  section = 'route';
  console.log('[route]');
  const st = { flags: ['forest_start', 'forest_dan', 'forest_mid', 'forest_fine'], vars: { forest_verses: 3 } };
  const FLOORS = {
    verda_maze_1: ['entrance', (m) => m.warps.filter((w) => w.to === 'verda_maze_2')],
    verda_maze_2: ['from_prev', (m) => m.warps.filter((w) => w.to === 'elder_tree_1')],
    elder_tree_1: ['entrance', (m) => m.warps.filter((w) => w.to === 'elder_tree_2')],
    elder_tree_2: ['from_prev', (m) => m.events.filter((e) => e.id === 'elder_tree_2_boss')],
  };
  let total = 0;
  for (const id in FLOORS) {
    const m = compileIn(st, id);
    const s = sp(m, FLOORS[id][0]);
    const targets = m.chests.map((c) => [c.x, c.y]).concat(m.events.filter((e) => e.trigger === 'examine').map((e) => [e.x, e.y]));
    let cur = [s.x, s.y], len = 0, lost = 0;
    const pending = targets.slice();
    while (pending.length) {
      const r = reach(m, cur[0], cur[1]);
      let bi = -1, bv = Infinity;
      pending.forEach((t, i) => { const v = r.dAdj(t[0], t[1]); if (v < bv) { bv = v; bi = i; } });
      if (bv === Infinity) { lost = pending.length; break; }
      len += bv;
      const t = pending.splice(bi, 1)[0];
      // stand on the reached neighbour
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [t[0] + dx, t[1] + dy]).find(([x, y]) => r.d(x, y) === bv);
      cur = nb || t;
    }
    const r = reach(m, cur[0], cur[1]);
    const outs = FLOORS[id][1](m);
    const out = Math.min(...outs.map((w) => (r.has(w.x, w.y) ? r.d(w.x, w.y) : r.dAdj(w.x, w.y))));
    ok(lost === 0 && out < Infinity, id + ': every chest and examine spot, then the way on, can be walked in one sweep');
    len += out;
    total += len;
    measure(id + ': sweep (all chests + spots → way on), steps / battles', len + ' / ~' + Math.round(len / 22));
    ok(len >= 120, id + ': a full sweep is at least 120 steps (' + len + ')');
  }
  measure('dungeon sweep total, steps / battles', total + ' / ~' + Math.round(total / 22));
  ok(total >= 700, 'the four floors take at least 700 steps to sweep (' + total + ')');
}

// ============================================================ static
function testStatic() {
  section = 'static';
  console.log('[static]');
  eq(ownLoadErrors, [], 'region1 files load without errors');
  for (const id of MAPS) {
    const d = DB.maps[id];
    ok(!!d, 'map ' + id + ' registered');
    if (!d) continue;
    const { m, warns } = compileQuiet(id);
    ok(!!m, id + ' compiles');
    const own = warns.filter((w) => !/unknown event (story_|common_)|story_rumor/.test(w));
    eq(own, [], id + ': no compile warnings');
    ok(d.rows.every((r) => r.length === d.rows[0].length), id + ': rows are even');
    ok(!d.decor || (d.decor.length === d.rows.length && d.decor.every((r) => r.length === d.rows[0].length)), id + ': decor matches the rows');
    eq(d.region, 'r_forest', id + ' region');
    eq(d.outside, 'T', id + ' outside is the forest (§10.6.1 / §10.6.2-10)');
    if (id === 'fern') {
      eq([d.type, d.theme, d.bgm, d.location], ['town', 'town_forest', 'village', 'fern'], 'fern type/theme/bgm/location (§10.6.1)');
      ok(m.w >= 40 && m.h >= 32, 'fern is at least 40×32 (' + m.w + '×' + m.h + ')');
      eq(d.exit, { to: 'world', spawn: 'fern' }, 'fern exit → world spawn fern');
      ok(sp(m, 'entrance') && sp(m, 'inn'), 'fern spawns entrance + inn');
      eq(d.respawnSpawn, 'inn', 'fern respawn at the inn');
      continue;
    }
    const tree = /^elder/.test(id);
    eq([d.type, d.theme, d.bbg, d.bgm, d.encounter], ['dungeon', tree ? 'tree' : 'forest', tree ? 'tree' : 'forest', 'forest', tree ? 'z_r_forest_tree' : 'z_r_forest_maze'], id + ' type/theme/bbg/bgm/zone (§10.6.2)');
    eq(d.location, 'verda_maze', id + ' location (§10.6.3: 千年樹 → verda_maze too)');
    eq(d.escape, { to: 'world', spawn: 'verda_maze_1' }, id + ' escape (§10.6.2-3)');
    ok(m.w >= 34 && m.h >= 30, id + ' is at least 34×30 (' + m.w + '×' + m.h + ')');
    eq(d.lvOff, id === 'verda_maze_2' ? 2 : undefined, id + ' lvOff (§10.6.2-9: 2F → 2, first floor and boss floor none)');
    if (/_1$/.test(id)) ok(!!sp(m, 'entrance'), id + ' has entrance');
    if (id !== 'verda_maze_1') ok(!!sp(m, 'from_prev') || id === 'elder_tree_1', id + ' has from_prev');
    if (id !== 'elder_tree_2') ok(!!sp(m, 'from_next'), id + ' has from_next');
  }
  // warps: targets and spawns exist
  for (const id of MAPS) {
    const { m } = compileQuiet(id);
    if (!m) continue;
    for (const w of m.warps) {
      if (w.to === 'world') { ok(!!(DB.maps.world && DB.maps.world.spawns && DB.maps.world.spawns[w.spawn]), id + ' warp → world spawn ' + w.spawn); continue; }
      const t = DB.maps[w.to];
      ok(!!t && !!t.spawns[w.spawn], id + ' warp (' + w.x + ',' + w.y + ') → ' + w.to + ':' + w.spawn);
    }
  }
  const wsp = (DB.maps.world && DB.maps.world.spawns) || {};
  ok(!!wsp.fern && !!wsp.verda_maze_1, 'the world has the spawns fern and verda_maze_1 (§10.5.3)');
  const wwarps = ((DB.maps.world && DB.maps.world.warps) || []);
  ok(wwarps.some((w) => w.to === 'fern' && w.spawn === 'entrance'), 'the world warps into fern:entrance');
  ok(wwarps.some((w) => w.to === 'verda_maze_1' && w.spawn === 'entrance'), 'the world warps into verda_maze_1:entrance');

  // fern contracts
  {
    const { m } = compileQuiet('fern');
    const inn = sp(m, 'inn');
    const slot = (id, dx) => m.npcs.find((n) => n.id === id);
    const want = { st_rival: [0, 'st_show_rival', 'npc:rowell'], st_fine: [2, 'st_show_fine', 'npc:fine'], st_extra: [-2, 'st_show_extra', 'npc:scribe'] };
    for (const [id, [dx, cond, spr]] of Object.entries(want)) {
      const n = slot(id);
      ok(!!n, 'fern ' + id + ' exists');
      if (!n) continue;
      eq([n.x - inn.x, n.y - inn.y, n.dir, n.cond, n.sprite, !!n.fixed], [dx, 2, 'up', cond, spr, true], 'fern ' + id + ' placement (§10.8.0-7)');
    }
    // the slots and the cells between the inn and them are open floor with nothing on them
    for (let y = inn.y; y <= inn.y + 2; y++) for (let x = inn.x - 2; x <= inn.x + 2; x++) {
      const decor = m.decorDef(x, y);
      ok(m.walkable(x, y) && !(decor && !decor.pass), 'fern scene cell ' + x + ',' + y + ' is open floor');
      ok(!m.npcs.some((n) => n.x === x && n.y === y && !/^st_/.test(n.id)), 'fern scene cell ' + x + ',' + y + ' has no other NPC');
      ok(!m.chests.some((c) => c.x === x && c.y === y), 'fern scene cell ' + x + ',' + y + ' has no chest');
    }
    const byId = (id) => m.npcs.find((n) => n.id === id);
    eq([byId('folk_a') && byId('folk_a').rumor, byId('folk_b') && byId('folk_b').rumor], ['fern_a', 'fern_b'], 'fern folk_a / folk_b rumors (§10.8.0-8)');
    ok(['folk_a', 'folk_b'].every((id) => byId(id).event === 'story_rumor' && byId(id).push), 'folk_* use story_rumor and are push:true');
    const sc = byId('scribe');
    ok(sc && sc.sprite === 'npc:scribe' && JSON.stringify(sc.cond) === JSON.stringify([{ tier: 4 }, { tierBelow: 7 }]) && sc.move === 'wander' && sc.push, 'fern scribe (§10.9.5)');
    eq(m.signs.filter((s) => s.cond && s.cond.tier === 1).length, 1, 'fern has the tier-1 notice board (§10.9.5)');
    ok(m.patches.some((p) => p.cond && p.cond.tier === 1 && p.ch === 'm'), 'fern notice board tile appears at tier 1');
    for (const [id, shop] of [['shop_item', 'fern_item'], ['shop_weapon', 'fern_weapon'], ['shop_armor', 'fern_armor']]) {
      const n = byId(id);
      ok(n && n.event === 'common_shop' && n.shop === shop && n.fixed, 'fern ' + id + ' → ' + shop);
      ok(!!DB.shops[shop], 'shop ' + shop + ' exists');
    }
    ok(byId('inn') && byId('inn').event === 'common_inn' && byId('inn').fixed, 'fern inn');
    ok(byId('tavern') && byId('tavern').event === 'common_tavern' && byId('tavern').fixed, 'fern tavern');
    ok(byId('hanna') && byId('hanna').sprite === 'npc:old_woman' && byId('hanna').event === 'fern_hanna', 'hanna (npc:old_woman)');
    ok(byId('rita') && byId('rita').sprite === 'npc:girl' && byId('rita').event === 'fern_rita', 'rita (npc:girl)');
    ok(byId('dan') && byId('dan').sprite === 'npc:man', 'dan (npc:man)');
    ok(byId('dan') && byId('dan').cond === 'forest_dan', 'dan appears in fern once forest_dan (§10.8.2 NPC: cond \'forest_dan\')');
    ok(!m.npcs.some((n) => n.id !== 'dan' && /^dan_?l/.test(n.id)), 'one Dan in fern (no stand-in id)');
    // every NPC says fixed or push (§10.13.10)
    for (const n of m.npcs) ok(n.fixed || n.push, 'fern npc ' + n.id + ' has fixed or push');
    // town people: before / after the clear on every talking NPC with a tier list (§10.8.0-9)
    const tiered = m.npcs.filter((n) => Array.isArray(n.text) && typeof n.text[0] === 'object');
    let both = 0;
    for (const n of tiered) {
      const conds = n.text.map((t) => JSON.stringify(t.cond || null));
      const hasClear = conds.some((c) => /cleared|postgame/.test(c)) || JSON.stringify(n.cond || '').includes('cleared');
      const hasDefault = n.text.some((t) => t.cond == null);
      if (hasClear && hasDefault) both++;
    }
    measure('fern: NPCs with tier lines (before + after the clear)', both + '/' + tiered.length);
    ok(both >= 15, 'at least 15 fern NPCs have before/after lines (' + both + ')');
    ok(m.npcs.some((n) => Array.isArray(n.text) && n.text.some((t) => t.cond && (t.cond.tier === 4 || t.cond === 'final_open'))), 'a fern NPC has a {tier:4} or final_open line (§10.9.3)');
    measure('fern: NPCs', m.npcs.length);
    const nChests = m.chests.length;
    ok(nChests <= 2 && m.chests.every((c) => ['p_supply', 'p_gold'].includes(c.pool)), 'fern: 0–2 chests of p_supply / p_gold (§8.12.4)');
  }

  // chests on the dungeon floors
  const rare = {};
  for (const id of MAPS) {
    const { m } = compileQuiet(id);
    if (!m) continue;
    const seen = new Set();
    for (const c of m.chests) {
      ok(/^[a-z0-9_]+_c\d+$/.test(c.id) && c.id.startsWith(id + '_c'), id + ' chest id ' + c.id + ' is <map>_c<n>');
      ok(!seen.has(c.id), id + ' chest id ' + c.id + ' unique'); seen.add(c.id);
      ok(!!c.pool && !c.item && DB.pools[c.pool], id + ' chest ' + c.id + ' has a known pool and no fixed item');
      ok(m.walkable(c.x, c.y), id + ' chest ' + c.id + ' stands on floor');
      if (c.pool === 'p_rare') rare[DUNGEON[id]] = (rare[DUNGEON[id]] || 0) + 1;
    }
    if (id !== 'fern') {
      ok(m.chests.length >= 3 && m.chests.length <= 5, id + ': 3–5 chests (' + m.chests.length + ')');
      measure(id + ': chests', m.chests.map((c) => c.pool.replace('p_', '')).join(' '));
    }
  }
  eq(rare, { verda_maze: 1, elder_tree: 1 }, 'one p_rare per dungeon (§8.12.4)');
  // the mix of the other chests (§8.12.4: supply 5 : gear 2 : gold 2 : stone 1), over the region's four floors
  {
    const mix = {};
    let n = 0;
    for (const id of MAPS) if (id !== 'fern') for (const c of compileQuiet(id).m.chests) if (c.pool !== 'p_rare') { const k = /^p_(weapon|armor|acc)$/.test(c.pool) ? 'p_gear' : c.pool; mix[k] = (mix[k] || 0) + 1; n++; }
    const share = (k) => (mix[k] || 0) / n;
    measure('dungeon chest mix', Object.keys(mix).map((k) => k.replace('p_', '') + ' ' + mix[k]).join(' · '));
    ok(Math.abs(share('p_supply') - 0.5) <= 0.1, 'chest mix: p_supply about half (' + mix.p_supply + '/' + n + ')');
    ok(Math.abs(share('p_gear') - 0.2) <= 0.1, 'chest mix: p_gear about 2 in 10');
    ok(Math.abs(share('p_gold') - 0.2) <= 0.1, 'chest mix: p_gold about 2 in 10');
    ok(Math.abs(share('p_stone') - 0.1) <= 0.07, 'chest mix: p_stone about 1 in 10');
  }
  // secret passages (§10.6.4): verda_maze_2 and elder_tree_1, 1–3 cells each, nowhere else
  const secretCount = (id) => { const { m } = compileQuiet(id); let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isSecret(x, y)) n++; return n; };
  for (const id of MAPS) {
    const n = secretCount(id);
    if (id === 'verda_maze_2' || id === 'elder_tree_1') ok(n >= 1 && n <= 3, id + ' has a secret passage of 1–3 cells (' + n + ')');
    else eq(n, 0, id + ' has no secret passage');
  }
  // closed tile + tilePatch + examine (§10.8.0-6)
  {
    const d = DB.maps.verda_maze_2;
    const vines = [];
    d.rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'V') vines.push([x, y]); }));
    ok(vines.length >= 1, 'verda_maze_2 has the vine wall');
    for (const [x, y] of vines) {
      ok(d.tilePatches.some((p) => p.x === x && p.y === y && p.cond && p.cond.var === 'forest_verses' && p.cond.gte === 3 && p.ch === '.'), 'vine ' + x + ',' + y + ' opens at forest_verses ≥ 3');
      ok(d.events.some((e) => e.x === x && e.y === y && e.trigger === 'examine' && e.id === 'verda_maze_2_vine'), 'vine ' + x + ',' + y + ' has an examine event');
    }
    ok(!('lock' in (DB.tiles.vine_wall || {})), 'the vine wall does not use the engine lock');
  }
  // bosses, lanterns, fine (§10.6.2-5/6, §10.8.0-5)
  {
    const { m: m2 } = compileQuiet('verda_maze_2');
    const b = m2.npcs.find((n) => n.id === 'boss');
    ok(b && b.sprite === 'mon:boss_moth' && b.cond === '!forest_mid' && b.fixed, 'verda_maze_2 boss (moth) visible until forest_mid');
    ok(m2.npcs.some((n) => n.id === 'rest' && n.sprite === 'obj:lantern' && n.event === 'common_rest' && n.fixed), 'verda_maze_2 休息の灯');
    ok(m2.events.filter((e) => e.id === 'verda_maze_2_boss').every((e) => e.once === 'verda_maze_2_boss' && e.cond === '!forest_mid'), 'moth band: once + cond');
    const { m: m4 } = compileQuiet('elder_tree_2');
    const rb = m4.npcs.find((n) => n.id === 'boss');
    ok(rb && rb.sprite === 'mon:boss_rooteater' && rb.cond === '!forest_boss' && rb.fixed, 'elder_tree_2 boss (root-eater) visible until forest_boss');
    ok(m4.npcs.some((n) => n.id === 'rest' && n.sprite === 'obj:lantern' && n.event === 'common_rest'), 'elder_tree_2 休息の灯 before the boss');
    const f = m4.npcs.find((n) => n.id === 'fine');
    ok(f && f.sprite === 'npc:fine' && f.cond === '!forest_boss' && f.fixed, 'elder_tree_2 fine (npc:fine, cond !forest_boss)');
    const fb = m4.events.filter((e) => e.id === 'elder_tree_2_fine');
    ok(fb.length > 0 && fb.every((e) => e.trigger === 'step' && e.once === 'forest_fine'), 'the fine step band: once forest_fine');
    const lamp = m4.npcs.find((n) => n.id === 'rest');
    ok(Math.abs(lamp.x - f.x) + Math.abs(lamp.y - f.y) <= 8, 'fine stands by the lantern');
    ok(m4.npcs.some((n) => n.id === 'elm' && n.sprite === 'npc:spirit'), 'elm (npc:spirit)');
    ok(DB.troops.tr_b_moth && DB.troops.tr_b_rooteater, 'troops tr_b_moth / tr_b_rooteater exist');
  }
  // events, meta, objectives
  const EVENTS = ['fern_enter', 'fern_intro', 'fern_rita', 'fern_hanna', 'fern_hanna_reward', 'verda_maze_1_stone', 'verda_maze_1_dan',
    'verda_maze_2_stone_a', 'verda_maze_2_boss', 'verda_maze_2_stone_b', 'verda_maze_2_vine', 'verda_maze_1_twist', 'verda_maze_2_twist', 'elder_tree_2_fine', 'elder_tree_2_boss',
    'elder_tree_2_elm', 'elder_tree_2_altar'];
  for (const id of EVENTS) {
    const e = DB.events[id];
    ok(!!e && typeof e.run === 'function' && e.meta && Array.isArray(e.meta.needs) && Array.isArray(e.meta.gives), 'event ' + id + ' with meta');
  }
  const gives = (id) => (DB.events[id] && DB.events[id].meta.gives) || [];
  ok(gives('fern_intro').includes('flag:forest_start'), 'fern_intro gives forest_start');
  ok(gives('verda_maze_1_dan').includes('flag:forest_dan'), 'dan gives forest_dan');
  ok(gives('verda_maze_2_boss').includes('flag:forest_mid'), 'moth gives forest_mid');
  for (const id of ['verda_maze_1_stone', 'verda_maze_2_stone_a', 'verda_maze_2_stone_b']) ok(gives(id).includes('var:forest_verses+1'), id + ' gives var:forest_verses+1');
  ok(['flag:forest_boss', 'region:r_forest', 'item:k_page_forest'].every((t) => gives('elder_tree_2_boss').includes(t)), 'the boss gives forest_boss, the region and the page');
  eq(DB.events.elder_tree_2_boss.meta.warp, { to: 'fern', spawn: 'inn' }, 'the boss warps to fern:inn (§10.8.0-3)');
  ok(gives('fern_hanna_reward').includes('item:ac_tale_forest') && DB.items.ac_tale_forest, 'fern_hanna_reward gives ac_tale_forest (§8, the reward table)');
  // every event id placed on the maps exists (ours) or is someone else's documented id
  for (const id of MAPS) {
    const { m } = compileQuiet(id);
    const ids = new Set([...m.events.map((e) => e.id), ...m.npcs.map((n) => n.event).filter(Boolean), m.onEnter].filter(Boolean));
    for (const e of ids) ok(!!DB.events[e] || EXTERNAL_EVENTS.test(e), id + ' uses event ' + e + ' (defined)');
  }
  const OBJ = { obj_forest_1: '迷いの森の奥にある、\n千年樹を目指そう。', obj_forest_2: '迷いの森で、歌の刻まれた\n石を三つ探そう。', obj_forest_3: '千年樹の中へ入り、\n根の奥を目指そう。' };
  for (const [id, text] of Object.entries(OBJ)) eq(DB.objectives[id] && DB.objectives[id].text, text, 'objective ' + id + ' text (§10.8.2)');
}

// ============================================================ reach
function testReach() {
  section = 'reach';
  console.log('[reach]');
  // fern
  {
    const m = compileIn({ flags: ['forest_start', 'forest_dan'] }, 'fern');
    const e = sp(m, 'entrance');
    const r = reach(m, e.x, e.y);
    for (const id of ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'hanna', 'rita', 'dan', 'foreman', 'dan_wife', 'bard']) {
      const n = m.npcs.find((q) => q.id === id);
      ok(n && (r.adj(n.x, n.y) || r.across(n.x, n.y)), 'fern: ' + id + ' can be talked to');
    }
    for (const c of m.chests) ok(r.adj(c.x, c.y), 'fern: chest ' + c.id + ' reachable');
    const inn = sp(m, 'inn');
    ok(r.has(inn.x, inn.y), 'fern: the inn spawn is reachable');
    // every door is reachable from the gate
    let doors = 0, doorsOk = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tileAt(x, y) === 'door') { doors++; if (r.has(x, y)) doorsOk++; }
    eq(doorsOk, doors, 'fern: all ' + doors + ' doors reachable');
    measure('fern: walkable cells reached from the gate', r.size);
  }
  // verda_maze_1: Dan in the narrows
  {
    const m = compileIn({ flags: ['forest_start'] }, 'verda_maze_1');
    const e = sp(m, 'entrance');
    const r = reach(m, e.x, e.y);
    const exitUp = m.warps.filter((w) => w.to === 'verda_maze_2');
    ok(exitUp.length && exitUp.every((w) => !r.has(w.x, w.y)), 'verda_maze_1: Dan blocks the way up until spoken to');
    const dan = m.npcs.find((n) => n.id === 'dan');
    ok(r.adj(dan.x, dan.y), 'verda_maze_1: Dan can be reached');
    const st = m.events.find((q) => q.id === 'verda_maze_1_stone');
    ok(r.adj(st.x, st.y), 'verda_maze_1: stone 1 can be examined');
    for (const c of m.chests) ok(r.adj(c.x, c.y), 'verda_maze_1: chest ' + c.id + ' (' + c.pool + ') reachable');
    const m2 = compileIn({ flags: ['forest_start', 'forest_dan'] }, 'verda_maze_1');
    const r2 = reach(m2, e.x, e.y);
    ok(exitUp.every((w) => r2.has(w.x, w.y)), 'verda_maze_1: the way up opens after Dan');
    const rare = m.chests.find((c) => c.pool === 'p_rare');
    // p_rare in a dead end: removing the chest cell's approach cuts nothing else
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => m.walkable(rare.x + dx, rare.y + dy)).length;
    ok(nb <= 2, 'verda_maze_1: the p_rare chest is in a dead end (' + nb + ' open sides)');
    measure('verda_maze_1: steps entrance → way up', exitUp.map((w) => r2.d(w.x, w.y)).reduce((a, b) => Math.min(a, b)));
  }
  // verda_maze_2: moth, vines, secret
  {
    const st = { flags: ['forest_start', 'forest_dan'] };
    const m = compileIn(st, 'verda_maze_2');
    const s = sp(m, 'from_prev');
    const r = reach(m, s.x, s.y);
    const ev = (id) => m.events.find((q) => q.id === id);
    ok(r.adj(ev('verda_maze_2_stone_a').x, ev('verda_maze_2_stone_a').y), 'verda_maze_2: stone 2 before the moth');
    ok(m.events.filter((q) => q.id === 'verda_maze_2_boss').every((q) => r.has(q.x, q.y)), 'verda_maze_2: the moth band is reachable');
    ok(!r.adj(ev('verda_maze_2_stone_b').x, ev('verda_maze_2_stone_b').y), 'verda_maze_2: the moth blocks stone 3');
    const rest = m.npcs.find((n) => n.id === 'rest');
    ok(r.adj(rest.x, rest.y), 'verda_maze_2: the lantern before the moth');
    // the band cannot be walked round: without its cells the moth is unreachable
    const band = m.events.filter((q) => q.id === 'verda_maze_2_boss').map((q) => [q.x, q.y]);
    const boss = m.npcs.find((n) => n.id === 'boss');
    ok(!reach(m, s.x, s.y, { block: band }).adj(boss.x, boss.y), 'verda_maze_2: the moth is reached only across the band');
    const m2 = compileIn({ flags: st.flags.concat(['forest_mid']), vars: { forest_verses: 2 } }, 'verda_maze_2');
    const r2 = reach(m2, s.x, s.y);
    ok(r2.adj(ev('verda_maze_2_stone_b').x, ev('verda_maze_2_stone_b').y), 'verda_maze_2: stone 3 after the moth');
    const tree = m2.warps.find((w) => w.to === 'elder_tree_1');
    ok(tree && !r2.has(tree.x, tree.y), 'verda_maze_2: the vines hold with two verses');
    const m3 = compileIn({ flags: st.flags.concat(['forest_mid']), vars: { forest_verses: 3 } }, 'verda_maze_2');
    const r3 = reach(m3, s.x, s.y);
    ok(r3.has(tree.x, tree.y), 'verda_maze_2: the vines open with three verses');
    for (const c of m3.chests) ok(r3.adj(c.x, c.y), 'verda_maze_2: chest ' + c.id + ' reachable');
    const r3n = reach(m3, s.x, s.y, { noSecret: true });
    ok(r3n.has(tree.x, tree.y), 'verda_maze_2: the way to 千年樹 does not need the secret passage');
    const hidden = m3.chests.filter((c) => !r3n.adj(c.x, c.y));
    eq(hidden.map((c) => c.pool), ['p_gear'], 'verda_maze_2: only the p_gear chest lies beyond the secret passage');
    const note = m3.signs.find((q) => /書き付け/.test(JSON.stringify(q.text)));
    ok(note && r3.adj(note.x, note.y) && !r3n.adj(note.x, note.y), 'verda_maze_2: 語り部の書き付け beyond the secret passage');
    measure('verda_maze_2: steps from_prev → 千年樹', r3.d(tree.x, tree.y));
  }
  // the twisting trails: reachable, and they land on reachable floor
  for (const id of ['verda_maze_1', 'verda_maze_2']) {
    const m = compileIn({ flags: ['forest_start', 'forest_dan', 'forest_mid'], vars: { forest_verses: 3 } }, id);
    const s0 = sp(m, id === 'verda_maze_1' ? 'entrance' : 'from_prev');
    const r = reach(m, s0.x, s0.y);
    const tw = m.events.filter((q) => q.id === id + '_twist');
    eq(tw.length, id === 'verda_maze_1' ? 6 : 4, id + ': twisting trails (2 cells each)');
    for (const t of tw) {
      ok(r.has(t.x, t.y), id + ': twist cell ' + t.x + ',' + t.y + ' is reachable');
      ok(t.to && m.walkable(t.to.x, t.to.y) && r.has(t.to.x, t.to.y), id + ': twist ' + t.x + ',' + t.y + ' lands on reachable floor');
      ok(t.cond && t.cond.notCleared === 'r_forest', id + ': twist stops after the clear');
      ok(!m.warps.some((w) => w.x === t.x && w.y === t.y), id + ': no warp under a twist cell');
    }
  }
  // elder_tree_1: spiral, secret shortcut
  {
    const m = compileIn({ vars: { forest_verses: 3 } }, 'elder_tree_1');
    const e = sp(m, 'entrance');
    const r = reach(m, e.x, e.y), rn = reach(m, e.x, e.y, { noSecret: true });
    const down = m.warps.find((w) => w.to === 'elder_tree_2');
    ok(rn.has(down.x, down.y), 'elder_tree_1: the stairs down without the secret passage');
    ok(r.d(down.x, down.y) < rn.d(down.x, down.y), 'elder_tree_1: the secret passage is a shortcut (' + r.d(down.x, down.y) + ' < ' + rn.d(down.x, down.y) + ' steps)');
    for (const c of m.chests) ok(r.adj(c.x, c.y), 'elder_tree_1: chest ' + c.id + ' reachable');
    const hidden = m.chests.filter((c) => !rn.adj(c.x, c.y));
    eq(hidden.map((c) => c.pool), ['p_supply'], 'elder_tree_1: only a p_supply chest lies beyond the secret passage');
    measure('elder_tree_1: steps entrance → stairs (secret / long way)', r.d(down.x, down.y) + ' / ' + rn.d(down.x, down.y));
  }
  // elder_tree_2: fine, boss, altar
  {
    const m = compileIn({ vars: { forest_verses: 3 }, flags: ['forest_mid'] }, 'elder_tree_2');
    const s = sp(m, 'from_prev');
    const r = reach(m, s.x, s.y);
    const fineBand = m.events.filter((q) => q.id === 'elder_tree_2_fine').map((q) => [q.x, q.y]);
    const bossBand = m.events.filter((q) => q.id === 'elder_tree_2_boss').map((q) => [q.x, q.y]);
    ok(bossBand.every(([x, y]) => r.has(x, y)), 'elder_tree_2: the boss band is reachable');
    const noFine = reach(m, s.x, s.y, { block: fineBand });
    ok(bossBand.every(([x, y]) => !noFine.has(x, y)), 'elder_tree_2: the way to the boss goes through the lantern room (fine band first)');
    const noBand = reach(m, s.x, s.y, { block: bossBand });
    const altar = m.events.find((q) => q.id === 'elder_tree_2_altar');
    ok(!noBand.adj(altar.x, altar.y), 'elder_tree_2: the heart of the roots is entered only across the boss band');
    const rest = m.npcs.find((n) => n.id === 'rest');
    ok(noBand.adj(rest.x, rest.y), 'elder_tree_2: the lantern is before the boss');
    for (const c of m.chests) ok(r.adj(c.x, c.y), 'elder_tree_2: chest ' + c.id + ' reachable');
    measure('elder_tree_2: steps from_prev → boss band', Math.min(...bossBand.map(([x, y]) => r.d(x, y))));
  }
}

// ============================================================ text
function jpStrings(src) {
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let mm;
  while ((mm = re.exec(src))) if (/[぀-ヿ一-鿿]/.test(mm[1])) out.push(mm[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f'));
  return out;
}
function testText() {
  section = 'text';
  console.log('[text]');
  const files = fs.readdirSync(path.join(ROOT, 'src/maps')).filter((f) => /^region1_/.test(f)).map((f) => 'src/maps/' + f)
    .concat(fs.readdirSync(path.join(ROOT, 'src/events')).filter((f) => /^region1_/.test(f)).map((f) => 'src/events/' + f));
  const width = (s) => [...s.replace(/\{hero\}/g, '＿＿＿＿＿')].reduce((a, ch) => a + (/[\x20-\x7e]/.test(ch) ? 0.5 : 1), 0);
  let n = 0, bad = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    for (const s of jpStrings(src)) {
      n++;
      for (const page of s.split('\f')) {
        const lines = page.split('\n');
        if (lines.length > 4) { bad++; ok(false, f + ': more than 4 lines: ' + page.slice(0, 20)); }
        for (const l of lines) if (width(l) > 20) { bad++; ok(false, f + ': line over 20 full-width: ' + l); }
      }
      if (/…(?!…)/.test(s.replace(/……/g, ''))) ok(false, f + ': a lone …: ' + s.slice(0, 20));
      if (/アルン/.test(s)) ok(false, f + ': the hero\'s default name written out: ' + s.slice(0, 20));
    }
  }
  measure('text: Japanese strings checked', n);
  ok(n > 150, 'text: strings found (' + n + ')');
  eq(bad, 0, 'text: every line fits the window');
}

// ============================================================ play (the real runtime)
async function testPlay() {
  section = 'play';
  console.log('[play]');
  const S = R.fxReg1;
  R.Gfx.textWidth = (s) => R.Text.approxWidth(String(s));
  R.Settings.msgSpeed = 3;
  R.Settings.alwaysDash = true;
  const flush = () => new Promise((r) => setImmediate(r));
  let frames = 0;
  async function step(k = 1) { for (let i = 0; i < k; i++) { frames++; if (frames > 900000) throw new Error('frame budget'); R.Engine.step(); await flush(); } }
  async function press(b) { R.Input._set(b, true); await step(2); R.Input._set(b, false); await step(2); }
  const fieldTop = () => R.Engine.top() === R.Field.layer;
  async function settle(max = 6000) {
    for (let i = 0; i < max; i++) {
      await step(2);
      if (!R.Events.busy() && fieldTop() && !(R.Field.layer && R.Field.layer.locks) && !R.Field.wipePending) { await step(2); if (!R.Events.busy() && fieldTop()) return true; }
      if (!fieldTop()) await press('a');
    }
    return false;
  }
  const sayLog = [];
  { const say0 = R.UI.say; R.UI.say = function (t, o) { sayLog.push(R.Text.fmt(t)); return say0.call(this, t, o); }; }
  const said = (re, from) => sayLog.slice(from || 0).some((t) => re.test(t));
  const capLog = [];
  { const push0 = R.Engine.push; R.Engine.push = function (L) {
    if (L && typeof L.setCaption === 'function') { const sc = L.setCaption.bind(L); L.setCaption = (t, o) => { capLog.push(R.Text.fmt(t)); return sc(t, o); }; }
    return push0.call(this, L);
  }; }
  const captioned = (re, from) => capLog.slice(from || 0).some((t) => re.test(t));
  const g = () => R.Game;
  const go = async (p) => { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 400 && !done; i++) await step(1); ok(done, 'warp finished'); return settle(); };
  const talk = async (id) => { const n = R.Field.npc(id); ok(!!n && n.present, 'npc ' + id + ' present on ' + R.Field.map.id); if (n) { R.Events.talk(n); ok(await settle(), 'talk ' + id + ' ends'); } };
  const runStep = async (id, x, y, once) => { R.Events.run(id, { trigger: 'step', once: once || id, x, y }); ok(await settle(), id + ' ends'); };
  const exam = async (id) => { R.Events.run(id, { trigger: 'examine', self: id }); ok(await settle(), id + ' ends'); };
  const robj = () => (g().regionObj || {}).r_forest;

  // ---- a game after the prologue, at the gate of fern
  R.State.newGame();
  for (const f of PROLOGUE) R.State.setFlag(f);
  for (const id of ['brigitta', 'marta', 'sylvain']) R.Party.recruit(id, { silent: true });
  ok(g().party.length === 4, 'the party of four');
  let mark = sayLog.length;
  ok(await go(R.Field.start('fern', 'entrance')), '#1 fern: the intro runs');
  ok(g().flags.forest_start, '#1 forest_start');
  eq(robj(), 'obj_forest_1', '#1 objective obj_forest_1 (region)');
  ok(said(/三日も戻らないの/, mark) && said(/千年樹の歌を忘れてから/, mark), '#1 the elder\'s lines (§10.8.2)');
  ok(!R.Field.npc('hanna_gate').present && R.Field.npc('hanna').present, '#1 Hanna goes home');
  eq(g().respawn && g().respawn.map, 'fern', 'fern sets the respawn point');
  eq(g().visited && g().visited.fern, true, 'fern is visited (warp list)');
  mark = sayLog.length;
  ok(await go(R.Field.warp('fern', 'entrance')), 'fern again');
  ok(!said(/三日も戻らないの/, mark), '#1 the intro plays once');
  // ---- #2 リタ
  mark = sayLog.length;
  await talk('rita');
  eq(robj(), 'obj_forest_2', '#2 objective obj_forest_2');
  ok(said(/最初の一節しか/, mark) && said(/道しるべの石に/, mark) && said(/記録院の人が来て/, mark), '#2 Rita: the verse, the stones, Rowell\'s trace');
  // ---- the maze, 1F
  ok(await go(R.Field.warp('verda_maze_1', 'entrance')), 'to verda_maze_1');
  eq(g().visited.verda_maze, true, 'the maze entrance is visited (warp list, §10.6.3)');
  mark = sayLog.length; const cmark = capLog.length;
  await exam('verda_maze_1_stone');
  eq(g().vars.forest_verses, 1, '#3 stone 1: forest_verses 1');
  ok(captioned(/眠れ森の主、千の年輪に/, cmark), '#3 the verse as a caption');
  await exam('verda_maze_1_stone');
  eq(g().vars.forest_verses, 1, '#3 reading stone 1 again adds nothing');
  // the forest twists its paths
  R.Field.setPlayerPos(19, 3, 'up');
  mark = sayLog.length;
  R.Events.run('verda_maze_1_twist', { trigger: 'step', self: 'verda_maze_1_twist', x: 19, y: 2 });
  ok(await settle(), 'twist ends');
  eq([R.Field.pos().x, R.Field.pos().y], [23, 35], 'a twisting trail sends the party back to the forest edge');
  ok(said(/白い霧/, mark) && said(/元の道に/, mark), 'the twist\'s lines');
  mark = sayLog.length;
  await talk('dan');
  ok(g().flags.forest_dan && !R.Field.npc('dan').present, '#4 Dan: forest_dan, he goes home');
  ok(said(/でっかい羽虫がいて/, mark), '#4 Dan\'s line');
  // ---- 2F
  ok(await go(R.Field.warp('verda_maze_2', 'from_prev')), 'to verda_maze_2');
  await exam('verda_maze_2_stone_a');
  eq(g().vars.forest_verses, 2, '#5 stone 2');
  // the moth: lost once (no once flag, the wipe), then won
  S.battleScript = ['lose'];
  S.battles.length = 0;
  R.Field.setPlayerPos(24, 16, 'up');
  await runStep('verda_maze_2_boss', 24, 16);
  ok(!g().flags.forest_mid && !g().flags.verda_maze_2_boss, '#6 a lost moth fight sets nothing');
  if (R.Field.map.id !== 'verda_maze_2') ok(await go(R.Field.warp('verda_maze_2', { x: 24, y: 17, dir: 'up' })), 'back to the moth');
  for (const c of g().party) c.hp = Math.max(1, c.hp);
  S.battleScript = ['win'];
  mark = sayLog.length;
  await runStep('verda_maze_2_boss', 24, 16);
  eq(S.battles.map((b) => b.troop), ['tr_b_moth', 'tr_b_moth'], '#6 ev.battle(tr_b_moth) both times');
  ok(g().flags.forest_mid && !R.Field.npc('boss').present, '#6 forest_mid, the moth is gone');
  ok(said(/ダストウィングは/, mark), '#6 the after-battle line');
  eq(R.Field.map.tileAt(35, 2), 'vine_wall', '#7 the vines still hold with two verses');
  mark = sayLog.length;
  await exam('verda_maze_2_vine');
  ok(said(/つるが、網のように/, mark), 'the vine wall explains itself');
  mark = sayLog.length;
  await exam('verda_maze_2_stone_b');
  eq(g().vars.forest_verses, 3, '#7 stone 3: forest_verses 3');
  ok(said(/三つの石の歌がつながった/, mark), '#7 the three verses joined');
  eq(robj(), 'obj_forest_3', '#7 objective obj_forest_3');
  eq([R.Field.map.tileAt(35, 2), R.Field.map.tileAt(35, 3)], ['floor', 'floor'], '#7 the vines untangle (tilePatch)');
  // ---- 千年樹
  ok(await go(R.Field.warp('elder_tree_1', 'entrance')), '#8 into 千年樹');
  eq(R.Field.map.escape && R.Field.map.escape.spawn, 'verda_maze_1', 'the tree escapes to the maze entrance');
  ok(await go(R.Field.warp('elder_tree_2', 'from_prev')), 'to the roots');
  R.Field.setPlayerPos(15, 17, 'right');
  await runStep('elder_tree_2_fine', 15, 17, 'forest_fine');
  ok(g().flags.forest_fine, '#9 forest_fine');
  ok(!R.Field.npc('fine').present, '#9 the girl in grey is gone');
  // the boss and the clear
  S.battleScript = ['win'];
  S.battles.length = 0;
  for (const c of g().party) c.hp = 1;
  R.Field.setPlayerPos(22, 21, 'down');
  mark = sayLog.length; const cm2 = capLog.length;
  R.Events.run('elder_tree_2_boss', { trigger: 'step', x: 22, y: 21 });
  ok(await settle(12000), '#9–#10 the boss event runs to the end');
  eq(S.battles.map((b) => b.troop), ['tr_b_rooteater'], '#9 ev.battle(tr_b_rooteater)');
  ok(g().flags.forest_boss && g().flags.cleared_r_forest, '#10 forest_boss + cleared_r_forest');
  ok((g().regionsCleared || []).includes('r_forest') && g().tier === 1, '#10 the region is cleared, tier 1');
  ok(R.State.hasItem('k_page_forest'), '#10 森のページ');
  ok(said(/三つの石の歌を\nつないで語った/, mark) && said(/この森を守ると誓ったのだった/, mark) && said(/語り部よ、礼を言う/, mark), '#10 the retelling and エルム\'s lines (§10.8.2)');
  ok(captioned(/千年樹の歌/, cm2) || captioned(/第1章/, cm2), '#10 the chapter scene');
  ok(captioned(/その夜は、町の宿で眠った。/, cm2), '§10.8.0-3 the night at the inn');
  eq(R.Field.map.id, 'fern', '§10.8.0-3 the party wakes in fern');
  const innSp = DB.maps.fern.spawns.inn;
  const p = R.Field.pos();
  ok(Math.abs(p.x - innSp.x) + Math.abs(p.y - innSp.y) <= 3, '§10.8.0-3 at the inn (' + p.x + ',' + p.y + ')');
  ok(g().party.every((c) => c.hp === R.Rules.stats(c).hp), '§10.8.0-3 everyone is healed');
  if (DB.events.story_after_clear) ok(g().flags.st_t1, '§10.9.2 story_after_clear ran (st_t1)');
  ok(!g().flags.st_show_rival && !g().flags.st_show_fine && !g().flags.st_show_extra, 'the scene flags are down again');
  ok(R.Engine.fadeAlpha === 0, 'the screen is visible after the clear');
  // ---- the reward
  mark = sayLog.length;
  await talk('hanna');
  ok(R.State.hasItem('ac_tale_forest') && g().flags.fern_hanna_reward, 'the reward ac_tale_forest (fern_hanna_reward)');
  const n0 = R.State.count('ac_tale_forest');
  await talk('hanna');
  eq(R.State.count('ac_tale_forest'), n0, 'the reward is given once');
  ok(said(/夏至の祭りには/, mark), 'Hanna\'s after-clear line');
  const cm3 = capLog.length;
  await talk('rita');
  ok(captioned(/火の夜を忘れず/, cm3), 'Rita sings the whole song after the clear');
  ok(R.Field.npc('dan').present && R.Field.npc('dancer_a').present, 'Dan is home, the festival is on');
  ok(!R.Field.npc('lodge_wife').present, 'the waiting wife has gone home');
  // the elm by the altar
  ok(await go(R.Field.warp('elder_tree_2', 'altar')), 'back to the altar');
  ok(R.Field.npc('elm').present && !R.Field.npc('boss').present && !R.Field.npc('fine').present, 'after the clear: エルム by the altar, no boss, no fine');
  mark = sayLog.length;
  await talk('elm');
  ok(said(/もう閉ざさぬ/, mark), 'エルム\'s after-clear line');
  // the forest keeps still after the clear
  ok(await go(R.Field.warp('verda_maze_1', { x: 19, y: 3, dir: 'up' })), 'back to the maze');
  eq(R.Field.map.eventsAt(19, 2, 'step').length, 0, 'the twisting trails are gone after the clear');
  ok(await go(R.Field.warp('elder_tree_2', 'altar')), 'to the altar again');
  // the boss band never runs again
  S.battles.length = 0;
  R.Events.run('elder_tree_2_boss', { trigger: 'step' }); await settle();
  eq(S.battles.length, 0, 'the boss event does nothing after the clear');
  measure('play: frames simulated', frames);
  measure('play: lines shown', sayLog.length);
  const own = warnings.concat(R._warnLog || []).filter((w) => /region1|fern|verda|elder_tree/.test(w) && !/story_rumor/.test(w));
  eq(own.slice(0, 5), [], 'no warnings about region 1 during play');
}

// ============================================================ main
(async () => {
  const want = process.argv.slice(2);
  const on = (s) => !want.length || want.includes(s);
  const t0 = Date.now();
  { const w0 = R.warn; R._warnLog = []; R.warn = (...a) => { R._warnLog.push(a.join(' ')); }; }
  if (on('static')) testStatic();
  if (on('reach')) testReach();
  if (on('text')) testText();
  if (on('route')) testRoute();
  if (on('play')) {
    try { await testPlay(); } catch (e) { ok(false, 'play threw: ' + (e && e.stack || e)); }
  }
  console.log('\nmeasured:');
  for (const [k, v] of report) console.log('  ' + k + ': ' + v);
  console.log(`\ntest_reg1: ${passes} passed, ${fails} failed (${Date.now() - t0} ms)`);
  if (fails) { console.log(failed.map((f) => '  - ' + f).join('\n')); process.exit(1); }
  process.exit(0);
})();
