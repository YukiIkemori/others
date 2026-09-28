// BATTLE（湿原）: グレイモア湿原の出現表（WORLD_REDESIGN §4.4・§6.5・§2.2、V2_PLAN §3.6 の形）。移した表 zw_marsh・z_r_marsh_manor・z_r_marsh_bog は残し、
//   縦切りの形（ティアで段が変わる '@<系統>'、組の数は tools/sim_zones.js の標準の一行で合わせる）で新しく書いた。
//   湿原はどの順でも来られる（T1 から）。縦切りの後のダンジョンは 1 組 4〜5 匹まで（持ち主の決まり）。数は sim_zones で合わせた。
//   zw_marsh         湿原の原野（沼・葦原）             zw_marsh_road   湿原の街道と、山あいの街道（率 0.3）
//   zw_marsh_lotus   はすの池（#22、はすの精の巣）       z_marsh_manor   霧の館（1・2 階）
//   z_marsh_bog      鐘沈みの沼
(function (R) {
  'use strict';
  const G = (w, mons, o) => Object.assign({ w, mons }, o || {});
  Object.assign(R.DB.encounters, {
    zw_marsh: { region: 'r_marsh', tier: 'dyn', lvOff: 0, bg: 'marsh', groups: [
      G(8, [['@frog', 2, 3]]),
      G(8, [['@lizardman', 2, 3]]),
      G(6, [['@wisp', 2, 3]]),
      G(6, [['@frog', 1, 2], ['@lizardman', 1, 1]]),
      G(5, [['@ghost', 1, 2], ['@wisp', 1, 1]]),
      G(3, [['@jelly', 3, 4]]),
    ] },
    zw_marsh_road: { region: 'r_marsh', tier: 'dyn', lvOff: 0, bg: 'marsh', rate: 0.3, groups: [
      G(8, [['@frog', 2, 3]]),
      G(7, [['@lizardman', 2, 2]]),
      G(5, [['@wisp', 2, 3]]),
      G(4, [['@frog', 1, 1], ['@lizardman', 1, 2]]),
    ] },
    zw_marsh_lotus: { region: 'r_marsh', tier: 'dyn', lvOff: 0, bg: 'marsh', groups: [
      G(8, [['@frog', 2, 3]]),
      G(6, [['@wisp', 2, 3]]),
      G(4, [['@jelly', 3, 4]]),
    ] },
    z_marsh_manor: { region: 'r_marsh', tier: 'dyn', lvOff: 1, bg: 'tower', groups: [
      G(9, [['@ghost', 2, 3]]),
      G(8, [['@doll', 2, 3]]),
      G(6, [['@spider', 2, 3]]),
      G(6, [['@doll', 1, 2], ['@ghost', 1, 2]]),
      G(5, [['@spider', 1, 2], ['@wisp', 2, 3]]),
      G(3, [['@wisp', 4, 5]]),
      G(1.5, [['@mimic', 1, 1]], { solo: true }),
    ] },
    z_marsh_bog: { region: 'r_marsh', tier: 'dyn', lvOff: 1, bg: 'marsh', groups: [
      G(9, [['@frog', 2, 3]]),
      G(7, [['@lizardman', 2, 2]]),
      G(6, [['@frog', 1, 2], ['@wisp', 1, 1]]),
      G(5, [['@ghost', 1, 2], ['@frog', 1, 2]]),
      G(3, [['@mushroom', 3, 4]]),
      G(3, [['@wisp', 4, 5]]),
    ] },
  });
  // レア魔物（はすの精の巣は はすの池、鐘カタツムリは沼、幽霊ティーポットは館）
  Object.assign(R.DB.rareEncounters, {
    zw_marsh: { mon: 'rm_lotus_sprite', rate: 120 },
    zw_marsh_road: { mon: 'rm_lotus_sprite', rate: 160 },
    zw_marsh_lotus: { mon: 'rm_lotus_sprite', rate: 16 },
    z_marsh_manor: { mon: 'rm_ghost_teapot', rate: 80 },
    z_marsh_bog: { mon: 'rm_bell_snail', rate: 60 },
  });
})(window.RPG);
