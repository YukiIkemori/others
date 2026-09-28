// MENUS の「次にやること」・初めての説明の札・カーソルの記憶のブラウザのテスト（オーナーの依頼 2026-09-28）
//   node v2/tools/build.js && node v2/tools/test_guide_browser.js [--out <dir>]
//   フィールドの L で札 → メニューの上の 1 行 → 閉じて開き直すと同じ行 → 装備を初めて開くと説明の札（A で閉じる・1 回だけ）→
//   魔石を手に入れると落ち着いた所で札 → 本筋の段が変わると札が一度 → 戦闘の 2 ラウンド目の命令でリピートの札。コンソールのエラー 0。
'use strict';
const path = require('path');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(B.V2, 'design', 'shots', 'menus');
const TOP = B.TOP;
const shot = (p, name) => B.shot(p, path.join(OUT, name));

(async () => {
  const S = await B.start();
  try {
    section('フィールドの L・メニューの上の 1 行（16:9）');
    const P = await B.open(S, 'dev.html?fixture=menus_party&tips=1');
    const p = P.page;
    ok('field opens', await B.waitFor(p, `${TOP}==='field'`, 8000));
    await p.waitForTimeout(2800);   // 場所の札が消えるまで
    const goal = await B.ev(p, 'RPG.Leads.goal()');
    ok('the fixture has a goal (prologue done → 潮風亭のうわさ)', goal && goal.id === 'g_rumors' && goal.text.length > 0, goal);
    ok('no goal banner before L', !(await B.ev(p, 'RPG.Field.hud._goal()')));
    await B.press(p, 'l');
    await p.waitForTimeout(350);
    const g1 = await B.ev(p, 'RPG.Field.hud._goal()');
    ok('L in the field shows the goal banner with the goal line', g1 && g1.text === goal.text, g1);
    ok('L does not open anything (top stays field)', (await B.ev(p, TOP)) === 'field');
    await shot(p, 'guide_field_goal_1920.png');
    await p.waitForTimeout(4600);
    ok('the banner goes away after a few seconds', !(await B.ev(p, 'RPG.Field.hud._goal()')));

    // メニュー
    await B.press(p, 'y');
    ok('Y opens the menu', await B.waitFor(p, `${TOP}==='screen:menu'`, 3000));
    await p.waitForTimeout(400);
    await shot(p, 'guide_menu_goal_1920.png');
    for (let i = 0; i < 3; i++) await B.press(p, 'down');
    const idx = await B.ev(p, 'RPG.Engine.top().list.index');
    const val = await B.ev(p, 'RPG.Engine.top().list.current().value');
    await B.press(p, 'b');
    ok('menu closes', await B.waitFor(p, `${TOP}==='field'`, 2000));
    await p.waitForTimeout(300);
    await B.press(p, 'y');
    await B.waitFor(p, `${TOP}==='screen:menu'`, 3000);
    ok('menu reopens on the same command (cursor memory)', (await B.ev(p, 'RPG.Engine.top().list.current().value')) === val && idx === 3, [idx, val]);

    // 装備を初めて開くと説明の札
    await B.pressUntil(p, 'up', `RPG.Engine.top().list.current().value==='equip'`, 8);
    await B.press(p, 'a');
    ok('equip → first-time tip on top of it', await B.waitFor(p, `${TOP}==='screen:tip'`, 2500), await B.ev(p, TOP));
    await p.waitForTimeout(300);
    await shot(p, 'guide_tip_equip_1920.png');
    await B.press(p, 'a');
    ok('A closes the tip → back to equip', await B.waitFor(p, `${TOP}==='screen:equip'`, 2000));
    ok('seen flag saved in R.Game.flags', await B.ev(p, 'RPG.Game.flags.tip_equip === true'));
    await B.press(p, 'b');
    await B.waitFor(p, `${TOP}==='screen:menu'`, 2000);
    await p.waitForTimeout(250);
    await B.press(p, 'a');
    await B.waitFor(p, `${TOP}==='screen:equip'`, 2000);
    await p.waitForTimeout(500);
    ok('the equip tip is shown once only', (await B.ev(p, TOP)) === 'screen:equip');
    await B.pressUntil(p, 'b', `${TOP}==='field'`, 4);

    // 魔石を手に入れる → フィールドが落ち着いたところで札
    await B.ev(p, `(RPG.State.gain('i_stone_fire', 1), true)`);
    ok('gaining a magic stone → stone tip in the field', await B.waitFor(p, `${TOP}==='screen:tip' && RPG.Engine.top().view.tip.title==='魔石'`, 3000), await B.ev(p, TOP));
    await p.waitForTimeout(300);
    await shot(p, 'guide_tip_stone_1920.png');
    await B.press(p, 'a');
    await B.waitFor(p, `${TOP}==='field'`, 2000);

    // 本筋の段が変わる → 札が一度
    await B.ev(p, `(RPG.Leads.add('l_rumor_forest', {silent: true}), true)`);
    ok('goal change → banner shows the new goal once', await B.waitFor(p, `(RPG.Field.hud._goal()||{}).text === RPG.Leads.goal().text && RPG.Leads.goal().id==='g_fern'`, 3000), await B.ev(p, 'RPG.Field.hud._goal()'));

    // 戦闘: 2 ラウンド目の命令でリピートの札
    section('戦闘のリピートの札');
    await p.waitForTimeout(3500);
    await B.ev(p, `(RPG.Settings.set('battleSpeed', 5), RPG.Battle.start({ troop: 'tr_stub' }), true)`);
    ok('battle starts', await B.waitFor(p, `${TOP}==='battle'`, 4000));
    // 1 ラウンド目は A で命令 → 動き → 2 ラウンド目の命令（リピートが使える）で札
    let got = false;
    for (let i = 0; i < 200 && !got; i++) {
      if ((await B.ev(p, TOP)) === 'screen:tip') { got = true; break; }
      if (!(await B.ev(p, `RPG.Engine.has('battle')`))) break;
      const ph = await B.ev(p, `(RPG.Battle.debug() || {}).phase`);
      if (ph === 'input') await B.press(p, 'a'); else await p.waitForTimeout(250);
    }
    ok('the repeat tip opens at the 2nd-round command (before the battle ends)', got && (await B.ev(p, `RPG.Engine.top().view.tip.title`)).includes('リピート'), await B.ev(p, TOP));
    if (got) { await p.waitForTimeout(300); await shot(p, 'guide_tip_repeat_1920.png'); await B.press(p, 'a'); }
    await B.waitFor(p, `${TOP}==='battle'`, 2000);
    ok('battle goes on after the tip', (await B.ev(p, `RPG.Engine.has('battle')`)) || (await B.ev(p, TOP)) === 'field');
    ok('0 console errors', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();

    section('フィクスチャでは札を出さない（ほかの担当のテストを止めない）');
    const Q = await B.open(S, 'dev.html?fixture=menus_party');
    ok('field opens', await B.waitFor(Q.page, `${TOP}==='field'`, 8000));
    await B.ev(Q.page, `(RPG.Screens.open('equip'), true)`);
    await Q.page.waitForTimeout(600);
    ok('no tip on equip in a plain fixture', (await B.ev(Q.page, TOP)) === 'screen:equip');
    await Q.close();
  } finally { await B.stop(S); }
  done('test_guide_browser');
})().catch((e) => { console.error(e); process.exit(1); });
