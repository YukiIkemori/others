// CONTENT（マレア諸島）: 幽霊船 3 階（WORLD_REDESIGN §4.5 の流れ 6・7・§6.5、STORY_BIBLE §7.5 の 3・4）。
//   1 階 ghost_ship_1（56×30）甲板: 霧の海に浮かぶ船。南の渡り板の下に自分の外洋船（調べると舵）。折れた帆柱 4 本・倒れた帆桁・船尾楼（舵輪・船長室の天窓）と船首楼（巻き上げ機）・下へのはしご。海に霧（下絵に焼いた）。
//   2 階 ghost_ship_2（48×28）船室: まん中の通路の南北に船員の船室 8 つ。寝台・ハンモックの柱に船員の名札（6 枚、任意）。
//        水夫の水樽のそばに休息の灯（幽霊船は 3 階の長いダンジョン: 泉はここの 1 つだけ。WORLD §6.2 の持ち主の決まり）。
//   3 階 ghost_ship_3（52×30）船倉と船長室: 暗がりの船倉（壁のランタンに火をともすと明るいまま）。西の隔壁の向こうが船長室。
//        船長室に入ると、グレン（亡霊船長）。戦いのあと、机の上の航海日誌（途中から白い）→ 夜明けのネレイの桟橋。
//   解決の後も、霧の晴れた海に古い船として残る（外洋船の舵の「霧の海」から）。当たりは下絵に合わせた isles_painted_rows.js。
//   灯り（2026-09-30 見直し）: 船の灯り = 木の柱に吊った船のランタン（type 'brazier'、組 'ship' の絵 brazier__ship）。
//     解決の前は船べりのランタンに亡霊の火がともっている（on: true、cond !cleared_r_isles）。甲板の渡り板の脇・船室の階段の脇にもともった灯り。
//     3 階の暗がり（E6）は船倉のまん中だけで膜は薄め（darkAlpha。船長室は明るいまま、ランタン 2 つがともっている）。階段の脇の 1 つもはじめからともる。
//   下絵は歩ける所の明るさを WALK_TARGET 96 に上げた（process.py）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, IK = R.Isles.kit, L = K.L;
    const WISP = '!cleared_r_isles';

    // ================================================================ 1 階 甲板
    {
      const P = IK.painted('ghost_ship_1');
      const O = [];
      O.push(K.stairs(24, 11, { map: 'ghost_ship_2', spawn: 'up' }, { id: 'ghost_ship_1_down', look: 'down' }));
      // 渡り板の下の外洋船（乗ると、ネレイの夜の桟橋へ戻る。島々へは桟橋の舵から）
      //   渡り板は 2 マス幅（x 28〜29）。1 つの戸口を w 2 で置く（2 つ並べると入口の印 wayfind が 2 つ出る。2026-10-01 の砂の王墓と同じ）
      O.push({ type: 'door', x: 28, y: 25, w: 2, look: 'none', to: { map: 'nerei', spawn: 'pier_end' }, confirm: R.T('map.isles_ghostship.confirm') });
      O.push(K.prop('ship', 32, 26));   // (2026-10-04) 31 では帆綱と船尾が渡り板（x 28〜29）の先にかかっていた。1 マス東の海へ
      for (const [x, y] of [[18, 15], [32, 14], [42, 14]]) O.push(K.exam(x, y, 'isles_ghost_mast'));   // 描いた折れた帆柱（下絵 gen3 の位置）
      O.push(K.exam(10, 14, 'isles_ghost_skylight'));
      O.push(K.chest('ghost_ship_1_c1', 8, 9, { pool: 'p_T' }), K.chest('ghost_ship_1_c2', 46, 15, { pool: 'p_T' }));
      [[12, 6], [24, 6], [36, 6], [12, 20], [17, 20], [36, 20], [47, 10]].forEach(([x, y], i) => O.push({ type: 'brazier', id: 'ghost_ship_1_g' + (i + 1), x, y, on: true, cond: WISP }));
      // 渡り板の脇の船のランタン 1 つ（解決の後も）
      O.push({ type: 'brazier', id: 'ghost_ship_1_l1', x: 31, y: 20, on: true });   // 下の船べりは壁の段（rise）なので、その内側の甲板に立てる
      K.def('ghost_ship_1', {
        name: R.T('map.isles_ghostship.ghost_ship_1.name'), kind: 'dungeon', region: 'r_isles', location: 'ghostship', theme: 'harbor', propSet: 'ship', propSetBase: 'harbor',
        legend: IK.SHIP(), rows: P.rows, outside: 'sea', objects: O, npcs: [],
        spawns: { board: { x: 28, y: 21, dir: 'n' }, hatch: { x: 24, y: 12, dir: 's' } },
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'isles_ghost_arrive' }],
        zones: [{ rect: null, zone: 'z_r_isles_ship', cond: WISP }],
        light: IK.LIGHT_SHIP, dark: false, bgm: 'ghost', bbg: 'ship',
        art: P.art,
        meta: { chestsInfo: true, floor: R.T('map.isles_ghostship.ghost_ship_1.meta.floor'), sub: R.T('map.isles_ghostship.ghost_ship_1.meta.sub') },
      });
    }

    // ================================================================ 2 階 船室
    {
      const P = IK.painted('ghost_ship_2');
      const O = [];
      O.push(K.stairs(5, 13, { map: 'ghost_ship_1', spawn: 'hatch' }, { id: 'ghost_ship_2_up', look: 'up' }));
      O.push(K.stairs(41, 13, { map: 'ghost_ship_3', spawn: 'up' }, { id: 'ghost_ship_2_down', look: 'down' }));
      // 船員の名札（寝台・ハンモックの柱。任意。1 甲板長 2 帆手 3 見張り 4 かじ取り 5 船大工 6 見習いベッポ）
      for (const [n, x, y] of [[1, 29, 5], [2, 34, 5], [3, 37, 5], [4, 5, 20], [5, 11, 4], [6, 14, 19]]) O.push(K.exam(x, y, 'isles_nametag', { tag: n }));
      O.push(K.exam(13, 19, 'isles_ghost_doll'));
      // 休息の灯（水夫の水樽のそば。幽霊船でただ 1 つ）
      O.push(K.spring('ghost_ship_2_spring', 25, 6));
      O.push(K.chest('ghost_ship_2_c1', 42, 9, { pool: 'p_T' }), K.chest('ghost_ship_2_c2', 9, 22, { item: 'i_potion', n: 2 }), K.chest('ghost_ship_2_c3', 24, 21, { pool: 'p_rare' }));
      [[12, 11], [28, 11], [12, 16], [28, 16]].forEach(([x, y], i) => O.push({ type: 'brazier', id: 'ghost_ship_2_g' + (i + 1), x, y, on: true, cond: WISP }));
      // 階段の脇の船のランタン（解決の後も）
      O.push({ type: 'brazier', id: 'ghost_ship_2_l1', x: 38, y: 15, on: true });
      K.def('ghost_ship_2', {
        name: R.T('map.isles_ghostship.ghost_ship_2.name'), kind: 'dungeon', region: 'r_isles', location: 'ghostship', theme: 'harbor', propSet: 'ship', propSetBase: 'harbor',
        legend: IK.SHIP(), rows: P.rows, outside: 'wall_wood', objects: O, npcs: [],
        spawns: { up: { x: 6, y: 13, dir: 'e' }, down: { x: 40, y: 13, dir: 'w' } },
        exits: [],
        triggers: [],
        zones: [{ rect: null, zone: 'z_r_isles_ship', cond: WISP }],
        light: IK.LIGHT_SHIP, dark: false, bgm: 'ghost', bbg: 'ship',
        art: P.art,
        meta: { chestsInfo: true, floor: R.T('map.isles_ghostship.ghost_ship_2.meta.floor'), sub: R.T('map.isles_ghostship.ghost_ship_2.meta.sub') },
      });
    }

    // ================================================================ 3 階 船倉と船長室
    {
      const P = IK.painted('ghost_ship_3');
      const O = [];
      O.push(K.stairs(47, 14, { map: 'ghost_ship_2', spawn: 'down' }, { id: 'ghost_ship_3_up', look: 'up' }));
      O.push(K.exam(7, 13, 'isles_captain_log', { cond: 'isles_captain' }));
      O.push(K.exam(14, 14, 'isles_cabin_door', { cond: '!isles_captain' }));
      // 船倉のランタン（火をともすと周りが明るいまま、E6）
      const BZ = [[46, 12], [44, 8], [33, 4], [24, 4], [16, 5], [20, 14], [30, 12], [16, 24], [26, 24], [37, 22], [3, 6], [12, 20]];
      // 階段の脇（46,12）と船長室の 2 つ（3,6）（12,20）ははじめからともっている
      const ON = ['46,12', '3,6', '12,20'];
      BZ.forEach(([x, y], i) => O.push(Object.assign({ type: 'brazier', id: 'ghost_ship_3_b' + (i + 1), x, y }, ON.includes(x + ',' + y) ? { on: true } : {})));
      O.push(K.chest('ghost_ship_3_c1', 48, 11, { pool: 'p_T' }), K.chest('ghost_ship_3_c2', 22, 6, { gold: 260 }), K.chest('ghost_ship_3_c3', 4, 21, { pool: 'p_T' }));
      K.def('ghost_ship_3', {
        name: R.T('map.isles_ghostship.ghost_ship_3.name'), kind: 'dungeon', region: 'r_isles', location: 'ghostship', theme: 'harbor', propSet: 'ship', propSetBase: 'harbor',
        legend: IK.SHIP(), rows: P.rows, outside: 'wall_wood', objects: O,
        npcs: [K.npc('glen', 'npc_glen', 7, 12, { name: R.T('map.isles_ghostship.ghost_ship_3.npcs.0.glen.name'), dir: 's', talk: 'isles_captain', reward: null, pushable: false, cond: '!isles_captain' })],
        spawns: { up: { x: 46, y: 15, dir: 'w' }, cabin: { x: 12, y: 15, dir: 'w' } },
        exits: [],
        triggers: [
          { id: 'hold', on: 'enter', event: 'isles_hold_arrive' },
          { id: 'captain', x: 11, y: 12, w: 3, h: 7, on: 'step', event: 'isles_captain', cond: '!isles_captain' },
        ],
        zones: [{ rect: null, zone: 'z_r_isles_ship', cond: WISP }],
        light: IK.LIGHT_HOLD, dark: [{ rect: [15, 0, 26, 30] }], darkAlpha: 0.78, bgm: 'ghost', bbg: 'ship',   // 暗がりは船倉のまん中だけ（x 15〜40。階段の脇と船長室は明るい）。膜は少し薄く（床と壁の形が読める）
        art: P.art,
        meta: { chestsInfo: true, floor: R.T('map.isles_ghostship.ghost_ship_3.meta.floor'), sub: R.T('map.isles_ghostship.ghost_ship_3.meta.sub') },
      });
    }
  });
})(window.RPG);
