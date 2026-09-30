// オルビス高原のボスと、学院の騒ぎの戦い（BATTLE の形。WORLD_REDESIGN §4.8・§4.10・E18、STORY_BIBLE §7.8）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   天球の番人 tr_b_orrery（星読みの塔 1 階の奥の中ボス）: 日・月・星の玉を順に撃つ（今の読める型）。輪がそろう（予告）→ 次の手番に天球の光（全体。守る）。
//   星食らい tr_b_stareater（塔の頂、地方ボス）: 星を呑みこもうと大口を開ける（予告）→ 次の手番に虚ろの渦（全体。守る）。
//       星を吐く・虚ろの牙（今の行動）。HP が半分を切ると光に弱くなる（今の第 2 の姿）。
//   学院の騒ぎ tr_star_riot_1〜3（見回りに見つかって「押し通る」を選んだとき。守衛が呼ぶ夜番の甲冑と機巧の番兵）。ティアで強さが変わる
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_orrery_align: { name: '輪がそろう', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '天球儀の輪がきしみ、日と月と星が一列にそろっていく……！',
      telegraph: { text: '輪がそろう。次の手番に天球の光', pose: 'tele', tint: '#ffe6a0', next: 'eb_orrery_beam', guard: 'defend', lethal: true } },
    eb_orrery_beam: { name: '天球の光', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.9, guardPct: 0.08, kind: 'blunt', element: 'light' }], fx: 'holy2', msg: 'そろった輪から、白い光がほとばしった！' },
    eb_star_gulp: { name: '大口を開ける', kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: '星食らいが、夜空ごと呑みこむように大口を開けた……！',
      telegraph: { text: '大口を開けた。次の手番に虚ろの渦', pose: 'tele', tint: '#b8a0ff', next: 'eb_void_whirl', guard: 'defend', lethal: true } },
    eb_void_whirl: { name: '虚ろの渦', kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'dark' }], fx: 'dark3', msg: '呑みこんだ闇が、渦になって吹き出した！' },
  });
  const O = L.b_orrery;
  if (O) {
    O.actions = A([['attack', 1], ['eb_sun_orb', 300, { every: [4, 0] }], ['eb_moon_orb', 300, { every: [4, 1] }], ['eb_star_orb', 300, { every: [4, 3] }],
      ['eb_orbit_shield', 1, { hpBelow: 0.6, once: true }], ['eb_orrery_align', SCHED, { every: [4, 2] }]]);
    O.desc = '星読みの塔を守る、動く天球儀。\n日・月・星の玉を順に撃ち、輪がそろうと\n天球の光を放つ。そろったら守ること。';
    O.s = { hp: 1.15, atk: 1.4, mag: 1.4 };
  }
  const S = L.b_stareater;
  if (S) {
    S.actions = A([['attack', 2], ['eb_swallow_star', 2, { every: [3, 2] }], ['eb_star_spit', 2], ['eb_void_fang', 2], ['eb_star_gulp', SCHED, { every: [4, 3] }]]);
    S.desc = '名を失った星を食べてきた虚ろの使い。\n大口を開けたら、次は虚ろの渦。守ること。\n弱ると光がよく効く。';
    S.s = { hp: 0.62, atk: 0.37, mag: 0.37 };
  }
  const T = R.DB.troops;
  const riot = (mons) => ({ mons, noEscape: true, scale: 'tier', lvOff: 0, bg: 'tower', bgm: 'battle' });
  Object.assign(T, {
    tr_star_riot_1: riot([['@armor', 1], ['@automaton', 1]]),
    tr_star_riot_2: riot([['@automaton', 2], ['@armor', 1]]),
    tr_star_riot_3: riot([['@armor', 2], ['@automaton', 1]]),
  });
})(window.RPG);
