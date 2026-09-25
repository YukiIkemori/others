// Interior decor art (DESIGN §7.1 decor layer): wall hangings, floor overlays
// and furniture for castles, houses, shops and dungeons. Registers
// 'decor:<id>' for every non-exterior decor id (canvas, or frames for `anim`;
// `tall` pieces are 16x32, bottom-aligned) and context builders in
// R.Art.decorAuto for pieces that join with their neighbours (rugs, dais,
// long tables, benches, mosaics) or read the map theme (windows, tile_alt, crack).
//
// Pieces are drawn on transparent canvases with real alpha: contact shadows
// under furniture, drop shadows of wall pieces on the wall, fire glow. Light
// comes from the top-left, like the tiles. Palettes follow the tile art.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  A.decorAuto = A.decorAuto || {};
  const tk = () => A.TK;

  // ------------------------------------------------------------ palettes (dark → light)
  const INK = 0x1a1410;
  const SH = 0x0e0a14;
  const WOOD = [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468];
  const WALNUT = [0x1e0e08, 0x361c10, 0x4e2c1a, 0x683e26, 0x845434, 0xa06c44];
  const IRON = [0x16161c, 0x2a2a34, 0x44444f, 0x646472, 0x8c8c9c, 0xbcbccc];
  const STONE = [0x34363e, 0x5a5c66, 0x7e808c, 0xa4a6b0, 0xc8cad2, 0xe8eaf0];
  const WARM = [0x3a322e, 0x5e544c, 0x827468, 0xa29484, 0xc2b4a2, 0xe0d4c4];
  const GOLD = [0x5c3c08, 0x8c6414, 0xbc8c1c, 0xe0b430, 0xf8dc60, 0xfff4b0];
  const RED = [0x4c0c10, 0x7c1418, 0xa8201e, 0xd0382c, 0xec6048, 0xf89478];
  const BLUE = [0x101c48, 0x1c3070, 0x2c4c9c, 0x4270c4, 0x6c98e0, 0xa0c4f4];
  const GREEN = [0x0c2a14, 0x17441f, 0x23602b, 0x33803a, 0x4ea04c, 0x7cc46c];
  const TEAL = [0x0a2226, 0x12363c, 0x1b4c52, 0x28666a, 0x3e8484, 0x62a8a0];
  const PURPLE = [0x20102c, 0x3c1c50, 0x5c2c78, 0x8040a0, 0xa868c8, 0xd0a0e8];
  const CLOTH = [0x767c94, 0xa4aabe, 0xc8cedc, 0xe6e9f2, 0xfafbff];
  const CREAM = [0x8c7850, 0xb8a47c, 0xd8c8a0, 0xeee2c0, 0xfcf6e0];
  const BURLAP = [0x4c3a20, 0x6c5430, 0x8c7044, 0xac8e5c, 0xcaae7c, 0xe2cc9c];
  const CLAY = [0x3c200e, 0x6c3c1c, 0x9c5c2c, 0xc47e42, 0xe2a462, 0xf6cc90];
  const BRICK = [0x2c1410, 0x582a1e, 0x7c3c28, 0x9c5236, 0xbc6c48, 0xd88c64];
  const FIRE = [0x801808, 0xc83810, 0xf06818, 0xfca030, 0xffdc68, 0xfff8c0];
  const GLASS = [0x1c3460, 0x2c5494, 0x4a7cc0, 0x78a8e0, 0xb4d8f8, 0xf0faff];
  const STEEL = [0x262a38, 0x444c60, 0x687288, 0x929cb2, 0xbec8da, 0xeef2fc];
  const SKIN = [0x8c5838, 0xc88c60, 0xf0bc8c];
  const LEAF = [0x0e3014, 0x1a4a1c, 0x286a26, 0x3a8a30, 0x58aa3c, 0x86cc5c];
  const GLOW = 0xffb040;

  // ------------------------------------------------------------ RGBA image
  // Straight-alpha float image; opaque TK Bufs are composited onto it and it
  // converts to a canvas with real (quantised) alpha for shadows and glows.
  class Img {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Float32Array(w * h * 4); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    alpha(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
    put(x, y, col, a) {
      x = Math.round(x); y = Math.round(y);
      if (!this.in(x, y) || !(a > 0)) return this;
      if (a > 1) a = 1;
      const d = this.d, i = (y * this.w + x) * 4, da = d[i + 3], oa = a + da * (1 - a);
      const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
      const k = da * (1 - a);
      d[i] = (r * a + d[i] * k) / oa; d[i + 1] = (g * a + d[i + 1] * k) / oa; d[i + 2] = (b * a + d[i + 2] * k) / oa;
      d[i + 3] = oa;
      return this;
    }
    /** composite an opaque TK Buf (transparent pixels skipped) */
    buf(b, ox, oy) {
      ox = ox | 0; oy = oy | 0;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
        const v = b.p[y * b.w + x];
        if (v !== -1) this.put(x + ox, y + oy, v, 1);
      }
      return this;
    }
    /** composite another Img */
    over(o) {
      const s = o.d;
      for (let i = 0; i < this.w * this.h; i++) {
        const a = s[i * 4 + 3];
        if (a > 0) this.put(i % this.w, (i / this.w) | 0, (Math.round(s[i * 4]) << 16) | (Math.round(s[i * 4 + 1]) << 8) | Math.round(s[i * 4 + 2]), a);
      }
      return this;
    }
    canvas() {
      const cv = R.Gfx.makeCanvas(this.w, this.h), ctx = cv.getContext('2d');
      const id = ctx.createImageData(this.w, this.h), o = id.data, d = this.d;
      for (let i = 0; i < this.w * this.h; i++) {
        const a = d[i * 4 + 3];
        if (a <= 0.004) continue;
        o[i * 4] = Math.round(d[i * 4]); o[i * 4 + 1] = Math.round(d[i * 4 + 1]); o[i * 4 + 2] = Math.round(d[i * 4 + 2]);
        o[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
      }
      ctx.putImageData(id, 0, 0);
      return cv;
    }
  }
  A.DecorImg = Img;

  /** soft contact shadow: two-level ellipse [cx, cy, rx, ry, alpha] */
  function contact(img, c) {
    const cx = c[0], cy = c[1], rx = c[2], ry = c[3], a = c[4] == null ? 0.36 : c[4];
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
      if (d <= 1) img.put(x, y, SH, d < 0.45 ? a : a * 0.55);
    }
  }
  /** silhouette of L shifted by (dx,dy) as a translucent shadow */
  function dropShadow(img, L, dx, dy, a) {
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      if (L.p[y * L.w + x] === -1) continue;
      const tx = x + dx, ty = y + dy;
      if (L.get(tx, ty) === -1) img.put(tx, ty, SH, a);
    }
  }
  /** radial glow (two rings) on an Img */
  function glow(img, cx, cy, r, a, col) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) img.put(x, y, col || GLOW, d < r * 0.55 ? a : a * 0.5);
    }
  }

  /**
   * Build a piece: draw(L, t, U, O, f) paints the opaque layer L (TK Buf); U is
   * an Img under it (glows on the wall), O an Img over it (glints, fire light).
   * o: {outline, diag, contact:[cx,cy,rx,ry,a], drop:[dx,dy,a], f}
   */
  function piece(w, h, draw, o) {
    o = o || {};
    const t = tk(), L = t.buf(w, h), U = new Img(w, h), O = new Img(w, h);
    draw(L, t, U, O, o.f || 0);
    if (o.outline !== false) L.outline(o.outline == null ? INK : o.outline, o.diag);
    const img = new Img(w, h);
    if (o.contact) contact(img, o.contact);
    if (o.drop) dropShadow(img, L, o.drop[0], o.drop[1], o.drop[2] == null ? 0.3 : o.drop[2]);
    img.over(U).buf(L).over(O);
    return img;
  }
  const cv = (img) => img.canvas();
  const anim = (n, fn) => { const out = []; for (let f = 0; f < n; f++) out.push(fn(f).canvas()); return out; };

  // small drawing helpers on TK Bufs
  /** rows of a string grid → pixels (pal: char → colour) at (ox, oy) */
  function grid(L, ox, oy, rows, pal) {
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c != null) L.set(ox + x, oy + y, c); } });
  }
  /** horizontal cylinder shading of a rect: left lit → right dark */
  function cyl(L, x0, y0, w, h, P, lit) {
    const n = P.length;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      let k = u < 0.18 ? n - 1 : u < 0.45 ? n - 2 : u < 0.8 ? n - 3 : n - 4;
      if (lit === false) k = Math.max(0, k - 1);
      for (let y = 0; y < h; y++) L.set(x0 + x, y0 + y, P[Math.max(0, k)]);
    }
  }
  /** panel: raised frame lit top-left, recessed centre */
  function panel(L, x0, y0, w, h, P) {
    L.rect(x0, y0, w, h, P[2]);
    L.hline(x0, x0 + w - 1, y0, P[1]); L.vline(x0, y0, y0 + h - 1, P[1]);
    L.hline(x0, x0 + w - 1, y0 + h - 1, P[4]); L.vline(x0 + w - 1, y0, y0 + h - 1, P[4]);
  }
  function flame(L, cx, by, h, f, core) {
    // small candle flame, bottom at by, height h (2..4), f = frame
    const lean = f % 2 ? 0 : 0;
    for (let i = 0; i < h; i++) L.set(cx + (i === h - 1 && f % 2 ? -1 : lean), by - i, i === 0 ? FIRE[3] : i === h - 1 ? FIRE[2] : FIRE[4]);
    if (core) L.set(cx, by - 1, FIRE[5]);
  }

  // =============================================================== WALL PIECES
  // drawn over a wall face of any theme: the object only, upper-middle of the face

  function banner(C, kind) {
    return cv(piece(16, 16, (L) => {
      // brass rod with finials
      L.hline(3, 12, 1, GOLD[2]); L.set(2, 1, GOLD[4]); L.set(13, 1, GOLD[3]);
      L.set(2, 0, GOLD[5]); L.set(13, 0, GOLD[4]); L.set(2, 2, GOLD[2]); L.set(13, 2, GOLD[1]);
      // cloth with folds
      const tone = [1, 0, 1, -1, 0, 1, -1, -2];
      const inCloth = (x, y) => {
        if (x < 4 || x > 11 || y < 2) return false;
        if (kind === 'tail') {
          if (y === 12) return x <= 6 || x >= 9;
          if (y === 13) return x <= 5 || x >= 10;
          if (y === 14) return x === 4 || x === 11;
          return y < 12;
        }
        if (y === 12) return x >= 5 && x <= 10;
        if (y === 13) return x >= 6 && x <= 9;
        if (y === 14) return x === 7 || x === 8;
        return y < 12;
      };
      for (let y = 2; y <= 14; y++) for (let x = 4; x <= 11; x++) if (inCloth(x, y)) L.set(x, y, C[3 + tone[x - 4]]);
      // gold hem at the top and along the lower edge
      L.hline(4, 11, 3, GOLD[3]); L.hline(4, 11, 2, C[1]);
      for (let x = 4; x <= 11; x++) {
        let y = 14;
        while (y > 2 && !inCloth(x, y)) y--;
        L.set(x, y, x < 8 ? GOLD[3] : GOLD[2]);
      }
      if (kind === 'tail') {
        // crown
        grid(L, 5, 5, ['a.b.a.', 'aaaaaa', 'aracra', 'dddddd'].map((r) => r.slice(0, 6)), { a: GOLD[4], b: GOLD[5], r: RED[4], c: BLUE[5], d: GOLD[2] });
        L.set(10, 5, null);
        L.hline(6, 9, 10, GOLD[3]); L.set(7, 11, GOLD[2]); L.set(8, 11, GOLD[2]);
      } else {
        // sun crest
        grid(L, 5, 5, ['..ab..', '.abba.', 'abccba', '.abba.', '..ab..'], { a: GOLD[3], b: GOLD[4], c: GOLD[5] });
        L.set(4 + 3, 10, GOLD[2]); L.set(4 + 4, 10, GOLD[2]);
      }
    }, { drop: [1, 1, 0.32] }));
  }

  function tapestry() {
    return cv(piece(16, 16, (L) => {
      L.hline(1, 14, 1, WOOD[2]); L.hline(2, 13, 0, WOOD[4]);
      L.set(0, 1, GOLD[4]); L.set(15, 1, GOLD[3]);
      // woven hanging: red border with a gold thread, cream field
      for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
        const edge = x === 2 || x === 13 || y === 2 || y === 13;
        const band = x === 3 || x === 12 || y === 3 || y === 12;
        let c = edge ? RED[2] : band ? ((x + y) % 2 ? GOLD[3] : RED[3]) : CREAM[3];
        if (!edge && !band && (x * 3 + y * 5) % 11 === 0) c = CREAM[2];
        if (x === 13 || (x === 12 && !edge)) c = tk().mul(c, 0.86);
        L.set(x, y, c);
      }
      // tree of life on a green mound
      grid(L, 4, 4, [
        '..abbc..',
        '.abbbcc.',
        'abbrbccd',
        'bbcccrcd',
        '.cccddd.',
        '...tu...',
        '...tu...',
        'gggggggg',
      ], { a: GREEN[5], b: GREEN[4], c: GREEN[3], d: GREEN[2], r: RED[4], t: WOOD[3], u: WOOD[1], g: GREEN[3] });
      L.set(5, 11, GREEN[4]); L.set(10, 11, GREEN[2]);
      // fringe
      for (let x = 2; x <= 13; x++) if (x % 2 === 0) { L.set(x, 14, CREAM[3]); L.set(x, 15, CREAM[1]); } else L.set(x, 14, CREAM[2]);
    }, { drop: [1, 1, 0.3] }));
  }

  /** frame: 'wood' | 'stone'; curtains for homes */
  function windowRect(frame, curtains) {
    const F = frame === 'stone' ? STONE : WOOD;
    return cv(piece(16, 16, (L) => {
      // frame 11x11 at x3..13, y2..12
      L.rect(3, 2, 11, 11, F[3]);
      L.hline(3, 13, 2, F[4]); L.vline(3, 2, 12, F[4]); L.vline(13, 3, 12, F[1]); L.hline(4, 13, 12, F[2]);
      const pane = (x0, y0, w, h, upper) => {
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) L.set(x, y, upper ? GLASS[3] : GLASS[2]);
        L.hline(x0, x0 + w - 1, y0, upper ? GLASS[2] : GLASS[1]);
        L.vline(x0, y0, y0 + h - 1, upper ? GLASS[2] : GLASS[1]);
        // glare
        L.set(x0 + 1, y0 + h - 1, GLASS[5]); L.set(x0 + 2, y0 + h - 2, GLASS[5]); L.set(x0 + 3, y0 + h - 3, GLASS[4]);
        L.set(x0 + 2, y0 + h - 1, GLASS[4]); L.set(x0 + 3, y0 + h - 2, GLASS[4]);
      };
      pane(4, 3, 4, 4, true); pane(9, 3, 4, 4, true); pane(4, 8, 4, 4, false); pane(9, 8, 4, 4, false);
      L.vline(8, 3, 11, F[2]); L.hline(4, 12, 7, F[2]); L.set(8, 7, F[3]);
      // sill
      L.hline(2, 14, 13, F[5]); L.hline(2, 14, 14, F[2]);
      if (curtains) {
        // red valance across the top, cream curtains tied back at the sides
        L.hline(2, 14, 1, WOOD[1]);
        for (let x = 3; x <= 13; x++) { L.set(x, 2, RED[3]); if (x % 3 !== 2) L.set(x, 3, RED[2]); }
        L.hline(3, 13, 2, RED[4]);
        const side = (x0, dir) => {
          const w = [2, 2, 2, 1, 1, 1, 2, 2, 2];
          w.forEach((n, i) => { for (let k = 0; k < n; k++) L.set(x0 + dir * k, 4 + i, k === 0 ? CREAM[4] : CREAM[2]); });
          L.set(x0, 7, GOLD[4]); L.set(x0 + dir, 7, GOLD[2]);
        };
        side(4, 1); side(12, -1);
      }
    }, { drop: [1, 1, 0.3] }));
  }

  /** arched window: 'leaded' (clear diamond panes) | 'stained' | 'dark' (demon: red/purple) */
  function windowArch(kind) {
    return cv(piece(16, 16, (L, t) => {
      const cx = 7.5, cy = 6;
      const inShape = (x, y, r) => (y >= cy ? x >= 7.5 - r && x <= 7.5 + r : Math.hypot(x - cx, (y - cy) * 1.05) <= r + 0.3);
      for (let y = 0; y <= 13; y++) for (let x = 2; x <= 13; x++) {
        if (!inShape(x, y, 5) || y > 13) continue;
        const inner = inShape(x, y, 3.9) && y <= 12;
        if (!inner) { L.set(x, y, x < 7 ? STONE[4] : x > 8 ? STONE[2] : STONE[3]); continue; }
        // glass with lead lattice (symmetric about the centre line)
        const a = (x + y) % 6, b = (15 - x + y) % 6;
        let c;
        if (kind === 'stained') {
          const cell = Math.floor((x + y) / 6) + Math.floor((15 - x + y) / 6);
          const P = [BLUE[3], RED[3], BLUE[4], GOLD[4], GREEN[4], BLUE[3]];
          c = P[cell % P.length];
          if (y <= 5 && Math.abs(x - 7.5) < 1.5) c = GOLD[5];
          if (a === 0 || b === 0) c = IRON[1];
        } else if (kind === 'dark') {
          const cell = Math.floor((x + y) / 6) + Math.floor((15 - x + y) / 6);
          c = cell % 3 === 0 ? RED[2] : cell % 3 === 1 ? PURPLE[3] : PURPLE[2];
          if (a === 0 || b === 0) c = 0x100810;
        } else {
          c = y < 5 ? GLASS[4] : y < 9 ? GLASS[3] : GLASS[2];
          if (a === 0 || b === 0) c = y < 7 ? GLASS[1] : 0x1c2c50;
        }
        L.set(x, y, c);
      }
      // keystone and sill
      L.set(7, 0, STONE[5]); L.set(8, 0, STONE[4]);
      L.hline(2, 13, 13, STONE[5]); L.hline(2, 13, 14, STONE[2]);
      if (kind !== 'stained' && kind !== 'dark') { L.set(5, 10, GLASS[5]); L.set(6, 9, GLASS[5]); L.set(6, 10, GLASS[4]); }
    }, { drop: [1, 1, 0.3] }));
  }

  function sconce(f) {
    return piece(16, 16, (L, t, U) => {
      glow(U, 7.5, 3, f ? 6.2 : 6.8, 0.2);
      // back plate + arm
      L.rect(7, 9, 2, 4, IRON[3]); L.set(7, 9, IRON[4]); L.set(8, 12, IRON[1]);
      L.hline(6, 9, 13, IRON[2]);
      // torch handle and cup
      L.rect(7, 5, 2, 5, WOOD[3]); L.vline(7, 5, 9, WOOD[4]); L.set(8, 7, WOOD[1]);
      L.hline(6, 9, 5, IRON[3]); L.hline(6, 9, 6, IRON[2]); L.set(6, 5, IRON[4]);
      // flame
      const fl = f
        ? ['..a.', '.ab.', '.bca', 'abcb', 'bccb']
        : ['.a..', '.ba.', 'abb.', 'bcba', 'bccb'];
      grid(L, 6, 0, fl, { a: FIRE[2], b: FIRE[3], c: FIRE[4] });
      L.set(7, 3, FIRE[5]); if (!f) L.set(8, 4, FIRE[5]);
    }, { drop: [1, 1, 0.28], f });
  }

  function painting() {
    return cv(piece(16, 16, (L) => {
      // gilt frame 12x9 at x2..13, y3..11
      L.rect(2, 3, 12, 9, GOLD[3]);
      L.hline(2, 13, 3, GOLD[4]); L.vline(2, 3, 11, GOLD[4]); L.hline(3, 13, 11, GOLD[2]); L.vline(13, 4, 11, GOLD[2]);
      L.hline(3, 12, 4, GOLD[1]); L.vline(3, 4, 10, GOLD[1]); L.hline(4, 12, 10, GOLD[4]); L.vline(12, 5, 10, GOLD[4]);
      for (const [x, y] of [[2, 3], [13, 3], [2, 11], [13, 11]]) L.set(x, y, GOLD[5]);
      // landscape 8x5
      grid(L, 4, 5, [
        'ssssssus',
        'smmsssss',
        'mMmmhhmm',
        'hhgghwwg',
        'GGGgGGGG',
      ], { s: GLASS[4], u: GOLD[5], m: 0x7888b0, M: 0xc8d4ec, h: GREEN[4], g: GREEN[3], G: GREEN[2], w: GLASS[3] });
      L.set(6, 7, RED[3]);
    }, { drop: [1, 1, 0.32] }));
  }

  function portrait() {
    return cv(piece(16, 16, (L) => {
      L.rect(3, 1, 10, 13, GOLD[3]);
      L.hline(3, 12, 1, GOLD[4]); L.vline(3, 1, 13, GOLD[4]); L.hline(4, 12, 13, GOLD[2]); L.vline(12, 2, 13, GOLD[2]);
      L.rect(4, 2, 8, 11, WALNUT[2]); L.hline(4, 11, 2, WALNUT[1]); L.vline(4, 2, 12, WALNUT[1]);
      // sitter: a bearded old king
      grid(L, 5, 3, [
        '.g.gg.',
        '.gggg.',
        '.hssh.',
        '.hsse.',
        '.bbbb.',
        'rwbbwr',
        'rrggrr',
        'rrrrrq',
        'rrrrqq',
      ], { g: GOLD[4], h: CLOTH[3], s: SKIN[2], e: SKIN[1], b: CLOTH[4], w: CLOTH[3], r: RED[3], q: RED[2] });
      L.set(6, 5, SKIN[1]); L.set(8, 3, RED[4]);
      L.set(7, 6, SKIN[0]);
      // name plate
      L.hline(6, 9, 13, GOLD[5]);
    }, { drop: [1, 1, 0.32] }));
  }

  function emblem() {
    return cv(piece(16, 16, (L) => {
      const half = [4, 4, 4, 4, 4, 4, 4, 4, 3.5, 3, 2.5, 1.5, 0.5]; // rows y2..14
      for (let i = 0; i < half.length; i++) {
        const y = 2 + i, hw = half[i];
        for (let x = 0; x < 16; x++) {
          const d = Math.abs(x - 7.5);
          if (d > hw) continue;
          const edge = d > hw - 1 || i === 0 || i === half.length - 1;
          L.set(x, y, edge ? (x < 8 ? GOLD[4] : GOLD[2]) : x < 8 ? BLUE[3] : BLUE[2]);
        }
      }
      // star of light
      grid(L, 5, 4, [
        '..ab..',
        '..ab..',
        '.aabb.',
        'aabbcb',
        '.abbc.',
        '..bc..',
        '..bc..',
      ], { a: GOLD[5], b: GOLD[4], c: GOLD[3] });
      // small crown over the shield
      grid(L, 5, 0, ['a.bb.a', 'aaaaaa'], { a: GOLD[4], b: GOLD[5] });
    }, { drop: [1, 1, 0.32] }));
  }

  function swords() {
    return cv(piece(16, 16, (L) => {
      const sword = (flip) => {
        const X = (x) => (flip ? 15 - x : x);
        for (let i = 0; i < 9; i++) { L.set(X(1 + i), 1 + i, STEEL[5]); L.set(X(2 + i), 1 + i, STEEL[3]); }
        L.set(X(1), 1, STEEL[4]); L.set(X(2), 1, null);
        for (const [x, y] of [[12, 8], [11, 9], [10, 10], [9, 11], [8, 12]]) L.set(X(x), y, GOLD[3]);
        L.set(X(12), 8, GOLD[4]); L.set(X(8), 12, GOLD[2]);
        L.set(X(11), 11, WOOD[2]); L.set(X(12), 12, WOOD[1]);
        L.set(X(13), 13, GOLD[4]); L.set(X(14), 14, GOLD[2]);
      };
      sword(false); sword(true);
      // small round shield over the crossing
      for (let y = 3; y <= 11; y++) for (let x = 3; x <= 12; x++) {
        const d = Math.hypot(x - 7.5, y - 7.2);
        if (d > 3.5) continue;
        L.set(x, y, d > 2.6 ? (x + y < 15 ? GOLD[4] : GOLD[2]) : x + y < 14 ? RED[4] : RED[3]);
      }
      L.set(7, 7, GOLD[5]); L.set(8, 7, GOLD[3]); L.set(7, 8, GOLD[3]); L.set(8, 8, GOLD[2]);
    }, { drop: [1, 1, 0.32] }));
  }

  function wallShelf() {
    return cv(piece(16, 16, (L) => {
      // clay jar
      grid(L, 2, 4, ['.ab.', '.cc.', 'dccb', 'dccb', 'eccb'], { a: CLAY[2], b: CLAY[2], c: CLAY[3], d: CLAY[4], e: CLAY[4] });
      L.set(3, 6, CLAY[5]);
      // books
      L.vline(7, 4, 8, RED[3]); L.set(7, 4, RED[4]);
      L.vline(8, 3, 8, BLUE[3]); L.set(8, 3, BLUE[4]);
      L.vline(9, 5, 8, GREEN[3]); L.set(9, 5, GREEN[4]);
      L.set(7, 6, GOLD[4]); L.set(8, 6, GOLD[4]); L.set(9, 7, GOLD[3]);
      L.set(10, 6, CREAM[3]); L.set(10, 7, CREAM[2]); L.set(10, 8, CREAM[2]); L.set(11, 5, CREAM[4]);
      // bottle and cup
      L.vline(12, 5, 8, GREEN[4]); L.set(12, 4, GREEN[3]); L.set(12, 3, WOOD[4]); L.set(12, 6, GREEN[5]);
      L.rect(13, 7, 2, 2, CLOTH[3]); L.set(13, 7, CLOTH[4]);
      // plank and brackets
      L.hline(1, 14, 9, WOOD[5]); L.hline(1, 14, 10, WOOD[2]);
      for (const x of [3, 12]) { L.set(x, 11, WOOD[2]); L.set(x, 12, WOOD[1]); }
      L.set(4, 11, WOOD[1]); L.set(11, 11, WOOD[1]);
    }, { drop: [1, 1, 0.32] }));
  }

  function mirror() {
    return cv(piece(16, 16, (L) => {
      for (let y = 1; y <= 14; y++) for (let x = 2; x <= 13; x++) {
        const dx = (x - 7.5) / 4.8, dy = (y - 7.8) / 6.2, d = dx * dx + dy * dy;
        if (d > 1) continue;
        if (d > 0.62) { L.set(x, y, x + y < 15 ? GOLD[4] : GOLD[2]); continue; }
        const g = [0x5c6c88, 0x8496b4, 0xa8bad4, 0xd0dcee];
        L.set(x, y, g[Math.max(0, Math.min(3, 3 - Math.floor((x - 4 + y - 3) / 4)))]);
      }
      for (const [x, y] of [[5, 6], [6, 5], [7, 4], [6, 7], [7, 6], [8, 5], [9, 10], [10, 9]]) L.set(x, y, 0xffffff);
      L.set(7, 0, GOLD[5]); L.set(8, 0, GOLD[4]); L.set(6, 1, GOLD[3]); L.set(9, 1, GOLD[2]);
    }, { drop: [1, 1, 0.32] }));
  }

  // =============================================================== FLOOR OVERLAYS

  function crackOverlay() {
    const img = new Img(16, 16);
    const path = [[0, 4], [2, 5], [4, 5], [5, 6], [7, 6], [8, 7], [9, 8], [10, 8], [11, 9], [13, 10], [15, 10]];
    const br1 = [[8, 7], [8, 5], [9, 4], [9, 2], [10, 1]];
    const br2 = [[5, 6], [5, 8], [4, 9], [4, 11], [5, 12], [6, 14]];
    const draw = (pts) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
          img.put(x, y, SH, 0.6);
          if (img.alpha(x, y + 1) < 0.3) img.put(x, y + 1, 0xffffff, 0.16);
        }
      }
    };
    draw(path); draw(br1); draw(br2);
    return img;
  }
  function tileAltOverlay() {
    const img = new Img(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) img.put(x, y, 0xf0d8a0, 0.2);
    for (let i = 0; i < 16; i++) { img.put(i, 0, 0xffffff, 0.15); img.put(0, i, 0xffffff, 0.15); img.put(i, 15, SH, 0.18); img.put(15, i, SH, 0.18); }
    return img;
  }
  function grate() {
    return cv(piece(16, 16, (L) => {
      L.rect(2, 3, 12, 11, IRON[2]);
      L.hline(2, 13, 3, IRON[4]); L.vline(2, 3, 13, IRON[3]); L.hline(2, 13, 13, IRON[1]); L.vline(13, 3, 13, IRON[1]);
      for (let y = 4; y <= 12; y++) for (let x = 3; x <= 12; x++) {
        const bar = x % 2 === 0;
        L.set(x, y, bar ? (y === 4 ? IRON[4] : IRON[3]) : y < 7 ? 0x040306 : 0x0c0a10);
      }
      L.hline(3, 12, 8, IRON[2]); L.hline(3, 12, 9, IRON[1]);
      for (const x of [4, 8, 12]) L.set(x, 8, IRON[4]);
    }, { contact: [8.5, 9, 7, 6.2, 0.28] }));
  }
  function scatter(seed, n, cols, area, sizeFn) {
    const t = tk(), r = t.rng(seed), out = [];
    for (let i = 0; i < n; i++) {
      let x, y, k = 0;
      do { x = r() * 16; y = r() * 16; k++; } while (k < 30 && area && !area(x, y));
      out.push({ x: Math.floor(x), y: Math.floor(y), c: cols[Math.floor(r() * cols.length)], r: r(), s: sizeFn ? sizeFn(r) : 0 });
    }
    return out;
  }
  function straw() {
    return cv(piece(16, 16, (L, t) => {
      const S = [0x8c6c28, 0xb89438, 0xd8b850, 0xf0d878];
      const pile = (x, y) => ((x - 8) / 7.5) ** 2 + ((y - 8.5) / 6.5) ** 2 < 1;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const r = ((x + 0.5 - 8) / (6.4 + t.hash(x, y, 5) * 1.4)) ** 2 + ((y + 0.5 - 8.5) / (5.4 + t.hash(y, x, 6))) ** 2;
        if (r < 1) L.set(x, y, t.hash(x, y, 7) < 0.5 ? S[1] : S[0]);
      }
      for (const p of scatter(401, 90, S, pile, (r) => 2 + Math.floor(r() * 3))) {
        const dir = p.r < 0.4 ? [1, 0] : p.r < 0.7 ? [1, 1] : p.r < 0.9 ? [1, -1] : [0, 1];
        for (let k = 0; k < p.s; k++) L.set(p.x + dir[0] * k, p.y + dir[1] * k, k === 0 ? p.c : S[Math.min(3, S.indexOf(p.c) + (k === 1 ? 1 : 0))]);
      }
    }, { outline: false, drop: [0, 1, 0.22] }));
  }
  function leaves() {
    return cv(piece(16, 16, (L) => {
      const LV = [[0xd87028, 0xf0a040], [0xb03020, 0xe05838], [0xd8a820, 0xf8d860], [0x8c5a28, 0xb07c3c]];
      const shapes = [[[0, 0, 1], [1, 0, 0], [1, 1, 0], [2, 1, 0]], [[0, 1, 0], [1, 0, 1], [1, 1, 0], [2, 0, 0]], [[0, 0, 1], [0, 1, 0], [1, 1, 0], [1, 2, 0]]];
      const pts = [[2, 3], [9, 2], [13, 5], [5, 7], [10, 9], [1, 11], [7, 12], [13, 13], [5, 1], [12, 11], [3, 14], [9, 5]];
      pts.forEach(([x, y], i) => {
        const [c0, c1] = LV[(i * 7 + 3) % 4];
        for (const [dx, dy, hi] of shapes[i % 3]) L.set(x + dx, y + dy, hi ? c1 : c0);
      });
    }, { outline: false, drop: [1, 1, 0.3] }));
  }
  function flowersLow() {
    return cv(piece(16, 16, (L) => {
      const G = [0x3a7c26, 0x4e9a30, 0x68b43e, 0x88cc58];
      for (const [x, y] of [[1, 4], [6, 2], [12, 3], [3, 10], [9, 8], [14, 11], [7, 14], [12, 15]]) {
        L.set(x, y, G[2]); L.set(x - 1, y - 1, G[3]); L.set(x + 1, y - 1, G[1]); L.set(x, y - 1, G[3]);
      }
      const F = [[0xffffff, 0xf8e040], [0xf8e040, 0xc07010], [0xf890d0, 0xf8f0a0], [0x8cb4f8, 0xffffff], [0xe86060, 0xf8e040]];
      [[3, 6, 0], [10, 4, 1], [14, 7, 2], [6, 11, 3], [11, 12, 4], [2, 14, 1]].forEach(([x, y, k]) => {
        const [p, c] = F[k];
        L.set(x - 1, y, p); L.set(x + 1, y, p); L.set(x, y - 1, p); L.set(x, y + 1, G[1]); L.set(x, y, c);
      });
    }, { outline: false, drop: [1, 1, 0.25] }));
  }
  function stool() {
    return cv(piece(16, 16, (L) => {
      L.set(4, 11, WOOD[2]); L.set(4, 12, WOOD[2]); L.set(4, 13, WOOD[1]);
      L.set(11, 11, WOOD[1]); L.set(11, 12, WOOD[1]); L.set(11, 13, WOOD[0]);
      L.vline(7, 11, 14, WOOD[2]); L.vline(8, 11, 14, WOOD[1]);
      for (let y = 6; y <= 10; y++) for (let x = 3; x <= 12; x++) {
        const dx = (x - 7.5) / 4.9, dy = (y - 8) / 2.3;
        if (dx * dx + dy * dy > 1) continue;
        L.set(x, y, y >= 10 ? WOOD[2] : y === 9 ? WOOD[3] : x < 6 && y < 8 ? WOOD[5] : WOOD[4]);
      }
      L.set(6, 7, WOOD[3]); L.set(9, 8, WOOD[3]);
    }, { contact: [8.5, 13.5, 5.2, 2, 0.34] }));
  }

  // =============================================================== FURNITURE

  function dresser() {
    return cv(piece(16, 16, (L) => {
      L.rect(1, 3, 14, 11, WOOD[3]);
      L.hline(1, 14, 3, WOOD[5]); L.hline(1, 14, 4, WOOD[4]); L.hline(1, 14, 5, WOOD[2]);
      L.vline(1, 4, 13, WOOD[4]); L.vline(14, 4, 13, WOOD[1]);
      for (const [y0, h] of [[6, 3], [9, 3], [12, 2]]) {
        L.hline(2, 13, y0, WOOD[4]); L.hline(2, 13, y0 + h - 1, WOOD[1]);
        const ky = y0 + (h > 2 ? 1 : 0);
        for (const kx of [4, 11]) { L.set(kx, ky, GOLD[4]); L.set(kx + 1, ky, GOLD[2]); }
      }
      L.rect(1, 14, 2, 1, WOOD[1]); L.rect(13, 14, 2, 1, WOOD[0]);
      // little flower pot on top
      L.rect(10, 1, 3, 2, CLAY[3]); L.set(10, 1, CLAY[4]); L.set(12, 2, CLAY[2]);
      L.set(11, 0, RED[4]); L.set(10, 0, GREEN[4]); L.set(12, 0, GREEN[3]);
      // folded cloth
      L.rect(3, 2, 4, 1, CLOTH[3]); L.set(3, 2, CLOTH[4]);
    }, { contact: [8.5, 14.3, 7.6, 1.7, 0.36] }));
  }

  function wardrobe() {
    return cv(piece(16, 32, (L) => {
      // pediment + cornice
      L.hline(5, 10, 2, WOOD[4]); L.hline(4, 11, 3, WOOD[3]); L.set(7, 1, GOLD[4]); L.set(8, 1, GOLD[3]); L.set(7, 2, GOLD[3]);
      L.hline(1, 14, 4, WOOD[4]); L.hline(0, 15, 5, WOOD[5]); L.hline(0, 15, 6, WOOD[2]);
      // body
      L.rect(1, 7, 14, 21, WOOD[3]); L.vline(1, 7, 27, WOOD[4]); L.vline(14, 7, 27, WOOD[1]);
      // doors with panels
      for (const x0 of [2, 8]) {
        L.rect(x0, 8, 6, 19, WOOD[3]);
        L.hline(x0, x0 + 5, 8, WOOD[4]);
        panel(L, x0 + 1, 10, 4, 7, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]]);
        panel(L, x0 + 1, 19, 4, 6, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]]);
      }
      L.vline(7, 8, 26, WOOD[1]); L.vline(8, 8, 26, WOOD[4]);
      L.set(6, 17, GOLD[4]); L.set(9, 17, GOLD[4]); L.set(6, 18, GOLD[2]); L.set(9, 18, GOLD[2]);
      // plinth and feet
      L.hline(0, 15, 27, WOOD[4]); L.rect(0, 28, 16, 2, WOOD[2]); L.hline(0, 15, 29, WOOD[1]);
      L.rect(1, 30, 2, 1, WOOD[1]); L.rect(13, 30, 2, 1, WOOD[0]);
    }, { contact: [8.5, 30.4, 8, 1.6, 0.4], drop: [1, 0, 0.26] }));
  }

  function cupboard() {
    return cv(piece(16, 32, (L) => {
      L.hline(1, 14, 5, WOOD[4]); L.hline(0, 15, 6, WOOD[5]); L.hline(0, 15, 7, WOOD[2]);
      // glazed upper cabinet with plates
      L.rect(1, 8, 14, 10, WOOD[3]); L.vline(1, 8, 17, WOOD[4]); L.vline(14, 8, 17, WOOD[1]);
      L.rect(3, 9, 10, 8, WALNUT[1]);
      L.hline(3, 12, 12, WOOD[4]); L.hline(3, 12, 16, WOOD[4]);
      const plate = (cx, cy) => {
        for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) L.set(x, y, CLOTH[3]);
        L.set(cx - 1, cy - 1, CLOTH[4]); L.set(cx, cy, BLUE[4]); L.set(cx + 1, cy + 1, CLOTH[1]);
      };
      plate(4, 10); plate(11, 10);
      L.rect(4, 14, 2, 2, CLOTH[3]); L.set(4, 14, CLOTH[4]); L.rect(10, 14, 3, 2, BLUE[3]); L.hline(10, 12, 14, BLUE[4]);
      L.set(6, 14, GOLD[3]); L.set(6, 15, GOLD[2]); L.set(9, 15, CLAY[3]); L.set(9, 14, CLAY[4]);
      L.vline(7, 9, 16, WOOD[3]); L.vline(8, 9, 16, WOOD[2]);
      L.set(3, 9, GLASS[4]); L.set(4, 9, GLASS[5]); L.set(9, 13, GLASS[4]);
      // worktop
      L.hline(0, 15, 18, WOOD[5]); L.hline(0, 15, 19, WOOD[3]);
      // lower doors
      L.rect(1, 20, 14, 9, WOOD[3]); L.vline(1, 20, 28, WOOD[4]); L.vline(14, 20, 28, WOOD[1]);
      L.hline(2, 13, 20, WOOD[2]); L.hline(2, 13, 21, WOOD[4]);
      for (const x0 of [2, 8]) panel(L, x0 + 1, 22, 4, 5, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]]);
      L.vline(7, 21, 28, WOOD[1]); L.set(6, 24, GOLD[4]); L.set(9, 24, GOLD[4]);
      L.rect(0, 29, 16, 1, WOOD[1]); L.rect(1, 30, 2, 1, WOOD[1]); L.rect(13, 30, 2, 1, WOOD[0]);
    }, { contact: [8.5, 30.4, 8, 1.6, 0.4], drop: [1, 0, 0.26] }));
  }

  function clock() {
    return cv(piece(16, 32, (L) => {
      // bonnet with finials
      L.set(4, 2, GOLD[4]); L.set(11, 2, GOLD[3]); L.set(7, 0, GOLD[5]); L.set(8, 0, GOLD[4]); L.set(7, 1, GOLD[3]); L.set(8, 1, GOLD[2]);
      L.hline(5, 10, 2, WALNUT[4]); L.hline(4, 11, 3, WALNUT[3]);
      L.rect(3, 4, 10, 8, WALNUT[3]); L.vline(3, 4, 11, WALNUT[4]); L.vline(12, 4, 11, WALNUT[1]);
      // dial
      for (let y = 4; y <= 11; y++) for (let x = 4; x <= 11; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d <= 3.6) L.set(x, y, d > 2.8 ? (x + y < 15 ? GOLD[4] : GOLD[2]) : CREAM[4]);
      }
      for (const [x, y] of [[7, 5], [10, 7], [7, 10], [5, 8]]) L.set(x, y, WALNUT[1]);
      L.set(7, 6, IRON[1]); L.set(7, 7, IRON[1]); L.set(8, 7, IRON[1]); L.set(9, 8, IRON[1]);
      // trunk with pendulum window
      L.rect(4, 12, 8, 13, WALNUT[3]); L.vline(4, 12, 24, WALNUT[4]); L.vline(11, 12, 24, WALNUT[1]);
      L.hline(3, 12, 12, WALNUT[2]);
      L.rect(6, 14, 4, 9, WALNUT[0]); L.hline(6, 9, 14, WALNUT[1]);
      L.vline(7, 14, 19, GOLD[2]); L.vline(8, 15, 19, GOLD[1]);
      L.rect(6, 20, 4, 2, GOLD[4]); L.set(6, 20, GOLD[5]); L.set(9, 21, GOLD[2]); L.hline(7, 8, 22, GOLD[2]);
      L.set(9, 15, GLASS[4]);
      // base
      L.hline(3, 12, 25, WALNUT[4]); L.rect(3, 26, 10, 3, WALNUT[3]); L.vline(3, 26, 28, WALNUT[4]); L.vline(12, 26, 28, WALNUT[1]);
      panel(L, 5, 26, 6, 3, [WALNUT[0], WALNUT[1], WALNUT[2], WALNUT[3], WALNUT[4]]);
      L.hline(2, 13, 29, WALNUT[2]); L.rect(3, 30, 2, 1, WALNUT[1]); L.rect(11, 30, 2, 1, WALNUT[0]);
    }, { contact: [8.5, 30.4, 6.5, 1.6, 0.4], drop: [1, 0, 0.26] }));
  }

  /** fireplace (16x32, 3 frames); P = stone ramp of the chimney breast */
  function fireplace(f, P) {
    P = P || WARM;
    return piece(16, 32, (L, t, U, O) => {
      // chimney breast in dressed stone
      for (let y = 0; y < 16; y++) for (let x = 1; x <= 14; x++) {
        const row = y >> 2, off = row % 2 ? 3 : 0, bx = (x + off) % 6;
        let c = P[3];
        if (y % 4 === 3 || bx === 5) c = P[1];
        else if (y % 4 === 0 || bx === 0) c = P[4];
        else if (t.hash(x, y, 311) < 0.08) c = P[2];
        L.set(x, y, c);
      }
      L.vline(1, 0, 15, P[4]); L.vline(14, 0, 15, P[1]);
      // mantel shelf with candles and a small clock
      L.hline(0, 15, 16, WOOD[5]); L.hline(0, 15, 17, WOOD[4]); L.hline(0, 15, 18, WOOD[2]);
      L.rect(1, 19, 2, 2, WOOD[2]); L.rect(13, 19, 2, 2, WOOD[1]);
      L.vline(2, 13, 15, CREAM[4]); L.vline(13, 13, 15, CREAM[3]);
      L.set(2, 12, f === 1 ? FIRE[3] : FIRE[4]); L.set(13, 12, f === 2 ? FIRE[3] : FIRE[4]);
      L.rect(6, 13, 4, 3, WALNUT[3]); L.set(7, 14, CREAM[4]); L.set(8, 14, CREAM[3]); L.set(6, 13, WALNUT[4]);
      // surround and firebox
      L.rect(1, 19, 14, 11, P[3]);
      for (let y = 19; y < 30; y++) { L.set(1, y, P[4]); L.set(14, y, P[1]); }
      for (let y = 21; y <= 29; y++) for (let x = 3; x <= 12; x++) {
        if (y === 21 && (x < 5 || x > 10)) continue;
        if (y === 22 && (x < 4 || x > 11)) continue;
        const back = (y + ((x >> 1) % 2)) % 3 === 0 ? 0x2a1210 : 0x1a0a08;
        L.set(x, y, back);
      }
      L.hline(5, 10, 20, P[4]); L.set(4, 21, P[4]); L.set(11, 21, P[2]); L.set(3, 22, P[4]); L.set(12, 22, P[2]);
      // fire: 3 frames of flame heights per column
      const H = [[2, 4, 6, 5, 7, 4, 5, 2], [3, 5, 4, 7, 5, 6, 3, 2], [2, 3, 5, 6, 6, 5, 4, 3]][f % 3];
      for (let i = 0; i < 8; i++) {
        const x = 4 + i, h = H[i];
        for (let k = 0; k < h; k++) {
          const y = 27 - k, q = k / h;
          L.set(x, y, q < 0.35 ? (i > 1 && i < 6 ? FIRE[5] : FIRE[4]) : q < 0.7 ? FIRE[3] : FIRE[2]);
        }
      }
      // logs
      L.hline(4, 11, 28, WOOD[2]); L.hline(4, 11, 29, WOOD[1]); L.set(4, 28, WOOD[4]); L.set(11, 28, WOOD[4]);
      L.set(7, 28, FIRE[3]); L.set(9, 29, FIRE[2]);
      // hearth slab
      L.hline(0, 15, 30, P[4]); L.hline(0, 15, 31, P[2]);
      // warm light on the surround and hearth
      glow(O, 7.5, 26, 7.5, f === 1 ? 0.14 : 0.18);
    }, { f, drop: [1, 0, 0.24] });
  }

  function stove(f) {
    return piece(16, 16, (L, t, U, O) => {
      // brick body
      for (let y = 7; y <= 14; y++) for (let x = 1; x <= 14; x++) {
        const row = (y - 7) >> 1, off = row % 2 ? 2 : 0, bx = (x + off) % 4;
        let c = (y - 7) % 2 === 1 || bx === 3 ? BRICK[1] : BRICK[3];
        if (c === BRICK[3] && t.hash(x, y, 71) < 0.2) c = BRICK[4];
        L.set(x, y, c);
      }
      L.vline(1, 7, 14, BRICK[4]); L.vline(14, 7, 14, BRICK[0]);
      // iron top plate
      L.hline(0, 15, 5, IRON[4]); L.hline(0, 15, 6, IRON[2]);
      // fire mouth
      for (let y = 10; y <= 14; y++) for (let x = 5; x <= 10; x++) {
        if (y === 10 && (x === 5 || x === 10)) continue;
        L.set(x, y, 0x140806);
      }
      const fl = f ? [[6, 13], [7, 12], [7, 13], [8, 11], [8, 12], [8, 13], [9, 13]] : [[6, 12], [6, 13], [7, 13], [8, 12], [8, 13], [9, 11], [9, 12], [9, 13]];
      for (const [x, y] of fl) L.set(x, y, y === 13 ? FIRE[4] : FIRE[3]);
      L.hline(5, 10, 14, FIRE[2]); L.set(7, 14, FIRE[5]);
      // cauldron of stew on top
      grid(L, 3, 1, [
        '.aaaaaaaa.',
        'hbssrsssbh',
        '.cbbbbbbd.',
        '.ceccccdd.',
        '..cccddd..',
      ], { a: IRON[4], b: IRON[2], s: 0x9c6030, r: 0xc88848, c: IRON[3], d: IRON[1], e: IRON[5], h: IRON[2] });
      // steam
      const st = f ? [[6, 0], [9, 0]] : [[7, 0], [8, 0]];
      for (const [x, y] of st) O.put(x, y, 0xffffff, 0.55);
      glow(O, 7.5, 13, 4, f ? 0.12 : 0.16);
    }, { f, contact: [8.5, 14.6, 7.5, 1.4, 0.34] });
  }

  function sink() {
    return cv(piece(16, 16, (L) => {
      // plates drying and a clay jug on the back of the counter
      L.hline(1, 4, 3, CLOTH[4]); L.hline(1, 4, 2, CLOTH[3]); L.set(2, 2, BLUE[4]); L.set(3, 2, BLUE[4]); L.hline(2, 3, 1, CLOTH[4]);
      grid(L, 12, 0, ['.aa.', 'bccd', 'bccd', 'bccd', '.cd.'], { a: CLAY[2], b: CLAY[4], c: CLAY[3], d: CLAY[2] });
      L.set(15, 2, CLAY[2]);
      // stone worktop with a basin
      L.hline(0, 15, 4, STONE[4]); L.rect(0, 5, 16, 2, STONE[3]); L.hline(0, 15, 7, STONE[2]);
      L.hline(3, 10, 4, STONE[1]); L.rect(3, 5, 8, 2, GLASS[2]); L.set(3, 5, STONE[1]); L.set(3, 6, STONE[1]);
      L.set(5, 5, GLASS[4]); L.set(6, 5, GLASS[5]);
      // cabinet
      L.rect(0, 8, 16, 6, WOOD[3]); L.hline(0, 15, 8, WOOD[2]);
      for (const x0 of [1, 8]) panel(L, x0, 9, 7, 4, [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]]);
      L.set(6, 11, GOLD[4]); L.set(9, 11, GOLD[4]);
      L.hline(0, 15, 14, WOOD[1]);
    }, { contact: [8.5, 14.6, 8, 1.3, 0.34] }));
  }

  function desk() {
    return cv(piece(16, 16, (L) => {
      // under-desk shadow and legs
      L.rect(1, 9, 2, 6, WOOD[2]); L.rect(13, 9, 2, 6, WOOD[1]); L.set(1, 9, WOOD[3]);
      // top
      L.hline(1, 14, 4, WOOD[5]); L.rect(1, 5, 14, 3, WOOD[4]); L.hline(1, 14, 8, WOOD[2]);
      L.rect(3, 9, 10, 3, WOOD[3]); L.hline(3, 12, 9, WOOD[4]); L.hline(3, 12, 11, WOOD[1]);
      L.set(7, 10, GOLD[4]); L.set(8, 10, GOLD[2]);
      // open book
      L.rect(2, 4, 6, 3, CREAM[4]); L.vline(4, 4, 6, CREAM[2]); L.vline(5, 4, 6, CREAM[3]);
      L.hline(2, 7, 6, CREAM[2]); L.set(2, 5, CREAM[1]); L.set(3, 5, CREAM[1]); L.set(6, 5, CREAM[1]); L.set(7, 5, CREAM[1]);
      L.set(3, 4, RED[3]);
      // ink pot and quill
      L.rect(9, 4, 2, 2, IRON[1]); L.set(9, 4, IRON[3]);
      L.set(11, 1, CLOTH[4]); L.set(11, 2, CLOTH[3]); L.set(10, 3, CLOTH[3]); L.set(12, 0, CLOTH[4]);
      // candle
      L.vline(13, 2, 5, CREAM[4]); L.set(13, 1, FIRE[4]); L.set(13, 0, FIRE[3]);
    }, { contact: [8.5, 13.5, 7.6, 2.3, 0.38] }));
  }

  function tableRound() {
    return cv(piece(16, 16, (L) => {
      // pedestal and foot
      L.rect(6, 11, 4, 3, WOOD[2]); L.set(6, 11, WOOD[3]); L.vline(9, 11, 13, WOOD[1]);
      L.hline(4, 11, 14, WOOD[2]); L.set(4, 14, WOOD[3]); L.set(11, 14, WOOD[1]);
      // top with edge thickness
      for (let y = 2; y <= 11; y++) for (let x = 0; x <= 15; x++) {
        const dx = (x - 7.5) / 7.2, dy = (y - 6) / 3.8, d = dx * dx + dy * dy;
        const dx2 = (x - 7.5) / 7.2, dy2 = (y - 7.6) / 3.8, d2 = dx2 * dx2 + dy2 * dy2;
        if (d <= 1) L.set(x, y, d > 0.72 && y < 6 ? WOOD[5] : WOOD[4]);
        else if (d2 <= 1 && y > 6) L.set(x, y, y > 9 ? WOOD[1] : WOOD[2]);
      }
      // doily, vase and flowers, a cup
      for (let x = 5; x <= 10; x++) L.set(x, 6, CLOTH[4]);
      for (let x = 6; x <= 9; x++) { L.set(x, 5, CLOTH[3]); L.set(x, 7, CLOTH[2]); }
      L.rect(7, 3, 2, 3, BLUE[4]); L.set(8, 4, BLUE[3]); L.set(7, 5, BLUE[3]); L.set(8, 5, BLUE[2]);
      L.set(6, 1, RED[4]); L.set(7, 2, GREEN[4]); L.set(9, 1, GOLD[5]); L.set(8, 2, GREEN[3]); L.set(8, 0, RED[3]);
      L.set(12, 6, CLOTH[4]); L.set(12, 7, CLOTH[2]); L.set(13, 7, CLOTH[1]);
    }, { contact: [8.5, 13.4, 7.4, 2.4, 0.36] }));
  }

  function plant() {
    return cv(piece(16, 32, (L, t) => {
      // clay pot
      L.hline(3, 12, 21, CLAY[5]); L.hline(3, 12, 22, CLAY[3]);
      for (let y = 23; y <= 29; y++) {
        const i = y - 23, x0 = 4 + (i > 4 ? 1 : 0), x1 = 11 - (i > 4 ? 1 : 0);
        for (let x = x0; x <= x1; x++) L.set(x, y, x < x0 + 2 ? CLAY[4] : x > x1 - 2 ? CLAY[2] : CLAY[3]);
      }
      L.hline(5, 10, 30, CLAY[1]); L.hline(4, 11, 25, CLAY[2]);
      // leafy crown
      const ramp = [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]];
      L.shadeEllipse(7.5, 14, 6.2, 6.2, ramp, { dither: 0.7, amb: 0.3 });
      L.shadeEllipse(4, 17, 3.5, 3.2, ramp, { dither: 0.7, amb: 0.35 });
      L.shadeEllipse(11.5, 17.5, 3.4, 3.1, ramp, { dither: 0.7, amb: 0.25 });
      L.shadeEllipse(6.5, 8.5, 3.6, 3.3, ramp, { dither: 0.7, amb: 0.5 });
      L.shadeEllipse(10.5, 10, 3, 2.8, ramp, { dither: 0.7, amb: 0.45 });
      // leaf tips and veins
      for (const [x, y] of [[5, 6], [8, 5], [3, 12], [12, 8], [2, 16], [13, 15], [6, 11], [9, 13]]) L.set(x, y, LEAF[5]);
      for (const [x, y] of [[10, 18], [7, 19], [12, 20], [4, 20], [11, 13]]) L.set(x, y, LEAF[0]);
      L.hline(4, 11, 21, t.mul(CLAY[5], 0.95));
    }, { outline: 0x0c2410, contact: [8.5, 30.3, 5.4, 1.6, 0.4] }));
  }

  function vase() {
    return cv(piece(16, 16, (L) => {
      const rows = { 5: [6, 9], 6: [6, 9], 7: [5, 10], 8: [4, 11], 9: [4, 11], 10: [4, 11], 11: [4, 11], 12: [5, 10], 13: [6, 9], 14: [5, 10] };
      for (const y in rows) {
        const [x0, x1] = rows[y];
        for (let x = x0; x <= x1; x++) L.set(x, +y, x === x0 ? CLOTH[4] : x === x1 ? CLOTH[1] : x < 8 ? CLOTH[3] : CLOTH[2]);
      }
      L.hline(5, 10, 4, BLUE[3]); L.set(5, 4, BLUE[4]);
      for (let x = 5; x <= 10; x++) { L.set(x, 9 + (x % 2), BLUE[3]); L.set(x, 11, (x % 3) ? BLUE[2] : BLUE[4]); }
      L.set(7, 7, BLUE[3]); L.set(8, 7, BLUE[3]); L.hline(5, 10, 14, BLUE[2]);
      // flowers
      L.set(7, 3, LEAF[3]); L.set(8, 2, LEAF[3]); L.set(6, 2, LEAF[4]); L.set(9, 3, LEAF[2]);
      L.set(5, 1, RED[4]); L.set(6, 1, RED[3]); L.set(5, 0, RED[5]);
      L.set(8, 0, GOLD[5]); L.set(9, 1, GOLD[4]); L.set(8, 1, GOLD[3]);
      L.set(10, 2, 0xf890d0); L.set(11, 2, 0xd060a0);
    }, { contact: [8.5, 14.6, 4.6, 1.5, 0.36] }));
  }

  /** one burlap sack (tied neck) into its own layer, outlined */
  function sack(t, cx, top, w, h) {
    const B = t.buf(16, 16), P = BURLAP;
    B.set(cx, top, P[4]); B.set(cx - 1, top + 1, P[4]); B.set(cx, top + 1, P[3]); B.set(cx + 1, top + 1, P[2]);
    B.set(cx - 1, top + 2, WOOD[2]); B.set(cx, top + 2, WOOD[1]);
    for (let y = top + 3; y < top + h; y++) {
      const i = y - top - 3, half = Math.min(w / 2, 1.5 + i * 1.2) - (y === top + h - 1 ? 1 : 0);
      const x0 = Math.round(cx - half), x1 = Math.round(cx + half) - 1;
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / Math.max(1, x1 - x0);
        B.set(x, y, u < 0.15 ? P[5] : u < 0.4 ? P[4] : u < 0.75 ? P[3] : P[2]);
      }
      if (y === top + h - 1) for (let x = x0; x <= x1; x++) B.set(x, y, P[2]);
    }
    B.outline(INK);
    return B;
  }
  function sacks() {
    return cv(piece(16, 16, (L, t) => {
      L.blit(sack(t, 11, 0, 7, 12), 0, 0);
      const f = sack(t, 6, 3, 8, 12);
      // stencilled mark
      f.set(5, 10, BURLAP[1]); f.set(7, 10, BURLAP[1]); f.set(6, 11, BURLAP[1]); f.set(5, 12, BURLAP[1]); f.set(7, 12, BURLAP[1]);
      L.blit(f, 0, 0);
      // small sack lying in front
      for (let y = 12; y <= 14; y++) for (let x = 10; x <= 15; x++) {
        if ((y === 12 || y === 14) && (x === 10 || x === 15)) continue;
        L.set(x, y, y === 12 ? BURLAP[4] : y === 13 ? BURLAP[3] : BURLAP[2]);
      }
      L.set(15, 13, WOOD[2]);
      // spilled grain
      for (const [x, y] of [[1, 15], [2, 14], [3, 15], [0, 14]]) L.set(x, y, (x + y) % 2 ? GOLD[4] : GOLD[3]);
    }, { outline: false, contact: [8.5, 14.6, 7.8, 1.5, 0.36] }));
  }

  function crates() {
    return cv(piece(16, 32, (L) => {
      const crate = (x0, y0, w, h, top) => {
        // top face
        L.rect(x0, y0, w, top, WOOD[4]); L.hline(x0, x0 + w - 1, y0, WOOD[5]);
        for (let x = x0 + 3; x < x0 + w - 1; x += 3) L.vline(x, y0 + 1, y0 + top - 1, WOOD[3]);
        // front
        const fy = y0 + top;
        L.rect(x0, fy, w, h - top, WOOD[3]);
        for (let y = fy + 2; y < y0 + h - 1; y += 3) L.hline(x0 + 1, x0 + w - 2, y, WOOD[2]);
        L.vline(x0, fy, y0 + h - 1, WOOD[4]); L.vline(x0 + 1, fy, y0 + h - 1, WOOD[4]);
        L.vline(x0 + w - 1, fy, y0 + h - 1, WOOD[1]); L.vline(x0 + w - 2, fy, y0 + h - 1, WOOD[2]);
        L.hline(x0, x0 + w - 1, fy, WOOD[2]); L.hline(x0, x0 + w - 1, y0 + h - 1, WOOD[1]);
        L.line(x0 + 2, y0 + h - 2, x0 + w - 3, fy + 1, WOOD[4]);
      };
      crate(1, 17, 14, 14, 3);
      crate(2, 7, 11, 11, 3);
      // stencilled marks
      L.set(6, 13, WOOD[1]); L.set(7, 14, WOOD[1]); L.set(8, 13, WOOD[1]); L.set(7, 12, WOOD[1]);
      L.rect(10, 25, 2, 2, RED[2]);
    }, { contact: [8.5, 30.4, 8, 1.6, 0.4], drop: [1, 0, 0.24] }));
  }

  function armorStand() {
    return cv(piece(16, 32, (L) => {
      const S = STEEL;
      grid(L, 2, 1, [
        '.....rrq....',
        '....rrqq....',
        '.....rq.....',
        '....abbc....',
        '...abbbcd...',
        '...abbbcd...',
        '...kkkkkd...',
        '...abbbcd...',
        '....bbcc....',
        '.....dd.....',
        '.abbabbbcdcd',
        'abbbabbbcdcd',
        'abb.abebcd.d',
        'ab..abebcd.d',
        'ab..abebcd.d',
        'ab..abebcd.c',
        'ab..abbbcd.d',
        'ab.gggggggd.',
        'bb..abbccd.d',
        'c...abbccd.c',
        '....ab.bcd..',
        '....ab.ccd..',
        '....ab.bcd..',
        '....bb.cc...',
        '....ab.bcd..',
        '....ab.bcd..',
        '...abb.bccd.',
        '..wwwwwwwwww',
        '..vvvvvvvvvv',
      ], { r: RED[4], q: RED[2], a: S[4], b: S[3], c: S[2], d: S[1], e: S[5], k: IRON[0], g: GOLD[3], w: WOOD[4], v: WOOD[2] });
      L.set(8, 18, GOLD[5]); L.set(9, 18, GOLD[4]);
      L.set(8, 21, STEEL[2]); L.vline(8, 21, 27, WOOD[2]);
    }, { contact: [8.5, 30.2, 6.6, 1.6, 0.42], drop: [1, 0, 0.24] }));
  }

  function weaponRack() {
    return cv(piece(16, 32, (L) => {
      // spear with a red tassel
      L.vline(4, 4, 27, WOOD[4]); L.set(4, 0, STEEL[5]); L.hline(3, 5, 1, STEEL[4]); L.hline(3, 5, 2, STEEL[3]); L.set(5, 2, STEEL[2]);
      L.set(4, 3, STEEL[2]); L.set(3, 4, RED[4]); L.set(5, 4, RED[3]); L.set(4, 5, RED[2]);
      // sword
      L.set(7, 5, STEEL[5]); L.vline(7, 6, 20, STEEL[5]); L.vline(8, 6, 20, STEEL[3]); L.set(8, 5, null);
      L.hline(5, 10, 21, GOLD[3]); L.set(5, 21, GOLD[4]); L.set(10, 21, GOLD[2]);
      L.vline(7, 22, 25, WOOD[1]); L.vline(8, 22, 25, WOOD[0]); L.set(7, 26, GOLD[4]); L.set(8, 26, GOLD[2]);
      // axe
      L.vline(11, 7, 27, WOOD[3]);
      grid(L, 12, 6, ['ab.', 'abb', 'abc', 'abc', 'bbc', 'b..'], { a: STEEL[5], b: STEEL[4], c: STEEL[2] });
      L.set(10, 8, STEEL[3]); L.set(11, 6, WOOD[4]);
      // rack: two posts, a slotted rail and a base plank
      L.rect(1, 15, 2, 13, WOOD[3]); L.vline(1, 15, 27, WOOD[4]);
      L.rect(13, 15, 2, 13, WOOD[2]); L.vline(14, 15, 27, WOOD[1]);
      L.hline(0, 15, 15, WOOD[5]); L.hline(0, 15, 16, WOOD[3]); L.hline(0, 15, 17, WOOD[1]);
      for (const x of [4, 7, 8, 11]) L.set(x, 16, WOOD[0]);
      L.hline(0, 15, 28, WOOD[4]); L.hline(0, 15, 29, WOOD[2]); L.hline(0, 15, 30, WOOD[1]);
    }, { contact: [8.5, 30.4, 8, 1.5, 0.4], drop: [1, 0, 0.24] }));
  }

  function treasure() {
    return cv(piece(16, 16, (L, t, U, O) => {
      // goblet and crown behind the pile
      grid(L, 10, 2, ['abbc', 'abbc', '.bc.', '.bc.', '..b.', '.bbc'], { a: GOLD[5], b: GOLD[4], c: GOLD[2] });
      grid(L, 1, 5, ['a.a.a', 'aaraa', 'bbbbb'], { a: GOLD[4], r: RED[4], b: GOLD[2] });
      // coin mound
      for (let y = 6; y <= 15; y++) for (let x = 0; x <= 15; x++) {
        const dx = (x - 7.5) / 7.3, dy = (y - 12.3) / 4.4, d = dx * dx + dy * dy;
        if (d > 1 || y > 14) continue;
        const h = t.hash(x >> 1, (y + (x & 1)) >> 1, 91);
        let c = h < 0.3 ? GOLD[2] : h < 0.75 ? GOLD[3] : GOLD[4];
        if (y >= 13) c = h < 0.5 ? GOLD[2] : GOLD[1];
        if (x + y < 12 && h > 0.5) c = GOLD[5];
        L.set(x, y, c);
      }
      // gems
      for (const [x, y, G] of [[4, 10, RED], [11, 11, BLUE], [7, 12, GREEN], [9, 9, PURPLE]]) {
        L.set(x, y, G[4]); L.set(x + 1, y, G[2]); L.set(x, y - 1, G[5]);
      }
      // pearl strand
      for (const x of [2, 4, 6]) L.set(x, 13, 0xf4f0ff);
      O.put(5, 8, 0xffffff, 0.9); O.put(12, 9, 0xffffff, 0.8); O.put(11, 2, 0xffffff, 0.9);
    }, { contact: [8.5, 14.5, 7.8, 1.6, 0.38] }));
  }

  function candelabra(f) {
    return piece(16, 32, (L, t, U) => {
      const CX = [2, 7, 12], TOP = [6, 5, 6];
      for (let i = 0; i < 3; i++) glow(U, CX[i] + 1, TOP[i] - 2, f ? 3.6 : 4.2, 0.2);
      for (let i = 0; i < 3; i++) {
        const x = CX[i], y0 = TOP[i];
        L.rect(x, y0, 2, 11 - y0, CREAM[4]); L.vline(x + 1, y0, 10, CREAM[2]); L.set(x, y0 + 1, CREAM[3]);
        const h = f ? 3 : 4, lean = f && i !== 1 ? (i === 0 ? 1 : 0) : 0;
        for (let k = 1; k <= h; k++) L.set(x + (k === h ? lean : 0), y0 - k, k === 1 ? FIRE[4] : k === h ? FIRE[2] : FIRE[3]);
        L.set(x + 1, y0 - 1, FIRE[3]); L.set(x, y0 - 1, FIRE[5]);
        // drip cup
        L.hline(x - 1, x + 2, 11, GOLD[4]); L.hline(x, x + 1, 12, GOLD[2]);
      }
      // arms
      L.hline(2, 13, 14, GOLD[3]); L.set(2, 13, GOLD[4]); L.set(13, 13, GOLD[2]); L.hline(3, 12, 15, GOLD[2]);
      L.vline(7, 12, 13, GOLD[4]); L.vline(8, 12, 13, GOLD[2]);
      // stem with knops
      L.vline(7, 16, 27, GOLD[4]); L.vline(8, 16, 27, GOLD[2]);
      for (const y of [18, 23]) { L.hline(6, 9, y, GOLD[3]); L.set(6, y, GOLD[5]); L.set(9, y, GOLD[1]); }
      // tripod foot
      L.hline(5, 10, 28, GOLD[3]); L.hline(4, 11, 29, GOLD[2]); L.set(4, 30, GOLD[2]); L.set(11, 30, GOLD[1]); L.set(7, 30, GOLD[2]);
      L.set(5, 28, GOLD[5]);
    }, { f, contact: [8.5, 30.4, 4.8, 1.4, 0.38] });
  }

  function globe() {
    return cv(piece(16, 16, (L, t) => {
      // stand
      L.hline(4, 11, 14, WOOD[2]); L.hline(5, 10, 13, WOOD[4]); L.set(4, 14, WOOD[3]);
      L.rect(7, 11, 2, 2, WOOD[3]); L.set(8, 12, WOOD[2]);
      // meridian ring
      for (let a = -1.9; a <= 1.9; a += 0.05) {
        const x = 7.5 + Math.sin(a) * 6.2, y = 6.2 - Math.cos(a) * 6.2;
        L.set(Math.round(x), Math.round(y), a < 0 ? GOLD[4] : GOLD[2]);
      }
      // sphere: ocean and continents
      for (let y = 1; y <= 11; y++) for (let x = 2; x <= 13; x++) {
        const dx = (x - 7.5) / 5.1, dy = (y - 6.2) / 5.1, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2), l = (-dx * 0.6 - dy * 0.7 + nz * 0.6 + 0.3) / 1.3;
        const land = t.fnoise(x * 1.6 + 3, y * 1.6, 8, 32, 17) > 0.56;
        const P = land ? [GREEN[1], GREEN[2], GREEN[3], GREEN[4], 0xb0a060] : [BLUE[1], BLUE[2], BLUE[3], BLUE[4], BLUE[5]];
        L.set(x, y, t.pickRamp(P, l, x, y, 0.5));
      }
      L.set(5, 3, 0xffffff); L.set(6, 3, BLUE[5]);
    }, { contact: [8.5, 14.6, 5, 1.4, 0.36] }));
  }

  function anvil() {
    return cv(piece(16, 16, (L) => {
      // stump
      L.rect(3, 10, 10, 5, WOOD[2]); L.vline(3, 10, 14, WOOD[3]); L.vline(12, 10, 14, WOOD[1]);
      for (const x of [5, 8, 10]) L.vline(x, 11, 14, WOOD[1]);
      L.hline(3, 12, 10, WOOD[4]);
      // anvil
      grid(L, 0, 3, [
        '...aaaaaaaaaa...',
        '.abbbbbbbbbbbbc.',
        '...cccccccccccd.',
        '......cccd......',
        '......cccd......',
        '....abbbbbbcd...',
        '....ccccccccd...',
      ], { a: IRON[5], b: IRON[4], c: IRON[3], d: IRON[1] });
      L.set(1, 4, IRON[4]); L.set(0, 4, IRON[3]);
      // hammer resting on top
      L.hline(5, 9, 2, WOOD[4]); L.rect(10, 1, 3, 2, IRON[3]); L.set(10, 1, IRON[4]); L.set(12, 2, IRON[1]);
    }, { contact: [8.5, 14.6, 7, 1.4, 0.36] }));
  }

  // =============================================================== JOINING PIECES
  // connected components of one decor id (bounding box, rect or not), per map
  const COMP = new WeakMap();
  function component(m, id, x, y) {
    let per = COMP.get(m);
    if (!per) { per = {}; COMP.set(m, per); }
    let c = per[id];
    if (!c) {
      c = per[id] = { lab: new Int32Array(m.w * m.h).fill(-1), box: [] };
      for (let sy = 0; sy < m.h; sy++) for (let sx = 0; sx < m.w; sx++) {
        const i = sy * m.w + sx;
        if (c.lab[i] !== -1 || m.decorAt(sx, sy) !== id) continue;
        const k = c.box.length, b = { x0: sx, y0: sy, x1: sx, y1: sy, n: 0 };
        c.box.push(b);
        const st = [[sx, sy]];
        c.lab[i] = k;
        while (st.length) {
          const [px, py] = st.pop();
          b.n++;
          b.x0 = Math.min(b.x0, px); b.x1 = Math.max(b.x1, px); b.y0 = Math.min(b.y0, py); b.y1 = Math.max(b.y1, py);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = px + dx, ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
            const j = ny * m.w + nx;
            if (c.lab[j] === -1 && m.decorAt(nx, ny) === id) { c.lab[j] = k; st.push([nx, ny]); }
          }
        }
        b.rect = b.n === (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
      }
    }
    const k = c.lab[y * m.w + x];
    return k >= 0 ? c.box[k] : { x0: x, y0: y, x1: x, y1: y, n: 1, rect: true };
  }
  /** same-id flags of the 8 neighbours */
  function edges(m, id, x, y) {
    const s = (dx, dy) => m.decorAt(x + dx, y + dy) === id;
    return { N: s(0, -1), S: s(0, 1), W: s(-1, 0), E: s(1, 0), NW: s(-1, -1), NE: s(1, -1), SW: s(-1, 1), SE: s(1, 1) };
  }
  const ekey = (e) => (e.N ? 'n' : '') + (e.S ? 's' : '') + (e.W ? 'w' : '') + (e.E ? 'e' : '') + (e.NW ? '1' : '') + (e.NE ? '2' : '') + (e.SW ? '3' : '') + (e.SE ? '4' : '');
  const CACHE = new Map();
  function cached(key, make) {
    let v = CACHE.get(key);
    if (v === undefined) { v = make(); CACHE.set(key, v); }
    return v;
  }
  const ALL = { N: true, S: true, W: true, E: true, NW: true, NE: true, SW: true, SE: true };
  const NONE_E = { N: false, S: false, W: false, E: false, NW: false, NE: false, SW: false, SE: false };

  /** floor-shadow (walls & furniture to the north/west) as translucent black, matching tiles_auto */
  function floorShade(img, m, x, y) {
    if (!m || typeof A.floorShadeK !== 'function') return img;
    const k = A.floorShadeK(m, x, y);
    if (!k) return img;
    for (let i = 0; i < 256; i++) if (k[i] < 1 && img.d[i * 4 + 3] > 0) img.put(i & 15, i >> 4, 0x000000, 1 - k[i]);
    return img;
  }

  // ------------------------------------------------------------ rugs
  const RUGS = {
    rug: { F: RED, B: BLUE, dot: GOLD[4], med: BLUE },
    rug_blue: { F: BLUE, B: RED, dot: GOLD[4], med: RED },
  };
  /** rug cell: box = component bbox (tiles), e = neighbour flags */
  function rugCell(id, box, cx, cy, e) {
    const S = RUGS[id], F = S.F, B = S.B;
    const img = new Img(16, 16);
    const W = (box.x1 - box.x0 + 1) * 16, H = (box.y1 - box.y0 + 1) * 16;
    const ox = (cx - box.x0) * 16, oy = (cy - box.y0) * 16;
    const big = box.rect && W >= 48 && H >= 48;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const u = ox + i, v = oy + j;
      // distance to the rug's outline inside this cell (N/S ends carry a fringe)
      const dN = e.N ? 99 : j, dS = e.S ? 99 : 15 - j, dW = e.W ? 99 : i, dE = e.E ? 99 : 15 - i;
      const cNW = e.N && e.W && !e.NW ? Math.max(i, j) : 99, cNE = e.N && e.E && !e.NE ? Math.max(15 - i, j) : 99;
      const cSW = e.S && e.W && !e.SW ? Math.max(i, 15 - j) : 99, cSE = e.S && e.E && !e.SE ? Math.max(15 - i, 15 - j) : 99;
      const dNS = Math.min(dN, dS), dWE = Math.min(dW, dE, cNW, cNE, cSW, cSE);
      let d = Math.min(dWE, dNS - 1);
      const fringe = dNS === 0 && dWE > 0;
      let c;
      if (fringe) { if (i % 2 === 0) img.put(i, j, CREAM[3], 1); else img.put(i, j, CREAM[1], 1); continue; }
      if (d < 0) d = 0;
      // along-edge coordinate for the border motif
      const s = dWE <= dNS - 1 ? v : u;
      if (d === 0) c = F[0];
      else if (d === 1) c = GOLD[3];
      else if (d === 2 || d === 3) {
        c = B[2];
        const q = ((s % 6) + 6) % 6;
        if (q === 0 || q === 1) c = d === 2 ? GOLD[4] : GOLD[2];
        else if (q === 3 && d === 2) c = B[4];
      } else if (d === 4) c = GOLD[2];
      else {
        // field: diamond lattice around rosettes, anchored on the rug centre
        const su = u - W / 2 + 0.5, sv = v - H / 2 + 0.5;
        const du = ((su % 16) + 24) % 16 - 8, dv = ((sv % 16) + 24) % 16 - 8;
        const a = Math.abs(du) + Math.abs(dv);
        c = F[3];
        if (a <= 1.1) c = S.dot;
        else if (a <= 3.1) c = (Math.abs(du) < 0.6 || Math.abs(dv) < 0.6) ? GOLD[3] : F[2];
        else if (Math.abs(a - 7.5) < 0.6) c = F[2];
        else if (Math.abs(a - 8) < 0.1) c = F[4];
        if ((i + j) % 2 === 0 && c === F[3] && tk().hash(u, v, 23) < 0.06) c = F[4];
        if (big) {
          // central medallion
          const rx = Math.min(W / 2 - 14, 40), ry = Math.min(H / 2 - 14, 30);
          const mu = (u + 0.5 - W / 2) / rx, mv = (v + 0.5 - H / 2) / ry, md = Math.sqrt(mu * mu + mv * mv);
          if (md <= 1.12) {
            const edge = Math.abs(md - 1) * Math.min(rx, ry);
            if (edge < 1.1) c = GOLD[3];
            else if (md < 1) {
              const r = md * Math.min(rx, ry);
              const star = Math.abs(mu) + Math.abs(mv) < 0.62;
              c = S.med[2];
              if (r < 2.2) c = GOLD[5];
              else if (star) c = Math.abs(Math.abs(mu) + Math.abs(mv) - 0.6) < 0.08 ? GOLD[4] : F[4];
              else if (Math.abs(md - 0.82) < 0.05) c = GOLD[2];
              else if (((u + v) & 3) === 0) c = S.med[3];
            } else c = F[1];
          }
        }
      }
      img.put(i, j, c, 1);
    }
    return img;
  }
  function rugAuto(id) {
    return (m, x, y) => {
      const box = component(m, id, x, y), e = edges(m, id, x, y);
      const key = id + '|' + (box.x1 - box.x0) + ',' + (box.y1 - box.y0) + ',' + (x - box.x0) + ',' + (y - box.y0) + ',' + +box.rect + '|' + ekey(e) + '|' + shadeKey(m, x, y);
      return cached(key, () => floorShade(rugCell(id, box, x, y, e), m, x, y).canvas());
    };
  }
  function rugPlain(id) {
    return () => {
      // a single small rug (doormat size) with fringe
      return rugCell(id, { x0: 0, y0: 0, x1: 0, y1: 0, rect: true }, 0, 0, NONE_E).canvas();
    };
  }
  const shadeKey = (m, x, y) => (typeof A.floorShadeKey === 'function' ? A.floorShadeKey(m, x, y) : '');

  // ------------------------------------------------------------ dais
  /** riser palette (dark → light, 5) for the map's theme / the tile under it */
  function daisPal(m, x, y) {
    if (m && m.tileAt(x, y) === 'carpet') return [RED[0], RED[1], RED[2], RED[3], RED[4]];
    const th = m && m.theme && A.THEME_DEFS && A.THEME_DEFS[m.theme];
    if (!th) return [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4]];
    if (!th.fl) return [WOOD[0], WOOD[1], WOOD[2], WOOD[3], WOOD[4]];
    return th.fl.slice(0, 5);
  }
  function daisCell(e, P, u0) {
    const img = new Img(16, 16);
    const riser = !e.S;
    const top = riser ? 10 : 16;
    for (let j = 0; j < top; j++) for (let i = 0; i < 16; i++) {
      img.put(i, j, 0xfff8e8, 0.1);
      if (!e.N && j === 0) img.put(i, j, 0xffffff, 0.45);
      if (!e.W && i === 0) img.put(i, j, 0xffffff, 0.35);
      if (!e.E && i === 15) img.put(i, j, 0x000000, 0.4);
    }
    if (riser) {
      const t = tk();
      const rows = [t.shade(P[4], 0.25), t.mul(P[2], 0.78), t.mul(P[1], 0.72), P[4], t.mul(P[2], 0.72), t.mul(P[1], 0.6)];
      for (let j = 0; j < 6; j++) for (let i = 0; i < 16; i++) {
        let c = rows[j];
        const u = u0 + i;
        if ((j === 1 || j === 2 || j === 4 || j === 5) && (u & 7) === 7) c = t.mul(P[0], 0.8);
        if (!e.W && i === 0) c = j === 0 || j === 3 ? t.shade(P[4], 0.3) : P[3];
        if (!e.E && i === 15) c = t.mul(P[0], 0.7);
        img.put(i, 10 + j, c, 1);
      }
    }
    return img;
  }
  function daisAuto(m, x, y) {
    const e = edges(m, 'dais', x, y), P = daisPal(m, x, y), box = component(m, 'dais', x, y);
    const u0 = (x - box.x0) * 16;
    return cached('dais|' + ekey(e) + '|' + P.join(',') + '|' + (u0 & 15), () => daisCell(e, P, u0).canvas());
  }

  // ------------------------------------------------------------ long table
  /** e: neighbour flags; box: component; items keyed by position in the run */
  function tableCell(e, box, x, y) {
    const i = x - box.x0, j = y - box.y0, nx = box.x1 - box.x0 + 1, ny = box.y1 - box.y0 + 1;
    const vertical = ny > 1 && nx === 1;
    return piece(16, 16, (L, t, U, O) => {
      const x0 = e.W ? 0 : 1, x1 = e.E ? 15 : 14;
      const y0 = e.N ? 0 : 3, y1 = e.S ? 15 : 10;
      // legs & shadow under the table (only below the front edge)
      if (!e.S) {
        for (let q = x0; q <= x1; q++) U.put(q, 13, SH, 0.34), U.put(q, 14, SH, 0.3);
        if (!e.W) { L.rect(1, 12, 2, 3, WOOD[2]); L.set(1, 12, WOOD[3]); }
        if (!e.E) { L.rect(13, 12, 2, 3, WOOD[1]); }
      }
      // cloth over the top, hanging over the front edge
      L.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, CLOTH[3]);
      if (!e.N) L.hline(x0, x1, y0, CLOTH[4]);
      if (!e.W) L.vline(x0, y0, y1, CLOTH[4]);
      if (!e.E) L.vline(x1, y0, y1, CLOTH[1]);
      if (!e.S) {
        L.rect(x0, 11, x1 - x0 + 1, 2, CLOTH[2]);
        for (let q = x0; q <= x1; q++) { if (q % 4 === 1) L.set(q, 11, CLOTH[1]); if (q % 2 === 0) L.set(q, 13, CLOTH[2]); }
        L.hline(x0, x1, 10, CLOTH[4]);
      }
      // red runner along the length
      if (vertical) {
        for (let q = y0; q <= y1; q++) { L.set(6, q, GOLD[3]); L.set(7, q, RED[3]); L.set(8, q, RED[2]); L.set(9, q, GOLD[2]); }
      } else {
        for (let q = x0; q <= x1; q++) { L.set(q, 5, GOLD[3]); L.set(q, 6, RED[3]); L.set(q, 7, RED[2]); L.set(q, 8, GOLD[2]); }
      }
      // tableware
      const plate = (cx, cy) => {
        L.hline(cx - 1, cx + 1, cy - 1, CLOTH[4]); L.hline(cx - 2, cx + 2, cy, CLOTH[4]); L.hline(cx - 1, cx + 1, cy + 1, CLOTH[1]);
        L.set(cx - 2, cy, CLOTH[2]); L.set(cx + 2, cy, CLOTH[1]); L.set(cx, cy, BLUE[4]);
      };
      const goblet = (cx, cy) => { L.set(cx, cy - 1, GOLD[5]); L.set(cx, cy, GOLD[3]); L.set(cx, cy + 1, GOLD[2]); };
      const n = vertical ? ny : nx, k = vertical ? j : i;
      const mid = n >= 3 && (k === (n >> 1) || (n % 2 === 0 && k === (n >> 1) - 1 && n > 5));
      const kind = n === 1 ? 'fruit' : mid ? 'candles' : ['plates', 'fruit', 'plates', 'bread', 'plates', 'roast'][(k + (n > 4 ? 1 : 0)) % 6];
      if (vertical) {
        plate(3, 4 + (k % 2) * 5); plate(12, 9 - (k % 2) * 5);
        goblet(4, 12); goblet(11, 2);
      } else if (kind !== 'candles') {
        plate(4, 3 + (e.N ? 0 : 1)); plate(11, 9);
        goblet(1 + (e.W ? 0 : 1) + 12, 4); goblet(2 + (e.W ? 0 : 1), 9);
      }
      const cxm = vertical ? 7 : 7, cym = vertical ? 7 : 6;
      if (kind === 'candles') {
        L.hline(cxm - 3, cxm + 4, cym + 1, GOLD[3]); L.hline(cxm - 2, cxm + 3, cym + 2, GOLD[2]);
        for (const dx of [-3, 0, 3]) {
          const hx = cxm + (dx === 0 ? 0 : dx) + (dx > 0 ? 1 : 0);
          L.vline(hx, cym - 3 + (dx === 0 ? -1 : 0), cym, CREAM[4]);
          L.set(hx, cym - 4 + (dx === 0 ? -1 : 0), FIRE[4]); L.set(hx, cym - 5 + (dx === 0 ? -1 : 0), FIRE[3]);
          glow(U, hx + 0.5, cym - 4, 2.5, 0.16);
        }
        plate(3, 10); plate(12, 10);
      } else if (kind === 'fruit') {
        L.hline(cxm - 2, cxm + 3, cym + 1, CLOTH[4]); L.hline(cxm - 1, cxm + 2, cym + 2, CLOTH[2]);
        L.set(cxm - 1, cym, RED[4]); L.set(cxm, cym, RED[3]); L.set(cxm + 1, cym - 1, GOLD[4]); L.set(cxm + 2, cym, GREEN[4]);
        L.set(cxm, cym - 1, 0x9c40a0); L.set(cxm + 1, cym, GOLD[3]);
      } else if (kind === 'bread') {
        L.hline(cxm - 2, cxm + 3, cym + 1, WOOD[4]); L.hline(cxm - 1, cxm + 2, cym + 2, WOOD[2]);
        L.hline(cxm - 1, cxm + 2, cym, CLAY[4]); L.set(cxm, cym - 1, CLAY[5]); L.set(cxm + 1, cym - 1, CLAY[4]);
      } else if (kind === 'roast') {
        L.hline(cxm - 3, cxm + 4, cym + 2, CLOTH[4]);
        L.hline(cxm - 1, cxm + 2, cym + 1, CLAY[3]); L.hline(cxm - 1, cxm + 2, cym, CLAY[4]); L.set(cxm, cym - 1, CLAY[5]);
        L.set(cxm - 2, cym, CREAM[4]); L.set(cxm + 3, cym, CREAM[4]);
      } else {
        // wine bottle
        L.vline(cxm + 1, cym - 2, cym + 1, GREEN[2]); L.set(cxm + 1, cym - 3, WOOD[4]); L.set(cxm + 1, cym - 1, GREEN[4]);
      }
    }, { outline: INK });
  }
  function tableAuto(m, x, y) {
    const e = edges(m, 'table_long', x, y), box = component(m, 'table_long', x, y);
    const key = 'tl|' + ekey(e) + '|' + (x - box.x0) + ',' + (y - box.y0) + '|' + (box.x1 - box.x0) + ',' + (box.y1 - box.y0);
    return cached(key, () => tableCell(e, box, x, y).canvas());
  }

  // ------------------------------------------------------------ bench (joins sideways)
  function benchCell(l, r) {
    return piece(16, 16, (L, t, U) => {
      const x0 = l ? 0 : 1, x1 = r ? 15 : 14;
      for (let q = x0; q <= x1; q++) U.put(q, 12, SH, 0.22);
      if (!l) { L.rect(2, 10, 2, 4, WOOD[2]); L.set(2, 10, WOOD[3]); }
      if (!r) L.rect(12, 10, 2, 4, WOOD[1]);
      if (!l || !r) L.hline(l ? 0 : 3, r ? 15 : 12, 12, WOOD[1]);
      L.hline(x0, x1, 6, WOOD[5]); L.rect(x0, 7, x1 - x0 + 1, 2, WOOD[4]); L.hline(x0, x1, 8, WOOD[3]);
      L.hline(x0, x1, 9, WOOD[2]);
      for (let q = x0 + 2; q <= x1; q += 7) L.set(q, 7, WOOD[3]);
      if (!l) L.vline(x0, 6, 9, WOOD[5]);
      if (!r) L.vline(x1, 7, 9, WOOD[1]);
    }, { outline: INK });
  }
  function benchAuto(m, x, y) {
    const l = m.decorAt(x - 1, y) === 'bench', r = m.decorAt(x + 1, y) === 'bench';
    return cached('bench|' + +l + +r, () => benchCell(l, r).canvas());
  }

  // ------------------------------------------------------------ mosaic
  /** inlaid floor: ivory tesserae, gold/red border, star rosette centred on the region */
  function mosaicCell(box, cx, cy, e) {
    const img = new Img(16, 16);
    const W = (box.x1 - box.x0 + 1) * 16, H = (box.y1 - box.y0 + 1) * 16;
    const ox = (cx - box.x0) * 16, oy = (cy - box.y0) * 16;
    const IV = [0xb0a488, 0xcfc4a6, 0xe4dabc, 0xf2ead2];
    const R0 = Math.max(3, Math.min(W, H) / 2 - 5);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const u = ox + i, v = oy + j;
      const dN = e.N ? 99 : j, dS = e.S ? 99 : 15 - j, dW = e.W ? 99 : i, dE = e.E ? 99 : 15 - i;
      const d = Math.min(dN, dS, dW, dE);
      const tess = ((u >> 1) + (v >> 1)) % 2;
      let c;
      if (d === 0) c = 0x2c2430;
      else if (d === 1) c = GOLD[3];
      else if (d === 2) c = tess ? RED[2] : RED[3];
      else if (d === 3) c = GOLD[2];
      else {
        const px = u + 0.5 - W / 2, py = v + 0.5 - H / 2, r = Math.hypot(px, py);
        const ang = Math.atan2(py, px);
        const star = R0 * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(ang * 4)), 3));
        c = tess ? IV[2] : IV[3];
        if (r < R0 + 1.5 && r > R0 + 0.3) c = BLUE[2];
        else if (r <= star) {
          const inner = star - r < 1.1;
          c = inner ? GOLD[3] : (Math.cos(ang * 4) > 0 ? (tess ? BLUE[3] : BLUE[4]) : tess ? RED[3] : RED[4]);
          if (r < R0 * 0.28) c = tess ? GOLD[4] : GOLD[5];
          else if (r < R0 * 0.36) c = GOLD[2];
        } else if (r < R0 + 0.3 && ((u + v) % 3 === 0)) c = IV[1];
      }
      img.put(i, j, c, 1);
    }
    return img;
  }
  function mosaicAuto(m, x, y) {
    const e = edges(m, 'mosaic', x, y), box = component(m, 'mosaic', x, y);
    const key = 'mo|' + ekey(e) + '|' + (x - box.x0) + ',' + (y - box.y0) + '|' + (box.x1 - box.x0) + ',' + (box.y1 - box.y0) + '|' + shadeKey(m, x, y);
    return cached(key, () => floorShade(mosaicCell(box, x, y, e), m, x, y).canvas());
  }

  // ------------------------------------------------------------ theme-aware wall pieces
  const STONE_THEMES = { castle: 1, fort: 1, tower: 1, shrine: 1, demon: 1, pyramid: 1, ice: 1, cave: 1, water: 1, volcano: 1 };
  function windowAuto(m) {
    const th = m.theme;
    if (th === 'house') return cached('win|house', () => windowRect('wood', true));
    if (STONE_THEMES[th]) return cached('win|stone', () => windowRect('stone', false));
    return null;
  }
  function windowArchAuto(m) {
    if (m.theme === 'shrine') return cached('warch|stained', () => windowArch('stained'));
    if (m.theme === 'demon') return cached('warch|dark', () => windowArch('dark'));
    return null;
  }
  const FIRE_PAL = { castle: STONE, fort: WARM, house: BRICK, tower: STONE, shrine: STONE, demon: [0x140a18, 0x281c34, 0x3c2c4c, 0x524066, 0x6c5884, 0x8c78a4] };
  function fireplaceAuto(m) {
    const P = FIRE_PAL[m.theme];
    if (!P) return null;
    return cached('fp|' + m.theme, () => [0, 1, 2].map((f) => fireplace(f, P).canvas()));
  }
  // floor overlays the floor tile already paints (tiles_auto): nothing to draw on top
  let EMPTY = null;
  const empty = () => EMPTY || (EMPTY = new Img(1, 1).canvas());
  function inFloor(kind) {
    return (m, x, y) => (typeof A.floorHandlesDecor === 'function' && A.floorHandlesDecor(m, x, y, kind) ? empty() : null);
  }

  // =============================================================== REGISTER
  const D = {
    banner_red: () => banner(RED, 'point'),
    banner_blue: () => banner(BLUE, 'tail'),
    tapestry,
    window: () => windowRect('wood', false),
    window_arch: () => windowArch('leaded'),
    sconce: () => [0, 1].map((f) => sconce(f).canvas()),
    painting, portrait, emblem, swords,
    wall_shelf: wallShelf,
    mirror,
    rug: rugPlain('rug'),
    rug_blue: rugPlain('rug_blue'),
    dais: () => daisCell(NONE_E, [STONE[0], STONE[1], STONE[2], STONE[3], STONE[4]], 0).canvas(),
    crack: () => crackOverlay().canvas(),
    tile_alt: () => tileAltOverlay().canvas(),
    mosaic: () => mosaicCell({ x0: 0, y0: 0, x1: 0, y1: 0, rect: true }, 0, 0, NONE_E).canvas(),
    grate,
    straw,
    leaves,
    flowers_low: flowersLow,
    stool,
    fireplace: () => [0, 1, 2].map((f) => fireplace(f).canvas()),
    stove: () => [0, 1].map((f) => stove(f).canvas()),
    sink, cupboard, wardrobe, dresser, desk,
    table_round: tableRound,
    table_long: () => tableCell(NONE_E, { x0: 0, y0: 0, x1: 0, y1: 0 }, 0, 0).canvas(),
    bench: () => benchCell(false, false).canvas(),
    plant, vase, sacks, crates,
    armor_stand: armorStand,
    weapon_rack: weaponRack,
    treasure,
    candelabra: () => [0, 1].map((f) => candelabra(f).canvas()),
    globe, anvil, clock,
  };
  for (const id in D) R.Gfx.def('decor:' + id, D[id]);
  A.INTERIOR_DECOR = Object.keys(D);

  Object.assign(A.decorAuto, {
    rug: rugAuto('rug'),
    rug_blue: rugAuto('rug_blue'),
    dais: daisAuto,
    table_long: tableAuto,
    bench: benchAuto,
    mosaic: mosaicAuto,
    window: windowAuto,
    window_arch: windowArchAuto,
    fireplace: fireplaceAuto,
    tile_alt: inFloor('tile_alt'),
    crack: inFloor('crack'),
  });
  void ALL;
})(window.RPG);
