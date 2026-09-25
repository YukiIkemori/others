#!/usr/bin/env node
// Checker for the first-half dungeons: src/maps/dungeons_a.js + src/events/dungeons_a.js
// (風の洞窟, 盗賊の砦, 水の洞窟, ピラミッド).
//
//   node tools/check_dungeons_a.js               static checks + reachability + event dry runs
//   node tools/check_dungeons_a.js --verbose     also print every chest / hidden item
//   node tools/check_dungeons_a.js --png DIR     also render every floor (real tile art, objects,
//                                                spawns/warps/events marked) to DIR/<map>.png
//
// Static: size 40x32..64x48, equal rows, legend/mark chars, `under` tiles, required fields
// (type/theme/bgm/encounter zone/escape), world spawns, stairs pairs that lead back next to
// the stairs they came from, chests & hidden items on sensible tiles with existing items and
// globally unique ids, NPC sprites/events, torches that face a floor, poison used sparingly.
// Reachability (BFS over all floors of a dungeon; NPCs & chests block, silver doors need the
// key, boss NPCs block until their flag is set): before the boss the boss can be reached and
// nothing behind it can; after it every chest, hidden item, stair, crest and exit circle can.
// The pyramid sanctum must be sealed without the silver key.
// Texts (STYLE_JA.md): map names from the glossary, no hard-coded hero names (placeholders
// {yuki} {non} {metem} {leader}), no DQ-style spaces, a full-width space after a mid-line ！/？,
// every line fits the message window even with 6-character hero names, at most 4 lines a page.
// Events: every script is run with a stub `ev` (battles won, yes to every question); the flags
// and items it hands out must equal its meta.gives, and the exit circle must lead to escape.
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
for (const e of R._nodeLoadErrors) if (/dungeons_a/.test(e)) E('load: ' + e.split('\n')[0]);
const mapWarns = [];
R.warn = (...a) => mapWarns.push(a.join(' '));

// ------------------------------------------------------------------ the plan
const DUNGEONS = [
  { key: 'wind', name: '風の洞窟', floors: ['wind_cave_1', 'wind_cave_2'], zones: ['d_wind1', 'd_wind2'], theme: 'cave', bgm: 'cave',
    boss: { event: 'wind_boss', troop: 'boss_wind', sprite: 'boss_goblin_chief', flag: 'boss_wind_done' },
    crest: { event: 'wind_crest', item: 'crest_wind', got: 'got_crest_wind' } },
  { key: 'fort', name: '盗賊の砦', floors: ['bandit_fort_1', 'bandit_fort_2'], zones: ['d_fort1', 'd_fort2'], theme: 'fort', bgm: 'dungeon',
    boss: { event: 'fort_boss', troop: 'boss_fort', sprite: 'boss_bandit', flag: 'boss_fort_done' },
    gives: ['item:silver_key', 'flag:bandits_defeated'] },
  { key: 'water', name: '水の洞窟', floors: ['water_cave_1', 'water_cave_2'], zones: ['d_water1', 'd_water2'], theme: 'water', bgm: 'cave',
    boss: { event: 'water_boss', troop: 'boss_water', sprite: 'boss_serpent', flag: 'boss_water_done' },
    crest: { event: 'water_crest', item: 'crest_water', got: 'got_crest_water' }, keyBefore: true },
  { key: 'pyramid', name: 'ピラミッド', floors: ['pyramid_1', 'pyramid_2', 'pyramid_3'], zones: ['d_pyr1', 'd_pyr2', 'd_pyr3'], theme: 'pyramid', bgm: 'pyramid',
    boss: { event: 'pyramid_boss', troop: 'boss_pyramid', sprite: 'boss_sphinx', flag: 'boss_pyramid_done' },
    crest: { event: 'pyramid_crest', item: 'crest_earth', got: 'got_crest_earth' }, sealed: true, keyBefore: true },
];
const MINE = DUNGEONS.flatMap((d) => d.floors);
const BGM = 'title overworld sea town village castle shrine dungeon cave tower pyramid ice volcano lastdungeon battle boss lastboss ending'.split(' ');
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const gfx = (k) => R.Gfx && R.Gfx.has && R.Gfx.has(k);
const FORBIDDEN = ['メラ', 'ホイミ', 'ルーラ', 'スライム', 'ケアル', 'ファイガ', 'エスナ', 'レイズ', 'ギラ', 'ベホマ', 'リレミト', 'ドラクエ', 'ファイナル'];

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

