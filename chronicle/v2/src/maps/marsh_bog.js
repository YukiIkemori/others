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
    // 当たり（2026-09-29 の描き直し: 岸・小島・淵・板の道・泥の道をなめらかな形にした下絵に合わせた行。design/art_ref/gen/env/_tools/under/marsh/bog2/ の
    //   layout.py（形）→ 絵 → prep.py（縦のずれ・水の色）→ refit.py（絵の水に合わせる）の rows_fit。手で直すときは refit.py の方で）
    //   '~' 沼の水・'=' 深みの淵・'g' 泥炭の小島・'p' 板の道・'r' 葦原・'T' 枯れ木。まわりは葦原と枯れ木の林（通れない）
    //   'A' = 西と東の鐘を鳴らすと現れる泥の道（西の小島 → 北の鐘）、'B' = 北の鐘を鳴らすと現れる泥の道（北の鐘の小島 → まん中の小島）
    const ROWS = [
      "rrrrrrTrrrrrrrrrrrTrrrTTTTTrrrrrTTTTTTrrTTTrrrTrrrrrTrrTTTTT",
      "rrTrrrrrrrrrrrrrrrTrrrrrTTTrrrrrTTTTTTrrTTTTrrrrrrrrrrrrTrTT",
      "rTrrrrrrr~r~~~~~~~~~rr~~~~rrr~~rrrrrrrrrrr~~rrrrrrrrrrrr~rrr",
      "rrr~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~rrr",
      "TTr~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~rrr",
      "Trr~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~rrT",
      "TTr~~~~~~~~~~~~~~~~~~~~~~~~ggggggg~~~~~~~~~~~~~~~~~~~~~~~~rr",
      "TTr~~~~~~~~~~~~~~~~~~~~~~Tgggggggggg~~~~~~~~~~~~~~~~~~~~~rrr",
      "TTT~~~~~~~~~~~~~~~~~~~~~ggggggggggggg~~~~~~~~~~~~~~~~~~~~rrr",
      "TT~~~~~~~~~~~~~~~~~~~~~~ggggggggggpppppppppppp~gg~~~~~~~~rrr",
      "TTr~~~~~~~~~~~~~~AAAAAAAAAAggggggggppppppppppppgggg~~~~~~rrr",
      "rrr~~~~~~~~~~~~AAAAAAAAAAAgggggggggT~~~~~~~~~ppggggg~~~~~rrr",
      "rrr~~~~~~~~~~~AAA~~~~~~~~~~gggggggg~~~~~~~~~~~ggggg~~~~~~rTT",
      "rrr~~~~~~~~~AAAA~~~~~~~~~~~~~BB~~~~~~~~~~~===~~~gg~~~~~~~rTT",
      "TT~~~~~~~~~AAA~~~~~~~~~~~~~~~BB~~~~~~~~~~=======~~~~~~~~~rrr",
      "TT~~~~ggg~AAA~~~~~~~~~~~~~~~~BB~~~~~~~~~=========~~~~~~~~rrr",
      "TT~~~~gggAAA~~~======~~~~~~~~BB~~~~~~~~~=========~~~~~~~~rrr",
      "rr~~~~gggAA~~~========~~~~~ggBBg~~~~~~~~=========~~~~~~~~~rr",
      "rr~~~~~~~AA~~~=========~~~ggggggggg~~~~~~=======~~~~~~~~~~Tr",
      "rr~~~~~~~AA~~~~=======~~~gggggggggg~~~~~~~====~~~~~~~~~~~rTT",
      "rr~~~~~~~AA~~~~~======~~~~gggggggggg~~~~~~~~~~~~~~~~~~~~~rrT",
      "rr~~~~~~~AA~~~~~~~~~~~~~~~gggggggggg~~~~~~~~~~~~~~~~~~~~~rTT",
      "rrr~~~~~~AA~~~~~~~~~~~~~~~~gggggggg~~~~~~~~~~~~~~~~~~~~~~rTr",
      "TTr~~~~~~AA~~~~~~~~~~~~~~~~~ggggg~~~~~~~~~~~~~~~~~~~~~~~~~Tr",
      "TTr~~~~~~AA~~~~~~~~~~~~~~~~~=====~~~~~~~~~~~~~~~~~~~~~~~~~Tr",
      "TTr~~~~~~AAgg~~~~~~~~~~~~==========~~~~~~~~~~~~~~~~~~~~~~~rT",
      "TTr~~~~ggAAggg~~~~~~~~~~=============~~~~~~~~~gggggggg~~~rrr",
      "Tr~~~~Tgggggggg~~~~~~~~~=============~~~~~~~~~ggggggggT~~rrT",
      "TT~~~~gggggggggg~~~~~~~~=============~~~~~~~~~ggggggggg~~rrr",
      "TT~~~ggggggggggg~~~~~~~~~===========~~~~~~~~~ggggggggggg~~rT",
      "TTr~~ggggggggggpp~~~~~~~~~~~~~===~~~~~~~~~~~ppgggggggggg~~Tr",
      "TTr~~~gggggggggpp~~~~~~~~~~~~~~~~~~~~~~~~~~~pp~gggggggg~~~rr",
      "TTr~~~~ggggggg~ppp~~~~~~~~~~~~~~~~~~~~~~~~~ppp~~gggggg~~~~rT",
      "TTr~~~~~~~gg~~~~ppppp~~~~~~~~gggg~~~~~~~ppppp~~~~~gg~~~~~~rr",
      "rrr~~~~~~~~~~~~~~~ppppppp~~gggggggg~ppppppp~~~~~~~~~~~~~~~Tr",
      "rrr~~~~~~~~~~~~~~~~~ppppppppgggggpppppppp~~~~~~~~~~~~~~~~rTr",
      "Trr~~~~~~~~~~~~~~~~~~~~~ppppgppggpppp~~~~~~~~~~~~~~~~~~~~rrr",
      "Trr~~~~~~~~~~~~~~~~~~~~~~~~~gpp~~~~~~~~~~~~~~~~~~~~~~~~~~rTr",
      "rr~~~~~~~~~~~~~~~~~~~~~~~~~~~pp~~~~~~~~~~~~~~~~~~~~~~~~~~rTr",
      "rr~~~~~~~~~~~~~~~~~~~~~~~~~~~pp~~~~~~~~~~~~~~~~~~~~~~~~~~rTT",
      "rr~~~~~~~~~~~~~~~~~g~~~~~~~~~pp~~~~~~~~~~ggg~~~~~~~~~~~~~rrT",
      "rrr~~~~~~~~~~~~~gggggg~~~~~~~pp~~~~~~~~~ggggg~~~~~~~~~~~~rrr",
      "TTr~~~~~~~~~~~~~Tggggpg~~~~~~pp~~~~~~~~pggggg=====~~~~~~~~rr",
      "rrr~~~~~~~~~~~~~~gggppp~~~~ggppggggg~~pppggggg====~~~~~~~~rr",
      "rrr~~~~~~~~~~~~~~~~~~pppppgggggggggppppp~~gg======~~~~~~~~TT",
      "rr~~~~~~~~~~~~~~~~~~~~~pppgggggggggpppp~~~~=======~~~~~~~rrr",
      "rT~~~~~~~~~~~~~~~~~~~~~ggggggggggggggggg~~~~=====~~~~~~~~rrr",
      "rT~~~~~~~~~~~~~~~~~~~~~gggTgggggggppppggg~~~~~~~~~~~~~~~~rrT",
      "TT~~~~~~~~~~~~~~~~~~~~~~gggggggggggppgggg~~~~~~~~~~~~~~~~rTT",
      "TTr~~~~~~~r~~rrrrrrrrrr~~rggggggggrrrr~~~rrr~r~~rrrrrrrrrrTT",
      "rTTTTTTrrTTTrrrrrrrrTTTTTTTrggggrrTTrrrrTTTrrrrrrrrrTTTrrrTr",
      "rrrTTTrrTTrrrrrrrrrrTTrTTTTrggggrrTrrrrTTTrTrrrrrrrrTTTTrrrr",
    ];
    const g = ROWS.map((r) => r.split(''));
    // 泥の道のマス → tilePatches（'m' 泥）。地面は水のある形（閉じた形）。下絵は開いた形（ENV_ASSETS.md §8 の決まり）
    const patchOf = (ch) => {
      const cells = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === ch) cells.push([x, y]);
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      const rows = [];
      for (let y = y0; y <= y1; y++) { let t = ''; for (let x = x0; x <= x1; x++) t += g[y][x] === ch ? 'm' : ' '; rows.push(t); }
      return { rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], rows, cells };
    };
    const pA = patchOf('A'), pB = patchOf('B');
    for (const [x, y] of pA.cells.concat(pB.cells)) g[y][x] = '~';

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
    O.push(K.sign(31, 43, R.T('map.marsh_bog.sign')));

    K.def('marsh_bog', {
      name: R.T('map.marsh_bog.name'), kind: 'dungeon', region: 'r_marsh', location: 'bog', theme: 'forest_dungeon',
      legend: MK.BOG(), rows: g, outside: 'marsh_water',
      objects: O,
      npcs: [
        K.npc('bog_kid_a', 'npc_marsh_child', 38, 47, { name: R.T('map.marsh_bog.npcs.0.bog_kid_a.name'), dir: 'w', talk: 'bog_kids', reward: null, cond: ['marsh_mistbeast', '!marsh_finale_done'] }),
        K.npc('bog_kid_b', 'npc_marsh_child', 39, 47, { name: R.T('map.marsh_bog.npcs.1.bog_kid_b.name'), dir: 'w', talk: 'bog_kids', reward: null, cond: ['marsh_mistbeast', '!marsh_finale_done'] }),
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
      bgm: 'ghost', bbg: 'swamp',
      meta: { chestsInfo: true, floor: R.T('map.marsh_bog.meta.floor'), sub: R.T('map.marsh_bog.meta.sub'), live: [{ cells: pA.cells, patch: 0 }, { cells: pB.cells, patch: 1 }] },
      art: { image: 'forest_dungeon/under/bog', closed: 'forest_dungeon/under/bog_closed', painted: [] },
    });
  });
})(window.RPG);
