#!/usr/bin/env node
// QA: 通しの遊び（V2_PLAN §3.16 の 1・11）。タイトル → 作成 → 序章 → 森の解決 → T1 の場面を、入力の真似だけで 5 本通す。
//
//   node v2/tools/qa/playthrough.js --route all|R1|R2,R3 [--phone] [--jobs 2] [--max-min 90] [--dist v2/dist] [--shots]
//
// ページは dist/index.html（遊ぶ用、dev の物なし）。tools/lib/maps.js と tools/qa/bot.js をページに入れ、ループを止めて
// R.Engine.step(33 ms) で進める（時間で動く場面はそのまま、壁の時計だけ速い）。ボタンは R.Input._set（CORE のテスト用の口）。
// 手は画面の状態だけを読む: 一番上の場面、一覧の index、会話の選択肢、戦闘の st.ui、FIELD の位置。目標はイベントの id で書き、
// どこでそのイベントが走るか（人・調べる物・範囲）は maps.js が地図から探し、FIELD の当たりで道を引く。
// 戦闘の命令は R.BattleAI.partyCommand(B, uid, 'script')（sim の台本と同じ手）を、一覧の上下とねらいの ↓ で選ぶ。
// 設定は遊ぶ人が変えられる物だけ（文字 一瞬・戦闘 ×3・常にダッシュ）。書き出し: v2/design/qa/playthrough/<本>.json
// 各本の終わりに: §2.5.3 の不変条件・森の目印が外れている・年代記の章の文が選択どおり・最後に見つけた人の一品物・仮の実装 0・エラー 0。
// R1 は序章と森の時間の見積もり（§3.16 の 11: 歩数 × 0.25 秒 ＋ 戦闘数 × 40 秒（ボスは rounds × 12 秒）＋ 字数 × 0.08 秒 ＋ 操作 1 回 1 秒）も出す。
'use strict';
const fs = require('fs');
const path = require('path');
const Bw = require('../lib/browser');

const V2 = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(V2, 'design', 'qa', 'playthrough');