// ------------------------------------------------------------------ static checks
const allIds = {};
for (const id in DB.maps) {
  const def = DB.maps[id];
  const ids = (def.chests || []).concat(def.hidden || []).map((c) => c.id);
  for (const ch in def.marks || {}) {
    const mk = def.marks[ch];
    if (mk.chest || mk.hidden) ids.push((mk.chest || mk.hidden).id);
  }
  for (const c of ids) {
    if (!c) continue;
    if (allIds[c] && (MINE.includes(id) || MINE.includes(allIds[c]))) E(`duplicate chest/hidden id ${c} (${allIds[c]} and ${id})`);
    allIds[c] = id;
  }
}
const texts = [];
const tileAt = (m, x, y) => DB.tiles[m.tileAt(x, y)] || { pass: false };
const walkTile = (m, x, y) => m.inBounds(x, y) && tileAt(m, x, y).pass;
const itemName = (c) => (c.gold ? c.gold + 'G' : (DB.items[c.item] ? DB.items[c.item].name : '?' + c.item) + (c.n > 1 ? '×' + c.n : ''));

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
    }
    for (const r of def.rows) for (const ch of r) if (!legend[ch] && !(def.marks && def.marks[ch])) E(`${id}: unknown char '${ch}'`);
    if (def.type !== 'dungeon') E(`${id}: type ${def.type} (expected dungeon)`);
    if (def.name !== d.name) E(`${id}: name ${def.name} (expected ${d.name})`);
    if (def.theme !== d.theme) E(`${id}: theme ${def.theme} (expected ${d.theme})`);
    if (!BGM.includes(def.bgm)) E(`${id}: bad bgm ${def.bgm}`);
    if (def.encounter !== d.zones[fi]) E(`${id}: encounter ${def.encounter} (expected ${d.zones[fi]})`);
    if (!DB.encounters[def.encounter]) W(`${id}: encounter zone ${def.encounter} not defined yet`);
    const esc = def.escape;
    if (!esc || esc.to !== 'world' || esc.spawn !== d.floors[0]) E(`${id}: escape must be {to:'world', spawn:'${d.floors[0]}'}`);
    if (world && esc && !world.spawns[esc.spawn]) E(`${id}: world spawn ${esc.spawn} missing`);
    // spawns
    for (const s in m.spawns) {
      const p = m.spawns[s];
      if (!walkTile(m, p.x, p.y)) E(`${id}: spawn ${s} on ${m.tileAt(p.x, p.y)}`);
      if (m.warpAt(p.x, p.y)) E(`${id}: spawn ${s} sits on a warp`);
    }
    if (fi === 0 && !m.spawns.entrance) E(`${id}: no 'entrance' spawn`);
    if (fi === 0) {
      const out = m.warps.some((w) => w.to === 'world' && w.spawn === id) || (def.exit && def.exit.to === 'world' && def.exit.spawn === id);
      if (!out) E(`${id}: no way back to the world spawn ${id}`);
    }
    // warps: target exists, spawn next to the matching stairs back
    for (const w of m.warps) {
      if (w.to === 'world') { if (world && !world.spawns[w.spawn]) E(`${id}: warp to unknown world spawn ${w.spawn}`); continue; }
      const t = maps[w.to];
      if (!t) { E(`${id}: warp to ${w.to} (not a floor of this dungeon)`); continue; }
      const sp = t.spawns[w.spawn];
      if (!sp) { E(`${id}: warp to ${w.to}:${w.spawn} — spawn missing`); continue; }
      const tid = m.tileAt(w.x, w.y);
      const want = tid === 'stairs_down' ? 'up' : tid === 'stairs_up' ? 'down' : null;
      if (want && w.spawn !== want) E(`${id}: ${tid} at ${w.x},${w.y} should arrive at spawn '${want}' (has '${w.spawn}')`);
      const back = t.warps.find((b) => b.to === id && Math.abs(b.x - sp.x) + Math.abs(b.y - sp.y) === 1);
      if (!back) E(`${id}: arriving at ${w.to}:${w.spawn} is not next to stairs leading back`);
      else {
        const sb = m.spawns[back.spawn];
        if (!sb || Math.abs(sb.x - w.x) + Math.abs(sb.y - w.y) !== 1) E(`${w.to}: stairs back to ${id} do not arrive next to the stairs at ${w.x},${w.y}`);
      }
      if (!/^stairs_/.test(tid)) W(`${id}: warp at ${w.x},${w.y} on ${tid}`);
    }
    // chests / hidden
    const occupied = {};
    const occ = (x, y, what) => { const k = x + ',' + y; if (occupied[k]) E(`${id}: ${what} and ${occupied[k]} share ${k}`); occupied[k] = what; };
    for (const n of m.npcs) occ(n.x, n.y, 'npc ' + n.id);
    for (const c of m.chests) {
      occ(c.x, c.y, 'chest ' + c.id);
      if (!c.gold && !DB.items[c.item]) E(`${id}: chest ${c.id} unknown item ${c.item}`);
      const t = tileAt(m, c.x, c.y);
      if (!t.pass || t.lock || t.damage || /^stairs|^door|warp_pad/.test(m.tileAt(c.x, c.y))) E(`${id}: chest ${c.id} on ${m.tileAt(c.x, c.y)}`);
      if (m.warpAt(c.x, c.y) || m.eventIdx.has(m.idx(c.x, c.y))) E(`${id}: chest ${c.id} on a warp/event`);
      if (c.troop && !(c.troop.mons || []).every(([mid]) => DB.monsters[mid])) E(`${id}: chest ${c.id} mimic monster missing`);
    }
    for (const h of m.hidden) {
      occ(h.x, h.y, 'hidden ' + h.id);
      if (!h.gold && !DB.items[h.item]) E(`${id}: hidden ${h.id} unknown item ${h.item}`);
      const tid = m.tileAt(h.x, h.y);
      if (!tileAt(m, h.x, h.y).pass && !['pot', 'barrel', 'crate', 'grave', 'shelf', 'bookshelf'].includes(tid)) E(`${id}: hidden ${h.id} inside ${tid}`);
    }
    for (const n of m.npcs) {
      if (!gfx(n.sprite)) E(`${id}: npc ${n.id} sprite ${n.sprite} not registered`);
      if (n.event && !DB.events[n.event]) E(`${id}: npc ${n.id} event ${n.event} missing`);
      if (n.text) texts.push([id + ' ' + n.id, n.text]);
    }
    for (const e of m.events) if (!DB.events[e.id]) E(`${id}: event ${e.id} missing`);
    for (const s of m.signs) texts.push([id + ' sign', s.text]);
    // torches must show on a wall face (floor below)
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.tileAt(x, y) === 'wall_torch' && !walkTile(m, x, y + 1)) W(`${id}: torch at ${x},${y} has no floor below`);
    }
    const poison = m.tiles.filter((t) => t === 'poison').length;
    if (poison > 24) W(`${id}: ${poison} poison tiles (keep traps sparing)`);
  });
  // the boss is on the map as a monster NPC with the right sprite / event
  const bossFloor = d.floors.map((f) => maps[f]).find((m) => m && m.npcs.some((n) => n.sprite === 'mon:' + d.boss.sprite));
  if (!bossFloor) E(`${d.key}: no NPC with sprite mon:${d.boss.sprite}`);
  else {
    const n = bossFloor.npcs.find((x) => x.sprite === 'mon:' + d.boss.sprite);
    if (n.event !== d.boss.event) E(`${d.key}: boss NPC event ${n.event} (expected ${d.boss.event})`);
    if (JSON.stringify(n.cond) !== JSON.stringify('!' + d.boss.flag)) E(`${d.key}: boss NPC cond should be '!${d.boss.flag}'`);
  }
  if (!DB.troops[d.boss.troop]) W(`${d.key}: troop ${d.boss.troop} not defined yet`);
}

