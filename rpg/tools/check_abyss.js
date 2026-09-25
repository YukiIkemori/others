#!/usr/bin/env node
// Checker for the post-game dungeon 「深淵の迷宮」: src/maps/abyss.js + src/events/postgame.js
// (+ the islet entrance on the world map, tools/gen_world.js).
//
//   node tools/check_abyss.js               static checks + reachability + event dry runs + texts
//   node tools/check_abyss.js --verbose     also list the treasure and the path lengths
//   node tools/check_abyss.js --png DIR     also render every floor with the real tile art (objects,
//                                           spawns, warps, events marked) to DIR/<map>.png
//
// Static: size 44x36..60x48, equal rows, legend/mark chars and `under` tiles, required fields (name,
// type, theme, bgm, encounter zone d_abyssN, escape to the world spawn abyss_1), decor rows (size,
// known chars, wall pieces on walls, furniture on floor), floor 1 entrance + the stairs out, stairs
// and warp pads that lead back next to where they came from (every pad is a two-way pair on the same
// floor), chests on walkable tiles with existing items and globally unique ids, every abyss-exclusive
// chest item (`exclusive: 'abyss_chest'`) placed, no hidden items, NPC sprites/events, the boss NPC
// (mon:boss_abyss) framed by its trigger band, the sanctuary spirit, torches facing a floor, closed
// borders. World: the islet entrance (spawn abyss_1, dock abyss_dock), its tilePatch/step event with
// cond game_clear, plain ground before the clear, reachable by ship from porta_dock.
// Reachability: BFS over the four floors per story state (tilePatches and conds follow the flags,
// warps fire when stepped on, step events that warp are followed, NPCs & chests block):
//   1. game_clear only: the boss is reached, the lord's alcove and the exit circle are not, the
//      gate circle of floor 1 is sealed; every chest, stair, pad and the spirit are reached.
//   2. + abyss_sanctuary: the gate circle of floor 1 leads to the sanctuary.
//   3. + abyss_clear: the exit circle and the way out to the world.
// The main path to the lord must also exist without stepping on damage floors.
// Events: every script runs against a stub `ev` (battles won, scripted answers); the flags and items
// it hands out must equal its meta.gives; warps must match meta.warp; the lord gives the rewards,
// the 称号 and the bonus scene; a declined challenge or a second visit after the win fights nothing.
// Texts (STYLE_JA.md): glossary names, window width with 6-character hero names, 4 lines a page,
// no hard-coded hero names, no DQ-style spaces, a full-width space after a mid-line ！/？.
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
for (const e of R._nodeLoadErrors) if (/abyss|postgame/.test(e)) E('load: ' + e.split('\n')[0]);
const mapWarns = [];
R.warn = (...a) => mapWarns.push(a.join(' '));

// ------------------------------------------------------------------ the plan
const FLOORS = ['abyss_1', 'abyss_2', 'abyss_3', 'abyss_4'];
const ZONES = ['d_abyss1', 'd_abyss2', 'd_abyss3', 'd_abyss4'];
const THEMES = ['tower', 'tower', 'demon', 'demon'];
const NAME = '深淵の迷宮';
const BOSS = { npc: 'abyss_lord', sprite: 'mon:boss_abyss', event: 'abyss_lord', troop: 'boss_abyss', flag: 'abyss_clear' };
const SPIRIT = { npc: 'abyss_spirit', event: 'abyss_spirit' };
const EXIT = 'abyss_exit';
const GATE = 'abyss_gate_pad';
const WORLD_EVENT = 'abyss_entrance';
const TITLE = '深淵を越えし者';
const REWARDS = ['pg_genesis_sword', 'pg_abyss_crest'];
const BGM = 'title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ending'.split(' ');
const SFX = ('cursor confirm confirm_soft cancel buzzer menu_open attack hit crit miss enemy_attack hurt magic fire ice thunder wind holy dark ' +
  'earth water heal revive buff debuff status poison sleep death enemy_die boss_die escape stairs door locked chest item gold step_damage ' +
  'ship bump warp teleport steal jump breath roar shake').split(' ');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const FORBIDDEN = ['メラ', 'ホイミ', 'ルーラ', 'スライム', 'ケアル', 'ファイガ', 'エスナ', 'レイズ', 'リジェネ', 'ギラ', 'ベホマ', 'リレミト', 'ドラクエ', 'ファイナル', 'ゾーマ', 'ハーゴン', 'シドー', '白魔道士', '黒魔道士', '時魔道士'];

// ------------------------------------------------------------------ compile (the real loader)
R.State.newGame();
R.Game.flags.game_clear = true;
const maps = {};
for (const id of FLOORS) {
  if (!DB.maps[id]) { E(`map ${id} missing`); continue; }
  mapWarns.length = 0;
  maps[id] = R.FieldMap.compile(id);
  for (const w of mapWarns) E(`${id}: loader: ${w}`);
}
const world = DB.maps.world ? R.FieldMap.compile('world') : null;
if (!world) E('world map not loaded');
const gfxHas = (k) => (R.Gfx.has ? R.Gfx.has(k) : !!(R.Gfx._defs && R.Gfx._defs[k]));

