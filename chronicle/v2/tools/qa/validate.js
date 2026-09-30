#!/usr/bin/env node
// QA: データの検査（V2_PLAN §3.16 の 3「validate」、§2.4 の id の付け方、§2.6.1 の置き場所、STATS_REWORK §7.6・§10.1）。node だけ。
//
//   node v2/tools/qa/validate.js [--verbose]
//
// 1. 形: R.Contract.check を全データに（map・event・lead・item・monster・troop・shop・letter・lore・location）と checkAll。
// 2. 参照: 店・宝箱・ドロップ・編成・出現表・イベント（meta と本文の ev.* の id）・手がかり・場所・マップの行き先と spawn・素材・物・見た目・BGM・戦闘背景。
// 3. id の付け方（§2.4）: イベント・旗・変数・選択・手がかり・依頼・編成・出現表・一品物・盗み専用・品の接頭辞。
// 4. 数: 縦切りのマップ 28 枚（§3.2）・手がかり 約 28・店 5・技 99・術 約 77・盗み専用 30〜40。
// 5. 文の長さ: 手がかり 3 行 × 22 字・品の説明 3 行 × 20 字・品の名前 12 字・手紙の 1 行 20 字。
// 6. 置き場所（§2.6.1）: ワールドに宝箱・隠し通路なし、隠し通路はダンジョンだけ、宝箱は床の上で重なる物の下でない、泉は床の上の 2×2、物はマップの中。
// 7. ドロップの枠（STATS_REWORK §10.1）: 通常の魔物は normal を持つ、rare は系統の最後の段だけ（約 25%）、super は 5 段の系統の最後など（約 9%）。
// 8. 盗み専用（STATS_REWORK §7.6・V2_PLAN §2.6.6）: 30〜40 品、grade super・src steal・quirk なし、1 品 1 体、ほかの枠・表・店・宝箱に無い、率 通常 32・レア 16・ボス 16。
'use strict';
const fs = require('fs');
const { inline: i18nInline } = require('../lib/i18n_src');   // R.T('key') を日本語の文に戻して文面を確かめる（i18n）
const path = require('path');
const { ok, section, done } = require('../lib/testkit');

const VERBOSE = process.argv.includes('--verbose');
const R = require('../lib/load')({ quiet: true });
const M = require('../lib/maps').create(R);
const V2 = path.resolve(__dirname, '..', '..');
const D = R.DB;
const list = (a, n) => (a.length > (n || 8) ? a.slice(0, n || 8).concat([`… ${a.length} in all`]) : a);
const SLICE_MAPS = ['roa', 'roa_house', 'world', 'pharos', 'pharos_inn', 'pharos_tavern', 'pharos_shop', 'pharos_smith', 'pharos_record', 'pharos_shipyard',
  'lighthouse_1', 'lighthouse_2', 'lighthouse_3', 'fern', 'fern_inn', 'fern_shop', 'fern_rita', 'fern_search', 'fern_gord', 'fern_pim_home',
  'verda_1', 'verda_2', 'elder_1', 'elder_2', 'yura', 'yura_inn', 'hut', 'well'];
const SLICE_BGM = ['title', 'home', 'town', 'tavern', 'overworld', 'tower', 'battle', 'boss', 'boss2', 'rarebattle', 'village', 'forest', 'shrine', 'cave', 'sorrow', 'legend', 'tension', 'lostwood', 'eldertree', 'dawn', 'omen', 'fine_theme'];
const BBG = ['coast', 'tower', 'forest', 'tree', 'cave'];
// 縦切りの後に作った地方（slice の錠が外れた地方）の BGM・背景
SLICE_BGM.push('ice', 'ghost', 'yule', 'bonfire', 'siege'); BBG.push('snow');
SLICE_BGM.push('kasim', 'desert', 'caravan', 'pyramid'); BBG.push('desert');   // 砂漠（desert_*.js）
BBG.push('marsh');   // 湿原（marsh_*.js。BGM は縦切りの town・ghost）
BBG.push('ash');   // 灰の荒野（ash_*.js。BGM は縦切りの town・cave・battle・boss）
BBG.push('isles');   // マレア諸島（isles_*.js。BGM は縦切りの town・village・cave・ghost・overworld）
BBG.push('mine');   // ガルド山地（mine_*.js・field_mine_*.js。BGM は縦切りの town・cave・overworld・tavern）
BBG.push('star');   // オルビス高原（star_*.js・field_star_*.js。BGM は縦切りの town・tension・tower・omen・overworld）
SLICE_BGM.push('lastdungeon', 'hollowking'); BBG.push('library');   // 終盤（final_*.js。ビブリア島と白の大書庫。BGM はほかに縦切りの sorrow・dawn・tension）
const maps = M.sliceMaps();
const EV_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'events')).map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));

