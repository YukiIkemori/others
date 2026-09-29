// 湿原（ロッホ・霧の館・鐘沈みの沼）の共通のデータと小道具。WORLD_REDESIGN §4.4・§3.2〜§3.5、STORY_BIBLE §7.4・§8.5・§10
//   R.DB.leads      湿原の手がかり（地方・依頼・寄り道のうわさ・本筋 1）
//   R.DB.lore       読み物（lo_ev_marsh・lo_time_marsh・lo_war_marsh・lo_marsh_song・くべられなかった手紙）
//   R.DB.chronicle.r_marsh  年代記の章「霧の魔女と七つの鐘」（名指しの回数・館に先に行ったか・痛みの選択で文が変わる。E14）
//   R.Marsh.ev      イベントが使う小道具（EVIDENCE・count・give・narr・lore・lz・small・tier…）
// 旗・変数（§2.4 の決まり）: marsh_* ／ 証拠の旗 marsh_ev_<foot|book|doll|drawing|melda|stone>、証拠の数 var marsh_evidence、
//   消灯の刻 marsh_night（宿で「消灯の刻まで休む」で立ち、「朝の鐘まで休む」で下りる。ロッホの外へ出ると下りる）、
//   間違えて名指しした数 var marsh_wrong、捕まった人 marsh_held_<beppo|tobias|melda>、消えた子の数 var marsh_lost
//   選択 ch_marsh_accuse（first|wrong）・ch_marsh_write（pain|legend）
// 仲間 20 人には物語の焦点を当てない（A36）。ボイスは付けない（オーナー: 声はあとで）。録音済みの文は 1 字も変えずに地の文として置く。
(function (R) {
  'use strict';
  const M = (R.Marsh = R.Marsh || {});
  const X = (M.ev = M.ev || {});

  // ---------------------------------------------------------------- 証拠（WORLD §4.4 の 6 つ）。right = 「霧そのもの」を示す証拠
  X.EVIDENCE = [
    { id: 'foot', n: 1, name: R.T('ev.marsh_00_common.EVIDENCE.foot.name'), right: true, say: R.T('ev.marsh_00_common.EVIDENCE.foot.say') },
    { id: 'book', n: 2, name: R.T('ev.marsh_00_common.EVIDENCE.book.name'), right: true, say: R.T('ev.marsh_00_common.EVIDENCE.book.say') },
    { id: 'doll', n: 3, name: R.T('ev.marsh_00_common.EVIDENCE.doll.name'), right: false, say: R.T('ev.marsh_00_common.EVIDENCE.doll.say') },
    { id: 'drawing', n: 4, name: R.T('ev.marsh_00_common.EVIDENCE.drawing.name'), right: true, say: R.T('ev.marsh_00_common.EVIDENCE.drawing.say') },
    { id: 'melda', n: 5, name: R.T('ev.marsh_00_common.EVIDENCE.melda.name'), right: false, say: R.T('ev.marsh_00_common.EVIDENCE.melda.say') },
    { id: 'stone', n: 6, name: R.T('ev.marsh_00_common.EVIDENCE.stone.name'), right: true, say: R.T('ev.marsh_00_common.EVIDENCE.stone.say') },
  ];
  X.has = (ev, id) => ev.flag('marsh_ev_' + id);
  X.count = (ev) => X.EVIDENCE.filter((e) => X.has(ev, e.id)).length;
  X.tier = () => (R.Tier && R.Tier.get ? R.Tier.get() : 0);
  X.cleared = (ev) => ev.flag('cleared_r_marsh');
  X.narr = (ev, text) => ev.say(null, text, { face: false });
  /** 証拠を手に入れる（旗・数・手がかり帳の証拠の行）。初めてなら true */
  X.evidence = async function (ev, id) {
    if (X.has(ev, id)) return false;
    const e = X.EVIDENCE.find((q) => q.id === id);
    ev.setFlag('marsh_ev_' + id);
    ev.setVar('marsh_evidence', X.count(ev));
    ev.lead('l_marsh_ev_' + id);
    ev.leadDone('l_marsh_ev_' + id);
    try { ev.sfx('quill'); } catch (err) { /* */ }
    await ev.caption(R.T('ev.marsh_00_common.evidence.caption', { name: e.name }), { ms: 1800 });
    const n = X.count(ev);
    if (n >= 4 && !ev.flag('marsh_assembly_done') && !ev.flag('marsh_can_assemble')) {
      ev.setFlag('marsh_can_assemble');
      ev.lead('l_marsh_assembly');
      await ev.caption(R.T('ev.marsh_00_common.evidence.caption_2'), { ms: 2200 });
    }
    return true;
  };
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
    if (t >= 6) return R.T('ev.marsh_00_common.skyLine.ret');
    if (t >= 4) return R.T('ev.marsh_00_common.skyLine.ret_2');
    if (t >= 2) return R.T('ev.marsh_00_common.skyLine.ret_3');
    return null;
  };
  // 鐘の歌（メルダが教える。石碑は最後の節が削れている）
  X.SONG = R.T('ev.marsh_00_common.SONG');
  X.SONG_VOICE = 'v_melda_song_01';   // 館でメルダが歌う（caption の voice）
  X.SONG_CUT = R.T('ev.marsh_00_common.SONG_CUT');
  // 名指しの相手
  X.SUSPECTS = [
    { id: 'melda', name: R.T('ev.marsh_00_common.SUSPECTS.melda.name') },
    { id: 'beppo', name: R.T('ev.marsh_00_common.SUSPECTS.beppo.name') },
    { id: 'tobias', name: R.T('ev.marsh_00_common.SUSPECTS.tobias.name') },
    { id: 'mist', name: R.T('ev.marsh_00_common.SUSPECTS.mist.name') },
  ];

  // ---------------------------------------------------------------- くべられなかった手紙（STORY_BIBLE §10.3）: 拾った順に n 通目（森・砂漠・雪原と同じ番号の組）
  X.lz = async function (ev) {
    let n = ev.var('marsh_lz');
    if (!n) { n = 2; while (n < 8 && ev.flag('lo_lz_' + n)) n++; ev.setVar('marsh_lz', n); }
    await X.lore(ev, 'lo_lz_' + n);
    if (R.DB.letters['letter_lz_' + n] && X.tier() >= n - 1) await ev.letter('letter_lz_' + n);
    else await ev.say(null, R.T('ev.marsh_00_common.lz.say'));
    return n;
  };

  // ---------------------------------------------------------------- 手がかり（K.lead）
  const lead = (id, o) => R.def('leads', id, Object.assign({ region: 'r_marsh' }, o));
  lead('l_marsh_mist', { kind: 'region', title: R.T('leads.l_marsh_mist.title'), text: R.T('leads.l_marsh_mist.text'), from: R.T('leads.l_marsh_mist.from'), place: 'loch', done: 'cleared_r_marsh' });
  lead('l_marsh_emma', { kind: 'region', title: R.T('leads.l_marsh_emma.title'), text: R.T('leads.l_marsh_emma.text'), from: R.T('leads.l_marsh_emma.from'), place: 'loch', done: 'marsh_emma_met' });
  lead('l_marsh_evidence', { kind: 'region', title: R.T('leads.l_marsh_evidence.title'), text: R.T('leads.l_marsh_evidence.text'), from: R.T('leads.l_marsh_evidence.from'), place: 'loch', done: 'marsh_assembly_done' });
  lead('l_marsh_assembly', { kind: 'region', title: R.T('leads.l_marsh_assembly.title'), text: R.T('leads.l_marsh_assembly.text'), from: R.T('leads.l_marsh_assembly.from'), place: 'loch', done: 'marsh_assembly_done' });
  lead('l_marsh_manor', { kind: 'region', title: R.T('leads.l_marsh_manor.title'), text: R.T('leads.l_marsh_manor.text'), from: R.T('leads.l_marsh_manor.from'), place: 'manor', dir: R.T('leads.l_marsh_manor.dir'), done: 'marsh_melda_met' });
  lead('l_marsh_bog', { kind: 'region', title: R.T('leads.l_marsh_bog.title'), text: R.T('leads.l_marsh_bog.text'), from: R.T('leads.l_marsh_bog.from'), place: 'bog', dir: R.T('leads.l_marsh_bog.dir'), done: 'cleared_r_marsh' });
  for (const e of X.EVIDENCE) lead('l_marsh_ev_' + e.id, { kind: 'region', title: R.T('ev.marsh_00_common.title', { name: e.name }), text: e.say, from: R.T('ev.marsh_00_common.from'), place: 'loch', done: 'marsh_ev_' + e.id });
  lead('l_main_recorder_marsh', { kind: 'main', region: 'world', title: R.T('leads.l_main_recorder_marsh.title'), text: R.T('leads.l_main_recorder_marsh.text'), from: R.T('leads.l_main_recorder_marsh.from'), place: 'loch' });
  // 依頼（side。id は依頼と同じ q_*）
  lead('q_marsh_cat', { kind: 'side', title: R.T('leads.q_marsh_cat.title'), text: R.T('leads.q_marsh_cat.text'), from: R.T('leads.q_marsh_cat.from'), place: 'loch', done: 'marsh_cat_done' });
  lead('q_marsh_lanterns', { kind: 'side', title: R.T('leads.q_marsh_lanterns.title'), text: R.T('leads.q_marsh_lanterns.text'), from: R.T('leads.q_marsh_lanterns.from'), place: 'loch', done: 'marsh_lanterns_done' });
  // 寄り道のうわさ（rumor）
  lead('l_opt_lotus', { kind: 'rumor', title: R.T('leads.l_opt_lotus.title'), text: R.T('leads.l_opt_lotus.text'), from: R.T('leads.l_opt_lotus.from'), place: 'loch', dir: R.T('leads.l_opt_lotus.dir'), done: { var: 'marsh_lotus_seen', gte: 1 } });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2 の 20〜22 ほか）
  const lore = (id, o) => R.def('lore', id, Object.assign({ region: 'r_marsh' }, o));
  lore('lo_ev_marsh', { title: R.T('lore.lo_ev_marsh.title'), kind: 'main', must: true, text: R.T('lore.lo_ev_marsh.text') });
  lore('lo_time_marsh', { title: R.T('lore.lo_time_marsh.title'), kind: 'main', must: true, text: R.T('lore.lo_time_marsh.text') });
  lore('lo_war_marsh', { title: R.T('lore.lo_war_marsh.title'), kind: 'region', must: false, text: R.T('lore.lo_war_marsh.text') });
  lore('lo_marsh_song', { title: R.T('lore.lo_marsh_song.title'), kind: 'region', must: false, text: R.T('lore.lo_marsh_song.text') });

  // ---------------------------------------------------------------- 年代記の章（E14。選択で文が変わる）
  R.def('chronicle', 'r_marsh', {
    title: R.T('chronicle.r_marsh.title'),
    get text() {
      const ok = (c) => c == null || (R.Game && R.State && R.State.check ? R.State.check(c) : false);
      return this.parts.filter((p) => ok(p.cond)).map((p) => p.text).join('\n');
    },
    parts: [
      { text: R.T('chronicle.r_marsh.parts.0.text') },
      { cond: { choice: 'ch_marsh_accuse', is: 'first' }, text: R.T('chronicle.r_marsh.parts.1.text') },
      { cond: { choice: 'ch_marsh_accuse', is: 'wrong' }, text: R.T('chronicle.r_marsh.parts.2.text') },
      { cond: { choice: 'ch_marsh_write', is: 'legend' }, text: R.T('chronicle.r_marsh.parts.3.text') },
      { cond: { choice: 'ch_marsh_write', is: 'pain' }, text: R.T('chronicle.r_marsh.parts.4.text') },
      { cond: 'cleared_r_marsh', text: R.T('chronicle.r_marsh.parts.5.text') },
    ],
  });

  // ---------------------------------------------------------------- 消灯の刻: ロッホとロッホの屋内の外へ出たら下ろす
  const inLoch = (id) => id === 'loch' || /^loch_/.test(id || '');
  if (R.on) {
    R.on('map:enter', (e) => {
      try {
        const id = (e && (e.map || e.id)) || (R.Field && R.Field.pos && R.Field.pos.map);
        if (R.Game && R.Game.flags && R.Game.flags.marsh_night && id && !inLoch(id)) { R.Game.flags.marsh_night = false; if (R.MapUtil && R.MapUtil.invalidate) R.MapUtil.invalidate(); }
      } catch (err) { /* */ }
    });
  }
})(window.RPG);
