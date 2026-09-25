// Themed local tiles: floor wall wall_torch door door_silver door_gold pillar
// stairs_up stairs_down rock, for every theme in R.DB.themes plus the generic
// 'tile:<id>' fallback. Materials (floor, wall face, wall top, door leaf) are
// defined per theme; walls are drawn in DQ5-style 3/4 view: a lit top cap and a
// darker brick/rock face. R.Art.themeArt(theme) exposes the parts so the
// context tiler (tiles_auto.js) and object tiles (tiles_local.js) reuse them.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;

  // ------------------------------------------------------------ palettes
  // ramps are dark → light; fl = floor, wl = wall face, tp = wall top
  const TH = {
    generic: { fl: [0x3a3a44, 0x62626e, 0x80808e, 0x9c9caa, 0xbcbcc8], floor: 'flags', wl: [0x30303a, 0x565864, 0x7a7c88, 0x9c9eaa, 0xc0c2cc], wall: 'bricks', door: 'wood', col: 'stone' },
    town: { fl: [0x4a463e, 0x7c7666, 0x9e9784, 0xb8b19c, 0xd4cdb8], floor: 'cobble', wl: [0x34343e, 0x646674, 0x8a8e9c, 0xacb0bc, 0xd0d4dc], wall: 'ashlar', door: 'wood', col: 'stone' },
    castle: { fl: [0x363a52, 0x565e80, 0x717a9e, 0x8c94b6, 0xacb4d2], floor: 'tiles', wl: [0x34343e, 0x5a5c6a, 0x7e808e, 0xa2a4b0, 0xc6c8d2], wall: 'bricks', door: 'wood', col: 'marble' },
    house: { fl: null, floor: 'planks', wl: [0x5c4a30, 0xa89470, 0xcebe9a, 0xe6dabc, 0xf6eed6], wall: 'plaster', door: 'wood', col: 'wood' },
    cave: { fl: [0x34261a, 0x544030, 0x6c563e, 0x846c50, 0x9e8666], floor: 'dirt', wl: [0x241810, 0x44301e, 0x62482c, 0x80623e, 0xa08054, 0xc0a070], wall: 'rock', door: 'wood', col: 'stalag' },
    fort: { fl: [0x383026, 0x5a4e3e, 0x746652, 0x8c7e68, 0xa69880], floor: 'slabs', wl: [0x2e2a26, 0x524c44, 0x726a5e, 0x928a7c, 0xb2aa9a], wall: 'rubble', door: 'wood', col: 'wood' },
    pyramid: { fl: [0x5a3e1a, 0x8a6630, 0xae8646, 0xc8a05e, 0xe0c080], floor: 'blocks', wl: [0x4c3214, 0x7c5628, 0xa47a3e, 0xc49a56, 0xdcba78], wall: 'sandstone', door: 'stone', col: 'lotus' },
    water: { fl: [0x1a2838, 0x304a62, 0x46647e, 0x5e7e98, 0x7c9cb4], floor: 'wet', wl: [0x0e1c2c, 0x1c3850, 0x2a5070, 0x3a6a8e, 0x5488ac, 0x7cacca], wall: 'rock', door: 'wood', col: 'stalag' },
    ice: { fl: [0x5070a0, 0x7898c4, 0x9cbcdc, 0xbcd8ee, 0xe0f2fc], floor: 'ice', wl: [0x203c6c, 0x34609a, 0x5088c0, 0x78b0dc, 0xa8d4f0, 0xe4f6ff], wall: 'iceblock', door: 'ice', col: 'ice' },
    volcano: { fl: [0x160c0c, 0x2a1a18, 0x3e2a24, 0x543a30, 0x6c4c3c], floor: 'basalt', wl: [0x180a06, 0x341a10, 0x522818, 0x703a24, 0x8e5030, 0xae6a40], wall: 'rock', door: 'iron', col: 'basalt' },
    tower: { fl: [0x28243a, 0x464060, 0x625a80, 0x7e76a0, 0xa098c0], floor: 'diamond', wl: [0x242034, 0x443e5c, 0x645c80, 0x847ca2, 0xa8a0c4], wall: 'bricks', door: 'iron', col: 'marble' },
    shrine: { fl: [0x707888, 0x9ca4b4, 0xc0c8d6, 0xdce2ec, 0xf8faff], floor: 'marble', wl: [0x646c7e, 0x9098aa, 0xb8becc, 0xd6dae4, 0xf4f6fa], wall: 'marble', door: 'shrine', col: 'marble' },
    demon: { fl: [0x0a0610, 0x1a1224, 0x2a1e38, 0x3a2c4a, 0x4e3e60], floor: 'demon', wl: [0x0e0814, 0x20162c, 0x322444, 0x46345c, 0x5e4878], wall: 'dbricks', door: 'demon', col: 'spike' },
  };
  const WOOD = [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468];

  // ------------------------------------------------------------ helpers
  /** periodic Voronoi over w×h with points pts → per-pixel {id, d1, d2, cx, cy} */
  function voronoi(w, h, pts) {
    const n = w * h, id = new Int16Array(n), d1 = new Float32Array(n), d2 = new Float32Array(n), cx = new Float32Array(n), cy = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let a = 1e9, b = 1e9, ai = 0, ax = 0, ay = 0;
      for (let k = 0; k < pts.length; k++) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const px = pts[k][0] + ox * w, py = pts[k][1] + oy * h;
        const d = Math.sqrt((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2);
        if (d < a) { b = a; a = d; ai = k; ax = px; ay = py; } else if (d < b) b = d;
      }
      const i = y * w + x;
      id[i] = ai; d1[i] = a; d2[i] = b; cx[i] = ax; cy[i] = ay;
    }
    return { id, d1, d2, cx, cy };
  }
  function jitterPts(n, seed, w, h) {
    const t = tk(), r = t.rng(seed), pts = [];
    const cols = Math.round(Math.sqrt(n * w / h)), rows = Math.ceil(n / cols);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      pts.push([((i + 0.5 + (j % 2) * 0.5) * w) / cols + (r() - 0.5) * (w / cols) * 0.6, ((j + 0.5) * h) / rows + (r() - 0.5) * (h / rows) * 0.6]);
    }
    return pts;
  }
  /** stones from a Voronoi: grout, inner highlight (top-left) and shadow (bottom-right) */
  function stones(b, pal, pts, o) {
    const t = tk();
    o = o || {};
    const v = voronoi(b.w, b.h, pts);
    const gw = o.grout == null ? 1.1 : o.grout;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const i = y * b.w + x, e = v.d2[i] - v.d1[i];
      let col;
      if (e < gw) col = pal[0];
      else {
        const dx = x + 0.5 - v.cx[i], dy = y + 0.5 - v.cy[i];
        const lit = -(dx * 0.6 + dy * 0.8) / Math.max(1.5, v.d1[i] + e * 0.5);
        const tone = t.hash(v.id[i], 3, o.seed || 1);
        col = pal[2];
        if (e < gw + 1.2) col = lit > 0.15 ? pal[3] : lit < -0.15 ? pal[1] : pal[2];
        else if (tone < 0.25 && o.vary !== false) col = t.mix(pal[2], pal[1], 0.35);
        else if (tone > 0.8 && o.vary !== false) col = t.mix(pal[2], pal[3], 0.4);
        if (o.hi && e > gw + 1.2 && lit > 0.5 && t.hash(x, y, 9) < 0.5) col = pal[4];
      }
      b.p[i] = col;
    }
    return b;
  }
  /** running-bond bricks with per-brick shading */
  function bricks(b, pal, bw, bh, o) {
    const t = tk();
    o = o || {};
    const y0 = o.y0 || 0;
    for (let y = y0; y < b.h; y++) {
      const row = Math.floor((y - y0) / bh), ry = (y - y0) % bh;
      const off = row % 2 ? Math.floor(bw / 2) : 0;
      for (let x = 0; x < b.w; x++) {
        const bx = (x + off) % bw, bi = Math.floor((x + off) / bw);
        let col;
        if (ry === bh - 1 || bx === bw - 1) col = pal[0];
        else if (ry === 0) col = pal[3];
        else if (bx === 0) col = pal[3];
        else if (ry === bh - 2) col = pal[1];
        else col = pal[2];
        const tone = t.hash(bi, row, o.seed || 5);
        if (col === pal[2] && tone < 0.3) col = t.mix(pal[2], pal[1], 0.4);
        if (col === pal[2] && t.hash(x, y, 77) < 0.04) col = pal[1];
        b.p[y * b.w + x] = col;
      }
    }
    return b;
  }

  // ------------------------------------------------------------ floors
  const FLOOR = {
    flags(t, P) { return stones(t.tile(), P, [[4, 4], [12, 3], [8, 11], [1, 12], [14, 10]], { grout: 1, seed: 2 }); },
    cobble(t, P) { return stones(t.tile(), P, jitterPts(8, 11, 16, 16), { grout: 1.1, seed: 4, hi: true }); },
    tiles(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const lx = x % 8, ly = y % 8, alt = ((x >> 3) + (y >> 3)) % 2;
        let col = alt ? P[2] : t.mix(P[2], P[3], 0.35);
        if (lx === 7 || ly === 7) col = P[0];
        else if (lx === 0 || ly === 0) col = P[4];
        else if (lx === 6 || ly === 6) col = P[1];
        else if (lx + ly === 4 && !alt) col = t.mix(col, P[4], 0.5);
        b.p[y * 16 + x] = col;
      }
      return b;
    },
    planks(t, pal) {
      const P = pal && pal.length > 5 ? pal : WOOD, b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 2, ry = y & 3, off = [0, 9, 4, 12][row];
        for (let x = 0; x < 16; x++) {
          const bx = (x + off) % 16;
          let col = P[3];
          if (ry === 3) col = P[1];
          else if (bx === 0) col = P[1];
          else if (ry === 0) col = P[4];
          else if (t.hash(x, y, 13) < 0.1) col = P[2];
          else if ((bx + row * 3) % 7 === 3 && ry === 1) col = P[2];
          b.p[y * 16 + x] = col;
        }
      }
      return b;
    },
    dirt(t, P, seed) {
      const sd = seed || 0;
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 21), h = t.hash(x, y, 23 + sd);
        if (h < 0.05) return P[1];
        if (h > 0.97) return P[4];
        return v < 0.35 ? t.mix(P[2], P[1], 0.45) : v > 0.68 ? t.mix(P[2], P[3], 0.5) : P[2];
      });
      let pts = [[3, 3], [11, 6], [6, 12], [14, 13]];
      if (sd) { const r = t.rng(sd); pts = pts.map(() => [Math.floor(r() * 16), Math.floor(r() * 16)]).slice(0, 2 + Math.floor(r() * 3)); }
      for (const [x, y] of pts) { b.wset(x, y, P[3]); b.wset(x + 1, y, P[4]); b.wset(x, y + 1, P[1]); b.wset(x + 1, y + 1, P[0]); }
      return b;
    },
    slabs(t, P) { return stones(t.tile(), P, [[4, 3], [12, 5], [3, 11], [10, 13]], { grout: 1.2, seed: 6 }); },
    blocks(t, P) {
      const b = t.tile();
      bricks(b, [P[0], P[1], P[2], P[3]], 8, 8, { seed: 8 });
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (b.p[y * 16 + x] === P[2] && t.hash(x, y, 31) < 0.06) b.p[y * 16 + x] = P[3];
      return b;
    },
    wet(t, P) {
      const b = stones(t.tile(), P, jitterPts(6, 17, 16, 16), { grout: 1.2, seed: 7 });
      for (const [x, y] of [[4, 4], [11, 10]]) { b.wset(x, y, P[4]); b.wset(x + 1, y, 0xb8d8ec); }
      return b;
    },
    ice(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const lx = x % 8, ly = y % 8;
        if (lx === 7 || ly === 7) return P[1];
        const d = (lx + ly + ((x >> 3) + (y >> 3)) * 3) % 12;
        if (d === 2 || d === 3) return P[4];
        if (lx === 0 || ly === 0) return P[3];
        return P[2];
      });
      return b;
    },
    basalt(t, P) {
      const b = stones(t.tile(), P, [[2, 3], [10, 1], [14, 8], [6, 9], [1, 14], [11, 14]], { grout: 1.1, seed: 9 });
      // faint glowing seams
      for (let i = 0; i < 256; i++) if (b.p[i] === P[0] && t.hash(i, 1, 33) < 0.35) b.p[i] = 0x6a1c0c;
      return b;
    },
    diamond(t, P) {
      return t.tex(16, 16, (x, y) => {
        const u = (x + y) % 8, v = (x - y + 16) % 8;
        if (u === 0 || v === 0) return P[0];
        if (u === 1 || v === 1) return P[3];
        const cell = (Math.floor((x + y) / 8) + Math.floor((x - y + 16) / 8)) % 2;
        if (u === 4 && v === 4) return P[4];
        return cell ? P[2] : t.mix(P[2], P[1], 0.45);
      });
    },
    marble(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const lx = x % 8, ly = y % 8;
        let col = P[3];
        if (lx === 7 || ly === 7) col = P[1];
        else if (lx === 0 || ly === 0) col = P[4];
        else {
          const vein = Math.sin((x * 0.9 + y * 0.5 + 2 * Math.sin(y * 0.8)) * 1.1);
          if (vein > 0.93) col = P[2];
        }
        b.p[y * 16 + x] = col;
      }
      // blue inlay at tile corners
      for (const [x, y] of [[7, 7], [15, 15], [7, 15], [15, 7]]) { b.set(x, y, 0x4c78c8); }
      return b;
    },
    demon(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const lx = x % 8, ly = y % 8;
        let col = ((x >> 3) + (y >> 3)) % 2 ? P[2] : P[1];
        if (lx === 7 || ly === 7) col = 0x3c0a10;
        else if (lx === 0 || ly === 0) col = P[3];
        else if (t.hash(x, y, 41) < 0.06) col = P[0];
        b.p[y * 16 + x] = col;
      }
      b.line(2, 9, 5, 12, 0x5c0c14); b.set(3, 10, 0x901820);
      return b;
    },
  };

  // ------------------------------------------------------------ wall faces
  // face textures are 16x16 (drawn below a cap when the floor is above)
  const FACE = {
    bricks(t, P) { return bricks(t.tile(), P, 8, 4, { seed: 3 }); },
    ashlar(t, P) { return bricks(t.tile(), P, 8, 8, { seed: 4 }); },
    dbricks(t, P) {
      const b = bricks(t.tile(), P, 8, 4, { seed: 5 });
      for (let i = 0; i < 256; i++) if (b.p[i] === P[0]) b.p[i] = t.hash(i, 2, 5) < 0.5 ? 0x5a0c16 : 0x2e0810;
      return b;
    },
    plaster(t, P) {
      const b = t.tile(P[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (t.hash(x, y, 51) < 0.08) b.set(x, y, P[2]);
      }
      // wainscot (bottom) and a beam post
      for (let y = 10; y < 16; y++) for (let x = 0; x < 16; x++) b.set(x, y, y === 10 ? WOOD[4] : y === 15 ? WOOD[1] : x % 4 === 3 ? WOOD[2] : WOOD[3]);
      b.hline(0, 15, 11, WOOD[2]);
      b.vline(15, 0, 9, WOOD[2]); b.vline(0, 0, 9, WOOD[3]);
      return b;
    },
    rock(t, P) {
      const b = t.tile();
      const pts = [[3, 3], [11, 2], [7, 8], [1, 11], [13, 10], [6, 15], [15, 15]];
      const v = voronoi(16, 16, pts);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const i = y * 16 + x, e = v.d2[i] - v.d1[i];
        const dx = x + 0.5 - v.cx[i], dy = y + 0.5 - v.cy[i];
        const lit = -(dx * 0.7 + dy * 0.7) / Math.max(2, v.d1[i] + e);
        let k = 2 + (lit > 0.35 ? 2 : lit > 0.05 ? 1 : lit < -0.3 ? -1 : 0);
        if (e < 1) k = 0;
        else if (e < 1.8) k = Math.min(k, 1);
        b.p[i] = P[Math.max(0, Math.min(P.length - 1, k))];
      }
      return b;
    },
    rubble(t, P) {
      const b = stones(t.tile(), P, [[3, 2], [11, 3], [6, 8], [14, 9], [2, 13], [10, 14]], { grout: 1.2, seed: 12 });
      // timber beam across the top
      return b;
    },
    sandstone(t, P) {
      const b = bricks(t.tile(), P, 16, 8, { seed: 6 });
      // carved glyph band in the upper block
      const G = [[2, 2], [2, 3], [2, 4], [3, 3], [6, 2], [7, 2], [6, 3], [7, 4], [6, 4], [10, 2], [11, 3], [10, 4], [12, 2], [13, 2], [13, 3], [13, 4]];
      for (const [x, y] of G) { b.set(x, y, P[1]); b.set(x + 1, y + 1, P[3]); }
      b.set(4, 11, 0x2c4c9c); b.set(5, 11, 0x2c4c9c); b.set(12, 11, 0xa03020); b.set(11, 11, 0xa03020);
      return b;
    },
    iceblock(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const row = y >> 3, off = row ? 5 : 0, bx = (x + off) % 16, ry = y & 7;
        let col = P[3];
        if (ry === 7 || bx === 15 || bx === 7) col = P[1];
        else if (ry === 0 || bx === 0 || bx === 8) col = P[4];
        else if ((bx + ry) % 9 === 4 || (bx + ry) % 9 === 5) col = P[5];
        else if (ry === 6) col = P[2];
        b.p[y * 16 + x] = col;
      }
      return b;
    },
    marble(t, P) {
      const b = bricks(t.tile(), P, 16, 8, { seed: 7 });
      for (let x = 0; x < 16; x++) { b.set(x, 5, 0x3c64b4); b.set(x, 6, 0x2c4c9c); }
      for (let x = 1; x < 16; x += 4) b.set(x, 5, 0x78a0e0);
      return b;
    },
  };
  // top surface of thick walls (seen from above)
  const TOP = {
    // large dressed blocks seen from above, a notch darker than the lit cap
    stone(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 3, ry = y & 7, off = row ? 4 : 0;
        for (let x = 0; x < 16; x++) {
          const bx = (x + off) % 8;
          let col = t.mix(P[2], P[3], 0.5);
          if (ry === 7 || bx === 7) col = P[1];
          else if (ry === 0 || bx === 0) col = P[3];
          else if (ry === 6 || bx === 6) col = P[2];
          else if (t.hash(x, y, 61) < 0.05) col = P[2];
          b.p[y * 16 + x] = col;
        }
      }
      return b;
    },
    rock(t, P) {
      const b = t.tile(P[1]);
      for (const [x, y, r] of [[4, 4, 3], [12, 5, 3.5], [7, 12, 3], [15, 13, 2.5], [0, 12, 2]]) {
        for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
          const d = Math.sqrt(i * i + j * j);
          if (d > r) continue;
          b.wset(x + i, y + j, d > r - 1 ? (i + j < 0 ? P[2] : P[0]) : i + j < -1 ? P[3] : P[2]);
        }
      }
      return b;
    },
    // thin interior wall seen from above: plaster core between timber sills
    beam(t, P) {
      const b = t.tile(P[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 63) < 0.08) b.set(x, y, P[2]);
      for (let y = 0; y < 16; y++) { b.set(0, y, WOOD[2]); b.set(1, y, WOOD[4]); b.set(14, y, WOOD[3]); b.set(15, y, WOOD[1]); }
      for (let y = 3; y < 16; y += 8) b.hline(2, 13, y, P[1]);
      return b;
    },
  };
  const TOP_OF = { plaster: 'beam', rock: 'rock', iceblock: 'stone' };

  // ------------------------------------------------------------ per theme cache
  const ART = {};
  function art(theme) {
    theme = TH[theme] ? theme : 'generic';
    if (ART[theme]) return ART[theme];
    const t = tk(), th = TH[theme];
    const flPal = th.fl || WOOD.slice(1);
    const a = { theme, th, WOOD };
    a.floor = FLOOR[th.floor](t, th.fl || WOOD);
    a.face = FACE[th.wall](t, th.wl);
    if (theme === 'volcano') {
      // glowing magma seams between the rocks
      for (let i = 0; i < 256; i++) {
        if (a.face.p[i] !== th.wl[0]) continue;
        const h = t.hash(i, 7, 13);
        if (h < 0.45) a.face.p[i] = h < 0.15 ? 0xff9028 : 0xc83810;
      }
    }
    const topKind = TOP_OF[th.wall] || 'stone';
    a.top = TOP[topKind](t, th.wl);
    a.topKind = topKind;
    // cap = 4 px strip at the top of a face whose upper neighbour is floor
    a.capColors = topKind === 'rock' ? [th.wl[0], th.wl[2], th.wl[3], th.wl[4]] : topKind === 'beam' ? [WOOD[0], WOOD[3], WOOD[4], WOOD[5]] : [th.wl[0], th.wl[3], th.wl[4], th.wl[th.wl.length - 1]];
    a.flPal = flPal;
    ART[theme] = a;
    return a;
  }
  A.themeArt = art;
  A.THEME_DEFS = TH;

  // ------------------------------------------------------------ floor variants
  // Large runs of one floor get deterministic variety (tiles_auto picks a variant
  // per cell from a position hash): 1 'tone' (a stone / tile recoloured), 2 'worn'
  // (chips, scuffs, a stain), 3 'detail' (hairline crack, moss in the grout, a
  // knot…). 'alt' is the floor in the theme's second colour (tile_alt decor) and
  // 'crack' a long crack across the cell (crack decor). Variants never move grout
  // lines and only recolour stones that do not continue into the next cell, so
  // they tile seamlessly with the plain floor.
  // Second colour per theme (tile_alt): same texture, contrasting material.
  const ALT = {
    generic: [0x4a3e30, 0x7a6a54, 0x9c8a6e, 0xb8a688, 0xd4c4a6],
    town: [0x4a2a22, 0x7c4436, 0x9c5a46, 0xb87458, 0xd49474],
    castle: [0x5c5448, 0x8c8270, 0xb0a68e, 0xccc2a8, 0xe6dcc4],
    house: [0x21100a, 0x3a1e12, 0x55301c, 0x6e4228, 0x8a5836, 0xa87248],
    cave: [0x2a2420, 0x463c34, 0x5c5046, 0x746658, 0x8c7e6e],
    fort: [0x2e2a30, 0x4c4852, 0x66626c, 0x807c86, 0x9a96a0],
    pyramid: [0x3c2c1c, 0x6a4c2c, 0x8c6a40, 0xa88452, 0xc4a06c],
    water: [0x14303a, 0x245064, 0x326a80, 0x44849a, 0x5ea0b4],
    ice: [0x384e8c, 0x5070b0, 0x7094cc, 0x98b8e4, 0xc8e0f8],
    volcano: [0x281008, 0x46201a, 0x62302a, 0x7c4234, 0x985844],
    tower: [0x2c2c3c, 0x484c64, 0x646a86, 0x8088a4, 0xa4acc4],
    shrine: [0x3c5078, 0x5c74a0, 0x8098c0, 0xa8bcdc, 0xd0e0f4],
    demon: [0x1a0608, 0x34101a, 0x4c1a28, 0x662438, 0x843250],
  };
  const MOSSY = { town: 1, cave: 1, fort: 1, water: 1, generic: 1, pyramid: 0 };
  const FORMAL = { castle: 1, shrine: 1, tower: 1 };
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /** flood-fill the non-separator pixels of a 16x16 texture on the torus */
  function regions(b, isSep) {
    const lab = new Int16Array(256).fill(-1), list = [];
    for (let s = 0; s < 256; s++) {
      if (lab[s] !== -1 || isSep(b.p[s])) continue;
      const k = list.length, px = [], st = [s];
      let cross = false;
      lab[s] = k;
      while (st.length) {
        const i = st.pop();
        px.push(i);
        const x = i & 15, y = i >> 4;
        for (const [dx, dy] of D4) {
          let nx = x + dx, ny = y + dy;
          const wrap = nx < 0 || nx > 15 || ny < 0 || ny > 15;
          nx &= 15; ny &= 15;
          const j = ny * 16 + nx;
          if (isSep(b.p[j])) continue;
          if (wrap) cross = true;
          if (lab[j] === -1) { lab[j] = k; st.push(j); }
        }
      }
      list.push({ px, cross, k });
    }
    return { lab, list };
  }
  /** separator (grout / seam) test for a floor kind */
  function sepFor(kind, P) {
    const c = tk().c;
    if (kind === 'planks') return (v) => v === c(P[1]);
    if (kind === 'marble' || kind === 'ice') return (v) => v === c(P[1]);
    if (kind === 'demon') return (v) => v === 0x3c0a10;
    if (kind === 'basalt') return (v) => v === c(P[0]) || v === 0x6a1c0c;
    if (kind === 'dirt') return () => false;
    return (v) => v === c(P[0]);
  }
  /** pixels of region r that touch a separator */
  function rim(r, b, isSep) {
    return r.px.filter((i) => {
      const x = i & 15, y = i >> 4;
      return D4.some(([dx, dy]) => isSep(b.p[((y + dy) & 15) * 16 + ((x + dx) & 15)]));
    });
  }
  function hairline(b, t, rng, x, y, len, col, hi, within) {
    let dx = rng() < 0.5 ? 1 : -1, dy = rng() < 0.5 ? 1 : 0;
    for (let k = 0; k < len; k++) {
      if (within && !within(x, y)) break;
      b.set(x, y, col);
      if (hi && b.get(x, y + 1) !== -1 && (!within || within(x, y + 1))) b.set(x, y + 1, t.mix(b.get(x, y + 1), hi, 0.5));
      if (rng() < 0.35) dy = dy ? 0 : (rng() < 0.5 ? 1 : -1);
      x += dx; y += dy;
      if (x < 0 || x > 15 || y < 0 || y > 15) break;
    }
  }
  /** variant v of a floor texture: kind = FLOOR kind, P = ramp, theme for moss */
  function floorVar(base, kind, P, v, seed, theme) {
    const t = tk(), b = base.clone(), rng = t.rng(seed);
    if (v === 'crack') {
      // a long crack across the cell with a branch
      const col = t.mul(P[0], 0.8), hi = P[Math.min(P.length - 1, 4)];
      let x = 0, y = 4 + Math.floor(rng() * 6);
      const pts = [];
      while (x < 16) { pts.push([x, y]); x += 1; if (rng() < 0.45) y += rng() < 0.5 ? 1 : -1; y = Math.max(1, Math.min(14, y)); }
      for (const [px, py] of pts) { b.set(px, py, col); if (py < 15) b.set(px, py + 1, t.mix(b.get(px, py + 1), hi, 0.45)); }
      const [bx, by] = pts[5 + Math.floor(rng() * 5)];
      hairline(b, t, rng, bx, by + 1, 5, col, hi);
      b.set(bx + 2, by - 2, col); b.set(bx + 3, by - 3, col);
      return b;
    }
    if (kind === 'planks') {
      const W = P.length > 5 ? P : WOOD;
      if (v === 1) {
        // knots
        for (const [x, y] of [[3 + Math.floor(rng() * 8), 1 + 4 * Math.floor(rng() * 4)]]) {
          b.set(x, y, W[1]); b.set(x + 1, y, W[1]); b.set(x - 1, y, W[2]); b.set(x + 2, y, W[2]); b.set(x, y + 1, W[2]);
        }
      } else if (v === 2) {
        // nail heads beside the seams and a worn, lighter stretch
        for (let y = 1; y < 16; y += 4) for (let x = 0; x < 16; x++) if (b.get(x, y) === W[1] && b.get(x, y + 1) === W[1] && x + 1 < 16) { b.set(x + 1, y + 1, W[0]); }
        const y = 1 + 4 * Math.floor(rng() * 4), x0 = 2 + Math.floor(rng() * 6);
        for (let x = x0; x < x0 + 6; x++) if (b.get(x, y) === W[3]) b.set(x, y, W[4]);
      } else if (v === 3) {
        const y = 2 + 4 * Math.floor(rng() * 4), x0 = 1 + Math.floor(rng() * 7);
        for (let x = x0; x < x0 + 5; x++) if (b.get(x, y) !== W[1]) b.set(x, y, W[2]);
        b.set(x0 + 5, y - 1, W[2]);
      }
      return b;
    }
    if (kind === 'dirt') {
      // a fresh speckle / pebble layout (the noise is shared, so it still tiles)
      if (theme !== 'town') { const nb = FLOOR.dirt(t, P, 1 + (seed & 0xffff)); b.p.set(nb.p); }
      if (v === 1) for (let k = 0; k < 3; k++) { const x = Math.floor(rng() * 14) + 1, y = Math.floor(rng() * 14) + 1; b.set(x, y, P[3]); b.set(x + 1, y, P[4] || P[3]); b.set(x, y + 1, P[1]); b.set(x + 1, y + 1, P[0]); }
      else if (v === 2) { const cx = 4 + rng() * 8, cy = 4 + rng() * 8; b.each((x, y, c) => (((x - cx) / 4.5) ** 2 + ((y - cy) / 3) ** 2 < 1 && (x + y) % 2 === 0 ? t.mul(c, 0.86) : undefined)); }
      else if (v === 3) { const x = 3 + Math.floor(rng() * 9), y = 3 + Math.floor(rng() * 9); b.set(x, y, P[4] || P[3]); b.set(x + 1, y - 1, P[4] || P[3]); b.set(x + 2, y, P[3]); b.set(x + 1, y, P[1]); b.set(x + 3, y + 1, P[3]); }
      return b;
    }
    const isSep = sepFor(kind, P);
    const R_ = regions(b, isSep);
    const inner = R_.list.filter((r) => !r.cross && r.px.length >= 5);
    const pickR = () => inner[Math.floor(rng() * inner.length)];
    if (v === 1 && inner.length) {
      // one or two stones a shade darker / lighter
      const n = inner.length > 3 ? 2 : 1;
      for (let q = 0; q < n; q++) {
        const r = pickR(), dark = rng() < 0.6;
        for (const i of r.px) b.p[i] = dark ? t.mix(b.p[i], P[1], 0.32) : t.mix(b.p[i], P[3], 0.35);
      }
    } else if (v === 2 && R_.list.length) {
      // chipped edges and a scuff
      const r = inner.length ? pickR() : R_.list[Math.floor(rng() * R_.list.length)];
      const edge = rim(r, b, isSep);
      for (let q = 0; q < 3 && edge.length; q++) { const i = edge[Math.floor(rng() * edge.length)]; b.p[i] = t.c(P[0]); }
      const r2 = inner.length ? pickR() : r;
      const i0 = r2.px[Math.floor(rng() * r2.px.length)], x0 = i0 & 15, y0 = i0 >> 4;
      for (let k = 0; k < 3; k++) { const x = x0 + k, y = y0 - k; if (R_.lab[(y & 15) * 16 + (x & 15)] === r2.k) b.set(x, y, P[Math.min(P.length - 1, 4)]); }
    } else if (v === 3 && FORMAL[theme] && inner.length) {
      // well-kept floors: a polished (lighter) stone with a glint instead of damage
      const r = pickR();
      for (const i of r.px) b.p[i] = t.mix(b.p[i], P[Math.min(P.length - 1, 4)], 0.3);
      const i0 = r.px[Math.floor(r.px.length / 3)];
      b.p[i0] = t.c(P[Math.min(P.length - 1, 4)]);
    } else if (v === 3) {
      if (MOSSY[theme] && rng() < 0.75) {
        // moss creeping along the grout
        const grout = [];
        for (let i = 0; i < 256; i++) if (isSep(b.p[i])) grout.push(i);
        if (grout.length) {
          const i0 = grout[Math.floor(rng() * grout.length)];
          const MOSS = [0x2c5a24, 0x3c7a2c, 0x5a9a3c];
          for (let k = 0; k < 7; k++) {
            const x = (i0 & 15) + Math.floor(rng() * 5) - 2, y = (i0 >> 4) + Math.floor(rng() * 3) - 1;
            const j = (y & 15) * 16 + (x & 15);
            if (isSep(b.p[j]) || k < 2) b.p[j] = t.c(MOSS[k % 3]);
          }
        }
      } else if (inner.length) {
        // hairline crack inside one stone
        const r = pickR(), i0 = r.px[Math.floor(r.px.length / 2)];
        hairline(b, t, rng, i0 & 15, i0 >> 4, 4 + Math.floor(rng() * 3), t.mul(P[0], 0.85), P[Math.min(P.length - 1, 4)], (x, y) => R_.lab[(y & 15) * 16 + (x & 15)] === r.k);
      }
    }
    return b;
  }
  // non-theme grounds (tiles_local): lgrass dirt sand snowfloor wood
  function groundVar(name, v, seed) {
    const t = tk(), b = A.floorBuf(name).clone(), rng = t.rng(seed);
    if (name === 'wood') return floorVar(b, 'planks', WOOD, v, seed, 'house');
    if (name === 'dirt') return floorVar(b, 'dirt', [0x5c4028, 0x806040, 0xa07c54, 0xb89468, 0xd0ae80], v, seed, 'town');
    if (name === 'lgrass') {
      const G = t.PAL.tgrass;
      if (v === 1) for (let k = 0; k < 3; k++) { const x = Math.floor(rng() * 14) + 1, y = Math.floor(rng() * 13) + 2; b.set(x, y, G[1]); b.set(x - 1, y - 1, G[2]); b.set(x + 1, y - 1, G[2]); b.set(x, y - 1, G[4]); }
      else if (v === 2) {
        const F = [[0xffffff, 0xf8e040], [0xf8e040, 0xc08010], [0xf8a0d0, 0xffffff]];
        for (let k = 0; k < 2; k++) { const x = Math.floor(rng() * 12) + 2, y = Math.floor(rng() * 12) + 2, [p, c] = F[Math.floor(rng() * 3)]; b.set(x - 1, y, p); b.set(x + 1, y, p); b.set(x, y - 1, p); b.set(x, y, c); b.set(x, y + 1, G[1]); }
      } else if (v === 3) { const x = Math.floor(rng() * 12) + 2, y = Math.floor(rng() * 12) + 2; b.set(x, y, 0xb8b4a8); b.set(x + 1, y, 0x8c887c); b.set(x, y - 1, 0xdcd8cc); b.set(x + 1, y + 1, G[1]); b.set(x, y + 1, G[1]); }
      return b;
    }
    if (name === 'sand' || name === 'snowfloor') {
      const S = name === 'sand' ? t.PAL.sand : t.PAL.snow;
      if (v === 1 || v === 3) for (let k = 0; k < (v === 1 ? 2 : 1); k++) { const x = Math.floor(rng() * 13) + 1, y = Math.floor(rng() * 13) + 1; b.set(x, y, S[1]); b.set(x + 1, y, S[2]); b.set(x, y - 1, S[4]); }
      else if (v === 2) { const y = 3 + Math.floor(rng() * 10), x0 = Math.floor(rng() * 8); for (let x = x0; x < x0 + 6; x++) b.set(x, y + ((x >> 1) & 1), S[2]); }
      return b;
    }
    return b;
  }
  const FVAR = new Map();
  /** floor Buf for a ground name ('theme:<t>' or a ground tile id) and variant (0-3 | 'alt' | 'crack'); read-only */
  A.floorVariant = function (gname, v) {
    if (!v) return A.floorBuf(gname);
    const key = gname + '|' + v;
    let b = FVAR.get(key);
    if (b) return b;
    const t = tk();
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (Math.imul(seed, 31) + key.charCodeAt(i)) | 0;
    if (gname.startsWith('theme:')) {
      const theme = TH[gname.slice(6)] ? gname.slice(6) : 'generic';
      const a = art(theme), th = a.th, P = th.fl || WOOD;
      if (v === 'alt') {
        const AP = ALT[theme] || ALT.generic;
        b = FLOOR[th.floor](t, AP);
        if (theme === 'volcano') for (let i = 0; i < 256; i++) if (b.p[i] === AP[0] && t.hash(i, 1, 33) < 0.35) b.p[i] = 0x6a1c0c;
      } else b = floorVar(a.floor, th.floor, P, v, seed, theme);
    } else if (v === 'alt' && gname === 'wood') b = FLOOR.planks(t, ALT.house);
    else b = groundVar(gname, v, seed);
    FVAR.set(key, b);
    return b;
  };
  /** grounds that have variants / can show tile_alt and crack in the floor itself */
  A.floorVaries = (gname) => gname.startsWith('theme:') || gname === 'wood' || gname === 'dirt' || gname === 'lgrass' || gname === 'sand' || gname === 'snowfloor';
  A.floorHasAlt = (gname) => gname.startsWith('theme:') || gname === 'wood';
  A.floorHasCrack = (gname) => gname.startsWith('theme:') || gname === 'wood' || gname === 'dirt';

  /** wall face (+cap when capTop) as a Buf */
  function wallFace(a, capTop) {
    const t = tk(), b = a.face.clone(), C = a.capColors;
    if (capTop) {
      for (let x = 0; x < 16; x++) {
        b.set(x, 0, C[0]); b.set(x, 1, C[2]); b.set(x, 2, (x + 1) % 4 ? C[2] : C[1]); b.set(x, 3, C[3]);
      }
      for (let x = 0; x < 16; x++) b.set(x, 4, t.mul(b.get(x, 4), 0.7));
    } else {
      for (let x = 0; x < 16; x++) b.set(x, 0, C[3]);
      for (let x = 0; x < 16; x++) b.set(x, 1, t.mul(b.get(x, 1), 0.75));
    }
    return b;
  }
  /** wall top (thick wall interior); edges {n,w,e,s}: true where the neighbour is not wall */
  function wallTop(a, e) {
    const t = tk(), b = a.top.clone(), C = a.capColors;
    const ink = C[0];
    if (e.n) b.hline(0, 15, 0, ink);
    if (e.w) b.vline(0, 0, 15, ink);
    if (e.e) b.vline(15, 0, 15, ink);
    if (e.n && !e.w) b.set(0, 1, C[3]);
    if (e.w) for (let y = e.n ? 1 : 0; y < 16; y++) b.set(1, y, C[3]);
    if (e.e) for (let y = e.n ? 1 : 0; y < 16; y++) b.set(14, y, t.mul(b.get(14, y), 0.8));
    if (e.n) for (let x = e.w ? 1 : 0; x < (e.e ? 15 : 16); x++) b.set(x, 1, C[3]);
    return b;
  }
  A.wallFace = (theme, capTop) => wallFace(art(theme), capTop);
  A.wallTop = (theme, edges) => wallTop(art(theme), edges || {});

  // ------------------------------------------------------------ torch
  function torch(b, f, x0) {
    const t = tk();
    x0 = x0 == null ? 6 : x0;
    // iron sconce
    b.rect(x0, 8, 4, 1, 0x2a2a30); b.set(x0, 7, 0x4a4a54); b.set(x0 + 3, 7, 0x2a2a30);
    b.rect(x0 + 1, 9, 2, 3, 0x3a3a44); b.set(x0 + 1, 9, 0x6a6a78);
    b.rect(x0 + 1, 5, 2, 3, 0x6c4622); b.set(x0 + 1, 5, 0x9c6632);
    // flame (2 frames) + glow on the wall
    const fl = f ? [[1, 1], [1, 2], [2, 2], [1, 3], [2, 3], [0, 3], [1, 4], [2, 4]] : [[2, 0], [1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 3]];
    for (let j = -3; j <= 3; j++) for (let i = -4; i <= 5; i++) {
      const d = Math.sqrt((i - 0.5) ** 2 + j * j);
      const x = x0 + 1 + i, y = 3 + j;
      if (d < (f ? 3.4 : 4.0) && b.get(x, y) !== t.NONE && (d < 2.2 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0xffb040, d < 2.2 ? 0.3 : 0.18));
    }
    for (const [dx, dy] of fl) b.set(x0 + dx, dy, 0xff8c20);
    const core = f ? [[1, 3], [1, 2]] : [[1, 3], [2, 2], [1, 2]];
    for (const [dx, dy] of core) b.set(x0 + dx, dy, 0xffe070);
    b.set(x0 + 1, 4, 0xfff8d0);
  }
  A.drawTorch = torch;

  // ------------------------------------------------------------ doors
  const LEAF = {
    wood: [0x2c1808, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448],
    stone: [0x4c3214, 0x7c5a30, 0xa07c48, 0xbc9a60, 0xd4b47c],
    ice: [0x284c80, 0x4878b0, 0x74a4d4, 0xa4ccec, 0xe0f4ff],
    iron: [0x1c1c24, 0x34343e, 0x4c4c58, 0x686876, 0x8c8c9a],
    shrine: [0x1c3070, 0x2c4c9c, 0x4270c4, 0x6c98e0, 0xa0c4f4],
    demon: [0x140810, 0x2c1020, 0x441830, 0x5c2444, 0x78345a],
    silver: [0x3c4050, 0x68707e, 0x9098a8, 0xbcc2d0, 0xecf0f8],
    gold: [0x5c3c08, 0x8c6414, 0xbc8c1c, 0xe0b430, 0xfff0a0],
  };
  /** draw a door onto base (a wall face Buf) with the opening starting at row top */
  function drawDoor(b, kind, top, leafName) {
    const t = tk();
    const metal = kind === 'door_silver' || kind === 'door_gold';
    const L = LEAF[kind === 'door_silver' ? 'silver' : kind === 'door_gold' ? 'gold' : leafName];
    const x0 = 2, x1 = 13, y0 = top, y1 = 15;
    // dark opening with a rounded arch
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (y === y0 && (x <= x0 + 1 || x >= x1 - 1)) continue;
      if (y === y0 + 1 && (x === x0 || x === x1)) continue;
      b.set(x, y, 0x140c08);
    }
    // stone/frame highlight around the arch
    b.set(x0 + 1, y0, t.shade(b.get(x0, y0 + 3) === t.NONE ? 0x808080 : b.get(x0 - 1, y0 + 3), 0.3));
    for (let y = y0 + 1; y <= y1; y++) for (let x = x0 + 1; x <= x1 - 1; x++) {
      if (y === y0 + 1 && (x === x0 + 1 || x === x1 - 1)) continue;
      const lx = x - x0 - 1, w = x1 - x0 - 1;
      let col = L[2];
      if (metal) {
        col = x <= 7 ? L[3] : L[2];
        if (x === 7) col = L[1];
        if (x === 8) col = L[0];
        if (lx === 0) col = L[4];
        if (lx === w - 1) col = L[1];
      } else {
        if (lx === 0) col = L[3];
        else if (lx === w - 1) col = L[1];
        else if (lx === 3 || lx === 7) col = L[1];
        else if (lx === 4 || lx === 8) col = L[3];
      }
      if (y === y0 + 1 && !metal) col = L[3];
      b.set(x, y, col);
    }
    if (metal) {
      // inset panels on each leaf
      for (const [px0, px1] of [[x0 + 2, 6], [9, x1 - 2]]) {
        const py0 = y0 + 5, py1 = y1 - 2;
        b.hline(px0, px1, py0, L[1]); b.vline(px0, py0, py1, L[1]);
        b.hline(px0, px1, py1, L[4]); b.vline(px1, py0, py1, L[4]);
      }
      // crest over the seam
      const ey = y0 + 2;
      b.set(7, ey - 1, L[4]); b.set(8, ey - 1, L[3]);
      b.rect(6, ey, 4, 2, L[3]); b.set(6, ey, L[4]); b.set(7, ey, 0xffffff); b.set(9, ey + 1, L[1]);
      b.set(7, ey + 2, L[3]); b.set(8, ey + 2, L[1]);
      // keyhole plate
      b.rect(6, y1 - 6, 4, 4, L[4]); b.vline(9, y1 - 6, y1 - 3, L[1]); b.hline(6, 9, y1 - 3, L[1]);
      b.rect(7, y1 - 5, 2, 1, 0x100808); b.set(7, y1 - 4, 0x100808);
    } else {
      for (const y of [y0 + 3, y1 - 2]) for (let x = x0 + 1; x <= x1 - 1; x++) b.set(x, y, x % 2 ? 0x3a3a44 : 0x60606e);
      b.set(x1 - 3, y0 + 7, 0xf0d070); b.set(x1 - 3, y0 + 8, 0x906820); b.set(x1 - 4, y0 + 8, 0xc09838);
    }
    b.hline(x0 + 1, x1 - 1, y1, t.mul(L[1], 0.7));
    return b;
  }
  /** door in a theme wall face; kind: 'door' | 'door_silver' | 'door_gold' */
  function door(a, kind, capTop, leafName) {
    return drawDoor(wallFace(a, capTop), kind, capTop ? 4 : 2, leafName || a.th.door);
  }
  A.drawDoor = drawDoor;
  A.doorArt = (theme, kind, capTop, leaf) => door(art(theme), kind, capTop, leaf);

  // ------------------------------------------------------------ pillars
  const COL = {
    stone: [0x3a3a44, 0x62646e, 0x8a8c98, 0xb0b2bc, 0xd6d8e0],
    marble: [0x5c6070, 0x9094a4, 0xbcc0cc, 0xdcdee6, 0xfafaff],
    wood: [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448],
    stalag: null, basalt: null,
    lotus: [0x5c3c18, 0x8c6430, 0xb48848, 0xd0a860, 0xecd090],
    ice: [0x34609a, 0x5088c0, 0x78b0dc, 0xa8d4f0, 0xf0fcff],
    spike: [0x120a18, 0x2a1c38, 0x3e2c52, 0x56406e, 0x7a5c96],
  };
  function pillar(a, fl) {
    const t = tk(), th = a.th;
    const floor = (fl || a.floor).clone();
    const L = t.buf(16, 16);
    const kind = th.col;
    if (kind === 'stalag' || kind === 'basalt') {
      const P = th.wl;
      L.poly([[3, 15.5], [5, 6], [7, 0.5], [9, 0.5], [11, 6], [13, 15.5]], P[2]);
      L.each((x, y) => (x < 7 ? (x < 5 ? P[3] : P[4]) : x > 9 ? P[1] : P[2]));
      if (kind === 'basalt') L.each((x, y, c) => ((y + (x >> 1)) % 5 === 0 ? P[1] : c));
      L.set(6, 3, P[5] || P[4]); L.set(6, 8, P[5] || P[4]);
    } else {
      const P = COL[kind] || COL.stone;
      if (kind === 'wood') {
        // square timber post with a stone footing
        L.rect(3, 12, 10, 4, 0x8a8c98); L.hline(3, 12, 12, 0xb0b2bc); L.vline(12, 12, 15, 0x62646e); L.hline(3, 12, 15, 0x62646e);
        L.rect(5, 2, 6, 10, P[3]); L.vline(5, 2, 11, P[4]); L.vline(10, 2, 11, P[1]); L.vline(8, 3, 10, P[2]);
        L.rect(4, 0, 8, 2, P[2]); L.hline(4, 11, 0, P[4]); L.vline(11, 0, 1, P[1]);
        L.set(7, 5, P[1]); L.set(7, 6, P[2]);
        L.outline(t.mul(th.wl[0], 0.8));
        floor.shadowOf(L, 2, 1, 0.65);
        floor.blit(L, 0, 0);
        return floor;
      }
      // base
      L.rect(2, 13, 12, 3, P[2]); L.hline(2, 13, 13, P[4]); L.hline(2, 13, 15, P[1]); L.vline(13, 13, 15, P[1]);
      L.rect(3, 12, 10, 1, P[3]);
      // shaft (cylinder shading)
      const ramp = [P[1], P[2], P[3], P[4], P[3], P[2], P[1], P[0]];
      for (let y = 3; y < 12; y++) for (let x = 4; x < 12; x++) L.set(x, y, ramp[Math.min(7, Math.floor(((x - 4) / 8) * 8))]);
      if (kind === 'marble' || kind === 'stone') for (let y = 4; y < 11; y++) { L.set(6, y, P[3]); L.set(9, y, P[1]); }
      if (kind === 'wood') for (let y = 3; y < 12; y += 3) L.hline(4, 11, y, P[1]);
      if (kind === 'spike') { L.set(3, 6, P[3]); L.set(12, 8, P[1]); L.set(2, 5, P[2]); L.set(13, 9, P[0]); L.set(7, 7, 0xc02030); L.set(8, 7, 0x801020); }
      if (kind === 'ice') for (let y = 4; y < 11; y += 2) L.set(5 + ((y >> 1) % 3), y, 0xffffff);
      // capital
      L.rect(2, 1, 12, 2, P[3]); L.hline(2, 13, 0, P[4]); L.hline(2, 13, 2, P[1]); L.vline(13, 0, 2, P[1]);
      if (kind === 'lotus') { L.set(4, 0, P[4]); L.set(7, 0, P[4]); L.set(10, 0, P[4]); L.hline(3, 12, 1, 0x2c4c9c); }
    }
    L.outline(t.mul(th.wl[0], 0.8));
    floor.shadowOf(L, 2, 1, 0.65);
    floor.blit(L, 0, 0);
    return floor;
  }

  // ------------------------------------------------------------ stairs
  function stairs(a, dir) {
    const t = tk(), th = a.th;
    const b = a.floor.clone();
    const S = th.wl, F = a.flPal;
    if (dir === 'up') {
      // four steps climbing away from the viewer, narrowing toward the top
      // (perspective); treads brighten upward, the top opens into shadow
      for (let y = 0; y < 16; y++) for (let x = 1; x < 15; x++) b.set(x, y, 0x0c0a0a);
      for (let i = 0; i < 4; i++) {
        const yb = 15 - i * 4, xa = 2 + Math.round(i * 0.7), xb = 13 - Math.round(i * 0.7);
        const k = i / 3;
        const tread = t.mix(S[2], S[4], k), riser = t.mix(S[1], S[3], k * 0.8);
        for (let x = xa; x <= xb; x++) {
          b.set(x, yb - 3, t.shade(tread, 0.2)); b.set(x, yb - 2, tread);
          b.set(x, yb - 1, riser); b.set(x, yb, t.mul(riser, 0.7));
        }
        b.set(xa, yb - 3, t.shade(tread, 0.45)); b.set(xa, yb - 2, t.shade(tread, 0.3));
        b.set(xb, yb - 1, t.mul(riser, 0.75)); b.set(xb, yb - 2, t.mul(tread, 0.85));
        // stringers beside each step
        for (let y = yb - 3; y <= yb; y++) {
          for (let x = 1; x < xa; x++) b.set(x, y, x === xa - 1 ? S[4] : S[3]);
          for (let x = xb + 1; x < 15; x++) b.set(x, y, x === xb + 1 ? S[0] : S[1]);
        }
      }
      for (let y = 0; y < 16; y++) { b.set(0, y, S[0]); b.set(15, y, S[0]); }
    } else {
      // opening in the floor, steps descending into darkness
      for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) b.set(x, y, 0x080608);
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const y0 = 2 + i * 3, fade = 1 - i / steps;
        const tread = t.mix(0x080608, S[3], fade * 0.9);
        for (let x = 3 + i; x < 13 - i + (i > 1 ? 0 : 0); x++) { b.set(x, y0, t.shade(tread, 0.2)); b.set(x, y0 + 1, tread); b.set(x, y0 + 2, t.mul(tread, 0.55)); }
      }
      // rim: lit bottom edge, shadowed top edge (hole seen from above)
      for (let x = 0; x < 16; x++) { b.set(x, 0, F[1]); b.set(x, 15, F[4] || F[3]); b.set(x, 1, 0x000000); }
      for (let y = 0; y < 16; y++) { b.set(0, y, F[1]); b.set(15, y, F[3]); }
    }
    return b;
  }

  // ------------------------------------------------------------ rock
  function rock(a, fl) {
    const t = tk(), th = a.th;
    const floor = (fl || a.floor).clone();
    const P = th.theme === 'ice' ? th.wl : th.wl;
    const L = t.buf(16, 16);
    const ramp = P.length > 5 ? P.slice(1) : P;
    L.shadeEllipse(8, 9, 6.5, 5.5, ramp, { dither: 0.6 });
    L.shadeEllipse(5, 11, 3.5, 3, ramp, { dither: 0.6 });
    for (let y = 14; y < 16; y++) for (let x = 0; x < 16; x++) if (y === 15) L.set(x, y, null);
    L.line(8, 6, 10, 9, ramp[0]); L.line(10, 9, 9, 12, ramp[0]); L.set(5, 7, ramp[ramp.length - 1]); L.set(6, 6, ramp[ramp.length - 1]);
    L.outline(t.mul(P[0], 0.7));
    floor.shadowOf(L, 2, 1, 0.6);
    floor.blit(L, 0, 0);
    return floor;
  }

  // ------------------------------------------------------------ register
  const THEMED = ['floor', 'wall', 'wall_torch', 'door', 'door_silver', 'door_gold', 'pillar', 'stairs_up', 'stairs_down', 'rock'];
  function make(theme, id) {
    const t = tk(), a = art(theme);
    switch (id) {
      case 'floor': return a.floor.toCanvas();
      case 'wall': return wallFace(a, true).toCanvas();
      case 'wall_torch': return t.frames(2, (f) => { const b = wallFace(a, true); torch(b, f); return b; });
      case 'door': case 'door_silver': case 'door_gold': return door(a, id, true).toCanvas();
      case 'pillar': return pillar(a).toCanvas();
      case 'stairs_up': return stairs(a, 'up').toCanvas();
      case 'stairs_down': return stairs(a, 'down').toCanvas();
      case 'rock': return rock(a).toCanvas();
    }
    return null;
  }
  A.themedTile = make;
  A.stairsArt = (theme, dir) => stairs(art(theme), dir);
  A.pillarArt = (theme, ground) => pillar(art(theme), ground ? A.floorBuf(ground) : null);
  A.rockArt = (theme, ground) => rock(art(theme), ground ? A.floorBuf(ground) : null);
  for (const id of THEMED) {
    R.Gfx.def('tile:' + id, () => make('generic', id));
    for (const theme of Object.keys(TH)) if (theme !== 'generic') R.Gfx.def('tile:' + theme + ':' + id, () => make(theme, id));
  }
  // themes added to R.DB.themes that this file does not know fall back to generic art
  for (const theme of Object.keys(R.DB.themes || {})) {
    if (TH[theme]) continue;
    for (const id of THEMED) R.Gfx.def('tile:' + theme + ':' + id, () => make('generic', id));
  }
})(window.RPG);