// ------------------------------------------------------------------ static checks
const tileDef = (m, x, y) => DB.tiles[m.tileAt(x, y)] || { pass: false };
const walkTile = (m, x, y) => m.inBounds(x, y) && tileDef(m, x, y).pass;
const itemName = (c) => (c.gold ? c.gold + 'G' : (DB.items[c.item] ? DB.items[c.item].name : '?' + c.item) + (c.n > 1 ? '×' + c.n : ''));
const texts = [];
const report = [];
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
    if (allIds[c] && (FLOORS.includes(id) || FLOORS.includes(allIds[c]))) E(`duplicate chest id ${c} (${allIds[c]} and ${id})`);
    allIds[c] = id;
  }
}
const chestItems = new Set();
/** a map's ways elsewhere: warps + step events whose meta.warp moves the party */
function links(m) {
  const ev = m.events.filter((e) => (e.trigger || 'step') === 'step' && DB.events[e.id] && DB.events[e.id].meta && DB.events[e.id].meta.warp)
    .map((e) => Object.assign({ x: e.x, y: e.y, event: e.id }, DB.events[e.id].meta.warp));
  return m.warps.concat(ev);
}

FLOORS.forEach((id, fi) => {
  const m = maps[id];
  if (!m) return;
  const def = DB.maps[id];
  const legend = DB.legends.local;
  if (m.w < 44 || m.h < 36 || m.w > 60 || m.h > 48) E(`${id}: size ${m.w}x${m.h} outside 44x36..60x48`);
  def.rows.forEach((r, y) => { if (r.length !== m.w) E(`${id}: row ${y} has length ${r.length} (expected ${m.w})`); });
  for (const ch in def.marks || {}) {
    if (ch in legend) E(`${id}: mark char '${ch}' is a legend char`);
    if (!R.MARK_CHARS_LOCAL.includes(ch)) E(`${id}: mark char '${ch}' is not in the free list`);
    const u = def.marks[ch].under;
    if (u != null && !legend[u]) E(`${id}: mark '${ch}' has unknown under '${u}'`);
    if (!def.rows.some((r) => r.includes(ch))) W(`${id}: mark '${ch}' never used`);
  }
  for (const r of def.rows) for (const ch of r) if (!legend[ch] && !(def.marks && def.marks[ch])) E(`${id}: unknown char '${ch}'`);
  if (def.type !== 'dungeon') E(`${id}: type ${def.type} (expected dungeon)`);
  if (def.name !== NAME) E(`${id}: name ${def.name} (expected ${NAME})`);
  if (def.theme !== THEMES[fi]) E(`${id}: theme ${def.theme} (expected ${THEMES[fi]})`);
  if (def.bgm !== 'lastdungeon') E(`${id}: bgm ${def.bgm} (expected lastdungeon)`);
  if (def.encounter !== ZONES[fi]) E(`${id}: encounter ${def.encounter} (expected ${ZONES[fi]})`);
  if (!DB.encounters[def.encounter]) E(`${id}: encounter zone ${def.encounter} not defined`);
  const esc = def.escape;
  if (!esc || esc.to !== 'world' || esc.spawn !== 'abyss_1') E(`${id}: escape must be {to:'world', spawn:'abyss_1'}`);
  if (!m.spawns.entrance) E(`${id}: no 'entrance' spawn`);
  // decor
  if (def.decor) {
    if (def.decor.length !== m.h) E(`${id}: decor has ${def.decor.length} rows`);
    def.decor.forEach((r, y) => { if (r.length !== m.w) E(`${id}: decor row ${y} length ${r.length}`); });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const d = m.decorAt(x, y);
      if (!d) continue;
      const dd = DB.decor[d];
      if (!gfxHas('decor:' + d) && !(R.Art && R.Art.decorAuto && R.Art.decorAuto[d])) E(`${id}: decor ${d} has no art`);
      if (dd.wall && walkTile(m, x, y)) E(`${id}: wall decor ${d} on floor at ${x},${y}`);
      if (!dd.wall && !walkTile(m, x, y)) E(`${id}: floor decor ${d} on ${m.tileAt(x, y)} at ${x},${y}`);
      if (!dd.wall && !dd.pass && (m.warpAt(x, y) || m.chestAt(x, y) || m.npcAt(x, y) || m.events.some((e) => e.x === x && e.y === y))) E(`${id}: furniture ${d} on an object at ${x},${y}`);
    }
  }
  // spawns
  for (const s in m.spawns) {
    const p = m.spawns[s];
    const w = m.warpAt(p.x, p.y);
    if (w && m.tileAt(p.x, p.y) !== 'warp_pad') E(`${id}: spawn ${s} sits on a warp`);
    const padLater = m.patches.some((q) => q.x === p.x && q.y === p.y && q.ch === 'P');
    if (!walkTile(m, p.x, p.y) && !padLater) E(`${id}: spawn ${s} on ${m.tileAt(p.x, p.y)}`);
    if (m.npcAt(p.x, p.y) || m.chestAt(p.x, p.y)) E(`${id}: spawn ${s} blocked by an object`);
  }
  // the way out (floor 1) / no way out elsewhere
  const out = m.warps.filter((w) => w.to === 'world');
  if (fi === 0) {
    if (!out.length) E(`${id}: no stairs back to the world`);
    for (const w of out) if (w.spawn !== 'abyss_1') E(`${id}: world warp targets '${w.spawn}' (expected 'abyss_1')`);
  } else if (out.length) E(`${id}: only floor 1 may lead to the world`);
  // warps
  for (const w of m.warps) {
    if (w.to !== 'world' && !FLOORS.includes(w.to)) E(`${id}: warp at ${w.x},${w.y} leaves the dungeon to ${w.to}`);
    const tm = w.to === 'world' ? world : maps[w.to];
    if (tm && !tm.spawns[w.spawn]) E(`${id}: warp at ${w.x},${w.y} → ${w.to}:${w.spawn} (no such spawn)`);
    const t = m.tileAt(w.x, w.y);
    if (!['stairs_up', 'stairs_down', 'warp_pad'].includes(t)) E(`${id}: warp at ${w.x},${w.y} stands on ${t}`);
    if (t === 'stairs_down' && w.to !== FLOORS[fi + 1]) E(`${id}: down stairs at ${w.x},${w.y} lead to ${w.to}`);
    if (t === 'stairs_up' && w.to !== (fi ? FLOORS[fi - 1] : 'world')) E(`${id}: up stairs at ${w.x},${w.y} lead to ${w.to}`);
  }
  // every pad tile is a warp or a step event (the gate circle), now or after its patch
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.base[m.idx(x, y)] !== 'warp_pad') continue;
    if (!m.warpAt(x, y) && !m.events.some((e) => e.x === x && e.y === y)) E(`${id}: warp pad at ${x},${y} goes nowhere`);
  }
  for (const p of m.patches) if (p.ch === 'P' && !m.events.some((e) => e.x === p.x && e.y === p.y && (e.trigger || 'step') === 'step')) E(`${id}: patched pad at ${p.x},${p.y} has no step event`);
  // stairs & pads (and step events that warp) lead back next to where they came from
  for (const w of links(m)) {
    if (w.to === 'world') continue;
    const tm = maps[w.to];
    const s = tm && tm.spawns[w.spawn];
    if (!s) continue;
    const back = links(tm).filter((b) => b.to === id && Math.abs(b.x - s.x) + Math.abs(b.y - s.y) <= 1);
    if (!back.length) { E(`${id}: warp ${w.x},${w.y} → ${w.to}:${w.spawn} has no way back next to the arrival`); continue; }
    const ok = back.some((b) => { const bs = m.spawns[b.spawn]; return bs && Math.abs(bs.x - w.x) + Math.abs(bs.y - w.y) <= 1; });
    if (!ok) E(`${id}: the way back from ${w.to}:${w.spawn} does not return next to ${w.x},${w.y}`);
    if (m.tileAt(w.x, w.y) === 'warp_pad' && w.to === id && !(s.x === w.x && s.y === w.y) && tm.tileAt(s.x, s.y) !== 'warp_pad') E(`${id}: pad ${w.x},${w.y} lands off a pad`);
  }
  // chests
  for (const c of m.chests) {
    if (!tileDef(m, c.x, c.y).pass) E(`${id}: chest ${c.id} on ${m.tileAt(c.x, c.y)}`);
    if (c.item && !DB.items[c.item]) E(`${id}: chest ${c.id} unknown item ${c.item}`);
    if (!c.item && !c.gold) E(`${id}: chest ${c.id} is empty`);
    if (c.item && DB.items[c.item] && DB.items[c.item].type === 'key') E(`${id}: key item ${c.item} in a chest`);
    if (c.troop && c.troop.mons) for (const [mon] of c.troop.mons) if (!DB.monsters[mon]) E(`${id}: mimic chest ${c.id} unknown monster ${mon}`);
    if (m.warpAt(c.x, c.y) || m.events.some((e) => e.x === c.x && e.y === c.y)) E(`${id}: chest ${c.id} sits on a warp/event`);
    if (c.item) chestItems.add(c.item);
    report.push(`${id} ${c.id} @${c.x},${c.y}: ${itemName(c)}${c.troop ? ' (mimic)' : ''}`);
  }
  if (m.hidden.length) E(`${id}: ${m.hidden.length} hidden item(s) — every treasure must be a visible chest`);
  // npcs
  for (const n of m.npcs) {
    if (!gfxHas(n.sprite)) E(`${id}: npc ${n.id} sprite ${n.sprite} not registered`);
    if (n.event && !DB.events[n.event]) E(`${id}: npc ${n.id} event ${n.event} missing`);
    if (!tileDef(m, n.x, n.y).pass) E(`${id}: npc ${n.id} on ${m.tileAt(n.x, n.y)}`);
  }
  for (const e of m.events) if (!DB.events[e.id]) E(`${id}: event ${e.id} missing`);
  for (const s of m.signs) texts.push([`${id} sign ${s.x},${s.y}`, s.text]);
  // torches must face a floor; the border must be closed
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.tileAt(x, y) === 'wall_torch' && !walkTile(m, x, y + 1)) E(`${id}: torch at ${x},${y} does not face a floor`);
  }
  for (let x = 0; x < m.w; x++) for (const y of [0, m.h - 1]) if (walkTile(m, x, y)) E(`${id}: open border at ${x},${y}`);
  for (let y = 0; y < m.h; y++) for (const x of [0, m.w - 1]) if (walkTile(m, x, y)) E(`${id}: open border at ${x},${y}`);
});
// the abyss-exclusive chest gear is all placed
for (const id in DB.items) if (DB.items[id].exclusive === 'abyss_chest' && !chestItems.has(id)) E(`item ${id} (exclusive: abyss_chest) is in no abyss chest`);
// the boss, its band and the spirit
const bossAt = FLOORS.flatMap((f) => (maps[f] ? maps[f].npcs.filter((n) => n.id === BOSS.npc).map((n) => [f, n]) : []));
if (bossAt.length !== 1) E(`boss npc ${BOSS.npc} found ${bossAt.length}x`);
else {
  const [bf, n] = bossAt[0];
  if (bf !== 'abyss_4') E(`the boss stands on ${bf}, not on the last floor`);
  if (n.sprite !== BOSS.sprite) E(`boss sprite ${n.sprite} (expected ${BOSS.sprite})`);
  if (n.event !== BOSS.event) E(`boss event ${n.event} (expected ${BOSS.event})`);
  if (JSON.stringify(n.cond) !== JSON.stringify('!' + BOSS.flag)) E(`boss cond ${JSON.stringify(n.cond)} (expected '!${BOSS.flag}')`);
  const band = maps[bf].events.filter((e) => e.id === BOSS.event);
  if (!band.length) E('the boss has no trigger floor');
  for (const e of band) {
    if (e.y > n.y + 1) E(`boss trigger at ${e.x},${e.y} is more than one row below its feet (sprite cut off)`);
    if (JSON.stringify(e.cond) !== JSON.stringify('!' + BOSS.flag)) E(`boss trigger at ${e.x},${e.y} cond ${JSON.stringify(e.cond)}`);
  }
}
if (!DB.troops[BOSS.troop]) E(`troop ${BOSS.troop} missing`);
else {
  const tr = DB.troops[BOSS.troop];
  if (!tr.noEscape) E(`troop ${BOSS.troop} must be noEscape`);
  if (tr.bgm !== 'lastboss') W(`troop ${BOSS.troop} bgm ${tr.bgm}`);
}
const spiritAt = FLOORS.flatMap((f) => (maps[f] ? maps[f].npcs.filter((n) => n.id === SPIRIT.npc).map((n) => [f, n]) : []));
if (spiritAt.length !== 1) E(`spirit npc ${SPIRIT.npc} found ${spiritAt.length}x`);
else if (spiritAt[0][1].event !== SPIRIT.event) E(`spirit event ${spiritAt[0][1].event}`);
// monsters of the dungeon (the bestiary lists every R.DB.monsters entry)
const zoneMons = new Set();
for (const z of ZONES) {
  const enc = DB.encounters[z];
  if (!enc) continue;
  for (const g of enc.groups) for (const [mid] of g.mons) zoneMons.add(mid);
  const rare = DB.rareEncounters && DB.rareEncounters[z];
  if (!rare) E(`zone ${z} has no rare encounter`);
  else { zoneMons.add(rare.mon); if (!DB.monsters[rare.mon]) E(`rare monster ${rare.mon} missing`); }
}
for (const mid of zoneMons) if (!DB.monsters[mid]) E(`abyss monster ${mid} missing`);
for (const c of FLOORS.flatMap((f) => (maps[f] ? maps[f].chests : []))) if (c.troop) for (const [mid] of c.troop.mons) zoneMons.add(mid);
if (DB.monsters.abyss_lord) zoneMons.add('abyss_lord');

