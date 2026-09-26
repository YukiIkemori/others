// 水辺の町ロッホ (loch) — 56×44 layout (tiles + decor). Node-only; see lib/sync.js.
'use strict';
const { Grid } = require('./grid');

module.exports = function loch() {
  const W = 56, H = 44;
  const T = new Grid(W, H, '~');
  const D = new Grid(W, H, '.');

  // ---- land, shores
  T.rect(7, 3, 45, 38, ',');
  T.pts([[9, 3], [10, 3], [11, 3], [30, 3], [31, 3], [32, 3], [51, 5], [51, 6], [51, 7], [51, 33], [51, 34], [50, 39], [51, 39], [51, 38]], 'z');
  T.pts([[51, 3], [51, 4], [50, 3], [51, 40], [51, 36], [51, 37]], '~');
  // ---- boardwalks
  T.rect(7, 3, 2, 38, '.');          // west quay
  T.rect(7, 13, 45, 3, '.');         // main street
  T.rect(7, 16, 2, 1, '.');          // quay
  T.rect(13, 16, 4, 1, '.');         // market ← street
  T.rect(28, 16, 2, 1, '.');         // plaza ← street
  T.rect(40, 16, 2, 1, '.');         // east lane ← street
  T.rect(48, 16, 4, 1, '.');         // east gate yard
  T.rect(7, 31, 42, 2, '.');         // south street
  T.rect(7, 40, 44, 1, '.');         // south shore walk
  T.rect(9, 17, 12, 4, '.');         // market
  T.rect(25, 17, 8, 4, '.');         // plaza square (the rest of the plaza is lawn)
  T.rect(40, 17, 2, 4, '.');         // east lane to the bridge
  T.rect(7, 23, 36, 1, '.');         // canal bank (south)
  T.rect(18, 24, 2, 7, '.');         // lane item shop | smithy
  T.rect(33, 24, 2, 7, '.');         // lane smithy | Emma
  T.rect(17, 33, 2, 7, '.');         // lane house A | house B
  T.rect(34, 33, 1, 7, '.');         // lane yard | house C
  // ---- water: canal, pond, piers, bridges
  T.rect(0, 21, 45, 2, '~');
  T.rect(43, 19, 4, 5, '~');
  T.rect(47, 20, 1, 3, 'z');
  T.rect(0, 14, 7, 2, '=');          // ferry pier
  T.rect(2, 27, 5, 1, '=');
  T.rect(2, 36, 5, 1, '=');
  T.rect(52, 14, 4, 2, '=');         // east gate bridge
  for (const x of [7, 13, 28, 40]) T.rect(x, 21, 2, 2, '|');
  T.rect(51, 24, 1, 5, '~');         // boat notch

  // ---- buildings (roofless interiors, DESIGN §10.6.1)
  T.stamp(9, 4, [                    // 宿屋 (inn) x9..21
    'BBBBBBBBBBBBB',
    'BBBBBBBBBBBBB',
    'Bb_b______kuB',
    'Bb_b__ccc___B',
    'B___________B',
    'Bb_b_____ht_B',
    'Bb_b_______oB',
    'B___________B',
    'BBBBBBDBBBBBB',
  ]);
  T.stamp(24, 4, [                   // 酒場 (tavern) x24..37
    'BBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBB',
    'Bo__o________B',
    'Bccccc_______B',
    'B____________B',
    'B_hth___ht___B',
    'B____________B',
    'Bo_____hto__oB',
    'BBBBBBDBBBBBBB',
  ]);
  T.stamp(41, 3, [                   // 鐘楼 (bell tower) x41..47
    '#######',
    '#######',
    '#_____#',
    '#_____#',
    '#_____#',
    '#_____#',
    '#o___j#',
    '###D###',
  ]);
  T.stamp(9, 24, [                   // 道具屋 x9..17
    'BBBBBBBBB',
    'BBBBBBBBB',
    'Bu_____uB',
    'B__ccc__B',
    'B_______B',
    'Bpo_____B',
    'BBBBDBBBB',
  ]);
  T.stamp(20, 24, [                  // 武器と防具の店 x20..32
    'BBBBBBBBBBBBB',
    'BBBBBBBBBBBBB',
    'B___________B',
    'B_ccc___ccc_B',
    'B___________B',
    'B___________B',
    'BBBBBBDBBBBBB',
  ]);
  T.stamp(35, 24, [                  // エマの家 x35..42
    'BBBBBBBB',
    'BBBBBBBB',
    'Bb_____B',
    'Bb_____B',
    'B___th_B',
    'B______B',
    'BBBDBBBB',
  ]);
  T.stamp(46, 24, [                  // 舟小屋 (boat shed, closed)
    'RRRRR',
    'RRRRR',
    'RRRRR',
    'BBBBB',
  ]);
  T.stamp(9, 33, [                   // 漁師の家 x9..16
    'BBBBBBBB',
    'BBBBBBBB',
    'Bb____uB',
    'Bb_____B',
    'B__hth_B',
    'B_____oB',
    'BBBDBBBB',
  ]);
  T.stamp(19, 33, [                  // 機織りの家 x19..27
    'BBBBBBBBB',
    'BBBBBBBBB',
    'B_____kbB',
    'B______bB',
    'Bth_____B',
    'B_______B',
    'BBBBDBBBB',
  ]);
  T.stamp(35, 33, [                  // 年寄りの家 x35..42
    'BBBBBBBB',
    'BBBBBBBB',
    'Bk__u_bB',
    'B_____bB',
    'B_ht___B',
    'B______B',
    'BBBDBBBB',
  ]);
  // ---- town furniture on tiles
  T.set(23, 18, 'W');                // well (on the lawn)
  T.set(28, 18, 'Y');                // メルダの像
  T.set(47, 35, 'Y');                // 七つの鐘の碑
  T.pts([[18, 17], [19, 17], [8, 19]], 'o');
  T.pts([[16, 20], [36, 20]], 'j');
  T.set(7, 12, 'm');                 // 定期船乗り場の看板
  // trees / flowers
  T.pts([[22, 5], [23, 9], [39, 4], [49, 4], [51, 9], [48, 10], [50, 12], [44, 18], [49, 19], [21, 17], [36, 20], [45, 30], [50, 31], [44, 37], [49, 38], [29, 38], [38, 17]], 'T');
  T.pts([[22, 20], [23, 17], [34, 20], [35, 18], [33, 17], [24, 16], [37, 16], [38, 18], [39, 20], [42, 17], [43, 16], [45, 16], [50, 17], [51, 18], [18, 16], [11, 16], [22, 11], [23, 11], [39, 9], [40, 9], [46, 35], [48, 35], [46, 36], [48, 36], [13, 3], [26, 3], [27, 3], [37, 3]], 'f');

  // ---- decor
  // inn
  D.pts([[11, 5], [19, 5]], 'w'); D.set(13, 5, 'p'); D.set(17, 5, 'k');
  D.rect(13, 9, 2, 2, 'r'); D.set(20, 11, 'Z');
  // tavern
  D.pts([[26, 5], [28, 5]], 'H'); D.pts([[31, 5], [35, 5]], 'w'); D.set(33, 5, 'p');
  D.rect(34, 6, 3, 2, '0'); D.set(36, 9, 'N');
  // bell tower
  D.pts([[43, 4], [45, 4]], 'w'); D.set(46, 5, '@'); D.set(42, 8, ',');
  // item shop
  D.set(11, 25, '$'); D.set(14, 25, 'w'); D.set(16, 25, 'k'); D.set(15, 28, '&'); D.set(16, 29, 'Z');
  // smithy
  D.set(22, 25, 'x'); D.set(24, 25, 'w'); D.set(26, 25, 'c'); D.set(28, 25, 'w'); D.set(30, 25, 'x');
  D.pts([[21, 26], [21, 29]], 'X'); D.pts([[31, 26], [31, 29]], 'Y'); D.rect(25, 27, 3, 2, 'r');
  // Emma
  D.set(37, 25, 'w'); D.set(39, 25, 'p'); D.set(41, 25, '$');
  D.set(37, 26, '-'); D.set(41, 26, 'K'); D.set(41, 29, 'y'); D.set(37, 29, '&');
  // house A (fisher)
  D.set(11, 34, 'w'); D.set(13, 34, '['); D.set(15, 34, 'w'); 
  // house B (weaver)
  D.set(21, 34, 'w'); D.set(23, 34, 't'); D.set(25, 34, 'w');
  D.set(20, 35, '!'); D.set(22, 35, '?'); D.set(24, 38, '&');
  // house C (old man)
  D.set(37, 34, 'w'); D.set(39, 34, 'P'); D.set(41, 34, 'w'); D.set(41, 38, 'V');
  // outside: signs, lamps, stalls, boats, nets, laundry
  D.set(11, 13, '7'); D.set(28, 13, 'j'); D.set(12, 31, '4'); D.set(24, 31, '5'); D.set(28, 31, '6');
  D.pts([[10, 16], [21, 16], [36, 16], [46, 16], [21, 20], [16, 31], [32, 31], [44, 31]], '3');
  D.rect(10, 18, 3, 1, '9'); D.set(16, 17, 'U'); D.set(17, 19, 'q');
  D.pts([[27, 19], [29, 19]], '1'); D.pts([[31, 20], [32, 20]], 'e'); D.pts([[21, 19], [35, 17], [36, 19]], 'h');
  D.pts([[4, 13], [1, 16], [5, 28], [3, 35], [11, 22], [34, 21], [44, 20], [51, 26]], '|'); // boats (map legend)
  D.pts([[23, 12], [7, 29]], 'N'); D.pts([[8, 7], [8, 26], [7, 38]], ','); D.pts([[8, 4]], 'U');
  D.pts([[45, 29], [47, 29], [49, 29]], ':');            // net racks
  D.pts([[29, 35], [32, 35]], '('); D.set(31, 37, '/'); D.set(33, 38, '%');   // laundry, washtub, firewood
  D.pts([[45, 33], [49, 33], [42, 13]], 'h'); D.pts([[22, 7], [38, 11]], 'h');
  D.pts([[36, 21]], '.');
  return { T, D, W, H, decorLegend: { '|': 'boat', ':': 'net_rack', ',': 'rope_coil', '/': 'washtub', '-': 'cradle' } };
};
