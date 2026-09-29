// CONTENT-F: 森（ヴェルダの森・フェルン）の共通のデータと小道具。V2_PLAN §3.3〜§3.5・STORY_BIBLE §7.1・§10
//   R.DB.leads   森の手がかり（地方 5・依頼 7・寄り道のうわさ 2）。本筋の l_main_recorder_forest は CONTENT-P（leads_main.js）
//   R.DB.letters ピムの最初の詩・くべられなかった手紙（1 通目）
//   R.DB.lore    読み物（STORY_BIBLE §10.2 の森の 5 点。{title, text, region, must}。調べると旗 = id。CONTENT-P の序章と同じ形）
//   R.DB.chronicle.r_forest  年代記の章「千年樹の歌」の文（選択で変わる。E14）
//   R.ContentF.forest: VERSES・PEOPLE・rescue()・lore()・give()・found()・last() …（イベントのファイルが使う）
// 旗・変数（§2.4 の決まり）: forest_* ／ 選択 ch_forest_pim（send|take）・ch_forest_fawn（heal|leave）・ch_forest_write（pain|oath）
// 仲間 20 人には物語の焦点を当てない（A36）: 森のイベントは仲間の名前を 1 つも出さない。
(function (R) {
  'use strict';
  const C = (R.ContentF = R.ContentF || {});
  const F = (C.forest = C.forest || {});

  // 千年樹の歌（歌の石 3 つ。3 つ目の石だけにある一節は STORY_BIBLE §7.1 の 3）
  F.VERSES = R.T('ev.forest_00_common.VERSES');
  F.EXTRA = R.T('ev.forest_00_common.EXTRA');
  F.SONG = F.VERSES.join('\n');

  // 探す 4 人（順番は自由）。最後に見つけた人が一品物を渡す（どれも同じ強さ、V2_PLAN §3.3 F12）
  F.PEOPLE = {
    hans: { name: R.T('ev.forest_00_common.PEOPLE.hans.name'), look: 'npc_hans', unique: 'u_hans_axe' },
    ben: { name: R.T('ev.forest_00_common.PEOPLE.ben.name'), look: 'npc_ben', unique: 'u_ben_whistle' },
    roy: { name: R.T('ev.forest_00_common.PEOPLE.roy.name'), look: 'npc_roy', unique: 'u_roy_charm' },
    pim: { name: R.T('ev.forest_00_common.PEOPLE.pim.name'), look: 'npc_pim', unique: 'u_pim_cap' },
  };
  F.found = (ev, who) => ev.flag('forest_found_' + who);
  F.count = (ev) => ['hans', 'ben', 'roy', 'pim'].filter((w) => ev.flag('forest_found_' + w)).length;
  /** 最後に見つけた人（まだ 4 人そろっていなければ null） */
  F.last = function (ev) {
    let best = null, n = 0;
    for (const w of Object.keys(F.PEOPLE)) { const k = ev.var('forest_order_' + w); if (k > n) { n = k; best = w; } }
    return n >= 4 ? best : null;
  };
  /** 見つけた: 旗・順番・数。村ではなく迷いの森 1 階の野営地で待つ（STORY_BIBLE §7.1 の 1） */
  F.rescue = async function (ev, who, o) {
    o = o || {};
    if (ev.flag('forest_found_' + who)) return;
    const n = F.count(ev) + 1;
    ev.addVar('forest_order_' + who, n);
    ev.addVar('forest_found', 1);
    ev.setFlag('forest_found_' + who);
    try { ev.jingle('rescue'); } catch (e) { /* */ }
    if (o.hide !== false) {
      try { await ev.leave(o.npc || who); } catch (e) { /* */ }   // 背を向けて数歩歩き、薄れて消える（持ち主 2026-09-27）
    }
    if (!o.quiet) await ev.caption(R.T('ev.forest_00_common.rescue.caption', { name: F.PEOPLE[who].name }), { ms: 2200 });
    if (n >= 4) await ev.caption(R.T('ev.forest_00_common.rescue.caption_2'), { ms: 2600 });
    if (['hans', 'ben', 'roy'].every((w) => ev.flag('forest_found_' + w))) ev.leadDone('l_forest_woodcutters');
    if (who === 'pim') ev.leadDone('l_forest_pim');
  };

  /** 読み物（R.DB.lore）を書庫へ（CONTENT-P の序章と同じ形: 旗 = id）。EVENTS に ev.lore が来たらそちらを使う */
  F.lore = async function (ev, id) {
    if (ev.flag(id)) return false;
    ev.setFlag(id);
    if (typeof ev.lore === 'function') { await ev.lore(id); return true; }
    const d = R.DB.lore && R.DB.lore[id];
    try { ev.sfx('quill'); } catch (e) { /* */ }
    await ev.caption(R.T('ev.forest_00_common.lore.caption', { p0: d ? d.title : id }), { ms: 1800 });
    return true;
  };

  /** 品を渡す（知らない id は R.State.gain が警告する。数は Tier で変えてよい） */
  F.give = function (ev, id, n) { return ev.item(id, n == null ? 1 : n); };
  /** ティアで量が変わる小さな品（WORLD §3.3 ⑤） */
  F.small = function (ev, table) {
    const t = (R.Tier && R.Tier.get) ? R.Tier.get() : 0;
    const row = table[Math.min(t, table.length - 1)];
    return ev.item(row[0], row[1]);
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_forest' }, o));
  lead('l_forest_board', { kind: 'region', title: R.T('leads.l_forest_board.title'), text: R.T('leads.l_forest_board.text'), from: R.T('leads.l_forest_board.from'), place: 'fern', done: 'cleared_r_forest' });
  lead('l_forest_pim', { kind: 'region', title: R.T('leads.l_forest_pim.title'), text: R.T('leads.l_forest_pim.text'), from: R.T('leads.l_forest_pim.from'), place: 'verda', done: 'forest_found_pim' });
  lead('l_forest_woodcutters', { kind: 'region', title: R.T('leads.l_forest_woodcutters.title'), text: R.T('leads.l_forest_woodcutters.text'), from: R.T('leads.l_forest_woodcutters.from'), place: 'verda', done: ['forest_found_hans', 'forest_found_ben', 'forest_found_roy'] });
  lead('l_forest_song', { kind: 'region', title: R.T('leads.l_forest_song.title'), text: R.T('leads.l_forest_song.text'), from: R.T('leads.l_forest_song.from'), place: 'verda', done: { var: 'forest_verses', gte: 3 } });
  lead('l_forest_hut', { kind: 'region', title: R.T('leads.l_forest_hut.title'), text: R.T('leads.l_forest_hut.text'), from: R.T('leads.l_forest_hut.from'), place: 'verda', done: 'lo_lz_1', hideWhen: 'cleared_r_forest' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_fern_letters', { kind: 'side', title: R.T('leads.q_fern_letters.title'), text: R.T('leads.q_fern_letters.text'), from: R.T('leads.q_fern_letters.from'), place: 'fern', done: 'forest_letters_done' });
  lead('q_fern_herbs', { kind: 'side', title: R.T('leads.q_fern_herbs.title'), text: R.T('leads.q_fern_herbs.text'), from: R.T('leads.q_fern_herbs.from'), place: 'verda', done: 'forest_herbs_done' });
  lead('q_fern_song', { kind: 'side', title: R.T('leads.q_fern_song.title'), text: R.T('leads.q_fern_song.text'), from: R.T('leads.q_fern_song.from'), place: 'fern', done: 'forest_song_3' });
  lead('q_forest_fireflies', { kind: 'side', title: R.T('leads.q_forest_fireflies.title'), text: R.T('leads.q_forest_fireflies.text'), from: R.T('leads.q_forest_fireflies.from'), place: 'fern', dir: R.T('leads.q_forest_fireflies.dir'), done: 'forest_fireflies_done' });
  lead('q_forest_acorn', { kind: 'side', title: R.T('leads.q_forest_acorn.title'), text: R.T('leads.q_forest_acorn.text'), from: R.T('leads.q_forest_acorn.from'), place: 'verda', done: 'forest_acorn_won' });
  lead('q_yura_names', { kind: 'side', title: R.T('leads.q_yura_names.title'), text: R.T('leads.q_yura_names.text'), from: R.T('leads.q_yura_names.from'), place: 'yura', done: 'yura_miller_thanked' });
  lead('q_pim_poet', { kind: 'side', title: R.T('leads.q_pim_poet.title'), text: R.T('leads.q_pim_poet.text'), from: R.T('leads.q_pim_poet.from'), place: 'fern', hideWhen: false });
  // 寄り道のうわさ（rumor）。古井戸（l_opt_well）は CONTENT-P
  lead('l_opt_hut', { kind: 'rumor', title: R.T('leads.l_opt_hut.title'), text: R.T('leads.l_opt_hut.text'), from: R.T('leads.l_opt_hut.from'), place: 'hut', done: { visited: 'hut' } });
  lead('l_opt_yura', { kind: 'rumor', title: R.T('leads.l_opt_yura.title'), text: R.T('leads.l_opt_yura.text'), from: R.T('leads.l_opt_yura.from'), place: 'yura', done: { visited: 'yura' } });

  // ---------------------------------------------------------------- 手紙（K.letter）
  R.def('letters', 'letter_forest_pim_poem', {
    from: R.T('letters.letter_forest_pim_poem.from'), title: R.T('letters.letter_forest_pim_poem.title'),
    text: R.T('letters.letter_forest_pim_poem.text'),
  });
  R.def('letters', 'letter_lz_1', {
    from: R.T('letters.letter_lz_1.from'), title: R.T('letters.letter_lz_1.title'),
    text: R.T('letters.letter_lz_1.text'),
  });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 9〜12・35）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_forest' }, o));
  lore('lo_ev_forest', { title: R.T('lore.lo_ev_forest.title'), kind: 'main', must: true, text: R.T('lore.lo_ev_forest.text') });
  lore('lo_time_forest', { title: R.T('lore.lo_time_forest.title'), kind: 'main', must: true, text: R.T('lore.lo_time_forest.text') });
  lore('lo_war_forest', { title: R.T('lore.lo_war_forest.title'), kind: 'region', must: false, text: R.T('lore.lo_war_forest.text') });
  lore('lo_forest_moss_stone', { title: R.T('lore.lo_forest_moss_stone.title'), kind: 'region', must: false, text: R.T('lore.lo_forest_moss_stone.text') });
  lore('lo_lz_1', { title: R.T('lore.lo_lz_1.title'), kind: 'main', must: false, order: 1, letter: 'letter_lz_1', text: R.T('lore.lo_lz_1.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  //   MENUS は R.DB.chronicle[summaryKey].text を読む（requests.jsonl の MENUS → lead）。text は parts の cond の合う文をつないだもの
  R.def('chronicle', 'r_forest', {
    title: R.T('chronicle.r_forest.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_forest.parts.0.text') },
      { cond: { choice: 'ch_forest_pim', is: 'send' }, text: R.T('chronicle.r_forest.parts.1.text') },
      { cond: { choice: 'ch_forest_pim', is: 'take' }, text: R.T('chronicle.r_forest.parts.2.text') },
      { cond: { choice: 'ch_forest_fawn', is: 'heal' }, text: R.T('chronicle.r_forest.parts.3.text') },
      { cond: { choice: 'ch_forest_write', is: 'pain' }, text: R.T('chronicle.r_forest.parts.4.text') },
      { cond: { choice: 'ch_forest_write', is: 'oath' }, text: R.T('chronicle.r_forest.parts.5.text') },
      { cond: 'cleared_r_forest', text: R.T('chronicle.r_forest.parts.6.text') },
    ],
  });
})(window.RPG);
