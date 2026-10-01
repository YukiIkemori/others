#!/usr/bin/env node
// 持ち主の製品版の試遊（2026-10-01）の砂漠の報告で直した物の戻りの確かめ: node v2/tools/test_desert_fixes_1001.js
//   カシムの門の入口（ワープ）は描いた門の前（西 d_west x 55・東 d_east x 4）で、門の口の幅ぜんぶ。町から出て着く所は入口の外。
//   砂の王墓の入口の印が 2 つ出ていた（1 マスの階段を 2 つ並べていた）→ w 2 の階段 1 つ。同じ形（隣り合う同じ行き先の入口が 2 つ）が他に無いこと。
//   砂の王墓 1 階の封じの扉の脇の壁に印（switch の物）、入口の広間の壁に看板がめり込んでいた → 印は無し・看板は床へ。
//   本物の入力で門・王墓へ歩いて入るのは test_desert_fixes_1001_browser.js。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const GEN = path.resolve(V2, '..', 'design/art_ref/gen/env/_tools/under/field_desert');
const R = require('./lib/load')({ quiet: true });
R.DB.config.slice = false;   // 製品版の形
R.State.newGame({ seed: 1 });
const M = R.DB.maps;
const F = R.Field;
const pass = (m, x, y) => !!F._walkable(m, x, y, null, 0);
const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);

section('カシムの門の入口');
for (const g of [
  { map: 'd_west', gate: 'gate_w', x: 55, y: 19, h: 3, front: 54, dir: 'e', wallX: [55, 59] },
  { map: 'd_east', gate: 'gate_e', x: 4, y: 17, h: 2, front: 5, dir: 'w', wallX: [0, 4] },
]) {
  const m = M[g.map];
  const ex = (m.exits || []).filter((e) => e.to && e.to.map === 'kasim');
  ok(`${g.map}: カシムへの入口は 1 つ`, ex.length === 1, ex);
  const e = ex[0] || {};
  ok(`${g.map}: 入口は描いた門の前（x ${g.x}、y ${g.y}〜${g.y + g.h - 1}）`, e.x === g.x && e.y === g.y && (e.w || 1) === 1 && e.h === g.h && e.to.spawn === g.gate, e);
  // 門の列（壁の厚みの外の 1 列目）の歩けるマスはぜんぶ入口の中（脇から門の奥へすり抜けない）
  const leak = [];
  for (let y = 0; y < m.h; y++) if (pass(m, g.x, y) && !inRect(e, g.x, y)) leak.push(y);
  ok(`${g.map}: 門の列 x ${g.x} の歩けるマスはぜんぶ入口`, leak.length === 0, leak);
  // 道から入口へ歩いて行ける（入口の前の列が歩ける）
  const fr = [];
  for (let y = e.y; y < e.y + e.h; y++) if (pass(m, g.front, y)) fr.push(y);
  ok(`${g.map}: 入口の前 x ${g.front} から歩いて入れる`, fr.length >= 2, fr);
  // 町から出て着く所: 入口の外で、入口の隣（すぐには入り直さない・門の前に立つ）
  const link = ((M.kasim.exits || []).find((q) => q.to && q.to.map === g.map) || {}).to;   // カシムの「ワールドへ」の出口は R.FieldArea.LINKS で付け替え済み
  const sp = m.spawns.kasim;
  ok(`${g.map}: 町から出た所（spawn kasim）は入口の外の門の前`, !!sp && !inRect(e, sp.x, sp.y) && sp.x === g.front && sp.y >= e.y && sp.y < e.y + e.h && pass(m, sp.x, sp.y), sp);
  ok(`${g.map}: 着いた向きは門から離れる向き`, !!sp && sp.dir === (g.dir === 'e' ? 'w' : 'e'), sp);
  ok(`${g.map}: カシムの門を出ると spawn kasim に着く（links）`, !!link && link.map === g.map && link.spawn === 'kasim', link);
  ok(`${g.map}: どの出口も spawn kasim に重ならない`, (m.exits || []).every((q) => !inRect(q, sp.x, sp.y)));
  // 入口の印（wayfind）は入口の四角ぜんたいで、門の奥へ向く
  const info = F.wayfind.info(m).exits.filter((q) => q.to.map === 'kasim');
  ok(`${g.map}: 入口の印は 1 つで入口と同じ四角・向き ${g.dir}`, info.length === 1 && info[0].x === e.x && info[0].y === e.y && info[0].w === 1 && info[0].h === g.h && info[0].dir === g.dir, info);
  // 下絵の生成（areas_desert.py → layout.json）と同じ
  const lp = path.join(GEN, g.map, 'layout.json');
  if (fs.existsSync(lp)) {
    const L = JSON.parse(fs.readFileSync(lp, 'utf8'));
    const le = (L.exits || []).find((q) => q.to && q.to.map === 'kasim');
    ok(`${g.map}: 生成の layout.json の入口・spawn と同じ`, !!le && le.x === e.x && le.y === e.y && le.h === e.h && JSON.stringify(L.spawns.kasim) === JSON.stringify(sp), { le, sp: L.spawns.kasim });
    const fit = L.rows_fit || L.rows;
    ok(`${g.map}: 生成の当たり（rows_fit）がマップの rows と同じ`, JSON.stringify(fit) === JSON.stringify(m.rows));
  }
}

