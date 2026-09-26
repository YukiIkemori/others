// 霧の館 1階 (mist_manor_1) — 50×40 layout. Node-only; see lib/sync.js.
'use strict';
const { Grid } = require('./grid');

module.exports = function manor1() {
  const W = 50, H = 40;
  const T = new Grid(W, H, '#');
  const D = new Grid(W, H, '.');
  const room = (x0, y0, x1, y1, c) => T.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c || '.');

  // ---- rooms (interior rectangles, inclusive)
  room(19, 27, 30, 37);            // foyer
  room(3, 26, 17, 36);             // dining hall
  room(3, 15, 12, 24);             // kitchen
  room(3, 4, 8, 13);               // pantry (dead end: p_rare)
  room(14, 4, 17, 24);             // west gallery
  room(14, 4, 34, 6);              // north corridor
  room(21, 8, 28, 22);             // stair hall
  room(32, 7, 34, 36);             // east corridor
  room(36, 8, 45, 20);             // library
  room(36, 22, 45, 30);            // doll room
  room(36, 32, 45, 36);            // servants' room
  room(37, 2, 46, 5);              // the hidden tea room (secret passage, rare monsters ×3)
  // ---- doors, openings, fog shortcut, secret passage
  T.pts([[18, 32], [7, 25], [5, 14], [13, 19], [31, 32], [35, 10], [35, 26], [35, 34], [40, 21]], 'D');
  T.rect(32, 13, 3, 1, '#');                      // the east corridor is cut in two (lower ↔ upper only through the rooms)
  T.pts([[22, 7], [27, 7]], '.');                 // north corridor → stair hall (both sides of the grand stairs)
  T.rect(24, 24, 2, 3, '.'); T.rect(24, 23, 2, 1, 'G');   // fog over the passage foyer → stair hall
  T.rect(24, 38, 2, 1, 'D');                      // front door (warp to the world)
  T.pts([[41, 7], [41, 6]], '%');                 // cracked library wall → the tea room
  // ---- furniture (tiles)
  T.rect(24, 8, 2, 1, 'S');                        // grand stairs up
  T.pts([[22, 11], [27, 11], [22, 15], [27, 15], [22, 19], [27, 19]], 'l');
  T.rect(24, 9, 2, 14, '+');                      // stair-hall runner
  T.rect(24, 28, 2, 10, '+');                      // foyer runner
  T.pts([[20, 29], [29, 29], [20, 34], [29, 34]], 'l');
  // dining: long table with chairs
  T.rect(6, 30, 9, 2, 't');
  for (let x = 6; x <= 14; x += 2) { T.set(x, 29, 'h'); T.set(x, 32, 'h'); }
  T.pts([[3, 26], [17, 26]], 'u'); T.pts([[3, 36]], 'o');
  // kitchen
  T.rect(7, 15, 4, 1, 'c'); T.pts([[3, 20], [3, 21], [12, 24], [11, 24]], 'o'); T.pts([[3, 15], [3, 24]], 'p');
  T.set(8, 19, 't'); T.set(9, 19, 't'); T.pts([[7, 19], [10, 19]], 'h'); T.pts([[12, 15], [12, 16], [3, 16]], 'u'); T.pts([[6, 23], [7, 23]], 'j');
  // pantry
  T.pts([[3, 4], [4, 4], [8, 4], [8, 5], [3, 8], [8, 9], [8, 13]], 'o'); T.pts([[3, 5], [3, 11], [8, 11], [3, 13]], 'p');
  T.pts([[6, 4], [7, 4]], 'u');
  // west gallery: statues
  T.pts([[14, 9], [17, 14], [14, 20]], 'Y');
  // library: bookshelves in rows
  for (const y of [10, 13, 16]) { T.rect(37, y, 3, 1, 'k'); T.rect(42, y, 3, 1, 'k'); }
  T.rect(36, 8, 4, 1, 'k'); T.rect(43, 8, 3, 1, 'k'); T.set(45, 20, 't'); T.set(44, 20, 'h');
  // doll room: shelves, table
  T.pts([[38, 25], [43, 25], [38, 28], [43, 28]], 't'); T.pts([[36, 30], [45, 30]], 'u');
  // servants' room: beds
  T.pts([[37, 32], [37, 33], [40, 32], [40, 33], [43, 32], [43, 33]], 'b'); T.pts([[45, 36], [38, 36]], 'o');
  // tea room: table set for tea
  T.rect(40, 3, 3, 1, 't'); T.pts([[39, 3], [43, 3], [41, 2], [41, 4]], 'h');
  // east corridor: fallen pillars / statues
  T.pts([[34, 20], [32, 11]], 'Y');

  // ---- decor
  const wallRow = (y, xs, c) => xs.forEach((x) => D.set(x, y, c));
  // torches / portraits / windows on the north faces
  wallRow(26, [20, 29], 'i'); wallRow(26, [22, 27], 'W');
  wallRow(25, [5, 11, 15], 'w'); wallRow(25, [8], 'P');
  wallRow(14, [4, 10], 'w'); wallRow(14, [7], '$');
  wallRow(3, [5], 'w');
  wallRow(3, [15, 21, 27, 33], 'W'); wallRow(3, [18, 24, 30], 'P');
  wallRow(7, [23, 26], 'i');
  wallRow(7, [37, 44], 'W'); wallRow(21, [38, 43], ':'); wallRow(31, [38, 42], 'P');
  wallRow(1, [39, 44], 'p'); wallRow(1, [41], 'W');
  // cobwebs, broken chairs, rugs, candelabras, clocks, mirrors
  D.pts([[3, 4 + 23], [17, 36], [14, 4], [17, 24], [21, 8], [28, 8], [34, 36], [45, 8], [36, 36], [3, 15], [8, 13], [46, 5], [37, 5]], '@');
  D.pts([[10, 34], [15, 27], [12, 21], [33, 24], [39, 20]], ',');
  D.pts([[4, 28], [16, 34], [21, 28], [28, 28], [44, 22]], 'Q');
  D.pts([[19, 36], [30, 36]], 'Z'); D.set(30, 28, 'V'); D.set(19, 28, 'A'); D.set(45, 11, 'I');
  D.pts([[40, 25], [41, 25], [40, 28], [41, 28]], 'r'); D.rect(39, 34, 5, 1, 'r');
  D.rect(38, 2, 2, 1, '.'); D.pts([[37, 2], [46, 2]], 'Q');
  D.pts([[4, 17], [4, 22]], 'K'); D.pts([[3, 18], [11, 20]], 'q'); D.set(9, 22, 'S');
  return { T, D, W, H, decorLegend: { ':': 'doll_shelf', ',': 'broken_chair' } };
};
