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
  if (['waylamp', 'sign', 'building', 'stairs', 'examine', 'door'].includes(o.type) || (o.type === 'prop' && (o.lm || MARK.test(o.id)))) marks.push([o.x, o.y]);
}
for (const n of m.npcs || []) if (n.x != null) marks.push([n.x, n.y]);
for (const e of m.exits || []) marks.push([e.x, e.y]);
// WORLD v3（広げたワールド）: 木・森・岩・葦のマス（大きな景色の絵で描く。木立・山・岩場）が窓に 3 つあれば、目印と同じに数える（tools/world_poi.js と同じ決まり）。
//   目印（重み 3）と景色のマス（重み 1）の累積和で、窓（±15 × ±8）の和が 3 以上か見る
const SCEN = require('../world_poi').sceneryChars(m.legend);
const W1 = m.w + 1, PS = new Int32Array(W1 * (m.h + 1)), mk = new Uint8Array(m.w * m.h);
{
  const grid0 = R.MapUtil.grid(m);
  for (let y = 0; y < m.h; y++) { const r = [...grid0[y]]; for (let x = 0; x < m.w; x++) if (SCEN.has(r[x])) mk[y * m.w + x] = 1; }
  for (const [x, y] of marks) if (x >= 0 && y >= 0 && x < m.w && y < m.h) mk[y * m.w + x] = 3;
  for (let y = 0; y < m.h; y++) { let a = 0; for (let x = 0; x < m.w; x++) { a += mk[y * m.w + x]; PS[(y + 1) * W1 + x + 1] = PS[y * W1 + x + 1] + a; } }
}
const winSum = (x, y) => { const x0 = Math.max(0, x - 15), y0 = Math.max(0, y - 8), x1 = Math.min(m.w, x + 16), y1 = Math.min(m.h, y + 9); return PS[y1 * W1 + x1] - PS[y0 * W1 + x1] - PS[y1 * W1 + x0] + PS[y0 * W1 + x0]; };
const empty = [];
const byKind = {};
for (const [x, y] of cells) {
  if (winSum(x, y) >= 3) continue;
  empty.push(x + ',' + y);
  const mat = (R.MapUtil.cell(m, x, y) || {}).mat;
  byKind[mat] = (byKind[mat] || 0) + 1;
}
if (VERBOSE) console.log("empty", empty.join(" "));
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
// 縦切りの後に作った地方の範囲（錠の外れた地方）は外に数えない: 雪原 x 8〜93・y 1〜48（tools/gen_world_snow.js）
const BUILT = [];
if (R.DB.regions.r_snow && !R.DB.regions.r_snow.slice) BUILT.push([8, 93, 1, 48]);
// 砂漠 x 8〜95・y 118〜166（tools/gen_world_desert.js）
if (R.DB.regions.r_desert && !R.DB.regions.r_desert.slice) BUILT.push([8, 95, 118, 166]);
// 湿原 x 155〜212・y 55〜114 と、峠から湿原への山あいの街道 x 112〜170・y 44〜64（tools/gen_world_marsh.js）
if (R.DB.regions.r_marsh && !R.DB.regions.r_marsh.slice) BUILT.push([155, 212, 55, 114], [112, 170, 44, 64]);
// 灰の荒野 x 96〜206・y 115〜162 と、潮見橋から湿原の沼の道まで x 186〜187・y 101〜121（tools/gen_world_ash.js）
if (R.DB.regions.r_ash && !R.DB.regions.r_ash.slice) BUILT.push([96, 206, 115, 162], [186, 187, 101, 121]);
const inBuilt = (x, y) => BUILT.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
// 箱は論理の座標 L（tools/gen_world*.js が描く座標）。ワールドのマスは R.WorldXform で L に戻して比べる（WORLD v3）
const toL = (x, y) => (R.WorldXform ? R.WorldXform.lcell(m, x, y) : [x, y]);
const leak = cells.filter(([x, y]) => { const [lx, ly] = toL(x, y); return (ly < 40 || lx > 118 || ly > 134) && !inBuilt(lx, ly); });
ok('縦切りの範囲の外（雪原・山地・砂漠）へ出られない', leak.length === 0, leak.slice(0, 5));
const guards = (m.npcs || []).filter((n) => n.cond && n.cond.slice === true);
ok(`峠の番人 ${guards.length} 人（北・東・南）`, guards.length >= 3);

section('4. フィールドに宝箱・隠し通路なし（A27）');
ok('ワールドに宝箱 0', !(m.objects || []).some((o) => o.type === 'chest'));
ok('ワールドに隠し通路 0', !Object.values(m.legend).some((l) => l.secret));
if (VERBOSE) console.log({ walk: cells.length, marks: marks.length, empty: empty.length });
done('check_world');
