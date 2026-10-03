// CONTENT（砂漠）: 砂の王墓 3 階（WORLD_REDESIGN §4.2 の流れ 3・4、§6.5 の砂の王墓、§4.10・§6.2・§6.3）。
//   1 階 desert_tomb_1（56×48）「墓守の回廊」: 入口の広間 → 中央の回廊 → 封じの扉（西と東の小部屋の踏み板を両方踏むと開く。
//        扉と踏み板に同じ色の印）→ 大回廊 → 下り階段。西の翼の奥に墓守の像「ハ」。西の翼の東の壁に隠し通路（金剛トカゲの隠し部屋）。
//   2 階 desert_tomb_2（56×48）「流砂の間」: 暗がりの階（燭台に火をともすと明るいまま）。中ほどの灯りの間に泉。西の回廊の奥に像「ザ」。
//        南の砂もぐりのねぐら（手前に泉）。倒すと流砂が止まり（tilePatches）、東の流砂の向こうの下り階段へ渡れる。
//   3 階 desert_tomb_3（52×44）「王の間」: 東の翼の像「ル」、控えの間の泉、王の間（拓本の跡 lo_ev_desert、名なき砂の王）。
//   仕掛け: 1 階 = 踏み板の扉、2 階 = 暗がりと灯り＋流砂、3 階 = 名の文字（三つそろえると「王の名の記し」＝戦いの中で名を呼べる）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const deco = (O, list) => { for (const [id, x, y, v] of list) O.push(K.prop(id, x, y, v != null ? { variant: v } : undefined)); };

    // ================================================================ 1 階
    {
      const W = 56, H = 48;
      const g = K.grid(W, H, '#');
      K.rect(g, 20, 35, 17, 10, '.');     // 入口の広間
      K.rect(g, 27, 45, 3, 2, '.');       // 入口の階段の前
      K.rect(g, 27, 21, 3, 14, '.');      // 中央の回廊
      K.rect(g, 27, 19, 3, 2, 'G');       // 封じの扉
      K.rect(g, 17, 6, 23, 13, '.');      // 大回廊
      K.rect(g, 10, 40, 10, 3, '.');      // 西への通路
      K.rect(g, 3, 24, 14, 14, '.');      // 西の翼
      K.rect(g, 8, 14, 3, 10, '.');       // 西の北の通路
      K.rect(g, 4, 7, 11, 7, '.');        // 北西の小部屋（踏み板）
      K.rect(g, 3, 39, 6, 6, '.'); K.rect(g, 5, 38, 2, 1, '.');   // 像「ハ」の部屋
      K.rect(g, 37, 40, 10, 3, '.');      // 東への通路
      K.rect(g, 40, 24, 14, 14, '.');     // 東の翼
      K.rect(g, 45, 14, 3, 10, '.');      // 東の北の通路
      K.rect(g, 41, 7, 11, 7, '.');       // 北東の小部屋（踏み板）
      K.rect(g, 10, 38, 2, 2, '.'); K.rect(g, 45, 38, 2, 2, '.');
      K.put(g, 17, 30, 'S');              // 隠し通路（西の翼の東の壁）
      K.rect(g, 18, 27, 6, 6, '.');       // 金剛トカゲの隠し部屋
      // 砂の吹きだまりと柱（床の変化）
      K.rect(g, 21, 36, 3, 2, 's'); K.rect(g, 33, 42, 3, 2, 's'); K.rect(g, 4, 34, 4, 3, 's'); K.rect(g, 49, 25, 4, 3, 's'); K.rect(g, 18, 15, 3, 3, 's');
      for (const [x, y] of [[22, 38], [34, 38], [22, 42], [34, 42], [20, 9], [37, 9], [20, 15], [37, 15], [7, 27], [13, 27], [7, 34], [13, 34], [43, 27], [50, 27], [43, 34], [50, 34]]) K.put(g, x, y, '#');
      const O = [];
      O.push(K.stairs(28, 46, { map: 'desert_camp3', spawn: 'tomb' }, { id: 'desert_tomb_1_up', look: 'up' }));
      O.push(K.stairs(28, 7, { map: 'desert_tomb_2', spawn: 'top' }, { id: 'desert_tomb_1_down' }));
      O.push({ type: 'switch', id: 'desert_tomb_1_sw_w', x: 9, y: 9, flag: 'desert_t1_sw_w', look: 'plate', color: 'gold' });
      O.push({ type: 'switch', id: 'desert_tomb_1_sw_e', x: 46, y: 9, flag: 'desert_t1_sw_e', look: 'plate', color: 'gold' });
      const DOOR = { all: ['desert_t1_sw_w', 'desert_t1_sw_e'] };
      // 扉の前で調べると一言（開くまで）。前は扉の左の壁（26,20）に踏み板の形の印（青い 'switch' の物）を置いていて、壁にめり込んだ変な印に見えた
      //   （持ち主の試遊 2026-10-01「砂の王墓の一階中央進むと変なマークが壁にめり込んでる」）。回廊は扉と同じ 3 マス幅で、脇に床が無いので置かない
      O.push(K.exam(28, 21, 'desert_tomb_door', { cond: { not: DOOR } }));
      // 封じの扉（壁 y 19〜20・x 27〜29 はそのまま）: 扉の絵は中ほどに大きな 1 枚（いつも）。開くまでは押すと一言。
      // 開いた後（踏み板 2 つ）は扉のマスで向こう側へ（南 y 20 → 北 y 18、北 y 19 → 南 y 21）
      const SEAL = {};
      O.push({ type: 'door', id: 'desert_tomb_1_seal', x: 27, y: 20, w: 3, scale: 1.7, locked: R.T('map.desert_tomb.desert_tomb_1_seal.locked') });
      for (let i = 0; i < 3; i++) {
        const x = 27 + i;
        O.push({ type: 'door', id: 'desert_tomb_1_seal_s' + i, x, y: 20, look: 'none', cond: DOOR, to: { map: 'desert_tomb_1', spawn: 'seal_n' + i } });
        O.push({ type: 'door', id: 'desert_tomb_1_seal_n' + i, x, y: 19, look: 'none', cond: DOOR, to: { map: 'desert_tomb_1', spawn: 'seal_s' + i } });
        SEAL['seal_n' + i] = { x, y: 18, dir: 'n' }; SEAL['seal_s' + i] = { x, y: 21, dir: 's' };
      }
      O.push(K.prop('rock_small', 31, 36), K.prop('rock_small', 32, 37));   // 崩れた石（泉は 3 階の王の前だけ。WORLD §6.2）
      O.push(K.prop('obelisk', 5, 40), K.exam(5, 41, 'desert_tomb_glyph', { glyph: 'ha' }));                    // 墓守の像「ハ」
      O.push(K.exam(21, 29, 'desert_tomb_lizard'));                                                               // 隠し部屋の金剛トカゲ
      O.push(K.chest('desert_tomb_1_c1', 4, 25, { pool: 'p_T' }), K.chest('desert_tomb_1_c2', 13, 8, { item: 'i_stone_earth', n: 2 }),
        K.chest('desert_tomb_1_c3', 52, 36, { pool: 'p_T' }), K.chest('desert_tomb_1_c4', 42, 8, { gold: 150 }),
        K.chest('desert_tomb_1_c5', 22, 31, { pool: 'p_rare' }), K.chest('desert_tomb_1_c6', 38, 7, { pool: 'p_T' }));
      O.push(K.sign(26, 35, R.T('map.desert_tomb.sign')));   // 入口の広間の、中央の回廊の口の左の床（前は 26,33 の壁の中に立っていた）
      // 壺は 4 つまで・角と壁ぎわだけ（持ち主 2026-09-28「樽とか木箱みたいに移動通り抜け不可のはあまり置かないで」）
      deco(O, [['broken_pillar', 24, 44], ['bones', 34, 44],
        ['obelisk', 19, 7], ['obelisk', 38, 12], ['tomb_urn', 17, 18], ['tomb_urn', 39, 18], ['bones', 5, 30], ['bones', 51, 31], ['sand_mound', 22, 7],
        ['clay_jars', 14, 12], ['clay_jars', 51, 12], ['sand_mound', 48, 8], ['broken_pillar', 16, 36], ['broken_pillar', 40, 36]]);
      // 中央の回廊（x 27〜29）の床に立てていた 2 本（27,25・29,30）はどけた: 3 マス幅の回廊の真ん中で、脇に壁の面が無く宙に浮いた炎に見えた（持ち主の試遊 2026-10-01）
      for (const [x, y] of [[24, 36], [32, 44], [21, 12], [35, 12], [10, 25], [46, 25], [5, 8], [50, 8], [4, 42]]) O.push(K.prop('torch', x, y));
      K.def('desert_tomb_1', {
        name: R.T('map.desert_tomb.desert_tomb_1.name'), kind: 'dungeon', region: 'r_desert', location: 'tomb', theme: 'tomb',
        legend: DK.TOMB_LEGEND({ G: { mat: 'wall_sandstone', solid: true, rise: 2, name: 'seal_door' }, O: { mat: 'wall_sandstone', solid: true, rise: 2, name: 'seal_door_open' } }),
        rows: g, outside: 'wall_sandstone', objects: O,
        npcs: [K.npc('tomb_ghost', 'npc_desert_old_m', 32, 40, { name: R.T('map.desert_tomb.desert_tomb_1.npcs.0.tomb_ghost.name'), dir: 'w', talk: 'desert_tomb_ghost', reward: 'hint', cond: '!cleared_r_desert' })],
        spawns: Object.assign({ entrance: { x: 28, y: 44, dir: 'n' }, down: { x: 28, y: 9, dir: 's' } }, SEAL),
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'desert_tomb_arrive', once: true },
          { id: 'plate_w', x: 9, y: 9, w: 1, h: 1, on: 'step', event: 'desert_tomb_plate_w', cond: '!desert_t1_sw_w' },
          { id: 'plate_e', x: 46, y: 9, w: 1, h: 1, on: 'step', event: 'desert_tomb_plate_e', cond: '!desert_t1_sw_e' }],
        // 封じの扉は壁に穴を開けずに扉の物で通す（上の SEAL）。開いたら同じ見た目の 'O' に替える（扉のまわりのチャンクを焼き直し、金の印を消す）
        tilePatches: [{ cond: DOOR, rect: [27, 19, 3, 2], rows: ['OOO', 'OOO'] }],
        zones: [{ rect: null, zone: 'z_desert_tomb' }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'pyramid', bbg: 'pyramid',
        art: { image: 'desert/under/tomb_1', closed: 'desert/under/tomb_1_closed', painted: [] },   // 1 枚の下絵（隠し部屋は閉じた形の層）
        meta: { chestsInfo: true, floor: R.T('map.desert_tomb.desert_tomb_1.meta.floor'), sub: R.T('map.desert_tomb.desert_tomb_1.meta.sub') },
      });
    }

    // ================================================================ 2 階（暗がり・流砂・砂もぐり）
    {
      const W = 56, H = 48;
      const g = K.grid(W, H, '#');
      K.rect(g, 20, 2, 17, 8, '.');       // 上の広間（階段）
      K.rect(g, 14, 5, 6, 3, '.');        // 西へ
      K.rect(g, 4, 3, 10, 30, '.');       // 西の長い回廊
      K.rect(g, 3, 35, 10, 8, '.'); K.rect(g, 7, 33, 2, 2, '.');   // 像「ザ」の部屋
      K.rect(g, 14, 22, 7, 3, '.');       // 西から灯りの間へ
      K.rect(g, 21, 18, 15, 11, '.');     // 灯りの間（泉）
      K.rect(g, 27, 10, 3, 8, '.');       // 上の広間から灯りの間へ（まっすぐ）
      K.rect(g, 37, 5, 15, 8, '.'); K.rect(g, 36, 6, 2, 3, '.');   // 北東の宝物の間
      K.rect(g, 44, 13, 3, 9, '.');       // 北東から東の流砂の岸へ
      K.rect(g, 36, 22, 12, 4, '.');      // 灯りの間から東へ
      K.rect(g, 26, 29, 5, 2, '.');       // 灯りの間から控えの間へ
      K.rect(g, 23, 31, 11, 4, '.');      // 控えの間（泉）
      K.rect(g, 18, 36, 21, 10, 's');     // 砂もぐりのねぐら（砂）
      K.rect(g, 27, 35, 3, 1, '.');
      K.rect(g, 39, 38, 3, 4, 'Q');       // ねぐらから東の流砂（倒すと止まる）
      K.rect(g, 42, 26, 3, 16, 'Q');      // 東の流砂の川
      K.rect(g, 45, 26, 9, 18, '.');      // 流砂の向こう（下り階段）
      K.rect(g, 36, 26, 6, 3, 's');       // 東の岸の砂
      for (const [x, y] of [[23, 20], [33, 20], [23, 26], [33, 26], [8, 10], [8, 20], [8, 28], [40, 8], [48, 8]]) K.put(g, x, y, '#');
      const O = [];
      O.push(K.stairs(28, 3, { map: 'desert_tomb_1', spawn: 'down' }, { id: 'desert_tomb_2_up', look: 'up' }));
      O.push(K.stairs(49, 41, { map: 'desert_tomb_3', spawn: 'up' }, { id: 'desert_tomb_2_down' }));
      O.push(K.prop('rock_small', 27, 22), K.prop('rock_small', 28, 23));   // 灯りの間の崩れた石（泉は 3 階の王の前だけ）
      O.push(K.prop('rock_small', 31, 32), K.prop('rock_small', 31, 33));   // 控えの間の崩れた石（砂もぐりの前）
      // 燭台（火をともすと周りが明るいまま、E6）。1 つ目は上の広間の階段の脇（着く所 top 28,5 をふさがない）
      const BZ = [[25, 4], [16, 6], [9, 5], [9, 16], [9, 30], [7, 38], [22, 19], [34, 19], [22, 27], [34, 27], [24, 33], [32, 33], [45, 6], [45, 17], [40, 24], [50, 28], [50, 40], [20, 38], [37, 38]];
      BZ.forEach(([x, y], i) => O.push({ type: 'brazier', id: 'desert_tomb_2_b' + (i + 1), x, y }));
      O.push(K.prop('obelisk', 5, 36), K.exam(5, 37, 'desert_tomb_glyph', { glyph: 'za' }));
      O.push(K.exam(28, 36, 'desert_tomb_quicksand'), K.exam(39, 40, 'desert_tomb_quicksand'), K.exam(41, 27, 'desert_tomb_quicksand'));
      O.push(K.sign(26, 30, R.T('map.desert_tomb.sign_2')));
      O.push(K.chest('desert_tomb_2_c1', 5, 4, { pool: 'p_T' }), K.chest('desert_tomb_2_c2', 50, 6, { pool: 'p_T' }), K.chest('desert_tomb_2_c3', 38, 11, { item: 'i_torch', n: 2 }),
        K.chest('desert_tomb_2_c4', 11, 41, { gold: 220 }), K.chest('desert_tomb_2_c5', 52, 30, { pool: 'p_rare' }), K.chest('desert_tomb_2_c6', 12, 12, { item: 'i_potion', n: 2 }));
      deco(O, [['bones', 5, 22], ['bones', 12, 32], ['sand_mound', 20, 44], ['sand_mound', 36, 44], ['bones', 30, 44],
        ['broken_pillar', 38, 5], ['tomb_urn', 51, 12], ['clay_jars', 45, 43], ['obelisk', 47, 27], ['tomb_urn', 53, 43], ['bones', 24, 45], ['sand_mound', 22, 37]]);
      const N = [
        K.npc('worm_track', 'npc_desert_old_m', 25, 33, { name: R.T('map.desert_tomb.N.0.worm_track.name'), dir: 'e', talk: 'desert_tomb_robber', reward: 'boss', cond: '!desert_robber_gone' }),   // 砂もぐりの後、起きて帰る場面で消える（desert_tomb_robber_leave）
      ];
      K.def('desert_tomb_2', {
        name: R.T('map.desert_tomb.desert_tomb_2.name'), kind: 'dungeon', region: 'r_desert', location: 'tomb', theme: 'tomb',
        legend: DK.TOMB_LEGEND(),
        rows: g, outside: 'wall_sandstone', objects: O, npcs: N,
        spawns: { top: { x: 28, y: 5, dir: 's' }, up: { x: 49, y: 39, dir: 'n' }, lair: { x: 28, y: 37, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'desert_tomb2_arrive', once: true },
          { id: 'worm', x: 19, y: 37, w: 19, h: 2, on: 'step', event: 'desert_tomb_worm', cond: '!desert_worm' },
        ],
        tilePatches: [
          { cond: 'desert_worm', rect: [39, 38, 3, 4], rows: ['sss', 'sss', 'sss', 'sss'] },
          { cond: 'desert_worm', rect: [42, 26, 3, 16], rows: new Array(16).fill('sss') },
        ],
        zones: [{ rect: [18, 35, 21, 11], zone: 'z_desert_tomb' }, { rect: null, zone: 'z_desert_tomb' }],
        light: { ambient: '#4c4a7e', k: 0.62, mood: 'dark' }, dark: true, bgm: 'pyramid', bbg: 'pyramid',
        art: { image: 'desert/under/tomb_2', closed: 'desert/under/tomb_2_closed', painted: [] },   // 1 枚の下絵（_tools/under/desert2）
        meta: { chestsInfo: true, floor: R.T('map.desert_tomb.desert_tomb_2.meta.floor'), sub: R.T('map.desert_tomb.desert_tomb_2.meta.sub') },
      });
    }

    // ================================================================ 3 階（王の間）
    {
      const W = 52, H = 44;
      const g = K.grid(W, H, '#');
      K.rect(g, 20, 33, 13, 9, '.');      // 南の広間（上り階段）
      K.rect(g, 8, 35, 12, 3, '.');       // 西へ
      K.rect(g, 3, 20, 9, 18, '.');       // 西の翼（宝物の小部屋）
      K.rect(g, 33, 35, 10, 3, '.');      // 東へ
      K.rect(g, 40, 18, 9, 20, '.');      // 東の翼（像「ル」）
      K.rect(g, 25, 23, 3, 10, '.');      // 北への回廊
      K.rect(g, 12, 22, 13, 3, '.');      // 西の翼から回廊へ
      K.rect(g, 28, 22, 12, 3, '.');      // 東の翼から回廊へ
      K.rect(g, 19, 13, 15, 8, '.');      // 控えの間（泉）
      K.rect(g, 25, 21, 3, 2, '.');
      K.rect(g, 25, 11, 3, 2, '.');       // 王の間の口
      K.rect(g, 15, 2, 23, 9, 'c');       // 王の間（敷物）
      K.rect(g, 15, 2, 23, 2, '.');
      for (const [x, y] of [[18, 5], [34, 5], [18, 9], [34, 9], [22, 15], [30, 15], [22, 19], [30, 19]]) K.put(g, x, y, '#');
      const O = [];
      O.push(K.stairs(26, 40, { map: 'desert_tomb_2', spawn: 'up' }, { id: 'desert_tomb_3_up', look: 'up' }));
      // 控えの間の泉（王の前。王墓でただ 1 つ。WORLD §6.2）。部屋（19〜33）と回廊（25〜27）のまん中 26.5 に絵を置く（dx: 0.5。持ち主 2026-10-03「女神像がまん中にない」）
      O.push(Object.assign(K.spring('desert_tomb_3_s1', 25, 15), { dx: 0.5 }));
      O.push(K.prop('obelisk', 44, 19), K.exam(44, 20, 'desert_tomb_glyph', { glyph: 'ru' }));
      O.push(K.prop('broken_pillar', 20, 3), K.exam(20, 4, 'desert_tomb_rubbing'));        // 拓本の跡（lo_ev_desert）
      O.push(K.prop('obelisk', 16, 3), K.prop('obelisk', 36, 3));
      O.push(K.prop('crystal', 26, 3), K.exam(26, 4, 'desert_tomb_throne'));
      O.push(K.chest('desert_tomb_3_c1', 4, 21, { pool: 'p_T' }), K.chest('desert_tomb_3_c2', 10, 36, { pool: 'p_heal' }), K.chest('desert_tomb_3_c3', 47, 36, { pool: 'p_T' }),
        K.chest('desert_tomb_3_c4', 4, 36, { pool: 'p_rare' }));
      O.push(K.sign(31, 14, R.T('map.desert_tomb.sign_3')));
      for (const [x, y] of [[21, 34], [31, 34], [20, 13], [32, 13], [16, 8], [36, 8], [5, 25], [46, 25], [26, 25]]) O.push(K.prop('torch', x, y));
      deco(O, [['tomb_urn', 11, 20], ['bones', 6, 30], ['sand_mound', 44, 33], ['bones', 47, 22], ['tomb_urn', 20, 41], ['tomb_urn', 32, 41],
        ['clay_jars', 48, 18], ['broken_pillar', 40, 30], ['obelisk', 9, 27]]);   // 壺は 4 つまで、崩れた柱は壁ぎわ（持ち主 2026-09-28）
      const N = [
        K.npc('hazal_king', 'npc_hazal', 26, 6, { name: R.T('map.desert_tomb.N.0.hazal_king.name'), dir: 's', talk: 'desert_hazal_after', reward: 'news', cond: 'desert_king' }),
      ];
      K.def('desert_tomb_3', {
        name: R.T('map.desert_tomb.desert_tomb_3.name'), kind: 'dungeon', region: 'r_desert', location: 'tomb', theme: 'tomb',
        legend: DK.TOMB_LEGEND(),
        rows: g, outside: 'wall_sandstone', objects: O, npcs: N,
        spawns: { up: { x: 26, y: 38, dir: 'n' }, throne: { x: 26, y: 8, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'desert_tomb3_arrive', once: true },
          { id: 'king', x: 19, y: 7, w: 15, h: 3, on: 'step', event: 'desert_tomb_king', cond: '!desert_king' },
        ],
        zones: [{ rect: [0, 12, 52, 32], zone: 'z_desert_tomb_deep' }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'pyramid', bbg: 'pyramid',
        art: { image: 'desert/under/tomb_3', painted: [] },   // 1 枚の下絵（_tools/under/desert2）
        meta: { chestsInfo: true, floor: R.T('map.desert_tomb.desert_tomb_3.meta.floor'), sub: R.T('map.desert_tomb.desert_tomb_3.meta.sub') },
      });
    }
  });
})(window.RPG);
