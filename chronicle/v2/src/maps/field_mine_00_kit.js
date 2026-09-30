// ガルド山地（r_mine）のエリア切り替えのフィールドの共通（maps/field_mine_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_mine/ の areas_mine.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.MINE_LEGEND  山地のエリアの凡例（字は field_mine/lib.py と同じ。絵の当たりの合わせ fit.py がそのまま使える）
//     ',' 高山の草・';' ヒースと丈の高い草・'"' 山の花・'.' 砂利の道・':' 小道・'s' 残雪とがれ場・'_' 浅瀬・'=' 板の橋・架台・'c' 石畳
//     'u' 線路の敷石・'k' 平らな岩棚・'~' 深い水・'w' 沢・'T' 針葉樹・'F' 深い林・'b' ハイマツ・'r' 岩・鉱石の山・'R' 岩壁・'X' 築いた物・'l' 裂け目
//   R.FieldArea.MINE_LIGHT   山地の夜の光（冷たい高地の夜）
//   小道具の組 'mine'（v2/assets/env/mine/props/*__mine）: 道しるべの灯 = 木の柱に吊るした坑夫のカンテラ、置き灯・看板・掲示板も鉱山の物。
//   山地への道（WORLD_REDESIGN §2.3・§2.7 #14「峠の宿 = 雪原〜山地の峠」）: 雪原の湯けむりの峠 f_passinn の東の端の出口（前のワールドの
//     snow_east へ出ていた所。体験版のあいだは番人と cond {not:{slice:true}} で閉じる）を、ガルドの峠道 g_pass の西の端へ付け替える
//     （snow_field_passinn.js は書き換えない。データの後処理の 2 段目）。体験版の錠は demo_gate.js がそのまま効く（r_mine は sliceOpen に無い）。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.MINE_LEGEND = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'snow' }, _: { mat: 'shallow' }, '=': { mat: 'bridge' }, c: { mat: 'cobble' }, u: { mat: 'road' }, k: { mat: 'cave_floor' },
    '~': { mat: 'deep_water', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
    l: { mat: 'rock', solid: true, name: 'chasm' },
  };
  FA.MINE_LIGHT = { ambient: '#48508a', k: 0.52, mood: 'night' };
  // 雪原の湯けむりの峠（f_passinn）の東の端 → ガルドの峠道（g_pass）の西の端
  const FROM = { map: 'world', spawn: 'snow_east' }, TO = { map: 'g_pass', spawn: 'west' };
  function link() {
    const M = R.DB.maps || {};
    const p = M.f_passinn;
    if (!p || !M.g_pass) return;
    for (const e of p.exits || []) {
      if (e.to && e.to.map === FROM.map && e.to.spawn === FROM.spawn) { e.to.map = TO.map; e.to.spawn = TO.spawn; }
    }
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
