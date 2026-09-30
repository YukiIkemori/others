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
    eb_octo_dive: { name: 'もぐる', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '大ダコが、深みへ沈んでいく……！',
      telegraph: { text: '水面が大きく渦を巻きはじめた。', pose: 'tele', tint: '#8ad0ff', next: 'eb_octo_surge', guard: 'defend', lethal: true } },
    eb_octo_surge: { name: '大渦', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.88, guardPct: 0.08, kind: 'blunt', element: 'water' }], fx: 'water', msg: '洞窟の水が、渦になって押し寄せた！' },
    eb_captain_aim: { name: '火縄', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '船長が、船べりの大砲へ青い火縄を回した……！',
      telegraph: { text: '大砲の口が、いっせいにこちらを向いた。', pose: 'tele', tint: '#9fd8ff', next: 'eb_broadside', guard: 'defend', lethal: true } },
    eb_broadside: { name: '一斉砲火', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'fire' }], fx: 'explosion', msg: '青い火の砲弾が、船室をなぎはらった！' },
  });
  const O = L.b_octopus;
  if (O) {
    O.actions = A([['attack', 2], ['eb_ink_cloud', 1, { every: [3, 0] }], ['eb_crush_hug', 2], ['eb_regrow', 2, { every: [3, 2], countBelow: 3 }],
      ['eb_whirl', 1], ['eb_octo_dive', SCHED, { every: [4, 1] }]]);
    O.desc = '潮鳴りの洞窟の深みに棲む大ダコ。\n水面が渦を巻いたら、次の手番に大渦が来る。守って耐えよう。\n足を切っても、すぐに生やしてくる。';
    O.s = { hp: 1.1, atk: 0.72, mag: 0.72 };
  }
  const C = L.b_captain;
  if (C) {
    C.actions = A([['attack', 2], ['eb_cutlass', 2], ['eb_fire_volley', 1], ['eb_ghost_shanty', 1, { every: [6, 5] }],
      ['eb_call_crew', 1, { every: [5, 1], countBelow: 3 }], ['eb_anchor_throw', 1], ['eb_captain_aim', SCHED, { every: [4, 3] }]]);
    C.desc = '六十年前に帰らなかった船長の亡霊。舟歌の続きを思い出せずにいる。\n大砲へ火縄を回したら、次の手番に一斉砲火。守って耐えよう。\n光と火がよく効く。';
    C.s = { hp: 0.47, atk: 0.27, mag: 0.27 };
  }
})(window.RPG);
