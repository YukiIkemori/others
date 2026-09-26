#!/usr/bin/env node
// test_reg3.js (owner R3 reg3) — unit tests for r_snow ノルデン雪原: 雪の村ユール (yule) and 白竜の峰
// (frost_peak_1..3). DESIGN §10.6.1–§10.6.4, §10.8.0 (all rules), §10.8.4, §10.9, §10.13, §11.2.
// Node only; exit 1 on any failure. The event scripts are run against a mock `ev` over the real
// R.State (the same calls the field makes), so the story flow is tested end to end:
// intro → hearth → ice walls → the giant → Fine → the dragon → clearRegion → the inn → story_after_clear.
//
//   node tools/test_reg3.js [-v]
'use strict';
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps');
const Cond = require('./lib/cond');

const VERBOSE = process.argv.includes('-v');
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); }
  else { fail++; fails.push(msg); console.log('  FAIL ' + msg); }
}
function section(t) { if (VERBOSE) console.log('\n# ' + t); }

const DB = R.DB;
const TOWN = 'yule';
const FLOORS = ['frost_peak_1', 'frost_peak_2', 'frost_peak_3'];
const MAPS = [TOWN].concat(FLOORS);
const P = {};
for (const id of MAPS) P[id] = M.parseMap(R, id);

