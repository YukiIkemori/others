// 地面に落ちている「拾う物」のきらめき（持ち主 2026-10-04「地面に落ちている物にヒントがゼロ。きつい」）。
//   筋・依頼に要る物を拾う「調べる所」で、絵にも物にも目印の無い所に prop 'glint'（K.glint、絵は systems/field/layers.js）を置く。
//   cond は「頼まれている間・まだ拾っていない間」だけ真（拾ったら消える）。生成したマップのファイル（field_*）は書き換えず、ここでデータの後に足す。
//   置かない所（わざと）: 名所の裏の隠し物（world_poi_cache。探すのが遊び）・隠れた戦い（desert_tomb_lizard）・年代記の覚え書き（lore だけの調べる所）・
//   絵ではっきり見える物（祭壇の石・巣・岩・壁画・掲示板・像。描いてある）・置いた物（本の山・足あと・薪・氷の結晶・光る夜光虫）がある所。
//   tools/test_isles_fixes_1004.js と同じく tools/test_glints.js が、拾う所に目印があることを確かめる。
(function (R) {
  'use strict';
  const MAT = ['snow_statue_asked', '!snow_statue_done'];
  const LIST = R.GLINTS = [
    // 迷いの森（ヴェルダ）: ハンスの斧・ベンの笛
    { map: 'verda_1', x: 12, y: 10, event: 'verda_axe', cond: '!forest_got_axe' },
    { map: 'verda_1', x: 46, y: 12, event: 'verda_flute', cond: '!forest_got_flute' },
    // 幽霊船の名札 6 つ（年代記の書き方が変わる）
    ...[[1, 29, 5], [2, 34, 5], [3, 37, 5], [4, 5, 20], [5, 11, 4], [6, 14, 19]].map(([n, x, y]) => ({ map: 'ghost_ship_2', x, y, event: 'isles_nametag', cond: '!isles_tag_' + n })),
    // 光る貝がら 12（貝がら好きの子の依頼）
    ...[['coral', 45, 49, 1], ['coral', 11, 33, 2], ['nerei', 29, 21, 3], ['nerei', 11, 26, 4], ['nerei', 12, 28, 5], ['isles_cave_1', 12, 13, 6], ['isles_cave_1', 41, 23, 7], ['isles_cave_1', 24, 27, 8],
      ['isles_cave_2', 37, 24, 9], ['isles_cave_2', 13, 14, 10], ['isles_cave_2', 19, 3, 11], ['isles_cave_2', 29, 7, 12]].map(([map, x, y, n]) => ({ map, x, y, event: 'isles_shell', cond: '!isles_shell_' + n })),
    // 雪像の飾りの材料（リーサの依頼の間だけ）
    ...[['f_eastroad', 48, 27, 'snow_mat_coal'], ['f_lake', 13, 21, 'snow_mat_ice'], ['f_passinn', 12, 15, 'snow_mat_berry'], ['snow_woods', 37, 23, 'snow_mat_berry'],
      ['yule', 3, 8, 'snow_mat_ice'], ['yule_night', 3, 8, 'snow_mat_ice'], ['yule_sonja', 7, 3, 'snow_mat_coal']].map(([map, x, y, f]) => ({ map, x, y, event: 'snow_mat', cond: MAT.concat(['!' + f]) })),
    // 星の落ちた火口: 祭壇の上の星のかけら（描いた祭壇の前で調べる）
    { map: 's_crater', x: 28, y: 26, event: 'star_crater_altar', cond: '!star_shard' },
  ];
  function add() {
    const M = R.DB.maps || {};
    for (const g of LIST) {
      const m = M[g.map];
      if (!m) continue;
      if (!(m.objects || []).some((o) => o.type === 'examine' && o.x === g.x && o.y === g.y && o.event === g.event)) { R.warn && R.warn(`glints: no examine ${g.event} at ${g.map} ${g.x},${g.y}`); continue; }
      if ((m.objects || []).some((o) => o.type === 'prop' && o.id === 'glint' && o.x === g.x && o.y === g.y)) continue;
      m.objects.push({ type: 'prop', id: 'glint', x: g.x, y: g.y, cond: g.cond });
    }
  }
  if (R.onData) R.onData(() => R.onData(add));
})(window.RPG);
