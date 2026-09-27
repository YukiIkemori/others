#!/usr/bin/env node
// QA: 戸口と到達の検査（node だけ。FIELD の本物の当たり R.Field._canEnter ＝ マス・物（柵・樽…）・建物の敷地・高さ・一方通行、
// 動かない人（still か押せない人）もふさぐ）。オーナーの報告「扉が開かない」「柵が邪魔で入れない家」の再発を止める。
//
//   node v2/tools/qa/check_reach.js [--all] [--map id,…] [--verbose] [--json]
//
// 対象: 縦切りのマップ（stub_・field_・t_ を除く）。砂漠と雪（desert_・snow_、region r_desert・r_snow）は別の担当が作っている途中なので --all のときだけ。
// 出発: そのマップの spawn のうち「外から着く所」（ほかのマップの出口・locations・ワープが指す spawn。屋内から戻る所 <名>_door は除く。
//       屋内・ダンジョンは全部の spawn）。そこから FIELD の歩き方（M.bfs）で歩いて届くマスを数える。
// 検査:
//  1 建物: 描いた建物（v2/assets/env/*/bld/<id>.json）に戸があれば、マップの建物に戸口 door と行き先 to がある（押して開かない戸を残さない）。
//    戸口は敷地のいちばん下の行で、描いた戸（door32）のマスと同じ列（建物の絵が自分の戸口をふさがない）。
//  2 戸口: 戸口のマスが歩けて（FIELD._walkable）、その前（1 つ下）のマスが歩けて出発から届く。
//  3 出入り口: 出口・階段・扉（cond の無い物。cond のある物は数えるだけ）に出発から届く。行き先のマップと spawn がある。
//  4 人: どの人（cond の無い人）にも話しかけるマス（上下左右・台の向こう）に届く。
//  5 調べる物: 宝箱・看板・調べる所・泉に届く。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ALL = argv.includes('--all');
const VERBOSE = argv.includes('--verbose');
const ONLY = arg('--map', null);

const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
const F = R.Field;

// ---------------------------------------------------------------- 描いた建物の戸（env の meta）
const BLD = {};
const ENV = path.join(V2, 'assets', 'env');
for (const th of fs.readdirSync(ENV)) {
  const d = path.join(ENV, th, 'bld');
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) if (/\.json$/.test(f)) { try { const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); BLD[j.id || f.replace(/\.json$/, '')] = j; } catch (e) { /* */ } }
}
const artOf = (o) => BLD[o.id] || (o.art && BLD[o.art]) || null;

const isOther = (id, m) => /^(desert_|snow_)/.test(id) || /desert|snow/.test(m.region || '') || /desert|snow/.test(m.theme || '');
const maps = M.sliceMaps().filter((id) => (ALL || !isOther(id, R.DB.maps[id])) && (!ONLY || ONLY.split(',').includes(id)));

// ---------------------------------------------------------------- どの spawn が「外から着く所」か
const fromOutside = {};   // mapId → Set(spawn)
const fromInside = {};
const note = (tbl, map, sp) => { if (typeof sp !== 'string') return; (tbl[map] = tbl[map] || new Set()).add(sp); };
for (const [id, m] of Object.entries(R.DB.maps)) {
  for (const p of M.portals(m, { all: true })) note(m.kind === 'interior' ? fromInside : fromOutside, p.to.map, p.to.spawn);
}
for (const l of Object.values(R.DB.locations || {})) note(fromOutside, l.map, l.spawn);
if (R.DB.config && R.DB.config.start) note(fromOutside, R.DB.config.start.map, R.DB.config.start.spawn);

function startsOf(m) {
  const names = Object.keys(m.spawns || {});
  let pick = names;
  if (m.kind !== 'interior' && m.kind !== 'dungeon') {
    const out = fromOutside[m.id] || new Set();
    pick = names.filter((s) => out.has(s) || s === 'warp' || !(fromInside[m.id] || new Set()).has(s));
    if (!pick.length) pick = names;
  }
  return pick.map((s) => { const d = M.dest({ map: m.id, spawn: s }); return { name: s, x: d.x, y: d.y, lv: d.lv || 0 }; });
}

const report = [];
const fail = (map, what, info) => { report.push({ map, what, info }); ok(`${map}: ${what}`, false, info); };
const gated = new Set();
let nDoors = 0, nPortals = 0, nNpcs = 0, nObjs = 0, nCond = 0;

