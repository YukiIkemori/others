#!/usr/bin/env node
// 終盤の演出と人物の関係の作り直し（テスター 2026-10-04 報告 4 の R11・R17・R23・§7・§9）のテスト（node）。
//   node v2/tools/test_story_staging.js
//   1 R11: 負けても続く戦い（canLose）に負けたら、倒れた人が起きている（ev.battle の床・ev.heal）。ロウェルの 2 戦目に負けると
//          暗転 →「起き上がれなかった」→ 全快 → 町の人の手当て の順で、全員 HP・MP が満ちる
//   2 R17: イベントの中の ev.clearRegion は光の柱だけで、章の札はイベントの終わり（年代記の選択の後）。8 地方とも、
//          地方を解くイベントから年代記の選択（ch_<rs>_write）へ meta.calls でつながる（同じイベントの中で選ぶ）
//   3 R23: 終盤のロアでベルナが朝の席を話し（final_seat_told）、エンディングで朝の席の場面（ベルナが歩く → 光 → 布 → 杯 → 間 → 台詞 → 字幕）
//   4 §9: 終盤のロアの順（ロウェルの生い立ち・くべられなかった手紙・{hero}の生い立ち・アルノ・幼いベルナとフィーネ）、ビブリアのノア、
//          5 階の二十年前の夜（日継ぎの戦・代理試合・ミラとリオナ・白の書のささやき）、エンディングのラザロとロウェル
//   5 §9 の 8: イェナがファロスの桟橋に来て一緒に渡り、ビブリアの像のそばにいて、エンディングで名乗る
//   6 ボイスの行は前と同じ（足した行は声なし）
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const T = (k) => R.T(k);
D.config.slice = false;   // 製品版の筋（体験版の錠は T2 から先を止める）
if (R.MapUtil && R.MapUtil.invalidate) R.MapUtil.invalidate();

function newGame() {
  R.Screens.tip = async () => {}; R.Screens.open = async () => undefined;
  R.Events.night = async (o) => { if (o && o.onDark) o.onDark(); };
  R.State.newGame({ seed: 7 });
  R.State.setHero({ type: 'mage', sex: 'f', name: 'リーネ', fav: 'staff' });
  for (const id of Object.keys(D.companions).slice(0, 3)) { try { R.Party.join(id); } catch (e) { /* */ } }
  if (R.Flow) R.Flow.title = () => {};
  return R.Game;
}
// 真似の ev（会話・字幕・暗転は記録だけ。戦い・全快・旗は本物）
const LOG = [];
function mkEv(ctx, o) {
  o = o || {};
  const real = R.Events.makeEv(ctx || {});
  const ev = Object.assign({}, real, {
    say: async (who, t, op) => { LOG.push({ k: 'say', who, t: String(t), voice: op && op.voice }); },
    choose: async (labels) => { LOG.push({ k: 'choose', labels }); return o.choose || 0; },
    caption: async (t) => { LOG.push({ k: 'caption', t: String(t) }); },
    fade: async (d) => { LOG.push({ k: 'fade', d }); }, wait: async () => {},
    letter: async (id) => { LOG.push({ k: 'letter', id }); },
    warp: async (map, sp) => { LOG.push({ k: 'warp', map, sp }); R.Game.pos = { map, x: 0, y: 0, dir: 's' }; },
    appear: async () => {}, leave: async () => {}, camera: async () => {},
    npc: () => ({ move: async () => {}, face: async () => {}, act: async () => {}, hide: async () => {}, show: async () => {}, setPos: async () => {} }),
    bgm: () => {}, sfx: () => {}, mapBgm: () => {}, jingle: async () => {},
    rest: () => { LOG.push({ k: 'rest' }); real.rest(); },
    battle: o.battle || (async () => 'win'),
    call: (id, args) => { const c = Object.assign({}, ctx, args); return D.events[id].run(mkEv(c, o), c); },
  });
  return ev;
}
const run = async (id, ctx, o) => { LOG.length = 0; await D.events[id].run(mkEv(ctx || {}, o), ctx || {}); return LOG.slice(); };
const idx = (log, key) => log.findIndex((e) => e.t === T(key));
const has = (log, key) => idx(log, key) >= 0;
const inOrder = (log, keys) => { let p = -1; for (const k of keys) { const i = log.findIndex((e, j) => j > p && e.t === T(k)); if (i < 0) return k; p = i; } return true; };

