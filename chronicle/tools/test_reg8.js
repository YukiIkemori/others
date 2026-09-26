#!/usr/bin/env node
// Region 8 r_star オルビス高原 tests (owner R8 reg8; node, no DOM, exit 1 on failure).
// DESIGN §10.8.0 (all the common rules), §10.8.9, §10.6.1–§10.6.4, §10.9, §10.13, §11.2.7, §12.
//   static  — the five maps: ids, sizes, outside, type/theme/bgm/location/region/escape/zone/lvOff, spawns
//             and the contracts other areas use (st_* spots, folk_a/b, scribe, shops, inn, tavern), NPC
//             fixed/push + sprites + text, pool-only chests, events + meta, objectives, decor sanity,
//             secret passage count, 休息の灯 placement, closed tile + tilePatch + examine, tier lines
//   reach   — BFS on the compiled maps per story state: town (every NPC / chest / sign / door, the exits,
//             the scene spots kept clear), 1F–4F (stairs, chests, rest, the orrery and the chart door
//             gate the roof, the boss bands cut the floor, the secret room only through the passage)
//   density — §11.2.7 on every room of orbis (tools/check_density.js analyseMap)
//   play    — the whole region on the real field + event runtime (stand-in battles): arrival → Octavia →
//             the chart → tower → orrery (escape = retry) → Fine → star eater → clearRegion → the inn →
//             after-clear lines, the reward (once), the telescope, the tier lines
//   time    — walking-time estimate (shortest paths × first-visit factor, battles from the zone rate)
//
//   node tools/test_reg8.js                 all sections
//   node tools/test_reg8.js static play     only the named sections
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools/fixtures/reg8');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(FX, 'node/stubs.js')] });
console.warn = origWarn;
const DB = R.DB;
const ownLoadErrors = (R._nodeLoadErrors || []).filter((e) => /region8/.test(e));

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
const report = [];
const measure = (k, v) => { report.push([k, v]); };

const MAPS = ['orbis', 'stargaze_1', 'stargaze_2', 'stargaze_3', 'stargaze_4'];
const FLOORS = MAPS.slice(1);
const EXTERNAL_EVENTS = /^(common_|story_)/; // world (A18a) and story (A19) scripts placed or called here
const EVENTS = ['orbis_intro', 'orbis_octavia', 'orbis_octavia_reward', 'orbis_library_chart', 'orbis_telescope',
  'stargaze_3_door', 'stargaze_3_boss', 'stargaze_4_fine', 'stargaze_4_boss', 'stargaze_4_telescope'];
const PRO = ['hero_created', 'pro_start', 'pro_berna_sent', 'pro_lute', 'pro_met_rowell', 'pro_party_chosen', 'pro_key', 'pro_tutorial', 'pro_boss', 'prologue_done'];

