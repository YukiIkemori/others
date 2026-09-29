// CONTENT（砂漠）: 宿場「砂の縁」（WORLD_REDESIGN §2.7 #10・§5.14）。森〜砂漠〜灰の街道のまん中の隊商宿（2026-09-27 に作り直し）。
//   sandedge      40×30。四角い宿屋ではない: 森の終わり・砂漠の始まりに立つ「石になった大樹」の町。
//                 北のまん中 = 石化した大樹の幹。幹のうろを掘った宿（中は sandedge_inn）。石の根が中庭へ広がる。
//                 まん中 = 根もとから湧く甘い水の井戸（回復の泉）。西 = 岩のアーチの下のうまや。東 = 帆布を張った売り台とロッタの籠。
//                 北の縁は森の名残の草と低木、ほかは砂丘。戸の無い物: 石の根のあいだの丸屋根の蔵・遊牧の天幕小屋。
//   sandedge_inn  宿と酒場（うわさ）。
//   町なので宝箱は見える物 1 つだけ。隠し通路は置かない（A27）。小物は壁・岩の際に少しだけ。町の絵は 1 枚の下絵（desert/under/sandedge*）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const W = 40, H = 30;
    const g = K.grid(W, H, 'D');
    // 中庭のくぼ地（ふちはゆらぐ）と、北の森の名残（草・低木）
    K.blob(g, 20, 16, 17, 12, 's', 'se2_floor', ['D']);
    for (let y = 0; y < 5; y++) for (let x = 0; x < W; x++) g[y][x] = 'P';
    K.blob(g, 20, 3, 18, 3, 'P', 'se2_wood');
    K.rect(g, 5, 10, 6, 1, 's'); K.rect(g, 28, 10, 6, 1, 's'); K.rect(g, 10, 5, 1, 6, 's'); K.rect(g, 33, 6, 1, 5, 's');
    K.blob(g, 6, 7, 5, 3, 'g', 'se2_g1', ['s']); K.blob(g, 33, 7, 5, 3, 'g', 'se2_g2', ['s']);
    // 石化した大樹（幹 = 宿、石の根が左右へ）
    for (let y = 0; y < 12; y++) for (let x = 11; x < 29; x++) {
      const trunk = ((x - 19.5) / 6.2) ** 2 + ((y - 5) / 7) ** 2 < 1;
      const rootL = y >= 7 && y <= 10 && x >= 11 && x <= 15 && (x - 11) + (10 - y) >= 1;
      const rootR = y >= 7 && y <= 10 && x >= 24 && x <= 28 && (28 - x) + (10 - y) >= 1;
      if (trunk || rootL || rootR) g[y][x] = 'T';
    }
    // うまや: 西の岩のアーチ（東へ開く）
    K.rect(g, 2, 11, 7, 1, 'm'); K.rect(g, 2, 21, 7, 1, 'm'); K.rect(g, 2, 11, 2, 11, 'm');
    K.rect(g, 4, 12, 5, 9, 'k');
    // 中庭の敷石（井戸のまわり）と、東の売り台の粘土
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 20) / 6.5) ** 2 + ((y - 16.5) / 4.6) ** 2 < 1 && g[y][x] === 's') g[y][x] = 'Q';
    K.rect(g, 30, 12, 6, 9, 'k', ['s', 'D']);
    // 南の門（砂丘の切れ目）と道
    K.path(g, [[19, 29], [19, 25], [20, 21]], 'k', 2, ['s', 'D', 'Q']);
    K.path(g, [[20, 11], [20, 13]], 'Q', 1);
    K.rect(g, 18, 26, 4, 4, 'k');

    // 下絵に合わせる: 石の根の足もと（戸口の左右の 10 行目）と、門の柱 2 本
    K.rect(g, 9, 10, 10, 1, 'T'); K.rect(g, 22, 10, 7, 1, 'T');
    K.rect(g, 18, 25, 1, 2, 'x'); K.rect(g, 26, 25, 1, 2, 'x');
    const O = [];
    const bld = (id, x, y, w, h, o) => {
      const b = Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'flat', mat: 'plaster', windows: 1, lamp: false }, o);
      O.push(b);
      if (b.door) g[b.door.y][b.door.x] = 'Q';
      return b;
    };
    // 幹のうろの宿（正面の帯 = 石の樹皮に掘った壁と戸）
    const bInn = bld('sandedge_b_inn', 16, 6, 8, 5, { wall: 3, windows: 2, sign: 'inn', lamp: true, door: { x: 20, y: 10, to: { map: 'sandedge_inn', spawn: 'door' } } });
    // 戸の無い物: 根のあいだの丸屋根の蔵（東）・遊牧の天幕小屋（北西）
    bld('sandedge_s_store', 29, 6, 4, 4, { wall: 1, windows: 0 });
    bld('sandedge_s_yurt', 6, 6, 4, 4, { wall: 1, windows: 0 });
    for (const b of O) for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (g[b.y + j][b.x + i] === 'P' || g[b.y + j][b.x + i] === 'D') g[b.y + j][b.x + i] = 's';

    // 井戸（甘い水。回復の泉 2×2）
    O.push(K.spring('sandedge_spring', 19, 15));
    // 売り台（東の帆布の下、壁際）とロッタの籠
    O.push(K.prop('desert_stall', 34, 12), K.prop('carpet_rack', 34, 19), K.prop('clay_jars', 35, 14), K.prop('crate', 35, 17));
    // うまや（岩のアーチの下）
    O.push(K.prop('hay', 4, 12), K.prop('hay', 4, 20), K.prop('wash_tub', 4, 16));
    // 灯り: 井戸のまわりの銅のかがり火（敷石の縁の外）、戸口の脇の置き灯籠
    O.push(K.prop('copper_brazier', 12, 14), K.prop('copper_brazier', 28, 14), K.prop('copper_brazier', 12, 19), K.prop('copper_brazier', 28, 19));
    O.push(K.prop('lantern', 19, 11), K.prop('lantern', 21, 11), K.prop('lantern', 17, 24), K.prop('lantern', 22, 24), K.prop('lantern', 9, 12));
    // 壁・根の際の少しの物
    O.push(K.prop('table', 25, 13), K.prop('stool', 26, 13), K.prop('clay_jars', 13, 11), K.prop('cart_barrels', 27, 11), K.prop('sack', 33, 21));
    O.push(K.sign(23, 26, R.T('map.desert_sandedge.sign')));
    O.push(K.exam(15, 10, 'sandedge_notice'));                                   // 石の根に打ちつけた掲示
    O.push(K.chest('sandedge_c1', 5, 19, { item: 'i_potion', n: 2 }));          // 見える宝箱（うまやの隅）
    const N = [
      K.npc('lotta', 'npc_lotta', 33, 14, { name: R.T('map.desert_sandedge.N.0.lotta.name'), title: R.T('map.desert_sandedge.N.0.lotta.title'), dir: 'w', talk: 'sandedge_lotta', pushable: false, reward: 'side' }),
      K.npc('stall', 'npc_desert_man', 33, 18, { name: R.T('map.desert_sandedge.N.1.stall.name'), title: R.T('map.desert_sandedge.N.1.stall.title'), dir: 'w', talk: 'sandedge_shop', pushable: false, reward: null }),
      K.npc('stable', 'npc_desert_child', 8, 16, { name: R.T('map.desert_sandedge.N.2.stable.name'), dir: 'e', talk: 'sandedge_stable', reward: 'news' }),
      K.npc('camel_a', 'ani_camel', 5, 14, { name: R.T('map.desert_sandedge.N.3.camel_a.name'), dir: 'e', talk: [L(R.T('map.desert_sandedge.N.talk.0.L'))], reward: null }),
      K.npc('camel_b', 'ani_camel', 5, 18, { name: R.T('map.desert_sandedge.N.4.camel_b.name'), dir: 'e', talk: [L(R.T('map.desert_sandedge.N.talk.0.L_2'))], reward: null }),
      K.npc('forest_trav', 'npc_traveler', 14, 16, { name: R.T('map.desert_sandedge.N.5.forest_trav.name'), dir: 'e', talk: 'sandedge_forest_traveler', reward: 'news' }),
      K.npc('ash_trav', 'npc_ash_fighter', 26, 16, { name: R.T('map.desert_sandedge.N.6.ash_trav.name'), dir: 'w', talk: 'sandedge_ash_traveler', reward: 'lead' }),
      K.npc('well_girl', 'npc_desert_child', 21, 18, { name: R.T('map.desert_sandedge.N.7.well_girl.name'), dir: 'n', talk: 'sandedge_well_girl', reward: 'hint' }),
    ];
    K.def('sandedge', {
      name: R.T('map.desert_sandedge.sandedge.name'), kind: 'town', region: 'r_desert', location: 'sandedge', theme: 'desert_town',
      legend: DK.LEGEND({
        D: { mat: 'dune_sand', solid: true, rise: 1, name: 'dune' },
        P: { mat: 'grass', solid: true, name: 'scrub' },
        T: { mat: 'rock', solid: true, rise: 1, name: 'stone_tree' },
      }),
      rows: g, outside: 'dune_sand', objects: O, npcs: N,
      spawns: { gate: { x: 20, y: 26, dir: 'n' }, warp: { x: 20, y: 22, dir: 'n' }, inn: { x: bInn.door.x, y: bInn.door.y + 1, dir: 's' } },
      exits: [{ x: 18, y: 29, w: 4, h: 1, to: { map: 'world', spawn: 'sandedge' } }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'sandedge_arrive' }],
      zones: [], light: DK.LIGHT_TOWN, dark: false, bgm: 'kasim', bbg: 'desert',
      meta: { sub: R.T('map.desert_sandedge.sandedge.meta.sub'), chestsInfo: false },
      // 宿場ぜんたいを 1 枚に描いた下絵（v2/assets/env/desert/under/sandedge*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は上のデータ
      art: { image: 'desert/under/sandedge', emit: 'desert/under/sandedge_emit', painted: [] },
    });

    // 宿と酒場（18×12）
    const { g: gi, door } = K.room(18, 12, {});
    K.rect(gi, 3, 6, 6, 3, 'c'); K.rect(gi, 12, 5, 4, 3, 'c');
    K.def('sandedge_inn', {
      name: R.T('map.desert_sandedge.sandedge_inn.name'), kind: 'interior', region: 'r_desert', location: 'sandedge',
      legend: K.ROOM_LEGEND('wall_sandstone', 'sandstone_floor'), rows: gi, outside: 'wall_sandstone',
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('barrel', 7, 2),
        K.prop('bed', 13, 2), K.prop('bed', 15, 2), K.prop('table', 5, 7), K.prop('stool', 4, 7), K.prop('stool', 6, 7), K.prop('table', 13, 6), K.prop('stool', 14, 6),
        K.prop('lantern', 9, 2), K.prop('lantern', 16, 8), K.prop('clay_jars', 1, 9), K.prop('rug_roll', 16, 5), K.prop('house_plant', 10, 9),
      ],
      npcs: [
        K.npc('keeper', 'npc_desert_old_m', 4, 2, { name: R.T('map.desert_sandedge.sandedge_inn.npcs.0.keeper.name'), title: R.T('map.desert_sandedge.sandedge_inn.npcs.0.keeper.title'), dir: 's', talk: 'sandedge_innkeeper', pushable: false, reward: null }),
        K.npc('drinker', 'npc_caravan', 7, 8, { name: R.T('map.desert_sandedge.sandedge_inn.npcs.1.drinker.name'), dir: 'n', talk: 'sandedge_rumor', reward: 'lead' }),
        K.npc('bard', 'npc_bard', 14, 7, { name: R.T('map.desert_sandedge.sandedge_inn.npcs.2.bard.name'), dir: 'w', talk: 'sandedge_bard', reward: 'news' }),
      ],
      spawns: { door: { x: door.x, y: 10, dir: 'n' } },
      exits: [{ x: door.x, y: 11, w: 1, h: 1, to: { map: 'sandedge', spawn: 'inn' } }],
      triggers: [], light: DK.LIGHT_ROOM, bgm: 'kasim', meta: { minimap: false },
      art: { image: 'desert/under/sandedge_inn', painted: [] },   // 石化した大樹のうろの中（1 枚の描いた部屋。_tools/under/desert2）
    });
  });
})(window.RPG);
