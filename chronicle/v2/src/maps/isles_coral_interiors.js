// コーラルの屋内 9（WORLD_REDESIGN §5.8・§4.5、STORY_BIBLE §7.5・§8.6）:
//   港の親方の家（海図）・後家の家・宿「潮騒亭」・酒場「いかり亭」（老水夫・商船の船長）・水夫の家・漁師の家・道具屋・武具屋・船乗り組合（旗信号・配達・売り台）
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（コーラルの戸の前へ）。
//   白い漆喰の壁と木の床（諸島の家）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, IK = R.Isles.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_isles', location: 'coral',
        legend: IK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'coral', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, IK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'isles',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 港の親方の家（海図の机）
    interior('coral_harbormaster', R.T('map.isles_coral_interiors.coral_harbormaster'), 12, 10, {
      back: 'harbormaster', carpet: [3, 5, 6, 3], meta: { sub: R.T('map.isles_coral_interiors.coral_harbormaster.meta.sub') },
      objects: [K.prop('writing_desk', 7, 3), K.exam(7, 3, 'coral_harbormaster_chart_table'), K.prop('wall_chart', 4, 1), K.prop('bookshelf', 1, 2), K.prop('bed', 10, 2),
        K.prop('anchor', 10, 7), K.prop('lantern', 5, 3)],
      npcs: [
        K.npc('harbormaster', 'npc_isles_old_m', 6, 4, { name: R.T('map.isles_coral_interiors.coral_harbormaster.npcs.0.harbormaster.name'), dir: 's', talk: 'coral_harbormaster', reward: 'lead', pushable: false }),
        K.npc('hm_wife', 'npc_isles_old_f', 2, 6, { name: R.T('map.isles_coral_interiors.coral_harbormaster.npcs.1.hm_wife.name'), dir: 'e', talk: 'coral_hm_wife', reward: 'news' }),
      ],
    });
    // ---------------------------------------------------------------- 後家の家（上の段の東）
    interior('coral_house1', R.T('map.isles_coral_interiors.coral_house1'), 12, 10, {
      back: 'house1', meta: { sub: R.T('map.isles_coral_interiors.coral_house1.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('table', 6, 5), K.prop('chair', 5, 5), K.prop('chair', 7, 5), K.prop('cupboard', 9, 2), K.prop('flower_pot', 10, 6), K.prop('lantern', 4, 3)],
      npcs: [
        K.npc('house1_widow', 'npc_isles_old_f', 6, 3, { name: R.T('map.isles_coral_interiors.coral_house1.npcs.0.house1_widow.name'), dir: 's', talk: 'coral_house1_widow', reward: 'news' }),
        K.npc('house1_kid', 'npc_isles_child', 3, 6, { name: R.T('map.isles_coral_interiors.coral_house1.npcs.1.house1_kid.name'), dir: 'e', talk: 'coral_house1_kid', reward: 'hint' }),
      ],
    });
    // ---------------------------------------------------------------- 宿「潮騒亭」
    interior('coral_inn', R.T('map.isles_coral_interiors.coral_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3],
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 8), K.prop('chair', 5, 8), K.prop('chair', 7, 8), K.prop('net', 1, 7), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_isles_woman', 4, 2, { name: R.T('map.isles_coral_interiors.coral_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'coral_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_traveler', 12, 8, { name: R.T('map.isles_coral_interiors.coral_inn.npcs.1.inn_guest.name'), dir: 'w', talk: 'coral_inn_guest', reward: 'lead' }),
      ],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
      meta: { sub: R.T('map.isles_coral_interiors.coral_inn.meta.sub') },
    });
    // ---------------------------------------------------------------- 酒場「いかり亭」（A17 の酒場の直し: 左の通路をふさがない）
    interior('coral_tavern', R.T('map.isles_coral_interiors.coral_tavern'), 16, 12, {
      back: 'tavern', carpet: [6, 6, 6, 3], bgm: 'tavern',
      // (2026-10-03) 売り台の絵は 1 つが 1 マスより広く、4 つで 3〜7 に見える。右端の当たりを 7 まで・左の酒樽を 2 マスに、
      //   右の壁ぎわ（8,2）に樽を置いて、売り台の内側へ上や横から回りこめないように（ドヴァンの酒場と同じ）
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3, { w: 2 }), K.prop('keg_rack', 1, 2, { w: 2 }), K.prop('keg_rack', 13, 2, { w: 2 }), K.prop('barrel', 8, 2),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 5, 8), K.prop('chair', 6, 8), K.prop('anchor', 14, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 6)],
      npcs: [
        K.npc('barkeep', 'npc_isles_man', 5, 2, { name: R.T('map.isles_coral_interiors.coral_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'coral_barkeep', reward: 'news', pushable: false }),
        K.npc('old_sailor', 'npc_isles_old_m', 12, 9, { name: R.T('map.isles_coral_interiors.coral_tavern.npcs.1.old_sailor.name'), dir: 'w', talk: 'coral_old_sailor', reward: 'lead' }),
        K.npc('tav_sailor', 'npc_isles_sailor', 4, 8, { name: R.T('map.isles_coral_interiors.coral_tavern.npcs.2.tav_sailor.name'), dir: 'e', talk: 'coral_tav_sailor', reward: 'boss' }),
        K.npc('merchant', 'npc_merchant_captain', 13, 5, { name: R.T('map.isles_coral_interiors.coral_tavern.npcs.3.merchant.name'), dir: 'w', talk: 'coral_merchant', reward: 'item', cond: 'isles_wreck_done' }),
      ],
      meta: { sub: R.T('map.isles_coral_interiors.coral_tavern.meta.sub') },
    });
    // ---------------------------------------------------------------- 水夫の家・漁師の家（中の段の東）
    interior('coral_house2', R.T('map.isles_coral_interiors.coral_house2'), 12, 10, {
      back: 'house2', meta: { sub: R.T('map.isles_coral_interiors.coral_house2.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('net', 10, 6), K.prop('lantern', 7, 3)],
      npcs: [K.npc('sailor_wife', 'npc_isles_woman', 6, 4, { name: R.T('map.isles_coral_interiors.coral_house2.npcs.0.sailor_wife.name'), dir: 's', talk: 'coral_sailor_wife', reward: 'hint' })],
    });
    interior('coral_house3', R.T('map.isles_coral_interiors.coral_house3'), 12, 10, {
      back: 'house3', meta: { sub: R.T('map.isles_coral_interiors.coral_house3.meta.sub') },
      objects: [K.prop('bed', 9, 2), K.prop('table', 4, 5), K.prop('chair', 3, 5), K.prop('fish_barrel', 1, 2), K.prop('net', 1, 6), K.prop('lantern', 6, 3)],
      npcs: [K.npc('fisher', 'npc_isles_man', 7, 5, { name: R.T('map.isles_coral_interiors.coral_house3.npcs.0.fisher.name'), dir: 'w', talk: 'coral_fisher', reward: 'lead' })],
    });
    // ---------------------------------------------------------------- 道具屋・武具屋（下の段）
    interior('coral_items', R.T('map.isles_coral_interiors.coral_items'), 12, 10, {
      back: 'items', meta: { sub: R.T('map.isles_coral_interiors.coral_items.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('crate', 1, 6), K.prop('white_pot', 10, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_isles_woman', 5, 2, { name: R.T('map.isles_coral_interiors.coral_items.npcs.0.item_keeper.name'), dir: 's', talk: 'coral_item_keeper', pushable: false })],
    });
    interior('coral_arms', R.T('map.isles_coral_interiors.coral_arms'), 12, 10, {
      back: 'arms', meta: { sub: R.T('map.isles_coral_interiors.coral_arms.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('armor_stand', 9, 2), K.prop('shield_rack', 9, 5, { w: 2 }),
        K.prop('crate', 1, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('smith', 'npc_isles_man', 5, 2, { name: R.T('map.isles_coral_interiors.coral_arms.npcs.0.smith.name'), dir: 's', talk: 'coral_smith', pushable: false })],
    });
    // ---------------------------------------------------------------- 船乗り組合（旗信号の試験・配達・売り台・掲示板）
    interior('coral_guild', R.T('map.isles_coral_interiors.coral_guild'), 18, 12, {
      back: 'guild', carpet: [6, 5, 6, 4], meta: { sub: R.T('map.isles_coral_interiors.coral_guild.meta.sub') },
      objects: [K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('counter', 7, 3), K.prop('wall_chart', 10, 1), K.prop('board', 13, 2),
        K.exam(13, 2, 'coral_guild_board'), K.prop('bookshelf', 1, 2), K.prop('anchor', 16, 8), K.prop('rope_bollard', 1, 8), K.prop('table', 12, 7), K.prop('chair', 11, 7),
        K.prop('lantern', 9, 3), K.prop('lantern', 15, 5)],
      npcs: [
        K.npc('guild_master', 'npc_isles_old_m', 5, 2, { name: R.T('map.isles_coral_interiors.coral_guild.npcs.0.guild_master.name'), dir: 's', talk: 'coral_guild_master', reward: 'side', pushable: false }),
        K.npc('flag_officer', 'npc_isles_sailor', 14, 5, { name: R.T('map.isles_coral_interiors.coral_guild.npcs.1.flag_officer.name'), dir: 'w', talk: 'coral_flags', reward: 'side' }),
      ],
    });
  });
})(window.RPG);
