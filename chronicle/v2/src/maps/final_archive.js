// CONTENT（終盤）: 白の大書庫 1〜6 階（STORY_BIBLE §9.3 の 3、WORLD_REDESIGN §6.4「白の大書庫 6 階」）。上へ上っていくダンジョン。
//   1 階 閲覧の間（44×36）: 大扉（南）→ 入口の広間（西の小部屋に泉。東の小部屋にクリア後の忘却の底への階段＝白い手すりの向こう）→
//        閲覧の広間（白い書架の列。西の読書机に東の大陸の封書）→ 北の壇の上り階段（壇の手すりの切れ目から）。
//   2 階 写本の間（44×36）: 南西の長い下り階段 → 南の写本室 → 東の口 → 中の写本室（泉なし）→ 西の口 → 北の写本室 → 北東の上り階段（本の巨人）。
//   3 階 記憶の回廊（44×36）: 南西の下り階段 → 輪の回廊（外側に 8 つの小部屋: 八つの伝承の書見台）→ 南の休み所（泉）→ 北の封印の扉（ロウェル）→ 上り階段。
//   4 階 伝説の間（44×36）: 南東の下り階段 → 絵の回廊（紋章の大陸の伝説の 4 枚）→ 西の像の間（泉）→ 伝説の間（赤い敷物）→ 三つの影 → 上り階段。
//   5 階 白紙の写字室（40×34）: 南の下り階段 → 控えの間（泉）→ 写字室（大書記ラザロの机）→ 白い紙に包まれた上り階段（ラザロの後に開く）。
//   6 階 虚ろの間（36×32）: 南の下り階段 → 控えの間（泉）→ 丸い広間 → 北の祭壇（始まりの年代記）で虚ろの王。
//   当たりは描いた絵に合わせた final_painted_rows.js（R.Final.PAINTED）。泉は 1・3・4・5・6 階（6 階と 5 階はボスの前）。宝箱は見える所。隠し通路なし（A27）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, FK = R.Final.kit;
    const base = (id, o) => Object.assign({
      name: R.T('map.final_archive.base.name'), kind: 'dungeon', region: 'finale', location: 'archive', theme: 'lighthouse', propSet: 'star',
      legend: FK.INT(), outside: 'wall_stone', npcs: [], dark: false, bgm: 'lastdungeon', bbg: 'library',
    }, o);
    const floor = (n) => R.T('map.final_archive.floor', { n });
    const def = (id, o) => {
      const P = FK.painted(id);
      K.def(id, Object.assign(base(id, o), { rows: P.rows, art: Object.assign({}, P.art, { painted: o.painted || [] }) }));
    };
    const glow = (pts) => pts.map(([x, y]) => K.prop('page_glow', x, y));

    // ================================================================ 1 階 閲覧の間
    def('archive_1', {
      objects: [
        K.stairs(21, 2, { map: 'archive_2', spawn: 'from1' }, { id: 'archive_1_up', look: 'up' }), K.stairs(22, 2, { map: 'archive_2', spawn: 'from1' }, { look: 'up' }),
        K.spring('archive_1_spring', 8, 28),
        K.exam(7, 20, 'archive_east_letter'),
        K.exam(33, 29, 'archive_oblivion'), K.exam(32, 29, 'archive_oblivion'), K.exam(34, 29, 'archive_oblivion'),
        K.chest('archive_1_c1', 5, 4, { pool: 'p_T' }), K.chest('archive_1_c2', 38, 19, { item: 'i_elixir', n: 1 }), K.chest('archive_1_c3', 11, 30, { pool: 'p_T' }),
        K.prop('candelabra', 16, 24), K.prop('candelabra', 27, 24),
        ...glow([[10, 15], [33, 15], [21, 9], [9, 4], [34, 4], [35, 27]]),
      ],
      painted: ['stairs_up'],
      spawns: { entrance: { x: 21, y: 32, dir: 'n' }, from2: { x: 21, y: 3, dir: 's' } },
      exits: [{ x: 21, y: 34, w: 2, h: 1, to: { map: 'biblia', spawn: 'archive' } }],
      triggers: [{ id: 'enter', on: 'enter', event: 'archive_1_enter' }],
      zones: [{ rect: null, zone: 'z_finale_archive_lo' }],
      light: FK.LIGHT_ARCHIVE,
      meta: { chestsInfo: true, floor: floor(1), sub: R.T('map.final_archive.archive_1.meta.sub') },
    });

    // ================================================================ 2 階 写本の間（本の巨人）
    def('archive_2', {
      objects: [
        K.stairs(5, 26, { map: 'archive_1', spawn: 'from2' }, { id: 'archive_2_down', look: 'down' }), K.stairs(6, 26, { map: 'archive_1', spawn: 'from2' }, { look: 'down' }),
        K.stairs(37, 2, { map: 'archive_3', spawn: 'from2' }, { id: 'archive_2_up', look: 'up', cond: 'final_golem' }), K.stairs(38, 2, { map: 'archive_3', spawn: 'from2' }, { look: 'up', cond: 'final_golem' }),   // 番人を倒すまで上がれない（手前の段で戦いになる）
        K.chest('archive_2_c1', 39, 23, { pool: 'p_T' }), K.chest('archive_2_c2', 4, 13, { item: 'i_potion2', n: 3 }), K.chest('archive_2_c3', 22, 3, { pool: 'p_T' }),
        K.exam(15, 17, 'archive_copy_desk'), K.exam(28, 25, 'archive_copy_desk'),
        ...glow([[8, 6], [35, 6], [8, 16], [36, 16], [10, 29], [35, 29]]),
      ],
      painted: ['stairs_down'],
      spawns: { from1: { x: 6, y: 23, dir: 'n' }, from3: { x: 37, y: 3, dir: 's' } },
      exits: [],
      triggers: [
        { id: 'golem', x: 33, y: 3, w: 7, h: 1, on: 'step', event: 'archive_2_boss', cond: '!final_golem' },
        { id: 'golem2', x: 36, y: 4, w: 4, h: 1, on: 'step', event: 'archive_2_boss', cond: '!final_golem' },
      ],
      zones: [{ rect: null, zone: 'z_finale_archive_lo' }],
      light: FK.LIGHT_ARCHIVE,
      meta: { chestsInfo: true, floor: floor(2), sub: R.T('map.final_archive.archive_2.meta.sub') },
    });

    // ================================================================ 3 階 記憶の回廊（封印の扉とロウェル）
    const TALES = [[4, 9, 'r_forest'], [4, 14, 'r_desert'], [4, 20, 'r_snow'], [4, 25, 'r_marsh'], [39, 9, 'r_isles'], [39, 14, 'r_mine'], [39, 20, 'r_ash'], [39, 25, 'r_star']];
    def('archive_3', {
      objects: [
        K.stairs(9, 31, { map: 'archive_2', spawn: 'from3' }, { id: 'archive_3_down', look: 'down' }),
        K.stairs(21, 2, { map: 'archive_4', spawn: 'from3' }, { id: 'archive_3_up', look: 'up', cond: 'final_rowell' }), K.stairs(22, 2, { map: 'archive_4', spawn: 'from3' }, { look: 'up', cond: 'final_rowell' }),   // 封印の扉が開くまで上がれない
        K.exam(21, 5, 'archive_3_door', { cond: '!final_rowell' }), K.exam(22, 5, 'archive_3_door', { cond: '!final_rowell' }),
        ...TALES.map(([x, y, rid]) => K.exam(x, y, 'archive_tale', { region: rid })),
        K.spring('archive_3_spring', 21, 30),
        K.chest('archive_3_c1', 25, 31, { pool: 'p_T' }), K.chest('archive_3_c2', 6, 26, { item: 'i_ether2', n: 2 }),
        ...glow([[5, 9], [5, 14], [5, 20], [5, 25], [38, 9], [38, 14], [38, 20], [38, 25], [21, 7]]),
      ],
      npcs: [
        K.npc('seal_rowell', 'rowell', 20, 7, { name: R.T('map.final_archive.archive_3.npcs.0.seal_rowell.name'), dir: 'n', talk: [K.L('……。')], reward: null, pushable: false, cond: 'final_seal_scene' }),
        K.npc('seal_scribe_a', 'npc_scribe', 18, 9, { name: R.T('map.final_archive.archive_3.npcs.1.seal_scribe_a.name'), dir: 'n', talk: [K.L('……。')], reward: null, cond: 'final_seal_scene' }),
        K.npc('seal_scribe_b', 'npc_scribe', 23, 9, { name: R.T('map.final_archive.archive_3.npcs.2.seal_scribe_b.name'), dir: 'n', talk: [K.L('……。')], reward: null, cond: 'final_seal_scene' }),
        K.npc('seal_scribe_c', 'npc_scribe', 25, 9, { name: R.T('map.final_archive.archive_3.npcs.3.seal_scribe_c.name'), dir: 'n', talk: [K.L('……。')], reward: null, cond: 'final_seal_scene' }),
      ],
      painted: ['stairs_up', 'stairs_down'],
      tilePatches: [{ cond: '!final_rowell', rect: [21, 5, 2, 1], rows: ['XX'] }],
      spawns: { from2: { x: 9, y: 29, dir: 'n' }, from4: { x: 21, y: 3, dir: 's' } },
      exits: [],
      triggers: [{ id: 'rowell', x: 17, y: 6, w: 10, h: 1, on: 'step', event: 'archive_3_rowell', cond: '!final_rowell' }],
      zones: [{ rect: null, zone: 'z_finale_archive_lo' }],
      light: FK.LIGHT_ARCHIVE,
      meta: { chestsInfo: true, floor: floor(3), sub: R.T('map.final_archive.archive_3.meta.sub') },
    });

    // ================================================================ 4 階 伝説の間（伝説の三つの影）
    const PICS = [[14, 27, 1], [20, 27, 2], [27, 27, 3], [34, 27, 4]];
    def('archive_4', {
      objects: [
        K.stairs(38, 31, { map: 'archive_3', spawn: 'from4' }, { id: 'archive_4_down', look: 'down' }), K.stairs(39, 31, { map: 'archive_3', spawn: 'from4' }, { look: 'down' }),
        K.stairs(21, 2, { map: 'archive_5', spawn: 'from4' }, { id: 'archive_4_up', look: 'up', cond: 'final_shades' }), K.stairs(22, 2, { map: 'archive_5', spawn: 'from4' }, { look: 'up', cond: 'final_shades' }),   // 三英雄の影を越えるまで上がれない
        ...PICS.map(([x, y, n]) => K.exam(x, y, 'archive_4_painting', { pic: n })),
        // 女神の像は描いた部屋（左の壁〜大きな壁の塊）と頭巾の像 2 体のまん中に絵を置く（dx: -0.5。当たりは 7〜8 のまま。持ち主 2026-10-03）
        Object.assign(K.spring('archive_4_spring', 7, 24), { dx: -0.5 }),
        K.exam(5, 9, 'archive_4_statue'), K.exam(9, 14, 'archive_4_statue'),
        K.chest('archive_4_c1', 37, 8, { pool: 'p_T' }), K.chest('archive_4_c2', 4, 30, { item: 'i_elixir', n: 1 }), K.chest('archive_4_c3', 13, 8, { pool: 'p_T' }),
        ...glow([[7, 11], [7, 16], [30, 12], [16, 29], [30, 29]]),
      ],
      painted: ['stairs_up', 'stairs_down'],
      spawns: { from3: { x: 37, y: 30, dir: 'w' }, from5: { x: 21, y: 3, dir: 's' } },
      exits: [],
      triggers: [{ id: 'shades', x: 19, y: 7, w: 6, h: 1, on: 'step', event: 'archive_4_boss', cond: '!final_shades' }],
      zones: [{ rect: null, zone: 'z_finale_archive_hi' }],
      light: FK.LIGHT_ARCHIVE,
      meta: { chestsInfo: true, floor: floor(4), sub: R.T('map.final_archive.archive_4.meta.sub') },
    });

    // ================================================================ 5 階 白紙の写字室（大書記ラザロ）
    def('archive_5', {
      objects: [
        K.stairs(19, 31, { map: 'archive_4', spawn: 'from5' }, { id: 'archive_5_down', look: 'down' }), K.stairs(20, 31, { map: 'archive_4', spawn: 'from5' }, { look: 'down' }),
        K.stairs(19, 2, { map: 'archive_6', spawn: 'from5' }, { id: 'archive_5_up', look: 'up', cond: 'final_lazaro' }), K.stairs(20, 2, { map: 'archive_6', spawn: 'from5' }, { look: 'up', cond: 'final_lazaro' }),
        K.exam(19, 4, 'archive_5_seal', { cond: '!final_lazaro' }), K.exam(20, 4, 'archive_5_seal', { cond: '!final_lazaro' }),
        K.exam(18, 6, 'archive_5_desk'), K.exam(21, 6, 'archive_5_desk'),
        // 女神の像は部屋の軸（階段・敷物・燭台のまん中 20）に置く（21 では 2 マス東に寄っていた。持ち主 2026-10-03）
        K.spring('archive_5_spring', 19, 26),
        K.chest('archive_5_c1', 5, 20, { pool: 'p_T' }), K.chest('archive_5_c2', 34, 20, { item: 'i_ether2', n: 2 }),
        K.prop('candelabra', 17, 6), K.prop('candelabra', 22, 6),
        ...glow([[9, 10], [30, 10]]),   // 像の前の白紙の光（19, 24）は像を軸へ移した時に外した（像の頭の横に光がずれて見える）
      ],
      npcs: [K.npc('lazaro', 'lazaro', 19, 8, { name: R.T('map.final_archive.archive_5.npcs.0.lazaro.name'), title: R.T('map.final_archive.archive_5.npcs.0.lazaro.title'), dir: 's', talk: 'archive_5_lazaro', reward: null, pushable: false, cond: '!final_lazaro' })],
      painted: ['stairs_up', 'stairs_down'],
      tilePatches: [{ cond: '!final_lazaro', rect: [19, 4, 2, 1], rows: ['XX'] }],
      spawns: { from4: { x: 19, y: 29, dir: 'n' }, from6: { x: 19, y: 5, dir: 's' } },
      exits: [],
      triggers: [{ id: 'lazaro', x: 16, y: 12, w: 8, h: 1, on: 'step', event: 'archive_5_lazaro', cond: '!final_lazaro' }],
      zones: [{ rect: null, zone: 'z_finale_archive_hi' }],
      light: FK.LIGHT_ARCHIVE, bgm: 'tension',
      meta: { chestsInfo: true, floor: floor(5), sub: R.T('map.final_archive.archive_5.meta.sub') },
    });

    // ================================================================ 6 階 虚ろの間（虚ろの王 → ネムレア）
    def('archive_6', {
      objects: [
        K.stairs(17, 29, { map: 'archive_5', spawn: 'from6' }, { id: 'archive_6_down', look: 'down' }), K.stairs(18, 29, { map: 'archive_5', spawn: 'from6' }, { look: 'down' }),
        K.exam(17, 3, 'archive_6_altar'), K.exam(18, 3, 'archive_6_altar'),
        K.spring('archive_6_spring', 15, 25),
        K.prop('altar_glow', 17, 4),
        ...glow([[9, 10], [26, 10], [12, 17], [23, 17], [17, 12]]),
      ],
      npcs: [K.npc('naming_fine', 'fine', 18, 14, { name: R.T('map.final_archive.archive_6.npcs.0.naming_fine.name'), dir: 'n', talk: [K.L('……。')], reward: null, pushable: false, cond: 'final_naming_scene' })],
      painted: ['stairs_down'],
      spawns: { from5: { x: 17, y: 27, dir: 'n' }, altar: { x: 17, y: 6, dir: 'n' }, e_altar: { x: 17, y: 7, dir: 'n' } },
      exits: [],
      triggers: [{ id: 'king', x: 11, y: 12, w: 14, h: 1, on: 'step', event: 'archive_6_boss', cond: '!final_clear' }],
      zones: [],
      light: FK.LIGHT_VOID, bgm: 'hollowking',
      meta: { chestsInfo: false, floor: floor(6), sub: R.T('map.final_archive.archive_6.meta.sub') },
    });
  });
})(window.RPG);
