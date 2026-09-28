// エリア切り替えのフィールド（持ち主の決め 2026-09-28: 歩けるワールドのかわりに、1 エリア = 1 枚の描いた絵の四角いマップ）。
//   エリアのマップは kind 'field'（maps/field_*.js。生成物: design/art_ref/gen/env/_tools/under/field/ の areas.py → tomap.py）。
//   端の道の出口（exits、edge つき）で隣のエリアへ暗転して移る。境目の形は合わせない（出口の位置と地方の見た目だけ合わせる）。
//   出現は zones の出現表（zw_*: ワールドと同じ表・同じ歩数の間隔 K.ENC.world）。音はワールドの曲、夜の灯りもワールドと同じ。
//   絵（map.art = field/under/<id>）は入るときに読む（E.awaitMap、LRU）。絵が無いときはマスから焼く（node・読み込みの失敗）。
//   世界の地図の画面（X）は前のワールドの一枚絵のまま。エリアの中の位置は meta.worldRect（ワールドの上の四角 [x, y, w, h]）から割り出す。
//
//   R.FieldArea.LEGEND          エリアの共通の凡例（areas.py の lib.py と同じ文字）
//   R.FieldArea.def(id, spec)   エリアを登録（kind・theme・凡例・灯り・曲・絵の既定を足す）
//   R.FieldArea.LINKS           前のワールドの spawn → エリアの {map, spawn}。町・ダンジョンの「ワールドへ」の出口をデータの後処理で付け替える
//                               （roa・pharos・lighthouse_1・fern・yura・hut・well のファイルは書き換えない）。ここに無い spawn は前のワールドのまま
(function (R) {
  'use strict';
  const LEGEND = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'sand' }, _: { mat: 'shallow' }, '=': { mat: 'bridge' }, c: { mat: 'cobble' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
  };
  const LINKS = {};
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.LEGEND = LEGEND;
  FA.LINKS = LINKS;
  FA.def = function (id, spec) {
    const m = Object.assign({
      id, kind: 'field', theme: 'field', legend: LEGEND, outside: 'forest_dark',
      light: { ambient: '#4a5290', k: 0.5, mood: 'night' }, bgm: 'overworld',
      art: { image: 'field/under/' + id, overlay: 'field/under/' + id + '_over', painted: [] },
    }, spec);
    m.h = m.rows.length; m.w = [...m.rows[0]].length;
    for (const [spawn, to] of Object.entries(spec.links || {})) LINKS[spawn] = to;
    delete m.links;
    R.def('maps', id, m);
    return m;
  };
  // データの後処理（ほかのファイルの onData の後）: 町・ダンジョンの「ワールドへ」の出口・戸口・階段の行き先を、エリアに付け替える
  function link() {
    const M = R.DB.maps || {};
    const re = (to) => { if (to && to.map === 'world' && LINKS[to.spawn]) { const n = LINKS[to.spawn]; to.map = n.map; to.spawn = n.spawn; } };
    for (const m of Object.values(M)) {
      if (!m || m.kind === 'world' || m.kind === 'field') continue;
      for (const e of m.exits || []) re(e.to);
      for (const o of m.objects || []) { re(o.to); if (o.door) re(o.door.to); }
      for (const t of m.triggers || []) re(t.to);
    }
  }
  if (R.onData) R.onData(() => R.onData(link));   // 2 段: 読み込みのときに積まれた onData（マップの登録）が全部すんでから
})(window.RPG);
