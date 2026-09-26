// Monster composition (A14a mons-parts, DESIGN §9.4.3–§9.4.5): R.Art.compose builds a regular monster
// sprite from a base sprite ('mon:<base>'), a colour shift {hue, sat, bri}, a list of parts drawn in
// their own exact colours, and an optional whole-sprite filter.
//
//   R.Art.compose(base, hsb, parts, filter, id?) → canvas (same size as the base)
//   R.Art.MON_ANCHORS[base] = { head, brow, eyes:[[x,y],…], mouth, neck, back, body, hand, hand2, tail, feet, … }
//   R.Art.PARTS[id]   = (pix, anchor, opts) => void      (66 parts: monsters_parts_head/_body/_fx/_items.js)
//   R.Art.FILTERS[id] = (pix, seed, info) => void       (6 filters, here)
//   R.Art.PART_LAYER[id] = 'back' | 'front'
//   R.Art.monAnchors(base) → resolved anchors (table + automatic defaults), for tools
//   R.Art.PartTK     the drawing toolkit the part files use (looked up lazily inside factories)
//
// Pipeline (§9.4.3): 1. R.Gfx.variant('mon:'+base, hsb) recolours the base. 2. every part draws into a
// fresh layer (`pix` = solid pixels that get contours and the outline, `opts.fx` = glow / dither pixels that
// never get an outline); back layers go behind the base, front layers over it with a dark inner contour
// where their edge crosses the body. 4. a 1-px #120c16 outline closes every pixel a part added (the base
// keeps its own outline untouched). 3. the filter runs last over the whole sprite, so filters that restyle
// the outline (paper, shade) also cover the parts (the outline is added before the filter for that reason).
// 5. the canvas keeps the base's size; whatever sticks out is clipped.
// `id` (the spriteId) seeds the random placement of scattered parts and the filters; without it the seed
// comes from the arguments, so the result is always deterministic.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const G = () => R.Gfx;
  const OUT = '#120c16'; // outline (§9.4.3 step 4)
  const INK = '#1c1420'; // inner lines, pupils
  const WHITE = '#f8f8f4';

  // ---------------------------------------------------------------- colours
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  function hsv(h) {
    const [r, g, b] = rgb(h).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hh = 0;
    if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hh * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function fromHsv(h, s, v) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); v = clamp(v, 0, 1);
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
  function dk(h, k) { const [r, g, b] = rgb(h); return hex(r * k, g * k, b * k); }
  function towards(h, target, amt) { const d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); }
  /**
   * Hue-shifted SFC ramp dark → light with `base` in the middle: shadows drift toward violet and get
   * darker, lights drift toward yellow and lighter. o: {dark, light, shift, mid (0..1 position of base)}
   */
  function ramp(base, n, o) {
    n = n || 5; o = o || {};
    const [h, s, v] = hsv(base);
    const k = Math.round((n - 1) * (o.mid == null ? 0.5 : o.mid));
    const dark = o.dark == null ? 0.62 : o.dark, light = o.light == null ? 0.62 : o.light;
    const shift = o.shift == null ? 20 : o.shift;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i < k) {
        const t = (k - i) / k;
        out.push(fromHsv(s < 0.08 ? h : towards(h, 262, shift * t), s < 0.08 ? s + 0.12 * t : s + (1 - s) * 0.2 * t, v * (1 - dark * t)));
      } else if (i > k) {
        const t = (i - k) / (n - 1 - k);
        out.push(fromHsv(s < 0.08 ? h : towards(h, 58, shift * 0.7 * t), s * (1 - 0.55 * light * t), v + (1 - v) * light * t));
      } else out.push(base);
    }
    return out;
  }
  /** metal ramp: stronger contrast and a near-white highlight (weapons, crowns, helmets) */
  const metal = (base, n) => ramp(base, n || 5, { dark: 0.7, light: 0.8, mid: 0.45 });

  // ---------------------------------------------------------------- random
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- masks & shapes
  const mask = (w, h) => G().pix(w, h);
  /** tapered capsule from (x0,y0,r0) to (x1,y1,r1) */
  function capsule(p, x0, y0, x1, y1, r0, r1, c) {
    if (r1 == null) r1 = r0;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    const m = Math.max(r0, r1) + 1;
    for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.ceil(Math.max(y0, y1) + m); y++)
      for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.ceil(Math.max(x0, x1) + m); x++) {
        const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1);
        const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t;
        if ((x - px) * (x - px) + (y - py) * (y - py) <= (r + 0.35) * (r + 0.35)) p.set(x, y, c);
      }
    return p;
  }
  /** quadratic-bezier tube: pts [a, ctrl, b], radius r0 → r1 */
  function tube(p, pts, r0, r1, c, steps) {
    const [a, b, d] = pts;
    const n = steps || 16;
    let px = a[0], py = a[1];
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * b[0] + t * t * d[0];
      const y = u * u * a[1] + 2 * u * t * b[1] + t * t * d[1];
      capsule(p, px, py, x, y, r0 + ((r1 - r0) * (i - 1)) / n, r0 + ((r1 - r0) * i) / n, c);
      px = x; py = y;
    }
    return p;
  }
  /** point on a quadratic bezier */
  function bez(pts, t) {
    const [a, b, d] = pts, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * b[0] + t * t * d[0], u * u * a[1] + 2 * u * t * b[1] + t * t * d[1]];
  }
  /** thin 1-px line (Bresenham) */
  function line(p, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      p.set(x0, y0, typeof c === 'function' ? c(x0, y0) : c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return p;
  }

  // distance-field ("pillow") shading, same method as the base sprites
  const OFFS = (() => {
    const a = [];
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const d = Math.hypot(dx, dy); if (d > 0 && d <= 10.5) a.push([dx, dy, d]); }
    return a.sort((p, q) => p[2] - q[2]);
  })();
  function distField(m, cap) {
    const w = m.w, h = m.h, D = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (m.d[i] == null) continue;
      let best = cap;
      for (const o of OFFS) {
        if (o[2] - 0.5 >= best) break;
        const X = x + o[0], Y = y + o[1];
        if (X < 0 || Y < 0 || X >= w || Y >= h || m.d[Y * w + X] == null) { best = o[2] - 0.5; break; }
      }
      D[i] = best;
    }
    return D;
  }
  /**
   * Light a mask with a ramp (bevel from the distance to its edge, top-left light).
   * o: {depth, light:[x,y,z], amb, bias, global (whole-shape gradient), rim}
   */
  function shade(m, rmp, o) {
    o = o || {};
    const w = m.w, h = m.h, n = rmp.length, depth = o.depth || 3;
    const D = distField(m, depth + 1), H = new Float32Array(w * h);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < H.length; i++) {
      if (m.d[i] == null) continue;
      const t = Math.min(1, D[i] / depth);
      H[i] = depth * Math.sqrt(1 - (1 - t) * (1 - t));
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const out = G().pix(w, h);
    if (x1 < 0) return out;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2);
    let L = o.light || [-0.55, -0.75, 0.62];
    const ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    const amb = o.amb == null ? 0.12 : o.amb, glob = o.global == null ? 0.3 : o.global;
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m.d[y * w + x] != null;
    const hAt = (x, y) => (inside(x, y) ? H[y * w + x] : 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (m.d[i] == null) continue;
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
      const nl = Math.hypot(gx, gy, 1);
      const nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
      const dot = nx * L[0] + ny * L[1] + nz * L[2];
      let v = amb + (1 - amb) * Math.max(0, dot);
      v += glob * (((x - cx) / hw) * L[0] + ((y - cy) / hh) * L[1]) * 0.5;
      v += o.bias || 0;
      let k = clamp(Math.floor(clamp(v, 0, 0.999) * n), 0, n - 1);
      if (o.rim && (!inside(x + 1, y) || !inside(x, y + 1)) && dot < 0.5) k = Math.min(n - 1, k + o.rim);
      out.d[i] = rmp[k];
    }
    return out;
  }
  /** build a mask with fn(m) (paint with any colour) and shade it */
  function part(w, h, fn, rmp, o) { const m = mask(w, h); fn(m); return shade(m, rmp, o); }
  /**
   * Ramp index for a cylinder lit from the left: t = 0 at the left edge, 1 at the right. The light
   * band sits at ~30 %, the right third falls into shadow (SFC metal and cloth).
   */
  function cyl(t, n) {
    const v = t < 0.3 ? 0.62 + t * 1.25 : 1 - (t - 0.3) * 1.25;
    return clamp(Math.floor(clamp(v, 0, 0.999) * n), 0, n - 1);
  }
  /** layer src over dst; line: a colour or 'dark' for a contour on dst pixels just outside src's edge */
  function put(dst, src, lineC) {
    if (lineC) {
      const at = (x, y) => (x >= 0 && y >= 0 && x < src.w && y < src.h ? src.d[y * src.w + x] : null);
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        if (at(x, y) != null) continue;
        if (at(x - 1, y) == null && at(x + 1, y) == null && at(x, y - 1) == null && at(x, y + 1) == null) continue;
        const dc = dst.get(x, y);
        if (dc == null || lum(dc) < 0.1) continue;
        dst.set(x, y, lineC === 'dark' ? dk(dc, 0.45) : lineC);
      }
    }
    return dst.blit(src, 0, 0);
  }
  /** stamp rows with a palette, optionally mirrored horizontally (flip) */
  function stamp(p, x, y, rows, pal, flip) {
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c == null) continue;
        p.set(flip ? x + r.length - 1 - i : x + i, y + j, c);
      }
    }
    return p;
  }
  /** fill a mask with fn(x,y) → colour */
  function paint(p, m, fn) {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.d[y * m.w + x] != null) { const c = fn(x, y); if (c) p.set(x, y, c); }
    return p;
  }
  function bboxOf(p) {
    let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[y * p.w + x] != null) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  // ---------------------------------------------------------------- base analysis
  function toPix(cv) {
    const p = G().pix(cv.width, cv.height);
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < p.d.length; i++) if (d[i * 4 + 3] > 127) p.d[i] = hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    return p;
  }
  /** a canvas read back once per canvas (bases are shared by many ids); returns a fresh copy */
  const PIX_CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;
  function pixOf(cv) {
    let d = PIX_CACHE && PIX_CACHE.get(cv);
    if (!d) { d = toPix(cv).d; if (PIX_CACHE) PIX_CACHE.set(cv, d); }
    const p = G().pix(cv.width, cv.height);
    p.d = d.slice();
    return p;
  }
  const SIZE_K = { s: 1, m: 1.5, l: 2 };
  function sizeOf(w, h) { const m = Math.max(w, h); return m <= 32 ? 's' : m <= 48 ? 'm' : 'l'; }
  /** silhouette information about a (recoloured) base Pix */
  function analyze(P) {
    const w = P.w, h = P.h;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = P.d[i] != null ? 1 : 0;
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1;
    const top = new Int16Array(w).fill(-1), bot = new Int16Array(w).fill(-1);
    const left = new Int16Array(h).fill(-1), right = new Int16Array(h).fill(-1);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (on(x, y)) { if (top[x] < 0) top[x] = y; bot[x] = y; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { if (left[y] < 0) left[y] = x; right[y] = x; }
    const bb = bboxOf(P) || { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
    const size = sizeOf(w, h);
    /** outline pixel of the base: dark and next to transparency */
    const isOut = (x, y) => on(x, y) && lum(P.d[y * w + x]) < 0.1 && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1));
    /** interior pixel (opaque, not part of the outline ring) */
    const inner = (x, y) => on(x, y) && !isOut(x, y);
    return { w, h, size, k: SIZE_K[size], solid, on, isOut, inner, top, bot, left, right, bbox: bb };
  }
  /** contour points of the silhouette facing `dir` ('up' | 'down' | 'any'), as outline-ring pixels */
  function contour(info, dir) {
    const pts = [];
    const { w, h, on } = info;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const up = !on(x, y - 1), dn = !on(x, y + 1), lf = !on(x - 1, y), rt = !on(x + 1, y);
      if (!(up || dn || lf || rt)) continue;
      // outward normal from the empty neighbours
      let nx = (lf ? -1 : 0) + (rt ? 1 : 0), ny = (up ? -1 : 0) + (dn ? 1 : 0);
      if (!nx && !ny) continue;
      const l = Math.hypot(nx, ny); nx /= l; ny /= l;
      if (dir === 'up' && ny > -0.3) continue;
      if (dir === 'down' && ny < 0.3) continue;
      pts.push({ x, y, nx, ny });
    }
    return pts;
  }

  // ---------------------------------------------------------------- anchors
  const ANCHOR_KEYS = ['head', 'brow', 'eyes', 'mouth', 'neck', 'back', 'body', 'hand', 'hand2', 'tail', 'feet'];
  A.MON_ANCHORS = A.MON_ANCHORS || {};
  /** automatic anchors from the silhouette (bases without a table entry, e.g. bosses and rares) */
  function autoAnchors(info) {
    const b = info.bbox, W = b.x1 - b.x0 + 1, H = b.y1 - b.y0 + 1;
    const cx = Math.round((b.x0 + b.x1) / 2);
    const Y = (t) => Math.round(b.y0 + H * t), X = (t) => Math.round(b.x0 + W * t);
    const topY = info.top[cx] >= 0 ? info.top[cx] : b.y0;
    return {
      head: [cx, topY], brow: [cx, topY + Math.round(H * 0.1)],
      eyes: [[cx - Math.max(2, Math.round(W * 0.1)), topY + Math.round(H * 0.18)], [cx + Math.max(2, Math.round(W * 0.1)), topY + Math.round(H * 0.18)]],
      mouth: [cx, topY + Math.round(H * 0.3)], neck: [cx, Y(0.4)], back: [cx, Y(0.3)], body: [cx, Y(0.6)],
      hand: [X(0.12), Y(0.55)], hand2: [X(0.88), Y(0.55)], tail: [X(0.9), Y(0.75)], feet: [cx, b.y1],
      headW: Math.max(6, Math.round(W * 0.4)),
    };
  }
  /** resolved anchors of a base: table values, missing keys → body (§9.4.3), no table → automatic */
  function resolveAnchors(base, info) {
    const c = A.monstersC && A.monstersC.anchors && A.monstersC.anchors[base];
    const t = A.MON_ANCHORS[base] || c ? Object.assign({}, c || {}, A.MON_ANCHORS[base] || {}) : null;
    const auto = autoAnchors(info);
    if (!t) return Object.assign({ auto: true }, auto);
    const out = Object.assign({}, t);
    const body = t.body || auto.body;
    for (const k of ANCHOR_KEYS) if (!out[k]) out[k] = k === 'eyes' ? [body.slice(), body.slice()] : body.slice();
    if (!out.headW) out.headW = auto.headW;
    return out;
  }
  A.monAnchors = (base) => {
    const cv = G().get('mon:' + base);
    return resolveAnchors(base, analyze(pixOf(Array.isArray(cv) ? cv[0] : cv)));
  };

  // ---------------------------------------------------------------- filters (§9.4.5)
  A.FILTERS = A.FILTERS || {};
  const F = A.FILTERS;
  /** luminance → index into a palette (gamma so mid tones spread over the ramp) */
  function lumTo(pal, l, g) { return pal[clamp(Math.floor(Math.pow(clamp(l, 0, 0.999), g || 1) * pal.length), 0, pal.length - 1)]; }
  /** outline ring pixels of a finished Pix (dark and next to transparency) */
  function ringOf(p) {
    const w = p.w, h = p.h, r = new Uint8Array(w * h);
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && p.d[y * w + x] != null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = p.d[y * w + x];
      if (c == null || lum(c) >= 0.12) continue;
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) r[y * w + x] = 1;
    }
    return r;
  }
  /** normalised luminance over the sprite (so dark and light bases both use the whole ramp) */
  function lumRange(p, ring) {
    let lo = 1, hi = 0;
    for (let i = 0; i < p.d.length; i++) {
      const c = p.d[i];
      if (c == null || ring[i]) continue;
      const l = lum(c);
      if (l < 0.1) continue;
      if (l < lo) lo = l; if (l > hi) hi = l;
    }
    if (hi <= lo) { lo = 0; hi = 1; }
    return (l) => clamp((l - lo) / (hi - lo), 0, 1);
  }
  const PAPER = ['#8a8a98', '#a4a4b0', '#c8c4b8', '#e2dfd4', '#f8f6ee'];
  // 紙（虚ろの使い）: paper ramp, ink-grey outline, torn notches on the right and top, faint writing lines
  F.paper = (p, seed) => {
    const w = p.w, h = p.h, ring = ringOf(p), nl = lumRange(p, ring), r = rng(seed ^ 0x9e3779b9);
    for (let i = 0; i < p.d.length; i++) {
      const c = p.d[i];
      if (c == null) continue;
      if (ring[i]) { p.d[i] = '#5a5a68'; continue; }
      const l = lum(c);
      p.d[i] = l < 0.1 ? '#5a5a68' : lumTo(PAPER, 0.08 + nl(l) * 0.92, 0.8);
    }
    // torn notches: small triangles bitten out of the right and top edges
    const bb = bboxOf(p);
    const n = 3 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const onTop = k % 2 === 0;
      const size = 2 + Math.floor(r() * 3);
      if (onTop) {
        const x = Math.round(bb.x0 + (bb.x1 - bb.x0) * (0.2 + r() * 0.7));
        let y = -1;
        for (let yy = 0; yy < h; yy++) if (p.d[yy * w + x] != null) { y = yy; break; }
        if (y < 0) continue;
        for (let j = 0; j < size; j++) for (let i = -(size - 1 - j); i <= size - 1 - j; i++) p.set(x + i, y + j, null);
      } else {
        const y = Math.round(bb.y0 + (bb.y1 - bb.y0) * (0.15 + r() * 0.6));
        let x = -1;
        for (let xx = w - 1; xx >= 0; xx--) if (p.d[y * w + xx] != null) { x = xx; break; }
        if (x < 0) continue;
        for (let j = 0; j < size; j++) for (let i = -(size - 1 - j); i <= size - 1 - j; i++) p.set(x - j, y + i, null);
      }
    }
    reOutline(p, '#5a5a68');
    // faint writing: 2–3 dotted lines across the body
    const lines = 2 + Math.floor(r() * 2);
    const inner = (x, y) => { const c = p.get(x, y); return c != null && c !== '#5a5a68' && p.get(x - 1, y) != null && p.get(x + 1, y) != null && p.get(x, y - 1) != null && p.get(x, y + 1) != null; };
    for (let k = 0; k < lines; k++) {
      const y = Math.round(bb.y0 + (bb.y1 - bb.y0) * (0.35 + k * 0.17 + r() * 0.06));
      const off = Math.floor(r() * 2);
      for (let x = bb.x0; x <= bb.x1; x++) if ((x + off) % 2 === 0 && (x * 7 + k * 5) % 11 !== 0 && inner(x, y)) p.set(x, y, '#a0a0b0');
    }
  };
  /** outline every transparent pixel next to a non-dark opaque pixel (after notches were cut) */
  function reOutline(p, c) {
    const w = p.w, h = p.h, src = p.d.slice();
    const need = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] != null && src[y * w + x] !== c;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] != null) continue;
      if (need(x - 1, y) || need(x + 1, y) || need(x, y - 1) || need(x, y + 1)) p.d[y * w + x] = c;
    }
    // drop outline pixels that no longer touch anything but outline (orphans left by the notches)
    const s2 = p.d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (s2[y * w + x] !== c) continue;
      let body = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < w && Y < h && s2[Y * w + X] != null && s2[Y * w + X] !== c) { body = true; break; }
      }
      if (!body) p.d[y * w + x] = null;
    }
  }
  // 8 tones (A15a.2): a wider ramp keeps faces, crowns and folds readable (the old 5-tone ramp
  // flattened b_valzard_echo's face into the robe)
  const SHADE = ['#3a4682', '#52609c', '#6a7cb6', '#8698cc', '#a4b6e2', '#c2d0f0', '#dce6fa', '#f4f8ff'];
  // 影（霧の分身・魔王の残影）: white-blue ramp, checker-dithered see-through inside, light outline
  F.shade = (p) => {
    const w = p.w, h = p.h, ring = ringOf(p), nl = lumRange(p, ring);
    const src = p.d.slice();
    const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] != null;
    const L = (x, y) => (on(x, y) ? lum(src[y * w + x]) : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = src[i];
      if (c == null) continue;
      if (ring[i]) { p.d[i] = '#a0b0e0'; continue; }
      const l = lum(c);
      const col = l < 0.1 ? SHADE[0] : lumTo(SHADE, 0.08 + nl(l) * 0.92, 0.9);
      // interior (2+ px from the edge) is half see-through; bright highlights and the pixels
      // that draw a feature (eyes, crown points, folds: a clear step to a neighbour) stay solid
      const deep = on(x - 2, y) && on(x + 2, y) && on(x, y - 2) && on(x, y + 2);
      let edge = false;
      if (deep && (x + y) % 2 === 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = L(x + dx, y + dy); if (n != null && Math.abs(n - l) > 0.16) { edge = true; break; } }
      p.d[i] = deep && !edge && (x + y) % 2 === 1 && l < 0.8 ? null : col;
    }
  };
  const STEEL = ['#303848', '#6a7890', '#b0c0d8', '#f0f8ff'];
  function chromeBase(p, seed) {
    const w = p.w, h = p.h, ring = ringOf(p), nl = lumRange(p, ring);
    // gamma chosen from the base's mean brightness, so a dark base (beetle) still reads as polished
    // steel and a light one (jelly) keeps its dark lower half: the mean lands near STEEL's middle
    let sum = 0, cnt = 0;
    for (let i = 0; i < p.d.length; i++) { const c = p.d[i]; if (c == null || ring[i] || lum(c) < 0.1) continue; sum += nl(lum(c)); cnt++; }
    const mean = cnt ? clamp(sum / cnt, 0.05, 0.95) : 0.5;
    const g = clamp(Math.log(0.56) / Math.log(mean), 0.45, 1.45);
    for (let i = 0; i < p.d.length; i++) {
      const c = p.d[i];
      if (c == null || ring[i]) continue;
      const l = lum(c);
      if (l < 0.1) { p.d[i] = l < 0.06 ? '#1c2230' : STEEL[0]; continue; }
      p.d[i] = lumTo(STEEL, nl(l), g);
    }
    // one diagonal white band (2 px), top-right to lower-left across the upper body
    const bb = bboxOf(p);
    const r = rng(seed ^ 0x51ed27);
    const off = Math.round((bb.x1 - bb.x0) * (0.2 + r() * 0.2));
    for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) {
      const i = y * w + x;
      if (p.d[i] == null || ring[i] || lum(p.d[i]) < 0.12) continue;
      const u = (x - bb.x0) + (y - bb.y0) - off;
      if (u === 0 || u === 1) p.d[i] = u === 0 ? '#f0f8ff' : '#ffffff';
    }
    return { ring, bb };
  }
  // 鋼（白銀ゼリー）
  F.chrome = (p, seed) => { chromeBase(p, seed); };
  // 鏡（鏡カブト）: chrome + a rainbow band (hue once around every 3 px) + two cross glints
  F.mirror = (p, seed) => {
    const { ring, bb } = chromeBase(p, seed);
    const w = p.w, r = rng(seed ^ 0x2545f491);
    const y0 = Math.round(bb.y0 + (bb.y1 - bb.y0) * (0.45 + r() * 0.15));
    for (let y = y0; y < y0 + 3; y++) for (let x = bb.x0; x <= bb.x1; x++) {
      const i = y * w + x, c = p.d[i];
      if (c == null || ring[i] || lum(c) < 0.12) continue;
      const hue = (((x - bb.x0) / 3) * 120 + (y - y0) * 40) % 360;
      p.d[i] = fromHsv(hue, 0.45, clamp(hsv(c)[2] * 1.05 + 0.1, 0, 1));
    }
    for (let k = 0; k < 2; k++) {
      let tries = 0;
      while (tries++ < 40) {
        const x = Math.round(bb.x0 + 2 + r() * (bb.x1 - bb.x0 - 4)), y = Math.round(bb.y0 + 2 + r() * (bb.y1 - bb.y0) * 0.6);
        if (p.get(x, y) == null || ring[y * w + x]) continue;
        glint(p, x, y, '#ffffff', '#d8e8ff', 2);
        break;
      }
    }
  };
  /** 4-point cross glint of arm length n (only over existing pixels unless free) */
  function glint(p, x, y, c, c2, n, free) {
    p.set(x, y, c);
    for (let k = 1; k <= n; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx * k, Y = y + dy * k;
      if (free || p.get(X, Y) != null) p.set(X, Y, k === n ? c2 : c);
    }
  }
  const PLAT = ['#6a6048', '#c0b890', '#f0ecd8', '#ffffff'];
  // 白金（白金の鬼火）: platinum ramp + 3–4 light points
  F.platinum = (p, seed) => {
    const ring = ringOf(p), nl = lumRange(p, ring), w = p.w, r = rng(seed ^ 0x7f4a7c15);
    for (let i = 0; i < p.d.length; i++) {
      const c = p.d[i];
      if (c == null || ring[i]) continue;
      const l = lum(c);
      p.d[i] = l < 0.1 ? '#3a3428' : lumTo(PLAT, nl(l), 1.25);
    }
    const bb = bboxOf(p);
    const n = 3 + Math.floor(r() * 2);
    for (let k = 0, tries = 0; k < n && tries < 80; tries++) {
      const x = Math.round(bb.x0 + 1 + r() * (bb.x1 - bb.x0 - 2)), y = Math.round(bb.y0 + 1 + r() * (bb.y1 - bb.y0 - 2));
      if (p.get(x, y) == null || ring[y * w + x]) continue;
      glint(p, x, y, '#ffffff', '#fff4c8', k % 2 ? 1 : 2);
      k++;
    }
  };
  // 虹（虹ゼリー）: keep brightness, turn the hue 300° from top to bottom (saturation 0.8). Part pixels keep
  // their exact colours (§9.4.3 step 2), so a crown stays gold on a rainbow body.
  F.prism = (p, seed, info) => {
    const ring = ringOf(p), w = p.w;
    const pm = info && info.partMask;
    let y0 = p.h, y1 = -1;
    for (let i = 0; i < p.d.length; i++) if (p.d[i] != null && !(pm && pm[i])) { const y = (i / w) | 0; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let i = 0; i < p.d.length; i++) {
      const c = p.d[i];
      if (c == null || ring[i] || (pm && pm[i])) continue;
      const [hh, s, v] = hsv(c);
      if (v < 0.12 || s < 0.1) continue;
      const t = (((i / w) | 0) - y0) / Math.max(1, y1 - y0);
      p.d[i] = fromHsv(hh + 300 * t, 0.8, v);
    }
  };

  // ---------------------------------------------------------------- layers & registry
  A.PARTS = A.PARTS || {};
  /** back layer parts are drawn behind the base (§9.4.4 「層: 後」); everything else in front */
  A.PART_LAYER = Object.assign(A.PART_LAYER || {}, {
    halo: 'back', wings_bat: 'back', wings_feather: 'back', wings_insect: 'back', cape: 'back', aura: 'back', smoke: 'back', storm: 'back',
  });
  /** which anchor a part is handed (§9.4.4 アンカー列); silhouette parts get the body anchor */
  A.PART_ANCHOR = Object.assign(A.PART_ANCHOR || {}, {
    horns: 'brow', crown: 'head', tiara: 'head', helm: 'head', hood: 'head', hat: 'head', halo: 'head', bandana: 'head', flower: 'head',
    beard: 'mouth', eyepatch: 'eyes0', monocle: 'eyes1', goggles: 'eyes', eyes_glow: 'eyes', eye3: 'brow', mask: 'eyes',
    wings_bat: 'back', wings_feather: 'back', wings_insect: 'back', cape: 'back', shell_tower: 'back',
    spikes: 'body', thorns: 'body', armor_plates: 'body', chain: 'body', runes: 'body', coral: 'body', crystals: 'body', moss: 'body',
    frost: 'body', embers: 'body', spots: 'body', drips: 'body', bubbles: 'body', sparks: 'body', aura: 'body', smoke: 'body',
    mist: 'feet', storm: 'body', flame: 'head',
    sword: 'hand', spear: 'hand', axe: 'hand', staff: 'hand', bow: 'hand', club_iron: 'hand', pick: 'hand', bomb: 'hand', cannon: 'hand',
    baton: 'hand', quill: 'hand', parasol: 'hand', shield: 'hand2', book: 'hand2', violin: 'hand', drum: 'body', flute: 'hand',
    bell: 'neck', ribbon: 'head', skull_mark: 'body', stinger: 'tail', rattle: 'tail', teeth_iron: 'mouth', tusks: 'mouth', claws: 'hand', pins: 'body',
  });
  /** depth group of front parts: 0 body surface and growths, 1 head / face / neck wear, 2 held items */
  A.PART_Z = Object.assign(A.PART_Z || {}, {
    armor_plates: 0, spots: 0, runes: 0, chain: 0, skull_mark: 0, embers: 0, frost: 0, moss: 0, coral: 0, crystals: 0,
    spikes: 0, thorns: 0, drips: 0, pins: 0, cape: 0, shell_tower: 0, mist: 3, flame: 0.5,
    eye3: 0.8, // a brow eye sits under headwear (demon_3: the crown band over its upper lid)
    sword: 2, spear: 2, axe: 2, staff: 2, bow: 2, club_iron: 2, pick: 2, bomb: 2, cannon: 2, baton: 2, quill: 2, parasol: 2,
    shield: 2, book: 2, violin: 2, drum: 2, flute: 2, claws: 2,
  });
  function anchorFor(pid, anc, o) {
    if (anc.at && anc.at[pid] && !(o && o.at)) return anc.at[pid];
    const k = (o && o.at) || A.PART_ANCHOR[pid] || 'body';
    if (k === 'eyes') return anc.eyes;
    if (k === 'eyes0') return anc.eyes[0];
    if (k === 'eyes1') return anc.eyes[1] || anc.eyes[0];
    return anc[k] || anc.body;
  }

  // ---------------------------------------------------------------- compose
  const PENDING_SEEN = {};
  /** colour tests for anchor erasures (on the base's own colours) */
  const ERASE_TEST = {
    all: () => true,
    wood: (c) => { const [h, s, v] = hsv(c); return h >= 8 && h <= 55 && s > 0.2 && v > 0.12; },
    metal: (c) => { const [, s] = hsv(c); return s < 0.3 && lum(c) > 0.13; },
    gold: (c) => { const [h, s] = hsv(c); return h >= 28 && h <= 66 && s > 0.35; },
    red: (c) => { const [h, s] = hsv(c); return (h < 42 || h > 330) && s > 0.35 && lum(c) > 0.1; },
    nongreen: (c) => { const [h, s] = hsv(c); return !(h >= 55 && h <= 175 && s > 0.18); },
  };
  /**
   * @param {string} base   base sprite id ('mon:<base>' must be registered)
   * @param {object} hsb    {hue (deg), sat (×), bri (×)} for R.Gfx.variant
   * @param {Array}  parts  [[partId, opts], …] in drawing order (opts: c c2 gem size style len …)
   * @param {string} [filter] one of R.Art.FILTERS
   * @param {string} [id]   spriteId (seed); optional
   */
  function compose(base, hsb, parts, filter, id) {
    const key = 'mon:' + base;
    if (!G().has(key)) {
      if (!PENDING_SEEN[key]) { PENDING_SEEN[key] = 1; R.warn('compose: base not registered yet', key); }
      return G().get(key);
    }
    const h = hsb || {};
    const vo = {};
    if (h.hue) vo.hue = h.hue;
    if (h.sat != null) vo.sat = h.sat;
    if (h.bri != null) vo.bri = h.bri;
    let cv = G().variant(key, vo);
    if (Array.isArray(cv)) cv = cv[0];
    const P = pixOf(cv);
    const info = analyze(P);
    const W = P.w, H = P.h;
    const anc = resolveAnchors(base, info);
    const list = parts || [];
    const seed = hashStr(id || [base, JSON.stringify(h), JSON.stringify(list), filter || ''].join('|'));
    const missing = [];
    const back = [], front = [];
    const erased = new Uint8Array(W * H);
    let orig = null; // the base in its own colours (erase tests look at those, not the lineage recolour)
    const eraseRects = (rects) => {
      if (!orig) { let o0 = G().get(key); if (Array.isArray(o0)) o0 = o0[0]; orig = pixOf(o0); }
      const hit = [];
      for (const r of rects) {
        const test = ERASE_TEST[r[4] || 'all'] || ERASE_TEST.all;
        for (let y = Math.max(0, r[1]); y <= Math.min(H - 1, r[3]); y++) for (let x = Math.max(0, r[0]); x <= Math.min(W - 1, r[2]); x++) {
          const c0 = orig.d[y * W + x];
          if (c0 != null && test(c0)) { erased[y * W + x] = 1; hit.push(r); }
        }
      }
      // dark outline pixels of the removed object that now touch nothing but air: remove them too
      for (let pass = 0; pass < 2; pass++) for (const r of rects) {
        for (let y = Math.max(0, r[1] - 1); y <= Math.min(H - 1, r[3] + 1); y++) for (let x = Math.max(0, r[0] - 1); x <= Math.min(W - 1, r[2] + 1); x++) {
          const i = y * W + x, c0 = P.d[i];
          if (c0 == null || erased[i] || lum(c0) >= 0.12) continue;
          let keep = false;
          for (let dy = -1; dy <= 1 && !keep; dy++) for (let dx = -1; dx <= 1; dx++) {
            const X = x + dx, Y = y + dy;
            if ((dx || dy) && X >= 0 && Y >= 0 && X < W && Y < H && !erased[Y * W + X] && P.d[Y * W + X] != null && lum(P.d[Y * W + X]) >= 0.12) { keep = true; break; }
          }
          if (!keep) erased[i] = 1;
        }
      }
    };
    // union of everything solid drawn so far (base + earlier part layers, dilated by the outline to come)
    const drawn = new Uint8Array(W * H);
    const solidO = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      if (info.solid[y * W + x] && !erased[y * W + x]) return true;
      return drawn[y * W + x] >= 1;
    };
    list.forEach((entry, idx) => {
      const pid = entry[0], o = entry[1] || {};
      const fn = A.PARTS[pid];
      if (!fn) { missing.push(pid); R.warn('compose: unknown part', pid); return; }
      const pix = G().pix(W, H), fx = G().pix(W, H);
      const opts = Object.assign({}, o, {
        size: o.size || info.size, k: SIZE_K[o.size || info.size], baseK: info.k, fx, base: P, info, anchors: anc, baseId: base,
        seed: (seed + idx * 7919) >>> 0, rng: rng((seed + idx * 7919) >>> 0), solid: solidO,
        /** clear base pixels (weapon swaps): rects [[x0,y0,x1,y1,test?], …] */
        erase: (rects) => eraseRects(rects),
        /** clear what the anchor table lists for that anchor (anc.erase[key]) */
        eraseAt: (k) => { if (anc.erase && anc.erase[k]) eraseRects(anc.erase[k]); },
      });
      const extras = [];
      /** a second layer for the same part (e.g. a cape's collar in front of the shoulders) */
      opts.extra = (layer) => { const q = G().pix(W, H), qf = G().pix(W, H); q.fx = qf; extras.push({ pid, pix: q, fx: qf, layer }); return q; };
      fn(pix, anchorFor(pid, anc, o), opts);
      const L = { pid, pix, fx, layer: opts.layer || A.PART_LAYER[pid] || 'front' };
      for (const E of [L].concat(extras)) {
        (E.layer === 'back' ? back : front).push(E);
        for (let i = 0; i < W * H; i++) if (E.pix.d[i] != null) {
          drawn[i] = 1;
          const x = i % W, y = (i / W) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && drawn[Y * W + X] !== 1) drawn[Y * W + X] = 2; }
        }
      }
    });
    // apply erasures to the base, remember base pixels that lost a neighbour (they need an outline now)
    const dirty = new Uint8Array(W * H), partMask = new Uint8Array(W * H), exposed = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (erased[i]) P.d[i] = null;
    for (let i = 0; i < W * H; i++) {
      if (!erased[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && P.d[Y * W + X] != null && lum(P.d[Y * W + X]) >= 0.1) exposed[Y * W + X] = 1;
      }
    }
    // front layers in a fixed depth order (stable within a group): what is painted on the body, then what
    // is worn on the head and face, then what is held in the hands
    const zOf = (pid) => (A.PART_Z[pid] == null ? 1 : A.PART_Z[pid]);
    front.sort((l1, l2) => zOf(l1.pid) - zOf(l2.pid));
    const R0 = G().pix(W, H);
    for (const L of back) R0.blit(L.fx, 0, 0);
    for (const L of back) { put(R0, L.pix, 'dark'); for (let i = 0; i < W * H; i++) if (L.pix.d[i] != null) { dirty[i] = 1; partMask[i] = 1; } }
    // the base goes over the back layers: its own pixels only need an outline where an erasure exposed them
    for (let i = 0; i < W * H; i++) if (P.d[i] != null) { R0.d[i] = P.d[i]; dirty[i] = exposed[i]; partMask[i] = 0; }
    // glow and vapour of back parts that stay visible around the base count as part pixels too
    for (let i = 0; i < W * H; i++) if (P.d[i] == null && R0.d[i] != null) partMask[i] = 1;
    for (const L of front) { put(R0, L.pix, 'dark'); for (let i = 0; i < W * H; i++) if (L.pix.d[i] != null) { dirty[i] = 1; partMask[i] = 1; } }
    // outline every transparent pixel next to a pixel the parts added or exposed (§9.4.3 step 4) —
    // but not the see-through holes of a dither (insect / fairy / bee wings, veils): a transparent
    // pixel with 3–4 opaque neighbours (counting the front layers' glow/dither pixels still to come)
    // is a hole inside a surface, not the silhouette's edge, and stays open (A14b.1)
    const src = R0.d.slice();
    const cover = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (src[i] != null) cover[i] = 1;
    for (const L of front) for (let i = 0; i < W * H; i++) if (L.fx.d[i] != null) cover[i] = 1;
    const hole = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cover[i]) continue;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && cover[Y * W + X]) n++; }
      if (n >= 3) hole[i] = 1;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (src[i] != null || hole[i]) continue;
      let need = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && dirty[Y * W + X] && src[Y * W + X] != null && lum(src[Y * W + X]) >= 0.1) { need = true; break; }
      }
      if (need) { R0.d[i] = OUT; partMask[i] = 1; }
    }
    // self-check: a solid pixel a part added must never border transparency without its outline
    let openEdge = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!dirty[i] || R0.d[i] == null || lum(R0.d[i]) < 0.1) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W && Y < H && R0.d[Y * W + X] == null && !hole[Y * W + X]) { openEdge++; break; }
      }
    }
    for (const L of front) for (let i = 0; i < W * H; i++) if (L.fx.d[i] != null) { R0.d[i] = L.fx.d[i]; partMask[i] = 1; }
    let partPx = 0;
    for (let i = 0; i < W * H; i++) if (partMask[i]) partPx++;
    if (filter) {
      const f = F[filter];
      if (f) f(R0, seed, { partMask, anchors: anc, base, size: info.size });
      else { missing.push('filter:' + filter); R.warn('compose: unknown filter', filter); }
    }
    const outCv = R0.toCanvas();
    outCv._compose = { partPx, missing, base, filter: filter || null, openEdge, anchorsAuto: !!anc.auto };
    return outCv;
  }
  A.compose = compose;

  A.PartTK = {
    OUT, INK, WHITE, clamp, rgb, hex, hsv, fromHsv, lum, mix, dk, towards, ramp, metal, hashStr, rng,
    mask, capsule, tube, bez, line, shade, part, cyl, put, stamp, paint, bboxOf, contour, glint, SIZE_K,
  };
})(window.RPG);
