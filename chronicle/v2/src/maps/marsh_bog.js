// CONTENT（湿原）: 鐘沈みの沼（marsh_bog、1 階 60×52）。WORLD_REDESIGN §4.4 の 4・§6.4（水位）・§6.5、STORY_BIBLE §7.4、v1 region4_marsh.js。
//   南の入口の泥炭の岸 → 板の道 → 分かれ道の小島 → 西の鐘（1）・東の鐘（2）。
//   鐘は沈んだ鐘楼の頭。メルダの鐘の鍵（k_bell_key）で鳴らすと、あたりの水が引く（水位、tilePatches）:
//     西と東の鐘を鳴らす → 西の小島から北へ泥の道が現れる → 北の鐘（3）→ 北の鐘を鳴らす → 沼のまん中の小島への泥の道が現れる。
//   まん中の小島に霧が集まり、霧食らい（tr_b_mistbeast）。そのあと、南の小さな島で眠っていた子どもたちが見つかる（marsh_finale）。
//   泉は置かない（沼は 1 階。WORLD §6.2）。隠し通路なし。
//   下絵（v2/assets/env/forest_dungeon/under/bog*）は水の引いた形（tilePatches を全部当てた開いた形）で描き、閉じている間は bog_closed の絵（水のある形）をそのマスに置く（art.closed・meta.live）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Marsh.kit;
    const W = 60, H = 52;
    const g = K.grid(W, H, '~');
    const ell = (cx, cy, rx, ry, ch, only) => {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const wob = (((x * 17 + y * 31) % 7) / 7 - 0.5) * 0.25;
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + wob && (!only || only.includes(K.at(g, x, y)))) K.put(g, x, y, ch);
      }
    };
    // ---------------------------------------------------------------- まわり: 葦原と枯れ木の林（通れない）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      const wob = ((x * 11 + y * 7) % 6) / 6;
      if (d <= 1 || (d === 2 && wob > 0.4) || (d === 3 && wob > 0.8)) g[y][x] = d <= 1 && wob > 0.5 ? 'T' : 'r';
    }
    // 深みの淵（深い水）
    ell(30, 27, 6, 3.2, '=');
    ell(18, 18, 4, 3, '='); ell(44, 16, 5, 3, '='); ell(46, 44, 4, 2.5, '=');
    // ---------------------------------------------------------------- 小島（泥炭）
    ell(30, 46, 7, 3.6, 'g');          // 南の入口の岸
    K.rect(g, 28, 49, 4, 3, 'g');
    ell(30, 35, 4.2, 2.2, 'g');        // 分かれ道の小島
    ell(10, 29, 5, 4, 'g');            // 西の鐘の小島
    ell(50, 29, 5, 4, 'g');            // 東の鐘の小島
    ell(30, 9, 6, 4, 'g');             // 北の鐘の小島
    ell(30, 20, 5, 3.4, 'g');          // まん中の小島（霧の集まる所）
    ell(19, 42, 3, 2, 'g'); ell(42, 42, 3, 2, 'g');   // 宝箱の小島
    ell(48, 11, 3, 2, 'g');            // 北東の小島（北の鐘の小島から）
    ell(38, 47, 2.4, 1.6, 'g');        // 子どもたちの眠っていた小島（南東）
    ell(7, 16, 1.6, 1.3, 'g');         // 泥の道の脇の小さな岸（宝箱）
    // 枯れ木（小島の縁）
    for (const [x, y] of [[6, 27], [14, 32], [54, 27], [46, 32], [25, 7], [35, 11], [26, 47], [16, 42], [45, 41]]) if (K.at(g, x, y) === 'g') K.put(g, x, y, 'T');
    // ---------------------------------------------------------------- 板の道（幅 2）
    const walk = (pts, wd, ch) => K.path(g, pts, ch || 'p', wd || 2, ['~', 'r', 'g', '=']);
    walk([[29, 43], [29, 37]]);                                   // 入口 → 分かれ道
    walk([[26, 35], [22, 35], [22, 33], [15, 33], [15, 31]]);     // → 西の鐘
    walk([[33, 35], [38, 35], [38, 33], [45, 33], [45, 31]]);     // → 東の鐘
    walk([[25, 44], [21, 44], [21, 43]]);                         // → 西の宝箱の小島
    walk([[34, 44], [40, 44], [40, 43]]);                         // → 東の宝箱の小島
    walk([[35, 47], [36, 47]]);                                   // → 子どもたちの小島（いつでも渡れる）
    // 水が引くと現れる泥の道（tilePatches で閉じる。下絵は開いた形）
    const A = [[9, 25], [9, 14], [14, 14], [14, 10], [24, 10]];  // 西の小島 → 北の鐘（西と東の鐘を鳴らした後）
    const B = [[29, 13], [29, 17]];                               // 北の鐘の小島 → まん中の小島（北の鐘を鳴らした後）
    const before = g.map((r) => r.slice());
    walk(A, 2, 'm');
    walk(B, 2, 'm');
    walk([[34, 9], [46, 9], [46, 10]]);                           // 北の鐘の小島 → 北東の小島（板の道）
    const patchOf = (pts) => {
      const cells = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'm' && before[y][x] !== 'm' && onPath(pts, x, y)) cells.push([x, y, before[y][x]]);
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      const rows = [];
      for (let y = y0; y <= y1; y++) { let s = ''; for (let x = x0; x <= x1; x++) { const c = cells.find((q) => q[0] === x && q[1] === y); s += c ? 'm' : ' '; } rows.push(s); }
      return { rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], rows, cells: cells.map((c) => [c[0], c[1]]) };
    };
    function onPath(pts, x, y) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        if (x >= Math.min(ax, bx) && x <= Math.max(ax, bx) + 1 && y >= Math.min(ay, by) && y <= Math.max(ay, by) + 1) return true;
      }
      return false;
    }
    const pA = patchOf(A), pB = patchOf(B);
    // 地面は水のある形（閉じた形）。泥の道は鐘を鳴らした後の tilePatches で現れる（下絵は開いた形。ENV_ASSETS.md §8 の決まり）
    for (const [x, y] of pA.cells.concat(pB.cells)) g[y][x] = before[y][x] === 'g' ? '~' : before[y][x];

    const O = [];
    // 3 つの鐘（沈んだ鐘楼の頭。鐘の枠の描いた物と、鳴らす所）
    const BELLS = [[1, 9, 27], [2, 51, 27], [3, 30, 6]];
    for (const [n, x, y] of BELLS) O.push(K.prop('bell_frame', x, y), K.exam(x, y, 'bog_bell', { bell: n }));
    // 鐘の歌の石碑（沼の中の方。入口の外の石碑と同じ歌の、削れていない写し）
    O.push(K.prop('grave_moss', 33, 7), K.exam(33, 7, 'bog_stone'));
    // 宝箱（見える所）
    O.push(K.chest('bog_c1', 19, 41, { pool: 'p_T' }), K.chest('bog_c2', 42, 41, { item: 'i_ether', n: 2 }), K.chest('bog_c3', 49, 11, { pool: 'p_rare' }),
      K.chest('bog_c4', 7, 31, { pool: 'p_T' }), K.chest('bog_c5', 53, 31, { gold: 380 }), K.chest('bog_c6', 7, 16, { item: 'i_panacea', n: 2 }));
    // 鬼火の灯（入口と、鐘の小島。道には置かない）
    for (const [x, y] of [[22, 46], [41, 46], [26, 37], [34, 37], [12, 26], [48, 26], [27, 8]]) O.push(K.prop('wisp_lamp', x, y));
    // 霧の中心（まん中の小島）と、子どもたちの小島
    O.push(K.prop('pale_mushrooms', 32, 19), K.prop('pale_mushrooms', 27, 21));
    O.push(K.sign(31, 43, '鐘沈みの沼\n――鐘の鳴る所、霧は沈む。'));

    K.def('marsh_bog', {
      name: '鐘沈みの沼', kind: 'dungeon', region: 'r_marsh', location: 'bog', theme: 'forest_dungeon',
      legend: MK.BOG(), rows: g, outside: 'marsh_water',
      objects: O,
      npcs: [
        K.npc('bog_kid_a', 'npc_marsh_child', 38, 47, { name: '眠っていた子', dir: 'w', talk: 'bog_kids', reward: null, cond: ['marsh_mistbeast', '!marsh_finale_done'] }),
        K.npc('bog_kid_b', 'npc_marsh_child', 39, 47, { name: '眠っていた子', dir: 'w', talk: 'bog_kids', reward: null, cond: ['marsh_mistbeast', '!marsh_finale_done'] }),
      ],
      spawns: { entrance: { x: 29, y: 49, dir: 'n' }, center: { x: 30, y: 22, dir: 'n' } },
      exits: [{ x: 28, y: 51, w: 4, h: 1, to: { map: 'world', spawn: 'bog' } }],
      triggers: [
        { id: 'arrive', on: 'enter', event: 'bog_arrive', once: true },
        { id: 'mist', x: 26, y: 18, w: 9, h: 3, on: 'step', event: 'bog_mistbeast', cond: ['marsh_bell_3', '!marsh_mistbeast'] },
      ],
      tilePatches: [
        { cond: ['marsh_bell_1', 'marsh_bell_2'], rect: pA.rect, rows: pA.rows },
        { cond: 'marsh_bell_3', rect: pB.rect, rows: pB.rows },
      ],
      zones: [{ rect: [24, 16, 13, 8], zone: null }, { rect: [0, 0, 60, 52], zone: 'z_marsh_bog' }].filter((z) => z.zone),
      light: MK.LIGHT_BOG, dark: false,
      bgm: 'ghost', bbg: 'marsh',
      meta: { chestsInfo: true, floor: '沼', sub: '鐘の沈んだ沼', live: [{ cells: pA.cells, patch: 0 }, { cells: pB.cells, patch: 1 }] },
      art: { image: 'forest_dungeon/under/bog', closed: 'forest_dungeon/under/bog_closed', painted: [] },
    });
  });
})(window.RPG);
