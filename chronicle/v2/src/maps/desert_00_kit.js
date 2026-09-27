// CONTENT（砂漠）: ザハラ砂漠のマップの共通の小道具（凡例・建物・宿の型）。組み立ては CONTENT-F の R.ContentF.kit（fern_00_kit.js）を使う。
//   R.Desert.kit.LEGEND(extra)          砂漠の外の凡例（砂・砂丘・粘土・砂岩の壁・敷石・水・岩）
//   R.Desert.kit.TOMB_LEGEND(extra)     王墓・神殿の凡例（砂岩の壁 rise 2・砂岩の床・流砂 Q・隠し通路 S）
//   R.Desert.kit.bld(id, kind, x, y, o) 描いた汎用の建物（desert_house_s 5×4・desert_shop_m 6×5・desert_hall_l 8×6。扉は敷地のまん中の列の一番下）
//   R.Desert.kit.room(...)              屋内（K.room の上に、日干しれんがの壁・敷物）
//   R.Desert.kit.superellipse(...)      角の丸い四角（町の外壁・広場）
// どのマップも R.onData(() => …) の中で組み立てる（読み込みの順に依らない）。
(function (R) {
  'use strict';
  const D = (R.Desert = R.Desert || {});
  const K = (D.kit = D.kit || {});
  K.LEGEND = function (extra) {
    return Object.assign({
      s: { mat: 'sand' },
      u: { mat: 'dune_sand' },
      k: { mat: 'cracked_clay' },
      d: { mat: 'dirt' },
      Q: { mat: 'sandstone_floor' },
      c: { mat: 'cobble' },
      X: { mat: 'wall_sandstone', solid: true, rise: 2 },
      x: { mat: 'wall_sandstone', solid: true, rise: 1 },
      m: { mat: 'rock', solid: true, rise: 1 },
      w: { mat: 'water', walk: false },
      _: { mat: 'shallow' },
      g: { mat: 'grass' },
    }, extra || {});
  };
  K.TOMB_LEGEND = function (extra) {
    return Object.assign({
      '#': { mat: 'wall_sandstone', solid: true, rise: 2 },
      '.': { mat: 'sandstone_floor' },
      s: { mat: 'sand' },
      k: { mat: 'cracked_clay' },
      Q: { mat: 'shallow', walk: false, name: 'quicksand' },
      w: { mat: 'water', walk: false },
      c: { mat: 'carpet' },
      S: { mat: 'wall_sandstone', solid: true, secret: true, floor: 'sandstone_floor' },
    }, extra || {});
  };
  const ART = { s: ['desert_house_s', 5, 4], m: ['desert_shop_m', 6, 5], l: ['desert_hall_l', 8, 6] };
  /** 描いた汎用の建物。o.to = {map, spawn}（扉の行き先。無ければ入れない家）。→ {obj, door:{x,y}} */
  K.bld = function (id, kind, x, y, o) {
    o = o || {};
    const [art, w, h] = ART[kind];
    const door = { x: x + Math.floor(w / 2), y: y + h - 1 };
    const obj = Object.assign({ type: 'building', id, x, y, w, h, wall: kind === 'l' ? 3 : 2, roof: 'flat', mat: 'plaster', art, windows: 2, lamp: true }, o.extra || {});
    if (o.to) obj.door = { x: door.x, y: door.y, to: o.to };
    if (o.sign) obj.sign = o.sign;
    return { obj, door };
  };
  /** 角の丸い四角の内側か（|dx/rx|^p + |dy/ry|^p < 1） */
  K.superellipse = function (x, y, cx, cy, rx, ry, p) {
    p = p || 4;
    return Math.pow(Math.abs((x - cx) / rx), p) + Math.pow(Math.abs((y - cy) / ry), p) < 1;
  };
  K.LIGHT_TOWN = { ambient: '#5f5a98', k: 0.46, poolK: 1.6, spillR: 1.6, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#8a7a9a', k: 0.8, mood: 'interior' };
  K.LIGHT_OUT = { ambient: '#5a5c9e', k: 0.5, mood: 'night' };
  K.LIGHT_TOMB = { ambient: '#5a5688', k: 0.6, mood: 'cave' };
})(window.RPG);
