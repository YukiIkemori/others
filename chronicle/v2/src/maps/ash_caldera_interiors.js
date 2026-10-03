// カルデラの屋内 7（WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8）:
//   大卵殻の 3 つ（道具屋・酒場「殻の中」・武具屋）・宿「湯けむり亭」・火の神殿（巫女カヤ。火の鳥の巡りの記録 = lo_time_ash の半分）・
//   族長ドルガの家（ドルガの記憶 = lo_war_ash）・闘士の家（元の代理闘士の家族）
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（カルデラの戸の前へ）。
//   物の絵は壁へはみ出さない所に置く（横に 2 マスの物 = 樽の棚・盾の棚は { w: 2 } で右のマスまで。かまど・壺の棚は壁の 1 つ内側。2026-10-01）
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      if (o.paint) o.paint(g);
      return K.def(id, {
        name, kind: 'interior', region: 'r_ash', location: 'caldera',
        legend: Object.assign(AK.ROOM(o.wall, o.floor), o.legend || {}), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'caldera', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, AK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'ash',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 大卵殻: 道具屋・酒場・武具屋（白金色の殻の内側。丸い壁）
    interior('caldera_items', R.T('map.ash_caldera_interiors.caldera_items'), 12, 10, {
      back: 'items', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_items.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 2, 2), K.prop('potion_shelf', 9, 2),
        K.prop('water_urn', 10, 5), K.prop('crate', 1, 6), K.prop('sulphur', 10, 7), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_ash_woman', 5, 2, { name: R.T('map.ash_caldera_interiors.caldera_items.npcs.0.item_keeper.name'), dir: 's', talk: 'caldera_item_keeper', pushable: false })],
    });
    interior('caldera_tavern', R.T('map.ash_caldera_interiors.caldera_tavern'), 16, 12, {
      back: 'tavern', carpet: [5, 6, 6, 3], bgm: 'tavern', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_tavern.meta.sub') },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2, { w: 2 }), K.prop('keg_rack', 13, 2, { w: 2 }),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 3, 8), K.prop('chair', 2, 8), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8), K.prop('arena_banner', 10, 2)],   // 旗は壁の前の床に立てる（壁の立ち上がりの中に立てない）
      npcs: [
        K.npc('barkeep', 'npc_ash_old_m', 5, 2, { name: R.T('map.ash_caldera_interiors.caldera_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'caldera_barkeep', reward: 'lead', pushable: false }),
        K.npc('zakuro_tav', 'npc_zakuro', 12, 9, { name: R.T('map.ash_caldera_interiors.caldera_tavern.npcs.1.zakuro_tav.name'), dir: 'w', talk: 'caldera_zakuro', reward: 'lead', cond: '!ash_champion' }),
        K.npc('tav_fighter', 'npc_ash_fighter', 3, 7, { name: R.T('map.ash_caldera_interiors.caldera_tavern.npcs.2.tav_fighter.name'), dir: 'e', talk: 'caldera_tav_fighter', reward: 'boss' }),
        K.npc('tav_bookie', 'npc_ash_bookie', 13, 5, { name: R.T('map.ash_caldera_interiors.caldera_tavern.npcs.3.tav_bookie.name'), dir: 'w', talk: 'caldera_tav_bookie', reward: 'side' }),
      ],
    });
    interior('caldera_arms', R.T('map.ash_caldera_interiors.caldera_arms'), 12, 10, {
      back: 'arms', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_arms.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('ash_weapon_rack', 1, 2), K.prop('armor_stand', 9, 2),
        K.prop('shield_rack', 9, 5, { w: 2 }), K.prop('crate', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('smith', 'npc_ash_man', 5, 2, { name: R.T('map.ash_caldera_interiors.caldera_arms.npcs.0.smith.name'), dir: 's', talk: 'caldera_smith', pushable: false })],
    });

    // ---------------------------------------------------------------- 宿「湯けむり亭」16×12（湯の宿。消灯の刻に休むと、決勝の前夜の使いが来る）
    interior('caldera_inn', R.T('map.ash_caldera_interiors.caldera_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('stove', 2, 6),
        K.prop('water_urn', 1, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_ash_woman', 4, 2, { name: R.T('map.ash_caldera_interiors.caldera_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'caldera_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_traveler', 12, 8, { name: R.T('map.ash_caldera_interiors.caldera_inn.npcs.1.inn_guest.name'), dir: 's', talk: 'caldera_inn_guest', reward: 'lead' }),
        K.npc('messenger', 'npc_hawk', 8, 9, { name: R.T('map.ash_caldera_interiors.caldera_inn.npcs.2.messenger.name'), dir: 'n', talk: [L('……。')], cond: 'ash_eve_on' }),
      ],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
    });

    // ---------------------------------------------------------------- 火の神殿 16×12（巫女カヤ。種火・火の鳥の巡りの記録・火の鳥の背）
    // 火の鳥の像は敷物（6〜9）とかがり火（5・10）のまん中 8 に絵を置く（dx: 0.5。当たりは 7 のまま。持ち主 2026-10-03「像がまん中にない」）
    interior('caldera_temple', R.T('map.ash_caldera_interiors.caldera_temple'), 16, 12, {
      back: 'temple', carpet: [6, 3, 4, 7], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [Object.assign(K.prop('phoenix_statue', 7, 2), { dx: 0.5 }), K.prop('iron_brazier', 5, 3), K.prop('iron_brazier', 10, 3), K.exam(8, 3, 'caldera_seed_fire'),
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.exam(1, 3, 'caldera_temple_record'), K.prop('bench', 3, 7), K.prop('bench', 12, 7), K.prop('water_urn', 14, 4)],
      npcs: [
        K.npc('kaya', 'npc_kaya', 8, 5, { name: R.T('map.ash_caldera_interiors.caldera_temple.npcs.0.kaya.name'), title: R.T('map.ash_caldera_interiors.caldera_temple.npcs.0.kaya.title'), dir: 's', talk: 'caldera_kaya', reward: 'lead', pushable: false }),
        K.npc('acolyte_in', 'npc_ash_acolyte', 13, 3, { name: R.T('map.ash_caldera_interiors.caldera_temple.npcs.1.acolyte_in.name'), dir: 'w', talk: 'caldera_acolyte_in', reward: 'hint' }),
      ],
      light: { ambient: '#8a6a60', k: 0.74 },
      meta: { sub: R.T('map.ash_caldera_interiors.caldera_temple.meta.sub') },
    });

    // ---------------------------------------------------------------- 族長ドルガの家 12×10（ドルガの記憶 = lo_war_ash）
    interior('caldera_dorga', R.T('map.ash_caldera_interiors.caldera_dorga'), 12, 10, {
      back: 'dorga', carpet: [3, 5, 6, 3], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('bed', 9, 2), K.prop('table', 7, 6), K.prop('chair', 6, 6), K.prop('chair', 8, 6), K.prop('ash_weapon_rack', 1, 2), K.prop('bookshelf', 3, 2),
        K.exam(1, 3, 'caldera_dorga_blade'), K.prop('iron_brazier', 10, 7), K.prop('lantern', 4, 3)],
      npcs: [K.npc('dorga', 'npc_dorga', 5, 4, { name: R.T('map.ash_caldera_interiors.caldera_dorga.npcs.0.dorga.name'), title: R.T('map.ash_caldera_interiors.caldera_dorga.npcs.0.dorga.title'), dir: 's', talk: 'caldera_dorga', reward: 'lead', pushable: false, cond: '!ash_finale_done' }),
        K.npc('dorga_after', 'npc_dorga', 5, 4, { name: R.T('map.ash_caldera_interiors.caldera_dorga.npcs.1.dorga_after.name'), title: R.T('map.ash_caldera_interiors.caldera_dorga.npcs.1.dorga_after.title'), dir: 's', talk: 'caldera_dorga', reward: 'news', pushable: false, cond: 'ash_finale_done' })],
      meta: { sub: R.T('map.ash_caldera_interiors.caldera_dorga.meta.sub') },
    });

    // ---------------------------------------------------------------- 闘士の家 12×10（元の代理闘士の妻と子。温泉の番の依頼）
    interior('caldera_house', R.T('map.ash_caldera_interiors.caldera_house'), 12, 10, {
      back: 'house', wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 3, 6), K.prop('chair', 2, 6), K.prop('ash_weapon_rack', 10, 6), K.prop('water_urn', 10, 7),
        K.exam(10, 5, 'caldera_house_spear'), K.prop('lantern', 7, 3)],
      npcs: [
        K.npc('widow', 'npc_ash_old_f', 6, 4, { name: R.T('map.ash_caldera_interiors.caldera_house.npcs.0.widow.name'), dir: 's', talk: 'caldera_widow', reward: 'item' }),
        K.npc('house_kid', 'npc_ash_child', 4, 5, { name: R.T('map.ash_caldera_interiors.caldera_house.npcs.1.house_kid.name'), dir: 'e', talk: 'caldera_house_kid', reward: 'hint' }),
      ],
      meta: { sub: R.T('map.ash_caldera_interiors.caldera_house.meta.sub') },
    });

    // ---------------------------------------------------------------- 段の上の小さな屋内 3（鍛冶場・灰よけの蔵・見習いの家）
    interior('caldera_smithy', R.T('map.ash_caldera_interiors.caldera_smithy'), 12, 10, {
      back: 'forge', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_smithy.meta.sub') },
      objects: [K.prop('fireplace', 2, 2), K.prop('ash_weapon_rack', 9, 2), K.prop('water_urn', 10, 5), K.prop('crate', 1, 6), K.exam(5, 2, 'caldera_anvil'), K.prop('lantern', 7, 3)],
      npcs: [K.npc('blacksmith', 'npc_smith', 5, 4, { name: R.T('map.ash_caldera_interiors.caldera_smithy.npcs.0.blacksmith.name'), dir: 's', talk: 'caldera_blacksmith', reward: 'boss' })],
    });
    interior('caldera_granary', R.T('map.ash_caldera_interiors.caldera_granary'), 12, 10, {
      back: 'store', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_granary.meta.sub') },
      objects: [K.prop('barrel', 1, 2), K.prop('barrel', 2, 2), K.prop('crate', 9, 2), K.prop('crate', 10, 2), K.prop('sack', 1, 6), K.prop('sack', 10, 6), K.prop('lantern', 6, 3)],
      npcs: [K.npc('granary_keeper', 'npc_ash_old_f', 6, 4, { name: R.T('map.ash_caldera_interiors.caldera_granary.npcs.0.granary_keeper.name'), dir: 's', talk: 'caldera_granary_keeper', reward: 'news' })],
    });
    interior('caldera_toto', R.T('map.ash_caldera_interiors.caldera_toto'), 12, 10, {
      back: 'hut', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: R.T('map.ash_caldera_interiors.caldera_toto.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('stove', 9, 6), K.prop('lantern', 7, 3)],
      npcs: [K.npc('toto_mother', 'npc_ash_woman', 6, 4, { name: R.T('map.ash_caldera_interiors.caldera_toto.npcs.0.toto_mother.name'), dir: 's', talk: 'caldera_toto_mother', reward: 'hint' })],
    });

    // ---------------------------------------------------------------- 宿場「灰見の宿」16×12（#27、潮見橋のたもと。ワールドの戸から）
    {
      const { g, door } = K.room(16, 12, {});
      K.rect(g, 5, 6, 6, 3, 'c');
      K.def('haimi_inn', {
        name: R.T('map.ash_caldera_interiors.haimi_inn.name'), kind: 'interior', region: 'r_ash', location: 'haimi',
        legend: AK.ROOM('wall_stone', 'basalt_floor'), rows: g, outside: 'wall_stone',
        objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
          K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 13, 5), K.prop('table', 7, 7), K.prop('chair', 6, 7), K.prop('chair', 8, 7),
          K.prop('stove', 1, 6), K.prop('water_urn', 14, 9), K.prop('lantern', 9, 3), K.exam(1, 3, 'haimi_bridge_log')],
        npcs: [
          K.npc('haimi_keeper', 'npc_ash_old_f', 4, 2, { name: R.T('map.ash_caldera_interiors.haimi_inn.npcs.0.haimi_keeper.name'), dir: 's', talk: 'haimi_keeper', pushable: false }),
          K.npc('haimi_bridgeman', 'npc_ash_old_m', 11, 8, { name: R.T('map.ash_caldera_interiors.haimi_inn.npcs.1.haimi_bridgeman.name'), dir: 'w', talk: 'haimi_bridgeman', reward: 'news' }),
          K.npc('haimi_guest', 'npc_traveler', 4, 8, { name: R.T('map.ash_caldera_interiors.haimi_inn.npcs.2.haimi_guest.name'), dir: 'e', talk: 'haimi_guest', reward: 'lead' }),
        ],
        spawns: { door: { x: door.x, y: 10, dir: 'n' } },
        exits: [{ x: door.x, y: 11, w: 1, h: 1, to: { map: 'world', spawn: 'haimi' } }],
        triggers: [],
        light: Object.assign({}, AK.LIGHT_ROOM),
        bgm: 'ash',
        meta: { minimap: false, sub: R.T('map.ash_caldera_interiors.haimi_inn.meta.sub') },
      });
    }
  });
})(window.RPG);
