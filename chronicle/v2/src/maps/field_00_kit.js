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
  // 絵の無い光だけの物（描いた絵の上に光だけ置く。art.painted に入れて絵は出さない、ENV_ASSETS.md §8）
  const PROPS = { lighthouse_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 170 } } };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.LEGEND = LEGEND;
  FA.LINKS = LINKS;
  FA.def = function (id, spec) {
    const m = Object.assign({
      id, kind: 'field', theme: 'field', legend: LEGEND, outside: 'forest_dark',
      light: { ambient: '#4a5290', k: 0.5, mood: 'night' }, bgm: 'overworld',
      art: { image: 'field/under/' + id, overlay: 'field/under/' + id + '_over', painted: [] },
      propSet: spec.region === 'r_forest' ? 'forest' : 'village',   // 看板・灯籠などの絵の組（props.js PROP_SET）: 半島は里の組、森は森の組
    }, spec);
    m.h = m.rows.length; m.w = [...m.rows[0]].length;
    for (const [spawn, to] of Object.entries(spec.links || {})) LINKS[spawn] = to;
    delete m.links;
    R.def('maps', id, m);
    return m;
  };
  // データの後処理（ほかのファイルの onData の後）: 町・ダンジョンの「ワールドへ」の出口・戸口・階段の行き先を、エリアに付け替える
  // 前のワールドへ出る所（縦切りの間は峠の崖崩れと番人で閉じている。全部の地方が開いたら、峠の先の前のワールドへ）。
  // いずれ隣のエリアに替える（北の峠 → 雪原のエリア、東の峠 → 山地のエリア、南の峠 → 砂漠のエリア）
  const WORLD_SPAWNS = { f_cross_e: { x: 341, y: 190, dir: 'e' }, f_south_s: { x: 100, y: 368, dir: 's' }, f_windhill_n: { x: 118, y: 133, dir: 'n' } };
  function link() {
    const M = R.DB.maps || {};
    const w = M.world;
    if (w && w.spawns) for (const [k, v] of Object.entries(WORLD_SPAWNS)) if (!w.spawns[k]) w.spawns[k] = Object.assign({}, v);
    // 前のワールドの峠（崖崩れの tilePatches の所）から戻ると、エリアへ（前のワールドの体験版の範囲には戻らない）
    if (w && w.exits && !w.exits.some((e) => e.to && e.to.map === 'f_cross')) {
      w.exits.push({ x: 338, y: 188, w: 1, h: 3, to: { map: 'f_cross', spawn: 'east' } },
        { x: 115, y: 136, w: 3, h: 1, to: { map: 'f_windhill', spawn: 'pass' } },
        { x: 98, y: 366, w: 3, h: 1, to: { map: 'f_south', spawn: 'south' } });
    }
    const re = (to) => { if (to && to.map === 'world' && LINKS[to.spawn]) { const n = LINKS[to.spawn]; to.map = n.map; to.spawn = n.spawn; } };
    for (const m of Object.values(M)) {
      if (!m || m.kind === 'world' || m.kind === 'field') continue;
      for (const e of m.exits || []) re(e.to);
      for (const o of m.objects || []) { re(o.to); if (o.door) re(o.door.to); }
      for (const t of m.triggers || []) re(t.to);
    }
    // 前のワールドの建物の戸口で、中の出口がエリアへ付け替わった所（きこりの休み小屋）: 前のワールドからは入れない
    // （入ると戻りがエリアになり、行きと帰りが合わない。前のワールドの体験版の範囲はもう歩かない）
    const into = (to) => to && M[to.map] && M[to.map].kind === 'interior' && (M[to.map].exits || []).some((e) => e.to && M[e.to.map] && M[e.to.map].kind === 'field');
    if (w && w.objects) for (const o of w.objects) if (o.type === 'building' && o.door && into(o.door.to)) delete o.door;
  }
  if (R.onData) R.onData(() => R.onData(link));   // 2 段: 読み込みのときに積まれた onData（マップの登録）が全部すんでから
})(window.RPG);
