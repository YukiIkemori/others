#!/usr/bin/env node
// Checker for the second-half dungeons: src/maps/dungeons_b.js + src/events/dungeons_b.js
// (氷結の洞窟, 炎の火山, 星見の塔, 魔王城).
//
//   node tools/check_dungeons_b.js               static checks + reachability + event dry runs
//   node tools/check_dungeons_b.js --verbose     also list every chest and path lengths
//   node tools/check_dungeons_b.js --png DIR     also render every floor with the real tile art
//                                                (objects, spawns, warps, events marked) to DIR/<map>.png
//
// Static: size 40x32..64x48, equal rows, legend/mark chars, `under` tiles, required fields
// (type/theme/bgm/encounter zone/escape), floor 1 entrance + world exit, world spawns, stairs and
// two-way pads that lead back next to where they came from, chests on walkable tiles (not on or
// right next to a door, stairs, pad, warp, event or spawn) with existing items and globally unique
// ids, NO hidden (examine-to-find) items at all (abolished: every treasure is a visible chest),
// NPC sprites/events/troops, torches facing a
// floor, boss trigger floors close enough for the camera to frame the boss, texts (STYLE_JA.md:
// glossary map names, window width with 6-character hero names, forbidden names, no hard-coded hero
// names, no DQ-style spaces, a full-width space after a mid-line ！/？).
// Reachability: BFS over all floors of a dungeon for a sequence of story states (keys held, bosses
// beaten). Warps fire when stepped on (not on arrival), NPCs & chests block, locked doors need
// their key, damage floors (lava/poison) are walkable, tilePatches follow the flags, boss trigger
// floors stop the walk while the boss stands. Each state must reach exactly the next boss and
// nothing behind it; the final state must reach every chest, stair, pad, crest and exit circle,
// and no chest may block a way through (in every state, ignoring the chests reaches the same cells,
// save a tiny empty pocket of at most 4 cells a floor behind a chest; never a warp/event/spawn/sign).
// Without the gold key nothing past the gold door may be reachable.
// Events: every script runs against a stub `ev` (battles won, yes to every question); the flags
// and items it hands out must equal its meta.gives; the last boss must end in game_clear + ending.
'use strict';
const fs = require('fs');
const path = require('path');
const load = require('./lib/load');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes('--verbose');
const PNG = opt('png', null);

const R = load({ quiet: true });
const DB = R.DB;
const errors = [], warns = [];
const E = (m) => errors.push(m), W = (m) => warns.push(m);
for (const e of R._nodeLoadErrors) if (/dungeons_b/.test(e)) E('load: ' + e.split('\n')[0]);
const mapWarns = [];
R.warn = (...a) => mapWarns.push(a.join(' '));

// ------------------------------------------------------------------ the plan
const boss = (event, troop, sprite, npc, flag) => ({ event, troop, sprite, npc, flag });
const DUNGEONS = [
  { key: 'ice', name: '氷結の洞窟', floors: ['ice_cave_1', 'ice_cave_2'], zones: ['d_ice1', 'd_ice2'], theme: 'ice', bgm: 'ice', keys: [],
    bosses: [boss('ice_boss', 'boss_ice', 'boss_frost_giant', 'ice_giant', 'boss_ice_done')],
    gives: ['item:gold_key'] },
  { key: 'volcano', name: '炎の火山', gated: true, floors: ['volcano_1', 'volcano_2'], zones: ['d_vol1', 'd_vol2'], theme: 'volcano', bgm: 'volcano', keys: ['gold_key'],
    bosses: [boss('volcano_boss', 'boss_volcano', 'boss_flame_lord', 'volcano_lord', 'boss_volcano_done')],
    crest: { event: 'volcano_crest', item: 'crest_fire', got: 'got_crest_fire' } },
  { key: 'star', name: '星見の塔', gated: true, floors: ['star_tower_1', 'star_tower_2', 'star_tower_3', 'star_tower_4'], zones: ['d_star1', 'd_star2', 'd_star3', 'd_star4'],
    theme: 'tower', bgm: 'tower', keys: ['gold_key'],
    bosses: [boss('star_boss', 'boss_star', 'boss_star_guardian', 'star_guardian', 'boss_star_done')],
    crest: { event: 'star_crest', item: 'crest_star', got: 'got_crest_star' } },
  { key: 'demon', name: '魔王城', floors: ['demon_castle_1', 'demon_castle_2', 'demon_castle_3', 'demon_castle_4', 'demon_castle_5'],
    zones: ['d_demon1', 'd_demon2', 'd_demon3', 'd_demon4', 'd_demon5'], theme: 'demon', bgm: 'lastdungeon', keys: ['silver_key', 'gold_key'],
    bosses: [
      boss('demon_general1', 'boss_general1', 'boss_general_a', 'dark_general', 'boss_general1_done'),
      boss('demon_general2', 'boss_general2', 'boss_general_b', 'lich_general', 'boss_general2_done'),
      boss('demon_king', 'boss_king1', 'boss_demon_king', 'demon_king', 'boss_king1_done'),
      boss('demon_king', 'boss_king2', 'boss_demon_king2', 'demon_king2', 'boss_king2_done'),
    ],
    gives: ['flag:game_clear'] },
];
const MINE = DUNGEONS.flatMap((d) => d.floors);
const OWNER = {};
for (const d of DUNGEONS) for (const f of d.floors) OWNER[f] = d;
const BGM = 'title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ending'.split(' ');
const SFX = ('cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt magic fire ice thunder wind holy dark ' +
  'earth water heal revive buff debuff status poison sleep death enemy_die boss_die escape stairs door locked chest item gold step_damage ' +
  'ship bump warp teleport steal jump breath roar shake').split(' ');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const FORBIDDEN = ['メラ', 'ホイミ', 'ルーラ', 'スライム', 'ケアル', 'ファイガ', 'エスナ', 'レイズ', 'ギラ', 'ベホマ', 'リレミト', 'ドラクエ', 'ファイナル', 'ゾーマ', 'ハーゴン', 'シドー'];
