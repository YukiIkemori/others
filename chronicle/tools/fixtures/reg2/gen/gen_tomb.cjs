'use strict';
const { Grid, inject } = require('./paint.cjs');
const FILE = require('path').join(__dirname, '../../../../src/maps/') + 'region2_tomb.js';
const out = {};
const room = (g, x0, y0, x1, y1, ch) => g.rect(x0, y0, x1, y1, ch || '.');
const torches = (g, list) => list.forEach(([x, y]) => g.set(x, y, 'i'));
const sprinkle = (g, list, ch) => list.forEach(([x, y]) => g.set(x, y, ch));
const decs = (g, list, ch) => list.forEach(([x, y]) => g.dec(x, y, ch));

// ===================================================================== 1F (44×36)
{
  const g = new Grid(44, 36, '#', '.');
  // A courtyard (outdoor sand, sunken) + façade opening
  room(g, 17, 31, 26, 35, 'd');
  room(g, 21, 30, 22, 30, '.');
  g.set(21, 35, 'S'); g.set(22, 35, 'S');   // steps up to the desert
  g.set(19, 32, 'm');                         // the tomb's stele
  torches(g, [[19, 30], [24, 30]]);
  // B entrance hall
  room(g, 15, 20, 28, 29);
  sprinkle(g, [[17, 22], [17, 26], [26, 22], [26, 26]], 'l');
  sprinkle(g, [[15, 29], [28, 29], [15, 20], [28, 20]], 'p');
  torches(g, [[18, 19], [25, 19]]);
  // C corridor hall → D
  room(g, 21, 15, 22, 19);
  // D offering room
  room(g, 16, 7, 27, 14);
  sprinkle(g, [[21, 8], [22, 8]], 'a');
  sprinkle(g, [[16, 7], [27, 7], [16, 14], [27, 14]], 'p');
  sprinkle(g, [[18, 10], [25, 10], [18, 13], [25, 13]], 'l');
  torches(g, [[19, 6], [24, 6]]);
  // D → E (west) corridor, E statue chamber
  room(g, 11, 11, 15, 11);
  room(g, 2, 3, 10, 12);
  room(g, 10, 11, 10, 11);
  sprinkle(g, [[3, 3], [9, 3]], 'p');
  sprinkle(g, [[2, 6], [2, 8], [10, 6], [10, 8]], 'A');
  torches(g, [[4, 2], [8, 2]]);
  // E → F corridor, F west gallery
  room(g, 5, 13, 6, 16);
  room(g, 2, 17, 11, 30);
  sprinkle(g, [[4, 19], [7, 19], [4, 22], [7, 22], [4, 25], [7, 25]], 'A');
  sprinkle(g, [[10, 18], [11, 29], [2, 24]], 'p');
  torches(g, [[3, 16], [9, 16]]);
  // F → hall corridor (hall west wall gap)
  room(g, 12, 26, 14, 26);
  // D → G (east) corridor, G treasury
  room(g, 28, 10, 31, 10);
  room(g, 32, 2, 42, 10);
  sprinkle(g, [[34, 4], [34, 8], [40, 4], [40, 8]], 'l');
  sprinkle(g, [[42, 2], [32, 2], [42, 10]], 'p');
  torches(g, [[35, 1], [39, 1]]);
  // G → H corridor, H stairs chamber
  room(g, 38, 11, 39, 16);
  room(g, 32, 17, 42, 30);
  sprinkle(g, [[35, 20], [39, 20], [35, 24], [39, 24]], 'l');
  sprinkle(g, [[33, 27], [33, 29], [36, 29]], 'A');
  sprinkle(g, [[32, 17], [42, 17], [32, 30]], 'p');
  g.set(41, 29, 's');
  torches(g, [[34, 16], [41, 16]]);
  // decor
  decs(g, [[16, 20], [27, 20], [3, 17], [11, 17], [33, 2], [2, 3], [42, 17]], '@');
  decs(g, [[19, 24], [24, 24], [21, 12], [6, 27], [37, 26], [36, 6]], 'z');
  decs(g, [[21, 6], [22, 6]], 'c');
  decs(g, [[6, 2]], 'c');
  decs(g, [[17, 31], [26, 31], [17, 35], [26, 35]], ')');
   decs(g, [[4, 4], [8, 4]], 'Q');
  g.drect(21, 9, 22, 13, 'r');   // the offering room's runner
  g.drect(21, 20, 22, 29, 'r');   // the entrance hall's runner
  decs(g, [[19, 21], [24, 21], [19, 28], [24, 28]], 'Q');
  out.sand_tomb_1 = g;
}

