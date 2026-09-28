#!/usr/bin/env node
// 体験版の出口のテスト（node）: node v2/tools/test_demo_end.js
//   1. 体験版の終わり: T1（story_t1）の後に R.Demo.end が走る（前置き・字幕・記録の案内・world_demo_end・オートの枠・計測）
//   2. 引き継ぎの記録: demo_clear の印と版、state で読み戻す往復、版が違うときの控え（carry）からの組み直し、壊れた物・1 行の文字
//   3. 製品版の差し込み口: 体験版では聞かない。製品版では聞いて引き継ぐ
//   4. 境: 行ける地方から行けない地方への出口・扉・階段に通せんぼ、峠の消える出口の写し、ワープの一覧
//   5. 計測: gtag が無ければ何もしない、あれば送る。名前（個人の情報）を送らない。節目のフラグ・ボスの勝ち・ダンジョン
'use strict';
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const DB = R.DB;
const clone = (o) => JSON.parse(JSON.stringify(o));

ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok('R.Demo・R.DemoCarry・R.DemoGate・R.Analytics がある', !!(R.Demo && R.Demo.end && R.DemoCarry && R.DemoGate && R.Analytics));
ok('体験版の設定（slice・sliceOpen）', DB.config.slice === true && Array.isArray(DB.config.sliceOpen));
R.Analytics._wire();

