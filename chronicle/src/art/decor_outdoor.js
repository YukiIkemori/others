// Chronicle exterior decor (DESIGN §11.2.10): signposts, washing lines, palms,
// snow drifts, firewood, net racks, desert tents, small boats and the steam of a
// hot spring. Transparent pieces over any ground (grass, cobbles, sand, snow),
// bottom-aligned, soft contact shadows; built with A.DecorKit (decor_interior.js).
// The palm is 24 px wide: the field centres wide decor on its cell (up to 48 px).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  A.decorAuto = A.decorAuto || {};
  const K = () => A.DecorKit;
  const tk = () => A.TK;
  const mk = (w, h, draw, o) => K().piece(w, h, draw, o).canvas();

  /** a signpost with two arrow boards (crossroads, the edge of town) */
  function signpost() {
    const { WOOD, STONE } = K().P;
    return mk(16, 32, (L) => {
      // post and a stone footing
      for (let y = 6; y < 29; y++) { L.set(7, y, WOOD[4]); L.set(8, y, WOOD[2]); }
      L.set(7, 5, WOOD[5]); L.set(8, 5, WOOD[3]);
      L.rect(5, 28, 6, 2, STONE[3]); L.hline(5, 10, 28, STONE[4]); L.hline(5, 10, 29, STONE[1]);
      // boards: one pointing right, one left, with a notched tip
      const board = (y, dir) => {
        const x0 = dir > 0 ? 5 : 1, x1 = dir > 0 ? 14 : 10;
        L.rect(x0, y, x1 - x0 + 1, 4, WOOD[4]); L.hline(x0, x1, y, WOOD[5]); L.hline(x0, x1, y + 3, WOOD[2]);
        const tip = dir > 0 ? x1 + 1 : x0 - 1;
        L.set(tip, y + 1, WOOD[4]); L.set(tip, y + 2, WOOD[3]);
        for (let x = x0 + 2; x < x1 - 1; x += 2) L.set(x, y + 1 + ((x >> 1) & 1), WOOD[1]); // carved letters
        L.set(dir > 0 ? x0 + 1 : x1 - 1, y + 1, 0x3a3a44); // nail
      };
      board(8, 1); board(14, -1);
      // a tuft of grass at the foot
      L.set(4, 29, 0x4e7a30); L.set(11, 29, 0x4e7a30); L.set(4, 28, 0x6c9444);
    }, { contact: [8, 30.2, 4, 1.2, 0.32] });
  }

  /** two posts and a line of washing (walkable) */
  function laundry() {
    const { WOOD, RED, BLUE, CLOTH, CREAM } = K().P;
    return mk(16, 28, (L) => {
      for (const x of [0, 15]) for (let y = 6; y < 27; y++) L.set(x, y, x ? WOOD[2] : WOOD[4]);
      L.set(0, 5, WOOD[5]); L.set(15, 5, WOOD[3]);
      // sagging line
      for (let x = 1; x < 15; x++) L.set(x, 7 + Math.round(Math.sin((x / 15) * Math.PI) * 2), 0xc8b890);
      const cloth = (x0, w, h, P) => {
        for (let x = x0; x < x0 + w; x++) {
          const top = 7 + Math.round(Math.sin((x / 15) * Math.PI) * 2) + 1;
          for (let y = top; y < top + h - ((x + h) % 3 === 0 ? 1 : 0); y++) L.set(x, y, x === x0 ? P[4] : x === x0 + w - 1 ? P[2] : P[3]);
        }
        L.set(x0, 8 + Math.round(Math.sin((x0 / 15) * Math.PI) * 2), 0xa89060); // peg
      };
      cloth(2, 4, 8, CLOTH); cloth(7, 3, 6, [0, RED[1], RED[2], RED[3], RED[4]]); cloth(11, 3, 9, [0, BLUE[1], BLUE[2], BLUE[3], BLUE[4]]);
      L.set(3, 12, CREAM[1]); L.set(12, 13, BLUE[2]);
    }, { contact: [8, 27.2, 7.5, 0.9, 0.22] });
  }

  /** a leaning coconut palm (walkable; wider than a cell) */
  function palm() {
    const P = [0x0e2414, 0x16361c, 0x204a26, 0x2e6030, 0x42783a, 0x60904c]; // PAL.jungle
    const TR = [0x3a2a18, 0x56402a, 0x74583a, 0x90724c];
    return mk(24, 32, (L, t) => {
      // curved ringed trunk from the foot (12,31) to the crown (15,8)
      for (let y = 10; y <= 30; y++) {
        const u = (30 - y) / 20, cx = 11 + Math.round(4 * u * u);
        const w = y > 26 ? 2 : 1;
        for (let x = cx - w; x <= cx + 1; x++) L.set(x, y, x === cx - w ? TR[3] : x === cx + 1 ? TR[0] : (y % 3 === 0 ? TR[1] : TR[2]));
      }
      // fronds radiating from the crown
      const cx = 15, cy = 8;
      const fronds = [[-10, 2], [-7, -4], [-2, -7], [5, -6], [9, -1], [8, 5], [-6, 6], [1, 7]];
      for (const [dx, dy] of fronds) {
        const n = Math.max(Math.abs(dx), Math.abs(dy)) + 2;
        for (let i = 0; i <= n; i++) {
          const f = i / n, x = cx + dx * f, y = cy + dy * f + (f * f) * 3; // droop
          L.set(x, y, P[3]); L.set(x, y + 1, P[1]);
          if (i > 1 && i % 2 === 0) { L.set(x + (dy > 0 ? 1 : 0), y - 1, P[4]); L.set(x - (dx > 0 ? 1 : 0), y + 2, P[2]); }
        }
        L.set(cx + dx, cy + dy + 3, P[2]);
      }
      L.shadeEllipse(cx, cy, 2.4, 1.8, [P[2], P[3], P[4], P[5]], { dither: 0.3 });
      // coconuts
      for (const [x, y] of [[14, 10], [16, 10], [15, 11]]) { L.set(x, y, 0x5a3c1c); L.set(x, y - 1, 0x7a5428); }
    }, { outline: 0x0a1a0c, contact: [11.5, 30.6, 4, 1.2, 0.34] });
  }

  /** a drift of snow (walkable) */
  function snowpile() {
    return mk(16, 16, (L, t) => {
      const S = [0x8a94a8, 0xaab2c2, 0xcad0da, 0xe8ecf0, 0xffffff];
      for (let y = 5; y <= 15; y++) for (let x = 0; x < 16; x++) {
        const top = 9 - Math.round(Math.sin((x / 15) * Math.PI) * 4 + Math.sin(x * 0.9) * 0.8);
        if (y < top || y > 14) continue;
        const u = (y - top) / (15 - top);
        L.set(x, y, u < 0.2 ? S[4] : x < 7 && u < 0.5 ? S[3] : u > 0.75 ? S[1] : S[2]);
      }
      for (const [x, y] of [[5, 7], [9, 6], [12, 9]]) L.set(x, y, 0xffffff);
      L.set(3, 12, 0x5a5e68); L.set(4, 12, 0x6a6e78); // a stone peeking out
    }, { outline: 0x6a7488, contact: [8, 14.8, 7.5, 1.2, 0.2] });
  }

  /** split logs stacked by the door */
  function firewood() {
    const { WOOD } = K().P;
    return mk(16, 16, (L, t) => {
      const log = (cx, cy) => {
        for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > 2.4) continue;
          L.set(x, y, d > 1.7 ? (x + y < cx + cy ? WOOD[3] : WOOD[1]) : d > 0.8 ? 0xd8b078 : 0xb88a50);
        }
        L.set(cx, cy, 0x9c6a3a);
      };
      for (const cx of [3, 8, 13]) log(cx, 12);
      for (const cx of [5.5, 10.5]) log(cx, 8);
      log(8, 4);
      // bark on the top log's side and a few chips
      L.set(1, 15, 0xc89860); L.set(14, 15, 0xa87844);
    }, { contact: [8, 14.8, 7.5, 1.3, 0.36] });
  }

  /** a fishing-net drying rack (tall) */
  function netRack() {
    const { WOOD } = K().P;
    return mk(16, 28, (L, t) => {
      for (const x of [1, 14]) for (let y = 4; y < 27; y++) L.set(x, y, x === 1 ? WOOD[4] : WOOD[2]);
      L.hline(1, 14, 4, WOOD[5]); L.hline(1, 14, 5, WOOD[2]);
      // the net: diamond mesh hanging in a curve, a few floats
      const NET = [0x7c7058, 0x9c9070, 0xbcb08c];
      for (let y = 6; y < 22; y++) for (let x = 2; x < 14; x++) {
        const bottom = 20 - Math.round(Math.sin(((x - 2) / 11) * Math.PI) * 3);
        if (y > bottom) continue;
        if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) L.set(x, y, NET[(x + y) % 2 ? 1 : 2]);
      }
      for (const [x, y] of [[4, 16], [8, 19], [12, 16]]) { L.set(x, y, 0xd8883c); L.set(x + 1, y, 0xb06020); L.set(x, y + 1, 0x8c4810); }
      L.set(6, 12, 0x6a8ca0); L.set(7, 12, 0x8cacc0); // a snagged fish scale glint
    }, { contact: [8, 27.2, 7.5, 1, 0.26], diag: false });
  }

  /** a striped desert tent (tall) */
  function tent() {
    const { WOOD } = K().P;
    const C = [[0x6a3c24, 0xa05c34, 0xc47c48], [0xc8b48c, 0xe4d2ac, 0xf4e8cc]];
    return mk(16, 28, (L, t) => {
      // canvas: a ridge tent seen from the front, stripes down the slope
      for (let y = 6; y <= 26; y++) {
        const half = Math.min(7.5, 1 + (y - 6) * 0.42);
        for (let x = Math.round(7.5 - half); x <= Math.round(7.5 + half); x++) {
          const stripe = Math.floor((x - 7.5 + 20) / 2.5) % 2;
          const P = C[stripe];
          L.set(x, y, x < 7 ? P[2] : x > 8 ? P[0] : P[1]);
        }
      }
      // the door flap, open, dark inside
      for (let y = 17; y <= 26; y++) { const h = Math.min(3, (y - 17) * 0.45 + 0.5); for (let x = Math.round(7.5 - h); x <= Math.round(7.5 + h); x++) L.set(x, y, 0x1c120c); }
      L.line(6, 17, 3, 26, C[1][1]); L.line(9, 17, 12, 26, C[0][1]);
      // pole top with a pennant, guy ropes and pegs
      L.vline(7, 2, 6, WOOD[3]); L.set(8, 2, 0xd83028); L.set(9, 2, 0xd83028); L.set(8, 3, 0xa01c1c);
      L.line(1, 26, 0, 27, 0xa89060); L.line(14, 26, 15, 27, 0xa89060);
    }, { contact: [8, 26.6, 8, 1.4, 0.34] });
  }

  /** a small rowing boat moored on water (drawn over a water tile): bow to the left */
  function boat() {
    const { WOOD } = K().P;
    return mk(16, 16, (L, t, U) => {
      // outline of the hull seen from above: pointed bow (left), square stern (right)
      const half = (x) => (x < 5 ? 1 + (x - 1) * 0.9 : x > 13 ? 3.6 : 4.4);
      for (let x = 1; x <= 14; x++) {
        const h = half(x);
        for (let y = Math.round(8 - h); y <= Math.round(8 + h); y++) {
          const edge = Math.abs(y - 8) >= h - 1 || x === 14 || x === 1;
          let c;
          if (edge) c = y < 8 ? WOOD[5] : WOOD[2];            // gunwale, lit on the far side
          else c = y < 8 ? WOOD[1] : (x % 4 === 0 ? WOOD[2] : WOOD[3]); // the inside: planks, shadow under the far side
          L.set(x, y, c);
        }
      }
      // thwarts (seats), a coil of rope and a pair of oars shipped along the hull
      for (const x of [6, 10]) L.vline(x, 5, 11, WOOD[4]);
      L.line(2, 10, 13, 12, 0xc8a878); L.line(3, 6, 14, 4, 0xb49060);
      L.set(12, 8, 0xb49c6c); L.set(11, 9, 0x8c7448); L.set(12, 9, 0x8c7448);
      // the painter rope to the bank, and ripples at the waterline
      L.line(0, 8, 1, 8, 0xb49c6c);
      for (let x = 0; x <= 15; x++) if ((x * 3) % 5 < 2) U.put(x, Math.round(8 + half(Math.min(14, Math.max(1, x))) + 1), 0xd0e4f0, 0.55);
    }, { outline: 0x1a1008, contact: [8, 9.5, 7.5, 5, 0.28] });
  }

  /** steam curling off a hot spring (walkable; over a water tile; 2 frames) */
  function hotSpring(f) {
    const { Img } = K();
    const img = new Img(16, 16);
    const t = tk();
    // mineral-tinted water sheen
    for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y + f) % 4 === 0) img.put(x, y, 0x9cd0c8, 0.25);
    // steam wisps rising, alternating
    const wisps = f ? [[4, 11], [10, 8], [7, 4], [12, 13]] : [[5, 10], [11, 9], [8, 5], [3, 13]];
    for (const [cx, cy] of wisps) for (let y = -5; y <= 5; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x * 1.0, y * 0.75);
      if (d > 4) continue;
      const a = (1 - d / 4) * 0.6;
      if (t.bayer(cx + x + f, cy + y) < a + 0.35) img.put(cx + x + Math.round(Math.sin((cy + y) * 0.8 + f) * 1), cy + y, 0xf4f8fc, Math.min(0.85, a + 0.25));
    }
    return img;
  }

  /** a stone archway over a street or gate, drawn over the figures walking beneath (over:true) */
  function archOver() {
    const { STONE } = K().P;
    return mk(16, 32, (L, t) => {
      // lintel with a keystone, voussoirs curving down into the two piers
      for (let y = 0; y <= 12; y++) for (let x = 0; x < 16; x++) {
        const inside = y > 3 && x > 1 && x < 14 && Math.hypot(x - 7.5, (y - 12) * 1.1) < 6.5;
        if (inside) continue;
        const k = (x + (y >> 2) * 3) % 5;
        let c = y === 0 ? STONE[5] : k === 0 || y % 4 === 3 ? STONE[1] : x < 8 ? STONE[4] : STONE[3];
        L.set(x, y, c);
      }
      L.rect(6, 0, 4, 4, STONE[5]); L.hline(6, 9, 3, STONE[2]); L.set(9, 1, STONE[3]);
      // piers down both sides (thin, so a figure between them stays visible)
      for (let y = 12; y < 32; y++) {
        L.set(0, y, STONE[4]); L.set(1, y, y % 4 === 3 ? STONE[1] : STONE[3]);
        L.set(14, y, y % 4 === 3 ? STONE[1] : STONE[2]); L.set(15, y, STONE[1]);
      }
      L.set(1, 20, 0x4a6a2c); L.set(0, 21, 0x5a7c34); L.set(15, 26, 0x4a6a2c); // moss
    }, { contact: [8, 31, 8, 0.8, 0.2] });
  }
  /** a bough hanging over a path, drawn over the figures beneath (over:true) */
  function leavesOver() {
    const F = [0x0c2410, 0x163a1a, 0x225426, 0x326e30, 0x4a8a3c, 0x6aa64e];
    return mk(16, 32, (L, t) => {
      L.line(0, 3, 16, 6, 0x3a2614); L.line(0, 4, 16, 7, 0x281a0e);
      for (const [cx, cy, r] of [[3, 5, 4.2], [9, 4, 4.6], [14, 7, 3.8], [6, 10, 3.4], [12, 12, 2.8]]) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (d > r || (d > r - 1 && t.hash(x, y, 991) < 0.4)) continue;
          const l = (-(x - cx) - (y - cy)) / r;
          L.set(x, y, F[Math.max(1, Math.min(5, Math.round(2.6 + l * 1.6 + (t.hash(x, y, 993) - 0.5))))]);
        }
      }
      // a few leaves dangling low, where they brush the head of whoever walks under
      for (const [x, y] of [[4, 16], [11, 17], [7, 19], [13, 20]]) { L.set(x, y, F[3]); L.set(x, y - 1, F[4]); L.set(x + 1, y, F[2]); L.vline(x, y - 4, y - 2, 0x2a1c10); }
    }, { outline: 0x081a0a });
  }

  const D = {
    arch_over: archOver, leaves_over: leavesOver,
    signpost, laundry, palm, snowpile, firewood,
    net_rack: netRack, tent, boat,
    hot_spring: () => [0, 1].map((f) => hotSpring(f).canvas()),
  };
  for (const id in D) R.Gfx.def('decor:' + id, D[id]);
  // snow drifts over snowy ground take a bluer shadow: identical art is fine on grass too
  A.OUTDOOR_DECOR = Object.keys(D);
  // the exterior review sheet lists these too (decor_exterior.js loads first)
  if (Array.isArray(A.DECOR_EXTERIOR)) for (const id of A.OUTDOOR_DECOR) if (!A.DECOR_EXTERIOR.includes(id)) A.DECOR_EXTERIOR.push(id);
})(window.RPG);
