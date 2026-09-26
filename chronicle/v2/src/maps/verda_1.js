// CONTENT-F: 迷いの森 1 階（verda_1）。V2_PLAN §3.2・WORLD_REDESIGN §4.1・§6・STORY_BIBLE §7.1
//   屋外のダンジョン 60×52。南の入口（フェルンの北の門から）→ 蛍だまりの泉と野営地（中ほど）→ 北の出口（2 階へ）。
//   広場: 入口の広場 G0・野営地 G1・西 G2（歌の石 a・薬草）・東 G3（狼に囲まれたベン）・南東 G4（どんぐり王子・薬草）・
//         南西 G5（木のうろの隠し通路 → レアの箱）・北 G6（薬草・ピムの足あと）・北西 G7（ハンスの斧）・北東 G8（歌の石 b・ベンの笛）
//   森が道を変える（歌の石 3 つまで）: 野営地から東へ抜ける道は G4 へ、西の広場から北へ抜ける道は G5 へ戻される（exits の cond）。
//   一方通行: 北の広場から北西へ下る段差（西向きだけ。北西の広場からは南の道で戻る）。
//   本筋の道: 入口 → 野営地 → 東（森が変わる間は南東へ回される）→ 北東 → 北 → 2 階。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 60, H = 52;
    const g = K.grid(W, H, 'F');
    const UNSTABLE = { var: 'forest_verses', lte: 2 };

    // ---------------------------------------------------------------- 広場と道
    K.blob(g, 30, 46, 5, 4, ',', 'v1g0');            // G0 入口の広場
    K.rect(g, 28, 49, 4, 3, 'r');                    // フェルンへの道
    K.blob(g, 30, 29, 8, 6, ',', 'v1g1');            // G1 野営地
    K.blob(g, 30, 29, 4, 3, '.', 'v1g1b', ',');     //   焚き火のまわりの踏み固めた土
    K.blob(g, 11, 30, 6, 5, ',', 'v1g2');            // G2 西
    K.blob(g, 10, 32, 3, 2, '"', 'v1g2b', ',');
    K.blob(g, 48, 25, 6, 5, ',', 'v1g3');            // G3 東（狼）
    K.blob(g, 49, 43, 6, 4, ',', 'v1g4');            // G4 南東（どんぐり）
    K.blob(g, 51, 44, 3, 2, '*', 'v1g4b', ',');
    K.blob(g, 11, 44, 5, 4, ',', 'v1g5');            // G5 南西
    K.blob(g, 30, 10, 6, 4, ',', 'v1g6');            // G6 北
    K.blob(g, 11, 11, 5, 4, ',', 'v1g7');            // G7 北西（ハンスの斧）
    K.blob(g, 49, 10, 5, 4, ',', 'v1g8');            // G8 北東（歌の石 b）
    K.blob(g, 47, 9, 2, 2, '"', 'v1g8b', ',');

    K.path(g, [[29, 42], [29, 33]], 'r', 2);                       // G0 → G1
    K.path(g, [[21, 29], [17, 29]], 'e', 2);                       // G1 → G2（西）
    K.path(g, [[37, 28], [43, 28], [43, 26]], 'e', 2);             // G1 → G3（東。森が道を変える）
    K.path(g, [[34, 46], [44, 46], [44, 44]], 'e', 2);             // G0 → G4
    K.path(g, [[48, 39], [48, 30]], 'e', 2);                       // G4 → G3（遠回りの道）
    K.path(g, [[25, 46], [16, 46]], 'e', 2);                       // G0 → G5
    K.path(g, [[11, 25], [11, 16]], 'e', 2);                       // G2 → G7（北。森が道を変える）
    K.path(g, [[24, 10], [20, 10], [20, 12], [16, 12]], 'e', 2);   // G6 → G7（段差で西向きだけ）
    K.path(g, [[36, 11], [39, 11], [39, 13], [43, 13], [43, 11]], 'e', 2);   // G6 ↔ G8
    K.path(g, [[50, 15], [50, 18], [52, 18], [52, 20]], 'e', 2);   // G8 ↔ G3
    K.path(g, [[29, 6], [29, 0]], 'r', 2);                         // G6 → 2 階
    // 南西の広場の大木のうろ → 隠し通路（見つけるまで森の壁と同じ）→ 小部屋（ピムの「秘密のうろ」）
    K.rect(g, 6, 43, 3, 3, ',');
    K.put(g, 5, 44, 'S'); K.put(g, 4, 44, 'S');
    K.rect(g, 2, 44, 2, 1, '.');
    K.rect(g, 2, 45, 4, 3, '.');

    // 道の縁をやわらげる（隠し通路のまわりは森の壁のまま）
    const guard = new Set();
    for (let y = 42; y <= 48; y++) for (let x = 1; x <= 7; x++) guard.add(x + ',' + y);
    K.soften(g, 'F', ',"*.er', [',', '"', ','], 0.6, 'v1', guard);

    // 小川（野営地の北東の水場）と、ところどころの藪・木
    K.blob(g, 37, 33, 2, 1, '~', 'v1w1', ',');
    K.blob(g, 44, 45, 1, 1, '~', 'v1w2', ',');
    for (const [x, y] of [[25, 25], [35, 25], [24, 33], [36, 34], [6, 30], [16, 33], [44, 22], [53, 28], [26, 8], [34, 12], [8, 9], [53, 11], [45, 41], [8, 42], [14, 47]]) K.put(g, x, y, 'T');
    for (const [x, y] of [[27, 26], [33, 32], [9, 27], [15, 28], [51, 23], [45, 27], [52, 45], [46, 46], [32, 8], [14, 13], [51, 8]]) if (K.at(g, x, y) === ',') K.put(g, x, y, 'b');

    // ---------------------------------------------------------------- 物
    const O = [];
    O.push(K.spring('verda_1_s1', 26, 27));                         // 蛍だまりの泉（1 階の中ほど）
    O.push({ type: 'brazier', id: 'verda_1_camp', x: 31, y: 30, on: true });   // 野営地の焚き火
    O.push(K.prop('tent', 34, 27), K.prop('log', 29, 31), K.prop('log', 33, 31), K.prop('sack', 35, 28), K.prop('crate', 35, 30));
    O.push(K.prop('lantern', 28, 26), K.prop('lantern', 34, 32));
    O.push(K.prop('beacon', 30, 23, { cond: 'cleared_r_forest' }));   // 梢の歌の灯（解決のあと。大灯火の光の柱）

    // 歌の石・持ち物・薬草・宝箱
    O.push(K.prop('songstone', 10, 28), K.exam(10, 29, 'verda_stone_a'));
    O.push(K.prop('songstone', 51, 9), K.exam(51, 10, 'verda_stone_b'));
    O.push(K.prop('stump', 12, 9), K.exam(12, 10, 'verda_axe'));                     // ハンスの斧（切り株に刺さっている）
    O.push(K.prop('rock_small', 46, 12), K.exam(46, 12, 'verda_flute'));              // ベンの笛（石のそば）
    O.push(K.prop('mushroom_glow', 13, 33), K.exam(13, 33, 'verda_herb', { herb: 1 }));
    O.push(K.prop('mushroom_glow', 53, 42), K.exam(53, 42, 'verda_herb', { herb: 2 }));
    O.push(K.prop('mushroom_glow', 34, 8), K.exam(34, 8, 'verda_herb', { herb: 3 }));
    O.push(K.exam(50, 44, 'verda_acorn'));                                            // どんぐり王子の広場（依頼）
    O.push(K.prop('stump', 49, 44));
    O.push(K.chest('verda_1_c1', 7, 33, { pool: 'p_T' }));
    O.push(K.chest('verda_1_c2', 52, 46, { item: 'i_salve', n: 3 }));
    O.push(K.chest('verda_1_c3', 3, 47, { pool: 'p_rare' }));                        // 隠し通路の先
    O.push(K.chest('verda_1_c4', 26, 9, { pool: 'p_T' }));
    O.push(K.chest('verda_1_c5', 8, 13, { item: 'i_waker', n: 2 }));
    O.push(K.chest('verda_1_c6', 53, 25, { pool: 'p_T', cond: 'forest_found_ben' }));  // 狼を追い払ったあと
    O.push(K.chest('verda_1_c7', 13, 43, { gold: 90 }));

    // ピムの足あと（帽子の片方を持つと光る）: 北の広場から 2 階へ
    O.push({ type: 'trail', id: 'verda_1_pim', path: [[36, 12], [34, 11], [32, 10], [30, 9], [29, 7], [30, 5], [29, 3], [30, 1]], cond: { item: 'k_pim_hat' } });
    // 道しるべ
    O.push(K.sign(27, 41, '← 西の広場　　東の広場 →\n（文字の半分が、苔に埋もれている）'));

    // 散らす: 野営地のまわりの蛍と茸、広場の石と切り株
    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (K.at(g, x, y) === 'r' || K.at(g, x, y) === 'e') keep.add(x + ',' + y);
    K.scatter(g, O, 'firefly', 8, [20, 20, 22, 18], ',."', 'v1ff', { keep, gap: 3 });
    K.scatter(g, O, 'mushroom_glow', 10, [1, 1, 58, 50], ',"', 'v1mg', { keep, gap: 4, variant: true });
    K.scatter(g, O, ['rock_small', 'stump', 'rock'], 12, [1, 1, 58, 50], ',"', 'v1rk', { keep, gap: 4, variant: true });
    K.scatter(g, O, 'firefly', 8, [1, 1, 58, 50], ',"', 'v1ff2', { keep, gap: 6 });

    // ---------------------------------------------------------------- 人（救い出した人は野営地で待つ。STORY_BIBLE §7.1 の 1）
    const N = [
      K.npc('ben', 'npc_ben', 48, 24, { name: 'ベン', dir: 'w', talk: 'verda_ben', cond: '!forest_found_ben', pushable: false, reward: 'side' }),
      K.npc('camp_hans', 'npc_hans', 28, 30, { name: 'ハンス', dir: 'e', talk: 'verda_camp_talk', cond: ['forest_found_hans', '!forest_finale_done'], reward: 'news' }),
      K.npc('camp_ben', 'npc_ben', 29, 32, { name: 'ベン', dir: 'n', talk: 'verda_camp_talk', cond: ['forest_found_ben', '!forest_finale_done'], reward: 'news' }),
      K.npc('camp_roy', 'npc_roy', 34, 31, { name: 'ロイ', dir: 'w', talk: 'verda_camp_talk', cond: ['forest_found_roy', '!forest_finale_done'], reward: 'news' }),
      K.npc('camp_pim', 'npc_pim', 32, 29, { name: 'ピム', dir: 's', talk: 'verda_camp_talk', cond: ['forest_found_pim', '!forest_pim_guest', '!forest_finale_done'], reward: 'news' }),
      K.npc('fawn_after', 'ani_fawn', 47, 41, { name: '花角の小鹿', dir: 'w', talk: 'verda_fawn_after', cond: ['cleared_r_forest', { choice: 'ch_forest_fawn', is: 'heal' }], reward: 'hint' }),
    ];

    K.def('verda_1', {
      name: '迷いの森', kind: 'dungeon', region: 'r_forest', location: 'verda', theme: 'forest_dungeon',
      legend: K.FOREST_LEGEND({ S: { mat: 'forest_dark', solid: true, secret: true, floor: 'grass' } }),
      rows: g, outside: 'forest_dark',
      objects: O, npcs: N,
      spawns: {
        south: { x: 29, y: 48, dir: 'n' },
        north: { x: 29, y: 2, dir: 's' },
        camp: { x: 30, y: 33, dir: 'n' },
        g4: { x: 45, y: 44, dir: 'e' },
        g5: { x: 16, y: 45, dir: 'w' },
      },
      exits: [
        { x: 28, y: 51, w: 4, h: 1, to: { map: 'fern', spawn: 'gate_n' } },
        { x: 28, y: 0, w: 4, h: 1, to: { map: 'verda_2', spawn: 'south' } },
        // 森が道を変える（歌の石 3 つまで）
        { x: 40, y: 28, w: 1, h: 2, to: { map: 'verda_1', spawn: 'g4' }, cond: UNSTABLE },
        { x: 11, y: 20, w: 2, h: 1, to: { map: 'verda_1', spawn: 'g5' }, cond: UNSTABLE },
      ],
      triggers: [
        { id: 'arrive', on: 'enter', event: 'verda_arrive', once: true },
        { id: 'mist_e', x: 39, y: 28, w: 1, h: 2, on: 'step', event: 'verda_mist', cond: UNSTABLE, once: true },
        { id: 'mist_n', x: 11, y: 21, w: 2, h: 1, on: 'step', event: 'verda_mist', cond: UNSTABLE, once: true },
        { id: 'wolves', x: 44, y: 22, w: 9, h: 7, on: 'step', event: 'verda_ben', cond: '!forest_found_ben' },
      ],
      oneway: [{ x: 18, y: 12, dir: 'w' }, { x: 18, y: 13, dir: 'w' }],
      zones: [{ rect: null, zone: 'z_verda' }],
      light: { ambient: '#4c5890', k: 0.5, mood: 'forest_night' },
      dark: false,
      bgm: 'forest', bbg: 'forest',
      meta: { chestsInfo: true, floor: '1 階', sub: '蛍だまりの森' },
    });
  });
})(window.RPG);
