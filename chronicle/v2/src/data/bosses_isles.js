// マレア諸島のボス（BATTLE の形。WORLD_REDESIGN §4.5・§4.10・E18、STORY_BIBLE §7.5）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   深みの大ダコ tr_b_octopus（潮鳴りの洞窟 2 階の中ボス）: 深みへもぐる（予告）→ 次の手番に大渦（全体。守る）。
//       足が減ると生やす・墨で目つぶし（今の行動）。足（b_tentacle）を先に切ると大渦が弱い…ではなく、足は締めつけ役（今のまま）。
//   亡霊船長グレン tr_b_captain（幽霊船の船長室、地方ボス）: 船べりの大砲に火縄を回す（予告）→ 次の手番に一斉砲火（全体。守る）。
//       船員の骨を呼ぶ・途切れた舟歌で眠らせる（今の行動）。HP が半分を切ると怒りで攻めが上がる（今の第 2 の姿）。光と火に弱い。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_octo_dive: { name: R.T('bossActions.eb_octo_dive.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_octo_dive.msg'),
      telegraph: { text: R.T('bossActions.eb_octo_dive.telegraph.text'), pose: 'tele', tint: '#8ad0ff', next: 'eb_octo_surge', guard: 'defend', lethal: true } },
    eb_octo_surge: { name: R.T('bossActions.eb_octo_surge.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.88, guardPct: 0.08, kind: 'blunt', element: 'water' }], fx: 'water', msg: R.T('bossActions.eb_octo_surge.msg') },
    eb_captain_aim: { name: R.T('bossActions.eb_captain_aim.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_captain_aim.msg'),
      telegraph: { text: R.T('bossActions.eb_captain_aim.telegraph.text'), pose: 'tele', tint: '#9fd8ff', next: 'eb_broadside', guard: 'defend', lethal: true } },
    // 2026-10-01（ボスの組み直し）: グレンの受け流しの構え（打ちこむと斬り返す。battle_core の魔物の反撃の構え）
    eb_captain_parry: { name: R.T('bossActions.eb_captain_parry.name'), kind: 'enemy', target: 'self', effects: [{ type: 'status', status: 'counter', power: 1.0 }], fx: 'buff', msg: R.T('bossActions.eb_captain_parry.msg') },
    eb_broadside: { name: R.T('bossActions.eb_broadside.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: R.T('bossActions.eb_broadside.msg') },
  });
  const O = L.b_octopus;
  if (O) {
    // 2026-10-01（ボスの組み直し）: 前は 4 手番ごとに必ず もぐる（予告）→ 大渦、3 手番ごとに墨・足を生やす の決まった順。
    //   いまは締めつけ・渦・墨・足を生やす（足が減ったとき）から選び、もぐる予告はたまに（2 ラウンド目から）。足と合わせる合体技「締め上げ」もある
    O.actions = A([['attack', 2], ['eb_crush_hug', 3], ['eb_whirl', 2], ['eb_ink_cloud', 1], ['eb_regrow', 2, { countBelow: 3 }],
      ['eb_octo_dive', 1, { round: 2 }]]);
    O.desc = R.T('data.bosses_isles.desc');
    O.s = { hp: 1.18, atk: 0.72, mag: 0.72 };   // hp 1.1 → 1.18（2026-09-30: ティア 1 のリピートが 31% で目安 30% を越えた。sim_bosses）
  }
  const C = L.b_captain;
  if (C) {
    // 2026-10-01（ボスの組み直し）: 1 ラウンドに重い手 1 つ（カトラス・錨投げ）＋軽い手 1 つ（砲火・舟歌・船員を呼ぶ・受け流しの構え）。
    //   前は 2 ラウンドごとに必ず 火縄を回す（予告）→ 一斉砲火。いまは予告は軽い手の中からたまに（2 ラウンド目から、続けては来ない）。骨の船員と合わせる合体技もある
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    C.actions = A([['eb_cutlass', 3, HV], ['eb_anchor_throw', 2, HV], ['attack', 1, HV],
      ['eb_fire_volley', 2, LT], ['eb_ghost_shanty', 1, LT], ['eb_captain_parry', 1, LT], ['eb_call_crew', 2, { every: [2, 1], countBelow: 3 }],
      ['eb_captain_aim', 2, { every: [4, 3], round: 2 }]]);
    C.desc = R.T('data.bosses_isles.desc_2');
    C.s = { hp: 0.47, atk: 0.44, mag: 0.44 };   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
  }
  // ---------------------------------------------------------------- 合体技（2026-10-01 ボスの組み直し。決まりは w_combo の R.DB.enemyCombos）
  R.defs('enemyCombos', {
    // 締め上げ: 足が 1 人をからめとり、大ダコが同じ人を抱きつぶす
    c_b_octo_squeeze: { name: R.T('enemyCombos.c_b_octo_squeeze.name'), members: [{ mon: 'b_octopus' }, { mon: 'b_tentacle' }],
      steps: [{ by: 1, act: 'eb_tentacle_bind', aim: 'low' }, { by: 0, act: 'eb_crush_hug', same: true, seq: 'sq:ec_point_blank' }], chance: 0.35, cd: 3 },
    // 船長の号令斬り: 骨の船員が 1 人を押さえ、グレンが同じ人へカトラス
    c_b_captain_boarding: { name: R.T('enemyCombos.c_b_captain_boarding.name'), members: [{ mon: 'b_captain' }, { lin: 'skeleton' }],
      steps: [{ by: 1, act: 'ec_grapple' }, { by: 0, act: 'eb_cutlass', same: true, seq: 'sq:ec_cross_slash' }], round: 2, chance: 0.35, cd: 3 },
  });
})(window.RPG);
