// CONTENT-P: 場所（R.DB.locations、K.location。V2_PLAN §2.6.1・§2.11「ワープの一覧」）
//   {name, region, kind:'town'|'dungeon'|'place', map, spawn, warp}
//   map = その場所の入口のマップ（ワープの着く所・FIELD が入ったときに R.Game.warps[id] を立てる）。脱出はダンジョンの入口のマップの外への出口。
//   warp = ワープの一覧に出す条件。序章の間（!prologue_done）はワープを出さない（V2_PLAN §2.6.1）。
//   森の場所（fern verda elder yura hut）のマップと spawn は CONTENT-F が作る（名前は requests.jsonl で CONTENT-F に知らせた）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    roa: { name: R.T('locations.roa.name'), region: 'prologue', kind: 'town', map: 'roa', spawn: 'warp', warp: W },
    pharos: { name: R.T('locations.pharos.name'), region: 'prologue', kind: 'town', map: 'pharos', spawn: 'warp', warp: W },
    lighthouse: { name: R.T('locations.lighthouse.name'), region: 'prologue', kind: 'dungeon', map: 'lighthouse_1', spawn: 'entrance', warp: W },
    well: { name: R.T('locations.well.name'), region: 'prologue', kind: 'dungeon', map: 'well', spawn: 'entrance', warp: W },
    fern: { name: R.T('locations.fern.name'), region: 'r_forest', kind: 'town', map: 'fern', spawn: 'plaza', warp: W },
    yura: { name: R.T('locations.yura.name'), region: 'r_forest', kind: 'town', map: 'yura', spawn: 'gate', warp: W },
    verda: { name: R.T('locations.verda.name'), region: 'r_forest', kind: 'dungeon', map: 'verda_1', spawn: 'south', warp: W },
    elder: { name: R.T('locations.elder.name'), region: 'r_forest', kind: 'dungeon', map: 'elder_1', spawn: 'south', warp: W },
    hut: { name: R.T('locations.hut.name'), region: 'r_forest', kind: 'place', map: 'hut', spawn: 'door', warp: W },
  });
})(window.RPG);