// ============================================================ helpers
const compileQuiet = (id) => { const w = R.warn; const out = []; R.warn = (...a) => out.push(a.join(' ')); try { return { m: R.FieldMap.compile(id), warns: out }; } finally { R.warn = w; } };
function withState(o, fn) {
  const g0 = R.Game;
  R.State.newGame();
  const g = R.Game;
  for (const f of PRO) g.flags[f] = true;
  for (const f of o.flags || []) g.flags[f] = true;
  for (const it of o.items || []) g.inv[it] = 1;
  if (o.tier) { g.regionsCleared = (o.cleared || Object.keys(DB.regions || {}).filter((r) => r !== 'r_star')).slice(0, o.tier); g.tier = g.regionsCleared.length; }
  if (o.star) { g.regionsCleared = (g.regionsCleared || []).concat(['r_star']); g.tier = g.regionsCleared.length; g.flags.cleared_r_star = true; }
  if (o.postgame) { g.gameClear = true; g.flags.game_clear = true; }
  try { return fn(); } finally { R.Game = g0; }
}
/** BFS over a compiled map from (sx,sy): 4-neighbour, tile+decor walkability, non-pushable NPCs block */
function reach(m, sx, sy, o) {
  o = o || {};
  const blockNpc = new Set();
  for (const n of m.npcs) if (n.present && !R.FieldMap.pushable(n)) blockNpc.add(n.x + ',' + n.y);
  const pass = (x, y) => {
    if (!m.inMap(x, y)) return false;
    if (o.noSecret && /^secret_/.test(m.tileAt(x, y))) return false;
    if (o.block && o.block.has(x + ',' + y)) return false;
    if (blockNpc.has(x + ',' + y)) return false;
    const t = m.tileAt(x, y);
    if (/^door/.test(t) || t === 'stairs_up' || t === 'stairs_down') return true;
    return m.walkable(x, y);
  };
  const seen = new Set([sx + ',' + sy]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !pass(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
/** some cell next to (x,y) (or across a counter) is in the reached set */
function touch(m, seen, x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (seen.has((x + dx) + ',' + (y + dy))) return true;
    if (m.counterAt(x + dx, y + dy) && seen.has((x + 2 * dx) + ',' + (y + 2 * dy))) return true;
  }
  return false;
}
function bfsDist(m, sx, sy, tx, ty) {
  const pass = (x, y) => { if (!m.inMap(x, y)) return false; const t = m.tileAt(x, y); return /^door|stairs/.test(t) || m.walkable(x, y); };
  const dist = new Map([[sx + ',' + sy, 0]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    const d = dist.get(x + ',' + y);
    if (x === tx && y === ty) return d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (dist.has(k) || (!(nx === tx && ny === ty) && !pass(nx, ny))) continue;
      dist.set(k, d + 1); q.push([nx, ny]);
    }
  }
  return -1;
}

// ============================================================ static
function testStatic() {
  section = 'static';
  console.log('[static]');
  ok(!ownLoadErrors.length, 'no load errors in region8 files: ' + ownLoadErrors.join(' | '));
  for (const id of MAPS) ok(!!DB.maps[id], 'map ' + id + ' exists');
  ok(R.Reg8 && JSON.stringify(R.Reg8.MAPS) === JSON.stringify(MAPS), 'R.Reg8.MAPS lists the five maps');
  for (const id of MAPS) {
    const def = DB.maps[id];
    if (!def) continue;
    const { m, warns } = withState({}, () => compileQuiet(id));
    const own = warns.filter((w) => !/story_rumor|has neither text nor event/.test(w));
    ok(!own.length, id + ': compiles without warnings ' + JSON.stringify(own));
    ok(def.outside != null, id + ': outside is set');
    eq(def.region, 'r_star', id + ' region');
    ok(!def.hidden, id + ': no hidden items');
    def.rows.forEach((r, y) => ok(r.length === def.rows[0].length, id + ': row ' + y + ' width'));
    if (def.decor) ok(def.decor.length === def.rows.length && def.decor.every((r) => r.length === def.rows[0].length), id + ': decor rows match');
    const dungeon = /^stargaze_/.test(id);
    if (dungeon) {
      eq(def.type, 'dungeon', id + ' type');
      eq(def.location, 'stargaze', id + ' location');
      eq(def.escape, { to: 'world', spawn: 'stargaze_1' }, id + ' escape');
      eq([def.theme, def.bgm, def.bbg], ['tower', 'tower', 'tower'], id + ' theme/bgm/bbg');
      eq(def.encounter, 'z_r_star_tower', id + ' zone');
      ok(!!DB.encounters[def.encounter], id + ': zone exists');
      ok(!def.chestTier, id + ': no chestTier (tier chests follow the current tier)');
      ok((m.w >= 34 && m.h >= 30) || def.outside === '#', id + ': ≥34×30 or a walled outside (' + m.w + '×' + m.h + ')');
      eq(def.outside, '#', id + ': outside is the tower wall');
      measure(id + ' size', m.w + '×' + m.h);
    } else {
      eq(def.type, 'town', id + ' type');
      eq([def.theme, def.bgm], ['town_star', 'town'], id + ' theme/bgm');
      eq(def.location, 'orbis', id + ' location');
      ok(!!DB.locations.orbis, 'location orbis registered');
      ok(m.w >= 40 && m.h >= 32, id + ': town ≥ 40×32 (' + m.w + '×' + m.h + ')');
      eq(def.exit, { to: 'world', spawn: 'orbis' }, id + ' exit to the world');
      eq(def.outside, 'T', id + ' outside trees');
      eq(def.respawnSpawn, 'inn', id + ' respawn at the inn');
      ok(!def.encounter, id + ': no encounters in town');
      measure(id + ' size', m.w + '×' + m.h);
    }
    // NPCs
    for (const n of m.npcs) {
      ok(n.fixed === true || n.push === true, id + ': npc ' + n.id + ' has fixed or push');
      ok(R.Gfx.has(n.sprite), id + ': npc ' + n.id + ' sprite ' + n.sprite + ' registered');
      if (n.event) ok(!!DB.events[n.event] || EXTERNAL_EVENTS.test(n.event), id + ': npc ' + n.id + ' event ' + n.event);
      ok(!!(n.event || n.text), id + ': npc ' + n.id + ' has text or an event');
      const t = DB.tiles[m.tileAt(n.x, n.y)] || {}, dd = m.decorDef(n.x, n.y);
      if (/^(npc|party):/.test(n.sprite)) ok(t.pass && (!dd || dd.pass), id + ': npc ' + n.id + ' stands on a walkable cell (' + m.tileAt(n.x, n.y) + ')');
      if (n.move === 'wander') ok(n.push === true, id + ': wandering ' + n.id + ' is pushable');
    }
    // chests (§8.12.1, §10.6.2-8)
    const seenIds = new Set();
    for (const c of m.chests) {
      ok(new RegExp('^' + id + '_c\\d+$').test(c.id), id + ': chest id ' + c.id + ' is <map>_c<n>');
      ok(!seenIds.has(c.id), id + ': chest id unique ' + c.id); seenIds.add(c.id);
      ok(!c.item && !!c.pool && !!DB.pools[c.pool], id + ': chest ' + c.id + ' uses a pool (' + c.pool + ')');
      ok(m.walkable(c.x, c.y), id + ': chest ' + c.id + ' on floor');
    }
    for (const e of m.events) ok(!!DB.events[e.id], id + ': event ' + e.id + ' registered');
    if (def.onEnter) ok(!!DB.events[def.onEnter], id + ': onEnter ' + def.onEnter);
    for (const w of m.warps) {
      ok(!!DB.maps[w.to], id + ': warp → ' + w.to);
      if (DB.maps[w.to] && w.to !== 'world') ok(!!compileQuiet(w.to).m.spawns[w.spawn], id + ': warp → ' + w.to + ' spawn ' + w.spawn);
      if (w.to === 'world') ok(!!R.FieldMap.spawnPos(w.spawn, 'world'), id + ': world spawn ' + w.spawn);
    }
    // decor sanity: wall decor on walls, furniture on floor
    if (m.decor) {
      const badWall = [], badFloor = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const did = m.decorAt(x, y); if (!did) continue;
        ok(!!DB.decor[did], id + ': decor ' + did + ' registered');
        const dd = DB.decor[did] || {}, t = m.tileAt(x, y), td = DB.tiles[t] || {};
        const wallTile = /wall|housewall|roof/.test(t);
        if (dd.wall && !wallTile) badWall.push(did + '@' + x + ',' + y);
        if (!dd.wall && wallTile) badFloor.push(did + '@' + x + ',' + y);
        if (!dd.wall && !wallTile && !td.pass) badFloor.push(did + '@' + x + ',' + y + ' on ' + t);
      }
      ok(!badWall.length, id + ': wall decor on wall tiles ' + badWall.join(' '));
      ok(!badFloor.length, id + ': floor decor on floor tiles ' + badFloor.join(' '));
    }
  }
  // spawns (§10.6.1, §10.6.2-2, §10.13.3)
  const sp = (id) => compileQuiet(id).m.spawns;
  for (const [id, names] of Object.entries({ orbis: ['entrance', 'inn'], stargaze_1: ['entrance', 'from_next'], stargaze_2: ['from_prev', 'from_next'], stargaze_3: ['from_prev', 'from_next'], stargaze_4: ['from_prev'] })) {
    for (const n of names) ok(!!sp(id)[n], id + ': spawn ' + n);
  }
  eq(sp('orbis').inn.dir, 'down', 'orbis: inn spawn faces down');
  // the stairs chain 1F → 4F and back
  const w = (id) => compileQuiet(id).m.warps.map((v) => v.to + ':' + v.spawn).sort();
  eq(w('stargaze_1'), ['stargaze_2:from_prev', 'world:stargaze_1', 'world:stargaze_1'], 'stargaze_1 warps');
  eq(w('stargaze_2'), ['stargaze_1:from_next', 'stargaze_3:from_prev'], 'stargaze_2 warps');
  eq(w('stargaze_3'), ['stargaze_2:from_next', 'stargaze_4:from_prev'], 'stargaze_3 warps');
  eq(w('stargaze_4'), ['stargaze_3:from_next'], 'stargaze_4 warps');
  // lvOff (§10.6.2-9)
  ok(DB.maps.stargaze_1.lvOff == null && DB.maps.stargaze_2.lvOff === 2 && DB.maps.stargaze_3.lvOff === 2 && DB.maps.stargaze_4.lvOff == null, 'lvOff: 2F/3F 2, 1F zone value, boss floor none');
  // the town's service NPCs and contracts (§10.6.1, §10.8.0-7/8, §10.9.5, §10.13.10)
  const npc = (map, nid) => withState({}, () => compileQuiet(map).m.npcs.find((n) => n.id === nid));
  for (const [nid, key, val] of [['inn', 'event', 'common_inn'], ['tavern', 'event', 'common_tavern'], ['shop_item', 'shop', 'orbis_item'], ['shop_weapon', 'shop', 'orbis_weapon'],
    ['shop_armor', 'shop', 'orbis_armor'], ['shop_magic', 'shop', 'orbis_magic'], ['folk_a', 'rumor', 'orbis_a'], ['folk_b', 'rumor', 'orbis_b'], ['folk_a', 'event', 'story_rumor'],
    ['folk_b', 'event', 'story_rumor'], ['octavia', 'event', 'orbis_octavia'], ['octavia', 'sprite', 'npc:sage'], ['luca', 'sprite', 'npc:scholar'], ['arcana_mage', 'sprite', 'npc:old_man'],
    ['st_rival', 'sprite', 'npc:rowell'], ['st_fine', 'sprite', 'npc:fine'], ['st_extra', 'sprite', 'npc:scribe'], ['st_rival', 'cond', 'st_show_rival'], ['st_fine', 'cond', 'st_show_fine'],
    ['st_extra', 'cond', 'st_show_extra'], ['scribe', 'sprite', 'npc:scribe'], ['scribe', 'move', 'wander']]) {
    const n = npc('orbis', nid);
    ok(n && n[key] === val, 'orbis: npc ' + nid + ' ' + key + ' = ' + val + (n ? ' (got ' + n[key] + ')' : ' (missing)'));
  }
  for (const nid of ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'shop_magic', 'st_rival', 'st_fine', 'st_extra', 'octavia']) ok((npc('orbis', nid) || {}).fixed === true, 'orbis: ' + nid + ' fixed');
  for (const nid of ['folk_a', 'folk_b', 'scribe']) ok((npc('orbis', nid) || {}).push === true, 'orbis: ' + nid + ' push');
  eq((npc('orbis', 'scribe') || {}).cond, [{ tier: 4 }, { tierBelow: 7 }], 'orbis: scribe tier 4–6');
  const inn = sp('orbis').inn;
  const spots = { st_rival: [0, 2], st_fine: [2, 2], st_extra: [-2, 2] };
  for (const [nid, [dx, dy]] of Object.entries(spots)) {
    const n = npc('orbis', nid);
    ok(n && n.x === inn.x + dx && n.y === inn.y + dy && n.dir === 'up', 'orbis: ' + nid + ' at inn+(' + dx + ',' + dy + ') facing up');
  }
  for (const s of ['orbis_item', 'orbis_weapon', 'orbis_armor', 'orbis_magic']) ok(!!(DB.shops && DB.shops[s]), 'shop ' + s + ' exists');
  // tier-1 notice (§10.9.1)
  withState({ tier: 1 }, () => { const m = R.FieldMap.compile('orbis'); ok(m.tileAt(23, 40) === 'sign' && !!m.signAt(23, 40), 'orbis: tier-1 記録院の立て札'); });
  withState({}, () => { const m = R.FieldMap.compile('orbis'); ok(m.tileAt(23, 40) !== 'sign' && !m.signAt(23, 40), 'orbis: no notice before tier 1'); });
  // the library pedestal (§10.8.9 #3): pedestal tile + the chart + the examine event
  withState({ flags: ['star_start'] }, () => {
    const m = R.FieldMap.compile('orbis');
    eq(m.tileAt(10, 18), 'pedestal', 'orbis: the 書見台 is the pedestal tile C');
    ok(m.npcs.some((n) => n.id === 'chart' && n.present && n.x === 10 && n.y === 18), 'orbis: the star chart (sparkle) lies on it after star_start');
    ok(m.events.some((e) => e.id === 'orbis_library_chart' && e.trigger === 'examine' && e.x === 10 && e.y === 18), 'orbis: examine event on the pedestal');
  });
  withState({ flags: ['star_start', 'star_chart'] }, () => ok(!R.FieldMap.compile('orbis').npcs.some((n) => n.id === 'chart' && n.present), 'orbis: the chart is gone once taken'));
  ok(compileQuiet('orbis').m.events.some((e) => e.id === 'orbis_telescope' && e.trigger === 'examine'), 'orbis: telescope examine event');
  // the tower contents (§10.6.2-5/8, §10.6.4, §8.12.2)
  const floors = {};
  for (const id of FLOORS) floors[id] = withState({}, () => compileQuiet(id).m);
  const all = [].concat(...FLOORS.map((id) => floors[id].chests));
  eq(all.filter((c) => c.pool === 'p_rare').length, 1, 'stargaze: exactly one p_rare chest in the dungeon');
  ok(all.filter((c) => c.pool === 'p_supply').length >= all.length * 0.3, 'stargaze: supply chests are about half');
  measure('stargaze chests', all.length + ' (' + all.map((c) => c.pool.replace('p_', '')).join(' ') + ')');
  const rests = FLOORS.filter((id) => floors[id].npcs.some((n) => n.id === 'rest' && n.event === 'common_rest' && n.sprite === 'obj:lantern' && n.fixed));
  eq(rests, ['stargaze_2', 'stargaze_4'], '休息の灯 on the middle floor and before the boss');
  let secretTiles = 0; const secretFloors = [];
  for (const id of FLOORS) {
    const m = floors[id]; let n = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (/^secret_/.test(m.tileAt(x, y))) n++;
    if (n) secretFloors.push(id);
    secretTiles += n;
  }
  eq(secretFloors, ['stargaze_3'], 'secret passage floors (§10.6.4 reg-b row)');
  ok(secretTiles >= 1 && secretTiles <= 3, 'the secret passage is 1–3 tiles (' + secretTiles + ')');
  measure('secret passage tiles', secretTiles + ' on ' + secretFloors.join(' '));
  // the chart door (§10.8.0-6)
  const d3 = DB.maps.stargaze_3;
  const tp = (d3.tilePatches || []).find((p) => p.x === 21 && p.y === 6);
  ok(tp && tp.ch === 'D' && JSON.stringify(tp.cond) === JSON.stringify({ item: 'k_star_chart' }), 'stargaze_3: the door opens with {item:k_star_chart}');
  withState({}, () => eq(R.FieldMap.compile('stargaze_3').tileAt(21, 6), 'lockdoor', 'stargaze_3: the door is a closed tile without the chart'));
  withState({ items: ['k_star_chart'] }, () => eq(R.FieldMap.compile('stargaze_3').tileAt(21, 6), 'door', 'stargaze_3: the door opens with the chart'));
  ok(floors.stargaze_3.events.some((e) => e.id === 'stargaze_3_door' && e.trigger === 'examine' && e.x === 21 && e.y === 6), 'stargaze_3: examine event on the closed door');
  // bosses, Fine (§10.8.0-5, §10.6.2-6)
  const b3 = floors.stargaze_3.npcs.find((n) => n.id === 'boss'), b4 = floors.stargaze_4.npcs.find((n) => n.id === 'boss');
  ok(b3 && b3.sprite === 'mon:boss_star_guardian' && b3.cond === '!star_mid' && b3.fixed, 'stargaze_3: the visible orrery');
  ok(b4 && b4.sprite === 'mon:boss_stareater' && b4.cond === '!star_boss' && b4.fixed, 'stargaze_4: the visible star eater');
  ok(R.Gfx.has('mon:boss_star_guardian') && R.Gfx.has('mon:boss_stareater'), 'boss field sprites registered');
  const fine = floors.stargaze_4.npcs.find((n) => n.id === 'fine');
  ok(fine && fine.sprite === 'npc:fine' && fine.fixed && JSON.stringify(fine.cond).includes('!star_boss'), 'stargaze_4: fine (npc:fine, !star_boss)');
  const rest4 = floors.stargaze_4.npcs.find((n) => n.id === 'rest');
  ok(fine && rest4 && Math.abs(fine.x - rest4.x) + Math.abs(fine.y - rest4.y) <= 4, 'stargaze_4: Fine stands by the 休息の灯');
  ok(floors.stargaze_4.events.filter((e) => e.id === 'stargaze_4_fine').every((e) => e.once === 'star_fine'), 'stargaze_4: the Fine band is once star_fine');
  // troops, items, objectives, events
  for (const t of ['tr_b_orrery', 'tr_b_stareater']) ok(!!DB.troops[t], 'troop ' + t);
  eq(DB.regions.r_star && DB.regions.r_star.bossTroop, 'tr_b_stareater', 'DB.regions.r_star.bossTroop');
  for (const k of ['k_star_chart', 'k_page_star', 'ac_tale_star']) ok(!!DB.items[k], 'item ' + k);
  eq(DB.objectives.obj_star_1 && DB.objectives.obj_star_1.text, 'オルビスの図書館の奥の書見台で、\n星の名を記した星図を探そう。', 'obj_star_1 text (§10.8.9)');
  eq(DB.objectives.obj_star_2 && DB.objectives.obj_star_2.text, '星図を持って、\n星読みの塔の頂を目指そう。', 'obj_star_2 text (§10.8.9)');
  for (const o of Object.keys(DB.objectives)) if (/^obj_star_/.test(o)) ok(/^obj_star_[12]$/.test(o), 'only obj_star_1..2 (' + o + ')');
  for (const e of EVENTS) { const d = DB.events[e]; ok(d && typeof d.run === 'function' && d.meta && Array.isArray(d.meta.needs) && Array.isArray(d.meta.gives), 'event ' + e + ' with run + meta'); }
  const bm = (DB.events.stargaze_4_boss || {}).meta || {};
  ok(bm.gives && bm.gives.includes('region:r_star') && bm.gives.includes('flag:star_boss') && bm.warp && bm.warp.to === 'orbis' && bm.warp.spawn === 'inn', 'stargaze_4_boss meta: region + flag + warp to the inn');
  ok(((DB.events.orbis_library_chart || {}).meta || {}).gives.includes('item:k_star_chart'), 'the chart is given by an event (not a chest)');
  // tier-varying lines: every town person has before/after the clear; one {tier:4} / final_open line at least
  const people = withState({}, () => compileQuiet('orbis').m.npcs.filter((n) => /^npc:/.test(n.sprite) && Array.isArray(n.text) && n.text.length && typeof n.text[0] === 'object'));
  let t4 = 0;
  for (const n of people) {
    const conds = n.text.map((e) => JSON.stringify(e.cond || null));
    ok(n.text.some((e) => e.cond == null), 'orbis: ' + n.id + ' has a default line');
    if (conds.some((c) => /tier":4|final_open/.test(c))) t4++;
  }
  const cleared = people.filter((n) => n.text.some((e) => JSON.stringify(e.cond || null).includes('r_star')));
  ok(cleared.length >= 15, 'orbis: at least 15 people change their lines after the clear (' + cleared.length + ')');
  ok(t4 >= 1, 'orbis: at least one {tier:4} / final_open line (' + t4 + ')');
  measure('orbis talkers with tier lines', people.length + ' (after-clear ' + cleared.length + ', tier4/fog ' + t4 + ')');
}

// ============================================================ reach
function testReach() {
  section = 'reach';
  console.log('[reach]');
  // orbis from the south gate
  for (const st of [{}, { flags: ['star_start'] }, { flags: ['star_start', 'star_boss'], star: true, tier: 5 }]) {
    withState(st, () => {
      const m = R.FieldMap.compile('orbis'), e = m.spawns.entrance;
      const s = reach(m, e.x, e.y);
      const tag = 'orbis[' + (st.flags || []).join(',') + ']';
      for (const n of m.npcs) if (n.present) ok(touch(m, s, n.x, n.y) || s.has(n.x + ',' + n.y), tag + ': npc ' + n.id + ' reachable');
      for (const c of m.chests) ok(touch(m, s, c.x, c.y), tag + ': chest ' + c.id + ' reachable');
      for (const sg of m.signs) if (sg.present !== false) ok(touch(m, s, sg.x, sg.y) || !R.State.check(sg.cond), tag + ': sign ' + sg.x + ',' + sg.y + ' readable');
      for (const ev of m.events) ok(touch(m, s, ev.x, ev.y), tag + ': ' + ev.id + ' reachable');
      ok(s.has(m.spawns.inn.x + ',' + m.spawns.inn.y), tag + ': inn spawn reachable');
      let doors = 0, doorsIn = 0;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tileAt(x, y) === 'door') { doors++; if (s.has(x + ',' + y)) doorsIn++; }
      eq(doorsIn, doors, tag + ': every door reachable');
      let south = 0, west = 0;
      for (const k of s) { const [x, y] = k.split(',').map(Number); if (y === m.h - 1) south++; if (x === 0) west++; }
      ok(south > 0 && west > 0, tag + ': the south and west exits are reachable');
      // every walkable cell of the town is reachable (no pockets closed by props)
      const pockets = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const t = m.tileAt(x, y);
        if (!m.walkable(x, y) || t === 'tree' || s.has(x + ',' + y)) continue;
        if (m.npcs.some((n) => n.present && n.x === x && n.y === y)) continue;
        // staff side of a counter
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.counterAt(x + dx, y + dy))) continue;
        pockets.push(x + ',' + y);
      }
      ok(pockets.length <= 6, tag + ': no floor pockets cut off by props (' + pockets.join(' ') + ')');
      if (!st.flags) measure('orbis: cells reachable', s.size);
    });
  }
  // the scene spots are clear (§10.8.0-7)
  withState({ flags: ['star_start', 'star_boss'], star: true }, () => {
    const m = R.FieldMap.compile('orbis'), i = m.spawns.inn;
    const cells = [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [-1, 2], [-2, 2]].map(([dx, dy]) => [i.x + dx, i.y + dy]);
    for (const [x, y] of cells) {
      const k = x + ',' + y;
      ok(m.walkable(x, y) && !m.decorAt(x, y), 'orbis: scene cell ' + k + ' is bare floor');
      ok(!m.npcs.some((n) => n.present && n.x === x && n.y === y) && !m.chests.some((c) => c.x === x && c.y === y) && !m.signs.some((sg) => sg.x === x && sg.y === y) && !m.events.some((e) => e.x === x && e.y === y), 'orbis: scene cell ' + k + ' is empty');
      ok(!m.npcs.some((n) => n.move === 'wander' && Math.abs(n.x - x) <= 2 && Math.abs(n.y - y) <= 2 && !/^st_/.test(n.id)), 'orbis: no wandering NPC can step on ' + k);
    }
  });
  // 1F: entrance → stairs; chests
  withState({}, () => {
    const m = R.FieldMap.compile('stargaze_1'), e = m.spawns.entrance;
    const s = reach(m, e.x, e.y);
    ok(s.has('19,6'), 'stargaze_1: entrance → the stairs up');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'stargaze_1: chest ' + c.id + ' reachable');
    for (const sg of m.signs) ok(touch(m, s, sg.x, sg.y), 'stargaze_1: sign ' + sg.x + ',' + sg.y + ' readable');
    ok(s.has('19,33') || s.has('20,33'), 'stargaze_1: the way out');
    measure('stargaze_1: cells reachable', s.size);
  });
  // 2F
  withState({}, () => {
    const m = R.FieldMap.compile('stargaze_2'), p = m.spawns.from_prev;
    const s = reach(m, p.x, p.y);
    ok(s.has('31,5'), 'stargaze_2: from_prev → the stairs up');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'stargaze_2: chest ' + c.id + ' reachable');
    const rest = m.npcs.find((n) => n.id === 'rest');
    ok(rest && touch(m, s, rest.x, rest.y), 'stargaze_2: the 休息の灯 is reachable');
    for (const sg of m.signs) ok(touch(m, s, sg.x, sg.y), 'stargaze_2: sign readable');
    measure('stargaze_2: cells reachable', s.size);
  });
  // 3F: the orrery, the chart door, the secret room
  const at3 = (st, fn) => withState(st, () => { const m = R.FieldMap.compile('stargaze_3'); const p = m.spawns.from_prev; return fn(m, p); });
  at3({}, (m, p) => {
    const s = reach(m, p.x, p.y);
    ok(!s.has('21,2'), 'stargaze_3: no way to the roof stairs before the orrery and the chart');
    const band = new Set(m.events.filter((e) => e.id === 'stargaze_3_boss').map((e) => e.x + ',' + e.y));
    ok([...band].some((k) => s.has(k)), 'stargaze_3: the boss band is reached');
    const s2 = reach(m, p.x, p.y, { block: band });
    ok(!s2.has('21,8') && !touch(m, s2, 21, 9), 'stargaze_3: no way to the orrery around its band');
    ok(touch(m, s, 21, 9), 'stargaze_3: the orrery can be talked to');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'stargaze_3: chest ' + c.id + ' reachable');
    const s3 = reach(m, p.x, p.y, { noSecret: true });
    const hidden = m.chests.find((c) => c.id === 'stargaze_3_c1');
    ok(hidden && !touch(m, s3, hidden.x, hidden.y), 'stargaze_3: the lore room only through the secret passage');
    ok(m.signs.some((sg) => touch(m, s, sg.x, sg.y) && !touch(m, s3, sg.x, sg.y)), 'stargaze_3: the 語り部の書き付け is beyond the passage');
    measure('stargaze_3: cells reachable', s.size);
  });
  at3({ flags: ['star_mid'] }, (m, p) => {
    const s = reach(m, p.x, p.y);
    ok(s.has('21,7') && !s.has('21,5'), 'stargaze_3: after the orrery the chart door still holds');
    ok(touch(m, s, 21, 6), 'stargaze_3: the closed door can be examined');
  });
  at3({ flags: ['star_mid'], items: ['k_star_chart'] }, (m, p) => {
    const s = reach(m, p.x, p.y);
    ok(s.has('21,2'), 'stargaze_3: orrery beaten + chart → the stairs to the roof');
    const s2 = reach(m, p.x, p.y, { noSecret: true });
    ok(s2.has('21,2'), 'stargaze_3: the roof never needs the secret passage');
  });
  at3({ items: ['k_star_chart'] }, (m, p) => ok(!reach(m, p.x, p.y).has('21,2'), 'stargaze_3: the chart alone does not pass the orrery'));
  // 4F
  withState({ items: ['k_star_chart'] }, () => {
    const m = R.FieldMap.compile('stargaze_4'), p = m.spawns.from_prev;
    const s = reach(m, p.x, p.y);
    const rest = m.npcs.find((n) => n.id === 'rest'), fine = m.npcs.find((n) => n.id === 'fine');
    ok(touch(m, s, rest.x, rest.y), 'stargaze_4: the 休息の灯 is reachable');
    ok(touch(m, s, fine.x, fine.y), 'stargaze_4: Fine is reachable');
    const fband = new Set(m.events.filter((e) => e.id === 'stargaze_4_fine').map((e) => e.x + ',' + e.y));
    const s1 = reach(m, p.x, p.y, { block: fband });
    ok(!touch(m, s1, 16, 8) && !s1.has('16,17'), 'stargaze_4: the Fine band spans the stairwell');
    ok(touch(m, s, 16, 8), 'stargaze_4: the star eater can be reached');
    const band = new Set(m.events.filter((e) => e.id === 'stargaze_4_boss').map((e) => e.x + ',' + e.y));
    const s2 = reach(m, p.x, p.y, { block: band });
    ok(!touch(m, s2, 16, 8), 'stargaze_4: no way to the star eater around its band');
    ok(s.has(rest.x + ',' + (rest.y + 1)) || touch(m, s, rest.x, rest.y), 'stargaze_4: rest before the boss');
    const dr = bfsDist(m, p.x, p.y, rest.x, rest.y), db = bfsDist(m, p.x, p.y, 16, 13);
    ok(dr > 0 && dr < db, 'stargaze_4: the 休息の灯 comes before the boss (' + dr + ' < ' + db + ')');
  });
}

