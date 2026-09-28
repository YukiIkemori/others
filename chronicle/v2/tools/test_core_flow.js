#!/usr/bin/env node
// CORE の通しの確かめ（P2 の組み込み、V2_PLAN §4.3）: 本物の実装（仮の実装が 1 回も呼ばれない）で
//   起動 → タイトル → はじめから → 序章の幕とベルナの台詞 → 主人公の作成 → ロアの家を歩く → ベルナに話す（傷薬と 50 G）
//   → 戦う（本物の R.Battle、tr_tutorial。A で一行の命令 → 1 人ずつ → 勝利の画面）→ メニュー → セーブ → 読み込み直して つづきから
// を入力の真似（キーボード）で通す。加えて スマホ縦（390×844）でタッチの台本（タップで序章を送る・作成の行・スティックで歩く・メニューのボタン）。
// コンソールのエラー 0 を確かめ、スクショを v2/design/shots/core/ に置く。
//   node v2/tools/test_core_flow.js [--build] [--out <dir>]
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { serve } = require('./shot.js');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const V2 = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const OUT = path.resolve(argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(V2, 'design', 'shots', 'core'));
const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyZ', b: 'KeyX', y: 'KeyC' };
const results = [];
let failed = 0;
function ok(name, cond, info) {
  results.push([cond ? 'pass' : 'FAIL', name, info === undefined ? '' : JSON.stringify(info)]);
  if (!cond) failed++;
  console.log(`${cond ? 'pass' : 'FAIL'}  ${name}${info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 300)}`);
}

async function open(browser, url, vp) {
  const ctx = await browser.newContext(vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + (e.stack || e)));
  await page.goto(url);
  await page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: +process.env.V2_OPEN_TIMEOUT || 15000 });
  await page.waitForTimeout(300);
  return { ctx, page, errors };
}
const ev = (page, js) => page.evaluate(js);
async function press(page, b) { await page.keyboard.down(KEY[b]); await page.waitForTimeout(60); await page.keyboard.up(KEY[b]); await page.waitForTimeout(90); }
/** cond が真になるまで b を押す（押すたびに 1 回だけ確かめる）。→ 真になったか */
async function pressUntil(page, b, cond, max) {
  for (let i = 0; i < (max || 40); i++) {
    if (await ev(page, cond)) return true;
    await press(page, b);
    await page.waitForTimeout(140);
  }
  return !!(await ev(page, cond));
}
async function waitFor(page, cond, ms) {
  try { await page.waitForFunction(cond, null, { timeout: ms || 5000 }); return true; } catch (e) { return false; }
}
const top = "(RPG.Engine.top()||{}).id";
const INVARIANTS = `(() => { const t = RPG.Engine.top(); return {top: t && t.id, locks: Object.keys(RPG.Field.locks ? RPG.Field.locks() : {}), busy: RPG.Events.busy(), fade: RPG.Engine.fade.a, input: RPG.Input.enabled, msg: RPG.UIK.Message.busy()}; })()`;
const invOk = (v) => v.top === 'field' && v.locks.length === 0 && !v.busy && v.fade < 0.01 && v.input && !v.msg;

/** 一番上の場面が field で、イベント・会話・暗転がない（歩ける） */
const FREE = `${top}==='field' && !RPG.Events.busy() && !RPG.UIK.Message.busy() && RPG.Engine.fade.a<0.01`;
/** 今の場所から (x, y) の隣まで（BFS、R.Field._walkable と人を避ける）の次の 1 歩の向き。着いていれば '' */
const NEXT = (x, y) => `(() => { const F = RPG.Field, m = RPG.DB.maps[F.pos.map], p = F.pos, key = (a, b) => a + ',' + b;
  const goal = (a, b) => a === ${x} && b === ${y};
  if (goal(p.x, p.y)) return '';
  const D = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
  const prev = {}; prev[key(p.x, p.y)] = null; const q = [[p.x, p.y]];
  while (q.length) { const [cx, cy] = q.shift();
    for (const [d, dx, dy] of D) { const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (k in prev || !F._walkable(m, nx, ny, null, 0) || (F._npcAt && F._npcAt(nx, ny, 0))) continue;
      prev[k] = [cx, cy, d];
      if (goal(nx, ny)) { let c = k, first = d; while (prev[c]) { first = prev[c][2]; c = key(prev[c][0], prev[c][1]); } return first; }
      q.push([nx, ny]); } }
  return null; })()`;
