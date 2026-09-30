// CONTENT（灰の荒野）: 灰の荒野のマップの共通の小道具（凡例・光・描いた物の登録）。組み立ては CONTENT-F の R.ContentF.kit（fern_00_kit.js）を使う。
//   R.Ash.kit.TOWN(extra)      カルデラの凡例（'a' 灰の石の段・'c' 玄武岩の敷石・'e' 石段・'M' 火口の外の岩（通れない）・'F' 段の崖（通れない）・
//                              '%' 溶岩の堀（通れない）・'h' 湯（通れない）・'b' 石の橋・'X' 描いた物（通れない））
//   R.Ash.kit.ARENA(extra)     闘技場の凡例（'s' 砂・'f' 石の床・'S' 観客席（通れない）・'W' 外の壁・'X' 描いた物）
//   R.Ash.kit.VOLCANO(extra)   灰の火山の凡例（'#' 岩の壁・'.' 玄武岩の床・'o' 黒曜石の床・'%' 溶岩・'k' 冷えた溶岩の殻（仕掛けで開く）・'X' 描いた物）
//   R.Ash.kit.ROOM(wall, floor) 屋内
//   R.Ash.kit.LIGHT_*          光（町・屋内・闘技場・火山）
// 灰の描いた物（v2/assets/env/ash/props）の id は、起動のとき env.js が登録する。node の検査でも当たりと灯りがそろうよう、無いときだけここで置く。
// lava_glow は絵の無い光だけの物（溶岩の照り返し）。下絵のマップでは art.painted に入れて、光だけ残す（ENV_ASSETS.md §8 の「絵の無い光」）。
(function (R) {
  'use strict';
  const A = (R.Ash = R.Ash || {});
  const K = (A.kit = A.kit || {});
  const PROPS = {
    iron_brazier: { solid: true, glow: true, light: { kind: 'fire', r: 110 }, shadow: 'blob' },
    phoenix_statue: { solid: true, shadow: 'long' }, arena_banner: { solid: true }, ash_bush: { soft: true },
    ash_weapon_rack: { solid: true }, charred_stump: { solid: true, shadow: 'blob' }, charred_tree: { solid: true, shadow: 'long' },
    hot_spring: { solid: true }, lava_rock: { solid: true, glow: true, shadow: 'blob' }, obsidian_shards: { soft: true },
    rope_post: { solid: true }, steam_vent: { soft: true }, sulphur: { soft: true }, volcanic_rocks: { solid: true, shadow: 'blob' },
    water_urn: { solid: true, shadow: 'blob' },
    lava_glow: { soft: true, glow: true, light: { kind: 'fire', r: 120 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);
  // (2026-09-30) ともした灯籠・崖のかがり火（iron_brazier）が光らなかった: 灯りの一覧（terrain/props_light.js）は R.Terrain._PROP_META の light を見るが、
  //   env の起動の登録は {solid, shadow} だけ。山地（mine_00_kit.js）と同じく、ここで先に META に置く（env は META が有れば上書きしない）。
  //   溶岩の照り返し（lava_glow）は置かない（光だまりで溶岩の堀のマスの段が四角く浮く。今の見た目のまま）
  const T = R.Terrain;
  if (T && T._PROP_META) T._PROP_META.iron_brazier = Object.assign({}, T._PROP_META.iron_brazier || {}, { solid: true, glow: true, shadow: 'blob', light: { kind: 'fire', r: 110 } });

  K.TOWN = function (extra) {
    return Object.assign({
      a: { mat: 'ash', name: 'terrace' },
      c: { mat: 'basalt_floor' },
      e: { mat: 'basalt_floor', name: 'steps' },
      M: { mat: 'rock', solid: true, rise: 2, name: 'rim' },
      F: { mat: 'cliff', solid: true, rise: 1, name: 'terrace_face' },
      '%': { mat: 'lava', walk: false, name: 'lava' },
      h: { mat: 'water', walk: false, name: 'hot_water' },
      b: { mat: 'bridge' },
      X: { mat: 'rock', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.ARENA = function (extra) {
    return Object.assign({
      s: { mat: 'sand', name: 'arena_sand' },
      f: { mat: 'basalt_floor' },
      c: { mat: 'carpet' },
      S: { mat: 'wall_stone', solid: true, rise: 1, name: 'stands' },
      W: { mat: 'wall_stone', solid: true, rise: 2 },
      d: { mat: 'basalt_floor', name: 'door' },
      X: { mat: 'wall_stone', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.VOLCANO = function (extra) {
    return Object.assign({
      '#': { mat: 'wall_cave', solid: true, rise: 2 },
      '.': { mat: 'basalt_floor' },
      o: { mat: 'obsidian' },
      '%': { mat: 'lava', walk: false },
      k: { mat: 'obsidian', name: 'crust' },
      X: { mat: 'wall_cave', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.ROOM = function (wall, floor) { return R.ContentF.kit.ROOM_LEGEND(wall || 'wall_stone', floor || 'basalt_floor'); };
  K.LIGHT_TOWN = { ambient: '#6a5078', k: 0.5, poolK: 1.5, spillR: 1.5, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#86767a', k: 0.8, mood: 'interior' };
  K.LIGHT_ARENA = { ambient: '#6c5470', k: 0.56, poolK: 1.4, spillR: 1.4, mood: 'town_night' };
  K.LIGHT_VOLCANO = { ambient: '#6a4052', k: 0.62, poolK: 1.2, spillR: 1.2, mood: 'cave' };
  /** 戸口の前（door.y + 1）の spawn */
  K.doorSpawn = (b, dir) => ({ x: b.door.x, y: b.door.y + 1, dir: dir || 's' });
})(window.RPG);
