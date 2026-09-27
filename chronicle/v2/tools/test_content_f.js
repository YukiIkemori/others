#!/usr/bin/env node
// CONTENT-F のテスト（node）。V2_PLAN §4.4 の CONTENT-P・F の行:
//   progress の自分の範囲（到達・必須の物が隠し通路や寄り道の先に無い・どの道でも clearRegion に着く）、meta の needs/gives、
//   手がかり・見返りの人の数、泉・宝箱・隠し通路の規則、文の検査、ボイスの id と文面。
//   node v2/tools/test_content_f.js [--verbose]
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const { MY_MAPS, load, state, reach, reachObj } = require('./test_content_f_lib');

const VERBOSE = process.argv.includes('--verbose');
const R = load();
const CHRON = path.resolve(__dirname, '..', '..');
const warn = (m) => console.log('warn  ' + m);

const MY_EVENT_FILES = fs.readdirSync(path.join(__dirname, '..', 'src', 'events')).filter((f) => /^(forest_|yura_|optional_hut|optional_twin)/.test(f));
const myEventIds = new Set();
for (const f of MY_EVENT_FILES) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'events', f), 'utf8');
  for (const m of src.matchAll(/\bE\('([a-z0-9_]+)'/g)) myEventIds.add(m[1]);
}

// ================================================================ 1. 形（契約）
section('契約の形');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  ok(`map ${id} がある`, !!m);
  if (!m) continue;
  const r = R.Contract.check('map', m);
  ok(`map ${id} が K.map`, r.ok, r.errors);
  for (const [ch, le] of Object.entries(m.legend)) { const c = R.Contract.check('legendEntry', le); if (!c.ok) ok(`${id} legend '${ch}'`, false, c.errors); }
  const rows = m.rows;
  ok(`map ${id} の行の数と幅`, rows.length === m.h && rows.every((r) => [...r].length === m.w));
  ok(`map ${id} の字がすべて legend にある`, rows.every((r) => [...r].every((c) => m.legend[c])), [...new Set(rows.join('').split('').filter((c) => !m.legend[c]))]);
}
for (const id of myEventIds) {
  const e = R.DB.events[id];
  ok(`event ${id} が K.event`, e && R.Contract.check('event', e).ok, e ? R.Contract.check('event', e).errors : 'missing');
}
const myLeads = Object.keys(R.DB.leads).filter((k) => /^(l_forest_|q_fern_|q_forest_|q_yura_|q_pim_|l_opt_hut|l_opt_yura)/.test(k));
for (const id of myLeads) { const r = R.Contract.check('lead', R.DB.leads[id]); ok(`lead ${id} が K.lead`, r.ok, r.errors); }
for (const id of ['letter_forest_pim_poem', 'letter_lz_1']) { const r = R.Contract.check('letter', R.DB.letters[id] || {}); ok(`letter ${id} が K.letter`, r.ok, r.errors); }
ok('手がかり: 地方 5・依頼 7・寄り道の噂 2', ['l_forest_board', 'l_forest_pim', 'l_forest_woodcutters', 'l_forest_song', 'l_forest_hut', 'q_fern_letters', 'q_fern_herbs', 'q_fern_song', 'q_forest_fireflies', 'q_forest_acorn', 'q_yura_names', 'q_pim_poet', 'l_opt_hut', 'l_opt_yura'].every((k) => R.DB.leads[k]));
ok('手がかりの題名は全角 14 字以内', myLeads.every((k) => [...R.DB.leads[k].title].length <= 14), myLeads.filter((k) => [...R.DB.leads[k].title].length > 14));
ok('読み物 5（lo_ev_forest lo_time_forest lo_war_forest lo_forest_moss_stone lo_lz_1）', ['lo_ev_forest', 'lo_time_forest', 'lo_war_forest', 'lo_forest_moss_stone', 'lo_lz_1'].every((k) => R.DB.lore && R.DB.lore[k] && R.DB.lore[k].title));
ok('年代記の章 r_forest（title・parts）', R.DB.chronicle && R.DB.chronicle.r_forest && R.DB.chronicle.r_forest.parts.length >= 5);

