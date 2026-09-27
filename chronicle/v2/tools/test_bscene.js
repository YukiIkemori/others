#!/usr/bin/env node
// BSCENE（node）: R.Battle の形、効果の絵の登録、見本の戦闘の形と出来事、戦闘ボイス（A37）の鳴らし方の決まり。
//   node v2/tools/test_bscene.js
// ブラウザの確かめ（全種類の出来事・最短の表示時間・リピート・カーソル記憶・NEW・全滅の 3 択）は test_bscene_flow.js
'use strict';
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const load = require('./lib/load');

const R = load({ quiet: true, fixtures: true });
const C = R.Contract;
const _ = R.Battle._;

section('名前空間');
ok('R.Battle has the contract names', C.checkApi('Battle').ok, C.checkApi('Battle').errors);
ok('R.Battle is claimed (stub not installed)', !(R.Stubs.installed.Battle || []).length, R.Stubs.installed.Battle);
ok('internal parts are present', ['K', 'hud', 'layout', 'actors', 'cmd', 'target', 'play', 'glimmer', 'result', 'gameover', 'voice', 'demo'].every((k) => _[k]), Object.keys(_));
ok('minimum display times (A12, glimmer 0.9 s)', R.Battle.MIN.rareCard >= 1500 && R.Battle.MIN.rareCardSkip >= 600 && R.Battle.MIN.glimmerName >= 900);
ok('no load errors from BSCENE files', !R.loadErrors.some((e) => /systems\/battle|art\/fx/.test(e)), R.loadErrors.filter((e) => /battle|fx/.test(e)));

section('効果の絵 hd:bfx');
const fx = Object.keys(R.BFX.defs);
ok('effects defined (weapons, 7 elements, heal, status…)', ['slash', 'smash', 'thrust', 'shoot', 'claw', 'bite', 'hit', 'crit', 'cast', 'fire', 'ice', 'thunder', 'wind', 'earth', 'light', 'dark', 'heal', 'mp', 'revive', 'status', 'buff', 'debuff', 'summon', 'smoke', 'steal'].every((id) => fx.includes(id)), fx);
ok('every effect is registered as hd:bfx:<id>', fx.every((id) => R.Hd.has('hd:bfx:' + id)));
ok('hd:bfx kind is fx', R.Hd.kindOf('hd:bfx:slash') === 'fx');
ok('every effect is short (≤ 0.8 s) and has frames', fx.every((id) => R.BFX.dur(id) > 0 && R.BFX.dur(id) <= 800), fx.map((id) => [id, R.BFX.dur(id)]));

section('配置');
R.W = 960; R.H = 540; R.layout = 'wide'; R.uiScale = 1; R.safe = { l: 0, t: 0, r: 0, b: 0 };
let L = _.layout.compute();
const party = [0, 1, 2, 3].map((i) => ({ uid: 'p' + i, row: i < 2 ? 'front' : 'back' }));
const ps = _.layout.partySpots(L, party);
ok('16:9 party spots go top to bottom in party order (cards order)', ps.p0.y < ps.p1.y && ps.p1.y < ps.p2.y && ps.p2.y < ps.p3.y && ps.p0.x === _.layout.PARTY.wide.x0 && ps.p0.y === _.layout.PARTY.wide.y0, ps);
ok('back row is a step to the right of the front row line', (() => { const P = _.layout.PARTY.wide; const fx = (y) => P.x0 + (y - P.y0) * P.slope; return Math.abs(ps.p0.x - fx(ps.p0.y)) <= 1 && ps.p2.x - fx(ps.p2.y) >= 80 && ps.p3.x - fx(ps.p3.y) >= 80; })(), ps);
{ const mix = [{ uid: 'a', row: 'back' }, { uid: 'b', row: 'front' }, { uid: 'c', row: 'back' }, { uid: 'd', row: 'front' }]; const ms = _.layout.partySpots(L, mix);
  ok('mixed rows keep the party order top to bottom (order screen swap)', ms.a.y < ms.b.y && ms.b.y < ms.c.y && ms.c.y < ms.d.y && ms.a.x > ms.b.x - 1, ms); }
