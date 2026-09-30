// ガルド山地のボス（BATTLE の形。WORLD_REDESIGN §4.6・§4.10・E18、STORY_BIBLE §7.6）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   岩食らい tr_b_rockeater（深き坑道 2 階の中ボス。どの道でも戦う）: 土の中へもぐる（予告）→ 次の手番に足もとから突き上げる落盤（全体。守る）。
//       岩をかじって固くなる・砂利を吐く（今の行動）。風に弱い。
//   鉄の番人 tr_b_ironwarden（七の層の広間、組合につく道 A だけ）: 大槌を高く振りかぶる（予告）→ 次の手番に金床落とし（全体。守る）。
//       炉の息・鉄の壁（今の行動）。3/4 で二度動く、3 割を切ると水にいっそう弱くなる（今の第 2・第 3 の姿）。
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_rock_burrow: { name: R.T('bossActions.eb_rock_burrow.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_rock_burrow.msg'),
      telegraph: { text: R.T('bossActions.eb_rock_burrow.telegraph.text'), pose: 'tele', tint: '#d8b080', next: 'eb_rock_upheaval', guard: 'defend', lethal: true } },
    eb_rock_upheaval: { name: R.T('bossActions.eb_rock_upheaval.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.88, guardPct: 0.08, kind: 'blunt', element: 'earth' }], fx: 'earth', msg: R.T('bossActions.eb_rock_upheaval.msg') },
    eb_warden_raise: { name: R.T('bossActions.eb_warden_raise.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_warden_raise.msg'),
      telegraph: { text: R.T('bossActions.eb_warden_raise.telegraph.text'), pose: 'tele', tint: '#ffb070', next: 'eb_warden_anvil', guard: 'defend', lethal: true } },
    eb_warden_anvil: { name: R.T('bossActions.eb_warden_anvil.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: R.T('bossActions.eb_warden_anvil.msg') },
  });
  const E = L.b_rockeater;
  if (E) {
    E.actions = A([['attack', 2], ['eb_rock_crunch', 1, { every: [3, 2] }], ['eb_gravel_spit', 2], ['eb_grind', 2], ['eb_rock_burrow', SCHED, { every: [4, 1] }]]);
    E.desc = R.T('data.bosses_mine.desc');
    E.s = { hp: 1.7, atk: 0.95, mag: 0.95 };
  }
  const W = L.b_ironwarden;
  if (W) {
    W.actions = A([['attack', 2], ['eb_iron_fist', 2], ['eb_forge_breath', 1], ['eb_iron_wall', 1, { hpBelow: 0.7, once: true }],
      ['eb_warden_raise', SCHED, { every: [4, 3] }]]);
    W.desc = R.T('data.bosses_mine.desc_2');
    W.s = { hp: 0.5, atk: 0.3, mag: 0.3 };
  }
})(window.RPG);
