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
    // (2026-09-30) 岩の中の青い鉱石の脈（描いた結晶の上）と、町の家の窓明かり（描いた窓の前の光だまり）
    crystal_glow: { soft: true, glow: true, light: { kind: 'crystal', r: 96 } },
    window_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 66 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);
  // (2026-09-30) 灯りの一覧（terrain/props_light.js）は R.Terrain._PROP_META の light を見る。env の起動の登録は light を持たない
  //   （{solid, shadow} だけ）ので、カンテラ・炉・青い鉱石が光らなかった。ここで先に META に置く（env は META が有れば上書きしない）。
  //   絵を持たない光だけの物（*_glow）は描く物を空にする。
  const T = R.Terrain;
  if (T && T._PROP_META) {
    for (const id of Object.keys(PROPS)) {
      const p = PROPS[id];
      const m = Object.assign({}, T._PROP_META[id] || {});
      for (const k of ['solid', 'soft', 'glow', 'shadow']) if (p[k] !== undefined) m[k] = p[k];
      if (p.light) m.light = { kind: p.light.kind, r: p.light.r };
      T._PROP_META[id] = m;
      if (/_glow$/.test(id) && T._PROP_DRAW && !T._PROP_DRAW[id]) { T._PROP_DRAW[id] = function () { return null; }; T._PROP_DRAW[id].envOnly = true; }
    }
  }

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
  // (2026-09-30 見直し) 洞窟の町と坑道が暗すぎた: 下絵を明るく整え（field_mine/grade.json）、環境光も上げる。坑道の気分は灯りの輪で残す
  K.LIGHT_TOWN = { ambient: '#6e6490', k: 0.58, poolK: 1.5, spillR: 1.6, mood: 'town_night' };
  K.LIGHT_TOWN_LIT = { ambient: '#9a8478', k: 0.66, poolK: 1.6, spillR: 1.7, mood: 'town_night' };   // 炉に火が戻ったあと（町の灯りがいっせいに明るく）
  K.LIGHT_ROOM = { ambient: '#8a8298', k: 0.8, mood: 'interior' };
  K.LIGHT_CAVE = { ambient: '#5e5a84', k: 0.64, poolK: 1.25, spillR: 1.3, mood: 'cave' };
  K.LIGHT_DEEP = { ambient: '#4c4c70', k: 0.64, mood: 'dark' };

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