// ================================================================ 台本
const SETTINGS = { textSpeed: 'instant', battleSpeed: 3, alwaysDash: true };
function prologue(o) {
  o = o || {};
  const g = [
    { id: 'berna', ev: 'roa_berna', done: 'prologue_berna' },
    { id: 'farmer', ev: 'roa_farmer', done: 'prologue_farmer', optional: true },
    { id: 'party', ev: 'pharos_tavern_master', done: 'prologue_party' },
  ];
  if (o.r5) {
    g.push({ id: 'save_s1', task: { kind: 'save', slot: 's1' } });
    g.push({ id: 'suspend_load', task: { kind: 'suspend', title: 'load', slot: 's1' } });
  }
  g.push(
    { id: 'rowell', ev: 'pharos_rowell', done: 'prologue_rowell', optional: true },
    { id: 'otto', ev: 'pharos_otto', done: 'prologue_key' },
    { id: 'shop_pharos_arms0', ev: 'pharos_smithy', shop: true, optional: true },
    { id: 'tutorial', ev: 'lighthouse_1_tutorial', done: 'prologue_tutorial' },
    // 人は寄り道しながら歩くので、序章の戦闘は 35 前後（V2_PLAN §3.9 の sim_glimmer の模型）。台本は最短の道なので、灯台で足りない分を戦う
    { id: 'grind_prologue', grind: 24, optional: true },
    { id: 'fine_lh', ev: 'lighthouse_3_fine', done: 'prologue_fine', optional: true },
    { id: 'spring_lh', spring: ['lighthouse_3'], optional: true, noHeal: true },
    Object.assign({ id: 'boss_pageeater', ev: 'lighthouse_3_boss', done: 'prologue_boss' }, o.loseBoss ? { lose: true, wipeTo: 'retry' } : {}),
    { id: 'departure', ev: 'pharos_departure', done: 'prologue_done' },
    { id: 'shop_pharos_arms', ev: 'pharos_smithy', shop: true, optional: true },
    { id: 'shop_pharos_items', ev: 'pharos_shopkeeper', shop: true, optional: true },
  );
  return g;
}
const RESCUE = {
  hans: [{ id: 'axe', ev: 'verda_axe', done: 'forest_got_axe' }, { id: 'log', ev: 'verda_log', done: 'forest_log_cut' }, { id: 'hans', ev: 'verda_hans', done: 'forest_found_hans' }],
  ben: [{ id: 'ben', ev: 'verda_ben', done: 'forest_found_ben' }],
  roy: [{ id: 'flute', ev: 'verda_flute', done: 'forest_got_flute' }, { id: 'roy', ev: 'verda_hollow', done: 'forest_found_roy' }],
  pim: [{ id: 'pim', ev: 'verda_pim', done: 'forest_found_pim' }],
};
function forest(o) {
  o = o || {};
  const g = [
    { id: 'fern', ev: 'fern_arrival', done: 'forest_start' },
    { id: 'board', ev: 'fern_board', done: 'forest_board' },
    { id: 'gord', ev: 'fern_gord', done: 'forest_gord_talked' },
    { id: 'katri', ev: 'fern_pim_mother', doneJs: "!!(G().items.k_pim_hat) || R.State.check('forest_found_pim')" },
    { id: 'rita', ev: 'fern_rita', done: 'forest_rita_talked' },
    { id: 'shop_fern_peddler', ev: 'fern_peddler', shop: true, optional: true },
    { id: 'shop_fern_items', ev: 'fern_shop_keeper', shop: true, optional: true },
  ];
  if (o.r5) g.push({ id: 'suspend_resume', task: { kind: 'suspend', title: 'continue' } });
  if (o.wipeZako) g.push({ id: 'arm_wipe_zako', setLose: { zako: true, map: 'verda' }, wipeTo: 'inn' });
  let first = true;
  for (const who of o.order || ['hans', 'ben', 'roy', 'pim']) for (const s of RESCUE[who]) {
    g.push(Object.assign({}, s, { ordered: !!o.strict }));
    // 森の本筋の戦闘は 95 前後（sim_glimmer の模型）。最初の持ち物を拾った迷いの森で、足りない分を戦う
    if (first) { g.push({ id: 'grind_forest', grind: 60, optional: true }); first = false; }
  }
  g.push(
    { id: 'stone_a', ev: 'verda_stone_a', done: 'forest_stone_a' },
    { id: 'stone_b', ev: 'verda_stone_b', done: 'forest_stone_b' },
    { id: 'spring_v2', spring: ['verda_2'], optional: true, noHeal: true },
    { id: 'moth', ev: 'verda_moth', done: 'forest_moth' },
    { id: 'stone_c', ev: 'verda_stone_c', done: 'forest_stone_c' },
    { id: 'shop_fern_peddler2', ev: 'fern_peddler', shop: true, optional: true },
    { id: 'shop_fern_items2', ev: 'fern_shop_keeper', shop: true, optional: true },
    { id: 'elder_fine', ev: 'elder_fine', done: 'forest_fine', optional: true },
    { id: 'grind_elder', grind: 85, optional: true },
    { id: 'spring_elder', spring: ['elder_2'], optional: true, noHeal: true },
    Object.assign({ id: 'boss_rooteater', ev: 'elder_boss', done: 'cleared_r_forest' }, o.loseBoss ? { lose: true, wipeTo: 'retry' } : {}),
    { id: 'unique', ev: 'fern_after', done: 'forest_unique_given' },
    { id: 't1', ev: 'fern_inn_keeper', done: 'story_t1', maxTries: 3 },
  );
  return g;
}
const CH = (pim, fawn, write) => [
  { re: 'ピムを ?どうする', pick: pim === 'take' ? '連れて' : '送り' },
  { re: '小鹿|手当て', pick: fawn === 'heal' ? '手当て' : 'そっと' },
  { re: '年代記に ?何を', pick: write === 'oath' ? 'エルム' : '火が森' },
  { re: '泊まっていく|泊まる', pick: '泊まる' },
  { re: '斧で払う', pick: '斧' }, { re: '呼び笛', pick: '吹く' },
];
const ROUTES = {
  R1: { hero: { type: 'warrior', sex: 'm' }, party: ['bartolo', 'marta', 'sylvain'], pim: 'send', fawn: 'heal', write: 'pain',
    goals: () => prologue({ loseBoss: true }).concat(forest({ order: ['hans', 'ben', 'roy', 'pim'], strict: true })), estimate: true },
  R2: { hero: { type: 'ranger', sex: 'f' }, party: ['selma', 'hagen', 'viola'], pim: 'take', fawn: 'leave', write: 'oath',
    goals: () => prologue().concat(forest({ order: ['pim', 'roy', 'ben', 'hans'], strict: true, wipeZako: true })) },
  R3: { hero: { type: 'mage', sex: 'f' }, party: ['dokka', 'basil', 'titta'], pim: 'send', fawn: 'leave', write: 'pain',
    goals: () => prologue().concat(forest({ order: ['ben', 'pim', 'hans', 'roy'] })) },
  R4: { hero: { type: 'spellblade', sex: 'm' }, party: ['brigitta', 'zafira', 'teo'], pim: 'take', fawn: 'heal', write: 'oath',
    goals: () => prologue().concat(forest({ order: ['roy', 'hans', 'pim', 'ben'], loseBoss: true })) },
  R5: { hero: { type: 'wanderer', sex: 'f' }, party: ['rouga', 'noela', 'ilse'], pim: 'send', fawn: 'heal', write: 'oath',
    goals: () => prologue({ r5: true }).concat(forest({ order: ['hans', 'roy', 'ben', 'pim'], r5: true })) },
};
function routeDef(id) {
  const r = ROUTES[id];
  return { id, hero: r.hero, party: r.party, settings: SETTINGS, choices: CH(r.pim, r.fawn, r.write), goals: r.goals(), expect: { pim: r.pim, fawn: r.fawn, write: r.write } };
}