// step events that move the party (shortcut circles): id -> [map, spawn]
const SHORTCUTS = {
  demon_gate_west: ['demon_castle_3', 'gate_w'], demon_gate_east: ['demon_castle_4', 'gate_e'],
  demon_gate_back3: ['demon_castle_1', 'gate_w'], demon_gate_back4: ['demon_castle_1', 'gate_e'],
};

// ------------------------------------------------------------------ compile (the real loader)
R.State.newGame();
const maps = {};
for (const id of MINE) {
  if (!DB.maps[id]) { E(`map ${id} missing`); continue; }
  mapWarns.length = 0;
  maps[id] = R.FieldMap.compile(id);
  for (const w of mapWarns) E(`${id}: loader: ${w}`);
}
const world = DB.maps.world ? R.FieldMap.compile('world') : null;
if (!world) W('world map not loaded: world spawns not checked');
const gfxHas = (k) => {
  if (R.Gfx.has) return R.Gfx.has(k);
  return !!(R.Gfx._defs && R.Gfx._defs[k]);
};

// ------------------------------------------------------------------ static checks
const allIds = {};
for (const id in DB.maps) {
  const def = DB.maps[id];
  const ids = (def.chests || []).concat(def.hidden || []).map((c) => c.id);
  for (const ch in def.marks || {}) {
    const mk = def.marks[ch];
    if ((mk.chest || mk.hidden) && def.rows && def.rows.some((r) => r.includes(ch))) ids.push((mk.chest || mk.hidden).id);
  }
  for (const c of ids) {
    if (!c) continue;
    if (allIds[c] && (MINE.includes(id) || MINE.includes(allIds[c]))) E(`duplicate chest id ${c} (${allIds[c]} and ${id})`);
    allIds[c] = id;
  }
}
const tileDef = (m, x, y) => DB.tiles[m.tileAt(x, y)] || { pass: false };
const walkTile = (m, x, y) => m.inBounds(x, y) && tileDef(m, x, y).pass;
const itemName = (c) => (c.gold ? c.gold + 'G' : (DB.items[c.item] ? DB.items[c.item].name : '?' + c.item) + (c.n > 1 ? '×' + c.n : ''));
const texts = [];
const report = [];

