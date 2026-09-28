#!/usr/bin/env node
// テスト用メニュー（src/tester/）のブラウザのテスト: 遊ぶ版 index.html（公開のテスト版と同じ中身）で
//   node v2/tools/test_tester_browser.js [--no-build] [--shots <dir>]      （NODE_PATH=/opt/node22/lib/node_modules）
// 1) ?tester を付けない → F9 で何も開かない・TEST の札なし
// 2) ?tester=1 → タイトルで F9 → メニューが開く・閉じる
// 3) 旅を始めてフィールドへ → F9 → R で「ワープ」のタブ → ↓ → A → そのマップに入る（不変条件もそろう）
// 4) 切り替えを入れると TEST の札・記録の札の TEST の印、?tester=0 で無効に戻る
// --shots <dir> で 1920×1080 のスクショ（メニューの 3 つのタブ・宝箱の印・記録の札）
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const V2 = B.V2;
const argv = process.argv.slice(2);
const shotsDir = argv.includes('--shots') ? path.resolve(argv[argv.indexOf('--shots') + 1]) : null;
const TOP = "(RPG.Engine.top()||{}).id";

async function key(p, code) { await p.keyboard.down(code); await p.waitForTimeout(60); await p.keyboard.up(code); await p.waitForTimeout(160); }

