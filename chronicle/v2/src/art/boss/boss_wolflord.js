// BEAST: ボス 狼の群れ頭（tr_a21_forest_wolves の頭）— hd:boss:boss_wolflord
// 狼の土台（mons/bases_b.js の wolf）の大きい変化形。炭色の毛に銀のたてがみ、傷の走る顔に赤く光る目 1 つが視線の的。
// 予告の構え tele: 遠吠え（頭を上げ、口を開き、白い息）— 次の手番に狼が 1 匹増える。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  const spec = {
    tier: 'boss', at: 0.12, h: 60,
    pal: {
      fur: { keys: ['#100e22', '#201e38', '#34344c', '#4c4c62', '#6c6c7e', '#9494a0'], n: 8, wrap: 0.22, amb: 0.12, rim: '#fff4e0', tex: 2.2, tsx: 0.35, tsy: 1.3 },
      furDk: { keys: ['#0c0a1c', '#18162c', '#28263e', '#3c3a52', '#565468'], n: 7, wrap: 0.22, amb: 0.1, tex: 2.0, tsx: 0.35, tsy: 1.3 },
      belly: { keys: ['#2a2848', '#4a4a66', '#76768a', '#a8a8b4', '#dedee2'], n: 7, wrap: 0.3, amb: 0.16, tex: 1.6, tsx: 0.35, tsy: 1.3 },
      mane: { keys: ['#2a2a48', '#50506c', '#8484a0', '#b8b8c8', '#ececf0'], n: 7, wrap: 0.35, amb: 0.18, tex: 2, tsx: 0.35, tsy: 1.3 },
      nose: { keys: ['#0e0c1a', '#262434', '#46445a'], n: 4, spec: 1, fixed: true },
      eye: { keys: ['#e02020', '#ffb070'], n: 2, flat: true, glow: '#ff5040', fixed: true, noGold: true },
      gums: { keys: ['#3a0c1c', '#7a2a3c'], n: 2, flat: true, fixed: true },
      white: { keys: ['#e8e4dc', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true },
      claw: { keys: ['#1a1624', '#3a3444'], n: 2, flat: true, fixed: true },
      scar: { keys: ['#8a6a78', '#c8a8b0'], n: 2, flat: true, fixed: true },
      breath: { keys: ['#a8c8e8', '#e8f8ff'], n: 2, flat: true, alpha: 0.6, noOutline: true, fixed: true, noGold: true },
    },
    draw(B, P, st, RZ) {
      const W = BZ.BASES && BZ.BASES.wolf;
      if (!W) return {};
      const st2 = Object.assign({}, st, { stage: 2, howl: st.tele ? 1 : 0 });
      const pts = W.draw(B, P, st2, RZ);
      // たてがみ（首から肩へ銀の毛の束）
      const c = pts.spine ? pts.spine[0] : [8, -36];
      for (let i = 0; i < 9; i++) {
        const a = -2.4 + i * 0.3, r = 10 + (i % 3) * 2;
        const o = [c[0] + 2 + C(a) * 2, c[1] + 2 + S(a) * 2];
        B.strand([o, [o[0] - 3 + C(a) * r * 0.4, o[1] - 4 + S(a) * r * 0.4], [o[0] - 7 + C(a) * r * 0.8, o[1] + 2 + S(a) * r * 0.6]], 3, 0.4, P.mane, 1.75 + i * 0.01, { seg: 5, shadeOff: (i % 3) - 1 });
      }
      // 背の逆立った毛
      (pts.spine || []).forEach((q, i) => B.strand([[q[0] + 1, q[1] + 2], [q[0] - 2, q[1] - 4], [q[0] - 6, q[1] - 5]], 2.6, 0.3, P.furDk, 1.3 + i * 0.01, { seg: 4 }));
      // 顔の傷（目を横切る）
      if (pts.eye) B.cap(pts.eye[0] - 5, pts.eye[1] - 5, pts.eye[0] + 1, pts.eye[1] + 4, 0.5, 0.45, P.scar, 2.35, { noAO: true });
      // 遠吠えの白い息
      if (st.tele && pts.mouth) {
        const m = pts.mouth;
        [[4, -6, 3], [8, -12, 2.4], [11, -18, 1.8]].forEach(([dx, dy, r], i) => B.ell(m[0] + dx, m[1] + dy, r * 1.3, r, P.breath, 2.5 + i * 0.01, { noOutline: true, noAO: true }));
      }
      pts.eyes = pts.eye ? [[pts.eye[0], pts.eye[1], 1.4]] : [];
      return pts;
    },
  };
  (BZ._bossDefs = BZ._bossDefs || []).push(['boss_wolflord', spec]);
})(window.RPG);
