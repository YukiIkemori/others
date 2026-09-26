// CONTENT-P: ファロス灯台（lighthouse_1〜3、ダンジョン。今の大きさ）。V2_PLAN §3.2・§3.3 P8・P9、WORLD_REDESIGN §6.2・§6.5、STORY_BIBLE §9.1
//   lighthouse_1（36×32）岬と倉庫。塔の扉は灯台の鍵（prologue_key）までは閉じている（tilePatch）。入ってすぐでチュートリアル（P8）。
//                        泉は 1 階の中ほど（新）。宝箱 3。階段は北東。
//   lighthouse_2（34×30）らせん。三重の輪を、仕切りのせいで遠回りして上る。泉は中の輪。北東の壁のひび（隠し通路）の先の小部屋にレアの箱。
//   lighthouse_3（26×22）灯室。手前の間に泉と灰色のマントの少女（P9）、奥の丸い灯室でページ食らい → 灯がともる。
//   出現 z_lighthouse（1・2 階）。BGM tower、戦闘背景 tower。脱出 → ワールドの灯台の岬（lighthouse_1 の外への出口）。
//   spawns: lighthouse_1.entrance（岬、ワールドから）・from_next（2 階から下りた所）
//           lighthouse_2.from_prev（1 階から上った所）・from_next / lighthouse_3.from_prev
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const { rect, put, hline, vline, blob } = K;
    const P = K.prop, PS = K.props;
    const BASE = { kind: 'dungeon', region: 'prologue', location: 'lighthouse', theme: 'lighthouse', bgm: 'tower', bbg: 'tower', light: { ambient: '#56608a', k: 0.6, mood: 'tower' }, meta: { chestsInfo: true } };
    const LEG = {
      '#': { mat: 'wall_stone', solid: true, rise: 2 },
      '.': { mat: 'stone_floor' },
      ',': { mat: 'grass' },
      o: { mat: 'flowers' },
      r: { mat: 'rock', solid: true, rise: 1 },
      '~': { mat: 'sea', walk: false },
      c: { mat: 'carpet' },
      S: { mat: 'wall_stone', solid: true, rise: 2, secret: true, floor: 'stone_floor' },
    };

    // ================================================================ 1 階（36×32）
    (function () {
      const W = 36, H = 32, g = K.grid(W, H, '~');
      // 岬（草地と岩）
      blob(g, 18, 26, 15, 6, ',', 'lh1_cape');
      rect(g, 6, 22, 24, 6, ',');
      rect(g, 15, 27, 6, 5, ',');
      blob(g, 7, 26, 2, 2, 'o', 'lh1_fl1', [',']); blob(g, 28, 27, 2, 1, 'o', 'lh1_fl2', [',']);
      for (const [x, y] of [[4, 25], [5, 28], [31, 24], [30, 28], [9, 30], [26, 30], [3, 27]]) put(g, x, y, 'r');
      // 塔（外の壁 2 マス、上は 3 マス）
      rect(g, 4, 0, 28, 23, '#');
      rect(g, 6, 3, 24, 18, '.');
      // 仕切り: 入口の間（x 13〜22・y 14〜20）、南西の部屋、北西、北東、南東（脇の部屋）
      vline(g, 12, 13, 20, '#'); vline(g, 23, 13, 20, '#'); hline(g, 6, 29, 12, '#'); hline(g, 12, 23, 13, '#');
      vline(g, 17, 3, 11, '#');
      put(g, 12, 17, '.'); put(g, 12, 18, '.');       // 入口の間 → 南西
      put(g, 8, 12, '.'); put(g, 9, 12, '.');         // 南西 → 北西
      put(g, 17, 5, '.'); put(g, 17, 6, '.');         // 北西 → 北東
      put(g, 26, 12, '.'); put(g, 27, 12, '.');       // 北東 → 南東（脇の部屋）
      rect(g, 16, 6, 1, 1, '.');
      rect(g, 13, 4, 3, 2, 'c'); rect(g, 19, 16, 2, 3, 'c');
      // 扉（鍵までは壁。tilePatch で開く）
      const tilePatches = [{ cond: 'prologue_key', rect: [17, 21, 2, 2], rows: ['..', '..'] }];
      const objects = [
        // 1 階の中ほどの泉（北西の部屋。WORLD §6.5「1 階の中ほどを足す」）
        K.spring('lh1_s1', 10, 6),
        K.stairs(28, 4, { map: 'lighthouse_2', spawn: 'from_prev' }), P('stairs_up', 28, 4),
        K.chest('lh1_c1', 7, 19, { item: 'i_salve', n: 3 }),
        K.chest('lh1_c2', 7, 4, { gold: 60 }),
        K.chest('lh1_c3', 28, 19, { pool: 'p_T' }),
        // 倉庫の荷（遠回りの壁代わりの木箱の山は solid）
        ...PS('crate', [[14, 7], [14, 8], [15, 8], [20, 8], [21, 8], [20, 9], [25, 6], [25, 7], [7, 14], [8, 14], [10, 19], [11, 19], [24, 15], [25, 15], [27, 16]]),
        ...PS('barrel', [[6, 9], [7, 9], [16, 10], [22, 3], [29, 7], [6, 16], [29, 14], [13, 19]]),
        ...PS('sack', [[9, 3], [15, 3], [18, 10], [24, 18], [11, 14]]),
        ...PS('lantern', [[6, 3], [16, 3], [18, 3], [29, 3], [6, 13], [22, 14], [13, 14], [29, 13]]),
        P('bookshelf', 20, 3), P('bookshelf', 21, 3), P('table', 25, 10), P('chair', 24, 10), P('net', 20, 19),
        // 岬
        ...PS('lamp_post', [[15, 23], [20, 23]]), P('bollard', 11, 29), P('bollard', 24, 29),
        ...PS('rock_small', [[8, 23], [28, 23], [12, 27], [23, 26]]), P('stump', 6, 24), P('log', 29, 25),
        K.sign(21, 25, 'ファロス灯台\n灯台守のほか、立ち入りを禁ず。'),
        K.exam(17, 22, 'lighthouse_1_door', { cond: '!prologue_key' }),
        K.exam(18, 22, 'lighthouse_1_door', { cond: '!prologue_key' }),
      ];
      const npcs = [
        { id: 'otto', look: 'otto', name: 'オットー', title: '灯台守', x: 15, y: 18, dir: 'e', move: 'still', pushable: false, cond: ['prologue_key', '!prologue_tutorial'], talk: 'lighthouse_1_tutorial' },
      ];
      K.def('lighthouse_1', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'sea', objects, npcs, tilePatches,
        spawns: { entrance: { x: 17, y: 29, dir: 'n' }, from_next: { x: 27, y: 4, dir: 'w' } },
        exits: [{ x: 15, y: 31, w: 6, h: 1, to: { map: 'world', spawn: 'lighthouse' } }],
        triggers: [{ id: 'tutorial', x: 16, y: 19, w: 4, h: 2, on: 'step', event: 'lighthouse_1_tutorial', cond: ['prologue_key', '!prologue_tutorial'] }],
        zones: [{ rect: [6, 3, 24, 18], zone: 'z_lighthouse' }],
        meta: { chestsInfo: true, floor: '1階', sub: '岬の倉庫' },
      }));
    })();

    // ================================================================ 2 階（34×30、らせん）
    (function () {
      const W = 34, H = 30, g = K.grid(W, H, '#');
      rect(g, 2, 5, 30, 23, '.');                          // 外の輪
      rect(g, 6, 9, 22, 15, '#');                          // 中の輪の壁（厚さ 2）
      rect(g, 8, 11, 18, 11, '.');                         // 中の輪
      rect(g, 12, 14, 10, 5, '#');                         // まん中の壁
      rect(g, 13, 15, 8, 3, '.');                          // まん中の間（灯室への階段）
      // 外の輪: 入ってすぐ西を仕切る → 北回りで 3/4 周して、南西の口から中の輪へ
      rect(g, 24, 24, 2, 4, '#');
      rect(g, 8, 22, 2, 2, '.');
      // 中の輪: 入ってすぐ東を仕切る → 北回りで南の口からまん中へ
      rect(g, 11, 19, 1, 3, '#');
      rect(g, 16, 18, 2, 1, '.');
      // 北東の隠し部屋（外の壁の中）と、ひびの壁（隠し通路）
      rect(g, 24, 1, 5, 3, '.');
      put(g, 26, 4, 'S');
      const objects = [
        K.stairs(29, 26, { map: 'lighthouse_1', spawn: 'from_next' }), P('stairs_down', 29, 26),
        K.stairs(16, 16, { map: 'lighthouse_3', spawn: 'from_prev' }), P('stairs_up', 16, 16),
        K.spring('lh2_s1', 15, 11),
        K.chest('lh2_c1', 3, 26, { pool: 'p_T' }),
        K.chest('lh2_c2', 25, 17, { item: 'i_ether', n: 1 }),
        K.chest('lh2_c3', 25, 2, { pool: 'p_rare' }),     // 隠し通路の先のレアの箱（V2_PLAN §3.7）
        K.chest('lh2_c4', 27, 2, { gold: 120 }),
        ...PS('lantern', [[2, 5], [31, 5], [2, 27], [31, 27], [8, 11], [25, 11], [8, 21], [25, 21], [16, 5], [16, 27], [13, 15], [20, 15]]),
        ...PS('crate', [[5, 5], [6, 5], [30, 10], [30, 11], [3, 15], [4, 15], [20, 26], [21, 26], [21, 20], [22, 20]]),
        ...PS('barrel', [[2, 12], [31, 16], [9, 26], [14, 5], [19, 12], [25, 14]]),
        ...PS('sack', [[7, 26], [28, 7], [10, 20], [22, 12]]),
        P('bookshelf', 20, 5), P('bookshelf', 21, 5), P('table', 18, 21), P('rock_small', 5, 20), P('net', 3, 8),
        P('crate', 25, 1), P('lantern', 24, 1), P('lantern', 28, 1),
      ];
      K.def('lighthouse_2', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'wall_stone', objects,
        spawns: { from_prev: { x: 28, y: 26, dir: 'n' }, from_next: { x: 17, y: 16, dir: 's' } },
        zones: [{ rect: null, zone: 'z_lighthouse' }],
        meta: { chestsInfo: true, floor: '2階', sub: 'らせん階段' },
      }));
    })();

    // ================================================================ 3 階（26×22、灯室）
    (function () {
      const W = 26, H = 22, g = K.grid(W, H, '#');
      blob(g, 12, 7, 9, 5, '.', 'lh3_lamp');                // 丸い灯室
      rect(g, 6, 13, 13, 7, '.');                           // 手前の間
      rect(g, 11, 11, 4, 2, '.');                           // 灯室への口
      rect(g, 10, 5, 5, 4, 'c');                            // 大きな灯の台（敷物）
      const objects = [
        K.stairs(12, 19, { map: 'lighthouse_2', spawn: 'from_next' }), P('stairs_down', 12, 19),
        K.spring('lh3_s1', 7, 14),                          // ボスの前の泉
        K.chest('lh3_c1', 17, 14, { item: 'i_salve', n: 2 }),
        K.chest('lh3_c2', 17, 18, { pool: 'p_T' }),
        P('beacon', 12, 5, { cond: 'prologue_boss' }),     // 灯室の大きな灯（ともった後）
        P('brazier', 12, 5, { cond: '!prologue_boss' }),   // 消えた灯（仮の見た目は燭台）
        ...PS('lantern', [[6, 13], [18, 13], [6, 19], [18, 19], [5, 7], [20, 7]]),
        ...PS('crate', [[15, 19], [16, 19]]), P('barrel', 9, 19), P('sack', 18, 16), P('bookshelf', 8, 13),
        ...PS('rock_small', [[7, 4], [17, 10]]),
        K.exam(12, 6, 'lighthouse_3_lamp'),
      ];
      const npcs = [
        { id: 'fine', look: 'fine', name: '灰色のマントの少女', x: 12, y: 13, dir: 's', move: 'still', pushable: false, cond: '!prologue_fine', talk: 'lighthouse_3_fine' },
      ];
      K.def('lighthouse_3', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'wall_stone', objects, npcs,
        spawns: { from_prev: { x: 12, y: 18, dir: 'n' }, lamp: { x: 12, y: 9, dir: 'n' } },
        triggers: [
          { id: 'fine', x: 10, y: 16, w: 6, h: 1, on: 'step', event: 'lighthouse_3_fine', cond: '!prologue_fine' },
          { id: 'boss', x: 9, y: 9, w: 7, h: 2, on: 'step', event: 'lighthouse_3_boss', cond: '!prologue_boss' },
        ],
        meta: { chestsInfo: true, floor: '3階', sub: '灯室' },
      }));
    })();
  });
})(window.RPG);
