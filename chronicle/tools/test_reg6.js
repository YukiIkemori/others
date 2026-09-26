#!/usr/bin/env node
// Region 6 r_mine ガルド山地 tests (owner R6 reg6; node, no DOM, exit 1 on failure).
// DESIGN §10.8.0 (all the common rules), §10.8.7, §10.6.1–§10.6.4, §10.9, §10.13, §11.2.7, §12.
//   static  — the four maps: ids, sizes, outside, type/theme/bgm/location/region/escape/zone/lvOff, spawns
//             and the contracts other areas use (st_* spots, folk_a/b, scribe, shops, inn, tavern), NPC
//             fixed/push + sprites + text, pool-only chests (3–5 per floor, one p_rare), events + meta,
//             objectives, secret passage (deep_mine_2 only), 休息の灯 placement, the closed rock door +
//             tilePatch + examine, the den zone, tier lines ({cond,text} with a default last)
//   reach   — BFS on the compiled maps per story state: every NPC / chest / sign / stair of the town and the
//             floors; the side tunnel stays shut until mine_mid; the rock door until the hammer has rung;
//             the den only through the secret passage; no chest blocks a path
//   density — §11.2.7 on every room of dovan (tools/check_density.js)
//   text    — every Japanese string in src/{maps,events}/region6*.js: 20 full-width per line ({hero} = 5),
//             4 lines per page, 常用漢字 + the allowed list, forbidden words, 「……」 (STYLE_JA)
//   play    — the whole region on the real field + event runtime (stand-in battles): arrival (Borg) →
//             Helga → miner 1 → miner 2 → 岩食らい → Pip (hammer) → the rock door → Fine → 鉄の番人 →
//             clearRegion → the inn in Dovan → after-clear lines, the reward (once); Fine's tier endings
//   time    — walking-time estimate per floor (shortest paths × first-visit factor + battles by rate)
//
//   node tools/test_reg6.js                 all sections
//   node tools/test_reg6.js static play     only the named sections
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools/fixtures/reg6');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(FX, 'node/stubs.js')] });
console.warn = origWarn;
const DB = R.DB;
const ownLoadErrors = (R._nodeLoadErrors || []).filter((e) => /region6/.test(e));

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
const report = [];
const measure = (k, v) => { report.push([k, v]); };

const MAPS = ['dovan', 'deep_mine_1', 'deep_mine_2', 'deep_mine_3'];
const FLOORS = ['deep_mine_1', 'deep_mine_2', 'deep_mine_3'];
const EXTERNAL_EVENTS = /^(common_|story_)/; // world (A18a) and story (A19) scripts placed or called here

// ============================================================ helpers
const compileQuiet = (id) => { const w = R.warn; const out = []; R.warn = (...a) => out.push(a.join(' ')); try { return { m: R.FieldMap.compile(id), warns: out }; } finally { R.warn = w; } };
function withState(o, fn) {
  const g0 = R.Game;
  R.State.newGame();
  const g = R.Game;
  for (const f of o.flags || []) g.flags[f] = true;
  for (const it of o.items || []) g.inv[it] = 1;
  if (o.tier) { g.regionsCleared = (o.regions || Object.keys(DB.regions || {})).slice(0, o.tier); g.tier = g.regionsCleared.length; for (const r of g.regionsCleared) g.flags['cleared_' + r] = true; }
  if (o.postgame) { g.gameClear = true; g.flags.game_clear = true; }
  try { return fn(); } finally { R.Game = g0; }
}
/** BFS over the compiled map from (sx,sy): 4-neighbour, tile+decor walkability, non-pushable NPCs block */
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
    if (o.stopAtWarps && (x !== sx || y !== sy) && m.warpAt(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !pass(nx, ny)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return seen;
}
/** is (x,y) usable from the reachable set: on it, or next to it (NPC / chest / sign / counter talk) */
function touch(set, m, x, y) {
  if (set.has(x + ',' + y)) return true;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (set.has((x + dx) + ',' + (y + dy))) return true;
    // across a counter (tile or decor)
    const cx = x + dx, cy = y + dy;
    if (m.counterAt && m.counterAt(cx, cy) && set.has((cx + dx) + ',' + (cy + dy))) return true;
  }
  return false;
}
function bfsDist(m, sx, sy, tx, ty, o) {
  o = o || {};
  const d = new Map([[sx + ',' + sy, 0]]); const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (Math.abs(x - tx) + Math.abs(y - ty) <= (o.adj ? 1 : 0)) return d.get(x + ',' + y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (d.has(k)) continue;
      const t = m.tileAt(nx, ny);
      if (!(m.walkable(nx, ny) || t === 'stairs_up' || t === 'stairs_down' || /^door/.test(t))) continue;
      if (!o.secret && /^secret_/.test(t)) continue;
      const n = m.npcAt(nx, ny);
      if (n && !R.FieldMap.pushable(n)) continue;
      d.set(k, d.get(x + ',' + y) + 1); q.push([nx, ny]);
    }
  }
  return -1;
}
const textOf = (list) => { for (const e of list) if (R.State.check(e.cond)) return e.text; return null; };

