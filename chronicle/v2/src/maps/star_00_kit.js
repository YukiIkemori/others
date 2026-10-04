// CONTENT（オルビス高原）: 高原の町・ダンジョン・屋内の共通の小道具（凡例・光・描いた物の登録・下絵の当たりから組み立てる）。
//   R.Star.kit.TOWN(extra)   町の凡例（字は design/.../field_star/lib.py と同じ。'c' 白い石畳・'X' 城壁と家（描いた物）・'w' 噴水の水）
//   R.Star.kit.INT(extra)    学院・塔の凡例（'c' 大理石の床・'u' 木の床・'k' 赤い敷物・星図のモザイク・',' 中庭の芝・'w' 噴水・'X' 壁・'~' 建物の外）
//   R.Star.kit.ROOM(wall, floor) 屋内（R.ContentF.kit.ROOM_LEGEND）
//   R.Star.kit.painted(id)   下絵に合わせた当たり（maps/star_painted_rows.js の R.Star.PAINTED[id]）→ {rows, art, blds}
//   R.Star.kit.blds(id, dest) 描いた建物の敷地と戸口 → 建物の物（dest[建物の id] = {map, spawn?, sign?}。無い物は入れない家として当たりだけ）
//   R.Star.kit.LIGHT_*       光（町・屋内・学院の夜・塔・塔の頂）
//   星灯（持ち主 2026-09-29「地方に合う小道具」）: star_lamp = 大理石の柱の上の星形のガラスの灯（ほしび）。町では擁壁・花壇・塀ぎわ（歩けないマス）に立てる。
// 高原の描いた物（v2/assets/env/star/props）の id は、起動のとき env.js が登録する。node の検査でも当たりと灯りがそろうよう、無いときだけここで置く。
(function (R) {
  'use strict';
  const I = (R.Star = R.Star || {});
  const K = (I.kit = I.kit || {});
  const PROPS = {
    star_lamp: { solid: true, glow: true, light: { kind: 'lamp', r: 110 }, shadow: 'blob' },
    telescope: { solid: true, shadow: 'blob' }, orrery: { solid: true, shadow: 'blob' }, globe: { solid: true, shadow: 'blob' },
    lectern: { solid: true, shadow: 'blob' }, book_stack: { solid: true }, book_cart: { solid: true, shadow: 'blob' }, star_dial: { solid: true, shadow: 'blob' },
    scholar_statue: { solid: true, shadow: 'long' }, marble_bench: { solid: true }, topiary: { solid: true, shadow: 'blob' }, blue_flowers: { soft: true },
    star_banner: { solid: true }, iron_gate: { solid: true }, fountain: { solid: true, shadow: 'blob' },
    // 光だけの物（絵を持たない）: 結晶の青い光（星降りの窪地）・星のかがり火（塔の頂、名を読んだ後）
    star_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 90 } },
    star_fire: { soft: true, glow: true, light: { kind: 'fire', r: 170 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  const BASE = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    c: { mat: 'white_paving' }, u: { mat: 'wood_floor' }, k: { mat: 'carpet' },
    '~': { mat: 'deep_water', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true }, r: { mat: 'rock', solid: true },
  };
  K.TOWN = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'cliff', solid: true, rise: 1 },
      X: { mat: 'wall_marble', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.INT = function (extra) {
    return Object.assign({}, BASE, {
      c: { mat: 'marble_floor' },
      r: { mat: 'wood_floor', solid: true, name: 'furniture' },
      R: { mat: 'wall_stone', solid: true, rise: 2 },
      X: { mat: 'wall_stone', solid: true, name: 'painted' },
      '~': { mat: 'wall_stone', solid: true, name: 'outside' },
    }, extra || {});
  };
  K.ROOM = function (wall, floor) { return R.ContentF.kit.ROOM_LEGEND(wall || 'wall_stone', floor || 'wood_floor'); };
  K.LIGHT_TOWN = { ambient: '#5460a0', k: 0.5, poolK: 1.5, spillR: 1.5, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#8a8298', k: 0.8, mood: 'interior' };
  K.LIGHT_ACADEMY = { ambient: '#4c5890', k: 0.56, poolK: 1.3, spillR: 1.2, mood: 'cave' };   // 消灯後: 灯は落ちている。窓の星明かりと見張りのランタン
  K.LIGHT_TOWER = { ambient: '#56608e', k: 0.56, poolK: 1.2, spillR: 1.2, mood: 'cave' };
  K.LIGHT_TOP = { ambient: '#5a6aa8', k: 0.5, mood: 'night' };

  /** 下絵に合わせた当たり（star_painted_rows.js）。無ければ小さな四角（node の読み込みの順が崩れても落ちない） */
  K.painted = function (id) {
    const p = I.PAINTED && I.PAINTED[id];
    if (p) return { rows: p.rows.slice(), art: Object.assign({}, p.art), blds: (p.blds || []).map((b) => Object.assign({}, b)) };
    R.warn && R.warn('Star.kit.painted: no painted rows for ' + id);
    return { rows: ['XXX', 'XcX', 'XXX'], art: null, blds: [] };
  };
  /** 描いた建物 → 建物の物（当たりは下絵の 'X'。戸口は 1 マス、出て着くのはその真下）。dest に無い建物は入れない家 */
  K.blds = function (id, dest) { return K.bldsFrom(K.painted(id), dest); };
  /** K.painted の結果（rows・blds を手で直した物）から建物の物を作る */
  K.bldsFrom = function (P, dest) {
    const out = [];
    for (const b of P.blds) {
      const o = { type: 'building', id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, wall: 2, roof: 'flat', mat: 'plaster', windows: 2, lamp: false };
      const d = dest[b.id];
      if (d) {
        o.door = { x: b.door[0], y: b.door[1], to: { map: d.map, spawn: d.spawn || 'door' } };
        if (d.sign) o.sign = d.sign;
        if (d.cond) o.door.cond = d.cond;
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
