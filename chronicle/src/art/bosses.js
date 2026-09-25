// Boss battle sprites (DESIGN §4): 'mon:boss_*', the eleven set-piece foes.
// Pipeline: silhouettes are built as masks from primitives (ellipses, capsules,
// bezier tubes, polygons), pillow-shaded from an exact distance transform with
// hue-shifted ramps (shadows drift to violet, lights to warm yellow), layered
// back to front with dark inner contours, detailed by hand (faces, ornaments,
// textures, glows) and closed with a bold outline. Deterministic (seeded noise);
// each sprite is built lazily once through R.Gfx.get and cached.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#0c0810'; // outer outline
  const INK = '#1a1020'; // inner lines, pupils, mouths
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
   * Hue-shifted ramp dark → light around a mid-tone base. o: {dark (0..1 how dark
   * the darkest step gets), light (how close to white the top gets), shift (deg of
   * hue drift: shadows toward violet, lights toward yellow), mid (0..1 base position)}
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
  /** cheap deterministic hash noise in [0,1) */
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

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
  /** point on a line (2 pts), quadratic (3 pts) or cubic (4 pts) bezier */
  function bez(pts, t) {
    const u = 1 - t;
    if (pts.length === 2) return [0, 1].map((k) => u * pts[0][k] + t * pts[1][k]);
    if (pts.length === 3) return [0, 1].map((k) => u * u * pts[0][k] + 2 * u * t * pts[1][k] + t * t * pts[2][k]);
    return [0, 1].map((k) => u * u * u * pts[0][k] + 3 * u * u * t * pts[1][k] + 3 * u * t * t * pts[2][k] + t * t * t * pts[3][k]);
  }
  /** bezier tube, radius r0 → r1 (tails, necks, horns, tentacles) */
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
  /** draw a 1-px bezier curve */
  function curve(p, pts, c, n) {
    n = n || 24;
    let a = pts[0];
    for (let i = 1; i <= n; i++) { const b = bez(pts, i / n); p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c); a = b; }
    return p;
  }
  /** OR a mask with its mirror image across the vertical centre line */
  function sym(m) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x, j = y * m.w + (m.w - 1 - x);
      if (m.d[i] != null && m.d[j] == null) m.d[j] = m.d[i];
    }
    return m;
  }
  /** run fn(X, s) for the left side (X = identity) and the mirrored right side */
  const both = (W, fn) => { fn((x) => x, 1); fn((x) => W - 1 - x, -1); };

  // ------------------------------------------------------------ shading
  /** bounding box [x0, y0, x1, y1] of a mask's opaque pixels (null if empty) */
  function bbox(m) {
    let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x] != null) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  /**
   * Exact Euclidean distance (px) from each mask pixel to the nearest outside
   * pixel (Felzenszwalb transform, run only over the mask's bounding box).
   */
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
  /** normal of an ellipsoid proxy form (outside it the normal lies flat) */
  function sphereN(cx, cy, rx, ry) {
    return (x, y) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 >= 0.98) { const d = Math.sqrt(d2); return [dx / d * 0.99, dy / d * 0.99, 0.14]; }
      return [dx, dy, Math.sqrt(1 - d2)];
    };
  }
  /** normal of a vertical cylinder proxy (limbs, pillars) centred on x = cx */
  function cylN(cx, rx) {
    return (x) => { const dx = Math.max(-0.99, Math.min(0.99, (x - cx) / rx)); return [dx, 0, Math.sqrt(1 - dx * dx)]; };
  }
  /**
   * Shade a mask with a ramp. The silhouette's distance field gives a rounded
   * bevel (o.depth px); normals from it, optionally blended with a proxy form
   * (o.normal, o.blend = share of the silhouette's own normals), are lit by
   * o.light [x,y,z]. o: {amb, global (whole-shape gradient toward the light),
   * bias, gamma, dither (checker between bands), rim (reflected light: ramp steps
   * added on the lower/right edge), back:{L,c,t,edge} (coloured back light on
   * edges facing L), flat (0..1 flatten normals: plates, blades), spec (dot above
   * which the top colour is used)}
   */
  function shade(m, rmp, o) {
    o = o || {};
    const w = m.w, h = m.h, n = rmp.length, depth = o.depth || 5;
    const out = G().pix(w, h);
    const bb = bbox(m);
    if (!bb) return out;
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
    const backs = (o.back ? (Array.isArray(o.back) ? o.back : [o.back]) : []).map((b) => {
      const v = b.L || [0.4, 0.8, 0.2], bl = Math.hypot(v[0], v[1], v[2]);
      return { L: [v[0] / bl, v[1] / bl, v[2] / bl], c: b.c, t: b.t == null ? 0.35 : b.t, edge: b.edge || 1.6 };
    });
    const amb = o.amb == null ? 0.08 : o.amb, glob = o.global == null ? 0.22 : o.global;
    const gamma = o.gamma || 1, flat = o.flat || 0;
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
      if (gamma !== 1) v = Math.pow(v, gamma);
      v += glob * (((x - cx) / hw) * L[0] + ((y - cy) / hh) * L[1]) * 0.5;
      v += o.bias || 0;
      const f = Math.max(0, Math.min(0.999, v)) * n;
      let k = Math.floor(f);
      if (o.dither && (x + y) % 2 && f - k > 0.7) k++;
      if (o.rim && D[i] < 1.3 && (!inside(x + 1, y) || !inside(x, y + 1)) && ny + nx * 0.5 > 0.1 && dot < 0.45) k += o.rim;
      if (o.spec != null && dot > o.spec) k = n - 1;
      let col = rmp[Math.max(0, Math.min(n - 1, k))];
      for (const b of backs) if (D[i] < b.edge && nx * b.L[0] + ny * b.L[1] + nz * b.L[2] > b.t) col = b.c;
      out.d[i] = col;
    }
    return out;
  }
  /** build a mask with fn(mask) and shade it */
  function part(w, h, fn, rmp, o) { const m = mask(w, h); fn(m); return shade(m, rmp, o); }
  /**
   * Layer src over dst. line: a colour, or 'dark', for a contour drawn where
   * src's edge crosses pixels already in dst (inner outline between parts).
   */
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
  /** shift pixels painted with ramp rmp by fn(x,y) steps (+ = lighter) */
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
  /** set a pixel only where p already has something (details that must not grow the silhouette) */
  function on(p, x, y, c) { x = Math.round(x); y = Math.round(y); if (p.get(x, y) != null) p.set(x, y, c); }
  /** stamp a small grid with a palette */
  function stamp(p, x, y, rows, pal) { p.grid(x, y, rows, pal); return p; }
  /** radial glow painted over existing pixels: cols outer → inner */
  function glow(p, cx, cy, r, cols, all) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d > 1 || (!all && p.get(x, y) == null)) continue;
      p.set(x, y, cols[Math.min(cols.length - 1, Math.floor((1 - d) * cols.length))]);
    }
    return p;
  }
  /**
   * Branching crack network inside mask m (random walks from seeds), drawn as a
   * glowing core with a darker rim: cols = [rim, core, hot].
   */
  function cracks(p, m, seed, n, len, cols) {
    const r = rng(seed);
    const pts = [];
    m.each((x, y) => { pts.push([x, y]); });
    if (!pts.length) return p;
    const walk = (x, y, a, L, depth) => {
      for (let i = 0; i < L; i++) {
        a += (r() - 0.5) * 1.1;
        const nx = x + Math.cos(a), ny = y + Math.sin(a);
        if (m.get(Math.round(nx), Math.round(ny)) == null) return;
        x = nx; y = ny;
        const X = Math.round(x), Y = Math.round(y);
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (p.get(X + dx, Y + dy) !== cols[1] && p.get(X + dx, Y + dy) !== cols[2] && m.get(X + dx, Y + dy) != null) p.set(X + dx, Y + dy, cols[0]);
        p.set(X, Y, i > 1 && i < L - 2 && depth === 0 ? cols[2] : cols[1]);
        if (depth < 2 && r() < 0.12) walk(x, y, a + (r() < 0.5 ? 1 : -1) * (0.7 + r() * 0.6), Math.floor(L * 0.5), depth + 1);
      }
    };
    for (let k = 0; k < n; k++) { const q = pts[Math.floor(r() * pts.length)]; walk(q[0], q[1], r() * Math.PI * 2, len, 0); }
    return p;
  }
  /**
   * Scale / plate texture over ramp-painted pixels: rows of overlapping
   * half-discs (w x h cells, alternate rows offset). Each scale gets a dark lower
   * rim and a lit upper-left crescent.
   */
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
  /**
   * Rim light on the composed sprite's outer silhouette only: every pixel with
   * src(colour) true that borders a pixel with nb(colour) true (null = empty)
   * on a side facing one of o.dirs [{d:[x,y], c}] takes that colour.
   */
  function edgeLight(p, o) {
    const src = p.d.slice(), w = p.w, h = p.h;
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (c == null || !o.src(c)) continue;
      for (const r of o.dirs) {
        const dx = Math.sign(r.d[0]), dy = Math.sign(r.d[1]);
        if ((dx && o.nb(at(x + dx, y))) || (dy && o.nb(at(x, y + dy)))) { p.d[y * w + x] = r.c; break; }
      }
    }
    return p;
  }
  /**
   * Close the sprite: keep a 1-px margin for the outline, stand the lowest pixel
   * on the second-to-last row (unless o.float), outline in OUT, then o.post(q) draws fine
   * un-outlined details (they may only cover the sprite or its outline).
   */
  function finish(p, o) {
    o = o || {};
    let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
    p.each((x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    let dx = 0, dy = 0;
    if (x0 < 1) dx = 1 - x0;
    if (x1 + dx > p.w - 2) dx = p.w - 2 - x1;
    if (!o.float || y1 > p.h - 2) dy = p.h - 2 - y1;
    if (y0 + dy < 1 && y1 - y0 <= p.h - 3) dy = 1 - y0; // too tall: the feet win, the top clips
    if (dx || dy) { const q = G().pix(p.w, p.h); q.blit(p, dx, dy); p.d = q.d; }
    p.outline(OUT);
    if (o.post) {
      const q = G().pix(p.w, p.h);
      o.post(q);
      q.each((x, y, c) => { if (p.get(x + dx, y + dy) != null || o.free) p.set(x + dx, y + dy, c); });
    }
    return p.toCanvas();
  }

  // ------------------------------------------------------------ shared materials
  const GOLD = ['#3c1c0c', '#6a3410', '#a2601a', '#d09028', '#f0c040', '#fae078', '#fff8d0'];
  const STEEL = ['#1e1c2c', '#343648', '#50566a', '#737c90', '#9ca6b6', '#c8d0da', '#f0f4f8'];
  const EYE_RED = ['#801010', '#d02818', '#ff6a30', '#ffd080'];
  const FIRE = ['#6a1008', '#b02810', '#e05818', '#f89028', '#ffc848', '#fff0a0', '#fffff0'];

  const S = {};

  // ================================================================ goblin chief
  // A hulking goblin warlord: crude spiked gold crown, tusked underbite, war paint,
  // a shaggy fur mantle, one spiked pauldron, and a huge notched cleaver raised
  // over his shoulder. 64x64.
  S.boss_goblin_chief = () => {
    const W = 64, H = 64;
    const skin = ramp('#6f9e3a', 7, { dark: 0.74, light: 0.72 });
    const fur = ramp('#8a5a34', 6, { dark: 0.72 });
    const leather = ramp('#6e4428', 5, { dark: 0.66 });
    const cloth = ramp('#a8302a', 5, { dark: 0.66 });
    const wood = ramp('#7a5030', 5);
    const bone = ramp('#d8cca8', 5, { dark: 0.55 });
    const p = G().pix(W, H);

    // --- cleaver (back): crude slab with a hooked tip, spine toward the head
    const blade = [[12, 23], [17.5, 4], [15, 0.6], [3, 0.8], [-0.5, 5], [0, 19.5], [6.5, 24]];
    const bl = part(W, H, (g) => g.poly(blade, 1), STEEL, { depth: 2, flat: 0.6, global: 0.8, light: [-0.7, -0.6, 0.5], bias: -0.12, dither: true });
    // chipped cutting edge (outer), bright bevel, dark spine, rust and a hanging hole
    for (const [x, y] of [[0, 9], [0, 10], [1, 10], [0, 15], [0, 14]]) bl.set(x, y, null);
    for (let y = 1; y <= 21; y++) {
      const e = y < 5 ? 1 + (5 - y) * 0.45 : y > 19 ? 1 + (y - 19) * 1.2 : 1;
      on(bl, Math.round(e), y, STEEL[6]); on(bl, Math.round(e) + 1, y, STEEL[5]); on(bl, Math.round(e) + 2, y, STEEL[4]);
    }
    curve(bl, [[16, 1], [13.5, 12], [11, 22]], STEEL[0]);
    curve(bl, [[15, 1.5], [12.5, 12], [10, 22]], STEEL[1]);
    const rr = rng(5);
    for (let i = 0; i < 16; i++) { const x = 5 + Math.floor(rr() * 8), y = 2 + Math.floor(rr() * 19); on(bl, x, y, rr() < 0.5 ? '#7a4028' : '#a85a34'); }
    stamp(bl, 11, 3, ['.kk.', 'kkkk', '.kk.'], { k: OUT });
    put(p, bl);

    // --- handle through the raised fist
    const hd = part(W, H, (g) => cap(g, 9.5, 21, 12, 36, 1.8), wood, { depth: 1.5 });
    for (const y of [22, 24, 31, 33]) { on(hd, 9 + (y - 20) * 0.17, y, leather[0]); on(hd, 10 + (y - 20) * 0.17, y, leather[1]); on(hd, 11 + (y - 20) * 0.17, y, leather[2]); }
    put(p, hd, 'dark');
    stamp(p, 10, 35, ['.bb.', 'bBBb', '.bb.'], { b: bone[1], B: bone[3] });

    // --- torso: barrel chest, gut
    const tm = mask(W, H);
    tm.ellipse(32, 38, 14.5, 11.5, 1);
    tm.ellipse(32, 31, 16.5, 6.5, 1);
    const torso = shade(tm, skin, { depth: 6, normal: sphereN(30, 34, 17, 15), blend: 0.35, rim: 1 });
    // pectorals, gut line, navel
    curve(torso, [[21, 33], [26, 36], [31, 34]], skin[1]);
    curve(torso, [[33, 34], [38, 36], [43, 33]], skin[1]);
    curve(torso, [[21, 34], [26, 37], [31, 35]], skin[2]);
    bump(torso, skin, (x, y) => { const d = Math.hypot((x - 32) / 9, (y - 42.5) / 6.5); return d < 0.55 ? 1 : 0; });
    curve(torso, [[24, 39], [32, 37.5], [40, 39]], skin[2]);
    torso.set(32, 43, skin[0]); torso.set(32, 44, skin[1]);
    // old scars across the chest
    torso.line(35, 29, 40, 35, skin[5]); torso.line(36, 29, 41, 35, skin[1]);
    put(p, torso, 'dark');

    // --- legs, feet with wraps
    const lg = mask(W, H);
    cap(lg, 24, 47, 21.5, 57, 5.2, 4.4); cap(lg, 40, 47, 42.5, 57, 5.2, 4.4);
    const legs = shade(lg, skin, { depth: 4, bias: -0.08, rim: 1 });
    for (const y of [52, 54, 56]) for (const [a, b] of [[17, 26], [38, 47]]) for (let x = a; x <= b; x++) on(legs, x, y, (x + y) % 3 ? leather[2] : leather[1]);
    put(p, legs, 'dark');
    const ft = part(W, H, (g) => { g.ellipse(19.5, 59.3, 6, 2.8, 1); g.ellipse(44.5, 59.3, 6, 2.8, 1); }, skin, { depth: 2.5, bias: -0.05 });
    for (const x of [14, 16, 18, 46, 48, 50]) { on(ft, x, 62, bone[3]); on(ft, x, 61, bone[1]); }
    put(p, ft, 'dark');

    // --- belt with a skull buckle, ragged loincloth
    const lc = part(W, H, (g) => g.poly([[25, 46], [39, 46], [40.5, 58], [37, 56.5], [35, 59.5], [32, 57], [29, 59.5], [27, 56.5], [23.5, 58]], 1), cloth, { depth: 2.5, global: 0.4 });
    for (const x of [28, 32, 36]) curve(lc, [[x, 48], [x - 0.5, 52], [x, 56]], cloth[1]);
    put(p, lc, 'dark');
    const bt = part(W, H, (g) => g.poly([[18.5, 43.5], [45.5, 43.5], [45, 47.5], [19, 47.5]], 1), leather, { depth: 1.5, global: 0.3 });
    for (let x = 20; x <= 44; x += 4) { on(bt, x, 45, '#b8b8c0'); on(bt, x, 46, '#606070'); }
    put(p, bt, 'dark');
    stamp(p, 29, 42, [
      '.bbbbb.',
      'bBBBBBb',
      'bkkBkkb',
      'bkrBkrb',
      '.bBkBb.',
      '.bkbkb.',
    ], { b: bone[2], B: bone[4], k: INK, r: '#ff4020' });

    // --- far arm (viewer's right): hangs with a clenched fist and spiked bracer
    const ra = mask(W, H);
    cap(ra, 45, 29, 53, 37, 5, 4.2); cap(ra, 53, 37, 52, 45, 4.2, 3.8);
    const rarm = shade(ra, skin, { depth: 4, rim: 1, normal: cylN(50, 7), blend: 0.5 });
    put(p, rarm, 'dark');
    const br = part(W, H, (g) => { cap(g, 53, 40, 52.7, 42.5, 4.5, 4.3); }, STEEL.slice(0, 6), { depth: 2, bias: -0.1 });
    for (const x of [49, 52, 55]) { br.set(x, 40, STEEL[5]); br.set(x, 42, STEEL[1]); }
    put(p, br, 'dark');
    for (const [bx, by, tx, ty] of [[56.5, 40, 60, 38], [56.5, 42.5, 60, 43]]) put(p, part(W, H, (g) => cap(g, bx, by, tx, ty, 1.3, 0.3), STEEL, { depth: 1 }), 'dark');
    const rf = part(W, H, (g) => g.ellipse(52, 47, 4.2, 3.6, 1), skin, { depth: 3, rim: 1 });
    for (const x of [49, 51, 53]) rf.set(x, 49, skin[1]);
    rf.set(55, 46, skin[1]);
    put(p, rf, 'dark');

    // --- near arm (viewer's left): raised, bulging bicep, fist gripping the cleaver
    const la = mask(W, H);
    cap(la, 19, 30, 9.5, 37.5, 5.6, 4.6); cap(la, 9.5, 37.5, 10, 30, 4.6, 4);
    const larm = shade(la, skin, { depth: 4, rim: 1 });
    curve(larm, [[16, 34], [12.5, 36.5], [10, 36]], skin[2]);
    put(p, larm, 'dark');
    const lb = part(W, H, (g) => cap(g, 9.8, 31.5, 9.9, 34, 4.4), leather, { depth: 2 });
    for (const y of [32, 34]) { lb.set(6, y, STEEL[5]); lb.set(13, y, STEEL[3]); }
    put(p, lb, 'dark');
    const lf = part(W, H, (g) => g.ellipse(10.5, 27.5, 4.6, 3.8, 1), skin, { depth: 3, rim: 1, bias: 0.05 });
    for (const y of [26, 28, 30]) { lf.hline(9, 14, y, skin[1]); lf.set(8, y, skin[2]); }
    lf.hline(7, 10, 24, skin[5]);
    put(p, lf, 'dark');

    // --- shaggy fur mantle across the shoulders (behind the head)
    const fm = mask(W, H);
    fm.ellipse(32, 27.5, 18, 5.5, 1);
    for (let i = 0; i < 12; i++) { const x = 16 + i * 2.9, y = 31.5 + (i % 2) * 1.5 + (i % 3 === 0 ? 1 : 0); cap(fm, x, 28, x + 0.6, y, 1.6, 0.8); }
    const mantle = shade(fm, fur, { depth: 3, normal: sphereN(30, 24, 20, 10), blend: 0.45, rim: 1 });
    const fr = rng(11);
    for (let i = 0; i < 60; i++) {
      const x = 15 + Math.floor(fr() * 34), y = 23 + Math.floor(fr() * 9);
      if (mantle.get(x, y) != null && mantle.get(x + 1, y + 2) != null) { mantle.set(x, y, fur[1]); mantle.set(x + 1, y + 1, fur[1]); mantle.set(x + 1, y + 2, fur[2]); }
    }
    put(p, mantle, 'dark');

    // --- spiked iron pauldron on the far shoulder
    const pm = mask(W, H);
    pm.ellipse(46.5, 27.5, 7.2, 5, 1);
    const pd = shade(pm, STEEL, { depth: 3, normal: sphereN(45, 25, 8, 6), blend: 0.3, spec: 0.93 });
    curve(pd, [[40, 29], [46.5, 31], [53, 29]], STEEL[1]);
    for (const [x, y] of [[43, 26], [47, 25], [50, 27]]) on(pd, x, y, '#8a4a2a');
    put(p, pd, 'dark');
    for (const [bx, by, tx, ty] of [[42, 24, 40, 17], [47, 23, 47.5, 15.5], [51.5, 25, 56, 19.5]]) {
      const sp = part(W, H, (g) => cap(g, bx, by, tx, ty, 2, 0.3), STEEL, { depth: 1.5, light: [-0.8, -0.3, 0.5] });
      put(p, sp, 'dark');
    }

    // --- ears (behind the head): long, pointed, drooping, notched
    const em = mask(W, H);
    em.poly([[24, 13], [2.5, 9.5], [5, 12.5], [24, 20]], 1);
    em.poly([[40, 13], [61.5, 9.5], [59, 12.5], [40, 20]], 1);
    const ears = shade(em, skin, { depth: 2.5, light: [-0.4, -0.8, 0.6], rim: 1 });
    const ein = part(W, H, (g) => { g.poly([[22, 14.5], [7, 11.5], [22, 17.5]], 1); g.poly([[42, 14.5], [57, 11.5], [42, 17.5]], 1); }, ['#8a3a3a', '#b05a52', '#cc7a68'], { depth: 1.5, light: [0.3, 0.8, 0.5] });
    put(ears, ein);
    ears.set(8, 10, null); ears.set(9, 10, null); ears.set(9, 11, OUT); // notch
    put(p, ears, 'dark');

    // --- head: broad skull, heavy jaw
    const hm = mask(W, H);
    hm.ellipse(32, 15, 9.5, 8, 1);
    hm.ellipse(32, 20.5, 11, 5.5, 1);
    const head = shade(hm, skin, { depth: 5, normal: sphereN(30, 14, 12, 11), blend: 0.35, rim: 1 });
    // brow ridge, cheekbones, war paint
    bump(head, skin, (x, y) => (y === 12 && x > 23 && x < 41 ? 1 : 0));
    both(W, (X) => { head.line(X(23), 18, X(27), 18, '#b0282a'); head.line(X(23), 19, X(26), 19, '#80181c'); });
    put(p, head, 'dark');
    // angry brow and glowing eyes
    both(W, (X) => {
      p.line(X(24), 12, X(30), 14, INK); p.line(X(24), 13, X(29), 15, skin[1]);
      p.set(X(25), 15, INK); p.set(X(26), 15, EYE_RED[3]); p.set(X(27), 15, EYE_RED[2]); p.set(X(28), 15, INK);
      p.set(X(25), 16, INK); p.set(X(26), 16, EYE_RED[2]); p.set(X(27), 16, EYE_RED[1]); p.set(X(28), 16, INK);
      p.set(X(26), 17, INK); p.set(X(27), 17, INK);
    });
    // broad nose
    stamp(p, 30, 16, ['.ab.', 'abba', 'kbbk'], { a: skin[3], b: skin[2], k: skin[0] });
    // wide mouth, underbite tusks, teeth
    p.hline(25, 38, 22, INK); p.set(24, 21, INK); p.set(39, 21, INK);
    p.hline(26, 37, 23, '#5a1818'); p.hline(27, 36, 24, INK);
    for (const x of [28, 30, 33, 35]) p.set(x, 22, WHITE);
    for (const [x, s] of [[26, 1], [37, -1]]) {
      p.set(x, 23, bone[3]); p.set(x, 22, bone[4]); p.set(x, 21, bone[4]); p.set(x + s, 20, bone[4]); p.set(x, 24, bone[2]);
      p.set(x - s, 21, INK); p.set(x - s, 22, INK);
    }

    // --- crude spiked crown with a red gem
    const cm = mask(W, H);
    cm.poly([[22.5, 9.5], [41.5, 9.5], [40.5, 5.5], [23.5, 5.5]], 1);
    for (const [x, t] of [[24.5, 1.5], [28.5, 2.5], [32, 0.8], [35.5, 2.5], [39.5, 1.5]]) cm.poly([[x - 2, 6], [x + 2, 6], [x, t]], 1);
    const crown = shade(cm, GOLD, { depth: 1.8, flat: 0.3, global: 0.6, spec: 0.9 });
    crown.hline(23, 41, 9, GOLD[1]);
    for (const x of [25, 30, 34, 39]) { crown.set(x, 8, GOLD[1]); crown.set(x, 7, GOLD[5]); }
    put(p, crown, 'dark');
    stamp(p, 31, 6, ['.r.', 'rRr', '.r.'], { r: '#a01820', R: '#ff5a48' });
    p.set(31, 6, '#ffd0c0');

    return finish(p);
  };

  // ================================================================ bandit chief
  // ガロン: a burly bandit chief, bare hairy chest crossed by a knife bandolier,
  // sleeveless leather vest, red bandana with trailing knot, a scar through one
  // eye, stubble and a gold tooth; one hand axe raised high, the other swung low.
  // 64x64.
  S.boss_bandit = () => {
    const W = 64, H = 64;
    const skin = ramp('#c88a5c', 7, { dark: 0.7, light: 0.7 });
    const vest = ramp('#5e3c2a', 6, { dark: 0.72 });
    const strap = ramp('#8a5a36', 5, { dark: 0.66 });
    const pants = ramp('#4a4478', 6, { dark: 0.72 });
    const boot = ramp('#46302a', 5, { dark: 0.72, light: 0.5 });
    const band = ramp('#c42a34', 5, { dark: 0.66 });
    const sash = ramp('#d8a040', 5, { dark: 0.6 });
    const wood = ramp('#8a5a32', 5);
    const hair = ['#140c10', '#2a1a1c', '#40282a'];
    const p = G().pix(W, H);

    // an axe: grip end (hx0,hy0) to head end (hx1,hy1), bit facing dir (±1)
    function axe(hx0, hy0, hx1, hy1, dir) {
      put(p, part(W, H, (g) => cap(g, hx0, hy0, hx1, hy1, 1.5), wood, { depth: 1.2 }), 'dark');
      const ax = hx1, ay = hy1;
      const pts = [[ax - dir * 1, ay - 3.5], [ax + dir * 5, ay - 5], [ax + dir * 8.5, ay - 7], [ax + dir * 10, ay], [ax + dir * 8.5, ay + 7], [ax + dir * 5, ay + 5], [ax - dir * 1, ay + 3.5], [ax - dir * 3.5, ay + 1.5], [ax - dir * 3.5, ay - 1.5]];
      const hb = part(W, H, (g) => g.poly(pts, 1), STEEL, { depth: 2, flat: 0.4, global: 0.6, bias: -0.12, light: [-0.6, -0.7, 0.5] });
      for (let t = -6; t <= 6; t++) {
        const ex = Math.round(ax + dir * (9.6 - Math.abs(t) * 0.22));
        on(hb, ex, ay + t, STEEL[6]); on(hb, ex - dir, ay + t, STEEL[5]);
      }
      for (let t = -2; t <= 2; t++) { on(hb, ax, ay + t, STEEL[1]); on(hb, ax - dir, ay + t, STEEL[0]); }
      on(hb, ax + dir * 4, ay - 2, '#8a4a2a'); on(hb, ax + dir * 5, ay + 3, '#8a4a2a');
      put(p, hb, 'dark');
      put(p, part(W, H, (g) => g.ellipse(hx0, hy0, 1.7, 1.7, 1), STEEL, { depth: 1.2 }), 'dark');
    }
    axe(50.5, 21, 52.5, 8, 1);
    axe(14, 38, 12, 54, -1);

    // --- legs: baggy trousers bloused into cuffed boots
    const lm = mask(W, H);
    cap(lm, 26.5, 43, 24.5, 53, 6.2, 5.6); cap(lm, 37.5, 43, 39.5, 53, 6.2, 5.6);
    const legs = shade(lm, pants, { depth: 4, rim: 1 });
    for (const [x0, y0, x1, y1] of [[21, 45, 22, 53], [27, 47, 26, 54], [37, 47, 38, 54], [43, 45, 42, 53]]) legs.line(x0, y0, x1, y1, pants[1]);
    legs.vline(32, 43, 48, pants[0]);
    put(p, legs, 'dark');
    const bm = mask(W, H);
    cap(bm, 23.5, 55.5, 23, 57.8, 5, 4.6); cap(bm, 40.5, 55.5, 41, 57.8, 5, 4.6);
    bm.ellipse(21.5, 60.3, 6.2, 1.8, 1); bm.ellipse(42.5, 60.3, 6.2, 1.8, 1);
    const boots = shade(bm, boot, { depth: 3, rim: 1 });
    for (const [a, b] of [[18, 28], [36, 46]]) { boots.hline(a, b, 55, boot[4]); boots.hline(a, b, 56, boot[2]); }
    for (const x of [23, 41]) { boots.set(x, 58, '#c0c0c8'); boots.set(x, 59, '#707080'); }
    put(p, boots, 'dark');

    // --- torso: bare hairy chest and belly
    const tm = mask(W, H);
    tm.ellipse(32, 31, 13, 8, 1);
    cap(tm, 32, 34, 32, 40, 10.5, 9.5);
    tm.ellipse(32, 25.5, 16, 5, 1);
    const torso = shade(tm, skin, { depth: 6, normal: sphereN(30, 31, 16, 15), blend: 0.35, rim: 1 });
    curve(torso, [[23, 33], [27.5, 35.5], [31.5, 33.5]], skin[1]); curve(torso, [[32.5, 33.5], [36.5, 35.5], [41, 33]], skin[1]);
    curve(torso, [[23, 34], [27.5, 36.5], [31.5, 34.5]], skin[2]);
    for (const y of [37, 39]) { torso.hline(28, 30, y, skin[2]); torso.hline(34, 36, y, skin[2]); }
    torso.vline(32, 36, 40, skin[2]);
    const hr = rng(3);
    for (let i = 0; i < 22; i++) { const x = 27 + Math.floor(hr() * 11), y = 28 + Math.floor(hr() * 6); if (Math.abs(x - 32) < 6 - (y - 28) * 0.6) torso.set(x, y, hr() < 0.5 ? hair[2] : skin[1]); }
    torso.set(32, 40, skin[0]);
    put(p, torso, 'dark');

    // --- sleeveless vest along the flanks
    const vm = mask(W, H);
    vm.poly([[16.5, 24.5], [24.5, 23.5], [24, 31], [21.5, 41.5], [19, 41.5], [17.5, 33]], 1);
    vm.poly([[47.5, 24.5], [39.5, 23.5], [40, 31], [42.5, 41.5], [45, 41.5], [46.5, 33]], 1);
    const vst = shade(vm, vest, { depth: 2.5, rim: 1, global: 0.35 });
    vst.line(24, 25, 21, 41, vest[4]); vst.line(40, 25, 43, 41, vest[1]);
    for (const [x, y] of [[20, 30], [20, 36], [44, 30], [44, 36]]) { vst.set(x, y, GOLD[4]); vst.set(x, y + 1, GOLD[1]); }
    put(p, vst, 'dark');

    // --- bandolier: left shoulder to right hip, with throwing knives
    const sm = mask(W, H);
    cap(sm, 22.5, 24.5, 42.5, 40, 2.2);
    const st = shade(sm, strap, { depth: 1.5, global: 0.4 });
    put(p, st, 'dark');
    for (const t of [0.22, 0.42, 0.62]) {
      const x = Math.round(22.5 + 20 * t), y = Math.round(24.5 + 15.5 * t);
      p.set(x - 1, y - 2, STEEL[5]); p.set(x - 1, y - 3, STEEL[6]); p.set(x, y - 2, STEEL[3]);
      p.set(x - 1, y - 1, '#3a2418'); p.set(x, y - 1, '#3a2418'); p.set(x, y, '#3a2418');
    }
    stamp(p, 25, 26, ['GG', 'Gg'], { G: GOLD[4], g: GOLD[2] });

    // --- sash with trailing end, gold buckle belt
    const sa = part(W, H, (g) => { g.poly([[20, 39.5], [44, 39.5], [44.5, 44], [19.5, 44]], 1); cap(g, 23, 43, 20, 49, 1.8, 1.4); }, sash, { depth: 1.8, global: 0.4 });
    sa.line(21, 41, 43, 41, sash[1]); sa.line(22, 45, 20, 48, sash[1]);
    put(p, sa, 'dark');
    const bk = part(W, H, (g) => g.rect(29, 39.5, 6, 5, 1), GOLD, { depth: 1.5, flat: 0.3, spec: 0.9 });
    bk.rect(30.5, 41, 3, 2, GOLD[1]);
    put(p, bk, 'dark');

    // --- low arm (viewer's left): hangs out, fist around the low axe
    const la = mask(W, H);
    cap(la, 17.5, 27.5, 13, 34, 5.3, 4.4); cap(la, 13, 34, 14, 37.5, 4.2, 3.8);
    const larm = shade(la, skin, { depth: 4, rim: 1 });
    curve(larm, [[16, 30], [14, 32.5], [12, 32.5]], skin[2]);
    put(p, larm, 'dark');
    put(p, part(W, H, (g) => cap(g, 13.4, 35, 13.7, 37, 4.3), strap, { depth: 2 }), 'dark');
    const lf = part(W, H, (g) => g.ellipse(14, 39.5, 3.8, 3.2, 1), skin, { depth: 2.5, rim: 1 });
    for (const x of [12, 14, 16]) lf.set(x, 39, skin[1]);
    put(p, lf, 'dark');

    // --- raised arm (viewer's right): elbow out, fist high on the axe
    const ra = mask(W, H);
    cap(ra, 46.5, 27.5, 54.5, 26, 5.3, 4.5); cap(ra, 54.5, 26, 52, 20, 4.4, 3.9);
    const rarm = shade(ra, skin, { depth: 4, rim: 1 });
    curve(rarm, [[48, 25], [52, 24], [55, 23]], skin[5]);
    put(p, rarm, 'dark');
    put(p, part(W, H, (g) => cap(g, 53, 22.5, 52.6, 21, 4.2), strap, { depth: 2 }), 'dark');
    const rf = part(W, H, (g) => g.ellipse(52, 17.5, 3.8, 3.2, 1), skin, { depth: 2.5, rim: 1, bias: 0.05 });
    for (const y of [16, 18]) rf.hline(50, 54, y, skin[1]);
    put(p, rf, 'dark');

    // --- head: square jaw on a thick neck
    put(p, part(W, H, (g) => cap(g, 32, 17, 32, 22, 5.5, 6.5), skin, { depth: 3, bias: -0.15 }), 'dark');
    for (const x of [24.5, 39.5]) put(p, part(W, H, (g) => g.ellipse(x, 13.5, 1.6, 2.4, 1), skin, { depth: 1.2, bias: -0.1 }), 'dark');
    const hm = mask(W, H);
    hm.ellipse(32, 12, 7, 7.5, 1);
    hm.poly([[25, 12], [39, 12], [38.5, 18], [35, 21.5], [29, 21.5], [25.5, 18]], 1);
    const head = shade(hm, skin, { depth: 4, normal: sphereN(30.5, 11.5, 9, 10), blend: 0.35, rim: 1 });
    head.each((x, y, c) => (y >= 17 && ((x + y) % 2 === 0 || y >= 20) ? mix(c, '#2a1c20', 0.42) : undefined));
    put(p, head, 'dark');
    stamp(p, 23, 15, ['g', 'G', 'g'], { g: GOLD[4], G: GOLD[2] });
    p.set(22, 16, GOLD[5]); p.set(24, 17, GOLD[2]);
    // face: angry brows, one glaring eye, the other scarred shut
    stamp(p, 25, 10, [
      '.hhhh....hhhh..',
      '...hhh..hhh....',
      '.kwwpk...kkkk..',
      '..kkk..n.......',
      '......nN.......',
      '......NNN......',
      '...hhh..hhh....',
      '...kmmmmmmk....',
      '....ktgttk.....',
      '.....kkkk......',
    ], { h: hair[0], k: INK, w: WHITE, p: '#5a2a18', n: skin[4], N: skin[1], m: '#5a1818', t: WHITE, g: GOLD[4] });
    p.line(35, 8, 37, 17, '#f0c0a8'); p.line(36, 8, 38, 17, '#8a3a30');

    // --- bandana with a knot and tails flapping to the left
    const bn = mask(W, H);
    bn.ellipse(32, 6.5, 7.8, 5, 1);
    bn.rect(24, 6, 16, 4, 1);
    bn.ellipse(22.5, 9, 2.4, 2, 1);
    tube(bn, [[21, 10], [17, 11], [13, 9]], 1.8, 1.1);
    tube(bn, [[21, 11], [18, 14], [14, 15]], 1.6, 0.9);
    const bnd = shade(bn, band, { depth: 3, normal: sphereN(30, 5, 10, 8), blend: 0.4, rim: 1 });
    bnd.hline(25, 39, 10, band[0]);
    for (const [x, y] of [[28, 4], [33, 3], [37, 6], [30, 8], [35, 8], [26, 6], [16, 11]]) { on(bnd, x, y, '#f4e8e0'); on(bnd, x + 1, y, '#c8a8a8'); }
    put(p, bnd, 'dark');
    for (const [x, y] of [[25, 11], [25, 12], [39, 11], [39, 12]]) p.set(x, y, hair[1]);

    return finish(p);
  };

  // ================================================================ lake serpent
  // A sea serpent rearing out of the lake in an S-curve: crimson fan-fins with
  // dark spines, glowing yellow slit eyes, open fanged maw, cream belly plates,
  // a back coil and tail fin breaking the surface, foaming water at the base.
  // 96x80.
  S.boss_serpent = () => {
    const W = 96, H = 80;
    const body = ramp('#2a8a96', 7, { dark: 0.74, light: 0.66 });
    const belly = ramp('#e2d49a', 6, { dark: 0.55, shift: 30 });
    const fin = ramp('#d84a40', 7, { dark: 0.72, light: 0.6 });
    const horn = ramp('#d8d0b0', 5, { dark: 0.6, shift: 30 });
    const water = ['#0c2458', '#15397a', '#1d5494', '#2c78b4', '#52a4d4', '#8cd0ee', '#d4f2fc'];
    const foam = '#f4fcff', SPINE = '#3a0c18';
    const back = { L: [0.25, 0.9, 0.35], c: '#6ad8d0', t: 0.45, edge: 1.4 };
    const p = G().pix(W, H);

    /** fish fan fin: rays from the root to tips, scalloped membrane between them */
    function fan(root, tips) {
      const m = mask(W, H);
      for (let i = 0; i < tips.length - 1; i++) {
        const a = tips[i], b = tips[i + 1];
        const mid = [(a[0] + b[0]) / 2 * 0.78 + root[0] * 0.22, (a[1] + b[1]) / 2 * 0.78 + root[1] * 0.22];
        m.poly([root, a, mid, b], 1);
        m.ellipse(a[0], a[1], 0.8, 0.8, 1);
      }
      m.ellipse(tips[tips.length - 1][0], tips[tips.length - 1][1], 0.8, 0.8, 1);
      const R = Math.max(...tips.map((t) => Math.hypot(t[0] - root[0], t[1] - root[1])));
      const f = G().pix(W, H);
      m.each((x, y) => { const t = Math.hypot(x - root[0], y - root[1]) / R; f.set(x, y, fin[Math.max(1, Math.min(5, Math.floor(1 + t * 4.6 + ((x + y) % 2 ? 0.25 : 0))))]); });
      for (const t of tips) {
        f.line(root[0], root[1], Math.round(t[0]), Math.round(t[1]), SPINE);
        const dx = t[0] - root[0], dy = t[1] - root[1], l = Math.hypot(dx, dy);
        const ox = Math.round(-dy / l), oy = Math.round(dx / l);
        for (let k = 0.25; k <= 0.95; k += 0.05) on(f, Math.round(root[0] + dx * k + ox), Math.round(root[1] + dy * k + oy), fin[6]);
      }
      put(p, f, 'dark');
    }
    /** dorsal frill along a bezier: spines rising along its normals */
    function dorsal(pts, side, n, len, t0, t1) {
      t0 = t0 == null ? 0.05 : t0; t1 = t1 == null ? 0.95 : t1;
      const m = mask(W, H), sp = [];
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n;
        const a = bez(pts, t), b = bez(pts, Math.min(1, t + 0.02));
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx = (nx / l) * side; ny = (ny / l) * side;
        const L = len * (0.55 + 0.45 * Math.sin(Math.PI * (i / n)));
        sp.push([a[0], a[1], a[0] + nx * L - (b[0] - a[0]) * 8, a[1] + ny * L - (b[1] - a[1]) * 8]);
      }
      for (let i = 0; i < sp.length - 1; i++) {
        const s0 = sp[i], s1 = sp[i + 1];
        m.poly([[s0[0], s0[1]], [s0[2], s0[3]], [(s0[2] * 0.6 + s1[0] * 0.4), (s0[3] * 0.6 + s1[1] * 0.4)], [s1[2], s1[3]], [s1[0], s1[1]]], 1);
      }
      const f = shade(m, fin, { depth: 1.6, global: 0.5, bias: 0.08 });
      for (const s of sp) f.line(Math.round(s[0]), Math.round(s[1]), Math.round(s[2]), Math.round(s[3]), SPINE);
      put(p, f, 'dark');
    }

    // --- tail breaking the surface at the left, with a forked fin
    const tp = [[18, 72], [5, 62], [7, 46], [15, 40]];
    dorsal(tp, -1, 5, 4.5, 0.1, 0.85);
    put(p, part(W, H, (g) => tube(g, tp, 5, 1.8), body, { depth: 3, rim: 1, back }), 'dark');
    fan([15, 40], [[9, 33], [11, 29], [16, 31], [21, 28], [22, 35]]);

    // --- back coil arching out of the water on the right
    const cp = [[64, 74], [66, 47], [88, 47], [89, 74]];
    dorsal(cp, -1, 9, 6.5);
    const coil = part(W, H, (g) => tube(g, cp, 6.5, 5.5), body, { depth: 4, rim: 1, back, normal: sphereN(77, 52, 16, 16), blend: 0.5 });
    scales(coil, body, 5, 4, { lit: 1 });
    put(p, coil, 'dark');

    // --- neck: S-curve from the water up to the head
    const np = [[40, 76], [12, 58], [74, 50], [48, 30]];
    dorsal([[40, 76], [12, 58], [74, 50], [48, 30]], 1, 10, 6, 0.08, 0.8);
    const nm = mask(W, H);
    tube(nm, np, 11, 7, 1, 28);
    const neck = shade(nm, body, { depth: 6, rim: 1, back, blend: 0.6 });
    scales(neck, body, 5, 4, { lit: 1 });
    put(p, neck, 'dark');
    // belly plates down the front of the neck
    const bp = [[41, 76], [16, 58], [70, 50], [48, 31]];
    const bmk = mask(W, H);
    tube(bmk, bp, 6.5, 4, 1, 28);
    const bel = shade(bmk, belly, { depth: 3, global: 0.3, light: [-0.4, -0.6, 0.7] });
    for (let i = 1; i < 22; i++) {
      const t = i / 22, a = bez(bp, t), b = bez(bp, t + 0.01);
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const r = 7 - t * 3;
      for (let k = -r; k <= r; k += 0.5) on(bel, Math.round(a[0] + nx * k), Math.round(a[1] + ny * k + 0.7), belly[0]);
      for (let k = -r; k <= r; k += 0.5) on(bel, Math.round(a[0] + nx * k), Math.round(a[1] + ny * k - 0.5), belly[4]);
    }
    put(p, bel, 'dark');

    // --- fan fins either side of the head, and swept-back horn spines
    both(W, (X) => {
      fan([X(37), 19], [[X(28), 3], [X(22), 6], [X(17), 12], [X(16), 19], [X(19), 26], [X(26), 31]]);
    });
    both(W, (X) => {
      put(p, part(W, H, (g) => tube(g, [[X(42), 11], [X(38), 3.5], [X(31), 1.5]], 2.2, 0.4), horn, { depth: 1.5, light: [-0.3, -0.9, 0.4] }), 'dark');
    });

    // --- head: broad armoured skull tapering to a heavy snout
    const hm = mask(W, H);
    hm.ellipse(47.5, 15, 12, 8, 1);
    hm.poly([[35.5, 15], [59.5, 15], [57, 23], [54.5, 29], [40.5, 29], [38, 23]], 1);
    hm.ellipse(47.5, 27, 7.5, 4, 1);
    sym(hm);
    const head = shade(hm, body, { depth: 5, normal: sphereN(46, 14, 14, 13), blend: 0.35, rim: 1 });
    scales(head, body, 4, 3, { lit: 1, mask: (() => { const q = mask(W, H); q.ellipse(47.5, 10, 9, 4, 1); return q; })() });
    put(p, head, 'dark');
    // central crest ridge and snout plates
    for (let y = 7; y <= 24; y++) { on(p, 47, y, y % 3 ? body[5] : body[3]); on(p, 48, y, y % 3 ? body[3] : body[1]); }
    // heavy brow ridges over glowing slit eyes
    both(W, (X) => {
      const br = part(W, H, (g) => cap(g, X(37), 13, X(45), 17, 2.3, 1.6), body, { depth: 1.8, light: [-0.4, -0.9, 0.3], bias: 0.1 });
      put(p, br, 'dark');
      const ex = Math.min(X(39), X(43));
      stamp(p, ex, 17, X(0) === 0 ? ['kkkkk', 'yWykk', 'oyyko', '.kkk.'] : ['kkkkk', 'kkyWy', 'okyyo', '.kkk.'], { y: '#ffe040', W: '#ffffe8', k: INK, o: '#c86010' });
      p.set(X(41), 18, INK);
    });
    // nostrils
    stamp(p, 43, 24, ['kk...kk', '.k...k.'], { k: INK });
    p.set(44, 23, body[5]); p.set(51, 23, body[5]);

    // --- open maw: fangs, throat, forked tongue, lower jaw
    const mw = mask(W, H);
    mw.poly([[40.5, 28.5], [54.5, 28.5], [53, 35], [47.5, 38], [42, 35]], 1);
    const maw = shade(mw, ['#240410', '#420a1a', '#6a1424', '#962a36', '#c04448'], { depth: 3, light: [0, 0.8, 0.6], global: 0.3 });
    stamp(maw, 45, 33, ['.rr.r', 'r..r.'], { r: '#e86a7a' });
    put(p, maw);
    const jaw = part(W, H, (g) => { g.poly([[40.5, 34.5], [54.5, 34.5], [52, 39], [47.5, 40.5], [43, 39]], 1); }, body, { depth: 2, bias: -0.12, back });
    put(p, jaw, 'dark');
    for (const x of [41, 43, 45, 50, 52, 54]) { p.set(x, 29, WHITE); p.set(x, 30, x === 41 || x === 54 ? WHITE : '#d8d0c0'); if (x === 41 || x === 54) p.set(x, 31, '#c8c0b0'); }
    for (const x of [42, 44, 51, 53]) { p.set(x, 34, WHITE); p.set(x, 33, '#d8d0c0'); }
    // barbels trailing from the snout
    both(W, (X) => { curve(p, [[X(39), 28], [X(33), 33], [X(34), 40]], body[1]); curve(p, [[X(39), 27], [X(33), 32], [X(33), 40]], body[4]); });

    // --- water: churning surface around the neck and coils
    const wm = mask(W, H);
    wm.ellipse(48, 72, 46, 6, 1);
    const crest = [[10, 3.5], [24, 4.5], [40, 6], [58, 4], [76, 5], [89, 3.5]];
    for (const [x, r] of crest) wm.ellipse(x, 67.5, r, 2.5, 1);
    wm.rect(0, 78, W, 2, null);
    const wat = shade(wm, water, { depth: 3, light: [-0.3, -0.9, 0.4], global: 0.4, flat: 0.3 });
    wat.each((x, y) => {
      const w = Math.sin(x * 0.42 + y * 1.9) + Math.sin(x * 0.15 - y * 0.8);
      if (y > 70 && w > 1.3) return water[5];
      if (y > 69 && w < -1.35) return water[1];
      return undefined;
    });
    for (const [x, r] of crest) for (let k = -r; k <= r; k++) {
      on(wat, Math.round(x + k), Math.round(65.5 + Math.abs(k) * 0.45), foam);
      on(wat, Math.round(x + k), Math.round(66.5 + Math.abs(k) * 0.45), water[6]);
    }
    put(p, wat);
    p.rect(0, 78, W, 2, null); // whatever sank below the surface
    for (const [x, y] of [[28, 64], [31, 62], [51, 63], [54, 61], [57, 64], [48, 60], [34, 59], [67, 64], [86, 64], [90, 62], [16, 64], [20, 62], [12, 61], [72, 61]]) {
      p.set(x, y, foam); p.set(x + 1, y, water[5]); p.set(x, y + 1, water[5]);
    }

    return finish(p);
  };

  // ================================================================ royal sphinx
  // Guardian of the pyramid: a crouching lion with great banded wings of gold,
  // lapis and turquoise; a stern kohl-eyed face under a striped gold-and-lapis
  // headdress with a sun jewel, a braided beard and a broad jewelled collar.
  // 96x80.
  S.boss_sphinx = () => {
    const W = 96, H = 80;
    const fur = ramp('#d6a04a', 7, { dark: 0.72, light: 0.66 });
    const face = ramp('#d49860', 6, { dark: 0.66 });
    const lapis = ramp('#2a4cb4', 6, { dark: 0.72, light: 0.55 });
    const turq = ramp('#26a8a0', 6, { dark: 0.7 });
    const carn = ramp('#c43a28', 5, { dark: 0.66 });
    const gold = GOLD.slice(1);
    const p = G().pix(W, H);
    const lightL = [-0.45, -0.75, 0.6];

    // --- wings raised in a V: secondaries hang from the arm, primaries fan from
    // the wrist, gold coverts along the leading edge
    both(W, (X, s) => {
      const Sh = [40, 40], Wr = [15.5, 15];
      const at = (t) => [Sh[0] + (Wr[0] - Sh[0]) * t, Sh[1] + (Wr[1] - Sh[1]) * t];
      const feather = (base, ang, len, r, rmp, bias, tip) => {
        const tx = base[0] + Math.cos(ang) * len, ty = base[1] + Math.sin(ang) * len;
        const f = part(W, H, (g) => cap(g, X(base[0]), base[1], X(tx), ty, r, r * 0.75), rmp, { depth: 1.8, light: lightL, global: 0.15, bias });
        // coloured tip band, dark quill
        f.each((x, y, c) => (Math.hypot(x - X(tx), y - ty) < r + 0.4 ? tip[Math.min(tip.length - 1, Math.max(1, rmp.indexOf(c)))] : undefined));
        f.line(X(Math.round(base[0])), Math.round(base[1]), X(Math.round(base[0] + (tx - base[0]) * 0.75)), Math.round(base[1] + (ty - base[1]) * 0.75), rmp[1]);
        put(p, f, 'dark');
      };
      // primaries (lapis), outermost first so inner ones overlap them
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        feather(at(0.8 + 0.2 * t), Math.PI * (-0.5 - 0.52 * t), 11.5 + 5 * Math.sin(t * Math.PI), 2.5, lapis, 0.05 - 0.04 * i, gold);
      }
      // secondaries (turquoise) hanging from the arm
      for (let i = 7; i >= 0; i--) {
        const t = i / 7;
        feather(at(0.1 + 0.68 * t), Math.PI * (0.6 + 0.42 * t), 12 + 5 * t, 2.6, turq, -0.02 * i, lapis);
      }
      // coverts: two rows of small rounded gold feathers along the arm
      for (const [off, n, r, bias] of [[3.2, 9, 2.4, -0.1], [0, 10, 2.1, 0.05]]) {
        for (let i = n - 1; i >= 0; i--) {
          const q = at(0.03 + 0.94 * (i / (n - 1)));
          const cx = q[0] - off * 0.7, cy = q[1] + off;
          const f = part(W, H, (g) => { g.ellipse(X(cx), cy, r, r + 0.6, 1); cap(g, X(cx), cy - 1, X(cx + 1.5), cy - 3, r * 0.8); }, gold, { depth: 1.6, light: lightL, bias });
          put(p, f, 'dark');
        }
      }
    });

    // --- haunches behind the forelegs, tail tuft
    const hm = mask(W, H);
    hm.ellipse(23, 65, 15, 12.5, 1); hm.ellipse(73, 65, 15, 12.5, 1);
    const hs = shade(hm, fur, { depth: 6, light: lightL, rim: 1, bias: -0.1 });
    // thigh contours and a ridge of fur along the back
    both(W, (X) => {
      curve(hs, [[X(12), 60], [X(18), 54], [X(28), 56], [X(34), 64]], fur[2]);
      curve(hs, [[X(12), 61], [X(18), 55], [X(28), 57], [X(34), 65]], fur[5]);
      curve(hs, [[X(16), 68], [X(22), 72], [X(30), 72]], fur[1]);
      for (const x of [14, 18, 22, 26, 30]) { on(hs, X(x), 54 + Math.abs(x - 22) * 0.3, fur[5]); on(hs, X(x + 1), 55 + Math.abs(x - 22) * 0.3, fur[2]); }
    });
    put(p, hs, 'dark');
    put(p, part(W, H, (g) => tube(g, [[12, 73], [3, 73], [5, 63]], 1.6, 1.4), fur, { depth: 1.2 }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(5.5, 60.5, 2.6, 3.2, 1), ramp('#7a4a24', 5), { depth: 2 }), 'dark');

    // --- chest: lion ruff below the collar
    // belly fur between the forelegs, then the chest ruff over it
    const lb = part(W, H, (g) => g.poly([[39, 56], [57, 56], [55, 75], [41, 75]], 1), fur, { depth: 4, light: lightL, normal: cylN(47, 10), blend: 0.4, bias: 0.02 });
    for (let y = 60; y < 75; y += 4) for (let x = 42; x <= 54; x += 4) { lb.set(x, y, fur[2]); lb.set(x + 1, y + 1, fur[2]); lb.set(x - 1, y, fur[4]); }
    put(p, lb, 'dark');
    const cm = mask(W, H);
    cm.ellipse(48, 53, 16, 12, 1);
    const chest = shade(cm, fur, { depth: 6, light: [-0.4, -0.5, 0.8], normal: sphereN(46, 54, 20, 18), blend: 0.3, rim: 1, bias: 0.1 });
    for (let i = 0; i < 13; i++) { const x = 37 + (i % 6) * 4.3 + (Math.floor(i / 6) % 2 ? 2 : 0), y = 47 + Math.floor(i / 6) * 5; curve(chest, [[x, y], [x + 1, y + 3], [x, y + 5]], fur[2]); on(chest, x - 1, y + 1, fur[5]); }
    put(p, chest, 'dark');

    // --- forelegs and great paws, gold armlets
    const lg = mask(W, H);
    cap(lg, 38.5, 55, 37, 70, 6.5, 6); cap(lg, 57.5, 55, 59, 70, 6.5, 6);
    const legs = shade(lg, fur, { depth: 5, light: lightL, rim: 1 });
    for (const x of [33, 63]) curve(legs, [[x, 58], [x + (x < 48 ? 1 : -1), 63], [x, 69]], fur[2]);
    put(p, legs, 'dark');
    const pw = mask(W, H);
    pw.ellipse(35.5, 73.5, 8.5, 4.5, 1); pw.ellipse(60.5, 73.5, 8.5, 4.5, 1);
    const paws = shade(pw, fur, { depth: 3.5, light: lightL, rim: 1 });
    for (const bx of [30, 34, 38, 42, 55, 59, 63, 67]) {
      paws.vline(bx, 72, 76, fur[1]);
      on(paws, bx - 2, 77, '#f4ecd8'); on(paws, bx - 1, 77, '#b8ac98');
    }
    put(p, paws, 'dark');
    for (const [x0, x1] of [[31, 44], [52, 65]]) {
      const ar = part(W, H, (g) => g.rect(x0, 62, x1 - x0 + 1, 4, 1), GOLD, { depth: 1.5, flat: 0.4, spec: 0.92 });
      for (let x = x0 + 2; x <= x1 - 1; x += 3) { ar.set(x, 63, lapis[3]); ar.set(x, 64, lapis[1]); }
      put(p, ar, 'dark');
    }

    // --- headdress lappets: clean horizontal gold / lapis stripes
    const lm = mask(W, H);
    lm.poly([[35, 18], [40.5, 25], [40.5, 43], [29.5, 46], [30.5, 30]], 1);
    sym(lm);
    const lap = shade(lm, lapis, { depth: 3, light: lightL, global: 0.4 });
    lap.each((x, y, c) => (Math.floor((y - 1) / 2) % 2 ? gold[Math.max(0, Math.min(5, lapis.indexOf(c)))] : undefined));
    put(p, lap, 'dark');

    // --- broad collar: gold, carnelian, lapis rows with gold drops
    const ring = (r0, r1, rmp, dots) => {
      const m = mask(W, H);
      m.ellipse(48, 40, r1, r1 * 0.48, 1);
      const inner = mask(W, H); inner.ellipse(48, 40, r0, r0 * 0.48, 1);
      m.each((x, y) => (inner.get(x, y) != null || y < 40 ? null : undefined));
      const b = shade(m, rmp, { depth: 1.2, light: lightL, global: 0.35 });
      if (dots) b.each((x, y, c) => (x % 3 === 0 ? dots : undefined));
      put(p, b, 'dark');
    };
    ring(17, 20.5, lapis, null);
    ring(14, 17, carn, GOLD[4]);
    ring(10, 14, gold, null);
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i / 10));
      const x = Math.round(48 + Math.cos(a) * 20), y = Math.round(40 + Math.sin(a) * 9.8);
      stamp(p, x - 1, y, ['GgG', '.g.'], { G: GOLD[5], g: GOLD[2] });
    }

    // --- head: face, then the striped dome and a winged sun jewel
    const fm = mask(W, H);
    fm.ellipse(48, 24, 8.5, 10, 1);
    fm.poly([[40, 26], [56, 26], [53, 35], [43, 35]], 1);
    const fc = shade(fm, face, { depth: 4, light: lightL, normal: sphereN(47, 23, 10, 12), blend: 0.35, rim: 1 });
    put(p, fc, 'dark');
    const dm = mask(W, H);
    dm.ellipse(48, 14, 14, 10, 1);
    dm.poly([[34, 14], [62, 14], [59.5, 24], [56.5, 21], [39.5, 21], [36.5, 24]], 1);
    const fcut = mask(W, H); fcut.ellipse(48, 24, 8.5, 10, 1);
    dm.each((x, y) => (y >= 16 && fcut.get(x, y) != null ? null : undefined));
    const dome = shade(dm, lapis, { depth: 4, light: lightL, normal: sphereN(46, 12, 15, 12), blend: 0.3 });
    // stripes follow the dome: each column's stripes start at its top edge
    dome.each((x, y, c) => {
      let top = y; while (dm.get(x, top - 1) != null) top--;
      return Math.floor((y - top + 1) / 2) % 2 ? gold[Math.max(0, Math.min(5, lapis.indexOf(c)))] : undefined;
    });
    put(p, dome, 'dark');
    const band = part(W, H, (g) => g.poly([[38.5, 14], [57.5, 14], [57, 16.5], [39, 16.5]], 1), GOLD, { depth: 1.2, flat: 0.4, spec: 0.9 });
    put(p, band, 'dark');
    const jw = part(W, H, (g) => g.ellipse(48, 12, 2.8, 2.8, 1), carn, { depth: 2, light: [-0.5, -0.7, 0.6] });
    jw.set(47, 11, '#ffd8c0');
    put(p, jw, 'dark');
    both(W, (X) => { p.line(X(44), 11, X(40), 9, GOLD[5]); p.line(X(44), 12, X(39), 10, GOLD[3]); p.line(X(44), 13, X(40), 12, GOLD[2]); });

    // --- face: kohl-rimmed glowing eyes, straight nose, stern mouth
    both(W, (X) => {
      p.line(X(41), 19, X(46), 20, face[0]);
      stamp(p, Math.min(X(41), X(46)), 21, X(0) === 0 ? ['kkkkkk', 'kcCWWk', '.kkkkk'] : ['kkkkkk', 'kWWCck', 'kkkkk.'], { k: INK, c: '#30c8c0', C: '#80fff0', W: '#ffffff' });
      p.set(X(40), 23, INK); p.set(X(39), 24, INK);
      p.line(X(42), 25, X(45), 25, face[1]);
    });
    p.vline(48, 22, 27, face[4]); p.vline(47, 23, 27, face[3]); p.set(46, 28, face[1]); p.set(49, 28, face[1]); p.hline(47, 48, 28, face[0]);
    p.hline(45, 51, 31, face[0]); p.set(44, 30, face[2]); p.set(52, 30, face[2]); p.hline(46, 50, 32, face[4]);
    // braided beard
    const bd = part(W, H, (g) => cap(g, 48, 34.5, 48, 40, 2.3, 1.8), GOLD, { depth: 1.5 });
    for (let y = 35; y <= 40; y += 2) bd.hline(46, 50, y, lapis[2]);
    put(p, bd, 'dark');

    return finish(p);
  };

  // ================================================================ frost giant
  // A towering ice giant: jagged ice crown growing from the skull, white mane,
  // glowing eyes under a heavy brow, a beard of icicles, a bear-pelt mantle and
  // loincloth over a bare blue chest, an ice-crystal pauldron and an ice-crusted
  // log club over his shoulder; frost drifts from his open hand. 96x96.
  const ICE = ['#1e3a78', '#2e5ea8', '#4a8cd0', '#78b8ec', '#a8dcf8', '#d8f4ff', '#ffffff'];
  /** faceted ice shard from base (bx,by) to tip (tx,ty), half-width r at the base */
  function shard(p, W, H, bx, by, tx, ty, r) {
    const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const m = mask(W, H);
    m.poly([[bx + nx * r, by + ny * r], [bx + dx * 0.7 + nx * r * 0.8, by + dy * 0.7 + ny * r * 0.8], [tx, ty], [bx + dx * 0.7 - nx * r * 0.8, by + dy * 0.7 - ny * r * 0.8], [bx - nx * r, by - ny * r]], 1);
    const s = G().pix(W, H);
    const lit = nx * -0.6 + ny * -0.8 > 0; // which facet faces the light
    m.each((x, y) => {
      const side = (x - bx) * nx + (y - by) * ny; // + on the nx side
      const along = ((x - bx) * dx + (y - by) * dy) / (l * l);
      let k = (side > 0) === lit ? 4 : 2;
      if (Math.abs(side) < 0.6) k = 5;
      if (along > 0.85) k += 1;
      s.set(x, y, ICE[Math.min(ICE.length - 1, k)]);
    });
    return put(p, s, 'dark');
  }

  S.boss_frost_giant = () => {
    const W = 96, H = 96;
    const skin = ramp('#6680c0', 7, { dark: 0.76, light: 0.66, shift: 18 });
    const hair = ramp('#c8d8f0', 6, { dark: 0.55, light: 0.8, shift: 10 });
    const pelt = ramp('#8a6850', 6, { dark: 0.72, light: 0.6 });
    const leather = ramp('#4a3a48', 5, { dark: 0.7 });
    const wood = ramp('#6a5a6a', 6, { dark: 0.7, shift: 12 });
    const EYE = ['#2080c0', '#60e0ff', '#c8faff', '#ffffff'];
    const back = { L: [0.85, 0.1, 0.35], c: '#c8f4ff', t: 0.5, edge: 1.4 };
    const p = G().pix(W, H);

    // --- long white mane falling behind the shoulders
    const mm = mask(W, H);
    mm.ellipse(48, 21, 15, 12, 1);
    mm.poly([[34, 20], [62, 20], [69, 42], [62, 39], [55, 43], [48, 40], [41, 43], [34, 39], [27, 42]], 1);
    const mane = shade(mm, hair, { depth: 4, normal: sphereN(46, 24, 20, 20), blend: 0.4, rim: 1 });
    for (let i = 0; i < 15; i++) { const x = 29 + i * 2.7; curve(mane, [[x + (x - 48) * -0.2, 18], [x + (x - 48) * 0.12, 30], [x + (x - 48) * 0.28, 41]], hair[1 + (i % 2)]); }
    put(p, mane, 'dark');

    // --- club (behind the near arm): ice-crusted log resting on the shoulder
    const cp = [[22, 62], [17, 42], [12, 24], [9, 11]];
    const cm = mask(W, H);
    tube(cm, cp, 3.6, 8.5);
    const club = shade(cm, wood, { depth: 4, rim: 1, back });
    for (let i = 0; i < 9; i++) { const q = bez(cp, 0.2 + i * 0.09); on(club, Math.round(q[0]) + (i % 2 ? 2 : -2), Math.round(q[1]), wood[1]); on(club, Math.round(q[0]) + (i % 2 ? 2 : -2), Math.round(q[1]) + 1, wood[1]); }
    put(p, club, 'dark');
    const im = mask(W, H);
    tube(im, [[13, 32], [10.5, 21], [9, 11]], 7, 9.2);
    const crust = shade(im, ICE, { depth: 3, light: [-0.6, -0.7, 0.5], global: 0.4, dither: true, back });
    for (const [x0, y0, x1, y1] of [[3, 21, 11, 15], [14, 29, 9, 21], [5, 12, 12, 8], [15, 13, 10, 19], [6, 29, 12, 25]]) crust.line(x0, y0, x1, y1, ICE[5]);
    put(p, crust, 'dark');
    for (const [bx, by, tx, ty, r] of [[4, 15, 0.5, 10, 2.6], [4, 25, 0.5, 28, 2.4], [15, 9, 20, 3, 2.4], [17, 20, 23, 19, 2.4], [9, 4, 8, 1, 2.2], [5, 7, 1.5, 3, 2.2], [16, 30, 21, 33, 2]]) shard(p, W, H, bx, by, tx, ty, r);

    // --- legs: long, muscular, knees catching the light
    const lm = mask(W, H);
    cap(lm, 41, 62, 36, 84, 8.2, 7); cap(lm, 55, 62, 60, 84, 8.2, 7);
    const legs = shade(lm, skin, { depth: 6, rim: 1, back, bias: 0.08 });
    for (const [x, s] of [[36, 1], [60, -1]]) {
      curve(legs, [[x - 5 * s, 66], [x - 3 * s, 72], [x - 4 * s, 80]], skin[2]);
      legs.set(x, 75, skin[5]); legs.set(x + s, 75, skin[4]); legs.set(x, 76, skin[4]);
      curve(legs, [[x - 2, 78], [x, 79], [x + 2, 78]], skin[2]);
    }
    put(p, legs, 'dark');
    // leather boots with fur cuffs
    const bm = mask(W, H);
    cap(bm, 35, 85, 34, 87, 7.6, 7.4); cap(bm, 61, 85, 62, 87, 7.6, 7.4);
    bm.ellipse(32, 91.5, 10, 2.8, 1); bm.ellipse(64, 91.5, 10, 2.8, 1);
    const boots = shade(bm, leather, { depth: 4, rim: 1, back });
    for (const y of [88, 91]) for (const cx of [34, 62]) { boots.hline(cx - 7, cx + 7, y, leather[3]); boots.hline(cx - 7, cx + 7, y + 1, leather[1]); }
    put(p, boots, 'dark');
    const cf = mask(W, H);
    cf.ellipse(35, 84.5, 8.6, 2.8, 1); cf.ellipse(61, 84.5, 8.6, 2.8, 1);
    for (let i = 0; i < 9; i++) { cap(cf, 27.5 + i * 2, 85, 28 + i * 2, 87 + (i % 2), 1, 0.6); cap(cf, 53.5 + i * 2, 85, 54 + i * 2, 87 + (i % 2), 1, 0.6); }
    put(p, shade(cf, pelt, { depth: 2, rim: 1 }), 'dark');

    // --- hide loincloth
    const lc = part(W, H, (g) => g.poly([[36, 59], [60, 59], [59, 71], [55, 69], [51, 73], [48, 70], [45, 73], [41, 69], [37, 71]], 1), pelt, { depth: 3, global: 0.4, rim: 1 });
    for (const x of [41, 45, 51, 55]) curve(lc, [[x, 62], [x + 0.5, 66], [x, 69]], pelt[2]);
    put(p, lc, 'dark');

    // --- torso: V-taper from huge shoulders to the waist
    const tm = mask(W, H);
    tm.ellipse(48, 44, 21, 11, 1);
    tm.ellipse(48, 38.5, 26, 6.5, 1);
    tm.poly([[29, 46], [67, 46], [61, 60], [35, 60]], 1);
    const torso = shade(tm, skin, { depth: 8, normal: sphereN(45, 44, 25, 22), blend: 0.35, rim: 1, back });
    curve(torso, [[30, 44], [38, 49.5], [47, 46]], skin[1]); curve(torso, [[49, 46], [58, 49.5], [66, 44]], skin[1]);
    curve(torso, [[30, 45], [38, 50.5], [47, 47]], skin[2]); curve(torso, [[49, 47], [58, 50.5], [66, 45]], skin[2]);
    torso.vline(48, 47, 59, skin[2]);
    for (const y of [53, 57]) { torso.hline(42, 46, y, skin[2]); torso.hline(50, 54, y, skin[2]); torso.hline(42, 46, y + 1, skin[4]); torso.hline(50, 54, y + 1, skin[4]); }
    for (const [x, s] of [[33, 1], [63, -1]]) for (const y of [51, 55]) torso.line(x, y, x + 3 * s, y + 1, skin[2]);
    const fr = rng(4);
    for (let i = 0; i < 34; i++) { const x = 26 + Math.floor(fr() * 44), y = 34 + Math.floor(fr() * 26); if (torso.get(x, y) && fr() < 0.6) torso.set(x, y, ICE[5]); }
    put(p, torso, 'dark');

    // --- belt with an ice-gem buckle
    const bt = part(W, H, (g) => g.poly([[33, 56], [63, 56], [62, 61], [34, 61]], 1), leather, { depth: 2, global: 0.3 });
    put(p, bt, 'dark');
    const bk = part(W, H, (g) => g.ellipse(48, 58.5, 4.6, 3.6, 1), ICE, { depth: 2.5, light: [-0.5, -0.7, 0.6] });
    bk.set(46, 57, ICE[6]); bk.set(47, 57, ICE[6]);
    put(p, bk, 'dark');

    // --- far arm (viewer's right): hangs, open clawed hand breathing frost
    const ra = mask(W, H);
    cap(ra, 71, 40, 79, 54, 7.6, 6.8); cap(ra, 79, 54, 81, 66, 6.8, 6);
    const rarm = shade(ra, skin, { depth: 6, rim: 1, back, normal: cylN(76, 10), blend: 0.5 });
    curve(rarm, [[73, 46], [77, 51], [79, 54]], skin[2]);
    put(p, rarm, 'dark');
    const bz = part(W, H, (g) => cap(g, 80.4, 57, 80.8, 63, 7, 6.6), ICE, { depth: 2.5, rim: 1, global: 0.5, light: [-0.6, -0.7, 0.5] });
    for (const y of [58, 61]) { bz.hline(75, 86, y, ICE[5]); }
    put(p, bz, 'dark');
    const hd = mask(W, H);
    hd.ellipse(81.5, 69, 6, 5, 1);
    for (const [x0, x1] of [[77.5, 76], [80.5, 80], [83.5, 84], [86.5, 88]]) cap(hd, x0, 71, x1, 77.5, 1.6, 1.1);
    cap(hd, 76.5, 67, 73.5, 72, 1.8, 1.3);
    put(p, shade(hd, skin, { depth: 3, rim: 1, back }), 'dark');

    // --- near arm (viewer's left): up to the fist gripping the club
    const la = mask(W, H);
    cap(la, 25, 40, 16, 53, 7.6, 6.8); cap(la, 16, 53, 20.5, 60, 6.8, 6);
    const larm = shade(la, skin, { depth: 6, rim: 1, back });
    curve(larm, [[23, 45], [18, 49], [16, 53]], skin[2]);
    put(p, larm, 'dark');
    const lf = part(W, H, (g) => g.ellipse(21.5, 61, 6, 5, 1), skin, { depth: 3.5, rim: 1 });
    for (const y of [59, 61, 63]) lf.hline(19, 26, y, skin[1]);
    put(p, lf, 'dark');

    // --- fur mantle over the shoulders, ice-crystal pauldron
    const pm = mask(W, H);
    pm.ellipse(48, 35.5, 27, 5.5, 1);
    for (let i = 0; i < 14; i++) { const x = 22 + i * 4; cap(pm, x, 37, x + (i % 2 ? 1 : -1), 40 + (i % 3), 2.2, 0.9); }
    const mantle = shade(pm, pelt, { depth: 4, normal: sphereN(46, 32, 30, 14), blend: 0.45, rim: 1 });
    const mr = rng(6);
    for (let i = 0; i < 70; i++) { const x = 20 + Math.floor(mr() * 56), y = 30 + Math.floor(mr() * 12); if (mantle.get(x, y) != null && mantle.get(x + 1, y + 2) != null) { mantle.set(x, y, pelt[2]); mantle.set(x + 1, y + 1, pelt[2]); } }
    put(p, mantle, 'dark');
    for (const [bx, by, tx, ty, r] of [[70, 34, 74, 20, 3.2], [74, 36, 82, 26, 3], [66, 34, 66, 23, 2.6], [77, 39, 86, 36, 2.4]]) shard(p, W, H, bx, by, tx, ty, r);

    // --- head: heavy brow, deep glowing eyes, icicle beard
    const hm = mask(W, H);
    hm.ellipse(48, 21, 9.5, 10, 1);
    hm.poly([[39, 21], [57, 21], [55, 29], [50, 32], [46, 32], [41, 29]], 1);
    put(p, shade(hm, skin, { depth: 5, normal: sphereN(46, 20, 11, 12), blend: 0.35, rim: 1, back }), 'dark');
    both(W, (X) => {
      put(p, part(W, H, (g) => cap(g, X(40), 17.5, X(47), 19.5, 2.2, 1.8), skin, { depth: 1.8, light: [-0.4, -0.9, 0.3], bias: 0.12 }), 'dark');
      stamp(p, Math.min(X(41), X(45)), 20, X(0) === 0 ? ['kkkkk', 'kaWbk', '.kkk.'] : ['kkkkk', 'kbWak', '.kkk.'], { k: INK, a: EYE[1], b: EYE[0], W: EYE[3] });
    });
    stamp(p, 46, 21, ['.ab.', '.ab.', 'abbc', 'kbbk'], { a: skin[5], b: skin[3], c: skin[2], k: skin[0] });
    p.hline(44, 52, 28, INK); p.hline(45, 51, 29, skin[1]);
    both(W, (X) => { curve(p, [[X(40), 25], [X(42), 28], [X(45), 27]], hair[4]); });
    put(p, part(W, H, (g) => g.poly([[40, 28], [56, 28], [54, 33], [42, 33]], 1), hair, { depth: 2 }), 'dark');
    for (const [x, len] of [[41, 7], [43.5, 11], [46, 15], [48.5, 17], [51, 14], [53.5, 10], [56, 6]]) shard(p, W, H, x, 31, x + (x - 48.5) * 0.12, 31 + len, 1.8);

    // --- crown of jagged ice growing from the skull
    for (const [bx, by, tx, ty, r] of [[40, 14, 32, 4, 2.8], [44, 12, 40, 2, 2.6], [48, 11, 48, 1, 3], [52, 12, 56, 2, 2.6], [56, 14, 64, 4, 2.8], [42, 14, 37, 8, 2], [54, 14, 59, 8, 2]]) shard(p, W, H, bx, by, tx, ty, r);
    put(p, part(W, H, (g) => g.poly([[38.5, 13], [57.5, 13], [56.5, 16.5], [39.5, 16.5]], 1), ICE, { depth: 1.5, global: 0.5 }), 'dark');

    return finish(p, { post: (q) => {
      for (const [x, y, c] of [[74, 82, ICE[5]], [79, 84, ICE[6]], [85, 83, ICE[5]], [90, 81, ICE[4]], [76, 87, ICE[4]], [83, 88, ICE[5]], [88, 86, ICE[6]]]) q.set(x, y, c);
    }, free: true });
  };

  // ================================================================ flame lord
  // A magma demon rising from a lava pool inside a crown of fire: black basalt
  // plates split by glowing seams, great swept horns, a molten skull face, a
  // burning heart in the chest, a fireball held aloft. 96x96.
  const ROCK = ['#0a080e', '#16121c', '#241c2a', '#342836', '#4a3846', '#664a56', '#8a6268'];
  const MAGMA = ['#7a1408', '#c83810', '#ff7020', '#ffb838', '#fff0a0'];
  /** fire mass inside mask m: hotter (brighter) the deeper inside, flickering bands */
  function fireFill(m, seed, cols, o) {
    o = o || {};
    cols = cols || FIRE;
    const D = edt(m);
    let mx = 0;
    for (let i = 0; i < D.length; i++) if (D[i] > mx) mx = D[i];
    const out = G().pix(m.w, m.h), n = cols.length;
    m.each((x, y) => {
      const i = y * m.w + x;
      let t = Math.pow(D[i] / Math.max(1, mx * (o.core || 0.75)), 0.8);
      t += (hash(x >> 1, y >> 1, seed) - 0.5) * 0.18 + Math.sin(y * 0.55 + x * 0.2) * 0.05 + (o.lift || 0) * (1 - y / m.h);
      const f = Math.max(0, Math.min(0.999, t)) * n;
      let k = Math.floor(f);
      if ((x + y) % 2 && f - k > 0.6) k++;
      out.set(x, y, cols[Math.min(n - 1, k)]);
    });
    return out;
  }
  /** a flame tongue: wide base at (bx,by), wavy body up to the tip */
  function tongue(m, bx, by, tx, ty, r, wave) {
    const mx = (bx + tx) / 2 + wave, my = (by + ty) / 2;
    tube(m, [[bx, by], [mx, my], [tx, ty]], r, 0.4, 1, 18);
    return m;
  }

  S.boss_flame_lord = () => {
    const W = 96, H = 96;
    const horn = ['#120a0e', '#261418', '#42201e', '#6e2e1e', '#a4461e', '#dc7a30'];
    const p = G().pix(W, H);
    const b = G().pix(W, H); // the demon's body, rim-lit on its own before it goes over the fire
    const glowC = [ROCK[1], MAGMA[2], MAGMA[3]];
    const rockAll = new Set(ROCK);
    /** reddish bounce light from the lava on rock below row y0 (full strength over len rows) */
    const warm = (q, y0, len) => q.each((x, y, c) => (y > y0 && rockAll.has(c) ? mix(c, '#b83a1c', Math.min(0.42, ((y - y0) / len) * 0.42)) : undefined));

    // --- crown of fire behind the body
    const fm = mask(W, H);
    fm.ellipse(48, 50, 40, 26, 1);
    for (const [bx, by, tx, ty, r, w] of [
      [20, 50, 8, 18, 9, -4], [30, 40, 20, 6, 8, 5], [40, 34, 34, 2, 7, -4], [56, 34, 62, 2, 7, 4],
      [66, 40, 76, 6, 8, -5], [76, 50, 88, 18, 9, 4], [12, 66, 2, 40, 7, 3], [84, 66, 94, 40, 7, -3],
    ]) tongue(fm, bx, by, tx, ty, r, w);
    put(p, fireFill(fm, 3, FIRE, { core: 0.6, lift: 0.1 }));

    // --- flaming mane rising between the horns
    const mn = mask(W, H);
    for (const [bx, by, tx, ty, r, w] of [[43, 17, 40, 4, 3.4, -2], [48, 14, 48, 1.5, 4, 2], [53, 17, 56, 4, 3.4, 2]]) tongue(mn, bx, by, tx, ty, r, w);
    put(b, fireFill(mn, 33, FIRE, { core: 0.5 }));

    // --- horns sweeping up and out
    both(W, (X) => {
      const pts = [[X(41), 22], [X(30), 16], [X(26), 6], [X(33), 2]];
      const hm = mask(W, H);
      tube(hm, pts, 3.4, 0.6, 1, 24);
      const hr = shade(hm, horn, { depth: 2.5, light: [-0.5, -0.8, 0.4], bias: 0.05 });
      for (let i = 1; i < 7; i++) { const q = bez(pts, i / 7); on(hr, Math.round(q[0]), Math.round(q[1]) + 1, horn[0]); }
      put(b, hr, 'dark');
    });

    // --- legs: pillars of rock sinking into the lava
    const lm = mask(W, H);
    cap(lm, 40, 70, 35, 88, 8, 7.5); cap(lm, 56, 70, 61, 88, 8, 7.5);
    const legs = shade(lm, ROCK, { depth: 5, bias: 0.04 });
    cracks(legs, lm, 14, 3, 8, glowC);
    warm(legs, 70, 20);
    put(b, legs, 'dark');

    // --- torso: slabbed basalt chest, magma heart
    const tm = mask(W, H);
    tm.ellipse(48, 48, 21, 13, 1);
    tm.ellipse(48, 41, 25, 7, 1);
    tm.poly([[31, 52], [65, 52], [59, 68], [37, 68]], 1);
    const torso = shade(tm, ROCK, { depth: 8, normal: sphereN(46, 46, 24, 22), blend: 0.35 });
    const seam = (pts) => { curve(torso, pts, MAGMA[1]); curve(torso, pts.map(([x, y]) => [x, y + 1]), MAGMA[2]); };
    seam([[30, 49], [39, 53], [47, 50]]); seam([[49, 50], [57, 53], [66, 49]]);
    seam([[39, 58], [48, 60], [57, 58]]);
    torso.vline(48, 53, 66, MAGMA[2]); torso.vline(47, 55, 65, MAGMA[1]);
    cracks(torso, tm, 21, 4, 7, [ROCK[1], MAGMA[1], MAGMA[3]]);
    glow(torso, 48, 45, 6, [MAGMA[1], MAGMA[2], MAGMA[3], MAGMA[4], '#ffffff']);
    warm(torso, 54, 16);
    put(b, torso, 'dark');

    // --- far arm (viewer's right): hangs, burning fist
    const ra = mask(W, H);
    cap(ra, 71, 42, 80, 56, 8, 7); cap(ra, 80, 56, 78, 68, 7, 6.5);
    const rarm = shade(ra, ROCK, { depth: 6, normal: cylN(77, 10), blend: 0.5 });
    cracks(rarm, ra, 31, 3, 7, glowC);
    put(b, rarm, 'dark');
    const rf = part(W, H, (g) => g.ellipse(78, 72, 6.5, 5.5, 1), ROCK, { depth: 3.5, bias: 0.05 });
    for (const y of [70, 72, 74]) rf.hline(73, 80, y, MAGMA[1]);
    put(b, rf, 'dark');
    const ff = fireFill((() => { const m = mask(W, H); tongue(m, 78, 72, 82, 58, 4, 3); tongue(m, 74, 70, 70, 60, 3, -2); return m; })(), 9, FIRE.slice(1));
    ff.each((x, y) => (rf.get(x, y) != null ? null : undefined));
    put(b, ff);

    // --- near arm (viewer's left): raised, fireball in the palm
    const la = mask(W, H);
    cap(la, 25, 42, 13, 52, 8, 7); cap(la, 13, 52, 12, 38, 7, 6);
    const larm = shade(la, ROCK, { depth: 6 });
    cracks(larm, la, 41, 3, 7, glowC);
    put(b, larm, 'dark');
    const lh = mask(W, H);
    lh.ellipse(12, 34, 6, 4.5, 1);
    for (const x of [7.5, 10.5, 13.5, 16.5]) cap(lh, x, 32, x + (x - 12) * 0.2, 27.5, 1.5, 1);
    put(b, shade(lh, ROCK, { depth: 3, back: { L: [0, -1, 0.3], c: '#ffd060', t: 0.3, edge: 1.2 } }), 'dark');
    const fb = mask(W, H);
    fb.circle(12, 19, 8, 1);
    tongue(fb, 12, 16, 10, 2, 6, 4); tongue(fb, 8, 16, 4, 8, 4, -2); tongue(fb, 16, 16, 20, 7, 4, 2);
    put(b, fireFill(fb, 12, FIRE, { core: 0.7 }));

    // --- rock pauldrons with spikes
    both(W, (X) => {
      const pm = mask(W, H);
      pm.ellipse(X(26), 38, 10, 7, 1);
      const pd = shade(pm, ROCK, { depth: 4, normal: sphereN(X(24), 35, 11, 9), blend: 0.3, bias: 0.08 });
      cracks(pd, pm, X(0) === 0 ? 51 : 52, 2, 6, glowC);
      put(b, pd, 'dark');
      for (const [bx, by, tx, ty] of [[X(20), 34, X(14), 25], [X(26), 32, X(24), 22], [X(32), 34, X(34), 26]]) {
        put(b, part(W, H, (g) => cap(g, bx, by, tx, ty, 2.6, 0.4), ROCK, { depth: 1.8, light: [-0.6, -0.7, 0.4], bias: 0.1 }), 'dark');
      }
    });

    // --- head: horned basalt skull with a lighter face plate
    const hm = mask(W, H);
    hm.ellipse(48, 23, 11, 10, 1);
    hm.poly([[37.5, 23], [58.5, 23], [56, 33], [52, 38], [44, 38], [40, 33]], 1);
    const head = shade(hm, ROCK, { depth: 5, normal: sphereN(46, 22, 12, 12), blend: 0.35, bias: 0.12 });
    bump(head, ROCK, (x, y) => (Math.hypot((x - 48) / 7, (y - 29) / 8) < 1 ? 1 : 0));
    cracks(head, (() => { const q = mask(W, H); q.ellipse(48, 16, 7, 3, 1); return q; })(), 61, 2, 5, [ROCK[1], MAGMA[1], MAGMA[3]]);
    put(b, head, 'dark');
    both(W, (X) => {
      put(b, part(W, H, (g) => cap(g, X(38), 19.5, X(47), 23.5, 2.6, 1.8), ROCK, { depth: 1.8, light: [-0.4, -0.9, 0.3], bias: 0.3 }), 'dark');
      const em = mask(W, H);
      em.poly([[X(39), 23.5], [X(46.5), 25.5], [X(45.5), 28], [X(40.5), 27]], 1);
      const eye = G().pix(W, H);
      em.each((x, y) => { eye.set(x, y, y <= 24 ? '#fffce0' : y <= 25 ? MAGMA[4] : y <= 26 ? MAGMA[3] : MAGMA[2]); });
      put(b, eye, INK);
      b.set(X(41), 25, '#ffffff');
    });
    b.set(46, 29, INK); b.set(46, 30, INK); b.set(50, 29, INK); b.set(50, 30, INK);
    both(W, (X) => { b.line(X(40), 29, X(43), 31, ROCK[5]); b.line(X(40), 30, X(43), 32, ROCK[1]); });
    // jagged maw full of fire
    const mw = mask(W, H);
    mw.poly([[41, 31.5], [55, 31.5], [53.5, 36], [48, 38], [42.5, 36]], 1);
    const maw = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - 48) / 6, (y - 35) / 3); maw.set(x, y, d < 0.5 ? '#fffce0' : d < 0.8 ? MAGMA[4] : d < 1.1 ? MAGMA[3] : MAGMA[2]); });
    put(b, maw, INK);
    const fang = (x, y, len, dir) => { for (let k = 0; k < len; k++) b.set(x, y + dir * k, k === len - 1 ? '#a89888' : '#f0e4d8'); };
    for (const [x, l] of [[42, 4], [45, 2], [51, 2], [54, 4]]) fang(x, 32, l, 1);
    for (const [x, l] of [[45, 2], [51, 2]]) fang(x, 37, l, -1);

    // --- fire light on the outer silhouette, then onto the fire
    const rockSet = new Set([...ROCK, ...horn]);
    edgeLight(b, {
      src: (c) => rockSet.has(c), nb: (c) => c == null,
      dirs: [{ d: [0, 1], c: '#ff9a38' }, { d: [-1, 0], c: '#ffc050' }, { d: [1, 0], c: '#e8602a' }, { d: [0, -1], c: '#ff8a30' }],
    });
    put(p, b, 'dark', 0.3);

    // --- lava pool swallowing the feet
    const lp = mask(W, H);
    lp.ellipse(48, 89, 40, 5, 1);
    for (const [x, r] of [[16, 3], [30, 4], [66, 4], [80, 3]]) lp.ellipse(x, 85.5, r, 2, 1);
    lp.rect(0, 94, W, 2, null);
    const pool = fireFill(lp, 8, MAGMA, { core: 0.9 });
    pool.each((x, y) => (Math.sin(x * 0.5 + y * 2.1) > 0.93 && y > 87 ? ROCK[4] : Math.sin(x * 0.3 - y * 1.3) > 0.97 ? ROCK[3] : undefined));
    put(p, pool, 'dark');
    p.rect(0, 94, W, 2, null); // the legs end under the lava

    return finish(p, { post: (q) => {
      for (const [x, y, c] of [[30, 4, MAGMA[3]], [62, 8, MAGMA[4]], [8, 40, MAGMA[3]], [88, 36, MAGMA[2]], [22, 14, MAGMA[4]], [74, 16, MAGMA[3]], [86, 70, MAGMA[3]], [6, 72, MAGMA[2]]]) q.set(x, y, c);
    }, free: true });
  };

  // ================================================================ star guardian
  // The tower's celestial construct: a floating porcelain-and-gold automaton
  // with a serene mask and glowing slit eyes, a spiked star halo, four blade-feather wings,
  // a glowing star-sapphire heart, an orbit ring round its waist, star-cloth
  // skirt plates tapering to a point, and a small star hovering over each palm.
  // 96x96.
  const ARMOR = ['#24264a', '#40467a', '#6470a6', '#92a0cc', '#c0cae8', '#e6eafa', '#ffffff'];
  const CORE = ['#164a8a', '#2a8ad8', '#6ad4ff', '#c8f6ff', '#ffffff'];
  /** 4-pointed sparkle star */
  function star4(p, cx, cy, r, cols) {
    for (let k = 1; k <= r; k++) {
      const c = cols[Math.min(cols.length - 1, Math.floor((1 - k / (r + 1)) * cols.length))];
      p.set(cx + k, cy, c); p.set(cx - k, cy, c); p.set(cx, cy + k, c); p.set(cx, cy - k, c);
    }
    if (r >= 3) { const c = cols[Math.max(0, cols.length - 3)]; p.set(cx + 1, cy + 1, c); p.set(cx - 1, cy + 1, c); p.set(cx + 1, cy - 1, c); p.set(cx - 1, cy - 1, c); }
    p.set(cx, cy, cols[cols.length - 1]);
    return p;
  }

  S.boss_star_guardian = () => {
    const W = 96, H = 96;
    const night = ramp('#2c2c80', 6, { dark: 0.72, light: 0.5 });
    const L = [-0.45, -0.75, 0.6];
    const rim = { L: [0.8, 0.4, 0.3], c: '#9ae8ff', t: 0.5, edge: 1.2 };
    const p = G().pix(W, H);

    // --- halo: gold ring with star spikes
    const hr = mask(W, H), HY = 26;
    for (let a = 0; a < 360; a += 1) {
      const t = (a * Math.PI) / 180;
      for (const r of [18, 19, 20]) hr.set(Math.round(48 + Math.cos(t) * r), Math.round(HY + Math.sin(t) * r), 1);
    }
    for (let k = 0; k < 12; k++) {
      const t = (k / 12) * Math.PI * 2 - Math.PI / 2, big = k % 3 === 0, r0 = 19, r1 = big ? 26 : 23.5;
      const bx = 48 + Math.cos(t) * r0, by = HY + Math.sin(t) * r0, nx = -Math.sin(t), ny = Math.cos(t), w = big ? 2.6 : 1.8;
      hr.poly([[bx + nx * w, by + ny * w], [48 + Math.cos(t) * r1, HY + Math.sin(t) * r1], [bx - nx * w, by - ny * w]], 1);
    }
    const halo = shade(hr, GOLD, { depth: 1.5, light: L, global: 0.5 });
    put(p, halo);

    // --- four wings of long blade feathers
    both(W, (X) => {
      for (const [ang0, ang1, n, len, root] of [[-2.0, -3.0, 6, 38, [36, 35]], [2.05, 2.95, 5, 30, [38, 50]]]) {
        for (let i = n - 1; i >= 0; i--) {
          const t = n > 1 ? i / (n - 1) : 0, a = ang0 + (ang1 - ang0) * t;
          const l = len * (0.75 + 0.25 * Math.sin(t * Math.PI + 0.4));
          const bx = root[0], by = root[1], tx = bx + Math.cos(a) * l, ty = by + Math.sin(a) * l;
          const f = mask(W, H);
          const nx = -Math.sin(a), ny = Math.cos(a);
          f.poly([[X(bx + nx * 2.4), by + ny * 2.4], [X(bx + (tx - bx) * 0.78 + nx * 3.2), by + (ty - by) * 0.78 + ny * 3.2], [X(tx), ty], [X(bx + (tx - bx) * 0.78 - nx * 2.2), by + (ty - by) * 0.78 - ny * 2.2], [X(bx - nx * 1.8), by - ny * 1.8]], 1);
          const fs = shade(f, ARMOR, { depth: 1.6, light: L, global: 0.35, bias: 0.12 - t * 0.06, back: rim });
          // blue enamel vane along the lower edge, gold spine
          f.each((x, y) => {
            const side = (x - X(bx)) * (X(1) - X(0)) * nx + (y - by) * ny;
            if (side > 1.2) fs.set(x, y, night[Math.min(5, 2 + (Math.hypot(x - X(bx), y - by) > (1 - 0.3) * l ? 2 : 0) + ((x + y) % 2))]);
          });
          fs.line(X(Math.round(bx)), Math.round(by), X(Math.round(bx + (tx - bx) * 0.85)), Math.round(by + (ty - by) * 0.85), GOLD[4]);
          put(p, fs, 'dark');
        }
      }
    });

    // --- skirt: layered plates tapering to a floating point
    const sk = mask(W, H);
    sk.poly([[34, 58], [62, 58], [58, 76], [52, 88], [48, 94], [44, 88], [38, 76]], 1);
    const skirt = shade(sk, night, { depth: 4, light: L, normal: cylN(47, 16), blend: 0.5, back: rim });
    const sr = rng(77);
    for (let i = 0; i < 26; i++) { const x = 36 + Math.floor(sr() * 24), y = 60 + Math.floor(sr() * 30); if (skirt.get(x, y) != null) skirt.set(x, y, sr() < 0.3 ? '#ffffff' : '#a8b8ff'); }
    put(p, skirt, 'dark');
    both(W, (X) => {
      const pl = part(W, H, (g) => g.poly([[X(33), 57], [X(44), 58], [X(45), 80], [X(41), 74]], 1), ARMOR, { depth: 2, light: L, bias: 0.05, back: rim });
      pl.line(X(34), 58, X(41), 73, GOLD[4]); pl.line(X(44), 58, X(45), 79, GOLD[2]);
      put(p, pl, 'dark');
    });
    const tip = part(W, H, (g) => g.poly([[44, 80], [52, 80], [48, 94]], 1), GOLD, { depth: 1.5, light: L });
    put(p, tip, 'dark');

    // --- orbit ring (back half)
    const ring = (front) => {
      const m = mask(W, H);
      for (let a = 0; a < 360; a += 0.5) {
        const t = (a * Math.PI) / 180, y = Math.sin(t);
        if ((y > 0) !== front) continue;
        for (const d of [0, 0.8]) m.set(Math.round(48 + Math.cos(t) * (31 + d)), Math.round(60 + y * (7 + d * 0.3)), 1);
      }
      const r = shade(m, GOLD, { depth: 1, light: L, global: 0.6 });
      put(p, r, 'dark');
    };
    ring(false);

    // --- torso: porcelain breastplate, gold filigree, star-sapphire heart
    const tm = mask(W, H);
    tm.poly([[33, 34], [63, 34], [61, 48], [55, 58], [41, 58], [35, 48]], 1);
    tm.ellipse(48, 36, 17, 5, 1);
    const torso = shade(tm, ARMOR, { depth: 6, light: L, normal: sphereN(46, 42, 18, 18), blend: 0.35, back: rim });
    curve(torso, [[36, 38], [42, 48], [48, 52]], GOLD[3]); curve(torso, [[60, 38], [54, 48], [48, 52]], GOLD[3]);
    curve(torso, [[37, 38], [43, 47], [48, 50]], GOLD[5]);
    torso.hline(40, 56, 56, GOLD[2]); torso.hline(41, 55, 57, GOLD[1]);
    put(p, torso, 'dark');
    const cr = part(W, H, (g) => g.poly([[48, 38], [53, 44], [48, 50], [43, 44]], 1), GOLD, { depth: 1.5, light: L });
    put(p, cr, 'dark');
    const core = mask(W, H); core.ellipse(48, 44, 3.6, 4.2, 1);
    put(p, fireFill(core, 2, CORE, { core: 0.8 }), 'dark');
    p.set(47, 42, '#ffffff'); p.set(47, 43, '#ffffff');

    ring(true);

    // --- arms: segmented, open palms each lifting a star
    both(W, (X) => {
      const upper = part(W, H, (g) => cap(g, X(33), 38, X(23), 45, 4.2, 3.6), ARMOR, { depth: 3, light: L, back: rim });
      put(p, upper, 'dark');
      const fore = part(W, H, (g) => cap(g, X(22), 46, X(13), 51, 3.8, 3.2), ARMOR, { depth: 3, light: L, back: rim, bias: 0.05 });
      fore.line(X(20), 46, X(14), 49, GOLD[3]);
      put(p, fore, 'dark');
      for (const [cx, cy, r] of [[X(33), 37, 4.5], [X(22.5), 45.5, 3]]) put(p, part(W, H, (g) => g.circle(cx, cy, r, 1), GOLD, { depth: 2, light: L }), 'dark');
      const hand = mask(W, H);
      hand.ellipse(X(11), 52, 3.6, 2.4, 1);
      for (const k of [0, 1, 2]) cap(hand, X(9 + k * 2), 51, X(8 + k * 2.5), 48.5, 0.9, 0.7);
      put(p, shade(hand, ARMOR, { depth: 1.5, light: L, back: rim }), 'dark');
      // floating star over the palm
      const st = mask(W, H);
      st.poly([[X(10), 30], [X(11.5), 37], [X(18), 38.5], [X(11.5), 40], [X(10), 47], [X(8.5), 40], [X(2), 38.5], [X(8.5), 37]], 1);
      put(p, fireFill(st, 4, CORE.slice(1), { core: 0.6 }), 'dark');
    });

    // --- shoulder guards
    both(W, (X) => {
      const sg = mask(W, H);
      sg.poly([[X(28), 35], [X(38), 30], [X(42), 36], [X(36), 42], [X(27), 42]], 1);
      const g = shade(sg, ARMOR, { depth: 2.5, light: L, back: rim, bias: 0.05 });
      g.line(X(29), 41, X(36), 41, GOLD[3]); g.line(X(28), 36, X(37), 31, GOLD[5]);
      put(p, g, 'dark');
    });

    // --- head: porcelain ovoid mask with a gold crest
    const hm = mask(W, H);
    hm.ellipse(48, 23, 8, 10, 1);
    hm.ellipse(48, 28, 6, 5, 1);
    const head = shade(hm, ARMOR, { depth: 4, light: L, normal: sphereN(46.5, 21, 9, 11), blend: 0.3, back: rim });
    put(p, head, 'dark');
    const cm = mask(W, H);
    cm.poly([[46, 15], [50, 15], [51, 9], [48, 1], [45, 9]], 1);
    both(W, (X) => cm.poly([[X(41), 17], [X(44), 14], [X(40), 6], [X(37), 12]], 1));
    put(p, shade(cm, GOLD, { depth: 1.5, light: L }), 'dark');
    // serene porcelain face: glowing slit eyes, a third-eye gem, closed lips
    both(W, (X) => {
      p.line(X(42), 20, X(46), 21, ARMOR[2]);
      stamp(p, Math.min(X(42), X(46)), 22, X(0) === 0 ? ['kkkkk', '.cCWk', '..kk.'] : ['kkkkk', 'kWCc.', '.kk..'], { k: INK, c: CORE[1], C: CORE[2], W: '#ffffff' });
      p.line(X(44), 26, X(46), 27, ARMOR[3]);
    });
    p.vline(48, 23, 27, ARMOR[6]); p.set(49, 27, ARMOR[3]);
    p.hline(46, 50, 30, ARMOR[2]); p.set(48, 31, ARMOR[4]);
    stamp(p, 47, 16, ['.g.', 'gcg', 'gCg', '.g.'], { g: GOLD[3], c: CORE[2], C: CORE[4] });
    // neck collar
    put(p, part(W, H, (g) => g.poly([[42, 30], [54, 30], [56, 34], [40, 34]], 1), GOLD, { depth: 1.5, light: L }), 'dark');

    return finish(p, { post: (q) => {
      for (const [x, y, r] of [[8, 16, 2], [88, 20, 2], [20, 88, 2], [78, 84, 3], [6, 62, 1], [90, 58, 1], [30, 4, 1], [68, 6, 1]]) star4(q, x, y, r, ['#6a8adc', '#c8e0ff', '#ffffff']);
    }, free: true });
  };

  // ================================================================ general A: dark knight
  // The demon king's black knight: horned great helm with a burning visor,
  // layered spiked pauldrons trimmed in gold, a demon-face breastplate, a torn
  // crimson-lined cape, both gauntlets resting on a greatsword planted before
  // him, its fuller glowing with red runes. 96x96.
  const BLACK = ['#08060e', '#14101e', '#221c30', '#342a46', '#4a3e62', '#685a86', '#9486b0'];
  S.boss_general_a = () => {
    const W = 96, H = 96;
    const cape = ramp('#8e1a2c', 6, { dark: 0.74, light: 0.5 });
    const L = [-0.5, -0.72, 0.55];
    const sheen = { L: [0.85, 0.2, 0.3], c: '#8e7ab8', t: 0.5, edge: 1.2 };
    const RUNE = ['#5a0810', '#b01820', '#ff4030', '#ffb080'];
    const p = G().pix(W, H);
    const plate = (fn, o) => part(W, H, fn, BLACK, Object.assign({ depth: 3, light: L, back: sheen, spec: 0.95 }, o || {}));
    const trim = (q, pts) => { curve(q, pts, GOLD[4]); curve(q, pts.map(([x, y]) => [x, y + 1]), GOLD[2]); };

    // --- cape: crimson lining flaring behind him, black outer fold, torn hem
    const cm = mask(W, H);
    const hem = [];
    for (let i = 0; i <= 16; i++) { const x = 5 + i * 5.4; hem.push([x, 93 - (i % 2 ? 6 : 0) - (i % 3 === 0 ? 2 : 0)]); }
    cm.poly([[28, 32], [68, 32], [80, 60], [91, 93], ...hem.reverse(), [5, 93], [16, 60]], 1);
    const cp = shade(cm, cape, { depth: 5, light: L, global: 0.5, bias: -0.08 });
    for (const [x0, y0, x1, y1] of [[24, 44, 16, 90], [30, 50, 26, 88], [72, 44, 80, 90], [66, 50, 70, 88]]) { cp.line(x0, y0, x1, y1, cape[0]); cp.line(x0 + 1, y0, x1 + 1, y1, cape[3]); }
    // black outer fold along the edges
    const D = edt(cm);
    cm.each((x, y) => { const d = D[y * W + x]; if (d < 2.2 && (x < 24 || x > 72)) cp.set(x, y, d < 1.2 ? BLACK[3] : BLACK[1]); });
    put(p, cp, 'dark');

    // --- legs: armoured greaves and pointed sabatons
    const lg = mask(W, H);
    cap(lg, 40, 66, 35, 86, 6.5, 5.5); cap(lg, 56, 66, 61, 86, 6.5, 5.5);
    const legs = shade(lg, BLACK, { depth: 4, light: L, back: sheen, spec: 0.95 });
    for (const [x, s] of [[36, 1], [60, -1]]) { const kn = plate((g) => g.ellipse(x + s * 1.5, 76, 4, 3.2, 1), { depth: 2 }); trim(kn, [[x - 2 + s * 1.5, 78], [x + s * 1.5, 79], [x + 2 + s * 1.5, 78]]); put(legs, kn, 'dark'); }
    put(p, legs, 'dark');
    const ft = mask(W, H);
    ft.poly([[27, 94], [30, 87], [40, 87], [41, 94]], 1); ft.poly([[55, 94], [56, 87], [66, 87], [69, 94]], 1);
    put(p, shade(ft, BLACK, { depth: 2, light: L, back: sheen }), 'dark');

    // --- tassets: plated skirt at the hips
    both(W, (X) => {
      for (const [a, b, y1] of [[36, 46, 72], [30, 38, 68]]) {
        const t = plate((g) => g.poly([[X(a), 58], [X(b), 58], [X(b - 1), y1], [X(a - 2), y1 - 2]], 1), { depth: 2 });
        trim(t, [[X(a - 1.5), y1 - 2.5], [X(b - 1), y1 - 0.5]]);
        put(p, t, 'dark');
      }
    });

    // --- torso: breastplate with a gold demon-face boss
    const tm = mask(W, H);
    tm.poly([[33, 34], [63, 34], [62, 48], [57, 60], [39, 60], [34, 48]], 1);
    const torso = shade(tm, BLACK, { depth: 6, light: L, normal: sphereN(46, 44, 18, 18), blend: 0.35, back: sheen, spec: 0.96 });
    trim(torso, [[35, 47], [48, 51], [61, 47]]);
    for (const y of [54, 57]) { torso.hline(40, 56, y, BLACK[1]); torso.hline(40, 56, y + 1, BLACK[4]); }
    put(p, torso, 'dark');
    const emb = mask(W, H);
    emb.poly([[42, 37], [54, 37], [53, 43], [48, 47], [43, 43]], 1);
    both(W, (X) => emb.poly([[X(42), 37], [X(39), 33], [X(44), 37]], 1));
    const em = shade(emb, GOLD, { depth: 1.8, light: L });
    stamp(em, 44, 39, ['rr.rr', '.....', '.kkk.'], { r: RUNE[2], k: GOLD[0] });
    put(p, em, 'dark');

    // --- greatsword planted before him: blade, guard, grip
    const bl = mask(W, H);
    bl.poly([[42.5, 67], [53.5, 67], [52.5, 86], [48, 94], [43.5, 86]], 1);
    for (let y = 70; y <= 84; y += 5) { bl.poly([[43, y], [40.5, y + 2], [43, y + 3]], 1); bl.poly([[53, y], [55.5, y + 2], [53, y + 3]], 1); }
    const blade = shade(bl, STEEL, { depth: 2.5, flat: 0.3, light: [-0.7, -0.5, 0.5], global: 0.3, bias: 0.02 });
    for (let y = 68; y <= 87; y++) {
      blade.set(47, y, BLACK[1]); blade.set(48, y, BLACK[1]); blade.set(49, y, BLACK[1]);
      if (y % 5 !== 0) { blade.set(47, y, RUNE[1]); blade.set(48, y, y % 5 === 2 ? RUNE[3] : RUNE[2]); blade.set(49, y, RUNE[1]); }
      on(blade, 44 + Math.floor((y - 67) / 10), y, STEEL[5]); on(blade, 51 - Math.floor((y - 67) / 14), y, STEEL[1]);
    }
    for (let y = 88; y <= 91; y++) on(blade, 48, y, STEEL[5]);
    put(p, blade, 'dark');
    const gd = mask(W, H);
    gd.poly([[35, 65], [41, 63], [48, 65], [55, 63], [61, 65], [59, 68], [48, 69], [37, 68]], 1);
    both(W, (X) => gd.poly([[X(35), 65], [X(31), 61], [X(34), 68]], 1));
    const guard = shade(gd, GOLD, { depth: 1.8, light: L });
    guard.set(48, 66, RUNE[2]); guard.set(47, 66, RUNE[3]);
    put(p, guard, 'dark');
    const grip = part(W, H, (g) => cap(g, 48, 54, 48, 64, 1.8), ramp('#4a2a3a', 5), { depth: 1.5, light: L });
    for (let y = 55; y <= 63; y += 2) grip.hline(47, 49, y, '#2a1420');
    put(p, grip, 'dark');

    // --- arms bent down to the waist, gauntlets folded over the pommel
    both(W, (X) => {
      put(p, plate((g) => cap(g, X(30), 40, X(27), 53, 5.4, 5), { depth: 4 }), 'dark');
      const fa = plate((g) => cap(g, X(27), 54, X(40), 59, 5, 4.4), { depth: 3.5 });
      trim(fa, [[X(35), 54], [X(36), 57], [X(35), 61]]);
      put(p, fa, 'dark');
      put(p, plate((g) => { g.ellipse(X(27.5), 53, 4, 4, 1); g.poly([[X(24), 54], [X(20), 59], [X(27), 56]], 1); }, { depth: 2 }), 'dark');
    });
    both(W, (X) => {
      const gl = plate((g) => g.ellipse(X(44.5), 58.5, 4.4, 3.8, 1), { depth: 2.5, bias: 0.08 });
      for (const y of [57, 59, 61]) gl.hline(Math.min(X(42), X(47)), Math.max(X(42), X(47)), y, BLACK[1]);
      gl.set(X(43), 56, BLACK[6]);
      put(p, gl, 'dark');
      put(p, part(W, H, (g) => g.poly([[X(39), 55], [X(41.5), 55], [X(41.5), 62], [X(39), 62]], 1), GOLD, { depth: 1, light: L }), 'dark');
    });
    put(p, part(W, H, (g) => g.circle(48, 52.5, 3, 1), GOLD, { depth: 2, light: L }), 'dark');
    put(p, part(W, H, (g) => g.circle(48, 52.5, 1.6, 1), RUNE, { depth: 1.5, light: L }), 'dark');
    p.set(47, 51, RUNE[3]);

    // --- pauldrons: three layered spiked plates each side
    both(W, (X) => {
      for (const [bx, by, tx, ty] of [[X(19), 33, X(9), 22], [X(25), 30, X(21), 16], [X(31), 30, X(33), 19]]) {
        put(p, plate((g) => cap(g, bx, by, tx, ty, 3, 0.3), { depth: 2, light: [-0.7, -0.4, 0.5] }), 'dark');
      }
      const lo = plate((g) => g.ellipse(X(25), 43, 8.5, 5, 1), { depth: 3, normal: sphereN(X(24), 41, 9, 7), blend: 0.35, bias: -0.05 });
      trim(lo, [[X(17.5), 44], [X(25), 48], [X(32.5), 44]]);
      put(p, lo, 'dark');
      const pd = plate((g) => { g.ellipse(X(25), 36, 11, 8, 1); g.rect(Math.min(X(14), X(36)), 36, 23, 0, 1); }, { depth: 4, normal: sphereN(X(22), 32, 12, 10), blend: 0.4 });
      trim(pd, [[X(14.5), 38], [X(25), 44], [X(35.5), 38]]);
      curve(pd, [[X(17), 33], [X(24), 29], [X(31), 31]], BLACK[5]);
      pd.set(X(20), 32, BLACK[6]); pd.set(X(21), 31, BLACK[6]);
      stamp(pd, Math.min(X(24), X(26)), 37, ['.r.', 'rRr', '.r.'], { r: RUNE[1], R: RUNE[3] });
      put(p, pd, 'dark');
    });

    // --- helm: horns, crest, burning visor
    both(W, (X) => {
      const hm = mask(W, H);
      tube(hm, [[X(41), 20], [X(33), 17], [X(29), 8], [X(34), 2]], 3, 0.5, 1, 22);
      const hr = shade(hm, ramp('#d8ccb0', 6, { dark: 0.72 }), { depth: 2, light: L });
      for (let i = 1; i < 6; i++) { const q = bez([[X(41), 20], [X(33), 17], [X(29), 8], [X(34), 2]], i / 6); on(hr, Math.round(q[0]), Math.round(q[1]) + 1, '#6a5a50'); }
      put(p, hr, 'dark');
    });
    const hmk = mask(W, H);
    hmk.ellipse(48, 22, 9, 10, 1);
    hmk.poly([[39, 24], [57, 24], [55, 33], [48, 36], [41, 33]], 1);
    const helm = shade(hmk, BLACK, { depth: 4, light: L, normal: sphereN(46, 21, 10, 12), blend: 0.35, back: sheen, spec: 0.94 });
    helm.vline(48, 12, 20, BLACK[5]); helm.vline(49, 12, 20, BLACK[2]);
    trim(helm, [[40, 28], [48, 31], [56, 28]]);
    put(p, helm, 'dark');
    put(p, part(W, H, (g) => g.poly([[46.5, 13], [49.5, 13], [48, 3]], 1), GOLD, { depth: 1.2, light: L }), 'dark');
    // visor slit with burning eyes
    for (let x = 40; x <= 56; x++) { p.set(x, 22, INK); p.set(x, 23, x === 48 ? INK : RUNE[0]); p.set(x, 24, INK); }
    both(W, (X) => { p.set(X(43), 23, RUNE[2]); p.set(X(44), 23, RUNE[3]); p.set(X(45), 23, RUNE[2]); p.set(X(44), 22, RUNE[1]); });
    for (const x of [44, 46, 50, 52]) { p.set(x, 27, INK); p.set(x, 28, INK); }

    return finish(p);
  };

  // ================================================================ general B: lich
  // The demon king's sorcerer: a crowned skull in a violet hood, spiked high
  // collar, tattered gold-trimmed robes open over a ribcage holding a green soul
  // flame, a skull-topped staff, ghost fire in the raised hand, and three
  // floating skulls trailing green flame. 96x96.
  const SOUL = ['#0a3a24', '#147a44', '#34c068', '#90f8a8', '#eafff0'];
  S.boss_general_b = () => {
    const W = 96, H = 96;
    const robe = ramp('#4c2a74', 7, { dark: 0.76, light: 0.55 });
    const lining = ramp('#1e5a4c', 5, { dark: 0.7 });
    const bone = ramp('#d8d0b0', 6, { dark: 0.62, shift: 28 });
    const wood = ramp('#4a3048', 5, { dark: 0.7 });
    const L = [-0.5, -0.72, 0.55];
    const ghost = { L: [0.2, 0.9, 0.3], c: '#50d880', t: 0.55, edge: 1.2 };
    const p = G().pix(W, H);
    const trimL = (q, pts) => { curve(q, pts, GOLD[4]); curve(q, pts.map(([x, y]) => [x + 1, y]), GOLD[2]); };

    /** a small skull at (cx,cy), r ≈ half-width */
    function skull(cx, cy, r, flame) {
      if (flame) {
        // ghost fire streaming back from the skull: three flickering tongues
        const fm = mask(W, H);
        fm.ellipse(cx, cy - r * 0.2, r * 1.15, r, 1);
        for (const [k, sc, sw] of [[0, 1, 2], [-1, 0.7, -2], [1, 0.75, 2]]) {
          const bx = cx + k * r * 0.6, by = cy - r * 0.5;
          tongue(fm, bx, by, bx + flame[0] * sc + k * 2, by + flame[1] * sc, r * 0.55, sw);
        }
        put(p, fireFill(fm, cx * 7 + cy, SOUL, { core: 0.55 }));
      }
      const m = mask(W, H);
      m.ellipse(cx, cy - r * 0.2, r, r * 0.9, 1);
      m.ellipse(cx, cy + r * 0.55, r * 0.62, r * 0.45, 1);
      const s = shade(m, bone, { depth: Math.max(1.5, r * 0.5), light: L, back: ghost });
      const e = Math.max(1, Math.round(r * 0.35));
      for (const sx of [-1, 1]) {
        const ex = Math.round(cx + sx * r * 0.42), ey = Math.round(cy);
        s.rect(ex - (sx < 0 ? e - 1 : 0), ey - 1, e, e, INK);
        s.set(ex, ey - (e > 1 ? 0 : 1), SOUL[3]);
      }
      s.set(Math.round(cx), Math.round(cy + r * 0.45), INK);
      for (let x = Math.round(cx - r * 0.45); x <= Math.round(cx + r * 0.45); x += 2) s.set(x, Math.round(cy + r * 0.8), INK);
      put(p, s, 'dark');
    }

    // --- spiked high collar behind the head (green lining facing us)
    const cl = mask(W, H);
    cl.poly([[28, 38], [30, 22], [26, 8], [36, 18], [40, 4], [44, 16], [48, 12], [52, 16], [56, 4], [60, 18], [70, 8], [66, 22], [68, 38]], 1);
    const col = shade(cl, lining, { depth: 3, light: L, global: 0.5, bias: -0.05 });
    const CD = edt(cl);
    cl.each((x, y) => { if (CD[y * W + x] < 1.6) col.set(x, y, robe[CD[y * W + x] < 0.8 ? 4 : 2]); });
    put(p, col, 'dark');

    // --- staff (behind the near hand): gnarled shaft, skull-and-claw head, soul orb
    const sm = mask(W, H);
    cap(sm, 17, 20, 15, 92, 1.8, 1.6);
    const staff = shade(sm, wood, { depth: 1.5, light: L });
    for (let y = 26; y < 90; y += 7) { on(staff, 16, y, wood[0]); on(staff, 17, y + 1, wood[3]); }
    put(p, staff, 'dark');
    for (const s of [-1, 1]) put(p, part(W, H, (g) => tube(g, [[17, 20], [17 + s * 7, 16], [17 + s * 4, 6]], 1.6, 0.4), bone, { depth: 1.2, light: L }), 'dark');
    const orb = mask(W, H); orb.circle(17, 10, 4.5, 1);
    put(p, fireFill(orb, 5, SOUL, { core: 0.8 }), 'dark');
    p.set(15, 8, '#ffffff'); p.set(16, 8, SOUL[4]);
    skull(17, 21, 3.6);

    // --- robe body flaring to a tattered, ghost-fire hem
    const rm = mask(W, H);
    const hem = [];
    for (let i = 0; i <= 14; i++) { const x = 16 + i * (64 / 14); hem.push([x, 86 - (i % 2 ? 0 : 6) + (i % 3 === 1 ? 3 : 0)]); }
    rm.poly([[31, 34], [65, 34], [72, 60], [80, 84], ...hem.reverse(), [16, 84], [24, 60]], 1);
    const rb = shade(rm, robe, { depth: 6, light: L, normal: cylN(46, 30), blend: 0.5, back: ghost });
    for (const [x0, y0, x1, y1] of [[36, 50, 30, 82], [42, 56, 40, 84], [54, 56, 56, 84], [60, 50, 66, 82], [30, 60, 22, 80], [66, 60, 74, 80], [46, 64, 45, 84], [50, 64, 51, 84]]) { rb.line(x0, y0, x1, y1, robe[0]); rb.line(x0 + 1, y0, x1 + 1, y1, robe[5]); }
    // hem darkens into shadow where the ghost fire takes over
    bump(rb, robe, (x, y) => (y > 74 ? -1 : 0) + (y > 80 ? -1 : 0));
    put(p, rb, 'dark');
    // wisps of ghost fire trailing under the hem
    const wm = mask(W, H);
    for (const [x, y, l, r] of [[19, 79, 9, 2.6], [25, 83, 6, 2], [31, 84, 9, 2.8], [37, 83, 5, 1.8], [42, 82, 11, 3], [49, 85, 7, 2.2], [55, 84, 9, 2.8], [61, 82, 6, 2], [67, 82, 10, 2.8], [75, 80, 8, 2.4]]) tongue(wm, x, y, x + (x < 48 ? -3 : 3), y + l, r, x % 2 ? 2.5 : -2.5);
    wm.each((x, y) => (rm.get(x, y) != null ? null : undefined));
    const wisp = fireFill(wm, 17, SOUL.slice(0, 4), { core: 0.9 });
    put(p, wisp);
    // gold trim down the robe's front edges
    trimL(p, [[40, 36], [37, 60], [34, 84]]); trimL(p, [[56, 36], [59, 60], [62, 84]]);

    // --- open chest: ribcage cradling a soul flame
    const ch = mask(W, H);
    ch.poly([[41, 36], [55, 36], [52, 54], [48, 58], [44, 54]], 1);
    put(p, shade(ch, ['#0a0612', '#160c20', '#22142e'], { depth: 3, light: L }));
    const sf = mask(W, H); sf.ellipse(48, 48, 4, 5, 1); tongue(sf, 48, 46, 47, 38, 3, 1);
    put(p, fireFill(sf, 9, SOUL, { core: 0.7 }));
    for (let i = 0; i < 5; i++) {
      const y = 39 + i * 3.4, w = 6 - i * 0.7;
      curve(p, [[48 - w, y + 2], [48 - w * 0.5, y - 0.5], [47, y]], bone[4]);
      curve(p, [[48 + w, y + 2], [48 + w * 0.5, y - 0.5], [49, y]], bone[3]);
    }
    p.vline(48, 37, 55, bone[2]);
    // bone-plated girdle with a skull clasp
    const gd = part(W, H, (g) => g.poly([[37, 58], [59, 58], [60, 62], [36, 62]], 1), GOLD.slice(0, 6), { depth: 1.4, light: L, flat: 0.3 });
    for (let x = 38; x <= 58; x += 3) { gd.set(x, 60, SOUL[2]); }
    put(p, gd, 'dark');
    skull(48, 60, 3.2);

    // --- sleeves and bony hands
    // near side (viewer's left): bell sleeve down to the hand on the staff
    const ls = mask(W, H);
    ls.poly([[33, 34], [38, 40], [30, 56], [18, 60], [20, 50]], 1);
    const lsl = shade(ls, robe, { depth: 4, light: L, back: ghost });
    trimL(lsl, [[31, 56], [24, 59], [18, 59]]);
    put(p, lsl, 'dark');
    const lh = mask(W, H);
    lh.ellipse(18.5, 57, 3.4, 3, 1);
    for (const y of [55, 57, 59]) cap(lh, 18, y, 13, y + 0.5, 0.9, 0.7);
    put(p, shade(lh, bone, { depth: 1.5, light: L }), 'dark');
    // far side (viewer's right): sleeve raised, claw open under a ghost flame
    const rs = mask(W, H);
    rs.poly([[63, 34], [58, 40], [70, 52], [82, 50], [76, 40]], 1);
    const rsl = shade(rs, robe, { depth: 4, light: L, back: ghost });
    trimL(rsl, [[70, 51], [76, 51.5], [82, 50]]);
    put(p, rsl, 'dark');
    const rh = mask(W, H);
    rh.ellipse(79, 47, 3, 2.6, 1);
    for (const [x0, x1] of [[76.5, 75], [79, 78.5], [81.5, 82.5], [83, 85.5]]) cap(rh, x0, 46, x1, 41, 0.8, 0.6);
    put(p, shade(rh, bone, { depth: 1.5, light: L, back: ghost }), 'dark');
    const gf = mask(W, H);
    gf.circle(80, 36, 5, 1);
    tongue(gf, 80, 34, 81, 21, 4.5, 3); tongue(gf, 76, 35, 72, 26, 3, -2); tongue(gf, 84, 35, 87, 27, 2.6, 2);
    put(p, fireFill(gf, 13, SOUL, { core: 0.7 }), 'dark');

    // --- hood and crowned skull
    const hd = mask(W, H);
    hd.ellipse(48, 25, 11, 12, 1);
    hd.poly([[37, 26], [59, 26], [62, 38], [34, 38]], 1);
    const hood = shade(hd, robe, { depth: 5, light: L, normal: sphereN(46, 23, 13, 14), blend: 0.3, back: ghost });
    const hole = mask(W, H); hole.ellipse(48, 28, 7.5, 9, 1);
    hole.each((x, y) => { hood.set(x, y, y < 24 ? '#0a0612' : '#160c20'); });
    put(p, hood, 'dark');
    const sk = mask(W, H);
    sk.ellipse(48, 27, 6.5, 6.5, 1);
    sk.poly([[43, 29], [53, 29], [52, 35], [44, 35]], 1);
    const skl = shade(sk, bone, { depth: 3, light: L, normal: sphereN(47, 26, 8, 9), blend: 0.3 });
    // sockets with green pinpoints, nasal pit, teeth, cracks
    both(W, (X) => {
      stamp(skl, Math.min(X(43), X(46)), 26, X(0) === 0 ? ['.kkk', 'kkgk', 'kGkk', '.kk.'] : ['kkk.', 'kgkk', 'kkGk', '.kk.'], { k: INK, g: SOUL[2], G: SOUL[4] });
    });
    stamp(skl, 47, 30, ['kk', 'k.'], { k: INK });
    skl.hline(44, 52, 33, INK);
    for (const x of [45, 47, 49, 51]) skl.vline(x, 32, 34, INK);
    skl.hline(44, 52, 32, bone[4]);
    skl.line(50, 21, 52, 24, bone[1]); skl.set(52, 25, bone[1]);
    put(p, skl, 'dark');
    // crown on the hood: tall gold points set with green gems
    const cr = mask(W, H);
    cr.poly([[38, 17], [58, 17], [57, 13], [39, 13]], 1);
    for (const [x, t] of [[39.5, 5], [43.5, 8], [48, 2], [52.5, 8], [56.5, 5]]) cr.poly([[x - 2.2, 14], [x + 2.2, 14], [x, t]], 1);
    const crown = shade(cr, GOLD, { depth: 1.6, flat: 0.3, light: L, global: 0.5, spec: 0.9 });
    for (const x of [41, 48, 55]) { crown.set(x, 15, SOUL[3]); crown.set(x + 1, 15, SOUL[1]); }
    put(p, crown, 'dark');

    // --- floating skulls with green flame trails
    skull(9, 73, 4.6, [4, -12]);
    skull(87, 67, 4.6, [-4, -12]);
    skull(80, 88, 3.8, [6, -9]);

    return finish(p, { post: (q) => {
      for (const [x, y, c] of [[26, 10, SOUL[3]], [72, 14, SOUL[2]], [6, 44, SOUL[3]], [90, 40, SOUL[2]], [88, 78, SOUL[3]]]) q.set(x, y, c);
    }, free: true });
  };

  // ================================================================ demon king
  // ヴァルザード: a regal horned sorcerer-king. Great crescent obsidian horns
  // banded in gold, a spiked crown, a pale sharp face with cold gold eyes and a
  // smirk, a flared crimson collar, a bat-winged cape with crimson lining spread
  // to the edges, violet robes worked with gold, a ruby clasp, a winged-orb
  // sceptre and a palm of dark fire. 112x96.
  const HORN = ['#08060c', '#16121e', '#282234', '#3e364e', '#5c5270', '#827896', '#aaa2bc'];
  const DARKFIRE = ['#240840', '#521890', '#8c3cd8', '#c888ff', '#f4e4ff'];
  S.boss_demon_king = () => {
    const W = 112, H = 96;
    const skin = ramp('#b0b2da', 6, { dark: 0.64, light: 0.62, shift: 16 });
    const hair = ramp('#3c3068', 6, { dark: 0.7, light: 0.5 });
    const robe = ramp('#3e2660', 7, { dark: 0.76, light: 0.5 });
    const lining = ramp('#a01c34', 6, { dark: 0.72, light: 0.5 });
    const outer = ['#08060c', '#140e1c', '#20182c', '#302440', '#44365a'];
    const L = [-0.5, -0.72, 0.55];
    const rim = { L: [0.85, 0.3, 0.3], c: '#b890e8', t: 0.5, edge: 1.2 };
    const p = G().pix(W, H);
    const cx = 56;
    const trim = (q, pts) => { curve(q, pts, GOLD[4]); curve(q, pts.map(([x, y]) => [x, y + 1]), GOLD[2]); };

    // --- cape: bat-winged, spread wide; crimson lining with black outer folds
    const cm = mask(W, H);
    both(W, (X) => {
      cm.poly([[X(44), 30], [X(30), 30], [X(14), 26], [X(1), 36], [X(4), 48], [X(2), 64], [X(7), 80], [X(12), 94], [X(24), 88], [X(34), 94], [X(46), 90], [X(56), 94]], 1);
    });
    const cp = shade(cm, lining, { depth: 5, light: L, global: 0.4, bias: -0.1 });
    // the lining darkens toward the hem and the outer tips
    bump(cp, lining, (x, y) => -Math.floor(Math.max(0, (y - 50) / 22 + Math.abs(x - cx) / 70 - 0.4) * 1.6));
    const CD = edt(cm);
    // the scalloped outer edge rolls over in black
    both(W, (X) => {
      for (const fold of [[[14, 26], [1, 36], [4, 48], [9, 37]], [[4, 48], [2, 64], [7, 80], [10, 64]]]) {
        const m = mask(W, H);
        m.poly(fold.map(([x, y]) => [X(x), y]), 1);
        const f = shade(m, outer, { depth: 2, light: L, back: rim });
        put(cp, f, 'dark');
      }
      // lining folds
      for (const [x0, y0, x1, y1] of [[34, 36, 18, 86], [38, 40, 28, 88], [26, 34, 10, 78]]) { cp.line(X(x0), y0, X(x1), y1, lining[0]); cp.line(X(x0) + 1, y0, X(x1) + 1, y1, lining[3]); }
    });
    cm.each((x, y) => { if (CD[y * W + x] < 1.1 && y > 30) cp.set(x, y, GOLD[3]); });
    put(p, cp, 'dark');

    // --- flared standing collar behind the head
    const col = mask(W, H);
    col.poly([[41, 38], [38, 24], [34, 14], [44, 20], [cx, 22], [68, 20], [78, 14], [74, 24], [71, 38]], 1);
    const cl = shade(col, lining, { depth: 3, light: L, global: 0.5, bias: -0.02 });
    const LD = edt(col);
    col.each((x, y) => { if (LD[y * W + x] < 1.1) cl.set(x, y, GOLD[3]); });
    put(p, cl, 'dark');

    // --- long dark hair falling behind the shoulders
    const hm = mask(W, H);
    hm.ellipse(cx, 19, 11, 10, 1);
    hm.poly([[45, 19], [67, 19], [71, 42], [64, 39], [cx, 42], [48, 39], [41, 42]], 1);
    const hr = shade(hm, hair, { depth: 4, light: L, normal: sphereN(cx - 2, 22, 16, 18), blend: 0.4, rim: 1 });
    for (let i = 0; i < 11; i++) { const x = 44 + i * 2.4; curve(hr, [[x + (x - cx) * -0.2, 21], [x + (x - cx) * 0.1, 31], [x + (x - cx) * 0.3, 41]], hair[1 + (i % 2)]); }
    put(p, hr, 'dark');

    // --- robe falling to the floor, gold-worked hem and front panel
    const rm = mask(W, H);
    rm.poly([[42, 32], [70, 32], [74, 60], [78, 94], [34, 94], [38, 60]], 1);
    const rb = shade(rm, robe, { depth: 6, light: L, normal: cylN(cx - 2, 26), blend: 0.5, back: rim });
    for (const [x0, y0, x1, y1] of [[46, 58, 42, 92], [66, 58, 70, 92], [42, 62, 37, 92], [71, 62, 75, 92]]) { rb.line(x0, y0, x1, y1, robe[0]); rb.line(x0 + 1, y0, x1 + 1, y1, robe[5]); }
    // gold embroidery along the hem
    for (let x = 36; x <= 76; x += 4) { const y = 88; rb.set(x, y, GOLD[4]); rb.set(x + 1, y - 1, GOLD[3]); rb.set(x + 2, y, GOLD[4]); rb.set(x + 1, y + 1, GOLD[2]); }
    put(p, rb, 'dark');
    const fp = mask(W, H);
    fp.poly([[51, 52], [61, 52], [63, 94], [49, 94]], 1);
    const panel = shade(fp, lining, { depth: 2, light: L, global: 0.4, bias: -0.05 });
    trim(panel, [[51, 53], [50, 73], [49, 93]]); trim(panel, [[61, 53], [62, 73], [63, 93]]);
    for (let y = 58; y < 92; y += 8) stamp(panel, 54, y, ['.g.g.', 'g.G.g', '.g.g.'], { g: GOLD[2], G: GOLD[5] });
    put(p, panel, 'dark');
    trim(p, [[35, 92], [cx, 93], [77, 92]]);
    // boot tips
    for (const x of [48, 64]) put(p, part(W, H, (g) => g.poly([[x - 4, 95], [x - 3, 92], [x + 3, 92], [x + 5, 95]], 1), HORN, { depth: 1.5, light: L, spec: 0.9 }), 'dark');

    // --- chest: V-trimmed tunic, sash, ruby clasp
    const tm = mask(W, H);
    tm.poly([[44, 32], [68, 32], [67, 54], [45, 54]], 1);
    const tn = shade(tm, robe, { depth: 4, light: L, normal: sphereN(cx - 2, 40, 14, 16), blend: 0.35, back: rim, bias: 0.05 });
    trim(tn, [[46, 33], [cx, 44], [66, 33]]);
    for (const [x0, x1] of [[47, 52], [60, 65]]) for (let y = 38; y < 52; y += 3) { tn.set(x0 + ((y / 3) % 2), y, robe[5]); tn.set(x1 - ((y / 3) % 2), y, robe[5]); }
    put(p, tn, 'dark');
    const sash = part(W, H, (g) => g.poly([[45, 51], [67, 51], [67, 54], [45, 54]], 1), robe.map((c) => mix(c, '#000000', 0.35)), { depth: 1.2, light: L, flat: 0.3 });
    trim(sash, [[45, 51], [67, 51]]);
    put(p, sash, 'dark');
    const md = mask(W, H); md.poly([[cx, 35], [cx + 6, 42], [cx, 49], [cx - 6, 42]], 1);
    const med = shade(md, GOLD, { depth: 2, light: L, spec: 0.9 });
    put(p, med, 'dark');
    const gem = mask(W, H); gem.ellipse(cx, 42, 2.6, 3.2, 1);
    put(p, shade(gem, ['#5a0814', '#a01020', '#e03030', '#ff8a70'], { depth: 2, light: L }), 'dark');
    p.set(cx - 1, 40, '#ffe0d0');

    // --- far arm (viewer's right): raised, palm of dark fire
    const ra = mask(W, H);
    ra.poly([[66, 34], [74, 34], [86, 44], [90, 52], [80, 54], [70, 46]], 1);
    const rsl = shade(ra, robe, { depth: 4, light: L, back: rim });
    trim(rsl, [[80, 53], [85, 53], [90, 51]]);
    put(p, rsl, 'dark');
    const rh = mask(W, H);
    rh.ellipse(86, 48, 3.4, 2.8, 1);
    for (const [x0, x1] of [[83, 82], [85.5, 85], [88, 88.5], [90, 92]]) cap(rh, x0, 47, x1, 42.5, 0.9, 0.6);
    put(p, shade(rh, skin, { depth: 1.5, light: L, back: rim }), 'dark');
    const df = mask(W, H);
    df.circle(87, 37, 5, 1);
    tongue(df, 87, 35, 89, 20, 4.5, 3); tongue(df, 83, 36, 79, 27, 3, -2); tongue(df, 91, 36, 95, 28, 2.6, 2);
    put(p, fireFill(df, 21, DARKFIRE, { core: 0.7 }), 'dark');

    // --- near arm (viewer's left): hand on the sceptre
    const la = mask(W, H);
    la.poly([[46, 34], [38, 34], [31, 46], [30, 57], [40, 57], [42, 46]], 1);
    const lsl = shade(la, robe, { depth: 4, light: L, back: rim });
    trim(lsl, [[30, 56], [35, 57], [40, 56]]);
    put(p, lsl, 'dark');
    // sceptre: gold rod, winged orb head with a violet crystal
    const sc = part(W, H, (g) => cap(g, 40, 88, 25, 22, 1.4), GOLD, { depth: 1.2, light: L });
    for (let t = 0.1; t < 0.95; t += 0.14) { const x = Math.round(40 - 15 * t), y = Math.round(88 - 66 * t); on(sc, x, y, GOLD[1]); }
    put(p, sc, 'dark');
    for (const s of [-1, 1]) {
      const wg = mask(W, H);
      wg.poly([[24, 18], [24 + s * 9, 10], [24 + s * 11, 14], [24 + s * 8, 16], [24 + s * 10, 19], [24 + s * 6, 20]], 1);
      put(p, shade(wg, GOLD, { depth: 1.5, light: L }), 'dark');
    }
    const orb = mask(W, H); orb.ellipse(24, 16, 4, 5, 1);
    put(p, fireFill(orb, 7, DARKFIRE, { core: 0.8 }), 'dark');
    p.set(23, 13, '#ffffff'); p.set(22, 14, DARKFIRE[4]);
    put(p, part(W, H, (g) => g.poly([[21, 21], [27, 21], [26, 24], [22, 24]], 1), GOLD, { depth: 1.2, light: L }), 'dark');
    const lh = mask(W, H);
    lh.ellipse(34, 58.5, 3.8, 3.4, 1);
    put(p, shade(lh, skin, { depth: 1.8, light: L }), 'dark');
    for (const y of [57, 59]) p.hline(32, 37, y, skin[1]);

    // --- shoulder mantles: layered, spiked, gold-edged
    both(W, (X) => {
      const sm = mask(W, H);
      sm.poly([[X(46), 30], [X(36), 30], [X(30), 36], [X(34), 42], [X(44), 40]], 1);
      const sh = shade(sm, HORN, { depth: 2.5, light: L, back: rim, spec: 0.95 });
      trim(sh, [[X(31), 37], [X(35), 41], [X(44), 39]]);
      put(p, sh, 'dark');
      for (const [bx, by, tx, ty] of [[X(33), 33, X(26), 27], [X(37), 31, X(33), 23], [X(42), 31, X(41), 24]]) {
        const sp = part(W, H, (g) => cap(g, bx, by, tx, ty, 1.9, 0.3), HORN, { depth: 1.2, light: L, back: rim, bias: 0.15 });
        sp.set(Math.round(tx), Math.round(ty), GOLD[5]); sp.set(Math.round(tx + (bx - tx) * 0.15), Math.round(ty + (by - ty) * 0.15), GOLD[3]);
        put(p, sp, 'dark');
      }
    });

    // --- horns: great obsidian crescents out past the hair, banded with gold
    both(W, (X) => {
      const pts = [[X(50), 15], [X(35), 17], [X(28), 9], [X(33), 2]];
      const hn = mask(W, H);
      tube(hn, pts, 5.2, 0.6, 1, 30);
      const h = shade(hn, HORN, { depth: 3, light: L, back: rim, spec: 0.9, bias: 0.12 });
      for (let i = 1; i < 9; i++) { const q = bez(pts, i / 9); on(h, Math.round(q[0]), Math.round(q[1]) + 2, HORN[0]); on(h, Math.round(q[0]), Math.round(q[1]) - 1, HORN[5]); }
      put(p, h, 'dark');
      const q = bez(pts, 0.14);
      put(p, part(W, H, (g) => cap(g, q[0] - 3, q[1] + 2, q[0] + 3, q[1] - 2, 1.5), GOLD, { depth: 1.2, light: L }), 'dark');
    });

    // --- head: pale sharp face, pointed ears, cold gold eyes
    both(W, (X) => put(p, part(W, H, (g) => g.poly([[X(48), 20], [X(40), 16], [X(48), 27]], 1), skin, { depth: 1.2, light: L }), 'dark'));
    const fm = mask(W, H);
    fm.ellipse(cx, 21, 8.5, 9.5, 1);
    fm.poly([[47.5, 22], [64.5, 22], [61.5, 30], [cx, 34], [50.5, 30]], 1);
    const face = shade(fm, skin, { depth: 4, light: L, normal: sphereN(cx - 1.5, 20, 9, 11), blend: 0.35, rim: 1 });
    put(p, face, 'dark');
    // fringe of hair across the brow
    const fr = mask(W, H);
    fr.poly([[47, 18], [cx - 2, 13], [cx + 4, 13], [65, 18], [62, 17], [58, 19], [cx, 16], [cx - 2, 19], [50, 17]], 1);
    put(p, shade(fr, hair, { depth: 1.5, light: L }), 'dark');
    both(W, (X) => {
      p.line(X(49), 20, X(54), 22, INK); p.line(X(49), 19, X(53), 20, hair[1]);
      stamp(p, Math.min(X(50), X(54)), 22, X(0) === 0 ? ['kyyWk', '.kRk.'] : ['kWyyk', '.kRk.'], { k: INK, y: '#ffd040', W: '#fff8d0', R: '#d02020' });
      p.line(X(52), 26, X(54), 27, skin[1]);
    });
    p.vline(cx, 23, 27, skin[4]); p.set(cx - 1, 28, skin[1]); p.set(cx + 1, 28, skin[1]); p.set(cx, 28, skin[0]);
    // violet shadow over the eyes, hollow cheeks, a thin cruel smirk with one fang
    both(W, (X) => {
      for (const x of [50, 51, 52, 53]) if (p.get(X(x), 21) !== INK) p.set(X(x), 21, '#6a4a8e');
      p.line(X(50), 26, X(51), 28, skin[1]);
    });
    p.hline(cx - 3, cx + 2, 30, '#3a1a3a'); p.set(cx - 4, 29, '#3a1a3a'); p.set(cx + 3, 29, '#3a1a3a'); p.set(cx + 4, 28, '#3a1a3a');
    p.hline(cx - 2, cx + 2, 31, skin[3]); p.set(cx + 1, 31, WHITE);

    // --- crown: gold circlet with spikes and a red gem
    const cr = mask(W, H);
    cr.poly([[47, 16], [65, 16], [64, 12.5], [48, 12.5]], 1);
    for (const [x, t] of [[48.5, 7], [52, 9], [cx, 3], [60, 9], [63.5, 7]]) cr.poly([[x - 2, 13], [x + 2, 13], [x, t]], 1);
    const crown = shade(cr, GOLD, { depth: 1.5, flat: 0.3, light: L, global: 0.5, spec: 0.9 });
    put(p, crown, 'dark');
    stamp(p, cx - 1, 12, ['.r.', 'rRr', '.r.'], { r: '#a01020', R: '#ff5040' });
    p.set(cx - 1, 11, '#ffd0c0');

    return finish(p, { post: (q) => {
      for (const [x, y, c] of [[92, 18, DARKFIRE[3]], [80, 22, DARKFIRE[2]], [96, 30, DARKFIRE[3]], [18, 8, DARKFIRE[3]], [30, 10, DARKFIRE[2]]]) q.set(x, y, c);
    }, free: true });
  };

  // ================================================================ demon king, true form
  // The final boss: a colossal four-armed beast-dragon. Great bat wings fill the
  // sky behind it; a horned, three-eyed dragon skull with slanted burning eyes
  // and a maw full of violet fire; upper arms flung out with ivory talons, lower
  // arms reaching forward, gold bracers, pale belly plates under a burning
  // heart-crest, crouched digitigrade legs and a spade-tipped tail. The top ~18
  // rows sit behind the battle windows, so only wing and horn tips live there.
  // 128x112.
  S.boss_demon_king2 = () => {
    const W = 128, H = 112;
    const scale = ramp('#3a7466', 7, { dark: 0.8, light: 0.6 });
    const belly = ramp('#a8b48c', 6, { dark: 0.72, light: 0.6, shift: 16 });
    const memb = ramp('#6a2a78', 6, { dark: 0.8, light: 0.5 });
    const ivory = ramp('#ddd0b0', 6, { dark: 0.66, shift: 30 });
    const CORE2 = ['#3a0838', '#8a1878', '#d838b8', '#ff90e0', '#fff0ff'];
    const L = [-0.45, -0.75, 0.55];
    const p = G().pix(W, H);
    const cx = 64;
    const talon = (x0, y0, x1, y1, xc, yc, r) => put(p, part(W, H, (g) => tube(g, [[x0, y0], [xc, yc], [x1, y1]], r || 1.6, 0.3, 1, 10), ivory, { depth: 1.2, light: L }), 'dark');
    const soft = (q, w, h, m) => scales(q, scale, w, h, { lit: 0, mask: m });

    // --- wings: bone arm to the wrist, fingers fanning out, scalloped membrane
    both(W, (X) => {
      const S0 = [44, 46], E = [28, 16], Wr = [12, 4];
      const tips = [[1, 17], [1, 35], [4, 51], [15, 60]];
      const poly = [S0, E, Wr];
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i], prev = i ? tips[i - 1] : Wr;
        poly.push([(prev[0] + t[0]) / 2 + 6, (prev[1] + t[1]) / 2 - 1], t);
      }
      poly.push([34, 58]);
      const m = mask(W, H);
      m.poly(poly.map(([x, y]) => [X(x), y]), 1);
      const wm = G().pix(W, H);
      // membrane: darker toward the trailing edge, lit near the bones
      const D = edt(m);
      m.each((x, y) => {
        const t = Math.hypot(x - X(Wr[0]), y - Wr[1]) / 58;
        let k = 3.6 - t * 3 + (D[y * W + x] < 2 ? -0.6 : 0) + ((x + y) % 2 ? 0.25 : 0);
        wm.set(x, y, memb[Math.max(0, Math.min(5, Math.floor(k)))]);
      });
      for (const t of tips) curve(wm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 2), (Wr[1] + t[1]) / 2 + 1], [X(t[0]), t[1]]], memb[5]);
      put(p, wm, 'dark');
      const bm = mask(W, H);
      cap(bm, X(S0[0]), S0[1], X(E[0]), E[1], 2.8, 2.2);
      cap(bm, X(E[0]), E[1], X(Wr[0]), Wr[1], 2.2, 1.8);
      for (const t of tips) tube(bm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 3), (Wr[1] + t[1]) / 2], [X(t[0]), t[1]]], 1.2, 0.5, 1, 14);
      put(p, shade(bm, scale, { depth: 1.8, light: L, bias: 0.06 }), 'dark');
      talon(X(Wr[0]), Wr[1], X(Wr[0] + 7), Wr[1] - 2.5, X(Wr[0] + 5), Wr[1] + 1, 1.8);
      put(p, part(W, H, (g) => g.circle(X(E[0]), E[1], 2.6, 1), scale, { depth: 2, light: L }), 'dark');
      talon(X(E[0]), E[1] - 2, X(E[0] + 2), E[1] - 9, X(E[0] + 2), E[1] - 5, 1.6);
    });

    // --- tail sweeping out to the right with a spade tip
    const tp = [[74, 100], [100, 108], [121, 102], [117, 84]];
    const tl = mask(W, H);
    tube(tl, tp, 7, 2.2, 1, 30);
    const tail = shade(tl, scale, { depth: 4, light: L });
    soft(tail, 5, 4);
    put(p, tail, 'dark');
    put(p, part(W, H, (g) => g.poly([[117, 86], [110, 80], [117, 69], [124, 80]], 1), memb, { depth: 2, light: L, bias: 0.15 }), 'dark');
    for (const t of [0.45, 0.62, 0.78]) { const q = bez(tp, t); put(p, part(W, H, (g) => g.poly([[q[0] - 2, q[1] - 4], [q[0] + 2, q[1] - 4], [q[0] + 1.5, q[1] - 9]], 1), ivory, { depth: 1, light: L }), 'dark'); }

    // --- legs: crouched, digitigrade, clawed feet
    both(W, (X) => {
      const lm = mask(W, H);
      cap(lm, X(50), 88, X(36), 96, 9.5, 8); cap(lm, X(36), 96, X(40), 105, 6.5, 5.5);
      const leg = shade(lm, scale, { depth: 6, light: L, bias: 0.04 });
      soft(leg, 5, 4);
      put(p, leg, 'dark');
      put(p, part(W, H, (g) => g.ellipse(X(40), 106.5, 7.5, 3.5, 1), scale, { depth: 2.5, light: L }), 'dark');
      for (const [x1, xc] of [[X(31), X(33)], [X(38), X(37)], [X(46), X(45)]]) talon(X(40), 105.5, x1, 110, xc, 109, 1.6);
    });

    // --- upper arms: flung out at shoulder height, talons raised
    both(W, (X) => {
      const ua = mask(W, H);
      cap(ua, X(42), 60, X(23), 67, 7, 6); cap(ua, X(23), 67, X(13), 57, 6, 5);
      const arm = shade(ua, scale, { depth: 5, light: L });
      soft(arm, 4, 3);
      curve(arm, [[X(34), 60], [X(28), 61], [X(23), 64]], scale[1]);
      curve(arm, [[X(38), 56], [X(32), 55], [X(27), 58]], scale[5]);
      put(p, arm, 'dark');
      talon(X(23), 70, X(20), 76, X(23), 74, 1.8);
      const bz = part(W, H, (g) => cap(g, X(14.5), 58.5, X(17), 61.5, 5.4, 5.2), GOLD, { depth: 2.2, light: L, spec: 0.92 });
      curve(bz, [[X(10.5), 60], [X(14), 62.5], [X(19), 64]], GOLD[1]); curve(bz, [[X(12), 56], [X(16), 58], [X(20.5), 59]], GOLD[1]);
      stamp(bz, Math.min(X(15), X(16)), 59, ['rr', 'rR'], { r: '#8a1878', R: '#ff90e0' });
      put(p, bz, 'dark');
      put(p, part(W, H, (g) => g.ellipse(X(12), 54, 6, 5, 1), scale, { depth: 3, light: L }), 'dark');
      for (const [x1, y1, xc, yc] of [[X(1), 49, X(3), 53], [X(4), 43, X(5), 48], [X(11), 41, X(10), 46], [X(18), 43, X(17), 47]]) talon(X(12), 52, x1, y1, xc, yc, 1.8);
    });

    // --- torso: broad scaled chest, pale belly plates, burning heart-crest
    const tm = mask(W, H);
    tm.ellipse(cx, 71, 23, 19, 1);
    tm.ellipse(cx, 58, 29, 9, 1);
    tm.poly([[45, 80], [83, 80], [76, 96], [52, 96]], 1);
    const torso = shade(tm, scale, { depth: 9, light: L, normal: sphereN(cx - 3, 66, 30, 28), blend: 0.35 });
    soft(torso, 7, 5);
    put(p, torso, 'dark');
    const bp = mask(W, H);
    bp.poly([[53, 66], [75, 66], [74, 84], [69, 97], [59, 97], [54, 84]], 1);
    const bel = shade(bp, belly, { depth: 4, light: L, normal: cylN(cx - 1, 13), blend: 0.5, rim: 1 });
    for (const y of [71, 77, 83, 89]) { curve(bel, [[52, y - 1], [cx, y + 1.5], [76, y - 1]], belly[1]); curve(bel, [[52, y], [cx, y + 2.5], [76, y]], belly[4]); }
    put(p, bel, 'dark');
    // pectoral plates framing the crest
    both(W, (X) => {
      const pl = mask(W, H);
      pl.poly([[X(38), 55], [X(58), 56], [X(61), 64], [X(52), 70], [X(39), 64]], 1);
      const pp = shade(pl, scale, { depth: 3, light: L, bias: 0.12 });
      curve(pp, [[X(40), 56], [X(50), 56], [X(58), 57]], scale[5]);
      put(p, pp, 'dark');
    });
    const cr = mask(W, H); cr.poly([[cx, 55], [cx + 8, 63], [cx, 72], [cx - 8, 63]], 1);
    put(p, shade(cr, GOLD, { depth: 2, light: L }), 'dark');
    const core = mask(W, H); core.ellipse(cx, 63, 4.5, 5.5, 1);
    put(p, fireFill(core, 3, CORE2, { core: 0.75 }), 'dark');
    p.set(cx - 2, 60, '#ffffff'); p.set(cx - 1, 60, CORE2[4]);

    // --- lower arms reaching forward, talons open
    both(W, (X) => {
      const la = mask(W, H);
      cap(la, X(44), 72, X(30), 82, 6.5, 5.5); cap(la, X(30), 82, X(36), 92, 5.5, 4.8);
      const arm = shade(la, scale, { depth: 4.5, light: L, bias: 0.06 });
      soft(arm, 4, 3);
      curve(arm, [[X(41), 69], [X(35), 72], [X(30), 78]], scale[5]);
      put(p, arm, 'dark');
      const bz = part(W, H, (g) => cap(g, X(32.5), 86, X(34.5), 89, 4.8, 4.6), GOLD, { depth: 2.2, light: L, spec: 0.92 });
      curve(bz, [[X(28.5), 88], [X(33), 90.5], [X(38.5), 90]], GOLD[1]); curve(bz, [[X(28.5), 84], [X(33), 86], [X(37.5), 85]], GOLD[1]);
      put(p, bz, 'dark');
      put(p, part(W, H, (g) => g.ellipse(X(37), 94, 5, 4.2, 1), scale, { depth: 2.5, light: L }), 'dark');
      for (const [x1, y1, xc, yc] of [[X(30), 103, X(31), 99], [X(35), 105, X(35), 101], [X(41), 104, X(40), 100], [X(45), 99, X(43), 97]]) talon(X(37), 95, x1, y1, xc, yc, 1.5);
    });

    // --- shoulder spikes
    both(W, (X) => {
      for (const [bx, by, tx, ty, r] of [[X(40), 52, X(33), 40, 3.4], [X(47), 50, X(44), 39, 2.8]]) put(p, part(W, H, (g) => cap(g, bx, by, tx, ty, r, 0.3), ivory, { depth: 1.6, light: L }), 'dark');
    });

    // --- spiked crest behind the skull
    for (const [bx, by, tx, ty, r] of [[cx, 26, cx, 12, 3], [cx - 7, 24, cx - 12, 13, 2.4], [cx + 7, 24, cx + 12, 13, 2.4]]) put(p, part(W, H, (g) => cap(g, bx, by, tx, ty, r, 0.3), memb, { depth: 1.6, light: L, bias: 0.2 }), 'dark');

    // --- great horns sweeping out and up
    both(W, (X) => {
      const pts = [[X(55), 28], [X(42), 26], [X(34), 20], [X(32), 3]];
      const hn = mask(W, H); tube(hn, pts, 5, 0.6, 1, 26);
      const h = shade(hn, ivory, { depth: 2.6, light: L });
      for (let i = 1; i < 8; i++) { const q = bez(pts, i / 8); on(h, Math.round(q[0]), Math.round(q[1]) + 2, ivory[1]); on(h, Math.round(q[0]) + 1, Math.round(q[1]) + 2, ivory[2]); }
      put(p, h, 'dark');
    });

    // --- head: broad dragon skull, heavy brows, three eyes, maw of violet fire
    const hm = mask(W, H);
    hm.ellipse(cx, 31, 15, 11.5, 1);
    hm.poly([[49, 31], [79, 31], [76, 42], [72, 47], [56, 47], [52, 42]], 1);
    const head = shade(hm, scale, { depth: 5, light: L, normal: sphereN(cx - 2, 30, 15, 14), blend: 0.35 });
    soft(head, 4, 3, (() => { const q = mask(W, H); q.ellipse(cx, 25, 11, 4, 1); return q; })());
    put(p, head, 'dark');
    // cheek spikes swept back from the jaw hinge
    both(W, (X) => {
      const hn = mask(W, H); tube(hn, [[X(53), 45], [X(46), 44], [X(40), 39]], 2.6, 0.4, 1, 14);
      put(p, shade(hn, ivory, { depth: 1.5, light: L }), 'dark');
    });
    // lower jaw hanging open
    const jaw = mask(W, H);
    jaw.poly([[54, 50], [74, 50], [71, 57], [cx, 60], [57, 57]], 1);
    put(p, shade(jaw, scale, { depth: 2.2, light: L, bias: -0.02 }), 'dark');
    // the maw: dark throat with violet fire deep inside
    const mw = mask(W, H);
    mw.poly([[55, 44], [73, 44], [71, 53], [cx, 55], [57, 53]], 1);
    const throat = G().pix(W, H);
    mw.each((x, y) => { const d = Math.hypot((x - cx) / 7, (y - 51) / 4); throat.set(x, y, d < 0.45 ? CORE2[3] : d < 0.75 ? CORE2[2] : d < 1.05 ? CORE2[1] : d < 1.4 ? '#3a0a30' : '#1a0418'); });
    put(p, throat);
    // jagged fangs: upper row hanging down, lower row rising
    const fang = (x, y, len, dir, w) => {
      for (let k = 0; k < len; k++) {
        const hw = Math.max(0, Math.round(w * (1 - k / len)));
        for (let d = -hw; d <= hw; d++) p.set(x + d, y + dir * k, k === len - 1 ? ivory[2] : d < 0 ? WHITE : ivory[4]);
      }
    };
    for (const [x, l, w] of [[57, 7, 1], [60, 3, 0], [62, 4, 0], [66, 4, 0], [68, 3, 0], [71, 7, 1]]) fang(x, 44, l, 1, w);
    for (const [x, l, w] of [[59, 4, 1], [64, 3, 0], [69, 4, 1]]) fang(x, 53, l, -1, w);
    // snout ridge and nostrils
    for (let y = 36; y <= 42; y++) { on(p, cx - 1, y, scale[5]); on(p, cx, y, scale[3]); }
    stamp(p, cx - 4, 41, ['kk....kk', '.k....k.'], { k: INK });
    // heavy V brows over slanted, glowing slit eyes
    both(W, (X) => {
      put(p, part(W, H, (g) => cap(g, X(50), 27, X(62), 34, 3, 2), scale, { depth: 2, light: [-0.4, -0.9, 0.3], bias: 0.22 }), 'dark');
      const em = mask(W, H);
      em.poly([[X(51), 34], [X(61), 36.5], [X(59), 39], [X(53), 38]], 1);
      const eye = G().pix(W, H);
      em.each((x, y) => { eye.set(x, y, y <= 35 ? '#fff4b0' : y <= 36 ? '#ffd040' : y <= 37 ? '#f0a020' : '#c05010'); });
      put(p, eye, INK);
      p.line(X(50), 33, X(62), 36, INK); p.line(X(50), 34, X(50), 35, INK); // heavy upper lid
      p.vline(X(56), 35, 38, INK); p.set(X(56), 36, '#300808');
      p.set(X(53), 35, WHITE);
    });
    // third eye on the brow
    stamp(p, cx - 1, 22, ['.k.', 'krk', 'kRk', 'kRk', 'krk', '.k.'], { k: INK, r: '#d02030', R: '#ffb0a0' });

    // rim light on the outer silhouette: cold from the right, the heart's glow from below
    const body = new Set([...scale, ...memb, ...ivory]);
    edgeLight(p, { src: (c) => body.has(c), nb: (c) => c == null, dirs: [{ d: [1, 0], c: '#8ee0c4' }, { d: [0, 1], c: '#b458c4' }] });

    return finish(p, { post: (q) => {
      for (const [x, y, c] of [[20, 90, CORE2[3]], [108, 62, CORE2[2]], [6, 82, CORE2[3]], [122, 44, CORE2[3]]]) q.set(x, y, c);
    }, free: true });
  };

  // ------------------------------------------------------------ registry
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
})(window.RPG);
