// Overworld tiles and autotiling: R.Art.worldTile(map, x, y).
//
// Every world cell is drawn in two passes:
//  1. BASE — each tile maps to a ground class (sea, grass, desert, …). The class
//     of a pixel is the argmax of the ground classes blurred with a disc kernel
//     over the 3x3 neighbourhood (plus a little periodic noise), so coasts and
//     region borders come out rounded and seamless. The margin between the best
//     two classes gives distance-to-shore for foam, shallows and sand rims.
//  2. SPRITES — trees, hills, mountains, bridges, reefs and location icons are
//     sprites anchored to their cell; neighbours' sprites overflowing into this
//     cell are drawn too (y-sorted), so canopies and ranges read as one mass.
// Results are cached per neighbourhood signature, never per frame.
// Map contract: map.tileAt(x, y) → tile id (outside the map → map.outside).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  let T = null; // toolkit, bound lazily
  const tk = () => T || (T = A.TK);

  // ------------------------------------------------------------ classes
  const SEA = 0, BARRIER = 1, GRASS = 2, PLAIN = 3, DESERT = 4, SNOW = 5, SWAMP = 6, BEACH = 7, WASTE = 8, MAGMA = 9;
  const NCLS = 10;
  const DERIVED = -1;
  const TCLS = {
    sea: SEA, reef: SEA, barrier: BARRIER, grass: GRASS, plain: PLAIN, forest: GRASS, hills: DERIVED,
    mountain: DERIVED, desert: DESERT, snow: SNOW, snowforest: SNOW, swamp: SWAMP, beach: BEACH,
    wasteland: WASTE, magma: MAGMA, bridge_h: SEA, bridge_v: SEA,
  };
  const clsOf = (id) => (id in TCLS ? TCLS[id] : id && id.startsWith('loc_') ? DERIVED : GRASS);
  const isWater = (k) => k === SEA || k === BARRIER;
  // blend noise amplitude per class (how wobbly its borders are)
  const AMP = [0.16, 0.08, 0.2, 0.22, 0.22, 0.2, 0.24, 0.14, 0.22, 0.12];

  // ------------------------------------------------------ blend weights
  // For each pixel of a 20x20 area (tile ± 2 px margin) the fraction of a disc
  // (radius RAD) that falls into each of the 3x3 cells.
  const RAD = 6, MG = 2, EW = 16 + MG * 2;
  let WTS = null;
  function weights() {
    if (WTS) return WTS;
    WTS = new Float32Array(EW * EW * 9);
    const samples = [];
    for (let oy = -RAD; oy <= RAD; oy += 0.5) for (let ox = -RAD; ox <= RAD; ox += 0.5) if (ox * ox + oy * oy <= RAD * RAD) samples.push([ox, oy]);
    for (let ey = 0; ey < EW; ey++) for (let ex = 0; ex < EW; ex++) {
      const px = ex - MG + 0.5, py = ey - MG + 0.5;
      const acc = new Float32Array(9);
      for (const [ox, oy] of samples) {
        const cx = Math.floor((px + ox) / 16) + 1, cy = Math.floor((py + oy) / 16) + 1;
        acc[Math.max(0, Math.min(2, cy)) * 3 + Math.max(0, Math.min(2, cx))]++;
      }
      for (let k = 0; k < 9; k++) WTS[(ey * EW + ex) * 9 + k] = acc[k] / samples.length;
    }
    return WTS;
  }
  // periodic border noise per class (tile-local coordinates → seamless)
  let NOISE = null;
  function noise() {
    if (NOISE) return NOISE;
    const t = tk();
    NOISE = [];
    for (let k = 0; k < NCLS; k++) {
      const a = new Float32Array(256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a[y * 16 + x] = (t.fnoise(x, y, 8, 16, 101 + k * 7) - 0.5) * AMP[k];
      NOISE.push(a);
    }
    return NOISE;
  }

  /** class field for a 3x3 class array → {cls: Int8Array(EW²), margin: Float32Array(EW²), second} */
  function field(c9) {
    const W = weights(), N = noise();
    const n = EW * EW;
    const cls = new Int8Array(n), second = new Int8Array(n), margin = new Float32Array(n);
    const present = [];
    for (const k of c9) if (!present.includes(k)) present.push(k);
    if (present.length === 1) { cls.fill(present[0]); second.fill(present[0]); margin.fill(1); return { cls, second, margin, uniform: true }; }
    const v = new Float32Array(NCLS);
    for (let ey = 0; ey < EW; ey++) for (let ex = 0; ex < EW; ex++) {
      const i = ey * EW + ex, wi = i * 9;
      v.fill(-9);
      for (const k of present) v[k] = 0;
      for (let j = 0; j < 9; j++) v[c9[j]] += W[wi + j];
      const nx = (((ex - MG) % 16) + 16) % 16, ny = (((ey - MG) % 16) + 16) % 16;
      let b = -1, bv = -9, s = -1, sv = -9;
      for (const k of present) {
        const val = v[k] + N[k][ny * 16 + nx] * Math.min(1, v[k] * 4);
        if (val > bv) { s = b; sv = bv; b = k; bv = val; } else if (val > sv) { s = k; sv = val; }
      }
      cls[i] = b; second[i] = s < 0 ? b : s; margin[i] = s < 0 ? 1 : bv - sv;
    }
    return { cls, second, margin, uniform: false };
  }

  // ------------------------------------------------------------ textures
  // Seamless 16x16 textures per class (arrays of frames of Int32Array(256)).
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const t = tk(), P = t.PAL;
    const mk = (fn) => { const a = new Int32Array(256); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a[y * 16 + x] = fn(x, y); return a; };
    const nz = (x, y, cell, seed) => t.fnoise(x, y, cell, 16, seed);
    TEX = [];
    // sea: calm blue with little wavelets; highlights twinkle in staggered phases
    const G = P.grass;
    const WAVES = [[1, 2, 0], [9, 4, 2], [4, 8, 1], [12, 10, 3], [0, 13, 2], [7, 14, 0]];
    TEX[SEA] = [0, 1, 2, 3].map((f) => {
      const b = t.tile(P.sea[2]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = nz(x, y * 2, 8, 5);
        if (v < 0.3 && y % 2 === 0) b.p[y * 16 + x] = P.sea[1];
      }
      for (const [mx, my, ph] of WAVES) {
        const s = (f + ph) % 4;
        b.wset(mx, my + 1, P.sea[1]); b.wset(mx + 1, my + 1, P.sea[1]); b.wset(mx + 2, my + 1, P.sea[1]); b.wset(mx + 3, my + 1, P.sea[1]);
        if (s === 1 || s === 2) {
          const o = s === 2 ? 1 : 0;
          b.wset(mx + o, my, P.sea[3]); b.wset(mx + 1 + o, my, P.sea[4]); b.wset(mx + 2 + o, my, s === 1 ? P.sea[5] : P.sea[4]);
        } else if (s === 0) { b.wset(mx + 1, my, P.sea[3]); b.wset(mx + 2, my, P.sea[3]); }
      }
      return b.p;
    });
    // barrier: dark water with a rotating whirl per cell
    TEX[BARRIER] = [0, 1, 2, 3].map((f) => mk((x, y) => {
      const dx = x - 7.5, dy = y - 7.5, rho = Math.sqrt(dx * dx + dy * dy);
      const th = Math.atan2(dy, dx) / (Math.PI * 2);
      const s = ((th + rho / 5.5 - f / 4) % 1 + 1) % 1;
      const fade = Math.max(0, 1 - rho / 8.5);
      const arm = (s * 2) % 1;
      if (rho < 1.5) return 0x0c0414;
      if (arm < 0.22 && fade > 0.15) return fade > 0.55 ? 0xd070f0 : fade > 0.35 ? 0x9a40c8 : 0x6a2894;
      if (arm < 0.4 && fade > 0.2) return 0x4a1c6c;
      return t.bayer(x, y) < 0.4 + fade * 0.3 ? 0x2c0f44 : 0x1e0a30;
    }));
    // grass: even green with a regular scatter of small tufts
    const grass = t.tile(G[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 11);
      if (v > 0.7 && (x + y * 3) % 5 === 0) grass.p[y * 16 + x] = G[4];
      else if (v < 0.28 && (x * 3 + y) % 4 === 0) grass.p[y * 16 + x] = G[2];
    }
    for (const [x, y] of [[2, 2], [10, 1], [13, 8], [6, 7], [1, 12], [9, 13]]) {
      grass.wset(x, y + 1, G[1]); grass.wset(x + 1, y + 2, G[2]); grass.wset(x + 2, y + 1, G[1]);
      grass.wset(x + 1, y + 1, G[2]); grass.wset(x + 1, y, G[5]); grass.wset(x + 2, y, G[4]);
    }
    TEX[GRASS] = [grass.p];
    // plain: sunnier meadow, short strokes and tiny flowers
    const PL = P.plain;
    const plain = t.tile(PL[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 13);
      if (v < 0.3 && (x + y * 2) % 5 === 0) plain.p[y * 16 + x] = PL[2];
    }
    for (const [x, y] of [[3, 3], [11, 5], [7, 10], [14, 13], [1, 8]]) { plain.wset(x, y, PL[1]); plain.wset(x, y + 1, PL[2]); plain.wset(x + 1, y, PL[4]); }
    for (const [x, y, col] of [[6, 2, 0xfff4d0], [13, 9, 0xf8e070], [3, 13, 0xfff4d0]]) { plain.wset(x, y, col); plain.wset(x, y + 1, PL[1]); }
    TEX[PLAIN] = [plain.p];
    // desert: one soft dune crest per tile, fine grain
    const D = P.desert;
    TEX[DESERT] = [mk((x, y) => {
      const cy = 6 + 2.2 * Math.sin(((x + 2) * Math.PI * 2) / 16);
      const d = y - cy;
      if (d > -0.5 && d <= 0.5) return D[4];
      if (d > 0.5 && d <= 1.5) return D[2];
      if (d > 1.5 && d <= 2.5 && x % 2 === 0) return D[2];
      const h = t.hash(x, y, 17);
      if (h < 0.05) return D[2];
      if (h > 0.96) return D[4];
      return D[3];
    })];
    // snow: soft blue drifts and glints
    const S = P.snow;
    TEX[SNOW] = [mk((x, y) => {
      const v = nz(x, y, 8, 19);
      if ((x * 7 + y * 5) % 23 === 0) return S[4];
      if (v < 0.3 && (x * 3 + y) % 4 === 0) return S[2];
      if (v < 0.22 && (x + y * 3) % 5 === 0) return S[1];
      return v > 0.72 && (x + y) % 7 === 0 ? S[4] : S[3];
    })];
    // swamp: purple mire with dark pools, sheen streaks and bubbles
    const SW = P.swamp;
    const swamp = t.tile(SW[2]);
    for (const [x, y, rx, ry] of [[4, 5, 3, 1.6], [12, 12, 3.5, 1.8], [13, 3, 2, 1]]) {
      for (let j = -3; j <= 3; j++) for (let i = -5; i <= 5; i++) if ((i / (rx + 0.5)) ** 2 + (j / (ry + 0.5)) ** 2 <= 1) swamp.wset(x + i, y + j, SW[1]);
      swamp.wset(x - 1, y - 1, SW[0]); swamp.wset(x, y - 1, SW[0]);
    }
    for (const [x, y, n] of [[1, 10, 4], [8, 8, 3], [10, 1, 2], [5, 14, 3]]) for (let i = 0; i < n; i++) swamp.wset(x + i, y, SW[3]);
    for (const [x, y] of [[7, 3], [2, 13], [11, 7]]) { swamp.wset(x, y - 1, SW[4]); swamp.wset(x - 1, y, SW[4]); swamp.wset(x + 1, y, SW[3]); swamp.wset(x, y + 1, SW[1]); }
    TEX[SWAMP] = [swamp.p];
    // beach: fine sand
    const SA = P.sand;
    TEX[BEACH] = [mk((x, y) => {
      const h = t.hash(x, y, 31), v = nz(x, y, 8, 37);
      if (h < 0.06) return SA[2];
      if (h > 0.95) return SA[4];
      return v < 0.35 && t.bayer(x, y) < 0.4 ? SA[2] : SA[3];
    })];
    // wasteland: dry earth, a few cracks and pebbles
    const WA = P.waste;
    const waste = t.tex(16, 16, (x, y) => {
      const v = nz(x, y, 8, 41), h = t.hash(x, y, 43);
      if (h < 0.05) return WA[1];
      if (h > 0.96) return WA[3];
      return v < 0.3 && (x + y) % 3 === 0 ? WA[1] : WA[2];
    });
    for (const [x0, y0, x1, y1] of [[1, 3, 4, 4], [4, 4, 5, 6], [10, 11, 13, 10]]) waste.line(x0, y0, x1, y1, WA[0]);
    waste.set(5, 7, WA[1]); waste.set(13, 11, WA[1]);
    for (const [x, y] of [[12, 4], [3, 11], [8, 14]]) { waste.wset(x, y, WA[4]); waste.wset(x + 1, y, WA[3]); waste.wset(x, y + 1, WA[1]); waste.wset(x + 1, y + 1, WA[0]); }
    TEX[WASTE] = [waste.p];
    // magma: 2 frames, crust plates over glowing channels
    const MG_ = P.magma, CR = P.crust;
    TEX[MAGMA] = [0, 1].map((f) => mk((x, y) => {
      const v = nz(x, y, 8, 43), v2 = nz(x + f * 3, y - f * 2, 4, 47);
      if (v < 0.33) return v < 0.2 ? CR[1] : CR[2];
      if (v < 0.4) return CR[3];
      const heat = (v - 0.4) * 1.6 + (v2 - 0.5) * 0.5 + (f ? 0.08 : 0);
      return heat > 0.62 ? MG_[4] : heat > 0.42 ? MG_[3] : heat > 0.2 ? MG_[2] : MG_[1];
    }));
    return TEX;
  }

  // ------------------------------------------------------------ base pass
  // Shoreline & border decoration while colouring the class field.
  function basePixel(k, second, margin, x, y, f, belowCls) {
    const t = T, P = t.PAL, tx = TEX[k], fr = tx[f % tx.length], col = fr[y * 16 + x];
    if (margin >= (k === SEA ? 0.75 : 0.5) || k === second) return col;
    if (k === SEA) {
      if (second === BARRIER) return margin < 0.25 ? 0x1a2468 : col;
      if (second === MAGMA) return margin < 0.2 ? 0x604060 : col;
      // foam lapping at the shore + a lighter shallow band
      const lap = 0.07 + 0.05 * [0, 1, 2, 1][f % 4] / 2;
      if (margin < lap) return P.foam[1];
      if (margin < lap + 0.06) return (x + y + f) % 2 ? P.foam[0] : P.shallow[3];
      if (margin < 0.28) return P.shallow[2];
      if (margin < 0.42) return t.bayer(x, y) < 0.5 ? P.shallow[1] : P.shallow[2];
      if (margin < 0.56) return P.shallow[1];
      if (margin < 0.68) return t.bayer(x, y) < 0.5 ? P.shallow[0] : col;
      // a fainter wave line rolling in offshore on alternate frames
      if (margin < 0.74 && (f % 4 === 1 || f % 4 === 2) && (x + f) % 3) return P.shallow[1];
      return col;
    }
    if (k === BARRIER) return margin < 0.2 ? 0x241040 : col;
    if (k === MAGMA) return margin < 0.12 ? P.crust[0] : margin < 0.3 ? (t.bayer(x, y) < 0.6 ? P.crust[1] : P.crust[2]) : col;
    if (isWater(second)) {
      // land meeting water: sand rim, and a cliff lip where the water is below
      if (margin < 0.07) return belowCls ? P.rock[1] : P.sand[4];
      if (belowCls && margin < 0.16) return P.rock[2];
      if (k === BEACH || k === DESERT || k === SNOW) return col;
      if (margin < 0.14) return P.sand[3];
      return col;
    }
    if (second === MAGMA) return margin < 0.1 ? P.crust[1] : margin < 0.2 ? P.crust[3] : col;
    // land-land: a thin darker seam, dithered
    if (margin < 0.05) return t.mul(col, 0.82);
    if (margin < 0.1 && t.bayer(x, y) < 0.5) return t.mul(col, 0.9);
    return col;
  }

  // ------------------------------------------------------------ sprites
  // Sprite bufs cached by descriptor; each has {buf, ox, oy} relative to the cell's top-left.
  const SPR = {};
  function sprite(key, make) { return SPR[key] || (SPR[key] = make()); }

  // v: 0..3 → shape/shade variant
  function treeSprite(v) {
    return sprite('tree' + v, () => {
      const t = T, P = t.PAL, b = t.buf(11, 12), F = P.forest, tr = P.trunk;
      const ramp = v % 2 ? [F[1], F[2], F[3], F[4], F[5]] : [F[1], F[1], F[2], F[3], F[4], F[5]];
      b.rect(4, 8, 3, 3, tr[1]); b.set(4, 8, tr[2]); b.set(4, 9, tr[2]); b.set(6, 10, tr[0]);
      b.shadeEllipse(5, 4.5 + (v > 1 ? 0.3 : 0), 4.3, 4.1, ramp, { dither: 0.7, amb: 0.3 });
      // leaf clusters: bright flecks upper-left, dark notches lower-right
      b.set(3, 2, F[5]); b.set(4, 2, F[5]); b.set(2, 4, F[4]); b.set(5, 3, F[4]);
      b.set(7, 7, F[1]); b.set(8, 5, F[1]); b.set(5, 8, F[1]);
      b.outline(F[0]);
      return { buf: b, ox: -5, oy: -12 };
    });
  }
  function pineSprite(v) {
    return sprite('pine' + v, () => {
      const t = T, b = t.buf(11, 15);
      const G0 = 0x0e3024, G1 = 0x1c4c38, G2 = 0x2c6a4c, S0 = 0xa8b8d8, S1 = 0xe8f0fc, S2 = 0xffffff;
      b.rect(4, 12, 3, 3, 0x4c2e14); b.set(4, 12, 0x6c4622);
      const tiers = [[5.5, 1, 2.2], [5.5, 4, 3.6], [5.5, 7.5, 5]];
      for (const [cx, top, hw] of tiers) {
        const h = 4 + (hw > 4 ? 1 : 0);
        b.poly([[cx, top - 0.5], [cx + hw + 0.5, top + h], [cx - hw - 0.5, top + h]], G1);
        for (let y = top; y < top + h; y++) {
          for (let x = 0; x < 11; x++) {
            if (b.get(x, y) !== G1) continue;
            if (x > cx + 0.5) b.set(x, y, G0);
            else if (x < cx - 1 && (x + y) % 2 === 0) b.set(x, y, G2);
          }
        }
        // snow on the left slopes and tier rims
        for (let y = top; y < top + h; y++) {
          let first = -1;
          for (let x = 0; x < 11; x++) if (b.get(x, y) !== t.NONE) { first = x; break; }
          if (first >= 0 && first < cx) { b.set(first, y, S1); if ((y + v) % 2) b.set(first + 1, y, S2); }
        }
        const ry = top + h - 1;
        for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) if ((x + v) % 3 !== 0 && b.get(x, ry) !== t.NONE) b.set(x, ry, x > cx ? S0 : S1);
      }
      b.set(5, 0, S2); b.set(5, 1, S1);
      b.outline(0x0a1c1c);
      return { buf: b, ox: -5, oy: -15 };
    });
  }
  const HILL_COL = { [GRASS]: 'grass', [PLAIN]: 'plain', [DESERT]: 'desert', [SNOW]: 'snow', [WASTE]: 'waste', [SWAMP]: 'grass', [BEACH]: 'desert' };
  function hillSprite(k, v) {
    return sprite('hill' + k + '_' + v, () => {
      const t = T, P = t.PAL;
      const name = HILL_COL[k] || 'grass';
      const base = name === 'grass' ? P.grass : name === 'plain' ? [P.plain[0]].concat(P.plain) : [t.mul(P[name][0], 0.8)].concat(P[name]);
      const ramp = [base[1], base[2], base[3], base[4], base[5] || base[4]];
      const b = t.buf(18, 13);
      const mounds = v === 0 ? [[7.5, 9, 6.6, 7], [14, 11, 3.6, 4]] : [[9.5, 9, 6.6, 7], [3.5, 11, 3.6, 4]];
      for (const [x, y, rx, ry] of mounds.slice().reverse()) b.shadeEllipse(x, y, rx, ry, ramp, { dither: 0.5, amb: 0.1, lx: -0.8, ly: -0.5 });
      for (let y = 11; y < 13; y++) for (let x = 0; x < 18; x++) b.set(x, y, null);
      // ridge tufts
      if (name === 'grass' || name === 'plain') {
        const [mx, my] = mounds[0];
        b.set(mx - 3, my - 4, ramp[4]); b.set(mx - 2, my - 5, ramp[4]); b.set(mx + 2, my - 2, ramp[1]); b.set(mx + 3, my - 1, ramp[1]);
      }
      b.outline(base[0]);
      for (let x = 0; x < 18; x++) if (b.get(x, 11) !== t.NONE) b.set(x, 11, null);
      return { buf: b, ox: -1, oy: -12 };
    });
  }
  // mountain: rocky peak; snow 0 none, 1 cap, 2 heavy (snow region)
  function mountainSprite(k, snow, v) {
    return sprite('mtn' + k + '_' + snow + '_' + v, () => {
      const t = T, P = t.PAL;
      const cold = k === SNOW;
      const Rk = cold ? [0x283048, 0x4a5470, 0x6c7894, 0x909cb8, 0xb4c0d8, 0xd8e0f0] : k === DESERT ? [0x3c2410, 0x6c4a24, 0x94703c, 0xb89254, 0xd8b474, 0xf0d49a] : P.rock;
      const W = 20, H = 22;
      const b = t.buf(W, H);
      const px = [9, 10, 8][v], top = snow === 2 ? 1 : snow === 1 ? 2 : 5;
      const base = H - 1;
      // silhouette: two-slope peak with a shoulder
      const L = [[0, base], [2, base - 5], [px - 4, top + 6], [px - 1, top + 1], [px, top], [px + 2, top + 3], [px + 5, top + 7], [W - 3, base - 6], [W - 1, base]];
      b.poly(L, Rk[3]);
      // shading: lit left of the ridge line, shade right
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const ridge = px + (y - top) * 0.35;
        const d = x - ridge;
        let i;
        if (d > 0) i = d > 4 ? 1 : 2;
        else i = d < -6 ? 3 : d < -2 ? 4 : 3;
        const h = t.hash(x, y, 7 + v);
        if (h < 0.1) i = Math.max(1, i - 1);
        b.set(x, y, Rk[i]);
      }
      // crags: diagonal strata lines
      const crag = (x0, y0, len, dir) => { for (let i = 0; i < len; i++) if (b.get(x0 + i * dir, y0 + i) !== t.NONE) b.set(x0 + i * dir, y0 + i, Rk[1]); };
      crag(px - 3, top + 7, 4, -1); crag(px + 3, top + 6, 5, 1); crag(px - 1, top + 12, 3, -1); crag(px + 6, top + 12, 3, 1);
      for (let x = 2; x < W - 2; x++) if (b.get(x, base - 1) !== t.NONE && (x + v) % 4 === 0) b.set(x, base - 1, Rk[2]);
      // ridge highlight
      for (let y = top + 1; y < top + 8; y++) { const x = Math.round(px + (y - top) * 0.35) - 1; if (b.get(x, y) !== t.NONE) b.set(x, y, Rk[5]); }
      // snow cap
      if (snow) {
        const depth = snow === 2 ? 9 : 5;
        for (let y = top; y < top + depth + 2; y++) for (let x = 0; x < W; x++) {
          if (b.get(x, y) === t.NONE) continue;
          const jag = ((x * 3 + v) % 4) - 1.5 + (x > px ? 1 : 0);
          if (y - top < depth - Math.abs(x - px) * 0.35 + jag * 0.6) {
            const ridge = px + (y - top) * 0.35;
            b.set(x, y, x > ridge + 0.5 ? 0xb0bcd8 : t.hash(x, y, 3) < 0.15 ? 0xdce4f4 : 0xffffff);
          }
        }
      }
      b.outline(cold ? 0x141828 : 0x21150c);
      for (let x = 0; x < W; x++) if (b.get(x, H - 1) !== t.NONE) b.set(x, H - 1, null);
      return { buf: b, ox: -2, oy: 17 - H };
    });
  }

  // location icons (hand-built from primitives; base on the cell bottom)
  function iconSprite(id) {
    return sprite('icon_' + id, () => {
      const t = T, P = t.PAL, make = ICONS[id] || ICONS.loc_town;
      const r = make(t, P);
      r.buf.outline(r.ink || 0x181018);
      return r;
    });
  }
  const STONE = [0x3c3c4c, 0x686c80, 0x9498a8, 0xbcc0cc, 0xe4e6ee];
  function wallBlock(b, x, y, w, h, ramp, o) {
    o = o || {};
    b.rect(x, y, w, h, ramp[2]);
    b.vline(x, y, y + h - 1, ramp[3]);
    b.vline(x + w - 1, y, y + h - 1, ramp[1]);
    if (o.bricks) for (let j = y + 2; j < y + h; j += 2) for (let i = x + 1 + ((j >> 1) % 2); i < x + w - 1; i += 3) b.set(i, j, ramp[1]);
    if (o.top !== false) b.hline(x, x + w - 1, y, ramp[4] || ramp[3]);
  }
  function cone(b, cx, top, hw, h, ramp) {
    b.poly([[cx + 0.5, top], [cx + hw + 1, top + h], [cx - hw, top + h]], ramp[2]);
    for (let y = top; y <= top + h; y++) for (let x = cx - hw; x <= cx + hw + 1; x++) {
      if (b.get(x, y) !== ramp[2]) continue;
      if (x > cx + 0.5) b.set(x, y, ramp[1]);
      else if (x < cx - 0.5 && (x + y) % 3 === 0) b.set(x, y, ramp[3]);
    }
  }
  const ICONS = {
    loc_castle(t, P) {
      const b = t.buf(18, 21);
      // outer wall with crenels
      wallBlock(b, 1, 11, 16, 9, STONE, { bricks: true });
      for (let x = 1; x < 17; x += 2) b.set(x, 10, STONE[3]);
      // corner towers
      wallBlock(b, 0, 7, 4, 13, STONE); wallBlock(b, 14, 7, 4, 13, STONE);
      cone(b, 1, 2, 2, 5, P.red.slice(1)); cone(b, 15, 2, 2, 5, P.red.slice(1));
      // keep
      wallBlock(b, 6, 5, 6, 8, STONE, { bricks: true });
      cone(b, 8, 0, 3, 5, P.blue.slice(1));
      b.set(8, 0, P.gold[4]);
      // gate & windows
      b.rect(7, 15, 4, 5, 0x201818); b.hline(8, 9, 14, 0x201818); b.set(7, 15, STONE[2]); b.set(10, 15, STONE[2]);
      b.set(8, 8, 0x302030); b.set(9, 8, 0x302030); b.set(1, 10, 0x302030); b.set(16, 10, 0x302030);
      b.set(2, 13, 0x302030); b.set(15, 13, 0x302030);
      return { buf: b, ox: -1, oy: -5 };
    },
    loc_town(t, P) {
      const b = t.buf(16, 16);
      const WL = [0x6c5840, 0xa88e68, 0xe0cca0, 0xf8ecc8];
      const house = (x, y, w, roof) => {
        b.rect(x, y + 4, w, 4, WL[2]); b.vline(x + w - 1, y + 4, y + 7, WL[1]);
        b.set(x + 1, y + 5, 0x3a4a78); b.set(x + w - 3, y + 5, 0x3a4a78);
        b.rect(x + (w >> 1) - 1, y + 6, 2, 2, 0x4a2c14);
        b.poly([[x - 1, y + 4.5], [x + w / 2, y - 0.5], [x + w + 1, y + 4.5]], roof[2]);
        for (let yy = y; yy < y + 5; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
          if (b.get(xx, yy) !== roof[2]) continue;
          if (xx >= x + w / 2) b.set(xx, yy, roof[1]);
          if ((yy - y) % 2 === 1 && xx < x + w / 2 && (xx + yy) % 2) b.set(xx, yy, roof[3]);
        }
      };
      house(1, 1, 7, P.red.slice(1)); house(9, 2, 6, P.blue.slice(1)); house(4, 8, 8, P.red.slice(1));
      return { buf: b, ox: 0, oy: 0 };
    },
    loc_village(t, P) {
      const b = t.buf(16, 16);
      const WL = [0x5c4028, 0x8c6c44, 0xc8a878];
      const TH = [0x5c3c14, 0x8c6420, 0xb88c34, 0xe0b85c];
      const hut = (x, y, w) => {
        b.rect(x, y + 4, w, 4, WL[2]); b.vline(x + w - 1, y + 4, y + 7, WL[1]);
        b.rect(x + (w >> 1) - 1, y + 5, 2, 3, 0x3a2410);
        b.poly([[x - 1, y + 4.5], [x + w / 2, y - 0.5], [x + w + 1, y + 4.5]], TH[2]);
        for (let yy = y; yy < y + 5; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
          if (b.get(xx, yy) !== TH[2]) continue;
          if (xx >= x + w / 2) b.set(xx, yy, TH[1]);
          else if ((xx * 2 + yy) % 3 === 0) b.set(xx, yy, TH[3]);
        }
      };
      hut(1, 3, 7); hut(8, 7, 7);
      const F = P.forest;
      b.shadeEllipse(12.5, 3.5, 3, 3, [F[1], F[2], F[3], F[4]]); b.rect(12, 6, 1, 2, P.trunk[1]);
      return { buf: b, ox: 0, oy: 0 };
    },
    loc_cave(t, P) {
      const b = t.buf(18, 16), Rk = P.rock;
      b.poly([[0, 15.5], [2, 8], [6, 3], [10, 2], [14, 5], [17, 10], [18, 15.5]], Rk[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 18; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const d = x - (9 + (y - 2) * 0.2);
        b.set(x, y, d > 3 ? Rk[2] : d > 0 ? Rk[3] : d < -5 ? Rk[3] : Rk[4]);
        if (t.hash(x, y, 5) < 0.1) b.set(x, y, Rk[2]);
      }
      b.line(4, 7, 6, 5, Rk[5]); b.line(10, 3, 12, 4, Rk[5]);
      // mouth
      b.ellipse(9, 13, 3.4, 4, 0x100808); b.rect(6, 13, 7, 3, 0x100808);
      b.hline(6, 12, 8, Rk[1]); b.set(5, 10, Rk[1]); b.set(13, 10, Rk[1]);
      return { buf: b, ox: -1, oy: 0 };
    },
    loc_tower(t, P) {
      const b = t.buf(12, 25);
      const S = [0x3c3450, 0x6c6488, 0x9890b0, 0xc4bcd8, 0xe8e4f4];
      wallBlock(b, 2, 7, 8, 17, S, { bricks: true });
      wallBlock(b, 1, 5, 10, 3, S);
      for (let x = 1; x < 11; x += 2) b.set(x, 4, S[3]);
      cone(b, 5, 0, 3, 4, P.purple.slice(1));
      b.set(5, 0, 0xfff4b0);
      for (const y of [9, 14, 19]) { b.set(5, y, 0x201830); b.set(6, y, 0x201830); b.set(5, y + 1, 0x201830); b.set(6, y + 1, 0x302040); }
      b.rect(5, 21, 2, 3, 0x181020);
      return { buf: b, ox: 2, oy: -8 };
    },
    loc_shrine(t, P) {
      const b = t.buf(16, 15);
      const S = [0x505868, 0x8890a0, 0xb8c0cc, 0xe0e4ec];
      b.rect(2, 7, 12, 7, S[2]); b.vline(13, 7, 13, S[1]); b.vline(2, 7, 13, S[3]);
      b.hline(1, 14, 14, S[1]);
      const roof = [0x0c4448, 0x187078, 0x2c9ca0, 0x60c8c4];
      b.poly([[0, 7.5], [8, 1.5], [16, 7.5]], roof[2]);
      for (let y = 1; y < 8; y++) for (let x = 0; x < 16; x++) if (b.get(x, y) === roof[2] && x >= 8) b.set(x, y, roof[1]);
      b.hline(1, 14, 7, roof[0]);
      b.rect(7, 9, 2, 5, 0x1c1c28); b.set(7, 9, 0x302838);
      b.set(4, 9, 0x405070); b.set(11, 9, 0x405070);
      b.set(8, 0, P.gold[4]); b.set(8, 1, P.gold[3]);
      return { buf: b, ox: 0, oy: 1 };
    },
    loc_pyramid(t, P) {
      const b = t.buf(20, 16);
      const lit = [0xa87a30, 0xd8a848, 0xf0cc70, 0xfff0b0], dark = [0x5c3c14, 0x7c5424, 0x9c6c30];
      b.poly([[0, 15.5], [10, 0], [20, 15.5]], lit[2]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const right = x >= 10 + (y > 2 ? 0 : 1);
        let col = right ? dark[2] : lit[2];
        if (y % 3 === 1) col = right ? dark[1] : lit[1];
        b.set(x, y, col);
      }
      b.line(10, 1, 3, 12, lit[3]);
      b.vline(10, 1, 15, dark[0]);
      b.rect(9, 11, 3, 5, 0x241408); b.set(10, 10, 0x241408);
      b.set(10, 0, 0xffffff);
      return { buf: b, ox: -2, oy: 0 };
    },
    loc_volcano(t, P) {
      const b = t.buf(20, 18), Rk = [0x241410, 0x48281c, 0x6c3c28, 0x905438, 0xb07050];
      b.poly([[0, 17.5], [7, 4], [13, 4], [20, 17.5]], Rk[2]);
      for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
        if (b.get(x, y) === t.NONE) continue;
        b.set(x, y, x > 12 - (y - 4) * 0.2 ? Rk[1] : x < 8 ? Rk[3] : Rk[2]);
        if (t.hash(x, y, 9) < 0.08) b.set(x, y, Rk[1]);
      }
      // crater & lava
      b.hline(7, 12, 4, 0xffc040); b.hline(8, 11, 3, 0xff7018);
      b.line(9, 5, 8, 9, 0xf05818); b.line(8, 9, 6, 13, 0xc03810); b.set(9, 5, 0xffd060);
      b.line(12, 5, 13, 8, 0xc03810);
      // smoke
      const sm = [0x585060, 0x807888, 0xa8a0b0];
      b.shadeEllipse(10, 1.5, 2.2, 1.6, sm); b.shadeEllipse(13, 0.5, 1.6, 1.2, sm);
      return { buf: b, ox: -2, oy: -2 };
    },
    loc_demon(t, P) {
      const b = t.buf(20, 23);
      const S = [0x140c1c, 0x2c1c3c, 0x46305c, 0x62467c, 0x8466a0];
      const spire = (cx, top, h) => { b.poly([[cx + 0.5, top], [cx + 2, top + h], [cx - 1, top + h]], S[2]); b.set(cx, top + h - 2, S[3]); };
      wallBlock(b, 1, 12, 18, 10, S, { bricks: true });
      for (let x = 1; x < 19; x += 2) b.set(x, 11, S[3]);
      wallBlock(b, 0, 7, 4, 15, S); wallBlock(b, 16, 7, 4, 15, S);
      spire(1, 1, 6); spire(17, 1, 6);
      wallBlock(b, 6, 4, 8, 10, S, { bricks: true });
      spire(9, 0, 4); spire(7, 1, 3); spire(12, 1, 3);
      b.rect(8, 16, 4, 6, 0x0a0408); b.hline(9, 10, 15, 0x0a0408);
      for (const [x, y] of [[8, 7], [11, 7], [2, 10], [17, 10], [4, 15], [15, 15]]) b.set(x, y, 0xff3030);
      b.set(9, 16, 0x801010); b.set(10, 16, 0x801010);
      return { buf: b, ox: -2, oy: -7, ink: 0x08040c };
    },
    loc_temple(t, P) {
      const b = t.buf(18, 16);
      const M = [0x686878, 0x9c9cb0, 0xccd0dc, 0xf0f2f8, 0xffffff];
      b.rect(0, 13, 18, 3, M[2]); b.hline(0, 17, 13, M[3]); b.hline(1, 16, 15, M[1]);
      b.rect(1, 5, 16, 2, M[3]);
      b.poly([[0, 5.5], [9, 0.5], [18, 5.5]], P.gold[3]);
      for (let y = 0; y < 6; y++) for (let x = 9; x < 18; x++) if (b.get(x, y) === P.gold[3]) b.set(x, y, P.gold[2]);
      b.set(9, 3, 0xffffff);
      for (const x of [2, 6, 10, 14]) { b.rect(x, 7, 2, 6, M[3]); b.vline(x + 1, 7, 12, M[1]); }
      b.rect(7, 8, 3, 5, 0x6070a0); b.set(8, 9, 0xa0c0ff);
      return { buf: b, ox: -1, oy: 0 };
    },
  };

  function bridgeSprite(dir) {
    return sprite('br' + dir, () => {
      const t = T, W = T.PAL.wood;
      const b = t.buf(16, 16);
      if (dir === 'h') {
        b.rect(0, 4, 16, 8, W[3]);
        for (let x = 0; x < 16; x += 3) b.vline(x, 4, 11, W[2]);
        for (let x = 1; x < 16; x += 3) b.set(x, 5, W[4]);
        b.hline(0, 15, 3, W[1]); b.hline(0, 15, 12, W[1]); b.hline(0, 15, 13, W[0]);
        b.hline(0, 15, 2, W[4]);
        for (const x of [1, 8]) { b.rect(x, 1, 2, 3, W[2]); b.set(x, 1, W[4]); b.rect(x, 12, 2, 3, W[1]); }
      } else {
        b.rect(4, 0, 8, 16, W[3]);
        for (let y = 0; y < 16; y += 3) b.hline(4, 11, y, W[2]);
        for (let y = 1; y < 16; y += 3) b.set(5, y, W[4]);
        b.vline(3, 0, 15, W[4]); b.vline(12, 0, 15, W[1]);
        for (const y of [2, 10]) { b.rect(2, y, 2, 3, W[3]); b.rect(12, y, 2, 3, W[1]); }
      }
      return { buf: b, ox: 0, oy: 0, shadow: dir === 'h' ? [0, 2] : [2, 0] };
    });
  }

  function reefSprite(v) {
    return sprite('reef' + v, () => {
      const t = T, Rk = [0x2a2a30, 0x4c4a54, 0x72707c, 0x9a98a4, 0xc4c2cc];
      const b = t.buf(16, 16);
      const rocks = v ? [[4, 5, 3, 2.4], [11, 10, 3.4, 2.8], [5, 12, 2, 1.6]] : [[5, 9, 3.4, 2.8], [11, 5, 2.6, 2], [12, 12, 2.2, 1.8]];
      for (const [x, y, rx, ry] of rocks) b.shadeEllipse(x, y, rx, ry, Rk, { dither: 0.8 });
      b.outline(0x14141c);
      return { buf: b, ox: 0, oy: 0, foam: rocks };
    });
  }

  // ------------------------------------------------------------ neighbourhood

  function resolveClass(m, x, y) {
    const id = m.tileAt(x, y);
    let k = clsOf(id);
    // a bridge only has water under it when it spans water
    if (id === 'bridge_h' || id === 'bridge_v') {
      const a = id === 'bridge_h' ? [m.tileAt(x, y - 1), m.tileAt(x, y + 1)] : [m.tileAt(x - 1, y), m.tileAt(x + 1, y)];
      k = a.some((t) => isWater(clsOf(t))) ? SEA : DERIVED;
    }
    if (k !== DERIVED) return k;
    const cnt = new Int32Array(NCLS);
    for (let r = 1; r <= 2; r++) {
      let any = false;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const q = clsOf(m.tileAt(x + i, y + j));
        if (q >= GRASS && q !== MAGMA) { cnt[q]++; any = true; }
      }
      if (any) break;
    }
    let best = GRASS, bn = 0;
    for (let q = GRASS; q < NCLS; q++) if (cnt[q] > bn) { bn = cnt[q]; best = q; }
    return best;
  }
  /** sprite descriptor for a cell ('' = none). Variants follow a short periodic
   *  pattern (not a hash) so the number of distinct neighbourhoods stays small. */
  function descriptor(m, x, y, k) {
    const id = m.tileAt(x, y);
    switch (id) {
      case 'forest': return 'F' + ((((x + 2 * y) % 4) + 4) % 4);
      case 'snowforest': return 'S' + ((((x + y) % 2) + 2) % 2);
      case 'hills': return 'H' + k + '.' + ((((x + y) % 2) + 2) % 2);
      case 'mountain': {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && m.tileAt(x + i, y + j) === 'mountain') n++;
        const snow = k === SNOW ? 2 : n >= 8 ? 2 : n >= 6 ? 1 : 0;
        return 'M' + k + '.' + snow + '.' + ((((x + 2 * y) % 3) + 3) % 3);
      }
      case 'bridge_h': case 'bridge_v': {
        return (id === 'bridge_h' ? 'Bh' : 'Bv');
      }
      case 'reef': return 'R' + ((((x + y) % 2) + 2) % 2);
      default: return id && id.startsWith('loc_') ? 'L' + id : '';
    }
  }
  /** list of sprite placements for a cell descriptor at cell offset (cx,cy) px */
  function placements(desc, cx, cy, out) {
    if (!desc) return;
    const ch = desc[0];
    if (ch === 'F') {
      const v = +desc[1];
      const J = [[0, 0, 0, 0], [1, 0, -1, 0], [0, 1, 0, -1], [-1, 0, 1, 1]][v];
      const pts = [[4, 8, 0], [12, 8, 1], [0, 15, 2], [8, 15, 3]];
      for (const [x, y, i] of pts) {
        const s = treeSprite((i + v * 3) % 4);
        out.push({ s, x: cx + x + (i % 2 ? J[0] : J[2]) + s.ox, y: cy + y + (i < 2 ? J[1] : J[3]) + s.oy, z: cy + y });
      }
      return;
    }
    if (ch === 'S') {
      const v = +desc[1];
      for (const [x, y, i] of [[4, 8, 0], [12, 8, 1], [0, 16, 2], [8, 16, 3]]) {
        const s = pineSprite((i + v) % 2);
        out.push({ s, x: cx + x + s.ox, y: cy + y + s.oy, z: cy + y });
      }
      return;
    }
    if (ch === 'H') {
      const [k, v] = desc.slice(1).split('.').map(Number);
      const s = hillSprite(k, v);
      out.push({ s, x: cx + s.ox, y: cy + 16 + s.oy, z: cy + 14 });
      return;
    }
    if (ch === 'M') {
      const [k, snow, v] = desc.slice(1).split('.').map(Number);
      const s = mountainSprite(k, snow, v);
      out.push({ s, x: cx + s.ox, y: cy + s.oy, z: cy + 15 });
      return;
    }
    if (ch === 'B') {
      const s = bridgeSprite(desc[1]);
      out.push({ s, x: cx, y: cy, z: cy + 1, flat: true });
      return;
    }
    if (ch === 'R') {
      const s = reefSprite(+desc[1]);
      out.push({ s, x: cx, y: cy, z: cy + 2, flat: true, reef: true });
      return;
    }
    if (ch === 'L') {
      const s = iconSprite(desc.slice(1));
      out.push({ s, x: cx + s.ox, y: cy + s.oy, z: cy + 16 });
    }
  }

  // ------------------------------------------------------------ render
  const CACHE = new Map();
  /** render from a 5x5 context reader: get(i,j) → tile id for offsets -2..2 */
  function render(m, x, y) {
    tk(); textures();
    const c9 = new Int8Array(9), d9 = new Array(9);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const q = (j + 1) * 3 + (i + 1);
      c9[q] = resolveClass(m, x + i, y + j);
      d9[q] = descriptor(m, x + i, y + j, c9[q]);
    }
    const own = m.tileAt(x, y);
    const key = own + '|' + c9.join('') + '|' + d9.join(',');
    let hit = CACHE.get(key);
    if (hit) return hit;
    hit = build(own, c9, d9);
    CACHE.set(key, hit);
    return hit;
  }

  function build(own, c9, d9) {
    const t = T;
    const fld = field(c9);
    const ownCls = c9[4];
    // frames: sea animates (4), barrier (4), magma (2); land with sea pixels animates too
    let nf = 1;
    if (own === 'magma') nf = 2;
    else if (own === 'barrier') nf = 4;
    else {
      for (let ey = MG; ey < MG + 16 && nf === 1; ey++) for (let ex = MG; ex < MG + 16; ex++) if (fld.cls[ey * EW + ex] === SEA) { nf = 4; break; }
      if (own === 'reef') nf = 4;
    }
    const sprites = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) placements(d9[j * 3 + i], (i - 1) * 16, (j - 1) * 16, sprites);
    sprites.sort((a, b) => (a.flat ? 0 : 1) - (b.flat ? 0 : 1) || a.z - b.z || a.x - b.x);
    const out = [];
    for (let f = 0; f < nf; f++) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const i = (y + MG) * EW + (x + MG);
        const k = fld.cls[i];
        let belowWater = false;
        if (!isWater(k) && k !== MAGMA) {
          const b1 = fld.cls[i + EW], b2 = fld.cls[i + EW * 2];
          belowWater = isWater(b1) || isWater(b2);
        }
        // animated classes use frame f; others frame 0 (magma border static)
        const ff = k === SEA || k === BARRIER ? f : k === MAGMA ? (own === 'magma' && fld.margin[i] > 0.3 ? f : 0) : 0;
        b.p[y * 16 + x] = basePixel(k, fld.second[i], fld.margin[i], x, y, ff, belowWater);
      }
      for (const sp of sprites) {
        if (sp.reef) {
          // foam ring around the rocks, animated with the sea
          for (const [rx, ry, ax, ay] of sp.s.foam) {
            const grow = [0.6, 1.2, 1.6, 1.0][f % 4];
            for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) {
              const dx = xx / (ax + grow + 0.5), dy = yy / (ay + grow * 0.8 + 0.5);
              const d = dx * dx + dy * dy;
              if (d <= 1 && d > 0.55) b.set(sp.x + rx + xx, sp.y + ry + yy, (xx + yy + f) % 3 ? 0xffffff : 0xc8e4ff);
            }
          }
        }
        if (sp.s.shadow) b.shadowOf(sp.s.buf, sp.x + sp.s.shadow[0], sp.y + sp.s.shadow[1], 0.6);
        else if (!sp.flat) b.shadowOf(sp.s.buf, sp.x + 1, sp.y + 1, 0.72);
        b.blit(sp.s.buf, sp.x, sp.y);
      }
      out.push(b.toCanvas());
    }
    return nf === 1 ? out[0] : out;
  }

  // ------------------------------------------------------------ public
  /**
   * Canvas (or frame array) for world cell (x,y) with autotiled transitions.
   * Uses only map.tileAt(x, y) (which must return map.outside beyond the edges).
   */
  A.worldTile = function (map, x, y) { return render(map, x, y); };
  A.worldTileCacheSize = () => CACHE.size;
  A.worldTileStats = () => { const o = {}; for (const k of CACHE.keys()) { const id = k.split('|')[0]; o[id] = (o[id] || 0) + 1; } return o; };

  // Standalone 'tile:<id>' for world tiles: the tile in a neutral neighbourhood.
  const WORLD_IDS = ['sea', 'reef', 'barrier', 'grass', 'plain', 'forest', 'hills', 'mountain', 'desert', 'snow', 'snowforest',
    'swamp', 'beach', 'wasteland', 'magma', 'bridge_h', 'bridge_v', 'loc_castle', 'loc_town', 'loc_village', 'loc_cave',
    'loc_tower', 'loc_shrine', 'loc_pyramid', 'loc_volcano', 'loc_demon', 'loc_temple'];
  function neighbourhoodFor(id) {
    // what surrounds the tile in its contact-sheet / fallback rendering
    const around = id.startsWith('loc_') || id === 'hills' || id === 'mountain' ? 'grass' : id;
    return {
      outside: 'sea',
      tileAt(x, y) {
        if (x === 0 && y === 0) return id;
        if (id === 'bridge_h') return y === 0 ? 'bridge_h' : 'sea';
        if (id === 'bridge_v') return x === 0 ? 'bridge_v' : 'sea';
        if (id === 'reef') return 'sea';
        return around;
      },
    };
  }
  // (animated only when the tile data says so: e.g. a lone reef is a still picture)
  for (const id of WORLD_IDS) {
    R.Gfx.def('tile:' + id, () => {
      const g = render(neighbourhoodFor(id), 0, 0);
      const anim = R.DB.tiles[id] && R.DB.tiles[id].anim;
      return Array.isArray(g) && !anim ? g[0] : g;
    });
  }
})(window.RPG);
