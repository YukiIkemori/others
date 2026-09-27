#!/usr/bin/env node
// QA: ワールドの検査（V2_PLAN §3.16 の 3「check_world」、§3.2 の空白の決まり、WORLD_REDESIGN §2.1）。node だけ。
//
//   node v2/tools/qa/check_world.js [--verbose]
//
// 1. 30 歩の空白: 縦切りで歩けるワールドのマス（街道でも原野でも。FIELD の当たりで、序章の後の形）から、画面 1 枚（±15 × ±8 マス）の中に
//    目印（道しるべの灯籠・看板・建物・入口・調べる物・旅人・灯りや天幕や大木などの景色の目印）が 1 つも無いマスが 0。
// 2. ループのつなぎ目: 縦切りの範囲はマップの端に触れない（FIELD のワールドは端でつながらないので、端に歩けるマスがあると行き止まりの壁になる）。
//    端の行と列の素材が、反対側の端と同じ種類（水なら水）で、ループにしたときに継ぎ目が出ない。
// 3. 縦切りの閉じ方の外へ出られない（北の雪原・東の山地・南の砂漠へ抜ける道が無い）: 範囲の外のマスに届かない。
// 4. フィールドに宝箱・隠し通路が無い（A27）。
'use strict';
const { ok, section, done } = require('../lib/testkit');

const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
const P = require('./progress');
P.init(R);
P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal' } });
const m = R.DB.maps.world;
R.MapUtil.invalidate();

// 歩けるマス: ワールドのすべての spawn（町・ダンジョンから出た所）から
const starts = Object.keys(m.spawns || {}).map((s) => M.dest({ map: 'world', spawn: s })).filter((d) => R.Field._walkable(m, d.x, d.y, null, d.lv));
const res = M.bfs(m, starts, { through: true });
const cells = [...res.dist.keys()].map((k) => k.split(',').map(Number));

section('1. 30 歩の空白（画面 1 枚に目印 1 つ）');
const MARK = /lamp|lantern|tent|mushroom_glow|firefly|beacon|tree_giant|ship|well|signboard|campfire|bench|crate|statue|stone|shrine|ruin/;
const marks = [];
for (const o of m.objects || []) {
  if (o.x == null) continue;
  if (['waylamp', 'sign', 'building', 'stairs', 'examine', 'door'].includes(o.type) || (o.type === 'prop' && MARK.test(o.id))) marks.push([o.x, o.y]);
}
for (const n of m.npcs || []) if (n.x != null) marks.push([n.x, n.y]);
for (const e of m.exits || []) marks.push([e.x, e.y]);
const empty = [];
const byKind = {};
for (const [x, y] of cells) {
  if (marks.some(([mx, my]) => Math.abs(mx - x) <= 15 && Math.abs(my - y) <= 8)) continue;
  empty.push(x + ',' + y);
  const mat = (R.MapUtil.cell(m, x, y) || {}).mat;
  byKind[mat] = (byKind[mat] || 0) + 1;
}
ok(`歩ける ${cells.length} マスのうち、画面 1 枚に目印の無いマス 0（${empty.length}${empty.length ? ' ' + JSON.stringify(byKind) : ''}）`, empty.length === 0, empty.slice(0, 10));

section('2. ループのつなぎ目・端');
const edge = cells.filter(([x, y]) => x <= 0 || y <= 0 || x >= m.w - 1 || y >= m.h - 1);
ok('縦切りの範囲はマップの端に触れない', edge.length === 0, edge.slice(0, 5));
{
  const grid = R.MapUtil.grid(m);
  const kind = (ch) => { const l = m.legend[ch] || {}; return l.walk === false ? 'water' : l.solid ? 'solid' : 'walk'; };
  let seam = 0;
  for (let y = 0; y < m.h; y++) if (kind([...grid[y]][0]) !== kind([...grid[y]][m.w - 1])) seam++;
  for (let x = 0; x < m.w; x++) if (kind([...grid[0]][x]) !== kind([...grid[m.h - 1]][x])) seam++;
  // FIELD のワールドは端でつながらない（ループは縦切りの外）。縦切りの範囲が端に触れないので、継ぎ目は見えない。数だけ出す
  console.log(`    全体の端の継ぎ目（縦切りの外。東の果ての岬など）: ${seam} マス`);
  // 縦切りの範囲から見える端（±15 × ±8 マス）は歩けない素材（海）で、カメラが端で止まる（FIELD）。歩いて端から外へ出る所が無い
  const seen = new Set();
  for (const [x, y] of cells) for (let dy = -8; dy <= 8; dy++) for (let dx = -15; dx <= 15; dx++) { const X = x + dx, Y = y + dy; if (X === 0 || Y === 0 || X === m.w - 1 || Y === m.h - 1) seen.add(X + ',' + Y); }
  const walkEdge = [...seen].filter((k) => { const [x, y] = k.split(',').map(Number); const c = R.MapUtil.cell(m, x, y); return c && c.walk !== false && !c.solid; });
  ok(`縦切りの範囲から見える端 ${seen.size} マスは歩けない海（継ぎ目が見えない）`, walkEdge.length === 0, walkEdge.slice(0, 5));
}

section('3. 縦切りの閉じ方');
const leak = cells.filter(([x, y]) => y < 40 || x > 118 || y > 134);
ok('縦切りの範囲の外（雪原・山地・砂漠）へ出られない', leak.length === 0, leak.slice(0, 5));
const guards = (m.npcs || []).filter((n) => n.cond && n.cond.slice === true);
ok(`峠の番人 ${guards.length} 人（北・東・南）`, guards.length >= 3);

section('4. フィールドに宝箱・隠し通路なし（A27）');
ok('ワールドに宝箱 0', !(m.objects || []).some((o) => o.type === 'chest'));
ok('ワールドに隠し通路 0', !Object.values(m.legend).some((l) => l.secret));
if (VERBOSE) console.log({ walk: cells.length, marks: marks.length, empty: empty.length });
done('check_world');
