// CAST: 骨組みのポーズと、ポーズの間のつなぎ（tween）。V2_PLAN §2.5.7 の戦闘のポーズの名前と、顔の表情。
//   R.Art.rig.pose(name, extra) → 骨の角度の組     R.Art.rig.lerp(a, b, t)     R.Art.rig.sample(timeline, t)
//   R.Art.rig.BATTLE[pose] = [[骨のポーズ, extra]…]  戦闘のポーズごとのコマ（間のコマは lerp で作る）
//   R.Art.rig.EXPR[expr] = extra                     表情（neutral smile sad angry surprise）
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});

  const P0 = { x: 0, y: 0, rot: 0, lean: 0.04, tilt: 0, br: 0, aN: 0.45, eN: 0.9, aF: -0.15, eF: 0.55, lN: 0.28, kN: -0.25, lF: -0.22, kF: -0.12,
    w: 2.1, cape: 0, eyes: 1, mouth: 0, sq: 0, air: 0, glow: 0, smear: 0, brow: 0, browUp: 0, happy: 0, mouthDown: 0 };
  // プロトの 11 ポーズ＋足した物（thrust・shoot・guard・item・weak・evade・draw）
  const POSES = {
    idle: {},
    ready: { lean: 0.12, aN: 0.7, eN: 0.8, w: 1.55, lN: 0.45, kN: -0.55, lF: -0.35, kF: -0.25 },
    step: { lean: 0.2, lN: 0.6, kN: -0.5, lF: -0.5, kF: -0.3, aF: -0.5, aN: 0.5, eN: 0.8, w: 1.9, cape: 0.8 },
    windup: { lean: -0.12, tilt: -0.08, aN: -2.4, eN: -0.3, w: -2.2, aF: 0.6, eF: 0.8, lN: 0.5, kN: -0.6, lF: -0.4, kF: -0.3, cape: 0.3 },
    slash: { lean: 0.38, tilt: 0.12, aN: 1.35, eN: 0.25, w: 1.35, aF: -0.6, eF: 0.4, lN: 0.8, kN: -0.7, lF: -0.55, kF: -0.1, cape: 1, smear: 1, sq: 0.5, mouth: 1 },
    follow: { lean: 0.3, aN: 0.5, eN: 0.35, w: 0.6, aF: -0.5, eF: 0.4, lN: 0.75, kN: -0.8, lF: -0.5, kF: -0.15, cape: 0.8, sq: 0.3 },
    thrust_ready: { lean: -0.05, aN: -0.2, eN: 1.9, w: 1.57, aF: 0.3, eF: 0.9, lN: 0.5, kN: -0.6, lF: -0.45, kF: -0.3, cape: 0.2 },
    thrust: { lean: 0.42, tilt: 0.1, aN: 1.45, eN: 0.05, w: 1.5, aF: -0.9, eF: 0.4, lN: 0.95, kN: -0.6, lF: -0.7, kF: -0.1, cape: 1, sq: 0.4, mouth: 1 },
    smash_up: { lean: -0.2, tilt: -0.12, aN: -2.9, eN: -0.1, w: -2.9, aF: -2.6, eF: -0.2, lN: 0.35, kN: -0.4, lF: -0.3, kF: -0.2, cape: 0.2 },
    smash: { lean: 0.5, tilt: 0.18, aN: 1.1, eN: 0.35, w: 1.9, aF: 0.9, eF: 0.6, lN: 0.9, kN: -1.0, lF: -0.6, kF: -0.3, cape: 1, sq: 0.6, mouth: 1 },
    draw: { lean: -0.04, aN: 1.4, eN: 0.2, w: 1.57, aF: 1.45, eF: -0.9, lN: 0.4, kN: -0.4, lF: -0.4, kF: -0.2, cape: 0.2 },
    shoot: { lean: -0.08, aN: 1.5, eN: 0.05, w: 1.57, aF: 0.9, eF: -1.3, lN: 0.4, kN: -0.4, lF: -0.45, kF: -0.25, cape: 0.5, sq: 0.4 },
    cast: { lean: -0.06, tilt: -0.1, aN: 1.55, eN: 0.25, w: 2.6, aF: 1.6, eF: 0.4, lN: 0.2, kN: -0.15, lF: -0.2, kF: -0.1, cape: 0.6, glow: 1, eyes: 0.5 },
    cast_up: { lean: -0.1, tilt: -0.2, aN: -2.7, eN: 0.1, w: -2.8, aF: -2.4, eF: -0.3, lN: 0.2, kN: -0.15, lF: -0.2, kF: -0.1, cape: 0.7, glow: 1, eyes: 0.4 },
    item: { lean: 0.02, aN: 1.9, eN: -0.4, w: 2.4, aF: 1.3, eF: 0.4, lN: 0.25, kN: -0.2, lF: -0.2, kF: -0.1, mouth: 0 },
    guard: { lean: -0.12, tilt: 0.05, aN: 0.1, eN: 2.1, w: -0.2, aF: 0.8, eF: 1.8, lN: 0.55, kN: -0.7, lF: -0.5, kF: -0.35, cape: -0.2, sq: 0.5 },
    hurt: { x: -3, lean: -0.35, tilt: -0.25, aN: -0.3, eN: 0.6, w: 2.8, aF: -0.9, eF: 0.3, lN: 0.35, kN: -0.3, lF: -0.5, kF: -0.3, cape: -0.6, eyes: 0, sq: 1, mouth: 1 },
    weak: { lean: 0.32, tilt: 0.24, aN: 0.25, eN: 0.35, w: 2.9, aF: 0.6, eF: 0.9, lN: 0.95, kN: -1.2, lF: -0.3, kF: -0.8, cape: -0.2, eyes: 0.55, sq: 0.6, brow: -1 },
    kneel: { y: 0, lean: 0.35, tilt: 0.3, aN: 0.1, eN: 0.25, w: 3.0, aF: 0.5, eF: 0.9, lN: 1.45, kN: -1.45, lF: -0.15, kF: -1.35, cape: -0.2, eyes: 0.5, sq: 0.6 },
    ko: { rot: -1.5, lean: -0.1, tilt: -0.1, aN: 0.3, eN: 0.2, w: 0.6, aF: -0.5, eF: 0.1, lN: 0.1, kN: -0.1, lF: -0.1, kF: -0.3, cape: -0.4, eyes: 0 },
    victory: { lean: -0.05, tilt: -0.15, aN: -2.65, eN: -0.15, w: -2.95, aF: -0.35, eF: 1.6, lN: 0.15, kN: -0.05, lF: -0.18, kF: -0.05, cape: 0.5, mouth: 2 },
    evade: { x: 4, lean: -0.28, tilt: -0.1, aN: 0.2, eN: 1.2, w: 2.4, aF: -0.6, eF: 0.8, lN: 0.1, kN: -0.6, lF: -0.7, kF: -0.4, cape: -0.4 },
  };
  rig.POSES = POSES;
  rig.pose = function (name, extra) { return Object.assign({}, P0, POSES[name] || {}, extra || {}); };
  rig.ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  rig.lerp = function (a, b, t) { const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? a[k] + ((b[k] != null ? b[k] : a[k]) - a[k]) * t : a[k]; return o; };
  /** timeline = [[t, pose, easeFn?]…] → t の時のポーズ（区間ごとに ease） */
  rig.sample = function (tl, t) {
    if (t <= tl[0][0]) return tl[0][1];
    for (let i = 1; i < tl.length; i++) if (t <= tl[i][0]) { const u = (t - tl[i - 1][0]) / (tl[i][0] - tl[i - 1][0]); return rig.lerp(tl[i - 1][1], tl[i][1], (tl[i][2] || rig.ease)(u)); }
    return tl[tl.length - 1][1];
  };

  // ---------- 戦闘のポーズ（§2.5.7）。1 コマ = [ポーズ名, extra]、'~a>b@t' は a と b の間（t）のつなぎのコマ
  // 系統ごとの攻撃: 剣 slash・大剣 smash・短剣 thrust・弓 shoot・杖 smash（BSCENE の ATTACK_POSE）。どの look もどの系統でも全部のポーズを持つ
  rig.BATTLE = {
    idle: [['idle', { br: 0 }], ['idle', { br: 0.5 }]],
    step: [['step']],
    windup: [['windup']],
    slash: [['windup'], ['slash'], ['follow']],
    thrust: [['thrust_ready'], ['thrust'], ['thrust']],
    smash: [['smash_up'], ['smash'], ['smash']],
    shoot: [['draw'], ['shoot'], ['shoot']],
    cast: [['cast'], ['cast_up'], ['cast_up'], ['cast']],
    item: [['item']],
    guard: [['guard']],
    hit: [['hurt'], ['~hurt>idle@0.35']],
    weak: [['weak']],
    ko: [['hurt'], ['ko']],
    victory: [['~idle>victory@0.5'], ['victory']],
    evade: [['evade']],
  };
  rig.BATTLE_FPS = { idle: 2, step: 10, windup: 8, slash: 9, thrust: 9, smash: 8, shoot: 7, cast: 5, item: 6, guard: 4, hit: 10, weak: 3, ko: 8, victory: 5, evade: 8 };
  // 系統ごとに武器の構えを少し変える（大剣は両手で肩にかつぐ・杖は立てる）
  rig.WTYPE_IDLE = {
    greatsword: { aN: 0.9, eN: 1.5, w: 2.5, aF: 0.4, eF: 1.3 },
    staff: { aN: 0.35, eN: 0.35, w: 3.05 },
    bow: { aN: 0.4, eN: 0.5, w: 3.1 },
    dagger: { aN: 0.6, eN: 1.1, w: 1.9 },
  };

  /** ['name', extra] または ['~a>b@t'] → 骨のポーズ */
  rig.frameSpec = function (spec, base) {
    const s = spec[0], extra = Object.assign({}, base || {}, spec[1] || {});
    const m = /^~(\w+)>(\w+)@([\d.]+)$/.exec(s);
    if (m) return rig.lerp(rig.pose(m[1], extra), rig.pose(m[2], extra), rig.ease(+m[3]));
    return rig.pose(s, extra);
  };

  // ---------- 表情（顔の仮の絵と会話の顔）
  rig.EXPR = {
    neutral: {},
    smile: { happy: 1, mouth: 2, browUp: 0.3 },
    sad: { eyes: 0.7, brow: -1, mouthDown: 1, tilt: 0.06 },
    angry: { sq: 0.7, brow: 1, mouth: 0 },
    surprise: { eyes: 1.3, browUp: 1.2, mouth: 1 },
  };
})(window.RPG);
