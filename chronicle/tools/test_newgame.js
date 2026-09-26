#!/usr/bin/env node
// newgame (A6) unit + flow tests: name entry, hero creation, the tavern (choose / recruit / swap /
// deposit), the title flow, and a draw pass over every screen with a stub 2D context.
//   node tools/test_newgame.js [-v] [--stubs]   exit 1 on any failure (--stubs: every other owner's API replaced by
//                                               the spec-shaped stand-ins of tools/fixtures/newgame/00_stubs.js)
// Real rules / state / party modules are used when they work; tools/fixtures/newgame/00_stubs.js fills
// in whatever is missing (it prints which stand-ins were used).
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const R = require('./lib/load')({ quiet: true, extra: [path.join(ROOT, 'tools/fixtures/newgame/00_stubs.js')] });

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, info) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok   ' + name); return true; }
  fail++; fails.push(name + (info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
  console.log('  FAIL ' + name + (info !== undefined ? ' — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
  return false;
}
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });

// ------------------------------------------------------------ headless canvas + engine driver
function fakeCtx() {
  const noop = () => {};
  const store = { globalAlpha: 1, font: '10px x', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, textAlign: 'left', textBaseline: 'top', globalCompositeOperation: 'source-over', imageSmoothingEnabled: false };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s) => ({ width: R.Text.approxWidth(s) });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'getImageData' || k === 'createImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(((w || x) * (h || y) * 4) || 4), width: w || x, height: h || y });
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function fakeCanvas(w, h) { const ctx = fakeCtx(); return { width: w, height: h, getContext: () => ctx }; }
R.Gfx.ctx = fakeCtx();
R.Gfx.canvas = fakeCanvas(1024, 896);
R.Gfx.makeCanvas = fakeCanvas;
R.Settings = Object.assign({}, R.DEFAULT_SETTINGS || {}, { msgSpeed: 3, windowColor: 'ink' });
const stand = R.NGFixture.install(process.argv.includes('--stubs'));
if (stand.length) console.log('stand-ins used for missing APIs: ' + stand.join(', '));

const flush = () => new Promise((r) => setImmediate(r));
let drawErrors = [];
async function frames(n) {
  for (let i = 0; i < n; i++) {
    R.Engine.step();
    await flush();
  }
  try { R.Engine.error = null; R.Engine.render(); } catch (e) { drawErrors.push(String(e.stack || e)); }
  if (R.Engine.error) { drawErrors.push(R.Engine.error.msg); R.Engine.error = null; }
}
async function press(b, n = 1) {
  for (let i = 0; i < n; i++) {
    R.Input._set(b, true); await frames(1);
    R.Input._set(b, false); await frames(2);
  }
}
async function keys(seq) { for (const k of seq.split(',')) { const m = /^(\w+)(?:\*(\d+))?$/.exec(k.trim()); await press(m[1], m[2] ? +m[2] : 1); } }
const top = () => R.Engine.top();
const topName = () => (top() ? top().constructor.name : null);
/** run an async screen and drive it with a key script; resolves the screen's value */
async function drive(start, script, o) {
  let done = false, value;
  const p = Promise.resolve(start()).then((v) => { done = true; value = v; });
  await frames(3);
  for (const step of script) {
    if (process.env.NGDEBUG) console.log('   step', typeof step === 'function' ? 'fn' : step, '→', topName());
    if (typeof step === 'function') await step();
    else await keys(step);
  }
  for (let i = 0; i < ((o && o.settle) || 60) && !done; i++) await frames(1);
  if (!done) return { done, value, top: topName() };
  await p.catch((e) => { ok(false, 'screen threw', String(e.stack || e)); });
  return { done, value };
}
const reset = () => { R.Engine.clear(); if (R.UI.closeMessage) R.UI.closeMessage(); R.Input.consume(); };

process.on("exit", (c) => { if (!global.__done) console.log("[test ended early (code " + c + "): a screen promise never settled]"); });
(async () => {
  // ------------------------------------------------------------ N: NameEntry helpers
  console.log('N  name entry rules');
  const NE = R.NameEntry;
  eq(NE.MAX, 5, 'N1 MAX is 5');
  ok(NE.check('アルン') === null && NE.check('Arun5') === null && NE.check('あいうえお') === null, 'N2 kana / alnum names are valid');
  ok(!!NE.check('') && !!NE.check('漢字') && !!NE.check('ア ル') && !!NE.check('アル!'), 'N3 empty, kanji, spaces, symbols are refused');
  ok(!!NE.check('アイウエオカ') && NE.check('アイウエオ') === null && NE.check('ABCDE') === null, 'N4 1〜5 characters (full- and half-width count 1)');
  eq(NE.normalize(' ＡＢ１ ｱｲ '), 'AB1アイ', 'N5 normalize = NFKC + strip spaces');
  const mNames = R.DB.starterKit.heroNames.m, fNames = R.DB.starterKit.heroNames.f;
  eq([mNames.length, fNames.length], [8, 8], 'N6 eight おまかせ names per gender');
  eq(NE.omakase('f', 'リーネ'), 'コトハ', 'N7 おまかせ goes to the next name');
  eq(NE.omakase('m', 'オルト'), 'アルン', 'N8 おまかせ wraps after eight');
  eq(NE.omakase('m', 'だれか'), 'アルン', 'N9 おまかせ starts from the first');
  ok(mNames.concat(fNames).every((n) => NE.check(n) === null), 'N10 every おまかせ name passes check()');

  // flow: type a name on the grid, delete with B, confirm
  reset();
  let r = await drive(() => NE.run({ initial: '', max: 5, spriteKey: 'party:hero_f_mage', gender: 'f' }), [
    'a', 'right,a', 'right*2,a', // カタカナ page (empty initial): ア イ エ
    'b', // delete エ
    'left*2,down,a', // キ (row 1 column 1)
    'up,up,right,right', // to the command rows (from grid row 0 up → row 2): 決定
    'a',
  ]);
  eq(r.value, 'アイキ', 'N11 grid input, B deletes, 決定 returns the name');
  reset();
  r = await drive(() => NE.run({ initial: 'ラ', gender: 'm' }), ['b', 'b']);
  eq([r.done, r.value], [true, null], 'N12 B on an empty name returns null (back one step)');
  reset();
  r = await drive(() => NE.run({ initial: '', gender: 'm' }), ['a*5', 'a']);
  eq(r.value, 'アアアアア', 'N13 the 5th character moves the cursor to 決定');
  reset();
  r = await drive(() => NE.run({ initial: 'ミーシャ', gender: 'f' }), ['up,up', 'right*3', 'a', 'a', 'down', 'a']);
  eq(r.value, 'コトハ', 'N14 おまかせ twice from ミーシャ (wraps to リーネ, then コトハ); ↓ from おまかせ lands on 決定');
  reset();

  // ------------------------------------------------------------ C: CharCreate helpers
  console.log('C  hero creation');
  const CC = R.CharCreate;
  const types = Object.keys(R.DB.heroTypes);
  eq(types, ['warrior', 'ranger', 'mage', 'spellblade', 'wanderer'], 'C1 five hero types in order');
  const sum = (o) => Object.values(o).reduce((a, l) => a + ({ S: 4, A: 3, B: 2, C: 1, D: 0 })[l], 0);
  const budgets = {};
  for (const t of types) {
    const opts = CC.favorOptions(t);
    ok(opts.length > 0, 'C2 ' + t + ' has favour options');
    for (const f of opts) {
      const a = CC.previewApt(t, f);
      const w = sum(a.w), e = sum(a.e);
      budgets[t] = budgets[t] || new Set();
      budgets[t].add(w + e);
      ok(w >= 15 && w <= 19 && e >= 8 && e <= 12 && (w + e === 26 || w + e === 27), 'C3 ' + t + '/' + f.id + ' budget ' + w + '/' + e, { w, e });
      ok(a[f.kind === 'weapon' ? 'w' : 'e'][f.id] === 'S', 'C4 ' + t + '/' + f.id + ' becomes S');
      const lines = CC.favorLines(t, f);
      ok(lines.length >= 4 && lines.every((l) => R.Text.approxWidth(l.parts.map((p) => p[0]).join('')) <= 142 * 1.4), 'C5 ' + t + '/' + f.id + ' right window lines fit', lines.map((l) => l.parts.map((p) => p[0]).join('')));
      const row = CC.heroRow(t, f);
      ok(row === 'front' || row === 'middle', 'C6 row ' + t + '/' + f.id);
    }
  }
  eq(CC.previewApt('mage', { kind: 'element', id: 'fire' }).e.wind, 'A', 'C7 mage: the paired element (fire↔wind) becomes A');
  eq(CC.previewApt('mage', { kind: 'element', id: 'earth' }).e.dark, 'A', 'C8 mage: earth↔dark');
  eq(CC.previewApt('spellblade', { kind: 'element', id: 'fire' }).e.wind, 'B', 'C9 spellblade has no pair element');
  eq([CC.heroRow('warrior', { kind: 'weapon', id: 'sword' }), CC.heroRow('mage', { kind: 'element', id: 'fire' }), CC.heroRow('ranger', { kind: 'weapon', id: 'bow' }),
    CC.heroRow('ranger', { kind: 'weapon', id: 'dagger' }), CC.heroRow('wanderer', { kind: 'element', id: 'light' }), CC.heroRow('wanderer', { kind: 'weapon', id: 'whip' })],
  ['front', 'middle', 'middle', 'front', 'middle', 'middle'], 'C10 rows: warrior front, mage middle, auto = reach / element');
  eq(CC.startActions('spellblade', { kind: 'weapon', id: 'katana' }), { techs: ['t_katana_draw'], spells: ['s_fire_1'] }, 'C11 spellblade weapon favour adds 火の矢');
  eq(CC.startActions('spellblade', { kind: 'element', id: 'water' }), { techs: ['t_sword_stepcut'], spells: ['s_water_1'] }, 'C12 spellblade element favour adds 踏み込み斬り');
  eq([CC.startWeapon('mage', { kind: 'element', id: 'dark' }), CC.startWeapon('wanderer', { kind: 'element', id: 'dark' }), CC.startWeapon('ranger', { kind: 'weapon', id: 'whip' })],
    ['w_staff_novice', 'w_dagger_iron', 'w_whip_leather'], 'C13 starting weapon: default by type or the favoured weapon');
  const ch = CC.changedKeys('mage', { kind: 'element', id: 'water' });
  ok(ch.has('e:water') && ch.has('e:light') && ch.size === 2, 'C14 changed letters = favour + pair', [...ch]);
  // LEAD_DECISIONS D8: the staff users start with 念じ打ち (t_staff_mind)
  eq(CC.startActions('mage', { kind: 'element', id: 'fire' }), { techs: ['t_staff_mind'], spells: ['s_fire_1'] }, 'C14b mage element favour adds 念じ打ち (D8)');
  {
    const mh = R.Rules.newChar({ id: 'hero', heroSpec: { name: 'テスト', gender: 'f', type: 'mage', favor: { kind: 'element', id: 'water' } } });
    ok(mh.techs.includes('t_staff_mind') && mh.equip.weapon1 === 'w_staff_novice', 'C14c a new mage hero knows t_staff_mind with a staff (D8)', mh.techs);
    for (const id of ['teo', 'ilse', 'morga', 'marta']) {
      const c = R.Rules.newChar({ id });
      ok(c.techs.includes('t_staff_mind') && c.equip.weapon1 === 'w_staff_novice', 'C14d ' + id + ' knows t_staff_mind at recruit (D8)', c.techs);
    }
  }

  // flow: 女 → 術剣士 → 属性 火 → name (おまかせ-default) → はい
  R.NGFixture.game();
  reset();
  r = await drive(() => CC.run({ cancel: false }), [
    'b', // step 1 with cancel:false: nothing
    'right,a', // 女
    'down*3,a', // 術剣士
    'down*5,a', // 武器 5 → 属性: 火 (the heading is skipped)
    async () => { ok(topName() === 'NameLayer', 'C15 the name step opens R.NameEntry', topName()); },
    'up,right,right,a', // 決定 with the default name
    async () => { ok(topName() === 'CreateLayer', 'C16 back to the confirm step', topName()); },
    'a', // はい
  ]);
  eq(r.value, { name: fNames[0], gender: 'f', type: 'spellblade', favor: { kind: 'element', id: 'fire' } }, 'C17 heroSpec after the five steps');
  reset();
  r = await drive(() => CC.run({ cancel: true }), ['a', 'b', 'b', 'b']);
  eq([r.done, r.value], [true, null], 'C18 cancel:true — B on the first step returns null');
  reset();
  // いいえ goes back to step 1, B goes back one step at a time, the name survives
  r = await drive(() => CC.run({ cancel: false }), [
    'a', 'a', 'a', // 男・戦士・剣
    'up,right,right,a', // name: アルン
    'right,a', // いいえ → step 1
    'right,a', 'down*2,a', 'a', // 女・術師・火
    async () => { ok(topName() === 'NameLayer', 'C19 name step again'); },
    'up,right,right,a',
    'a',
  ]);
  eq(r.value && [r.value.gender, r.value.type, r.value.favor.id, r.value.name], ['f', 'mage', 'fire', fNames[0]], 'C20 いいえ restarts; the default name follows the gender');
  reset();

  // ------------------------------------------------------------ T: tavern
  console.log('T  tavern');
  const TV = R.Tavern;
  R.NGFixture.game();
  const cand = R.Party.candidates();
  reset();
  r = await drive(() => TV.chooseStart({ count: 3, announce: true }), [
    'a', // master's advice
    'right*9,a', // brigitta (10th: row 1, column 10)
    'b', // B removes the last choice
    'a', // brigitta again
    'down,left,a', // marta (19th: ↓ keeps the column on row 2, ← one step)
    'left*8,a', // sylvain (11th: row 2, column 1) → 3 chosen → この3人と旅立ちますか？
    async () => { ok(topName() === 'ChoiceLayer', 'T1 the yes/no after three picks', topName()); },
    'a', // はい
    'a*6', // join lines (3 × 2)
  ], { settle: 90 });
  eq(r.value, ['brigitta', 'marta', 'sylvain'], 'T2 chooseStart returns the three ids in pick order');
  eq(R.Game.party.map((c) => c.id), ['hero', 'brigitta', 'marta', 'sylvain'], 'T3 chooseStart recruits them in pick order (ev.chooseCompanions then skips them)');
  ok(['brigitta', 'marta', 'sylvain'].every((id) => R.State.flag ? R.State.flag('joined_' + id) : R.Game.flags['joined_' + id]), 'T4 joined_<id> flags for the first three');
  // recruit:false only returns the ids; a 4th pick is refused; A on a chosen one un-picks it
  const g0 = R.Game;
  R.NGFixture.game();
  reset();
  r = await drive(() => TV.chooseStart({ count: 3, recruit: false, announce: false, advice: false }), ['a', 'right,a', 'right,a', 'down,a', 'right,a', 'left,a', 'right,a', 'a'], { settle: 20 });
  eq([r.value, R.Game.party.length], [['selma', 'hagen', 'basil'], 1], 'T5 recruit:false returns ids only; a 4th pick is refused, re-pressing un-picks');
  R.Game = g0;
  reset();
  // 仲間を探す → first unrecruited (selma) → はい → join lines → bench
  r = await drive(() => TV.open({ recruit: true }), [
    // the greeting stays open (noWait) under the command list
    async () => { ok(topName() === 'CommandLayer', 'T6 the command window opens', topName()); },
    'a', // 仲間を探す
    async () => { ok(topName() === 'ChooseLayer', 'T7 仲間を探す opens the roster', topName()); },
    'a', // selma
    'a', // はい
    'a*3', // joined / joinLine / 控えで待っている
    'b', // leave the roster
    'down*4,a', // やめる
    'a', // bye
  ], { settle: 60 });
  ok(r.done, 'T8 open() resolves after やめる');
  ok(R.Game.reserve.some((c) => c.id === 'selma'), 'T9 the recruit went to the reserve (party full)');
  ok(R.State.flag ? R.State.flag('joined_selma') : R.Game.flags.joined_selma, 'T10 joined_<id> flag');
  reset();

  // swap: brigitta ↔ selma; hero cannot be benched; order swap; 外す and 加える; row toggle
  r = await drive(() => TV.swapScreen(), [
    'down,a', 'a', // brigitta → 入れ替える
    'right,a', // selma
    'a', 'a', // leaveLine, rejoinLine
  ], { settle: 20 });
  eq(R.Game.party.map((c) => c.id).sort(), ['hero', 'marta', 'selma', 'sylvain'], 'T11 swap party ↔ reserve');
  ok(R.Game.reserve.some((c) => c.id === 'brigitta'), 'T12 the benched one is in the reserve');
  const sel = R.Game.party.find((c) => c.id === 'selma');
  ok(sel && sel.hp > 0 && sel.row === 'front', 'T13 the newcomer is healed with its data row');
  reset();
  const before = R.Game.party.map((c) => c.id);
  r = await drive(() => TV.swapScreen(), [
    'a', // hero → small window
    'down,a', // 外す (disabled for the hero → buzzer, window stays)
    'b', // close the window
    'b', // close the screen
  ], { settle: 10 });
  eq(R.Game.party.map((c) => c.id), before, 'T14 the hero cannot be 外す');
  reset();
  r = await drive(() => TV.swapScreen(), ['down,a', 'a', 'down,a', 'b'], { settle: 10 }); // order: party[1] ↔ party[2]
  eq(R.Game.party.map((c) => c.id), [before[0], before[2], before[1], before[3]], 'T15 two party members swap places');
  reset();
  const p2 = R.Game.party[3].id;
  r = await drive(() => TV.swapScreen(), ['down*3,a', 'down,a', 'a', 'b'], { settle: 10 }); // 外す the 4th
  ok(!R.Game.party.some((c) => c.id === p2) && R.Game.reserve.some((c) => c.id === p2) && R.Game.party.length === 3, 'T16 外す sends one to the reserve');
  reset();
  const ri = R.Game.reserve.findIndex((c) => c.id === p2);
  r = await drive(() => TV.swapScreen(), ['right', 'down*' + ri, 'a', 'down,a', 'a', 'b'].filter((s) => s !== 'down*0'), { settle: 10 }); // 加える
  ok(R.Game.party.length === 4 && R.Game.party[3].id === p2, 'T17 加える brings one back at the end', R.Game.party.map((c) => c.id));
  reset();
  const rowBefore = R.Game.party[1].row;
  r = await drive(() => TV.swapScreen(), ['down,a', 'down*2,a', 'b'], { settle: 10 }); // 隊列を変える
  ok(R.Game.party[1].row !== rowBefore, 'T18 隊列を変える toggles the row');
  reset();

  // deposit: the reserve member's equipment goes to the inventory
  const bench = R.Game.reserve.find((c) => Object.values(c.equip).some(Boolean));
  const gear = bench ? Object.values(bench.equip).filter(Boolean) : [];
  const inv0 = Object.assign({}, R.Game.inv);
  r = await drive(() => TV.deposit(), ['a', 'a', 'a'], { settle: 20 });
  ok(bench && Object.values(bench.equip).every((v) => !v), 'T19 装備をあずかる empties the reserve member', bench && bench.equip);
  ok(gear.every((id) => (R.Game.inv[id] || 0) > (inv0[id] || 0)), 'T20 the gear is in the inventory');
  reset();

  // browse until nobody is left
  const left = TV.unrecruited().length;
  const script = [];
  for (let i = 0; i < left; i++) script.push('a', 'a', 'a*3');
  script.push('a');
  r = await drive(() => TV.browse(), script, { settle: 120 });
  eq([TV.unrecruited().length, R.Game.party.length + R.Game.reserve.length], [0, 21], 'T21 every candidate can join (hero + 20)');
  reset();
  r = await drive(() => TV.open({ recruit: true }), ['a', 'a', 'down*4,a', 'a'], { settle: 40 }); // 仲間を探す with nobody left → line → やめる → bye
  ok(r.done, 'T22 仲間を探す with nobody left shows the master line and returns');
  reset();
  r = await drive(() => TV.open({ recruit: false }), [async () => { ok(topName() === 'CommandLayer' && top().list.items.length === 4, 'T23 the field-menu 仲間 has 4 commands', top() && top().list && top().list.items.map((i) => i.label)); }, 'down*3,a'], { settle: 20 });
  ok(r.done, 'T24 open({recruit:false}) closes with やめる');
  reset();

  // ------------------------------------------------------------ I: オーナー指示 — 特性（innate）は画面に出さない
  console.log('I  the innate trait is never on screen');
  // every string drawn during one render (Gfx.text / fitText)
  const drawn = () => {
    const out = [], G0 = R.Gfx, t0 = G0.text, f0 = G0.fitText;
    G0.text = function (str) { out.push(String(str)); return t0.apply(this, arguments); };
    G0.fitText = function (str) { out.push(String(str)); return f0.apply(this, arguments); };
    try { R.Engine.render(); } finally { G0.text = t0; G0.fitText = f0; }
    return out.join('\n');
  };
  const leaks = (txt) => Object.keys(R.DB.companions).filter((id) => {
    const d = R.DB.companions[id], inn = d.innate;
    // イルゼの肩書は特性と同じ「星読み」: the name only counts when it is not the title
    return (inn.name !== d.title && txt.includes(inn.name)) || txt.includes(inn.desc) || /個性|特性/.test(txt);
  });
  R.NGFixture.game();
  reset();
  const CL = new R.Tavern._ChooseLayer({ mode: 'start', count: 3 });
  CL.busy = true;
  R.Engine.push(CL);
  const bad = [], chart = [], shown = [];
  for (let i = 0; i < CL.ids.length; i++) {
    CL.cur = i;
    const d = R.DB.companions[CL.ids[i]];
    const txt = drawn();
    if (leaks(txt).length) bad.push(CL.ids[i]);
    if (/^武器$|^術$/m.test(txt)) chart.push(CL.ids[i]);
    const fav = R.Tavern.favored(d.apt);
    const want = [d.name, d.title, d.profile.split('\n')[0], '得意：'].concat(fav.slice(0, 2).map((f) => f[0]), R.CharCreate.kit.STATS.map((k) => String(d.stats[k])));
    if (!want.every((w) => txt.includes(w))) shown.push(CL.ids[i]);
  }
  eq(bad, [], 'I1 仲間を選ぶ: no candidate shows its trait name or effect');
  eq(chart, [], 'I2 仲間を選ぶ: no S〜D aptitude chart for candidates');
  eq(shown, [], 'I3 仲間を選ぶ: name, title, profile, 得意 (S first), and the six stats are shown on one page');
  ok(R.DB.companions.selma && R.Tavern.favored(R.DB.companions.selma.apt)[0].join() === '剣,#ffffff,S', 'I4 favored(): S before A (セルマ → 剣S)');
  reset();
  R.NGFixture.party(['brigitta', 'marta', 'sylvain'], { level: 20, reserve: ['selma', 'morga', 'titta'] });
  const SL = new R.Tavern._SwapLayer({});
  SL.busy = true;
  R.Engine.push(SL);
  const bad2 = [];
  for (let k = 0; k < R.Game.party.length; k++) { SL.side = 0; SL.ai = k; if (leaks(drawn()).length) bad2.push(R.Game.party[k].id); }
  for (let k = 0; k < R.Game.reserve.length; k++) { SL.side = 1; SL.ri = k; if (leaks(drawn()).length) bad2.push(R.Game.reserve[k].id); }
  eq(bad2, [], 'I5 入れ替える (party and reserve): no trait name or effect');
  reset();
  if (R.Menu && R.Menu.statusScreen) {
    const bad3 = [];
    const selma = R.Game.reserve.find((c) => c.id === 'selma');
    R.Game.party.push(selma); R.Game.reserve = R.Game.reserve.filter((c) => c !== selma);
    const p0 = R.Menu.statusScreen({ member: R.Game.party.length - 1 });
    await frames(3);
    const ST = top();
    const nP = ST && ST.pages ? ST.pages.length : 0;
    let resist = '';
    for (let i = 0; i < nP; i++) {
      ST.page = i;
      const txt = drawn();
      if (leaks(txt).length) bad3.push(ST.pages[i].kind);
      if (ST.pages[i].kind === 'resist') resist = txt;
    }
    ok(nP > 0, 'I6 強さ opens for a companion', topName());
    eq(bad3, [], 'I7 強さ: no page shows the trait name or effect');
    ok(resist && !/まひ|気絶/.test(resist), 'I8 強さ 耐性: セルマ\'s innate まひ・気絶 resistance is not listed (gear only)');
    reset();
    await Promise.race([p0, frames(2)]);
  }
  drawErrors = drawErrors.filter(Boolean);

  // ------------------------------------------------------------ K: オーナー指示 A15 — the pick grid moves by row / column
  console.log('K  the companion grid: up/down = rows, left/right = columns');
  {
    reset();
    const GL = new R.Tavern._ChooseLayer({ mode: 'browse' });
    GL.ids = Array.from({ length: 20 }, (_, i) => 'g' + i);
    const at = (cur, d) => { GL.cur = cur; GL.moveGrid(d); return GL.cur; };
    eq(at(0, 'down'), 10, 'K1 down from the top-left goes to the second row, same column');
    eq(at(13, 'up'), 3, 'K2 up from row 2 goes to row 1, same column');
    eq(at(3, 'up'), 13, 'K3 up from the top row wraps to the bottom row');
    eq(at(14, 'down'), 4, 'K4 down from the bottom row wraps to the top row');
    eq(at(0, 'right'), 1, 'K5 right steps one column');
    eq(at(9, 'right'), 0, 'K6 right at the row end wraps within the row');
    eq(at(10, 'left'), 19, 'K7 left at the row start wraps within the row');
    GL.ids = Array.from({ length: 13 }, (_, i) => 'g' + i);
    eq(at(8, 'down'), 12, 'K8 down onto a short last row clamps to its last figure');
    eq(at(11, 'right'), 12, 'K9 right on a short row');
    eq(at(12, 'right'), 10, 'K10 right wraps on the short row');
    const SL2 = new R.Tavern._ChooseLayer({ mode: 'start', count: 3 });
    R.Engine.push(SL2);
    await frames(2);
    const c0 = SL2.cur;
    await press('down');
    await frames(2);
    ok(SL2.ids.length <= 10 || SL2.cur === (c0 + 10) % (Math.ceil(SL2.ids.length / 10) * 10) || SL2.cur === Math.min(c0 + 10, SL2.ids.length - 1) || SL2.cur === c0 % 10,
      'K11 ↓ on the live pick-3 screen moves a row, not one to the right', { from: c0, to: SL2.cur });
    ok(SL2.cur !== c0 + 1, 'K12 ↓ never just steps right', { from: c0, to: SL2.cur });
    reset();
  }

  // ------------------------------------------------------------ S: title
  console.log('S  title');
  const calls = [];
  const saveField = R.Field;
  R.Field = Object.assign({}, R.Field || {}, { start: async (m, s) => { calls.push(['start', m, s]); }, resume: async () => { calls.push(['resume']); } });
  const saveList = R.Save.list;
  R.Save.list = async () => [null, null, null];
  R.Title.start();
  await frames(80);
  await press('a');
  await frames(4);
  ok(topName() === 'MenuLayer', 'S1 a button opens the menu', topName());
  const items = top() && top().list.items;
  eq(items && items.map((i) => i.label), ['はじめから', 'つづきから', '冒険の合言葉', '設定'], 'S2 title commands');
  ok(items && items[1].disabled === true, 'S3 つづきから is grey without saves');
  await press('b');
  await frames(2);
  ok(topName() === 'TitleLayer' && top().stage === 'press', 'S4 B returns to ボタンを押してください', topName());
  await press('a'); await frames(4);
  await press('a'); await frames(4); // はじめから → yes/no
  ok(topName() === 'ChoiceLayer', 'S5 はじめから asks 新しい冒険を始めますか？', topName());
  await press('a');
  for (let i = 0; i < 90 && !calls.length; i++) await frames(1);
  const st = (R.DB.config && R.DB.config.start) || {};
  eq(calls[0], ['start', st.map, st.spawn], 'S6 はじめから → R.State.newGame → R.Field.start(DB.config.start)');
  ok(R.Game && R.Game.party[0] && R.Game.party[0].id === 'hero', 'S7 a new game exists');
  R.Field = saveField; R.Save.list = saveList;
  R.Engine.fade(0, 0);
  reset();

  // ------------------------------------------------------------ D: every screen draws without errors
  console.log('D  draw pass');
  ok(drawErrors.length === 0, 'D1 no draw errors on any screen above', drawErrors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log(fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
  global.__done = true; process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