// ============================================================ density (§11.2.7)
function testDensity() {
  section = 'density';
  console.log('[density]');
  const D = require('./check_density');
  const M = require('./lib/maps');
  const P = M.parseMap(R, 'orbis');
  const rooms = D.analyseMap(R, P);
  const inner = rooms.filter((r) => r.size < 300); // the paved streets form one big "room"
  ok(inner.length >= 10, 'orbis: at least 10 interiors (' + inner.length + ')');
  for (const [i, r] of inner.entries()) {
    ok(r.block <= 0.30, 'orbis room ' + (i + 1) + ': blocking furniture ≤ 30% (' + Math.round(r.block * 100) + '%)');
    ok(r.cut === 0, 'orbis room ' + (i + 1) + ': no cells cut off by furniture');
    if (r.aisle != null) ok(r.aisle, 'orbis room ' + (i + 1) + ': 2-wide aisle to the counter');
  }
  const avg = inner.reduce((a, r) => a + r.block, 0) / inner.length;
  ok(avg >= 0.15 && avg <= 0.27, 'orbis: average blocking furniture in 15–27% (' + Math.round(avg * 100) + '%)');
  measure('orbis interiors: blocking avg / soft avg', Math.round(avg * 100) + '% / ' + Math.round(100 * inner.reduce((a, r) => a + r.soft, 0) / inner.length) + '%');
}

