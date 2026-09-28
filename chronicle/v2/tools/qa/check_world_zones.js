#!/usr/bin/env node
// QA: ワールドの出現表と地名が地面の地方に合っているか（node だけ）。tools/world_zones.js と同じ地方の分け方で数える。
//
//   node v2/tools/qa/check_world_zones.js [--verbose]
//
// 1. 歩けるワールドのマスで、最初に合う出現表の地方（緑・雪・砂漠・湿原・灰）が地面の地方と同じ。条件つきの表（隊商など）は付いた時と外れた時の両方。
//    境の 2 マスまでは許す（出現表の地方の素材が 2 マス以内にあれば良し）。出現表の無いマス（閉じた山地など）は見ない。
// 2. 地名（meta.areas、HUD の左上の札）: 地方全体の名前（灰の荒野・ザハラ砂漠など）が最初に合うマスで、その地方が地面の地方と同じ（境 2 マスまで）。
//    町のまわり・名所・峠などの小さな地名は見ない。
// 3. 灯台の岬（灯台の前から続く緑の地面）と、ロア → ファロス → 灯台の道: 序章か半島の表だけで、背景は海辺か森（灰・火山にならない）。
//    札の地名は緑の地方の名前（ファロス半島など）か小さな地名で、灰の荒野にならない。
// 4. 体験版で歩ける所（序章の後、ロアから歩いて着くマス。峠は DB.config.slice の崖崩れで閉じる）: どのマスにも出現表があり、
//    ティア 0〜2 で組を出せる。気ままに歩いて、地名ごとに 1 戦あたりの歩数がワールドの平均（K.ENC.world）の 2 倍より少ない
//    （北の野が街道の率 0.3 のままで約 160 歩に 1 戦、「敵が全然出ない」だった。オーナー 2026-09-28）。
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

section('2. 地名と地面の地方');
const areas = (m.meta && m.meta.areas) || [];
const SA = WZ.scanAreas(m.rows, m.legend, areas, T);
const offA = SA.bad.filter(([x, y, name]) => !near(x, y, WZ.AREA_REGION[name], 2));
const pairsA = {};
for (const [, , name, tr] of offA) { const k = name + ' over ' + tr; pairsA[k] = (pairsA[k] || 0) + 1; }
if (VERBOSE) console.log({ areas: areas.length, raw: SA.pairs });
ok('地方全体の地名が地面の地方と同じ（境 2 マスまで）', offA.length === 0, { pairs: pairsA, at: offA.slice(0, 6) });

section('3. 灯台の岬とロア → ファロス → 灯台の道');
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
// 札の地名: 最初に合う地名が緑の地方の名前か、地方の名前でない小さな地名（灰・砂漠・雪・湿原の地方の名前は×）
const badName = (cells) => {
  const out = [];
  for (const [x, y] of cells) {
    const a = WZ.firstArea(areas, x, y), r = WZ.areaRegion(a);
    if (!a || (r && r !== 'green')) out.push([x, y, a && a.name]);
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
const capeName = badName(cape);
ok('岬の札の地名は緑の地方（灰の荒野にならない）', capeName.length === 0, capeName.slice(0, 6));
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
  const pn = badName(p);
  ok(`${a} → ${b} の道の札の地名は緑の地方`, pn.length === 0, pn.slice(0, 6));
}
section('4. 体験版で歩ける所の出現（序章の後）');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン', fav: 'sword' }, seed: 4242 });
  R.Game.flags.prologue_done = true;   // 跳ね橋が下りた後
  R.MapUtil.invalidate();
  const g = R.MapUtil.grid(m);
  const walkG = (x, y) => { const l = m.legend[g[y][x]]; return !!l && !l.solid && l.walk !== false; };
  const areaName = (x, y) => { const a = WZ.firstArea(areas, x, y); return (a && a.name) || m.name; };
  // ロアの門の前から歩いて着くマス（tilePatches を当てた後の行。峠の崖崩れ・番人の所は歩けない）
  const reach = new Uint8Array(W * H), cells = [];
  {
    const s = m.spawns.roa, q = [[s.x, s.y]]; reach[s.y * W + s.x] = 1;
    while (q.length) {
      const [x, y] = q.pop(); cells.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H || reach[Y * W + X] || !walkG(X, Y)) continue;
        reach[Y * W + X] = 1; q.push([X, Y]);
      }
    }
  }
  ok(`体験版で歩けるマス ${cells.length}（跳ね橋の先まで）`, cells.length > 20000);
  const noZone = cells.filter(([x, y]) => !R.MapUtil.zoneAt(m, x, y));
  ok('歩けるマスはどれも出現表がある', noZone.length === 0, noZone.slice(0, 6));
  const zids = [...new Set(cells.map(([x, y]) => R.MapUtil.zoneAt(m, x, y)).filter(Boolean))];
  const dead = [];
  for (const zid of zids) for (const t of [0, 1, 2]) {
    const z = E[zid], Tb = z ? R.Mon.zoneTier(zid, z, t) : null;
    if (!z || !(R.Mon.stepChance(zid, z) > 0) || !R.Mon.zoneGroups(zid, Tb).length) dead.push([zid, t]);
  }
  ok(`出現表 ${zids.join('・')} はティア 0〜2 で組を出せる（率 > 0）`, dead.length === 0, dead);
  // 気ままに歩く（10 歩に 1 回くらい向きを変える）。一人旅と 4 人、ティア 0〜2
  const per = {};
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const t of [0, 1, 2]) for (const party of [1, 4]) for (let rep = 0; rep < 12; rep++) {
    R.Game.seed = 7000 + rep * 31 + t * 7 + party; R.Mon.resetEncounter();
    const rr = R.Mon.mkRng('walk:' + rep + ':' + t + ':' + party);
    const st = m.spawns[['bridge_n', 'fern', 'yura', 'hut'][rep % 4]];
    let x = st.x, y = st.y, d = DIRS[0];
    for (let s = 1; s <= 3000; s++) {
      if (rr.next() < 0.1) d = DIRS[Math.floor(rr.next() * 4)];
      let k = 0;
      while (k < 12 && !(x + d[0] >= 0 && y + d[1] >= 0 && x + d[0] < W && y + d[1] < H && reach[(y + d[1]) * W + x + d[0]])) { d = DIRS[Math.floor(rr.next() * 4)]; k++; }
      if (k >= 12) continue;
      x += d[0]; y += d[1];
      const zid = R.MapUtil.zoneAt(m, x, y), nm = areaName(x, y);
      const P = (per[nm] = per[nm] || { steps: 0, battles: 0 });
      P.steps++;
      if (zid && R.Mon.encounter(zid, { tier: t, steps: s, partySize: party })) P.battles++;
    }
  }
  const lim = 2 * R.Mon.K('ENC').world;
  const rows = Object.entries(per).filter(([, v]) => v.steps >= 5000).map(([nm, v]) => [nm, v.steps, v.battles, Math.round(v.steps / Math.max(1, v.battles))]);
  if (VERBOSE) console.log(rows);
  ok(`気ままに歩いた地名 ${rows.length} か所（5000 歩以上）`, rows.length >= 3, rows);
  const slow = rows.filter((r) => r[3] > lim);
  ok(`どの地名も 1 戦あたり ${lim} 歩より少ない（${rows.map((r) => r[0] + ' ' + r[3]).join('・')}）`, slow.length === 0, slow);
}
done('check_world_zones');
