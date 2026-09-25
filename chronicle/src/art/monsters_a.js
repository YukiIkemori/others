// Monster battle sprites, part A (DESIGN §4): 'mon:<id>' front-facing portraits
// in SFC style. Each sprite is assembled from shaded parts: a silhouette mask is
// pillow-shaded from its distance field (top-left light, hue-shifted ramps),
// parts are layered back to front with dark inner contours, hand-placed details
// (eyes, teeth, highlights) go on top, and a 1-px dark outline closes it.
// Factories run lazily through R.Gfx.get and are cached.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#120c16'; // outer outline (near-neutral so palette variants keep it)
  const INK = '#1c1420'; // inner contour / pupils
  const WHITE = '#f8f8f4';

  // ------------------------------------------------------------ colours
  function toRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function toHsv(hex) {
    const [r, g, b] = toRgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function fromHsv(h, s, v) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function towards(h, target, amt) {
    const d = ((target - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amt);
  }
  /**
   * Hue-shifted ramp dark → light around a mid-tone base: shadows drift toward
   * violet and gain saturation, highlights drift toward yellow and desaturate.
   * o: {dark (0..1 how dark the darkest step gets), light, shift (deg)}
   */
  function ramp(base, n, o) {
    n = n || 5; o = o || {};
    const [h, s, v] = toHsv(base);
    const k = Math.floor((n - 1) * (o.mid == null ? 0.5 : o.mid));
    const dark = o.dark == null ? 0.66 : o.dark, light = o.light == null ? 0.7 : o.light;
    const shift = o.shift == null ? 22 : o.shift;
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i < k) {
        const t = (k - i) / k;
        out.push(fromHsv(towards(h, 262, shift * t), s + (1 - s) * 0.22 * t, v * (1 - dark * t)));
      } else if (i > k) {
        const t = (i - k) / (n - 1 - k);
        out.push(fromHsv(towards(h, 58, shift * 0.7 * t), s * (1 - 0.5 * light * t), v + (1 - v) * light * t));
      } else out.push(base);
    }
    return out;
  }
  function darken(hex, k) { const [r, g, b] = toRgb(hex); return toHex(r * k, g * k, b * k); }

  // ------------------------------------------------------------ masks
  /** a mask is a Pix whose opaque cells are 1 */
  const mask = (w, h) => G().pix(w, h);
  /** tapered capsule from (x0,y0,r0) to (x1,y1,r1) */
  function capsule(p, x0, y0, x1, y1, r0, r1, c) {
    if (r1 == null) r1 = r0;
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
  /** quadratic-bezier tube (tails, tentacles, horns): radius r0 → r1 */
  function tube(p, pts, r0, r1, c, steps) {
    const [a, b, d] = pts;
    const n = steps || 16;
    let px = a[0], py = a[1];
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * b[0] + t * t * d[0];
      const y = u * u * a[1] + 2 * u * t * b[1] + t * t * d[1];
      capsule(p, px, py, x, y, r0 + (r1 - r0) * (i - 1) / n, r0 + (r1 - r0) * i / n, c);
      px = x; py = y;
    }
    return p;
  }

  /** tube along an elliptical arc (angles in radians, 0 = right, PI/2 = front/bottom) */
  function arc(p, cx, cy, rx, ry, a0, a1, r0, r1, c) {
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) / 2));
    for (let i = 0; i < n; i++) {
      const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
      capsule(p, cx + Math.cos(t0) * rx, cy + Math.sin(t0) * ry, cx + Math.cos(t1) * rx, cy + Math.sin(t1) * ry,
        r0 + (r1 - r0) * i / n, r0 + (r1 - r0) * (i + 1) / n, c);
    }
    return p;
  }

  // distance-field shading -----------------------------------------------
  const OFFS = (() => {
    const a = [];
    for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= 16.5) a.push([dx, dy, d]);
    }
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
  /** box-blur a height field inside its mask (smoother normals, cleaner bands) */
  function smooth(m, H, passes) {
    const w = m.w, h = m.h;
    for (let k = 0; k < passes; k++) {
      const S = H.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (m.d[i] == null) continue;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          sum += X < 0 || Y < 0 || X >= w || Y >= h ? 0 : S[Y * w + X];
        }
        H[i] = (sum / 9 + S[i]) / 2;
      }
    }
    return H;
  }
  /** rounded-bevel height field from the distance to the silhouette edge */
  function bevel(m, depth) {
    const D = distField(m, depth + 1), H = new Float32Array(m.w * m.h);
    for (let i = 0; i < H.length; i++) {
      if (m.d[i] == null) continue;
      const t = Math.min(1, D[i] / depth);
      H[i] = depth * Math.sqrt(1 - (1 - t) * (1 - t));
    }
    return H;
  }
  /**
   * Light a height field with a ramp. o: {light:[x,y,z], amb, bias, global
   * (whole-shape top-left gradient), normal(x,y) proxy form + blend (0..1 share
   * of the silhouette's own normals), trans (light through a translucent body),
   * rim (reflected-light steps on the shadow edge)}
   */
  function light(m, H, rmp, o) {
    o = o || {};
    const w = m.w, h = m.h, n = rmp.length;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m.d[y * w + x] == null) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = Math.max(1, (x1 - x0) / 2), hh = Math.max(1, (y1 - y0) / 2);
    let L = o.light || [-0.55, -0.75, 0.6];
    const ll = Math.hypot(L[0], L[1], L[2]); L = [L[0] / ll, L[1] / ll, L[2] / ll];
    const amb = o.amb == null ? 0.1 : o.amb, glob = o.global == null ? 0.25 : o.global;
    const out = G().pix(w, h);
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && m.d[y * w + x] != null;
    const hAt = (x, y) => (inside(x, y) ? H[y * w + x] : 0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      if (m.d[i] == null) continue;
      const gx = (hAt(x + 1, y) - hAt(x - 1, y)) / 2, gy = (hAt(x, y + 1) - hAt(x, y - 1)) / 2;
      const nl = Math.hypot(gx, gy, 1);
      let nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
      if (o.normal) {
        // proxy form (e.g. one big sphere) for clean bands on an irregular silhouette
        const q = o.normal(x, y), t = o.blend == null ? 0.25 : o.blend;
        nx = q[0] * (1 - t) + nx * t; ny = q[1] * (1 - t) + ny * t; nz = q[2] * (1 - t) + nz * t;
        const l2 = Math.hypot(nx, ny, nz); nx /= l2; ny /= l2; nz /= l2;
      }
      const dot = nx * L[0] + ny * L[1] + nz * L[2];
      let v = amb + (1 - amb) * Math.max(0, dot);
      if (o.trans) v += o.trans * Math.max(0, -dot) * (1 - Math.max(0, ny) * 0.3); // light through a translucent body
      v += glob * (((x - cx) / hw) * L[0] + ((y - cy) / hh) * L[1]) * 0.5;
      v += o.bias || 0;
      let k = Math.max(0, Math.min(n - 1, Math.floor(Math.max(0, Math.min(0.999, v)) * n)));
      if (o.rim && (!inside(x + 1, y) || !inside(x, y + 1)) && ny + nx * 0.5 > 0.1 && dot < 0.5) k = Math.min(n - 1, k + o.rim);
      out.d[i] = rmp[k];
    }
    return out;
  }
  /** normal function of an ellipsoid proxy (outside it the normal lies flat) */
  function sphereN(cx, cy, rx, ry) {
    return (x, y) => {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 >= 0.98) { const d = Math.sqrt(d2); return [dx / d * 0.99, dy / d * 0.99, 0.14]; }
      return [dx, dy, Math.sqrt(1 - d2)];
    };
  }
  /** shade a mask: bevel height from the silhouette (o.depth px), smoothed, then lit */
  function shade(m, rmp, o) {
    o = o || {};
    const H = bevel(m, o.depth || 6);
    smooth(m, H, 1);
    return light(m, H, rmp, o);
  }
  /** build + shade in one go: fn(mask) draws the silhouette with colour 1 */
  function part(w, h, fn, rmp, o) { const m = mask(w, h); fn(m); return shade(m, rmp, o); }
  /**
   * Layer src over dst. line: colour (or 'dark') for a contour where src's edge
   * crosses pixels already in dst (inner outline between parts).
   */
  function put(dst, src, line) {
    if (line) {
      const at = (x, y) => (x >= 0 && y >= 0 && x < src.w && y < src.h ? src.d[y * src.w + x] : null);
      for (let y = -1; y <= src.h; y++) for (let x = -1; x <= src.w; x++) {
        if (at(x, y) != null) continue;
        if (at(x - 1, y) == null && at(x + 1, y) == null && at(x, y - 1) == null && at(x, y + 1) == null) continue;
        const dc = dst.get(x, y);
        if (dc == null) continue;
        dst.set(x, y, line === 'dark' ? darken(dc, 0.45) : line);
      }
    }
    return dst.blit(src, 0, 0);
  }
  /** keep only pixels of p that are inside mask m (clip) */
  function clip(p, m) { p.each((x, y) => (m.get(x, y) == null ? null : undefined)); return p; }
  /** shift ramp steps of pixels already painted with rmp by fn(x,y) (+ lighter) */
  function bump(p, rmp, fn) {
    const idx = {};
    rmp.forEach((c, i) => { idx[c] = i; });
    p.each((x, y, c) => {
      if (!(c in idx)) return undefined;
      const d = fn(x, y);
      return d ? rmp[Math.max(0, Math.min(rmp.length - 1, idx[c] + d))] : undefined;
    });
    return p;
  }
  /** stamp a small grid with a palette */
  function stamp(p, x, y, rows, pal) { p.grid(x, y, rows, pal); return p; }
  /**
   * Close the sprite: fit it inside a 1-px margin (so the outline is never cut
   * off), stand it on the bottom row unless o.float, optionally centre it
   * (o.center), add the outline, then o.post(p) draws fine un-outlined details.
   */
  function finish(p, o) {
    o = o || {};
    let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
    p.each((x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
    let dx = 0, dy = 0;
    if (o.center) dx = Math.round((p.w - 1 - x1 - x0) / 2);
    if (x0 + dx < 1 && x1 + 1 - x0 <= p.w - 2) dx = 1 - x0;
    if (x1 + dx > p.w - 2 && x0 - (x1 - (p.w - 2)) >= 1) dx = p.w - 2 - x1;
    if (y1 > p.h - 2 || !o.float) dy = p.h - 2 - y1;
    if (y0 + dy < 1) dy = Math.max(dy, 1 - y0);
    if (dx || dy) {
      const q = G().pix(p.w, p.h);
      q.blit(p, dx, dy);
      p.d = q.d;
    }
    p.outline(OUT);
    if (o.post) {
      const q = G().pix(p.w, p.h);
      o.post(q);
      q.each((x, y, c) => { const e = p.get(x + dx, y + dy); if (e == null || e === OUT) p.set(x + dx, y + dy, c); });
    }
    return p.toCanvas();
  }

  // ------------------------------------------------------------ sprites
  const S = {};

  // Jelly: an amorphous gelatinous mound sagging onto its own spread, a glowing
  // core inside, glossy floating eyes, bubbles and drips sliding down its sides.
  S.jelly = () => {
    const W = 32, H = 32;
    const body = ramp('#34c090', 6, { dark: 0.7, light: 0.8 });
    const m = mask(W, H);
    m.ellipse(16, 19.2, 11.5, 9.3, 1);
    capsule(m, 16, 22, 16, 26.5, 8.5, 7, 1);
    m.ellipse(16, 27.2, 14.5, 3.4, 1);
    m.rect(0, 31, W, 1, null);
    // drips sliding off the dome over the base
    capsule(m, 6.5, 20, 4.5, 25.2, 1.4, 2, 1);
    capsule(m, 25.5, 21, 27.2, 25.5, 1.2, 1.8, 1);
    const p = shade(m, body, { depth: 4, normal: sphereN(15.5, 21, 15, 15), blend: 0.3, light: [-0.6, -0.8, 0.5], trans: 0.5, rim: 1, amb: 0.12, global: 0.1 });
    // light scattered through the gel around the core
    bump(p, body, (x, y) => { const d = Math.hypot(x - 17, (y - 21) * 1.15); return d < 4.8 ? 2 : d < 7.2 ? 1 : 0; });
    // drips: a lit left edge and a shaded right edge so they read over the body
    for (const [x0, y0, x1, y1] of [[6, 19, 4, 26], [26, 20, 27, 26]]) { p.line(x0, y0, x1, y1, body[4]); p.line(x0 + 1, y0 + 1, x1 + 1, y1 - 1, body[1]); }
    for (const [x, y0, y1] of [[10, 25, 28], [21, 26, 28]]) {
      p.vline(x, y0, y1, body[4]); p.vline(x + 1, y0, y1, body[2]); p.set(x, y1 + 1, body[1]); p.set(x + 1, y1 + 1, body[1]);
    }
    const core = part(W, H, (g) => g.ellipse(17, 21, 3.2, 2.8, 1), ['#e88a18', '#ffc038', '#ffe680', '#fffbe8'], { depth: 3, light: [-0.3, -0.4, 0.9], global: 0.3 });
    put(p, core);
    p.set(16, 19, '#ffffff'); p.set(15, 20, '#ffffff');
    // bubbles
    for (const [bx, by] of [[7, 20], [24, 17], [22, 24], [10, 23]]) { p.set(bx, by, body[5]); p.set(bx + 1, by + 1, body[3]); }
    // eyes: glossy ovals, the right one a little larger
    stamp(p, 9, 12, ['.kk.', 'kwkk', 'kkkk', 'kkkk', '.kk.'], { k: INK, w: WHITE });
    stamp(p, 17, 11, ['.kk.', 'kwkk', 'kwkk', 'kkkk', 'kkkk', '.kk.'], { k: INK, w: WHITE });
    // specular gloss on the dome
    stamp(p, 6, 13, ['..w', '.w.', 'w..'], { w: WHITE });
    p.set(10, 10, WHITE); p.set(11, 10, WHITE);
    return finish(p);
  };

  /** mirror a mask's left half onto its right half */
  const sym = (m) => m.mirrorX();
  /** run fn(x) for a point and its mirror image across a W-wide sprite */
  const both = (W, fn) => { fn((x) => x, 1); fn((x) => W - 1 - x, -1); };

  // Bat: a fox-eared night flier with scalloped wings, glaring red eyes and fangs.
  S.bat = () => {
    const W = 32, H = 32;
    const fur = ramp('#8a6c96', 5), wing = ramp('#6a2c7c', 5, { dark: 0.6 }), pink = ramp('#e07a98', 4);
    // wings: three membrane panels per side between the finger bones
    const S0 = [13, 12], Wr = [5, 3.5], T = [[1.2, 7.5], [1.2, 16], [4, 23]], C = [[2.8, 11.5], [4.8, 17.5], [8.5, 19.5]], B0 = [12.5, 21];
    const panels = [[Wr, T[0], C[0], T[1]], [Wr, T[1], C[1], T[2]], [Wr, T[2], C[2], B0, S0]];
    const p = G().pix(W, H);
    panels.forEach((pts, i) => {
      const pm = mask(W, H);
      pm.poly(pts, 1);
      pm.poly(pts.map(([x, y]) => [W - x, y]), 1);
      put(p, shade(pm, wing, { depth: 2.2, light: [-0.5, -0.8, 0.7], global: 0.35, amb: 0.2, bias: 0.04 * i }), wing[0]);
    });
    // arm and finger bones, a wrist claw
    both(W, (X) => {
      p.line(X(S0[0]), S0[1], X(Wr[0]), Wr[1], wing[4]); p.line(X(S0[0]), S0[1] + 1, X(Wr[0]) + (X(1) > 1 ? -1 : 1), Wr[1] + 1, wing[3]);
      for (const t of T) p.line(X(Wr[0]), Wr[1], X(t[0]), t[1], wing[3]);
      p.set(X(Wr[0]), Wr[1] - 1, '#e8e0f0'); p.set(X(Wr[0] + 1), Wr[1] - 2, '#e8e0f0');
    });
    const bm = mask(W, H);
    bm.ellipse(15.5, 18, 5.5, 6.2, 1);
    bm.ellipse(15.5, 11.5, 6, 4.8, 1);
    bm.poly([[10, 11], [8.5, 1.5], [14, 8]], 1);
    bm.ellipse(13.5, 24.5, 1, 1.2, 1);
    sym(bm);
    const body = shade(bm, fur, { depth: 4, normal: sphereN(14.5, 13, 9, 11), blend: 0.45, light: [-0.6, -0.8, 0.6], rim: 1 });
    put(p, body, 'dark');
    // inner ears
    const ear = part(W, H, (g) => { g.poly([[10.5, 9.5], [9.2, 3.5], [12.8, 7.8]], 1); sym(g); }, pink, { depth: 1.5 });
    put(p, ear);
    // fluffy chest
    put(p, part(W, H, (g) => g.ellipse(15.5, 19, 3, 3.6, 1), ramp('#c8a8c8', 4), { depth: 2, normal: sphereN(14, 17, 5, 6), blend: 0.4 }));
    for (const [x, y] of [[14, 22], [17, 22], [15, 16], [16, 20]]) p.set(x, y, fur[1]);
    // eyes: red irises under heavy brows
    both(W, (X) => {
      p.set(X(11), 9, INK); p.set(X(12), 10, INK); p.set(X(13), 10, INK); p.set(X(14), 11, INK);
      p.set(X(12), 11, '#ff5040'); p.set(X(13), 11, '#ffd0a0'); p.set(X(12), 12, '#b01818'); p.set(X(13), 12, '#e03028');
      p.set(X(11), 11, INK); p.set(X(11), 12, INK); p.set(X(14), 12, INK);
    });
    // nose leaf and fanged mouth
    p.set(15, 12, fur[0]); p.set(16, 12, fur[0]); p.set(15, 13, INK); p.set(16, 13, INK);
    p.hline(13, 18, 15, INK); p.set(12, 14, INK); p.set(19, 14, INK);
    p.set(14, 16, WHITE); p.set(17, 16, WHITE); p.set(14, 15, WHITE); p.set(17, 15, WHITE);
    // tiny hanging claws
    for (const x of [13, 14, 17, 18]) p.set(x, 26, INK);
    p.set(3, 3, null); p.set(28, 3, null);
    return finish(p, { float: true });
  };

  // Rat: a giant rat reared up on its haunches: buck teeth, beady red eyes, curling tail.
  S.rat = () => {
    const W = 32, H = 32;
    const fur = ramp('#8e6a54', 6, { dark: 0.66 }), pale = ramp('#e2cfb0', 4), pink = ramp('#e08c94', 4);
    const p = G().pix(W, H);
    put(p, part(W, H, (g) => tube(g, [[20, 28], [31.5, 29], [28.5, 16]], 1.7, 0.6, 1), pink, { depth: 1.5 }));
    // pear-shaped body with a pale belly and bristly flanks
    const bm = mask(W, H);
    bm.ellipse(15.5, 23.5, 8.6, 6.8, 1);
    bm.ellipse(15.5, 19, 6.5, 4, 1);
    for (const [x, y, a, b] of [[7.5, 22, 5.5, 20.5], [7.5, 25, 5.8, 24.5], [23.5, 22, 25.5, 20.5], [23.5, 25, 25.2, 24.5]]) capsule(bm, x, y, a, b, 1.1, 0.3, 1);
    const body = shade(bm, fur, { depth: 4, normal: sphereN(14, 20, 11, 11), blend: 0.45, rim: 1 });
    put(body, part(W, H, (g) => g.ellipse(15.5, 25, 4.8, 4.6, 1), pale, { depth: 3, normal: sphereN(14.5, 23, 7, 8), blend: 0.4 }));
    put(p, body, 'dark');
    // hind feet
    put(p, part(W, H, (g) => { g.ellipse(9.5, 29.4, 3.4, 1.6, 1); g.ellipse(21.5, 29.4, 3.4, 1.6, 1); }, fur, { depth: 1.5 }), 'dark');
    for (const x of [7, 9, 11, 20, 22, 24]) p.set(x, 30, pink[1]);
    // forepaws curled at the chest
    put(p, part(W, H, (g) => { g.ellipse(12, 21.6, 1.9, 1.5, 1); g.ellipse(19, 21.6, 1.9, 1.5, 1); }, fur, { depth: 1.5, bias: 0.12 }), 'dark');
    for (const x of [11, 12, 13, 18, 19, 20]) p.set(x, 23, x % 2 ? pink[2] : INK);
    // head: round crown narrowing to a long snout, big ears
    const hm = mask(W, H);
    hm.ellipse(15.5, 10.5, 6.8, 5.2, 1);
    hm.poly([[9.5, 11], [21.5, 11], [18, 16.5], [15.5, 18.5], [13, 16.5]], 1);
    const head = shade(hm, fur, { depth: 3.5, normal: sphereN(14, 10, 9, 9), blend: 0.45, rim: 1 });
    put(head, part(W, H, (g) => g.poly([[12.5, 13], [18.5, 13], [17.2, 16.5], [15.5, 18], [13.8, 16.5]], 1), pale, { depth: 1.5, bias: 0.05 }));
    const ears = part(W, H, (g) => { g.ellipse(8.5, 5.5, 3.7, 4, 1); g.ellipse(22.5, 5.5, 3.7, 4, 1); }, fur, { depth: 2.5, rim: 1 });
    put(ears, part(W, H, (g) => { g.ellipse(8.7, 5.9, 2.2, 2.5, 1); g.ellipse(22.3, 5.9, 2.2, 2.5, 1); }, pink, { depth: 2, light: [0.4, 0.6, 0.6] }));
    put(p, ears, 'dark');
    put(p, head, 'dark');
    // nose at the snout tip, buck teeth below
    p.set(15, 17, '#a03850'); p.set(16, 17, '#a03850'); p.set(15, 16, '#e890a0'); p.set(16, 16, '#c86078');
    p.hline(15, 16, 18, INK); p.set(14, 18, INK); p.set(17, 18, INK);
    p.set(15, 19, WHITE); p.set(16, 19, '#e0d8cc'); p.set(15, 20, '#e0d8cc'); p.set(16, 20, '#c0b8ac');
    p.vline(14, 19, 20, INK); p.vline(17, 19, 20, INK); p.hline(15, 16, 21, INK);
    // beady eyes under a hard brow
    both(W, (X) => {
      p.set(X(11), 10, '#ff6a50'); p.set(X(12), 10, '#d02020'); p.set(X(11), 11, '#b01818'); p.set(X(12), 11, '#801010');
      p.set(X(10), 10, INK); p.set(X(10), 11, INK); p.set(X(13), 11, INK); p.set(X(11), 12, INK); p.set(X(12), 12, INK);
      p.set(X(10), 9, fur[1]); p.set(X(11), 9, INK); p.set(X(12), 9, INK); p.set(X(13), 10, INK);
    });
    p.set(11, 10, WHITE); p.set(19, 10, WHITE);
    p.set(15, 6, fur[5]); p.set(16, 6, fur[4]); p.set(14, 7, fur[4]);
    // whiskers, drawn after the outline so they stay fine
    return finish(p, { post: (q) => {
      for (const [x0, y0, x1, y1] of [[12, 15, 6, 13], [12, 16, 6, 18], [19, 15, 25, 13], [19, 16, 25, 18]]) q.line(x0, y0, x1, y1, pale[3]);
    } });
  };

  // Mushroom: a stomping toadstool with a spotted cap, grumpy face and stubby limbs.
  S.mushroom = () => {
    const W = 32, H = 32;
    const cap = ramp('#d8402e', 6, { dark: 0.62 }), stem = ramp('#ecdcb6', 5, { dark: 0.5, shift: 30 }), gill = ramp('#b08c6a', 4);
    const p = part(W, H, (g) => { g.ellipse(11.5, 29.4, 3.2, 1.8, 1); g.ellipse(20.5, 29.4, 3.2, 1.8, 1); }, ramp('#9a6a4a', 4), { depth: 1.5 });
    const sm = mask(W, H);
    capsule(sm, 16, 19, 16, 25.5, 6, 7, 1);
    sm.rect(0, 30, W, 2, null);
    capsule(sm, 9.5, 20.5, 6.5, 24.5, 1.6, 1.5, 1); capsule(sm, 22.5, 20.5, 25.5, 24.5, 1.6, 1.5, 1);
    put(p, shade(sm, stem, { depth: 4, normal: sphereN(14.5, 22, 10, 11), blend: 0.4, rim: 1 }), 'dark');
    // arms read as separate from the body
    for (const [x, y] of [[9, 22], [10, 23], [22, 22], [21, 23]]) p.set(x, y, stem[1]);
    // cap underside with gills
    const um = part(W, H, (g) => g.ellipse(16, 14.2, 12.5, 2.8, 1), gill, { depth: 2, light: [0, 1, 0.3] });
    for (let x = 6; x <= 26; x += 2) for (let y = 13; y <= 17; y++) if (um.get(x, y) != null) um.set(x, y, gill[0]);
    put(p, um, 'dark');
    const cm = mask(W, H);
    cm.ellipse(15.5, 11, 14, 8.6, 1);
    cm.rect(0, 13, W, 20, null);
    cm.ellipse(15.5, 12.6, 14.4, 2.2, 1);
    const capP = shade(cm, cap, { depth: 5, normal: sphereN(14, 12, 16, 11), blend: 0.35, rim: 1, global: 0.2 });
    // cream spots, shaded with the cap's light
    const spot = ramp('#f4ecd8', 4, { dark: 0.45, shift: 40 });
    const spm = mask(W, H);
    for (const [x, y, r] of [[8.5, 7, 2.3], [16, 4.3, 2.2], [23, 7.8, 2.6], [4.5, 11.5, 1.3], [27.8, 12, 1.2], [12.8, 10.6, 1.3], [19.5, 11.5, 1]]) spm.ellipse(x, y, r, r * 0.85, 1);
    clip(spm, cm);
    const spots = shade(spm, spot, { depth: 1.5, normal: sphereN(14, 12, 16, 11), blend: 0.5, bias: 0.12 });
    put(capP, spots, cap[1]);
    put(p, capP, 'dark');
    stamp(p, 6, 4, ['.w', 'w.'], { w: WHITE });
    // grumpy face on the stem
    both(W, (X, s) => {
      p.set(X(12), 18, INK); p.set(X(13), 19, INK);
      p.rect(Math.min(X(12), X(13)), 20, 2, 2, INK); p.set(X(12), 20, WHITE);
      p.set(X(11), 22, '#f0a0a0');
    });
    p.hline(14, 17, 24, INK); p.set(13, 25, INK); p.set(18, 25, INK); p.hline(14, 17, 25, '#7a2030'); p.set(16, 25, '#e0707a');
    return finish(p);
  };

  // Bee: a giant hornet with glassy wings, compound eyes and a striped stinger.
  S.bee = () => {
    const W = 32, H = 32;
    const wingR = ['#8ab0d0', '#b0d0ea', '#d4ecfa', '#f4fcff'], yel = ramp('#f0b820', 5, { shift: 16 }), blk = ramp('#3a2a30', 3, { dark: 0.4, light: 0.35 });
    const wm = mask(W, H);
    capsule(wm, 12.5, 12, 4.4, 4.6, 1.8, 3.3, 1);
    capsule(wm, 12, 15, 4.6, 17, 1.4, 2.5, 1);
    sym(wm);
    const p = shade(wm, wingR, { depth: 2, light: [-0.4, -0.9, 0.7], global: 0.4, amb: 0.3 });
    p.each((x, y, c) => (c === wingR[0] ? c + 'e0' : c === wingR[1] ? c + 'd0' : c + 'c8'));
    both(W, (X) => { p.line(X(12), 12, X(5), 5, '#6a8ab0'); p.line(X(8), 9, X(3), 8, '#6a8ab0'); p.line(X(11), 15, X(4), 17, '#6a8ab0'); });
    // abdomen with bands and a stinger
    const am = mask(W, H);
    am.ellipse(15.5, 22.5, 6, 6.6, 1);
    sym(am);
    const ab = shade(am, yel, { depth: 4, normal: sphereN(14, 21, 8, 8), blend: 0.35, rim: 1 });
    const bands = shade(am, blk, { depth: 4, normal: sphereN(14, 21, 8, 8), blend: 0.35 });
    ab.each((x, y) => { const k = (y - 17) % 5; return (k === 3 || k === 4) ? bands.get(x, y) : undefined; });
    put(p, ab, 'dark');
    put(p, part(W, H, (g) => { g.poly([[14, 28], [17, 28], [15.5, 30.8]], 1); }, blk, { depth: 1 }));
    // jointed legs reaching out from under the thorax
    const lg = G().pix(W, H);
    both(W, (X) => {
      lg.line(X(12), 16, X(8), 18, blk[0]); lg.line(X(8), 18, X(7), 22, blk[0]);
      lg.line(X(12), 18, X(9), 21, blk[0]); lg.line(X(9), 21, X(9), 25, blk[0]);
      lg.set(X(8), 17, blk[2]); lg.set(X(9), 20, blk[2]);
    });
    put(p, lg);
    // fuzzy thorax
    put(p, part(W, H, (g) => { g.ellipse(15.5, 15.5, 5, 3.8, 1); sym(g); }, ramp('#b06a22', 5), { depth: 3, normal: sphereN(14.5, 14.5, 6, 5), blend: 0.3 }), 'dark');
    for (const [x, y] of [[12, 15], [14, 17], [17, 17], [19, 15], [13, 13], [18, 13]]) p.set(x, y, '#d89a4a');
    // elbowed antennae
    both(W, (X) => { p.line(X(14), 6, X(13), 3, blk[0]); p.line(X(13), 3, X(10), 1, blk[0]); p.set(X(9), 1, blk[2]); });
    // head: yellow face plate between huge compound eyes
    const hm = mask(W, H);
    hm.ellipse(15.5, 9.2, 5.2, 4.4, 1);
    sym(hm);
    put(p, shade(hm, yel, { depth: 3, normal: sphereN(14.5, 8.5, 6, 5.5), blend: 0.3 }), 'dark');
    const em = mask(W, H);
    em.ellipse(11.3, 8.8, 2.6, 3.4, 1);
    sym(em);
    const eyes = shade(em, ['#3a0c10', '#7a1818', '#c02a1a', '#ff6a3a'], { depth: 2, normal: sphereN(11, 8, 9, 7), blend: 0.3 });
    for (const [x, y] of [[10, 10], [12, 9], [20, 8], [19, 10], [11, 11]]) eyes.set(x, y, '#5a1010');
    put(p, eyes, INK);
    p.set(10, 7, WHITE); p.set(10, 6, '#ffc0a0'); p.set(20, 7, '#ffc0a0');
    p.set(15, 8, yel[4]); p.set(16, 8, yel[3]); p.set(15, 11, yel[1]); p.set(16, 11, yel[1]);
    // mandibles
    both(W, (X) => { p.set(X(14), 13, INK); p.set(X(13), 13, INK); p.set(X(13), 14, INK); p.set(X(14), 14, '#e8dcc0'); p.set(X(15), 14, INK); });
    return finish(p, { float: true });
  };

  // Wisp: a floating ghost-flame with hollow eyes, flickering tongues and sparks.
  S.wisp = () => {
    const W = 32, H = 32;
    const fl = ['#1c2a8c', '#2a54d4', '#3a92f4', '#6ad0ff', '#b4f0ff', '#f4feff'];
    const m = mask(W, H);
    m.ellipse(15.5, 19, 7.8, 7.4, 1);
    capsule(m, 11, 15, 8.5, 4.5, 3.4, 0.3, 1);
    capsule(m, 16, 13, 17.5, 1.5, 4, 0.3, 1);
    capsule(m, 20.5, 14.5, 24, 6, 3, 0.3, 1);
    capsule(m, 7.5, 20, 5, 13, 2, 0.3, 1);
    tube(m, [[12, 25], [11, 30], [5, 28.5]], 3, 0.4, 1);
    tube(m, [[19, 25], [22, 29.5], [26, 28]], 2.4, 0.3, 1);
    const D = distField(m, 9);
    const p = G().pix(W, H);
    m.each((x, y) => {
      const d = D[y * W + x], c = Math.hypot(x - 15, (y - 18) * 0.9);
      let v = 0.16 + d * 0.14 + Math.max(0, 1 - c / 8) * 0.45 - Math.max(0, x - 18) * 0.02;
      p.set(x, y, fl[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    });
    // inner flicker streaks
    for (const [x, y0, y1] of [[13, 9, 12], [17, 5, 10], [22, 9, 11]]) p.vline(x, y0, y1, fl[3]);
    // hollow eyes and a small open mouth
    stamp(p, 11, 15, ['kk..', 'kkk.', '.kk.'], { k: '#0c1040' });
    stamp(p, 17, 15, ['..kk', '.kkk', '.kk.'], { k: '#0c1040' });
    p.set(12, 16, '#6ad0ff'); p.set(19, 16, '#6ad0ff');
    stamp(p, 14, 20, ['.kk.', 'kkkk', '.kk.'], { k: '#0c1040' });
    // sparks
    for (const [x, y] of [[4, 5], [28, 13], [26, 3]]) { p.set(x, y, fl[5]); p.set(x - 1, y, fl[3]); p.set(x + 1, y, fl[3]); p.set(x, y - 1, fl[3]); p.set(x, y + 1, fl[3]); }
    return finish(p, { float: true });
  };

  // Imp: a pot-bellied little devil with bat wings, horns, a toothy grin and a trident.
  S.imp = () => {
    const W = 32, H = 32;
    const skin = ramp('#d24a3a', 5, { dark: 0.62 }), wing = ramp('#7a2a52', 4, { dark: 0.55 }), horn = ramp('#eadcb8', 4, { dark: 0.45, shift: 30 });
    const iron = ['#2a2a34', '#5a5a68', '#9a9aa8', '#dcdce4'];
    const wm = mask(W, H);
    wm.poly([[12, 15], [4, 5], [4.5, 10], [1, 11], [4, 14], [1.5, 17.5], [6, 17], [10, 19]], 1);
    sym(wm);
    const p = shade(wm, wing, { depth: 2, global: 0.5, amb: 0.25 });
    both(W, (X) => { p.line(X(12), 15, X(4), 5, wing[3]); p.line(X(5), 7, X(2), 11, wing[2]); p.line(X(6), 10, X(2), 17, wing[2]); });
    // tail with an arrowhead, curling out on the left
    put(p, part(W, H, (g) => {
      tube(g, [[13, 25], [3, 29], [3.5, 21]], 1.1, 0.7, 1);
      g.poly([[1.5, 22.5], [5.8, 22.5], [3.6, 17.5]], 1);
    }, skin, { depth: 1.5 }));
    // legs and hooves
    const lm = mask(W, H);
    capsule(lm, 13.5, 25, 12.5, 28.5, 2, 1.6, 1); capsule(lm, 18.5, 25, 19.5, 28.5, 2, 1.6, 1);
    put(p, shade(lm, skin, { depth: 2, bias: -0.08 }), 'dark');
    put(p, part(W, H, (g) => { g.ellipse(12, 29.8, 2.6, 1.2, 1); g.ellipse(20, 29.8, 2.6, 1.2, 1); }, iron, { depth: 1 }), 'dark');
    // pot belly body + head + ears + arms
    const bm = mask(W, H);
    bm.ellipse(16, 21.5, 6, 5.8, 1);
    bm.ellipse(16, 11.8, 7, 6, 1);
    bm.poly([[10, 10.5], [4.5, 7.5], [10, 14]], 1); bm.poly([[22, 10.5], [27.5, 7.5], [22, 14]], 1);
    capsule(bm, 11, 18.5, 7.5, 23, 1.3, 1.2, 1);
    capsule(bm, 21, 18.5, 24.5, 17, 1.3, 1.3, 1);
    put(p, shade(bm, skin, { depth: 3.5, normal: sphereN(14.5, 15, 10, 13), blend: 0.45, rim: 1 }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(16, 22.5, 3.8, 3.6, 1), ramp('#f0a878', 4), { depth: 2.5, normal: sphereN(15, 21, 5, 5), blend: 0.4 }));
    p.set(16, 23, skin[1]);
    // claws
    for (const [x, y] of [[6, 24], [7, 25], [8, 25]]) p.set(x, y, horn[1]);
    // horns
    put(p, part(W, H, (g) => { tube(g, [[12.5, 7.5], [10.5, 5], [11, 2.5]], 1.4, 0.4, 1); tube(g, [[19.5, 7.5], [21.5, 5], [21, 2.5]], 1.4, 0.4, 1); }, horn, { depth: 1.5 }), 'dark');
    // trident, held in the right hand
    const tr = G().pix(W, H);
    tr.vline(26, 5, 30, iron[2]); tr.vline(27, 5, 30, iron[1]);
    tr.hline(23, 29, 7, iron[2]); tr.hline(23, 29, 8, iron[1]);
    for (const x of [23, 26, 29]) { tr.vline(x, 3, 6, iron[2]); tr.set(x, 2, iron[3]); }
    tr.vline(27, 3, 6, iron[1]);
    put(p, tr, 'dark');
    put(p, part(W, H, (g) => g.ellipse(25.5, 17, 1.8, 1.6, 1), skin, { depth: 1.5 }), 'dark');
    // face: yellow slit eyes under angry brows, wide fanged grin
    both(W, (X) => {
      p.set(X(11), 9, INK); p.set(X(12), 10, INK); p.set(X(13), 10, INK); p.set(X(14), 11, INK);
      p.set(X(11), 11, '#ffe450'); p.set(X(12), 11, '#ffe450'); p.set(X(13), 11, INK); p.set(X(12), 12, '#e0a020'); p.set(X(11), 12, INK); p.set(X(13), 12, INK);
    });
    p.set(11, 11, WHITE);
    p.hline(12, 19, 15, INK); p.set(11, 14, INK); p.set(20, 14, INK); p.hline(13, 18, 16, '#6a1020'); p.hline(14, 17, 17, INK);
    p.set(13, 16, WHITE); p.set(18, 16, WHITE); p.set(15, 16, WHITE); p.set(16, 16, '#e0d8d0');
    p.set(15, 13, skin[1]); p.set(16, 13, skin[1]);
    return finish(p);
  };

  // Mimic: a treasure chest whose lid is a jaw: fangs, lolling tongue, eyes in the dark.
  S.mimic = () => {
    const W = 32, H = 32;
    const wood = ramp('#8a4624', 5, { dark: 0.62, light: 0.45 }), gold = ramp('#e0b040', 5, { shift: 12 }), maw = ['#14040c', '#2e0a18', '#4a1226'];
    const tongue = ramp('#d85a8a', 5);
    const p = G().pix(W, H);
    // the dark maw between the jaws
    p.rect(4, 10, 24, 10, maw[0]);
    for (let x = 5; x < 27; x++) { p.set(x, 17, maw[1]); p.set(x, 18, maw[2]); p.set(x, 11, maw[1]); }
    // chest box: planks, darker toward the ground
    const box = mask(W, H);
    box.rect(3, 18, 26, 12, 1);
    const bx = shade(box, wood, { depth: 2, light: [-0.5, -0.6, 0.9], global: 0.6, amb: 0.25 });
    for (let x = 3; x < 29; x++) { bx.set(x, 18, wood[4]); bx.set(x, 19, wood[3]); bx.set(x, 23, wood[0]); bx.set(x, 24, wood[3]); bx.set(x, 28, wood[1]); }
    for (const [x, y] of [[10, 21], [20, 26], [12, 26], [25, 21]]) bx.set(x, y, wood[1]);
    put(p, bx, 'dark');
    // lid, thrown open like a jaw
    const lid = mask(W, H);
    lid.rect(3, 5, 26, 6, 1);
    lid.ellipse(15.5, 5.2, 13, 4, 1);
    lid.rect(0, 11, W, 21, null);
    const ld = shade(lid, wood, { depth: 3, normal: sphereN(14, 5, 16, 8), blend: 0.3, global: 0.4 });
    for (let x = 3; x < 29; x++) { ld.set(x, 7, wood[0]); ld.set(x, 8, wood[3]); ld.set(x, 10, wood[1]); }
    put(p, ld, 'dark');
    // metal bands, rim, rivets
    const gm = G().pix(W, H);
    for (const bxx of [6, 24]) {
      for (let y = 0; y <= 10; y++) if (lid.get(bxx, y) != null) { gm.set(bxx, y, gold[3]); gm.set(bxx + 1, y, gold[1]); }
      for (let y = 18; y <= 29; y++) { gm.set(bxx, y, gold[3]); gm.set(bxx + 1, y, gold[1]); }
    }
    gm.hline(3, 28, 29, gold[0]);
    for (const [x, y] of [[6, 21], [24, 21], [6, 27], [24, 27], [6, 8], [24, 8]]) gm.set(x, y, gold[4]);
    put(p, gm);
    // lock plate with keyhole
    const lock = part(W, H, (g) => g.rect(14, 20, 5, 6, 1), gold, { depth: 2, global: 0.6 });
    lock.set(16, 22, INK); lock.set(16, 23, INK); lock.set(15, 23, '#3a2a10'); lock.set(16, 24, INK);
    put(p, lock, INK);
    // fangs: upper row from the lid, lower row from the rim
    const T = '#f4f0e4', T2 = '#bcb4a0';
    for (let x = 5; x <= 26; x += 3) { p.set(x, 11, T); p.set(x + 1, 11, T2); p.set(x, 12, T); p.set(x + 1, 12, T2); p.set(x, 13, T); }
    for (let x = 6; x <= 27; x += 3) { p.set(x, 17, T); p.set(x - 1, 17, T2); p.set(x, 16, T); p.set(x, 15, T2); }
    // eyes burning deep in the maw
    both(W, (X) => { p.set(X(11), 14, '#ffe860'); p.set(X(12), 14, '#fff8c0'); p.set(X(13), 14, '#ff9020'); p.set(X(12), 15, '#c03010'); p.set(X(11), 15, '#802010'); });
    // tongue lolling out over the front
    put(p, part(W, H, (g) => tube(g, [[19.5, 17.5], [23.5, 20], [21.5, 27.5]], 2.1, 1.7, 1), tongue, { depth: 2 }), 'dark');
    p.line(22, 21, 21.5, 26, tongue[1]);
    return finish(p);
  };

  // Eyeball: a floating fleshy orb, one huge veined eye and trailing tendrils.
  S.eyeball = () => {
    const W = 32, H = 32;
    const flesh = ramp('#9a3aa0', 5, { dark: 0.6 }), white = ramp('#ece2d8', 4, { dark: 0.4, shift: 30 }), iris = ramp('#40b848', 4);
    const p = G().pix(W, H);
    const tm = mask(W, H);
    tube(tm, [[10, 20], [7, 25.5], [10, 29.5]], 1.6, 0.5, 1);
    tube(tm, [[14, 22], [13, 26.5], [15, 29.2]], 1.6, 0.5, 1);
    tube(tm, [[18, 22], [20, 26.5], [17, 29.5]], 1.6, 0.5, 1);
    tube(tm, [[22, 19], [26, 24], [24, 28.5]], 1.5, 0.5, 1);
    put(p, shade(tm, flesh, { depth: 1.5, bias: -0.1 }));
    // spikes on the crown
    put(p, part(W, H, (g) => {
      g.poly([[9, 7], [7.5, 2], [12, 5]], 1); g.poly([[14, 5], [15.5, 1.2], [17.5, 5]], 1); g.poly([[20, 5], [24, 2], [23, 7]], 1);
    }, ramp('#e8d8b4', 4, { shift: 30 }), { depth: 1.5 }));
    const om = mask(W, H);
    om.ellipse(15.5, 13.5, 11, 9.8, 1);
    put(p, shade(om, flesh, { depth: 4, normal: sphereN(14, 12.5, 12, 11), blend: 0.3, rim: 1 }), 'dark');
    // almond eye opening; the heavy upper lid droops over the iris
    const em = mask(W, H);
    for (let x = 6; x <= 25; x++) {
      const u = (x - 15.5) / 9.6, k = Math.sqrt(Math.max(0, 1 - u * u));
      const top = 14.4 - 4.6 * k, bot = 14.4 + 5 * k;
      for (let y = Math.ceil(top); y <= Math.floor(bot); y++) em.set(x, y, 1);
    }
    const ew = shade(em, white, { depth: 3, normal: sphereN(14.5, 13.5, 10, 8), blend: 0.3, rim: 1 });
    // bloodshot corners: thin forking veins
    const vein = '#d86a6a';
    for (const [a, b, c, d] of [[7, 14, 9, 13], [8, 16, 10, 17], [24, 14, 22, 13], [23, 16, 22, 17]]) ew.line(a, b, c, d, vein);
    put(p, ew, INK);
    const ir = part(W, H, (g) => g.ellipse(15.5, 14.8, 4, 3.9, 1), iris, { depth: 2.5, normal: sphereN(14.5, 14, 5, 5), blend: 0.3 });
    clip(ir, em);
    ir.each((x, y) => {
      const d = Math.hypot(x - 15.5, (y - 14.8) * 1.05), l = (x - 15.5) + (y - 14.8);
      return d > 3.3 ? iris[0] : l < -2 ? iris[3] : l > 2.5 ? iris[1] : iris[2];
    });
    put(p, ir);
    for (let y = 11; y <= 18; y++) if (em.get(15, y) != null) { p.set(15, y, INK); if (y > 12 && y < 17) p.set(16, y, INK); }
    p.set(13, 13, WHITE); p.set(13, 12, WHITE); p.set(14, 12, '#d8f0d8'); p.set(18, 17, iris[3]);
    // lid rims: dark crease above, pale lash-line, a soft lower lid
    for (let x = 6; x <= 25; x++) {
      let top = null, bot = null;
      for (let y = 0; y < H; y++) if (em.get(x, y) != null) { if (top == null) top = y; bot = y; }
      if (top == null) continue;
      p.set(x, top - 1, INK); p.set(x, top - 2, flesh[4]); p.set(x, top - 3, flesh[1]);
      p.set(x, bot + 1, flesh[3]); p.set(x, bot + 2, flesh[1]);
    }
    return finish(p, { float: true });
  };

  // Goblin: a crouching green brute with a hooked nose, long ears and a spiked club.
  S.goblin = () => {
    const W = 48, H = 48;
    const skin = ramp('#6aa844', 6, { dark: 0.66 }), leather = ramp('#8e5c34', 5, { dark: 0.6 }), wood = ramp('#a0703c', 5);
    const iron = ['#2c2c36', '#60606e', '#a0a0ae', '#e0e0e8'], hair = ['#1e1418', '#3a2830', '#5a4048'];
    const p = G().pix(W, H);
    // legs and feet
    const lm = mask(W, H);
    capsule(lm, 18, 37, 14.5, 43.5, 3, 2.6, 1); capsule(lm, 27, 37, 30.5, 43.5, 3, 2.6, 1);
    put(p, shade(lm, skin, { depth: 2.5, bias: -0.06 }));
    put(p, part(W, H, (g) => { g.ellipse(12.5, 45, 4.2, 2, 1); g.ellipse(32.5, 45, 4.2, 2, 1); }, skin, { depth: 2 }), 'dark');
    for (const x of [9, 11, 13, 32, 34, 36]) p.set(x, 46, iron[3]);
    // left arm hanging, clawed
    const am = mask(W, H);
    capsule(am, 15, 26, 10, 34, 2.8, 2.4, 1);
    am.ellipse(9, 36, 2.8, 2.6, 1);
    put(p, shade(am, skin, { depth: 2.5 }));
    // torso
    const tm = mask(W, H);
    tm.ellipse(22.5, 30, 8.5, 8.5, 1);
    put(p, shade(tm, skin, { depth: 5, normal: sphereN(21, 28, 11, 11), blend: 0.4, rim: 1 }), 'dark');
    // leather vest, belt, loincloth
    const vm = mask(W, H);
    vm.ellipse(22.5, 30, 8.5, 8.5, 1);
    vm.rect(19, 21, 7, 11, null); vm.poly([[19, 31], [26, 31], [22.5, 36]], null);
    clip(vm, tm);
    put(p, shade(vm, leather, { depth: 2.5, normal: sphereN(21, 28, 11, 11), blend: 0.5 }), 'dark');
    const bl = part(W, H, (g) => { g.rect(14, 35, 17, 3, 1); g.poly([[16, 38], [29, 38], [27, 42], [23, 40], [18, 42]], 1); }, leather, { depth: 1.5, bias: -0.08 });
    put(p, bl, 'dark');
    put(p, part(W, H, (g) => g.rect(21, 35, 3, 3, 1), iron, { depth: 1 }), INK);
    for (const [x, y] of [[20, 25], [20, 28], [25, 25], [25, 28], [16, 30], [29, 30]]) p.set(x, y, leather[4]);
    for (const [x, y] of [[21, 23], [23, 26], [22, 29]]) p.set(x, y, skin[2]);
    // right arm raised to the club
    const rm = mask(W, H);
    capsule(rm, 30, 26, 35, 22, 2.8, 2.5, 1);
    put(p, shade(rm, skin, { depth: 2.5 }), 'dark');
    // spiked club
    const cm = mask(W, H);
    capsule(cm, 36.5, 25, 41.5, 6.5, 1.3, 3.3, 1);
    put(p, shade(cm, wood, { depth: 2.5, light: [-0.8, -0.3, 0.6] }), 'dark');
    for (const [x, y, dx] of [[37, 10, -1], [44, 11, 1], [38, 6, -1], [45, 6, 1], [41, 3, 0], [36, 14, -1], [43, 15, 1]]) {
      p.set(x, y, iron[2]); p.set(x + dx, y + (dx ? 0 : -1), iron[3]);
    }
    for (const [x, y] of [[40, 8], [39, 12], [41, 16]]) p.set(x, y, wood[1]);
    put(p, part(W, H, (g) => g.ellipse(36.5, 22.5, 2.8, 2.6, 1), skin, { depth: 2 }), 'dark');
    for (const [x, y] of [[35, 21], [35, 23]]) p.set(x, y, skin[1]);
    // head + ears
    const hm = mask(W, H);
    hm.ellipse(22.5, 15, 8.8, 7.8, 1);
    hm.poly([[15, 12], [2, 6], [5, 10.5], [15, 18]], 1);
    hm.poly([[30, 12], [43, 6], [40, 10.5], [30, 18]], 1);
    hm.ellipse(22.5, 20, 6.5, 3, 1);
    const head = shade(hm, skin, { depth: 4, normal: sphereN(20.5, 13, 11, 10), blend: 0.45, rim: 1 });
    // inner ear folds
    for (const [x0, y0, x1, y1] of [[14, 13, 5, 9], [31, 13, 40, 9]]) head.line(x0, y0, x1, y1, skin[1]);
    put(p, head, 'dark');
    // wild hair swept back from the crown
    put(p, part(W, H, (g) => {
      tube(g, [[19, 9], [18.5, 4.5], [22, 2.5]], 1.6, 0.4, 1);
      tube(g, [[22, 8], [23.5, 4], [28, 3]], 1.8, 0.4, 1);
      tube(g, [[25, 8.5], [28, 5.5], [31.5, 6.5]], 1.5, 0.4, 1);
    }, hair, { depth: 1.2 }), 'dark');
    // warts
    for (const [x, y] of [[27, 11], [16, 16]]) { p.set(x, y, skin[4]); p.set(x + 1, y + 1, skin[1]); }
    // brow ridge, eyes
    both(W - 1, (X) => {
      p.line(X(16), 11, X(21), 13, skin[0]);
      p.set(X(18), 13, '#ffe860'); p.set(X(19), 13, '#ffe860'); p.set(X(20), 14, '#ffe860'); p.set(X(19), 14, '#d02010'); p.set(X(18), 14, '#ffe860');
      p.set(X(17), 13, INK); p.set(X(17), 14, INK); p.set(X(18), 15, INK); p.set(X(19), 15, INK); p.set(X(20), 15, INK); p.set(X(21), 14, INK);
    });
    p.set(18, 13, WHITE);
    // hooked nose
    put(p, part(W, H, (g) => { g.ellipse(22.5, 17.6, 2.4, 2.5, 1); g.rect(22, 13.5, 2, 3, 1); }, skin, { depth: 1.5, light: [-0.6, -0.6, 0.5], bias: 0.16 }), 'dark');
    p.set(21, 16, skin[5]); p.set(21, 19, INK); p.set(24, 19, INK); p.set(22, 20, skin[0]); p.set(23, 20, skin[0]);
    // grin with teeth and tusks
    p.hline(17, 28, 21, INK); p.set(16, 20, INK); p.set(29, 20, INK); p.hline(18, 27, 22, '#5a1a20'); p.hline(19, 26, 23, INK);
    for (const x of [18, 20, 22, 24, 26]) p.set(x, 22, WHITE);
    p.set(18, 20, WHITE); p.set(27, 20, WHITE); p.set(18, 19, WHITE); p.set(27, 19, WHITE);
    return finish(p);
  };

  // Snake: a hooded serpent rearing over its own coils, fangs bared, tongue flicking.
  S.snake = () => {
    const W = 48, H = 48;
    const sc = ramp('#4c9a3c', 6, { dark: 0.66 }), belly = ramp('#e2d690', 5, { dark: 0.5, shift: 26 });
    const p = G().pix(W, H);
    const cyl = { depth: 3.5, light: [-0.35, -0.9, 0.5], rim: 1 };
    const PI = Math.PI;
    const ring = (cx, cy, rx, ry, a0, a1, r) => part(W, H, (g) => arc(g, cx, cy, rx, ry, a0, a1, r, r, 1), sc, cyl);
    const L = [24, 40.5, 15, 4.2, 3.8], U = [24, 34.5, 10.5, 3.2, 3.4];
    // back halves of both coils
    put(p, ring(L[0], L[1], L[2], L[3], PI, 2 * PI, L[4]));
    put(p, ring(U[0], U[1], U[2], U[3], PI, 2 * PI, U[4]), 'dark');
    // neck rising out of the coils in an S toward the head
    const neckPath = [[24, 36], [33, 25], [21, 13]];
    const nm = mask(W, H);
    tube(nm, neckPath, 4.3, 3.4, 1);
    put(p, shade(nm, sc, { depth: 4, rim: 1 }), 'dark');
    // belly scutes along the front of the neck
    const bm = mask(W, H);
    tube(bm, [[22, 36], [29.5, 26], [19.5, 15]], 2, 1.6, 1);
    clip(bm, nm);
    const bs = shade(bm, belly, { depth: 2 });
    bs.each((x, y) => ((x + y) % 3 === 0 ? belly[1] : undefined));
    put(p, bs);
    // front halves (upper coil, tail, lower coil)
    put(p, ring(U[0], U[1], U[2], U[3], 0, PI, U[4]), 'dark');
    put(p, part(W, H, (g) => tube(g, [[38, 41.5], [45.5, 42.5], [45.5, 35.5]], 3, 0.6, 1), sc, cyl), 'dark');
    put(p, ring(L[0], L[1], L[2], L[3], -0.05, PI + 0.05, L[4]), 'dark');
    // diamond markings along the coils
    for (const [cx, cy, rx, ry, list] of [[...U.slice(0, 4), [0.5, 1.2, 1.9, 2.6]], [...L.slice(0, 4), [0.35, 0.9, 1.45, 2.0, 2.55, 2.95]]]) {
      for (const a of list) {
        const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry) - 1;
        p.set(x, y - 1, sc[1]); p.set(x - 1, y, sc[1]); p.set(x + 1, y, sc[1]); p.set(x, y, sc[5]); p.set(x, y + 1, sc[1]);
      }
    }
    // arrow-shaped viper head, three-quarter view, jaws agape
    const jaw = mask(W, H);
    jaw.poly([[5.5, 19], [15, 17], [24, 14], [25.5, 17.5], [15, 22.5], [7.5, 22]], 1);
    put(p, shade(jaw, sc, { depth: 2, bias: -0.08 }), 'dark');
    const lj = mask(W, H);
    lj.poly([[7, 21], [15, 19.5], [23.5, 16.5], [24, 17.5], [15, 22], [8, 22]], 1);
    clip(lj, jaw);
    put(p, shade(lj, belly, { depth: 1, bias: -0.1 }));
    // mouth lining
    const mo = G().pix(W, H);
    mo.poly([[5, 12.5], [23, 13], [24.5, 15], [15, 18], [6.5, 19.5]], '#8a2040');
    mo.poly([[9, 14.5], [22, 14], [14, 17]], '#c84868');
    put(p, mo, INK);
    const hd = mask(W, H);
    hd.poly([[27, 12], [26, 7.5], [21, 4.5], [13, 5.5], [6.5, 8.5], [4.5, 11], [5.5, 13], [14, 13.5], [24, 14.5]], 1);
    const head = shade(hd, sc, { depth: 3, normal: sphereN(15, 8, 13, 7), blend: 0.4, rim: 1 });
    // scale plates on the crown and a dark stripe through the eye
    for (const [x, y] of [[12, 7], [16, 6], [20, 6], [23, 8], [18, 9], [10, 9]]) { head.set(x, y, sc[1]); head.set(x + 1, y, sc[4]); }
    head.line(20, 11, 25, 11.5, sc[1]);
    put(p, head, 'dark');
    // upper lip line
    p.line(6, 13, 23, 14, sc[0]);
    // fangs
    for (const [x, y] of [[8, 13], [12, 14]]) { p.vline(x, y, y + 2, WHITE); p.set(x + 1, y, '#c8c0b0'); }
    for (const [x, y] of [[9, 19], [9, 18], [16, 17.5]]) p.set(x, y, WHITE);
    // forked tongue flicking out
    p.line(10, 16.5, 3, 18, '#e03040'); p.line(10, 17, 4, 18.5, '#ff6070'); p.set(2, 17, '#e03040'); p.set(2, 19, '#e03040'); p.set(1, 16, '#ff6070'); p.set(1, 20, '#ff6070');
    // nostril, brow and slit eye
    p.set(7, 10, INK); p.set(8, 10, INK);
    p.line(12, 8, 18, 7, INK);
    p.set(14, 9, '#fff070'); p.set(15, 9, '#ffd020'); p.set(16, 9, '#ffd020'); p.set(15, 10, '#e0a010'); p.set(16, 10, INK); p.set(14, 10, '#e0a010');
    p.set(16, 9, INK); p.set(17, 9, '#e0a010'); p.set(13, 9, INK); p.set(13, 10, INK); p.set(17, 10, INK); p.hline(14, 16, 11, INK);
    p.set(14, 9, WHITE);
    return finish(p);
  };

  // Wolf: a snarling grey wolf in a low three-quarter crouch, hackles up, tail raised.
  S.wolf = () => {
    const W = 48, H = 48;
    const fur = ramp('#6c80aa', 6, { dark: 0.68 }), pale = ramp('#bcc8e0', 5, { dark: 0.5, shift: 20 });
    const p = G().pix(W, H);
    const tuft = (m, x, y, a, b, r) => capsule(m, x, y, a, b, r || 1.5, 0.3, 1);
    // raised bushy tail
    const tl = mask(W, H);
    tube(tl, [[38.5, 24], [45.5, 19], [40.5, 9]], 2.2, 3.2, 1);
    tuft(tl, 40.5, 9, 38.5, 4.5, 2.4); tuft(tl, 43.5, 10, 44.5, 6.5, 1.6); tuft(tl, 45, 14, 46, 11.5, 1.4); tuft(tl, 44.5, 22, 45.5, 19.5, 1.3);
    const tail = shade(tl, fur, { depth: 3, rim: 1 });
    tail.line(42, 12, 44, 18, fur[1]); tail.line(40, 10, 41, 15, fur[2]);
    tail.set(39, 6, pale[3]); tail.set(39, 5, pale[4]); tail.set(40, 7, pale[3]);
    put(p, tail);
    // far legs (in shadow)
    const fl = mask(W, H);
    capsule(fl, 22, 31, 20.5, 44.5, 2.6, 2, 1); fl.ellipse(19.5, 45.5, 2.8, 1.5, 1);
    capsule(fl, 34, 30, 34.5, 38, 2.6, 2, 1); capsule(fl, 34.5, 38, 33.5, 44.5, 2, 1.8, 1); fl.ellipse(33, 45.5, 2.8, 1.5, 1);
    put(p, shade(fl, fur, { depth: 2, bias: -0.2 }));
    // body: an arched back rising to the haunch, bristling hackles
    const bm = mask(W, H);
    bm.ellipse(29, 27, 11.5, 6.6, 1);
    bm.ellipse(36.5, 25.5, 6.2, 7, 1);
    for (let i = 0; i < 6; i++) {
      const x = 21 + i * 2.8, y = 21.2 - Math.sin((i + 1) * 0.5) * 1.8;
      tuft(bm, x, y + 1.5, x + 2.4, y - 2, 1.4);
    }
    for (const [x, y, a, b] of [[24, 32, 24.5, 35.5], [28.5, 32.5, 29.5, 35.5], [33, 32, 34, 34.5]]) tuft(bm, x, y, a, b, 1.4);
    const body = shade(bm, fur, { depth: 4, normal: sphereN(28, 22, 15, 11), blend: 0.4, rim: 1 });
    for (const [x0, y0, x1, y1] of [[26, 23, 29, 26], [32, 21, 34, 25], [22, 24, 24, 28], [37, 23, 38, 27]]) body.line(x0, y0, x1, y1, fur[2]);
    put(p, body, 'dark');
    // near hind leg: thigh, hock, paw
    const hl = mask(W, H);
    hl.ellipse(38.5, 28, 5, 5.5, 1);
    capsule(hl, 40, 31, 42.5, 38, 3, 2.2, 1);
    capsule(hl, 42.5, 38, 40.5, 44.5, 2.1, 1.9, 1);
    hl.ellipse(39.8, 45.5, 3, 1.6, 1);
    put(p, shade(hl, fur, { depth: 3, normal: sphereN(37, 27, 7, 9), blend: 0.35, rim: 1 }), 'dark');
    // near front leg, planted forward
    const lm = mask(W, H);
    capsule(lm, 17, 29, 14, 38, 3.4, 2.5, 1);
    capsule(lm, 14, 38, 13, 44.5, 2.5, 2.3, 1);
    lm.ellipse(11.8, 45.5, 3.3, 1.6, 1);
    put(p, shade(lm, fur, { depth: 2.8, rim: 1 }), 'dark');
    for (const x of [9, 11, 13, 17, 19, 31, 33, 38, 40]) p.set(x, 46, pale[4]);
    // neck ruff
    const nm = mask(W, H);
    nm.ellipse(19, 25, 7.5, 7.5, 1);
    for (const [x, y, a, b] of [[14, 30, 13, 34], [18, 31, 18, 35], [22, 30, 23.5, 33.5], [25, 25, 28, 26], [13, 26, 10.5, 29]]) tuft(nm, x, y, a, b, 1.8);
    const ruff = shade(nm, fur, { depth: 4, normal: sphereN(17, 22, 10, 11), blend: 0.4, rim: 1 });
    const um = mask(W, H);
    um.ellipse(15.5, 29, 4.5, 4.5, 1);
    tuft(um, 14, 30, 13, 34, 1.8); tuft(um, 18, 31, 18, 35, 1.8);
    clip(um, nm);
    put(ruff, shade(um, pale, { depth: 2.5, bias: -0.12 }));
    for (const [x0, y0, x1, y1] of [[19, 23, 21, 28], [16, 27, 15, 31], [22, 21, 24, 25]]) ruff.line(x0, y0, x1, y1, fur[2]);
    put(p, ruff, 'dark');
    // head, held low: skull, ears, long muzzle
    const hd = mask(W, H);
    hd.ellipse(15, 17.5, 7.8, 6.6, 1);
    hd.poly([[17.5, 12.5], [22.5, 3.5], [23, 14.5]], 1);
    hd.poly([[11, 12.5], [13, 2.5], [18, 10.5]], 1);
    tuft(hd, 21, 20, 25.5, 22, 1.8); tuft(hd, 21, 17, 25.5, 17, 1.6);
    hd.poly([[10, 15.5], [1.8, 20], [1.5, 22.8], [4.5, 24], [13, 23]], 1);
    const head = shade(hd, fur, { depth: 3.5, normal: sphereN(12.5, 15, 10, 10), blend: 0.45, rim: 1 });
    head.line(18.5, 11.5, 21.5, 5.5, fur[1]);
    // darker brow saddle
    for (const [x, y] of [[14, 13], [15, 13], [15, 14], [16, 14], [13, 12], [14, 12]]) head.set(x, y, fur[1]);
    put(p, head, 'dark');
    put(p, part(W, H, (g) => g.poly([[12.5, 12], [13.5, 5], [16.5, 10.5]], 1), ramp('#c07888', 3, { dark: 0.5 }), { depth: 1 }));
    // pale muzzle underside and cheek
    const mz = mask(W, H);
    mz.poly([[3.5, 23], [12.5, 21.5], [16.5, 23.5], [12, 25], [5, 24.5]], 1);
    clip(mz, hd);
    put(p, shade(mz, pale, { depth: 1.5, bias: -0.05 }));
    // nose and snarl wrinkles
    p.set(1, 20, INK); p.set(2, 20, INK); p.set(2, 19, INK); p.set(1, 21, INK); p.set(3, 19, '#6a6a7a');
    for (const [x, y] of [[5, 18], [6, 17], [7, 18], [8, 17], [9, 18]]) p.set(x, y, fur[1]);
    // open jaws: dark maw, upper fangs, lower jaw
    const mo = G().pix(W, H);
    mo.poly([[2.5, 23], [13, 22.5], [11.5, 27], [4.5, 26.5]], INK);
    mo.hline(5, 11, 24, '#6a1020'); mo.hline(5, 10, 25, '#b83048');
    put(p, mo);
    put(p, part(W, H, (g) => g.poly([[4, 26.5], [12.5, 27], [11.5, 29], [5.5, 28.5]], 1), pale, { depth: 1, bias: -0.15 }), INK);
    for (const [x, y] of [[3, 23], [3, 24], [6, 23], [11, 23], [11, 24], [4, 26], [5, 25], [10, 26], [9, 25]]) p.set(x, y, WHITE);
    // glaring eyes
    p.set(8, 15, INK); p.set(9, 15, INK); p.set(10, 16, INK); p.set(11, 16, INK); p.set(12, 15, INK);
    p.set(8, 16, '#fff070'); p.set(9, 16, '#ffd030'); p.set(9, 17, '#e89010'); p.set(10, 17, INK); p.set(8, 17, INK);
    p.set(16, 15, INK); p.set(17, 15, INK); p.set(16, 16, '#ffd030'); p.set(17, 16, '#e89010'); p.set(18, 16, INK); p.set(16, 17, INK);
    p.set(8, 16, WHITE);
    return finish(p);
  };

  // Plant: a man-eating flower on a thorny stalk, gaping toothed maw ringed by petals.
  S.plant = () => {
    const W = 48, H = 48;
    const leaf = ramp('#4c9e3a', 6, { dark: 0.66 }), petal = ramp('#e2507c', 5, { dark: 0.6 }), soil = ramp('#6a4a34', 4, { dark: 0.5 });
    const lipC = ramp('#8ac040', 5), maw = ['#2a0614', '#4a0c22', '#701838'];
    const p = G().pix(W, H);
    // soil mound
    put(p, part(W, H, (g) => { g.ellipse(24, 45, 15, 2.6, 1); }, soil, { depth: 2, light: [0, -1, 0.5] }));
    for (const [x, y] of [[12, 45], [18, 46], [30, 45], [35, 46], [25, 44]]) p.set(x, y, soil[3]);
    // leaves
    const lm = mask(W, H);
    tube(lm, [[21, 44], [10, 34], [2.5, 38]], 3.4, 0.4, 1);
    tube(lm, [[27, 44], [38, 33], [45.5, 37]], 3.4, 0.4, 1);
    const lv = shade(lm, leaf, { depth: 2.5, light: [-0.4, -0.9, 0.6] });
    lv.each((x, y) => undefined);
    for (const pts of [[[20, 43], [11, 36], [3, 38]], [[28, 43], [37, 35], [45, 37]]]) {
      const [a, b, c] = pts;
      for (let t = 0; t <= 1; t += 0.05) { const u = 1 - t; lv.set(u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], leaf[4]); }
    }
    put(p, lv, 'dark');
    // thorny vines
    const vm = mask(W, H);
    tube(vm, [[22, 35], [8, 31], [7, 19]], 1.6, 0.7, 1);
    tube(vm, [[26, 31], [40, 28], [41, 18]], 1.6, 0.7, 1);
    const vines = shade(vm, leaf, { depth: 1.5, bias: -0.05 });
    for (const [x, y] of [[13, 32], [8, 26], [36, 29], [41, 23], [9, 21], [40, 20]]) { vines.set(x, y - 1, lipC[4]); }
    put(p, vines, 'dark');
    // stalk
    const sm = mask(W, H);
    tube(sm, [[24, 45], [19, 36], [24, 27]], 3.6, 3, 1);
    put(p, shade(sm, leaf, { depth: 3, rim: 1 }), 'dark');
    // petals behind the head
    const pm = mask(W, H);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.62;
      capsule(pm, 24 + Math.cos(a) * 6, 16 + Math.sin(a) * 5, 24 + Math.cos(a) * 15, 16 + Math.sin(a) * 12, 3.2, 2.2, 1);
    }
    for (const a of [2.3, 0.84]) capsule(pm, 24 + Math.cos(a) * 6, 16 + Math.sin(a) * 5, 24 + Math.cos(a) * 14, 16 + Math.sin(a) * 10, 3, 2, 1);
    const pet = shade(pm, petal, { depth: 2.5, normal: sphereN(22, 13, 18, 14), blend: 0.5 });
    for (let i = 0; i < 9; i++) {
      const a = i < 7 ? -Math.PI / 2 + (i - 3) * 0.62 : [2.3, 0.84][i - 7];
      pet.line(24 + Math.cos(a) * 9, 16 + Math.sin(a) * 7.5, 24 + Math.cos(a) * 13, 16 + Math.sin(a) * 10.5, petal[1]);
    }
    put(p, pet, 'dark');
    // head: fleshy lips around a gaping maw
    const hm = mask(W, H);
    hm.ellipse(24, 16, 10.5, 9, 1);
    const head = shade(hm, lipC, { depth: 4, normal: sphereN(22, 14, 12, 11), blend: 0.45, rim: 1 });
    put(p, head, 'dark');
    const mm = mask(W, H);
    mm.ellipse(24, 17, 7.5, 5.8, 1);
    const mouth = G().pix(W, H);
    mm.each((x, y) => { mouth.set(x, y, y < 15 ? maw[0] : y < 19 ? maw[1] : maw[2]); });
    put(p, mouth, INK);
    // tongue
    put(p, part(W, H, (g) => { g.ellipse(24.5, 20.5, 4, 2.2, 1); }, ramp('#e87a9a', 4), { depth: 1.5 }), maw[0]);
    p.vline(24, 19, 21, '#a03a5a');
    // teeth ring
    const T = WHITE, T2 = '#c8c0b0';
    for (const [x, y] of [[18, 13], [21, 12], [24, 11.5], [27, 12], [30, 13]]) { p.set(x, y + 1, T); p.set(x + 1, y + 1, T2); p.set(x, y + 2, T); }
    for (const [x, y] of [[19, 21], [22, 22], [26, 22], [29, 21]]) { p.set(x, y, T); p.set(x + 1, y, T2); p.set(x, y - 1, T); }
    // drool
    p.vline(20, 22, 26, '#c8f0e0'); p.set(20, 27, '#e8fff8');
    // small mean eyes on the upper lip
    both(W, (X) => { p.set(X(19), 9, INK); p.set(X(20), 9, '#ffe050'); p.set(X(21), 9, INK); p.set(X(20), 8, INK); p.set(X(21), 8, INK); });
    stamp(p, 17, 8, ['w'], { w: WHITE });
    return finish(p);
  };

  // Skeleton: a risen soldier: grinning skull with ember eyes, rusty sword, battered shield.
  S.skeleton = () => {
    const W = 48, H = 48;
    const bone = ramp('#e6dcc2', 5, { dark: 0.55, shift: 30 }), cloth = ramp('#8a2c44', 5, { dark: 0.6 });
    const rust = ['#3a2a28', '#6a5a58', '#a8a0a0', '#e0dce0'], wood = ramp('#8a5a30', 4), trim = ramp('#c8a040', 4);
    const p = G().pix(W, H);
    // tattered cape behind
    const cm = mask(W, H);
    cm.poly([[17, 19], [31, 19], [36, 40], [33, 38], [31, 42], [28, 39], [25, 43], [22, 39], [19, 42], [16, 38], [12, 40]], 1);
    put(p, shade(cm, cloth, { depth: 3, light: [-0.5, -0.6, 0.6], global: 0.4, bias: -0.1 }));
    const B = G().pix(W, H); // bones layer
    const bl = (x0, y0, x1, y1, r) => capsule(B, x0, y0, x1, y1, r, r, 1);
    // legs
    bl(21, 36, 19, 41, 1.1); bl(19, 41, 19, 45, 0.9); bl(27, 36, 29, 41, 1.1); bl(29, 41, 29, 45, 0.9);
    B.ellipse(19, 41, 1.5, 1.2, 1); B.ellipse(29, 41, 1.5, 1.2, 1);
    B.ellipse(17.5, 46, 2.6, 1.1, 1); B.ellipse(30.5, 46, 2.6, 1.1, 1);
    // pelvis
    B.poly([[19, 32], [29, 32], [27.5, 35.5], [24, 37], [20.5, 35.5]], 1);
    // collarbones and arms: sword arm raised on the left, shield arm on the right
    bl(17, 19.5, 31, 19.5, 0.8);
    B.ellipse(16.5, 20.5, 2, 1.8, 1); B.ellipse(31.5, 20.5, 2, 1.8, 1);
    bl(16, 21, 12, 28, 1); bl(12, 28, 9, 23, 0.9);
    bl(32, 21, 34, 27, 1);
    const bones = shade(B, bone, { depth: 1.5, light: [-0.5, -0.8, 0.6], global: 0.3, rim: 1 });
    put(p, bones, INK);
    // spine, sternum and ribs as fine lines over the dark cape
    const rb = G().pix(W, H);
    for (let y = 18; y <= 32; y++) { rb.set(23, y, bone[y % 2 ? 1 : 3]); rb.set(24, y, bone[y % 2 ? 0 : 2]); }
    for (let i = 0; i < 4; i++) {
      const y = 22 + i * 3, w = 7 - i;
      for (const d of [-1, 1]) {
        const x0 = d < 0 ? 23 : 24;
        rb.line(x0 + d, y - 1, x0 + d * (w - 2), y - 1, bone[3]);
        rb.set(x0 + d * (w - 1), y, bone[2]); rb.set(x0 + d * w, y + 1, bone[1]); rb.set(x0 + d * (w - 1), y + 1, bone[1]);
      }
    }
    put(p, rb, INK);
    // sword
    const sw = G().pix(W, H);
    for (let y = 2; y <= 22; y++) {
      const w = y < 5 ? y - 2 : 3, x0 = 8 - Math.floor(w / 2) - (y < 5 ? 0 : 1);
      for (let i = 0; i < w; i++) sw.set(x0 + i, y, i === 0 ? rust[3] : i === w - 1 ? rust[1] : rust[2]);
    }
    sw.set(7, 2, rust[3]);
    for (const [x, y] of [[8, 9], [7, 14], [8, 17], [8, 20], [7, 6]]) sw.set(x, y, '#8a5030');
    sw.set(8, 10, '#6a3a20');
    put(p, sw, 'dark');
    put(p, part(W, H, (g) => { g.rect(4, 22, 9, 2, 1); g.rect(8, 24, 2, 3, 1); }, trim, { depth: 1 }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(9, 24.5, 1.8, 1.6, 1), bone, { depth: 1 }), 'dark');
    // round shield
    const sh = mask(W, H);
    sh.ellipse(35, 30, 7.2, 8, 1);
    const shield = shade(sh, wood, { depth: 3, normal: sphereN(33, 28, 9, 10), blend: 0.4 });
    for (let y = 22; y <= 38; y++) for (const x of [32, 37]) if (shield.get(x, y) != null) shield.set(x, y, wood[0]);
    put(p, shield, 'dark');
    const rim = mask(W, H);
    rim.ellipse(35, 30, 7.2, 8, 1); rim.ellipse(35, 30, 5.8, 6.6, null);
    put(p, shade(rim, trim, { depth: 1, normal: sphereN(33, 28, 9, 10), blend: 0.6 }));
    put(p, part(W, H, (g) => g.ellipse(35, 30, 2, 2, 1), trim, { depth: 1.5 }), 'dark');
    p.set(34, 29, WHITE);
    // cracks / notches in the shield
    p.line(39, 24, 37, 27, INK); p.set(29, 35, null); p.set(30, 36, null);
    // skull
    const sk = mask(W, H);
    sk.ellipse(24, 10, 6.8, 6.6, 1);
    sk.rect(20, 13, 9, 4, 1);
    sk.rect(19, 17, 11, 1, null);
    put(p, shade(sk, bone, { depth: 3, normal: sphereN(22.5, 9, 8, 8), blend: 0.4, rim: 1 }), 'dark');
    // jaw
    put(p, part(W, H, (g) => { g.rect(20, 16, 9, 2, 1); g.rect(21, 18, 7, 1, 1); }, bone, { depth: 1, bias: -0.1 }), 'dark');
    // sockets with ember eyes
    for (const ex of [19, 26]) stamp(p, ex, 8, ['.kkk.', 'kkkkk', 'kkkkk', '.kkk.'], { k: INK });
    for (const ex of [20, 27]) { p.set(ex, 9, '#ff6a3a'); p.set(ex + 1, 9, '#ffe080'); p.set(ex, 10, '#c02010'); p.set(ex + 1, 10, '#ff6a3a'); }
    p.set(24, 13, INK); p.set(23, 14, INK); p.set(25, 14, INK); p.set(24, 14, INK);
    for (let x = 20; x <= 28; x++) p.set(x, 16, x % 2 ? INK : bone[3]);
    p.hline(21, 27, 17, INK);
    p.set(19, 6, WHITE); p.set(20, 5, WHITE);
    return finish(p);
  };

  // Lizardman: a scaled reptile warrior with a crested head, curved blade and buckler.
  S.lizardman = () => {
    const W = 48, H = 48;
    const sc = ramp('#4c9c64', 6, { dark: 0.66 }), belly = ramp('#e0d098', 4, { dark: 0.45, shift: 26 });
    const crest = ramp('#e06a30', 4), leather = ramp('#7a5236', 4, { dark: 0.55 });
    const steel = ['#2e3440', '#6a7888', '#aab8c8', '#eef4fa'], brass = ramp('#d0a040', 4);
    const p = G().pix(W, H);
    // tail sweeping out behind on the right
    put(p, part(W, H, (g) => tube(g, [[30, 38], [44, 44], [46, 33]], 3.6, 0.8, 1), sc, { depth: 2.5, bias: -0.06 }));
    // legs: thick thighs, clawed feet
    const lm = mask(W, H);
    capsule(lm, 19.5, 35, 17, 41, 3.4, 2.6, 1); capsule(lm, 17, 41, 17.5, 44.5, 2.4, 2, 1);
    capsule(lm, 28.5, 35, 31, 41, 3.4, 2.6, 1); capsule(lm, 31, 41, 30.5, 44.5, 2.4, 2, 1);
    lm.ellipse(16.5, 45.5, 3.6, 1.6, 1); lm.ellipse(31.5, 45.5, 3.6, 1.6, 1);
    put(p, shade(lm, sc, { depth: 2.5, rim: 1 }), 'dark');
    for (const x of [13, 15, 17, 30, 32, 34]) p.set(x, 46, belly[3]);
    // torso
    const tm = mask(W, H);
    tm.ellipse(24, 28, 8.8, 9.5, 1);
    put(p, shade(tm, sc, { depth: 5, normal: sphereN(22, 26, 11, 12), blend: 0.4, rim: 1 }), 'dark');
    // belly plates
    const bm = mask(W, H);
    bm.ellipse(24, 30, 4.8, 7.5, 1);
    clip(bm, tm);
    const bp = shade(bm, belly, { depth: 3, normal: sphereN(22, 26, 11, 12), blend: 0.5 });
    for (let y = 24; y <= 37; y += 3) for (let x = 18; x <= 30; x++) if (bp.get(x, y) != null) bp.set(x, y, belly[0]);
    put(p, bp);
    // loincloth + belt, strap across the chest
    put(p, part(W, H, (g) => { g.rect(16, 34, 16, 2, 1); g.poly([[20, 36], [28, 36], [26.5, 41], [24, 39.5], [21.5, 41]], 1); }, leather, { depth: 1.2 }), 'dark');
    const st = G().pix(W, H);
    st.line(17, 21, 30, 34, leather[2], 2); st.line(18, 21, 31, 34, leather[1]);
    clip(st, tm);
    put(p, st);
    put(p, part(W, H, (g) => g.rect(23, 34, 3, 2, 1), brass, { depth: 1 }), INK);
    // shield arm (right) with a round buckler
    put(p, part(W, H, (g) => capsule(g, 31, 22, 35, 29, 2.8, 2.5, 1), sc, { depth: 2 }), 'dark');
    const bk = mask(W, H);
    bk.ellipse(37.5, 29, 6, 6.5, 1);
    const buck = shade(bk, brass, { depth: 2.5, normal: sphereN(36, 27, 7, 8), blend: 0.4 });
    const bi = mask(W, H); bi.ellipse(37.5, 29, 4.2, 4.6, 1);
    put(buck, shade(bi, leather, { depth: 2, normal: sphereN(36, 27, 7, 8), blend: 0.4 }));
    buck.set(37, 29, brass[3]); buck.set(38, 29, brass[2]); buck.set(37, 28, WHITE);
    put(p, buck, 'dark');
    // sword arm (left) and a curved blade
    put(p, part(W, H, (g) => { capsule(g, 17, 22, 12, 29, 2.8, 2.5, 1); }, sc, { depth: 2 }), 'dark');
    const bl = G().pix(W, H);
    tube(bl, [[10, 27], [5, 18], [9, 6]], 1.8, 0.6, 1);
    const blade = shade(bl, steel, { depth: 1.5, light: [-0.9, -0.3, 0.5] });
    put(p, blade, 'dark');
    for (let y = 8; y <= 24; y += 1) { const x = y < 16 ? 6 + (16 - y) * 0.3 : 5.5 + (y - 16) * 0.45; p.set(Math.round(x) - 1, y, steel[3]); }
    put(p, part(W, H, (g) => { g.rect(8, 27, 6, 2, 1); }, brass, { depth: 1 }), 'dark');
    put(p, part(W, H, (g) => g.ellipse(11, 30, 2.4, 2.2, 1), sc, { depth: 1.5 }), 'dark');
    // head: crested, snouted, slit-eyed
    const cm = mask(W, H);
    cm.poly([[20, 8], [21, 3], [23, 6.5], [24.5, 2.2], [26, 6.5], [28, 3.5], [28.5, 9]], 1);
    const cr = shade(cm, crest, { depth: 1.5 });
    for (const x of [22, 24.5, 27]) cr.line(x, 3, x, 8, crest[0]);
    put(p, cr);
    const hm = mask(W, H);
    hm.ellipse(24, 12, 6.5, 5.8, 1);
    hm.ellipse(24, 17.5, 4.8, 3.6, 1);
    hm.ellipse(24, 21, 4.5, 2, 1);
    sym(hm);
    put(p, shade(hm, sc, { depth: 3.5, normal: sphereN(22, 12, 8, 10), blend: 0.45, rim: 1 }), 'dark');
    both(W, (X) => {
      p.set(X(19), 11, '#ffe850'); p.set(X(20), 11, '#ffd020'); p.set(X(19), 12, '#e8a010'); p.set(X(20), 12, INK); p.set(X(20), 13, INK);
      p.set(X(18), 10, INK); p.set(X(19), 10, INK); p.set(X(20), 10, INK); p.set(X(21), 11, INK); p.set(X(21), 12, INK);
      p.set(X(22), 16, INK);
    });
    p.set(19, 11, WHITE);
    // jaw line with teeth
    p.hline(20, 27, 20, INK); p.set(19, 19, INK); p.set(28, 19, INK);
    for (const x of [21, 23, 25, 27]) p.set(x, 19, WHITE);
    for (const x of [22, 24, 26]) p.set(x, 21, WHITE);
    // scale speckles
    for (const [x, y] of [[21, 7], [26, 8], [18, 26], [29, 25], [20, 31], [28, 31]]) p.set(x, y, sc[4]);
    return finish(p);
  };

  // Scorpion: a giant armoured scorpion, pincers raised, tail arched over its back.
  S.scorpion = () => {
    const W = 48, H = 48;
    const sh = ramp('#c8522c', 6, { dark: 0.66, light: 0.75 });
    const p = G().pix(W, H);
    const cyl = { depth: 2.5, rim: 1 };
    // legs (four a side), jointed
    const lg = mask(W, H);
    both(W, (X) => {
      for (let i = 0; i < 4; i++) {
        const y = 34 + i * 1.6, kx = 11 - i * 1.5 + (i === 3 ? 3 : 0), ky = 32 + i * 1.5;
        capsule(lg, X(18 - i), y, X(kx), ky, 1.3, 1, 1);
        capsule(lg, X(kx), ky, X(kx - 2 + i * 0.6), 44 + (i % 2), 1, 0.6, 1);
      }
    });
    put(p, shade(lg, sh, { depth: 1.2, bias: -0.1 }));
    // tail: segments arching up behind the body and curling forward
    const seg = [[24, 30, 4.1], [22.8, 23.5, 3.9], [23.4, 17, 3.7], [26.4, 11.4, 3.4], [31, 8, 3.1], [35.2, 8.6, 2.8]];
    const tl = G().pix(W, H);
    for (const [x, y, r] of seg) {
      const s1 = part(W, H, (g) => g.ellipse(x, y, r, r * 0.92, 1), sh, { depth: r, normal: sphereN(x - 1, y - 1, r + 1, r + 1), blend: 0.3, rim: 1 });
      s1.set(Math.round(x - r * 0.4), Math.round(y - r * 0.5), sh[5]);
      put(tl, s1, 'dark');
    }
    put(p, tl, 'dark');
    // pincer arms
    const am = mask(W, H);
    tube(am, [[18, 33], [11, 31], [9.5, 25]], 2.4, 2, 1);
    tube(am, [[30, 33], [37, 31], [39, 25]], 2.4, 2, 1);
    put(p, shade(am, sh, cyl), 'dark');
    // claws: a fat lower jaw and a hooked upper finger each
    for (const [cx, dir] of [[8.5, -1], [40, 1]]) {
      const cm = mask(W, H);
      cm.ellipse(cx, 21, 4.4, 4.8, 1);
      cm.poly([[cx - 3 * dir, 18], [cx - 4.5 * dir, 9], [cx - 0.5 * dir, 15]], 1);
      cm.poly([[cx + 0.5 * dir, 18], [cx + 3.5 * dir, 10.5], [cx + 4 * dir, 17]], 1);
      cm.ellipse(cx, 15.5, 1.3, 2.4, null);
      put(p, shade(cm, sh, { depth: 3, normal: sphereN(cx - 1, 19, 6, 7), blend: 0.4, rim: 1 }), 'dark');
    }
    // body: overlapping carapace plates
    const bm = mask(W, H);
    bm.ellipse(24, 34, 11, 6.8, 1);
    const body = shade(bm, sh, { depth: 4, normal: sphereN(22, 32, 13, 9), blend: 0.4, rim: 1 });
    // plate seams (dark) with a lit lip just below each
    for (const y of [30, 33]) for (let x = 13; x <= 35; x++) {
      if (body.get(x, y) == null || body.get(x, y - 1) == null) continue;
      body.set(x, y, sh[0]);
      if (body.get(x, y + 1) != null && x < 32) body.set(x, y + 1, sh[x < 22 ? 5 : 4]);
    }
    body.vline(24, 28, 36, sh[2]);
    put(p, body, 'dark');
    // head plate: glaring eye cluster and pincer mouthparts
    const hm = mask(W, H);
    hm.ellipse(24, 38.5, 6.5, 3.8, 1);
    put(p, shade(hm, sh, { depth: 2.5, normal: sphereN(22, 37, 8, 6), blend: 0.4, bias: 0.05 }), 'dark');
    both(W, (X) => {
      p.set(X(22), 37, '#ff4a30'); p.set(X(22), 38, '#a01810'); p.set(X(21), 37, INK); p.set(X(21), 38, INK); p.set(X(23), 38, INK);
      p.set(X(19), 38, INK); p.set(X(20), 38, '#e03020');
    });
    p.set(22, 37, '#ffd0a0'); p.set(25, 37, '#ff8060');
    both(W, (X) => { p.set(X(22), 42, INK); p.set(X(22), 43, sh[4]); p.set(X(23), 43, INK); });
    // stinger: the tail tip curls forward over everything, barb pointing down
    const stg = part(W, H, (g) => { g.ellipse(37.5, 12, 2.9, 3.1, 1); g.poly([[35.5, 13.5], [38.5, 14.5], [34.5, 19]], 1); }, ramp('#e8b060', 5), { depth: 2.2, rim: 1 });
    stg.set(35, 18, '#3a2020'); stg.set(35, 17, '#5a3020'); stg.set(36, 10, WHITE);
    put(p, stg, 'dark');
    // gloss
    for (const [x, y] of [[18, 29], [19, 29], [7, 17], [36, 17], [22, 21]]) p.set(x, y, sh[5]);
    return finish(p);
  };

  // Ghost: a wailing spectre in a tattered shroud, limp hands drooping, tail curling away.
  S.ghost = () => {
    const W = 48, H = 48;
    const sh = ramp('#a8baf0', 6, { dark: 0.62, shift: 14 });
    const p = G().pix(W, H);
    // arms held out, hands hanging limp at the wrist
    const am = mask(W, H);
    both(W, (X) => {
      tube(am, [[X(16), 23], [X(10), 22], [X(6.5), 18]], 3, 1.8, 1);
      capsule(am, X(6.5), 18, X(5), 23.5, 2.2, 1.8, 1);
    });
    const arms = shade(am, sh, { depth: 2.5, bias: -0.04, rim: 1 });
    both(W, (X) => { arms.line(X(12), 22, X(8), 20, sh[2]); });
    put(p, arms);
    // fingers
    const fg = G().pix(W, H);
    both(W, (X) => {
      for (let i = 0; i < 3; i++) { fg.vline(X(3.5 + i * 1.5), 24, 26 - (i === 1 ? 0 : 1) + 1, i === 0 ? sh[3] : sh[2]); }
    });
    put(p, fg, 'dark');
    // shroud: hooded head flowing into a tail that curls away
    const m = mask(W, H);
    m.ellipse(24, 15, 10.5, 10.5, 1);
    tube(m, [[24, 20], [23, 36], [37, 42]], 10.5, 1.4, 1, 24);
    tube(m, [[37, 42], [42, 43], [43, 38]], 1.5, 0.5, 1);
    // tattered hem: notches cut into the lower edge
    for (const [x, y, r] of [[13, 33, 2.4], [17.5, 37.5, 2.2], [24, 40.5, 2], [29.5, 40, 1.6]]) m.ellipse(x, y, r, r * 1.35, null);
    const body = shade(m, sh, { depth: 5, normal: sphereN(22, 16, 13, 17), blend: 0.4, rim: 1, global: 0.3 });
    // fold lines in the cloth
    for (const [x0, y0, x1, y1] of [[17, 25, 15, 30], [22, 27, 21, 34], [28, 25, 29, 33], [30, 36, 35, 40]]) body.line(x0, y0, x1, y1, sh[2]);
    for (const [x0, y0, x1, y1] of [[18, 25, 16, 30], [23, 27, 22, 34], [29, 25, 30, 32]]) body.line(x0, y0, x1, y1, sh[4]);
    put(p, body, 'dark');
    // hood rim and the dark hollow where a face should be
    const fm = mask(W, H);
    fm.ellipse(24, 16, 7.4, 7.8, 1);
    fm.each((x, y) => { p.set(x, y, y < 11 ? sh[1] : sh[0]); });
    const hollow = G().pix(W, H);
    hollow.ellipse(24, 16.8, 6.2, 6.5, '#1a1430');
    for (let x = 17; x <= 31; x++) { hollow.set(x, 10, null); hollow.set(x, 11, null); }
    hollow.ellipse(24, 16.5, 6.3, 5.4, '#1a1430');
    put(p, hollow);
    // glowing eyes and a wailing mouth
    both(W, (X) => {
      p.set(X(20), 15, '#ffe8a0'); p.set(X(21), 15, '#fffbe8'); p.set(X(20), 16, '#ffc860'); p.set(X(21), 16, '#ffe8a0');
      p.set(X(19), 14, '#4a3a70'); p.set(X(22), 17, '#4a3a70');
    });
    stamp(p, 22, 19, ['.oo.', 'oxxo', 'oxxo', '.oo.'], { o: '#4a3a70', x: '#000000' });
    // the hood's lit brim
    for (let x = 19; x <= 29; x++) if (p.get(x, 8) != null) p.set(x, 8, sh[5]);
    return finish(p, { float: true });
  };

  // Mummy: a hunched, bandage-wrapped corpse clawing forward, one eye burning in the wraps.
  S.mummy = () => {
    const W = 48, H = 48;
    const wrap = ramp('#dccb9c', 5, { dark: 0.6, shift: 28 }), gap = '#34243a';
    const p = G().pix(W, H);
    // overlapping bandage layers: a dark seam, then a lit edge, every `step` px across `dir`
    const wraps = (pp, mk, dir, step, off) => mk.each((x, y) => {
      const t = x * dir[0] + y * dir[1] + off, ph = ((t % step) + step) % step;
      const c = pp.get(x, y), i = wrap.indexOf(c);
      if (ph < 1) pp.set(x, y, wrap[Math.max(0, i - 2)]);
      else if (ph < 2) pp.set(x, y, wrap[Math.min(wrap.length - 1, i + 1)]);
    });
    // hanging arm (behind the torso edge)
    const ha = mask(W, H);
    capsule(ha, 31.5, 21, 35, 29, 3, 2.7, 1); capsule(ha, 35, 29, 36, 36, 2.7, 2.4, 1);
    ha.ellipse(36.5, 37.5, 2.6, 2.4, 1);
    const harm = shade(ha, wrap, { depth: 2.5, rim: 1, bias: -0.06 });
    wraps(harm, ha, [0.35, 1], 3.5, 0);
    put(p, harm);
    for (const [x, y] of [[35, 40], [37, 40], [38, 39]]) p.set(x, y, gap);
    // legs
    const lm = mask(W, H);
    capsule(lm, 20, 36, 19, 44.5, 3, 2.6, 1); capsule(lm, 28, 36, 29.5, 44.5, 3, 2.6, 1);
    lm.ellipse(18, 45.5, 3.4, 1.6, 1); lm.ellipse(30.5, 45.5, 3.4, 1.6, 1);
    const legs = shade(lm, wrap, { depth: 2.5, rim: 1 });
    wraps(legs, lm, [-0.3, 1], 3.5, 1);
    put(p, legs);
    // torso
    const tm = mask(W, H);
    tm.ellipse(24, 28, 8.4, 9.6, 1);
    capsule(tm, 23, 16, 24, 20, 3.4, 4, 1);
    const torso = shade(tm, wrap, { depth: 4.5, normal: sphereN(22, 25, 11, 13), blend: 0.45, rim: 1 });
    wraps(torso, tm, [0.3, 1], 4, 0);
    put(p, torso, 'dark');
    // gaps in the wrappings, withered dark beneath
    for (const [x, y, w] of [[19, 27, 3], [27, 31, 2], [22, 35, 2], [26, 23, 2]]) p.hline(x, x + w, y, gap);
    // scarab amulet
    put(p, part(W, H, (g) => g.ellipse(24, 24, 2.4, 2, 1), ramp('#2ab0a0', 4), { depth: 1.5 }), INK);
    p.set(23, 23, WHITE); p.hline(21, 27, 21, '#b08a30'); p.set(21, 22, '#b08a30'); p.set(27, 22, '#b08a30');
    // raised clawing arm
    const ra = mask(W, H);
    capsule(ra, 16.5, 21, 10.5, 17, 3, 2.7, 1); capsule(ra, 10.5, 17, 7.5, 10.5, 2.7, 2.4, 1);
    ra.ellipse(7, 8.5, 2.8, 2.5, 1);
    const rarm = shade(ra, wrap, { depth: 2.5, rim: 1 });
    wraps(rarm, ra, [1, 0.45], 3.5, 0);
    put(p, rarm, 'dark');
    // withered fingers, dark-tipped
    const fg = mask(W, H);
    for (const [x0, y0, x1, y1] of [[5, 7, 3.5, 3], [7, 6.5, 7, 2], [9, 7, 10.5, 3], [5, 9.5, 2.5, 10.5]]) capsule(fg, x0, y0, x1, y1, 0.9, 0.6, 1);
    const fingers = shade(fg, wrap, { depth: 1, bias: -0.05 });
    for (const [x, y] of [[3, 3], [7, 2], [10, 3], [2, 10]]) fingers.set(x, y, gap);
    put(p, fingers, 'dark');
    // head, tilted forward
    const hm = mask(W, H);
    hm.ellipse(22.5, 12, 6.2, 6.4, 1);
    const head = shade(hm, wrap, { depth: 3.5, normal: sphereN(21, 11, 7, 8), blend: 0.45, rim: 1 });
    wraps(head, hm, [-0.25, 1], 3, 0.5);
    put(p, head, 'dark');
    // loose trailing strips
    const ls = mask(W, H);
    tube(ls, [[26.5, 13], [29, 17], [28, 22]], 1.1, 0.8, 1);
    tube(ls, [[9.5, 15], [12, 20], [10, 24]], 1, 0.7, 1);
    tube(ls, [[36, 31], [40, 34], [39, 39]], 1, 0.7, 1);
    tube(ls, [[21, 37], [17.5, 40], [18.5, 43]], 1, 0.7, 1);
    put(p, shade(ls, wrap, { depth: 1, bias: 0.05 }), 'dark');
    // face: a slit through the wraps, one burning eye, the other lost in shadow
    p.hline(17, 27, 11, gap); p.hline(18, 26, 12, gap); p.set(17, 12, wrap[0]);
    p.set(19, 11, '#ffb040'); p.set(20, 11, '#fff8d0'); p.set(19, 12, '#ff7a20'); p.set(20, 12, '#ffd060'); p.set(18, 12, '#b03010'); p.set(21, 12, '#b03010'); p.set(18, 11, '#b03010'); p.set(21, 11, '#e05a20');
    p.set(24, 12, '#5a3a3a');
    p.hline(20, 23, 15, gap); p.set(24, 16, gap);
    return finish(p, { center: true });
  };

  // ------------------------------------------------------------ registry
  const SIZES = {
    jelly: 32, bat: 32, rat: 32, mushroom: 32, bee: 32, wisp: 32, imp: 32, mimic: 32, eyeball: 32,
    goblin: 48, snake: 48, wolf: 48, plant: 48, skeleton: 48, ghost: 48, lizardman: 48, scorpion: 48, mummy: 48,
  };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.monstersA = { ids: Object.keys(SIZES), sizes: SIZES };
  // shared helpers (other art modules may reuse them at runtime)
  A.MonTK = { ramp, darken, mask, capsule, tube, arc, shade, light, bevel, smooth, sphereN, part, put, clip, bump, stamp, finish, OUT, INK, WHITE };
})(window.RPG);
