// Draft generator for deep_mine_1..3 (R6). `node draft_mine.js [1|2|3] [--js]` prints the rows/decor
// that are pasted into src/maps/region6_mine.js (python3 ins.py does the pasting). Not game code.
'use strict';
if (typeof require !== 'undefined' && typeof module !== 'undefined') {
  const mk = (W, H) => {
    const T = Array.from({ length: H }, () => Array(W).fill('#'));
    const D = Array.from({ length: H }, () => Array(W).fill('.'));
    const g = {
      W, H, T, D,
      carve(x0, y0, x1, y1, ch = '.') { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) T[y][x] = ch; },
      put(x, y, ch) { T[y][x] = ch; },
      dec(x, y, ch) { D[y][x] = ch; },
      hline(x0, x1, y, ch) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) D[y][x] = ch; },
      vline(x, y0, y1, ch) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) D[y][x] = ch; },
      pts(list, ch) { for (const [x, y] of list) T[y][x] = ch; },
      dpts(list, ch) { for (const [x, y] of list) D[y][x] = ch; },
    };
    return g;
  };
  const floors = {};

  // ================================================================= deep_mine_1 (52×46)
  floors[1] = () => {
    const g = mk(52, 46);
    // mouth + entrance hall
    g.carve(24, 41, 27, 45);
    g.carve(17, 33, 34, 40);
    // main haulage tunnel north (rails) and the junction chamber
    g.carve(24, 21, 27, 32);
    g.carve(18, 13, 33, 20);
    // west gallery: junction → west → the long drift south to the cave-in (miner 1)
    g.carve(8, 15, 17, 17);
    g.carve(5, 15, 8, 30);
    g.carve(5, 30, 14, 32);
    g.carve(12, 32, 14, 38);          // drift south
    g.carve(4, 36, 14, 41);           // the collapsed gallery (miner 1 behind the rubble)
    g.pts([[8, 36], [9, 36], [10, 37], [11, 36], [9, 38], [8, 38], [10, 39]], 'r');
    // side room off the west drift (chest)
    g.carve(1, 20, 4, 25);
    // the ore-sorting room (NW) via the north tunnel
    g.carve(22, 7, 24, 12);
    g.carve(4, 3, 21, 9);
    g.carve(11, 10, 13, 12);          // dead-end niche (chest)
    // east: junction → the pool cavern → north to the stairs
    g.carve(34, 16, 38, 18);
    g.carve(36, 8, 48, 22);
    g.carve(39, 11, 45, 17, '~');     // underground pool
    g.carve(40, 14, 44, 14, '=');     // plank bridge over the pool
    g.carve(44, 3, 49, 7);            // stairs landing
    g.carve(40, 2, 43, 5);            // side niche off the landing (chest)
    // south-east: the lamp room / old store off the entrance hall
    g.carve(35, 35, 44, 38);
    g.carve(41, 27, 48, 38);
    g.carve(44, 23, 46, 26);          // connects up to the pool cavern
    // irregular bites (cave feel)
    g.pts([[17, 33], [34, 33], [17, 40], [18, 13], [33, 13], [36, 8], [48, 8], [48, 22], [4, 3], [21, 3], [4, 9], [41, 27], [48, 27], [48, 38], [4, 41], [4, 36], [14, 41], [36, 22]], '#');
    g.pts([[25, 10], [26, 10], [34, 34], [16, 36], [16, 37]], '.');
    // stairs, warps
    g.put(47, 3, 's');
    // wall torches (on wall cells facing rooms)
    g.pts([[20, 32], [31, 32], [22, 12], [29, 12], [8, 2], [16, 2], [45, 2], [38, 7], [44, 26], [6, 35]], 'i');
    // props (terrain)
    g.pts([[18, 34], [18, 35], [33, 34], [19, 39], [32, 39], [5, 4], [6, 4], [20, 4], [36, 9], [47, 21], [42, 28], [47, 37], [2, 21]], 'o');
    g.pts([[19, 34], [33, 35], [5, 8], [20, 8], [37, 21], [42, 37], [48, 29]], 'j');
    g.pts([[21, 14], [30, 14], [21, 19], [30, 19]], 'l');   // timber posts in the junction
    // rails: mouth → hall → tunnel → junction → west gallery
    g.vline(25, 21, 44, '-');
    g.hline(19, 25, 16, '-');
    g.vline(25, 16, 20, '-');
    g.dec(19, 18, '/'); g.dec(26, 36, '/');
    // decor
    g.dpts([[23, 34], [28, 34], [8, 5], [12, 5], [16, 5], [39, 9], [46, 9], [43, 30], [5, 27]], '@');
    g.dpts([[21, 35], [30, 38], [6, 8], [15, 8], [44, 29], [3, 24]], 'U');
    g.dpts([[22, 38], [29, 35], [13, 7], [46, 33]], 'q');
    g.dpts([[18, 8], [10, 4], [45, 36], [2, 20]], ':');
    return g;
  };

  // ================================================================= deep_mine_2 (54×48)
  floors[2] = () => {
    const g = mk(54, 48);
    // arrival: from_prev (stairs up) in the NW
    g.carve(3, 3, 12, 9);
    g.put(4, 3, 'S');
    // long gallery east with rails
    g.carve(12, 5, 30, 7);
    g.carve(30, 3, 38, 12);           // the crossroads chamber
    // south from crossroads: the flooded drift (miner 2)
    g.carve(33, 12, 35, 20);
    g.carve(28, 20, 44, 27);
    g.carve(30, 22, 36, 25, '~');     // flooded floor
    g.carve(37, 22, 37, 25, '.');
    g.carve(33, 21, 35, 21, '.');
    g.carve(31, 23, 35, 23, '=');     // planks across the water
    g.carve(38, 23, 42, 24);          // miner 2 sits in the dry corner (east)
    // east: crossroads → the rest chamber (mid-floor 休息の灯) → the side tunnel (mid-boss) → Pip
    g.carve(38, 6, 46, 8);
    g.carve(44, 3, 51, 14);           // the lamp chamber (rest)
    g.carve(47, 14, 49, 30);          // the long east drift south
    g.carve(44, 30, 51, 36);          // the rock-eater's chamber
    g.carve(46, 36, 48, 40);          // 奥の横穴 (blocked by the rock eater)
    g.carve(42, 40, 51, 45);          // Pip's pocket
    // west: from the arrival room south — the long switchback to the stairs down
    g.carve(6, 9, 8, 18);
    g.carve(2, 18, 16, 23);           // the old pump room
    g.carve(14, 23, 16, 32);
    g.carve(8, 32, 26, 35);
    g.carve(8, 35, 10, 42);
    g.carve(4, 42, 20, 45);           // the lower drift
    g.put(18, 44, 's');
    // p_rare: the dead-end ore room off the lower drift (§8.12.4: the floor before the boss floor)
    g.carve(22, 38, 27, 44);
    g.carve(20, 43, 21, 44);
    // centre: link the pump room east to the flooded drift (a loop)
    g.carve(16, 20, 28, 21);
    // dead-end drift from the switchback with the secret passage to the rare-monster den
    g.carve(24, 28, 26, 32);
    g.carve(24, 28, 29, 29);
    g.put(30, 28, '%'); g.put(31, 28, '%');          // cracked timber wall (secret passage, 2 cells)
    g.carve(32, 29, 38, 33);                          // the den (rare monsters ×3)
    g.carve(32, 28, 34, 28);
    // side niche with a chest off the crossroads
    g.carve(20, 9, 23, 13);
    g.carve(21, 8, 22, 8);
    // bites
    g.pts([[3, 3], [12, 3], [3, 9], [38, 3], [30, 12], [38, 12], [44, 3], [51, 3], [44, 14], [51, 14], [28, 20], [44, 20], [28, 27], [44, 27], [2, 18], [2, 23], [44, 36], [51, 36], [42, 40], [51, 45], [4, 45], [22, 38], [27, 38], [38, 33]], '#');
    // torches
    g.pts([[7, 2], [34, 2], [48, 2], [36, 19], [20, 17], [10, 31], [46, 29], [12, 41], [25, 37], [45, 39]], 'i');
    // props
    g.pts([[11, 4], [11, 8], [31, 4], [37, 4], [45, 4], [50, 4], [3, 19], [3, 22], [15, 19], [29, 26], [43, 26], [9, 33], [25, 33], [5, 44], [23, 39]], 'o');
    g.pts([[31, 11], [37, 11], [45, 13], [50, 13], [14, 22], [43, 21], [9, 42], [26, 43], [45, 31], [50, 31], [43, 44], [50, 41]], 'j');
    g.pts([[4, 20], [5, 21], [11, 20], [12, 21]], 'r');   // fallen rocks in the pump room
    g.pts([[32, 5], [36, 5], [32, 10], [36, 10]], 'l');
    // rails
    g.hline(5, 34, 6, '-');
    g.vline(34, 6, 21, '-');
    g.hline(15, 34, 34, '-');
    g.vline(9, 34, 43, '-');
    g.hline(9, 17, 43, '-');
    g.dec(14, 43, '/'); g.dec(29, 6, '/');
    // decor
    g.dpts([[5, 4], [9, 8], [21, 12], [46, 12], [49, 42], [5, 19], [16, 34], [25, 30]], '@');
    g.dpts([[33, 9], [12, 19], [45, 5], [44, 42], [19, 32]], 'U');
    g.dpts([[35, 9], [6, 22], [40, 26], [11, 44]], 'q');
    g.dpts([[24, 40], [26, 40], [22, 42], [49, 44], [35, 30], [36, 32], [33, 32]], ':');
    return g;
  };

  // ================================================================= deep_mine_3 七の層 (46×42)
  floors[3] = () => {
    const g = mk(46, 42);
    // arrival from the stairs (south-west)
    g.carve(3, 32, 12, 39);
    g.put(4, 38, 'S');
    // winding approach: east along the bottom, north up the east side, west along the top
    g.carve(12, 35, 30, 37);
    g.carve(28, 28, 34, 37);          // hall of broken carts
    g.carve(34, 30, 41, 32);
    g.carve(39, 18, 42, 31);
    g.carve(24, 18, 42, 21);          // the upper gallery
    g.carve(24, 21, 27, 26);          // dead-end niche (chest)
    // west branch from the arrival room: north to a chest room and back
    g.carve(6, 22, 8, 31);
    g.carve(3, 16, 13, 22);
    // the door of the seventh layer (rock door) at the west end of the upper gallery
    g.carve(18, 19, 23, 20);
    g.put(17, 19, 'O'); g.put(17, 20, 'O');   // 七の層の岩戸 (2 wide)
    // beyond: the antechamber (rest + Fine), then the warden's hall to the north
    g.carve(11, 17, 16, 22);
    g.carve(12, 12, 15, 16);
    g.carve(6, 2, 21, 11);            // the warden's hall
    // bites
    g.pts([[3, 32], [12, 32], [3, 39], [12, 39], [28, 28], [34, 28], [3, 16], [13, 16], [6, 2], [21, 2], [6, 11], [21, 11], [42, 18], [11, 22], [16, 22]], '#');
    g.pts([[7, 3], [8, 3], [19, 3], [20, 3], [7, 10], [20, 10]], 'r');
    // pillars in the hall
    g.pts([[9, 5], [18, 5], [9, 8], [18, 8]], 'l');
    // torches
    g.pts([[7, 31], [20, 34], [31, 27], [33, 17], [5, 15], [11, 1], [16, 1], [14, 16]], 'i');
    // props
    g.pts([[29, 29], [33, 29], [29, 36], [11, 33], [4, 17], [12, 17], [41, 31]], 'o');
    g.pts([[30, 29], [33, 36], [4, 21], [40, 19], [25, 26]], 'j');
    // rails end at the cart hall
    g.hline(13, 30, 36, '-');
    g.vline(31, 29, 36, '-');
    g.dec(31, 29, '/'); g.dec(22, 36, '/');
    g.dpts([[5, 33], [11, 38], [30, 33], [40, 25], [26, 19], [8, 17], [12, 13], [15, 13]], '@');
    g.dpts([[32, 31], [10, 21], [26, 21]], ':');
    return g;
  };

  const n = +(process.argv[2] || 1);
  const g = floors[n]();
  const rows = g.T.map((r) => r.join(''));
  const decor = g.D.map((r) => r.join(''));
  const q = (s) => "      '" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "',";
  if (process.argv.includes('--js')) {
    console.log('    rows: [\n' + rows.map(q).join('\n') + '\n    ],\n    decor: [\n' + decor.map(q).join('\n') + '\n    ],');
  } else {
    console.log('    ' + Array.from({ length: g.W }, (_, i) => (i % 10 ? ' ' : String(i / 10))).join(''));
    console.log('    ' + Array.from({ length: g.W }, (_, i) => String(i % 10)).join(''));
    rows.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + r + '   ' + decor[y]));
  }
}