// ------------------------------------------------------------------ reachability
/** BFS from floor 1 'entrance' over the dungeon's floors in a given state */
function reach(d, flags, items) {
  const S = { flag: (f) => flags.includes(f), item: (i) => items.includes(i) };
  const check = (c) => {
    if (c == null || c === true) return true;
    if (typeof c === 'string') return c[0] === '!' ? !S.flag(c.slice(1)) : S.flag(c);
    if (Array.isArray(c)) return c.every(check);
    if (c.flag && !S.flag(c.flag)) return false;
    if (c.notFlag && S.flag(c.notFlag)) return false;
    if (c.item && !S.item(c.item)) return false;
    if (c.notItem && S.item(c.notItem)) return false;
    return true;
  };
  const tileId = (m, x, y) => {
    let t = m.base[m.idx(x, y)];
    for (const p of m.patches) if (p.x === x && p.y === y && check(p.cond)) t = m.legend[p.ch] || p.tile || t;
    return t;
  };
  const blocked = (m, x, y) => m.npcs.some((n) => n.x === x && n.y === y && check(n.cond)) || m.chests.some((c) => c.x === x && c.y === y && check(c.cond));
  const pass = (m, x, y) => {
    if (!m.inBounds(x, y)) return false;
    const t = DB.tiles[tileId(m, x, y)];
    if (!t || !t.pass) return false;
    if (t.lock && !S.item(t.lock)) return false;
    return !blocked(m, x, y);
  };
  const seen = new Set(), q = [];
  const out = { seen, exits: new Set(), triggered: new Set() };
  const push = (id, x, y) => { const k = id + ':' + x + ',' + y; if (!seen.has(k)) { seen.add(k); q.push([id, x, y]); } };
  const m0 = maps[d.floors[0]];
  if (!m0 || !m0.spawns.entrance) return out;
  push(m0.id, m0.spawns.entrance.x, m0.spawns.entrance.y);
  while (q.length) {
    const [id, x, y] = q.shift();
    const m = maps[id];
    // a step event with a warp in it (exit circle) or a boss ring: note it; bosses stop the walk here
    for (const e of m.events) if (e.x === x && e.y === y && e.trigger === 'step' && check(e.cond)) out.triggered.add(e.id);
    const w = m.warpAt(x, y);
    if (w && !(x === m0.spawns.entrance.x && y === m0.spawns.entrance.y && id === m0.id)) {
      if (w.to === 'world') out.exits.add('warp');
      else if (maps[w.to] && maps[w.to].spawns[w.spawn]) { const s = maps[w.to].spawns[w.spawn]; push(w.to, s.x, s.y); }
    }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!m.inBounds(nx, ny)) { if (m.exit) out.exits.add('edge'); continue; }
      if (pass(m, nx, ny)) push(id, nx, ny);
    }
  }
  out.near = (id, x, y) => {
    if (seen.has(id + ':' + x + ',' + y)) return true;
    const m = maps[id];
    for (const [dx, dy] of DIRS) {
      if (seen.has(id + ':' + (x + dx) + ',' + (y + dy))) return true;
      const mid = m.inBounds(x + dx, y + dy) && DB.tiles[m.tileAt(x + dx, y + dy)];
      if (mid && mid.counter && seen.has(id + ':' + (x + 2 * dx) + ',' + (y + 2 * dy))) return true;
    }
    return false;
  };
  out.floors = new Set([...seen].map((k) => k.split(':')[0]));
  return out;
}

