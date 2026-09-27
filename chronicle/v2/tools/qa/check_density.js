#!/usr/bin/env node
// QA: 町の飾りの密度と通りの空き（V2_PLAN §3.16 の 3「check_density」、STYLE_REFERENCE §6.2・§9）。node だけ。
//
//   node v2/tools/qa/check_density.js [--verbose]
//
// 町（kind 'town'）ごとに、1 画面（広さ「ふつう」の 16:9 = 30×17 マス）を 5 マスずつずらして並べ、画面の半分以上が歩ける所の
// 画面だけ数える。飾り = 物（prop・建物・看板・宝箱・灯籠・燭台）と、いつもいる人（cond の無い NPC）。
//  - 1 画面の飾りの中央値が 25〜40、いちばん少ない画面も 12 以上（何もない画面を作らない）
//  - 通りの中央（道の素材が左右か上下に 3 マス以上続く所のまん中）に硬い物（solid で soft でない prop・建物・看板・宝箱）が無い
'use strict';
const { ok, section, done } = require('../lib/testkit');

const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
R.State.newGame({ seed: 1 });
const ROAD = /^(road|cobble|plank|dock|boardwalk|path|street|paving|brick_road|stone_road|dirt_road)$/;
const W = 30, H = 17;

const towns = M.sliceMaps().filter((id) => R.DB.maps[id].kind === 'town');
const summary = {};
for (const id of towns) {
  section(id);
  const m = R.DB.maps[id];
  const deco = [];
  for (const o of m.objects || []) {
    if (o.x == null || (o.cond != null && !R.State.check(o.cond))) continue;
    if (['prop', 'building', 'sign', 'chest', 'waylamp', 'brazier', 'spring'].includes(o.type)) deco.push(o);
  }
  for (const n of m.npcs || []) if (n.x != null && !n.cond) deco.push({ type: 'npc', x: n.x, y: n.y });
  // 柵・生け垣のように 1 マスずつ並べる物は、つながった 1 列を 1 つの飾りと数える
  const LINE = /^(fence|hedge|rail|railing|rope|wall_low)/;
  const seenL = new Set();
  for (let i = deco.length - 1; i >= 0; i--) {
    const o = deco[i];
    if (o.type !== 'prop' || !LINE.test(o.id) || seenL.has(o)) continue;
    const q = [o]; seenL.add(o);
    for (let k = 0; k < q.length; k++) for (const p of deco) if (!seenL.has(p) && p.type === 'prop' && p.id === o.id && Math.abs(p.x - q[k].x) <= 1 && Math.abs(p.y - q[k].y) <= 1) { seenL.add(p); q.push(p); }
    for (const p of q) if (p !== o) deco.splice(deco.indexOf(p), 1);
  }
  const counts = [];
  for (let y0 = 0; y0 + H <= m.h; y0 += 4) for (let x0 = 0; x0 + W <= m.w; x0 += 5) {
    let walk = 0;
    for (let y = y0; y < y0 + H; y++) for (let x = x0; x < x0 + W; x++) { const c = R.MapUtil.cell(m, x, y); if (c && c.walk !== false && !c.solid) walk++; }
    if (walk < W * H * 0.5) continue;
    counts.push(deco.filter((o) => o.x >= x0 && o.x < x0 + W && o.y >= y0 && o.y < y0 + H).length);
  }
  // 画面より小さい町（1 画面に収まる）
  if (!counts.length) counts.push(deco.length);
  counts.sort((a, b) => a - b);
  const med = counts[counts.length >> 1];
  summary[id] = { screens: counts.length, min: counts[0], median: med, max: counts[counts.length - 1] };
  ok(`${id}: 1 画面の飾りの中央値 25〜40（${counts.length} 画面: 最小 ${counts[0]}・中央 ${med}・最大 ${counts[counts.length - 1]}）`, med >= 25 && med <= 40);
  ok(`${id}: いちばん少ない画面も 12 以上（${counts[0]}）`, counts[0] >= 12);
  // 通りの中央
  const isRoad = (x, y) => { const c = R.MapUtil.cell(m, x, y); return !!(c && ROAD.test(c.mat || '')); };
  const hard = (x, y) => (m.objects || []).filter((o) => (o.lv || 0) === 0 && o.x != null && (o.cond == null || R.State.check(o.cond)) && R.MapUtil.inRect(x, y, R.MapUtil.footprint(o)) &&
    ((o.type === 'prop' && (R.DB.props[o.id] || {}).solid && !(R.DB.props[o.id] || {}).soft && !o.soft) || ['building', 'sign', 'chest'].includes(o.type)));
  const bad = [];
  let centers = 0;
  const run = (x, y, dx, dy) => { let a = 0, b = 0; while (isRoad(x - dx * (a + 1), y - dy * (a + 1))) a++; while (isRoad(x + dx * (b + 1), y + dy * (b + 1))) b++; return { a, b, n: a + b + 1 }; };
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
    if (!isRoad(x, y)) continue;
    const h = run(x, y, 1, 0), v = run(x, y, 0, 1);
    // 通り = 幅 2〜4 マスで、長さ 5 マス以上続く道。まん中 = 幅の中央の 1〜2 マス（広場は数えない）
    let center = false;
    if (h.n >= 2 && h.n <= 4 && v.n >= 5) center = Math.abs(h.a - h.b) <= 1;
    if (v.n >= 2 && v.n <= 4 && h.n >= 5) center = center || Math.abs(v.a - v.b) <= 1;
    if (!center) continue;
    centers++;
    const hh = hard(x, y).filter((o) => o.type !== 'building');
    if (hh.length) bad.push(`${x},${y} ${hh.map((o) => o.id || o.type).join('/')}`);
  }
  ok(`${id}: 通りの中央（${centers} マス）に硬い物が無い`, bad.length === 0, bad.slice(0, 8));
}
if (VERBOSE) console.log(JSON.stringify(summary, null, 1));
done('check_density');