for (const d of DUNGEONS) {
  d.floors.forEach((id, fi) => {
    const m = maps[id];
    if (!m) return;
    const def = DB.maps[id];
    const legend = DB.legends.local;
    if (m.w < 40 || m.h < 32 || m.w > 64 || m.h > 48) E(`${id}: size ${m.w}x${m.h} outside 40x32..64x48`);
    def.rows.forEach((r, y) => { if (r.length !== m.w) E(`${id}: row ${y} has length ${r.length} (expected ${m.w})`); });
    for (const ch in def.marks || {}) {
      if (ch in legend) E(`${id}: mark char '${ch}' is a legend char`);
      const u = def.marks[ch].under;
      if (u != null && !legend[u]) E(`${id}: mark '${ch}' has unknown under '${u}'`);
      if (!def.rows.some((r) => r.includes(ch))) W(`${id}: mark '${ch}' never used`);
    }
    for (const r of def.rows) for (const ch of r) if (!legend[ch] && !(def.marks && def.marks[ch])) E(`${id}: unknown char '${ch}'`);
    if (def.type !== 'dungeon') E(`${id}: type ${def.type} (expected dungeon)`);
    if (def.name !== d.name) E(`${id}: name ${def.name} (expected ${d.name})`);
    if (def.theme !== d.theme) E(`${id}: theme ${def.theme} (expected ${d.theme})`);
    if (def.bgm !== d.bgm || !BGM.includes(def.bgm)) E(`${id}: bgm ${def.bgm} (expected ${d.bgm})`);
    if (def.encounter !== d.zones[fi]) E(`${id}: encounter ${def.encounter} (expected ${d.zones[fi]})`);
    if (!DB.encounters[def.encounter]) E(`${id}: encounter zone ${def.encounter} not defined`);
    const esc = def.escape;
    if (!esc || esc.to !== 'world' || esc.spawn !== d.floors[0]) E(`${id}: escape must be {to:'world', spawn:'${d.floors[0]}'}`);
    if (world && esc && !world.spawns[esc.spawn]) E(`${id}: world spawn ${esc.spawn} missing`);
    for (const s in m.spawns) {
      const p = m.spawns[s];
      const w = m.warpAt(p.x, p.y);
      if (w && m.tileAt(p.x, p.y) !== 'warp_pad') E(`${id}: spawn ${s} sits on a warp`);
      const padLater = m.tileAt(p.x, p.y) === 'seal' && m.patches.some((q) => q.x === p.x && q.y === p.y && q.ch === 'P');
      if (!walkTile(m, p.x, p.y) && !padLater) E(`${id}: spawn ${s} on ${m.tileAt(p.x, p.y)}`);
      if (m.npcAt(p.x, p.y) || m.chestAt(p.x, p.y)) E(`${id}: spawn ${s} blocked by an object`);
    }
    if (fi === 0) {
      if (!m.spawns.entrance) E(`${id}: no 'entrance' spawn`);
      const out = m.warps.filter((w) => w.to === 'world');
      if (!out.length) E(`${id}: no warp back to the world`);
      for (const w of out) if (w.spawn !== id) E(`${id}: world warp targets '${w.spawn}' (expected '${id}')`);
      if (world && !world.spawns[id]) E(`world has no spawn '${id}'`);
      const wIn = world && (DB.maps.world.warps || []).find((w) => w.to === id);
      if (world && (!wIn || wIn.spawn !== 'entrance')) W(`world warp into ${id} ${wIn ? 'targets ' + wIn.spawn : 'missing'}`);
    } else if (m.warps.some((w) => w.to === 'world')) E(`${id}: only floor 1 may lead to the world`);
    // warps
    for (const w of m.warps) {
      if (w.to !== 'world' && !d.floors.includes(w.to)) E(`${id}: warp at ${w.x},${w.y} leaves the dungeon to ${w.to}`);
      const tm = w.to === 'world' ? world : maps[w.to];
      if (tm && !tm.spawns[w.spawn]) E(`${id}: warp at ${w.x},${w.y} → ${w.to}:${w.spawn} (no such spawn)`);
      const t = m.tileAt(w.x, w.y);
      if (!['stairs_up', 'stairs_down', 'warp_pad', 'pit'].includes(t) && !(t === 'door' && w.to === 'world')) E(`${id}: warp at ${w.x},${w.y} stands on ${t}`);
      if (w.sfx && !SFX.includes(w.sfx)) E(`${id}: warp sfx ${w.sfx} unknown`);
    }
    // stairs lead back next to where they came from (pits are one-way)
    for (const w of m.warps) {
      if (w.to === 'world' || m.tileAt(w.x, w.y) === 'pit') continue;
      const tm = maps[w.to];
      const s = tm && tm.spawns[w.spawn];
      if (!s) continue;
      const back = tm.warps.filter((b) => b.to === id && Math.abs(b.x - s.x) + Math.abs(b.y - s.y) <= 1);
      if (!back.length) { E(`${id}: warp ${w.x},${w.y} → ${w.to}:${w.spawn} has no way back next to the arrival`); continue; }
      const ok = back.some((b) => { const bs = m.spawns[b.spawn]; return bs && Math.abs(bs.x - w.x) + Math.abs(bs.y - w.y) <= 1; });
      if (!ok) E(`${id}: the way back from ${w.to}:${w.spawn} does not return next to ${w.x},${w.y}`);
    }
    // hidden (examine-to-find) items are abolished: every treasure must be a visible chest
    for (const h of def.hidden || []) E(`${id}: hidden item ${h.id} (${h.item || h.gold + 'G'}) at ${h.x},${h.y} — make it a visible chest`);
    for (const ch in def.marks || {}) {
      const h = def.marks[ch].hidden;
      if (h) E(`${id}: mark '${ch}' is a hidden item ${h.id} (${h.item || h.gold + 'G'}) — make it a visible chest`);
    }
    // chests
    for (const c of m.chests) {
      if (!tileDef(m, c.x, c.y).pass) E(`${id}: chest ${c.id} on ${m.tileAt(c.x, c.y)}`);
      if (c.item && !DB.items[c.item]) E(`${id}: chest ${c.id} unknown item ${c.item}`);
      if (!c.item && !c.gold) E(`${id}: chest ${c.id} is empty`);
      if (c.item && DB.items[c.item] && DB.items[c.item].type === 'key') E(`${id}: key item ${c.item} in a chest`);
      if (c.troop && c.troop.mons) for (const [mon] of c.troop.mons) if (!DB.monsters[mon]) E(`${id}: mimic chest ${c.id} unknown monster ${mon}`);
      if (m.warpAt(c.x, c.y) || m.eventsAt(c.x, c.y, 'step').length) E(`${id}: chest ${c.id} sits on a warp/event`);
      if (/^door|^stairs|warp_pad|seal|pit/.test(m.tileAt(c.x, c.y))) E(`${id}: chest ${c.id} on ${m.tileAt(c.x, c.y)}`);
      // never right in front of a way through (door, stairs, pad, warp, event, spawn)
      for (const [dx, dy] of DIRS) {
        const x = c.x + dx, y = c.y + dy;
        const tid = m.tileAt(x, y);
        const why = /^door|^stairs|warp_pad|seal|pit/.test(tid) ? tid : m.warpAt(x, y) ? 'a warp' : m.eventIdx.has(m.idx(x, y)) ? 'an event' :
          Object.keys(m.spawns).find((k) => m.spawns[k].x === x && m.spawns[k].y === y) ? 'a spawn' : null;
        if (why) E(`${id}: chest ${c.id} at ${c.x},${c.y} stands right next to ${why} (${x},${y})`);
      }
      report.push(`${id} ${c.id} @${c.x},${c.y}: ${itemName(c)}${c.troop ? ' (mimic)' : ''}`);
    }
    // npcs
    for (const n of m.npcs) {
      if (!gfxHas(n.sprite)) E(`${id}: npc ${n.id} sprite ${n.sprite} not registered`);
      if (n.event && !DB.events[n.event]) E(`${id}: npc ${n.id} event ${n.event} missing`);
      if (!tileDef(m, n.x, n.y).pass && !(n.sprite === 'obj:crest_glow' && m.tileAt(n.x, n.y) === 'pedestal')) E(`${id}: npc ${n.id} on ${m.tileAt(n.x, n.y)}`);
    }
    for (const e of m.events) if (!DB.events[e.id]) E(`${id}: event ${e.id} missing`);
    for (const s of m.signs) texts.push([`${id} sign ${s.x},${s.y}`, s.text]);
    // torches must face a floor; walls should not float
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.tileAt(x, y) === 'wall_torch' && !walkTile(m, x, y + 1)) E(`${id}: torch at ${x},${y} does not face a floor`);
    }
    // the map border must be closed
    for (let x = 0; x < m.w; x++) for (const y of [0, m.h - 1]) if (walkTile(m, x, y) && !m.warpAt(x, y)) E(`${id}: open border at ${x},${y}`);
    for (let y = 0; y < m.h; y++) for (const x of [0, m.w - 1]) if (walkTile(m, x, y) && !m.warpAt(x, y)) E(`${id}: open border at ${x},${y}`);
  });
  for (const b of d.bosses) {
    if (!DB.troops[b.troop]) E(`${d.key}: troop ${b.troop} missing`);
    if (!DB.events[b.event]) E(`${d.key}: event ${b.event} missing`);
    const npcs = d.floors.flatMap((f) => (maps[f] ? maps[f].npcs.filter((n) => n.id === b.npc).map((n) => [f, n]) : []));
    if (npcs.length !== 1) { E(`${d.key}: boss npc ${b.npc} found ${npcs.length}x`); continue; }
    const [bf, n] = npcs[0];
    if (n.sprite !== 'mon:' + b.sprite) E(`${d.key}: boss ${b.npc} sprite ${n.sprite} (expected mon:${b.sprite})`);
    // framing: the field camera keeps 6.5 tiles above the leader, so a 96 px boss is only fully
    // on screen when its event starts at most one row below its feet (the 112 px true form
    // appears where the first form stood and is exempt)
    if (b.npc !== 'demon_king2') {
      for (const e of maps[bf].events) if (e.id === b.event && e.y > n.y + 1) E(`${d.key}: ${b.event} trigger at ${e.x},${e.y} is more than one row below ${b.npc} (sprite cut off)`);
    }
    if (n.event !== b.event) E(`${d.key}: boss ${b.npc} event ${n.event} (expected ${b.event})`);
  }
}