const report = [];
for (const d of DUNGEONS) {
  if (!d.floors.every((f) => maps[f])) continue;
  // the silver key comes from the fort's boss: dungeons visited later have it from the start
  const key = ['silver_key'];
  const before = reach(d, [], d.keyBefore ? key : []);
  const after = reach(d, [d.boss.flag], key);
  const noKey = reach(d, [], []);
  const bossFloor = d.floors.find((f) => maps[f].npcs.some((n) => n.event === d.boss.event));
  const bm = maps[bossFloor];
  const boss = bm.npcs.find((n) => n.sprite === 'mon:' + d.boss.sprite);
  // before the boss: it can be reached; the crest / anything behind it cannot
  if (!before.near(bossFloor, boss.x, boss.y) && !before.triggered.has(d.boss.event)) E(`${d.key}: boss cannot be reached`);
  if (!before.triggered.has(d.boss.event)) W(`${d.key}: no step trigger in front of the boss (talk only)`);
  for (const f of d.floors) if (!before.floors.has(f)) E(`${d.key}: floor ${f} unreachable before the boss`);
  const crestNpc = d.crest && bm.npcs.find((n) => n.event === d.crest.event);
  if (d.crest) {
    if (!crestNpc) E(`${d.key}: crest pedestal NPC (${d.crest.event}) missing`);
    else {
      if (before.near(bossFloor, crestNpc.x, crestNpc.y)) E(`${d.key}: crest pedestal reachable before the boss (the boss must block the way)`);
      if (!after.near(bossFloor, crestNpc.x, crestNpc.y)) E(`${d.key}: crest pedestal unreachable after the boss`);
      if (bm.tileAt(crestNpc.x, crestNpc.y) !== 'pedestal') E(`${d.key}: crest not on a pedestal`);
    }
  }
  // after the boss: every chest, hidden item, stair and the exit circle
  let behind = 0;
  for (const f of d.floors) {
    const m = maps[f];
    for (const c of m.chests) {
      if (!after.near(f, c.x, c.y)) E(`${f}: chest ${c.id} (${itemName(c)}) unreachable`);
      else if (!before.near(f, c.x, c.y)) behind++;
      report.push(`  ${f.padEnd(14)} ${c.id.padEnd(18)} ${String(c.x).padStart(2)},${String(c.y).padStart(2)}  ${itemName(c)}${c.troop ? ' (mimic)' : ''}${before.near(f, c.x, c.y) ? '' : noKey.near(f, c.x, c.y) ? '' : ' [behind boss/door]'}`);
    }
    for (const h of m.hidden) {
      if (!after.near(f, h.x, h.y)) E(`${f}: hidden ${h.id} unreachable`);
      report.push(`  ${f.padEnd(14)} ${h.id.padEnd(18)} ${String(h.x).padStart(2)},${String(h.y).padStart(2)}  ${itemName(h)} (hidden in ${m.tileAt(h.x, h.y)})`);
    }
    for (const w of m.warps) if (!after.seen.has(f + ':' + w.x + ',' + w.y)) E(`${f}: stairs at ${w.x},${w.y} unreachable`);
    for (const e of m.events) {
      if (e.id !== 'da_exit_circle') continue;
      if (!after.seen.has(f + ':' + e.x + ',' + e.y)) E(`${f}: exit circle at ${e.x},${e.y} unreachable after the boss`);
      if (before.seen.has(f + ':' + e.x + ',' + e.y) && !String(e.cond).includes(d.boss.flag)) E(`${f}: exit circle usable before the boss`);
      const p = m.patches.find((pp) => pp.x === e.x && pp.y === e.y);
      if (!p || p.cond !== e.cond || m.legend[p.ch] !== 'warp_pad') E(`${f}: exit circle at ${e.x},${e.y} needs a warp_pad tilePatch with the same cond`);
    }
  }
  if (!after.exits.size) E(`${d.key}: no way out to the world`);
  // the silver door seals the pyramid sanctum
  if (d.sealed) {
    if (noKey.near(bossFloor, boss.x, boss.y) || noKey.triggered.has(d.boss.event)) E(`${d.key}: sanctum reachable without the silver key`);
  } else {
    if (!noKey.triggered.has(d.boss.event) && !noKey.near(bossFloor, boss.x, boss.y)) E(`${d.key}: boss needs the silver key (it should not)`);
  }
  console.log(`${d.key.padEnd(8)} floors ${d.floors.length}  chests ${d.floors.reduce((s, f) => s + maps[f].chests.length, 0)} (${behind} behind the boss/doors)` +
    `  hidden ${d.floors.reduce((s, f) => s + maps[f].hidden.length, 0)}  tiles reached ${after.seen.size}` +
    `  no-key: ${noKey.floors.size}/${d.floors.length} floors${d.sealed ? ', sanctum sealed' : ''}`);
}

