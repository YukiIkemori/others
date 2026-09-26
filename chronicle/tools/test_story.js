#!/usr/bin/env node
// test_story.js (owner story A19) — unit tests of the cross-region story, the endgame and the ending.
// node, exit 1 on any failure. Runs the real event scripts against the real R.State / R.Tier with a stand-in `ev`
// (messages are recorded, battles return a chosen result), and checks the endgame maps with a BFS on the compiled
// maps (R.FieldMap.compile — the field's own reading).
//
//   node tools/test_story.js [--verbose]
//
// Sections: S1 objectives · S2 rumours · S3 story_after_clear T1–T8 · S4 story_fine_<rs> · S5 story_home_t6 ·
// S6 story_final_roa · S7 ビブリア · S8 the archive's events · S9 the ending's record · S10 text rules of every
// line said · S11 endgame maps (size, spawns, BFS, gates, secrets, chests) · S12 the ending / bonus scene API
'use strict';
const path = require('path');
const load = require('./lib/load');

const VERBOSE = process.argv.includes('--verbose');
const R = load({ quiet: true });
const DB = R.DB;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
const section = (s) => { if (VERBOSE) console.log('--', s); };

// ------------------------------------------------------------ text measure (STYLE_JA §1: 20 full-width a line, {hero} = 5)
const W = (s) => {
  let n = 0;
  const t = String(s).replace(/\{hero\}/g, '＿＿＿＿＿').replace(/\{leader\}/g, '＿＿＿＿＿');
  for (const ch of t) n += ch.charCodeAt(0) < 0x80 ? 0.5 : 1;
  return n;
};
const said = []; // every text the story says in these runs (S10)
function lintPage(text, where) {
  for (const page of String(text).split('\f')) {
    const lines = page.split('\n');
    ok(lines.length <= 4, `${where}: a page has ${lines.length} lines (max 4): ${page}`);
    for (const l of lines) ok(W(l) <= 20, `${where}: line wider than 20 (${W(l)}): ${l}`);
  }
}

