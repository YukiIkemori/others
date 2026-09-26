#!/usr/bin/env node
// EVENTS の node のテスト（V2_PLAN §4.4 の EVENTS の行）: ev の全関数・条件式・手がかり帳（add・pin・done・hideWhen）・
// pendingTier（E17）・clearRegion・セーブの往復・小さな遊び・大事な物・tools/lib/cond.js がゲームと同じ答えを出すこと。
//   node v2/tools/test_events.js
// 画面（R.Screens）・会話（R.UIK.Message）・戦闘（R.Battle.start）・フィールドの移動（R.Field.enter）は台本の偽物に差し替えて、
// 呼ばれ方（引数と順番）を確かめる。時間は R.Engine.step で進める（R.wait は Engine.time で数える）。
'use strict';
const load = require('./lib/load');
const { ok, section, done } = require('./lib/testkit');
const Cond = require('./lib/cond');

const R = load({ quiet: true });
const C = R.Contract;

// ---------------------------------------------------------------- 道具
async function drive(p, maxMs) {
  let fin = false, val, err;
  p.then((v) => { fin = true; val = v; }, (e) => { fin = true; err = e; });
  for (let t = 0; t < (maxMs || 60000) && !fin; t += 17) {
    R.Engine.step(16.7);
    await new Promise((r) => setImmediate(r));
  }
  if (err) throw err;
  return fin ? val : '__timeout__';
}
async function frames(n) { for (let i = 0; i < n; i++) { R.Engine.step(16.7); await new Promise((r) => setImmediate(r)); } }
async function press(btn) { R.Input._set(btn, true); await frames(2); R.Input._set(btn, false); await frames(2); }

// 会話・画面・戦闘の偽物（呼ばれた物を積む）
const log = [];
let sayAnswers = [];
R.UIK.Message.say = (o) => { log.push(['say', o]); return Promise.resolve(sayAnswers.length ? sayAnswers.shift() : undefined); };
R.UIK.Message.caption = (t, o) => { log.push(['caption', t, o]); return R.wait((o && o.ms) || 10); };
R.UIK.Message.busy = () => false;
R.UIK.Message.close = () => { log.push(['close']); };
let screenAnswer = {};
R.Screens.open = (id, p) => { log.push(['screen', id, p]); const a = screenAnswer[id]; return Promise.resolve(typeof a === 'function' ? a(p) : a); };
R.Screens.tip = (id) => { log.push(['tip', id]); return Promise.resolve(); };
let battleAnswer = { result: 'win', rewards: null };
R.Battle.start = (s) => { log.push(['battle', s]); return Promise.resolve(typeof battleAnswer === 'function' ? battleAnswer(s) : battleAnswer); };
const entered = [];
R.Field.enter = async (map, spawn) => { entered.push([map, spawn]); R.emit('map:enter', { map, from: null }); };
let FPOS = { map: 'ev_town', x: 5, y: 6, dir: 'n' };
Object.defineProperty(R.Field, 'pos', { configurable: true, get: () => FPOS });
R.Field.camera.focus = (x, y, o) => { log.push(['focus', x, y, o && o.ms]); return Promise.resolve(); };
R.Field.camera.follow = (o) => { log.push(['follow', o && o.ms]); return Promise.resolve(); };
const autos = [];
R.Save.autosave = (r) => { autos.push(r); return true; };
const last = (kind) => { for (let i = log.length - 1; i >= 0; i--) if (log[i][0] === kind) return log[i]; return null; };

// テスト用のマップ・見た目・手がかり・地方・イベント
R.def('maps', 'ev_town', {
  id: 'ev_town', name: '試しの町', kind: 'town', region: 'r_forest', w: 4, h: 3, legend: { '.': { mat: 'stub_road' } }, rows: ['....', '....', '....'], spawns: { a: { x: 1, y: 1 } },
  npcs: [{ id: 'rita', look: 'npc_rita', name: 'リタ', title: '歌い手', x: 1, y: 1, key: 'k_rita', talk: { lines: [{ text: 'こんばんは' }, { cond: 'ev_song_heard', text: '歌を聞いたのね' }] } },
    { id: 'nameless', look: 'npc_man_1', x: 2, y: 1 }],
});
R.def('maps', 'ev_cave', { id: 'ev_cave', name: '試しの洞窟', kind: 'dungeon', region: 'r_forest', w: 1, h: 1, legend: { '.': { mat: 'stub_road' } }, rows: ['.'], spawns: { a: { x: 0, y: 0 } } });
R.defs('leads', {
  l_ev_a: { title: '森で人が消える', text: 'x', region: 'r_forest', kind: 'region', from: 'ファロスの酒場' },
  l_ev_b: { title: '歌の石', text: 'x', region: 'r_forest', kind: 'region', done: 'ev_stones_done' },
  l_ev_old: { title: '古い話', text: 'x', region: 'r_forest', kind: 'rumor', hideWhen: 'ev_old_gone' },
  l_ev_main: { title: '噂は酒場に', text: 'x', region: 'prologue', kind: 'main' },
  l_ev_world: { title: '砂漠の隊商', text: 'x', region: 'r_desert', kind: 'rumor', slice: 'locked' },
});
R.DB.regions.r_forest = R.DB.regions.r_forest || { name: 'ヴェルダの森', chapter: { title: '千年樹の歌' }, page: 'k_page_forest' };
const ran = [];
R.defs('events', {
  ev_once: { once: true, async run(ev) { ran.push('once'); await ev.say(null, '一度だけ'); } },
  ev_cond: { cond: 'ev_gate', async run() { ran.push('cond'); } },
  ev_long: { async run(ev) { ran.push('long:start'); await ev.wait(1000); ran.push('long:end'); await ev.say(null, 'あとの言葉'); ran.push('long:after'); } },
  ev_sub: { async run(ev, ctx) { ran.push('sub:' + ctx.who); return 42; } },
  ev_clear: { async run(ev) { ran.push('clear:start'); await ev.clearRegion('r_forest'); ran.push('clear:end'); await ev.warp('ev_town', 'a'); await ev.wait(50); } },
  ev_inn: { async run(ev) { await ev.inn(30); } },
  ev_trig: { async run() { ran.push('trig'); } },
});
// story_t1 は CONTENT-P の本物があっても試しの物に差し替える（中身ではなく、いつ走るかを確かめる）
R.DB.events.story_t1 = { async run(ev, ctx) { ran.push('t1:' + ctx.reason); } };

