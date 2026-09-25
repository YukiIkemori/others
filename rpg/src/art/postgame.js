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
   * Iridescent void shading: the darker 5 steps are the void, the top steps
   * take a sheen band picked from the normal's direction plus a slow diagonal
   * drift across the sprite, so each curved surface shows a teal→magenta sweep.
   * o: shade options + {sheen (0..1 how much of the range is sheen), drift, seed}
   */
  function shadeVoid(m, o) {
    o = o || {};
    const out = G().pix(m.w, m.h);
    const n = VOID_DARK.length + 4, sheen = o.sheen == null ? 1 : o.sheen;
    lightMask(m, o, (x, y, q) => {
      const f = Math.max(0, Math.min(0.999, q.v)) * n;
      let k = Math.floor(f);
      if ((x + y) % 2 && f - k > 0.72) k++;
      if (o.rim && q.edge && q.ny + q.nx * 0.5 > 0.1 && q.dot < 0.45) k += o.rim;
      k = Math.max(0, Math.min(n - 1, k));
      if (k < VOID_DARK.length || sheen <= 0) { out.set(x, y, VOID_DARK[Math.min(k, VOID_DARK.length - 1)]); return; }
      // band: facing up-left → teal, facing the viewer → blue/violet, facing down-right → magenta
      let b = 1.6 + q.nx * 1.3 + q.ny * 0.9 + (o.drift == null ? 0.012 : o.drift) * (x - y) + (fbm(x, y, o.seed || 5) - 0.5) * 1.2;
      if ((x + y) % 2 && b - Math.floor(b) > 0.75) b += 0.5;
      const band = SHEEN[Math.max(0, Math.min(3, Math.floor(b)))];
      const s = Math.min(3, Math.floor((k - VOID_DARK.length) * sheen + (sheen < 1 ? 0 : 0)));
      out.set(x, y, band[s]);
    });
    return out;
  }
  /**
   * Void membrane: a starfield with drifting nebulae, deepening toward the
   * trailing edge; bright stars, a few sparkles, an iridescent rim.
   */
  function voidMembrane(m, o) {
    o = o || {};
    const out = G().pix(m.w, m.h), D = edt(m), seed = o.seed || 11;
    const BASE = ['#040208', '#0a0616', '#120c26', '#1c1238', '#281a4c'];
    const NEB_M = ['#2a0e3a', '#46185a', '#6a2a7a'], NEB_T = ['#0a2a3a', '#0e4458', '#1c6a7a'];
    m.each((x, y) => {
      const i = y * m.w + x;
      const t = o.depthFn ? o.depthFn(x, y) : 0.5;
      let k = Math.floor((1 - t) * 4.2 + ((x + y) % 2 ? 0.35 : 0));
      k = Math.max(0, Math.min(4, k));
      let c = BASE[k];
      const nm = fbm(x, y, seed), nt = fbm(x + 40, y - 17, seed + 3);
      if (nm > 0.6) c = NEB_M[Math.min(2, Math.floor((nm - 0.6) * 12 + ((x + y) % 2 ? 0.4 : 0)))];
      else if (nt > 0.62) c = NEB_T[Math.min(2, Math.floor((nt - 0.62) * 12 + ((x + y) % 2 ? 0.4 : 0)))];
      const hs = hash(x, y, seed + 21);
      if (hs < 0.018) c = hs < 0.006 ? '#ffffff' : hs < 0.012 ? '#bfe8ff' : '#ffe6a8';
      else if (hs < 0.03 && D[i] > 2) c = mix(c, '#8890c0', 0.45);
      if (D[i] < 1) {
        let b = 1.5 + (x - m.w / 2) / (m.w / 2) * 1.4 + (fbm(x, y, seed + 9) - 0.5) * 1.8;
        c = SHEEN[Math.max(0, Math.min(3, Math.floor(b)))][2];
      } else if (D[i] < 2) c = mix(c, '#3a286c', 0.5);
      out.set(x, y, c);
    });
    return out;
  }

  const S = {};

  // ================================================================ boss_abyss
  // 深淵の王: a primordial chaos dragon-god. Three heads on one colossal body
  // rising from its own coils: the crowned central head with a gold diadem of
  // horns, a fire-breathing head on the left and a frost-breathing head on the
  // right. Its hide is void-black with an iridescent sheen, its wings are torn
  // windows onto a starfield, gold bones and armour hold it together, and an
  // open eye of chaos stares out of its breastplate. 128x112.
  S.boss_abyss = () => {
    const W = 128, H = 112, cx = 64;
    const L = [-0.45, -0.75, 0.55];
    const p = G().pix(W, H);
    const EMBER = ['#5a0e08', '#a8280c', '#e8601a', '#ffa838', '#ffe690', '#fffff0'];
    const FROST = ['#0c2a5a', '#1660a8', '#38a8e0', '#88e4ff', '#e0fcff', '#ffffff'];
    const RADIANT = ['#3a1a08', '#a05010', '#f0a030', '#ffe080', '#fffff0'];
    const goldPart = (fn, o) => part(W, H, fn, GOLD, Object.assign({ depth: 2, light: L, spec: 0.93 }, o || {}));
    const ivoryPart = (fn, o) => part(W, H, fn, IVORY, Object.assign({ depth: 1.4, light: L }, o || {}));
    const voidPart = (fn, o) => { const m = mask(W, H); fn(m); return shadeVoid(m, Object.assign({ depth: 4, light: L }, o || {})); };
    const claw = (x0, y0, x1, y1, xc, yc, r) => put(p, ivoryPart((g) => tube(g, [[x0, y0], [xc, yc], [x1, y1]], r || 1.6, 0.3, 1, 10)), 'dark');

    // --- wings: gold bone spars, torn starfield membranes
    both(W, (X) => {
      const S0 = [46, 50], E = [30, 22], Wr = [13, 5];
      const tips = [[1, 18], [1, 37], [5, 55], [17, 68]];
      const poly = [S0, E, Wr];
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i], prev = i ? tips[i - 1] : Wr;
        poly.push([(prev[0] + t[0]) / 2 + 6.5, (prev[1] + t[1]) / 2], t);
      }
      poly.push([36, 64]);
      const m = mask(W, H);
      m.poly(poly.map(([x, y]) => [X(x), y]), 1);
      // tears in the membrane: small ragged holes near the trailing edge
      for (const [hx, hy, r] of [[12, 44, 2.2], [20, 58, 1.8], [7, 30, 1.5]]) m.ellipse(X(hx), hy, r, r * 0.8, null);
      put(p, voidMembrane(m, { seed: X(1) > 1 ? 11 : 17, depthFn: (x, y) => Math.max(0, 1 - Math.hypot(x - X(Wr[0]), y - Wr[1]) / 62) }), 'dark');
      const bm = mask(W, H);
      cap(bm, X(S0[0]), S0[1], X(E[0]), E[1], 3, 2.3);
      cap(bm, X(E[0]), E[1], X(Wr[0]), Wr[1], 2.3, 1.9);
      for (const t of tips) tube(bm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 3), (Wr[1] + t[1]) / 2], [X(t[0]), t[1]]], 1.3, 0.5, 1, 14);
      const bones = shade(bm, GOLD, { depth: 1.8, light: L, bias: 0.02 });
      put(p, bones, 'dark');
      // wrist: a gold knuckle with a hooked ivory talon; elbow spike
      put(p, goldPart((g) => g.circle(X(Wr[0]), Wr[1], 2.6, 1)), 'dark');
      claw(X(Wr[0]), Wr[1] - 1, X(Wr[0] + 8), Wr[1] - 4, X(Wr[0] + 5), Wr[1], 1.8);
      put(p, goldPart((g) => g.circle(X(E[0]), E[1], 2.8, 1)), 'dark');
      claw(X(E[0]), E[1] - 2, X(E[0] + 3), E[1] - 10, X(E[0] + 3), E[1] - 5, 1.6);
    });

    // --- the gold halo: a broken ring of rays behind the heads
    {
      const hm = mask(W, H);
      for (let a = 0; a < Math.PI * 2; a += 0.01) {
        const r = 25, x = cx + Math.cos(a) * r, y = 30 + Math.sin(a) * r * 0.92;
        const gap = Math.abs(Math.sin(a * 6)) < 0.14;
        if (!gap) cap(hm, x, y, x, y, 1.6, 1.6);
      }
      for (let k = 0; k < 12; k++) {
        const a = -Math.PI / 2 + (k + 0.5) * Math.PI / 6;
        const r0 = 27, r1 = k % 2 ? 31 : 34;
        cap(hm, cx + Math.cos(a) * r0, 30 + Math.sin(a) * r0 * 0.92, cx + Math.cos(a) * r1, 30 + Math.sin(a) * r1 * 0.92, 1.4, 0.3);
      }
      const halo = shade(hm, GOLD, { depth: 1.5, light: L, bias: 0.1 });
      put(p, halo, 'dark');
    }

    // --- side necks and heads (fire on the left, frost on the right)
    const sideHead = (X, s, breath) => {
      const nk = mask(W, H);
      tube(nk, [[X(48), 60], [X(30), 58], [X(24), 42]], 6.5, 4.5, 1, 22);
      const neck = shadeVoid(nk, { depth: 4, light: L, seed: 3 + s });
      put(p, neck, 'dark');
      // throat plates down the neck's inner side
      const tp = mask(W, H);
      tube(tp, [[X(46), 64], [X(32), 62], [X(27.5), 46]], 2.4, 1.8, 1, 18);
      const plates = shade(tp, GOLD, { depth: 1.2, light: L, bias: -0.05 });
      for (let i = 0; i < 7; i++) { const q = bez([[X(46), 64], [X(32), 62], [X(27.5), 46]], i / 7); on(plates, q[0], q[1], GOLD[1]); on(plates, q[0] + 1, q[1], GOLD[1]); }
      put(neck, plates);
      put(p, neck, 'dark');
      // horns swept back
      for (const [bx, by, mx, my, tx, ty, r] of [[23, 32, 20, 22, 26, 14, 2.4], [18, 35, 11, 30, 8, 22, 1.8]]) {
        put(p, goldPart((g) => tube(g, [[X(bx), by], [X(mx), my], [X(tx), ty]], r, 0.4, 1, 14)), 'dark');
      }
      // skull, brow and snout pointing down toward the viewer
      const hm = mask(W, H);
      hm.ellipse(X(21), 35, 7.5, 6.5, 1);
      hm.poly([[X(14.5), 36], [X(27.5), 36], [X(25.5), 45], [X(21), 48], [X(16.5), 45]], 1);
      const head = shadeVoid(hm, { depth: 3.5, light: L, normal: sphereN(X(20), 35, 9, 10), blend: 0.4, seed: 7 + s });
      put(p, head, 'dark');
      // jaw open, breath glowing inside
      const mw = mask(W, H);
      mw.poly([[X(16.5), 44], [X(25.5), 44], [X(24), 49], [X(21), 51], [X(18), 49]], 1);
      const th = G().pix(W, H);
      mw.each((x, y) => { const d = Math.hypot((x - X(21)) / 4, (y - 47.5) / 3); th.set(x, y, breath[Math.max(0, Math.min(5, Math.floor(5.6 - d * 3.8)))]); });
      put(p, th, INK);
      for (const [x, y, l] of [[16, 44, 2], [18, 44, 1], [24, 44, 1], [26, 44, 2]]) for (let k = 0; k < l; k++) p.set(X(x), y + k, k === l - 1 ? IVORY[3] : WHITE);
      // gold brow plate and glowing eyes
      put(p, goldPart((g) => g.poly([[X(15), 31], [X(21), 29], [X(27), 31], [X(24.5), 35], [X(21), 36], [X(17.5), 35]], 1), { depth: 1.2 }), 'dark');
      for (const ex of [17.5, 24.5]) {
        stamp(p, Math.min(X(ex - 1), X(ex + 1)), 37, ['kkk', 'eEe', '.k.'], { k: INK, e: breath[3], E: breath[5] });
      }
      on(p, X(21), 32, breath[4]);
    };
    both(W, (X, s) => sideHead(X, s, s > 0 ? EMBER : FROST));

    // --- coils behind the torso: the back loop of the serpent body
    const coilBack = mask(W, H);
    tube(coilBack, [[18, 98], [34, 84], [64, 86], [104, 88]], 8, 8, 1, 30);
    const cb = shadeVoid(coilBack, { depth: 5, light: L, bias: -0.08, seed: 21 });
    scales(cb, [...VOID_DARK], 4, 3, { lit: 0 });
    put(p, cb, 'dark');

    // --- torso
    const tm = mask(W, H);
    tm.ellipse(cx, 70, 21, 17, 1);
    tm.ellipse(cx, 58, 27, 9, 1);
    tm.poly([[46, 80], [82, 80], [76, 96], [52, 96]], 1);
    const torso = shadeVoid(tm, { depth: 9, light: L, normal: sphereN(cx - 3, 66, 30, 28), blend: 0.35, seed: 31 });
    scales(torso, [...VOID_DARK], 6, 4, { lit: 0 });
    put(p, torso, 'dark');
    // belly plates: pale gold bands running down into the coils
    const bp = mask(W, H);
    bp.poly([[55, 76], [73, 76], [72, 90], [68, 100], [60, 100], [56, 90]], 1);
    const belly = shade(bp, IVORY, { depth: 3.5, light: L, normal: cylN(cx - 1, 11), blend: 0.5, rim: 1 });
    for (const y of [80, 85, 90, 95]) { curve(belly, [[53, y - 1], [cx, y + 1.5], [75, y - 1]], IVORY[1]); curve(belly, [[53, y], [cx, y + 2.5], [75, y]], IVORY[4]); }
    put(p, belly, 'dark');

    // --- breastplate: gold pectoral armour framing the eye of chaos
    both(W, (X) => {
      const pl = mask(W, H);
      pl.poly([[X(40), 56], [X(60), 57], [X(62), 66], [X(56), 76], [X(44), 72], [X(38), 63]], 1);
      const pp = shade(pl, GOLD, { depth: 3, light: L, spec: 0.94 });
      curve(pp, [[X(42), 58], [X(51), 58], [X(59), 59]], GOLD[6]);
      curve(pp, [[X(42), 66], [X(49), 71], [X(56), 73]], GOLD[1]);
      curve(pp, [[X(44), 62], [X(50), 66], [X(57), 67]], GOLD[2]);
      for (const [x, y] of [[44, 60], [52, 69]]) { on(pp, X(x), y, GOLD[6]); on(pp, X(x) + 1, y + 1, GOLD[1]); }
      put(p, pp, 'dark');
    });
    // the eye of chaos: a vertical almond in a gold setting, rainbow iris, black slit
    {
      const setm = mask(W, H);
      setm.poly([[cx, 55], [cx + 8, 64], [cx, 77], [cx - 8, 64]], 1);
      put(p, shade(setm, GOLD, { depth: 2.2, light: L, spec: 0.9 }), 'dark');
      const em = mask(W, H);
      for (let y = 57; y <= 74; y++) {
        const t = (y - 65.5) / 8.5, hw = 5.2 * Math.sqrt(Math.max(0, 1 - t * t));
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) em.set(x, y, 1);
      }
      const eye = G().pix(W, H);
      const IRIS = ['#ff5a8a', '#ffb050', '#f8f070', '#70f0a0', '#58d8ff', '#8a78ff', '#e070ff'];
      em.each((x, y) => {
        const dx = (x - cx) / 5.2, dy = (y - 65.5) / 8.5, d = Math.hypot(dx, dy);
        const a = Math.atan2(dy, dx);
        let c = IRIS[Math.floor(((a / (Math.PI * 2) + 1) * 7 + d * 2.2)) % 7];
        if (d > 0.82) c = dk(c, 0.55);
        else if (d < 0.35) c = mix(c, '#ffffff', 0.25);
        eye.set(x, y, c);
      });
      put(p, eye, INK);
      for (let y = 59; y <= 72; y++) { p.set(cx, y, '#050308'); if (y > 61 && y < 70) p.set(cx - 1, y, '#050308'); }
      p.set(cx - 3, 60, WHITE); p.set(cx - 2, 60, WHITE); p.set(cx - 3, 61, WHITE); p.set(cx + 2, 71, '#e8f0ff');
    }

    // --- coils in front: the serpent body wraps round the base, tail rising right
    const fp = [[8, 106], [40, 112], [88, 110], [112, 96]];
    const coilFront = mask(W, H);
    tube(coilFront, fp, 7.5, 6.5, 1, 32);
    tube(coilFront, [[112, 96], [124, 86], [118, 70]], 6.5, 2.5, 1, 18);
    const cf = shadeVoid(coilFront, { depth: 5, light: L, seed: 41 });
    scales(cf, [...VOID_DARK], 5, 3, { lit: 0 });
    // belly plates along the underside of the front coil
    for (let i = 1; i < 16; i++) {
      const q = bez(fp, i / 16);
      on(cf, q[0], q[1] + 4, IVORY[3]); on(cf, q[0] + 1, q[1] + 4, IVORY[2]); on(cf, q[0], q[1] + 5, IVORY[2]);
    }
    put(p, cf, 'dark');
    // tail blade: a gold crescent
    put(p, goldPart((g) => { g.poly([[118, 72], [110, 64], [115, 52], [121, 62], [124, 72]], 1); }, { depth: 2 }), 'dark');
    for (const t of [0.35, 0.55, 0.75]) {
      const q = bez(fp, t);
      put(p, ivoryPart((g) => g.poly([[q[0] - 2, q[1] - 5], [q[0] + 2, q[1] - 5], [q[0] + 1, q[1] - 10]], 1)), 'dark');
    }

    // --- left arm: reaching down, talons spread over the coil
    {
      const X = (x) => x;
      const la = mask(W, H);
      cap(la, X(44), 64, X(28), 76, 7, 6); cap(la, X(28), 76, X(30), 90, 6, 5);
      const arm = shadeVoid(la, { depth: 4.5, light: L, seed: 51 });
      scales(arm, [...VOID_DARK], 4, 3, { lit: 0 });
      put(p, arm, 'dark');
      const bz = goldPart((g) => cap(g, X(28.5), 84, X(29.5), 88, 5.4, 5.2), { depth: 2.2 });
      curve(bz, [[X(23.5), 86], [X(29), 88.5], [X(35), 88]], GOLD[1]); curve(bz, [[X(23.5), 82], [X(29), 84], [X(34.5), 83]], GOLD[6]);
      put(p, bz, 'dark');
      put(p, voidPart((g) => g.ellipse(X(30), 93, 5.5, 4.2, 1), { depth: 2.5, seed: 52 }), 'dark');
      for (const [x1, y1, xc, yc] of [[X(21), 101], [X(26), 104], [X(32), 104], [X(38), 100]].map(([a, b]) => [a, b, (a + X(30)) / 2, b - 2])) claw(X(30), 94, x1, y1, xc, yc, 1.6);
    }
    // --- right arm: raised, a sphere of chaos cupped in the claws
    {
      const ra = mask(W, H);
      cap(ra, 84, 64, 102, 72, 7, 6); cap(ra, 102, 72, 104, 58, 6, 5);
      const arm = shadeVoid(ra, { depth: 4.5, light: L, seed: 61 });
      scales(arm, [...VOID_DARK], 4, 3, { lit: 0 });
      put(p, arm, 'dark');
      const bz = goldPart((g) => cap(g, 103.5, 63, 103.5, 60, 5.4, 5.2), { depth: 2.2 });
      curve(bz, [[98.5, 60], [103.5, 58], [108.5, 60]], GOLD[6]); curve(bz, [[98.5, 64], [103.5, 62], [108.5, 64]], GOLD[1]);
      put(p, bz, 'dark');
      // the orb
      const om = mask(W, H); om.circle(104, 46, 7.5, 1);
      const orb = G().pix(W, H);
      om.each((x, y) => {
        const dx = x - 102, dy = y - 44, d = Math.hypot(dx, dy) / 8.5;
        const a = Math.atan2(y - 46, x - 104) + d * 4.2;
        const sw = Math.sin(a * 2) * 0.5 + 0.5;
        const band = SHEEN[Math.max(0, Math.min(3, Math.floor(sw * 3.99)))];
        const k = d < 0.3 ? 3 : d < 0.62 ? 2 : d < 0.9 ? 1 : 0;
        orb.set(x, y, k === 0 ? (sw > 0.5 ? '#2a1c50' : '#1b1336') : band[k]);
      });
      put(p, orb, 'dark');
      p.set(101, 42, WHITE); p.set(102, 42, WHITE); p.set(101, 43, WHITE);
      // hand under the orb, talons curling round it
      put(p, voidPart((g) => g.ellipse(104, 55, 5.5, 4, 1), { depth: 2.5, seed: 62 }), 'dark');
      for (const [x1, y1, xc, yc] of [[95, 47, 96, 52], [99, 43, 98, 48], [110, 43, 111, 48], [113, 48, 112, 52]]) claw(104, 54, x1, y1, xc, yc, 1.5);
    }

    // --- shoulder pauldrons: gold, spiked
    both(W, (X) => {
      put(p, goldPart((g) => { g.ellipse(X(41), 58, 8, 6, 1); }, { depth: 3, normal: sphereN(X(40), 56, 9, 8), blend: 0.3 }), 'dark');
      for (const [bx, by, tx, ty, r] of [[X(38), 54, X(31), 42, 3], [X(44), 53, X(41), 43, 2.4]]) put(p, ivoryPart((g) => cap(g, bx, by, tx, ty, r, 0.3)), 'dark');
      on(p, X(38), 56, GOLD[6]); on(p, X(39), 56, GOLD[6]); on(p, X(37), 57, GOLD[6]);
    });

    // --- central neck
    const nk = mask(W, H);
    nk.poly([[54, 58], [74, 58], [71, 40], [57, 40]], 1);
    const neck = shadeVoid(nk, { depth: 5, light: L, normal: cylN(cx - 1, 10), blend: 0.4, seed: 71 });
    scales(neck, [...VOID_DARK], 4, 3, { lit: 0 });
    // gold gorget ring at the base of the neck
    put(neck, goldPart((g) => { g.poly([[53, 51], [75, 51], [74, 56], [cx, 58], [54, 56]], 1); }, { depth: 1.5 }), 'dark');
    for (let x = 56; x <= 72; x += 3) on(neck, x, 53, GOLD[6]);
    put(p, neck, 'dark');

    // --- great horns: a gold diadem of swept horns and crown points
    both(W, (X) => {
      const pts = [[X(55), 24], [X(44), 20], [X(38), 12], [X(40), 1]];
      const hn = mask(W, H); tube(hn, pts, 4.6, 0.6, 1, 26);
      const h = shade(hn, GOLD, { depth: 2.4, light: L, spec: 0.93 });
      for (let i = 1; i < 8; i++) { const q = bez(pts, i / 8); on(h, q[0], q[1] + 2, GOLD[1]); on(h, q[0] + 1, q[1] + 2, GOLD[2]); }
      put(p, h, 'dark');
      const pts2 = [[X(52), 30], [X(42), 30], [X(35), 25]];
      put(p, goldPart((g) => tube(g, pts2, 2.6, 0.4, 1, 14)), 'dark');
    });
    for (const [bx, tx, ty, r] of [[cx, cx, 3, 2.6], [cx - 6, cx - 9, 8, 2], [cx + 6, cx + 9, 8, 2]]) put(p, goldPart((g) => cap(g, bx, 22, tx, ty, r, 0.3)), 'dark');

    // --- central head: broad crowned skull, four eyes, a maw of radiant fire
    const hm = mask(W, H);
    hm.ellipse(cx, 28, 13, 10, 1);
    hm.poly([[51, 28], [77, 28], [74, 38], [70, 44], [58, 44], [54, 38]], 1);
    const head = shadeVoid(hm, { depth: 5, light: L, normal: sphereN(cx - 2, 28, 14, 13), blend: 0.35, seed: 81 });
    put(p, head, 'dark');
    // gold diadem across the brow with a sapphire-black gem
    const dm = mask(W, H);
    dm.poly([[52, 24], [cx, 19], [76, 24], [74, 27], [cx, 23], [54, 27]], 1);
    put(p, shade(dm, GOLD, { depth: 1.2, light: L, spec: 0.9 }), 'dark');
    stamp(p, cx - 2, 18, ['.kk.', 'kcCk', 'kbck', '.kk.'], { k: INK, c: '#58c8cc', C: '#e8fff8', b: '#2f8aa8' });
    // cheek spikes
    both(W, (X) => {
      put(p, ivoryPart((g) => tube(g, [[X(54), 40], [X(48), 40], [X(43), 35]], 2.4, 0.4, 1, 14)), 'dark');
    });
    // lower jaw hanging open
    const jaw = mask(W, H);
    jaw.poly([[55, 46], [73, 46], [70, 53], [cx, 56], [58, 53]], 1);
    put(p, shadeVoid(jaw, { depth: 2.2, light: L, bias: -0.02, seed: 83 }), 'dark');
    // the maw: radiant golden fire deep inside
    const mw = mask(W, H);
    mw.poly([[56, 41], [72, 41], [70, 49], [cx, 51], [58, 49]], 1);
    const throat = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - cx) / 6.5, (y - 47) / 3.8); throat.set(x, y, d < 0.42 ? RADIANT[4] : d < 0.7 ? RADIANT[3] : d < 1 ? RADIANT[2] : d < 1.3 ? RADIANT[1] : '#1a0a06'); });
    put(p, throat);
    const fang = (x, y, len, dir, w) => {
      for (let k = 0; k < len; k++) {
        const hw = Math.max(0, Math.round(w * (1 - k / len)));
        for (let d = -hw; d <= hw; d++) p.set(x + d, y + dir * k, k === len - 1 ? IVORY[3] : d < 0 ? WHITE : IVORY[4]);
      }
    };
    for (const [x, l, w] of [[57, 6, 1], [60, 3, 0], [62, 3, 0], [66, 3, 0], [68, 3, 0], [71, 6, 1]]) fang(x, 41, l, 1, w);
    for (const [x, l, w] of [[59, 4, 1], [cx, 3, 0], [69, 4, 1]]) fang(x, 50, l, -1, w);
    // snout ridge and nostrils
    for (let y = 32; y <= 38; y++) { on(p, cx - 1, y, SHEEN[1][3]); on(p, cx, y, SHEEN[2][1]); }
    stamp(p, cx - 4, 37, ['kk....kk', '.k....k.'], { k: INK });
    // eyes: two great slanted eyes of white-gold light, two lesser eyes above
    both(W, (X) => {
      const em = mask(W, H);
      em.poly([[X(52), 30], [X(61), 32.5], [X(59), 35], [X(54), 34]], 1);
      const eye = G().pix(W, H);
      em.each((x, y) => { eye.set(x, y, y <= 31 ? '#ffffff' : y <= 32 ? '#fff6b0' : y <= 33 ? '#ffd040' : '#e08a18'); });
      put(p, eye, INK);
      p.line(X(51), 29, X(62), 32, INK); p.line(X(51), 30, X(51), 31, INK);
      p.vline(X(57), 31, 34, INK);
      stamp(p, Math.min(X(56), X(58)), 26, ['k.k'.replace('.', 'e'), '.k.'], { k: INK, e: '#ffe680' });
    });
    for (const x of [58, 69]) { p.set(x, 26, '#ffe680'); p.set(x, 27, '#e08a18'); }

    // --- rim light: iridescent on the outer silhouette, radiant gold from below
    const edgeC = (x, y) => SHEEN[Math.max(0, Math.min(3, Math.floor(1.5 + (x - cx) / 40 + (fbm(x, y, 99) - 0.5) * 2)))][2];
    edgeLight(p, { src: (c) => VOID_ALL.has(c), nb: (c) => c == null, dirs: [{ d: [1, 0], c: edgeC }, { d: [-1, 0], c: edgeC }, { d: [0, 1], c: '#a8409e' }] });

    return finish(p, { free: true, post: (q) => {
      // void motes drifting round the god
      for (const [x, y, r, c] of [[4, 72, 2, '#b4fff0'], [123, 30, 1, '#ffd0f0'], [10, 88, 1, '#cce0ff'], [118, 108, 1, '#e8d4ff'], [2, 6, 1, '#fff8d0'], [124, 4, 2, '#fff8d0']]) sparkle(q, x, y, r, c, WHITE);
    } });
  };

  // ------------------------------------------------------------ registry
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.Postgame = { SPRITES: Object.keys(S) };
})(window.RPG);
