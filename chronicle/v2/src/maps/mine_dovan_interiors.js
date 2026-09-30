// ドヴァンの屋内 8 と、トロッコ線の崖の隠者の庵（WORLD_REDESIGN §5.10・§4.6・§2.7 #15、STORY_BIBLE §7.6・§8.7）:
//   集会所（町の寄り合い。組合・鍛冶衆・仲裁を選ぶ）・鉱夫組合の事務所（ボルグ・出納帳・組合の売り台）・酒場「つるはし亭」（組合のたまり場）・
//   鉱夫の家（ダグの家族）・小さな鉱夫の家（ロルフの母）・道具屋・宿「坑灯亭」・鍛冶場（ヘルガ・鍛冶衆のたまり場・武器屋・拓本の受け取り書・
//   鍛冶神の小さな石像・ふいご）・隠者の庵（問答）。
//   どれも R.ContentF.kit.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（ドヴァンの戸の前へ）。
//   石の壁と板の床（洞窟の町の家）。灯りは置き灯（lantern。propSet 'mine' の坑夫のカンテラ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Mine.kit, L = K.L;

    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_mine', location: o.location || 'dovan',
        legend: MK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: o.backMap || 'dovan', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, MK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'town', propSet: 'mine',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }

    // ---------------------------------------------------------------- 集会所（下の段。町の寄り合い）
    interior('dovan_hall', R.T('map.mine_dovan_interiors.dovan_hall'), 18, 12, {
      back: 'hall', carpet: [5, 4, 8, 5], meta: { sub: R.T('map.mine_dovan_interiors.dovan_hall.meta.sub') },
      objects: [K.prop('table', 7, 5), K.prop('table', 8, 5), K.prop('table', 9, 5), K.prop('table', 10, 5), K.exam(8, 5, 'dovan_assembly'), K.exam(9, 5, 'dovan_assembly'),
        K.prop('chair', 6, 5), K.prop('chair', 11, 5), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 16, 2), K.prop('lantern', 4, 3), K.prop('lantern', 13, 3),
        K.prop('coal_barrel', 1, 8), K.prop('tool_crate', 16, 8)],
      npcs: [
        K.npc('hall_chair', 'npc_mine_old_m', 8, 3, { name: R.T('map.mine_dovan_interiors.dovan_hall.npcs.0.hall_chair.name'), dir: 's', talk: 'dovan_hall_chair', reward: 'lead', pushable: false }),
        // 選んだあと、同じ卓に（C 仲裁・年代記の（痛）のあと）
        K.npc('hall_borg', 'npc_borg', 7, 7, { name: R.T('map.mine_dovan_interiors.dovan_hall.npcs.1.hall_borg.name'), title: R.T('map.mine_dovan_interiors.dovan_hall.npcs.1.hall_borg.title'), dir: 'n', talk: 'dovan_hall_borg', reward: null, cond: ['mine_choice', { any: [{ choice: 'ch_mine_side', is: 'accord' }, 'mine_ledger_closed'] }] }),
        K.npc('hall_helga', 'npc_helga', 10, 7, { name: R.T('map.mine_dovan_interiors.dovan_hall.npcs.2.hall_helga.name'), title: R.T('map.mine_dovan_interiors.dovan_hall.npcs.2.hall_helga.title'), dir: 'n', talk: 'dovan_hall_helga', reward: null, cond: ['mine_choice', { any: [{ choice: 'ch_mine_side', is: 'accord' }, 'mine_ledger_closed'] }] }),
      ],
    });
    // ---------------------------------------------------------------- 鉱夫組合の事務所（中の段。ボルグ・出納帳）
    interior('dovan_guild', R.T('map.mine_dovan_interiors.dovan_guild'), 16, 12, {
      back: 'guild', carpet: [5, 5, 6, 3], meta: { sub: R.T('map.mine_dovan_interiors.dovan_guild.meta.sub') },
      objects: [K.prop('writing_desk', 7, 3), K.prop('counter', 2, 5), K.prop('counter', 3, 5), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 13, 2),
        K.prop('cupboard', 14, 2), K.exam(13, 2, 'dovan_ledger'), K.prop('wall_chart', 10, 1), K.prop('tool_rack', 14, 7), K.prop('mine_cart_ore', 1, 8),
        K.prop('lantern', 5, 3), K.prop('lantern', 11, 6)],
      npcs: [
        K.npc('borg', 'npc_borg', 7, 4, { name: R.T('map.mine_dovan_interiors.dovan_guild.npcs.0.borg.name'), title: R.T('map.mine_dovan_interiors.dovan_guild.npcs.0.borg.title'), dir: 's', talk: 'dovan_borg', reward: 'lead', pushable: false }),
        K.npc('guild_clerk', 'npc_clerk', 2, 4, { name: R.T('map.mine_dovan_interiors.dovan_guild.npcs.1.guild_clerk.name'), dir: 's', talk: 'dovan_guild_clerk', reward: 'side', pushable: false }),
      ],
    });
    // ---------------------------------------------------------------- 酒場「つるはし亭」（中の段。組合のたまり場）
    interior('dovan_tavern', R.T('map.mine_dovan_interiors.dovan_tavern'), 16, 12, {
      back: 'tavern', carpet: [6, 6, 6, 3], bgm: 'tavern', meta: { sub: R.T('map.mine_dovan_interiors.dovan_tavern.meta.sub') },
      objects: [K.prop('bar_counter', 3, 3), K.prop('bar_counter', 4, 3), K.prop('bar_counter', 5, 3), K.prop('bar_counter', 6, 3), K.prop('keg_rack', 1, 2), K.prop('keg_rack', 14, 2),
        K.prop('table', 11, 5), K.prop('chair', 10, 5), K.prop('chair', 12, 5), K.prop('table', 11, 8), K.prop('chair', 10, 8), K.prop('chair', 12, 8),
        K.prop('table', 5, 8), K.prop('chair', 6, 8), K.prop('coal_barrel', 14, 9), K.prop('lantern', 8, 3), K.prop('lantern', 14, 6)],
      npcs: [
        K.npc('barkeep', 'npc_mine_woman', 5, 2, { name: R.T('map.mine_dovan_interiors.dovan_tavern.npcs.0.barkeep.name'), dir: 's', talk: 'dovan_barkeep', reward: 'news', pushable: false }),
        K.npc('tav_miner', 'npc_miner', 12, 9, { name: R.T('map.mine_dovan_interiors.dovan_tavern.npcs.1.tav_miner.name'), dir: 'w', talk: 'dovan_tav_miner', reward: 'lead' }),
        K.npc('tav_old', 'npc_mine_old_m', 4, 8, { name: R.T('map.mine_dovan_interiors.dovan_tavern.npcs.2.tav_old.name'), dir: 'e', talk: 'dovan_tav_old', reward: 'lead' }),
      ],
    });
    // ---------------------------------------------------------------- 鉱夫の家（ダグの家族）・小さな鉱夫の家（ロルフの母）
    interior('dovan_house', R.T('map.mine_dovan_interiors.dovan_house'), 12, 10, {
      back: 'house', meta: { sub: R.T('map.mine_dovan_interiors.dovan_house.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('chair', 6, 6), K.prop('cupboard', 6, 2), K.prop('lantern', 4, 3)],
      npcs: [
        K.npc('dag_wife', 'npc_mine_woman', 5, 4, { name: R.T('map.mine_dovan_interiors.dovan_house.npcs.0.dag_wife.name'), dir: 's', talk: 'dovan_dag_wife', reward: 'side' }),
        K.npc('dag_kid', 'npc_mine_child', 8, 6, { name: R.T('map.mine_dovan_interiors.dovan_house.npcs.1.dag_kid.name'), dir: 'w', talk: 'dovan_dag_kid', reward: 'hint' }),
        K.npc('dag', 'npc_miner', 3, 6, { name: R.T('map.mine_dovan_interiors.dovan_house.npcs.2.dag.name'), dir: 'e', talk: 'dovan_dag', reward: null, cond: 'mine_miner1' }),
      ],
    });
    interior('dovan_house2', R.T('map.mine_dovan_interiors.dovan_house2'), 10, 9, {
      back: 'house2', meta: { sub: R.T('map.mine_dovan_interiors.dovan_house2.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('table', 5, 5), K.prop('chair', 4, 5), K.prop('cupboard', 7, 2), K.prop('lantern', 3, 3)],
      npcs: [
        K.npc('rolf_mother', 'npc_mine_old_f', 5, 3, { name: R.T('map.mine_dovan_interiors.dovan_house2.npcs.0.rolf_mother.name'), dir: 's', talk: 'dovan_rolf_mother', reward: 'side' }),
        K.npc('rolf', 'npc_miner', 7, 5, { name: R.T('map.mine_dovan_interiors.dovan_house2.npcs.1.rolf.name'), dir: 'w', talk: 'dovan_rolf', reward: null, cond: 'mine_miner2' }),
      ],
    });
    // ---------------------------------------------------------------- 道具屋・宿「坑灯亭」（上の段）
    interior('dovan_items', R.T('map.mine_dovan_interiors.dovan_items'), 12, 10, {
      back: 'items', meta: { sub: R.T('map.mine_dovan_interiors.dovan_items.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('counter', 6, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2),
        K.prop('tool_crate', 1, 6), K.prop('coal_barrel', 10, 6), K.prop('lantern', 8, 3)],
      npcs: [K.npc('item_keeper', 'npc_mine_woman', 5, 2, { name: R.T('map.mine_dovan_interiors.dovan_items.npcs.0.item_keeper.name'), dir: 's', talk: 'dovan_item_keeper', pushable: false })],
    });
    interior('dovan_inn', R.T('map.mine_dovan_interiors.dovan_inn'), 16, 12, {
      back: 'inn', carpet: [5, 6, 6, 3], meta: { sub: R.T('map.mine_dovan_interiors.dovan_inn.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('bookshelf', 1, 2),
        K.prop('bed', 11, 2), K.prop('bed', 13, 2), K.prop('bed', 11, 5), K.prop('bed', 13, 5),
        K.prop('table', 6, 8), K.prop('chair', 5, 8), K.prop('chair', 7, 8), K.prop('lantern', 8, 3), K.prop('lantern', 14, 8)],
      npcs: [
        K.npc('inn_keeper', 'npc_mine_old_f', 4, 2, { name: R.T('map.mine_dovan_interiors.dovan_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'dovan_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_traveler', 12, 8, { name: R.T('map.mine_dovan_interiors.dovan_inn.npcs.1.inn_guest.name'), dir: 'w', talk: 'dovan_inn_guest', reward: 'lead' }),
      ],
      spawns: { bed: { x: 12, y: 7, dir: 's' } },
    });
    // ---------------------------------------------------------------- 鍛冶場（上の段。鍛冶衆のたまり場・武器屋）
    interior('dovan_forge', R.T('map.mine_dovan_interiors.dovan_forge'), 18, 12, {
      back: 'forge', floor: 'stone_floor', meta: { sub: R.T('map.mine_dovan_interiors.dovan_forge.meta.sub') },
      objects: [K.prop('forge', 3, 2), K.prop('forge_glow', 3, 3), K.prop('bellows', 5, 3), K.exam(5, 3, 'dovan_bellows'), K.prop('anvil', 7, 5), K.prop('anvil', 10, 5),
        K.prop('coal_barrel', 1, 5), K.prop('tool_rack', 12, 2), K.prop('weapon_rack', 14, 2), K.prop('counter', 13, 7), K.prop('counter', 14, 7), K.prop('counter', 15, 7),
        // 壁の拓本の受け取り書（記録院の印）・鍛冶神の小さな石像
        K.prop('board', 9, 1), K.exam(9, 1, 'dovan_receipt'), K.prop('oath_stone', 16, 3), K.exam(16, 3, 'dovan_forge_statue'), K.prop('lantern', 11, 3)],
      npcs: [
        K.npc('helga', 'npc_helga', 8, 3, { name: R.T('map.mine_dovan_interiors.dovan_forge.npcs.0.helga.name'), title: R.T('map.mine_dovan_interiors.dovan_forge.npcs.0.helga.title'), dir: 's', talk: 'dovan_helga', reward: 'lead', pushable: false }),
        K.npc('forge_seller', 'npc_smith', 14, 6, { name: R.T('map.mine_dovan_interiors.dovan_forge.npcs.1.forge_seller.name'), dir: 's', talk: 'dovan_forge_seller', pushable: false }),
        K.npc('forge_boy', 'npc_mine_child', 6, 6, { name: R.T('map.mine_dovan_interiors.dovan_forge.npcs.2.forge_boy.name'), dir: 'n', talk: 'dovan_forge_boy', reward: 'side' }),
      ],
    });
    // ---------------------------------------------------------------- 隠者の庵（トロッコ線の崖の尾根。#15）
    interior('mine_hermit', R.T('map.mine_dovan_interiors.mine_hermit'), 12, 10, {
      back: 'hut', backMap: 'g_rail', location: 'hermit', meta: { sub: R.T('map.mine_dovan_interiors.mine_hermit.meta.sub') },
      objects: [K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.prop('bed', 10, 2), K.prop('table', 6, 5), K.prop('chair', 5, 5), K.prop('stove', 8, 2),
        K.prop('lantern', 4, 3), K.prop('house_plant', 10, 6)],
      npcs: [K.npc('hermit', 'npc_hermit', 6, 3, { name: R.T('map.mine_dovan_interiors.mine_hermit.npcs.0.hermit.name'), dir: 's', talk: 'mine_hermit', reward: 'item', pushable: false })],
    });
  });
})(window.RPG);
