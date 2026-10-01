// オルビスの屋内 16（WORLD_REDESIGN §5.12・§4.8、STORY_BIBLE §7.8・§8.9）:
//   宿「星明かり亭」・酒場「星見の杯亭」・道具屋・武具屋・学院の術具店・仕立屋・洗濯場・図書館（司書・学長・試験官・学生セレス）・
//   天文台（ルカ・望遠鏡・観測録）・守衛室・記録院の出張所・研究者の家 2・町の家 3。
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（オルビスの戸の前へ）。
//   白い石の壁と木の床（学術都市の家）。図書館と天文台は石の床に敷物。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, SK = R.Star.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_star', location: 'orbis',
        legend: SK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'orbis', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, SK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'town',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 宿「星明かり亭」（恋文の学生ティモ・旅人）
    interior('orbis_inn', R.T('map.star_orbis_interiors.orbis_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3], meta: { sub: R.T('map.star_orbis_interiors.orbis_inn.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 8), K.prop('chair', 5, 8), K.prop('chair', 7, 8), K.prop('globe', 1, 7), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_star_woman', 4, 2, { name: R.T('map.star_orbis_interiors.orbis_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'orbis_inn_keeper', pushable: false }),
        K.npc('student_letter', 'npc_student', 12, 8, { name: R.T('map.star_orbis_interiors.orbis_inn.npcs.1.student_letter.name'), dir: 'w', talk: 'star_student_letter', reward: 'item' }),
      ],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
    });
    // ---------------------------------------------------------------- 酒場「星見の杯亭」（夜番の年寄り・旅人・亭主）
    interior('orbis_tavern', R.T('map.star_orbis_interiors.orbis_tavern'), 16, 12, {
      back: 'tavern', carpet: [6, 6, 6, 3], bgm: 'tavern', meta: { sub: R.T('map.star_orbis_interiors.orbis_tavern.meta.sub') },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2), K.prop('keg_rack', 13, 2, { w: 2 }),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 5, 8), K.prop('chair', 6, 8), K.prop('wall_chart', 9, 1), K.prop('lantern', 8, 3), K.prop('lantern', 14, 6)],
      npcs: [
        K.npc('barkeep', 'npc_star_man', 5, 2, { name: R.T('map.star_orbis_interiors.orbis_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'orbis_barkeep', reward: 'news', pushable: false }),
        K.npc('old_watch', 'npc_night_guard', 12, 9, { name: R.T('map.star_orbis_interiors.orbis_tavern.npcs.1.old_watch.name'), dir: 'w', talk: 'star_old_watch', reward: 'item' }),
        K.npc('traveler', 'npc_traveler', 4, 8, { name: R.T('map.star_orbis_interiors.orbis_tavern.npcs.2.traveler.name'), dir: 'e', talk: 'orbis_traveler', reward: 'lead' }),
      ],
    });
    // ---------------------------------------------------------------- 道具屋・武具屋・学院の術具店
    interior('orbis_items', R.T('map.star_orbis_interiors.orbis_items'), 12, 10, {
      back: 'items', meta: { sub: R.T('map.star_orbis_interiors.orbis_items.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('crate', 1, 6), K.prop('flower_pot', 10, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_star_woman', 5, 2, { name: R.T('map.star_orbis_interiors.orbis_items.npcs.0.item_keeper.name'), dir: 's', talk: 'orbis_item_keeper', pushable: false })],
    });
    interior('orbis_arms', R.T('map.star_orbis_interiors.orbis_arms'), 12, 10, {
      back: 'arms', meta: { sub: R.T('map.star_orbis_interiors.orbis_arms.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('armor_stand', 9, 2), K.prop('shield_rack', 9, 5, { w: 2 }),
        K.prop('weapon_rack', 1, 2), K.prop('lantern', 8, 3)],
      npcs: [K.npc('smith', 'npc_star_man', 5, 2, { name: R.T('map.star_orbis_interiors.orbis_arms.npcs.0.smith.name'), dir: 's', talk: 'orbis_smith', pushable: false })],
    });
    interior('orbis_magic', R.T('map.star_orbis_interiors.orbis_magic'), 12, 10, {
      back: 'magic', carpet: [3, 5, 6, 2], meta: { sub: R.T('map.star_orbis_interiors.orbis_magic.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('bookshelf', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('star_dial', 10, 6), K.prop('book_stack', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('magic_keeper', 'npc_star_old_f', 5, 2, { name: R.T('map.star_orbis_interiors.orbis_magic.npcs.0.magic_keeper.name'), dir: 's', talk: 'orbis_magic_keeper', pushable: false })],
    });
    // ---------------------------------------------------------------- 仕立屋（学院の制服を売る）・洗濯場（制服を借りる・恋文の相手イーダ）
    interior('orbis_tailor', R.T('map.star_orbis_interiors.orbis_tailor'), 12, 10, {
      back: 'tailor', meta: { sub: R.T('map.star_orbis_interiors.orbis_tailor.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('spinning_wheel', 9, 2), K.prop('rug_roll', 1, 2), K.prop('dresser', 10, 5),
        K.prop('table', 7, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('tailor', 'npc_star_woman', 4, 2, { name: R.T('map.star_orbis_interiors.orbis_tailor.npcs.0.tailor.name'), dir: 's', talk: 'star_tailor', reward: 'item', pushable: false })],
    });
    interior('orbis_laundry', R.T('map.star_orbis_interiors.orbis_laundry'), 14, 10, {
      back: 'laundry', floor: 'stone_floor', meta: { sub: R.T('map.star_orbis_interiors.orbis_laundry.meta.sub') },
      objects: [K.prop('wash_tub', 2, 3), K.prop('wash_tub', 4, 3), K.prop('water_urn', 11, 2), K.prop('basket_bread', 8, 3), K.prop('table', 9, 6), K.prop('sack', 1, 6), K.prop('lantern', 6, 3)],
      npcs: [
        K.npc('laundress', 'npc_star_old_f', 7, 5, { name: R.T('map.star_orbis_interiors.orbis_laundry.npcs.0.laundress.name'), dir: 's', talk: 'star_laundress', reward: 'item' }),
        K.npc('ida', 'npc_star_woman', 3, 6, { name: R.T('map.star_orbis_interiors.orbis_laundry.npcs.1.ida.name'), dir: 'e', talk: 'star_ida', reward: 'news' }),
      ],
    });
    // ---------------------------------------------------------------- 図書館（司書・学長（昼）・書記・試験官・学生セレス・前の学長の辞表）
    interior('orbis_library', R.T('map.star_orbis_interiors.orbis_library'), 20, 14, {
      back: 'library', floor: 'stone_floor', carpet: [7, 6, 6, 5], meta: { sub: R.T('map.star_orbis_interiors.orbis_library.meta.sub') },
      objects: [K.prop('bookshelf', 1, 2), K.prop('bookshelf', 3, 2), K.prop('bookshelf', 5, 2), K.prop('bookshelf', 13, 2), K.prop('bookshelf', 15, 2), K.prop('bookshelf', 17, 2),
        K.prop('bookshelf', 1, 6), K.prop('bookshelf', 1, 9), K.prop('bookshelf', 18, 6), K.prop('bookshelf', 18, 9),
        K.prop('counter', 8, 3), K.prop('counter', 9, 3), K.prop('counter', 10, 3), K.prop('lectern', 12, 7), K.prop('table', 5, 9), K.prop('chair', 4, 9), K.prop('chair', 6, 9),
        K.prop('book_cart', 15, 10), K.prop('globe', 16, 5), K.prop('lantern', 11, 3), K.prop('lantern', 3, 11),
        K.exam(17, 2, 'star_resignation'), K.exam(12, 7, 'orbis_library_lectern')],
      npcs: [
        K.npc('librarian', 'npc_star_old_f', 9, 2, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.0.librarian.name'), dir: 's', talk: 'star_librarian', reward: 'lead', pushable: false }),
        K.npc('octavia', 'npc_octavia', 14, 8, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.1.octavia.name'), dir: 'w', talk: 'star_octavia_day', reward: 'hint', cond: '!star_octavia_done' }),
        K.npc('octavia_head', 'npc_octavia', 14, 8, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.2.octavia_head.name'), dir: 'w', talk: 'star_octavia_after', reward: 'news', cond: ['cleared_r_star', '!star_riot'] }),
        K.npc('lib_clerk', 'npc_clerk', 15, 11, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.3.lib_clerk.name'), dir: 'n', talk: 'orbis_lib_clerk', reward: 'news', cond: '!star_octavia_done' }),
        K.npc('examiner', 'npc_star_old_m', 4, 5, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.4.examiner.name'), dir: 's', talk: 'star_examiner', reward: 'side' }),
        K.npc('student_exam', 'npc_student', 7, 11, { name: R.T('map.star_orbis_interiors.orbis_library.npcs.5.student_exam.name'), dir: 'e', talk: 'star_student_exam', reward: 'item' }),
      ],
    });
    // ---------------------------------------------------------------- 天文台（ルカ・望遠鏡・観測録）
    interior('orbis_observatory', R.T('map.star_orbis_interiors.orbis_observatory'), 18, 14, {
      back: 'observatory', floor: 'stone_floor', carpet: [6, 6, 6, 4], meta: { sub: R.T('map.star_orbis_interiors.orbis_observatory.meta.sub') },
      objects: [K.prop('telescope', 8, 3), K.exam(8, 3, 'star_telescope'), K.prop('orrery', 14, 4), K.prop('writing_desk', 3, 3), K.exam(3, 3, 'star_obs_log'),
        K.prop('bookshelf', 1, 2), K.prop('wall_chart', 5, 1), K.prop('wall_chart', 12, 1), K.prop('globe', 15, 9), K.prop('book_stack', 2, 9), K.prop('lantern', 11, 3)],
      npcs: [
        K.npc('luca', 'npc_luka', 6, 5, { name: R.T('map.star_orbis_interiors.orbis_observatory.npcs.0.luca.name'), title: R.T('map.star_orbis_interiors.orbis_observatory.npcs.0.luca.title'), dir: 's', talk: 'star_luca', reward: 'lead' }),
        K.npc('octavia_obs', 'npc_octavia', 12, 7, { name: R.T('map.star_orbis_interiors.orbis_observatory.npcs.1.octavia_obs.name'), title: R.T('map.star_orbis_interiors.orbis_observatory.npcs.1.octavia_obs.title'), dir: 's', talk: 'star_octavia_after', reward: 'news', cond: ['cleared_r_star', 'star_riot'] }),
      ],
    });
    // ---------------------------------------------------------------- 守衛室・記録院の出張所
    interior('orbis_guardroom', R.T('map.star_orbis_interiors.orbis_guardroom'), 12, 10, {
      back: 'guardroom', floor: 'stone_floor', meta: { sub: R.T('map.star_orbis_interiors.orbis_guardroom.meta.sub') },
      objects: [K.prop('table', 5, 5), K.prop('chair', 4, 5), K.prop('chair', 6, 5), K.prop('weapon_rack', 1, 2), K.prop('bed', 10, 2), K.prop('board', 7, 1), K.prop('lantern', 8, 3)],
      npcs: [K.npc('guard_captain', 'npc_night_guard', 5, 3, { name: R.T('map.star_orbis_interiors.orbis_guardroom.npcs.0.guard_captain.name'), dir: 's', talk: 'orbis_guard_captain', reward: 'hint', pushable: false })],
    });
    interior('orbis_records', R.T('map.star_orbis_interiors.orbis_records'), 12, 10, {
      back: 'records', floor: 'stone_floor', meta: { sub: R.T('map.star_orbis_interiors.orbis_records.meta.sub') },
      objects: [K.prop('writing_desk', 5, 3), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 9, 2), K.prop('board', 7, 1), K.exam(7, 1, 'orbis_records_board'), K.prop('book_stack', 10, 6), K.prop('lantern', 3, 3)],
      npcs: [K.npc('records_clerk', 'npc_scribe', 5, 4, { name: R.T('map.star_orbis_interiors.orbis_records.npcs.0.records_clerk.name'), dir: 's', talk: 'orbis_records_clerk', reward: 'news', pushable: false })],
    });
    // ---------------------------------------------------------------- 研究者の家・町の家
    interior('orbis_house4', R.T('map.star_orbis_interiors.orbis_house4'), 12, 10, {
      back: 'house4', meta: { sub: R.T('map.star_orbis_interiors.orbis_house4.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('writing_desk', 6, 3), K.prop('bookshelf', 9, 2), K.prop('telescope', 10, 6), K.prop('book_stack', 1, 6), K.prop('lantern', 4, 3)],
      npcs: [K.npc('scholar_w', 'npc_star_woman', 6, 5, { name: R.T('map.star_orbis_interiors.orbis_house4.npcs.0.scholar_w.name'), dir: 's', talk: 'orbis_scholar_w', reward: 'news' })],
    });
    interior('orbis_house5', R.T('map.star_orbis_interiors.orbis_house5'), 12, 10, {
      back: 'house5', meta: { sub: R.T('map.star_orbis_interiors.orbis_house5.meta.sub') },
      objects: [K.prop('bed', 9, 2), K.prop('table', 4, 5), K.prop('chair', 3, 5), K.prop('bookshelf', 1, 2), K.prop('star_dial', 10, 6), K.prop('lantern', 6, 3)],
      npcs: [K.npc('old_scholar', 'npc_star_old_m', 5, 3, { name: R.T('map.star_orbis_interiors.orbis_house5.npcs.0.old_scholar.name'), dir: 's', talk: 'orbis_old_scholar', reward: 'news' })],
    });
    interior('orbis_house', R.T('map.star_orbis_interiors.orbis_house'), 12, 10, {
      back: 'house', meta: { sub: R.T('map.star_orbis_interiors.orbis_house.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('cupboard', 6, 2), K.prop('lantern', 7, 3)],
      npcs: [K.npc('house_mother', 'npc_star_woman', 6, 4, { name: R.T('map.star_orbis_interiors.orbis_house.npcs.0.house_mother.name'), dir: 's', talk: 'orbis_house_mother', reward: 'news' })],
    });
    interior('orbis_house2', R.T('map.star_orbis_interiors.orbis_house2'), 12, 10, {
      back: 'house2', meta: { sub: R.T('map.star_orbis_interiors.orbis_house2.meta.sub') },
      objects: [K.prop('bed', 9, 2), K.prop('table', 4, 5), K.prop('chair', 3, 5), K.prop('fireplace', 1, 2), K.prop('lantern', 6, 3)],
      npcs: [K.npc('house2_old', 'npc_star_old_f', 5, 3, { name: R.T('map.star_orbis_interiors.orbis_house2.npcs.0.house2_old.name'), dir: 's', talk: 'orbis_house2_old', reward: 'news' })],
    });
    interior('orbis_house3', R.T('map.star_orbis_interiors.orbis_house3'), 12, 10, {
      back: 'house3', meta: { sub: R.T('map.star_orbis_interiors.orbis_house3.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('table', 6, 5), K.prop('chair', 5, 5), K.prop('bookshelf', 9, 2), K.prop('lantern', 4, 3)],
      npcs: [K.npc('house3_kid', 'npc_star_child', 6, 7, { name: R.T('map.star_orbis_interiors.orbis_house3.npcs.0.house3_kid.name'), dir: 's', talk: 'orbis_house3_kid', reward: 'hint' })],
    });
  });
})(window.RPG);
