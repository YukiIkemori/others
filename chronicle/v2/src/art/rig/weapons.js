// CAST: 武器の形（仮の絵の骨組み用。系統 5 つ: sword greatsword dagger bow staff、A29）。プロトの weapon から移して大剣・短剣を足した。
// 原画のある人は武器の画像を持ち手（grip）に付ける（cast/sprites.js）。こちらは骨組みの手に描く。
//   R.Art.rig.weapons.draw(ctx) → {grip, tip}（モデル座標、変換の前）
//   R.Art.rig.weapons.WTYPES
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});
  const W = (rig.weapons = rig.weapons || {});
  W.WTYPES = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];

  W.draw = function (c) {
    const { L, grp, E, C, Pl, F, M, p } = c;
    const h = c.hand, zs = 3;
    const a = p.w; const d = [Math.sin(a), Math.cos(a)];
    const at = (t, o) => [h[0] + d[0] * t + d[1] * (o || 0), h[1] + d[1] * t - d[0] * (o || 0)];
    const blade = L.bladeM || M.steel, hilt = L.hiltM || M.gold;
    switch (c.wtype) {
      case 'sword': {
        const gb = grp('blade');
        C(at(-2.4), at(1.8), 0.9, 0.9, M.leatherDk, 8.5 + zs, { g: grp('grip') });
        E(at(-2.9)[0], at(-2.9)[1], 1.2, 1.2, hilt, 8.51 + zs, { g: grp('pommel') });
        C(at(1.9, -3.6), at(1.9, 3.6), 0.95, 0.95, hilt, 8.6 + zs, { g: grp('guard') });
        Pl([at(2.3, -1.45), at(2.3, 1.45), at(17, 1.1), at(19.6, 0), at(17, -1.1)], blade, 8.55 + zs, { g: gb, bevel: 1.4 });
        F(at(3), at(17), 0.45, gb, 1.5);
        return { grip: h, tip: at(19.6) };
      }
      case 'greatsword': {
        const gb = grp('gblade');
        C(at(-5), at(1.8), 1.0, 1.0, M.leatherDk, 8.5 + zs, { g: grp('grip') });
        E(at(-5.6)[0], at(-5.6)[1], 1.4, 1.4, hilt, 8.51 + zs, { g: grp('pommel') });
        C(at(2.1, -4.8), at(2.1, 4.8), 1.1, 1.1, hilt, 8.6 + zs, { g: grp('guard') });
        Pl([at(2.6, -2.3), at(2.6, 2.3), at(22, 2.0), at(26, 0), at(22, -2.0)], blade, 8.55 + zs, { g: gb, bevel: 1.8 });
        F(at(3.5), at(22), 0.6, gb, 1.5);
        return { grip: h, tip: at(26) };
      }
      case 'dagger': {
        const gb = grp('dblade');
        C(at(-1.8), at(1.4), 0.8, 0.8, M.leatherDk, 8.5 + zs, { g: grp('grip') });
        C(at(1.5, -2.2), at(1.5, 2.2), 0.7, 0.7, hilt, 8.6 + zs, { g: grp('guard') });
        Pl([at(1.9, -1.1), at(1.9, 1.1), at(9, 0.6), at(11, 0), at(9, -0.6)], blade, 8.55 + zs, { g: gb, bevel: 1.1 });
        return { grip: h, tip: at(11) };
      }
      case 'staff': {
        C(at(-9), at(15), 0.9, 0.8, M.wood, 8.5 + zs, { g: grp('staff') });
        const o = at(17.5);
        C(at(14, -2), at(19, -2.6), 0.6, 0.4, hilt, 8.52 + zs, { g: grp('claw1') });
        C(at(14, 2), at(19, 2.6), 0.6, 0.4, hilt, 8.52 + zs, { g: grp('claw2') });
        E(o[0], o[1], 2.6, 2.6, L.orbM || R.Hd.RZ.mat({ keys: ['#1c0c40', '#4a2cb0', '#9a7cff', '#e8dcff'], n: 6, spec: 1, specPow: 6 }), 8.53 + zs, { g: grp('orb') });
        return { grip: h, tip: o };
      }
      case 'bow': {
        // 弓は手前の手（前に伸ばす手）に持ち、引いた構えでは弦を奥の手へ（顔の近く）
        const hf = c.handF;
        const g = grp('bow');
        const up = h;
        const c1 = [up[0] + 1.5, up[1] - 12], c2 = [up[0] + 1.5, up[1] + 12];
        C(c1, [up[0] + 5, up[1] - 5], 0.7, 1.0, M.wood, 8.5 + zs, { g });
        C([up[0] + 5, up[1] - 5], [up[0] + 5.5, up[1] + 5], 1.0, 1.0, M.wood, 8.5 + zs, { g });
        C([up[0] + 5.5, up[1] + 5], c2, 1.0, 0.7, M.wood, 8.5 + zs, { g });
        const str = R.Hd.RZ.mat({ keys: ['#b8b096', '#e0dccc'], n: 2, flat: true, noOutline: true });
        const pull = p.aF > 0.6 && p.eF < -0.5;   // 引いた構え
        const mid = pull ? hf : [up[0] + 1.5, up[1]];
        C(c1, mid, 0.28, 0.28, str, 8.4 + zs, { g: grp('string') });
        C(mid, c2, 0.28, 0.28, str, 8.4 + zs, { g: grp('string2') });
        if (pull) { C(hf, [up[0] + 9, up[1]], 0.35, 0.35, M.wood, 8.4 + zs, { g: grp('arrow') }); Pl([[up[0] + 9, up[1] - 1.2], [up[0] + 12, up[1]], [up[0] + 9, up[1] + 1.2]], M.iron, 8.41 + zs, { g: grp('head'), bevel: 0.5 }); }
        return { grip: up, tip: [up[0] + 12, up[1]] };
      }
    }
    return null;
  };
})(window.RPG);
