// 湿原（グレイモア湿原 r_marsh）のエリア切り替えのフィールドの共通（maps/marsh_field_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_marsh/ の areas_marsh.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.MARSH_LEGEND  湿原のエリアの凡例（字は areas_marsh.py の lib.py と同じ。絵の当たりの合わせ fit.py がそのまま使える）
//     ',' 泥炭の草・';' すげの株・'"' 湿原の花・'.' 泥の道・':' 小道・'s' 泥の原・'=' 板の道・'c' 古い敷石
//     '~' 湖の水・'w' 黒い沼の水・'T' 柳・'F' 沈んだ枯れ木の林・'b' 葦原・'r' 岩・切り株・'R' 岩の尾根・'X' 築いた物（塔・小屋・館・柵）
//   付け替え（データの後処理の 2 段目、field_00_kit.js の link と同じ段）:
//     ・前のワールドの湿原の北の入口（山あいの街道の終わり、W 500〜501, 173）→ 霧の入口（m_north）。霧の入口の北の端 → 前のワールドの街道（spawn marsh_n）
//     ・前のワールドの潮見橋の北の端（W 563〜565, 351）→ 鐘沈みの沼の縁（m_bog）。沼の縁の南の端 → 潮見橋の上（spawn marsh_s）
//     前のワールドの湿原はもう歩かない（両方の口がエリアへの出口になる）。町・ダンジョンの「ワールドへ」の出口は各エリアの links で付け替わる。
//   体験版の止め（北の入口の番人・崖崩れ・data/demo_gate.js）はそのまま効く（湿原は sliceOpen に無い）。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.MARSH_LEGEND = {
    ',': { mat: 'peat_grass' }, ';': { mat: 'peat_grass' }, '"': { mat: 'peat_grass' },
    '.': { mat: 'mud' }, ':': { mat: 'mud' }, s: { mat: 'mud' }, _: { mat: 'shallow' }, '=': { mat: 'plank' }, c: { mat: 'cobble' },
    '~': { mat: 'marsh_water', walk: false }, w: { mat: 'marsh_water', walk: false },
    T: { mat: 'tree', solid: true, under: 'peat_grass', tree: ['willow'] }, F: { mat: 'forest_dark', solid: true },
    b: { mat: 'tall_grass', solid: true, name: 'reeds' }, r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 },
    X: { mat: 'wall_marsh', solid: true },
  };
  // エリアからダンジョンへ入る所の確かめの文（field_00_kit.js の CONFIRM に足す。表の読みは 2 段目の link）
  if (FA.CONFIRM) {
    FA.CONFIRM.marsh_manor_1 = R.T('map.marsh_field_00_kit.CONFIRM.marsh_manor_1');
    FA.CONFIRM.marsh_bog = R.T('map.marsh_field_00_kit.CONFIRM.marsh_bog');
  }
  // 前のワールドの湿原の北の入口と、潮見橋の北の端（W の座標）
  const NORTH = { spawn: { x: 500, y: 169, dir: 'n' }, exit: { x: 500, y: 173, w: 2, h: 1, to: { map: 'm_north', spawn: 'north' } } };
  const SOUTH = { spawn: { x: 564, y: 353, dir: 's' }, exit: { x: 563, y: 351, w: 3, h: 1, to: { map: 'm_bog', spawn: 'south' } } };
  function link() {
    const M = R.DB.maps || {};
    const w = M.world;
    if (!w || !M.m_north) return;
    if (w.spawns) {
      if (!w.spawns.marsh_n) w.spawns.marsh_n = Object.assign({}, NORTH.spawn);
      if (!w.spawns.marsh_s) w.spawns.marsh_s = Object.assign({}, SOUTH.spawn);
    }
    if (w.exits) {
      if (!w.exits.some((e) => e.to && e.to.map === 'm_north')) w.exits.push(JSON.parse(JSON.stringify(NORTH.exit)));
      if (M.m_bog && !w.exits.some((e) => e.to && e.to.map === 'm_bog')) w.exits.push(JSON.parse(JSON.stringify(SOUTH.exit)));
    }
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