// ------------------------------------------------------------------ helpers
const passable = (Pm, x, y, S) => {
  if (!Pm.inMap(x, y)) return false;
  const t = DB.tiles[Pm.patchedAt(x, y, (c) => Cond.check(c, S))];
  if (!t) return false;
  const d = Pm.decorDef(x, y);
  if (d && !d.pass && !d.over) return false;
  return !!t.pass;
};
const npcBlocks = (Pm, S) => {
  const s = new Set();
  for (const n of Pm.npcs) {
    if (n.cond != null && !Cond.check(n.cond, S)) continue;
    if (n.fixed) s.add(n.x + ',' + n.y);
  }
  for (const c of Pm.chests) s.add(c.x + ',' + c.y);
  return s;
};
/** BFS over the floor from (x,y) with state S; step events with `stopAt` ids stop the walk there */
function reach(Pm, from, S, o) {
  o = o || {};
  const block = npcBlocks(Pm, S);
  const seen = new Set([from.x + ',' + from.y]);
  const q = [[from.x, from.y]];
  const stop = new Set();
  if (o.stopAt) for (const e of Pm.events) if (e.trigger === 'step' && o.stopAt.includes(e.id) && Cond.check(e.cond, S)) stop.add(e.x + ',' + e.y);
  while (q.length) {
    const [x, y] = q.shift();
    if (stop.has(x + ',' + y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || block.has(k) || !passable(Pm, nx, ny, S)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}
const adj = (set, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has((x + dx) + ',' + (y + dy)));
const sets = (o) => Cond.fromSets(Object.assign({ flags: [], items: [], vars: {}, cleared: [], tier: 0 }, o || {}));
const width = (s) => { let w = 0; for (const ch of s.replace(/\{hero\}/g, '＿＿＿＿＿')) w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1; return w; };
function allTexts(v, out) {
  out = out || [];
  if (v == null) return out;
  if (typeof v === 'string') { out.push(v); return out; }
  if (Array.isArray(v)) { for (const e of v) allTexts(e, out); return out; }
  if (typeof v === 'object' && v.text != null) allTexts(v.text, out);
  return out;
}

// ------------------------------------------------------------------ 1. map keys (§10.6.1, §10.6.2, §3.3.10)
section('map keys');
{
  const d = DB.maps.yule;
  ok(!!d, 'yule exists');
  ok(d.type === 'town' && d.theme === 'town_snow' && d.bgm === 'village', 'yule: town / town_snow / village');
  ok(d.location === 'yule' && d.region === 'r_snow', 'yule: location yule, region r_snow');
  ok(d.outside === 'T', 'yule: outside T (snow village, §10.6.1)');
  ok(d.exit && d.exit.to === 'world' && d.exit.spawn === 'yule', 'yule: exit → world spawn yule');
  ok(P.yule.w >= 40 && P.yule.h >= 32, 'yule: at least 40×32 (' + P.yule.w + '×' + P.yule.h + ')');
  ok(P.yule.w >= 32 && P.yule.h >= 28, 'yule: larger than the widest field view (no void at any zoom)');
  for (const id of FLOORS) {
    const f = DB.maps[id];
    ok(f.type === 'dungeon' && f.encounter === 'z_r_snow_peak' && f.region === 'r_snow' && f.location === 'frost_peak', id + ': dungeon, zone z_r_snow_peak, region, location');
    ok(f.bgm === 'ice', id + ': BGM ice');
    ok(f.escape && f.escape.to === 'world' && f.escape.spawn === 'frost_peak_1', id + ': escape → world frost_peak_1');
    ok(P[id].w >= 34 && P[id].h >= 30, id + ': at least 34×30 (' + P[id].w + '×' + P[id].h + ')');
    ok(P[id].w >= 32 && P[id].h >= 28, id + ': larger than the widest field view');
    ok(!!DB.encounters.z_r_snow_peak, 'zone z_r_snow_peak exists');
  }
  ok(DB.maps.frost_peak_1.theme === 'ice' && DB.maps.frost_peak_2.theme === 'ice' && DB.maps.frost_peak_3.theme === 'snow', 'themes ice · ice · snow (§10.6.2)');
  ok(DB.maps.frost_peak_1.bbg === 'ice' && DB.maps.frost_peak_2.bbg === 'ice' && DB.maps.frost_peak_3.bbg === 'snow', 'battle backdrops ice · ice · snow');
  ok(DB.maps.frost_peak_1.outside === '#' && DB.maps.frost_peak_2.outside === '#' && DB.maps.frost_peak_3.outside === 'r', 'outside # · # · r (§10.6.2-10)');
  ok(DB.maps.frost_peak_1.lvOff == null && DB.maps.frost_peak_2.lvOff === 2 && DB.maps.frost_peak_3.lvOff == null, 'lvOff: 1F none, 2F 2, boss floor none (§10.6.2-9)');
  for (const id of MAPS) {
    const d2 = DB.maps[id];
    const w = d2.rows[0].length;
    ok(d2.rows.every((r) => r.length === w) && d2.decor.length === d2.rows.length && d2.decor.every((r) => r.length === w), id + ': rows and decor rows all ' + w + ' wide');
    // the story-scene slots st_* are text-less by the spec (§10.8.0-7: story drives them)
    const issues = P[id].issues.filter((s) => !/^npc st_(rival|fine|extra) has neither text nor event$/.test(s));
    ok(!issues.length, id + ': compiles without warnings' + (issues.length ? ' (' + issues.join('; ') + ')' : ''));
    ok(d2.chestTier == null, id + ': no chestTier (tier chests follow R.Game.tier)');
  }
}

// ------------------------------------------------------------------ 2. spawns, warps, stairs (§10.6.2-1..3)
section('spawns and warps');
{
  const sp = (id, n) => P[id].spawns[n];
  ok(sp('yule', 'entrance') && sp('yule', 'inn'), 'yule spawns entrance + inn');
  ok(sp('yule', 'inn').dir === 'down', 'yule inn spawn faces down');
  ok(sp('frost_peak_1', 'entrance') && sp('frost_peak_1', 'from_next'), '1F spawns entrance / from_next');
  ok(sp('frost_peak_2', 'from_prev') && sp('frost_peak_2', 'from_next'), '2F spawns from_prev / from_next');
  ok(sp('frost_peak_3', 'from_prev'), '3F spawn from_prev');
  const w = (id) => P[id].warps;
  ok(w('frost_peak_1').some((x) => x.to === 'world' && x.spawn === 'frost_peak_1'), '1F warp → world frost_peak_1');
  ok(w('frost_peak_1').some((x) => x.to === 'frost_peak_2' && x.spawn === 'from_prev'), '1F stairs → 2F from_prev');
  ok(w('frost_peak_2').some((x) => x.to === 'frost_peak_1' && x.spawn === 'from_next'), '2F stairs → 1F from_next');
  ok(w('frost_peak_2').some((x) => x.to === 'frost_peak_3' && x.spawn === 'from_prev'), '2F stairs → 3F from_prev');
  ok(w('frost_peak_3').some((x) => x.to === 'frost_peak_2' && x.spawn === 'from_next'), '3F stairs → 2F from_next');
  for (const id of MAPS) {
    for (const x of w(id)) {
      const tgt = x.to === 'world' ? DB.maps.world : DB.maps[x.to];
      ok(!!tgt && !!(tgt.spawns && tgt.spawns[x.spawn]), id + ': warp ' + x.x + ',' + x.y + ' → ' + x.to + '/' + x.spawn + ' exists');
      const t = P[id].tileAt(x.x, x.y);
      ok(!!(DB.tiles[t] && DB.tiles[t].pass), id + ': warp cell ' + x.x + ',' + x.y + ' is walkable (' + t + ')');
    }
    for (const n in P[id].spawns) {
      const s = P[id].spawns[n];
      ok(passable(P[id], s.x, s.y, sets({ items: ['k_winter_flame'], flags: ['snow_mid'] })), id + ': spawn ' + n + ' stands on a walkable cell');
    }
  }
  // the world side (world owner): the spawns this area needs are there
  ok(!!(DB.maps.world && DB.maps.world.spawns.yule && DB.maps.world.spawns.frost_peak_1), 'world spawns yule and frost_peak_1 exist');
  // the stairs cells are drawn as stairs
  ok(/stairs_up/.test(P.frost_peak_1.tileAt(39, 3)) && /stairs_down/.test(P.frost_peak_2.tileAt(5, 32)) && /stairs_up/.test(P.frost_peak_2.tileAt(40, 1)) && /stairs_down/.test(P.frost_peak_3.tileAt(20, 34)), 'stair tiles under the stair warps');
}

// ------------------------------------------------------------------ 3. town NPCs and services (§10.6.1, §10.8.0-7/8/9, §10.9.5, §10.13.10)
section('town');
{
  const Y = P.yule;
  const n = (id) => Y.npcs.find((x) => x.id === id);
  ok(n('inn') && n('inn').event === 'common_inn' && n('inn').fixed, 'inn: common_inn, fixed');
  ok(n('tavern') && n('tavern').event === 'common_tavern' && n('tavern').fixed, 'tavern: common_tavern, fixed');
  for (const [id, shop] of [['shop_item', 'yule_item'], ['shop_weapon', 'yule_weapon'], ['shop_armor', 'yule_armor']]) {
    ok(n(id) && n(id).event === 'common_shop' && n(id).shop === shop && n(id).fixed, id + ' → ' + shop);
    ok(!!DB.shops[shop], 'shop ' + shop + ' exists');
  }
  ok(n('folk_a') && n('folk_a').event === 'story_rumor' && n('folk_a').rumor === 'yule_a' && n('folk_a').push, 'folk_a: story_rumor yule_a, push');
  ok(n('folk_b') && n('folk_b').event === 'story_rumor' && n('folk_b').rumor === 'yule_b' && n('folk_b').push, 'folk_b: story_rumor yule_b, push');
  const sc = n('scribe');
  ok(sc && sc.sprite === 'npc:scribe' && sc.move === 'wander' && sc.push, 'scribe: npc:scribe, wanders, push');
  ok(sc && !Cond.check(sc.cond, sets({ tier: 3 })) && Cond.check(sc.cond, sets({ tier: 4 })) && Cond.check(sc.cond, sets({ tier: 6 })) && !Cond.check(sc.cond, sets({ tier: 7 })), 'scribe shows at tiers 4–6 only');
  ok(allTexts(sc && sc.text).join('') === '古い本はありませんか。\n記録院で、大切に保管\nいたします。', 'scribe line as §10.9.5');
  const inn = Y.spawns.inn;
  const slots = { st_rival: [0, 2, 'rowell', 'st_show_rival'], st_fine: [2, 2, 'fine', 'st_show_fine'], st_extra: [-2, 2, 'scribe', 'st_show_extra'] };
  for (const id in slots) {
    const [dx, dy, spr, fl] = slots[id];
    const s = n(id);
    ok(s && s.x === inn.x + dx && s.y === inn.y + dy && s.dir === 'up' && s.sprite === 'npc:' + spr && s.cond === fl && s.fixed, id + ' at inn ' + (dx >= 0 ? '+' : '') + dx + ',+' + dy + ', up, npc:' + spr + ', cond ' + fl);
  }
  // the slots and the cells from the inn spawn to them: walkable, nothing else on them (§10.8.0-7)
  const path = [[0, 1], [0, 2], [1, 2], [2, 2], [-1, 2], [-2, 2]].map(([dx, dy]) => [inn.x + dx, inn.y + dy]);
  const others = Y.npcs.filter((x) => !/^st_/.test(x.id)).concat(Y.chests, Y.signs, Y.events);
  for (const [x, y] of path) {
    ok(passable(Y, x, y, sets({})) && !Y.decorAt(x, y), 'st path ' + x + ',' + y + ': walkable floor, no decor');
    ok(!others.some((o) => o.x === x && o.y === y), 'st path ' + x + ',' + y + ': no other object');
    // wandering townsfolk never reach it (home ≥ 3 cells away)
    ok(!Y.npcs.some((o) => o.move === 'wander' && Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2), 'st path ' + x + ',' + y + ': out of every wanderer\'s range');
  }
  // every NPC says fixed or push (§10.13.10)
  for (const o of Y.npcs) ok(!!(o.fixed || o.push), 'yule npc ' + o.id + ': fixed or push');
  // story NPCs named in §10.8.4
  ok(n('jorn') && n('jorn').sprite === 'npc:elder', 'ヨルン: npc:elder');
  ok(n('sonja') && n('sonja').sprite === 'npc:girl', 'ソーニャ: npc:girl');
  ok(n('beck') && n('beck').sprite === 'npc:man', 'ベック: npc:man');
  ok(allTexts(n('beck').text).some((t) => t.includes('峰の2階に、でかい氷の巨人がいる')), 'ベック: the ice giant line (§10.8.4)');
  // tier-varying lines: every townsfolk with {cond,text} lines has a before and an after-clear line (§10.8.0-9)
  const talkers = Y.npcs.filter((o) => Array.isArray(o.text) && o.text.length && typeof o.text[0] === 'object');
  let both = 0;
  for (const o of talkers) {
    const before = o.text.find((e) => Cond.check(e.cond, sets({})));
    const after = o.text.find((e) => Cond.check(e.cond, sets({ cleared: ['r_snow'], tier: 1 })));
    if (before && after && before !== after) both++;
  }
  ok(talkers.length >= 12, 'at least 12 townsfolk with tier lines (' + talkers.length + ')');
  ok(both >= 12, 'at least 12 of them differ before / after the clear (' + both + ')');
  ok(talkers.some((o) => o.text.some((e) => e.cond && (Cond.refs(e.cond).flags.includes('final_open') || (typeof e.cond === 'object' && e.cond.tier >= 4)))), 'someone speaks of the tier-4 notice or the lifted fog (§10.9.3)');
  // 記録院の立て札 (tier 1)
  const notice = Y.signs.find((s) => s.cond && Cond.check(s.cond, sets({ tier: 1 })) && !Cond.check(s.cond, sets({ tier: 0 })));
  ok(notice && allTexts(notice.text).join('') === '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', 'the tier-1 notice sign (§10.9.1)');
  ok(notice && DB.maps.yule.tilePatches.some((p) => p.x === notice.x && p.y === notice.y && p.ch === 'm' && Cond.check(p.cond, sets({ tier: 1 })) && !Cond.check(p.cond, sets({}))), 'the notice board appears at tier 1 (tilePatch)');
  ok(notice && Math.abs(notice.x - Y.spawns.entrance.x) + Math.abs(notice.y - Y.spawns.entrance.y) <= 4, 'the notice stands near the entrance');
  // chests in town: 0–2, p_supply / p_gold
  ok(Y.chests.length <= 2 && Y.chests.every((c) => ['p_supply', 'p_gold'].includes(c.pool)), 'town chests: ≤2, p_supply/p_gold');
  // everything the player must talk to is reachable from the entrance (before and after the clear)
  for (const S of [sets({ flags: ['snow_start'] }), sets({ flags: ['snow_start', 'snow_flame', 'snow_boss'], cleared: ['r_snow'], tier: 1 })]) {
    const r = reach(Y, Y.spawns.entrance, S);
    for (const o of Y.npcs.filter((x) => Cond.check(x.cond, S) && !/^st_/.test(x.id))) {
      ok(adj(r, o.x, o.y) || r.has(o.x + ',' + o.y) || Y.fm.counterAt(o.x, o.y + 1) || [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => Y.fm.counterAt(o.x + dx, o.y + dy) && adj(r, o.x + dx * 2, o.y + dy * 2) || r.has((o.x + dx * 2) + ',' + (o.y + dy * 2))), 'yule: can talk to ' + o.id);
    }
    for (const c of Y.chests) ok(adj(r, c.x, c.y), 'yule: chest ' + c.id + ' reachable');
    ok(r.has(Y.spawns.inn.x + ',' + Y.spawns.inn.y), 'yule: inn spawn reachable');
    // the exit: the bottom edge is reachable
    ok([...r].some((k) => +k.split(',')[1] === Y.h - 1), 'yule: the gate (bottom edge) is reachable');
  }
  // the hearth: examine / talk cells face it from the hall floor
  const hr = reach(Y, Y.spawns.entrance, sets({ flags: ['snow_start'] }));
  ok(n('hearth') && adj(hr, n('hearth').x, n('hearth').y), 'the hearth can be reached');
  ok(Y.events.filter((e) => e.id === 'yule_hearth').every((e) => adj(hr, e.x, e.y)), 'the hearth examine cells can be reached');
  ok(DB.maps.yule.respawnSpawn === 'inn', 'yule respawns at the inn');
  ok(DB.maps.yule.onEnter === 'yule_enter', 'yule onEnter yule_enter');
}

// ------------------------------------------------------------------ 4. dungeon structure (§10.6.2, §10.6.4, §10.8.0-5/6, §8.12.4)
section('dungeon');
{
  const pools = new Set(['p_supply', 'p_gold', 'p_stone', 'p_gear', 'p_weapon', 'p_armor', 'p_acc', 'p_rare']);
  let rare = [];
  for (const id of FLOORS) {
    const f = P[id];
    const n = f.chests.length;
    ok(n >= (id === 'frost_peak_3' ? 2 : 3) && n <= 5, id + ': ' + n + ' chests (3–5 a floor; the summit 2–5)');
    for (const c of f.chests) {
      ok(c.id === id + '_c' + c.id.split('_c').pop() && /^\d+$/.test(c.id.split('_c').pop()), id + ': chest id ' + c.id);
      ok(pools.has(c.pool) && c.item == null, id + ': chest ' + c.id + ' uses a pool (' + c.pool + ')');
    }
    rare = rare.concat(f.chests.filter((c) => c.pool === 'p_rare').map((c) => id));
    for (const o of f.npcs) ok(!!(o.fixed || o.push), id + ' npc ' + o.id + ': fixed or push');
  }
  ok(rare.length === 1 && rare[0] === 'frost_peak_2', 'one p_rare in the dungeon, on the floor before the boss floor');
  const sup = FLOORS.reduce((a, id) => a + P[id].chests.filter((c) => c.pool === 'p_supply').length, 0);
  const all = FLOORS.reduce((a, id) => a + P[id].chests.length, 0);
  ok(sup / all >= 0.3 && sup / all <= 0.6, 'p_supply is about half of the chests (' + sup + '/' + all + ')');
  // rest lamps: before the boss and on the middle floor
  ok(P.frost_peak_3.npcs.some((o) => o.id === 'rest' && o.event === 'common_rest' && o.sprite === 'obj:lantern'), '3F: 休息の灯 before the boss');
  ok(P.frost_peak_2.npcs.some((o) => o.id === 'rest' && o.event === 'common_rest' && o.sprite === 'obj:lantern'), '2F: 休息の灯 on the middle floor (§10.6.2-5)');
  // secret passages (§10.6.4: frost_peak_2 — a nook with p_gold apart from the lamp)
  const secrets = (id) => { const out = []; for (let y = 0; y < P[id].h; y++) for (let x = 0; x < P[id].w; x++) if (M.isSecret(R, P[id].tileAt(x, y))) out.push([x, y]); return out; };
  ok(secrets('frost_peak_1').length === 0 && secrets('frost_peak_3').length === 0, 'no secret passage on 1F / 3F');
  const sec = secrets('frost_peak_2');
  ok(sec.length >= 1 && sec.length <= 3, '2F: a secret passage 1–3 cells long (' + sec.length + ')');
  const F2 = P.frost_peak_2;
  const S2 = sets({ items: ['k_winter_flame'], flags: ['snow_start', 'snow_flame'] });
  const noSecret = (Pm) => Object.assign({}, Pm, { patchedAt: (x, y, fn) => (M.isSecret(R, Pm.tileAt(x, y)) ? 'wall' : Pm.patchedAt(x, y, fn)) });
  const withS = reach(F2, F2.spawns.from_prev, S2);
  const withoutS = reach(noSecret(F2), F2.spawns.from_prev, S2);
  const gold = F2.chests.find((c) => c.pool === 'p_gold' && !adj(withoutS, c.x, c.y));
  ok(!!gold && adj(withS, gold.x, gold.y), '2F: the p_gold chest is reached only through the secret passage');
  const lamp = F2.npcs.find((o) => o.id === 'rest');
  ok(adj(withoutS, lamp.x, lamp.y), '2F: the lamp is not behind the secret passage');
  // nothing the story needs is behind it: the boss band and the stairs are reached without it
  const S2m = sets({ items: ['k_winter_flame'], flags: ['snow_start', 'snow_flame', 'snow_mid'] });
  ok(reach(noSecret(F2), F2.spawns.from_prev, S2m).has('40,1'), '2F: the stairs up are reached without the secret passage');
  // the entrance of the secret passage is a dead end ("なんでもない行き止まり")
  ok(sec.every(([x, y]) => adj(withoutS, x, y) || sec.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1)), '2F: the cracked wall faces a walkable dead end');
}

// ------------------------------------------------------------------ 5. closed tiles and progress on the floors (§10.8.0-6, §10.8.4 #4–7)
section('ice walls and the way up');
{
  const F1 = P.frost_peak_1, F2 = P.frost_peak_2, F3 = P.frost_peak_3;
  const iceCells = (Pm) => { const out = []; for (let y = 0; y < Pm.h; y++) for (let x = 0; x < Pm.w; x++) if (Pm.tileAt(x, y) === 'ice_wall') out.push([x, y]); return out; };
  const i1 = iceCells(F1), i2 = iceCells(F2);
  ok(i1.length >= 1 && i2.length >= 1, 'ice walls on 1F (' + i1.length + ') and 2F (' + i2.length + ')');
  for (const [Pm, cells, id] of [[F1, i1, 'frost_peak_1'], [F2, i2, 'frost_peak_2']]) {
    for (const [x, y] of cells) {
      const ex = Pm.events.find((e) => e.x === x && e.y === y && e.trigger === 'examine');
      ok(!!ex && !!DB.events[ex.id], id + ': ice wall ' + x + ',' + y + ' has an examine event');
      const opened = Pm.patchedAt(x, y, (c) => Cond.check(c, sets({ items: ['k_winter_flame'], flags: ['snow_mid'] })));
      ok(DB.tiles[opened] && DB.tiles[opened].pass, id + ': ice wall ' + x + ',' + y + ' opens (' + opened + ')');
    }
  }
  // the fire-wall patches are {item:'k_winter_flame'} (§10.8.4 #4)
  ok(DB.maps.frost_peak_1.tilePatches.some((p) => p.cond && p.cond.item === 'k_winter_flame'), '1F: tilePatch {item:k_winter_flame}');
  ok(DB.maps.frost_peak_2.tilePatches.some((p) => p.cond && p.cond.item === 'k_winter_flame'), '2F: tilePatch {item:k_winter_flame}');
  // 1F: without the fire the entrance hall is walkable but the stairs are not reached
  const no = sets({ flags: ['snow_start'] }), yes = sets({ flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'] });
  const r0 = reach(F1, F1.spawns.entrance, no), r1 = reach(F1, F1.spawns.entrance, yes);
  ok(r0.size >= 150, '1F: the entrance area can be walked without the fire (' + r0.size + ' cells)');
  ok(!r0.has('39,3') && r1.has('39,3'), '1F: the stairs up need the fire');
  ok(F1.chests.some((c) => adj(r0, c.x, c.y)), '1F: a chest near the entrance without the fire');
  for (const c of F1.chests) ok(adj(r1, c.x, c.y), '1F: chest ' + c.id + ' reachable with the fire');
  // 2F: the giant's band stops the way up until snow_mid; his wall opens after
  const r2 = reach(F2, F2.spawns.from_prev, yes, { stopAt: ['frost_peak_2_boss'] });
  ok(!r2.has('40,1'), '2F: the stairs up are behind the giant');
  const bandCells = F2.events.filter((e) => e.id === 'frost_peak_2_boss');
  ok(bandCells.length >= 3 && bandCells.some((e) => r2.has(e.x + ',' + e.y)), '2F: the giant\'s step band is reached');
  const r2b = reach(F2, F2.spawns.from_prev, sets({ flags: ['snow_start', 'snow_flame'], items: ['k_winter_flame'] }));
  ok(!r2b.has('40,1'), '2F: without snow_mid the giant\'s wall still closes the stairs');
  const r2c = reach(F2, F2.spawns.from_prev, sets({ flags: ['snow_start', 'snow_flame', 'snow_mid'], items: ['k_winter_flame'] }));
  ok(r2c.has('40,1'), '2F: after snow_mid the stairs up are open');
  const lamp2 = F2.npcs.find((o) => o.id === 'rest');
  ok(adj(r2, lamp2.x, lamp2.y), '2F: the lamp is before the giant');
  for (const c of F2.chests) ok(adj(r2c, c.x, c.y), '2F: chest ' + c.id + ' reachable');
  const boss2 = F2.npcs.find((o) => o.id === 'boss');
  ok(boss2 && boss2.sprite === 'mon:boss_frost_giant' && boss2.cond === '!snow_mid' && boss2.event === 'frost_peak_2_boss', '2F: the visible giant (mon:boss_frost_giant, !snow_mid)');
  // 3F: Fine's band, then the lamp and Fine, then the dragon's band
  const S3 = sets({ flags: ['snow_start', 'snow_flame', 'snow_mid'], items: ['k_winter_flame'] });
  const r3 = reach(F3, F3.spawns.from_prev, S3, { stopAt: ['frost_peak_3_fine', 'frost_peak_3_boss'] });
  const fineBand = F3.events.filter((e) => e.id === 'frost_peak_3_fine');
  const bossBand = F3.events.filter((e) => e.id === 'frost_peak_3_boss');
  ok(fineBand.every((e) => e.once === 'snow_fine'), '3F: Fine\'s step is once snow_fine');
  ok(fineBand.some((e) => r3.has(e.x + ',' + e.y)), '3F: Fine\'s band is reached first');
  ok(!bossBand.some((e) => r3.has(e.x + ',' + e.y)), '3F: the dragon\'s band lies behind Fine\'s');
  const fine = F3.npcs.find((o) => o.id === 'fine'), lamp3 = F3.npcs.find((o) => o.id === 'rest');
  ok(fine && fine.sprite === 'npc:fine' && Cond.check(fine.cond, S3) && !Cond.check(fine.cond, sets({ flags: ['snow_boss'] })), '3F: NPC fine (npc:fine), gone after snow_boss');
  const r3b = reach(F3, F3.spawns.from_prev, sets({ flags: ['snow_start', 'snow_flame', 'snow_mid', 'snow_fine'], items: ['k_winter_flame'] }), { stopAt: ['frost_peak_3_boss'] });
  ok(adj(r3b, lamp3.x, lamp3.y) && adj(r3b, fine.x, fine.y), '3F: the lamp and Fine stand before the boss');
  ok(Math.abs(lamp3.x - fine.x) + Math.abs(lamp3.y - fine.y) <= 6, '3F: Fine stands by the lamp');
  ok(bossBand.some((e) => r3b.has(e.x + ',' + e.y)), '3F: the dragon\'s band is reached after Fine');
  const drag = F3.npcs.find((o) => o.id === 'boss');
  ok(drag && drag.sprite === 'mon:boss_whitedragon' && drag.cond === '!snow_boss', '3F: the visible dragon (mon:boss_whitedragon, !snow_boss)');
  ok(F3.npcs.some((o) => o.id === 'neve' && o.cond === 'snow_boss'), '3F: the calm dragon after the clear');
  for (const c of F3.chests) ok(adj(reach(F3, F3.spawns.from_prev, S3), c.x, c.y), '3F: chest ' + c.id + ' reachable');
}

// ------------------------------------------------------------------ 6. the event scripts on a mock ev (§10.8.0-3/4, §10.8.4)
section('events');
function mockEv(map, log) {
  const npcs = {};
  const npc = (id) => (npcs[id] = npcs[id] || { id, visible: true, face() {}, walk: async () => {}, hide() { this.visible = false; }, show() { this.visible = true; }, setPos() {} });
  const ev = {
    ctx: {}, self: null, map, log, battles: [],
    battleResult: 'win',
    async say(t, o) { log.push(['say', Array.isArray(t) ? t.join('\f') : t, o]); },
    async ask() { return 0; }, async yesno() { return true; },
    async caption(t) { log.push(['caption', t]); }, closeMessage() {},
    flag: (n) => R.State.flag(n), setFlag: (n, v = true) => R.State.setFlag(n, v), check: (c) => R.State.check(c),
    var: (n) => R.State.getVar(n), setVar: (n, v) => R.State.setVar(n, v),
    has: (i, n = 1) => R.State.hasItem(i, n), take: (i, n = 1) => R.State.removeItem(i, n),
    async give(item, n = 1) { if (!DB.items[item]) { log.push(['give?', item]); return false; } R.State.addItem(item, n); log.push(['give', item]); return true; },
    async giveGold(n) { R.State.addGold(n); },
    tier: () => R.Game.tier || 0, cleared: (r) => (R.Game.regionsCleared || []).includes(r),
    npc, player: { face() {}, walk: async () => {}, setPos() {} },
    async battle(t) { ev.battles.push(t); log.push(['battle', t]); return ev.battleResult; },
    async wait() {}, async fadeOut() { log.push(['fadeOut']); }, async fadeIn() { log.push(['fadeIn']); }, async shake() {}, async flash() {}, sfx(id) { log.push(['sfx', id]); }, bgm() {},
    heal() { log.push(['heal']); R.State.healAll && R.State.healAll({ reserve: true }); },
    async warp(m, s) { log.push(['warp', m, s]); ev.map = m; },
    setObjective(id, o) { log.push(['objective', id, o && o.region]); if (o && o.region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[o.region] = id; } else R.Game.objective = id; },
    refresh() { log.push(['refresh']); },
    async call(id) { log.push(['call', id]); const e = DB.events[id]; if (e) return e.run(ev); return undefined; },
    async clearRegion(id) { log.push(['clearRegion', id]); if (R.Tier && R.Tier.clear) R.Tier.clear(id); else { R.Game.regionsCleared.push(id); R.Game.tier = R.Game.regionsCleared.length; R.State.setFlag('cleared_' + id); } R.State.addItem(DB.regions[id].fragment, 1); return R.Game.tier; },
    get hero() { return R.Game.party[0]; },
    g: (m) => m,
  };
  return ev;
}
(async () => {
  R.State.newGame();
  const g = R.Game;
  const run = async (id, map, opt) => {
    const log = [];
    const ev = mockEv(map, log);
    if (opt && opt.battle) ev.battleResult = opt.battle;
    const hidden = new Set(DB.events[id] ? [] : ['missing']);
    ok(!!DB.events[id], 'event ' + id + ' exists');
    if (!DB.events[id]) return { log, ret: undefined, ev };
    let ret;
    try { ret = await DB.events[id].run(ev); } catch (e) { ok(false, 'event ' + id + ' threw: ' + e.message); }
    void hidden;
    return { log, ret, ev };
  };
  // #1 intro
  let r = await run('yule_enter', 'yule');
  ok(g.flags.snow_start && (g.regionObj || {}).r_snow === 'obj_snow_1', 'intro: snow_start, region objective obj_snow_1');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === 'この吹雪は、もう三か月も続いている。'), 'intro: 「この吹雪は、もう三か月も続いている。」');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '冬至の火が消えたのだ。火の物語を、\n誰も思い出せん。'), 'intro: 「冬至の火が消えたのだ。…」');
  r = await run('yule_enter', 'yule');
  ok(!r.log.some((l) => l[0] === 'say'), 'intro runs once');
  // #2 Sonja before the fire (carved stones + Rowell's trace)
  r = await run('yule_sonja', 'yule');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '集会所のかまどの石に、\n昔の物語が彫ってあるの。でも古い字で、\nわたしには読めない。'), 'Sonja: the carved stones line (§10.8.4 #2)');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '秋に、記録院の記録官が\n火の物語を聞きに来たの。\n書き写して帰っていったわ。\nそれから、火が消えたの。'), 'Sonja: Rowell\'s trace (§10.8.4)');
  // ice wall before the fire
  r = await run('frost_peak_1_ice', 'frost_peak_1');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '分厚い氷の壁だ。\n火があれば、とかせそうだが……。'), 'ice wall line (§10.8.4 #4)');
  // #3 the hearth
  r = await run('yule_hearth', 'yule');
  ok(g.flags.snow_flame && R.State.hasItem('k_winter_flame'), 'hearth: snow_flame and 冬至の火種');
  ok((g.regionObj || {}).r_snow === 'obj_snow_2', 'hearth: region objective obj_snow_2');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '{hero}は、かまどの石の物語を\n読み解いて、声に出して語った。'), 'hearth: the storyteller reads the stones aloud');
  ok(r.log.some((l) => l[0] === 'sfx' && l[1] === 'fire'), 'hearth: sfx fire');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '火が……！　この火を、\n峰の頂の白竜さまへ。'), 'hearth: Sonja 「火が……！」');
  const nKeys = R.State.count ? R.State.count('k_winter_flame') : 1;
  r = await run('yule_hearth', 'yule');
  ok((R.State.count ? R.State.count('k_winter_flame') : 1) === nKeys, 'hearth: a second look gives nothing more');
  // #5 the giant: a lost / fled battle leaves no flag and returns false
  r = await run('frost_peak_2_boss', 'frost_peak_2', { battle: 'escape' });
  ok(r.ret === false && !g.flags.snow_mid, 'giant: not won → return false, no snow_mid');
  r = await run('frost_peak_2_boss', 'frost_peak_2', { battle: 'win' });
  ok(g.flags.snow_mid && r.ev.battles[0] === 'tr_b_icegiant', 'giant: tr_b_icegiant won → snow_mid');
  // #6 Fine (the story's script, or the table's fallback)
  r = await run('frost_peak_3_fine', 'frost_peak_3');
  ok(r.log.some((l) => (l[0] === 'call' && l[1] === 'story_fine_snow') || (l[0] === 'say' && l[1] === '凍っているのは、竜の体じゃない。\n心のほうよ。')), 'Fine: story_fine_snow or the §10.9.4 line');
  // #6–7 the dragon: lost → nothing; won → the whole clear flow
  r = await run('frost_peak_3_boss', 'frost_peak_3', { battle: 'lose' });
  ok(r.ret === false && !g.flags.snow_boss && !(g.regionsCleared || []).includes('r_snow'), 'dragon: lost → return false, nothing set');
  r = await run('frost_peak_3_boss', 'frost_peak_3', { battle: 'win' });
  ok(r.ev.battles[0] === 'tr_b_whitedragon', 'dragon: tr_b_whitedragon');
  ok(g.flags.snow_boss && (g.regionsCleared || []).includes('r_snow') && g.flags.cleared_r_snow, 'dragon: snow_boss, r_snow cleared');
  ok(R.State.hasItem('k_page_snow'), 'dragon: 氷のページ');
  const L = r.log.map((l) => l[0] + ':' + (l[1] || ''));
  const iSet = L.findIndex((s) => s.startsWith('say:{hero}は冬至の火を掲げ'));
  const iClr = L.indexOf('clearRegion:r_snow');
  const iWarp = L.findIndex((s) => s === 'warp:yule');
  const iHeal = L.indexOf('heal:');
  const iCap = L.indexOf('caption:その夜は、町の宿で眠った。');
  const iAfter = L.indexOf('call:story_after_clear');
  ok(iSet >= 0 && iSet < iClr, 'dragon: the story is told before clearRegion');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '……あたたかい。人の子らは、\nわたしを忘れてはいなかったのか。'), 'dragon: ネーヴェ 「……あたたかい。」');
  ok(r.log.some((l) => l[0] === 'say' && l[1] === '吹雪は、わたしが鎮めよう。語り部よ、\n礼を言う。'), 'dragon: ネーヴェ 「吹雪は、わたしが鎮めよう。」');
  ok(iClr >= 0 && iCap > iClr && iHeal > iClr && iWarp > iClr, 'after clearRegion: caption, heal, warp to the inn');
  ok(r.log.some((l) => l[0] === 'warp' && l[1] === 'yule' && l[2] === 'inn'), 'warp yule / inn');
  ok(!DB.events.story_after_clear || (iAfter > iWarp), 'story_after_clear is called after the warp (when story has landed)');
  // the reward after the clear (once)
  r = await run('yule_jorn', 'yule');
  ok(g.flags.yule_jorn_reward && R.State.hasItem('ac_tale_snow'), 'reward: 冬至の火の守り (ac_tale_snow), flag yule_jorn_reward');
  r = await run('yule_jorn', 'yule');
  ok(!r.log.some((l) => l[0] === 'give'), 'reward: given once');
  ok(DB.items.ac_tale_snow && DB.items.ac_tale_snow.src === 'reward', 'ac_tale_snow is a reward item (§8.8)');

  // ------------------------------------------------------------------ 7. meta tokens (progress.js reads them)
  section('meta');
  const E = DB.events;
  ok(E.yule_hearth.meta.gives.includes('item:k_winter_flame') && E.yule_hearth.meta.gives.includes('flag:snow_flame'), 'yule_hearth gives the fire');
  ok(E.frost_peak_2_boss.meta.gives.includes('flag:snow_mid'), 'the giant gives snow_mid');
  ok(E.frost_peak_3_boss.meta.gives.includes('region:r_snow') && E.frost_peak_3_boss.meta.warp.to === 'yule', 'the dragon gives region:r_snow and warps to yule');
  ok(E.yule_jorn_reward.meta.needs.includes('region:r_snow'), 'the reward needs the clear');
  // objectives
  ok(DB.objectives.obj_snow_1 && DB.objectives.obj_snow_1.text === '村の古いかまどで、\n冬至の火をともそう。', 'obj_snow_1 text (§10.8.4)');
  ok(DB.objectives.obj_snow_2 && DB.objectives.obj_snow_2.text === '冬至の火種を持って、\n白竜の峰の頂を目指そう。', 'obj_snow_2 text (§10.8.4)');
  ok(Object.keys(DB.objectives).filter((k) => k.startsWith('obj_snow_')).length === 2, 'exactly obj_snow_1..2');

  // ------------------------------------------------------------------ 8. text (STYLE_JA §1: 20 a line, 4 lines a page)
  section('text');
  const strings = [];
  for (const id of MAPS) {
    for (const o of P[id].npcs) allTexts(o.text, strings);
    for (const s of P[id].signs) allTexts(s.text, strings);
  }
  const fs = require('fs');
  for (const f of ['src/events/region3_yule.js', 'src/events/region3_frost_peak.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    for (const m of src.matchAll(/(?:say|caption)\(\s*'((?:[^'\\]|\\.)*)'/g)) strings.push(m[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f'));
  }
  let long = 0, tall = 0;
  for (const s of strings) {
    for (const page of s.split('\f')) {
      const lines = page.split('\n');
      if (lines.length > 4) { tall++; console.log('  (5+ lines) ' + JSON.stringify(page)); }
      for (const ln of lines) if (width(ln) > 20) { long++; console.log('  (>20) ' + JSON.stringify(ln) + ' ' + width(ln)); }
    }
  }
  ok(strings.length > 100, 'collected ' + strings.length + ' strings');
  ok(long === 0, 'no line over 20 full-width characters');
  ok(tall === 0, 'no page over 4 lines');
  ok(!strings.some((s) => /アルン/.test(s)), 'no hard-coded hero name');

  // ------------------------------------------------------------------ 9. decor sits where it belongs
  section('decor');
  for (const id of MAPS) {
    const Pm = P[id];
    let wallOnFloor = 0, floorOnWall = 0;
    for (let y = 0; y < Pm.h; y++) for (let x = 0; x < Pm.w; x++) {
      const d = Pm.decorDef(x, y);
      if (!d) continue;
      const t = DB.tiles[Pm.tileAt(x, y)] || {};
      if (d.wall && t.pass) { wallOnFloor++; console.log('  wall decor on floor ' + id + ' ' + x + ',' + y + ' ' + Pm.decorAt(x, y)); }
      if (!d.wall && !t.pass) { floorOnWall++; console.log('  floor decor on a wall ' + id + ' ' + x + ',' + y + ' ' + Pm.decorAt(x, y)); }
    }
    ok(!wallOnFloor, id + ': wall decor only on walls');
    ok(!floorOnWall, id + ': floor decor only on walkable cells');
  }

  // ------------------------------------------------------------------ 10. art keys used by the maps exist (or are registered here)
  section('art');
  const keys = new Set();
  for (const id of MAPS) for (const o of P[id].npcs) keys.add(o.sprite);
  for (const k of keys) ok(R.Gfx.has ? R.Gfx.has(k) : true, 'sprite ' + k + ' is registered');

  console.log('\ntest_reg3: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
