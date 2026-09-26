#!/usr/bin/env node
// Region 7 灰の荒野 (r_ash) tests — owner reg7 (R7). node, no DOM, exit 1 on failure. DESIGN §10.8.0, §10.8.8,
// §10.6.1–§10.6.4, §8.12.4, §11.2.7, §12.
//   static — the four maps: ids, sizes, outside, type/theme/bgm/zone/location/region/escape/lvOff, spawns,
//            warps, chests (pools, counts, p_rare), rest lanterns, lava counts, NPC fixed/push, the st_* spots,
//            folk_a/folk_b, tier-varying lines, objectives, the event ids the maps use
//   reach  — BFS on the compiled maps per story state: the mid-boss and the rock door hold, the boss and
//            Fine bands cannot be walked around, no lava needs to be stepped on, the secret room is only
//            reachable through the fake wall and holds nothing the story needs
//   text   — every Japanese string in src/{maps,events}/region7_*.js: 20 full-width per line ({hero} = 5),
//            4 lines per page
//   play   — the whole region on the real field + event runtime (stub battles): arrival → カヤ → the three
//            murals → the hound → the door → Fine → the lava beast → clearRegion → the inn → the reward, plus
//            the branches (lost boss battle keeps the flags down, murals in another order, the spring)
//
//   node tools/test_reg7.js [static reach text play]
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const origWarn = console.warn;
console.warn = () => {};
const R = require(path.join(ROOT, 'tools/lib/load'))({ quiet: true, extra: [path.join(ROOT, 'tools/fixtures/reg7/node/stubs.js')] });
console.warn = origWarn;
const DB = R.DB;

