#!/usr/bin/env node
// 光の柱の場所（regions の beaconAt）のテスト（node）。持ち主の試遊 2026-10-01「光の柱が灯す物の中心からずれている（ほとんどの地方）」。
//   node v2/tools/test_beacon.js
//   1 地方ごとに ev.clearRegion を呼ぶイベントを探し、その時に一行がいるマップ（warp の先・踏む所・調べる物）を出す。
//     beaconAt はそのマップに置く（R.Tier.celebrate はマップが同じ時だけ使う。違えば beacon の物か一行の上に落ちる）
//   2 柱の根元（R.Tier の drawStage: マス (x + 0.5, y + 0.8)）が、灯す物の描いた見た目の枠の中に落ちる。
//     枠は 1920×1080 の撮影で測った（マス、小数）。beacon の物は物の位置から（火の籠: 物のマスの 1 つ上の段〜物のマスの上の方）。
//     描いた物（painted）は根元のマスが歩けない（描いた物の当たり）こと。序章（ワールドの灯台の塔の上）は塔の後ろの草地なので除く
//   3 R.Tier._beaconAt が、解決のマップの上で beaconAt をそのまま返す（own）。beacon の物の代わりの道（物の足もと → 火の籠）も確かめる
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps').create(R);
const D = R.DB;

// 灯す物（測った枠 [x0, y0, x1, y1] はマス。描いた見た目の外形。中心 = 柱の落ちる所）
const T = {
  prologue: { what: 'ファロス灯台の灯室（ワールドの w_lighthouse の塔の上）', map: 'world', kind: 'doc', box: [319.1, 369.2, 319.9, 370.1] },
  r_forest: { what: 'こずえの歌の灯（beacon の物）', kind: 'prop' },
  r_desert: { what: '日輪の火（beacon の物）', kind: 'prop' },
  r_snow: { what: '冬至の火（beacon の物）', kind: 'prop' },
  r_marsh: { what: '沈んだ鐘楼の頭の鐘（三つ目の鐘）', kind: 'painted', box: [30.33, 5.1, 31.38, 6.4] },
  r_isles: { what: '岬の石の灯の灯の窓', kind: 'painted', box: [21.0, 2.35, 21.85, 2.85] },
  r_mine: { what: '誓いの碑（描いた石の板）', kind: 'painted', box: [20.8, 4.55, 23.55, 6.95] },
  r_ash: { what: '火の鳥の卵', kind: 'painted', box: [20.95, 15.95, 22.35, 18.0] },
  r_star: { what: '星の噴水の天球儀', kind: 'painted', box: [28.0, 28.8, 30.9, 31.0] },
};
const LAND_X = 0.5, LAND_Y = 0.8;   // tier.js の screenOf（マスの中心）＋ 根元の 0.3 マス

const srcOf = (id) => { const e = D.events[id]; return e ? String(e.run || e) : ''; };
/** clearRegion(rid) を呼ぶイベント → その時のマップ（warp の先、無ければ呼び元をたどってイベントの置き場所） */
function clearMap(rid) {
  const re = new RegExp(`clearRegion\\('${rid}'\\)`);
  const ev = Object.keys(D.events).find((id) => re.test(srcOf(id)));
  if (!ev) return { ev: null, map: null };
  const seen = new Set();
  let cur = [ev];
  while (cur.length) {
    const next = [];
    for (const id of cur) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = srcOf(id);
      const cut = id === ev ? s.slice(0, s.search(re)) : s;
      const w = [...cut.matchAll(/ev\.warp\('([a-z0-9_]+)'/g)].pop();
      if (w) return { ev, map: w[1] };
      const pl = M.eventPlaces(id, { all: true });
      if (pl.length) return { ev, map: pl[0].map };
      for (const k of Object.keys(D.events)) if (srcOf(k).includes(`ev.call('${id}')`)) next.push(k);
    }
    cur = next;
  }
  return { ev, map: null };
}

