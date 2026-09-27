#!/usr/bin/env node
// QA: 回復の泉の置き方（V2_PLAN §3.16 の 3「check_springs」、WORLD_REDESIGN §6.2 の 1〜5）。node だけ（FIELD の当たりは tools/lib/maps.js）。
//
//   node v2/tools/qa/check_springs.js [--verbose]
//
// オーナーの決まり（2026-09）:「泉が不自然に多すぎる。1 フロアに 1 個とか置く必要ない。長いダンジョンの時だけ 1 個」。
//   ダンジョン = kind 'dungeon' のマップを名前（map.name）でまとめたもの。階の深さ = 外（町・ワールド・屋内）から数えて何階目か
//   （ほかのダンジョンを通って入るなら、その階も数える。千年樹は迷いの森の 2 階の奥から入るので 3〜4 階目）。
// 1. 1 ダンジョンに泉は 1 つまで
// 2. 短いダンジョン（いちばん深い階が外から 2 階目まで = LONG_DEPTH 未満）は 0
// 3. 長いダンジョン（いちばん深い階が外から 3 階目以上）はちょうど 1。入口の階（外とつながる階）には置かない
// 4. 置く所に意味がある: 道のりの表（tools/lib/routes.js）にボスがあるダンジョンは、最後のボスと同じ階で 60 歩以内（ボスの前の泉）
// 5. 泉の周り（半径 3 マス）は魔物が出ない: FIELD の safeAt が 'spring' を返し、R.Mon.encounter を振らない
// 6. 見つけた泉は地図に印: 泉を使うと R.Game.springs に残り、小さな地図がそれを描く
// 町・宿場・屋内・ワールドの泉（ダンジョンの外）は数えない（一覧だけ出す）。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
const { DUNGEONS, prepare, restore } = require('../lib/routes');

/** 長いダンジョンのしきい値: 外から数えて 3 階目以上の階があるダンジョン */
const LONG_DEPTH = 3;
/** ボスの前の泉: ボスの範囲から同じ階の泉まで */
const BOSS_STEPS = 60;

const D = R.DB.maps;
const isDungeon = (id) => !!D[id] && D[id].kind === 'dungeon';
const links = (id) => [...new Set(M.portals(id, { all: true }).map((p) => p.to && p.to.map).filter((x) => x && D[x] && x !== id))];

// ダンジョン（名前でまとめる）
const groups = {};
for (const id of Object.keys(D).sort()) if (isDungeon(id) && !/^(stub_|field_|t_)/.test(id)) (groups[D[id].name || id] = groups[D[id].name || id] || []).push(id);
// 階の深さ: 外のマップから入った階を 1 とし、ダンジョンの階を通るたびに 1 足す（双方向につながる前提で、つながりを両向きに見る）
const adj = {};
const addEdge = (a, b) => { (adj[a] = adj[a] || new Set()).add(b); (adj[b] = adj[b] || new Set()).add(a); };
for (const id of Object.keys(D)) if (isDungeon(id)) for (const to of links(id)) addEdge(id, to);
const depth = {};
{
  const q = [];
  for (const id of Object.keys(adj)) if (isDungeon(id) && [...adj[id]].some((x) => !isDungeon(x))) { depth[id] = 1; q.push(id); }
  while (q.length) {
    const id = q.shift();
    for (const nx of adj[id]) if (isDungeon(nx) && depth[nx] == null) { depth[nx] = depth[id] + 1; q.push(nx); }
  }
}

section(`1〜3. 1 ダンジョンに 1 つまで・短い（外から ${LONG_DEPTH - 1} 階目まで）は 0・長いは 1（入口の階でない）`);
const table = [];
for (const [name, floors] of Object.entries(groups)) {
  const springs = floors.flatMap((id) => M.springs(id).map((s) => ({ map: id, id: s.id })));
  const deep = Math.max(...floors.map((id) => depth[id] || 0));
  const top = Math.min(...floors.map((id) => depth[id] || 1));
  const entry = floors.filter((id) => (depth[id] || 1) === top);   // 入口の階（外、または前のダンジョンから入る階）
  const long = deep >= LONG_DEPTH;
  table.push({ name, floors: floors.length, deep, long, springs: springs.map((s) => s.map + ':' + s.id) });
  ok(`${name}（${floors.length} 階、外から ${deep} 階目まで、${long ? '長い' : '短い'}）: 泉 ${springs.length}（${springs.map((s) => s.id).join('、') || 'なし'}）`,
    long ? springs.length === 1 : springs.length === 0, { floors, springs });
  const onEntry = springs.filter((s) => entry.includes(s.map));
  ok(`${name}: 入口の階（${entry.join('、')}）に泉が無い`, onEntry.length === 0, onEntry);
}
if (VERBOSE) console.log(JSON.stringify({ depth, table }, null, 1));
{
  const outside = Object.keys(D).filter((id) => !isDungeon(id)).flatMap((id) => M.springs(id).map((s) => `${id}:${s.id}${s.cond ? '（' + s.cond + '）' : ''}`));
  console.log(`    ダンジョンの外の泉（数えない）: ${outside.join('、') || 'なし'}`);
}

section(`4. 長いダンジョンの泉はボスの前（同じ階、${BOSS_STEPS} 歩以内）`);
for (const d of DUNGEONS) {
  if (!d.bosses || !d.bosses.length) continue;
  const floors = Object.values(groups).find((fl) => fl.includes(d.start.map)) || [];
  const springs = floors.flatMap((id) => M.springs(id).map((s) => ({ map: id, s })));
  if (!springs.length) continue;
  prepare(R, d);
  const [bm, bev] = d.bosses[0];
  const bc = M.eventPlaces(bev, { all: true }).filter((p) => p.map === bm).flatMap((p) => M.standCells(bm, p));
  let best = null;
  for (const { map, s } of springs) {
    if (map !== bm) continue;
    const res = M.bfs(bm, M.standCells(bm, { kind: 'obj', ref: s }).filter((c) => R.Field._walkable(D[bm], c.x, c.y, null, 0)));
    for (const c of bc) { const v = res.get(c.x, c.y, c.lv || 0); if (v != null && (best == null || v < best.d)) best = { d: v, id: s.id }; }
  }
  ok(`${d.id}: ${bev} の前に泉（${best ? best.id + ' ' + best.d + ' 歩' : 'なし'}）`, !!best && best.d <= BOSS_STEPS);
}
restore(R);

section('5. 泉の周り 3 マスは出現なし（FIELD の safeAt）');
{
  const F = R.Field, S = F._s;
  const bad = [];
  let n = 0;
  R.State.newGame({ seed: 3 });
  for (const id of M.sliceMaps()) {
    const m = D[id];
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

section('6. 見つけた泉の印（小さな地図）');
{
  const mv = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'move.js'), 'utf8');
  ok('泉を使うと R.Game.springs[map] に id が残る', /G\.springs\[m\.id\]/.test(mv));
  const mm = fs.readFileSync(path.join(V2, 'src', 'systems', 'field', 'minimap.js'), 'utf8');
  ok('小さな地図が泉の印を描く（springs を読む）', /spring/.test(mm), 'minimap.js');
}
done('check_springs');