// ------------------------------------------------------------------ the world entrance
const worldInfo = [];
if (world) {
  const wdef = DB.maps.world;
  const sp = world.spawns.abyss_1, dock = world.spawns.abyss_dock;
  if (!sp) E('world spawn abyss_1 missing');
  if (!dock) E('world spawn abyss_dock missing');
  if (sp) {
    const patch = (wdef.tilePatches || []).find((p) => p.x === sp.x && p.y === sp.y);
    if (!patch || patch.cond !== 'game_clear' || !DB.tiles[DB.legends.world[patch.ch]] || !DB.tiles[DB.legends.world[patch.ch]].warpIcon) E('world: the abyss entrance needs a tilePatch {cond:game_clear} to an icon at spawn abyss_1');
    const ev = (wdef.events || []).find((e) => e.x === sp.x && e.y === sp.y);
    if (!ev || ev.id !== WORLD_EVENT || ev.cond !== 'game_clear' || (ev.trigger || 'step') !== 'step') E(`world: the abyss entrance needs a step event ${WORLD_EVENT} {cond:game_clear} at spawn abyss_1`);
    const baseT = DB.tiles[world.base[world.idx(sp.x, sp.y)]];
    if (!baseT || !baseT.pass || baseT.warpIcon) E('world: the entrance cell must be plain walkable ground before the clear');
    if (world.warpAt(sp.x, sp.y)) E('world: a warp at the entrance cell would work before the clear');
    // by ship from porta_dock to abyss_dock, then on foot to the entrance
    const W2 = world.w, H2 = world.h;
    const T = (x, y) => DB.tiles[world.base[world.idx(x, y)]] || {};
    const walk = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && !!T(x, y).pass;
    const sail = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && !!T(x, y).ship;
    const pd = world.spawns.porta_dock;
    if (dock && pd) {
      const seen = new Set([pd.y * W2 + pd.x]), q = [[pd.x, pd.y]];
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = ny * W2 + nx;
          if (seen.has(k) || !sail(nx, ny)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      if (!seen.has(dock.y * W2 + dock.x)) E('world: abyss_dock is not reachable by ship from porta_dock');
      const land = new Set(), lq = [];
      for (const [dx, dy] of DIRS) if (walk(dock.x + dx, dock.y + dy)) { land.add((dock.y + dy) * W2 + dock.x + dx); lq.push([dock.x + dx, dock.y + dy]); }
      for (let i = 0; i < lq.length; i++) {
        const [x, y] = lq[i];
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = ny * W2 + nx;
          if (land.has(k) || !walk(nx, ny)) continue;
          land.add(k); lq.push([nx, ny]);
        }
      }
      if (!land.has(sp.y * W2 + sp.x)) E('world: the entrance is not reachable on foot from abyss_dock');
      worldInfo.push(`islet: entrance ${sp.x},${sp.y}, dock ${dock.x},${dock.y}, ${land.size} walkable cells, zone ${world.zoneAt(sp.x, sp.y)}`);
    }
  }
}

