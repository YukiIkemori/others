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
  // body coiled on itself: the crowned central head with a gold diadem of
  // horns and a maw of radiant fire, a fire-breathing head on the left and a
  // frost-breathing head on the right. Its hide is void-black with an
  // iridescent sheen, its wings and hood are torn windows onto a starfield,
  // gold binds it together, and an open eye of chaos stares out of its
  // breastplate. 128x112. (In battle the top ~18 rows sit behind the party
  // windows: every face is kept below them, only the crown reaches up there.)
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

    // --- wings: void bones with gold joints, torn starfield membranes
    both(W, (X, s) => {
      const S0 = [48, 60], E = [33, 30], Wr = [15, 11];
      const tips = [[1, 24], [1, 43], [5, 60], [17, 72]];
      const poly = [S0, E, Wr];
      // scalloped edge: between two finger tips the membrane sags toward the root
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i], prev = i ? tips[i - 1] : Wr, k = i ? 0.2 : 0.06;
        const mx = (prev[0] + t[0]) / 2, my = (prev[1] + t[1]) / 2;
        poly.push([mx + (S0[0] - mx) * k, my + (S0[1] - my) * k], t);
      }
      poly.push([31, 70], [40, 68]);
      const m = mask(W, H);
      m.poly(poly.map(([x, y]) => [X(x), y]), 1);
      for (const [hx, hy, r] of [[11, 52, 2], [20, 64, 1.6], [6, 36, 1.3]]) m.ellipse(X(hx), hy, r, r * 0.8, null);
      put(p, voidMembrane(m, { seed: s > 0 ? 11 : 17, depthFn: (x, y) => Math.max(0, 1 - Math.hypot(x - X(Wr[0]), y - Wr[1]) / 64) }), 'dark');
      const bm = mask(W, H);
      cap(bm, X(S0[0]), S0[1], X(E[0]), E[1], 2.8, 2.2);
      cap(bm, X(E[0]), E[1], X(Wr[0]), Wr[1], 2.2, 1.7);
      for (const t of tips) tube(bm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 3), (Wr[1] + t[1]) / 2], [X(t[0]), t[1]]], 1.2, 0.5, 1, 14);
      put(p, shadeVoid(bm, { depth: 1.6, light: L, bias: 0.12, seed: 2 }), 'dark');
      put(p, goldPart((g) => g.circle(X(Wr[0]), Wr[1], 1.9, 1), { depth: 1.2 }), 'dark');
      put(p, goldPart((g) => g.circle(X(E[0]), E[1], 2.2, 1), { depth: 1.4 }), 'dark');
      claw(X(Wr[0]), Wr[1] - 1, X(Wr[0] + 6), Wr[1] - 5, X(Wr[0] + 4), Wr[1] - 1, 1.4);
      claw(X(E[0]), E[1] - 2, X(E[0] + 2), E[1] - 9, X(E[0] + 2), E[1] - 5, 1.4);
    });

    // --- the hood: a starfield frill fanned out behind the central head, gold-ribbed
    {
      const hc = [cx, 40], R0 = 25;
      const hm = mask(W, H);
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const a = Math.PI + (k / 48) * Math.PI, sc = 1 - 0.1 * Math.abs(Math.sin(k / 48 * Math.PI * 7));
        pts.push([hc[0] + Math.cos(a) * R0 * sc * 1.05, hc[1] + Math.sin(a) * R0 * sc * 0.95]);
      }
      pts.push([hc[0] + 20, 56], [hc[0] - 20, 56]);
      hm.poly(pts, 1);
      put(p, voidMembrane(hm, { seed: 23, depthFn: (x, y) => Math.max(0, 1 - Math.hypot(x - hc[0], y - hc[1]) / 30) }), 'dark');
      const rb = mask(W, H);
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (1.08 + k * 0.84 / 6);
        cap(rb, hc[0] + Math.cos(a) * 12, hc[1] + Math.sin(a) * 11, hc[0] + Math.cos(a) * (R0 + 2), hc[1] + Math.sin(a) * (R0 + 1), 1.2, 0.4);
      }
      put(p, shade(rb, GOLD, { depth: 1, light: L, bias: 0.05 }), 'dark');
    }

    // --- side necks and heads: fire on the left, frost on the right
    both(W, (X, s) => {
      const breath = s > 0 ? EMBER : FROST;
      const np = [[X(52), 66], [X(33), 66], [X(25), 52]];
      const nk = mask(W, H);
      tube(nk, np, 6.5, 5, 1, 22);
      const neck = shadeVoid(nk, { depth: 4, light: L, seed: 3 + s });
      scales(neck, DARKS, 4, 3, { lit: 0 });
      // throat plates down the inner side of the neck
      const tp = mask(W, H);
      tube(tp, [[X(50), 70], [X(35), 69.5], [X(28.5), 57]], 2.4, 2, 1, 18);
      const plates = shade(tp, PEARL, { depth: 1.2, light: L, bias: 0.05 });
      for (let i = 1; i < 8; i++) { const q = bez([[X(50), 70], [X(35), 69.5], [X(28.5), 57]], i / 8); on(plates, q[0], q[1], PEARL[1]); on(plates, q[0] + 1, q[1], PEARL[1]); }
      put(neck, plates);
      for (const t of [0.15, 0.45]) { const q = bez(np, t); put(neck, goldPart((g) => cap(g, q[0] - 1.5, q[1] - 5.5, q[0] + 1.5, q[1] + 5.5, 1.5, 1.5), { depth: 1 })); }
      put(p, neck, 'dark');
      // swept horns, gold
      for (const [bx, by, mx, my, tx, ty, r] of [[27, 38, 27, 28, 33, 20, 2.6], [20, 40, 13, 35, 9, 26, 2.1]]) {
        put(p, goldPart((g) => tube(g, [[X(bx), by], [X(mx), my], [X(tx), ty]], r, 0.4, 1, 14)), 'dark');
      }
      // skull: broad brow, snout coming down toward the viewer
      const hm = mask(W, H);
      hm.ellipse(X(24), 43, 8.5, 7, 1);
      hm.poly([[X(16.5), 44], [X(31.5), 44], [X(29), 53], [X(24), 57], [X(19), 53]], 1);
      const head = shadeVoid(hm, { depth: 3.5, light: L, normal: sphereN(X(23), 43, 10, 11), blend: 0.4, seed: 7 + s });
      put(p, head, 'dark');
      // brow ridge and cheek spikes
      put(p, ivoryPart((g) => tube(g, [[X(17), 47], [X(13), 47], [X(10), 43]], 1.6, 0.3, 1, 10)), 'dark');
      put(p, goldPart((g) => g.poly([[X(16.5), 39], [X(24), 36.5], [X(31.5), 39], [X(28.5), 43], [X(24), 44], [X(19.5), 43]], 1), { depth: 1.2 }), 'dark');
      // maw open, breath glowing inside
      const mw = mask(W, H);
      mw.poly([[X(18.5), 50], [X(29.5), 50], [X(28), 56], [X(24), 58.5], [X(20), 56]], 1);
      const th = G().pix(W, H);
      mw.each((x, y) => { const d = Math.hypot((x - X(24)) / 4.5, (y - 54.5) / 3.2); th.set(x, y, breath[Math.max(0, Math.min(5, Math.floor(5.7 - d * 3.6)))]); });
      put(p, th, INK);
      const lx = Math.min(X(18.5), X(29.5));
      for (const [dx, l] of [[0, 3], [2, 2], [4, 1], [7, 1], [9, 2], [11, 3]]) fang(lx + dx, 50, l, 1, 0);
      // lower jaw
      put(p, voidPart((g) => g.poly([[X(19), 58], [X(29), 58], [X(27), 61], [X(24), 62], [X(21), 61]], 1), { depth: 1.5, seed: 9 }), 'dark');
      // eyes: slanted, glowing with the breath colour
      for (const ex of [19.5, 28.5]) {
        const x0 = Math.min(X(ex - 1.5), X(ex + 1.5));
        const inner = (ex < 24) === (s > 0);
        stamp(p, x0, 45, inner ? ['kk..', 'eEEk', '.kkk'] : ['..kk', 'kEEe', 'kkk.'], { k: INK, e: breath[3], E: breath[5] });
      }
      on(p, X(24), 38, breath[4]); on(p, X(24), 39, breath[2]);
      // breath wisps curling from the jaw
      for (let k = 0; k < 5; k++) p.set(X(24 - 1 + (k % 2)), 63 + k, k < 2 ? breath[4] : breath[3 - (k > 3 ? 1 : 0)]);
    });

    // --- coils behind the torso
    const coilBack = mask(W, H);
    tube(coilBack, [[18, 100], [30, 86], [64, 90], [110, 90]], 8.5, 8, 1, 30);
    const cb = shadeVoid(coilBack, { depth: 5, light: L, bias: -0.12, seed: 21, sheen: 0.7 });
    scales(cb, DARKS, 4, 3, { lit: 0 });
    put(p, cb, 'dark');

    // --- torso
    const tm = mask(W, H);
    tm.ellipse(cx, 76, 20, 16, 1);
    tm.ellipse(cx, 64, 25, 8, 1);
    tm.poly([[47, 84], [81, 84], [76, 97], [52, 97]], 1);
    const torso = shadeVoid(tm, { depth: 9, light: L, normal: sphereN(cx - 3, 70, 28, 26), blend: 0.35, seed: 31 });
    scales(torso, DARKS, 6, 4, { lit: 0 });
    put(p, torso, 'dark');
    // pearl belly plates running down into the coils
    const bp = mask(W, H);
    bp.poly([[57, 81], [71, 81], [70, 90], [67, 97], [61, 97], [58, 90]], 1);
    const belly = shade(bp, PEARL, { depth: 3, light: L, normal: cylN(cx - 1, 9), blend: 0.5, rim: 1, bias: -0.08 });
    for (const y of [86, 92]) { curve(belly, [[55, y - 1], [cx, y + 1.5], [73, y - 1]], PEARL[0]); curve(belly, [[55, y], [cx, y + 2.5], [73, y]], PEARL[3]); }
    bump(belly, PEARL, (x, y) => (hash(x, y, 3) < 0.08 ? 1 : 0));
    put(p, belly, 'dark');

    // --- breastplate: gold pectoral armour framing the eye of chaos
    both(W, (X) => {
      const pl = mask(W, H);
      pl.poly([[X(43), 63], [X(60), 63], [X(62), 71], [X(57), 80], [X(47), 77], [X(41), 69]], 1);
      const pp = shade(pl, GOLD, { depth: 3, light: L, spec: 0.94 });
      curve(pp, [[X(44), 64], [X(52), 64], [X(59), 64.5]], GOLD[6]);
      curve(pp, [[X(45), 71], [X(51), 75], [X(57), 77]], GOLD[1]);
      on(pp, X(47), 67, WHITE); on(pp, X(48), 67, GOLD[6]);
      put(p, pp, 'dark');
    });
    {
      const setm = mask(W, H);
      setm.poly([[cx, 61], [cx + 7.5, 70], [cx, 82], [cx - 7.5, 70]], 1);
      put(p, shade(setm, GOLD, { depth: 2.2, light: L, spec: 0.9 }), 'dark');
      const em = mask(W, H);
      for (let y = 63; y <= 79; y++) {
        const t = (y - 71) / 8, hw = 4.8 * Math.sqrt(Math.max(0, 1 - t * t));
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) em.set(x, y, 1);
      }
      const eye = G().pix(W, H);
      const IRIS = ['#ff5a8a', '#ffb050', '#f8f070', '#70f0a0', '#58d8ff', '#8a78ff', '#e070ff'];
      em.each((x, y) => {
        const dx = (x - cx) / 4.8, dy = (y - 71) / 8, d = Math.hypot(dx, dy);
        let c = IRIS[Math.floor(((Math.atan2(dy, dx) / (Math.PI * 2) + 1) * 7 + d * 2.2)) % 7];
        if (d > 0.8) c = dk(c, 0.5);
        else if (d < 0.35) c = mix(c, '#ffffff', 0.3);
        eye.set(x, y, c);
      });
      put(p, eye, INK);
      for (let y = 65; y <= 77; y++) { p.set(cx, y, '#050308'); if (y > 67 && y < 75) p.set(cx - 1, y, '#050308'); }
      p.set(cx - 3, 66, WHITE); p.set(cx - 2, 66, WHITE); p.set(cx - 3, 67, WHITE); p.set(cx + 2, 76, '#e8f0ff');
    }

    // --- coils in front: the body wraps round the base, the tail rising at the right
    const fa = [[30, 91], [6, 91], [6, 104], [40, 102]], fb = [[40, 102], [70, 100], [100, 104], [114, 92]], ft = [[114, 92], [126, 82], [119, 69]];
    const coilFront = mask(W, H);
    tube(coilFront, fa, 7, 7.5, 1, 24);
    tube(coilFront, fb, 7.5, 6.5, 1, 26);
    tube(coilFront, ft, 6.5, 2.5, 1, 18);
    const cf = shadeVoid(coilFront, { depth: 5, light: L, bias: -0.04, seed: 41 });
    scales(cf, DARKS, 5, 3, { lit: 0 });
    // pearl belly scutes along the underside, gold bands clasped round the coil
    for (const seg of [fa, fb]) for (let i = 1; i < 12; i++) {
      const q = bez(seg, i / 12);
      if (q[0] < 12) continue;
      on(cf, q[0], q[1] + 5, PEARL[3]); on(cf, q[0] + 1, q[1] + 5, PEARL[2]); on(cf, q[0], q[1] + 6, PEARL[1]);
    }
    for (const [seg, t] of [[fa, 0.62], [fb, 0.55]]) {
      const q = bez(seg, t);
      put(cf, goldPart((g) => cap(g, q[0] - 0.8, q[1] - 7, q[0] + 0.8, q[1] + 7, 1.4, 1.4), { depth: 1.1 }), 'dark');
    }
    put(p, cf, 'dark');
    // tail blade: a gold crescent
    put(p, goldPart((g) => { g.poly([[119, 71], [112, 64], [115, 53], [121, 61], [124, 71]], 1); }, { depth: 1.8 }), 'dark');
    for (const t of [0.35, 0.65, 0.9]) {
      const q = bez(fb, t);
      put(p, ivoryPart((g) => g.poly([[q[0] - 2, q[1] - 5], [q[0] + 2, q[1] - 5], [q[0] + 0.5, q[1] - 10]], 1)), 'dark');
    }

    // --- forelimbs gripping the coil
    both(W, (X) => {
      const la = mask(W, H);
      cap(la, X(47), 72, X(36), 82, 6.2, 5); cap(la, X(36), 82, X(37), 92, 5, 4.2);
      const arm = shadeVoid(la, { depth: 4, light: L, seed: 51 });
      scales(arm, DARKS, 4, 3, { lit: 0 });
      put(p, arm, 'dark');
      // elbow spike and a thin gold band at the wrist
      put(p, ivoryPart((g) => cap(g, X(35), 80, X(29), 74, 2, 0.3)), 'dark');
      put(p, goldPart((g) => cap(g, X(33), 89, X(41), 89.5, 1.3, 1.3), { depth: 1 }), 'dark');
      put(p, voidPart((g) => g.ellipse(X(37), 95, 5, 3.4, 1), { depth: 2.2, seed: 52 }), 'dark');
      for (const [x1, y1] of [[X(30), 100], [X(34), 102], [X(39), 102], [X(43), 99]]) claw(X(37), 96, x1, y1, (x1 + X(37)) / 2, y1 - 2, 1.5);
    });

    // --- central neck with a gold gorget
    const nk = mask(W, H);
    nk.poly([[54, 66], [74, 66], [72, 50], [56, 50]], 1);
    const neck = shadeVoid(nk, { depth: 5, light: L, normal: cylN(cx - 1, 10), blend: 0.4, seed: 71 });
    scales(neck, DARKS, 4, 3, { lit: 0 });
    put(neck, goldPart((g) => { g.poly([[52, 59], [76, 59], [75, 64], [cx, 66], [53, 64]], 1); }, { depth: 1.5 }), 'dark');
    for (let x = 55; x <= 73; x += 3) on(neck, x, 61, GOLD[6]);
    put(p, neck, 'dark');

    // --- great horns: a gold diadem of swept horns and crown points
    both(W, (X) => {
      const pts = [[X(55), 28], [X(43), 24], [X(36), 15], [X(38), 1]];
      const hn = mask(W, H); tube(hn, pts, 4.4, 0.6, 1, 26);
      const h = shade(hn, GOLD, { depth: 2.4, light: L, spec: 0.93 });
      for (let i = 1; i < 8; i++) { const q = bez(pts, i / 8); on(h, q[0], q[1] + 2, GOLD[1]); on(h, q[0] + 1, q[1] + 2, GOLD[2]); }
      put(p, h, 'dark');
      put(p, goldPart((g) => tube(g, [[X(52), 33], [X(43), 33], [X(36), 28]], 2.4, 0.4, 1, 14)), 'dark');
    });
    for (const [bx, tx, ty, r] of [[cx, cx, 5, 2.6], [cx - 6, cx - 9, 11, 2], [cx + 6, cx + 9, 11, 2]]) put(p, goldPart((g) => cap(g, bx, 25, tx, ty, r, 0.3)), 'dark');

    // --- central head: broad crowned skull, four eyes, a maw of radiant fire
    const hm = mask(W, H);
    hm.ellipse(cx, 33, 14, 10.5, 1);
    hm.poly([[50, 33], [78, 33], [75, 44], [71, 51], [57, 51], [53, 44]], 1);
    const head = shadeVoid(hm, { depth: 5, light: L, normal: sphereN(cx - 2, 33, 15, 14), blend: 0.35, seed: 81 });
    put(p, head, 'dark');
    // gold diadem across the brow with a teal gem
    const dm = mask(W, H);
    dm.poly([[51, 29], [cx, 23.5], [77, 29], [75, 32], [cx, 27.5], [53, 32]], 1);
    put(p, shade(dm, GOLD, { depth: 1.2, light: L, spec: 0.9 }), 'dark');
    stamp(p, cx - 2, 23, ['.kk.', 'kcCk', 'kbck', '.kk.'], { k: INK, c: '#58c8cc', C: '#e8fff8', b: '#2f8aa8' });
    // cheek spikes
    both(W, (X) => { put(p, ivoryPart((g) => tube(g, [[X(54), 45], [X(47), 45], [X(42), 40]], 2.4, 0.4, 1, 14)), 'dark'); });
    // lower jaw hanging open
    const jaw = mask(W, H);
    jaw.poly([[55, 53], [73, 53], [70, 60], [cx, 63], [58, 60]], 1);
    put(p, shadeVoid(jaw, { depth: 2.2, light: L, bias: -0.02, seed: 83 }), 'dark');
    // the maw: radiant golden fire deep inside
    const mw = mask(W, H);
    mw.poly([[56, 47], [72, 47], [70, 56], [cx, 58], [58, 56]], 1);
    const throat = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - cx) / 6.5, (y - 53.5) / 4); throat.set(x, y, d < 0.42 ? RADIANT[4] : d < 0.7 ? RADIANT[3] : d < 1 ? RADIANT[2] : d < 1.3 ? RADIANT[1] : '#1a0a06'); });
    put(p, throat);
    for (const [x, l, w] of [[57, 6, 1], [60, 3, 0], [62, 3, 0], [66, 3, 0], [68, 3, 0], [71, 6, 1]]) fang(x, 47, l, 1, w);
    for (const [x, l, w] of [[59, 4, 1], [cx, 3, 0], [69, 4, 1]]) fang(x, 57, l, -1, w);
    // snout ridge and nostrils
    for (let y = 37; y <= 43; y++) { on(p, cx - 1, y, SHEEN[1][3]); on(p, cx, y, SHEEN[2][1]); }
    stamp(p, cx - 4, 43, ['kk....kk', '.k....k.'], { k: INK });
    // eyes: two great slanted eyes of white-gold light, two lesser eyes above
    both(W, (X) => {
      const em = mask(W, H);
      em.poly([[X(52), 35], [X(61), 37.5], [X(59), 40], [X(54), 39]], 1);
      const eye = G().pix(W, H);
      em.each((x, y) => { eye.set(x, y, y <= 36 ? '#ffffff' : y <= 37 ? '#fff6b0' : y <= 38 ? '#ffd040' : '#e08a18'); });
      put(p, eye, INK);
      p.line(X(51), 34, X(62), 37, INK); p.line(X(51), 35, X(51), 36, INK);
      p.vline(X(57), 36, 39, INK);
      const ex = X(55.5);
      p.set(ex, 31, '#ffe680'); p.set(ex + 1, 31, '#fff8d0'); p.set(ex, 32, '#e08a18'); p.set(ex + 1, 32, '#ffd040');
      p.set(ex - 1, 31, INK); p.set(ex + 2, 32, INK);
    });

    // --- rim light: iridescent on the outer silhouette, magenta from below
    const edgeC = (x, y) => SHEEN[Math.max(0, Math.min(3, Math.floor(1.5 + (x - cx) / 40 + (fbm(x, y, 99) - 0.5) * 2)))][2];
    edgeLight(p, { src: (c) => VOID_ALL.has(c), nb: (c) => c == null, dirs: [{ d: [1, 0], c: edgeC }, { d: [-1, 0], c: edgeC }, { d: [0, 1], c: '#a8409e' }] });

    return finish(p, { free: true, post: (q) => {
      for (const [x, y, r, c] of [[3, 80, 2, '#b4fff0'], [124, 36, 1, '#ffd0f0'], [12, 92, 1, '#cce0ff'], [2, 12, 1, '#fff8d0'], [125, 10, 2, '#fff8d0'], [102, 104, 1, '#e8d4ff']]) sparkle(q, x, y, r, c, WHITE);
    } });
  };

  // ------------------------------------------------------------ registry
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.Postgame = { SPRITES: Object.keys(S) };
})(window.RPG);
