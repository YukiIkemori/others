// BATTLE（マレア諸島）: 諸島の出現表（移した表 zw_isles・z_r_isles_cave・z_r_isles_ship はそのまま使う。ティアで段が変わる '@<系統>'）。
//   持ち主の決まり（縦切りの後の地方）: 1 組は 5 匹まで。二種の組（半魚人＋クラゲ・骨＋ネズミ など、最大 3＋3 = 6）は、
//   先の種の最大を 1 つ減らして 5 匹までにする（重みと段はそのまま。平均の数はほとんど変わらない）。
(function (R) {
  'use strict';
  for (const z of ['zw_isles', 'z_r_isles_cave', 'z_r_isles_ship']) {
    const t = R.DB.encounters[z];
    if (!t) continue;
    for (const g of t.groups) {
      let n = g.mons.reduce((a, m) => a + m[2], 0);
      for (let i = 0; n > 5 && i < g.mons.length; i++) {
        const m = g.mons[i];
        const cut = Math.min(n - 5, m[2] - m[1]);
        if (cut > 0) { g.mons[i] = [m[0], m[1], m[2] - cut].concat(m.slice(3)); n -= cut; }
      }
    }
  }
})(window.RPG);
