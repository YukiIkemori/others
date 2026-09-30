// ガルド山地（鉱山都市ドヴァン・深き坑道・トロッコ線の崖）の共通のデータと小道具。WORLD_REDESIGN §4.6・§5.10、STORY_BIBLE §7.6・§8.7・§10.2・§11.8
//   R.DB.leads      山地の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_mine・lo_time_mine・lo_war_mine・lo_mine_oath）。ラザロの手紙は坑道 2 階の休み場（X.lz）
//   R.DB.chronicle.r_mine  年代記の章「鍛冶神の誓い」（組合・鍛冶衆・仲裁の道と、痛みの選択で文が変わる。E14）
//   R.Mine.ev       イベントが使う小道具（OATH・SONG・jobs・side・lz・tier…）
// 旗・変数（§2.4 の決まり）: mine_* ／ 着く mine_arrived・坑道 mine_seen・見張り mine_watch_met・ボルグ mine_borg_met・ヘルガ mine_helga_met・碑 mine_stone_read・
//   救出 mine_miner1（ダグ）・mine_miner2（ロルフ）・岩食らい mine_rockeater・mine_pip（誓いのハンマー k_oath_hammer）・var mine_rescued・3 人で mine_rescued_all・
//   岩戸の前 mine_door_seen（v_guardian_mine_01）・仕事: 組合 mine_told_dag・mine_told_rolf → mine_job_g1、帳簿 mine_job_g2（lo_war_mine）／
//   鍛冶衆 mine_copy_asked・k_oath_copy → mine_job_s1、石像の祈り mine_job_s2・選ぶ mine_choice（ch_mine_side = guild|smiths|accord）・
//   岩戸が開く mine_door_open・番人 mine_warden_done（A は mine_warden_fought）・灯り直す mine_relight_done（場面の間 mine_relight_scene）・
//   年代記 ch_mine_write（story|pain）・帳簿を閉じる mine_ledger_closed・締め mine_finale_done・近道 mine_cartline（A・C）・mine_smithpath（B・C）・
//   寄り道の旗 mine_vein_open（深淵の鉱脈 #17、A・C）・mine_volk_open（鍛冶衆の隠れ村 #16、B・C）・依頼 mine_lamp_<1..3>・mine_lamps_done・
//   mine_kitten_*・mine_bellows_done・mine_ghost_done・隠者 mine_hermit_met・mine_hermit_quiz
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは本筋の要の台詞だけ（鉄の番人 3。design/voice/script.csv の文のまま）。フィーネは山地には出ない（§6.2）。
(function (R) {
  'use strict';
  const I = (R.Mine = R.Mine || {});
  const X = (I.ev = I.ev || {});

  // ---------------------------------------------------------------- 誓い（碑の文・誓いの歌）
  // 碑の文字は、去年記録院が拓本をとってから半分が消えた（STORY_BIBLE §7.6）。隠者の古い写しで読める
  X.OATH_WORN = R.T('ev.mine_00_common.OATH_WORN');
  X.OATH_FULL = R.T('ev.mine_00_common.OATH_FULL');
  X.SONG = R.T('ev.mine_00_common.SONG');
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_mine');
  X.rescued = (ev) => ['mine_miner1', 'mine_miner2', 'mine_pip'].filter((f) => ev.flag(f)).length;
  /** 仕事（組合 2・鍛冶衆 2）の数と、仲裁が出るか */
  X.jobs = (ev) => ({ g: ['mine_job_g1', 'mine_job_g2'].filter((f) => ev.flag(f)).length, s: ['mine_job_s1', 'mine_job_s2'].filter((f) => ev.flag(f)).length });
  X.accordOk = (ev) => { const j = X.jobs(ev); return j.g === 2 && j.s === 2; };
  X.side = (ev) => ev.choiceOf('ch_mine_side');
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 読み物を書庫へ（旗 = id） */
  X.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    if (typeof ev.lore === 'function') { ev.lore(id); return true; }
    ev.setFlag(id);
    return true;
  };
  /** 救い出した人を数え、3 人目で手がかりを閉じる */
  X.rescue = function (ev, flag) {
    if (ev.flag(flag)) return X.rescued(ev);
    ev.setFlag(flag);
    const n = X.rescued(ev);
    ev.setVar('mine_rescued', n);
    if (n >= 3 && !ev.flag('mine_rescued_all')) { ev.setFlag('mine_rescued_all'); ev.leadDone('l_mine_trapped'); }
    return n;
  };
  /** STORY_BIBLE §3.5 の世代と、ティアの近況（WORLD §1.3 の表） */
  X.skyLine = function () {
    const t = X.tier();
    if (t >= 6) return R.T('ev.mine_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.mine_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.mine_00_common.skyLine.ret_3');
    return null;
  };

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（ほかの地方と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('mine_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('mine_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.mine_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_mine' }, o));
  lead('l_mine_trapped', { kind: 'region', title: R.T('leads.l_mine_trapped.title'), text: R.T('leads.l_mine_trapped.text'), from: R.T('leads.l_mine_trapped.from'), place: 'deepmine', dir: R.T('leads.l_mine_trapped.dir'), done: 'mine_rescued_all' });
  lead('l_mine_guild', { kind: 'region', title: R.T('leads.l_mine_guild.title'), text: R.T('leads.l_mine_guild.text'), from: R.T('leads.l_mine_guild.from'), place: 'dovan', done: 'mine_choice' });
  lead('l_mine_smiths', { kind: 'region', title: R.T('leads.l_mine_smiths.title'), text: R.T('leads.l_mine_smiths.text'), from: R.T('leads.l_mine_smiths.from'), place: 'dovan', done: 'mine_choice' });
  lead('l_mine_stone', { kind: 'region', title: R.T('leads.l_mine_stone.title'), text: R.T('leads.l_mine_stone.text'), from: R.T('leads.l_mine_stone.from'), place: 'dovan', done: 'mine_job_s1' });
  lead('l_mine_door', { kind: 'region', title: R.T('leads.l_mine_door.title'), text: R.T('leads.l_mine_door.text'), from: R.T('leads.l_mine_door.from'), place: 'dovan', done: 'mine_choice' });
  lead('l_mine_warden', { kind: 'region', title: R.T('leads.l_mine_warden.title'), text: R.T('leads.l_mine_warden.text'), from: R.T('leads.l_mine_warden.from'), place: 'deepmine', dir: R.T('leads.l_mine_warden.dir'), done: 'mine_warden_done' });
  lead('l_main_recorder_mine', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_mine.title'), text: R.T('leads.l_main_recorder_mine.text'), from: R.T('leads.l_main_recorder_mine.from'), place: 'dovan' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_mine_lamps', { kind: 'side', title: R.T('leads.q_mine_lamps.title'), text: R.T('leads.q_mine_lamps.text'), from: R.T('leads.q_mine_lamps.from'), place: 'deepmine', done: 'mine_lamps_done' });
  lead('q_mine_kitten', { kind: 'side', title: R.T('leads.q_mine_kitten.title'), text: R.T('leads.q_mine_kitten.text'), from: R.T('leads.q_mine_kitten.from'), place: 'deepmine', done: 'mine_kitten_home' });
  lead('q_mine_bellows', { kind: 'side', title: R.T('leads.q_mine_bellows.title'), text: R.T('leads.q_mine_bellows.text'), from: R.T('leads.q_mine_bellows.from'), place: 'dovan', done: 'mine_bellows_done' });
  lead('q_mine_ghost', { kind: 'side', title: R.T('leads.q_mine_ghost.title'), text: R.T('leads.q_mine_ghost.text'), from: R.T('leads.q_mine_ghost.from'), place: 'deepmine', done: 'mine_ghost_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_hermit', { kind: 'rumor', title: R.T('leads.l_opt_hermit.title'), text: R.T('leads.l_opt_hermit.text'), from: R.T('leads.l_opt_hermit.from'), dir: R.T('leads.l_opt_hermit.dir'), done: 'mine_hermit_met' });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 26〜28 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_mine' }, o));
  lore('lo_ev_mine', { title: R.T('lore.lo_ev_mine.title'), kind: 'main', must: true,
    text: R.T('lore.lo_ev_mine.text') });
  lore('lo_time_mine', { title: R.T('lore.lo_time_mine.title'), kind: 'main', must: true,
    text: R.T('lore.lo_time_mine.text') });
  lore('lo_war_mine', { title: R.T('lore.lo_war_mine.title'), kind: 'region', must: false,
    text: R.T('lore.lo_war_mine.text') });
  lore('lo_mine_oath', { title: R.T('lore.lo_mine_oath.title'), kind: 'region', must: false,
    text: R.T('lore.lo_mine_oath.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_mine', {
    title: R.T('chronicle.r_mine.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_mine.parts.0.text') },
      { cond: 'mine_rescued_all', text: R.T('chronicle.r_mine.parts.1.text') },
      { cond: { choice: 'ch_mine_side', is: 'guild' }, text: R.T('chronicle.r_mine.parts.2.text') },
      { cond: { choice: 'ch_mine_side', is: 'smiths' }, text: R.T('chronicle.r_mine.parts.3.text') },
      { cond: { choice: 'ch_mine_side', is: 'accord' }, text: R.T('chronicle.r_mine.parts.4.text') },
      { text: R.T('chronicle.r_mine.parts.5.text') },
      { cond: { choice: 'ch_mine_write', is: 'story' }, text: R.T('chronicle.r_mine.parts.6.text') },
      { cond: { choice: 'ch_mine_write', is: 'pain' }, text: R.T('chronicle.r_mine.parts.7.text') },
      { cond: 'cleared_r_mine', text: R.T('chronicle.r_mine.parts.8.text') },
    ],
  });
})(window.RPG);
