#!/usr/bin/env node
// 体験版の出口のテスト（ブラウザ）: node v2/tools/test_demo_end_browser.js [--build] [--out <dir>]
//   フェルンの宿（フィクスチャ content_f_fern_inn）で森を解決した形にして T1 を流す →
//   前置き・字幕・記録の案内 → 終わりの画面（撮る）→ A でタイトルへ。引き継ぎの記録と計測（gtag の身代わり）を確かめる。
//   峠の境（f_cross の東の端）に踏み込むと「体験版では、ここから先へは行けません」が出て 1 歩下がる（撮る）。
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(B.V2, 'design', 'shots', 'demo_end');
if (argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js')], { stdio: 'inherit' });

(async () => {
  const S = await B.start();
  try {
    const P = await B.open(S, 'dev.html?fixture=content_f_fern_inn');
    const p = P.page;
    await p.evaluate(() => { window.__ga = []; window.gtag = function () { window.__ga.push(Array.from(arguments)); }; });
    await B.waitFor(p, "(RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy()", 15000);
    section('1. T1 → 体験版の終わり');
    await p.evaluate(() => {
      const G = RPG.Game;
      Object.assign(G.flags, { forest_boss: true, forest_finale_done: true });
      G.cleared.r_forest = true; G.tier = 1; G.playMs = 2 * 3600e3 + 47 * 60e3;
      RPG.Events.run('story_t1', {});
    });
    // 記録の案内は「あとで」を選ぶ（記録の画面は開かない）
    let sawCaption = false, sawChoose = false;
    for (let i = 0; i < 90; i++) {
      const st = await p.evaluate(() => ({ top: (RPG.Engine.top() || {}).id, cap: RPG.Engine.stack.some((s) => s.id === 'caption'), text: (RPG.UIK.Message && RPG.UIK.Message._cur && RPG.UIK.Message._cur.text) || '' }));
      if (st.top === 'demo_end') break;
      if (st.cap) sawCaption = true;
      if (st.top === 'screen:save') { await B.press(p, 'b'); continue; }
      const choosing = await p.evaluate(() => !!RPG.Game.flags.world_demo_end && RPG.Engine.stack.some((s) => s.id === 'message'));
      if (choosing && !sawChoose && sawCaption) { sawChoose = true; await p.waitForTimeout(500); await B.press(p, 'down'); }
      await B.press(p, 'a');
      await p.waitForTimeout(120);
    }
    ok('字幕（体験版は、ここまでです）が出た', sawCaption);
    ok('終わりの画面（場面 demo_end）に着いた', await B.waitFor(p, "(RPG.Engine.top()||{}).id==='demo_end'", 8000));
    await p.waitForTimeout(3400);
    await B.shot(p, path.join(OUT, 'demo_end_1920.png'));
    const rec = await p.evaluate(() => { const r = RPG.DemoCarry.find(); return r && { demo_clear: r.demo_clear, version: r.version, party: r.carry.party, gold: r.carry.gold, flag: !!r.carry.flags.world_demo_end }; });
    ok('引き継ぎの記録（demo_clear・版・パーティ）', !!(rec && rec.demo_clear && rec.version && rec.party.length === 4 && rec.flag), rec);
    const ga = await p.evaluate(() => window.__ga.map((a) => a[1]));
    ok('計測: story_milestone（story_t1・world_demo_end）と demo_end_reached', ga.includes('demo_end_reached') && ga.filter((n) => n === 'story_milestone').length >= 2, ga);
    ok('計測に主人公の名前が入らない', !(await p.evaluate(() => JSON.stringify(window.__ga).includes(RPG.Game ? RPG.Game.chars.hero.name : '\u0000'))));
    await B.press(p, 'a');
    ok('A でタイトルへ', await B.waitFor(p, "(RPG.Engine.top()||{}).id==='screen:title'", 8000));
    await p.waitForTimeout(1500);
    await B.shot(p, path.join(OUT, 'demo_end_title_after.png'));
    ok('つづきからで T1 をくり返さない（オートの枠に ev_story_t1）', await p.evaluate(() => { const o = JSON.parse(RPG.Save._raw('auto') || 'null'); return !!(o && o.state.flags.ev_story_t1 && o.state.flags.world_demo_end); }));
    ok('エラー 0', P.errors.length === 0, P.errors.slice(0, 5));
    await P.close();

    section('2. 峠の境の通せんぼ');
    const Q = await B.open(S, 'dev.html?fixture=content_f_fern_inn');
    const q = Q.page;
    await B.waitFor(q, "(RPG.Engine.top()||{}).id==='field' && !RPG.Events.busy()", 15000);
    const spot = await q.evaluate(async () => {
      const m = RPG.DB.maps.f_cross, e = m.exits.find((x) => x.demoMirror);
      // 写しの出口の手前（西）で、歩けるマスを探す
      for (let d = 1; d < 4; d++) {
        for (let k = 0; k < e.h; k++) {
          const x = e.x - d, y = e.y + k;
          if (RPG.Field.passable('f_cross', x, y)) { await RPG.Field.enter('f_cross', { x, y, dir: 'e' }, { fade: 0, noAutosave: true }); return { x, y, ex: e.x, d }; }
        }
      }
      return null;
    });
    ok('峠の手前に立てた', !!spot, spot);
    let msg = false;
    for (let i = 0; i < 6 && !msg; i++) {
      await B.press(q, 'right', 220);
      msg = await B.waitFor(q, "RPG.Engine.stack.some((s)=>s.id==='message')", 900);
    }
    ok('「体験版では、ここから先へは行けません」が出る', msg);
    await q.waitForTimeout(700);
    await B.shot(q, path.join(OUT, 'demo_boundary_1920.png'));
    await B.pressUntil(q, 'a', "!RPG.Engine.stack.some((s)=>s.id==='message')", 10);
    await q.waitForTimeout(600);
    ok('境の先へ出ない（f_cross に残る）', await q.evaluate(() => RPG.Game.pos.map === 'f_cross'));
    ok('エラー 0（境）', Q.errors.length === 0, Q.errors.slice(0, 5));
    await Q.close();
  } finally { await B.stop(S); }
  done('test_demo_end_browser');
})().catch((e) => { console.error(e); process.exitCode = 1; });
