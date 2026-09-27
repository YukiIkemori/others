// CONTENT-P: 場所（R.DB.locations、K.location。V2_PLAN §2.6.1・§2.11「ワープの一覧」）
//   {name, region, kind:'town'|'dungeon'|'place', map, spawn, warp}
//   map = その場所の入口のマップ（ワープの着く所・FIELD が入ったときに R.Game.warps[id] を立てる）。脱出はダンジョンの入口のマップの外への出口。
//   warp = ワープの一覧に出す条件。序章の間（!prologue_done）はワープを出さない（V2_PLAN §2.6.1）。
//   森の場所（fern verda elder yura hut）のマップと spawn は CONTENT-F が作る（名前は requests.jsonl で CONTENT-F に知らせた）。
(function (R) {
  'use strict';
  const W = 'prologue_done';
  R.defs('locations', {
    roa: { name: 'ロアの里', region: 'prologue', kind: 'town', map: 'roa', spawn: 'warp', warp: W },
    pharos: { name: '港町ファロス', region: 'prologue', kind: 'town', map: 'pharos', spawn: 'warp', warp: W },
    lighthouse: { name: 'ファロス灯台', region: 'prologue', kind: 'dungeon', map: 'lighthouse_1', spawn: 'entrance', warp: W },
    well: { name: '旅人の古井戸', region: 'prologue', kind: 'dungeon', map: 'well', spawn: 'entrance', warp: W },
    fern: { name: '森の村フェルン', region: 'r_forest', kind: 'town', map: 'fern', spawn: 'plaza', warp: W },
    yura: { name: '隠れ里ユラ', region: 'r_forest', kind: 'town', map: 'yura', spawn: 'gate', warp: W },
    verda: { name: '迷いの森', region: 'r_forest', kind: 'dungeon', map: 'verda_1', spawn: 'south', warp: W },
    elder: { name: '千年樹', region: 'r_forest', kind: 'dungeon', map: 'elder_1', spawn: 'south', warp: W },
    hut: { name: 'きこりの休み小屋', region: 'r_forest', kind: 'place', map: 'hut', spawn: 'door', warp: W },
  });
})(window.RPG);
