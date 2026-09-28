// CONTENT-F: 迷いの森 2 階（verda_2）。V2_PLAN §3.2・WORLD_REDESIGN §4.1・§6・STORY_BIBLE §7.1
//   屋外のダンジョン 60×52。南の入口（1 階から）→ 中ほどのつじ H1 → 北のつるの壁（歌の石 3 つでほどける）→ 千年樹。
//   広場: 入口 H0・つじ H1（薬草）・西 H2（こけの語り石・ピムと小鹿）・東 H3（倒木 → ハンスのくぼ地、隠し通路 → レアの箱）・
//         北東 H4（ロイの木のうろ・薬草）・北の奥の広場 H5（暗がり E6・しょく台 3・空き小屋）・北西 H6（泉）→ H7（ダストウィング・歌の石 c）
//   森が道を変える（歌の石 3 つまで）: つじから西の広場への道は東の広場へ戻される。
//   小鹿を手当てすると、つじから奥の広場へまっすぐ抜ける獣道が開く（tilePatches）。北東と奥の広場は道で行き来できる（一方通行は置かない。描いた絵に段差が無く、持ち主 2026-09-28「行けるのに戻れない」を不具合と受け取った）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 60, H = 52;
    const g = K.grid(W, H, 'F');
    const UNSTABLE = { var: 'forest_verses', lte: 2 };

    // ---------------------------------------------------------------- 広場と道
    K.blob(g, 30, 45, 6, 4, ',', 'v2h0');             // H0 入口
    K.rect(g, 28, 48, 4, 4, 'r');
    K.blob(g, 30, 32, 6, 4, ',', 'v2h1');             // H1 つじ
    K.blob(g, 11, 36, 7, 5, ',', 'v2h2');             // H2 西（こけの語り石）
    K.blob(g, 9, 34, 3, 2, '.', 'v2h2b', ',');
    K.blob(g, 48, 36, 5, 4, ',', 'v2h3');             // H3 東
    K.blob(g, 52, 46, 4, 3, ',', 'v2h3b');            //   ハンスのくぼ地（倒木の先）
    K.blob(g, 48, 15, 6, 5, ',', 'v2h4');             // H4 北東（ロイのうろ）
    K.blob(g, 30, 15, 7, 5, ',', 'v2h5');             // H5 奥の広場（暗がり）
    K.blob(g, 30, 15, 3, 2, '.', 'v2h5b', ',');
    K.blob(g, 12, 18, 5, 4, ',', 'v2h6');             // H6 北西（泉）
    K.blob(g, 12, 6, 6, 4, ',', 'v2h7');              // H7 ダストウィングの広場
    K.blob(g, 12, 6, 3, 2, '*', 'v2h7b', ',');

    K.path(g, [[29, 41], [29, 36]], 'r', 2);                      // H0 → H1
    K.path(g, [[23, 32], [18, 32], [18, 34]], 'e', 2);            // H1 → H2（森が道を変える）
    K.path(g, [[24, 46], [14, 46], [14, 41]], 'e', 2);            // H0 → H2（遠回り）
    K.path(g, [[36, 33], [44, 33], [44, 35]], 'e', 2);            // H1 → H3
    K.path(g, [[50, 40], [50, 43]], 'e', 2);                      // H3 → くぼ地（倒木でふさがる）
    K.path(g, [[48, 32], [48, 20]], 'e', 2);                      // H3 → H4
    K.path(g, [[42, 15], [37, 15]], 'e', 2);                      // H4 ↔ H5
    K.path(g, [[11, 30], [11, 22]], 'e', 2);                      // H2 → H6
    K.path(g, [[17, 17], [23, 17]], 'e', 2);                      // H6 → H5
    K.path(g, [[11, 14], [11, 10]], 'e', 2);                      // H6 → H7
    K.path(g, [[29, 10], [29, 0]], 'r', 2);                       // H5 → 千年樹（つるの壁）
    K.rect(g, 27, 4, 6, 3, 'v');                                  //   つるの壁
    // 小鹿の獣道（手当てしたあと開く）: つじから奥の広場へまっすぐ
    const fawnRows = ['ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee', 'ee'];
    K.rect(g, 31, 19, 2, 11, 'b', 'F,"');
    // 隠し通路（東の広場の北東の森）→ レアの箱の小部屋
    K.put(g, 53, 33, 'S'); K.put(g, 54, 33, 'S'); K.put(g, 55, 33, 'S');
    K.rect(g, 55, 30, 3, 3, '.');
    K.put(g, 52, 33, ','); K.put(g, 52, 34, ',');

    // 小川と木
    K.path(g, [[1, 26], [8, 26], [8, 28], [22, 28]], '~', 1, 'F,');
    K.put(g, 11, 28, '_'); K.put(g, 12, 28, '_');                 // 浅瀬（H2 → H6 の道が渡る）
    for (const [x, y] of [[25, 43], [35, 46], [26, 30], [35, 34], [6, 38], [16, 39], [45, 37], [51, 34], [44, 13], [53, 17], [8, 19], [16, 20], [24, 13], [36, 18], [8, 5], [17, 7]]) K.put(g, x, y, 'T');
    for (const [x, y] of [[33, 44], [27, 34], [14, 33], [7, 40], [47, 39], [50, 12], [46, 18], [10, 16], [15, 4], [33, 13]]) if (K.at(g, x, y) === ',') K.put(g, x, y, 'b');

    // ---------------------------------------------------------------- 物
    const O = [];
    // こけの語り石（ロアの語り石と同じ形。読めない）とピムと小鹿
    O.push(K.prop('songstone', 8, 33, { variant: 1 }), K.exam(8, 34, 'verda_moss_stone'));
    // 倒木（斧で道を開く）とハンス
    O.push(K.prop('log', 50, 41, { cond: '!forest_log_cut' }), K.prop('log', 51, 41, { cond: '!forest_log_cut' }));
    O.push(K.exam(50, 40, 'verda_log', { cond: '!forest_log_cut' }), K.exam(51, 40, 'verda_log', { cond: '!forest_log_cut' }));
    // ロイの木のうろ
    O.push(K.prop('tree_giant', 51, 11), K.exam(51, 13, 'verda_hollow'));
    // 奥の広場: しょく台 3（暗がり）・空き小屋（記録官のかばん）
    O.push({ type: 'brazier', id: 'verda_2_b1', x: 25, y: 13 }, { type: 'brazier', id: 'verda_2_b2', x: 36, y: 18 }, { type: 'brazier', id: 'verda_2_b3', x: 30, y: 19 });
    O.push({ type: 'building', id: 'verda_2_hut', x: 32, y: 10, w: 5, h: 3, wall: 2, roof: 'moss', mat: 'log', windows: 0, small: true });
    O.push(K.exam(34, 13, 'verda_empty_hut'));
    // ダストウィングの広場・歌の石 c（泉は置かない。WORLD §6.2。前の泉の所は蛍と草むら）
    O.push(K.prop('firefly', 13, 17), K.prop('fern', 14, 18));
    O.push(K.prop('songstone', 12, 4), K.exam(12, 5, 'verda_stone_c'));
    // 薬草
    O.push(K.prop('mushroom_glow', 33, 30), K.exam(33, 30, 'verda_herb', { herb: 4 }));
    O.push(K.prop('mushroom_glow', 45, 17), K.exam(45, 17, 'verda_herb', { herb: 5 }));
    // 宝箱（5〜7）
    O.push(K.chest('verda_2_c1', 5, 37, { pool: 'p_T' }));
    O.push(K.chest('verda_2_c2', 55, 47, { item: 'i_potion', n: 2 }));
    O.push(K.chest('verda_2_c3', 56, 31, { pool: 'p_rare' }));      // 隠し通路の先
    O.push(K.chest('verda_2_c4', 33, 17, { pool: 'p_T' }));         // 暗がりの中（きらめきは膜の上）
    O.push(K.chest('verda_2_c5', 53, 14, { gold: 140 }));
    O.push(K.chest('verda_2_c6', 16, 6, { pool: 'p_T' }));
    O.push(K.chest('verda_2_c7', 9, 20, { item: 'i_antidote', n: 2 }));
    // ピムの足あと: 入口 → 遠回りの道 → 西の広場
    O.push({ type: 'trail', id: 'verda_2_pim', path: [[29, 49], [28, 47], [26, 46], [23, 47], [20, 46], [17, 47], [15, 45], [14, 43], [13, 41], [12, 39], [10, 37]], cond: { item: 'k_pim_hat' } });
    O.push(K.sign(27, 29, 'この先、森の奥。\n――ひとりで入るべからず（きこり組）'));
    O.push(K.prop('lantern', 27, 41));

    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('ree'.includes(K.at(g, x, y))) keep.add(x + ',' + y);
    K.scatter(g, O, 'mushroom_glow', 12, [1, 1, 58, 50], ',"', 'v2mg', { keep, gap: 4, variant: true });
    K.scatter(g, O, ['rock_small', 'stump', 'rock'], 12, [1, 1, 58, 50], ',"', 'v2rk', { keep, gap: 4, variant: true });
    K.scatter(g, O, 'firefly', 10, [1, 1, 58, 50], ',"', 'v2ff', { keep, gap: 6 });

    // ---------------------------------------------------------------- 人
    // ---------------------------------------------------------------- 描いた絵に当たりを合わせる（K.fit。絵の床・壁・描き足した大木の所。
    //   手で組んだ上の形は絵の下書き。絵がずれた所だけここで直す。マスの一覧はマップの絵の床の割合から拾い、重ねた当たりの絵で確かめた）
    const PAINTED = ['stump@16,7', 'stump@9,8', 'tree_giant@51,11', 'rock_small@53,15', 'rock@35,16', 'rock_small@25,17', 'fern@14,18', 'rock_small@12,21', 'rock@27,30', 'rock@34,34', 'stump@15,35', 'rock_small@34,44', 'rock@49,45', 'rock@53,45'];
    K.fit(g, {
      r: '31,2',
      F: '9,3 16,4 7,5 9,5 7,6 7,7 8,7 8,8 17,8 9,9 15,9 26,11 32,11 33,11 50,11 32,12 33,12 34,12 35,12 44,12 25,13 45,13 47,13 49,13 50,13 51,13 24,14 28,14 ' +
        '30,14 31,14 47,14 48,14 49,14 50,14 51,14 24,15 28,15 29,15 30,15 31,15 32,15 47,15 48,15 49,15 50,15 51,15 8,16 29,16 30,16 31,16 32,16 48,16 49,16 ' +
        '50,16 51,16 8,17 13,17 29,17 30,17 31,17 48,17 49,17 50,17 51,17 8,18 11,18 13,18 26,18 44,18 9,19 11,19 12,19 13,19 14,19 27,19 45,19 9,20 12,20 13,20 ' +
        '9,21 32,30 55,30 56,30 57,30 30,31 31,31 32,31 55,31 8,32 29,32 30,32 31,32 32,32 33,32 7,33 29,33 30,33 31,33 32,33 33,33 5,34 6,34 9,34 11,34 12,34 ' +
        '30,34 31,34 32,34 5,35 10,35 11,35 12,35 27,35 5,36 9,36 11,36 12,36 5,37 9,37 10,37 11,37 12,37 5,38 7,38 10,38 11,38 29,38 44,38 7,39 46,39 48,39 8,40 25,44 30,44 31,44 28,45 29,45 30,45 31,45 29,46 30,46 31,46 51,46 53,46 35,47 51,47 52,47 53,47 27,48 52,48 53,48 28,49 31,49 28,50 31,50',
      ",": '15,4 17,4 18,5 32,10 33,10 53,13 16,15 54,16 53,18 31,19 32,19 31,29 32,29 14,33 51,34 47,39',
    }, O, PAINTED);

    const N = [
      K.npc('pim', 'npc_pim', 10, 36, { name: 'ピム', dir: 'e', talk: 'verda_pim', cond: '!forest_found_pim', pushable: false, reward: 'side' }),
      K.npc('fawn', 'ani_fawn', 9, 37, { name: '花角の小鹿', dir: 'e', talk: 'verda_fawn_choice', cond: '!forest_fawn_done', pushable: false }),
      K.npc('hans', 'npc_hans', 52, 46, { name: 'ハンス', dir: 'n', talk: 'verda_hans', cond: '!forest_found_hans', pushable: false }),
      K.npc('roy', 'npc_roy', 51, 13, { name: 'ロイ', dir: 's', talk: 'verda_hollow', cond: ['forest_roy_out', '!forest_found_roy'], pushable: false }),
    ];

    K.def('verda_2', {
      name: '迷いの森', kind: 'dungeon', region: 'r_forest', location: 'verda', theme: 'forest_dungeon',
      legend: K.FOREST_LEGEND({
        S: { mat: 'forest_dark', solid: true, secret: true, floor: 'grass' },
        v: { mat: 'bush', solid: true, name: 'vines' },
      }),
      rows: g, outside: 'forest_dark',
      // 描いた一枚絵（design/ENV_ASSETS.md §8）。隠し通路・つるの壁・小鹿の獣道は closed の絵（閉じている間だけ上に置く）
      art: { image: 'forest_dungeon/under/verda_2', closed: 'forest_dungeon/under/verda_2_closed', painted: PAINTED },
      objects: O, npcs: N,
      spawns: {
        south: { x: 29, y: 49, dir: 'n' },
        north: { x: 29, y: 2, dir: 's' },
        h3: { x: 45, y: 34, dir: 'e' },
        moth: { x: 11, y: 11, dir: 'n' },
      },
      exits: [
        { x: 28, y: 51, w: 4, h: 1, to: { map: 'verda_1', spawn: 'north' } },
        { x: 28, y: 0, w: 4, h: 1, to: { map: 'elder_1', spawn: 'south' } },
        { x: 20, y: 32, w: 1, h: 2, to: { map: 'verda_2', spawn: 'h3' }, cond: UNSTABLE },
      ],
      triggers: [
        { id: 'arrive', on: 'enter', event: 'verda_2_arrive', once: true },
        { id: 'mist_w', x: 21, y: 32, w: 1, h: 2, on: 'step', event: 'verda_mist', cond: UNSTABLE, once: true },
        { id: 'moth', x: 8, y: 7, w: 9, h: 3, on: 'step', event: 'verda_moth', cond: '!forest_moth' },
        { id: 'vines', x: 29, y: 7, w: 2, h: 1, on: 'step', event: 'verda_vines', cond: UNSTABLE },
      ],
      tilePatches: [
        { cond: { var: 'forest_verses', gte: 3 }, rect: [27, 4, 6, 3], rows: ['eeeeee', 'eeeeee', 'eeeeee'] },
        { cond: { choice: 'ch_forest_fawn', is: 'heal' }, rect: [31, 19, 2, 11], rows: fawnRows },
      ],
      zones: [{ rect: null, zone: 'z_verda' }],
      light: { ambient: '#505c98', k: 0.52, mood: 'forest_night' },
      // 奥の広場は歌の灯が消えかけた暗がり（E6）。解決のあとは明るい
      dark: [{ rect: [21, 8, 19, 14], cond: '!cleared_r_forest' }],
      bgm: 'forest', bbg: 'forest',
      meta: { chestsInfo: true, floor: '2 階', sub: '歌の石の森' },
    });
  });
})(window.RPG);
