// MENUS: 年代記の画面の「書庫」のタブ（R.DB.lore を読み直す）の node のテスト
//   node v2/tools/test_library.js
//   タブがある・数（書き写した / 書き写せる物）・書き写していない物と行けない地方は「？？？」で文を出さない・地方の並び・
//   開いて見た印（R.Game.loreSeen）がセーブに残る（serialize → deserialize）・K.game を通る・5 つの言語の文。
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true, dev: true, fixtures: true });

const S = R.Screens;
const LORE = R.DB.lore || {};
const IDS = Object.keys(LORE);
const LANGS = ['ja', 'en', 'ko', 'zh-Hans', 'zh-Hant'];

section('タブ');
for (const l of LANGS) {
  const t = R.I18n.table(l)['ui.chronicle.draw.tabRects.tabs'];
  ok(`${l}: chronicle has 3 tabs (年代記 / 手がかり / 書庫)`, Array.isArray(t) && t.length === 3 && t.every((s) => typeof s === 'string' && s), t);
}
ok('ja: the third tab is 書庫', R.T('ui.chronicle.draw.tabRects.tabs')[2] === '書庫');
const NEW_KEYS = R.I18n.keys('ja').filter((k) => k.indexOf('ui.chronicle.lore.') === 0);
ok('library strings exist (ui.chronicle.lore.*)', NEW_KEYS.length >= 10, NEW_KEYS);
for (const l of LANGS) ok(`${l}: every ui.chronicle.lore.* key is translated`, NEW_KEYS.every((k) => R.I18n.has(k, l)), NEW_KEYS.filter((k) => !R.I18n.has(k, l)));
ok('S.loreRows / S.loreCount / S.loreSeen exist', typeof S.loreRows === 'function' && typeof S.loreCount === 'function' && typeof S.loreSeen === 'function');

// 体験版を切る / 入れる
const C = R.DB.config;
const slice0 = C.slice;
function full() { C.slice = false; }
function demo() { C.slice = true; }

section('全部（体験版でない）');
R.Dev.applyState('menus_party');
full();
const G = R.Game;
for (const id of IDS) delete G.flags[id];
delete G.loreSeen;
let rows = S.loreRows();
ok('every lore has a row (nothing locked)', rows.length === IDS.length && IDS.every((id) => rows.some((r) => r.value === id)), [rows.length, IDS.length]);
ok('count is 0 / all', JSON.stringify(S.loreCount()) === JSON.stringify({ got: 0, total: IDS.length }), S.loreCount());
const unknown = R.T('ui.chronicle.lore.unknown');
ok('uncollected rows show ？？？ and carry no text', rows.every((r) => r.label === unknown && !r.got && !r.text && !r.isNew));
// 地方の並び: 序章が先、ビブリア島（finale）は最後
const order = [...new Set(rows.map((r) => r.region))];
ok('regions: prologue first', order[0] === 'prologue', order);
ok('regions: finale last', order[order.length - 1] === 'finale', order);
ok('regions: world after the eight regions, before finale', order.indexOf('world') > order.indexOf('r_star') && order.indexOf('world') < order.indexOf('finale'), order);
ok('each region group has exactly one first row', order.every((rid) => rows.filter((r) => r.region === rid && r.first).length === 1));
ok('every region has a heading name', order.every((rid) => !!S.loreRegionName(rid)), order.map((rid) => S.loreRegionName(rid)));
const lz = rows.filter((r) => /^lo_lz_[2-8]$/.test(r.value)).map((r) => r.value);
ok('world letters are in their order (lo_lz_2 … lo_lz_8)', lz.join() === ['lo_lz_2', 'lo_lz_3', 'lo_lz_4', 'lo_lz_5', 'lo_lz_6', 'lo_lz_7', 'lo_lz_8'].join(), lz);

// 書き写す
const PICK = ['lo_roa_stone', 'lo_ev_isles', 'lo_lighthouse_song', 'lo_ouroboros', 'lo_lz_1'];
for (const id of PICK) ok(`lore ${id} exists`, !!LORE[id]);
for (const id of PICK) G.flags[id] = true;
rows = S.loreRows();
ok('count after copying 5', S.loreCount().got === 5 && S.loreCount().total === IDS.length, S.loreCount());
const row = (id) => rows.find((r) => r.value === id);
ok('collected rows show their title', PICK.every((id) => row(id).got && row(id).label === LORE[id].title));
ok('collected rows carry the full text', row('lo_ev_isles').text.indexOf(LORE.lo_ev_isles.text.split('\n')[0]) === 0 && row('lo_ev_isles').text.length >= LORE.lo_ev_isles.text.length - 2);
ok('collected rows are new until opened', PICK.every((id) => row(id).isNew));
ok('the side story 外伝『円環の竜』 sits under finale', row('lo_ouroboros').region === 'finale');
ok('the voiced lore keeps its song (play/stop)', row('lo_lighthouse_song').songs.length === 1 && row('lo_lighthouse_song').songs[0].voice === LORE.lo_lighthouse_song.voice);
ok('other rows still ？？？', rows.filter((r) => !PICK.includes(r.value)).every((r) => r.label === unknown && !r.text));