// ------------------------------------------------------------------ reachability
function mkState(flags, items) {
  const S = { flags: new Set(flags), items: new Set(items) };
  S.check = (cond) => {
    if (cond == null || cond === true) return true;
    if (typeof cond === 'string') return cond[0] === '!' ? !S.flags.has(cond.slice(1)) : S.flags.has(cond);
    if (Array.isArray(cond)) return cond.every(S.check);
    if (cond.flag && !S.flags.has(cond.flag)) return false;
    if (cond.notFlag && S.flags.has(cond.notFlag)) return false;
    if (cond.item && !S.items.has(cond.item)) return false;
    if (cond.notItem && S.items.has(cond.notItem)) return false;
    if (cond.all && !cond.all.every(S.check)) return false;
    if (cond.any && !cond.any.some(S.check)) return false;
    return true;
  };
  return S;
}
function tileUnder(S, m, x, y) {
  let id = m.base[m.idx(x, y)];
  for (const p of m.patches) if (x >= p.x && y >= p.y && x < p.x + (p.w || 1) && y < p.y + (p.h || 1) && S.check(p.cond)) id = p.tile || m.legend[p.ch] || id;
  return id;
}
/** BFS over a dungeon for story state S. */
function explore(d, S, safe, ignoreChests) {
  const seen = new Map(); // key -> steps
  const q = [];
  const out = { seen, bossSteps: {}, bossesMet: new Set(), warpsUsed: new Set(), world: false, shortcut: new Set(), dmgSteps: 0 };
  const key = (mid, x, y) => mid + ':' + x + ',' + y;
  const arrive = (mid, sp, steps) => {
    const m = maps[mid];
    const s = m && (typeof sp === 'string' ? m.spawns[sp] : sp);
    if (!s) return;
    const k = key(mid, s.x, s.y);
    if (seen.has(k)) return;
    seen.set(k, steps);
    q.push([mid, s.x, s.y, steps]);
  };
  arrive(d.floors[0], 'entrance', 0);
  while (q.length) {
    const [mid, x, y, st] = q.shift();
    const m = maps[mid];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!m.inBounds(nx, ny)) continue;
      const t = DB.tiles[tileUnder(S, m, nx, ny)];
      if (!t || !t.pass) continue;
      if (safe && t.damage) continue;
      if (t.lock && !S.items.has(t.lock)) continue;
      if (m.npcs.some((n) => n.x === nx && n.y === ny && S.check(n.cond))) continue;
      if (!ignoreChests && m.chests.some((c) => c.x === nx && c.y === ny)) continue;
      const k = key(mid, nx, ny);
      // step events first (like the field), then warps
      const evs = m.events.filter((e) => e.x === nx && e.y === ny && (e.trigger || 'step') === 'step' && S.check(e.cond));
      const bossEv = evs.find((e) => d.bosses.some((b) => b.event === e.id));
      if (bossEv) { out.bossesMet.add(bossEv.id); out.bossSteps[bossEv.id] = Math.min(out.bossSteps[bossEv.id] || Infinity, st + 1); continue; }
      const sc = evs.find((e) => SHORTCUTS[e.id]);
      if (sc) { out.shortcut.add(mid + ':' + sc.id); if (!seen.has(k)) seen.set(k, st + 1); arrive(SHORTCUTS[sc.id][0], SHORTCUTS[sc.id][1], st + 1); continue; }
      const w = m.warpAt(nx, ny);
      if (w) {
        out.warpsUsed.add(mid + ':' + nx + ',' + ny);
        if (!seen.has(k)) seen.set(k, st + 1);
        if (w.to === 'world') { out.world = true; continue; }
        arrive(w.to, w.spawn, st + 1);
        continue;
      }
      if (seen.has(k)) continue;
      seen.set(k, st + 1);
      q.push([mid, nx, ny, st + 1]);
    }
  }
  return out;
}
const near = (out, mid, x, y, self) => (self && out.seen.has(mid + ':' + x + ',' + y)) || DIRS.some(([dx, dy]) => out.seen.has(mid + ':' + (x + dx) + ',' + (y + dy)));
function talkable(out, mid, n) {
  if (near(out, mid, n.x, n.y)) return true;
  // across a counter/altar
  const m = maps[mid];
  return DIRS.some(([dx, dy]) => tileDef(m, n.x + dx, n.y + dy).counter && out.seen.has(mid + ':' + (n.x + 2 * dx) + ',' + (n.y + 2 * dy)));
}
function bossReached(d, out, S, b) {
  if (out.bossesMet.has(b.event)) return true;
  for (const f of d.floors) {
    const n = maps[f] && maps[f].npcs.find((o) => o.id === b.npc);
    if (n && S.check(n.cond) && talkable(out, f, n)) return true;
  }
  return false;
}
/** everything collectable / usable reached in state S */
function inventory(d, out, S) {
  const miss = [];
  for (const f of d.floors) {
    const m = maps[f];
    if (!m) continue;
    for (const c of m.chests) if (!near(out, f, c.x, c.y)) miss.push(`${f} chest ${c.id}`);
    for (const w of m.warps) if (!out.warpsUsed.has(f + ':' + w.x + ',' + w.y)) miss.push(`${f} warp ${w.x},${w.y}→${w.to}`);
    for (const e of m.events) if (S.check(e.cond) && (e.trigger || 'step') === 'step' && !out.seen.has(f + ':' + e.x + ',' + e.y)) miss.push(`${f} event ${e.id} ${e.x},${e.y}`);
    for (const e of m.events) if (S.check(e.cond) && e.trigger === 'examine' && !near(out, f, e.x, e.y, true)) miss.push(`${f} examine ${e.id} ${e.x},${e.y}`);
    for (const n of m.npcs) if (S.check(n.cond) && !talkable(out, f, n)) miss.push(`${f} npc ${n.id}`);
    for (const s of m.signs) if (!near(out, f, s.x, s.y)) miss.push(`${f} sign ${s.x},${s.y}`);
  }
  return miss;
}
/** no chest may block a way through: ignoring the chests must reach the same cells, except a tiny
 *  empty pocket behind a chest (at most 4 cells a floor, e.g. a chest capping an islet or a bed nook) */