for (const id of maps) {
  const m = R.DB.maps[id];
  const starts = startsOf(m);
  // 出発の状態（新しいゲームのフラグ）で歩く。届かなければ、cond のある物（切れる丸太・下りる橋・出る人…）を全部どけた形でも歩く
  // （後で開く所 = 「後で届く」として数える。どちらでも届かなければ失敗）
  const res = M.bfs(m, starts, { through: false });
  const orig = R.State.check;
  let res2;
  R.State.check = () => false;
  try { res2 = M.bfs(m, starts, { through: false }); } finally { R.State.check = orig; }
  const reach = (x, y, lv) => {
    if (res.get(x, y, lv || 0) != null) return true;
    if (res2.get(x, y, lv || 0) != null) { gated.add(id + ':' + x + ',' + y); return true; }
    return false;
  };
  const anyReach = (cells) => cells.some((c) => reach(c.x, c.y, c.lv));
  const before = report.length;

  // 1・2 建物と戸口
  for (const o of m.objects || []) {
    if (o.type !== 'building') continue;
    // ワールドの建物は町の目印（入るのは町の出口の範囲）。戸の検査は町・村・屋内・ダンジョンだけ
    if (m.kind === 'world') continue;
    const art = artOf(o), painted = art ? !!art.door32 : !!o.door;
    if (!o.door) {
      if (painted) fail(id, `建物 ${o.id} の絵に戸があるのに戸口 door が無い（押しても開かない）`, { x: o.x, y: o.y });
      continue;
    }
    nDoors++;
    const d = o.door;
    if (o.cond != null) { nCond++; continue; }
    if (!d.to) { fail(id, `建物 ${o.id} の戸口 ${d.x},${d.y} に行き先 to が無い（鍵の掛かった戸）`); continue; }
    if (!R.DB.maps[d.to.map]) fail(id, `建物 ${o.id} の戸口 → マップ ${d.to.map} が無い`);
    else if (typeof d.to.spawn === 'string' && !(R.DB.maps[d.to.map].spawns || {})[d.to.spawn]) fail(id, `建物 ${o.id} の戸口 → ${d.to.map} の spawn ${d.to.spawn} が無い`);
    if (d.y !== o.y + (o.h || 1) - 1 || d.x < o.x || d.x >= o.x + (o.w || 1)) fail(id, `建物 ${o.id} の戸口 ${d.x},${d.y} が敷地のいちばん下の行に無い`, { x: o.x, y: o.y, w: o.w, h: o.h });
    if (art && art.door32) {
      const want = o.x + Math.floor(art.door32.x / 32);
      if (want !== d.x) fail(id, `建物 ${o.id} の戸口 x ${d.x} が描いた戸の列 x ${want} と違う（絵が戸口をふさぐ）`);
    }
    const lv = o.lv || 0;
    if (!F._walkable(m, d.x, d.y, 'n', lv)) fail(id, `建物 ${o.id} の戸口 ${d.x},${d.y} が歩けない`);
    const fx = d.x, fy = d.y + 1;
    if (!F._walkable(m, fx, fy, null, lv) || F._warpAt(m, fx, fy, lv)) fail(id, `建物 ${o.id} の戸口の前 ${fx},${fy} が歩けない（物・柵・崖がふさぐ）`, R.MapUtil.objectsAt(m, fx, fy).map((q) => q.type + ':' + (q.id || '')));
    else if (!reach(fx, fy, lv)) fail(id, `建物 ${o.id} の戸口の前 ${fx},${fy} に出発（${starts.map((s) => s.name).join('・')}）から届かない`);
    if (!reach(d.x, d.y, lv)) fail(id, `建物 ${o.id} の戸口 ${d.x},${d.y} に届かない`);
  }

  // 3 出入り口（建物の戸口は上で）
  for (const p of M.portals(m, { all: true })) {
    if (p.kind === 'building') continue;
    nPortals++;
    const t = R.DB.maps[p.to.map];
    if (!t) { fail(id, `${p.kind} ${p.x},${p.y} → マップ ${p.to.map} が無い`); continue; }
    if (typeof p.to.spawn === 'string' && !(t.spawns || {})[p.to.spawn]) fail(id, `${p.kind} ${p.x},${p.y} → ${p.to.map} の spawn ${p.to.spawn} が無い`);
    if (p.cond != null) { nCond++; continue; }
    const cells = [];
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) cells.push({ x: p.x + i, y: p.y + j, lv: p.lv == null ? 0 : p.lv });
    if (!cells.some((c) => F._walkable(m, c.x, c.y, null, c.lv))) fail(id, `${p.kind} ${p.x},${p.y} → ${p.to.map} のマスが歩けない`);
    else if (!anyReach(cells)) fail(id, `${p.kind} ${p.x},${p.y} → ${p.to.map} に出発（${starts.map((s) => s.name).join('・')}）から届かない`);
  }

  // 4 人
  for (const n of m.npcs || []) {
    if (n.x == null) continue;
    if (n.cond != null) { nCond++; continue; }
    nNpcs++;
    const cells = M.standCells(m, { kind: 'npc', ref: n });
    if (!anyReach(cells)) fail(id, `人 ${n.id}（${n.x},${n.y}）に話しかけるマスに届かない`);
  }

  // 5 調べる物
  for (const o of m.objects || []) {
    if (!['chest', 'sign', 'examine', 'spring'].includes(o.type)) continue;
    if (o.cond != null) { nCond++; continue; }
    nObjs++;
    const cells = M.standCells(m, { kind: 'obj', ref: o });
    if (!anyReach(cells)) fail(id, `${o.type} ${o.id || o.event || ''}（${o.x},${o.y}）に届かない`);
  }
  if (VERBOSE || report.length === before) console.log(`${report.length === before ? 'pass' : '    '}  ${id}: 出発 ${starts.map((s) => s.name).join('・')}、届くマス ${res.dist.size}`);
}

section('まとめ');
ok(`縦切りのマップ ${maps.length} 枚: 戸口 ${nDoors}・出入り口 ${nPortals}・人 ${nNpcs}・調べる物 ${nObjs}（cond のある物 ${nCond} は数えるだけ。後で開く所を通って届くマス ${gated.size}）がどれも出発から届く`, report.length === 0, report.length + ' problems');
if (argv.includes('--json')) {
  const f = path.join(V2, 'design', 'qa', 'check_reach.json');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ date: new Date().toISOString(), maps, problems: report }, null, 1));
}
done('check_reach');