const foes = Array.from({ length: 8 }, (x, i) => ({ uid: 'e' + i, size: i === 0 ? 'l' : 's' }));
const es = _.layout.enemySpots(L, foes);
ok('enemies inside x 40〜420, y 320〜470', Object.values(es).every((p) => p.x >= 40 && p.x <= 420 && p.y >= 320 && p.y <= 470), es);
R.W = 540; R.H = 1169; R.layout = 'tall'; R.uiScale = 1.3;
L = _.layout.compute();
ok('tall: stage on the upper part, cards / commands / chips below', L.tall && L.stageH < R.H * 0.6 && L.cardsY < L.cmdY && L.cmdY < L.chipsY && L.chipsY < R.H, L);
const tp = _.layout.partySpots(L, party);
ok('tall: party inside the stage', Object.values(tp).every((p) => p.x > 0 && p.x < R.W && p.y < L.stageH), tp);
R.W = 960; R.H = 540; R.layout = 'wide'; R.uiScale = 1;

section('見本の戦闘（demo）の形');
R.Dev = R.Dev || null;
R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 1 });
for (const name of R.Battle._.demo.NAMES) {
  const B = _.demo.create({ demo: name, mons: [['x', 1]] });
  const cb = C.check('battle', B);
  const units = B.units.every((u) => C.check('unit', u).ok);
  const opts = B.options('p0');
  const optOk = opts.every((o) => C.check('option', o).ok);
  let evOk = true, bad = null, rounds = 0, types = new Set();
  for (const u of B.units) if (u.side === 'party') B.submit(u.uid, { cmd: 'attack', id: 'attack', target: null });
  while (!B.over && rounds < 6) {
    rounds++;
    for (const e of B.round()) { types.add(e.t); const r = C.check('battleEvent', e); if (!r.ok) { evOk = false; bad = [e, r.errors]; } }
  }
  const rw = B.finish();
  ok(`demo ${name}: battle/unit/option/event shapes`, cb.ok && units && optOk && evOk && (B.over !== 'win' || C.check('rewards', rw).ok), { cb: cb.errors, bad });
  if (name === 'all') ok('demo all: every BATTLE_EVENTS kind appears', Object.keys(C.BATTLE_EVENTS).every((t) => types.has(t)), Object.keys(C.BATTLE_EVENTS).filter((t) => !types.has(t)));
}

section('戦闘ボイス（A37）');
const V = _.voice;
const sand = R._sandbox;
sand.RPG_MEDIA = { voice: {} };
const clip = (id) => { sand.RPG_MEDIA.voice[id] = 'voice/' + id + '.ogg'; };
['b_selma_attack_1', 'b_selma_attack_2', 'b_selma_bigtech_1', 'b_selma_hurt_1', 'b_selma_ko_1', 'b_selma_victory_1', 'b_selma_spell_1',
  'v_hero_m_attack_1', 'v_hero_m_glimmer_1', 'v_hero_f_glimmer_1', 'v_hero_f_attack_1'].forEach(clip);
