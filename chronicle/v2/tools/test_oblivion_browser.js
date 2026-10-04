#!/usr/bin/env node
// 忘却の底を本物の入力で歩く（ブラウザ。dist/dev.html が要る = tools/build.js の後）。2026-10-04
//   1 クリアの前: ビブリアの広場の白い階段へ上がると通せんぼの一言 → 町に残る（出口の札は出ない）
//   2 クリアの後: 階段へ上がる →「下りますか？」→ はい → 地下 1 階（字幕）
//   3 地下 1〜5 階: キーを押して道を歩き、下りの階段で次の階へ（3 階の残影・5 階の円環竜は戦闘を勝ちにして通る。4 階は光のある廊下だけ）
//   4 5 階の泉（女神の像）で全快 → 円環竜 → 上り階段を戻る／脱出でビブリアへ
//   5 各所で画面を撮る（--out <dir>、既定は v2/dist/shots/oblivion）
//   node v2/tools/test_oblivion_browser.js [--out dir]   → FAIL があれば終了コード 1
'use strict';
const path = require('path');
const Bw = require('./lib/browser');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : path.join(Bw.V2, 'dist', 'shots', 'oblivion'); })();
let failed = 0, passed = 0;
const ok = (name, cond, info) => { if (cond) { passed++; console.log('pass  ' + name); } else { failed++; console.log('FAIL  ' + name + (info ? '  ' + JSON.stringify(info).slice(0, 300) : '')); } };
(async () => {
  const S = await Bw.start();
  const P = await Bw.open(S, 'dev.html?fixture=content_d_kasim', { size: [1280, 720], timeout: +process.env.V2_OPEN_TIMEOUT || 90000 });
  const page = P.page;
  await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02", null, { timeout: 60000 });
  // 製品版の筋・クリアの前（ビブリアに着いた）。出現は止める（道を歩く検査）。戦闘は勝ちにする（呼ばれた編成を記録）
  await page.evaluate(() => {
    const R = RPG;
    R.DB.config.slice = false; R.MapUtil.invalidate && R.MapUtil.invalidate();
    Object.assign(R.Game.flags, { final_arrived: true, final_archive_seen: true });
    R.Game.tier = 8;
    R.Field._encounterStep = () => null;
    window.__battles = [];
    window.__realBattle = R.Battle.start;
    R.Battle.start = async (setup) => { window.__battles.push(setup && setup.troop); return { result: 'win' }; };
  });
  const enter = (map, x, y, dir) => page.evaluate(async ([map, x, y, dir]) => { await RPG.Field.enter(map, { x, y, dir }, { fade: 0, noAutosave: true }); }, [map, x, y, dir]);
  const pos = () => page.evaluate(() => { const p = RPG.Field.pos || {}; return { map: p.map, x: p.x, y: p.y }; });
  const busy = () => page.evaluate(() => (RPG.Engine.top() || {}).id !== 'field' || RPG.Events.busy() || !!(RPG.UIK.Message && RPG.UIK.Message.active && RPG.UIK.Message.active()));
  const settle = async (n) => { for (let i = 0; i < (n || 40); i++) { if (!(await busy())) return; await Bw.press(page, 'a'); await page.waitForTimeout(160); } };
  const step = async (key) => {
    const a = await pos();
    await page.evaluate((k) => RPG.Input._set(k, true), key);
    let b = a;
    for (let i = 0; i < 25; i++) { await page.waitForTimeout(40); b = await pos(); if (b.map !== a.map || b.x !== a.x || b.y !== a.y) break; }
    await page.evaluate((k) => RPG.Input._set(k, false), key);
    await page.waitForTimeout(60);
    return b;
  };
  const KEY = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' };
  // 当たりで道を探す（avoid: 踏まないマスの 'x,y' の配列。階段・出口のマスは行き先のときだけ）
  const route = (map, fx, fy, tx, ty, avoid) => page.evaluate(([map, fx, fy, tx, ty, avoid]) => {
    const R = RPG, m = R.DB.maps[map], F = R.Field, prev = {}, q = [[fx, fy]]; prev[fx + ',' + fy] = null;
    const bad = new Set(avoid || []);
    for (const o of m.objects || []) if (o.type === 'stairs' && !(o.x === tx && o.y === ty)) bad.add(o.x + ',' + o.y);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const u = x + dx, v = y + dy, k = u + ',' + v;
        if (k in prev || bad.has(k) || !F._walkable(m, u, v, null, 0) || F._npcAt(u, v, 0)) continue;
        prev[k] = [x, y]; q.push([u, v]);
      }
    }
    if (!((tx + ',' + ty) in prev)) return null;
    const out = []; let c = [tx, ty];
    while (c) { out.unshift(c); c = prev[c[0] + ',' + c[1]]; }
    return out;
  }, [map, fx, fy, tx, ty, avoid || []]);
  /** (tx, ty) へ歩く（途中でイベントが始まったら閉じて続ける）→ 着いた所 */
  const walkTo = async (map, tx, ty, avoid) => {
    for (let tries = 0; tries < 6; tries++) {
      await settle();
      const p = await pos();
      if (p.map !== map) return p;
      if (p.x === tx && p.y === ty) return p;
      const r = await route(map, p.x, p.y, tx, ty, avoid);
      if (!r) return p;
      for (let i = 1; i < r.length; i++) {
        const c = await pos();
        if (c.map !== map) return c;
        const k = (r[i][0] - c.x) + ',' + (r[i][1] - c.y);
        if (!KEY[k]) break;
        const b = await step(KEY[k]);
        if (b.map !== map) return b;
        if (await busy()) break;
      }
    }
    return pos();
  };
  const shot = async (name) => { await page.waitForTimeout(250); await Bw.shot(page, path.join(OUT, name + '.png')); };
  const fails = async () => page.evaluate(() => (RPG.loadErrors || []).length + (RPG.Engine.error ? 1 : 0));

  // ================================================================ 1 クリアの前
  await enter('biblia', 32, 31, 'n');
  await settle();
  await shot('01_biblia_plaza_before_clear');
  let lab = await page.evaluate(() => RPG.Field.wayfind.info(RPG.DB.maps.biblia).exits.filter((e) => e.to && e.to.map === 'oblivion_1').length);
  ok('クリアの前: 広場の階段に出口の札が無い', lab === 0);
  await walkTo('biblia', 32, 29);
  await step('up');
  await page.waitForTimeout(500);
  const msg = await page.evaluate(() => { try { const m = RPG.UIK.Message; return (m.current && m.current().text) || (m._cur && m._cur.text) || ''; } catch (e) { return ''; } });
  await shot('02_biblia_gate_closed');
  await settle();
  let p = await pos();
  ok('クリアの前: 階段へ上がっても町に残る（通せんぼで 1 歩下がる）', p.map === 'biblia' && p.y >= 29, { p, msg });

  // ================================================================ 2 クリアの後
  await page.evaluate(() => { RPG.Game.flags.final_clear = true; RPG.MapUtil.invalidate && RPG.MapUtil.invalidate(); });
  await enter('biblia', 32, 31, 'n');
  await settle();
  await page.waitForTimeout(400);
  lab = await page.evaluate(() => RPG.Field.wayfind.info(RPG.DB.maps.biblia).exits.filter((e) => e.to && e.to.map === 'oblivion_1').map((e) => e.label));
  ok('クリアの後: 広場の階段に出口の札「' + lab[0] + '」', lab.length > 0);
  await walkTo('biblia', 32, 29);
  await shot('03_biblia_plaza_after_clear');
  await page.evaluate((k) => RPG.Input._set(k, true), 'up'); await page.waitForTimeout(300); await page.evaluate((k) => RPG.Input._set(k, false), 'up');
  await page.waitForTimeout(500);
  await shot('04_biblia_confirm');
  await Bw.press(page, 'a');   // はい
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); if ((await pos()).map === 'oblivion_1') break; }
  await page.waitForTimeout(900);
  await shot('05_oblivion_1_arrive_caption');
  await settle();
  p = await pos();
  ok('クリアの後: はい → 地下 1 階', p.map === 'oblivion_1', p);
  ok('地下 1 階のワープの一覧に「忘却の底」', await page.evaluate(() => RPG.Field.warpList().some((w) => w.id === 'oblivion')));
  await shot('06_oblivion_1_start');

  // ================================================================ 3 各階
  const floors = [
    { map: 'oblivion_1', mid: [[22, 14, '07_oblivion_1_graves'], [33, 6, '08_oblivion_1_spit']], down: [34, 27], next: 'oblivion_2' },
    { map: 'oblivion_2', mid: [[10, 10, '09_oblivion_2_forest'], [23, 8, '10_oblivion_2_torn_bridge'], [10, 27, '11_oblivion_2_desert'], [34, 18, '12_oblivion_2_snow']], down: [33, 28], next: 'oblivion_3' },
    { map: 'oblivion_3', mid: [[17, 21, '13_oblivion_3_hall'], [17, 6, '14_oblivion_3_throne']], down: [30, 3], next: 'oblivion_4', boss: 'tr_b_valzard_echo' },
    { map: 'oblivion_4', mid: [[8, 14, '15_oblivion_4_room1'], [22, 14, '16_oblivion_4_room2']], down: [44, 19], next: 'oblivion_5', avoid: ['15,17', '15,18', '28,6', '28,7', '41,17', '41,18'] },
    { map: 'oblivion_5', mid: [[13, 6, '17_oblivion_5_spring'], [17, 12, '18_oblivion_5_ring']], down: null, boss: 'tr_b_ouroboros' },
  ];
  for (const f of floors) {
    p = await pos();
    ok(`${f.map}: 着いた`, p.map === f.map, p);
    if (p.map !== f.map) break;
    for (const [x, y, name] of f.mid) {
      const q = await walkTo(f.map, x, y, f.avoid);
      await settle();
      await shot(name);
      ok(`${f.map}: (${x},${y}) へ歩いて行ける`, q.map === f.map && Math.abs(q.x - x) + Math.abs(q.y - y) <= 1, q);
    }
    if (f.boss) ok(`${f.map}: ボス ${f.boss} の戦闘が始まった`, await page.evaluate((t) => window.__battles.includes(t), f.boss));
    if (f.map === 'oblivion_5') {
      ok('5 階: 円環竜の後 oblivion_ouroboros・外伝の読み物', await page.evaluate(() => !!(RPG.Game.flags.oblivion_ouroboros && RPG.Game.flags.lo_ouroboros)));
      continue;
    }
    const [dx, dy] = f.down;
    const r = await walkTo(f.map, dx, dy, f.avoid);
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(150); if ((await pos()).map === f.next) break; }
    await page.waitForTimeout(800);
    if (f.map === 'oblivion_1') await shot('06b_oblivion_2_arrive_caption');
    await settle();
    p = await pos();
    ok(`${f.map}: 下りの階段 (${dx},${dy}) から ${f.next} へ`, p.map === f.next, { r, p });
    if (f.map === 'oblivion_3') ok('3 階: 残影の後 oblivion_echo', await page.evaluate(() => !!RPG.Game.flags.oblivion_echo));
  }
  // 4 階の輪: 光の無い廊下を踏むと最初の部屋へ
  await enter('oblivion_4', 13, 17, 'e');
  await settle();
  await step('right'); await step('right');
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); if (await busy()) break; }
  await page.waitForTimeout(600);
  await shot('19_oblivion_4_loop_back');
  await settle();
  p = await pos();
  ok('4 階: 光の無い廊下（1 の部屋の南）→ 最初の部屋（loop）へ戻る', p.map === 'oblivion_4' && p.x <= 6, p);
  // ================================================================ 4 泉と脱出・戻り
  await page.evaluate(() => { for (const c of RPG.Party.members()) c.hp = 1; });
  await enter('oblivion_5', 14, 5, 'w');
  await settle();
  await page.evaluate(() => { const S = RPG.Field._s; S.dir = 'w'; });
  await Bw.press(page, 'a');
  await page.waitForTimeout(500);
  await settle();
  ok('5 階の女神の像（泉）で全快', await page.evaluate(() => RPG.Party.members().every((c) => c.hp === RPG.Rules.stats(c).maxHp)));
  await page.evaluate(async () => { await RPG.Field.escape(); });
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); if ((await pos()).map === 'biblia') break; }
  await settle();
  p = await pos();
  ok('脱出（5 階）→ ビブリアの広場（入口の外）', p.map === 'biblia', p);
  await shot('20_biblia_after_escape');
  // 上り階段で戻る（地下 1 階 → 町）
  await enter('oblivion_1', 6, 4, 'n');
  await settle();
  await walkTo('oblivion_1', 6, 3);
  await step('up');
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); if ((await pos()).map === 'biblia') break; }
  await settle();
  p = await pos();
  ok('地下 1 階の上り階段 → ビブリアの広場の階段の前', p.map === 'biblia' && Math.abs(p.x - 32.5) <= 1.5 && p.y >= 29, p);
  // 本物の戦闘の画面（円環竜の始まり）
  await page.evaluate(() => { RPG.Battle.start = window.__realBattle; RPG.Battle.start({ troop: 'tr_b_ouroboros', boss: true, noEscape: true }); });
  await page.waitForTimeout(4500);
  await shot('21_battle_ouroboros');
  ok('ページのエラーが無い', (await fails()) === 0);
  await Bw.stop(S);
  console.log(`\ntest_oblivion_browser: ${passed}/${passed + failed} passed  (shots: ${OUT})`);
  if (failed) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
