// Chronicle dungeon & work-site decor (DESIGN §11.2.10, §11.2.11): mine rails and
// carts, a ghost ship's mast, cannon, helm and rope, drifting paper, mushrooms
// (softly glowing inside the great tree), stumps, cobwebs, ivy, icicles, glowing
// fissures and ash, a smith's forge, ore, the sunken bell of the marsh and the
// firebird mural of the ash volcano. Built with A.DecorKit (decor_interior.js,
// looked up lazily). Context pieces (R.Art.decorAuto): rails join in four
// directions and bend at corners; cobwebs sit in the corner the walls make;
// mushrooms glow on the 'tree' theme.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  A.decorAuto = A.decorAuto || {};
  const K = () => A.DecorKit;
  const tk = () => A.TK;
  const mk = (w, h, draw, o) => K().piece(w, h, draw, o).canvas();
  const WALLY = { wall: 1, wall_torch: 1, secret_wall: 1, housewall: 1, door: 1, lockdoor: 1, rock_door: 1, void: 1 };

  // ------------------------------------------------------------ rails (auto)
  const RAIL = [0x2a2a32, 0x4c4c58, 0x7c7c8c, 0xb4b4c4];
  const SLEEPER = [0x2a1a0e, 0x44301c, 0x5c4428];
  function railsCell(c) {
    const { Img } = K();
    const t = tk(), L = t.buf(16, 16), img = new Img(16, 16);
    const n = (c.u ? 1 : 0) + (c.d ? 1 : 0) + (c.l ? 1 : 0) + (c.r ? 1 : 0);
    let h = c.l || c.r, v = c.u || c.d;
    if (!n) h = true;
    const corner = n === 2 && h && v;
    // ballast gravel
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const on = corner ? true : (h && y >= 3 && y <= 12) || (v && x >= 3 && x <= 12);
      if (on && t.hash(x, y, 931) < 0.18) img.put(x, y, t.hash(x, y, 933) < 0.5 ? 0x5a5650 : 0x8a847a, 0.8);
    }
    if (corner) {
      // quarter-circle rails round the corner between the two connected sides
      const cx = c.r ? 16 : 0, cy = c.d ? 16 : 0;
      for (let k = 0; k <= 5; k++) { // sleepers, radial
        const a = (k / 5) * (Math.PI / 2);
        for (let r = 3; r <= 13; r++) {
          const x = cx + (c.r ? -1 : 1) * Math.cos(a) * r, y = cy + (c.d ? -1 : 1) * Math.sin(a) * r;
          L.set(x, y, r === 3 || r === 13 ? SLEEPER[0] : SLEEPER[2]);
        }
      }
      for (let s = 0; s <= 90; s++) {
        const a = (s / 90) * (Math.PI / 2);
        for (const [r, lit] of [[5, 1], [6, 0], [10, 1], [11, 0]]) {
          const x = cx + (c.r ? -1 : 1) * Math.cos(a) * r, y = cy + (c.d ? -1 : 1) * Math.sin(a) * r;
          L.set(x, y, lit ? RAIL[3] : RAIL[1]);
        }
      }
    } else {
      if (h) {
        const x0 = c.l || !c.r ? 0 : 3, x1 = c.r || !c.l ? 15 : 12;
        for (let x = x0 + 1; x <= x1; x += 4) for (let y = 3; y <= 12; y++) { L.set(x, y, y === 3 ? SLEEPER[2] : SLEEPER[1]); L.set(x + 1, y, SLEEPER[0]); }
        for (const y of [5, 10]) { L.hline(x0, x1, y, RAIL[3]); L.hline(x0, x1, y + 1, RAIL[1]); }
        if (!c.l && c.r) { L.rect(1, 4, 2, 8, 0x7a2c1c); L.vline(1, 4, 11, 0xa84a2c); }
        if (!c.r && c.l) { L.rect(13, 4, 2, 8, 0x7a2c1c); L.vline(13, 4, 11, 0xa84a2c); }
      }
      if (v) {
        const y0 = c.u || !c.d ? 0 : 3, y1 = c.d || !c.u ? 15 : 12;
        for (let y = y0 + 1; y <= y1; y += 4) for (let x = 3; x <= 12; x++) { L.set(x, y, x === 3 ? SLEEPER[2] : SLEEPER[1]); L.set(x, y + 1, SLEEPER[0]); }
        for (const x of [5, 10]) { L.vline(x, y0, y1, RAIL[3]); L.vline(x + 1, y0, y1, RAIL[1]); }
        if (!c.u && c.d) { L.rect(4, 1, 8, 2, 0x7a2c1c); L.hline(4, 11, 1, 0xa84a2c); }
        if (!c.d && c.u) { L.rect(4, 13, 8, 2, 0x7a2c1c); L.hline(4, 11, 13, 0xa84a2c); }
      }
    }
    img.buf(L);
    return img;
  }
  function lrud(m, x, y, id) {
    return { l: m.decorAt(x - 1, y) === id, r: m.decorAt(x + 1, y) === id, u: m.decorAt(x, y - 1) === id, d: m.decorAt(x, y + 1) === id };
  }
  A.decorAuto.rails = (m, x, y) => {
    const c = lrud(m, x, y, 'rails');
    const key = 'rails|' + +c.l + +c.r + +c.u + +c.d;
    return K().cached(key, () => railsCell(c).canvas());
  };

  // ------------------------------------------------------------ mine
  function minecart() {
    const { IRON, STEEL, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      // ore heaped above the rim
      const ORE = [0x3a3430, 0x5c544c, 0x7c7266, 0x9c9080];
      for (let y = 2; y <= 6; y++) for (let x = 3; x <= 12; x++) {
        const top = 6 - Math.round(Math.sin(((x - 3) / 9) * Math.PI) * 3.4);
        if (y < top) continue;
        L.set(x, y, ORE[(x * 7 + y * 3) % 4]);
      }
      for (const [x, y, c] of [[6, 4, 0xd88840], [9, 3, 0xe0e0f0], [8, 5, GOLD[4]], [5, 5, 0x8cc0e8]]) L.set(x, y, c);
      // tub: iron sides with rivets, flared top
      L.poly([[1, 6.5], [15, 6.5], [13, 12.5], [3, 12.5]], IRON[3]);
      L.hline(1, 14, 6, STEEL[4]); L.hline(1, 14, 7, IRON[2]);
      for (let y = 8; y <= 12; y++) { L.set(3 + ((y - 7) >> 2), y, IRON[4]); L.set(12 - ((y - 7) >> 2), y, IRON[1]); }
      for (const x of [4, 8, 12]) L.set(x, 9, STEEL[5]);
      L.hline(3, 12, 12, IRON[1]);
      // wheels
      for (const x of [4, 11]) { L.rect(x - 1, 12, 3, 3, IRON[1]); L.set(x, 13, STEEL[3]); L.set(x - 1, 12, IRON[3]); }
    }, { contact: [8, 14.8, 7, 1.3, 0.36] });
  }
  function orePile() {
    const { GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      const R_ = [0x2e2824, 0x4a423a, 0x665c50, 0x847868, 0xa29684];
      const rock = (cx, cy, r) => L.shadeEllipse(cx, cy, r, r * 0.8, R_, { dither: 0.5 });
      rock(5, 12, 3.4); rock(11, 12, 3.2); rock(8, 9, 3.6); rock(3, 14, 2); rock(13, 14.2, 2);
      // veins and gems glinting
      for (const [x, y, c] of [[7, 8, 0xd88840], [8, 8, 0xf0a860], [10, 11, 0xe0e0f0], [4, 11, GOLD[4]], [5, 11, GOLD[5]], [12, 13, 0x78c8a0], [9, 10, 0xb8e8ff]]) L.set(x, y, c);
    }, { contact: [8, 14.8, 7.5, 1.3, 0.36] });
  }
  /** a smith's forge: stone hearth, glowing coals under a hood, bellows (tall, 2 frames) */
  function forge(f) {
    const { WARM, BRICK, FIRE, IRON, WOOD, glow } = Object.assign({}, K().P, { glow: K().glow });
    const STONE = [WARM[0], WARM[1], WARM[2], WARM[3], WARM[4], WARM[5]].map((c) => tk().mul(c, 0.8));
    return K().piece(16, 32, (L, t, U, O) => {
      // chimney hood of brick narrowing upward
      for (let y = 2; y <= 14; y++) {
        const half = 3 + Math.round((y - 2) * 0.35);
        for (let x = 8 - half; x <= 7 + half; x++) {
          const row = y >> 1, bx = (x + (row % 2) * 2) % 4;
          L.set(x, y, (y & 1) === 1 || bx === 3 ? BRICK[1] : x < 6 ? BRICK[4] : BRICK[3]);
        }
      }
      L.hline(2, 13, 15, IRON[2]); L.hline(2, 13, 16, IRON[1]);
      // hearth: stone block with the coal bed
      L.rect(1, 17, 14, 12, STONE[3]); L.hline(1, 14, 17, STONE[5]); L.vline(1, 17, 28, STONE[4]); L.vline(14, 17, 28, STONE[1]);
      for (let y = 20; y <= 28; y += 4) L.hline(2, 13, y, STONE[2]);
      for (let x = 3; x <= 12; x++) for (let y = 18; y <= 20; y++) {
        const hot = t.hash(x, y + f, 941);
        L.set(x, y, hot < 0.3 ? FIRE[5] : hot < 0.65 ? FIRE[4] : hot < 0.85 ? FIRE[3] : 0x3a1a10);
      }
      // tongs resting, bellows on the side
      L.line(10, 17, 15, 12, IRON[3]); L.line(11, 17, 15, 13, IRON[1]);
      L.rect(0, 22, 3, 4, WOOD[3]); L.set(0, 22, WOOD[5]); L.set(2, 25, WOOD[1]);
      glow(O, 8, 19, f ? 6 : 6.8, f ? 0.16 : 0.2, 0xffa040);
      glow(U, 8, 14, 4, 0.12, 0xff8030);
    }, { contact: [8, 30, 8, 1.5, 0.4], f }).canvas();
  }

  // ------------------------------------------------------------ ship
  function mast() {
    const { WOOD, IRON, CLOTH } = K().P;
    return mk(16, 32, (L, t) => {
      // the mast
      for (let y = 0; y < 31; y++) { L.set(6, y, WOOD[5]); L.set(7, y, WOOD[4]); L.set(8, y, WOOD[3]); L.set(9, y, WOOD[1]); }
      for (const y of [8, 20]) { L.hline(5, 10, y, IRON[2]); L.set(5, y, IRON[4]); }
      // the yard with a torn, grey sail hanging from it
      L.hline(0, 15, 4, WOOD[4]); L.hline(0, 15, 5, WOOD[1]);
      const SA = [0x6c6860, 0x8c887c, 0xaca89a, 0xc8c4b4];
      for (let x = 1; x <= 14; x++) {
        if (x >= 6 && x <= 9) continue;
        const len = 5 + Math.round(t.hash(x, 0, 951) * 7) - (x > 11 ? 3 : 0);
        for (let y = 6; y < 6 + len; y++) L.set(x, y, y === 5 + len ? SA[0] : x < 6 ? SA[2 + (y & 1)] : SA[1 + (y & 1)]);
      }
      L.set(3, 9, null); L.set(12, 8, null); L.set(13, 7, null);
      // foot: an iron-banded base and coiled rope
      L.rect(4, 28, 8, 3, WOOD[2]); L.hline(4, 11, 28, WOOD[4]);
      L.ellipse(12.5, 29.5, 2.5, 1.2, 0xb49c6c); L.set(12, 29, 0x7c6440);
    }, { contact: [8, 30.6, 6, 1.2, 0.36], drop: [1, 0, 0.2] });
  }
  function cannon() {
    const { WOOD, IRON, STEEL } = K().P;
    return mk(16, 16, (L, t) => {
      // carriage and wheels
      L.rect(2, 9, 10, 3, WOOD[3]); L.hline(2, 11, 9, WOOD[5]); L.hline(2, 11, 11, WOOD[1]);
      for (const x of [3, 10]) { L.ellipse(x, 12.5, 2, 2, WOOD[2]); L.set(x, 12, IRON[3]); L.set(x - 1, 11, WOOD[4]); }
      // barrel pointing right (out of the gun port)
      for (let x = 3; x <= 15; x++) {
        const r = x < 6 ? 2.6 : 2 - (x - 6) * 0.05;
        for (let y = Math.round(7 - r); y <= Math.round(7 + r); y++) L.set(x, y, y < 6 ? STEEL[3] : y > 7 ? IRON[1] : IRON[3]);
      }
      L.vline(15, 5, 9, IRON[0]); L.set(15, 7, 0x000000);
      for (const x of [6, 11]) { L.vline(x, 5, 9, IRON[4]); }
      L.set(3, 7, IRON[4]); L.set(2, 7, IRON[2]); // cascabel
      // shot stacked beside
      for (const [x, y] of [[13, 13], [15, 13], [14, 12]]) { L.set(x, y, IRON[2]); L.set(x, y - 1, STEEL[4]); }
    }, { contact: [8, 14.6, 7.5, 1.4, 0.36] });
  }
  function helmWheel() {
    const { WOOD, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      // pedestal
      L.rect(6, 10, 4, 5, WOOD[3]); L.vline(6, 10, 14, WOOD[4]); L.vline(9, 10, 14, WOOD[1]); L.hline(5, 10, 15, WOOD[2]);
      // wheel with handles
      const cx = 8, cy = 7, r = 5;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        L.line(cx, cy, cx + Math.cos(a) * (r + 1.8), cy + Math.sin(a) * (r + 1.8), WOOD[3]);
        L.set(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), WOOD[5]);
      }
      for (let s = 0; s < 60; s++) { const a = (s / 60) * Math.PI * 2; L.set(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.sin(a) + Math.cos(a) < 0 ? WOOD[5] : WOOD[2]); L.set(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), WOOD[1]); }
      L.rect(7, 6, 2, 2, GOLD[3]); L.set(7, 6, GOLD[5]);
    }, { contact: [8, 15, 4, 1, 0.34] });
  }
  function ropeCoil() {
    return mk(16, 16, (L, t) => {
      const RP = [0x5a4428, 0x7c603c, 0xa08050, 0xc4a46c, 0xe0c890];
      // flat coil seen from above: concentric turns, each lit on its upper-left rim, dark gaps between
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - 8) / 1, dy = (y + 0.5 - 9) / 0.66;
        const r = Math.hypot(dx, dy);
        if (r > 6.8) continue;
        const turn = r % 2.2;
        if (r < 1) { L.set(x, y, RP[0]); continue; }
        if (turn < 0.5) { L.set(x, y, 0x2e2214); continue; } // gap
        const lit = -(dx + dy) / Math.max(1, r);
        L.set(x, y, turn < 1.1 ? (lit > 0.3 ? RP[4] : RP[3]) : lit > 0.3 ? RP[3] : lit < -0.4 ? RP[1] : RP[2]);
      }
      // twist marks along the rope and the loose end
      for (let k = 0; k < 20; k++) { const a = k * 0.9, r = 2 + (k % 3) * 2.2; L.set(8 + Math.cos(a) * r, 9 + Math.sin(a) * r * 0.66, RP[1]); }
      L.line(13, 10, 15, 14, RP[3]); L.line(14, 10, 15, 13, RP[1]); L.set(15, 15, RP[2]);
    }, { contact: [8, 10, 7, 4, 0.28] });
  }

  // ------------------------------------------------------------ nature & ruin
  function stump() {
    const { WOOD } = K().P;
    return mk(16, 16, (L, t) => {
      const B = [0x281a0e, 0x40291a, 0x5a3c26, 0x74502e]; // bark
      // bark body and roots
      L.rect(3, 7, 10, 6, B[2]); L.vline(3, 7, 12, B[3]); L.vline(12, 7, 12, B[0]);
      for (let x = 4; x < 12; x += 3) L.vline(x, 8, 12, B[1]);
      L.poly([[0, 14.5], [3, 10], [5, 14.5]], B[1]); L.poly([[11, 14.5], [13, 10], [16, 14.5]], B[0]); L.poly([[6, 14.5], [8, 12], [10, 14.5]], B[1]);
      // cut top with rings
      for (let y = 3; y <= 9; y++) for (let x = 2; x <= 13; x++) {
        const dx = (x + 0.5 - 8) / 5.8, dy = (y + 0.5 - 6.4) / 3.2, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        L.set(x, y, d > 0.86 ? B[3] : (Math.floor(d * 4.5) % 2 ? 0xc8a070 : 0xa87c4c));
      }
      L.set(8, 6, 0x7a5430); L.line(9, 5, 12, 7, 0x6a4424); // a split
      L.set(3, 8, 0x4a6a2c); L.set(4, 9, 0x5a7c34); L.set(12, 11, 0x4a6a2c); // moss
    }, { contact: [8, 14.4, 7.5, 1.4, 0.36] });
  }
  function mushroomsImg(glowing) {
    const { Img, P, glow } = K();
    const t = tk(), L = t.buf(16, 16), img = new Img(16, 16), O = new Img(16, 16);
    const CAP = glowing ? [0x2c7c8c, 0x58b8c4, 0xa0ecec, 0xe0fffc] : [0x6c2014, 0xa8341c, 0xd05a34, 0xf0a080];
    const STEM = glowing ? [0x8cb4b0, 0xc8e8e0] : [0xb4a488, 0xe8dcc4];
    const shroom = (x, y, w) => {
      L.vline(x, y + 1, y + 3, STEM[1]); L.set(x + 1, y + 2, STEM[0]);
      for (let i = -w; i <= w; i++) { L.set(x + i, y, i < 0 ? CAP[2] : CAP[1]); L.set(x + i, y + 1, CAP[0]); }
      L.hline(x - w + 1, x + w - 1, y - 1, CAP[2]); L.set(x - w + 1, y - 1, CAP[3]);
      if (!glowing) { L.set(x - 1, y, 0xffffff); L.set(x + 1, y - 1, 0xffe8d8); }
      if (glowing) glow(O, x + 0.5, y, 3.2, 0.22, 0x80f0e8);
    };
    shroom(5, 9, 2); shroom(10, 11, 1); shroom(8, 6, 1);
    L.outline(0x1a1410);
    const sh = new Img(16, 16);
    for (let x = 3; x <= 12; x++) sh.put(x, 14, 0x0e0a14, 0.3);
    if (glowing) img.over(O);
    img.over(sh).buf(L);
    if (glowing) { const O2 = new Img(16, 16); glow(O2, 5.5, 8, 2, 0.2, 0xc0fff8); img.over(O2); }
    return img;
  }
  A.decorAuto.mushrooms = (m, x, y) => {
    const glowing = K().thm(m) === 'tree' || K().thm(m) === 'oblivion';
    return K().cached('mush|' + glowing, () => mushroomsImg(glowing).canvas());
  };
  /** a cobweb stretched across a corner; 'nw' | 'ne' */
  function cobwebImg(corner) {
    const { Img } = K();
    const img = new Img(16, 16);
    const flip = corner === 'ne';
    const put = (x, y, a) => img.put(flip ? 15 - x : x, y, 0xe8e8f0, a);
    // radial threads from the corner
    for (const [dx, dy] of [[1, 0], [0.9, 0.45], [0.6, 0.8], [0.3, 0.95], [0, 1]]) for (let r = 0; r < 13; r++) put(Math.round(dx * r), Math.round(dy * r), 0.55);
    // the spiral, sagging between threads
    for (const R0 of [4, 7, 10]) for (let s = 0; s <= 40; s++) {
      const a = (s / 40) * (Math.PI / 2);
      const r = R0 - Math.sin(a * 4) * 0.6;
      put(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r), 0.4);
    }
    put(5, 5, 0.8); put(6, 5, 0.6); // a dusty knot (the spider is out)
    return img;
  }
  A.decorAuto.cobweb = (m, x, y) => {
    const W = (dx, dy) => !!WALLY[m.tileAt(x + dx, y + dy)];
    const corner = !W(-1, 0) && W(1, 0) ? 'ne' : W(1, -1) && !W(-1, -1) && !W(-1, 0) ? 'ne' : 'nw';
    return K().cached('web|' + corner, () => cobwebImg(corner).canvas());
  };
  /** ivy climbing a wall face (walkable where it spills onto a floor) */
  function ivy() {
    return mk(16, 16, (L, t) => {
      const G = [0x183414, 0x24481c, 0x346224, 0x4a7c30, 0x68984a];
      const stems = [[3, 15, 5, 0], [9, 15, 12, 2], [13, 15, 14, 6]];
      for (const [x0, y0, x1, y1] of stems) L.line(x0, y0, x1, y1, 0x4a3a20);
      const leaf = (x, y, k) => { L.set(x, y, G[3 + (k & 1)]); L.set(x + 1, y, G[2]); L.set(x, y + 1, G[2]); L.set(x + 1, y + 1, G[1]); L.set(x - 1, y, G[3]); };
      const pts = [[2, 13], [4, 10], [3, 7], [5, 4], [5, 1], [8, 12], [10, 9], [9, 6], [11, 4], [12, 2], [13, 11], [14, 8], [12, 14], [6, 15], [1, 11]];
      pts.forEach(([x, y], i) => leaf(x, y, i));
    }, { outline: 0x0c1c0a, drop: [1, 1, 0.3] });
  }
  /** icicles along the top of a wall face, snow on the ledge */
  function icicles() {
    return mk(16, 16, (L, t) => {
      const I = [0x6c90b8, 0x9cc0dc, 0xcce4f4, 0xffffff];
      L.hline(0, 15, 0, 0xe8eef4); L.hline(0, 15, 1, 0xffffff); L.hline(0, 15, 2, 0xd0dcea);
      for (let x = 0; x < 16; x++) {
        const len = [5, 2, 8, 3, 1, 6, 10, 2, 4, 7, 1, 9, 3, 5, 2, 6][x];
        for (let y = 3; y < 3 + len; y++) {
          const w = y < 3 + len - 2 ? 1 : 0;
          L.set(x, y, y === 2 + len ? I[1] : x % 2 ? I[2] : I[3]);
          if (w && x + 1 < 16 && len > 5 && y < 5) L.set(x, y, I[3]);
        }
      }
    }, { outline: 0x4a6a8c, drop: [1, 1, 0.26] });
  }
  /** a crack in the ground glowing from below (walkable, 2 frames) */
  function ember(f) {
    const { Img, P, glow } = K();
    const img = new Img(16, 16), O = new Img(16, 16);
    const path = [[1, 9], [3, 8], [5, 8], [6, 7], [8, 7], [9, 8], [11, 8], [12, 9], [14, 8]];
    const br = [[6, 7], [6, 5], [5, 3]], br2 = [[11, 8], [11, 10], [12, 12]];
    const draw = (pts, core) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
          img.put(x, y - 1, 0x1a0c08, 0.9); img.put(x, y + 1, 0x1a0c08, 0.7);
          img.put(x, y, core ? (f ? P.FIRE[4] : P.FIRE[5]) : (f ? P.FIRE[3] : P.FIRE[4]), 1);
        }
      }
    };
    draw(path, true); draw(br, false); draw(br2, false);
    glow(O, 8, 8, f ? 6 : 7, f ? 0.14 : 0.18, 0xff6020);
    img.over(O);
    // a spark rising
    img.put(f ? 9 : 7, f ? 3 : 5, P.FIRE[5], 0.9);
    return img;
  }
  /** a heap of grey ash with live sparks (walkable) */
  function ashPile() {
    const { FIRE } = K().P;
    return mk(16, 16, (L, t) => {
      const AS = [0x2a2624, 0x3c3634, 0x504846, 0x665c58, 0x7e746c, 0x988e84]; // PAL.ash
      for (let y = 6; y <= 14; y++) for (let x = 0; x < 16; x++) {
        const top = 11 - Math.round(Math.sin((x / 15) * Math.PI) * 4.5 + Math.sin(x * 1.3) * 0.6);
        if (y < top) continue;
        const u = (y - top) / Math.max(1, 14 - top);
        L.set(x, y, u < 0.2 ? AS[5] : x < 7 && u < 0.5 ? AS[4] : u > 0.75 ? AS[2] : AS[3]);
      }
      for (const [x, y] of [[6, 10], [10, 12], [8, 8], [4, 12]]) L.set(x, y, (x + y) % 3 ? FIRE[3] : FIRE[4]);
      L.set(12, 11, 0x1c1614); L.set(11, 11, 0x2c2420); // a charred stick
    }, { outline: 0x201a18, contact: [8, 14.6, 7.5, 1.2, 0.26] });
  }
  /** drifting sheets of blank paper (walkable, 2 frames: corners lift in the draught) */
  function paperDrift(f) {
    const { Img } = K();
    const t = tk(), L = t.buf(16, 16), img = new Img(16, 16);
    const PP = [0x9898a6, 0xc4c4cc, 0xe4e2dc, 0xf8f6ee];
    const sheet = (x0, y0, w, h, lift) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, (y === y0 + h - 1) ? PP[1] : (x + y) % 5 === 0 ? PP[2] : PP[3]);
      if (lift) { L.set(x0 + w - 1, y0, null); L.set(x0 + w - 2, y0 - 1, PP[3]); L.set(x0 + w - 1, y0 - 1, PP[2]); }
      else L.set(x0, y0 + h - 1, PP[2]);
      for (let x = x0 + 1; x < x0 + w - 1; x++) if ((x + y0) % 2) L.set(x, y0 + 2, PP[1]); // ruled line
    };
    sheet(2, 9, 6, 4, f === 1); sheet(8, 11, 5, 3, f === 0);
    // a sheet in the air, fluttering
    const fy = f ? 3 : 4, fx = f ? 10 : 9;
    L.hline(fx, fx + 3, fy, PP[3]); L.hline(fx + (f ? 1 : 0), fx + 3 + (f ? 0 : 1), fy + 1, PP[2]); L.set(fx + 1, fy + 2, PP[1]);
    L.outline(0x6a6a78);
    for (let x = 2; x <= 13; x++) img.put(x, 14, 0x0e0a14, 0.22);
    img.put(fx + 1, 14, 0x0e0a14, 0.18);
    img.buf(L);
    return img;
  }
  /** the bronze bell of the drowned chapel, half sunk and tilted (over bog / water) */
  function sunkenBell() {
    const { GOLD } = K().P;
    return mk(16, 16, (L, t, U) => {
      const BR = [0x2c3a30, 0x3c5a48, 0x4c7a60, 0x6c9a7c, 0x9cc4a0]; // verdigris over bronze
      const BZ = [0x5a3c18, 0x8c6428, 0xb48c40];
      for (let y = 2; y <= 12; y++) {
        const half = 2 + (y - 2) * 0.45 + (y > 9 ? 1 : 0);
        for (let x = Math.round(8 - half + (12 - y) * 0.15); x <= Math.round(8 + half + (12 - y) * 0.15); x++) {
          const u = (x - (8 - half)) / (2 * half);
          let c = u < 0.25 ? BR[4] : u < 0.5 ? BR[3] : u < 0.8 ? BR[2] : BR[1];
          if (t.hash(x, y, 961) < 0.25) c = BZ[1 + (u < 0.5 ? 1 : 0)];
          L.set(x, y, c);
        }
      }
      L.hline(3, 13, 11, BR[0]); L.set(9, 1, BR[2]); L.set(8, 1, BR[3]); L.set(9, 0, BR[1]); // crown
      L.hline(5, 11, 6, BZ[2]); L.set(6, 6, GOLD[4]); // a band catching light
      // the waterline: ripples and the dark reflection beneath
      for (let x = 1; x <= 14; x++) { L.set(x, 12, x % 3 ? 0x5a6c5c : 0x7a8c78); if (x > 2 && x < 13) U.put(x, 13, 0x0e1410, 0.5); }
    }, { outline: 0x101a12 });
  }
  /** a faded fresco of the firebird on the volcano temple wall */
  function muralFirebird() {
    const { FIRE, GOLD } = K().P;
    return mk(16, 16, (L, t) => {
      const W = [0xb89c7c, 0xccb28e, 0xdcc6a2]; // plaster
      for (let y = 1; y <= 14; y++) for (let x = 1; x <= 14; x++) L.set(x, y, t.hash(x, y, 971) < 0.2 ? W[0] : (x + y) % 5 === 0 ? W[2] : W[1]);
      // the bird: spread wings, a crest, a long flame tail
      const BIRD = [
        '..............',
        '......r.......',
        '.....rR.......',
        'r....RY.....r.',
        'rR..rRRr...Rr.',
        '.RRrRYYRr.RR..',
        '..RRRYYRRRR...',
        '....RRRRR.....',
        '.....RYR......',
        '.....rYr......',
        '....r.Y.r.....',
        '...r..Y..r....',
        '......y.......',
        '..............',
      ];
      const pal = { r: FIRE[1], R: FIRE[2], Y: GOLD[4], y: GOLD[3] };
      BIRD.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (pal[row[x]]) L.set(x + 1, y + 1, t.hash(x, y, 973) < 0.18 ? t.mix(pal[row[x]], W[1], 0.5) : pal[row[x]]); });
      // painted border and cracks
      for (let x = 1; x <= 14; x++) { L.set(x, 1, 0x8c4a28); L.set(x, 14, 0x8c4a28); }
      for (let y = 1; y <= 14; y++) { L.set(1, y, 0x8c4a28); L.set(14, y, 0x8c4a28); }
      L.line(10, 2, 12, 6, 0x6c5a48); L.set(4, 12, 0x6c5a48); L.set(5, 13, 0x6c5a48);
    }, { drop: [1, 1, 0.3] });
  }

  const D = {
    rails: () => railsCell({ l: true, r: true, u: false, d: false }).canvas(),
    minecart, ore_pile: orePile,
    forge: () => [0, 1].map((f) => forge(f)),
    mast, cannon, helm_wheel: helmWheel, rope_coil: ropeCoil,
    stump,
    mushrooms: () => mushroomsImg(false).canvas(),
    cobweb: () => cobwebImg('nw').canvas(),
    ivy, icicles,
    ember: () => [0, 1].map((f) => ember(f).canvas()),
    ash_pile: ashPile,
    paper_drift: () => [0, 1].map((f) => paperDrift(f).canvas()),
    sunken_bell: sunkenBell,
    mural_firebird: muralFirebird,
  };
  for (const id in D) R.Gfx.def('decor:' + id, D[id]);
  A.DUNGEON_DECOR = Object.keys(D);
})(window.RPG);
