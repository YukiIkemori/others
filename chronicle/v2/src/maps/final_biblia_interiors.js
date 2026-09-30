// CONTENT（終盤）: ビブリアの屋内（STORY_BIBLE §9.3 の 2・§5.1「書斎」・§6.5、WORLD_REDESIGN §5.13）:
//   ノアの宿「しおり亭」（ノア。ただで泊まれる）・記録院 本院（白紙の帳面の広間。奥の扉が院長の書斎）・院長の書斎（ミラの肖像画・
//   白紙の暁の詞・代理試合の立会記録・くべられなかった手紙の箱）・大図書館（紋章の大陸の伝説）・酒場「白紙亭」（うわさ）・白紙堂（店）・家 2。
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。白い石の壁と木の床（書の都の家）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, FK = R.Final.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      for (const [x, y] of o.open || []) g[y][x] = 'd';
      return K.def(id, {
        name, kind: 'interior', region: 'finale', location: 'biblia',
        legend: FK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: o.backMap || 'biblia', spawn: o.back } }].concat(o.exits || []),
        triggers: o.triggers || [],
        light: Object.assign({}, FK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'sorrow',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- ノアの宿「しおり亭」
    interior('biblia_inn', R.T('map.final_biblia_interiors.biblia_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3], meta: { sub: R.T('map.final_biblia_interiors.biblia_inn.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 8), K.prop('chair', 5, 8), K.prop('chair', 7, 8), K.prop('flower_pot', 1, 7), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8),
        K.prop('wall_painting', 7, 1), K.exam(7, 1, 'biblia_inn_song')],
      npcs: [K.npc('noa', 'noa', 4, 2, { name: R.T('map.final_biblia_interiors.biblia_inn.npcs.0.noa.name'), title: R.T('map.final_biblia_interiors.biblia_inn.npcs.0.noa.title'), dir: 's', talk: 'biblia_noa', pushable: false })],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
    });

    // ---------------------------------------------------------------- 記録院 本院（奥の扉 → 院長の書斎）
    interior('biblia_records', R.T('map.final_biblia_interiors.biblia_records'), 20, 12, {
      back: 'records', floor: 'stone_floor', carpet: [9, 2, 2, 9], open: [[10, 1]], meta: { sub: R.T('map.final_biblia_interiors.biblia_records.meta.sub') },
      objects: [K.prop('writing_desk', 3, 4), K.prop('writing_desk', 6, 4), K.prop('writing_desk', 13, 4), K.prop('writing_desk', 16, 4),
        K.prop('writing_desk', 3, 7), K.prop('writing_desk', 6, 7), K.prop('writing_desk', 13, 7), K.prop('writing_desk', 16, 7),
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 17, 2), K.prop('bookshelf', 18, 2),
        K.prop('candelabra', 8, 2), K.prop('candelabra', 12, 2), K.prop('door', 10, 1), K.prop('wall_painting', 5, 1),
        K.exam(5, 1, 'biblia_lazaro_portrait'), K.exam(6, 4, 'biblia_blank_ledger'), K.exam(13, 7, 'biblia_blank_ledger')],
      npcs: [K.npc('clerk', 'npc_scribe', 15, 9, { name: R.T('map.final_biblia_interiors.biblia_records.npcs.0.clerk.name'), dir: 'w', talk: 'biblia_clerk', reward: 'news' })],
      exits: [{ x: 10, y: 1, w: 1, h: 1, to: { map: 'biblia_study', spawn: 'door' } }],
      spawns: { study: { x: 10, y: 2, dir: 's' } },
    });

    // ---------------------------------------------------------------- 院長の書斎（任意、北の門へ行く前。§5.1 の「書斎」）
    interior('biblia_study', R.T('map.final_biblia_interiors.biblia_study'), 14, 10, {
      back: 'study', backMap: 'biblia_records', carpet: [4, 4, 6, 3], meta: { sub: R.T('map.final_biblia_interiors.biblia_study.meta.sub') },
      objects: [K.prop('writing_desk', 6, 3), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 11, 2), K.prop('bookshelf', 12, 2),
        K.prop('wall_painting', 9, 1), K.prop('wall_window', 4, 1), K.prop('candelabra', 8, 3), K.prop('crate', 11, 6), K.prop('chair', 6, 4),
        K.exam(9, 1, 'biblia_mira_portrait'), K.exam(6, 3, 'biblia_mira_dawnword'), K.exam(12, 2, 'biblia_arena_record'), K.exam(11, 2, 'biblia_arena_record'),
        K.exam(11, 6, 'biblia_letters_box')],
    });

    // ---------------------------------------------------------------- 大図書館（紋章の大陸の伝説。4 階の三つの影の前ぶれ）
    interior('biblia_library', R.T('map.final_biblia_interiors.biblia_library'), 18, 12, {
      back: 'library', floor: 'stone_floor', carpet: [8, 3, 2, 8], meta: { sub: R.T('map.final_biblia_interiors.biblia_library.meta.sub') },
      objects: [K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 3, 2), K.prop('bookshelf', 14, 2), K.prop('bookshelf', 15, 2), K.prop('bookshelf', 16, 2),
        K.prop('bookshelf', 2, 5), K.prop('bookshelf', 3, 5), K.prop('bookshelf', 4, 5), K.prop('bookshelf', 13, 5), K.prop('bookshelf', 14, 5), K.prop('bookshelf', 15, 5),
        K.prop('writing_desk', 9, 2), K.prop('candelabra', 7, 2), K.prop('candelabra', 11, 2), K.prop('table', 4, 8), K.prop('chair', 5, 8),
        K.exam(9, 2, 'biblia_tome'), K.exam(15, 5, 'biblia_shelves')],
      npcs: [K.npc('librarian', 'npc_old_f_1', 12, 8, { name: R.T('map.final_biblia_interiors.biblia_library.npcs.0.librarian.name'), dir: 'w', talk: 'biblia_librarian', reward: 'news' })],
    });

    // ---------------------------------------------------------------- 酒場「白紙亭」（白紙になりかけの人々の最後のうわさ。WORLD §5.13）
    interior('biblia_tavern', R.T('map.final_biblia_interiors.biblia_tavern'), 16, 12, {
      back: 'tavern', carpet: [6, 6, 6, 3], bgm: 'tavern', meta: { sub: R.T('map.final_biblia_interiors.biblia_tavern.meta.sub') },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2), K.prop('keg_rack', 14, 2),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 5, 8), K.prop('chair', 6, 8), K.prop('lantern', 8, 3), K.prop('lantern', 14, 6)],
      npcs: [
        K.npc('barkeep', 'npc_man_2', 5, 2, { name: R.T('map.final_biblia_interiors.biblia_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'biblia_barkeep', reward: 'news', pushable: false }),
        K.npc('rumor_a', 'npc_old_m_2', 12, 9, { name: R.T('map.final_biblia_interiors.biblia_tavern.npcs.1.rumor_a.name'), dir: 'w', talk: 'biblia_rumor_a', reward: 'news' }),
        K.npc('rumor_b', 'npc_woman_1', 9, 5, { name: R.T('map.final_biblia_interiors.biblia_tavern.npcs.2.rumor_b.name'), dir: 'e', talk: 'biblia_rumor_b', reward: 'news' }),
        K.npc('rumor_c', 'npc_man_1', 4, 8, { name: R.T('map.final_biblia_interiors.biblia_tavern.npcs.3.rumor_c.name'), dir: 'e', talk: 'biblia_rumor_c', reward: 'news' }),
      ],
    });

    // ---------------------------------------------------------------- 白紙堂（道具と武具）
    interior('biblia_shop', R.T('map.final_biblia_interiors.biblia_shop'), 14, 10, {
      back: 'shop', meta: { sub: R.T('map.final_biblia_interiors.biblia_shop.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('weapon_rack', 11, 2), K.prop('armor_stand', 12, 5), K.prop('crate', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('shopkeeper', 'npc_merchant_1', 5, 2, { name: R.T('map.final_biblia_interiors.biblia_shop.npcs.0.shopkeeper.name'), dir: 's', talk: 'biblia_shopkeeper', pushable: false })],
    });

    // ---------------------------------------------------------------- 家（名前を忘れかけた母と子・年寄りの夫婦）
    interior('biblia_house3', R.T('map.final_biblia_interiors.biblia_house3'), 12, 10, {
      back: 'house3', meta: { sub: R.T('map.final_biblia_interiors.biblia_house3.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 2, 2), K.prop('table', 7, 5), K.prop('chair', 6, 5), K.prop('chair', 8, 5), K.prop('stove', 9, 2), K.prop('cupboard', 5, 2), K.prop('lantern', 10, 7)],
      npcs: [
        K.npc('mother', 'npc_woman_2', 4, 5, { name: R.T('map.final_biblia_interiors.biblia_house3.npcs.0.mother.name'), dir: 'e', talk: 'biblia_mother', reward: 'news' }),
        K.npc('boy', 'npc_child_3', 8, 7, { name: R.T('map.final_biblia_interiors.biblia_house3.npcs.1.boy.name'), dir: 'w', talk: 'biblia_boy', reward: 'news' }),
      ],
    });
    interior('biblia_house5', R.T('map.final_biblia_interiors.biblia_house5'), 12, 10, {
      back: 'house5', meta: { sub: R.T('map.final_biblia_interiors.biblia_house5.meta.sub') },
      objects: [K.prop('double_bed', 1, 2), K.prop('table', 7, 5), K.prop('chair', 6, 5), K.prop('chair', 8, 5), K.prop('fireplace', 9, 2), K.prop('bookshelf', 5, 2), K.prop('spinning_wheel', 2, 7), K.prop('lantern', 10, 7)],
      npcs: [
        K.npc('old_wife', 'npc_old_f_1', 6, 4, { name: R.T('map.final_biblia_interiors.biblia_house5.npcs.0.old_wife.name'), dir: 's', talk: 'biblia_old_wife', reward: 'news' }),
        K.npc('old_husband', 'npc_old_m_2', 8, 6, { name: R.T('map.final_biblia_interiors.biblia_house5.npcs.1.old_husband.name'), dir: 'w', talk: 'biblia_old_husband', reward: 'news' }),
      ],
    });
  });
})(window.RPG);
