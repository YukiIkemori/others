// CONTENT（オルビス高原）: 星読みの塔 1 階＋屋上の頂（WORLD_REDESIGN §4.8・§6.4・§6.5、STORY_BIBLE §7.8・§11.8）。
//   1 階 star_tower_1（52×46）: 丸い塔。南の扉 → 外の輪の広間（柱の台座）→ 内の丸い壁の口（西・北の格子）→ 真ん中の天球儀。
//        内の輪の真ちゅうのハンドルで天球儀の輪を回すと、北の口の格子が上がる（star_orrery_rot。一度きりで戻らない。
//        入口の近くの文字盤は輪の向きを示すだけ）。西の口はいつも開いている。北の口の石段の上が奥の間:
//        格子の口を上がったすぐの所で天球の番人（v_sentinel_star_01 → tr_b_orrery）→ 壁ぞいの石段 → 頂。
//        泉は置かない（外から 2 階までの短いダンジョン）。宝箱は見える所。隠し通路なし（A27）。
//   頂 star_tower_top（40×34）: 丸い屋上。星図のモザイクの上で星食らい（tr_b_stareater）→
//        北の書見台で星の名を読み上げる（star_naming → 灯り直す場面）。名を読んだ後は、青銅の星のかがり火に火が入る。
//   当たりは描いた絵に合わせた star_painted_rows.js（intfit.py・intclean.py）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, SK = R.Star.kit;

    // ================================================================ 1 階
    {
      const P = SK.painted('star_tower_1');
      const O = [];
      O.push(K.stairs(25, 2, { map: 'star_tower_top', spawn: 'from1' }, { id: 'star_tower_1_up', look: 'up' }), K.stairs(26, 2, { map: 'star_tower_top', spawn: 'from1' }, { look: 'up' }));
      // 天球儀の輪のハンドル（内の輪・入口の近く）
      O.push(K.prop('lever', 26, 31), K.exam(26, 31, 'star_orrery_lever'), K.prop('lever', 22, 37), K.exam(22, 37, 'star_orrery_dial'));
      // 鉄の格子（北の口の石段: 天球儀の輪を回すと上がる）
      O.push(K.prop('iron_gate', 25, 12, { cond: '!star_orrery_rot' }), K.exam(25, 12, 'star_tower_gate', { cond: '!star_orrery_rot' }), K.exam(26, 12, 'star_tower_gate', { cond: '!star_orrery_rot' }));
      O.push(K.chest('star_tower_1_c1', 5, 26, { pool: 'p_T' }), K.chest('star_tower_1_c2', 46, 26, { item: 'i_ether', n: 2 }), K.chest('star_tower_1_c3', 38, 8, { pool: 'p_T' }));
      for (const [x, y] of [[26, 16], [26, 38], [8, 20], [44, 20], [26, 6]]) O.push(K.prop('star_glow', x, y));
      K.def('star_tower_1', {
        name: R.T('map.star_tower.star_tower_1.name'), kind: 'dungeon', region: 'r_star', location: 'startower', theme: 'lighthouse', propSet: 'star',
        legend: SK.INT(), rows: P.rows, outside: 'wall_stone', objects: O, npcs: [],
        spawns: { entrance: { x: 25, y: 42, dir: 'n' }, from_top: { x: 25, y: 4, dir: 's' } },
        exits: [{ x: 25, y: 45, w: 2, h: 1, to: { map: 's_ridge', spawn: 'tower' } }],
        tilePatches: [
          { cond: '!star_orrery_rot', rect: [25, 11, 2, 2], rows: ['XX', 'XX'] },
        ],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'star_tower_arrive' },
          { id: 'sentinel', x: 25, y: 10, w: 2, h: 1, on: 'step', event: 'star_sentinel', cond: '!star_sentinel' },
        ],
        zones: [{ rect: null, zone: 'z_r_star_tower' }],
        light: SK.LIGHT_TOWER, dark: false, bgm: 'tower', bbg: 'tower',
        art: Object.assign({}, P.art, { painted: ['star_glow'] }),
        meta: { chestsInfo: true, floor: R.T('map.star_tower.star_tower_1.meta.floor'), sub: R.T('map.star_tower.star_tower_1.meta.sub') },
      });
    }

    // ================================================================ 頂
    {
      const P = SK.painted('star_tower_top');
      const O = [];
      O.push(K.stairs(19, 27, { map: 'star_tower_1', spawn: 'from_top' }, { id: 'star_tower_top_down', look: 'down' }), K.stairs(20, 27, { map: 'star_tower_1', spawn: 'from_top' }, { look: 'down' }));
      O.push(K.exam(19, 4, 'star_lectern'), K.exam(20, 4, 'star_lectern'));
      for (const [x, y] of [[10, 8], [29, 8], [8, 20], [31, 20]]) O.push(K.prop('star_fire', x, y, { cond: 'star_names_read' }));
      for (const [x, y] of [[14, 12], [25, 12], [19, 20]]) O.push(K.prop('star_glow', x, y));
      K.def('star_tower_top', {
        name: R.T('map.star_tower.star_tower_top.name'), kind: 'dungeon', region: 'r_star', location: 'startower', theme: 'lighthouse', propSet: 'star',
        legend: SK.INT(), rows: P.rows, outside: 'wall_stone', objects: O, npcs: [],
        spawns: { from1: { x: 19, y: 26, dir: 'n' }, lectern: { x: 19, y: 6, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'star_top_arrive' },
          { id: 'stareater', x: 8, y: 14, w: 24, h: 1, on: 'step', event: 'star_stareater', cond: '!star_stareater' },
        ],
        zones: [],
        light: SK.LIGHT_TOP, dark: false, bgm: 'tower', bbg: 'star',
        art: Object.assign({}, P.art, { painted: ['star_glow', 'star_fire'] }),
        meta: { chestsInfo: true, floor: R.T('map.star_tower.star_tower_top.meta.floor'), sub: R.T('map.star_tower.star_tower_top.meta.sub') },
      });
    }
  });
})(window.RPG);
