// CONTENT（マレア諸島）: 岬の村ネレイ（nerei、40×44）と屋内 5・灯台島の灯室。WORLD_REDESIGN §5.9・§4.5、STORY_BIBLE §7.5・§8.6。
//   岬の細い尾根に家がひと筋。北の先に石畳の広場と岬の石の灯、東へ小道を下りると夜の桟橋（T 字）。南の端から岬道（i_cape）へ。
//   家（下絵の敷地）: 灯り守りの家（北西）・マリナの家（北東）・雑貨屋（中の西、しまのひさし）・漁師の家（中の東）・宿（南西）。
//   場面: 岬の先の灰色のマントの少女（マリナが歌う前）・夜の桟橋のマリナ（isles_song_scene）・地平が白むころの桟橋のマリナとグレン（isles_dawn_scene）。
//   灯り: 港の灯（lamp_pillar）を、岬の崖の縁（歩けないマス）と桟橋の先の杭に。町の絵は 1 枚の下絵（v2/assets/env/isles/under/nerei*）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, IK = R.Isles.kit, L = K.L;
    const P = IK.painted('nerei');
    const D = (map, sign) => ({ map, spawn: 'door', sign });
    const O = IK.blds('nerei', {
      nerei_lampkeeper: D('nerei_lampkeeper'), nerei_marina: D('nerei_marina'), nerei_store: D('nerei_store', 'item'),
      nerei_house: D('nerei_house'), nerei_inn: D('nerei_inn', 'inn'),
    });
    // 岬の石の灯（調べる）・南の入口の看板
    O.push(K.exam(21, 3, 'nerei_cape_lamp'), K.prop('lamp_pillar', 22, 2));
    O.push(K.sign(16, 42, R.T('map.isles_nerei.sign')));   // 看板・灯りが壁・崖・岩のマスに埋まっていたので床へ（tools/qa/check_props.js、2026-10-01）
    // 夜の桟橋の先: 外洋船の舵（桟橋に船をつなぐ）
    for (const [x, y] of [[34, 12], [35, 12]]) O.push(K.exam(x, y, 'isles_helm'));
    O.push(K.prop('ship', 37, 11, { cond: 'isles_ship' }));
    // 光る貝がら（村の浜）
    O.push(K.exam(29, 21, 'isles_shell', { shell: 3 }), K.exam(11, 26, 'isles_shell', { shell: 4 }), K.exam(12, 28, 'isles_shell', { shell: 5 }));
    // 宝箱（見える所）
    O.push(K.chest('nerei_c1', 13, 14, { pool: 'p_T' }));
    // 港の灯（岬の崖の縁・桟橋の先の杭）
    for (const [x, y] of [[14, 5], [27, 5], [28, 11], [10, 18], [29, 25], [36, 6], [33, 12]]) O.push(K.prop('lamp_pillar', x, y));

    const N = [
      K.npc('nerei_fisher', 'npc_isles_man', 24, 20, { name: R.T('map.isles_nerei.N.0.nerei_fisher.name'), dir: 'w', talk: 'nerei_fisher', reward: 'lead' }),
      K.npc('nerei_child', 'npc_isles_child', 17, 27, { name: R.T('map.isles_nerei.N.1.nerei_child.name'), dir: 's', move: 'wander', talk: 'nerei_child', reward: 'hint' }),
      K.npc('nerei_oldman', 'npc_isles_old_m', 23, 6, { name: R.T('map.isles_nerei.N.2.nerei_oldman.name'), dir: 's', talk: 'nerei_oldman', reward: 'boss' }),
      // 岬の先の少女（マリナに会ってから、マリナが歌う前）
      K.npc('fine', 'fine', 20, 3, { name: R.T('map.isles_nerei.N.3.fine.name'), dir: 'n', talk: 'isles_fine_cape', reward: null, pushable: false, cond: ['isles_marina_met', '!isles_fine_seen', '!isles_song_done'] }),
      // 夜の桟橋のマリナ（歌う場面）
      K.npc('marina_pier', 'npc_marina', 34, 7, { name: R.T('map.isles_nerei.N.4.marina_pier.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: 'isles_song_scene' }),
      // 地平が白むころの桟橋（マリナとグレン・日継ぎの主張を口にする漁師）
      K.npc('marina_dawn', 'npc_marina', 34, 9, { name: R.T('map.isles_nerei.N.5.marina_dawn.name'), dir: 'n', talk: [L('……。')], reward: null, pushable: false, cond: 'isles_dawn_scene' }),
      K.npc('glen_dawn', 'npc_glen', 35, 7, { name: R.T('map.isles_nerei.N.6.glen_dawn.name'), dir: 's', talk: [L('……。')], reward: null, pushable: false, cond: ['isles_dawn_scene', '!isles_dawn_done'] }),
      K.npc('dawn_fisher', 'npc_isles_man', 32, 9, { name: R.T('map.isles_nerei.N.7.dawn_fisher.name'), dir: 'e', talk: [L('……。')], reward: null, pushable: false, cond: 'isles_dawn_scene' }),
    ];
    const sp = (bid) => IK.doorSpawn('nerei', bid);
    K.def('nerei', {
      name: R.T('map.isles_nerei.nerei.name'), kind: 'town', region: 'r_isles', location: 'nerei', theme: 'harbor',
      legend: IK.TOWN(), rows: P.rows, outside: 'sea',
      objects: O, npcs: N,
      spawns: {
        gate: { x: 20, y: 42, dir: 'n' }, warp: { x: 20, y: 21, dir: 's' }, pier: { x: 33, y: 9, dir: 'e' }, tip: { x: 21, y: 5, dir: 'n' },
        pier_end: { x: 34, y: 11, dir: 'n' },
        lampkeeper: sp('nerei_lampkeeper'), marina: sp('nerei_marina'), store: sp('nerei_store'), house: sp('nerei_house'), inn: sp('nerei_inn'),
      },
      exits: [{ x: 20, y: 43, w: 1, h: 1, to: { map: 'i_cape', spawn: 'north' } }],
      triggers: [
        { id: 'arrival', on: 'enter', event: 'nerei_arrival' },
        { id: 'fine', x: 18, y: 4, w: 6, h: 2, on: 'step', event: 'isles_fine_cape', cond: ['isles_marina_met', '!isles_fine_seen', '!isles_song_done'] },
      ],
      zones: [],
      light: IK.LIGHT_VILLAGE, dark: false, bgm: 'isles', bbg: 'isles',
      meta: { sub: R.T('map.isles_nerei.nerei.meta.sub'), chestsInfo: false },
      art: P.art,
    });

    // ================================================================ 屋内 5
    function interior(id, name, w, h, o) {
      const { g, door } = K.room(w, h, { doorX: o.doorX });
      if (o.carpet) K.rect(g, o.carpet[0], o.carpet[1], o.carpet[2], o.carpet[3], 'c');
      return K.def(id, {
        name, kind: 'interior', region: 'r_isles', location: o.location || 'nerei',
        legend: IK.ROOM(o.wall || 'wall_stone', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_stone',
        objects: o.objects || [], npcs: o.npcs || [],
        spawns: Object.assign({ door: { x: door.x, y: h - 2, dir: 'n' } }, o.spawns || {}),
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: o.backMap || 'nerei', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, IK.LIGHT_ROOM, o.light || {}),
        bgm: o.bgm || 'isles',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      });
    }
    interior('nerei_lampkeeper', R.T('map.isles_nerei.nerei_lampkeeper'), 12, 10, {
      back: 'lampkeeper', meta: { sub: R.T('map.isles_nerei.nerei_lampkeeper.meta.sub') },
      objects: [K.prop('bed', 9, 2), K.prop('table', 4, 5), K.prop('chair', 3, 5), K.prop('barrel', 1, 2), K.prop('barrel', 2, 2), K.prop('shelf_jars', 6, 2),
        K.prop('lantern', 5, 3), K.prop('lantern', 10, 6)],
      npcs: [K.npc('lampkeeper', 'npc_isles_old_m', 7, 4, { name: R.T('map.isles_nerei.nerei_lampkeeper.npcs.0.lampkeeper.name'), dir: 's', talk: 'nerei_lampkeeper', reward: 'side' })],
    });
    interior('nerei_marina', R.T('map.isles_nerei.nerei_marina'), 12, 10, {
      back: 'marina', carpet: [4, 5, 4, 2], meta: { sub: R.T('map.isles_nerei.nerei_marina.meta.sub') },
      objects: [K.prop('bed', 9, 2), K.prop('bookshelf', 1, 2), K.prop('bookshelf', 2, 2), K.exam(1, 3, 'nerei_marina_shelf'), K.prop('table', 5, 5), K.prop('chair', 4, 5),
        K.prop('net', 10, 6), K.prop('flower_pot', 1, 7), K.prop('lantern', 7, 3)],
      npcs: [K.npc('marina', 'npc_marina', 6, 4, { name: R.T('map.isles_nerei.nerei_marina.npcs.0.marina.name'), title: R.T('map.isles_nerei.nerei_marina.npcs.0.marina.title'), dir: 's', talk: 'nerei_marina', reward: 'lead', pushable: false, cond: '!isles_dawn_scene' })],
    });
    interior('nerei_store', R.T('map.isles_nerei.nerei_store'), 12, 10, {
      back: 'store', meta: { sub: R.T('map.isles_nerei.nerei_store.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('counter', 5, 3), K.prop('shelf_jars', 1, 2), K.prop('potion_shelf', 9, 2), K.prop('crate', 10, 6),
        K.prop('fish_barrel', 1, 6), K.prop('lantern', 7, 3)],
      npcs: [K.npc('store_keeper', 'npc_isles_woman', 4, 2, { name: R.T('map.isles_nerei.nerei_store.npcs.0.store_keeper.name'), dir: 's', talk: 'nerei_store_keeper', pushable: false })],
    });
    interior('nerei_house', R.T('map.isles_nerei.nerei_house'), 12, 10, {
      back: 'house', meta: { sub: R.T('map.isles_nerei.nerei_house.meta.sub') },
      objects: [K.prop('bed', 1, 2), K.prop('bed', 9, 2), K.prop('table', 5, 6), K.prop('chair', 4, 6), K.prop('net', 10, 6), K.prop('lantern', 7, 3)],
      npcs: [K.npc('house_wife', 'npc_isles_woman', 6, 4, { name: R.T('map.isles_nerei.nerei_house.npcs.0.house_wife.name'), dir: 's', talk: 'nerei_house_wife', reward: 'news' })],
    });
    interior('nerei_inn', R.T('map.isles_nerei.nerei_inn'), 14, 10, {
      back: 'inn', carpet: [5, 5, 4, 2], meta: { sub: R.T('map.isles_nerei.nerei_inn.meta.sub') },
      objects: [K.prop('counter', 3, 3), K.prop('counter', 4, 3), K.prop('bed', 9, 2), K.prop('bed', 11, 2), K.prop('bed', 11, 5), K.prop('table', 6, 6), K.prop('chair', 5, 6),
        K.prop('lantern', 7, 3)],
      npcs: [
        K.npc('nerei_inn_keeper', 'npc_isles_old_f', 3, 2, { name: R.T('map.isles_nerei.nerei_inn.npcs.0.nerei_inn_keeper.name'), dir: 's', talk: 'nerei_inn_keeper', pushable: false }),
        K.npc('nerei_inn_guest', 'npc_isles_sailor', 9, 7, { name: R.T('map.isles_nerei.nerei_inn.npcs.1.nerei_inn_guest.name'), dir: 'w', talk: 'nerei_inn_guest', reward: 'lead' }),
      ],
      spawns: { bed: { x: 10, y: 4, dir: 's' } },
    });

    // ---------------------------------------------------------------- 灯台島の灯室（i_light の灯台の戸口から）
    interior('isles_lamproom', R.T('map.isles_nerei.isles_lamproom'), 10, 10, {
      back: 'lamproom', backMap: 'i_light', location: 'lighthouse_isle', bgm: 'sea', meta: { sub: R.T('map.isles_nerei.isles_lamproom.meta.sub') },
      objects: [K.prop('lantern', 4, 2), K.exam(4, 2, 'isles_lamp'), K.prop('beacon_glow', 4, 2, { cond: { any: ['isles_light_lit', 'cleared_r_isles'] } }),
        K.prop('writing_desk', 1, 5), K.exam(1, 5, 'isles_lamproom_letter'), K.prop('bookshelf', 8, 2), K.exam(8, 2, 'isles_keeper_log'), K.prop('barrel', 8, 6)],
      light: { ambient: '#7a7a92', k: 0.72 },
    });
  });
})(window.RPG);
