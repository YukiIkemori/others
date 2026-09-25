// Local-map tiles (towns, castles, dungeons): ground tiles, nature, furniture
// and other objects, houses. Objects are painted on a floor: the generic
// 'tile:<id>' uses the floor where the object usually stands (furniture on
// planks, signs and wells on grass …); 'tile:<theme>:<id>' variants put
// indoor/dungeon objects on that theme's floor. R.Art.objectArt(id, floorBuf,
// ctx) is shared with the context tiler (tiles_auto.js).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;

  const CLAY = [0x3c200e, 0x6c3c1c, 0x9c5c2c, 0xc47e42, 0xe2a462, 0xf6cc90];
  const INK = 0x1a1410;

  // ------------------------------------------------------------ grounds
  const GROUND = {
    lgrass(t) {
      const G = t.PAL.tgrass, b = t.tile(G[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = t.fnoise(x, y, 8, 16, 71);
        if (v < 0.3 && (x * 3 + y) % 4 === 0) b.set(x, y, G[2]);
        else if (v > 0.68 && (x + y * 3) % 5 === 0) b.set(x, y, G[4]);
      }
      for (const [x, y] of [[2, 3], [9, 1], [12, 9], [5, 10], [1, 14]]) {
        b.wset(x, y + 1, G[1]); b.wset(x + 1, y, G[2]); b.wset(x + 2, y + 1, G[1]); b.wset(x + 1, y + 1, G[1]); b.wset(x + 2, y, G[5]);
      }
      return b;
    },
    dirt(t) {
      const D = [0x5c4028, 0x806040, 0xa07c54, 0xb89468, 0xd0ae80];
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 73), h = t.hash(x, y, 75);
        if (h < 0.05) return D[1];
        if (h > 0.97) return D[4];
        return v < 0.3 && (x * 3 + y * 5) % 7 === 0 ? D[1] : v > 0.7 && (x + y * 3) % 7 === 0 ? D[3] : D[2];
      });
      for (const [x, y] of [[4, 4], [12, 11], [9, 2]]) { b.wset(x, y, D[4]); b.wset(x + 1, y, D[3]); b.wset(x, y + 1, D[1]); b.wset(x + 1, y + 1, D[0]); }
      return b;
    },
    wood(t) { return A.themeArt('house').floor.clone(); },
    carpet(t) {
      const Rd = t.PAL.red, b = t.tile(Rd[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const u = (x + y) % 8, v = (x - y + 16) % 8;
        if (u === 0 || v === 0) b.set(x, y, Rd[2]);
        if ((x % 8 === 4 && y % 8 === 0) || (x % 8 === 0 && y % 8 === 4)) b.set(x, y, 0xe8b440);
      }
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 79) < 0.05 && b.get(x, y) === Rd[3]) b.set(x, y, Rd[4]);
      return b;
    },
    sand(t) {
      const S = t.PAL.sand;
      return t.tex(16, 16, (x, y) => {
        const h = t.hash(x, y, 81), v = t.fnoise(x, y, 8, 16, 83);
        if (h < 0.07) return S[2];
        if (h > 0.95) return S[4];
        return v < 0.3 && (x + 2 * y) % 3 === 0 ? S[2] : S[3];
      });
    },
    snowfloor(t) {
      const S = t.PAL.snow;
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 85);
        if (v < 0.28 && (x + y) % 2 === 0) return S[2];
        if (v > 0.72 && (x + y) % 2 === 1) return S[4];
        return S[3];
      });
      // glints with a hint of blue shadow below
      for (const [x, y] of [[2, 3], [11, 1], [7, 8], [14, 10], [4, 13], [9, 14]]) { b.wset(x, y, S[4]); b.wset(x + 1, y + 1, S[2]); }
      return b;
    },
    ice(t) {
      const I = [0x6890c0, 0x8cb4dc, 0xacd0ec, 0xc8e4f6, 0xecfaff];
      return t.tex(16, 16, (x, y) => {
        const d = (x + y) % 16, d2 = (x + y + 7) % 16;
        if (d === 0 || d === 1) return I[4];
        if (d2 === 0) return I[3];
        if (t.hash(x, y, 87) < 0.04) return I[1];
        const v = t.fnoise(x, y, 8, 16, 89);
        return v < 0.35 ? I[1] : v > 0.7 ? I[3] : I[2];
      });
    },
    /** v (0..3) rotates the flower colours and mirrors the spots (variety in flower fields) */
    flowers(t, v) {
      v = v || 0;
      const b = GROUND.lgrass(t), G = t.PAL.tgrass;
      const cols = [[0xf04848, 0xa01818], [0xf8e040, 0xb08810], [0xffffff, 0xa0a8c0], [0xf890d0, 0xb04880]];
      let spots = [[3, 3, 0], [11, 2, 1], [7, 7, 2], [14, 9, 3], [2, 11, 1], [9, 13, 0], [5, 15, 3]];
      if (v & 1) spots = spots.map(([x, y, k]) => [15 - x, y, k]);
      if (v & 2) spots = spots.map(([x, y, k]) => [x, (y + 8) & 15, k]);
      for (const [x, y, k0] of spots) {
        const k = (k0 + v) % 4;
        const [c1, c2] = cols[k];
        b.wset(x, y + 1, G[1]); b.wset(x - 1, y + 1, G[2]); b.wset(x + 1, y + 1, G[1]);
        b.wset(x, y, c1); b.wset(x - 1, y, c2); b.wset(x + 1, y, c2); b.wset(x, y - 1, c2);
        b.wset(x, y, k === 2 ? 0xf8e040 : c1);
      }
      return b;
    },
    stone(t) { return A.themeArt('generic').floor.clone(); },
    void(t) { return t.tile(0x000000); },
  };
  const WATER_R = [0x0c2468, 0x16389a, 0x2250b8, 0x3470d0, 0x68a0e8, 0xb0d4fc];
  function water(t, f) {
    const b = t.tile(WATER_R[2]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.fnoise(x, y * 2, 8, 16, 91);
      if (v < 0.32 && y % 2) b.set(x, y, WATER_R[1]);
    }
    const rip = [[2, 3, 0], [10, 5, 1], [5, 10, 2], [12, 13, 3]];
    for (const [x, y, ph] of rip) {
      const s = (f + ph) % 4;
      const o = s === 2 ? 1 : 0;
      b.wset(x + o, y + 1, WATER_R[1]); b.wset(x + 1 + o, y + 1, WATER_R[1]); b.wset(x + 2 + o, y + 1, WATER_R[1]);
      if (s !== 3) { b.wset(x + o, y, WATER_R[3]); b.wset(x + 1 + o, y, s === 1 ? WATER_R[5] : WATER_R[4]); b.wset(x + 2 + o, y, WATER_R[3]); }
    }
    return b;
  }
  const LAVA_PTS = [[3, 3], [11, 2], [7, 8], [14, 10], [2, 12], [9, 14]];
  function lava(t, f) {
    const M = t.PAL.magma;
    // molten cells: glowing yellow seams, orange bodies darkening toward the centre
    return t.tex(16, 16, (x, y) => {
      let a = 1e9, b = 1e9;
      for (const [px, py] of LAVA_PTS) for (let oy = -16; oy <= 16; oy += 16) for (let ox = -16; ox <= 16; ox += 16) {
        const d = Math.hypot(x + 0.5 - px - ox, y + 0.5 - py - oy);
        if (d < a) { b = a; a = d; } else if (d < b) b = d;
      }
      const e = b - a;
      const glow = f ? 0.4 : 0;
      if (e < 0.9) return M[5];
      if (e < 1.9 + glow) return M[4];
      if (a < 1.6 + glow) return M[1];
      return a < 3.2 ? M[2] : M[3];
    });
  }
  function poison(t, f) {
    const P = [0x281030, 0x44205a, 0x642c80, 0x8444a4, 0xb070d0, 0xdcacf0];
    const b = t.tex(16, 16, (x, y) => {
      const v = t.fnoise(x, y, 8, 16, 97);
      return v < 0.34 ? P[1] : v > 0.7 ? P[3] : P[2];
    });
    const bubbles = f ? [[4, 4, 1], [12, 11, 0], [9, 3, 0]] : [[4, 5, 0], [12, 10, 1], [7, 13, 1]];
    for (const [x, y, big] of bubbles) {
      if (big) { b.wset(x, y - 1, P[4]); b.wset(x - 1, y, P[4]); b.wset(x + 1, y, P[3]); b.wset(x, y + 1, P[2]); b.wset(x, y, P[5]); }
      else { b.wset(x, y, P[4]); b.wset(x + 1, y, P[3]); }
    }
    return b;
  }
  A.groundArt = function (name, f) {
    const t = tk();
    if (name === 'water') return water(t, f || 0);
    if (name === 'lava') return lava(t, f || 0);
    if (name === 'poison') return poison(t, f || 0);
    const g = GROUND[name] || GROUND.stone;
    return g(t);
  };
  // cache of plain ground Bufs (read-only; always clone before drawing on them)
  const GCACHE = {};
  function ground(name) { return GCACHE[name] || (GCACHE[name] = A.groundArt(name)); }
  /** floor Buf by name: a ground name or 'theme:<theme>' */
  A.floorBuf = function (name) {
    if (name && name.startsWith('theme:')) return A.themeArt(name.slice(6)).floor;
    return ground(name || 'stone');
  };

  // ------------------------------------------------------------ objects
  // Each painter: (floor Buf (cloned), ctx) → Buf. ctx carries context flags from
  // the tiler ({l,r,u,d} = same object on that side) and the frame for anims.
  const OBJ = {};

  OBJ.pot = (fl) => tk().stamp(fl, (L) => {
    const t = tk();
    L.shadeEllipse(8, 10, 5.5, 4.8, CLAY.slice(1), { dither: 0.6 });
    L.rect(5, 3, 6, 3, CLAY[3]); L.vline(5, 3, 5, CLAY[4]); L.vline(10, 3, 5, CLAY[2]);
    L.ellipse(8, 3, 3.4, 1.3, CLAY[4]);
    L.ellipse(8, 3, 2, 0.6, 0x1c0c04);
    for (let x = 3; x < 14; x++) if (L.get(x, 9) !== t.NONE) L.set(x, 9, x < 8 ? CLAY[2] : CLAY[1]);
    L.set(5, 8, CLAY[5]); L.set(4, 10, CLAY[4]);
  });
  OBJ.barrel = (fl) => tk().stamp(fl, (L) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    const ramp = [W[1], W[2], W[3], W[4], W[4], W[3], W[2], W[1], W[0]];
    for (let y = 3; y < 15; y++) {
      const bulge = y > 5 && y < 13 ? 1 : 0;
      for (let x = 3 - bulge; x <= 12 + bulge; x++) {
        const u = (x - 3 + bulge) / (10 + bulge * 2);
        L.set(x, y, ramp[Math.min(8, Math.floor(u * 9))]);
        if ((x - 3) % 3 === 2 && y > 3) L.set(x, y, t.mul(L.get(x, y), 0.85));
      }
    }
    for (const y of [5, 11]) for (let x = 2; x <= 13; x++) if (L.get(x, y) !== t.NONE) L.set(x, y, x < 7 ? 0x8c8c9c : x < 10 ? 0x5c5c6c : 0x3c3c48);
    L.ellipse(7.5, 3, 4.6, 1.5, W[4]); L.ellipse(7.5, 3, 3.2, 0.8, W[3]);
    L.hline(5, 10, 3, W[2]);
  });
  OBJ.crate = (fl) => tk().stamp(fl, (L) => {
    const W = A.themeArt('house').WOOD;
    L.rect(2, 3, 12, 4, W[4]); L.hline(2, 13, 3, W[5]); L.hline(2, 13, 5, W[3]);
    L.rect(2, 7, 12, 8, W[3]);
    L.rect(2, 7, 12, 1, W[1]);
    L.vline(2, 7, 14, W[4]); L.vline(13, 7, 14, W[1]);
    L.hline(2, 13, 14, W[1]);
    L.line(3, 8, 12, 13, W[2]); L.line(3, 9, 11, 13, W[2]);
    L.hline(3, 12, 10, W[1]);
  });
  OBJ.counter = (fl, ctx) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    ctx = ctx || {};
    const vertical = (ctx.u || ctx.d) && !(ctx.l || ctx.r);
    return t.stamp(fl, (L) => {
      if (vertical) {
        const x0 = ctx.l ? 0 : 2, x1 = ctx.r ? 15 : 13;
        const y0 = ctx.u ? 0 : 1, y1 = ctx.d ? 15 : 12;
        L.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, W[4]);
        L.vline(x0, y0, y1, W[5]); L.vline(x1, y0, y1, W[2]);
        for (let y = y0 + 2; y <= y1; y += 4) L.hline(x0 + 1, x1 - 1, y, W[3]);
        if (!ctx.d) { L.rect(x0, 13, x1 - x0 + 1, 3, W[2]); L.hline(x0, x1, 13, W[1]); L.hline(x0, x1, 15, W[0]); }
        return;
      }
      const x0 = ctx.l ? 0 : 1, x1 = ctx.r ? 15 : 14;
      L.rect(x0, 3, x1 - x0 + 1, 5, W[4]);
      L.hline(x0, x1, 3, W[5]); L.hline(x0, x1, 7, W[5]);
      for (let x = x0 + 3; x < x1; x += 7) L.set(x, 5, W[3]);
      L.rect(x0, 8, x1 - x0 + 1, 7, W[2]);
      L.hline(x0, x1, 8, W[1]);
      for (let x = x0; x <= x1; x++) if ((x + 1) % 5 === 0) L.vline(x, 9, 14, W[1]);
      for (let x = x0; x <= x1; x++) if ((x + 1) % 5 === 1) L.vline(x, 9, 14, W[3]);
      if (!ctx.l) L.vline(x0, 3, 14, W[3]);
      if (!ctx.r) L.vline(x1, 3, 14, W[1]);
    }, { sy: 1, sx: 0, outline: INK });
  };
  OBJ.table = (fl, ctx) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    ctx = ctx || {};
    return t.stamp(fl, (L) => {
      const x0 = ctx.l ? 0 : 1, x1 = ctx.r ? 15 : 14, y0 = ctx.u ? 0 : 2, y1 = ctx.d ? 15 : 10;
      L.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, W[4]);
      if (!ctx.u) L.hline(x0 + 1, x1 - 1, y0, W[5]);
      if (!ctx.l) L.vline(x0, y0 + 1, y1, W[5]);
      for (let y = y0 + 1; y < y1; y += 3) for (let x = x0 + 2; x < x1 - 1; x += 5) L.set(x + (y % 2), y, W[3]);
      if (!ctx.d) {
        L.rect(x0, 11, x1 - x0 + 1, 2, W[2]); L.hline(x0, x1, 12, W[1]);
        if (!ctx.l) L.rect(x0 + 1, 13, 2, 2, W[1]);
        if (!ctx.r) L.rect(x1 - 2, 13, 2, 2, W[1]);
      }
      if (!ctx.u && !ctx.l) L.set(x0, y0, null);
      if (!ctx.u && !ctx.r) L.set(x1, y0, null);
      // a small dish / candle on standalone tables
      if (!ctx.l && !ctx.r && !ctx.u && !ctx.d) {
        L.ellipse(8, 6, 2.5, 1.4, 0xf0f0f8); L.ellipse(8, 6, 1.3, 0.6, 0xc8c8d8); L.set(7, 5, 0xffffff);
      }
    }, { sy: 1, sx: 1 });
  };
  OBJ.chair = (fl) => tk().stamp(fl, (L) => {
    const W = A.themeArt('house').WOOD;
    L.rect(4, 2, 8, 6, W[3]); L.hline(4, 11, 2, W[5]); L.vline(4, 2, 7, W[4]);
    L.vline(6, 3, 7, W[2]); L.vline(9, 3, 7, W[2]);
    L.rect(3, 8, 10, 3, W[4]); L.hline(3, 12, 8, W[5]); L.hline(3, 12, 10, W[2]);
    L.rect(3, 11, 2, 4, W[2]); L.rect(11, 11, 2, 4, W[1]);
  });
  OBJ.bed = (fl, ctx) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    ctx = ctx || {};
    const B = [0x1c3070, 0x2c4c9c, 0x4270c4, 0x6c98e0, 0xa0c4f4];
    const head = !ctx.u, foot = !ctx.d;
    return t.stamp(fl, (L) => {
      const y0 = head ? 0 : 0, y1 = foot ? 14 : 15;
      L.rect(1, y0, 14, y1 - y0 + 1, B[2]);
      if (head) {
        L.rect(1, 0, 14, 3, W[3]); L.hline(1, 14, 0, W[5]); L.hline(1, 14, 2, W[1]);
        L.rect(3, 3, 10, 3, 0xf4f4fc); L.hline(3, 12, 5, 0xc0c4d4); L.set(3, 3, 0xd8dae4); L.set(12, 3, 0xd8dae4);
        L.hline(1, 14, 6, B[4]); L.hline(1, 14, 7, B[3]);
      }
      for (let y = head ? 8 : 0; y <= y1; y++) {
        L.set(1, y, B[3]); L.set(14, y, B[1]);
        if (y % 4 === 1) for (let x = 3; x < 13; x += 4) L.set(x, y, B[3]);
      }
      if (foot) { L.rect(1, 13, 14, 2, W[2]); L.hline(1, 14, 13, W[4]); }
    }, { sy: 1, sx: 1 });
  };
  function shelfFrame(L, W) {
    L.rect(0, 0, 16, 16, W[2]);
    L.hline(0, 15, 0, W[4]); L.vline(0, 0, 15, W[3]); L.vline(1, 1, 15, W[3]);
    L.vline(15, 0, 15, W[1]); L.vline(14, 1, 15, W[1]);
    L.hline(0, 15, 15, W[0]);
  }
  OBJ.bookshelf = (fl) => tk().stamp(fl, (L) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    shelfFrame(L, W);
    const BOOK = [0xb02828, 0x2c4ca0, 0x2c7a34, 0xc89830, 0x7c3c9c, 0x8c5a2c, 0xd0d0c0];
    for (const sy of [1, 6, 11]) {
      L.rect(2, sy, 12, 4, 0x2c1808);
      let x = 2, k = sy;
      while (x < 14) {
        const w = 1 + (t.hash(x, sy, 3) < 0.35 ? 1 : 0), col = BOOK[(k++ * 5 + x) % BOOK.length];
        const h = t.hash(x, sy, 5) < 0.3 ? 3 : 4;
        for (let i = 0; i < w && x + i < 14; i++) for (let y = sy + 4 - h; y < sy + 4; y++) L.set(x + i, y, i === 0 ? t.shade(col, 0.2) : col);
        L.set(x, sy + 4 - h + 1, t.shade(col, 0.5));
        x += w;
      }
      L.hline(2, 13, sy + 4, W[4]);
    }
  }, { shadow: false });
  OBJ.shelf = (fl) => tk().stamp(fl, (L) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    shelfFrame(L, W);
    for (const sy of [1, 6, 11]) { L.rect(2, sy, 12, 4, 0x2c1808); L.hline(2, 13, sy + 4, W[4]); }
    // bottles
    const bottle = (x, y, c) => { L.rect(x, y + 1, 2, 3, c); L.set(x, y, 0xd0c0a0); L.set(x, y + 1, t.shade(c, 0.5)); };
    bottle(3, 1, 0x3060d0); bottle(6, 1, 0xd03030); bottle(9, 1, 0x30a040); bottle(12, 1, 0x3060d0);
    // jars
    for (const x of [3, 8]) { L.rect(x, 7, 4, 3, CLAY[3]); L.hline(x, x + 3, 7, CLAY[4]); L.set(x + 3, 9, CLAY[2]); L.hline(x, x + 3, 6, CLAY[1]); }
    // sacks
    for (const x of [3, 8]) { L.ellipse(x + 1.5, 13.5, 2.2, 1.6, 0xc8b080); L.set(x + 1, 12, 0xe0cca0); L.set(x + 3, 14, 0x9c8458); }
    L.rect(13, 12, 1, 3, 0x9c8458);
  }, { shadow: false });
  OBJ.throne = (fl) => tk().stamp(fl, (L) => {
    const Gd = tk().PAL.gold, Rd = tk().PAL.red;
    // back
    L.rect(3, 1, 10, 9, Gd[3]); L.rect(4, 2, 8, 7, Rd[3]); L.vline(4, 2, 8, Rd[4]); L.vline(11, 2, 8, Rd[2]);
    L.set(7, 0, Gd[4]); L.set(8, 0, Gd[4]); L.set(3, 0, Gd[4]); L.set(12, 0, Gd[4]);
    L.set(7, 4, Gd[4]); L.set(8, 4, Gd[3]); L.set(7, 5, Gd[3]); L.set(8, 5, Gd[2]);
    // arms + seat
    L.rect(1, 8, 3, 6, Gd[3]); L.rect(12, 8, 3, 6, Gd[2]); L.hline(1, 3, 8, Gd[5]); L.hline(12, 14, 8, Gd[4]);
    L.rect(4, 10, 8, 3, Rd[4]); L.hline(4, 11, 12, Rd[2]);
    L.rect(4, 13, 8, 2, Gd[2]); L.hline(4, 11, 13, Gd[4]);
    L.vline(3, 1, 9, Gd[4]); L.vline(12, 1, 9, Gd[1]);
  });
  OBJ.altar = (fl) => tk().stamp(fl, (L) => {
    const S = [0x5c6070, 0x9094a4, 0xbcc0cc, 0xdcdee6, 0xfafaff];
    const Cl = [0x1c2c70, 0x2c4c9c, 0x4270c4];
    L.rect(1, 5, 14, 4, S[3]); L.hline(1, 14, 5, S[4]); L.hline(1, 14, 8, S[2]);
    L.rect(1, 9, 14, 6, S[2]); L.vline(1, 9, 14, S[3]); L.vline(14, 9, 14, S[1]); L.hline(1, 14, 14, S[1]);
    // cloth
    L.rect(4, 5, 8, 8, Cl[1]); L.vline(4, 5, 12, Cl[2]); L.vline(11, 5, 12, Cl[0]);
    L.hline(4, 11, 12, 0xe8b440); L.set(7, 9, 0xe8b440); L.set(8, 9, 0xe8b440); L.set(7, 8, 0xf8dc70); L.set(8, 10, 0xb08020);
    // candles
    for (const x of [2, 13]) { L.rect(x, 2, 1, 3, 0xf0ecd8); L.set(x, 1, 0xffc040); L.set(x, 0, 0xfff0a0); }
  });
  // stone goddess holding an orb, on a plinth
  const STATUE = [
    '.......bc.......',
    '......bbcc......',
    '......bacd......',
    '.......cd.......',
    '.....bbccdd.....',
    '....abbccddd....',
    '....bbaacddd....',
    '....bbaacdd.....',
    '....bbbccdd.....',
    '...abbbccddd....',
    '...abbccdcdd....',
    '..bbbbbbbbbbbc..',
    '..aaaaaaaaaaac..',
    '..bccccccccccd..',
    '..cccccccccccd..',
    '................',
  ];
  OBJ.statue = (fl) => tk().stamp(fl, (L) => {
    const S = { a: 0xdadce4, b: 0xb4b6c0, c: 0x8c8e98, d: 0x64666e, e: 0x3c3e48 };
    STATUE.forEach((row, y) => { for (let x = 0; x < 16; x++) if (S[row[x]]) L.set(x, y, S[row[x]]); });
    L.set(6, 6, 0xf4f6fc); L.vline(8, 8, 10, 0x8c8e98);
  }, { outline: 0x24242c, sx: 2, sy: 1 });
  OBJ.sign = (fl) => tk().stamp(fl, (L) => {
    const W = A.themeArt('house').WOOD;
    L.rect(7, 9, 2, 6, W[2]); L.set(7, 9, W[3]);
    L.rect(2, 2, 12, 7, W[4]); L.hline(2, 13, 2, W[5]); L.vline(2, 2, 8, W[5]); L.hline(2, 13, 8, W[2]); L.vline(13, 2, 8, W[2]);
    L.hline(4, 11, 4, W[1]); L.hline(4, 9, 6, W[1]);
  });
  OBJ.well = (fl) => tk().stamp(fl, (L) => {
    const S = [0x3c3e48, 0x64666e, 0x8c8e98, 0xb4b6c0, 0xdadce4], W = A.themeArt('house').WOOD;
    // winch frame, rope and bucket
    L.rect(2, 1, 2, 9, W[3]); L.vline(2, 1, 9, W[4]);
    L.rect(12, 1, 2, 9, W[2]); L.vline(13, 1, 9, W[1]);
    L.rect(1, 1, 14, 2, W[3]); L.hline(1, 14, 1, W[5]); L.hline(1, 14, 2, W[2]);
    L.vline(8, 3, 5, 0x9c8458);
    L.rect(7, 6, 3, 2, W[3]); L.hline(7, 9, 6, W[4]); L.set(9, 7, W[1]);
    // stone ring and dark water
    L.ellipse(8, 11.5, 6.5, 4, S[2]);
    for (let y = 7; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (L.get(x, y) !== S[2]) continue;
      const brick = ((x + (y % 2) * 2) >> 1) % 2;
      L.set(x, y, y < 11 ? (brick ? S[4] : S[3]) : brick ? S[2] : S[1]);
    }
    L.ellipse(8, 10.5, 4.4, 1.8, 0x0c1830); L.hline(6, 9, 10, 0x2c4c8c); L.set(10, 11, 0x1c3060);
  }, { sx: 1, sy: 1 });
  OBJ.grave = (fl) => tk().stamp(fl, (L) => {
    const S = [0x3c3e48, 0x64666e, 0x8c8e98, 0xb4b6c0, 0xdadce4];
    L.ellipse(8, 14, 6, 2, 0x6c5438);
    L.rect(4, 5, 8, 9, S[2]); L.ellipse(8, 5, 4, 3, S[2]);
    L.each((x, y, c) => (c === S[2] ? (x < 6 ? S[3] : x > 10 ? S[1] : S[2]) : c));
    L.vline(8, 5, 10, S[1]); L.hline(6, 10, 7, S[1]); L.set(7, 5, S[4]); L.set(5, 4, S[4]);
    L.hline(4, 11, 13, S[1]);
  });
  OBJ.pedestal = (fl) => tk().stamp(fl, (L) => {
    const S = [0x5c6070, 0x9094a4, 0xbcc0cc, 0xdcdee6, 0xfafaff];
    L.rect(3, 3, 10, 4, S[3]); L.hline(3, 12, 3, S[4]); L.hline(3, 12, 6, S[2]);
    L.rect(4, 7, 8, 6, S[2]); L.vline(4, 7, 12, S[3]); L.vline(11, 7, 12, S[1]);
    L.rect(2, 13, 12, 2, S[2]); L.hline(2, 13, 13, S[3]); L.hline(2, 13, 14, S[1]);
    L.set(7, 9, 0x4c78c8); L.set(8, 9, 0x4c78c8); L.set(7, 10, 0x2c4c9c); L.set(8, 10, 0x2c4c9c);
  });
  OBJ.warp_pad = (fl, ctx) => {
    const t = tk(), f = (ctx && ctx.f) || 0, b = fl.clone();
    const pulse = [0, 1, 2, 1][f % 4];
    const C = [[0x1c3c8c, 0x3c7ce0, 0x8cc8ff], [0x2448a0, 0x4c90f0, 0xb0e0ff], [0x3060c0, 0x68b0ff, 0xe8f8ff]][pulse];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = (y - 7.5) * 1.15, r = Math.sqrt(dx * dx + dy * dy);
      if (r > 7.6) continue;
      if (r > 6.6) b.set(x, y, C[1]);
      else if (r > 5.8) b.set(x, y, t.mix(b.get(x, y), 0x102050, 0.6));
      else if (r > 4.8) b.set(x, y, (Math.round(Math.atan2(dy, dx) * 4) + f) % 2 ? C[0] : C[1]);
      else if (r > 3.8) b.set(x, y, C[1]);
      else if (r > 2.0) b.set(x, y, t.mix(b.get(x, y), 0x102050, 0.5));
      else b.set(x, y, C[2]);
    }
    for (const [x, y] of [[7, 1], [8, 1], [1, 7], [14, 8], [7, 14], [8, 14]]) b.set(x, y, C[2]);
    return b;
  };
  OBJ.seal = (fl, ctx) => {
    const t = tk(), f = (ctx && ctx.f) || 0, b = fl.clone();
    const C = f ? [0x6c2ca0, 0xb060e8, 0xf0c8ff] : [0x5c2490, 0x9848d8, 0xe0a8ff];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const u = (x + y + f) % 6, v = (x - y + 16 + f) % 6;
      if (u === 0 || v === 0) b.set(x, y, C[1]);
      else b.set(x, y, t.mix(b.get(x, y), C[0], 0.55));
    }
    // central rune
    for (const [x, y] of [[7, 4], [8, 4], [6, 5], [9, 5], [5, 7], [10, 7], [7, 7], [8, 8], [6, 10], [9, 10], [7, 11], [8, 11], [7, 9]]) b.set(x, y, C[2]);
    b.hline(0, 15, 0, C[2]); b.hline(0, 15, 15, C[0]);
    return b;
  };
  OBJ.pit = (fl) => {
    const b = fl.clone();
    for (let y = 2; y < 15; y++) for (let x = 1; x < 15; x++) {
      const dx = (x - 7.5) / 6.8, dy = (y - 8.5) / 6.2;
      if (dx * dx + dy * dy <= 1) b.set(x, y, y < 5 ? 0x000000 : y < 9 ? 0x08080c : 0x141418);
    }
    for (let x = 2; x < 14; x++) { const y = Math.round(8.5 + 6.2 * Math.sqrt(Math.max(0, 1 - ((x - 7.5) / 6.8) ** 2))); b.set(x, y, 0x3a3634); }
    for (let x = 3; x < 13; x++) { const y = Math.round(8.5 - 6.2 * Math.sqrt(Math.max(0, 1 - ((x - 7.5) / 6.8) ** 2))); b.set(x, y + 1, 0x000000); }
    return b;
  };
  OBJ.tree = (fl, ctx) => {
    const t = tk(), F = t.PAL.leaf, tr = t.PAL.trunk;
    ctx = ctx || {};
    return t.stamp(fl, (L) => {
      L.rect(7, 11, 3, 5, tr[1]); L.vline(7, 11, 15, tr[2]); L.set(9, 15, tr[0]);
      const ramp = [F[0], F[1], F[2], F[3], F[4]];
      L.shadeEllipse(8, 7, 6.8, 6, ramp, { dither: 0.7, amb: 0.25 });
      L.shadeEllipse(5, 5, 3.4, 3, ramp, { dither: 0.7, amb: 0.5 });
      L.shadeEllipse(10.5, 4.2, 3.2, 2.8, ramp, { dither: 0.7, amb: 0.5 });
      for (const [x, y, k] of [[4, 3, 4], [5, 4, 4], [9, 2, 4], [3, 7, 3], [11, 10, 0], [8, 11, 0], [13, 7, 0]]) L.set(x, y, F[k]);
    }, { outline: 0x0c2410, sx: 2, sy: 1 });
  };
  // Rail fence: one post per cell, rails toward every fence neighbour (runs,
  // corners, T-joins); drawn over whatever ground the cell stands on.
  OBJ.fence = (fl, ctx) => {
    const t = tk(), W = A.themeArt('house').WOOD;
    ctx = ctx || {};
    return t.stamp(fl, (L) => {
      const railH = (x0, x1) => {
        for (const y of [6, 10]) { L.hline(x0, x1, y, W[4]); L.hline(x0, x1, y + 1, W[2]); }
        for (let x = x0; x <= x1; x++) if (x % 5 === 2) { L.set(x, 6, W[5]); L.set(x, 10, W[5]); }
      };
      const railV = (y0, y1) => { L.vline(7, y0, y1, W[4]); L.vline(8, y0, y1, W[2]); for (let y = y0; y <= y1; y++) if (y % 5 === 1) L.set(7, y, W[5]); };
      if (ctx.l) railH(0, 5);
      if (ctx.r) railH(9, 15);
      if (ctx.u) railV(0, 3);
      if (ctx.d) railV(13, 15);
      // post with a lit cap
      const top = ctx.u && !ctx.l && !ctx.r ? 4 : 3;
      L.rect(6, top, 3, 14 - top, W[3]);
      L.vline(6, top, 13, W[4]); L.vline(8, top, 13, W[1]);
      L.hline(6, 8, top, W[5]); L.set(7, top + 1, W[4]);
      L.set(6, 13, W[2]); L.hline(7, 8, 13, W[0]);
    }, { sx: 1, sy: 1 });
  };
  function bridge(dir) {
    return (fl, ctx) => {
      const t = tk(), W = A.themeArt('house').WOOD;
      const f = (ctx && ctx.f) || 0;
      const b = ctx && ctx.water ? ctx.water.clone() : water(t, f);
      if (dir === 'h') {
        b.tint(0, 13, 16, 2, 0.7);
        b.rect(0, 3, 16, 10, W[3]);
        for (let x = 0; x < 16; x += 4) { b.vline(x, 3, 12, W[2]); b.set(x + 1, 4, W[4]); }
        b.hline(0, 15, 2, W[5]); b.hline(0, 15, 3, W[4]); b.hline(0, 15, 12, W[1]); b.hline(0, 15, 13, W[0]);
        for (const x of [2, 10]) { b.rect(x, 0, 2, 3, W[2]); b.set(x, 0, W[4]); }
      } else {
        b.tint(13, 0, 2, 16, 0.7);
        b.rect(3, 0, 10, 16, W[3]);
        for (let y = 0; y < 16; y += 4) { b.hline(3, 12, y, W[2]); b.set(4, y + 1, W[4]); }
        b.vline(2, 0, 15, W[5]); b.vline(3, 0, 15, W[4]); b.vline(12, 0, 15, W[1]); b.vline(13, 0, 15, W[0]);
      }
      return b;
    };
  }
  OBJ.lbridge_h = bridge('h');
  OBJ.lbridge_v = bridge('v');

  // ---------------------------------------------------- houses (exterior)
  const PLASTER = [0x6c5838, 0xb09c78, 0xdccca8, 0xf2e6c8, 0xfff8e4];
  /** o: {window, eave (roof above), capTop, top (wall seen from above)} */
  function housewall(o) {
    const t = tk(), W = A.themeArt('house').WOOD;
    o = o || {};
    const b = t.tile(PLASTER[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 101) < 0.07) b.set(x, y, PLASTER[2]);
    if (o.top) {
      // a house wall seen from above: plaster core between timber sills
      const b2 = t.tile(PLASTER[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 103) < 0.08) b2.set(x, y, PLASTER[2]);
      for (let y = 0; y < 16; y++) { b2.set(0, y, W[1]); b2.set(1, y, W[3]); b2.set(14, y, W[2]); b2.set(15, y, W[1]); }
      for (let y = 3; y < 16; y += 8) b2.hline(2, 13, y, PLASTER[1]);
      const e = o.edges || {};
      if (e.w) b2.vline(0, 0, 15, W[0]);
      if (e.e) b2.vline(15, 0, 15, W[0]);
      if (e.n) { b2.hline(0, 15, 0, W[0]); b2.hline(1, 14, 1, W[3]); }
      return b2;
    }
    // timber frame: top beam, sill, posts
    b.hline(0, 15, 0, W[1]); b.hline(0, 15, 1, W[3]);
    b.rect(0, 13, 16, 3, W[3]); b.hline(0, 15, 13, W[4]); b.hline(0, 15, 15, W[1]);
    b.vline(0, 2, 12, W[3]); b.vline(15, 2, 12, W[2]);
    if (o.window) {
      b.rect(4, 4, 8, 7, W[1]);
      b.rect(5, 5, 6, 5, 0x2c3c6c); b.rect(5, 5, 3, 2, 0x5878b0); b.set(5, 5, 0x9cb4e0);
      b.vline(8, 5, 9, W[2]); b.hline(5, 7, 7, W[2]); b.hline(8, 10, 7, W[2]);
      b.hline(3, 12, 11, W[4]); b.hline(3, 12, 12, W[2]);
    } else if (!o.plain) {
      b.line(1, 12, 7, 2, W[2]); b.line(14, 12, 8, 2, W[2]);
    }
    if (o.eave) { b.hline(0, 15, 0, 0x2c1c14); b.hline(0, 15, 1, t.mul(W[3], 0.6)); for (let x = 0; x < 16; x++) b.set(x, 2, t.mul(b.get(x, 2), 0.72)); }
    else if (o.capTop) { b.hline(0, 15, 0, W[0]); }
    return b;
  }
  const ROOF = [0x3c0c0c, 0x6c1c14, 0x982c1c, 0xc0442a, 0xe06a44, 0xf49870];
  /** o: {ridge, eave, l, r, chimney} edge flags */
  function roof(o) {
    const t = tk();
    o = o || {};
    const R_ = ROOF;
    const b = t.tile();
    // barrel tiles in aligned columns; each course overlaps the one below
    for (let y = 0; y < 16; y++) {
      const ry = y % 4;
      for (let x = 0; x < 16; x++) {
        const bx = x % 4;
        let col = bx === 0 ? R_[4] : bx === 3 ? R_[2] : R_[3];
        if (ry === 3) col = bx === 0 ? R_[2] : R_[1];
        else if (ry === 0) col = bx === 3 ? R_[3] : R_[4];
        if (ry === 0 && bx === 0) col = R_[5];
        b.p[y * 16 + x] = col;
      }
    }
    if (o.ridge) { b.rect(0, 0, 16, 3, R_[2]); b.hline(0, 15, 0, R_[0]); b.hline(0, 15, 1, R_[4]); b.hline(0, 15, 3, R_[0]); for (let x = 1; x < 16; x += 4) b.set(x, 1, R_[5]); }
    if (o.eave) { b.hline(0, 15, 14, R_[3]); b.hline(0, 15, 15, R_[0]); for (let x = 0; x < 16; x += 4) b.set(x, 14, R_[5]); }
    if (o.l) { b.vline(0, 0, 15, R_[0]); b.vline(1, 0, 15, R_[4]); }
    if (o.r) { b.vline(15, 0, 15, R_[0]); b.vline(14, 0, 15, R_[1]); }
    if (o.chimney) {
      const B = [0x3c2a24, 0x6c4c40, 0x9a6c58, 0xbc8c74];
      b.rect(9, 0, 5, 7, B[2]); b.vline(9, 0, 6, B[3]); b.vline(13, 0, 6, B[1]);
      for (let y = 2; y < 7; y += 2) b.hline(10, 12, y, B[1]);
      b.rect(9, 0, 5, 2, B[3]); b.rect(10, 0, 3, 1, 0x1c1410);
      b.hline(9, 13, 7, R_[0]);
    }
    return b;
  }
  A.houseWallArt = housewall;
  A.roofArt = roof;

  // ------------------------------------------------------ exterior grounds
  // Outdoor ground with life in it (installed as a wrapper around the context
  // tiler R.Art.localTile, see the end of this file):
  //  * variety by position hash — grass tufts, tiny flowers, pebbles, clover;
  //    dirt pebbles, puddles, damp patches, footprints; cobble cracks, moss,
  //    worn stones, puddles, a missing stone; sand ripples, snow drifts …
  //  * edges — cobbled plazas get a kerb of long stones where they meet grass
  //    and crumble into dirt paths; grass overhangs dirt / sand / snow with a
  //    ragged fringe that runs continuously along the edge (world coordinates)
  //  * soft shadows under tall neighbours (walls, houses, trees), as elsewhere
  //  * water beside outdoor ground: canals with stone coping and a wall face
  //    (cobbles, paths, buildings) or earthen banks with a grass lip (lawns)
  //  * fences and bridges drawn over that ground / canal water
  const XT = {
    TALL: { wall: 1, wall_torch: 1, door: 1, door_silver: 1, door_gold: 1, housewall: 1, roof: 1, bookshelf: 1, shelf: 1, pillar: 1, statue: 1, tree: 1 },
    GROUND: { floor: 1, lgrass: 1, dirt: 1, wood: 1, carpet: 1, sand: 1, snowfloor: 1, ice: 1, flowers: 1 },
    WATERISH: { water: 1, lbridge_h: 1, lbridge_v: 1 },
  };
  const COB = [0x4a463e, 0x7c7666, 0x9e9784, 0xb8b19c, 0xd4cdb8]; // town floor ramp (tiles_theme 'town')
  const DIRT = [0x5c4028, 0x806040, 0xa07c54, 0xb89468, 0xd0ae80];
  const MOSS = [0x3c5a24, 0x557a2e, 0x6e963a];
  const PUDDLE = [0x2c3850, 0x4a5c7c, 0x6c84a8, 0xa4bcd8, 0xdce8f4];
  /** ground kind of a tile id: grass | dirt | cobble | sand | snow | water | floor | other */
  function kindOf(id, theme) {
    if (id === 'lgrass' || id === 'flowers') return 'grass';
    if (id === 'dirt') return 'dirt';
    if (id === 'floor') return theme === 'town' ? 'cobble' : 'floor';
    if (id === 'sand') return 'sand';
    if (id === 'snowfloor') return 'snow';
    if (XT.WATERISH[id]) return 'water';
    return 'other';
  }
  const EXT_KIND = { grass: 1, dirt: 1, cobble: 1, sand: 1, snow: 1 };
  /** weighted variant pick from a position hash; table [[weight, id], ...] (first entry = plain) */
  function pickVar(x, y, seed, table) {
    const h = tk().hash(x, y, seed);
    let acc = 0;
    for (const [w, v] of table) { acc += w; if (h < acc) return v; }
    return table[0][1];
  }
  const VAR = {
    grass: [[0.62, 0], [0.08, 1], [0.07, 2], [0.07, 3], [0.06, 4], [0.06, 5], [0.02, 6], [0.02, 7]],
    dirt: [[0.6, 0], [0.1, 1], [0.08, 2], [0.04, 3], [0.07, 4], [0.06, 5], [0.05, 6]],
    cobble: [[0.7, 0], [0.07, 1], [0.05, 2], [0.07, 3], [0.06, 4], [0.02, 5], [0.02, 6], [0.01, 7]],
    sand: [[0.66, 0], [0.12, 1], [0.08, 2], [0.07, 3], [0.07, 4]],
    snow: [[0.66, 0], [0.1, 1], [0.1, 2], [0.07, 3], [0.07, 4]],
  };
  // --- detail painters (16x16 Buf, variant v) ------------------------------
  function tuft(b, x, y, G) {
    b.set(x, y, G[5]); b.set(x + 2, y, G[5]);
    b.set(x - 1, y + 1, G[4]); b.set(x, y + 1, G[4]); b.set(x + 2, y + 1, G[4]); b.set(x + 1, y + 1, G[3]);
    b.set(x - 1, y + 2, G[2]); b.set(x, y + 2, G[4]); b.set(x + 1, y + 2, G[4]); b.set(x + 2, y + 2, G[4]); b.set(x + 3, y + 2, G[2]);
    b.set(x, y + 3, G[1]); b.set(x + 1, y + 3, G[1]); b.set(x + 2, y + 3, G[1]);
  }
  function pebble(b, x, y, big) {
    const S = [0x5c5850, 0x8c887c, 0xb8b4a6, 0xe0dccc];
    if (big) { b.set(x, y, S[3]); b.set(x + 1, y, S[2]); b.set(x, y + 1, S[2]); b.set(x + 1, y + 1, S[1]); b.set(x + 2, y + 1, S[0]); b.set(x + 1, y + 2, S[0]); }
    else { b.set(x, y, S[3]); b.set(x + 1, y, S[1]); b.set(x, y + 1, S[0]); }
  }
  function puddle(b, cx, cy, rx, ry, rim) {
    const t = tk();
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const e = ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2;
      if (e > 1.35) continue;
      if (e > 1) { if (rim != null) b.set(x, y, t.mix(b.get(x, y), rim, 0.45)); continue; }
      const top = y < cy - ry * 0.35;
      b.set(x, y, top ? PUDDLE[1] : e > 0.6 ? PUDDLE[2] : PUDDLE[2]);
    }
    b.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.1), PUDDLE[4]);
    b.set(Math.round(cx - rx * 0.4) + 1, Math.round(cy - ry * 0.1), PUDDLE[3]);
    b.set(Math.round(cx + rx * 0.3), Math.round(cy + ry * 0.4), PUDDLE[3]);
  }
  /** apply fn to pixels inside an ellipse (blob) */
  function blob(b, cx, cy, rx, ry, fn) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (e <= 1) { const r = fn(x, y, b.get(x, y), e); if (r != null) b.set(x, y, r); }
    }
  }
  function grassDetail(b, v) {
    const t = tk(), G = t.PAL.tgrass;
    if (v === 1) { tuft(b, 5, 6, G); tuft(b, 10, 10, G); }
    else if (v === 2) { tuft(b, 9, 4, G); b.set(4, 11, G[5]); b.set(3, 12, G[4]); b.set(5, 12, G[4]); b.set(4, 12, G[2]); }
    else if (v === 3) { // tiny white & yellow flowers
      for (const [x, y, c] of [[4, 5, 0xfcfcf0], [10, 8, 0xf8e048], [6, 11, 0xfcfcf0], [12, 13, 0xfcfcf0]]) { b.set(x, y, c); b.set(x, y + 1, G[1]); b.set(x + 1, y + 1, G[2]); }
    } else if (v === 4) { pebble(b, 5, 8, true); pebble(b, 11, 11, false); }
    else if (v === 5) { // clover patch
      blob(b, 8, 8.5, 4.2, 3.2, (x, y, c, e) => (e > 0.7 && (x + y) % 2 ? undefined : G[2]));
      for (const [x, y] of [[6, 7], [9, 7], [8, 9], [10, 10], [5, 9]]) { b.set(x, y, G[4]); b.set(x + 1, y, G[3]); }
    } else if (v === 6) { // a little mushroom
      b.set(9, 8, 0xd83828); b.set(10, 8, 0xd83828); b.set(8, 9, 0xb02018); b.set(9, 9, 0xd83828); b.set(10, 9, 0xd83828); b.set(11, 9, 0x8c1810);
      b.set(9, 8, 0xfff0e0); b.set(10, 10, 0xf0e8d0); b.set(9, 10, 0xf0e8d0); b.set(11, 10, G[1]);
    } else if (v === 7) { // worn bare patch
      blob(b, 8, 9, 4, 2.6, (x, y, c, e) => (e > 0.72 && (x + y) % 2 ? undefined : e > 0.5 ? DIRT[3] : DIRT[2]));
      b.set(7, 9, DIRT[1]); b.set(10, 10, DIRT[4]);
    }
  }
  function dirtDetail(b, v) {
    const t = tk(), G = t.PAL.tgrass;
    if (v === 1) { pebble(b, 4, 5, true); pebble(b, 11, 9, false); pebble(b, 7, 12, false); }
    else if (v === 2) { blob(b, 8, 8, 5.5, 4, (x, y, c, e) => (e > 0.75 && (x + y) % 2 ? undefined : t.mul(c, 0.88))); }
    else if (v === 3) { puddle(b, 8, 9, 3.6, 1.7, DIRT[0]); }
    else if (v === 4) { tuft(b, 7, 7, G); }
    else if (v === 5) { // footprints
      for (const [x, y] of [[4, 3], [6, 6], [8, 9], [10, 12]]) { b.set(x, y, DIRT[1]); b.set(x, y + 1, DIRT[1]); b.set(x + 1, y + 1, DIRT[0]); }
    } else if (v === 6) { // scattered gravel
      for (const [x, y] of [[3, 9], [9, 4], [12, 12], [6, 13]]) pebble(b, x, y, false);
      b.set(10, 9, DIRT[4]); b.set(5, 6, DIRT[4]);
    }
  }
  function cobbleDetail(b, v) {
    const t = tk();
    if (v === 1) { // crack across a stone
      for (const [x, y] of [[5, 5], [6, 6], [6, 7], [7, 8], [8, 8], [9, 9], [9, 10]]) { b.set(x, y, COB[0]); b.set(x + 1, y, t.mul(b.get(x + 1, y), 1.12)); }
    } else if (v === 2) { // moss in the joints
      blob(b, 8, 8, 6, 5, (x, y, c) => (c === COB[0] ? MOSS[(x + y) % 3 === 0 ? 2 : 1] : undefined));
    } else if (v === 3) { // worn / polished stones
      blob(b, 8, 8, 6, 4.5, (x, y, c, e) => (c === COB[0] || (e > 0.7 && (x + y) % 2) ? undefined : t.mul(c, 1.07)));
    } else if (v === 4) { // dark stain
      blob(b, 7, 9, 4.5, 3, (x, y, c, e) => (e > 0.7 && (x + y) % 2 ? undefined : t.mul(c, 0.86)));
    } else if (v === 5) { puddle(b, 8, 8.5, 3.4, 1.6, COB[0]); }
    else if (v === 6) { // a missing stone
      blob(b, 8, 8, 3, 2.2, (x, y, c, e) => (e > 0.6 ? DIRT[1] : DIRT[2]));
      b.set(7, 7, DIRT[0]); pebble(b, 8, 8, false);
    } else if (v === 7) { // iron drain grate
      const I = [0x1c1c24, 0x3a3a48, 0x6a6a7c];
      b.rect(5, 6, 6, 4, I[0]);
      for (let x = 5; x <= 10; x++) b.set(x, 6, I[2]);
      for (const x of [6, 8, 10]) b.vline(x, 7, 9, I[1]);
      b.hline(5, 10, 10, COB[4]); b.vline(11, 6, 10, COB[1]);
    }
  }
  function sandDetail(b, v) {
    const t = tk(), S = t.PAL.sand;
    if (v === 1) { for (let x = 1; x < 15; x++) { const y = 6 + Math.round(Math.sin(x / 2.4) * 1.2); b.set(x, y, S[2]); b.set(x, y - 1, S[4]); const y2 = y + 6; if (x > 3 && x < 13) { b.set(x, y2, S[2]); b.set(x, y2 - 1, S[4]); } } }
    else if (v === 2) { pebble(b, 5, 9, true); b.set(11, 5, 0xfff4e4); b.set(12, 5, 0xe8a8a0); b.set(11, 6, 0xc88880); }
    else if (v === 3) { for (const [x, y] of [[6, 10], [8, 9], [9, 10], [10, 8], [7, 8]]) { b.set(x, y, 0xa0a048); b.set(x, y - 1, 0xc8c870); } b.hline(6, 10, 11, S[1]); }
    else if (v === 4) { blob(b, 8, 8, 5, 3.5, (x, y, c, e) => (e > 0.7 && (x + y) % 2 ? undefined : t.mul(c, 0.93))); }
  }
  function snowDetail(b, v) {
    const t = tk(), S = t.PAL.snow;
    if (v === 1) { for (const [x, y] of [[4, 3], [7, 6], [5, 9], [8, 12]]) { b.set(x, y, S[1]); b.set(x, y + 1, S[2]); b.set(x + 1, y, S[2]); } }
    else if (v === 2) { blob(b, 8, 9, 5, 2.8, (x, y, c, e) => (y < 9 ? S[4] : e > 0.6 ? S[2] : S[4])); b.hline(5, 11, 12, S[2]); }
    else if (v === 3) { for (const [x, y] of [[3, 4], [11, 6], [6, 11], [13, 13]]) { b.set(x, y, 0xffffff); b.set(x + 1, y + 1, S[2]); } }
    else if (v === 4) { const R_ = [0x3c3e48, 0x64666e, 0x8c8e98]; b.rect(6, 9, 5, 2, R_[1]); b.hline(6, 10, 9, R_[2]); b.set(10, 10, R_[0]); b.hline(6, 10, 8, S[4]); b.set(7, 7, S[4]); b.set(8, 8, S[3]); }
  }
  const DETAIL = { grass: grassDetail, dirt: dirtDetail, cobble: cobbleDetail, sand: sandDetail, snow: snowDetail };

  // --- edges ---------------------------------------------------------------
  /** ragged grass fringe along the given sides; noise in world coords runs on across tiles */
  function fringe(b, sides, gx, gy) {
    const t = tk(), G = t.PAL.tgrass;
    for (let i = 0; i < 16; i++) {
      if (sides.n) { const d = 1 + Math.round(t.vnoise(gx + i, 0, 3, 4096, 211) * 2.6); for (let k = 0; k < d; k++) b.set(i, k, k === d - 1 ? G[2] : G[3]); if (d === 3 && (gx + i) % 3 === 0) b.set(i, d, G[1]); }
      if (sides.s) { const d = 1 + Math.round(t.vnoise(gx + i, 0, 3, 4096, 213) * 1.8); for (let k = 0; k < d; k++) b.set(i, 15 - k, k === d - 1 ? G[4] : G[3]); }
      if (sides.w) { const d = 1 + Math.round(t.vnoise(0, gy + i, 3, 4096, 215) * 2.4); for (let k = 0; k < d; k++) b.set(k, i, k === d - 1 ? G[2] : G[3]); }
      if (sides.e) { const d = 1 + Math.round(t.vnoise(0, gy + i, 3, 4096, 217) * 2.4); for (let k = 0; k < d; k++) b.set(15 - k, i, k === d - 1 ? G[2] : G[3]); }
    }
    // inner corners (grass only diagonally)
    const corner = (x0, y0, sx, sy) => { b.set(x0, y0, G[3]); b.set(x0 + sx, y0, G[2]); b.set(x0, y0 + sy, G[2]); };
    if (sides.nw) corner(0, 0, 1, 1);
    if (sides.ne) corner(15, 0, -1, 1);
    if (sides.sw) corner(0, 15, 1, -1);
    if (sides.se) corner(15, 15, -1, -1);
  }
  /** kerb of long stones where a cobbled plaza meets a lawn (4 px band) */
  function kerb(b, sides, gx, gy) {
    const P = COB;
    // across the band from the lawn side inward: joint, lit edge, stone, shade (N/W); S/E mirror it
    const inN = [P[0], P[4], P[3], P[1]], inS = [P[1], P[3], P[4], P[0]];
    const px = (prof, g, k) => {
      const c = prof[k];
      if (c === P[0] || c === P[1]) return c;
      return g % 6 === 0 ? P[0] : g % 6 === 1 ? P[4] : c;
    };
    for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) {
      if (sides.n) b.set(i, k, px(inN, gx + i, k));
      if (sides.s) b.set(i, 15 - k, px(inS, gx + i, k));
      if (sides.w) b.set(k, i, px(inN, gy + i, k));
      if (sides.e) b.set(15 - k, i, px(inS, gy + i, k));
    }
  }
  /** cobbles crumbling into a dirt path: joints fill with earth, edge stones go missing */
  function wornEdge(b, sides, gx, gy) {
    const t = tk();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.min(sides.n ? y : 99, sides.s ? 15 - y : 99, sides.w ? x : 99, sides.e ? 15 - x : 99);
      if (d > 4) continue;
      const c = b.get(x, y), h = t.hash(gx + x, gy + y, 229);
      if (c === COB[0] && d < 4) b.set(x, y, DIRT[1]);
      else if (d < 2 && h < 0.55) b.set(x, y, h < 0.2 ? DIRT[3] : DIRT[2]);
      else if (d < 3 && h < 0.18) b.set(x, y, DIRT[2]);
    }
  }
  function shadows(b, sh) {
    const t = tk();
    if (sh[0] === '1') for (let x = 0; x < 16; x++) { b.set(x, 0, t.mul(b.get(x, 0), 0.58)); b.set(x, 1, t.mul(b.get(x, 1), 0.7)); if (x % 2) b.set(x, 2, t.mul(b.get(x, 2), 0.85)); }
    if (sh[1] === '1') for (let y = sh[0] === '1' ? 3 : 0; y < 16; y++) { b.set(0, y, t.mul(b.get(0, y), 0.7)); if (y % 2) b.set(1, y, t.mul(b.get(1, y), 0.85)); }
    if (sh[2] === '1' && sh[0] !== '1' && sh[1] !== '1') { b.set(0, 0, t.mul(b.get(0, 0), 0.6)); b.set(1, 0, t.mul(b.get(1, 0), 0.75)); b.set(0, 1, t.mul(b.get(0, 1), 0.75)); }
  }
  const XCACHE = new Map();
  function xcached(key, make) { let v = XCACHE.get(key); if (v === undefined) { v = make(); XCACHE.set(key, v); } return v; }
  /** signature + builder of the ground Buf of kind `kind` (tile id `id`) at (x,y) */
  function groundSpec(m, x, y, id, theme) {
    const kind = kindOf(id, theme);
    const at = (dx, dy) => m.tileAt(x + dx, y + dy);
    const k = (dx, dy) => kindOf(at(dx, dy), theme);
    const sh = (XT.TALL[at(0, -1)] ? '1' : '0') + (XT.TALL[at(-1, 0)] ? '1' : '0') + (XT.TALL[at(-1, -1)] ? '1' : '0');
    const v = VAR[kind] ? pickVar(x, y, kind === 'grass' ? 231 : 233, VAR[kind]) : 0;
    const fv = id === 'flowers' ? Math.floor(tk().hash(x, y, 235) * 4) : 0;
    const N = k(0, -1), S = k(0, 1), W = k(-1, 0), E = k(1, 0);
    let edge = '';
    const sides = {};
    if (kind === 'cobble') {
      const e = (q) => (q === 'grass' || q === 'sand' || q === 'snow' ? 'k' : q === 'dirt' ? 'w' : '0');
      edge = e(N) + e(S) + e(W) + e(E);
    } else if (kind === 'dirt' || kind === 'sand' || kind === 'snow') {
      const g = (q) => (q === 'grass' ? '1' : '0');
      edge = g(N) + g(S) + g(W) + g(E);
      edge += (N !== 'grass' && W !== 'grass' && k(-1, -1) === 'grass' ? '1' : '0') + (N !== 'grass' && E !== 'grass' && k(1, -1) === 'grass' ? '1' : '0') +
        (S !== 'grass' && W !== 'grass' && k(-1, 1) === 'grass' ? '1' : '0') + (S !== 'grass' && E !== 'grass' && k(1, 1) === 'grass' ? '1' : '0');
    }
    // fringe / kerb noise runs in world coordinates: key on the position modulo the pattern
    const needPos = edge && /[1kw]/.test(edge);
    const key = 'xg|' + id + '|' + theme + '|' + v + '|' + fv + '|' + edge + '|' + sh + '|' + (needPos ? x + ',' + y : '');
    const build = () => {
      const t = tk();
      let b;
      if (id === 'flowers') b = GROUND.flowers(t, fv);
      else b = A.floorBuf(id === 'floor' ? 'theme:' + (theme || 'generic') : id).clone();
      if (DETAIL[kind] && v) DETAIL[kind](b, v);
      if (kind === 'cobble' && edge !== '0000') {
        const ks = { n: edge[0] === 'k', s: edge[1] === 'k', w: edge[2] === 'k', e: edge[3] === 'k' };
        const ws = { n: edge[0] === 'w', s: edge[1] === 'w', w: edge[2] === 'w', e: edge[3] === 'w' };
        // moss creeps into the joints near the lawn
        for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
          const d = Math.min(ks.n ? yy : 99, ks.s ? 15 - yy : 99, ks.w ? xx : 99, ks.e ? 15 - xx : 99);
          if (d < 8 && b.get(xx, yy) === COB[0] && t.hash(x * 16 + xx, y * 16 + yy, 237) < 0.7 - d * 0.08) b.set(xx, yy, MOSS[(xx + yy) % 2]);
        }
        wornEdge(b, ws, x * 16, y * 16);
        kerb(b, ks, x * 16, y * 16);
      } else if (edge && edge !== '00000000') {
        fringe(b, { n: edge[0] === '1', s: edge[1] === '1', w: edge[2] === '1', e: edge[3] === '1', nw: edge[4] === '1', ne: edge[5] === '1', sw: edge[6] === '1', se: edge[7] === '1' }, x * 16, y * 16);
      }
      shadows(b, sh);
      return b;
    };
    return { key, build, kind };
  }
  /** ground canvas for an outdoor ground cell, or null (not an outdoor ground) */
  function extGroundTile(m, x, y, id, theme) {
    const spec = groundSpec(m, x, y, id, theme);
    if (!EXT_KIND[spec.kind]) return null;
    return xcached(spec.key, () => spec.build().toCanvas());
  }

  // --- canals & banks ------------------------------------------------------
  /** side style next to water: 'k' stone coping, 'e' earth bank, '' water */
  function bankStyle(id, theme) {
    const q = kindOf(id, theme);
    if (q === 'water' || id === 'void') return '';
    if (q === 'grass' || id === 'tree') return 'e';
    if (q === 'sand') return 's';
    if (q === 'snow') return 'n';
    return 'k';
  }
  /** does water at (x,y) sit in outdoor ground (town canals, garden ponds)? */
  function outdoorWater(m, x, y, theme) {
    if (theme === 'town') return true;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (EXT_KIND[kindOf(m.tileAt(x + dx, y + dy), theme)]) return true;
    return false;
  }
  function canalFrames(sig, theme) {
    // sig: N S W E (k/e/-) + inner corners NW NE SW SE (k/e/-)
    return xcached('cn|' + sig + '|' + theme, () => {
      const t = tk();
      const [N, S, W, E, NW, NE, SW, SE] = sig.split('');
      const P = COB, D = DIRT;
      const bankCol = 0x0a1840;
      // lip ramps [shade, top, lit] and bank-face colours for earthen banks
      const LIP = { e: [t.PAL.tgrass[1], t.PAL.tgrass[3], t.PAL.tgrass[4]], s: [t.PAL.sand[1], t.PAL.sand[3], t.PAL.sand[4]], n: [t.PAL.snow[1], t.PAL.snow[3], t.PAL.snow[4]] };
      const FACE = { e: [D[1], D[0]], s: [t.PAL.sand[1], t.PAL.sand[0]], n: [t.PAL.snow[1], t.PAL.snow[0]] };
      const make = (f) => {
        const b = water(t, f);
        // the water under a north bank lies in its shadow
        if (N !== '-') for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { const k = y < 8 ? 0.72 : y < 10 ? 0.86 : 1; if (k < 1) b.set(x, y, t.mul(b.get(x, y), k)); }
        if (W !== '-') for (let y = 0; y < 16; y++) { b.set(4, y, t.mul(b.get(4, y), 0.8)); b.set(5, y, t.mul(b.get(5, y), 0.9)); }
        // north: coping + wall face (stone) or grass lip + earth bank
        if (N === 'k') {
          for (let x = 0; x < 16; x++) {
            const j = x % 8 === 0;
            b.set(x, 0, P[4]); b.set(x, 1, j ? P[1] : P[3]); b.set(x, 2, P[0]);
            const dk = t.mul(P[0], 0.8);
            b.set(x, 3, x % 8 === 0 ? dk : P[2]); b.set(x, 4, x % 8 === 0 ? dk : P[1]);
            b.set(x, 5, dk);
            b.set(x, 6, x % 8 === 4 ? dk : t.mul(P[1], 0.85));
            b.set(x, 7, (x + f) % 5 === 0 ? 0x88b0e0 : bankCol);
          }
        } else if (LIP[N]) {
          const G = LIP[N], F = FACE[N];
          for (let x = 0; x < 16; x++) {
            const d = 1 + Math.round(t.vnoise(x, 0, 3, 16, 241) * 1.4);
            for (let y = 0; y < d; y++) b.set(x, y, G[1]);
            b.set(x, d, G[0]);
            for (let y = d + 1; y <= 5; y++) b.set(x, y, y === d + 1 ? F[0] : (x + y) % 4 === 0 ? F[1] : t.mul(F[0], 0.8));
            b.set(x, 6, (x + f) % 5 === 0 ? 0x88b0e0 : bankCol);
          }
        }
        // west / east: coping seen from above, or a grass lip
        const vside = (s, X) => {
          const dir = X === 0 ? 1 : -1;
          if (s === 'k') {
            for (let y = 0; y < 16; y++) {
              const j = y % 8 === 3;
              b.set(X, y, X === 0 ? P[3] : P[2]);
              b.set(X + dir, y, j ? P[1] : X === 0 ? P[4] : P[3]);
              b.set(X + dir * 2, y, X === 0 ? P[2] : P[4]);
              b.set(X + dir * 3, y, P[0]);
            }
          } else if (LIP[s]) {
            const G = LIP[s], F = FACE[s];
            for (let y = 0; y < 16; y++) {
              const d = 1 + Math.round(t.vnoise(0, y, 3, 16, X ? 245 : 243) * 1.4);
              for (let k = 0; k < d; k++) b.set(X + dir * k, y, G[1]);
              b.set(X + dir * d, y, G[0]);
              b.set(X + dir * (d + 1), y, F[0]);
            }
          }
        };
        vside(W === '-' ? '' : W, 0);
        vside(E === '-' ? '' : E, 15);
        // south: the near coping's top, or the near bank's grass edge
        if (S === 'k') {
          for (let x = 0; x < 16; x++) {
            b.set(x, 12, (x + f) % 4 === 0 ? 0xb8d8f8 : t.mul(b.get(x, 12), 0.85));
            b.set(x, 13, P[0]); b.set(x, 14, x % 8 === 5 ? P[1] : P[4]); b.set(x, 15, P[3]);
          }
        } else if (LIP[S]) {
          const G = LIP[S], F = FACE[S];
          for (let x = 0; x < 16; x++) {
            const d = 1 + Math.round(t.vnoise(x, 0, 3, 16, 247) * 1.2);
            b.set(x, 15 - d - 1, (x + f) % 3 ? 0xc8e0fc : 0x88b8f0);
            b.set(x, 15 - d, F[0]);
            for (let k = 0; k < d; k++) b.set(x, 15 - k, k === d - 1 ? G[2] : G[1]);
          }
        }
        // inner corners: a block of coping (or a tuft of bank) where only the diagonal is land
        const cornerBlock = (s, x0, y0, north) => {
          if (s === 'k') {
            b.rect(x0, y0, 3, 3, P[3]); b.set(x0, y0, P[4]); b.set(x0 + 1, y0, P[4]); b.set(x0 + 2, y0 + 2, P[1]);
            if (north) for (let y = y0 + 3; y <= y0 + 5; y++) for (let x = x0; x < x0 + 3; x++) b.set(x, y, y === y0 + 4 ? t.mul(P[0], 0.8) : P[1]);
          } else if (LIP[s]) { const G = LIP[s]; b.rect(x0, y0, 3, 2, G[1]); b.set(x0 + 1, y0 + 2, G[0]); b.set(x0, y0 + 2, G[0]); }
        };
        if (NW !== '-') cornerBlock(NW, 0, 0, true);
        if (NE !== '-') cornerBlock(NE, 13, 0, true);
        if (SW !== '-') cornerBlock(SW, 0, 13, false);
        if (SE !== '-') cornerBlock(SE, 13, 13, false);
        return b;
      };
      return [0, 1, 2, 3].map(make);
    });
  }
  function canalSig(m, x, y, theme) {
    const st = (dx, dy) => bankStyle(m.tileAt(x + dx, y + dy), theme) || '-';
    const N = st(0, -1), S = st(0, 1), W = st(-1, 0), E = st(1, 0);
    const inner = (dx, dy, a, b2) => (a === '-' && b2 === '-' ? st(dx, dy) : '-');
    return N + S + W + E + inner(-1, -1, N, W) + inner(1, -1, N, E) + inner(-1, 1, S, W) + inner(1, 1, S, E);
  }
  function canalTile(m, x, y, theme) {
    const sig = canalSig(m, x, y, theme);
    if (sig === '--------') return null;
    return xcached('cnv|' + sig + '|' + theme, () => canalFrames(sig, theme).map((b) => b.toCanvas()));
  }
  function bridgeTile(m, x, y, id, theme) {
    const sig = canalSig(m, x, y, theme);
    return xcached('br|' + id + '|' + sig + '|' + theme, () => {
      const fr = canalFrames(sig, theme);
      return fr.map((wb, f) => OBJ[id](null, { f, water: wb }).toCanvas());
    });
  }

  // --- fences over their ground --------------------------------------------
  function fenceTile(m, x, y, theme) {
    // the ground the fence stands on: weighted vote of the neighbours, else the theme's lawn
    const score = {};
    const vote = (dx, dy, w) => {
      let id = m.tileAt(x + dx, y + dy);
      if (!XT.GROUND[id]) return;
      if (id === 'flowers') id = 'lgrass';
      score[id] = (score[id] || 0) + w;
    };
    vote(0, 1, 3); vote(-1, 0, 2); vote(1, 0, 2); vote(0, -1, 1.5);
    vote(-1, 1, 0.5); vote(1, 1, 0.5); vote(-1, -1, 0.25); vote(1, -1, 0.25);
    let g = null, bs = 0;
    for (const k in score) if (score[k] > bs) { bs = score[k]; g = k; }
    if (!g) g = theme === 'town' || !theme || theme === 'generic' ? 'lgrass' : 'floor';
    const s = (dx, dy) => (m.tileAt(x + dx, y + dy) === 'fence' ? '1' : '0');
    const j = s(-1, 0) + s(1, 0) + s(0, -1) + s(0, 1);
    const spec = groundSpec(m, x, y, g, theme);
    return xcached('fn|' + spec.key + '|' + j, () => {
      const fl = EXT_KIND[spec.kind] ? spec.build() : A.floorBuf(g === 'floor' ? 'theme:' + (theme || 'generic') : g).clone();
      if (!EXT_KIND[spec.kind]) shadows(fl, (XT.TALL[m.tileAt(x, y - 1)] ? '1' : '0') + (XT.TALL[m.tileAt(x - 1, y)] ? '1' : '0') + '0');
      return OBJ.fence(fl, { l: j[0] === '1', r: j[1] === '1', u: j[2] === '1', d: j[3] === '1' }).toCanvas();
    });
  }

  // ------------------------------------------------------------ registry
  // default floor under each object for the generic 'tile:<id>'
  const DEFAULT_FLOOR = {
    counter: 'wood', table: 'wood', chair: 'wood', bed: 'wood', bookshelf: 'wood', shelf: 'wood',
    pot: 'wood', barrel: 'wood', crate: 'wood', throne: 'carpet', altar: 'stone', statue: 'stone', pedestal: 'stone',
    warp_pad: 'stone', seal: 'stone', pit: 'stone', sign: 'lgrass', well: 'lgrass', grave: 'lgrass', tree: 'lgrass', fence: 'lgrass',
    lbridge_h: 'water', lbridge_v: 'water',
  };
  const ANIM = { warp_pad: 4, seal: 2 }; // (bridges animate their water only in context tiles)
  A.OBJECT_IDS = Object.keys(DEFAULT_FLOOR);
  A.DEFAULT_FLOOR = DEFAULT_FLOOR;
  /** object Buf on a floor Buf (cloned internally); ctx {l,r,u,d,f} */
  A.objectArt = function (id, floorBuf, ctx) {
    const fn = OBJ[id];
    if (!fn) return floorBuf.clone();
    return fn(floorBuf.clone(), ctx || {});
  };
  function objTile(id, floorName) {
    const t = tk();
    const n = ANIM[id] || 1;
    if (n > 1) return t.frames(n, (f) => A.objectArt(id, A.floorBuf(floorName), { f }));
    return A.objectArt(id, A.floorBuf(floorName)).toCanvas();
  }
  A.objectTile = objTile;

  const def = (k, f) => R.Gfx.def(k, f);
  // grounds
  for (const g of ['lgrass', 'dirt', 'wood', 'carpet', 'sand', 'snowfloor', 'ice', 'flowers', 'void']) def('tile:' + g, () => A.floorBuf(g).toCanvas());
  def('tile:water', () => tk().frames(4, (f) => water(tk(), f)));
  def('tile:lava', () => tk().frames(2, (f) => lava(tk(), f)));
  def('tile:poison', () => tk().frames(2, (f) => poison(tk(), f)));
  // objects
  for (const id of A.OBJECT_IDS) def('tile:' + id, () => objTile(id, DEFAULT_FLOOR[id]));
  // houses
  def('tile:housewall', () => housewall({ window: true }).toCanvas());
  def('tile:roof', () => roof({}).toCanvas());
  // themed object variants: indoor & dungeon objects stand on the theme's floor
  const THEME_OBJS = ['counter', 'table', 'chair', 'bed', 'bookshelf', 'shelf', 'pot', 'barrel', 'crate', 'altar', 'statue',
    'pedestal', 'warp_pad', 'seal', 'pit', 'grave', 'sign'];
  const OUTDOOR_THEMES = { town: 1 };
  for (const theme of Object.keys(R.DB.themes || {})) {
    if (OUTDOOR_THEMES[theme]) continue;
    for (const id of THEME_OBJS) def('tile:' + theme + ':' + id, () => objTile(id, 'theme:' + theme));
  }
  // a tile id added to the data later without art gets a neutral floor, never the magenta placeholder
  R.onBoot(() => {
    for (const id of Object.keys(R.DB.tiles)) if (!R.Gfx.has('tile:' + id)) def('tile:' + id, () => A.floorBuf('stone').toCanvas());
  });

  // ------------------------------------------- context tiler: outdoor grounds
  // Wraps R.Art.localTile (tiles_auto.js, loaded before this file) so outdoor
  // grounds, fences, canals and bridges use the exterior art above; everything
  // else (walls, houses, interiors, dungeons) is left to the base tiler.
  function installExterior() {
    const base = A.localTile;
    if (typeof base !== 'function' || base._exterior) return;
    const wrapped = function (map, x, y) {
      const id = map.tileAt(x, y);
      const theme = map.theme && A.THEME_DEFS && A.THEME_DEFS[map.theme] ? map.theme : 'generic';
      if (id === 'fence') return fenceTile(map, x, y, theme);
      if (id === 'water') return (outdoorWater(map, x, y, theme) && canalTile(map, x, y, theme)) || base(map, x, y);
      if (id === 'lbridge_h' || id === 'lbridge_v') return outdoorWater(map, x, y, theme) ? bridgeTile(map, x, y, id, theme) : base(map, x, y);
      if (XT.GROUND[id]) return extGroundTile(map, x, y, id, theme) || base(map, x, y);
      return base(map, x, y);
    };
    wrapped._exterior = true;
    A.localTile = wrapped;
  }
  installExterior();
  R.onBoot(installExterior);
})(window.RPG);