function chestsBlockNothing(d, S, out, what) {
  const open = explore(d, S, false, true);
  const chestCell = new Set(d.floors.flatMap((f) => maps[f].chests.map((c) => f + ':' + c.x + ',' + c.y)));
  const cut = {};
  for (const k of open.seen.keys()) {
    if (out.seen.has(k) || chestCell.has(k)) continue;
    const [f, xy] = k.split(':'); const [x, y] = xy.split(',').map(Number);
    const m = maps[f];
    const thing = m.warpAt(x, y) ? 'a warp' : m.eventIdx.has(m.idx(x, y)) ? 'an event' : m.signs.some((s) => s.x === x && s.y === y) ? 'a sign' :
      Object.keys(m.spawns).find((n) => m.spawns[n].x === x && m.spawns[n].y === y) ? 'a spawn' : null;
    if (thing) E(`${d.key}: ${thing} at ${k} is cut off by a chest (${what})`);
    (cut[f] = cut[f] || []).push(xy);
  }
  for (const f in cut) if (cut[f].length > 4) E(`${d.key}: chests cut off ${cut[f].length} cells of ${f} (${what}): ${cut[f].slice(0, 6).join(' ')}…`);
}
const pathInfo = [];
for (const d of DUNGEONS) {
  if (!d.floors.every((f) => maps[f])) continue;
  const base = ['intro_done'];
  // no keys: the locked dungeons stop at their door
  if (d.keys.length) {
    const S = mkState(base, []);
    const out = explore(d, S);
    chestsBlockNothing(d, S, out, 'no keys');
    if (d.gated) for (const b of d.bosses) if (bossReached(d, out, S, b)) E(`${d.key}: boss ${b.npc} reachable without ${d.keys.join('+')}`);
    const deep = [...out.seen.keys()].filter((k) => !k.startsWith(d.floors[0] + ':'));
    if (d.key !== 'demon' && deep.length) E(`${d.key}: ${deep.length} cells beyond floor 1 reachable without the gold key`);
    if (d.key === 'demon') {
      const S2 = mkState(base, ['silver_key']);
      const o2 = explore(d, S2);
      const vault = d.floors.flatMap((f) => maps[f].chests.filter((c) => c.id.includes('vault')).map((c) => [f, c]));
      for (const [f, c] of vault) if (near(o2, f, c.x, c.y)) E(`demon: vault chest ${c.id} reachable with only the silver key`);
    }
  }
  // boss by boss
  const flags = base.slice();
  const items = d.keys.slice();
  d.bosses.forEach((b, i) => {
    const S = mkState(flags, items);
    const out = explore(d, S);
    chestsBlockNothing(d, S, out, 'before ' + b.flag);
    if (!bossReached(d, out, S, b)) E(`${d.key}: boss ${b.npc} (${b.flag}) not reachable after ${flags.slice(1).join(', ') || 'nothing'}`);
    for (const later of d.bosses.slice(i + 1)) if (later.npc !== b.npc && later.event !== b.event && bossReached(d, out, S, later)) E(`${d.key}: boss ${later.npc} reachable before ${b.flag}`);
    // nothing behind the boss: exit circles and crests stay out of reach
    for (const f of d.floors) for (const e of maps[f].events) if (e.id === 'db_exit_circle' && S.check(e.cond)) E(`${d.key}: exit circle active before ${b.flag}`);
    const steps = out.bossSteps[b.event] || Math.min(...[...out.seen.entries()].filter(([k]) => {
      const [f, xy] = k.split(':'); const [x, y] = xy.split(',').map(Number);
      const n = maps[f].npcs.find((o) => o.id === b.npc);
      return n && Math.abs(n.x - x) + Math.abs(n.y - y) <= 2;
    }).map(([, v]) => v).concat([Infinity]));
    const so = explore(d, S, true);
    const safeSteps = so.bossSteps[b.event];
    pathInfo.push(`${d.key}: ${b.npc} ≈ ${steps === Infinity ? '?' : steps} steps from the entrance` + (safeSteps && safeSteps !== steps ? ` (${safeSteps} avoiding damage floors)` : safeSteps ? '' : ' (no way round the damage floors)'));
    flags.push(b.flag);
  });
  // after the last boss (crest still on its altar): everything
  const S = mkState(flags, items);
  const out = explore(d, S);
  chestsBlockNothing(d, S, out, 'all bosses beaten');
  for (const mis of inventory(d, out, S)) E(`${d.key}: unreachable after all bosses: ${mis}`);
  if (!out.world) E(`${d.key}: the way out to the world is not reachable`);
  if (d.crest) {
    const n = d.floors.flatMap((f) => maps[f].npcs.filter((o) => o.event === d.crest.event).map((o) => [f, o]));
    if (n.length !== 1) E(`${d.key}: crest npc for ${d.crest.event} found ${n.length}x`);
  }
  const exits = d.floors.flatMap((f) => maps[f].events.filter((e) => e.id === 'db_exit_circle').map((e) => [f, e]));
  if (d.key !== 'demon' && exits.length !== 1) E(`${d.key}: expected one exit circle, found ${exits.length}`);
  for (const [f, e] of exits) if (!out.seen.has(f + ':' + e.x + ',' + e.y)) E(`${d.key}: exit circle ${f} ${e.x},${e.y} unreachable`);
  let lava = 0;
  for (const k of out.seen.keys()) { const [f, xy] = k.split(':'); const [x, y] = xy.split(',').map(Number); if (tileDef(maps[f], x, y).damage) lava++; }
  pathInfo.push(`${d.key}: ${out.seen.size} cells reachable (${lava} damage floor)`);
}

