// CONTENT（オルビス高原）: 高原の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: 学術都市オルビス（前のワールドの北の街道の先、星見の坂から）。ダンジョンの入口: 消灯後の学院（一度忍びこんだあと）・星読みの塔（星図で開けたあと）。
//   場所: 星降りのくぼ地（#19。星のかけら）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    orbis: { name: R.T('locations.orbis.name'), region: 'r_star', kind: 'town', map: 'orbis', spawn: 'warp', warp: W },
    academy: { name: R.T('locations.academy.name'), region: 'r_star', kind: 'dungeon', map: 'star_academy_1', spawn: 'service', warp: 'star_night_seen' },
    startower: { name: R.T('locations.startower.name'), region: 'r_star', kind: 'dungeon', map: 'star_tower_1', spawn: 'entrance', warp: 'star_tower_open' },
    starfall: { name: R.T('locations.starfall.name'), region: 'r_star', kind: 'place', map: 's_crater', spawn: 'west', warp: 'star_crater_seen' },
  });
})(window.RPG);
