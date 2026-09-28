#!/usr/bin/env node
// 宿の眠りのブラウザのテスト（EVENTS の Events.night・CORE の R.Audio.endJingle）: 本物の音（Web Audio）で確かめる。
//   node v2/tools/test_inn_browser.js [--no-build]      （NODE_PATH=/opt/node22/lib/node_modules）
// ファロスの宿（pharos_inn、BGM 'town'）でおかみに泊まる:
//   1) すぐに A を連打 → 2.5 秒までは暗いまま（ジングル 'inn' が鳴り、会話は進まない）→ 2.5 秒の後の A で飛ばす →
//      明けて、会話「よく眠れたかい？」が開き（飛ばした A で進んでいない）、ジングルは無く、BGM はマップの曲に戻る
//   2) 押さない → ジングルの終わりで明ける。明けたときにジングルは無く、BGM はマップの曲
// どちらもイベントが終わった後にしばらく待って、ジングルが戻ってこない・BGM がマップの曲で鳴っていることを見る。
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const V2 = B.V2;
const MAP = 'pharos_inn';

(async function main() {
  if (!process.argv.includes('--no-build')) execFileSync('node', [path.join(V2, 'tools', 'build.js')], { stdio: 'inherit' });
  const S = await B.start();
  const T = +process.env.V2_OPEN_TIMEOUT || 180000;
  try {
    const P = await B.open(S, 'dev.html?fixture=cast_pharos', { timeout: T });
    const p = P.page;
    await B.waitFor(p, "(RPG.Engine.top()||{}).id==='field'", T);
    await B.press(p, 'b');   // 音を起こす操作
    await p.evaluate(async (m) => {
      const R = window.RPG;
      R.Audio.init();
      R.Game.gold = 999;
      await R.Field.enter(m, 'door', { fade: 0, noAutosave: true });
    }, MAP);
    await B.waitFor(p, "RPG.Audio.debug().playing === 'town'", 60000);
    const mapBgm = await p.evaluate((m) => RPG.DB.maps[m].bgm, MAP);
    const st = () => p.evaluate(() => {
      const d = RPG.Audio.debug();
      return { cur: d.current, playing: d.playing, jingle: d.jingle, fade: RPG.Engine.fade.a, top: (RPG.Engine.top() || {}).id, msg: RPG.UIK.Message.busy(), done: !!window.__innDone, t: RPG.Engine.time };
    });
    const start = () => p.evaluate(() => { window.__innDone = false; RPG.Events.run('pharos_innkeeper', { map: RPG.Field.pos.map }).then(() => { window.__innDone = true; }); });
    // おかみの最初の言葉 → 宿の画面 → 「泊まる」→ 暗転（ジングルが始まるまで）
    const toNight = async () => {
      await start();
      await B.pressUntil(p, 'a', "(RPG.Engine.top()||{}).id==='screen:inn'", 20);
      await B.press(p, 'a');
      await B.waitFor(p, "RPG.Audio.debug().jingle === 'inn'", 20000);
      return p.evaluate(() => RPG.Engine.time);
    };

    // ============================================================ 1) 連打 → 2.5 秒の後に飛ばす
    section('rest, mash A at once (ignored), press after 2.5 s (skip)');
    const g0 = await p.evaluate(() => RPG.Game.gold);
    let t0 = await toNight();
    for (let i = 0; i < 8; i++) await B.press(p, 'a', 40);
    let s = await st();
    const early = s.t - t0;
    ok(`early presses ignored (${Math.round(early)} ms in: dark, jingle on, no message)`, early < 2500 ? s.fade > 0.99 && s.jingle === 'inn' && !s.msg && !s.done : true);
    await B.waitFor(p, `RPG.Engine.time - ${t0} > 2700`, 30000);
    s = await st();
    ok('nothing fired on its own at 2.5 s (the ignored presses were not buffered)', s.fade > 0.99 && s.jingle === 'inn' && !s.msg);
    await B.press(p, 'a');
    await B.waitFor(p, 'RPG.UIK.Message.busy() && RPG.Engine.fade.a < 0.01', 20000);
    s = await st();
    ok('skipped: faded back in, jingle closed, the morning line is open (the skip press did not advance it)', s.fade < 0.01 && s.jingle === null && s.msg && !s.done);
    ok('skipped: BGM is the map\'s again (' + mapBgm + ')', s.cur === mapBgm && s.playing === mapBgm);
    await B.pressUntil(p, 'a', 'window.__innDone', 10);
    await p.waitForTimeout(2500);
    s = await st();
    ok('after the event: map BGM playing, no jingle, gold paid', s.done && s.playing === mapBgm && s.jingle === null && (await p.evaluate(() => RPG.Game.gold)) < g0);

    // ============================================================ 2) 押さない
    section('rest, no press (ends with the jingle)');
    await p.waitForTimeout(800);
    t0 = await toNight();
    await B.waitFor(p, 'RPG.UIK.Message.busy() && RPG.Engine.fade.a < 0.01', 30000);
    s = await st();
    ok(`no skip: dark until the jingle ended (${Math.round(s.t - t0)} ms), then fade in`, s.t - t0 > 4000 && s.jingle === null && s.msg);
    ok('no skip: BGM is the map\'s again', s.cur === mapBgm && s.playing === mapBgm);
    await B.pressUntil(p, 'a', 'window.__innDone', 10);
    await p.waitForTimeout(2000);
    s = await st();
    ok('after the event: map BGM playing, no jingle', s.done && s.playing === mapBgm && s.jingle === null);

    ok('no console errors', P.errors.length === 0, P.errors.slice(0, 3).join(' | '));
    await P.close();
  } finally { await B.stop(S); }
  done('test_inn_browser');
})().catch((e) => { console.error(e); process.exit(1); });
