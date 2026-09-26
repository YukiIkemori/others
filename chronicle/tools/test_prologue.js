#!/usr/bin/env node
// Prologue tests (owner A18b; node, no DOM, exit 1 on failure). DESIGN §10.7 and the rules it points to.
//   static  — the six maps: ids, sizes, outside, location/region, spawns and the contracts other areas use,
//             NPC fixed/push, sprite keys, pool-only chests, events and their meta, decor sanity (§10.6, §10.13)
//   reach   — BFS on the compiled maps per story state: every NPC/counter/chest/stair the script needs is
//             reachable; the tower door holds until the key; the secret room only through the cracked wall;
//             no chest blocks a path (§10.6.2, §10.6.4, §12.2)
//   text    — every Japanese string in src/maps/prologue*.js and src/events/prologue*.js: 20 full-width per
//             line ({hero} = 5), 4 lines per page, 常用漢字 + the allowed list, forbidden words, 「……」 (STYLE_JA)
//   play    — the whole prologue on the real field + event runtime (stand-in screens for hero creation, the
//             tavern pick and battles): new game → P1 … P10 → prologue_done, with the flags, items, objectives
//             and party checked at every step; plus the branches (lost tutorial, tier lines, the free lodging)
//   time    — a walking-time estimate of the prologue (steps between the story points, battles per zone)
//
//   node tools/test_prologue.js              all sections
//   node tools/test_prologue.js text play    only the named sections
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FX = path.join(ROOT, 'tools/fixtures/prologue');

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(FX, 'node/stubs.js')] });
console.warn = origWarn;
const DB = R.DB;
const ownLoadErrors = R._nodeLoadErrors.filter((e) => /^src\/(maps|events)\/prologue/.test(e));

let fails = 0, passes = 0;
const failed = [];
let section = '';
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
const report = [];
const measure = (k, v) => { report.push([k, v]); };

const MAPS = ['roa_house', 'roa', 'lute', 'lighthouse_1', 'lighthouse_2', 'lighthouse_3'];
const EXTERNAL_EVENTS = /^(common_|story_)/; // world (A18a) and story (A19) scripts placed or called here

// ============================================================ helpers
const compileQuiet = (id) => { const w = R.warn; const out = []; R.warn = (...a) => out.push(a.join(' ')); try { return { m: R.FieldMap.compile(id), warns: out }; } finally { R.warn = w; } };
function withState(o, fn) {
  const g0 = R.Game;
  R.State.newGame();
  const g = R.Game;
  for (const f of o.flags || []) g.flags[f] = true;
  for (const it of o.items || []) g.inv[it] = 1;
  if (o.tier) { g.regionsCleared = Object.keys(DB.regions || {}).slice(0, o.tier); g.tier = g.regionsCleared.length; }
  if (o.postgame) { g.gameClear = true; g.flags.game_clear = true; }
  try { return fn(); } finally { R.Game = g0; }
}
/** BFS over the compiled map from (sx,sy): 4-neighbour, tile+decor walkability, fixed NPCs block */
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
/** some cell next to (x,y) (or across a counter) is in the reached set */
function touch(m, seen, x, y) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (seen.has((x + dx) + ',' + (y + dy))) return true;
    if (m.counterAt(x + dx, y + dy) && seen.has((x + 2 * dx) + ',' + (y + 2 * dy))) return true;
  }
  return false;
}