// ===================================================================== 2F (46×40)
{
  const g = new Grid(46, 40, '#', '.');
  // A arrival room (stairs up)
  room(g, 2, 2, 12, 9);
  g.set(3, 2, 'S');
  sprinkle(g, [[12, 2], [2, 9], [12, 9]], 'p');
  sprinkle(g, [[6, 5], [9, 5]], 'l');
  torches(g, [[6, 1], [10, 1]]);
  // A → R corridor (y 5) and R rest room
  room(g, 13, 5, 19, 5);
  room(g, 20, 2, 27, 8);
  sprinkle(g, [[20, 2], [27, 2]], 'p');
  torches(g, [[22, 1], [25, 1]]);
  // R → east dead end (secret) corridor
  room(g, 28, 5, 39, 5);
  room(g, 39, 3, 39, 7);           // an innocent-looking niche at the end
  g.set(40, 5, '%');               // secret wall
  room(g, 41, 3, 44, 7);           // the hidden alcove
  sprinkle(g, [[44, 3], [44, 7]], 'p');
  // R → W corridor (north entrance of the worm's hall)
  room(g, 23, 9, 24, 12);
  // W the worm's hall (sand floor)
  room(g, 14, 13, 33, 26, 'd');
  sprinkle(g, [[16, 15], [31, 15], [16, 24], [31, 24]], 'l');
  sprinkle(g, [[14, 13], [33, 13], [14, 26], [33, 26]], 'p');
  torches(g, [[18, 12], [29, 12]]);
  // West wing: A → west graves
  room(g, 5, 10, 6, 12);
  room(g, 2, 13, 11, 24);
  sprinkle(g, [[3, 15], [3, 18], [3, 21], [10, 15], [10, 18], [10, 21]], 'A');
  sprinkle(g, [[6, 16], [6, 20]], 'l');
  sprinkle(g, [[2, 24], [11, 13]], 'p');
  // west wing → worm hall side door (so the hall has 2 ways in)
  room(g, 12, 19, 13, 19);
  // South of the quicksand: corridor (quicksand y 27..29) → junction
  room(g, 22, 27, 25, 31, 'd');
  room(g, 12, 32, 35, 33);
  // S2 statue room (west)
  room(g, 3, 28, 11, 37);
  room(g, 11, 32, 11, 33);
  sprinkle(g, [[3, 28], [11, 28], [3, 37], [11, 37]], 'p');
  sprinkle(g, [[4, 31], [4, 34], [10, 31], [10, 34]], 'l');
  // X stairs down room (east)
  room(g, 36, 28, 43, 37);
  room(g, 36, 32, 36, 33);
  sprinkle(g, [[38, 30], [41, 30], [38, 35]], 'l');
  sprinkle(g, [[43, 28], [36, 37]], 'p');
  g.set(42, 36, 's');
  torches(g, [[38, 27], [41, 27]]);
  // corridor junction flavour
  // decor
  decs(g, [[2, 2], [12, 13], [2, 13], [43, 3], [36, 28]], '@');
  decs(g, [[33, 5], [8, 7], [22, 5], [17, 32], [40, 33]], 'z');
  decs(g, [[16, 1], [24, 1]], 'c');
   decs(g, [[5, 29], [9, 29]], 'Q');
  decs(g, [[7, 32], [7, 33], [23, 5], [24, 5]], 'o');
  out.sand_tomb_2 = g;
}

// ===================================================================== 3F (40×34) boss floor
{
  const g = new Grid(40, 34, '#', '.');
  // arrival landing (stairs up at the bottom)
  room(g, 16, 28, 23, 32);
  g.set(19, 32, 'S');
  sprinkle(g, [[16, 28], [23, 28]], 'p');
  torches(g, [[17, 27], [22, 27]]);
  // central hall
  room(g, 13, 21, 26, 27);
  sprinkle(g, [[15, 23], [24, 23], [15, 26], [24, 26]], 'l');
  sprinkle(g, [[13, 21], [26, 21]], 'p');
  // west: S3 statue room
  room(g, 3, 18, 10, 28);
  room(g, 11, 24, 12, 24);
  sprinkle(g, [[3, 18], [10, 18], [3, 28]], 'p');
  sprinkle(g, [[3, 22], [3, 25], [10, 27]], 'A');
  torches(g, [[5, 17], [8, 17]]);
  // east: side crypt
  room(g, 29, 18, 36, 28);
  room(g, 27, 24, 28, 24);
  sprinkle(g, [[31, 20], [34, 20], [31, 23], [34, 23], [31, 26], [34, 26]], 'A');
  sprinkle(g, [[36, 18], [29, 28]], 'p');
  torches(g, [[31, 17], [34, 17]]);
  // antechamber (rest + fine) north of the hall
  room(g, 19, 20, 20, 20);
  room(g, 14, 12, 25, 19);
  sprinkle(g, [[14, 12], [25, 12], [14, 19], [25, 19]], 'p');
  sprinkle(g, [[16, 14], [23, 14], [16, 17], [23, 17]], 'l');
  torches(g, [[17, 11], [22, 11]]);
  // the royal door (closed until the three letters, tilePatch)
  g.set(19, 11, 'O'); g.set(20, 11, 'O');
  // royal burial chamber
  room(g, 10, 2, 29, 10);
  sprinkle(g, [[12, 4], [12, 8], [27, 4], [27, 8], [15, 3], [24, 3]], 'l');
  sprinkle(g, [[19, 2], [20, 2]], 'a');
  sprinkle(g, [[10, 2], [29, 2], [10, 10], [29, 10]], 'p');
  torches(g, [[13, 1], [17, 1], [22, 1], [26, 1]]);
  // decor
  decs(g, [[3, 18], [36, 18], [10, 2], [29, 2]], '@');
  decs(g, [[18, 24], [21, 25], [6, 22], [32, 25], [19, 16], [15, 6], [24, 7]], 'z');
  decs(g, [[19, 1], [20, 1]], 'c');
  decs(g, [[18, 4], [21, 4]], 'Q');
   decs(g, [[4, 18], [8, 18]], 'Q');
  g.drect(19, 3, 20, 10, 'R');   // the royal runner
  g.drect(18, 22, 21, 25, 'o');
  out.sand_tomb_3 = g;
}

if (process.argv[2] === 'print') { for (const [k, g] of Object.entries(out)) { console.log('== ' + k); g.print(); } }
else for (const [k, g] of Object.entries(out)) inject(FILE, k, g);
