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
    C.actions = A([['attack', 2], ['eb_baton', 2], ['eb_encore', 3, { every: [3, 2], allyDown: true }], ['eb_doll_raise', 200, { every: [4, 1] }], ['eb_crescendo', 1, { every: [4, 3] }]]);
    C.leader = { msg: R.T('data.bosses_marsh.leader.msg') };
    C.s = { hp: 2.1, atk: 0.55, mag: 0.55 };
    for (const id of ['b_doll_violin', 'b_doll_drum', 'b_doll_flute']) if (L[id]) L[id].s = { hp: 0.8, atk: 0.5, mag: 0.5 };
    C.desc = R.T('data.bosses_marsh.desc');
    if (L.b_doll_flute) L.b_doll_flute.actions = A([['attack', 2], ['eb_flute_lullaby', 1], ['eb_shrill', 2]]);   // 眠った人は強奏を守れない: 眠りの笛は控えめに
  }
  const M = L.b_mistbeast;
  if (M) {
    M.actions = A([['attack', 2], ['eb_mist_hand', 2], ['eb_mist_breath', 1], ['eb_mist_gather', 200, { every: [4, 1] }],
      ['eb_call_double', 1, { every: [5, 2], countBelow: 3 }], ['eb_witch_mimic', 2], ['eb_inhale_mist', 1, { every: [5, 4] }]]);
    M.desc = R.T('data.bosses_marsh.desc_2');
    M.s = { hp: 0.47, atk: 0.3, mag: 0.3 };   // hp 0.45 → 0.47（2026-09-30: ティア 1 のリピートが 32% で目安 30% を越えた。sim_bosses）
  }
})(window.RPG);
