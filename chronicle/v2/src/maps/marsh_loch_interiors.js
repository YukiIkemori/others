// ロッホの屋内 10（V2_PLAN §2.6.1、WORLD_REDESIGN §5.7・§4.4、STORY_BIBLE §7.4・§8.5）:
//   大鐘の館の 3 つ（道具屋・酒場「鐘の腹」・武具屋）・集会所（推理の集会）・鐘楼（トビアス。記録帳と貸し出し簿 = 証拠 2）・宿「霧笛亭」・
//   町長の家・エマの家（妹リナの絵 = 証拠 4、静夜会のイェナ）・人形師ベッポの店（消えた子に似た人形 = 証拠 3）・記録院ロッホ出張所（クラウス。机の引き出しの手紙）
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（ロッホの戸の前へ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Marsh.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      if (o.paint) o.paint(g);
      return K.def(id, {
        name, kind: 'interior', region: 'r_marsh', location: 'loch',
        legend: Object.assign(MK.ROOM(), o.legend || {}), rows: g, outside: 'wall_wood',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'loch', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, MK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'marsh',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 大鐘の館: 道具屋・酒場・武具屋（鐘の内側。緑青の曲がった壁）
    interior('loch_items', R.T('map.marsh_loch_interiors.loch_items'), 12, 10, {
      back: 'items', meta: { sub: R.T('map.marsh_loch_interiors.loch_items.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('fish_trap', 10, 5), K.prop('crate', 1, 6), K.prop('basket_veg', 10, 7), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_marsh_woman', 5, 2, { name: R.T('map.marsh_loch_interiors.loch_items.npcs.0.item_keeper.name'), dir: 's', talk: 'loch_item_keeper', pushable: false })],
    });
    interior('loch_tavern', R.T('map.marsh_loch_interiors.loch_tavern'), 16, 12, {
      back: 'tavern', carpet: [5, 6, 6, 3], bgm: 'tavern', meta: { sub: R.T('map.marsh_loch_interiors.loch_tavern.meta.sub') },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2), K.prop('keg_rack', 13, 2, { w: 2 }),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 3, 8), K.prop('chair', 2, 8), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8), K.prop('wall_painting', 10, 1)],
      npcs: [
        K.npc('barkeep', 'npc_marsh_old_m', 5, 2, { name: R.T('map.marsh_loch_interiors.loch_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'loch_barkeep', reward: 'lead', pushable: false }),
        K.npc('tav_bard', 'npc_bard', 11, 6, { name: R.T('map.marsh_loch_interiors.loch_tavern.npcs.1.tav_bard.name'), dir: 's', talk: 'loch_tav_bard', reward: 'lead' }),
        K.npc('tav_sailor', 'npc_marsh_man', 3, 7, { name: R.T('map.marsh_loch_interiors.loch_tavern.npcs.2.tav_sailor.name'), dir: 'e', talk: 'loch_tav_sailor', reward: 'boss' }),
        K.npc('tav_match', 'npc_marsh_woman', 13, 9, { name: R.T('map.marsh_loch_interiors.loch_tavern.npcs.3.tav_match.name'), dir: 'w', talk: 'loch_tav_match', reward: 'news' }),
      ],
    });
    interior('loch_arms', R.T('map.marsh_loch_interiors.loch_arms'), 12, 10, {
      back: 'arms', meta: { sub: R.T('map.marsh_loch_interiors.loch_arms.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('weapon_rack', 1, 2), K.prop('armor_stand', 9, 2),
        K.prop('shield_rack', 9, 5, { w: 2 }), K.prop('crate', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('smith', 'npc_marsh_man', 5, 2, { name: R.T('map.marsh_loch_interiors.loch_arms.npcs.0.smith.name'), dir: 's', talk: 'loch_smith', pushable: false })],
    });

    // ---------------------------------------------------------------- 集会所 22×14（推理の集会の場）
    interior('loch_hall', R.T('map.marsh_loch_interiors.loch_hall'), 22, 14, {
      back: 'hall', carpet: [8, 4, 6, 7],
      objects: [K.prop('counter', 9, 3), K.prop('counter', 10, 3), K.prop('counter', 11, 3), K.prop('counter', 12, 3), K.exam(10, 4, 'loch_assembly'),   // 演台（集会を開く）
        K.prop('bench', 3, 6), K.prop('bench', 5, 6), K.prop('bench', 3, 9), K.prop('bench', 5, 9), K.prop('bench', 16, 6), K.prop('bench', 18, 6), K.prop('bench', 16, 9), K.prop('bench', 18, 9),
        K.prop('bookshelf', 1, 2), K.prop('board', 19, 2), K.exam(19, 3, 'loch_hall_board'), K.prop('lantern', 7, 3), K.prop('lantern', 14, 3), K.prop('wall_tapestry', 11, 1)],
      npcs: [
        K.npc('mayor', 'npc_loch_mayor', 11, 2, { name: R.T('map.marsh_loch_interiors.loch_hall.npcs.0.mayor.name'), title: R.T('map.marsh_loch_interiors.loch_hall.npcs.0.mayor.title'), dir: 's', talk: 'loch_mayor', reward: 'lead', pushable: false }),
        K.npc('hall_clerk', 'npc_marsh_old_f', 17, 4, { name: R.T('map.marsh_loch_interiors.loch_hall.npcs.1.hall_clerk.name'), dir: 'w', talk: 'loch_hall_clerk', reward: 'hint' }),
      ],
      meta: { sub: R.T('map.marsh_loch_interiors.loch_hall.meta.sub') },
    });

    // ---------------------------------------------------------------- 鐘楼 12×12（トビアス。記録帳・貸し出し簿 = 証拠 2）
    interior('loch_tower', R.T('map.marsh_loch_interiors.loch_tower'), 12, 12, {
      back: 'tower', legend: { f: { mat: 'stone_floor' }, d: { mat: 'stone_floor', name: 'door' }, W: { mat: 'wall_stone', solid: true, rise: 2 } },
      objects: [K.prop('writing_desk', 3, 3), K.exam(3, 4, 'loch_tower_book'), K.prop('bookshelf', 1, 2), K.prop('ladder_prop', 9, 2), K.exam(9, 3, 'loch_tower_ladder'),
        K.prop('bell_frame', 7, 6), K.exam(7, 7, 'loch_tower_bell'), K.prop('crate', 10, 8), K.prop('lantern', 5, 3)],
      npcs: [K.npc('tobias', 'npc_tobias', 4, 6, { name: R.T('map.marsh_loch_interiors.loch_tower.npcs.0.tobias.name'), title: R.T('map.marsh_loch_interiors.loch_tower.npcs.0.tobias.title'), dir: 's', talk: 'loch_tobias', reward: 'lead', pushable: false })],
      light: { ambient: '#6c6c8e', k: 0.72 },
      meta: { sub: R.T('map.marsh_loch_interiors.loch_tower.meta.sub') },
    });

    // ---------------------------------------------------------------- 宿「霧笛亭」16×12（平底船の輪の中）
    interior('loch_inn', R.T('map.marsh_loch_interiors.loch_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3],
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('stove', 1, 6),
        K.prop('fish_trap', 1, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_marsh_woman', 4, 2, { name: R.T('map.marsh_loch_interiors.loch_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'loch_inn_keeper', pushable: false }),
        K.npc('emma_inn', 'npc_emma', 9, 8, { name: R.T('map.marsh_loch_interiors.loch_inn.npcs.1.emma_inn.name'), title: R.T('map.marsh_loch_interiors.loch_inn.npcs.1.emma_inn.title'), dir: 'w', talk: 'loch_emma', reward: 'lead', cond: '!marsh_emma_met' }),
        K.npc('inn_guest', 'npc_traveler', 12, 8, { name: R.T('map.marsh_loch_interiors.loch_inn.npcs.2.inn_guest.name'), dir: 's', talk: 'loch_inn_guest', reward: 'lead' }),
      ],
    });

    // ---------------------------------------------------------------- 町長の家 12×10
    interior('loch_mayor', R.T('map.marsh_loch_interiors.loch_mayor'), 12, 10, {
      back: 'mayor', carpet: [3, 5, 6, 3],
      objects: [K.prop('bed', 9, 2), K.prop('table', 7, 6), K.prop('chair', 6, 6), K.prop('chair', 8, 6), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2),
        K.exam(1, 3, 'loch_mayor_shelf'), K.prop('house_plant', 10, 7), K.prop('lantern', 4, 3)],
      npcs: [K.npc('mayor_wife', 'npc_marsh_old_f', 6, 4, { name: R.T('map.marsh_loch_interiors.loch_mayor.npcs.0.mayor_wife.name'), dir: 's', talk: 'loch_mayor_wife', reward: 'item' })],
    });

    // ---------------------------------------------------------------- エマの家 12×10（妹リナの絵 = 証拠 4、静夜会のイェナ）
    interior('loch_emma', R.T('map.marsh_loch_interiors.loch_emma'), 12, 10, {
      back: 'emma',
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 3, 6), K.prop('chair', 2, 6), K.prop('spinning_wheel', 10, 6), K.prop('fish_trap', 10, 7),
        K.exam(3, 6, 'loch_emma_drawing'), K.prop('lantern', 7, 3), K.prop('wall_herbs', 5, 1)],
      npcs: [
        K.npc('emma_home', 'npc_emma', 6, 4, { name: R.T('map.marsh_loch_interiors.loch_emma.npcs.0.emma_home.name'), title: R.T('map.marsh_loch_interiors.loch_emma.npcs.0.emma_home.title'), dir: 's', talk: 'loch_emma', reward: 'lead', cond: 'marsh_emma_met' }),
        K.npc('lina', 'npc_marsh_child', 4, 5, { name: R.T('map.marsh_loch_interiors.loch_emma.npcs.1.lina.name'), title: R.T('map.marsh_loch_interiors.loch_emma.npcs.1.lina.title'), dir: 'e', talk: 'loch_lina', reward: 'hint' }),
      ],
      meta: { sub: R.T('map.marsh_loch_interiors.loch_emma.meta.sub') },
    });

    // ---------------------------------------------------------------- 人形師ベッポの店 12×10（証拠 3）
    interior('loch_beppo', R.T('map.marsh_loch_interiors.loch_beppo'), 12, 10, {
      back: 'beppo', carpet: [3, 5, 6, 3],
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('shelf_jars', 9, 2), K.exam(9, 3, 'loch_beppo_dolls'),
        K.prop('writing_desk', 9, 6), K.exam(9, 7, 'loch_beppo_order'), K.prop('spinning_wheel', 1, 6), K.prop('lantern', 7, 3), K.prop('wall_shelf', 3, 1)],
      npcs: [K.npc('beppo', 'npc_beppo', 5, 2, { name: R.T('map.marsh_loch_interiors.loch_beppo.npcs.0.beppo.name'), title: R.T('map.marsh_loch_interiors.loch_beppo.npcs.0.beppo.title'), dir: 's', talk: 'loch_beppo', reward: 'lead', pushable: false, cond: '!marsh_held_beppo' })],
      meta: { sub: R.T('map.marsh_loch_interiors.loch_beppo.meta.sub') },
    });

    // ---------------------------------------------------------------- 記録院ロッホ出張所 12×10（クラウス。机の引き出しの手紙）
    interior('loch_klaus', R.T('map.marsh_loch_interiors.loch_klaus'), 12, 10, {
      back: 'klaus', legend: { f: { mat: 'stone_floor' }, d: { mat: 'stone_floor', name: 'door' }, W: { mat: 'wall_stone', solid: true, rise: 2 } },
      objects: [K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bookshelf', 9, 2), K.prop('bookshelf', 10, 2), K.prop('writing_desk', 5, 4), K.exam(5, 5, 'loch_klaus_desk'),
        K.prop('crate', 10, 6), K.prop('crate', 10, 7), K.prop('lantern', 7, 3), K.exam(1, 3, 'loch_klaus_shelf')],
      npcs: [K.npc('klaus', 'npc_klaus', 7, 4, { name: R.T('map.marsh_loch_interiors.loch_klaus.npcs.0.klaus.name'), title: R.T('map.marsh_loch_interiors.loch_klaus.npcs.0.klaus.title'), dir: 's', talk: 'loch_klaus', reward: 'lead', cond: '!cleared_r_marsh' })],
      light: { ambient: '#686c8c', k: 0.7 },
      meta: { sub: R.T('map.marsh_loch_interiors.loch_klaus.meta.sub') },
    });
  });
})(window.RPG);
