// Part anchors of the base sprites (A14a mons-parts, DESIGN §9.4.3): R.Art.MON_ANCHORS[base].
// Pixel coordinates in the base canvas (x right, y down), measured on the zoomed grids of
// tools/sheet_monsters_compose.js --only anchors:
//   head   centre of the head where a crown / hat / helm rim sits (headwear grows upward from here)
//   brow   forehead between the eyes (horns, the third eye)      eyes [[x,y],…] eye centres, picture-left first
//   mouth  centre of the mouth    neck  throat / collar (bells, ribbons)   back  between the shoulders (wings, capes)
//   body   centre of the torso    hand  weapon hand   hand2  off hand (shield, book)   tail  tail tip   feet  ground point
// Extra keys (optional):
//   headW      width of the head at the `head` line (headwear is sized to it)
//   handDir    angle (deg, 0 = right, -90 = up) of a held weapon; default: straight up, leaning outward
//   erase      {hand|hand2|head: [[x0,y0,x1,y1,test], …]} base pixels a part at that anchor clears first
//              (weapon swaps; helmets hiding a crest). test: all wood metal gold red nongreen (on the
//              base's own colours, before the lineage recolour)
//   at         {partId: [x,y]} a different anchor for one part (spots on a mushroom cap, …)
//   float      the base hovers (mist is drawn lower)
// The 14 new bases of monsters_c.js (A14b) publish their own anchors in R.Art.monstersC.anchors; the
// values here override theirs key by key where a part needed it. Bases without any entry (bosses,
// rares) get automatic anchors from their silhouette (R.Art.monAnchors).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const T = {
    // ------------------------------------------------------------ small 32
    jelly: { head: [15, 10], headW: 12, brow: [15, 11], eyes: [[10, 14], [19, 14]], mouth: [15, 18], neck: [15, 18], back: [15, 12], body: [15, 22],
      hand: [4, 21], hand2: [27, 22], tail: [27, 26], feet: [16, 30], handDir: -100, at: { skull_mark: [17, 22] } },
    bat: { head: [16, 7], headW: 8, brow: [16, 9], eyes: [[12, 12], [19, 12]], mouth: [16, 16], neck: [16, 18], back: [16, 10], body: [16, 20],
      hand: [6, 17], hand2: [26, 17], tail: [16, 27], feet: [16, 28] },
    rat: { head: [16, 5], headW: 12, brow: [16, 6], eyes: [[12, 10], [20, 10]], mouth: [16, 18], neck: [16, 20], back: [16, 12], body: [16, 24],
      hand: [11, 21], hand2: [21, 21], tail: [29, 16], feet: [16, 30], handDir: -115 },
    mushroom: { head: [16, 1], headW: 20, brow: [16, 17], eyes: [[12, 20], [20, 20]], mouth: [16, 24], neck: [16, 16], back: [16, 6], body: [16, 24],
      hand: [6, 25], hand2: [26, 25], tail: [16, 24], feet: [16, 30], at: { spots: [16, 7], beard: [16, 25] } },
    bee: { head: [16, 4], headW: 10, brow: [16, 5], eyes: [[12, 8], [20, 8]], mouth: [16, 12], neck: [16, 13], back: [16, 15], body: [16, 24],
      hand: [7, 21], hand2: [25, 21], tail: [16, 30], feet: [16, 30] },
    wisp: { head: [15, 5], headW: 10, brow: [16, 12], eyes: [[13, 16], [20, 16]], mouth: [16, 21], neck: [16, 24], back: [16, 10], body: [16, 20],
      hand: [6, 18], hand2: [26, 18], tail: [16, 24], feet: [16, 30], float: true },
    imp: { head: [16, 6], headW: 12, brow: [16, 8], eyes: [[12, 11], [20, 11]], mouth: [16, 16], neck: [16, 20], back: [16, 12], body: [16, 23],
      hand: [25, 16], hand2: [5, 21], tail: [3, 24], feet: [16, 30] },
    mimic: { head: [16, 6], headW: 18, brow: [16, 8], eyes: [[12, 15], [19, 15]], mouth: [16, 17], neck: [16, 20], back: [16, 5], body: [16, 25],
      hand: [4, 22], hand2: [28, 22], tail: [16, 25], feet: [16, 31] },
    eyeball: { eyeR: 3.6, head: [16, 5], headW: 16, brow: [16, 7], eyes: [[16, 16]], mouth: [16, 21], neck: [16, 22], back: [16, 10], body: [16, 15],
      hand: [6, 26], hand2: [26, 26], tail: [16, 26], feet: [16, 30], float: true },
    // ------------------------------------------------------------ medium 48
    goblin: { head: [25, 9], headW: 14, brow: [23, 11], eyes: [[19, 13], [27, 13]], mouth: [23, 21], neck: [23, 24], back: [23, 20], body: [23, 30],
      hand: [37, 22], hand2: [9, 36], tail: [23, 30], feet: [23, 46], handDir: -72,
      erase: { hand: [[35, 0, 47, 19, 'nongreen']], head: [[17, 0, 34, 9, 'nongreen']] } },
    snake: { head: [16, 4], headW: 14, brow: [16, 6], eyes: [[15, 9]], mouth: [9, 15], neck: [26, 22], back: [24, 12], body: [26, 40],
      hand: [26, 40], hand2: [26, 40], tail: [45, 36], feet: [26, 46] },
    wolf: { head: [17, 12], headW: 10, brow: [14, 14], eyes: [[9, 15], [17, 15]], mouth: [7, 24], neck: [24, 21], back: [32, 17], body: [28, 28],
      hand: [15, 40], hand2: [33, 40], tail: [41, 8], feet: [24, 46] },
    plant: { head: [24, 4], headW: 16, brow: [24, 8], eyes: [[20, 8], [27, 8]], mouth: [24, 17], neck: [24, 27], back: [24, 12], body: [24, 34],
      hand: [6, 37], hand2: [42, 36], tail: [24, 34], feet: [24, 46] },
    skeleton: { collar: false, head: [24, 5], headW: 16, brow: [24, 6], eyes: [[21, 9], [28, 9]], mouth: [24, 15], neck: [24, 19], back: [24, 20], body: [24, 27],
      hand: [10, 24], hand2: [34, 30], tail: [24, 27], feet: [24, 46], handDir: -95,
      erase: { hand: [[3, 0, 13, 21, 'all'], [3, 21, 8, 24, 'all']] } },
    ghost: { head: [24, 7], headW: 12, brow: [24, 11], eyes: [[21, 16], [27, 16]], mouth: [24, 20], neck: [24, 26], back: [24, 14], body: [24, 28],
      hand: [5, 26], hand2: [43, 26], tail: [42, 40], feet: [34, 44], float: true },
    lizardman: { head: [24, 6], headW: 14, brow: [23, 8], eyes: [[19, 11], [27, 11]], mouth: [24, 20], neck: [24, 23], back: [24, 22], body: [24, 30],
      hand: [9, 28], hand2: [37, 29], tail: [45, 33], feet: [24, 46], handDir: -95,
      erase: { hand: [[2, 3, 12, 27, 'metal']], head: [[19, 0, 28, 5, 'red']] } },
    scorpion: { head: [24, 36], headW: 12, brow: [24, 37], eyes: [[21, 39], [27, 39]], mouth: [24, 42], neck: [24, 34], back: [24, 30], body: [24, 33],
      hand: [9, 21], hand2: [42, 21], tail: [37, 14], feet: [24, 46] },
    mummy: { head: [25, 6], headW: 14, brow: [25, 8], eyes: [[22, 11], [29, 11]], mouth: [25, 16], neck: [26, 20], back: [26, 18], body: [27, 28],
      hand: [41, 37], hand2: [10, 7], tail: [27, 28], feet: [26, 46], handDir: -80 },
    crab: { head: [24, 6], headW: 14, brow: [24, 8], eyes: [[19, 11], [28, 11]], mouth: [24, 37], neck: [24, 36], back: [24, 20], body: [24, 28],
      hand: [6, 12], hand2: [42, 12], tail: [24, 28], feet: [24, 46] },
    merman: { head: [24, 4], headW: 14, brow: [24, 5], eyes: [[17, 8], [31, 8]], mouth: [24, 17], neck: [24, 20], back: [24, 18], body: [25, 32],
      hand: [9, 21], hand2: [38, 34], tail: [44, 38], feet: [26, 46], handDir: -90,
      erase: { hand: [[1, 0, 13, 47, 'gold']], head: [[16, 0, 31, 3, 'red']] } },
    darkmage: { head: [25, 5], headW: 14, brow: [25, 9], eyes: [[20, 13], [27, 13]], mouth: [24, 17], neck: [25, 22], back: [25, 20], body: [25, 32],
      hand: [9, 31], hand2: [39, 28], tail: [25, 32], feet: [25, 46], handDir: -90,
      erase: { hand: [[2, 0, 14, 9, 'all'], [5, 10, 11, 47, 'wood']] } },
    armor: { collar: false, head: [24, 4], headW: 14, brow: [24, 6], eyes: [[22, 11], [26, 11]], mouth: [24, 15], neck: [24, 20], back: [24, 18], body: [24, 28],
      hand: [11, 22], hand2: [36, 24], tail: [24, 28], feet: [24, 46], handDir: -90,
      erase: { hand: [[7, 0, 13, 19, 'metal']], head: [[23, 0, 40, 8, 'red']] } },
    gargoyle: { head: [24, 8], headW: 12, brow: [24, 10], eyes: [[21, 12], [26, 12]], mouth: [24, 17], neck: [24, 20], back: [24, 14], body: [24, 28],
      hand: [17, 34], hand2: [31, 34], tail: [41, 42], feet: [24, 46] },
    salamander: { head: [24, 17], headW: 22, brow: [24, 19], eyes: [[16, 20], [32, 20]], mouth: [24, 29], neck: [24, 33], back: [24, 24], body: [24, 38],
      hand: [8, 40], hand2: [40, 40], tail: [42, 12], feet: [24, 46] },
    cactus: { head: [23, 8], headW: 14, brow: [24, 15], eyes: [[19, 19], [28, 19]], mouth: [24, 25], neck: [24, 28], back: [24, 18], body: [24, 34],
      hand: [8, 14], hand2: [41, 24], tail: [24, 34], feet: [24, 46], at: { flower: [15, 10], beard: [24, 23] },
      erase: { head: [[21, 0, 37, 13, 'nongreen']] } },
    frostling: { head: [24, 6], headW: 18, brow: [24, 9], eyes: [[18, 13], [29, 13]], mouth: [24, 21], neck: [24, 24], back: [24, 18], body: [24, 29],
      hand: [38, 21], hand2: [9, 36], tail: [24, 29], feet: [24, 46], handDir: -80,
      erase: { hand: [[35, 8, 44, 17, 'all']] } },
    // ------------------------------------------------------------ large 64
    orc: { head: [32, 8], headW: 16, brow: [32, 11], eyes: [[27, 13], [37, 13]], mouth: [32, 23], neck: [32, 29], back: [32, 26], body: [32, 36],
      hand: [50, 29], hand2: [9, 46], tail: [32, 36], feet: [32, 62], handDir: -78, tusks: [[27, 21], [37, 21]],
      erase: { hand: [[45, 0, 63, 27, 'nongreen']], head: [[23, 0, 41, 7, 'all']] } },
    golem: { head: [32, 7], headW: 14, brow: [32, 9], eyes: [[29, 12], [35, 12]], mouth: [32, 16], neck: [32, 19], back: [32, 20], body: [32, 27],
      hand: [9, 52], hand2: [55, 52], tail: [32, 27], feet: [32, 62] },
    wyvern: { head: [32, 7], headW: 14, brow: [32, 8], eyes: [[27, 11], [37, 11]], mouth: [32, 21], neck: [32, 30], back: [32, 26], body: [32, 44],
      hand: [22, 44], hand2: [42, 44], tail: [60, 52], feet: [32, 62] },
    chimera: { head: [32, 15], headW: 18, brow: [32, 18], eyes: [[27, 23], [36, 23]], mouth: [32, 32], neck: [32, 38], back: [32, 20], body: [32, 46],
      hand: [14, 58], hand2: [50, 58], tail: [8, 28], feet: [32, 62] },
    yeti: { head: [32, 8], headW: 14, brow: [32, 13], eyes: [[29, 17], [35, 17]], mouth: [32, 24], neck: [32, 31], back: [32, 28], body: [32, 42],
      hand: [9, 5], hand2: [55, 5], tail: [32, 42], feet: [32, 62] },
    kraken: { head: [32, 4], headW: 18, brow: [32, 27], eyes: [[24, 31], [39, 31]], mouth: [32, 41], neck: [32, 36], back: [32, 12], body: [32, 38],
      hand: [4, 40], hand2: [60, 40], tail: [32, 38], feet: [32, 60] },
    demon: { head: [32, 7], headW: 14, brow: [32, 10], eyes: [[29, 13], [35, 13]], mouth: [32, 19], neck: [32, 24], back: [32, 20], body: [32, 32],
      hand: [10, 28], hand2: [50, 36], tail: [56, 52], feet: [32, 62], handDir: -90,
      erase: { hand: [[3, 0, 17, 15, 'metal'], [6, 15, 11, 63, 'metal']] } },
    sandworm: { head: [33, 2], headW: 10, brow: [33, 9], eyes: [[28, 17], [38, 17]], mouth: [33, 21], neck: [26, 36], back: [30, 30], body: [24, 44],
      hand: [24, 44], hand2: [24, 44], tail: [10, 42], feet: [32, 62] },
  };
  // the 14 bases of monsters_c.js: only the keys that differ from R.Art.monstersC.anchors (merged at compose time)
  Object.assign(T, {
    mammoth: { tuskTips: [[9, 42], [54, 42]], at: { armor_plates: [31, 19, 0.22, 0.1] } },
    beetle: { at: { horns: [15, 5] } },
    frog: { at: { spots: [23, 24, 0.36, 0.18] } },
    mole: { clawAt: [[8, 22], [39, 22]], clawDir: -90 },
    automaton: { collar: false },
    owl: { eyeR: 3 },
    book: { eyeR: 2 },
    scribe: { erase: { hand: [[3, 7, 10, 26, 'all']], hand2: [[30, 27, 42, 41, 'wood']] } },
  });
  const AN = (A.MON_ANCHORS = A.MON_ANCHORS || {});
  for (const id in T) AN[id] = Object.assign({}, AN[id] || {}, T[id]);
})(window.RPG);
