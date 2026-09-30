// 灰の荒野（r_ash）のエリア切り替えのフィールドの共通（maps/field_ash_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_ash/ の areas_ash.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.ASH_LEGEND  灰の荒野のエリアの凡例（字は areas_ash.py の lib.py と同じ。絵の当たりの合わせ fit.py がそのまま使える）
//     's' 灰の地面・'u' 灰の吹きだまり・'k' 冷えた溶岩の殻・',' 苔と草（湯の谷）・';' 灰色の枯れ草・'.' 灰の街道・':' 小道・'c' 玄武岩の敷石
//     '_' 浅瀬・'=' 橋・'~' 海・'w' 湯・潮だまり・'l' 溶岩（通れない）・'T' 焦げた木・'b' 灰の茂み・'r' 岩・'R' 岩山・'X' 築いた物（砦・宿・門）
//   R.FieldArea.ASH_LIGHT   灰の荒野の夜の光（少し赤みのある暗さ）
//   小道具の組 'ash'（v2/assets/env/ash/props/*__ash）: 道しるべの灯籠 = 玄武岩の柱の鉄のかがり籠、置き灯籠・天幕・看板も灰の荒野の物（地図の propSet）
//   付け替え（データの後処理の 2 段目、field_00_kit.js の link と同じ段）:
//     ・砂漠の東の街道（d_east）の東の峠（前のワールドの d_east_e へ出る出口）→ 灰かぶりの峠（a_pass.west）
//     ・湿原の鐘沈みの沼の縁（m_bog）の南の端（前のワールドの潮見橋 marsh_s へ出る出口）→ 潮見橋のたもと（a_bridge.north）
//     前のワールドの灰の荒野はもう歩かない。町・ダンジョンの「ワールドへ」の出口は各エリアの links（R.FieldArea.LINKS）で付け替わる。
//   体験版の止め（カシムの東の峠の番人・崖崩れ・data/demo_gate.js）はそのまま効く（灰の荒野は sliceOpen に無い）。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.ASH_LEGEND = {
    s: { mat: 'ash' }, u: { mat: 'ash' }, k: { mat: 'obsidian' }, ',': { mat: 'grass' }, ';': { mat: 'ash' }, '"': { mat: 'grass' },
    '.': { mat: 'road' }, ':': { mat: 'dirt' }, c: { mat: 'basalt_floor' }, _: { mat: 'shallow' }, '=': { mat: 'bridge' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false }, l: { mat: 'lava', walk: false },
    T: { mat: 'tree', solid: true, under: 'ash', tree: ['charred_tree'] }, F: { mat: 'rock', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
  };
  // (2026-09-29 見直し) 砂漠・雪原のエリアの夜と同じくらいの明るさに（前の '#4e4a80' は灰の地面が沈んで見えた）
  FA.ASH_LIGHT = { ambient: '#5a5892', k: 0.5, mood: 'night' };
  // エリアからダンジョンへ入る所の確かめの文（field_00_kit.js の CONFIRM に足す）
  if (FA.CONFIRM) FA.CONFIRM.ash_volcano_1 = R.T('map.field_ash_00_kit.ash_volcano_1');
  function link() {
    const M = R.DB.maps || {};
    if (!M.a_pass) return;
    const re = (m, spawn, to) => { if (m) for (const e of m.exits || []) if (e.to && e.to.map === 'world' && e.to.spawn === spawn) e.to = Object.assign({}, to); };
    re(M.d_east, 'd_east_e', { map: 'a_pass', spawn: 'west' });
    if (M.a_bridge) re(M.m_bog, 'marsh_s', { map: 'a_bridge', spawn: 'north' });
    // 湿原のエリアがまだ無いとき（潮見橋の北は前のワールドの橋の上へ）
    if (M.a_bridge && !M.m_bog) for (const e of M.a_bridge.exits || []) if (e.to && e.to.map === 'm_bog') e.to = { map: 'world', spawn: 'ash_bridge' };
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
