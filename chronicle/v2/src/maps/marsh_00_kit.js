// CONTENT（湿原）: グレイモア湿原のマップの共通の小道具（凡例・光・描いた物の登録）。組み立ては CONTENT-F の R.ContentF.kit（fern_00_kit.js）を使う。
//   R.Marsh.kit.LEGEND(extra)       湿原の外と町の凡例（'~' 浅い湖・'=' 運河の深み・'r' 葦原・'p' 板の道・'g' 泥炭の小島・'m' 泥の道・'c' 石畳・
//                                   'b' 石の橋・'T' 柳（通れない）・'X' 描いた塔や杭（通れない））
//   R.Marsh.kit.MANOR(extra)        霧の館の凡例（'#' 石の壁・'.' 石の床・'w' 木の床・'c' じゅうたん・'g' 庭の草・'~' 庭の水路・'h' 生け垣）
//   R.Marsh.kit.BOG(extra)          鐘沈みの沼の凡例（'~' 沼の水・'=' 深い水・'g' 泥炭・'m' 泥・'p' 板の道・'r' 葦・'T' 枯れ木・'X' 描いた岩や根）
//   R.Marsh.kit.ROOM()              屋内（板の壁・板の床）
//   R.Marsh.kit.LIGHT_*             光（町・屋内・館・沼）
// 湿原の描いた物（v2/assets/env/marsh/props）の id は、起動のとき env.js が登録する。node の検査でも当たりと灯りがそろうよう、無いときだけここで置く。
// どのマップも R.onData(() => …) の中で組み立てる（読み込みの順に依らない）。
(function (R) {
  'use strict';
  const M = (R.Marsh = R.Marsh || {});
  const K = (M.kit = M.kit || {});
  const PROPS = {
    wisp_lamp: { solid: true, glow: true, light: { kind: 'lamp', r: 100 }, shadow: 'long' },
    bell_frame: { solid: true, shadow: 'long' }, board_steps: { soft: true }, crooked_sign: { solid: true },
    fish_trap: { solid: true, shadow: 'blob' }, grave_moss: { solid: true, shadow: 'blob' }, lily_pads: { soft: true },
    mangrove_roots: { solid: true }, mud_boat: { solid: true, shadow: 'blob' }, pale_mushrooms: { soft: true, glow: true },
    reeds_tall: { soft: true }, rotten_stump: { solid: true, shadow: 'blob' }, stilt_posts: { solid: true },
    swamp_tree: { solid: true, shadow: 'long' }, willow: { solid: true, shadow: 'long' },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  K.LEGEND = function (extra) {
    return Object.assign({
      '~': { mat: 'marsh_water', walk: false, name: 'lake' },
      '=': { mat: 'water', walk: false, name: 'canal' },
      r: { mat: 'tall_grass', solid: true, name: 'reeds' },
      p: { mat: 'plank', name: 'boardwalk' },
      g: { mat: 'peat_grass' },
      m: { mat: 'mud' },
      c: { mat: 'cobble' },
      b: { mat: 'bridge' },
      T: { mat: 'tree', solid: true, under: 'peat_grass', tree: ['willow'] },
      X: { mat: 'wall_marsh', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.MANOR = function (extra) {
    return Object.assign({
      '#': { mat: 'wall_stone', solid: true, rise: 2 },
      '.': { mat: 'stone_floor' },
      w: { mat: 'wood_floor' },
      c: { mat: 'carpet' },
      g: { mat: 'peat_grass' },
      '~': { mat: 'marsh_water', walk: false },
      h: { mat: 'bush', solid: true, name: 'hedge' },
      X: { mat: 'wall_stone', solid: true, name: 'painted' },
      S: { mat: 'wall_stone', solid: true, rise: 2, secret: true, floor: 'stone_floor' },
    }, extra || {});
  };
  K.BOG = function (extra) {
    return Object.assign({
      '~': { mat: 'marsh_water', walk: false },
      '=': { mat: 'water', walk: false, name: 'deep' },
      g: { mat: 'peat_grass' },
      m: { mat: 'mud' },
      p: { mat: 'plank' },
      r: { mat: 'tall_grass', solid: true, name: 'reeds' },
      T: { mat: 'tree', solid: true, under: 'peat_grass', tree: ['swamp_tree'] },
      X: { mat: 'wall_marsh', solid: true, name: 'painted' },
      S: { mat: 'wall_marsh', solid: true, secret: true, floor: 'mud' },
    }, extra || {});
  };
  K.ROOM = function () { return R.ContentF.kit.ROOM_LEGEND('wall_wood', 'wood_floor'); };
  K.LIGHT_TOWN = { ambient: '#56629a', k: 0.46, poolK: 1.6, spillR: 1.6, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#7c7896', k: 0.8, mood: 'interior' };
  K.LIGHT_MANOR = { ambient: '#4e5286', k: 0.6, poolK: 1.2, spillR: 1.2, mood: 'tower' };
  K.LIGHT_BOG = { ambient: '#4c5c86', k: 0.56, poolK: 1.0, spillR: 1.0, mood: 'forest_night' };
  /** 戸口の前（door.y + 1）の spawn */
  K.doorSpawn = (b, dir) => ({ x: b.door.x, y: b.door.y + 1, dir: dir || 's' });
})(window.RPG);