// ============================================================ static
function testStatic() {
  section = 'static';
  console.log('[static]');
  ok(!ownLoadErrors.length, 'no load errors in prologue files: ' + ownLoadErrors.join(' | '));
  for (const id of MAPS) ok(!!DB.maps[id], 'map ' + id + ' exists');
  const town = { roa: 'roa', lute: 'lute', roa_house: 'roa' };
  for (const id of MAPS) {
    const def = DB.maps[id];
    if (!def) continue;
    const { m, warns } = compileQuiet(id);
    const own = warns.filter((w) => !/story_rumor/.test(w));
    ok(!own.length, id + ': compiles without warnings ' + JSON.stringify(own));
    ok(def.outside != null, id + ': outside is set');
    ok(def.region === 'prologue', id + ': region prologue');
    ok(!def.hidden, id + ': no hidden items');
    const dungeon = /^lighthouse_/.test(id);
    if (dungeon) {
      eq(def.type, 'dungeon', id + ' type');
      eq(def.location, 'lighthouse', id + ' location');
      eq(def.escape, { to: 'world', spawn: 'lighthouse_1' }, id + ' escape');
      eq([def.theme, def.bgm, def.bbg], ['tower', 'tower', 'tower'], id + ' theme/bgm/bbg');
      eq(def.encounter, 'z_prologue_lighthouse', id + ' zone');
      ok(!!DB.encounters[def.encounter], id + ': zone exists');
      const big = m.w >= 34 && m.h >= 30;
      ok(big || def.outside === '#', id + ': ≥34×30 or a walled outside (' + m.w + '×' + m.h + ')');
    } else {
      eq(def.type, 'town', id + ' type');
      eq(def.location, town[id], id + ' location');
      ok(!!DB.locations[def.location], id + ': location registered');
      if (id !== 'roa_house') {
        ok(m.w >= 40 && m.h >= 32, id + ': town ≥ 40×32 (' + m.w + '×' + m.h + ')');
        eq(def.exit, { to: 'world', spawn: id }, id + ' exit to the world');
      } else ok(def.outside === '#' || def.outside === 'B', 'roa_house: walled outside');
    }
    // NPCs
    for (const n of m.npcs) {
      ok(n.fixed === true || n.push === true, id + ': npc ' + n.id + ' has fixed or push');
      ok(R.Gfx.has(n.sprite), id + ': npc ' + n.id + ' sprite ' + n.sprite + ' registered');
      if (n.event) ok(!!DB.events[n.event] || EXTERNAL_EVENTS.test(n.event), id + ': npc ' + n.id + ' event ' + n.event);
      ok(!!(n.event || n.text), id + ': npc ' + n.id + ' has text or an event');
      const t = DB.tiles[m.tileAt(n.x, n.y)] || {}, dd = m.decorDef(n.x, n.y);
      const person = /^(npc|party):/.test(n.sprite);
      if (person) ok(t.pass && (!dd || dd.pass), id + ': npc ' + n.id + ' stands on a walkable cell (' + m.tileAt(n.x, n.y) + ')');
      else ok(!!n.text || !!n.event, id + ': object ' + n.id + ' can be examined');
    }
    // chests
    const seenIds = new Set();
    for (const c of m.chests) {
      ok(new RegExp('^' + id + '_c\\d+$').test(c.id), id + ': chest id ' + c.id + ' is <map>_c<n>');
      ok(!seenIds.has(c.id), id + ': chest id unique ' + c.id); seenIds.add(c.id);
      ok(!c.item && !!c.pool && !!DB.pools[c.pool], id + ': chest ' + c.id + ' uses a pool (' + c.pool + ')');
      ok(m.walkable(c.x, c.y), id + ': chest ' + c.id + ' on floor');
    }
    // events
    for (const e of m.events) ok(!!DB.events[e.id], id + ': event ' + e.id + ' registered');
    if (def.onEnter) ok(!!DB.events[def.onEnter], id + ': onEnter ' + def.onEnter);
    // warps
    for (const w of m.warps) {
      ok(!!DB.maps[w.to], id + ': warp → ' + w.to);
      if (DB.maps[w.to] && w.to !== 'world') { const t = compileQuiet(w.to).m; ok(!!t.spawns[w.spawn], id + ': warp → ' + w.to + ' spawn ' + w.spawn); }
    }
    // decor sanity: wall decor on walls, furniture on floor
    if (m.decor) {
      let badWall = [], badFloor = [];
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const did = m.decorAt(x, y); if (!did) continue;
        const dd = DB.decor[did] || {}, t = m.tileAt(x, y), td = DB.tiles[t] || {};
        const wallTile = /wall|housewall|roof/.test(t);
        if (dd.wall && !wallTile) badWall.push(did + '@' + x + ',' + y);
        if (!dd.wall && wallTile) badFloor.push(did + '@' + x + ',' + y);
        if (!dd.wall && !wallTile && !td.pass && !/water/.test(t)) badFloor.push(did + '@' + x + ',' + y + ' on ' + t);
      }
      ok(!badWall.length, id + ': wall decor on wall tiles ' + badWall.join(' '));
      ok(!badFloor.length, id + ': floor decor on floor tiles ' + badFloor.join(' '));
    }
  }
  // contracts other areas rely on
  const sp = (id) => compileQuiet(id).m.spawns;
  for (const [id, names] of Object.entries({ roa_house: ['bed', 'entrance'], roa: ['entrance', 'berna_house', 'stone'], lute: ['entrance', 'inn', 'dock'],
    lighthouse_1: ['entrance', 'from_next'], lighthouse_2: ['from_prev', 'from_next'], lighthouse_3: ['from_prev'] })) {
    for (const n of names) ok(!!sp(id)[n], id + ': spawn ' + n);
  }
  const cfg = DB.config.start || {};
  ok(cfg.map === 'roa_house' && !!sp('roa_house')[cfg.spawn], 'DB.config.start is roa_house ' + cfg.spawn);
  const npc = (map, nid) => compileQuiet(map).m.npcs.filter((n) => n.id === nid);
  const roaE = sp('roa').entrance;
  const f = npc('roa', 'st_fine')[0], r = npc('roa', 'st_rival')[0];
  ok(f && f.y === roaE.y - 2 && Math.abs(f.x - roaE.x) <= 1 && f.cond === 'st_show_fine', 'roa st_fine two tiles above entrance');
  ok(r && r.y === roaE.y - 2 && Math.abs(r.x - roaE.x) <= 1 && r.cond === 'st_show_rival' && r.x !== f.x, 'roa st_rival beside st_fine');
  for (const [map, nid, key, val] of [['lute', 'inn', 'event', 'common_inn'], ['lute', 'tavern', 'event', 'common_tavern'], ['lute', 'tavern_start', 'event', 'lute_tavern_start'],
    ['lute', 'shop_item', 'shop', 'lute_item'], ['lute', 'shop_weapon', 'shop', 'lute_weapon'], ['lute', 'shop_armor', 'shop', 'lute_armor'], ['lute', 'ferry', 'ferryFrom', 'lute'],
    ['lute', 'folk_a', 'rumor', 'lute_a'], ['lute', 'folk_b', 'rumor', 'lute_b'], ['roa', 'folk_a', 'rumor', 'roa_a'], ['roa', 'folk_b', 'rumor', 'roa_b'], ['roa', 'shop_item', 'shop', 'roa_item'],
    ['lute', 'otto', 'event', 'lute_otto'], ['lute', 'rowell', 'event', 'lute_rowell'], ['roa_house', 'berna', 'event', 'roa_berna'], ['lighthouse_1', 'otto_door', 'sprite', 'npc:old_man'],
    ['lighthouse_2', 'rest', 'event', 'common_rest'], ['lighthouse_3', 'rest', 'event', 'common_rest'], ['lighthouse_3', 'fine', 'sprite', 'npc:fine'], ['lighthouse_3', 'boss', 'sprite', 'mon:boss_pageeater']]) {
    const n = npc(map, nid)[0];
    ok(n && n[key] === val, map + ': npc ' + nid + ' ' + key + ' = ' + val + (n ? ' (got ' + n[key] + ')' : ' (missing)'));
  }
  const scribe = npc('lute', 'scribe')[0];
  ok(scribe && scribe.move === 'wander' && JSON.stringify(scribe.cond) === JSON.stringify([{ tier: 4 }, { tierBelow: 7 }]), 'lute scribe: wander, tier 4–6');
  ok(!!npc('roa', 'elder')[0], 'roa: the elder (story_home_t6) is there');
  // shops, the tier-1 notice, the tier-6 story stone
  for (const s of ['lute_item', 'lute_weapon', 'lute_armor', 'roa_item']) ok(!!(DB.shops && DB.shops[s]), 'shop ' + s + ' exists');
  withState({ tier: 1 }, () => { const m = R.FieldMap.compile('lute'); ok(m.tileAt(4, 17) === 'sign' && !!m.signAt(4, 17), 'lute: tier-1 記録院の立て札'); });
  withState({}, () => { const m = R.FieldMap.compile('lute'); ok(m.tileAt(4, 17) !== 'sign' && !m.signAt(4, 17), 'lute: no notice before tier 1'); });
  withState({ tier: 6 }, () => { const m = R.FieldMap.compile('roa'); ok(m.tileAt(22, 16) === 'story_stone_blank', 'roa: blank story stone at tier 6'); });
  withState({ tier: 8, flags: ['final_roa'] }, () => { const m = R.FieldMap.compile('roa'); ok(m.tileAt(22, 16) === 'story_stone', 'roa: the stone back after final_roa'); });
  // lighthouse contents (§8.12.4, §10.6.4)
  const lh = (id) => compileQuiet(id).m;
  const c1 = lh('lighthouse_1').chests, c2 = lh('lighthouse_2').chests;
  ok(c1.length >= 1 && c1.length <= 2 && c1.every((c) => c.pool === 'p_supply'), 'lighthouse_1: 1–2 p_supply chests');
  ok(c2.some((c) => c.pool === 'p_gear'), 'lighthouse_2: one p_gear chest');
  const c3 = lh('lighthouse_3').chests;
  ok(c3.length >= 1 && c3.length <= 2 && c3.every((c) => c.pool === 'p_supply'), 'lighthouse_3: 1–2 p_supply chests (§8.12.4 各階 1〜2 個)');
  ok(c2.some((c) => c.pool === 'p_supply') && c2.some((c) => c.pool === 'p_gold'), 'lighthouse_2: p_supply + p_gold (the secret room)');
  let secrets = 0; const m2 = lh('lighthouse_2');
  for (let y = 0; y < m2.h; y++) for (let x = 0; x < m2.w; x++) if (m2.tileAt(x, y) === 'secret_wall') secrets++;
  ok(secrets >= 1 && secrets <= 3, 'lighthouse_2: a 1–3 tile secret passage (' + secrets + ')');
  measure('secret passage tiles (lighthouse_2)', secrets);
  ok(lh('lighthouse_1').npcs.filter((n) => n.id === 'rest').length === 0 && lh('lighthouse_2').npcs.some((n) => n.id === 'rest') && lh('lighthouse_3').npcs.some((n) => n.id === 'rest'), '休息の灯 on 2F (middle) and 3F (before the boss)');
  ok(DB.maps.lighthouse_2.lvOff === 2 && DB.maps.lighthouse_3.lvOff == null && DB.maps.lighthouse_1.lvOff == null, 'lvOff: 2F only (§10.6.2-9)');
  // events + meta + objectives
  const IDS = ['roa_house_intro', 'roa_stone', 'roa_berna', 'roa_gate', 'lute_arrival', 'lute_rowell', 'lute_tavern_start', 'lute_otto', 'lute_otto_reward', 'lighthouse_1_tutorial', 'lighthouse_3_fine', 'lighthouse_3_boss', 'lute_departure'];
  for (const e of IDS) { const d = DB.events[e]; ok(d && typeof d.run === 'function' && d.meta && Array.isArray(d.meta.needs) && Array.isArray(d.meta.gives), 'event ' + e + ' with run + meta'); }
  for (const o of ['obj_p_roa', 'obj_p_to_lute', 'obj_p_keeper', 'obj_p_lighthouse']) ok(!!(DB.objectives[o] && DB.objectives[o].text), 'objective ' + o);
  for (const o of Object.keys(DB.objectives)) if (/^obj_p_/.test(o)) ok(/^obj_p_(roa|to_lute|keeper|lighthouse)$/.test(o), 'only the four obj_p_* (' + o + ')');
  for (const k of ['k_chronicle', 'k_quill', 'k_bell', 'k_lighthouse_key', 'ac_otto_lantern', 'i_salve']) ok(!!DB.items[k], 'item ' + k);
  for (const t of ['tr_tutorial', 'tr_b_pageeater']) ok(!!DB.troops[t], 'troop ' + t);
}

