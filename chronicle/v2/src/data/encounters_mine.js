// BATTLE（ガルド山地）: 山地の出現表（移した表 zw_mine・z_r_mine_mine はそのまま使う。ティアで段が変わる '@<系統>'）。
//   持ち主の決まり（縦切りの後の地方）: 1 組は 5 匹まで。二種の組は、先の種の最大を減らして 5 匹までにする（重みと段はそのまま）。
(function (R) {
  'use strict';
  for (const z of ['zw_mine', 'z_r_mine_mine']) {
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
  // (2026-09-30) 深淵の鉱脈（#17）: 坑道の表（z_r_mine_mine）の組のまま一段深く（lvOff 2）。2 階の西の岩屋は宝石ハリネズミの巣（レアの率が高い）
  R.onData(function () {
    const src = R.DB.encounters.z_r_mine_mine;
    if (!src) return;
    const copy = (o) => Object.assign(JSON.parse(JSON.stringify(src)), { region: 'r_mine', lvOff: 2 }, o || {});
    if (!R.DB.encounters.z_mine_vein) R.DB.encounters.z_mine_vein = copy();
    if (!R.DB.encounters.z_mine_vein_nest) R.DB.encounters.z_mine_vein_nest = copy();
    Object.assign(R.DB.rareEncounters, { z_mine_vein: { mon: 'rm_gem_hedgehog', rate: 60 }, z_mine_vein_nest: { mon: 'rm_gem_hedgehog', rate: 12 } });
  });
})(window.RPG);
