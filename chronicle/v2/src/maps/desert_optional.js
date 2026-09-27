// CONTENT（砂漠）: 砂漠の寄り道の小さな場所（WORLD_REDESIGN §2.7 #8・#9、§4.2 の近道／遠回り）。
//   desert_mirage    蜃気楼の市（#8）: 消灯の刻のあいだだけワールドに灯りの列と入口が出る（宿で「消灯の刻まで休む」＝旗 desert_night）。
//                    入ると、その晩の市は一度きり（desert_night を下ろす）。一品物をティアで入れ替わる 3 品売る。戦闘なし。
//   desert_rocks     金剛トカゲの岩場（#9）: レア魔物の巣（z_desert_rocks、rareEncounters の率が高い）。泉 1・宝箱 3。
//   desert_oldcamp   古い野営跡（近道を選んだとき。砂嵐の中の岩陰）: 宝箱 3・泉（雨水だめ）・前の隊商の書き付け。
//   desert_wellroom  井戸の小屋（遠回りの途中）: 回復の泉と、のどの渇きを癒やす井戸守り。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const deco = (O, list) => { for (const [id, x, y, v] of list) O.push(K.prop(id, x, y, v != null ? { variant: v } : undefined)); };

    // ================================================================ 蜃気楼の市（36×26）
    {
      const W = 36, H = 26;
      const g = K.grid(W, H, 'u');
      K.blob(g, 18, 12, 16, 10, 's', 'mi0');
      K.rect(g, 6, 11, 24, 3, 'k');                         // 市の通り（東西）
      K.rect(g, 17, 5, 3, 20, 'k');                         // 南北
      K.blob(g, 18, 12, 4, 3, 'c', 'mi1', 'k');             // まん中の敷物の広場
      const O = [];
      // 屋台の列（灯りだけの市）
      for (const [x, y] of [[7, 8], [12, 8], [23, 8], [28, 8], [7, 15], [12, 15], [23, 15], [28, 15]]) O.push(K.prop('desert_stall', x, y));
      for (const [x, y] of [[9, 10], [14, 10], [21, 10], [26, 10], [9, 14], [14, 14], [21, 14], [26, 14], [18, 4], [18, 21]]) O.push(K.prop('lantern', x, y));
      O.push(K.prop('copper_brazier', 16, 10), K.prop('copper_brazier', 20, 10), K.prop('copper_brazier', 16, 14), K.prop('copper_brazier', 20, 14));
      deco(O, [['carpet_rack', 5, 12], ['carpet_rack', 31, 12], ['clay_jars', 10, 7], ['clay_jars', 25, 7], ['cart_barrels', 5, 17], ['cart_barrels', 30, 17],
        ['sack', 11, 17], ['crate', 25, 17], ['tent', 4, 7], ['tent', 31, 7], ['desert_palm', 3, 13], ['desert_palm', 33, 11, 1], ['sand_mound', 8, 20], ['sand_mound', 28, 20],
        ['bones', 2, 20], ['cactus', 33, 20], ['obelisk', 18, 2]]);
      O.push(K.exam(18, 3, 'desert_mirage_obelisk'));
      const N = [
        K.npc('m_seller_a', 'npc_desert_old_f', 8, 10, { name: '陽炎の売り手', title: '一品物', dir: 's', talk: 'desert_mirage_seller', pushable: false, reward: 'item' }),
        K.npc('m_seller_b', 'npc_desert_man', 24, 10, { name: '砂うたの売り手', title: '一品物', dir: 's', talk: 'desert_mirage_seller', pushable: false, reward: 'item' }),
        K.npc('m_seller_c', 'npc_merchant_2', 13, 14, { name: '幻の灯の売り手', title: '一品物', dir: 'n', talk: 'desert_mirage_seller', pushable: false, reward: 'item' }),
        K.npc('m_old', 'npc_desert_old_m', 22, 13, { name: '市の古老', dir: 'w', talk: 'desert_mirage_elder', reward: 'news' }),
        K.npc('m_child', 'npc_desert_child', 15, 18, { name: '砂色の子', dir: 'n', talk: 'desert_mirage_child', reward: 'news' }),
        K.npc('m_dancer', 'npc_desert_woman', 27, 13, { name: '揺れる踊り子', dir: 'w', talk: 'desert_mirage_dancer', reward: 'news' }),
        K.npc('m_camel', 'ani_camel', 30, 15, { name: 'ラクダの影', dir: 'w', talk: [L('ラクダの影は、手をのばすと\n砂の粒になって揺れた。')], reward: null }),
      ];
      K.def('desert_mirage', {
        name: '蜃気楼の市', kind: 'town', optional: true, region: 'r_desert', location: 'mirage', theme: 'desert',
        legend: DK.LEGEND(), rows: g, outside: 'dune_sand', objects: O, npcs: N,
        spawns: { road: { x: 18, y: 23, dir: 'n' } },
        exits: [{ x: 17, y: 25, w: 3, h: 1, to: { map: 'world', spawn: 'mirage' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'desert_mirage_arrive' }],
        zones: [], light: { ambient: '#4c4a90', k: 0.4, poolK: 1.8, spillR: 1.8, mood: 'town_night' }, dark: false, bgm: 'desert', bbg: 'desert',
        meta: { sub: '消灯の刻の市', chestsInfo: false },
      });
    }

    // ================================================================ 金剛トカゲの岩場（34×28）
    {
      const W = 34, H = 28;
      const g = K.grid(W, H, 'm');
      K.blob(g, 17, 15, 14, 11, 's', 'rk0');
      K.blob(g, 10, 10, 5, 4, 'k', 'rk1', 's'); K.blob(g, 24, 18, 5, 4, 'k', 'rk2', 's');
      for (const [x, y, rx, ry, sd] of [[16, 12, 2, 2, 'a'], [9, 18, 2, 2, 'b'], [25, 9, 2, 2, 'c'], [20, 21, 1, 1, 'd'], [13, 6, 1, 1, 'e']]) K.blob(g, x, y, rx, ry, 'm', 'rkm' + sd, 's');
      K.rect(g, 16, 24, 3, 4, 'd');
      const O = [];
      O.push(K.spring('desert_rocks_s1', 5, 14));
      O.push(K.chest('desert_rocks_c1', 22, 6, { pool: 'p_T' }), K.chest('desert_rocks_c2', 5, 19, { item: 'i_stone_earth', n: 3 }), K.chest('desert_rocks_c3', 29, 20, { pool: 'p_rare' }));
      O.push(K.sign(19, 24, '金剛トカゲの岩場\n――岩が動いても、驚かぬこと。'));
      O.push(K.exam(12, 21, 'desert_rocks_scales'));
      deco(O, [['rock_small', 7, 7], ['rock_small', 22, 13], ['rock_small', 12, 16], ['bones', 20, 6], ['bones', 8, 23], ['cactus', 28, 13], ['thorn_bush', 5, 9],
        ['sand_mound', 22, 23], ['sand_mound', 26, 11], ['cactus', 11, 3], ['thorn_bush', 30, 16], ['broken_pillar', 17, 4], ['bones', 26, 22]]);
      const N = [K.npc('watcher', 'npc_naturalist', 18, 20, { name: 'トカゲ見の学者', dir: 'n', talk: 'desert_rocks_watcher', reward: 'hint' })];
      K.def('desert_rocks', {
        name: '金剛トカゲの岩場', kind: 'dungeon', optional: true, region: 'r_desert', location: 'rocks', theme: 'desert',
        legend: DK.LEGEND(), rows: g, outside: 'rock', objects: O, npcs: N,
        spawns: { mouth: { x: 17, y: 25, dir: 'n' } },
        exits: [{ x: 16, y: 27, w: 3, h: 1, to: { map: 'world', spawn: 'rocks' } }],
        triggers: [], zones: [{ rect: null, zone: 'z_desert_rocks' }],
        light: DK.LIGHT_OUT, dark: false, bgm: 'desert', bbg: 'desert',
        meta: { chestsInfo: true, sub: 'レア魔物の巣' },
      });
    }

    // ================================================================ 古い野営跡（28×22、近道の砂嵐の中）
    {
      const W = 28, H = 22;
      const g = K.grid(W, H, 'u');
      K.blob(g, 14, 11, 11, 8, 's', 'oc0');
      K.blob(g, 5, 5, 4, 3, 'X', 'oc1', 'su'); K.blob(g, 23, 4, 4, 3, 'X', 'oc2', 'su'); K.blob(g, 24, 16, 3, 4, 'X', 'oc3', 'su'); K.blob(g, 4, 17, 3, 3, 'X', 'oc4', 'su');
      K.blob(g, 14, 12, 4, 3, 'k', 'oc5', 's');
      K.rect(g, 26, 10, 2, 2, 'd');
      const O = [];
      O.push(K.spring('desert_oldcamp_s1', 9, 9));
      O.push(K.chest('desert_oldcamp_c1', 6, 13, { pool: 'p_T' }), K.chest('desert_oldcamp_c2', 19, 6, { gold: 220 }), K.chest('desert_oldcamp_c3', 20, 17, { pool: 'p_rare' }));
      O.push(K.prop('tent', 12, 7), K.prop('tent', 16, 16, { variant: 1 }), K.prop('log', 14, 12), K.prop('log', 15, 13), K.prop('firewood', 13, 12));
      O.push(K.prop('broken_pillar', 17, 9), K.exam(11, 11, 'desert_oldcamp_notes'), K.prop('cart_barrels', 8, 16), K.prop('bones', 21, 11), K.prop('sand_mound', 11, 17), K.prop('clay_jars', 18, 12));
      O.push(K.prop('thorn_bush', 3, 11), K.prop('sand_mound', 22, 8), K.prop('bones', 7, 7));
      K.def('desert_oldcamp', {
        name: '古い野営跡', kind: 'dungeon', optional: true, region: 'r_desert', location: 'camp2', theme: 'desert',
        legend: DK.LEGEND(), rows: g, outside: 'dune_sand', objects: O, npcs: [],
        spawns: { road: { x: 25, y: 10, dir: 'w' } },
        exits: [{ x: 27, y: 10, w: 1, h: 2, to: { map: 'world', spawn: 'oldcamp' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'desert_oldcamp_arrive', once: true }],
        zones: [], light: DK.LIGHT_OUT, dark: false, bgm: 'caravan', bbg: 'desert',
        meta: { chestsInfo: true, sub: '砂嵐の岩陰' },
      });
    }

    // ================================================================ 井戸の小屋（16×12、遠回りの途中）
    {
      const { g, door } = K.room(16, 12, {});
      K.rect(g, 2, 6, 4, 3, 'c');
      K.def('desert_wellroom', {
        name: '古い井戸の小屋', kind: 'interior', optional: true, region: 'r_desert', location: 'camp2',
        legend: K.ROOM_LEGEND('wall_sandstone', 'sandstone_floor'), rows: g, outside: 'wall_sandstone',
        objects: [
          K.spring('desert_wellroom_s1', 10, 4),
          K.prop('bed', 1, 2), K.prop('table', 5, 4), K.prop('stool', 4, 4), K.prop('clay_jars', 14, 2), K.prop('wash_tub', 14, 7), K.prop('lantern', 7, 2), K.prop('sack', 1, 9),
          K.exam(13, 2, 'desert_wellroom_journal'),
        ],
        npcs: [K.npc('wellkeeper', 'npc_desert_old_f', 6, 6, { name: '井戸守りのばあさま', dir: 's', talk: 'desert_wellroom_keeper', reward: 'news' })],
        spawns: { road: { x: door.x, y: 10, dir: 'n' } },
        exits: [{ x: door.x, y: 11, w: 2, h: 1, to: { map: 'world', spawn: 'wellroom' } }],
        triggers: [], light: DK.LIGHT_ROOM, bgm: 'caravan', meta: { minimap: false },
      });
    }
  });
})(window.RPG);