// ------------------------------------------------------------ a stand-in ev
function newGame(o) {
  o = o || {};
  R.State.newGame();
  const g = R.Game;
  g.party.push(...['brigitta', 'marta', 'sylvain'].map((id) => { try { return R.Rules.newChar({ id }); } catch (e) { return null; } }).filter(Boolean));
  const regs = Object.keys(DB.regions);
  for (let i = 0; i < (o.tier || 0); i++) { g.regionsCleared.push(regs[i]); R.State.setFlag('cleared_' + regs[i]); }
  g.tier = g.regionsCleared.length;
  for (const f of o.flags || []) R.State.setFlag(f);
  for (const it of o.items || []) R.State.addItem(it, 1);
  return g;
}
function makeEv(o) {
  o = o || {};
  const log = { say: [], captions: [], battles: [], gives: [], warps: [], ending: 0, objectives: [], bgm: [] };
  const npcH = () => { const h = { x: 0, y: 0, dir: 'down', visible: true, face: () => h, walk: async () => {}, hide: () => h, show: () => h, setPos: () => h }; return h; };
  const ev = {
    ctx: o.ctx || {}, self: o.self || null,
    get map() { return o.map || null; },
    get leader() { return R.State.leader().name; },
    get hero() { return R.State.hero(); },
    async say(t) { const p = R.Events.pickText(t); if (p == null) return; for (const s of [].concat(p)) { log.say.push(s); said.push([o.where || 'ev', s]); } },
    async ask() { return 0; }, async yesno() { return true; }, async gotItem() {}, closeMessage() {},
    async caption(t) { log.captions.push(t); said.push([(o.where || 'ev') + ' caption', t]); },
    flag: (n) => R.State.flag(n), setFlag: (n, v = true) => R.State.setFlag(n, v), check: (c) => R.State.check(c),
    var: (n) => R.State.getVar(n), setVar: (n, v) => R.State.setVar(n, v), has: (i, n = 1) => R.State.hasItem(i, n), take: (i, n = 1) => R.State.removeItem(i, n),
    gold: () => R.Game.gold, takeGold: (n) => R.State.takeGold(n),
    tier: () => R.Tier.current ? R.Tier.current() : R.Game.tier,
    cleared: (r) => R.Game.regionsCleared.includes(r),
    g: (m, f) => m,
    async give(item, n = 1) { ok(!!DB.items[item], 'give: unknown item ' + item); R.State.addItem(item, n); log.gives.push(item); return true; },
    async giveGold(n) { R.State.addGold(n); },
    async battle(troop, opts) {
      const id = typeof troop === 'object' ? troop.troop : troop;
      ok(!!DB.troops[id], 'battle: unknown troop ' + id);
      log.battles.push({ id, opts: opts || {} });
      const r = typeof o.battle === 'function' ? o.battle(id) : (o.battle || 'win');
      return r;
    },
    async warp(map, spawn) { ok(!!DB.maps[map], 'warp: unknown map ' + map); log.warps.push([map, spawn]); },
    async wait() {}, async fadeOut() {}, async fadeIn() {}, async shake() {}, async flash() {},
    sfx() {}, bgm(id) { log.bgm.push(id || null); }, async jingle() {},
    npc: npcH, player: { x: 0, y: 0, dir: 'up', face() {}, async walk() {}, setPos() {} },
    heal() { R.State.healAll({ reserve: true }); }, async inn() { return true; }, async rest() {},
    async shop() {}, async saveMenu() {},
    setObjective(id, op) { ok(!!DB.objectives[id], 'objective: unknown ' + id); log.objectives.push(id); if (op && op.region) R.Game.regionObj[op.region] = id; else R.Game.objective = id; },
    setRespawn() {}, refresh() {},
    async ending() { log.ending++; },
    async call(id) { const d = DB.events[id]; ok(!!d, 'call: unknown event ' + id); if (d) return d.run(ev); return undefined; },
    async clearRegion() { return R.Game.tier; },
  };
  return { ev, log };
}
async function run(id, o) {
  const { ev, log } = makeEv(Object.assign({ where: id }, o || {}));
  const d = DB.events[id];
  ok(!!d, 'event missing: ' + id);
  if (!d) return { log, result: undefined };
  let result;
  try { result = await d.run(ev); } catch (e) { ok(false, id + ' threw ' + (e.stack || e)); }
  return { log, result };
}

