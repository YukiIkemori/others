// 白の大書庫 4〜6階 (archive_4..6): the last dungeon's upper floors (DESIGN §10.10.3–§10.10.4). Owner: story (A19).
// Theme `library`, BGM `lastdungeon`, zone z_finale_archive_hi (4〜6階; 6階 is the boss floor, no lvOff),
// chestTier 8, location 'archive', escape → world archive_1.
//
// archive_4 伝説の間 (40×32) — the gallery of the eastern continent's legend: the long painted corridor, the west
//   hall of statues, the Hall of Legends with 伝説の三つの影 (tr_b_heroshades) at the mouth of the stair alcove
//   (archive_4_boss → final_shades). A cracked wall in the corridor hides the exhibit closet: a 語り部の書き付け and a
//   p_supply chest (secret passage, §10.6.4). Four paintings tell the legend (examine).
// archive_5 院長の書斎 (36×30) — the antechamber with the 休息の灯 (§10.6.2-5), then the study: shelves, the great
//   desk, the portrait of ミラ. 大書記ラザロ (archive_5_lazaro → final_lazaro). The stairs up are sealed by white
//   paper until he has fallen (tilePatch).
// archive_6 虚ろの間 (30×26, boss floor) — the antechamber with the 休息の灯, then the round hall of whirling paper
//   and the altar with 始まりの年代記. 虚ろの王 → the name is written → ネムレア (archive_6_boss, §10.10.4).
(function (R) {
  'use strict';
  const K = R.Final;
  const base = (name, zone, o) => Object.assign({
    name, type: 'dungeon', theme: 'library', bgm: 'lastdungeon', bbg: 'library',
    location: 'archive', region: 'finale', escape: K.ESC, chestTier: 8, outside: '#',
  }, zone ? { encounter: zone } : {}, o || {});

  // ============================================================ 4F 伝説の間
  {
    const g = K.grid(40, 32, '#');
    K.fill(g, 6, 27, 32, 4, '.'); // the painted corridor
    K.fill(g, 2, 4, 8, 27, '.'); // the west hall of statues
    K.fill(g, 10, 7, 28, 8, '.'); // the Hall of Legends
    K.fill(g, 21, 3, 5, 4, '.'); // the stair alcove
    K.put(g, 23, 3, 'S');
    K.put(g, 37, 29, 's');
    K.fill(g, 12, 17, 17, 7, '.'); // the exhibit room (a dead end with a chest)
    K.fill(g, 19, 15, 3, 2, '.');
    K.fill(g, 31, 17, 6, 8, '.'); // the closet behind the cracked wall
    K.put(g, 33, 25, '%'); K.put(g, 33, 26, '%');
    K.fill(g, 20, 8, 7, 7, '+'); // the carpet to the alcove
    K.fill(g, 22, 4, 3, 3, '+');
    // statues of the west hall, pillars of the Hall of Legends, pedestals of the exhibit room
    for (const y of [6, 11, 16, 21]) { K.put(g, 3, y, 'Y'); K.put(g, 8, y + 2, 'Y'); }
    for (const x of [12, 16, 30, 34]) { K.put(g, x, 8, 'l'); K.put(g, x, 13, 'l'); }
    K.put(g, 14, 19, 'C'); K.put(g, 18, 19, 'C'); K.put(g, 22, 19, 'C'); K.put(g, 26, 19, 'C');
    K.put(g, 15, 22, 'kk'); K.put(g, 24, 22, 'kk');
    K.put(g, 32, 18, 'k'); K.put(g, 35, 18, 'k');

    // the paintings of the legend along the corridor and the hall, the crests of light
    K.deco(g, 6, 26, '..p..c..p..W..p..c..p....c.....');
    K.deco(g, 10, 6, '..W..c..p..');
    K.deco(g, 26, 6, '..p..c..W..');
    K.deco(g, 2, 3, '.i..W..i');
    K.deco(g, 21, 2, '.c.c.');
    K.deco(g, 12, 16, '.p...c...W...c...p');
    K.deco(g, 31, 16, '.W..c.');
    K.deco(g, 12, 18, 'Q');
    K.deco(g, 28, 18, 'Q');
    K.deco(g, 21, 4, 'Q...Q');
    K.deco(g, 5, 13, '=');
    K.deco(g, 14, 29, '=');
    K.deco(g, 28, 28, '{');
    K.deco(g, 33, 11, '=');
    K.deco(g, 34, 22, '{');

    R.DB.maps.archive_4 = K.check('archive_4', base('白の大書庫　4階', K.ZONE_HI, {
      lvOff: 2,
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        from_prev: { x: 36, y: 29, dir: 'left' },
        from_next: { x: 22, y: 3, dir: 'down' },
      },
      warps: [
        K.warp(37, 29, 'archive_3', 'from_next'),
        K.warp(23, 3, 'archive_5', 'from_prev'),
      ],
      npcs: [
        K.npc('boss', 'mon:boss_shade_sword', 23, 6, { event: 'archive_4_boss', cond: '!final_shades', fixed: true }),
        K.npc('boss2', 'mon:boss_shade_prayer', 21, 6, { event: 'archive_4_boss', cond: '!final_shades', fixed: true }),
        K.npc('boss3', 'mon:boss_shade_star', 25, 6, { event: 'archive_4_boss', cond: '!final_shades', fixed: true }),
      ],
      chests: [
        K.chest('archive_4_c1', 36, 23, 'p_supply'),
        K.chest('archive_4_c2', 20, 22, 'p_gear'),
        K.chest('archive_4_c3', 2, 4, 'p_gold'),
        K.chest('archive_4_c4', 37, 8, 'p_supply'),
      ],
      signs: [
        K.sign(33, 18, ['古い紙切れが落ちている。\n語り部の書き付けらしい。',
          '「東の大陸の伝説を、\nわたしは語り継げなかった。\n勇者たちの名を、知らないから。」',
          '「けれど名が消えても、\n物語は残る。だれかが\n語ってくれる限り。」\f――名もなき語り部']),
      ],
      events: [
        ...K.band('archive_4_boss', 21, 7, 25, 7, { cond: '!final_shades' }),
        K.exam('archive_4_painting', 8, 26),
        K.exam('archive_4_painting', 14, 26),
        K.exam('archive_4_painting', 20, 26),
        K.exam('archive_4_painting', 26, 26),
      ],
    }));
  }

  // ============================================================ 5F 院長の書斎
  {
    const g = K.grid(36, 30, '#');
    K.fill(g, 11, 21, 15, 7, '.'); // the antechamber
    K.fill(g, 16, 17, 5, 4, '.'); // the passage
    K.fill(g, 4, 3, 28, 14, '.'); // the study
    K.put(g, 18, 28, 's');
    K.fill(g, 16, 28, 5, 1, '.'); K.put(g, 18, 28, 's');
    K.put(g, 29, 2, 'S'); // the stairs up, set into the north wall (as on 2F/3F): 29,3 is the only way in
    K.fill(g, 17, 6, 3, 11, '+');
    K.fill(g, 16, 9, 5, 5, '+');
    // shelves along the walls, reading tables, the desk
    K.fill(g, 4, 3, 1, 12, 'k'); K.fill(g, 31, 5, 1, 10, 'k');
    K.put(g, 5, 3, 'kkkkkk'); K.put(g, 22, 3, 'kkkkk');
    K.put(g, 7, 6, ['kk', '', 'kk', '', 'kk']);
    K.put(g, 27, 7, ['kk', '', 'kk', '', 'kk']);
    K.put(g, 8, 13, ['tt', 'hh']);
    K.put(g, 26, 14, ['tt']);
    K.put(g, 17, 5, 'hhh');
    for (const [x, y] of [[12, 22], [23, 22], [12, 26], [23, 26]]) K.put(g, x, y, 'l');

    K.deco(g, 4, 2, '.}..W..}..i.P.i..}..W..}..}.');
    K.deco(g, 17, 4, 'DDD');
    K.deco(g, 11, 20, '.....i...i.....');
    K.deco(g, 15, 5, 'Q');
    K.deco(g, 21, 5, 'Q');
    K.deco(g, 10, 9, '{');
    K.deco(g, 24, 12, '=');
    K.deco(g, 6, 15, '=');
    K.deco(g, 28, 4, '.');
    K.deco(g, 26, 15, 'I');
    K.deco(g, 13, 24, '=');
    K.deco(g, 22, 25, '{');
    K.deco(g, 9, 10, 'v');

    R.DB.maps.archive_5 = K.check('archive_5', base('白の大書庫　5階', K.ZONE_HI, {
      lvOff: 2,
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        from_prev: { x: 18, y: 27, dir: 'up' },
        from_next: { x: 28, y: 3, dir: 'down' }, // beside the seal's cell (a spawn must stand on floor whatever the flags)
      },
      warps: [
        K.warp(18, 28, 'archive_4', 'from_next'),
        K.warp(29, 2, 'archive_6', 'from_prev', { cond: 'final_lazaro' }),
      ],
      // the white paper that seals the foot of the stairs until ラザロ has fallen (the warp's own tile
      // stays walkable stairs; the seal in front of it is the only way up)
      tilePatches: [{ cond: '!final_lazaro', x: 29, y: 3, ch: '3' }],
      npcs: [
        K.npc('rest', 'obj:lantern', 13, 23, { event: 'common_rest', fixed: true }),
        K.npc('lazaro', 'lazaro', 18, 7, { event: 'archive_5_lazaro', cond: '!final_lazaro', dir: 'down', fixed: true }),
      ],
      chests: [
        K.chest('archive_5_c1', 5, 16, 'p_rare'),
        K.chest('archive_5_c2', 30, 16, 'p_supply'),
        K.chest('archive_5_c3', 25, 27, 'p_gold'),
      ],
      signs: [],
      events: [
        ...K.band('archive_5_lazaro', 16, 16, 20, 16, { once: 'final_lazaro', cond: '!final_lazaro' }),
        K.exam('archive_5_portrait', 17, 2),
        K.exam('archive_5_seal', 29, 3, { cond: '!final_lazaro' }),
      ],
    }));
  }

  // ============================================================ 6F 虚ろの間
  {
    const g = K.grid(30, 26, '#');
    K.fill(g, 10, 19, 11, 5, '.'); // the antechamber
    K.fill(g, 13, 16, 5, 3, '.');
    // the round hall
    K.fill(g, 5, 3, 20, 13, '.');
    K.fill(g, 3, 5, 24, 9, '.');
    K.fill(g, 4, 4, 22, 11, '.');
    K.put(g, 15, 24, 's');
    K.fill(g, 13, 4, 5, 3, '+');
    K.put(g, 15, 4, 'a');
    for (const [x, y] of [[6, 5], [24, 5], [4, 9], [26, 9], [6, 13], [24, 13]]) K.put(g, x, y, 'l');

    K.deco(g, 5, 2, '..........c.........');
    K.deco(g, 10, 18, '....Q.Q....');
    K.deco(g, 7, 4, '=...=.......=...=.');
    K.deco(g, 5, 8, '=.........................');
    K.deco(g, 9, 11, '=...........=');
    K.deco(g, 20, 7, '=');
    K.deco(g, 11, 14, '=.......=');
    K.deco(g, 13, 5, 'Q...Q');
    K.deco(g, 11, 21, '=');
    K.deco(g, 19, 22, '=');

    // theme `library` like every floor of the archive (§10.10.3, §11.2.11): the white paper drifts over the floor
    // (decor `=`) around the altar; `oblivion` is kept for 忘却の底 below (§10.12)
    R.DB.maps.archive_6 = K.check('archive_6', base('白の大書庫　虚ろの間', K.ZONE_HI, {
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        from_prev: { x: 15, y: 23, dir: 'up' },
        altar: { x: 15, y: 7, dir: 'up' },
      },
      warps: [
        K.warp(15, 24, 'archive_5', 'from_next'),
      ],
      npcs: [
        K.npc('rest', 'obj:lantern', 11, 20, { event: 'common_rest', fixed: true }),
        // the formless king (it takes its true shape, mon:boss_nemrea2, only in the scene where its name is written)
        K.npc('boss', 'mon:boss_nemrea1', 15, 9, { event: 'archive_6_boss', cond: '!game_clear', fixed: true }),
        K.npc('lazaro', 'lazaro', 12, 6, { cond: ['final_nemrea1', '!game_clear'], dir: 'down', fixed: true,
          text: 'ラザロは、気を失っている……。' }),
        K.talk('chronicle', 'obj:sparkle', 15, 4, '祭壇の上に、古い本が\n開かれている。\f始まりの年代記だ。', { fixed: true }),
      ],
      chests: [],
      signs: [],
      events: [
        ...K.band('archive_6_boss', 3, 12, 26, 12, { cond: '!game_clear' }),
      ],
    }));
  }
})(window.RPG);