section('開いて見た印（R.Game.loreSeen）');
ok('loreSeen of an uncollected lore does nothing', S.loreSeen('lo_ev_star') === false && !(G.loreSeen && G.loreSeen.lo_ev_star));
ok('loreSeen marks once', S.loreSeen('lo_ev_isles') === true && S.loreSeen('lo_ev_isles') === false);
rows = S.loreRows();
ok('the opened row is no longer new', !row('lo_ev_isles').isNew && row('lo_roa_stone').isNew);
ok('R.Game passes K.game with loreSeen', R.Contract.check('game', G).ok, R.Contract.check('game', G).errors);
const saved = JSON.parse(JSON.stringify(R.State.serialize()));
ok('serialize keeps loreSeen', saved.loreSeen && saved.loreSeen.lo_ev_isles === true);
G.loreSeen = {};
ok('deserialize → true', R.State.deserialize(saved) === true);
ok('seen mark survives the save (deserialize)', R.Game.loreSeen && R.Game.loreSeen.lo_ev_isles === true && !R.Game.loreSeen.lo_roa_stone);
rows = S.loreRows();
ok('…and the row is still not new after loading', !row('lo_ev_isles').isNew && row('lo_roa_stone').isNew);
const old = JSON.parse(JSON.stringify(saved)); delete old.loreSeen;
ok('an old save without loreSeen still loads', R.State.deserialize(old) === true && R.Contract.check('game', R.Game).ok);
ok('…and everything collected is new there', S.loreRows().filter((r) => r.got).every((r) => r.isNew));

section('体験版（行けない地方は 1 行の ？？？）');
demo();
const open = C.sliceOpen || [];
ok('fixture config: slice with sliceOpen', Array.isArray(open) && open.length > 0, open);
for (const id of IDS) R.Game.flags[id] = true;   // 行けない地方の物の旗が立っていても出さない
rows = S.loreRows();
const lockedRegions = [...new Set(IDS.map((id) => LORE[id].region))].filter((rid) => !open.includes(rid));
ok('there are locked regions in the demo', lockedRegions.length > 0, lockedRegions);
for (const rid of lockedRegions) {
  const rs = rows.filter((r) => r.region === rid);
  ok(`locked ${rid}: one row, ？？？, no text, no title`, rs.length === 1 && rs[0].locked && !rs[0].got && rs[0].label === unknown && !rs[0].text && !rs[0].d);
}
const openIds = IDS.filter((id) => open.includes(LORE[id].region));
ok('open regions list every lore', openIds.every((id) => rows.some((r) => r.value === id && r.got)));
ok('demo count counts only open regions', JSON.stringify(S.loreCount()) === JSON.stringify({ got: openIds.length, total: openIds.length }), [S.loreCount(), openIds.length]);
ok('no locked title leaks into the rows', IDS.filter((id) => !open.includes(LORE[id].region)).every((id) => !rows.some((r) => r.label === LORE[id].title)));

section('画面（node で作って回す）');
full();
for (const id of IDS) delete R.Game.flags[id];
for (const id of PICK) R.Game.flags[id] = true;
R.Game.loreSeen = {};
const def = S._defs.chronicle;
const v = Object.assign(Object.create(def), { close() {} });
v.init();
v.tab = 2; v.refresh(false);
ok('tab 2 lists the library rows', v.list.rows.length === IDS.length && v.list.rows[0].region === 'prologue');
const i = v.list.rows.findIndex((r) => r.value === 'lo_roa_stone');
v.list.focusIndex(i);
v.update();
ok('focusing a collected row in the library marks it seen', R.Game.loreSeen.lo_roa_stone === true);
v.list.focusIndex(v.list.rows.findIndex((r) => !r.got));
v.update();
ok('focusing an uncollected row does not', Object.keys(R.Game.loreSeen).length === 1);
v.tab = 1; v.refresh(false);
ok('the leads tab still works (tab 1)', Array.isArray(v.list.rows));
v.tab = 0; v.refresh(false);
ok('the chronicle tab still works (tab 0)', Array.isArray(v.list.rows));

C.slice = slice0;
done('test_library');
