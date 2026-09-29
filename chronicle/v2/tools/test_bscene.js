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
// 呼び出しで増えたお供（2026-09-28 の持ち主の報告「新しく敵が召喚した雑魚は当たり判定がおかしい」）: ボス＋お供 7 体でも重ならず枠の中
const clashOf = (spots, us) => { const bad = []; for (let i = 0; i < us.length; i++) for (let j = i + 1; j < us.length; j++) { const a = us[i], b = us[j], p = spots[a.uid], q = spots[b.uid], fa = _.layout.foot(a), fb = _.layout.foot(b); if (Math.abs(p.x - q.x) < fa[0] + fb[0] && Math.abs(p.y - q.y) < fa[1] + fb[1]) bad.push([a.uid, b.uid]); } return bad; };
{
  const us = [{ uid: 'b', boss: true, size: 'l' }].concat(Array.from({ length: 7 }, (x, i) => ({ uid: 'w' + i, size: 's' })));
  const sp = _.layout.enemySpots(L, us);
  ok('boss + 7 adds: no two feet overlap', !clashOf(sp, us).length, clashOf(sp, us));
  ok('boss + 7 adds: all inside x 40〜420, y 320〜470', Object.values(sp).every((p) => p.x >= 40 && p.x <= 420 && p.y >= 320 && p.y <= 470), sp);
  const taken = [{ x: sp.b.x, y: sp.b.y, boss: true, size: 'l' }, { x: sp.w0.x, y: sp.w0.y, size: 's' }];
  const f = _.layout.freeSpot(L, taken, { size: 's' });
  ok('freeSpot keeps off the boss sprite (was foes[0], right on top of the boss)', Math.abs(f.x - sp.b.x) >= 98 || Math.abs(f.y - sp.b.y) >= 52, f);
  const crowd = Array.from({ length: 14 }, (x, i) => ({ uid: 'c' + i, size: 's' }));
  const cs = _.layout.enemySpots(L, crowd);
  ok('14 small foes: still inside the stage and each spot distinct', Object.values(cs).every((p) => p.x >= 40 && p.x <= 420 && p.y >= 320 && p.y <= 470) && new Set(Object.values(cs).map((p) => p.x + ',' + p.y)).size === 14, cs);
}
R.W = 540; R.H = 1169; R.layout = 'tall'; R.uiScale = 1.3;
L = _.layout.compute();
ok('tall: stage on the upper part, cards / commands / chips below', L.tall && L.stageH < R.H * 0.6 && L.cardsY < L.cmdY && L.cmdY < L.chipsY && L.chipsY < R.H, L);
const tp = _.layout.partySpots(L, party);
ok('tall: party inside the stage', Object.values(tp).every((p) => p.x > 0 && p.x < R.W && p.y < L.stageH), tp);
{
  const us = [{ uid: 'b', boss: true, size: 'l' }].concat(Array.from({ length: 6 }, (x, i) => ({ uid: 'w' + i, size: 's' })));
  const sp = _.layout.enemySpots(L, us);
  ok('tall: boss + 6 adds inside the stage, no overlap', !clashOf(sp, us).length && Object.values(sp).every((p) => p.x > 0 && p.x < R.W * 0.6 && p.y < L.stageH), sp);
}
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
// 画面の文は文の表（i18n）にあるので、R.T('key') を日本語の文に戻してから確かめる
const src = require('./lib/i18n_src').inline(['scene', 'hud', 'command', 'result', 'gameover', 'playback'].map((f) => require('fs').readFileSync(path.join(__dirname, '..', 'src', 'systems', 'battle', f + '.js'), 'utf8')).join('\n')).replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
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
  // MP はその行動の始まりで（act の mp）
  {
    const c = R.Game.chars.hero;
    const tech = Object.keys(R.DB.techs).find((id) => { const t = R.DB.techs[id]; return t.kind === 'tech' && t.wtype === (c.equip && c.equip.weapon1 && R.DB.items[c.equip.weapon1] ? R.DB.items[c.equip.weapon1].wtype : 'sword') && (t.mp || 0) > 0; });
    if (tech && !(c.techs || []).includes(tech)) c.techs = (c.techs || []).concat([tech]);
    c.mp = c.maxMp || c.mp || 30;
    const B2 = R.BattleCore.create({ troop: 'tr_stub' });
    const hu = B2.units.find((u) => u.side === 'party' && u.id === 'hero');
    const opt = (B2.options(hu.uid).find((o) => o.cmd === 'skill') || { list: [] }).list.find((x) => x.usable);
    if (opt) {
      for (const u of B2.units) if (u.side === 'party') B2.submit(u.uid, u === hu ? { cmd: 'skill', id: opt.id, target: B2.units.find((x) => x.side === 'enemy').uid } : { cmd: 'defend' });
      const ev2 = B2.round();
      const a2 = ev2.find((e) => e.t === 'act' && e.uid === hu.uid);
      ok('act events carry the MP paid (so the card drops at the start of the action)', a2 && a2.cmd === 'skill' && a2.mp === opt.mp && opt.mp > 0, { a2, cost: opt.mp });
      // 描き方: act の演出で札の MP が減り始める（ラウンドの終わりを待たない）
      const st = { clock: 0, vis: { [hu.uid]: { mp: 50 } }, tweens: [], speed: () => 1, unit: () => ({ side: 'party', name: 'x', wtype: 'sword', id: 'hero' }), actor: () => ({ x: 0, y: 0 }), head: null, pwait: () => Promise.resolve(), vrng: null, L: {} };
      const H = _.play._H;
      if (H) { H.act(st, { t: 'act', uid: hu.uid, cmd: 'skill', id: opt.id, mp: 7, targets: [] }, {}).catch(() => {}); for (let i = 0; i < 30; i++) { st.clock += 16; _.play.tick(st, 16); } }
      ok('the card MP ticks down to (MP − cost) during the action start', H && Math.round(st.vis[hu.uid].mp) === 43, H ? st.vis[hu.uid].mp : 'no _H');
    } else ok('a usable tech for the MP test', false, { tech });
  }
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
  if (st) { st.B.setRepeat(true); const p2 = R.Battle.prompts(st); ok('repeat running → 「リピート中：[L]でやめる」 in the prompts', p2.repeatOn && p2.list[0].btn === 'l' && p2.list[0].label === 'でやめる', p2.list); st.B.setRepeat(false); }

  // 派生技の帯（design/BACKLOG「派生技の閃き」。持ち主「何かの技を使ってたらその上位版を覚えるの」）:
  // 閃きの帯を使い「〇〇から、」「△△を編み出した！」。行動の後に出て、速さ 1 / 2 / 3 / 5 で短くなる
  section('派生技の帯: 「〇〇から、△△を編み出した！」、速いほど短い');
  const ms = {}, seen = {};
  for (const sp of [1, 2, 3, 5]) {
    const fst = { speed: () => sp, unit: () => null, dead: false, log: [], dim: 0 };
    let fin = false;
    const t0 = R.Engine.time;
    _.glimmer.play(fst, { t: 'glimmer', uid: 'p0', kind: 'tech', id: 't_sword_swallow', name: '返し刃', from: 't_sword_twin', fromName: '連ね斬り' }).then(() => { fin = true; });
    for (let i = 0; i < 400 && !fin; i++) {
      R.Engine.advance(10); _.glimmer.tick(fst);
      if (fst.banner && !seen[sp]) seen[sp] = { head: fst.banner.head, name: fst.banner.name };
      await new Promise((r) => setImmediate(r));
    }
    ms[sp] = fin ? R.Engine.time - t0 : Infinity;
    if (sp === 1) ok('banner wording: 「連ね斬りから、」 + 「返し刃を編み出した！」', seen[1] && seen[1].head === '連ね斬りから、' && seen[1].name === '返し刃を編み出した！', seen[1]);
    ok(`speed ${sp}: the banner clears and the dim returns to 0`, fin && !fst.banner && fst.dim === 0 && fst.log.some((l) => l.t === 'derive-name'));
  }
  ok('shorter at higher battle speed (1 > 2 > 3 > 5)', ms[1] > ms[2] && ms[2] > ms[3] && ms[3] > ms[5], ms);
  ok('brief: ≤ 1.6 s at 1, ≤ 0.5 s at 5 (the 0.9 s glimmer minimum does not apply)', ms[1] <= 1600 && ms[5] <= 500, ms);
  // 蘇生のねらい（オーナー 2026-09-28「よみがえりの花で敵しか選べない」）: ally_dead は倒れた味方だけ、いなければ一覧へ戻る
  section('ねらい: ally_dead は倒れた味方だけ');
  {
    const acts = [{ uid: 'p0', side: 'party', name: 'A', x: 800, y: 300 }, { uid: 'p1', side: 'party', name: 'B', x: 800, y: 340 }, { uid: 'p2', side: 'party', name: 'C', x: 800, y: 380 }, { uid: 'e0', side: 'enemy', name: 'E', x: 200, y: 300 }];
    const mk = (dead) => ({ actors: acts, vis: { p0: { alive: true }, p1: { alive: !dead.includes('p1') }, p2: { alive: !dead.includes('p2') }, e0: { alive: true } }, aliveEnemies: () => [acts[3]], head: null, L: {} });
    const u = acts[0];
    const s1 = mk(['p2']);
    _.target.pick(s1, u, 'ally_dead', { row: { cmd: 'item', id: 'i_phoenix', label: 'よみがえりの花' }, mem: { ally: 'p0', target: 'e0' } });
    ok('ally_dead: cursor on the first dead ally (memory ignored)', JSON.stringify(Object.keys(s1.hot || {})) === '["p2"]' && /よみがえりの花 → C/.test(s1.head.sub), [s1.hot, s1.head]);
    const s2 = mk([]);
    const back = await _.target.pick(s2, u, 'ally_dead', { row: { cmd: 'item', id: 'i_phoenix' }, mem: {} });
    ok('ally_dead with nobody down → back (no enemy cursor)', back === 'back' && !s2.hot);
    const s3 = mk(['p1']);
    _.target.pick(s3, u, 'ally', { row: { cmd: 'item', id: 'i_potion' }, mem: {} });
    ok('ally (potion): living allies only, starts on self', JSON.stringify(Object.keys(s3.hot || {})) === '["p0"]');
    const s4 = mk(['p1']);
    _.target.pick(s4, u, 'party', { row: { cmd: 'spell', id: 's_earth_light_dark' }, mem: {} });
    ok('party (revive all): whole party lit, dead included', Object.keys(s4.hot || {}).sort().join() === 'p0,p1,p2');
    ok('TARGET_JA names ally_dead', _.cmd.TARGET_JA.ally_dead === '倒れた味方ひとりに');
  }
  // 呼び出し → 退却（2026-09-28 の持ち主の報告: 狼の群れ頭が呼んだ狼に文字が無い・退却しても残る、呼ばれた雑魚の当たりがおかしい）
  section('呼び出し: 森の狼の群れ頭・根食らい（場面）');
  const summonRun = async (troop, want) => {
    R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 3 });
    for (const id of ['hagen', 'sylvain', 'noela']) { try { R.Party.join(id); } catch (e) { /* 仲間が無いデータ */ } }
    R.W = 960; R.H = 540; R.layout = 'wide'; R.uiScale = 1; R.safe = { l: 0, t: 0, r: 0, b: 0 };
    const err = console.error; console.error = () => {};
    let res = null, mid = null;
    R.Battle.start({ troop, autoInput: true }).then((r) => { res = r; });
    for (let i = 0; i < 20000; i++) {
      R.Engine.advance(50); await new Promise((r) => setImmediate(r));
      const st = R.Battle.debug();
      if (!st || !st.B) { if (res) break; continue; }
      const E = st.B.engine;
      const boss = E.mons.find((m) => m.boss && m.d.bossType !== 'add');
      if (!st.t_god) { st.t_god = 1; E.party.forEach((p) => { p.hp = 99999; }); E.mons.forEach((m) => { m.hp = m.mhp = 99999; }); if (troop === 'tr_b_rooteater') E.mons[0].hp = 1; }
      const summoned = E.mons.filter((m) => m.summoned).length;
      if (!mid && summoned < want && st.phase === 'input' && boss && !boss.reserved) boss.reserved = { id: troop === 'tr_b_rooteater' ? 'eb_call_roots' : 'eb_pack_howl', round: -1 };
      if (!mid && summoned >= want && st.phase === 'input') {
        const foes = st.actors.filter((a) => a.side === 'enemy' && !(st.vis[a.uid].gone >= 1));
        mid = {
          foes: foes.map((a) => ({ uid: a.uid, name: a.name, x: a.x, y: a.y, size: a.size, boss: a.boss, real: !!st.B.units.find((u) => u.uid === a.uid) })),
          alive: st.aliveEnemies().map((a) => a.uid).sort().join(), engAlive: st.B.units.filter((u) => u.side === 'enemy' && u.alive).map((u) => u.uid).sort().join(),
          names: foes.map((a) => [a.name, (st.unit(a.uid) || {}).name]),
          hits: foes.filter((a) => !a.boss).map((a) => { const h = _.target.hitAt(st, st.aliveEnemies(), { x: a.x, y: a.y - 8 }); return [a.uid, h && h.uid]; }),
          attack: st.partyUnits().every((u) => (st.B.options(u.uid)[0] || {}).cmd === 'attack'),
        };
        // 頭を先にねらう（自動の攻撃は ねらえる敵の最初）
        boss.hp = 1;
        if (troop === 'tr_b_rooteater') E.mons.forEach((x) => { if (x.alive) x.hp = 1; });   // 根食らいのお供は頭が倒れても残る（逃げない）
        const orig = st.aliveEnemies;
        st.aliveEnemies = () => orig().sort((a, b) => (b.uid === boss.uid ? 1 : 0) - (a.uid === boss.uid ? 1 : 0));
      }
      if (st.phase === 'result' && !st.t_res) st.t_res = i;
      if (st.t_res && i - st.t_res === 60) {
        const left = st.actors.filter((a) => a.side === 'enemy' && !(st.vis[a.uid].gone >= 1)).map((a) => a.uid);
        // 勝利の札を閉じる（A を押して離す）
        for (let j = 0; j < 400 && !res; j++) { R.Input._set('a', j % 4 === 0); R.Engine.advance(50); await new Promise((r) => setImmediate(r)); }
        R.Input._set('a', false);
        console.error = err;
        return { mid, left, over: st.B.over, res: res && res.result };
      }
    }
    console.error = err;
    return { mid, left: null, over: null, res };
  };
  {
    const w = await summonRun('tr_a21_forest_wolves', 3); 
    const m = w.mid || { foes: [], names: [], hits: [] };
    const wolves = m.foes.filter((a) => /群れの狼/.test(a.name));
    ok('wolves: 2 + 3 summoned wolves on screen, every one a real unit (no stand-in sum_<n>)', wolves.length === 5 && m.foes.every((a) => a.real && !/^sum_/.test(a.uid)), m.foes);
    ok('wolves: every wolf lettered and unique (Ａ〜Ｅ), label = the core name', new Set(wolves.map((a) => a.name)).size === 5 && wolves.every((a) => /[Ａ-Ｚ]$/.test(a.name)) && m.names.every(([a, b]) => a === b), m.names);
    ok('wolves: targets = the living enemies in the core', m.alive && m.alive === m.engAlive, [m.alive, m.engAlive]);
    ok('wolves: tapping each wolf picks that wolf', m.hits.length === 5 && m.hits.every(([a, b]) => a === b), m.hits);
    ok('wolves: attack is offered to everyone', m.attack === true);
    ok('wolves: positions inside the stage, no overlap', !clashOf(Object.fromEntries(m.foes.map((a) => [a.uid, a])), m.foes).length && m.foes.every((a) => a.x >= 40 && a.x <= 420 && a.y >= 320 && a.y <= 470), m.foes);
    ok('wolves: leader down → pack flees, nothing left on screen, victory closes as a win', w.over === 'win' && w.left && !w.left.length && w.res === 'win', w);
  }
  {
    const t = await summonRun('tr_b_rooteater', 1);
    const m = t.mid || { foes: [], hits: [] };
    const roots = m.foes.filter((a) => /根の触手/.test(a.name));
    // 根は本体と合わせて 3 まで: 根Ａを倒した後に呼ぶ → 見えているのは 根Ｂ と 新しい 根Ｃ
    ok('roots: after root Ａ falls a new tentacle comes, all real and lettered uniquely (Ｂ・Ｃ)', roots.length === 2 && m.foes.every((a) => a.real) && roots.map((a) => a.name).sort().join() === '根の触手Ｂ,根の触手Ｃ', m.foes);
    ok('roots: the new tentacle is not on top of the tree eater (tap picks it)', m.hits.every(([a, b]) => a === b) && !clashOf(Object.fromEntries(m.foes.map((a) => [a.uid, a])), m.foes).length, [m.hits, m.foes]);
    ok('roots: targets = the living enemies in the core', m.alive && m.alive === m.engAlive, [m.alive, m.engAlive]);
    ok('roots: all down → result screen, every tentacle removed', t.over === 'win' && t.left && !t.left.length && t.res === 'win', t);
  }
  done('test_bscene');
})();
