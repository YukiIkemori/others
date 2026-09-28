// CONTENT-F: 千年樹 1 階（elder_1）幹の中のらせん。V2_PLAN §3.2・WORLD_REDESIGN §4.1・§6
//   ダンジョン 52×48。南の入口（迷いの森 2 階のつるの先）→ らせん（東 → 北東 → 北の回廊を西へ → 北西 → 西 → 幹の芯）→ 根の間へ下る穴。
//   ピムの抜け穴（E7、by:'guest'）: 入口の広間の小さな穴 → 幹の芯への根の戸が開く（らせんを飛ばす近道）。
//   泉: 幹の芯（1 階の奥、根の間へ下る手前）。隠し通路: 西の回廊の壁 → レアの箱。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const W = 52, H = 48;
    const g = K.grid(W, H, 'B');

    // ---------------------------------------------------------------- 部屋（樹の床）と回廊
    K.blob(g, 26, 41, 7, 4, '.', 'e1a');          // E0 入口の広間
    K.rect(g, 24, 44, 4, 4, '.');
    K.blob(g, 42, 33, 6, 5, '.', 'e1b');          // E2 東の回廊
    K.blob(g, 42, 15, 6, 5, '.', 'e1c');          // E5 北東
    K.blob(g, 26, 6, 6, 3, '.', 'e1h');           // E7 北の回廊の間（古い刻み）
    K.blob(g, 10, 15, 6, 5, '.', 'e1d');          // E4 北西
    K.blob(g, 10, 33, 6, 5, '.', 'e1e');          // E1 西
    K.blob(g, 26, 24, 7, 4, '.', 'e1g');          // E6 幹の芯（泉・根の間へ下る穴）
    K.path(g, [[33, 41], [38, 41], [38, 38]], '.', 2);          // E0 → E2
    K.path(g, [[42, 28], [42, 20]], 'r', 2);                    // E2 → E5
    K.path(g, [[43, 10], [43, 5], [32, 5]], 'r', 2);            // E5 → E7（北の回廊）
    K.path(g, [[20, 6], [10, 6], [10, 10]], 'r', 2);            // E7 → E4
    K.path(g, [[10, 20], [10, 28]], 'r', 2);                    // E4 → E1
    K.path(g, [[16, 31], [19, 31], [19, 26]], '.', 2);          // E1 → E6
    // 入口の広間 → 幹の芯（根の戸。ピムの抜け穴で開く）
    K.path(g, [[26, 37], [26, 28]], 'r', 2);
    K.rect(g, 26, 33, 2, 1, 'G');                               //   根の戸（閉じた根）
    // 隠し通路（西の回廊の西の壁）→ 小部屋
    K.put(g, 4, 34, 'S'); K.put(g, 3, 34, 'S');
    K.rect(g, 1, 32, 2, 4, '.');
    K.put(g, 5, 34, '.');
    // 根ときのこのふち
    for (const [x, y] of [[20, 40], [32, 42], [46, 31], [37, 35], [47, 14], [37, 13], [5, 14], [15, 17], [6, 31], [14, 36], [21, 21], [32, 22], [22, 4], [30, 7]]) if (K.at(g, x, y) === '.') K.put(g, x, y, 'R');

    // ---------------------------------------------------------------- 物
    const O = [];
    O.push(K.prop('mushroom_glow', 6, 14), K.prop('rock_small', 7, 15));      // 西の広間の光るきのこ（泉は 2 階の根食らいの手前だけ。WORLD §6.2）
    O.push(K.stairs(23, 24, { map: 'elder_2', spawn: 'top' }, { id: 'elder_1_down', look: 'down' }));
    O.push({ type: 'switch', id: 'elder_1_sw1', x: 22, y: 38, flag: 'forest_sw1', look: 'hole', color: 'teal', by: 'guest' });
    
    O.push(K.chest('elder_1_c1', 46, 36, { pool: 'p_T' }));
    O.push(K.chest('elder_1_c2', 46, 12, { item: 'i_ether', n: 1 }));
    O.push(K.chest('elder_1_c3', 6, 12, { pool: 'p_T' }));
    O.push(K.chest('elder_1_c4', 1, 33, { pool: 'p_rare' }));               // 隠し通路の先
    O.push(K.chest('elder_1_c5', 30, 6, { gold: 160 }));
    O.push(K.sign(28, 44, '――千年樹。\n森の主の眠る木。根を踏むべからず。'));
    O.push(K.exam(26, 4, 'elder_carving'));                                  // 幹の内側の古い刻み
    O.push(K.prop('crystal', 25, 4));
    for (const [x, y] of [[21, 42], [31, 40], [38, 30], [46, 17], [38, 12], [14, 12], [6, 18], [14, 30], [6, 35], [21, 25], [31, 26], [22, 7], [31, 8]]) O.push(K.prop('mushroom_glow', x, y, { variant: (x + y) % 4 }));
    for (const [x, y] of [[24, 44], [29, 44]]) O.push(K.prop('torch', x, y, { on: true }));
    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (K.at(g, x, y) === 'r') keep.add(x + ',' + y);
    K.scatter(g, O, ['rock_small', 'mushroom_glow'], 10, [1, 1, 50, 46], '.', 'e1rk', { keep, gap: 4, variant: true });

    const N = [
      K.npc('fine', 'fine', 26, 38, { name: 'フィーネ', dir: 'n', talk: 'elder_fine', cond: ['!forest_fine', '!cleared_r_forest'], pushable: false }),
    ];

    K.def('elder_1', {
      name: '千年樹', kind: 'dungeon', region: 'r_forest', location: 'elder', theme: 'tree_inside',
      legend: {
        B: { mat: 'wall_bark', solid: true, rise: 1 },
        '.': { mat: 'bark_floor' },
        r: { mat: 'root_floor' },
        R: { mat: 'roots', solid: true },
        G: { mat: 'roots', solid: true, name: 'root_gate' },
        '~': { mat: 'water', walk: false },
        S: { mat: 'wall_bark', solid: true, secret: true, floor: 'bark_floor' },
      },
      rows: g, outside: 'wall_bark',
      // 描いた一枚絵（design/ENV_ASSETS.md §8）。根の戸・隠し通路は closed の絵（閉じている間だけ上に置く）
      art: { image: 'tree_inside/under/elder_1', closed: 'tree_inside/under/elder_1_closed', painted: [] },
      objects: O, npcs: N,
      spawns: {
        south: { x: 25, y: 45, dir: 'n' },
        up: { x: 24, y: 25, dir: 'e' },
      },
      exits: [
        { x: 24, y: 47, w: 4, h: 1, to: { map: 'verda_2', spawn: 'north' } },
      ],
      triggers: [
        { id: 'fine', x: 23, y: 40, w: 7, h: 3, on: 'step', event: 'elder_fine', cond: ['!forest_fine', '!cleared_r_forest'], once: true },
      ],
      tilePatches: [
        { cond: 'forest_sw1', rect: [26, 33, 2, 1], rows: ['rr'] },
      ],
      zones: [{ rect: null, zone: 'z_elder' }],
      light: { ambient: '#60709a', k: 0.57, mood: 'tree' },
      dark: false,
      bgm: 'eldertree', bbg: 'tree',
      meta: { chestsInfo: true, floor: '1 階', sub: '幹の中のらせん' },
    });
  });
})(window.RPG);