// ============================================================ reach
function testReach() {
  section = 'reach';
  console.log('[reach]');
  const S0 = { flags: ['hero_created', 'pro_start'] };
  // roa_house: the bed to the master and to the door
  withState(S0, () => {
    const m = R.FieldMap.compile('roa_house'), b = m.spawns.bed;
    const s = reach(m, b.x, b.y);
    const berna = m.npcs.find((n) => n.id === 'berna');
    ok(touch(m, s, berna.x, berna.y), 'roa_house: bed → the master');
    ok(s.has('6,13'), 'roa_house: bed → the door');
    ok(touch(m, s, 14, 5) || s.has('14,4'), 'roa_house: the intro spot beside the bed is floor');
  });
  // roa: everything from the master's door; the gate band spans the only way out
  withState({ flags: ['hero_created', 'pro_start', 'pro_berna_sent'] }, () => {
    const m = R.FieldMap.compile('roa'), b = m.spawns.berna_house;
    const s = reach(m, b.x, b.y);
    for (const n of m.npcs) if (n.present && n.id !== 'st_fine' && n.id !== 'st_rival') ok(touch(m, s, n.x, n.y) || s.has(n.x + ',' + n.y), 'roa: npc ' + n.id + ' reachable');
    ok(touch(m, s, 22, 16), 'roa: the story stone');
    ok(s.has(m.spawns.entrance.x + ',' + m.spawns.entrance.y), 'roa: master\'s door → the gate');
    let edge = 0; for (const k of s) { const [, y] = k.split(',').map(Number); if (y === m.h - 1) edge++; }
    ok(edge > 0, 'roa: the south edge (exit) is reachable');
    // every way to the edge passes the roa_gate band
    const band = new Set(m.events.filter((e) => e.id === 'roa_gate').map((e) => e.x + ',' + e.y));
    const s2 = reach(m, b.x, b.y, { block: band });
    let edge2 = 0; for (const k of s2) { const [x, y] = k.split(',').map(Number); if (y === m.h - 1 || x === 0 || x === m.w - 1 || y === 0) edge2++; }
    eq(edge2, 0, 'roa: no way off the map around the roa_gate band');
    measure('roa: cells reachable', s.size);
  });
  // lute: from the gate everything the prologue uses
  withState({ flags: ['hero_created', 'pro_start', 'pro_berna_sent'] }, () => {
    const m = R.FieldMap.compile('lute'), e = m.spawns.entrance;
    const s = reach(m, e.x, e.y);
    for (const n of m.npcs) if (n.present && n.id !== 'ship') ok(touch(m, s, n.x, n.y) || s.has(n.x + ',' + n.y), 'lute: npc ' + n.id + ' reachable');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'lute: chest ' + c.id + ' reachable');
    for (const k of ['inn', 'dock']) ok(s.has(m.spawns[k].x + ',' + m.spawns[k].y), 'lute: spawn ' + k + ' reachable');
    for (const sg of m.signs) ok(touch(m, s, sg.x, sg.y), 'lute: sign ' + sg.x + ',' + sg.y + ' readable');
    let west = 0; for (const k of s) if (k.startsWith('0,')) west++;
    ok(west > 0, 'lute: the west bridge (exit) is reachable');
    measure('lute: cells reachable', s.size);
  });
  // departure scene: the NPCs stand where the script walks them
  withState({ flags: ['pro_boss'] }, () => {
    const m = R.FieldMap.compile('lute');
    const ids = m.npcs.filter((n) => n.present && ['berna', 'cheer_a', 'cheer_b', 'cheer_c', 'master'].includes(n.id)).map((n) => n.id);
    eq(ids.sort(), ['berna', 'cheer_a', 'cheer_b', 'cheer_c', 'master'], 'lute: the departure crowd appears after pro_boss');
  });
  withState({ flags: ['pro_boss', 'prologue_done'] }, () => {
    const m = R.FieldMap.compile('lute');
    ok(!m.npcs.some((n) => n.present && ['berna', 'cheer_a', 'master'].includes(n.id)), 'lute: the crowd is gone after prologue_done');
  });
  // lighthouse 1F: closed door without the key, the whole route with it
  withState({ flags: ['pro_key'] }, () => {
    R.Game.inv = {};
    const m = R.FieldMap.compile('lighthouse_1'), e = m.spawns.entrance;
    const s = reach(m, e.x, e.y);
    ok(!s.has('18,23'), 'lighthouse_1: the tower door holds without the key');
  });
  withState({ flags: ['pro_key'], items: ['k_lighthouse_key'] }, () => {
    const m = R.FieldMap.compile('lighthouse_1'), e = m.spawns.entrance;
    ok(m.tileAt(18, 24) === 'door', 'lighthouse_1: the key opens the tower door (tilePatch)');
    const s = reach(m, e.x, e.y);
    const band = m.events.filter((v) => v.id === 'lighthouse_1_tutorial');
    ok(band.some((v) => s.has(v.x + ',' + v.y)), 'lighthouse_1: the tutorial band is reached');
    ok(s.has('25,3'), 'lighthouse_1: the stairs up are reached');
    // the band cuts the tower off from the door: nothing inside is reachable around it
    const bset = new Set(band.map((v) => v.x + ',' + v.y));
    const s2 = reach(m, e.x, e.y, { block: bset });
    ok(!s2.has('25,3') && !s2.has('9,12'), 'lighthouse_1: no way past the tutorial band');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'lighthouse_1: chest ' + c.id + ' reachable');
    const otto = m.npcs.find((n) => n.id === 'otto_door');
    ok(otto && otto.present && touch(m, s, otto.x, otto.y), 'lighthouse_1: the keeper waits at the door');
    measure('lighthouse_1: cells reachable', s.size);
  });
  // 2F: the spiral; the secret room only through the crack
  withState({}, () => {
    const m = R.FieldMap.compile('lighthouse_2'), p = m.spawns.from_prev;
    const s = reach(m, p.x, p.y);
    ok(s.has('17,15'), 'lighthouse_2: from_prev → the stairs up');
    for (const c of m.chests) ok(touch(m, s, c.x, c.y), 'lighthouse_2: chest ' + c.id + ' reachable');
    const rest = m.npcs.find((n) => n.id === 'rest');
    ok(rest && touch(m, s, rest.x, rest.y), 'lighthouse_2: the 休息の灯 is reachable');
    const s2 = reach(m, p.x, p.y, { noSecret: true });
    ok(s2.has('17,15'), 'lighthouse_2: the stairs do not need the secret passage');
    const hidden = m.chests.filter((c) => !touch(m, s2, c.x, c.y)).map((c) => c.pool).sort();
    eq(hidden, ['p_gold', 'p_supply'], 'lighthouse_2: the secret room holds exactly p_supply + p_gold');
    const sign = m.signs[0];
    ok(sign && touch(m, s, sign.x, sign.y), 'lighthouse_2: the inscription is readable');
    // the spiral is long: shortest path length from the stairs down to the stairs up
    const dist = bfsDist(m, p.x, p.y, 17, 15);
    ok(dist >= 60, 'lighthouse_2: the spiral path is long (' + dist + ' steps)');
    measure('lighthouse_2: shortest stairs→stairs steps', dist);
  });
  // 3F: the girl's band, then the boss band, across the whole width
  withState({}, () => {
    const m = R.FieldMap.compile('lighthouse_3'), p = m.spawns.from_prev;
    const s = reach(m, p.x, p.y);
    const fine = new Set(m.events.filter((v) => v.id === 'lighthouse_3_fine').map((v) => v.x + ',' + v.y));
    const boss = new Set(m.events.filter((v) => v.id === 'lighthouse_3_boss').map((v) => v.x + ',' + v.y));
    ok([...fine].some((k) => s.has(k)) && [...boss].some((k) => s.has(k)), 'lighthouse_3: both bands reachable');
    const s2 = reach(m, p.x, p.y, { block: fine });
    ok(![...boss].some((k) => s2.has(k)), 'lighthouse_3: the girl\'s band cannot be skipped');
    const s3 = reach(m, p.x, p.y, { block: boss });
    const b = m.npcs.find((n) => n.id === 'boss');
    ok(!touch(m, s3, b.x, b.y), 'lighthouse_3: the boss band cannot be skipped');
    const rest = m.npcs.find((n) => n.id === 'rest');
    ok(rest && touch(m, s2, rest.x, rest.y), 'lighthouse_3: the 休息の灯 is before the girl and the boss');
    for (const c of m.chests) ok(touch(m, s2, c.x, c.y), 'lighthouse_3: chest ' + c.id + ' reachable before the girl');
  });
  // no chest blocks a path (every map): removing a chest never adds reachable cells
  for (const id of MAPS) withState({ flags: ['pro_key', 'pro_berna_sent'], items: ['k_lighthouse_key'] }, () => {
    const m = R.FieldMap.compile(id);
    const start = m.spawns.entrance || m.spawns.from_prev || m.spawns.bed;
    const base = reach(m, start.x, start.y).size;
    for (const c of m.chests) {
      const keep = m.chestIdx.get(m.idx(c.x, c.y));
      m.chestIdx.delete(m.idx(c.x, c.y));
      const after = reach(m, start.x, start.y).size;
      if (keep) m.chestIdx.set(m.idx(c.x, c.y), keep);
      ok(after === base, id + ': chest ' + c.id + ' blocks nothing');
    }
  });
}
function bfsDist(m, sx, sy, tx, ty) {
  const d = new Map([[sx + ',' + sy, 0]]); const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    if (x === tx && y === ty) return d.get(x + ',' + y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (d.has(k)) continue;
      const t = m.tileAt(nx, ny);
      if (!(m.walkable(nx, ny) || t === 'stairs_up' || t === 'stairs_down') || /^secret_/.test(t)) continue;
      if (m.npcAt(nx, ny)) continue;
      d.set(k, d.get(x + ',' + y) + 1); q.push([nx, ny]);
    }
  }
  return -1;
}

