// CONTENT-F: 森の村フェルン（fern）千年の大木に住む村。V2_PLAN §3.2・WORLD_REDESIGN §5.4・STORY_BIBLE §7.1・§8.2
//   町 60×56。村ぜんたいを 1 枚に描いた下絵（art、design/ENV_ASSETS.md §7）。家は四角い小屋ではなく、大木の幹のうろ・根の間に
//   つくった丸い種の莢（さや）やひょうたんの形の家、大きなきのこの笠の家、切り株の家。光るきのこと蛍の籠が灯り。
//   地面の層（lv 0）と樹上の層（lv 1）: 大木の幹の南に張り出した足場（'='）を、はしご（':'）で上り下りする。
//   足場の南の縁は根と柱の面（'R'、1 マス）なので、地面の人は足場の下に入らない（絵が読みやすい）。
//   北西の大木と北東の大木の足場を、大通りの上をまたぐつり橋（2 マス）が結ぶ。橋の下は大通りだけくぐれる（両脇は小さな木立）。
//   門は南（森の道 → ワールド）と北（小川沿いの細道 → 迷いの森）で、どちらも大きな根のアーチをくぐる。小川が村を東西に横切る。
//   北: 種の莢の家（house2）・北西の大木と足場・切り株の家（ゴード）・ひょうたんの詰所（捜索隊）・北東の大木と足場・いちばん高い木の根の莢（リタ）
//   南: うろの大木の宿「木漏れ日亭」・きのこの道具屋・広場（歌の碑・掲示板・行商・ハンナ）・西の大木と足場・ひょうたんの家（ピム）・
//       どんぐりの物置・きのこの家 2 軒・薬草園・伐り跡の原（南東）
//   灯りの形は「蛍の籠と光るこけ・光るきのこ」（WORLD §5.1）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 60, H = 56;
    const g = K.grid(W, H, '.');

    // ---------------------------------------------------------------- 地面
    K.border(g, 'F', 2);
    for (const [x, y, rx, ry] of [[3, 20, 1, 2], [57, 28, 2, 3], [3, 53, 3, 2], [56, 53, 3, 2], [18, 53, 3, 1], [42, 53, 3, 1]]) K.blob(g, x, y, rx, ry, 'F', 'fb' + x + y);
    K.blob(g, 14, 35, 5, 3, ',', 'fg1', '.');
    K.blob(g, 46, 38, 6, 4, ',', 'fg2', '.');
    K.blob(g, 16, 27, 4, 3, ',', 'fg3', '.');
    K.blob(g, 40, 49, 7, 3, ',', 'fg4', '.');
    // 小川（東西）と橋: 大通りの橋（4 マス）・西と東の小さな橋（2 マス）
    K.rect(g, 2, 20, 56, 2, '~');
    K.rect(g, 28, 19, 4, 4, 'k');
    K.rect(g, 8, 20, 2, 2, 'k');
    K.rect(g, 48, 20, 2, 2, 'k');
    // 大通り（南北）と門の口
    K.rect(g, 28, 0, 4, 3, 'r'); K.rect(g, 28, 53, 4, 3, 'r');
    K.path(g, [[29, 0], [29, 55]], 'r', 2);
    // 広場（歌の碑のまわりの石の輪）
    K.rect(g, 22, 26, 16, 9, 'e');
    K.rect(g, 24, 28, 12, 5, 'c');
    K.rect(g, 27, 29, 6, 3, '*');
    // 小道
    K.path(g, [[22, 30], [9, 30]], 'r', 2);                 // 広場 → 宿
    K.path(g, [[37, 30], [54, 30], [54, 44]], 'r', 2);      // 広場 → 道具屋 → 東の家の裏道
    K.path(g, [[50, 37], [54, 37]], 'r', 2);                // → きのこの家（house3）
    K.path(g, [[9, 44], [28, 44]], 'r', 2);                 // 南西の小道（ピム・物置・西の大木のはしご）
    K.path(g, [[9, 43], [9, 44]], 'r', 2);
    K.path(g, [[31, 44], [54, 44]], 'r', 2);                // 南東の小道（きのこの家・伐り跡の原）
    K.path(g, [[31, 8], [37, 8]], 'r', 2);                  // → 捜索隊の詰所
    K.path(g, [[21, 8], [28, 8]], 'r', 2);                  // → 切り株の家
    K.path(g, [[2, 17], [57, 17]], 'r', 2);                 // 小川の北の小道
    K.path(g, [[3, 7], [3, 16]], 'r', 2);                   // 種の莢の家 → 小川の北の小道
    K.path(g, [[54, 15], [54, 17]], 'r', 2);                // リタの家 → 小川の北の小道
    // 大木（幹と根。固い）: 北西 T1・北東 T2・北東の隅のいちばん高い木・西 T3
    K.rect(g, 7, 2, 12, 8, 'R'); K.rect(g, 7, 10, 13, 2, 'R');   // T1 の幹と根の張り出し
    K.rect(g, 43, 2, 8, 8, 'R'); K.rect(g, 38, 10, 14, 2, 'R');   // T2 の幹と根の張り出し
    K.rect(g, 52, 2, 6, 9, 'R');                            // いちばん高い木（リタの家はその根もと）
    K.rect(g, 2, 33, 10, 7, 'R');                           // T3 の幹
    // 足場（lv 1）: 幹の南に張り出す。南の縁は根と柱の面（R、地面の人は下に入れない）、はしご（':'）はその面に掛かる
    K.rect(g, 6, 12, 1, 4, 'R'); K.rect(g, 7, 12, 13, 3, '='); K.rect(g, 6, 15, 14, 1, 'R'); K.rect(g, 9, 15, 2, 1, ':');      // T1 の足場（はしごは 2 マス幅）
    K.rect(g, 38, 12, 13, 3, '='); K.rect(g, 51, 12, 1, 4, 'R'); K.rect(g, 38, 15, 14, 1, 'R'); K.rect(g, 48, 15, 2, 1, ':');  // T2 の足場
    K.rect(g, 20, 13, 18, 2, '=');                          // つり橋（大通りの上をまたぐ）
    K.rect(g, 20, 11, 9, 2, 'T'); K.rect(g, 31, 11, 7, 2, 'T'); K.rect(g, 20, 15, 9, 2, 'T'); K.rect(g, 31, 15, 7, 2, 'T');   // 橋の下の木立
    K.rect(g, 2, 40, 9, 2, '='); K.rect(g, 11, 40, 1, 3, 'R'); K.rect(g, 2, 42, 9, 1, 'R'); K.put(g, 9, 42, ':');       // T3 の足場
    // 門の根のアーチ（北と南。大通りの 4 マスだけ開く）
    K.rect(g, 25, 2, 3, 4, 'R'); K.rect(g, 32, 2, 3, 4, 'R');
    K.rect(g, 24, 49, 4, 5, 'R'); K.rect(g, 32, 49, 4, 5, 'R');
    // 建物の裏の見えない隙間は森で埋める
    K.rect(g, 2, 2, 5, 1, 'F'); K.rect(g, 19, 2, 6, 1, 'F'); K.rect(g, 35, 2, 8, 1, 'F'); K.rect(g, 51, 2, 1, 8, 'R');
    // 小さな木立（空き地を区切る）
    K.rect(g, 2, 23, 2, 7, 'T');
    K.blob(g, 18, 22, 2, 1, 'T', 'fgr1', '.,');
    K.blob(g, 39, 22, 2, 1, 'T', 'fgr2', '.,');
    K.blob(g, 56, 40, 2, 3, 'T', 'fgr3', '.,');
    K.blob(g, 34, 49, 2, 1, 'T', 'fgr4', '.,');
    K.blob(g, 18, 50, 2, 2, 'T', 'fgr5', '.,');
    // 描いた森の縁に合わせる（南の森・東の森の張り出し）
    K.rect(g, 2, 52, 23, 2, 'F'); K.rect(g, 35, 53, 21, 1, 'F'); K.rect(g, 56, 26, 2, 27, 'T');
    // 薬草園（南西）と伐り跡の原（南東）
    K.rect(g, 3, 47, 10, 5, '*');
    K.rect(g, 4, 48, 8, 3, 'h');
    K.blob(g, 50, 48, 5, 3, 'e', 'fcut', '.,');

    // ---------------------------------------------------------------- 建物（下絵の家。当たりは敷地、戸口は敷地のいちばん下の行の 1 マス）
    const O = [];
    const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'moss', mat: 'bark', windows: 2 }, o || {});
    const D = (x, y, map, spawn) => ({ x, y, to: { map, spawn: spawn || 'door' } });
    // うろの大木の宿（幹のうろに住む。丸い戸・丸窓）
    O.push(B('fern_u_inn', 4, 23, 10, 7, { wall: 3, windows: 4, door: D(9, 29, 'fern_inn'), sign: 'inn', lamp: true, roof: 'moss', mat: 'bark' }));
    // 大きなきのこの笠の道具屋
    O.push(B('fern_u_shop', 41, 24, 7, 6, { wall: 2, windows: 2, door: D(44, 29, 'fern_shop'), sign: 'item', lamp: true, roof: 'thatch', mat: 'plaster' }));
    // 切り株の家（きこり頭ゴード）
    O.push(B('fern_u_gord', 19, 3, 6, 5, { door: D(22, 7, 'fern_gord'), lamp: true, roof: 'thatch', mat: 'log' }));
    // ひょうたんの詰所（捜索隊）
    O.push(B('fern_u_search', 35, 3, 7, 5, { door: D(38, 7, 'fern_search'), sign: 'guild', lamp: true, roof: 'thatch', mat: 'plaster' }));
    // いちばん高い木の根もとの種の莢（リタの歌の家）
    O.push(B('fern_u_rita', 52, 11, 6, 4, { door: D(55, 14, 'fern_rita'), lamp: true, roof: 'moss', mat: 'bark' }));
    // ひょうたんの家（ピム）
    O.push(B('fern_u_pim', 15, 40, 6, 4, { door: D(18, 43, 'fern_pim_home'), roof: 'thatch', mat: 'plaster' }));
    // 家の中（fern_home1〜3・fern_shed）は homes_slice.js
    O.push(B('fern_u_house1', 35, 40, 6, 4, { door: D(38, 43, 'fern_home1'), roof: 'shingle', mat: 'plaster' }));   // きのこの家
    O.push(B('fern_u_house2', 2, 3, 5, 4, { door: D(4, 6, 'fern_home2'), windows: 1, roof: 'thatch', mat: 'bark' }));   // どんぐりの莢の家
    O.push(B('fern_u_house3', 48, 32, 6, 5, { door: D(51, 36, 'fern_home3'), roof: 'slate', mat: 'plaster' }));     // きのこの家
    O.push(B('fern_u_shed', 22, 41, 4, 3, { wall: 1, windows: 0, small: true, door: D(23, 43, 'fern_shed'), roof: 'thatch', mat: 'bark' }));   // どんぐりの物置

    // 足場の下（lv 0）: つり橋の、大通りの両脇のマスは地面の人が入らない（絵の根。下絵に描く物 = painted）
    for (const [x, y] of [[28, 13], [28, 14], [31, 13], [31, 14]]) O.push(K.prop('roots', x, y));
    // 足場の灯り（蛍の籠）
    for (const [x, y] of [[7, 12], [19, 12], [14, 14], [38, 12], [50, 12], [44, 14], [2, 40], [10, 41]]) O.push(K.prop('lantern', x, y, { lv: 1 }));
    // 町の宝箱 2（見える所だけ。1 つは北西の足場の上）
    O.push(K.chest('fern_c1', 8, 13, { lv: 1, pool: 'p_T' }), K.chest('fern_c2', 53, 39, { item: 'i_revive', n: 1 }));

    // 広場: 掲示板・行商・ベンチ・蛍の籠
    O.push(K.prop('board', 24, 27), K.exam(25, 27, 'fern_board'));
    O.push(K.prop('stall', 34, 27), K.prop('crate', 36, 27), K.prop('sack', 36, 28));
    O.push(K.prop('bench', 23, 32), K.prop('bench', 36, 32), K.prop('well', 25, 33));
    O.push(K.prop('songstone', 29, 30, { variant: 0 }), K.exam(30, 30, 'fern_monument'));            // 千年樹の歌の碑
    O.push(K.prop('lantern', 27, 29), K.prop('lantern', 32, 31), K.prop('flower_pot', 23, 35), K.prop('planter', 34, 35), K.prop('bench', 26, 35), K.prop('crate', 38, 28));
    O.push(K.sign(31, 36, '森の村フェルン\n――歌は森の道しるべ'));
    O.push(K.sign(27, 47, '↑ フェルン　↓ 森の道'));
    O.push(K.sign(33, 6, '↑ 迷いの森\n（捜索隊の許しなく入るべからず）'));
    // 蛍の籠（灯り）: 門・大通り・広場・橋・小道
    for (const [x, y] of [[28, 6], [31, 6], [27, 10], [32, 10], [27, 18], [32, 18], [27, 23], [32, 23], [22, 26], [37, 26], [22, 34], [37, 34],
      [27, 40], [32, 46], [23, 47], [36, 47], [14, 29], [44, 32], [7, 19], [10, 22], [47, 19], [50, 22], [20, 9], [39, 9], [5, 8], [56, 16], [12, 43], [42, 46]]) O.push(K.prop('lantern', x, y));
    // 光るきのこ（灯り）
    for (const [x, y] of [[20, 29], [39, 29], [14, 39], [21, 39], [48, 43], [4, 44], [45, 19], [18, 19], [12, 16], [53, 27], [37, 51], [24, 46],
      [2, 31], [15, 24], [46, 36], [53, 47], [42, 8], [19, 9], [6, 10], [51, 16], [33, 41], [12, 37]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    // 薬草園の柵と植木
    for (let x = 3; x <= 13; x++) if (x !== 9 && x !== 10) O.push(K.prop('fence', x, 46));
    for (const [x, y] of [[13, 47], [13, 49], [13, 51]]) O.push(K.prop('fence', x, y));
    O.push(K.prop('planter', 13, 50), K.prop('flower_pot', 2, 47), K.prop('sack', 2, 49));
    // 伐り跡の原: 切り株（痛みを書いたあと、苗が植わる）
    for (const [x, y] of [[48, 46], [51, 46], [54, 47], [47, 49], [50, 50], [53, 50], [55, 49], [49, 52]]) O.push(K.prop('stump', x, y, { variant: (x + y) % 4 }));
    for (const [x, y] of [[49, 47], [52, 49], [48, 51], [54, 51], [51, 52]]) O.push(K.prop('bush', x, y, { cond: { choice: 'ch_forest_write', is: 'pain' }, variant: 1 }));
    O.push(K.exam(51, 48, 'fern_cutover'));
    // 家まわりの小物（固めて置き、通りの真ん中は空ける）
    O.push(K.prop('barrel', 14, 25), K.prop('barrel', 14, 26), K.prop('crate', 14, 27), K.prop('log', 25, 6), K.prop('log', 26, 6), K.prop('stump', 26, 7));
    O.push(K.prop('hay', 48, 28), K.prop('crate', 48, 26), K.prop('flower_pot', 40, 28), K.prop('sack', 34, 7), K.prop('barrel', 42, 5), K.prop('crate', 42, 6));
    O.push(K.prop('flower_pot', 52, 15), K.prop('flower_pot', 57, 15), K.prop('planter', 21, 42), K.prop('barrel', 34, 42), K.prop('crate', 42, 42));
    O.push(K.prop('log', 26, 42), K.prop('stump', 26, 41), K.prop('rock', 45, 52), K.prop('rock_small', 21, 48));
    O.push(K.prop('barrel', 6, 7), K.prop('crate', 6, 8), K.prop('sack', 27, 7), K.prop('flower_pot', 33, 7), K.prop('crate', 5, 22), K.prop('barrel', 40, 25));
    O.push(K.prop('hay', 47, 34), K.prop('crate', 52, 41), K.prop('barrel', 53, 41), K.prop('flower_pot', 14, 42), K.prop('sack', 21, 40), K.prop('log', 36, 39));
    O.push(K.prop('flower_pot', 14, 23), K.prop('planter', 4, 30), K.prop('rock_small', 17, 31), K.prop('rock_small', 44, 36), K.prop('stump', 16, 46), K.prop('rock_small', 22, 49));
    // 蛍と、地面の小さな飾り
    for (const [x, y] of [[16, 19], [42, 19], [17, 25], [19, 34], [40, 36], [47, 41], [6, 45], [37, 50], [23, 50], [55, 25], [14, 19], [42, 3], [3, 12], [57, 19]]) O.push(K.prop('firefly', x, y));
    for (const [x, y, id] of [[24, 23, 'rock_small'], [35, 23, 'flower_pot'], [45, 22, 'rock_small'], [12, 19, 'flower_pot'], [52, 19, 'stump'], [4, 43, 'rock_small'],
      [16, 48, 'stump'], [19, 37, 'flower_pot'], [43, 38, 'stump'], [47, 38, 'rock_small'], [33, 38, 'rock_small'], [20, 24, 'stump'], [37, 23, 'rock_small']]) O.push(K.prop(id, x, y, { variant: (x + y) % 4 }));

    // ---------------------------------------------------------------- 人
    const L = K.L;
    const N = [
      // 広場
      K.npc('hanna', 'npc_hanna', 26, 31, { name: 'ハンナ', title: '村の年寄り', dir: 's', talk: 'fern_hanna', reward: 'item', bark: 'v_hanna_greet_01' }),
      K.npc('search_lead', 'npc_guard_2', 31, 27, { name: '捜索隊の男', dir: 's', talk: 'fern_search_lead', reward: 'lead', cond: '!cleared_r_forest' }),
      K.npc('search_a', 'npc_woodcutter_2', 33, 31, { name: '捜索隊の男', dir: 'w', talk: [L('森が道を変えちまうんだ。\n三歩で元の場所さ。\nどうやって探せってんだ。'), L({ var: 'forest_verses', gte: 1 }, '歌の石？　ああ、ばあさまたちの\n昔話だと思ってたよ。\n……本当にあったのか。')], cond: '!cleared_r_forest', reward: 'hint' }),
      K.npc('peddler', 'npc_merchant_2', 34, 28, { name: '行商人', title: '広場の行商', dir: 's', talk: 'fern_peddler', reward: null, pushable: false }),
      K.npc('herbalist', 'npc_old_f_1', 7, 49, { name: '薬草園のばあさま', dir: 'e', talk: 'fern_herbalist', reward: 'side' }),
      K.npc('postmaster', 'npc_woman_3', 24, 37, { name: 'ニナ', title: '村の手紙番', dir: 's', talk: 'fern_postmaster', reward: 'side' }),
      K.npc('lampkeeper', 'npc_old_m_2', 33, 19, { name: '灯籠番のじいさま', dir: 'w', talk: 'fern_lampkeeper', reward: 'side' }),
      K.npc('hunter', 'npc_woodcutter_3', 45, 33, { name: '狩人のオルト', dir: 'w', talk: 'fern_hunter', reward: 'boss' }),
      K.npc('kid', 'npc_child_2', 34, 38, { name: '村の子', dir: 'n', talk: 'fern_kid', reward: 'hint' }),
      K.npc('traveler', 'npc_merchant_1', 15, 32, { name: '旅の商人', dir: 'n', talk: 'fern_traveler', reward: 'lead' }),
      K.npc('acorn_boy', 'npc_child_1', 38, 36, { name: '木の実拾いの子', dir: 'w', talk: 'fern_acorn_boy', reward: 'side' }),
      K.npc('elder_m', 'npc_old_m_1', 47, 47, { name: '年寄りのきこり', dir: 'e', talk: 'fern_old_woodcutter', reward: 'news' }),
      K.npc('yura_miller', 'npc_yura_folk_2', 23, 29, { name: 'エダ', title: '粉ひき', dir: 'e', talk: 'fern_yura_miller', reward: 'item', cond: 'yura_miller_home' }),
      K.npc('pim_after', 'npc_pim', 28, 33, { name: 'ピム', dir: 's', talk: 'fern_pim_after', reward: 'side', cond: 'cleared_r_forest', bark: 'v_pim_greet_01' }),
      // 樹上（lv 1）: 手紙配りの 5 軒の住人（幹の莢の家の前の足場に立つ）
      K.npc('deck_1', 'npc_woman_1', 11, 13, { name: '樹上の家の女', dir: 'e', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_2', 'npc_old_m_3', 16, 12, { name: '樹上の家の老人', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_3', 'npc_man_2', 46, 12, { name: '樹上の家の男', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_4', 'npc_woman_2', 41, 13, { name: '樹上の家の娘', dir: 'e', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_5', 'npc_man_3', 5, 40, { name: '樹上の家の若者', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      // 空気だけ（4 人まで）
      K.npc('dog', 'ani_dog', 30, 46, { name: '犬', dir: 'w', move: 'wander', talk: [L('ワン！　ワンワン！')], reward: null }),
      K.npc('hen', 'ani_hen', 10, 49, { name: 'にわとり', dir: 's', move: 'wander', talk: [L('コッコッ。')], reward: null }),
      K.npc('singer', 'npc_bard_1', 38, 19, { name: '吟遊詩人', dir: 's', talk: [L('千年樹の歌？\n……おれも探しているんだ。\n吟遊詩人の名折れだよ。'), L('cleared_r_forest', 'リタの歌を聞いたかい？\nあれこそ、この森の歌さ。\n吟遊詩人も、かなわないよ。')], reward: null }),
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
        plaza: { x: 29, y: 35, dir: 'n' },
        inn: { x: 9, y: 30, dir: 's' },
        shop: { x: 44, y: 30, dir: 's' },
        gord: { x: 22, y: 8, dir: 's' },
        search: { x: 38, y: 8, dir: 's' },
        rita: { x: 55, y: 15, dir: 's' },
        pim_home: { x: 18, y: 44, dir: 's' },
        house1: { x: 38, y: 44, dir: 's' },
        house2_door: { x: 4, y: 7, dir: 's' }, house3_door: { x: 51, y: 37, dir: 's' }, shed_door: { x: 23, y: 44, dir: 's' },
        deck: { x: 13, y: 13, dir: 'e', lv: 1 },
        east: { x: 46, y: 46, dir: 'e' },
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
      // 村ぜんたいを 1 枚に描いた下絵（v2/assets/env/treetop/under/fern*、design/ENV_ASSETS.md §7）。地面・大木・家・足場・つり橋・はしごはこの絵、
      // つり橋と根のアーチと木の葉の張り出しは overlay（地面の人より上）、窓と光るきのこは emit。当たり・戸口・人・灯り・ほかの物は上のデータのまま。
      // 絵が無ければマスから焼く。roots（橋の下の当たり）は絵に描いてあるので物としては描かない
      art: { image: 'treetop/under/fern', overlay: 'treetop/under/fern_over', emit: 'treetop/under/fern_emit', painted: ['roots'] },
    });
  });
})(window.RPG);
