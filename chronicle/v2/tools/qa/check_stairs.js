#!/usr/bin/env node
// QA: 階段で着くマス（node だけ。オーナーの報告「階段を上り下りすると 1 マス左に出る」の再発を止める）。
//
//   node v2/tools/qa/check_stairs.js [--verbose]
//
// デモの全部のマップの階段（type 'stairs' で to のある物）ごとに、本物の R.Field._arrive を階段のマスで動かし（R.Field.enter は
// 呼ばずに行き先だけ受け取る）、着くマスを調べる:
//  1 行き先のマップがあり、着くマスが決まる（名前の spawn か {x, y}）。
//  2 行き先の spawn の近く（3 マス以内）に階段があれば（戻る階段を優先）: 着くマスはその上下左右の隣で、向きは階段から離れる向き。
//  3 着くマスは歩けて（FIELD の当たり）、出入り口のマスでない（着いてすぐ、また移らない）。動かない人がいない。
//  4 着いたマスから、階段以外の隣へ 1 歩出られる（閉じこめられない）。戻る階段なら、そこへ 1 歩で戻れる。
// 参考: 手で置いた spawn が階段の隣でない数（直す前の「横・斜め・2 マス先」）も出す。
'use strict';
const { ok, section, done } = require('../lib/testkit');

const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const F = R.Field, S = F._s;
R.State.newGame({ hero: { type: 'fighter', sex: 'm', name: 'テスト' }, seed: 1 });

const D4 = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };
const check = (c) => { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } };

// _arrive の横の仕事（地図・焼く列・HUD・音）は止めて、行き先だけ受け取る
let got = null;
const saved = { enter: F.enter };
F.enter = (map, spawn) => { got = { map, spawn }; return null; };
for (const [o, k] of [[F.minimap, 'reveal'], [F.chunks, 'lookAhead'], [F.hud, 'step'], [F.hud, 'toast']]) if (o) o[k] = () => {};
if (R.Audio) R.Audio.sfx = () => {};
F._encounterStep = () => null;

let n = 0, handAuthoredOff = 0;
section('階段 → 着くマス');
for (const id of Object.keys(R.DB.maps).sort()) {
  const m = R.DB.maps[id];
  for (const o of m.objects || []) {
    if (o.type !== 'stairs' || !o.to) continue;
    n++;
    const name = `${id}(${o.x},${o.y}) → ${o.to.map}.${o.to.spawn}`;
    // 階段のマスに立って「入った瞬間」を動かす（cond はこの階段だけ真にする）
    const orig = R.State.check;
    R.State.check = (c) => (c === o.cond ? true : orig.call(R.State, c));
    Object.assign(S, { map: m, x: o.x, y: o.y, lv: o.lv || 0, dir: 's', torch: null, npcs: [] });
    got = null;
    try { F._arrive(); } finally { R.State.check = orig; }
    const dest = R.DB.maps[o.to.map];
    if (!ok(name + ': 行き先へ移る', got && got.map === o.to.map && dest, got)) continue;
    const sp = R.MapUtil.spawn(dest, got.spawn);
    const def = typeof got.spawn === 'string' ? (dest.spawns || {})[got.spawn] || {} : got.spawn;
    const lv = def.lv || 0, x = sp.x, y = sp.y;
    // 行き先の対の階段（手で置いた spawn の近く、戻る階段を優先）
    const auth = (dest.spawns || {})[o.to.spawn];
    let pair = null, best = 1e9;
    for (const b of dest.objects || []) {
      if (b.type !== 'stairs' || !b.to || (b.lv || 0) !== lv || !auth) continue;
      const d = Math.max(Math.abs(b.x - auth.x), Math.abs(b.y - auth.y));
      if (d > 3) continue;
      const k = d + (b.to.map === id ? 0 : 10);
      if (k < best) { best = k; pair = b; }
    }
    if (pair && auth && Math.abs(auth.x - pair.x) + Math.abs(auth.y - pair.y) !== 1) handAuthoredOff++;
    if (pair) {
      const dx = x - pair.x, dy = y - pair.y;
      const adj = Math.abs(dx) + Math.abs(dy) === 1;
      ok(name + `: 階段 (${pair.x},${pair.y}) の隣に着く`, adj, { at: [x, y], stairs: [pair.x, pair.y], authored: auth && [auth.x, auth.y] });
      const want = Object.keys(D4).find((k) => D4[k][0] === dx && D4[k][1] === dy);
      ok(name + ': 階段から離れる向き', adj && sp.dir === want, { dir: sp.dir, want });
      if (pair.to.map === id) ok(name + ': 1 歩で戻る階段へ戻れる', F._canEnter(dest, x, y, pair.x, pair.y, lv, want && { s: 'n', n: 's', e: 'w', w: 'e' }[want]));
    }
    ok(name + ': 歩けるマス', F._walkable(dest, x, y, null, lv), { at: [x, y], lv });
    ok(name + ': 出入り口のマスでない（すぐ移らない）', !F._warpAt(dest, x, y, lv), { at: [x, y] });
    ok(name + ': 動かない人がいない', !(dest.npcs || []).some((p) => p.x === x && p.y === y && (p.lv || 0) === lv && check(p.cond)), { at: [x, y] });
    const out = Object.keys(D4).some((k) => {
      const nx = x + D4[k][0], ny = y + D4[k][1];
      if (pair && nx === pair.x && ny === pair.y) return false;
      return F._canEnter(dest, x, y, nx, ny, lv, k) && !F._warpAt(dest, nx, ny, lv);
    });
    ok(name + ': 階段以外へ 1 歩出られる', out, { at: [x, y] });
    if (VERBOSE) console.log(`      着く ${x},${y} ${sp.dir}（手で置いた spawn ${auth ? auth.x + ',' + auth.y : '-'}）`);
  }
}
F.enter = saved.enter;
section('まとめ');
ok(`階段の数 ${n}（手で置いた spawn が階段の隣でない: ${handAuthoredOff}。着くマスは R.Field.stairsLanding が決める）`, n > 0);
done('check_stairs');