// ============================================================ text
function srcFiles() {
  const out = [];
  for (const d of ['src/maps', 'src/events']) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/^prologue.*\.js$/.test(f)) out.push(path.join(d, f));
  return out;
}
/** the Japanese string literals of a source file (comments stripped) */
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
  line = line.replace(/\{hero\}|\{leader\}/g, '＃＃＃＃＃').replace(/\{g:([^|}]*)\|([^}]*)\}/g, (a, m, f) => (m.length >= f.length ? m : f));
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
    'ポイントの経験値', '身を守っている', '様子をうかがっている', 'を落としていった', 'リジェネ', 'ジョブ', 'アビリティ', 'JP', '麻痺', '魔法防御', '並び替え',
    '酒場の主人', 'すべて袋に', '頁', '秘奥義', '魔剣士', '蘇生', 'アルン', '{yuki}', '{non}', '{metem}'];
  let n = 0, pages = 0, longest = 0;
  const mapNames = new Set(MAPS.map((id) => DB.maps[id] && DB.maps[id].name)); // UI labels: 「ファロス灯台　2階」 (STYLE_JA §3)
  for (const f of srcFiles()) {
    for (const { s, line } of strings(f)) {
      n++;
      const at = f + ':' + line;
      for (const b of BANNED) ok(!s.includes(b) || (b === '魔法' && /魔法の天才/.test(s)), at + ' forbidden word 「' + b + '」 in ' + JSON.stringify(s));
      ok(!/…/.test(s.replace(/……/g, '')), at + ' a single 「…」: ' + JSON.stringify(s));
      for (const pg of s.split('\f')) {
        pages++;
        const ls = pg.split('\n');
        ok(ls.length <= 4, at + ' ≤ 4 lines per page: ' + JSON.stringify(pg));
        for (const l of ls) { const w = width(l); longest = Math.max(longest, w); ok(w <= 20, at + ' ≤ 20 per line (' + w + '): ' + l); }
        const t = pg.replace(/\s+$/, '');
        if (/……$/.test(t) && t !== '……') ok(false, at + ' 「……」 at the end of a sentence needs 。！？: ' + JSON.stringify(t));
        // full-width spaces only after ！？ (or ♪), never as word spacing
        const sp = t.match(/.　/g) || [];
        if (!mapNames.has(t)) for (const m of sp) ok(/[！？♪]/.test(m[0]), at + ' full-width space after 「' + m[0] + '」: ' + JSON.stringify(t));
      }
      if (joyo) for (const ch of s) {
        if (!/[\u4e00-\u9fff]/.test(ch)) continue;
        ok(joyo.has(ch) || ALLOWED.has(ch), at + ' 常用外の字 「' + ch + '」 in ' + JSON.stringify(s));
      }
    }
  }
  // map and sign texts reachable through the data (variants included)
  for (const id of MAPS) {
    const def = DB.maps[id];
    for (const nn of def.npcs || []) {
      const list = Array.isArray(nn.text) && nn.text.length && typeof nn.text[0] === 'object' ? nn.text : null;
      if (list) ok(!list[list.length - 1].cond, id + ': npc ' + nn.id + ' has a default line last');
    }
  }
  measure('Japanese strings checked', n);
  measure('text pages checked', pages);
  measure('widest line (full-width units)', longest);
  ok(!!joyo, 'tools/lib/joyo.txt present (常用漢字 check ran)');
}

