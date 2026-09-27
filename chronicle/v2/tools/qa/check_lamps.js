#!/usr/bin/env node
// QA: 街灯の置き場所の検査（node だけ。FIELD の本物の当たり R.Field._walkable / M.bfs）。
// オーナーの報告「街灯が不自然な位置に沢山ランダムにおかれてて通行不能だから、移動が面倒」の再発を止める。
//
//   node v2/tools/qa/check_lamps.js [--map id,…] [--report] [--json]
//
// 街灯 = 当たりのある灯り（prop の lamp_post・snow_lamp、ワールドの waylamp）。足もとの置き灯籠 lantern は当たりが無い（soft）ので
// 数えるだけ（道の上にあっても通れる）。対象は屋内を除く全マップ（屋内に街灯があれば、それも失敗）。
// 失敗にする置き方:
//  1 道の上   : 道・石畳・雪道・橋・桟橋のマス（ROAD）。広場の角・道の縁は道の外（芝・雪）に立てる。
//               町じゅうが石畳・桟橋の町（歩けるマスの半分より多くが ROAD。ファロス）はこの検査の代わりに 1b
//  1b 通りの中 : 街灯を通る縦・横の歩けるマスの並び（街灯を除いて数える）が 6 マス以下の向き（= 通りの幅の向き）では、
//               街灯は並びの端（家の壁・擁壁・柵の際）に立てる。通りのまん中に立てない（広場など広い所は良い）
//  2 戸口の前 : 建物の戸口の真下 2 マス（戸口の横 = 斜め前は良い）。扉・階段の上下左右
//  3 行き先   : 出口・戸口・扉・階段のマス（R.Field._warpAt）と、着く所（spawns）
//  4 狭める   : 街灯の上下左右のどれかの隣が歩けて、その先が歩けない（街灯と壁・木・物の間が 1 マス幅）
//  4b 口     : 街灯の上下左右の隣が幅 2 以下の通路（隣を通る、街灯への向きと直角の並びが 2 マス以下）の口・中（路地・桟橋の口をふさぐ）
//  4c 切る   : 街灯のまわり 8 マスの歩ける所どうしが、街灯を中心の 5×5 の中で行き来できない（1 マス幅の通路・角を街灯が切る）
//  5 ふさぐ   : 街灯を全部どけたときに届くマスが、街灯があると届かなくなる
//  6 当たり   : 街灯の当たりは足もとの 1 マスだけ（柱の上・光は当たらない）。敷地が 1×1 で、上のマスは街灯のせいで止まらない
// --try <map>:x,y;x,y…: そのマップの街灯を仮にこの場所に置き替えて検査する（置き場所を決めるとき用。ファイルは変えない）
// --report: 失敗でも終了コード 0 で、マップごとの数と、戸口・人・出入り口の間の最短の道が街灯でどれだけ伸びるかを出す。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg('--map', null);
const REPORT = argv.includes('--report');

const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
const F = R.Field, MU = R.MapUtil;

const STREET = /^(lamp_post|snow_lamp)$/;
const ROAD = new Set(['road', 'cobble', 'snow_path', 'bridge', 'pier', 'path', 'dirt_path', 'sand_road']);
const isStreet = (o) => (o.type === 'prop' && STREET.test(o.id)) || o.type === 'waylamp';
const isLantern = (o) => o.type === 'prop' && o.id === 'lantern';
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const TRY = arg('--try', null);
if (TRY) {
  const [mid, list] = TRY.split(':'), m = R.DB.maps[mid];
  const kind = ((m.objects || []).find((o) => o.type === 'prop' && STREET.test(o.id)) || { id: 'lamp_post' }).id;
  m.objects = (m.objects || []).filter((o) => !(o.type === 'prop' && STREET.test(o.id))).concat((list || '').split(';').filter(Boolean).map((p) => { const [x, y] = p.split(',').map(Number); return { type: 'prop', id: kind, x, y }; }));
}
const maps = M.sliceMaps().filter((id) => (!ONLY || ONLY.split(',').includes(id)) && (!TRY || id === TRY.split(':')[0]));
const report = [];
const rows = [];
const fail = (map, what) => { report.push({ map, what }); if (!REPORT) ok(`${map}: ${what}`, false); };

function noLamps(m) { return Object.assign({}, m, { objects: (m.objects || []).filter((o) => !isStreet(o)) }); }

