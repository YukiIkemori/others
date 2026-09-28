// カルデラの屋内 7（WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8）:
//   大卵殻の 3 つ（道具屋・酒場「殻の中」・武具屋）・宿「湯けむり亭」・火の神殿（巫女カヤ。火の鳥の巡りの記録 = lo_time_ash の半分）・
//   族長ドルガの家（ドルガの記憶 = lo_war_ash）・闘士の家（元の代理闘士の家族）
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（カルデラの戸の前へ）。
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
        bgm: o.bgm || 'town',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 大卵殻: 道具屋・酒場・武具屋（白金色の殻の内側。丸い壁）
    interior('caldera_items', '殻の道具屋', 12, 10, {
      back: 'items', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: '大卵殻の西の割れ目' },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('water_urn', 10, 5), K.prop('crate', 1, 6), K.prop('sulphur', 10, 7), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_ash_woman', 5, 2, { name: '道具屋のおかみ', dir: 's', talk: 'caldera_item_keeper', pushable: false })],
    });
    interior('caldera_tavern', '酒場「殻の中」', 16, 12, {
      back: 'tavern', carpet: [5, 6, 6, 3], wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: '大卵殻のまん中' },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2), K.prop('keg_rack', 14, 2),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 3, 8), K.prop('chair', 2, 8), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8), K.prop('arena_banner', 10, 1)],
      npcs: [
        K.npc('barkeep', 'npc_ash_old_m', 5, 2, { name: '酒場の亭主', dir: 's', talk: 'caldera_barkeep', reward: 'lead', pushable: false }),
        K.npc('zakuro_tav', 'npc_zakuro', 12, 9, { name: '見かけない闘士', dir: 'w', talk: 'caldera_zakuro', reward: 'lead', cond: '!ash_champion' }),
        K.npc('tav_fighter', 'npc_ash_fighter', 3, 7, { name: '一族の若い闘士', dir: 'e', talk: 'caldera_tav_fighter', reward: 'boss' }),
        K.npc('tav_bookie', 'npc_ash_bookie', 13, 5, { name: '賭け屋のボッツ', dir: 'w', talk: 'caldera_tav_bookie', reward: 'side' }),
      ],
    });
    interior('caldera_arms', '殻の武具屋', 12, 10, {
      back: 'arms', wall: 'wall_stone', floor: 'basalt_floor', meta: { sub: '大卵殻の東の割れ目' },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('ash_weapon_rack', 1, 2), K.prop('armor_stand', 9, 2),
        K.prop('shield_rack', 10, 5), K.prop('crate', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('smith', 'npc_ash_man', 5, 2, { name: '武具屋の主人', dir: 's', talk: 'caldera_smith', pushable: false })],
    });

    // ---------------------------------------------------------------- 宿「湯けむり亭」16×12（湯の宿。消灯の刻に休むと、決勝の前夜の使いが来る）
    interior('caldera_inn', '宿「湯けむり亭」', 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 7), K.prop('chair', 5, 7), K.prop('chair', 7, 7), K.prop('stove', 1, 6),
        K.prop('water_urn', 1, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_ash_woman', 4, 2, { name: '宿のおかみ', dir: 's', talk: 'caldera_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_traveler', 12, 8, { name: '湯治の行商', dir: 's', talk: 'caldera_inn_guest', reward: 'lead' }),
        K.npc('messenger', 'npc_hawk', 8, 9, { name: '頭巾の使い', dir: 'n', talk: [L('……。')], cond: 'ash_eve_on' }),
      ],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
    });

    // ---------------------------------------------------------------- 火の神殿 16×12（巫女カヤ。種火・火の鳥の巡りの記録・火の鳥の背）
    interior('caldera_temple', '火の神殿', 16, 12, {
      back: 'temple', carpet: [6, 3, 4, 7], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('phoenix_statue', 7, 2), K.prop('iron_brazier', 5, 3), K.prop('iron_brazier', 10, 3), K.exam(8, 3, 'caldera_seed_fire'),
        K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.exam(1, 3, 'caldera_temple_record'), K.prop('bench', 3, 7), K.prop('bench', 12, 7), K.prop('water_urn', 14, 4)],
      npcs: [
        K.npc('kaya', 'npc_kaya', 8, 5, { name: 'カヤ', title: '火の巫女', dir: 's', talk: 'caldera_kaya', reward: 'lead', pushable: false }),
        K.npc('acolyte_in', 'npc_ash_acolyte', 13, 3, { name: '神殿の見習い', dir: 'w', talk: 'caldera_acolyte_in', reward: 'hint' }),
      ],
      light: { ambient: '#8a6a60', k: 0.74 },
      meta: { sub: '火口の縁に彫られた神殿' },
    });

    // ---------------------------------------------------------------- 族長ドルガの家 12×10（ドルガの記憶 = lo_war_ash）
    interior('caldera_dorga', '族長の家', 12, 10, {
      back: 'dorga', carpet: [3, 5, 6, 3], wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('bed', 9, 2), K.prop('table', 7, 6), K.prop('chair', 6, 6), K.prop('chair', 8, 6), K.prop('ash_weapon_rack', 1, 2), K.prop('bookshelf', 3, 2),
        K.exam(1, 3, 'caldera_dorga_blade'), K.prop('iron_brazier', 10, 7), K.prop('lantern', 4, 3)],
      npcs: [K.npc('dorga', 'npc_dorga', 5, 4, { name: 'ドルガ', title: '族長', dir: 's', talk: 'caldera_dorga', reward: 'lead', pushable: false, cond: '!ash_finale_done' }),
        K.npc('dorga_after', 'npc_dorga', 5, 4, { name: 'ドルガ', title: '族長', dir: 's', talk: 'caldera_dorga', reward: 'news', pushable: false, cond: 'ash_finale_done' })],
      meta: { sub: '黒い石の塔の家' },
    });

    // ---------------------------------------------------------------- 闘士の家 12×10（元の代理闘士の妻と子。温泉の番の依頼）
    interior('caldera_house', '闘士の家', 12, 10, {
      back: 'house', wall: 'wall_stone', floor: 'basalt_floor',
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 3, 6), K.prop('chair', 2, 6), K.prop('ash_weapon_rack', 10, 6), K.prop('water_urn', 10, 7),
        K.exam(10, 5, 'caldera_house_spear'), K.prop('lantern', 7, 3)],
      npcs: [
        K.npc('widow', 'npc_ash_old_f', 6, 4, { name: 'ばあさまのネネ', dir: 's', talk: 'caldera_widow', reward: 'item' }),
        K.npc('house_kid', 'npc_ash_child', 4, 5, { name: '闘士の孫', dir: 'e', talk: 'caldera_house_kid', reward: 'hint' }),
      ],
      meta: { sub: '壁に古い槍が掛かっている' },
    });

    // ---------------------------------------------------------------- 宿場「灰見の宿」16×12（#27、潮見橋のたもと。ワールドの戸から）
    {
      const { g, door } = K.room(16, 12, {});
      K.rect(g, 5, 6, 6, 3, 'c');
      K.def('haimi_inn', {
        name: '宿場「灰見の宿」', kind: 'interior', region: 'r_ash', location: 'haimi',
        legend: AK.ROOM('wall_stone', 'basalt_floor'), rows: g, outside: 'wall_stone',
        objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
          K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 13, 5), K.prop('table', 7, 7), K.prop('chair', 6, 7), K.prop('chair', 8, 7),
          K.prop('stove', 1, 6), K.prop('water_urn', 14, 9), K.prop('lantern', 9, 3), K.exam(1, 3, 'haimi_bridge_log')],
        npcs: [
          K.npc('haimi_keeper', 'npc_ash_old_f', 4, 2, { name: '宿のばあさま', dir: 's', talk: 'haimi_keeper', pushable: false }),
          K.npc('haimi_bridgeman', 'npc_ash_old_m', 11, 8, { name: '橋番のゴウ', dir: 'w', talk: 'haimi_bridgeman', reward: 'news' }),
          K.npc('haimi_guest', 'npc_traveler', 4, 8, { name: '湿原から来た行商', dir: 'e', talk: 'haimi_guest', reward: 'lead' }),
        ],
        spawns: { door: { x: door.x, y: 10, dir: 'n' } },
        exits: [{ x: door.x, y: 11, w: 1, h: 1, to: { map: 'world', spawn: 'haimi' } }],
        triggers: [],
        light: Object.assign({}, AK.LIGHT_ROOM),
        bgm: 'town',
        meta: { minimap: false, sub: '潮見橋のたもとの古い宿' },
      });
    }
  });
})(window.RPG);