// ============================================================ play (the real runtime)
async function testPlay() {
  section = 'play';
  console.log('[play]');
  const S = R.fxPro; // stubs (tools/fixtures/prologue/node/stubs.js)
  R.Gfx.textWidth = (s) => R.Text.approxWidth(String(s));
  R.Settings.msgSpeed = 3;
  R.Settings.alwaysDash = true;
  const flush = () => new Promise((r) => setImmediate(r));
  let frames = 0;
  // P1 「暗転のまま」: the lowest fade alpha seen before the first caption (1 = the room never showed)
  let darkWatch = false, darkMin = 1, stageFade = null;
  async function step(k = 1) {
    for (let i = 0; i < k; i++) {
      frames++; if (frames > 600000) throw new Error('frame budget');
      R.Engine.step(); await flush();
      if (darkWatch && stageFade == null) darkMin = Math.min(darkMin, R.Engine.fadeAlpha);
    }
  }
  async function press(b) { R.Input._set(b, true); await step(2); R.Input._set(b, false); await step(2); }
  const fieldTop = () => R.Engine.top() === R.Field.layer;
  /** answer every window with A (yes / first choice) until the field is free */
  async function settle(max = 4000) {
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
  // captions (ev.caption → the stage layer) are recorded too
  const capLog = [];
  { const push0 = R.Engine.push; R.Engine.push = function (L) {
    if (L && typeof L.setCaption === 'function' && darkWatch && stageFade == null) stageFade = L.fadeTaken;
    if (L && typeof L.setCaption === 'function') { const sc = L.setCaption.bind(L); L.setCaption = (t, o) => { capLog.push(R.Text.fmt(t)); return sc(t, o); }; }
    return push0.call(this, L);
  }; }
  const captioned = (re) => capLog.some((t) => re.test(t));
  const g = () => R.Game;
  /** start / warp without deadlocking: the fades advance only while frames are stepped */
  const go = async (p) => { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 400 && !done; i++) await step(1); ok(done, 'warp finished'); return settle(); };
  const talk = async (id) => { const n = R.Field.npc(id); ok(!!n && n.present, 'npc ' + id + ' present on ' + R.Field.map.id); if (n) { R.Events.talk(n); ok(await settle(), 'talk ' + id + ' ends'); } };
  const runStep = async (id, x, y) => { R.Events.run(id, { trigger: 'step', once: id, x, y }); ok(await settle(), id + ' ends'); };

  // ---- new game → P1
  R.State.newGame();
  darkWatch = true;
  ok(await go(R.Field.start('roa_house', 'bed')), 'P1 intro runs to the end');
  darkWatch = false;
  eq(darkMin, 1, 'P1 the screen stays black until the opening captions (enterDark)');
  eq(stageFade, 1, 'P1 the captions take over the black screen (暗転のまま)');
  ok(R.Engine.fadeAlpha === 0, 'P1: the screen is visible after the intro');
  ok(g().flags.pro_start && g().flags.hero_created, 'P1 flags pro_start + hero_created');
  eq(g().objective, 'obj_p_roa', 'P1 objective');
  eq(S.created, 1, 'P1 hero creation ran once');
  eq(R.State.hero().name, S.HERO.name, 'P1 the created hero leads the party');
  ok(said(/今日は大事な日だよ/) && said(/いい名前だ/), 'P1 the master\'s lines');
  ok(captioned(/……ねえ、聞こえる？/) && captioned(/忘れられかけた物語/) && captioned(/ひとりの語り部の物語/), 'P1 the three captions');
  const b = R.Field.npc('berna');
  eq([b.x, b.y], [9, 4], 'P1 the master walks back to her lectern');
  // ---- P2
  let mark = sayLog.length;
  await talk('berna');
  ok(g().flags.pro_berna_sent, 'P2 pro_berna_sent');
  eq(R.State.count('i_salve'), 3, 'P2 three salves');
  eq(g().gold, 50, 'P2 50 gold');
  eq(g().objective, 'obj_p_to_lute', 'P2 objective');
  ok(said(/白紙/, mark) && said(/灯台の火/, mark), 'P2 白紙 and the dark lighthouse');
  // roa_gate before / after
  ok(await go(R.Field.warp('roa', 'berna_house')), 'to roa');
  g().flags.pro_berna_sent = false;
  R.Field.setPlayerPos(30, 34, 'down');
  mark = sayLog.length;
  await runStep('roa_gate', 30, 34);
  ok(said(/あいさつして/, mark) && R.Field.pos().y === 33, 'roa_gate stops the hero before the master has spoken');
  g().flags.pro_berna_sent = true;
  mark = sayLog.length;
  await runStep('roa_gate', 30, 34);
  ok(!said(/あいさつして/, mark), 'roa_gate is silent afterwards');
  // stone
  mark = sayLog.length; R.Events.run('roa_stone', { trigger: 'examine' }); await settle();
  ok(said(/白く抜けている/, mark), 'roa_stone: half blank');
  // ---- P4
  ok(await go(R.Field.warp('lute', 'entrance')), 'P4 arrival');
  ok(g().flags.pro_lute, 'P4 pro_lute');
  ok(said(/三晩/) && said(/跳ね橋/) && said(/定期船/), 'P4 the three pieces of news');
  eq(g().respawn && g().respawn.map, 'lute', 'lute sets the respawn point');
  // ---- P5 (optional)
  mark = sayLog.length; await talk('rowell');
  ok(g().flags.pro_met_rowell && said(/語り部の出る幕じゃない/, mark), 'P5 Rowell');
  // ---- P7 before the party
  mark = sayLog.length; await talk('otto');
  ok(!g().flags.pro_key && said(/とんでもない/, mark), 'P7 the keeper sends a lone hero to the tavern');
  // ---- P6
  mark = sayLog.length; await talk('tavern_start');
  ok(g().flags.pro_party_chosen, 'P6 pro_party_chosen');
  eq(g().party.length, 4, 'P6 the party is four');
  eq(g().objective, 'obj_p_keeper', 'P6 objective');
  ok(said(/オットーじいさん/, mark), 'P6 the master points to the harbour');
  ok(!R.Field.npc('tavern_start').present && R.Field.npc('tavern').present, 'P6 the tavern master becomes the common tavern');
  for (const id of S.PICK) ok(!R.Field.map.npcs.some((n) => n.who === id && n.present), 'P6 patron ' + id + ' leaves the tables');
  // ---- P7
  mark = sayLog.length; await talk('otto');
  ok(g().flags.pro_key && R.State.hasItem('k_lighthouse_key'), 'P7 the key');
  eq(g().objective, 'obj_p_lighthouse', 'P7 objective');
  ok(said(/前列と後列/, mark) && said(/武器は2つまで/, mark) && said(/『オート』/, mark), 'P7 the three lessons');
  // ---- P8
  ok(await go(R.Field.warp('lighthouse_1', 'entrance')), 'to lighthouse_1');
  eq(R.Field.map.tileAt(18, 24), 'door', 'P8 the key opens the tower door');
  ok(R.Field.npc('otto_door').present, 'P8 the keeper waits inside');
  S.battleScript = ['lose', 'win'];
  S.glimmer = 'tech';
  S.battles.length = 0;
  mark = sayLog.length;
  await runStep('lighthouse_1_tutorial', 18, 21);
  ok(g().flags.pro_tutorial && g().flags.lighthouse_1_tutorial, 'P8 pro_tutorial');
  eq(S.battles.length, 2, 'P8 the lost tutorial is fought again');
  const tut = S.battles[0] || {};
  eq([tut.troop, tut.members, tut.glimmerForce, tut.canLose, tut.noEscape, tut.noRare, tut.noGolden], ['tr_tutorial', ['hero'], 'hero', true, true, true, true], 'P8 ev.battle options word for word (§10.7)');
  ok(said(/危なかったのう/, mark) && said(/新しい技/, mark) && said(/『技・術』/, mark), 'P8 the retry line and the 閃き lesson (技)');
  ok(!R.Field.npc('otto_door').present, 'P8 the keeper goes back to the harbour');
  // ---- P9
  ok(await go(R.Field.warp('lighthouse_3', 'from_prev')), 'to lighthouse_3');
  mark = sayLog.length;
  await runStep('lighthouse_3_fine', 13, 18);
  ok(g().flags.lighthouse_3_fine && said(/言葉を失った灯/, mark), 'P9 the girl in grey');
  ok(!R.Field.npc('fine').present, 'P9 she is gone');
  S.battleScript = ['win'];
  mark = sayLog.length;
  R.Events.run('lighthouse_3_boss', { trigger: 'step', x: 13, y: 12 });
  ok(await settle(), 'P9 boss → P10 departure ends');
  eq(S.battles[S.battles.length - 1].troop, 'tr_b_pageeater', 'P9 the boss troop');
  ok(g().flags.pro_boss, 'P9 pro_boss');
  ok(captioned(/守り歌を年代記に書き記した/) && captioned(/海の果てまで、灯よ届け/) && captioned(/翌朝/), 'P9 the song comes back, the night passes');
  // ---- P10
  eq(R.Field.map.id, 'lute', 'P10 in Faros');
  ok(g().flags.prologue_done, 'P10 prologue_done');
  for (const k of ['k_chronicle', 'k_quill', 'k_bell']) ok(R.State.hasItem(k), 'P10 ' + k);
  eq(g().objective, 'obj_regions', 'P10 objective obj_regions');
  ok(said(/夜通し歩いてきたよ/, mark) && captioned(/序章\n『灯台守の歌』が記された/) && said(/八つの大きな伝承/, mark) && said(/どこの町の酒場でもね/, mark), 'P10 the master, the chapter, the eight legends, the tavern master');
  const hints = Object.values(DB.regions || {}).map((r) => r.hint).filter(Boolean);
  ok(hints.length === 8 && hints.every((h) => said(new RegExp(h.split('\n')[0]), mark)), 'P10 all eight rumours');
  ok(S.jingles.includes('chapter'), 'P10 jingle chapter');
  ok(!R.Field.npc('berna').present, 'P10 the master leaves');
  eq(g().respawn && [g().respawn.map, g().respawn.spawn], ['lute', 'inn'], 'P10 respawn at the inn');
  // the keeper's reward
  mark = sayLog.length; await talk('otto');
  ok(R.State.hasItem('ac_otto_lantern') && g().flags.lute_otto_reward, 'lute_otto_reward: 灯台守のランタン');
  mark = sayLog.length; await talk('otto');
  eq(R.State.count('ac_otto_lantern'), 1, 'lute_otto_reward only once');
  // the onEnter after the prologue is quiet
  mark = sayLog.length; await go(R.Field.warp('lute', 'entrance'));
  eq(sayLog.length, mark, 'lute onEnter is silent after the prologue');

  // ---- branches
  // the lamp is lit on 3F afterwards, the boss is gone
  await go(R.Field.warp('lighthouse_3', 'from_prev'));
  ok(R.Field.npc('lamp_lit').present && !R.Field.npc('lamp').present && !R.Field.npc('boss').present, '3F after pro_boss: the lamp burns');
  // the master after the prologue: lodging
  await go(R.Field.warp('roa_house', 'entrance'));
  for (const c of g().party) c.hp = 1;
  mark = sayLog.length; await talk('berna');
  ok(said(/年代記は、\nちゃんと書いているかい/, mark) && g().party.every((c) => c.hp === R.Rules.stats(c).hp), 'the master: prologue_done line + a free night (full HP)');
  eq([g().respawn.map, g().respawn.spawn], ['roa', 'berna_house'], 'the free night sets the respawn to her door');
  g().regionsCleared = ['r_forest', 'r_desert', 'r_snow']; g().tier = 3;
  mark = sayLog.length; await talk('berna');
  ok(said(/名前がすぐに出てこなくて/, mark), 'the master at tier 3');
  g().regionsCleared = Object.keys(DB.regions).slice(0, 6); g().tier = 6; g().flags.st_berna_forgot = true;
  mark = sayLog.length; await talk('berna');
  ok(said(/旅の方？/, mark), 'the master at tier 6 does not know the hero');
  g().flags.final_roa = true;
  mark = sayLog.length; await talk('berna');
  ok(said(/今度こそ/, mark), 'the master after final_roa');
  g().gameClear = true; g().flags.game_clear = true;
  mark = sayLog.length; await talk('berna');
  ok(said(/子どもたちが/, mark), 'the master after the ending');
  // the stone at tier 6 / after the ending
  g().flags.final_roa = false; g().gameClear = false; g().flags.game_clear = false;
  await go(R.Field.warp('roa', 'stone'));
  eq(R.Field.map.tileAt(22, 16), 'story_stone_blank', 'the stone is blank at tier 6');
  mark = sayLog.length; R.Events.run('roa_stone', { trigger: 'examine' }); await settle();
  ok(said(/真っ白/, mark), 'roa_stone at tier 6');
  // tier lines in the towns (§3.2.4 through R.Events.talk)
  await go(R.Field.warp('lute', 'inn'));
  mark = sayLog.length; await talk('watchman');
  ok(said(/記録院の書記/, mark), 'lute watchman: the tier-4 line');
  ok(R.Field.npc('scribe').present, 'lute: the white-robed scribe at tier 6');
  g().regionsCleared = Object.keys(DB.regions).slice(0, 7); g().tier = 7; R.Field.refresh();
  ok(!R.Field.npc('scribe').present, 'lute: the scribe is gone at tier 7');
  ok(R.Field.npc('books_a').present, 'lute: the books pile up from tier 3');
  // the bard and a patron
  mark = sayLog.length; await talk('bard');
  ok(said(/ヴァルザード/, mark) && said(/名前かい/, mark), 'the bard sings the legend');
  const patron = R.Field.map.npcs.find((n) => n.who && n.present);
  if (patron) { mark = sayLog.length; R.Events.talk(patron); await settle(); ok(said(new RegExp(DB.companions[patron.who].name), mark), 'a patron shows the candidate\'s profile'); }
  // a spell glimmer changes the keeper's lesson (術師 heroes)
  R.State.newGame();
  g().flags.pro_key = true; R.State.addItem('k_lighthouse_key');
  await go(R.Field.warp('lighthouse_1', 'entrance'));
  S.battleScript = ['win']; S.glimmer = 'spell';
  mark = sayLog.length;
  await runStep('lighthouse_1_tutorial', 18, 21);
  ok(said(/新しい術/, mark) && said(/『技・術』/, mark), 'P8 a spell glimmer gets the 術 lesson');
  measure('play: frames simulated', frames);
  measure('play: lines shown', sayLog.length);
  const own = warnings.filter((w) => /prologue|roa|lute|lighthouse/.test(w) && !/story_rumor|story_home_t6|story_final_roa/.test(w));
  ok(!own.length, 'no warnings about the prologue during play: ' + own.slice(0, 5).join(' | '));
}

