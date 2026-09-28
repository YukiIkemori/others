// CONTENT-F: 千年樹 2 階（elder_2）根の間。V2_PLAN §3.2・§3.3 F11・WORLD_REDESIGN §4.1・§6・STORY_BIBLE §7.1
//   ダンジョン 52×48。上の降り口（幹の芯の穴）→ 東の根 → 根の滑り（一方通行、南向きだけ）→ 切り口の間（伸びない年輪）→
//   控えの間（泉。ピムはここで野営地へ帰る）→ 根の奥の祭壇（根食らい → エルム）。
//   ピムの抜け穴（E7、by:'guest'）: 降り口の広間の穴 → 切り口の間への根の戸（東を回らずに済む近道）。
//   西の根は寄り道（宝箱）。控えの間から西の根へ下りる戻り道は一方通行（西向きだけ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 52, H = 48;
    const g = K.grid(W, H, 'B');

    K.blob(g, 26, 6, 7, 3, 'r', 'e2a');           // R0 降り口の広間
    K.blob(g, 10, 16, 6, 5, 'r', 'e2b');          // R1 西の根（寄り道）
    K.blob(g, 42, 16, 6, 5, 'r', 'e2c');          // R2 東の根
    K.blob(g, 42, 16, 2, 1, '~', 'e2cw', 'r');
    K.blob(g, 26, 22, 6, 3, 'r', 'e2d');          // R3 切り口の間
    K.blob(g, 26, 31, 7, 3, '.', 'e2e');          // R4 控えの間（泉）
    K.blob(g, 26, 41, 9, 4, 'r', 'e2f');          // R5 根の奥の祭壇
    K.blob(g, 26, 42, 3, 2, '.', 'e2f2', 'r');
    K.path(g, [[19, 6], [14, 6], [14, 13]], 'r', 2);            // R0 → R1
    K.path(g, [[33, 6], [38, 6], [38, 14]], 'r', 2);            // R0 → R2
    K.path(g, [[42, 21], [42, 26], [33, 26], [33, 22], [30, 22]], 'r', 2);   // R2 → 根の滑り → R3（一方通行）
    K.path(g, [[26, 10], [26, 19]], 'r', 2);                    // R0 → R3（根の戸）
    K.rect(g, 26, 14, 2, 1, 'G');
    K.path(g, [[26, 25], [26, 28]], '.', 2);                    // R3 → R4
    K.path(g, [[26, 34], [26, 37]], 'r', 2);                    // R4 → R5
    K.path(g, [[10, 21], [10, 30], [19, 30]], 'r', 2);          // R4 → R1 の戻り道（控えの間から西へ下りるだけ）
    for (const [x, y] of [[20, 5], [32, 7], [6, 14], [14, 19], [47, 18], [22, 21], [30, 23], [32, 32], [18, 40], [34, 40], [20, 43], [33, 43]]) if (K.at(g, x, y) === 'r' || K.at(g, x, y) === '.') K.put(g, x, y, 'R');

    const O = [];
    O.push(K.stairs(22, 5, { map: 'elder_1', spawn: 'up' }, { id: 'elder_2_up', look: 'up' }));
    O.push({ type: 'switch', id: 'elder_2_sw2', x: 29, y: 8, flag: 'forest_sw2', look: 'hole', color: 'teal', by: 'guest' });
    O.push(K.spring('elder_2_s1', 30, 30));                     // 泉（根食らいの手前。千年樹でただ 1 つ。WORLD §6.2）
    O.push(K.prop('roots', 23, 22), K.exam(24, 22, 'elder_rings'));   // 切り口（伸びない年輪）
    O.push(K.prop('crystal', 26, 44), K.exam(26, 43, 'elder_altar'));  // 根の祭壇
    O.push(K.chest('elder_2_c1', 6, 18, { pool: 'p_T' }));
    O.push(K.chest('elder_2_c2', 46, 13, { pool: 'p_T' }));
    O.push(K.chest('elder_2_c3', 9, 12, { item: 'i_ether', n: 2 }));
    O.push(K.chest('elder_2_c4', 30, 20, { gold: 200 }));
    O.push(K.sign(22, 29, '――根を食むものあり。\n根は地にもぐり、前に立つ者を打つ。\n火をいとい、うしろには届かず。\n（誰かの書き付け）'));
    for (const [x, y] of [[21, 7], [31, 5], [8, 15], [12, 20], [40, 14], [45, 19], [22, 23], [31, 21], [21, 31], [33, 30], [19, 41], [33, 41], [23, 38], [29, 38]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x * 3 + y) % 4 }));
    K.scatter(g, O, ['rock_small', 'mushroom_glow'], 8, [1, 1, 50, 46], 'r', 'e2rk', { gap: 4, variant: true, keep: new Set(['26,38', '27,38', '26,37', '27,37']) });

    const N = [
      K.npc('elm', 'elm', 26, 42, { name: '森の主エルム', dir: 's', talk: 'elder_elm', cond: 'forest_boss', pushable: false, reward: 'news' }),
    ];

    K.def('elder_2', {
      name: '千年樹', kind: 'dungeon', region: 'r_forest', location: 'elder', theme: 'tree_inside',
      legend: {
        B: { mat: 'wall_bark', solid: true, rise: 1 },
        '.': { mat: 'bark_floor' },
        r: { mat: 'root_floor' },
        R: { mat: 'roots', solid: true },
        G: { mat: 'roots', solid: true, name: 'root_gate' },
        '~': { mat: 'water', walk: false },
      },
      rows: g, outside: 'wall_bark',
      // 描いた一枚絵（design/ENV_ASSETS.md §8）。根の戸は closed の絵（閉じている間だけ上に置く）
      art: { image: 'tree_inside/under/elder_2', closed: 'tree_inside/under/elder_2_closed', painted: [] },
      objects: O, npcs: N,
      spawns: {
        top: { x: 23, y: 6, dir: 's' },
        altar: { x: 26, y: 39, dir: 's' },
      },
      exits: [],
      triggers: [
        { id: 'pim_home', x: 22, y: 29, w: 9, h: 4, on: 'step', event: 'elder_pim_home', cond: { guest: 'npc_pim' } },
        { id: 'boss', x: 20, y: 37, w: 13, h: 2, on: 'step', event: 'elder_boss', cond: '!forest_boss' },
      ],
      tilePatches: [
        { cond: 'forest_sw2', rect: [26, 14, 2, 1], rows: ['rr'] },
      ],
      oneway: [{ x: 38, y: 26, dir: 'w' }, { x: 38, y: 27, dir: 'w' }, { x: 18, y: 30, dir: 'w' }, { x: 18, y: 31, dir: 'w' }],
      zones: [{ rect: [0, 0, 52, 36], zone: 'z_elder' }],
      light: { ambient: '#5e6e96', k: 0.57, mood: 'tree' },
      dark: false,
      bgm: 'eldertree', bbg: 'tree',
      meta: { chestsInfo: true, floor: '2 階', sub: '根の間' },
    });
  });
})(window.RPG);