const played = [];
R.Audio.playVoice = (id) => { played.push(id); return { id }; };
R.Audio.stopVoice = () => {};
const selma = { id: 'selma', uid: 'p1', look: 'selma' };
const heroM = { id: 'hero', uid: 'p0', look: 'hero_m_warrior' };
const heroF = { id: 'hero', uid: 'p0', look: 'hero_f_mage' };
const fixed = (x) => ({ next: () => x, pick: (a) => a[0] });
ok('companion prefix b_<id>_<kind>_', V.prefix(selma, 'attack') === 'b_selma_attack_');
R.Game.chars.hero.sex = undefined;
ok('hero prefix from the look (m / f)', V.prefix(heroM, 'attack') === 'v_hero_m_attack_' && V.prefix(heroF, 'glimmer') === 'v_hero_f_glimmer_');
ok('clips found from RPG_MEDIA', V.clips('b_selma_attack_').length === 2);
ok('no clip → no-op, no error', V.play({ id: 'noela', uid: 'p3' }, 'attack', { force: true }) === null && V.log[V.log.length - 1].why === 'no-clip');
ok('attack plays about 1/3 (rng < 1/3 plays)', V.play(selma, 'attack', { rng: fixed(0.1) }) !== null);
ok('attack skipped when rng > 1/3', V.play(selma, 'attack', { rng: fixed(0.9) }) === null);
ok('big technique always plays', V.play(selma, 'bigtech', { rng: fixed(0.99) }) === 'b_selma_bigtech_1');
ok('glimmer: companion falls back to bigtech', V.play(selma, 'glimmer', { rng: fixed(0.99) }) === 'b_selma_bigtech_1');
ok('glimmer: hero uses v_hero_<g>_glimmer', V.play(heroM, 'glimmer', { rng: fixed(0) }) === 'v_hero_m_glimmer_1' && V.play(heroF, 'glimmer', { rng: fixed(0) }) === 'v_hero_f_glimmer_1');
ok('at ×2 speed only short shouts (spell skipped)', V.play(selma, 'spell', { speed: 2 }) === null && V.log[V.log.length - 1].why === 'speed');
ok('at ×2 speed attack still plays', V.play(selma, 'attack', { speed: 2, rng: fixed(0) }) !== null);
ok('no immediate repeat of the same clip', (() => { const a = V.play(selma, 'attack', { force: true, rng: fixed(0) }); const b = V.play(selma, 'attack', { force: true, rng: fixed(0) }); return a && b && a !== b; })());
R.Settings.get = ((orig) => (k) => (k === 'battleVoice' ? 'big' : orig(k)))(R.Settings.get);
ok('setting "big": attack never plays, bigtech plays', V.play(selma, 'attack', { force: true }) === null && V.play(selma, 'bigtech') !== null);
R.Settings.get = ((orig) => (k) => (k === 'battleVoice' ? 'off' : orig(k)))(R.Settings.get);
ok('setting "off": nothing plays', V.play(selma, 'bigtech') === null && V.play(selma, 'victory', { force: true }) === null);
ok('isBig: skill with mp ≥ 8 or data big', (() => { R.DB.techs = R.DB.techs || {}; R.DB.techs.__t1 = { name: 'x', mp: 9 }; R.DB.techs.__t2 = { name: 'y', mp: 2 }; return V.isBig('skill', '__t1') && !V.isBig('skill', '__t2') && !V.isBig('attack', 'attack'); })());

section('勝利の報酬の言葉（A17）');
ok('proficiency names only (剣・火)', _.result.profName('sword') === '剣' && _.result.profName('fire') === '火');
const src = ['scene', 'hud', 'command', 'result', 'gameover', 'playback'].map((f) => require('fs').readFileSync(path.join(__dirname, '..', 'src', 'systems', 'battle', f + '.js'), 'utf8')).join('\n').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok('no forbidden words shown (Lv・経験値・オート戦闘・WP)', !/['"`][^'"`]*(Lv|経験値|次のレベル|オート戦闘|WP)[^'"`]*['"`]/.test(src));

section('動きを柔らかく（2026-09-27）');
{
  const E = _.play.EASE;
  ok('easing curves start at 0 and end at 1 (out, inOut, back, in)', ['out', 'out3', 'in', 'inOut', 'back'].every((k) => Math.abs(E[k](0)) < 1e-9 && Math.abs(E[k](1) - 1) < 1e-9));
  ok('ease back overshoots a little (recoil settles back)', Math.max(...[0.6, 0.7, 0.8, 0.9].map(E.back)) > 1);
  const sh = { poses: { idle: [0], slash: [1], slash8: [2, 3, 4, 5, 6, 7, 8, 9] }, fps: { slash: 11, slash8: 20 }, frames: [] };
  const pl = _.actors.poseList(sh, { side: 'party', wtype: 'sword' }, {}, 'slash');
  ok('a sheet with <pose>8 frames uses them (art agent naming), else the old pose', pl.key === 'slash8' && pl.list.length === 8 && pl.fps === 20 && _.actors.poseList(sh, { side: 'party' }, {}, 'idle').key === 'idle', pl);
  const fst = { speed: () => 1 }; const sp = (n) => { fst.speed = () => n; fst.hitstopUntil = 0; const t0 = R.Engine.time; _.play.hitstop(fst); return fst.hitstopUntil - t0; };
  ok('hitstop 40–60 ms, shorter at ＋1/＋2', sp(1) >= 40 && sp(1) <= 60 && sp(2) < sp(1) && sp(3) < sp(2), [sp(1), sp(2), sp(3)]);
}