// 最短の道の伸び: 戸口の前・出入り口・人の話すマス・着く所の組を、街灯あり／なしで歩き比べる
function detour(m, bare) {
  const pts = [];
  for (const o of m.objects || []) if (o.type === 'building' && o.door && o.door.to && o.cond == null) pts.push({ x: o.door.x, y: o.door.y + 1 });
  for (const e of m.exits || []) if (e.cond == null) pts.push({ x: e.x, y: e.y });
  for (const s of Object.values(m.spawns || {})) pts.push({ x: s.x, y: s.y });
  for (const n of m.npcs || []) if (n.x != null && n.cond == null) pts.push({ x: n.x, y: n.y + 1 });
  const P = pts.filter((p) => F._walkable(bare, p.x, p.y, null, 0));
  let pairs = 0, longer = 0, extra = 0, cut = 0;
  for (let i = 0; i < P.length; i++) {
    const a = M.bfs(m, [P[i]], { npcs: false, through: true }), b = M.bfs(bare, [P[i]], { npcs: false, through: true });
    for (let j = i + 1; j < P.length; j++) {
      const db = b.get(P[j].x, P[j].y, 0);
      if (db == null) continue;
      pairs++;
      const da = a.get(P[j].x, P[j].y, 0);
      if (da == null) { cut++; continue; }
      if (da > db) { longer++; extra += da - db; }
    }
  }
  return { pairs, longer, extra, cut };
}