section('1. 解決のマップに置く');
const rids = Object.keys(D.regions).filter((id) => D.regions[id].beacon);   // 大灯火のある地方（world・finale は柱を持たない）
ok('地方の表と regions がそろう', rids.every((id) => T[id]) && Object.keys(T).every((id) => D.regions[id]), rids.filter((id) => !T[id]));
for (const rid of rids) {
  const b = D.regions[rid].beaconAt, t = T[rid] || {};
  if (!b || !D.maps[b.map]) { ok(`${rid}: beaconAt のマップがある`, false, b); continue; }
  const m = D.maps[b.map];
  ok(`${rid}: beaconAt (${b.map} ${b.x}, ${b.y}) がマップの中`, b.x >= 0 && b.y >= 0 && b.x < m.w && b.y < m.h, [m.w, m.h]);
  if (t.kind === 'doc') { ok(`${rid}: clearRegion を通らない（${t.what}。文書の場所）`, !clearMap(rid).ev && b.map === t.map); continue; }
  const c = clearMap(rid);
  ok(`${rid}: clearRegion は ${c.ev} → マップ ${c.map}、beaconAt も同じマップ`, !!c.map && c.map === b.map, { clearAt: c, beaconAt: b.map });
}

section('2. 柱が灯す物の描いた中心に落ちる');
for (const rid of rids) {
  const b = D.regions[rid].beaconAt, t = T[rid];
  if (!b || !t) continue;
  const lx = b.x + LAND_X, ly = b.y + LAND_Y, m = D.maps[b.map];
  let box = t.box;
  if (t.kind === 'prop') {
    const p = (m.objects || []).find((o) => o.type === 'prop' && o.id === 'beacon' && Math.floor(lx) === o.x && ly > o.y - 1.2 && ly < o.y + 1);
    ok(`${rid}: ${t.what} がマップ ${b.map} の柱の真下の列にある`, !!p, { land: [lx, ly] });
    if (!p) continue;
    box = [p.x + 0.2, p.y - 0.6, p.x + 0.8, p.y + 0.2];   // 火の籠の上の段（籠の見た目は y − 0.5 〜 y + 0.85、火は籠の上）
  }
  const inBox = lx >= box[0] && lx <= box[2] && ly >= box[1] && ly <= box[3];
  ok(`${rid}: 根元 (${lx.toFixed(2)}, ${ly.toFixed(2)}) が ${t.what} の枠の中`, inBox, box);
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
  const off = Math.max(Math.abs(lx - cx) / (box[2] - box[0]), Math.abs(ly - cy) / (box[3] - box[1]));
  ok(`${rid}: 根元が枠の中心に寄っている（ずれ ${(off * 100) | 0}% ≤ 35%）`, off <= 0.35, { center: [cx, cy] });
  if (t.kind === 'painted') {
    const walk = R.Field._walkable ? R.Field._walkable(m, Math.floor(lx), Math.floor(ly), null, 0) : R.Field.passable(m, Math.floor(lx), Math.floor(ly), null, 0);
    ok(`${rid}: 根元のマス (${Math.floor(lx)}, ${Math.floor(ly)}) は描いた物で歩けない`, !walk);
  }
}

section('3. R.Tier の解き方');
ok('R.Tier._beaconAt がある', typeof R.Tier._beaconAt === 'function');
if (typeof R.Tier._beaconAt === 'function') {
  // R.Field.pos は読むだけの値なので、R.Field を一時的に「pos だけ差し替えた写し」にする
  const F0 = R.Field;
  const at = (pos) => { R.Field = Object.create(F0, { pos: { value: pos } }); };
  try {
    for (const rid of rids) {
      const b = D.regions[rid].beaconAt;
      if (!b) continue;
      at({ map: b.map, x: 1, y: 1 });
      const r = R.Tier._beaconAt(R.Tier.regionInfo(rid));
      ok(`${rid}: 解決のマップでは beaconAt をそのまま使う`, r.own && r.x === b.x && r.y === b.y, r);
    }
    // beaconAt の無いマップの beacon の物: 足もとではなく火の籠へ（regions の物と同じ高さ）
    at({ map: 'verda_1', x: 30, y: 33 });
    const r = R.Tier._beaconAt({ beacon: null });
    ok('beacon の物だけのマップでも火の籠に落ちる（物 (30, 23) → (30, 22)）', r.own && r.x === 30 && r.y === 23 - R.Tier.BEACON_LIFT && R.Tier.BEACON_LIFT === 1, r);
  } finally { R.Field = F0; }
}
done();
