// Overworld tiles (RS1 look) and autotiling: R.Art.worldTile(map, x, y). Owner: A16a.
//
// Every world cell is drawn in layers:
//  1. GROUND — each tile maps to a ground class (sea, grass, desert, marsh, …).
//     The class of a pixel is the argmax of the classes blurred with a disc
//     kernel over the 3x3 neighbourhood (plus periodic noise), so coasts and
//     region borders come out rounded and seamless. The margin between the best
//     two classes drives foam, shallows, sand rims and rocky shores.
//  2. OVERLAYS — rivers (9 px channels along the cell links, banks and reeds),
//     roads (6 px packed earth joining roads, bridges and location icons).
//  3. SPRITES — forest crowns, pines, palms, dead trees, hills, mountain ridges,
//     cliffs, ruins, bridges, reefs and location icons, anchored to their cell;
//     neighbours' sprites overflowing into this cell are drawn too (y-sorted),
//     so canopies and ranges read as one mass.
//  4. WEATHER — sea fog (8 entries: 4 images every 32 frames), sandstorm
//     streaks and haze, marsh fog bands. Their strength is a spatial weight
//     from the same disc kernel, so they fade across cell borders.
// Results are cached per neighbourhood signature (never per frame or position).
// Map contract: map.tileAt(x, y) → tile id (outside the map → map.outside);
// map.id is used for found hidden passages (R.Game.secrets['<map>:<x>,<y>']).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  let T = null; // toolkit, bound lazily
  const tk = () => T || (T = A.TK);

  // ------------------------------------------------------------ palette (§11.2.2)
  // The world keeps its own copy of the RS1 ramps so it never depends on how
  // the shared R.Art.TK.PAL is tuned for towns (§11.14-2: "ワールドの値は変えない").
  const WP = {
    grass: [0x223a18, 0x30501f, 0x406628, 0x547a34, 0x6c8e44, 0x8ca45e],
    plain: [0x4c5428, 0x646c34, 0x7c8442, 0x949a54, 0xacae6c],
    forest: [0x0e1a10, 0x162a16, 0x20381e, 0x2c4a26, 0x3c5e30, 0x587642],
    trunk: [0x281a0e, 0x40291a, 0x5a3c26],
    sea: [0x0e1a36, 0x152648, 0x1d3458, 0x28466c, 0x3c5e86, 0x6a88a8],
    shallow: [0x24425e, 0x305670, 0x466e86, 0x6c8ea0],
    foam: [0xb4c4cc, 0xe0e8ec],
    sand: [0x9a8458, 0xb49c6c, 0xc8b282, 0xdac49a, 0xe8d8b8],
    desert: [0x8c6c40, 0xa4824e, 0xb89860, 0xc8aa74, 0xd8be8e],
    snow: [0x6a7488, 0x8a94a8, 0xaab2c2, 0xcad0da, 0xe8ecf0],
    swamp: [0x281c30, 0x3a2a44, 0x4c3a56, 0x5e4c68, 0x76627e],
    waste: [0x4c3c2e, 0x645040, 0x7c6652, 0x947c66, 0xac947e],
    rock: [0x2a2018, 0x44382a, 0x5e4e3a, 0x7a684e, 0x968466, 0xb2a082],
    grey: [0x2a2a2e, 0x46464e, 0x66666e, 0x88888e, 0xaaaab0, 0xd0d0d4],
    marsh: [0x1c2418, 0x2a3422, 0x3a462c, 0x4c5838, 0x606c48, 0x7a8660],
    marshwater: [0x28343a, 0x364650, 0x4a5c64, 0x60747a],
    ash: [0x2a2624, 0x3c3634, 0x504846, 0x665c58, 0x7e746c, 0x988e84],
    road: [0x5a4630, 0x745c40, 0x8e7452, 0xa68c68],
    jungle: [0x0e2414, 0x16361c, 0x204a26, 0x2e6030, 0x42783a, 0x60904c],
    fog: [0xb8bcc8, 0xd0d4dc, 0xe4e6ec, 0xf4f4f8],
    // derived ramps (same −25–35 % saturation / −5–10 % value as the table)
    pine: [0x0c1a16, 0x162a22, 0x223c30, 0x2e4e3e],
    rockCold: [0x262c3a, 0x3e4658, 0x5a6376, 0x7a8294, 0x9aa1b0, 0xbcc1cc],
    rockSand: [0x3a2a1a, 0x5a4428, 0x78603e, 0x947c56, 0xae9870, 0xc8b48e],
    rockAsh: [0x1a1818, 0x2c2826, 0x403a38, 0x564e4a, 0x6c6460, 0x86807a],
    deadwood: [0x241e18, 0x3a3228, 0x524638, 0x6c5e4c],
    reed: [0x1e2a14, 0x34421e, 0x4e5c2a, 0x6c7640],
    haze: 0xe4d6b4,
    ember: [0x8a2a14, 0xc4562a],
  };
  A.WORLD_PAL = WP;

  // ------------------------------------------------------------ classes
  const SEA = 0, BARRIER = 1, GRASS = 2, PLAIN = 3, DESERT = 4, SNOW = 5, SWAMP = 6, BEACH = 7, WASTE = 8,
    MAGMA = 9, MARSH = 10, ASH = 11, FOG = 12;
  const NCLS = 13;
  // derived ground: takes the most common land class within 2 cells (default when none)
  const DER = (def) => -2 - def;
  const isDer = (v) => v < 0;
  const derDef = (v) => -2 - v;
  const TCLS = {
    sea: SEA, reef: SEA, barrier: BARRIER, fog: FOG,
    grass: GRASS, plain: PLAIN, desert: DESERT, sandstorm: DESERT, snow: SNOW, swamp: SWAMP, beach: BEACH,
    wasteland: WASTE, magma: MAGMA, marsh: MARSH, marsh_fog: MARSH, ash: ASH,
    forest: DER(GRASS), secret_forest: DER(GRASS), jungle: DER(GRASS), snowforest: DER(SNOW), deadforest: DER(MARSH),
    hills: DER(GRASS), mountain: DER(GRASS), secret_rock: DER(GRASS), cliff: DER(GRASS), ruins: DER(GRASS),
    road: DER(GRASS), river: DER(GRASS), bridge_h: DER(GRASS), bridge_v: DER(GRASS),
  };
  const clsOf = (id) => (id in TCLS ? TCLS[id] : id && id.startsWith('loc_') ? DER(GRASS) : GRASS);
  const isWater = (k) => k === SEA || k === BARRIER || k === FOG;
  const isLand = (k) => k >= GRASS && k !== MAGMA && k !== FOG;
  // blend noise amplitude per class (how wobbly its borders are)
  const AMP = [0.16, 0.08, 0.2, 0.22, 0.22, 0.2, 0.24, 0.14, 0.22, 0.12, 0.26, 0.22, 0.3];
  const TREES = new Set(['forest', 'secret_forest', 'jungle', 'deadforest', 'snowforest']);
  const forestLike = (id) => id === 'forest' || id === 'secret_forest';
  const mountainLike = (id) => id === 'mountain' || id === 'secret_rock';
  const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up right down left (bit 1 2 4 8)

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

  /** class field for a 3x3 class array → {cls, second, margin} over EW×EW */
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
  /** spatial weight (0..1) of the cells flagged in mask9, per extended pixel */
  function effWeight(mask9) {
    const W = weights(), out = new Float32Array(EW * EW);
    for (let i = 0; i < EW * EW; i++) { let s = 0; for (let j = 0; j < 9; j++) if (mask9[j]) s += W[i * 9 + j] * (+mask9[j]); out[i] = s; }
    return out;
  }

  // ------------------------------------------------------------ textures
  // Seamless 16x16 textures per class (arrays of frames of Int32Array(256)).
  let TEX = null;
  function textures() {
    if (TEX) return TEX;
    const t = tk(), P = t.PAL;
    const mk = (fn) => { const a = new Int32Array(256); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a[y * 16 + x] = fn(x, y); return a; };
    const nz = (x, y, cell, seed) => t.fnoise(x, y, cell, 16, seed);
    const dith = (x, y, amt) => t.bayer(x, y) < amt;
    TEX = [];
    // sea: deep navy with broad dithered swells (ripple marks are per-cell decorations)
    const SE = WP.sea;
    const seaBase = t.tile(SE[2]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y * 2, 8, 5);
      if (v < 0.38 && dith(x, y, (0.38 - v) * 5)) seaBase.p[y * 16 + x] = SE[1];
      else if (v > 0.7 && dith(x, y, (v - 0.7) * 2.5)) seaBase.p[y * 16 + x] = SE[3];
    }
    TEX[SEA] = [seaBase.p];
    // barrier (Crest, unused here): dark water with a rotating whirl per cell
    TEX[BARRIER] = [0, 1, 2, 3].map((f) => mk((x, y) => {
      const dx = x - 7.5, dy = y - 7.5, rho = Math.sqrt(dx * dx + dy * dy);
      const th = Math.atan2(dy, dx) / (Math.PI * 2);
      const s = ((th + rho / 5.5 - f / 4) % 1 + 1) % 1;
      const fade = Math.max(0, 1 - rho / 8.5), arm = (s * 2) % 1;
      if (rho < 1.5) return 0x0c0414;
      if (arm < 0.22 && fade > 0.15) return fade > 0.55 ? 0xb07ac8 : fade > 0.35 ? 0x80509e : 0x5a3474;
      if (arm < 0.4 && fade > 0.2) return 0x3e2456;
      return t.bayer(x, y) < 0.4 + fade * 0.3 ? 0x28163a : 0x1c1028;
    }));
    // grass: even muted green with soft dithered patches (tufts are decorations)
    const G = WP.grass;
    const grass = t.tile(G[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 11);
      if (v > 0.64 && dith(x, y, (v - 0.64) * 3)) grass.p[y * 16 + x] = G[4];
      else if (v < 0.34 && dith(x, y, (0.34 - v) * 3)) grass.p[y * 16 + x] = G[2];
    }
    TEX[GRASS] = [grass.p];
    // plain: dry meadow
    const PL = WP.plain;
    const plain = t.tile(PL[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 13);
      if (v < 0.34 && (x + y * 2) % 4 === 0) plain.p[y * 16 + x] = PL[2];
      else if (v > 0.7 && dith(x, y, (v - 0.7) * 2)) plain.p[y * 16 + x] = PL[4];
    }
    TEX[PLAIN] = [plain.p];
    // desert: two soft dune crests per tile (one long, one short), lit edge dithered, fine grain
    const D = WP.desert;
    TEX[DESERT] = [mk((x, y) => {
      const c1 = 4 + 1.8 * Math.sin(((x + 2) * Math.PI * 2) / 16), c2 = 11.5 + 1.2 * Math.sin(((x + 9) * Math.PI * 4) / 16);
      const on2 = Math.sin(((x + 5) * Math.PI * 2) / 16) > -0.2; // the short crest fades out part of the way
      for (const [cy, on] of [[c1, true], [c2, on2]]) {
        if (!on) continue;
        const d = y - cy;
        if (d > -0.5 && d <= 0.5) return t.bayer(x, y) < 0.7 ? D[4] : D[3];
        if (d > 0.5 && d <= 1.5) return t.bayer(x, y) < 0.6 ? D[2] : D[3];
      }
      const h = t.hash(x, y, 17);
      if (h < 0.05) return D[2];
      if (h > 0.96) return D[4];
      return D[3];
    })];
    // snow: blue-grey drifts
    const S = WP.snow;
    TEX[SNOW] = [mk((x, y) => {
      const v = nz(x, y, 8, 19);
      if (v < 0.3 && (x * 3 + y) % 4 === 0) return S[2];
      if (v < 0.22 && dith(x, y, 0.4)) return S[2];
      return v > 0.72 && (x + y) % 8 === 0 ? S[4] : S[3];
    })];
    // swamp (poison mire): muted violet with dark pools, sheen and bubbles
    const SW = WP.swamp;
    const swamp = t.tile(SW[2]);
    for (const [x, y, rx, ry] of [[4, 5, 3, 1.6], [12, 12, 3.5, 1.8], [13, 3, 2, 1]]) {
      for (let j = -3; j <= 3; j++) for (let i = -5; i <= 5; i++) if ((i / (rx + 0.5)) ** 2 + (j / (ry + 0.5)) ** 2 <= 1) swamp.wset(x + i, y + j, SW[1]);
      swamp.wset(x - 1, y - 1, SW[0]); swamp.wset(x, y - 1, SW[0]);
    }
    for (const [x, y, n] of [[1, 10, 4], [8, 8, 3], [10, 1, 2], [5, 14, 3]]) for (let i = 0; i < n; i++) swamp.wset(x + i, y, SW[3]);
    for (const [x, y] of [[7, 3], [2, 13], [11, 7]]) { swamp.wset(x, y - 1, SW[4]); swamp.wset(x - 1, y, SW[4]); swamp.wset(x + 1, y, SW[3]); swamp.wset(x, y + 1, SW[1]); }
    TEX[SWAMP] = [swamp.p];
    // beach: fine sand
    const SA = WP.sand;
    TEX[BEACH] = [mk((x, y) => {
      const h = t.hash(x, y, 31), v = nz(x, y, 8, 37);
      if (h < 0.06) return SA[2];
      if (h > 0.95) return SA[4];
      return v < 0.35 && t.bayer(x, y) < 0.4 ? SA[2] : SA[3];
    })];
    // wasteland: dry earth
    const WA = WP.waste;
    TEX[WASTE] = [mk((x, y) => {
      const v = nz(x, y, 8, 41), h = t.hash(x, y, 43);
      if (h < 0.05) return WA[1];
      if (h > 0.96) return WA[3];
      return v < 0.3 && (x + y) % 4 === 0 ? WA[1] : WA[2];
    })];
    // magma: 2 frames, crust plates over glowing channels (colours unchanged, §11.2.2)
    const MGM = P.magma, CR = P.crust;
    TEX[MAGMA] = [0, 1].map((f) => mk((x, y) => {
      const v = nz(x, y, 8, 43), v2 = nz(x + f * 3, y - f * 2, 4, 47);
      if (v < 0.33) return v < 0.2 ? CR[1] : CR[2];
      if (v < 0.4) return CR[3];
      const heat = (v - 0.4) * 1.6 + (v2 - 0.5) * 0.5 + (f ? 0.08 : 0);
      return heat > 0.62 ? MGM[4] : heat > 0.42 ? MGM[3] : heat > 0.2 ? MGM[2] : MGM[1];
    }));
    // marsh: mossy ground (puddles and reeds are decorations)
    const MA = WP.marsh, MW = WP.marshwater;
    const marsh = t.tile(MA[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 53);
      if (v < 0.36 && dith(x, y, (0.36 - v) * 3)) marsh.p[y * 16 + x] = MA[2];
      else if (v > 0.7 && dith(x, y, (v - 0.7) * 2)) marsh.p[y * 16 + x] = MA[4];
    }
    TEX[MARSH] = [marsh.p];
    // ash: grey flats (cracks, chips and embers are decorations)
    const AS = WP.ash;
    const ash = t.tile(AS[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = nz(x, y, 8, 61);
      if (v < 0.36 && dith(x, y, (0.36 - v) * 4)) ash.p[y * 16 + x] = AS[2];
      else if (v > 0.7 && dith(x, y, (v - 0.7) * 3)) ash.p[y * 16 + x] = AS[4];
    }
    TEX[ASH] = [ash.p];
    decorations(t, nz);
    // fog: the sea underneath (the fog itself is a weather layer)
    TEX[FOG] = TEX[SEA];
    return TEX;
  }
  // Per-cell decorations over the seamless base (4 variants picked by position,
  // every feature inside the cell so neighbouring variants still join):
  // DECO[class][variant] → frames of Int32Array(256), -1 = no decoration.
  let DECO = null;
  const vOf = (x, y) => (x * 3 + y * 5 + ((((x >> 1) + (y >> 1)) & 1) << 1)) & 3;
  function decorations(t, nz) {
    DECO = [];
    const blank = () => new Int32Array(256).fill(-1);
    const put = (a, x, y, c) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) a[y * 16 + x] = c; };
    const make = (n, fn) => [0, 1, 2, 3].map((v) => { const fr = []; for (let f = 0; f < n; f++) { const a = blank(); fn(a, v, f); fr.push(a); } return fr; });
    // sea: short ripple marks that glint in turn (4 frames)
    const SE = WP.sea;
    const RIP = [[[2, 3, 0], [9, 6, 2], [5, 11, 1]], [[8, 2, 1], [2, 8, 3], [10, 12, 0]], [[4, 5, 2], [11, 9, 1], [3, 13, 3]], [[10, 3, 3], [6, 8, 0], [12, 13, 2]]];
    DECO[SEA] = make(4, (a, v, f) => {
      for (const [mx, my, ph] of RIP[v]) {
        const st = (f + ph) % 4;
        for (let k = 0; k < 3; k++) put(a, mx + k, my + 1, SE[1]);
        if (st === 1) { put(a, mx, my, SE[3]); put(a, mx + 1, my, SE[4]); put(a, mx + 2, my, SE[3]); }
        else if (st === 2) { put(a, mx + 1, my, SE[3]); put(a, mx + 2, my, SE[4]); put(a, mx + 3, my, SE[3]); }
        else if (st === 3) put(a, mx + 2, my, SE[3]);
      }
    });
    DECO[FOG] = DECO[SEA];
    // grass: small tufts and dark specks
    const G = WP.grass;
    const TUFT = [[[2, 3], [11, 6], [6, 12]], [[9, 2], [3, 9], [12, 12]], [[5, 5], [12, 10]], [[7, 8]]];
    const SPECK = [[[13, 2], [8, 9]], [[6, 5], [1, 13]], [[2, 11], [13, 3]], [[3, 3], [12, 4], [10, 13]]];
    DECO[GRASS] = make(1, (a, v) => {
      for (const [x, y] of TUFT[v]) { put(a, x, y + 1, G[2]); put(a, x + 2, y + 1, G[2]); put(a, x + 1, y, G[4]); }
      for (const [x, y] of SPECK[v]) put(a, x, y, G[2]);
      if (v === 2) { put(a, 9, 13, 0xc8c29c); put(a, 9, 14, G[2]); }
    });
    // plain: short strokes and a few pale flowers
    const PL = WP.plain;
    const STROKE = [[[3, 3], [11, 5], [7, 10]], [[10, 2], [2, 8], [12, 12]], [[5, 6], [13, 9]], [[8, 4], [3, 13], [12, 11]]];
    const FLOWER = [[[6, 1]], [[7, 12]], [[2, 12], [10, 3]], []];
    DECO[PLAIN] = make(1, (a, v) => {
      for (const [x, y] of STROKE[v]) { put(a, x, y, PL[2]); put(a, x, y + 1, PL[2]); put(a, x + 1, y, PL[4]); }
      FLOWER[v].forEach(([x, y], i) => { put(a, x, y, i ? 0xb8a868 : 0xc8c29c); put(a, x, y + 1, PL[2]); });
    });
    // marsh: murky puddles and reed tufts
    const MA = WP.marsh, MW = WP.marshwater;
    const PUD = [[[5, 5, 3.2, 1.4, 0.25]], [[10, 10, 3.6, 1.6, -0.2]], [[4.5, 11, 2.2, 1.1, 0.1], [11, 4, 2.4, 1.1, -0.3]], []];
    const REED = [[[10, 11]], [[3, 6]], [[8, 8]], [[4, 4], [11, 12]]];
    DECO[MARSH] = make(1, (a, v) => {
      for (const [cx, cy, rx, ry, rot] of PUD[v]) {
        for (let j = -3; j <= 3; j++) for (let i = -5; i <= 5; i++) {
          const u = i * Math.cos(rot) + j * Math.sin(rot), w = -i * Math.sin(rot) + j * Math.cos(rot);
          const d = (u / (rx + 0.5)) ** 2 + (w / (ry + 0.5)) ** 2 + (t.hash(i + 9, j + 9, 7 + v) - 0.5) * 0.25;
          if (d <= 1) put(a, Math.round(cx + i), Math.round(cy + j), d < 0.5 ? MW[1] : MW[2]);
        }
        put(a, Math.round(cx - 1), Math.round(cy - 1), MW[3]);
      }
      for (const [x, y] of REED[v]) {
        for (const [dx, h] of [[0, 2], [1, 3], [2, 2]]) for (let k = 0; k < h; k++) put(a, x + dx, y - k, k === h - 1 ? MA[5] : MA[4]);
        put(a, x + 1, y + 1, MA[1]);
      }
    });
    // ash: hair-line cracks, black rock chips, ember dots
    const AS = WP.ash, EM = WP.ember;
    const CRK = [[[9, 10, 13, 12]], [[2, 2, 5, 4], [5, 4, 6, 7]], [[6, 12, 11, 13]], [[3, 9, 6, 11], [10, 3, 13, 2]]];
    const CHIP = [[[3, 10], [12, 6]], [[7, 3]], [[11, 11], [4, 4]], [[13, 7]]];
    const EMB = [[[6, 7]], [[10, 12], [3, 5]], [], [[8, 8]]];
    DECO[ASH] = make(1, (a, v) => {
      for (const [x0, y0, x1, y1] of CRK[v]) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) put(a, Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), AS[1]); }
      for (const [x, y] of CHIP[v]) { put(a, x, y, 0x161414); put(a, x + 1, y, 0x221e1c); put(a, x, y - 1, AS[4]); put(a, x + 1, y + 1, AS[1]); }
      EMB[v].forEach(([x, y], i) => put(a, x, y, EM[i & 1]));
    });
    // wasteland: pebbles and cracks
    const WA = WP.waste;
    DECO[WASTE] = make(1, (a, v) => {
      for (const [x0, y0, x1, y1] of CRK[(v + 1) & 3]) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) put(a, Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), WA[0]); }
      for (const [x, y] of CHIP[(v + 2) & 3]) { put(a, x, y, WA[4]); put(a, x + 1, y, WA[3]); put(a, x, y + 1, WA[1]); put(a, x + 1, y + 1, WA[0]); }
    });
    // snow: glints and small drift shadows
    const S = WP.snow;
    DECO[SNOW] = make(1, (a, v) => {
      for (const [x, y] of SPECK[v]) put(a, x, y, S[4]);
      for (const [x, y] of TUFT[(v + 1) & 3]) { put(a, x, y + 1, S[2]); put(a, x + 1, y + 1, S[2]); put(a, x + 2, y, S[4]); }
    });
    // desert and beach: a few darker grains / shells
    const D = WP.desert, SA = WP.sand;
    DECO[DESERT] = make(1, (a, v) => { for (const [x, y] of SPECK[v]) { put(a, x, y, D[1]); put(a, x + 1, y, D[2]); } });
    DECO[BEACH] = make(1, (a, v) => { for (const [x, y] of SPECK[(v + 2) & 3]) { put(a, x, y, SA[4]); put(a, x, y + 1, SA[1]); } });
  }
  // tile-periodic helper fields
  let PER = null;
  function periodic() {
    if (PER) return PER;
    const t = tk();
    const f = (seed, cell) => { const a = new Float32Array(256); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) a[y * 16 + x] = t.fnoise(x, y, cell, 16, seed); return a; };
    PER = { foam: f(77, 4), wob: f(83, 8), reed: f(89, 4) };
    /** wrapped soft blobs [cx, cy, rx, ry] → 0..1 field, shifted east by dx */
    const blobs = (list, dx) => {
      const a = new Float32Array(256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let v = 0;
        for (const [cx, cy, rx, ry] of list) {
          let ddx = x + 0.5 - cx - dx, ddy = y + 0.5 - cy;
          ddx -= Math.round(ddx / 16) * 16; ddy -= Math.round(ddy / 16) * 16;
          v = Math.max(v, 1 - (ddx / rx) ** 2 - (ddy / ry) ** 2);
        }
        a[y * 16 + x] = Math.max(0, v);
      }
      return a;
    };
    // sea fog: puffs drifting east 4 px per image (4 images loop in 16 px)
    const FOG_BLOBS = [[3, 4, 6.5, 4.6], [11.5, 2.5, 5.5, 4], [8, 10.5, 7, 4.6], [14.5, 12.5, 5, 3.6], [1.5, 13.5, 4.2, 3]];
    PER.fog = [0, 1, 2, 3].map((F) => blobs(FOG_BLOBS, 4 * F));
    // sandstorm: slanted streaks (1 px down every 3 px) blowing east, 4 px per image
    const STREAKS = [[1, 2, 7], [9, 7, 6], [4, 11, 8], [12, 14, 5]];
    PER.sand = [0, 1, 2, 3].map((F) => {
      const a = new Uint8Array(256);
      for (const [x0, y0, len] of STREAKS) for (let k = 0; k < len; k++) {
        const x = (((x0 + k + 4 * F) % 16) + 16) % 16, y = (y0 + Math.floor(k / 3)) % 16;
        a[y * 16 + x] = k >= len - 2 ? 2 : 1; // bright head at the leading (east) end
      }
      return a;
    });
    return PER;
  }

  // ------------------------------------------------------------ sprites
  // Sprite bufs cached by descriptor; each has {buf, ox, oy} relative to its anchor.
  const SPR = {};
  function sprite(key, make) { return SPR[key] || (SPR[key] = make()); }
  function outlineBottomless(b, col) { b.outline(col); for (let x = 0; x < b.w; x++) if (b.get(x, b.h - 1) !== T.NONE && b.get(x, b.h - 2) === T.NONE) b.set(x, b.h - 1, null); }

  // --- forest: round crowns (radius 5.5) in a rotated square lattice, 5 per cell
  const CROWNS = [[2, 2], [5, 11], [8, 5], [12, 14], [15, 8]];
  const CROWN_JIT = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 1, -1, 0, 0, -1, 1, 1], [0, 1, -1, 0, 1, -1, 1, 0, -1, 0], [-1, 0, 1, 1, 0, 1, -1, 0, 0, -1]];
  function crownSprite(v, tone) {
    return sprite('crown' + v + tone, () => {
      const t = T, F = WP.forest, b = t.buf(13, 12);
      let ramp = [F[1], F[2], F[3], F[4], F[5]];
      if (tone === 1) ramp = ramp.map((c) => t.mix(c, 0x747a3a, 0.3)); // 色むら (hidden passage)
      if (tone === 2) ramp = [F[1], F[2], F[3], F[4], t.mix(F[4], F[5], 0.5)];
      const rx = v % 2 ? 5.4 : 5.8, ry = v > 1 ? 5.0 : 5.3;
      b.shadeEllipse(6, 5.6, rx, ry, ramp, { dither: 0.7, amb: 0.25, lx: -0.7, ly: -0.8 });
      // leaf clusters: bright flecks upper-left, dark notches lower-right
      const L = ramp[4], M = ramp[3], Dk = ramp[0];
      for (const [x, y, c] of [[3, 2, L], [4, 2, L], [2, 4, M], [5, 3, L], [7, 2, M], [3, 6, M]]) if (b.get(x, y) !== t.NONE) b.set(x, y, c);
      for (const [x, y] of [[8, 8], [9, 6], [6, 9], [10, 8], [4, 9]]) if (b.get(x, y) !== t.NONE) b.set(x + (v & 1), y, Dk);
      b.outline(F[0]);
      return { buf: b, ox: -6, oy: -6 };
    });
  }
  function trunkSprite(v) {
    return sprite('trunk' + v, () => {
      const t = T, tr = WP.trunk, b = t.buf(3, 5);
      b.rect(0, 0, 3, 5, tr[1]); b.vline(0, 0, 4, tr[2]); b.vline(2, 1, 4, tr[0]);
      if (v) b.set(1, 2, tr[0]);
      b.outline(WP.forest[0]);
      return { buf: b, ox: -2, oy: -1, noShadow: true };
    });
  }
  function groundShadow(w) {
    return sprite('gsh' + w, () => {
      const t = T, b = t.buf(w * 2 + 3, 4);
      b.ellipse(w + 1, 1.5, w, 1.4, 0x000000);
      return { buf: b, ox: -w - 1, oy: -1, shadowOnly: 0.68 };
    });
  }
  // --- snow forest: pointed conifers with 2 px of snow on the crown
  function pineSprite(v) {
    return sprite('pine' + v, () => {
      const t = T, b = t.buf(11, 15), PN = WP.pine, SN = WP.snow;
      const G0 = PN[1], G1 = PN[2], G2 = PN[3];
      b.rect(4, 12, 3, 3, WP.trunk[1]); b.set(4, 12, WP.trunk[2]);
      const tiers = [[5.5, 1, 2.2], [5.5, 4, 3.6], [5.5, 7.5, 5]];
      for (const [cx, top, hw] of tiers) {
        const h = 4 + (hw > 4 ? 1 : 0);
        b.poly([[cx, top - 0.5], [cx + hw + 0.5, top + h], [cx - hw - 0.5, top + h]], G1);
        for (let y = top; y < top + h; y++) for (let x = 0; x < 11; x++) {
          if (b.get(x, y) !== G1) continue;
          if (x > cx + 0.5) b.set(x, y, G0);
          else if (x < cx - 1 && (x + y) % 2 === 0) b.set(x, y, G2);
        }
        for (let y = top; y < top + h; y++) {
          let first = -1;
          for (let x = 0; x < 11; x++) if (b.get(x, y) !== t.NONE) { first = x; break; }
          if (first >= 0 && first < cx) { b.set(first, y, SN[3]); if ((y + v) % 2) b.set(first + 1, y, SN[4]); }
        }
        const ry = top + h - 1;
        for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) if ((x + v) % 3 !== 0 && b.get(x, ry) !== t.NONE) b.set(x, ry, x > cx ? SN[2] : SN[3]);
      }
      // 2 px of snow on the crown
      b.set(5, 0, SN[4]); b.set(5, 1, SN[4]); b.set(4, 1, SN[3]); b.set(6, 1, SN[2]);
      b.outline(0x0a1414);
      return { buf: b, ox: -5, oy: -15 };
    });
  }
  // --- jungle: broad-leaf undergrowth masses and palms (radial fronds)
  function shrubSprite(v) {
    return sprite('shrub' + v, () => {
      const t = T, J = WP.jungle, b = t.buf(13, 12);
      const ramp = [J[1], J[2], J[3], J[4], J[5]];
      b.shadeEllipse(6, 6, v % 2 ? 5.4 : 5.8, 5.1, ramp, { dither: 0.6, amb: 0.3 });
      // big leaves: pale midribs fanning from the base
      const ribs = [[[6, 9], [2, 3]], [[6, 9], [6, 1]], [[6, 9], [10, 3]], [[6, 9], [1, 7]], [[6, 9], [11, 7]]];
      ribs.forEach(([a, c], i) => { if ((i + v) % 5 === 4) return; b.line(a[0], a[1], c[0], c[1], i < 2 ? J[5] : J[4]); });
      for (const [x, y] of [[9, 9], [3, 9], [7, 10]]) if (b.get(x, y) !== t.NONE) b.set(x, y, J[1]);
      b.outline(J[0]);
      return { buf: b, ox: -6, oy: -7 };
    });
  }
  function palmSprite(v) {
    return sprite('palm' + v, () => {
      const t = T, J = WP.jungle, b = t.buf(17, 17);
      const bark = [0x3a2c1c, 0x584430, 0x74603e];
      // curved trunk from the base (8,16) up to the crown
      const lean = v % 2 ? 1 : -1;
      let cx = 8, cy = 7;
      for (let y = 16; y >= 7; y--) {
        const x = Math.round(8 + lean * ((16 - y) / 9) ** 2 * 2.5);
        b.set(x, y, (y % 3) ? bark[1] : bark[0]); b.set(x + 1, y, bark[2 - (y % 3 === 0 ? 1 : 0)]);
        if (y === 7) { cx = x; cy = y; }
      }
      // fronds: 6 leaves radiating and drooping
      const angs = [-2.7, -2.1, -1.4, -0.9, -0.3, 0.35].map((a) => a + (v > 1 ? 0.15 : 0));
      angs.forEach((a, i) => {
        for (let s = 0; s <= 6; s++) {
          const x = cx + 0.5 + Math.cos(a) * s * 1.1, y = cy + Math.sin(a) * s * 0.9 + (s * s) * 0.09;
          b.set(x, y, s < 2 ? J[3] : i < 3 ? J[5] : J[4]);
          if (s < 5) b.set(x, y + 1, J[2]);
        }
      });
      b.set(cx, cy, J[2]); b.set(cx + 1, cy, J[2]); b.set(cx, cy + 1, 0x4a3a20); // coconuts
      b.outline(J[0]);
      return { buf: b, ox: -8, oy: -16 };
    });
  }
  // --- dead trees: grey-brown trunk with 3–4 bare branches
  function deadTreeSprite(v) {
    return sprite('dead' + v, () => {
      const t = T, DW = WP.deadwood, b = t.buf(11, 13), ink = 0x16120e;
      const lean = v === 1 ? 1 : 0;
      for (let y = 4; y < 13; y++) { const x = 4 + (y < 8 ? lean : 0); b.set(x, y, DW[3]); b.set(x + 1, y, DW[1]); }
      b.set(3, 12, DW[1]); b.set(6, 12, ink);
      const br = [[[4, 8], [1, 4], [0, 4]], [[5, 7], [8, 3], [9, 2]], [[5, 5], [6, 1], [5, 0]], [[4, 10], [2, 8], [1, 8]], [[6, 9], [9, 6], [10, 6]]];
      br.forEach(([a, c, d], i) => { if ((i + v) % 5 === 4) return; b.line(a[0], a[1], c[0], c[1], i % 2 ? DW[1] : DW[2]); b.set(d[0], d[1], DW[1]); });
      // outline only the trunk (thin branches stay as fine lines)
      for (let y = 4; y < 13; y++) { const x = 4 + (y < 8 ? lean : 0); if (b.get(x - 1, y) === t.NONE) b.set(x - 1, y, ink); if (b.get(x + 2, y) === t.NONE) b.set(x + 2, y, ink); }
      return { buf: b, ox: -5, oy: -13 };
    });
  }
  // --- hills: two low mounds in the region's ground colours
  function groundRamp(k) {
    switch (k) {
      case PLAIN: return [WP.plain[0], ...WP.plain];
      case DESERT: case BEACH: return [T.mul(WP.desert[0], 0.8), ...WP.desert];
      case SNOW: return [T.mul(WP.snow[0], 0.8), ...WP.snow];
      case WASTE: return [T.mul(WP.waste[0], 0.8), ...WP.waste];
      case MARSH: case SWAMP: return WP.marsh;
      case ASH: return WP.ash;
      default: return WP.grass;
    }
  }
  function hillSprite(k, v) {
    return sprite('hill' + k + '_' + v, () => {
      const t = T, base = groundRamp(k);
      const ramp = [base[1], base[2], base[3], base[4], base[5] || base[4]];
      const b = t.buf(18, 13);
      const mounds = v === 0 ? [[7.5, 9, 6.6, 7], [14, 11, 3.6, 4]] : [[9.5, 9, 6.6, 7], [3.5, 11, 3.6, 4]];
      for (const [x, y, rx, ry] of mounds.slice().reverse()) b.shadeEllipse(x, y, rx, ry, ramp, { dither: 0.5, amb: 0.1, lx: -0.8, ly: -0.5 });
      for (let y = 11; y < 13; y++) for (let x = 0; x < 18; x++) b.set(x, y, null);
      if (k === GRASS || k === PLAIN || k === MARSH) {
        const [mx, my] = mounds[0];
        b.set(mx - 3, my - 4, ramp[4]); b.set(mx - 2, my - 5, ramp[4]); b.set(mx + 2, my - 2, ramp[1]); b.set(mx + 3, my - 1, ramp[1]);
      }
      b.outline(base[0]);
      for (let x = 0; x < 18; x++) if (b.get(x, 11) !== t.NONE) b.set(x, 11, null);
      return { buf: b, ox: -1, oy: -12 };
    });
  }
  // --- mountains: ridges; depth 0 = front row (lit warm rock) … 2 = far (dark grey, 15 % blue)
  function rockRamp(k) { return k === SNOW ? WP.rockCold : k === DESERT || k === BEACH ? WP.rockSand : k === ASH || k === WASTE ? WP.rockAsh : WP.rock; }
  // far rows: one step darker and 15 % blue; temperate rock also turns to grey, the
  // regional rocks (snow, sand, ash) keep their own colour so a range stays in its region
  function depthRamp(k, depth) {
    const t = T, base = rockRamp(k);
    if (!depth) return base;
    const src = base === WP.rock ? WP.grey : base;
    const far = src.map((c, i) => t.mix(src[Math.max(0, i - 1)], 0x3a5c8c, 0.15));
    return base.map((c, i) => t.mix(c, far[i], depth === 1 ? 0.5 : 1));
  }
  function mountainSprite(k, depth, snow, v, foot, sec) {
    return sprite('mtn' + k + '_' + depth + '_' + snow + '_' + v + '_' + foot + '_' + sec, () => {
      const t = T, Rk = depthRamp(k, depth), SN = WP.snow;
      const W = 20, H = 24, base = 21;
      const b = t.buf(W, H);
      const px = [9, 11, 7][v], top = (snow === 2 ? 1 : snow === 1 ? 2 : depth ? 3 : 5) + [0, 2, 1][v];
      // silhouette: two-slope peak with a shoulder (back rows get a second summit)
      const L = [[0, base], [2, base - 5], [px - 4, top + 6], [px - 1, top + 1], [px, top], [px + 2, top + 3], [px + 5, top + 7], [W - 3, base - 6], [W - 1, base]];
      b.poly(L, Rk[3]);
      if (v === 1) b.poly([[0, base], [1, top + 9], [3, top + 7], [7, base - 3]], Rk[3]); // western shoulder peak
      else if (depth || v === 2) b.poly([[W - 9, base], [W - 5, top + 6], [W - 3, top + 5], [W, base - 4], [W, base]], Rk[3]);
      for (let y = 0; y <= base; y++) for (let x = 0; x < W; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const ridge = px + (y - top) * 0.35;
        const d = x - ridge;
        let i;
        if (d > 0) i = d > 4 ? 1 : 2;
        else i = d < -6 ? 3 : d < -2 ? 4 : 3;
        if (t.hash(x, y, 7 + v) < 0.1) i = Math.max(1, i - 1);
        if (y > base - 3 && i > 2) i--; // foot in shade
        b.set(x, y, Rk[i]);
      }
      const crag = (x0, y0, len, dir) => { for (let i = 0; i < len; i++) if (b.get(x0 + i * dir, y0 + i) !== t.NONE) b.set(x0 + i * dir, y0 + i, Rk[1]); };
      crag(px - 3, top + 7, 4, -1); crag(px + 3, top + 6, 5, 1); crag(px - 1, top + 12, 3, -1); crag(px + 6, top + 12, 3, 1);
      for (let x = 2; x < W - 2; x++) if (b.get(x, base - 1) !== t.NONE && (x + v) % 4 === 0) b.set(x, base - 1, Rk[2]);
      for (let y = top + 1; y < top + 8; y++) { const x = Math.round(px + (y - top) * 0.35) - 1; if (b.get(x, y) !== t.NONE) b.set(x, y, Rk[5]); }
      if (snow) {
        const deep = snow === 2 ? 9 : 5;
        for (let y = top; y < top + deep + 2; y++) for (let x = 0; x < W; x++) {
          if (b.get(x, y) === t.NONE) continue;
          const jag = ((x * 3 + v) % 4) - 1.5 + (x > px ? 1 : 0);
          if (y - top < deep - Math.abs(x - px) * 0.35 + jag * 0.6) {
            const ridge = px + (y - top) * 0.35;
            b.set(x, y, x > ridge + 0.5 ? SN[2] : t.hash(x, y, 3) < 0.15 ? SN[3] : SN[4]);
          }
        }
      }
      if (sec) {
        // hidden passage: a faint crack and a slightly different tone on the lit face
        const found = sec === 2;
        const path = [[px - 3, top + 9], [px - 2, top + 10], [px - 3, top + 11], [px - 2, top + 12], [px - 2, top + 13], [px - 3, top + 14], [px - 2, base - 1]];
        for (const [x, y] of path) if (b.get(x, y) !== t.NONE) { b.set(x, y, found ? Rk[0] : Rk[1]); if (found) { b.set(x + 1, y, Rk[0]); b.set(x - 1, y, Rk[1]); } }
        for (let y = top + 9; y < base; y++) for (let x = px - 6; x < px - 3; x++) if (b.get(x, y) !== t.NONE && t.hash(x, y, 71) < 0.3) b.set(x, y, t.mix(b.get(x, y), 0x6a6a4a, 0.2));
      }
      b.outline(k === SNOW ? 0x121622 : 0x1c140c);
      for (let x = 0; x < W; x++) if (b.get(x, base + 1) !== t.NONE) b.set(x, base + 1, null);
      if (foot) for (const [x, y] of [[3 + v, base + 1], [W - 5, base + 1], [px + 1, base + 2]]) { b.set(x, y, Rk[2]); b.set(x + 1, y, Rk[1]); }
      // found: a dotted trail at the foot (kept inside the cell, the only one the field redraws)
      if (sec === 2) { for (const y of [base - 2, base]) b.set(px - 2, y, WP.road[3]); b.set(px - 3, base - 1, WP.road[2]); }
      return { buf: b, ox: -2, oy: 15 - base };
    });
  }
  // --- cliffs: a south-facing rock wall (12 px) under a strip of plateau ground.
  //     Two courses of rounded boulders (lit upper-left, dark crevices between,
  //     seamless every 16 px), a bright ledge under a lip of grass, a dark foot
  //     and rubble on the ground below.
  function cliffSprite(k, l, r, up, dn) {
    return sprite('cliff' + k + l + r + up + dn, () => {
      const t = T, b = t.buf(16, 19);
      const base = rockRamp(k), Rk = k === SNOW || k === DESERT || k === BEACH || k === ASH ? base : base.map((c, i) => t.mix(c, WP.grey[i], 0.25));
      const G = groundRamp(k);
      const top0 = up ? 0 : 4;
      const WAVE = [0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0];
      const topAt = (x) => {
        let top = top0 + (up ? 0 : WAVE[x]);
        if (!l && x < 5) top = Math.max(top, top0 + Math.round((5 - x) * 2.2));
        if (!r && x > 10) top = Math.max(top, top0 + Math.round((x - 10) * 2.2));
        return top;
      };
      const face = t.buf(16, 16);
      for (let x = 0; x < 16; x++) for (let y = topAt(x); y <= 15; y++) face.set(x, y, Rk[1]);
      const L = t.buf(16, 16);
      const rows = up ? [[0, 5, [[0, 6], [6, 5], [11, 5]]], [6, 10, [[3, 6], [9, 7], [-1, 4]]], [11, 15, [[0, 5], [5, 6], [11, 5]]]]
        : [[top0 + 1, 9, [[0, 6], [6, 5], [11, 5]]], [10, 15, [[3, 6], [9, 7], [-1, 4]]]];
      for (const [y0, y1, list] of rows) for (const [x0, w] of list) for (const off of [-16, 0, 16]) {
        L.shadeEllipse(x0 + off + w / 2 - 0.5, (y0 + y1) / 2, w / 2 + 0.3, (y1 - y0) / 2 + 0.6, [Rk[1], Rk[2], Rk[3], Rk[4]], { dither: 0.5, amb: 0.2, lx: -0.6, ly: -0.8 });
      }
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (face.get(x, y) === t.NONE) continue;
        let c = L.get(x, y);
        if (c === t.NONE) c = Rk[1];
        if (y >= 14 && c !== Rk[1]) c = t.mix(c, Rk[1], 0.5); // foot in shade
        if ((!l && x < 5) || (!r && x > 10)) c = t.mix(c, Rk[1], 0.35);
        b.set(x, y, c);
      }
      if (!up) for (let x = 0; x < 16; x++) { const y = topAt(x); if (y <= 15) { b.set(x, y, Rk[5]); if (y + 1 <= 15 && t.hash(x, 3, 37) < 0.5) b.set(x, y + 1, Rk[4]); } }
      if (!dn) {
        for (let x = 0; x < 16; x++) if (topAt(x) <= 15) b.set(x, 16, (x % 3) ? Rk[0] : Rk[1]); // dark foot
        for (const [x, y] of [[2, 17], [7, 17], [12, 17], [5, 18], [14, 18]]) { b.set(x, y, Rk[3]); b.set(x + 1, y, Rk[1]); }
      }
      b.outline(0x1c140c);
      if (!up) {
        // no dark line between the plateau and the ledge (only the end slopes keep theirs); a lip of grass hangs over it
        for (let x = l ? 0 : 5; x <= (r ? 15 : 10); x++) {
          for (let y = 0; y < topAt(x); y++) b.set(x, y, null);
          const y = topAt(x);
          if (k !== SNOW && k !== DESERT && k !== BEACH && k !== ASH) { b.set(x, y - 1, G[4]); if (WAVE[(x + 3) & 15]) b.set(x, y, G[2]); }
        }
      }
      return { buf: b, ox: 0, oy: 0 };
    });
  }
  function cliffShadow() {
    return sprite('cliffsh', () => {
      const b = T.buf(16, 3);
      b.rect(0, 0, 16, 2, 0x000000); for (let x = 0; x < 16; x += 2) b.set(x, 2, 0x000000);
      return { buf: b, ox: 0, oy: 0, shadowOnly: 0.62 };
    });
  }
  // --- ruins: 4 layouts (broken pillars, a lone column, an arch fragment, a tumbled
  //     wall with a fallen drum), grey stone with grass growing at the foot
  function ruinsSprite(v) {
    return sprite('ruins' + v, () => {
      const t = T, Gy = WP.grey, G = WP.grass, b = t.buf(18, 16);
      const pillar = (x, h, broken) => {
        const y0 = 14 - h;
        b.rect(x, y0, 3, h, Gy[3]); b.vline(x, y0, 13, Gy[4]); b.vline(x + 2, y0, 13, Gy[2]);
        for (let y = y0 + 2; y < 14; y += 3) b.set(x + 1, y, Gy[2]);
        if (broken) { b.set(x + 2, y0, null); b.set(x + 1, y0 - 1, Gy[3]); } else { b.rect(x - 1, y0 - 1, 5, 1, Gy[4]); }
        b.rect(x - 1, 13, 5, 2, Gy[2]); b.hline(x - 1, x + 3, 13, Gy[4]);
      };
      const wall = (x0, x1, hMax) => {
        for (let x = x0; x <= x1; x++) {
          const h = 1 + ((x * 5 + v * 3) % 4 === 0 ? 2 : (x * 3 + v) % 3 === 0 ? 1 : 0) + (hMax > 3 && x % 5 === 2 ? 1 : 0);
          for (let y = 15 - h; y < 15; y++) b.set(x, y, (x + y) % 3 ? Gy[3] : Gy[2]);
          b.set(x, 15 - h, Gy[4]);
        }
      };
      if (v === 0) { pillar(3, 10, true); pillar(12, 6, true); wall(6, 11, 3); }
      else if (v === 1) { wall(1, 5, 3); pillar(7, 12, false); pillar(12, 5, true); b.shadeEllipse(15, 13.5, 1.6, 1.2, [Gy[1], Gy[2], Gy[3], Gy[4]]); }
      else if (v === 2) {
        pillar(2, 11, false); pillar(12, 11, false);
        for (let x = 2; x <= 14; x++) { const y = 3 - Math.round(Math.sin(((x - 2) / 12) * Math.PI) * 2); if (x < 11) { b.set(x, y, Gy[4]); b.set(x, y + 1, Gy[3]); b.set(x, y + 2, Gy[2]); } }
      } else { wall(1, 16, 4); b.shadeEllipse(7, 13, 3, 1.6, [Gy[1], Gy[2], Gy[3], Gy[4]]); b.vline(4, 13, 14, Gy[2]); }
      b.outline(0x1c1c20);
      for (const [x, y] of [[6, 14], [9, 13], [2, 15], [14, 15], [11, 14], [16, 15]]) if (b.get(x, y) !== t.NONE) { b.set(x, y, G[4]); if (y < 15) b.set(x, y + 1, G[2]); }
      return { buf: b, ox: -1, oy: -1 };
    });
  }
  // --- location icons (src/art/tiles_world_icons.js builds them)
  function iconSprite(id) {
    return sprite('icon_' + id, () => {
      const ICONS = A.WORLD_ICONS || {};
      const make = ICONS[id] || ICONS.loc_town;
      const r = make(T, T.PAL, WP);
      r.buf.outline(r.ink || 0x181418);
      return r;
    });
  }
  function bridgeSprite(dir) {
    return sprite('br' + dir, () => {
      const t = T, W = T.PAL.wood.map((c) => t.mix(c, 0x6a5a48, 0.25));
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
      const t = T, Gy = WP.grey, Rk = [Gy[0], Gy[1], Gy[2], Gy[3], Gy[4]];
      const b = t.buf(16, 16);
      const rocks = v ? [[4, 5, 3, 2.4], [11, 10, 3.4, 2.8], [5, 12, 2, 1.6]] : [[5, 9, 3.4, 2.8], [11, 5, 2.6, 2], [12, 12, 2.2, 1.8]];
      for (const [x, y, rx, ry] of rocks) b.shadeEllipse(x, y, rx, ry, Rk, { dither: 0.8 });
      b.outline(0x121216);
      return { buf: b, ox: 0, oy: 0, foam: rocks };
    });
  }

  // ------------------------------------------------------------ neighbourhood
  function resolveClass(m, x, y) {
    const id = m.tileAt(x, y);
    const k = clsOf(id);
    if (id === 'bridge_h' || id === 'bridge_v') {
      const a = id === 'bridge_h' ? [m.tileAt(x, y - 1), m.tileAt(x, y + 1)] : [m.tileAt(x - 1, y), m.tileAt(x + 1, y)];
      if (a.some((q) => isWater(clsOf(q)))) return SEA; // a bridge over the sea
    }
    if (!isDer(k)) return k;
    const trees = TREES.has(id);
    const cnt = new Int32Array(NCLS);
    for (let r = 1; r <= 2; r++) {
      let any = false;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        let q = clsOf(m.tileAt(x + i, y + j));
        if (!isLand(q)) continue;
        if (trees && q === BEACH) q = derDef(k); // trees stand on soil, not on the beach
        cnt[q]++; any = true;
      }
      if (any) break;
    }
    let best = derDef(k), bn = 0;
    for (let q = GRASS; q < NCLS; q++) if (cnt[q] > bn) { bn = cnt[q]; best = q; }
    return best;
  }
  const isRiverish = (id) => id === 'river';
  /** does the river/bridge-over-river at (x,y) carry water towards dir d? */
  function riverLinks(m, x, y, axis) {
    let bits = 0;
    for (let d = 0; d < 4; d++) {
      if (axis === 'v' && (d === 1 || d === 3)) continue;
      if (axis === 'h' && (d === 0 || d === 2)) continue;
      const [dx, dy] = DIRS4[d], n = m.tileAt(x + dx, y + dy);
      if (isRiverish(n)) bits |= 1 << d;
      else if (n === 'bridge_h' && (d === 0 || d === 2) && bridgeOverRiver(m, x + dx, y + dy)) bits |= 1 << d;
      else if (n === 'bridge_v' && (d === 1 || d === 3) && bridgeOverRiver(m, x + dx, y + dy)) bits |= 1 << d;
      else if (isWater(clsOf(n)) && n !== 'reef') bits |= 1 << d; // river mouth
    }
    return bits;
  }
  function bridgeOverRiver(m, x, y) {
    const id = m.tileAt(x, y);
    const a = id === 'bridge_h' ? [m.tileAt(x, y - 1), m.tileAt(x, y + 1)] : [m.tileAt(x - 1, y), m.tileAt(x + 1, y)];
    return a.some(isRiverish) && !a.some((q) => isWater(clsOf(q)));
  }
  function roadLinks(m, x, y) {
    let bits = 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS4[d], n = m.tileAt(x + dx, y + dy);
      if (n === 'road' || (n && n.startsWith('loc_'))) bits |= 1 << d;
      else if (n === 'bridge_h' && (d === 1 || d === 3)) bits |= 1 << d;
      else if (n === 'bridge_v' && (d === 0 || d === 2)) bits |= 1 << d;
    }
    return bits;
  }
  const secretFound = (m, x, y) => {
    const g = R.Game, s = g && g.secrets;
    if (!s || !m || m.id == null) return false;
    const w = m.wrap && m.w ? ((x % m.w) + m.w) % m.w : x, h = m.wrap && m.h ? ((y % m.h) + m.h) % m.h : y;
    return !!s[m.id + ':' + w + ',' + h];
  };
  /** sprite/overlay descriptor for a cell ('' = none). Variants follow a short
   *  periodic pattern (not a hash) so the number of distinct neighbourhoods stays small. */
  function descriptor(m, x, y, k) {
    const id = m.tileAt(x, y);
    const at = (i, j) => m.tileAt(x + i, y + j);
    const p4 = (((x + 2 * y) % 4) + 4) % 4;
    switch (id) {
      case 'forest': case 'secret_forest': case 'jungle': {
        const same = id === 'jungle' ? (q) => q === 'jungle' : forestLike;
        const e = (same(at(0, -1)) ? 0 : 1) | (same(at(0, 1)) ? 0 : 2) | (same(at(-1, 0)) ? 0 : 4) | (same(at(1, 0)) ? 0 : 8);
        let inner = e === 0 && same(at(-1, -1)) && same(at(1, -1)) && same(at(-1, 1)) && same(at(1, 1)) ? 1 : 0;
        let s = '';
        // オーナー指示 A15: an undiscovered secret_forest is drawn exactly like the forest around it (no hint)
        if (id === 'secret_forest' && secretFound(m, x, y)) {
          const open = (q) => q && !forestLike(q) && !mountainLike(q) && q !== 'sea' && !(R.DB.tiles[q] && R.DB.tiles[q].pass === false);
          const ax = open(at(-1, 0)) || open(at(1, 0)) || at(-1, 0) === 'secret_forest' || at(1, 0) === 'secret_forest' ? 'h' : 'v';
          s = 's2' + ax;
          inner = 0;
        }
        return (id === 'jungle' ? 'J' : 'F') + p4 + '.' + e + '.' + inner + s;
      }
      case 'snowforest': return 'S' + ((((x + y) % 2) + 2) % 2);
      case 'deadforest': {
        // dead trees inside a marsh fog carry the fog too (the patch only turns marsh cells into marsh_fog)
        let fogNear = false;
        for (const [dx, dy] of DIRS4) if (at(dx, dy) === 'marsh_fog') fogNear = true;
        return 'D' + ((((x + 3 * y) % 3) + 3) % 3) + (fogNear ? 'e' + mistOf(x, y) : '');
      }
      case 'hills': return 'H' + k + '.' + ((((x + y) % 2) + 2) % 2);
      case 'mountain': case 'secret_rock': {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && mountainLike(at(i, j))) n++;
        const four = mountainLike(at(0, -1)) && mountainLike(at(0, 1)) && mountainLike(at(-1, 0)) && mountainLike(at(1, 0));
        // snow only where the range runs at least 3 cells deep (the snowfield's mountains always)
        const snow = k === SNOW ? 2 : n === 8 && mountainLike(at(0, -2)) && mountainLike(at(0, 2)) ? 2 : n === 8 && four ? 1 : 0;
        const depth = !mountainLike(at(0, 1)) ? 0 : !mountainLike(at(0, 2)) ? 1 : 2;
        const foot = depth === 0 && !isWater(clsOf(at(0, 1))) ? 1 : 0;
        const sec = id === 'secret_rock' && secretFound(m, x, y) ? 2 : 0; // オーナー指示 A15: no hint until found
        return 'M' + k + '.' + depth + '.' + snow + '.' + ((((x + 2 * y) % 3) + 3) % 3) + '.' + foot + '.' + sec;
      }
      case 'cliff': {
        const c = (q) => q === 'cliff';
        return 'C' + k + '.' + (c(at(-1, 0)) ? 1 : 0) + (c(at(1, 0)) ? 1 : 0) + (c(at(0, -1)) ? 1 : 0) + (c(at(0, 1)) ? 1 : 0);
      }
      case 'ruins': return 'O' + ((((x + 2 * y + (y >> 1)) % 4) + 4) % 4);
      case 'road': return 'r' + roadLinks(m, x, y);
      case 'river': return 'u' + riverLinks(m, x, y);
      case 'bridge_h': case 'bridge_v': {
        const d = id === 'bridge_h' ? 'h' : 'v';
        return 'B' + d + (k !== SEA && bridgeOverRiver(m, x, y) ? 'u' + riverLinks(m, x, y, d === 'h' ? 'v' : 'h') : '');
      }
      case 'reef': return 'R' + ((((x + y) % 2) + 2) % 2);
      case 'fog': {
        // rings to the open sea: 0 = touches open water, 1, 2 = deep in the bank
        let d = 2;
        for (let r = 1; r <= 2 && d === 2; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
          const q = at(i, j);
          if (q !== 'fog' && isWater(clsOf(q))) { d = Math.min(d, r - 1); }
        }
        return 'g' + d;
      }
      case 'sandstorm': return 'Z';
      case 'marsh_fog': return 'E' + mistOf(x, y);
      default: return id && id.startsWith('loc_') ? 'L' + id + '.' + roadLinks(m, x, y) : '';
    }
  }
  /** sprite placements for a cell descriptor at cell offset (cx,cy) px */
  function placements(desc, cx, cy, out) {
    if (!desc) return;
    const ch = desc[0];
    if (ch === 'F' || ch === 'J') {
      const [v, e, inner] = desc.slice(1).split('.').map((s) => parseInt(s, 10));
      const secret = desc.includes('s') ? +desc[desc.indexOf('s') + 1] : 0;
      const jit = CROWN_JIT[v];
      const nOpen = e & 1, sOpen = e & 2;
      CROWNS.forEach(([x0, y0], i) => {
        let x = x0 + jit[i * 2], y = y0 + jit[i * 2 + 1];
        if (nOpen && y0 < 6) y -= 2;
        const z = cy + y;
        if (ch === 'F') {
          const tone = secret && i === 2 ? 1 : (i + v) % 4 === 3 ? 2 : 0;
          out.push({ s: crownSprite((i + v * 3) % 4, tone), x: cx + x, y: cy + y, z });
          if (sOpen && y0 >= 10) {
            out.push({ s: trunkSprite(i & 1), x: cx + x, y: cy + y + 5, z: z - 0.1 });
            out.push({ s: groundShadow(4), x: cx + x + 1, y: cy + y + 9, z: 0, flat: true });
          }
        } else {
          out.push({ s: shrubSprite((i + v) % 4), x: cx + x, y: cy + y, z });
          if ((i + v) % 3 === 0) out.push({ s: palmSprite((i + v) % 4), x: cx + x, y: cy + y + 3, z: z + 3.5 });
          if (sOpen && y0 >= 10) out.push({ s: groundShadow(4), x: cx + x + 1, y: cy + y + 6, z: 0, flat: true });
        }
      });
      if (secret) out.push({ secretCut: desc[desc.indexOf('s') + 2], found: secret === 2, x: cx, y: cy, z: cy + 15.5 });
      if (inner) out.push({ innerFill: ch, x: cx, y: cy, z: -1e9, flat: true });
      return;
    }
    if (ch === 'S') {
      const v = +desc[1];
      for (const [x, y, i] of [[4, 8, 0], [12, 8, 1], [0, 16, 2], [8, 16, 3]]) {
        const s = pineSprite((i + v) % 2);
        out.push({ s, x: cx + x, y: cy + y, z: cy + y });
      }
      return;
    }
    if (ch === 'D') {
      const v = +desc[1];
      const pts = [[[4, 7], [12, 11], [6, 16]], [[11, 6], [3, 12], [13, 16]], [[7, 5], [14, 12], [3, 16]]][v];
      pts.forEach(([x, y], i) => out.push({ s: deadTreeSprite((i + v) % 3), x: cx + x, y: cy + y, z: cy + y }));
      return;
    }
    if (ch === 'H') {
      const [k, v] = desc.slice(1).split('.').map(Number);
      out.push({ s: hillSprite(k, v), x: cx, y: cy + 16, z: cy + 14 });
      return;
    }
    if (ch === 'M') {
      const [k, depth, snow, v, foot, sec] = desc.slice(1).split('.').map(Number);
      out.push({ s: mountainSprite(k, depth, snow, v, foot, sec), x: cx, y: cy, z: cy + 15 });
      return;
    }
    if (ch === 'C') {
      const [k, f] = desc.slice(1).split('.');
      out.push({ s: cliffSprite(+k, +f[0], +f[1], +f[2], +f[3]), x: cx, y: cy, z: cy + 14 });
      if (f[3] === '0') out.push({ s: cliffShadow(), x: cx, y: cy + 16, z: 0, flat: true });
      return;
    }
    if (ch === 'O') { out.push({ s: ruinsSprite(+desc[1]), x: cx, y: cy, z: cy + 14 }); return; }
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
      const s = iconSprite(desc.slice(1).split('.')[0]);
      out.push({ s, x: cx, y: cy, z: cy + 16 });
    }
  }

  // ------------------------------------------------------------ river & road geometry
  const PRI = [0, 2, 3, 1]; // flow priority per dir (up, right, down, left): up > left > right > down
  const EDGE_MID = [[8, 0], [16, 8], [8, 16], [0, 8]];
  const CORNER = { 3: [16, 0], 6: [16, 16], 12: [0, 16], 9: [0, 0] }; // up+right, right+down, down+left, left+up
  /** river pieces of one cell (in that cell's px) → [{type, …}] */
  function riverPieces(bits) {
    const dirs = [0, 1, 2, 3].filter((d) => bits & (1 << d));
    if (!dirs.length) return [{ type: 'pond' }];
    if (dirs.length === 2 && CORNER[bits]) {
      const [a, b] = PRI[dirs[0]] < PRI[dirs[1]] ? dirs : [dirs[1], dirs[0]];
      return [{ type: 'arc', c: CORNER[bits], e1: EDGE_MID[a], e2: EDGE_MID[b] }];
    }
    if (dirs.length === 2) {
      const [a, b] = PRI[dirs[0]] < PRI[dirs[1]] ? dirs : [dirs[1], dirs[0]];
      return [{ type: 'seg', p: EDGE_MID[a], q: EDGE_MID[b], s0: 0, len: 16 }];
    }
    // spring / junction: half segments; up & left flow in, right & down flow out
    return dirs.map((d) => (d === 0 || d === 3 ? { type: 'seg', p: EDGE_MID[d], q: [8, 8], s0: 0, len: 8 } : { type: 'seg', p: [8, 8], q: EDGE_MID[d], s0: 8, len: 8 }));
  }
  /** nearest river piece → [dist, s (flow param 0..16), o (signed offset)] */
  function riverDist(pieces, px, py) {
    let bd = 1e9, bs = 0, bo = 0;
    for (const pc of pieces) {
      let d, s, o;
      if (pc.type === 'pond') { d = Math.hypot(px - 8, py - 8) - 1.2; s = 0; o = 0; }
      else if (pc.type === 'seg') {
        const [ax, ay] = pc.p, [qx, qy] = pc.q, vx = qx - ax, vy = qy - ay, L2 = vx * vx + vy * vy;
        let u = ((px - ax) * vx + (py - ay) * vy) / L2;
        u = Math.max(0, Math.min(1, u));
        const cx = ax + vx * u, cy = ay + vy * u;
        d = Math.hypot(px - cx, py - cy); s = pc.s0 + u * pc.len;
        o = ((px - ax) * vy - (py - ay) * vx) / Math.sqrt(L2);
      } else {
        const [ccx, ccy] = pc.c, u1x = (pc.e1[0] - ccx) / 8, u1y = (pc.e1[1] - ccy) / 8, u2x = (pc.e2[0] - ccx) / 8, u2y = (pc.e2[1] - ccy) / 8;
        const wx = px - ccx, wy = py - ccy, p1 = wx * u1x + wy * u1y, p2 = wx * u2x + wy * u2y;
        if (p1 >= 0 && p2 >= 0) {
          const r = Math.hypot(wx, wy);
          d = Math.abs(r - 8); o = r - 8; s = (Math.atan2(p2, p1) / (Math.PI / 2)) * 16;
        } else {
          const d1 = Math.hypot(px - pc.e1[0], py - pc.e1[1]), d2 = Math.hypot(px - pc.e2[0], py - pc.e2[1]);
          d = Math.min(d1, d2); s = d1 < d2 ? 0 : 16; o = 0;
        }
      }
      if (d < bd) { bd = d; bs = s; bo = o; }
    }
    return [bd, bs, bo];
  }
  /** road distance for a cell's link bits (cell px) incl. 2 px fillets in the inner corners */
  function roadDist(bits, px, py) {
    let d = 1e9;
    for (let k = 0; k < 4; k++) {
      if (!(bits & (1 << k))) continue;
      const [ex, ey] = EDGE_MID[k];
      const qx = ex === 8 ? 8 : ex === 16 ? 17 : -1, qy = ey === 8 ? 8 : ey === 16 ? 17 : -1;
      const vx = qx - 8, vy = qy - 8, L2 = vx * vx + vy * vy;
      const u = Math.max(0, Math.min(1, ((px - 8) * vx + (py - 8) * vy) / L2));
      d = Math.min(d, Math.hypot(px - 8 - vx * u, py - 8 - vy * u));
    }
    if (!bits) d = Math.hypot(px - 8, py - 8);
    // inner-corner fillets (radius 2) where two perpendicular links meet
    for (const [mask, sx, sy] of [[3, 1, -1], [6, 1, 1], [12, -1, 1], [9, -1, -1]]) {
      if ((bits & mask) !== mask) continue;
      const fx = 8 + sx * 5, fy = 8 + sy * 5; // fillet circle centre (band edge + 2)
      const inx = sx > 0 ? px >= 11 && px <= 13 : px >= 3 && px <= 5, iny = sy > 0 ? py >= 11 && py <= 13 : py >= 3 && py <= 5;
      if (inx && iny && Math.hypot(px - fx, py - fy) >= 2) d = Math.min(d, 2.4);
    }
    return d;
  }

  // ------------------------------------------------------------ render
  const CACHE = new Map();
  function classes9(m, x, y) {
    const c9 = new Int8Array(9);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c9[(j + 1) * 3 + (i + 1)] = resolveClass(m, x + i, y + j);
    return c9;
  }
  function render(m, x, y) {
    tk(); textures(); periodic();
    const c9 = classes9(m, x, y), d9 = new Array(9);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const q = (j + 1) * 3 + (i + 1); d9[q] = descriptor(m, x + i, y + j, c9[q]); }
    const own = m.tileAt(x, y), v = vOf(x, y);
    const key = own + v + '|' + c9.join(',') + '|' + d9.join(';');
    let hit = CACHE.get(key);
    if (hit) return hit;
    hit = build(own, c9, d9, v);
    CACHE.set(key, hit);
    return hit;
  }

  function build(own, c9, d9, dv) {
    const t = T, W = weights(), PR = PER, TX = TEX;
    const fld = field(c9);
    const rocky9 = d9.map((d) => d && (d[0] === 'M' || d[0] === 'C'));
    // weather weights
    const zMask = d9.map((d) => d === 'Z'), eMask = d9.map((d) => (d && d[0] === 'E' ? 1 : d && d[0] === 'D' && d[2] === 'e' ? 0.85 : 0));
    const sandW = zMask.some(Boolean) ? effWeight(zMask) : null;
    // sea fog density: weighted mean over the water cells around (open sea counts 0, fog 0.62/0.88/1 by depth)
    let fogD = null;
    if (d9.some((d) => d && d[0] === 'g')) {
      fogD = new Float32Array(EW * EW);
      // (open water weighs half, so even a one-cell bank reads as fog, thinning at its edges)
      const dens9 = d9.map((d, j) => (d && d[0] === 'g' ? [0.9, 1, 1.05][+d[1]] : -1));
      const water9 = c9.map((k, j) => dens9[j] >= 0 || isWater(k));
      for (let i = 0; i < EW * EW; i++) {
        let num = 0, den = 0, fogw = 0;
        for (let j = 0; j < 9; j++) { if (!water9[j]) continue; const w = W[i * 9 + j]; if (dens9[j] >= 0) { num += w * dens9[j]; fogw += w; den += w; } else den += w * 0.45; }
        fogD[i] = den > 0.001 && fogw > 0 ? (num / den) * Math.min(1, fogw * 5) : 0;
      }
    }
    const mfogW = eMask.some(Boolean) ? effWeight(eMask) : null;
    const mist = mfogW ? mistField(d9) : null;
    // rivers: own pieces and the neighbours' pieces reaching into this cell
    const rpieces = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const d = d9[j * 3 + i];
      if (!d) continue;
      let bits = -1;
      if (d[0] === 'u') bits = parseInt(d.slice(1), 10);
      else if (d[0] === 'B' && d[2] === 'u') bits = parseInt(d.slice(3), 10);
      if (bits < 0) continue;
      if ((i !== 1 || j !== 1) && !(bits & (1 << ({ '1,0': 2, '2,1': 3, '1,2': 0, '0,1': 1 }[i + ',' + j] ?? 9)))) continue; // only links pointing at us
      const ox = (i - 1) * 16, oy = (j - 1) * 16;
      for (const pc of riverPieces(bits)) rpieces.push({ ox, oy, pc });
    }
    let roadBits = -1;
    const od = d9[4];
    if (od && od[0] === 'r') roadBits = parseInt(od.slice(1), 10);
    else if (od && od[0] === 'L') { const rb = parseInt(od.split('.')[1], 10); if (rb) roadBits = rb; }

    // ---- per-pixel river/road geometry (center cell only)
    let riv = null, rivAny = false;
    if (rpieces.length) {
      riv = new Float32Array(256 * 3);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        let bd = 1e9, bs = 0, bo = 0;
        for (const { ox, oy, pc } of rpieces) {
          const [d, s, o] = riverDist([pc], x + 0.5 - ox, y + 0.5 - oy);
          if (d < bd) { bd = d; bs = s; bo = o; }
        }
        const q = (y * 16 + x) * 3;
        riv[q] = bd; riv[q + 1] = bs; riv[q + 2] = bo;
        if (bd <= 6) rivAny = true;
      }
    }
    // ---- frames
    let hasSea = own === 'reef' || own === 'barrier', hasFog = false, hasSand = false, hasMfog = false;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = (y + MG) * EW + (x + MG), k = fld.cls[i];
      if (isWater(k)) hasSea = true;
      if (fogD && fogD[i] > 0) hasFog = true;
      if (sandW && sandW[i] > 0) hasSand = true;
      if (mfogW && mfogW[i] > 0) hasMfog = true;
    }
    let nf = Math.max(hasSea || hasSand || rivAny ? 4 : 1, hasFog ? 8 : 1, hasMfog ? 2 : 1);
    if (own === 'magma') nf = 2;
    // ---- sprites
    const sprites = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) placements(d9[j * 3 + i], (i - 1) * 16, (j - 1) * 16, sprites);
    sprites.sort((a, b) => (a.flat ? 0 : 1) - (b.flat ? 0 : 1) || a.z - b.z || a.x - b.x);
    const innerSp = sprites.find((s) => s.innerFill && s.x === 0 && s.y === 0);
    const innerFill = innerSp ? (innerSp.innerFill === 'J' ? WP.jungle : WP.forest) : null;
    const onDesert = c9[4] === DESERT || c9[4] === BEACH, onSnow = c9[4] === SNOW;
    const RC = onDesert ? WP.road.map((c) => t.mix(c, WP.desert[1], 0.45)) : onSnow ? WP.road.map((c) => t.mix(c, WP.snow[1], 0.4)) : WP.road;
    const out = [];
    for (let f = 0; f < nf; f++) {
      const seaF = f & 3, fogF = (f >> 1) & 3, sandF = f & 3, mF = f & 1, rivF = f & 3;
      const b = t.tile();
      // ---- ground
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const i = (y + MG) * EW + (x + MG);
        const k = fld.cls[i], s = fld.second[i], mg = fld.margin[i];
        const tx = TX[k];
        const ff = k === SEA || k === FOG || k === BARRIER ? seaF : k === MAGMA ? (own === 'magma' && mg > 0.3 ? f & 1 : 0) : 0;
        let col = tx[ff % tx.length][y * 16 + x];
        const dk = DECO[k];
        if (dk && (k === s || mg > 0.35)) { const df = dk[dv], dc = df[(k === SEA || k === FOG ? seaF : 0) % df.length][y * 16 + x]; if (dc >= 0) col = dc; }
        if (k !== s && mg < 0.8) col = shore(k, s, mg, x, y, seaF, i, fld, c9, rocky9, W, PR, col);
        b.p[y * 16 + x] = col;
      }
      if (innerFill) for (let q = 0; q < 256; q++) b.p[q] = t.bayer(q & 15, q >> 4) < 0.3 ? innerFill[0] : innerFill[1];
      // ---- rivers
      if (rivAny) {
        const SH = WP.shallow;
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const q = (y * 16 + x) * 3, d = riv[q];
          if (d > 6) continue;
          const i = (y + MG) * EW + (x + MG), k = fld.cls[i], hw = 4.4 + (PR.wob[y * 16 + x] - 0.5) * 1.4;
          if (!isLand(k)) continue;
          const p = y * 16 + x;
          if (d <= hw) {
            const s = riv[q + 1], o = riv[q + 2];
            let col = d > hw - 1.1 ? SH[2] : d > hw - 2.6 ? (t.bayer(x, y) < 0.5 ? SH[1] : SH[2]) : SH[1];
            if (d > hw - 0.6) col = SH[3];
            const tt = ((s - 4 * rivF) % 16 + 16) % 16;
            if (Math.abs(o + 1.8) < 0.7 && tt < 3) col = tt < 1.2 ? WP.foam[0] : SH[3];
            else if (Math.abs(o - 1.6) < 0.7 && ((tt + 8) % 16) < 2.2) col = SH[3];
            b.p[p] = col;
          } else if (d <= hw + 1.1) b.p[p] = t.mul(b.p[p], 0.7);
          else if (d <= hw + 3.4) {
            const seed = (xx, yy) => ((xx * 5 + (yy >> 2) * 3) % 7 === 0) && PR.reed[((yy & 15) * 16) + (xx & 15)] > 0.52;
            if (seed(x, y) || seed(x, y + 1) || seed(x, y + 2)) b.p[p] = seed(x, y - 1) ? WP.reed[1] : WP.reed[3];
          }
        }
      }
      // ---- road
      if (roadBits >= 0) {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const d = roadDist(roadBits, x + 0.5, y + 0.5);
          if (d > 3.05) continue;
          const i = (y + MG) * EW + (x + MG);
          if (!isLand(fld.cls[i])) continue;
          let col = d > 2.05 ? RC[1] : RC[2];
          if (d <= 2.05) {
            const h = t.hash(x, y, 211);
            if (h < 0.08) col = RC[3]; else if (h > 0.93) col = RC[1];
          }
          b.p[y * 16 + x] = col;
        }
        const n = [1, 2, 4, 8].filter((m) => roadBits & m).length;
        const pebbles = n >= 3 ? [[7, 7], [9, 8], [8, 10]] : [[6, 3 + (roadBits & 3)], [9, 11], [10, 6]];
        for (const [px, py] of pebbles) if (roadDist(roadBits, px + 0.5, py + 0.5) < 2.2) { b.p[py * 16 + px] = RC[3]; if (py < 15) b.p[(py + 1) * 16 + px] = RC[0]; }
      }
      // ---- sprites
      for (const sp of sprites) {
        if (sp.innerFill) continue;
        if (sp.secretCut) { if (!sp.x && !sp.y) drawSecretCut(b, sp.secretCut, sp.found); continue; }
        if (sp.reef) {
          for (const [rx, ry, ax, ay] of sp.s.foam) {
            const grow = [0.6, 1.2, 1.6, 1.0][seaF];
            for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) {
              const dx = xx / (ax + grow + 0.5), dy = yy / (ay + grow * 0.8 + 0.5);
              const dd = dx * dx + dy * dy;
              if (dd <= 1 && dd > 0.55) b.set(sp.x + rx + xx, sp.y + ry + yy, (xx + yy + f) % 3 ? WP.foam[1] : WP.foam[0]);
            }
          }
        }
        const x0 = sp.x + sp.s.ox, y0 = sp.y + sp.s.oy;
        if (sp.s.shadowOnly) { b.shadowOf(sp.s.buf, x0, y0, sp.s.shadowOnly); continue; }
        if (sp.s.shadow) b.shadowOf(sp.s.buf, x0 + sp.s.shadow[0], y0 + sp.s.shadow[1], 0.6);
        else if (!sp.flat && !sp.s.noShadow) b.shadowOf(sp.s.buf, x0 + 1, y0 + 1, 0.72);
        b.blit(sp.s.buf, x0, y0);
      }
      // ---- weather
      if (hasFog || sandW || mfogW) weather(b, fld, fogD, sandW, mfogW, fogF, sandF, mF, mist);
      out.push(b.toCanvas());
    }
    return nf === 1 ? out[0] : out;
  }

  /** land/water and land/land border colouring for one pixel */
  function shore(k, s, mg, x, y, seaF, i, fld, c9, rocky9, W, PR, col) {
    const t = T, SH = WP.shallow, FM = WP.foam, SA = WP.sand, RK = WP.rock, P = t.PAL;
    const rockyAt = () => {
      let bj = -1, bw = 0;
      for (let j = 0; j < 9; j++) { if (!isLand(c9[j])) continue; const w = W[i * 9 + j]; if (w > bw) { bw = w; bj = j; } }
      return bj >= 0 && rocky9[bj];
    };
    if (k === SEA || k === FOG) {
      if (s === BARRIER) return mg < 0.25 ? 0x1a2040 : col;
      if (s === MAGMA) return mg < 0.2 ? 0x503848 : col;
      if (!isLand(s)) return col;
      const rocky = rockyAt();
      const lap = 0.16 + 0.05 * [0, 1, 2, 1][seaF];
      const foamOn = rocky ? PR.foam[y * 16 + x] > 0.4 : PR.foam[y * 16 + x] > 0.56;
      if (mg < lap) return foamOn ? FM[(x + seaF) % 5 ? 1 : 0] : SH[2];
      if (mg < 0.36) return foamOn && mg < lap + 0.08 && (x + y + seaF) % 3 === 0 ? FM[0] : SH[2];
      if (mg < 0.58) return t.bayer(x, y) < 0.5 ? SH[1] : SH[2];
      if (mg < 0.76) return t.bayer(x, y) < 0.5 ? SH[0] : col;
      if (mg < 0.8 && (seaF === 1 || seaF === 2) && (x + seaF) % 3) return SH[0];
      return col;
    }
    if (k === BARRIER) return mg < 0.2 ? 0x201430 : col;
    if (k === MAGMA) return mg < 0.12 ? P.crust[0] : mg < 0.3 ? (t.bayer(x, y) < 0.6 ? P.crust[1] : P.crust[2]) : col;
    if (isWater(s)) {
      if (mg >= 0.5) return col;
      if (rockyAt()) return mg < 0.2 ? RK[1] : mg < 0.42 ? RK[2] : t.bayer(x, y) < 0.5 ? RK[3] : col;
      const below = fld.cls[i + EW], below2 = fld.cls[i + EW * 2];
      const south = isWater(below) || isWater(below2);
      if (k === SNOW) return mg < 0.2 ? (south ? WP.snow[1] : WP.snow[4]) : mg < 0.42 ? WP.snow[2] : col;
      if (k === BEACH || k === DESERT) return mg < 0.2 && south ? SA[1] : mg < 0.2 ? SA[4] : col;
      if (south && mg < 0.18) return SA[1];
      if (mg < 0.22) return SA[3];
      if (mg < 0.4) return SA[2];
      return t.bayer(x, y) < 0.35 ? t.mix(SA[1], col, 0.5) : col;
    }
    if (s === MAGMA) return mg < 0.1 ? P.crust[1] : mg < 0.2 ? P.crust[3] : col;
    if (s === FOG) return col;
    // land-land: a thin darker seam, dithered
    if (mg < 0.05) return t.mul(col, 0.86);
    if (mg < 0.1 && t.bayer(x, y) < 0.5) return t.mul(col, 0.93);
    return col;
  }

  /** sea-fog amount at an extended pixel (land only gets thin wisps) */
  function fogAmt(fld, fogD, ex, ey, blob) {
    if (ex < 0 || ey < 0 || ex >= EW || ey >= EW) return 0;
    const i = ey * EW + ex;
    let dens = fogD[i];
    if (dens <= 0) return 0;
    if (!isWater(fld.cls[i])) dens *= 0.45;
    const lx = ((ex - MG) % 16 + 16) % 16, ly = ((ey - MG) % 16 + 16) % 16;
    // deep in the bank the puffs merge (small amplitude); towards open sea they break apart
    return dens * 0.86 + (blob[ly * 16 + lx] - 0.45) * 0.62 * Math.max(0.3, 1.45 - dens);
  }
  // Marsh mist: every fog cell owns 2 long thin wisps (layout mistOf(x, y), carried in
  // its descriptor, so it is part of the cache key); a wisp may reach up to 6 px into
  // the next cell, and each cell draws its own wisps plus the neighbours' reaching in,
  // so the bank reads as loose drifting streaks with no cell grid. [cx, cy, rx, ry]
  const MIST_V = [
    [[8, 4, 10, 2.2], [3, 11.5, 7, 2]],
    [[11, 7, 9, 2.4], [2.5, 14, 6.5, 1.8]],
    [[5, 2.5, 8, 1.9], [12, 10.5, 10, 2.5]],
    [[9, 13, 11, 2.3], [1.5, 6, 6, 2]],
    [[4, 8, 9.5, 2.4], [13.5, 2, 5.5, 1.7]],
    [[12, 12.5, 8, 2.1], [6, 5, 7.5, 2.2]],
  ];
  const mistOf = (x, y) => ((((x * 5 + y * 2 + ((x >> 1) ^ (y >> 2)) * 3) % 6) + 6) % 6);
  /** mist density (0..1) over the centre cell for both images; image 1 drifts 2 px east */
  function mistField(d9) {
    return [-1, 1].map((dx) => {
      const a = new Float32Array(256);
      for (let j = 0; j < 9; j++) {
        const d = d9[j];
        if (!d) continue;
        const c = d[0] === 'E' ? d[1] : d[0] === 'D' && d[2] === 'e' ? d[3] : null;
        if (c == null) continue;
        const ox = ((j % 3) - 1) * 16, oy = (((j / 3) | 0) - 1) * 16;
        for (const [cx, cy, rx, ry] of MIST_V[+c]) {
          const x0 = Math.max(0, Math.floor(ox + cx + dx - rx)), x1 = Math.min(15, Math.ceil(ox + cx + dx + rx));
          const y0 = Math.max(0, Math.floor(oy + cy - ry)), y1 = Math.min(15, Math.ceil(oy + cy + ry));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const u = (x + 0.5 - ox - cx - dx) / rx, w = (y + 0.5 - oy - cy) / ry;
            // thicker in the middle, tapering to thin tails
            const v = 1 - u * u - w * w * (1 + 1.5 * u * u);
            if (v > a[y * 16 + x]) a[y * 16 + x] = v;
          }
        }
      }
      return a;
    });
  }
  /** sea fog, sandstorm and marsh fog over the finished cell */
  function weather(b, fld, fogD, sandW, mfogW, fogF, sandF, mF, mistF) {
    const t = T, FG = WP.fog, blob = PER.fog[fogF], mist = mistF && mistF[mF];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ex = x + MG, ey = y + MG, i = ey * EW + ex, p = y * 16 + x;
      // sea fog: soft white banks, lit on top, grey on the underside; thin puffs towards open sea
      if (fogD && fogD[i] > 0) {
        const a = fogAmt(fld, fogD, ex, ey, blob), bz = t.bayer(x, y);
        let col = -1;
        if (a > 0.74) {
          const below = fogAmt(fld, fogD, ex, ey + 2, blob), above = fogAmt(fld, fogD, ex, ey - 1, blob);
          col = below < 0.52 ? FG[0] : below < 0.68 ? FG[1] : above < 0.68 ? FG[3] : FG[2];
          if (col === FG[2]) {
            // puffs inside the bank: lit crowns, grey undersides where a puff ends above a thinner patch
            // (sampled half a cell down, so the puff edges fall mid-cell rather than on the cell rows)
            const bl = blob[((y + 7) & 15) * 16 + x], bd = blob[((y + 9) & 15) * 16 + x], bu = blob[((y + 6) & 15) * 16 + x];
            if (bl > 0.5 && bd < bl - 0.4) col = bz < 0.6 ? FG[1] : FG[2];
            else if (bl > 0.82 && bz < 0.5) col = FG[3];
            else if (bl > 0.6 && bu < bl - 0.3) col = FG[3];
            else if (bl < 0.12 && bz < 0.25) col = FG[1];
          }
        } else if (a > 0.62) col = bz < 0.7 ? FG[1] : t.mix(b.p[p], FG[0], 0.6);
        else if (a > 0.5) col = bz < 0.5 ? FG[0] : t.mix(b.p[p], FG[0], 0.35);
        else if (a > 0.4) col = bz < 0.25 ? FG[0] : -1;
        if (col >= 0) b.p[p] = col;
      }
      // sandstorm: ~10 % haze and bright streaks flowing to the lower right
      if (sandW && sandW[i] > 0) {
        const w = sandW[i], bz = t.bayer(x, y);
        if (bz < w) b.p[p] = t.mix(b.p[p], WP.haze, 0.2);
        const st = PER.sand[sandF][p];
        if (st && bz < w * 1.4) b.p[p] = st === 2 ? 0xf2e8d0 : t.mix(b.p[p], 0xece0c0, 0.55);
      }
      // marsh fog: pale wisps, checker-dithered (half transparent)
      if (mist && mfogW[i] > 0) {
        const a = mfogW[i] * mist[p] * 1.25, bz = t.bayer(x, y);
        if (bz < 0.125 * mfogW[i]) b.p[p] = t.mix(b.p[p], FG[1], 0.3); // thin veil over the whole bank
        if (a > 0.34 && ((x + y + mF) & 1) === 0) b.p[p] = t.mix(b.p[p], a > 0.7 ? FG[2] : FG[1], a > 0.6 ? 0.6 : 0.42);
        else if (a > 0.7) b.p[p] = t.mix(b.p[p], FG[0], 0.28);
      }
    }
  }

  /** hidden passage through a forest: a faint cut (found: clearer + a dotted trail) */
  function drawSecretCut(b, axis, found) {
    const t = T, F = WP.forest, R2 = WP.road;
    for (let k = 2; k < 14; k++) {
      const x = axis === 'v' ? 8 : k, y = axis === 'v' ? k : 8;
      const wob = (k % 5 === 2) ? 1 : 0;
      const px = axis === 'v' ? x + wob : x, py = axis === 'v' ? y : y + wob;
      if (!found) { if (k % 3 !== 1) b.set(px, py, t.mix(b.get(px, py), F[0], 0.7)); continue; }
      b.set(px, py, F[0]);
      if (axis === 'v') b.set(px + 1, py, F[1]); else b.set(px, py + 1, F[1]);
      if (k % 2 === 0) b.set(px, py, R2[2]);
    }
  }

  // ------------------------------------------------------------ public
  /**
   * Canvas (or frame array) for world cell (x,y) with autotiled transitions.
   * Uses map.tileAt(x, y) (which must return map.outside beyond the edges, or
   * wrap) and map.id for found hidden passages.
   */
  A.worldTile = function (map, x, y) { return render(map, x, y); };
  A.worldTileCacheSize = () => CACHE.size;
  A.worldTileStats = () => { const o = {}; for (const k of CACHE.keys()) { const id = k.split('|')[0]; o[id] = (o[id] || 0) + 1; } return o; };
  /** drop cached cells (e.g. after R.Game.secrets changed); the field keeps its own per-cell cache */
  A.worldTileReset = () => CACHE.clear();
  /** battle backdrop for a world cell: roads, bridges over land and ruins take the backdrop of
   *  the ground they lie on (a desert road fights in the desert); other tiles keep their data bbg */
  const CLASS_BBG = { [GRASS]: 'grass', [PLAIN]: 'grass', [DESERT]: 'desert', [SNOW]: 'snow', [SWAMP]: 'swamp', [BEACH]: 'beach', [WASTE]: 'wasteland', [MARSH]: 'swamp', [ASH]: 'ashland' };
  const GROUND_BBG = new Set(['road', 'bridge_h', 'bridge_v', 'ruins']);
  A.worldBbg = (m, x, y) => {
    const id = m.tileAt(x, y), t = R.DB.tiles[id] || {};
    if (GROUND_BBG.has(id)) { const k = resolveClass(m, x, y); if (CLASS_BBG[k]) return CLASS_BBG[k]; }
    return t.bbg || null;
  };
  /** (tests) the ground-class field of a cell over its 20×20 extended area (2 px margin) */
  A.worldTileField = (m, x, y) => { tk(); return { cls: field(classes9(m, x, y)).cls, EW, MG }; };
  A.WORLD_CLASS = { TCLS, clsOf, isWater, NAMES: ['sea', 'barrier', 'grass', 'plain', 'desert', 'snow', 'swamp', 'beach', 'waste', 'magma', 'marsh', 'ash', 'fog'] };

  // Standalone 'tile:<id>' for world tiles: the tile in a neutral neighbourhood.
  const WORLD_IDS = ['sea', 'reef', 'barrier', 'fog', 'river', 'grass', 'plain', 'road', 'beach', 'desert', 'sandstorm', 'snow',
    'marsh', 'marsh_fog', 'swamp', 'wasteland', 'ash', 'magma', 'forest', 'snowforest', 'jungle', 'deadforest', 'hills',
    'mountain', 'cliff', 'ruins', 'secret_forest', 'secret_rock', 'bridge_h', 'bridge_v',
    'loc_castle', 'loc_town', 'loc_village', 'loc_port', 'loc_cave', 'loc_mine', 'loc_forest', 'loc_tower', 'loc_library',
    'loc_shrine', 'loc_temple', 'loc_manor', 'loc_pyramid', 'loc_volcano', 'loc_demon'];
  A.WORLD_TILE_IDS = WORLD_IDS;
  function neighbourhoodFor(id) {
    const around = id.startsWith('loc_') || ['hills', 'mountain', 'cliff', 'ruins', 'road', 'river', 'deadforest'].includes(id) ? (id === 'deadforest' ? 'marsh' : 'grass')
      : id === 'secret_forest' ? 'forest' : id === 'secret_rock' ? 'mountain' : id;
    return {
      id: 'tile', outside: 'sea',
      tileAt(x, y) {
        if (x === 0 && y === 0) return id;
        if (id === 'bridge_h') return y === 0 ? 'bridge_h' : 'sea';
        if (id === 'bridge_v') return x === 0 ? 'bridge_v' : 'sea';
        if (id === 'reef') return 'sea';
        if (id === 'road') return y === 0 ? 'road' : 'grass';
        if (id === 'river') return x === 0 ? 'river' : 'grass';
        if (id === 'cliff') return y === 0 ? 'cliff' : 'grass';
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
