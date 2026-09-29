// CONTENT（灰の荒野）: 灰の荒野の場所（R.DB.locations、K.location。V2_PLAN §2.6.1）。ワープの一覧と地図の名前。
//   町: 炎の町カルデラ。宿場: 灰見の宿（潮見橋のたもと）。ダンジョンの入口: 灰の火山（町の東。大会に勝つと岩戸が開く）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    caldera: { name: R.T('locations.caldera.name'), region: 'r_ash', kind: 'town', map: 'caldera', spawn: 'warp', warp: W },
    haimi: { name: R.T('locations.haimi.name'), region: 'r_ash', kind: 'town', map: 'haimi_inn', spawn: 'door', warp: W },
    volcano: { name: R.T('locations.volcano.name'), region: 'r_ash', kind: 'dungeon', map: 'ash_volcano_1', spawn: 'entrance', warp: 'ash_champion' },
  });
})(window.RPG);
