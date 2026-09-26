// 霧の館 2階 (mist_manor_2) — 46×34 layout. Node-only; see lib/sync.js.
'use strict';
const { Grid } = require('./grid');

module.exports = function manor2() {
  const W = 46, H = 34;
  const T = new Grid(W, H, '#');
  const D = new Grid(W, H, '.');
  const room = (x0, y0, x1, y1, c) => T.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, c || '.');

  room(3, 25, 11, 31);             // landing (stairs down)
  room(12, 28, 40, 30);            // south hall (blocked by the fallen ceiling)
  room(3, 4, 11, 22);              // nursery
  room(13, 2, 15, 20);             // west corridor
  room(13, 2, 40, 4);              // north corridor
  room(38, 2, 40, 30);             // east corridor
  room(21, 6, 29, 10);             // Melda's room (behind the fog, after the dolls)
  room(17, 12, 33, 22);            // ballroom (人形の楽団)
  room(20, 24, 30, 26);            // antechamber (休息の灯)
  room(42, 6, 44, 14);             // study
  room(42, 18, 44, 26);            // guest bedroom
  // doors & openings
  T.pts([[6, 23], [6, 24], [12, 9], [41, 10], [41, 22]], 'D');
  T.set(25, 27, 'D'); T.set(25, 23, 'D');          // south hall → antechamber → ballroom
  T.set(25, 11, 'G');                               // fog before Melda's room (opens with marsh_mid)
  T.rect(16, 28, 2, 3, 'r');                        // the fallen ceiling
  T.pts([[18, 28], [18, 30], [15, 29]], 'r');
  // furniture
  T.set(4, 26, 's');                                // stairs down
  T.pts([[3, 5], [5, 5], [7, 5], [3, 6], [5, 6], [7, 6]], 'b');   // nursery beds (three small)
  T.pts([[9, 12], [10, 12], [9, 13]], 't'); T.pts([[8, 12], [8, 13]], 'h');
  T.pts([[3, 21], [11, 21], [11, 4]], 'u');
  T.pts([[3, 31], [11, 25], [11, 31]], 'o');
  T.pts([[19, 13], [31, 13], [19, 21], [31, 21]], 'l');           // ballroom pillars
  T.pts([[24, 13], [25, 13], [26, 13]], 'l'.replace('l', '.'));
  T.pts([[21, 7], [29, 7]], 'k'); T.pts([[22, 9], [23, 9]], 't'); T.set(24, 9, 'h'); T.pts([[28, 9], [28, 10]], 'b');
  T.pts([[42, 6], [43, 6], [44, 6]], 'k'); T.pts([[42, 12], [43, 12]], 't'); T.set(44, 12, 'h');
  T.pts([[42, 18], [42, 19], [44, 18], [44, 19]], 'b'); T.pts([[42, 26]], 'o');
  T.pts([[20, 24], [30, 24]], 'Y');
  T.rect(22, 25, 7, 2, '+'); T.rect(24, 14, 3, 9, '+');
  // decor
  const wallRow = (y, xs, c) => xs.forEach((x) => D.set(x, y, c));
  wallRow(3, [5, 9], 'w'); wallRow(3, [7], ':');
  wallRow(1, [14, 20, 26, 32, 39], 'W'); wallRow(1, [17, 23, 29, 35], 'P');
  wallRow(5, [23, 27], 'p'); wallRow(5, [25], 'P');
  wallRow(11, [18, 21, 29, 32], 'i'); wallRow(11, [23, 27], ':');
  wallRow(23, [21, 29], 'i'); wallRow(23, [23, 27], 'P');
  wallRow(24, [4, 8], 'w');
  wallRow(27, [14, 22, 30, 36], 'P');
  wallRow(5, [43], 'W'); wallRow(17, [43], 'm');
  // ballroom: the stage of the doll orchestra, piano, broken chairs, candelabras
  D.rect(22, 12, 7, 2, '0'); D.set(28, 15, '|'); D.pts([[18, 16], [32, 18], [20, 19]], ',');
  D.pts([[17, 12], [33, 12], [17, 22], [33, 22]], 'Q');
  // nursery: cradle, rugs, dolls
  D.set(10, 5, "'"); D.rect(5, 9, 3, 3, '&'.replace('&', 'r')); D.pts([[3, 12], [3, 16]], 'Z'); D.set(11, 17, 'y');
  D.pts([[9, 20], [4, 18]], ',');
  // cobwebs
  D.pts([[3, 25], [11, 29], [13, 2], [40, 2], [40, 30], [21, 6], [29, 6], [44, 26], [44, 14], [3, 4], [20, 26], [12, 30]], '@');
  D.set(26, 7, 'V'); D.set(27, 10, 'Q'); D.set(43, 8, 'I'); D.pts([[43, 24], [42, 24]], 'y'.replace('y', 'A'));
  D.pts([[39, 16], [14, 12]], ',');
  return { T, D, W, H, decorLegend: { ':': 'doll_shelf', ',': 'broken_chair', '|': 'piano', "'": 'cradle' } };
};
