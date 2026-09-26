#!/usr/bin/env node
// test_reg2.js (owner reg2 R2) — unit tests of region 2 r_desert ザハラ砂漠: the maps kasim and
// sand_tomb_1..3 and their events (DESIGN §10.8.0 common rules, §10.8.3, §10.6.1–§10.6.4, §10.9, §10.13).
// Runs the real R (tools/lib/load) with a stand-in `ev` for the event scripts (battles resolve to what the
// test asks, messages resolve at once).
//
//   node tools/test_reg2.js [--verbose]        exit 1 on any failure
'use strict';
const R = require('./lib/load')();
const DB = R.DB;
const VERBOSE = process.argv.includes('--verbose');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); }
  else { fail++; fails.push(msg); console.log('  FAIL ' + msg); }
}
function section(t) { if (VERBOSE) console.log('\n# ' + t); }

const MAPS = ['kasim', 'sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3'];
const FM = {};
for (const id of MAPS) FM[id] = R.FieldMap.compile(id);
const tileAt = (m, x, y) => FM[m].base[y * FM[m].w + x];
const npcs = (m) => FM[m].npcs;
const npc = (m, id) => FM[m].npcs.find((n) => n.id === id);
const spawn = (m, s) => FM[m].spawns[s];

// ---------------------------------------------------------------------------------------------- state
function fresh(o) {
  const g = R.State.newGame();
  if (R.Game !== g && g) R.Game = g;
  const h = R.Rules && R.Rules.newChar ? (() => { try { return R.Rules.newChar({ id: 'hero', name: 'テスト', gender: 'm', type: 'warrior', favor: { kind: 'weapon', id: 'sword' } }); } catch (e) { return null; } })() : null;
  if (h && !R.Game.party.some((c) => c.id === 'hero')) R.Game.party.push(h);
  for (const f of (o && o.flags) || []) R.State.setFlag(f, true);
  for (const [k, v] of Object.entries((o && o.vars) || {})) R.State.setVar(k, v);
  if (o && o.cleared) for (const r of o.cleared) { if (R.Tier && R.Tier.clear) R.Tier.clear(r); else R.Game.regionsCleared.push(r); }
  return R.Game;
}

/** a stand-in ev: records what the script does */
function makeEv(map, opts) {
  const o = opts || {};
  const log = { seq: [], says: [], captions: [], battles: [], warps: [], objectives: [], calls: [], gives: [], heals: 0, clears: [], hidden: [], sfx: [] };
  const npcObj = (id) => ({
    x: 30, y: 38, dir: 'down', visible: true,
    face() { return this; }, async walk() {}, hide() { log.hidden.push(id); this.visible = false; return this; }, show() { return this; }, setPos() { return this; },
  });
  const npcsMade = {};
  const ev = {
    ctx: {}, self: null, map,
    get hero() { return R.Game.party.find((c) => c.id === 'hero'); },
    async say(t) { log.says.push(Array.isArray(t) ? t.join('\f') : t); },
    async ask() { return 0; }, async yesno() { return true; },
    closeMessage() {}, async caption(t) { log.captions.push(t); },
    flag: (n) => R.State.flag(n), setFlag: (n, v = true) => R.State.setFlag(n, v), check: (c) => R.State.check(c),
    var: (n) => R.State.getVar(n), setVar: (n, v) => R.State.setVar(n, v),
    has: (i, n = 1) => R.State.hasItem(i, n), take: (i, n = 1) => R.State.removeItem(i, n),
    tier: () => (R.Tier && R.Tier.current ? R.Tier.current() : R.Game.tier || 0),
    cleared: (r) => (R.Game.regionsCleared || []).includes(r),
    async give(item, n = 1) { log.gives.push(item); R.State.addItem(item, n); return true; },
    async giveGold() {},
    async battle(t) { log.battles.push(typeof t === 'string' ? t : t.troop); return o.battle || 'win'; },
    async warp(m, s) { log.seq.push('warp'); log.warps.push(m + ':' + (typeof s === 'string' ? s : JSON.stringify(s))); },
    async wait() {}, async fadeOut() {}, async fadeIn() {}, async shake() {}, async flash() {},
    sfx(id) { log.sfx.push(id); }, bgm() {}, jingle() {},
    npc(id) { return (npcsMade[id] = npcsMade[id] || npcObj(id)); },
    player: { x: 25, y: 41, dir: 'up', face() {}, async walk() {}, setPos() {} },
    heal() { log.seq.push('heal'); log.heals++; },
    setObjective(id, op) { log.objectives.push(id + (op && op.region ? '@' + op.region : '')); if (op && op.region) { R.Game.regionObj = R.Game.regionObj || {}; R.Game.regionObj[op.region] = id; } },
    refresh() {},
    async call(id) { log.seq.push('call:' + id); log.calls.push(id); if (o.callsRun && DB.events[id]) await DB.events[id].run(ev); },
    async clearRegion(r) { log.seq.push('clear'); log.clears.push(r); if (R.Tier && R.Tier.clear) R.Tier.clear(r); else R.Game.regionsCleared.push(r); return R.Game.tier; },
  };
  return { ev, log };
}
async function run(id, map, opts) {
  const { ev, log } = makeEv(map, opts);
  const res = await DB.events[id].run(ev);
  return { res, log };
}

