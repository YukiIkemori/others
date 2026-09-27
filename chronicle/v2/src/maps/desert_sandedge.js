// CONTENT（砂漠）: 宿場「砂の縁」（WORLD_REDESIGN §2.7 #10・§5.14）。森〜砂漠〜灰の街道のまん中の、日干しれんがの隊商宿。
//   sandedge      40×30 の中庭の宿場。まん中に甘い水の井戸（回復の泉）、北に宿の広間（中は sandedge_inn）、東に売り台、
//                 西にラクダのうまや。行商人ロッタ（塩の配達・籠の店）、森と灰から来た旅人（地方をまたぐ話）。
//   sandedge_inn  宿と酒場（うわさ）。
//   町なので宝箱は見える物 1 つだけ。隠し通路は置かない（A27）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const W = 40, H = 30;
    const g = K.grid(W, H, 'u');
    K.blob(g, 20, 15, 19, 14, 's', 'se0');
    // 外壁（日干しれんが）と南の門
    K.rect(g, 3, 2, 34, 1, 'X'); K.rect(g, 3, 25, 34, 1, 'X'); K.rect(g, 3, 2, 1, 24, 'X'); K.rect(g, 36, 2, 1, 24, 'X');
    K.rect(g, 4, 3, 32, 22, 's');
    K.rect(g, 18, 25, 4, 1, 'Q'); K.rect(g, 18, 26, 4, 4, 'd');
    // 中庭の敷石と、井戸のまわり
    K.rect(g, 10, 11, 20, 11, 'Q');
    K.rect(g, 18, 14, 4, 4, 'c');
    K.path(g, [[20, 25], [20, 21]], 'Q', 2);
    // うまや（西）の砂と、売り台の列（東）の粘土
    K.rect(g, 4, 12, 5, 12, 'k'); K.rect(g, 31, 12, 5, 10, 'k');

    const O = [];
    const B = (id, kind, x, y, to, o) => { const b = DK.bld(id, kind, x, y, Object.assign({ to }, o || {})); O.push(b.obj); return b.door; };
    const dInn = B('sandedge_b_inn', 'l', 16, 3, { map: 'sandedge_inn', spawn: 'door' }, { sign: 'inn' });
    B('sandedge_b_store', 's', 6, 4, null);
    B('sandedge_b_house', 's', 29, 4, null);
    // 井戸（甘い水。回復の泉）
    O.push(K.spring('sandedge_spring', 19, 15));
    O.push(K.prop('desert_palm', 17, 13), K.prop('desert_palm', 22, 13, { variant: 1 }), K.prop('desert_palm', 17, 18, { variant: 1 }), K.prop('desert_palm', 22, 18));
    // 売り台（東）とロッタの籠
    O.push(K.prop('desert_stall', 32, 12), K.prop('desert_stall', 32, 16), K.prop('carpet_rack', 34, 20), K.prop('clay_jars', 35, 12), K.prop('sack', 35, 14), K.prop('crate', 35, 17));
    // うまや（西）
    O.push(K.prop('fence', 4, 11), K.prop('fence', 5, 11), K.prop('fence', 6, 11), K.prop('fence', 7, 11), K.prop('fence', 8, 11));
    O.push(K.prop('hay', 5, 13), K.prop('hay', 5, 19), K.prop('wash_tub', 4, 21), K.prop('cart_barrels', 5, 23));
    // 中庭の飾り（灯り・敷物・荷）
    O.push(K.prop('copper_brazier', 11, 12), K.prop('copper_brazier', 28, 12), K.prop('copper_brazier', 11, 20), K.prop('copper_brazier', 28, 20));
    O.push(K.prop('copper_brazier', 17, 24), K.prop('copper_brazier', 22, 24));
    O.push(K.prop('lantern', 14, 9), K.prop('lantern', 25, 9), K.prop('lantern', 9, 4), K.prop('lantern', 32, 4));
    O.push(K.prop('table', 13, 15), K.prop('stool', 12, 15), K.prop('stool', 14, 16), K.prop('table', 26, 16), K.prop('stool', 27, 16), K.prop('stool', 25, 17));
    O.push(K.prop('clay_jars', 12, 4), K.prop('clay_jars', 27, 4), K.prop('sack', 13, 5), K.prop('crate', 26, 5), K.prop('cart_barrels', 12, 22), K.prop('clay_jars', 27, 22));
    O.push(K.prop('tent', 24, 21), K.prop('bones', 38, 28), K.prop('cactus', 1, 27), K.prop('thorn_bush', 38, 5), K.prop('sand_mound', 1, 8), K.prop('cactus', 37, 18));
    O.push(K.prop('house_plant', 15, 9), K.prop('house_plant', 24, 9), K.prop('rug_roll', 9, 9), K.prop('carpet_rack', 30, 9));
    O.push(K.prop('desert_palm', 5, 8, { variant: 1 }), K.prop('desert_palm', 34, 8));
    O.push(K.sign(23, 26, '宿場「砂の縁」\n北 → ヴェルダの森　南 → カシム\n東の峠 → 灰の荒野（崩れで通れない）'));
    O.push(K.exam(9, 5, 'sandedge_notice'));
    O.push(K.chest('sandedge_c1', 7, 22, { item: 'i_potion', n: 2 }));          // 見える宝箱（うまやの隅）
    const N = [
      K.npc('lotta', 'npc_lotta', 33, 14, { name: '行商人ロッタ', title: '背負い籠の店', dir: 'w', talk: 'sandedge_lotta', pushable: false, reward: 'side' }),
      K.npc('stall', 'npc_desert_man', 33, 18, { name: '売り台の男', title: '道具', dir: 'w', talk: 'sandedge_shop', pushable: false, reward: null }),
      K.npc('stable', 'npc_desert_child', 7, 16, { name: 'うまやの子', dir: 'e', talk: 'sandedge_stable', reward: 'news' }),
      K.npc('camel_a', 'ani_camel', 6, 14, { name: 'ラクダ', dir: 'e', talk: [L('ラクダが、長いまつげの下から\nこちらを見ている。')], reward: null }),
      K.npc('camel_b', 'ani_camel', 6, 19, { name: 'ラクダ', dir: 'e', talk: [L('ラクダは、干し草を\nもぐもぐかんでいる。')], reward: null }),
      K.npc('forest_trav', 'npc_traveler', 13, 16, { name: '森から来た木こり', dir: 'e', talk: 'sandedge_forest_traveler', reward: 'news' }),
      K.npc('ash_trav', 'npc_ash_fighter', 27, 15, { name: '灰まみれの兵', dir: 'w', talk: 'sandedge_ash_traveler', reward: 'lead' }),
      K.npc('well_girl', 'npc_desert_child', 21, 19, { name: '水くみの娘', dir: 'n', talk: 'sandedge_well_girl', reward: 'hint' }),
    ];
    K.def('sandedge', {
      name: '宿場「砂の縁」', kind: 'town', region: 'r_desert', location: 'sandedge', theme: 'desert_town',
      legend: DK.LEGEND(), rows: g, outside: 'dune_sand', objects: O, npcs: N,
      spawns: { gate: { x: 20, y: 24, dir: 'n' }, warp: { x: 20, y: 22, dir: 'n' }, inn: { x: dInn.x, y: dInn.y + 1, dir: 's' } },
      exits: [{ x: 18, y: 29, w: 4, h: 1, to: { map: 'world', spawn: 'sandedge' } }],
      triggers: [{ id: 'arrive', on: 'enter', event: 'sandedge_arrive' }],
      zones: [], light: DK.LIGHT_TOWN, dark: false, bgm: 'kasim', bbg: 'desert',
      meta: { sub: '街道のまん中の宿', chestsInfo: true },
    });

    // 宿と酒場（18×12）
    const { g: gi, door } = K.room(18, 12, {});
    K.rect(gi, 3, 6, 6, 3, 'c'); K.rect(gi, 12, 5, 4, 3, 'c');
    K.def('sandedge_inn', {
      name: '砂の縁の宿', kind: 'interior', region: 'r_desert', location: 'sandedge',
      legend: K.ROOM_LEGEND('wall_sandstone', 'sandstone_floor'), rows: gi, outside: 'wall_sandstone',
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('barrel', 7, 2),
        K.prop('bed', 13, 2), K.prop('bed', 15, 2), K.prop('table', 5, 7), K.prop('stool', 4, 7), K.prop('stool', 6, 7), K.prop('table', 13, 6), K.prop('stool', 14, 6),
        K.prop('lantern', 9, 2), K.prop('lantern', 16, 8), K.prop('clay_jars', 1, 9), K.prop('rug_roll', 16, 5), K.prop('house_plant', 10, 9),
      ],
      npcs: [
        K.npc('keeper', 'npc_desert_old_m', 4, 2, { name: '宿の主人', title: '砂の縁', dir: 's', talk: 'sandedge_innkeeper', pushable: false, reward: null }),
        K.npc('drinker', 'npc_caravan', 7, 8, { name: '隊商の男', dir: 'n', talk: 'sandedge_rumor', reward: 'lead' }),
        K.npc('bard', 'npc_bard', 14, 7, { name: '旅の楽士', dir: 'w', talk: 'sandedge_bard', reward: 'news' }),
      ],
      spawns: { door: { x: door.x, y: 10, dir: 'n' } },
      exits: [{ x: door.x, y: 11, w: 2, h: 1, to: { map: 'sandedge', spawn: 'inn' } }],
      triggers: [], light: DK.LIGHT_ROOM, bgm: 'kasim', meta: { minimap: false },
    });
  });
})(window.RPG);
