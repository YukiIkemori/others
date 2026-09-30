// CONTENT（マレア諸島）: 諸島の町・ダンジョン・屋内の共通の小道具（凡例・光・描いた物の登録・下絵の当たりから組み立てる）。
//   R.Isles.kit.TOWN(extra)   町の凡例（字は design/.../field_isles/lib.py と同じ。'c' 白い敷石・'X' 白い家と段の擁壁（描いた物）・'=' 桟橋・'~' 海）
//   R.Isles.kit.CAVE(extra)   潮鳴りの洞窟の凡例（'k' 平らな岩棚・'s' 砂・'w' 洞の海水・'R' 岩の壁・'r' 岩）
//   R.Isles.kit.SHIP(extra)   幽霊船の凡例（'u' 甲板・'c' 船長室の敷物・'X' 船べり・隔壁・'r' 積荷・'w' 入りこんだ海水・'~' 霧の海）
//   R.Isles.kit.ROOM(wall, floor) 屋内（R.ContentF.kit.ROOM_LEGEND）
//   R.Isles.kit.painted(id)   下絵に合わせた当たり（maps/isles_painted_rows.js の R.Isles.PAINTED[id]）→ {rows, art, blds}
//   R.Isles.kit.blds(id, dest) 描いた建物の敷地と戸口 → 建物の物（dest[建物の id] = {map, spawn?, sign?}。無い物は入れない家として当たりだけ）
//   R.Isles.kit.LIGHT_*       光（町・村・屋内・洞窟・船・霧の海）
//   港の灯（持ち主 2026-09-29「地方に合う小道具」）: lamp_pillar = 白い石の柱の上の船のランタン。町では擁壁・岸壁の縁（歩けないマス）に立てる。
// 諸島の描いた物（v2/assets/env/isles/props）の id は、起動のとき env.js が登録する。node の検査でも当たりと灯りがそろうよう、無いときだけここで置く。
(function (R) {
  'use strict';
  const I = (R.Isles = R.Isles || {});
  const K = (I.kit = I.kit || {});
  const PROPS = {
    lamp_pillar: { solid: true, glow: true, light: { kind: 'fire', r: 110 }, shadow: 'blob' },
    anchor: { solid: true, shadow: 'blob' }, buoys: { solid: true }, net_frame: { solid: true, shadow: 'long' }, fish_barrel: { solid: true, shadow: 'blob' },
    rope_bollard: { solid: true, shadow: 'blob' }, blue_bench: { solid: true }, white_pot: { solid: true, shadow: 'blob' }, driftwood: { soft: true },
    shells: { soft: true }, coral: { soft: true }, coco_palm: { solid: true, shadow: 'long' }, palm_small: { solid: true, shadow: 'blob' },
    map_sign: { solid: true },
    // 光だけの物（絵を持たない）: 夜光虫の青い光（洞窟の水・入り江）と、灯台の灯室の大きな灯
    glow_plankton: { soft: true, glow: true, light: { kind: 'lamp', r: 90 } },
    beacon_glow: { soft: true, glow: true, light: { kind: 'fire', r: 190 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  const BASE = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'coral_sand' }, _: { mat: 'shallow' }, '=': { mat: 'pier' }, c: { mat: 'white_paving' }, u: { mat: 'deck' }, k: { mat: 'tide_rock' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true }, r: { mat: 'rock', solid: true },
  };
  K.TOWN = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'cliff', solid: true, rise: 1 },
      X: { mat: 'wall_stone', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.CAVE = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'wall_cave', solid: true, rise: 2 },
      X: { mat: 'wall_cave', solid: true, name: 'painted' },
      w: { mat: 'water', walk: false, name: 'cave_water' },
    }, extra || {});
  };
  K.SHIP = function (extra) {
    return Object.assign({}, BASE, {
      c: { mat: 'carpet' },
      R: { mat: 'wall_wood', solid: true, rise: 2 },
      X: { mat: 'wall_wood', solid: true, name: 'hull' },
      r: { mat: 'plank', solid: true, name: 'cargo' },
      w: { mat: 'water', walk: false, name: 'bilge' },
      '~': { mat: 'sea', walk: false },
    }, extra || {});
  };
  K.ROOM = function (wall, floor) { return R.ContentF.kit.ROOM_LEGEND(wall || 'wall_stone', floor || 'wood_floor'); };
  K.LIGHT_TOWN = { ambient: '#5a64a4', k: 0.48, poolK: 1.5, spillR: 1.5, mood: 'town_night' };
  K.LIGHT_VILLAGE = { ambient: '#50609e', k: 0.5, poolK: 1.5, spillR: 1.5, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#8a8298', k: 0.8, mood: 'interior' };
  K.LIGHT_CAVE = { ambient: '#3e5a86', k: 0.6, poolK: 1.2, spillR: 1.2, mood: 'cave' };
  K.LIGHT_SHIP = { ambient: '#5a6690', k: 0.58, poolK: 1.0, spillR: 1.0, mood: 'cave' };   // (2026-09-30) 甲板・船室を少し明るく
  K.LIGHT_HOLD = { ambient: '#4a5482', k: 0.6, mood: 'dark' };   // (2026-09-30) 船倉: 灯りの外でも床と壁の形が読める明るさに

  /** 下絵に合わせた当たり（isles_painted_rows.js）。無ければ海だけの小さな四角（node の読み込みの順が崩れても落ちない） */
  K.painted = function (id) {
    const p = I.PAINTED && I.PAINTED[id];
    if (p) return { rows: p.rows.slice(), art: Object.assign({}, p.art), blds: (p.blds || []).map((b) => Object.assign({}, b)) };
    R.warn && R.warn('Isles.kit.painted: no painted rows for ' + id);
    return { rows: ['~~~', '~.~', '~~~'], art: null, blds: [] };
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
