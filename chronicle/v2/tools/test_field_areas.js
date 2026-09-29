#!/usr/bin/env node
// エリア切り替えのフィールド（kind 'field'、maps/field_*.js）の検査。node だけ。
//   node v2/tools/test_field_areas.js [--verbose]
//  1 形: 凡例・大きさ・spawn が歩ける・出口は端のマス（端の出口）か描いた戸口の上・出現表がある・世界の地図の四角 meta.worldRect
//  2 行き先: どの出口・戸口・階段も、ある map と spawn へ。行き先の spawn が歩ける
//  3 到達: エリアの中で、入ってくる所（spawn）からどの出口・物（人・調べる物・宝箱・灯籠）にも届く（FIELD の本物の当たり、M.bfs）
//  4 付け替え: 町・ダンジョンの「ワールドへ」の出口で、エリアに置き換わるはずの物（R.FieldArea.LINKS）が残っていない
//  5 体験版のつながり: ロアの里（はじめから）から、体験版の町・ダンジョンの入口に、前のワールドを通らずに着く（縦切りの閉じ方のまま）
//  6 絵: v2/assets/env/field/under/<id>@32.png があれば、大きさがマップ×32（無いエリアはタイルで焼く。数えるだけ）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps').create(R);
const F = R.Field;
const MAPS = R.DB.maps;
const areas = Object.values(MAPS).filter((m) => m && m.kind === 'field');

section('1. 形');
ok('エリアがある', areas.length >= 2, areas.map((m) => m.id).join(' '));
for (const m of areas) {
  const bad = [];
  if (m.rows.length !== m.h || m.rows.some((r) => [...r].length !== m.w)) bad.push('rows の大きさ');
  for (const r of m.rows) for (const ch of r) if (!m.legend[ch]) { bad.push('凡例に無い字 ' + ch); break; }
  for (const [k, s] of Object.entries(m.spawns || {})) if (!F._walkable(m, s.x, s.y, null, s.lv || 0)) bad.push('spawn ' + k + ' が歩けない');
  for (const e of m.exits || []) {
    const edge = e.x === 0 || e.y === 0 || e.x + e.w === m.w || e.y + e.h === m.h;
    if (!edge && !F._walkable(m, e.x, e.y, null, 0)) bad.push('端でない出口が歩けない（描いた門のマスであること） ' + JSON.stringify(e));
  }
  for (const z of m.zones || []) if (!R.DB.encounters[z.zone]) bad.push('出現表が無い ' + z.zone);
  if (!(m.zones || []).length) bad.push('出現表が無い');
  if (!(m.meta && Array.isArray(m.meta.worldRect) && m.meta.worldRect.length === 4)) bad.push('meta.worldRect');
  if (m.bgm !== 'overworld' && !(m.region === 'r_desert' && m.bgm === 'desert') && !(m.region === 'r_snow' && m.bgm === 'ice')) bad.push('曲 ' + m.bgm);   // 砂漠のエリアは砂漠の曲・雪原のエリアは雪原の曲
  ok(`${m.id}（${m.name}、${m.w}×${m.h}）: 形`, !bad.length, bad);
}

section('2. 行き先');
for (const m of areas) {
  const bad = [];
  for (const p of M.portals(m, { all: true })) {
    const d = MAPS[p.to.map];
    if (!d) { bad.push(p.kind + '→' + p.to.map + '（マップが無い）'); continue; }
    const sp = d.spawns && d.spawns[p.to.spawn];
    if (!sp) { bad.push(p.kind + '→' + p.to.map + '.' + p.to.spawn + '（spawn が無い）'); continue; }
    if (!F._walkable(d, sp.x, sp.y, null, sp.lv || 0)) bad.push(p.to.map + '.' + p.to.spawn + ' が歩けない');
  }
  ok(`${m.id}: 出口・戸口・階段の行き先がある`, !bad.length, bad);
}

section('3. 到達（エリアの中）');
for (const m of areas) {
  const starts = Object.values(m.spawns).map((s) => ({ x: s.x, y: s.y, lv: s.lv || 0 }));
  const r = M.withIndex(() => M.bfs(m, starts, { npcs: true }));
  const reach = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.dist.has((x + dx) + ',' + (y + dy) + ',0'));
  const miss = [];
  for (const p of M.portals(m, { all: false })) {
    let hit = false;
    for (let j = 0; j < (p.h || 1) && !hit; j++) for (let i = 0; i < (p.w || 1) && !hit; i++) hit = reach(p.x + i, p.y + j);
    if (!hit) miss.push(p.kind + '@' + p.x + ',' + p.y);
  }
  for (const o of m.objects || []) if (!o.cond && ['examine', 'chest', 'waylamp', 'sign', 'spring'].includes(o.type) && !reach(o.x, o.y)) miss.push(o.type + '@' + o.x + ',' + o.y);
  for (const n of m.npcs || []) if (!n.cond && !reach(n.x, n.y)) miss.push('npc ' + n.id);
  if (VERBOSE) console.log(`    ${m.id}: 歩けるマス ${r.dist.size}`);
  ok(`${m.id}: 出口・物・人に届く`, !miss.length, miss);
}

section('4. 付け替え');
const L = R.FieldArea ? R.FieldArea.LINKS : {};
const left = [];
for (const m of Object.values(MAPS)) {
  if (!m || m.kind === 'world' || m.kind === 'field') continue;
  for (const p of M.portals(m, { all: true })) if (p.to.map === 'world' && L[p.to.spawn]) left.push(m.id + '→world.' + p.to.spawn);
}
ok('エリアに置き換わる「ワールドへ」の出口が残っていない', !left.length, left);
for (const [sp, to] of Object.entries(L)) ok(`ワールドの ${sp} → ${to.map}.${to.spawn} がある`, !!(MAPS[to.map] && MAPS[to.map].spawns[to.spawn]));

section('5. 体験版のつながり（前のワールドを通らない）');
const goals = ['pharos', 'lighthouse_1', 'well', 'fern', 'yura', 'hut'].filter((id) => MAPS[id]);
const flagsOn = (fl) => { for (const f of fl) R.Game.flags[f] = true; };
R.Game = R.Game || {}; R.Game.flags = R.Game.flags || {};
flagsOn(['prologue_done']);
for (const goal of goals) {
  const plan = M.plan(M.dest({ map: 'roa', spawn: 'gate' }), (id) => (id === goal ? Object.values(MAPS[id].spawns).map((s) => ({ x: s.x, y: s.y, lv: s.lv || 0 })) : null), { avoidMap: (id) => id === 'world', maxNodes: 2000 });
  const viaWorld = plan && plan.legs.some((l) => l.map === 'world');
  ok(`ロアの里 → ${goal}${plan ? '（' + plan.legs.map((l) => l.map).join('→') + '）' : ''}`, !!plan && !viaWorld, plan ? '' : 'no route');
}

section('6. 絵');
let painted = 0;
for (const m of areas) {
  const p = path.join(V2, 'assets', 'env', 'field', 'under', m.id + '@32.png');
  if (!fs.existsSync(p)) { console.log(`    ${m.id}: 絵なし（タイルで焼く）`); continue; }
  painted++;
  const b = fs.readFileSync(p);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  ok(`${m.id}: 絵の大きさ ${w}×${h} = ${m.w * 32}×${m.h * 32}`, w === m.w * 32 && h === m.h * 32);
}
console.log(`    描いたエリア ${painted}/${areas.length}`);
done('test_field_areas');
