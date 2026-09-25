// Chronicle themes for the themed local tiles (DESIGN §11.2.6 towns, §11.2.8
// dungeons): new theme rows and the new material kinds they use. This file loads
// BEFORE tiles_theme.js (localeCompare sorts '_' before '.'), so it only
// registers A.THEME_EXT; tiles_theme.js merges it into its tables:
//   TH     theme rows {fl, floor, wl, wall, door, col, tp?, top?, torch?, cap?,
//                      roof?, roofKind?, hw?, hwp?, band?, wainscot?, town?, outdoor?}
//   FLOOR  floor kinds  (t, P) → 16x16 seamless Buf
//   FACE   wall faces   (t, P, x) → 16x16 Buf (x = map column, for position variety)
//   TOP    wall tops    (t, P) → 16x16 Buf
//   COL    pillar painters (L, t, th) draw into the object layer
//   VARF   floor variant painters for kinds without grout (b, P, v, rng, t, theme)
//   CAPS   custom wall caps (b, P, t, x) for faces whose top edge is not masonry
//   TORCH  wall_torch styles (b, f, t, x0) drawn over a face
// All ramps are dark → light; colours are 0xRRGGBB ints (TK conventions).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;

  // ------------------------------------------------------------ helpers
  /** n-step ramp between two colours (dark → light), ends pushed a little outward */
  function grad(a, b, n, ext) {
    const t = tk(), e = ext == null ? 0.18 : ext, out = [];
    for (let i = 0; i < n; i++) {
      const k = -e + (1 + 2 * e) * (i / (n - 1));
      out.push(k < 0 ? t.mix(a, 0x0a0806, -k * 1.4) : k > 1 ? t.mix(b, 0xfff8e8, (k - 1) * 1.1) : t.mix(a, b, k));
    }
    return out;
  }
  const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);
  /** soft leaf clump (shaded disc) written wrapped into b */
  function clump(b, t, cx, cy, r, P, o) {
    o = o || {};
    const lx = -0.62, ly = -0.72;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / (r * (o.sy || 1));
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      // lumpy rim
      if (d2 > 0.72 && t.hash(x & 15, y & 15, o.seed || 3) < 0.45) continue;
      const nz = Math.sqrt(1 - d2);
      let l = (dx * lx + dy * ly + nz * 0.6 + 0.3) / 1.3;
      l += (t.hash(x & 15, y & 15, (o.seed || 3) + 5) - 0.5) * 0.28;
      const k = clampI(Math.floor(l * (P.length - (o.dark || 1))), 0, P.length - 1 - (o.top || 0));
      if (o.wrap === false) b.set(x, y, P[k]); else b.wset(x, y, P[k]);
    }
  }

  // ------------------------------------------------------------ floors
  const LEAFFALL = [0x5a3c1c, 0x7a5426, 0x946a30, 0xa87c3a];
  const FLOOR = {
    /** forest floor: dark earth, moss patches, fallen leaves and twigs */
    moss(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 401), h = t.hash(x, y, 405);
        if (h < 0.035) return P[1];
        if (h > 0.975) return P[3];
        return v < 0.3 && (x + y) % 2 ? t.mix(P[1], P[2], 0.55) : v > 0.74 && (x + y) % 2 ? t.mix(P[2], P[3], 0.5) : P[2];
      });
      b.wset(11, 5, LEAFFALL[1]); b.wset(12, 5, LEAFFALL[2]);
      return b;
    },
    /** heartwood inside the great tree: grain bands with growth-ring knots */
    roots(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const w = y + 1.4 * Math.sin((x / 16) * Math.PI * 2) + 0.8 * Math.sin((x / 8) * Math.PI * 2 + 1);
        const band = ((w % 5) + 5) % 5;
        if (band < 0.6) return P[1];
        if (band < 1.6) return P[2];
        if (band > 4.4) return t.mix(P[3], P[4], 0.5);
        return t.hash(x, y, 411) < 0.05 ? P[2] : P[3];
      });
      // two ring knots
      for (const [cx, cy] of [[4, 5], [12, 12]]) {
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
          const d = Math.sqrt((x * 0.75) ** 2 + y * y);
          if (d > 3) continue;
          b.wset(cx + x, cy + y, d < 0.8 ? P[0] : d < 1.7 ? P[3] : d < 2.4 ? P[1] : P[2]);
        }
      }
      return b;
    },
    /** open snow: soft drifts with blue shadow, glints */
    snowfield(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 421);
        if (v < 0.3) return (x + y) % 2 ? P[2] : P[3];
        if (v > 0.74) return P[4];
        return P[3];
      });
      for (const [x, y] of [[2, 3], [10, 1], [7, 9], [13, 11], [4, 14]]) { b.wset(x, y, 0xffffff); b.wset(x + 1, y + 1, P[2]); }
      return b;
    },
    /** parquet: basket weave of slats, varnished */
    parquet(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const qx = x >> 3, qy = y >> 3, lx = x & 7, ly = y & 7;
        const horiz = (qx + qy) % 2 === 0;
        const a = horiz ? ly : lx, bpos = horiz ? lx : ly;
        const slat = a >> 2, sa = a & 3;
        let col = slat ? P[3] : t.mix(P[2], P[3], 0.5);
        if (sa === 3) col = P[0];
        else if (sa === 0) col = P[4];
        else if (bpos === 7) col = P[1];
        else if (t.hash(x, y, 431) < 0.06) col = P[2];
        b.p[y * 16 + x] = col;
      }
      return b;
    },
    /** marsh ground: dark wet peat, grass tufts, a sheen of standing water */
    peat(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 451), h = t.hash(x, y, 453);
        if (h < 0.05) return P[0];
        if (h > 0.97) return P[3];
        return v < 0.36 ? P[1] : v > 0.7 ? t.mix(P[2], P[3], 0.35) : P[2];
      });
      return b;
    },
    /** blank page: fibrous white, faint ruled lines */
    paper(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const h = t.hash(x, y, 441), v = t.fnoise(x, y, 8, 16, 443);
        if (y === 5 || y === 13) return t.mix(P[3], 0x9aa4c8, 0.35);
        if (h < 0.05) return P[3];
        return v < 0.35 ? P[3] : P[4];
      });
      // a faint grey fleck of old ink
      b.wset(9, 9, P[2]); b.wset(10, 9, P[3]);
      return b;
    },
  };

  // floor variants for kinds without grout (tiles_theme floorVar hands these over)
  const VARF = {
    moss(b, P, v, rng, t, theme) {
      // a moss patch somewhere in every varied cell (kept off the edges so cells still meet)
      const mx = 4 + rng() * 8, my = 4 + rng() * 8, mr = 2.5 + rng() * 2;
      b.each((x, y, c) => { const e = ((x - mx) / mr) ** 2 + ((y - my) / (mr * 0.7)) ** 2; return e < 1 ? (e < 0.4 && (x + y) % 2 ? P[4] : P[3]) : e < 1.4 && (x + y) % 2 ? P[3] : undefined; });
      if (v === 1) { // fern
        const x = 3 + Math.floor(rng() * 9), y = 4 + Math.floor(rng() * 7);
        const G = [0x2a4a1c, 0x3c6426, 0x548032];
        for (let i = 0; i < 4; i++) { b.set(x - i, y - i + 3, G[1]); b.set(x + i, y - i + 3, G[1]); b.set(x - i, y - i + 2, G[2]); b.set(x + i, y - i + 2, G[0]); }
        b.set(x, y + 3, G[0]); b.set(x, y + 4, G[0]);
      } else if (v === 2) { // leaf pile
        for (let k = 0; k < 7; k++) { const x = 4 + Math.floor(rng() * 8), y = 4 + Math.floor(rng() * 8); const c = LEAFFALL[Math.floor(rng() * 4)]; b.set(x, y, c); b.set(x + 1, y, t.shade(c, 0.15)); }
      } else if (v === 3) { // pebble and grass tuft
        const x = 3 + Math.floor(rng() * 9), y = 3 + Math.floor(rng() * 9);
        b.set(x, y, 0x7a7a6a); b.set(x + 1, y, 0x5a5a4c); b.set(x, y + 1, 0x4a4a3c);
        const G = [0x3c5a24, 0x5a7a30, 0x78963e];
        b.set(x + 4, y - 2, G[2]); b.set(x + 5, y - 1, G[1]); b.set(x + 3, y - 1, G[1]); b.set(x + 4, y - 1, G[2]); b.set(x + 4, y, G[0]);
      }
      return b;
    },
    snowfield(b, P, v, rng, t) {
      if (v === 1) { // footprints
        let x = 2 + Math.floor(rng() * 4), y = 1;
        while (y < 15) { b.set(x, y, P[1]); b.set(x + 1, y, P[2]); b.set(x, y + 1, P[2]); x += (y & 2) ? 2 : -1; y += 3; }
      } else if (v === 2) { // stone peeking through
        const x = 4 + Math.floor(rng() * 7), y = 6 + Math.floor(rng() * 5);
        const S = [0x3c3e48, 0x5c5e68, 0x80828c];
        b.hline(x, x + 3, y + 1, S[1]); b.hline(x - 1, x + 4, y + 2, S[1]); b.set(x - 1, y + 2, S[2]); b.set(x + 4, y + 2, S[0]);
        b.hline(x, x + 3, y, P[4]); b.set(x + 1, y - 1, P[4]); b.hline(x, x + 4, y + 3, P[1]);
      } else if (v === 3) { // drift hollow
        const cx = 4 + rng() * 8, cy = 5 + rng() * 6;
        b.each((x, y, c) => { const e = ((x - cx) / 4.5) ** 2 + ((y - cy) / 2.2) ** 2; return e < 1 ? (y < cy ? P[2] : P[4]) : undefined; });
      }
      return b;
    },
    peat(b, P, v, rng, t) {
      if (v === 1 && rng() < 0.5) { // standing water
        const cx = 4 + rng() * 8, cy = 4 + rng() * 8;
        const W = [0x1c2a2a, 0x2a3c3c, 0x3c5050, 0x5a7070];
        b.each((x, y, c) => { const e = ((x - cx) / 4) ** 2 + ((y - cy) / 2.2) ** 2; return e < 1 ? (y < cy - 1 ? W[1] : e > 0.6 ? W[0] : W[2]) : undefined; });
        b.set(Math.round(cx) - 1, Math.round(cy), W[3]);
      } else if (v === 2) { // a reed tuft
        const x = 4 + Math.floor(rng() * 8), y = 5 + Math.floor(rng() * 6);
        const G = [0x3a4424, 0x56622e, 0x76843e];
        for (let k = 0; k < 5; k++) { b.set(x - 2 + k, y + 3 - (k % 2), G[1]); b.set(x - 2 + k, y + 2 - (k % 2) - (k === 2 ? 2 : 0), G[2]); }
        b.vline(x, y - 1, y + 3, G[2]); b.set(x, y - 2, 0x6c4622); b.set(x, y - 3, 0x5a3a1c);
      } else if (v === 3) { // a drowned branch
        const y = 4 + Math.floor(rng() * 8);
        for (let x = 3; x < 12; x++) { b.set(x, y + ((x >> 2) & 1), 0x2e2418); b.set(x, y + 1 + ((x >> 2) & 1), 0x1c160e); }
        b.set(6, y - 1, 0x2e2418); b.set(10, y + 3, 0x2e2418);
      }
      return b;
    },
    paper(b, P, v, rng, t) {
      if (v === 3 && rng() < 0.45) { // (rare) torn slit showing the ink void beneath
        const y0 = 3 + Math.floor(rng() * 9);
        let y = y0;
        for (let x = 2; x < 14; x++) { b.set(x, y, 0x101018); b.set(x, y + 1, P[1]); if (rng() < 0.4) y += rng() < 0.5 ? 1 : -1; y = clampI(y, y0 - 2, y0 + 2); }
      } else if (v === 1) { // faded writing
        for (let x = 3; x < 13; x++) if (rng() < 0.6) b.set(x, 4, t.mix(P[3], 0x404050, 0.35));
        for (let x = 3; x < 10; x++) if (rng() < 0.6) b.set(x, 12, t.mix(P[3], 0x404050, 0.3));
      } else if (v === 2) { // crease
        for (let i = 0; i < 12; i++) { b.set(2 + i, 2 + i, P[2]); b.set(3 + i, 2 + i, P[4]); }
      }
      return b;
    },
  };

  // ------------------------------------------------------------ wall faces
  const TRUNK = [0x1c1008, 0x2e1c0e, 0x442c18, 0x5a3c22, 0x74502e];
  const FACE = {
    /** forest wall: canopy fringe over a row of trunks, dark wood depth between */
    canopy(t, P, x) {
      const b = t.tile(P[0]);
      const s = (x | 0) * 7;
      // depth: murky undergrowth between trunks
      for (let y = 5; y < 16; y++) for (let i = 0; i < 16; i++) {
        const v = t.fnoise(i + s, y, 4, 64, 451);
        b.set(i, y, v > 0.62 ? P[1] : y > 12 && v > 0.45 ? P[1] : P[0]);
      }
      // trunks (two per cell, offset per column)
      const tx = [2 + (s % 3), 10 + ((s >> 2) % 3)];
      for (const x0 of tx) {
        const w = 3 + ((x0 + s) % 2);
        for (let y = 4; y < 16; y++) for (let i = 0; i < w; i++) {
          const u = i / (w - 1);
          let c = u < 0.3 ? TRUNK[3] : u > 0.75 ? TRUNK[1] : TRUNK[2];
          if ((y + i * 3 + x0) % 5 === 0) c = TRUNK[1];
          b.set(x0 + i, y, c);
        }
        // root flare
        b.set(x0 - 1, 15, TRUNK[2]); b.set(x0 + w, 15, TRUNK[1]); b.set(x0 - 1, 14, TRUNK[1]);
      }
      // ferns at the foot
      const G = [P[2], P[3], P[4]];
      for (let i = 0; i < 16; i += 3) { const h = 1 + ((i + s) % 3); for (let k = 0; k < h; k++) b.set(i + (k & 1), 15 - k, G[Math.min(2, k)]); }
      // canopy fringe (leaf clumps hanging over the face)
      const F = P.slice(1);
      for (let i = -2; i < 18; i += 4) clump(b, t, i + ((s + i) % 3) - 1, 2.5 + ((i + s) % 2), 3.4, F, { wrap: false, seed: 455 + i });
      return b;
    },
    /** living bark: vertical ridges and crevices, a few horizontal cracks */
    bark(t, P, x) {
      const b = t.tile();
      const s = (x | 0) * 5;
      for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
        const col = Math.floor(i / 4);
        const w = i + 0.7 * Math.sin((y + s * 3 + col * 5) * 0.42);
        const r = ((w % 4) + 4) % 4;
        let c = r < 0.8 ? P[0] : r < 1.5 ? P[4] : r < 2.4 ? P[3] : r < 3.3 ? P[2] : P[1];
        // bark plates: a break in each ridge every few pixels
        const py = (y + col * 5 + s) % 7;
        if (py === 0 && r >= 0.8) c = P[1];
        else if (py === 1 && r >= 0.8 && r < 2.4) c = t.mix(c, P[5] || P[4], 0.3);
        b.set(i, y, c);
      }
      // a knot hole
      if (s % 3 === 1) { b.set(8, 8, P[0]); b.set(9, 8, P[0]); b.set(8, 9, P[0]); b.set(9, 9, P[1]); b.set(7, 8, P[4]); b.set(8, 7, P[4]); }
      return b;
    },
    /** snowy crag: rock with snow lying on every ledge */
    snowrock(t, P) {
      const b = A.THEME_FACE_BASE.rock(t, P);
      const src = b.clone();
      for (let y = 1; y < 16; y++) for (let x = 0; x < 16; x++) {
        const c = src.get(x, y), up = src.get(x, y - 1);
        if (c !== P[0] && up === P[0]) { b.set(x, y, 0xf2f6fa); if (t.hash(x, y, 471) < 0.6) b.set(x, y + 1, 0xd0dae6); }
      }
      return b;
    },
    /** faded striped wallpaper over a dark wainscot, peeling in places */
    wallpaper(t, P, x) {
      const b = t.tile();
      const s = (x | 0);
      for (let y = 0; y < 10; y++) for (let i = 0; i < 16; i++) {
        const stripe = i % 8;
        let c = P[2];
        if (stripe === 1 || stripe === 3) c = P[3];
        else if (stripe === 2) c = P[4];
        // a small faded motif between the stripes
        if (stripe === 6 && (y % 5 === 1 || y % 5 === 3)) c = P[3];
        if (stripe === 6 && y % 5 === 2) c = P[4];
        if ((stripe === 5 || stripe === 7) && y % 5 === 2) c = P[3];
        if (t.hash(i, y + s * 16, 481) < 0.04) c = P[1];
        b.set(i, y, c);
      }
      // the paper peels where the house has decayed: a curled corner over bare plaster
      if (t.hash(s, 0, 483) < 0.4) {
        const cx = 3 + Math.floor(t.hash(s, 1, 485) * 9), cy = 2 + Math.floor(t.hash(s, 2, 487) * 4);
        for (let y = 0; y < 3; y++) for (let i = 0; i < 4 - y; i++) b.set(cx + i, cy + y, 0xa89c8c);
        b.set(cx, cy + 3, 0x8c8070);
        b.set(cx + 3, cy, P[4]); b.set(cx + 2, cy + 1, P[4]); b.set(cx + 1, cy + 2, P[4]); b.set(cx + 3, cy + 1, P[1]);
      }
      // chair rail and panelled wainscot
      const W = [0x1c1010, 0x2e1c18, 0x442a22, 0x5a3a2e, 0x704c3a];
      b.hline(0, 15, 10, W[4]); b.hline(0, 15, 11, W[1]);
      for (let y = 12; y < 16; y++) for (let i = 0; i < 16; i++) {
        const px = i % 8;
        b.set(i, y, px === 0 ? W[3] : px === 7 ? W[0] : y === 12 ? W[3] : y === 15 ? W[0] : W[2]);
      }
      return b;
    },
    /** reed thicket rising from black water */
    reeds(t, P, x) {
      const b = t.tile(P[0]);
      const s = (x | 0) * 11;
      for (let i = 0; i < 16; i++) {
        const h = 9 + Math.floor(t.hash(i + s, 0, 491) * 7);
        const lean = t.hash(i + s, 1, 493) < 0.3 ? 1 : 0;
        const col = [P[2], P[3], P[4], P[3]][(i + s) % 4];
        for (let y = 16 - h; y < 16; y++) b.set(i + (y < 16 - h + 3 ? lean : 0), y, y < 16 - h + 1 ? P[5] : col);
        if ((i + s) % 5 === 2) { // cattail
          const y0 = 16 - h;
          b.set(i, y0 - 1, 0x5a3a1c); b.set(i, y0, 0x6c4622); b.set(i, y0 + 1, 0x4a2c14); b.set(i, y0 - 2, P[3]);
        }
      }
      // murky water line at the foot
      for (let i = 0; i < 16; i++) { b.set(i, 14, t.mix(b.get(i, 14), 0x1c2a2c, 0.55)); b.set(i, 15, 0x1a2426); }
      return b;
    },
    /** ship's hull from inside: planks (strakes) and ribs */
    hull(t, P, x) {
      const b = t.tile();
      const s = (x | 0);
      for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
        const row = y >> 2, ry = y & 3;
        const seam = (i + row * 5 + s * 3) % 16 === 0;
        let c = ry === 3 ? P[1] : ry === 0 ? P[4] : P[3];
        if (seam) c = P[1];
        if (t.hash(i + s * 16, y, 501) < 0.05) c = P[2];
        b.set(i, y, c);
      }
      // rib every other cell
      if (s % 2 === 0) for (let y = 0; y < 16; y++) { b.set(6, y, P[1]); b.set(7, y, P[4]); b.set(8, y, P[5] || P[4]); b.set(9, y, P[3]); b.set(10, y, P[1]); }
      // tarred seams and treenails
      for (const [i, y] of [[3, 2], [13, 6], [3, 10], [13, 14]]) b.set(i, y, P[0]);
      return b;
    },
    /** mine gallery: rock face (posts are added by FACE_AT) */
    timber(t, P) { return A.THEME_FACE_BASE.rock(t, P); },
    /** the great archive: a white stone bookcase full of books */
    shelves(t, P, x) {
      const b = t.tile(P[3]);
      const s = (x | 0);
      const SP = [[0x8c2828, 0xb44038], [0x2c6a3a, 0x3c8a4c], [0x2c4a8c, 0x3c64b0], [0x6a4428, 0x8a5c38]];
      // frame
      b.vline(0, 0, 15, P[4]); b.vline(15, 0, 15, P[1]);
      for (const sy of [1, 6, 11]) {
        b.rect(1, sy, 14, 4, 0x1c1c28);
        let i = 1, k = s * 3 + sy;
        while (i < 15) {
          const w = t.hash(i + s * 16, sy, 511) < 0.3 ? 2 : 1;
          const [dk, lt] = SP[(k++) % 4];
          const h = t.hash(i + s * 16, sy, 513) < 0.25 ? 3 : 4;
          for (let q = 0; q < w && i + q < 15; q++) for (let y = sy + 4 - h; y < sy + 4; y++) b.set(i + q, y, q === 0 ? lt : dk);
          if (h === 4) b.set(i, sy + 1, 0xe0c060); // gilt band on the spine
          i += w;
          if (t.hash(i + s * 16, sy, 515) < 0.12 && i < 13) { b.set(i, sy + 1, SP[k % 4][1]); b.set(i + 1, sy + 2, SP[k % 4][1]); b.set(i + 1, sy + 3, SP[k % 4][0]); b.set(i, sy + 3, 0x1c1c28); i += 2; } // a leaning book
        }
        b.hline(0, 15, sy + 4, P[4]); b.hline(1, 14, sy + 4, P[3]);
      }
      b.hline(0, 15, 0, P[4]);
      b.hline(0, 15, 15, P[2]);
      return b;
    },
    /** the unwritten: ink-black with faint grey drift */
    void(t, P, x) {
      const s = (x | 0) * 9;
      const b = t.tex(16, 16, (i, y) => {
        const v = t.fnoise(i + s, y, 8, 64, 521);
        return v > 0.7 ? P[2] : v > 0.52 ? P[1] : P[0];
      });
      for (const [i, y] of [[3, 4], [12, 9], [7, 13]]) if (t.hash(i + s, y, 523) < 0.6) b.set(i, y, P[4]);
      return b;
    },
    /** stacked logs with rounded shading (log cabins, stockades) */
    logs(t, P, x) {
      const b = t.tile();
      const s = (x | 0);
      for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
        const ry = y % 4;
        let c = ry === 0 ? P[4] : ry === 1 ? P[3] : ry === 2 ? P[2] : P[0];
        if (ry !== 3 && t.hash(i + s * 16, y >> 2, 531) < 0.08) c = P[1];
        if (ry === 1 && (i + (y >> 2) * 5 + s * 3) % 9 === 0) c = P[2];
        b.set(i, y, c);
      }
      // chinking between logs
      for (let y = 3; y < 16; y += 4) for (let i = 0; i < 16; i++) if ((i + y) % 3 === 0) b.set(i, y, t.mix(P[1], 0xa89878, 0.4));
      return b;
    },
  };
  // position-dependent overlays on faces (mine timbering)
  const FACE_AT = {
    timber(b, t, P, x, cap) {
      const W = [0x2a1a0c, 0x44301a, 0x5e4426, 0x7a5a34, 0x96744a];
      const y0 = cap ? 4 : 1;
      // cap beam (lintel) across every cell
      for (let i = 0; i < 16; i++) { b.set(i, y0, W[3]); b.set(i, y0 + 1, W[2]); b.set(i, y0 + 2, W[1]); }
      if (((x % 3) + 3) % 3 === 0) {
        // a post under the lintel with a wedge
        for (let y = y0 + 2; y < 16; y++) { b.set(6, y, W[1]); b.set(7, y, W[4]); b.set(8, y, W[3]); b.set(9, y, W[2]); b.set(10, y, W[0]); }
        b.hline(5, 11, y0 + 3, W[3]); b.set(5, y0 + 3, W[4]); b.set(11, y0 + 3, W[1]);
        for (const y of [y0 + 6, y0 + 10]) if (y < 16) { b.set(7, y, W[2]); b.set(8, y, W[2]); }
      }
      return b;
    },
  };

  // custom caps: the lit top strip of a thin wall whose upper neighbour is floor
  const CAPS = {
    canopy(b, P, t) { for (let x = 0; x < 16; x++) { if (b.get(x, 0) !== t.NONE) b.set(x, 0, t.shade(P[5], 0.1)); if (x % 3 === 1) b.set(x, 1, P[5]); } },
    reeds(b, P, t) { for (let x = 0; x < 16; x += 2) b.set(x, Math.max(0, 16 - 16), P[5]); },
    void(b, P, t) {
      // a torn white edge where the page ends
      for (let x = 0; x < 16; x++) {
        const d = 1 + Math.round(t.vnoise(x, 0, 3, 16, 541) * 2);
        for (let y = 0; y < d; y++) b.set(x, y, y === d - 1 ? 0xb8b8c0 : 0xeeeee8);
        b.set(x, d, 0x2a2a34);
      }
    },
    hull(b, P, t) {
      // gunwale: a heavy rail cap
      for (let x = 0; x < 16; x++) { b.set(x, 0, P[1]); b.set(x, 1, P[5] || P[4]); b.set(x, 2, P[4]); b.set(x, 3, P[2]); b.set(x, 4, t.mul(b.get(x, 4), 0.7)); }
      for (let x = 2; x < 16; x += 8) { b.set(x, 1, 0x9a9aa8); b.set(x, 2, 0x5a5a66); }
    },
    shelves(b, P, t) { for (let x = 0; x < 16; x++) { b.set(x, 0, P[1]); b.set(x, 1, P[4]); b.set(x, 2, P[3]); b.set(x, 3, P[2]); } },
    wallpaper(b, P, t) {
      // crown moulding
      const W = [0x1c1010, 0x2e1c18, 0x442a22, 0x5a3a2e, 0x704c3a];
      for (let x = 0; x < 16; x++) { b.set(x, 0, W[0]); b.set(x, 1, W[4]); b.set(x, 2, W[2]); b.set(x, 3, x % 4 === 0 ? W[3] : W[1]); b.set(x, 4, t.mul(b.get(x, 4), 0.72)); }
    },
  };

  // ------------------------------------------------------------ wall tops
  const TOP = {
    /** a dense leaf canopy seen from above */
    canopy(t, P) {
      const b = t.tile(P[1]);
      const F = P.slice(1);
      const pts = [[3, 3, 4.2], [11, 2, 4], [7, 9, 4.4], [15, 10, 3.8], [2, 13, 3.6], [11, 15, 3.4]];
      for (const [x, y, r] of pts) clump(b, t, x, y, r, F, { seed: 551 + x });
      return b;
    },
    /** end grain of the great tree's wood (growth rings) */
    rings(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(((x + 8) % 16) - 8 + 0.5, ((y + 8) % 16) - 8 + 0.5) + t.fnoise(x, y, 8, 16, 561) * 1.5;
        const r = d % 3;
        b.p[y * 16 + x] = r < 0.8 ? P[1] : r < 2 ? P[3] : P[2];
      }
      return b;
    },
    /** snow-capped rock seen from above */
    snowcap(t, P) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 571) * 0.6 + t.fnoise(x, y, 4, 16, 573) * 0.4;
        if (v < 0.2) return (x + y) % 2 ? P[2] : P[1];
        if (v < 0.3) return 0xc8d2de;
        return v > 0.7 ? 0xffffff : v > 0.5 ? 0xf0f4f8 : 0xdfe6ee;
      });
      return b;
    },
    /** reed tips seen from above */
    reedtop(t, P) {
      const b = t.tile(P[2]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const h = t.hash(x, Math.floor((y + (x * 5) % 3) / 3), 581);
        if (h < 0.3) b.p[y * 16 + x] = P[3];
        else if (h < 0.38) b.p[y * 16 + x] = P[4];
        else if (h > 0.9) b.p[y * 16 + x] = P[1];
      }
      for (const [x, y] of [[3, 4], [11, 9], [6, 13]]) { b.set(x, y, 0x6c4622); b.set(x, y + 1, 0x4a2c14); }
      return b;
    },
    /** ship rail seen from above: planks lengthwise */
    rail(t, P) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const lx = x % 4;
        b.p[y * 16 + x] = lx === 3 ? P[1] : lx === 0 ? P[4] : t.hash(x, y, 591) < 0.06 ? P[2] : P[3];
      }
      for (let x = 1; x < 16; x += 4) { b.set(x, 5, P[1]); b.set(x, 13, P[1]); }
      return b;
    },
    /** nothing at all: ink void with a faint grey stir */
    void(t, P) { return t.tex(16, 16, (x, y) => (t.fnoise(x, y, 8, 16, 601) > 0.7 ? P[1] : P[0])); },
  };
  const TOP_OF = { canopy: 'canopy', bark: 'rings', snowrock: 'snowcap', wallpaper: 'beam', reeds: 'reedtop', hull: 'rail', timber: 'rock', shelves: 'stone', void: 'void', logs: 'beam' };
  // custom top edges (ragged instead of an ink line)
  const TOP_EDGE = {
    canopy(b, e, P, t) {
      const ink = P[0];
      for (let i = 0; i < 16; i++) {
        const d = t.hash(i, 1, 611) < 0.5 ? 0 : 1;
        if (e.n) { for (let k = 0; k <= d; k++) b.set(i, k, ink); }
        if (e.w) { for (let k = 0; k <= d; k++) b.set(k, i, ink); }
        if (e.e) { for (let k = 0; k <= d; k++) b.set(15 - k, i, ink); }
      }
    },
    void(b, e, P, t) {
      for (let i = 0; i < 16; i++) {
        const d = t.hash(i, 3, 613) < 0.5 ? 1 : 2;
        if (e.n) for (let k = 0; k < d; k++) b.set(i, k, k === d - 1 ? 0xb8b8c0 : 0xeeeee8);
        if (e.w) for (let k = 0; k < d; k++) b.set(k, i, k === d - 1 ? 0xb8b8c0 : 0xeeeee8);
        if (e.e) for (let k = 0; k < d; k++) b.set(15 - k, i, k === d - 1 ? 0x9898a0 : 0xd8d8d0);
      }
    },
  };

  // ------------------------------------------------------------ pillars
  const COL = {
    /** a great tree trunk with roots gripping the floor */
    trunk(L, t, th) {
      const P = TRUNK;
      for (let y = 0; y < 14; y++) for (let x = 4; x < 12; x++) {
        const u = (x - 4) / 7;
        let c = u < 0.2 ? P[4] : u < 0.45 ? P[3] : u < 0.8 ? P[2] : P[1];
        if ((y * 2 + x * 5) % 7 === 0) c = P[1];
        L.set(x, y, c);
      }
      // roots
      L.poly([[1, 15.5], [4, 11], [5, 15.5]], P[2]); L.poly([[11, 15.5], [12, 11], [15, 15.5]], P[1]);
      L.poly([[6, 15.5], [7, 12], [9, 12], [10, 15.5]], P[2]);
      L.set(2, 14, P[3]); L.set(7, 13, P[3]);
      // moss and a low leafy tuft
      const G = [0x2c4a1c, 0x3c6426, 0x548032];
      L.set(5, 6, G[1]); L.set(5, 7, G[2]); L.set(6, 7, G[1]); L.set(10, 3, G[0]);
    },
    /** a dead bare tree (swamp) */
    deadtree(L, t, th) {
      const P = [0x2a241c, 0x443c30, 0x5e5444, 0x786c58, 0x92866e];
      for (let y = 3; y < 16; y++) { const w = y > 13 ? 4 : 2; for (let x = 7 - (w >> 1); x <= 8 + (w >> 1) - 1 + (y > 13 ? 1 : 0); x++) L.set(x, y, x < 8 ? P[3] : P[1]); }
      L.line(7, 7, 3, 2, P[2]); L.line(3, 2, 2, 0, P[2]); L.line(8, 5, 12, 1, P[1]); L.line(10, 3, 12, 4, P[1]);
      L.line(7, 10, 4, 8, P[2]); L.set(4, 1, P[3]); L.set(12, 0, P[2]);
      L.set(6, 15, P[2]); L.set(10, 15, P[1]); L.set(5, 15, P[1]);
      // hanging moss
      L.set(3, 3, 0x6a7a58); L.set(3, 4, 0x5a6a4a); L.set(11, 2, 0x6a7a58); L.set(11, 3, 0x5a6a4a); L.set(11, 4, 0x4a5a3c);
    },
    /** a ship's mast: iron bands, belaying pins, rope */
    mast(L, t, th) {
      const W = [0x2a1a0c, 0x44301a, 0x5e4426, 0x7a5a34, 0x96744a, 0xb08c5c];
      for (let y = 0; y < 15; y++) for (let x = 5; x < 11; x++) {
        const u = (x - 5) / 5;
        L.set(x, y, u < 0.25 ? W[5] : u < 0.5 ? W[4] : u < 0.8 ? W[3] : W[1]);
      }
      for (const y of [2, 9]) { L.hline(4, 11, y, 0x4a4a56); L.hline(4, 11, y + 1, 0x2a2a34); L.set(5, y, 0x8a8a98); }
      // fife rail with pins and coiled rope
      L.hline(1, 14, 12, W[3]); L.hline(1, 14, 13, W[1]); L.set(1, 14, W[1]); L.set(14, 14, W[0]);
      for (const x of [2, 13]) { L.set(x, 11, W[5]); L.set(x, 10, W[4]); }
      L.ellipse(3, 14.5, 2, 1, 0xb49c6c); L.set(3, 14, 0x8c7448);
      L.ellipse(12.5, 14.5, 1.6, 1, 0x9c845a); L.set(12, 14, 0x7c6440);
      // halyards running up the mast
      L.vline(4, 0, 11, 0xa89060); L.vline(11, 0, 11, 0x8c7448);
      L.set(4, 5, 0x6c5838); L.set(11, 7, 0x6c5838);
    },
    /** living roots twisting into a column (inside the great tree) */
    rootcol(L, t, th) {
      const P = th.wl;
      for (let y = 0; y < 15; y++) for (let x = 4; x < 12; x++) {
        const u = (x - 4) / 7;
        let c = u < 0.2 ? P[4] : u < 0.45 ? P[3] : u < 0.8 ? P[2] : P[1];
        // twisting grooves of the living root
        const g = (x - 4 + y * 0.5) % 4;
        if (g < 0.6) c = P[1];
        else if (g < 1.1) c = t.mix(c, P[5] || P[4], 0.25);
        L.set(x, y, c);
      }
      L.poly([[1, 15.5], [4, 11], [5, 15.5]], P[2]); L.poly([[11, 15.5], [12, 11], [15, 15.5]], P[1]);
      L.poly([[6, 15.5], [7, 12], [9, 12], [10, 15.5]], P[2]);
      L.set(2, 14, P[3]); L.set(7, 13, P[4]);
      // glowing sap beads and a small shelf fungus
      L.set(6, 5, 0xd8f0a0); L.set(9, 10, 0xb8e890);
      L.hline(9, 12, 7, 0xc8b890); L.hline(10, 12, 8, 0x8c7c5c);
    },
  };

  // ------------------------------------------------------------ torches
  const TORCH = {
    /** glowing mushrooms on the tree wall (2 frames, a gentle pulse) */
    mushroom(b, f, t) {
      const C = f ? [0x3c8c9c, 0x68c8d0, 0xb8f4f0] : [0x347c8c, 0x5cb8c4, 0xa8ece8];
      const glowR = f ? 5.4 : 5;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 8);
        if (d < glowR && (d < 3 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0x80e8e0, d < 3 ? 0.28 : 0.14));
      }
      const cap = (cx, cy, w) => {
        for (let x = -w; x <= w; x++) { b.set(cx + x, cy, C[1]); b.set(cx + x, cy + 1, x > 0 ? C[0] : C[1]); }
        b.hline(cx - w + 1, cx + w - 1, cy - 1, C[2]); b.set(cx - w + 1, cy - 1, 0xffffff);
        b.set(cx, cy + 2, 0xd8d0b8); b.set(cx, cy + 3, 0xb0a890);
      };
      cap(6, 6, 2); cap(10, 9, 1); cap(5, 11, 1);
    },
    /** a ship / manor lantern on a bracket */
    lantern(b, f, t) {
      for (let y = 0; y < 12; y++) for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 7);
        if (d < (f ? 5.2 : 5.8) && (d < 3.2 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0xffc060, d < 3.2 ? 0.26 : 0.14));
      }
      b.hline(5, 10, 2, 0x2a2a30); b.set(10, 3, 0x2a2a30); b.set(10, 1, 0x4a4a54);
      b.rect(6, 4, 4, 6, 0x3a3a44); b.rect(7, 5, 2, 4, f ? 0xffd070 : 0xffe898); b.set(7, 5, 0xfff8d0);
      b.hline(6, 9, 3, 0x5a5a66); b.hline(6, 9, 10, 0x2a2a34); b.set(7, 11, 0x2a2a34); b.set(8, 11, 0x2a2a34);
    },
    /** the ghost ship's lamp: a lantern burning pale blue-white (§11.2.11 「青白い灯」) */
    ghostlamp(b, f, t) {
      for (let y = 0; y < 12; y++) for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 7.5, y - 7);
        if (d < (f ? 5.4 : 6) && (d < 3.2 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0xa8d8ff, d < 3.2 ? 0.28 : 0.15));
      }
      b.hline(5, 10, 2, 0x2a2a30); b.set(10, 3, 0x2a2a30); b.set(10, 1, 0x4a4a54);
      b.rect(6, 4, 4, 6, 0x2e3440); b.rect(7, 5, 2, 4, f ? 0xb8e4ff : 0xe0f4ff); b.set(7, 5, 0xffffff);
      b.hline(6, 9, 3, 0x4a5260); b.hline(6, 9, 10, 0x22262e); b.set(7, 11, 0x22262e); b.set(8, 11, 0x22262e);
    },
    /** a small oil lamp in a wall niche (library) */
    candle(b, f, t) {
      for (let y = 0; y < 14; y++) for (let x = 3; x < 13; x++) {
        const d = Math.hypot(x - 7.5, y - 6);
        if (d < (f ? 4.2 : 4.8) && (d < 2.6 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0xfff0b0, d < 2.6 ? 0.3 : 0.16));
      }
      b.rect(6, 8, 4, 2, 0xc8a040); b.hline(5, 10, 10, 0x8c6414); b.set(6, 8, 0xf0d070);
      b.vline(8, 5, 7, 0xfff8e0); b.set(8, 4, f ? 0xffc040 : 0xffe070); b.set(8, 3, 0xfff0a0); if (!f) b.set(7, 4, 0xffa030);
    },
    /** a pale drifting flame (oblivion, marsh wisps) */
    wisp(b, f, t) {
      const cy = f ? 6 : 7;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, (y - cy) * 1.1);
        if (d < 5.5 && (d < 3 || (x + y + f) % 2 === 0)) b.set(x, y, t.mix(b.get(x, y), 0xc8e8ff, d < 3 ? 0.3 : 0.15));
      }
      const fl = [[7, cy - 3], [8, cy - 2], [7, cy - 2], [6, cy - 1], [7, cy - 1], [8, cy - 1], [9, cy], [6, cy], [7, cy], [8, cy], [7, cy + 1], [8, cy + 1]];
      for (const [x, y] of fl) b.set(x, y, 0x9cd0ff);
      b.set(7, cy, 0xffffff); b.set(8, cy, 0xe0f4ff); b.set(7, cy - 1, 0xe0f4ff);
    },
  };

  // ------------------------------------------------------------ theme rows
  // (P1 ramps from DESIGN §11.2.8 / §11.2.6; kinds are the P2 materials)
  const WOODR = [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468];
  const TH = {
    // --- dungeons
    forest: { fl: [0x2a2a14, 0x3c3e1c, 0x4e5226, 0x626830, 0x7a803e], floor: 'moss', wl: [0x0e1a10, 0x162a16, 0x20381e, 0x2c4a26, 0x3c5e30, 0x587642], wall: 'canopy', door: 'wood', col: 'trunk', outdoor: true },
    tree: { fl: [0x3a2616, 0x543822, 0x6c4a2e, 0x86603c, 0xa07a50], floor: 'roots', wl: [0x24160c, 0x3c2614, 0x543822, 0x6c4a2e, 0x86603c, 0xa07a50], wall: 'bark', door: 'wood', col: 'rootcol', torch: 'mushroom' },
    snow: { fl: [0x8a94a8, 0xaab2c2, 0xcad0da, 0xe0e4ec, 0xf4f6fa], floor: 'snowfield', wl: [0x4a5264, 0x6a7488, 0x8a94a8, 0xaab2c2, 0xcad0da, 0xe8ecf0], wall: 'snowrock', door: 'ice', col: 'ice', outdoor: true },
    manor: { fl: [0x2c2020, 0x46302c, 0x5c403a, 0x74524a, 0x8c665c], floor: 'parquet', wl: [0x2a2432, 0x423a4c, 0x5a5066, 0x72687e, 0x8c8298], wall: 'wallpaper', door: 'wood', col: 'wood', torch: 'lantern' },
    swamp: { fl: [0x222618, 0x323620, 0x42482a, 0x545a34, 0x686e42], floor: 'peat', wl: [0x141a10, 0x1e2818, 0x2a3620, 0x384628, 0x485834, 0x5e6c44], wall: 'reeds', door: 'wood', col: 'deadtree', torch: 'wisp', outdoor: true },
    ship: { fl: [0x2a2018, 0x40302a, 0x564236, 0x6c5644, 0x846c58, 0x9c846c], floor: 'planks', wl: [0x1a1614, 0x2e2622, 0x443830, 0x5a4a3e, 0x72604e, 0x8a7864], wall: 'hull', door: 'wood', col: 'mast', torch: 'ghostlamp' },
    mine: { fl: [0x2e2620, 0x463a30, 0x5c4e40, 0x746452, 0x8c7c68], floor: 'dirt', wl: [0x201810, 0x3a2c20, 0x54402e, 0x6c5640, 0x866e54, 0xa08a6c], wall: 'timber', door: 'wood', col: 'wood', torch: 'lantern' },
    library: { fl: [0x7a7c88, 0xa0a2ae, 0xc4c6d0, 0xdcdee6, 0xf2f2f6], floor: 'marble', wl: [0x6c6e7c, 0x8e909e, 0xb0b2c0, 0xcacce0, 0xe6e8f4], wall: 'shelves', door: 'shrine', col: 'marble', torch: 'candle', band: 0x8c6414 },
    oblivion: { fl: [0x6a6a78, 0x9898a6, 0xc4c4cc, 0xe4e2dc, 0xf8f6ee], floor: 'paper', wl: [0x18181e, 0x2a2a34, 0x3e3e4a, 0x545462, 0x6c6c7a, 0x8a8a98], wall: 'void', door: 'demon', col: 'marble', torch: 'wisp' },
    // --- towns (outdoor; floor = street, wall = town walls & interior walls)
    town_roa: { fl: [0x4a3a24, 0x6a5434, 0x86704a, 0xa08a60, 0xb8a47a], floor: 'dirt', wl: [0x2c2a24, 0x4c4840, 0x6c665a, 0x8c8676, 0xaca694], wall: 'rubble', door: 'wood', col: 'wood', town: true, roof: [0x8a7040, 0xc8a860], roofKind: 'thatch', hw: 'timber', grassy: true },
    town_forest: { fl: [0x3a3020, 0x524630, 0x6a5e3e, 0x80764e, 0x988e62], floor: 'dirt', wl: [0x2a1a0e, 0x44301a, 0x5e4426, 0x7a5a34, 0x967446, 0xb0905c], wall: 'logs', door: 'wood', col: 'trunk', town: true, roof: [0x3c5a30, 0x7a9a54], roofKind: 'shingle', mossy: true, hw: 'log' },
    town_sand: { fl: [0x6c5434, 0x947650, 0xb49668, 0xccb082, 0xe0c89e], floor: 'blocks', wl: [0x5a4428, 0x846640, 0xa88658, 0xc4a272, 0xd8bc90], wall: 'sandstone', door: 'wood', col: 'lotus', town: true, roof: [0x8c6c40, 0xd8be8e], roofKind: 'flat', hw: 'adobe' },
    town_snow: { fl: [0x5a6070, 0x7e8698, 0x9ea6b6, 0xbcc2ce, 0xdce0e8], floor: 'cobble', wl: [0x383c48, 0x5c6272, 0x7e8494, 0xa0a6b4, 0xc4c8d2], wall: 'ashlar', door: 'wood', col: 'stone', town: true, roof: [0x3a4458, 0x7a88a0], roofKind: 'slate', roofSnow: true, hw: 'heavytimber', snowy: true },
    town_marsh: { fl: [0x241c14, 0x3a2e22, 0x524232, 0x6a5842, 0x827054, 0x9c8a6c], floor: 'planks', wl: [0x262824, 0x42443c, 0x5e6054, 0x7a7c6c, 0x969886], wall: 'rubble', door: 'wood', col: 'wood', town: true, roof: [0x3a3028, 0x6c5a48], roofKind: 'shingle', hw: 'planks' },
    town_isle: { fl: [0x8c8a84, 0xb4b2aa, 0xd2d0c6, 0xe6e4dc, 0xf6f4ee], floor: 'flags', wl: [0x7c7a74, 0xb4b2a8, 0xd8d6cc, 0xeceae2, 0xfaf8f2], wall: 'plaster', door: 'wood', col: 'marble', town: true, roof: [0x1c5a64, 0x4ca0a8], roofKind: 'tile', hw: 'white', wainscot: [0x1c3c64, 0x2c5a8c, 0x3c76b0, 0x5c96cc, 0x84b4e0] },
    town_mine: { fl: [0x28262a, 0x403e42, 0x58565a, 0x706e70, 0x8a8886], floor: 'slabs', wl: [0x222024, 0x3a383c, 0x545256, 0x6e6c6e, 0x8a8888], wall: 'rubble', door: 'iron', col: 'stone', town: true, roof: [0x28282e, 0x5a5a64], roofKind: 'slate', hw: 'stone' },
    town_ash: { fl: [0x1c1614, 0x302826, 0x443a36, 0x5a4e48, 0x70625a], floor: 'basalt', wl: [0x1e0e0a, 0x3a1c14, 0x5a2c1e, 0x7a3e2a, 0x985438, 0xb46c4a], wall: 'rock', door: 'iron', col: 'basalt', town: true, roof: [0x4a1c14, 0x8a3c28], roofKind: 'tile', hw: 'stone', hwp: [0x2a1e1a, 0x44322a, 0x5e463a, 0x785a4a, 0x927060, 0xac8a78] },
    town_star: { fl: [0x3a3c50, 0x5a5e76, 0x7a7e96, 0x9a9eb4, 0xbcc0d2], floor: 'diamond', wl: [0x5c6070, 0x8a8ea0, 0xb2b6c6, 0xd2d6e2, 0xeef0f6], wall: 'marble', door: 'shrine', col: 'marble', town: true, roof: [0x1c2448, 0x4c5c98], roofKind: 'tile', hw: 'whitestone' },
    town_white: { fl: [0x8a8e9a, 0xb0b4be, 0xd0d4dc, 0xe4e6ec, 0xf6f8fa], floor: 'marble', wl: [0x7a7e8c, 0xa4a8b4, 0xc8ccd6, 0xe0e2ea, 0xf8f8fc], wall: 'marble', door: 'shrine', col: 'marble', town: true, roof: [0x9098a8, 0xe0e4ec], roofKind: 'slate', hw: 'whitestone', band: 0xc8a040 },
  };
  // the Crest town: new street ramp (DESIGN §11.2.2), red tiled roofs, plaster & timber
  const TH_PATCH = {
    town: { fl: [0x46423a, 0x6e685a, 0x8e8674, 0xaaa28c, 0xc4bca6], town: true, roof: [0x7a2c1c, 0xc85c3c], roofKind: 'tile', hw: 'timber' },
  };
  // second colour per theme (tile_alt decor)
  const ALT = {
    forest: [0x2c2418, 0x3e3422, 0x52462c, 0x665a38, 0x7c7048],
    tree: [0x2a1c12, 0x40301e, 0x56422a, 0x6c5436, 0x866a46],
    snow: [0x7a8aa8, 0x9aaccc, 0xbccce4, 0xd6e2f2, 0xeef4fc],
    manor: [0x221818, 0x382624, 0x4c3430, 0x62443c, 0x7a5850],
    swamp: [0x1c2420, 0x2a342c, 0x3a4638, 0x4a5844, 0x5c6c54],
    ship: [0x24180e, 0x3a2818, 0x503822, 0x684a2e, 0x80603c, 0x98784c],
    mine: [0x2a2220, 0x403634, 0x564a46, 0x6c5e58, 0x84766e],
    library: [0x6a6450, 0x908a70, 0xb4ac8e, 0xccc4a8, 0xe4dcc4],
    oblivion: [0x5c5c64, 0x86868e, 0xacacb2, 0xcacac8, 0xe0e0dc],
    town_roa: [0x3e3a24, 0x5a5634, 0x76704a, 0x908a60, 0xaaa47a],
    town_forest: [0x3a2c1c, 0x523e28, 0x6a5236, 0x846a46, 0x9c845a],
    town_sand: [0x5c3c24, 0x845838, 0xa8744a, 0xc08e60, 0xd4a878],
    town_snow: [0x4a4e5a, 0x6c7280, 0x8c929e, 0xaab0ba, 0xcad0d8],
    town_marsh: [0x1c1810, 0x30281c, 0x463a2a, 0x5c4c38, 0x746248, 0x8c7a5c],
    town_isle: [0x6c7c88, 0x90a2ae, 0xb0c2cc, 0xccdae2, 0xe4eef2],
    town_mine: [0x2c2420, 0x463a32, 0x5e5046, 0x76685c, 0x908272],
    town_ash: [0x2a1410, 0x42221a, 0x5a3024, 0x723e2e, 0x8a503c],
    town_star: [0x2c2c44, 0x464a6c, 0x62668c, 0x7e82aa, 0x9ca0c6],
    town_white: [0x8c8878, 0xb4ae9c, 0xd4ceba, 0xe6e0cc, 0xf6f2e2],
  };
  const MOSSY = { forest: 1, snow: 1, swamp: 1, mine: 1, town_roa: 1, town_forest: 1, town_marsh: 1, town_mine: 1 };
  const FORMAL = { library: 1, manor: 1, town_star: 1, town_white: 1 };
  // moss colours per theme for the "moss in the grout" variant (outdoor snow shows snow, swamp algae)
  const MOSS_OF = {
    snow: [0xe8ecf2, 0xd0d8e4, 0xffffff],
    swamp: [0x2c3a22, 0x3a4c2a, 0x4c6034],
  };

  A.THEME_EXT = { TH, TH_PATCH, FLOOR, FACE, FACE_AT, TOP, TOP_OF, TOP_EDGE, COL, TORCH, CAPS, VARF, ALT, MOSSY, FORMAL, MOSS_OF, grad, clump, TRUNK, WOODR };
})(window.RPG);