// ------------------------------------------------------------------ events (dry run)
function stubEv(state, log, map) {
  const ev = {
    map, self: null, leader: '{leader}',
    say: async (t) => { texts.push([log.where, Array.isArray(t) ? t.join('\f') : t]); },
    ask: async (t) => { if (t) texts.push([log.where, t]); return 0; },
    yesno: async (t) => { if (t) texts.push([log.where, t]); return true; },
    flag: (f) => state.flags.has(f),
    setFlag: (f, v = true) => { if (v) { state.flags.add(f); log.flags.push(f); } else state.flags.delete(f); },
    check: (c) => mkState([...state.flags], [...state.items]).check(c),
    var: () => 0, setVar: () => {},
    has: (it) => state.items.has(it),
    take: (it) => state.items.delete(it),
    gold: () => 0, takeGold: () => true,
    give: async (it) => { if (!DB.items[it]) E(`${log.where}: gives unknown item ${it}`); state.items.add(it); log.items.push(it); return true; },
    giveGold: async () => {},
    battle: async (t) => { if (!DB.troops[t]) E(`${log.where}: unknown troop ${t}`); log.battles.push(t); return 'win'; },
    warp: async (m, s) => { log.warps.push(m + ':' + s); },
    wait: async () => {}, fadeOut: async () => {}, fadeIn: async () => {}, shake: async () => {}, flash: async () => {},
    sfx: (id) => { if (!SFX.includes(id)) E(`${log.where}: unknown sfx ${id}`); },
    bgm: () => {}, jingle: async () => {},
    npc: () => ({ face() {}, walk: async () => {}, hide() {}, show() {}, setPos() {} }),
    player: { face() {}, walk: async () => {}, x: 0, y: 0 },
    heal: () => { log.heal++; },
    setObjective: (id) => { if (!DB.objectives || !DB.objectives[id]) E(`${log.where}: unknown objective ${id}`); log.objective = id; },
    refresh: () => {},
    ending: async () => { log.ending++; },
    closeMessage: () => {},
  };
  return ev;
}
async function dry(id, flags, items, map) {
  const state = { flags: new Set(flags), items: new Set(items) };
  const log = { where: 'event ' + id, flags: [], items: [], battles: [], warps: [], heal: 0, ending: 0, objective: null };
  const def = DB.events[id];
  if (!def) { E(`event ${id} missing`); return log; }
  try { await def.run(stubEv(state, log, map)); } catch (e) { E(`event ${id} threw: ${e.stack || e}`); }
  return log;
}
function sameGives(id, log) {
  const meta = (DB.events[id].meta || {}).gives || [];
  const got = log.flags.map((f) => 'flag:' + f).concat(log.items.map((i) => 'item:' + i));
  for (const g of meta) if (!got.includes(g)) E(`event ${id}: meta gives ${g} but the script did not`);
  for (const g of got) if (!meta.includes(g)) E(`event ${id}: script gives ${g} missing from meta`);
}
async function events() {
  const CREST5 = ['crest_wind', 'crest_water', 'crest_earth'];
  const withObjectives = () => { R.Game = R.Game || R.State.newGame(); };
  withObjectives();
  // exit circle → escape of the current map
  let log = await dry('db_exit_circle', [], [], 'volcano_2');
  if (log.warps[0] !== 'world:volcano_1') E(`db_exit_circle warps to ${log.warps[0]}`);
  // bosses (+ crests)
  for (const d of DUNGEONS) {
    for (const b of d.bosses) {
      if (b.npc === 'demon_king2') continue;
      log = await dry(b.event, ['intro_done'], CREST5.concat(d.keys), d.floors[d.floors.length - 1]);
      if (!log.battles.includes(b.troop)) E(`event ${b.event} never fights ${b.troop}`);
      sameGives(b.event, log);
      const again = await dry(b.event, ['intro_done', ...log.flags], CREST5.concat(d.keys), d.floors[0]);
      if (again.battles.length) E(`event ${b.event} fights again after ${b.flag}`);
    }
    if (d.crest) {
      const pre = await dry(d.crest.event, [], [], d.floors[0]);
      if (pre.items.length) E(`crest ${d.crest.event} given before its boss`);
      log = await dry(d.crest.event, [d.bosses[0].flag], CREST5, d.floors[0]);
      sameGives(d.crest.event, log);
      if (!log.items.includes(d.crest.item)) E(`crest ${d.crest.event} does not give ${d.crest.item}`);
    }
  }
  // the ice boss hands over the gold key
  log = await dry('ice_boss', [], [], 'ice_cave_2');
  if (!log.items.includes('gold_key')) E('ice_boss does not give gold_key');
  // the final sequence: king1 → true form → heal → king2 → game_clear → ending
  log = await dry('demon_king', ['boss_general1_done', 'boss_general2_done'], [], 'demon_castle_5');
  if (log.battles.join(',') !== 'boss_king1,boss_king2') E(`demon_king battles: ${log.battles.join(',')}`);
  if (!log.flags.includes('game_clear') || !log.ending) E('demon_king does not end in game_clear + ending');
  if (!log.heal) W('demon_king: no heal between the two forms');
  sameGives('demon_king', log);
  // retry after losing to the true form: only the second battle
  log = await dry('demon_king', ['boss_king1_done'], [], 'demon_castle_5');
  if (log.battles.join(',') !== 'boss_king2') E(`demon_king retry battles: ${log.battles.join(',')}`);
  if (!log.flags.includes('game_clear')) E('demon_king retry does not reach game_clear');
  // other events
  for (const id of ['demon_castle_voice', 'demon_seal', 'star_hint', ...Object.keys(SHORTCUTS)]) {
    if (!DB.events[id]) continue;
    log = await dry(id, [], [], 'demon_castle_1');
    sameGives(id, log);
    if (SHORTCUTS[id] && log.warps[0] !== SHORTCUTS[id].join(':')) E(`${id} warps to ${log.warps[0]}`);
  }
  // every event of this area has meta
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'events', 'dungeons_b.js'), 'utf8');
  for (const m of src.matchAll(/E\.([a-z0-9_]+) = \{/g)) if (!DB.events[m[1]] || !DB.events[m[1]].meta) E(`event ${m[1]} without meta`);
  // texts: message window (20 full-width chars a line, 4 lines a page), style, no borrowed names
  for (const [where, t] of texts) if (typeof t === 'string') textCheck(where, t);
}