let fails = 0, passes = 0, section = '';
const failed = [];
function ok(cond, msg) { if (cond) passes++; else { fails++; failed.push(section + ': ' + msg); console.log('  FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
const report = [];
const measure = (k, v) => report.push([k, v]);

const TOWN = 'caldera';
const FLOORS = ['ash_volcano_1', 'ash_volcano_2', 'ash_volcano_3'];
const MAPS = [TOWN].concat(FLOORS);
const own = R._nodeLoadErrors ? R._nodeLoadErrors.filter((e) => /region7_/.test(e)) : [];

const compile = (id) => { const w = R.warn; R.warn = () => {}; try { return R.FieldMap.compile(id); } finally { R.warn = w; } };
function withState(o, fn) {
  const g0 = R.Game;
  R.State.newGame();
  const g = R.Game;
  for (const f of o.flags || []) g.flags[f] = true;
  Object.assign(g.vars, o.vars || {});
  if (o.clear) { g.regionsCleared = ['r_ash']; g.tier = 1; g.flags.cleared_r_ash = true; }
  if (o.tier) { g.tier = o.tier; while (g.regionsCleared.length < o.tier) g.regionsCleared.push('r_x' + g.regionsCleared.length); }
  try { return fn(); } finally { R.Game = g0; }
}
/** 4-neighbour BFS; fixed NPCs block; o.block = extra blocked cells; o.noLava / o.noSecret */
function reach(m, sx, sy, o) {
  o = o || {};
  const blockNpc = new Set();
  for (const n of m.npcs) if (n.present && !R.FieldMap.pushable(n)) blockNpc.add(n.x + ',' + n.y);
  const pass = (x, y) => {
    if (!m.inMap(x, y)) return false;
    const t = m.tileAt(x, y);
    if (o.noSecret && /^secret_/.test(t)) return false;
    if (o.noLava && t === 'lava') return false;
    if (o.block && o.block.has(x + ',' + y)) return false;
    if (blockNpc.has(x + ',' + y)) return false;
    if (/^door/.test(t) || /^stairs/.test(t)) return true;
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
const near = (set, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has((x + dx) + ',' + (y + dy)));
const cnt = (m, tid) => { let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tileAt(x, y) === tid) n++; return n; };

// ============================================================ static
function testStatic() {
  section = 'static'; console.log('[static]');
  eq(own, [], 'no load errors in region7 files');
  for (const id of MAPS) ok(!!DB.maps[id], 'map ' + id + ' exists');
  const town = DB.maps[TOWN];
  const tm = compile(TOWN);
  ok(tm.w >= 40 && tm.h >= 32, 'town ≥ 40×32 (' + tm.w + '×' + tm.h + ')');
  eq([town.type, town.theme, town.bgm, town.location, town.region], ['town', 'town_ash', 'village', 'caldera', 'r_ash'], 'town header (§10.6.1)');
  ok(!!town.outside, 'town outside');
  eq(town.exit, { to: 'world', spawn: 'caldera' }, 'town exit → world caldera');
  ok(!town.encounter, 'no encounters in town');
  for (const sp of ['entrance', 'inn']) ok(town.spawns[sp] && tm.walkable(town.spawns[sp].x, town.spawns[sp].y), 'town spawn ' + sp + ' on a walkable cell');
  eq(town.spawns.inn.dir, 'down', 'inn spawn faces down');
  // services
  const npcs = Object.fromEntries(town.npcs.map((n) => [n.id, n]));
  for (const [id, ev] of [['inn', 'common_inn'], ['tavern', 'common_tavern'], ['shop_item', 'common_shop'], ['shop_weapon', 'common_shop'], ['shop_armor', 'common_shop']]) eq(npcs[id] && npcs[id].event, ev, 'NPC ' + id);
  for (const s of ['caldera_item', 'caldera_weapon', 'caldera_armor']) ok(Object.values(npcs).some((n) => n.shop === s) && DB.shops[s], 'shop ' + s + ' placed and defined');
  eq([npcs.folk_a && npcs.folk_a.rumor, npcs.folk_b && npcs.folk_b.rumor], ['caldera_a', 'caldera_b'], 'folk_a / folk_b rumors (§10.8.0-8)');
  eq(npcs.scribe && npcs.scribe.cond, [{ tier: 4 }, { tierBelow: 7 }], 'scribe cond (§10.9.5)');
  for (const id of ['dorga', 'kaya', 'ashkid']) ok(!!npcs[id], 'story NPC ' + id);
  // st_* spots (§10.8.0-7)
  const inn = town.spawns.inn;
  const SPOT = { st_rival: [0, 2, 'rowell', 'st_show_rival'], st_fine: [2, 2, 'fine', 'st_show_fine'], st_extra: [-2, 2, 'scribe', 'st_show_extra'] };
  const others = town.npcs.filter((n) => !SPOT[n.id]);
  for (const id in SPOT) {
    const [dx, dy, spr, cond] = SPOT[id], n = npcs[id];
    ok(n && n.x === inn.x + dx && n.y === inn.y + dy && n.dir === 'up' && n.sprite === 'npc:' + spr && n.cond === cond && n.fixed, id + ' at inn+(' + dx + ',' + dy + ')');
  }
  for (let y = inn.y; y <= inn.y + 2; y++) for (let x = inn.x - 2; x <= inn.x + 2; x++) {
    if (y < inn.y + 2 && Math.abs(x - inn.x) > (y - inn.y)) continue;
    ok(tm.walkable(x, y) && !others.some((n) => n.x === x && n.y === y) && !(town.chests || []).some((c) => c.x === x && c.y === y), 'st path cell ' + x + ',' + y + ' free');
  }
  // every NPC says fixed or push (§10.13.10), texts vary by the chapter (§10.8.0-9)
  for (const id of MAPS) for (const n of DB.maps[id].npcs || []) ok(n.fixed === true || n.push === true, id + ' npc ' + n.id + ' fixed/push');
  const talkers = town.npcs.filter((n) => Array.isArray(n.text) && typeof n.text[0] === 'object');
  const withClear = talkers.filter((n) => n.text.some((t) => JSON.stringify(t.cond || '').includes('r_ash')) && n.text.some((t) => !t.cond));
  measure('town NPCs', town.npcs.length);
  measure('town NPCs with before/after-clear lines', withClear.length);
  ok(withClear.length >= 15, 'at least 15 townsfolk change their line after the chapter');
  ok(talkers.some((n) => n.text.some((t) => /tier":4|final_open/.test(JSON.stringify(t.cond || '')))), 'a townsperson speaks of the scribes (tier 4) or the fog (final_open)');
  // chests (§8.12.4)
  const tc = town.chests || [];
  ok(tc.length <= 2 && tc.every((c) => ['p_supply', 'p_gold'].includes(c.pool)), 'town chests 0–2, supply or gold');
  let rare = 0;
  for (const id of MAPS) {
    const d = DB.maps[id];
    for (const c of d.chests || []) {
      ok(new RegExp('^' + id + '_c\\d+$').test(c.id) && !c.item && DB.pools[c.pool], id + ' chest ' + c.id + ' pool-only');
      if (c.pool === 'p_rare') rare++;
    }
  }
  eq(rare, 1, 'one p_rare in the dungeon');
  ok((DB.maps.ash_volcano_2.chests || []).some((c) => c.pool === 'p_rare'), 'p_rare on the floor before the boss floor');
  // floors
  for (let i = 0; i < 3; i++) {
    const id = FLOORS[i], d = DB.maps[id], m = compile(id);
    if (i < 2) ok(m.w >= 34 && m.h >= 30, id + ' ≥ 34×30 (' + m.w + '×' + m.h + ')');
    eq([d.type, d.theme, d.bgm, d.bbg, d.encounter, d.location, d.region, d.outside], ['dungeon', 'volcano', 'volcano', 'volcano', 'z_r_ash_volcano', 'ash_volcano', 'r_ash', '#'], id + ' header (§10.6.2)');
    eq(d.escape, { to: 'world', spawn: 'ash_volcano_1' }, id + ' escape');
    eq(d.lvOff, i === 1 ? 2 : undefined, id + ' lvOff (§10.6.2-9)');
    const n = (d.chests || []).length;
    ok(n >= 3 && n <= 5, id + ' 3–5 chests (' + n + ')');
    measure(id + ' size', m.w + '×' + m.h);
    measure(id + ' chests', (d.chests || []).map((c) => c.pool).join(' '));
    for (const w of d.warps || []) {
      const tgt = DB.maps[w.to];
      ok(tgt && (w.to === 'world' ? true : !!tgt.spawns[w.spawn]), id + ' warp → ' + w.to + '/' + w.spawn);
    }
    for (const sp in d.spawns) ok(m.walkable(d.spawns[sp].x, d.spawns[sp].y), id + ' spawn ' + sp + ' walkable');
  }
  ok(DB.maps.ash_volcano_1.spawns.entrance, '1F entrance');
  ok((DB.maps.ash_volcano_1.warps || []).some((w) => w.to === 'world' && w.spawn === 'ash_volcano_1'), '1F → world ash_volcano_1');
  for (const [id, sp] of [['ash_volcano_1', 'from_next'], ['ash_volcano_2', 'from_prev'], ['ash_volcano_2', 'from_next'], ['ash_volcano_3', 'from_prev']]) ok(DB.maps[id].spawns[sp], id + ' spawn ' + sp);
  for (const id of ['ash_volcano_2', 'ash_volcano_3']) ok(DB.maps[id].npcs.some((n) => n.id === 'rest' && n.event === 'common_rest' && n.sprite === 'obj:lantern'), id + ' 休息の灯');
  const l2 = cnt(compile('ash_volcano_2'), 'lava'), l3 = cnt(compile('ash_volcano_3'), 'lava');
  measure('lava 2F / 3F', l2 + ' / ' + l3);
  ok(l2 >= 10 && l2 <= 14, '2F lava ≈ 12 (' + l2 + ')');
  ok(l3 >= 14 && l3 <= 18, '3F lava ≈ 16 (' + l3 + ')');
  // secret passages (§10.6.4): only 2F, 1–3 cells
  for (const id of FLOORS) {
    const s = cnt(compile(id), 'secret_wall');
    if (id === 'ash_volcano_2') ok(s >= 1 && s <= 3, '2F secret passage 1–3 cells (' + s + ')');
    else eq(s, 0, id + ' has no secret passage');
  }
  // bosses, Fine, the egg
  const v2 = DB.maps.ash_volcano_2, v3 = DB.maps.ash_volcano_3;
  const boss2 = v2.npcs.find((n) => n.id === 'boss'), boss3 = v3.npcs.find((n) => n.id === 'boss');
  ok(boss2 && boss2.cond === '!ash_mid' && boss2.sprite === 'mon:' + DB.monsters.b_hellhound.sprite, '2F visible boss 炎の番犬');
  ok(boss3 && boss3.cond === '!ash_boss' && boss3.sprite === 'mon:' + DB.monsters.b_lavabeast.sprite, '3F visible boss 溶岩の巨獣');
  ok(v3.npcs.some((n) => n.id === 'fine' && n.sprite === 'npc:fine'), '3F Fine');
  ok(v3.events.some((e) => e.id === 'ash_volcano_3_fine' && e.once === 'ash_fine'), '3F Fine step band once ash_fine');
  eq(v3.tilePatches, [{ cond: { var: 'ash_murals', gte: 3 }, x: 20, y: 19, ch: '.' }], '3F rock door tilePatch');
  eq(compile('ash_volcano_3').tileAt(20, 19), 'rock_door', '3F rock door is a closed tile');
  for (const k of ['obj:r7_egg', 'obj:r7_egg_open', 'obj:r7_firebird']) ok(R.Gfx.has(k), 'art ' + k);
  // events and objectives
  for (const id of MAPS) {
    const d = DB.maps[id];
    const used = [].concat((d.npcs || []).map((n) => n.event), (d.events || []).map((e) => e.id), [d.onEnter]).filter(Boolean);
    for (const e of used) ok(!!DB.events[e] || /^(common_|story_)/.test(e), id + ' event ' + e + ' defined');
  }
  for (const o of ['obj_ash_1', 'obj_ash_2', 'obj_ash_3']) ok(DB.objectives[o] && DB.objectives[o].text, 'objective ' + o);
  eq(DB.events.ash_volcano_3_boss.meta.gives.includes('region:r_ash'), true, 'boss meta gives region:r_ash');
  eq(DB.events.caldera_kaya_reward.meta.gives, ['item:ac_tale_ash'], 'reward meta');
  ok(DB.items.ac_tale_ash, 'reward item ac_tale_ash exists');
}

// ============================================================ reach
function testReach() {
  section = 'reach'; console.log('[reach]');
  // town: everything the player talks to is reachable from the gate
  withState({ flags: ['ash_start'] }, () => {
    const m = compile(TOWN); m.refresh();
    const d = DB.maps[TOWN], s = reach(m, d.spawns.entrance.x, d.spawns.entrance.y);
    const counter = (n) => [[0, 2], [0, -2], [2, 0], [-2, 0]].some(([dx, dy]) => s.has((n.x + dx) + ',' + (n.y + dy)) && (R.DB.tiles[m.tileAt(n.x + dx / 2, n.y + dy / 2)] || {}).counter);
    for (const n of m.npcs) if (n.present && (n.event || n.text) && !/^(ash_|st_)/.test(n.id)) ok(near(s, n.x, n.y) || counter(n), 'town npc ' + n.id + ' reachable');
    for (const c of m.chests) ok(near(s, c.x, c.y), 'town chest ' + c.id + ' reachable');
    ok(s.has(d.spawns.inn.x + ',' + d.spawns.inn.y), 'inn spawn reachable');
    ok([41, 42, 43, 44].some((x) => s.has(x + ',21')), 'the spring is reachable');
    measure('town reachable cells', s.size);
  });
  // 1F
  withState({ flags: ['ash_start'] }, () => {
    const m = compile('ash_volcano_1'); m.refresh();
    const d = DB.maps.ash_volcano_1, s = reach(m, d.spawns.entrance.x, d.spawns.entrance.y);
    ok(s.has('38,4'), '1F stairs up reachable');
    ok(s.has('8,2'), '1F mural reachable');
    for (const c of m.chests) ok(near(s, c.x, c.y), '1F chest ' + c.id);
    measure('1F reachable cells', s.size);
  });
  // 2F: the hound holds the way on; the secret room
  for (const mid of [false, true]) withState({ flags: ['ash_start'].concat(mid ? ['ash_mid'] : []) }, () => {
    const m = compile('ash_volcano_2'); m.refresh();
    const d = DB.maps.ash_volcano_2, s = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { noLava: true });
    ok(s.has('39,2') === mid, '2F stairs up ' + (mid ? 'open after' : 'held before') + ' the hound');
    ok(s.has('24,2') === mid, '2F mural 2 ' + (mid ? 'open after' : 'held before') + ' the hound');
    ok(s.has('28,12') || near(s, 28, 11), '2F rest lantern reachable');
    const band = [[23, 10], [24, 10], [25, 10]];
    if (!mid) ok(band.some(([x, y]) => s.has(x + ',' + y)), '2F the boss band is reachable');
    if (mid) {
      const s2 = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { noLava: true, block: new Set(band.map(([x, y]) => x + ',' + y)) });
      ok(!s2.has('39,2'), '2F the boss band cannot be walked around');
      const ns = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { noLava: true, noSecret: true });
      const secretChests = m.chests.filter((c) => !near(ns, c.x, c.y));
      eq(secretChests.map((c) => c.pool).sort(), ['p_gear', 'p_gold'], '2F only p_gear + p_gold lie beyond the secret passage');
      for (const c of m.chests) ok(near(s, c.x, c.y), '2F chest ' + c.id + ' reachable (with the passage)');
      ok(ns.has('39,2') && ns.has('24,2'), '2F story path needs no secret passage');
    }
  });
  // 3F: the rock door, Fine, the boss, lava never required
  for (const k of [2, 3]) withState({ flags: ['ash_start', 'ash_mid'], vars: { ash_murals: k } }, () => {
    const m = compile('ash_volcano_3'); m.refresh();
    const d = DB.maps.ash_volcano_3, s = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { noLava: true });
    ok(s.has('34,21'), '3F mural 3 reachable without lava (murals ' + k + ')');
    ok(s.has('20,18') === (k >= 3), '3F crater ' + (k >= 3 ? 'open' : 'shut') + ' with ' + k + ' murals');
    for (const c of m.chests) ok(near(s, c.x, c.y), '3F chest ' + c.id);
    if (k >= 3) {
      const fb = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { block: new Set([18, 19, 20, 21, 22, 23].map((x) => x + ',17')) });
      ok(!fb.has('20,13'), '3F the Fine band cannot be walked around');
      const bb = reach(m, d.spawns.from_prev.x, d.spawns.from_prev.y, { block: new Set([18, 19, 20, 21, 22, 23].map((x) => x + ',12')) });
      ok(!bb.has('21,8'), '3F the boss band cannot be walked around');
      ok(s.has('18,15') || near(s, 18, 16), '3F rest lantern by the crater');
    }
  });
  // lava: 2F/3F lava is always beside the path (the whole floor stays reachable without stepping on it)
  for (const id of ['ash_volcano_2', 'ash_volcano_3']) withState({ flags: ['ash_start', 'ash_mid'], vars: { ash_murals: 3 } }, () => {
    const m = compile(id); m.refresh();
    const sp = DB.maps[id].spawns.from_prev;
    const a = reach(m, sp.x, sp.y), b = reach(m, sp.x, sp.y, { noLava: true });
    let lost = 0;
    for (const k of a) { const [x, y] = k.split(',').map(Number); if (m.tileAt(x, y) !== 'lava' && !b.has(k)) lost++; }
    eq(lost, 0, id + ': no cell needs a lava step');
  });
}

// ============================================================ text
function testText() {
  section = 'text'; console.log('[text]');
  const files = ['src/maps', 'src/events'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => /^region7_.*\.js$/.test(f)).map((f) => path.join(ROOT, d, f)));
  let n = 0;
  const width = (s) => { let w = 0; s = s.replace(/\{hero\}/g, '＿＿＿＿＿'); for (const ch of s) w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1; return w; };
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
    for (const m of src.matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
      const s = m[1];
      if (!/[぀-ヿ一-鿿]/.test(s)) continue;
      n++;
      const txt = s.replace(/\\n/g, '\n').replace(/\\f/g, '\f');
      for (const page of txt.split('\f')) {
        const lines = page.split('\n');
        ok(lines.length <= 4, path.basename(f) + ': ≤ 4 lines per page: ' + page.slice(0, 16));
        for (const l of lines) ok(width(l) <= 20, path.basename(f) + ': line ≤ 20: ' + l);
      }
    }
  }
  measure('Japanese strings checked', n);
}