(async () => {
  // ============================================================ S1 objectives
  section('S1 objectives');
  const OBJ = ['obj_s_t6_home', 'obj_s_final_roa', 'obj_s_final_ferry', 'obj_s_final_archive', 'obj_s_postgame', 'obj_s_pg_clear'];
  for (const id of OBJ) { ok(!!DB.objectives[id], 'objective ' + id); if (DB.objectives[id]) lintPage(DB.objectives[id].text, id); }
  ok(Object.keys(DB.objectives).filter((k) => /^obj_s_/.test(k)).length === 6, 'exactly 6 obj_s_*');

  // ============================================================ S2 rumours
  section('S2 rumours');
  const TOWNS = { roa: 0, lute: 0, fern: 1, kasim: 2, yule: 3, loch: 4, coral: 5, nerei: 5, dovan: 6, caldera: 7, orbis: 8 };
  const REG = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
  for (const t of Object.keys(TOWNS)) {
    ok(!!DB.rumors[t + '_a'], 'rumor ' + t + '_a');
    ok(t === 'nerei' ? !DB.rumors[t + '_b'] : !!DB.rumors[t + '_b'], 'rumor ' + t + '_b (none in nerei)');
  }
  ok(!!DB.rumors.biblia_a && !DB.rumors.biblia_b, 'biblia: folk_a only');
  const pick = (id) => R.Events.pickText(DB.rumors[id].text);
  const H = DB.events.story_rumor.HINT, M = DB.events.story_rumor.MOOD;
  // folk_b: the first region not cleared, counting from N+1 round (own region skipped)
  for (const [t, n] of Object.entries(TOWNS)) {
    if (t === 'nerei') continue;
    for (let mask = 0; mask < 256; mask += 17) {
      newGame();
      const g = R.Game;
      REG.forEach((r, i) => { if (mask & (1 << i)) { g.regionsCleared.push(r); R.State.setFlag('cleared_' + r); } });
      g.tier = g.regionsCleared.length;
      let want = null;
      for (let k = 0; k < 8 && !want; k++) {
        const i = (n + k) % 8;
        if (n > 0 && i === n - 1) continue;
        if (!g.regionsCleared.includes(REG[i])) want = H[REG[i]];
      }
      const got = pick(t + '_b');
      if (want) eq(got, want, `folk_b ${t} mask ${mask}`);
      else ok(String(got).startsWith(pickMood(g)), `folk_b ${t} all cleared → mood`);
    }
  }
  function pickMood(g) {
    if (g.gameClear) return M.post;
    if (R.State.flag('final_open')) return M.fog;
    const t = g.tier;
    return t >= 7 ? M.t7 : t >= 6 ? M.t6 : t >= 4 ? M.t4 : t >= 3 ? M.t3 : t >= 1 ? M.t1 : M.t0;
  }
  // folk_a by tier / fog / postgame
  for (const tier of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    newGame({ tier });
    ok(String(pick('lute_a')).startsWith(pickMood(R.Game)), 'folk_a lute tier ' + tier);
  }
  newGame({ tier: 8, flags: ['final_open'] }); ok(String(pick('fern_a')).startsWith(M.fog), 'folk_a fog');
  newGame({ tier: 8, flags: ['final_open', 'game_clear'] }); R.Game.gameClear = true; ok(String(pick('orbis_a')).startsWith(M.post), 'folk_a postgame');
  newGame({ tier: 8, flags: ['final_arrived'] }); ok(/誰/.test(pick('biblia_a')), 'biblia white');
  for (const [id, r] of Object.entries(DB.rumors)) for (const e of r.text) lintPage(e.text, 'rumor ' + id);
  // the event itself
  newGame({ tier: 2 });
  { const { log } = await run('story_rumor', { ctx: { npc: { id: 'folk_a', rumor: 'kasim_a' } } }); ok(log.say.length === 1 && log.say[0].startsWith(M.t1), 'story_rumor says kasim_a'); }

  // ============================================================ S3 story_after_clear
  section('S3 story_after_clear');
  const regs = Object.keys(DB.regions);
  const clearUpTo = (t) => { newGame({ tier: t - 1 }); for (let k = 1; k < t; k++) R.State.setFlag('st_t' + k); R.Game.regionsCleared.push(regs[t - 1]); R.Game.tier = t; };
  for (let t = 1; t <= 8; t++) {
    for (const res of t === 2 || t === 5 ? ['win', 'lose'] : ['win']) {
      clearUpTo(t);
      if (t === 8) R.State.addItem('k_rowell_note', 1);
      const { log } = await run('story_after_clear', { battle: res, map: 'fern' });
      ok(R.State.flag('st_t' + t), `T${t}: st_t${t}`);
      ok(log.captions[0] === '翌朝――', `T${t}: starts with 翌朝――`);
      for (const f of ['st_show_rival', 'st_show_fine', 'st_show_extra']) ok(!R.State.flag(f), `T${t}: ${f} lowered`);
      if (t === 2) { ok(R.State.flag('st_rival_duel1'), 'T2 duel1'); eq(log.battles.map((b) => b.id), ['tr_b_rowell1'], 'T2 battle'); ok(log.battles[0].opts.canLose, 'T2 canLose'); eq(R.State.flag('st_rival_won1'), res === 'win', 'T2 won1 ' + res); eq(log.gives.includes('ac_rival_pen'), res === 'win', 'T2 reward ' + res); }
      if (t === 5) { ok(R.State.flag('st_rival_duel2'), 'T5 duel2'); eq(log.battles.map((b) => b.id), ['tr_b_rowell2'], 'T5 battle'); ok(log.battles[0].opts.canLose, 'T5 canLose'); eq(log.gives.includes('hn_rival_bracer'), res === 'win', 'T5 reward ' + res); ok(log.say.filter((s) => s.includes('元気にしているかい')).length === 2, 'T5 two letters'); }
      if (t === 1) ok(log.say.some((s) => s.startsWith('少女「')), 'T1: the girl is 少女');
      if (t === 3) { ok(log.say.some((s) => s.startsWith('少女「……わたしはフィーネ')), 'T3: she names herself as 少女'); ok(R.State.flag('st_t3'), 'T3 st_t3'); }
      if (t === 4) ok(log.say.some((s) => s.includes('ラザロ')) && log.captions.some((c) => c.includes('霧')), 'T4 decree + fog');
      if (t === 6) eq(R.Game.objective, 'obj_s_t6_home', 'T6 objective');
      if (t === 7) { ok(R.State.hasItem('k_rowell_note'), 'T7 note'); ok(R.State.flag('st_rival_defect'), 'T7 defect'); }
      if (t === 8) { ok(R.State.flag('st_fine_reveal'), 'T8 reveal'); eq(R.Game.objective, 'obj_s_final_roa', 'T8 objective'); ok(log.say.some((s) => s.includes('千年前')), 'T8 the truth'); }
      // a second call does nothing
      const again = await run('story_after_clear', { battle: res });
      ok(again.log.say.length === 0 && again.log.captions.length === 0, `T${t}: runs once`);
    }
  }
  // T8 reached without the T7 scene (debug tier jumps): T7 is played first so the note is not lost
  clearUpTo(8); R.State.setFlag('st_t7', false);
  { await run('story_after_clear'); ok(R.State.hasItem('k_rowell_note') && R.State.flag('st_t7') && R.State.flag('st_t8'), 'T8 plays the missed T7'); }
  newGame({ tier: 0 }); { const { log } = await run('story_after_clear'); ok(!log.say.length, 'tier 0: nothing'); }

  // ============================================================ S4 story_fine_<rs>
  section('S4 story_fine');
  const RS = ['forest', 'desert', 'snow', 'marsh', 'isles', 'mine', 'ash', 'star'];
  for (const rs of RS) {
    for (const [tier, close] of [[0, '……気をつけて。'], [3, 'わたしのことは気にしないで。\n先へ進みなさい。'], [6, '……もう、あまり時間がないの。']]) {
      newGame({ tier });
      const { log } = await run('story_fine_' + rs, { map: 'x' });
      ok(R.State.flag(rs + '_fine'), `fine ${rs}: flag`);
      ok(log.say.length === 2 && log.say[1] === close, `fine ${rs} tier ${tier}: closing line`);
      eq(log.captions.length, tier >= 3 ? 1 : 0, `fine ${rs} tier ${tier}: caption`);
    }
    newGame({ tier: 1, flags: [rs + '_boss'] });
    { const { log } = await run('story_fine_' + rs); ok(!log.say.length, `fine ${rs}: silent after the boss`); }
  }

  // ============================================================ S5 story_home_t6
  section('S5 story_home_t6');
  newGame({ tier: 6, flags: ['st_t6'] }); R.Game.objective = 'obj_s_t6_home';
  { const { log } = await run('story_home_t6', { map: 'roa' }); ok(R.State.flag('st_berna_forgot'), 'home_t6 flag'); eq(R.Game.objective, 'obj_regions', 'home_t6 objective'); ok(log.say[0].startsWith('旅の方？'), 'home_t6 first line'); }
  newGame({ tier: 7, flags: ['st_t6'] }); R.Game.objective = 'obj_regions';
  { await run('story_home_t6'); eq(R.Game.objective, 'obj_regions', 'home_t6 keeps another objective'); }

  // ============================================================ S6 story_final_roa
  section('S6 story_final_roa');
  newGame({ tier: 8, flags: ['st_t8', 'st_fine_reveal'] });
  { const { log } = await run('story_final_roa', { map: 'roa' });
    for (const f of ['final_roa', 'final_open', 'st_berna_forgot', 'roa_berna_gift']) ok(R.State.flag(f), 'final_roa: ' + f);
    ok(R.State.hasItem('ac_berna_charm'), 'final_roa: the gift'); eq(R.Game.objective, 'obj_s_final_ferry', 'final_roa objective');
    ok(log.captions.length === 9, 'final_roa: 8 verses + the fog caption (' + log.captions.length + ')');
    ok(!R.State.flag('st_show_fine') && !R.State.flag('st_show_rival'), 'final_roa: slots lowered'); }

  // ============================================================ S7 ビブリア
  section('S7 biblia');
  newGame({ tier: 8, flags: ['final_open', 'final_roa'] });
  { await run('biblia_arrival', { map: 'biblia' }); ok(R.State.flag('final_arrived'), 'arrival flag'); eq(R.Game.objective, 'obj_s_final_archive', 'arrival objective'); }
  { const { log } = await run('biblia_arrival', { map: 'biblia' }); ok(!log.say.length, 'arrival once'); }
  for (const id of ['biblia_rowell', 'biblia_noa', 'biblia_portrait', 'biblia_statue', 'biblia_tome']) { const { log } = await run(id, { map: 'biblia' }); ok(log.say.length > 0, id + ' says something'); }
  R.Game.gameClear = true; R.State.setFlag('game_clear');
  { const { log } = await run('biblia_statue', { map: 'biblia' }); ok(log.captions.includes('――フィーネ。'), 'the statue is named after the ending'); }

  // ============================================================ S8 the archive
  section('S8 archive');
  newGame({ tier: 8, flags: ['final_open', 'final_arrived'], items: ['k_rowell_note'] });
  { await run('archive_1_enter'); ok(R.State.flag('archive_1_enter'), 'archive_1_enter'); }
  { const { result } = await run('archive_2_boss', { battle: 'lose' }); ok(result === false && !R.State.flag('final_golem'), 'golem lost → retry'); }
  { const { log } = await run('archive_2_boss'); ok(R.State.flag('final_golem'), 'golem'); eq(log.battles.map((b) => b.id), ['tr_b_bookgolem'], 'golem troop'); }
  { await run('archive_3_rowell', { map: 'archive_3' }); ok(R.State.flag('final_rowell'), 'rowell'); }
  { const { log } = await run('archive_4_boss'); ok(R.State.flag('final_shades'), 'shades'); eq(log.battles.map((b) => b.id), ['tr_b_heroshades'], 'shades troop'); }
  for (const x of [8, 14, 20, 26]) { const { log } = await run('archive_4_painting', { ctx: { x } }); ok(log.say.length >= 2, 'painting ' + x); }
  { const { log } = await run('archive_5_lazaro'); ok(R.State.flag('final_lazaro'), 'lazaro'); eq(log.battles.map((b) => b.id), ['tr_b_lazaro'], 'lazaro troop'); ok(log.say.some((s) => s.startsWith('虚ろの王「')), 'the king speaks'); }
  // the last boss: lose the second form → retry from the naming scene
  { const { log, result } = await run('archive_6_boss', { battle: (id) => (id === 'tr_b_nemrea2' ? 'lose' : 'win') });
    ok(result === false && R.State.flag('final_nemrea1') && !log.ending, 'nemrea2 lost: no ending, final_nemrea1 kept');
    eq(log.battles.map((b) => b.id), ['tr_b_nemrea1', 'tr_b_nemrea2'], 'both forms');
    ok(log.battles.every((b) => b.opts.noEscape), 'noEscape'); ok(log.captions.includes('――ネムレア。'), 'the name is written'); }
  { const { log } = await run('archive_6_boss');
    eq(log.battles.map((b) => b.id), ['tr_b_nemrea2'], 'retry: second form only'); ok(log.ending === 1, 'the ending starts'); ok(log.say.some((s) => s.includes('もう一度よ')), 'retry: the short naming'); }
  // a first-form loss: nothing is kept
  newGame({ tier: 8, flags: ['final_lazaro'] });
  { const { result } = await run('archive_6_boss', { battle: 'lose' }); ok(result === false && !R.State.flag('final_nemrea1'), 'nemrea1 lost'); }

  // ============================================================ S9 the ending's record (E10)
  section('S9 ending record');
  newGame({ tier: 8, flags: ['final_nemrea1', 'st_show_fine'] });
  R.Ending.record();
  const g = R.Game;
  ok(g.gameClear && R.State.flag('game_clear') && g.clearCount === 1, 'record: clear');
  eq(g.pos.map + '/' + g.pos.spawn, DB.config.postgameStart.map + '/' + DB.config.postgameStart.spawn, 'record: postgame start');
  eq(g.respawn, { map: DB.config.postgameStart.map, spawn: DB.config.postgameStart.spawn }, 'record: respawn');
  eq(g.objective, 'obj_s_postgame', 'record: objective');
  ok(!R.State.flag('st_show_fine'), 'record: scene flags lowered');
  const saved = R.State.deserialize(JSON.parse(JSON.stringify(R.State.serialize())));
  ok(saved && R.Game.gameClear, 'record: survives save/load');

  // ============================================================ S10 text rules of all the lines said above
  section('S10 text');
  const BANNED = ['冒険の書', '復活の呪文', '呪文', '痛恨', 'やっつけた', 'ジョブ', 'アビリティ', '頁', '蘇生', '麻痺'];
  for (const [where, t] of said) {
    lintPage(t, where);
    ok(!/[^…]…[^…]|^…[^…]|[^…]…$/.test(t.replace(/……/g, '')), `${where}: a single … : ${t}`);
    for (const b of BANNED) ok(!t.includes(b), `${where}: banned word ${b}`);
    ok(!/アルン/.test(t), `${where}: the hero's name written out`);
  }
  if (VERBOSE) console.log('   lines said:', said.length);

  // ============================================================ S11 the endgame maps
  section('S11 maps');
  const MAPS = ['biblia', 'archive_1', 'archive_2', 'archive_3', 'archive_4', 'archive_5', 'archive_6'];
  function compileWith(id, flags, items) {
    newGame({ tier: 8, flags: flags || [], items: items || [] });
    const m = R.FieldMap.compile(id);
    m.refresh();
    return m;
  }
  const passable = (m, x, y, blockNpc) => {
    if (!m.inBounds(x, y) || !m.walkable(x, y)) return false;
    if (blockNpc) { const n = m.npcAt(x, y); if (n && !(R.FieldMap.pushable ? R.FieldMap.pushable(n) : !n.fixed)) return false; }
    return true;
  };
  function bfs(m, from, opt) {
    opt = opt || {};
    const seen = new Set([from.x + ',' + from.y]), q = [[from.x, from.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k)) continue;
        if (opt.block && opt.block.has(k)) continue;
        if (opt.noSecret && m.isSecret(nx, ny)) continue;
        if (!passable(m, nx, ny, true)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  }
  const near = (seen, x, y) => seen.has(x + ',' + y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));
  for (const id of MAPS) {
    const d = DB.maps[id];
    ok(!!d, 'map ' + id);
    if (!d) continue;
    const m = compileWith(id, ['final_open', 'final_arrived']);
    const boss = id === 'archive_6';
    if (id === 'biblia') ok(m.w >= 40 && m.h >= 32, 'biblia size ≥ 40×32');
    else ok((m.w >= 34 && m.h >= 30) || (boss && d.outside === '#'), id + ' size ≥ 34×30 (or a walled boss floor)');
    ok(d.outside != null, id + ' outside');
    eq(d.location, id === 'biblia' ? 'biblia' : 'archive', id + ' location');
    eq(d.region, 'finale', id + ' region');
    if (id !== 'biblia') {
      eq(d.chestTier, 8, id + ' chestTier');
      eq(d.escape, { to: 'world', spawn: 'archive_1' }, id + ' escape');
      const f = +id.slice(-1);
      eq(d.lvOff == null ? null : d.lvOff, f >= 2 && f <= 5 ? 2 : null, id + ' lvOff');
      eq(d.encounter, f <= 3 ? 'z_finale_archive_lo' : 'z_finale_archive_hi', id + ' zone');
      ok(d.bgm === 'lastdungeon', id + ' bgm');
    }
    for (const n of d.npcs) ok(n.fixed || n.push, `${id}: npc ${n.id} fixed/push`);
    const ids = new Set();
    for (const c of d.chests) { ok(new RegExp('^' + id + '_c\\d+$').test(c.id), `${id}: chest id ${c.id}`); ok(!ids.has(c.id), 'dup chest ' + c.id); ids.add(c.id); ok(!!c.pool && !c.item, `${id}: chest ${c.id} pool only`); }
    for (const [k, sp] of Object.entries(m.spawns)) ok(passable(m, sp.x, sp.y, false), `${id}: spawn ${k} on floor`);
    // everything reachable from the first spawn (with the story flags of a finished floor)
    const flags = { archive_2: ['final_golem'], archive_4: ['final_shades'], archive_5: ['final_lazaro'], archive_3: ['final_rowell'] }[id] || [];
    const m2 = compileWith(id, ['final_open', 'final_arrived'].concat(flags), ['k_rowell_note']);
    const start = m2.spawns.entrance || m2.spawns.from_prev;
    const seen = bfs(m2, start);
    for (const c of m2.chests) ok(near(seen, c.x, c.y), `${id}: chest ${c.id} reachable`);
    for (const w of m2.warps) if (!w.cond || R.State.check(w.cond)) ok(near(seen, w.x, w.y), `${id}: warp → ${w.to} reachable`);
    for (const n of m2.npcs) if (n.present && n.event) ok(near(seen, n.x, n.y), `${id}: npc ${n.id} reachable`);
    for (const s of m2.signs) ok(near(seen, s.x, s.y), `${id}: sign at ${s.x},${s.y} reachable`);
  }
  // the gates: each boss band is unavoidable before its flag
  const gate = (id, bandId, target, flags, items) => {
    const m = compileWith(id, flags || [], items || []);
    const band = new Set(m.events.filter((e) => e.id === bandId).map((e) => e.x + ',' + e.y));
    ok(band.size > 0, `${id}: band ${bandId}`);
    const seen = bfs(m, m.spawns.from_prev || m.spawns.entrance, { block: band });
    ok(!near(seen, target.x, target.y), `${id}: ${bandId} cannot be walked round (${target.x},${target.y})`);
  };
  gate('archive_2', 'archive_2_boss', { x: 36, y: 2 });
  gate('archive_3', 'archive_3_rowell', { x: 20, y: 2 }, [], ['k_rowell_note']);
  gate('archive_4', 'archive_4_boss', { x: 23, y: 3 });
  gate('archive_5', 'archive_5_lazaro', { x: 29, y: 3 }, ['final_lazaro']);
  gate('archive_6', 'archive_6_boss', { x: 15, y: 9 });
  // the sealed door and the paper seal
  { const m = compileWith('archive_3', []); ok(!m.walkable(19, 4), 'archive_3 door sealed without the note'); }
  { const m = compileWith('archive_3', [], ['k_rowell_note']); ok(m.walkable(19, 4), 'archive_3 door opens with the note'); }
  { const m = compileWith('archive_5', []); ok(!m.walkable(29, 3), 'archive_5 stairs sealed'); }
  { const m = compileWith('archive_5', ['final_lazaro']); ok(m.walkable(29, 3), 'archive_5 stairs open after ラザロ'); }
  // secret passages: one each on archive_2 and archive_4 (§10.6.4), the reward behind them only through it
  for (const [id, chest] of [['archive_2', 'archive_2_c1'], ['archive_4', 'archive_4_c1']]) {
    const m = compileWith(id, ['final_golem', 'final_shades']);
    let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isSecret(x, y)) n++;
    ok(n >= 1 && n <= 3, `${id}: secret passage (${n} tiles)`);
    const c = m.chests.find((cc) => cc.id === chest);
    const s0 = m.spawns.from_prev;
    ok(near(bfs(m, s0), c.x, c.y) && !near(bfs(m, s0, { noSecret: true }), c.x, c.y), `${id}: ${chest} only behind the secret`);
  }
  for (const id of ['archive_1', 'archive_3', 'archive_5', 'archive_6', 'biblia']) { const m = compileWith(id, []); let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.isSecret(x, y)) n++; eq(n, 0, id + ': no secret passage'); }
  // rest lanterns: the middle floor (3F), before ラザロ (5F), before the king (6F)
  for (const id of ['archive_3', 'archive_5', 'archive_6']) ok(DB.maps[id].npcs.some((n) => n.id === 'rest' && n.event === 'common_rest'), id + ': 休息の灯');
  // postgame: the stair down to 忘却の底
  { const m = compileWith('archive_1', []); ok(!m.warpAt(15, 26), 'no stair down before the ending'); }
  { newGame({ tier: 8 }); R.Game.gameClear = true; R.State.setFlag('game_clear'); const m = R.FieldMap.compile('archive_1'); m.refresh(); const w = m.warpAt(15, 26); ok(!!w && w.to === 'oblivion_1' && w.spawn === 'from_prev', 'stair down after the ending'); ok(m.spawns.from_oblivion, 'spawn from_oblivion'); }
  // ビブリア: spawns, services, NPCs of §10.10.2
  { const d = DB.maps.biblia; for (const s of ['entrance', 'inn', 'dock']) ok(!!d.spawns[s], 'biblia spawn ' + s);
    for (const n of ['inn', 'tavern', 'shop_item', 'shop_weapon', 'shop_armor', 'ferry', 'folk_a', 'noa', 'rowell']) ok(d.npcs.some((x) => x.id === n), 'biblia npc ' + n);
    ok(d.npcs.find((x) => x.id === 'ferry').ferryFrom === 'biblia', 'biblia ferryFrom');
    ok(!d.npcs.some((x) => x.id === 'folk_b'), 'biblia has no folk_b');
    newGame({ tier: 8 }); ok(d.bgm === 'sorrow', 'biblia bgm sorrow'); R.Game.gameClear = true; ok(d.bgm === 'town', 'biblia bgm town after the ending'); }

  // ============================================================ S12 the ending / bonus scene API
  section('S12 API');
  ok(typeof R.Ending.start === 'function' && typeof R.Ending.record === 'function', 'R.Ending API');
  const cr = R.Ending.CREDITS.map((c) => c[1]).join('\n');
  for (const s of ['ルミナス・クロニクル', '〜八つの伝承〜', 'Studio Metem', 'DotGothic16', '© Studio Metem', '三人の勇者を名付けてくれたあなたへ']) ok(cr.includes(s), 'credits: ' + s);
  ok(R.Postgame && typeof R.Postgame.bonusScene === 'function' && R.Postgame.PAGES.length >= 4, 'R.Postgame.bonusScene');
  for (const p of R.Postgame.PAGES) lintPage(p, 'postgame page');
  // E6: ロウェル's words word for word (§10.11), ラザロ beside ミラ's portrait
  eq(R.Ending.AFTER.rowell.join('').replace(/[「」]/g, ''), 'おれは、自分の足で伝承を集めてみる。書くためじゃなく、覚えて、語るために。', 'E6 ロウェル');
  ok(/ミラの肖像画/.test(R.Ending.AFTER.lazaro.join('')) && /書き写/.test(R.Ending.AFTER.lazaro.join('')), 'E6 ラザロ');
  for (const ln of R.Ending.AFTER.rowell.concat(R.Ending.AFTER.lazaro)) ok(ln.length <= 15, 'E6 card line fits beside the figure: ' + ln);
  // §10.10.3 / §11.2.11: every floor of the archive is theme library, BGM lastdungeon
  for (let n = 1; n <= 6; n++) { const d = DB.maps['archive_' + n]; eq(d.theme, 'library', 'archive_' + n + ' theme'); eq(d.bgm, 'lastdungeon', 'archive_' + n + ' bgm'); }

  console.log(`test_story: ${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
