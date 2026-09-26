// BEAST の node のテスト（V2_PLAN §4.4 の BEAST の行のうち、焼かずに確かめられる物）。焼いた画素の検査は test_beast_browser.js。
//   node v2/tools/test_beast.js
'use strict';
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const BZ = R.Beast;

section('登録');
ok('R.Beast がある', !!BZ && typeof BZ.bakeSheet === 'function');
const keys = BZ.keyList();
const MUST = [].concat(
  ['jelly_1', 'jelly_2', 'rat_1', 'rat_2', 'seabird_1', 'seabird_2', 'crab_1', 'crab_2', 'bat_1', 'bat_2', 'bee_1', 'bee_2', 'mushroom_1', 'mushroom_2', 'plant_1', 'plant_2', 'fairy_1', 'fairy_2', 'wolf_1', 'wolf_2', 'treant_1', 'treant_2'].map((s) => 'hd:mon:' + s),
  ['rare_hare', 'rare_fawn', 'rare_acorn'].map((s) => 'hd:mon:' + s),
  ['boss_pageeater', 'boss_moth', 'boss_rooteater', 'boss_wolflord'].map((s) => 'hd:boss:' + s),
  ['hd:mon:b_root'],
  ['coast', 'tower', 'forest', 'tree', 'cave'].map((s) => 'hd:bbg:' + s));
const missing = MUST.filter((k) => !keys.includes(k));
ok(`V2_PLAN §4.1 の ${MUST.length} のキーを全部登録`, missing.length === 0, missing);
const notHd = keys.filter((k) => !R.Hd.has(k));
ok('R.Hd.has が全部 true（R.onData で R.Hd.def 済み）', notHd.length === 0, notHd);
ok('キーの形は R.Contract.HD_KEYS の種類（mon・boss・bbg）', keys.every((k) => /^hd:(mon|boss|bbg):[a-z0-9_]+$/.test(k)), keys.filter((k) => !/^hd:(mon|boss|bbg):[a-z0-9_]+$/.test(k)));
ok('同じキーの二重登録なし', new Set(keys).size === keys.length);
ok('R.loadErrors に art/ の物なし', !R.loadErrors.some((e) => /art\/(mons|boss|bbg)/.test(e) || /hd:(mon|boss|bbg)/.test(e)), R.loadErrors.filter((e) => /art\/|hd:/.test(e)));
ok('kindOf: mon/boss/bbg', R.Hd.kindOf('hd:mon:jelly_1') === 'mon' && R.Hd.kindOf('hd:boss:boss_moth') === 'boss' && R.Hd.kindOf('hd:bbg:forest') === 'bbg');

section('組み立て表（旧 MON_COMPOSE_MOBS をデータとして読む）');
ok('表は 211 行', Object.keys(BZ.COMPOSE_TABLE).length === 211, Object.keys(BZ.COMPOSE_TABLE).length);
const bad = Object.entries(BZ.COMPOSE_TABLE).filter(([id, r]) => !Array.isArray(r) || typeof r[0] !== 'string' || typeof r[1] !== 'object' || !Array.isArray(r[2]));
ok('どの行も [土台, {hue,sat,bri}, [[部品, opts]…], 仕上げ?]', bad.length === 0, bad.slice(0, 5));
for (const id of BZ.SLICE_MONS) {
  const s = BZ.monSpec(id);
  ok(`${id}: 土台と部品がそろう（${s ? s.base + (s.parts.length ? ' + ' + s.parts.map((p) => p[0]).join(',') : '') : 'なし'}）`, !!s);
}
section('段が上がると部品が増える（色だけの違いにしない、ART_REWORK §2.5）');
for (const base of ['jelly', 'rat', 'seabird', 'crab', 'bat', 'bee', 'mushroom', 'plant', 'fairy', 'wolf', 'treant']) {
  const a = BZ.monSpec(base + '_1'), b = BZ.monSpec(base + '_2');
  ok(`${base}: 段 2 は段 1 より部品が多い（${a.parts.length} → ${b.parts.length}）`, b.parts.length > a.parts.length);
}

