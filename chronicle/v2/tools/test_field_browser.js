#!/usr/bin/env node
// FIELD（V2_PLAN §4.4、ブラウザ）: ダッシュで走り続けて焼けていないチャンクが画面に出ない・全滅（宿から）の後の不変条件と 60 フレーム以内に歩ける・
// コンソールのエラー 0・外への通信 0、そして §4.4 のスクショ（ファロス・フェルン・迷いの森の暗がり・ワールド・灯台 × 16:9／縦／横、広さ 3 段）。
//   node v2/tools/test_field_browser.js [--build] [--no-shots]
// ページは dist/dev_test_field_fx.html（node v2/tools/build.js --with v2/tools/test_field_fx）。撮った PNG は必ず Read で見る（§2.9）。
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');
const B = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');
const PAGE = 'dev_test_field_fx.html';
const OUT = path.join(B.V2, 'design', 'shots', 'field');

async function openFx(S, fx, o) {
  const P = await B.open(S, `${PAGE}?fixture=${fx}`, o);
  await B.waitFor(P.page, `${B.TOP}==='field' && RPG.Engine.fade.a < 0.01`, 5000);
  return P;
}
async function hold(p, keys, ms) {
  for (const k of keys) await p.keyboard.down(B.KEY[k]);
  await p.waitForTimeout(ms);
  for (const k of keys) await p.keyboard.up(B.KEY[k]);
}

