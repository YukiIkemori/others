// CONTENT（砂漠）: 砂に沈んだ神殿（WORLD_REDESIGN §2.7 #6）。南の浜の砂から柱の先だけが出ている。
//   入れるのは、砂漠の解決の後か、消灯の刻を 3 晩過ごした後（満月の晩。変数 desert_nights ≥ 3）。
//   desert_temple_1（48×40）「柱の間」: 砂に半分うまった柱の林。三つの日輪の盤（踏み板）を踏むと、奥の扉が開く。泉 1・宝箱 5。
//   desert_temple_2（40×34）「日輪の奥殿」: 泉の控えの間 → 黄金の守護像たち（tr_desert_sun_guard）→ 日輪の杖 u_sun_staff の宝箱。
//   日継ぎの主張の碑（「日輪の火は太陽の欠片。王が空から取った」）。出現は z_desert_temple（黄金の守護像の巣）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const deco = (O, list) => { for (const [id, x, y, v] of list) O.push(K.prop(id, x, y, v != null ? { variant: v } : undefined)); };
    const DISCS = ['desert_tp_disc_1', 'desert_tp_disc_2', 'desert_tp_disc_3'];

    // ================================================================ 1 階
    {
      const W = 48, H = 40;
      const g = K.grid(W, H, '#');
      K.rect(g, 18, 2, 12, 8, '.');                  // 入口の間（上の階段）
      K.rect(g, 22, 10, 4, 5, '.');
      K.rect(g, 6, 15, 36, 15, '.');                 // 柱の間
      K.rect(g, 2, 18, 4, 8, '.'); K.rect(g, 42, 18, 4, 8, '.');   // 西と東の小部屋（踏み板）
      K.rect(g, 21, 30, 6, 2, 'G');                  // 奥の扉
      K.rect(g, 16, 32, 16, 6, '.');                 // 奥の間（下り階段）
      K.rect(g, 8, 4, 8, 7, '.'); K.rect(g, 16, 6, 2, 2, '.');       // 北西の部屋（踏み板 3）
      K.rect(g, 32, 4, 9, 7, '.'); K.rect(g, 30, 6, 2, 2, '.');      // 北東の部屋（泉）
      // 砂の吹きだまり
      K.blob(g, 14, 20, 5, 3, 's', 'tp1a', '.'); K.blob(g, 33, 25, 6, 3, 's', 'tp1b', '.'); K.blob(g, 24, 4, 4, 2, 's', 'tp1c', '.'); K.blob(g, 11, 7, 2, 2, 's', 'tp1d', '.');
      // 柱の林（歩ける所を細かく区切る）
      for (let y = 17; y <= 27; y += 3) for (let x = 9; x <= 39; x += 4) if (!(x >= 21 && x <= 27 && y >= 26)) K.put(g, x, y, '#');
      const O = [];
      O.push(K.stairs(24, 3, { map: 'world', spawn: 'temple' }, { id: 'desert_temple_1_up', look: 'up' }));
      O.push(K.stairs(24, 35, { map: 'desert_temple_2', spawn: 'top' }, { id: 'desert_temple_1_down' }));
      O.push({ type: 'switch', id: 'desert_temple_1_d1', x: 3, y: 21, flag: DISCS[0], look: 'plate', color: 'gold' });
      O.push({ type: 'switch', id: 'desert_temple_1_d2', x: 44, y: 22, flag: DISCS[1], look: 'plate', color: 'gold' });
      O.push({ type: 'switch', id: 'desert_temple_1_d3', x: 10, y: 5, flag: DISCS[2], look: 'plate', color: 'gold' });
      O.push(K.prop('switch', 20, 29, { cond: { not: { all: DISCS } } }), K.exam(24, 29, 'desert_temple_door', { cond: { not: { all: DISCS } } }));
      O.push(K.spring('desert_temple_1_s1', 36, 6));
      O.push(K.chest('desert_temple_1_c1', 3, 24, { pool: 'p_T' }), K.chest('desert_temple_1_c2', 45, 19, { pool: 'p_T' }), K.chest('desert_temple_1_c3', 14, 9, { gold: 400 }),
        K.chest('desert_temple_1_c4', 39, 28, { pool: 'p_rare' }), K.chest('desert_temple_1_c5', 17, 36, { item: 'i_stone_light', n: 2 }));
      O.push(K.sign(27, 9, '――日輪の民の宮\n三つの盤に、日を置け'));
      deco(O, [['broken_pillar', 19, 3], ['broken_pillar', 28, 3], ['obelisk', 18, 8], ['obelisk', 29, 8], ['tomb_urn', 7, 15], ['tomb_urn', 40, 15], ['sand_mound', 12, 28],
        ['bones', 30, 16], ['tomb_urn', 7, 28], ['tomb_urn', 40, 28], ['broken_pillar', 31, 36], ['obelisk', 16, 33], ['sand_mound', 38, 9], ['bones', 9, 9], ['clay_jars', 2, 18], ['clay_jars', 45, 25]]);
      for (const [x, y] of [[20, 5], [27, 5], [7, 21], [40, 21], [19, 33], [29, 33], [33, 5], [12, 5]]) O.push(K.prop('torch', x, y));
      K.def('desert_temple_1', {
        name: '砂に沈んだ神殿', kind: 'dungeon', optional: true, region: 'r_desert', location: 'temple', theme: 'tomb',
        legend: DK.TOMB_LEGEND({ G: { mat: 'wall_sandstone', solid: true, rise: 2, name: 'seal_door' } }),
        rows: g, outside: 'wall_sandstone', objects: O, npcs: [],
        spawns: { entrance: { x: 24, y: 5, dir: 's' }, down: { x: 24, y: 33, dir: 'n' } },
        exits: [],
        triggers: [{ id: 'arrive', on: 'enter', event: 'desert_temple_arrive', once: true },
          { id: 'plate_1', x: 3, y: 21, w: 1, h: 1, on: 'step', event: 'desert_temple_plate_1', cond: '!desert_tp_disc_1' },
          { id: 'plate_2', x: 44, y: 22, w: 1, h: 1, on: 'step', event: 'desert_temple_plate_2', cond: '!desert_tp_disc_2' },
          { id: 'plate_3', x: 10, y: 5, w: 1, h: 1, on: 'step', event: 'desert_temple_plate_3', cond: '!desert_tp_disc_3' }],
        tilePatches: [{ cond: { all: DISCS }, rect: [21, 30, 6, 2], rows: ['......', '......'] }],
        zones: [{ rect: null, zone: 'z_desert_temple' }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'pyramid', bbg: 'cave',
        meta: { chestsInfo: true, floor: '1 階', sub: '柱の間' },
      });
    }

    // ================================================================ 2 階（日輪の奥殿）
    {
      const W = 40, H = 34;
      const g = K.grid(W, H, '#');
      K.rect(g, 16, 26, 8, 6, '.');                  // 上り階段の間
      K.rect(g, 6, 24, 10, 6, '.'); K.rect(g, 16, 27, 1, 2, '.');   // 泉の控えの間（西）
      K.rect(g, 18, 18, 4, 8, '.');                  // 通路
      K.rect(g, 8, 4, 24, 14, '.');                  // 奥殿
      K.rect(g, 16, 4, 8, 4, 'c');                   // 祭壇の敷物
      K.rect(g, 26, 22, 8, 6, '.'); K.rect(g, 22, 24, 4, 2, '.');   // 東の宝物庫
      K.blob(g, 12, 13, 3, 2, 's', 'tp2a', '.'); K.blob(g, 28, 14, 3, 2, 's', 'tp2b', '.');
      for (const [x, y] of [[11, 7], [28, 7], [11, 12], [28, 12]]) K.put(g, x, y, '#');
      const O = [];
      O.push(K.stairs(20, 30, { map: 'desert_temple_1', spawn: 'down' }, { id: 'desert_temple_2_up', look: 'up' }));
      O.push(K.spring('desert_temple_2_s1', 9, 26));
      O.push(K.chest('desert_temple_2_staff', 20, 5, { item: 'u_sun_staff' }));
      O.push(K.chest('desert_temple_2_c1', 32, 23, { pool: 'p_rare' }), K.chest('desert_temple_2_c2', 30, 26, { pool: 'p_T' }), K.chest('desert_temple_2_c3', 7, 28, { item: 'i_elixir', n: 1 }));
      O.push(K.prop('obelisk', 14, 4), K.exam(14, 5, 'desert_temple_claim'), K.prop('obelisk', 25, 4), K.exam(25, 5, 'desert_temple_disk'));
      deco(O, [['copper_brazier', 17, 9], ['copper_brazier', 22, 9], ['tomb_urn', 8, 4], ['tomb_urn', 31, 4], ['tomb_urn', 8, 16], ['tomb_urn', 31, 16],
        ['broken_pillar', 17, 27], ['broken_pillar', 22, 27], ['sand_mound', 13, 28], ['bones', 33, 26], ['clay_jars', 27, 22]]);
      for (const [x, y] of [[10, 9], [29, 9], [18, 20], [21, 22], [7, 25], [27, 23]]) O.push(K.prop('torch', x, y));
      K.def('desert_temple_2', {
        name: '砂に沈んだ神殿', kind: 'dungeon', optional: true, region: 'r_desert', location: 'temple', theme: 'tomb',
        legend: DK.TOMB_LEGEND(), rows: g, outside: 'wall_sandstone', objects: O, npcs: [],
        spawns: { top: { x: 20, y: 28, dir: 'n' } },
        exits: [],
        triggers: [{ id: 'guard', x: 18, y: 17, w: 4, h: 1, on: 'step', event: 'desert_temple_guard', cond: '!desert_temple_guard' }],
        zones: [{ rect: null, zone: 'z_desert_temple' }],
        light: DK.LIGHT_TOMB, dark: false, bgm: 'pyramid', bbg: 'cave',
        meta: { chestsInfo: true, floor: '2 階', sub: '日輪の奥殿' },
      });
    }
  });
})(window.RPG);
