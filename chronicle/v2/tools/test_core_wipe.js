#!/usr/bin/env node
// CORE（版 2）: 全滅のあとの片付け R.Flow.wipe と §2.5.3 の不変条件を、ブラウザで確かめる（tools/lib/browser.js の使い方の見本も兼ねる）。
//   node v2/tools/test_core_wipe.js [--build]
// 1) 会話の窓を開いたイベントの途中で「宿から」→ 60 フレーム以内に歩ける（不変条件）、lastInn の場所に立っている、所持金半分
// 2) 「タイトルへ」→ タイトルの画面
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, done } = require('./lib/testkit');

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=core_stub_road');
  const p = P.page;
  ok('fixture opens the field', await B.waitFor(p, `${B.TOP}==='field'`, 3000));
  // イベントを走らせ、会話の窓が開いた所で全滅（宿から）の片付けを呼ぶ
  await B.ev(p, `(() => {
    RPG.Game.gold = 101;
    RPG.Game.lastInn = {map: 'stub_road', x: 10, y: 5, dir: 's'};
    RPG.DB.events.t_wipe = { async run(ev) { await ev.say(null, '途中の会話'); await ev.say(null, 'ここには来ない'); window.__reached = true; } };
    RPG.Events.run('t_wipe', {map: 'stub_road'});
  })()`);
  ok('event is running with a message open', await B.waitFor(p, 'RPG.Events.busy() && RPG.UIK.Message.busy()', 2000));
  await B.ev(p, `(() => { RPG.State.wipeRecover(); window.__w = RPG.Flow.wipe('inn'); })()`);
  const f0 = await B.ev(p, 'RPG.Engine.frame');
  ok('invariants hold within 60 frames after "inn"', await B.waitFor(p, `(() => { const t = RPG.Engine.top(); return t && t.id === 'field' && !RPG.Events.busy() && !RPG.UIK.Message.busy() && RPG.Engine.fade.a < 0.01 && Object.keys(RPG.Field.locks()).length === 0; })()`, 3000));
  const f1 = await B.ev(p, 'RPG.Engine.frame');
  ok('… in ≤ 60 frames', f1 - f0 <= 60, { frames: f1 - f0 });
  const inv = await B.invariants(p);
  ok('invariants (lib/browser)', inv.ok, inv);
  const pos = await B.ev(p, 'RPG.Field.pos');
  ok('standing at lastInn', pos.x === 10 && pos.y === 5, pos);
  ok('gold halved, party restored', (await B.ev(p, 'RPG.Game.gold')) === 50 && (await B.ev(p, 'RPG.Party.members().every((c) => c.hp > 0)')));
  ok('the aborted event did not continue', !(await B.ev(p, '!!window.__reached')));
  await B.press(p, 'right', 200);
  ok('can walk after the wipe', await B.waitFor(p, 'RPG.Field.pos.x >= 11', 3000), await B.ev(p, 'RPG.Field.pos'));
  await B.shot(p, path.join(B.V2, 'design', 'shots', 'core', 'p0r_wipe_inn_1920.png'));
  // タイトルへ
  await B.ev(p, `RPG.Flow.wipe('title')`);
  ok('"title" opens the title screen', await B.waitFor(p, `${B.TOP}==='screen:title'`, 3000));
  ok('0 console errors / outside requests', P.errors.length === 0, P.errors);
  await P.close();
  await B.stop(S);
  done('test_core_wipe');
}
main().catch((e) => { console.error(e); process.exit(2); });