// ============================================================ time (the ~1h45m budget, §10.7 / §10.14)
function testTime() {
  section = 'time';
  console.log('[time]');
  // walking steps between the story points (shortest paths), battles from the zone rates
  const legs = [];
  const leg = (map, from, to, st) => withState(st || { flags: ['pro_berna_sent', 'pro_key'], items: ['k_lighthouse_key'] }, () => {
    const m = R.FieldMap.compile(map);
    const a = typeof from === 'string' ? m.spawns[from] : from, b = typeof to === 'string' ? m.spawns[to] : to;
    const d = bfsDist(m, a.x, a.y, b.x, b.y);
    legs.push([map, d]);
    return d;
  });
  leg('roa_house', 'bed', { x: 6, y: 12 });
  leg('roa', 'berna_house', 'entrance');
  leg('lute', 'entrance', { x: 24, y: 13 });
  leg('lute', { x: 24, y: 13 }, { x: 44, y: 16 });
  leg('lute', { x: 44, y: 16 }, 'entrance');
  const l1 = leg('lighthouse_1', 'entrance', { x: 25, y: 4 });
  const l2 = leg('lighthouse_2', 'from_prev', 'from_next');
  const l3 = leg('lighthouse_3', 'from_prev', { x: 13, y: 13 });
  for (const [m, d] of legs) ok(d > 0, 'path exists on ' + m + ' (' + d + ')');
  const town = legs.slice(0, 5).reduce((a, [, d]) => a + d, 0);
  const tower = l1 + l2 + l3;
  const rate = 22; // dungeon encRate (field_map DEFAULT_ENC_RATE)
  // a player explores ~2.5× the shortest path in a first visit (chests, dead ends, the secret room)
  const towerSteps = Math.round(tower * 2.5);
  const battles = Math.round(towerSteps / rate);
  measure('prologue walking: town legs (shortest)', town + ' steps');
  measure('prologue walking: tower shortest 1F+2F+3F', tower + ' steps (' + l1 + '+' + l2 + '+' + l3 + ')');
  measure('lighthouse: expected steps / random battles (first visit ×2.5, encRate 22)', towerSteps + ' / ' + battles);
  ok(battles >= 12 && battles <= 40, 'lighthouse random battles in 12–40 (' + battles + ')');
}

// ============================================================ run
(async () => {
  const want = process.argv.slice(2);
  const on = (s) => !want.length || want.includes(s);
  try {
    if (on('static')) testStatic();
    if (on('reach')) testReach();
    if (on('text')) testText();
    if (on('play')) await testPlay();
    if (on('time')) testTime();
  } catch (e) {
    fails++; failed.push(section + ': threw ' + (e && e.stack || e));
    console.log('  THREW:', e && e.stack || e);
  }
  console.log('\nmeasured:');
  for (const [k, v] of report) console.log('  ' + k + ': ' + v);
  console.log(`\ntest_prologue: ${passes} passed, ${fails} failed`);
  if (fails) { console.log('failures:\n  ' + failed.slice(0, 40).join('\n  ')); process.exit(1); }
  process.exit(0);
})();
