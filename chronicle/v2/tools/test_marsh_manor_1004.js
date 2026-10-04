#!/usr/bin/env node
// 霧の館の当たりを下絵に合わせた直しの戻りの確かめ（持ち主 2026-10-04「人形の楽団の部屋からメルダの部屋への廊下が、ほとんど通れず、壁に埋まって歩く」）:
//   node v2/tools/test_marsh_manor_1004.js
//   2 階（marsh_manor_2）: 描いた床（lighthouse/under/manor_2）と当たりが合う。音楽室 → メルダの部屋の口は x 34〜35・y 9〜11（描いた口）、
//     前の口（y 12〜13 = 描いた闇）・回廊の下の壁の顔（y 24〜25）・北の部屋の下の壁（y 17）は歩けない。
//     本物の入力で 踊り場 → 回廊 → 音楽室（楽団の段を通る）→ メルダの部屋 へ歩ける。楽団・メルダのトリガーは通り道をふさぐ幅。
//     調べる物・宝箱・人は歩けるマスの隣（宝箱は歩けるマス）。
//   1 階（marsh_manor_1）: 大広間の y 3（壁の腰）・y 13（下の壁）は大階段・書庫の階段・中庭の口だけ。台所 ↔ 温室の口は x 37〜38。
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true });
R.DB.config.slice = false;
R.State.newGame({ seed: 1 });
const D = R.DB, F = R.Field, S = F._s, I = R.Input;
const adv = (ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(50); await flush(); } }
async function step(b) {
  I._set(b, true);
  for (let t = 0; t < 34; t += 16.67) { adv(16.67); await flush(); }
  I._set(b, false);
  for (let i = 0; i < 40 && (S.mv || S.arriving); i++) { adv(16.67); await flush(); }
  await settle(60);
}
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);

function bfs(m, from, to) {
  const W = m.rows[0].length, H = m.rows.length, prev = new Map(), key = (x, y) => x + ',' + y, q = [from];
  prev.set(key(...from), null);
  while (q.length) {
    const [x, y] = q.shift();
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy, b] of [[0, -1, 'up'], [0, 1, 'down'], [1, 0, 'right'], [-1, 0, 'left']]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(key(nx, ny)) || !pass(m, nx, ny)) continue;
      prev.set(key(nx, ny), [x, y, b]); q.push([nx, ny]);
    }
  }
  if (!prev.has(key(...to))) return null;
  const out = []; let c = to;
  while (prev.get(key(...c))) { const p = prev.get(key(...c)); out.unshift({ b: p[2], at: c }); c = [p[0], p[1]]; }
  return out;
}

