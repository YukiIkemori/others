#!/usr/bin/env node
// テスト用メニュー（src/tester/）の node のテスト
//   node v2/tools/test_tester.js
// 1. 有効にする道（?tester=1 → localStorage に覚える、?tester=0 で戻す）・ビルドの --release で外れること
// 2. 無効なら何も変わらない: src/tester/ を読まない版（製品版と同じ）と、読んだが無効の版（切り替えの値だけ入れておく）で、
//    戦闘・出現・成長・熟練度・閃き・1 歩の時間が同じ
// 3. 有効にして、切り替えとボタンが本物の処理の中で効くこと（エンカウントなし・経験値・熟練度・お金・無敵・一撃・逃げる・
//    移動速度・閃き・全回復・状態異常・お金・道具・レベル・ワープ・TEST の印）
'use strict';
const path = require('path');
const fs = require('fs');
const { ok, section, done } = require('./lib/testkit');
const load = require('./lib/load');
const { order } = require('./build.js');

const CHEATS = { noEnc: true, invincible: true, onehit: true, flee: true, speed: 2, reveal: true, exp: 20, prof: 20, gold: 10, glim: 10 };
const STORE_KEY = 'luminous_chronicle_v2_tester';

function newGame(R, extra) {
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 11 });
  for (const id of extra || []) R.Party.join(id);
  R.Party.restoreAll();
  return R.Game;
}
const copy = (o) => JSON.parse(JSON.stringify(o));
/** 決まった条件の頭だけの戦闘の要約（比べる用） */
function battleSummary(R, o) {
  const s = R.BattleCore.simulate(Object.assign({ party: R.Party.members(), mons: [['rat_1', 2]], lv: 3, seed: 'tester', rewards: true }, o));
  return { result: s.result, rounds: s.rounds, taken: s.damageTaken, dealt: s.damageDealt, gold: s.gold, prof: s.profUps.map((p) => p.id + p.rank), glim: s.glimmers.length, party: s.party.map((c) => [c.hp, c.mp, c.wprof, c.eprof]) };
}
function encounterRun(R) {
  const out = [];
  for (let s = 0; s < 400; s++) { const r = R.Mon.encounter('zw_prologue', { steps: s, tier: 0 }); out.push(r ? r.mons.map((m) => m.join ? m.join(':') : String(m)).join(',') : '-'); }
  return out.join('|');
}
function growthRun(R) {
  newGame(R, ['selma']);
  const G = R.Game, out = [];
  for (let i = 0; i < 4; i++) {
    const rows = R.Growth.afterBattle(G.party, G.reserve, { E: 12, Lb: 12, killed: [{}], rng: R.Mon.mkRng('g' + i) });
    out.push(rows.length);
  }
  return { rows: out.join(','), gl: G.party.map((id) => G.chars[id].gl) };
}
function profRun(R) {
  newGame(R);
  const c = R.Game.chars[R.Game.party[0]];
  for (let i = 0; i < 20; i++) R.Rules.train(c, { kind: 'attack', actionId: 'attack', tier: 0 });
  return copy(c.wprof);
}
function glimChance(R) {
  newGame(R);
  const c = R.Game.chars[R.Game.party[0]];
  const ids = Object.keys(R.DB.techs).filter((id) => R.DB.techs[id].glim).slice(0, 5);
  return ids.map((id) => R.Glimmer.chance(c, id, { rankB: 3, ef: 1, tier: 0 }));
}
const adv = (R, ms) => R.Engine.advance(ms);
async function flush() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
async function settle(R, ms) { for (let t = 0; t < (ms || 400); t += 50) { adv(R, 50); await flush(); } }
/** 暗転（Engine.time で進む）を含む Promise を、時間を進めながら待つ */
async function run(R, p) { let fin = false; p.then(() => { fin = true; }, () => { fin = true; }); for (let i = 0; i < 400 && !fin; i++) { adv(R, 50); await flush(); } return fin; }
/** 町で右へ 1 歩 → その歩の時間（ms） */
async function stepMs(R) {
  newGame(R);
  const S = R.Field._s;
  await run(R, R.Field.enter('roa', 'gate', { fade: 0, noAutosave: true }));
  await settle(R, 100);
  let got = null;
  for (const [b, dx, dy] of [['right', 1, 0], ['left', -1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    R.Input._set(b, true);
    for (let t = 0; t < 50 && !S.mv; t += 16.67) { adv(R, 16.67); await flush(); }
    R.Input._set(b, false);
    if (S.mv) { got = S.mv.ms; break; }
    void dx; void dy;
  }
  for (let i = 0; i < 60 && (S.mv || S.arriving); i++) { adv(R, 16.67); await flush(); }
  await settle(R, 60);
  return got;
}

(async () => {
  // ---------------------------------------------------------------- 1. 有効にする道・ビルド
  section('有効にする道（?tester=1 / 0）と --release');
  {
    const R = load({ quiet: true });
    ok('R.Tester exists in the default build order', !!R.Tester && !!R.Tester.Menu);
    ok('disabled by default (no URL flag, empty storage)', R.Tester.enabled === false && R.Tester.on === false && !R.Tester._installed);
    ok('mul / opt return the neutral values while disabled', R.Tester.mul('exp') === 1 && R.Tester.mul('gold') === 1 && R.Tester.opt('noEnc') === false && R.Tester.moveMul() === 1);
    const R1 = load({ quiet: true, globals: { location: { search: '?tester=1' } } });
    ok('?tester=1 enables it', R1.Tester.enabled === true);
    ok('?tester=1 is remembered in localStorage', JSON.parse(R1._localStorage[STORE_KEY] || '{}').on === true);
    ok('enabled but nothing toggled → no TEST badge (on === false)', R1.Tester.on === false);
    R1.Tester.set('exp', 20);
    ok('a toggle turns the TEST state on', R1.Tester.on === true && R1.Tester.mul('exp') === 20);
    ok('values outside the list are ignored', R1.Tester.set('exp', 7) === 20 && R1.Tester.set('nope', 1) === undefined);
    R1.Tester.enable(false);
    ok('enable(false) → neutral again (values kept for later)', R1.Tester.on === false && R1.Tester.mul('exp') === 1 && R1.Tester.opts.exp === 20);
    const R2 = load({ quiet: true, globals: { location: { search: '?tester=0' } } });
    ok('?tester=0 disables it', R2.Tester.enabled === false && JSON.parse(R2._localStorage[STORE_KEY] || '{}').on === false);
    const names = order().map((f) => path.relative(path.join(__dirname, '..', 'src'), f));
    ok('tester files load after screens and before main.js', names.includes('tester/tester.js') && names.indexOf('tester/tester.js') < names.indexOf('tester/tester_menu.js') &&
      names.indexOf('tester/tester.js') > names.findIndex((n) => n.startsWith('screens/')) && names[names.length - 1] === 'main.js');
    ok('order({tester:false}) has no tester files (--release / --no-tester)', !order({ tester: false }).some((f) => f.includes(path.sep + 'tester' + path.sep)));
    const R3 = load({ quiet: true, tester: false });
    ok('without src/tester/ the game still loads (R.Tester undefined, no load errors)', R3.Tester === undefined && R3._nodeLoadErrors.length === 0, R3._nodeLoadErrors);
    const bsrc = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
    ok('build.js documents --release and --no-tester', /--release/.test(bsrc) && /--no-tester/.test(bsrc));
    ok('tester screen is not in R.Screens (SCREEN_IDS unchanged)', !(R.Screens._defs || {}).tester);
  }

  // ---------------------------------------------------------------- 2. 無効なら何も変わらない
  section('フラグが無ければ何も変わらない（製品版と同じ結果）');
  {
    const Rp = load({ quiet: true, tester: false });   // 製品版（src/tester/ なし）
    const Rd = load({ quiet: true });                  // テスト版・無効（切り替えは全部入れてある）
    Object.assign(Rd.Tester.opts, CHEATS);
    ok('disabled tester with every cheat stored → still neutral', !Rd.Tester.enabled && !Rd.Tester.on && Rd.Tester.mul('exp') === 1 && !Rd.Tester.noEncounter());
    newGame(Rp, ['selma']); newGame(Rd, ['selma']);
    ok('battle (damage, rounds, gold, prof) is identical', JSON.stringify(battleSummary(Rp)) === JSON.stringify(battleSummary(Rd)));
    newGame(Rp, ['selma']); newGame(Rd, ['selma']);
    const bp = battleSummary(Rp, { mons: [['orc_3', 1]], lv: 30 }), bd = battleSummary(Rd, { mons: [['orc_3', 1]], lv: 30 });
    ok('a hard battle is identical too', JSON.stringify(bp) === JSON.stringify(bd));
    newGame(Rp); newGame(Rd);
    ok('random encounters are identical over 400 steps', encounterRun(Rp) === encounterRun(Rd));
    ok('growth after battles is identical', JSON.stringify(growthRun(Rp)) === JSON.stringify(growthRun(Rd)));
    ok('proficiency gain is identical', JSON.stringify(profRun(Rp)) === JSON.stringify(profRun(Rd)));
    ok('glimmer chances are identical', JSON.stringify(glimChance(Rp)) === JSON.stringify(glimChance(Rd)));
    const mp = await stepMs(Rp), md = await stepMs(Rd);
    ok('one field step takes the same time', mp != null && mp === md, { mp, md });
    newGame(Rd);
    Rd.Tester.stamp(); Rd.Tester._tick();
    ok('no TEST mark on the game while disabled', !Rd.Game.testerUsed);
    ok('save card has no test key when unused', Rd.Save.save('s1') !== false && !('test' in (Rd.Save.cards().find((e) => e.slot === 's1').card || {})));
  }

  // ---------------------------------------------------------------- 3. 有効にして効き目
  section('切り替えの効き目（本物の処理の中）');
  const R = load({ quiet: true, globals: { location: { search: '?tester=1' } } });
  const T = R.Tester;
  const Rp = load({ quiet: true, tester: false });
  ok('enabled', T.enabled);

  // エンカウントなし
  newGame(R);
  const base = encounterRun(R);
  T.set('noEnc', true);
  const none = encounterRun(R);
  ok('noEnc: R.Mon.encounter returns null on every step', base.split('|').some((x) => x !== '-') && none.split('|').every((x) => x === '-'));
  ok('noEnc: even the forced (lure) roll is suppressed', R.Mon.encounter('zw_prologue', { steps: 999, tier: 0, force: true }) === null);
  ok('noEnc: scripted battles still run (troop setup)', (() => { const s = R.BattleCore.simulate({ party: R.Party.members(), troop: Object.keys(R.DB.troops)[0], seed: 'tr', maxRounds: 1 }); return s.result !== 'none'; })());
  T.set('noEnc', false);

  // お金
  newGame(Rp, ['selma']);
  const g1 = battleSummary(Rp).gold;
  T.set('gold', 10);
  newGame(R, ['selma']);
  const g10 = battleSummary(R).gold;
  ok('gold ×10: battle gold is 10× (engine computeRewards)', g1 > 0 && g10 === Math.round(g1 * 10), { g1, g10 });
  T.set('gold', 1);

  // 熟練度
  const p1 = profRun(Rp);
  T.set('prof', 5);
  const p5 = profRun(R);
  const w = Object.keys(p1).find((k) => p1[k] > 0);
  ok('prof ×5: R.Rules.train adds more points', w && p5[w] > p1[w] * 2, { w, p1: p1[w], p5: p5[w] });
  T.set('prof', 1);

  // 経験値（成長）
  const e1 = growthRun(Rp);
  T.set('exp', 20);
  const e20 = growthRun(R);
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  ok('exp ×20: growth (gl) after 4 battles is far larger', sum(e20.gl) - 2 > (sum(e1.gl) - 2) * 3, { e1: e1.gl, e20: e20.gl });
  T.set('exp', 1);

  // 閃き
  const c1 = glimChance(Rp);
  T.set('glim', 10);
  const c10 = glimChance(R);
  ok('glim ×10: R.Glimmer.chance is ×10 (capped at 1)', c1.every((p, i) => Math.abs(c10[i] - Math.min(1, p * 10)) < 1e-9) && c1.some((p) => p > 0), { c1, c10 });
  T.set('glim', 1);

  // 無敵・一撃・逃げる
  newGame(R, ['selma']);
  T.set('invincible', true);
  const hard = battleSummary(R, { mons: [['orc_3', 3]], lv: 40, maxRounds: 6 });
  ok('invincible: the party takes no damage from a strong group', hard.taken === 0 && hard.party.every((p) => p[0] > 0), hard);
  T.set('invincible', false);
  newGame(R, ['selma']);
  const noInv = battleSummary(R, { mons: [['orc_3', 3]], lv: 40, maxRounds: 6 });
  ok('(control) without invincible the same group hurts', noInv.taken > 0);
  T.set('onehit', true);
  T.set('invincible', true);   // 先に倒されないように（一撃だけを見る）
  newGame(R);
  const boss = Object.keys(R.DB.troops).find((k) => R.DB.troops[k].noEscape && (R.DB.troops[k].mons || []).some((m) => /^b_/.test(m[0]))) || null;
  const oh = R.BattleCore.simulate({ party: R.Party.members(), mons: [['orc_3', 1]], lv: 60, seed: 'oh', maxRounds: 3 });
  ok('onehit: a lv 60 enemy falls in the first round', oh.result === 'win' && oh.rounds === 1, { r: oh.result, n: oh.rounds });
  if (boss) {
    const ob = R.BattleCore.simulate({ party: R.Party.members(), troop: boss, seed: 'ohb', maxRounds: 8 });
    ok('onehit: boss troop ' + boss + ' goes down quickly', ob.result === 'win' && ob.rounds <= 4, { r: ob.result, n: ob.rounds });
  }
  T.set('onehit', false);
  T.set('invincible', false);
  newGame(R);
  T.set('flee', true);
  const eng = new R.BattleCore.Engine({ party: R.Party.members().map(copy), mons: ['rat_1'], tier: 0, lv: 40, inv: {}, rng: R.Mon.mkRng('fl') });
  eng.escapeChance = () => 0;   // 普通なら必ず失敗する
  for (const e of eng.tryEscape(false)) void e;
  ok('flee: escape succeeds even at 0 % chance', eng.result === 'escape');
  const eng2 = new R.BattleCore.Engine({ party: R.Party.members().map(copy), mons: ['rat_1'], tier: 0, lv: 1, inv: {}, rng: R.Mon.mkRng('fl'), noEscape: true });
  for (const e of eng2.tryEscape(false)) void e;
  ok('flee: no-escape battles stay no-escape', eng2.result !== 'escape');
  T.set('flee', false);

  // 移動速度
  const ms1 = await stepMs(R);
  T.set('speed', 2);
  const ms2 = await stepMs(R);
  ok('speed ×2: one field step takes half the time (F._step)', ms1 > 0 && Math.abs(ms2 - ms1 / 2) < 1e-6, { ms1, ms2 });
  T.set('speed', 1);

  section('ボタン');
  newGame(R, ['selma']);
  const G = R.Game;
  const [a, b] = R.Party.members();
  a.hp = 0; a.status = ['poison']; b.mp = 0; b.status = ['sleep'];
  T.cure();
  ok('cure: statuses cleared (HP stays)', a.status.length === 0 && b.status.length === 0 && a.hp === 0);
  T.healAll();
  const st = (c) => R.Rules.stats(c);
  ok('healAll: HP/MP full and the fallen revived', R.Party.all().every((c) => c.hp === st(c).maxHp && c.mp === st(c).maxMp && c.hp > 0));
  G.gold = 5;
  T.addGold(10000);
  ok('+10000G', G.gold === 10005);
  T.goldMax();
  ok('gold MAX = K.MAX_GOLD (9,999,999)', G.gold === R.Rules.K.MAX_GOLD && G.gold === 9999999);
  T.addGold(10000);
  ok('gold never goes over the cap', G.gold === 9999999);
  ok('UIK.num formats the max gold', R.UIK.num(G.gold) === '9,999,999');
  const n = T.items99();
  const uses = Object.keys(R.DB.items).filter((id) => R.DB.items[id].slot === 'use' && !R.DB.items[id].hidden);
  ok('items ×99: every usable item is 99, nothing else', n > 10 && uses.every((id) => G.items[id] === 99) && Object.keys(G.items).every((id) => R.DB.items[id].slot === 'use'), n);
  const gl0 = a.gl, hp0 = st(a).maxHp;
  T.levelUp(1);
  ok('level +1: gl +1 and max HP grows', Math.abs(a.gl - (Math.floor(gl0) + 1)) < 1e-9 && st(a).maxHp > hp0);
  T.levelUp(10);
  ok('level +10: gl +10 more', Math.abs(a.gl - (Math.floor(gl0) + 11)) < 1e-9);
  T.levelUp(500);
  ok('level is capped at glMax', a.gl === R.Rules.K.GROW.glMax);
  ok('buttons stamp the game as tested', G.testerUsed === true);
  R.Save.save('s2');
  ok('save card of a tested game carries test: true', (R.Save.cards().find((e) => e.slot === 's2').card || {}).test === true);
  ok('the save still loads', R.Save.load('s2') && R.Game.testerUsed === true);

  section('ワープ');
  const list = T.warpList();
  const locked = Object.keys(R.DB.regions).filter((k) => R.DB.regions[k].slice === 'locked');
  ok('warp list has towns, dungeons and field areas', ['town', 'dungeon', 'field'].every((k) => list.some((w) => w.kind === k)), list.length);
  ok('warp list has no locked-region maps and no interiors', list.every((w) => !locked.includes(w.region) && R.DB.maps[w.map].kind !== 'interior'));
  ok('every warp spawn exists on its map', list.every((w) => !w.spawn || (R.DB.maps[w.map].spawns || {})[w.spawn]));
  R.Engine.clear();
  newGame(R);
  ok('cannot warp before the field is up', !T.canWarp());
  await run(R, R.Field.enter('roa', 'gate', { fade: 0, noAutosave: true }));
  await settle(R, 100);
  ok('can warp from the field', T.canWarp());
  const dest = list.find((w) => w.kind === 'dungeon') || list[0];
  ok('warp → ' + dest.map, (await run(R, T.warp(dest.map, dest.spawn))) && R.Field._s.map.id === dest.map && R.Game.pos.map === dest.map);
  const fld = list.find((w) => w.kind === 'field');
  if (fld) ok('warp → field area ' + fld.map, (await run(R, T.warp(fld.map, fld.spawn))) && R.Field._s.map.id === fld.map);

  section('メニューの場面');
  ok('menu opens on the field', T.Menu.open() && R.Engine.top().id === 'tester');
  adv(R, 300);
  ok('menu starts on the toggles tab', T.Menu.state().tab === 0 && T.Menu.state().rows.includes('noEnc'));
  R.Input._set('right', true); adv(R, 17); R.Input._set('right', false); adv(R, 17);
  ok('→ on the first row turns エンカウントなし on', T.opts.noEnc === true);
  R.Input._set('r', true); adv(R, 17); R.Input._set('r', false); adv(R, 17);
  ok('R → 実行 tab', T.Menu.state().tab === 1);
  T.Menu.close(); await settle(R, 400);
  ok('menu closes back to the field', R.Engine.top().id === 'field');
  T.reset();
  ok('reset clears every toggle', !T.on);

  done('test_tester');
})().catch((e) => { console.error(e); process.exit(2); });