section('大きさの段（R.Hd.STYLE.size と魔物データの size）');
const S = R.Hd.STYLE || {};
ok('STYLE.size に s m l boss', !!(S.size && S.size.s && S.size.m && S.size.l && S.size.boss), S.size);
for (const t of ['s', 'm', 'l', 'boss']) {
  const [a, b] = BZ.tierPx(t);
  ok(`tierPx(${t}) = ${a}〜${b}（STYLE.size ${JSON.stringify(S.size && S.size[t])}）`, a > 0 && b > a && (!S.size || (a === S.size[t][0] && b === S.size[t][1])));
}
const sizeMap = {};
for (const m of Object.values(R.DB.monsters || {})) if (m && m.sprite && !sizeMap[m.sprite]) sizeMap[m.sprite] = m.size;
for (const id of BZ.SLICE_MONS) {
  const s = BZ.monSpec(id), ds = sizeMap[id];
  ok(`${id}: 土台の段 ${s.B.tier} = 魔物データの size ${ds || '（データなし）'}`, !ds || ds === s.B.tier);
}
for (const id of ['rare_hare', 'rare_fawn', 'rare_acorn']) {
  const ds = sizeMap[id] || ((R.DB.rare || {})[id] || {}).size;
  ok(`${id}: 段 ${BZ.RARE[id].tier} = 魔物データの size ${ds || '（データなし）'}`, !ds || ds === BZ.RARE[id].tier);
}

section('魔物データの sprite → 絵のキー（縦切りの出現表・編成）');
const zones = ['zw_prologue', 'zw_peninsula', 'z_lighthouse', 'zw_forest', 'zw_forest_road', 'z_verda', 'z_elder', 'z_well'];
const need = new Set();
const monOf = (id) => (R.DB.monsters || {})[id] || (R.DB.bosses || {})[id] || (R.DB.rare || {})[id];
for (const z of zones) {
  const e = (R.DB.encounters || {})[z];
  if (!e) continue;
  JSON.stringify(e).replace(/"([a-z0-9_@]+)"/g, (m0, id) => { const m = monOf(id.replace(/^@/, '')); if (m && m.sprite) need.add(m.sprite); return m0; });
}
for (const t of ['tr_tutorial', 'tr_b_pageeater', 'tr_b_moth', 'tr_b_rooteater', 'tr_a21_forest_wolves']) {
  const tr = (R.DB.troops || {})[t];
  if (!tr) continue;
  for (const [id] of tr.mons || []) { const m = monOf(String(id).replace(/^@/, '')); if (m && m.sprite) need.add(m.sprite); }
}
const unmet = [...need].filter((sp) => !R.Hd.has('hd:mon:' + sp) && !R.Hd.has('hd:boss:' + sp));
console.log('  縦切りで使う sprite:', [...need].sort().join(' '));
ok('縦切りの出現表・ボスの編成の sprite に絵がある（mon か boss）', unmet.length === 0, unmet);
const bgs = new Set();
for (const z of zones) { const e = (R.DB.encounters || {})[z]; if (e && e.bg) bgs.add(e.bg); }
for (const t of ['tr_tutorial', 'tr_b_pageeater', 'tr_b_moth', 'tr_b_rooteater', 'tr_a21_forest_wolves']) { const tr = (R.DB.troops || {})[t]; if (tr && tr.bg) bgs.add(tr.bg); }
ok(`縦切りの戦闘背景（${[...bgs].join(' ')}）に hd:bbg がある`, [...bgs].every((b) => R.Hd.has('hd:bbg:' + b)), [...bgs].filter((b) => !R.Hd.has('hd:bbg:' + b)));

section('戦闘背景の meta');
const moods = R.Contract.MOODS;
const bbgMoods = (BZ._pending || []).filter((p) => /^hd:bbg:/.test(p[0])).map((p) => [p[0], p[2].mood]);
ok('背景の mood はすべて R.Contract.MOODS の中', bbgMoods.every(([, m]) => moods.includes(m)), bbgMoods);

section('ファイル（読み込み時に document に触れない）');
const fs = require('fs');
const files = [];
for (const d of ['mons', 'boss', 'bbg']) for (const f of fs.readdirSync(path.join(__dirname, '..', 'src', 'art', d))) files.push(path.join('src/art', d, f));
for (const f of files) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  ok(`${f}: IIFE で登録するだけ`, /^\(function \(R\) \{/m.test(src) && /\}\)\(window\.RPG\);\s*$/.test(src));
  ok(`${f}: API キー・モデル名を書かない`, !/sk-[A-Za-z0-9]{8}|api[_-]?key|gpt-|claude-|dall-e/i.test(src));
}
done('test_beast');
