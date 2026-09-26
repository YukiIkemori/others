#!/usr/bin/env node
// test_oblivion.js (owner OB) — unit tests of 忘却の底 (DESIGN §10.12) against the real sources in node.
//   node tools/test_oblivion.js      exit 1 on any failure
//
//   T1  kit data hooks: the 4F den zone (copy of z_postgame_oblivion_hi, rare ×3); the 1F up stairs follow
//       archive_1's post-game spawn, and fall back to its entrance when that spawn is missing
//   T2  the floors compile through R.FieldMap with a live game: the 3F seal opens with pg_echo, the secret
//       passages are walkable, 4F den / 5F circle zones, the boss NPCs stay present for the rematches
//   T3  event scripts with a stand-in ev (every message resolves at once; battles return what the test says):
//       arrivals (once), 魔王の残影 (win / lose / rematch yes-no), the seal, the loop (var, warp, hint),
//       円環竜 (win → pg_ouroboros, pg_clear, 大語り部, obj_s_pg_clear, the 外伝 caption; lose; rematch)
//   T4  the real battle setup (R.Battle.resolveMonsters, seeded): tier 9, the den's rare rate ≈ 3× the hi zone's,
//       the bosses resolve to tier 9 troops
//   T5  text shape of every string on the floors and in the events: ≤ 20 full-width per line ({hero} = 5),
//       ≤ 4 lines per page (STYLE_JA §1)
//   T6  the theme-area shim answers a plain cell of a theme area with that theme's tile and leaves other maps alone
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/load')({ quiet: true });

const DB = R.DB, K = R.Oblivion;
let pass = 0, fail = 0;
const fails = [];
function t(name, cond, msg) {
  if (cond) pass++;
  else { fail++; fails.push(`FAIL ${name}${msg ? ': ' + msg : ''}`); }
}

// ------------------------------------------------------------------ T1 kit hooks
{
  t('T1 den zone', DB.encounters[K.ZONE_DEN] && DB.encounters[K.ZONE_DEN].tier === 9);
  const hi = DB.rareEncounters[K.ZONE_HI], den = DB.rareEncounters[K.ZONE_DEN];
  t('T1 den rare', den && den.mon === hi.mon && den.rate === Math.round(hi.rate / 3), JSON.stringify(den));
  const f1 = DB.maps.oblivion_1;
  const up = f1.warps.find((w) => w.to === 'archive_1');
  const a1 = DB.maps.archive_1;
  const hasSpawn = !!(a1 && a1.spawns && a1.spawns[K.ARCHIVE_SPAWN]);
  t('T1 up stairs spawn', up && up.spawn === (hasSpawn ? K.ARCHIVE_SPAWN : 'entrance'), up && up.spawn);
  // without archive_1's spawn the stairs lead to its entrance, and back again once it exists
  const saved = DB.maps.archive_1;
  DB.maps.archive_1 = { spawns: { entrance: { x: 1, y: 1 } } };
  K.hooks.archiveReturn();
  t('T1 fallback entrance', up.spawn === 'entrance', up.spawn);
  DB.maps.archive_1 = { spawns: { entrance: { x: 1, y: 1 }, from_oblivion: { x: 2, y: 2 } } };
  K.hooks.archiveReturn();
  t('T1 from_oblivion', up.spawn === 'from_oblivion', up.spawn);
  DB.maps.archive_1 = saved;
  K.hooks.archiveReturn();
  // registerDen is idempotent and never overwrites
  const before = JSON.stringify(DB.rareEncounters[K.ZONE_DEN]);
  K.hooks.registerDen();
  t('T1 den idempotent', JSON.stringify(DB.rareEncounters[K.ZONE_DEN]) === before);
}

