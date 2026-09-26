'use strict';
const { Grid, inject } = require('./paint.cjs');
const W = 52, H = 44;
const g = new Grid(W, H, 'd', '.');

// ---- town wall (2 thick at the top for the face, 1 elsewhere)
g.rect(1, 1, 50, 2, '#');
g.rect(1, 42, 50, 42, '#');
g.rect(1, 1, 1, 42, '#');
g.rect(50, 1, 50, 42, '#');
for (const x of [6, 16, 35, 45]) g.set(x, 2, 'i');
// gate + road out
g.rect(25, 42, 26, 43, '.');
// palms outside the wall
for (const x of [3, 10, 19, 32, 41, 48]) g.dec(x, 0, ')');
for (const x of [21, 30, 8, 44]) g.dec(x, 43, ')');

// ---- streets
g.rect(2, 13, 49, 15, '.');          // north street
g.rect(2, 27, 49, 28, '.');          // main street
g.rect(24, 29, 27, 41, '.');         // south avenue
g.rect(17, 16, 34, 16, '.'); g.rect(17, 26, 34, 26, '.');
g.rect(17, 16, 17, 26, '.'); g.rect(34, 16, 34, 26, '.'); // oasis ring walk
g.rect(35, 25, 49, 26, '.');         // street in front of the shops
g.rect(35, 16, 36, 26, '.');         // lane east of the oasis
g.rect(2, 21, 15, 21, '.');          // market cross lanes
g.rect(8, 16, 8, 26, '.');
g.rect(2, 40, 49, 41, ':');          // south lane (packed earth)
g.rect(24, 40, 27, 41, '.');

// ---- oasis: grass ring, dry basin (sand) with a last puddle
const cx = 25.5, cy = 21;
for (let y = 17; y <= 25; y++) for (let x = 18; x <= 33; x++) {
  const dx = (x - cx) / 8.6, dy = (y - cy) / 4.9;
  if (dx * dx + dy * dy <= 1) g.set(x, y, ',');
}
const BASIN = [];
for (let y = 18; y <= 24; y++) for (let x = 19; x <= 32; x++) {
  const dx = (x - cx) / 7.0, dy = (y - cy) / 3.7;
  if (dx * dx + dy * dy <= 1) { g.set(x, y, 'd'); BASIN.push([x, y]); }
}
g.set(25, 21, '~'); g.set(26, 21, '~');
for (const [x, y] of [[19, 17], [32, 17], [18, 20], [33, 20], [18, 23], [33, 23], [21, 25], [30, 25], [22, 17], [29, 17]]) g.dec(x, y, ')');

// ---- 隊商宿 (inn) x3..15 y4..12
g.stamp(3, 4, [
  'BBBBBBBBBBBBB',
  'BBBBBBBBBBBBB',
  'Bu__o_b_b_b_B',
  'B___j_b_b_b_B',
  'Bccc________B',
  'B___________B',
  'B_______hth_B',
  'Bo__________B',
  'BBBBBBDBBBBBB',
], [
  '.............',
  '.$..w...w..w.',
  '.......y.y...',
  '.............',
  '.............',
  '....&.......Z',
  '.............',
  '......Z.rrr..',
  '.............',
]);
g.dec(6, 13, '7');
// ---- 祈りの庭 (the king's court) x18..32 y4..12
g.stamp(18, 4, [
  'BBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBB',
  'Bp..l..Y..l..pB',
  'B.....+++.....B',
  'B.....+++.....B',
  'B.....+++.....B',
  'B.....+++.....B',
  'B.....+++.....B',
  'Bl..l.+++.l..lB',
], [
  '...............',
  '..t..c.W.c..t..',
  '...Q.......Q...',
  '...............',
  '..eee.....eee..',
  '...............',
  '..eee.....eee..',
  '.f...........f.',
  '...............',
]);
// ---- 酒場 x35..48 y4..12
g.stamp(35, 4, [
  'BBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  'Bo___j_______B',
  'B____________B',
  'Bccccc_______B',
  'B______hth___B',
  'B____________B',
  'Bhth_____htho'.concat('B'),
  'BBBBBBDBBBBBBB',
], [
  '..............',
  '.HHH...w..w...',
  '..N.......000.',
  '........n.....',
  '...........N..',
  '..............',
  '....T.........',
  '..............',
  '..............',
]);
g.dec(43, 13, 'j');
// ---- 武器屋・防具屋 x37..49 y17..24
g.stamp(37, 17, [
  'BBBBBBBBBBBBB',
  'BBBBBBBBBBBBB',
  'B_____B_____B',
  'B_ccc_B_ccc_B',
  'B_____B_____B',
  'B_____B_____B',
  'B____oB____jB',
  'BBBDBBBBBDBBB',
], [
  '.............',
  '..x.x...c.m..',
  '.X...X.Y...Y.',
  '.............',
  '.............',
  '..rrr...rrr..',
  '.............',
  '.............',
]);
g.dec(38, 25, '5'); g.dec(48, 25, '6');

