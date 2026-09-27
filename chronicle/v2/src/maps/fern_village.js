// CONTENT-F: 森の村フェルン（fern）千年の大木に住む村。V2_PLAN §3.2・WORLD_REDESIGN §5.4・STORY_BIBLE §7.1・§8.2
//   町 60×56。村ぜんたいを 1 枚に描いた下絵（art、design/ENV_ASSETS.md §7）。家は並ばず、道は曲がりくねる。
//   村のまん中の西に「大うろの木」: 一本の巨木の根もとの三つのこぶに、宿「木漏れ日亭」・道具屋・捜索隊の詰所がそれぞれの戸口を持つ。
//   ほかの家は、種の莢（さや）・ひょうたん・どんぐりの形の家、大きなきのこの笠の家、切り株の家（きこり頭ゴード）、花のつぼみの家（リタ）。
//   光るきのこと蛍の籠が灯り。
//   地面の層（lv 0）と樹上の層（lv 1）: 北西の大木と北の大木の幹の南に張り出した足場（'='）を、つり橋が北の道の上でつなぐ。南西の大木にも足場。
//   足場の南の縁は根と柱の面（'R'、1 マス）で、はしご（':'）はその面に掛かる。地面の人は足場の下に入らない（絵が読みやすい）。
//   門は南（森の道 → ワールド）と北（迷いの森へ）で、どちらも大きな根のアーチをくぐる。小川が村をうねって横切る（橋 3 つ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 60, H = 56;
    const g = K.grid(W, H, '.');
    /** 曲がる道: 点をつなぐ線（斜めは段々に 4 方向でつながる）を幅 wd で塗る */
    const wind = (pts, ch, wd, only) => {
      for (let i = 0; i < pts.length - 1; i++) {
        let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
        const dx = Math.abs(x2 - x), dy = Math.abs(y2 - y), sx = Math.sign(x2 - x), sy = Math.sign(y2 - y);
        let err = dx - dy;
        K.rect(g, x, y, wd, wd, ch, only);
        while (x !== x2 || y !== y2) {
          const e2 = 2 * err;
          if (e2 > -dy && x !== x2) { err -= dy; x += sx; } else { err += dx; y += sy; }
          K.rect(g, x, y, wd, wd, ch, only);
        }
      }
    };

    // ---------------------------------------------------------------- 地面
    K.border(g, 'F', 2);
    for (const [x, y, rx, ry] of [[3, 3, 2, 2], [22, 2, 3, 1], [47, 2, 2, 1], [57, 12, 1, 3], [57, 24, 2, 4], [57, 38, 2, 3], [2, 26, 1, 2],
      [3, 53, 3, 2], [14, 53, 4, 1], [42, 53, 5, 1], [55, 52, 3, 2], [57, 46, 1, 2]]) K.blob(g, x, y, rx, ry, 'F', 'fb' + x + y);
    K.blob(g, 17, 47, 5, 3, ',', 'fg1', '.');
    K.blob(g, 44, 33, 5, 3, ',', 'fg2', '.');
    K.blob(g, 12, 19, 4, 2, ',', 'fg3', '.');
    K.blob(g, 38, 46, 5, 3, ',', 'fg4', '.');
    K.blob(g, 52, 28, 3, 3, ',', 'fg5', '.');
    // 小川（うねる）と橋 3 つ
    wind([[2, 23], [9, 22], [16, 21], [23, 21], [30, 21], [36, 20], [42, 21], [48, 20], [57, 19]], '~', 2);
    K.rect(g, 24, 20, 2, 4, 'k');                          // 北の道の橋
    K.rect(g, 9, 21, 2, 4, 'k');                           // 西の橋
    K.rect(g, 47, 19, 2, 4, 'k');                          // 東の橋
    // 大木（幹と根。固い）
    K.blob(g, 11, 6, 8, 5, 'R', 'ft1'); K.rect(g, 5, 9, 14, 2, 'R');           // 北西 T1
    K.blob(g, 40, 6, 6, 5, 'R', 'ft2'); K.rect(g, 34, 9, 13, 2, 'R');          // 北 T2
    K.blob(g, 53, 3, 5, 3, 'R', 'ft4');                                          // 北東の隅のいちばん高い木（リタの家はその根もと）
    K.blob(g, 6, 39, 5, 3, 'R', 'ft3'); K.rect(g, 2, 40, 9, 3, 'R');           // 南西 T3
    // 大うろの木（宿・道具屋・詰所）: 幹と三つのこぶ
    K.blob(g, 15, 28, 7, 4, 'R', 'fgt'); K.rect(g, 5, 29, 6, 5, 'R'); K.rect(g, 11, 31, 7, 5, 'R'); K.rect(g, 18, 28, 6, 5, 'R');
    // 足場（lv 1）: 幹の南に張り出す。南の縁は根と柱の面（R）、はしごはその面に掛かる（2 マス幅）
    K.rect(g, 4, 11, 1, 4, 'R'); K.rect(g, 5, 11, 14, 3, '='); K.rect(g, 4, 14, 15, 1, 'R'); K.rect(g, 8, 14, 2, 1, ':');       // T1 の足場
    K.rect(g, 34, 11, 13, 3, '='); K.rect(g, 47, 11, 1, 4, 'R'); K.rect(g, 34, 14, 14, 1, 'R'); K.rect(g, 41, 14, 2, 1, ':');   // T2 の足場
    K.rect(g, 19, 12, 15, 2, '=');                          // つり橋（北の道の上をまたぐ）
    K.rect(g, 19, 10, 5, 2, 'T'); K.rect(g, 26, 10, 8, 2, 'T'); K.rect(g, 19, 14, 5, 2, 'T'); K.rect(g, 26, 14, 8, 2, 'T');     // 橋の下の木立
    K.rect(g, 2, 43, 8, 2, '='); K.rect(g, 10, 43, 1, 3, 'R'); K.rect(g, 2, 45, 8, 1, 'R'); K.rect(g, 6, 45, 2, 1, ':');         // T3 の足場
    // 門の根のアーチ（北と南。道の 4 マスだけ開く）
    K.rect(g, 25, 2, 3, 4, 'R'); K.rect(g, 32, 2, 3, 6, 'R');
    K.rect(g, 24, 47, 4, 7, 'R'); K.rect(g, 32, 47, 4, 7, 'R');
    // 広場（歌の碑のまわりの丸い石の輪）
    K.blob(g, 34, 30, 5, 4, 'e', 'fplz');
    K.blob(g, 34, 30, 4, 3, 'c', 'fplz2');
    K.rect(g, 33, 29, 3, 3, '*');
    // 道（曲がりくねる。幅 2）
    const P = (pts) => wind(pts, 'r', 2, '.,e');
    K.rect(g, 28, 0, 4, 3, 'r'); K.rect(g, 28, 53, 4, 3, 'r');
    P([[29, 0], [29, 4], [27, 7], [25, 9], [24, 12], [24, 17], [24, 24], [26, 26], [29, 28]]);           // 北の門 → 橋 → 広場
    P([[33, 34], [35, 37], [34, 41], [31, 44], [29, 47], [29, 55]]);                                       // 広場 → 南の門
    P([[23, 16], [16, 16], [11, 15], [8, 15], [5, 16], [4, 18]]);                                          // 北の道 → T1 のはしご → 莢の家
    P([[9, 16], [9, 20]]); P([[9, 25], [6, 26], [3, 29], [3, 34], [6, 35], [9, 36], [12, 37], [16, 37], [19, 34], [23, 34], [29, 33]]);   // 西の橋 → 大うろの木の三つの戸口 → 広場
    P([[26, 17], [31, 18], [37, 17], [42, 16], [46, 17], [50, 18], [53, 18]]);                                       // 小川の北の道（T2 のはしご・ゴード）
    P([[53, 10], [49, 11], [48, 14], [48, 17]]);                                                            // リタの家 → 小川の北の道
    P([[47, 23], [48, 26], [46, 29], [39, 30]]);                                                            // 東の橋 → きのこの家 → 広場
    P([[35, 38], [39, 41], [44, 44], [48, 46]]);                                                            // 南の道 → きのこの家 → 伐り跡の原
    P([[31, 44], [26, 45], [21, 44], [16, 44], [11, 46], [7, 46]]);                                        // 南の道 → ピム・物置 → T3 のはしご
    P([[22, 41], [22, 43]]);
    // 薬草園（南西、丸く）と伐り跡の原（南東）
    K.blob(g, 7, 50, 4, 2, '*', 'fherb'); K.blob(g, 7, 50, 3, 1, 'h', 'fherb2');
    K.blob(g, 49, 47, 5, 3, 'e', 'fcut', '.,');
    // 小さな木立
    K.blob(g, 17, 24, 2, 1, 'T', 'fgr1', '.,');
    K.blob(g, 31, 24, 2, 1, 'T', 'fgr2', '.,');
    K.blob(g, 55, 33, 2, 2, 'T', 'fgr3', '.,');
    K.blob(g, 39, 50, 2, 1, 'T', 'fgr4', '.,');
    K.blob(g, 19, 50, 2, 1, 'T', 'fgr5', '.,');
    K.blob(g, 27, 39, 2, 2, 'T', 'fgr6', '.,');
    K.blob(g, 48, 38, 2, 1, 'T', 'fgr7', '.,');
    K.rect(g, 41, 32, 7, 4, 'T'); K.rect(g, 50, 27, 3, 3, 'T');   // 描いた茂み

    // ---------------------------------------------------------------- 建物（戸口は敷地のいちばん下の行の 1 マス。前のマスへ出る）
    const O = [];
    const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'moss', mat: 'bark', windows: 2 }, o || {});
    const D = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    // 大うろの木の三つのこぶ（それぞれの戸口と看板）
    O.push(B('fern_u_inn', 11, 32, 6, 4, { door: D(15, 35, 'fern_inn'), sign: 'inn', lamp: true, windows: 2 }));
    O.push(B('fern_u_shop', 19, 30, 4, 4, { door: D(22, 33, 'fern_shop'), sign: 'item', lamp: true, windows: 1 }));
    O.push(B('fern_u_search', 6, 30, 4, 4, { door: D(8, 33, 'fern_search'), sign: 'guild', lamp: true, windows: 1 }));
    // 切り株の家（きこり頭ゴード）
    O.push(B('fern_u_gord', 50, 12, 6, 5, { door: D(53, 16, 'fern_gord'), lamp: true, roof: 'thatch', mat: 'log' }));
    // いちばん高い木の根もとの花のつぼみの家（リタの歌の家）
    O.push(B('fern_u_rita', 51, 7, 5, 4, { door: D(53, 10, 'fern_rita'), lamp: true }));
    // ひょうたんの家（ピム）
    O.push(B('fern_u_pim', 14, 40, 5, 4, { door: D(16, 43, 'fern_pim_home'), roof: 'thatch', mat: 'plaster' }));
    // 家の中（fern_home1〜3・fern_shed）は homes_slice.js
    O.push(B('fern_u_house1', 39, 37, 5, 4, { door: D(40, 40, 'fern_home1'), roof: 'shingle', mat: 'plaster' }));   // きのこの家（紫）
    O.push(B('fern_u_house2', 2, 16, 4, 4, { wall: 1, door: D(4, 19, 'fern_home2'), windows: 1, small: true }));     // どんぐりの家
    O.push(B('fern_u_house3', 44, 24, 5, 4, { door: D(45, 27, 'fern_home3'), roof: 'slate', mat: 'plaster' }));    // きのこの家（青緑）
    O.push(B('fern_u_shed', 20, 38, 4, 3, { wall: 1, windows: 0, small: true, door: D(22, 40, 'fern_shed') }));   // どんぐりの物置

    // 足場の下（lv 0）: つり橋の、北の道の両脇のマスは地面の人が入らない（絵の根。下絵に描く物 = painted）
    for (const [x, y] of [[23, 12], [23, 13], [26, 12], [26, 13]]) O.push(K.prop('roots', x, y));
    // 足場の灯り（蛍の籠）
    for (const [x, y] of [[5, 11], [18, 11], [12, 13], [34, 11], [46, 11], [38, 13], [2, 43], [9, 44]]) O.push(K.prop('lantern', x, y, { lv: 1 }));
    // 町の宝箱 2（見える所だけ。1 つは北西の足場の上）
    O.push(K.chest('fern_c1', 6, 12, { lv: 1, pool: 'p_T' }), K.chest('fern_c2', 54, 31, { item: 'i_revive', n: 1 }));

    // 広場: 掲示板・行商・ベンチ・蛍の籠
    O.push(K.prop('board', 31, 26), K.exam(32, 26, 'fern_board'));
    O.push(K.prop('stall', 37, 27));
    O.push(K.prop('bench', 30, 32), K.prop('bench', 38, 32), K.prop('well', 31, 34));
    O.push(K.prop('songstone', 34, 30, { variant: 0 }), K.exam(35, 30, 'fern_monument'));            // 千年樹の歌の碑
    O.push(K.prop('lantern', 32, 29), K.prop('lantern', 36, 31), K.prop('bench', 34, 35), K.prop('crate', 38, 26));   // 木箱は屋台の裏だけ
    O.push(K.sign(32, 36, '森の村フェルン\n――歌は森の道しるべ'));
    O.push(K.sign(23, 46, '↑ フェルン　↓ 森の道'));
    O.push(K.sign(31, 6, '↑ 迷いの森\n（捜索隊の許しなく入るべからず）'));
    // 蛍の籠（灯り）: 門・道・橋・広場のまわり
    for (const [x, y] of [[28, 7], [31, 5], [23, 9], [26, 16], [22, 19], [26, 25], [29, 26], [39, 33], [30, 35], [36, 38], [33, 42], [28, 44],
      [37, 46], [23, 48], [8, 20], [11, 24], [46, 19], [49, 23], [2, 36], [11, 39], [18, 36], [24, 36], [13, 45], [20, 42], [43, 42], [50, 10], [55, 17], [45, 30]]) O.push(K.prop('lantern', x, y));
    // 光るきのこ（灯り）
    for (const [x, y] of [[19, 25], [27, 29], [14, 38], [7, 36], [45, 45], [4, 47], [42, 18], [15, 18], [20, 17], [52, 26], [36, 51], [23, 47],
      [2, 30], [24, 30], [40, 34], [54, 45], [30, 9], [21, 8], [4, 9], [49, 9], [35, 45], [11, 25]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    // 薬草園（石の縁は下絵）のまわり
    O.push(K.prop('planter', 13, 48), K.prop('flower_pot', 13, 52), K.prop('sack', 3, 47));
    // 伐り跡の原: 切り株（痛みを書いたあと、苗が植わる）
    for (const [x, y] of [[52, 46], [45, 49], [51, 49], [47, 51]]) O.push(K.prop('stump', x, y, { variant: (x + y) % 4 }));
    for (const [x, y] of [[47, 47], [50, 48], [46, 50], [52, 50], [49, 51]]) O.push(K.prop('bush', x, y, { cond: { choice: 'ch_forest_write', is: 'pain' }, variant: 1 }));
    O.push(K.exam(50, 47, 'fern_cutover'));
    // 家まわりの小物: 壁・根・生け垣にぴったり寄せた数個だけ。道・広場・橋・戸口の前・門には置かない
    //   （持ち主 2026-09-27「移動障害になるような小物は極力置かないで…ストレス過ぎる」。町の小物は当たらないが、見た目も道を空ける）
    O.push(K.prop('log', 56, 15), K.prop('crate', 24, 31), K.prop('barrel', 44, 23), K.prop('crate', 44, 40), K.prop('log', 45, 36));
    O.push(K.prop('flower_pot', 56, 9), K.prop('flower_pot', 31, 7), K.prop('flower_pot', 11, 42), K.prop('planter', 13, 43), K.prop('sack', 19, 40));
    O.push(K.prop('rock', 43, 51), K.prop('tent', 55, 23));
    // 蛍と、地面の小さな飾り
    for (const [x, y] of [[14, 19], [40, 19], [27, 31], [21, 37], [48, 33], [48, 42], [8, 47], [37, 49], [22, 50], [53, 23], [17, 13], [46, 7], [3, 21], [54, 27]]) O.push(K.prop('firefly', x, y));
    for (const [x, y] of [[33, 24], [41, 23], [11, 40], [18, 49], [55, 36], [29, 24]]) O.push(K.prop('rock_small', x, y, { variant: (x + y) % 4 }));

    // ---------------------------------------------------------------- 人
    const L = K.L;
    const N = [
      // 広場
      K.npc('hanna', 'npc_hanna', 31, 31, { name: 'ハンナ', title: '村の年寄り', dir: 's', talk: 'fern_hanna', reward: 'item', bark: 'v_hanna_greet_01' }),
      K.npc('search_lead', 'npc_guard_2', 35, 27, { name: '捜索隊の男', dir: 's', talk: 'fern_search_lead', reward: 'lead', cond: '!cleared_r_forest' }),
      K.npc('search_a', 'npc_woodcutter_2', 37, 31, { name: '捜索隊の男', dir: 'w', talk: [L('森が道を変えちまうんだ。\n三歩で元の場所さ。\nどうやって探せってんだ。'), L({ var: 'forest_verses', gte: 1 }, '歌の石？　ああ、ばあさまたちの\n昔話だと思ってたよ。\n……本当にあったのか。')], cond: '!cleared_r_forest', reward: 'hint' }),
      K.npc('peddler', 'npc_merchant_2', 37, 28, { name: '行商人', title: '広場の行商', dir: 's', talk: 'fern_peddler', reward: null, pushable: false }),
      K.npc('herbalist', 'npc_old_f_1', 6, 50, { name: '薬草園のばあさま', dir: 'e', talk: 'fern_herbalist', reward: 'side' }),
      K.npc('postmaster', 'npc_woman_3', 27, 36, { name: 'ニナ', title: '村の手紙番', dir: 's', talk: 'fern_postmaster', reward: 'side' }),
      K.npc('lampkeeper', 'npc_old_m_2', 27, 19, { name: '灯籠番のじいさま', dir: 'w', talk: 'fern_lampkeeper', reward: 'side' }),
      K.npc('hunter', 'npc_woodcutter_3', 42, 31, { name: '狩人のオルト', dir: 'w', talk: 'fern_hunter', reward: 'boss' }),
      K.npc('kid', 'npc_child_2', 38, 36, { name: '村の子', dir: 'n', talk: 'fern_kid', reward: 'hint' }),
      K.npc('traveler', 'npc_merchant_1', 26, 32, { name: '旅の商人', dir: 'w', talk: 'fern_traveler', reward: 'lead' }),
      K.npc('acorn_boy', 'npc_child_1', 41, 44, { name: '木の実拾いの子', dir: 'w', talk: 'fern_acorn_boy', reward: 'side' }),
      K.npc('elder_m', 'npc_old_m_1', 44, 47, { name: '年寄りのきこり', dir: 'e', talk: 'fern_old_woodcutter', reward: 'news' }),
      K.npc('yura_miller', 'npc_yura_folk_2', 30, 29, { name: 'エダ', title: '粉ひき', dir: 'e', talk: 'fern_yura_miller', reward: 'item', cond: 'yura_miller_home' }),
      K.npc('pim_after', 'npc_pim', 33, 33, { name: 'ピム', dir: 's', talk: 'fern_pim_after', reward: 'side', cond: 'cleared_r_forest', bark: 'v_pim_greet_01' }),
      // 樹上（lv 1）: 手紙配りの 5 軒の住人（幹の莢の家の前の足場に立つ）
      K.npc('deck_1', 'npc_woman_1', 10, 12, { name: '樹上の家の女', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_2', 'npc_old_m_3', 15, 11, { name: '樹上の家の老人', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_3', 'npc_man_2', 44, 12, { name: '樹上の家の男', dir: 'w', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_4', 'npc_woman_2', 37, 11, { name: '樹上の家の娘', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_5', 'npc_man_3', 4, 43, { name: '樹上の家の若者', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      // 空気だけ（4 人まで）
      K.npc('dog', 'ani_dog', 32, 45, { name: '犬', dir: 'w', move: 'wander', talk: [L('ワン！　ワンワン！')], reward: null }),
      K.npc('hen', 'ani_hen', 9, 50, { name: 'にわとり', dir: 's', move: 'wander', talk: [L('コッコッ。')], reward: null }),
      K.npc('singer', 'npc_bard_1', 34, 20, { name: '吟遊詩人', dir: 's', talk: [L('千年樹の歌？\n……おれも探しているんだ。\n吟遊詩人の名折れだよ。'), L('cleared_r_forest', 'リタの歌を聞いたかい？\nあれこそ、この森の歌さ。\n吟遊詩人も、かなわないよ。')], reward: null }),
    ];

    // 人の立つマスと、その前後左右には飾りを置かない（話しかけられるように）
    const near = new Set();
    for (const n of N) for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) near.add((n.x + dx) + ',' + (n.y + dy) + ',' + (n.lv || 0));
    for (let i = O.length - 1; i >= 0; i--) { const o = O[i]; if (o.type === 'prop' && o.id !== 'roots' && near.has(o.x + ',' + o.y + ',' + (o.lv || 0))) O.splice(i, 1); }

    K.def('fern', {
      name: '森の村フェルン', kind: 'town', region: 'r_forest', location: 'fern', theme: 'treetop',
      legend: K.FOREST_LEGEND({
        '=': { mat: 'deck', deck: true },
        ':': { mat: 'ladder', ladder: true },
        k: { mat: 'bridge' },
        c: { mat: 'cobble' },
        h: { mat: 'dirt', name: 'herb_bed' },
        Y: { mat: 'moss_earth' },
      }),
      rows: g, outside: 'forest_dark',
      objects: O, npcs: N,
      spawns: {
        gate_s: { x: 29, y: 52, dir: 'n' },
        gate_n: { x: 29, y: 3, dir: 's' },
        plaza: { x: 33, y: 35, dir: 'n' },
        inn: { x: 15, y: 36, dir: 's' },
        shop: { x: 22, y: 34, dir: 's' },
        gord: { x: 53, y: 17, dir: 's' },
        search: { x: 8, y: 34, dir: 's' },
        rita: { x: 53, y: 11, dir: 's' },
        pim_home: { x: 16, y: 44, dir: 's' },
        house1: { x: 40, y: 41, dir: 's' },
        house2_door: { x: 4, y: 20, dir: 's' }, house3_door: { x: 45, y: 28, dir: 's' }, shed_door: { x: 22, y: 41, dir: 's' },
        deck: { x: 12, y: 12, dir: 'e', lv: 1 },
        east: { x: 46, y: 45, dir: 'e' },
      },
      exits: [
        { x: 28, y: 55, w: 4, h: 1, to: { map: 'world', spawn: 'fern' } },
        { x: 28, y: 0, w: 4, h: 1, to: { map: 'verda_1', spawn: 'south' } },
      ],
      triggers: [
        { id: 'arrival', on: 'enter', event: 'fern_arrival' },
      ],
      zones: [],
      light: { ambient: '#5662a2', k: 0.46, poolK: 1.6, spillR: 1.6, mood: 'forest_night' },
      dark: false,
      bgm: 'village',
      meta: { sub: '樹上の村', underDeck: 'moss_earth', chestsInfo: false },
      // 村ぜんたいを 1 枚に描いた下絵（v2/assets/env/treetop/under/fern*、design/ENV_ASSETS.md §7）。地面・大木・家・足場・つり橋・はしご・根のアーチはこの絵、
      // つり橋と根のアーチと木の葉の張り出しは overlay（地面の人より上）、窓と光るきのこ・こけは emit。当たり・戸口・人・灯り・ほかの物は上のデータのまま。
      // 絵が無ければマスから焼く。roots（橋の下の当たり）は絵に描いてあるので物としては描かない。@40 は無い（2048 の atlas に入らない。@32 を拡大）
      art: { image: 'treetop/under/fern', overlay: 'treetop/under/fern_over', emit: 'treetop/under/fern_emit', painted: ['roots'] },
    });
  });
})(window.RPG);
