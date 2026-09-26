#!/usr/bin/env node
// test_reg5.js (owner reg-5 R5) — マレア諸島 r_isles: maps, objects and event scripts (DESIGN §10.8.0, §10.8.6,
// §10.6, §10.6.4, §8.12.4, §10.13.10). Node only (tools/lib/load), exit 1 on any failure.
//
//   node tools/test_reg5.js            all tests
//   node tools/test_reg5.js -v         also print the passing checks and the measured numbers
//
// Part A  static: every map (ids, sizes, outside, location, region, type, escape, lvOff, encounter, spawns,
//         stairs pairs, NPC ids and fixed/push, st_* scene spots, chests/pools, secret passages, rest lanterns,
//         closed tile + tilePatch, visible bosses, text shape of every NPC/sign line).
// Part B  reachability per map (the game's own parser via tools/lib/maps): every chest, NPC event, warp and
//         step event is reachable from the map's arrival spawns; the rock shelf is sealed off by the octopus
//         and the captain's cabin by the closed door; the only things behind a secret passage are chests.
// Part C  event scripts run against a scripted `ev` (real R.State / R.Tier, scripted battles and answers):
//         the whole chapter in order, lost / escaped battles, the replays after the clear, meta ⇔ behaviour.
'use strict';
const path = require('path');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps');

