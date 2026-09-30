// CONTENT（ガルド山地・鉱山都市ドヴァン）: 地下の町・深き坑道・屋内の共通の小道具（凡例・光・描いた物の登録・下絵の当たりから組み立てる）。
//   R.Mine.kit.TOWN(extra)   洞窟の町の凡例（字は design/.../field_mine/lib.py と同じ。'k' 土の床・'c' 石畳・'X' 家と櫓（描いた物）・'R' 岩壁・'l' 裂け目）
//   R.Mine.kit.CAVE(extra)   深き坑道の凡例（'k' 坑道の床・'=' 板の渡り・'w' 地下の水・'R' 岩の壁・'r' 岩と鉱石の山・'l' 縦穴・'X' 描いた物）
//   R.Mine.kit.ROOM(wall, floor) 屋内（R.ContentF.kit.ROOM_LEGEND）
//   R.Mine.kit.painted(id)   下絵に合わせた当たり（maps/mine_painted_rows.js の R.Mine.PAINTED[id]）→ {rows, art, blds}
//   R.Mine.kit.blds(id, dest) 描いた建物の敷地と戸口 → 建物の物（dest[建物の id] = {map, spawn?, sign?}。無い物は入れない家として当たりだけ）
//   R.Mine.kit.LIGHT_*       光（町・屋内・坑道・七の層）
//   鉱山の灯（持ち主 2026-09-29「地方に合う小道具」）: 町と坑道の灯りは坑夫のカンテラ（hook_lamp = 鉤に吊るした鉄のカンテラ、
//   道しるべの灯 waylamp は propSet 'mine' の木の柱のカンテラ）。石の灯籠や街灯（lamp_post）は置かない。
// 鉱山の描いた物（v2/assets/env/mine/props）の id は、起動のとき env.js が登録する。node の検査でも当たりと灯りがそろうよう、無いときだけここで置く。
(function (R) {
  'use strict';
  const I = (R.Mine = R.Mine || {});
  const K = (I.kit = I.kit || {});
  const PROPS = {
    hook_lamp: { solid: true, glow: true, light: { kind: 'fire', r: 110 }, shadow: 'blob' },
    mine_cart: { solid: true, shadow: 'blob' }, mine_cart_ore: { solid: true, shadow: 'blob' }, anvil: { solid: true, shadow: 'blob' },
    bellows: { solid: true, shadow: 'blob' }, forge: { solid: true, glow: true, light: { kind: 'fire', r: 150 }, shadow: 'blob' },
    coal_barrel: { solid: true, shadow: 'blob' }, tool_crate: { solid: true, shadow: 'blob' }, tool_rack: { solid: true, shadow: 'blob' },
    ore_blue: { solid: true, glow: true, light: { kind: 'lamp', r: 70 } }, ore_copper: { solid: true }, timber_frame: { solid: true },
    lift_cage: { solid: true }, oath_stone: { solid: true },
    // 光だけの物（絵を持たない）: 鍛冶神の炉の赤い光（鍛冶場の奥・町の灯り直す場面）と、七の層の破れ目の白い光
    forge_glow: { soft: true, glow: true, light: { kind: 'fire', r: 200 } },
    white_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 150 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  const BASE = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'dirt' }, _: { mat: 'shallow' }, '=': { mat: 'scaffold' }, c: { mat: 'cobble' }, u: { mat: 'mine_floor' }, k: { mat: 'mine_floor' },
    '~': { mat: 'deep_water', walk: false }, w: { mat: 'water', walk: false, name: 'cave_water' },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true }, r: { mat: 'rock', solid: true },
    l: { mat: 'rock', solid: true, name: 'chasm' },
  };
  K.TOWN = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'wall_cave', solid: true, rise: 2 },
      X: { mat: 'wall_wood', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.CAVE = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'wall_cave', solid: true, rise: 2 },
      X: { mat: 'wall_cave', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.ROOM = function (wall, floor) { return R.ContentF.kit.ROOM_LEGEND(wall || 'wall_stone', floor || 'wood_floor'); };
  K.LIGHT_TOWN = { ambient: '#5a5a8e', k: 0.5, poolK: 1.5, spillR: 1.5, mood: 'town_night' };
  K.LIGHT_TOWN_LIT = { ambient: '#8a7a78', k: 0.36, poolK: 1.6, spillR: 1.6, mood: 'town_night' };   // 炉に火が戻ったあと（町の灯りがいっせいに明るく）
  K.LIGHT_ROOM = { ambient: '#8a8298', k: 0.8, mood: 'interior' };
  K.LIGHT_CAVE = { ambient: '#4a4a70', k: 0.6, poolK: 1.2, spillR: 1.2, mood: 'cave' };
  K.LIGHT_DEEP = { ambient: '#34364e', k: 0.66, mood: 'dark' };

  /** 下絵に合わせた当たり（mine_painted_rows.js）。無ければ岩だけの小さな四角（node の読み込みの順が崩れても落ちない） */
  K.painted = function (id) {
    const p = I.PAINTED && I.PAINTED[id];
    if (p) return { rows: p.rows.slice(), art: Object.assign({}, p.art), blds: (p.blds || []).map((b) => Object.assign({}, b)) };
    R.warn && R.warn('Mine.kit.painted: no painted rows for ' + id);
    return { rows: ['RRR', 'RkR', 'RRR'], art: null, blds: [] };
  };
  /** 描いた建物 → 建物の物（当たりは下絵の 'X'。戸口は 1 マス、出て着くのはその真下）。dest に無い建物は入れない家 */
  K.blds = function (id, dest) {
    const out = [];
    for (const b of K.painted(id).blds) {
      const o = { type: 'building', id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, wall: 2, roof: 'flat', mat: 'plaster', windows: 2, lamp: false };
      const d = dest[b.id];
      if (d) {
        o.door = { x: b.door[0], y: b.door[1], to: { map: d.map, spawn: d.spawn || 'door' } };
        if (d.sign) o.sign = d.sign;
      }
      out.push(o);
    }
    return out;
  };
  /** 建物の戸口の前（door.y + 1）の spawn */
  K.doorSpawn = function (id, bid, dir) {
    const b = K.painted(id).blds.find((q) => q.id === bid);
    return b ? { x: b.door[0], y: b.door[1] + 1, dir: dir || 's' } : { x: 1, y: 1, dir: 's' };
  };
})(window.RPG);
