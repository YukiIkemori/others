// ファロス灯台 (lighthouse_1..3): the prologue's tutorial dungeon (DESIGN §10.6.2, §10.7 P8–P9).
// Owner: prologue (A18b). Theme / battle backdrop / BGM `tower`, zone `z_prologue_lighthouse`
// (tier 0 fixed, Lv 3–5: the zone writes the levels itself, §4.14.1; 2F still carries lvOff:2 by the rule).
//
// lighthouse_1 (36×32) — the cape and the storehouse. The tower door is a closed door until the
//   hero holds 灯台の鍵 (tilePatch); three steps inside, 灯台守オットー watches the tutorial battle
//   (lighthouse_1_tutorial). The storehouse is split in four by cross walls: vestibule → SW → NW →
//   NE (stairs up); the SE room is a side room with a chest.
// lighthouse_2 (34×30) — the spiral: three rings, radial walls force the long way round; the
//   休息の灯 in the middle ring; a cracked wall in the north-east (secret passage, §10.6.4) hides a
//   small room with two chests (p_supply, p_gold).
// lighthouse_3 (26×22) — the lamp room: an antechamber with the 休息の灯 and the girl in grey
//   (lighthouse_3_fine), then the round lamp room with ページ食らい (lighthouse_3_boss) in front of
//   the great lamp. After pro_boss the lamp burns (NPC `lamp_lit`).
//
// Contracts: spawns entrance / from_prev / from_next (§10.6.2-2), escape → world lighthouse_1,
// location 'lighthouse', NPC ids otto_door · rest · fine · boss.
(function (R) {
  'use strict';
  const K = R.Prologue;
  const ZONE = 'z_prologue_lighthouse';
  const ESC = { to: 'world', spawn: 'lighthouse_1' };
  const base = (name) => ({
    name, type: 'dungeon', theme: 'tower', bgm: 'tower', bbg: 'tower',
    location: 'lighthouse', region: 'prologue', escape: ESC,
  });

  // ------------------------------------------------------------ 1F
  const f1 = Object.assign(base('ファロス灯台　1階'), {
    encounter: ZONE, outside: '~', decorLegend: { ',': 'rope_coil' },
    // @rows lighthouse_1
    rows: [
      '~~~~~~~~~~~~~,#########,~~~~~~~~~~~~',
      '~~~~~~~~~~~,###o..#...###,~~~~~~~~~~',
      '~~~~~~~~~~###j....#...j.###~~~~~~~~~',
      '~~~~~~~~~##.......#...j..S##~~~~~~~~',
      '~~~~~~~~##............o....##~~~~~~~',
      '~~~~~~~,#.............u.....#,~~~~~~',
      '~~~~~~~##.jjoouujj#...joojj.##~~~~~~',
      '~~~~~~,#..........#...j......#,~~~~~',
      '~~~~~~##..........#...o......##~~~~~',
      '~~~~~~#ojjuujoo...#...........#~~~~~',
      '~~~~~,#...........#.........j.#,~~~~',
      '~~~~~,#.........o.#.p.........#,~~~~',
      '~~~~~,###..####################,~~~~',
      '~~~~~,#..o........#...........#,~~~~',
      '~~~~~,#...........#...uuu.....#,~~~~',
      '~~~~~~#uujjoopj...#...........#~~~~~',
      '~~~~~~##..........#.....jjoo.##~~~~~',
      '~~~~~~,#..........#..........#,~~~~~',
      '~~~~~~~##..jjoojju#...oo....##~~~~~~',
      '~~~~~~~,#......#######......#,~~~~~~',
      '~~~~~~~~##.................##~~~~~~~',
      '~~~~~~~~~##.p..#.....#....##~~~~~~~~',
      '~~~~~~~~~,###p.#.....#..###r~~~~~~~~',
      '~~~~~~~~r,,,####.....####,,,r~~~~~~~',
      '~~~~~~~~,,,,,,####E####,,,,,,~~~~~~~',
      '~~~~~~~,,,,,,,,,,,:,m,,,,,,,,,~~~~~~',
      '~~~~~~~~,,,,,,,,,,:,,,,,,,,,,~~~~~~~',
      '~~~~~~~~,,,,,,,,,,:,,,,,,,,,,~~~~~~~',
      '~~~~~~~~~,,,,,,,,,:,,,,,,,,,~~~~~~~~',
      '~~~~~~~~~~,,,,,,,,:,,,,,,,,~~~~~~~~~',
      '~~~~~~~~~~~,,,,,,,:,,,,,,r~~~~~~~~~~',
      '~~~~~~~~~~~~~~,,r,:,,r,~~~~~~~~~~~~~',
    ],
    decor: [
      '................i...i...............',
      '....................................',
      '........................i...........',
      '..........i....U....................',
      '..........q.........................',
      '........................q..@........',
      '....................................',
      '....................................',
      '....................................',
      '.............................U......',
      '........q...........................',
      '.......@............................',
      '.......i......i.......i.....i.......',
      '....................................',
      '....................................',
      '....................................',
      '............................N.......',
      '...........q..N.........@...........',
      '....................................',
      '................i...i...............',
      '....................................',
      '...........@....,...................',
      '....................q...............',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
      '....................................',
    ],
    // @end lighthouse_1
    spawns: {
      entrance: { x: 18, y: 30, dir: 'up' },
      from_next: { x: 25, y: 4, dir: 'down' },
    },
    warps: [
      K.warp(18, 31, 'world', 'lighthouse_1', { dir: 'down' }),
      K.warp(25, 3, 'lighthouse_2', 'from_prev'),
    ],
    tilePatches: [{ cond: { item: 'k_lighthouse_key' }, x: 18, y: 24, ch: 'D' }],
    npcs: [
      K.npc('otto_door', 'old_man', 16, 23, { dir: 'right', event: 'lighthouse_1_otto', cond: ['pro_key', '!pro_tutorial'], fixed: true }),
    ],
    chests: [
      K.chest('lighthouse_1_c1', 27, 18, 'p_supply'),
      K.chest('lighthouse_1_c2', 16, 1, 'p_supply'),
    ],
    events: [
      K.exam('lighthouse_1_door', 18, 24, { cond: { notItem: 'k_lighthouse_key' } }),
      ...K.band('lighthouse_1_tutorial', 16, 21, 20, 21, { once: 'lighthouse_1_tutorial', cond: 'pro_key' }),
    ],
    signs: [
      K.sign(20, 25, 'ファロス灯台\n「灯を絶やすな、歌を絶やすな」'),
    ],
  });

  // ------------------------------------------------------------ 2F
  const f2 = Object.assign(base('ファロス灯台　2階'), {
    encounter: ZONE, outside: '#', lvOff: 2, // §10.6.2-9 (the prologue zone writes its levels, so this does not raise them)
    // @rows lighthouse_2
    rows: [
      '##################################',
      '##################################',
      '##############.......#############',
      '############...........#####....##',
      '##########...............###....##',
      '#########.................%%....##',
      '########.....###...###.....#....##',
      '#######.....##......###.....######',
      '######....###.......#.###....#####',
      '######....#........##...#....#####',
      '#####....##....#####....##....####',
      '#####...##....##...##....##...####',
      '####....#....##.....##....#....###',
      '####....#...##.......##...#....###',
      '####....#...#.........#...#....###',
      '####....#...#....S....#...#....###',
      '####....#...#.........#...#....###',
      '####....#...##.......##...#....###',
      '####...##....##.....##....#....###',
      '##########....##...##....##...####',
      '######...##....#...#....##....####',
      '######....#.............#....#####',
      '######....###.........###....#####',
      '#######.....##.......##.....######',
      '########.s...#########.....#######',
      '#########.................########',
      '##########...............#########',
      '############...........###########',
      '##############.......#############',
      '##################################',
    ],
    decor: [
      '..................................',
      '.................iW...............',
      '..................................',
      '..................................',
      '.........W........................',
      '..................................',
      '..............i....i..............',
      '..................................',
      '..................................',
      '..........................q.......',
      '..............q...................',
      '....W..........i...i..............',
      '.....@............................',
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '......N...........................',
      '..................................',
      '.............................@....',
      '..................................',
      '.......................U..........',
      '..................................',
      '..................................',
      '..................................',
      '..................................',
      '..........@.......................',
      '..................................',
      '..................................',
      '..................................',
    ],
    // @end lighthouse_2
    spawns: {
      from_prev: { x: 10, y: 24, dir: 'right' },
      from_next: { x: 17, y: 16, dir: 'down' },
    },
    warps: [
      K.warp(9, 24, 'lighthouse_1', 'from_next'),
      K.warp(17, 15, 'lighthouse_3', 'from_prev'),
    ],
    npcs: [
      K.npc('rest', 'obj:lantern', 9, 15, { event: 'common_rest', fixed: true }),
    ],
    chests: [
      K.chest('lighthouse_2_c1', 7, 20, 'p_gear'),
      K.chest('lighthouse_2_c2', 29, 4, 'p_supply'),
      K.chest('lighthouse_2_c3', 30, 5, 'p_gold'),
    ],
    signs: [
      K.sign(17, 24, ['壁に古い文字が刻まれている。\f「灯は歌で目を覚まし、\n歌は語り部が伝える。」']),
    ],
  });

  // ------------------------------------------------------------ 3F (boss floor: no lvOff, §10.6.2-9)
  const f3 = Object.assign(base('ファロス灯台　灯室'), {
    encounter: ZONE, outside: '#',
    // @rows lighthouse_3
    rows: [
      '##########################',
      '##########################',
      '###########.....##########',
      '#########.........########',
      '########...........#######',
      '########....CCC....#######',
      '#######.....CCC.....######',
      '#######.............######',
      '#######.............######',
      '#######.............######',
      '#######.............######',
      '########...........#######',
      '########...........#######',
      '#########.........########',
      '###########.....##########',
      '############...###########',
      '########...........#######',
      '########.l.......l.#######',
      '########...........#######',
      '########...........#######',
      '########.....s.....#######',
      '##########################',
    ],
    decor: [
      '..........................',
      '.............W............',
      '..........W.....W.........',
      '..........................',
      '..........................',
      '.......W...........W......',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '........i.b.....b.i.......',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
      '..........................',
    ],
    // @end lighthouse_3
    spawns: {
      from_prev: { x: 13, y: 19, dir: 'up' },
    },
    warps: [
      K.warp(13, 20, 'lighthouse_2', 'from_next'),
    ],
    npcs: [
      K.npc('rest', 'obj:lantern', 8, 19, { event: 'common_rest', fixed: true }),
      K.npc('fine', 'fine', 13, 16, { dir: 'down', event: 'lighthouse_3_fine', cond: '!lighthouse_3_fine', fixed: true }),
      K.npc('lamp', 'obj:pro_lamp_dark', 13, 6, { cond: '!pro_boss', fixed: true, text: '大きな灯台の灯だ。\n火は消えて、冷たくなっている。' }),
      K.npc('lamp_lit', 'obj:pro_lamp_lit', 13, 6, { cond: 'pro_boss', fixed: true, text: '守り歌を取り戻した灯が、\n夜の海を照らしている。' }),
      K.npc('boss', 'mon:boss_pageeater', 13, 9, { event: 'lighthouse_3_boss', cond: '!pro_boss', fixed: true }),
      K.npc('scrap_a', 'decor:paper_drift', 9, 6, { cond: '!pro_boss', fixed: true, text: '白い紙切れだ。\n何も書かれていない……。' }),
      K.npc('scrap_b', 'decor:paper_drift', 17, 8, { cond: '!pro_boss', fixed: true, text: '白い紙切れだ。\n何も書かれていない……。' }),
      K.npc('scrap_c', 'decor:paper_drift', 15, 3, { cond: '!pro_boss', fixed: true, text: '白い紙切れだ。\n何も書かれていない……。' }),
    ],
    events: [
      ...K.band('lighthouse_3_fine', 8, 18, 18, 18, { once: 'lighthouse_3_fine', cond: '!pro_boss' }),
      ...K.band('lighthouse_3_boss', 8, 12, 18, 12, { cond: '!pro_boss' }),
    ],
  });

  R.DB.maps.lighthouse_1 = K.checkRows('lighthouse_1', f1);
  R.DB.maps.lighthouse_2 = K.checkRows('lighthouse_2', f2);
  R.DB.maps.lighthouse_3 = K.checkRows('lighthouse_3', f3);

  // ------------------------------------------------------------ the great lamp (台本の演出, §11.2.11)
  // obj:lantern drawn at twice its size on the lamp base: dark (cold, bluish) before the song is
  // back, lit (white flame and a halo, 2 frames) after. Built from obj:lantern (art-chars) when it
  // exists, else from decor:candelabra (its stand-in, §11.2.12).
  function lampFrames() {
    const G = R.Gfx;
    let src = G.has('obj:lantern') ? G.get('obj:lantern') : G.get('decor:candelabra');
    if (src && !Array.isArray(src) && !src.getContext) src = src.down || src[Object.keys(src)[0]];
    return Array.isArray(src) ? src : [src];
  }
  function lamp(lit) {
    const G = R.Gfx;
    return lampFrames().map((f, i) => {
      const w = (f.width || 16) * 2, h = (f.height || 24) * 2;
      const cv = G.makeCanvas(w + 16, h + 8), c = cv.getContext('2d');
      c.imageSmoothingEnabled = false;
      if (lit) {
        const gr = c.createRadialGradient(cv.width / 2, h * 0.32, 2, cv.width / 2, h * 0.32, cv.width / 2);
        gr.addColorStop(0, 'rgba(255,255,240,' + (i ? 0.55 : 0.45) + ')');
        gr.addColorStop(1, 'rgba(255,250,220,0)');
        c.fillStyle = gr;
        c.fillRect(0, 0, cv.width, cv.height);
      }
      c.drawImage(f, 8, 8, w, h);
      if (!lit) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(24,30,52,0.58)';
        c.fillRect(0, 0, cv.width, cv.height);
      }
      return cv;
    });
  }
  if (!R.Gfx.has('obj:pro_lamp_dark')) R.Gfx.def('obj:pro_lamp_dark', () => lamp(false));
  if (!R.Gfx.has('obj:pro_lamp_lit')) R.Gfx.def('obj:pro_lamp_lit', () => lamp(true));
})(window.RPG);
