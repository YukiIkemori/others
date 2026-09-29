// CONTENT-F: フェルンの屋内 6 つ（V2_PLAN §3.2）: 宿「木漏れ日亭」・道具屋・リタの歌の家・捜索隊の詰所・きこり頭ゴードの家・ピムの家
//   どれも K.room（上 2 行が壁の立ち上がり、下の中ほどに 1 マスの戸口）。戸口のマスが出口（フェルンの戸の前へ）。
//   外の建物に合わせた小さめの部屋に、家具を文字の絵（R.ContentP.kit.furnish）で詰めて置く。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit;
    const L = K.L;
    const LIGHT = { ambient: '#76688a', k: 0.8, mood: 'interior' };
    const FU = (floor, wall) => R.ContentP.kit.furnish(floor, wall);   // 家具を文字の絵で（prologue_00_kit.js）

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
        exits: [{ x: door.x, y: h - 1, w: 1, h: 1, to: { map: 'fern', spawn: o.back } }],
        triggers: o.triggers || [],
        light: Object.assign({}, LIGHT, o.light || {}),
        bgm: o.bgm || 'village',
        meta: Object.assign({ minimap: false }, o.meta || {}),
      };
      return K.def(id, m);
    }

    // ---------------------------------------------------------------- 宿「木漏れ日亭」13×10: 寝台 4 つ・暖炉・右の受付
    interior('fern_inn', R.T('map.fern_interiors.fern_inn'), 13, 10, {
      back: 'inn', carpet: [5, 3, 3, 4],
      objects: FU([
        'B.B.F-.C.JK',
        '...........',
        'B.B....N-N-',
        '...........',
        '....cL-c..P',
        '...........',
        'pV........b'], '.w.h..c.w..'),
      npcs: [
        K.npc('inn_keeper', 'npc_woman_4', 9, 3, { name: R.T('map.fern_interiors.fern_inn.npcs.0.inn_keeper.name'), dir: 's', talk: 'fern_inn_keeper', pushable: false }),
        K.npc('inn_guest', 'npc_man_4', 9, 6, { name: R.T('map.fern_interiors.fern_inn.npcs.1.inn_guest.name'), dir: 'w', talk: 'fern_inn_guest', reward: 'lead' }),
      ],
    });

    // ---------------------------------------------------------------- 道具屋 11×9: 右の台・薬瓶の棚・干した香草
    interior('fern_shop', R.T('map.fern_interiors.fern_shop'), 11, 9, {
      back: 'shop', carpet: [3, 4, 3, 3],
      objects: FU([
        'VY.l.O.JO',
        'k........',
        'w.....N-.',
        'b........',
        'x.......P',
        'xk.....pp'], 'h..s..h..'),
      npcs: [
        K.npc('shop_keeper', 'npc_merchant_3', 8, 3, { name: R.T('map.fern_interiors.fern_shop.npcs.0.shop_keeper.name'), dir: 's', talk: 'fern_shop_keeper', pushable: false }),
      ],
    });

    // ---------------------------------------------------------------- リタの歌の家 12×10（歌あわせ）: まん中に歌い石、本棚と書き物机
    interior('fern_rita', R.T('map.fern_interiors.fern_rita'), 12, 10, {
      back: 'rita', carpet: [4, 4, 5, 3], wall: 'wall_bark', floor: 'wood_floor',
      objects: FU([
        'SS.P...P.B',
        '..........',
        '..........',
        'E.........',
        's.......Tc',
        'p........l',
        'k.......Y.'], '..y.c...c.').concat([
        K.prop('songstone', 6, 3, { variant: 2 }), K.exam(6, 4, 'fern_rita_stone'),
        K.chest('fern_rita_c1', 10, 8, { item: 'i_potion', n: 1 }),
      ]),
      npcs: [
        K.npc('rita', 'npc_rita', 4, 5, { name: R.T('map.fern_interiors.fern_rita.npcs.0.rita.name'), title: R.T('map.fern_interiors.fern_rita.npcs.0.rita.title'), dir: 's', talk: 'fern_rita', reward: 'lead' }),
        K.npc('rita_pupil', 'npc_child_3', 8, 5, { name: R.T('map.fern_interiors.fern_rita.npcs.1.rita_pupil.name'), dir: 'w', talk: 'fern_song_game', reward: 'side' }),
      ],
      light: { ambient: '#80729c' },   // 夜の環境光の倍率を上げた分（RENDER ambientGain）だけ下げた。宝箱が床に溶けないように（check_chests）
    });

    // ---------------------------------------------------------------- 捜索隊の詰所 12×9: 地図の卓・掲示・武器と盾の棚
    interior('fern_search', R.T('map.fern_interiors.fern_search'), 12, 9, {
      back: 'search', floor: 'wood_floor', wall: 'wall_wood',
      objects: FU([
        '.q..C.WZ-b',
        '.........x',
        '...cL-c..x',
        'A.........',
        'k.....g...',
        'kb.......l'], '..m..t....').concat([K.exam(2, 3, 'fern_search_map')]),
      npcs: [
        K.npc('search_chief', 'npc_guard_1', 6, 3, { name: R.T('map.fern_interiors.fern_search.npcs.0.search_chief.name'), dir: 's', talk: 'fern_search_chief', reward: 'hint' }),
        K.npc('search_b', 'npc_woodcutter_4', 9, 6, { name: R.T('map.fern_interiors.fern_search.npcs.1.search_b.name'), dir: 'w', talk: [L(R.T('map.fern_interiors.fern_search.talk.0.L')), L('forest_found_ben', R.T('map.fern_interiors.fern_search.talk.1.forest_found_ben')), L('cleared_r_forest', R.T('map.fern_interiors.fern_search.talk.2.cleared_r_forest'))], reward: 'news' }),
      ],
    });

    // ---------------------------------------------------------------- きこり頭ゴードの家 10×8: 大きな寝台・暖炉・斧の棚・薪
    interior('fern_gord', R.T('map.fern_interiors.fern_gord'), 10, 8, {
      back: 'gord', floor: 'wood_floor', wall: 'wall_wood', carpet: [3, 3, 4, 2],
      objects: FU([
        'D-.F-.W.',
        '......gg',
        'cT......',
        's.....xb',
        'k.....bb'], '..a....o'),
      npcs: [
        K.npc('gord', 'npc_gord', 5, 4, { name: R.T('map.fern_interiors.fern_gord.npcs.0.gord.name'), title: R.T('map.fern_interiors.fern_gord.npcs.0.gord.title'), dir: 's', talk: 'fern_gord', reward: 'lead', pushable: false }),
      ],
    });

    // ---------------------------------------------------------------- ピムの家（母カトリ）10×8: ピムの寝台・かまど・糸車
    interior('fern_pim_home', R.T('map.fern_interiors.fern_pim_home'), 10, 8, {
      back: 'pim_home', floor: 'wood_floor', wall: 'wall_wood', carpet: [3, 3, 4, 2],
      objects: FU([
        'B.p.H.JB',
        '........',
        '..cT...Q',
        'S.......',
        'Vk....lP'], '.w.h.w..').concat([K.exam(1, 3, 'fern_pim_bed')]),
      npcs: [
        K.npc('katri', 'npc_pim_mother', 6, 4, { name: R.T('map.fern_interiors.fern_pim_home.npcs.0.katri.name'), title: R.T('map.fern_interiors.fern_pim_home.npcs.0.katri.title'), dir: 's', talk: 'fern_pim_mother', reward: 'lead', pushable: false }),
      ],
    });
  });
})(window.RPG);