(async function main() {
  if (!argv.includes('--no-build')) execFileSync('node', [path.join(V2, 'tools', 'build.js'), '--no-dev'], { stdio: 'inherit' });
  const S = await B.start();
  const TO = +process.env.V2_OPEN_TIMEOUT || 120000;
  const shot = async (p, name) => { if (shotsDir) { await p.waitForTimeout(350); await B.shot(p, path.join(shotsDir, name)); } };
  try {
    // ============================================================ 1) フラグなし
    section('index.html without ?tester');
    {
      const P = await B.open(S, 'index.html', { timeout: TO });
      const p = P.page;
      await B.waitFor(p, `${TOP}==='screen:title'`, TO);
      ok('R.Tester is in the bundle but disabled', await p.evaluate(() => !!RPG.Tester && RPG.Tester.enabled === false && !RPG.Tester._installed));
      await key(p, 'F9');
      ok('F9 does nothing', await p.evaluate(() => (RPG.Engine.top() || {}).id === 'screen:title'));
      ok('no errors', P.errors.length === 0, P.errors.slice(0, 3));
      await P.close();
    }

    // ============================================================ 2)〜4) ?tester=1
    section('index.html?tester=1');
    const P = await B.open(S, 'index.html?tester=1', { timeout: TO });
    const p = P.page;
    await B.waitFor(p, `${TOP}==='screen:title'`, TO);
    await p.waitForTimeout(800);
    ok('enabled from the URL', await p.evaluate(() => RPG.Tester.enabled && RPG.Tester._installed));
    ok('remembered in localStorage', await p.evaluate(() => JSON.parse(localStorage.getItem('luminous_chronicle_v2_tester') || '{}').on === true));
    await key(p, 'F9');
    ok('F9 on the title opens the tester menu', await B.waitFor(p, `${TOP}==='tester'`, 3000));
    await key(p, 'F9');
    ok('F9 again closes it', await B.waitFor(p, `${TOP}==='screen:title'`, 3000));

    // 旅を始めてフィールドへ（タイトルの流れは飛ばす: 状態を作ってロアの里に入る）
    await p.evaluate(async () => {
      const R = window.RPG;
      R.Flow.newGame = async () => {};   // タイトルを閉じたときの「はじめから」（序章の幕のイベント）を起こさない（このページの中だけ）
      R.Engine.clear();
      R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 7 });
      for (const id of ['selma', 'viola', 'hagen']) { try { R.Party.join(id); } catch (e) { /* */ } }
      R.Party.restoreAll();
      await R.Field.enter('roa', 'gate', { fade: 0, noAutosave: true });
    });
    await B.waitFor(p, `${TOP}==='field' && RPG.Engine.fade.a < 0.01`, 30000);
    await p.waitForTimeout(600);
    await key(p, 'F9');
    ok('F9 on the field opens the menu', await B.waitFor(p, `${TOP}==='tester'`, 3000));
    // 切り替え: 経験値を ×20 に（↓ → → を 4 回）、エンカウントなし（↑ → →）
    await B.press(p, 'down');
    for (let i = 0; i < 4; i++) await B.press(p, 'right');
    await B.press(p, 'up');
    await B.press(p, 'right');
    ok('arrow keys change toggles (exp ×20, no encounters)', await p.evaluate(() => RPG.Tester.opts.exp === 20 && RPG.Tester.opts.noEnc === true));
    // 宝箱の印も（スクショ用）
    await p.evaluate(() => RPG.Tester.set('reveal', true));
    await shot(p, 'tester_menu_toggles.png');
    await B.press(p, 'r');
    ok('R → 実行 tab', await p.evaluate(() => RPG.Tester.Menu.state().tab === 1));
    // 全回復（1 行目）
    await p.evaluate(() => { const c = RPG.Party.members()[0]; c.hp = 1; });
    await B.press(p, 'a');
    ok('A on 全員 HP・MP 全回復 heals', await p.evaluate(() => { const c = RPG.Party.members()[0]; return c.hp === RPG.Rules.stats(c).maxHp; }));
    await shot(p, 'tester_menu_actions.png');
    await B.press(p, 'r');
    ok('R → ワープ tab', await p.evaluate(() => RPG.Tester.Menu.state().tab === 2));
    const target = await p.evaluate(() => { const st = RPG.Tester.Menu.state(); const i = st.rows.findIndex((m) => RPG.DB.maps[m].kind === 'dungeon'); return { i, map: st.rows[i] }; });
    for (let i = 0; i < target.i; i++) await B.press(p, 'down');
    await shot(p, 'tester_menu_warp.png');
    await B.press(p, 'a');
    const arrived = await B.waitFor(p, `${TOP}==='field' && RPG.Field.pos.map===${JSON.stringify(target.map)} && RPG.Engine.fade.a < 0.01`, 30000);
    ok(`warp → ${target.map}`, arrived, await p.evaluate(() => RPG.Field.pos));
    const inv = await B.invariants(p);
    ok('field invariants after the warp', inv.ok, inv);
    ok('TEST badge state on (a toggle is active)', await p.evaluate(() => RPG.Tester.on === true && RPG.Game.testerUsed === true));
    await p.waitForTimeout(800);
    await shot(p, 'tester_badge_reveal.png');

    // 記録の札の TEST の印
    await p.evaluate(() => RPG.Save.save('s1'));
    ok('the save card carries test: true', await p.evaluate(() => RPG.Save.cards().find((e) => e.slot === 's1').card.test === true));
    if (shotsDir) {
      await p.evaluate(() => { RPG.Screens.open('save'); });
      await B.waitFor(p, `${TOP}==='screen:save'`, 5000);
      await shot(p, 'tester_save_card.png');
      await B.press(p, 'b');
      await B.waitFor(p, `${TOP}==='field'`, 5000);
    }
    if (shotsDir) {
      // 隠し通路の入口の印（旅人の古井戸の 2,26 の近く）と、お金 MAX のハブ
      await p.evaluate(async () => { await RPG.Field.enter('well', { x: 4, y: 24, dir: 'w' }, { fade: 0, noAutosave: true }); });
      await B.waitFor(p, `${TOP}==='field' && RPG.Engine.fade.a < 0.01`, 30000);
      await p.waitForTimeout(900);
      await shot(p, 'tester_reveal_secret.png');
      await p.evaluate(() => { RPG.Tester.goldMax(); RPG.Screens.open('menu'); });
      await B.waitFor(p, `${TOP}==='screen:menu'`, 5000);
      await shot(p, 'tester_gold_max_hub.png');
      await B.press(p, 'b');
      await B.waitFor(p, `${TOP}==='field'`, 5000);
    }
    ok('no errors (?tester=1)', P.errors.length === 0, P.errors.slice(0, 3));
    await P.close();

    // ?tester=0 で戻す（同じ保存場所: 新しい文脈は localStorage を持たないので、同じ文脈で開き直す）
    section('?tester=0');
    const P2 = await B.open(S, 'index.html?tester=1', { timeout: TO });
    await P2.page.goto(S.base + 'index.html?tester=0');
    await P2.page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: TO });
    ok('?tester=0 disables it and stores that', await P2.page.evaluate(() => !RPG.Tester.enabled && JSON.parse(localStorage.getItem('luminous_chronicle_v2_tester')).on === false));
    await P2.page.goto(S.base + 'index.html');
    await P2.page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: TO });
    ok('stays off without the parameter', await P2.page.evaluate(() => !RPG.Tester.enabled));
    await P2.close();
  } finally {
    await B.stop(S);
  }
  done('test_tester_browser');
})().catch((e) => { console.error(e); process.exit(2); });
