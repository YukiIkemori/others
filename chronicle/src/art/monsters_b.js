// Monster battle sprites, part B (DESIGN §4): 'mon:<id>' front-facing portraits
// in SFC style for the medium (48x48) and large (64x64) roster.
//
// Each sprite is modelled as a tiny 2.5-D scene: ellipsoids, tapered capsules,
// spline tubes and bevelled polygons are rasterised into a z-buffer with real
// surface normals, then lit from the top-left and quantised into hue-shifted
// colour ramps (shadows drift violet, highlights drift warm). Where two parts
// meet, the part behind gets a dark contour line, so the sprite reads as
// separate forms like hand-drawn SFC art. Faces, teeth and sparkles are placed
// by hand afterwards and a near-neutral 1-px outline closes the silhouette.
// Factories run lazily through R.Gfx.get and are cached.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#140e18'; // outer outline (near-neutral: palette variants keep it)
  const INK = '#1e1624'; // pupils, mouths
  const WHITE = '#f8f8f2';
  const DUMMY = { r: ['#000000'], n: 1 }; // coverage-only material

  // ------------------------------------------------------------ colours
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function toRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function toHsv(hex) {
    const [r, g, b] = toRgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function fromHsv(h, s, v) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); v = clamp(v, 0, 1);
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function towards(h, target, amt) {
    const d = ((target - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amt);
  }
  /**
   * Hue-shifted ramp dark → light around a mid-tone base (index `mid`).
   * o: {dark: how dark the darkest step gets (0..1), light: how far the top
   * step goes toward white, shift: hue drift in degrees}
   */
  function ramp(base, n, o) {
    o = o || {};
    const [h, s, v] = toHsv(base);
    const k = Math.round((n - 1) * (o.mid == null ? 0.5 : o.mid));
    const dark = o.dark == null ? 0.7 : o.dark, light = o.light == null ? 0.72 : o.light;
    const shift = o.shift == null ? 20 : o.shift;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i < k) {
        const t = (k - i) / k;
        out.push(fromHsv(towards(h, 255, shift * t), s + (1 - s) * 0.25 * t, v * (1 - dark * t)));
      } else if (i > k) {
        const t = (i - k) / (n - 1 - k);
        out.push(fromHsv(towards(h, 55, shift * 0.6 * t), s * (1 - 0.55 * light * t), v + (1 - v) * light * t));
      } else out.push(base);
    }
    return out;
  }
  function darken(hex, k) { const [r, g, b] = toRgb(hex); return toHex(r * k, g * k, b * k); }
  function mix(a, b, t) { const x = toRgb(a), y = toRgb(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  /** deterministic hash noise in [0,1) */
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ------------------------------------------------------------ textures
  // tex(x, y, nx, ny) → ramp-step delta, used by materials
  /** overlapping scales: a dark lower rim and a lit upper edge per cell */
  const texScales = (w, h, s) => (x, y) => {
    const row = Math.floor(y / h), cx = (x + (row & 1) * (w >> 1) + (s || 0)) % w, cy = y % h;
    if (cy === h - 1 && cx !== 0) return -1;
    if (cy === 0 && cx === 1) return 1;
    return 0;
  };
  /** fur / hair strands: short vertical dark and light streaks */
  const texFur = (d, s) => (x, y) => {
    const r = hash(x, Math.floor((y + (x & 1) * 2) / 3), s || 7);
    return r < (d || 0.14) ? -1 : r > 1 - (d || 0.14) * 0.5 ? 1 : 0;
  };
  /** stone: sparse pits and flecks */
  const texStone = (s) => (x, y) => {
    const r = hash(x, y, s || 3);
    return r < 0.06 ? -1 : r > 0.96 ? 1 : 0;
  };

  /**
   * Material: a colour ramp plus how it takes light.
   * o: {n (steps, default 5), dark, light, shift, mid (ramp shape), bias (brighter +),
   * contrast, spec (N·H threshold for the top colour), dith (checker band width 0..1),
   * tex(x,y) → ramp index delta, rim (reflected light on the lower-right edge),
   * line (inner contour colour), flat (ignore depth/ground darkening),
   * glow (emissive: exponent of the core falloff, ignores the light)}
   */
  function mat(base, o) {
    o = o || {};
    const n = o.n || 5;
    const r = o.ramp || ramp(base, n, o);
    return {
      r, n: r.length, bias: o.bias || 0, contrast: o.contrast == null ? 1 : o.contrast,
      spec: o.spec, dith: o.dith || 0, tex: o.tex, rim: o.rim,
      line: o.line || mix(darken(r[0], 0.55), OUT, 0.35), flat: o.flat, glow: o.glow,
    };
  }

  // ------------------------------------------------------------ scene
  const LIGHT = norm3([-0.55, -0.72, 0.52]);
  const HALF = norm3([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  const OFFS = (() => {
    const a = [];
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= 10.5) a.push([dx, dy, d]);
    }
    return a.sort((p, q) => p[2] - q[2]);
  })();

  /**
   * Scene: z-buffer of shaded primitives. Every primitive takes o:
   * {m: material, g: group name (parts of one group blend without a contour;
   * default = the material), z: base depth (bigger = nearer), soft: contour
   * against this group is a darker step instead of a line}
   */
  class Scene {
    constructor(w, h) {
      this.w = w; this.h = h;
      const n = w * h;
      this.Z = new Float32Array(n).fill(-1e9);
      this.N = new Float32Array(n * 3);
      this.M = new Array(n).fill(null);
      this.Gr = new Int32Array(n).fill(-1);
      this.D = new Int8Array(n);
      this.gids = new Map();
      this.soft = new Set();
    }
    gid(o) {
      const key = o.g != null ? o.g : o.m;
      if (!this.gids.has(key)) this.gids.set(key, this.gids.size);
      const id = this.gids.get(key);
      if (o.soft) this.soft.add(id);
      return id;
    }
    /**
     * Write a surface sample. Within one group, surfaces merge with a smooth
     * max over `k` depth units (organic joins instead of creased seams).
     */
    plot(x, y, z, nx, ny, nz, m, g, k) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      let l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const z0 = this.Z[i];
      if (k > 0 && this.Gr[i] === g && Math.abs(z - z0) < k) {
        const hh = (k - Math.abs(z - z0)) / k;
        const t = clamp(0.5 + 0.5 * (z - z0) / k, 0, 1);
        const j = i * 3;
        nx = this.N[j] + (nx - this.N[j]) * t; ny = this.N[j + 1] + (ny - this.N[j + 1]) * t; nz = this.N[j + 2] + (nz - this.N[j + 2]) * t;
        l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        this.Z[i] = Math.max(z, z0) + hh * hh * k * 0.25;
        if (t >= 0.5) this.M[i] = m;
        this.N[j] = nx / l; this.N[j + 1] = ny / l; this.N[j + 2] = nz / l;
        return;
      }
      if (z <= z0) return;
      this.Z[i] = z; this.M[i] = m; this.Gr[i] = g;
      this.N[i * 3] = nx; this.N[i * 3 + 1] = ny; this.N[i * 3 + 2] = nz;
    }
    /** ellipsoid; o.rz = depth radius (default min(rx, ry)) */
    ell(cx, cy, rx, ry, o) {
      const g = this.gid(o), z0 = o.z || 0, a = rx + 0.5, b = ry + 0.5;
      const c = o.rz || Math.min(rx, ry);
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const dx = (x - cx) / a, dy = (y - cy) / b, d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          this.plot(x, y, z0 + c * nz, dx / a, dy / b, nz / c, o.m, g, o.k == null ? 3 : o.k);
        }
      return this;
    }
    /** tapered capsule; o.z0/o.z1 depth at the ends, o.rzk depth scale */
    cap(x0, y0, x1, y1, r0, r1, o) {
      if (r1 == null) r1 = r0;
      const g = this.gid(o), k = o.rzk || 1;
      const za = o.z0 != null ? o.z0 : o.z || 0, zb = o.z1 != null ? o.z1 : za;
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
      const mr = Math.max(r0, r1) + 1;
      for (let y = Math.floor(Math.min(y0, y1) - mr); y <= Math.ceil(Math.max(y0, y1) + mr); y++)
        for (let x = Math.floor(Math.min(x0, x1) - mr); x <= Math.ceil(Math.max(x0, x1) + mr); x++) {
          const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1);
          const px = x - (x0 + dx * t), py = y - (y0 + dy * t);
          const r = r0 + (r1 - r0) * t + 0.4, d = Math.sqrt(px * px + py * py);
          if (d > r) continue;
          const q = d / r, nz = Math.sqrt(1 - q * q);
          this.plot(x, y, za + (zb - za) * t + r * k * nz, px / r, py / r, nz / k, o.m, g, o.k == null ? 3 : o.k);
        }
      return this;
    }
    /**
     * Smooth tube through control points [[x,y,r,z?],...] (Catmull-Rom), built
     * from short capsules. Radius/depth interpolate along the path.
     */
    tube(pts, o) {
      const P = pts.map((p) => [p[0], p[1], p[2] == null ? 1 : p[2], p[3] == null ? (o.z || 0) : p[3]]);
      const samples = [];
      const seg = o.steps || 6;
      if (P.length === 2) for (let i = 0; i <= seg; i++) samples.push(lerpP(P[0], P[1], i / seg));
      else {
        for (let s = 0; s < P.length - 1; s++) {
          const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
          for (let i = s ? 1 : 0; i <= seg; i++) samples.push(catmull(p0, p1, p2, p3, i / seg));
        }
      }
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        this.cap(a[0], a[1], b[0], b[1], a[2], b[2], { m: o.m, g: o.g, z0: a[3], z1: b[3], rzk: o.rzk, soft: o.soft, k: o.k == null ? 1.5 : o.k });
      }
      return this;
    }
    /**
     * Flat-ish shape from a mask (Pix, non-null = inside). o.n = facing normal
     * (default toward the viewer), o.bevel = rounded edge width in px, o.bz =
     * bevel height (default bevel).
     */
    shape(mk, o) {
      const g = this.gid(o), z0 = o.z || 0, bv = o.bevel || 0, bz = o.bz == null ? bv : o.bz;
      const n0 = o.n || [0, 0, 1];
      const w = this.w, h = this.h;
      const H = new Float32Array(w * h);
      const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mk.d[y * w + x] != null;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mk.d[y * w + x] != null) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        let d = bv + 1;
        if (bv) for (const f of OFFS) {
          if (f[2] - 0.5 >= d) break;
          if (!inside(x + f[0], y + f[1])) { d = f[2] - 0.5; break; }
        }
        const t = bv ? Math.min(1, d / bv) : 1;
        H[y * w + x] = bz * Math.sqrt(1 - (1 - t) * (1 - t));
      }
      const hAt = (x, y) => (inside(x, y) ? H[y * w + x] : 0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (!inside(x, y)) continue;
        const gx = bv ? (hAt(x + 1, y) - hAt(x - 1, y)) / 2 : 0, gy = bv ? (hAt(x, y + 1) - hAt(x, y - 1)) / 2 : 0;
        const plane = o.slope ? o.slope[0] * x + o.slope[1] * y : 0;
        this.plot(x, y, z0 + H[y * w + x] + plane, n0[0] - gx * n0[2], n0[1] - gy * n0[2], n0[2], o.m, g, o.k || 0);
      }
      return this;
    }
    /** polygon [[x,y],...] as a shape (see shape) */
    poly(pts, o) { const mk = G().pix(this.w, this.h); mk.poly(pts, 1); return this.shape(mk, o); }
    /** change material (and optionally group) of existing pixels where fn(x,y,i) */
    region(fn, m, g) {
      const gid = g != null ? this.gid({ g, m }) : -1;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.M[i] && fn(x, y, i)) { this.M[i] = m; if (gid >= 0) this.Gr[i] = gid; }
      }
      return this;
    }
    /** is pixel covered by the given group? */
    isG(x, y, g) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      return this.Gr[y * this.w + x] === this.gids.get(g);
    }
    /** ramp-step delta at a pixel (carving creases, adding glints) */
    mark(x, y, d) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
      const i = y * this.w + x;
      if (this.M[i]) this.D[i] = clamp(this.D[i] + d, -9, 9);
      return this;
    }
    /** polyline of marks: pts [[x,y],...] */
    carve(pts, d) {
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = k > 1 ? 1 : 0; i <= n; i++) this.mark(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, d);
      }
      return this;
    }
    /** remove pixels where fn(x,y) */
    cut(fn) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.M[i] && fn(x, y)) { this.M[i] = null; this.Z[i] = -1e9; this.Gr[i] = -1; }
      }
      return this;
    }
    /**
     * Light & quantise → Pix. o: {depth (darkening of far parts), ground
     * (darkening toward the bottom), bias}
     */
    render(o) {
      o = o || {};
      const w = this.w, h = this.h, n = w * h;
      let zmin = 1e9, zmax = -1e9, y0 = h, y1 = 0;
      for (let i = 0; i < n; i++) if (this.M[i]) {
        zmin = Math.min(zmin, this.Z[i]); zmax = Math.max(zmax, this.Z[i]);
        const y = (i / w) | 0; y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const dk = o.depth == null ? 0.16 : o.depth, gk = o.ground == null ? 0.06 : o.ground;
      const idx = new Int16Array(n), frac = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const m = this.M[i];
        if (!m) continue;
        const nx = this.N[i * 3], ny = this.N[i * 3 + 1], nz = this.N[i * 3 + 2];
        const x = i % w, y = (i / w) | 0;
        const dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        // front-facing surfaces sit on the base colour; the lit side climbs
        // faster than the shadow side falls (big readable forms, small highlights)
        const e = dot - LIGHT[2];
        let v = 0.5 + (e > 0 ? 0.78 * e : 0.46 * e) * m.contrast * (o.contrast || 1);
        // emissive (flames, orbs): bright core where the surface faces the viewer
        if (m.glow) v = 0.12 + 0.88 * Math.pow(Math.max(0, nz), m.glow);
        if (!m.flat && !m.glow) {
          v -= dk * (zmax - this.Z[i]) / Math.max(1, zmax - zmin);
          v -= gk * Math.max(0, (y - y0) / Math.max(1, y1 - y0) - 0.35);
        }
        v += m.bias + (o.bias || 0);
        const f = clamp(v, 0, 0.999) * m.n;
        let k = Math.floor(f);
        if (m.spec != null && nx * HALF[0] + ny * HALF[1] + nz * HALF[2] > m.spec) k = m.n - 1;
        idx[i] = k; frac[i] = f - Math.floor(f);
      }
      // lone pixels of a step get absorbed by their neighbours (cleaner bands)
      const nb = [0, 0, 0, 0];
      for (let pass = 0; pass < 2; pass++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, m = this.M[i], g = this.Gr[i];
        if (!m) continue;
        let c = 0;
        for (const j of [i - 1, i + 1, i - w, i + w]) if (this.M[j] === m && this.Gr[j] === g) nb[c++] = j;
        if (c < 3) continue;
        const k0 = idx[nb[0]];
        let all = idx[i] !== k0;
        for (let q = 1; q < c && all; q++) all = idx[nb[q]] === k0;
        if (all) idx[i] = k0;
      }
      const out = G().pix(w, h);
      for (let i = 0; i < n; i++) {
        const m = this.M[i];
        if (!m) continue;
        const x = i % w, y = (i / w) | 0;
        let k = idx[i];
        if (m.dith && frac[i] > 1 - m.dith && ((x + y) & 1)) k++;
        if (m.tex) k += m.tex(x, y, this.N[i * 3], this.N[i * 3 + 1]) || 0;
        k += this.D[i];
        // edge on the shadow side catches reflected light
        if (m.rim && this.N[i * 3] * 0.6 + this.N[i * 3 + 1] > 0.35) {
          const e = (j) => j < 0 || j >= n || !this.M[j];
          if (e(i + 1) || e(i + w)) k = Math.max(k, m.rim);
        }
        let col = m.r[clamp(k, 0, m.n - 1)];
        // contour where a nearer part of another group borders this pixel
        const gi = this.Gr[i], zi = this.Z[i];
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
          if (j < 0 || j >= n || !this.M[j] || this.Gr[j] === gi || this.Z[j] <= zi) continue;
          col = this.soft.has(this.Gr[j]) || this.soft.has(gi) ? m.r[clamp(k - 2, 0, m.n - 1)] : m.line;
          break;
        }
        out.d[i] = col;
      }
      return out;
    }
  }
  function lerpP(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3));
  }

  // ------------------------------------------------------------ pixel helpers
  /** stamp a small grid; '.' transparent */
  function stamp(p, x, y, rows, pal) { p.grid(Math.round(x), Math.round(y), rows, pal); return p; }
  /** stamp a grid and its mirror image on the other side (W = canvas width) */
  function stampM(p, x, y, rows, pal) {
    stamp(p, x, y, rows, pal);
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    return stamp(p, p.w - x - w, y, rows.map((r) => r.padEnd(w, '.').split('').reverse().join('')), pal);
  }
  /** darken existing pixels (colour-preserving) along a polyline */
  function shadeLine(p, pts, k) {
    for (let s = 1; s < pts.length; s++) {
      const [x0, y0] = pts[s - 1], [x1, y1] = pts[s];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
        const c = p.get(x, y);
        if (c && c !== OUT) p.set(x, y, darken(c, k));
      }
    }
    return p;
  }
  /** remove lone outline pixels that stick out (smoother silhouettes) */
  function shave(p) {
    const src = p.d.slice(), w = p.w, h = p.h;
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y) !== OUT) continue;
      let k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) != null) k++;
      if (k <= 1) p.d[y * w + x] = null;
    }
    return p;
  }
  /** outline + clean-up; post(p) paints unoutlined extras (sparkles, bubbles, steam) */
  function finish(p, post) {
    p.outline(OUT); shave(p);
    if (post) post(p);
    return p.toCanvas();
  }

  /**
   * Licking flame (use an emissive material): an S-curved main tongue of
   * height h and base half-width w leaning by `lean` px, plus two side tongues.
   */
  function flame(sc, x, y, h, w, lean, o) {
    const z = o.z || 0;
    sc.tube([[x, y, w, z], [x - w * 0.35 + lean * 0.25, y - h * 0.38, w * 0.82, z], [x + w * 0.3 + lean * 0.65, y - h * 0.72, w * 0.42, z], [x + lean, y - h, 0.3, z]], o);
    sc.tube([[x - w * 0.5, y - h * 0.1, w * 0.55, z - 0.5], [x - w * 1.1 + lean * 0.2, y - h * 0.42, w * 0.3, z - 0.5], [x - w * 0.8 + lean * 0.3, y - h * 0.6, 0.3, z - 0.5]], o);
    sc.tube([[x + w * 0.5, y - h * 0.08, w * 0.5, z - 0.5], [x + w * 1.1 + lean * 0.25, y - h * 0.36, w * 0.28, z - 0.5], [x + w * 0.95 + lean * 0.4, y - h * 0.52, 0.3, z - 0.5]], o);
    return sc;
  }
  /**
   * Paint a flat 2-D flame onto a finished Pix: nested bands from the ramp
   * (dark edge → white-hot core) following the flame's silhouette, hottest
   * near the base. Same geometry as flame().
   */
  function paintFlame(p, x, y, h, w, lean, rmp, o) {
    const t = new Scene(p.w, p.h);
    flame(t, x, y, h, w, lean, { m: DUMMY, g: 'f' });
    const n = rmp.length, W = p.w, band = (o && o.band) || 1.1;
    const inside = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < p.h && t.M[Y * W + X] != null;
    for (let Y = 0; Y < p.h; Y++) for (let X = 0; X < W; X++) {
      if (!inside(X, Y)) continue;
      let d = 9;
      for (const f of OFFS) {
        if (f[2] - 0.5 >= d) break;
        if (!inside(X + f[0], Y + f[1])) { d = f[2] - 0.5; break; }
      }
      const heat = d / band + clamp((Y - (y - h * 0.6)) / (h * 0.6), 0, 1) * 1.2 - 0.3;
      p.set(X, Y, rmp[clamp(Math.floor(heat), 0, n - 1)]);
    }
    return p;
  }

  /** run fn for the left-hand original (X = id, s = 1) and its mirror (s = -1) */
  function sym(W, fn) { fn((x) => x, 1); fn((x) => W - 1 - x, -1); }

  // ------------------------------------------------------------ sprites
  const S = {};

  // Crab: a stout shore crab with an oversized fighting claw, eyes on stalks
  // and a toothy grin under the shell rim; six legs brace it on the ground.
  S.crab = () => {
    const W = 48, H = 48;
    const shell = mat('#d65a3a', { n: 5, rim: 1 });
    const under = mat('#f0cc98', { n: 5, bias: 0.12 });
    const tip = mat('#3e3040', { n: 3, dark: 0.5, light: 0.5 });
    const eyeM = mat('#f2eee6', { n: 3, dark: 0.3, light: 0.9, bias: 0.15, flat: true });
    const sc = new Scene(W, H);
    // legs behind the shell
    sym(W, (X) => {
      const legs = [
        [[16, 31, 2.3, -6], [7, 28, 2.1, -6], [3.5, 36, 1.7, -6], [5, 46.5, 0.6, -6]],
        [[16, 34, 2.1, -8], [5, 33, 1.9, -8], [1.5, 40, 1.5, -8], [1.5, 46.5, 0.6, -8]],
        [[18, 35, 2, -4], [11, 37, 1.8, -4], [9.5, 42, 1.5, -4], [10.5, 47, 0.6, -4]],
      ];
      legs.forEach((L, k) => sc.tube(L.map((p) => [X(p[0]), p[1], p[2], p[3]]), { m: shell, g: 'leg' + k + X(0) }));
    });
    // shell body, lateral spines and knobbly rim
    sc.ell(23.5, 28, 16.5, 9.5, { m: shell, g: 'shell', rz: 10 });
    sym(W, (X) => {
      sc.tube([[X(9), 25, 2.4, 4], [X(4.5), 22.5, 0.6, 4]], { m: shell, g: 'shell' });
      for (const [bx, by] of [[12, 20.5], [17, 18.8]]) sc.ell(X(bx), by, 2.2, 1.8, { m: shell, g: 'shell', z: 5, rz: 3 });
    });
    sc.ell(23.5, 18.4, 2.2, 1.8, { m: shell, g: 'shell', z: 5, rz: 3 });
    // underside plate (the mouth sits here)
    sc.ell(23.5, 35.5, 10, 4.2, { m: under, g: 'under', z: 4, rz: 5 });
    // eye stalks + eyes
    sym(W, (X) => {
      sc.tube([[X(19.5), 21, 1.7, 6], [X(18.5), 13, 1.3, 7]], { m: shell, g: 'stalk' + X(0) });
      sc.ell(X(18.3), 10.5, 3.3, 3.5, { m: eyeM, g: 'eye' + X(0), z: 8, rz: 3.5 });
    });
    // arms
    sc.tube([[11, 30, 2.9, 2], [5, 26, 2.6, 4], [6.5, 20, 2.4, 6]], { m: shell, g: 'armL' });
    sc.tube([[36, 30, 2.9, 2], [43, 25, 2.9, 4], [41, 19.5, 2.8, 6]], { m: shell, g: 'armR' });
    // small claw (left): palm + outer fixed finger + hinged finger
    sc.ell(7, 15, 5, 5.6, { m: shell, g: 'palmL', z: 8, rz: 5 });
    sc.tube([[4, 12, 2.7, 9], [2.8, 6.5, 2.1, 9], [5, 1.8, 0.6, 9]], { m: shell, g: 'palmL' });
    sc.tube([[10, 11, 2.3, 10], [11.6, 6.4, 1.7, 10], [9, 2.4, 0.6, 10]], { m: shell, g: 'fingerL' });
    // fighting claw (right): bigger, wide open
    sc.ell(40.5, 13.5, 6.4, 7, { m: shell, g: 'palmR', z: 8, rz: 6 });
    sc.tube([[45, 10, 3.2, 9], [46.8, 4.5, 2.4, 9], [44, 0.6, 0.7, 9]], { m: shell, g: 'palmR' });
    sc.tube([[36.5, 8.5, 2.8, 10], [34.4, 3.8, 2, 10], [37.4, 0.8, 0.7, 10]], { m: shell, g: 'fingerR' });
    // dark pincer tips
    sc.region((x, y) => (sc.isG(x, y, 'palmL') || sc.isG(x, y, 'fingerL')) && y < 6, tip);
    sc.region((x, y) => (sc.isG(x, y, 'palmR') || sc.isG(x, y, 'fingerR')) && y < 5, tip);
    // serrated inner edges of the pincers
    for (const [x, y] of [[4, 8], [5, 10], [10, 8], [37, 6], [36, 4], [44, 7], [44, 5]]) sc.mark(x, y, -2);
    // shell grooves
    sc.carve([[14, 24], [18, 27], [23, 28], [29, 27], [33, 24]], -1);
    const p = sc.render();
    // open grin with little fangs
    stamp(p, 17, 33, [
      'k............k',
      'kkkkkkkkkkkkkk',
      '.kwwkrrrrkwwk.',
      '..kkrrrrrrkk..',
      '....kkkkkk....',
    ], { k: INK, w: WHITE, r: '#8a2438' });
    // pupils looking at the player
    stampM(p, 16, 9, ['.kk', 'kkk', 'kwk', '.k.'], { k: INK, w: WHITE });
    return finish(p, (q) => {
      // froth bubbles at the mouth corners
      stamp(q, 12, 33, ['.bb.', 'bwcb', 'bccb', '.bb.'], { b: '#78b8e0', c: '#c8ecff', w: WHITE });
      stamp(q, 33, 36, ['.b.', 'bwb', '.b.'], { b: '#78b8e0', w: WHITE });
      stamp(q, 10, 30, ['b'], { b: '#c8ecff' });
    });
  };

  // Orc: a pot-bellied brute with a boar's snout and tusks, a spiked club
  // propped on one shoulder, a studded pauldron and a crimson loincloth.
  S.orc = () => {
    const W = 64, H = 64;
    const skin = mat('#7ea24a', { n: 5, rim: 1 });
    const leather = mat('#8a5634', { n: 5 });
    const cloth = mat('#b8443a', { n: 5 });
    const wood = mat('#a87840', { n: 5 });
    const iron = mat('#8a8e9e', { n: 5, spec: 0.93 });
    const bone = mat('#eee2c4', { n: 4, dark: 0.45 });
    const hair = mat('#6a4a7a', { n: 4 });
    const sc = new Scene(W, H);
    // club propped on the right shoulder: handle through the fist, heavy head above
    sc.tube([[48.5, 35, 1.9, 9], [51.5, 24, 2.1, 7], [53.5, 17, 3.4, 5], [55, 10.5, 4.4, 5], [55.5, 6, 3.6, 5]], { m: wood, g: 'club' });
    for (const [x, y, dx, dy] of [[59.2, 9, 1, 0], [58.5, 3.8, 0.8, -0.7], [55.5, 2.5, 0, -1], [52, 4.5, -0.8, -0.6], [51, 10.5, -1, 0.1], [57.8, 14.5, 1, 0.4]])
      sc.tube([[x - dx * 0.6, y - dy * 0.6, 1.3, 9], [x + dx * 2, y + dy * 2, 0.4, 9]], { m: iron, g: 'stud' + x });
    sc.carve([[54, 8], [55, 11]], -1).carve([[52.5, 18], [53, 20]], -1);
    // legs
    sym(W, (X) => {
      sc.tube([[X(25), 44, 5.4, 2], [X(21.5), 52, 4.6, 3], [X(20), 59, 3.8, 4]], { m: skin, g: 'leg' + X(0) });
      sc.ell(X(19), 61, 5.5, 2.6, { m: skin, g: 'foot' + X(0), z: 8, rz: 3 });
    });
    // torso
    sc.ell(31.5, 36, 13, 9.5, { m: skin, g: 'body', z: 4, rz: 11 });
    sc.ell(31.5, 28, 15.5, 8.5, { m: skin, g: 'body', z: 3, rz: 9 });
    sym(W, (X) => sc.ell(X(26), 28, 6.5, 5, { m: skin, g: 'body', z: 6, rz: 6 }));
    sc.ell(31.5, 21.5, 8, 4, { m: skin, g: 'body', z: 4, rz: 5 });
    // belt + loincloth
    sc.cap(18, 41.5, 45, 41.5, 2.6, 2.6, { m: leather, g: 'belt', z: 12 });
    sc.poly([[24, 44], [40, 44], [38, 55], [31.5, 58], [25, 55]], { m: cloth, g: 'cloth', z: 13, bevel: 2 });
    sc.poly([[28, 39], [35, 39], [35, 44], [28, 44]], { m: iron, g: 'buckle', z: 16, bevel: 1 });
    // left arm: fist hanging by the hip, leather bracer
    sc.tube([[16, 27, 5, 6], [10.5, 35, 4.2, 6]], { m: skin, g: 'armL' });
    sc.tube([[10.5, 35, 4.2, 7], [12, 44, 4.4, 8]], { m: skin, g: 'foreL' });
    sc.ell(12.5, 47, 4.6, 4, { m: skin, g: 'fistL', z: 10 });
    sc.region((x, y) => sc.isG(x, y, 'foreL') && y > 38 && y < 44, leather);
    sc.carve([[10, 46], [10, 48.5]], -1).carve([[12.5, 46], [12.5, 49]], -1).carve([[15, 46], [15, 48.5]], -1);
    // right arm: bent, fist gripping the club at chest height
    sc.ell(47.5, 25, 6, 5.5, { m: skin, g: 'armR', z: 7 });
    sc.tube([[48, 27, 5, 6], [54.5, 35, 4.3, 7]], { m: skin, g: 'armR' });
    sc.tube([[54.5, 35, 4.2, 8], [50, 30.5, 4, 12]], { m: skin, g: 'foreR' });
    sc.ell(49, 30, 4.3, 3.9, { m: skin, g: 'fistR', z: 15 });
    sc.carve([[46.5, 28.5], [46.5, 31]], -1).carve([[49, 28], [49, 31.5]], -1);
    // pauldron: an iron dome with a leather rim and three spikes
    sc.ell(15, 22.5, 7, 5, { m: iron, g: 'pad', z: 12, rz: 5 });
    sc.tube([[7.5, 23.5, 1.4, 14], [15, 27.5, 1.6, 15], [22.5, 23.5, 1.4, 14]], { m: leather, g: 'padrim' });
    for (const [x0, x1, y1] of [[10.5, 8.5, 15], [14.5, 14, 14], [18.5, 20, 15]]) sc.tube([[x0, 19.5, 1.4, 15], [x1, y1, 0.3, 15]], { m: iron, g: 'spike' + x0, k: 0 });
    // head
    sc.ell(31.5, 14, 8.5, 8, { m: skin, g: 'head', z: 12, rz: 8 });
    sc.ell(31.5, 19.5, 9.5, 5.2, { m: skin, g: 'head', z: 13, rz: 7 });
    sc.ell(31.5, 10.5, 8, 2.4, { m: skin, g: 'head', z: 18, rz: 2 });
    sym(W, (X) => sc.tube([[X(23.5), 12, 2.4, 12], [X(17.5), 8.5, 1.6, 12], [X(14), 6, 0.5, 12]], { m: skin, g: 'ear' + X(0) }));
    sc.ell(31.5, 16.5, 4.6, 3.4, { m: skin, g: 'snout', z: 20, rz: 3 });
    sym(W, (X) => sc.tube([[X(27), 22.5, 1.4, 22], [X(25.6), 17.5, 0.5, 22]], { m: bone, g: 'tusk' + X(0) }));
    // spiky crest of hair
    sc.tube([[31.5, 7, 2.2, 18], [31.5, 0.5, 0.7, 18]], { m: hair, g: 'hair0' });
    sym(W, (X, s) => {
      sc.tube([[X(29.5), 7.5, 1.9, 17], [X(27.5), 1.5, 0.6, 17]], { m: hair, g: 'hair1' + s });
      sc.tube([[X(27.5), 8, 1.6, 16], [X(24), 3, 0.5, 16]], { m: hair, g: 'hair2' + s });
    });
    // muscle creases
    sc.carve([[21, 32], [25, 33], [30, 32]], -1).carve([[33, 32], [38, 33], [42, 32]], -1);
    sc.carve([[31.5, 35], [31.5, 37]], -1);
    const p = sc.render();
    // face
    stamp(p, 29, 16, ['k..k', 'k..k'], { k: INK });                                   // nostrils
    stampM(p, 25, 12, ['kkkk', 'kwrk', '.kk.'], { k: INK, w: '#fff4c0', r: '#e02818' }); // angry eyes
    stamp(p, 26, 21, ['.kkkkkkkkkkk.', 'kk.........kk'], { k: INK });                  // mouth
    stamp(p, 29, 40, ['kkkkkk', 'k....k', 'kkkkkk'], { k: INK });                      // buckle frame
    return finish(p);
  };

  // Merman: a broad-shouldered fish-man standing on his coiled tail, trident
  // in one hand and webbed claws on the other; bulging eyes and sulky lips.
  S.merman = () => {
    const W = 48, H = 48;
    const scale = mat('#3a9a86', { n: 5, rim: 1, tex: texScales(4, 3) });
    const belly = mat('#d8dc9c', { n: 4 });
    const fin = mat('#e8784a', { n: 4 });
    const gold = mat('#e0b038', { n: 5, spec: 0.92 });
    const lip = mat('#e89a7a', { n: 4 });
    const eyeM = mat('#f6e27a', { n: 3, flat: true, bias: 0.2, contrast: 0.6 });
    const claw = mat('#ece4cc', { n: 3, dark: 0.4 });
    const sc = new Scene(W, H);
    // tail curling to the side, fin fanned on the ground
    sc.poly([[37, 43], [41, 32.5], [47, 34], [46.5, 40], [44, 46.5]], { m: fin, g: 'tailfin', z: 2, bevel: 1.5 });
    sc.tube([[23.5, 29, 6.5, 2], [23.5, 37, 5.8, 3], [26, 42.5, 4.6, 4], [32, 43.5, 3.3, 4], [38.5, 41, 2.2, 4]], { m: scale, g: 'body' });
    // torso: broad chest tapering to the tail
    sc.ell(23.5, 21.5, 10.5, 6.5, { m: scale, g: 'body', z: 4, rz: 8 });
    sc.ell(23.5, 27.5, 7.5, 5, { m: scale, g: 'body', z: 4, rz: 7 });
    sc.region((x, y) => sc.isG(x, y, 'body') && y > 23 && y < 41 && Math.abs(x - 23.5 - (y > 34 ? (y - 34) * 0.35 : 0)) < 4.4 - Math.max(0, y - 32) * 0.12, belly);
    // shoulder fins
    sym(W, (X, s) => sc.poly([[X(15), 16], [X(9.5), 12.5], [X(10.5), 16.5], [X(8.5), 19], [X(14), 20]], { m: fin, g: 'sfin' + s, z: 3, bevel: 1 }));
    // crest and gill fins behind the head
    sc.poly([[18, 5], [16.5, 0.5], [20.5, 2], [23.5, -0.5], [26.5, 2], [30.5, 0.5], [29, 5]], { m: fin, g: 'crest', z: 2, bevel: 1 });
    sym(W, (X, s) => sc.poly([[X(16.5), 10], [X(11), 7.5], [X(12), 11], [X(10.5), 14.5], [X(16), 14]], { m: fin, g: 'gill' + s, z: 6, bevel: 1 }));
    // head: wide fish skull, eyes bulging from the sides, thick lips
    sc.ell(23.5, 10.5, 7.5, 6.5, { m: scale, g: 'head', z: 8, rz: 7 });
    sym(W, (X, s) => sc.ell(X(17), 7.5, 3, 3, { m: eyeM, g: 'eye' + s, z: 12, rz: 3 }));
    sc.ell(23.5, 15.2, 4.4, 2, { m: lip, g: 'lip', z: 14, rz: 2 });
    // left arm with trident
    sc.cap(8.5, 47, 8.5, 7, 1, 1, { m: gold, g: 'trident', z: 12 });
    sc.tube([[8.5, 7, 1.1, 12], [8.5, 0.5, 0.4, 12]], { m: gold, g: 'trident' });
    sc.tube([[4.6, 8, 0.9, 12], [4, 4, 0.8, 12], [4.6, 0.8, 0.4, 12]], { m: gold, g: 'trident' });
    sc.tube([[12.4, 8, 0.9, 12], [13, 4, 0.8, 12], [12.4, 0.8, 0.4, 12]], { m: gold, g: 'trident' });
    sc.cap(4.5, 8.5, 12.5, 8.5, 1.1, 1.1, { m: gold, g: 'trident', z: 12 });
    sc.tube([[15, 18.5, 3.3, 8], [11.5, 26, 2.9, 9]], { m: scale, g: 'armL' });
    sc.tube([[11.5, 26, 2.9, 9], [9, 21.5, 2.6, 12]], { m: scale, g: 'foreL' });
    sc.ell(8.5, 21, 2.9, 2.7, { m: scale, g: 'handL', z: 14, rz: 2.5 });
    // right arm: forearm fin and hooked claws
    sc.poly([[37, 25], [43.5, 25.5], [39.5, 31]], { m: fin, g: 'armfin', z: 7, bevel: 1 });
    sc.tube([[32, 18.5, 3.3, 8], [36, 26, 2.9, 8]], { m: scale, g: 'armR' });
    sc.tube([[36, 26, 2.9, 9], [37.5, 32, 2.6, 10]], { m: scale, g: 'foreR' });
    sc.ell(38, 34, 2.9, 2.6, { m: scale, g: 'handR', z: 12, rz: 2.5 });
    for (const [x0, x1] of [[36, 35], [38, 38], [40, 41]]) sc.tube([[x0, 35.5, 0.8, 13], [x1, 38.5, 0.3, 13]], { m: claw, g: 'claws' });
    // belly ridges, fin rays, pectoral line
    for (const y of [26, 29, 32, 35]) sc.carve([[20.5, y], [26.5, y]], -1);
    for (const q of [[41, 32.5], [47, 34], [46.5, 40]]) sc.carve([[38, 42], q], -1);
    sc.carve([[20.5, 4.5], [20.5, 2.5]], -1).carve([[26.5, 4.5], [26.5, 2.5]], -1);
    sc.carve([[19, 18], [23.5, 20], [28, 18]], -1);
    const p = sc.render();
    // pupils glaring at the party, heavy brow, sulky mouth with fangs
    stamp(p, 16, 7, ['kk', 'kk'], { k: INK });
    stamp(p, 30, 7, ['kk', 'kk'], { k: INK });
    stamp(p, 15, 6, ['w'], { w: WHITE });
    stamp(p, 29, 6, ['w'], { w: WHITE });
    stamp(p, 19, 10, ['kk......kk', '..k....k..'], { k: INK });
    stamp(p, 20, 15, ['.kkkkkkk.', 'k.......k'], { k: INK });
    stamp(p, 21, 16, ['w.....w'], { w: WHITE });
    return finish(p);
  };

  // Harpy: a wild-haired bird-woman with great wings for arms, downy chest
  // feathers, a feathered skirt and hooked talons, screeching at the party.
  S.harpy = () => {
    const W = 48, H = 48;
    const cov = mat('#c8783c', { n: 5, rim: 1 });
    const prim = mat('#9a5236', { n: 5 });
    const tipM = mat('#f0dcaa', { n: 4 });
    const down = mat('#f4e6c4', { n: 4, bias: 0.05 });
    const skin = mat('#f4c09a', { n: 4, bias: 0.12, contrast: 0.8 });
    const hair = mat('#7a48b8', { n: 5, rim: 1 });
    const leg = mat('#e8c850', { n: 4 });
    const claw = mat('#403040', { n: 3 });
    const sc = new Scene(W, H);
    // wings raised in a V: a fan of primaries under the covert arm
    sym(W, (X, s) => {
      const F = [
        [[4, 5], [0.5, 13.5]], [[6, 7.5], [0.5, 21]], [[8, 9.5], [2.5, 27]],
        [[10.5, 12], [6.5, 30.5]], [[13, 14.5], [10.5, 31]], [[15.5, 17], [14.5, 28.5]],
      ];
      F.forEach(([r, t], k) => {
        const mx = (r[0] + t[0]) / 2 - 0.6, my = (r[1] + t[1]) / 2;
        const tx = r[0] + (t[0] - r[0]) * 0.78, ty = r[1] + (t[1] - r[1]) * 0.78;
        sc.tube([[X(r[0]), r[1], 2.3, -8 + k], [X(mx), my, 2.1, -8 + k], [X(tx), ty, 1.6, -8 + k]], { m: prim, g: 'f' + k + s });
        sc.tube([[X(tx), ty, 1.6, -8 + k], [X(t[0]), t[1], 0.5, -8 + k]], { m: tipM, g: 'f' + k + s });
      });
      sc.tube([[X(18), 19.5, 2.5, 0], [X(12), 13, 2.5, 1], [X(6), 6.5, 2.1, 1], [X(2), 2, 1, 1]], { m: cov, g: 'wing' + s });
      for (const [x, y] of [[13.5, 16.5], [10, 12.5], [7, 9.5]]) sc.tube([[X(x + 1), y - 1, 1.5, 2], [X(x - 1), y + 2.5, 0.5, 2]], { m: cov, g: 'wing' + s });
    });
    // talons
    sym(W, (X, s) => {
      sc.tube([[X(21), 35, 1.8, 2], [X(20), 40.5, 1.4, 2], [X(19.5), 44, 1.2, 2]], { m: leg, g: 'leg' + s });
      for (const [tx, ty] of [[16, 47], [19.3, 47.4], [22.3, 46.8]]) sc.tube([[X(19.5), 44, 1, 3], [X(tx), ty, 0.4, 3]], { m: claw, g: 'toe' + s });
    });
    // body: bare shoulders and waist, downy chest, feathered skirt
    sc.ell(23.5, 33, 6.5, 3.6, { m: cov, g: 'skirt', z: 6, rz: 5 });
    for (let i = -3; i <= 3; i++) sc.tube([[23.5 + i * 1.9, 34.5, 1.5, 7], [23.5 + i * 2.2, 38.8 - Math.abs(i) * 0.7, 0.4, 7]], { m: cov, g: 'skirt' });
    sc.ell(23.5, 27.5, 4, 4.5, { m: skin, g: 'body', z: 4, rz: 4 });
    sc.ell(23.5, 20.5, 6.4, 2.4, { m: skin, g: 'body', z: 4, rz: 3 });
    sc.ell(23.5, 23.5, 5, 3.3, { m: down, g: 'chest', z: 7, rz: 4 });
    for (let i = -2; i <= 2; i++) sc.tube([[23.5 + i * 2, 25.5, 1.3, 8], [23.5 + i * 2.1, 28 - Math.abs(i) * 0.5, 0.4, 8]], { m: down, g: 'chest' });
    // wild hair: back mass, side locks, spikes
    sc.ell(23.5, 12.5, 8.6, 8.4, { m: hair, g: 'hairback', z: -2, rz: 6 });
    sym(W, (X) => {
      sc.tube([[X(16.5), 12, 2.9, -1], [X(15), 18, 2.4, -1], [X(16), 23.5, 0.8, -1]], { m: hair, g: 'hairback' });
      sc.tube([[X(17), 8, 2.3, -2], [X(12), 5.5, 1.4, -2], [X(8.5), 7, 0.5, -2]], { m: hair, g: 'hairback' });
      sc.tube([[X(16), 13, 2.2, -2], [X(10.5), 14.5, 1.3, -2], [X(8), 18, 0.5, -2]], { m: hair, g: 'hairback' });
    });
    sc.cap(23.5, 16, 23.5, 19, 2, 2, { m: skin, g: 'neck', z: 3 });
    sc.ell(23.5, 12.5, 5.4, 6, { m: skin, g: 'head', z: 6, rz: 5 });
    sc.ell(23.5, 7, 6, 2.6, { m: hair, g: 'bangs', z: 10, rz: 3 });
    for (const [x0, x1] of [[19, 18.5], [21.8, 21.2], [25.2, 25.8], [28, 29]]) sc.tube([[x0, 7.5, 1.6, 11], [x1, 10.5, 0.5, 11]], { m: hair, g: 'bangs' });
    const p = sc.render();
    // fierce eyes, screeching mouth
    stamp(p, 19, 11, ['kk..', 'kyyk', '.kk.'], { k: INK, y: '#f8d030' });
    stamp(p, 25, 11, ['..kk', 'kyyk', '.kk.'], { k: INK, y: '#f8d030' });
    stamp(p, 22, 15, ['kkkk', 'krrk', '.kk.'], { k: INK, r: '#c83040' });
    return finish(p);
  };

  // Dark mage: a hooded sorcerer whose face is pure shadow and two burning
  // eyes; a claw-headed staff holds a glowing orb, the other hand conjures
  // a violet flame.
  S.darkmage = () => {
    const W = 48, H = 48;
    const robe = mat('#5a3c96', { n: 5, rim: 1 });
    const trim = mat('#e8b840', { n: 4, spec: 0.93, bias: 0.22, contrast: 0.7 });
    const inner = mat('#221830', { n: 3, flat: true, dark: 0.5, light: 0.3 });
    const skin = mat('#c8ccb0', { n: 4, bias: 0.1 });
    const wood = mat('#7a5a3a', { n: 4 });
    const sash = mat('#b03848', { n: 4 });
    const orb = mat('#40d8ff', { glow: 1.1, ramp: ['#1a50a8', '#2a90e0', '#58d8ff', '#b8f4ff', '#ffffff'] });
    const fire = ['#50187a', '#8a2ac8', '#c060f0', '#f0a8ff', '#fff0ff'];
    const sc = new Scene(W, H);
    // robe
    sc.poly([[16, 16], [31, 16], [36.5, 32], [41, 45.5], [35, 47], [23.5, 46.5], [12, 47], [6, 45.5], [10.5, 32]], { m: robe, g: 'robe', z: 2, bevel: 5, bz: 6 });
    sc.region((x, y) => sc.isG(x, y, 'robe') && (y >= 44 || (Math.abs(x - 23.5) < 1.6 && y > 29)), trim);
    sc.cap(15, 29, 32, 29, 1.4, 1.4, { m: sash, g: 'sash', z: 9 });
    sc.tube([[25, 29.5, 1, 10], [26.5, 34, 0.9, 10], [26, 37, 0.6, 10]], { m: sash, g: 'sash' });
    // hood
    sc.ell(23.5, 17.5, 10, 3.6, { m: robe, g: 'hood', z: 5, rz: 4 });
    sc.ell(23.5, 11.5, 8, 8.5, { m: robe, g: 'hood', z: 6, rz: 8 });
    sc.tube([[23.5, 5, 3, 7], [25.5, 1, 1.4, 6], [28.5, 0.5, 0.5, 5]], { m: robe, g: 'hood' });
    sc.region((x, y) => sc.isG(x, y, 'hood') && ((x - 23.5) / 6.6) ** 2 + ((y - 13) / 7.2) ** 2 <= 1, trim);
    sc.ell(23.5, 13.5, 5, 5.6, { m: inner, g: 'face', z: 15, rz: 2 });
    // left: sleeve, hand and staff with orb
    sc.cap(8.5, 47, 8.5, 8, 1.2, 1.2, { m: wood, g: 'staff', z: 11 });
    sc.tube([[8.5, 9, 1.1, 11], [5, 6, 0.9, 11], [5.6, 1.5, 0.4, 11]], { m: wood, g: 'staff' });
    sc.tube([[8.5, 9, 1.1, 11], [12, 6, 0.9, 11], [11.4, 1.5, 0.4, 11]], { m: wood, g: 'staff' });
    sc.ell(8.5, 4.5, 3, 3, { m: orb, g: 'orb', z: 10, rz: 3 });
    sc.tube([[15.5, 18, 3, 7], [11.5, 25, 4, 8], [9.5, 30, 4.8, 9]], { m: robe, g: 'sleeveL' });
    sc.ell(8.5, 30.5, 2, 2.2, { m: skin, g: 'handL', z: 14 });
    sc.carve([[7, 30], [10, 30]], -2).carve([[7, 31.5], [10, 31.5]], -1);
    // right: sleeve and a hand conjuring violet fire
    sc.tube([[31.5, 18, 3, 7], [35.5, 23, 4, 8], [38, 27, 4.4, 9]], { m: robe, g: 'sleeveR' });
    sc.ell(38.5, 27.5, 2.4, 2.1, { m: skin, g: 'handR', z: 14 });

    // robe folds
    sc.carve([[20, 32], [18, 44]], -1).carve([[27.5, 32], [30, 44]], -1).carve([[14, 36], [11, 44]], -1).carve([[33, 36], [36, 44]], -1);
    sc.carve([[19, 32], [17, 44]], 1).carve([[26.5, 32], [29, 44]], 1);
    const p = sc.render();
    paintFlame(p, 38.5, 26, 14, 3, 1.5, fire);
    // burning eyes in the dark hood and a thin cruel grin
    stampM(p, 20, 12, ['yy', 'o.'], { y: '#fff070', o: '#e08020' });
    stamp(p, 21, 16, ['k....k', '.kkkk.'], { k: '#5a4a70' });
    // orb glint
    stamp(p, 7, 3, ['w'], { w: WHITE });
    return finish(p);
  };

  // Living armor: an empty suit of plate animated by a red glare behind the
  // visor, sword raised, kite shield with a gold sun, plume streaming back.
  S.armor = () => {
    const W = 48, H = 48;
    const steel = mat('#8c9cb8', { n: 5, spec: 0.9, rim: 1 });
    const chain = mat('#4a4e62', { n: 4 });
    const plume = mat('#d03c3c', { n: 5 });
    const field = mat('#3858b0', { n: 5 });
    const gold = mat('#e0b040', { n: 4, spec: 0.92 });
    const blade = mat('#c8d4e8', { n: 5, spec: 0.85, light: 0.9 });
    const sc = new Scene(W, H);
    // legs
    sym(W, (X, s) => {
      sc.tube([[X(19.5), 33, 2.8, 2], [X(18.5), 39, 2.6, 3], [X(18), 44, 2.4, 4]], { m: steel, g: 'leg' + s });
      sc.ell(X(18.5), 38.5, 2.9, 2.3, { m: steel, g: 'knee' + s, z: 7, rz: 2.5 });
      sc.ell(X(17.5), 45.5, 4, 2.2, { m: steel, g: 'foot' + s, z: 7, rz: 2.5 });
    });
    // faulds and breastplate
    sc.poly([[15, 29], [32, 29], [34, 36], [13, 36]], { m: steel, g: 'fauld', z: 6, bevel: 2 });
    sc.ell(23.5, 16, 7, 3, { m: chain, g: 'gorget', z: 2 });
    sc.ell(23.5, 22.5, 9, 8, { m: steel, g: 'chest', z: 4, rz: 8 });
    sc.cap(14.5, 29.5, 32.5, 29.5, 1.3, 1.3, { m: gold, g: 'belt', z: 11 });
    // pauldrons
    sym(W, (X, s) => {
      sc.ell(X(13), 20.5, 5, 3, { m: steel, g: 'padlo' + s, z: 7, rz: 3 });
      sc.ell(X(13.5), 17.5, 5.5, 4.2, { m: steel, g: 'pad' + s, z: 9, rz: 4 });
    });
    // sword arm
    sc.tube([[13, 21, 2.5, 5], [10.5, 24.5, 2.3, 6]], { m: chain, g: 'armL' });
    sc.poly([[8.5, 21], [12.5, 21], [12.5, 4.5], [10.5, 1], [8.5, 4.5]], { m: blade, g: 'blade', z: 11, bevel: 1.2, bz: 1 });
    sc.cap(6.5, 21.5, 14.5, 21.5, 1.2, 1.2, { m: gold, g: 'guard', z: 13 });
    sc.cap(10.5, 26, 10.5, 28, 0.9, 0.9, { m: chain, g: 'grip', z: 12 });
    sc.ell(10.5, 29, 1.5, 1.4, { m: gold, g: 'pommel', z: 12 });
    sc.ell(10.5, 24.5, 2.8, 2.6, { m: steel, g: 'gauntL', z: 14, rz: 2.5 });
    // shield arm
    sc.tube([[34, 21, 2.5, 5], [36, 26, 2.3, 6]], { m: chain, g: 'armR' });
    const kite = [[29.5, 17.5], [43.5, 17.5], [44.5, 22], [43, 30], [36.5, 40.5], [30, 30], [28.5, 22]];
    sc.poly(kite, { m: gold, g: 'shield', z: 14, bevel: 2 });
    sc.poly([[31, 19], [42, 19], [43, 22.5], [41.5, 29.5], [36.5, 37.8], [31.5, 29.5], [30, 22.5]], { m: field, g: 'field', z: 15.5, bevel: 3, soft: true });
    // helmet, visor plate, plume
    sc.tube([[23.5, 3, 1.9, 10], [27.5, 0.5, 1.8, 8], [33, 1.5, 1.5, 6], [36.5, 6, 0.6, 4]], { m: plume, g: 'plume' });
    sc.ell(23.5, 9, 6, 6.5, { m: steel, g: 'helm', z: 8, rz: 6 });
    sc.poly([[18, 8], [29, 8], [28.5, 14.5], [23.5, 16.5], [18.5, 14.5]], { m: steel, g: 'visor', z: 13, bevel: 2 });
    sc.carve([[23.5, 3], [23.5, 7]], 1);
    sc.carve([[23, 17], [23, 28]], 1).carve([[24, 17], [24, 28]], -1);
    for (const y of [31.5, 33.5]) sc.carve([[15, y], [32, y]], -1);
    sc.carve([[10.5, 5], [10.5, 19]], -1);
    const p = sc.render();
    // visor slit with a red glare, breathing holes
    stamp(p, 19, 10, ['kkkkkkkkkk', 'kkgrkkgrkk'], { k: INK, r: '#ff3830', g: '#ffb0a0' });
    for (const [x, y] of [[21, 13], [23, 14], [25, 13], [22, 15], [24, 15]]) p.set(x, y, INK);
    // gold sun on the shield
    stamp(p, 33, 22, [
      '...y...',
      '.y.y.y.',
      '..yyy..',
      'yyywyyy',
      '..yyy..',
      '.y.y.y.',
      '...y...',
    ], { y: '#f0c848', w: '#fff8d0' });
    return finish(p);
  };

  // Gargoyle: a grinning stone demon crouched on its pedestal, bat wings
  // raised, horns swept back, claws resting on its knees; eyes smoulder red.
  S.gargoyle = () => {
    const W = 48, H = 48;
    const stone = mat('#8c8ca4', { n: 5, rim: 1, tex: texStone(5) });
    const memb = mat('#6c6a88', { n: 4, tex: texStone(9) });
    const block = mat('#9a9290', { n: 5, tex: texStone(11) });
    const horn = mat('#d8d0c0', { n: 4, dark: 0.5 });
    const sc = new Scene(W, H);
    // pedestal: lit top face and a front face
    sc.poly([[9, 40], [38, 40], [39, 47], [8, 47]], { m: block, g: 'ped', z: 0, bevel: 1.5 });
    sc.poly([[10, 37.5], [37, 37.5], [38, 40.5], [9, 40.5]], { m: block, g: 'pedtop', z: 2, n: [0, -0.9, 0.45], bevel: 1 });
    // wings: bones and scalloped membranes
    sym(W, (X, s) => {
      sc.poly([[X(17), 18], [X(7), 5], [X(1), 2], [X(2), 9], [X(0.5), 14], [X(4), 15.5], [X(3), 22], [X(8), 20.5], [X(10), 25], [X(15), 22]], { m: memb, g: 'memb' + s, z: -6, bevel: 1 });
      sc.tube([[X(17), 18.5, 1.8, -3], [X(10), 9, 1.5, -3], [X(7), 5, 1.2, -3], [X(1), 1.5, 0.5, -3]], { m: stone, g: 'wbone' + s });
      sc.tube([[X(7), 5.5, 0.9, -4], [X(1), 14, 0.5, -4]], { m: stone, g: 'wbone' + s });
      sc.tube([[X(8), 6.5, 0.9, -4], [X(3.5), 21.5, 0.5, -4]], { m: stone, g: 'wbone' + s });
      sc.tube([[X(9.5), 8.5, 0.9, -4], [X(9.5), 24.5, 0.5, -4]], { m: stone, g: 'wbone' + s });
    });
    // tail around the pedestal
    sc.tube([[30, 34, 1.8, -2], [38, 36, 1.5, 3], [41, 41, 1.2, 6], [37.5, 44.5, 0.9, 8]], { m: stone, g: 'tail' });
    sc.poly([[35, 43.5], [38, 42], [37.5, 46.5]], { m: stone, g: 'tail', z: 9 });
    // crouched legs
    sym(W, (X, s) => {
      sc.ell(X(16.5), 31, 5.2, 4.5, { m: stone, g: 'thigh' + s, z: 6, rz: 5 });
      sc.tube([[X(15), 33, 2.6, 5], [X(14.5), 37.5, 2.2, 6]], { m: stone, g: 'shin' + s });
      for (const [tx, ty] of [[11, 39.5], [13.5, 40.2], [16.5, 40], [18.5, 39.2]]) sc.tube([[X(14.5), 37.5, 1.1, 8], [X(tx), ty, 0.5, 9]], { m: stone, g: 'toe' + s });
    });
    // torso + arms resting on the knees
    sc.ell(23.5, 25, 8, 7.5, { m: stone, g: 'body', z: 3, rz: 7 });
    sym(W, (X, s) => {
      sc.ell(X(15.5), 20.5, 4, 3.6, { m: stone, g: 'arm' + s, z: 8 });
      sc.tube([[X(15.5), 21, 2.4, 8], [X(13), 27, 2.1, 10]], { m: stone, g: 'arm' + s });
      sc.tube([[X(13), 27, 2.1, 10], [X(17), 30.5, 2, 12]], { m: stone, g: 'fore' + s });
      sc.ell(X(18), 31, 2.3, 2, { m: stone, g: 'hand' + s, z: 13 });
      for (const [tx, ty] of [[17, 34.5], [19, 34.5], [20.5, 33.5]]) sc.tube([[X(tx - 0.5), 32, 0.8, 14], [X(tx), ty, 0.3, 14]], { m: horn, g: 'claw' + s });
    });
    // head: horns, ears, brow
    sym(W, (X, s) => {
      sc.tube([[X(20), 9, 1.6, 6], [X(16.5), 4.5, 1.2, 5], [X(17), 0.5, 0.4, 4]], { m: horn, g: 'horn' + s });
      sc.tube([[X(18), 13, 1.4, 6], [X(13.5), 11, 0.9, 6], [X(12), 8.5, 0.4, 6]], { m: stone, g: 'ear' + s });
    });
    sc.ell(23.5, 13, 5.8, 5.4, { m: stone, g: 'head', z: 9, rz: 5 });
    sc.ell(23.5, 16.5, 4.6, 2.6, { m: stone, g: 'head', z: 11, rz: 3 });
    sc.ell(23.5, 10.4, 5.2, 1.6, { m: stone, g: 'head', z: 13, rz: 1.5 });
    sc.carve([[20, 22], [23.5, 24], [27, 22]], -1).carve([[23.5, 25], [23.5, 29]], -1);
    const p = sc.render();
    // angry brows, smouldering eyes, wide fanged grin
    stampM(p, 19, 11, ['kk..', '.krk'], { k: INK, r: '#ff4028' });
    stamp(p, 19, 15, [
      'k........k',
      'kkkkkkkkkk',
      '.kwkkkkwk.',
      '..kkkkkk..',
    ], { k: INK, w: WHITE });
    return finish(p);
  };

  // Salamander: a crawling fire lizard with bulging eyes and a wide grin
  // full of embers, a crest of flame along its back and a burning tail.
  S.salamander = () => {
    const W = 48, H = 48;
    const scale = mat('#d8502a', { n: 5, rim: 1 });
    const spot = mat('#f4a030', { n: 4 });
    const belly = mat('#f4c870', { n: 4 });
    const fire = mat('#f89820', { glow: 1.5, ramp: ['#b01c10', '#e04a18', '#f89028', '#fcd850', '#fffbe0'] });
    const claw = mat('#3a2a30', { n: 3 });
    const mouth = mat('#6a1420', { n: 3, flat: true });
    const sc = new Scene(W, H);
    // tail rising behind on the right, burning at the tip
    sc.tube([[31, 34, 3.4, -8], [40, 29, 2.8, -8], [43.5, 21, 2.1, -8], [41, 15, 1.4, -8]], { m: scale, g: 'tail' });
    flame(sc, 41, 15.5, 13, 2.8, 2, { m: fire, g: 'tailfire', z: -5 });
    // crest of fire along the back
    flame(sc, 23.5, 23, 19, 4.6, -1, { m: fire, g: 'backfire', z: -9 });
    flame(sc, 15, 27, 12, 3.2, -3, { m: fire, g: 'backfire', z: -9 });
    flame(sc, 32, 27, 12, 3.2, 3, { m: fire, g: 'backfire', z: -9 });
    // hind legs (splayed, behind)
    sym(W, (X, s) => {
      sc.tube([[X(14), 34, 3.4, -4], [X(5.5), 38, 2.8, -3], [X(5), 44, 2.3, -2]], { m: scale, g: 'hind' + s });
      for (const [tx, ty] of [[1.5, 47], [4.5, 47.3], [7.5, 47]]) sc.tube([[X(5), 44, 1.2, -1], [X(tx), ty, 0.4, -1]], { m: claw, g: 'htoe' + s });
    });
    // body with spots
    sc.ell(23.5, 34, 12, 7.5, { m: scale, g: 'body', z: 0, rz: 9 });
    const spots = [[14, 30, 1.8], [33, 30, 1.8], [17, 36, 1.4], [30, 36.5, 1.4], [12, 35, 1.1], [35.5, 34.5, 1.1]];
    sc.region((x, y) => sc.isG(x, y, 'body') && spots.some(([sx, sy, r]) => Math.hypot(x - sx, (y - sy) * 1.2) < r + 0.3), spot);
    sc.ell(23.5, 39, 6, 3.6, { m: belly, g: 'chest', z: 6, rz: 5 });
    // front legs
    sym(W, (X, s) => {
      sc.tube([[X(16), 35, 3.3, 6], [X(11), 39.5, 2.9, 7], [X(12), 44.5, 2.4, 8]], { m: scale, g: 'front' + s });
      for (const [tx, ty] of [[8.5, 47.5], [11.5, 47.8], [14.5, 47.5]]) sc.tube([[X(12), 44.5, 1.2, 9], [X(tx), ty, 0.4, 9]], { m: claw, g: 'ftoe' + s });
    });
    // head: broad flat skull with bulging eye mounds, pale lower jaw, open mouth
    sc.ell(23.5, 25.5, 10.5, 6, { m: scale, g: 'head', z: 9, rz: 7 });
    sym(W, (X) => sc.ell(X(16), 21, 4, 3.6, { m: scale, g: 'head', z: 12, rz: 3.5 }));
    sc.ell(23.5, 32, 7.8, 3, { m: scale, g: 'jaw', z: 12, rz: 3 });
    sc.region((x, y) => sc.isG(x, y, 'jaw') && y >= 33.5, belly);
    sc.ell(23.5, 29.6, 7, 2.3, { m: mouth, g: 'mouth', z: 16, rz: 1 });
    sc.ell(23.5, 30.3, 3.8, 1.2, { m: fire, g: 'breath', z: 17, rz: 1.2 });
    sc.region((x, y) => sc.isG(x, y, 'head') && spots.some(([sx, sy, r]) => Math.hypot(x - sx - 9.5 * Math.sign(sx - 23.5), (y - sy + 7) * 1.2) < r - 0.2), spot);
    const p = sc.render();
    // bulging eyes with slit pupils
    stamp(p, 13, 18, ['.kkkk.', 'kwyyyk', 'kyykyk', 'kyykyk', '.kkkk.'], { k: INK, y: '#fff060', w: WHITE });
    stamp(p, 29, 18, ['.kkkk.', 'kwyyyk', 'kykyyk', 'kykyyk', '.kkkk.'], { k: INK, y: '#fff060', w: WHITE });
    // nostrils and fangs along the upper jaw
    stamp(p, 21, 24, ['k....k'], { k: INK });
    stamp(p, 17, 28, ['.w..........w.', '..w........w..'], { w: WHITE });
    return finish(p);
  };

  // Cactus: a sun-baked cactus warrior on stubby root legs, one arm raised to
  // swing, a pink flower on its head and a gleefully nasty grin.
  S.cactus = () => {
    const W = 48, H = 48;
    const green = mat('#5aa048', { n: 5, rim: 1 });
    const petal = mat('#f070a8', { n: 4 });
    const heart = mat('#f8d040', { n: 3 });
    const root = mat('#9a6a3a', { n: 4 });
    const sc = new Scene(W, H);
    // legs
    sym(W, (X, s) => {
      sc.tube([[X(19.5), 39, 3, 0], [X(17.5), 44, 2.6, 1], [X(16.5), 46, 2.4, 2]], { m: root, g: 'leg' + s });
      sc.ell(X(16), 46.5, 3.6, 1.6, { m: root, g: 'foot' + s, z: 4, rz: 2 });
    });
    // body with ribs
    sc.tube([[23.5, 40, 8.6, 2], [23.5, 14, 8.2, 2]], { m: green, g: 'body' });
    sc.ell(23.5, 13.5, 8.2, 6, { m: green, g: 'body', z: 2, rz: 8 });
    // arms: raised left, lowered right
    sc.tube([[16, 27, 3.4, 4], [9.5, 27.5, 3.2, 4], [7.5, 21, 3, 4], [7.5, 13.5, 2.8, 4]], { m: green, g: 'armL' });
    sc.tube([[31, 31, 3.2, 4], [37.5, 31.5, 3, 4], [39.5, 26, 2.6, 4], [39.5, 22.5, 2.4, 4]], { m: green, g: 'armR' });
    for (const x of [18.5, 23.5, 28.5]) sc.carve([[x, 10], [x + (x - 23.5) * 0.12, 42]], -1);
    for (const x of [19.5, 24.5, 29.5]) sc.carve([[x, 11], [x + (x - 23.5) * 0.12, 42]], 1);
    sc.carve([[7.5, 13], [7.5, 23]], -1).carve([[39.5, 22], [39.5, 28]], -1);
    // flower on the head
    for (const [px, py] of [[28, 3], [32, 5.5], [30.5, 9.5], [25.5, 8.5], [24.5, 4]]) sc.ell(px, py, 2.8, 2.6, { m: petal, g: 'petal', z: 12, rz: 2.5 });
    sc.ell(28.3, 6.3, 1.9, 1.8, { m: heart, g: 'heart', z: 15, rz: 2 });
    const p = sc.render();
    // spines along the ribs and arms
    const spine = '#f4ecd0';
    for (const [x, y] of [[16, 18], [21, 15], [26, 17], [31, 19], [16, 30], [21, 34], [26, 32], [31, 33], [21, 25], [26, 24], [16, 38], [31, 38], [5, 16], [10, 20], [5, 24], [12, 29], [37, 25], [42, 27], [35, 33], [42, 33]]) {
      p.set(x, y, spine); p.set(x + 1, y - 1, spine);
    }
    // hollow eyes with a glint, angry brows, big grin
    stamp(p, 17, 16, ['kk.....kk', '.kk...kk.'], { k: INK });
    stampM(p, 18, 18, ['kkk', 'kwk', 'kkk'], { k: INK, w: '#fff6a0' });
    stamp(p, 18, 23, [
      'k..........k',
      'kkkkkkkkkkkk',
      '.krrrrrrrrk.',
      '..kkrrrrkk..',
      '...kkkkkk...',
    ], { k: INK, r: '#8a2438' });
    stamp(p, 20, 25, ['w......w'], { w: WHITE });
    return finish(p);
  };

  // Frostling: a small ice imp with a crown of crystal spikes, a fluffy snow
  // collar and a mischievous grin, conjuring a snowflake over one hand.
  S.frostling = () => {
    const W = 48, H = 48;
    const ice = mat('#7cc4f0', { n: 5, spec: 0.93, rim: 1 });
    const crystal = mat('#9ad8ff', { n: 5, spec: 0.9, light: 0.85 });
    const snow = mat('#e0ecf8', { n: 4, dark: 0.45, light: 0.8, tex: texFur(0.12, 3) });
    const sc = new Scene(W, H);
    // snow drift
    sc.ell(23.5, 45.5, 15, 2.8, { m: snow, g: 'drift', z: 0, rz: 3 });
    // stubby legs in snow boots
    sym(W, (X, s) => {
      sc.tube([[X(20), 36.5, 2.9, 4], [X(19.5), 40.5, 2.7, 5]], { m: ice, g: 'leg' + s });
      sc.ell(X(19), 42.3, 3.9, 2.3, { m: snow, g: 'boot' + s, z: 7, rz: 2 });
    });
    // crystal crown (behind the head)
    for (const [x0, x1, y1, r] of [[23.5, 23.5, 0, 2.5], [18.5, 15, 1.5, 2], [28.5, 32, 1.5, 2], [14.5, 9, 6, 1.7], [32.5, 38, 6, 1.7]])
      sc.tube([[x0, 9, r, -2], [x1, y1, 0.3, -2]], { m: crystal, g: 'crown' + x0, k: 0 });
    // chubby body and arms
    sc.ell(23.5, 32.5, 8, 6.5, { m: ice, g: 'body', z: 2, rz: 6 });
    sc.tube([[16.5, 29.5, 2.4, 5], [12, 32.5, 2.1, 6], [10, 35, 2, 6]], { m: ice, g: 'armL' });
    sc.ell(9.5, 35.5, 2.5, 2.3, { m: ice, g: 'handL', z: 8 });
    sc.tube([[30.5, 29, 2.4, 5], [35.5, 26, 2.1, 6], [37.5, 22.5, 2, 7]], { m: ice, g: 'armR' });
    sc.ell(38, 21.5, 2.5, 2.3, { m: ice, g: 'handR', z: 9 });
    // big head, pointed ears, snow collar
    sym(W, (X, s) => sc.tube([[X(14), 16, 2.3, 4], [X(8), 13, 1.2, 4], [X(5), 10, 0.3, 4]], { m: ice, g: 'ear' + s }));
    sc.ell(23.5, 15.5, 10.5, 9.5, { m: ice, g: 'head', z: 6, rz: 8 });
    sc.ell(23.5, 25.8, 9, 2.4, { m: snow, g: 'collar', z: 12, rz: 3 });
    for (let i = -4; i <= 4; i++) sc.ell(23.5 + i * 2.05, 27.4 - Math.abs(i) * 0.3, 1.3, 1.3, { m: snow, g: 'collar', z: 12, rz: 1.5 });
    const p = sc.render();
    // eyes: big glossy ovals; a toothy mischievous grin; frosty cheeks
    stampM(p, 16, 11, ['.kkk.', 'kdwdk', 'kdddk', 'kdddk', '.kkk.'], { k: INK, d: '#1c3070', w: WHITE });
    stamp(p, 19, 18, ['k........k', '.kkkkkkkk.', '.kwrrrrwk.', '..kkkkkk..'], { k: INK, w: WHITE, r: '#3a4aa8' });
    stamp(p, 13, 16, ['pp'], { p: '#c0ccff' });
    stamp(p, 33, 16, ['pp'], { p: '#c0ccff' });
    return finish(p, (q) => {
      // snowflake over the raised hand + glints on the crown
      stamp(q, 35, 10, [
        '...w...',
        '.w.b.w.',
        '..bbb..',
        'wbbwbbw',
        '..bbb..',
        '.w.b.w.',
        '...w...',
      ], { w: '#ffffff', b: '#8ad0ff' });
      stamp(q, 21, 1, ['.w.', 'w.w', '.w.'], { w: '#ffffff' });
    });
  };

  // Golem: a hulking construct of fitted stone blocks with a tiny head, fists
  // like boulders that nearly drag on the ground, a glowing rune in its chest
  // and moss grown over its shoulders.
  S.golem = () => {
    const W = 64, H = 64;
    const stone = mat('#a89a80', { n: 5, rim: 1, tex: texStone(4) });
    const dark = mat('#6e6458', { n: 4, tex: texStone(8) });
    const moss = mat('#6a9a3a', { n: 4, tex: texFur(0.2, 5) });
    const rune = mat('#40e0f0', { glow: 0.6, ramp: ['#1a6aa0', '#28b0e0', '#60f0ff', '#d0ffff'] });
    const sc = new Scene(W, H);
    const blockF = (pts, g, z, o) => sc.poly(pts, Object.assign({ m: stone, g, z, bevel: 2.5, bz: 3 }, o || {}));
    // legs + feet
    sym(W, (X, s) => {
      blockF([[X(19), 45], [X(29), 45], [X(29), 57], [X(19), 57]], 'leg' + s, 2);
      blockF([[X(15.5), 55.5], [X(30), 55.5], [X(30.5), 63], [X(15), 63]], 'foot' + s, 5);
    });
    // hips
    blockF([[17, 40], [47, 40], [45, 48], [19, 48]], 'hips', 4, { m: dark });
    // torso: a big chest block and a belly block
    blockF([[14, 17], [50, 17], [48, 36], [16, 36]], 'chest', 6);
    blockF([[18.5, 34.5], [45.5, 34.5], [44, 43], [20, 43]], 'belly', 7);
    // head sunk between the shoulders
    blockF([[25.5, 7], [38.5, 7], [38, 18.5], [26, 18.5]], 'head', 8, { bevel: 2 });
    // arms: shoulder boulder, upper arm, forearm, fist
    sym(W, (X, s) => {
      blockF([[X(4), 26], [X(14), 26], [X(14.5), 38], [X(3.5), 38]], 'upper' + s, 3);
      blockF([[X(2.5), 37], [X(15), 37], [X(15.5), 48], [X(2), 48]], 'fore' + s, 5);
      sc.ell(X(8.5), 52, 7.5, 6.5, { m: stone, g: 'fist' + s, z: 6, rz: 6 });
      sc.ell(X(10), 22, 9, 7.5, { m: stone, g: 'shoulder' + s, z: 10, rz: 7 });
    });
    // moss on the shoulders and head
    sc.region((x, y, i) => sc.N[i * 3 + 1] < -0.35 && hash(x >> 1, y >> 1, 2) < 0.75 && (y < 21 || sc.isG(x, y, 'head')), moss);
    // rune circle in the chest
    const rc = G().pix(W, H);
    rc.poly([[32, 18.5], [39, 25.5], [32, 32.5], [25, 25.5]], 1);
    rc.poly([[32, 21], [36.5, 25.5], [32, 30], [27.5, 25.5]], null);
    rc.rect(31, 24.5, 2, 2, 1);
    rc.rect(31.5, 15.5, 1, 2, 1); rc.rect(31.5, 33.5, 1, 2, 1); rc.rect(22.5, 25, 2, 1, 1); rc.rect(39.5, 25, 2, 1, 1);
    sc.shape(rc, { m: rune, g: 'rune', z: 12 });
    // mortar seams and cracks
    sc.carve([[17, 27], [22, 27]], -2).carve([[42, 27], [47, 27]], -2);
    sc.carve([[39, 31], [41, 33], [40, 35]], -2).carve([[19, 19], [21, 22]], -2);
    sc.carve([[32, 36], [32, 42]], -2).carve([[5, 42], [13, 42]], -2).carve([[51, 42], [59, 42]], -2);
    const p = sc.render();
    // a single glowing eye slit
    stamp(p, 28, 11, ['kkkkkkkk', 'kcwwwwck', 'kkkkkkkk'], { k: INK, c: '#40e0f0', w: '#d8ffff' });
    return finish(p);
  };

  // Wyvern: a two-legged dragon rearing with its wings spread wide, horned
  // head lowered at the party, pale belly plates and a tail swept behind.
  S.wyvern = () => {
    const W = 64, H = 64;
    const scale = mat('#4c9a48', { n: 5, rim: 1, tex: texScales(5, 4, 2) });
    const belly = mat('#e8d890', { n: 4 });
    const memb = mat('#d8784a', { n: 4 });
    const horn = mat('#ece2c8', { n: 4, dark: 0.5 });
    const claw = mat('#3a2e3a', { n: 3 });
    const sc = new Scene(W, H);
    // wings
    sym(W, (X, s) => {
      sc.poly([[X(23), 26], [X(12), 10], [X(3), 1], [X(1), 8], [X(0), 19], [X(4), 18], [X(4), 29], [X(9), 26.5], [X(12), 35], [X(16), 30], [X(21), 34]], { m: memb, g: 'memb' + s, z: -8, bevel: 1.5 });
      sc.tube([[X(23), 26, 2.1, -5], [X(13), 11, 1.7, -5], [X(4), 1.5, 1, -5]], { m: scale, g: 'warm' + s });
      sc.tube([[X(11.5), 9.5, 0.7, -6], [X(0.5), 19, 0.4, -6]], { m: scale, g: 'wf1' + s });
      sc.tube([[X(12.5), 11, 0.7, -6], [X(4), 29, 0.4, -6]], { m: scale, g: 'wf2' + s });
      sc.tube([[X(14), 13.5, 0.7, -6], [X(12), 35, 0.4, -6]], { m: scale, g: 'wf3' + s });
      sc.tube([[X(3.5), 2, 0.9, -4], [X(2), -1, 0.3, -4]], { m: claw, g: 'wclaw' + s });
    });
    // tail sweeping out behind to the right
    sc.tube([[38, 50, 4, -6], [50, 55, 3, -6], [57, 58, 2.2, -6], [62, 53, 1, -6]], { m: scale, g: 'tail' });
    sc.poly([[58.5, 54], [63.5, 47], [63.5, 56]], { m: scale, g: 'tail', z: -4, bevel: 1 });
    // legs
    sym(W, (X, s) => {
      sc.ell(X(21), 46, 6.2, 7.5, { m: scale, g: 'thigh' + s, z: 2, rz: 6 });
      sc.tube([[X(20), 51, 3.4, 3], [X(19.5), 58, 2.8, 4]], { m: scale, g: 'shin' + s });
      for (const [tx, ty] of [[14.5, 63], [18.5, 63.5], [22.5, 63]]) sc.tube([[X(19.5), 58.5, 1.6, 6], [X(tx), ty, 0.5, 7]], { m: claw, g: 'toe' + s });
    });
    // body, belly plates
    sc.ell(31.5, 41, 11, 12, { m: scale, g: 'body', z: 0, rz: 10 });
    sc.ell(31.5, 43, 7, 9.5, { m: belly, g: 'belly', z: 5, rz: 8 });
    for (const y of [36, 39, 42, 45, 48, 51]) sc.carve([[26, y], [37, y]], -1);
    // neck
    sc.tube([[31.5, 34, 5, 2], [31.5, 24, 4.2, 4], [31.5, 18, 4, 6]], { m: scale, g: 'neck' });
    sc.tube([[31.5, 33, 3, 6], [31.5, 21, 2.6, 8]], { m: belly, g: 'throat' });
    for (const y of [24, 27, 30]) sc.carve([[29.5, y], [33.5, y]], -1);
    // arms (small, clawed)
    sym(W, (X, s) => {
      sc.tube([[X(23), 36, 2, 7], [X(20), 40, 1.7, 8], [X(22.5), 42.5, 1.5, 9]], { m: scale, g: 'arm' + s });
      sc.tube([[X(22.5), 42.5, 0.8, 10], [X(24.5), 44.5, 0.3, 10]], { m: claw, g: 'aclaw' + s });
    });
    // head: horns, skull, brow, snout, open jaw
    sym(W, (X, s) => {
      sc.tube([[X(26.5), 9, 1.8, 6], [X(21.5), 4, 1.3, 5], [X(19), 0, 0.4, 4]], { m: horn, g: 'horn' + s });
      sc.tube([[X(25), 13, 1.4, 7], [X(20), 12, 0.8, 7], [X(17.5), 10, 0.3, 7]], { m: scale, g: 'frill' + s });
    });
    sc.ell(31.5, 12, 7, 6, { m: scale, g: 'head', z: 8, rz: 6 });
    sym(W, (X) => sc.ell(X(28), 9.5, 3, 2, { m: scale, g: 'head', z: 13, rz: 2 }));
    sc.ell(31.5, 17.5, 5, 3.6, { m: scale, g: 'snout', z: 14, rz: 4 });
    sc.ell(31.5, 21.5, 4.2, 2.2, { m: belly, g: 'jaw', z: 13, rz: 2 });
    const p = sc.render();
    stampM(p, 26, 9, ['kkk.', 'kyyk', '.kk.'], { k: INK, y: '#ffe040' });
    stampM(p, 29, 16, ['k'], { k: INK });
    stamp(p, 27, 19, ['kkkkkkkkkk', 'kwkrrrrkwk', '.kkkkkkkk.'], { k: INK, r: '#9a2838', w: WHITE });
    return finish(p);
  };

  // Chimera: a crouching lion with a goat's head growing from its shoulder, a
  // serpent for a tail and eagle wings, all three heads snarling at once.
  S.chimera = () => {
    const W = 64, H = 64;
    const fur = mat('#d8a048', { n: 5, rim: 1 });
    const mane = mat('#a8502a', { n: 5, tex: texFur(0.18, 2) });
    const goat = mat('#c4b49a', { n: 5, dark: 0.6 });
    const horn = mat('#57505e', { n: 4, spec: 0.94, light: 0.8 });
    const snake = mat('#5a9a48', { n: 5, tex: texScales(3, 2) });
    const wing = mat('#7a5a3a', { n: 5 });
    const wtip = mat('#e8dcc0', { n: 4 });
    const claw = mat('#3a2e30', { n: 3 });
    const sc = new Scene(W, H);
    // eagle wings behind
    sym(W, (X, s) => {
      const F = [[3, 3, 1, 14], [5, 5, 0, 22], [8, 8, 2, 29], [12, 11, 7, 33]];
      F.forEach(([rx, ry, tx, ty], k) => {
        sc.tube([[X(rx + 1), ry + 1, 2.3, -10 + k], [X((rx + tx) / 2), (ry + ty) / 2, 2.1, -10 + k], [X(tx), ty - 3, 1.2, -10 + k]], { m: wing, g: 'wf' + k + s });
        sc.tube([[X(tx), ty - 4, 1.4, -10 + k], [X(tx), ty, 0.5, -10 + k]], { m: wtip, g: 'wf' + k + s });
      });
      sc.tube([[X(20), 26, 3, -6], [X(10), 9, 2.6, -6], [X(2), 1, 1.6, -6]], { m: wing, g: 'warm' + s });
    });
    // serpent tail rising on the left
    sc.tube([[18, 50, 2.9, -4], [8, 47, 2.7, -4], [3.5, 38, 2.5, -2], [5.5, 30, 2.3, 0]], { m: snake, g: 'snake' });
    sc.ell(7.5, 26.5, 3.9, 3.3, { m: snake, g: 'shead', z: 3, rz: 3 });
    sc.ell(10, 28, 2.5, 1.8, { m: snake, g: 'shead', z: 4, rz: 2 });
    // haunches, chest and front legs
    sym(W, (X, s) => sc.ell(X(15), 51, 7, 7.5, { m: fur, g: 'haunch' + s, z: -2, rz: 7 }));
    sc.ell(31.5, 44, 12, 10, { m: fur, g: 'body', z: 0, rz: 10 });
    sc.ell(31.5, 39, 7, 5, { m: mane, g: 'ruff', z: 4, rz: 5 });
    for (const dx of [-4, 0, 4]) sc.tube([[31.5 + dx, 41, 2.4, 5], [31.5 + dx * 1.2, 46.5 - Math.abs(dx) * 0.4, 0.5, 5]], { m: mane, g: 'ruff' });
    sym(W, (X, s) => {
      sc.tube([[X(24.5), 43, 5.2, 5], [X(23.5), 49, 4.2, 6], [X(24), 54, 3.5, 7], [X(24), 58.5, 3.7, 7]], { m: fur, g: 'leg' + s });
      sc.ell(X(24), 60.5, 4.8, 3, { m: fur, g: 'paw' + s, z: 9, rz: 3 });
      for (const tx of [21, 24, 27]) sc.tube([[X(tx), 61.5, 0.8, 12], [X(tx), 63.5, 0.3, 12]], { m: claw, g: 'claw' + s });
      sc.ell(X(15), 60.5, 4, 2.6, { m: fur, g: 'hpaw' + s, z: 1, rz: 3 });
    });
    // goat head on the right shoulder: long face, ridged back-swept horns, beard
    sc.tube([[42, 36, 3.8, 2], [46.5, 28, 3.2, 3], [49, 22, 2.8, 4]], { m: goat, g: 'gneck' });
    sc.tube([[47.5, 13, 1.9, 4], [45.5, 7.5, 1.7, 4], [47.5, 2.5, 1.2, 4], [52, 1.5, 0.5, 4]], { m: horn, g: 'ghornL' });
    sc.tube([[51.5, 13, 1.9, 4], [55, 8.5, 1.7, 4], [58.5, 6.5, 1.2, 4], [61, 9.5, 0.5, 4]], { m: horn, g: 'ghornR' });
    sc.tube([[46.5, 16, 1.2, 5], [42.5, 17.5, 0.5, 5]], { m: goat, g: 'gearL' });
    sc.tube([[52.5, 16, 1.2, 5], [56.5, 17.5, 0.5, 5]], { m: goat, g: 'gearR' });
    sc.ell(49.5, 16, 4.4, 4.6, { m: goat, g: 'ghead', z: 6, rz: 4 });
    sc.ell(49.5, 21.5, 3, 3.8, { m: goat, g: 'ghead', z: 8, rz: 3 });
    sc.region((x, y) => sc.isG(x, y, 'ghead') && y > 21, mat('#e4dccc', { n: 4, bias: 0.05 }));
    sc.tube([[49.5, 24.5, 1.5, 8], [50, 29, 0.5, 8]], { m: goat, g: 'beard' });
    for (const y of [5, 8]) sc.carve([[45, y], [47.5, y + 1]], -1);
    sc.carve([[55, 8], [55.5, 10.5]], -1).carve([[58, 6.5], [58, 9]], -1);
    // mane (a spiky ring) + lion face
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2, r = 12.5 + (i % 2) * 1.5;
      sc.tube([[31.5 + Math.cos(a) * 6, 27 + Math.sin(a) * 6, 3.4, 6], [31.5 + Math.cos(a) * r, 27 + Math.sin(a) * r * 0.95, 0.8, 5]], { m: mane, g: 'mane' });
    }
    sc.ell(31.5, 27, 11, 10.5, { m: mane, g: 'mane', z: 5, rz: 6 });
    sc.ell(31.5, 26, 7.4, 7, { m: fur, g: 'face', z: 12, rz: 6 });
    sc.ell(31.5, 30.5, 5, 3.4, { m: fur, g: 'muzzle', z: 16, rz: 3 });
    sym(W, (X) => sc.ell(X(26.5), 19.5, 2, 2, { m: fur, g: 'lear' + X(0), z: 10, rz: 2 }));
    const p = sc.render();
    // lion: brows, eyes, nose, roaring mouth
    stampM(p, 26, 23, ['kk..', '.kyk', '..k.'], { k: INK, y: '#ffe040' });
    stamp(p, 30, 27, ['kkkk', '.kk.'], { k: INK });
    stamp(p, 28, 30, ['k......k', 'kwkkkkwk', 'kkrrrrkk', '.kwkkwk.', '..kkkk..'], { k: INK, r: '#a02838', w: WHITE });
    // goat: slit eyes, nostrils
    stamp(p, 46, 15, ['kyk.kyk'], { k: INK, y: '#f0c030' });
    stamp(p, 45, 14, ['kk...kk'], { k: INK });
    stamp(p, 48, 23, ['k.k'], { k: INK });
    stamp(p, 48, 25, ['.k.'], { k: INK });
    // snake: eye, fangs and a forked tongue
    stamp(p, 6, 25, ['kyk'], { k: INK, y: '#f8e040' });
    stamp(p, 11, 29, ['w.w', '.r.', '.r.', 'r.r'], { w: WHITE, r: '#e03040' });
    return finish(p);
  };

  // Yeti: a shaggy snow ape with both fists raised over its head, roaring
  // through a mouthful of fangs; small curled horns poke through the fur.
  S.yeti = () => {
    const W = 64, H = 64;
    const fur = mat('#dce6f4', { n: 5, dark: 0.55, light: 0.85, rim: 1, tex: texFur(0.13, 4), ramp: ['#5a5a9a', '#8a94c8', '#b8c6e8', '#e2eaf8', '#ffffff'] });
    const skin = mat('#7a8ac0', { n: 5 });
    const horn = mat('#ece0c4', { n: 4, dark: 0.5 });
    const mouthM = mat('#6a1a38', { n: 3, flat: true });
    const sc = new Scene(W, H);
    // legs and big feet
    sym(W, (X, s) => {
      sc.ell(X(21), 50, 7, 7.5, { m: fur, g: 'leg' + s, z: 2, rz: 7 });
      sc.ell(X(19.5), 60.5, 6.5, 3, { m: skin, g: 'foot' + s, z: 6, rz: 3 });
      for (const tx of [15, 18.5, 22]) sc.ell(X(tx), 62, 1.6, 1.3, { m: skin, g: 'toe' + s, z: 8, rz: 1.5 });
    });
    // body with fur tufts along the flanks
    sc.ell(31.5, 38, 15, 14, { m: fur, g: 'body', z: 0, rz: 12 });
    sym(W, (X) => {
      for (const [x0, y0, x1, y1] of [[17.5, 32, 14, 36], [17, 39, 13.5, 43.5], [18.5, 46, 15.5, 50.5]]) sc.tube([[X(x0), y0, 2.6, 2], [X(x1), y1, 0.5, 2]], { m: fur, g: 'body' });
    });
    sc.ell(31.5, 38, 8, 8.5, { m: skin, g: 'chest', z: 9, rz: 5 });
    // arms raised, fists over the head
    sym(W, (X, s) => {
      sc.ell(X(16.5), 27, 6.5, 6, { m: fur, g: 'sh' + s, z: 4, rz: 6 });
      sc.tube([[X(15), 26, 5, 4], [X(8), 17, 4.4, 4]], { m: fur, g: 'upper' + s });
      sc.tube([[X(8), 17, 4.4, 5], [X(8.5), 8, 4, 6]], { m: fur, g: 'fore' + s });
      for (const [x0, y0, x1, y1] of [[5, 19, 1, 21], [4.5, 13, 1, 13.5], [11, 21, 10, 24.5]]) sc.tube([[X(x0), y0, 2, 5], [X(x1), y1, 0.4, 5]], { m: fur, g: 'fore' + s });
      sc.ell(X(9), 5, 5, 4.5, { m: skin, g: 'fist' + s, z: 8, rz: 4 });
      for (const dx of [-2.5, 0, 2.5]) sc.carve([[X(9 + dx), 1.5], [X(9 + dx), 4]], -2);
      sc.carve([[X(5.5), 6.5], [X(11), 7]], -1);
    });
    // head: fur crown, horns, face
    sym(W, (X, s) => sc.tube([[X(24), 13, 1.8, 6], [X(20), 11, 1.5, 6], [X(19), 7, 1, 6], [X(21.5), 5.5, 0.4, 6]], { m: horn, g: 'horn' + s }));
    sc.ell(31.5, 18, 9.5, 8.5, { m: fur, g: 'head', z: 6, rz: 8 });
    for (const [x0, x1] of [[28, 26.5], [31.5, 31.5], [35, 36.5]]) sc.tube([[x0, 11, 2.2, 8], [x1, 7.5, 0.5, 8]], { m: fur, g: 'head' });
    sc.ell(31.5, 21, 6.6, 6, { m: skin, g: 'face', z: 12, rz: 5 });
    sc.ell(31.5, 24.5, 4.6, 3.2, { m: mouthM, g: 'mouth', z: 16, rz: 1 });
    const p = sc.render();
    // angry brow + eyes, nostrils, fangs
    stampM(p, 26, 16, ['kkk..', '.kkyk', '..kk.'], { k: INK, y: '#ffe040' });
    stamp(p, 30, 20, ['k..k'], { k: INK });
    stamp(p, 27, 22, ['kkkkkkkkk', 'kwkwkwkwk', 'k.w...w.k', '.........', '..w...w..', '.kkkkkkk.'], { k: INK, w: WHITE });
    return finish(p);
  };

  // Kraken: a giant cephalopod heaving out of the sea, tentacles thrashing on
  // both sides, huge slit-pupilled eyes glaring from under heavy lids.
  S.kraken = () => {
    const W = 64, H = 64;
    const body = mat('#c04a70', { n: 5, rim: 1 });
    const water = mat('#b8cce0', { n: 4, dark: 0.45, light: 0.8 });
    const foam = mat('#eef4fa', { n: 3, dark: 0.3, light: 0.9, flat: true });
    const spotM = mat('#e07898', { n: 5 });
    const sc = new Scene(W, H);
    // churning foam where the tentacles meet the sea (pale, so palette variants stay believable)
    for (const [x, y, rx, ry] of [[5, 59.5, 4.5, 2.8], [13, 60.5, 5, 2.8], [22, 59.5, 5, 2.6], [31.5, 61, 5.5, 2.6], [41, 59.5, 5, 2.6], [50, 60.5, 5, 2.8], [58.5, 59.5, 4.5, 2.8]])
      sc.ell(x, y, rx, ry, { m: water, g: 'sea', z: 12, rz: 2.5 });
    sc.cut((x, y) => y > 63);
    const T = [
      [[22, 40, 4.2, 2], [11, 36, 3.6, 2], [4, 25, 2.8, 2], [6, 15, 2, 2], [11, 13, 1.3, 2], [11.5, 17.5, 0.6, 2]],
      [[41, 40, 4.2, 2], [52, 36, 3.6, 2], [59, 25, 2.8, 2], [57, 15, 2, 2], [52, 13, 1.3, 2], [51.5, 17.5, 0.6, 2]],
      [[20, 46, 4, 4], [10, 48, 3.4, 5], [3, 44, 2.4, 6], [1, 38, 1.4, 6], [3.5, 35.5, 0.6, 6]],
      [[43, 46, 4, 4], [53, 48, 3.4, 5], [60, 44, 2.4, 6], [62, 38, 1.4, 6], [59.5, 35.5, 0.6, 6]],
      [[26, 47, 3.8, 8], [21, 54, 3.2, 10], [15, 56, 2.4, 13]],
      [[37, 47, 3.8, 8], [42, 54, 3.2, 10], [48, 56, 2.4, 13]],
    ];
    T.forEach((t, k) => sc.tube(t, { m: body, g: 't' + k }));
    sym(W, (X, s) => sc.poly([[X(21), 10], [X(14), 4], [X(15), 13], [X(20), 19]], { m: body, g: 'fin' + s, z: -2, bevel: 1.5 }));
    sc.ell(31.5, 16, 10, 14, { m: body, g: 'mantle', z: 0, rz: 10 });
    sc.ell(31.5, 36, 12, 9, { m: body, g: 'mantle', z: 1, rz: 10 });
    sym(W, (X) => sc.ell(X(25), 29.5, 5.6, 3.6, { m: body, g: 'mantle', z: 7, rz: 3 }));
    sc.region((x, y) => sc.isG(x, y, 'sea') && y < 60 + Math.sin(x * 0.9) * 1.2, foam);
    const spots = [[27, 9, 1.6], [35, 6.5, 1.2], [38, 15, 1.8], [25, 18, 1.4], [32, 21, 1.1], [21.5, 11, 1], [41, 23, 1.2]];
    sc.region((x, y) => sc.isG(x, y, 'mantle') && spots.some(([sx, sy, r]) => Math.hypot(x - sx, y - sy) < r + 0.2), spotM);
    sc.carve([[27, 8], [26, 16]], 1).carve([[31, 4], [36, 6]], 1);
    const p = sc.render();
    // suckers on the inner curls and along the undersides
    const sucker = (x, y) => stamp(p, x, y, ['.uu.', 'uddu', '.uu.'], { u: '#f4b4c4', d: '#b85878' });
    for (const [x, y] of [[8, 29], [6, 23], [8, 17], [12, 15.5], [52, 29], [54, 23], [52, 17], [48, 15.5], [12, 45], [4, 41], [48, 45], [56, 41]]) sucker(x, y);
    // eyes: heavy lids, yellow irises with a horizontal slit
    stamp(p, 20, 27, ['kk.......', 'kykkk....', 'kwyyykkk.', 'kyykkkyyk', 'kyyyyyyyk', '.kyyyyyk.', '..kkkkk..'], { k: INK, y: '#f4d848', w: WHITE });
    stamp(p, 34, 27, ['.......kk', '....kkkyk', '.kkkyyywk', 'kyykkkyyk', 'kyyyyyyyk', '.kyyyyyk.', '..kkkkk..'], { k: INK, y: '#f4d848', w: WHITE });
    // beak between the tentacle roots
    stamp(p, 29, 40, ['kkkkkk', 'kwwwwk', '.kwwk.', '..kk..'], { k: INK, w: '#e8e0c8' });
    return finish(p, (q) => {
      // spray thrown up by the thrashing tentacles
      for (const [x, y] of [[2, 50], [6, 48], [60, 49], [56, 47.5], [18, 51], [45, 51]]) stamp(q, x, y, ['.w', 'wb'], { w: '#ffffff', b: '#b8d4ec' });
    });
  };

  // Demon: a horned archfiend with bat wings unfurled, goat legs and a spade
  // tail; one clawed hand holds a trident, the other cradles black fire.
  S.demon = () => {
    const W = 64, H = 64;
    const skin = mat('#c83c3c', { n: 5, rim: 1 });
    const memb = mat('#5a3874', { n: 4 });
    const horn = mat('#e8dcc0', { n: 4, dark: 0.55 });
    const fur = mat('#3a2a3e', { n: 4, tex: texFur(0.16, 6) });
    const gold = mat('#e0b040', { n: 4, spec: 0.92 });
    const iron = mat('#6a6e80', { n: 4, spec: 0.93 });
    const hoof = mat('#2a2230', { n: 3 });
    const fire = ['#2a0c48', '#5a1e96', '#9a48e8', '#d8a4ff', '#fff0ff'];
    const sc = new Scene(W, H);
    // wings
    sym(W, (X, s) => {
      sc.poly([[X(24), 20], [X(12), 7], [X(2), 0.5], [X(1), 9], [X(0), 18], [X(4.5), 17], [X(4), 27], [X(9), 24], [X(10.5), 32], [X(15), 27], [X(20), 30]], { m: memb, g: 'memb' + s, z: -8, bevel: 1 });
      sc.tube([[X(23), 21, 2.2, -5], [X(12), 7, 1.8, -5], [X(2.5), 0.5, 0.8, -5]], { m: skin, g: 'wbone' + s });
      sc.tube([[X(11), 6.5, 0.8, -6], [X(0.5), 18, 0.4, -6]], { m: skin, g: 'wf1' + s });
      sc.tube([[X(12), 8, 0.8, -6], [X(4.5), 27, 0.4, -6]], { m: skin, g: 'wf2' + s });
      sc.tube([[X(13.5), 10, 0.8, -6], [X(10.5), 32, 0.4, -6]], { m: skin, g: 'wf3' + s });
    });
    // tail with spade
    sc.tube([[36, 46, 1.8, -4], [47, 52, 1.5, -4], [53, 56, 1.3, -4], [57, 52, 1, -4]], { m: skin, g: 'tail' });
    sc.poly([[57, 53.5], [55, 49], [57.5, 45.5], [60.5, 49], [58.5, 53.5]], { m: skin, g: 'tail', z: -3, bevel: 1 });
    // goat legs: furry thighs, backward knee, hooves
    sym(W, (X, s) => {
      sc.ell(X(24.5), 45.5, 5.2, 6, { m: fur, g: 'thigh' + s, z: 2, rz: 5 });
      sc.tube([[X(23.5), 49, 3.4, 3], [X(20.5), 54.5, 2.6, 4], [X(21.5), 59.5, 2, 5]], { m: fur, g: 'shin' + s });
      sc.ell(X(21.5), 61.5, 3, 2, { m: hoof, g: 'hoof' + s, z: 7, rz: 2 });
    });
    // loincloth/belt
    sc.cap(22.5, 40, 40.5, 40, 2, 2, { m: gold, g: 'belt', z: 12 });
    sc.poly([[27, 41], [36, 41], [34.5, 50], [31.5, 52], [28.5, 50]], { m: fur, g: 'loin', z: 11, bevel: 1.5 });
    // torso
    sc.ell(31.5, 34, 8.5, 7, { m: skin, g: 'body', z: 4, rz: 8 });
    sc.ell(31.5, 26, 11, 7, { m: skin, g: 'body', z: 3, rz: 8 });
    sym(W, (X) => sc.ell(X(27.5), 25.5, 4.6, 3.8, { m: skin, g: 'body', z: 6, rz: 5 }));
    sc.carve([[31.5, 23], [31.5, 38]], -1).carve([[28, 32], [35, 32]], -1).carve([[28.5, 35.5], [34.5, 35.5]], -1);
    // left arm: trident
    sc.cap(10, 63, 10, 8, 1, 1, { m: iron, g: 'trident', z: 10 });
    sc.tube([[10, 8, 1.2, 10], [10, 0.5, 0.4, 10]], { m: iron, g: 'trident' });
    sc.tube([[6, 10, 1, 10], [5.5, 5, 0.9, 10], [6.5, 1.5, 0.4, 10]], { m: iron, g: 'trident' });
    sc.tube([[14, 10, 1, 10], [14.5, 5, 0.9, 10], [13.5, 1.5, 0.4, 10]], { m: iron, g: 'trident' });
    sc.cap(5.5, 10.5, 14.5, 10.5, 1.2, 1.2, { m: iron, g: 'trident', z: 10 });
    sc.ell(20.5, 23.5, 4.5, 4, { m: skin, g: 'armL', z: 6 });
    sc.tube([[20, 24, 3.4, 6], [15, 31, 2.9, 7]], { m: skin, g: 'armL' });
    sc.tube([[15, 31, 2.9, 8], [11.5, 26, 2.6, 11]], { m: skin, g: 'foreL' });
    sc.ell(10.5, 25, 3, 2.8, { m: skin, g: 'handL', z: 13 });
    sc.region((x, y) => sc.isG(x, y, 'foreL') && Math.hypot(x - 13, y - 28) < 2.5, gold);
    // right arm: black fire in the palm
    sc.ell(42.5, 23.5, 4.5, 4, { m: skin, g: 'armR', z: 6 });
    sc.tube([[43, 24, 3.4, 6], [48.5, 31, 2.9, 7]], { m: skin, g: 'armR' });
    sc.tube([[48.5, 31, 2.9, 8], [51, 36, 2.6, 9]], { m: skin, g: 'foreR' });
    sc.ell(51.5, 37, 3, 2.6, { m: skin, g: 'handR', z: 12 });

    // head: horns, ears, jaw
    sym(W, (X, s) => {
      sc.tube([[X(27), 10, 2.2, 6], [X(21), 7, 1.9, 6], [X(17.5), 2.5, 1.3, 6], [X(19.5), -0.5, 0.4, 6]], { m: horn, g: 'horn' + s });
      sc.tube([[X(25.5), 14, 1.4, 6], [X(20.5), 11.5, 0.9, 6], [X(18.5), 10, 0.3, 6]], { m: skin, g: 'ear' + s });
    });
    sc.ell(31.5, 13, 6, 6.2, { m: skin, g: 'head', z: 8, rz: 6 });
    sc.ell(31.5, 17.5, 4.6, 3.2, { m: skin, g: 'head', z: 10, rz: 4 });
    sc.ell(31.5, 10.5, 5.4, 1.8, { m: skin, g: 'head', z: 13, rz: 1.5 });
    sc.tube([[31.5, 20, 1.6, 12], [31.5, 23.5, 0.5, 12]], { m: fur, g: 'goatee' });
    const p = sc.render();
    paintFlame(p, 51.5, 35, 16, 3.6, 1.5, fire);
    stampM(p, 26, 11, ['kk...', '.kyyk', '..kk.'], { k: INK, y: '#ffe040' });
    stamp(p, 27, 16, ['k........k', 'kkkkkkkkkk', '.kwk..kwk.', '..k....k..'], { k: INK, w: WHITE });
    stamp(p, 31, 40, ['k.k', '.k.'], { k: INK });
    return finish(p);
  };

  // Sandworm: a colossal ringed worm bursting out of a dune, its round maw
  // split open into three toothed jaws with rings of fangs down the throat.
  S.sandworm = () => {
    const W = 64, H = 64;
    const flesh = mat('#c88a6a', { n: 5, rim: 1 });
    const plate = mat('#9a6450', { n: 5 });
    const jaw = mat('#d8705e', { n: 5 });
    const gum = mat('#e89484', { n: 4 });
    const throat = mat('#4a1422', { n: 3, flat: true, ramp: ['#1a0610', '#3a0e1c', '#6a1a30'] });
    const sand = mat('#c8b490', { n: 5, tex: texStone(13) });
    const rock = mat('#8a8278', { n: 4 });
    const sc = new Scene(W, H);
    const MX = 33, MY = 21;
    // dune
    sc.ell(31.5, 61.5, 30, 6, { m: sand, g: 'dune', z: 30, rz: 4 });
    sc.ell(7, 58.5, 4, 3, { m: rock, g: 'rock1', z: 33, rz: 3 });
    sc.ell(56, 59.5, 3, 2.2, { m: rock, g: 'rock2', z: 33, rz: 2 });
    sc.cut((x, y) => y > 63);
    // body: ring segments along an arch, each nearer the viewer than the last
    const path = [[31, 67, 10], [20, 56, 10], [17, 44, 9.8], [21, 34, 9.4], [28, 27, 8.8]];
    const pts = [];
    for (let s = 0; s < path.length - 1; s++) {
      const p0 = path[Math.max(0, s - 1)], p1 = path[s], p2 = path[s + 1], p3 = path[Math.min(path.length - 1, s + 2)];
      for (let i = 0; i < 40; i++) pts.push(catmull(p0, p1, p2, p3, i / 40));
    }
    let acc = 0, k = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc < 5.4) continue;
      acc = 0;
      const [x, y, r] = pts[i];
      sc.ell(x, y, r, r * 0.92, { m: flesh, g: 'seg' + k, z: k * 1.6, rz: r, soft: true });
      // armour spike on the outer (left) side of every other ring
      if (k % 2 === 0 && y < 58) sc.tube([[x - r * 0.75, y - 1, 2.2, k * 1.6 + 2], [x - r - 2.5, y - 3, 0.5, k * 1.6 + 2]], { m: plate, g: 'spike' + k });
      k++;
    }
    // three jaws split open around the maw (we see their toothed inner faces)
    const JA = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    const J = (a, r, da) => [MX + Math.cos(a + da) * r, MY + Math.sin(a + da) * r * 0.95];
    JA.forEach((a, i) => sc.poly([J(a, 8, -0.66), J(a, 14, -0.38), J(a, 18.5, -0.12), J(a, 20.5, 0), J(a, 18.5, 0.12), J(a, 14, 0.38), J(a, 8, 0.66)], { m: jaw, g: 'jaw' + i, z: 30, bevel: 2.5, bz: 2 }));
    // lip ring, gums and throat
    sc.ell(MX, MY, 10, 9.5, { m: flesh, g: 'lip', z: 34, rz: 4 });
    sc.ell(MX, MY, 7.6, 7.2, { m: gum, g: 'gum', z: 37, rz: 2 });
    sc.ell(MX, MY, 5.4, 5.1, { m: throat, g: 'throat', z: 39, rz: 1 });
    const p = sc.render({ depth: 0.05 });
    // teeth along both edges of each jaw, pointing inward
    JA.forEach((a) => {
      for (const [r, e] of [[10.5, 0.5], [13.5, 0.33], [16.5, 0.18]]) {
        for (const sd of [-1, 1]) {
          const [x0, y0] = J(a, r, sd * e), [x1, y1] = J(a, r, sd * (e - 0.14));
          p.set(Math.round(x0), Math.round(y0), '#f8f4e8');
          p.set(Math.round(x1), Math.round(y1), '#d8ccb0');
        }
      }
    });
    // two rings of fangs down the throat
    for (const [R0, n, off, col] of [[6.6, 14, 0, '#f8f4e8'], [3.8, 9, 0.35, '#c8bca0']]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + off, c = Math.cos(a), s = Math.sin(a);
        p.set(Math.round(MX + c * R0), Math.round(MY + s * R0 * 0.95), col);
        p.set(Math.round(MX + c * (R0 - 1.1)), Math.round(MY + s * (R0 - 1.1) * 0.95), col);
      }
    }
    stamp(p, MX - 1, MY - 1, ['kk', 'kk'], { k: '#0a0208' });
    return finish(p, (q) => stamp(q, MX + 2, MY + 10, ['d', 'd', '.', 'd'], { d: '#e8f0c0' }));
  };

  // Minotaur: a bull-headed giant with sweeping horns and a brass nose ring,
  // gripping a huge double-bladed axe; hooves planted wide.
  S.minotaur = () => {
    const W = 64, H = 64;
    const fur = mat('#8a5434', { n: 5, rim: 1 });
    const hide = mat('#6a3a28', { n: 4, tex: texFur(0.16, 8) });
    const muzzle = mat('#d0a888', { n: 4 });
    const horn = mat('#ece0c4', { n: 5, dark: 0.55 });
    const steel = mat('#a8b4c8', { n: 5, spec: 0.88, light: 0.85 });
    const wood = mat('#7a5a3a', { n: 4 });
    const gold = mat('#e0b040', { n: 4, spec: 0.92 });
    const cloth = mat('#4a5ab0', { n: 4 });
    const hoof = mat('#2a2230', { n: 3 });
    const sc = new Scene(W, H);
    // axe: haft and a crescent double blade
    const HX = 51.5;
    sc.cap(HX, 63, HX, 3, 1.3, 1.3, { m: wood, g: 'haft', z: 8 });
    for (const s of [1, -1]) {
      const X = (d) => HX + d * s;
      sc.poly([[X(1), 7], [X(4), 5], [X(7.5), 2], [X(10.5), 1.5], [X(10), 7], [X(10.5), 13], [X(10), 19], [X(10.5), 24], [X(7.5), 23.5], [X(4), 20], [X(1), 18]], { m: steel, g: 'blade' + s, z: 7, bevel: 2, bz: 1.5 });
    }
    sc.ell(HX, 12.5, 2.3, 4, { m: gold, g: 'axecap', z: 10, rz: 2 });
    // legs: furry thighs, shins, hooves
    sym(W, (X, s) => {
      sc.tube([[X(25), 44, 5.2, 2], [X(22.5), 51, 4.4, 3], [X(21.5), 57, 3.4, 4]], { m: hide, g: 'leg' + s });
      sc.ell(X(21.5), 60.5, 3.6, 3, { m: hoof, g: 'hoof' + s, z: 7, rz: 3 });
    });
    // loincloth + belt
    sc.poly([[24, 42], [39, 42], [37.5, 53], [31.5, 55], [25.5, 53]], { m: cloth, g: 'cloth', z: 12, bevel: 2 });
    sc.cap(20, 40.5, 43, 40.5, 2.3, 2.3, { m: hide, g: 'belt', z: 13 });
    // torso
    sc.ell(31.5, 34, 11, 8, { m: fur, g: 'body', z: 3, rz: 10 });
    sc.ell(31.5, 25, 15, 8.5, { m: fur, g: 'body', z: 2, rz: 9 });
    sym(W, (X) => sc.ell(X(25.5), 25, 6.5, 4.8, { m: fur, g: 'body', z: 6, rz: 6 }));
    sc.ell(31.5, 18, 10, 4.5, { m: fur, g: 'body', z: 3, rz: 5 });
    sc.carve([[31.5, 24], [31.5, 39]], -1).carve([[27, 33], [36, 33]], -1).carve([[27.5, 36.5], [35.5, 36.5]], -1);
    sc.carve([[20, 29.5], [25, 30.5], [30, 29.5]], -1).carve([[33, 29.5], [38, 30.5], [43, 29.5]], -1);
    // left arm: fist down
    sc.ell(16, 22.5, 6, 5.5, { m: fur, g: 'armL', z: 6 });
    sc.tube([[15.5, 24, 4.6, 6], [11, 33, 3.8, 6]], { m: fur, g: 'armL' });
    sc.tube([[11, 33, 3.8, 7], [11.5, 41, 3.6, 8]], { m: fur, g: 'foreL' });
    sc.ell(11.5, 43.5, 4, 3.6, { m: fur, g: 'fistL', z: 10 });
    sc.region((x, y) => sc.isG(x, y, 'foreL') && y > 36 && y < 40, gold);
    // right arm: gripping the haft
    sc.ell(47, 22.5, 6, 5.5, { m: fur, g: 'armR', z: 6 });
    sc.tube([[47.5, 24, 4.6, 6], [50, 32, 3.8, 7]], { m: fur, g: 'armR' });
    sc.tube([[50, 32, 3.8, 8], [51.5, 38, 3.4, 9]], { m: fur, g: 'foreR' });
    sc.ell(51.5, 38.5, 3.6, 3.4, { m: fur, g: 'fistR', z: 12 });
    // horns, ears, head
    sym(W, (X, s) => {
      sc.tube([[X(25), 9, 2.5, 6], [X(16), 7, 2, 6], [X(9.5), 4, 1.5, 6], [X(8), -0.5, 0.5, 6]], { m: horn, g: 'horn' + s, steps: 8 });
      sc.tube([[X(24.5), 13, 1.9, 7], [X(19.5), 14.5, 1.2, 7], [X(17.5), 14, 0.4, 7]], { m: fur, g: 'ear' + s });
    });
    sc.ell(31.5, 12, 7, 7, { m: fur, g: 'head', z: 8, rz: 7 });
    sc.ell(31.5, 18.5, 5.4, 4, { m: muzzle, g: 'muzzle', z: 14, rz: 4 });
    sc.tube([[31.5, 5, 2.4, 13], [31.5, 9, 1.4, 13]], { m: hide, g: 'forelock' });
    sc.tube([[29.2, 20.5, 0.8, 18], [31.5, 23.2, 0.8, 18], [33.8, 20.5, 0.8, 18]], { m: gold, g: 'ring', k: 0 });
    const p = sc.render();
    stampM(p, 25, 10, ['kkk..', '.krrk', '..kk.'], { k: INK, r: '#ff3828' });
    stamp(p, 28, 17, ['.kk.kk.', '.kk.kk.'], { k: INK });
    return finish(p);
  };

  // ------------------------------------------------------------ registry
  const SIZES = {
    crab: 48, merman: 48, harpy: 48, darkmage: 48, armor: 48, gargoyle: 48, salamander: 48, cactus: 48, frostling: 48,
    orc: 64, golem: 64, wyvern: 64, chimera: 64, yeti: 64, kraken: 64, demon: 64, sandworm: 64, minotaur: 64,
  };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.monstersB = { ids: Object.keys(SIZES), sizes: SIZES };
})(window.RPG);
