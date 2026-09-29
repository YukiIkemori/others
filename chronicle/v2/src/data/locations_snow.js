// 雪原の場所（R.DB.locations、K.location。ワープの一覧と地図の名前。V2_PLAN §2.6.1）
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    yule: { name: R.T('locations.yule.name'), region: 'r_snow', kind: 'town', map: 'yule', spawn: 'plaza', warp: W },
    pass_inn: { name: R.T('locations.pass_inn.name'), region: 'r_snow', kind: 'town', map: 'pass_inn', spawn: 'gate', warp: W },
    snow_woods: { name: R.T('locations.snow_woods.name'), region: 'r_snow', kind: 'dungeon', map: 'snow_woods', spawn: 'south', warp: W },
    peak: { name: R.T('locations.peak.name'), region: 'r_snow', kind: 'dungeon', map: 'peak_1', spawn: 'south', warp: W },
    icicle: { name: R.T('locations.icicle.name'), region: 'r_snow', kind: 'dungeon', map: 'icicle_1', spawn: 'entrance', warp: W },
    aurora: { name: R.T('locations.aurora.name'), region: 'r_snow', kind: 'dungeon', map: 'aurora', spawn: 'south', warp: W },
    frost_ship: { name: R.T('locations.frost_ship.name'), region: 'r_snow', kind: 'dungeon', map: 'frost_ship_1', spawn: 'entrance', warp: W },
  });
})(window.RPG);