const VERBOSE = process.argv.includes('-v');
let fails = 0, passes = 0;
const notes = [];
function ok(cond, msg) { if (cond) { passes++; if (VERBOSE) console.log('  ok  ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + (JSON.stringify(a) === JSON.stringify(b) ? '' : ` (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`)); }
function note(s) { notes.push(s); }

const DB = R.DB;
const K = R.Isles;
const MAPS = ['coral', 'nerei', 'tide_cave_1', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3'];
const P = {};
for (const id of MAPS) P[id] = M.parseMap(R, id);

// ============================================================================ A. static
console.log('A. maps and objects');
ok(K && Array.isArray(K.MAPS) && JSON.stringify(K.MAPS) === JSON.stringify(MAPS), 'R.Isles.MAPS lists the 6 maps');
for (const id of MAPS) {
  const p = P[id], d = DB.maps[id];
  ok(!!p, `map ${id} registered`);
  if (!p) continue;
  const bad = p.issues.filter((s) => !/unknown event story_/.test(s));
  eq(bad, [], `${id}: compiles without warnings`);
  ok(d.outside != null, `${id}: outside written`);
  eq(d.region, 'r_isles', `${id}: region`);
  const rows = d.rows, w = rows[0].length;
  ok(rows.every((r) => r.length === w) && d.decor.length === rows.length && d.decor.every((r) => r.length === w), `${id}: rows / decor rectangular ${w}×${rows.length}`);
}
// towns (§10.6.1)
for (const [id, loc, bgm] of [['coral', 'coral', 'town'], ['nerei', 'nerei', 'village']]) {
  const p = P[id], d = DB.maps[id];
  eq([d.type, d.theme, d.bgm, d.location, d.outside], ['town', 'town_isle', bgm, loc, '~'], `${id}: type/theme/bgm/location/outside`);
  ok(p.w >= 40 && p.h >= 32, `${id}: ${p.w}×${p.h} ≥ 40×32`);
  eq(d.exit, { to: 'world', spawn: id }, `${id}: exit to world spawn ${id}`);
  ok(!!p.spawns.entrance && !!p.spawns.inn, `${id}: spawns entrance + inn`);
  const inn = p.spawns.inn;
  eq(inn.dir, 'down', `${id}: spawn inn faces down`);
  ok(/^door/.test(p.tileAt(inn.x, inn.y - 1)), `${id}: spawn inn is in front of a door`);
  ok(p.npcs.some((n) => n.id === 'inn' && n.event === 'common_inn' && n.fixed), `${id}: innkeeper`);
  ok(p.npcs.some((n) => n.id === 'folk_a' && n.event === 'story_rumor' && n.rumor === id + '_a' && n.push), `${id}: folk_a (rumor ${id}_a)`);
  const sign = (p.def.signs || []).find((s) => s.cond && s.cond.tier === 1);
  ok(!!sign && (d.tilePatches || []).some((t) => t.x === sign.x && t.y === sign.y && t.ch === 'm'), `${id}: 記録院の立て札 (tier 1 sign on a patched sign tile)`);
}
{
  const p = P.coral;
  ok(!!p.spawns.dock, 'coral: spawn dock');
  for (const [nid, shop] of [['shop_item', 'coral_item'], ['shop_weapon', 'coral_weapon'], ['shop_armor', 'coral_armor']]) ok(p.npcs.some((n) => n.id === nid && n.shop === shop && n.event === 'common_shop' && n.fixed && DB.shops[shop]), `coral: ${nid} → ${shop}`);
  ok(p.npcs.some((n) => n.id === 'tavern' && n.event === 'common_tavern' && n.fixed), 'coral: tavern master');
  ok(p.npcs.some((n) => n.id === 'ferry' && n.ferryFrom === 'coral' && n.event === 'common_ferry' && n.fixed), 'coral: ferry (ferryFrom coral)');
  ok(p.npcs.some((n) => n.id === 'folk_b' && n.rumor === 'coral_b' && n.push), 'coral: folk_b');
  const sc = p.npcs.find((n) => n.id === 'scribe');
  ok(!!sc && sc.push && JSON.stringify(sc.cond) === JSON.stringify([{ tier: 4 }, { tierBelow: 7 }]) && sc.sprite === 'npc:scribe', 'coral: 白衣の書記 (tier 4–6, push)');
  const rm = p.npcs.find((n) => n.id === 'regnas_merchant');
  ok(!!rm && rm.fixed && rm.shop === 'coral_regnas' && rm.sprite === 'npc:merchant' && JSON.stringify(rm.cond) === JSON.stringify({ cleared: 'r_isles' }), 'coral: レグナスの商人 (after the clear, shop coral_regnas)');
  ok(p.npcs.some((n) => n.id === 'drake' && n.sprite === 'npc:sailor' && n.fixed && n.event === 'coral_drake'), 'coral: 港の親方ドレイク');
  eq(DB.maps.coral.onEnter, 'coral_intro', 'coral: onEnter coral_intro');
  // §10.8.0-7 scene spots
  const inn = p.spawns.inn;
  const spots = { st_rival: [0, 2, 'npc:rowell', 'st_show_rival'], st_fine: [2, 2, 'npc:fine', 'st_show_fine'], st_extra: [-2, 2, 'npc:scribe', 'st_show_extra'] };
  for (const [nid, [dx, dy, spr, fl]] of Object.entries(spots)) {
    const n = p.npcs.find((q) => q.id === nid);
    ok(!!n && n.x === inn.x + dx && n.y === inn.y + dy && n.dir === 'up' && n.sprite === spr && n.cond === fl && n.fixed, `coral: ${nid} at inn+(${dx},${dy}) facing up, cond ${fl}`);
  }
  // those cells and the way from inn are plain walkable floor, free of other things
  const cells = [[0, 1], [0, 2], [1, 2], [2, 2], [-1, 2], [-2, 2], [1, 1], [-1, 1]].map(([dx, dy]) => [inn.x + dx, inn.y + dy]);
  const blocked = cells.filter(([x, y]) => {
    const t = DB.tiles[p.tileAt(x, y)], dd = p.decorDef(x, y);
    const other = p.npcs.some((n) => n.x === x && n.y === y && !/^st_/.test(n.id)) || p.chests.some((c) => c.x === x && c.y === y) || (p.def.signs || []).some((s) => s.x === x && s.y === y) || (p.def.tilePatches || []).some((s) => s.x === x && s.y === y);
    return !t || !t.pass || (dd && !dd.pass) || other;
  });
  eq(blocked, [], 'coral: the scene spots and the way to them are clear floor');
}
{
  const p = P.nerei;
  ok(!!p.spawns.pier, 'nerei: spawn pier');
  ok(p.npcs.some((n) => n.id === 'shop_item' && n.shop === 'nerei_item' && n.fixed), 'nerei: general store (nerei_item)');
  ok(!p.npcs.some((n) => ['folk_b', 'tavern', 'scribe', 'shop_weapon', 'shop_armor'].includes(n.id)), 'nerei: no tavern / folk_b / scribe / weapon or armour shop (§10.6.1, §10.9.3, §10.9.5)');
  const mar = p.npcs.filter((n) => /^marina/.test(n.id));
  ok(mar.length >= 4 && mar.every((n) => n.sprite === 'npc:old_woman' && n.fixed), 'nerei: Marina (npc:old_woman, fixed) by state');
  ok(p.npcs.some((n) => n.id === 'glen_pier' && n.sprite === 'npc:ghost'), 'nerei: Glen for the scenes (npc:ghost)');
  const pier = p.events.filter((e) => e.id === 'nerei_pier');
  ok(pier.length >= 1 && pier.every((e) => e.trigger === 'step' && e.cond === 'isles_ship'), 'nerei: nerei_pier step event, cond isles_ship');
}
// dungeons (§10.6.2)
const DUN = {
  tide_cave_1: { theme: 'water', bgm: 'cave', bbg: 'watercave', zone: 'z_r_isles_cave', loc: 'tide_cave', esc: { to: 'world', spawn: 'tide_cave_1' }, lvOff: undefined, out: '~' },
  ghost_ship_1: { theme: 'ship', bgm: 'ghost', bbg: 'ship', zone: 'z_r_isles_ship', loc: 'nerei', esc: { to: 'nerei', spawn: 'pier' }, lvOff: undefined, out: '~' },
  ghost_ship_2: { theme: 'ship', bgm: 'ghost', bbg: 'ship', zone: 'z_r_isles_ship', loc: 'nerei', esc: { to: 'nerei', spawn: 'pier' }, lvOff: 2, out: '#' },
  ghost_ship_3: { theme: 'ship', bgm: 'ghost', bbg: 'ship', zone: 'z_r_isles_ship', loc: 'nerei', esc: { to: 'nerei', spawn: 'pier' }, lvOff: undefined, out: '#' },
};
for (const [id, s] of Object.entries(DUN)) {
  const p = P[id], d = DB.maps[id];
  eq([d.type, d.theme, d.bgm, d.bbg, d.encounter, d.location, d.lvOff, d.outside], ['dungeon', s.theme, s.bgm, s.bbg, s.zone, s.loc, s.lvOff, s.out], `${id}: type/theme/bgm/bbg/zone/location/lvOff/outside`);
  eq(d.escape, s.esc, `${id}: escape`);
  ok(!!DB.encounters[s.zone], `${id}: zone ${s.zone} exists`);
  ok(DB.themes[s.theme] && DB.themes[s.theme].bbg === s.bbg, `${id}: theme ${s.theme} → bbg ${s.bbg}`);
  const small = p.w < 34 || p.h < 30;
  ok(!small || s.out === '#', `${id}: ${p.w}×${p.h} (≥ 34×30, or a wall outside)`);
  ok(!d.chestTier, `${id}: no chestTier (the current tier)`);
  // chests: 3–5, pool only, ids <map>_c<n>
  ok(p.chests.length >= 3 && p.chests.length <= 5, `${id}: ${p.chests.length} chests (3–5, §8.12.4)`);
  ok(p.chests.every((c, i) => c.pool && !c.item && DB.pools[c.pool] && new RegExp('^' + id + '_c\\d+$').test(c.id)), `${id}: chests use pools and <map>_c<n> ids`);
  note(`${id}: ${p.w}×${p.h}, chests ${p.chests.map((c) => c.pool).join(' ')}`);
}
eq(Object.keys(P.tide_cave_1.spawns).sort(), ['entrance'], 'tide_cave_1: spawn entrance');
ok(P.tide_cave_1.warps.some((w) => w.to === 'world' && w.spawn === 'tide_cave_1'), 'tide_cave_1: warp to world tide_cave_1');
ok(!!P.ghost_ship_1.spawns.entrance && P.ghost_ship_1.warps.some((w) => w.to === 'nerei' && w.spawn === 'pier'), 'ghost_ship_1: entrance + the plank down to nerei pier');
// stairs pairs (§10.6.2-2)
const pairs = [['ghost_ship_1', 'ghost_ship_2', 'from_prev', 'from_next'], ['ghost_ship_2', 'ghost_ship_3', 'from_prev', 'from_next'], ['ghost_ship_1', 'ghost_ship_2', 'fore', 'fore']];
for (const [a, b, down, up] of pairs) {
  const wa = P[a].warps.find((w) => w.to === b && w.spawn === down), wb = P[b].warps.find((w) => w.to === a && w.spawn === up);
  ok(!!wa && !!wb && !!P[b].spawns[down] && !!P[a].spawns[up], `stairs ${a} ⇄ ${b} (${down} / ${up})`);
  if (wa) ok(/stairs/.test(P[a].tileAt(wa.x, wa.y)), `${a}: the warp to ${b} sits on stairs`);
  if (wa && P[a].spawns[up]) { const s = P[a].spawns[up]; ok(Math.abs(s.x - wa.x) + Math.abs(s.y - wa.y) === 1, `${a}: spawn ${up} is beside its stairs`); }
}
// p_rare: one per dungeon (§8.12.4); ghost ship: on the floor before the boss floor
const rare = (ids) => ids.reduce((n, id) => n + P[id].chests.filter((c) => c.pool === 'p_rare').length, 0);
eq(rare(['tide_cave_1']), 1, 'tide cave: one p_rare chest');
eq(rare(['ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3']), 1, 'ghost ship: one p_rare chest');
ok(P.ghost_ship_2.chests.some((c) => c.pool === 'p_rare'), 'ghost ship: p_rare on 2F (before the boss floor)');
// supply share (about half of the dungeon chests)
{
  const all = ['tide_cave_1', 'ghost_ship_1', 'ghost_ship_2', 'ghost_ship_3'].flatMap((id) => P[id].chests);
  const sup = all.filter((c) => c.pool === 'p_supply').length;
  ok(sup / all.length >= 0.3 && sup / all.length <= 0.6, `dungeon chests: p_supply ${sup}/${all.length}`);
  note(`dungeon chests ${all.length}: ` + Object.entries(all.reduce((o, c) => ((o[c.pool] = (o[c.pool] || 0) + 1), o), {})).map(([k, v]) => k + ' ' + v).join(', '));
  const towns = ['coral', 'nerei'].flatMap((id) => P[id].chests);
  ok(towns.length <= 4 && towns.every((c) => ['p_supply', 'p_gold'].includes(c.pool)), `town chests: ${towns.length} (p_supply / p_gold only)`);
}
// secret passages (§10.6.4): tide_cave_1 and ghost_ship_2 only
const secretCells = (id) => { let n = 0; const p = P[id]; for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (M.isSecret(R, p.tileAt(x, y))) n++; return n; };
for (const id of MAPS) {
  const n = secretCells(id);
  if (id === 'tide_cave_1' || id === 'ghost_ship_2') ok(n >= 1 && n <= 3, `${id}: secret passage of ${n} cell(s) (1–3)`);
  else eq(n, 0, `${id}: no secret passage`);
}
// rest lanterns (§10.6.2-5): before the octopus, mid ship (2F), before the captain (3F)
for (const id of ['tide_cave_1', 'ghost_ship_2', 'ghost_ship_3']) ok(P[id].npcs.some((n) => n.id === 'rest' && n.sprite === 'obj:lantern' && n.event === 'common_rest' && n.fixed), `${id}: 休息の灯`);
// visible bosses (§10.6.2-6)
{
  const oc = P.tide_cave_1.npcs.find((n) => n.id === 'boss');
  ok(!!oc && oc.sprite === 'mon:b_octopus' && oc.cond === '!isles_mid' && oc.fixed && oc.event === 'tide_cave_1_boss', 'tide_cave_1: visible 深みの大ダコ');
  const ca = P.ghost_ship_3.npcs.find((n) => n.id === 'boss');
  ok(!!ca && ca.sprite === 'mon:b_captain' && ca.cond === '!isles_boss' && ca.fixed && ca.event === 'ghost_ship_3_boss', 'ghost_ship_3: visible 亡霊船長グレン');
  const fi = P.ghost_ship_3.npcs.find((n) => n.id === 'fine');
  ok(!!fi && fi.sprite === 'npc:fine' && fi.cond === '!isles_boss' && fi.fixed, 'ghost_ship_3: fine (npc:fine, cond !isles_boss)');
  const band = P.ghost_ship_3.events.filter((e) => e.id === 'ghost_ship_3_fine');
  ok(band.length && band.every((e) => e.once === 'isles_fine' && e.trigger === 'step'), 'ghost_ship_3: fine step band (once isles_fine)');
  ok(DB.troops.tr_b_octopus && DB.troops.tr_b_captain, 'troops tr_b_octopus / tr_b_captain exist');
  const sh = P.tide_cave_1.npcs.find((n) => n.id === 'shell');
  ok(!!sh && sh.sprite === 'obj:sparkle' && sh.event === 'tide_cave_1_shell', 'tide_cave_1: the glowing shell (obj:sparkle)');
}
// closed tile + tilePatch on the captain's cabin door (§10.8.0-6)
{
  const d = DB.maps.ghost_ship_3;
  const pat = (d.tilePatches || []).filter((t) => t.cond === 'isles_fine');
  ok(pat.length === 2 && pat.every((t) => P.ghost_ship_3.tileAt(t.x, t.y) === 'lockdoor' && t.ch === 'D'), 'ghost_ship_3: lockdoor opened by tilePatch (isles_fine)');
  ok(pat.every((t) => P.ghost_ship_3.events.some((e) => e.id === 'ghost_ship_3_door' && e.x === t.x && e.y === t.y && e.trigger === 'examine')), 'ghost_ship_3: the closed door has an examine event');
}
// NPC fixed/push (§10.13.10), sprites that exist, ids unique
const FIXED = ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'ferry', 'rest', 'boss', 'fine', 'st_rival', 'st_fine', 'st_extra', 'regnas_merchant'];
for (const id of MAPS) {
  const p = P[id];
  const noFlag = p.npcs.filter((n) => !n.fixed && !n.push).map((n) => n.id);
  eq(noFlag, [], `${id}: every NPC has fixed or push`);
  ok(p.npcs.filter((n) => FIXED.includes(n.id)).every((n) => n.fixed), `${id}: service / story NPCs are fixed`);
  const ids = p.npcs.map((n) => n.id);
  eq(ids.filter((x, i) => ids.indexOf(x) !== i), [], `${id}: NPC ids unique`);
  const sprites = [...new Set(p.npcs.map((n) => n.sprite))];
  const known = (s) => /^(npc|obj|mon|party|decor):/.test(s) && (R.Gfx._defs ? s in R.Gfx._defs : true);
  eq(sprites.filter((s) => !known(s)), [], `${id}: NPC sprites registered`);
}
// every NPC line has before/after-clear variants in the towns (§10.8.0-9)
for (const id of ['coral', 'nerei']) {
  const people = P[id].npcs.filter((n) => Array.isArray(n.text) && n.text.length && typeof n.text[0] === 'object');
  const two = people.filter((n) => n.text.some((e) => e.cond && JSON.stringify(e.cond).includes('r_isles')) && n.text.some((e) => !e.cond));
  note(`${id}: ${P[id].npcs.length} NPCs, ${people.length} with tier lines, ${two.length} with before/after-clear`);
  ok(two.length >= 8, `${id}: ≥ 8 townspeople with before/after-clear lines (${two.length})`);
  const t4 = people.filter((n) => n.text.some((e) => e.cond && (JSON.stringify(e.cond) === '{"tier":4}' || e.cond === 'final_open')));
  ok(t4.length >= 1, `${id}: a {tier:4} or final_open line (${t4.length})`);
}
// text shape: ≤ 20 full-width per line ({hero} = 5), ≤ 4 lines per page, "……" pairs
function textsOf(v) { if (!v) return []; if (typeof v === 'string') return [v]; if (Array.isArray(v)) return v.flatMap((e) => (typeof e === 'string' ? [e] : e && e.text ? textsOf(e.text) : [])); return []; }
const width = (line) => { const s = line.replace(/\{hero\}/g, '＿＿＿＿＿'); let w = 0; for (const ch of s) w += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; };
function checkPages(str, where) {
  const pages = str.split('\f');
  for (const pg of pages) {
    const lines = pg.split('\n');
    if (lines.length > 4) return `${where}: a page of ${lines.length} lines`;
    for (const l of lines) if (width(l) > 20) return `${where}: line wider than 20: ${l}`;
  }
  if (/[^…]…[^…]|^…[^…]|[^…]…$/.test(str)) return `${where}: a single …`;
  return null;
}
const textIssues = [];
for (const id of MAPS) {
  for (const n of P[id].npcs) for (const t of textsOf(n.text).concat(n.greet ? [n.greet] : [])) { const e = checkPages(t, `${id}/${n.id}`); if (e) textIssues.push(e); }
  for (const s of DB.maps[id].signs || []) for (const t of textsOf(s.text)) { const e = checkPages(t, `${id}/sign@${s.x},${s.y}`); if (e) textIssues.push(e); }
}
eq(textIssues, [], 'every NPC / sign text fits the window (20 per line, 4 lines per page)');
// objectives
for (const [k, t] of Object.entries({ obj_isles_1: '島の東の岬の村ネレイで、\n幽霊船の話を聞こう。', obj_isles_2: '潮鳴りの洞窟の奥の岩棚で、\n光る貝がらを探そう。', obj_isles_3: 'ネレイのマリナに、\n貝がらを届けよう。', obj_isles_4: '幽霊船の船長室を\n目指そう。' })) eq(DB.objectives[k] && DB.objectives[k].text, t, `objective ${k}`);
// events registered with meta
const EVS = ['coral_intro', 'coral_drake', 'nerei_marina', 'nerei_marina_song', 'nerei_pier', 'nerei_marina_reward', 'tide_cave_1_boss', 'tide_cave_1_shell',
  'ghost_ship_1_arrival', 'ghost_ship_3_fine', 'ghost_ship_3_door', 'ghost_ship_3_boss'];
for (const e of EVS) ok(DB.events[e] && typeof DB.events[e].run === 'function' && DB.events[e].meta && Array.isArray(DB.events[e].meta.needs) && Array.isArray(DB.events[e].meta.gives), `event ${e} (run + meta)`);
// every event used on my maps exists (except the story's)
for (const id of MAPS) {
  const used = new Set([...P[id].npcs.map((n) => n.event), ...P[id].events.map((e) => e.id), DB.maps[id].onEnter].filter(Boolean));
  eq([...used].filter((e) => !DB.events[e] && !/^story_/.test(e)), [], `${id}: every event it uses is registered`);
}
ok(DB.items.k_shanty && DB.items.k_shanty.type === 'key', 'k_shanty is a key item');
ok(DB.items.ac_tale_isles && DB.items.ac_tale_isles.src === 'reward', 'ac_tale_isles is the reward');
ok(DB.shops.coral_regnas && DB.shops.nerei_item && DB.shops.coral_item, 'shops exist');

// ============================================================================ B. reachability
console.log('B. reachability');
function reach(id, starts, opts) {
  const p = P[id], o = opts || {};
  const flags = o.flags || {};
  const check = (c) => {
    if (c == null) return true;
    if (typeof c === 'string') return c[0] === '!' ? !flags[c.slice(1)] : !!flags[c];
    if (Array.isArray(c)) return c.every(check);
    if (c.cleared) return !!flags['cleared:' + c.cleared];
    if (c.notCleared) return !flags['cleared:' + c.notCleared];
    if (c.item) return !!flags['item:' + c.item];
    if (c.notItem) return !flags['item:' + c.notItem];
    if (c.tier != null) return (flags.tier || 0) >= c.tier;
    if (c.tierBelow != null) return (flags.tier || 0) < c.tierBelow;
    return true;
  };
  const blockers = new Set();
  for (const n of p.npcs) if (check(n.cond) && !R.FieldMap.pushable(n)) blockers.add(n.x + ',' + n.y);
  const walk = (x, y) => {
    if (!p.inMap(x, y)) return false;
    const tid = p.patchedAt(x, y, check), t = DB.tiles[tid];
    if (!t) return false;
    if (M.isSecret(R, tid)) return !o.noSecret;
    const dd = p.decorDef(x, y);
    if (dd && !dd.pass && !dd.over) return false;
    if (blockers.has(x + ',' + y)) return false;
    return !!t.pass;
  };
  const seen = new Set(), q = [];
  for (const s of starts) { const sp = typeof s === 'string' ? p.spawns[s] : s; if (sp) { q.push([sp.x, sp.y]); seen.add(sp.x + ',' + sp.y); } }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (y + dy);
      if (!seen.has(k) && walk(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  const near = (x, y) => seen.has(x + ',' + y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    if (seen.has((x + dx) + ',' + (y + dy))) return true;
    const t = DB.tiles[p.tileAt(x + dx, y + dy)] || {}, dd = p.decorDef(x + dx, y + dy);
    return (t.counter || (dd && dd.counter)) && seen.has((x + 2 * dx) + ',' + (y + 2 * dy));
  });
  return { seen, near };
}
const ALL = { isles_start: 1, isles_marina: 1, isles_mid: 1, isles_ship: 1, isles_fine: 1, 'item:k_shanty': 1 };
const starts = { coral: ['entrance', 'dock', 'inn'], nerei: ['entrance', 'inn', 'pier'], tide_cave_1: ['entrance'], ghost_ship_1: ['entrance', 'from_next', 'fore'], ghost_ship_2: ['from_prev', 'fore', 'from_next'], ghost_ship_3: ['from_prev'] };
for (const id of MAPS) {
  const p = P[id];
  const r = reach(id, starts[id], { flags: ALL });
  const lost = [];
  for (const c of p.chests) if (!r.near(c.x, c.y)) lost.push('chest ' + c.id);
  for (const n of p.npcs) if (n.event && !/^(boss|glen|marina_pier|glen_pier|st_)/.test(n.id) && (n.cond == null || reach(id, starts[id], { flags: Object.assign({}, ALL) }).near(n.x, n.y)) && !r.near(n.x, n.y)) lost.push('npc ' + n.id);
  for (const w of p.warps) if (!r.near(w.x, w.y)) lost.push('warp→' + w.to);
  for (const e of p.events) if (e.trigger === 'step' && !r.seen.has(e.x + ',' + e.y) && !(e.id === 'ghost_ship_3_boss' || e.id === 'tide_cave_1_boss')) lost.push('step ' + e.id);
  eq(lost, [], `${id}: every chest / NPC event / warp / step event reachable (all flags)`);
  note(`${id}: ${r.seen.size} walkable cells reached`);
  // behind a secret passage: chests only
  if (secretCells(id)) {
    const r2 = reach(id, starts[id], { flags: ALL, noSecret: true });
    const behind = [];
    for (const c of p.chests) if (!r2.near(c.x, c.y)) behind.push('chest:' + c.pool);
    for (const n of p.npcs) if (!r2.near(n.x, n.y) && r.near(n.x, n.y)) behind.push('npc:' + n.id);
    for (const w of p.warps) if (!r2.near(w.x, w.y)) behind.push('warp');
    for (const e of p.events) if (!r2.seen.has(e.x + ',' + e.y) && r.seen.has(e.x + ',' + e.y)) behind.push('event:' + e.id);
    const want = id === 'tide_cave_1' ? ['chest:p_supply'] : ['chest:p_rare'];
    eq(behind, want, `${id}: behind the secret passage only ${want.join(' ')} (§10.6.4)`);
  }
}
// gating: the shelf needs the octopus beaten; the cabin needs the girl in grey
{
  const before = reach('tide_cave_1', ['entrance'], { flags: {} });
  const sh = P.tide_cave_1.npcs.find((n) => n.id === 'shell');
  ok(!before.near(sh.x, sh.y), 'tide_cave_1: the rock shelf is sealed off while the octopus is there');
  const oc = P.tide_cave_1.npcs.find((n) => n.id === 'boss');
  ok(before.near(oc.x, oc.y), 'tide_cave_1: the octopus can be reached');
  const band = P.tide_cave_1.events.filter((e) => e.id === 'tide_cave_1_boss');
  ok(band.some((e) => before.seen.has(e.x + ',' + e.y)), 'tide_cave_1: the boss step band is on the way');
  const after = reach('tide_cave_1', ['entrance'], { flags: { isles_mid: 1 } });
  ok(after.near(sh.x, sh.y), 'tide_cave_1: beaten, the shelf opens');
  const c3 = reach('ghost_ship_3', ['from_prev'], { flags: { isles_ship: 1 } });
  const cap = P.ghost_ship_3.npcs.find((n) => n.id === 'boss');
  ok(!c3.near(cap.x, cap.y), 'ghost_ship_3: the cabin is shut before the girl in grey speaks');
  const fineBand = P.ghost_ship_3.events.filter((e) => e.id === 'ghost_ship_3_fine');
  ok(fineBand.every((e) => c3.seen.has(e.x + ',' + e.y)), 'ghost_ship_3: the fine band is reached first');
  const c3b = reach('ghost_ship_3', ['from_prev'], { flags: { isles_ship: 1, isles_fine: 1 } });
  ok(c3b.near(cap.x, cap.y), 'ghost_ship_3: after isles_fine the cabin opens');
  // the rest lantern stands before the boss (reachable without passing the boss band)
  const rest = P.ghost_ship_3.npcs.find((n) => n.id === 'rest');
  ok(c3.near(rest.x, rest.y), 'ghost_ship_3: 休息の灯 before the captain');
  // measured walking: shortest path entrance → shelf in the cave, deck → captain
  const dist = (id, from, to, flags) => {
    const p = P[id], f = flags;
    const r = reach(id, [from], { flags: f });
    const sp = p.spawns[from];
    const D = new Map([[sp.x + ',' + sp.y, 0]]), q = [[sp.x, sp.y]];
    while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (r.seen.has(k) && !D.has(k)) { D.set(k, D.get(x + ',' + y) + 1); q.push([x + dx, y + dy]); } } }
    let best = Infinity; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (to.x + dx) + ',' + (to.y + dy); if (D.has(k)) best = Math.min(best, D.get(k)); }
    return best;
  };
  const d1 = dist('tide_cave_1', 'entrance', sh, { isles_mid: 1 });
  const d2 = dist('ghost_ship_3', 'from_prev', cap, { isles_fine: 1 });
  note(`shortest walks: cave entrance → shelf ${d1} tiles, hold stairs → captain ${d2} tiles; cells reached cave ${after.seen.size}`);
  ok(d1 >= 60 && d1 < 200, `tide_cave_1: entrance → shelf is a real walk (${d1} tiles)`);
}

// ============================================================================ C. event scripts
console.log('C. event scripts');
function newGame() {
  R.State.newGame();
  const g = R.Game;
  g.flags = g.flags || {};
  return g;
}
/** a scripted ev: real state, recorded screen work, scripted battles / answers */
function makeEv(script) {
  const s = Object.assign({ battles: [], answers: [] }, script || {});
  const log = { say: [], warps: [], captions: [], battles: [], objectives: [], calls: [], heals: 0, cleared: [], given: [] };
  const npcState = {};
  const ev = {
    log,
    map: s.map || 'nerei',
    ctx: { npc: {} },
    async say(t) { log.say.push(...(Array.isArray(t) ? t : [t])); },
    async ask(t, ch) { log.say.push(t); return s.answers.length ? s.answers.shift() : 0; },
    async yesno(t) { log.say.push(t); return s.answers.length ? !!s.answers.shift() : true; },
    async caption(t) { log.captions.push(t); },
    closeMessage() {}, async wait() {}, async fadeOut() {}, async fadeIn() {}, async shake() {}, async flash() {}, sfx() {}, bgm() {}, async jingle() {},
    flag: (n) => R.State.flag(n), setFlag: (n, v = true) => R.State.setFlag(n, v), check: (c) => R.State.check(c),
    var: (n) => R.State.getVar(n), setVar: (n, v) => R.State.setVar(n, v),
    has: (i, n = 1) => R.State.hasItem(i, n), take: (i, n = 1) => R.State.removeItem(i, n),
    async give(i, n = 1) { if (R.State.count(i) + n > 99) return false; R.State.addItem(i, n); log.given.push(i); return true; },
    async giveGold(n) { R.State.addGold(n); },
    tier: () => R.Game.tier || 0,
    cleared: (id) => (R.Game.regionsCleared || []).includes(id),
    async battle(t) { log.battles.push(typeof t === 'string' ? t : t.troop); return s.battles.length ? s.battles.shift() : 'win'; },
    async warp(map, spawn) { log.warps.push(map + ':' + (typeof spawn === 'string' ? spawn : JSON.stringify(spawn))); ev.map = map; },
    npc(id) {
      const st = npcState[id] = npcState[id] || { visible: true };
      return { get visible() { return st.visible; }, face() {}, async walk() {}, hide() { st.visible = false; }, show() { st.visible = true; }, setPos() {} };
    },
    heal() { log.heals++; },
    setObjective(id, o) { log.objectives.push(id + (o && o.region ? '@' + o.region : '')); if (o && o.region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[o.region] = id; } else R.Game.objective = id; },
    refresh() {},
    async clearRegion(id) { log.cleared.push(id); if (R.Tier && R.Tier.clear) R.Tier.clear(id); else { R.Game.regionsCleared.push(id); R.Game.tier = R.Game.regionsCleared.length; } if (DB.regions[id] && DB.regions[id].fragment) R.State.addItem(DB.regions[id].fragment, 1); return R.Game.tier; },
    async call(id) { log.calls.push(id); const e = DB.events[id]; if (e) return e.run(ev); return undefined; },
    setRespawn() {},
  };
  return ev;
}
async function run(id, script) { const ev = makeEv(script); const r = await DB.events[id].run(ev); return { r, ev, log: ev.log }; }
const has = (log, s) => log.say.some((t) => t.includes(s)) || log.captions.some((t) => t.includes(s));
// without R.Field the scripts must not touch the field directly: stub the bits they read
R.Field = R.Field || {};
const realFieldNpc = R.Field.npc;
R.Field.npc = () => ({});

(async () => {
  // --- 1 coral_intro
  newGame();
  let t = await run('coral_intro', { map: 'coral' });
  ok(R.State.flag('isles_start') && t.log.objectives.includes('obj_isles_1@r_isles'), 'coral_intro: isles_start, obj_isles_1 (region objective)');
  ok(has(t.log, '霧の夜になると、幽霊船が出るんだ。') && has(t.log, 'みんな岩礁で座礁しちまった。') && has(t.log, '岬の村ネレイのマリナばあさんなら、\n何か知ってるかもしれねえ。'), 'coral_intro: Drake says the three spec lines');
  t = await run('coral_intro', { map: 'coral' });
  eq(t.log.say.length, 0, 'coral_intro: once (isles_start)');
  t = await run('coral_drake', { map: 'coral' });
  ok(has(t.log, '記録院のやつに、舟歌を\n歌ってやったんだ。\nそのあとからよ、誰も\n歌えなくなっちまったのは。'), 'coral_drake: ロウェルの痕跡 before the clear');
  // --- 2 nerei_marina (first)
  t = await run('nerei_marina');
  ok(R.State.flag('isles_marina') && t.log.objectives.includes('obj_isles_2@r_isles'), 'nerei_marina: isles_marina, obj_isles_2');
  ok(has(t.log, 'あれは、グレンの船だよ。六十年前、\n嵐の海へ出て、帰らなかった人……。') && has(t.log, '潮鳴りの洞窟に隠したの。'), 'nerei_marina: the spec lines');
  // Marina first, Drake never met: still works (any order inside the region)
  newGame();
  t = await run('nerei_marina');
  ok(R.State.flag('isles_marina') && R.State.flag('isles_start'), 'nerei_marina: works without meeting Drake first');
  // --- 3 the octopus: lose / escape / win
  t = await run('tide_cave_1_boss', { battles: ['lose'] });
  ok(t.r === false && !R.State.flag('isles_mid'), 'tide_cave_1_boss: a lost battle returns false, no flag');
  t = await run('tide_cave_1_boss', { battles: ['escape'] });
  ok(t.r === false && !R.State.flag('isles_mid'), 'tide_cave_1_boss: an escaped battle returns false, no flag');
  t = await run('tide_cave_1_boss', { battles: ['win'] });
  ok(t.r !== false && R.State.flag('isles_mid') && t.log.battles[0] === 'tr_b_octopus', 'tide_cave_1_boss: win → isles_mid (tr_b_octopus)');
  t = await run('tide_cave_1_boss');
  eq(t.log.battles.length, 0, 'tide_cave_1_boss: no second fight');
  // --- 4 the shell
  t = await run('tide_cave_1_shell');
  ok(R.State.hasItem('k_shanty') && R.State.flag('isles_shell') && t.log.objectives.includes('obj_isles_3@r_isles'), 'tide_cave_1_shell: k_shanty, obj_isles_3');
  t = await run('tide_cave_1_shell');
  eq(R.State.count('k_shanty'), 1, 'tide_cave_1_shell: only once');
  // --- 5 Marina sings
  t = await run('nerei_marina');
  ok(t.log.calls.includes('nerei_marina_song'), 'nerei_marina: with the shell → nerei_marina_song');
  ok(R.State.flag('isles_ship') && t.log.objectives.includes('obj_isles_4@r_isles'), 'nerei_marina_song: isles_ship, obj_isles_4');
  eq(t.log.warps, ['nerei:pier', 'ghost_ship_1:entrance'], 'nerei_marina_song: the night at the pier, then aboard (ghost_ship_1 entrance)');
  ok(has(t.log, '♪　霧の海でも、迷いはしない\n岬の灯が、おれを呼ぶから') && has(t.log, '幽霊船が、桟橋に横づけされた……！') && has(t.log, 'その夜――'), 'nerei_marina_song: the song caption and the spec lines');
  ok(has(t.log, '……ああ、この歌だよ。') && has(t.log, '今夜、桟橋で歌ってみる。\nあの人に届くかもしれない。'), 'nerei_marina_song: Marina\'s spec lines');
  t = await run('nerei_marina');
  eq(t.log.warps, [], 'nerei_marina: after the song, no second night');
  // --- 6 the pier
  t = await run('nerei_pier', { answers: [false] });
  ok(t.r === false && !t.log.warps.length && has(t.log, '幽霊船に乗り込みますか？'), 'nerei_pier: "no" stays');
  t = await run('nerei_pier', { answers: [true] });
  eq(t.log.warps, ['ghost_ship_1:entrance'], 'nerei_pier: "yes" boards the ship');
  // --- 7 the girl in grey (story script absent → the §10.9.4 fallback)
  const hadStory = !!DB.events.story_fine_isles;
  t = await run('ghost_ship_3_fine');
  ok(R.State.flag('isles_fine'), 'ghost_ship_3_fine: isles_fine');
  if (!hadStory) ok(has(t.log, '待っている人がいる限り、\n物語は終わらない。'), 'ghost_ship_3_fine: fallback line (§10.9.4)');
  else ok(t.log.calls.includes('story_fine_isles'), 'ghost_ship_3_fine: calls story_fine_isles');
  // --- 7/8 the captain: lose, then win
  t = await run('ghost_ship_3_boss', { battles: ['lose'] });
  ok(t.r === false && !R.State.flag('isles_boss') && !(R.Game.regionsCleared || []).includes('r_isles'), 'ghost_ship_3_boss: lost → false, nothing set');
  const tier0 = R.Game.tier || 0;
  t = await run('ghost_ship_3_boss', { battles: ['win'] });
  ok(R.State.flag('isles_boss') && (R.Game.regionsCleared || []).includes('r_isles') && (R.Game.tier || 0) === tier0 + 1, 'ghost_ship_3_boss: win → isles_boss, r_isles cleared, tier +1');
  eq(t.log.battles, ['tr_b_captain'], 'ghost_ship_3_boss: tr_b_captain');
  eq(t.log.warps, ['nerei:pier', 'coral:inn'], 'ghost_ship_3_boss: dawn at the pier, then the inn in Coral (§10.8.0-3)');
  ok(t.log.heals >= 1 && has(t.log, 'その夜は、町の宿で眠った。'), 'ghost_ship_3_boss: a night at the inn (heal + caption)');
  ok(has(t.log, '{hero}は、マリナの舟歌を\n船長に語り聞かせた。') && has(t.log, '……マリナ。そうだ、\nおれは帰ると約束したんだ。') && has(t.log, 'おかえりなさい、グレン。') && has(t.log, 'ただいま、マリナ。'), 'ghost_ship_3_boss: the spec lines of #8');
  ok(R.State.hasItem('k_page_isles'), 'ghost_ship_3_boss: 潮のページ (clearRegion)');
  if (DB.events.story_after_clear) ok(t.log.calls.includes('story_after_clear'), 'ghost_ship_3_boss: story_after_clear called');
  else ok(!t.log.calls.includes('story_after_clear'), 'ghost_ship_3_boss: story_after_clear skipped while the story file is absent');
  const order = ['nerei:pier', 'coral:inn'];
  ok(t.log.cleared[0] === 'r_isles' && t.log.warps.join() === order.join(), 'ghost_ship_3_boss: clearRegion before the inn');
  t = await run('ghost_ship_3_boss', { battles: ['win'] });
  eq(t.log.battles, [], 'ghost_ship_3_boss: never again after the clear');
  // --- after the clear
  t = await run('nerei_marina');
  ok(t.log.calls.includes('nerei_marina_reward') && R.State.hasItem('ac_tale_isles') && R.State.flag('nerei_marina_reward'), 'nerei_marina_reward: 潮騒の耳飾り once');
  t = await run('nerei_marina_reward');
  eq(R.State.count('ac_tale_isles'), 1, 'nerei_marina_reward: not twice');
  t = await run('nerei_pier', { answers: [true] });
  ok(has(t.log, '岬の岩場に、あの船が\n静かに横たわっている。\n乗り込みますか？') && t.log.warps[0] === 'ghost_ship_1:entrance', 'nerei_pier: after the clear, board the wreck again');
  t = await run('coral_drake', { map: 'coral' });
  ok(!has(t.log, '記録院のやつに') && t.log.say.length > 0, 'coral_drake: after the clear, new lines');
  // --- a debug start past the region: the intro does not play
  newGame();
  if (R.Tier && R.Tier.clear) R.Tier.clear('r_isles');
  t = await run('coral_intro', { map: 'coral' });
  ok(R.State.flag('isles_start') && t.log.say.length === 0, 'coral_intro: silent when the region is already cleared');
  // --- meta ⇔ behaviour: every gives token is really given on the win path
  const metaGives = {};
  for (const e of EVS) metaGives[e] = (DB.events[e].meta.gives || []).slice();
  ok(metaGives.ghost_ship_3_boss.includes('region:r_isles') && metaGives.ghost_ship_3_boss.includes('flag:isles_boss'), 'meta: ghost_ship_3_boss gives region:r_isles + flag:isles_boss');
  ok(JSON.stringify(DB.events.nerei_marina_song.meta.warp) === JSON.stringify({ to: 'ghost_ship_1', spawn: 'entrance' }) && JSON.stringify(DB.events.nerei_pier.meta.warp) === JSON.stringify({ to: 'ghost_ship_1', spawn: 'entrance' }), 'meta: the pier warps to the ship (progress.js)');
  ok(DB.events.tide_cave_1_shell.meta.gives.includes('item:k_shanty') && DB.events.nerei_marina_song.meta.needs.includes('item:k_shanty'), 'meta: the shell chain');
  R.Field.npc = realFieldNpc;

  console.log('');
  for (const n of notes) console.log('  · ' + n);
  console.log(`\ntest_reg5: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