// ------------------------------------------------------------------ reachability
function mkState(flags, items) {
  const S = { flags: new Set(flags), items: new Set(items || []) };
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
/** BFS over the dungeon for story state S (safe: never step on damage floors) */
function explore(S, safe) {
  const seen = new Map();
  const q = [];
  const out = { seen, bossSteps: Infinity, bossMet: false, warpsUsed: new Set(), eventsUsed: new Set(), world: false };
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
  arrive(FLOORS[0], 'entrance', 0);
  while (q.length) {
    const [mid, x, y, st] = q.shift();
    const m = maps[mid];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!m.inBounds(nx, ny)) continue;
      const t = DB.tiles[tileUnder(S, m, nx, ny)];
      if (!t || !t.pass) continue;
      if (safe && t.damage) continue;
      const dd = m.decorDef(nx, ny);
      if (dd && !dd.pass) continue;
      if (m.npcs.some((n) => n.x === nx && n.y === ny && S.check(n.cond))) continue;
      if (m.chests.some((c) => c.x === nx && c.y === ny && S.check(c.cond))) continue;
      const k = key(mid, nx, ny);
      // step events first (like the field), then warps
      const evs = m.events.filter((e) => e.x === nx && e.y === ny && (e.trigger || 'step') === 'step' && S.check(e.cond));
      if (evs.length) {
        const e = evs[0];
        out.eventsUsed.add(mid + ':' + e.id + '@' + nx + ',' + ny);
        if (e.id === BOSS.event) {
          // the fight starts here: the band counts as reached, nothing behind it does
          out.bossMet = true; out.bossSteps = Math.min(out.bossSteps, st + 1);
          if (!seen.has(k)) seen.set(k, st + 1);
          continue;
        }
        const mw = DB.events[e.id] && DB.events[e.id].meta && DB.events[e.id].meta.warp;
        if (mw) {
          if (!seen.has(k)) seen.set(k, st + 1);
          if (mw.to === 'world') out.world = true;
          else arrive(mw.to, mw.spawn, st + 1);
          continue;
        }
      }
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
const near = (out, mid, x, y) => DIRS.some(([dx, dy]) => out.seen.has(mid + ':' + (x + dx) + ',' + (y + dy)));
function talkable(out, mid, n) {
  if (near(out, mid, n.x, n.y)) return true;
  const m = maps[mid];
  return DIRS.some(([dx, dy]) => (tileDef(m, n.x + dx, n.y + dy).counter || (m.decorDef(n.x + dx, n.y + dy) || {}).counter) && out.seen.has(mid + ':' + (n.x + 2 * dx) + ',' + (n.y + 2 * dy)));
}
/** what state S cannot reach (chests, warps, step/examine events, npcs, signs) */
function missing(out, S) {
  const miss = [];
  for (const f of FLOORS) {
    const m = maps[f];
    if (!m) continue;
    for (const c of m.chests) if (!near(out, f, c.x, c.y)) miss.push(`${f} chest ${c.id}`);
    for (const w of m.warps) if (!out.warpsUsed.has(f + ':' + w.x + ',' + w.y)) miss.push(`${f} warp ${w.x},${w.y}→${w.to}:${w.spawn}`);
    for (const e of m.events) {
      if (!S.check(e.cond)) continue;
      if ((e.trigger || 'step') === 'step' && !out.seen.has(f + ':' + e.x + ',' + e.y)) miss.push(`${f} event ${e.id} ${e.x},${e.y}`);
      if (e.trigger === 'examine' && !near(out, f, e.x, e.y)) miss.push(`${f} examine ${e.id} ${e.x},${e.y}`);
    }
    for (const n of m.npcs) if (S.check(n.cond) && !talkable(out, f, n)) miss.push(`${f} npc ${n.id}`);
    for (const s of m.signs) if (!near(out, f, s.x, s.y)) miss.push(`${f} sign ${s.x},${s.y}`);
  }
  return miss;
}
const pathInfo = [];
if (FLOORS.every((f) => maps[f])) {
  const m4 = maps.abyss_4, boss = m4.npcs.find((n) => n.id === BOSS.npc);
  const exitEv = FLOORS.flatMap((f) => maps[f].events.filter((e) => e.id === EXIT).map((e) => [f, e]));
  if (exitEv.length !== 1) E(`expected one exit circle (${EXIT}), found ${exitEv.length}`);
  const gateEv = FLOORS.flatMap((f) => maps[f].events.filter((e) => e.id === GATE).map((e) => [f, e]));
  if (gateEv.length !== 1 || gateEv[0][0] !== 'abyss_1') E(`expected the gate circle (${GATE}) once on abyss_1`);
  // 1. the first descent
  const S1 = mkState(['game_clear']);
  const o1 = explore(S1);
  if (!o1.bossMet) E('state 1: the boss trigger is not reachable');
  // the alcove: the 8x7-tile box the lord's sprite covers
  const alcove = [...o1.seen.keys()].filter((k) => {
    if (!k.startsWith('abyss_4:') || !boss) return false;
    const [x, y] = k.split(':')[1].split(',').map(Number);
    return Math.abs(x - boss.x) <= 7 && y <= boss.y && y >= boss.y - 6;
  });
  if (alcove.length) E(`state 1: ${alcove.length} cell(s) of the lord's alcove reachable before the fight (${alcove[0]})`);
  for (const [f, e] of exitEv) if (S1.check(e.cond) || o1.seen.has(f + ':' + e.x + ',' + e.y)) E('state 1: the exit circle is active before the lord falls');
  for (const [f, e] of gateEv) if (S1.check(e.cond)) E(`state 1: the gate circle ${f} ${e.x},${e.y} is open before the sanctuary`);
  for (const mis of missing(o1, S1)) E(`state 1: unreachable before the lord: ${mis}`);
  const safe1 = explore(S1, true);
  if (!safe1.bossMet) E('the lord cannot be reached without walking on damage floors');
  pathInfo.push(`the lord ≈ ${o1.bossSteps} steps from the entrance (${safe1.bossSteps} avoiding the miasma), ${o1.seen.size} cells reachable`);
  // 2. the shortcut after the sanctuary
  const S2 = mkState(['game_clear', 'abyss_sanctuary']);
  const o2 = explore(S2);
  const [gf, ge] = gateEv[0] || [];
  if (ge && !o2.eventsUsed.has(gf + ':' + GATE + '@' + ge.x + ',' + ge.y)) E('state 2: the gate circle on floor 1 is not reachable once open');
  const sanc = m4.spawns.sanctuary;
  if (!sanc) E('abyss_4: spawn sanctuary missing');
  else {
    const mw = DB.events[GATE] && DB.events[GATE].meta.warp;
    if (!mw || mw.to !== 'abyss_4' || mw.spawn !== 'sanctuary') E(`${GATE}: meta.warp must be {to:'abyss_4', spawn:'sanctuary'}`);
    if (!o2.bossMet) E('state 2: the lord not reachable');
  }
  // 3. after the lord
  const S3 = mkState(['game_clear', 'abyss_sanctuary', BOSS.flag]);
  const o3 = explore(S3);
  for (const mis of missing(o3, S3)) E(`state 3: unreachable after the lord: ${mis}`);
  if (!o3.world) E('state 3: the way out to the world is not reachable');
  for (const [f, e] of exitEv) if (!o3.seen.has(f + ':' + e.x + ',' + e.y)) E(`state 3: exit circle ${f} ${e.x},${e.y} unreachable`);
  if (exitEv[0] && tileUnder(S3, maps[exitEv[0][0]], exitEv[0][1].x, exitEv[0][1].y) !== 'warp_pad') E('state 3: the exit circle shows no pad (tilePatch)');
  pathInfo.push(`after the lord: ${o3.seen.size} cells reachable`);
  // the pad maze of floor 3: which pads lead on
  const m3 = maps.abyss_3;
  const padCount = m3.warps.filter((w) => m3.tileAt(w.x, w.y) === 'warp_pad').length;
  pathInfo.push(`abyss_3: ${padCount} pads (${padCount / 2} two-way pairs)`);
}

// ------------------------------------------------------------------ events (dry run)
function stubEv(state, log, map, answers) {
  const ans = (answers || []).slice();
  const next = (d) => (ans.length ? ans.shift() : d);
  const ev = {
    map, self: null, leader: '{leader}', ctx: {},
    say: async (t) => { texts.push([log.where, Array.isArray(t) ? t.join('\f') : t]); log.says++; },
    ask: async (t, choices) => { if (t) texts.push([log.where, t]); for (const c of choices || []) texts.push([log.where + ' choice', c]); return next(0); },
    yesno: async (t) => { if (t) texts.push([log.where, t]); return next(true); },
    gotItem: async (t, j) => { texts.push([log.where, t]); log.jingles.push(j); },
    flag: (f) => state.flags.has(f),
    setFlag: (f, v = true) => { if (v) { state.flags.add(f); log.flags.push(f); } else state.flags.delete(f); },
    check: (c) => mkState([...state.flags], [...state.items]).check(c),
    var: () => 0, setVar: () => {},
    has: (it) => state.items.has(it),
    take: (it) => state.items.delete(it),
    gold: () => 0, takeGold: () => true,
    give: async (it) => { if (!DB.items[it]) E(`${log.where}: gives unknown item ${it}`); state.items.add(it); log.items.push(it); return true; },
    giveGold: async () => {},
    battle: async (t) => { if (!DB.troops[t]) E(`${log.where}: unknown troop ${t}`); log.battles.push(t); return next('win'); },
    warp: async (m, s) => { log.warps.push(m + ':' + s); if (!DB.maps[m]) E(`${log.where}: warp to unknown map ${m}`); else if (!R.FieldMap.compile(m).spawns[s]) E(`${log.where}: warp to unknown spawn ${m}:${s}`); },
    wait: async () => {}, fadeOut: async () => {}, fadeIn: async () => {}, shake: async () => {}, flash: async () => {},
    sfx: (id) => { if (!SFX.includes(id)) E(`${log.where}: unknown sfx ${id}`); },
    bgm: (id) => { if (!BGM.includes(id)) E(`${log.where}: unknown bgm ${id}`); }, jingle: async () => {},
    npc: () => ({ face() {}, walk: async () => {}, hide() {}, show() {}, setPos() {} }),
    player: { face() {}, walk: async (p) => { log.walks.push(p); }, setPos() {} },
    heal: () => { log.heal++; },
    saveMenu: async () => { log.save++; },
    setObjective: (id) => { if (!DB.objectives || !DB.objectives[id]) E(`${log.where}: unknown objective ${id}`); log.objective = id; },
    refresh: () => {},
    ending: async () => { log.ending++; },
    closeMessage: () => {},
  };
  return ev;
}
async function dry(id, flags, opts) {
  const o = opts || {};
  const state = { flags: new Set(flags), items: new Set() };
  const log = { where: 'event ' + id, flags: [], items: [], battles: [], warps: [], walks: [], jingles: [], heal: 0, save: 0, ending: 0, says: 0, objective: null, result: undefined };
  const def = DB.events[id];
  if (!def) { E(`event ${id} missing`); return log; }
  try { log.result = await def.run(stubEv(state, log, o.map || 'abyss_1', o.answers)); } catch (e) { E(`event ${id} threw: ${e.stack || e}`); }
  return log;
}
function sameGives(id, logs) {
  const meta = (DB.events[id].meta || {}).gives || [];
  const got = new Set();
  for (const log of logs) for (const g of log.flags.map((f) => 'flag:' + f).concat(log.items.map((i) => 'item:' + i))) got.add(g);
  for (const g of meta) if (!got.has(g)) E(`event ${id}: meta gives ${g} but the script did not`);
  for (const g of got) if (!meta.includes(g)) E(`event ${id}: script gives ${g} missing from meta`);
}
function sameWarp(id, log) {
  const mw = (DB.events[id].meta || {}).warp;
  const w = log.warps[0];
  if (mw && w !== mw.to + ':' + mw.spawn) E(`event ${id}: warps to ${w}, meta.warp says ${mw.to}:${mw.spawn}`);
  if (!mw && w) E(`event ${id}: warps to ${w} without meta.warp`);
}
async function events() {
  const ids = ['abyss_entrance', 'abyss_enter', 'abyss_gate_seal', 'abyss_gate_pad', 'abyss_sanctum', 'abyss_spirit', 'abyss_lord', 'abyss_exit'];
  for (const id of ids) if (!DB.events[id]) E(`event ${id} missing`);
  if (ids.some((id) => !DB.events[id])) return;
  // the islet: first visit (flavour + objective) and later visits
  let a = await dry('abyss_entrance', ['game_clear']);
  const a2 = await dry('abyss_entrance', ['game_clear', 'abyss_found']);
  sameGives('abyss_entrance', [a, a2]); sameWarp('abyss_entrance', a); sameWarp('abyss_entrance', a2);
  if (a.objective !== 'obj_postgame') E('abyss_entrance: the first visit should point the objective at obj_postgame');
  // floor 1 onEnter: once
  a = await dry('abyss_enter', ['game_clear']);
  sameGives('abyss_enter', [a]);
  if (!a.says) E('abyss_enter says nothing on the first visit');
  if ((await dry('abyss_enter', ['abyss_entered'])).says) E('abyss_enter repeats');
  // gate seal / pad
  a = await dry('abyss_gate_seal', []); sameGives('abyss_gate_seal', [a]);
  a = await dry('abyss_gate_pad', ['abyss_sanctuary']); sameGives('abyss_gate_pad', [a]); sameWarp('abyss_gate_pad', a);
  // the sanctuary doorway: first time only
  a = await dry('abyss_sanctum', []); sameGives('abyss_sanctum', [a]);
  if ((await dry('abyss_sanctum', ['abyss_sanctuary'])).says) E('abyss_sanctum repeats its message');
  // the spirit: heal, save, advice, leave
  const sp = await dry('abyss_spirit', [], { map: 'abyss_4', answers: [0, 1, 2, 3] });
  sameGives('abyss_spirit', [sp]);
  if (sp.heal !== 1 || sp.save !== 1) E(`abyss_spirit: heal ${sp.heal}, save ${sp.save}`);
  await dry('abyss_spirit', ['abyss_sanctuary', 'abyss_spirit_met', BOSS.flag], { map: 'abyss_4', answers: [2, -1] });
  // the lord: declined, fought, retried after a loss, visited after the win
  const saveTitle = R.Game.title;
  let scenes = 0;
  const PG = R.Postgame;
  R.Postgame = { bonusScene: async () => { scenes++; } };
  const no = await dry('abyss_lord', ['game_clear'], { map: 'abyss_4', answers: [false] });
  if (no.battles.length) E('abyss_lord: fights although the challenge was declined');
  if (no.result !== false) E('abyss_lord: a declined challenge must return false');
  const win = await dry('abyss_lord', ['game_clear'], { map: 'abyss_4', answers: [true, 'win'] });
  if (win.battles.join(',') !== BOSS.troop) E(`abyss_lord battles: ${win.battles.join(',')}`);
  sameGives('abyss_lord', [win]);
  for (const it of REWARDS) if (!win.items.includes(it)) E(`abyss_lord does not give ${it}`);
  if (!win.flags.includes(BOSS.flag)) E(`abyss_lord does not set ${BOSS.flag}`);
  if (R.Game.title !== TITLE) E(`abyss_lord: R.Game.title is ${R.Game.title} (expected ${TITLE})`);
  if (scenes !== 1) E(`abyss_lord: bonus scene played ${scenes}x`);
  if (win.objective !== 'obj_abyss_clear') E(`abyss_lord: objective ${win.objective}`);
  if (!win.jingles.includes('keyitem')) W('abyss_lord: the 称号 has no fanfare');
  const lost = await dry('abyss_lord', ['game_clear', 'abyss_lord_met'], { map: 'abyss_4', answers: [true, 'lose'] });
  if (lost.flags.includes(BOSS.flag) || lost.items.length) E('abyss_lord: rewards after a lost battle');
  if (lost.result !== false) E('abyss_lord: a lost battle must return false');
  const after = await dry('abyss_lord', ['game_clear', BOSS.flag], { map: 'abyss_4' });
  if (after.battles.length || after.says) E('abyss_lord runs again after the win');
  // without the bonus scene (fallback text)
  R.Postgame = {};
  await dry('abyss_lord', ['game_clear'], { map: 'abyss_4', answers: [true, 'win'] });
  R.Postgame = PG;
  R.Game.title = saveTitle;
  // the exit circle
  a = await dry('abyss_exit', [BOSS.flag], { map: 'abyss_4' }); sameGives('abyss_exit', [a]); sameWarp('abyss_exit', a);
  if (a.warps[0] !== 'world:abyss_1') E(`abyss_exit warps to ${a.warps[0]}`);
  // every event in the file has meta
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'events', 'postgame.js'), 'utf8');
  for (const mm of src.matchAll(/E\.([a-z0-9_]+) = \{/g)) if (!DB.events[mm[1]] || !DB.events[mm[1]].meta) E(`event ${mm[1]} without meta`);
  for (const [where, t] of texts) if (typeof t === 'string') textCheck(where, t);
}

// ------------------------------------------------------------------ text style (STYLE_JA.md)
const LONG_NAME = 'アアアアアア';
const HERO_NAMES = ['ユウキ', 'ノン', 'メテム'];
const JA = 'ぁ-ヿ一-鿿々、。「-』！？…';
const DQ_SPACE = new RegExp(`[${JA}][ 　]+[${JA}]`, 'g');
function textCheck(where, t) {
  for (const w of FORBIDDEN) if (t.includes(w)) E(`${where}: forbidden word ${w}`);
  for (const n of HERO_NAMES) if (t.includes(n)) E(`${where}: hard-coded hero name ${n} (use a placeholder)`);
  for (const mm of t.matchAll(/\{([a-z]+)\}/g)) if (!['yuki', 'non', 'metem', 'leader'].includes(mm[1])) E(`${where}: unknown placeholder {${mm[1]}}`);
  for (const mm of t.matchAll(DQ_SPACE)) {
    if (!(mm[0][1] === '　' && mm[0].length === 3 && '！？'.includes(mm[0][0]))) E(`${where}: DQ-style space in "${mm[0]}"`);
  }
  const bang = t.match(/.?[！？][^\s　」』！？…\n\f]./);
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
  for (const id of FLOORS) {
    const url = await page.evaluate((mid) => {
      const R = window.RPG;
      if (!R.Game) R.State.newGame();
      R.Game.flags.game_clear = true;
      const m = R.FieldMap.compile(mid);
      if (!m) return null;
      const TS = 16, G = R.Gfx;
      const cv = document.createElement('canvas');
      cv.width = m.w * TS; cv.height = m.h * TS;
      const c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
      const one = (g) => (Array.isArray(g) ? g[0] : g);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        let g = null;
        if (R.Art && R.Art.localTile) { try { g = R.Art.localTile(m, x, y); } catch (e) { g = null; } }
        if (!g) { const t = m.tileAt(x, y); g = G.has('tile:' + m.theme + ':' + t) ? G.get('tile:' + m.theme + ':' + t) : G.has('tile:' + t) ? G.get('tile:' + t) : null; }
        g = one(g);
        if (g) c.drawImage(g, x * TS, y * TS);
      }
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const d = m.decorAt(x, y);
        if (!d) continue;
        let dg = R.Art && R.Art.decorTile ? R.Art.decorTile(m, x, y) : null;
        if (!dg && G.has('decor:' + d)) dg = G.get('decor:' + d);
        dg = one(dg);
        if (dg) c.drawImage(dg, x * TS + 8 - (dg.width >> 1), y * TS + TS - dg.height);
      }
      const chest = one(G.get('obj:chest'));
      for (const o of m.chests) {
        c.drawImage(chest, o.x * TS, o.y * TS);
        if (o.troop) { c.strokeStyle = '#f0f'; c.strokeRect(o.x * TS + 0.5, o.y * TS + 0.5, 15, 15); }
      }
      for (const p of m.patches) { c.strokeStyle = '#8f8'; c.strokeRect(p.x * TS + 2.5, p.y * TS + 2.5, 11, 11); }
      const list = m.npcs.map((n) => {
        const s = G.get(n.sprite);
        let img = s;
        if (s && !s.width) img = Array.isArray(s) ? s[0] : (Array.isArray(s[n.dir] || s.down) ? (s[n.dir] || s.down)[0] : s.down);
        return [n.y, img, n];
      }).filter((a) => a[1]).sort((a, b) => a[0] - b[0]);
      for (const [, img, n] of list) c.drawImage(img, n.x * TS + 8 - (img.width >> 1), n.y * TS + TS - img.height);
      c.font = '9px monospace';
      for (const e of m.events) { c.strokeStyle = e.id === 'abyss_exit' ? '#8f8' : e.trigger === 'examine' ? '#88f' : '#fa0'; c.strokeRect(e.x * TS + 4.5, e.y * TS + 4.5, 7, 7); }
      for (const w of m.warps) {
        c.strokeStyle = '#0ff'; c.lineWidth = 2; c.strokeRect(w.x * TS + 1, w.y * TS + 1, 14, 14); c.lineWidth = 1;
        c.fillStyle = '#0ff'; c.fillText((w.to === mid ? '' : (w.to === 'world' ? 'W' : w.to.slice(-1)) + ':') + w.spawn.replace('pad_', ''), w.x * TS - 4, w.y * TS - 2);
      }
      for (const k in m.spawns) { if (k.startsWith('pad_')) continue; const s = m.spawns[k]; c.fillStyle = '#0f0'; c.fillRect(s.x * TS + 6, s.y * TS + 6, 4, 4); c.fillText(k, s.x * TS - 2, s.y * TS + 25); }
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
  const mons = [...zoneMons].sort();
  if (VERBOSE) {
    console.log('treasure:\n  ' + report.join('\n  '));
    console.log('\npaths:\n  ' + pathInfo.concat(worldInfo).join('\n  '));
    console.log('\nmonsters met here (all in R.DB.monsters → the bestiary): ' + mons.length + '\n  ' + mons.join(' ') + '\n');
  }
  for (const w of warns) console.log('warn: ' + w);
  for (const e of errors) console.log('ERROR: ' + e);
  console.log(errors.length ? `\n${errors.length} error(s)` : `\nabyss: OK — ${FLOORS.length} floors, ${report.length} chests, ${mons.length} monsters, ${texts.length} texts checked`);
  if (PNG) await renderPng();
  process.exitCode = errors.length ? 1 : 0;
})();