// ------------------------------------------------------------------ T2 FieldMap with a live game
{
  R.State.newGame();
  R.Game.gameClear = true;
  R.State.setFlag('game_clear', true);
  const f3 = R.FieldMap.compile('oblivion_3');
  t('T2 seal closed', f3.tileAt(31, 4) === 'seal', f3.tileAt(31, 4));
  t('T2 seal blocks', !f3.walkable(31, 4));
  R.State.setFlag('pg_echo', true);
  f3.refresh();
  t('T2 seal open', f3.tileAt(31, 4) === 'floor' && f3.walkable(31, 4), f3.tileAt(31, 4));
  const boss3 = f3.npcs.find((n) => n.id === 'boss');
  t('T2 echo stays for the rematch', boss3 && boss3.present);
  const band = f3.events.filter((e) => e.id === 'oblivion_3_echo');
  t('T2 band off after pg_echo', band.length === 4 && band.every((e) => !R.State.check(e.cond)));
  const f2 = R.FieldMap.compile('oblivion_2'), f4 = R.FieldMap.compile('oblivion_4');
  t('T2 2F secret walkable', f2.tileAt(21, 35) === 'secret_wall' && f2.walkable(21, 35));
  t('T2 4F secret walkable', f4.tileAt(25, 4) === 'secret_wall' && f4.walkable(25, 4));
  t('T2 4F den zone', f4.zoneAt(30, 4) === K.ZONE_DEN && f4.zoneAt(10, 16) === K.ZONE_HI);
  t('T2 4F loop spawn', f4.spawns.loop && f4.spawns.loop.x === 5 && f4.spawns.loop.y === 16);
  const f5 = R.FieldMap.compile('oblivion_5');
  t('T2 5F bed', f5.zoneAt(20, 20) == null && f5.zoneAt(20, 18) == null && f5.zoneAt(2, 20) === K.ZONE_HI && f5.zoneAt(20, 38) === K.ZONE_HI);
  R.State.setFlag('pg_clear', true); R.State.setFlag('pg_ouroboros', true);
  f5.refresh();
  t('T2 dragon stays for the rematch', f5.npcs.find((n) => n.id === 'boss').present);
  t('T2 band off after pg_ouroboros', f5.events.filter((e) => e.id === 'oblivion_5_ouroboros').every((e) => !R.State.check(e.cond)));
  // each floor's theme art key exists for the tiles it uses (the field draws them)
  for (const id of K.MAPS) {
    const m = R.FieldMap.compile(id);
    t('T2 ' + id + ' name', /^忘却の底　[1-5]階$/.test(m.name), m.name);
  }
}