async function walkTo(page, x, y) {
  for (let i = 0; i < 60; i++) {
    const d = await ev(page, NEXT(x, y));
    if (d === '') return true;
    if (!d) return false;
    const before = await ev(page, 'RPG.Field.pos.x+","+RPG.Field.pos.y');
    await press(page, d);
    for (let k = 0; k < 10 && (await ev(page, 'RPG.Field.pos.x+","+RPG.Field.pos.y')) === before; k++) await page.waitForTimeout(40);
    await page.waitForTimeout(60);
  }
  return !!(await ev(page, `RPG.Field.pos.x===${x} && RPG.Field.pos.y===${y}`));
}
const STUBS_CALLED = "RPG.Stubs.report().filter(([k]) => !/^DB\\./.test(k))";

async function main() {
  if (argv.includes('--build')) execFileSync('node', [path.join(V2, 'tools', 'build.js')], { stdio: 'inherit' });
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(path.join(V2, 'dist'));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await playwright.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  // ------------------------------------------------ 16:9（1920×1080）、index.html（遊ぶ版）
  const A = await open(browser, base + 'index.html', { viewport: { width: 1920, height: 1080 } });
  let p = A.page;
  const info0 = await ev(p, '({W:RPG.W,H:RPG.H,SCALE:RPG.SCALE,layout:RPG.layout,ui:RPG.uiScale,cv:[document.getElementById("screen").width,document.getElementById("screen").height],dev:!!RPG.Dev})');
  ok('fit 1920x1080 → 960x540 SCALE 2, backing 1920x1080', info0.W === 960 && info0.H === 540 && info0.SCALE === 2 && info0.cv[0] === 1920 && info0.cv[1] === 1080, info0);
  ok('index.html has no dev tools (R.Dev)', info0.dev === false);
  ok('title is the first screen', (await ev(p, top)) === 'screen:title');
  const chk = await ev(p, 'RPG.Contract.checkAll()');
  ok('R.Contract.checkAll() in the browser', chk.ok, chk.errors);
  const claimed = await ev(p, "['Hd','Light','Post','Sky','UIK','Portrait','Terrain','Field','State','Events','Leads','Mini','Tier','Rules','Growth','Glimmer','Party','Mon','BattleCore','BattleAI','Battle','Screens'].filter((n) => !RPG.Stubs.claimed[n])");
  ok('every namespace is real (R.Stubs.claim)', claimed.length === 0, claimed);
  await p.screenshot({ path: path.join(OUT, 'p0_title_1920.png') });

  ok('title: はじめから is the first row with no record', await ev(p, "RPG.Engine.top().list.rows[0].value==='new'"));
  // タイトルは起動して最初に出てくる順を見せる（design/TITLE_ART.md §4）: 最初の A はとばすだけ、はじめからは光って暗転
  // 序章の幕（2026-09-28 から: 暗いままの字幕 4 枚＋ベルナの声の 6 ページ → 作成）。字幕は出てすぐ（250 ms）と閉じる間（300 ms）の A を
  //   受けないので、押す回数は幕の枚数より多めに見る（遊ぶ人の早押しが飛ばされるのは字幕の作り）
  ok('title → はじめから → 序章の幕 → 主人公の作成', await pressUntil(p, 'a', `${top}==='screen:charcreate'`, 70));
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, 'p0_charcreate_1920.png') });
  // 性別・タイプ・得意・名前（名前の入力が開き、決定の上）→「この主人公で旅立つ」→ ベルナの台詞 → 書見台へ歩く
  ok('主人公の作成 → 名前の入力を通る', await pressUntil(p, 'a', `${top}==='screen:nameentry'`, 6));
  ok('名前の入力 → 作成に戻る → 旅立つ', await pressUntil(p, 'a', `${top}!=='screen:nameentry' && ${top}!=='screen:charcreate'`, 6));
  ok('序章の台詞を送って歩ける', await pressUntil(p, 'a', FREE, 30), await ev(p, INVARIANTS));
  const hero = await ev(p, 'RPG.Game.chars.hero && {name: RPG.Game.chars.hero.name, look: RPG.Game.chars.hero.look}');
  ok('hero made (K.hero via the real charcreate)', !!hero && !!hero.name, hero);
  ok('invariants after the intro', invOk(await ev(p, INVARIANTS)), await ev(p, INVARIANTS));
  ok('started in roa_house', (await ev(p, 'RPG.Field.pos.map')) === 'roa_house', await ev(p, 'RPG.Field.pos'));
  // 歩く: ベルナ（書見台 12,5）の下 (12,6) へ、上を向いて話す
  ok('walk to (12,6) below Berna', await walkTo(p, 12, 6), await ev(p, 'RPG.Field.pos'));
  await press(p, 'up'); await p.waitForTimeout(150);
  ok('facing Berna (blocked by the NPC, turned north)', (await ev(p, 'RPG.Field.pos')).dir === 'n' && (await ev(p, 'RPG.Field.pos')).y === 6, await ev(p, 'RPG.Field.pos'));
  await p.screenshot({ path: path.join(OUT, 'p0_field_1920.png') });
  const goldT = await ev(p, 'RPG.Game.gold');
  await press(p, 'a');
  ok('talk opens a message', await waitFor(p, 'RPG.UIK.Message.busy()', 3000));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'p0_talk_1920.png') });
  ok('talk closes after the pages (A)', await pressUntil(p, 'a', FREE, 30));
  ok('Berna gives 3 salves and 50 G', (await ev(p, 'RPG.Game.gold')) === goldT + 50 && (await ev(p, 'RPG.Game.items.i_salve')) >= 3, { gold: await ev(p, 'RPG.Game.gold'), goldT });
  ok('invariants after talk', invOk(await ev(p, INVARIANTS)), await ev(p, INVARIANTS));
  // 戦闘: 本物の R.Battle.start（BSCENE）に本物のデータの編成を渡す（序章の最初の戦闘と同じ tr_tutorial）
  await ev(p, "RPG.Settings.set('battleSpeed', 3); 0");   // 設定「戦闘の速さ ×3」（ヘッドレスは遅いので）
  await ev(p, "window.__bres = null; void RPG.Battle.start({troop:'tr_tutorial'}).then((r) => { window.__bres = r; }); 0");
  ok('battle scene opens', await waitFor(p, `${top}==='battle'`, 15000));   // 入る移り（約 0.8 秒）の後
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, 'p0_battle_1920.png') });
  const gold0 = await ev(p, 'RPG.Game.gold');
  ok('battle ends (A: 一行の命令 → 1 人ずつ → 勝利の画面)', await pressUntil(p, 'a', "!RPG.Engine.has('battle') && window.__bres", 240),
    await ev(p, "(() => { const d = RPG.Battle.debug && RPG.Battle.debug(); return {r: window.__bres, phase: d && d.phase, units: d && d.B && d.B.units.map((u) => u.side[0] + u.hp)}; })()"));
  await ev(p, "RPG.Settings.set('battleSpeed', 1); 0");
  ok('battle result is a win', await ev(p, "window.__bres==='win' || (window.__bres && window.__bres.result==='win')"), await ev(p, 'window.__bres'));
  await waitFor(p, FREE, 3000);
  await p.waitForTimeout(300);
  ok('invariants after battle (§2.5.3)', invOk(await ev(p, INVARIANTS)), await ev(p, INVARIANTS));
  ok('battle reward (gold increased)', (await ev(p, 'RPG.Game.gold')) > gold0, { before: gold0, after: await ev(p, 'RPG.Game.gold') });
  ok('autosave after the win', await ev(p, "!!RPG.Save.cards().find(e=>e.slot==='auto').card"));
  // メニュー → セーブ → 記録 1
  await press(p, 'y');
  ok('menu opens (Y)', await waitFor(p, `${top}==='screen:menu'`, 2000));
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, 'p0_menu_1920.png') });
  ok('cursor to セーブ', await pressUntil(p, 'down', 'RPG.Engine.top().list && RPG.Engine.top().list.rows[RPG.Engine.top().list.index].value==="save"', 12));
  await press(p, 'a');
  ok('save screen opens', await waitFor(p, `${top}==='screen:save'`, 2000));
  await p.waitForTimeout(250);
  await pressUntil(p, 'a', "!!RPG.Save.cards().find(e=>e.slot==='s1').card", 3);
  const card = await ev(p, "RPG.Save.cards().find(e=>e.slot==='s1').card");
  const place = await ev(p, "RPG.DB.maps.roa_house.name");
  ok('saved to 記録 1 (card: place, chapter, no Lv)', !!card && card.place === place && card.chapter === 0 && !('lv' in card), card);
  await p.screenshot({ path: path.join(OUT, 'p0_save_1920.png') });
  ok('B back to the field', await pressUntil(p, 'b', FREE, 6));
  const pos = await ev(p, 'RPG.Field.pos');
  const stubs16 = await ev(p, STUBS_CALLED);
  ok('no stub was called (16:9 run)', stubs16.length === 0, stubs16);
  ok('0 console errors (16:9 run)', A.errors.length === 0, A.errors);

  // 読み込み直し: 同じ context（localStorage はそのまま）で開き直して つづきから
  await p.reload();
  await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: +process.env.V2_OPEN_TIMEOUT || 15000 });
  await p.waitForTimeout(300);
  ok('title offers つづきから first after reload', await ev(p, "(() => { const r = RPG.Engine.top().list.rows; return r[0].value==='continue' && !r[0].disabled; })()"));
  ok('つづきから → field at the saved place', await pressUntil(p, 'a', FREE, 6));
  const pos2 = await ev(p, 'RPG.Field.pos');
  ok('resumed at the same tile', pos2.x === pos.x && pos2.y === pos.y && pos2.map === pos.map, { pos, pos2 });
  ok('0 console errors (after reload)', A.errors.length === 0, A.errors);
  await A.ctx.close();

  // ------------------------------------------------ スマホ縦（390×844、DPR 3、タッチ）
  const B = await open(browser, base + 'index.html', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  p = B.page;
  const info1 = await ev(p, '({W:RPG.W,H:RPG.H,SCALE:RPG.SCALE,layout:RPG.layout,ui:RPG.uiScale})');
  ok('fit 390x844 portrait → 540x1169 tall, uiScale 1.3, SCALE ≈ 2.17 (device px 1:1)', info1.W === 540 && info1.H === 1169 && info1.layout === 'tall' && info1.ui === 1.3 && Math.abs(info1.SCALE - 2532 / 1169) < 1e-6, info1);
  await p.screenshot({ path: path.join(OUT, 'p0_title_phone.png') });
  const cdp = await B.ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapLogical = async (x, y) => {
    const q = await ev(p, `(() => { const c = document.getElementById('screen').getBoundingClientRect(); return {x: c.left + ${x} / RPG.W * c.width, y: c.top + ${y} / RPG.H * c.height}; })()`);
    await touch('touchStart', [q]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(250);
  };
  const rowCenter = (i) => `(() => { const l = RPG.Engine.top().list; const r = l.rowRect(${i}); return r && {x: r.x + r.w/2, y: r.y + r.h/2}; })()`;
  // タイトルの「はじめから」（行 0）を直接タップ
  // 最初のタップは出てくる順をとばすだけ（TITLE_ART §4）。もう一度タップして選ぶ
  const row0 = await ev(p, rowCenter(0));
  await tapLogical(row0.x, row0.y);
  if (await ev(p, `${top}==='screen:title' && !RPG.Engine.top().view.busy`)) { await p.waitForTimeout(200); const r0 = await ev(p, rowCenter(0)); await tapLogical(r0.x, r0.y); }
  // 序章の幕とベルナの台詞はタップで送る
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) { reached = await ev(p, `${top}==='screen:charcreate'`); if (!reached) await tapLogical(RPG_W2(info1), info1.H * 0.5); }
  ok('tap はじめから → (tap through the curtain) → 主人公の作成', reached);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'p0_charcreate_phone.png') });
  const row4 = await ev(p, rowCenter(4));
  if (row4) await tapLogical(row4.x, row4.y);
  ok('tap この主人公で旅立つ', await waitFor(p, `${top}!=='screen:charcreate'`, 3000));
  let free = false;
  for (let i = 0; i < 30 && !free; i++) { free = await ev(p, FREE); if (!free) await tapLogical(RPG_W2(info1), info1.H * 0.3); }
  ok('tap through the lines → field', free, await ev(p, INVARIANTS));
  ok('device switched to touch, touch pad shown', await ev(p, "RPG.Input.lastDevice==='touch' && RPG.Input.touchVisible() && RPG.Input.layoutName==='field'"));
  const s0 = await ev(p, 'RPG.Field.pos');
  const dirs = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
  const pick = await ev(p, `(() => { const F = RPG.Field, m = RPG.DB.maps[F.pos.map], p = F.pos; const D = ${JSON.stringify(dirs)};
    for (const [d, dx, dy] of D) if (F._walkable(m, p.x + dx, p.y + dy, null, 0) && F._walkable(m, p.x + 2 * dx, p.y + 2 * dy, null, 0) && !F._npcAt(p.x + dx, p.y + dy, 0)) return [d, dx, dy]; return null; })()`);
  const st = await ev(p, "RPG.Input.touchSpot('stick')");
  await touch('touchStart', [{ x: st.x, y: st.y }]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: st.x + st.r * 0.9 * pick[1] * i / 4, y: st.y + st.r * 0.9 * pick[2] * i / 4 }]); await p.waitForTimeout(16); }
  await p.waitForTimeout(700);
  await touch('touchEnd', []);
  await p.waitForTimeout(300);
  const s1 = await ev(p, 'RPG.Field.pos');
  ok(`touch stick ${pick && pick[0]} walks`, (s1.x - s0.x) * pick[1] + (s1.y - s0.y) * pick[2] > 0, { s0, s1 });
  await p.screenshot({ path: path.join(OUT, 'p0_field_phone.png') });
  const ys = await ev(p, "RPG.Input.touchSpot('y')");
  await touch('touchStart', [{ x: ys.x, y: ys.y }]); await p.waitForTimeout(70); await touch('touchEnd', []);
  ok('touch menu button opens the menu', await waitFor(p, `${top}==='screen:menu'`, 2000));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'p0_menu_phone.png') });
  const bs = await ev(p, "RPG.Input.touchSpot('b')");
  await touch('touchStart', [{ x: bs.x, y: bs.y }]); await p.waitForTimeout(70); await touch('touchEnd', []);
  ok('touch 戻る closes the menu', await waitFor(p, `${top}==='field'`, 2000));
  const stubsP = await ev(p, STUBS_CALLED);
  ok('no stub was called (phone run)', stubsP.length === 0, stubsP);
  ok('0 console errors (phone run)', B.errors.length === 0, B.errors);
  await B.ctx.close();

  // ------------------------------------------------ dev.html のフィクスチャ 3 つ（フィクスチャの仕組み。中のマップは仮のデータ stub_road）
  for (const [q, want] of [['fixture=core_stub_road', 'field'], ['scene=core_battle', 'battle'], ['scene=core_menu', 'screen:menu']]) {
    const C = await open(browser, base + 'dev.html?' + q, { viewport: { width: 1920, height: 1080 } });
    ok(`dev.html?${q} → ${want}`, await waitFor(C.page, `${top}==='${want}'`, 15000), await ev(C.page, top));
    ok(`dev.html?${q}: 4 members`, (await ev(C.page, 'RPG.Party.members().length')) === 4);
    await C.page.waitForTimeout(400);
    await C.page.screenshot({ path: path.join(OUT, `p0_dev_${q.split('=')[1]}_1920.png`) });
    ok(`dev.html?${q}: 0 console errors`, C.errors.length === 0, C.errors);
    await C.ctx.close();
  }
  await browser.close();
  srv.close();
  console.log(`\n${results.length - failed}/${results.length} passed` + (failed ? `  (${failed} FAILED)` : ''));
  process.exitCode = failed ? 1 : 0;
}
const RPG_W2 = (info) => info.W / 2;
main().catch((e) => { console.error(e); process.exit(2); });
