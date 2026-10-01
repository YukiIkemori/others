// 湿原のボス（BATTLE の形。WORLD_REDESIGN §4.4・§4.10・E18、STORY_BIBLE §7.4）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   人形の楽団 tr_b_dolls（館の中ボス）: 指揮者人形が棒を高く掲げる（予告）→ 次の手番に楽団の強奏（全体。守る）。
//       指揮者は倒れた楽士をアンコールで起こす（今の行動）ので、先に指揮者を倒す（指揮者が倒れると楽士は崩れる: leader）。
//   霧食らい tr_b_mistbeast（地方ボス）: 霧が渦を巻く（予告）→ 次の手番に霧の大波（全体・眠り。守る）。霧を吸って傷をふさぐ・魔女の分身を呼ぶ（今の行動）。
//       HP が半分を切ると霧が薄れて本当の口がのぞく（今の第 2 の姿: 物理がよく効く）。光と風に弱い。
(function (R) {
  'use strict';
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_doll_raise: { name: R.T('bossActions.eb_doll_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_doll_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_doll_raise.telegraph.text'), pose: 'tele', tint: '#f0d8ff', next: 'eb_doll_fortissimo', guard: 'defend', lethal: true } },
    eb_doll_fortissimo: { name: R.T('bossActions.eb_doll_fortissimo.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.88, guardPct: 0.06, kind: 'blunt' }], fx: 'song', msg: R.T('bossActions.eb_doll_fortissimo.msg') },
    eb_mist_gather: { name: R.T('bossActions.eb_mist_gather.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_mist_gather.msg'),
      telegraph: { text: R.T('bossActions.eb_mist_gather.telegraph.text'), pose: 'tele', tint: '#dfe8e8', next: 'eb_mist_wave', guard: 'defend', lethal: true } },
    eb_mist_wave: { name: R.T('bossActions.eb_mist_wave.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.8, guardPct: 0.1, kind: 'blunt' }], fx: 'breath', msg: R.T('bossActions.eb_mist_wave.msg') },
  });
  const C = L.b_doll_conductor;
  if (C) {
    // 2026-10-01（ボスの組み直し）: 前は 4 手番ごとに必ず棒を掲げた（予告）。いまは指揮棒・クレッシェンド（楽団の攻めを上げる）・アンコールが主で、
    //   強奏の予告はたまに（2 ラウンド目から）。楽士と合わせる合体技「人形の三重奏」もある（下の enemyCombos）
    C.actions = A([['attack', 2], ['eb_baton', 3], ['eb_encore', 3, { allyDown: true }], ['eb_crescendo', 2], ['eb_doll_raise', 1, { round: 2 }]]);
    C.leader = { msg: R.T('data.bosses_marsh.leader.msg') };
    // 2026-10-01（組み直し）: 予告の手番が減り、合体技も入った分の調整（hp 2.1 → 2.7・atk 0.55 → 0.82、楽士 0.8/0.5 → 1.05/0.75。台本 90〜94%・7 ラウンド）
    C.s = { hp: 2.7, atk: 0.82, mag: 0.82 };
    for (const id of ['b_doll_violin', 'b_doll_drum', 'b_doll_flute']) if (L[id]) L[id].s = { hp: 1.05, atk: 0.75, mag: 0.75 };
    C.desc = R.T('data.bosses_marsh.desc');
    if (L.b_doll_flute) L.b_doll_flute.actions = A([['attack', 2], ['eb_flute_lullaby', 1], ['eb_shrill', 2]]);   // 眠った人は強奏を守れない: 眠りの笛は控えめに
  }
  const M = L.b_mistbeast;
  if (M) {
    // 2026-10-01（ボスの組み直し）: 1 ラウンドに重い手 1 つ（霧の手・魔女のまね）＋軽い手 1 つ（霧の息・分身を呼ぶ・HP が半分を切ってから霧を吸う）。
    //   前は 2 ラウンドごとに必ず 霧が渦を巻く（予告）→ 霧の大波。いまは予告は軽い手の中からたまに（2 ラウンド目から、続けては来ない）
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    M.actions = A([['eb_mist_hand', 3, HV], ['eb_witch_mimic', 3, HV], ['attack', 1, HV],
      ['attack', 1, LT], ['eb_mist_breath', 2, LT], ['eb_call_double', 2, { every: [2, 1], countBelow: 3 }], ['eb_inhale_mist', 2, { every: [2, 1], hpBelow: 0.5 }],
      ['eb_mist_gather', 2, { every: [4, 3], round: 2 }]]);
    M.desc = R.T('data.bosses_marsh.desc_2');
    M.s = { hp: 0.47, atk: 1.05, mag: 1.05 };   // 2026-10-01（組み直し）: 毎ラウンド 2 回とも攻める型に。atk 0.48 → 1.05（台本 85〜95%・10 ラウンド）   // hp 0.45 → 0.47（2026-09-30: ティア 1 のリピートが 32% で目安 30% を越えた。sim_bosses）
    // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
  }
  // ---------------------------------------------------------------- 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
  R.defs('enemyCombos', {
    // 人形の三重奏: 太鼓がとどろき、バイオリンが弱った人を斬り、指揮者が同じ人へ指揮棒を振り下ろす
    c_b_doll_trio: { name: R.T('enemyCombos.c_b_doll_trio.name'), members: [{ mon: 'b_doll_conductor' }, { mon: 'b_doll_violin' }, { mon: 'b_doll_drum' }],
      steps: [{ by: 2, act: 'eb_drum_roll' }, { by: 1, act: 'eb_bow_slash', aim: 'low', seq: 'sq:ec_hawk_slash' }, { by: 0, act: 'eb_baton', same: true }], round: 2, chance: 0.35, cd: 3 },
    // 霧の抱擁: 分身の冷たい手が 1 人をつかみ、霧食らいの霧の手が同じ人を包む
    c_b_mist_embrace: { name: R.T('enemyCombos.c_b_mist_embrace.name'), members: [{ mon: 'b_mistbeast' }, { mon: 'b_mist_double' }],
      steps: [{ by: 1, act: 'eb_cold_touch', aim: 'low' }, { by: 0, act: 'eb_mist_hand', same: true, seq: 'sq:ec_puppet_strings' }], chance: 0.4, cd: 3 },
  });
})(window.RPG);