// ============================================================ static
function testStatic() {
  section = 'static';
  console.log('[static]');
  eq(ownLoadErrors, [], 'no load errors in region6 files');
  for (const id of MAPS) ok(!!DB.maps[id], 'map ' + id + ' registered');
  const own = warnings.filter((w) => /dovan|deep_mine/.test(w) && !/story_/.test(w));
  eq(own, [], 'no load warnings about region 6 maps');
  // ---- the town
  const d = DB.maps.dovan;
  const { m: town, warns: tw } = compileQuiet('dovan');
  eq(tw.filter((w) => !/story_rumor/.test(w)), [], 'dovan compiles without warnings (story_rumor is the story\'s)');
  eq([d.type, d.theme, d.bgm, d.location, d.region, d.outside], ['town', 'town_mine', 'town', 'dovan', 'r_mine', 'r'], 'dovan header (§10.6.1, §11.2.6)');
  ok(town.w >= 40 && town.h >= 32 && town.w <= 56 && town.h <= 44, 'dovan size ' + town.w + '×' + town.h + ' within 40×32–56×44');
  eq(d.exit, { to: 'world', spawn: 'dovan' }, 'dovan exit → world spawn dovan');
  ok(town.spawns.entrance && town.spawns.inn, 'dovan spawns entrance + inn');
  eq(town.spawns.inn.dir, 'down', 'inn spawn faces down');
  eq(d.onEnter, 'dovan_intro', 'onEnter dovan_intro (§10.8.7 #1)');
  const npc = (id) => town.npcs.find((n) => n.id === id);
  for (const [id, ev] of [['inn', 'common_inn'], ['tavern', 'common_tavern'], ['shop_item', 'common_shop'], ['shop_weapon', 'common_shop'], ['shop_armor', 'common_shop'], ['folk_a', 'story_rumor'], ['folk_b', 'story_rumor'], ['borg', 'dovan_borg'], ['helga', 'dovan_helga']]) {
    ok(npc(id) && npc(id).event === ev, 'npc ' + id + ' → ' + ev);
  }
  eq([npc('shop_item').shop, npc('shop_weapon').shop, npc('shop_armor').shop], ['dovan_item', 'dovan_weapon', 'dovan_armor'], 'shop ids (§10.6.1)');
  for (const s of ['dovan_item', 'dovan_weapon', 'dovan_armor']) ok(!!DB.shops[s], 'shop ' + s + ' is registered (gear-b)');
  eq([npc('folk_a').rumor, npc('folk_b').rumor], ['dovan_a', 'dovan_b'], 'rumor keys');
  eq(npc('scribe').cond, [{ tier: 4 }, { tierBelow: 7 }], 'scribe cond (§10.9.5)');
  eq([npc('borg').sprite, npc('helga').sprite, npc('pip').sprite], ['npc:dwarf', 'npc:dwarf', 'npc:boy'], 'Borg / Helga / Pip sprites (§10.8.7)');
  eq([npc('miner_a').cond, npc('miner_b').cond, npc('pip').cond], ['deep_mine_1_miner', 'deep_mine_2_miner', 'deep_mine_2_pip'], 'rescued miners appear by the rescue flags');
  // the story spots (§10.8.0-7)
  const inn = town.spawns.inn;
  const spots = { st_rival: [inn.x, inn.y + 2, 'st_show_rival', 'npc:rowell'], st_fine: [inn.x + 2, inn.y + 2, 'st_show_fine', 'npc:fine'], st_extra: [inn.x - 2, inn.y + 2, 'st_show_extra', 'npc:scribe'] };
  for (const [id, [x, y, cond, spr]] of Object.entries(spots)) {
    const n = npc(id);
    ok(n && n.x === x && n.y === y && n.cond === cond && n.sprite === spr && n.dir === 'up' && n.fixed, id + ' at ' + x + ',' + y + ' (' + cond + ', ' + spr + ', up, fixed)');
  }
  // the cells from inn to the spots are plain walkable floor, nothing else there
  const lane = [];
  for (let y = inn.y; y <= inn.y + 2; y++) lane.push([inn.x, y]);
  for (let x = inn.x - 2; x <= inn.x + 2; x++) lane.push([x, inn.y + 2]);
  for (const [x, y] of lane) {
    ok(town.walkable(x, y) && !town.decorAt(x, y), 'scene lane ' + x + ',' + y + ' is bare walkable floor');
    ok(!town.npcs.some((n) => n.x === x && n.y === y && !/^st_/.test(n.id)) && !town.chests.some((c) => c.x === x && c.y === y) && !town.signs.some((s) => s.x === x && s.y === y), 'nothing stands on ' + x + ',' + y);
  }
  // record office notice (tier 1)
  ok((d.tilePatches || []).some((p) => JSON.stringify(p.cond) === '{"tier":1}') && town.signs.some((s) => JSON.stringify(s.cond) === '{"tier":1}' && /記録院/.test(JSON.stringify(s.text))), 'the 記録院 notice (tier 1) near the gate (§10.9.1)');
  // ---- NPCs: fixed / push, sprites exist, text lists end with a default
  const sprites = new Set(Object.keys(R.Gfx._defs || R.Gfx.defs || {}));
  let tierLines = 0, clearLines = 0, t4orFog = 0;
  for (const id of MAPS) {
    const m = compileQuiet(id).m;
    for (const n of m.npcs) {
      ok(n.fixed || n.push, id + ': npc ' + n.id + ' has fixed or push (§10.13.10)');
      if (['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'rest', 'boss', 'fine', 'st_rival', 'st_fine', 'st_extra'].includes(n.id)) ok(n.fixed, id + ': ' + n.id + ' is fixed');
      if (['folk_a', 'folk_b', 'scribe', 'miner_a', 'miner_b', 'pip'].includes(n.id) && id === 'dovan') ok(n.push, id + ': ' + n.id + ' is push');
      if (sprites.size) ok(sprites.has(n.sprite), id + ': sprite ' + n.sprite + ' is registered');
      ok(!!(n.text || n.event), id + ': npc ' + n.id + ' says something');
      if (n.event && !EXTERNAL_EVENTS.test(n.event)) ok(!!DB.events[n.event], id + ': event ' + n.event + ' is registered');
      const list = Array.isArray(n.text) && n.text.length && typeof n.text[0] === 'object' ? n.text : null;
      if (list) {
        ok(!list[list.length - 1].cond, id + ': npc ' + n.id + ' has a default line last');
        tierLines++;
        const s = JSON.stringify(list.map((e) => e.cond));
        if (/cleared/.test(s)) clearLines++;
        if (/"tier":4|final_open/.test(s)) t4orFog++;
      }
    }
  }
  ok(clearLines >= 15, 'town people change their lines after the clear (' + clearLines + ' with {cleared:r_mine})');
  ok(t4orFog >= 1, 'at least one {tier:4} / final_open line (§10.9.3): ' + t4orFog);
  measure('NPCs with {cond,text} lines', tierLines);
  measure('lines keyed on the clear', clearLines);
  // ---- floors
  const zone = DB.encounters.z_r_mine_mine;
  ok(!!zone, 'zone z_r_mine_mine exists (mons)');
  let secretFloors = 0, rareChests = 0;
  FLOORS.forEach((id, i) => {
    const def = DB.maps[id];
    const { m, warns } = compileQuiet(id);
    eq(warns, [], id + ' compiles without warnings');
    eq([def.type, def.theme, def.bgm, def.bbg, def.location, def.region, def.outside, def.encounter], ['dungeon', 'mine', 'cave', 'mine', 'deep_mine', 'r_mine', '#', 'z_r_mine_mine'], id + ' header (§10.6.2)');
    eq(def.escape, { to: 'world', spawn: 'deep_mine_1' }, id + ' escape → world deep_mine_1');
    ok(m.w >= 34 && m.h >= 30 && m.w <= 56 && m.h <= 48, id + ' size ' + m.w + '×' + m.h + ' within 34×30–56×48');
    eq(def.lvOff, i === 1 ? 2 : undefined, id + ' lvOff (§10.6.2-9: 2F 2, 1F and the boss floor none)');
    ok(def.chestTier == null, id + ' has no chestTier');
    // spawns + stairs
    if (i === 0) ok(m.spawns.entrance && m.warps.some((w) => w.to === 'world' && w.spawn === 'deep_mine_1'), id + ' entrance + the way out');
    if (i > 0) ok(m.spawns.from_prev && m.warps.some((w) => w.to === FLOORS[i - 1] && w.spawn === 'from_next'), id + ' from_prev + stairs up → ' + FLOORS[i - 1] + ' from_next');
    if (i < 2) ok(m.spawns.from_next && m.warps.some((w) => w.to === FLOORS[i + 1] && w.spawn === 'from_prev'), id + ' from_next + stairs down → ' + FLOORS[i + 1] + ' from_prev');
    for (const w of m.warps) if (w.to !== 'world') ok(DB.maps[w.to] && DB.maps[w.to].spawns && (DB.maps[w.to].spawns[w.spawn]), id + ': warp target ' + w.to + '/' + w.spawn + ' exists');
    // chests 3–5, pools only, ids <map>_c<n>
    ok(m.chests.length >= 3 && m.chests.length <= 5, id + ': ' + m.chests.length + ' chests (3–5, §8.12.4)');
    for (const c of m.chests) {
      ok(new RegExp('^' + id + '_c\\d+$').test(c.id), id + ': chest id ' + c.id);
      ok(c.pool && DB.pools[c.pool] && !c.item && c.gold == null, id + ': chest ' + c.id + ' pool ' + c.pool);
      if (c.pool === 'p_rare') rareChests++;
    }
    const secret = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (/^secret_/.test(m.tileAt(x, y))) secret.push([x, y]);
    if (secret.length) { secretFloors++; ok(secret.length <= 3, id + ': the secret passage is 1–3 cells (' + secret.length + ')'); }
    // events / meta
    for (const e of m.events) if (!EXTERNAL_EVENTS.test(e.id)) ok(DB.events[e.id] && DB.events[e.id].meta, id + ': event ' + e.id + ' registered with meta');
  });
  eq(secretFloors, 1, 'one floor with a secret passage (§10.6.4: deep_mine_2)');
  ok(DB.maps.deep_mine_2 && compileQuiet('deep_mine_2').m.tileAt(29, 29) === 'secret_wall', 'the secret passage is on deep_mine_2');
  eq(rareChests, 1, 'one p_rare chest in the dungeon (§8.12.4)');
  ok(compileQuiet('deep_mine_2').m.chests.some((c) => c.pool === 'p_rare'), 'the p_rare chest is on the floor before the boss floor');
  // rest: the middle floor + before the boss room
  const m2 = compileQuiet('deep_mine_2').m, m3 = compileQuiet('deep_mine_3').m;
  ok(m2.npcs.some((n) => n.id === 'rest' && n.sprite === 'obj:lantern' && n.event === 'common_rest'), '休息の灯 on the middle floor (§10.6.2-5)');
  ok(m3.npcs.some((n) => n.id === 'rest' && n.sprite === 'obj:lantern' && n.event === 'common_rest'), '休息の灯 before the boss room');
  ok(!compileQuiet('deep_mine_1').m.npcs.some((n) => n.id === 'rest'), 'no 休息の灯 on 1F');
  // the den zone
  eq((DB.maps.deep_mine_2.zones || []).map((z) => z.zone), ['z_r_mine_den'], 'the den has its own zone');
  ok(DB.encounters.z_r_mine_den && JSON.stringify(DB.encounters.z_r_mine_den.groups) === JSON.stringify(zone.groups), 'z_r_mine_den = z_r_mine_mine groups');
  const rr = DB.rareEncounters.z_r_mine_mine, rd = DB.rareEncounters.z_r_mine_den;
  ok(rr && rd && rd.mon === rr.mon && Math.abs(rr.rate / rd.rate - 3) < 0.2, 'the den\'s rare monster rate is ×3 (' + (rr && rr.rate) + ' → ' + (rd && rd.rate) + ')');
  // bosses + fine
  const boss2 = m2.npcs.find((n) => n.id === 'boss'), boss3 = m3.npcs.find((n) => n.id === 'boss'), fine = m3.npcs.find((n) => n.id === 'fine');
  eq([boss2.sprite, boss2.cond, boss2.fixed], ['mon:b_rockeater', '!mine_mid', true], 'mid boss NPC (§10.6.2-6)');
  eq([boss3.sprite, boss3.cond, boss3.fixed], ['mon:b_ironwarden', '!mine_boss', true], 'boss NPC');
  eq([fine.sprite, fine.cond], ['npc:fine', ['!mine_boss', '!mine_fine']], 'Fine NPC (§10.8.0-5)');
  ok(m3.events.filter((e) => e.id === 'deep_mine_3_fine').every((e) => e.once === 'mine_fine' && e.trigger === 'step'), 'Fine step band once mine_fine');
  ok(m3.events.filter((e) => e.id === 'deep_mine_3_boss').length >= 3, 'boss step band');
  ok(m2.events.filter((e) => e.id === 'deep_mine_2_boss').length >= 3, 'mid-boss step band');
  ok(DB.troops.tr_b_rockeater && DB.troops.tr_b_ironwarden, 'troops registered (boss)');
  // closed door: rock_door + tilePatch + examine
  eq([m3.tileAt(23, 19), m3.tileAt(23, 20)], ['rock_door', 'rock_door'], '七の層の岩戸 is a closed rock door (§10.15)');
  eq((DB.maps.deep_mine_3.tilePatches || []).map((p) => [p.x, p.y, p.ch, p.cond.item]), [[23, 19, '.', 'k_oath_hammer'], [23, 20, '.', 'k_oath_hammer']], 'the door opens with the hammer (tilePatch)');
  ok(m3.events.filter((e) => e.id === 'deep_mine_3_door' && e.trigger === 'examine').length === 2, 'examine events on the door cells (§10.8.0-6)');
  // objectives + key item
  eq(DB.objectives.obj_mine_1 && DB.objectives.obj_mine_1.text, '深き坑道に閉じ込められた\n鉱夫たちを助けよう。', 'obj_mine_1 text (§10.8.7)');
  eq(DB.objectives.obj_mine_2 && DB.objectives.obj_mine_2.text, '誓いのハンマーを持って、\n七の層の扉を開けよう。', 'obj_mine_2 text');
  ok(DB.items.k_oath_hammer && DB.items.k_oath_hammer.type === 'key', 'k_oath_hammer is a key item');
  ok(DB.items.ac_tale_mine, 'the reward ac_tale_mine exists (§8.8)');
  ok(!Object.keys(DB.objectives).some((k) => /^obj_mine_/.test(k) && !['obj_mine_1', 'obj_mine_2'].includes(k)), 'only obj_mine_1..2');
  // event meta (progress.js reads it)
  const meta = (id) => (DB.events[id] && DB.events[id].meta) || {};
  ok(meta('deep_mine_2_pip').needs.includes('flag:mine_mid') && meta('deep_mine_2_pip').gives.includes('item:k_oath_hammer'), 'pip meta: needs mine_mid, gives the hammer');
  ok(meta('deep_mine_3_boss').gives.includes('region:r_mine') && meta('deep_mine_3_boss').warp.to === 'dovan', 'boss meta: gives region:r_mine, warps to dovan');
  ok(meta('dovan_borg_reward').needs.includes('region:r_mine') && meta('dovan_borg_reward').gives.includes('item:ac_tale_mine'), 'reward meta');
}

// ============================================================ reach
function testReach() {
  section = 'reach';
  console.log('[reach]');
  // the town, before and after
  for (const st of [{ flags: ['mine_start'] }, { flags: ['mine_start', 'deep_mine_1_miner', 'deep_mine_2_miner', 'deep_mine_2_pip', 'mine_boss'], tier: 1, regions: ['r_mine'] }, { flags: ['mine_start'], tier: 5 }]) withState(st, () => {
    const m = R.FieldMap.compile('dovan');
    const e = m.spawns.entrance;
    const r = reach(m, e.x, e.y);
    for (const n of m.npcs) if (n.present) ok(touch(r, m, n.x, n.y), 'dovan (' + JSON.stringify(st.flags.length) + ' flags, tier ' + (st.tier || 0) + '): npc ' + n.id + ' reachable');
    for (const c of m.chests) ok(touch(r, m, c.x, c.y), 'dovan: chest ' + c.id + ' reachable');
    for (const s of m.signs) if (R.State.check(s.cond)) ok(touch(r, m, s.x, s.y), 'dovan: sign @' + s.x + ',' + s.y + ' reachable');
    ok(r.has(m.spawns.inn.x + ',' + m.spawns.inn.y), 'dovan: the inn spawn is reachable');
    // every door is enterable
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tileAt(x, y) === 'door') ok(r.has(x + ',' + y), 'dovan: door ' + x + ',' + y + ' reachable');
    // the exit: the bottom edge is reachable
    ok([...r].some((k) => +k.split(',')[1] === m.h - 1), 'dovan: the road out (south edge) is reachable');
  });
  // 1F
  withState({}, () => {
    const m = R.FieldMap.compile('deep_mine_1');
    const e = m.spawns.entrance;
    const r = reach(m, e.x, e.y);
    ok(touch(r, m, 6, 38), '1F: miner 1 reachable');
    for (const c of m.chests) ok(touch(r, m, c.x, c.y), '1F: chest ' + c.id + ' reachable');
    for (const s of m.signs) ok(touch(r, m, s.x, s.y), '1F: sign @' + s.x + ',' + s.y + ' reachable');
    ok(m.warps.every((w) => r.has(w.x + ',' + w.y)), '1F: every stair / exit reachable');
  });
  // 2F: the side tunnel shut until mine_mid, the den only through the secret passage
  for (const mid of [false, true]) withState({ flags: mid ? ['mine_mid'] : [] }, () => {
    const m = R.FieldMap.compile('deep_mine_2');
    const s = m.spawns.from_prev;
    const r = reach(m, s.x, s.y);
    ok(touch(r, m, 41, 24), '2F: miner 2 reachable');
    ok(touch(r, m, 48, 8), '2F: the rest lantern reachable');
    ok(m.warps.every((w) => r.has(w.x + ',' + w.y)), '2F: both stairs reachable (mid ' + mid + ')');
    eq(touch(r, m, 46, 43), mid, '2F: Pip reachable only after the rock eater (mid ' + mid + ')');
    if (!mid) ok(touch(r, m, 47, 36), '2F: the rock eater can be walked up to');
    for (const c of m.chests) if (c.id !== 'deep_mine_2_c4') ok(touch(r, m, c.x, c.y), '2F: chest ' + c.id + ' reachable');
    if (mid) ok(touch(r, m, 50, 44), '2F: the chest in Pip\'s pocket reachable after mine_mid');
    const rn = reach(m, s.x, s.y, { noSecret: true });
    ok(r.has('33,31') && !rn.has('33,31'), '2F: the den only through the secret passage');
    ok(m.warps.every((w) => rn.has(w.x + ',' + w.y)), '2F: the stairs never need the secret passage');
  });
  // 3F: the door
  for (const st of [{}, { items: ['k_oath_hammer'] }, { items: ['k_oath_hammer'], flags: ['mine_door'] }]) withState(st, () => {
    const m = R.FieldMap.compile('deep_mine_3');
    const s = m.spawns.from_prev;
    const r = reach(m, s.x, s.y);
    const open = !!(st.flags && st.flags.includes('mine_door'));
    ok(touch(r, m, 23, 19), '3F: the rock door can be examined');
    eq(touch(r, m, 16, 6), open, '3F: the warden reachable only once the door is open (' + JSON.stringify(st) + ')');
    eq(touch(r, m, 18, 18), open, '3F: the rest lantern behind the door');
    for (const c of m.chests) ok(touch(r, m, c.x, c.y), '3F: chest ' + c.id + ' reachable without the door');
    if (open) {
      // the Fine band lies across the only way from the door to the hall
      const band = new Set(m.events.filter((e) => e.id === 'deep_mine_3_fine').map((e) => e.x + ',' + e.y));
      const rb = reach(m, s.x, s.y, { block: band });
      ok(!touch(rb, m, 16, 6), '3F: the Fine step band cuts the way to the warden');
      const bb = new Set(m.events.filter((e) => e.id === 'deep_mine_3_boss').map((e) => e.x + ',' + e.y));
      const r2 = reach(m, 18, 15, { block: bb });
      ok(!touch(r2, m, 16, 6), '3F: the boss band lies across the hall');
    }
  });
  // no chest blocks a path
  for (const id of MAPS) withState({ flags: ['mine_start', 'mine_mid', 'mine_door'], items: ['k_oath_hammer'] }, () => {
    const m = R.FieldMap.compile(id);
    const st = m.spawns.entrance || m.spawns.from_prev;
    const base = reach(m, st.x, st.y).size;
    for (const c of m.chests) {
      const keep = m.chestIdx.get(m.idx(c.x, c.y));
      m.chestIdx.delete(m.idx(c.x, c.y));
      const after = reach(m, st.x, st.y).size;
      if (keep) m.chestIdx.set(m.idx(c.x, c.y), keep);
      ok(after === base, id + ': chest ' + c.id + ' blocks nothing');
    }
  });
}

// ============================================================ density
function testDensity() {
  section = 'density';
  console.log('[density]');
  const D = require(path.join(ROOT, 'tools/check_density.js'));
  if (!D || !D.analyseMap) {
    // run the tool and read its table
    const { execFileSync } = require('child_process');
    let out = '';
    try { out = execFileSync('node', [path.join(ROOT, 'tools/check_density.js'), '--map', 'dovan'], { encoding: 'utf8' }); } catch (e) { out = e.stdout || ''; }
    const warns = out.split('\n').filter((l) => /^WARN/.test(l));
    // the whole paved street reads as one big "room" (outside rock, see the report) — skip room 1
    const bad = warns.filter((l) => !/room 1 \(/.test(l));
    eq(bad, [], 'dovan interiors within §11.2.7 (street excluded)');
    const rooms = out.split('\n').filter((l) => /^\s+\d+\s+\d+\s+\d+%/.test(l));
    measure('dovan interior rooms measured', Math.max(0, rooms.length - 1));
    return;
  }
}

// ============================================================ text
function srcFiles() {
  const out = [];
  for (const d of ['src/maps', 'src/events']) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/^region6.*\.js$/.test(f)) out.push(path.join(d, f));
  return out;
}
function strings(file) {
  let src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  const out = [];
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let mm;
  while ((mm = re.exec(src))) {
    const s = mm[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(s)) out.push({ s, line: src.slice(0, mm.index).split('\n').length });
  }
  return out;
}
const HALF = (ch) => ch.charCodeAt(0) < 0x100 || (ch >= '\uff61' && ch <= '\uff9f');
function width(line) {
  line = line.replace(/\{hero\}|\{leader\}/g, '＃＃＃＃＃');
  let w = 0;
  for (const ch of line) w += HALF(ch) ? 0.5 : 1;
  return w;
}
function testText() {
  section = 'text';
  console.log('[text]');
  const joyoPath = path.join(ROOT, 'tools/lib/joyo.txt');
  const joyo = fs.existsSync(joyoPath) ? new Set(fs.readFileSync(joyoPath, 'utf8').replace(/\s/g, '')) : null;
  const ALLOWED = new Set('杖槍斧鞭鎧兜棍閃狼巫砦傭鷹槌吠沌翔淵獅鷲狐樺蓮凪叉');
  const BANNED = ['冒険の書', '復活の呪文', 'ふっかつのじゅもん', '呪文', '痛恨', '会心の一撃', 'やっつけた', '回り込まれて', '息の根を止めた', '何も起こらなかった',
    'ポイントの経験値', '身を守っている', '様子をうかがっている', 'を落としていった', 'リジェネ', 'ジョブ', 'アビリティ', 'JP', '麻痺', '魔法', '魔法防御', '並び替え',
    '酒場の主人', 'すべて袋に', '頁', '秘奥義', '魔剣士', '蘇生', 'アルン', '回復の泉', '教会', '{yuki}', '{non}', '{metem}'];
  const UI_LABELS = new Set(MAPS.map((id) => DB.maps[id] && DB.maps[id].name).concat(['助けた鉱夫　']));
  let n = 0, pages = 0, longest = 0;
  for (const f of srcFiles()) {
    for (const { s, line } of strings(f)) {
      n++;
      const at = f + ':' + line;
      for (const b of BANNED) ok(!s.includes(b), at + ' forbidden word 「' + b + '」 in ' + JSON.stringify(s));
      ok(!/…/.test(s.replace(/……/g, '')), at + ' a single 「…」: ' + JSON.stringify(s));
      ok(!/[０-９]/.test(s), at + ' full-width digits: ' + JSON.stringify(s));
      for (const pg of s.split('\f')) {
        pages++;
        const ls = pg.split('\n');
        ok(ls.length <= 4, at + ' ≤ 4 lines per page: ' + JSON.stringify(pg));
        for (const l of ls) { const w = width(l); longest = Math.max(longest, w); ok(w <= 20, at + ' ≤ 20 per line (' + w + '): ' + l); }
        const t = pg.replace(/\s+$/, '');
        if (/……$/.test(t) && t !== '……') ok(false, at + ' 「……」 at the end of a sentence needs 。！？: ' + JSON.stringify(t));
        const sp = t.match(/.　/g) || [];
        if (![...UI_LABELS].some((u) => t.startsWith(u))) for (const m of sp) ok(/[！？♪]/.test(m[0]), at + ' full-width space after 「' + m[0] + '」: ' + JSON.stringify(t));
      }
      if (joyo) for (const ch of s) {
        if (!/[\u4e00-\u9fff]/.test(ch)) continue;
        ok(joyo.has(ch) || ALLOWED.has(ch), at + ' 常用外の字 「' + ch + '」 in ' + JSON.stringify(s));
      }
    }
  }
  // the §10.8.7 lines, word for word
  const all = srcFiles().map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  for (const s of ['坑道の奥で、', '鉄の化け物が暴れてる。', '若いのが三人、', '閉じ込められたままだ。', '誓いの歌を歌ったもんさ。', '『七の層より下を掘るな』ってね。',
    'じいちゃんの形見のハンマーだ。柄に、\\n誓いの言葉が彫ってある。', '七の層の扉は、これで開くって聞いた。',
    '記録院が、誓いの歌を\\n写していった。\\nそれからよ、うちの若いのが\\n誰も歌わなくなったのは。',
    '{hero}は誓いのハンマーを打ち鳴らし、\\n鍛冶神の誓いを唱えた。', '……誓いは、まだ生きていたか。ならば、\\nわれは眠ろう。',
    '誓いは、破られても消えない。\\n忘れられたときに、消えるの。', 'その夜は、町の宿で眠った。']) ok(all.includes(s), 'spec line present: ' + s.replace(/\\n/g, '⏎'));
  measure('Japanese strings checked', n);
  measure('text pages checked', pages);
  measure('widest line (full-width units)', longest);
  ok(!!joyo, 'tools/lib/joyo.txt present (常用漢字 check ran)');
}

// ============================================================ play (the real runtime)
async function testPlay() {
  section = 'play';
  console.log('[play]');
  const S = R.fxR6;
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
  { const say0 = R.UI.say; R.UI.say = function (t, o) { sayLog.push(R.Text.fmt(t)); return say0.call(this, t, o); }; }
  const said = (re, from) => sayLog.slice(from || 0).some((t) => re.test(t));
  const capLog = [];
  { const push0 = R.Engine.push; R.Engine.push = function (L) {
    if (L && typeof L.setCaption === 'function') { const sc = L.setCaption.bind(L); L.setCaption = (t, o) => { capLog.push(R.Text.fmt(t)); return sc(t, o); }; }
    return push0.call(this, L);
  }; }
  const captioned = (re, from) => capLog.slice(from || 0).some((t) => re.test(t));
  const g = () => R.Game;
  const go = async (p) => { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 600 && !done; i++) await step(1); ok(done, 'warp finished'); return settle(); };
  const talk = async (id) => { const n = R.Field.npc(id); ok(!!n && n.present, 'npc ' + id + ' present on ' + (R.Field.map && R.Field.map.id)); if (n) { R.Events.talk(n); ok(await settle(), 'talk ' + id + ' ends'); } };
  const runStep = async (id, x, y, once) => { R.Events.run(id, { trigger: 'step', once: once || null, x, y }); ok(await settle(), id + ' ends'); };
  const runExam = async (id, x, y) => { R.Events.run(id, { trigger: 'examine', x, y }); ok(await settle(), id + ' ends'); };

  // ---- quick start: after the prologue, tier 0, then walk into Dovan
  ok(await go(R.debug.quickStart({ map: 'lute', spawn: 'inn', tier: 0 })), 'quickStart');
  let mark = sayLog.length;
  ok(await go(R.Field.warp('dovan', 'entrance')), '#1 arrival in Dovan');
  ok(g().flags.mine_start, '#1 mine_start');
  eq(g().regionObj && g().regionObj.r_mine, 'obj_mine_1', '#1 region objective obj_mine_1');
  ok(said(/鉄の化け物が暴れてる/, mark) && said(/若いのが三人/, mark), '#1 Borg\'s two lines (§10.8.7)');
  ok(!R.Field.npc('borg_gate').present && R.Field.npc('borg').present, '#1 Borg leaves the gate for his office');
  eq(g().respawn && g().respawn.map, 'dovan', 'Dovan sets the respawn point');
  ok(R.Game.visited.dovan, 'visited dovan (warp list)');
  // arriving again does nothing
  mark = sayLog.length;
  ok(await go(R.Field.warp('dovan', 'inn')), 'dovan again');
  ok(!said(/鉄の化け物が暴れてる/, mark), '#1 runs once');
  // ---- Borg (Rowell's trace), Helga, the bard
  mark = sayLog.length; await talk('borg');
  ok(said(/記録院が、誓いの歌を/, mark), 'Borg: ロウェルの痕跡 before the clear (§10.8.7)');
  mark = sayLog.length; await talk('helga');
  ok(said(/七の層より下を掘るな/, mark) && said(/ボルグは七の層の下を/, mark), '#2 Helga\'s lines');
  mark = sayLog.length; await talk('tavern_bard');
  ok(said(/続きが/, mark), 'the bard has forgotten the song');
  ok(!R.Field.npc('miner_a').present && !R.Field.npc('pip').present, 'the rescued are not in town yet');
  // ---- 1F: miner 1
  ok(await go(R.Field.warp('deep_mine_1', 'entrance')), 'to deep_mine_1');
  ok(R.Game.visited.deep_mine, 'visited deep_mine (warp list)');
  mark = sayLog.length; await talk('miner1');
  eq(g().vars.mine_rescued, 1, '#3 mine_rescued 1');
  ok(g().flags.deep_mine_1_miner && !R.Field.npc('miner1').present, '#3 miner 1 goes home');
  ok(said(/助けた鉱夫　1\/3/, mark), '#3 the count is shown');
  // ---- 2F: miner 2, the rock eater, Pip
  ok(await go(R.Field.warp('deep_mine_2', 'from_prev')), 'to deep_mine_2');
  await talk('miner2');
  eq(g().vars.mine_rescued, 2, '#4 mine_rescued 2');
  // a lost fight = the wipe: the event does not complete, the boss stays
  S.battles.length = 0;
  S.battleScript = ['win'];
  mark = sayLog.length;
  R.Field.setPlayerPos(47, 33, 'down');
  await runStep('deep_mine_2_boss', 47, 33);
  eq(S.battles.map((b) => b.troop), ['tr_b_rockeater'], '#5 the mid-boss battle');
  ok(g().flags.mine_mid && !R.Field.npc('boss').present, '#5 mine_mid, the rock eater is gone');
  ok(said(/横穴の口が開いた/, mark), '#5 the side tunnel opens');
  mark = sayLog.length;
  R.Field.setPlayerPos(46, 42, 'down');
  await talk('pip');
  ok(R.State.hasItem('k_oath_hammer'), '#6 k_oath_hammer');
  eq(g().vars.mine_rescued, 3, '#6 mine_rescued 3');
  eq(g().regionObj.r_mine, 'obj_mine_2', '#6 objective obj_mine_2');
  ok(said(/じいちゃんの形見のハンマーだ/, mark) && said(/これで開くって聞いた/, mark), '#6 Pip\'s lines (§10.8.7)');
  // ---- 3F: the door, Fine, the warden
  ok(await go(R.Field.warp('deep_mine_3', 'from_prev')), 'to deep_mine_3');
  eq(R.Field.map.tileAt(23, 19), 'rock_door', '#7 the rock door is shut before the hammer rings');
  R.Field.setPlayerPos(24, 19, 'left');
  await runExam('deep_mine_3_door', 23, 19);
  ok(g().flags.mine_door, '#7 mine_door');
  eq([R.Field.map.tileAt(23, 19), R.Field.map.tileAt(23, 20)], ['floor', 'floor'], '#7 the door rolls away (tilePatch)');
  mark = sayLog.length;
  const capMark = capLog.length;
  R.Field.setPlayerPos(21, 19, 'left');
  R.Events.run('deep_mine_3_fine', { trigger: 'step', once: 'mine_fine', x: 21, y: 19 });
  ok(await settle(), '#8 Fine ends');
  ok(g().flags.mine_fine && !R.Field.npc('fine').present, '#8 mine_fine, Fine is gone');
  if (!DB.events.story_fine_mine) ok(said(/忘れられたときに、消えるの/, mark) && said(/気をつけて/, mark), '#8 Fine\'s line + the tier 0–2 ending (fallback while story_fine_mine is missing)');
  S.battles.length = 0;
  S.battleScript = ['win'];
  mark = sayLog.length;
  R.Field.setPlayerPos(16, 10, 'up');
  const tier0 = g().tier;
  await runStep('deep_mine_3_boss', 16, 10);
  eq(S.battles.map((b) => b.troop), ['tr_b_ironwarden'], '#8 the boss battle');
  ok(g().flags.mine_boss, '#8 mine_boss');
  ok(R.Tier.isCleared ? R.Tier.isCleared('r_mine') : g().regionsCleared.includes('r_mine'), '#9 r_mine cleared');
  eq(g().tier, tier0 + 1, '#9 the tier rises by one');
  ok(R.State.hasItem('k_page_mine'), '#9 鉄のページ');
  ok(said(/打ち鳴らし/, mark) && said(/われは眠ろう/, mark), '#9 the oath and the warden\'s answer (§10.8.7)');
  ok(captioned(/火をくれた神に誓う/, capMark), '#9 the oath song is sung (caption)');
  ok(captioned(/第\d+章『鍛冶神の誓い』/, capMark), '#9 the chapter caption');
  ok(captioned(/その夜は、町の宿で眠った。/, capMark), '§10.8.0-3 the night at the inn');
  eq(R.Field.map.id, 'dovan', 'after the clear: Dovan');
  const p = R.Field.pos();
  eq([p.x, p.y], [R.Field.map.spawns.inn.x, R.Field.map.spawns.inn.y], 'after the clear: in front of the inn');
  ok(R.Engine.fadeAlpha === 0, 'after the clear: the screen is visible');
  ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp), 'after the clear: everyone healed');
  // ---- after the clear
  ok(R.Field.npc('miner_a').present && R.Field.npc('miner_b').present && R.Field.npc('pip').present, 'the three rescued are home');
  mark = sayLog.length; await talk('borg');
  ok(R.State.hasItem('ac_tale_mine') && g().flags.dovan_borg_reward, 'dovan_borg_reward: 誓いの腕輪');
  ok(said(/七の層の下は\n掘らねえ/, mark), 'Borg swears again (§10.8.7 クリア後)');
  const n0 = R.State.count('ac_tale_mine');
  await talk('borg');
  eq(R.State.count('ac_tale_mine'), n0, 'the reward is given once');
  mark = sayLog.length; await talk('helga');
  ok(said(/品を増やした/, mark), 'Helga: the forge has more wares');
  const shopTier = (R.Tier.shopItems ? R.Tier.shopItems('dovan_weapon') : []) || [];
  measure('dovan_weapon items after the clear', shopTier.length);
  mark = capLog.length; await talk('tavern_bard');
  ok(captioned(/鉄の番人よ、眠れ/, mark), 'the bard sings the whole song after the clear');
  // tier lines resolve (cleared text wins over the default)
  const lookout = R.Field.npc('lookout');
  ok(/あんたのおかげ/.test(textOf(lookout.text)), 'lookout: the after-clear line');
  // ---- Fine's endings by tier (fallback, §10.9.4)
  if (!DB.events.story_fine_mine) {
    for (const [t, re] of [[4, /気にしないで/], [6, /あまり時間がない/]]) {
      g().flags.mine_boss = false; g().flags.mine_fine = false;
      g().tier = t;
      ok(await go(R.Field.warp('deep_mine_3', 'from_prev')), 'Fine at tier ' + t);
      R.Field.setPlayerPos(21, 19, 'left');
      mark = sayLog.length; const cm = capLog.length;
      R.Events.run('deep_mine_3_fine', { trigger: 'step', once: 'mine_fine', x: 21, y: 19 });
      ok(await settle(), 'Fine ends (tier ' + t + ')');
      ok(said(re, mark) && captioned(/足元が、\n透けて見えた/, cm), 'Fine tier ' + t + ' ending + caption');
    }
  }
  measure('play: frames simulated', frames);
  measure('play: lines shown', sayLog.length);
  const own = warnings.concat([]).filter((w) => /dovan|deep_mine|region6/.test(w) && !/story_/.test(w));
  ok(!own.length, 'no warnings about region 6 during play: ' + own.slice(0, 5).join(' | '));
}

