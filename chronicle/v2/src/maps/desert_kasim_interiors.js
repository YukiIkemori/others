// CONTENT（砂漠）: カシムの屋内 8 つ（WORLD_REDESIGN §5.5）: 宿「泉の星亭」・酒場「砂時計」・道具屋・地図屋・占いの間（この 3 つは巨像の台座の中）・
//   隊商ギルド・王墓の番アブルの家・井戸掘りの親方の家。どれも K.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。壁は日干しれんが、床は砂岩と敷物。
//   部屋ごとに 1 枚の描いた絵（desert/under/<id>）: 巨像の台座の石室（道具屋・地図屋・占い）・大がめの中（酒場）・獣の肋骨（ギルド）・泥の丸屋根（宿）など、外の建物に合わせた壁と床
//   机・腰掛けは戸口の列（戸口からまっすぐ奥へ）に置かない（持ち主の決まり）。店の台は奥の壁ぎわ（話しかける先）なのでよい。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) for (const c of [].concat(o.carpet.length && Array.isArray(o.carpet[0]) ? o.carpet : [o.carpet])) K.rect(g, c[0], c[1], c[2], c[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_desert', location: 'kasim',
        legend: K.ROOM_LEGEND('wall_sandstone', 'sandstone_floor'),
        rows: g, outside: 'wall_sandstone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'kasim', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, DK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'kasim',
        meta: Object.assign({ minimap: false }, o.meta || {}),
        art: { image: 'desert/under/' + id, painted: [] },   // 1 枚の描いた部屋（外の建物に合わせた壁と床。_tools/under/desert2）。絵が無ければタイルで描く
      });
    }

    // 宿「泉の星亭」18×12（泊まると「消灯の刻まで休む」も選べる＝しんきろうの市）
    interior('kasim_inn', '宿「泉の星亭」', 18, 12, {
      back: 'inn', carpet: [[5, 6, 7, 3], [12, 2, 4, 2]],
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('clay_jars', 7, 2),
        K.prop('bed', 12, 2), K.prop('bed', 14, 2), K.prop('bed', 12, 5), K.prop('bed', 14, 5), K.prop('bed', 16, 5),
        K.prop('table', 6, 7), K.prop('stool', 5, 7), K.prop('stool', 7, 7), K.prop('house_plant', 1, 6), K.prop('rug_roll', 16, 9),
        K.prop('lantern', 9, 3), K.prop('lantern', 15, 8), K.prop('tomb_urn', 1, 9), K.exam(16, 2, 'kasim_inn_window'),
      ],
      npcs: [
        K.npc('inn_keeper', 'npc_desert_old_f', 4, 2, { name: '宿のおかみ', title: '泉の星亭', dir: 's', talk: 'kasim_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_traveler', 9, 8, { name: '泊まり客', dir: 'w', talk: 'kasim_inn_guest', reward: 'lead' }),
      ],
    });
    // 酒場「砂時計」16×11（噂の 3 人）
    interior('kasim_tavern', '酒場「砂時計」', 16, 11, {
      back: 'tavern', carpet: [6, 5, 6, 3],
      objects: [
        K.prop('counter', 2, 3), K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('barrel', 6, 2),
        K.prop('table', 8, 6), K.prop('stool', 9, 6), K.prop('table', 12, 4), K.prop('stool', 13, 4), K.prop('table', 12, 8), K.prop('stool', 11, 8),
        K.prop('lantern', 10, 2), K.prop('lantern', 14, 6), K.prop('clay_jars', 14, 2), K.prop('barrel', 1, 8),
        K.exam(9, 2, 'kasim_tavern_poster'),
      ],
      npcs: [
        K.npc('tavern_master', 'npc_desert_man', 3, 2, { name: '酒場のマスター', dir: 's', talk: 'kasim_tavern_master', pushable: false, reward: null }),
        K.npc('rumor_a', 'npc_desert_woman', 8, 7, { name: 'うわさ好きの女', dir: 'n', talk: 'kasim_rumor_a', reward: 'lead' }),
        K.npc('rumor_b', 'npc_bard', 13, 5, { name: '吟遊詩人', dir: 'w', talk: 'kasim_rumor_b', reward: 'lead' }),
        K.npc('rumor_c', 'npc_merchant_1', 12, 9, { name: '旅の商人', dir: 'n', talk: 'kasim_rumor_c', reward: 'lead' }),
      ],
    });
    // 道具屋 12×10
    interior('kasim_shop', 'カシムの道具屋', 12, 10, {
      back: 'shop',
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('shelf_jars', 9, 2),
        K.prop('clay_jars', 10, 4), K.prop('sack', 1, 6), K.prop('sack', 1, 7), K.prop('crate', 10, 6), K.prop('lantern', 8, 2),
      ],
      npcs: [K.npc('shop_keeper', 'npc_desert_man', 5, 2, { name: '道具屋の主人', dir: 's', talk: 'kasim_shop_keeper', pushable: false })],
    });
    // 地図屋 12×10（宝の地図。ティアで 1 枚ずつ）
    interior('kasim_mapshop', '地図屋', 12, 10, {
      back: 'mapshop', carpet: [3, 5, 6, 2],
      objects: [
        K.prop('table', 6, 4), K.prop('stool', 7, 4), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 9, 2), K.prop('rug_roll', 10, 5),
        K.prop('lantern', 7, 2), K.exam(1, 5, 'kasim_mapshop_wall'),
      ],
      npcs: [K.npc('mapmaker', 'npc_desert_old_m', 6, 3, { name: '地図屋のヤズ', title: '地図屋', dir: 's', talk: 'kasim_mapmaker', pushable: false, reward: 'side' })],
    });
    // 占いの間 12×10（巨像の台座のまん中の部屋。まだ聞いていない噂を 1 つ、手がかり帳に足す。有料）
    interior('kasim_fortune', '占いの間', 12, 10, {
      back: 'fortune', carpet: [2, 3, 8, 5],
      objects: [K.prop('table', 6, 4), K.prop('crystal', 7, 3), K.prop('rug_roll', 1, 7), K.prop('lantern', 2, 2), K.prop('lantern', 9, 2), K.prop('clay_jars', 10, 7)],
      npcs: [K.npc('fortune', 'npc_fortune', 6, 3, { name: '占い師', dir: 's', talk: 'kasim_fortune', pushable: false, reward: 'lead' })],
      light: { ambient: '#6e6090' },
    });
    // 隊商ギルド 18×12（ザイード・事務方・隊商の人）
    interior('kasim_guild', '隊商ギルド', 18, 12, {
      back: 'guild', carpet: [[6, 5, 6, 4]],
      objects: [
        K.prop('counter', 2, 3), K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('board', 8, 2), K.exam(8, 3, 'kasim_board'),
        K.prop('table', 11, 7), K.prop('stool', 12, 7), K.prop('crate', 14, 2), K.prop('crate', 15, 2), K.prop('sack', 16, 3), K.prop('cart_barrels', 15, 8),
        K.prop('lantern', 11, 2), K.prop('lantern', 1, 8), K.prop('carpet_rack', 13, 9), K.exam(1, 3, 'kasim_guild_ledger'),
      ],
      npcs: [
        K.npc('guild_clerk', 'npc_clerk', 3, 2, { name: 'ギルドの帳場', dir: 's', talk: 'kasim_guild_clerk', pushable: false, reward: 'side' }),
        K.npc('zaid_guild', 'npc_zaid', 10, 6, { name: 'ザイード', title: '隊商の長', dir: 'w', talk: 'kasim_zaid', reward: 'lead', cond: ['!desert_caravan_on', '!desert_camp3_done'] }),
        K.npc('caravan_man', 'npc_caravan', 14, 5, { name: '隊商のファド', dir: 's', talk: 'kasim_caravan_man', reward: 'hint' }),
      ],
    });
    // 王墓の番アブルの家 12×10
    interior('kasim_abul', 'アブルの家', 12, 10, {
      back: 'abul', carpet: [3, 5, 5, 2],
      objects: [K.prop('bed', 1, 2), K.prop('table', 7, 5), K.prop('stool', 8, 5), K.prop('tomb_urn', 10, 2), K.prop('shelf_jars', 9, 2), K.prop('lantern', 4, 2), K.exam(6, 2, 'kasim_abul_altar')],
      npcs: [K.npc('abul', 'npc_abul', 5, 4, { name: 'アブル', title: '王墓の番', dir: 's', talk: 'kasim_abul', pushable: false, reward: 'boss' })],
    });
    // 井戸掘りの親方の家 12×10
    interior('kasim_digger', '井戸掘りの家', 12, 10, {
      back: 'digger',
      objects: [K.prop('bed', 10, 2), K.prop('table', 6, 5), K.prop('stool', 7, 5), K.prop('weapon_rack', 1, 2), K.prop('wash_tub', 1, 6), K.prop('sack', 9, 6), K.prop('lantern', 6, 2)],
      npcs: [K.npc('digger', 'npc_desert_old_m', 6, 4, { name: '井戸掘りのオマル', title: '井戸掘りの親方', dir: 's', talk: 'kasim_digger', pushable: false, reward: 'side' })],
    });
  });
})(window.RPG);
