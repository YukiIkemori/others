// Town-exterior decor art (DESIGN §7.1 decor layer): flowerbeds, hedges, street
// lamps, hanging shop signs, market stalls, fountains, carts, haystacks, bushes
// and small wells. Every piece is a transparent canvas drawn ON TOP of the
// ground tile (bottom-aligned, up to 16x32) with a soft translucent shadow, so
// it sits on grass, cobbles, dirt or snow alike.
//   'decor:<id>'            plain / standalone graphic (canvas or frames)
//   R.Art.decorAuto[id]     context pieces: flowerbeds, hedges and stalls join
//                           with their neighbours, a 2x2 / 3x3 block of
//                           'fountain' cells forms one round fountain, carts and
//                           bushes vary by position.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const AUTO = (A.decorAuto = A.decorAuto || {});
  const tk = () => A.TK;
  const NONE = -1;

  // ------------------------------------------------------------ palettes (dark → light)
  const INK = 0x1a1410;
  const INK_LEAF = 0x0c2210;
  const STONE = [0x34312c, 0x57534b, 0x7d776c, 0xa39c8e, 0xc8c1b0, 0xe8e2d2];
  const IRON = [0x14141c, 0x262632, 0x3a3a48, 0x545464, 0x747486, 0x9c9cb0];
  const WOOD = [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468];
  const LEAF = [0x0e2c10, 0x184818, 0x266622, 0x38862c, 0x52a43a, 0x74c050, 0xa4dc78];
  const STRAW = [0x5a3a10, 0x86621e, 0xb08a2c, 0xd4ac42, 0xecca66, 0xfae6a0];
  const SOIL = [0x2c1a0c, 0x4a2c16, 0x684022];
  const WATER = [0x0c2468, 0x16389a, 0x2250b8, 0x3470d0, 0x5890e0, 0x9cc8f8, 0xe8f6ff];
  const CLAY = [0x3c200e, 0x6c3c1c, 0x9c5c2c, 0xc47e42, 0xe2a462, 0xf6cc90];
  const GOLD = [0x5c3c08, 0x8c6414, 0xbc8c1c, 0xe0b430, 0xf8dc60, 0xfff4b0];
  const SACK = [0x5c4828, 0x8c7448, 0xb49c6c, 0xd4c094, 0xece0bc];
  const SHADOW = 0x0a0a22;

  // ------------------------------------------------------------ helpers
  const buf = (w, h) => new (tk().Buf)(w, h);
  const cached = (() => {
    const C = new Map();
    return (key, make) => { let v = C.get(key); if (v === undefined) { v = make(); C.set(key, v); } return v; };
  })();
  /** paint a pixel-string sprite: rows of chars, pal maps char → colour ('.' / ' ' transparent) */
  function pix(L, rows, pal, ox, oy) {
    for (let y = 0; y < rows.length; y++) {
      const r = rows[y];
      for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c != null) L.set(ox + x, oy + y, c); }
    }
  }
  /** canvas from the prop Buf L drawn over translucent layers [{m: mask Buf, col, a}] (shadows, glows) */
  function compose(L, layers) {
    const w = L.w, h = L.h, n = w * h;
    const cv = R.Gfx.makeCanvas(w, h), cx = cv.getContext('2d');
    const img = cx.createImageData(w, h), d = img.data;
    const fr = new Float32Array(n), fg = new Float32Array(n), fb = new Float32Array(n), fa = new Float32Array(n);
    for (const ly of layers || []) {
      const m = ly.m;
      if (!m) continue;
      for (let i = 0; i < n; i++) {
        const mv = m.p[i];
        if (mv === NONE) continue;
        const col = ly.col == null ? mv : ly.col;
        const a = ly.alpha ? ly.a * ((mv & 255) / 255) : ly.a;
        const da = fa[i], oa = a + da * (1 - a);
        if (oa <= 0) continue;
        fr[i] = (((col >> 16) & 255) * a + fr[i] * da * (1 - a)) / oa;
        fg[i] = (((col >> 8) & 255) * a + fg[i] * da * (1 - a)) / oa;
        fb[i] = ((col & 255) * a + fb[i] * da * (1 - a)) / oa;
        fa[i] = oa;
      }
    }
    for (let i = 0; i < n; i++) {
      const v = L.p[i], k = i * 4;
      if (v !== NONE) { d[k] = (v >> 16) & 255; d[k + 1] = (v >> 8) & 255; d[k + 2] = v & 255; d[k + 3] = 255; }
      else if (fa[i] > 0) { d[k] = fr[i]; d[k + 1] = fg[i]; d[k + 2] = fb[i]; d[k + 3] = Math.round(fa[i] * 255); }
    }
    cx.putImageData(img, 0, 0);
    return cv;
  }
  /** mask of L's opaque pixels shifted by (dx,dy) */
  function dropMask(L, dx, dy, m) {
    m = m || buf(L.w, L.h);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.p[y * L.w + x] !== NONE) m.set(x + dx, y + dy, 0);
    return m;
  }
  /**
   * Outline + shadow + canvas. o: {outline (col|false), diag, sx, sy (drop shadow offset),
   * ell:[cx,cy,rx,ry] ground contact shadow, sa (shadow alpha), glow:{m,col,a}}
   */
  function finish(L, o) {
    o = o || {};
    if (o.outline !== false) {
      const before = o.holes ? L.p.slice() : null;
      L.outline(o.outline || INK, o.diag);
      // open spaces inside a piece (between posts …) show the ground, not an ink frame
      if (o.holes) for (const [hx, hy, hw, hh] of o.holes) for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
        if (L.in(x, y) && before[y * L.w + x] === NONE) L.set(x, y, null);
      }
    }
    const sm = buf(L.w, L.h);
    if (o.sx != null) dropMask(L, o.sx, o.sy, sm);
    if (o.ell) sm.ellipse(o.ell[0], o.ell[1], o.ell[2], o.ell[3], 0);
    if (o.rects) for (const r of o.rects) sm.rect(r[0], r[1], r[2], r[3], 0);
    const layers = [{ m: sm, col: SHADOW, a: o.sa || 0.34 }];
    if (o.glow) layers.push(o.glow);
    return compose(L, layers);
  }
  const lrud = (m, x, y, id) => ({
    l: m.decorAt(x - 1, y) === id, r: m.decorAt(x + 1, y) === id,
    u: m.decorAt(x, y - 1) === id, d: m.decorAt(x, y + 1) === id,
  });
  const sig = (c) => (c.l ? 'l' : '') + (c.r ? 'r' : '') + (c.u ? 'u' : '') + (c.d ? 'd' : '');

  // ============================================================ flowerbed
  // Raised bed with a stone curb (lit top, front face with mortar joints), dark
  // soil under a lush foliage mound and four-petal flowers. Beds join with
  // neighbouring beds; flower colours vary per cell (position hash).
  const FLOWERS = [
    [0xff9c8c, 0xe83c3c, 0x9c1820, 0xffe070], // red
    [0xfffab8, 0xf8d838, 0xb08a14, 0xe87020], // yellow
    [0xffffff, 0xe4e8f4, 0x9aa2bc, 0xf8d040], // white
    [0xffd4ee, 0xf494cc, 0xb04c84, 0xfff4a0], // pink
    [0xc8dcff, 0x7098f0, 0x3050b0, 0xfff4a0], // blue
    [0xffd8a0, 0xf89838, 0xb85c14, 0xfff0a0], // orange
    [0xecc8ff, 0xb478ec, 0x6434a0, 0xfff0a0], // violet
  ];
  function flowerbed(c, cx, cy, ca, cb) {
    const t = tk(), L = buf(16, 16);
    const X0 = c.l ? 0 : 1, X1 = c.r ? 15 : 14, Y0 = c.u ? 0 : 1, Y1 = c.d ? 15 : 14;
    const G = (x, y) => [cx * 16 + x, cy * 16 + y];
    L.rect(X0, Y0, X1 - X0 + 1, Y1 - Y0 + 1, SOIL[1]);
    // back curb
    if (!c.u) {
      for (let x = X0; x <= X1; x++) { const [gx] = G(x, 0); L.set(x, Y0, gx % 6 === 0 ? STONE[3] : STONE[5]); L.set(x, Y0 + 1, STONE[3]); L.set(x, Y0 + 2, SOIL[0]); }
    }
    // side curbs (seen from above: 2 px wide, lit on the left)
    if (!c.l) for (let y = Y0; y <= Y1; y++) { L.set(X0, y, STONE[4]); L.set(X0 + 1, y, (cy * 16 + y) % 6 === 0 ? STONE[2] : STONE[3]); }
    if (!c.r) for (let y = Y0; y <= Y1; y++) { L.set(X1, y, STONE[2]); L.set(X1 - 1, y, (cy * 16 + y) % 6 === 0 ? STONE[2] : STONE[3]); }
    // foliage mound (rises a little over the back curb)
    const fx0 = c.l ? 0 : X0 + 2, fx1 = c.r ? 15 : X1 - 2;
    const fy0 = c.u ? 0 : Y0 + 1, fy1 = c.d ? 15 : 11;
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      const [gx, gy] = G(x, y);
      if (!c.u && y === fy0 && t.hash(gx, 0, 301) < 0.55) continue;
      if (!c.l && x === fx0 && (y === fy0 || t.hash(gx, gy, 303) < 0.3)) continue;
      if (!c.r && x === fx1 && (y === fy0 || t.hash(gx, gy, 305) < 0.3)) continue;
      const v = t.fnoise(gx, gy, 4, 64, 307);
      let col = v < 0.36 ? LEAF[2] : v < 0.62 ? LEAF[3] : LEAF[4];
      const u = (gx + ((gy >> 1) & 1) * 2) & 3, w = gy & 1;
      if (u === 0 && w === 0) col = LEAF[Math.min(6, LEAF.indexOf(col) + 1)];
      if (u === 3 && w === 1) col = LEAF[Math.max(1, LEAF.indexOf(col) - 1)];
      L.set(x, y, col);
    }
    // flowers on a staggered lattice in world coordinates (seamless across joined cells)
    const PA = FLOWERS[ca], PB = FLOWERS[cb];
    const inF = (x, y) => x >= fx0 && x <= fx1 && y >= fy0 + 1 && y <= fy1 && L.get(x, y) !== NONE;
    for (let ly = -2; ly <= 17; ly++) for (let lx = -2; lx <= 17; lx++) {
      const [gx, gy] = G(lx, ly);
      if (gy % 4 !== 1) continue;
      if ((gx + ((gy >> 2) & 1) * 2) % 4 !== 1) continue;
      const hh = t.hash(gx, gy, 311);
      if (hh < 0.12) continue;
      const jx = hh > 0.8 ? 1 : 0;
      const x = lx + jx, y = ly;
      if (!inF(x, y) && !inF(x, y + 1)) continue;
      const P = t.hash(gx, gy, 313) < 0.55 ? PA : PB;
      const put = (px, py, col) => { if (inF(px, py)) L.set(px, py, col); };
      put(x + 1, y + 1, LEAF[1]);
      put(x, y - 1, P[0]); put(x - 1, y, P[0]); put(x + 1, y, P[1]); put(x, y + 1, P[2]); put(x, y, P[3]);
    }
    // front curb: lit top edge and a face of stone blocks
    if (!c.d) {
      for (let x = X0; x <= X1; x++) {
        const [gx] = G(x, 0);
        L.set(x, 11, STONE[5]); L.set(x, 12, STONE[4]);
        L.set(x, 13, (gx + 3) % 6 === 0 ? STONE[1] : STONE[3]);
        L.set(x, 14, (gx + 3) % 6 === 0 ? STONE[1] : STONE[2]);
      }
      if (!c.l) { L.set(X0, 11, STONE[4]); L.set(X0, 13, STONE[4]); L.set(X0, 14, STONE[3]); }
      if (!c.r) { L.set(X1, 12, STONE[3]); L.set(X1, 13, STONE[2]); L.set(X1, 14, STONE[1]); }
    }
    if (!c.u && !c.l) L.set(X0, Y0, null);
    if (!c.u && !c.r) L.set(X1, Y0, null);
    return finish(L, { outline: INK, rects: c.d ? [] : [[X0 + 1, 15, X1 - X0 + 1, 1]], sa: 0.3 });
  }
  function flowerCols(x, y) {
    const t = tk();
    const a = Math.floor(t.hash(x, y, 317) * FLOWERS.length);
    let b = Math.floor(t.hash(x, y, 319) * FLOWERS.length);
    if (b === a) b = (a + 3) % FLOWERS.length;
    return [a, b];
  }
  AUTO.flowerbed = (m, x, y) => {
    const c = lrud(m, x, y, 'flowerbed'), [ca, cb] = flowerCols(x, y);
    // the lattice depends on the cell's world position modulo 4 only
    return cached('fb|' + sig(c) + '|' + (x & 3) + (y & 3) + '|' + ca + cb, () => flowerbed(c, x & 3, y & 3, ca, cb));
  };

  // ============================================================ hedge
  // Clipped box hedge in 3/4 view: a bright leafy top and a darker front face,
  // joining into rows and blocks with neighbouring hedge cells.
  function leafScale(t, gx, gy, base, pal) {
    // overlapping leaf "scales": lit upper rims, shaded lower edges
    const row = Math.floor(gy / 3), off = (row & 1) * 2;
    const lx = (gx + off) & 3, ly = gy % 3;
    let i = base;
    if (ly === 0 && (lx === 1 || lx === 2)) i += 1;
    if (ly === 2 || lx === 3) i -= 1;
    if (t.hash(gx, gy, 331) < 0.06) i += 1;
    if (t.hash(gx, gy, 333) < 0.05) i -= 1;
    return pal[Math.max(0, Math.min(pal.length - 1, i))];
  }
  function hedge(c, cx, cy) {
    const t = tk(), L = buf(16, 16);
    const X0 = c.l ? 0 : 1, X1 = c.r ? 15 : 14;
    const top0 = c.u ? 0 : 2, faceY = c.d ? 99 : 9, Y1 = c.d ? 15 : 14;
    for (let y = top0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const gx = cx * 16 + x, gy = cy * 16 + y;
      let col;
      if (y < faceY) {
        const v = t.fnoise(gx, gy, 4, 128, 335);
        col = leafScale(t, gx, gy, v < 0.4 ? 4 : 5, LEAF);
        if (!c.u && y === top0) col = (gx & 3) === 0 ? null : LEAF[6];
        else if (!c.u && y === top0 + 1 && (gx & 3) === 0) col = LEAF[5];
        if (!c.l && x === X0 && col != null) col = LEAF[5];
        if (!c.r && x === X1 && col != null) col = LEAF[3];
        if (!c.d && y === faceY - 1) col = LEAF[6];
      } else {
        const fy = y - faceY;
        col = leafScale(t, gx, gy + 1, [4, 3, 3, 2, 2, 1][fy], LEAF);
        if (fy === 0 && (gx & 1)) col = LEAF[5];
        if (fy === 5 && t.hash(gx, 0, 337) < 0.35) col = LEAF[0];
        if (!c.l && x === X0) col = fy < 3 ? LEAF[4] : LEAF[3];
        if (!c.r && x === X1) col = LEAF[1];
      }
      L.set(x, y, col);
    }
    // rounded outer corners
    if (!c.u && !c.l) { L.set(X0, top0, null); L.set(X0, top0 + 1, null); L.set(X0 + 1, top0, null); }
    if (!c.u && !c.r) { L.set(X1, top0, null); L.set(X1, top0 + 1, null); L.set(X1 - 1, top0, null); }
    if (!c.d && !c.l) L.set(X0, Y1, null);
    if (!c.d && !c.r) L.set(X1, Y1, null);
    return finish(L, { outline: INK_LEAF, rects: c.d ? [] : [[X0 + 1, 15, X1 - X0 + 1, 1]], sa: 0.36 });
  }
  AUTO.hedge = (m, x, y) => {
    const c = lrud(m, x, y, 'hedge');
    return cached('hg|' + sig(c) + '|' + (x & 7) + (y & 7), () => hedge(c, x & 7, y & 7));
  };

  // ============================================================ street lamp
  // Iron post on a stone foot, lantern with a glowing pane; frames flicker the
  // flame and the warm halo (drawn translucent over whatever is around it).
  function lamp(f) {
    const t = tk(), L = buf(16, 32);
    const lvl = [1, 0.6, 0.9, 0.75][f], fy = [7.6, 8.2, 7.2, 7.9][f];
    const GL = [0xa04c10, 0xe88a28, 0xffc048, 0xffe890, 0xfffce8];
    // stone foot
    L.rect(5, 27, 6, 4, STONE[3]); L.hline(5, 10, 27, STONE[5]); L.vline(5, 27, 30, STONE[4]); L.vline(10, 28, 30, STONE[2]); L.hline(5, 10, 30, STONE[1]);
    L.rect(6, 25, 4, 2, IRON[3]); L.hline(6, 9, 25, IRON[4]); L.set(9, 26, IRON[1]);
    // post
    for (let y = 13; y < 25; y++) { L.set(7, y, IRON[4]); L.set(8, y, IRON[2]); }
    L.rect(6, 19, 4, 2, IRON[3]); L.hline(6, 9, 19, IRON[5]); L.set(9, 20, IRON[1]);
    // scroll brackets under the lantern
    L.set(5, 13, IRON[3]); L.set(6, 14, IRON[3]); L.set(10, 13, IRON[2]); L.set(9, 14, IRON[2]);
    L.rect(6, 12, 4, 1, IRON[3]); L.set(6, 12, IRON[4]);
    // lantern: roof, pane, base plate
    L.set(7, 1, IRON[4]); L.set(8, 1, IRON[3]);
    L.hline(6, 9, 2, IRON[3]); L.set(6, 2, IRON[5]);
    L.hline(5, 10, 3, IRON[3]); L.set(5, 3, IRON[4]); L.set(6, 3, IRON[5]); L.set(10, 3, IRON[1]);
    L.hline(4, 11, 4, IRON[2]); L.set(4, 4, IRON[4]); L.set(11, 4, IRON[1]);
    for (let y = 5; y <= 10; y++) {
      L.set(5, y, IRON[3]); L.set(10, y, IRON[1]);
      for (let x = 6; x <= 9; x++) {
        const d = Math.hypot(x - 7.5, (y - fy) * 0.9);
        const k = Math.max(0, Math.min(4, Math.round(4.4 - d * 1.3 - (1 - lvl) * 2.5)));
        L.set(x, y, GL[k]);
      }
    }
    L.set(6, 5, t.mix(GL[2], IRON[4], 0.3));
    L.hline(4, 11, 11, IRON[3]); L.set(4, 11, IRON[4]); L.set(11, 11, IRON[1]);
    // warm light on the iron (roof underside, bracket)
    L.set(7, 4, t.mix(IRON[2], GL[2], 0.5)); L.set(8, 4, t.mix(IRON[2], GL[2], 0.4));
    L.set(7, 12, t.mix(IRON[3], GL[1], 0.4));
    // halo (translucent) around the pane
    const glow = buf(16, 32);
    const rad = f === 1 ? 5.4 : f === 3 ? 6.0 : 6.6;
    for (let y = 0; y < 18; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, (y - 7.5) * 1.05);
      if (d > rad) continue;
      const a = Math.round(255 * Math.min(1, (1 - d / rad) * 1.25));
      if ((x + y) % 2 && d > rad - 1.6) continue;
      glow.set(x, y, a);
    }
    return finish(L, { outline: INK, ell: [9.5, 30.5, 3.2, 1.2], sa: 0.36, glow: { m: glow, col: 0xffd878, a: 0.62, alpha: true } });
  }

  // ============================================================ shop signs
  // A post with an arm; the board hangs on two rings and shows a clear icon.
  const SIGN_ICON = {
    // sword (weapon shop)
    weapon: {
      rows: [
        '....kk....',
        '...kwsk...',
        '...kwsk...',
        '...kwsk...',
        '...kwsk...',
        '.kkkwskkk.',
        'kyyyyyyyGk',
        '.kkkbBkkk.',
        '...kbBk...',
        '...kyGk...',
        '....kk....',
      ],
      pal: { k: INK, w: 0xf4f8ff, s: 0xa0a8c4, y: GOLD[4], G: GOLD[2], b: WOOD[3], B: WOOD[1] },
    },
    // heater shield with a gold boss (armour shop)
    armor: {
      rows: [
        'kkkkkkkkkk',
        'kssssssssk',
        'ksbbbbbbDk',
        'ksbbyybbDk',
        'ksbyYYybDk',
        'ksbbyybbDk',
        'ksbbbbbbDk',
        '.ksbbbbDk.',
        '.ksbbbDDk.',
        '..ksbDDk..',
        '...kkkk...',
      ],
      pal: { k: INK, s: 0xdce2f0, b: 0x3a64c8, D: 0x22408c, y: GOLD[3], Y: GOLD[5] },
    },
    // drawstring pouch (item shop)
    item: {
      rows: [
        '..kk..kk..',
        '..kLkkLk..',
        '...kLLk...',
        '...krrk...',
        '..kllLLk..',
        '.kllllLLk.',
        'klwllllLDk',
        'kllllllLDk',
        'klllllLLDk',
        '.kllLLLDk.',
        '..kkkkkk..',
      ],
      pal: { k: INK, l: SACK[3], L: SACK[2], D: SACK[1], w: SACK[4], r: 0xc83030 },
    },
    // bed seen from the side (inn)
    inn: {
      rows: [
        '.kkkkkkkk.',
        'kbbbbbbbBk',
        'kBwwwwwgBk',
        'kBwwwwggBk',
        'kRrrrrrrRk',
        'kRRRRRRRDk',
        'kRrRRRRRDk',
        'kRRRRRrRDk',
        'kRRRRRRRDk',
        'kbbbbbbbBk',
        '.kk....kk.',
      ],
      pal: { k: INK, b: WOOD[4], B: WOOD[2], w: 0xfcfcff, g: 0xc8ccdc, R: 0xd8403c, r: 0xf48870, D: 0x9c2024 },
    },
    // cross (church)
    church: {
      rows: [
        '...kkkk...',
        '...kyyk...',
        '...kyGk...',
        'kkkkyGkkkk',
        'kyyyyyyyyk',
        'kGGGyGGGGk',
        'kkkkyGkkkk',
        '...kyGk...',
        '...kyGk...',
        '...kyGk...',
        '...kkkk...',
      ],
      pal: { k: INK, y: GOLD[4], G: GOLD[2] },
    },
  };
  // Chronicle: the tavern (a foaming tankard) and the magic shop (a star over a staff)
  SIGN_ICON.tavern = {
    rows: [
      '..wwwww...',
      '.wWwwwWw..',
      'kwwwwwwwk.',
      'kYyYYYYkkk',
      'kyYYYyYk.k',
      'kYYYYYYk.k',
      'kyYYyYYk.k',
      'kYYYYYYkkk',
      'kyYYYYYk..',
      'kGGGGGGk..',
      '.kkkkkk...',
    ],
    pal: { k: INK, w: 0xf4f0e4, W: 0xffffff, Y: 0xd89a2c, y: 0xf4c460, G: 0x8c5a14 },
  };
  SIGN_ICON.magic = {
    rows: [
      '.....y....',
      '....yWy...',
      '.yyyYWYyy.',
      '..yYWWYy..',
      '...yYYy...',
      '..yY.kYy..',
      '..y.kbk.y.',
      '....kbk...',
      '....kBk...',
      '....kbk...',
      '.....k....',
    ],
    pal: { k: INK, y: GOLD[3], Y: GOLD[4], W: GOLD[5], b: 0x9c7ad0, B: 0x6c4ca0 },
  };
  const PANEL = { tavern: [0x6c4424, 0x8c5c34, 0x4c2c14], magic: [0x24305c, 0x3a4a84, 0x141c40], weapon: [0xf2e4be, 0xfcf4dc, 0xd2bc8c], armor: [0xf2e4be, 0xfcf4dc, 0xd2bc8c], item: [0xf2e4be, 0xfcf4dc, 0xd2bc8c],
    inn: [0xf2e4be, 0xfcf4dc, 0xd2bc8c], church: [0xdce6f4, 0xf6faff, 0xaebcd4] };
  function shopSign(kind) {
    const L = buf(16, 32);
    // stone foot + post
    L.rect(0, 28, 5, 3, STONE[3]); L.hline(0, 4, 28, STONE[5]); L.hline(0, 4, 30, STONE[1]); L.set(4, 29, STONE[2]);
    for (let y = 4; y < 28; y++) { L.set(1, y, WOOD[4]); L.set(2, y, y % 5 === 0 ? WOOD[1] : WOOD[2]); }
    L.set(1, 3, WOOD[5]); L.set(2, 3, WOOD[3]);
    // arm with a diagonal brace
    L.hline(1, 14, 5, WOOD[4]); L.hline(1, 14, 6, WOOD[2]); L.set(14, 5, WOOD[3]); L.set(15, 5, null);
    L.set(3, 10, WOOD[3]); L.set(4, 9, WOOD[3]); L.set(5, 8, WOOD[3]); L.set(6, 7, WOOD[3]);
    L.set(3, 11, WOOD[2]); L.set(4, 10, WOOD[2]); L.set(5, 9, WOOD[2]);
    // rings
    for (const x of [5, 12]) { L.set(x, 7, IRON[4]); L.set(x, 8, IRON[2]); }
    // board: wooden frame around a painted panel
    const P = PANEL[kind];
    L.rect(3, 9, 12, 15, WOOD[3]);
    L.hline(3, 14, 9, WOOD[5]); L.vline(3, 9, 23, WOOD[4]); L.vline(14, 10, 23, WOOD[1]); L.hline(4, 14, 23, WOOD[1]);
    L.rect(4, 10, 10, 13, P[0]); L.hline(4, 13, 10, P[1]); L.vline(4, 10, 21, P[1]); L.hline(5, 13, 22, P[2]); L.vline(13, 11, 22, P[2]);
    const ic = SIGN_ICON[kind];
    pix(L, ic.rows, ic.pal, 4, 11);
    return finish(L, { outline: INK, ell: [3.5, 30.5, 3, 1.1], rects: [[5, 24, 9, 1]], sa: 0.3 });
  }

  // ============================================================ market stall
  // Striped awning above (reaching into the row behind, where the vendor
  // stands), posts at the ends, a counter with a cloth skirt and wares.
  // Neighbouring stall cells merge into one long stall; the awning colour is
  // chosen per stall, the wares per cell.
  const AWNING = [
    [0xa01c1c, 0xd83a2e, 0xf06a50], // red
    [0x1c3c8c, 0x2e62c8, 0x5a8ce8], // blue
    [0x1c6a2c, 0x2e9440, 0x58b860], // green
    [0x9c5a10, 0xe08c20, 0xf4b450], // orange
    [0x5a2480, 0x8444b0, 0xac70d4], // purple
  ];
  const CREAM = [0xb8ac8c, 0xe0d6bc, 0xfaf4e4];
  function wares(L, kind, gx) {
    const t = tk();
    const ball = (x, y, P) => { L.set(x, y, P[1]); L.set(x + 1, y, P[1]); L.set(x, y + 1, P[1]); L.set(x + 1, y + 1, P[0]); L.set(x, y, P[2]); };
    // shallow basket / crate on the counter
    const basket = (x0, x1, col) => { for (let x = x0; x <= x1; x++) { L.set(x, 20, col[1]); L.set(x, 21, x % 2 ? col[0] : col[1]); } L.set(x0, 19, col[1]); L.set(x1, 19, col[0]); };
    const WICKER = [0x7c5424, 0xb4843c];
    if (kind === 0) { // apples
      basket(2, 7, WICKER); basket(9, 13, WICKER);
      for (const [x, y] of [[2, 18], [4, 18], [6, 18], [3, 16], [5, 16], [9, 18], [11, 18], [10, 16], [12, 17]]) ball(x, y, [0x8c1414, 0xd83028, 0xff8c70]);
    } else if (kind === 1) { // oranges & lemons
      basket(2, 7, WICKER); basket(9, 13, WICKER);
      for (const [x, y] of [[2, 18], [4, 18], [6, 18], [3, 16], [5, 16]]) ball(x, y, [0xb05810, 0xf09028, 0xffd080]);
      for (const [x, y] of [[9, 18], [11, 18], [10, 16], [12, 17]]) ball(x, y, [0xa08810, 0xf0d830, 0xfff4a0]);
    } else if (kind === 2) { // cabbages & carrots
      for (const x of [2, 7]) { L.ellipse(x + 2, 18, 2.2, 2, 0x3c8a2c); L.set(x + 1, 17, 0x8ccc58); L.set(x + 2, 17, 0x6cb444); L.set(x + 3, 19, 0x266622); L.set(x + 2, 18, 0xa4dc78); }
      for (let i = 0; i < 3; i++) { const x = 11 + i; L.vline(x, 18, 20, i % 2 ? 0xd86818 : 0xf08828); L.set(x, 17, 0x52a43a); L.set(x, 16, 0x74c050); }
    } else if (kind === 3) { // bread loaves
      for (const [x, y] of [[2, 18], [6, 17], [10, 18]]) {
        L.ellipse(x + 1.5, y + 1, 2.2, 1.4, 0xc07c34); L.hline(x, x + 3, y, 0xe0a458); L.set(x + 1, y + 1, 0xf0c888); L.set(x + 3, y + 2, 0x8c5020);
      }
      L.hline(3, 5, 17, 0xe0a458);
    } else if (kind === 4) { // clay pots and a jug
      for (const [x, big] of [[3.5, 1], [8, 0], [12, 1]]) {
        const r = big ? 2.3 : 1.8, cy = 19.2;
        L.shadeEllipse(x, cy, r, r * 0.9, [CLAY[1], CLAY[2], CLAY[3], CLAY[4]], { dither: 0.3 });
        const x0 = Math.round(x - 1), x1 = Math.round(x + 0.4);
        L.hline(x0, x1 + (big ? 1 : 0), Math.round(cy - r) - 1, CLAY[5]); L.set(x1 + (big ? 1 : 0), Math.round(cy - r) - 1, CLAY[3]);
        L.hline(x0 + 1, x1, Math.round(cy - r), CLAY[0]);
      }
    } else if (kind === 5) { // fish on a tray
      L.hline(2, 13, 20, 0x8890a4); L.hline(2, 13, 21, 0x5c6478);
      for (const [x, y] of [[2, 18], [7, 17], [9, 19]]) { L.hline(x + 1, x + 4, y, 0xc8d4e4); L.hline(x + 1, x + 4, y + 1, 0x8898b4); L.set(x, y, 0x5c6c8c); L.set(x, y + 1, 0x5c6c8c); L.set(x + 4, y, 0x202830); }
    } else { // cloth bolts
      const C = [[0x8c1c1c, 0xd84040], [0x1c3c8c, 0x4a78d8], [0x9c7c10, 0xf0cc40], [0x1c6a2c, 0x46a456]];
      for (let i = 0; i < 4; i++) {
        const P = C[(i + gx) % 4], x = 2 + i * 3;
        L.rect(x, 16 + (i % 2), 3, 5 - (i % 2), P[1]); L.vline(x + 2, 16 + (i % 2), 20, P[0]); L.hline(x, x + 2, 16 + (i % 2), t.shade(P[1], 0.35));
      }
    }
  }
  function stall(c, gx, colIdx, kind) {
    const L = buf(16, 32);
    const AW = AWNING[colIdx];
    const X0 = c.l ? 0 : 1, X1 = c.r ? 15 : 14;
    const stripe = (x) => (Math.floor((gx * 16 + x) / 4) & 1);
    // posts at the stall's ends (behind the table, holding the awning)
    if (!c.l) { L.vline(1, 9, 16, WOOD[4]); L.vline(2, 9, 16, WOOD[2]); }
    if (!c.r) { L.vline(13, 9, 16, WOOD[3]); L.vline(14, 9, 16, WOOD[1]); }
    // awning: canopy slope with stripes, lit toward the front, scalloped valance
    for (let y = 1; y <= 11; y++) for (let x = X0; x <= X1; x++) {
      const st = stripe(x), sp = (gx * 16 + x) % 4;
      let col;
      if (y === 1) col = st ? CREAM[0] : AW[0];
      else if (y <= 7) { const lit = y <= 3 ? 0 : y <= 5 ? 1 : 2; col = st ? CREAM[lit] : AW[lit]; }
      else if (y === 8) col = st ? CREAM[2] : AW[2];
      else if (y === 9) col = st ? CREAM[1] : AW[1];
      else if (y === 10) col = sp === 3 ? null : st ? CREAM[1] : AW[1];
      else col = sp === 1 || sp === 2 ? (st ? CREAM[0] : AW[0]) : null;
      L.set(x, y, col);
    }
    if (!c.l) { L.set(X0, 1, null); for (let y = 2; y <= 9; y++) L.set(X0, y, stripe(X0) ? CREAM[2] : AW[2]); }
    if (!c.r) { L.set(X1, 1, null); for (let y = 2; y <= 9; y++) L.set(X1, y, stripe(X1) ? CREAM[0] : AW[0]); }
    // table top (planks seen from above) with the wares on it
    for (let y = 16; y <= 22; y++) for (let x = 0; x <= 15; x++) {
      const sx = gx * 16 + x;
      let col = y === 16 ? WOOD[3] : y === 19 ? WOOD[3] : WOOD[4];
      if (y !== 16 && y !== 19 && (sx + (y > 19 ? 7 : 0)) % 11 === 0) col = WOOD[3];
      L.set(x, y, col);
    }
    if (!c.l) L.vline(0, 16, 22, WOOD[5]);
    if (!c.r) L.vline(15, 16, 22, WOOD[3]);
    wares(L, kind, gx);
    // front: lit edge, cloth band with scallops over a plank face
    for (let x = 0; x <= 15; x++) {
      const st = stripe(x), sp = (gx * 16 + x) % 4, sx = gx * 16 + x;
      L.set(x, 23, WOOD[5]);
      L.set(x, 24, st ? CREAM[2] : AW[2]); L.set(x, 25, st ? CREAM[1] : AW[1]);
      if (sp === 1 || sp === 2) L.set(x, 26, st ? CREAM[0] : AW[0]);
      for (let y = 26; y <= 30; y++) if (L.get(x, y) === NONE) L.set(x, y, y === 30 || sx % 5 === 0 ? WOOD[1] : WOOD[2]);
    }
    if (!c.l) { L.vline(0, 23, 30, WOOD[4]); }
    if (!c.r) { L.vline(15, 23, 30, WOOD[1]); }
    const hx0 = c.l ? 0 : 3, hx1 = c.r ? 15 : 12;
    return finish(L, { outline: INK, holes: [[hx0, 13, hx1 - hx0 + 1, 2]], rects: [[0, 12, 16, 4], [1, 31, 15, 1]], sa: 0.26 });
  }
  function stripeCol(sx, AW, k) { return (Math.floor(sx / 4) & 1) ? CREAM[k] : AW[k]; }
  AUTO.stall = (m, x, y) => {
    const t = tk();
    const c = { l: m.decorAt(x - 1, y) === 'stall', r: m.decorAt(x + 1, y) === 'stall' };
    let x0 = x;
    while (m.decorAt(x0 - 1, y) === 'stall') x0--;
    const col = Math.floor(t.hash(x0, y, 341) * AWNING.length);
    const kind = Math.floor(t.hash(x, y, 343) * 7);
    return cached('st|' + sig(c) + '|' + (x & 3) + '|' + col + '|' + kind, () => stall(c, x & 3, col, kind));
  };

  // ============================================================ fountain
  // A w×h block of 'fountain' cells (1x1 … 4x4, 2x2 / 3x3 intended) is one
  // round basin: stone rim and wall with mortar joints, rippling water, a
  // column with an upper bowl and a spraying jet. 4 frames.
  const FOUNT_EX = 10; // extra pixels above the block for the jet
  function fountainBig(w, h, f) {
    const t = tk();
    const W = w * 16, H = h * 16 + FOUNT_EX, oy = FOUNT_EX;
    const L = buf(W, H);
    const big = Math.min(w, h) >= 3, small = Math.min(w, h) === 1;
    const wallH = big ? 7 : small ? 3 : 5, rimT = big ? 3 : 2;
    const cx = W / 2 - 0.5;
    const rx = W / 2 - 1.5, ry = (h * 16 - wallH) / 2 - 1.5, cy = oy + ry + 1.5;
    const irx = rx - rimT, iry = ry - rimT * 0.8;
    const ed = (x, y, ax, ay) => ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2;
    // wall face (below the front half of the rim)
    for (let x = 0; x < W; x++) {
      const u = (x - cx) / rx;
      if (Math.abs(u) > 1) continue;
      const yb = cy + ry * Math.sqrt(1 - u * u);
      for (let y = Math.floor(yb) - 1; y <= Math.floor(yb) + wallH; y++) {
        const fy = y - Math.floor(yb);
        let col = u < -0.55 ? STONE[3] : u > 0.45 ? STONE[1] : STONE[2];
        const course = fy < wallH / 2 ? 0 : 1;
        if (fy === Math.floor(wallH / 2)) col = STONE[1];
        if ((x + course * 3) % 6 === 0) col = STONE[1];
        if (fy === wallH) col = STONE[0];
        if (fy === 1 && u > -0.8) col = t.mul(col, 0.8);
        L.set(x, y, col);
      }
    }
    // rim (top surface): lit upper-left, stone segments
    for (let y = oy; y < H; y++) for (let x = 0; x < W; x++) {
      const e = ed(x + 0.5 - 0.5, y, rx, ry);
      if (e > 1) continue;
      if (ed(x, y, irx, iry) <= 1) continue;
      const ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const seg = Math.floor((ang + Math.PI) / (Math.PI / (big ? 8 : 6)));
      const edge = Math.abs(((ang + Math.PI) / (Math.PI / (big ? 8 : 6))) - seg);
      const lit = -(Math.cos(ang) * 0.6 + Math.sin(ang) * 0.8);
      let col = lit > 0.3 ? STONE[5] : lit < -0.4 ? STONE[3] : STONE[4];
      if (e > 0.86) col = lit > 0 ? STONE[4] : STONE[2];
      if (ed(x, y, irx + 1, iry + 0.8) <= 1) col = lit > 0 ? STONE[2] : STONE[4];
      if (edge < 0.12 && e < 0.9) col = STONE[2];
      L.set(x, y, col);
    }
    // water
    const wcx = cx, wcy = cy + 0.5;
    for (let y = oy; y < H; y++) for (let x = 0; x < W; x++) {
      if (ed(x, y, irx, iry) > 1) continue;
      const dy = (y - (cy - iry)) / (2 * iry);
      let col = dy < 0.14 ? WATER[1] : WATER[2];
      const v = t.fnoise(x, y * 2, 8, 64, 351);
      if (v < 0.3 && y % 2) col = WATER[1];
      // expanding ripple rings
      const r = Math.hypot((x - wcx) / (irx / iry), (y - wcy));
      for (let k = 0; k < 3; k++) {
        const rr = (((f + k * 4) / 12) * iry * 1.25 + (big ? 3 : 2));
        if (Math.abs(r - rr) < 0.5 && dy > 0.12) col = (x + f) % 3 ? WATER[3] : WATER[4];
      }
      if (t.hash(x, y, 353 + f) < 0.015 && dy > 0.2) col = WATER[6];
      L.set(x, y, col);
    }
    // column + upper bowl + jet
    const colW = big ? 4 : small ? 2 : 3, colH = big ? 13 : small ? 6 : 9;
    const baseY = Math.round(wcy + (big ? 2 : 1));
    const topY = baseY - colH;
    const c0 = Math.round(cx - colW / 2 + 0.5);
    // splash ring at the foot
    for (let x = c0 - 3; x <= c0 + colW + 2; x++) {
      const on = (x + f) % 2 === 0;
      L.set(x, baseY + 1, on ? WATER[6] : WATER[5]);
      if ((x + f) % 3 === 0) L.set(x, baseY, WATER[5]);
    }
    for (let y = topY; y <= baseY; y++) for (let i = 0; i < colW; i++) {
      L.set(c0 + i, y, i === 0 ? STONE[5] : i === colW - 1 ? STONE[2] : STONE[3 + (i === 1 ? 1 : 0)]);
    }
    L.hline(c0 - 1, c0 + colW, baseY - 1, STONE[3]);
    // upper bowl
    const brx = big ? 7 : small ? 3 : 5, bry = big ? 2.2 : 1.5;
    const bcy = topY;
    for (let y = Math.floor(bcy - bry - 1); y <= Math.ceil(bcy + bry + 2); y++) for (let x = Math.floor(cx - brx - 1); x <= Math.ceil(cx + brx + 1); x++) {
      const e = ((x - cx) / (brx + 0.5)) ** 2 + ((y - bcy) / (bry + 0.5)) ** 2;
      const e2 = ((x - cx) / (brx + 0.5)) ** 2 + ((y - bcy - 1.5) / (bry + 0.5)) ** 2;
      if (e <= 1) L.set(x, y, e > 0.55 ? (x < cx ? STONE[5] : STONE[4]) : (y < bcy ? WATER[3] : WATER[4]));
      else if (e2 <= 1 && y > bcy) L.set(x, y, x < cx - brx * 0.4 ? STONE[3] : x > cx + brx * 0.4 ? STONE[1] : STONE[2]);
    }
    L.outline(INK);
    // jet: a 2 px column with a crown, droplets arcing down to the bowl rim
    // (they advance a quarter step per frame), streams from the bowl lip
    const jetH = big ? 10 : small ? 6 : 8;
    const jx0 = Math.floor(cx), jx1 = jx0 + 1, jtop = Math.round(bcy - jetH);
    for (let y = jtop; y < bcy; y++) {
      L.set(jx0, y, (y + f) % 3 === 0 ? WATER[5] : WATER[6]);
      L.set(jx1, y, (y + f) % 3 === 1 ? WATER[6] : WATER[5]);
    }
    L.set(jx0, jtop - 1, WATER[6]); L.set(jx1, jtop - 1, WATER[6]);
    L.set(jx0 - 1, jtop, WATER[5]); L.set(jx1 + 1, jtop, WATER[5]);
    if (f & 1) { L.set(jx0, jtop - 2, WATER[5]); } else { L.set(jx1, jtop - 2, WATER[5]); }
    for (const side of [-1, 1]) {
      const span = brx + 0.5, ox = side < 0 ? jx0 : jx1;
      const n = big ? 6 : small ? 3 : 5;
      for (let s = 0; s < n; s++) {
        const q = (s + f / 4) / n;
        const at = (qq) => [Math.round(ox + side * (0.6 + qq * span)), Math.round(jtop + (bcy - jtop) * qq * qq)];
        const [x, y] = at(q), [tx, ty] = at(Math.max(0, q - 0.6 / n));
        if (tx !== x || ty !== y) L.set(tx, ty, WATER[4]);
        L.set(x, y, WATER[6]);
      }
      // streams from the bowl lip down to the basin
      const sx = cx + side * (brx + 0.6);
      for (let y = Math.ceil(bcy + bry); y <= baseY; y++) {
        L.set(Math.round(sx + side * (y - bcy) * 0.12), y, (y + f) % 3 === 0 ? WATER[4] : WATER[6]);
      }
      // splash where the streams land
      const lx = Math.round(sx + side * (baseY - bcy) * 0.12);
      L.set(lx - 1, baseY + 1, (f & 1) ? WATER[6] : WATER[5]); L.set(lx + 1, baseY + 1, (f & 1) ? WATER[5] : WATER[6]);
      if (f % 2 === 0) L.set(lx + side, baseY - 1, WATER[6]);
    }
    // soft shadow along the base of the wall (inside the block)
    const sm = buf(W, H);
    for (let x = 0; x < W; x++) {
      const u = (x - cx) / rx;
      if (Math.abs(u) > 1) continue;
      const yb = cy + ry * Math.sqrt(1 - u * u) + wallH + 2;
      if (u > -0.5) { sm.set(x, Math.floor(yb), 0); if (yb + 1 < H) sm.set(x + 1, Math.floor(yb) - 1, 0); }
    }
    return { L, sm, W, H };
  }
  function fountainPieces(w, h) {
    return cached('fnt|' + w + 'x' + h, () => {
      const frames = [0, 1, 2, 3].map((f) => fountainBig(w, h, f));
      const pieces = {};
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const top = j === 0 ? FOUNT_EX : 0;
        pieces[i + ',' + j] = frames.map(({ L, sm }) => {
          const y0 = j * 16 + FOUNT_EX - top, ph = 16 + top;
          return compose(L.crop(i * 16, y0, 16, ph), [{ m: sm.crop(i * 16, y0, 16, ph), col: SHADOW, a: 0.34 }]);
        });
      }
      return pieces;
    });
  }
  function fountainBlock(m, x, y) {
    let x0 = x, y0 = y;
    while (x - x0 < 4 && m.decorAt(x0 - 1, y) === 'fountain') x0--;
    while (y - y0 < 4 && m.decorAt(x, y0 - 1) === 'fountain') y0--;
    let w = 1, h = 1;
    while (w < 4 && m.decorAt(x0 + w, y0) === 'fountain') w++;
    while (h < 4 && m.decorAt(x0, y0 + h) === 'fountain') h++;
    return { x0, y0, w, h };
  }
  AUTO.fountain = (m, x, y) => {
    const b = fountainBlock(m, x, y);
    const i = x - b.x0, j = y - b.y0;
    if (i >= b.w || j >= b.h) return null;
    return fountainPieces(b.w, b.h)[i + ',' + j];
  };

  // ============================================================ cart
  // Two-wheeled hand cart, handles to the left, with a load that varies.
  function cart(load) {
    const t = tk(), L = buf(16, 20);
    // load (sits in the bed, rises above it)
    if (load === 0) { // grain sacks
      for (const [x, y, rx, P] of [[5.5, 5.4, 3.2, SACK], [10.6, 5, 3.4, SACK]]) {
        L.shadeEllipse(x, y, rx, 2.8, [P[1], P[2], P[3], P[4]], { dither: 0.5 });
        L.set(Math.round(x), Math.round(y - 3.2), P[2]); L.set(Math.round(x) - 1, Math.round(y - 3.4), P[3]); L.set(Math.round(x), Math.round(y - 2.6), 0x8c3c20);
      }
    } else if (load === 1) { // hay
      for (let x = 2; x <= 14; x++) {
        const h = 3 + Math.round(2.4 * Math.sin(((x - 2) / 12) * Math.PI)) + (t.hash(x, 1, 361) < 0.35 ? 1 : 0);
        for (let y = 8 - h; y <= 8; y++) {
          const top = y === 8 - h, f = t.hash(x, y >> 1, 367);
          L.set(x, y, top ? STRAW[5] : f < 0.3 ? STRAW[2] : x < 8 ? STRAW[4] : STRAW[3]);
        }
      }
      L.set(4, 2, STRAW[4]); L.set(11, 2, STRAW[3]); L.set(8, 1, STRAW[5]);
    } else if (load === 2) { // pumpkins
      for (const [x, y, r] of [[5, 5.8, 2.6], [10.5, 5.6, 2.9], [7.8, 3.8, 2.2]]) {
        L.shadeEllipse(x, y, r, r * 0.8, [0x8c3c08, 0xc85c10, 0xf08428, 0xffb060], { dither: 0.4 });
        L.set(Math.round(x), Math.round(y - r * 0.8) - 1, 0x2e6a1c);
        L.vline(Math.round(x), Math.round(y - r * 0.5), Math.round(y + r * 0.6), 0xb04c0c);
      }
    } else { // barrels
      for (const x0 of [3, 9]) {
        L.rect(x0, 2, 5, 7, WOOD[3]); L.vline(x0, 3, 8, WOOD[4]); L.vline(x0 + 4, 3, 8, WOOD[1]);
        L.hline(x0, x0 + 4, 4, IRON[3]); L.hline(x0, x0 + 4, 7, IRON[2]);
        L.hline(x0 + 1, x0 + 3, 2, WOOD[5]); L.set(x0, 2, WOOD[4]); L.set(x0 + 4, 2, WOOD[2]);
      }
    }
    // bed: rim + side boards with cleats
    L.hline(2, 14, 8, WOOD[5]); L.set(14, 8, WOOD[3]);
    L.rect(2, 9, 13, 4, WOOD[3]); L.hline(2, 14, 11, WOOD[2]); L.hline(2, 14, 12, WOOD[1]);
    L.vline(2, 9, 12, WOOD[4]); L.vline(14, 9, 12, WOOD[1]);
    for (const x of [5, 12]) L.vline(x, 9, 12, WOOD[2]);
    // shafts to the left and the prop leg
    L.hline(0, 1, 10, WOOD[4]); L.hline(0, 1, 11, WOOD[2]);
    L.vline(2, 13, 17, WOOD[2]); L.set(2, 13, WOOD[3]);
    // spoked wheel with an iron tyre
    const wx = 9.5, wy = 14.5, R0 = 4.7;
    for (let y = 9; y < 20; y++) for (let x = 4; x < 16; x++) {
      const dx = x + 0.5 - wx, dy = y + 0.5 - wy, d = Math.hypot(dx, dy);
      if (d > R0) continue;
      const lit = -(dx * 0.6 + dy * 0.8) / d;
      if (d > 4.0) L.set(x, y, lit > 0.2 ? IRON[4] : IRON[2]);
      else if (d > 3.0) L.set(x, y, lit > 0.2 ? WOOD[4] : WOOD[2]);
      else if (d < 1.3) L.set(x, y, IRON[3]);
      else {
        const a = Math.atan2(dy, dx), k = ((a / (Math.PI / 3)) % 1 + 1) % 1;
        if (k < 0.2 || k > 0.8) L.set(x, y, lit > 0 ? WOOD[4] : WOOD[3]);
        else if (y > 12) L.set(x, y, 0x2e2016); // the shade under the cart, seen between the spokes
      }
    }
    L.set(9, 14, IRON[5]);
    return finish(L, { outline: INK, ell: [9, 19, 6.5, 1.1], sa: 0.34 });
  }
  AUTO.cart = (m, x, y) => { const k = Math.floor(tk().hash(x, y, 363) * 4); return cached('cart|' + k, () => cart(k)); };

  // ============================================================ haystack
  function haystack() {
    const t = tk(), L = buf(16, 18);
    // a dome of straw laid in bundles that converge toward the top
    const top = 4, base = 16;
    for (let y = top; y <= base; y++) {
      const q = (base - y + 0.5) / (base - top + 1); // ~1 at the top, 0 at the foot
      const w = 7.6 * Math.sqrt(Math.max(0, 1 - q * q));
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - 8) / Math.max(0.5, w);
        if (Math.abs(dx) > 1) continue;
        const lit = -dx * 0.75 + q * 0.55 + 0.1;
        let i = lit > 0.7 ? 5 : lit > 0.3 ? 4 : lit > -0.15 ? 3 : 2;
        const u = Math.round(dx * 5.5);
        if (((u % 2) + 2) % 2 === 0) i -= t.hash(x, y, 371) < 0.7 ? 1 : 0;
        if (((u % 3) + 3) % 3 === 1 && (y + x) % 3 === 0) i -= 1;
        if (t.hash(x, y, 373) < 0.06) i += 1;
        if (y >= base - 1) i = Math.min(i, 2) - (y === base ? 1 : 0);
        L.set(x, y, STRAW[Math.max(0, Math.min(5, i))]);
      }
    }
    // tuft on top, loose straws at the silhouette and on the ground
    L.set(7, 3, STRAW[5]); L.set(8, 2, STRAW[4]); L.set(9, 3, STRAW[3]); L.set(6, 3, STRAW[4]);
    for (const [x, y, c] of [[2, 7, 4], [13, 7, 2], [1, 10, 3], [15, 12, 1], [0, 15, 2], [15, 16, 1], [4, 5, 5]]) L.set(x, y, STRAW[c]);
    return finish(L, { outline: INK, ell: [9.5, 16.6, 7, 1.3], sa: 0.34 });
  }

  // ============================================================ bush
  function bush(v) {
    const t = tk(), L = buf(16, 16);
    const ramp = [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]];
    L.shadeEllipse(7.5, 9.5, 7, 5.2, ramp, { dither: 0.7, amb: 0.3 });
    L.shadeEllipse(4.8, 7.4, 3.8, 3.4, ramp, { dither: 0.7, amb: 0.45 });
    L.shadeEllipse(10.6, 7, 3.6, 3.2, ramp, { dither: 0.7, amb: 0.45 });
    L.shadeEllipse(7.6, 5, 3.2, 2.8, ramp, { dither: 0.7, amb: 0.55 });
    // leaf scales + highlights
    L.each((x, y, c) => {
      const h = t.hash(x, y, 381);
      if (h < 0.08) return LEAF[Math.min(6, ramp.indexOf(c) + 2)];
      if (h > 0.93) return LEAF[Math.max(0, ramp.indexOf(c))];
      return undefined;
    });
    for (const [x, y] of [[5, 5], [6, 4], [9, 3], [3, 7], [12, 6]]) if (L.get(x, y) !== NONE) L.set(x, y, LEAF[6]);
    for (const [x, y] of [[4, 12], [8, 13], [12, 11], [10, 12]]) if (L.get(x, y) !== NONE) L.set(x, y, LEAF[0]);
    if (v > 0) {
      const P = v === 1 ? [0x9c1820, 0xe83c3c, 0xff9c8c] : v === 2 ? [0x9aa2bc, 0xf4f4ff, 0xffffff] : [0xb08a14, 0xf8d838, 0xfffab8];
      for (const [x, y] of [[4, 8], [8, 6], [11, 9], [6, 11], [10, 4], [13, 8], [3, 10]]) {
        if (L.get(x, y) === NONE) continue;
        L.set(x, y, P[1]); if (v === 1) L.set(x, y - 1, P[2]); else { L.set(x + 1, y, P[0]); L.set(x, y - 1, P[2]); }
      }
    }
    if (v === 4) {
      // snow-covered: darker evergreen body, a snow cap on the top rows of every column
      L.each((x, y, c) => (c === NONE ? undefined : t.mix(c, 0x0e3a2a, 0.45)));
      for (let x = 0; x < 16; x++) {
        let top = -1;
        for (let y = 0; y < 16; y++) if (L.get(x, y) !== NONE) { top = y; break; }
        if (top < 0) continue;
        L.set(x, top, 0xffffff);
        if (L.get(x, top + 1) !== NONE) L.set(x, top + 1, (x + top) % 3 ? 0xdce8f6 : 0xa8bcd4);
      }
      for (const [x, y] of [[5, 8], [10, 8], [7, 10]]) if (L.get(x, y) !== NONE) L.set(x, y, 0xdce8f6);
    }
    return finish(L, { outline: INK_LEAF, ell: [9, 14.4, 6.5, 1.3], sa: 0.36 });
  }
  AUTO.bush = (m, x, y) => {
    const snowy = m && m.tileAt && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.tileAt(x + dx, y + dy) === 'snowfloor');
    if (snowy) return cached('bush|4', () => bush(4));
    const h = tk().hash(x, y, 383); const v = h < 0.6 ? 0 : h < 0.75 ? 1 : h < 0.9 ? 2 : 3; return cached('bush|' + v, () => bush(v));
  };

  // ============================================================ small well
  // Round stone well with a little shingled roof on two posts, winch and bucket.
  function wellSmall() {
    const t = tk(), L = buf(16, 28), o = 12;
    const ROOF = [0x3c1a10, 0x6c2c1c, 0x984228, 0xbc5c36, 0xd8804e];
    // stone ring: top rim (ellipse), dark water, wall face with bricks
    const cx = 7.5, cy = o + 5, rx = 6.8, ry = 3;
    for (let x = 0; x < 16; x++) {
      const u = (x - cx) / (rx + 0.5);
      if (Math.abs(u) > 1) continue;
      const yb = cy + (ry + 0.5) * Math.sqrt(1 - u * u);
      for (let y = Math.floor(yb); y <= o + 14; y++) {
        const row = Math.floor((y - Math.floor(yb)) / 3), ry2 = (y - Math.floor(yb)) % 3;
        let col = u < -0.5 ? STONE[3] : u > 0.5 ? STONE[1] : STONE[2];
        if (ry2 === 2 || (x + row * 2) % 5 === 0) col = STONE[0];
        else if (ry2 === 0 && u < 0.4) col = STONE[3];
        L.set(x, y, col);
      }
    }
    L.ellipse(cx, cy, rx, ry, STONE[4]);
    L.each((x, y, c) => (c === STONE[4] && y < cy - 1 && x < cx ? STONE[5] : c === STONE[4] && x > cx + 3 ? STONE[3] : undefined));
    L.ellipse(cx, cy + 0.3, rx - 2.2, ry - 1.3, 0x0a1428);
    L.hline(5, 8, Math.round(cy), 0x24406c); L.set(9, Math.round(cy) + 1, 0x16284c);
    // posts
    L.rect(1, 3, 2, o + 3, WOOD[3]); L.vline(1, 3, o + 5, WOOD[4]);
    L.rect(13, 3, 2, o + 3, WOOD[2]); L.vline(14, 3, o + 5, WOOD[1]);
    // winch, rope, bucket
    L.hline(2, 13, 8, WOOD[3]); L.hline(3, 12, 9, WOOD[1]); L.set(7, 8, WOOD[5]);
    L.vline(8, 10, o + 1, 0xb49c6c);
    L.rect(6, o + 1, 4, 3, WOOD[3]); L.hline(6, 9, o + 1, WOOD[5]); L.set(9, o + 2, WOOD[1]); L.set(9, o + 3, WOOD[1]); L.hline(6, 9, o + 2, IRON[3]);
    L.set(15, 9, IRON[3]); L.set(15, 10, IRON[2]);
    // roof: two slopes of shingles meeting at a ridge
    for (let y = 0; y <= 6; y++) {
      const half = 3 + y * 1.2;
      for (let x = Math.round(7.5 - half); x <= Math.round(7.5 + half); x++) {
        if (x < 0 || x > 15) continue;
        const band = (y + (x % 3 === 0 ? 1 : 0)) % 2;
        let col = x < 7.5 ? ROOF[band ? 3 : 4] : ROOF[band ? 2 : 3];
        if (y === 6) col = ROOF[1];
        if (Math.abs(x - 7.5) < 1) col = y < 6 ? ROOF[4] : ROOF[1];
        L.set(x, y, col);
      }
    }
    L.hline(0, 15, 7, ROOF[0]);
    return finish(L, { outline: INK, holes: [[3, 10, 10, 3]], ell: [9, o + 14.8, 6.8, 1.3], sa: 0.34 });
  }

  // ------------------------------------------------------------ registry
  const def = (k, f) => R.Gfx.def(k, f);
  def('decor:flowerbed', () => flowerbed({ l: false, r: false, u: false, d: false }, 0, 0, 0, 1));
  def('decor:hedge', () => hedge({ l: false, r: false, u: false, d: false }, 0, 0));
  def('decor:lamp', () => [0, 1, 2, 3].map(lamp));
  for (const k of ['item', 'weapon', 'armor', 'inn', 'church', 'tavern', 'magic']) def('decor:sign_' + k, () => shopSign(k));
  def('decor:stall', () => stall({ l: false, r: false }, 0, 0, 0));
  def('decor:fountain', () => fountainPieces(1, 1)['0,0']);
  def('decor:cart', () => cart(0));
  def('decor:haystack', () => haystack());
  def('decor:bush', () => bush(0));
  def('decor:well_small', () => wellSmall());

  /** ids drawn by this file (sheet tool) */
  A.DECOR_EXTERIOR = ['flowerbed', 'hedge', 'lamp', 'sign_item', 'sign_weapon', 'sign_armor', 'sign_inn', 'sign_church', 'sign_tavern', 'sign_magic',
    'stall', 'fountain', 'cart', 'haystack', 'bush', 'well_small'];
})(window.RPG);
