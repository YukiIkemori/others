// マレア諸島（港町コーラル・岬の村ネレイ・潮鳴りの洞窟・幽霊船）の共通のデータと小道具。WORLD_REDESIGN §4.5・§5.8・§5.9、STORY_BIBLE §7.5・§8.6・§10.2・§11.8
//   R.DB.leads      諸島の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_isles・lo_time_isles・lo_war_isles・lo_isles_shanty）。ラザロの手紙は灯台島の灯室（X.lz）
//   R.DB.chronicle.r_isles  年代記の章「帰らずの船長」（商船の選択・岩の節・痛みの選択で文が変わる。E14）
//   R.Isles.ev      イベントが使う小道具（SHANTY・chart・narr・lore・lz・tier…）
// 旗・変数（§2.4 の決まり）: isles_* ／ 着く isles_arrived・親方ドレイク isles_drake_met・港の親方の海図 isles_chart_got（k_sea_chart）・
//   洞窟 isles_cave_seen・潮 isles_tide_high（潮の石で満ち引き）・大ダコ isles_octopus・光る貝がら isles_shell（k_glow_shell）・外洋船 isles_ship・
//   海図の空白 isles_chart_<light|siren|crab|wreck>・var isles_chart・3 つで isles_fog_found・座礁した商船 isles_wreck_done（選択 ch_isles_wreck = help|cargo）・
//   マリナ isles_marina_met（lo_time_isles）・岩の節 isles_siren_heard・待った一晩 isles_marina_night・歌える isles_song_ready・岬の先のフィーネ isles_fine_seen・
//   夜の桟橋 isles_song_done → 霧の海 isles_fog_open・幽霊船 isles_ghost_seen・名札 isles_tag_<1..6>・var isles_tags・船長 isles_captain・白い日誌 isles_log_white・
//   夜明け isles_dawn_done・年代記 ch_isles_write（story|pain）・締め isles_finale_done・礼 isles_reward_given・灯台の灯 isles_light_lit
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（マリナ 4・グレン 5・フィーネ 1。design/voice/script.csv の文のまま）。
(function (R) {
  'use strict';
  const I = (R.Isles = R.Isles || {});
  const X = (I.ev = I.ev || {});

  // ---------------------------------------------------------------- グレンの舟歌（前半はマリナが覚えている。後半は人魚の歌う岩の節）
  X.SHANTY_A = R.T('ev.isles_00_common.SHANTY_A');
  X.SHANTY_B = R.T('ev.isles_00_common.SHANTY_B');
  // 海図の空白 4 つ（WORLD §4.5 の流れ 3）。3 つ埋まると幽霊船の海域が絞れる
  // 幽霊船の船室の名札 6 枚（任意。STORY_BIBLE §7.5 の 3）。年代記の（痛）で名を記すと、コーラルの後家の壁に名が足される
  X.CREW = [null, R.T('ev.isles_00_common.CREW.1'), R.T('ev.isles_00_common.CREW.2'), R.T('ev.isles_00_common.CREW.3'), R.T('ev.isles_00_common.CREW.4'), R.T('ev.isles_00_common.CREW.5'), R.T('ev.isles_00_common.CREW.6')];
  X.CHART = ['light', 'siren', 'crab', 'wreck'];
  X.CHART_NAME = { light: R.T('ev.isles_00_common.CHART_NAME.light'), siren: R.T('ev.isles_00_common.CHART_NAME.siren'), crab: R.T('ev.isles_00_common.CHART_NAME.crab'), wreck: R.T('ev.isles_00_common.CHART_NAME.wreck') };
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_isles');
  X.charted = (ev) => X.CHART.filter((k) => ev.flag('isles_chart_' + k)).length;
  X.tags = (ev) => [1, 2, 3, 4, 5, 6].filter((n) => ev.flag('isles_tag_' + n)).length;
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** 海図の空白を 1 つ埋める（船で着いたとき）。3 つ目で霧の海域が絞れる */
  X.chart = async function (ev, key) {
    if (ev.flag('isles_chart_' + key)) return false;
    ev.setFlag('isles_chart_' + key);
    const n = X.charted(ev);
    ev.setVar('isles_chart', n);
    if (!ev.has('k_sea_chart')) return true;
    ev.sfx('quill');
    await ev.caption(R.T('ev.isles_00_common.chart.caption', { p0: X.CHART_NAME[key], n }), { ms: 2000 });
    if (n >= 3 && !ev.flag('isles_fog_found')) {
      ev.setFlag('isles_fog_found');
      await ev.say(null, R.T('ev.isles_00_common.chart.say'));
      await ev.say(null, R.T('ev.isles_00_common.chart.say_2'));
      ev.leadDone('l_isles_chart');
      ev.lead('l_isles_fog');
    }
    return true;
  };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return R.T('ev.isles_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.isles_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.isles_00_common.skyLine.ret_3');
    return null;
  };

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('isles_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('isles_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.isles_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_isles' }, o));
  lead('l_isles_harbor', { kind: 'region', title: R.T('leads.l_isles_harbor.title'), text: R.T('leads.l_isles_harbor.text'), from: R.T('leads.l_isles_harbor.from'), place: 'coral', done: 'isles_fog_found' });
  lead('l_isles_ship', { kind: 'region', title: R.T('leads.l_isles_ship.title'), text: R.T('leads.l_isles_ship.text'), from: R.T('leads.l_isles_ship.from'), place: 'coral', done: 'isles_ship' });
  lead('l_isles_shell', { kind: 'region', title: R.T('leads.l_isles_shell.title'), text: R.T('leads.l_isles_shell.text'), from: R.T('leads.l_isles_shell.from'), place: 'tidecave', dir: R.T('leads.l_isles_shell.dir'), done: 'isles_shell' });
  lead('l_isles_song', { kind: 'region', title: R.T('leads.l_isles_song.title'), text: R.T('leads.l_isles_song.text'), from: R.T('leads.l_isles_song.from'), place: 'nerei', dir: R.T('leads.l_isles_song.dir'), done: 'isles_song_done' });
  lead('l_isles_chart', { kind: 'region', title: R.T('leads.l_isles_chart.title'), text: R.T('leads.l_isles_chart.text'), from: R.T('leads.l_isles_chart.from'), place: 'coral', done: 'isles_fog_found' });
  lead('l_isles_fog', { kind: 'region', title: R.T('leads.l_isles_fog.title'), text: R.T('leads.l_isles_fog.text'), from: R.T('leads.l_isles_fog.from'), place: 'nerei', done: 'isles_captain' });
  lead('l_main_recorder_isles', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_isles.title'), text: R.T('leads.l_main_recorder_isles.text'), from: R.T('leads.l_main_recorder_isles.from'), place: 'nerei' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_isles_light', { kind: 'side', title: R.T('leads.q_isles_light.title'), text: R.T('leads.q_isles_light.text'), from: R.T('leads.q_isles_light.from'), place: 'nerei', done: 'isles_light_lit' });
  lead('q_isles_flags', { kind: 'side', title: R.T('leads.q_isles_flags.title'), text: R.T('leads.q_isles_flags.text'), from: R.T('leads.q_isles_flags.from'), place: 'coral', done: 'isles_flags_done' });
  lead('q_isles_shells', { kind: 'side', title: R.T('leads.q_isles_shells.title'), text: R.T('leads.q_isles_shells.text'), from: R.T('leads.q_isles_shells.from'), place: 'coral', done: 'isles_shells_done' });
  lead('q_isles_delivery', { kind: 'side', title: R.T('leads.q_isles_delivery.title'), text: R.T('leads.q_isles_delivery.text'), from: R.T('leads.q_isles_delivery.from'), place: 'coral', done: 'isles_delivery_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_siren', { kind: 'rumor', title: R.T('leads.l_opt_siren.title'), text: R.T('leads.l_opt_siren.text'), from: R.T('leads.l_opt_siren.from'), dir: R.T('leads.l_opt_siren.dir'), done: 'isles_siren_heard' });
  lead('l_opt_crab', { kind: 'rumor', title: R.T('leads.l_opt_crab.title'), text: R.T('leads.l_opt_crab.text'), from: R.T('leads.l_opt_crab.from'), dir: R.T('leads.l_opt_crab.dir'), done: 'isles_crab_seen' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 23〜25 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_isles' }, o));
  lore('lo_ev_isles', { title: R.T('lore.lo_ev_isles.title'), kind: 'main', must: true,
    text: R.T('lore.lo_ev_isles.text') });
  lore('lo_time_isles', { title: R.T('lore.lo_time_isles.title'), kind: 'main', must: true,
    text: R.T('lore.lo_time_isles.text') });
  lore('lo_war_isles', { title: R.T('lore.lo_war_isles.title'), kind: 'region', must: false,
    text: R.T('lore.lo_war_isles.text') });
  lore('lo_isles_shanty', { title: R.T('lore.lo_isles_shanty.title'), kind: 'region', must: false,
    text: R.T('lore.lo_isles_shanty.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_isles', {
    title: R.T('chronicle.r_isles.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_isles.parts.0.text') },
      { cond: { choice: 'ch_isles_wreck', is: 'help' }, text: R.T('chronicle.r_isles.parts.1.text') },
      { cond: { choice: 'ch_isles_wreck', is: 'cargo' }, text: R.T('chronicle.r_isles.parts.2.text') },
      { cond: 'isles_siren_heard', text: R.T('chronicle.r_isles.parts.3.text') },
      { text: R.T('chronicle.r_isles.parts.4.text') },
      { cond: { choice: 'ch_isles_write', is: 'story' }, text: R.T('chronicle.r_isles.parts.5.text') },
      { cond: { choice: 'ch_isles_write', is: 'pain' }, text: R.T('chronicle.r_isles.parts.6.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_1'], text: R.T('chronicle.r_isles.parts.7.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_2'], text: R.T('chronicle.r_isles.parts.8.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_3'], text: R.T('chronicle.r_isles.parts.9.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_4'], text: R.T('chronicle.r_isles.parts.10.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_5'], text: R.T('chronicle.r_isles.parts.11.text') },
      { cond: [{ choice: 'ch_isles_write', is: 'pain' }, 'isles_tag_6'], text: R.T('chronicle.r_isles.parts.12.text') },
      { cond: 'cleared_r_isles', text: R.T('chronicle.r_isles.parts.13.text') },
    ],
  });
})(window.RPG);