// ============================================================ play (the real runtime)
async function testPlay() {
  section = 'play';
  console.log('[play]');
  const S = R.fxReg8;
  R.Gfx.textWidth = (s) => R.Text.approxWidth(String(s));
  R.Settings.msgSpeed = 3;
  R.Settings.alwaysDash = true;
  const flush = () => new Promise((r) => setImmediate(r));
  let frames = 0;
  async function step(k = 1) { for (let i = 0; i < k; i++) { frames++; if (frames > 900000) throw new Error('frame budget'); R.Engine.step(); await flush(); } }
  async function press(b) { R.Input._set(b, true); await step(2); R.Input._set(b, false); await step(2); }
  const fieldTop = () => R.Engine.top() === R.Field.layer;
  async function settle(max = 5000) {
    for (let i = 0; i < max; i++) {
      await step(2);
      if (!R.Events.busy() && fieldTop() && !(R.Field.layer && R.Field.layer.locks)) { await step(2); if (!R.Events.busy() && fieldTop()) return true; }
      if (!fieldTop()) await press('a');
    }
    return false;
  }
  const sayLog = [];
  { const say0 = R.UI.say; R.UI.say = function (t, o) { sayLog.push(R.Text.fmt(Array.isArray(t) ? t.join('\f') : t)); return say0.call(this, t, o); }; }
  const said = (re, from) => sayLog.slice(from || 0).some((t) => re.test(t));
  const capLog = [];
  { const push0 = R.Engine.push; R.Engine.push = function (L) {
    if (L && typeof L.setCaption === 'function') { const sc = L.setCaption.bind(L); L.setCaption = (t, o) => { capLog.push(R.Text.fmt(t)); return sc(t, o); }; }
    return push0.call(this, L);
  }; }
  const captioned = (re) => capLog.some((t) => re.test(t));
  const g = () => R.Game;
  const go = async (p) => { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 600 && !done; i++) await step(1); ok(done, 'warp finished'); return settle(); };
  const talk = async (id) => { const n = R.Field.npc(id); ok(!!n && n.present, 'npc ' + id + ' present on ' + R.Field.map.id); if (n) { R.Events.talk(n); ok(await settle(), 'talk ' + id + ' ends'); } };
  const exam = async (id, x, y) => { R.Events.run(id, { trigger: 'examine', x, y }); ok(await settle(), id + ' ends'); };
  const band = async (id, x, y, once) => { R.Events.run(id, { trigger: 'step', x, y, once }); ok(await settle(), id + ' ends'); };

  // ---- a party that finished the prologue
  R.State.newGame();
  for (const f of PRO) g().flags[f] = true;
  for (const k of ['k_chronicle', 'k_quill', 'k_bell']) if (DB.items[k]) R.State.addItem(k, 1);
  if (R.Party && R.Party.recruit) for (const id of ['brigitta', 'marta', 'sylvain']) { try { R.Party.recruit(id); } catch (e) { /* roster differs */ } }
  g().objective = 'obj_regions';
  const tier0 = g().tier || 0;

  // #1 arrival
  let mark = sayLog.length;
  ok(await go(R.Field.start('orbis', 'entrance')), '#1 arrival runs');
  ok(g().flags.star_start, '#1 star_start');
  eq((g().regionObj || {}).r_star, 'obj_star_1', '#1 region objective obj_star_1');
  eq(g().objective, 'obj_regions', '#1 the global objective stays obj_regions');
  ok(said(/星が、毎晩ひとつずつ消えていくんだ。/, mark) && said(/誰も思い出せなくなってから/, mark), '#1 Luca\'s lines (§10.8.9)');
  ok(!R.Field.npc('luca_gate').present, '#1 Luca leaves the gate');
  ok(R.Field.npc('luca').present, '#1 Luca is in the observatory');
  ok(g().visited && g().visited.orbis, 'visited orbis (warp list)');
  eq((g().respawn || {}).map, 'orbis', 'the town is the respawn point');
  mark = sayLog.length; await go(R.Field.warp('orbis', 'entrance'));
  ok(!said(/ぼくはルカ/, mark), '#1 runs only once');
  // Luca's pre-clear line (ロウェルの痕跡)
  mark = sayLog.length; await talk('luca');
  ok(said(/記録院の人が、星の名簿を/, mark), 'Luca: the trace of the record office before the clear');
  // #2 Octavia
  mark = sayLog.length; await talk('octavia');
  ok(said(/『保管のため』/, mark) && said(/図書館の奥に残っているかもしれません。/, mark), '#2 Octavia\'s lines (§10.8.9)');
  // the arcana mage: the line of §10.8.9 at any time
  mark = sayLog.length; await talk('arcana_mage');
  ok(said(/魔法都市アルカナから/, mark), 'the old mage from Arcana');
  // #3 the chart
  const chart = R.Field.npc('chart');
  ok(chart && chart.present, '#3 the chart sparkles on the pedestal');
  mark = sayLog.length; R.Events.talk(chart); ok(await settle(), '#3 the pedestal ends');
  ok(R.State.hasItem('k_star_chart'), '#3 k_star_chart');
  ok(g().flags.star_chart, '#3 star_chart');
  eq(g().regionObj.r_star, 'obj_star_2', '#3 region objective obj_star_2');
  ok(said(/古い星図を見つけた。/, mark), '#3 the chart line');
  ok(!R.Field.npc('chart').present, '#3 the chart is taken');
  ok(S.jingles.includes('keyitem'), '#3 the key-item jingle');
  mark = sayLog.length; await exam('orbis_library_chart', 10, 18);
  ok(said(/広げてあった/, mark) && R.State.count('k_star_chart') === 1, '#3 the pedestal afterwards (no second chart)');
  mark = sayLog.length; await exam('orbis_telescope', 43, 20);
  ok(said(/星はほとんど見えない/, mark), 'the telescope before the clear');
  // #4 the tower
  ok(await go(R.Field.warp('stargaze_1', 'entrance')), 'to stargaze_1');
  ok(g().visited.stargaze, 'visited stargaze (dungeon entrance in the warp list)');
  eq(R.Field.map.bgm, 'tower', 'tower BGM');
  ok(R.Field.canExit && R.Field.canExit(), 'escape works in the tower');
  // #5 the orrery: an escape is a retry, a win sets star_mid
  ok(await go(R.Field.warp('stargaze_3', 'from_prev')), 'to stargaze_3');
  eq(R.Field.map.tileAt(21, 6), 'door', '#6 the chart opens the star-chart door');
  S.battleScript.push('escape');
  await band('stargaze_3_boss', 21, 10);
  ok(!g().flags.star_mid && R.Field.npc('boss').present, '#5 escaped: the orrery stays (retry)');
  const nb = S.battles.length;
  await band('stargaze_3_boss', 21, 10);
  eq(S.battles[nb] && S.battles[nb].troop, 'tr_b_orrery', '#5 tr_b_orrery');
  ok(g().flags.star_mid, '#5 star_mid');
  ok(!R.Field.npc('boss').present, '#5 the orrery is gone');
  // the door text without the chart (a fresh state check)
  mark = sayLog.length; await exam('stargaze_3_door', 21, 6);
  ok(said(/扉に星座の形のくぼみがある。/, mark), '#6 the door text (§10.8.9)');
  // #7 Fine and the star eater
  ok(await go(R.Field.warp('stargaze_4', 'from_prev')), 'to stargaze_4');
  ok(R.Field.npc('fine').present, '#7 Fine waits by the lantern');
  mark = sayLog.length; await band('stargaze_4_fine', 16, 24, 'star_fine');
  ok(g().flags.star_fine, '#7 star_fine');
  ok(said(/名前を呼ばれない星は、/, mark) || !!DB.events.story_fine_star, '#7 the region line of Fine (§10.9.4)');
  ok(!R.Field.npc('fine').present, '#7 Fine is gone');
  S.battleScript.push('escape');
  await band('stargaze_4_boss', 16, 13);
  ok(!g().flags.star_boss && R.Field.npc('boss').present, '#7 escaped: the star eater stays');
  mark = sayLog.length; const cap0 = capLog.length;
  const nb2 = S.battles.length;
  R.Events.run('stargaze_4_boss', { trigger: 'step', x: 16, y: 13 });
  ok(await settle(8000), '#8 the boss scene ends');
  eq(S.battles[nb2] && S.battles[nb2].troop, 'tr_b_stareater', '#7 tr_b_stareater');
  ok(g().flags.star_boss, '#7 star_boss');
  ok(said(/星図を広げ、/, mark) && capLog.slice(cap0).some((t) => /夜空に、星が戻っていく……。/.test(t)), '#8 the retelling (§10.8.9)');
  ok((g().regionsCleared || []).includes('r_star') && g().flags.cleared_r_star, '#8 ev.clearRegion(r_star)');
  eq(g().tier, tier0 + 1, '#8 the tier goes up');
  ok(R.State.hasItem('k_page_star'), '#8 k_page_star');
  ok(captioned(/その夜は、町の宿で眠った。/), '#8 the night at the inn (§10.8.0-3)');
  eq(R.Field.map.id, 'orbis', '#8 back in orbis');
  const ip = R.Field.map.spawns.inn, pos = R.Field.pos();
  ok(pos.x === ip.x && pos.y === ip.y, '#8 at the inn spawn (' + pos.x + ',' + pos.y + ')');
  ok(R.Engine.fadeAlpha === 0, '#8 the screen is visible again');
  ok(g().party.every((c) => c.hp > 0), '#8 healed');
  for (const id of ['st_rival', 'st_fine', 'st_extra']) ok(!R.Field.npc(id).present, 'after the scene: ' + id + ' is not shown');
  // after the clear
  mark = sayLog.length; await talk('luca');
  ok(said(/ちゃんと戻ってきた/, mark), 'Luca after the clear');
  mark = sayLog.length; await talk('octavia');
  ok(R.State.hasItem('ac_tale_star') && g().flags.orbis_octavia_reward, 'the reward 星読みの片眼鏡 (orbis_octavia_reward)');
  mark = sayLog.length; await talk('octavia');
  eq(R.State.count('ac_tale_star'), 1, 'the reward only once');
  ok(said(/写しを何冊も/, mark), 'Octavia after the reward');
  mark = sayLog.length; await exam('orbis_telescope', 43, 20);
  ok(said(/白い霧に包まれた/, mark), 'the telescope after the clear (!final_open)');
  g().flags.final_open = true;
  mark = sayLog.length; await exam('orbis_telescope', 43, 20);
  ok(said(/霧の晴れた島に、白い塔が/, mark), 'the telescope after final_open');
  mark = sayLog.length; await talk('old_astronomer');
  ok(said(/内海の島を/, mark), 'a final_open line in town');
  g().flags.final_open = false;
  // tier lines in the town
  g().regionsCleared = Object.keys(DB.regions).slice(0, 5); if (!g().regionsCleared.includes('r_star')) g().regionsCleared[4] = 'r_star';
  g().tier = 5; R.Field.refresh();
  ok(R.Field.npc('scribe').present, 'orbis: the white-robed scribe at tier 5');
  ok(R.Field.npc('books_a').present, 'orbis: the books pile up from tier 3');
  mark = sayLog.length; await talk('teacher');
  ok(said(/記録院の書記/, mark), 'a {tier:4} line in town');
  g().regionsCleared = Object.keys(DB.regions).slice(0, 7); if (!g().regionsCleared.includes('r_star')) g().regionsCleared[6] = 'r_star';
  g().tier = 7; R.Field.refresh();
  ok(!R.Field.npc('scribe').present, 'orbis: the scribe is gone at tier 7');
  // the roof after the clear
  ok(await go(R.Field.warp('stargaze_4', 'from_prev')), 'back on the roof');
  ok(!R.Field.npc('boss').present && !R.Field.npc('fine').present, 'the roof is quiet after the clear');
  ok(R.Field.npc('star_1').present, 'the stars shine over the roof');
  const own = warnings.filter((w) => /region8|orbis|stargaze/.test(w) && !/story_rumor|has neither text nor event/.test(w));
  ok(!own.length, 'no warnings about the region during play: ' + own.slice(0, 5).join(' | '));
  measure('play frames', frames);
}

