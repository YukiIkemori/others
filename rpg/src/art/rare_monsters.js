// Rare-monster battle sprites: 'mon:rare_*', one elusive treasure beast per region.
// Each one is an original design (not a palette variant) that has to read as
// "special" at a glance: gold, gems or iridescence, faceted jewels with a white
// glint, and a few loose sparkle pixels around the silhouette.
//
// Pipeline (same look as the regular roster): parts are modelled as a small
// 2.5-D scene (ellipsoids, tapered capsules, spline tubes, bevelled polygons)
// in a z-buffer with surface normals, lit from the top-left and quantised into
// hue-shifted ramps; where two parts meet, the one behind gets a dark contour.
// Jewels, faces and sparkles are placed by hand afterwards and a bold 1-px
// outline closes the silhouette (lowest body pixel on the second-to-last row,
// outline on the last). Deterministic; built lazily once through R.Gfx.get.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#100a14'; // outer outline
  const INK = '#1c1224'; // pupils, mouths, inner lines
  const WHITE = '#fcfcf4';

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
  /** hue-shifted ramp dark → light around a mid-tone base (shadows → violet, lights → warm) */
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

  // shared jewel / metal ramps (dark → light)
  const GOLD = ['#3e1e12', '#6e3a14', '#a8641a', '#d8961e', '#f2c438', '#fce684', '#fffbe0'];
  const RUBY = ['#3a0618', '#78102a', '#c0203a', '#f04a5a', '#ff9a9a', '#fff0ea'];
  const SAPH = ['#0c1450', '#1a36a0', '#2a6ae0', '#44b0f8', '#a8ecff', '#f4ffff'];
  const JADE = ['#08302a', '#12604a', '#1e9a6a', '#44d08c', '#a8f4c4', '#f0fff4'];
  const PINK = ['#40082e', '#8a1a5a', '#d03a88', '#f47ab8', '#ffc4e4', '#fff4fa'];
  const SPARK = { w: WHITE, y: '#fff0a0', g: '#f8c840', c: '#b8f4ff', p: '#ffc8f0' };

  /**
   * Material: a colour ramp plus how it takes light.
   * o: {n, dark, light, shift, mid (ramp shape) | ramp (explicit), bias, contrast,
   * spec (N·H threshold for the top colour), dith, tex(x,y,nx,ny) → step delta,
   * rim (reflected light on the lower-right edge), line (contour colour),
   * flat (ignore depth/ground darkening), glow (emissive falloff exponent),
   * col(k,x,y,nx,ny) → colour override (iridescence)}
   */
  function mat(base, o) {
    o = o || {};
    const r = o.ramp || ramp(base, o.n || 5, o);
    return {
      r, n: r.length, bias: o.bias || 0, contrast: o.contrast == null ? 1 : o.contrast,
      spec: o.spec, dith: o.dith || 0, tex: o.tex, rim: o.rim, col: o.col,
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
   * z-buffer of shaded primitives. Every primitive takes o: {m: material,
   * g: group (parts of one group blend without a contour; default = material),
   * z: base depth (bigger = nearer), soft: contour against this group is a
   * darker step instead of a line, k: smooth-merge width within a group}
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
    plot(x, y, z, nx, ny, nz, m, g, k) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x;
      let l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const z0 = this.Z[i];
      if (k > 0 && this.Gr[i] === g && Math.abs(z - z0) < k) {
        // same group: smooth max of the two surfaces (organic joins)
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
    /** smooth tube through [[x,y,r,z?],...] (Catmull-Rom), radius/depth interpolated */
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
     * Flat-ish shape from a mask (Pix, non-null = inside). o.n = facing normal,
     * o.bevel = rounded edge width, o.bz = bevel height, o.slope = [dz/dx, dz/dy].
     */
    shape(mk, o) {
      const g = this.gid(o), z0 = o.z || 0, bv = o.bevel || 0, bz = o.bz == null ? bv : o.bz;
      const n0 = o.n || [0, 0, 1];
      const w = this.w, h = this.h;
      const H = new Float32Array(w * h);
      const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mk.d[y * w + x] != null;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
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
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inside(x, y)) continue;
        const gx = bv ? (hAt(x + 1, y) - hAt(x - 1, y)) / 2 : 0, gy = bv ? (hAt(x, y + 1) - hAt(x, y - 1)) / 2 : 0;
        const plane = o.slope ? o.slope[0] * x + o.slope[1] * y : 0;
        this.plot(x, y, z0 + H[y * w + x] + plane, n0[0] - gx * n0[2], n0[1] - gy * n0[2], n0[2], o.m, g, o.k || 0);
      }
      return this;
    }
    /** polygon [[x,y],...] as a shape */
    poly(pts, o) { const mk = G().pix(this.w, this.h); mk.poly(pts, 1); return this.shape(mk, o); }
    /** change the material (and optionally group) of covered pixels where fn(x,y) */
    region(fn, m, g) {
      const gid = g != null ? this.gid({ g, m }) : -1;
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.M[i] && fn(x, y, i)) { this.M[i] = m; if (gid >= 0) this.Gr[i] = gid; }
      }
      return this;
    }
    isG(x, y, g) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      return this.Gr[y * this.w + x] === this.gids.get(g);
    }
    /** ramp-step delta at a pixel (creases, glints) */
    mark(x, y, d) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
      const i = y * this.w + x;
      if (this.M[i]) this.D[i] = clamp(this.D[i] + d, -9, 9);
      return this;
    }
    carve(pts, d) {
      for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let i = k > 1 ? 1 : 0; i <= n; i++) this.mark(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, d);
      }
      return this;
    }
    cut(fn) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (this.M[i] && fn(x, y)) { this.M[i] = null; this.Z[i] = -1e9; this.Gr[i] = -1; }
      }
      return this;
    }
    /** light & quantise → Pix. o: {depth (far parts darker), ground (bottom darker), bias, contrast} */
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
        const y = (i / w) | 0;
        const dot = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const e = dot - LIGHT[2];
        let v = 0.5 + (e > 0 ? 0.78 * e : 0.46 * e) * m.contrast * (o.contrast || 1);
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
      // lone pixels of a step are absorbed by their neighbours (cleaner bands)
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
        if (m.rim && this.N[i * 3] * 0.6 + this.N[i * 3 + 1] > 0.35) {
          const e = (j) => j < 0 || j >= n || !this.M[j];
          if (e(i + 1) || e(i + w)) k = Math.max(k, m.rim);
        }
        k = clamp(k, 0, m.n - 1);
        let col = m.col ? m.col(k, x, y, this.N[i * 3], this.N[i * 3 + 1]) : m.r[k];
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
  /** stamp a grid and its mirror image (W = canvas width) */
  function stampM(p, x, y, rows, pal) {
    stamp(p, x, y, rows, pal);
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    return stamp(p, p.w - x - w, y, rows.map((r) => r.padEnd(w, '.').split('').reverse().join('')), pal);
  }
  /** set only where something is already painted */
  function on(p, x, y, c) { if (p.get(Math.round(x), Math.round(y)) != null) p.set(x, y, c); return p; }
  /** run fn for the left-hand original (X = id, s = 1) and its mirror (s = -1) */
  function sym(W, fn) { fn((x) => x, 1); fn((x) => W - 1 - x, -1); }

  /**
   * Faceted jewel (round/oval brilliant) painted straight into p: crown facets
   * lit from the top-left, light refracted out of the lower-right, a paler
   * table in the middle, a white glint and an optional metal bezel ring.
   * o: {bezel: ramp for a 1-px setting, shape: 'oval'|'drop'|'kite'}
   */
  function jewel(p, cx, cy, rx, ry, rmp, o) {
    o = o || {};
    const n = rmp.length;
    const inside = (x, y) => {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      if (o.shape === 'kite') return Math.abs(dx) + Math.abs(dy) * (dy < 0 ? 1.05 : 0.9) <= 1.02;
      if (o.shape === 'drop') return dx * dx + (dy < 0 ? dy * dy * 0.55 + Math.abs(dx) * -dy * 0.9 : dy * dy) <= 1;
      return dx * dx + dy * dy <= 1;
    };
    const px = [];
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) if (inside(x, y)) px.push([x, y]);
    if (o.bezel) {
      // setting ring: lit on the upper-left, dark lower-right
      for (const [x, y] of px) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (inside(x + dx, y + dy)) continue;
        const bx = x + dx, by = y + dy;
        const t = ((bx - cx) / (rx + 1)) * -0.6 + ((by - cy) / (ry + 1)) * -0.8;
        const b = o.bezel;
        p.set(bx, by, b[clamp(Math.round(b.length / 2 + t * (b.length / 2)), 1, b.length - 1)]);
      }
    }
    for (const [x, y] of px) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let k;
      if (r < 0.46) {
        // table: pale, brighter toward the lower right (light passing through)
        k = n - 3 + (dx + dy > 0.15 ? 1 : 0);
      } else {
        const sect = Math.round(a / (Math.PI / 4));
        const fa = sect * (Math.PI / 4);
        const lit = Math.cos(fa) * -0.6 + Math.sin(fa) * -0.8; // crown facet facing the light
        const refr = Math.cos(fa) * 0.6 + Math.sin(fa) * 0.8; // lower-right fire
        k = Math.round(1.6 + lit * 1.5 + Math.max(0, refr - 0.4) * 2.4);
        if (((sect + 8) & 1) && r > 0.8) k -= 1; // alternating girdle facets
      }
      p.set(x, y, rmp[clamp(k, 0, n - 1)]);
    }
    // glint on the upper-left crown facet + a pin-point on the lower right
    const gx = Math.round(cx - rx * 0.45), gy = Math.round(cy - ry * 0.45);
    p.set(gx, gy, WHITE);
    if (rx >= 2.5) { p.set(gx + 1, gy, rmp[n - 1]); p.set(gx, gy + 1, rmp[n - 1]); }
    if (rx >= 3.5) p.set(Math.round(cx + rx * 0.4), Math.round(cy + ry * 0.45), rmp[n - 1]);
    return p;
  }

  /**
   * Sparkle: 'dot' (1 px), 'small' (plus), 'star' (4-point, 5x5), 'big' (7x7).
   * Colours from SPARK: centre white, arms tinted (tint key of SPARK).
   */
  function sparkle(p, x, y, size, tint) {
    const t = SPARK[tint || 'y'];
    const rows = {
      dot: ['w'],
      small: ['.t.', 'twt', '.t.'],
      star: ['..t..', '..t..', 'ttwtt', '..t..', '..t..'],
      big: ['...t...', '...t...', '..tWt..', 'ttWwWtt', '..tWt..', '...t...', '...t...'],
    }[size || 'small'];
    const o = (rows.length - 1) / 2;
    return stamp(p, x - o, y - o, rows, { w: WHITE, W: SPARK.y, t });
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
  /**
   * Close the sprite: centre it horizontally (by its bbox), stand its lowest
   * pixel on the second-to-last row, add the outline, then post(q) paints
   * un-outlined extras (sparkles) in the sprite's own coordinates, shifted
   * with it. o.dx nudges the centring (asymmetric silhouettes).
   */
  function finish(p, post, o) {
    o = o || {};
    let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
    p.each((x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    let dx = Math.round((p.w - 1 - x1 - x0) / 2) + (o.dx || 0);
    dx = clamp(dx, 1 - x0, p.w - 2 - x1);
    const dy = Math.max(p.h - 2 - y1, 1 - y0);
    if (dx || dy) {
      const q = G().pix(p.w, p.h);
      q.blit(p, dx, dy);
      p.d = q.d;
    }
    p.outline(OUT); shave(p);
    if (post) {
      const q = G().pix(p.w, p.h);
      post(q);
      q.each((x, y, c) => { p.set(x + dx, y + dy, c); });
    }
    return p.toCanvas();
  }

  // ------------------------------------------------------------ sprites
  const S = {};

  // 宝石ウサギ: a plump golden-cream rabbit with a pearly sheen, a big sapphire
  // set in gold on its forehead and a small jewel capping each ear tip.
  S.rare_hare = () => {
    const W = 48, H = 48;
    const FUR = ['#5e3024', '#94552e', '#c8843c', '#e8b458', '#f6d888', '#fff0c0', '#fffcf0'];
    // pearl sheen: the two top steps pick up faint pink / aqua bands
    const sheen = (k, x, y) => {
      if (k < 5) return FUR[k];
      const b = (x * 2 + y * 3) % 11;
      return b < 2 ? (k === 6 ? '#f4ffff' : '#e6fcf4') : b > 8 ? (k === 6 ? '#fff4fc' : '#fde8e8') : FUR[k];
    };
    const fur = mat('', { ramp: FUR, rim: 3, col: sheen });
    const cream = mat('', { ramp: ['#8a6a58', '#bca084', '#e2cfb2', '#f6ecd8', '#fffcf4'], col: (k, x, y) => (k === 4 && (x + y) % 7 === 0 ? '#eefcff' : ['#8a6a58', '#bca084', '#e2cfb2', '#f6ecd8', '#fffcf4'][k]) });
    const inner = mat('#f0a0a0', { n: 4, dark: 0.5, bias: 0.05 });
    const sc = new Scene(W, H);
    // ears: long, splayed, slightly curved
    sym(W, (X, s) => {
      sc.tube([[X(19), 14, 3.2, 2], [X(15.5), 8, 3, 3], [X(13.5), 3.5, 1.4, 3]], { m: fur, g: 'ear' + s });
      sc.tube([[X(18.6), 13, 1.5, 6], [X(15.6), 8.2, 1.5, 6.5], [X(14.3), 5, 0.6, 6.5]], { m: inner, g: 'inner' + s, soft: true });
    });
    // fluffy tail peeking out at the right
    sc.ell(37.5, 37, 3.6, 3.4, { m: cream, g: 'tail', z: -6, rz: 3 });
    // body: pear shape, cream chest ruff
    sc.ell(23.5, 34.5, 12.2, 10, { m: fur, g: 'body', z: 0, rz: 10 });
    sc.ell(23.5, 29, 9.5, 5, { m: fur, g: 'body', z: 2, rz: 6 });
    sc.ell(23.5, 32, 7, 6, { m: cream, g: 'ruff', z: 7, rz: 6 });
    for (let i = -2; i <= 2; i++) sc.tube([[23.5 + i * 2.6, 35, 1.8, 10], [23.5 + i * 2.9, 38.6 - Math.abs(i) * 0.9, 0.6, 10]], { m: cream, g: 'ruff' });
    // big hind feet at the bottom, front paws resting on the belly
    sym(W, (X, s) => {
      sc.ell(X(12.5), 44.3, 5.4, 2.4, { m: fur, g: 'foot' + s, z: 7, rz: 3 });
      sc.ell(X(18.6), 38.4, 2.6, 2.2, { m: fur, g: 'paw' + s, z: 13, rz: 2.5 });
    });
    // head: big round head with cheek puffs
    sc.ell(23.5, 18.5, 10, 8, { m: fur, g: 'head', z: 8, rz: 8 });
    sym(W, (X) => sc.ell(X(15.5), 21.5, 4.2, 3.4, { m: fur, g: 'head', z: 9, rz: 4 }));
    sc.ell(23.5, 22.8, 4.6, 2.8, { m: cream, g: 'muzzle', z: 14, rz: 3 });
    // fur texture: a few strands on the flanks and the brow
    sc.carve([[13, 30], [12, 33]], -1).carve([[34, 30], [35, 33]], -1).carve([[15, 38], [14, 40]], -1).carve([[32, 38], [33, 40]], -1);
    sc.carve([[18, 12], [19, 12]], -1).carve([[28, 12], [29, 12]], -1);
    for (const [x, y] of [[10, 43], [12, 43], [14, 43], [33, 43], [35, 43], [37, 43]]) sc.mark(x, y + 1, -1);
    const p = sc.render();
    // paw toes
    for (const x of [17, 19, 28, 30]) on(p, x, 40, FUR[2]);
    // eyes: big glossy violet-ruby eyes with two highlights
    const eye = { k: INK, d: '#5a1450', r: '#b02a78', l: '#f070b0', w: WHITE };
    stamp(p, 16, 16, ['.kkk.', 'kwwrk', 'kwrdk', 'krldk', '.kkk.'], eye);
    stamp(p, 27, 16, ['.kkk.', 'kwwrk', 'kwrdk', 'krldk', '.kkk.'], eye);
    // blush, nose and a smug little mouth
    for (const [x, y] of [[14, 22], [15, 22], [32, 22], [33, 22]]) p.set(x, y, '#f49a9a');
    stamp(p, 22, 21, ['kPPk', '.kk.'], { k: '#8a3a4a', P: '#f080a0' });
    stamp(p, 21, 23, ['k..k..', '.kk.kk'], { k: '#7a3a3a' });
    // forehead sapphire in a gold setting
    jewel(p, 23.5, 12, 3, 2.6, SAPH, { bezel: GOLD });
    // ear-tip jewels (same stone, smaller)
    jewel(p, 13.5, 3.2, 1.6, 2, SAPH, { bezel: GOLD, shape: 'drop' });
    jewel(p, 33.5, 3.2, 1.6, 2, SAPH, { bezel: GOLD, shape: 'drop' });
    // pearl glints on the fur
    for (const [x, y] of [[17, 13], [11, 32], [14, 28], [20, 11]]) on(p, x, y, WHITE);
    return finish(p, (q) => {
      // whiskers, sparkles
      for (const [x0, y0, x1, y1] of [[18, 22, 13, 21], [18, 23, 13, 24], [29, 22, 34, 21], [29, 23, 34, 24]]) q.line(x0, y0, x1, y1, '#fff8e8');
      sparkle(q, 6, 12, 'star', 'y');
      sparkle(q, 41, 20, 'small', 'c');
      sparkle(q, 5, 30, 'small', 'p');
      sparkle(q, 42, 9, 'dot');
      sparkle(q, 30, 8, 'dot');
    });
  };

  // ------------------------------------------------------------ registry
  const SIZES = { rare_hare: 48, rare_lizard: 48, rare_bird: 48, rare_whale: 64, rare_idol: 48 };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.rareMonsters = { ids: Object.keys(SIZES), sizes: SIZES };
})(window.RPG);
