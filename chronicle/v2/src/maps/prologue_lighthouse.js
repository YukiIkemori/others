// CONTENT-P: ファロス灯台（lighthouse_1〜3、ダンジョン。今の大きさ）。V2_PLAN §3.2・§3.3 P8・P9、WORLD_REDESIGN §6.2・§6.5、STORY_BIBLE §9.1
//   lighthouse_1（36×32）岬と倉庫。塔の扉は灯台の鍵（prologue_key）で開ける（lighthouse_1_door、扉の物）。入ってすぐでチュートリアル（P8）。
//                        泉は 1 階の中ほど（新）。宝箱 3。階段は北東。
//   lighthouse_2（34×30）らせん。三重の輪を、仕切りのせいで遠回りして上る。南の回廊のつき当たりの、戸口をふさいだ崩れかけの壁
//                        （隠し通路）の先が昔の物置で、レアの箱。
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
      '.': { mat: 'wood_floor' },
      ',': { mat: 'grass' },
      o: { mat: 'flowers' },
      r: { mat: 'rock', solid: true, rise: 1 },
      '~': { mat: 'sea', walk: false },
      c: { mat: 'carpet' },
      S: { mat: 'wall_stone', solid: true, rise: 2, secret: true, floor: 'wood_floor' },
    };

    // ================================================================ 1 階（36×32）
    (function () {
      const W = 36, H = 32, g = K.grid(W, H, '~');
      // 岬（草地と岩）
      blob(g, 18, 26, 15, 6, ',', 'lh1_cape');
      rect(g, 6, 22, 24, 6, ',');
      rect(g, 15, 27, 6, 5, ',');
      blob(g, 7, 26, 2, 2, 'o', 'lh1_fl1', [',']); blob(g, 28, 27, 2, 1, 'o', 'lh1_fl2', [',']);
      const capeRocks = [[4, 25], [5, 28], [31, 24], [30, 28], [9, 30], [26, 30], [3, 27]];
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
      // 塔の扉（外の壁 y 21〜22 の x 17〜18）。壁はそのまま、扉の絵（2 マス幅の大きな 1 枚）を y 22 に。
      //   鍵を開けるまで: 閉じた扉（押すと「鍵がかかっている」。灯台の鍵があれば鍵を開ける場面 lighthouse_1_door）。
      //   開けた後（prologue_lh_door。前のセーブはチュートリアルの後なら開いている）: 押すと入口の間へ入る扉。内（y 21）から押すと岬へ出る。
      const LH_OPEN = { any: ['prologue_lh_door', 'prologue_tutorial'] };
      const tilePatches = [];
      const objects = [
        // 北西の部屋の荷（泉は置かない。灯台の泉は 3 階のボスの前の 1 つだけ。WORLD §6.2）
        P('sack', 10, 6), P('rock_small', 11, 7),
        K.stairs(28, 4, { map: 'lighthouse_2', spawn: 'from_prev' }), P('stairs_up', 28, 4),
        K.chest('lh1_c1', 7, 19, { item: 'i_salve', n: 3 }),
        K.chest('lh1_c2', 7, 4, { gold: 60 }),
        K.chest('lh1_c3', 28, 19, { pool: 'p_T' }),
        // 倉庫の荷。通れない樽・木箱は壁ぎわ・角の 4 つだけ（持ち主 2026-09-28「灯台の絵は書き直しといて」。
        //   床の真ん中の木箱の山・樽は下絵から消した。前の遠回りの壁代わりの山は無し）
        ...PS('crate', [[24, 15], [25, 15]]),
        ...PS('barrel', [[22, 3], [6, 16]]),
        ...PS('sack', [[9, 3], [15, 3], [18, 10], [24, 18], [11, 14]]),
        ...PS('lantern', [[6, 3], [16, 3], [18, 3], [29, 3], [6, 13], [22, 14], [13, 14], [29, 13]]),
        P('bookshelf', 20, 3), P('bookshelf', 21, 3), P('table', 25, 10), P('chair', 24, 10), P('net', 20, 19),
        // 岬
        ...PS('lamp_post', [[16, 23], [19, 23]]), P('bollard', 11, 29), P('bollard', 24, 29),
        ...PS('rock_small', [[8, 23], [28, 23], [12, 27], [23, 26]]), ...PS('rock', capeRocks.filter(([x, y]) => g[y][x] === ',')), P('stump', 6, 24),
        K.sign(21, 25, 'ファロス灯台\n灯台守のほか、立ち入りを禁ず。'),
        { type: 'door', id: 'lh1_door', x: 17, y: 22, w: 2, scale: 1.55, locked: '扉には、鍵がかかっている', unlock: { cond: 'prologue_key', event: 'lighthouse_1_door' } },
        { type: 'door', id: 'lh1_door_w', x: 17, y: 22, look: 'none', cond: LH_OPEN, to: { map: 'lighthouse_1', spawn: 'hall_w' } },
        { type: 'door', id: 'lh1_door_e', x: 18, y: 22, look: 'none', cond: LH_OPEN, to: { map: 'lighthouse_1', spawn: 'hall_e' } },
        { type: 'door', id: 'lh1_door_out_w', x: 17, y: 21, look: 'none', to: { map: 'lighthouse_1', spawn: 'door_w' } },
        { type: 'door', id: 'lh1_door_out_e', x: 18, y: 21, look: 'none', to: { map: 'lighthouse_1', spawn: 'door_e' } },
        K.exam(17, 22, 'lighthouse_1_door', { cond: { not: LH_OPEN } }),
        K.exam(18, 22, 'lighthouse_1_door', { cond: { not: LH_OPEN } }),
      ];
      const npcs = [
        { id: 'otto', look: 'otto', name: 'オットー', title: '灯台守', x: 15, y: 18, dir: 'e', move: 'still', pushable: false, cond: ['prologue_key', '!prologue_tutorial'], talk: 'lighthouse_1_tutorial' },
      ];
      K.def('lighthouse_1', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'sea', objects, npcs, tilePatches,
        art: { image: 'lighthouse/under/lighthouse_1', painted: ['sack@9,3', 'sack@15,3', 'bookshelf@20,3', 'bookshelf@21,3', 'barrel@22,3', 'sack@10,6', 'rock_small@11,7', 'sack@18,10', 'chair@24,10', 'table@25,10', 'sack@11,14', 'crate@24,15', 'crate@25,15', 'barrel@6,16', 'sack@24,18', 'net@20,19', 'rock_small@8,23', 'rock_small@28,23', 'stump@6,24', 'rock@31,24', 'rock_small@23,26', 'rock_small@12,27', 'rock@30,28', 'bollard@11,29', 'bollard@24,29', 'rock@9,30', 'rock@26,30'] },   // 描いた一枚絵（design/ENV_ASSETS.md §8）
        spawns: {
          entrance: { x: 17, y: 29, dir: 'n' }, from_next: { x: 27, y: 4, dir: 'w' },
          hall_w: { x: 17, y: 20, dir: 'n' }, hall_e: { x: 18, y: 20, dir: 'n' }, door_w: { x: 17, y: 23, dir: 's' }, door_e: { x: 18, y: 23, dir: 's' },
        },
        exits: [{ x: 15, y: 31, w: 6, h: 1, to: { map: 'world', spawn: 'lighthouse' } }],
        // 扉から入ると y 20 に立つ。そこから 1 歩で（y 18〜19）
        triggers: [{ id: 'tutorial', x: 16, y: 18, w: 4, h: 2, on: 'step', event: 'lighthouse_1_tutorial', cond: ['prologue_key', '!prologue_tutorial'] }],
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
      // 南の回廊の東の端は昔の物置（x 19〜23・y 24〜27。東は入口側の仕切り x 24〜25）。戸口を石でふさいだ壁 x 18 が
      // 崩れかけていて、真ん中の 1 マスが抜けられる（隠し通路）。回廊のつき当たりに崩れた石と、すきま風の調べる所
      vline(g, 18, 24, 27, '#');
      put(g, 18, 25, 'S');
      const objects = [
        K.stairs(29, 26, { map: 'lighthouse_1', spawn: 'from_next' }), P('stairs_down', 29, 26),
        K.stairs(16, 16, { map: 'lighthouse_3', spawn: 'from_prev' }), P('stairs_up', 16, 16),
        P('sack', 14, 6), P('rock_small', 15, 7),   // 2 階の北の回廊の荷（泉は 3 階のボスの前だけ）
        K.chest('lh2_c1', 3, 26, { pool: 'p_T' }),
        K.chest('lh2_c2', 25, 17, { item: 'i_ether', n: 1 }),
        K.chest('lh2_c3', 22, 24, { pool: 'p_rare', item: 'i_ether', n: 2 }),    // 序盤なので中身は固定（持ち主 2026-09-28「早い時期のレアは強すぎ」）。隠し通路の先（ふさいだ物置）のレアの箱（V2_PLAN §3.7）
        K.chest('lh2_c4', 23, 27, { gold: 120 }),
        ...PS('lantern', [[2, 5], [31, 5], [2, 27], [31, 27], [8, 11], [25, 11], [8, 21], [25, 21], [16, 5], [16, 27], [13, 15], [20, 15]]),
        // 通れない樽・木箱は北の回廊の壁ぎわの 3 つと物置の 1 つだけ（持ち主 2026-09-28「通路真ん中にはおかないで」「灯台の絵は書き直しといて」。
        //   輪の回廊の木箱・樽は下絵から消した）
        ...PS('crate', [[5, 5], [6, 5]]),
        P('barrel', 14, 5),
        ...PS('sack', [[7, 26], [28, 7], [10, 20], [22, 12]]),
        P('bookshelf', 20, 5), P('bookshelf', 21, 5), P('table', 18, 21), P('rock_small', 5, 20), P('net', 3, 8),
        // 物置の中（見つけるまで描かない）と、つき当たりの崩れた石・すきま風
        P('crate', 23, 24), P('sack', 19, 27),
        P('rock_small', 17, 24), K.exam(17, 25, 'field_secret_hint', { text: '石でふさいだ古い戸口だ。\n目地が崩れて、すきま風が\n抜けてくる……。' }),
      ];
      K.def('lighthouse_2', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'wall_stone', objects,
        // 描いた一枚絵（ENV_ASSETS.md §8）。ふさいだ物置は closed の絵で、見つけるまで石の壁のまま
        art: { image: 'lighthouse/under/lighthouse_2', closed: 'lighthouse/under/lighthouse_2_closed', painted: ['crate@5,5', 'crate@6,5', 'barrel@14,5', 'bookshelf@20,5', 'bookshelf@21,5', 'sack@14,6', 'rock_small@15,7', 'sack@28,7', 'net@3,8', 'sack@22,12', 'rock_small@5,20', 'sack@10,20'] },
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
        K.spring('lh3_s1', 7, 14),                          // ボスの前の泉（灯台でただ 1 つ。WORLD §6.2）
        K.chest('lh3_c1', 17, 14, { item: 'i_salve', n: 2 }),
        K.chest('lh3_c2', 17, 18, { pool: 'p_T' }),
        P('beacon', 12, 5, { cond: 'prologue_boss' }),     // 灯室の大きな灯（ともった後）
        P('brazier', 12, 5, { cond: '!prologue_boss' }),   // 消えた灯（仮の見た目はしょく台）
        ...PS('lantern', [[6, 13], [18, 13], [6, 19], [18, 19], [5, 7], [20, 7]]),
        P('crate', 15, 19), P('barrel', 9, 19), P('sack', 18, 16), P('bookshelf', 8, 13),   // 16,19 の木箱は下絵から消した（宝箱 17,18 の前をふさがない）
        ...PS('rock_small', [[7, 4], [17, 10]]),
        K.exam(12, 6, 'lighthouse_3_lamp'),
      ];
      const npcs = [
        { id: 'fine', look: 'fine', name: '灰色のマントの少女', x: 12, y: 13, dir: 's', move: 'still', pushable: false, cond: '!prologue_fine', talk: 'lighthouse_3_fine' },
      ];
      K.def('lighthouse_3', Object.assign({}, BASE, {
        name: 'ファロス灯台', legend: LEG, rows: g, outside: 'wall_stone', objects, npcs,
        art: { image: 'lighthouse/under/lighthouse_3', painted: ['rock_small@7,4', 'rock_small@17,10', 'bookshelf@8,13', 'sack@18,16', 'barrel@9,19', 'crate@15,19'] },   // 描いた一枚絵（ENV_ASSETS.md §8）
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
