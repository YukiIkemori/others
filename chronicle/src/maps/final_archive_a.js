// 白の大書庫 1〜3階 (archive_1..3): the last dungeon's lower floors (DESIGN §10.10.3, §10.6.2). Owner: story (A19).
// Theme / battle backdrop `library`, BGM `lastdungeon`, zone z_finale_archive_lo, chestTier 8, location 'archive',
// escape → world archive_1. Floors are climbed upward: stairs up 'S' → next floor's from_prev; stairs down 's' →
// the floor below's from_next (§10.0 の 0.7).
//
// archive_1 閲覧の間 (40×34) — the reading hall: stacks of shelves in two wings. The stair alcove at the top is
//   open only on its east side, so the way up runs through the east wing's serpentine; the west wing holds a
//   reading room and chests. After the ending a stair down appears in the entrance hall (→ oblivion_1, §10.12);
//   the way back up from 忘却の底 lands on spawn `from_oblivion`.
// archive_2 写本の間 (40×32) — three copying rooms joined by one doorway each (a zigzag); 本の巨人 (tr_b_bookgolem)
//   stands on the stairs up (archive_2_boss → final_golem). A cracked wall in the north room hides a closet with
//   the floor's p_rare chest (secret passage, §10.6.4).
// archive_3 記憶の回廊 (40×34) — a long gallery with eight alcoves: the echoes of the eight tales (signs). The
//   休息の灯 in the middle (§10.6.2-5). The sealed door (lockdoor, opens with k_rowell_note or after final_rowell)
//   in front of the stairs; ロウェル's scene archive_3_rowell on the band before it.
(function (R) {
  'use strict';
  const K = R.Final;
  const base = (name, zone, o) => Object.assign({
    name, type: 'dungeon', theme: 'library', bgm: 'lastdungeon', bbg: 'library', encounter: zone,
    location: 'archive', region: 'finale', escape: K.ESC, chestTier: 8, outside: '#',
  }, o || {});

  // ============================================================ 1F 閲覧の間
  {
    const g = K.grid(40, 34, '#');
    K.fill(g, 2, 2, 36, 21, '.'); // the great hall
    K.fill(g, 14, 24, 12, 8, '.'); // the entrance hall
    K.fill(g, 18, 23, 4, 1, '.');
    K.fill(g, 19, 32, 2, 2, '.'); // the way out
    // the stair alcove (open to the east only)
    K.fill(g, 15, 2, 1, 6, 'k'); K.fill(g, 24, 2, 1, 7, 'k'); K.fill(g, 15, 7, 10, 1, 'k');
    K.fill(g, 25, 8, 1, 1, 'k');
    K.put(g, 24, 3, '.');
    K.put(g, 19, 3, 'S');
    K.fill(g, 16, 5, 8, 2, '+');
    // the central reading room (entered from the west)
    K.fill(g, 14, 9, 12, 1, 'k'); K.fill(g, 14, 16, 12, 1, 'k'); K.fill(g, 14, 9, 1, 8, 'k'); K.fill(g, 25, 9, 1, 8, 'k');
    K.put(g, 14, 12, '.');
    K.put(g, 17, 11, 'tt'); K.put(g, 21, 11, 'tt');
    K.put(g, 17, 14, 'tt'); K.put(g, 21, 14, 'tt');
    K.put(g, 17, 10, 'hh'); K.put(g, 21, 10, 'hh');
    // the east wing: a serpentine up to the top aisle
    K.fill(g, 26, 10, 11, 1, 'k');
    K.fill(g, 27, 14, 11, 1, 'k');
    K.fill(g, 26, 18, 11, 1, 'k');
    // the west wing: shelves with gaps at alternate ends
    K.fill(g, 2, 11, 11, 1, 'k');
    K.fill(g, 3, 15, 11, 1, 'k');
    K.fill(g, 2, 19, 11, 1, 'k');
    K.fill(g, 5, 2, 1, 6, 'k'); K.fill(g, 2, 7, 3, 1, 'k'); // the reading nook in the north-west corner
    K.put(g, 5, 4, '.');
    K.put(g, 3, 3, 'tt');
    // stacks inside the wings (short shelves: cover, not walls)
    K.put(g, 8, 4, 'kkk'); K.put(g, 8, 8, 'kkk'); K.put(g, 30, 4, 'kkkk'); K.put(g, 30, 7, 'kkkk');
    K.put(g, 5, 13, 'kk'); K.put(g, 9, 17, 'kk'); K.put(g, 30, 12, 'kk'); K.put(g, 31, 16, 'kk');
    // pillars in the open floor, the entrance hall's columns
    for (const [x, y] of [[4, 21], [35, 21], [16, 20], [23, 20], [11, 21], [28, 21], [35, 3], [20, 13]]) K.put(g, x, y, 'l');
    for (const y of [25, 28]) { K.put(g, 16, y, 'l'); K.put(g, 23, y, 'l'); }
    K.put(g, 21, 30, 'm');

    K.deco(g, 2, 1, '...}...W...i...W...i...W...}...W...i..');
    K.deco(g, 14, 23, '....i....i..');
    K.deco(g, 17, 5, 'Q....Q');
    K.deco(g, 16, 12, 'D');
    K.deco(g, 23, 12, '>');
    K.deco(g, 7, 20, '{');
    K.deco(g, 33, 20, '=');
    K.deco(g, 26, 5, '=');
    K.deco(g, 10, 13, '=');
    K.deco(g, 32, 9, '{');
    K.deco(g, 2, 9, '>');
    K.deco(g, 36, 12, '=');
    K.deco(g, 17, 26, '=.....{');
    K.deco(g, 15, 31, 'Q');
    K.deco(g, 24, 31, 'Q');
    K.deco(g, 19, 29, 'r');
    K.deco(g, 20, 29, 'r');
    K.deco(g, 19, 30, 'r');
    K.deco(g, 20, 30, 'r');

    R.DB.maps.archive_1 = K.check('archive_1', base('白の大書庫　1階', K.ZONE_LO, {
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        entrance: { x: 19, y: 31, dir: 'up' },
        from_next: { x: 19, y: 4, dir: 'down' },
        from_oblivion: { x: 16, y: 26, dir: 'right' },
      },
      warps: [
        K.warp(19, 33, 'world', 'archive_1', { dir: 'down' }),
        K.warp(20, 33, 'world', 'archive_1', { dir: 'down' }),
        K.warp(19, 3, 'archive_2', 'from_prev'),
        K.warp(15, 26, 'oblivion_1', 'from_prev', { cond: { postgame: true } }),
      ],
      // after the ending: the stair down to 忘却の底 (§10.12)
      tilePatches: [{ cond: { postgame: true }, x: 15, y: 26, ch: 's' }],
      npcs: [],
      chests: [
        K.chest('archive_1_c1', 2, 3, 'p_gear'),
        K.chest('archive_1_c2', 24, 15, 'p_supply'),
        K.chest('archive_1_c3', 37, 15, 'p_gold'),
        K.chest('archive_1_c4', 2, 22, 'p_supply'),
      ],
      signs: [
        K.sign(21, 30, '白の大書庫\n「すべての書は、ここに納め、\nここで守られる」\f――記録院'),
      ],
      events: [
        K.step('archive_1_enter', 19, 30, { once: 'archive_1_enter' }),
        K.step('archive_1_enter', 20, 30, { once: 'archive_1_enter' }),
      ],
    }));
  }

  // ============================================================ 2F 写本の間
  {
    const g = K.grid(40, 32, '#');
    // three rooms: south (entry), middle, north (the golem)
    K.fill(g, 2, 22, 36, 8, '.');
    K.fill(g, 2, 12, 36, 8, '.');
    K.fill(g, 7, 2, 31, 8, '.');
    K.fill(g, 30, 20, 2, 2, '.'); // south → middle
    K.fill(g, 7, 10, 2, 2, '.'); // middle → north
    // the closet behind the cracked wall (secret passage → the p_rare chest)
    K.fill(g, 2, 2, 3, 3, '.');
    K.put(g, 5, 3, '%%');
    // stairs
    K.put(g, 3, 29, 's');
    K.put(g, 36, 2, 'S');
    // copying desks in rows (table + chair), leaving two-wide aisles
    for (const x of [8, 13, 18, 23]) { K.put(g, x, 24, ['tt', 'hh']); K.put(g, x, 27, ['tt', 'hh']); }
    for (const x of [4, 9, 14, 19, 24]) { K.put(g, x, 14, ['tt', 'hh']); K.put(g, x, 17, ['tt', 'hh']); }
    K.put(g, 34, 13, ['kkk', '', 'kkk']);
    K.put(g, 34, 17, 'kkk');
    // the north room: the great copy table, shelves, pillars
    K.put(g, 14, 4, ['tttttt', 'hhhhhh']);
    K.put(g, 14, 3, 'hhhhhh');
    K.put(g, 24, 3, ['kk', 'kk', 'kk']);
    K.put(g, 34, 6, 'kkkk'); // the golem's corner: the stairs are reached only past it
    for (const [x, y] of [[11, 3], [11, 8], [28, 3], [28, 8], [33, 8]]) K.put(g, x, y, 'l');

    K.deco(g, 2, 21, '..}..W...i....}....i....W....i..}..');
    K.deco(g, 2, 11, '.....i....}..W....i....}....W...i..');
    K.deco(g, 7, 1, '...W....}....i....W....i...}...');
    K.deco(g, 2, 1, '...');
    K.deco(g, 36, 3, '.');
    K.deco(g, 29, 23, '=');
    K.deco(g, 5, 26, '{');
    K.deco(g, 20, 29, '=');
    K.deco(g, 35, 28, '{');
    K.deco(g, 30, 15, '=');
    K.deco(g, 2, 13, '>');
    K.deco(g, 21, 7, '=');
    K.deco(g, 32, 5, '{{');
    K.deco(g, 9, 6, '=');
    K.deco(g, 27, 6, '>');
    K.deco(g, 8, 8, '{'); K.deco(g, 22, 8, '{'); K.deco(g, 30, 2, 'Q'); K.deco(g, 36, 7, '{{');

    R.DB.maps.archive_2 = K.check('archive_2', base('白の大書庫　2階', K.ZONE_LO, {
      lvOff: 2,
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        from_prev: { x: 4, y: 29, dir: 'right' },
        from_next: { x: 35, y: 2, dir: 'left' },
      },
      warps: [
        K.warp(3, 29, 'archive_1', 'from_next'),
        K.warp(36, 2, 'archive_3', 'from_prev'),
      ],
      npcs: [
        K.npc('boss', 'mon:boss_bookgolem', 35, 3, { event: 'archive_2_boss', cond: '!final_golem', fixed: true }),
      ],
      chests: [
        K.chest('archive_2_c1', 3, 3, 'p_rare'),
        K.chest('archive_2_c2', 37, 29, 'p_supply'),
        K.chest('archive_2_c3', 37, 12, 'p_gear'),
      ],
      signs: [],
      events: [
        ...K.band('archive_2_boss', 32, 2, 33, 5, { cond: '!final_golem' }),
      ],
    }));
  }

  // ============================================================ 3F 記憶の回廊
  {
    const g = K.grid(40, 34, '#');
    K.fill(g, 17, 8, 6, 24, '.'); // the gallery
    K.fill(g, 14, 30, 12, 2, '.'); // the landing
    K.fill(g, 12, 5, 16, 3, '.'); // the hall before the sealed door
    K.fill(g, 17, 1, 6, 3, '.'); // the stair room behind it
    K.put(g, 19, 4, 'E'); // the sealed door
    K.put(g, 20, 4, '#');
    K.put(g, 20, 2, 'S');
    // eight alcoves, four a side, each with a pedestal (the echo)
    const ALC = [10, 15, 20, 25];
    for (const y of ALC) {
      K.fill(g, 11, y, 6, 3, '.'); K.put(g, 11, y + 1, 'C');
      K.fill(g, 23, y, 6, 3, '.'); K.put(g, 28, y + 1, 'C');
    }
    // side aisles: the outer walks reached from the landing and the hall (chests, the wanderers' way)
    K.fill(g, 3, 5, 3, 27, '.'); K.fill(g, 34, 5, 3, 27, '.');
    K.fill(g, 3, 30, 11, 2, '.'); K.fill(g, 26, 30, 11, 2, '.');
    K.fill(g, 3, 5, 9, 2, '.'); K.fill(g, 28, 5, 9, 2, '.');
    K.put(g, 32, 5, 'kk'); K.put(g, 32, 6, 'kk'); // a shelf blocks the east walk's top: its north end is a dead end
    for (const y of [9, 14, 19, 24]) { K.put(g, 3, y, 'k'); K.put(g, 36, y + 2, 'k'); }
    K.put(g, 20, 31, 's');
    for (const y of [12, 17, 22, 27]) { K.put(g, 17, y, 'l'); K.put(g, 22, y, 'l'); }
    K.fill(g, 18, 9, 4, 20, '+');

    K.deco(g, 11, 9, '..W...');
    K.deco(g, 23, 9, '...W..');
    K.deco(g, 11, 14, '..i...'); K.deco(g, 23, 14, '...i..');
    K.deco(g, 11, 19, '..W...'); K.deco(g, 23, 19, '...W..');
    K.deco(g, 11, 24, '..i...'); K.deco(g, 23, 24, '...i..');
    K.deco(g, 12, 4, '..i..}.......}..i.');
    K.deco(g, 17, 0, '..W...');
    K.deco(g, 3, 4, '.i.....');
    K.deco(g, 30, 4, '.....i.');
    K.deco(g, 4, 18, '=');
    K.deco(g, 35, 12, '=');
    K.deco(g, 8, 31, '{');
    K.deco(g, 31, 30, '=');
    K.deco(g, 13, 6, 'Q');
    K.deco(g, 26, 6, 'Q');

    const echo = (region, line) => {
      const r = R.DB.regions && R.DB.regions[region];
      const title = r && r.chapter ? r.chapter.title : '';
      return 'くぼみの奥から、\nかすかな声がこだまする……。\f「' + title + '」\n' + line;
    };
    R.DB.maps.archive_3 = K.check('archive_3', base('白の大書庫　3階', K.ZONE_LO, {
      lvOff: 2,
      rows: K.rows(g), decor: K.decor(g),
      spawns: {
        from_prev: { x: 19, y: 31, dir: 'up' },
        from_next: { x: 19, y: 2, dir: 'down' },
      },
      warps: [
        K.warp(20, 31, 'archive_2', 'from_next'),
        K.warp(20, 2, 'archive_4', 'from_prev'),
      ],
      // the seal opens with ロウェルの手帳 (§10.10.3), or once he has spoken its words
      tilePatches: [{ cond: { any: [{ item: 'k_rowell_note' }, 'final_rowell'] }, x: 19, y: 4, ch: 'D' }],
      npcs: [
        K.npc('rest', 'obj:lantern', 22, 19, { event: 'common_rest', fixed: true }),
        K.talk('rowell', 'rowell', 16, 6, 'ここは、おれが引き受ける。\n行け、語り部！', { cond: ['final_rowell', '!game_clear'], dir: 'down', fixed: true }),
      ],
      chests: [
        K.chest('archive_3_c1', 4, 5, 'p_supply'),
        K.chest('archive_3_c2', 35, 5, 'p_gear'),
        K.chest('archive_3_c3', 3, 31, 'p_gold'),
      ],
      signs: [
        K.sign(11, 11, echo('r_forest', '森の主エルムは千年樹に宿り、\n二度と森を焼かせないと\n誓った。')),
        K.sign(11, 16, echo('r_desert', 'ハザル王は、自分の名と\n引きかえに、民に\nオアシスの水を残した。')),
        K.sign(11, 21, echo('r_snow', '白竜ネーヴェは、冬至の火と\n竜の物語を受け取って、\n吹雪を鎮めてきた。')),
        K.sign(11, 26, echo('r_marsh', '魔女メルダは七つの鐘を\n沼に沈め、その音で\n霧を封じた。')),
        K.sign(28, 11, echo('r_isles', 'グレン船長は、嵐の海へ\n仲間を救いに出て、\n帰ると約束した。')),
        K.sign(28, 16, echo('r_mine', '鍛冶神は、七の層より下を\n掘るなと、鉱夫たちに\n誓わせた。')),
        K.sign(28, 21, echo('r_ash', '火の鳥は百年ごとに灰となり、\n語られる物語で、\nふたたび生まれる。')),
        K.sign(28, 26, echo('r_star', '賢者カペラは、夜空の星に\nひとつずつ名を付けた。\n名を呼ばれる星は、道しるべ。')),
      ],
      events: [
        K.exam('archive_3_door', 19, 4, { cond: { all: [{ notItem: 'k_rowell_note' }, '!final_rowell'] } }),
        ...K.band('archive_3_rowell', 17, 8, 22, 8, { once: 'final_rowell', cond: '!final_rowell' }),
      ],
    }));
  }
})(window.RPG);
