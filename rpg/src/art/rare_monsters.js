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
      if (at(x, y) !== OUT || y === h - 1) continue;
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

  // 宝石ウサギ: a plump golden rabbit with a pearly sheen, a big sapphire set
  // in gold on its forehead and a small jewel capping each long ear.
  S.rare_hare = () => {
    const W = 48, H = 48;
    const FUR = ['#5a2a1c', '#9a5424', '#d08a2c', '#ecb842', '#f8da78', '#fff0b4', '#fffcec'];
    // pearl sheen: the two top steps pick up faint aqua / pink bands
    const sheen = (k, x, y) => {
      if (k < 4) return FUR[k];
      const b = (x * 2 + y * 3) % 13;
      if (k === 4) return b === 0 ? '#e8f0b0' : b === 12 ? '#fcd8a8' : FUR[k];
      return b < 2 ? (k === 6 ? '#effffa' : '#dcf8e4') : b > 10 ? (k === 6 ? '#fff0fa' : '#fcdcdc') : FUR[k];
    };
    const fur = mat('', { ramp: FUR, rim: 3, col: sheen, bias: 0.07 });
    const CREAM = ['#9a7258', '#c8a684', '#ead4b0', '#f8eed8', '#fffdf6'];
    const cream = mat('', { ramp: CREAM });
    const inner = mat('#f4a4a4', { n: 4, dark: 0.45, bias: 0.08, contrast: 0.7 });
    const sc = new Scene(W, H);
    // ears: long and splayed, the right one leaning out a little further
    sc.tube([[19.5, 15, 3.3, 2], [16.8, 8.5, 3.2, 3], [15.2, 3.4, 1.8, 3]], { m: fur, g: 'earL' });
    sc.tube([[18.9, 13.5, 1.6, 6], [16.9, 8.6, 1.7, 6.5], [15.6, 4.4, 0.8, 6.5]], { m: inner, g: 'innerL', soft: true });
    sc.tube([[28, 15, 3.3, 2], [31.5, 8.8, 3.2, 3], [33.6, 3.8, 1.8, 3]], { m: fur, g: 'earR' });
    sc.tube([[28.6, 13.5, 1.6, 6], [31.2, 8.9, 1.7, 6.5], [33, 4.8, 0.8, 6.5]], { m: inner, g: 'innerR', soft: true });
    // body: a round mochi of a belly with a cream chest ruff
    sc.ell(23.5, 35, 12.4, 10.2, { m: fur, g: 'body', z: 0, rz: 10 });
    sc.ell(23.5, 31.5, 6.2, 4.6, { m: cream, g: 'ruff', z: 8, rz: 4, soft: true });
    for (let i = -2; i <= 2; i++) sc.tube([[23.5 + i * 2.4, 33.5, 1.7, 10], [23.5 + i * 2.6, 37 - Math.abs(i) * 0.8, 0.5, 10]], { m: cream, g: 'ruff' });
    // big hind feet, little front paws tucked on the belly
    sym(W, (X, s) => {
      sc.ell(X(12.5), 43.6, 5, 3, { m: fur, g: 'foot' + s, z: 8, rz: 3.5 });
      sc.ell(X(19.2), 38.8, 2.5, 2.1, { m: fur, g: 'paw' + s, z: 13, rz: 2.5 });
    });
    // head with cheek puffs and a cream muzzle
    sc.ell(23.5, 19, 9.6, 7.8, { m: fur, g: 'head', z: 8, rz: 8 });
    sym(W, (X) => sc.ell(X(15.8), 22, 4, 3.2, { m: fur, g: 'head', z: 9, rz: 4 }));
    sc.ell(23.5, 23.3, 4.2, 2.6, { m: cream, g: 'muzzle', z: 15, rz: 3, soft: true });
    // fur strands on the flanks, crown and feet
    sc.carve([[12, 30], [11, 33]], -1).carve([[35, 30], [36, 33]], -1).carve([[14, 37], [13, 39]], -1).carve([[33, 37], [34, 39]], -1);
    sc.carve([[21, 12], [22, 13]], -1).carve([[26, 12], [25, 13]], -1);
    for (const x of [10, 12, 14, 33, 35, 37]) sc.carve([[x, 43], [x, 45]], -1);
    const p = sc.render();
    for (const x of [18, 20, 27, 29]) on(p, x, 40, FUR[1]); // paw toes
    // eyes: big glossy ruby eyes with two highlights
    const eye = { k: INK, d: '#4a0e3c', r: '#a8205c', m: '#e0407a', l: '#ff9ac0', w: WHITE };
    stamp(p, 16, 16, ['.kkk.', 'kwwrk', 'kwrdk', 'krmdk', 'kmldk', '.kkk.'], eye);
    stamp(p, 27, 16, ['.kkk.', 'kwwrk', 'kwrdk', 'krmdk', 'kmldk', '.kkk.'], eye);
    // blush, nose, a contented little mouth
    for (const [x, y] of [[14, 23], [15, 23], [32, 23], [33, 23]]) p.set(x, y, '#f4988c');
    stamp(p, 22, 22, ['pPPp', '.pp.'], { p: '#b04860', P: '#f890a8' });
    stamp(p, 21, 24, ['k..k..', '.kk.kk'].map((r) => r.slice(0, 6)), { k: '#86443c' });
    // forehead sapphire in a gold setting, jewels on the ear tips
    jewel(p, 23.5, 12.5, 3.6, 3.2, SAPH, { bezel: GOLD, shape: 'kite' });
    jewel(p, 15.2, 3.2, 1.7, 2.2, SAPH, { bezel: GOLD, shape: 'drop' });
    jewel(p, 33.6, 3.6, 1.7, 2.2, SAPH, { bezel: GOLD, shape: 'drop' });
    // pearly glints on the fur
    for (const [x, y] of [[18, 13], [11, 31], [13, 28], [8, 41]]) on(p, x, y, WHITE);
    return finish(p, (q) => {
      for (const [x0, y0, x1, y1] of [[11, 22, 8, 21], [11, 24, 8, 25], [36, 22, 39, 21], [36, 24, 39, 25]]) q.line(x0, y0, x1, y1, '#fff4dc');
      sparkle(q, 6, 12, 'star', 'y');
      sparkle(q, 41, 15, 'small', 'c');
      sparkle(q, 4, 32, 'small', 'p');
      sparkle(q, 42, 30, 'dot');
      sparkle(q, 25, 5, 'dot');
    });
  };

  /**
   * Quartz point on a scene: base centre (bx,by) → tip (tx,ty), half-width w.
   * Four flat facets (two long faces, two tip faces) with hard edges; the tip
   * faces tilt toward the light.
   */
  function crystal(sc, bx, by, tx, ty, w, o) {
    const L = Math.hypot(tx - bx, ty - by), dx = (tx - bx) / L, dy = (ty - by) / L;
    const px = -dy, py = dx; // perpendicular (to the left of the tip direction when pointing up)
    const sh = o.shoulder || 0.7;
    const sx = bx + (tx - bx) * sh, sy = by + (ty - by) * sh;
    const side = px < 0 || (px === 0 && py > 0) ? 1 : -1; // make face A the screen-left face
    const ax = px * side, ay = py * side;
    const BL = [bx + ax * w, by + ay * w], BR = [bx - ax * w, by - ay * w];
    const SL = [sx + ax * w, sy + ay * w], SR = [sx - ax * w, sy - ay * w];
    const nA = [ax * 0.62, ay * 0.62, 0.78], nB = [-ax * 0.62, -ay * 0.62, 0.78];
    const tA = [ax * 0.45 + dx * 0.55, ay * 0.45 + dy * 0.55, 0.7], tB = [-ax * 0.45 + dx * 0.55, -ay * 0.45 + dy * 0.55, 0.7];
    const z = o.z || 0, q = { m: o.m, g: o.g, z, k: 0 };
    sc.poly([BL, SL, [sx, sy], [bx, by]], Object.assign({ n: nA }, q));
    sc.poly([[bx, by], [sx, sy], SR, BR], Object.assign({ n: nB }, q));
    sc.poly([SL, [tx, ty], [sx, sy]], Object.assign({ n: tA, z: z + 0.2 }, q));
    sc.poly([[sx, sy], [tx, ty], SR], Object.assign({ n: tB, z: z + 0.2 }, q));
    return { base: [bx, by], tip: [tx, ty], mid: [sx, sy], left: SL, right: SR };
  }

  /** paint crisp edges on a rendered crystal: lit left edge, ridge, prism fringe */
  function crystalEdges(p, c, cols, fringe) {
    const [tx, ty] = c.tip;
    p.line(c.left[0], c.left[1], tx, ty, cols[cols.length - 1]);
    p.line(c.base[0], c.base[1], c.mid[0], c.mid[1], cols[cols.length - 2]);
    if (fringe) {
      const n = Math.max(2, Math.round(Math.hypot(c.right[0] - c.mid[0], c.right[1] - c.mid[1])));
      p.set(Math.round(c.mid[0] + (c.right[0] - c.mid[0]) * 0.55), Math.round(c.mid[1] + (c.right[1] - c.mid[1]) * 0.55) + 1, fringe[0]);
      if (n > 2) p.set(Math.round(c.mid[0] + (c.right[0] - c.mid[0]) * 0.55), Math.round(c.mid[1] + (c.right[1] - c.mid[1]) * 0.55) + 2, fringe[1]);
    }
    p.set(Math.round(tx), Math.round(ty), WHITE);
    return p;
  }

  // 金剛トカゲ: a thick-set lizard in three-quarter view, head turned to the
  // viewer; its back is paved with diamond scales that split the light into
  // rainbow glints, a row of clear quartz points runs down the spine and a
  // crystal caps the curling tail.
  S.rare_lizard = () => {
    const W = 48, H = 48;
    const HIDE = ['#1c1640', '#342a74', '#4e4cae', '#6e7cd4', '#a0b4f0', '#dce8ff'];
    const hide = mat('', { ramp: HIDE, rim: 3 });
    const BELLY = ['#5e4c78', '#9a88ac', '#cec2d8', '#eee8f0', '#ffffff'];
    const belly = mat('', { ramp: BELLY, tex: (x, y) => ((x + y * 2) % 5 === 0 ? -1 : 0) });
    const jaw = mat('', { ramp: BELLY, bias: 0.28, contrast: 0.6 });
    const TINTS = ['#9cf0ff', '#a8ffcc', '#fff09c', '#ffc4a0', '#ffa8d8', '#c8b4ff'];
    // diamond scales: a rotated 5-px grid with dark grout; each scale has a lit
    // upper-left edge and a tint from a rainbow sweeping across the back
    const SIL = ['#1a1644', '#34347c', '#6470bc', '#a0b0e4', '#d4e0f8', '#ffffff'];
    const scaleTex = (x, y) => {
      const u = (x + y) % 6, v = (x - y + 120) % 6;
      if (u === 0 || v === 0) return -2;
      return u <= 2 && v <= 3 ? 1 : u >= 4 ? -1 : 0;
    };
    const scaleCol = (k, x, y) => {
      if (k <= 1) return SIL[k];
      const cu = Math.floor((x + y) / 6), cv = Math.floor((x - y + 120) / 6);
      const t = TINTS[Math.floor((cu * 38 + cv * 17 + 1000) / 64) % TINTS.length];
      return k >= 5 ? mix(WHITE, t, 0.25) : mix(SIL[k], t, k === 4 ? 0.7 : k === 3 ? 0.55 : 0.3);
    };
    const back = mat('', { ramp: SIL, tex: scaleTex, col: scaleCol, bias: 0.1, line: '#141034' });
    const CRYS = ['#2a3470', '#4a6cb4', '#7cb4e8', '#b4e6fa', '#e4fbff', '#ffffff'];
    const crys = mat('', { ramp: CRYS, contrast: 1.3, bias: 0.08, line: '#1a2250' });
    const claw = mat('#eceaf8', { n: 4, dark: 0.5 });
    const tongue = mat('#e8506a', { n: 4 });
    const sc = new Scene(W, H);
    // far legs (behind the body)
    sc.tube([[24, 32, 2.4, -6], [26.5, 37.5, 2, -6], [27, 41.5, 1.8, -6]], { m: hide, g: 'legFF' });
    sc.ell(27.5, 42.8, 2.6, 1.3, { m: hide, g: 'legFF', z: -4, rz: 1.5 });
    sc.tube([[38, 29, 2.4, -7], [41.5, 33.5, 2, -7], [41.5, 38.5, 1.7, -7]], { m: hide, g: 'legFH' });
    sc.ell(42, 39.6, 2.5, 1.2, { m: hide, g: 'legFH', z: -5, rz: 1.5 });
    // tail sweeping out and curling up at the right
    sc.tube([[36, 28, 4.4, -2], [41.5, 25.5, 3.3, -2], [44, 19, 2.3, -2], [42, 12.5, 1.5, -2]], { m: back, g: 'tail' });
    // body: thick barrel along a diagonal spine, scaled back, pale belly
    sc.tube([[15, 30.5, 5.4, 3], [22, 28.5, 7, 1], [30, 27.5, 7, 0], [36.5, 28, 4.8, -1]], { m: back, g: 'body', steps: 8 });
    sc.region((x, y) => sc.isG(x, y, 'body') && x < 21 && y > 33, belly);
    // near legs
    sc.tube([[17.5, 32, 3.2, 8], [14.5, 37.5, 2.7, 9], [13.5, 42.5, 2.3, 9]], { m: hide, g: 'legNF' });
    sc.ell(13, 44.4, 3.6, 1.7, { m: hide, g: 'legNF', z: 11, rz: 2 });
    sc.tube([[32, 31.5, 3.8, 7], [36, 36, 3, 8], [35.5, 42.5, 2.4, 8]], { m: hide, g: 'legNH' });
    sc.ell(35.5, 44.4, 3.8, 1.7, { m: hide, g: 'legNH', z: 10, rz: 2 });
    for (const [fx, g, z] of [[13, 'clawF', 12], [35.5, 'clawH', 11], [27.5, 'clawFF', -3]]) {
      const fy = fx === 27.5 ? 43.5 : 45.3;
      for (const d of [-2.6, -0.9, 0.9, 2.6]) sc.tube([[fx + d * 0.7, fy - 0.6, 0.8, z], [fx + d * 1.15 - 0.6, fy + 1.1, 0.3, z]], { m: claw, g });
    }
    // neck and head, turned to the viewer
    sc.tube([[17, 29.5, 5.2, 4], [12.5, 30, 5, 6]], { m: hide, g: 'head' });
    sc.ell(11, 28.8, 7.2, 5.9, { m: hide, g: 'head', z: 6, rz: 6 });
    sc.ell(6.2, 32.4, 5.2, 3.5, { m: hide, g: 'head', z: 8, rz: 4 });
    sc.ell(11.5, 25.2, 3.6, 2.6, { m: hide, g: 'head', z: 10, rz: 3 }); // brow over the near eye
    sc.ell(9, 35.2, 5.4, 1.8, { m: jaw, g: 'jaw', z: 7, rz: 2.2, soft: true });
    sc.ell(15.5, 35.5, 3.5, 2.4, { m: jaw, g: 'jaw', z: 5, rz: 2.4, soft: true });
    sc.tube([[3.5, 35, 0.9, 14], [1.4, 37, 0.7, 14], [0.8, 39, 0.4, 14]], { m: tongue, g: 'tongue' });
    // quartz points down the spine, near the viewer last
    const spikes = [
      crystal(sc, 36.5, 23.5, 38.5, 17.5, 1.6, { m: crys, g: 's5', z: 2 }),
      crystal(sc, 32, 21, 33.5, 12.5, 2.2, { m: crys, g: 's4', z: 3 }),
      crystal(sc, 27, 21, 27.5, 9, 2.7, { m: crys, g: 's3', z: 4 }),
      crystal(sc, 21.5, 22, 20.5, 11.5, 2.4, { m: crys, g: 's2', z: 5 }),
      crystal(sc, 16.5, 25, 15, 18.5, 1.7, { m: crys, g: 's1', z: 6 }),
      crystal(sc, 42, 13.2, 40, 6.5, 1.8, { m: crys, g: 'tip', z: 1 }),
    ];
    const p = sc.render();
    const fr = [['#ff9ad0', '#ffe07a'], ['#9cf0ff', '#ffe07a'], ['#ffe07a', '#ff9ad0']];
    spikes.forEach((c, i) => crystalEdges(p, c, CRYS, fr[i % 3]));
    // eye: big gold iris with a slit pupil, the far eye just peeking
    stamp(p, 8, 26, ['.kkkk.', 'kwyykk', 'kyyyko', '.okko.'], { k: INK, y: '#f8d040', o: '#c07018', w: WHITE });
    stamp(p, 16, 27, ['kk', 'yk'], { k: INK, y: '#e0a830' });
    jewel(p, 12, 23.4, 1.4, 1.4, SAPH.map((c) => mix(c, '#d0f8ff', 0.35)), { shape: 'kite' });
    // nostril and a long, smug mouth line curling up at the back
    p.set(2, 31, INK); p.set(3, 31, INK);
    p.line(2, 34, 11, 34, INK); p.line(12, 33, 14, 32, INK); p.set(15, 31, INK);
    p.set(5, 35, WHITE); p.set(8, 35, WHITE); p.set(11, 34, WHITE);
    // prism glints scattered over the diamond scales
    for (const [x, y, c] of [[24, 25, WHITE], [29, 24, '#fff4a0'], [19, 28, '#b8f8ff'], [33, 26, '#ffc8ec'], [26, 29, WHITE]]) on(p, x, y, c);
    return finish(p, (q) => {
      sparkle(q, 23, 5, 'star', 'c');
      sparkle(q, 35, 7, 'small', 'y');
      sparkle(q, 10, 17, 'small', 'p');
      sparkle(q, 46, 26, 'dot');
      sparkle(q, 5, 22, 'dot');
    }, { dx: 0 });
  };

  /**
   * Material whose ramp is chosen per pixel from a list of equal-length ramps
   * by t(x,y) in 0..1 (a colour gradient across a part), with a checker
   * dither where two ramps meet.
   */
  function gradMat(ramps, t, o) {
    const n = ramps.length, dz = o && o.dither != null ? o.dither : 0.14;
    const col = (k, x, y) => {
      const f = clamp(t(x, y), 0, 0.999) * (n - 1);
      let i = Math.floor(f);
      const fr = f - i;
      if (fr + ((x + y) & 1 ? dz : -dz) > 0.5) i++;
      return ramps[clamp(i, 0, n - 1)][k];
    };
    return mat('', Object.assign({ ramp: ramps[0], col }, o || {}));
  }

  // オーロラ鳥: an elegant long-necked bird in three-quarter view, wings raised
  // high above its back. The plumage runs through the colours of an aurora
  // (emerald → teal → blue → violet → rose at the tips) and two long ribbon
  // tail feathers ripple down to the ground and curl. Gold beak, jewelled crest.
  S.rare_bird = () => {
    const W = 48, H = 48;
    const AUR = [
      ['#0a3c38', '#0e7a58', '#26bc7c', '#78eca4', '#dcffe8'],
      ['#0a2e4c', '#0e6e8e', '#1eb4c4', '#74e8ee', '#dcfcff'],
      ['#181a62', '#2a42b0', '#4a7ce6', '#8ebcff', '#e4eeff'],
      ['#2a0c52', '#5a22a2', '#8e4ad8', '#c690f8', '#f4e2ff'],
      ['#440c44', '#8a1c7c', '#cc4ab4', '#f69ad8', '#fff0fa'],
    ];
    const wing = gradMat(AUR, (x, y) => (Math.hypot(x - 27, (y - 21) * 1.1) - 5) / 17, { rim: 3, dither: 0.1 });
    const far = gradMat(AUR, (x, y) => (Math.hypot(x - 24, y - 18) - 6) / 14, { bias: -0.1, dither: 0.1 });
    const ribbon = gradMat(AUR, (x, y) => (Math.hypot(x - 27, y - 29) - 3) / 15, { rim: 3, dither: 0.1 });
    const body = gradMat(AUR.slice(0, 3), (x, y) => (x + y - 18) / 36, { rim: 3, dither: 0.1 });
    const CH = ['#2c7a6c', '#62b8a0', '#a8e8d0', '#e2fff0', '#ffffff'];
    const chest = mat('', { ramp: CH, bias: 0.04, tex: (x, y) => ((x * 3 + y * 2) % 7 === 0 ? -1 : 0) });
    const gold = mat('', { ramp: GOLD.slice(1), spec: 0.95 });
    const sc = new Scene(W, H);
    // ribbon tail: two long streamers from the rump, twisting as they fall, each ending in a curl
    sc.tube([[28, 29, 1.7, -3], [34, 30.2, 1.9, -3], [39.5, 32.5, 0.7, -3], [44, 36.5, 1.8, -3], [44.6, 41.5, 1.5, -3], [41, 45.3, 1.1, -3], [37, 44.6, 0.8, -3], [37, 41.8, 0.5, -3]], { m: ribbon, g: 'ribA', steps: 5 });
    sc.tube([[28, 30.5, 1.6, -1], [32, 34, 1.8, -1], [33.5, 38.5, 0.7, -1], [31.5, 43, 1.6, -1], [27.5, 46.3, 1.1, -1], [24.2, 45.2, 0.8, -1], [24.6, 42.6, 0.5, -1]], { m: ribbon, g: 'ribB', steps: 5 });
    for (const [tx, ty, g] of [[34.5, 30, 'fan1'], [33, 33.5, 'fan2']]) sc.tube([[27, 28, 2, 0], [tx, ty, 0.6, 0]], { m: ribbon, g });
    // far wing: two feather tips peeking up behind the near one
    sc.poly([[22, 19], [19.5, 10], [17, 4.5], [20.5, 7.5], [21, 1.5], [24, 8], [25, 16]], { m: far, g: 'far', z: -8, bevel: 2 });
    // near wing: one raised fan with six pointed primaries; feather splits carved in
    const WING = [[27, 23], [23.5, 18.5], [22.5, 12], [24, 5.5], [25.5, 0.6], [28, 5.5], [31, 0.5], [32.8, 6.2], [37, 1.8], [37.4, 8.2], [42.2, 5.4], [40.8, 11.4], [46, 11.4], [42.6, 15.4], [46.6, 18.6], [39, 20.2], [32, 22.6]];
    sc.poly(WING, { m: wing, g: 'wing', z: 0, bevel: 3, bz: 3 });
    for (const [nx, ny, rx, ry] of [[28, 5.5, 27, 15], [32.8, 6.2, 29.5, 15], [37.4, 8.2, 32, 16], [40.8, 11.4, 34, 17.5], [42.6, 15.4, 35, 19]]) sc.carve([[nx, ny + 0.5], [rx, ry]], -2);
    // coverts: a scalloped band over the feather roots
    for (const [x, y] of [[25.5, 17.5], [28.5, 16.5], [31.5, 16.8], [34.5, 18]]) sc.carve([[x - 1.5, y - 1], [x - 0.5, y], [x + 0.5, y], [x + 1.5, y - 1]], -1);
    sc.carve([[24, 14], [27, 12.5], [31, 12.5], [35, 14.5], [38, 17]], 1);
    // body with a pale chest, tucked golden talons
    sc.ell(22, 25, 7.2, 6, { m: body, g: 'body', z: 4, rz: 6 });
    sc.region((x, y) => sc.isG(x, y, 'body') && Math.hypot((x - 18) / 4.6, (y - 25.5) / 5.2) < 1, chest);
    sc.tube([[19, 30.5, 1, 7], [18.2, 32.8, 0.6, 7]], { m: gold, g: 'talon1' });
    sc.tube([[22.5, 30.8, 1, 6], [22, 33, 0.6, 6]], { m: gold, g: 'talon2' });
    // slender S-curved neck, head turned to the viewer, gold beak
    sc.tube([[19, 22, 3.4, 6], [15, 18, 2.3, 7], [13, 14, 2.2, 8], [12.5, 11, 2.4, 8]], { m: body, g: 'body', steps: 5 });
    sc.region((x, y) => sc.isG(x, y, 'body') && y > 13 && y < 23 && x < 12.5 + (y - 13) * 0.62 && x > 8, chest);
    sc.ell(12.2, 10.2, 4, 3.7, { m: body, g: 'head', z: 9, rz: 4 });
    sc.tube([[9, 11, 1.2, 13], [5.6, 11.8, 0.9, 13], [2.8, 13.2, 0.4, 13]], { m: gold, g: 'beak' });
    // crest plumes sweeping back from the crown
    sc.tube([[14, 7.4, 0.9, 5], [17, 4.5, 0.7, 5], [20.5, 3.8, 0.5, 5]], { m: body, g: 'crest' });
    sc.tube([[12.5, 7, 0.9, 6], [13.6, 3.6, 0.7, 6], [15.6, 1.2, 0.5, 6]], { m: body, g: 'crest' });
    const p = sc.render();
    // eye with a dark mask stripe, ruby glint
    stamp(p, 9, 9, ['kkk', 'kwr', '.kk'], { k: INK, r: '#e02858', w: WHITE });
    p.set(12, 9, INK); p.set(13, 8, INK);
    p.set(5, 11, GOLD[6]); p.set(6, 11, GOLD[5]);
    // jewels tipping the crest
    jewel(p, 20.8, 3.8, 1, 1, PINK);
    jewel(p, 15.8, 1.2, 1, 1, PINK);
    return finish(p, (q) => {
      sparkle(q, 5, 4, 'star', 'c');
      sparkle(q, 40, 28, 'small', 'p');
      sparkle(q, 6, 30, 'small', 'y');
      sparkle(q, 45, 2, 'dot');
      sparkle(q, 33, 45, 'dot');
    });
  };

  // ------------------------------------------------------------ registry
  const SIZES = { rare_hare: 48, rare_lizard: 48, rare_bird: 48, rare_whale: 64, rare_idol: 48 };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.rareMonsters = { ids: Object.keys(SIZES), sizes: SIZES };
})(window.RPG);
