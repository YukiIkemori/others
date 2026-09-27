// ユールの屋内 11（V2_PLAN §2.6.1、WORLD_REDESIGN §5.6、STORY_BIBLE §7.3）:
//   大かまどの集会所（祭の広間・夜数えの板・語り部のイングリッド）・宿「雪あかり亭」・道具屋・武具屋・村長ヨルンの家・火守りの家（ソーニャ）・
//   ブレンダの家（火を盗んだ子ども）・狩人オラフの家（狼と猟師）・釣り小屋（トーレ）・子どもの秘密基地・ノルデン分室の空き家（村はずれ）
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（ユールの戸の前へ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      if (o.paint) o.paint(g);
      return K.def(id, {
        name, kind: 'interior', region: 'r_snow', location: 'yule',
        legend: S.ROOM(), rows: g, outside: 'wall_wood',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'yule', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, S.ROOM_LIGHT, o.light || {}),
        bgm: o.bgm || 'yule',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 大かまどの集会所（祭の広間）22×14
    interior('yule_hall', '大かまどの集会所', 22, 14, {
      back: 'hall', carpet: [7, 5, 8, 5],
      objects: [
        K.prop('stove', 10, 2), K.prop('stove', 11, 2), K.exam(10, 3, 'yule_hall_hearth'),
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('board', 16, 2), K.exam(16, 3, 'yule_nightboard'),   // 夜数えの板
        K.prop('counter', 19, 3), K.exam(19, 4, 'yule_blank_book'),                                                   // 祭の本の書見台
        K.prop('table', 4, 6), K.prop('table', 4, 9), K.prop('chair', 3, 6), K.prop('chair', 5, 6), K.prop('chair', 3, 9), K.prop('chair', 5, 9),
        K.prop('table', 17, 7), K.prop('chair', 16, 7), K.prop('chair', 18, 7), K.prop('bench', 9, 10), K.prop('bench', 13, 10),
        K.prop('firewood', 1, 11), K.prop('firewood', 20, 11), K.prop('lantern', 7, 3), K.prop('lantern', 14, 3), K.prop('lantern', 1, 7), K.prop('lantern', 20, 7),
        K.prop('snow_barrel', 20, 2), K.prop('sack', 1, 4), K.prop('house_plant', 19, 10),
      ],
      npcs: [
        K.npc('ingrid', 'npc_snow_old_f', 12, 4, { name: 'イングリッド', title: '語りの年寄り', dir: 's', talk: 'yule_ingrid', reward: 'lead' }),
        K.npc('hall_helper', 'npc_snow_woman', 17, 6, { name: '祭の手伝い', dir: 'w', talk: 'yule_hall_helper', reward: 'hint' }),
        K.npc('hall_kid', 'npc_snow_child', 8, 8, { name: '村の子', dir: 'e', talk: 'yule_hall_kid', reward: 'hint' }),
      ],
      meta: { sub: '祭の広間' },
    });

    // ---------------------------------------------------------------- 宿「雪あかり亭」16×12
    interior('yule_inn', '雪あかり亭', 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3],
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('stove', 1, 6),
        K.prop('table', 9, 9), K.exam(9, 9, 'yule_inn_desk'),                    // 手紙を書く机（ピムの語り部修行）
        K.prop('snow_barrel', 1, 9), K.prop('firewood', 14, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8),
      ],
      npcs: [
        K.npc('inn_keeper', 'npc_snow_woman', 4, 2, { name: '宿のおかみ', dir: 's', talk: 'yule_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_snow_man', 8, 8, { name: '泊まり客の猟師', dir: 'w', talk: 'yule_inn_guest', reward: 'lead' }),
        K.npc('inn_bard', 'npc_bard_2', 12, 8, { name: '旅の吟遊詩人', dir: 's', talk: 'yule_inn_bard', reward: 'lead' }),
      ],
    });

    // ---------------------------------------------------------------- 道具屋・武具屋 12×10
    interior('yule_items', 'ユールの道具屋', 12, 10, {
      back: 'items',
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('shelf_jars', 9, 2),
        K.prop('snow_barrel', 10, 4), K.prop('crate', 10, 5), K.prop('sack', 1, 6), K.prop('firewood', 1, 7), K.prop('lantern', 2, 4)],
      npcs: [K.npc('item_keeper', 'npc_snow_old_m', 5, 2, { name: '道具屋の主人', dir: 's', talk: 'yule_item_keeper', pushable: false })],
    });
    interior('yule_arms', 'ユールの武具屋', 12, 10, {
      back: 'arms',
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('weapon_rack', 1, 2), K.prop('weapon_rack', 9, 2),
        K.prop('stove', 10, 5), K.prop('crate', 1, 6), K.prop('crate', 1, 7), K.prop('lantern', 8, 4)],
      npcs: [K.npc('smith', 'npc_snow_man', 5, 2, { name: '武具屋の主人', dir: 's', talk: 'yule_smith', pushable: false })],
    });

    // ---------------------------------------------------------------- 村長ヨルンの家・火守りの家 12×10
    interior('yule_jorn', '村長の家', 12, 10, {
      back: 'jorn', carpet: [3, 5, 6, 3],
      objects: [K.prop('bed', 9, 2), K.prop('table', 7, 6), K.prop('chair', 6, 6), K.prop('chair', 8, 6), K.prop('stove', 1, 2), K.prop('bookshelf', 3, 2),   // 戸口の列（x 5）は空ける
        K.exam(3, 3, 'yule_jorn_ledger'), K.prop('firewood', 10, 7), K.prop('lantern', 7, 3)],
      npcs: [K.npc('jorn_wife', 'npc_snow_woman', 6, 4, { name: 'ヨルンのおかみさん', dir: 's', talk: 'yule_jorn_wife', reward: 'item' })],
    });
    interior('yule_sonja', '火守りの家', 12, 10, {
      back: 'sonja',
      objects: [K.prop('stove', 5, 2), K.prop('stove', 6, 2), K.exam(5, 3, 'yule_sonja_fire'), K.exam(6, 3, 'snow_mat', { mat: 'snow_mat_coal' }), K.prop('bed', 1, 2), K.prop('bed', 10, 2), K.prop('table', 3, 6), K.prop('chair', 2, 6),
        K.prop('shelf_jars', 9, 5), K.exam(9, 6, 'yule_sonja_note'), K.prop('firewood', 10, 7), K.prop('lantern', 8, 3), K.chest('yule_sonja_c1', 1, 7, { pool: 'p_T' })],
      npcs: [K.npc('sonja_gran', 'npc_snow_old_f', 7, 5, { name: 'ソーニャの祖母', dir: 'w', talk: 'yule_sonja_gran', reward: 'news' })],
    });

    // ---------------------------------------------------------------- 語りの年寄りの家（ブレンダ・オラフ）12×10
    interior('yule_brenda', 'ブレンダの家', 12, 10, {
      back: 'brenda', carpet: [3, 5, 6, 3],
      objects: [K.prop('stove', 1, 2), K.prop('bed', 9, 2), K.prop('table', 7, 6), K.prop('chair', 6, 6), K.prop('chair', 8, 6), K.prop('rug_roll', 10, 6), K.prop('lantern', 6, 3),   // 戸口の列（x 5）は空ける
        K.prop('shelf_jars', 3, 2), K.prop('house_plant', 10, 7)],
      npcs: [K.npc('brenda', 'npc_snow_old_f', 5, 4, { name: 'ブレンダ', title: '語りの年寄り', dir: 's', talk: 'yule_brenda', reward: 'lead' })],
    });
    interior('yule_hunter', '狩人の家', 12, 10, {
      back: 'hunter',
      objects: [K.prop('stove', 10, 2), K.prop('weapon_rack', 1, 2), K.prop('weapon_rack', 2, 2), K.prop('bed', 8, 2), K.prop('table', 4, 6), K.prop('chair', 3, 6),
        K.prop('firewood', 10, 7), K.prop('crate', 1, 7), K.prop('lantern', 6, 3), K.exam(1, 3, 'yule_hunter_bow')],
      npcs: [K.npc('olaf', 'npc_snow_old_m', 5, 4, { name: 'オラフ', title: '年寄りの猟師', dir: 's', talk: 'yule_olaf', reward: 'lead' })],
    });

    // ---------------------------------------------------------------- 釣り小屋 12×10
    interior('yule_fishhut', '氷上の釣り小屋', 12, 10, {
      back: 'fish',
      objects: [K.prop('stove', 1, 2), K.prop('snow_barrel', 10, 2), K.prop('snow_barrel', 10, 3), K.prop('table', 3, 5), K.prop('chair', 2, 5), K.prop('ice_hole', 8, 6),   // 戸口の列（x 5）は空ける
        K.exam(8, 6, 'yule_fish_hole'), K.prop('sled', 2, 7), K.prop('lantern', 6, 3), K.prop('crate', 10, 7)],
      npcs: [K.npc('fisher', 'npc_snow_old_m', 7, 4, { name: 'トーレ', title: '釣り小屋のじいさま', dir: 's', talk: 'yule_fisher', reward: 'side', pushable: false })],
    });

    // ---------------------------------------------------------------- 子どもの秘密基地（雪の土手をくりぬいた部屋）12×10
    interior('yule_base', '子どもの秘密基地', 12, 10, {
      back: 'base',
      paint: (g) => { K.rect(g, 1, 2, 10, 7, 'f'); },
      objects: [K.prop('rug_roll', 3, 4), K.prop('snow_barrel', 1, 3), K.prop('lantern', 5, 3), K.prop('crate', 9, 3), K.prop('sack', 9, 4),
        K.exam(2, 5, 'yule_base_drawing'), K.chest('yule_base_c1', 9, 6, { pool: 'p_rare' }), K.chest('yule_base_c2', 2, 7, { item: 'i_potion', n: 3 })],
      npcs: [K.npc('pekka_in', 'npc_snow_child', 6, 5, { name: 'ペッカ', dir: 's', talk: 'yule_base_in', reward: 'hint' })],
      light: { ambient: '#707a9a', k: 0.7 },
      meta: { sub: '雪の土手の中' },
    });
    // ---------------------------------------------------------------- ノルデン分室の空き家（村はずれ）12×10
    interior('yule_branch', 'ノルデン分室の空き家', 12, 10, {
      back: 'branch',
      objects: [K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 9, 2), K.prop('table', 5, 4), K.prop('chair', 5, 5), K.exam(5, 4, 'yule_branch_desk'),
        K.prop('crate', 10, 6), K.prop('crate', 10, 7), K.prop('rug_roll', 1, 7), K.exam(1, 3, 'yule_branch_shelf'), K.chest('yule_branch_c1', 8, 7, { pool: 'p_T' })],
      npcs: [],
      light: { ambient: '#5e6284', k: 0.62 },
      bgm: 'sorrow',
      meta: { sub: '記録院の札が、はがれかけている' },
    });
  });
})(window.RPG);
