#!/usr/bin/env node
// CORE の通しの確かめ（P0 の関門、V2_PLAN §4.3）: 仮の実装だけで
//   起動 → タイトル → 主人公（仮）→ マップを歩く → 話す → 戦う → メニュー → セーブ → 読み込み直して つづきから
// を入力の真似（キーボード）で通す。加えて スマホ縦（390×844）でタッチの台本（スティックで歩く・メニューのボタン）。
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
  await page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 15000 });
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
  ok('R.Contract.checkAll() in the browser (stubs fill every contract)', chk.ok, chk.errors);
  await p.screenshot({ path: path.join(OUT, 'p0_title_1920.png') });

  ok('title → はじめから → 主人公の作成（仮）', await pressUntil(p, 'a', `${top}==='screen:charcreate'`, 5));
  ok('主人公の作成 → フィールド', await pressUntil(p, 'a', `${top}==='field' && RPG.Engine.fade.a<0.01`, 5));
  await p.waitForTimeout(200);
  // 歩く: (3,5) → (5,5) → (5,4)、右を向いて語り部（6,4）に話す
  ok('walk right to x=5', await pressUntil(p, 'right', 'RPG.Field.pos.x===5', 6), await ev(p, 'RPG.Field.pos'));
  ok('walk up to y=4', await pressUntil(p, 'up', 'RPG.Field.pos.y===4', 4), await ev(p, 'RPG.Field.pos'));
  await press(p, 'right'); await p.waitForTimeout(150);
  ok('facing the elder (blocked by the NPC, turned east)', (await ev(p, 'RPG.Field.pos')).dir === 'e' && (await ev(p, 'RPG.Field.pos')).x === 5);
  await p.screenshot({ path: path.join(OUT, 'p0_field_1920.png') });
  await press(p, 'a');
  ok('talk opens a message', await waitFor(p, 'RPG.UIK.Message.busy()', 2000));
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(OUT, 'p0_talk_1920.png') });
  ok('talk closes after the pages (A)', await pressUntil(p, 'a', '!RPG.UIK.Message.busy()', 8));
  ok('invariants after talk', invOk(await ev(p, INVARIANTS)), await ev(p, INVARIANTS));
  // 番兵（14,6）へ: 下へ 2、右へ 13 まで
  ok('walk down to y=6', await pressUntil(p, 'down', 'RPG.Field.pos.y===6', 4));
  ok('walk right to x=13', await pressUntil(p, 'right', 'RPG.Field.pos.x===13', 12), await ev(p, 'RPG.Field.pos'));
  await press(p, 'right'); await p.waitForTimeout(150);
  await press(p, 'a');
  ok('guard talk → choice → battle', await pressUntil(p, 'a', `${top}==='battle'`, 8));
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'p0_battle_1920.png') });
  const gold0 = await ev(p, 'RPG.Game.gold');
  ok('battle ends in one line (A → win → A)', await pressUntil(p, 'a', "!RPG.Engine.has('battle')", 4));
  ok('after-battle line closes', await pressUntil(p, 'a', `${top}==='field' && !RPG.Events.busy() && !RPG.UIK.Message.busy()`, 6));
  await p.waitForTimeout(300);
  ok('invariants after battle (§2.5.3)', invOk(await ev(p, INVARIANTS)), await ev(p, INVARIANTS));
  ok('battle reward (gold +12)', (await ev(p, 'RPG.Game.gold')) === gold0 + 12, { before: gold0, after: await ev(p, 'RPG.Game.gold') });
  ok('autosave after the win', await ev(p, "!!RPG.Save.cards().find(e=>e.slot==='auto').card"));
  // メニュー → セーブ → 記録 1
  await press(p, 'y');
  ok('menu opens (Y)', await waitFor(p, `${top}==='screen:menu'`, 2000));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, 'p0_menu_1920.png') });
  ok('cursor to セーブ', await pressUntil(p, 'down', 'RPG.Engine.top().list && RPG.Engine.top().list.rows[RPG.Engine.top().list.index].value==="save"', 10));
  await press(p, 'a');
  ok('save screen opens', await waitFor(p, `${top}==='screen:save'`, 2000));
  await press(p, 'a'); await p.waitForTimeout(200);
  const card = await ev(p, "RPG.Save.cards().find(e=>e.slot==='s1').card");
  ok('saved to 記録 1 (card: place, chapter, no Lv)', !!card && card.place === '仮の夜道' && card.chapter === 0 && !('lv' in card), card);
  await p.screenshot({ path: path.join(OUT, 'p0_save_1920.png') });
  ok('B back to the field', await pressUntil(p, 'b', `${top}==='field'`, 4));
  const pos = await ev(p, 'RPG.Field.pos');
  ok('0 console errors (16:9 run)', A.errors.length === 0, A.errors);

  // 読み込み直し: 同じ context（localStorage はそのまま）で開き直して つづきから
  await p.reload();
  await p.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 15000 });
  await p.waitForTimeout(300);
  ok('title offers つづきから after reload', await ev(p, "RPG.Engine.top().list.rows[1].disabled===false"));
  await press(p, 'down'); await p.waitForTimeout(100);
  ok('つづきから → field at the saved place', await pressUntil(p, 'a', `${top}==='field' && RPG.Engine.fade.a<0.01`, 4));
  const pos2 = await ev(p, 'RPG.Field.pos');
  ok('resumed at the same tile', pos2.x === pos.x && pos2.y === pos.y && pos2.map === pos.map, { pos, pos2 });
  ok('0 console errors (after reload)', A.errors.length === 0, A.errors);
  await A.ctx.close();

  // ------------------------------------------------ スマホ縦（390×844、DPR 3、タッチ）
  const B = await open(browser, base + 'index.html', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  p = B.page;
  const info1 = await ev(p, '({W:RPG.W,H:RPG.H,SCALE:RPG.SCALE,layout:RPG.layout,ui:RPG.uiScale})');
  ok('fit 390x844 portrait → 540x1169 tall, uiScale 1.3, SCALE 2', info1.W === 540 && info1.H === 1169 && info1.layout === 'tall' && info1.ui === 1.3 && info1.SCALE === 2, info1);
  await p.screenshot({ path: path.join(OUT, 'p0_title_phone.png') });
  const cdp = await B.ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tapLogical = async (x, y) => {
    const q = await ev(p, `(() => { const c = document.getElementById('screen').getBoundingClientRect(); return {x: c.left + ${x} / RPG.W * c.width, y: c.top + ${y} / RPG.H * c.height}; })()`);
    await touch('touchStart', [q]); await p.waitForTimeout(60); await touch('touchEnd', []); await p.waitForTimeout(250);
  };
  // タイトルの「はじめから」を直接タップ（一覧の行）
  const row0 = await ev(p, '(() => { const r = RPG.Engine.top().list.rect; return {x: r.x + r.w/2, y: r.y + 10}; })()');
  await tapLogical(row0.x, row0.y);
  ok('tap はじめから → 主人公の作成', await waitFor(p, `${top}==='screen:charcreate'`, 2000));
  const row1 = await ev(p, '(() => { const r = RPG.Engine.top().list.rect; return {x: r.x + r.w/2, y: r.y + 10}; })()');
  await tapLogical(row1.x, row1.y);
  ok('tap → field', await waitFor(p, `${top}==='field' && RPG.Engine.fade.a<0.01`, 3000));
  ok('device switched to touch, touch pad shown', await ev(p, "RPG.Input.lastDevice==='touch' && RPG.Input.touchVisible() && RPG.Input.layoutName==='field'"));
  const x0 = (await ev(p, 'RPG.Field.pos')).x;
  const st = await ev(p, "RPG.Input.touchSpot('stick')");
  await touch('touchStart', [{ x: st.x, y: st.y }]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: st.x + st.r * 0.9 * i / 4, y: st.y }]); await p.waitForTimeout(16); }
  await p.waitForTimeout(700);
  await touch('touchEnd', []);
  await p.waitForTimeout(300);
  const x1 = (await ev(p, 'RPG.Field.pos')).x;
  ok('touch stick right walks east', x1 > x0, { x0, x1 });
  await p.screenshot({ path: path.join(OUT, 'p0_field_phone.png') });
  const ys = await ev(p, "RPG.Input.touchSpot('y')");
  await touch('touchStart', [{ x: ys.x, y: ys.y }]); await p.waitForTimeout(70); await touch('touchEnd', []);
  ok('touch menu button opens the menu', await waitFor(p, `${top}==='screen:menu'`, 2000));
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, 'p0_menu_phone.png') });
  const bs = await ev(p, "RPG.Input.touchSpot('b')");
  await touch('touchStart', [{ x: bs.x, y: bs.y }]); await p.waitForTimeout(70); await touch('touchEnd', []);
  ok('touch 戻る closes the menu', await waitFor(p, `${top}==='field'`, 2000));
  ok('0 console errors (phone run)', B.errors.length === 0, B.errors);
  await B.ctx.close();

  // ------------------------------------------------ dev.html のフィクスチャ 3 つ
  for (const [q, want] of [['fixture=core_stub_road', 'field'], ['scene=core_battle', 'battle'], ['scene=core_menu', 'screen:menu']]) {
    const C = await open(browser, base + 'dev.html?' + q, { viewport: { width: 1920, height: 1080 } });
    ok(`dev.html?${q} → ${want}`, await waitFor(C.page, `${top}==='${want}'`, 3000), await ev(C.page, top));
    ok(`dev.html?${q}: 4 members`, (await ev(C.page, 'RPG.Party.members().length')) === 4);
    await C.page.screenshot({ path: path.join(OUT, `p0_dev_${q.split('=')[1]}_1920.png`) });
    ok(`dev.html?${q}: 0 console errors`, C.errors.length === 0, C.errors);
    await C.ctx.close();
  }
  await browser.close();
  srv.close();
  console.log(`\n${results.length - failed}/${results.length} passed` + (failed ? `  (${failed} FAILED)` : ''));
  process.exitCode = failed ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(2); });
