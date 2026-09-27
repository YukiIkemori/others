// CONTENT-F: フェルンの屋内 6 つ（V2_PLAN §3.2）: 宿「木漏れ日亭」・道具屋・リタの歌の家・捜索隊の詰所・きこり頭ゴードの家・ピムの家
//   どれも K.room（上 2 行が壁の立ち上がり、下の中ほどに 2 マスの戸口）。戸口のマスが出口（フェルンの戸の前へ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const L = K.L;
    const LIGHT = { ambient: '#8a7a9a', k: 0.8, mood: 'interior' };

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      if (o.paint) o.paint(g);
      const m = {
        name, kind: 'interior', region: 'r_forest', location: 'fern',
        legend: K.ROOM_LEGEND(o.wall || 'wall_wood', o.floor || 'wood_floor'),
        rows: g, outside: o.wall || 'wall_wood',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 2, h: 1, to: { map: 'fern', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, LIGHT, o.light || {}),
        bgm: o.bgm || 'village',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      };
      return K.def(id, m);
    }

    // ---------------------------------------------------------------- 宿「木漏れ日亭」16×12
    interior('fern_inn', '木漏れ日亭', 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3],
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('stove', 1, 6),
        K.prop('barrel', 1, 9), K.prop('flower_pot', 9, 2), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8),
      ],
      npcs: [
        K.npc('inn_keeper', 'npc_woman_4', 4, 2, { name: '宿のおかみ', dir: 's', talk: 'fern_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_man_4', 8, 8, { name: '泊まり客', dir: 'w', talk: 'fern_inn_guest', reward: 'lead' }),
      ],
    });

    // ---------------------------------------------------------------- 道具屋 12×10
    interior('fern_shop', 'フェルンの道具屋', 12, 10, {
      back: 'shop',
      objects: [
        K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3),
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 9, 2), K.prop('barrel', 10, 4), K.prop('crate', 10, 5),
        K.prop('sack', 1, 6), K.prop('sack', 1, 7), K.prop('flower_pot', 8, 2), K.prop('lantern', 2, 4),
      ],
      npcs: [
        K.npc('shop_keeper', 'npc_merchant_3', 5, 2, { name: '道具屋の主人', dir: 's', talk: 'fern_shop_keeper', pushable: false }),
      ],
    });

    // ---------------------------------------------------------------- リタの歌の家 14×12（歌あわせ）
    interior('fern_rita', 'リタの歌の家', 14, 12, {
      back: 'rita', carpet: [4, 5, 6, 4], wall: 'wall_bark', floor: 'wood_floor',
      objects: [
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bed', 12, 2), K.prop('table', 10, 6), K.prop('chair', 11, 6),
        K.prop('flower_pot', 5, 2), K.prop('flower_pot', 8, 2), K.prop('lantern', 3, 7), K.prop('lantern', 11, 9),
        K.prop('songstone', 7, 3, { variant: 2 }), K.exam(7, 4, 'fern_rita_stone'),
        K.chest('fern_rita_c1', 12, 9, { item: 'i_potion', n: 1 }),
      ],
      npcs: [
        K.npc('rita', 'npc_rita', 6, 6, { name: 'リタ', title: '歌い手', dir: 's', talk: 'fern_rita', reward: 'lead' }),
        K.npc('rita_pupil', 'npc_child_3', 9, 7, { name: 'リタの弟子', dir: 'w', talk: 'fern_song_game', reward: 'side' }),
      ],
      light: { ambient: '#8a7ca8' },
    });

    // ---------------------------------------------------------------- 捜索隊の詰所 14×10
    interior('fern_search', '捜索隊の詰所', 14, 10, {
      back: 'search', floor: 'wood_floor', wall: 'wall_wood',
      objects: [
        K.prop('table', 5, 4), K.prop('table', 6, 4), K.prop('chair', 4, 5), K.prop('chair', 7, 5), K.prop('board', 2, 2), K.exam(2, 3, 'fern_search_map'),
        K.prop('barrel', 12, 2), K.prop('crate', 12, 3), K.prop('crate', 11, 2), K.prop('sack', 1, 7), K.prop('lantern', 9, 3), K.prop('log', 11, 7),
      ],
      npcs: [
        K.npc('search_chief', 'npc_guard_1', 6, 3, { name: '捜索隊の頭', dir: 's', talk: 'fern_search_chief', reward: 'hint' }),
        K.npc('search_b', 'npc_woodcutter_4', 10, 6, { name: '捜索隊の若者', dir: 'w', talk: [L('ゴードの親方が足をくじいてな。\nおれたちだけじゃ、\n森の奥までは行けねえ。'), L('forest_found_ben', 'ベンが見つかったって？\n……よかった。本当によかった。'), L('cleared_r_forest', '詰所も今夜でおしまいだ。\n今度は祭りの支度だな！')], reward: 'news' }),
      ],
    });

    // ---------------------------------------------------------------- きこり頭ゴードの家 12×10
    interior('fern_gord', 'ゴードの家', 12, 10, {
      back: 'gord', floor: 'wood_floor', wall: 'wall_wood',
      objects: [
        K.prop('bed', 1, 2), K.prop('table', 7, 5), K.prop('chair', 8, 5), K.prop('stove', 10, 2), K.prop('log', 10, 6), K.prop('log', 10, 7),
        K.prop('barrel', 1, 7), K.prop('crate', 4, 2), K.prop('lantern', 6, 3),
      ],
      npcs: [
        K.npc('gord', 'npc_gord', 5, 4, { name: 'ゴード', title: 'きこり頭', dir: 's', talk: 'fern_gord', reward: 'lead', pushable: false }),
      ],
    });

    // ---------------------------------------------------------------- ピムの家（母カトリ）12×10
    interior('fern_pim_home', 'ピムの家', 12, 10, {
      back: 'pim_home', floor: 'wood_floor', wall: 'wall_wood', carpet: [3, 4, 5, 3],
      objects: [
        K.prop('bed', 1, 2), K.prop('bed', 10, 2), K.prop('table', 5, 5), K.prop('chair', 4, 5), K.prop('stove', 7, 2),
        K.prop('flower_pot', 3, 2), K.prop('bookshelf', 9, 7), K.prop('lantern', 2, 6), K.exam(1, 3, 'fern_pim_bed'),
      ],
      npcs: [
        K.npc('katri', 'npc_pim_mother', 6, 4, { name: 'カトリ', title: 'ピムの母', dir: 's', talk: 'fern_pim_mother', reward: 'lead', pushable: false }),
      ],
    });
  });
})(window.RPG);
