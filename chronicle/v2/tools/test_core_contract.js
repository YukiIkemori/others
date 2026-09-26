#!/usr/bin/env node
// CORE: 契約の版 2（P0 のレビュー、V2_PLAN §2.11）で足した物の node のテスト。
//   node v2/tools/test_core_contract.js
// 仮の実装（core/stubs）が版 2 の形を満たすこと、R.MapUtil・R.Stubs.claim・R.Flow.wipe・セーブの戦闘中の拒否を確かめる。
'use strict';
const load = require('./lib/load');
const { ok, done } = require('./lib/testkit');

const R = load({ quiet: true });
const C = R.Contract;

// ---------------------------------------------------------------- 契約そのもの
ok('contract version 2', C.VERSION === 2);
ok('checkAll with v2 names', C.checkAll().ok, C.checkAll().errors);
ok('UIK.T has the token names others read (K.uikTokens)', C.check('uikTokens', R.UIK.T).ok, C.check('uikTokens', R.UIK.T).errors);
ok('SCREEN_RESULTS covers every screen id', C.SCREEN_IDS.every((id) => C.SCREEN_RESULTS[id]), C.SCREEN_IDS.filter((id) => !C.SCREEN_RESULTS[id]));
ok('letter is a screen id', C.SCREEN_IDS.includes('letter'));
ok('lists: MOODS/THEMES/ICONS/HD_KINDS', C.MOODS.includes('forest_night') && C.THEMES.length >= 7 && C.ICONS.includes('save') && C.HD_KINDS.bld === 'prop');
ok('inn event name is registered', R.EVENTS.includes('inn'));

// ---------------------------------------------------------------- MapUtil
R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'テスト' }, seed: 7 });
const m = {
  id: 't_map', name: 'テスト', kind: 'dungeon', region: 'prologue', w: 6, h: 4,
  legend: { '.': { mat: 'stub_road' }, '#': { mat: 'stub_tree', solid: true }, 'S': { mat: 'stub_tree', solid: true, secret: true, floor: 'stub_road' }, 'v': { mat: 'stub_grass' } },
  rows: ['######', '#..S.#', '#....#', '######'],
  spawns: { a: { x: 1, y: 1, dir: 'e' } },
  objects: [{ type: 'spring', id: 's1', x: 2, y: 1 }, { type: 'chest', id: 'c1', x: 4, y: 2, item: 'i_potion' }, { type: 'sign', x: 1, y: 2, text: 'x', cond: 'never_flag' }],
  tilePatches: [{ cond: 'open_gate', x: 4, y: 1, ch: 'v' }],
  zones: [{ rect: [1, 1, 2, 1], zone: 'z_a' }, { rect: null, zone: 'z_all' }],
  dark: [{ rect: [3, 2, 2, 1] }],
};
ok('map contract (secret in a dungeon, legend entries)', C.check('map', m).ok, C.check('map', m).errors);
ok('legend entry type is checked', !C.check('map', Object.assign({}, m, { legend: Object.assign({}, m.legend, { x: { solid: true } }), rows: m.rows })).ok);
ok('cell reads legend', R.MapUtil.cell(m, 1, 1).mat === 'stub_road' && R.MapUtil.cell(m, -1, 0) === null && R.MapUtil.cell(m, 6, 0) === null);
ok('tilePatch off', R.MapUtil.cell(m, 4, 1).mat === 'stub_road');
R.Game.flags.open_gate = true; R.MapUtil.invalidate('t_map');
ok('tilePatch on after the flag', R.MapUtil.cell(m, 4, 1).mat === 'stub_grass');
ok('spawn by name / object / fallback', R.MapUtil.spawn(m, 'a').dir === 'e' && R.MapUtil.spawn(m, { x: 3, y: 2 }).x === 3 && R.MapUtil.spawn(m, 'nope').x === 1);
ok('spring covers 2x2', R.MapUtil.objectsAt(m, 3, 2).some((o) => o.id === 's1') && !R.MapUtil.objectsAt(m, 4, 1).some((o) => o.id === 's1'));
ok('objects with a false cond are skipped', R.MapUtil.objectsAt(m, 1, 2).length === 0);
ok('zoneAt first match / whole map', R.MapUtil.zoneAt(m, 2, 1) === 'z_a' && R.MapUtil.zoneAt(m, 4, 2) === 'z_all');
ok('darkAt range', R.MapUtil.darkAt(m, 3, 2) && !R.MapUtil.darkAt(m, 1, 1));
ok('secret passable in the field stub, found only after entering', R.Field.passable(m, 3, 1) && !R.MapUtil.secretFound('t_map', 3, 1));
R.Game.secrets.t_map = ['3,1'];
ok('secretFound uses "x,y"', R.MapUtil.secretFound('t_map', 3, 1));