// ================================================================ 2. 参照（素材・物・見た目・編成・品・店・イベント・出口）
section('参照');
const LOOKS_PLAN = new Set(['berna', 'rowell', 'fine', 'otto', 'elm', 'npc_hanna', 'npc_rita', 'npc_gord', 'npc_pim_mother', 'npc_pim', 'npc_hans', 'npc_ben', 'npc_roy', 'npc_yura_elder', 'ani_cat', 'ani_dog', 'ani_hen', 'ani_fawn']);
const TYPES = ['man', 'woman', 'old_m', 'old_f', 'child', 'sailor', 'merchant', 'woodcutter', 'guard', 'keeper', 'bard', 'yura_folk'];
const lookOk = (l) => LOOKS_PLAN.has(l) || (R.DB.looks && R.DB.looks[l]) || new RegExp('^npc_(' + TYPES.join('|') + ')_[1-4]$').test(l);
const PROP_IDS = new Set(Object.keys(R.DB.props));
const missingItems = new Set();
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  if (!m) continue;
  const badMat = Object.values(m.legend).map((l) => l.mat).concat(Object.values(m.legend).filter((l) => l.floor).map((l) => l.floor), [m.outside]).filter((x) => x && !R.DB.materials[x]);
  ok(`${id}: 素材がすべて R.DB.materials`, badMat.length === 0, badMat);
  const badProp = (m.objects || []).filter((o) => o.type === 'prop' && !PROP_IDS.has(o.id)).map((o) => o.id);
  ok(`${id}: 物がすべて R.DB.props`, badProp.length === 0, badProp);
  const badLook = (m.npcs || []).filter((n) => !lookOk(n.look)).map((n) => n.look);
  ok(`${id}: 見た目の id が §2.6.2 の一覧`, badLook.length === 0, badLook);
  if (m.theme) ok(`${id}: theme が THEMES`, R.Contract.THEMES.includes(m.theme), m.theme);
  ok(`${id}: light.mood が MOODS`, !m.light || R.Contract.MOODS.includes(m.light.mood), m.light);
  for (const z of m.zones || []) ok(`${id}: 出現表 ${z.zone} がある`, !!R.DB.encounters[z.zone]);
  const evs = [];
  for (const o of m.objects || []) if (o.event) evs.push(o.event);
  for (const n of m.npcs || []) if (typeof n.talk === 'string') evs.push(n.talk);
  for (const t of m.triggers || []) evs.push(t.event);
  const noEv = evs.filter((e) => !R.DB.events[e]);
  ok(`${id}: イベントの参照がすべてある`, noEv.length === 0, [...new Set(noEv)]);
  const outs = [];
  for (const e of m.exits || []) outs.push(e.to);
  for (const o of m.objects || []) { if (o.type === 'building' && o.door && o.door.to) outs.push(o.door.to); if ((o.type === 'stairs' || o.type === 'door') && o.to) outs.push(o.to); }
  for (const to of outs) {
    const t = R.DB.maps[to.map];
    if (!t) { if (MY_MAPS.includes(to.map)) ok(`${id} → ${to.map}: マップがある`, false); else warn(`${id} → ${to.map}（CONTENT-P のマップ、まだ無い）`); continue; }
    ok(`${id} → ${to.map}.${to.spawn}: spawn がある`, !!(t.spawns && t.spawns[to.spawn]));
  }
  for (const o of m.objects || []) if (o.type === 'chest' && o.item && !R.DB.items[o.item]) missingItems.add(o.item);
  for (const n of m.npcs || []) ok(`${id}: 人 ${n.id} の lv と足場`, (n.lv || 0) === 0 || (R.MapUtil.cell(m, n.x, n.y) || {}).deck === true);
}
for (const id of ['tr_a21_forest_wolves', 'tr_b_moth', 'tr_b_rooteater']) ok(`編成 ${id} がある`, !!R.DB.troops[id]);
ok('どんぐり王子 rm_acorn_prince がある', !!R.DB.monsters.rm_acorn_prince);
for (const id of ['shop_fern_items', 'shop_fern_peddler', 'shop_yura']) ok(`店 ${id} がある`, !!R.DB.shops[id]);
for (const id of ['location:fern', 'location:verda', 'location:elder', 'location:yura', 'location:hut']) {
  const l = R.DB.locations[id.split(':')[1]];
  if (!l) { warn(`R.DB.${id} がまだ無い（CONTENT-P）`); continue; }
  ok(`${id} → ${l.map}.${l.spawn}`, R.DB.maps[l.map] && R.DB.maps[l.map].spawns[l.spawn]);
}
// イベントの中の品・ボイス・手紙の参照（ソースから拾う）
const SRC = MY_EVENT_FILES.map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'events', f), 'utf8')).join('\n');
for (const m of SRC.matchAll(/(?:give\(ev, |ev\.item\(|ev\.take\(|ev\.has\()'([a-z0-9_]+)'/g)) if (!R.DB.items[m[1]]) missingItems.add(m[1]);
for (const m of SRC.matchAll(/\['([a-z]+_[a-z0-9_]+)', \d\]/g)) if (/^(i|ac|hd|ft|w|u|k)_/.test(m[1]) && !R.DB.items[m[1]]) missingItems.add(m[1]);
const REQUESTED = new Set(['ac_climb_shoes']);   // RULES に依頼した品（requests.jsonl）
const trulyMissing = [...missingItems].filter((i) => !REQUESTED.has(i));
ok('品の参照がすべてある（依頼中の物を除く）', trulyMissing.length === 0, trulyMissing);
for (const i of missingItems) if (REQUESTED.has(i)) warn(`品 ${i} は RULES に依頼中`);
for (const m of SRC.matchAll(/ev\.letter\('([a-z0-9_]+)'\)/g)) ok(`手紙 ${m[1]} がある`, !!R.DB.letters[m[1]]);
for (const m of SRC.matchAll(/ev\.call\('([a-z0-9_]+)'/g)) ok(`ev.call ${m[1]} がある`, !!R.DB.events[m[1]]);
for (const m of SRC.matchAll(/ev\.lead\('([a-z0-9_]+)'\)/g)) {
  if (R.DB.leads[m[1]]) ok(`手がかり ${m[1]} がある`, true);
  else if (/^l_main_/.test(m[1])) warn(`手がかり ${m[1]} は CONTENT-P（leads_main.js）`); else ok(`手がかり ${m[1]} がある`, false);
}

// ================================================================ 3. 置き場所の決まり（§2.6.1・WORLD §6）
section('置き場所の決まり');
const DUNGEON_FLOORS = { verda_1: [5, 7], verda_2: [5, 7], elder_1: [3, 5], elder_2: [3, 5] };
for (const id of MY_MAPS) {
  const m = R.DB.maps[id];
  if (!m) continue;
  const secrets = [];
  R.MapUtil.grid(m).forEach((r, y) => [...r].forEach((c, x) => { if (m.legend[c] && m.legend[c].secret) secrets.push([x, y]); }));
  if (m.kind !== 'dungeon') ok(`${id}: 隠し通路はダンジョンだけ`, secrets.length === 0);
  const chests = (m.objects || []).filter((o) => o.type === 'chest');
  if (DUNGEON_FLOORS[id]) {
    const [a, b] = DUNGEON_FLOORS[id];
    ok(`${id}: 宝箱 ${a}〜${b}（${chests.length}）`, chests.length >= a && chests.length <= b);
    // 泉は 1 ダンジョンに 1 つまで（WORLD §6.2、check_springs）: 迷いの森（短い）は 0、千年樹は 2 階の根食らいの手前だけ
    const ns = (m.objects || []).filter((o) => o.type === 'spring').length;
    ok(`${id}: 泉 ${id === 'elder_2' ? 1 : 0}（${ns}）`, ns === (id === 'elder_2' ? 1 : 0));
    ok(`${id}: 隠し通路は 1 か所まで（${secrets.length ? 1 : 0}）`, secrets.length <= 3);
    ok(`${id}: 出現表がある`, (m.zones || []).length > 0);
  }
  // 宝箱は上に重なる物（overChars）の下に置かない・硬いマスに置かない
  for (const c of chests) {
    const over = (m.objects || []).filter((o) => o !== c && o.type === 'prop' && (R.DB.props[o.id] || {}).overChars && Math.abs(o.x - c.x) <= 1 && Math.abs(o.y - c.y) <= 1);
    ok(`${id}: 宝箱 ${c.id} の上に重なる物が無い`, over.length === 0);
    const cell = R.MapUtil.cell(m, c.x, c.y) || {};
    ok(`${id}: 宝箱 ${c.id} は歩ける床の上`, cell.walk !== false && !(cell.solid && !cell.secret) && ((c.lv || 0) === 0 || cell.deck));
  }
  // 物どうしが同じマスに重ならない（調べる物と飾りの組は除く）
  const seen = new Map();
  for (const o of m.objects || []) {
    if (o.x == null || o.type === 'examine' || o.type === 'trail' || o.cond) continue;
    for (const k of R.ContentF.kit.cellsOf(o)) {
      const kk = k + ',' + (o.lv || 0);
      if (seen.has(kk) && o.type !== 'building' && seen.get(kk).type !== 'building') ok(`${id}: 物が重ならない ${kk} ${seen.get(kk).id || seen.get(kk).type}/${o.id || o.type}`, false);
      seen.set(kk, o);
    }
  }
}
ok('町（フェルン）に宝箱 2', (R.DB.maps.fern.objects || []).filter((o) => o.type === 'chest').length === 2);
ok('ユラに宝箱 1', (R.DB.maps.yura.objects || []).filter((o) => o.type === 'chest').length === 1);
ok('休み小屋に宝箱 1', (R.DB.maps.hut.objects || []).filter((o) => o.type === 'chest').length === 1);

// ================================================================ 4. 到達（progress の自分の範囲）
section('到達');
function reachAll(mapId, spawn, st, label, opts) {
  opts = opts || {};
  state(R, st);
  const m = R.DB.maps[mapId];
  const sp = R.MapUtil.spawn(m, spawn);
  const r = reach(R, m, { x: sp.x, y: sp.y, lv: (m.spawns[spawn] || {}).lv || 0 });
  const miss = [];
  for (const o of m.objects || []) {
    if (o.type === 'trail' || (o.type === 'prop' && !['songstone', 'board', 'stall'].includes(o.id))) continue;
    if (o.cond != null && !R.State.check(o.cond)) continue;
    if (opts.skip && opts.skip(o)) continue;
    const d = o.type === 'building' ? (o.door ? r.get(o.door.x, o.door.y + 1, 0) : 0) : reachObj(r, o);
    if (d == null) miss.push((o.id || o.type) + '@' + o.x + ',' + o.y + (o.event ? ':' + o.event : ''));
  }
  for (const n of m.npcs || []) {
    if (n.cond != null && !R.State.check(n.cond)) continue;
    if (opts.skip && opts.skip(n)) continue;
    if (reachObj(r, { x: n.x, y: n.y, lv: n.lv || 0 }) == null) miss.push('npc:' + n.id);
  }
  ok(`${label}: 物と人にすべて届く`, miss.length === 0, miss);
  return { r, m };
}
function exitDist(res, mapId, spawnTo) {
  const e = (res.m.exits || []).find((q) => q.to.map === mapId && (!spawnTo || q.to.spawn === spawnTo));
  if (!e) return null;
  let best = null;
  for (let j = 0; j < (e.h || 1); j++) for (let i = 0; i < (e.w || 1); i++) { const d = res.r.get(e.x + i, e.y + j, 0); if (d != null && (best == null || d < best)) best = d; }
  return best;
}
const far = (res) => Math.max(...res.r.dist.values());

// フェルン
let res = reachAll('fern', 'gate_s', {}, 'fern（南の門から）');
ok('fern: 北の門（迷いの森）に届く', exitDist(res, 'verda_1') != null);
ok('fern: 樹上の足場（lv 1）に上れる', [...res.r.dist.keys()].some((k) => k.endsWith(',1')));
for (const id of ['fern_inn', 'fern_shop', 'fern_rita', 'fern_search', 'fern_gord', 'fern_pim_home', 'yura_inn', 'hut']) reachAll(id, 'door', {}, id);
reachAll('yura', 'gate', {}, 'yura');

// 迷いの森 1 階（森が道を変える間 → 変わらなくなった後）
const V1_SKIP = (o) => o.id === 'verda_1_c6';
res = reachAll('verda_1', 'south', {}, 'verda_1（歌の石 0）', { skip: V1_SKIP });
const d1a = exitDist(res, 'verda_2');
ok(`verda_1: 入口 → 2 階の出口 80〜140 歩（森が変わる間 ${d1a}）`, d1a >= 80 && d1a <= 140);
ok(`verda_1: いちばん遠いマス 200 歩以下（${far(res)}）`, far(res) <= 200);
res = reachAll('verda_1', 'south', { vars: { forest_verses: 3 } }, 'verda_1（歌の石 3）', { skip: V1_SKIP });
console.log(`info  verda_1: 入口 → 2 階の出口（石 3 つの後）${exitDist(res, 'verda_2')} 歩`);
// 迷いの森 2 階
const V2_SKIP = (o) => o.id === 'hans' || (o.x >= 48 && o.y >= 42);
res = reachAll('verda_2', 'south', {}, 'verda_2（石 0・倒木あり）', { skip: V2_SKIP });
ok('verda_2: つるの壁の先（千年樹）には石 3 つまで届かない', exitDist(res, 'elder_1') == null);
res = reachAll('verda_2', 'south', { vars: { forest_verses: 3 }, flags: { forest_log_cut: true } }, 'verda_2（石 3・倒木を払った）');
const d2 = exitDist(res, 'elder_1');
ok(`verda_2: 入口 → 千年樹 80〜140 歩（${d2}）`, d2 >= 80 && d2 <= 140);
ok(`verda_2: いちばん遠いマス 200 歩以下（${far(res)}）`, far(res) <= 200);
const withFawn = reachAll('verda_2', 'south', { vars: { forest_verses: 3 }, flags: { forest_log_cut: true }, choices: { ch_forest_fawn: 'heal' } }, 'verda_2（小鹿の獣道）');
ok(`verda_2: 小鹿の獣道で千年樹が近くなる（${exitDist(withFawn, 'elder_1')} < ${d2}）`, exitDist(withFawn, 'elder_1') < d2);
// 千年樹
res = reachAll('elder_1', 'south', {}, 'elder_1');
const stairs1 = R.DB.maps.elder_1.objects.find((o) => o.type === 'stairs');
const dS = res.r.get(stairs1.x, stairs1.y, 0);
ok(`elder_1: 入口 → 根の間への穴 80〜140 歩（${dS}）`, dS >= 80 && dS <= 140);
ok(`elder_1: いちばん遠いマス 200 歩以下（${far(res)}）`, far(res) <= 200);
res = reachAll('elder_1', 'south', { flags: { forest_sw1: true } }, 'elder_1（ピムの抜け穴）');
ok(`elder_1: ピムの抜け穴で近くなる（${res.r.get(stairs1.x, stairs1.y, 0)} < ${dS}）`, res.r.get(stairs1.x, stairs1.y, 0) < dS);
res = reachAll('elder_2', 'top', {}, 'elder_2');
const boss = R.DB.maps.elder_2.triggers.find((t) => t.id === 'boss');
const dB = Math.min(...[...Array(boss.w).keys()].map((i) => res.r.get(boss.x + i, boss.y, 0)).filter((d) => d != null));
ok(`elder_2: 降り口 → 根食らい（${dB} 歩）`, dB > 30 && dB <= 140);
const rings = R.DB.maps.elder_2.objects.find((o) => o.event === 'elder_rings');
ok('elder_2: 伸びない年輪（必の読み物）が本筋の道の上', reachObj(res.r, rings) != null && reachObj(res.r, rings) < dB);
res = reachAll('elder_2', 'top', { flags: { forest_sw2: true } }, 'elder_2（ピムの抜け穴）');
// 必須の物が隠し通路の先に無い（隠し通路のマスを壁にして、本筋の物に届く）
section('必須の物が隠し通路・寄り道の先に無い');
for (const id of ['verda_1', 'verda_2', 'elder_1', 'elder_2']) {
  const m = R.DB.maps[id];
  const saved = m.legend;
  m.legend = Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, v.secret ? Object.assign({}, v, { secret: false }) : v]));
  R.MapUtil.invalidate(id);
  state(R, { vars: { forest_verses: 3 }, flags: { forest_log_cut: true, forest_moth: true } });
  const sp = R.MapUtil.spawn(m, Object.keys(m.spawns)[0]);
  const r = reach(R, m, sp);
  const must = (m.objects || []).filter((o) => /stone_|verda_axe|verda_flute|verda_log|verda_hollow|elder_rings|elder_1_down|verda_moss/.test(o.event || o.id || '') || o.type === 'stairs');
  const cut = must.filter((o) => reachObj(r, o) == null).map((o) => o.event || o.id);
  ok(`${id}: 本筋の物は隠し通路なしで届く`, cut.length === 0, cut);
  const nm = (m.npcs || []).filter((n) => ['ben', 'pim', 'roy', 'hans'].includes(n.id) && reachObj(r, n) == null).map((n) => n.id);
  ok(`${id}: 探す人は隠し通路なしで届く`, nm.length === 0, nm);
  const exits = (m.exits || []).filter((e) => e.to.map !== id && !((m.exits || []).some((q) => q === e && q.cond)));
  const ex = exits.filter((e) => { let d = null; for (let i = 0; i < e.w; i++) d = d != null ? d : r.get(e.x + i, e.y, 0); return d == null; });
  ok(`${id}: 出口は隠し通路なしで届く`, ex.length === 0, ex.map((e) => e.to.map));
  m.legend = saved;
  R.MapUtil.invalidate(id);
}

// ================================================================ 5. 話す見返り（WORLD §3.3、V2_PLAN §3.3）
section('話す見返りのある人');
function rewardCount(maps) {
  const ppl = [];
  for (const id of maps) for (const n of (R.DB.maps[id].npcs || [])) ppl.push(n);
  const rew = ppl.filter((n) => n.reward);
  const kinds = new Set(rew.map((n) => n.reward));
  const air = ppl.filter((n) => !n.reward && !/keeper|seller|peddler|innkeeper/.test(n.id));
  return { n: rew.length, kinds: kinds.size, air: air.length, list: [...kinds] };
}
const fernR = rewardCount(['fern', 'fern_inn', 'fern_shop', 'fern_rita', 'fern_search', 'fern_gord', 'fern_pim_home']);
ok(`フェルン: 見返りのある人 8 人以上（${fernR.n}）`, fernR.n >= 8);
ok(`フェルン: 見返りの種類 4 種以上（${fernR.kinds}: ${fernR.list.join(' ')}）`, fernR.kinds >= 4);
ok(`フェルン: 空気だけの人 4 人まで（${fernR.air}）`, fernR.air <= 4);
const yuraR = rewardCount(['yura', 'yura_inn']);
ok(`ユラ: 見返りのある人 6 人以上（${yuraR.n}）`, yuraR.n >= 6);
ok(`ユラ: 見返りの種類 4 種以上（${yuraR.kinds}: ${yuraR.list.join(' ')}）`, yuraR.kinds >= 4);
ok(`ユラ: 空気だけの人 4 人まで（${yuraR.air}）`, yuraR.air <= 4);
// 町の飾りの密度（STYLE_REFERENCE §6.2・§9: 1 画面（ふつう 30×17 マス）に 25〜40）と、通りの中央の空き
for (const id of ['fern', 'yura']) {
  state(R, {});
  const m = R.DB.maps[id];
  const cnt = [];
  for (let y0 = 0; y0 + 17 <= m.h; y0 += 4) for (let x0 = 0; x0 + 30 <= m.w; x0 += 5) {
    let n = 0;
    for (const o of m.objects) if (o.x != null && (!o.cond || R.State.check(o.cond)) && ['prop', 'chest', 'sign', 'building', 'waylamp', 'brazier'].includes(o.type) && o.x >= x0 && o.x < x0 + 30 && o.y >= y0 && o.y < y0 + 17) n++;
    cnt.push(n);
  }
  cnt.sort((a, b) => a - b);
  const med = cnt[cnt.length >> 1];
  ok(`${id}: 1 画面の飾り 中央値 25〜40（最小 ${cnt[0]}・中央 ${med}・最大 ${cnt[cnt.length - 1]}）`, med >= 25 && med <= 40 && cnt[0] >= 15);
}
{
  const m = R.DB.maps.fern;
  const onRoad = m.objects.filter((o) => o.type === 'prop' && (o.lv || 0) === 0 && (R.DB.props[o.id] || {}).solid && (o.x === 29 || o.x === 30) && [...R.MapUtil.grid(m)[o.y]][o.x] === 'r');
  ok('fern: 大通り（2 マス）の真ん中に硬い物を置かない', onRoad.length === 0, onRoad.map((o) => o.id + '@' + o.x + ',' + o.y));
}
ok('新しい話の印（npc.key）が talk のある人すべてに', MY_MAPS.every((id) => (R.DB.maps[id].npcs || []).every((n) => !n.talk || n.key)));

// ================================================================ 6. 筋を通す（node の ev の見本で、2 本の道を最後まで）
section('筋（2 本の道）');
const SAID = [];
function mockEv(script) {
  const G = () => R.Game;
  const ev = {
    ctx: {},
    async say(who, text, o) { SAID.push({ who, text, o: o || {} }); },
    async choose(labels, o) { const a = script.choose.shift(); SAID.push({ who: 'choose', text: labels.join('／'), o: o || {} }); return a == null ? 0 : a; },
    async caption(text) { SAID.push({ who: 'caption', text }); },
    async fade() {}, async wait() {},
    flag: (id) => !!G().flags[id], setFlag: (id, v) => { G().flags[id] = v === undefined ? true : v; },
    var: (n) => G().vars[n] || 0, addVar: (n, k) => (G().vars[n] = (G().vars[n] || 0) + (k == null ? 1 : k)),
    item: (id, n) => R.State.gain(id, n == null ? 1 : n), take: (id, n) => R.State.take(id, n == null ? 1 : n),
    gold: (n) => { G().gold = Math.max(0, (G().gold || 0) + n); return G().gold; }, has: (id) => R.State.owned(id) > 0,
    async battle(s) { script.battles.push(typeof s === 'string' ? s : (s.troop || JSON.stringify(s.mons))); return 'win'; },
    async warp(map, spawn) { script.warps.push(map + '.' + spawn); },
    heal() {}, rest() {}, async inn() { return true; }, async shop(id) { script.shops.push(id); }, async tavern() {}, async chooseCompanions() { return []; }, async createHero() {},
    lead: (id) => { G().leads[id] = G().leads[id] || { got: 0, pin: false, seen: false }; },
    leadDone: (id) => { if (G().leads[id]) G().leads[id].done = true; },
    choice: (k, v) => { G().choices[k] = v; }, choiceOf: (k) => G().choices[k],
    async clearRegion(rid) { G().cleared[rid] = true; G().flags['cleared_' + rid] = true; G().tier = (G().tier || 0) + 1; G().pendingTier = G().tier; },
    npc: () => ({ async move() {}, async face() {}, async act() {}, async hide() {}, async show() {}, async setPos() {} }),
    guest: (look) => { G().guest = look ? { id: look, look } : null; },
    async camera() {},
    mini: { async sequence() { return { score: 90, rank: 'A' }; }, async timing() { return { hits: 3, rank: 'A' }; } },
    async letter(id) { script.letters.push(id); },
    async call(id, args) { const e = R.DB.events[id]; return e ? e.run(ev, Object.assign({}, ev.ctx, args || {})) : undefined; },
    g: (m) => m, bgm() {}, sfx() {}, async jingle() {},
  };
  return ev;
}
async function run(id, script, ctx) {
  const e = R.DB.events[id];
  if (!e) { ok(`event ${id} がある`, false); return; }
  if (e.cond && !R.State.check(e.cond)) return;
  const ev = mockEv(script);
  ev.ctx = ctx || {};
  try { await e.run(ev, ev.ctx); } catch (err) { ok(`event ${id} が止まらない`, false, String(err && err.stack || err)); }
}
async function route(name, o) {
  state(R, { items: { i_salve: 3 } });
  R.Game.tier = 0;
  const S = { choose: [], battles: [], warps: [], shops: [], letters: [] };
  const ask = (...a) => S.choose.push(...a);
  await run('fern_arrival', S);
  await run('fern_board', S);
  await run('fern_gord', S, { npc: 'gord' });
  await run('fern_pim_mother', S);
  await run('fern_rita', S);
  ok(`${name}: 帽子の片方 k_pim_hat を受け取る`, R.State.owned('k_pim_hat') > 0);
  ok(`${name}: 手がかり 4 本（掲示板・ピム・樵・歌）`, ['l_forest_board', 'l_forest_pim', 'l_forest_woodcutters', 'l_forest_song'].every((k) => R.Game.leads[k]));
  const rescue = {
    hans: async () => { await run('verda_axe', S); ask(0); await run('verda_log', S); await run('verda_hans', S); },
    ben: async () => { await run('verda_ben', S); },
    roy: async () => { await run('verda_flute', S); ask(0); await run('verda_hollow', S); },
    pim: async () => { ask(o.pim === 'send' ? 0 : 1, o.fawn === 'heal' ? 0 : 1); await run('verda_pim', S); },
  };
  await run('verda_stone_a', S);
  await run('verda_stone_b', S);
  for (const who of o.order) await rescue[who]();
  await run('verda_moth', S);
  await run('verda_stone_c', S);
  ok(`${name}: 歌の石 3 つ`, R.Game.vars.forest_verses === 3);
  ok(`${name}: 4 人を見つけた順（${o.order.join('→')}）`, o.order.every((w, i) => R.Game.vars['forest_order_' + w] === i + 1));
  ok(`${name}: ピムの選択 ${o.pim}`, R.Game.choices.ch_forest_pim === o.pim);
  ok(`${name}: 小鹿の選択 ${o.fawn}`, R.Game.choices.ch_forest_fawn === o.fawn);
  if (o.pim === 'take') ok(`${name}: ピムがついてくる（E8）`, R.Game.guest && R.Game.guest.look === 'npc_pim');
  await run('elder_fine', S);
  await run('elder_rings', S);
  ask(o.write === 'pain' ? 0 : 1);
  await run('elder_boss', S);
  ok(`${name}: 森を解決（cleared.r_forest）`, R.Game.cleared.r_forest === true);
  ok(`${name}: ティア 1・pendingTier 1（T1 は次の宿か町で）`, R.Game.tier === 1 && R.Game.pendingTier === 1);
  ok(`${name}: ピムはもうついてこない`, !R.Game.guest);
  ok(`${name}: 年代記に書く選択 ${o.write}`, R.Game.choices.ch_forest_write === o.write);
  const last = o.order[o.order.length - 1];
  const uni = { hans: 'u_hans_axe', ben: 'u_ben_whistle', roy: 'u_roy_charm', pim: 'u_pim_cap' }[last];
  ok(`${name}: 最後に見つけた人（${last}）の一品物 ${uni}`, R.State.owned(uni) === 1 && ['u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap'].filter((u) => u !== uni).every((u) => !R.State.owned(u)));
  ok(`${name}: 伸びる一品物の個体（もらったティアの値）`, !!(R.Game.uniques && R.Game.uniques[uni]));
  ok(`${name}: 戦闘（狼・蛾・根食らい）`, ['tr_a21_forest_wolves', 'tr_b_moth', 'tr_b_rooteater'].every((t) => S.battles.includes(t)));
  ok(`${name}: 野営地 → フェルンの広場へ移る`, S.warps.includes('verda_1.camp') && S.warps.includes('fern.plaza'));
  await run('fern_hanna', S);
  ok(`${name}: ハンナの ac_tale_forest`, R.State.owned('ac_tale_forest') === 1);
  await run('fern_pim_after', S);
  ok(`${name}: ピムの語り部修行の始まり（q_pim_poet・詩の手紙）`, R.Game.leads.q_pim_poet && S.letters.includes('letter_forest_pim_poem'));
  ok(`${name}: 森の地方の手がかりが解決（pim・woodcutters・song）`, ['l_forest_pim', 'l_forest_woodcutters', 'l_forest_song'].every((k) => R.Game.leads[k].done));
  const txt = R.DB.chronicle.r_forest.text;
  ok(`${name}: 年代記の文が選択どおり`, txt.includes(o.pim === 'send' ? '幼い子を家へ帰し' : '幼い子とともに') && txt.includes(o.write === 'pain' ? '森を焼いた' : '森の主は火を封じ'));
  if (VERBOSE) console.log(txt);
  // 依頼
  ask(0); await run('fern_postmaster', S, { npc: 'postmaster' });
  for (const d of ['deck_1', 'deck_2', 'deck_3', 'deck_4', 'deck_5']) await run('fern_deck', S, { npc: d });
  await run('fern_postmaster', S);
  ok(`${name}: 手紙配り q_fern_letters が済む`, R.Game.flags.forest_letters_done && R.Game.leads.q_fern_letters.done);
  await run('fern_herbalist', S);
  for (const [map, k] of [['verda_1', 1], ['verda_1', 2], ['verda_1', 3], ['verda_2', 4], ['verda_2', 5]]) {
    const o2 = R.DB.maps[map].objects.find((q) => q.event === 'verda_herb' && q.herb === k);
    await run('verda_herb', S, { map, x: o2.x, y: o2.y });
  }
  await run('fern_herbalist', S);
  ok(`${name}: 薬草五種 q_fern_herbs が済む`, R.Game.flags.forest_herbs_done);
  for (let i = 0; i < 3; i++) { ask(i); await run('fern_song_game', S); }
  ok(`${name}: 歌あわせ 3 段`, R.Game.flags.forest_song_3);
  ask(0); await run('fern_lampkeeper', S);
  for (const n of [1, 2, 3]) {
    const wl = (R.DB.maps.world && R.DB.maps.world.objects || []).find((q) => q.id === 'wl_forest_' + n);
    if (wl) await run('forest_waylamp', S, { map: 'world', x: wl.x, y: wl.y });
  }
  await run('fern_lampkeeper', S);
  if (R.DB.maps.world) ok(`${name}: 蛍の灯籠 3 つ（ワールドの wl_forest_1〜3）`, R.Game.flags.forest_fireflies_done);
  await run('fern_acorn_boy', S);
  await run('verda_acorn', S);
  ok(`${name}: どんぐり王子`, R.Game.flags.forest_acorn_won);
  await run('yura_elder', S); await run('yura_miller', S); await run('fern_yura_miller', S);
  ok(`${name}: 名を忘れた人々の 1 人目（エダ）`, R.Game.flags.yura_miller_home && R.Game.flags.yura_miller_thanked);
  await run('hut_journal', S); await run('hut_notes', S); await run('verda_empty_hut', S);
  ok(`${name}: 記録官の帳面と手紙（lo_ev_forest・lo_lz_1）`, R.Game.flags.lo_ev_forest && R.Game.flags.lo_lz_1);
}
(async function main() {
  await route('R1', { pim: 'send', fawn: 'heal', order: ['hans', 'ben', 'roy', 'pim'], write: 'pain' });
  await route('R2', { pim: 'take', fawn: 'leave', order: ['pim', 'roy', 'ben', 'hans'], write: 'oath' });
  // どのイベントも走らせて止まらない（町の人・調べる物）
  state(R, {});
  const S = { choose: [], battles: [], warps: [], shops: [], letters: [] };
  for (const id of myEventIds) { S.choose.length = 0; await run(id, S, { npc: 'camp_hans', map: 'verda_1', x: 0, y: 0 }); }
  state(R, { cleared: { r_forest: true }, flags: { forest_finale_done: true, forest_found_hans: true, forest_found_ben: true, forest_found_roy: true, forest_found_pim: true, forest_boss: true } });
  for (const id of myEventIds) { S.choose.length = 0; await run(id, S, { npc: 'deck_1', map: 'fern', x: 0, y: 0 }); }

  // ================================================================ 7. 文とボイス
  section('文の検査');
  const lines = [];
  for (const s of SAID) for (const t of [].concat(s.text)) lines.push({ who: s.who, t: String(t) });
  const wide = (s) => [...s].reduce((a, c) => a + (/[ -~]/.test(c) ? 0.5 : 1), 0);
  const long = lines.filter((l) => l.who !== 'choose' && l.t.split('\n').some((r) => wide(r.replace(/\{hero\}/g, 'ＸＸＸＸＸ')) > 18));
  ok(`1 行 全角 18 字まで（${long.length} 件）`, long.length === 0, long.slice(0, 6).map((l) => l.t));
  const tall = lines.filter((l) => l.who !== 'caption' && l.who !== 'choose' && l.t.split('\n').length > 3);
  ok('窓 1 枚 3 行まで', tall.length === 0, tall.slice(0, 4).map((l) => l.t));
  const COMP = Object.values(R.DB.companions).map((c) => c.name).filter(Boolean);
  const compHit = lines.filter((l) => COMP.some((n) => l.t.includes(n)));
  ok('仲間の名前が森の話に出ない（A36）', compHit.length === 0, compHit.slice(0, 4).map((l) => l.t));
  const allText = lines.map((l) => l.t).join('\n') + JSON.stringify(myLeads.map((k) => R.DB.leads[k]));
  ok('「オート」の字を使わない', !/オート(?!セーブ)/.test(allText));
  ok('Lv・経験値の字を使わない', !/Lv|レベル|経験値/.test(allText));
  const NPC_NAMES = ['ハンナ', 'リタ', 'ゴード', 'カトリ', 'ピム', 'ハンス', 'ベン', 'ロイ', 'ニナ', 'オルト', 'エダ'];
  ok('町の人の名前が仲間の名前と重ならない', NPC_NAMES.every((n) => !COMP.includes(n)), NPC_NAMES.filter((n) => COMP.includes(n)));
  section('ボイス');
  const csv = fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8').split('\n');
  const VOICE = {};
  for (const row of csv) { const c = row.split(','); if (/^v_/.test(c[0])) VOICE[c[0]] = c[7]; }
  const want = ['v_fine_forest_01', 'v_elm_forest_01', 'v_elm_forest_02', 'v_elm_forest_03', 'v_elm_forest_04', 'v_elm_forest_05', 'v_elm_forest_06'];
  const used = {};
  for (const s of SAID) if (s.o && s.o.voice) [].concat(s.o.voice).forEach((v, i) => { used[v] = Array.isArray(s.o.voice) ? [].concat(s.text)[i] : [].concat(s.text).join(''); });
  for (const v of want) {
    ok(`${v} を使う`, used[v] != null);
    if (used[v] != null) ok(`${v} の文面が script.csv と同じ（改行を除く）`, used[v].replace(/\n/g, '') === VOICE[v], [used[v].replace(/\n/g, ''), VOICE[v]]);
    ok(`${v} の音声ファイルがある`, fs.existsSync(path.join(CHRON, 'assets', 'voice', v + '.ogg')) || fs.existsSync(path.join(CHRON, 'assets', 'voice', v + '.mp3')));
  }
  // 2026-09-27: 物語のボイス（design/voice_story_map.json の story）も使う
  const STORY_V = Object.entries(JSON.parse(fs.readFileSync(path.join(CHRON, 'v2', 'design', 'voice_story_map.json'), 'utf8')).lines).filter(([, l]) => l.kind === 'story').map(([k]) => k);
  ok('森のボイスは 7 本と物語のボイスだけ（縦切り 22 本のうち）', Object.keys(used).every((v) => want.includes(v) || STORY_V.includes(v)), Object.keys(used));

  // ================================================================ 8. meta の needs/gives の形
  section('meta');
  const KINDS = /^(flag|var|item|lead|region|choice):/;
  for (const id of myEventIds) {
    const m = (R.DB.events[id] || {}).meta || {};
    const bad = [].concat(m.needs || [], m.gives || []).filter((s) => !KINDS.test(s));
    ok(`${id}: meta の書き方`, bad.length === 0, bad);
  }
  done('CONTENT-F');
})();
