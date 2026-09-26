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
ok('16:9 party spots are the MODERN_UI §2.3 values', ps.p0.x === 575 && ps.p0.y === 338 && ps.p1.x === 616 && ps.p2.x === 668 && ps.p3.x === 726, ps);
ok('back row is a step behind (x larger)', ps.p2.x > ps.p0.x && ps.p3.x > ps.p1.x);
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
const src = ['scene', 'hud', 'command', 'result', 'gameover', 'playback'].map((f) => require('fs').readFileSync(path.join(__dirname, '..', 'src', 'systems', 'battle', f + '.js'), 'utf8')).join('\n');
ok('no forbidden words shown (Lv・経験値・オート戦闘・WP)', !/['"`][^'"`]*(Lv|経験値|次のレベル|オート戦闘|WP)[^'"`]*['"`]/.test(src));

done('test_bscene');
