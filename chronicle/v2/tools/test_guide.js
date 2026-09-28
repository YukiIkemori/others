// MENUS の「次にやること」と「初めての説明の札」・カーソルの記憶の node のテスト（オーナーの依頼 2026-09-28）
//   node v2/tools/test_guide.js
//   ・序章 → 森 → 体験版の終わりまでの各段で R.Leads.goal() が空でなく、その段の目標（期待する id と言葉）になっている
//   ・段の条件が進むほど後ろの段になる（戻らない）・途中の旗が欠けたフィクスチャでも後ろの段を選ぶ
//   ・説明の札は 1〜3 行・{btn:x} が埋まる・新しい札（熟練度・魔物の強さ・魔石・仲間）がある・出来事で積まれる・1 回だけ
//   ・カーソルの記憶（S._recall / S._remember）: タブ・人・行を戻す、人を指定して開いたときは人を覚えない
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const S = R.Screens;

function fresh(flags, vars, leads) {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 1 });
  Object.assign(R.Game.flags, flags || {});
  Object.assign(R.Game.vars, vars || {});
  for (const l of leads || []) R.Leads.add(l, { silent: true });
  return R.Game;
}

section('次にやること（R.DB.goals と R.Leads.goal）');
ok('R.DB.goals has ≥ 12 stages', Object.keys(R.DB.goals || {}).length >= 12, Object.keys(R.DB.goals || {}));
ok('R.Leads.goal / goalText exist', typeof R.Leads.goal === 'function' && typeof R.Leads.goalText === 'function');
for (const [id, g] of Object.entries(R.DB.goals)) {
  const texts = Array.isArray(g.text) ? g.text.map((x) => x.text) : [g.text];
  ok(`goal ${id}: n is a number, every text is a non-empty Japanese line (≤ 30 字, 1 行)`, typeof g.n === 'number' && texts.every((t) => typeof t === 'string' && t.length > 0 && !t.includes('\n') && t.replace(/\{[^}]*\}/g, '0').length <= 30 && /[぀-ヿ一-鿿]/.test(t)), texts);
  if (g.lead) ok(`goal ${id}: lead ${g.lead} is a real lead`, !!R.DB.leads[g.lead]);
}
ok('no goal before a game (R.Game null) → null', (() => { const g0 = R.Game; R.Game = null; const r = R.Leads.goal(); R.Game = g0; return r === null; })());

