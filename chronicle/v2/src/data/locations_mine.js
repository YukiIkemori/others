// CONTENT（ガルド山地）: 山地の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: 鉱山都市ドヴァン（鉱石の谷の門の奥）。ダンジョンの入口: 深き坑道（ドヴァンの下の段の奥）。場所: 山の隠者の庵（#15、トロッコ線の崖の尾根）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    dovan: { name: R.T('locations.dovan.name'), region: 'r_mine', kind: 'town', map: 'dovan', spawn: 'warp', warp: W },
    deepmine: { name: R.T('locations.deepmine.name'), region: 'r_mine', kind: 'dungeon', map: 'mine_1', spawn: 'entrance', warp: 'mine_seen' },
    // (2026-09-30) 寄り道: 鍛冶衆の隠れ村ヴォルク（#16）・深淵の鉱脈（#17）
    volk: { name: R.T('locations.volk.name'), region: 'r_mine', kind: 'town', map: 'volk', spawn: 'warp', warp: 'volk_seen' },
    vein: { name: R.T('locations.vein.name'), region: 'r_mine', kind: 'dungeon', map: 'vein_1', spawn: 'up', warp: 'vein_seen' },
    hermit: { name: R.T('locations.hermit.name'), region: 'r_mine', kind: 'place', map: 'g_rail', spawn: 'hut', warp: 'mine_hermit_met' },
  });
})(window.RPG);
