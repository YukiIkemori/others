#!/usr/bin/env node
// QA: 回復の泉の置き方（V2_PLAN §3.16 の 3「check_springs」、WORLD_REDESIGN §6.2 の 1〜6）。node だけ（FIELD の当たりは tools/lib/maps.js）。
//
//   node v2/tools/qa/check_springs.js [--verbose]
//
// 1. 各ダンジョンの途中に 1 つ以上: 入口から、そのダンジョンの行き先（ボス・いちばん奥）までの道のりの 40〜60% の所
// 2. ボスの前に 1 つ（中ボスの前にも）: ボスの範囲（トリガー）から同じ階の泉まで 60 歩以内
// 3. 長い道: 泉から泉（または入口）まで 150 歩を超える区間が無い
// 4. 隠し通路の先の「ご褒美の泉」は任意（数えるだけ）
// 5. 泉の周り（半径 3 マス）は魔物が出ない: FIELD の safeAt が 'spring' を返し、R.Mon.encounter を振らない
// 6. 見つけた泉は地図に印: 泉を使うと R.Game.springs に残り、小さな地図と地図の画面がそれを描く
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);

const { dungeonRoutes, prepare } = require('../lib/routes');

section('1〜3. 道のりと泉（入口 → ボス・いちばん奥）');
const summary = [];
for (const r of dungeonRoutes(R)) {
  const d = r.def;
  if (r.error) { ok(`${d.id}: 入口から行き先まで道がある`, false); continue; }
  const { total, onRoute, springs, segments } = r;
  const mid = onRoute.filter((s) => s.frac >= 0.4 && s.frac <= 0.6);
  ok(`${d.id}: 道のり ${total} 歩の 40〜60% に泉（${onRoute.map((s) => `${s.id} ${Math.round(s.frac * 100)}%`).join('、') || 'なし'}）`, mid.length >= 1, springs);
  const maxGap = Math.max(...segments.map((g) => g.steps));
  ok(`${d.id}: 泉から泉（入口）まで 150 歩以内（いちばん長い区間 ${maxGap} 歩）`, maxGap <= 150);
  summary.push({ dungeon: d.id, steps: total, springs: onRoute.map((s) => ({ id: s.id, at: s.at, pct: Math.round(s.frac * 100) })), segments: segments.map((g) => `${g.from}→${g.to} ${g.steps} 歩`) });
  prepare(R, d);
  // 2. ボスの前
  for (const [bm, bev] of d.bosses) {
    const places = M.eventPlaces(bev, { all: true }).filter((p) => p.map === bm);
    const bc = places.flatMap((p) => M.standCells(bm, p));
    let best = null;
    for (const s of M.springs(bm)) {
      const res = M.bfs(bm, M.standCells(bm, { kind: 'obj', ref: s }).filter((c) => R.Field._walkable(R.DB.maps[bm], c.x, c.y, null, 0)));
      for (const c of bc) { const v = res.get(c.x, c.y, c.lv || 0); if (v != null && (best == null || v < best.d)) best = { d: v, id: s.id }; }
    }
    ok(`${d.id}: ${bev} の前（同じ階、60 歩以内）に泉（${best ? best.id + ' ' + best.d + ' 歩' : 'なし'}）`, !!best && best.d <= 60);
  }
}
if (VERBOSE) console.log(JSON.stringify(summary, null, 1));

section('4. ご褒美の泉（隠し通路の先。数えるだけ）');
{
  let n = 0;
  for (const id of M.sliceMaps()) {
    const m = R.DB.maps[id];
    if (m.kind !== 'dungeon') continue;
    const noSecret = M.bfs(m, Object.keys(m.spawns || {}).map((s) => M.dest({ map: id, spawn: s })), { blocked: (x, y) => { const c = R.MapUtil.cell(m, x, y); return !!(c && c.secret); } });
    for (const s of M.springs(m)) if (!M.standCells(m, { kind: 'obj', ref: s }).some((c) => noSecret.get(c.x, c.y, c.lv))) n++;
  }
  console.log(`    隠し通路の先の泉: ${n}`);
  ok('ご褒美の泉は任意（0 でもよい）', true);
}

section('5. 泉の周り 3 マスは出現なし（FIELD の safeAt）');
{
  const F = R.Field, S = F._s;
  const bad = [];
  let n = 0;
  R.State.newGame({ seed: 3 });
  for (const id of M.sliceMaps()) {
    const m = R.DB.maps[id];
    S.map = m;
    for (const s of M.springs(m)) {
      for (let y = s.y - 3; y <= s.y + 4; y++) for (let x = s.x - 3; x <= s.x + 4; x++) {
        n++;
        if (F.safeAt(x, y) !== 'spring') bad.push(`${id} ${s.id} ${x},${y}`);
      }
      if (F.safeAt(s.x - 5, s.y) === 'spring') bad.push(`${id} ${s.id}: safe too far (${s.x - 5},${s.y})`);
    }
  }
  S.map = null;
  ok(`泉の周り 3 マス（${n} マス）で safeAt = 'spring'、5 マス先は違う`, bad.length === 0, bad.slice(0, 6));
  const mv = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'move.js'), 'utf8');
  ok('出現の判定の前に safeAt を見る（FIELD の _encounterStep）', /if \(!zone \|\| F\.safeAt\(S\.x, S\.y\)\) return null;/.test(mv));
}

section('6. 見つけた泉の印（地図・小さな地図）');
{
  const mv = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'move.js'), 'utf8');
  ok('泉を使うと R.Game.springs[map] に id が残る', /G\.springs\[m\.id\]/.test(mv));
  const mm = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'minimap.js'), 'utf8');
  ok('小さな地図が泉の印を描く（springs を読む）', /spring/.test(mm), 'minimap.js');
  const ms = fs.readFileSync(path.join(V2, 'src', 'screens', 'map.js'), 'utf8');
  // 地図の画面（E13）はワールドの一枚絵だけで、ダンジョンの階の絵は無い（泉はワールドに無い）。印は階の小さな地図だけに出る
  console.log(`    地図の画面: ${/spring/.test(ms) ? '泉の印あり' : 'ワールドの一枚絵だけ（階の地図は無いので、泉の印は小さな地図だけ）'}`);
}
done('check_springs');