// ================================================================ 1 本
async function runRoute(S, id, o) {
  const route = routeDef(id);
  let P = null;
  for (let k = 0; k < 3 && !P; k++) { try { P = await Bw.open(S, 'index.html', { phone: o.phone, size: o.phone ? null : [960, 540], timeout: 180000 }); } catch (e) { console.log(`[${id}] open failed (${k + 1}): ${String(e).slice(0, 120)}`); } }
  if (!P) return { route: id, ok: false, checks: {}, status: { fail: 'page did not boot' }, errors: [] };
  const page = P.page;
  const t0 = Date.now();
  const res = { route: id, phone: !!o.phone, ok: false, checks: {}, errors: P.errors, started: new Date().toISOString() };
  try {
    await page.addScriptTag({ content: fs.readFileSync(path.join(V2, 'tools', 'lib', 'maps.js'), 'utf8') });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8') });
    await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id === 'screen:title'", null, { timeout: 180000 });
    await page.evaluate((r) => window.__bot.setup(r), route);
    const maxMs = (+o.maxMin || 90) * 60000;
    let st = null, lastGoal = null, lastLog = 0;
    for (;;) {
      st = await page.evaluate(() => window.__bot.run(600));
      if (st.goal !== lastGoal || Date.now() - lastLog > 30000) {
        lastGoal = st.goal; lastLog = Date.now();
        console.log(`[${id}] ${((Date.now() - t0) / 1000).toFixed(0)}s goal=${st.goal} top=${st.top} ${st.pos || ''} steps=${st.steps} battles=${st.battles} gold=${st.gold} hp=${st.hp}${st.round != null ? ' round=' + st.round : ''} f=${st.frames}`);
      }
      try { fs.writeFileSync(path.join(OUT, `${id}${o.phone ? '_phone' : ''}.live.log`), (await page.evaluate(() => window.__bot.log.slice(-60).map((l) => l.f + ' ' + l.msg).join('\n'))) + '\n'); } catch (e) { /* */ }
      if (st.engineError && !res.engineError) { res.engineError = st.engineError; console.log(`[${id}] ENGINE ERROR ${st.engineError}`); }
      if (st.done || st.fail) break;
      if (Date.now() - t0 > maxMs) { st.fail = 'wall-clock limit ' + o.maxMin + ' min'; break; }
      if (P.errors.length > 30) { st.fail = 'too many page errors'; break; }
    }
    res.status = st;
    // 終わりの確かめの前に、走っている会話・イベントを最後まで進める（フィールドに戻るまで A）
    if (st.done) await page.evaluate(() => window.__bot.settle(900));
    // 終わりの確かめ
    const fin = await page.evaluate((exp) => {
      const R = window.RPG, G = R.Game, B = window.__bot;
      // 目標が終わった直後はまだ会話の途中のことがある: 不変条件はフィールドに戻ってから
      const t = R.Engine.top();
      const inv = { top: t && t.id, locks: Object.keys(R.Field.locks ? R.Field.locks() : {}), busy: R.Events.busy(), fade: R.Engine.fade.a, input: R.Input.enabled, msg: R.UIK.Message.busy() };
      inv.ok = inv.top === 'field' && !inv.locks.length && !inv.busy && inv.fade < 0.01 && inv.input && !inv.msg;
      const leads = Object.entries((G && G.leads) || {}).filter(([k]) => (R.DB.leads[k] || {}).region === 'r_forest');
      const pinned = leads.filter(([, v]) => v && v.pin).map(([k]) => k);
      const ch = R.DB.chronicle && R.DB.chronicle.r_forest ? R.DB.chronicle.r_forest.text : '';
      const uniq = ['u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap'].filter((k) => (G.items[k] || 0) > 0 || R.Party.members().some((c) => Object.values(c.equip || {}).includes(k)));
      const lastWho = ['hans', 'ben', 'roy', 'pim'].map((w) => [w, G.vars['forest_order_' + w] || 0]).sort((a, b) => b[1] - a[1])[0][0];
      const order = ['hans', 'ben', 'roy', 'pim'].map((w) => [w, G.vars['forest_order_' + w] || 0]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      return {
        inv, pinned, chronicle: ch, uniq, lastWho, order,
        choices: Object.assign({}, G.choices), cleared: !!(G.cleared && G.cleared.r_forest), t1: !!G.flags.story_t1, tier: G.tier,
        hero: G.chars && G.chars.hero ? { type: G.chars.hero.type, sex: G.chars.hero.sex, name: G.chars.hero.name } : null, party: G.party.slice(),
        stubs: R.Stubs.report ? R.Stubs.report() : [], loadErrors: R.loadErrors.slice(), playMs: G.playMs, steps: G.steps, gold: G.gold,
        stats: B.stats, phaseAt: B.phaseAt, log: B.log.slice(-400), dev: typeof R.Dev !== 'undefined',
      };
    }, route.expect);
    res.final = fin;
    const C = res.checks;
    const e = route.expect;
    const want = { R1: 'pain', R2: 'oath', R3: 'pain', R4: 'oath', R5: 'oath' }[id];
    C.reachedT1 = !!(fin.cleared && fin.t1);
    C.invariants = fin.inv.ok;
    C.forestPinsCleared = fin.pinned.length === 0;
    C.choices = fin.choices.ch_forest_pim === e.pim && fin.choices.ch_forest_fawn === e.fawn && fin.choices.ch_forest_write === want;
    const PIM = { send: '家へ帰し', take: 'ともに森を' }, WR = { pain: '語り部のともした火', oath: '村は歌でその眠りを守った' };
    C.chronicleText = fin.chronicle.includes(PIM[e.pim]) && fin.chronicle.includes(WR[want]) && (e.fawn === 'heal') === fin.chronicle.includes('小鹿');
    const U = { hans: 'u_hans_axe', ben: 'u_ben_whistle', roy: 'u_roy_charm', pim: 'u_pim_cap' };
    C.uniqueFromLast = fin.uniq.includes(U[fin.lastWho]);
    C.hero = !!fin.hero && fin.hero.type === ROUTES[id].hero.type && fin.hero.sex === ROUTES[id].hero.sex;
    C.party = ROUTES[id].party.every((p) => fin.party.includes(p));
    C.stubs0 = fin.stubs.length === 0;
    C.loadErrors0 = fin.loadErrors.length === 0;
    C.consoleErrors0 = P.errors.length === 0;
    C.noEngineError = !res.engineError;
    C.noDev = !fin.dev;
    const expOrder = { R1: ['hans', 'ben', 'roy', 'pim'], R2: ['pim', 'roy', 'ben', 'hans'] }[id];
    if (expOrder) C.rescueOrder = fin.order.join() === expOrder.join();
    const W = fin.stats.wipes;
    if (id === 'R1') C.wipeRetryPageeater = W.some((w) => /pageeater/.test(w.battle) && w.to === 'retry');
    if (id === 'R4') C.wipeRetryRooteater = W.some((w) => /rooteater/.test(w.battle) && w.to === 'retry');
    if (id === 'R2') { const w = W.find((x) => x.to === 'inn'); C.wipeInnHalfGold = !!(w && w.after && w.after.gold === Math.floor(w.gold / 2)); res.wipe = w || null; }
    if (id === 'R5') { const L = fin.log.map((l) => l.msg).join('\n'); C.saveLoadSuspendResume = /saved s1/.test(L) && /task .*"title":"load"/.test(L) && /task .*"title":"continue"/.test(L) && fin.phaseAt && true; }
    if (ROUTES[id].estimate) res.estimate = estimate(fin);
    res.ok = !st.fail && Object.values(C).every(Boolean);
  } catch (err) {
    res.status = res.status || {};
    res.status.fail = res.status.fail || 'harness: ' + (err.stack || err);
  } finally {
    try { if (o.shots) await Bw.shot(page, path.join(OUT, `${id}${o.phone ? '_phone' : ''}_end.png`)); } catch (e) { /* */ }
    res.wallSec = Math.round((Date.now() - t0) / 1000);
    await P.close();
  }
  return res;
}

/** §3.16 の 11: 歩数 × 0.25 秒 ＋ 戦闘数 × 40 秒（ボスは rounds × 12 秒）＋ 字数 × 0.08 秒 ＋ 操作 1 回 1 秒 */
function estimate(fin) {
  const K = { step: 0.25, battle: 40, bossRound: 12, char: 0.08, op: 1 };
  const P = fin.phaseAt;
  const seg = (a, b) => {
    if (!P[a] || !P[b]) return null;
    const bs = fin.stats.battles.filter((x) => x.f >= P[a].f && x.f < P[b].f);
    const zako = bs.filter((x) => !x.boss).length;
    const bossR = bs.filter((x) => x.boss).reduce((s, x) => s + (x.rounds || 0), 0);
    const steps = P[b].steps - P[a].steps, chars = P[b].chars - P[a].chars, ops = P[b].ops - P[a].ops;
    const sec = steps * K.step + zako * K.battle + bossR * K.bossRound + chars * K.char + ops * K.op;
    return { steps, zako, bosses: bs.filter((x) => x.boss).map((x) => `${x.troop}:${x.rounds}r`), chars, ops, hours: +(sec / 3600).toFixed(2), playHours: +(((P[b].playMs || 0) - (P[a].playMs || 0)) / 3600000).toFixed(2) };
  };
  return { K, prologue: seg('start', 'prologue_done'), forest: seg('prologue_done', 'cleared'), target: { prologue: [1.5, 2], forest: [2.5, 3.5] } };
}

async function main() {
  const which = arg('--route', 'all');
  const ids = which === 'all' ? Object.keys(ROUTES) : which.split(',');
  const jobs = Math.max(1, +arg('--jobs', 2));
  const o = { phone: argv.includes('--phone'), maxMin: +arg('--max-min', 90), shots: argv.includes('--shots') };
  fs.mkdirSync(OUT, { recursive: true });
  const S = await Bw.start({ dist: arg('--dist', undefined) });
  const results = [];
  const queue = ids.slice();
  await Promise.all(Array.from({ length: Math.min(jobs, ids.length) }, async (_, w) => {
    await new Promise((r) => setTimeout(r, w * 20000));   // 起動を少しずらす
    while (queue.length) {
      const id = queue.shift();
      const r = await runRoute(S, id, o);
      results.push(r);
      fs.writeFileSync(path.join(OUT, `${id}${o.phone ? '_phone' : ''}.json`), JSON.stringify(r, null, 1));
      console.log(`[${id}] ${r.ok ? 'PASS' : 'FAIL'} ${r.wallSec}s ${r.status && r.status.fail ? r.status.fail : ''} checks=${JSON.stringify(r.checks)}`);
      if (r.estimate) console.log(`[${id}] estimate ${JSON.stringify(r.estimate)}`);
    }
  }));
  await Bw.stop(S);
  const bad = results.filter((r) => !r.ok);
  console.log(`\nplaythrough: ${results.length - bad.length}/${results.length} routes passed`);
  if (bad.length) process.exitCode = 1;
}
module.exports = { ROUTES, routeDef, estimate };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