// 序章 → 体験版の終わりまでの歩き（旗は前の段に足していく）。[期待する段, 足す旗, 足す変数, 聞いた手がかり, 文に入る言葉]
const HERO = ['forest_found_hans', 'forest_found_ben', 'forest_found_roy', 'forest_found_pim'];
const WALK = [
  ['g_berna', {}, {}, [], 'ベルナ'],
  ['g_berna', { prologue_start: true }, {}, [], 'ベルナ'],
  ['g_pharos', { prologue_berna: true }, {}, [], 'ファロス'],
  ['g_tavern', { prologue_pharos: true }, {}, [], '潮風亭'],
  ['g_tavern', { prologue_rowell: true }, {}, [], '仲間'],
  ['g_otto', { prologue_party: true }, {}, [], 'オットー'],
  ['g_lighthouse', { prologue_key: true }, {}, [], '灯台'],
  ['g_lighthouse', { prologue_lh_door: true }, {}, [], '灯台'],
  ['g_climb', { prologue_tutorial: true }, {}, [], '灯室'],
  ['g_climb', { prologue_fine: true }, {}, [], '灯室'],
  ['g_return', { prologue_boss: true }, {}, [], 'ファロス'],
  ['g_rumors', { prologue_done: true }, {}, ['l_main_rumors'], 'うわさ'],
  ['g_fern', {}, {}, ['l_rumor_forest'], 'フェルン'],
  ['g_gord', { forest_start: true }, {}, [], '掲示板'],
  ['g_gord', { forest_board: true }, {}, ['l_forest_board'], 'ゴード'],
  ['g_search', { forest_gord_talked: true }, {}, ['l_forest_woodcutters'], 'カトリ'],
  ['g_search', {}, {}, ['l_forest_pim'], '0/4'],
  ['g_search', { forest_found_hans: true }, {}, [], '1/4'],
  ['g_search', { forest_found_ben: true, forest_found_roy: true }, { forest_verses: 1 }, [], '3/4'],
  ['g_song', { forest_found_pim: true }, {}, ['l_forest_song'], '1/3'],
  ['g_song', { forest_moth: true }, { forest_verses: 2 }, [], '2/3'],
  ['g_elder', {}, { forest_verses: 3 }, [], '千年樹'],
  ['g_elder', { forest_fine: true, forest_boss: true }, {}, [], '千年樹'],
  ['g_rest', { cleared_r_forest: true, forest_finale_done: true }, {}, [], 'ひと休み'],
  ['g_free', { story_t1: true, world_demo_end: true }, {}, ['l_main_margin_1'], '体験版'],
];
{
  const flags = {}, vars = {}, leads = [];
  let prevN = -1, mono = true;
  for (const [want, f, v, l, word] of WALK) {
    Object.assign(flags, f); Object.assign(vars, v); leads.push(...l);
    fresh(flags, vars, leads);
    const g = R.Leads.goal();
    const n = g && R.DB.goals[g.id] ? R.DB.goals[g.id].n : -1;
    if (n < prevN) mono = false;
    prevN = n;
    ok(`walk ${want} (${Object.keys(f).concat(l).join(',') || 'start'}): non-empty and matches 「${word}」`, !!g && g.id === want && g.text.length > 0 && g.text.includes(word) && !/[{}]/.test(g.text), g);
  }
  ok('walk: the stage never goes back while the story advances', mono);
  // 全部の段に 1 回は来た
  const hit = new Set(WALK.map((w) => w[0]));
  ok('walk: every stage in R.DB.goals is reached', Object.keys(R.DB.goals).every((id) => hit.has(id)), Object.keys(R.DB.goals).filter((id) => !hit.has(id)));
}
{
  // フィクスチャのように途中の旗が欠けていても、後ろの段を選ぶ
  fresh({ forest_start: true, forest_gord_talked: true }, {}, ['l_forest_pim']);
  const g = R.Leads.goal();
  ok('sparse flags (forest only, no prologue flags) → g_search', g && g.id === 'g_search', g);
  fresh({ prologue_done: true, prologue_boss: true }, {}, []);
  ok('menus_party-like state (prologue_done) → g_rumors', R.Leads.goal().id === 'g_rumors');
  const C = R.DB.config;
  const sl = C.slice;
  fresh({ story_t1: true }, {}, []);
  try { C.slice = false; } catch (e) { /* 読むだけの時 */ }
  const full = R.Leads.goal();
  try { C.slice = sl; } catch (e) { /* */ }
  if (C.slice === sl && sl) ok('after T1 outside the demo → next rumor line', !full || full.text.includes('うわさ') || full.text.includes('体験版'), full);
  // 先の出来事を言わない（ボスの名前・フィーネの名前）
  const allText = Object.values(R.DB.goals).flatMap((g) => (Array.isArray(g.text) ? g.text.map((x) => x.text) : [g.text])).join('\n');
  ok('no spoilers in goal lines (boss / Fine / Elm names)', !/ページ食らい|ダストウィング|根食らい|フィーネ|エルム|灰色のマント/.test(allText));
}

