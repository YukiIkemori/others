// TERRAIN: ワールドの素材（WORLD v3、2026-09-28）。描いた絵は v2/assets/env/world/mat/wm_*（画像生成の 2×2 の見本 8 枚から）。
// 町・ダンジョンの素材はそのまま（ワールドの凡例だけ tools/gen_world.js が wm_* に替える）。絵が読めないとき・node では元の素材のコードの絵。
// splat.js の混ぜ方: splat = ノイズの強さ（大きいほど境がうねる）、shallowTint = 水の岸の近くの色。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const M = T._MATS;
  if (!M) return;
  // [id, 元の素材, 名前, 上書き]
  const LIST = [
    ['wm_grass', 'grass', R.T('art.wmats.LIST.0.2'), { splat: 0.46 }], ['wm_flowers', 'flowers', R.T('art.wmats.LIST.1.2'), { splat: 0.5 }], ['wm_tall_grass', 'tall_grass', R.T('art.wmats.LIST.2'), { splat: 0.5 }],
    ['wm_forest_floor', 'moss_earth', R.T('art.wmats.LIST.3.2'), { splat: 0.46 }], ['wm_undergrowth', 'moss_earth', R.T('art.wmats.LIST.4.2'), { splat: 0.46 }], ['wm_roots', 'root_floor', R.T('art.wmats.LIST.5.2'), {}],
    ['wm_road', 'road', R.T('art.wmats.LIST.6.2'), { nodecor: true, splat: 0.18 }], ['wm_highway', 'road', R.T('art.wmats.LIST.7.2'), { nodecor: true, splat: 0.16 }], ['wm_dirt', 'dirt', R.T('art.wmats.LIST.8.2'), { splat: 0.3 }], ['wm_mud', 'mud', R.T('art.wmats.LIST.9.2'), { nodecor: true, splat: 0.3 }],
    ['wm_sand', 'sand', R.T('art.wmats.LIST.10.2'), { nodecor: true, splat: 0.4 }], ['wm_dune', 'dune_sand', R.T('art.wmats.LIST.11.2'), { nodecor: true, splat: 0.46 }], ['wm_clay', 'cracked_clay', R.T('art.wmats.LIST.12.2'), { nodecor: true, splat: 0.4 }],
    ['wm_snow', 'snow', R.T('art.wmats.LIST.13.2'), { splat: 0.46 }], ['wm_snow_path', 'snow_path', R.T('art.wmats.LIST.14.2'), { nodecor: true, splat: 0.18 }], ['wm_ice', 'ice', R.T('art.wmats.LIST.15.2'), { splat: 0.36 }],
    ['wm_peat', 'peat_grass', R.T('art.wmats.LIST.16.2'), { splat: 0.46 }], ['wm_bog_mud', 'mud', R.T('art.wmats.LIST.17.2'), { nodecor: true, splat: 0.4 }], ['wm_marsh_water', 'marsh_water', R.T('art.wmats.LIST.18.2'), { splat: 0.34 }], ['wm_reeds', 'tall_grass', R.T('art.wmats.LIST.19.2'), {}],
    ['wm_rock', 'rock', R.T('art.wmats.LIST.20.2'), {}], ['wm_scree', 'dirt', R.T('art.wmats.LIST.21.2'), { splat: 0.4 }], ['wm_ash', 'ash', R.T('art.wmats.LIST.22.2'), { splat: 0.44 }], ['wm_obsidian', 'obsidian', R.T('art.wmats.LIST.23.2'), { splat: 0.4 }],
    ['wm_sea', 'sea', R.T('art.wmats.LIST.24.2'), { splat: 0.34, shallowTint: [52, 112, 126] }], ['wm_deep', 'deep_water', R.T('art.wmats.LIST.25.2'), { splat: 0.34 }], ['wm_shallow', 'shallow', R.T('art.wmats.LIST.26.2'), { splat: 0.34 }],
    ['wm_lake', 'water', R.T('art.wmats.LIST.27.2'), { splat: 0.34, shallowTint: [48, 100, 108] }],
  ];
  for (const [id, from, name, over] of LIST) {
    if (M[id] || !M[from]) continue;
    M[id] = Object.assign({}, M[from], { name }, over);
    R.def('materials', id, { name, edge: M[id].edge, walk: M[id].walk });
  }
  /** ワールドの凡例の素材 → ワールドの素材（tools/gen_world.js と同じ表。生成器が使う） */
  T.WORLD_MATS = { grass: 'wm_grass', flowers: 'wm_flowers', tall_grass: 'wm_tall_grass', moss_earth: 'wm_forest_floor', dirt: 'wm_road', road: 'wm_road', mud: 'wm_mud',
    sand: 'wm_sand', dune_sand: 'wm_dune', cracked_clay: 'wm_clay', snow: 'wm_snow', snow_path: 'wm_snow_path', ice: 'wm_ice', peat_grass: 'wm_peat',
    marsh_water: 'wm_marsh_water', rock: 'wm_rock', ash: 'wm_ash', obsidian: 'wm_obsidian', sea: 'wm_sea', deep_water: 'wm_deep', shallow: 'wm_shallow', water: 'wm_lake' };
})(window.RPG);
