// オルビス高原（学術都市オルビス・消灯後の学院・星読みの塔）の共通のデータと小道具。WORLD_REDESIGN §4.8・§5.12、STORY_BIBLE §7.8・§8.9・§10.2・§11.8
//   R.DB.leads      高原の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_star・lo_time_star・lo_war_star）。ラザロの手紙は保管庫の命令書の束（X.lz）
//   R.DB.chronicle.r_star  年代記の章「星を数えた賢者」（こっそり／騒ぎ・命令書・痛みの選択で文が変わる。E14）
//   R.Star.ev       イベントが使う小道具（prep・narr・lore・lz・tier…）
// 旗・変数（§2.4 の決まり）: star_* ／ 着く star_arrived・ルカ star_luca_met（lo_time_star）・塔の門の命令書 star_gate_seen・学長の伝言 star_message・
//   潜入の準備: 鍵の数 star_key_1〜3 → star_prep_key（k_vault_code）・見回り star_prep_route（k_patrol_log か守衛室の窓）・制服 star_prep_uniform（k_uniform）・
//   2 つそろう star_ready・忍びこんだ star_night_seen・見つかった var star_caught・騒ぎ star_riot（押し通った数 var star_riot_n、倒した見張り star_down_<id>）・
//   黒板の数 star_board_1〜3 → star_code_known・保管庫 star_vault_open・星図 star_chart_got（k_star_chart）・命令書 lo_ev_star（k_seal_order）・
//   学長 star_octavia_done（ch_star_order = public|silent）・塔の扉 star_tower_open・天球儀の輪 star_orrery_rot・番人 star_sentinel・星食らい star_stareater・
//   名を読む star_names_read・灯り直す star_dawn_done・年代記 ch_star_write（story|pain）・締め star_finale_done・こっそり／騒ぎ ch_star_way（sneak|riot）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（天球の番人 1。design/voice/script.csv の文のまま）。フィーネは星の地方に出ない（STORY_BIBLE §6.2）。
(function (R) {
  'use strict';
  const I = (R.Star = R.Star || {});
  const X = (I.ev = I.ev || {});

  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_star');
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 潜入の準備（鍵・見回り・制服）のそろった数 */
  X.preps = (ev) => ['star_prep_key', 'star_prep_route', 'star_prep_uniform'].filter((f) => ev.flag(f)).length;
  /** 準備が 1 つそろうたびに呼ぶ: 2 つで学院に忍びこめる（手がかりを終える） */
  X.prep = async function (ev) {
    const n = X.preps(ev);
    if (n >= 2 && !ev.flag('star_ready')) {
      ev.setFlag('star_ready');
      ev.leadDone('l_star_prep');
      ev.lead('l_star_vault');
      await ev.caption(R.T('ev.star_00_common.prep.caption'), { ms: 2600 });
    } else if (n < 2) {
      ev.lead('l_star_prep');
    }
    return n;
  };
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** 学長が騒ぎの責めを負って退いたか（騒ぎで押し通ったとき） */
  X.resigned = (ev) => ev.flag('star_riot');
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return R.T('ev.star_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.star_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.star_00_common.skyLine.ret_3');
    return null;
  };
  // 鍵の三つの数（学生 3 人・黒板 3 枚。同じ数）
  X.CODE = R.T('ev.star_00_common.CODE');

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('star_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('star_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.star_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_star' }, o));
  lead('l_star_stars', { kind: 'region', title: R.T('leads.l_star_stars.title'), text: R.T('leads.l_star_stars.text'), from: R.T('leads.l_star_stars.from'), place: 'orbis', done: 'star_names_read' });
  lead('l_star_tower', { kind: 'region', title: R.T('leads.l_star_tower.title'), text: R.T('leads.l_star_tower.text'), from: R.T('leads.l_star_tower.from'), place: 'orbis', done: 'star_tower_open' });
  lead('l_star_message', { kind: 'region', title: R.T('leads.l_star_message.title'), text: R.T('leads.l_star_message.text'), from: R.T('leads.l_star_message.from'), place: 'orbis', done: 'star_vault_open' });
  lead('l_star_prep', { kind: 'region', title: R.T('leads.l_star_prep.title'), text: R.T('leads.l_star_prep.text'), from: R.T('leads.l_star_prep.from'), place: 'orbis', done: 'star_ready' });
  lead('l_star_vault', { kind: 'region', title: R.T('leads.l_star_vault.title'), text: R.T('leads.l_star_vault.text'), from: R.T('leads.l_star_vault.from'), place: 'academy', done: 'star_chart_got' });
  lead('l_star_summit', { kind: 'region', title: R.T('leads.l_star_summit.title'), text: R.T('leads.l_star_summit.text'), from: R.T('leads.l_star_summit.from'), place: 'startower', done: 'star_stareater' });
  lead('l_star_margin', { kind: 'region', title: R.T('leads.l_star_margin.title'), text: R.T('leads.l_star_margin.text'), from: R.T('leads.l_star_margin.from'), place: 'startower', done: 'star_names_read' });
  lead('l_main_recorder_star', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_star.title'), text: R.T('leads.l_main_recorder_star.text'), from: R.T('leads.l_main_recorder_star.from'), place: 'orbis' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_star_stargaze', { kind: 'side', title: R.T('leads.q_star_stargaze.title'), text: R.T('leads.q_star_stargaze.text'), from: R.T('leads.q_star_stargaze.from'), place: 'orbis', done: 'star_stargaze_done' });
  lead('q_star_exam', { kind: 'side', title: R.T('leads.q_star_exam.title'), text: R.T('leads.q_star_exam.text'), from: R.T('leads.q_star_exam.from'), place: 'orbis', done: 'star_exam_done' });
  lead('q_star_books', { kind: 'side', title: R.T('leads.q_star_books.title'), text: R.T('leads.q_star_books.text'), from: R.T('leads.q_star_books.from'), place: 'orbis', done: 'star_books_done' });
  lead('q_star_lamp', { kind: 'side', title: R.T('leads.q_star_lamp.title'), text: R.T('leads.q_star_lamp.text'), from: R.T('leads.q_star_lamp.from'), place: 'orbis', done: 'star_lamp_lit' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_starfall', { kind: 'rumor', title: R.T('leads.l_opt_starfall.title'), text: R.T('leads.l_opt_starfall.text'), from: R.T('leads.l_opt_starfall.from'), dir: R.T('leads.l_opt_starfall.dir'), done: 'star_shard' });
  lead('l_opt_clockbird', { kind: 'rumor', title: R.T('leads.l_opt_clockbird.title'), text: R.T('leads.l_opt_clockbird.text'), from: R.T('leads.l_opt_clockbird.from'), dir: R.T('leads.l_opt_clockbird.dir'), done: 'star_clockbird_met' });
  // 戦闘の後（battle_core.js の battle:finish）: 図鑑にぜんまい鳥を倒した数があれば旗を立てる（うわさの手がかりを終える）
  if (R.on) {
    R.on('battle:finish', () => {
      const G = R.Game;
      if (!G || !G.flags || G.flags.star_clockbird_met) return;
      const b = G.book && G.book.mon && G.book.mon.rm_clock_bird;
      const setFlag = (id) => { G.flags[id] = true; if (R.emit) R.emit('flag', { id, v: true }); };
      if (b && b.kills > 0) setFlag('star_clockbird_met');
    });
  }

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 32〜34）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_star' }, o));
  lore('lo_ev_star', { title: R.T('lore.lo_ev_star.title'), kind: 'main', must: true,
    text: R.T('lore.lo_ev_star.text') });
  lore('lo_time_star', { title: R.T('lore.lo_time_star.title'), kind: 'main', must: true,
    text: R.T('lore.lo_time_star.text') });
  lore('lo_war_star', { title: R.T('lore.lo_war_star.title'), kind: 'region', must: false,
    text: R.T('lore.lo_war_star.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_star', {
    title: R.T('chronicle.r_star.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_star.parts.0.text') },
      { cond: { choice: 'ch_star_way', is: 'sneak' }, text: R.T('chronicle.r_star.parts.1.text') },
      { cond: { choice: 'ch_star_way', is: 'riot' }, text: R.T('chronicle.r_star.parts.2.text') },
      { cond: { choice: 'ch_star_order', is: 'public' }, text: R.T('chronicle.r_star.parts.3.text') },
      { cond: { choice: 'ch_star_order', is: 'silent' }, text: R.T('chronicle.r_star.parts.4.text') },
      { text: R.T('chronicle.r_star.parts.5.text') },
      { cond: { choice: 'ch_star_write', is: 'story' }, text: R.T('chronicle.r_star.parts.6.text') },
      { cond: { choice: 'ch_star_write', is: 'pain' }, text: R.T('chronicle.r_star.parts.7.text') },
      { cond: 'cleared_r_star', text: R.T('chronicle.r_star.parts.8.text') },
    ],
  });
})(window.RPG);