// ------------------------------------------------------------------ text style (STYLE_JA.md)
// Hero names are chosen by the player (up to 6 full-width characters): lines are measured with
// the longest possible name so that they still fit the window.
const LONG_NAME = 'アアアアアア';
const HERO_NAMES = ['ユウキ', 'ノン', 'ハニバニ', 'メテム'];
const JA = '\u3041-\u30ff\u4e00-\u9fff\u3005\u3001\u3002\u300c-\u300f\uff01\uff1f\u2026';
const DQ_SPACE = new RegExp(`[${JA}][ \u3000]+[${JA}]`, 'g');
function textCheck(where, t) {
  for (const w of FORBIDDEN) if (t.includes(w)) E(`${where}: forbidden word ${w}`);
  for (const n of HERO_NAMES) if (t.includes(n)) E(`${where}: hard-coded hero name ${n} (use a placeholder)`);
  for (const m of t.matchAll(/\{([a-z]+)\}/g)) if (!['yuki', 'non', 'metem', 'leader'].includes(m[1])) E(`${where}: unknown placeholder {${m[1]}}`);
  // DQ-style spacing: the only space allowed in Japanese text is a full-width one after ！/？
  for (const m of t.matchAll(DQ_SPACE)) {
    if (!(m[0][1] === '\u3000' && m[0].length === 3 && '！？'.includes(m[0][0]))) E(`${where}: DQ-style space in "${m[0]}"`);
  }
  const bang = t.match(/.?[！？][^\s\u3000」』！？…\n\f]./);
  if (bang) E(`${where}: mid-line ！/？ needs a full-width space after it: ${bang[0]}`);
  const cw = (ch) => (ch.charCodeAt(0) < 0x2000 ? 0.5 : 1);
  for (const page of t.replace(/\{(yuki|non|metem|leader)\}/g, LONG_NAME).split('\f')) {
    const lines = page.split('\n');
    if (lines.length > 4) E(`${where}: page with ${lines.length} lines: ${page.replace(/\n/g, '/')}`);
    for (const l of lines) { const n = [...l].reduce((a, c) => a + cw(c), 0); if (n > 20) E(`${where}: line too wide (${n} with 6-char names): ${l}`); }
  }
}