section('リピートの持ち越し（BattleCore.seedRepeat）');
{
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 5 });
  const Bc = R.BattleCore.create({ troop: 'tr_stub' });
  const heroUid = Bc.units.find((u) => u.side === 'party' && u.id === 'hero').uid;
  ok('seedRepeat takes {charId: {type, id}} and offers repeat from round 1', Bc.seedRepeat({ hero: { type: 'tech', id: '__no_such_tech' } }) && Bc.partyOptions().includes('repeat'));
  Bc.setRepeat(true);
  const evs = Bc.round();
  const act = evs.find((e) => e.t === 'act' && e.uid === heroUid);
  ok('an invalid carried command falls back to a plain attack (target auto-picked)', act && act.cmd === 'attack', act);
  const lc = Bc.lastCommands();
  ok('lastCommands() gives {charId: {type, id}} for the next battle', lc && lc.hero && lc.hero.type === 'attack', lc);
}

section('人の札は隊列の順（前列・後列で分けない。2026-09-27 の持ち主の報告）');
(async () => {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 3 });
  for (const id of ['hagen', 'sylvain', 'noela']) { try { R.Party.join(id); } catch (e) { /* 仲間が無いデータ */ } }
  const G = R.Game;
  const want = ['hagen', 'hero', 'sylvain', 'noela'].filter((id) => G.chars[id]);
  G.party = want.slice();
  const rows = { hagen: 'front', hero: 'back', sylvain: 'back', noela: 'front' };
  for (const id of want) G.chars[id].row = rows[id];
  // 持ち主の手順: 酒場で選んだ直後に 並びと隊列（order.js）で入れ替える → R.Party.setOrder・setRow
  if (want.length === 4) { R.Party.setOrder([want[1], want[0], want[3], want[2]]); R.Party.setRow(want[2], 'front'); }
  R.W = 960; R.H = 540; R.layout = 'wide'; R.uiScale = 1; R.safe = { l: 0, t: 0, r: 0, b: 0 };
  const err = console.error; console.error = () => {};
  R.Battle.start({ troop: 'tr_stub' });
  for (let i = 0; i < 200 && !(R.Battle.debug() && R.Battle.debug().phase === 'input'); i++) { R.Engine.advance(50); await new Promise((r) => setImmediate(r)); }
  console.error = err;
  const st = R.Battle.debug();
  const cards = st ? st.partyUnits().map((u) => u.id) : null;
  ok('cards follow the party order even with mixed rows (hagen front, hero back, sylvain back, noela front)', st && JSON.stringify(cards) === JSON.stringify(R.Party.members().map((c) => c.id)), { cards, members: R.Party.members().map((c) => c.id + ':' + c.row) });
  ok('sprites stand top to bottom in the same order as the cards (order screen → battle)', st && (() => { const ys = st.partyUnits().map((u) => st.actor(u.uid).y); return ys.every((y, i) => i === 0 || y > ys[i - 1]); })(), st && st.partyUnits().map((u) => u.id + '@' + st.actor(u.uid).x + ',' + st.actor(u.uid).y));
  ok('one card rect per member, top to bottom in that order', st && _.hud.partyRects(st).every((r, i, a) => i === 0 || r.y > a[i - 1].y) && _.hud.partyRects(st).length === cards.length);
  const pp = st && R.Battle.prompts(st);
  ok('bottom-right prompts carry the speed 「速さ：通常」 (no separate chip)', pp && pp.list.some((p) => p.btn === 'r' && p.label === '速さ：' + R.Battle.speedLabel(R.Settings.get('battleSpeed'))), pp && pp.list);
  if (st) { st.B.setRepeat(true); const p2 = R.Battle.prompts(st); ok('repeat running → 「リピート中：[B]でやめる」 in the prompts', p2.repeatOn && p2.list[0].btn === 'b' && p2.list[0].label === 'でやめる', p2.list); st.B.setRepeat(false); }
  done('test_bscene');
})();
