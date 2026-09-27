#!/usr/bin/env node
// QA: 手がかりと「話す見返り」の検査（V2_PLAN §3.16 の 3「check_leads」、§3.3 の末尾・§3.5、WORLD_REDESIGN §3.3）。node だけ。
//
//   node v2/tools/qa/check_leads.js [--verbose]
//
// 1. 町ごとの見返りのある人: ファロス 8 人以上・フェルン 8 人以上・ユラ 6 人以上、種類はそれぞれ 4 種以上、空気だけの人は各町 4 人まで
//    （店・宿・酒場の番をする人と動物は数えない）。見返りのある人は新しい話の印（npc.key）を持つ。
// 2. 手がかりの参照: §3.5 の約 28 件がそろい、すべての手がかりがどこかのイベントで渡される（ev.lead / meta.gives）、
//    渡す id がすべて R.DB.leads にある、done・hideWhen の条件に出る旗が筋のどこかで立つ、place が場所かマップ。
// 3. 目印: 地方の手がかりの done が森の解決で真になる（森を解決したら森の目印が外れる）。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const R = require('../lib/load')({ quiet: true });
const D = R.DB;
const EV_SRC = fs.readdirSync(path.join(V2, 'src', 'events')).map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
const MAP_SRC = fs.readdirSync(path.join(V2, 'src', 'maps')).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n');
const KINDS = ['lead', 'side', 'discount', 'hint', 'item', 'boss', 'news'];

section('1. 話す見返りのある人（町ごと）');
const TOWNS = {
  pharos: { maps: ['pharos', 'pharos_inn', 'pharos_tavern', 'pharos_shop', 'pharos_smith', 'pharos_record', 'pharos_shipyard'], n: 8 },
  fern: { maps: ['fern', 'fern_inn', 'fern_shop', 'fern_rita', 'fern_search', 'fern_gord', 'fern_pim_home'], n: 8 },
  yura: { maps: ['yura', 'yura_inn'], n: 6 },
};
// 縦切りの後に作った地方の町（雪原: ユール 8 人以上・峠の宿 4 人以上）
if (D.maps.yule) {
  TOWNS.yule = { maps: ['yule', 'yule_hall', 'yule_inn', 'yule_items', 'yule_arms', 'yule_jorn', 'yule_sonja', 'yule_brenda', 'yule_hunter', 'yule_fishhut', 'yule_base', 'yule_branch'], n: 8 };
  TOWNS.pass_inn = { maps: ['pass_inn', 'pass_inn_in'], n: 4 };
}
const STAFF = /keeper|seller|peddler|master|smith|clerk|shop|inn_/;
for (const [town, t] of Object.entries(TOWNS)) {
  const ppl = [];
  for (const id of t.maps) for (const n of (D.maps[id] && D.maps[id].npcs) || []) ppl.push(Object.assign({ map: id }, n));
  // 序章の一幕だけの人（朝の鐘の人だかり）は数えない
  const live = ppl.filter((n) => !(n.cond && /prologue_boss/.test(JSON.stringify(n.cond)) && /!prologue_done/.test(JSON.stringify(n.cond))));
  const rew = live.filter((n) => n.reward);
  const kinds = new Set(rew.map((n) => n.reward));
  const air = live.filter((n) => !n.reward && n.talk && !/^ani_/.test(n.look) && !STAFF.test(n.id));
  ok(`${town}: 見返りのある人 ${t.n} 人以上（${rew.length}）`, rew.length >= t.n);
  ok(`${town}: 見返りの種類 4 種以上（${[...kinds].join(' ')}）`, kinds.size >= 4);
  ok(`${town}: 空気だけの人 4 人まで（${air.length}${air.length ? ': ' + air.map((n) => n.id).join(' ') : ''}）`, air.length <= 4);
  const badKind = rew.filter((n) => !KINDS.includes(n.reward)).map((n) => n.id + ':' + n.reward);
  ok(`${town}: 見返りの種類の名前（${KINDS.join('・')}）`, badKind.length === 0, badKind);
  const noKey = rew.filter((n) => !n.key).map((n) => n.id);
  ok(`${town}: 見返りのある人に新しい話の印（key）`, noKey.length === 0, noKey);
}