// ------------------------------------------------------------------ text style
// Hero names are chosen by the player (up to 6 full-width characters): lines are measured with
// the longest possible name so that they still fit the window.
const LONG_NAME = 'アアアアアア';
const HERO_NAMES = ['ユウキ', 'ノン', 'メテム'];
const JA = '\u3041-\u30ff\u4e00-\u9fff\u3005\u3001\u3002\u300c-\u300f\uff01\uff1f\u2026';
const DQ_SPACE = new RegExp(`[${JA}][ \u3000]+[${JA}]`);
function textCheck(where, t) {
  for (const bad of FORBIDDEN) if (t.includes(bad)) E(`${where}: forbidden word ${bad}`);
  for (const n of HERO_NAMES) if (t.includes(n)) E(`${where}: hard-coded hero name ${n} (use a placeholder)`);
  for (const m of t.matchAll(/\{([a-z]+)\}/g)) if (!['yuki', 'non', 'metem', 'leader'].includes(m[1])) E(`${where}: unknown placeholder {${m[1]}}`);
  // DQ-style spacing: the only space allowed in Japanese text is a full-width one after ！/？
  for (const m of t.matchAll(new RegExp(DQ_SPACE, 'g'))) {
    if (!(m[0][1] === '\u3000' && m[0].length === 3 && '！？'.includes(m[0][0]))) E(`${where}: DQ-style space in "${m[0]}"`);
  }
  if (/[！？][^\s\u3000」』！？…\n\f]/.test(t)) E(`${where}: mid-line ！/？ needs a full-width space after it: ${t.match(/.?[！？][^\s\u3000」』！？…\n\f]./)[0]}`);
  const long = t.replace(/\{(yuki|non|metem|leader)\}/g, LONG_NAME);
  for (const page of long.split('\f')) {
    const lines = page.split('\n');
    if (lines.length > 4) E(`${where}: page with ${lines.length} lines: ${page.slice(0, 20)}…`);
    // the message window holds 220 px per line (DotGothic16 at 10.67 px: full-width 11, half-width 5.34)
    for (const l of lines) {
      const px = [...l].reduce((w, ch) => w + (ch.charCodeAt(0) < 0x2000 ? 5.34 : 11), 0);
      if (px > 220) E(`${where}: line too wide for the window (${Math.round(px)} px with 6-char names): ${l}`);
    }
  }
}