let nLamps = 0, nLanterns = 0;
M.withIndex(() => {
  for (const id of maps) {
    const m = R.DB.maps[id];
    const lamps = (m.objects || []).filter((o) => isStreet(o) && o.cond == null);
    const lanterns = (m.objects || []).filter(isLantern).length;
    if (!lamps.length) { if (lanterns && REPORT) rows.push({ id, kind: m.kind, lamps: 0, lanterns, bad: 0 }); continue; }
    nLamps += lamps.length; nLanterns += lanterns;
    const before = report.length;
    if (m.kind === 'interior') for (const o of lamps) fail(id, `屋内に街灯 ${o.id}（${o.x},${o.y}）`);
    const bare = noLamps(m);
    const walk = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && F._walkable(m, x, y, null, 0);
    const bwalk = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && F._walkable(bare, x, y, null, 0);
    // 町じゅうが道の町か（歩けるマスの半分より多くが ROAD）
    let nWalk = 0, nRoad = 0;
    if (m.kind !== 'world') for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { if (!F.passable(m, x, y, null, 0)) continue; nWalk++; if (ROAD.has((MU.cell(m, x, y) || {}).mat)) nRoad++; }
    const paved = nWalk > 0 && nRoad * 2 > nWalk;
    // 戸口の前・扉・階段・着く所
    const front = new Map();
    for (const o of m.objects || []) {
      if (o.type === 'building' && o.door) { front.set(o.door.x + ',' + (o.door.y + 1), `建物 ${o.id} の戸口の前`); front.set(o.door.x + ',' + (o.door.y + 2), `建物 ${o.id} の戸口の前`); }
      if ((o.type === 'door' || o.type === 'stairs') && o.to) for (const [dx, dy] of D4) front.set((o.x + dx) + ',' + (o.y + dy), `${o.type} ${o.x},${o.y} の前`);
    }
    for (const [k, s] of Object.entries(m.spawns || {})) front.set(s.x + ',' + s.y, `着く所 ${k}`);
    for (const o of lamps) {
      const at = `${o.type === 'waylamp' ? 'waylamp ' + o.id : o.id}（${o.x},${o.y}）`;
      const c = MU.cell(m, o.x, o.y) || {};
      // 6 当たりは足もとだけ
      const fp = MU.footprint(o);
      if (fp[2] !== 1 || fp[3] !== 1) fail(id, `${at} の当たりが ${fp[2]}×${fp[3]}（足もとの 1 マスだけにする）`);
      if (o.y > 0 && F._walkable(bare, o.x, o.y - 1, null, 0) && !F._walkable(m, o.x, o.y - 1, null, 0)) fail(id, `${at} の上のマスが街灯でふさがる`);
      // 1 道の上
      if (ROAD.has(c.mat) && !paved) fail(id, `${at} が道（${c.mat}）の上`);
      // 1b 通りの中（幅 6 以下の向きでは端に）
      for (const [dx, dy, axis] of [[1, 0, '横'], [0, 1, '縦']]) {
        let a = 0, b = 0;
        while (a < 8 && bwalk(o.x - dx * (a + 1), o.y - dy * (a + 1))) a++;
        while (b < 8 && bwalk(o.x + dx * (b + 1), o.y + dy * (b + 1))) b++;
        if (a + b + 1 <= 6 && a > 0 && b > 0) fail(id, `${at} が幅 ${a + b + 1} の通りのまん中（${axis}の並びの端に立てる）`);
      }
      // 2・3 戸口の前・行き先・着く所
      if (front.has(o.x + ',' + o.y)) fail(id, `${at} が${front.get(o.x + ',' + o.y)}`);
      if (F._warpAt(bare, o.x, o.y, 0)) fail(id, `${at} が出口・戸口のマス`);
      // 4 狭める（街灯と次の壁の間が 1 マス）
      for (const [dx, dy] of D4) {
        const nx = o.x + dx, ny = o.y + dy;
        if (!walk(nx, ny)) continue;
        if (!walk(nx + dx, ny + dy)) { fail(id, `${at} と ${nx + dx},${ny + dy} の間が 1 マス幅（${nx},${ny}）`); break; }
      }
      // 4b 路地・桟橋の口
      for (const [dx, dy] of D4) {
        const nx = o.x + dx, ny = o.y + dy;
        if (!bwalk(nx, ny)) continue;
        let n = 1;
        for (let k = 1; k < 3 && bwalk(nx + dy * k, ny + dx * k); k++) n++;
        for (let k = 1; k < 3 && bwalk(nx - dy * k, ny - dx * k); k++) n++;
        if (n <= 2) { fail(id, `${at} が幅 ${n} の通路（${nx},${ny}）の口をふさぐ`); break; }
      }
      // 4c まわりを切る（5×5 の中の歩き。斜めは角を切らない）
      {
        const ring = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && walk(o.x + dx, o.y + dy)) ring.push((o.x + dx) + ',' + (o.y + dy));
        if (ring.length > 1) {
          const inWin = (x, y) => Math.abs(x - o.x) <= 2 && Math.abs(y - o.y) <= 2 && !(x === o.x && y === o.y) && walk(x, y);
          const seen = new Set([ring[0]]), q = [ring[0].split(',').map(Number)];
          for (let i = 0; i < q.length; i++) {
            const [x, y] = q[i];
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const k = (x + dx) + ',' + (y + dy);
              if (seen.has(k) || !inWin(x + dx, y + dy)) continue;
              if (dx && dy && (!inWin(x + dx, y) || !inWin(x, y + dy))) continue;
              seen.add(k); q.push([x + dx, y + dy]);
            }
          }
          const cut = ring.filter((k) => !seen.has(k));
          if (cut.length) fail(id, `${at} がまわりの通り道を切る（${cut.join(' ')} へ回れない）`);
        }
      }
    }
    // 5 ふさぐ
    const starts = Object.values(m.spawns || {}).map((s) => ({ x: s.x, y: s.y, lv: s.lv || 0 }));
    if (starts.length && m.kind !== 'world') {
      const a = M.bfs(m, starts, { npcs: false, through: true }), b = M.bfs(bare, starts, { npcs: false, through: true });
      let lost = 0;
      for (const k of b.dist.keys()) {
        const [x, y, lv] = k.split(',').map(Number);
        if (a.get(x, y, lv) == null && !lamps.some((o) => o.x === x && o.y === y)) lost++;
      }
      if (lost) fail(id, `街灯が道をふさいで ${lost} マスに届かない`);
    }
    const row = { id, kind: m.kind, lamps: lamps.length, lanterns, bad: report.length - before };
    if (REPORT && m.kind !== 'world') Object.assign(row, detour(m, bare));
    rows.push(row);
    if (!REPORT && report.length === before) console.log(`pass  ${id}: 街灯 ${lamps.length}`);
  }
});

if (REPORT) {
  console.log('map              kind      lamps lantern bad  pairs longer extra cut');
  for (const r of rows) console.log(`${r.id.padEnd(16)} ${String(r.kind).padEnd(9)} ${String(r.lamps).padStart(5)} ${String(r.lanterns).padStart(7)} ${String(r.bad).padStart(4)}  ${r.pairs != null ? [r.pairs, r.longer, r.extra, r.cut].map((v) => String(v).padStart(5)).join(' ') : ''}`);
  for (const p of report) console.log('  ' + p.map + ': ' + p.what);
}
section('まとめ');
ok(`${maps.length} 枚のマップの街灯 ${nLamps}（置き灯籠 ${nLanterns} は数えるだけ）が道・戸口の前・出入り口・1 マス幅の所に無く、道をふさがない`, REPORT || report.length === 0, report.length + ' problems');
if (argv.includes('--json')) {
  const f = path.join(V2, 'design', 'qa', 'check_lamps.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ date: new Date().toISOString(), rows, problems: report }, null, 1));
}
done('check_lamps');
