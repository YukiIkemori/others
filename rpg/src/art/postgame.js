// Post-game battle sprites (深淵の迷宮): 'mon:boss_abyss' (the superboss),
// 'mon:rare_prism' (the abyss rare monster) and two new regular base sprites,
// 'mon:void_wraith' and 'mon:chaos_beast', built to read well hue-shifted.
//
// Pipeline (same family as bosses.js): silhouettes are masks built from
// primitives, pillow-shaded from an exact distance transform with hue-shifted
// ramps, layered back to front with dark inner contours, detailed by hand and
// closed with a bold 1-px outline (lowest pixel on the second-to-last row).
// The abyss material is special: a void-dark body whose lit steps split into
// an iridescent sheen (teal → blue → violet → magenta, chosen per pixel from
// the surface normal), and void membranes that show a starfield with nebulae.
// Deterministic (seeded noise); every sprite is built lazily through R.Gfx.get.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#08060e'; // outer outline
  const INK = '#140c1c'; // inner lines, pupils, mouths
  const WHITE = '#fcfcf4';

  // ------------------------------------------------------------ colour
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function hsv(c) {
    const [r, g, b] = rgb(c).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function fromHsv(h, s, v) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  const towards = (h, t, amt) => { const d = ((t - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function dk(c, k) { const [r, g, b] = rgb(c); return hex(r * k, g * k, b * k); }
  /**
   * Hue-shifted ramp dark → light around a mid-tone base: shadows drift toward
   * violet and gain saturation, lights drift toward warm yellow and desaturate.
   * o: {dark, light, shift (deg), mid (0..1 base position)}
   */
  function ramp(base, n, o) {
    n = n || 6; o = o || {};
    const [h, s, v] = hsv(base);
    const k = Math.round((n - 1) * (o.mid == null ? 0.5 : o.mid));
    const dark = o.dark == null ? 0.68 : o.dark, light = o.light == null ? 0.7 : o.light;
    const shift = o.shift == null ? 24 : o.shift;
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

  // ------------------------------------------------------------ noise
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** deterministic hash noise in [0,1) */
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  /** smooth value noise (cell size c) */
  function vnoise(x, y, c, s) {
    const X = x / c, Y = y / c, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), d = hash(x0, y0 + 1, s), e = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, 9, s) * 0.55 + vnoise(x, y, 4.5, s + 7) * 0.3 + vnoise(x, y, 2.2, s + 13) * 0.15;

  // ------------------------------------------------------------ masks
  const mask = (w, h) => G().pix(w, h);
  /** tapered capsule from (x0,y0,r0) to (x1,y1,r1) */
  function cap(p, x0, y0, x1, y1, r0, r1, c) {
    if (r1 == null) r1 = r0;
    if (c === undefined) c = 1;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    const m = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.ceil(Math.max(y0, y1) + m); y++)
      for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.ceil(Math.max(x0, x1) + m); x++) {
        const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
        const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t;
        if ((x - px) * (x - px) + (y - py) * (y - py) <= (r + 0.35) * (r + 0.35)) p.set(x, y, c);
      }
    return p;
  }
  /** point on a line / quadratic / cubic bezier */
  function bez(pts, t) {
    const u = 1 - t;
    if (pts.length === 2) return [0, 1].map((k) => u * pts[0][k] + t * pts[1][k]);
    if (pts.length === 3) return [0, 1].map((k) => u * u * pts[0][k] + 2 * u * t * pts[1][k] + t * t * pts[2][k]);
    return [0, 1].map((k) => u * u * u * pts[0][k] + 3 * u * u * t * pts[1][k] + 3 * u * t * t * pts[2][k] + t * t * t * pts[3][k]);
  }
  /** bezier tube, radius r0 → r1 */
  function tube(p, pts, r0, r1, c, n) {
    n = n || 20;
    let a = pts[0];
    for (let i = 1; i <= n; i++) {
      const b = bez(pts, i / n);
      cap(p, a[0], a[1], b[0], b[1], r0 + (r1 - r0) * (i - 1) / n, r0 + (r1 - r0) * i / n, c);
      a = b;
    }
    return p;
  }
  /** 1-px bezier curve */
  function curve(p, pts, c, n) {
    n = n || 24;
    let a = pts[0];
    for (let i = 1; i <= n; i++) { const b = bez(pts, i / n); p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c); a = b; }
    return p;
  }
  /** run fn(X, s) for the left side and the mirrored right side */
  const both = (W, fn) => { fn((x) => x, 1); fn((x) => W - 1 - x, -1); };

  // ------------------------------------------------------------ shading
  function bbox(m) {
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x] != null) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  /** exact Euclidean distance to the nearest outside pixel (Felzenszwalb) */
  function edt(m, bb) {
    const D = new Float32Array(m.w * m.h);
    bb = bb || bbox(m);
    if (!bb) return D;
    const [bx, by] = bb, w = bb[2] - bx + 3, h = bb[3] - by + 3, BIG = 1e12;
    const f = new Float64Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (m.d[(by + y - 1) * m.w + (bx + x - 1)] != null) f[y * w + x] = BIG;
    const n = Math.max(w, h);
    const g = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    const dt = (len) => {
      let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
      for (let q = 1; q < len; q++) {
        let s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = (g[q] + q * q - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + g[v[k]]; }
    };
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) g[y] = f[y * w + x]; dt(h); for (let y = 0; y < h; y++) f[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) g[x] = f[y * w + x]; dt(w); for (let x = 0; x < w; x++) f[y * w + x] = d[x]; }
    for (let y = bb[1]; y <= bb[3]; y++) for (let x = bb[0]; x <= bb[2]; x++) {
      const i = y * m.w + x;
      if (m.d[i] != null) D[i] = Math.sqrt(f[(y - by + 1) * w + (x - bx + 1)]) - 0.5;
    }
    return D;
  }
  function sphereN(cx, cy, rx, ry) {
    return (x, y) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 >= 0.98) { const d = Math.sqrt(d2); return [dx / d * 0.99, dy / d * 0.99, 0.14]; }
      return [dx, dy, Math.sqrt(1 - d2)];
    };
  }
  function cylN(cx, rx) {
    return (x) => { const dx = Math.max(-0.99, Math.min(0.99, (x - cx) / rx)); return [dx, 0, Math.sqrt(1 - dx * dx)]; };
  }
  /**
   * Light a mask: returns {nx, ny, nz, v, D} per pixel through cb(x, y, info) so
   * callers can map light to any palette (plain ramps or the iridescent sheen).
   * o: {depth, smooth, light, normal, blend, amb, global, bias, flat}
   */
  function lightMask(m, o, cb) {
    o = o || {};
    const w = m.w, h = m.h, depth = o.depth || 5;
    const bb = bbox(m);
    if (!bb) return;
    const [x0, y0, x1, y1] = bb;
    const D = edt(m, bb);
    const H = new Float32Array(w * h);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (m.d[i] == null) continue;
      const t = Math.min(1, D[i] / depth);
      H[i] = depth * Math.sqrt(1 - (1 - t) * (1 - t));
    }
    for (let k = 0; k < (o.smooth == null ? 1 : o.smooth); k++) {
      const S = H.slice();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (m.d[i] == null) continue;
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          s += X < 0 || Y < 0 || X >= w || Y >= h ? 0 : S[Y * w + X];
        }
        H[i] = (s / 9 + S[i]) / 2;
      }
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2);
    let L = o.light || [-0.5, -0.72, 0.62];
    const ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    const amb = o.amb == null ? 0.08 : o.amb, glob = o.global == null ? 0.22 : o.global, flat = o.flat || 0;
    const hAt = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? H[y * w + x] : 0);
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m.d[y * w + x] != null;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (m.d[i] == null) continue;
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
      let nx = -gx * (1 - flat), ny = -gy * (1 - flat), nz = 1;
      let nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      if (o.normal) {
        const q = o.normal(x, y), t = o.blend == null ? 0.3 : o.blend;
        nx = q[0] * (1 - t) + nx * t; ny = q[1] * (1 - t) + ny * t; nz = q[2] * (1 - t) + nz * t;
        nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      }
      const dot = nx * L[0] + ny * L[1] + nz * L[2];
      let v = amb + (1 - amb) * Math.max(0, dot);
      v += glob * (((x - cx) / hw) * L[0] + ((y - cy) / hh) * L[1]) * 0.5;
      v += o.bias || 0;
      const edge = D[i] < 1.3 && (!inside(x + 1, y) || !inside(x, y + 1));
      cb(x, y, { nx, ny, nz, dot, v, D: D[i], edge });
    }
  }
  /** shade a mask with a ramp. o adds: dither, rim (steps on the lower/right edge), spec */
  function shade(m, rmp, o) {
    o = o || {};
    const n = rmp.length, out = G().pix(m.w, m.h);
    lightMask(m, o, (x, y, q) => {
      const f = Math.max(0, Math.min(0.999, q.v)) * n;
      let k = Math.floor(f);
      if (o.dither && (x + y) % 2 && f - k > 0.7) k++;
      if (o.rim && q.edge && q.ny + q.nx * 0.5 > 0.1 && q.dot < 0.45) k += o.rim;
      if (o.spec != null && q.dot > o.spec) k = n - 1;
      out.set(x, y, rmp[Math.max(0, Math.min(n - 1, k))]);
    });
    return out;
  }
  function part(w, h, fn, rmp, o) { const m = mask(w, h); fn(m); return shade(m, rmp, o); }
  /** layer src over dst; line: colour or 'dark' for a contour where src's edge crosses dst */
  function put(dst, src, line, k) {
    const bb = bbox(src);
    if (!bb) return dst;
    const sw = src.w, sd = src.d;
    if (line) {
      const at = (x, y) => (x >= 0 && y >= 0 && x < sw && y < src.h ? sd[y * sw + x] : null);
      for (let y = bb[1] - 1; y <= bb[3] + 1; y++) for (let x = bb[0] - 1; x <= bb[2] + 1; x++) {
        if (at(x, y) != null) continue;
        if (at(x - 1, y) == null && at(x + 1, y) == null && at(x, y - 1) == null && at(x, y + 1) == null) continue;
        const dc = dst.get(x, y);
        if (dc == null) continue;
        dst.set(x, y, line === 'dark' ? dk(dc, k || 0.42) : line);
      }
    }
    for (let y = bb[1]; y <= bb[3]; y++) for (let x = bb[0]; x <= bb[2]; x++) {
      const c = sd[y * sw + x];
      if (c != null) dst.set(x, y, c);
    }
    return dst;
  }
  /** shift pixels painted with ramp rmp by fn(x,y,i) steps */
  function bump(p, rmp, fn) {
    const idx = {};
    rmp.forEach((c, i) => { idx[c] = i; });
    p.each((x, y, c) => {
      if (!(c in idx)) return undefined;
      const d = fn(x, y, idx[c]);
      return d ? rmp[Math.max(0, Math.min(rmp.length - 1, idx[c] + d))] : undefined;
    });
    return p;
  }
  /** set a pixel only where p already has something */
  function on(p, x, y, c) { x = Math.round(x); y = Math.round(y); if (p.get(x, y) != null) p.set(x, y, c); }
  function stamp(p, x, y, rows, pal) { p.grid(x, y, rows, pal); return p; }
  /** radial glow over existing pixels (all: also on empty ones): cols outer → inner */
  function glow(p, cx, cy, r, cols, all) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1 || (!all && p.get(x, y) == null)) continue;
      p.set(x, y, cols[Math.min(cols.length - 1, Math.floor((1 - d) * cols.length))]);
    }
    return p;
  }
  /** rim light on the outer silhouette: src pixels bordering nb pixels on a side facing dirs[].d */
  function edgeLight(p, o) {
    const src = p.d.slice(), w = p.w, h = p.h;
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (c == null || !o.src(c)) continue;
      for (const r of o.dirs) {
        const dx = Math.sign(r.d[0]), dy = Math.sign(r.d[1]);
        if ((dx && o.nb(at(x + dx, y))) || (dy && o.nb(at(x, y + dy)))) { p.d[y * w + x] = typeof r.c === 'function' ? r.c(x, y) : r.c; break; }
      }
    }
    return p;
  }
  /** scale texture over ramp-painted pixels (overlapping half-discs) */
  function scales(p, rmp, w, h, o) {
    o = o || {};
    const x0 = o.x || 0, y0 = o.y || 0, lim = o.mask;
    return bump(p, rmp, (x, y) => {
      if (lim && lim.get(x, y) == null) return 0;
      const r = Math.floor((y - y0) / h), ox = (r % 2) * w / 2;
      const u = ((x - x0 + ox) % w + w) % w, v = ((y - y0) % h + h) % h;
      const dx = (u - (w - 1) / 2) / (w / 2), dy = (v - (h - 1)) / h;
      const d = Math.hypot(dx, dy);
      if (d > 0.84 || v === h - 1) return -1;
      if (dx < -0.1 && dy < -0.35 && d > 0.45) return o.lit == null ? 1 : o.lit;
      return 0;
    });
  }
  /** 4-point sparkle (arm length r) drawn with c, centre cc */
  function sparkle(p, x, y, r, c, cc) {
    for (let k = 1; k <= r; k++) { p.set(x + k, y, c); p.set(x - k, y, c); p.set(x, y + k, c); p.set(x, y - k, c); }
    p.set(x, y, cc || c);
    return p;
  }
  /**
   * Close the sprite: 1-px margin for the outline, lowest pixel on the
   * second-to-last row (unless o.float), outline in OUT, then o.post(q) draws fine
   * un-outlined details over the sprite (anywhere with o.free).
   */
  function finish(p, o) {
    o = o || {};
    let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
    p.each((x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    let dx = 0, dy = 0;
    if (o.center) dx = Math.round((p.w - 1 - x1 - x0) / 2);
    if (x0 + dx < 1) dx = 1 - x0;
    if (x1 + dx > p.w - 2) dx = p.w - 2 - x1;
    if (!o.float || y1 > p.h - 2) dy = p.h - 2 - y1;
    if (y0 + dy < 1 && y1 - y0 <= p.h - 3) dy = 1 - y0;
    if (dx || dy) { const q = G().pix(p.w, p.h); q.blit(p, dx, dy); p.d = q.d; }
    p.outline(OUT);
    if (o.post) {
      const q = G().pix(p.w, p.h);
      o.post(q);
      q.each((x, y, c) => { if (p.get(x + dx, y + dy) != null || o.free) p.set(x + dx, y + dy, c); });
    }
    return p.toCanvas();
  }

  // ------------------------------------------------------------ materials
  const GOLD = ['#3a1a0c', '#6a3410', '#a2601a', '#d09028', '#f0c040', '#fae078', '#fff8d0'];
  const IVORY = ['#3a2a30', '#6a5250', '#9c8272', '#c8b294', '#e8dcc0', '#fcf6e6'];
  // void body: shared dark steps, then the lit steps split into four sheen bands
  const VOID_DARK = ['#07050e', '#100b20', '#1b1336', '#291c50', '#3a286c'];
  const SHEEN = [
    ['#23557e', '#2f8aa8', '#58c8cc', '#b4fff0'], // teal
    ['#2e3f8e', '#4466c8', '#7aa0f4', '#cce0ff'], // blue
    ['#4a2e92', '#7450cc', '#a888f4', '#e8d4ff'], // violet
    ['#682682', '#a8409e', '#e070c8', '#ffd0f0'], // magenta
  ];
  const VOID_ALL = new Set([...VOID_DARK, ...SHEEN.flat()]);
  /**
   * Iridescent void shading: the lower steps are the void; the lit steps take a
   * sheen band from an oil-slick phase (surface normal + position + noise), so
   * every curved surface shows teal → blue → violet → magenta swirls.
   * o: shade options + {sheen (0..1 share of the sheen steps used), gamma, seed}
   */
  function shadeVoid(m, o) {
    o = o || {};
    const out = G().pix(m.w, m.h);
    const nd = VOID_DARK.length, n = nd + 4, sheen = o.sheen == null ? 1 : o.sheen, gamma = o.gamma || 1.3;
    lightMask(m, o, (x, y, q) => {
      const f = Math.pow(Math.max(0, Math.min(0.999, q.v)), gamma) * n;
      let k = Math.floor(f);
      if ((x + y) % 2 && f - k > 0.72) k++;
      if (o.rim && q.edge && q.ny + q.nx * 0.5 > 0.1 && q.dot < 0.45) k += o.rim;
      k = Math.max(0, Math.min(n - 1, k));
      if (k < nd || sheen <= 0) { out.set(x, y, VOID_DARK[Math.min(k, nd - 1)]); return; }
      const ph = x * 0.035 - y * 0.025 + q.nx * 1.5 + q.ny * 0.8 + vnoise(x, y, 7, o.seed || 5) * 1.3;
      let b = (0.5 + 0.5 * Math.sin(ph * 2.1)) * 3.99;
      if ((x + y) % 2 && b - Math.floor(b) > 0.7) b = Math.min(3.99, b + 0.5);
      const s = Math.min(3, Math.floor((k - nd) * sheen));
      out.set(x, y, SHEEN[Math.floor(b)][s]);
    });
    return out;
  }
  /**
   * Void membrane: a starfield with drifting nebulae, glowing toward the
   * leading edge and deepening toward the trailing edge.
   * o: {seed, depthFn(x,y) → 0 (trailing) .. 1 (leading)}
   */
  function voidMembrane(m, o) {
    o = o || {};
    const out = G().pix(m.w, m.h), D = edt(m), seed = o.seed || 11;
    const BASE = ['#06040c', '#0c0818', '#150e2c', '#20163e', '#2c1e52'];
    const NEB_M = ['#34124a', '#541e6c', '#7c3490'], NEB_T = ['#0e3044', '#12506a', '#23808e'];
    m.each((x, y) => {
      const i = y * m.w + x;
      const t = o.depthFn ? o.depthFn(x, y) : 0.5;
      let k = Math.floor(t * 4.6 + ((x + y) % 2 ? 0.35 : 0));
      k = Math.max(0, Math.min(4, k));
      let c = BASE[k];
      const nm = fbm(x, y, seed) + t * 0.12, nt = fbm(x + 40, y - 17, seed + 3) + t * 0.1;
      if (nm > 0.6) c = NEB_M[Math.min(2, Math.floor((nm - 0.6) * 11 + ((x + y) % 2 ? 0.4 : 0)))];
      else if (nt > 0.62) c = NEB_T[Math.min(2, Math.floor((nt - 0.62) * 11 + ((x + y) % 2 ? 0.4 : 0)))];
      const hs = hash(x, y, seed + 21);
      if (D[i] > 1.5) {
        if (hs < 0.02) c = hs < 0.007 ? '#ffffff' : hs < 0.014 ? '#bfe8ff' : '#ffe6a8';
        else if (hs < 0.04) c = mix(c, '#9aa0d0', 0.4);
      }
      if (D[i] < 1) c = mix(c, '#000000', 0.35);
      out.set(x, y, c);
    });
    // a few four-point stars
    const r = rng(seed * 7 + 1);
    for (let k = 0, tries = 0; k < 3 && tries < 200; tries++) {
      const x = Math.floor(r() * m.w), y = Math.floor(r() * m.h);
      if (m.get(x, y) == null || D[y * m.w + x] < 3.5) continue;
      out.set(x, y, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.set(x + dx, y + dy, '#9ad8ff');
      k++;
    }
    return out;
  }

  const S = {};

  // ================================================================ boss_abyss
  // 深淵の王: a primordial chaos dragon-god. Three heads rise from one colossal
  // serpent body coiled on itself: the crowned central head with a gold diadem
  // of horns and a maw of radiant fire, a fire-breathing head on the left and a
  // frost-breathing head on the right, on swan-like necks. Its hide is
  // void-black with an iridescent oil-slick sheen, its wings and hood are torn
  // windows onto a starfield held by gold bones, and an open eye of chaos
  // stares out of its gold breastplate. 128x112. (In battle the top ~18 rows
  // sit behind the party windows: the faces are all below them; only the
  // crown and the wing tips reach up there.)
  S.boss_abyss = () => {
    const W = 128, H = 112, cx = 64;
    const L = [-0.45, -0.75, 0.55];
    const p = G().pix(W, H);
    const EMBER = ['#5a0e08', '#a8280c', '#e8601a', '#ffa838', '#ffe690', '#fffff0'];
    const FROST = ['#0c2a5a', '#1660a8', '#38a8e0', '#88e4ff', '#e0fcff', '#ffffff'];
    const RADIANT = ['#3a1a08', '#a05010', '#f0a030', '#ffe080', '#fffff0'];
    const PEARL = ['#241c3c', '#40365e', '#625886', '#8c84b0', '#bab4d8', '#ece8ff'];
    const DARKS = [...VOID_DARK];
    const goldPart = (fn, o) => part(W, H, fn, GOLD, Object.assign({ depth: 2, light: L, spec: 0.93 }, o || {}));
    const ivoryPart = (fn, o) => part(W, H, fn, IVORY, Object.assign({ depth: 1.4, light: L }, o || {}));
    const voidPart = (fn, o) => { const m = mask(W, H); fn(m); return shadeVoid(m, Object.assign({ depth: 4, light: L }, o || {})); };
    const claw = (x0, y0, x1, y1, xc, yc, r) => put(p, ivoryPart((g) => tube(g, [[x0, y0], [xc, yc], [x1, y1]], r || 1.6, 0.3, 1, 10)), 'dark');
    const fang = (x, y, len, dir, w) => {
      for (let k = 0; k < len; k++) {
        const hw = Math.max(0, Math.round(w * (1 - k / len)));
        for (let d = -hw; d <= hw; d++) p.set(x + d, y + dir * k, k === len - 1 ? IVORY[3] : d < 0 ? WHITE : IVORY[4]);
      }
    };

    // --- wings: thin gold bones, torn starfield membranes with a scalloped edge
    both(W, (X, s) => {
      const S0 = [50, 62], E = [34, 30], Wr = [13, 6];
      const tips = [[1, 21], [1, 39], [5, 55], [16, 67]];
      const poly = [S0, E, Wr];
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i], prev = i ? tips[i - 1] : Wr, k = i ? 0.2 : 0.05;
        const mx = (prev[0] + t[0]) / 2, my = (prev[1] + t[1]) / 2;
        poly.push([mx + (S0[0] - mx) * k, my + (S0[1] - my) * k], t);
      }
      poly.push([30, 68], [40, 68]);
      const m = mask(W, H);
      m.poly(poly.map(([x, y]) => [X(x), y]), 1);
      for (const [hx, hy, r] of [[12, 48, 1.8], [7, 31, 1.4], [19, 60, 1.5]]) m.ellipse(X(hx), hy, r, r * 0.8, null);
      put(p, voidMembrane(m, { seed: s > 0 ? 11 : 17, depthFn: (x, y) => Math.max(0, 1 - Math.hypot(x - X(Wr[0] + 8), y - Wr[1] - 6) / 56) }), 'dark');
      const bm = mask(W, H);
      cap(bm, X(S0[0]), S0[1], X(E[0]), E[1], 2.6, 2);
      cap(bm, X(E[0]), E[1], X(Wr[0]), Wr[1], 2, 1.6);
      for (const t of tips) tube(bm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 3), (Wr[1] + t[1]) / 2], [X(t[0]), t[1]]], 0.9, 0.35, 1, 14);
      put(p, shade(bm, GOLD, { depth: 1.4, light: L, bias: -0.04 }), 'dark');
      put(p, goldPart((g) => g.circle(X(E[0]), E[1], 2.2, 1), { depth: 1.4 }), 'dark');
      claw(X(Wr[0]), Wr[1], X(Wr[0] + 6), Wr[1] - 5, X(Wr[0] + 4), Wr[1] - 1, 1.5);
      claw(X(E[0]), E[1] - 2, X(E[0] + 2), E[1] - 9, X(E[0] + 2), E[1] - 5, 1.4);
    });

    // --- the hood: a starfield frill fanned out behind the central head, gold-ribbed
    {
      const hc = [cx, 42], R0 = 24;
      const hm = mask(W, H);
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const a = Math.PI + (k / 60) * Math.PI, sc = 1 - 0.09 * Math.abs(Math.sin(k / 60 * Math.PI * 6));
        pts.push([hc[0] + Math.cos(a) * R0 * sc * 1.08, hc[1] + Math.sin(a) * R0 * sc * 0.92]);
      }
      pts.push([hc[0] + 18, 58], [hc[0] - 18, 58]);
      hm.poly(pts, 1);
      put(p, voidMembrane(hm, { seed: 23, depthFn: (x, y) => Math.max(0, 0.95 - Math.hypot(x - hc[0], y - hc[1]) / 34) }), 'dark');
      const rb = mask(W, H);
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (1.08 + k * 0.84 / 6);
        cap(rb, hc[0] + Math.cos(a) * 13, hc[1] + Math.sin(a) * 12, hc[0] + Math.cos(a) * (R0 + 2.5), hc[1] + Math.sin(a) * (R0 + 1.5), 1.1, 0.4);
      }
      put(p, shade(rb, GOLD, { depth: 1, light: L, bias: 0.04 }), 'dark');
    }

    // --- coils behind the torso
    const coilBack = mask(W, H);
    tube(coilBack, [[20, 100], [30, 88], [64, 92], [108, 92]], 8, 7.5, 1, 30);
    const cb = shadeVoid(coilBack, { depth: 5, light: L, bias: -0.1, seed: 21, sheen: 0.7 });
    scales(cb, DARKS, 4, 3, { lit: 0 });
    put(p, cb, 'dark');

    // --- side necks (swan curve out of the shoulders) and heads: fire left, frost right
    both(W, (X, s) => {
      const breath = s > 0 ? EMBER : FROST;
      const np = [[X(50), 70], [X(30), 84], [X(18), 70], [X(22), 58]];
      const nk = mask(W, H);
      tube(nk, np, 7, 5, 1, 30);
      const neck = shadeVoid(nk, { depth: 4, light: L, seed: 3 + s });
      scales(neck, DARKS, 4, 3, { lit: 0 });
      // throat scutes along the inner curve
      const tp = [[X(48), 74.5], [X(30.5), 88.5], [X(13.5), 72], [X(18), 60]];
      for (let i = 2; i < 18; i++) {
        const q = bez(tp, i / 18), q2 = bez(tp, (i + 0.5) / 18);
        on(neck, q[0], q[1], PEARL[3]); on(neck, q2[0], q2[1], PEARL[2]);
      }
      // a gold ring where the neck leaves the body
      const q = bez(np, 0.16);
      put(neck, goldPart((g) => cap(g, q[0] - 2, q[1] - 5.5, q[0] + 2, q[1] + 5.5, 1.4, 1.4), { depth: 1 }), 'dark');
      put(p, neck, 'dark');
      // swept horns, gold
      for (const [bx, by, mx, my, tx, ty, r] of [[26, 44, 28, 34, 34, 27, 2.5], [18, 46, 11, 42, 6, 34, 2]]) {
        put(p, goldPart((g) => tube(g, [[X(bx), by], [X(mx), my], [X(tx), ty]], r, 0.4, 1, 14)), 'dark');
      }
      // skull: broad brow, snout coming down toward the viewer
      const hm = mask(W, H);
      hm.ellipse(X(22), 50, 8.5, 7, 1);
      hm.poly([[X(14.5), 51], [X(29.5), 51], [X(27), 60], [X(22), 64], [X(17), 60]], 1);
      const head = shadeVoid(hm, { depth: 3.5, light: L, normal: sphereN(X(21), 50, 10, 11), blend: 0.4, seed: 7 + s });
      put(p, head, 'dark');
      put(p, ivoryPart((g) => tube(g, [[X(15), 55], [X(10), 55], [X(7), 50]], 1.6, 0.3, 1, 10)), 'dark');
      put(p, goldPart((g) => g.poly([[X(14.5), 46], [X(22), 43.5], [X(29.5), 46], [X(26.5), 50], [X(22), 51], [X(17.5), 50]], 1), { depth: 1.2 }), 'dark');
      // maw open, breath glowing inside
      const mw = mask(W, H);
      mw.poly([[X(16.5), 57], [X(27.5), 57], [X(26), 63], [X(22), 65.5], [X(18), 63]], 1);
      const th = G().pix(W, H);
      mw.each((x, y) => { const d = Math.hypot((x - X(22)) / 4.5, (y - 61.5) / 3.2); th.set(x, y, breath[Math.max(0, Math.min(5, Math.floor(5.7 - d * 3.6)))]); });
      put(p, th, INK);
      const lx = Math.min(X(16.5), X(27.5));
      for (const [dx, l] of [[0, 3], [2, 2], [4, 1], [7, 1], [9, 2], [11, 3]]) fang(lx + dx, 57, l, 1, 0);
      put(p, voidPart((g) => g.poly([[X(17), 65], [X(27), 65], [X(25), 68], [X(22), 69], [X(19), 68]], 1), { depth: 1.5, seed: 9 }), 'dark');
      // eyes glowing with the breath colour, slanted toward the snout
      for (const ex of [17.5, 26.5]) {
        const x0 = Math.min(X(ex - 1.5), X(ex + 1.5));
        const inner = (ex > 22) === (s > 0);
        stamp(p, x0, 52, inner ? ['kk..', 'eEEk', '.kkk'] : ['..kk', 'kEEe', 'kkk.'], { k: INK, e: breath[3], E: breath[5] });
      }
      on(p, X(22), 45, breath[4]); on(p, X(22), 46, breath[2]);
    });

    // --- torso
    const tm = mask(W, H);
    tm.ellipse(cx, 78, 19, 16, 1);
    tm.ellipse(cx, 66, 23, 8, 1);
    tm.poly([[48, 86], [80, 86], [76, 98], [52, 98]], 1);
    const torso = shadeVoid(tm, { depth: 9, light: L, normal: sphereN(cx - 3, 72, 26, 26), blend: 0.35, seed: 31 });
    scales(torso, DARKS, 6, 4, { lit: 0 });
    put(p, torso, 'dark');

    // --- breastplate: gold pectoral armour framing the eye of chaos
    both(W, (X) => {
      const pl = mask(W, H);
      pl.poly([[X(44), 65], [X(60), 65], [X(62), 73], [X(57), 83], [X(48), 80], [X(42), 71]], 1);
      const pp = shade(pl, GOLD, { depth: 3, light: L, spec: 0.94 });
      curve(pp, [[X(45), 66], [X(52), 66], [X(59), 66.5]], GOLD[6]);
      curve(pp, [[X(46), 73], [X(51), 77], [X(57), 80]], GOLD[1]);
      on(pp, X(47), 69, WHITE); on(pp, X(48), 69, GOLD[6]);
      put(p, pp, 'dark');
    });
    {
      const setm = mask(W, H);
      setm.poly([[cx, 63], [cx + 7.5, 72], [cx, 85], [cx - 7.5, 72]], 1);
      put(p, shade(setm, GOLD, { depth: 2.2, light: L, spec: 0.9 }), 'dark');
      const em = mask(W, H);
      for (let y = 65; y <= 81; y++) {
        const t = (y - 73) / 8, hw = 4.8 * Math.sqrt(Math.max(0, 1 - t * t));
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) em.set(x, y, 1);
      }
      const eye = G().pix(W, H);
      const IRIS = ['#ff5a8a', '#ffb050', '#f8f070', '#70f0a0', '#58d8ff', '#8a78ff', '#e070ff'];
      em.each((x, y) => {
        const dx = (x - cx) / 4.8, dy = (y - 73) / 8, d = Math.hypot(dx, dy);
        let c = IRIS[Math.floor(((Math.atan2(dy, dx) / (Math.PI * 2) + 1) * 7 + d * 2.2)) % 7];
        if (d > 0.8) c = dk(c, 0.5);
        else if (d < 0.35) c = mix(c, '#ffffff', 0.3);
        eye.set(x, y, c);
      });
      put(p, eye, INK);
      for (let y = 67; y <= 79; y++) { p.set(cx, y, '#050308'); if (y > 69 && y < 77) p.set(cx - 1, y, '#050308'); }
      p.set(cx - 3, 68, WHITE); p.set(cx - 2, 68, WHITE); p.set(cx - 3, 69, WHITE); p.set(cx + 2, 78, '#e8f0ff');
    }

    // --- coils in front: the body wraps round the base, the tail rising at the right
    const fa = [[32, 95], [12, 92], [12, 105], [44, 103]], fb = [[44, 103], [66, 98], [96, 106], [113, 93]], ft = [[113, 93], [125, 83], [119, 70]];
    const coilFront = mask(W, H);
    tube(coilFront, fa, 5.5, 6.5, 1, 24);
    tube(coilFront, fb, 6.5, 5.8, 1, 26);
    tube(coilFront, ft, 5.8, 2.4, 1, 18);
    const cf = shadeVoid(coilFront, { depth: 4.5, light: L, bias: -0.02, seed: 41 });
    scales(cf, DARKS, 5, 3, { lit: 0 });
    for (const seg of [fa, fb]) for (let i = 1; i < 14; i++) {
      const q = bez(seg, i / 14);
      if (q[0] < 18) continue;
      on(cf, q[0], q[1] + 4, PEARL[3]); on(cf, q[0] + 1, q[1] + 4, PEARL[2]); on(cf, q[0], q[1] + 5, PEARL[1]);
    }
    // gold rings clasped round the coil: a band bowed along the body, lit on top
    const ring = (seg, t, r) => {
      const q = bez(seg, t), q2 = bez(seg, Math.min(1, t + 0.02));
      let tx = q2[0] - q[0], ty = q2[1] - q[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty, ny = tx;
      for (let s = -r; s <= r; s += 0.35) {
        const u = s / r, bow = 1.6 * (1 - u * u);
        const k = u < -0.55 ? 5 : u < -0.1 ? 4 : u < 0.45 ? 3 : 2;
        for (let w = -1; w <= 1; w++) {
          const x = q[0] + nx * s + tx * (bow + w), y = q[1] + ny * s + ty * (bow + w);
          on(cf, x, y, w === 1 ? GOLD[1] : w === -1 ? GOLD[Math.min(6, k + 1)] : GOLD[k]);
        }
      }
    };
    ring(fa, 0.74, 6.5); ring(fb, 0.46, 6.5); ring(fb, 0.82, 5.8);
    put(p, cf, 'dark');
    put(p, goldPart((g) => { g.poly([[119, 72], [112, 65], [115, 54], [121, 62], [124, 72]], 1); }, { depth: 1.8 }), 'dark');
    for (const t of [0.3, 0.62, 0.88]) {
      const q = bez(fb, t);
      put(p, ivoryPart((g) => g.poly([[q[0] - 2, q[1] - 4], [q[0] + 2, q[1] - 4], [q[0] + 0.5, q[1] - 9]], 1)), 'dark');
    }

    // --- central neck with a gold gorget
    const nk = mask(W, H);
    nk.poly([[55, 68], [73, 68], [72, 52], [56, 52]], 1);
    const neck = shadeVoid(nk, { depth: 5, light: L, normal: cylN(cx - 1, 10), blend: 0.4, seed: 71 });
    scales(neck, DARKS, 4, 3, { lit: 0 });
    put(neck, goldPart((g) => { g.poly([[53, 61], [75, 61], [74, 66], [cx, 68], [54, 66]], 1); }, { depth: 1.5 }), 'dark');
    for (let x = 56; x <= 72; x += 3) on(neck, x, 63, GOLD[6]);
    put(p, neck, 'dark');

    // --- great horns: a gold diadem of swept horns and crown points
    both(W, (X) => {
      const pts = [[X(55), 30], [X(43), 26], [X(36), 16], [X(38), 1]];
      const hn = mask(W, H); tube(hn, pts, 4.4, 0.6, 1, 26);
      const h = shade(hn, GOLD, { depth: 2.4, light: L, spec: 0.93 });
      for (let i = 1; i < 8; i++) { const q = bez(pts, i / 8); on(h, q[0], q[1] + 2, GOLD[1]); on(h, q[0] + 1, q[1] + 2, GOLD[2]); }
      put(p, h, 'dark');
      put(p, goldPart((g) => tube(g, [[X(52), 35], [X(43), 35], [X(37), 30]], 2.4, 0.4, 1, 14)), 'dark');
    });
    for (const [bx, tx, ty, r] of [[cx, cx, 7, 2.6], [cx - 6, cx - 9, 13, 2], [cx + 6, cx + 9, 13, 2]]) put(p, goldPart((g) => cap(g, bx, 27, tx, ty, r, 0.3)), 'dark');

    // --- central head: broad crowned skull, four eyes, a maw of radiant fire
    const hm = mask(W, H);
    hm.ellipse(cx, 35, 14, 10.5, 1);
    hm.poly([[50, 35], [78, 35], [75, 46], [71, 53], [57, 53], [53, 46]], 1);
    const head = shadeVoid(hm, { depth: 5, light: L, normal: sphereN(cx - 2, 35, 15, 14), blend: 0.35, seed: 81, bias: 0.08, gamma: 1.1 });
    put(p, head, 'dark');
    const dm = mask(W, H);
    dm.poly([[51, 31], [cx, 25.5], [77, 31], [75, 34], [cx, 29.5], [53, 34]], 1);
    put(p, shade(dm, GOLD, { depth: 1.2, light: L, spec: 0.9 }), 'dark');
    stamp(p, cx - 2, 25, ['.kk.', 'kcCk', 'kbck', '.kk.'], { k: INK, c: '#58c8cc', C: '#e8fff8', b: '#2f8aa8' });
    both(W, (X) => { put(p, ivoryPart((g) => tube(g, [[X(54), 47], [X(47), 47], [X(42), 42]], 2.4, 0.4, 1, 14)), 'dark'); });
    const jaw = mask(W, H);
    jaw.poly([[55, 55], [73, 55], [70, 62], [cx, 65], [58, 62]], 1);
    put(p, shadeVoid(jaw, { depth: 2.2, light: L, bias: -0.02, seed: 83 }), 'dark');
    const mw = mask(W, H);
    mw.poly([[56, 49], [72, 49], [70, 58], [cx, 60], [58, 58]], 1);
    const throat = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - cx) / 6.5, (y - 55.5) / 4); throat.set(x, y, d < 0.42 ? RADIANT[4] : d < 0.7 ? RADIANT[3] : d < 1 ? RADIANT[2] : d < 1.3 ? RADIANT[1] : '#1a0a06'); });
    put(p, throat);
    for (const [x, l, w] of [[57, 6, 1], [60, 3, 0], [62, 3, 0], [66, 3, 0], [68, 3, 0], [71, 6, 1]]) fang(x, 49, l, 1, w);
    for (const [x, l, w] of [[59, 4, 1], [cx, 3, 0], [69, 4, 1]]) fang(x, 59, l, -1, w);
    for (let y = 39; y <= 45; y++) { on(p, cx - 1, y, SHEEN[1][3]); on(p, cx, y, SHEEN[2][1]); }
    stamp(p, cx - 4, 45, ['kk....kk', '.k....k.'], { k: INK });
    both(W, (X) => {
      const em = mask(W, H);
      em.poly([[X(51.5), 36.5], [X(61.5), 39], [X(59.5), 42.5], [X(53.5), 41.5]], 1);
      const eye = G().pix(W, H);
      em.each((x, y) => { eye.set(x, y, y <= 38 ? '#ffffff' : y <= 39 ? '#fff6b0' : y <= 40 ? '#ffd040' : '#e08a18'); });
      put(p, eye, INK);
      p.line(X(51), 36, X(62), 39, INK); p.line(X(51), 37, X(51), 38, INK);
      p.vline(X(57), 38, 41, INK);
      const ex = Math.min(X(55), X(56));
      p.set(ex, 33, '#fff8d0'); p.set(ex + 1, 33, '#ffe680'); p.set(ex, 34, '#ffd040'); p.set(ex + 1, 34, '#e08a18');
    });

    // --- rim light on the outer silhouette: teal from the left, magenta from the right, violet below
    edgeLight(p, { src: (c) => VOID_ALL.has(c), nb: (c) => c == null, dirs: [{ d: [-1, 0], c: SHEEN[0][2] }, { d: [1, 0], c: SHEEN[3][2] }, { d: [0, 1], c: SHEEN[2][1] }] });

    return finish(p, { free: true, post: (q) => {
      for (const [x, y, r, c] of [[3, 82, 2, '#b4fff0'], [124, 40, 1, '#ffd0f0'], [8, 96, 1, '#cce0ff'], [3, 8, 1, '#fff8d0'], [124, 12, 2, '#fff8d0'], [100, 110, 1, '#e8d4ff']]) sparkle(q, x, y, r, c, WHITE);
    } });
  };

  // ================================================================ rare_prism
  // A living prism: a hexagonal crystal with pointed ends floating upright,
  // every facet splitting the light into a rainbow, a shy little face on the
  // front facet, two crystal shards orbiting it like hands and a crown of
  // small points. Sparkles all round: it should read as "rare" at a glance. 48x48.
  S.rare_prism = () => {
    const W = 48, H = 48;
    const p = G().pix(W, H);
    const Lx = -0.55, Ly = -0.7;
    /**
     * Paint a convex facet polygon: hue sweeps diagonally across the whole
     * crystal (a rainbow), brightness from the facet's fake normal and a soft
     * gradient along the facet; dithered between steps.
     */
    const facet = (pts, n, o) => {
      o = o || {};
      const m = mask(W, H); m.poly(pts, 1);
      const lit = Math.max(0, n[0] * Lx + n[1] * Ly + (n[2] || 0.6) * 0.62);
      // posterised: 12 hue steps and 5 value steps (SFC-style palette), dithered at the seams
      m.each((x, y) => {
        let hq = ((o.hue0 || 0) + x * 5.5 + y * 4.2) / 30;
        if ((x + y) % 2 && hq % 1 > 0.6) hq += 0.5;
        const v = 0.6 + lit * 0.4 + (o.grad ? ((y - o.grad[0]) / o.grad[1]) * 0.12 : 0);
        const vq = Math.min(5, Math.floor(v * 5)) / 5;
        const s = 0.78 - vq * 0.42;
        p.set(x, y, fromHsv(Math.floor(hq) * 30, Math.max(0.12, s), Math.min(1, vq + 0.02)));
      });
      return m;
    };
    const edge = (x0, y0, x1, y1, c) => p.line(x0, y0, x1, y1, c);
    const cx = 24;
    // body: a hexagonal prism, three faces visible, pointed top and bottom
    const T = [cx, 4], B = [cx, 44];
    const yl = 14, yb = 33; // shoulder and hip lines
    const xL = 12, xl = 18.5, xr = 29.5, xR = 36;
    facet([T, [xL, yl], [xl, yl + 2]], [-0.8, -0.6, 0.5], { grad: [4, 12] });
    facet([T, [xl, yl + 2], [xr, yl + 2]], [0, -0.8, 0.7], { grad: [4, 12] });
    facet([T, [xr, yl + 2], [xR, yl]], [0.8, -0.5, 0.3], { grad: [4, 12] });
    facet([[xL, yl], [xl, yl + 2], [xl, yb + 2], [xL, yb]], [-0.9, 0, 0.4], { grad: [yl, 20] });
    facet([[xl, yl + 2], [xr, yl + 2], [xr, yb + 2], [xl, yb + 2]], [-0.1, 0, 1], { grad: [yl, 20] });
    facet([[xr, yl + 2], [xR, yl], [xR, yb], [xr, yb + 2]], [0.9, 0.1, 0.3], { grad: [yl, 20] });
    facet([[xL, yb], [xl, yb + 2], B], [-0.6, 0.7, 0.3], { grad: [yb, 10] });
    facet([[xl, yb + 2], [xr, yb + 2], B], [0, 0.8, 0.5], { grad: [yb, 10] });
    facet([[xr, yb + 2], [xR, yb], B], [0.6, 0.8, 0.1], { grad: [yb, 10] });
    // facet edges: bright on the lit side, darker on the shaded side
    const HI = '#ffffff', MID = '#e8f4ff', LO = '#8a7ab8';
    edge(xl, yl + 2, xl, yb + 2, MID); edge(xr, yl + 2, xr, yb + 2, LO);
    edge(xL, yl, T[0], T[1], HI); edge(xl, yl + 2, T[0], T[1], MID); edge(xr, yl + 2, T[0], T[1], LO);
    edge(xL, yl, xl, yl + 2, HI); edge(xl, yl + 2, xr, yl + 2, MID); edge(xr, yl + 2, xR, yl, LO);
    edge(xL, yb, xl, yb + 2, MID); edge(xl, yb + 2, xr, yb + 2, LO); edge(xr, yb + 2, xR, yb, LO);
    edge(xl, yb + 2, B[0], B[1], LO);
    // inner fire: refracted streaks crossing the front face
    for (const [x0, y0, x1, y1, c] of [[20, 30, 27, 22, '#ffffff'], [21, 32, 28, 25, '#fff0c0'], [13, 28, 17, 20, '#ffffff'], [31, 30, 34, 24, '#e0d0ff']]) edge(x0, y0, x1, y1, c);
    // face: big shy eyes with two highlights, a blush and a small smile
    for (const ex of [20, 26]) {
      stamp(p, ex, 20, ['.kk.', 'kwkk', 'kkwk', 'kkkk', '.kk.'], { k: '#2a1a4a', w: WHITE });
      p.set(ex - 1, 25, '#ff9ac8'); p.set(ex, 25, '#ffb8d8'); p.set(ex + 3, 25, '#ffb8d8'); p.set(ex + 4, 25, '#ff9ac8');
    }
    stamp(p, 22, 26, ['k..k', '.kk.'], { k: '#2a1a4a' });
    // crown: three small points on the top
    // a small pointed crystal (hexagonal prism seen from the front, tilted by 'lean')
    const small = (bx, by, h, w, hue, lean) => {
      const tip = [bx + lean, by - h], bot = [bx - lean * 0.4, by + w * 1.2];
      const sh = by - h + w * 1.6;
      const faces = [
        [[tip, [bx - w + lean * 0.7, sh], [bx - w, by], bot], 0.95],
        [[tip, bot, [bx + w, by], [bx + w + lean * 0.7, sh]], 0.62],
      ];
      for (const [pts, l] of faces) {
        const m = mask(W, H); m.poly(pts, 1);
        m.each((x, y) => p.set(x, y, fromHsv(hue + Math.floor((y - by) / 3) * 30, 0.34, l)));
      }
      p.line(Math.round(tip[0]), Math.round(tip[1]), Math.round(bot[0]), Math.round(bot[1]) - 1, '#ffffff');
    };
    // orbiting shards (hands) and loose chips
    small(6, 30, 12, 3, 300, -1.5); small(42, 26, 12, 3, 180, 1.5);
    small(9, 11, 6, 1.8, 30, -1); small(39, 8, 5, 1.6, 120, 1);
    p.outline(OUT);
    const out = finish(p, { float: false, free: true, post: (q) => {
      for (const [x, y, r, c] of [[3, 4, 2, '#ffe6a8'], [44, 16, 2, '#b4fff0'], [4, 42, 1, '#ffd0f0'], [44, 40, 2, '#e8d4ff'], [30, 2, 1, '#ffffff'], [16, 44, 1, '#cce0ff']]) sparkle(q, x, y, r, c, WHITE);
      for (const [x, y, c] of [[2, 20, '#ffb0ec'], [46, 32, '#a8f0ff'], [14, 3, '#fff8d0'], [36, 45, '#d2b0ff']]) q.set(x, y, c);
    } });
    return out;
  };

  // ================================================================ void_wraith
  // A spectral knight made of the void: a horned great helm whose visor burns
  // with two cold eyes, heavy spiked pauldrons over an empty cuirass split open
  // onto a starfield, a long sword of darkness raised with edges of ghost
  // light, a clawed gauntlet cupping a wisp, and no legs: a torn cloak that
  // dissolves into ghost-flame at the hem. 48x48.
  S.void_wraith = () => {
    const W = 48, H = 48;
    const L = [-0.5, -0.75, 0.6];
    const p = G().pix(W, H);
    const steel = ramp('#5a6690', 7, { dark: 0.8, light: 0.72, shift: 18 });
    const cloak = ramp('#3e3268', 6, { dark: 0.82, light: 0.45 });
    const trim = ramp('#b09058', 5, { dark: 0.6, light: 0.6 });
    const hornR = ramp('#d8d0bc', 5, { dark: 0.6, shift: 30 });
    const ghost = ['#18406a', '#2878a8', '#40b8e8', '#90ecff', '#e8ffff'];

    // cloak: flaring from the waist, torn into points that burn away as ghost-flame
    const cm = mask(W, H);
    cm.poly([[15, 27], [33, 27], [40, 38], [42, 46], [37, 41], [34, 46], [30, 40], [26, 46], [22, 40], [18, 46], [14, 40], [10, 46], [7, 38]], 1);
    const cl = shade(cm, cloak, { depth: 3, light: L, normal: cylN(23, 18), blend: 0.5 });
    // folds
    for (const [x0, x1] of [[16, 12], [21, 20], [27, 28], [32, 36]]) curve(cl, [[x0, 30], [(x0 + x1) / 2 + 0.5, 37], [x1, 43]], cloak[0]);
    for (const [x0, x1] of [[18, 15], [30, 33]]) curve(cl, [[x0, 30], [(x0 + x1) / 2, 36], [x1, 41]], cloak[3]);
    put(p, cl, 'dark');
    // the hollow inside the cloak: void showing through the front opening
    const inner = mask(W, H); inner.poly([[20, 29], [28, 29], [30, 40], [26, 45], [24, 39], [22, 45], [18, 40]], 1);
    put(p, voidMembrane(inner, { seed: 31, depthFn: (x, y) => Math.max(0, 1 - (y - 29) / 16) }), 'dark');
    // ghost flame licking up from the torn hem
    for (const [x, y, h] of [[10, 46, 4], [18, 46, 4], [26, 46, 5], [34, 46, 4], [42, 46, 4], [14, 40, 2], [22, 40, 2], [30, 40, 2], [37, 41, 2]]) {
      for (let k = 0; k < h; k++) on(p, x + (k % 2 ? (x < 24 ? 1 : -1) : 0), y - k, ghost[Math.min(4, 1 + k)]);
    }

    // cuirass: an empty shell split open down the middle onto the void
    const cu = mask(W, H);
    cu.poly([[15, 18], [33, 18], [32, 26], [28, 31], [20, 31], [16, 26]], 1);
    put(p, shade(cu, steel, { depth: 3.5, light: L, normal: sphereN(23, 22, 11, 11), blend: 0.35, spec: 0.93, bias: 0.06 }), 'dark');
    const gap = mask(W, H); gap.poly([[22, 18], [26, 18], [25.5, 25], [24, 30], [22.5, 25]], 1);
    put(p, voidMembrane(gap, { seed: 41, depthFn: () => 0.9 }), 'dark');
    both(W, (X) => { curve(p, [[X(17), 23], [X(19.5), 25.5], [X(21), 26]], steel[1]); on(p, X(17), 20, steel[6]); on(p, X(18), 20, steel[5]); });
    // belt with a ghost-lit clasp
    put(p, part(W, H, (g) => g.poly([[16, 27], [32, 27], [31, 30], [17, 30]], 1), trim, { depth: 1, light: L }), 'dark');
    stamp(p, 22, 27, ['kggk', 'kgGk', '.kk.'], { k: INK, g: ghost[2], G: ghost[4] });

    // gauntlet reaching out (screen right), a wisp of ghost-flame cupped in the claws
    put(p, part(W, H, (g) => { cap(g, 33, 22, 38, 29, 3.2, 2.8); }, steel, { depth: 2.2, light: L }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(39.5, 31, 3.2, 2.7, 1), steel, { depth: 2, light: L, bias: 0.05 }), 'dark');
    for (const [x1, y1] of [[36, 36], [39.5, 36.5], [43, 34]]) put(p, part(W, H, (g) => cap(g, 39.5, 32, x1, y1, 1.1, 0.4), steel, { depth: 1, light: L, bias: 0.1 }), 'dark');
    const wisp = mask(W, H); tube(wisp, [[41, 29], [45, 25], [42, 19]], 2.8, 0.6, 1, 12);
    const wf = G().pix(W, H);
    wisp.each((x, y) => { const d = Math.hypot(x - 41.5, y - 27.5); wf.set(x, y, ghost[Math.max(1, Math.min(4, Math.floor(4.6 - d * 0.45 - (x > 43 ? 1 : 0))))]); });
    put(p, wf, ghost[0]);

    // pauldrons: two layered plates each, spiked
    both(W, (X) => {
      put(p, part(W, H, (g) => cap(g, X(12), 17, X(6), 8, 2, 0.3), steel, { depth: 1.2, light: L, bias: 0.12 }), 'dark');
      for (const [y, rx, ry, b] of [[18, 7, 4.5, 0], [21.5, 5.5, 3, -0.08]]) {
        put(p, part(W, H, (g) => g.ellipse(X(13), y, rx, ry, 1), steel, { depth: 2.5, light: L, bias: b, normal: sphereN(X(12), y - 1.5, rx + 1, ry + 1.5), blend: 0.3, spec: 0.95 }), 'dark');
      }
      p.line(X(7), 20, X(13), 21, trim[3]); p.line(X(8), 21, X(12), 22, trim[1]);
    });

    // sword: raised diagonally, a blade of darkness with ghost-lit edges
    const bl = mask(W, H);
    bl.poly([[12, 29], [15, 27], [5, 3], [3, 1], [3, 5]], 1);
    const blade = G().pix(W, H);
    bl.each((x, y) => blade.set(x, y, hash(x, y, 4) < 0.1 ? '#4a3a7a' : '#140c24'));
    for (let y = 3; y <= 27; y++) {
      const t = (y - 3) / 24, xl = Math.round(3.5 + t * 8.5), xr = Math.round(4.5 + t * 10.5);
      on(blade, xl, y, y % 6 === 0 ? ghost[4] : ghost[3]); on(blade, xr, y, ghost[1]);
    }
    put(p, blade, 'dark');
    put(p, part(W, H, (g) => cap(g, 9.5, 28.5, 17, 25.5, 1.3, 1.3), trim, { depth: 1, light: L, spec: 0.9 }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(14, 29.5, 3, 2.6, 1), steel, { depth: 2, light: L }), 'dark');
    stamp(p, 11, 26, ['g'], { g: ghost[3] });

    // helm: horned great helm with cheek guards, a T visor burning with ghost-light
    both(W, (X) => {
      const hn = mask(W, H); tube(hn, [[X(19), 8], [X(13), 6], [X(10), 0.5]], 2, 0.4, 1, 12);
      put(p, shade(hn, hornR, { depth: 1.2, light: L }), 'dark');
    });
    const hm = mask(W, H);
    hm.ellipse(24, 10, 6.5, 6.5, 1);
    hm.poly([[17.5, 10], [30.5, 10], [30, 17], [26.5, 20], [21.5, 20], [18, 17]], 1);
    hm.poly([[23, 1], [25, 1], [26, 6], [22, 6]], 1);
    const helm = shade(hm, steel, { depth: 3.5, light: L, normal: sphereN(23, 10, 8, 10), blend: 0.35, spec: 0.94 });
    for (let y = 2; y <= 10; y++) on(helm, 23, y, steel[6]);
    for (const [x, y] of [[19, 16], [28, 16], [21, 19], [26, 19]]) on(helm, x, y, steel[5]);
    put(p, helm, 'dark');
    for (let x = 18; x <= 30; x++) p.set(x, 11, '#07050e');
    for (let y = 11; y <= 18; y++) { p.set(23, y, '#07050e'); p.set(24, y, '#07050e'); }
    for (let x = 18; x <= 30; x++) p.set(x, 12, '#07050e');
    stamp(p, 19, 11, ['eEEe'], { e: ghost[3], E: ghost[4] });
    stamp(p, 25, 11, ['eEEe'], { e: ghost[3], E: ghost[4] });
    for (const x of [20, 27]) { p.set(x, 12, ghost[2]); p.set(x + 1, 12, ghost[2]); }

    return finish(p, { free: true, post: (q) => {
      // ghost-light trailing up from the eyes and a few loose motes
      for (const [x, y, c] of [[20, 9, ghost[3]], [19, 8, ghost[2]], [28, 9, ghost[3]], [29, 8, ghost[2]], [45, 17, ghost[3]], [2, 38, ghost[2]], [46, 42, ghost[2]]]) q.set(x, y, c);
    } });
  };

  // ================================================================ chaos_beast
  // A multi-eyed chaos behemoth: a hunched mountain of muscle, its broad face
  // split by a fanged maw and studded with seven eyes of every size, great
  // horns sweeping up from the crown, chitin plates and crystal growths on the
  // shoulders, forelegs like pillars ending in hooked claws. 64x64.
  S.chaos_beast = () => {
    const W = 64, H = 64, cx = 32;
    const L = [-0.5, -0.75, 0.6];
    const p = G().pix(W, H);
    const hide = ramp('#7a3e84', 7, { dark: 0.8, light: 0.62 });
    const plate = ramp('#3c2e58', 6, { dark: 0.75, light: 0.6 });
    const bone = ramp('#d6c8a8', 6, { dark: 0.66, shift: 30 });
    const belly = ramp('#c07a98', 5, { dark: 0.6, light: 0.6 });
    const EYE = ['#7a4a08', '#d0a018', '#ffe040', '#fff8c0'];
    const MAW = ['#2a0610', '#5a1020', '#9a2030', '#e04850', '#ff9080'];
    const crystal = ['#2e2470', '#4a50c0', '#7aa0f0', '#c8e8ff'];

    // hind bulk behind the shoulders
    put(p, part(W, H, (g) => { g.ellipse(cx, 36, 28, 14, 1); }, hide, { depth: 7, light: L, bias: -0.14 }), 'dark');
    // crystal growths along the back
    for (const [bx, by, tx, ty, r] of [[11, 30, 3, 19, 2.6], [16, 26, 11, 13, 2.4], [48, 26, 53, 13, 2.4], [53, 30, 61, 19, 2.6]]) {
      const cm = mask(W, H); cap(cm, bx, by, tx, ty, r, 0.3);
      const c = shade(cm, crystal, { depth: 1.2, light: L, flat: 0.5 });
      put(p, c, 'dark');
      p.line(Math.round(bx + (tx - bx) * 0.2 - 0.5), Math.round(by + (ty - by) * 0.2), Math.round(tx), Math.round(ty) + 1, crystal[3]);
    }
    // shoulders: two great humps armoured with chitin
    both(W, (X) => {
      put(p, part(W, H, (g) => g.ellipse(X(15), 35, 13, 12, 1), hide, { depth: 7, light: L, normal: sphereN(X(13), 32, 14, 14), blend: 0.35 }), 'dark');
      const pm = mask(W, H); pm.ellipse(X(13), 30, 9, 6.5, 1);
      const pl = shade(pm, plate, { depth: 3, light: L, spec: 0.95 });
      curve(pl, [[X(6), 32], [X(13), 28], [X(20), 31]], plate[5]);
      curve(pl, [[X(6), 34], [X(13), 31], [X(20), 34]], plate[1]);
      put(p, pl, 'dark');
      // a lone eye on the shoulder
      put(p, part(W, H, (g) => g.ellipse(X(9), 38, 2.2, 1.8, 1), EYE, { depth: 1.2, light: L }), INK);
      p.vline(X(9), 37, 39, '#3a0a0a');
    });
    // forelegs: pillars with hooked claws
    both(W, (X) => {
      const lm = mask(W, H);
      cap(lm, X(14), 40, X(12), 54, 7, 6);
      const leg = shade(lm, hide, { depth: 5, light: L, normal: cylN(X(12), 8), blend: 0.4 });
      curve(leg, [[X(8), 46], [X(12), 47], [X(17), 45]], hide[1]);
      curve(leg, [[X(8), 51], [X(12), 52], [X(16), 50]], hide[1]);
      put(p, leg, 'dark');
      put(p, part(W, H, (g) => g.ellipse(X(12), 58, 8, 4, 1), hide, { depth: 2.5, light: L }), 'dark');
      for (const [x0, x1, xc] of [[5, 3, 3.5], [10, 9, 9], [15, 16, 15.5], [19, 21, 20.5]]) {
        put(p, part(W, H, (g) => tube(g, [[X(x0 + 1), 58], [X(xc), 60], [X(x1), 62]], 1.6, 0.3, 1, 8), bone, { depth: 1.2, light: L }), 'dark');
      }
    });
    // chest between the legs
    const bm = mask(W, H);
    bm.poly([[22, 42], [42, 42], [40, 52], [cx, 55], [24, 52]], 1);
    const bl = shade(bm, belly, { depth: 4, light: L, normal: cylN(cx - 1, 10), blend: 0.5, bias: -0.05 });
    for (const y of [46, 50]) curve(bl, [[23, y - 1], [cx, y + 1], [41, y - 1]], belly[1]);
    put(p, bl, 'dark');

    // great horns sweeping up and out from the crown, a short spike between them
    both(W, (X) => {
      const pts = [[X(25), 19], [X(17), 14], [X(12), 5], [X(16), 1]];
      const hn = mask(W, H); tube(hn, pts, 3.4, 0.6, 1, 22);
      const h = shade(hn, bone, { depth: 2, light: L });
      for (let i = 1; i < 9; i++) { const q = bez(pts, i / 9); on(h, q[0] + 1, q[1] + 1, bone[1]); }
      put(p, h, 'dark');
    });
    // head: broad and heavy, pushed forward between the shoulders
    const hm = mask(W, H);
    hm.ellipse(cx, 27, 14, 10, 1);
    hm.poly([[18, 27], [46, 27], [43, 40], [38, 46], [26, 46], [21, 40]], 1);
    const head = shade(hm, hide, { depth: 5, light: L, normal: sphereN(cx - 2, 27, 15, 15), blend: 0.35, rim: 1, bias: 0.04 });
    // brow ridges over the big eyes
    both(W, (X) => curve(head, [[X(20), 25], [X(25), 23], [X(30), 25]], hide[1]));
    put(p, head, 'dark');
    put(p, part(W, H, (g) => cap(g, cx, 18, cx, 11, 2, 0.3), bone, { depth: 1, light: L }), 'dark');
    // the maw: wide, fanged top and bottom, a hot throat
    const mw = mask(W, H);
    mw.poly([[22, 35], [42, 35], [40, 41], [cx, 45], [24, 41]], 1);
    const mouth = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - cx) / 8.5, (y - 40) / 4.2); mouth.set(x, y, MAW[Math.max(0, Math.min(4, Math.floor(4.2 - d * 3.6)))]); });
    put(p, mouth, INK);
    for (const [x, l] of [[23, 3], [25, 2], [27, 3], [29, 2], [31, 2], [33, 2], [35, 2], [37, 3], [39, 2], [41, 3]]) for (let k = 0; k < l; k++) p.set(x, 35 + k, k === l - 1 ? bone[3] : WHITE);
    for (const [x, l] of [[25, 2], [28, 3], [cx, 2], [36, 3], [39, 2]]) for (let k = 0; k < l; k++) p.set(x, 43 - k - (Math.abs(x - cx) > 5 ? 1 : 0), k === l - 1 ? bone[3] : bone[5]);
    // seven eyes, each in its own dark socket: a big pair, a small pair, one on the brow, two on the cheeks
    const eye = (x, y, r) => {
      const sock = mask(W, H); sock.ellipse(x, y, r + 1, r * 0.8 + 1, 1);
      put(p, part(W, H, (g) => g.ellipse(x, y, r + 1, r * 0.8 + 1, 1), hide, { depth: 1, light: [0.4, 0.7, 0.5], bias: -0.25 }));
      const m = mask(W, H); m.ellipse(x, y, r, r * 0.8, 1);
      const e = G().pix(W, H);
      m.each((X, Y) => { const d = Math.hypot(X - x + r * 0.35, Y - y + r * 0.35) / (r + 0.6); e.set(X, Y, EYE[Math.max(0, Math.min(3, Math.floor(3.7 - d * 3.2)))]); });
      put(p, e, INK);
      p.vline(Math.round(x), Math.round(y - r * 0.55), Math.round(y + r * 0.55), '#3a0a0a');
      if (r > 2) p.set(Math.round(x - r * 0.5), Math.round(y - r * 0.4), WHITE);
    };
    eye(25, 28, 3.2); eye(39, 28, 3.2);
    eye(27, 21.5, 1.6); eye(37, 21.5, 1.6);
    eye(cx, 19.5, 1.5);
    eye(19.5, 33, 1.5); eye(44.5, 33, 1.5);

    return finish(p);
  };

  // ------------------------------------------------------------ registry
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.Postgame = { SPRITES: Object.keys(S) };
})(window.RPG);
