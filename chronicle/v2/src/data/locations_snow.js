// 雪原の場所（R.DB.locations、K.location。ワープの一覧と地図の名前。V2_PLAN §2.6.1）
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    yule: { name: '雪の村ユール', region: 'r_snow', kind: 'town', map: 'yule', spawn: 'plaza', warp: W },
    pass_inn: { name: '峠の宿', region: 'r_snow', kind: 'town', map: 'pass_inn', spawn: 'gate', warp: W },
    snow_woods: { name: '雪の林', region: 'r_snow', kind: 'dungeon', map: 'snow_woods', spawn: 'south', warp: W },
    peak: { name: '白竜の峰', region: 'r_snow', kind: 'dungeon', map: 'peak_1', spawn: 'south', warp: W },
    icicle: { name: 'つららの回廊', region: 'r_snow', kind: 'dungeon', map: 'icicle_1', spawn: 'entrance', warp: W },
    aurora: { name: 'オーロラの崖', region: 'r_snow', kind: 'dungeon', map: 'aurora', spawn: 'south', warp: W },
    frost_ship: { name: '氷に閉じた帆船', region: 'r_snow', kind: 'dungeon', map: 'frost_ship_1', spawn: 'entrance', warp: W },
  });
})(window.RPG);
