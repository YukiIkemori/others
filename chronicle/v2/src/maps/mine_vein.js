// CONTENT（ガルド山地）: 深淵の鉱脈（#17。WORLD_REDESIGN §2.7・§6.4・A25、3 階）。深き坑道の七の層の番人の広間の東のすみの縦穴から下りる。
//   開く: 旗 mine_vein_open（組合につく A・仲裁 C）か、ティア 6（選ばなくても隠しボスとやりこみの場所を失わない）。
//   1 階 vein_1（44×36、暗がり）: 上り口（北西）→ 結晶の大広間 → トロッコ乗り場（西の縁）。広い裂け目は細い線路の架台だけ（歩けない。トロッコで渡る）→
//        東の縁 → 北の小さな岩屋（宝箱）・南の下り口。
//   2 階 vein_2（44×36、暗がり）: 地底の湖（板の渡りと結晶の小島）・西の宝石ハリネズミの巣（岩屋。z_mine_vein_nest）・南の休み場の泉（休息の灯）・南西の下り口。
//   3 階 vein_3（36×30）鉱脈の心臓: 北の壁いっぱいの光る鉱脈と結晶の柱。隠しボス「鉱脈の主」（強さ固定。手前の看板とうわさで「危険」）→ 鉱脈の斧 u_vein_axe。
//   どの階も 1 枚の下絵（v2/assets/env/mine/under/vein_*、field_mine/dng_mine2.py）。光る鉱石は下絵の光る層（_emit）と光だけの物 crystal_glow。
//   暗がりの階はしょく台（brazier）に火をともすと周りが明るいまま（A25）。宝箱は見える所。隠し通路なし（A27）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Mine.kit;
    const ZONE = [{ rect: null, zone: 'z_mine_vein' }];
    const glow = (O, list) => { for (const [x, y] of list) O.push(K.prop('crystal_glow', x, y)); };
    const brazier = (O, id, list) => list.forEach(([x, y], i) => O.push({ type: 'brazier', id: id + '_b' + (i + 1), x, y }));
    const META = (floor, sub) => ({ chestsInfo: true, floor, sub });

    // ================================================================ 1 階
    {
      const P = MK.painted('vein_1');
      const O = [];
      O.push(K.stairs(5, 2, { map: 'mine_3', spawn: 'vein' }, { id: 'vein_1_up', look: 'up' }));
      O.push(K.stairs(37, 32, { map: 'vein_2', spawn: 'up' }, { id: 'vein_1_down', look: 'down' }));
      // トロッコ（裂け目の架台を渡る。乗り場の縁の架台を調べる）
      O.push(K.prop('mine_cart', 24, 16), K.exam(28, 17, 'vein_cart_ride', { ride: 'cart_e' }), K.exam(32, 17, 'vein_cart_ride', { ride: 'cart_w' }), K.prop('mine_cart_ore', 36, 16));
      O.push(K.chest('vein_1_c1', 9, 32, { pool: 'p_rare' }), K.chest('vein_1_c2', 38, 4, { pool: 'p_T' }), K.chest('vein_1_c3', 14, 19, { gold: 400 }));
      brazier(O, 'vein_1', [[6, 5], [19, 15], [26, 19], [36, 25]]);
      glow(O, [[2, 4], [10, 3], [4, 10], [11, 12], [20, 12], [22, 21], [12, 22], [5, 27], [13, 32], [24, 13], [37, 13], [40, 8], [41, 4], [33, 24], [41, 28], [35, 34]]);
      K.def('vein_1', {
        name: R.T('map.mine_vein.vein_1.name'), kind: 'dungeon', optional: true, region: 'r_mine', location: 'vein', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: [],
        spawns: { up: { x: 5, y: 3, dir: 's' }, from2: { x: 37, y: 31, dir: 'n' }, cart_w: { x: 26, y: 17, dir: 'e' }, cart_e: { x: 34, y: 17, dir: 'w' } },
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'vein_arrive', once: true }],
        zones: ZONE,
        light: MK.LIGHT_VEIN, dark: [{ rect: [0, 0, 44, 36] }], darkAlpha: 0.7, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: [] }),
        meta: META(R.T('map.mine_vein.vein_1.meta.META'), R.T('map.mine_vein.vein_1.meta.META_2')),
      });
    }

    // ================================================================ 2 階
    {
      const P = MK.painted('vein_2');
      const O = [];
      O.push(K.stairs(38, 4, { map: 'vein_1', spawn: 'from2' }, { id: 'vein_2_up', look: 'up' }));
      O.push(K.stairs(5, 32, { map: 'vein_3', spawn: 'up' }, { id: 'vein_2_down', look: 'down' }));
      // 休息の灯（南の休み場。長いダンジョンの底の手前の 1 つ）
      O.push(K.spring('vein_2_spring', 21, 31));
      O.push(K.chest('vein_2_c1', 38, 28, { pool: 'p_T' }), K.chest('vein_2_c2', 4, 14, { pool: 'p_rare' }), K.chest('vein_2_c3', 20, 11, { item: 'i_elixir', n: 1 }));
      // 宝石ハリネズミの巣の岩屋の前の古い坑夫の書き付け
      O.push(K.exam(5, 17, 'vein_nest_note'));
      brazier(O, 'vein_2', [[30, 13], [20, 30], [3, 16]]);
      glow(O, [[2, 9], [2, 16], [7, 9], [7, 18], [4, 20], [15, 9], [26, 9], [33, 14], [32, 22], [41, 3], [17, 30], [25, 33], [2, 31], [41, 29], [10, 27], [20, 18]]);
      K.def('vein_2', {
        name: R.T('map.mine_vein.vein_2.name'), kind: 'dungeon', optional: true, region: 'r_mine', location: 'vein', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: [],
        spawns: { up: { x: 38, y: 5, dir: 's' }, from3: { x: 6, y: 31, dir: 'n' } },
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'vein_f2_arrive', once: true }],
        // 西の岩屋は宝石ハリネズミの巣（先に当たる区画が先）
        zones: [{ rect: [1, 8, 9, 12], zone: 'z_mine_vein_nest' }].concat(ZONE),
        light: MK.LIGHT_VEIN, dark: [{ rect: [0, 0, 44, 36] }], darkAlpha: 0.7, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: [] }),
        meta: META(R.T('map.mine_vein.vein_2.meta.META'), R.T('map.mine_vein.vein_2.meta.META_2')),
      });
    }

    // ================================================================ 3 階（鉱脈の心臓）
    {
      const P = MK.painted('vein_3');
      const O = [];
      O.push(K.stairs(18, 27, { map: 'vein_2', spawn: 'from3' }, { id: 'vein_3_up', look: 'up' }));
      O.push(K.sign(16, 24, R.T('map.mine_vein.sign')));   // 看板・灯りが壁・崖・岩のマスに埋まっていたので床へ（tools/qa/check_props.js、2026-10-01）
      O.push(K.exam(17, 5, 'vein_heart'), K.exam(18, 5, 'vein_heart'), K.exam(19, 5, 'vein_heart'));
      O.push(K.chest('vein_3_c1', 31, 5, { item: 'u_vein_axe', n: 1, cond: 'mine_vein_lord' }), K.chest('vein_3_c2', 18, 19, { pool: 'p_rare' }));
      glow(O, [[14, 3], [18, 3], [22, 3], [11, 9], [25, 9], [12, 16], [24, 16], [8, 12], [28, 12], [9, 17], [27, 17], [15, 22], [21, 22], [33, 4]]);
      K.def('vein_3', {
        name: R.T('map.mine_vein.vein_3.name'), kind: 'dungeon', optional: true, region: 'r_mine', location: 'vein', theme: 'mine',
        legend: MK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: [],
        spawns: { up: { x: 18, y: 26, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'vein_f3_arrive', once: true },
          { id: 'lord', x: 12, y: 13, w: 13, h: 2, on: 'step', event: 'vein_lord', cond: '!mine_vein_lord' },
        ],
        zones: [],
        light: Object.assign({}, MK.LIGHT_VEIN, { ambient: '#5a6090', k: 0.66 }), dark: false, bgm: 'cave', bbg: 'mine', propSet: 'mine',
        art: Object.assign({}, P.art, { painted: [] }),
        meta: META(R.T('map.mine_vein.vein_3.meta.META'), R.T('map.mine_vein.vein_3.meta.META_2')),
      });
    }
  });
})(window.RPG);