// ------------------------------------------------------------------ T3 event scripts
function fakeEv(o) {
  o = o || {};
  const log = { say: [], caption: [], battles: [], warps: [], hidden: [], objective: null, yes: 0, jingles: [], faded: 0 };
  const flags = o.flags || {}, vars = o.vars || {};
  const npcs = {};
  const ev = {
    log, flags, vars,
    async say(t) { log.say.push(String(t)); }, async caption(t) { log.caption.push(String(t)); },
    async yesno(t) { log.say.push(String(t)); log.yes++; return o.yes !== false; },
    async ask() { return 0; }, closeMessage() {}, async wait() {}, async shake() {}, async flash() {}, async fadeOut() { log.faded++; }, async fadeIn() {},
    sfx() {}, bgm() {}, jingle(id) { log.jingles.push(id); return Promise.resolve(); },
    flag(n) { return !!flags[n]; }, setFlag(n, v = true) { flags[n] = v; }, var(n) { return vars[n] || 0; }, setVar(n, v) { vars[n] = v; },
    check() { return true; }, refresh() { log.refreshed = (log.refreshed || 0) + 1; },
    async battle(troop, opts) { log.battles.push({ troop, opts }); return o.result || 'win'; },
    async warp(map, spawn, opts) { log.warps.push({ map, spawn, opts }); },
    npc(id) {
      const h = npcs[id] || (npcs[id] = { id, visible: true, dir: 'down', face(d) { h.dir = d; return h; }, hide() { h.visible = false; log.hidden.push(id); return h; }, show() { h.visible = true; return h; }, async walk() {} });
      return h;
    },
    setObjective(id) { log.objective = id; },
  };
  return ev;
}
async function run(id, o) {
  const ev = fakeEv(o);
  const ret = await DB.events[id].run(ev);
  return { ev, ret, log: ev.log, flags: ev.flags };
}
async function T3() {
  // arrivals
  for (const n of [1, 2, 3, 4, 5]) {
    const id = `oblivion_${n}_arrival`;
    const a = await run(id);
    t('T3 ' + id + ' first', a.flags[id] === true && a.log.caption.length === 1 && a.log.say.length >= 1);
    const b = await run(id, { flags: { [id]: true } });
    t('T3 ' + id + ' once', b.log.caption.length === 0 && b.log.say.length === 0);
  }
  const a1 = await run('oblivion_1_arrival');
  t('T3 1F caption', /忘れられた者の岸/.test(a1.log.caption[0]));
  // 魔王の残影
  const e1 = await run('oblivion_3_echo');
  t('T3 echo battle', e1.log.battles.length === 1 && e1.log.battles[0].troop === 'tr_b_valzard_echo' && e1.log.battles[0].opts.noEscape === true);
  t('T3 echo lines', e1.log.say.some((s) => s === '……ヴァルザード……\nそれが、われの名であったか。') && e1.log.say.some((s) => s === '三百年……忘れられてなお、\n恐れだけが残った……。') && e1.log.say.includes('光の……紋章……。'));
  t('T3 echo win', e1.flags.pg_echo === true && e1.log.hidden.includes('boss') && e1.log.refreshed >= 1);
  const e2 = await run('oblivion_3_echo', { result: 'lose' });
  t('T3 echo lose', e2.ret === false && !e2.flags.pg_echo);
  const e3 = await run('oblivion_3_echo', { result: 'escape' });
  t('T3 echo escape', e3.ret === false && !e3.flags.pg_echo);
  const r1 = await run('oblivion_3_echo', { flags: { pg_echo: true }, yes: false });
  t('T3 echo rematch no', r1.log.yes === 1 && r1.log.battles.length === 0);
  const r2 = await run('oblivion_3_echo', { flags: { pg_echo: true } });
  t('T3 echo rematch yes', r2.log.battles.length === 1 && r2.log.battles[0].troop === 'tr_b_valzard_echo' && r2.log.hidden.includes('boss'));
  t('T3 echo rematch asks', r2.log.say.includes('もう一度挑みますか？'));
  // seal
  const s1 = await run('oblivion_3_seal');
  t('T3 seal before', s1.log.say.length === 2);
  const s2 = await run('oblivion_3_seal', { flags: { pg_echo: true } });
  t('T3 seal after', s2.log.say.length === 0);
  // loop
  const l1 = await run('oblivion_4_loop');
  t('T3 loop warp', l1.log.warps.length === 1 && l1.log.warps[0].map === 'oblivion_4' && l1.log.warps[0].spawn === 'loop' && l1.ev.vars.oblivion_4_loops === 1);
  t('T3 loop line', l1.log.say.length === 1);
  const l3 = await run('oblivion_4_loop', { vars: { oblivion_4_loops: 2 } });
  t('T3 loop hint', l3.ev.vars.oblivion_4_loops === 3 && l3.log.say.length === 3);
  // 円環竜オウロボラ
  const o1 = await run('oblivion_5_ouroboros');
  t('T3 dragon battle', o1.log.battles.length === 1 && o1.log.battles[0].troop === 'tr_b_ouroboros' && o1.log.battles[0].opts.noEscape === true);
  t('T3 dragon voice', o1.log.say.includes('ここは、終わらない物語が\n沈む場所。') && o1.log.say.includes('その竜は物語の終わりを食べて、\n同じ話を永遠にくり返させるの。'));
  t('T3 dragon win', o1.flags.pg_ouroboros === true && o1.flags.pg_clear === true && o1.log.objective === 'obj_s_pg_clear');
  t('T3 title', R.Game.title === '大語り部', R.Game.title);
  t('T3 unraveled', o1.log.say.includes('円環が、ほどけた……。') && o1.log.caption.some((c) => c === '年代記に、外伝『円環の竜』が\n記された。'));
  t('T3 chapter jingle', o1.log.jingles.includes('chapter'));
  R.Game.title = '';
  const o2 = await run('oblivion_5_ouroboros', { result: 'lose' });
  t('T3 dragon lose', o2.ret === false && !o2.flags.pg_clear && !o2.flags.pg_ouroboros && R.Game.title === '');
  const o3 = await run('oblivion_5_ouroboros', { flags: { pg_clear: true, pg_ouroboros: true } });
  t('T3 dragon rematch', o3.log.battles.length === 1 && o3.log.say.includes('もう一度挑みますか？') && o3.log.caption.length === 0);
  const o4 = await run('oblivion_5_ouroboros', { flags: { pg_ouroboros: true } });
  t('T3 dragon resume', o4.log.battles.length === 0 && o4.flags.pg_clear === true && o4.log.objective === 'obj_s_pg_clear');
  // meta
  t('T3 meta echo', JSON.stringify(DB.events.oblivion_3_echo.meta.gives) === JSON.stringify(['flag:pg_echo']));
  t('T3 meta dragon', DB.events.oblivion_5_ouroboros.meta.gives.includes('flag:pg_clear'));
  t('T3 meta loop', DB.events.oblivion_4_loop.meta.warp.spawn === 'loop');
}