// ---- market x2..15 y16..26
g.set(14, 18, 'W');
g.stamp(3, 17, ['   '], ['U.q']);
g.drect(3, 19, 5, 19, '9');           // item shop stall
g.stamp(10, 17, ['   '], ['v.q']);
g.drect(10, 19, 12, 19, '9');         // fruit stall
g.drect(3, 23, 5, 23, '9');           // cloth stall
g.drect(10, 23, 12, 23, '9');         // spice stall
g.dec(3, 25, 'U'); g.dec(5, 25, 'q'); g.dec(12, 25, 'q'); g.dec(10, 25, 'v');
g.dec(14, 24, '|'); g.dec(2, 16, ')'); g.dec(15, 26, ')'); g.dec(15, 16, ')');
g.dec(4, 21, '4');

// ---- 墓守アブルの家 x3..12 y30..38
g.stamp(3, 30, [
  'BBBBBBBBBB',
  'BBBBBBBBBB',
  'Bb_kk___pB',
  'Bb_______B',
  'B________B',
  'B_Y___htcB'.replace('c', 'h'),
  'B________B',
  'Bo______jB',
  'BBBBDBBBBB',
], [
  '..........',
  '.w..p..w..',
  '.....v....',
  '.......>..',
  '....&.....',
  '..........',
  '...rrr....',
  '..........',
  '..........',
]);
// ---- 家 x14..21 y30..38
g.stamp(14, 30, [
  'BBBBBBBB',
  'BBBBBBBB',
  'Bbb__o_B',
  'Bbb____B',
  'B______B',
  'B_hth__B',
  'B______B',
  'B_____pB',
  'BBBBDBBB',
], [
  '........',
  '..w.$.w.',
  '........',
  '........',
  '......!.',
  '........',
  '..&&....',
  '.K......',
  '........',
]);
// ---- 物知りの家 x41..48 y31..38
g.stamp(41, 31, [
  'BBBBBBBB',
  'BBBBBBBB',
  'Bkk__b_B',
  'B____b_B',
  'B______B',
  'B______B',
  'B_____oB',
  'BBBDBBBB',
], [
  '........',
  '.[..w.}.',
  '........',
  '..D.....',
  '....n...',
  '.{..rr..',
  '........',
  '........',
]);
// ---- caravan camp x29..39 y30..39 (sand)
g.dec(31, 31, '|'); g.dec(35, 31, '|'); g.dec(38, 32, 'U'); g.dec(37, 31, 'q');
g.set(29, 36, 'o'); g.set(30, 36, 'o'); g.dec(33, 36, 'q'); g.dec(34, 34, '%');
g.dec(37, 37, 'E'); g.dec(31, 38, 'M'); g.dec(39, 38, ')');
g.rect(33, 38, 36, 38, 'F');
// the camel shed (roofed, no way in) and more of the camp
g.rect(36, 34, 39, 35, 'R'); g.rect(36, 36, 39, 36, 'B');
g.dec(37, 36, 'w'); g.dec(29, 31, 'U'); g.dec(33, 31, 'q'); g.dec(30, 39, '|');
g.drect(31, 34, 32, 34, 'r');
// ---- lamps, flowers, signs
for (const [x, y] of [[23, 30], [28, 30], [23, 35], [28, 35], [16, 13], [34, 13], [2, 27], [49, 27]]) g.dec(x, y, '3');
g.set(28, 39, 'm');                   // the town sign
for (const [x, y] of [[13, 13], [36, 13], [21, 29], [30, 29]]) g.dec(x, y, '1');
for (const [x, y] of [[16, 5], [34, 6], [2, 39], [49, 36], [22, 38], [40, 29]]) g.dec(x, y, ')');

if (process.argv[2] === 'print') { g.print(); console.log(JSON.stringify(BASIN)); }
else inject(require('path').join(__dirname, '../../../../src/maps/') + 'region2_kasim.js', 'kasim', g);
