// 雪原の寄り道の場所（WORLD_REDESIGN §2.7 #11〜#14・§6、V2_PLAN §2.6.1）
//   #11 つららの回廊 icicle_1・icicle_2（西の崖の氷の洞。2 階は暗がり E6、火皿 3。氷に閉じこめられた宝箱は火のつぼでとかす。奥につらら番と一品物）
//   #14 峠の宿 pass_inn（外）・pass_inn_in（宿・売店・うわさの 3 人）。湯だまりの泉（回復）と湯の番の依頼
//   #12 オーロラの崖 aurora（北の流氷原。景色・氷尾ギツネとオーロラ鳥の巣・前の世の伝説の書き付け）
//   #13 氷に閉じた帆船 frost_ship_1・frost_ship_2（隠しボス 氷の船団長。強さ固定。入口の看板とうわさで「危険」）
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit, L = K.L;
    const CAVE = (extra) => S.LEGEND(Object.assign({
      '.': { mat: 'ice' }, ',': { mat: 'snow_path' }, 'n': { mat: 'snow' },
      I: { mat: 'ice', solid: true, name: 'ice_wall' },
    }, extra || {}));

    // ================================================================ #11 つららの回廊 1 階 44×34
    {
      const W = 44, H = 34;
      const g = K.grid(W, H, 'H');
      K.blob(g, 37, 17, 5, 4, '.', 'ic1a');                  // 入口の広間（東）
      K.rect(g, 41, 16, 3, 3, ',');
      K.blob(g, 22, 8, 9, 4, '.', 'ic1b');                   // 北のつらら回廊
      K.blob(g, 21, 18, 6, 4, 'n', 'ic1c');                  // 中の雪だまり（泉）
      K.blob(g, 22, 27, 9, 4, '.', 'ic1d');                  // 南の氷の回廊
      K.blob(g, 7, 17, 5, 5, '.', 'ic1e');                   // 西の広間（下り口）
      K.path(g, [[32, 17], [27, 17]], ',', 2);
      K.path(g, [[35, 13], [35, 10], [26, 10]], ',', 2);
      K.path(g, [[35, 21], [35, 27], [31, 27]], ',', 2);
      K.path(g, [[14, 9], [12, 9], [12, 13]], '.', 2);
      K.path(g, [[14, 27], [8, 27], [8, 22]], '.', 2);
      K.path(g, [[15, 18], [12, 18]], ',', 2);
      K.soften(g, 'H', '.,n', ['#', 'H'], 0.3, 'ic1');
      // 氷に閉じこめられた宝箱（北の回廊の奥）
      // （氷の床は歩けるマス。ふさぐのは cond のある氷の結晶の物 = とけると消える。check_reach が「後で開く所」として数えられる）
      K.rect(g, 16, 5, 3, 3, 'H'); K.put(g, 17, 6, '.'); K.put(g, 17, 7, '.');
      const O = [];
      O.push(K.prop('rock_small', 21, 18), K.prop('rock_small', 22, 19));   // 小石（泉は置かない。WORLD §6.2）
      O.push(K.stairs(6, 17, { map: 'icicle_2', spawn: 'up' }, { id: 'icicle_1_down', look: 'down' }));
      O.push(K.chest('icicle_1_c1', 17, 6, { pool: 'p_rare' }), K.exam(17, 8, 'icicle_frozen', { box: 1 }));
      O.push(K.prop('ice_crystal', 17, 7, { cond: '!snow_icicle_box_1' }));
      O.push(K.chest('icicle_1_c2', 25, 30, { pool: 'p_T' }), K.chest('icicle_1_c3', 28, 6, { item: 'i_thaw', n: 2 }), K.chest('icicle_1_c4', 8, 21, { gold: 180 }));
      O.push(K.sign(38, 14, 'つららの回廊\n氷はとけない。火のつぼなら、少しは……\n（古い字）'));
      for (const [x, y] of [[20, 7], [26, 9], [24, 28], [19, 26], [36, 19], [9, 16], [25, 17]]) O.push(K.prop('ice_crystal', x, y, { variant: (x * 3 + y) % 3 }));
      K.scatter(g, O, ['snow_rock', 'ice_crystal'], 8, [2, 2, 40, 30], '.n', 'ic1deco', { gap: 5, variant: true });
      K.def('icicle_1', {
        name: 'つららの回廊', kind: 'dungeon', optional: true, region: 'r_snow', location: 'icicle', theme: 'ice_cave',
        legend: CAVE(), rows: g, outside: 'wall_snow', objects: O, npcs: [],
        spawns: { entrance: { x: 41, y: 17, dir: 'w' }, up: { x: 8, y: 18, dir: 'e' } },
        exits: [{ x: 43, y: 16, w: 1, h: 3, to: { map: 'world', spawn: 'icicle' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'icicle_arrive', once: true }],
        art: { image: 'snow/under/icicle_1', painted: [] },   // 描いた下絵（design/ENV_ASSETS.md §7）
        zones: [{ rect: null, zone: 'z_snow_icicle' }],
        light: { ambient: '#4c5c98', k: 0.6, poolK: 0.6, spillR: 0.8, mood: 'cave' },
        dark: false, bgm: 'cave', bbg: 'snow',
        meta: { chestsInfo: true, floor: '1 階', sub: '氷の洞' },
      });
    }
    // ================================================================ #11 つららの回廊 2 階（暗がり）40×32
    {
      const W = 40, H = 32;
      const g = K.grid(W, H, 'H');
      K.blob(g, 8, 25, 5, 3, '.', 'ic2a');                    // 上り口
      K.blob(g, 20, 22, 7, 4, '.', 'ic2b');                   // 中の広間（火皿 1・泉）
      K.blob(g, 31, 14, 6, 5, '.', 'ic2c');                   // 東の広間（火皿 2）
      K.blob(g, 18, 8, 8, 4, '.', 'ic2d');                    // 北の奥（火皿 3・つらら番・一品物）
      K.blob(g, 6, 11, 4, 4, '.', 'ic2e');                    // 北西（封じの扉）
      K.path(g, [[12, 25], [14, 25]], ',', 2);
      K.path(g, [[26, 21], [30, 21], [30, 18]], ',', 2);
      K.path(g, [[31, 10], [26, 10]], ',', 2);
      K.path(g, [[20, 18], [20, 12]], ',', 2);
      K.path(g, [[11, 9], [10, 9]], '.', 2);
      K.soften(g, 'H', '.,', ['#', 'H'], 0.3, 'ic2');
      K.rect(g, 18, 3, 5, 3, '.'); K.rect(g, 19, 6, 3, 1, 'I');   // 一品物の小部屋（氷でふさがる）
      const O = [];
      O.push(K.prop('rock_small', 18, 23), K.prop('rock_small', 19, 24));   // 小石（泉は置かない。WORLD §6.2）
      O.push(K.stairs(6, 25, { map: 'icicle_1', spawn: 'up' }, { id: 'icicle_2_up', look: 'up' }));
      O.push({ type: 'brazier', id: 'icicle_2_b1', x: 23, y: 20 }, { type: 'brazier', id: 'icicle_2_b2', x: 34, y: 12 }, { type: 'brazier', id: 'icicle_2_b3', x: 16, y: 9 });
      O.push(K.chest('icicle_2_c1', 20, 4, { item: 'u_icicle_spear', n: 1 }), K.exam(20, 7, 'icicle_frozen', { box: 2 }));
      for (let i = 0; i < 3; i++) O.push(K.prop('ice_crystal', 19 + i, 6, { cond: '!snow_icicle_box_2', variant: i }));
      O.push(K.chest('icicle_2_c2', 35, 16, { pool: 'p_T' }), K.chest('icicle_2_c3', 4, 11, { pool: 'p_T' }), K.chest('icicle_2_c4', 24, 24, { item: 'i_elixir', n: 1 }));
      O.push(K.prop('talestone', 7, 9), K.exam(7, 10, 'icicle_seal'));             // 宝の地図 その2 の封じの扉（地図は縦切りの外）
      O.push(K.sign(22, 12, '――つらら番、眠りを破る者を打つ。\n火のある所では、やつは目が利かぬ。\n（誰かの書き付け）'));
      for (const [x, y] of [[12, 22], [28, 13], [33, 18], [24, 7], [9, 13]]) O.push(K.prop('ice_crystal', x, y, { variant: (x + y) % 3 }));
      K.put(g, 11, 7, '#');   // 描いた下絵の岩（v2/assets/env/snow/under/icicle_2*）
      K.def('icicle_2', {
        name: 'つららの回廊', kind: 'dungeon', optional: true, region: 'r_snow', location: 'icicle', theme: 'ice_cave',
        legend: CAVE(), rows: g, outside: 'wall_snow', objects: O, npcs: [],
        spawns: { up: { x: 8, y: 26, dir: 'e' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'icicle_2_arrive', once: true },
          { id: 'guard', x: 17, y: 7, w: 7, h: 3, on: 'step', event: 'icicle_guard', cond: '!snow_icicle_guard' },
        ],
        tilePatches: [{ cond: 'snow_icicle_box_2', rect: [19, 6, 3, 1], rows: ['...'] }],
        art: { image: 'snow/under/icicle_2', painted: [] },   // 描いた下絵（design/ENV_ASSETS.md §7）
        zones: [{ rect: null, zone: 'z_snow_icicle_deep' }],
        light: { ambient: '#3e4a82', k: 0.66, poolK: 0.6, spillR: 0.8, mood: 'cave' },
        dark: [{ rect: [0, 0, 40, 32] }], bgm: 'cave', bbg: 'snow',
        meta: { chestsInfo: true, floor: '2 階', sub: '暗い氷の洞' },
      });
    }

    // ================================================================ #14 峠の宿（外）34×26
    //   ありふれた宿場ではない: 峠をまたぐ古い関所の門の跡に住みついた宿。西の塔が宿（戸口）、東の塔が売店（戸口）、
    //   二つの塔をつなぐ門の壁のアーチは、峠の先の崖崩れの岩でふさがっている（山地へは抜けられない）。
    //   鞍部の東には、雪をとかす湯の段々（湯気の立つ石の湯だまり 3 つ。いちばん上の湯だまりのわきが回復の泉、湯殿のくみ口は板の囲い）。
    //   西は旅人の野営地。道は南の出口から鞍部をうねって門の石畳の庭へ上る。
    //   絵は 1 枚の下絵（v2/assets/env/snow/under/pass_inn*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
    {
      const W = 34, H = 26;
      // # 岩と雪の崖（歩けない）・. 雪・, 踏み固めた道・c 石畳（関所の庭・湯の段の縁）・~ 湯（歩けない）
      const g = [
        '##################################',
        '####......############......######',
        '####........................######',
        '####........................######',
        '####........................######',
        '####........................######',
        '####........................######',
        '####......cccccccccccc......######',
        '###cccccccccccccccccccccccccc#####',
        '###cccccccccccc,,cccccccccccc#####',
        '###cccccccccccc,,cccccccccccc...##',
        '###............,,........cccc...##',
        '##.............,,....ccccc~~~ccc##',
        '##............,,,....ccc~~~~~~~.##',
        '##............,,,....ccccc~~~cc..#',
        '#.............,,,...,,,..cccc....#',
        '##............,,,,,,,,,ccccc.....#',
        '##........,,,,,,,.....cc~~~~c....#',
        '##........,,,,,,,......c~~~c.....#',
        '###...........,,,..........cccc.##',
        '####..........,,,,........cc~~~c##',
        '#####.........,,,,.........cccc###',
        '######........,,,,.........#######',
        '########.......,,,.......#########',
        '############...,,,...#############',
        '###############,,,################',
      ].map((r) => [...r]);
      const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 3, roof: 'slate', mat: 'stone', windows: 2, lamp: true, chimney: true }, o || {});
      const O = [
        B('pass_gate_inn', 4, 1, 6, 7, { sign: 'inn', door: { x: 7, y: 7, to: { map: 'pass_inn_in', spawn: 'door' } } }),
        B('pass_gate_wall', 10, 2, 12, 5, { lamp: false, chimney: false, windows: 0 }),   // 門の壁（アーチは崖崩れの岩でふさがる。戸なし）
        B('pass_gate_shop', 22, 1, 6, 7, { sign: 'item', door: { x: 25, y: 7, to: { map: 'pass_inn_shop', spawn: 'door' } } }),
        B('pass_bath_screen', 29, 10, 3, 2, { wall: 1, roof: 'shingle', mat: 'plank', lamp: false, chimney: false, windows: 0 }),   // 湯殿のくみ口の板の囲い
      ];
      O.push(K.spring('pass_inn_s1', 22, 12));                   // 湯だまり（回復の泉）
      O.push(K.exam(30, 11, 'pass_inn_bath_pool'));
      // 氷の灯籠（街灯）: 庭と鞍部の広い所の縁だけ。道・戸口の前・1 マス幅の所には立てない（v2/tools/qa/check_lamps.js）
      for (const [x, y] of [[3,  11],  [19,  11],  [11,  21],  [20,  20]]) O.push(K.prop('snow_lamp', x, y));
      for (const [x, y] of [[9,  9],  [23,  9],  [21,  15],  [14,  24]]) O.push(K.prop('lantern', x, y));
      // 小物は壁の際に少しだけ（町の小物は当たらない。道・戸口の前には置かない）
      O.push(K.prop('tent', 5, 14), K.prop('firewood', 3, 17), K.prop('sled', 7, 20));
      O.push(K.prop('board', 12, 11), K.exam(12, 11, 'pass_inn_board'));
      O.push(K.sign(18, 23, '宿場「峠の宿」\n関所の跡の宿。湯あり。'));
      O.push(K.chest('pass_inn_c1', 4, 20, { pool: 'p_T' }));
      K.def('pass_inn', {
        name: '峠の宿', kind: 'town', optional: true, region: 'r_snow', location: 'pass_inn', theme: 'snow_town',
        legend: S.LEGEND({ c: { mat: 'cobble' }, '~': { mat: 'water', walk: false, name: 'hot_spring' } }), rows: g, outside: 'wall_snow', objects: O,
        npcs: [
          K.npc('bath_keeper', 'npc_snow_old_m', 23, 15, { name: '湯の番', dir: 'e', talk: 'pass_inn_bath_keeper', reward: 'side' }),
          K.npc('pass_inn_scout', 'npc_snow_watch', 16, 8, { name: '峠の見張り', dir: 'n', talk: 'pass_inn_scout', reward: 'news' }),
          K.npc('pass_inn_fox_man', 'npc_snow_man', 9, 15, { name: '毛皮取り', dir: 'e', talk: 'pass_inn_fox_man', reward: 'hint' }),
          K.npc('pass_dog', 'ani_dog', 6, 18, { name: '犬', dir: 'e', move: 'wander', talk: [L('ワフ。')], reward: null }),
        ],
        spawns: { gate: { x: 16, y: 23, dir: 'n' }, inn: { x: 7, y: 8, dir: 's' }, shop: { x: 25, y: 8, dir: 's' }, bath: { x: 23, y: 16, dir: 'n' } },
        exits: [{ x: 15, y: 25, w: 3, h: 1, to: { map: 'world', spawn: 'pass_inn' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'pass_inn_arrive', once: true }],
        zones: [], light: { ambient: '#5c66a6', k: 0.5, poolK: 0.8, spillR: 0.9, mood: 'town_night' },
        bgm: 'yule', weather: 'snow', weatherCond: '!cleared_r_snow',
        meta: { sub: '関所の跡の湯の宿', chestsInfo: false },
        art: { image: 'snow/under/pass_inn', emit: 'snow/under/pass_inn_emit', painted: [] },
      });
      // 宿（西の塔の中）: おかみと、うわさ好きの泊まり客 3 人
      const r = K.room(18, 12, {});
      K.rect(r.g, 6, 6, 6, 3, 'c');
      K.def('pass_inn_in', {
        name: '峠の宿', kind: 'interior', optional: true, region: 'r_snow', location: 'pass_inn',
        legend: S.ROOM(), rows: r.g, outside: 'wall_wood',
        // 描いた下絵（v2/assets/env/snow/under/pass_inn_in*）: 北の壁の西に大きな石の暖炉（火は光だけの物 fireplace = art.painted）。帳場は東へ
        objects: [K.prop('fireplace', 3, 2), K.prop('counter', 11, 3), K.prop('counter', 12, 3), K.prop('counter', 13, 3), K.prop('shelf_jars', 14, 2),
          K.prop('bed', 16, 5), K.prop('bed', 16, 8), K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7),   // 戸口の列（x 8）は空ける
          K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
          K.prop('stove', 1, 6), K.prop('lantern', 9, 3), K.prop('firewood', 1, 9), K.prop('snow_barrel', 15, 10)],
        npcs: [
          K.npc('pass_inn_innkeeper', 'npc_snow_woman', 12, 2, { name: '峠の宿のおかみ', dir: 's', talk: 'pass_inn_innkeeper', pushable: false }),
          K.npc('rumor_gossip', 'npc_snow_woman', 6, 8, { name: 'うわさ好きの湯治客', dir: 'e', talk: 'pass_inn_rumor_gossip', reward: 'lead' }),
          K.npc('rumor_bard', 'npc_bard_3', 11, 7, { name: '吟遊詩人', dir: 's', talk: 'pass_inn_rumor_bard', reward: 'lead' }),
          K.npc('rumor_merchant', 'npc_traveler', 13, 9, { name: '旅の商人', dir: 'w', talk: 'pass_inn_rumor_merchant', reward: 'lead' }),
        ],
        spawns: { door: { x: r.door.x, y: 10, dir: 'n' } },
        exits: [{ x: r.door.x, y: 11, w: 1, h: 1, to: { map: 'pass_inn', spawn: 'inn' } }],
        art: { image: 'snow/under/pass_inn_in', painted: ['fireplace'] },
        triggers: [], light: S.ROOM_LIGHT, bgm: 'tavern', meta: { minimap: false },
      });
      // 売店（東の塔の中）
      const r2 = K.room(10, 8, {});
      K.def('pass_inn_shop', {
        name: '峠の宿の売店', kind: 'interior', optional: true, region: 'r_snow', location: 'pass_inn',
        legend: S.ROOM(), rows: r2.g, outside: 'wall_wood',
        objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('shelf_jars', 8, 2),
          K.prop('snow_barrel', 8, 5), K.prop('sack', 1, 5), K.prop('lantern', 7, 4)],
        npcs: [K.npc('pass_shop', 'npc_snow_man', 5, 2, { name: '売店の主人', dir: 's', talk: 'pass_inn_shopkeeper', pushable: false })],
        spawns: { door: { x: r2.door.x, y: 6, dir: 'n' } },
        exits: [{ x: r2.door.x, y: 7, w: 1, h: 1, to: { map: 'pass_inn', spawn: 'shop' } }],
        art: { image: 'snow/under/pass_inn_shop', painted: [] },
        triggers: [], light: S.ROOM_LIGHT, bgm: 'tavern', meta: { minimap: false },
      });
    }

    // ================================================================ #12 オーロラの崖 40×30
    {
      const W = 40, H = 30;
      const g = K.grid(W, H, 'H');
      K.blob(g, 20, 20, 12, 6, 'n', 'au_a');
      K.rect(g, 18, 26, 4, 4, ',');
      K.blob(g, 20, 9, 11, 5, 'n', 'au_b');                    // 崖の上（オーロラの見える所）
      K.blob(g, 20, 6, 8, 2, 'i', 'au_ice', 'n');
      K.blob(g, 7, 15, 4, 4, 'n', 'au_c');                      // 西の岩陰（泉）
      K.path(g, [[20, 15], [20, 13]], ',', 3);
      K.path(g, [[12, 17], [10, 17]], ',', 2);
      K.soften(g, 'H', 'n,i', ['#', 'H'], 0.3, 'au');
      K.rect(g, 12, 3, 17, 1, 'H');                             // 崖の縁
      const O = [];
      O.push(K.prop('rock_small', 6, 15), K.prop('rock_small', 7, 16));   // 小石（泉は置かない。WORLD §6.2）
      O.push(K.exam(20, 5, 'aurora_view'), K.prop('ice_crystal', 16, 4), K.prop('ice_crystal', 24, 4), K.prop('snow_sign', 21, 6));
      O.push(K.prop('talestone', 28, 9), K.exam(28, 10, 'aurora_legend'));
      O.push(K.chest('aurora_c1', 30, 20, { pool: 'p_T' }), K.chest('aurora_c2', 5, 13, { pool: 'p_rare' }), K.chest('aurora_c3', 11, 8, { item: 'i_ether', n: 2 }));
      for (const [x, y] of [[14, 20], [27, 22], [17, 11], [25, 12], [9, 18]]) O.push(K.prop('ice_crystal', x, y, { variant: (x + y) % 3 }));
      K.scatter(g, O, ['snow_rock', 'snow_bank'], 10, [2, 2, 36, 24], 'n', 'audeco', { gap: 4, variant: true });
      K.def('aurora', {
        name: 'オーロラの崖', kind: 'dungeon', optional: true, region: 'r_snow', location: 'aurora', theme: 'snow',
        legend: S.LEGEND({ n: { mat: 'snow' } }), rows: g, outside: 'wall_snow', objects: O, npcs: [],
        spawns: { south: { x: 19, y: 27, dir: 'n' } },
        exits: [{ x: 18, y: 29, w: 4, h: 1, to: { map: 'world', spawn: 'aurora' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'aurora_arrive', once: true }],
        art: { image: 'snow/under/aurora', painted: [] },   // 描いた下絵（design/ENV_ASSETS.md §7）
        zones: [{ rect: null, zone: 'z_snow_floe' }],
        light: { ambient: '#6a64b0', k: 0.58, poolK: 0.7, spillR: 0.9, mood: 'night' },
        dark: false, bgm: 'ice', bbg: 'snow', weather: 'snow',
        meta: { chestsInfo: true, sub: '空が七色に揺れる崖' },
      });
    }

    // ================================================================ #13 氷に閉じた帆船 1（甲板）42×24・2（船長室の船倉）36×22
    {
      const W = 42, H = 24;
      const g = K.grid(W, H, '.');
      K.border(g, 'H', 2);
      // 船体（上から見た形。甲板は描いた下絵 v2/assets/env/snow/under/frost_ship_1*）: 船尾は西（x 6 の平らな船尾板）、船首は東（x 37 でとがる）。
      //   半幅 w(x): 船尾 3.5 → x 10 で 5、x 28 まで 5、船首へ 0。舷（ふなべり）= 甲板の縁のマスは歩けない（手すりと船腹）。上り下りは南の渡り板だけ
      const hw = (x) => (x < 10 ? 3.5 + (1.5 * (x - 6)) / 4 : x <= 28 ? 5 : (5 * (37 - x)) / 9);
      const inHull = (x, y) => x >= 6 && x <= 36 && Math.abs(y + 0.5 - 12.5) <= hw(x + 0.5);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inHull(x, y)) K.put(g, x, y, [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inHull(x + dx, y + dy)) && !(x >= 19 && x <= 20 && y === 17) ? 'R' : 'p');
      K.rect(g, 18, 20, 4, 4, ',');
      K.rect(g, 19, 18, 2, 2, 'p');                              // 渡り板
      K.rect(g, 5, 3, 4, 3, 'W'); K.rect(g, 32, 3, 5, 3, 'W');   // 船団のほかの船の残骸（氷から突き出た船尾楼）
      // 描いた下絵（v2/assets/env/snow/under/frost_ship_1*）に合わせた当たり: 折れた帆柱の根もと 3 本・南の雪の土手（21 行目）は歩けない、
      //   東西の縁の氷（1・40 列）は歩ける
      for (const x of [12, 20, 28]) K.put(g, x, 12, 'R');
      for (let x = 2; x < 40; x++) if (K.at(g, x, 21) === '.') K.put(g, x, 21, 'H');
      for (let y = 2; y <= 20; y++) { K.put(g, 1, y, '.'); K.put(g, 40, y, '.'); }
      const O = [];
      O.push(K.prop('sack', 10, 12), K.prop('sack', 11, 13));   // 荷（泉は置かない。WORLD §6.2）
      O.push(K.stairs(33, 12, { map: 'frost_ship_2', spawn: 'up' }, { id: 'frost_ship_1_down', look: 'down' }));
      for (const [x, y] of [[14, 10], [22, 10], [28, 14]]) O.push(K.prop('ice_crystal', x, y));
      O.push(K.prop('barrel', 12, 14), K.prop('crate', 25, 14), K.prop('snow_barrel', 16, 14), K.prop('net', 29, 10), K.prop('rowboat', 5, 18));
      O.push(K.chest('frost_ship_1_c1', 9, 14, { pool: 'p_T' }), K.chest('frost_ship_1_c2', 31, 10, { pool: 'p_T' }));
      O.push(K.sign(22, 19, '――この船に入るべからず。\n百年、帰らぬ船団。凍てつく長あり。\n（峠の宿の組合の札）'));
      O.push(K.exam(20, 9, 'frost_ship_log'));
      K.def('frost_ship_1', {
        name: '氷に閉じた帆船', kind: 'dungeon', optional: true, region: 'r_snow', location: 'frost_ship', theme: 'snow',
        legend: S.LEGEND({ '.': { mat: 'ice' }, p: { mat: 'plank' }, W: { mat: 'wall_wood', solid: true, rise: 2 }, R: { mat: 'wall_wood', solid: true, rise: 1, name: 'hull' } }), rows: g, outside: 'ice', objects: O, npcs: [],
        spawns: { entrance: { x: 19, y: 22, dir: 'n' }, up: { x: 32, y: 13, dir: 'w' } },
        art: { image: 'snow/under/frost_ship_1', painted: [] },   // 描いた下絵（design/ENV_ASSETS.md §7）
        exits: [{ x: 18, y: 23, w: 4, h: 1, to: { map: 'world', spawn: 'frost_ship' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'frost_ship_arrive', once: true }],
        zones: [{ rect: null, zone: 'z_snow_ship' }],
        light: { ambient: '#56629c', k: 0.58, poolK: 0.7, spillR: 0.9, mood: 'night' },
        dark: false, bgm: 'ghost', bbg: 'snow', weather: 'snow',
        meta: { chestsInfo: true, floor: '甲板', sub: '氷の中の帆柱' },
      });
      const g2 = K.grid(36, 22, 'W');
      K.rect(g2, 3, 3, 30, 16, 'p');
      K.rect(g2, 14, 3, 2, 16, 'W'); K.rect(g2, 14, 10, 2, 3, 'p');   // 船倉の仕切り
      K.rect(g2, 22, 12, 11, 7, 'c');                                   // 船長室（敷物）
      const O2 = [];
      O2.push(K.prop('sack', 6, 12), K.prop('sack', 7, 13));   // 荷（泉は置かない。WORLD §6.2）
      O2.push(K.stairs(4, 4, { map: 'frost_ship_1', spawn: 'up' }, { id: 'frost_ship_2_up', look: 'up' }));
      O2.push(K.prop('barrel', 8, 5), K.prop('barrel', 9, 5), K.prop('crate', 11, 16), K.prop('crate', 12, 16), K.prop('table', 27, 14), K.prop('chair', 26, 14), K.prop('bookshelf', 31, 4),
        K.prop('ice_crystal', 20, 6), K.prop('ice_crystal', 30, 17), K.prop('lantern', 24, 6));
      O2.push(K.chest('frost_ship_2_c1', 12, 5, { pool: 'p_rare' }));
      O2.push(K.chest('frost_ship_2_c2', 30, 16, { item: 'u_frost_compass', n: 1, cond: 'snow_admiral' }));
      O2.push(K.exam(28, 13, 'frost_ship_chart'));
      K.def('frost_ship_2', {
        name: '氷に閉じた帆船', kind: 'dungeon', optional: true, region: 'r_snow', location: 'frost_ship', theme: 'snow',
        legend: S.LEGEND({ W: { mat: 'wall_wood', solid: true, rise: 2 }, p: { mat: 'wood_floor' }, c: { mat: 'carpet' } }), rows: g2, outside: 'wall_wood', objects: O2, npcs: [],
        spawns: { up: { x: 5, y: 5, dir: 's' } },
        exits: [],
        triggers: [{ id: 'boss', x: 20, y: 8, w: 3, h: 10, on: 'step', event: 'frost_ship_boss', cond: '!snow_admiral' }],
        art: { image: 'snow/under/frost_ship_2', painted: [] },   // 描いた下絵（design/ENV_ASSETS.md §7）
        zones: [{ rect: [0, 0, 14, 22], zone: 'z_snow_ship' }],
        light: { ambient: '#4e5890', k: 0.62, poolK: 0.6, spillR: 0.8, mood: 'cave' },
        dark: false, bgm: 'ghost', bbg: 'snow',
        meta: { chestsInfo: true, floor: '船倉', sub: '凍りついた船長室' },
      });
    }
  });
})(window.RPG);