// ------------------------------------------------------------------ PNG render
async function renderPng() {
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  const out = path.resolve(PNG);
  fs.mkdirSync(out, { recursive: true });
  const html = path.join(__dirname, '..', 'dist', 'index.html');
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 700 } })).newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + html);
  await page.waitForTimeout(1500);
  const only = opt('only', null);
  for (const id of MINE) {
    if (only && !only.split(',').includes(id)) continue;
    const url = await page.evaluate((mid) => {
      const R = window.RPG;
      if (!R.Game) R.State.newGame();
      const m = R.FieldMap.compile(mid);
      if (!m) return null;
      const TS = 16, G = R.Gfx;
      const cv = document.createElement('canvas');
      cv.width = m.w * TS; cv.height = m.h * TS;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
      const plain = (t) => (m.theme && G.has('tile:' + m.theme + ':' + t) ? G.get('tile:' + m.theme + ':' + t) : G.has('tile:' + t) ? G.get('tile:' + t) : null);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        let g = null;
        if (R.Art && R.Art.localTile) { try { g = R.Art.localTile(m, x, y); } catch (e) { g = null; } }
        if (!g) g = plain(m.tileAt(x, y));
        if (Array.isArray(g)) g = g[0];
        if (g) c.drawImage(g, x * TS, y * TS);
      }
      const chest = G.get('obj:chest');
      for (const o of m.chests) {
        c.drawImage(Array.isArray(chest) ? chest[0] : chest, o.x * TS, o.y * TS);
        if (o.troop) { c.strokeStyle = '#f0f'; c.strokeRect(o.x * TS + 0.5, o.y * TS + 0.5, 15, 15); }
      }
      for (const p of m.patches) { c.strokeStyle = '#8f8'; c.strokeRect(p.x * TS + 2.5, p.y * TS + 2.5, 11, 11); }
      const list = m.npcs.map((n) => {
        const s = G.get(n.sprite);
        let img = s;
        if (s && !s.width) img = Array.isArray(s) ? s[0] : (Array.isArray(s[n.dir] || s.down) ? (s[n.dir] || s.down)[0] : s.down);
        return [n.y, img, n];
      }).filter((a) => a[1]).sort((a, b) => a[0] - b[0]);
      for (const [, img, n] of list) { c.globalAlpha = 0.85; c.drawImage(img, n.x * TS + 8 - (img.width >> 1), n.y * TS + TS - img.height); c.globalAlpha = 1; }
      c.font = '9px monospace';
      for (const e of m.events) { c.strokeStyle = e.id === 'db_exit_circle' ? '#8f8' : e.trigger === 'examine' ? '#88f' : '#fa0'; c.strokeRect(e.x * TS + 4.5, e.y * TS + 4.5, 7, 7); }
      for (const w of m.warps) { c.strokeStyle = '#0ff'; c.lineWidth = 2; c.strokeRect(w.x * TS + 1, w.y * TS + 1, 14, 14); c.lineWidth = 1; c.fillStyle = '#0ff'; c.fillText('→' + (w.to === 'world' ? 'W' : w.to.slice(-1)) + ':' + w.spawn, w.x * TS - 4, w.y * TS - 2); }
      for (const k in m.spawns) { const s = m.spawns[k]; c.fillStyle = '#0f0'; c.fillRect(s.x * TS + 6, s.y * TS + 6, 4, 4); c.fillText(k, s.x * TS - 2, s.y * TS + 25); }
      // grid ticks every 5 tiles
      c.fillStyle = 'rgba(255,255,255,0.5)';
      for (let x = 0; x < m.w; x += 5) c.fillText(String(x), x * TS + 2, 9);
      for (let y = 5; y < m.h; y += 5) c.fillText(String(y), 2, y * TS + 9);
      return cv.toDataURL('image/png');
    }, id);
    if (!url) continue;
    const f = path.join(out, id + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('png →', f);
  }
  await browser.close();
}

(async () => {
  await events();
  if (VERBOSE) console.log('treasure:\n  ' + report.join('\n  ') + '\n\npaths:\n  ' + pathInfo.join('\n  ') + '\n');
  for (const w of warns) console.log('warn: ' + w);
  for (const e of errors) console.log('ERROR: ' + e);
  console.log(errors.length ? `\n${errors.length} error(s)` : '\ndungeons B: OK');
  if (PNG) await renderPng();
  process.exitCode = errors.length ? 1 : 0;
})();