section('砂の王墓の入口');
{
  const m = M.desert_camp3;
  const st = (m.objects || []).filter((o) => (o.type === 'stairs' || o.type === 'door') && o.to && o.to.map === 'desert_tomb_1');
  ok('王墓へ入る階段は 1 つ', st.length === 1, st.map((o) => [o.x, o.y]));
  const s = st[0] || {};
  ok('階段は描いた戸口（x 21〜22・y 5）の 2 マス幅', s.x === 21 && s.y === 5 && s.w === 2 && (s.h || 1) === 1, s);
  const seal = (m.objects || []).filter((o) => o.type === 'examine' && o.event === 'desert_tomb_sealed');
  ok('閉じている間の「調べる」も 1 つで戸口の 2 マス', seal.length === 1 && seal[0].x === 21 && seal[0].y === 5 && seal[0].w === 2, seal);
  for (const x of [21, 22]) {
    const at = R.MapUtil.objectsAt(m, x, 5, 0).map((o) => o.type);
    ok(`戸口の (${x},5) で階段が働く`, at.includes('stairs') || !R.State.check('desert_camp3_done'), at);
  }
  const G = R.Game; const f0 = G.flags.desert_camp3_done;
  G.flags.desert_camp3_done = true; R.MapUtil.invalidate && R.MapUtil.invalidate();
  const mk = F.wayfind.info(m).exits.filter((q) => q.to.map === 'desert_tomb_1');
  ok('入口の印（wayfind）は 1 つで、戸口の 2 マスのまん中（x 22.0）', mk.length === 1 && mk[0].x + mk[0].w / 2 === 22 && mk[0].dir === 'n', mk);
  ok('2 マスとも階段が働く（解いた後）', [21, 22].every((x) => R.MapUtil.objectsAt(m, x, 5, 0).some((o) => o.type === 'stairs')));
  if (f0 === undefined) delete G.flags.desert_camp3_done; else G.flags.desert_camp3_done = f0;
  R.MapUtil.invalidate && R.MapUtil.invalidate();
}

section('同じ行き先の入口が隣り合って 2 つ（入口の印が 2 つ出る形）');
{
  // 町・ダンジョン・フィールドで、別のマップ（屋内でない）へ通じる出口・戸口・階段のうち、行き先のマップ・条件・階が同じで
  // すき間 1 マス以下の物の組。ダンジョンの階段どうし（印を出さない）は除く
  const bad = [];
  for (const m of Object.values(M)) {
    if (!['town', 'dungeon', 'field'].includes(m.kind)) continue;
    const ents = [];
    for (const e of m.exits || []) if (e.to) ents.push({ warp: false, x: e.x, y: e.y, w: e.w || 1, h: e.h || 1, to: e.to, cond: e.cond, lv: e.lv || 0 });
    for (const o of m.objects || []) if ((o.type === 'door' || o.type === 'stairs') && o.to) ents.push({ warp: true, x: o.x, y: o.y, w: o.w || 1, h: o.h || 1, to: o.to, cond: o.cond, lv: o.lv || 0 });
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const a = ents[i], b = ents[j];
      if (a.to.map !== b.to.map || a.to.map === m.id || a.lv !== b.lv || JSON.stringify(a.cond) !== JSON.stringify(b.cond)) continue;
      const d = M[a.to.map] || {};
      if (d.kind === 'interior' || (m.kind === 'dungeon' && d.kind === 'dungeon' && a.warp && b.warp)) continue;
      const gx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), gy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
      if (Math.max(gx, gy) <= 1) bad.push(`${m.id}@${a.x},${a.y}+${b.x},${b.y}→${a.to.map}`);
    }
  }
  ok('隣り合う同じ行き先の入口の組が無い（幅のある入口は w・h の 1 つの物で）', bad.length === 0, bad);
  const gs = (M.ghost_ship_1.objects || []).filter((o) => o.type === 'door' && o.to && o.to.map === 'nerei');
  ok('幽霊船の渡り板（ネレイへ戻る）も 1 つの戸口で w 2', gs.length === 1 && gs[0].x === 28 && gs[0].w === 2, gs);
}

section('砂の王墓の壁にめり込んだ物（1〜3 階）');
{
  // 戸口・階段・出口（壁のマスに置く物）のほかは、床のマスに置く。流砂の「調べる」は流砂（shallow）の上で良い
  const bad = [];
  for (const id of ['desert_tomb_1', 'desert_tomb_2', 'desert_tomb_3']) {
    const m = M[id];
    for (const o of m.objects || []) {
      if (['door', 'stairs', 'exit'].includes(o.type) || o.x == null) continue;
      const c = R.MapUtil.cell(m, o.x, o.y) || {};
      if ((c.solid || c.walk === false) && !(o.type === 'examine' && c.mat === 'shallow')) bad.push(`${id} ${o.type}:${o.id || o.event || ''}@${o.x},${o.y}`);
    }
  }
  ok('王墓の物はどれも床の上（壁の中に印・看板が立たない）', bad.length === 0, bad);
  const m = M.desert_tomb_1;
  ok('1 階の封じの扉の脇の壁に印（switch の物）が無い', !(m.objects || []).some((o) => o.type === 'prop' && o.id === 'switch'));
  const sg = (m.objects || []).find((o) => o.type === 'sign');
  ok('1 階の看板は入口の広間の床（26,35）で、前の床から読める', !!sg && sg.x === 26 && sg.y === 35 && pass(m, 26, 36), sg);
}

done('test_desert_fixes_1001');
