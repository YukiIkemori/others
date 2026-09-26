// Party battle sprites (Part A8, DESIGN §11.4.4) — the pixel renderer.
// A frame is built pre-flip, FACING RIGHT (so the field `right` head parts can be
// used as they are), on a 48×40 buffer, then outlined and mirrored to face left.
//
// Every body part is a mask (a set of pixels) painted with a 4-step tone ramp
// [deep, dark, mid, light] of one outfit material. Shading is automatic per part:
// the edge towards the light (pre-flip: up / right = the face side, after the
// flip: upper-left) gets the light step, the edge away from it the dark step,
// small corners the deep step. Parts that are further from the viewer (the far
// arm and far leg) are one step darker, and a part laid over another casts a 1px
// shadow on it. The head is the field head stamped 1:1 (colours, not tones).
// No semi-transparent pixels, no anti-aliasing; a 1px outline goes around the
// finished silhouette only.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const BT = (A._Battlers = A._Battlers || {});
  const W = 48, H = 40;
  BT.W = W; BT.H = H;

  // ------------------------------------------------------------------ buffers
  /** frame buffer: per pixel either a tone ramp + index, or a direct colour */
  function Buf() {
    return { tn: new Array(W * H).fill(null), ti: new Int8Array(W * H), col: new Array(W * H).fill(null), body: new Uint8Array(W * H) };
  }
  BT.Buf = Buf;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const filled = (b, i) => b.tn[i] !== null || b.col[i] !== null;
  BT.filled = filled;
  function colorAt(b, i) { return b.tn[i] ? b.tn[i][b.ti[i]] : b.col[i]; }
  BT.colorAt = colorAt;

  /** a mask is a Uint8Array(W*H) */
  const Mask = () => new Uint8Array(W * H);
  BT.Mask = Mask;
  function mset(m, x, y) { x = Math.round(x); y = Math.round(y); if (inb(x, y)) m[y * W + x] = 1; }
  BT.mset = mset;
  function mrect(m, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mset(m, x + i, y + j); return m; }
  BT.mrect = mrect;
  // brushes by thickness (pixel offsets). 2px picks the pair across the stroke.
  const BR = {
    1: [[0, 0]],
    3: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
    4: [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [-1, 1], [0, -1], [1, -1], [2, 0], [2, 1], [0, 2], [1, 2]],
  };
  /** thick line (a limb) */
  function mline(m, x0, y0, x1, y1, t) {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
    let br = BR[t] || BR[1];
    if (t === 2) br = Math.abs(dy) >= Math.abs(dx) ? [[0, 0], [1, 0]] : [[0, 0], [0, 1]];
    if (t === 2.5) br = Math.abs(dy) >= Math.abs(dx) ? [[0, 0], [1, 0], [-1, 0]] : [[0, 0], [0, 1], [0, -1]];
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (dx * i) / n), y = Math.round(y0 + (dy * i) / n);
      for (const [a, b] of br) mset(m, x + a, y + b);
    }
    return m;
  }
  BT.mline = mline;
  /** filled polygon (pixel centres inside, edges inclusive) */
  function mpoly(m, pts) {
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[1] === b[1]) { if (a[1] === y) { xs.push(Math.min(a[0], b[0]), Math.max(a[0], b[0])); } continue; }
        const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        if (y < lo || y > hi) continue;
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      if (xs.length < 2) continue;
      const lo = Math.round(Math.min(...xs)), hi = Math.round(Math.max(...xs));
      for (let x = lo; x <= hi; x++) mset(m, x, y);
    }
    return m;
  }
  BT.mpoly = mpoly;
  function mellipse(m, cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) mset(m, x, y);
      }
    return m;
  }
  BT.mellipse = mellipse;
  function mcount(m) { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; }
  BT.mcount = mcount;
  /** m minus o */
  function msub(m, o) { for (let i = 0; i < m.length; i++) if (o[i]) m[i] = 0; return m; }
  BT.msub = msub;
  function mand(m, o) { const r = Mask(); for (let i = 0; i < m.length; i++) r[i] = m[i] && o[i] ? 1 : 0; return r; }
  BT.mand = mand;

  /**
   * Paint a part.
   *   tones: [deep, dark, mid, light]
   *   o.shift  add to every step (far parts −1)
   *   o.flat   fixed step for every pixel
   *   o.cast   the part casts a 1px shadow (down-left pre-flip) on what is under it
   *   o.rim    light only on the right edge (not the top): long garments
   *   o.body   counts as body (box / anchors); weapons pass false
   *   o.shade2 two-pixel dark band on the shadow side (wide parts)
   */
  function paint(b, m, tones, o) {
    o = o || {};
    const at = (x, y) => inb(x, y) && m[y * W + x];
    const px = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      let k;
      if (o.flat != null) k = o.flat;
      else {
        const oR = !at(x + 1, y), oU = !at(x, y - 1), oL = !at(x - 1, y), oD = !at(x, y + 1);
        const lit = oR || (oU && !o.rim), dark = oL || oD || (o.shade2 && !at(x - 2, y));
        k = 2;
        if (dark && !lit) k = 1;
        else if (lit && !dark) k = 3;
        else if (lit && dark) k = oL && oD ? 1 : 2;
        if (oL && oD && !oR) k = 0;
        if (o.band && o.band(x, y)) k = Math.min(k, 1);
      }
      k = Math.max(0, Math.min(3, k + (o.shift || 0)));
      px.push([x, y, k]);
    }
    if (o.inner) {
      // a dark contour where the part lies over something already drawn (arm over chest…)
      for (const q of px) {
        const [x, y] = q;
        for (const [dx, dy] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (!inb(X, Y) || at(X, Y) || !filled(b, Y * W + X)) continue;
          if (dy === -1 && o.inner !== 'all') continue;
          q[2] = 0; break;
        }
      }
    }
    if (o.cast) {
      for (const [x, y] of px) {
        const sx = x - 1, sy = y + 1, j = sy * W + sx;
        if (!inb(sx, sy) || at(sx, sy) || !b.tn[j]) continue;
        b.ti[j] = Math.max(0, Math.min(b.ti[j], 1));
      }
    }
    for (const [x, y, k] of px) {
      const i = y * W + x;
      b.tn[i] = tones; b.ti[i] = k; b.col[i] = null;
      b.body[i] = o.body === false ? 0 : 1;
    }
  }
  BT.paint = paint;
  /** set single pixels to a tone step of a ramp (details: belts, buttons, eyes of a buckle) */
  function dot(b, x, y, tones, k, body) {
    x = Math.round(x); y = Math.round(y);
    if (!inb(x, y)) return;
    const i = y * W + x;
    b.tn[i] = tones; b.ti[i] = k; b.col[i] = null; b.body[i] = body === false ? 0 : 1;
  }
  BT.dot = dot;
  /** recolour already-painted pixels inside mask m to another ramp keeping their step */
  function retone(b, m, tones, kmap) {
    for (let i = 0; i < m.length; i++) if (m[i] && b.tn[i]) { b.tn[i] = tones; if (kmap) b.ti[i] = kmap(b.ti[i]); }
  }
  BT.retone = retone;
  /** stamp a colour buffer (w×h, null = clear) at ox, oy; rot: 0 or 1 (90° counter-clockwise) */
  function stampCols(b, src, w, h, ox, oy, body) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (!c) continue;
      const X = ox + x, Y = oy + y;
      if (!inb(X, Y)) continue;
      const i = Y * W + X;
      b.tn[i] = null; b.col[i] = c; b.body[i] = body === false ? 0 : 1;
    }
  }
  BT.stampCols = stampCols;

  /** final pixels: colours, outline (4-neighbour), mirrored → {px: colour[], body: Uint8Array} */
  function finish(b, outlineCol) {
    const src = new Array(W * H).fill(null);
    for (let i = 0; i < W * H; i++) src[i] = colorAt(b, i);
    const out = src.slice(), body = b.body.slice();
    const at = (x, y) => inb(x, y) && src[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (src[i]) continue;
      const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, c]) => at(a, c));
      if (!n.length) continue;
      out[i] = outlineCol;
      body[i] = n.some(([a, c]) => b.body[c * W + a]) ? 1 : 0;
    }
    // a colour pixel on the canvas edge becomes the outline (no room for it)
    for (let x = 0; x < W; x++) { if (out[x]) out[x] = outlineCol; if (out[(H - 1) * W + x] && !src[(H - 2) * W + x]) out[(H - 1) * W + x] = outlineCol; }
    for (let y = 0; y < H; y++) { if (out[y * W]) out[y * W] = outlineCol; if (out[y * W + W - 1]) out[y * W + W - 1] = outlineCol; }
    // mirror (face left)
    const px = new Array(W * H).fill(null), bm = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { px[y * W + (W - 1 - x)] = out[y * W + x]; bm[y * W + (W - 1 - x)] = body[y * W + x]; }
    return { px, body: bm };
  }
  BT.finish = finish;

  // ------------------------------------------------------------------ geometry
  /** 2-bone IK: joint between a and c with limb lengths l1, l2; bend = +1 / −1 (side of the a→c line) */
  function ik(a, c, l1, l2, bend) {
    const dx = c[0] - a[0], dy = c[1] - a[1];
    const d = Math.max(0.001, Math.hypot(dx, dy));
    if (d >= l1 + l2 - 0.01) return [a[0] + (dx * l1) / (l1 + l2), a[1] + (dy * l1) / (l1 + l2)];
    const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const ux = dx / d, uy = dy / d;
    return [a[0] + ux * x - uy * h * bend, a[1] + uy * x + ux * h * bend];
  }
  BT.ik = ik;
  const rnd = (p) => [Math.round(p[0]), Math.round(p[1])];
  BT.rnd = rnd;
})(window.RPG);
