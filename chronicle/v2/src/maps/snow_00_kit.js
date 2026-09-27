// 雪原のマップの小道具（ユール・雪の林・白竜の峰・つららの回廊・峠の宿・北の流氷原）。V2_PLAN §2.6.1、WORLD_REDESIGN §4.3・§5.6。
//   形の道具は CONTENT-F の R.ContentF.kit（grid / rect / path / blob / soften / scatter / npc / L …）をそのまま使い、ここは雪原の分だけ:
//   R.Snow.kit.LEGEND(extra)   雪原の凡例（'.' 雪・',' 踏み固めた雪の道・'#' 雪の土手（立ち上がり 1）・'H' 雪の崖（立ち上がり 2）・
//                              'i' 氷・'T' 雪のもみ・'c' 石畳・'p' 板・'~' 水・'r' 土の道）
//   R.Snow.kit.house/shop/hall(id, x, y, o)   描いた雪の家（汎用の 3 つ: 5×4・6×5・8×6）。戸口は足もとの真ん中の列
//   R.Snow.kit.B(id, x, y, w, h, o)   そのほかの大きさ（コードで描く丸太の家）
//   雪原の描いた物（v2/assets/env/snow/props）の id は art/terrain/props.js が先に登録する。無いときだけここで R.DB.props に置く。
(function (R) {
  'use strict';
  const S = (R.Snow = R.Snow || {});
  const K = (S.kit = S.kit || {});
  const PROPS = {
    firewood: { solid: true, shadow: 'blob' }, frozen_well: { solid: true, shadow: 'blob' }, hay_sled: { solid: true, shadow: 'blob' },
    ice_crystal: { solid: true, glow: true, light: { kind: 'crystal', r: 48 } }, ice_hole: { soft: true }, sled: { solid: true, shadow: 'blob' },
    snow_bank: { solid: true }, snow_barrel: { solid: true, shadow: 'blob' }, snow_fence: { solid: true }, snow_fir: { solid: true, shadow: 'long' },
    snow_lamp: { solid: true, glow: true, light: { kind: 'lamp', r: 110 }, shadow: 'long' }, snow_rock: { solid: true, shadow: 'blob' },
    snow_sign: { solid: true }, stove_pipe: { solid: true },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  K.LEGEND = function (extra) {
    return Object.assign({
      '.': { mat: 'snow' },
      ',': { mat: 'snow_path' },
      '#': { mat: 'wall_snow', solid: true, rise: 1 },
      H: { mat: 'wall_snow', solid: true, rise: 2 },
      i: { mat: 'ice' },
      T: { mat: 'tree', solid: true },
      c: { mat: 'cobble' },
      p: { mat: 'plank' },
      '~': { mat: 'water', walk: false },
      r: { mat: 'road' },
      d: { mat: 'dirt' },
    }, extra || {});
  };
  const base = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'log', windows: 2, lamp: true, chimney: true }, o || {});
  /** 描いた汎用の雪の家。o.to = {map, spawn}（入れる家） */
  function generic(art, w, h) {
    return function (id, x, y, o) {
      o = o || {};
      const d = { x: x + Math.floor(w / 2), y: y + h - 1 };
      if (o.to) d.to = o.to;
      const b = base(id, x, y, w, h, Object.assign({ art, door: d }, o));
      delete b.to;
      return b;
    };
  }
  K.house = generic('snow_house_s', 5, 4);
  K.shop = generic('snow_shop_m', 6, 5);
  K.hall = generic('snow_hall_l', 8, 6);
  K.B = base;
  /** 戸口の前（door.y + 1）の spawn */
  K.doorSpawn = (b, dir) => ({ x: b.door.x, y: b.door.y + 1, dir: dir || 's' });
  /** 屋内の雪国の凡例（丸太の壁・板の床・敷物） */
  K.ROOM = function () { return R.ContentF.kit.ROOM_LEGEND('wall_wood', 'wood_floor'); };
  /** 屋内の光（獣脂の灯。暖かい） */
  K.ROOM_LIGHT = { ambient: '#8a7688', k: 0.8, mood: 'interior' };
})(window.RPG);
