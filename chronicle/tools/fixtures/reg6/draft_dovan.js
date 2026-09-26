// Draft generator for the dovan town rows (R6). Prints the rows/decor arrays that are pasted into
// src/maps/region6_town.js. Not loaded by the game (tools/fixtures/reg6 is only read by build --with
// for *.js files — this file exits immediately when there is no `require`).
'use strict';
if (typeof require === 'undefined' || typeof module === 'undefined') { /* browser --with load: nothing */ } else {
  const W = 54, H = 44;
  const T = Array.from({ length: H }, () => Array(W).fill('r'));
  const Dc = Array.from({ length: H }, () => Array(W).fill('.'));
  const fill = (x0, y0, x1, y1, ch) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) T[y][x] = ch; };
  const put = (x, y, ch) => { T[y][x] = ch; };
  const dec = (x, y, ch) => { Dc[y][x] = ch; };
  const stamp = (x0, y0, rows, drows) => {
    const w = rows[0].length;
    rows.forEach((r, i) => { if (r.length !== w) throw new Error('stamp row ' + i + ' width ' + r.length + ' != ' + w + ': ' + r); for (let k = 0; k < w; k++) if (r[k] !== ' ') T[y0 + i][x0 + k] = r[k]; });
    (drows || []).forEach((r, i) => { if (r.length !== w) throw new Error('decor row ' + i + ' width ' + r.length + ' != ' + w + ': ' + r); for (let k = 0; k < w; k++) if (r[k] !== '.' && r[k] !== ' ') Dc[y0 + i][x0 + k] = r[k]; });
  };

  // ---- open ground: the valley floor
  fill(2, 2, 51, 42, '.');
  // ragged rock edges
  const rock = [[2, 2], [3, 2], [2, 3], [51, 2], [50, 2], [51, 3], [51, 11], [51, 12], [2, 12], [2, 22], [2, 23], [51, 23], [51, 24],
    [2, 35], [2, 36], [3, 36], [2, 37], [3, 37], [4, 37], [2, 38], [3, 38], [4, 38], [5, 38], [2, 39], [3, 39], [4, 39], [5, 39], [6, 39],
    [2, 40], [3, 40], [4, 40], [5, 40], [6, 40], [7, 40], [8, 40], [2, 41], [3, 41], [4, 41], [5, 41], [6, 41], [7, 41], [8, 41], [9, 41], [10, 41],
    [2, 42], [3, 42], [4, 42], [5, 42], [6, 42], [7, 42], [8, 42], [9, 42], [10, 42], [11, 42], [12, 42], [13, 42], [14, 42], [15, 42], [16, 42], [17, 42],
    [51, 36], [50, 37], [51, 37], [49, 38], [50, 38], [51, 38], [47, 39], [48, 39], [49, 39], [50, 39], [51, 39], [45, 40], [46, 40], [47, 40], [48, 40], [49, 40], [50, 40], [51, 40],
    [42, 41], [43, 41], [44, 41], [45, 41], [46, 41], [47, 41], [48, 41], [49, 41], [50, 41], [51, 41],
    [33, 42], [34, 42], [35, 42], [36, 42], [37, 42], [38, 42], [39, 42], [40, 42], [41, 42], [42, 42], [43, 42], [44, 42], [45, 42], [46, 42], [47, 42], [48, 42], [49, 42], [50, 42], [51, 42]];
  for (const [x, y] of rock) put(x, y, 'r');
  // the road out (south)
  fill(24, 43, 29, 43, '.');
  fill(18, 42, 32, 42, '.');

  // ---- 宿屋 (inn) x2..13 y2..10, door (10,10)
  stamp(2, 2, [
    'BBBBBBBBBBBB',
    'BBBBBBBBBBBB',
    'Bb_b_b__ouuB',
    'Bb_b_b_____B',
    'B__________B',
    'B______ccc_B',
    'B__h_______B',
    'B__t_______B',
    'BBBBBBBBDBBB',
  ], [
    '............',
    '.w.p.w..$.w.',
    '............',
    '.......&....',
    '..&.........',
    '............',
    '...........Z',
    '.n..........',
    '............',
  ]);
  // ---- 鍛冶神のほこら (shrine of the smith god) x17..29 y2..10, door (23,10)
  stamp(17, 2, [
    'BBBBBBBBBBBBB',
    'BBBBBBBBBBBBB',
    'B....lYl....B',
    'B.....a.....B',
    'B.l..+++..l.B',
    'B....+++....B',
    'B.l..+++..l.B',
    'B....+++....B',
    'BBBBBBDBBBBBB',
  ], [
    '.............',
    '.i.W..c..W.i.',
    '.Q.........Q.',
    '....O...O....',
    '.............',
    '.e........e..',
    '.............',
    '.e........e..',
    '.............',
  ]);
  // ---- 酒場「つるはし亭」 x36..51 y2..10, door (44,10)
  stamp(36, 2, [
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'Bo__o_________oB',
    'B_cccccc_______B',
    'B_h_h_h________B',
    'B______hth_____B',
    'B__hth_________B',
    'B_______hth____B',
    'BBBBBBBBDBBBBBBB',
  ], [
    '................',
    '.w.HHH.w..p.w.i.',
    '..N.....k.......',
    '................',
    '................',
    '............000.',
    '............000.',
    '.Z..............',
    '................',
  ]);
  // ---- 道具屋 x2..11 y14..21, door (6,21)
  stamp(2, 14, [
    'BBBBBBBBBB',
    'BBBBBBBBBB',
    'Bu_uu__opB',
    'B________B',
    'B_cccc___B',
    'B________B',
    'B_j____h_B',
    'BBBBDBBBBB',
  ], [
    '..........',
    '.$.w..k.w.',
    '..........',
    '.......q..',
    '..........',
    '.....&....',
    '..........',
    '..........',
  ]);
  // ---- ヘルガの鍛冶場 x14..27 y14..22, door (21,22)
  stamp(14, 14, [
    'BBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBB',
    'B...........oB',
    'B............B',
    'B......cccc..B',
    'B............B',
    'B.j.......j..B',
    'B............B',
    'BBBBBBBDBBBBBB',
  ], [
    '..............',
    '.x.k..w.x.w.x.',
    '.|.....XX..:..',
    '.%O...........',
    '..............',
    '..........:...',
    '..............',
    '.O..........%.',
    '..............',
  ]);
  // ---- 防具屋 x30..39 y14..21, door (35,21)
  stamp(30, 14, [
    'BBBBBBBBBB',
    'BBBBBBBBBB',
    'B_____uu_B',
    'B________B',
    'B___cccc_B',
    'B________B',
    'B_h____j_B',
    'BBBBBDBBBB',
  ], [
    '..........',
    '.w.c..w.k.',
    '.Y.Y......',
    '..........',
    '..........',
    '.&........',
    '..........',
    '..........',
  ]);
  // ---- 鉱山事務所（ボルグの家） x41..52 y14..22, door (46,22)
  stamp(41, 14, [
    'BBBBBBBBBBBB',
    'BBBBBBBBBBBB',
    'Bkk_______bB',
    'B_________bB',
    'B_________oB',
    'B__hth_____B',
    'B_________jB',
    'B__________B',
    'BBBBBDBBBBBB',
  ], [
    '............',
    '.[..w..}..w.',
    '.....{......',
    '.....D......',
    '............',
    '............',
    '..&.........',
    '..........Z.',
    '............',
  ]);
  // ---- 家 A (miner_a) x2..10 y27..33, door (6,33)
  stamp(2, 27, [
    'BBBBBBBBB',
    'BBBBBBBBB',
    'Bb_b____B',
    'Bb_b____B',
    'B___hth_B',
    'B_______B',
    'BBBBDBBBB',
  ], [
    '.........',
    '.w..p..w.',
    '......K..',
    '.......C.',
    '.........',
    '.&.......',
    '.........',
  ]);
  // ---- 家 B (Pip's grandmother) x13..21 y27..33, door (17,33)
  stamp(13, 27, [
    'BBBBBBBBB',
    'BBBBBBBBB',
    'B____b_bB',
    'B____b_bB',
    'B_hth___B',
    'B_______B',
    'BBBBDBBBB',
  ], [
    '.........',
    '.w.$..w..',
    '.K.......',
    '.........',
    '......?..',
    '.......&.',
    '.........',
  ]);
  // ---- 家 C (miner_b) x31..39 y27..33, door (35,33)
  stamp(31, 27, [
    'BBBBBBBBB',
    'BBBBBBBBB',
    'B____b_bB',
    'B____b_bB',
    'B_hth___B',
    'B_______B',
    'BBBBDBBBB',
  ], [
    '.........',
    '.w..p.w..',
    '.C.......',
    '..,......',
    '.......y.',
    '.&.......',
    '.........',
  ]);

  // ---- the old shaft (north, between the shrine and the tavern) and the rails
  put(32, 2, 'r'); put(34, 2, 'r'); put(33, 2, '.');
  for (let y = 2; y <= 12; y++) dec(33, y, '-');
  for (let x = 33; x <= 40; x++) dec(x, 12, '-');
  for (let y = 12; y <= 24; y++) dec(40, y, '-');
  for (let x = 40; x <= 47; x++) dec(x, 24, '-');
  for (let y = 24; y <= 33; y++) dec(47, y, '-');
  dec(34, 3, '/');           // an old cart at the shaft mouth
  put(32, 3, 'm');           // 第一坑 sign
  // ---- the ore depot (SE yard)
  fill(42, 26, 51, 35, ':');
  for (let y = 24; y <= 33; y++) T[y][47] = ':';
  stamp(43, 26, ['jj....jjj'], ['.........']);
  dec(47, 34, '/'); dec(48, 34, '.');
  dec(44, 29, ':'); dec(45, 29, ':'); dec(44, 32, ':'); dec(50, 30, ':'); dec(50, 31, 'U'); dec(50, 33, 'q'); dec(43, 33, 'U');
  put(49, 28, 'o'); put(49, 32, 'o');
  // ---- the square: well, the oath stone, benches, lamps
  put(26, 29, 'W');
  put(26, 26, 'Y'); put(27, 26, 'm');   // 誓いの碑 (statue + plaque)
  dec(24, 29, 'e'); dec(28, 29, 'e'); dec(24, 31, '1'); dec(28, 31, '1');
  // street furniture
  for (const [x, y] of [[15, 12], [30, 12], [2 + 13, 24], [29, 25], [23, 25], [40, 23], [12, 34], [41, 34]]) dec(x, y, '3');
  dec(8, 22, '4'); dec(33, 22, '6'); dec(19, 23, '5'); dec(42, 11, 'j'); dec(7, 11, '7');
  dec(19, 11, ']');
  // the southern slope: a stream from the west rocks, the stone bridge, grass terraces and pines
  fill(3, 37, 50, 41, ',');
  for (let x = 3; x <= 50; x++) put(x, 38, '~');
  put(26, 38, '|'); put(27, 38, '|');
  for (let y = 35; y <= 43; y++) { if (T[y][26] !== '|') put(26, y, ':'); if (T[y][27] !== '|') put(27, y, ':'); }
  for (const [x, y] of [[4, 36], [5, 36], [6, 35], [45, 35], [46, 36], [48, 36], [49, 36], [50, 36]]) put(x, y, ',');
  for (const [x, y] of [[7, 39], [11, 40], [15, 39], [19, 40], [22, 39], [31, 40], [35, 39], [39, 40], [43, 39], [9, 37], [14, 36], [38, 36], [44, 37], [20, 37], [33, 37]]) put(x, y, 'T');
  for (const [x, y] of [[12, 39], [36, 40], [30, 37], [17, 41], [41, 40]]) put(x, y, 'r');
  for (const [x, y] of [[8, 40], [13, 41], [24, 40], [29, 40], [37, 41], [46, 39]]) dec(x, y, 'h');
  for (const [x, y] of [[10, 37], [16, 37], [23, 37], [34, 37], [41, 37], [5, 37]]) dec(x, y, 'f');
  dec(25, 36, '3'); dec(28, 36, '3');
  for (const [x, y] of rock) if (y >= 36) put(x, y, 'r');
  for (let x = 18; x <= 32; x++) if (T[42][x] === '.') put(x, 42, ',');
  for (let x = 24; x <= 29; x++) if (T[43][x] === '.') put(x, 43, ',');
  // street features
  for (const [x, y] of [[4, 12], [21, 12], [47, 12]]) dec(x, y, '1');
  dec(28, 11, 'h'); dec(16, 25, 'h'); dec(36, 25, 'h');
  // rock outcrops in town
  for (const [x, y] of [[14, 3], [14, 4], [15, 3], [30, 3], [2, 24], [2, 25], [3, 25], [51, 25], [51, 26], [12, 24], [40, 36]]) put(x, y, 'r');
  // crates / barrels by doors
  put(12, 21, 'j'); put(28, 22, 'o'); put(29, 21, 'j');
  put(11, 33, 'o'); put(22, 33, 'j'); put(40, 33, 'o');

  const rows = T.map((r) => r.join(''));
  const decor = Dc.map((r) => r.join(''));
  const q = (s) => "      '" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "',";
  if (process.argv.includes('--js')) {
    console.log('    rows: [\n' + rows.map(q).join('\n') + '\n    ],\n    decor: [\n' + decor.map(q).join('\n') + '\n    ],');
  } else {
    console.log('    ' + Array.from({ length: W }, (_, i) => (i % 10 ? ' ' : String(i / 10))).join(''));
    console.log('    ' + Array.from({ length: W }, (_, i) => String(i % 10)).join(''));
    rows.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + r + '   ' + decor[y]));
  }
}
