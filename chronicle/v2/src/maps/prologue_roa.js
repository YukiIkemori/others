// CONTENT-P: ロアの里（roa、町 44×36）とベルナの家（roa_house、屋内 16×12）。V2_PLAN §3.2・§3.3 P1・P2、WORLD_REDESIGN §5.2、STORY_BIBLE §2.3・§3.4・§9.1
//   roa        丘の上の里。まん中に語り石の広場（石の円陣と語り石）、北に語り石の間、南の低い段にベルナの家。門は東（ワールドへ）。
//              宝箱 1。出現なし。灯りの形 = 窓明かりと、広場の灯籠の輪（町は灯りの島、WORLD §5.1）。
//   roa_house  ベルナの家。寝台・書見台（名簿と手がかり帳の短い本）・朝の席（東向きの空いた席）。
//   spawns: roa.gate（東の門、ワールドから）・roa.house（ベルナの家の戸口の前）・roa.warp（ワープの着く所 = 広場）
//           roa_house.bed（P1 の目覚め。DB.config.start.spawn）・roa_house.door（戸口の内側）
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const { rect, put, path, blob, hline, vline } = K;

    // ================================================================ roa（44×36）
    (function () {
      const W = 44, H = 36, g = K.grid(W, H, ',');
      // 外周の森（2〜3 マス、ゆらぎ）
      K.border(g, 'T', 2);
      for (let x = 0; x < W; x += 3) { blob(g, x, 1, 2, 2, 'T', 'roa_n' + x); blob(g, x, H - 2, 2, 2, 'T', 'roa_s' + x); }
      for (let y = 0; y < H; y += 3) { blob(g, 1, y, 2, 2, 'T', 'roa_w' + y); blob(g, W - 2, y, 1, 1, 'T', 'roa_e' + y); }
      // 東の門（ワールドへ）と、広場への道
      path(g, [[43, 15], [31, 15]], '.', 1); path(g, [[39, 14], [31, 14]], '.', 1);
      rect(g, 40, 13, 4, 2, 'T'); rect(g, 40, 16, 4, 2, 'T');   // 門は 1 マスの幅（門番が立つと通れない）
      // 語り石の広場（石畳の円）
      blob(g, 21, 15, 6, 5, 'c', 'roa_plaza');
      rect(g, 17, 12, 9, 7, 'c');
      // 北の小道（家々の前）
      hline(g, 5, 38, 10, '.'); hline(g, 5, 38, 11, '.');
      path(g, [[21, 10], [21, 11]], '.', 1);
      // 西の畑と花
      rect(g, 4, 13, 8, 6, 'p');
      rect(g, 5, 14, 6, 4, 'o');
      // 東の池
      blob(g, 37, 20, 2, 2, 'w', 'roa_pond');
      // 南の段（低い段。崖の面が南を向く）: y 22 の崖、x 27〜28 の石段
      hline(g, 3, 41, 22, 'R');
      rect(g, 27, 22, 2, 1, 'e');
      put(g, 5, 22, 'e');   // 畑の番小屋（roa_h5）の戸の前の小さな石段（戸が崖に向いているので、下の段から上がる）
      path(g, [[27, 19], [27, 21]], '.', 2);
      // ベルナの家の前庭と、家への小道
      rect(g, 12, 23, 22, 9, ',');
      path(g, [[27, 23], [27, 30], [20, 30]], '.', 1);
      path(g, [[28, 23], [28, 31], [20, 31]], '.', 1);
      blob(g, 8, 27, 3, 3, 'T', 'roa_sw'); blob(g, 38, 28, 3, 3, 'T', 'roa_se');
      rect(g, 13, 32, 20, 2, 'T');

      const legend = {
        ',': { mat: 'grass' }, '.': { mat: 'road' }, c: { mat: 'cobble' }, p: { mat: 'dirt' }, o: { mat: 'flowers' },
        T: { mat: 'tree', solid: true }, w: { mat: 'water', walk: false }, R: { mat: 'cliff', solid: true, rise: 1 }, e: { mat: 'stone_floor', name: 'stairs' },
      };
      const b = K.b, P = K.prop, PS = K.props;
      const D = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });   // 戸口（中は homes_slice.js）。戸の位置は描いた建物の戸（env の door32）に合わせる
      const house = (id, x, y, w, h, o) => b(id, x, y, w, h, Object.assign({ roof: 'thatch', mat: 'plaster', wall: 2, windows: 2, lamp: true, flowers: true }, o));
      const objects = [
        // 北の家並み（戸口は小道へ。中へは入らない家は戸が閉じている）
        house('roa_h1', 5, 4, 6, 6, { windows: 2, chimney: true, door: D(7, 9, 'roa_home1') }),
        house('roa_h2', 12, 4, 5, 6, { roof: 'shingle', mat: 'log', door: D(14, 9, 'roa_home2') }),
        b('roa_hall', 18, 3, 8, 7, { roof: 'moss', mat: 'stone', wall: 3, windows: [1, 6], hip: true, lamp: true, door: D(21, 9, 'roa_hall_in') }),   // 語り石の間
        house('roa_h3', 28, 4, 5, 6, { roof: 'shingle', mat: 'log', chimney: true, door: D(30, 9, 'roa_home3') }),
        house('roa_h4', 34, 4, 6, 6, { windows: 3, door: D(37, 9, 'roa_home4') }),
        // 西の家（畑の番）と東の家
        house('roa_h5', 4, 19, 5, 3, { wall: 1, windows: 1, roof: 'shingle', mat: 'log', small: true, door: D(5, 21, 'roa_home5') }),
        house('roa_h6', 30, 16, 5, 4, { roof: 'thatch', windows: 2, wall: 2, door: D(32, 19, 'roa_home6') }),
        // ベルナの家（南の段）
        b('roa_berna', 16, 24, 9, 7, { roof: 'moss', mat: 'log', wall: 3, windows: 3, chimney: true, lamp: true, flowers: true, door: { x: 20, y: 30, to: { map: 'roa_house', spawn: 'door' } } }),
        // 語り石の広場: 語り石（まん中）と石の円陣、広場の灯籠の輪
        P('songstone', 21, 15),
        ...PS('rock_small', [[18, 13], [24, 13], [17, 15], [25, 15], [18, 17], [24, 17]]),
        ...PS('lamp_post', [[16, 12], [26, 12], [16, 18], [26, 18]]),
        P('bench', 19, 19), P('bench', 23, 19),
        // 北の小道の飾り
        ...PS('lantern', [[11, 10], [17, 10], [27, 10], [33, 10]]),
        ...PS('barrel', [[4, 10], [39, 10]]), P('crate', 39, 11), P('sack', 4, 11),
        ...PS('flower_pot', [[9, 10], [15, 10], [29, 10], [36, 10]]),   // 戸の前は空ける
        P('well', 30, 13),
        // 畑のまわり
        ...PS('fence', [[4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12], [12, 13], [12, 14], [12, 16], [12, 17], [12, 18]]),
        P('hay', 3, 17), P('hay', 3, 16), P('planter', 13, 19), P('stump', 10, 20), P('sack', 9, 19),
        // 池のまわり
        ...PS('rock_small', [[35, 19], [39, 21]]), P('log', 36, 17), P('mushroom_glow', 38, 18), P('firefly', 36, 21), P('firefly', 39, 19),
        // 東の門
        ...PS('lamp_post', [[39, 13], [39, 16]]),
        // 南の段: 前庭
        ...PS('lamp_post', [[26, 24], [15, 31]]), P('bench', 29, 26), P('table', 30, 28), P('chair', 31, 28), P('chair', 29, 28),
        ...PS('flower_pot', [[15, 29], [26, 29]]), P('barrel', 26, 25), P('stump', 32, 24), P('log', 12, 24),
        ...PS('firefly', [[13, 27], [31, 31], [22, 23 + 9]]),
        P('mushroom_glow', 11, 29), P('rock_small', 34, 26),
        K.exam(21, 15, 'roa_stone'),
        K.sign(37, 13, 'ロアの里\n語り部の里。東へ出れば、半島の街道。'),
        K.chest('roa_c1', 5, 17, { item: 'i_salve', n: 2 }),
      ];
      const npcs = [
        // 門番のおかみ: 師匠にあいさつするまでは門の前に立つ（押してもどかない）
        { id: 'gatewoman', look: 'npc_woman_2', name: '門番のおかみ', x: 40, y: 15, dir: 'w', move: 'still', pushable: false, cond: '!prologue_berna', talk: 'roa_gate', key: 'roa_gatewoman' },
        { id: 'gatewoman2', look: 'npc_woman_2', name: '門番のおかみ', x: 38, y: 16, dir: 's', move: 'still', cond: 'prologue_berna', talk: 'roa_gatewoman', reward: 'news', key: 'roa_gatewoman2' },
        { id: 'child_a', look: 'npc_child_1', x: 20, y: 18, dir: 'n', move: 'still', talk: 'roa_children', reward: 'news', key: 'roa_children' },
        { id: 'child_b', look: 'npc_child_3', x: 22, y: 18, dir: 'n', move: 'still', talk: 'roa_children' },
        { id: 'elder', look: 'npc_old_m_1', name: '里の年寄り', x: 24, y: 16, dir: 'w', move: 'still', talk: 'roa_elder', reward: 'news', key: 'roa_elder' },
        { id: 'farmer', look: 'npc_man_2', x: 8, y: 13, dir: 's', move: { route: [[6, 13], [10, 13]], wait: 1600 }, talk: 'roa_farmer', reward: 'item', key: 'roa_farmer' },
        { id: 'weaver', look: 'npc_old_f_1', x: 31, y: 11, dir: 's', move: 'still', talk: 'roa_weaver', reward: 'news', key: 'roa_weaver' },
        { id: 'youth', look: 'npc_man_1', x: 14, y: 11, dir: 's', move: 'wander', talk: 'roa_youth', reward: 'hint', key: 'roa_youth' },
        { id: 'cat', look: 'ani_cat', name: 'ねこ', x: 29, y: 27, dir: 's', move: 'wander', talk: { lines: [{ text: 'ねこが、のびをしている。' }] } },
      ];
      K.def('roa', {
        name: 'ロアの里', name_ruby: 'ろあのさと', kind: 'town', region: 'prologue', location: 'roa', theme: 'hill_village',
        legend, rows: g, outside: 'tree', objects, npcs,
        spawns: {
          gate: { x: 42, y: 15, dir: 'w' }, house: { x: 20, y: 31, dir: 's' }, warp: { x: 21, y: 19, dir: 's' },
          h1_door: { x: 7, y: 10, dir: 's' }, h2_door: { x: 14, y: 10, dir: 's' }, h3_door: { x: 30, y: 10, dir: 's' }, h4_door: { x: 37, y: 10, dir: 's' },
          h5_door: { x: 5, y: 22, dir: 's' }, h6_door: { x: 32, y: 20, dir: 's' }, hall_door: { x: 21, y: 10, dir: 's' },
        },
        exits: [{ x: 43, y: 15, w: 1, h: 1, to: { map: 'world', spawn: 'roa' } }],
        triggers: [
          { id: 'gate', x: 39, y: 15, w: 1, h: 1, on: 'step', event: 'roa_gate', cond: '!prologue_berna' },
          { id: 'enter', on: 'enter', event: 'roa_enter' },
        ],
        light: { ambient: '#5c5aa0', k: 0.45, mood: 'town_night', vignette: 0.66 }, bgm: 'home',
        meta: { sub: '語り部の里', chestsInfo: true },
        // 里ぜんたいを 1 枚に描いた下絵（v2/assets/env/hill_village/under/roa*、design/ENV_ASSETS.md §7）。地面・建物・木・柵はこの絵、
        // 当たり・戸口・人・灯り・ほかの物は上のデータのまま。絵が無ければマスから焼く
        art: { image: 'hill_village/under/roa', overlay: 'hill_village/under/roa_over', emit: 'hill_village/under/roa_emit', painted: ['fence'] },
      });
    })();

    // ================================================================ roa_house（16×12）
    (function () {
      const { g, door } = K.room(16, 12);
      rect(g, 5, 5, 6, 4, 'c');   // 敷物
      const P = K.prop, PS = K.props;
      const objects = [
        P('bed', 2, 3), P('bed', 2, 4),
        ...PS('bookshelf', [[9, 2], [10, 2], [11, 2]]),
        P('stove', 6, 2), P('sack', 5, 2), P('barrel', 14, 2),
        P('table', 12, 4),                                  // 書見台（名簿と手がかり帳の短い本）
        P('table', 7, 6), P('table', 8, 6),                 // 食卓
        P('chair', 6, 6), P('chair', 7, 7), P('chair', 8, 7), P('chair', 9, 6),   // 9,6 = 東向きの空いた席（朝の席）
        P('lantern', 13, 7), P('flower_pot', 1 + 1, 9), P('crate', 13, 9), P('planter', 3, 7),
        // 飾りと灯り（屋内の見直し。ベルナの歩く 5 の行と書見台・席・棚のマスは空けたまま）
        P('cupboard', 4, 2), P('basket_veg', 7, 2), P('shelf_jars', 8, 2), P('candelabra', 13, 2), P('house_plant', 14, 5), P('spinning_wheel', 1, 7),
        P('wall_window', 3, 1), P('wall_herbs', 7, 1), P('wall_painting', 12, 1), P('wall_sconce', 1, 1), P('wall_window', 14, 1),
        K.exam(12, 4, 'roa_lectern'),
        K.exam(9, 6, 'roa_seat'),
        K.exam(10, 2, 'roa_shelf'),
      ];
      const npcs = [
        { id: 'berna', look: 'berna', name: 'ベルナ', x: 3, y: 5, dir: 'n', move: 'still', pushable: false, cond: '!prologue_start', talk: 'roa_berna' },
        { id: 'berna_desk', look: 'berna', name: 'ベルナ', x: 12, y: 5, dir: 's', move: 'still', pushable: false, cond: ['prologue_start', { any: ['!prologue_boss', 'prologue_done'] }], talk: 'roa_berna', key: 'roa_berna' },
      ];
      K.def('roa_house', {
        name: 'ベルナの家', kind: 'interior', region: 'prologue', location: 'roa',
        legend: K.ROOM_LEGEND('wall_wood', 'wood_floor'), rows: g, outside: 'wall_wood', objects, npcs,
        spawns: { bed: { x: 3, y: 4, dir: 's' }, door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 2, h: 1, to: { map: 'roa', spawn: 'house' } }],
        light: { ambient: '#8a6a58', k: 0.85, mood: 'interior' }, bgm: 'home',
        meta: { sub: '語り部の家', minimap: false },
      });
    })();
  });
})(window.RPG);