// ============================================================ play
async function testPlay() {
  section = 'play'; console.log('[play]');
  const S = R.fxR7;
  R.Gfx.textWidth = (s) => R.Text.approxWidth(String(s));
  R.Settings.msgSpeed = 3;
  const flush = () => new Promise((r) => setImmediate(r));
  let frames = 0;
  async function step(k = 1) { for (let i = 0; i < k; i++) { if (++frames > 800000) throw new Error('frame budget'); R.Engine.step(); await flush(); } }
  async function press(b) { R.Input._set(b, true); await step(2); R.Input._set(b, false); await step(2); }
  const fieldTop = () => R.Engine.top() === R.Field.layer;
  async function settle(max = 6000) {
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
  const g = () => R.Game;
  const go = async (p) => { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 400 && !done; i++) await step(1); ok(done, 'warp finished'); return settle(); };
  const talk = async (id) => { const n = R.Field.npc(id); ok(!!n && n.present, 'npc ' + id + ' present on ' + R.Field.map.id); if (n) { R.Events.talk(n); ok(await settle(), 'talk ' + id + ' ends'); } };
  const run = async (id, trig, once) => { R.Events.run(id, { trigger: trig || 'examine', once }); ok(await settle(), id + ' ends'); };

  ok(await go(R.debug.quickStart({ level: 30, map: 'lute', spawn: 'inn', noEncounter: true })), 'quickStart');
  R.Field.noEncounter = true;
  // ---- 1. arrival
  let mark = sayLog.length;
  ok(await go(R.Field.warp(TOWN, 'entrance')), 'arrive at Caldera');
  ok(g().flags.ash_start, '#1 ash_start');
  eq(g().regionObj.r_ash, 'obj_ash_1', '#1 obj_ash_1');
  ok(said(/畑が全滅/, mark) && said(/百年目/, mark), '#1 ドルガ\'s lines');
  ok(!R.Field.npc('dorga_gate').present && R.Field.npc('dorga').present, '#1 ドルガ goes home');
  eq(g().respawn && g().respawn.map, TOWN, 'Caldera sets the respawn point');
  mark = sayLog.length;
  ok(await go(R.Field.warp(TOWN, 'entrance')), 'second arrival');
  ok(!said(/畑が全滅/, mark), 'the intro runs once');
  // ---- 2. カヤ
  mark = sayLog.length; await talk('kaya');
  eq(g().regionObj.r_ash, 'obj_ash_2', '#2 obj_ash_2');
  ok(said(/物語が出てこない/, mark) && said(/記録院の人に/, mark) && said(/壁画/, mark) || said(/描いた絵/, mark), '#2 カヤ: the story, Rowell\'s trace, the murals');
  mark = sayLog.length; await run('caldera_spring_closed');
  ok(said(/にごっている/, mark), 'the spring is shut before the chapter');
  // ---- 3. mural 1
  ok(await go(R.Field.warp('ash_volcano_1', 'entrance')), 'to 1F');
  eq(R.Field.map.encounter || DB.maps.ash_volcano_1.encounter, 'z_r_ash_volcano', '1F zone');
  ok(g().visited.ash_volcano, 'the volcano entrance joins the warp list');
  mark = sayLog.length; await run('ash_volcano_1_mural');
  eq(g().vars.ash_murals, 1, '#3 murals 1');
  ok(said(/小さな炎が生まれる/, mark), '#3 mural text');
  mark = sayLog.length; await run('ash_volcano_1_mural');
  eq(g().vars.ash_murals, 1, 'reading a mural twice does not count twice');
  // ---- 4. the hound (lose first: nothing is set)
  ok(await go(R.Field.warp('ash_volcano_2', 'from_prev')), 'to 2F');
  S.battleScript = ['lose'];
  S.battles.length = 0;
  R.Field.setPlayerPos(24, 10, 'up');
  R.Events.run('ash_volcano_2_boss', { trigger: 'step' });
  await settle();
  ok(!g().flags.ash_mid, 'a lost hound battle keeps ash_mid down');
  eq(S.battles[0] && S.battles[0].troop, 'tr_b_hellhound', '#4 troop tr_b_hellhound');
  ok(S.battles[0] && !S.battles[0].canLose, '#4 not canLose');
  if (!fieldTop() || R.Field.map.id !== 'ash_volcano_2') ok(await go(R.Field.warp('ash_volcano_2', 'from_prev')), 'back to 2F after the wipe');
  S.battleScript = ['win'];
  R.Field.setPlayerPos(24, 10, 'up');
  await run('ash_volcano_2_boss', 'step');
  ok(g().flags.ash_mid && !R.Field.npc('boss').present, '#4 ash_mid, the hound is gone');
  // ---- 5. mural 2
  mark = sayLog.length; await run('ash_volcano_2_mural');
  eq(g().vars.ash_murals, 2, '#5 murals 2');
  ok(said(/大地を温めている/, mark), '#5 mural text');
  // ---- 6. mural 3 → the door
  ok(await go(R.Field.warp('ash_volcano_3', 'from_prev')), 'to 3F');
  eq(R.Field.map.tileAt(20, 19), 'rock_door', 'the rock door is shut with 2 murals');
  mark = sayLog.length; await run('ash_volcano_3_door');
  ok(said(/ふたつが/, mark), 'the door counts the murals');
  mark = sayLog.length; await run('ash_volcano_3_mural');
  eq(g().vars.ash_murals, 3, '#6 murals 3');
  ok(said(/ふたたび卵から生まれる/, mark), '#6 mural text');
  eq(R.Field.map.tileAt(20, 19), 'floor', '#6 the rock door opens');
  eq(g().regionObj.r_ash, 'obj_ash_3', '#6 obj_ash_3');
  // ---- 7. Fine and the boss
  R.Field.setPlayerPos(20, 17, 'up');
  await run('ash_volcano_3_fine', 'step', 'ash_fine');
  ok(g().flags.ash_fine, '#7 ash_fine');
  ok(!R.Field.npc('fine').present, '#7 Fine is gone');
  S.battleScript = ['win'];
  S.battles.length = 0;
  S.jingles.length = 0;
  R.Field.setPlayerPos(21, 12, 'up');
  mark = sayLog.length;
  R.Events.run('ash_volcano_3_boss', { trigger: 'step' });
  ok(await settle(20000), '#7–8 the boss scene ends');
  eq(S.battles[0] && S.battles[0].troop, 'tr_b_lavabeast', '#7 troop tr_b_lavabeast');
  ok(g().flags.ash_boss, '#7 ash_boss');
  ok(g().regionsCleared.includes('r_ash') && g().flags.cleared_r_ash, '#8 ev.clearRegion(r_ash)');
  ok(R.State.hasItem('k_page_ash'), '#8 灰のページ');
  ok(said(/壁画の物語を語った/, mark) && said(/よみがえった/, mark), '#8 the story is told, the firebird lives');
  ok(S.jingles.includes('chapter'), '#8 chapter jingle');
  eq(R.Field.map.id, TOWN, 'after the chapter: the Caldera inn');
  const inn = DB.maps[TOWN].spawns.inn, p = R.Field.pos();
  ok(Math.abs(p.x - inn.x) <= 3 && Math.abs(p.y - inn.y) <= 3, 'at the inn');
  ok(R.Game.party.every((c) => c.hp > 0), 'healed at the inn');
  // ---- after the chapter
  ok(R.Field.npc('kaya_after').present && !R.Field.npc('kaya').present, 'カヤ after the chapter');
  mark = sayLog.length; await talk('kaya_after');
  ok(R.State.hasItem('ac_tale_ash') && g().flags.caldera_kaya_reward, 'the reward 残り火の宝珠');
  const n0 = R.State.count('ac_tale_ash');
  await talk('kaya_after');
  eq(R.State.count('ac_tale_ash'), n0, 'the reward is given once');
  for (const c of R.Game.party) c.hp = 1;
  mark = sayLog.length; await run('caldera_spring');
  ok(R.Game.party.every((c) => c.hp === R.Rules.stats(c).hp), 'the spring heals for free');
  eq(R.Field.map.tileAt(31, 30), 'lgrass', 'the field turns green');
  ok(!R.Field.npc('ash_a').present, 'the ash piles are gone');
  ok(await go(R.Field.warp('ash_volcano_3', 'from_prev')), 'back to the crater');
  ok(R.Field.npc('egg_open').present && R.Field.npc('firebird').present && !R.Field.npc('boss').present, 'the crater after the chapter: the shell and the firebird');
  measure('play frames', frames);
  measure('play: message pages', sayLog.length);
  measure('play: battles fought', S.battles.length + 2);
}

(async () => {
  const want = process.argv.slice(2);
  const on = (s) => !want.length || want.includes(s);
  if (on('static')) testStatic();
  if (on('reach')) testReach();
  if (on('text')) testText();
  if (on('play')) await testPlay();
  console.log('\n-- measured');
  for (const [k, v] of report) console.log('  ' + k + ': ' + v);
  console.log('\n' + (fails ? 'FAILED' : 'OK') + ' — ' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
