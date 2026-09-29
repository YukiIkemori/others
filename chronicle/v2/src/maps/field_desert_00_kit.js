// 砂漠（ザハラ砂漠 r_desert）のエリア切り替えのフィールドの共通（maps/field_desert_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_desert/ の areas_desert.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.DESERT_LEGEND  砂漠のエリアの凡例（字は areas_desert.py の lib.py と同じ。u 砂丘・k ひび割れた粘土／塩の原）
//   付け替え（データの後処理の 2 段目、field_00_kit.js の link と同じ段）:
//     ・森の南（f_south）の南の峠の出口 → 赤岩の峠（d_pass）。前のワールドの砂漠はもう歩かない
//     ・東の街道（d_east）の東の峠 → 前のワールドの灰の荒野の峠の先（spawn d_east_e）。前のワールドの峠からは東の街道へ戻る
//   体験版の止め（峠の番人・崖崩れ・data/demo_gate.js）はそのまま効く（砂漠は sliceOpen に無い）。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.DESERT_LEGEND = {
    s: { mat: 'sand' }, u: { mat: 'dune_sand' }, k: { mat: 'cracked_clay' },
    ',': { mat: 'grass' }, ';': { mat: 'dune_sand' }, '"': { mat: 'grass' },
    '.': { mat: 'dirt' }, ':': { mat: 'dirt' }, _: { mat: 'shallow' }, '=': { mat: 'bridge' }, c: { mat: 'sandstone_floor' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'tree', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_sandstone', solid: true },
  };
  // 前のワールドの灰の荒野の峠（論理の座標 L 89〜93, 141 の崖崩れの先）: 東の街道から出る所と、戻る所
  const PASS_OUT = { x: 279, y: 423, dir: 'e' };
  const PASS_BACK = { x: 271, y: 423, w: 1, h: 2 };
  function link() {
    const M = R.DB.maps || {};
    // 物の絵の組: 砂漠のエリアは砂漠の組（灯籠 → かがり火）。砂漠の組に無い物（看板など）は前のまま里の組（field_00_kit.js の既定）
    for (const m of Object.values(M)) if (m && m.kind === 'field' && m.region === 'r_desert' && m.propSet === 'village') { m.propSet = 'desert'; m.propSetBase = 'village'; }
    const fs = M.f_south;
    if (fs) for (const e of fs.exits || []) if (e.to && e.to.map === 'world' && e.to.spawn === 'f_south_s') e.to = { map: 'd_pass', spawn: 'north' };
    const w = M.world;
    if (w && w.spawns && !w.spawns.d_east_e) w.spawns.d_east_e = Object.assign({}, PASS_OUT);
    if (w && w.exits && M.d_east && !w.exits.some((e) => e.to && e.to.map === 'd_east')) w.exits.push(Object.assign({}, PASS_BACK, { to: { map: 'd_east', spawn: 'pass' } }));
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