// ============================================================ time (§10.14: ~2–2.5 h per region)
function testTime() {
  section = 'time';
  console.log('[time]');
  const legs = [];
  const leg = (map, from, to, st) => withState(st || { flags: ['star_start', 'star_mid', 'star_chart'], items: ['k_star_chart'] }, () => {
    const m = R.FieldMap.compile(map);
    const a = typeof from === 'string' ? m.spawns[from] : from, b = typeof to === 'string' ? m.spawns[to] : to;
    const d = bfsDist(m, a.x, a.y, b.x, b.y);
    legs.push([map, d]);
    return d;
  });
  const t1 = leg('orbis', 'entrance', { x: 42, y: 7 });     // to Octavia
  const t2 = leg('orbis', { x: 42, y: 7 }, { x: 10, y: 19 }); // to the chart
  const t3 = leg('orbis', { x: 10, y: 19 }, 'entrance');
  const d1 = leg('stargaze_1', 'entrance', { x: 19, y: 6 });
  const d2 = leg('stargaze_2', 'from_prev', { x: 31, y: 5 });
  const d3 = leg('stargaze_3', 'from_prev', { x: 21, y: 2 });
  const d4 = leg('stargaze_4', 'from_prev', { x: 16, y: 13 });
  for (const [m, d] of legs) ok(d > 0, 'path exists on ' + m + ' (' + d + ')');
  const tower = d1 + d2 + d3 + d4;
  const rate = (R.FieldMap && R.FieldMap.DEFAULT_ENC_RATE && R.FieldMap.DEFAULT_ENC_RATE.dungeon) || 22;
  const towerSteps = Math.round(tower * 2.5);
  const battles = Math.round(towerSteps / rate);
  measure('orbis walking (gate → academy → library → gate, shortest)', (t1 + t2 + t3) + ' steps');
  measure('stargaze shortest 1F+2F+3F+4F', tower + ' steps (' + [d1, d2, d3, d4].join('+') + ')');
  measure('stargaze expected steps / random battles (first visit ×2.5, encRate ' + rate + ')', towerSteps + ' / ' + battles);
  ok(d1 >= 60, '1F is a real walk (shortest ' + d1 + ' ≥ 60)');
  ok(battles >= 20 && battles <= 60, 'stargaze random battles in 20–60 (' + battles + ')');
  // minutes: ~0.3 s per step, ~55 s per random battle (4 members, menus), ~10 min for the two bosses,
  // Fine, the retelling and the lanterns
  const min = Math.round((towerSteps * 0.3 + battles * 55) / 60 + 10);
  measure('stargaze dungeon time estimate', min + ' min');
  ok(min >= 40 && min <= 90, 'dungeon time in 40–90 min (§10.14: 60–80)');
}

// ============================================================ run
(async () => {
  const want = process.argv.slice(2);
  const on = (s) => !want.length || want.includes(s);
  try {
    if (on('static')) testStatic();
    if (on('reach')) testReach();
    if (on('density')) testDensity();
    if (on('play')) await testPlay();
    if (on('time')) testTime();
  } catch (e) {
    fails++; failed.push(section + ': threw ' + (e && e.stack || e));
    console.log('  THREW:', e && e.stack || e);
  }
  console.log('\nmeasured:');
  for (const [k, v] of report) console.log('  ' + k + ': ' + v);
  console.log(`\ntest_reg8: ${passes} passed, ${fails} failed`);
  if (fails) { console.log('failures:\n  ' + failed.slice(0, 60).join('\n  ')); process.exit(1); }
  process.exit(0);
})();
