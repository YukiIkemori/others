// CONTENT-P: 旅人の古井戸（well、寄り道 #3。小さな洞窟 36×30、1 階）。V2_PLAN §3.2、WORLD_REDESIGN §2.7-3・§6.2・§6.3
//   半島の北の分かれ道の枯れ井戸から下りる。井戸の底の水たまり → こけの広間 → 中ほどの泉 → 宝石ウサギの巣（花の咲くくぼみ）。
//   宝箱 3（隠し通路の先の 1 つを含む）、泉 1（中ほど）、隠し通路 1（西の袋小路の奥）。宝の地図 その1 の封じの扉は置かない（縦切りの外）。
//   出現 z_well（宝石ウサギの巣）。BGM cave、戦闘背景 cave。脱出 → ワールドの古井戸の前。
//   spawns: entrance（上り口。ワールドから）
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const { rect, put, blob, path } = K;
    const P = K.prop, PS = K.props;
    const W = 36, H = 30, g = K.grid(W, H, '#');
    // 広間（入口・水たまり・こけの広間・泉の間・東の広間・西の袋小路・巣）
    blob(g, 18, 4, 5, 2, '.', 'wl_a');            // 井戸の底（上り口）
    blob(g, 8, 9, 4, 3, '.', 'wl_b');             // 水たまりの間
    blob(g, 8, 9, 2, 1, 'w', 'wl_b_pool', ['.']);
    blob(g, 18, 14, 5, 3, '.', 'wl_c');           // 中ほど（泉の間）
    blob(g, 29, 10, 4, 4, '.', 'wl_d');           // 東のこけの広間
    blob(g, 29, 10, 2, 2, 'm', 'wl_d_moss', ['.']);
    blob(g, 8, 22, 5, 3, '.', 'wl_e');            // 西の間
    blob(g, 27, 23, 6, 4, '.', 'wl_f');           // 宝石ウサギの巣（花）
    blob(g, 27, 24, 3, 2, 'o', 'wl_f_fl', ['.']);
    // 道（1〜2 マス。曲がりくねる）
    path(g, [[17, 6], [17, 8], [12, 8]], '.', 2);                     // 入口 → 水たまり
    path(g, [[8, 12], [8, 15], [13, 15]], '.', 1);                    // 水たまり → 泉の間
    path(g, [[22, 13], [26, 13], [26, 11]], '.', 1);                  // 泉の間 → 東の広間
    path(g, [[29, 14], [29, 17], [24, 17], [24, 20]], '.', 1);        // 東の広間 → 巣の手前
    path(g, [[15, 17], [15, 19], [10, 19]], '.', 1);                  // 泉の間 → 西の間
    // 描いた絵に合わせる（オーナー「中央左下の通路が通れない」）: 泉の間から下りる道は x 15〜16 の 2 マス幅で、泉の間の下の行（y 16）とつながる
    rect(g, 15, 16, 2, 4, '.'); put(g, 21, 16, '.');
    path(g, [[13, 23], [21, 23]], '.', 1);                            // 西の間 → 巣
    path(g, [[3, 22], [2, 22], [2, 26]], '.', 1);                     // 西の間の南西の隅から下りる細い道（隠し通路の先）
    rect(g, 2, 27, 3, 2, '.');                                        // 隠し通路の先の小部屋
    // 隠し通路は西の間の南西の隅の壁（2, 23）。持ち主 2026-09-29「左下の隠し通路が半分見えている」: 前は袋小路の道（x 2 の y 23〜25）が
    //   見えていて、その先だけ岩で塗っていた。今は道の入口から先を全部かくし、見つける前は西の間の南の壁と同じ絵（下絵の closed の層）
    put(g, 2, 23, 'S'); put(g, 4, 23, '#');                           // (4, 23) は描いた岩の柱の頭
    // 東の広間の北の袋小路（宝箱）。描いた絵では小部屋は x 30〜31、東の広間へ下りる道は x 30（x 31〜32 の y 6〜8 は岩の柱、x 32 の y 3〜5 は壁の縁）
    //（オーナー「右上の小部屋も通路の判定がおかしい」）
    rect(g, 30, 3, 2, 3, '.'); path(g, [[30, 5], [30, 7]], '.', 1); rect(g, 31, 7, 1, 2, '#');

    const legend = {
      '#': { mat: 'wall_cave', solid: true, rise: 2 }, '.': { mat: 'cave_floor' }, m: { mat: 'moss_earth' }, o: { mat: 'flowers' },
      w: { mat: 'water', walk: false }, S: { mat: 'wall_cave', solid: true, rise: 2, secret: true, floor: 'cave_floor' },
    };
    const objects = [
      K.stairs(18, 3, { map: 'world', spawn: 'well' }), P('stairs_up', 18, 3),
      // 泉は置かない（1 階だけの短い寄り道。WORLD §6.2）。前の泉の所は石と光るきのこ
      P('rock_small', 17, 13), P('mushroom_glow', 18, 14),
      P('mushroom_glow', 31, 9), P('rock_small', 32, 10),
      K.chest('wl_c1', 31, 3, { pool: 'p_T' }),
      // 隠し通路の先。レアの箱の見た目（pool p_rare）のまま、中身は決まった品（オーナー「いきなり強いの出過ぎ」: p_rare は序盤でも帯 1 のレア装備
      // ＝店の段 1 の上。寄り道の最初の洞窟には重い）→ 序盤のレアの薬 滋養の丸薬（HP30・MP10）を 2 つ
      K.chest('wl_c2', 3, 28, { pool: 'p_rare', item: 'i_tonic', n: 2 }),
      K.chest('wl_c3', 31, 24, { item: 'i_jewel_carrot', n: 1 }),     // 巣の奥
      ...PS('crystal', [[23, 3], [5, 7], [33, 9], [21, 16], [4, 20], [33, 22]]),
      ...PS('mushroom_glow', [[13, 4], [11, 11], [26, 8], [14, 16], [7, 24], [22, 25], [30, 20], [5, 21]]),
      ...PS('rock_small', [[21, 5], [6, 11], [31, 13], [16, 12], [11, 21], [24, 26], [28, 21]]),
      ...PS('firefly', [[25, 24], [29, 26], [26, 22]]),
      P('grave', 20, 16), P('log', 9, 21), P('stump', 31, 14), P('bush', 34, 24),
      K.sign(16, 4, R.T('map.optional_well.objects.sign')),
      K.exam(20, 16, 'well_grave'),
    ];
    K.def('well', {
      name: R.T('map.optional_well.well.name'), kind: 'dungeon', optional: true, region: 'prologue', location: 'well', theme: 'cave',
      legend, rows: g, outside: 'wall_cave', objects,
      // 描いた一枚絵（design/ENV_ASSETS.md §8）。隠し通路の先は closed の絵で、見つけるまで岩のまま
      art: { image: 'cave/under/well', closed: 'cave/under/well_closed', emit: 'cave/under/well_emit', painted: ['rock_small@32,10', 'rock_small@6,11', 'rock_small@16,12', 'rock_small@17,13', 'rock_small@31,13', 'stump@31,14', 'log@9,21', 'rock_small@11,21', 'rock_small@28,21', 'bush@34,24', 'rock_small@24,26'] },
      spawns: { entrance: { x: 18, y: 4, dir: 's' } },
      triggers: [{ id: 'nest', x: 22, y: 21, w: 3, h: 5, on: 'step', event: 'well_nest', once: true }],
      zones: [{ rect: null, zone: 'z_well' }],
      light: { ambient: '#5e5890', k: 0.66, mood: 'cave' }, bgm: 'cave', bbg: 'cave',
      meta: { chestsInfo: true, floor: R.T('map.optional_well.well.meta.floor'), sub: R.T('map.optional_well.well.meta.sub') },
    });
  });
})(window.RPG);
