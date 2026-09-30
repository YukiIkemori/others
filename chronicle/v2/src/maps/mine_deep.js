// CONTENT（ガルド山地）: 深き坑道 3 階（WORLD_REDESIGN §4.6・§6.4・§6.5、STORY_BIBLE §7.6）。どの階も 1 枚の下絵（v2/assets/env/mine/under/mine_*）。
//   1 階 mine_1（54×44）: ドヴァンの坑道の入口（南）→ 線路の本坑 → 分かれ道の間（古いカンテラ）→ 西の坑道の奥の落盤（鉱夫ダグ）・子猫の割れ目 →
//        北の選鉱の間 → 東のトロッコ乗り場。縦穴に細い線路の架台がかかる（歩けない。トロッコで渡る）→ 東の坑道 → 2 階への下り口（北東）。
//        東の坑道からは、長い下り坂で入口の間へ戻れる（一方通行。入口の側からは登れない）。
//   2 階 mine_2（56×46）: 上り口（北東）→ 四つ辻 → 西の水びたしの坑道（板の渡り）の奥に鉱夫ロルフ → 南の坑夫の休み場（長いす・交代表・
//        古いカンテラ。ラザロの手紙）→ 東の横穴に岩食らい（中ボス）→ 奥の小部屋にピップ（誓いのハンマー）→ 南西の坑道 → 七の層への下り口。
//   3 階 mine_3（50×42）七の層: 暗がり（しょく台に火をともす）。上り口（北西）→ 曲がりくねった古い坑道（わきのくぼみ）→ 石だたみの前の間（休息の灯）→
//        七の層の岩戸（誓いのハンマーで開く。岩戸の前後のマスが戸口）→ 番人の広間（玉座の鉄の番人）→ 奥の床の破れ目（白い）。
//   泉（休息の灯）は七の層の前の間の 1 つだけ（長いダンジョン・入口の階でない・番人の手前。WORLD §6.2 の持ち主の決まり）。
//   坑夫のカンテラ（【灯りを守る】）: 1 階の分かれ道・2 階の休み場・3 階のくぼみの古いカンテラ（waylamp、油を足すとともり、周りは魔物が出ない）。
//   宝箱は見える所。隠し通路なし（A27）。当たりは下絵に合わせた mine_painted_rows.js。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Mine.kit, L = K.L;
    const ZONE = [{ rect: null, zone: 'z_r_mine_mine' }];
    // 坑夫のカンテラ（古い灯り。油を足した旗 mine_lamp_<n> でともる）
    const lamp = (n, x, y) => ({ type: 'waylamp', id: 'wl_mine_' + n, x, y, lit: 'mine_lamp_' + n, event: 'mine_lamp' });

    // ================================================================ 1 階
    {
      const P = MK.painted('mine_1');
      const O = [];
      O.push(K.stairs(47, 2, { map: 'mine_2', spawn: 'up' }, { id: 'mine_1_down', look: 'down' }));
      // トロッコ（縦穴の架台を渡る。乗り場の縁の架台を調べる）
      O.push(K.prop('mine_cart', 40, 20), K.exam(42, 21, 'mine_cart_ride', { ride: 'cart_e' }), K.exam(46, 21, 'mine_cart_ride', { ride: 'cart_w' }), K.prop('mine_cart', 48, 20));
      O.push(K.sign(28, 36, R.T('map.mine_deep.sign')));
      O.push(K.exam(4, 8, 'mine_cavein'));
      O.push(lamp(1, 33, 18));
      O.push(K.chest('mine_1_c1', 27, 6, { pool: 'p_T' }), K.chest('mine_1_c2', 31, 9, { gold: 150 }), K.chest('mine_1_c3', 8, 10, { item: 'i_ether', n: 1 }), K.chest('mine_1_c4', 45, 4, { pool: 'p_T' }));
      for (const [x, y] of [[24, 33], [29, 32], [21, 18], [34, 18], [26, 4], [9, 14], [46, 12], [47, 28]]) O.push(K.prop('hook_lamp', x, y));
      const N = [
        // 落盤の奥の鉱夫ダグ（1 人目）
        K.npc('miner1', 'npc_miner', 6, 10, { name: R.T('map.mine_deep.N.0.miner1.name'), dir: 's', talk: 'mine_miner1', reward: null, pushable: false, cond: '!mine_miner1' }),
        // 割れ目の子猫（落盤の子猫の依頼）
        K.npc('kitten', 'ani_cat', 13, 16, { name: R.T('map.mine_deep.N.1.kitten.name'), dir: 'w', talk: 'mine_kitten', reward: null, pushable: false, cond: ['mine_kitten_asked', '!mine_kitten_found'] }),
      ];
      K.def('mine_1', {
        name: R.T('map.mine_deep.mine_1.name'), kind: 'dungeon', region: 'r_mine', location: 'deepmine', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: N,
        spawns: { entrance: { x: 26, y: 42, dir: 'n' }, from2: { x: 47, y: 3, dir: 's' }, cart_w: { x: 41, y: 21, dir: 'e' }, cart_e: { x: 47, y: 21, dir: 'w' } },
        exits: [{ x: 25, y: 43, w: 3, h: 1, to: { map: 'dovan', spawn: 'mine' } }],
        // 東の坑道 → 入口の間の下り坂（一方通行: 南へ下りるときだけ）
        oneway: [{ x: 47, y: 24, dir: 's' }, { x: 48, y: 24, dir: 's' }, { x: 49, y: 24, dir: 's' }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'mine_arrive', once: true }],
        zones: ZONE,
        light: MK.LIGHT_CAVE, dark: false, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: [] }),
        meta: { chestsInfo: true, floor: R.T('map.mine_deep.mine_1.meta.floor'), sub: R.T('map.mine_deep.mine_1.meta.sub') },
      });
    }

    // ================================================================ 2 階
    {
      const P = MK.painted('mine_2');
      const O = [];
      O.push(K.stairs(48, 3, { map: 'mine_1', spawn: 'from2' }, { id: 'mine_2_up', look: 'up' }));
      O.push(K.stairs(9, 41, { map: 'mine_3', spawn: 'up' }, { id: 'mine_2_down', look: 'down' }));
      // 坑夫の休み場: 交代表（lo_time_mine）・長いす・古いカンテラ（【灯りを守る】）・壁の古いカンテラの下の封筒（ラザロの手紙）
      O.push(K.exam(31, 29, 'mine_shift_board'), K.exam(24, 31, 'mine_rest_bench'), K.exam(25, 31, 'mine_rest_bench'));
      O.push(lamp(2, 31, 35));
      O.push(K.prop('lantern', 22, 33), K.exam(22, 33, 'mine_lz'));
      O.push(K.chest('mine_2_c1', 4, 21, { pool: 'p_T' }), K.chest('mine_2_c2', 51, 34, { pool: 'p_T' }), K.chest('mine_2_c3', 36, 17, { gold: 220 }));
      // 坑道の幽霊が教える宝箱（話を最後まで聞くと出る）
      O.push(K.chest('mine_2_c4', 11, 37, { pool: 'p_rare', cond: 'mine_ghost_done' }));
      for (const [x, y] of [[43, 8], [30, 13], [19, 23], [33, 30], [46, 31], [7, 35], [17, 29]]) O.push(K.prop('hook_lamp', x, y));
      const N = [
        // 水びたしの坑道の奥の鉱夫ロルフ（2 人目）
        K.npc('miner2', 'npc_miner', 4, 19, { name: R.T('map.mine_deep.N.0.miner2.name'), dir: 'e', talk: 'mine_miner2', reward: null, pushable: false, cond: '!mine_miner2' }),
        // 横穴の奥のピップ（3 人目。岩食らいの向こう）
        K.npc('pip', 'npc_pip', 49, 33, { name: R.T('map.mine_deep.N.1.pip.name'), dir: 'n', talk: 'mine_pip', reward: null, pushable: false, cond: '!mine_pip' }),
        // 坑道の幽霊（休み場のカンテラがともると、昔の坑夫が長いすに）
        K.npc('ghost', 'npc_mine_old_m', 27, 32, { name: R.T('map.mine_deep.N.2.ghost.name'), dir: 'w', talk: 'mine_ghost', reward: 'item', pushable: false, cond: ['mine_lamp_2', '!mine_ghost_done'], ghost: true }),
      ];
      K.def('mine_2', {
        name: R.T('map.mine_deep.mine_2.name'), kind: 'dungeon', region: 'r_mine', location: 'deepmine', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: N,
        spawns: { up: { x: 48, y: 4, dir: 's' }, from3: { x: 9, y: 40, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'mine_f2_arrive', once: true },
          { id: 'rockeater', x: 41, y: 19, w: 3, h: 4, on: 'step', event: 'mine_rockeater', cond: '!mine_rockeater' },
        ],
        zones: ZONE,
        light: MK.LIGHT_CAVE, dark: false, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: [] }),
        meta: { chestsInfo: true, floor: R.T('map.mine_deep.mine_2.meta.floor'), sub: R.T('map.mine_deep.mine_2.meta.sub') },
      });
    }

    // ================================================================ 3 階（七の層）
    {
      const P = MK.painted('mine_3');
      const O = [];
      O.push(K.stairs(8, 3, { map: 'mine_2', spawn: 'from3' }, { id: 'mine_3_up', look: 'up' }));
      // しょく台（暗がり。火をともすと周りが明るいまま）
      for (const [i, x, y] of [[1, 6, 12], [2, 12, 21], [3, 12, 29], [4, 21, 33], [5, 21, 17], [6, 34, 17]]) O.push({ type: 'brazier', id: 'mine_3_b' + i, x, y });
      O.push(K.chest('mine_3_c1', 3, 13, { pool: 'p_T' }), K.chest('mine_3_c2', 33, 36, { gold: 300 }));
      O.push(lamp(3, 15, 21));
      // 休息の灯（岩戸の前の間）
      O.push(K.spring('mine_3_spring', 29, 34));
      // 七の層の岩戸: 閉じている間は調べる（誓いのハンマー）。開いたら、前後のマスが戸口（前の間 ⇔ 番人の広間）
      O.push(K.exam(27, 31, 'mine_rockdoor', { cond: '!mine_door_open' }));
      O.push({ type: 'door', x: 27, y: 31, look: 'none', to: { map: 'mine_3', spawn: 'hall' }, cond: 'mine_door_open' });
      O.push({ type: 'door', x: 27, y: 27, look: 'none', to: { map: 'mine_3', spawn: 'ante' }, cond: 'mine_door_open' });
      // 番人（玉座）と破れ目（白い）
      O.push(K.exam(27, 15, 'mine_guardian_throne'), K.exam(27, 10, 'mine_breach'), K.prop('white_glow', 27, 9));
      const N = [];
      K.def('mine_3', {
        name: R.T('map.mine_deep.mine_3.name'), kind: 'dungeon', region: 'r_mine', location: 'deepmine', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: N,
        spawns: { up: { x: 8, y: 4, dir: 's' }, ante: { x: 27, y: 32, dir: 's' }, hall: { x: 27, y: 25, dir: 'n' } },
        exits: [],
        // 岩戸が閉じている間は、前のマスも岩（描いた岩戸の下の段）
        tilePatches: [{ cond: '!mine_door_open', rect: [27, 31, 1, 1], rows: ['X'] }],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'mine_f3_arrive', once: true },
          { id: 'warden', x: 21, y: 18, w: 14, h: 2, on: 'step', event: 'mine_warden', cond: ['mine_choice', '!mine_warden_done'] },
        ],
        zones: ZONE,
        light: MK.LIGHT_DEEP, dark: true, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: ['white_glow'] }),
        meta: { chestsInfo: true, floor: R.T('map.mine_deep.mine_3.meta.floor'), sub: R.T('map.mine_deep.mine_3.meta.sub') },
      });
    }
  });
})(window.RPG);