// ================================================================ 1. 形
section('1. 形（R.Contract.check）');
{
  const all = R.Contract.checkAll();
  ok('R.Contract.checkAll', all.ok, all.errors);
  const kinds = [['map', maps.map((id) => D.maps[id])], ['event', Object.values(D.events)], ['lead', Object.values(D.leads)], ['item', Object.values(D.items)],
    ['monster', Object.values(D.monsters)], ['troop', Object.values(D.troops)], ['shop', Object.values(D.shops)], ['letter', Object.values(D.letters)],
    ['lore', Object.values(D.lore || {})], ['location', Object.values(D.locations)]];
  const keys = Object.keys(D);
  for (const [kind, arr] of kinds) {
    const bad = [];
    const ids = Object.keys(D[{ map: 'maps', event: 'events', lead: 'leads', item: 'items', monster: 'monsters', troop: 'troops', shop: 'shops', letter: 'letters', lore: 'lore', location: 'locations' }[kind]] || {});
    arr.forEach((o, i) => { if (/^stub_/.test(kind === 'map' ? maps[i] : ids[i])) return; let r; try { r = R.Contract.check(kind, o); } catch (e) { r = { ok: false, errors: [String(e)] }; } if (!r.ok) bad.push((kind === 'map' ? maps[i] : ids[i]) + ': ' + r.errors.slice(0, 2).join('; ')); });
    ok(`${kind}: ${arr.length} 件が K.${kind}`, bad.length === 0, list(bad));
  }
  void keys;
  ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
}