section('説明の札（R.DB.tips）');
const tips = R.DB.tips;
for (const id of ['glimmer', 'prof', 'equip', 'tavern', 'zonelock', 'stone', 'repeat', 'steal', 'leads']) ok(`tip ${id} exists`, !!tips[id]);
for (const [id, t] of Object.entries(tips)) {
  const text = S.tipText(t);
  const lines = text.split('\n');
  ok(`tip ${id}: 1–3 lines, no {btn:} left, K.tip`, lines.length >= 1 && lines.length <= 3 && !/\{btn:/.test(text) && R.Contract.check('tip', t).ok, lines);
}
{
  let lab = 'L';
  try { lab = R.Input.prompt('l').label || 'L'; } catch (e) { lab = 'L'; }   // 入力の字（キーボードは Q）。読めなければ L
  ok(`tip {btn:l} becomes the key label (${lab})`, S.tipText(tips.repeat).includes(lab + ' で'), S.tipText(tips.repeat));
}
ok('tavern tip says 20 people / 3 / swap', /20 人/.test(tips.tavern.text) && /3 人/.test(tips.tavern.text) && /入れ替え/.test(tips.tavern.text));
ok('equip tip counts the real slots (R.Rules.SLOTS)', tips.equip.text.includes(R.Rules.SLOTS.length + ' か所'), R.Rules.SLOTS.length);
ok('no numbers of effects and no 「オート」 in tips except save (A17・A26)', Object.entries(tips).every(([id, t]) => id === 'save' || !/オート|%|％/.test(S.tipText(t))));

section('説明の札を積む（出来事）');
{
  ok('node (no document) does not queue tips by default', (fresh({}, {}, []), S.tipLater('spring') === false));
  S.autoTips = 'force';
  const G = fresh({}, {}, []);
  // フィールドが無いので開かれずに積まれる
  R.emit('glimmer', { c: 'hero', id: 't_sword_stepcut', kind: 'tech' });
  ok('glimmer event queues the glimmer tip', S._tipQueue().includes('glimmer'), S._tipQueue());
  R.emit('battle:end', { result: 'win', rewards: { glimmers: [{ c: 'hero', id: 'x' }], prof: [{ c: 'hero', key: 'sword' }], stolen: [] } });
  ok('battle with glimmer + prof: prof waits for a later battle (no pile of cards)', !S._tipQueue().includes('prof'), S._tipQueue());
  G.flags.tip_glimmer = true; S._tipQueue();
  R.emit('battle:end', { result: 'win', rewards: { glimmers: [], prof: [{ c: 'hero', key: 'sword' }], stolen: [] } });
  ok('later battle with prof → prof tip queued', S._tipQueue().includes('prof'));
  R.emit('item:gain', { id: 'i_stone_fire', n: 1 });
  ok('gaining a magic stone queues the stone tip', S._tipQueue().includes('stone'));
  R.emit('item:gain', { id: 'i_salve', n: 1 });
  R.emit('region:clear', { rid: 'r_forest', tier: 1 });
  ok('region clear queues the enemy-strength tip', S._tipQueue().includes('zonelock'));
  R.emit('battle:end', { result: 'win', rewards: { stolen: [{ c: 'hero', item: 'i_salve' }] } });
  ok('stealing queues the steal tip', S._tipQueue().includes('steal'));
  const n0 = S._tipQueue().length;
  S.tipLater('stone');
  ok('the same tip is queued once', S._tipQueue().length === n0);
  G.flags.tip_chest = true;
  ok('a seen tip is not queued', S.tipLater('chest') === false);
  S.autoTips = false;
  ok('S.autoTips = false stops queueing', S.tipLater('spring') === false);
  S.autoTips = 'force';
  fresh({}, {}, []);
  ok('a new game forgets the queue', (S.tipLater('spring'), S._tipQueue().join(',') === 'spring'), S._tipQueue());
  S.autoTips = true;
}

section('カーソルの記憶（S._recall / S._remember）');
{
  fresh({}, {}, []);
  R.Party.join('selma'); R.Party.join('viola');
  const mkList = (vals) => new R.UIK.List({ rows: vals.map((v) => ({ value: v, label: v })) });
  const mk = (id, p) => {
    const v = { id, p: p || {}, tab: 0, ci: 0 };
    v.refresh = function () { this.list.setRows((this.tab ? ['x', 'y', 'z'] : ['a', 'b', 'c', 'd']).map((x) => ({ value: x, label: x }))); };
    v.list = mkList(['a', 'b', 'c', 'd']);
    return v;
  };
  let v = mk('items');
  let ref = S._recall('items', v);
  v.tab = 1; v.refresh(); v.list.focusIndex(2); v.ci = 2;
  S._remember(ref, v);
  v = mk('items');
  S._recall('items', v);
  ok('items: tab and row come back', v.tab === 1 && v.list.index === 2 && v.list.current().value === 'z', [v.tab, v.list.index]);
  // 値で探す（行が増えても同じ物に）
  v = mk('menu'); ref = S._recall('menu', v); v.list.focusIndex(2); S._remember(ref, v);
  v = mk('menu'); v.list = mkList(['a', 'warp', 'b', 'c', 'd']); S._recall('menu', v);
  ok('menu: the row is found by its value when rows change', v.list.current().value === 'c' && v.list.index === 3, v.list.current());
  v = mk('skills'); ref = S._recall('skills', v); v.ci = 2; S._remember(ref, v);
  v = mk('skills'); S._recall('skills', v);
  ok('skills: the person comes back', v.ci === 2);
  v = mk('skills', { id: 'hero' }); ref = S._recall('skills', v);
  ok('skills opened for a person: ci is not overridden', v.ci === 0);
  v = mk('tip'); ok('screens outside the list (tip) are not remembered', S._recall('tip', v) === null);
  v = mk('items', { fresh: true }); ok('params.fresh skips the memory', S._recall('items', v) === null);
  fresh({}, {}, []);
  v = mk('items'); S._recall('items', v);
  ok('a new game forgets the cursor', v.tab === 0 && v.list.index === 0);
}

done('test_guide');