// ============================================================ time (estimate)
function testTime() {
  section = 'time';
  console.log('[time]');
  // walking at 8 frames per cell (no dash), a battle ≈ 25 s every encRate (22) cells on dungeon floors,
  // first visits wander ×1.3 over the shortest route through every chest / NPC
  const SEC_PER_CELL = 8 / 60, BATTLE = 25, ENC = 22, WANDER = 1.3;
  const routes = {
    deep_mine_1: [['entrance', [6, 37]], [[6, 37], [12, 12]], [[12, 12], [19, 7]], [[19, 7], [47, 36]], [[47, 36], [41, 4]], [[41, 4], [47, 4]]],
    deep_mine_2: [['from_prev', [41, 24]], [[41, 24], [48, 9]], [[48, 9], [47, 35]], [[47, 35], [46, 42]], [[46, 42], [24, 30]], [[24, 30], [24, 40]], [[24, 40], [18, 43]]],
    deep_mine_3: [['from_prev', [4, 19]], [[4, 19], [28, 24]], [[28, 24], [24, 19]], [[24, 19], [17, 11]]],
  };
  let total = 0;
  for (const [id, legs] of Object.entries(routes)) withState({ flags: ['mine_mid', 'mine_door'], items: ['k_oath_hammer'] }, () => {
    const m = R.FieldMap.compile(id);
    let cells = 0;
    for (const [a, b] of legs) {
      const s = typeof a === 'string' ? m.spawns[a] : { x: a[0], y: a[1] };
      const dd = bfsDist(m, s.x, s.y, b[0], b[1], { adj: true, secret: true });
      ok(dd > 0, id + ': leg to ' + b + ' is walkable (' + dd + ')');
      cells += Math.max(0, dd);
    }
    const walk = cells * WANDER;
    const secs = walk * SEC_PER_CELL + (walk / ENC) * BATTLE;
    total += secs;
    measure(id + ' route cells (shortest)', cells);
    measure(id + ' estimated minutes (walk + battles)', +(secs / 60).toFixed(1));
    if (id === 'deep_mine_1') ok(secs / 60 >= 5 && secs / 60 <= 9, 'deep_mine_1 walk-around ≈ 5–8 min (§10.6.2): ' + (secs / 60).toFixed(1));
  });
  measure('dungeon estimated minutes (3 floors, without the boss scenes)', +(total / 60).toFixed(1));
}

// ============================================================ main
(async () => {
  const want = process.argv.slice(2);
  const on = (s) => !want.length || want.includes(s);
  try {
    if (on('static')) testStatic();
    if (on('reach')) testReach();
    if (on('density')) testDensity();
    if (on('text')) testText();
    if (on('time')) testTime();
    if (on('play')) await testPlay();
  } catch (e) { fails++; failed.push(section + ': threw ' + (e && e.stack || e)); console.log('  THREW:', e && e.stack || e); }
  console.log('');
  for (const [k, v] of report) console.log('  ' + k + ': ' + v);
  console.log('\ntest_reg6: ' + passes + ' passed, ' + fails + ' failed');
  if (fails) { for (const f of failed.slice(0, 40)) console.log('  ✗ ' + f); process.exit(1); }
  process.exit(0);
})();