async function main() {
  const m2 = D.maps.marsh_manor_2, m1 = D.maps.marsh_manor_1;
  section('1. 2 階の当たりが下絵の床');
  const rect = (x, y, w, h) => { const a = []; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) a.push([i, j]); return a; };
  const OPEN = [['音楽室', rect(14, 4, 20, 13)], ['メルダの部屋の口', rect(34, 9, 2, 3)], ['メルダの部屋', rect(36, 4, 9, 13)], ['子ども部屋', rect(3, 4, 9, 13)],
    ['回廊', rect(3, 21, 42, 3)], ['音楽室への口', rect(22, 17, 4, 4)], ['子ども部屋への口', rect(7, 17, 1, 4)], ['南西の寝室', rect(3, 27, 13, 6)], ['南東の寝室', rect(32, 27, 13, 6)],
    ['踊り場', rect(19, 27, 10, 6)], ['踊り場への口', rect(22, 24, 4, 3)]];
  const SOLID = [['前の口（描いた闇）', rect(34, 12, 2, 2)], ['北の部屋の下の壁', rect(14, 17, 8, 1).concat(rect(26, 17, 8, 1), rect(36, 17, 9, 1), rect(3, 17, 4, 1))],
    ['回廊の下の壁の顔', rect(10, 24, 12, 2).concat(rect(26, 24, 12, 2), rect(40, 24, 5, 2))], ['回廊の上の壁の顔', rect(8, 19, 14, 2).concat(rect(26, 19, 19, 2))],
    ['音楽室とメルダの部屋の間の壁', rect(34, 4, 2, 5).concat(rect(34, 12, 2, 5))], ['南の部屋の下の壁', rect(3, 33, 13, 1).concat(rect(32, 33, 13, 1))]];
  const blocked = (m, cells) => cells.filter(([x, y]) => !pass(m, x, y) && !(m.objects || []).some((o) => o.x === x && o.y === y && o.type !== 'examine'));
  for (const [n, cells] of OPEN) { const b = blocked(m2, cells); ok(`2 階 ${n}: 描いた床が歩ける`, b.length === 0, b.slice(0, 8)); }
  for (const [n, cells] of SOLID) { const b = cells.filter(([x, y]) => pass(m2, x, y)); ok(`2 階 ${n}: 歩けない`, b.length === 0, b.slice(0, 8)); }

  section('2. 置いた物・人・トリガー');
  {
    const bad = [];
    for (const o of m2.objects || []) {
      if (o.type === 'chest' && !pass(m2, o.x, o.y) && !(R.MapUtil.objectsAt(m2, o.x, o.y, 0).length)) bad.push(o.id);
      if (o.type === 'examine' && ![[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => pass(m2, o.x + dx, o.y + dy))) bad.push(o.event + '@' + o.x + ',' + o.y);
    }
    ok('調べる物は歩けるマスの隣', bad.length === 0, bad);
    const fl = (x, y) => m2.rows[y][x] !== '#';
    ok('宝箱・飾り・人・spawn は描いた床の上', (m2.objects || []).filter((o) => o.type === 'chest' || o.type === 'prop').every((o) => fl(o.x, o.y)) && m2.npcs.every((n) => fl(n.x, n.y)) && Object.values(m2.spawns).every((s) => pass(m2, s.x, s.y)));
    const band = m2.triggers.find((t) => t.id === 'band'), mel = m2.triggers.find((t) => t.id === 'melda');
    ok('楽団のトリガーは音楽室の幅ぜんぶ（x 14〜33）', band.x === 14 && band.w === 20);
    ok('メルダのトリガーは口（x 34〜35、y 9〜11）を覆う', mel.x <= 34 && mel.x + mel.w >= 36 && mel.y <= 9 && mel.y + mel.h >= 12);
    // 音楽室の南（y 14 以下）から口へ、楽団の段（y 11〜13）を通らずには行けない
    const noBand = { rows: m2.rows.map((r, y) => [...r].map((c, x) => (y >= 11 && y <= 13 && x >= 14 && x <= 33 ? '#' : c)).join('')) };
    const m2b = Object.assign({}, m2, { rows: noBand.rows, id: 'marsh_manor_2_nb' });
    R.MapUtil.invalidate && R.MapUtil.invalidate();
    ok('楽団の段を通らずに口へは行けない', !bfs(m2b, [23, 16], [34, 10]));
    R.MapUtil.invalidate && R.MapUtil.invalidate();
  }

  section('3. 本物の入力で 踊り場 → 回廊 → 音楽室 → メルダの部屋');
  {
    R.Game.flags.marsh_dolls = true; R.Game.flags.marsh_melda_met = true; R.Game.flags.marsh_melda_gone = true;   // 楽団・メルダの会話は出さない（道だけ）
    const keep = m2.triggers; m2.triggers = [];
    await F.enter('marsh_manor_2', { x: 23, y: 31, dir: 'n' }, { fade: 0, noAutosave: true }); await settle(300);
    F.encounter.suppress(1000);
    const route = bfs(m2, [23, 31], [40, 12]);
    ok('道がある（踊り場 → メルダの部屋）', !!route, null);
    const walked = [];
    for (const s of route || []) {
      await step(s.b);
      walked.push(F.pos.x + ',' + F.pos.y);
      if (F.pos.x !== s.at[0] || F.pos.y !== s.at[1]) break;
    }
    ok(`踊り場 (23,31) から ${route ? route.length : 0} 歩でメルダの部屋 (40,12) に着く（口 x 34〜35・y 9〜11 を通る）`, F.pos.x === 40 && F.pos.y === 12 && S.map.id === 'marsh_manor_2' && walked.some((p) => /^3[45],(9|10|11)$/.test(p)), walked.slice(-12));
    m2.triggers = keep;
  }

  section('4. 1 階の当たりが下絵の床');
  {
    const b3 = []; for (let x = 3; x <= 44; x++) if (pass(m1, x, 3) && x !== 23 && x !== 24) b3.push(x);
    ok('大広間の y 3（壁の腰）は大階段だけ', b3.length === 0, b3);
    const b13 = []; for (let x = 3; x <= 44; x++) if (pass(m1, x, 13) !== [8, 9, 22, 23, 24, 25].includes(x)) b13.push(x);
    ok('大広間の y 13 は書庫の階段（8〜9）と中庭の口（22〜25）だけ', b13.length === 0, b13);
    ok('台所 ↔ 温室の口は x 37〜38（39 は描いた壁）', pass(m1, 37, 27) && pass(m1, 38, 28) && !pass(m1, 39, 27) && !pass(m1, 39, 28));
    const r = bfs(m1, [23, 37], [23, 5]);
    ok('玄関 → 大広間の大階段の前へ歩ける', !!r);
    for (const [n, a] of [['書庫', [5, 20]], ['台所', [40, 32]], ['温室', [40, 25]], ['食堂', [5, 32]]]) ok(`玄関 → ${n}へ歩ける`, !!bfs(m1, [23, 37], a));
  }
  done();
}
main().catch((e) => { console.error(e); process.exit(1); });