// ------------------------------------------------------------------ event dry runs
async function dry(id, mapId, pre) {
  const ev = DB.events[id];
  if (!ev || typeof ev.run !== 'function') { E(`event ${id} missing`); return null; }
  R.State.newGame();
  for (const f of pre.flags || []) R.State.setFlag(f);
  for (const i of pre.items || []) R.State.addItem(i);
  const m = maps[mapId];
  const got = { flags: [], items: [], battles: [], warps: [], says: [] };
  const flag0 = new Set(Object.keys(R.Game.flags || {}).filter((k) => R.Game.flags[k]));
  const npcPos = (nid) => m.npcs.find((n) => n.id === nid) || null;
  const saveField = R.Field;
  R.Field = { map: m, npc: npcPos, pos: () => ({ x: 0, y: 0, dir: 'up' }), refresh() {} };
  const noop = async () => {};
  const stub = {
    map: mapId, self: null,
    say: async (t) => { got.says.push(Array.isArray(t) ? t.join('\f') : t); },
    ask: async (t) => { if (t) got.says.push(t); return 0; },
    yesno: async (t) => { if (t) got.says.push(t); return true; },
    flag: (f) => R.State.flag(f),
    setFlag: (f, v = true) => { R.State.setFlag(f, v); if (v) got.flags.push(f); },
    check: (c) => R.State.check(c),
    has: (i, n) => R.State.hasItem(i, n),
    take: (i, n) => R.State.removeItem(i, n),
    give: async (i, n = 1) => { if (!DB.items[i]) E(`${id}: gives unknown item ${i}`); R.State.addItem(i, n); got.items.push(i); return true; },
    giveGold: noop,
    battle: async (t) => { got.battles.push(t); if (!DB.troops[t]) W(`${id}: troop ${t} not defined yet`); return 'win'; },
    warp: async (to, s) => { got.warps.push(to + ':' + s); },
    wait: noop, fadeOut: noop, fadeIn: noop, shake: noop, flash: noop, jingle: noop,
    sfx: () => {}, bgm: () => {}, refresh: () => {},
    setObjective: (o) => { if (!DB.objectives || !DB.objectives[o]) E(`${id}: setObjective unknown id ${o}`); got.objective = o; },
    npc: (nid) => { if (!npcPos(nid)) E(`${id}: ev.npc('${nid}') not on ${mapId}`); const h = { face: () => h, hide: () => h, show: () => h, walk: noop, setPos: () => h }; return h; },
    player: { face: () => {}, walk: noop },
    heal: () => {},
  };
  try { await ev.run(stub); } catch (e) { E(`event ${id} threw: ${e.stack || e}`); }
  R.Field = saveField;
  got.flags = got.flags.filter((f) => !flag0.has(f));
  for (const t of got.says) texts.push(['event ' + id, t]);
  return got;
}
function sameGives(id, got, extra) {
  const meta = (DB.events[id] && DB.events[id].meta) || null;
  if (!meta) { E(`event ${id}: no meta`); return; }
  const want = new Set(meta.gives || []);
  const have = new Set(got.flags.map((f) => 'flag:' + f).concat(got.items.map((i) => 'item:' + i)));
  for (const g of want) if (!have.has(g)) E(`event ${id}: meta gives ${g} but the script does not`);
  for (const g of have) if (!want.has(g)) E(`event ${id}: script gives ${g} but meta does not list it`);
  for (const g of extra || []) if (!want.has(g)) E(`event ${id}: must give ${g}`);
}

