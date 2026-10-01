#!/usr/bin/env node
// 持ち主の製品版の試遊（2026-10-01）の砂漠の報告の戻りの確かめを、本物のキー入力で（ブラウザ。dist/dev.html が要る = tools/build.js の後）。
//   node v2/tools/test_desert_fixes_1001_browser.js
//   1. カシムの西の門・東の門: 門の前の道から門へ向かってキーを押したまま歩くと、カシムに入る（門の奥まで回り込まなくてよい）。
//   2. カシムの門から出ると門の前に着き、そのまま立っていても入り直さない。向きを変えて門へ 1 歩で入れる。
//   3. 王墓のオアシス: 王墓の戸口の 2 マスのどちらへ歩いても、砂の王墓に入る。
'use strict';
const Bw = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

(async () => {
  const S = await Bw.start();
  const P = await Bw.open(S, 'dev.html?fixture=content_d_kasim', { timeout: +process.env.V2_OPEN_TIMEOUT || 90000 });
  const page = P.page;
  await page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id==='field' && RPG.Engine.fade.a<0.02", null, { timeout: 90000 });
  await page.evaluate(() => { RPG.DB.config.slice = false; RPG.MapUtil.invalidate && RPG.MapUtil.invalidate(); });
  const pos = () => page.evaluate(() => { const p = RPG.Field.pos || {}; return { map: p.map, x: p.x, y: p.y }; });
  const put = async (map, x, y, dir, flags) => {
    await page.evaluate(async ([map, x, y, dir, flags]) => {
      const R = window.RPG; Object.assign(R.Game.flags, flags || {}); R.MapUtil.invalidate && R.MapUtil.invalidate();
      await R.Field.enter(map, { x, y, dir }, { fade: 0, noAutosave: true });
    }, [map, x, y, dir, flags || {}]);
    await page.waitForTimeout(400);
  };
  // キーを押したまま、行き先のマップに着くまで（会話・確かめが出たら決定で進める）
  const hold = async (key, want, ms) => {
    await page.keyboard.down(Bw.KEY[key]);
    let got = null;
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 6000)) {
      await page.waitForTimeout(100);
      const busy = await page.evaluate(() => RPG.Events.busy() || RPG.UIK.Message.busy());
      if (busy) await Bw.press(page, 'a');
      const p = await pos();
      if (p.map === want) { got = p; break; }
    }
    await page.keyboard.up(Bw.KEY[key]);
    await page.waitForFunction('RPG.Engine.fade.a < 0.02', null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    return got;
  };

  section('カシムの門へ歩いて入る');
  for (const g of [
    { map: 'd_west', from: [50, 20], key: 'right', out: 'gate_w', back: 'left' },
    { map: 'd_west', from: [50, 21], key: 'right', out: 'gate_w', back: 'left' },   // y 19 は門の脇の火鉢（53,19）の列
    { map: 'd_east', from: [9, 17], key: 'left', out: 'gate_e', back: 'right' },
    { map: 'd_east', from: [9, 18], key: 'left', out: 'gate_e', back: 'right' },
  ]) {
    await put(g.map, g.from[0], g.from[1], g.key === 'right' ? 'e' : 'w');
    const got = await hold(g.key, 'kasim', 5000);
    ok(`${g.map} (${g.from}) から門へ歩くとカシムに入る`, !!got, await pos());
  }

  section('カシムから出ると門の前、入り直さない');
  for (const g of [
    { gate: 'gate_w', key: 'left', map: 'd_west', at: [54, 20], back: 'right' },
    { gate: 'gate_e', key: 'right', map: 'd_east', at: [5, 17], back: 'left' },
  ]) {
    const sp = await page.evaluate((s) => RPG.DB.maps.kasim.spawns[s], g.gate);
    await put('kasim', sp.x, sp.y, sp.dir);
    const got = await hold(g.key, g.map, 6000);
    ok(`カシムの ${g.gate} から出ると ${g.map} の門の前 (${g.at}) に着く`, !!got && got.x === g.at[0] && got.y === g.at[1], got);
    await page.waitForTimeout(1500);
    const still = await pos();
    ok(`${g.map}: 着いた所で立っていても入り直さない`, still.map === g.map, still);
    const again = await hold(g.back, 'kasim', 3000);
    ok(`${g.map}: 門へ向いて歩けばすぐカシムに入る`, !!again, await pos());
  }

  section('砂の王墓の戸口');
  for (const x of [21, 22]) {
    await put('desert_camp3', x, 8, 'n', { desert_camp3_done: true });
    const got = await hold('up', 'desert_tomb_1', 5000);
    ok(`王墓のオアシス (${x},8) から北へ歩くと砂の王墓に入る`, !!got, await pos());
  }
  await put('desert_camp3', 21, 8, 'n', { desert_camp3_done: true });
  const marks = await page.evaluate(() => RPG.Field.wayfind.info(RPG.DB.maps.desert_camp3).exits.filter((e) => e.to.map === 'desert_tomb_1').map((e) => [e.x, e.y, e.w, e.h]));
  ok('王墓の入口の印は 1 つ（2 マス幅）', marks.length === 1 && marks[0][2] === 2, marks);

  ok('コンソールのエラーが無い', P.errors.length === 0, P.errors.slice(0, 3));
  await P.close();
  await Bw.stop(S);
  done('test_desert_fixes_1001_browser');
})().catch((e) => { console.error(e); process.exit(1); });