// ------------------------------------------------------------------ T4 battle setup
function T4() {
  const B = R.Battle;
  if (!B || !B.resolveMonsters) { t('T4 R.Battle.resolveMonsters', false); return; }
  const N = 12000;
  const rate = (zone) => {
    R.U.seed(20260926);
    let rare = 0, tier = null, lb = 0;
    for (let i = 0; i < N; i++) {
      const r = B.resolveMonsters({ zone }, { mods: {} });
      if (r && r.rare) rare++;
      if (r) { tier = r.Tb; lb = Math.max(lb, r.Lb); }
    }
    R.U.unseed();
    return { p: rare / N, tier, lb };
  };
  const hi = rate(K.ZONE_HI), den = rate(K.ZONE_DEN), lo = rate(K.ZONE_LO);
  t('T4 tier 9', hi.tier === 9 && den.tier === 9 && lo.tier === 9, `${hi.tier} ${den.tier} ${lo.tier}`);
  const ratio = den.p / hi.p;
  t('T4 den ×3', ratio > 2.3 && ratio < 3.8, `den ${den.p.toFixed(4)} hi ${hi.p.toFixed(4)} ratio ${ratio.toFixed(2)}`);
  t('T4 lo 1/80', lo.p > 1 / 110 && lo.p < 1 / 60, lo.p.toFixed(4));
  for (const tr of ['tr_b_valzard_echo', 'tr_b_ouroboros']) {
    const r = B.resolveMonsters({ troop: tr }, { mods: {} });
    t('T4 ' + tr, r && r.Tb === 9 && r.mons.length === 1, r && JSON.stringify(r.mons));
  }
  T4.out = `rare per zone battle: lo ${(lo.p * 100).toFixed(2)}% · hi ${(hi.p * 100).toFixed(2)}% · den ${(den.p * 100).toFixed(2)}% (×${ratio.toFixed(2)}), seed 20260926, ${N} draws each`;
}

// ------------------------------------------------------------------ T5 text shape
function width(line) {
  let w = 0;
  const s = line.replace(/\{hero\}/g, '　　　　　').replace(/\{leader\}/g, '　　　　　');
  for (const ch of s) w += /[\x20-\x7e]/.test(ch) ? 0.5 : 1;
  return w;
}
function T5() {
  const strings = [];
  for (const id of K.MAPS) for (const s of DB.maps[id].signs || []) for (const p of [].concat(s.text)) strings.push([id, p]);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'events', 'oblivion.js'), 'utf8');
  const re = /'((?:[^'\\\n]|\\.)*[　-鿿][^'\n]*)'/g;
  let m;
  while ((m = re.exec(src))) strings.push(['events', m[1].replace(/\\n/g, '\n')]);
  let n = 0;
  for (const [where, p] of strings) {
    for (const page of p.split('\f')) {
      const lines = page.split('\n');
      t('T5 lines ' + where, lines.length <= 4, JSON.stringify(page));
      for (const l of lines) { n++; t('T5 width ' + where, width(l) <= 20, `${width(l)}: ${l}`); }
    }
  }
  T5.out = `${strings.length} strings, ${n} lines checked`;
}

// ------------------------------------------------------------------ T6 the theme-area shim
function T6() {
  const A = R.Art, G = R.Gfx;
  const origLocal = A.localTile, origHas = G.has, origGet = G.get;
  try {
    A.localTile = function () { return null; };
    G.has = (k) => k === 'tile:forest:floor';
    G.get = (k) => ({ key: k });
    K.patchAreas();
    const m = { def: { themeAreas: [{ x: 0, y: 0, w: 2, h: 2, theme: 'forest' }] }, theme: 'oblivion', tileAt: () => 'floor' };
    const g = A.localTile(m, 1, 1);
    t('T6 area cell', g && g.key === 'tile:forest:floor', JSON.stringify(g));
    t('T6 outside area', A.localTile(m, 5, 5) === null);
    t('T6 other maps', A.localTile({ def: {}, theme: 'cave', tileAt: () => 'floor' }, 0, 0) === null);
    t('T6 once', A.localTile._obAreas === true);
  } finally { A.localTile = origLocal; G.has = origHas; G.get = origGet; }
}

(async () => {
  await T3();
  T4();
  T5();
  T6();
  for (const f of fails) console.log(f);
  console.log(`test_oblivion: ${pass} passed, ${fail} failed`);
  if (T4.out) console.log('  ' + T4.out);
  if (T5.out) console.log('  ' + T5.out);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