// ================================================================ 2. 参照
section('2. 参照');
const item = (id) => !!D.items[id];
const pool = (id) => !!(D.pools && D.pools[id]);
{
  const bad = [];
  for (const [sid, s] of Object.entries(D.shops)) {
    for (const id of s.items || []) if (!item(id)) bad.push(`${sid}: ${id}`);
    for (const [t, arr] of Object.entries(s.tier || {})) for (const id of arr) if (!item(id)) bad.push(`${sid} T${t}: ${id}`);
  }
  ok('店の品がすべて R.DB.items にある', bad.length === 0, list(bad));
  const want = ['shop_pharos_items', 'shop_pharos_arms', 'shop_fern_items', 'shop_fern_peddler', 'shop_yura'];
  ok('店 5 つ（§3.7）', want.every((s) => D.shops[s]), want.filter((s) => !D.shops[s]));
}
{
  const bad = [];
  const walk = (p, where) => {
    if (!p) return;
    if (Array.isArray(p)) { p.forEach((x) => walk(x, where)); return; }
    if (typeof p !== 'object') return;
    if (p.item && !item(p.item)) bad.push(`${where}: ${p.item}`);
    if (p.pool && !pool(p.pool)) bad.push(`${where}: pool ${p.pool}`);
    for (const k of Object.keys(p)) if (typeof p[k] === 'object') walk(p[k], where);
  };
  for (const [pid, p] of Object.entries(D.pools || {})) walk(p, 'pool ' + pid);
  ok('宝箱の表（pools）の品がある', bad.length === 0, list(bad));
  const bad2 = [];
  for (const [mid, m] of Object.entries(D.monsters)) for (const [k, d] of Object.entries(m.drops || {})) {
    if (d.item && !item(d.item)) bad2.push(`${mid}.${k}: ${d.item}`);
    if (d.pool && !pool(d.pool)) bad2.push(`${mid}.${k}: pool ${d.pool}`);
  }
  ok('魔物のドロップの品・表がある', bad2.length === 0, list(bad2));
}
{
  const bad = [];
  const mon = (id) => !!D.monsters[id] || (/^@/.test(id) && !!D.lineages[id.slice(1)]);   // '@<系統>' は R.Mon.resolve が段を選ぶ
  for (const [tid, t] of Object.entries(D.troops)) for (const [m] of t.mons || []) if (!mon(m)) bad.push(`${tid}: ${m}`);
  for (const [zid, z] of Object.entries(D.encounters)) for (const g of z.groups || []) for (const [m] of g.mons || []) if (!mon(m)) bad.push(`${zid}: ${m}`);
  for (const [zid, r] of Object.entries(D.rareEncounters || {})) for (const x of [].concat(r)) if (x && x.mon && !D.monsters[x.mon]) bad.push(`rare ${zid}: ${x.mon}`);
  ok('編成・出現表の魔物がある', bad.length === 0, list(bad));
}
{
  const bad = [];
  for (const id of maps) {
    const m = D.maps[id];
    for (const [ch, l] of Object.entries(m.legend || {})) if (D.materials && !D.materials[l.mat]) bad.push(`${id} legend '${ch}': material ${l.mat}`);
    if (m.outside && D.materials && !D.materials[m.outside]) bad.push(`${id} outside: ${m.outside}`);
    for (const o of m.objects || []) {
      if (o.type === 'prop' && !D.props[o.id]) bad.push(`${id} prop ${o.id}`);
      if (o.event && !D.events[o.event]) bad.push(`${id} ${o.type} event ${o.event}`);
      if (o.type === 'chest') { if (o.item && !item(o.item)) bad.push(`${id} chest ${o.id} item ${o.item}`); if (o.pool && !pool(o.pool)) bad.push(`${id} chest ${o.id} pool ${o.pool}`); }
      if (o.x != null && (o.x < 0 || o.y < 0 || o.x >= m.w || o.y >= m.h)) bad.push(`${id} ${o.type} ${o.id || ''} outside the map ${o.x},${o.y}`);
    }
    for (const n of m.npcs || []) {
      if (!D.looks[n.look]) bad.push(`${id} npc ${n.id}: look ${n.look}`);
      const t = typeof n.talk === 'string' ? n.talk : n.talk && n.talk.event;
      if (t && !D.events[t]) bad.push(`${id} npc ${n.id}: event ${t}`);
      if (n.x != null && (n.x < 0 || n.y < 0 || n.x >= m.w || n.y >= m.h)) bad.push(`${id} npc ${n.id} outside the map`);
    }
    for (const t of m.triggers || []) if (!D.events[t.event]) bad.push(`${id} trigger ${t.id}: event ${t.event}`);
    for (const p of M.portals(m, { all: true })) {
      const t = D.maps[p.to.map];
      if (!t) bad.push(`${id} ${p.kind} → map ${p.to.map}`);
      else if (typeof p.to.spawn === 'string' && !(t.spawns || {})[p.to.spawn]) bad.push(`${id} ${p.kind} → ${p.to.map} spawn ${p.to.spawn}`);
    }
    for (const z of m.zones || []) if (!D.encounters[z.zone]) bad.push(`${id} zone ${z.zone}`);
    if (m.bgm && !SLICE_BGM.includes(m.bgm)) bad.push(`${id} bgm ${m.bgm} is not a slice BGM (§3.10)`);
    if (m.bbg && !BBG.includes(m.bbg)) bad.push(`${id} bbg ${m.bbg}`);
    if (m.location && !D.locations[m.location]) bad.push(`${id} location ${m.location}`);
  }
  ok(`縦切りのマップ ${maps.length} 枚の参照（素材・物・見た目・イベント・行き先・出現表・BGM・背景）`, bad.length === 0, list(bad, 12));
}
{
  const bad = [];
  for (const [lid, l] of Object.entries(D.locations)) {
    const m = D.maps[l.map];
    if (!m) bad.push(`${lid}: map ${l.map}`); else if (!(m.spawns || {})[l.spawn]) bad.push(`${lid}: spawn ${l.spawn}`);
    if (!D.regions[l.region]) bad.push(`${lid}: region ${l.region}`);
  }
  for (const [lid, l] of Object.entries(D.leads)) {
    if (!D.regions[l.region]) bad.push(`lead ${lid}: region ${l.region}`);
    if (l.place && !D.locations[l.place] && !D.maps[l.place]) bad.push(`lead ${lid}: place ${l.place}`);
  }
  for (const [rid, r] of Object.entries(D.regions)) {
    if (r.slice === 'locked') continue;
    if (r.town && !D.locations[r.town]) bad.push(`region ${rid}: town ${r.town}`);
    for (const d of r.dungeons || []) if (!D.locations[d]) bad.push(`region ${rid}: dungeon ${d}`);
    if (r.bossTroop && !D.troops[r.bossTroop]) bad.push(`region ${rid}: troop ${r.bossTroop}`);
    if (r.page && !item(r.page)) bad.push(`region ${rid}: page ${r.page}`);
  }
  ok('場所・手がかり・地方の参照', bad.length === 0, list(bad));
}
{
  // イベント: meta.gives の品と手がかり、本文の ev.*('id')
  const bad = [];
  for (const [eid, e] of Object.entries(D.events)) {
    for (const g of (e.meta && e.meta.gives) || []) {
      const [k, v] = g.split(':');
      if (k === 'item') for (const it of v.split('|')) if (!item(it)) bad.push(`${eid} gives item ${it}`);
      if (k === 'lead' && !D.leads[v]) bad.push(`${eid} gives lead ${v}`);
    }
    for (const c of (e.meta && e.meta.calls) || []) if (!D.events[c]) bad.push(`${eid} calls ${c}`);
  }
  const grab = (re, kind, has) => { for (const m of EV_SRC.matchAll(re)) if (!has(m[1])) bad.push(`src ${kind} '${m[1]}'`); };
  grab(/ev\.lead\('([\w]+)'\)/g, 'ev.lead', (id) => !!D.leads[id]);
  grab(/ev\.leadDone\('([\w]+)'\)/g, 'ev.leadDone', (id) => !!D.leads[id]);
  grab(/ev\.letter\('([\w]+)'\)/g, 'ev.letter', (id) => !!D.letters[id]);
  grab(/ev\.shop\('([\w]+)'\)/g, 'ev.shop', (id) => !!D.shops[id]);
  grab(/ev\.battle\('([\w]+)'/g, 'ev.battle', (id) => !!D.troops[id]);
  grab(/ev\.call\('([\w]+)'\)/g, 'ev.call', (id) => !!D.events[id]);
  grab(/ev\.(?:item|take)\('([\w]+)'/g, 'ev.item', (id) => item(id));
  grab(/give\(ev, '([\w]+)'/g, 'give', (id) => item(id));
  grab(/ev\.warp\('([\w]+)'/g, 'ev.warp', (id) => !!D.maps[id]);
  grab(/troop: '([\w]+)'/g, 'troop', (id) => !!D.troops[id]);
  ok('イベントの参照（meta と本文の ev.lead・letter・shop・battle・call・item・warp）', bad.length === 0, list(bad, 12));
}

// ================================================================ 3. id の付け方
section('3. id の付け方（§2.4）');
{
  const shorts = new Set(Object.values(D.regions).map((r) => r.short).concat(['prologue', 'forest', 'story', 'world', 'tier']));
  const places = new Set(Object.keys(D.maps).concat(Object.keys(D.locations), ['windhill', 'twin']));   // §3.2 の「あとで」の場所（ワールドの出来事・双子の塔）
  const pre = (id) => { const parts = id.split('_'); for (let i = parts.length - 1; i >= 1; i--) { const p = parts.slice(0, i).join('_'); if (places.has(p) || shorts.has(p)) return p; } return null; };
  const evBad = Object.keys(D.events).filter((id) => !/^(stub_|core_|field_|t_)/.test(id) && !pre(id) && !/^(q_|lo_|optional_)/.test(id));
  ok('イベント <マップか地方>_<名>', evBad.length === 0, list(evBad));
  // 旗・変数（meta.gives と本文の setFlag／addVar）
  const flags = new Set(), vars = new Set(), choices = new Set();
  for (const e of Object.values(D.events)) for (const g of (e.meta && e.meta.gives) || []) {
    const [k, v] = g.split(':');
    if (k === 'flag') flags.add(v); if (k === 'var') vars.add(v.replace(/\+\d+$/, '')); if (k === 'choice') choices.add(v);
  }
  for (const m of EV_SRC.matchAll(/setFlag\('([\w]+)'/g)) flags.add(m[1]);
  for (const m of EV_SRC.matchAll(/addVar\('([\w]+)'/g)) vars.add(m[1]);
  for (const m of EV_SRC.matchAll(/ev\.choice\('([\w]+)'/g)) choices.add(m[1]);
  const GLOBAL = ['pain_count'];   // STORY_BIBLE §12.1 の地方をまたぐ数（state.js の R.State.pain が読む）
  const okFlag = (f) => pre(f) || /^(q_|lo_|tip_|cleared_|tr_|ev_|ch_)/.test(f) || GLOBAL.includes(f);
  ok(`旗 ${flags.size} 個が <rs か場所>_<名>`, [...flags].every(okFlag), [...flags].filter((f) => !okFlag(f)));
  ok(`変数 ${vars.size} 個が <rs か場所>_<名>`, [...vars].every(okFlag), [...vars].filter((f) => !okFlag(f)));
  ok(`選択 ${choices.size} 個が ch_<rs>_<名>`, [...choices].every((c) => /^ch_[a-z]+_\w+$/.test(c) && shorts.has(c.split('_')[1])), [...choices]);
  const leadBad = Object.entries(D.leads).filter(([id, l]) => !(l.kind === 'side' ? /^q_[a-z]+_\w+$/.test(id) : /^l_[a-z]+_\w+$/.test(id)));
  ok('手がかり l_<種類>_<名>・依頼 q_<町>_<名>', leadBad.length === 0, leadBad.map((x) => x[0]));
  ok('編成 tr_<名>（ボス tr_b_）', Object.keys(D.troops).every((id) => /^tr_/.test(id)), Object.keys(D.troops).filter((id) => !/^tr_/.test(id)));
  const bossTroopBad = Object.entries(D.troops).filter(([id, t]) => (t.mons || []).some(([m]) => ((D.monsters[m] || {}).flags || []).includes('boss') && /^b_/.test(m) && !/^b_root$/.test(m)) && !/^tr_(b_|a\d+_|boss|stub)/.test(id));
  ok('ボスの編成は tr_b_（今の tr_a21_* はそのまま）', bossTroopBad.length === 0, bossTroopBad.map((x) => x[0]));
  ok('出現表 z_<場所>・zw_<場所>', Object.keys(D.encounters).every((id) => /^zw?_/.test(id)), Object.keys(D.encounters).filter((id) => !/^zw?_/.test(id)));
  const PFX = /^(w_|sh_|hd_|bd_|hn_|ft_|ac_|i_|k_|u_)/;
  const itBad = Object.keys(D.items).filter((id) => !PFX.test(id) && !/^stub_/.test(id));
  ok(`品 ${Object.keys(D.items).length} の接頭辞（w_ sh_ hd_ bd_ hn_ ft_ ac_ i_ k_ u_）`, itBad.length === 0, list(itBad));
  const stBad = Object.entries(D.items).filter(([id, it]) => it.stealOnly && !/^(w_\w+?_|sh_|hd_|bd_|hn_|ft_|ac_)st_/.test(id));
  ok('盗み専用 <枠>_st_<名>', stBad.length === 0, stBad.map((x) => x[0]));
  const uBad = ['u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap'].filter((id) => !item(id));
  ok('伸びる一品物 u_*（ハンス・ベン・ロイ・ピム）がある', uBad.length === 0, uBad);
  ok('地方 r_<rs>（縦切り r_forest・序章 prologue。ほかに world と終盤の finale）', !!D.regions.r_forest && !!D.regions.prologue && Object.keys(D.regions).every((id) => /^(r_[a-z]+|prologue|world|finale)$/.test(id)));
}

// ================================================================ 4. 数
section('4. 数');
{
  const miss = SLICE_MAPS.filter((id) => !D.maps[id]);
  ok(`§3.2 の必須のマップ 28 枚がそろう`, miss.length === 0, miss);
  const sliceLeads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_forest' || l.region === 'prologue' || l.region === 'world' || l.kind === 'rumor');
  // 縦切りの後に作った地方（regions の slice が外れ、森・序章・世界でない地方）の手がかりは数えない
  const builtR = (r) => r && D.regions[r] && (!D.regions[r].slice || !!(D.regions[r].dungeons || []).length) && !['r_forest', 'prologue', 'world'].includes(r);   // 錠を残したまま作った地方（諸島: dungeons がある）も作った地方
  const nLeads = Object.values(D.leads).filter((l) => !builtR(l.region) && !builtR(l.opens)).length;
  ok(`手がかり 約 28 件（${nLeads}）`, nLeads >= 24 && nLeads <= 40, nLeads);
  const want = ['l_main_rumors', 'l_main_recorder_forest', 'l_rumor_forest', 'l_rumor_snow', 'l_rumor_desert', 'l_rumor_marsh', 'l_rumor_isles', 'l_rumor_mine', 'l_rumor_ash', 'l_rumor_star',
    'l_forest_board', 'l_forest_pim', 'l_forest_woodcutters', 'l_forest_song', 'l_forest_hut', 'q_fern_letters', 'q_fern_herbs', 'q_fern_song', 'q_forest_fireflies', 'q_forest_acorn',
    'q_pharos_well', 'q_pharos_lamp', 'q_pharos_delivery', 'q_yura_names', 'q_pim_poet', 'l_opt_hut', 'l_opt_well', 'l_opt_yura'];
  ok('§3.5 の手がかりの id がそろう', want.every((id) => D.leads[id]), want.filter((id) => !D.leads[id]));
  const locked = ['l_rumor_snow', 'l_rumor_desert', 'l_rumor_marsh', 'l_rumor_isles', 'l_rumor_mine', 'l_rumor_ash', 'l_rumor_star'].filter((id) => D.leads[id] && D.leads[id].slice !== 'locked' && !builtR(D.leads[id].opens || ('r_' + id.slice(8))));
  ok('森以外の噂は slice:locked', locked.length === 0, locked);
  void sliceLeads;
  const nT = Object.keys(D.techs).filter((id) => !D.techs[id].derived).length, nS = Object.keys(D.spells).length;
  const nD = Object.keys(D.techs).length - nT;   // 派生技（レア。design/BACKLOG「派生技の閃き」）
  ok(`技 99（${nT}）＋派生技 20〜30（${nD}）・術 約 77（${nS}）`, nT === 99 && nD >= 20 && nD <= 30 && nS >= 70 && nS <= 85);
  const keys = ['k_lighthouse_key', 'k_chronicle', 'k_quill', 'k_bell', 'k_pim_hat', 'k_page_forest'];
  ok('§3.7 の大事な物', keys.every(item), keys.filter((k) => !item(k)));
  const uniq = ['ac_keeper_lantern', 'u_hans_axe', 'u_ben_whistle', 'u_roy_charm', 'u_pim_cap', 'ac_tale_forest', 'ac_st_rooteater', 'ft_st_jewel_hare'];
  ok('§3.7 の一品物・盗み専用', uniq.every(item), uniq.filter((k) => !item(k)));
  const bosses = ['tr_tutorial', 'tr_b_pageeater', 'tr_a21_forest_wolves', 'tr_b_moth', 'tr_b_rooteater'];
  ok('§3.6 の編成 5 つ', bosses.every((t) => D.troops[t]), bosses.filter((t) => !D.troops[t]));
  const zones = ['zw_prologue', 'zw_peninsula', 'z_lighthouse', 'zw_forest', 'zw_forest_road', 'z_verda', 'z_elder', 'z_well'];
  ok('§3.6 の出現表 8 つ', zones.every((z) => D.encounters[z]), zones.filter((z) => !D.encounters[z]));
  const noGrow = Object.entries(D.items).filter(([, it]) => it.use && (it.use.effects || []).some((e) => e.type === 'grow')).map((x) => x[0]);
  ok('効果 grow（実）を持つ品が無い（STATS_REWORK §10.2）', noGrow.length === 0, noGrow);
  const slotBad = Object.entries(D.items).filter(([, it]) => !['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc', 'use', 'key'].includes(it.slot)).map((x) => x[0]);
  ok('品の slot（9 種）', slotBad.length === 0, list(slotBad));
  // 持ち主「見習いの杖と祈りの杖、効果同じじゃねえかｗ」: 同じ系統・同じティアの通常品の武器で、攻撃力・術力・能力値・効果・値段・説明が
  // すべて同じ品を作らない（杖の 2 系列は 攻撃の術 magicPct と 回復の術 healPct で分けた。items_weapons.js）
  const wSig = (it) => JSON.stringify([it.wtype, it.tier, it.atk, it.mag, it.stats, it.mods || null, it.price, it.desc, it.crit || 0, it.hit || 0, it.kind || null, it.element || null, it.onHit || null, it.vs || null]);
  const wSeen = {}, wDup = [];
  for (const [id, it] of Object.entries(D.items)) {
    if (it.slot !== 'weapon' || it.grade !== 'normal') continue;
    const k = wSig(it);
    if (wSeen[k]) wDup.push(wSeen[k] + '=' + id); else wSeen[k] = id;
  }
  ok('通常品の武器: 同じ系統・ティアで中身が全く同じ品が無い', wDup.length === 0, list(wDup));
}

// ================================================================ 5. 文の長さ
section('5. 文の長さ');
{
  const W = (s) => [...String(s)].reduce((a, c) => a + (/[ -~]/.test(c) ? 0.5 : 1), 0);
  const lines = (s) => String(s || '').split('\n');
  const lb = Object.entries(D.leads).filter(([, l]) => lines(l.text).length > 3 || lines(l.text).some((x) => W(x) > 22) || W(l.title) > 14).map(([id]) => id);
  ok('手がかり: 本文 3 行 × 22 字・題 14 字まで', lb.length === 0, lb);
  const ib = Object.entries(D.items).filter(([, it]) => lines(it.desc).length > 3 || lines(it.desc).some((x) => W(x) > 20)).map(([id, it]) => id + ':' + JSON.stringify(it.desc));
  ok(`品の説明 3 行 × 20 字まで（${Object.keys(D.items).length} 品）`, ib.length === 0, list(ib));
  const nb = Object.entries(D.items).filter(([, it]) => W(it.name) > 12).map(([id, it]) => id + ':' + it.name);
  ok('品の名前 12 字まで', nb.length === 0, list(nb));
  const lt = [];
  for (const [id, l] of Object.entries(D.letters)) for (const p of [].concat(l.text)) if (lines(p).some((x) => W(x) > 20 && /\n/.test(p))) lt.push(id);
  ok('手紙の 1 行 20 字まで（改行のある頁）', lt.length === 0, lt);
}

// ================================================================ 6. 置き場所
section('6. 置き場所（§2.6.1）');
{
  const bad = [];
  for (const id of maps) {
    const m = D.maps[id];
    const secrets = Object.values(m.legend || {}).some((l) => l.secret) && R.MapUtil.grid(m).some((r) => [...r].some((c) => (m.legend[c] || {}).secret));
    const chests = (m.objects || []).filter((o) => o.type === 'chest');
    if (m.kind === 'world' && chests.length) bad.push(`${id}: chests on the world map (A27)`);
    if (secrets && m.kind !== 'dungeon') bad.push(`${id}: secret passage on a ${m.kind} map`);
    for (const c of chests) {
      const cell = R.MapUtil.cell(m, c.x, c.y);
      if (!cell || cell.walk === false || (cell.solid && !cell.secret)) bad.push(`${id}: chest ${c.id} not on a floor`);
      const over = (m.objects || []).filter((o) => o !== c && o.type === 'prop' && (D.props[o.id] || {}).overChars && Math.abs(o.x - c.x) <= 1 && o.y >= c.y && o.y - c.y <= 1 && (o.lv || 0) === (c.lv || 0));
      if (over.length) bad.push(`${id}: chest ${c.id} under ${over.map((o) => o.id).join(',')}`);
    }
    for (const s of (m.objects || []).filter((o) => o.type === 'spring')) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const c = R.MapUtil.cell(m, s.x + i, s.y + j); if (!c || c.walk === false || c.solid) bad.push(`${id}: spring ${s.id} cell ${s.x + i},${s.y + j} not floor`); }
    }
    const ids = new Set();
    for (const o of m.objects || []) if (o.id && ['chest', 'spring', 'brazier', 'waylamp', 'switch'].includes(o.type)) { if (ids.has(o.id)) bad.push(`${id}: duplicate ${o.type} id ${o.id}`); ids.add(o.id); }
    for (const [ch, l] of Object.entries(m.legend || {})) if (l.secret && !l.floor) bad.push(`${id}: secret '${ch}' has no floor material`);
  }
  ok('置き場所の決まり（ワールドに宝箱なし・隠し通路はダンジョン・宝箱は床の上で重なる物の下でない・泉は床の 2×2）', bad.length === 0, list(bad, 12));
}

// ================================================================ 7. ドロップの枠
section('7. ドロップの枠（STATS_REWORK §10.1）');
{
  const last = new Set(), last5 = new Set();
  const FIVE = ['jelly', 'bat', 'bee', 'plant', 'scorpion', 'mummy', 'wolf', 'frostling', 'ghost', 'skeleton', 'goblin', 'salamander', 'imp', 'eyeball'];
  for (const [lid, l] of Object.entries(D.lineages)) {
    const st = l.stages || [];
    if (!st.length) continue;
    const m = st[st.length - 1].mon;
    last.add(m);
    if (st.length >= 5 || FIVE.includes(lid) || /^(void|chaos|demon)$/.test(lid)) last5.add(m);
  }
  const normal = Object.entries(D.monsters).filter(([id, m]) => !((m.flags || []).includes('boss')) && !/^(rm_|b_|stub_)/.test(id));
  const noNormal = normal.filter(([, m]) => !(m.drops && m.drops.normal)).map((x) => x[0]);
  ok(`通常の魔物 ${normal.length} 体すべてが normal の枠を持つ`, noNormal.length === 0, list(noNormal));
  // 縦切りの 11 系統の段 1〜2（22 体）は例外でレア枠を持つ（オーナー 2026-09-27「レアがめっきり減ったねえ……。楽しみがちょっとないかも」）。
  // 割合（目安 25%）はそれを除いて数え、縦切りの 22 体は全部がレア枠を持つことを確かめる
  const DEMO = new Set(['jelly', 'rat', 'seabird', 'crab', 'bat', 'bee', 'mushroom', 'plant', 'fairy', 'wolf', 'treant'].flatMap((l) => [l + '_1', l + '_2']));
  const rareNotLast = normal.filter(([id, m]) => m.drops && m.drops.rare && !last.has(id) && !DEMO.has(id)).map((x) => x[0]);
  const rest = normal.filter(([id]) => !DEMO.has(id));
  const rareN = rest.filter(([, m]) => m.drops && m.drops.rare).length;
  const superN = normal.filter(([, m]) => m.drops && m.drops.super).length;
  ok(`rare の枠は系統の最後の段だけ（縦切りの 22 体を除き ${rareN} 体、${(100 * rareN / rest.length).toFixed(0)}%、目安 25%）`, rareNotLast.length === 0 && rareN / rest.length <= 0.32, list(rareNotLast));
  const demoNo = [...DEMO].filter((id) => D.monsters[id] && !(D.monsters[id].drops && D.monsters[id].drops.rare));
  const demoItems = [...DEMO].map((id) => D.monsters[id] && D.monsters[id].drops && D.monsters[id].drops.rare && D.monsters[id].drops.rare.item).filter(Boolean);
  // 2 回目（オーナー 2026-09-27「普通の雑魚は多くはレアっつっても消耗品でいいよ」）: 3 分の 2 以上が消耗品、装備は当たりの 5〜7 体。
  // 消耗品は重なってよい。装備のレアは 1 体 1 品
  const demoGear = demoItems.filter((id) => D.items[id] && D.items[id].slot !== 'use');
  ok(`縦切りの 22 体すべてがレア枠（消耗品 ${demoItems.length - demoGear.length}・装備 ${demoGear.length}、装備はみな違う）`,
    demoNo.length === 0 && demoItems.length - demoGear.length >= 15 && demoGear.length >= 5 && demoGear.length <= 7 && new Set(demoGear).size === demoGear.length, list(demoNo));
  const superBad = normal.filter(([id, m]) => m.drops && m.drops.super && !last5.has(id) && !/^(book_3|paper_4)$/.test(id)).map((x) => x[0]);
  ok(`super の枠は 5 段の系統の最後など（${superN} 体、${(100 * superN / normal.length).toFixed(0)}%、目安 9%）`, superBad.length === 0 && superN / normal.length <= 0.15, list(superBad));
}

// ================================================================ 8. 盗み専用
section('8. 盗み専用（STATS_REWORK §7.6、V2_PLAN §2.6.6）');
{
  const st = Object.entries(D.items).filter(([, it]) => it.stealOnly);
  // 36 ＋縦切りの 7（オーナー 2026-09-27「レアがめっきり減ったねえ……」）
  ok(`盗み専用 30〜45 品（${st.length}）`, st.length >= 30 && st.length <= 45);
  const form = st.filter(([, it]) => it.grade !== 'super' || it.src !== 'steal' || it.quirk).map((x) => x[0]);
  ok('grade super・src steal・quirk なし', form.length === 0, form);
  const owners = {};
  for (const [mid, m] of Object.entries(D.monsters)) { const s = m.drops && m.drops.steal; if (s) (owners[s.item] = owners[s.item] || []).push(mid); }
  const one = st.filter(([id]) => (owners[id] || []).length !== 1).map(([id]) => `${id}: ${(owners[id] || []).join(',') || 'none'}`);
  ok('1 品は 1 体の魔物の drops.steal だけ', one.length === 0, one);
  const ids = new Set(st.map((x) => x[0]));
  const leak = [];
  for (const [mid, m] of Object.entries(D.monsters)) for (const k of ['normal', 'rare', 'super', 'bonus']) { const d = m.drops && m.drops[k]; if (d && ids.has(d.item)) leak.push(`${mid}.${k}`); }
  const poolStr = JSON.stringify(D.pools || {}), shopStr = JSON.stringify(D.shops);
  for (const id of ids) { if (poolStr.includes('"' + id + '"')) leak.push('pools: ' + id); if (shopStr.includes('"' + id + '"')) leak.push('shops: ' + id); if (EV_SRC.includes("'" + id + "'")) leak.push('events: ' + id); }
  for (const mid of maps) for (const o of D.maps[mid].objects || []) if (o.type === 'chest' && ids.has(o.item)) leak.push(`chest ${mid}.${o.id}`);
  ok('ほかの枠・宝箱の表・店・宝箱・イベントの報酬に無い', leak.length === 0, leak);
  const rateBad = [];
  for (const [mid, m] of Object.entries(D.monsters)) {
    const s = m.drops && m.drops.steal;
    if (!s) continue;
    const kind = ((m.flags || []).includes('boss') || /^b_/.test(mid)) ? 'boss' : /^rm_/.test(mid) ? 'rare' : 'normal';
    const want = { boss: 16, rare: 16, normal: 32 }[kind];
    if (s.rate !== want) rateBad.push(`${mid} (${kind}) rate ${s.rate} ≠ ${want}`);
  }
  ok('率: 通常 32・レア 16・ボス 16（A31 ⑥・リードの決定 5）', rateBad.length === 0, rateBad);
  if (D.stealSources) {
    const ss = Object.entries(D.stealSources).filter(([id, s]) => !owners[id] || owners[id][0] !== s.mon);
    ok('R.DB.stealSources が魔物の drops.steal と同じ', ss.length === 0, ss.map((x) => x[0]));
  }
}
if (VERBOSE) console.log('maps', maps.join(' '));
done('validate');
