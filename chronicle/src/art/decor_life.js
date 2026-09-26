// Chronicle interior decor (DESIGN §11.2.10): the props that make homes, taverns,
// libraries and studies lived-in at SFC DQ5 density — bar shelves and kegs, a
// small stage, looms and spinning wheels, drying herbs, firewood, round rugs,
// lecterns, piles of books, scroll racks, wall maps, cradles, wash tubs, an old
// piano, a shelf of dolls, a broken chair, a telescope and an armillary sphere.
// Built with the decor kit of decor_interior.js (A.DecorKit, looked up lazily:
// this file sorts after it, but only factories touch it). Light from the top-left,
// contact shadows and drop shadows as translucent alpha, like every decor piece.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  A.decorAuto = A.decorAuto || {};
  const K = () => A.DecorKit;
  const tk = () => A.TK;
  /** build a piece and return its canvas */
  const mk = (w, h, draw, o) => K().piece(w, h, draw, o).canvas();

  // ------------------------------------------------------------ wall pieces
  /** two shelves of bottles, jugs and mugs behind the bar */
  function barShelf() {
    const { WOOD, GLASS, CLAY, GREEN, RED, GOLD, CLOTH } = K().P;
    return mk(16, 16, (L, t) => {
      const bottle = (x, y, P, tall) => {
        const h = tall ? 5 : 4;
        L.rect(x, y - h + 1, 2, h, P[2]); L.set(x, y - h + 1, P[4]); L.set(x, y - h + 2, P[3]);
        L.set(x, y - h, P[1]); L.set(x + 1, y - h, P[1]); L.set(x, y - h - 1, 0xc8b088); // neck + cork
        L.set(x + 1, y, P[1]);
      };
      // upper shelf
      bottle(2, 6, GREEN, true); bottle(5, 6, [0, 0x5a1420, 0x8c2030, 0xb84050, 0xe07080], true);
      bottle(8, 6, [0, GLASS[1], GLASS[2], GLASS[3], GLASS[4]], false);
      L.rect(11, 3, 3, 4, CLAY[3]); L.set(11, 3, CLAY[4]); L.set(13, 6, CLAY[2]); L.hline(11, 13, 2, CLAY[2]); L.set(14, 4, CLAY[2]);
      L.hline(0, 15, 7, WOOD[5]); L.hline(0, 15, 8, WOOD[2]);
      // lower shelf: mugs and a squat amber bottle
      for (const x of [1, 5]) { L.rect(x, 11, 3, 3, CLOTH[3]); L.set(x, 11, CLOTH[4]); L.set(x + 2, 13, CLOTH[1]); L.set(x + 3, 12, CLOTH[2]); }
      L.rect(9, 10, 3, 4, [0x8c5a14][0]); L.set(9, 10, GOLD[4]); L.set(10, 11, GOLD[3]); L.set(10, 9, GOLD[1]); L.set(10, 8, 0xc8b088);
      bottle(13, 13, [0, 0x3c2448, 0x5c3a6c, 0x7c5490, 0xa878c0], false);
      L.hline(0, 15, 14, WOOD[5]); L.hline(0, 15, 15, WOOD[2]);
      for (const x of [2, 13]) { L.set(x, 9, WOOD[1]); }
    }, { drop: [1, 1, 0.3] });
  }

  /** three bundles of herbs drying from a peg rail */
  function herbsHang() {
    const { WOOD } = K().P;
    return mk(16, 16, (L, t) => {
      L.hline(1, 14, 2, WOOD[4]); L.hline(1, 14, 3, WOOD[2]);
      for (const x of [2, 13]) { L.set(x, 1, WOOD[5]); L.set(x, 4, WOOD[1]); }
      const bundle = (cx, P, len) => {
        L.set(cx, 4, 0xc8b088); L.set(cx, 5, 0xa89060); // twine
        L.hline(cx - 1, cx + 1, 6, 0xb49c6c);
        for (let y = 7; y < 7 + len; y++) {
          const w = Math.min(2, 1 + ((y - 7) >> 1));
          for (let x = cx - w; x <= cx + w; x++) {
            const c = x < cx ? P[2] : x > cx ? P[0] : P[1];
            if ((x + y) % 3 === 0 && y > 8) continue;
            L.set(x, y, c);
          }
        }
        L.set(cx - 1, 7 + len, P[0]); L.set(cx + 1, 6 + len, P[1]);
      };
      bundle(4, [0x2c4a1c, 0x44682a, 0x62883a], 7);
      bundle(8, [0x4a3c5a, 0x6c5a84, 0x9a86b4], 6); // lavender
      bundle(12, [0x5a5a24, 0x7c7c34, 0xa0a048], 8); // dry grass-yellow
      L.set(8, 12, 0xc8b8e0); L.set(7, 10, 0xc8b8e0);
    }, { drop: [1, 1, 0.3] });
  }

  /** a lattice rack of rolled scrolls */
  function scrollRack() {
    const { WOOD, CREAM, RED } = K().P;
    return mk(16, 16, (L, t) => {
      L.rect(1, 2, 14, 12, WOOD[1]);
      for (let y = 2; y <= 13; y++) for (let x = 1; x <= 14; x++) {
        const gx = (x - 1) % 4 === 0 || x === 14, gy = (y - 2) % 4 === 0 || y === 13;
        if (gx || gy) L.set(x, y, gy && !gx ? WOOD[4] : gx && !gy ? WOOD[3] : WOOD[5]);
      }
      // scroll ends in the cells (roll, a dark core, a red tie on some)
      for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
        if (t.hash(cx, cy, 901) < 0.12) continue;
        const x0 = 2 + cx * 4, y0 = 3 + cy * 4;
        L.set(x0, y0, CREAM[4]); L.set(x0 + 1, y0, CREAM[3]); L.set(x0, y0 + 1, CREAM[3]); L.set(x0 + 1, y0 + 1, CREAM[1]);
        if (t.hash(cx, cy, 903) < 0.5) { L.set(x0 + 2, y0, CREAM[4]); L.set(x0 + 2, y0 + 1, CREAM[2]); }
        L.set(x0 + 1, y0 + 1, 0x8c7850);
        if (t.hash(cx, cy, 905) < 0.35) L.set(x0, y0 + 2, RED[3]);
      }
    }, { drop: [1, 1, 0.32] });
  }

  /** a brown paper map of the coast pinned to the wall, marked in red */
  function mapWall() {
    const { WOOD, RED } = K().P;
    return mk(16, 16, (L, t) => {
      const PA = [0x8c7448, 0xb49a68, 0xd0b884, 0xe4d09e, 0xf0e2b8];
      for (let y = 3; y <= 12; y++) for (let x = 2; x <= 13; x++) {
        let c = PA[3];
        const v = t.fnoise(x, y, 4, 16, 911);
        if (v < 0.35) c = PA[2];
        if (x === 2 || y === 12) c = PA[1];
        if (x === 13 || y === 3) c = PA[2];
        L.set(x, y, c);
      }
      // curled corners
      L.set(2, 3, null); L.set(13, 12, PA[0]); L.set(12, 12, PA[1]);
      // coastline and sea hatching
      const coast = [[3, 9], [4, 8], [5, 8], [6, 7], [7, 7], [8, 6], [9, 6], [10, 5], [11, 5], [12, 4]];
      for (const [x, y] of coast) { L.set(x, y, 0x6a4a28); for (let k = 1; k < 4 && y + k <= 11; k++) if ((x + y + k) % 2 === 0) L.set(x, y + k, 0x8ca0a8); }
      L.set(5, 5, 0x6a4a28); L.set(6, 5, 0x6a4a28); L.set(6, 4, 0x6a4a28); // an island
      // route and marks
      L.set(4, 6, RED[3]); L.set(7, 5, RED[3]); L.set(9, 4, RED[3]);
      L.set(10, 8, RED[4]); L.set(11, 9, RED[4]); L.set(11, 8, RED[2]); L.set(10, 9, RED[2]);
      // pins
      for (const [x, y] of [[3, 3], [12, 3], [3, 11]]) { L.set(x, y, 0xe0e0e8); }
    }, { drop: [1, 1, 0.3] });
  }

  /** a shelf of porcelain dolls (the misty manor) */
  function dollShelf() {
    const { WOOD, CLOTH, SKIN, RED, BLUE, PURPLE } = K().P;
    return mk(16, 16, (L, t) => {
      const doll = (x, dress, hair) => {
        // head (porcelain), glass eyes, hair; dress
        L.rect(x, 3, 3, 3, 0xf4ece4); L.set(x, 3, hair); L.set(x + 1, 3, hair); L.set(x + 2, 3, hair);
        L.set(x - 1, 4, hair); L.set(x + 3, 4, hair); L.set(x - 1, 5, hair); L.set(x + 3, 5, hair);
        L.set(x, 4, 0x2a2440); L.set(x + 2, 4, 0x2a2440); L.set(x + 1, 5, 0xe8a8a8);
        for (let y = 6; y <= 10; y++) { const w = y < 8 ? 1 : 2; for (let i = -w + 1; i <= 1 + w; i++) L.set(x + i, y, i < 1 ? dress[2] : i > 1 ? dress[0] : dress[1]); }
        L.hline(x - 1, x + 3, 10, dress[0]); L.set(x + 1, 6, CLOTH[4]);
      };
      doll(2, [RED[1], RED[3], RED[4]], 0x5a3418);
      doll(7, [BLUE[1], BLUE[3], BLUE[4]], 0xe0c060);
      doll(12, [PURPLE[1], PURPLE[3], PURPLE[4]], 0x2a1c14);
      L.hline(0, 15, 11, WOOD[5]); L.hline(0, 15, 12, WOOD[2]);
      for (const x of [2, 13]) { L.set(x, 13, WOOD[2]); L.set(x, 14, WOOD[1]); }
      // cobweb strand across the corner
      L.set(15, 3, 0xd8d8e0); L.set(14, 4, 0xc0c0cc); L.set(15, 5, 0xc0c0cc);
    }, { drop: [1, 1, 0.3] });
  }

  // ------------------------------------------------------------ floor overlays
  /** oval woven rug with a border and a centre medallion (pass) */
  function rugRoundImg(m, x, y) {
    const { Img, P, floorShade } = K();
    const { RED, CREAM, BLUE, GOLD } = P;
    const img = new Img(16, 16);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const dx = (i + 0.5 - 8) / 7.6, dy = (j + 0.5 - 8.2) / 6, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      let c;
      if (d > 0.9) c = (i + j) % 2 ? RED[1] : RED[2];
      else if (d > 0.82) c = GOLD[3];
      else if (d > 0.7) c = (Math.floor(Math.atan2(dy, dx) * 6) & 1) ? RED[3] : CREAM[3];
      else if (d > 0.62) c = RED[2];
      else if (d > 0.3) c = (i + j) % 2 ? RED[3] : RED[4];
      else if (d > 0.2) c = GOLD[4];
      else c = BLUE[3];
      img.put(i, j, c, 1);
    }
    // fringe tassels at the long ends
    for (const i of [0, 15]) for (let j = 6; j <= 10; j += 2) img.put(i, j, CREAM[3], 1);
    return m ? floorShade(img, m, x, y) : img;
  }

  /** a stack of books on the floor and one lying open */
  function bookPile() {
    const { WOOD, RED, BLUE, GREEN, CREAM, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      const book = (x0, y0, w, P) => {
        L.rect(x0, y0, w, 2, P[2]); L.hline(x0, x0 + w - 1, y0, P[3]); L.hline(x0 + 1, x0 + w - 1, y0 + 2, P[1]);
        L.set(x0 + w - 1, y0 + 1, CREAM[3]); L.set(x0 + w - 1, y0 + 2, CREAM[2]); // page edge
        L.set(x0 + 2, y0 + 1, GOLD[4]);
      };
      book(1, 12, 9, RED); book(2, 9, 8, BLUE); book(1, 6, 9, GREEN); book(3, 3, 6, [0, 0x4a2c14, 0x6a4424, 0x8c5c34]);
      // open book in front
      for (let x = 9; x <= 15; x++) { L.set(x, 12, CREAM[4]); L.set(x, 13, CREAM[3]); L.set(x, 14, CREAM[2]); }
      L.vline(12, 12, 14, CREAM[1]);
      for (const x of [10, 11, 13, 14]) L.set(x, 13, 0x8c8474);
      L.hline(9, 15, 15, RED[1]);
    }, { contact: [8, 14.8, 7.5, 1.4, 0.34] });
  }

  /** broken chair on its side (pass) */
  function brokenChair() {
    const { WOOD } = K().P;
    const W = [0x2e1c10, 0x46301c, 0x5e4228, 0x765634, 0x8e6c44, 0xa8845a]; // old, greyed wood
    return mk(16, 16, (L, t) => {
      // seat, tilted
      L.line(3, 10, 11, 8, W[4]); L.line(3, 11, 11, 9, W[3]); L.line(3, 12, 11, 10, W[2]);
      // back lying on the floor, a slat missing
      L.rect(9, 3, 2, 7, W[3]); L.vline(9, 3, 9, W[4]); L.rect(13, 4, 2, 6, W[2]);
      L.hline(9, 14, 3, W[4]); L.set(12, 6, W[1]);
      // legs: two up, one snapped
      L.vline(4, 12, 14, W[2]); L.vline(10, 10, 13, W[1]); L.line(5, 9, 3, 6, W[3]);
      // splinters
      L.set(2, 14, W[4]); L.set(6, 15, W[3]); L.set(13, 13, W[4]); L.set(12, 14, W[2]);
    }, { contact: [8, 13.5, 6, 1.6, 0.3] });
  }

  // ------------------------------------------------------------ furniture
  /** three kegs lying on a rack, the top one tapped */
  function kegs() {
    const { WOOD, IRON, GOLD } = K().P;
    return mk(16, 32, (L, t) => {
      const keg = (cx, cy, r) => {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r + 0.3) continue;
          let c = d > r - 0.9 ? IRON[3] : d > r - 1.5 ? WOOD[2] : (Math.floor(x - cx + 8) % 3 === 0 ? WOOD[3] : WOOD[4]);
          if (d > r - 0.9 && x + y > cx + cy) c = IRON[1];
          if (d <= r - 1.5 && x - cx + y - cy < -2) c = WOOD[5];
          if (Math.abs(d - (r - 2.6)) < 0.5) c = WOOD[2];
          L.set(x, y, c);
        }
        L.set(cx, cy, WOOD[1]); L.set(cx + 1, cy, WOOD[1]);
      };
      // rack
      L.rect(0, 28, 16, 2, WOOD[2]); L.hline(0, 15, 28, WOOD[4]); L.rect(1, 30, 2, 1, WOOD[1]); L.rect(13, 30, 2, 1, WOOD[1]);
      keg(3.8, 23, 4.4); keg(11.8, 23, 4.4); keg(7.8, 14.6, 4.6);
      // tap and drip
      L.rect(7, 18, 2, 2, GOLD[3]); L.set(7, 18, GOLD[5]); L.set(8, 20, GOLD[2]); L.set(9, 18, GOLD[2]);
      L.set(8, 21, 0xd8a040);
      // chalk tally marks
      for (const x of [2, 4]) L.set(x, 20, 0xe8e0d0);
    }, { contact: [8, 30.4, 8, 1.5, 0.38], drop: [1, 0, 0.22] });
  }

  /** a wooden loom: frame, warp threads and a band of woven red cloth */
  function loom() {
    const { WOOD, RED, CREAM, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      // posts and beams
      L.rect(1, 1, 2, 14, WOOD[3]); L.vline(1, 1, 14, WOOD[4]);
      L.rect(13, 1, 2, 14, WOOD[2]); L.vline(14, 1, 14, WOOD[1]);
      L.hline(1, 14, 1, WOOD[5]); L.hline(1, 14, 2, WOOD[2]);
      L.hline(1, 14, 12, WOOD[4]); L.hline(1, 14, 13, WOOD[1]);
      // warp threads
      for (let x = 4; x <= 11; x++) for (let y = 3; y <= 7; y++) L.set(x, y, x % 2 ? CREAM[4] : CREAM[2]);
      // the heddle bar
      L.hline(3, 12, 5, WOOD[4]);
      // woven cloth: a red band with a gold stripe pattern
      for (let x = 4; x <= 11; x++) for (let y = 8; y <= 11; y++) {
        let c = (x + y) % 2 ? RED[3] : RED[2];
        if (y === 9) c = x % 3 ? GOLD[4] : GOLD[2];
        L.set(x, y, c);
      }
      // shuttle resting on the frame, a ball of yarn
      L.hline(5, 10, 7, WOOD[5]); L.set(5, 7, WOOD[2]);
      L.set(13, 14, CREAM[3]); L.set(14, 14, CREAM[2]); L.set(13, 15, CREAM[1]);
      L.rect(1, 14, 2, 2, WOOD[1]); L.rect(13, 14, 2, 2, WOOD[0]);
    }, { contact: [8, 14.6, 7.6, 1.4, 0.34] });
  }

  /** a spinning wheel with a treadle and a puff of wool on the distaff */
  function spinwheel() {
    const { WOOD, CREAM } = K().P;
    return mk(16, 16, (L, t) => {
      // bench and legs
      L.line(2, 12, 13, 10, WOOD[4]); L.line(2, 13, 13, 11, WOOD[2]);
      L.vline(3, 13, 15, WOOD[2]); L.vline(12, 11, 15, WOOD[1]); L.vline(8, 12, 14, WOOD[2]);
      // wheel
      const cx = 9.5, cy = 6, r = 5;
      for (let y = 0; y < 12; y++) for (let x = 3; x < 16; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r + 0.5 || d < r - 0.8) continue;
        L.set(x, y, x + y < cx + cy ? WOOD[5] : WOOD[3]);
      }
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; L.line(cx, cy, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), WOOD[2]); }
      L.set(9, 6, WOOD[1]); L.set(10, 6, WOOD[1]);
      // upright and distaff with wool
      L.vline(3, 3, 12, WOOD[3]);
      for (const [x, y] of [[1, 1], [2, 1], [3, 0], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [4, 3]]) L.set(x, y, (x + y) % 2 ? CREAM[4] : CREAM[3]);
      L.line(4, 3, 8, 6, CREAM[2]); // thread to the bobbin
    }, { contact: [8, 14.4, 7, 1.6, 0.32] });
  }

  /** a book on a slanted lectern (counter: talk across it) */
  function lectern() {
    const { WOOD, WALNUT, CREAM, RED, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      // foot and post
      L.rect(4, 13, 8, 2, WALNUT[2]); L.hline(4, 11, 13, WALNUT[4]); L.hline(4, 11, 15, WALNUT[0]);
      L.rect(7, 8, 2, 5, WALNUT[3]); L.vline(7, 8, 12, WALNUT[4]);
      // slanted top
      L.poly([[1, 7.5], [15, 7.5], [13, 2.5], [3, 2.5]], WALNUT[3]);
      L.hline(1, 14, 7, WALNUT[1]); L.hline(1, 14, 8, WALNUT[0]); L.hline(3, 12, 2, WALNUT[4]);
      // open book
      for (let y = 3; y <= 6; y++) for (let x = 3; x <= 12; x++) L.set(x, y, x === 7 || x === 8 ? CREAM[2] : y === 3 ? CREAM[4] : CREAM[3]);
      for (const y of [4, 5]) for (const x of [4, 5, 6, 9, 10, 11]) if ((x + y) % 2 === 0 || x === 4) L.set(x, y, 0x8c8070);
      L.set(8, 6, RED[3]); L.set(8, 7, RED[2]); // ribbon marker
      L.set(3, 3, GOLD[4]); L.set(12, 3, GOLD[3]);
    }, { contact: [8, 14.6, 5.5, 1.3, 0.34] });
  }

  /** a wooden cradle on rockers, blanket and a little pillow */
  function cradle() {
    const { WOOD, BLUE, CLOTH, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      // rockers
      for (let x = 1; x <= 14; x++) { const y = 14 + Math.round(Math.abs(x - 7.5) / 5); L.set(x, Math.min(15, y), WOOD[2]); }
      // box
      L.rect(2, 6, 12, 7, WOOD[3]); L.hline(2, 13, 6, WOOD[5]); L.hline(2, 13, 12, WOOD[1]); L.vline(2, 6, 12, WOOD[4]); L.vline(13, 6, 12, WOOD[1]);
      for (let x = 4; x < 13; x += 3) L.vline(x, 8, 11, WOOD[2]);
      // hood at the head end
      L.rect(2, 2, 5, 5, WOOD[3]); L.hline(2, 6, 2, WOOD[5]); L.vline(2, 2, 6, WOOD[4]);
      // pillow and blanket
      L.rect(4, 5, 3, 2, CLOTH[4]); L.set(6, 6, CLOTH[2]);
      L.rect(7, 5, 6, 2, BLUE[3]); L.hline(7, 12, 5, BLUE[4]); L.set(9, 5, GOLD[4]); L.set(11, 6, BLUE[2]);
    }, { contact: [8, 14.8, 7, 1.3, 0.3] });
  }

  /** a wooden washtub with suds and a washboard leaning on it */
  function washtub() {
    const { WOOD, IRON, GLASS } = K().P;
    return mk(16, 16, (L, t) => {
      // tub body
      for (let y = 7; y <= 14; y++) { const w = 6 - (y > 12 ? 1 : 0); for (let x = 8 - w; x <= 7 + w; x++) L.set(x, y, x < 5 ? WOOD[4] : x > 11 ? WOOD[2] : (x % 3 === 0 ? WOOD[2] : WOOD[3])); }
      for (const y of [9, 13]) for (let x = 2; x <= 13; x++) if (L.get(x, y) !== t.NONE) L.set(x, y, x < 7 ? IRON[4] : IRON[2]);
      // rim and water
      L.ellipse(7.5, 7, 6, 1.8, WOOD[5]); L.ellipse(7.5, 7, 4.8, 1.1, GLASS[2]);
      for (const [x, y] of [[5, 6], [6, 7], [9, 6], [10, 7], [8, 7]]) L.set(x, y, 0xffffff);
      L.set(7, 6, 0xdce8f4); L.set(11, 6, 0xdce8f4);
      // washboard
      L.rect(12, 2, 3, 10, WOOD[3]); L.vline(12, 2, 11, WOOD[4]);
      for (let y = 4; y <= 9; y += 2) L.hline(12, 14, y, IRON[3]);
    }, { contact: [8, 14.8, 6.8, 1.3, 0.34] });
  }

  /** an old upright piano: dusty lid, yellowed keys, candle arms (tall) */
  function piano() {
    const { WALNUT, CREAM, GOLD, CLOTH } = K().P;
    const W = [0x140c0a, 0x24160e, 0x362216, 0x4a2e1e, 0x5e3e28, 0x76523a];
    return mk(16, 32, (L, t) => {
      // body
      L.rect(0, 9, 16, 21, W[3]); L.vline(0, 9, 29, W[4]); L.vline(15, 9, 29, W[1]);
      L.hline(0, 15, 8, W[5]); L.hline(0, 15, 9, W[4]); // lid (dust grey on top)
      for (let x = 0; x < 16; x++) if (t.hash(x, 8, 921) < 0.4) L.set(x, 8, 0x8a8078);
      // upper panel with carved frame and sheet music
      L.rect(2, 11, 12, 6, W[2]); L.hline(2, 13, 11, W[1]); L.hline(2, 13, 16, W[4]);
      L.rect(5, 12, 6, 4, CREAM[3]); L.hline(5, 10, 12, CREAM[4]); for (const y of [13, 14]) for (let x = 6; x <= 9; x += 1) if ((x + y) % 2) L.set(x, y, 0x5c5448);
      // candle arms
      for (const x of [1, 13]) { L.rect(x, 12, 2, 1, GOLD[3]); L.vline(x, 9, 11, CREAM[4]); L.set(x, 8, 0xffc040); }
      // keyboard
      L.rect(1, 18, 14, 3, 0xd8ccb0); L.hline(1, 14, 18, 0xf0e6cc);
      for (let x = 1; x <= 14; x++) { if (x % 2 === 0 && x % 7 !== 0) L.set(x, 18, 0x1c1410); if (x % 2 === 1) L.set(x, 20, 0xb4a888); }
      L.set(6, 19, 0x8c8068); L.set(11, 20, 0x8c8068); // a broken key
      L.hline(0, 15, 21, W[1]);
      // lower cabinet panels and pedals
      for (const x0 of [2, 9]) { L.rect(x0, 23, 5, 5, W[2]); L.hline(x0, x0 + 4, 23, W[1]); L.hline(x0, x0 + 4, 27, W[4]); }
      L.set(7, 29, GOLD[3]); L.set(9, 29, GOLD[3]);
      L.rect(0, 30, 2, 1, W[1]); L.rect(14, 30, 2, 1, W[0]);
      // a cobweb in the corner
      L.set(15, 10, 0xc8c8d0); L.set(14, 9, 0xc8c8d0);
    }, { contact: [8, 30.4, 8, 1.6, 0.4], drop: [1, 0, 0.24] });
  }

  /** a brass telescope on a tripod, aimed at the sky (tall) */
  function telescope() {
    const { WOOD, GOLD, IRON } = K().P;
    return mk(16, 32, (L, t) => {
      // tripod
      L.line(8, 18, 3, 30, WOOD[3]); L.line(8, 18, 13, 30, WOOD[2]); L.line(8, 18, 8, 30, WOOD[4]);
      L.line(9, 18, 4, 30, WOOD[1]);
      L.hline(4, 12, 26, WOOD[2]);
      // mount
      L.rect(6, 16, 5, 3, IRON[3]); L.hline(6, 10, 16, IRON[4]);
      // tube (diagonal, brass, stepping in)
      const tube = (x0, y0, x1, y1, r, P) => {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let i = 0; i <= n; i++) {
          const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
          for (let k = -r; k <= r; k++) L.set(x + k * 0.6, y + k * 0.8, k < 0 ? P[4] : k > 0 ? P[1] : P[3]);
        }
      };
      tube(4, 20, 9, 12, 1, GOLD);
      tube(9, 12, 13, 5, 1.5, [GOLD[0], GOLD[1], GOLD[2], GOLD[3], GOLD[4]]);
      tube(12, 6, 14, 3, 2, [0, WOOD[1], WOOD[2], WOOD[3], WOOD[4]]);
      L.set(15, 2, 0x9cc8f0); L.set(14, 1, 0xd0e8ff); // the lens catches the light
      L.set(4, 21, IRON[1]); L.set(3, 21, IRON[2]); // eyepiece
    }, { contact: [8, 30.4, 6.5, 1.4, 0.36], drop: [1, 0, 0.22] });
  }

  /** an armillary sphere: gilt rings round a small globe on a stand */
  function astrolabe() {
    const { WOOD, GOLD, BLUE, GREEN } = K().P;
    return mk(16, 16, (L, t) => {
      // stand
      L.rect(5, 14, 6, 1, WOOD[2]); L.hline(4, 11, 15, WOOD[1]); L.vline(7, 11, 13, WOOD[3]); L.vline(8, 11, 13, WOOD[2]);
      // globe
      L.shadeEllipse(7.5, 6.5, 2.6, 2.6, [BLUE[1], BLUE[2], BLUE[3], BLUE[4]], { dither: 0.3 });
      L.set(6, 5, GREEN[4]); L.set(8, 7, GREEN[3]); L.set(7, 6, GREEN[4]);
      // rings: meridian, equator, ecliptic
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        L.set(7.5 + Math.cos(a) * 5.4, 6.5 + Math.sin(a) * 5.4, Math.sin(a) < 0 ? GOLD[4] : GOLD[2]);
        L.set(7.5 + Math.cos(a) * 5.4, 6.5 + Math.sin(a) * 1.6, Math.sin(a) > 0 ? GOLD[4] : GOLD[2]);
        L.set(7.5 + Math.cos(a) * 1.8, 6.5 + Math.sin(a) * 5.4, GOLD[3]);
      }
      L.line(3, 3, 12, 10, GOLD[3]);
      L.set(7, 0, GOLD[5]); L.set(8, 12, GOLD[1]);
    }, { contact: [8, 15, 4.5, 1.2, 0.34] });
  }

  // ------------------------------------------------------------ the small stage (auto: joins into a platform)
  function stageCell(e, box, x, y, m) {
    const { Img, P, floorShade } = K();
    const W = P.WOOD;
    const img = new Img(16, 16);
    const front = !e.S, back = !e.N;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const gx = (x - box.x0) * 16 + i, row = (j >> 2);
      let c;
      if (front && j >= 12) {
        // the riser: vertical boards in shadow, a lit lip on top
        c = j === 12 ? W[5] : (gx % 4 === 0 ? W[1] : j === 15 ? W[0] : W[2]);
      } else {
        // planks run across the platform
        const seam = (gx + row * 7) % 16 === 0;
        c = (j & 3) === 3 ? W[2] : seam ? W[2] : (j & 3) === 0 ? W[5] : W[4];
        if (back && j === 0) c = W[5];
      }
      if (!e.W && i === 0) c = W[5];
      if (!e.E && i === 15) c = W[1];
      img.put(i, j, c, 1);
    }
    // nails
    for (let i = 3; i < 16; i += 8) for (let j = 1; j < (front ? 12 : 16); j += 4) img.put(i, j, W[1], 1);
    return m ? floorShade(img, m, x, y) : img;
  }
  function stageAuto(m, x, y) {
    const { edges, component, ekey, cached } = K();
    const e = edges(m, 'stage', x, y), box = component(m, 'stage', x, y);
    const key = 'stg|' + ekey(e) + '|' + ((x - box.x0) & 3) + '|' + (K().shadeKey(m, x, y));
    return cached(key, () => stageCell(e, box, x, y, m).canvas());
  }

  // ------------------------------------------------------------ register
  const D = {
    bar_shelf: barShelf,
    herbs_hang: herbsHang,
    scroll_rack: scrollRack,
    map_wall: mapWall,
    doll_shelf: dollShelf,
    rug_round: () => rugRoundImg(null).canvas(),
    book_pile: bookPile,
    broken_chair: brokenChair,
    kegs, loom, spinwheel, lectern, cradle, washtub, piano, telescope, astrolabe,
    stage: () => stageCell(K().NONE_E, { x0: 0, y0: 0, x1: 0, y1: 0 }, 0, 0, null).canvas(),
  };
  for (const id in D) R.Gfx.def('decor:' + id, D[id]);
  A.decorAuto.stage = stageAuto;
  A.decorAuto.rug_round = (m, x, y) => K().cached('rr|' + K().shadeKey(m, x, y), () => rugRoundImg(m, x, y).canvas());
  A.LIFE_DECOR = Object.keys(D);
  // the interior review lists (decor_interior.js loads first; decor_dungeon.js loads before both)
  if (Array.isArray(A.INTERIOR_DECOR)) for (const id of A.LIFE_DECOR.concat(A.DUNGEON_DECOR || [])) if (!A.INTERIOR_DECOR.includes(id)) A.INTERIOR_DECOR.push(id);
})(window.RPG);
