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
    eb_broadside: { name: R.T('bossActions.eb_broadside.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: R.T('bossActions.eb_broadside.msg') },
  });
  const O = L.b_octopus;
  if (O) {
    O.actions = A([['attack', 2], ['eb_ink_cloud', 1, { every: [3, 0] }], ['eb_crush_hug', 2], ['eb_regrow', 2, { every: [3, 2], countBelow: 3 }],
      ['eb_whirl', 1], ['eb_octo_dive', SCHED, { every: [4, 1] }]]);
    O.desc = R.T('data.bosses_isles.desc');
    O.s = { hp: 1.1, atk: 0.72, mag: 0.72 };
  }
  const C = L.b_captain;
  if (C) {
    C.actions = A([['attack', 2], ['eb_cutlass', 2], ['eb_fire_volley', 1], ['eb_ghost_shanty', 1, { every: [6, 5] }],
      ['eb_call_crew', 1, { every: [5, 1], countBelow: 3 }], ['eb_anchor_throw', 1], ['eb_captain_aim', SCHED, { every: [4, 3] }]]);
    C.desc = R.T('data.bosses_isles.desc_2');
    C.s = { hp: 0.47, atk: 0.27, mag: 0.27 };
  }
})(window.RPG);
