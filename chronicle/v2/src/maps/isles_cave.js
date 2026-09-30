// CONTENT（マレア諸島）: 潮鳴りの洞窟 2 階（WORLD_REDESIGN §4.5・§6.4・§6.5、STORY_BIBLE §7.5）。
//   1 階 isles_cave_1（48×40）: 入口（南、夜光虫の入り江から）→ 南の水路の渡り場 A → まん中の洞（潮の石）・西の洞・東の洞 →
//        北の水路の渡り場 B → 北の通路 → 上の砂の岩棚（2 階への上り口）。
//        潮の石を叩くと満ち引きが替わる（引き潮 = 東の洞へ行ける・北の渡り場 B は水の下／満ち潮 = B が歩ける・東の洞の口が水の下。2 通りの tilePatches）。
//        下絵は両方の渡り場が乾いた形。水の下の方は閉じた絵（isles_cave_1_closed、process.py が水路の水を写した物）。
//   2 階 isles_cave_2（44×36）: 上り口（南）→ 深い潮だまりを囲む大きな洞 → 北の洞の入口に深みの大ダコ（中ボス）→ 奥の砂の岩棚に光る貝がら。
//   泉は置かない（2 階の短いダンジョン。WORLD §6.2 の持ち主の決まり）。宝箱は見える所。隠し通路なし（A27）。
//   灯り: 夜光虫の青い光（glow_plankton、光だけ）を洞の水の上に。当たりは下絵に合わせた isles_painted_rows.js。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, IK = R.Isles.kit;

    // ================================================================ 1 階
    {
      const P = IK.painted('isles_cave_1');
      const O = [];
      O.push(K.stairs(23, 1, { map: 'isles_cave_2', spawn: 'up' }, { id: 'isles_cave_1_up', look: 'up' }));
      O.push(K.exam(20, 16, 'isles_tide_stone'));
      O.push(K.exam(21, 28, 'isles_cave_carving'));
      O.push(K.chest('isles_cave_1_c1', 5, 16, { pool: 'p_T' }), K.chest('isles_cave_1_c2', 43, 20, { item: 'i_ether', n: 2 }), K.chest('isles_cave_1_c3', 36, 23, { gold: 180 }));
      O.push(K.exam(12, 13, 'isles_shell', { shell: 6 }), K.exam(41, 23, 'isles_shell', { shell: 7 }), K.exam(24, 27, 'isles_shell', { shell: 8 }));
      for (const [x, y] of [[27, 19], [40, 18], [15, 25], [32, 26], [17, 10], [30, 10], [20, 36]]) O.push(K.prop('glow_plankton', x, y));
      K.def('isles_cave_1', {
        name: R.T('map.isles_cave.isles_cave_1.name'), kind: 'dungeon', region: 'r_isles', location: 'tidecave', theme: 'cave',
        legend: IK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: [],
        spawns: { entrance: { x: 24, y: 37, dir: 'n' }, from2: { x: 23, y: 3, dir: 's' } },
        exits: [{ x: 22, y: 39, w: 4, h: 1, to: { map: 'i_cove', spawn: 'cave' } }],
        triggers: [{ id: 'arrive', on: 'enter', event: 'isles_cave_arrive', once: true }],
        // 潮: 引き潮（旗なし）= 北の渡り場 B が水の下、満ち潮（isles_tide_high）= 東の洞への口が水の下（南の渡り場 A はいつも乾いている）
        tilePatches: [
          { cond: '!isles_tide_high', rect: [22, 10, 4, 2], rows: ['wwww', 'wwww'] },
          { cond: 'isles_tide_high', rect: [30, 17, 2, 4], rows: ['ww', 'ww', 'ww', 'ww'] },
        ],
        zones: [{ rect: null, zone: 'z_r_isles_cave' }],
        light: IK.LIGHT_CAVE, dark: false, bgm: 'cave', bbg: 'cave',
        art: Object.assign({}, P.art, { painted: ['glow_plankton'] }),
        meta: { chestsInfo: true, floor: R.T('map.isles_cave.isles_cave_1.meta.floor'), sub: R.T('map.isles_cave.isles_cave_1.meta.sub') },
      });
    }

    // ================================================================ 2 階
    {
      const P = IK.painted('isles_cave_2');
      const O = [];
      O.push(K.stairs(22, 34, { map: 'isles_cave_1', spawn: 'from2' }, { id: 'isles_cave_2_down', look: 'down' }));
      O.push(K.exam(22, 2, 'isles_glow_shell'), K.prop('glow_plankton', 22, 2, { cond: '!isles_shell' }));
      O.push(K.chest('isles_cave_2_c1', 36, 26, { pool: 'p_T' }), K.chest('isles_cave_2_c2', 10, 15, { pool: 'p_T' }));
      O.push(K.exam(37, 24, 'isles_shell', { shell: 9 }), K.exam(13, 14, 'isles_shell', { shell: 10 }), K.exam(19, 3, 'isles_shell', { shell: 11 }), K.exam(29, 7, 'isles_shell', { shell: 12 }));
      for (const [x, y] of [[22, 18], [16, 20], [28, 16], [26, 22], [18, 14]]) O.push(K.prop('glow_plankton', x, y));
      K.def('isles_cave_2', {
        name: R.T('map.isles_cave.isles_cave_2.name'), kind: 'dungeon', region: 'r_isles', location: 'tidecave', theme: 'cave',
        legend: IK.CAVE(), rows: P.rows, outside: 'wall_cave', objects: O, npcs: [],
        spawns: { up: { x: 22, y: 32, dir: 'n' }, shelf: { x: 22, y: 4, dir: 's' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'isles_cave2_arrive', once: true },
          { id: 'octopus', x: 14, y: 10, w: 18, h: 1, on: 'step', event: 'isles_octopus', cond: '!isles_octopus' },
        ],
        zones: [{ rect: null, zone: 'z_r_isles_cave' }],
        light: IK.LIGHT_CAVE, dark: false, bgm: 'cave', bbg: 'cave',
        art: Object.assign({}, P.art, { painted: ['glow_plankton'] }),
        meta: { chestsInfo: true, floor: R.T('map.isles_cave.isles_cave_2.meta.floor'), sub: R.T('map.isles_cave.isles_cave_2.meta.sub') },
      });
    }
  });
})(window.RPG);