async function events() {
  for (const d of DUNGEONS) {
    const bossFloor = d.floors.find((f) => maps[f] && maps[f].npcs.some((n) => n.event === d.boss.event));
    if (!bossFloor) continue;
    const b = await dry(d.boss.event, bossFloor, { items: ['silver_key'] });
    if (!b) continue;
    if (b.battles.join() !== d.boss.troop) E(`${d.boss.event}: battles ${b.battles.join()} (expected ${d.boss.troop})`);
    sameGives(d.boss.event, b, ['flag:' + d.boss.flag].concat(d.gives || []));
    const again = await dry(d.boss.event, bossFloor, { flags: [d.boss.flag] });
    if (again && (again.battles.length || again.items.length)) E(`${d.boss.event}: runs again after the boss is beaten`);
    if (d.crest) {
      const c = await dry(d.crest.event, bossFloor, { flags: [d.boss.flag] });
      sameGives(d.crest.event, c, ['item:' + d.crest.item, 'flag:' + d.crest.got]);
      if (!c.objective) E(`${d.crest.event}: no objective update`);
      const early = await dry(d.crest.event, bossFloor, {});
      if (early.items.length) E(`${d.crest.event}: gives the crest before the boss`);
      const twice = await dry(d.crest.event, bossFloor, { flags: [d.boss.flag, d.crest.got] });
      if (twice.items.length) E(`${d.crest.event}: gives the crest twice`);
      const needs = (DB.events[d.crest.event].meta || {}).needs || [];
      if (!needs.includes('flag:' + d.boss.flag)) E(`${d.crest.event}: meta.needs must include flag:${d.boss.flag}`);
    } else if (!b.objective) E(`${d.boss.event}: no objective update`);
    for (const f of d.floors) {
      const m = maps[f];
      if (!m.events.some((e) => e.id === 'da_exit_circle')) continue;
      const x = await dry('da_exit_circle', f, {});
      const esc = DB.maps[f].escape;
      if (x.warps.join() !== esc.to + ':' + esc.spawn) E(`da_exit_circle on ${f}: warps to ${x.warps.join()} (expected ${esc.to}:${esc.spawn})`);
    }
  }
  // text style (STYLE_JA.md) and window fit
  for (const [where, t] of texts) textCheck(where, String(t));
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
  for (const id of MINE) {
    const url = await page.evaluate((mid) => {
      const R = window.RPG;
      if (!R.Game) R.State.newGame();
      const m = R.FieldMap.compile(mid);
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
      for (const h of m.hidden) { c.fillStyle = 'rgba(255,240,0,0.9)'; c.fillRect(h.x * TS + 5, h.y * TS + 5, 6, 6); }
      for (const p of m.patches) { c.strokeStyle = '#8f8'; c.strokeRect(p.x * TS + 2.5, p.y * TS + 2.5, 11, 11); }
      const list = m.npcs.map((n) => {
        const s = G.get(n.sprite);
        let img = s;
        if (s && !s.width) img = Array.isArray(s) ? s[0] : (Array.isArray(s[n.dir] || s.down) ? (s[n.dir] || s.down)[0] : s.down);
        return [n.y, img, n];
      }).filter((a) => a[1]).sort((a, b) => a[0] - b[0]);
      for (const [, img, n] of list) c.drawImage(img, n.x * TS + 8 - (img.width >> 1), n.y * TS + TS - img.height);
      c.font = '9px monospace';
      for (const e of m.events) { c.strokeStyle = e.id === 'da_exit_circle' ? '#8f8' : '#fa0'; c.strokeRect(e.x * TS + 4.5, e.y * TS + 4.5, 7, 7); }
      for (const w of m.warps) { c.strokeStyle = '#0ff'; c.lineWidth = 2; c.strokeRect(w.x * TS + 1, w.y * TS + 1, 14, 14); c.lineWidth = 1; c.fillStyle = '#0ff'; c.fillText('→' + (w.to === 'world' ? 'world' : w.to.replace(/_/g, '').slice(-5)), w.x * TS - 6, w.y * TS - 2); }
      for (const k in m.spawns) { const s = m.spawns[k]; c.fillStyle = '#0f0'; c.fillRect(s.x * TS + 6, s.y * TS + 6, 4, 4); c.fillText(k, s.x * TS - 2, s.y * TS + 25); }
      return cv.toDataURL('image/png');
    }, id);
    const f = path.join(out, id + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('png →', f);
  }
  await browser.close();
}

(async () => {
  await events();
  if (VERBOSE) console.log('\ntreasure:\n' + report.join('\n'));
  for (const w of warns) console.log('warn: ' + w);
  for (const e of errors) console.log('ERROR: ' + e);
  console.log(errors.length ? `\n${errors.length} error(s)` : '\ndungeons A: OK');
  if (PNG) await renderPng();
  process.exitCode = errors.length ? 1 : 0;
})();
