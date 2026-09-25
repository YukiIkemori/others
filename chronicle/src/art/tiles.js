// Tile & backdrop art toolkit (R.Art.TK), shared by src/art/tiles_*.js and
// src/art/battlebg.js. Pixels live in an Int32Array (0xRRGGBB, -1 =
// transparent); textures are seamless 16x16 and all noise is seeded, so every
// tile is deterministic. Factories only run lazily through R.Gfx.get, so the
// other files look TK up at runtime (never at load time).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const NONE = -1;

  // ------------------------------------------------------------ colours
  /** '#rrggbb' | int → int */
  function c(v) { return typeof v === 'number' ? v : parseInt(String(v).slice(1, 7), 16); }
  const rr = (v) => (v >> 16) & 255, gg = (v) => (v >> 8) & 255, bb = (v) => v & 255;
  const rgb = (r, g, b) => (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b);
  function clamp8(v) { v = Math.round(v); return v < 0 ? 0 : v > 255 ? 255 : v; }
  function mix(a, b, t) {
    a = c(a); b = c(b);
    return rgb(rr(a) + (rr(b) - rr(a)) * t, gg(a) + (gg(b) - gg(a)) * t, bb(a) + (bb(b) - bb(a)) * t);
  }
  /** amt > 0 lightens toward white, < 0 darkens toward black (hue-kept, slightly warm/cool shifted) */
  function shade(v, amt) {
    v = c(v);
    if (amt >= 0) return mix(v, 0xfffff4, amt);
    return mix(v, 0x08081a, -amt);
  }
  /** multiply brightness (keeps saturation better than shade for shadows) */
  function mul(v, k) { v = c(v); return rgb(rr(v) * k, gg(v) * k, bb(v) * k); }
  /** n colours dark → light around base */
  function ramp(base, n, spread) {
    n = n || 4; spread = spread == null ? 0.5 : spread;
    const out = [];
    for (let i = 0; i < n; i++) out.push(shade(base, -spread + (2 * spread * i) / Math.max(1, n - 1)));
    return out;
  }
  const hex = (v) => '#' + (c(v) & 0xffffff).toString(16).padStart(6, '0');

  // ------------------------------------------------------------ noise
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** periodic value noise in [0,1): lattice step `cell` px, repeats every `period` px */
  function vnoise(x, y, cell, period, seed) {
    const n = Math.max(1, Math.round(period / cell));
    const fx = x / cell, fy = y / cell;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const m = (v) => ((v % n) + n) % n;
    const h00 = hash(m(x0), m(y0), seed), h10 = hash(m(x0 + 1), m(y0), seed);
    const h01 = hash(m(x0), m(y0 + 1), seed), h11 = hash(m(x0 + 1), m(y0 + 1), seed);
    return (h00 + (h10 - h00) * sx) + ((h01 + (h11 - h01) * sx) - (h00 + (h10 - h00) * sx)) * sy;
  }
  /** fractal periodic noise (2 octaves) */
  function fnoise(x, y, cell, period, seed) {
    return vnoise(x, y, cell, period, seed) * 0.65 + vnoise(x, y, cell / 2, period, seed + 17) * 0.35;
  }
  // 4x4 Bayer matrix for ordered dithering
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  /** pick ramp[i] from a 0..1 value with optional ordered dither between steps */
  function pickRamp(ramp, v, x, y, dither) {
    const n = ramp.length;
    let f = Math.max(0, Math.min(0.9999, v)) * n;
    if (dither) f += (bayer(x, y) - 0.5) * dither;
    return ramp[Math.max(0, Math.min(n - 1, Math.floor(f)))];
  }

  // ------------------------------------------------------------ buffer
  class Buf {
    constructor(w, h, fill) { this.w = w; this.h = h; this.p = new Int32Array(w * h).fill(fill == null ? NONE : c(fill)); }
    clone() { const b = new Buf(this.w, this.h); b.p.set(this.p); return b; }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { x |= 0; y |= 0; return this.in(x, y) ? this.p[y * this.w + x] : NONE; }
    /** wrapped read (seamless textures) */
    wget(x, y) { const w = this.w, h = this.h; return this.p[(((y % h) + h) % h) * w + (((x % w) + w) % w)]; }
    set(x, y, col) { x = Math.round(x); y = Math.round(y); if (this.in(x, y)) this.p[y * this.w + x] = col == null ? NONE : c(col); return this; }
    /** wrapped write (seamless textures) */
    wset(x, y, col) { const w = this.w, h = this.h; this.p[(((Math.round(y) % h) + h) % h) * w + (((Math.round(x) % w) + w) % w)] = c(col); return this; }
    fill(col) { this.p.fill(col == null ? NONE : c(col)); return this; }
    rect(x, y, w, h, col) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col); return this; }
    hline(x0, x1, y, col) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, col); return this; }
    vline(x, y0, y1, col) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, col); return this; }
    line(x0, y0, x1, y1, col) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
      return this;
    }
    ellipse(cx, cy, rx, ry, col) {
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) this.set(x, y, col);
        }
      return this;
    }
    /** sphere-lit ellipse; ramp dark→light; light from upper-left */
    shadeEllipse(cx, cy, rx, ry, ramp, o) {
      o = o || {};
      const lx = o.lx != null ? o.lx : -0.6, ly = o.ly != null ? o.ly : -0.7;
      const amb = o.amb != null ? o.amb : 0.35;
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          const l = (dx * lx + dy * ly + nz * 0.55 + amb) / (1 + amb);
          this.set(x, y, pickRamp(ramp, l, x, y, o.dither == null ? 0.6 : o.dither));
        }
      return this;
    }
    poly(pts, col) {
      let minY = Infinity, maxY = -Infinity;
      for (const q of pts) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
            xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2)
          for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, col);
      }
      return this;
    }
    /** apply fn(x,y,col) → col|undefined to every pixel (opaque only unless all) */
    each(fn, all) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x, v = this.p[i];
        if (v === NONE && !all) continue;
        const r = fn(x, y, v);
        if (r !== undefined) this.p[i] = r == null ? NONE : c(r);
      }
      return this;
    }
    /** 1-px outline outside opaque pixels (4-neighbour, or 8 with diag) */
    outline(col, diag) {
      const src = this.p.slice(), w = this.w, h = this.h;
      const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] !== NONE;
      col = c(col);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (src[y * w + x] !== NONE) continue;
        let n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        if (!n && diag) n = at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
        if (n) this.p[y * w + x] = col;
      }
      return this;
    }
    /** draw src on top (transparent skipped). o: {wrap, flip, alpha(0..1 mixes), mask fn} */
    blit(src, ox, oy, o) {
      ox = ox | 0; oy = oy | 0;
      const wrap = o && o.wrap, flip = o && o.flip, alpha = o && o.alpha;
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const v = src.p[y * src.w + (flip ? src.w - 1 - x : x)];
        if (v === NONE) continue;
        let tx = ox + x, ty = oy + y;
        if (wrap) { tx = ((tx % this.w) + this.w) % this.w; ty = ((ty % this.h) + this.h) % this.h; }
        else if (!this.in(tx, ty)) continue;
        const i = ty * this.w + tx;
        this.p[i] = alpha != null && this.p[i] !== NONE ? mix(this.p[i], v, alpha) : v;
      }
      return this;
    }
    /** darken destination under src's opaque pixels shifted by (dx,dy) (drop shadow) */
    shadowOf(src, ox, oy, k) {
      k = k == null ? 0.7 : k;
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        if (src.p[y * src.w + x] === NONE) continue;
        const tx = ox + x, ty = oy + y;
        if (!this.in(tx, ty)) continue;
        const i = ty * this.w + tx;
        if (this.p[i] !== NONE) this.p[i] = mul(this.p[i], k);
      }
      return this;
    }
    /** darken/lighten a rectangle (multiply) */
    tint(x, y, w, h, k) {
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
        if (!this.in(i, j)) continue;
        const q = j * this.w + i;
        if (this.p[q] !== NONE) this.p[q] = mul(this.p[q], k);
      }
      return this;
    }
    /** sub-image */
    crop(x, y, w, h) {
      const b = new Buf(w, h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) b.p[j * w + i] = this.get(x + i, y + j);
      return b;
    }
    toCanvas() {
      const cv = R.Gfx.makeCanvas(this.w, this.h);
      const ctx = cv.getContext('2d');
      const id = ctx.createImageData(this.w, this.h), d = id.data, p = this.p;
      for (let i = 0; i < p.length; i++) {
        const v = p[i];
        if (v === NONE) continue;
        const k = i * 4;
        d[k] = (v >> 16) & 255; d[k + 1] = (v >> 8) & 255; d[k + 2] = v & 255; d[k + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      return cv;
    }
  }
  const buf = (w, h, fill) => new Buf(w, h, fill);
  const tile = (fill) => new Buf(16, 16, fill);
  /** object layer helper: draw into a fresh transparent 16x16, outline, shadow, composite */
  function stamp(floor, draw, o) {
    o = o || {};
    const L = new Buf(floor.w, floor.h);
    draw(L);
    if (o.outline !== false) L.outline(o.outline || 0x1a1410, o.diag);
    const out = floor.clone();
    if (o.shadow !== false) out.shadowOf(L, o.sx == null ? 1 : o.sx, o.sy == null ? 1 : o.sy, o.shadowK);
    out.blit(L, 0, 0);
    return out;
  }
  /** n animation frames from fn(f) → Buf, as canvases */
  function frames(n, fn) { const out = []; for (let f = 0; f < n; f++) out.push(fn(f).toCanvas()); return out; }

  // ------------------------------------------------------ shared textures
  /** seamless texture: fn(x,y) → colour, over w×h */
  function tex(w, h, fn) {
    const b = new Buf(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.p[y * w + x] = c(fn(x, y));
    return b;
  }
  /** add sparse speckles (wrapped) — subtle texture noise */
  function speckle(b, cols, density, seed) {
    const r = rng(seed);
    const n = Math.round(b.w * b.h * density);
    for (let i = 0; i < n; i++) b.wset(Math.floor(r() * b.w), Math.floor(r() * b.h), cols[Math.floor(r() * cols.length)]);
    return b;
  }

  // Master palette (per material ramps dark → light). DESIGN §11.2.2: the terrain
  // ramps are RS1-like — 25-35 % less saturated, 5-10 % darker, shadows toward a warm
  // brown. Figures, monsters and backdrops keep their own bright ramps. The number of
  // steps of an existing key never changes (callers index into them).
  const PAL = {
    ink: 0x181010, inkCool: 0x101420,
    grass: [0x223a18, 0x30501f, 0x406628, 0x547a34, 0x6c8e44, 0x8ca45e],
    tgrass: [0x28421a, 0x385a22, 0x4a6e2c, 0x5e8238, 0x76964a, 0x96ac64], // town grass
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
    magma: [0x7c1808, 0xc03810, 0xec6818, 0xfca030, 0xffdc68, 0xfff8c0],
    crust: [0x1c0c0c, 0x381814, 0x542820, 0x70382a],
    rock: [0x2a2018, 0x44382a, 0x5e4e3a, 0x7a684e, 0x968466, 0xb2a082],
    grey: [0x2a2a2e, 0x46464e, 0x66666e, 0x88888e, 0xaaaab0, 0xd0d0d4],
    wood: [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468],
    red: [0x4c0c10, 0x7c1418, 0xa8201e, 0xd0382c, 0xec6048, 0xf89478],
    gold: [0x5c3c08, 0x8c6414, 0xbc8c1c, 0xe0b430, 0xf8dc60, 0xfff4b0],
    silver: [0x3c4050, 0x60687c, 0x8890a4, 0xb0b8c8, 0xd8dce8, 0xffffff],
    // new terrain (DESIGN §11.2.2)
    marsh: [0x1c2418, 0x2a3422, 0x3a462c, 0x4c5838, 0x606c48, 0x7a8660],
    marshwater: [0x28343a, 0x364650, 0x4a5c64, 0x60747a],
    ash: [0x2a2624, 0x3c3634, 0x504846, 0x665c58, 0x7e746c, 0x988e84],
    road: [0x5a4630, 0x745c40, 0x8e7452, 0xa68c68],
    jungle: [0x0e2414, 0x16361c, 0x204a26, 0x2e6030, 0x42783a, 0x60904c],
    fog: [0xb8bcc8, 0xd0d4dc, 0xe4e6ec, 0xf4f4f8],
    purple: [0x20102c, 0x3c1c50, 0x5c2c78, 0x8040a0, 0xa868c8, 0xd0a0e8],
    blue: [0x101c48, 0x1c3070, 0x2c4c9c, 0x4270c4, 0x6c98e0, 0xa0c4f4],
    skin: [0x8c5838, 0xc88c60, 0xf0bc8c],
    leaf: [0x1a4a18, 0x2a6a22, 0x3c8a2c, 0x58aa3c, 0x7cc454],
  };

  A.TK = {
    NONE, c, mix, shade, mul, ramp, hex, rgb, rr, gg, bb,
    hash, rng, vnoise, fnoise, bayer, pickRamp,
    Buf, buf, tile, stamp, frames, tex, speckle, PAL,
  };
})(window.RPG);
