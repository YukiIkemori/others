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
    ['wm_grass', 'grass', '草原', { splat: 0.46 }], ['wm_flowers', 'flowers', '花の野', { splat: 0.5 }], ['wm_tall_grass', 'tall_grass', '深い草', { splat: 0.5 }],
    ['wm_forest_floor', 'moss_earth', '森の地面', { splat: 0.46 }], ['wm_undergrowth', 'moss_earth', '下草', { splat: 0.46 }], ['wm_roots', 'root_floor', '根の地面', {}],
    ['wm_road', 'road', '土の道', { nodecor: true, splat: 0.18 }], ['wm_highway', 'road', '石の街道', { nodecor: true, splat: 0.16 }], ['wm_dirt', 'dirt', '土', { splat: 0.3 }], ['wm_mud', 'mud', '泥', { nodecor: true, splat: 0.3 }],
    ['wm_sand', 'sand', '砂浜', { nodecor: true, splat: 0.4 }], ['wm_dune', 'dune_sand', '砂丘', { nodecor: true, splat: 0.46 }], ['wm_clay', 'cracked_clay', 'ひび割れた粘土', { nodecor: true, splat: 0.4 }],
    ['wm_snow', 'snow', '雪原', { splat: 0.46 }], ['wm_snow_path', 'snow_path', '雪の道', { nodecor: true, splat: 0.18 }], ['wm_ice', 'ice', '氷', { splat: 0.36 }],
    ['wm_peat', 'peat_grass', '湿った草', { splat: 0.46 }], ['wm_bog_mud', 'mud', '沼の泥', { nodecor: true, splat: 0.4 }], ['wm_marsh_water', 'marsh_water', '沼の水', { splat: 0.34 }], ['wm_reeds', 'tall_grass', 'アシの原', {}],
    ['wm_rock', 'rock', '岩山', {}], ['wm_scree', 'dirt', 'がれ場', { splat: 0.4 }], ['wm_ash', 'ash', '灰', { splat: 0.44 }], ['wm_obsidian', 'obsidian', '黒い砂', { splat: 0.4 }],
    ['wm_sea', 'sea', '海', { splat: 0.34, shallowTint: [52, 112, 126] }], ['wm_deep', 'deep_water', '深い海', { splat: 0.34 }], ['wm_shallow', 'shallow', '浅瀬', { splat: 0.34 }],
    ['wm_lake', 'water', '湖', { splat: 0.34, shallowTint: [48, 100, 108] }],
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