async function main() {
  if (process.argv.includes('--build')) execFileSync('node', [path.join(B.V2, 'tools', 'build.js'), '--with', path.join(B.V2, 'tools', 'test_field_fx')], { stdio: 'inherit' });
  const S = await B.start();
  const errors = [];

  section('ダッシュで走り続けても焼けていないチャンクが出ない（§2.10）');
  for (const zoom of ['normal', 'far']) {
    const P = await openFx(S, 'field_world');
    const p = P.page;
    await B.ev(p, `(RPG.Settings.set('fieldZoom', '${zoom}'), RPG.Field.enter('field_world', {x: 70, y: 25, dir: 'w'}, {fade: 0, noAutosave: true}))`);
    await p.waitForTimeout(400);
    await B.ev(p, `(RPG.Mon.encounter = () => null, RPG.Field._s.stat.miss = 0, 0)`);
    const x0 = (await B.ev(p, 'RPG.Field.pos')).x;
    await hold(p, ['left', 'dash'], 1500);
    await hold(p, ['up', 'dash'], 900);
    await hold(p, ['left', 'dash'], 2500);
    const st = await B.ev(p, 'RPG.Field.chunks.stats()');
    const pos = await B.ev(p, 'RPG.Field.pos');
    ok(`[${zoom}] ran ≥ 20 tiles`, x0 - pos.x >= 20, { x0, pos });
    ok(`[${zoom}] no unbaked chunk on screen while dashing`, st.miss === 0, st);
    ok(`[${zoom}] chunk memory within BUDGET.mb.chunk`, st.bytes <= (await B.ev(p, 'RPG.Hd.BUDGET.mb.chunk')) * 1048576, st);
    const fs = await B.ev(p, 'RPG.Engine.frameStats()');
    console.log(`      frame avg ${fs.avg.toFixed(2)} ms, p95 ${fs.p95.toFixed(2)} ms, max ${fs.max.toFixed(1)} ms, enter ${st.enterMs.toFixed(0)} ms`);
    errors.push(...P.errors);
    await P.close();
  }

  section('全滅（宿から）の後の不変条件（§2.5.3）');
  {
    const P = await openFx(S, 'field_verda');
    const p = P.page;
    await B.ev(p, `(() => {
      RPG.Game.gold = 101;
      RPG.Game.lastInn = {map: 'field_pharos', x: 24, y: 16, dir: 's'};
      RPG.DB.events.t_fwipe = { async run(ev) { await ev.say(null, '途中の会話'); window.__reached = true; } };
      RPG.Events.run('t_fwipe', {map: 'field_verda'});
    })()`);
    ok('event with a message is running', await B.waitFor(p, 'RPG.Events.busy() && RPG.UIK.Message.busy()', 3000));
    await B.ev(p, `(RPG.State.wipeRecover(), window.__w = RPG.Flow.wipe('inn'), 0)`);
    const f0 = await B.ev(p, 'RPG.Engine.frame');
    ok('invariants within 60 frames', await B.waitFor(p, `(() => { const t = RPG.Engine.top(); return t && t.id === 'field' && !RPG.Events.busy() && !RPG.UIK.Message.busy() && RPG.Engine.fade.a < 0.01 && Object.keys(RPG.Field.locks()).length === 0 && RPG.Field.pos.map === 'field_pharos'; })()`, 4000));
    const f1 = await B.ev(p, 'RPG.Engine.frame');
    ok('… ≤ 60 frames', f1 - f0 <= 60, { frames: f1 - f0 });
    const inv = await B.invariants(p);
    ok('invariants (lib/browser)', inv.ok, inv);
    ok('R.Dev.invariants', (await B.ev(p, 'RPG.Dev.invariants()')).ok);
    await B.press(p, 'down', 200);
    ok('can walk after the wipe', await B.waitFor(p, 'RPG.Field.pos.y >= 17', 3000), await B.ev(p, 'RPG.Field.pos'));
    ok('the aborted event did not continue', !(await B.ev(p, '!!window.__reached')));
    errors.push(...P.errors);
    await P.close();
  }

  section('チャンクの焼き直し（宝箱を開けた・燭台をともした）');
  {
    const P = await openFx(S, 'field_verda_dark');
    const p = P.page;
    await B.ev(p, `RPG.Field.enter('field_verda', {x: 40, y: 10, dir: 'n'}, {fade: 0, noAutosave: true})`);
    await p.waitForTimeout(500);
    ok('dark area: 暗い shown, battleDark outside lights', await B.ev(p, 'RPG.Field.dark.on() && RPG.Field.dark.battleDark(46, 16)'));
    await B.press(p, 'a');
    await p.waitForTimeout(600);
    ok('brazier lit with A → R.Game.lit, light radius', await B.ev(p, "(RPG.Game.lit.field_verda||[]).includes('fv_b1') && RPG.Field.dark.litAt(42, 10)"));
    ok('visible chunks still ready after the re-bake', (await B.ev(p, 'RPG.Field.chunks.stats()')).ready >= 6);
    errors.push(...P.errors);
    await P.close();
  }

  if (!process.argv.includes('--no-shots')) {
    section('スクショ（§4.4 FIELD: 5 か所 × 3 つの大きさ、広さ 3 段）');
    const SIZES = [['1920', {}], ['phone', { phone: true }], ['land', { size: [844, 390], land: true }]];
    const MAPS = [['pharos', 'field_pharos', "RPG.Leads.pin('l_field_demo')"], ['fern', 'field_fern'], ['verda_dark', 'field_verda_dark'], ['world', 'field_world', "RPG.Leads.pin('l_field_demo')"], ['lighthouse', 'field_lighthouse']];
    for (const [sz, o] of SIZES) {
      for (const [name, fx, js] of MAPS) {
        const P = await B.open(S, `${PAGE}?fixture=${fx}`, o.phone ? { phone: true } : o.land ? { phone: true } : {});
        const p = P.page;
        if (o.land) await p.setViewportSize({ width: 844, height: 390 });
        await B.waitFor(p, `${B.TOP}==='field'`, 5000);
        if (js) await B.ev(p, `(${js}, 0)`);
        if (o.phone || o.land) await B.ev(p, `(RPG.Input.lastDevice = 'touch', 0)`);
        await p.waitForTimeout(900);
        await B.shot(p, path.join(OUT, `p1_${name}_${sz}.png`));
        errors.push(...P.errors);
        await P.close();
      }
    }
    for (const zoom of ['near', 'far']) {
      for (const [sz, o] of SIZES.slice(0, 2)) {
        const P = await B.open(S, `${PAGE}?fixture=field_pharos`, o);
        const p = P.page;
        await B.waitFor(p, `${B.TOP}==='field'`, 5000);
        await B.ev(p, `(RPG.Settings.set('fieldZoom', '${zoom}'), RPG.Leads.pin('l_field_demo'), 0)`);
        await p.waitForTimeout(900);
        await B.shot(p, path.join(OUT, `p1_pharos_${zoom}_${sz}.png`));
        await B.ev(p, `(RPG.Settings.set('fieldZoom', 'normal'), 0)`);
        errors.push(...P.errors);
        await P.close();
      }
    }
    // 吹き出し（泉で休む）・宝箱・小地図（歩いた後）
    {
      const P = await openFx(S, 'field_verda_spring');
      const p = P.page;
      await hold(p, ['up'], 260);
      await p.waitForTimeout(500);
      await B.shot(p, path.join(OUT, 'p1_verda_spring_bubble_1920.png'));
      errors.push(...P.errors);
      await P.close();
    }
  }

  ok('0 console errors / outside requests', errors.length === 0, errors.slice(0, 5));
  await B.stop(S);
  done('test_field_browser');
}
main().catch((e) => { console.error(e); process.exit(2); });