// ------------------------------------------------------------------ 1. 体験版の終わり
section('1. 体験版の終わり（T1 → R.Demo.end）');
function mkGame() {
  R.State.newGame({ seed: 4242 });
  const G = R.Game;
  R.State.setHero({ type: 'ranger', sex: 'f', name: 'リズ', fav: 'bow' });
  for (const id of ['selma', 'viola', 'marta', 'brigitta']) R.Party.join(id);
  G.gold = 1234;
  G.items = { i_salve: 5, i_potion: 3, k_chronicle: 1 };
  Object.assign(G.flags, { prologue_done: true, forest_start: true, forest_boss: true, forest_finale_done: true });
  G.cleared.r_forest = true; G.tier = 1; G.playMs = 3 * 3600e3 + 25 * 60e3;
  G.chars.hero.gl = 12.5; G.chars.selma.gl = 11.25;
  const loc = DB.locations.fern, m = DB.maps[loc.map], sp = R.MapUtil.spawn(m, loc.spawn);
  G.pos = { map: loc.map, x: sp.x, y: sp.y, dir: 's' };
  return G;
}
const G0 = mkGame();
R.Screens.open = async () => undefined; R.Screens.tip = async () => {};
const log = [];
const ev = Object.assign({}, R.Events.makeEv ? R.Events.makeEv({}) : {}, {
  say: async (who, t) => { log.push(['say', who, Array.isArray(t) ? t.join('/') : t]); },
  choose: async (labels) => { log.push(['choose', labels]); return 1; },
  caption: async (t) => { log.push(['caption', t]); },
  fade: async () => {}, wait: async () => {}, letter: async (id) => { log.push(['letter', id]); },
});
(async () => {
  const sent0 = R.Analytics.sent.length;
  await DB.events.story_t1.run(ev, {});
  const G = R.Game;
  ok('T1 の後に world_demo_end', !!G.flags.world_demo_end && !!G.flags.story_t1);
  ok('世界の中の前置き（地の文）→ 字幕「体験版は、ここまでです。」の順', (() => {
    const i = log.findIndex((l) => l[0] === 'say' && /峠のほう/.test(l[2]));
    const j = log.findIndex((l) => l[0] === 'caption' && /体験版は、ここまで/.test(l[1]));
    return i >= 0 && j > i;
  })(), log.map((l) => l[0] + ':' + String(l[2] || l[1]).slice(0, 12)));
  ok('記録の案内（記録する／あとで）', log.some((l) => l[0] === 'choose' && l[1].includes('記録する')));
  ok('文: 1 ページ 3 行・1 行 18 字まで', log.filter((l) => l[0] === 'say' || l[0] === 'caption').every((l) => { const s = String(l[2] || l[1]).replace(/リズ/g, 'ＸＸＸＸＸＸ'); const ls = s.split('\n'); return ls.length <= 3 && ls.every((x) => [...x].length <= 18); }));
  ok('再開で T1 をくり返さない（ev_story_t1 を記録の前に立てる）', !!G.flags.ev_story_t1);
  const auto = JSON.parse(R.Save._raw('auto') || 'null');
  ok('オートの枠に体験版の終わりの後が残る', !!(auto && auto.state && auto.state.flags.world_demo_end && auto.state.flags.ev_story_t1));
  ok('計測 demo_end_reached', R.Analytics.sent.slice(sent0).some((e) => e.name === 'demo_end_reached'));
  const n = log.length; await R.Demo.end(ev);
  ok('R.Demo.end は 1 回だけ', log.length === n);

  // ------------------------------------------------------------------ 2. 引き継ぎの記録
  section('2. 引き継ぎの記録（demo_clear）');
  const raw = R._localStorage[R.SAVE_PREFIX + 'demo_clear'];
  ok('置き場 luminous_chronicle_v2_demo_clear に書いた', typeof raw === 'string' && raw.length > 100);
  const rec = R.DemoCarry.find();
  ok('demo_clear の印・版・形の番号', !!(rec && rec.demo_clear === true && rec.kind === 'lc_demo_clear' && rec.fmt === 1 && rec.version === R.VERSION && rec.saveVer === R.Save.VER), rec && { v: rec.version, f: rec.fmt });
  ok('札: 遊んだ時間と章', rec.card.playMs === G0.playMs && rec.card.chapter === 1, rec.card);
  ok('控え: パーティ・成長・品・お金・フラグ', rec.carry.party.join() === G0.party.join() && rec.carry.chars.hero.gl === 12.5 && rec.carry.items.i_salve === 5 && rec.carry.gold === 1234 && rec.carry.flags.forest_boss === true);
  const before = clone(R.Game);
  R.Game = null;
  ok('state で読み戻す（同じ版）', R.DemoCarry.importRec(rec) === 'state');
  let g = R.Game;
  ok('往復: パーティ・控え・gl・品・お金・フラグ・位置が同じ',
    g.party.join() === before.party.join() && g.reserve.join() === before.reserve.join() && g.chars.hero.gl === before.chars.hero.gl && g.chars.selma.gl === before.chars.selma.gl &&
    JSON.stringify(g.items) === JSON.stringify(before.items) && g.gold === before.gold && g.flags.forest_finale_done && g.pos.map === before.pos.map,
    { party: g.party, gold: g.gold });
  ok('引き継ぎの印 demo_imported（元の版つき）', g.flags.demo_imported === true && g.flags.demo_imported_from === R.VERSION);
  ok('体験版の中で読んだときは world_demo_end を残す', !!g.flags.world_demo_end);
  // 版が違う（state が読めない）→ 控えから組み直す
  const rec2 = clone(rec); rec2.state.ver = 99; rec2.version = '9.9.9';
  rec2.carry.items.i_gone_forever = 4; rec2.carry.chars.hero.techs.push('t_no_such_tech'); rec2.carry.joined.push('nobody_here');
  R.Game = null;
  ok('state の版が違えば控え（carry）から', R.DemoCarry.importRec(rec2) === 'carry');
  g = R.Game;
  ok('組み直し: 主人公の名前・型・パーティの顔ぶれ', g.chars.hero.name === 'リズ' && g.chars.hero.type === 'ranger' && g.party.join() === before.party.join() && g.reserve.join() === before.reserve.join(), [g.party, g.reserve]);
  ok('組み直し: gl・装備・技を持ち越す', g.chars.hero.gl === 12.5 && g.chars.selma.gl === 11.25 && g.chars.hero.equip.weapon1 === before.chars.hero.equip.weapon1 && before.chars.hero.techs.every((t) => g.chars.hero.techs.includes(t)), [g.chars.hero.gl, g.chars.selma.gl]);
  ok('組み直し: 品・お金・フラグ・解決した地方', g.items.i_salve === 5 && g.items.k_chronicle === 1 && g.gold === 1234 && g.flags.forest_boss && g.cleared.r_forest && g.tier === 1);
  ok('組み直し: 今は無い id（品・技・仲間）は捨てる', !g.items.i_gone_forever && !g.chars.hero.techs.includes('t_no_such_tech') && !g.chars.nobody_here);
  ok('組み直し: HP が満タンで、始まりの場所がある', g.chars.hero.hp > 0 && !!(g.pos && g.pos.map && DB.maps[g.pos.map]));
  ok('組み直した R.Game が K.game を通る', R.Contract.check('game', g).ok, R.Contract.check('game', g).errors.slice(0, 3));
  // 壊れた物・形の違う物
  R._localStorage[R.SAVE_PREFIX + 'demo_clear'] = '{oops';
  ok('壊れた記録は null（止まらない）', R.DemoCarry.find() === null);
  R._localStorage[R.SAVE_PREFIX + 'demo_clear'] = JSON.stringify({ kind: 'lc_demo_clear', demo_clear: false });
  ok('demo_clear の印の無い物は null', R.DemoCarry.find() === null);
  ok('形の違う物は読まない', R.DemoCarry.importRec({ foo: 1 }) === false);
  // 1 行の文字
  const code = R.DemoCarry.exportCode(rec);
  ok('1 行の文字 LCD1-…', /^LCD1-[A-Za-z0-9_-]+-[0-9a-z]+$/.test(code || ''));
  ok('1 行の文字に state（丸ごと）は入れない（控えだけ。版に強い）', code.length < JSON.stringify(rec).length && (() => { const o = R.DemoCarry.importCode(code); return !!o && !o.state && !!o.carry; })(), [code.length, JSON.stringify(rec).length]);
  ok('1 行の文字の 1 字違いは読まない', R.DemoCarry.importCode(code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21)) === null);
  const back = R.DemoCarry.importCode(code);
  ok('1 行の文字から置き場へ戻す → 控えで組み直せる', !!back && R.DemoCarry.find() && R.DemoCarry.importRec(R.DemoCarry.find()) === 'carry' && R.Game.gold === 1234);
  // 置き場を元に戻す
  R._localStorage[R.SAVE_PREFIX + 'demo_clear'] = raw;

  // ------------------------------------------------------------------ 3. 製品版の差し込み口
  section('3. 製品版の差し込み口（R.DemoCarry.offer）');
  const Msg = R.UIK.Message, say0 = Msg.say;
  let asked = 0;
  Msg.say = async (o) => { asked++; asked === 1 && log.push(['offer', o.text]); return 0; };
  ok('体験版では聞かない', (await R.DemoCarry.offer()) === false && asked === 0);
  DB.config.slice = false;
  R.Game = null;
  ok('製品版: 記録があれば聞いて引き継ぐ', (await R.DemoCarry.offer()) === true && asked === 1 && !!R.Game && R.Game.flags.demo_imported);
  ok('製品版: 引き継いだ後は world_demo_end を消す', !R.Game.flags.world_demo_end);
  ok('聞く文が 3 行・1 行 18 字まで', (() => { const t = log.find((l) => l[0] === 'offer'); return t && t[1].split('\n').length <= 3 && t[1].split('\n').every((x) => [...x].length <= 18); })(), log.find((l) => l[0] === 'offer'));
  Msg.say = async () => 1;
  R.Game = null;
  ok('製品版:「新しく始める」なら読まない', (await R.DemoCarry.offer()) === false && R.Game === null);
  Msg.say = say0;
  DB.config.slice = true;

  // ------------------------------------------------------------------ 4. 境
  section('4. 体験版の境（R.DemoGate）');
  const DG = R.DemoGate, M = DB.maps;
  const leaks = [], gated = [];
  for (const [id, m] of Object.entries(M)) {
    if (/^stub_/.test(id) || !DG.isOpen(id)) continue;
    const look = (o, to, k) => { if (!o || !to || !M[to.map] || DG.isOpen(to.map)) return; (o.gate ? gated : leaks).push(id + ' ' + k + ' → ' + to.map); };
    for (const e of m.exits || []) look(e, e.to, 'exit');
    for (const o of m.objects || []) { if (o.type === 'building') look(o.door, o.door && o.door.to, 'door'); else look(o, o.to, o.type); }
  }
  ok('行ける地方から行けない地方への出口・扉・階段は全部 通せんぼ', leaks.length === 0, leaks);
  ok('通せんぼの数（ワールドの砂漠・雪原・湿原・灰の荒野への入口）', gated.length >= 20, gated.length);
  const R0 = R.Game; mkGame();
  const shut = R.Field._gateShut;
  const g1 = M.world.exits.find((e) => e.to.map === 'kasim');
  ok('通せんぼは体験版の間だけ閉じる（文「体験版では、ここから先へは行けません」）', !!shut && shut(g1.gate) === true && /体験版では、ここから先へは\n行けません/.test(g1.gate.text));
  DB.config.slice = false; ok('製品版（slice 偽）では開く', shut(g1.gate) === false); DB.config.slice = true;
  for (const [mid, to] of [['f_cross', 'f_cross_e'], ['f_south', 'f_south_s'], ['f_windhill', 'f_windhill_n']]) {
    const ex = (M[mid].exits || []).filter((e) => e.to && e.to.map === 'world' && e.to.spawn === to);
    const off = ex.find((e) => !e.demoMirror), mir = ex.find((e) => e.demoMirror);
    ok(`${mid}: 峠の消える出口に、体験版の間だけの写し（黙って何も起きない、を無くす）`, !!(off && mir && mir.x === off.x && mir.y === off.y && R.State.check(mir.cond) && !R.State.check(off.cond) && shut(mir.gate)));
    ok(`${mid}: 写しのマスで demo_boundary の行き先が分かる`, DG.at(mid, mir.x, mir.y) === 'world');
  }
  R.Game.warps = { fern: true, pharos: true, kasim: true, loch: true, yule: true, caldera: true };
  Object.assign(R.Game.flags, { prologue_done: true });
  const wl = R.Field.warpList().map((l) => l.id);
  ok('ワープの一覧: 行けない地方の場所を出さない', wl.includes('fern') && wl.includes('pharos') && !wl.some((id) => ['kasim', 'loch', 'yule', 'caldera'].includes(id)), wl);
  DB.config.slice = false;
  ok('ワープの一覧: 製品版ではそのまま', R.Field.warpList().some((l) => l.id === 'kasim'));
  DB.config.slice = true;

  // ------------------------------------------------------------------ 5. 計測
  section('5. 計測（R.Analytics）');
  const A = R.Analytics;
  ok('gtag が無ければ送らない（false）・止まらない', A.event('test_ping') === false);
  const calls = [];
  R._sandbox.gtag = (...a) => calls.push(a);
  ok('gtag があれば event を送る', A.event('test_ping', { x: 1 }) === true && calls.length === 1 && calls[0][0] === 'event' && calls[0][1] === 'test_ping');
  ok('共通の項目 game_ver・build・play_min', calls[0][2].game_ver === R.VERSION && calls[0][2].build === 'demo' && typeof calls[0][2].play_min === 'number');
  calls.length = 0;
  R.emit('flag', { id: 'prologue_done', v: true });
  R.emit('flag', { id: 'lo_some_lore', v: true });
  ok('節目のフラグで story_milestone（step つき）。ほかのフラグは送らない', calls.length === 1 && calls[0][1] === 'story_milestone' && calls[0][2].milestone === 'prologue_done' && calls[0][2].step === A.MILESTONES.indexOf('prologue_done') + 1, calls.map((c) => c[1]));
  calls.length = 0;
  R.emit('region:clear', { rid: 'r_forest', tier: 1 });
  R.emit('lead:add', { id: 'l_main_margin_1' });
  ok('地方の解決・手がかり（main）', calls.some((c) => c[1] === 'region_clear' && c[2].region === 'r_forest') && calls.some((c) => c[1] === 'objective_add' && c[2].lead_id === 'l_main_margin_1'));
  calls.length = 0;
  const elder = Object.values(M).find((m) => m.kind === 'dungeon' && m.location === 'elder');
  R.Game.pos = { map: elder.id, x: 1, y: 1, dir: 's' };
  R.emit('map:enter', { map: elder.id, from: 'f_fern' });
  R.emit('battle:start', { setup: { troop: 'tr_b_rooteater', boss: true } });
  R.emit('battle:end', { result: 'win' });
  ok('ダンジョンに入る・初めての戦闘・ボスの勝ち・ダンジョンの解決', ['dungeon_enter', 'first_battle', 'boss_win', 'dungeon_clear'].every((n) => calls.some((c) => c[1] === n)), calls.map((c) => c[1]));
  R.emit('battle:start', { setup: { troop: 'tr_b_rooteater', boss: true } });
  R.emit('battle:end', { result: 'win' });
  ok('初めての戦闘は旅ごとに 1 回', calls.filter((c) => c[1] === 'first_battle').length === 1);
  const Go = R.Battle && R.Battle._ && R.Battle._.gameover;
  ok('全滅の画面を包んだ（game_over）', !!(Go && Go.run && Go.run._an));
  ok('送った物に主人公の名前（個人の情報）が無い', !A.sent.some((e) => JSON.stringify(e).includes('リズ')));
  delete R._sandbox.gtag;
  R.Game = R0;
  done('test_demo_end');
})().catch((e) => { console.error(e); ok('例外なく流れる', false, String(e && e.stack || e)); done('test_demo_end'); });