section('2. 手がかりの参照（§3.5）');
const given = new Set();
for (const e of Object.values(D.events)) for (const g of (e.meta && e.meta.gives) || []) if (/^lead:/.test(g)) given.add(g.slice(5));
for (const m of EV_SRC.matchAll(/\.lead\('([\w]+)'\)/g)) given.add(m[1]);
for (const m of MAP_SRC.matchAll(/lead:\s*'([\w]+)'/g)) given.add(m[1]);
const all = Object.keys(D.leads);
// 縦切りの後に作った地方（錠の外れた地方）の手がかりは目安の数に入れない
const builtR = (r) => r && D.regions[r] && !D.regions[r].slice && !['r_forest', 'prologue', 'world'].includes(r);
const nSlice = all.filter((id) => !builtR(D.leads[id].region)).length;
ok(`手がかり ${nSlice} 件（目安 約 28。ほかに作った地方の ${all.length - nSlice} 件）`, nSlice >= 26 && nSlice <= 40);
const never = all.filter((id) => !given.has(id) && D.leads[id].slice !== 'locked');
// 酒場の噂（森以外は locked）は、噂の 3 人がまとめて渡す（R.Leads の一覧か、手がかりの配列）
const rumorGive = /l_rumor_/.test(EV_SRC);
ok('すべての手がかりが、どこかのイベントで渡される', never.filter((id) => !(rumorGive && /^l_rumor_/.test(id))).length === 0, never);
const unknown = [...given].filter((id) => !D.leads[id]);
ok('渡す手がかりの id がすべてある', unknown.length === 0, unknown);
const placeBad = all.filter((id) => D.leads[id].place && !D.locations[D.leads[id].place] && !D.maps[D.leads[id].place]);
ok('手がかりの place が場所かマップ', placeBad.length === 0, placeBad);
// done・hideWhen の旗が筋のどこかで立つ
const setFlags = new Set();
for (const e of Object.values(D.events)) for (const g of (e.meta && e.meta.gives) || []) { const [k, v] = g.split(':'); if (k === 'flag' || k === 'lore') setFlags.add(v); if (k === 'region') setFlags.add('cleared_' + v); }
for (const m of EV_SRC.matchAll(/setFlag\('([\w]+)'/g)) setFlags.add(m[1]);
for (const m of EV_SRC.matchAll(/lore\(ev, '([\w]+)'\)/g)) setFlags.add(m[1]);
const flagsIn = (c, out) => {
  if (c == null || c === false || c === true) return out;
  if (typeof c === 'string') { out.push(c.replace(/^!/, '')); return out; }
  if (Array.isArray(c)) { c.forEach((x) => flagsIn(x, out)); return out; }
  if (typeof c === 'object') { for (const k of ['any', 'all', 'not']) if (c[k]) flagsIn(c[k], out); }
  return out;
};
const condBad = [];
for (const [id, l] of Object.entries(D.leads)) for (const f of flagsIn(l.done, []).concat(flagsIn(l.hideWhen, []))) if (!setFlags.has(f) && !/^(cleared_|prologue_)/.test(f)) condBad.push(`${id}: ${f}`);
ok('done・hideWhen の旗が筋のどこかで立つ', condBad.length === 0, condBad);
const want = ['l_main_rumors', 'l_main_recorder_forest', 'l_rumor_forest', 'l_forest_board', 'l_forest_pim', 'l_forest_woodcutters', 'l_forest_song', 'l_forest_hut',
  'q_fern_letters', 'q_fern_herbs', 'q_fern_song', 'q_forest_fireflies', 'q_forest_acorn', 'q_pharos_well', 'q_pharos_lamp', 'q_pharos_delivery', 'q_yura_names', 'q_pim_poet', 'l_opt_hut', 'l_opt_well', 'l_opt_yura'];
ok('§3.5 の手がかりがそろう', want.every((id) => D.leads[id]), want.filter((id) => !D.leads[id]));

section('3. 森の目印（解決で外れる）');
R.State.newGame({ seed: 1 });
const G = R.Game;
G.cleared.r_forest = true; G.flags.cleared_r_forest = true;
for (const f of setFlags) G.flags[f] = true;
G.vars.forest_verses = 3; G.visited.hut = G.visited.yura = true;
const stay = [];
for (const [id, l] of Object.entries(D.leads)) {
  if (l.region !== 'r_forest' || l.kind === 'side') continue;
  const off = (l.done != null && R.State.check(l.done)) || (l.hideWhen != null && l.hideWhen !== false && R.State.check(l.hideWhen));
  if (!off) stay.push(id);
}
ok('森の地方の手がかりは、森の解決の後に done か hideWhen が真（目印が外れる）', stay.length === 0, stay);
if (R.Leads && R.Leads.pin && R.Leads.clearRegionPins) {
  // 目印を付けて解決 → 外れる（R.Leads の動き。EVENTS の ev.clearRegion が呼ぶ口）
  R.State.newGame({ seed: 2 });
  R.Leads.add('l_forest_board');
  R.Leads.pin('l_forest_board');
  const before = [].concat(R.Leads.pinned() || []).length;
  R.Game.cleared.r_forest = true; R.Game.flags.cleared_r_forest = true;
  R.Leads.clearRegionPins('r_forest');
  const after = [].concat(R.Leads.pinned() || []).length;
  ok(`R.Leads: 解決した地方の目印は外れる（目印 ${before} → ${after}）`, before === 1 && after === 0);
  ok('R.Leads: 解決の後の l_forest_board は done', R.Leads.isDone('l_forest_board'));
}
done('check_leads');
