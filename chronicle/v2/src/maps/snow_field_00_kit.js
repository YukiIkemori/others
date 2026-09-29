// 雪原のエリア切り替えのフィールド（maps/field_00_kit.js の R.FieldArea と同じ仕組み。1 エリア = 1 枚の描いた絵）。
//   エリアのマップは snow_field_*.js（生成物: design/art_ref/gen/env/_tools/under/snow/field/ の areas.py → fit.py → tomap.py）。
//   凡例の字はデモのエリアと同じ（絵の当たりの合わせ fit.py がそのまま使える）。読みだけ雪原の素材にする:
//     ',' 雪・';' 風紋の雪・'"' 枯れ草の出た雪・'.' 踏み固めた雪の道・':' 小道・'s' 厚い氷（歩ける）・'=' 板の橋・'c' 敷石
//     '~' 暗い海・'w' 水（薄氷の湖・湯・流れ）・'T' 雪のもみ・'F' 雪の深い森・'b' 雪をかぶった低木・'r' 岩・'R' 氷の崖・'X' 築いた物
//   R.Snow.fieldArea(id, spec)   雪原のエリアを登録（R.FieldArea.def に雪原の凡例・外の素材・小道具の組を足す）
//   ワールドとのつなぎ（データの後処理、2 段）:
//     ・森の風鳴りの丘の北の峠（前のワールドの f_windhill_n へ出る出口）→ 凍て風の峠（f_snowpass.south）。体験版の間は DemoGate が止める
//     ・湯けむりの峠の東の出口（前のワールドの snow_east）と、前のワールドの峠の崖崩れの所から湯けむりの峠へ戻る出口
//   町・ダンジョンの「ワールドへ」の出口の付け替えは、各エリアの links（R.FieldArea.LINKS）で field_00_kit.js が行う。
(function (R) {
  'use strict';
  const S = (R.Snow = R.Snow || {});
  const LEGEND = {
    ',': { mat: 'snow' }, ';': { mat: 'snow' }, '"': { mat: 'snow' }, '.': { mat: 'snow_path' }, ':': { mat: 'snow_path' },
    s: { mat: 'ice' }, _: { mat: 'ice' }, '=': { mat: 'bridge' }, c: { mat: 'cobble' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true, under: 'snow', tree: ['snow_fir'] }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'wall_snow', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
  };
  S.FIELD_LEGEND = LEGEND;
  /** 雪原のエリアを登録。spec は FieldArea.def と同じ形（凡例・外・小道具の組の既定だけ雪原にする）。
   *  小道具の組 'snow'（v2/assets/env/snow/props/*__snow）: 道しるべの灯籠 = 氷の灯籠、野営の天幕 = 毛皮の天幕、置き灯籠 = 氷の灯り、看板 = 雪の看板 */
  S.fieldArea = function (id, spec) {
    return R.FieldArea.def(id, Object.assign({ legend: LEGEND, outside: 'wall_snow', propSet: 'snow' }, spec));
  };

  // 前のワールドの東の峠（山地の側）: 崖崩れ（体験版の間の tilePatches）の先に着く所と、そこから雪原へ戻る出口
  const EAST = { spawn: { x: 268, y: 91, dir: 'e' }, exit: { x: 265, y: 90, w: 1, h: 2, to: { map: 'f_passinn', spawn: 'east' } } };
  function link() {
    const M = R.DB.maps || {};
    if (!M.f_snowpass) return;
    // 風鳴りの丘の北の峠 → 凍て風の峠
    const wh = M.f_windhill;
    if (wh) for (const e of wh.exits || []) if (e.to && e.to.map === 'world' && e.to.spawn === 'f_windhill_n') e.to = { map: 'f_snowpass', spawn: 'south' };
    const w = M.world;
    if (w && w.spawns && M.f_passinn) {
      if (!w.spawns.snow_east) w.spawns.snow_east = Object.assign({}, EAST.spawn);
      if (w.exits && !w.exits.some((e) => e.to && e.to.map === 'f_passinn')) w.exits.push(JSON.parse(JSON.stringify(EAST.exit)));
    }
  }
  if (R.onData) R.onData(() => R.onData(link));   // field_00_kit.js と同じ 2 段（DemoGate の 3 段より先）
})(window.RPG);
