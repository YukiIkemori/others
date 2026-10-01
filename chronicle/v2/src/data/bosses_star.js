// オルビス高原のボスと、学院の騒ぎの戦い（BATTLE の形。WORLD_REDESIGN §4.8・§4.10・E18、STORY_BIBLE §7.8）。数値 s は tools/sim_bosses.js の 3 本立てで合わせる。
//   天球の番人 tr_b_orrery（星読みの塔 1 階の奥の中ボス）: 日・月・星の玉を順に撃つ（今の読める型）。輪がそろう（予告）→ 次の手番に天球の光（全体。守る）。
//   星食らい tr_b_stareater（塔の頂、地方ボス）: 星を呑みこもうと大口を開ける（予告）→ 次の手番に虚ろの渦（全体。守る）。
//       星を吐く・虚ろの牙（今の行動）。HP が半分を切ると光に弱くなる（今の第 2 の姿）。
//   学院の騒ぎ tr_star_riot_1〜3（見回りに見つかって「押し通る」を選んだとき。守衛が呼ぶ夜番の鎧と機巧の番兵）。ティアで強さが変わる
(function (R) {
  'use strict';
  const SCHED = 200;
  const A = (list) => list.map(([id, w, cond]) => (cond ? { id, w, cond } : { id, w }));
  const L = R.DB.monsters;
  Object.assign(R.DB.bossActions, {
    eb_orrery_align: { name: R.T('bossActions.eb_orrery_align.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_orrery_align.msg'),
      telegraph: { text: R.T('bossActions.eb_orrery_align.telegraph.text'), pose: 'tele', tint: '#ffe6a0', next: 'eb_orrery_beam', guard: 'defend', lethal: true } },
    eb_orrery_beam: { name: R.T('bossActions.eb_orrery_beam.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.9, guardPct: 0.08, kind: 'blunt', element: 'light' }], fx: 'holy2', msg: R.T('bossActions.eb_orrery_beam.msg') },
    eb_star_gulp: { name: R.T('bossActions.eb_star_gulp.name'), kind: 'enemy', target: 'self', effects: [], fx: 'tele', msg: R.T('bossActions.eb_star_gulp.msg'),
      telegraph: { text: R.T('bossActions.eb_star_gulp.telegraph.text'), pose: 'tele', tint: '#b8a0ff', next: 'eb_void_whirl', guard: 'defend', lethal: true } },
    eb_void_whirl: { name: R.T('bossActions.eb_void_whirl.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'special', id: 'desert_sweep', pct: 0.92, guardPct: 0.08, kind: 'blunt', element: 'dark' }], fx: 'dark3', msg: R.T('bossActions.eb_void_whirl.msg') },
    // 2026-10-01（ボスの組み直し）: 溜め（予告）の代わりに、天球儀・星を食べる魔物らしい手
    eb_orrery_eclipse: { name: R.T('bossActions.eb_orrery_eclipse.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'dispel', side: 'good' }, { type: 'status', status: 'blind', chance: 0.3 }], fx: 'dark2', msg: R.T('bossActions.eb_orrery_eclipse.msg') },
    eb_orrery_reverse: { name: R.T('bossActions.eb_orrery_reverse.name'), kind: 'enemy', target: 'self', effects: [{ type: 'special', id: 'boss_shift', elem: { light: 1.5, dark: 0.25 }, flag: 'orrery_night', msg: R.T('bossActions.eb_orrery_reverse.shift') }], fx: 'magic', msg: R.T('bossActions.eb_orrery_reverse.msg') },
    eb_star_night: { name: R.T('bossActions.eb_star_night.name'), kind: 'enemy', target: 'enemies', effects: [{ type: 'status', status: 'blind', chance: 0.4 }, { type: 'status', status: 'silence', chance: 0.3 }, { type: 'special', id: 'boss_field', flag: 'starless', msg: R.T('bossActions.eb_star_night.field') }, { type: 'buff', stat: 'mag', stages: 1, on: 'self' }], fx: 'dark3', msg: R.T('bossActions.eb_star_night.msg') },
    eb_star_devour: { name: R.T('bossActions.eb_star_devour.name'), kind: 'enemy', target: 'enemy', aim: 'caster', effects: [{ type: 'damage', formula: 'magic', power: 0.9, mp: true }, { type: 'damage', formula: 'magic', power: 0.8, element: 'dark', drain: 0.5 }], fx: 'drain', msg: R.T('bossActions.eb_star_devour.msg') },
  });
  const O = L.b_orrery;
  if (O) {
    // 2026-10-01（ボスの組み直し）: 前は 日 → 月 → 輪がそろう（予告）→ 天球の光 → 星 の 4 手番の決まった順。溜めはやめ、順も決めない。
    //   日の玉（火・1 人）・月の玉（水・全体）・星の玉（光・ばらまき）・日食（強化を消す・目つぶし）・逆回り（光と闇の弱点が入れ替わる）・軌道の盾
    O.actions = A([['attack', 1], ['eb_sun_orb', 3], ['eb_moon_orb', 3], ['eb_star_orb', 3], ['eb_orrery_eclipse', 1, { round: 2 }],
      ['eb_orrery_reverse', 2, { hpBelow: 0.7, noFlag: 'orrery_night' }], ['eb_orbit_shield', 2, { hpBelow: 0.6, once: true }]]);
    O.desc = R.T('data.bosses_star.desc');
    O.s = { hp: 1.15, atk: 1.4, mag: 1.4 };
  }
  const S = L.b_stareater;
  if (S) {
    // 2026-10-01（ボスの組み直し）: 前は 2 ラウンドごとに必ず 大口（予告）→ 虚ろの渦、3 手番ごとに星を呑む の決まった順。溜めはやめた。
    //   重い手（虚ろの牙（吸う）・星を吐く（ばらまき）・闇の爆発・名を食む（術の人の MP を食う））＋ 軽い手（星を呑む（回復・魔力）・星を消す夜（目つぶし・沈黙）・ふつうの攻撃）
    const HV = { every: [2, 0] }, LT = { every: [2, 1] };
    S.actions = A([['eb_void_fang', 3, HV], ['eb_star_spit', 2, HV], ['eb_dark_nova', 2, HV], ['eb_star_devour', 2, HV],
      ['attack', 2, LT], ['eb_swallow_star', 2, { every: [2, 1], hpBelow: 0.8 }], ['eb_star_night', 1, { every: [2, 1], noFlag: 'starless' }]]);
    S.desc = R.T('data.bosses_star.desc_2');
    S.s = { hp: 0.62, atk: 0.59, mag: 0.59 };   // 2026-10-01: 地方ボスの通常の技が 1 人の最大 HP の 3〜4% しか削らず弱すぎた（オーナー「砂の王が弱すぎる」→ 地方ボス全体を見直し）。atk・mag を約 1.6 倍（sim_bosses）
  }
  const T = R.DB.troops;
  const riot = (mons) => ({ mons, noEscape: true, scale: 'tier', lvOff: 0, bg: 'tower', bgm: 'battle' });
  Object.assign(T, {
    tr_star_riot_1: riot([['@armor', 1], ['@automaton', 1]]),
    tr_star_riot_2: riot([['@automaton', 2], ['@armor', 1]]),
    tr_star_riot_3: riot([['@armor', 2], ['@automaton', 1]]),
  });
})(window.RPG);
