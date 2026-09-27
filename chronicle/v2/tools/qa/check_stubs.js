#!/usr/bin/env node
// QA: 仮の実装が残っていないこと（V2_PLAN §3.16 の 3「check_stubs」、§4.3「仮の箱が画面に残っていない」）。
//
//   node v2/tools/qa/check_stubs.js [--no-browser]
//
// 1. node: R.Stubs.install() が埋めた関数が 0（どの名前空間も本物）。仮のデータ（id が stub_）は埋まってよいが、縦切りのマップ・イベント・
//    出現表・編成・店・設定の始まりから参照されない。
// 2. ブラウザ（dist/index.html）: 起動 → タイトル → はじめから → ロアの里で歩いて話すまで入力の真似で進め、R.Stubs.report() が空。
// 3. 通しの記録（design/qa/playthrough/*.json）と一覧の撮影（design/shots/slice/index.json）に残った R.Stubs.report() がすべて空。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
(async () => {
  section('1. node: 埋まった仮の関数');
  const R = require('../lib/load')({ quiet: true });
  const inst = R.Stubs.installed || {};
  const fns = Object.keys(inst).filter((k) => !/^DB\./.test(k));
  ok('仮の実装で埋まった名前空間の関数 0', fns.length === 0, fns.map((k) => k + ': ' + inst[k].join(',')));
  const data = Object.keys(inst).filter((k) => /^DB\./.test(k)).map((k) => k + ': ' + inst[k].join(','));
  console.log(`    仮のデータ（id が stub_、使わない物）: ${data.join(' ／ ') || 'なし'}`);
  const M = require('../lib/maps').create(R);
  const refs = [];
  const real = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !/stub/.test(k)));
  const src = JSON.stringify(M.sliceMaps().map((id) => R.DB.maps[id])) + JSON.stringify(real(R.DB.encounters)) + JSON.stringify(real(R.DB.troops)) + JSON.stringify(real(R.DB.shops)) + JSON.stringify(R.DB.config.start) + JSON.stringify(real(R.DB.locations));
  for (const m of src.matchAll(/"(stub_[\w]+)"/g)) refs.push(m[1]);
  const evSrc = fs.readdirSync(path.join(V2, 'src', 'events')).map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
  for (const m of evSrc.matchAll(/'(stub_[\w]+)'/g)) refs.push(m[1]);
  ok('縦切りのデータ・イベントが stub_ の id を参照しない', refs.length === 0, [...new Set(refs)]);
  ok('始まりの場所は本物（roa_house の roa_house_intro）', R.DB.config.start.map === 'roa_house' && R.DB.config.start.event === 'roa_house_intro', R.DB.config.start);

  if (!process.argv.includes('--no-browser')) {
    section('2. ブラウザ: 起動 → はじめから → ロアの里');
    const B = require('../lib/browser');
    const S = await B.start();
    const P = await B.open(S, 'index.html');
    try {
      await P.page.addScriptTag({ content: fs.readFileSync(path.join(V2, 'tools', 'lib', 'maps.js'), 'utf8') });
      await P.page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8') });
      await P.page.waitForFunction("RPG.Engine.top() && RPG.Engine.top().id === 'screen:title'", null, { timeout: 30000 });
      const routes = require('./playthrough').routeDef('R1');
      routes.goals = routes.goals.slice(0, 2);   // ベルナ・畑の人まで
      await P.page.evaluate((r) => window.__bot.setup(r), routes);
      let st = null;
      for (let i = 0; i < 40; i++) { st = await P.page.evaluate(() => window.__bot.run(300)); if (st.done || st.fail) break; }
      const rep = await P.page.evaluate(() => ({ stubs: RPG.Stubs.report(), hero: !!(RPG.Game && RPG.Game.chars.hero), berna: !!(RPG.Game && RPG.Game.flags.prologue_berna) }));
      ok('入力の真似でベルナまで進む', rep.berna, st);
      ok('R.Stubs.report() が空', rep.stubs.length === 0, rep.stubs);
      ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
    } finally { await P.close(); await B.stop(S); }
  }

  section('3. 通しと撮影の記録');
  const dir = path.join(V2, 'design', 'qa', 'playthrough');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.json$/.test(f)) : [];
  if (!files.length) console.log('    （通しの記録がまだ無い: node v2/tools/qa/playthrough.js）');
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const s = (j.final && j.final.stubs) || [];
    ok(`${f}: 通しで仮の実装が呼ばれない`, s.length === 0, s);
  }
  const shots = path.join(V2, 'design', 'shots', 'slice', 'index.json');
  if (fs.existsSync(shots)) {
    const j = JSON.parse(fs.readFileSync(shots, 'utf8'));
    const bad = (j.shots || []).filter((s) => s.stubs && s.stubs.length).map((s) => s.file + ': ' + JSON.stringify(s.stubs));
    ok(`一覧の撮影 ${(j.shots || []).length} 枚で仮の実装が呼ばれない`, bad.length === 0, bad.slice(0, 5));
  }
  done('check_stubs');
})().catch((e) => { console.error(e); process.exit(2); });