// ---------------------------------------------------------------- 状態・規則（仮）
const h = R.Game.chars.hero;
ok('setHero via Party.makeChar, char shape', C.check('char', h).ok && h.look === 'hero_m_warrior', C.check('char', h).errors);
ok('hero result shape', C.check('hero', { type: 'mage', sex: 'f', name: 'ミラ', fav: 'fire' }).ok);
ok('Rules.stats shape (K.stats)', C.check('stats', R.Rules.stats(h)).ok, C.check('stats', R.Rules.stats(h)).errors);
R.Party.join('selma');
const sel = R.Game.chars.selma;
sel.hp = 1; sel.status = ['poison'];
const fh = R.Party.fullHeal({ dry: true });
ok('fullHeal (満タン) returns K.fullHealResult and dry does not heal', C.check('fullHealResult', fh).ok && sel.hp === 1, fh);
sel.hp = 0;
R.Party.heal(false);
ok('heal does not revive', sel.hp === 0);
R.Party.restoreAll();
ok('restoreAll revives and clears status', sel.hp > 0 && sel.status.length === 0);
const g = R.State.gain('i_potion', 2);
ok('State.gain → K.gain and items count', C.check('gain', g).ok && R.Game.items.i_potion === 2);
ok('chestLoot shape', C.check('chestLoot', R.Rules.chestLoot({ id: 'c', pool: 'p_T' }, 0, R.rng(1))).ok && R.Rules.chestLoot({ gold: 50 }, 0).gold === 50);
ok('leads got = playMs', (R.Leads.add('l_test'), C.check('leadState', R.Game.leads.l_test).ok));

// ---------------------------------------------------------------- 新しい話（E19）
const npc = { id: 'n', look: 'npc_man_1', x: 0, y: 0, key: 'k_n', talk: { lines: [{ text: 'やあ' }, { cond: 'later', text: '変わった' }] } };
ok('isNew before talking', R.Events.isNew(m, npc));
R.Game.heard.k_n = R.U.hash(JSON.stringify('やあ')).toString(36);
ok('not new after hearing', !R.Events.isNew(m, npc));
R.Game.flags.later = true;
ok('new again when the line changes', R.Events.isNew(m, npc));

// ---------------------------------------------------------------- 戦闘（仮）
const B = R.BattleCore.create({ troop: 'tr_stub' });
ok('battle object v2 names (escape, finish)', C.check('battle', B).ok, C.check('battle', B).errors);
B.round();
const gold0 = R.Game.gold;
const rw = B.finish();
ok('finish applies once', R.Game.gold === gold0 + rw.gold && B.finish() === rw && R.Game.gold === gold0 + rw.gold);
ok('enemy unit uses monster size s|m|l', B.units.filter((u) => u.side === 'enemy').every((u) => ['s', 'm', 'l'].includes(u.size)));

// ---------------------------------------------------------------- 焼く列（仮）
let steps = 0;
const job = { done: false, step() { steps++; if (steps >= 3) { this.done = true; this.result = 42; } }, onDone(r) { job.got = r; } };
R.Hd.schedule(job, 1);
for (let i = 0; i < 5; i++) R.Hd.pump(3);
ok('schedule + pump runs a job to the end', job.done && job.got === 42 && C.check('bakeJob', job).ok);
R.Hd.track('chunk', 'a', 1000); R.Hd.track('chunk', 'b', 500); R.Hd.track('chunk', 'a', null);
ok('track counts outside caches in stats', R.Hd.stats().byKind.chunk === 500 && C.check('hdStats', R.Hd.stats()).ok);
ok('kindOf maps keys to budget kinds', R.Hd.kindOf('hd:bld:x1') === 'prop' && R.Hd.kindOf('hd:btl:selma:sword') === 'btl');

// ---------------------------------------------------------------- 仮の実装の claim
{
  const R3 = load({ quiet: true, stubs: false });
  R3.Stubs.claim('Mini');
  R3.Mini = { sequence() { return 1; } };
  R3.Stubs.install();
  ok('claimed namespace is not filled by stubs', R3.Mini.timing === undefined && R3.Mon.encounter !== undefined);
}

// ---------------------------------------------------------------- セーブ: 戦闘の中は拒む
{
  const fake = { id: 'battle', enter() {}, exit() {}, update() {}, draw() {} };
  R.Engine.push(fake);
  const refused = R.Save.save('s1') === false;
  R.Engine.remove(fake);
  ok('save refused while a battle scene is on the stack', refused && R.Save.save('s1') === true);
}
ok('Flow.wipe exists (BSCENE calls it for inn/title)', typeof R.Flow.wipe === 'function');
ok('Media.preload / sprites table', typeof R.Media.preload === 'function' && R.Contract.check('media', { bgm: {}, voice: {}, portraits: {}, sprites: {} }).ok);

done('test_core_contract');
