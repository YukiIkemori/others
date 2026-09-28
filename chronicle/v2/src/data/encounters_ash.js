// BATTLE（灰の荒野）: 灰の荒野の出現表（WORLD_REDESIGN §4.7・§6.5・§2.2、V2_PLAN §3.6 の形）。移した表 zw_ash・z_r_ash_volcano は残し、
//   縦切りの形（ティアで段が変わる '@<系統>'、組の数は tools/sim_zones.js の標準の一行で合わせる）で新しく書いた。
//   灰の荒野はどの順でも来られる（T1 から）。縦切りの後のダンジョンは 1 組 4〜5 匹まで（持ち主の決まり）。数は sim_zones で合わせた。
//   zw_ash_plain     灰の原（溶岩の原・黒い砂浜のまわり）   zw_ash_road   灰の街道と潮見橋の道（率 0.3）
//   zw_ash_spa       湯の郷（#25、湯けむり猿の巣）          zw_ash_beach  火山ガメの浜（#26、火山ガメの巣）
//   z_ash_volcano    灰の火山 1 階                          z_ash_crater  火口
(function (R) {
  'use strict';
  const G = (w, mons, o) => Object.assign({ w, mons }, o || {});
  Object.assign(R.DB.encounters, {
    zw_ash_plain: { region: 'r_ash', tier: 'dyn', lvOff: 0, bg: 'ash', groups: [
      G(8, [['@salamander', 2, 3]]),
      G(8, [['@imp', 2, 3]]),
      G(6, [['@orc', 1, 1], ['@imp', 1, 2]]),
      G(5, [['@salamander', 1, 2], ['@imp', 1, 1]]),
      G(4, [['@chimera', 1, 1], ['@salamander', 1, 1]]),
      G(3, [['@imp', 3, 4]]),
    ] },
    zw_ash_road: { region: 'r_ash', tier: 'dyn', lvOff: 0, bg: 'ash', rate: 0.3, groups: [
      G(8, [['@salamander', 2, 3]]),
      G(7, [['@imp', 2, 2]]),
      G(4, [['@salamander', 1, 1], ['@imp', 1, 2]]),
    ] },
    zw_ash_spa: { region: 'r_ash', tier: 'dyn', lvOff: 0, bg: 'ash', groups: [
      G(8, [['@salamander', 2, 3]]),
      G(6, [['@imp', 2, 3]]),
    ] },
    zw_ash_beach: { region: 'r_ash', tier: 'dyn', lvOff: 0, bg: 'ash', groups: [
      G(8, [['@salamander', 2, 3]]),
      G(6, [['@orc', 1, 1], ['@salamander', 1, 1]]),
    ] },
    z_ash_volcano: { region: 'r_ash', tier: 'dyn', lvOff: 1, bg: 'ash', groups: [
      G(9, [['@salamander', 2, 3]]),
      G(8, [['@gargoyle', 2, 2]]),
      G(7, [['@imp', 2, 3]]),
      G(6, [['@gargoyle', 1, 1], ['@salamander', 1, 2]]),
      G(4, [['@imp', 4, 5]]),
      G(3, [['@salamander', 4, 4]]),
    ] },
    z_ash_crater: { region: 'r_ash', tier: 'dyn', lvOff: 1, bg: 'ash', groups: [
      G(8, [['@gargoyle', 2, 2]]),
      G(7, [['@salamander', 2, 3]]),
      G(6, [['@chimera', 1, 1], ['@imp', 1, 2]]),
      G(4, [['@imp', 4, 5]]),
      G(3, [['@gargoyle', 1, 1], ['@salamander', 3, 3]]),
    ] },
  });
  // レア魔物（湯けむり猿は湯の郷、火山ガメは黒い砂浜と火山）
  Object.assign(R.DB.rareEncounters, {
    zw_ash_plain: { mon: 'rm_volcano_turtle', rate: 160 },
    zw_ash_road: { mon: 'rm_spa_monkey', rate: 160 },
    zw_ash_spa: { mon: 'rm_spa_monkey', rate: 16 },
    zw_ash_beach: { mon: 'rm_volcano_turtle', rate: 16 },
    z_ash_volcano: { mon: 'rm_volcano_turtle', rate: 80 },
    z_ash_crater: { mon: 'rm_spa_monkey', rate: 120 },
  });
})(window.RPG);