(async function main() {
  // ================================================================ 契約
  section('contract');
  for (const ns of ['State', 'Events', 'Leads', 'Mini', 'Tier']) {
    ok(`R.${ns} is claimed (no stub fills it)`, !!R.Stubs.claimed[ns] && !R.Stubs.installed[ns], R.Stubs.installed[ns]);
    ok(`R.${ns} names (checkApi)`, C.checkApi(ns).ok, C.checkApi(ns).errors);
  }
  const bare = load({ quiet: true, stubs: false });
  ok('without stubs: State/Events/Leads/Mini/Tier all present', ['State', 'Events', 'Leads', 'Mini', 'Tier'].every((n) => bare.Contract.checkApi(n).ok),
    ['State', 'Events', 'Leads', 'Mini', 'Tier'].map((n) => bare.Contract.checkApi(n).errors).flat());
  ok('ev has every OBJ_API.ev name', C.check('ev', R.Events.makeEv({})).ok, C.check('ev', R.Events.makeEv({})).errors);

  // ================================================================ 状態
  section('state');
  R.State.newGame({ hero: { type: 'mage', sex: 'f', name: 'リーネ', fav: 'fire' }, seed: 99 });
  const G = () => R.Game;
  ok('newGame → K.game', C.check('game', G()).ok, C.check('game', G()).errors);
  ok('newGame has uniques and steps', G().uniques && typeof G().steps === 'number');
  ok('hero → K.char, first in party, joined', C.check('char', G().chars.hero).ok && G().party[0] === 'hero' && G().joined.includes('hero'), C.check('char', G().chars.hero).errors);
  ok('hero keeps fav and sex', G().chars.hero.fav === 'fire' && R.State.heroSex() === 'f');
  ok('blankChar → K.char (8 slots, no weapon2)', C.check('char', R.State.blankChar('x', { name: 'X' })).ok && !('weapon2' in R.State.blankChar('x').equip));
  R.State.newGame({ seed: 5 });
  ok('newGame without hero: empty party (roa_house_intro makes the hero)', G().party.length === 0 && !G().chars.hero);
  R.State.setHero({ type: 'warrior', sex: 'm', name: 'アルン' });
  const g1 = R.State.gain('i_salve', 2);
  ok('gain → K.gain', C.check('gain', g1).ok && g1.n === 2 && G().items.i_salve === 2, g1);
  let gains = 0; const onGain = () => gains++; R.on('item:gain', onGain);
  R.State.gain('k_pim_hat'); R.State.gain('k_pim_hat');
  ok('key item: only one, one item:gain', G().items.k_pim_hat === 1 && gains === 1);
  R.off('item:gain', onGain);
  G().tier = 2;
  R.State.gain('u_hans_axe');
  const U = G().uniques.u_hans_axe;
  ok('u_*: uniques[id] has tier and fillItem numbers {tier, atk, mag, def?, mdef?, eva?, stats?}', U && U.tier === 2 && typeof U.atk === 'number' && typeof U.mag === 'number', U);
  const exp = R.Rules.fillItem(Object.assign({}, R.DB.items.u_hans_axe), { tier: 2 });
  ok('u_*: values equal R.Rules.fillItem at that tier', U.atk === exp.atk && U.mag === exp.mag);
  G().tier = 5; R.State.gain('u_hans_axe');
  ok('u_*: second gain keeps the first tier', G().uniques.u_hans_axe.tier === 2 && G().items.u_hans_axe === 2);
  ok('R.Rules.itemOf reads the unique', R.Rules.itemOf('u_hans_axe').atk === exp.atk);
  G().tier = 0;
  ok('take: enough → true', R.State.take('i_salve', 1) === true && G().items.i_salve === 1);
  ok('take: not enough → false, unchanged', R.State.take('i_salve', 5) === false && G().items.i_salve === 1);
  G().chars.hero.equip.acc1 = 'ac_test_ring';
  ok('owned counts bag + equipped', R.State.owned('ac_test_ring') === 1 && R.State.check({ item: 'ac_test_ring' }));
  G().chars.hero.equip.acc1 = null;

  // セーブの往復
  G().gold = 777; G().flags.a = true; G().vars.forest_verses = 2; G().choices.ch_forest_pim = 'send'; G().leads.l_ev_a = { got: 5, pin: true, seen: false };
  G().lastInn = { map: 'ev_town', x: 1, y: 1, dir: 's' }; G().guest = { id: 'npc_pim', look: 'npc_pim' }; G().pendingTier = 1;
  const saved = JSON.parse(JSON.stringify(R.State.serialize()));
  const before = JSON.stringify(G());
  R.State.newGame({ seed: 1 });
  ok('deserialize → true', R.State.deserialize(saved) === true);
  ok('save round trip: state is the same', JSON.stringify(G()) === before);
  ok('save round trip through R.Save (s1)', (() => { const o = R.Save.save('s1'); const b = JSON.stringify(G()); R.State.newGame({ seed: 3 }); const l = R.Save.load('s1'); return o && l && JSON.stringify(G()) === b; })());
  ok('deserialize: other version → false, R.Game kept', R.State.deserialize(Object.assign({}, saved, { ver: 1 })) === false && G().gold === 777);
  ok('deserialize: garbage → false', R.State.deserialize(null) === false && R.State.deserialize({ ver: 2 }) === false);
  const thin = JSON.parse(JSON.stringify(saved)); delete thin.uniques; delete thin.steps; delete thin.book; delete thin.lamps;
  ok('deserialize: missing fields are filled (K.game)', R.State.deserialize(thin) && C.check('game', G()).ok && G().book.mon && G().lamps);
  G().gold = 101;
  const back = R.State.wipeRecover();
  ok('wipeRecover: half gold, returns lastInn (K.place)', G().gold === 50 && C.check('place', back).ok);

  // ================================================================ 条件
  section('conditions');
  R.State.newGame({ hero: { type: 'ranger', sex: 'm', name: 'A' }, seed: 2 });
  Object.assign(G().flags, { f1: true, cleared_r_old: true });
  G().cleared.r_forest = true; G().vars.forest_verses = 3; G().tier = 2; G().items.k_pim_hat = 1;
  G().choices.ch_forest_pim = 'take'; G().heard.fern_rita = 'x'; G().guest = { id: 'npc_pim', look: 'npc_pim' };
  G().leads.l_ev_a = { got: 1, pin: false, seen: true }; G().leads.l_ev_b = { got: 2, pin: false, seen: true }; G().visited.ev_town = true;
  const cases = [
    [null, true], [undefined, true], [true, true], [false, false], ['', true],
    ['f1', true], ['f2', false], ['!f1', false], ['!f2', true],
    ['cleared_r_forest', true], ['cleared_r_desert', false], ['cleared_r_old', true], ['!cleared_r_forest', false],
    [['f1', 'cleared_r_forest'], true], [['f1', 'f2'], false], [[], true],
    [{ any: ['f2', 'f1'] }, true], [{ any: ['f2', 'f3'] }, false], [{ any: [] }, false], [{ all: ['f1', { item: 'k_pim_hat' }] }, true], [{ not: 'f2' }, true], [{ not: 'f1' }, false],
    [{ flag: 'f1' }, true], [{ item: 'k_pim_hat' }, true], [{ item: 'k_pim_hat', n: 2 }, false], [{ item: 'i_nothing' }, false],
    [{ var: 'forest_verses', gte: 3 }, true], [{ var: 'forest_verses', gte: 4 }, false], [{ var: 'forest_verses', lte: 3 }, true], [{ var: 'forest_verses', eq: 3 }, true], [{ var: 'forest_verses', eq: 2 }, false],
    [{ var: 'forest_verses' }, true], [{ var: 'none' }, false], [{ var: 'none', eq: 0 }, true],
    [{ tier: { gte: 2 } }, true], [{ tier: { gte: 3 } }, false], [{ tier: { lte: 1 } }, false], [{ tier: 2 }, true], [{ tier: 3 }, false],
    [{ lead: 'l_ev_a' }, true], [{ lead: 'l_ev_a', state: 'got' }, true], [{ lead: 'l_ev_c', state: 'got' }, false], [{ lead: 'l_ev_a', state: 'done' }, false],
    [{ choice: 'ch_forest_pim', is: 'take' }, true], [{ choice: 'ch_forest_pim', is: 'send' }, false], [{ choice: 'ch_none', is: 'x' }, false],
    [{ heard: 'fern_rita' }, true], [{ heard: 'fern_gord' }, false],
    [{ guest: 'npc_pim' }, true], [{ guest: 'npc_other' }, false], [{ guest: null }, false],
    [{ slice: true }, true], [{ slice: false }, false],
    [{ member: 'hero' }, true], [{ member: 'selma' }, false], [{ joined: 'hero' }, true], [{ visited: 'ev_town' }, true], [{ visited: 'x' }, false],
    [{ sex: 'm' }, true], [{ sex: 'f' }, false],
    [{ var: 'forest_verses', gte: 3, item: 'k_pim_hat' }, true], [{ var: 'forest_verses', gte: 3, item: 'nothing' }, false],
    [{ bogus: 1 }, false],
  ];
  let bad = [];
  for (const [c, want] of cases) if (R.State.check(c) !== want) bad.push(JSON.stringify(c) + ' → ' + R.State.check(c));
  ok(`R.State.check: ${cases.length} cases`, !bad.length, bad);
  G().flags.ev_stones_done = true;
  ok('{lead, state:"done"} via DB.leads[id].done cond', R.State.check({ lead: 'l_ev_b', state: 'done' }));
  delete G().flags.ev_stones_done;
  G().guest = null;
  ok('{guest:null} = not travelling with anyone', R.State.check({ guest: null }));
  // tools/lib/cond.js はゲームと同じ関数（同じ答え）
  bad = [];
  for (const [c] of cases) { const a = R.State.check(c), b = Cond.check(c, G(), { DB: R.DB }); if (a !== b) bad.push(JSON.stringify(c)); }
  ok('tools/lib/cond.js gives the same answers as R.State.check', !bad.length, bad);
  const M = Cond.fromSets({ flags: ['f1'], items: ['k_pim_hat'], vars: { forest_verses: 3 }, cleared: ['r_forest'], choices: { ch_forest_pim: 'send' }, leads: ['l_ev_a'], done: ['l_ev_b'], guest: 'npc_pim', sex: 'f' });
  ok('cond.js fromSets model', Cond.check(['f1', 'cleared_r_forest', { item: 'k_pim_hat' }, { var: 'forest_verses', gte: 3 }, { tier: 1 }, { choice: 'ch_forest_pim', is: 'send' }, { lead: 'l_ev_b', state: 'done' }, { guest: 'npc_pim' }, { sex: 'f' }], M));
  const refs = Cond.refs(['f1', '!cleared_r_x', { item: 'i1' }, { var: 'v1', gte: 1 }, { any: [{ lead: 'l1' }, { choice: 'c1', is: 1 }] }]);
  ok('cond.js refs', refs.flags.includes('f1') && refs.regions.includes('r_x') && refs.items.includes('i1') && refs.vars.includes('v1') && refs.leads.includes('l1') && refs.choices.includes('c1'), refs);
  ok('cond.js validate: unknown key / gte without var / bad state', Cond.validate({ foo: 1 }).length === 1 && Cond.validate({ gte: 1 }).length >= 1 && Cond.validate({ lead: 'x', state: 'maybe' }).length === 1 && Cond.validate(['a', { any: ['b'] }]).length === 0);
  ok('cond.js validate with known ids', Cond.validate({ item: 'i_zzz' }, { items: new Set(['i_salve']) }).length === 1);

  // ================================================================ 手がかり帳
  section('leads');
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'A' }, seed: 3 });
  G().playMs = 12345.6;
  const seen = [];
  const onL = (e) => seen.push(e.id); R.on('lead:add', onL);
  ok('add → true, K.leadState, got = playMs', R.Leads.add('l_ev_a') === true && C.check('leadState', G().leads.l_ev_a).ok && G().leads.l_ev_a.got === 12345);
  ok('add again → false, one lead:add', R.Leads.add('l_ev_a') === false && seen.length === 1);
  R.off('lead:add', onL);
  R.Leads.add('l_ev_b'); R.Leads.add('l_ev_old'); R.Leads.add('l_ev_main'); R.Leads.add('l_ev_world');
  ok('state new', R.Leads.state('l_ev_a') === 'new');
  R.Leads.seen('l_ev_a');
  ok('seen → open', R.Leads.state('l_ev_a') === 'open');
  ok('pin one', R.Leads.pin('l_ev_a') && R.Leads.pinned() === 'l_ev_a');
  R.Leads.pin('l_ev_b');
  ok('pin moves (only one)', R.Leads.pinned() === 'l_ev_b' && !G().leads.l_ev_a.pin);
  ok('pin unknown → false', R.Leads.pin('l_nope') === false && R.Leads.pinned() === 'l_ev_b');
  R.Leads.unpin();
  ok('unpin', R.Leads.pinned() === null);
  R.Leads.pin('l_ev_a');
  R.Leads.done('l_ev_a');
  ok('done → state done, pin removed', R.Leads.state('l_ev_a') === 'done' && R.Leads.pinned() === null);
  G().flags.ev_stones_done = true;
  ok('done by DB.leads[id].done cond', R.Leads.state('l_ev_b') === 'done' && R.Leads.isDone('l_ev_b'));
  let L = R.Leads.list();
  ok('list → K.leadGroup[]', L.every((g) => C.check('leadGroup', g).ok), L);
  ok('list groups: main first, then world/region', L[0].region === 'main' && L.some((g) => g.region === 'r_forest') && L.some((g) => g.region === 'r_desert'));
  ok('list keeps the old rumour until hideWhen', L.some((g) => g.items.some((i) => i.id === 'l_ev_old')));
  G().flags.ev_old_gone = true;
  L = R.Leads.list();
  ok('hideWhen hides it', !L.some((g) => g.items.some((i) => i.id === 'l_ev_old')) && R.Leads.list({ all: true }).some((g) => g.items.some((i) => i.id === 'l_ev_old')));
  const fg = L.find((g) => g.region === 'r_forest');
  ok('done items sort last in a group', fg.items[fg.items.length - 1].state === 'done');
  R.Leads.add('l_ev_c_unknown');
  ok('unknown lead id is still recorded (warned)', !!G().leads.l_ev_c_unknown);
  G().leads.l_ev_c_unknown.pin = true;
  G().leads.l_ev_a.pin = false;
  R.DB.leads.l_ev_pin = { title: 'x', text: 'x', region: 'r_forest', kind: 'side' };
  R.Leads.add('l_ev_pin'); R.Leads.pin('l_ev_pin');
  R.Leads.clearRegionPins('r_forest');
  ok('clearRegionPins removes the region pin', R.Leads.pinned() === null);
  ok('no toast/tip without a field scene (fixtures, title)', !R.UIK.toasts().some((t) => /手がかり/.test(t.text)) && !last('tip'));

  // ================================================================ イベントの実行
  section('events run');
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 4 });
  log.length = 0; ran.length = 0;
  await drive(R.Events.run('ev_once', { map: 'ev_town' }));
  await drive(R.Events.run('ev_once', { map: 'ev_town' }));
  ok('once: runs one time, flags.ev_<id>', ran.filter((x) => x === 'once').length === 1 && G().flags.ev_ev_once === true);
  await drive(R.Events.run('ev_cond'));
  ok('cond false → does not run', !ran.includes('cond'));
  G().flags.ev_gate = true;
  await drive(R.Events.run('ev_cond'));
  ok('cond true → runs', ran.includes('cond'));
  ok('unknown event → undefined, no throw', (await drive(R.Events.run('ev_nope'))) === undefined);
  // busy・lock・トリガーの順番待ち
  const pLong = R.Events.run('ev_long', {});
  await frames(2);
  ok('busy while running, field locked (event)', R.Events.busy() && (R.Field.locks().event || 0) === 1 && R.Events.current().id === 'ev_long');
  const pIgn = R.Events.run('ev_sub', {});
  ok('second run while busy → ignored', (await pIgn) === undefined && !ran.includes('sub:undefined'));
  R.Events.run('ev_trig', { trigger: 'tr1' });
  await drive(pLong);
  await frames(3);
  ok('after: not busy, unlocked', !R.Events.busy() && !R.Field.locks().event);
  ok('a trigger that came while busy runs after the event', ran.indexOf('trig') > ran.indexOf('long:end'));
  // abort（全滅の宿・タイトル）
  ran.length = 0;
  const pA = R.Events.run('ev_long', {});
  await frames(3);
  R.Events.abort();
  ok('abort: not busy, unlocked, no fade', !R.Events.busy() && !R.Field.locks().event && R.Engine.fade.a < 0.01);
  await drive(pA);
  ok('abort: the old ev stops at its next call', ran.includes('long:start') && ran.includes('long:end') === false || !ran.includes('long:after'));
  ok('abort: nothing after the aborted line ran', !ran.includes('long:after'));
  // talk・isNew（E19）
  const town = R.DB.maps.ev_town, rita = town.npcs[0];
  ok('isNew before talking', R.Events.isNew(town, rita));
  log.length = 0;
  await drive(R.Events.talk(town, rita));
  const s1 = last('say');
  ok('talk {lines}: says the last line whose cond holds, speaker name/title from npc', s1 && s1[1].text === 'こんばんは' && s1[1].name === 'リタ' && s1[1].title === '歌い手');
  ok('talk writes heard[key]; not new after', !!G().heard.k_rita && !R.Events.isNew(town, rita));
  G().flags.ev_song_heard = true;
  ok('new again when the line changes', R.Events.isNew(town, rita));
  await drive(R.Events.talk(town, rita));
  ok('talk picks the changed line', last('say')[1].text === '歌を聞いたのね');
  ok('talk: unlocked after', !R.Field.locks().talk && !R.Events.busy());

  // ================================================================ ev の全関数
  section('ev functions');
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 6 });
  const ev = R.Events.makeEv({ map: 'ev_town' });
  log.length = 0;
  await drive(ev.say('rita', '{hero}、こんばんは。'));
  let s = last('say')[1];
  ok('say: npc name, {hero} filled', s.name === 'リタ' && s.text === 'アルン、こんばんは。' && C.check('say', s).ok, s);
  await drive(ev.say('rita', ['一', '二'], { face: 'smile', voice: 'v_x' }));
  s = last('say')[1];
  ok('say: face expr only → look:expr, voice, pages', s.face === 'npc_rita:smile' && s.voice === 'v_x' && Array.isArray(s.text) && s.text.length === 2);
  await drive(ev.say('rita', 'x', { face: false }));
  ok('say: face false → no face', last('say')[1].face === false);
  const hasFace = R.Portrait.has; R.Portrait.has = (look) => (look === 'npc_rita' ? 'placeholder' : null);
  await drive(ev.say('rita', 'x'));
  ok('say: no face given → auto when the look has a face', last('say')[1].face === 'npc_rita');
  await drive(ev.say('nameless', 'x'));
  ok('say: npc without name → looks[look].name or none; no face → false', last('say')[1].face === false && (last('say')[1].name === undefined || last('say')[1].name === (R.DB.looks.npc_man_1 || {}).name));
  R.Portrait.has = hasFace;
  await drive(ev.say(null, '地の文'));
  ok('say: null → narration (no name, no face)', last('say')[1].name === undefined && last('say')[1].face === false);
  await drive(ev.say('hero', 'x'));
  ok('say: party char id → its name', last('say')[1].name === 'アルン');
  await drive(ev.say('rita', 'x', { name: '？？？' }));
  ok('say: o.name overrides', last('say')[1].name === '？？？');
  sayAnswers = [1];
  ok('choose → index', (await drive(ev.choose(['はい', 'いいえ'], { cancel: 1 }))) === 1 && last('say')[1].choices.length === 2 && last('say')[1].cancel === 1);
  sayAnswers = [undefined];
  ok('choose: B with cancel → cancel index', (await drive(ev.choose(['a', 'b', 'c'], { cancel: 2 }))) === 2);
  await drive(ev.caption('森が 静まりかえった。', { ms: 300 }));
  ok('caption → Message.caption', last('caption')[1] === '森が 静まりかえった。');
  await drive(ev.fade('out', 100));
  ok('fade out', R.Engine.fade.a > 0.99);
  await drive(ev.fade('in', 100));
  ok('fade in', R.Engine.fade.a < 0.01);
  const t0 = R.Engine.time; await drive(ev.wait(500));
  ok('wait counts Engine.time', R.Engine.time - t0 >= 500);
  const fl = []; const onF = (e) => fl.push(e); R.on('flag', onF);
  ev.setFlag('ff'); ok('setFlag/flag + emit flag', ev.flag('ff') && fl[0].id === 'ff');
  ev.setFlag('ff', false); ok('setFlag false clears', !ev.flag('ff') && !('ff' in G().flags));
  R.off('flag', onF);
  ok('var/addVar', ev.var('forest_verses') === 0 && ev.addVar('forest_verses') === 1 && ev.addVar('forest_verses', 2) === 3 && ev.var('forest_verses') === 3);
  R.UIK.clearToasts();
  const gi = ev.item('i_salve', 3);
  ok('item → K.gain, toast 手に入れた', C.check('gain', gi).ok && G().items.i_salve === 3 && R.UIK.toasts().some((t) => /手に入れた/.test(t.text)));
  R.UIK.clearToasts();
  ev.item('i_salve', 1, { silent: true });
  ok('item silent: no toast', !R.UIK.toasts().length && G().items.i_salve === 4);
  ok('take / has', ev.take('i_salve', 4) === true && !ev.has('i_salve') && ev.take('i_salve') === false);
  ok('gold add / pay, never below 0', ev.gold(100) === 100 && ev.gold(-30) === 70 && ev.gold(-999) === 0);
  battleAnswer = { result: 'win', rewards: null };
  ok('battle(troop id) → win, setup has troop', (await drive(ev.battle('tr_a21_forest_wolves', { canLose: true }))) === 'win' && last('battle')[1].troop === 'tr_a21_forest_wolves' && last('battle')[1].canLose === true);
  battleAnswer = { result: 'lose' };
  ok('battle(setup) → lose (canLose)', (await drive(ev.battle({ mons: [['stub_slime', 1]], canLose: true }))) === 'lose');
  await drive(ev.warp('ev_cave', 'a'));
  ok('warp → R.Field.enter(map, spawn)', entered[entered.length - 1][0] === 'ev_cave' && entered[entered.length - 1][1] === 'a');
  G().chars.hero.hp = 1;
  ev.heal();
  ok('heal: HP back', G().chars.hero.hp > 1);
  G().chars.hero.hp = 0;
  ev.rest();
  ok('rest: revives', G().chars.hero.hp > 0);
  // 宿（MENUS は {stay} だけ返す）
  G().gold = 100; autos.length = 0;
  let innEv = null; const onInn = (e) => { innEv = e; }; R.on('inn', onInn);
  screenAnswer.inn = { stay: true };
  G().chars.hero.hp = 1;
  ok('inn(price) → true', (await drive(ev.inn(30))) === true);
  ok('inn: pays, full heal, lastInn = K.place of here, autosave inn, emit inn, fade back', G().gold === 70 && G().chars.hero.hp === R.Rules.stats(G().chars.hero).maxHp &&
    C.check('place', G().lastInn).ok && G().lastInn.map === 'ev_town' && autos.includes('inn') && innEv && innEv.map === 'ev_town' && R.Engine.fade.a < 0.01);
  ok('inn screen got {price}', last('screen')[1] === 'inn' && last('screen')[2].price === 30);
  screenAnswer.inn = { stay: false };
  ok('inn: stay false → false, no pay', (await drive(ev.inn(30))) === false && G().gold === 70);
  screenAnswer.inn = { stay: true }; G().gold = 5;
  ok('inn: not enough gold → false', (await drive(ev.inn(30))) === false && G().gold === 5);
  G().gold = 1000; screenAnswer.inn = { stay: true };
  await drive(ev.inn());
  ok('inn(): default price from DB.config.innPrice by tier', last('screen')[2].price === R.DB.config.innPrice[0] && G().gold === 1000 - R.DB.config.innPrice[0]);
  R.off('inn', onInn);
  screenAnswer.shop = undefined;
  await drive(ev.shop('shop_pharos_item'));
  ok('shop → Screens.open(shop, {id})', last('screen')[1] === 'shop' && last('screen')[2].id === 'shop_pharos_item');
  await drive(ev.tavern({ swap: true }));
  ok('tavern → Screens.open(tavern, {swap})', last('screen')[1] === 'tavern' && last('screen')[2].swap === true);
  const comp = Object.keys(R.DB.companions).slice(0, 3);
  screenAnswer.partySelect = comp;
  const joined = await drive(ev.chooseCompanions({ count: 3 }));
  ok('chooseCompanions: joins the chosen 3 (R.Party.join)', joined.length === 3 && comp.every((id) => G().joined.includes(id) && G().chars[id]) && last('screen')[2].count === 3);
  ok('party is hero + 3', G().party.length === 4);
  R.State.newGame({ seed: 8 });
  let n = 0; screenAnswer.charcreate = () => (++n < 2 ? null : { type: 'ranger', sex: 'f', name: 'ミナ', fav: 'bow' });
  const h = await drive(R.Events.makeEv({}).createHero());
  ok('createHero: B (null) reopens; then setHero', n === 2 && h.name === 'ミナ' && G().chars.hero.name === 'ミナ' && G().party[0] === 'hero');
  const ev2 = R.Events.makeEv({ map: 'ev_town' });
  ev2.lead('l_ev_a'); ok('ev.lead', !!G().leads.l_ev_a);
  ev2.leadDone('l_ev_a'); ok('ev.leadDone', R.Leads.state('l_ev_a') === 'done');
  ev2.choice('ch_forest_pim', 'send'); ok('choice/choiceOf', ev2.choiceOf('ch_forest_pim') === 'send' && R.State.check({ choice: 'ch_forest_pim', is: 'send' }));
  const npcApi = { move() {}, face() {}, act() {}, hide() {}, show() {}, setPos() {} };
  const oldNpc = R.Field.npc; R.Field.npc = (id) => (id === 'rita' ? npcApi : null);
  ok('npc(id) → R.Field.npc', ev2.npc('rita') === npcApi);
  R.Field.npc = oldNpc;
  ev2.guest('npc_pim');
  ok('guest(look) → R.Field.setGuest, R.Game.guest', G().guest && G().guest.look === 'npc_pim' && R.State.check({ guest: 'npc_pim' }));
  ev2.guest(null);
  ok('guest(null) clears', G().guest === null);
  await drive(ev2.camera(10, 12, 300));
  ok('camera(x, y, ms) → focus', last('focus')[1] === 10 && last('focus')[2] === 12 && last('focus')[3] === 300);
  await drive(ev2.camera());
  ok('camera() → follow', !!last('follow'));
  await drive(ev2.letter('letter_berna_t1'));
  ok('letter → Screens.open(letter, {id})', last('screen')[1] === 'letter' && last('screen')[2].id === 'letter_berna_t1');
  ok('call(eventId, args) → result', (await drive(ev2.call('ev_sub', { who: 'x' }))) === 42 && ran.includes('sub:x'));
  ok('g(male, female)', ev2.g('彼', '彼女') === '彼女');
  ev2.bgm('forest'); ev2.sfx('confirm'); await ev2.jingle('item');
  ok('bgm/sfx/jingle do not throw', true);
  ok('ev.mini has sequence and timing', typeof ev2.mini.sequence === 'function' && typeof ev2.mini.timing === 'function');

  // ================================================================ 小さな遊び（歌あわせ）
  section('mini');
  R.Engine.clear();
  const pSeq = R.Mini.sequence({ title: '歌あわせ', symbols: 4, rounds: 2, tempo: 300, seed: 't' });
  await frames(2);
  ok('sequence pushes scene mini:sequence', R.Engine.top() && R.Engine.top().id === 'mini:sequence');
  const DIRS = ['up', 'right', 'down', 'left', 'a'];
  // 1 節目は正しく、2 節目は最後の音をまちがえる
  for (let round = 0; round < 2; round++) {
    let guard = 0;
    while (R.Mini.state().phase !== 'input' && guard++ < 600) await frames(1);
    const st = R.Mini.state();
    ok(`round ${round + 1}: phrase length ${round + 3}`, st.seq.length === round + 3);
    for (let i = 0; i < st.seq.length; i++) {
      const v = round === 1 && i === st.seq.length - 1 ? (st.seq[i] + 1) % 4 : st.seq[i];
      await press(DIRS[v]);
    }
  }
  let gd = 0;
  while (R.Mini.state() && R.Mini.state().phase !== 'result' && gd++ < 600) await frames(1);
  await frames(60);
  await press('a');
  const res = await drive(pSeq, 5000);
  ok('sequence → {score, rank}: 3 + 3 of 7 notes', res && res.hits === 6 && res.total === 7 && res.score === 86 && res.rank === 'A', res);
  ok('sequence scene removed', !R.Engine.has('mini:sequence'));
  const pQ = R.Mini.sequence({ rounds: 3, seed: 'q' });
  await frames(5); await press('b');
  let gq = 0; while (R.Mini.state() && R.Mini.state().phase !== 'result' && gq++ < 200) await frames(1);
  await frames(60); await press('a');
  const rq = await drive(pQ, 3000);
  ok('sequence: B quits → score 0, rank C', rq && rq.score === 0 && rq.rank === 'C', rq);
  const r1 = await (async () => { const p = R.Mini.sequence({ rounds: 1, seed: 'same' }); await frames(3); const a = R.Mini.state().seq.join(); await press('b'); await frames(80); await press('a'); await drive(p, 3000); return a; })();
  const r2 = await (async () => { const p = R.Mini.sequence({ rounds: 1, seed: 'same' }); await frames(3); const a = R.Mini.state().seq.join(); await press('b'); await frames(80); await press('a'); await drive(p, 3000); return a; })();
  ok('same seed → same phrase', r1 === r2 && r1.length > 0);
  const pT = R.Mini.timing({ tries: 2, zones: [[0, 1]], speed: 800 });
  await frames(5); await press('a'); await frames(50); await press('a'); await frames(110); await press('a');
  const rt = await drive(pT, 3000);
  ok('timing → {hits, rank} (whole bar is a hit)', rt && rt.hits === 2 && rt.rank === 'S', rt);

  // ================================================================ 地方の解決・ティア（E17・E20）
  section('clearRegion / tier');
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 10 });
  R.Engine.clear();
  G().leads.l_ev_a = { got: 1, pin: true, seen: true };
  const evs = [];
  const onT = (e) => evs.push(['tier', e && e.tier, R.Engine.fade.a]); const onRC = (e) => evs.push(['region:clear', e.rid]);
  R.on('tier', onT); R.on('region:clear', onRC);
  ran.length = 0; log.length = 0;
  const pc = R.Events.run('ev_clear', { map: 'ev_cave' });
  let gc = 0;
  while (!R.Engine.has('celebrate') && gc++ < 800) await frames(1);
  ok('celebrate scene is pushed', R.Engine.has('celebrate'));
  ok('state: cleared, tier 1, pendingTier 1, chapter 1, flag, page', G().cleared.r_forest && G().tier === 1 && G().pendingTier === 1 && G().chapter === 1 && G().flags.cleared_r_forest && G().items.k_page_forest === 1);
  ok('region lead pin removed', R.Leads.pinned() === null);
  ok('tier emitted while the screen is dark', evs.some((e) => e[0] === 'tier' && e[1] === 1 && e[2] > 0.99), evs);
  ok('region:clear emitted', evs.some((e) => e[0] === 'region:clear' && e[1] === 'r_forest'));
  ok('chronicle chapter recorded', G().chronicle.chapters.some((c) => c.id === 'r_forest'));
  let gw = 0; while (R.Engine.time < 0 || gw++ < 400) { await frames(1); if (gw > 240) break; }
  await press('a');
  await drive(pc, 10000);
  ok('celebrate closes on A; event continues', !R.Engine.has('celebrate') && ran.includes('clear:end'));
  ok('ev_town entered inside the clearing event: story_t1 NOT run there (armed)', !ran.some((x) => /^t1/.test(x)) && G().pendingTier === 1);
  ok('clearRegion again → no change', (await drive(R.Events.makeEv({}).clearRegion('r_forest'))) === 1 && G().tier === 1);
  R.off('tier', onT); R.off('region:clear', onRC);
  // 次の町に入る（ほかのイベントの外）→ story_t1。フィールドが一番上のときに走る
  const fakeField = { id: 'field', enter() {}, exit() {}, update() {}, draw() {} };
  R.Engine.push(fakeField);
  R.emit('map:enter', { map: 'ev_cave' });
  await frames(5);
  ok('dungeon enter: no story', !ran.some((x) => /^t1/.test(x)) && G().pendingTier === 1);
  R.emit('map:enter', { map: 'ev_town' });
  await frames(8);
  ok('town enter: story_t1 runs (reason enter), pending consumed', ran.includes('t1:enter') && G().pendingTier === null, ran);
  // 宿で（イベントの中の ev.inn → 終わってから）
  G().pendingTier = 1; ran.length = 0; screenAnswer.inn = { stay: true }; G().gold = 100;
  const pi = R.Events.run('ev_inn', { map: 'ev_town' });
  await drive(pi, 10000);
  await frames(8);
  ok('inn: story_t1 after the inn event (reason inn)', ran.includes('t1:inn') && G().pendingTier === null, ran);
  G().pendingTier = 2;
  R.emit('map:enter', { map: 'ev_town' });
  await frames(5);
  ok('story_t2 not written → pending stays', G().pendingTier === 2);
  G().pendingTier = null;
  ok('Tier.get/effective/pending/consumePending', R.Tier.get() === 1 && R.Tier.effective() === 1 && R.Tier.pending() === null && (G().pendingTier = 3, R.Tier.consumePending() === 3 && R.Tier.pending() === null));
  ok('Tier.pick array / object', R.Tier.pick([1, 2, 3], 5) === 3 && R.Tier.pick({ 0: 'a', 3: 'b' }, 4) === 'b' && R.Tier.pick({ 3: 'b' }, 1) === undefined);
  R.Engine.clear();

  // ================================================================ データ（大事な物・設定）
  section('data');
  const keys = R.ItemsKey.ids();
  ok('key items: all K.item with slot key, price 0', keys.length >= 20 && keys.every((id) => C.check('item', R.DB.items[id]).ok && R.DB.items[id].slot === 'key' && R.DB.items[id].price === 0), keys.filter((id) => !C.check('item', R.DB.items[id]).ok));
  ok('key item icons are in R.Contract.ICONS', keys.every((id) => C.ICONS.includes(R.DB.items[id].icon)));
  ok('pages 8 and forest page', R.ItemsKey.pages().length === 8 && !!R.DB.items.k_page_forest);
  ok('slice key items (k_pim_hat, k_lighthouse_key, k_chronicle, k_quill, k_bell)', ['k_pim_hat', 'k_lighthouse_key', 'k_chronicle', 'k_quill', 'k_bell'].every((id) => R.DB.items[id]));
  ok('config.slice true', R.DB.config.slice === true);
  const st0 = R.DB.config.start;
  ok('config.start {map, spawn} (roa_house / bed, event roa_house_intro when written)', st0 && typeof st0.map === 'string' && typeof st0.spawn === 'string' && (st0.map !== 'roa_house' || st0.spawn === 'bed') && (!st0.event || st0.event === 'roa_house_intro'), st0);
  ok('config.start map exists', !!R.DB.maps[st0.map]);
  ok('config.defaultHero is K.hero', C.check('hero', R.DB.config.defaultHero).ok);
  ok('innPrice 10 tiers', R.DB.config.innPrice.length === 10);

  done('test_events');
})().catch((e) => { console.error(e); process.exitCode = 1; });