// ---------------------------------------------------------------------------------------------- tests
async function main() {
  section('maps: registry, shape, required keys (§10.6.1, §10.6.2, §3.3.10)');
  for (const id of MAPS) {
    const d = DB.maps[id];
    ok(!!d, id + ' exists');
    ok(d.region === 'r_desert', id + ' region r_desert');
    ok(d.outside != null, id + ' has outside');
    ok(!!d.location && !!DB.locations[d.location], id + ' location ' + d.location + ' is a DB.locations id');
    ok(!('hidden' in d) || !d.hidden || !d.hidden.length, id + ' has no hidden items');
    ok(d.rows.every((r) => r.length === d.rows[0].length), id + ' rows are all the same width');
    ok(!d.decor || (d.decor.length === d.rows.length && d.decor.every((r) => r.length === d.rows[0].length)), id + ' decor matches rows');
  }
  const k = DB.maps.kasim;
  ok(k.type === 'town' && k.theme === 'town_sand' && k.bgm === 'town' && k.location === 'kasim', 'kasim: town / town_sand / bgm town / location kasim');
  ok(FM.kasim.w >= 40 && FM.kasim.h >= 32, 'kasim is at least 40×32 (' + FM.kasim.w + '×' + FM.kasim.h + ')');
  ok(k.outside === 'd', 'kasim outside is sand (desert town, §10.6.1)');
  ok(k.exit && k.exit.to === 'world' && k.exit.spawn === 'kasim', 'kasim exit → world kasim');
  ok(k.onEnter === 'kasim_intro' && !!DB.events.kasim_intro, 'kasim onEnter kasim_intro');
  for (const id of ['sand_tomb_1', 'sand_tomb_2', 'sand_tomb_3']) {
    const d = DB.maps[id];
    ok(d.type === 'dungeon' && d.theme === 'pyramid' && d.bgm === 'pyramid' && d.encounter === 'z_r_desert_tomb', id + ': dungeon / pyramid / z_r_desert_tomb');
    ok(!!DB.encounters[d.encounter], id + ' zone exists');
    ok(d.escape && d.escape.to === 'world' && d.escape.spawn === 'sand_tomb_1', id + ' escape → world sand_tomb_1');
    ok(d.location === 'sand_tomb', id + ' location sand_tomb');
    ok(d.outside === '#', id + ' outside is the theme wall');
  }
  ok(FM.sand_tomb_1.w >= 34 && FM.sand_tomb_1.h >= 30 && FM.sand_tomb_2.w >= 34 && FM.sand_tomb_2.h >= 30, 'floors 1–2 are at least 34×30');
  ok(DB.maps.sand_tomb_1.lvOff == null, '1F has no lvOff (§10.6.2-9)');
  ok(DB.maps.sand_tomb_2.lvOff === 2, '2F lvOff 2');
  ok(DB.maps.sand_tomb_3.lvOff == null, 'boss floor has no lvOff');

  section('spawns and stairs (§10.6.2-1/2)');
  ok(!!spawn('kasim', 'entrance') && !!spawn('kasim', 'inn'), 'kasim spawns entrance + inn');
  ok(spawn('kasim', 'inn').dir === 'down', 'inn spawn faces down');
  ok(!!spawn('sand_tomb_1', 'entrance'), '1F entrance');
  ok(DB.maps.sand_tomb_1.exit && DB.maps.sand_tomb_1.exit.spawn === 'sand_tomb_1', '1F exit to the world');
  const W = (m) => FM[m].warps;
  const hasWarp = (m, to, sp) => W(m).some((w) => w.to === to && w.spawn === sp);
  ok(hasWarp('sand_tomb_1', 'sand_tomb_2', 'from_prev') && !!spawn('sand_tomb_1', 'from_next'), '1F ↔ 2F stairs');
  ok(hasWarp('sand_tomb_2', 'sand_tomb_1', 'from_next') && hasWarp('sand_tomb_2', 'sand_tomb_3', 'from_prev'), '2F stairs both ways');
  ok(!!spawn('sand_tomb_2', 'from_prev') && !!spawn('sand_tomb_2', 'from_next'), '2F spawns from_prev / from_next');
  ok(hasWarp('sand_tomb_3', 'sand_tomb_2', 'from_next') && !!spawn('sand_tomb_3', 'from_prev'), '3F stairs up + from_prev');
  for (const m of MAPS) for (const w of W(m)) {
    const t = DB.maps[w.to];
    ok(!!t, m + ' warp → ' + w.to + ' exists');
    if (t && t.type !== 'world') ok(!!R.FieldMap.compile(w.to).spawns[w.spawn], m + ' warp → ' + w.to + ':' + w.spawn + ' spawn exists');
    const tl = tileAt(m, w.x, w.y);
    ok(/stairs/.test(tl), m + ' warp at ' + w.x + ',' + w.y + ' is on stairs (' + tl + ')');
  }

  section('town NPCs (§10.6.1, §10.8.0-7/8, §10.9.5, §10.13.10)');
  const need = { inn: 'common_inn', tavern: 'common_tavern', shop_item: 'common_shop', shop_weapon: 'common_shop', shop_armor: 'common_shop', folk_a: 'story_rumor', folk_b: 'story_rumor', abul: 'kasim_abul', nadia: 'kasim_nadia' };
  for (const [id, e] of Object.entries(need)) ok(npc('kasim', id) && npc('kasim', id).event === e, 'kasim NPC ' + id + ' → ' + e);
  ok(npc('kasim', 'shop_item').shop === 'kasim_item' && npc('kasim', 'shop_weapon').shop === 'kasim_weapon' && npc('kasim', 'shop_armor').shop === 'kasim_armor', 'shop ids kasim_item/weapon/armor');
  for (const s of ['kasim_item', 'kasim_weapon', 'kasim_armor']) ok(!!DB.shops[s], 'shop ' + s + ' is registered');
  ok(npc('kasim', 'folk_a').rumor === 'kasim_a' && npc('kasim', 'folk_b').rumor === 'kasim_b', 'rumor ids kasim_a / kasim_b');
  const sc = npc('kasim', 'scribe');
  ok(sc && sc.sprite === 'npc:scribe' && JSON.stringify(sc.cond) === JSON.stringify([{ tier: 4 }, { tierBelow: 7 }]) && sc.move === 'wander', 'scribe: npc:scribe, tier 4–6, wanders');
  ok(!!npc('kasim', 'zaid') && npc('kasim', 'zaid').sprite === 'npc:merchant', 'ザイード npc:merchant');
  ok(npc('kasim', 'abul').sprite === 'npc:old_man' && npc('kasim', 'nadia').sprite === 'npc:dancer', 'アブル old_man, ナディア dancer');
  for (const m of MAPS) for (const n of npcs(m)) ok(n.fixed === true || n.push === true, m + ' NPC ' + n.id + ' says fixed or push');
  for (const id of ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'st_rival', 'st_fine', 'st_extra']) ok(npc('kasim', id).fixed === true, id + ' is fixed');
  for (const id of ['folk_a', 'folk_b', 'scribe']) ok(npc('kasim', id).push === true, id + ' is push');

  section('story spots below the inn (§10.8.0-7)');
  const inn = spawn('kasim', 'inn');
  const spot = { st_rival: [0, 2, 'npc:rowell', 'st_show_rival'], st_fine: [2, 2, 'npc:fine', 'st_show_fine'], st_extra: [-2, 2, 'npc:scribe', 'st_show_extra'] };
  for (const [id, [dx, dy, spr, cond]] of Object.entries(spot)) {
    const n = npc('kasim', id);
    ok(n && n.x === inn.x + dx && n.y === inn.y + dy && n.dir === 'up' && n.sprite === spr && n.cond === cond, id + ' at inn+(' + dx + ',' + dy + ') facing up, ' + spr + ', cond ' + cond);
  }
  const clearCells = [];
  for (let y = inn.y; y <= inn.y + 2; y++) for (let x = inn.x - 2; x <= inn.x + 2; x++) clearCells.push([x, y]);
  for (const [x, y] of clearCells) {
    const t = DB.tiles[tileAt('kasim', x, y)];
    const d = FM.kasim.decor && FM.kasim.decor[y * FM.kasim.w + x];
    const other = npcs('kasim').find((n) => n.x === x && n.y === y && !/^st_/.test(n.id));
    ok(t && t.pass && !d && !other && !FM.kasim.chests.some((c) => c.x === x && c.y === y), 'scene cell ' + x + ',' + y + ' is bare floor');
  }

  section('tier text (§3.2.4, §10.8.0-9, §10.9.3)');
  let t4 = 0, fog = 0, withClear = 0, townsfolk = 0;
  for (const n of npcs('kasim')) {
    if (!Array.isArray(n.text) || typeof n.text[0] !== 'object') continue;
    townsfolk++;
    const conds = n.text.map((e) => JSON.stringify(e.cond || null));
    ok(n.text[n.text.length - 1].cond == null, n.id + ': the last entry is the default');
    if (conds.some((c) => c.includes('"cleared":"r_desert"'))) withClear++;
    else if (!n.cond) ok(false, n.id + ': has no after-clear line');
    if (conds.some((c) => c.includes('"tier":4'))) t4++;
    if (conds.some((c) => c.includes('final_open'))) fog++;
  }
  ok(townsfolk >= 15, 'kasim has ≥ 15 townsfolk with {cond,text} lines (' + townsfolk + ')');
  ok(withClear >= 15, 'kasim: ≥ 15 NPCs change after the clear (' + withClear + ')');
  ok(t4 >= 1 && fog >= 1, 'kasim: tier-4 lines (' + t4 + ') and final_open lines (' + fog + ')');
  ok(FM.kasim.signs.some((s) => s.cond && s.cond.tier === 1 && /記録院/.test(s.text)), '記録院の立て札 (tier 1) near the gate');
  ok(DB.maps.kasim.tilePatches.some((p) => p.cond && p.cond.tier === 1 && p.ch === 'm'), 'the notice board tile appears at tier 1');

  section('the spring (§10.8.3 クリア後: sand → water)');
  const water = DB.maps.kasim.tilePatches.filter((p) => p.cond && p.cond.cleared === 'r_desert' && p.ch === '~');
  let cells = 0, allSand = true;
  for (const p of water) for (let y = p.y; y < p.y + (p.h || 1); y++) for (let x = p.x; x < p.x + (p.w || 1); x++) {
    cells++;
    const t = tileAt('kasim', x, y);
    if (t !== 'sand' && t !== 'water') allSand = false;
  }
  ok(cells >= 60, 'the spring patch covers ≥ 60 cells (' + cells + ')');
  ok(allSand, 'every patched cell is sand (dry basin) or the last puddle');
  ok(!npcs('kasim').some((n) => water.some((p) => n.x >= p.x && n.x < p.x + (p.w || 1) && n.y >= p.y && n.y < p.y + (p.h || 1))), 'no NPC stands in the basin');

  section('chests (§10.6.2-8, §3.1.4)');
  const ids = new Set();
  for (const m of MAPS) for (const c of FM[m].chests) {
    ok(!!c.pool && !c.item && !!DB.pools[c.pool], m + ' chest ' + c.id + ' uses a pool (' + c.pool + ')');
    ok(new RegExp('^' + m + '_c\\d+$').test(c.id) && !ids.has(c.id), 'chest id ' + c.id + ' is <map>_c<n> and unique');
    ids.add(c.id);
    ok(DB.tiles[tileAt(m, c.x, c.y)].pass, 'chest ' + c.id + ' stands on floor');
  }
  ok(FM.sand_tomb_1.chests.length >= 3 && FM.sand_tomb_2.chests.length >= 3 && FM.sand_tomb_3.chests.length >= 2, 'chests per floor 1F≥3 2F≥3 3F≥2');

  section('rest lanterns, bosses, フィーネ (§10.6.2-5/6, §10.8.0-4/5)');
  for (const m of ['sand_tomb_2', 'sand_tomb_3']) { const r = npc(m, 'rest'); ok(r && r.event === 'common_rest' && r.sprite === 'obj:lantern' && r.fixed, m + ' has a 休息の灯'); }
  const b2 = npc('sand_tomb_2', 'boss'), b3 = npc('sand_tomb_3', 'boss');
  ok(b2 && b2.sprite === 'mon:b_sandworm' && b2.cond === '!desert_mid' && b2.event === 'sand_tomb_2_boss', 'mid-boss 砂もぐり visible, cond !desert_mid');
  ok(b3 && b3.sprite === 'mon:b_sandking' && b3.cond === '!desert_boss' && b3.event === 'sand_tomb_3_boss', 'boss 名なき砂の王 visible, cond !desert_boss');
  ok(R.Gfx.has('mon:b_sandworm') && R.Gfx.has('mon:b_sandking'), 'boss art exists');
  const fine = npc('sand_tomb_3', 'fine');
  ok(fine && fine.sprite === 'npc:fine' && fine.cond === '!desert_boss', 'fine NPC npc:fine cond !desert_boss');
  const fineSteps = FM.sand_tomb_3.events.filter((e) => e.id === 'sand_tomb_3_fine');
  ok(fineSteps.length > 0 && fineSteps.every((e) => e.trigger === 'step' && e.once === 'desert_fine'), 'the fine step events once desert_fine');
  const rest3 = npc('sand_tomb_3', 'rest');
  ok(Math.abs(rest3.x - fine.x) + Math.abs(rest3.y - fine.y) <= 4, 'フィーネ stands by the 休息の灯');
  ok(Math.max(...fineSteps.map((e) => e.y)) > rest3.y && Math.min(...FM.sand_tomb_3.events.filter((e) => e.id === 'sand_tomb_3_boss').map((e) => e.y)) < rest3.y, 'the fine scene comes before the boss room');
  ok(FM.sand_tomb_2.events.some((e) => e.id === 'sand_tomb_2_boss' && e.trigger === 'step' && e.cond === '!desert_mid'), 'mid-boss step events');
  ok(FM.sand_tomb_3.events.some((e) => e.id === 'sand_tomb_3_boss' && e.trigger === 'step' && e.cond === '!desert_boss'), 'boss step band');
  ok(DB.troops.tr_b_sandworm && DB.troops.tr_b_sandking, 'troops exist');

  section('closed passages and reachability (§10.8.0-6, §10.6.4)');
  const walk = (m, from, st, secretOpen) => {
    const P = FM[m]; const seen = new Set([from.x + ',' + from.y]); const q = [from];
    const patched = (x, y) => {
      let t = P.base[y * P.w + x];
      for (const p of DB.maps[m].tilePatches || []) {
        if (x < p.x || y < p.y || x >= p.x + (p.w || 1) || y >= p.y + (p.h || 1)) continue;
        if (R.State.check(p.cond)) t = p.tile || R.DB.legends.local[p.ch] || t;
      }
      return t;
    };
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx, y = c.y + dy, key = x + ',' + y;
        if (x < 0 || y < 0 || x >= P.w || y >= P.h || seen.has(key)) continue;
        const t = DB.tiles[patched(x, y)];
        if (!t || !t.pass) continue;
        if (t.secret && !secretOpen) continue;
        const dc = P.decor && P.decor[y * P.w + x];
        if (dc && DB.decor[dc] && !DB.decor[dc].pass) continue;
        if (P.npcs.some((n) => n.x === x && n.y === y && n.fixed && R.State.check(n.cond))) continue;
        seen.add(key); q.push({ x, y });
      }
    }
    return seen;
  };
  const adj = (seen, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));
  fresh();
  let s2 = walk('sand_tomb_2', spawn('sand_tomb_2', 'from_prev'), null, true);
  const st2 = npc('sand_tomb_2', 'guardian');
  const down2 = W('sand_tomb_2').find((w) => w.to === 'sand_tomb_3');
  ok(!adj(s2, st2.x, st2.y) && !s2.has(down2.x + ',' + down2.y), '2F: quicksand closes the statue and the stairs down before the worm');
  ok(adj(s2, b2.x, b2.y), '2F: the worm is reachable');
  ok(FM.sand_tomb_2.events.some((e) => e.id === 'sand_tomb_2_quicksand' && e.trigger === 'examine'), '2F: the quicksand has an examine event');
  fresh({ flags: ['desert_mid'] });
  s2 = walk('sand_tomb_2', spawn('sand_tomb_2', 'from_prev'), null, true);
  ok(adj(s2, st2.x, st2.y) && s2.has(down2.x + ',' + down2.y), '2F: after desert_mid the statue and the stairs are open');
  // secret passage: the p_rare alcove only through the cracked wall
  const rare = FM.sand_tomb_2.chests.find((c) => c.pool === 'p_rare');
  const secretCells = [];
  for (let y = 0; y < FM.sand_tomb_2.h; y++) for (let x = 0; x < FM.sand_tomb_2.w; x++) if (DB.tiles[tileAt('sand_tomb_2', x, y)].secret) secretCells.push([x, y]);
  ok(secretCells.length >= 1 && secretCells.length <= 3, '2F: one secret passage of 1–3 cells (' + secretCells.length + ')');
  ok(adj(walk('sand_tomb_2', spawn('sand_tomb_2', 'from_prev'), null, true), rare.x, rare.y) && !adj(walk('sand_tomb_2', spawn('sand_tomb_2', 'from_prev'), null, false), rare.x, rare.y), '2F: the p_rare chest is reached only through the secret passage');
  for (const m of ['sand_tomb_1', 'sand_tomb_3']) {
    let n = 0; for (let y = 0; y < FM[m].h; y++) for (let x = 0; x < FM[m].w; x++) if (DB.tiles[tileAt(m, x, y)].secret) n++;
    ok(n === 0, m + ': no secret passage (§10.6.4: only sand_tomb_2)');
  }
  // 3F king's door
  fresh({ vars: { desert_letters: 2 } });
  let s3 = walk('sand_tomb_3', spawn('sand_tomb_3', 'from_prev'), null, true);
  ok(!adj(s3, b3.x, b3.y), '3F: the 岩戸 is shut with 2 letters');
  ok(['rock_door'].includes(tileAt('sand_tomb_3', 19, 11)) && DB.tiles.rock_door.closed, '3F: the door is a closed tile (rock_door)');
  ok(FM.sand_tomb_3.events.filter((e) => e.id === 'sand_tomb_3_door' && e.trigger === 'examine').length === 2, '3F: examine events on the closed door');
  fresh({ vars: { desert_letters: 3 } });
  s3 = walk('sand_tomb_3', spawn('sand_tomb_3', 'from_prev'), null, true);
  ok(adj(s3, b3.x, b3.y), '3F: the door opens with 3 letters');
  // the step bands in front of the bosses and フィーネ span the whole way (no side column walks past)
  const gated = (m, from, evId, target) => {
    const P = FM[m], band = new Set(P.events.filter((e) => e.id === evId && e.trigger === 'step').map((e) => e.x + ',' + e.y));
    const seen = new Set([from.x + ',' + from.y]); const q = [from];
    const full = walk(m, from, null, true);
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = (c.x + dx) + ',' + (c.y + dy);
        if (!full.has(key) || seen.has(key) || band.has(key)) continue;
        seen.add(key); q.push({ x: c.x + dx, y: c.y + dy });
      }
    }
    return band.size > 0 && !adj(seen, target.x, target.y);
  };
  fresh({ flags: ['desert_mid'], vars: { desert_letters: 3 } });
  ok(gated('sand_tomb_3', spawn('sand_tomb_3', 'from_prev'), 'sand_tomb_3_boss', b3), '3F: the king cannot be reached without crossing the boss band');
  ok(gated('sand_tomb_3', spawn('sand_tomb_3', 'from_prev'), 'sand_tomb_3_fine', npc('sand_tomb_3', 'fine')), '3F: フィーネ cannot be reached without crossing her step band');
  fresh();
  ok(gated('sand_tomb_2', spawn('sand_tomb_2', 'from_prev'), 'sand_tomb_2_boss', b2), '2F: the worm cannot be reached without crossing its step band');
  // every map fully reachable from its arrival spawn (with the gates open)
  fresh({ flags: ['desert_mid'], vars: { desert_letters: 3 } });
  for (const [m, sp] of [['sand_tomb_1', 'entrance'], ['sand_tomb_2', 'from_prev'], ['sand_tomb_3', 'from_prev'], ['kasim', 'entrance']]) {
    const s = walk(m, spawn(m, sp), null, true);
    for (const c of FM[m].chests) ok(adj(s, c.x, c.y), m + ': chest ' + c.id + ' reachable');
    const counter = (x, y) => { const t = DB.tiles[FM[m].base[y * FM[m].w + x]]; const d = FM[m].decor && FM[m].decor[y * FM[m].w + x]; return (t && t.counter) || (d && DB.decor[d] && DB.decor[d].counter); };
    const across = (n) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => counter(n.x + dx, n.y + dy) && s.has((n.x + 2 * dx) + ',' + (n.y + 2 * dy)));
    for (const n of FM[m].npcs.filter((n) => n.event && R.State.check(n.cond))) ok(adj(s, n.x, n.y) || across(n), m + ': NPC ' + n.id + ' reachable');
  }
  ok(R.Gfx.has('tile:quicksand') && DB.tiles.quicksand && DB.tiles.quicksand.closed && !DB.tiles.quicksand.pass, 'the quicksand tile (closed, drawn)');
  ok(R.Gfx.has('obj:r2_guardian') && R.Gfx.has('obj:r2_coffin'), 'the guardian statue and coffin art');

  section('events: the region flow (§10.8.3)');
  fresh();
  let r = await run('kasim_intro', 'kasim');
  ok(R.State.flag('desert_start') && r.log.objectives.includes('obj_desert_1@r_desert'), 'kasim_intro: desert_start + obj_desert_1 (region)');
  ok(r.log.says.includes('砂嵐のせいで、隊商が出せない。') && r.log.says.includes('オアシスの水も、日に日に減っている。'), 'kasim_intro: the spec lines of ザイード');
  r = await run('kasim_intro', 'kasim');
  ok(r.log.says.length === 0, 'kasim_intro runs once');
  r = await run('kasim_abul', 'kasim');
  ok(r.log.says.some((s) => s.startsWith('王墓の王が目覚めたのじゃ。')) && r.log.says.some((s) => /記録院の若者/.test(s)), 'アブル: the king and ロウェルの痕跡');
  ok(!R.State.hasItem('ac_tale_desert'), 'no reward before the clear');
  r = await run('kasim_nadia', 'kasim');
  ok(r.log.says[0] === '夕べの祈りで、王さまの\n名前を呼んでいたはずなのに、\nその名前だけが白く抜けてるの。', 'ナディア: the spec line');
  // the three letters (any order)
  r = await run('sand_tomb_2_statue', 'sand_tomb_2');
  ok(R.State.getVar('desert_letters') === 1 && r.log.objectives.includes('obj_desert_2@r_desert'), 'the first statue: letters 1, obj_desert_2');
  ok(r.log.says.some((s) => s === '像の台座に、文字がひとつ刻まれている。\n『ザ』……。'), 'statue 2 says 『ザ』');
  r = await run('sand_tomb_2_statue', 'sand_tomb_2');
  ok(R.State.getVar('desert_letters') === 1, 'a statue counts once');
  r = await run('sand_tomb_1_statue', 'sand_tomb_1');
  ok(R.State.getVar('desert_letters') === 2 && r.log.captions.length === 0, 'second letter: no name yet');
  r = await run('sand_tomb_3_statue', 'sand_tomb_3');
  ok(R.State.getVar('desert_letters') === 3 && r.log.captions.some((c) => c === '三つの文字が、\nひとつの名になった。\n――ハザル。') && r.log.objectives.includes('obj_desert_3@r_desert'), 'the third letter: ハザル, obj_desert_3');
  ok(r.log.sfx.includes('unlock'), 'the door opens with sfx unlock on 3F');
  // mid-boss
  r = await run('sand_tomb_2_boss', 'sand_tomb_2', { battle: 'lose' });
  ok(r.res === false && !R.State.flag('desert_mid'), 'mid-boss lost → false, no flag');
  r = await run('sand_tomb_2_boss', 'sand_tomb_2');
  ok(r.log.battles[0] === 'tr_b_sandworm' && R.State.flag('desert_mid') && r.log.hidden.includes('boss'), 'mid-boss won → desert_mid, the worm hides');
  // fine
  r = await run('sand_tomb_3_fine', 'sand_tomb_3');
  ok(R.State.flag('desert_fine') && (r.log.calls.includes('story_fine_desert') || r.log.says.length > 0), 'フィーネ: desert_fine (story_fine_desert)');
  // boss
  r = await run('sand_tomb_3_boss', 'sand_tomb_3', { battle: 'lose' });
  ok(r.res === false && !R.State.flag('desert_boss') && !(R.Game.regionsCleared || []).includes('r_desert'), 'boss lost → false, nothing cleared');
  r = await run('sand_tomb_3_boss', 'sand_tomb_3');
  ok(r.log.battles[0] === 'tr_b_sandking' && R.State.flag('desert_boss'), 'boss won → desert_boss');
  ok(r.log.says.includes('{hero}は、年代記に\n王の名を書き記した。\n――ハザル。') && r.log.says.includes('ハザル……そうだ、\nそれがわたしの名だ。'), 'the retelling lines');
  ok(r.log.clears[0] === 'r_desert' && (R.Game.regionsCleared || []).includes('r_desert'), 'ev.clearRegion(r_desert)');
  ok(r.log.captions.includes('その夜は、町の宿で眠った。') && r.log.warps.includes('kasim:inn') && r.log.heals >= 1, 'the night at the inn of kasim (warp inn + heal + caption)');
  ok(r.log.calls.includes('story_after_clear') || !DB.events.story_after_clear, 'story_after_clear is called');
  const q = r.log.seq.join(' ');
  ok(/clear.*heal.*warp.*call:story_after_clear/.test(q) || (!DB.events.story_after_clear && /clear.*heal.*warp/.test(q)), 'order: clearRegion → heal → warp inn → story_after_clear (' + q + ')');
  // after the clear
  r = await run('kasim_abul', 'kasim', { callsRun: true });
  ok(R.State.hasItem('ac_tale_desert') && R.State.flag('kasim_abul_reward') && r.log.gives.filter((g) => g === 'ac_tale_desert').length === 1, 'アブル gives 砂王の印章 once');
  r = await run('kasim_abul', 'kasim', { callsRun: true });
  ok(r.log.gives.length === 0 && r.log.says.length > 0, 'the reward is given once');
  ok(DB.items.ac_tale_desert && DB.items.ac_tale_desert.name === '砂王の印章', 'reward item ac_tale_desert 砂王の印章');
  r = await run('kasim_nadia', 'kasim');
  ok(r.log.says.some((s) => /ハザル王/.test(s)), 'ナディア dances for ハザル王 after the clear');

  section('objectives, meta, text (§10.13.8, §3.3.11, STYLE_JA)');
  ok(DB.objectives.obj_desert_1.text === '南西の砂の王墓で、\n王の名を探そう。', 'obj_desert_1 text');
  ok(DB.objectives.obj_desert_2.text === '墓守の像の台座から、\n王の名の文字を集めよう。', 'obj_desert_2 text');
  ok(DB.objectives.obj_desert_3.text === '王墓の奥で、\n名なき王に名を返そう。', 'obj_desert_3 text');
  const EV = ['kasim_intro', 'kasim_abul', 'kasim_abul_reward', 'kasim_nadia', 'sand_tomb_1_statue', 'sand_tomb_2_statue', 'sand_tomb_3_statue', 'sand_tomb_2_boss', 'sand_tomb_2_quicksand', 'sand_tomb_3_door', 'sand_tomb_3_fine', 'sand_tomb_3_boss'];
  for (const id of EV) ok(DB.events[id] && DB.events[id].meta && Array.isArray(DB.events[id].meta.needs) && Array.isArray(DB.events[id].meta.gives), 'event ' + id + ' has meta');
  ok(DB.events.sand_tomb_3_boss.meta.gives.includes('region:r_desert') && DB.events.sand_tomb_3_boss.meta.needs.includes('var:desert_letters>=3'), 'boss meta: needs 3 letters, gives the region');
  ok(DB.events.sand_tomb_2_boss.meta.gives.includes('flag:desert_mid'), 'mid-boss meta gives desert_mid');
  // every event / NPC text line ≤ 20 full-width chars ({hero} = 5)
  const width = (s) => [...s.replace(/\{hero\}/g, '＿＿＿＿＿')].reduce((a, ch) => a + (/[ -~]/.test(ch) ? 0.5 : 1), 0);
  const texts = [];
  const collect = (t) => { if (t == null) return; if (typeof t === 'string') texts.push(t); else if (Array.isArray(t)) t.forEach(collect); else if (t.text) collect(t.text); };
  for (const m of MAPS) { npcs(m).forEach((n) => collect(n.text)); FM[m].signs.forEach((s) => collect(s.text)); }
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'events', 'region2_kasim.js'), 'utf8') + require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'events', 'region2_tomb.js'), 'utf8');
  for (const mm of src.matchAll(/'([^'\n]*[぀-ヿ一-鿿][^'\n]*)'/g)) texts.push(mm[1].replace(/\\n/g, '\n').replace(/\\f/g, '\f'));
  let wide = 0;
  for (const t of texts) for (const page of t.split('\f')) { const ls = page.split('\n'); if (ls.some((l) => width(l) > 20) || ls.length > 4) { wide++; console.log('    too wide/long: ' + JSON.stringify(page)); } }
  ok(wide === 0, 'all ' + texts.length + ' texts fit 20 chars × 4 lines');
  ok(!/アルン/.test(src) && !texts.some((t) => /アルン/.test(t)), 'no hard-coded hero name');

  console.log('\ntest_reg2: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log(fails.map((f) => '  - ' + f).join('\n')); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
