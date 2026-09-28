#!/usr/bin/env node
// QA: 一括の検査（V2_PLAN §2.8「check_all」、§3.16）。P2 以降は報告の前に毎回これを通す。
//
//   node v2/tools/qa/check_all.js [--browser] [--full] [--only name,…] [--jobs 3]
//
// 既定（速い版）: ビルド → 各担当の node のテスト → validate → progress → 文・ボイス・手がかり・宝箱・隠し通路・泉・密度・世界・仮の実装・到達・階段・戸口の形・街灯
//                 → sim（sim_zones・--segments・sim_bosses・sim_growth・sim_glimmer --slice・sim_loot）
// --browser: 各担当のブラウザのテスト（test_*_browser・test_core_flow・test_core_wipe・test_field_slice・test_bscene_flow）と check_ui・measure_night
// --full:    --browser に加えて playthrough（5 本）・shots_slice・perf.js
// 最後に失敗の一覧（名前・終了コード・最後の数行）。結果は v2/design/qa/check_all.json にも書く。
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const V2 = path.resolve(__dirname, '..', '..');
const T = (f) => path.join(V2, 'tools', f);
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BROWSER = argv.includes('--browser') || argv.includes('--full');
const FULL = argv.includes('--full');
const ONLY = arg('--only', null);

const STEPS = [
  ['build', [T('build.js')], { serial: true }],
  // 各担当の node のテスト
  ...['test_core', 'test_core_contract', 'test_render', 'test_uik', 'test_cast', 'test_beast', 'test_terrain', 'test_field', 'test_events', 'test_rules', 'test_battle',
    'test_bscene', 'test_screens', 'test_content_p', 'test_content_f'].map((t) => [t, [T(t + '.js')]]),
  ['test_content_desert', [T('test_content_desert.js')]],   // 砂漠
  // QA の検査
  ['validate', [T('qa/validate.js')]],
  ['progress', [T('qa/progress.js')]],
  ['check_text', [T('qa/check_text.js')]],
  ['check_voice', [T('qa/check_voice.js')]],
  ['check_leads', [T('qa/check_leads.js')]],
  ['check_springs', [T('qa/check_springs.js')]],
  ['check_density', [T('qa/check_density.js')]],
  ['check_world', [T('qa/check_world.js')]],
  ['check_world_zones', [T('qa/check_world_zones.js')]],   // ワールドの出現表の地方が地面の地方と同じ（灯台の岬に灰の荒野の魔物が出ない）
  ['check_chests', [T('qa/check_chests.js'), '--no-build']],
  ['check_secrets', [T('qa/check_secrets.js'), '--no-build']],
  ['check_stubs', [T('qa/check_stubs.js')]],
  ['check_reach', [T('qa/check_reach.js')]],   // 戸口・出入り口・人・調べる物に出発から届く（FIELD の当たり、柵・物も）
  ['check_lamps', [T('qa/check_lamps.js')]],   // 街灯（当たりのある灯り）が道・戸口の前・出入り口・1 マス幅の所に無く、道をふさがない
  ['check_stairs', [T('qa/check_stairs.js')]],   // 階段で着くマス: 行き先の階段の隣・離れる向き・歩ける・すぐ移らない（R.Field.stairsLanding）
  ['check_doors --layout', [T('qa/check_doors.js'), '--layout']],   // 町の家の戸口: 外で移るのは戸の絵の下の 1 マス・屋内の出口も 1 マス・出て着くのは戸口の真下（下向き・すぐ移らない）
  // sim の速い版
  ['sim_zones', [T('sim_zones.js')]],   // --quick（n 120）は p95 などが標本のゆれで境を越えるので既定の n 400
  ['sim_zones --segments', [T('sim_zones.js'), '--segments', '--n', '60']],
  ['sim_bosses', [T('sim_bosses.js')]],
  ['sim_growth', [T('sim_growth.js')]],
  ['sim_glimmer', [T('sim_glimmer.js'), '--slice']],
  ['sim_loot', [T('sim_loot.js'), '--n', '30000']],
];
if (BROWSER) {
  STEPS.push(
    ...['test_core_flow', 'test_core_wipe', 'test_render_browser', 'test_uik_browser', 'test_cast_browser', 'test_beast_browser', 'test_terrain_browser',
      'test_field_browser', 'test_field_slice', 'test_events_browser', 'test_bscene_flow', 'test_screens_browser'].map((t) => [t, [T(t + '.js')], { browser: true }]),
    ['test_desert_doors_browser', [T('test_desert_doors_browser.js')], { browser: true }],   // 砂漠の戸口・出口・階段を本物の入力で
    ['check_doors', [T('qa/check_doors.js'), '--jobs', '2'], { browser: true }],   // 戸口・扉・階段・出口を本物のキー入力で歩いて入る＋人の絵が原画
    ['check_ui', [T('qa/check_ui.js')], { browser: true }],
    ['measure_night', [T('qa/measure_night.js'), '--json'], { browser: true }],
  );
}
if (FULL) {
  STEPS.push(
    ['playthrough', [T('qa/playthrough.js'), '--route', 'all', '--jobs', '2'], { browser: true, serial: true }],
    ['shots_slice', [T('qa/shots_slice.js')], { browser: true, serial: true }],
    ['perf', [T('qa/perf.js')], { browser: true, serial: true }],
  );
}

function run(name, args) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, args, { cwd: path.resolve(V2, '..'), env: process.env });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      const lines = out.trim().split('\n');
      const sum = lines.reverse().find((l) => /passed|pass\b|error\(s\)|routes passed|ok →|\d+\/\d+/.test(l)) || lines[0] || '';
      resolve({ name, code, ms: Date.now() - t0, summary: sum.trim().slice(0, 200), tail: out.trim().split('\n').slice(-12).join('\n') });
    });
  });
}

(async () => {
  const jobs = Math.max(1, +arg('--jobs', 3));
  const steps = STEPS.filter(([n]) => !ONLY || ONLY.split(',').includes(n));
  const results = [];
  let i = 0;
  // 直列の物（ビルド・通し・撮影）はその場で、ほかは jobs 本ずつ
  while (i < steps.length) {
    const [name, args, o] = steps[i];
    if (o && o.serial) { const r = await run(name, args); results.push(r); log(r); i++; continue; }
    const batch = [];
    while (i < steps.length && batch.length < ((o && o.browser) ? Math.min(2, jobs) : jobs) && !(steps[i][2] && steps[i][2].serial)) batch.push(steps[i++]);
    const rs = await Promise.all(batch.map(([n, a]) => run(n, a)));
    for (const r of rs) { results.push(r); log(r); }
  }
  const bad = results.filter((r) => r.code !== 0);
  console.log(`\ncheck_all: ${results.length - bad.length}/${results.length} passed`);
  if (bad.length) {
    console.log('\n失敗の一覧:');
    for (const r of bad) console.log(`\n--- ${r.name} (exit ${r.code})\n${r.tail}`);
  }
  const f = path.join(V2, 'design', 'qa', 'check_all.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ date: new Date().toISOString(), browser: BROWSER, full: FULL, results: results.map(({ tail, ...r }) => Object.assign(r, r.code ? { tail } : {})) }, null, 1));
  if (bad.length) process.exitCode = 1;
})();

function log(r) { console.log(`${r.code === 0 ? 'pass' : 'FAIL'}  ${r.name.padEnd(22)} ${(r.ms / 1000).toFixed(1).padStart(6)} s  ${r.summary}`); }
