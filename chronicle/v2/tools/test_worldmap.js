#!/usr/bin/env node
// 世界の地図の画面（羊皮紙の一枚絵、src/data/worldmap.js・screens/map.js）の検査。
//   node v2/tools/test_worldmap.js            node: 表の形・体験版のエリアと町・ダンジョンの印が絵の中・地方の霧
//   node v2/tools/test_worldmap.js --browser  ブラウザ: エリア・町・ダンジョンで地図を開いて描け、コンソールのエラーが無い（撮るのは --shots <dir>）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const V2 = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const R = require('./lib/load')({ quiet: true });
const WM = R.WorldMap;
const def = R.Screens && R.Screens._defs && R.Screens._defs.map;

section('1. 表');
ok('R.WorldMap がある', !!WM && Array.isArray(WM.size));
ok('絵がある（v2/assets/env/' + (WM && WM.image) + '.png）', !!WM && fs.existsSync(path.join(V2, 'assets', 'env', WM.image + '.png')));
ok('地図の画面に paintPos・drawParchment', !!def && typeof def.paintPos === 'function' && typeof def.drawParchment === 'function');

section('2. 印が絵の中');
const inside = (c) => c && c[0] >= 0 && c[1] >= 0 && c[0] <= WM.size[0] && c[1] <= WM.size[1];
const maps = R.DB.maps;
const demo = Object.values(maps).filter((m) => m && m.kind === 'field');
for (const m of demo) {
  const c = def.paintPos.call(def, m.id), c0 = def.paintPos.call(def, m.id, 0, 0), c1 = def.paintPos.call(def, m.id, m.w - 1, m.h - 1);
  ok(`${m.id}（${m.name}）: 中ほど・四隅が絵の中`, inside(c) && inside(c0) && inside(c1), JSON.stringify([c, c0, c1]));
}
for (const id of ['roa', 'pharos', 'lighthouse_1', 'well', 'fern', 'yura', 'hut', 'verda_1', 'elder_1']) {
  if (!maps[id]) continue;
  const c = def.paintPos.call(def, id);
  ok(`${id}: 印が絵の中`, inside(c), JSON.stringify(c));
}
section('3. 地方の霧');
for (const rid of Object.keys(R.DB.regions || {})) if (rid !== 'world') ok(`地方 ${rid} に霧の円がある`, Array.isArray(WM.regions[rid]) && WM.regions[rid].length > 0);

(async () => {
  if (argv.includes('--browser')) {
    section('4. ブラウザ');
    const B = require('./lib/browser');
    const S = await B.start();
    const P = await B.open(S, 'dev.html?fixture=content_p_pharos', { timeout: 180000 });
    const p = P.page;
    await B.waitFor(p, `${B.TOP}==='field'`, 120000);
    const shots = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
    for (const [id, sp] of [['f_roa', 'roa'], ['f_cape', 'lighthouse'], ['pharos', 'gate_w'], ['lighthouse_1', 'entrance'], ['f_windhill', 'yura']]) {
      await p.evaluate(async ([id, sp]) => { RPG.Mon.encounter = () => null; await RPG.Field.enter(id, sp, { fade: 0, noAutosave: true }); }, [id, sp]);
      await p.waitForTimeout(1500);
      await p.evaluate(() => { RPG.Screens.open('map'); });
      const opened = await B.waitFor(p, `(RPG.Engine.top()||{}).id==='screen:map'`, 10000).then(() => true, () => false);
      await p.waitForTimeout(2500);
      const st = await p.evaluate(() => { const d = RPG.WorldMap.drawn; return { drawn: !!(d && RPG.Engine.time - d.t < 1000), here: !!(d && d.here) }; });
      ok(`${id}: 地図が開いて羊皮紙が描け、今いる所の印がある`, opened && st.drawn && st.here, JSON.stringify(st));
      if (shots) { fs.mkdirSync(shots, { recursive: true }); await B.shot(p, path.join(shots, 'map_' + id + '.png')); }
      await p.keyboard.press('KeyX'); await p.waitForTimeout(600);
    }
    // 名前が重ならない（体験版の町・ダンジョン・エリアを全部行ったことにして、いちばん引いた所といちばん寄った所で）
    await p.evaluate(async () => {
      const G = RPG.Game; for (const m of Object.values(RPG.DB.maps)) if (m && (m.kind === 'field' || m.region === 'prologue' || m.region === 'r_forest')) G.visited[m.id] = true;
      await RPG.Field.enter('f_cape', 'lighthouse', { fade: 0, noAutosave: true }); RPG.Screens.open('map');
    });
    await B.waitFor(p, `(RPG.Engine.top()||{}).id==='screen:map'`, 10000).catch(() => null);
    for (const z of [1, 1.9, 4]) {
      await p.evaluate((z) => { const s = RPG.Engine.top(); const P = (s && s.pm) || (s && s.def && s.def.pm); if (P) { P.z = P.zt = z; } else { for (const k of Object.keys(s || {})) if (s[k] && s[k].pm) { s[k].pm.z = s[k].pm.zt = z; } } }, z);
      await p.waitForTimeout(1200);
      const L = await p.evaluate(() => (RPG.WorldMap.labels || []).map((l) => l.box).filter(Boolean));
      const bad = [];
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) bad.push(i + '/' + j); }
      const z1 = await p.evaluate(() => RPG.WorldMap.drawn && RPG.WorldMap.drawn.z);
      ok(`倍率 ${z}（${Math.round(z1 * 10) / 10}）: 名前 ${L.length} が重ならない`, bad.length === 0 && L.length > 0, bad);
      if (shots) await B.shot(p, path.join(shots, 'labels_z' + z + '.png'));
    }
    ok('コンソールのエラーが無い', P.errors.length === 0, P.errors.slice(0, 5));
    await B.stop(S);
  }
  done('test_worldmap');
})();