(async function () {
  // ================================================================ 1 R11
  section('1. R11 負けても続く戦いの後');
  {
    newGame();
    const mem = R.Party.members();
    ok('一行がいる（主人公と仲間）', mem.length >= 2, mem.length);
    const st0 = R.Battle && R.Battle.start;
    R.Battle.start = async () => { for (const c of R.Party.members()) { c.hp = 0; c.mp = 0; } return { result: 'lose' }; };
    const ev = R.Events.makeEv({});
    const r = await ev.battle({ troop: 'tr_b_rowell2', canLose: true });
    ok('canLose で負けたら \'lose\' が返る', r === 'lose');
    ok('ev.battle の後、倒れた人はいない（HP 1 以上）', R.Party.members().every((c) => c.hp >= 1), R.Party.members().map((c) => c.hp));
    for (const c of R.Party.members()) { c.hp = 0; c.mp = 0; }
    ev.heal();
    ok('ev.heal は倒れた人も起こして HP・MP を満たす', R.Party.members().every((c) => { const s = R.Rules.stats(c); return c.hp === s.maxHp && c.mp === s.maxMp; }));
    // ロウェルの 2 戦目に負ける（story_t5）
    newGame();
    R.Game.flags.story_t4 = true;
    R.Game.tier = 5; R.Game.pendingTier = 5;
    const log = await run('story_t5', { map: 'dovan', reason: 'inn' }, { battle: async () => { for (const c of R.Party.members()) { c.hp = 0; c.mp = 0; c.status = ['poison']; } return 'lose'; } });
    ok('負けた後: 暗転 →「起き上がれなかった」→ 全快 → 町の人の手当て の順', inOrder(log, ['events.story_t5.run.say_5', 'ev.story_00_tiers.recover.caption', 'events.story_t5.run.narr_3']) === true &&
      log.findIndex((e) => e.k === 'rest') > idx(log, 'events.story_t5.run.say_5') && log.some((e) => e.k === 'fade' && e.d === 'out'));
    ok('負けた後: 全員の HP・MP が満ち、状態も消える（町を HP0 で歩かない）', R.Party.members().every((c) => { const s = R.Rules.stats(c); return c.hp === s.maxHp && c.mp === s.maxMp && !(c.status || []).length; }),
      R.Party.members().map((c) => [c.hp, c.mp, c.status]));
    ok('話はそのまま続く（ベルナの手紙二通と封書）', log.filter((e) => e.k === 'letter').length === 2 && R.Game.items.k_berna_sealed === 1 && R.Game.flags.story_t5);
    // ロウェルの 1 戦目（story_t2）も同じ
    newGame();
    R.Game.flags.story_t1 = true; R.Game.tier = 2; R.Game.pendingTier = 2;
    const log2 = await run('story_t2', { map: 'kasim', reason: 'inn' }, { battle: async () => { for (const c of R.Party.members()) c.hp = 0; return 'lose'; } });
    ok('1 戦目に負けても、全快して町の人の手当て', has(log2, 'ev.story_00_tiers.recover.caption') && R.Party.members().every((c) => c.hp === R.Rules.stats(c).maxHp));
    if (st0) R.Battle.start = st0;
    // ほかの負けても続く戦い: 序章の練習（ev.heal）・闘技場（ev.rest）
    const SRC = fs.readdirSync(path.join(V2, 'src', 'events')).map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n');
    const lose = [...SRC.matchAll(/canLose:\s*true/g)].length;
    ok('負けても続く戦いは 5 か所（序章の練習・ロウェル 2・闘技場 2）。どれも負けの後に起こす（ev.battle の床）', lose === 5, lose);
  }

  // ================================================================ 2 R17
  section('2. R17 章の札は年代記の選択の後');
  {
    newGame();
    const calls = [];
    const cel = R.Tier.celebrate;
    R.Tier.celebrate = async (rid, o) => { calls.push(['celebrate', rid, o && o.card === false ? 'pillar' : o && o.cardOnly ? 'card' : 'full']); };
    R.def('events', 'zz_clear_test', { run: async (ev) => { await ev.clearRegion('r_forest'); calls.push(['choice']); }, meta: { needs: [], gives: [] } });
    await R.Events.run('zz_clear_test', {});
    ok('イベントの中: 光の柱 → 年代記の選択 → 章の札（イベントの終わり）', JSON.stringify(calls) === JSON.stringify([['celebrate', 'r_forest', 'pillar'], ['choice'], ['celebrate', 'r_forest', 'card']]), calls);
    calls.length = 0;
    await R.Events.makeEv({}).clearRegion('r_desert');
    ok('イベントの外から呼ぶと、今まで通り続けて出す', JSON.stringify(calls) === JSON.stringify([['celebrate', 'r_desert', 'full']]), calls);
    R.Tier.celebrate = cel;
    delete D.events.zz_clear_test;
    // 8 地方: 地方を解くイベント → meta.calls → 年代記の選択
    const reach = (id, seen) => { seen = seen || new Set(); if (seen.has(id) || !D.events[id]) return seen; seen.add(id); for (const c of (D.events[id].meta || {}).calls || []) reach(c, seen); return seen; };
    const bad = [];
    for (const rs of ['forest', 'desert', 'snow', 'marsh', 'isles', 'mine', 'ash', 'star']) {
      const clr = Object.keys(D.events).filter((id) => ((D.events[id].meta || {}).gives || []).includes('region:r_' + rs) && /clearRegion/.test(String(D.events[id].run)));
      const okOne = clr.some((id) => [...reach(id)].some((e) => ((D.events[e].meta || {}).gives || []).includes('choice:ch_' + rs + '_write')));
      if (!okOne) bad.push(rs + ' ' + clr.join(','));
    }
    ok('8 地方とも、地方を解くイベントの中で年代記の選択に着く（札はその後）', bad.length === 0, bad);
    // tier.js が光の柱だけ・札だけを描き分ける
    const TS = fs.readFileSync(path.join(V2, 'src', 'systems', 'tier.js'), 'utf8');
    ok('Tier.celebrate: card:false（光の柱だけ）と cardOnly（札だけ、柱を立てない）', /o\.card === false/.test(TS) && /o\.cardOnly/.test(TS) && /noPillar/.test(TS));
  }

  // ================================================================ 3・4 終盤のロア（R23 の伏線・§9）
  section('3. 終盤のロア（人物の関係と朝の席）');
  {
    newGame();
    for (const f of ['story_t7', 'story_t8', 'lo_berna_confession', 'lo_lz_2', 'lo_ev_isles']) R.Game.flags[f] = true;
    R.Game.items.k_rowell_note = 1;
    const log = await run('story_final_roa', {});
    const order = ['events.story_final_roa.say_2', 'events.story_final_roa.say_6', 'events.story_final_roa.h_berna_1', 'events.story_final_roa.h_berna_2',
      'events.story_final_roa.say_9', 'events.story_final_roa.o_berna_1', 'events.story_final_roa.o_berna_2', 'events.story_final_roa.o_rowell_2', 'events.story_final_roa.o_rowell_3',
      'events.story_final_roa.o_berna_3', 'events.story_final_roa.o_caption', 'events.story_final_roa.o_rowell_5', 'events.story_final_roa.o_rowell_7', 'events.story_final_roa.o_rowell_8',
      'events.story_final_roa.say_10', 'events.story_final_roa.a_berna_1', 'events.story_final_roa.a_berna_2', 'events.story_final_roa.a_narr', 'events.story_final_roa.say_11',
      'events.story_final_roa.say_12', 'events.story_final_roa.f_berna_1', 'events.story_final_roa.f_berna_2', 'events.story_final_roa.say_13',
      'events.story_final_roa.m_berna_1', 'events.story_final_roa.m_narr', 'events.story_final_roa.m_berna_2', 'events.story_final_roa.m_berna_3', 'events.story_final_roa.say_14'];
    ok('順: 読み聞かせ → 記憶 → {hero}の生い立ち → リオナとロウェル → 手紙の「あの子」→ アルノ → 首飾り → フィーネ → 幼いベルナ → 朝の席 → 送り出し', inOrder(log, order) === true, inOrder(log, order));
    ok('朝の席を話した旗（final_seat_told）・霧が晴れる（final_open）', R.Game.flags.final_seat_told && R.Game.flags.final_open && R.Game.flags.final_roa);
    ok('{hero}の生い立ち: 朝が来なくなってから生まれ、ベルナがロアで育てた（リオナの坊やとは別）', /朝が来なくなってから/.test(T('events.story_final_roa.h_berna_1')) && /育てた/.test(T('events.story_final_roa.h_berna_1')));
    ok('ロウェル: ミラの家に預けられた赤子 → 院長の屋敷で育った。ベルナには死んだと伝えさせた', /院長の屋敷で育った/.test(T('events.story_final_roa.o_rowell_2')) && /死んだと/.test(T('events.story_final_roa.o_berna_3')));
    ok('手紙の差出人は院長、「あの子」はロウェル', /院長の字/.test(T('events.story_final_roa.o_rowell_4')) && /おれのことか/.test(T('events.story_final_roa.o_rowell_5')));
    // 手紙を拾っていない・墨の写しを見ていない道
    newGame();
    for (const f of ['story_t7', 'story_t8', 'lo_berna_confession']) R.Game.flags[f] = true;
    R.Game.items.k_rowell_note = 1;
    const log2 = await run('story_final_roa', {});
    ok('手紙を拾っていなければ、ロウェルが自分で気づく（手紙の字幕は出ない）', !has(log2, 'events.story_final_roa.o_caption') && has(log2, 'events.story_final_roa.o_rowell_6'));
    ok('墨の写しを見ていなければ、アルノの写しの一行は出ない（アルノの話はする）', !has(log2, 'events.story_final_roa.a_narr') && has(log2, 'events.story_final_roa.a_berna_2'));
    ok('声の行（ロアの 9 本）はどれも 1 回ずつ', ['v_fine_roa_01', 'v_berna_roa_01', 'v_fine_roa_02', 'v_berna_roa_02', 'v_rowell_roa_01', 'v_berna_roa_03', 'v_berna_roa_04', 'v_fine_roa_03', 'v_rowell_roa_02']
      .every((v) => log2.filter((e) => e.voice === v).length === 1));
  }

  // ================================================================ 5 イェナ（ファロス → ビブリア）
  section('4. イェナ（§9 の 8）とビブリアのノア（§9 の 1・2）');
  {
    newGame();
    for (const f of ['final_open', 'final_roa']) R.Game.flags[f] = true;
    const log = await run('final_ferry', {});
    ok('ファロスの桟橋: イェナが来て名を探しに一緒に渡る（final_yena_ferry）→ 船の上のロウェル → ビブリア', R.Game.flags.final_yena_ferry && R.Game.flags.final_sailed &&
      inOrder(log, ['events.final_ferry.say', 'events.final_ferry.y_2', 'events.final_ferry.y_rowell_2', 'events.final_ferry.y_4', 'ev.final_story.voyage.rowell', 'ev.final_story.voyage.yena']) === true);
    ok('ファロスの桟橋のイェナ（fin_yena）とビブリアの像のそばのイェナ（b_yena）がいる', (D.maps.pharos.npcs || []).some((n) => n.id === 'fin_yena') && (D.maps.biblia.npcs || []).some((n) => n.id === 'b_yena' && n.talk === 'biblia_yena'));
    const logB = await run('biblia_arrival', {});
    ok('ビブリアに着く: ノアが赤子のロウェルを覚えていて、院長が毎年ミラに書く手紙のことを話す', inOrder(logB, ['events.biblia_arrival.say_7', 'events.biblia_arrival.n_noa_1', 'events.biblia_arrival.n_rowell_1', 'events.biblia_arrival.n_noa_3', 'events.biblia_arrival.say_8']) === true &&
      has(logB, 'events.biblia_arrival.y_narr') && R.Game.flags.final_arrived);
    const logY = await run('biblia_yena', {});
    ok('像のそばのイェナが話す', has(logY, 'events.biblia_yena.say'));
  }

  // ================================================================ 6 大書庫 5 階（二十年前の夜）
  section('5. 大書庫 5 階: 二十年前の夜（§9 の 6・7）');
  {
    newGame();
    const log = await run('archive_5_lazaro', {}, { battle: async () => 'win' });
    const night = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'].map((k) => 'events.archive_5_lazaro.' + k);
    ok('ラザロ → 王が連れ去る → ほどけた紙に夜が浮かぶ（字幕 10 枚、日継ぎの戦 → 代理試合 → 二人の歌 → 矢 → ささやき → 写す → 朝が来ない）→ 白の書と王のつながり',
      inOrder(log, ['events.archive_5_lazaro.say_7', 'events.archive_5_lazaro.say_8', 'events.archive_5_lazaro.narr_4', 'events.archive_5_lazaro.f_narr_1'].concat(night, ['events.archive_5_lazaro.f_narr_2', 'events.archive_5_lazaro.f_narr_3'])) === true);
    ok('日継ぎの戦の中身（二つの同盟・灯の油と朝の鐘）と、歌った二人の名が字幕にある', /日継ぎの戦/.test(T(night[0])) && /日輪同盟/.test(T(night[1])) && /火の鳥同盟/.test(T(night[1])) && /ミラ/.test(T(night[4])) && /リオナ/.test(T(night[4])));
    ok('旗 final_lazaro・final_night_seen', R.Game.flags.final_lazaro && R.Game.flags.final_night_seen);
  }

  // ================================================================ 7 エンディング（R23・E4・E6）
  section('6. エンディング: 朝の席（R23）・ラザロとロウェル・エステル');
  {
    newGame();
    for (const f of ['final_nemrea1', 'final_seat_told', 'final_yena_ferry']) R.Game.flags[f] = true;
    const E0 = Object.assign({}, R.Ending);
    for (const k of ['titlePage', 'reading', 'cards', 'credits', 'fin']) R.Ending[k] = async () => {};
    const ff = R.Final.ev.clearSave; R.Final.ev.clearSave = async () => {};
    const log = await run('final_ending', {});
    Object.assign(R.Ending, E0); R.Final.ev.clearSave = ff;
    ok('E2: フィーネが年代記に手を置いてから「題を、お願い」', inOrder(log, ['events.final_ending.say_5', 'events.final_ending.e2_narr', 'events.final_ending.say_6']) === true);
    ok('E4: ラザロ → 母の名をロウェルが知っている → 「帰りましょう、院長」→ うなずく', inOrder(log, ['events.final_ending.say_7', 'events.final_ending.e4_lazaro_1', 'events.final_ending.e4_rowell_1', 'events.final_ending.e4_lazaro_2', 'events.final_ending.say_8', 'events.final_ending.e4_narr']) === true);
    ok('E6: イェナが約束どおり名乗る（エステル）', inOrder(log, ['events.final_ending.caption_8', 'events.final_ending.e6_yena', 'events.final_ending.say_12', 'events.final_ending.e6_narr']) === true);
    const w = log.findIndex((e) => e.k === 'warp' && e.map === 'roa_house_dawn' && e.sp === 'e_seat');
    ok('E8: 「おはよう」→ 約束の朝ごはん → ベルナの家（e_seat）→ 席 → 布 → 杯 → 「二十年、待っていたよ」→ 字幕', w > 0 &&
      inOrder(log, ['events.final_ending.say_13', 'events.final_ending.e8_berna_1', 'events.final_ending.e8_narr_1', 'events.final_ending.e8_narr_2', 'events.final_ending.e8_narr_3', 'events.final_ending.e8_berna_2', 'events.final_ending.caption_9', 'events.final_ending.say_14']) === true &&
      idx(log, 'events.final_ending.e8_berna_1') < w && w < idx(log, 'events.final_ending.e8_narr_1'));
    ok('朝の写しのベルナの家に、ベルナ（e_berna_house）と着く所 e_seat', (D.maps.roa_house_dawn.npcs || []).some((n) => n.id === 'e_berna_house') && D.maps.roa_house_dawn.spawns.e_seat);
    ok('R.Ending.beam（東の窓から席へ差す光）がある', typeof R.Ending.beam === 'function');
    ok('「それはまた今度」「それは、また別のお話」はそのまま', has(log, 'events.final_ending.say_18') && has(log, 'events.final_ending.say_20') && /また今度/.test(T('events.final_ending.say_18')) && /また別のお話/.test(T('events.final_ending.say_20')));
    // 朝の席を聞いていない古い記録
    newGame(); R.Game.flags.final_nemrea1 = true;
    for (const k of ['titlePage', 'reading', 'cards', 'credits', 'fin']) R.Ending[k] = async () => {};
    R.Final.ev.clearSave = async () => {};
    const log2 = await run('final_ending', {});
    Object.assign(R.Ending, E0); R.Final.ev.clearSave = ff;
    ok('朝の席を聞いていない記録でも、席の場面は出る（誘いの一言だけ変わる）。イェナは名乗る', has(log2, 'events.final_ending.e8_berna_1b') && has(log2, 'events.final_ending.e8_berna_2') && has(log2, 'events.final_ending.say_12') && !has(log2, 'events.final_ending.e6_yena'));
  }

  // ================================================================ 8 ボイス
  section('7. ボイス');
  {
    const files = ['final_story.js', 'final_biblia.js', 'final_archive.js', 'final_ending.js', 'story_t2.js', 'story_t5.js', 'story_t6.js', 'story_t7.js'];
    const ids = (dir) => files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n').match(/v_[a-z]+_[a-z0-9]+_\d\d/g).sort().join(',');
    const now = ids(path.join(V2, 'src', 'events'));
    const csv = fs.readFileSync(path.resolve(V2, '..', 'design', 'voice', 'script.csv'), 'utf8');
    const unknown = [...new Set(now.split(','))].filter((v) => !csv.includes(v + ','));
    ok('新しいボイスの id は足していない（どれも script.csv の録音済みの行）', unknown.length === 0, unknown);
  }
  done();
})().catch((e) => { console.error(e); process.exit(1); });
