#!/usr/bin/env node
// QA: ワールドの出現表が地面の地方に合っているか（node だけ）。tools/world_zones.js と同じ地方の分け方で数える。
//
//   node v2/tools/qa/check_world_zones.js [--verbose]
//
// 1. 歩けるワールドのマスで、最初に合う出現表の地方（緑・雪・砂漠・湿原・灰）が地面の地方と同じ。条件つきの表（隊商など）は付いた時と外れた時の両方。
//    境の 2 マスまでは許す（出現表の地方の素材が 2 マス以内にあれば良し）。出現表の無いマス（閉じた山地など）は見ない。
// 2. 灯台の岬（灯台の前から続く緑の地面）と、ロア → ファロス → 灯台の道: 序章か半島の表だけで、背景は海辺か森（灰・火山にならない）。
'use strict';
const { ok, section, done } = require('../lib/testkit');
const WZ = require('../world_zones');

const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const m = R.DB.maps.world;
const E = R.DB.encounters || {};
const W = m.w, H = m.h;
const walk = (x, y) => { const l = m.legend[m.rows[y][x]]; return !!l && !l.solid && l.walk !== false; };

section('1. 出現表の地方と地面の地方');
const T = WZ.terrainRegions(m.rows, m.legend);
const S = WZ.scan(m.rows, m.legend, m.zones, T);
const near = (x, y, region, d) => {
  const ri = WZ.ORDER.indexOf(region);
  for (let j = -d; j <= d; j++) for (let i = -d; i <= d; i++) {
    const X = x + i, Y = y + j;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    if (T.own[Y * W + X] === ri || T.reg[Y * W + X] === ri) return true;
  }
  return false;
};
const off = S.bad.filter(([x, y, zid]) => !near(x, y, WZ.zoneRegion(zid), 2));
const pairs = {};
for (const [x, y, zid, tr] of off) { const k = WZ.zoneRegion(zid) + ' over ' + tr; pairs[k] = (pairs[k] || 0) + 1; }
if (VERBOSE) console.log({ judged: S.judged, unknown: S.unknown, raw: S.pairs, zones: m.zones.length });
ok(`歩けるマス ${S.judged} の出現表の地方が地面と同じ（境 2 マスまで）`, off.length === 0, { pairs, at: off.slice(0, 6) });
ok(`地方の決まらないマスは少ない（${S.unknown}）`, S.unknown < 500);
const unknownZ = [...new Set(m.zones.map((z) => z.zone))].filter((id) => !E[id]);
ok('出現表の id はどれも R.DB.encounters にある', unknownZ.length === 0, unknownZ);

section('2. 灯台の岬とロア → ファロス → 灯台の道');
const GOOD = new Set(['zw_prologue', 'zw_peninsula']);
const bgOf = (zid) => (E[zid] && E[zid].bg) || m.bbg || 'forest';
const zoneAt = (x, y, on) => { const z = WZ.firstZone(m.zones, x, y, on); return z && z.zone; };
const bad = (cells) => {
  const out = [];
  for (const [x, y] of cells) for (const on of [false, true]) {
    const zid = zoneAt(x, y, on);
    if (!GOOD.has(zid) || !/^(coast|forest)$/.test(bgOf(zid))) { out.push([x, y, zid, bgOf(zid)]); break; }
  }
  return out;
};
// 岬: 灯台の前から、緑の地面（砂浜・道を含む）を伝って着くマス
const G = WZ.ORDER.indexOf('green');
const lh = m.spawns.lighthouse;
const cape = [], seen = new Uint8Array(W * H);
{
  const q = [[lh.x, lh.y]]; seen[lh.y * W + lh.x] = 1;
  while (q.length) {
    const [x, y] = q.pop(); cape.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H || seen[Y * W + X] || !walk(X, Y) || T.reg[Y * W + X] !== G) continue;
      if (Math.abs(X - lh.x) > 60 || Math.abs(Y - lh.y) > 60) continue;   // 岬のまわりだけ
      seen[Y * W + X] = 1; q.push([X, Y]);
    }
  }
}
ok(`岬の緑の地面 ${cape.length} マス（灯台のまわり）`, cape.length > 500);
const capeBad = bad(cape);
ok('岬は序章か半島の表だけ、背景は海辺か森（灰・火山にならない）', capeBad.length === 0, capeBad.slice(0, 6));
// 道: 歩けるマスの最短の道（4 方向）
function path(a, b) {
  const prev = new Int32Array(W * H).fill(-1), q = [a.y * W + a.x]; prev[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) {
    const k = q[h]; if (k === b.y * W + b.x) break;
    const x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, n = Y * W + X;
      if (X < 0 || Y < 0 || X >= W || Y >= H || prev[n] >= 0 || !walk(X, Y)) continue;
      prev[n] = k; q.push(n);
    }
  }
  const out = []; let k = b.y * W + b.x;
  if (prev[k] < 0) return null;
  while (k !== prev[k]) { out.push([k % W, (k / W) | 0]); k = prev[k]; }
  return out;
}
for (const [a, b] of [['roa', 'pharos'], ['pharos', 'lighthouse']]) {
  const p = path(m.spawns[a], m.spawns[b]);
  ok(`${a} → ${b} の道がある`, !!p);
  if (!p) continue;
  const pb = bad(p);
  ok(`${a} → ${b} の道 ${p.length} マスは序章か半島の表、背景は海辺か森`, pb.length === 0, pb.slice(0, 6));
}
done('check_world_zones');
