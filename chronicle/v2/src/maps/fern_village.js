// CONTENT-F: 森の村フェルン（fern）樹上の村。V2_PLAN §3.2・WORLD_REDESIGN §5.4・STORY_BIBLE §7.1・§8.2
//   町 60×56。地面の層（lv 0）と樹上の層（lv 1）: 大木のまわりの足場とつり橋（'='、deck）を、はしご（':'）で行き来する。
//   門は南（森の道 → ワールド）と北（小川沿いの細道 → 迷いの森）。小川が村を東西に横切り、道の橋で渡る。
//   北: きこり頭ゴードの家・捜索隊の詰所・リタの歌の家（いちばん高い木のそば）・北西と北東の大木の足場とつり橋（手紙配りの 3 軒）
//   南: 宿「木漏れ日亭」・道具屋・広場（掲示板・行商・ハンナ）・ピムの家・薬草園・西の大木の足場（手紙配りの 2 軒）・伐り跡の原（東の外れ）
//   灯りの形は「蛍の籠と光るこけ」（WORLD §5.1）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 60, H = 56;
    const g = K.grid(W, H, '.');

    // ---------------------------------------------------------------- 地面
    K.border(g, 'F', 2);
    for (const [x, y, rx, ry] of [[4, 4, 3, 2], [55, 4, 3, 3], [3, 18, 2, 3], [57, 18, 2, 3], [3, 30, 2, 3], [57, 38, 2, 4], [4, 52, 3, 2], [55, 53, 3, 2], [20, 52, 3, 2], [40, 53, 3, 2]]) K.blob(g, x, y, rx, ry, 'F', 'fb' + x + y);
    K.blob(g, 14, 22, 12, 12, ',', 'fg1', '.');
    K.blob(g, 46, 30, 9, 9, ',', 'fg2', '.');
    K.blob(g, 30, 48, 10, 4, ',', 'fg3', '.');
    K.blob(g, 26, 8, 6, 4, ',', 'fg4', '.');
    // 小川（東西）と橋
    K.path(g, [[2, 21], [12, 21], [12, 22], [26, 22], [26, 21], [42, 21], [42, 22], [57, 22]], '~', 1);
    K.path(g, [[2, 22], [12, 22]], '_', 1, '.,');
    K.rect(g, 28, 20, 4, 4, 'k');                          // 道の橋
    K.rect(g, 9, 20, 2, 4, 'k');                           // 西の小さな橋
    // 道
    K.rect(g, 28, 0, 4, 3, 'r'); K.rect(g, 28, 53, 4, 3, 'r');
    K.path(g, [[29, 0], [29, 55]], 'r', 2);
    K.rect(g, 22, 26, 16, 9, 'e');                          // 広場
    K.rect(g, 24, 28, 12, 5, 'c');                          //   広場の石畳の輪
    K.rect(g, 27, 29, 6, 3, '*');                          //   真ん中の花壇（歌の碑）
    K.path(g, [[22, 30], [9, 30], [9, 29]], 'r', 2);       // 広場 → 宿
    K.path(g, [[37, 30], [44, 30], [44, 29]], 'r', 2);     // 広場 → 道具屋
    K.path(g, [[29, 38], [13, 38], [13, 45], [18, 45]], 'r', 1);   // → ピムの家
    K.path(g, [[31, 44], [40, 44]], 'r', 1);               // → 東の民家
    K.path(g, [[31, 16], [36, 16], [36, 8]], 'r', 1);      // → 捜索隊の詰所
    K.path(g, [[28, 9], [24, 9], [24, 7]], 'r', 1);        // → きこり頭の家
    K.path(g, [[37, 16], [52, 16], [52, 10]], 'r', 1);     // → リタの歌の家
    // 薬草園（南西）と伐り跡の原（南東）
    K.rect(g, 4, 46, 9, 5, '*');
    K.rect(g, 5, 47, 7, 3, 'h');
    K.blob(g, 51, 47, 5, 4, 'e', 'fcut', '.,');
    // 足場（lv 1）とはしご: 北西の大木 T1・北東の大木 T2・つり橋、西の大木 T3
    K.rect(g, 11, 9, 9, 7, '=');                            // T1 の足場
    K.rect(g, 38, 9, 9, 7, '=');                            // T2 の足場
    K.rect(g, 20, 12, 18, 2, '=');                          // つり橋（道の上を渡る）
    K.rect(g, 4, 32, 9, 7, '=');                            // T3 の足場
    K.put(g, 10, 12, ':'); K.put(g, 47, 12, ':'); K.put(g, 27, 14, ':'); K.put(g, 13, 35, ':');

    // ---------------------------------------------------------------- 建物
    const O = [];
    const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'thatch', mat: 'log', windows: 2 }, o || {});
    O.push(B('fern_b_inn', 5, 24, 9, 5, { door: { x: 9, y: 28, to: { map: 'fern_inn', spawn: 'door' } }, sign: 'inn', windows: 3, lamp: true, flowers: true, roof: 'moss', mat: 'log', chimney: true }));
    O.push(B('fern_b_shop', 41, 24, 7, 5, { door: { x: 44, y: 28, to: { map: 'fern_shop', spawn: 'door' } }, sign: 'item', lamp: true, awning: true, roof: 'thatch' }));
    O.push(B('fern_b_gord', 21, 3, 6, 4, { door: { x: 24, y: 6, to: { map: 'fern_gord', spawn: 'door' } }, roof: 'thatch', mat: 'log', lamp: true, chimney: true }));
    O.push(B('fern_b_search', 33, 3, 7, 5, { door: { x: 36, y: 7, to: { map: 'fern_search', spawn: 'door' } }, roof: 'moss', mat: 'plank', lamp: true, sign: 'guild' }));
    O.push(B('fern_b_rita', 49, 5, 6, 5, { door: { x: 52, y: 9, to: { map: 'fern_rita', spawn: 'door' } }, roof: 'moss', mat: 'bark', windows: 2, flowers: true, lamp: true }));
    O.push(B('fern_b_pim', 15, 41, 6, 4, { door: { x: 18, y: 44, to: { map: 'fern_pim_home', spawn: 'door' } }, roof: 'thatch', mat: 'log', flowers: true }));
    O.push(B('fern_b_house1', 37, 40, 6, 4, { door: { x: 40, y: 43 }, roof: 'thatch', mat: 'log', windows: 2, flowers: true }));
    O.push(B('fern_b_house2', 4, 4, 6, 4, { roof: 'moss', mat: 'bark', windows: 1 }));
    O.push(B('fern_b_house3', 47, 34, 6, 4, { roof: 'thatch', mat: 'log', windows: 2 }));
    O.push(B('fern_b_shed', 22, 44, 4, 3, { roof: 'thatch', mat: 'plank', windows: 0, small: true, chimney: false }));

    // 大木（幹）と足場の灯り
    // 大木（足場を支える幹。地面の層に立つ）
    O.push(K.prop('tree_giant', 15, 8), K.prop('tree_giant', 43, 8), K.prop('tree_giant', 3, 36), K.prop('tree_giant', 20, 16));
    O.push(K.prop('tree_giant', 56, 11));                   // いちばん高い木（リタの家の脇）
    for (const [x, y] of [[12, 10], [18, 14], [39, 10], [45, 14], [22, 12], [35, 13], [5, 33], [11, 38]]) O.push(K.prop('lantern', x, y, { lv: 1 }));
    // 町の宝箱 2（見える所だけ。1 つは北西の足場の上）
    O.push(K.chest('fern_c1', 18, 10, { lv: 1, pool: 'p_T' }), K.chest('fern_c2', 55, 30, { item: 'i_revive', n: 1 }));

    // 広場: 掲示板・行商・ベンチ・蛍の籠
    O.push(K.prop('board', 24, 27), K.exam(25, 27, 'fern_board'));
    O.push(K.prop('stall', 34, 27), K.prop('crate', 36, 27), K.prop('sack', 36, 28));
    O.push(K.prop('bench', 23, 32), K.prop('bench', 36, 32), K.prop('well', 25, 33));
    O.push(K.prop('songstone', 29, 30, { variant: 0 }), K.exam(30, 30, 'fern_monument'));            // 千年樹の歌の碑
    O.push(K.prop('lantern', 27, 29), K.prop('lantern', 32, 31), K.prop('flower_pot', 23, 35), K.prop('planter', 34, 35), K.prop('bench', 26, 35), K.prop('crate', 38, 28));
    O.push(K.sign(31, 36, '森の村フェルン\n――歌は森の道しるべ'));
    O.push(K.sign(27, 51, '↑ フェルン　↓ 森の道'));
    O.push(K.sign(31, 3, '↑ 迷いの森\n（捜索隊の許しなく入るべからず）'));
    // 蛍の籠（灯り）: 道と広場と橋
    for (const [x, y] of [[27, 1], [32, 1], [27, 5], [32, 10], [27, 17], [32, 19], [27, 24], [32, 24], [22, 26], [37, 26], [22, 34], [37, 34], [27, 40], [32, 46], [27, 52], [32, 52], [14, 30], [44, 31], [8, 20], [11, 24]]) O.push(K.prop('lantern', x, y));
    for (const [x, y] of [[20, 29], [39, 29], [14, 40], [21, 40], [49, 44], [7, 43], [50, 18], [18, 18], [44, 19], [6, 16], [53, 26], [36, 50], [24, 49]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    // 薬草園の柵と植木
    for (let x = 3; x <= 13; x++) if (x !== 8 && x !== 9) O.push(K.prop('fence', x, 45));
    for (const [x, y] of [[4, 51], [12, 51]]) O.push(K.prop('fence', x, y));
    O.push(K.prop('planter', 13, 47), K.prop('planter', 13, 49), K.prop('flower_pot', 3, 47), K.prop('sack', 3, 49));
    // 伐り跡の原: 切り株（痛みを書いたあと、苗が植わる）
    for (const [x, y] of [[48, 45], [51, 44], [54, 46], [47, 48], [50, 49], [53, 50], [55, 48], [49, 51]]) O.push(K.prop('stump', x, y, { variant: (x + y) % 4 }));
    for (const [x, y] of [[49, 46], [52, 48], [48, 50], [54, 49], [51, 51]]) O.push(K.prop('bush', x, y, { cond: { choice: 'ch_forest_write', is: 'pain' }, variant: 1 }));
    O.push(K.exam(51, 46, 'fern_cutover'));
    // 家まわりの小物（固めて置き、通りの真ん中は空ける）
    O.push(K.prop('barrel', 14, 26), K.prop('barrel', 14, 27), K.prop('crate', 4, 29), K.prop('log', 20, 7), K.prop('log', 20, 8), K.prop('stump', 27, 7));
    O.push(K.prop('hay', 48, 29), K.prop('crate', 48, 25), K.prop('flower_pot', 40, 28), K.prop('sack', 32, 7), K.prop('barrel', 40, 5), K.prop('crate', 40, 6));
    O.push(K.prop('flower_pot', 48, 9), K.prop('flower_pot', 55, 9), K.prop('planter', 21, 45), K.prop('barrel', 36, 43), K.prop('crate', 43, 42));
    O.push(K.prop('log', 23, 47), K.prop('stump', 26, 45), K.prop('rock', 45, 52), K.prop('rock_small', 12, 54), K.prop('tent', 45, 3));
    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('rkcY:'.includes(K.at(g, x, y))) keep.add(x + ',' + y);
    for (const o of O) if (o.type === 'building' && o.door) for (let dy = 0; dy <= 2; dy++) keep.add(o.door.x + ',' + (o.door.y + dy));
    // 家の角に小物を 2〜3 個ずつ（通りの真ん中は空ける。STYLE_REFERENCE §6.2）
    for (const [x, y, ids] of [
      [4, 23, ['barrel', 'crate']], [14, 24, ['flower_pot']], [40, 23, ['barrel', 'sack']], [48, 27, ['crate']], [20, 3, ['log', 'crate']], [27, 4, ['barrel']],
      [32, 5, ['barrel', 'crate']], [48, 6, ['flower_pot']], [14, 40, ['crate']], [21, 41, ['flower_pot']], [36, 40, ['sack']], [43, 40, ['barrel']],
      [46, 33, ['hay']], [53, 36, ['crate', 'barrel']], [22, 43, ['log']], [26, 44, ['sack']],
    ]) ids.forEach((id, i) => { const q = K.prop(id, x, y + i); if (!O.some((o) => o.x === q.x && o.y === q.y)) O.push(q); });
    // 村の中の木（樹上の村の森の感じ。道・戸口・足場の下は空ける）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ('=:'.includes(K.at(g, x, y))) keep.add(x + ',' + y);
    K.scatter(g, O, ['tree', 'pine', 'tree', 'bush'], 26, [3, 3, 54, 50], ',', 'ftree', { keep, gap: 4, variant: true });
    K.scatter(g, O, 'firefly', 14, [2, 2, 56, 52], ',.', 'fff', { keep, gap: 5 });
    K.scatter(g, O, ['mushroom_glow', 'flower_pot', 'rock_small'], 14, [2, 2, 56, 52], ',.', 'fdeco', { keep, gap: 4, variant: true });
    K.scatter(g, O, ['rock_small', 'flower_pot', 'stump'], 10, [2, 2, 56, 52], ',', 'frk', { keep, gap: 5, variant: true });

    // ---------------------------------------------------------------- 人
    const L = K.L;
    const N = [
      // 広場
      K.npc('hanna', 'npc_hanna', 26, 31, { name: 'ハンナ', title: '村の年寄り', dir: 's', talk: 'fern_hanna', reward: 'item' }),
      K.npc('search_lead', 'npc_guard_2', 31, 27, { name: '捜索隊の男', dir: 's', talk: 'fern_search_lead', reward: 'lead', cond: '!cleared_r_forest' }),
      K.npc('search_a', 'npc_woodcutter_2', 33, 31, { name: '捜索隊の男', dir: 'w', talk: [L('森が道を変えちまうんだ。\n三歩で元の場所さ。\nどうやって探せってんだ。'), L({ var: 'forest_verses', gte: 1 }, '歌の石？　ああ、ばあさまたちの\n昔話だと思ってたよ。\n……本当にあったのか。')], cond: '!cleared_r_forest', reward: 'hint' }),
      K.npc('peddler', 'npc_merchant_2', 34, 28, { name: '行商人', title: '広場の行商', dir: 's', talk: 'fern_peddler', reward: null, pushable: false }),
      K.npc('herbalist', 'npc_old_f_1', 8, 48, { name: '薬草園のばあさま', dir: 'e', talk: 'fern_herbalist', reward: 'side' }),
      K.npc('postmaster', 'npc_woman_3', 24, 37, { name: 'ニナ', title: '村の手紙番', dir: 's', talk: 'fern_postmaster', reward: 'side' }),
      K.npc('lampkeeper', 'npc_old_m_2', 32, 17, { name: '灯籠番のじいさま', dir: 'w', talk: 'fern_lampkeeper', reward: 'side' }),
      K.npc('hunter', 'npc_woodcutter_3', 45, 31, { name: '狩人のオルト', dir: 'w', talk: 'fern_hunter', reward: 'boss' }),
      K.npc('kid', 'npc_child_2', 33, 38, { name: '村の子', dir: 'n', talk: 'fern_kid', reward: 'hint' }),
      K.npc('traveler', 'npc_merchant_1', 12, 31, { name: '旅の商人', dir: 'e', talk: 'fern_traveler', reward: 'lead' }),
      K.npc('acorn_boy', 'npc_child_1', 38, 36, { name: '木の実拾いの子', dir: 'w', talk: 'fern_acorn_boy', reward: 'side' }),
      K.npc('elder_m', 'npc_old_m_1', 47, 47, { name: '年寄りのきこり', dir: 'e', talk: 'fern_old_woodcutter', reward: 'news' }),
      K.npc('yura_miller', 'npc_yura_folk_2', 23, 29, { name: 'エダ', title: '粉ひき', dir: 'e', talk: 'fern_yura_miller', reward: 'item', cond: 'yura_miller_home' }),
      K.npc('pim_after', 'npc_pim', 28, 33, { name: 'ピム', dir: 's', talk: 'fern_pim_after', reward: 'side', cond: 'cleared_r_forest' }),
      // 樹上（lv 1）: 手紙配りの 5 軒の住人
      K.npc('deck_1', 'npc_woman_1', 14, 11, { name: '樹上の家の女', dir: 'e', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_2', 'npc_old_m_3', 17, 13, { name: '樹上の家の老人', dir: 'w', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_3', 'npc_man_2', 43, 10, { name: '樹上の家の男', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_4', 'npc_woman_2', 40, 13, { name: '樹上の家の娘', dir: 'e', lv: 1, talk: 'fern_deck', reward: 'item' }),
      K.npc('deck_5', 'npc_man_3', 9, 33, { name: '樹上の家の若者', dir: 's', lv: 1, talk: 'fern_deck', reward: 'item' }),
      // 空気だけ（4 人まで）
      K.npc('dog', 'ani_dog', 30, 44, { name: '犬', dir: 'w', move: 'wander', talk: [L('ワン！　ワンワン！')], reward: null }),
      K.npc('hen', 'ani_hen', 11, 50, { name: 'にわとり', dir: 's', move: 'wander', talk: [L('コッコッ。')], reward: null }),
      K.npc('singer', 'npc_bard_1', 38, 17, { name: '吟遊詩人', dir: 's', talk: [L('千年樹の歌？\n……おれも探しているんだ。\n吟遊詩人の名折れだよ。'), L('cleared_r_forest', 'リタの歌を聞いたかい？\nあれこそ、この森の歌さ。\n吟遊詩人も、かなわないよ。')], reward: null }),
    ];

    // 人の立つマスと、その前後左右には散らした物を置かない（話しかけられるように）
    const near = new Set();
    for (const n of N) for (const [dx, dy] of [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]]) near.add((n.x + dx) + ',' + (n.y + dy) + ',' + (n.lv || 0));
    for (let i = O.length - 1; i >= 0; i--) { const o = O[i]; if (o.type === 'prop' && near.has(o.x + ',' + o.y + ',' + (o.lv || 0))) O.splice(i, 1); }

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
        inn: { x: 9, y: 29, dir: 's' },
        shop: { x: 44, y: 29, dir: 's' },
        gord: { x: 24, y: 7, dir: 's' },
        search: { x: 36, y: 8, dir: 's' },
        rita: { x: 52, y: 10, dir: 's' },
        pim_home: { x: 18, y: 45, dir: 's' },
        house1: { x: 40, y: 44, dir: 's' },
        deck: { x: 16, y: 13, dir: 'e', lv: 1 },
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
      light: { ambient: '#5662a2', k: 0.46, poolK: 2.1, mood: 'forest_night' },
      dark: false,
      bgm: 'village',
      meta: { sub: '樹上の村', underDeck: 'moss_earth', chestsInfo: false },
    });
  });
})(window.RPG);
