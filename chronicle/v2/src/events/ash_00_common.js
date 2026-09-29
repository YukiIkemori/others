// 灰の荒野（カルデラ・闘技場・灰の火山）の共通のデータと小道具。WORLD_REDESIGN §4.7・§3.2〜§3.5、STORY_BIBLE §7.7・§8.8・§10
//   R.DB.leads      灰の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_ash・lo_time_ash・lo_war_ash・lo_ash_firebird・くべられなかった手紙）
//   R.DB.chronicle.r_ash  年代記の章「火の鳥の眠る山」（八百長の誘い・無敗・痛みの選択で文が変わる。E14）
//   R.Ash.ev        イベントが使う小道具（BOUTS・MURALS・narr・lore・lz・small・tier…）
// 旗・変数（§2.4 の決まり）: ash_* ／ 大会: 出場 ash_entered、勝った回 var ash_round（0〜5）、負けた数 var ash_losses、
//   今の回の相手を砂の場に出す var ash_bout（1〜5。0 = いない）、決勝の前夜 ash_eve_done、優勝 ash_champion、
//   八百長の誘い 選択 ch_ash_bribe（refuse|accept）、壁画 ash_mural_<1|2|3>・var ash_murals、写し手を止めた ash_copy_stopped・
//   白くされた壁画 ash_mural_blank、溶岩の堰 ash_sluice、番犬 ash_hound、巨獣 ash_lavabeast、卵 ash_egg、締め ash_finale_done
//   選択 ch_ash_bribe（refuse|accept）・ch_ash_write（rebirth|pain）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（ドルガ・カヤ・ザクロ。design/voice/story_v2_lines.csv）。
(function (R) {
  'use strict';
  const A = (R.Ash = R.Ash || {});
  const X = (A.ev = A.ev || {});

  // ---------------------------------------------------------------- 大会の 5 回戦（WORLD §4.7 の流れ 1）
  X.BOUTS = [
    null,
    { n: 1, troop: 'tr_ash_r1', name: R.T('ev.ash_00_common.BOUTS.1.name'), foe: R.T('ev.ash_00_common.BOUTS.1.foe'), intro: R.T('ev.ash_00_common.BOUTS.1.intro'), npcs: ['opp_1a', 'opp_1b'] },
    { n: 2, troop: 'tr_b_ash_r2', name: R.T('ev.ash_00_common.BOUTS.2.name'), foe: R.T('ev.ash_00_common.BOUTS.2.foe'), intro: R.T('ev.ash_00_common.BOUTS.2.intro'), npcs: ['opp_2'] },
    { n: 3, troop: 'tr_b_ash_r3', name: R.T('ev.ash_00_common.BOUTS.3.name'), foe: R.T('ev.ash_00_common.BOUTS.3.foe'), intro: R.T('ev.ash_00_common.BOUTS.3.intro'), npcs: ['opp_3a', 'opp_3b'] },
    { n: 4, troop: 'tr_b_ash_r4', name: R.T('ev.ash_00_common.BOUTS.4.name'), foe: R.T('ev.ash_00_common.BOUTS.4.foe'), intro: R.T('ev.ash_00_common.BOUTS.4.intro'), npcs: ['opp_4'] },
    { n: 5, troop: 'tr_b_zakuro', name: R.T('ev.ash_00_common.BOUTS.5.name'), foe: R.T('ev.ash_00_common.BOUTS.5.foe'), intro: R.T('ev.ash_00_common.BOUTS.5.intro'), npcs: ['opp_5'] },
  ];
  // 壁画の物語（v1 の文のまま）。3 つ目は、写し手に白くされると後半が消える
  X.MURALS = {
    1: R.T('ev.ash_00_common.MURALS.1'),
    2: R.T('ev.ash_00_common.MURALS.2'),
    3: R.T('ev.ash_00_common.MURALS.3'),
    3.5: R.T('ev.ash_00_common.MURALS.3_5'),
  };
  X.TELL = R.T('ev.ash_00_common.TELL');
  X.TELL_BLANK = R.T('ev.ash_00_common.TELL_BLANK');
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_ash');
  X.round = (ev) => ev.var('ash_round');
  X.murals = (ev) => [1, 2, 3].filter((n) => ev.flag('ash_mural_' + n)).length;
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  X.small = function (ev, table) { const row = table[Math.min(X.tier(), table.length - 1)]; return row[0] === 'gold' ? ev.gold(row[1]) : ev.item(row[0], row[1]); };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return R.T('ev.ash_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.ash_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.ash_00_common.skyLine.ret_3');
    return null;
  };

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('ash_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('ash_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.ash_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_ash' }, o));
  lead('l_ash_trial', { kind: 'region', title: R.T('leads.l_ash_trial.title'), text: R.T('leads.l_ash_trial.text'), from: R.T('leads.l_ash_trial.from'), place: 'caldera', done: 'ash_champion' });
  lead('l_ash_egg', { kind: 'region', title: R.T('leads.l_ash_egg.title'), text: R.T('leads.l_ash_egg.text'), from: R.T('leads.l_ash_egg.from'), place: 'caldera', done: 'cleared_r_ash' });
  lead('l_ash_stranger', { kind: 'region', title: R.T('leads.l_ash_stranger.title'), text: R.T('leads.l_ash_stranger.text'), from: R.T('leads.l_ash_stranger.from'), place: 'caldera', done: 'ash_champion' });
  lead('l_ash_volcano', { kind: 'region', title: R.T('leads.l_ash_volcano.title'), text: R.T('leads.l_ash_volcano.text'), from: R.T('leads.l_ash_volcano.from'), place: 'volcano', dir: R.T('leads.l_ash_volcano.dir'), done: 'ash_lavabeast' });
  lead('l_ash_murals', { kind: 'region', title: R.T('leads.l_ash_murals.title'), text: R.T('leads.l_ash_murals.text'), from: R.T('leads.l_ash_murals.from'), place: 'volcano', done: { var: 'ash_murals', gte: 3 } });
  lead('l_main_recorder_ash', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_ash.title'), text: R.T('leads.l_main_recorder_ash.text'), from: R.T('leads.l_main_recorder_ash.from'), place: 'caldera' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_ash_bet', { kind: 'side', title: R.T('leads.q_ash_bet.title'), text: R.T('leads.q_ash_bet.text'), from: R.T('leads.q_ash_bet.from'), place: 'caldera', done: 'ash_bet_done' });
  lead('q_ash_lanterns', { kind: 'side', title: R.T('leads.q_ash_lanterns.title'), text: R.T('leads.q_ash_lanterns.text'), from: R.T('leads.q_ash_lanterns.from'), place: 'caldera', done: 'ash_lanterns_done' });
  lead('q_ash_spa', { kind: 'side', title: R.T('leads.q_ash_spa.title'), text: R.T('leads.q_ash_spa.text'), from: R.T('leads.q_ash_spa.from'), place: 'caldera', done: 'ash_spa_done' });
  lead('q_ash_challenge', { kind: 'side', title: R.T('leads.q_ash_challenge.title'), text: R.T('leads.q_ash_challenge.text'), from: R.T('leads.q_ash_challenge.from'), place: 'caldera', done: 'ash_challenge_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_spa', { kind: 'rumor', title: R.T('leads.l_opt_spa.title'), text: R.T('leads.l_opt_spa.text'), from: R.T('leads.l_opt_spa.from'), dir: R.T('leads.l_opt_spa.dir'), done: 'ash_spa_bathed' });
  lead('l_opt_turtle', { kind: 'rumor', title: R.T('leads.l_opt_turtle.title'), text: R.T('leads.l_opt_turtle.text'), from: R.T('leads.l_opt_turtle.from'), dir: R.T('leads.l_opt_turtle.dir'), done: { var: 'ash_turtle_seen', gte: 1 } });
  lead('l_opt_battlefield', { kind: 'rumor', title: R.T('leads.l_opt_battlefield.title'), text: R.T('leads.l_opt_battlefield.text'), from: R.T('leads.l_opt_battlefield.from'), dir: R.T('leads.l_opt_battlefield.dir'), done: 'ash_battlefield_seen' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 29〜31 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_ash' }, o));
  lore('lo_ev_ash', { title: R.T('lore.lo_ev_ash.title'), kind: 'main', must: true, text: R.T('lore.lo_ev_ash.text') });
  lore('lo_time_ash', { title: R.T('lore.lo_time_ash.title'), kind: 'main', must: true, text: R.T('lore.lo_time_ash.text') });
  lore('lo_war_ash', { title: R.T('lore.lo_war_ash.title'), kind: 'region', must: false, text: R.T('lore.lo_war_ash.text') });
  lore('lo_ash_firebird', { title: R.T('lore.lo_ash_firebird.title'), kind: 'region', must: false, text: R.T('lore.lo_ash_firebird.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_ash', {
    title: R.T('chronicle.r_ash.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_ash.parts.0.text') },
      { cond: { choice: 'ch_ash_bribe', is: 'refuse' }, text: R.T('chronicle.r_ash.parts.1.text') },
      { cond: { choice: 'ch_ash_bribe', is: 'accept' }, text: R.T('chronicle.r_ash.parts.2.text') },
      { cond: 'ash_unbeaten', text: R.T('chronicle.r_ash.parts.3.text') },
      { cond: { choice: 'ch_ash_write', is: 'rebirth' }, text: R.T('chronicle.r_ash.parts.4.text') },
      { cond: { choice: 'ch_ash_write', is: 'pain' }, text: R.T('chronicle.r_ash.parts.5.text') },
      { cond: 'cleared_r_ash', text: R.T('chronicle.r_ash.parts.6.text') },
    ],
  });
})(window.RPG);
