// Monster parts, head and face (A14a mons-parts, DESIGN §9.4.4): horns crown tiara helm hood hat halo
// bandana flower beard eyepatch monocle goggles eyes_glow eye3 mask ribbon.
// Every part is R.Art.PARTS[id] = (pix, anchor, opts) => void and draws its solid pixels into `pix`
// (they get the inner contour and the outline) and glints / glow into opts.fx (never outlined).
// opts: c c2 gem size style len (§9.4.4) plus, from R.Art.compose: k (1 / 1.5 / 2 for s / m / l),
// base (the recoloured base Pix), info (its silhouette), anchors (all anchors of the base), rng, eraseAt.
// Headwear grows upward from the `head` anchor (the rim line) and is sized to anchors.headW; when the
// canvas has no room above, the piece sits lower on the head instead of being cut off (§9.4.3 step 5).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const PARTS = (A.PARTS = A.PARTS || {});
  const TK = () => A.PartTK;

  // ---------------------------------------------------------------- shared helpers
  const odd = (v) => (v % 2 ? v : v + 1);
  /** paint mask m into p with a ramp by column (cylinder lit from the left) plus a vertical term */
  function cylFill(p, m, rmp, o) {
    const T = TK(), b = T.bboxOf(m);
    if (!b) return;
    o = o || {};
    const n = rmp.length;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (m.get(x, y) == null) continue;
      const t = (x - b.x0) / Math.max(1, b.x1 - b.x0);
      let k = T.cyl(t, n);
      if (o.top && y === b.y0) k = Math.min(n - 1, k + 1);
      if (o.bottom && y === b.y1) k = Math.max(0, k - 1);
      if (o.vert) k = T.clamp(k + Math.round(o.vert * (0.5 - (y - b.y0) / Math.max(1, b.y1 - b.y0))), 0, n - 1);
      p.set(x, y, rmp[k]);
    }
  }
  /** shaded blob (sphere-ish light from the top-left) */
  function blob(p, m, rmp, depth, o) {
    const T = TK();
    p.blit(T.shade(m, rmp, Object.assign({ depth: depth || 2 }, o || {})), 0, 0);
  }
  /** gem: 1 px (tiny), 2×2 or 3×3 with a glint */
  function gem(p, fx, x, y, col, k) {
    const T = TK(), g = T.ramp(col, 4, { dark: 0.55, light: 0.7 });
    x = Math.round(x); y = Math.round(y);
    if (k < 1.3) { p.set(x, y, g[2]); fx.set(x, y, g[2]); return; }
    if (k < 1.8) {
      p.set(x, y, g[2]); p.set(x + 1, y, g[1]); p.set(x, y + 1, g[1]); p.set(x + 1, y + 1, g[0]);
      fx.set(x, y, '#ffffff'); return;
    }
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) p.set(x + i, y + j, i + j < 0 ? g[2] : i + j > 0 ? g[0] : g[1]);
    fx.set(x - 1, y - 1, '#ffffff'); fx.set(x, y - 1, g[3]);
  }
  /** top of the base silhouette near column x (search a few columns), or fallback */
  function topNear(info, x, fb) {
    let best = -1;
    for (let d = 0; d <= 2; d++) for (const s of [x - d, x + d]) {
      if (s < 0 || s >= info.w || info.top[s] < 0) continue;
      if (best < 0 || info.top[s] < best) best = info.top[s];
    }
    return best < 0 ? fb : best;
  }
  const headW = (o) => (o.anchors && o.anchors.headW) || Math.round(10 * o.baseK);
  /** vertical room: move a piece of height h down so its top stays at y >= 0 */
  const fitTop = (rim, h) => Math.max(rim, h - 1);
  /** a piece h tall above rim: squash it (down to 65 %) before it has to sit lower on the head */
  const squash = (rim, h) => Math.min(h, Math.max(Math.round(h * 0.65), rim + 1));

  // ---------------------------------------------------------------- horns 角 (brow)
  PARTS.horns = (p, a, o) => {
    const T = TK();
    const k = o.baseK, len = { s: 0.75, m: 1, l: 1.35 }[o.len || 'm'];
    const hw = headW(o);
    const c = o.c || '#e8e0d0', rmp = T.ramp(c, 5, { dark: 0.6, light: 0.6 });
    const spread = Math.max(2, Math.round(hw * 0.32));
    const L = Math.round((4 + 4 * k) * len);
    const r0 = k < 1.3 ? 1.1 : k < 1.8 ? 1.5 : 2;
    const top = o.anchors.head ? o.anchors.head[1] : a[1] - 4;
    const baseY = Math.min(a[1], top + Math.round(2 * k));
    const m = T.mask(p.w, p.h);
    for (const s of [-1, 1]) {
      const x0 = a[0] + s * spread, y0 = baseY;
      // curve outward, then up (a crescent), the tip turning slightly inward for long horns
      const cx = x0 + s * Math.round(L * 0.55), cy = y0 - Math.round(L * 0.15);
      const tx = x0 + s * Math.round(L * (len > 1.2 ? 0.55 : 0.7)), ty = Math.max(0, y0 - Math.round(L * 0.85));
      T.tube(m, [[x0, y0], [cx, cy], [tx, ty]], r0, 0.35, 1, 18);
    }
    blob(p, m, rmp, 1.6, { light: [-0.5, -0.8, 0.5] });
    // ring grooves near the root
    const b = T.bboxOf(m);
    if (b && k >= 1.3) for (const s of [-1, 1]) {
      const x0 = a[0] + s * spread;
      for (let j = 1; j <= 2; j++) { const yy = baseY - j * 2; for (let d = -1; d <= 1; d++) if (m.get(x0 + s * (j + d * 0), yy + d) != null) p.set(x0 + s * j, yy, rmp[1]); }
    }
  };

  // ---------------------------------------------------------------- crown 冠 (head)
  function crownPlain(p, a, o, T) {
    const k = o.baseK, hw = headW(o);
    const w = odd(T.clamp(Math.round(hw * 0.8), 7, 19));
    const n = w >= 13 ? 5 : 3;
    const band = k < 1.3 ? 2 : 3;
    let prong = squash(a[1] - band - 1, k < 1.3 ? 3 : k < 1.8 ? 5 : 7);
    // head top at y 0–2 on the canvas (Crest bases like demon / orc): shorten the prongs so the crown
    // still sits on the head from the brow line up, instead of being pushed down over the face (A14b.0)
    if (band + prong + 1 > a[1] + 1 && a[1] - band >= 2) prong = a[1] - band;
    const H = band + prong + 1;
    const rim = fitTop(a[1], H);
    const x0 = a[0] - (w - 1) / 2, x1 = x0 + w - 1, yBand = rim - band + 1;
    const rmp = T.metal(o.c || '#e0c050', 5);
    const col = (x) => T.cyl((x - x0) / Math.max(1, w - 1), 5);
    // band
    for (let y = yBand; y <= rim; y++) for (let x = x0; x <= x1; x++) p.set(x, y, rmp[T.clamp(col(x) + (y === yBand ? 1 : y === rim ? -1 : 0), 0, 4)]);
    // prongs: narrow spikes widening toward the band, the middle one a step taller, balls on the tips
    const spread = k < 1.3 ? 0.34 : k < 1.8 ? 0.42 : 0.5;
    for (let i = 0; i < n; i++) {
      const tx = Math.round(x0 + (i * (w - 1)) / (n - 1));
      const mid = i === (n - 1) / 2, edge = i === 0 || i === n - 1;
      const h = prong + (mid ? 1 : 0) - (edge && n === 5 ? 1 : 0);
      for (let j = 0; j < h; j++) {
        const y = yBand - h + j, hwid = Math.floor(j * spread);
        for (let d = -hwid; d <= hwid; d++) {
          const x = tx + d;
          if (x < x0 || x > x1) continue;
          p.set(x, y, rmp[T.clamp(col(x) + (d === -hwid ? 1 : d === hwid && hwid > 0 ? -1 : 0), 0, 4)]);
        }
      }
      const ty = yBand - h - 1;
      if (k >= 1.3) { p.set(tx, ty, rmp[3]); o.fx.set(tx, ty, rmp[4]); if (k >= 1.8) { p.set(tx + 1, ty, rmp[2]); p.set(tx, ty - 1, rmp[3]); p.set(tx + 1, ty - 1, rmp[3]); o.fx.set(tx, ty - 1, '#ffffff'); } }
      else o.fx.set(tx, yBand - h, rmp[4]);
    }
    // jewels: the main gem in the middle of the band, small ones to the sides
    const g = T.ramp(o.gem || '#d03048', 4, { dark: 0.5, light: 0.7 });
    const gy = k < 1.3 ? yBand : yBand + 1;
    if (k < 1.3) { p.set(a[0], gy, g[2]); p.set(a[0], gy + 1, g[1]); o.fx.set(a[0], gy, g[3]); }
    else gem(p, o.fx, a[0] - (k < 1.8 ? 0 : 0), gy, o.gem || '#d03048', Math.min(k, 1.5));
    if (w >= 11) for (const s2 of [-1, 1]) { const gx = Math.round(a[0] + s2 * (w - 1) * 0.33); p.set(gx, gy, g[2]); if (k >= 1.8) p.set(gx, gy + 1, g[1]); }
  }
  function crownLeaf(p, a, o, T) {
    const k = o.baseK, hw = headW(o);
    const w = T.clamp(Math.round(hw * 0.95), 8, 24);
    const rim = fitTop(a[1], Math.round(3 + 3 * k));
    const rmp = T.ramp(o.c || '#78c050', 5, { dark: 0.6, light: 0.55 });
    const n = Math.max(4, Math.round(w / (1.6 + k)));
    const m = T.mask(p.w, p.h);
    // a twig band with leaves fanning up and out
    for (let x = Math.round(a[0] - w / 2); x <= Math.round(a[0] + w / 2); x++) m.set(x, rim, 1);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = a[0] - w / 2 + t * w;
      const ang = -Math.PI / 2 + (t - 0.5) * 1.8, L = (2 + 2.2 * k) * (1 - Math.abs(t - 0.5) * 0.5);
      T.capsule(m, x, rim, x + Math.cos(ang) * L, rim + Math.sin(ang) * L, 0.9 * k, 0.3, 1);
    }
    blob(p, m, rmp, 1.5, { bias: 0.12 });
    // a twisted golden twig band, leaf veins, and red berries between the leaves
    const tw = T.metal('#c8a040', 4);
    for (let x = Math.round(a[0] - w / 2); x <= Math.round(a[0] + w / 2); x++) p.set(x, rim, tw[(x & 1) + 1]);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = Math.round(a[0] - w / 2 + t * w);
      p.set(x, rim - 1, rmp[1]);
      if (i % 2 === 1) { p.set(x, rim - 1, '#c83838'); o.fx.set(x, rim - 1, '#ff7070'); if (k >= 1.5) p.set(x + 1, rim - 1, '#901828'); }
    }
  }
  function crownNemes(p, a, o, T) {
    const k = o.baseK, hw = headW(o), an = o.anchors;
    const gold = T.metal(o.c || '#f0c040', 5), blue = T.ramp(o.c2 || '#2c4c98', 4, { dark: 0.55, light: 0.4 });
    const rx = Math.round(hw / 2 + 1), rim = a[1];
    const capH = Math.min(rim, Math.round(hw * 0.45));
    const neckY = Math.max(rim + Math.round(4 * k), (an.neck ? an.neck[1] : rim + 8 * k) - 1);
    const m = T.mask(p.w, p.h);
    // headcloth: a dome over the head and two lappets flaring down beside the face
    m.ellipse(a[0], rim, rx, capH, 1);
    for (let y = rim - capH; y < rim; y++) for (let x = a[0] - rx; x <= a[0] + rx; x++) if (m.get(x, y) == null && Math.abs(x - a[0]) <= rx && y >= rim - 1) m.set(x, y, 1);
    for (const s of [-1, 1]) {
      const xin = a[0] + s * (rx - Math.round(1.5 * k)), xout = a[0] + s * (rx + Math.round(1 * k));
      for (let y = rim; y <= neckY; y++) {
        const t = (y - rim) / Math.max(1, neckY - rim);
        const outer = Math.round(xout + s * t * 2 * k), inner = Math.round(xin + s * t * 0.5 * k);
        for (let x = Math.min(inner, outer); x <= Math.max(inner, outer); x++) m.set(x, y, 1);
      }
    }
    // clear the face opening between the lappets below the brow
    const b = T.bboxOf(m);
    for (let y = rim; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (m.get(x, y) == null) continue;
      if (Math.abs(x - a[0]) < rx - Math.round(1.5 * k) - (y > rim + 1 ? 0 : 99)) m.set(x, y, null);
    }
    // stripes: gold and blue every other band (vertical rhythm on the lappets, radial on the dome)
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      if (m.get(x, y) == null) continue;
      const t = (x - b.x0) / Math.max(1, b.x1 - b.x0);
      const onCap = y < rim;
      const stripe = onCap ? Math.floor((x - a[0] + 100) / Math.max(2, Math.round(1.5 * k))) % 2 : Math.floor((y - rim) / Math.max(1, Math.round(1.5 * k))) % 2;
      const r = stripe ? blue : gold;
      p.set(x, y, r[T.clamp(T.cyl(t, r.length) - (onCap ? 0 : 0), 0, r.length - 1)]);
    }
    // gold brow band and the cobra jewel at the front
    for (let x = a[0] - rx; x <= a[0] + rx; x++) if (m.get(x, rim - 1) != null || m.get(x, rim) != null) p.set(x, rim - 1, gold[3]);
    gem(p, o.fx, a[0], rim - Math.round(1.5 * k), o.gem || '#30c0a0', k);
    p.set(a[0], rim - Math.round(1.5 * k) - (k >= 1.8 ? 2 : 1), gold[4]);
  }
  function crownIce(p, a, o, T) {
    const k = o.baseK, hw = headW(o);
    const rmp = T.ramp(o.c || '#b0e8ff', 5, { dark: 0.45, light: 0.8 });
    const H = squash(a[1], Math.round(k < 1.3 ? 6 : k < 1.8 ? 9 : 12));
    const rim = fitTop(a[1], H), w = T.clamp(Math.round(hw * 0.9), 7, 20);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = Math.round(a[0] - w / 2 + t * w);
      const h = Math.round(H * (i === 2 ? 1 : i % 2 ? 0.72 : 0.5));
      const ang = (t - 0.5) * 0.6;
      const tx = x + Math.round(Math.sin(ang) * h), ty = rim - h + 1;
      const m = T.mask(p.w, p.h);
      const hwid = k < 1.3 ? 1 : k < 1.8 ? 1.5 : 2;
      // an elongated diamond shard: light left face, dark right face, white edge
      for (let j = 0; j <= h; j++) {
        const u = j / h, cx = x + (tx - x) * u, y = Math.round(rim - (rim - ty) * u);
        const wd = u < 0.3 ? hwid * (0.6 + u * 1.3) : hwid * (1 - (u - 0.3) / 0.7);
        for (let d = -Math.round(wd); d <= Math.round(wd); d++) m.set(Math.round(cx + d), y, d < 0 ? 2 : d > 0 ? 3 : 4);
      }
      m.each((xx, yy, c) => { p.set(xx, yy, c === 2 ? rmp[3] : c === 3 ? rmp[1] : rmp[2]); return undefined; });
      o.fx.set(tx, ty, '#ffffff');
      if (h > 4) o.fx.set(Math.round(x + (tx - x) * 0.4) - 1, Math.round(rim - (rim - ty) * 0.4), rmp[4]);
    }
    for (let x = Math.round(a[0] - w / 2) - 1; x <= Math.round(a[0] + w / 2) + 1; x++) p.set(x, rim, rmp[2]);
    for (let x = Math.round(a[0] - w / 2); x <= Math.round(a[0] + w / 2); x += 2) p.set(x, rim, rmp[4]);
  }
  function crownFeather(p, a, o, T) {
    const k = o.baseK, hw = headW(o);
    const fr = T.ramp(o.c || '#e0a040', 5, { dark: 0.6, light: 0.6 });
    const bandR = T.ramp(o.c2 || '#a03020', 4, { dark: 0.55, light: 0.45 });
    const H = squash(a[1], Math.round(k < 1.3 ? 7 : k < 1.8 ? 10 : 13));
    const rim = fitTop(a[1], H), w = T.clamp(Math.round(hw * 0.9), 8, 22);
    const n = w >= 12 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const x0 = Math.round(a[0] - w * 0.35 + t * w * 0.7);
      const ang = -Math.PI / 2 + (t - 0.5) * 1.1;
      const L = H * (i === (n - 1) / 2 ? 1 : 0.82) - 1;
      const x1 = x0 + Math.cos(ang) * L, y1 = rim + Math.sin(ang) * L;
      const m = T.mask(p.w, p.h);
      T.capsule(m, x0, rim - 1, (x0 + x1) / 2, (rim + y1) / 2, 0.6 * k, 1.1 * k, 1);
      T.capsule(m, (x0 + x1) / 2, (rim + y1) / 2, x1, y1, 1.1 * k, 0.4, 1);
      blob(p, m, fr, 1.4);
      // dark tip and the quill line
      T.line(p, x0, rim - 1, Math.round(x1), Math.round(y1), (xx, yy) => (Math.hypot(xx - x1, yy - y1) < 1.6 * k ? '#302018' : fr[4]));
    }
    for (let x = Math.round(a[0] - w / 2); x <= Math.round(a[0] + w / 2); x++) {
      const t = (x - (a[0] - w / 2)) / w;
      p.set(x, rim, bandR[T.cyl(t, 4)]);
      if (k >= 1.3) p.set(x, rim - 1, bandR[Math.min(3, T.cyl(t, 4) + 1)]);
      if ((x - a[0]) % 3 === 0) p.set(x, rim, '#f0e0a0');
    }
  }
  function crownBarnacle(p, a, o, T) {
    const k = o.baseK, hw = headW(o);
    const rmp = T.ramp(o.c || '#c0c0a0', 5, { dark: 0.6, light: 0.55 });
    const rim = fitTop(a[1], Math.round(4 * k) + 1), w = T.clamp(Math.round(hw * 0.95), 8, 24);
    const n = Math.max(4, Math.round(w / (2.2 * k)));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = Math.round(a[0] - w / 2 + t * w);
      const h = Math.round((2 + 2 * k) * (0.7 + 0.3 * Math.sin(i * 2.3))), bw = Math.round(1 + k);
      const y0 = rim + Math.round(Math.abs(t - 0.5) * 2 * k);
      const m = T.mask(p.w, p.h);
      m.poly([[x - bw, y0 + 1], [x + bw + 1, y0 + 1], [x + Math.round(bw * 0.5) + 1, y0 - h], [x - Math.round(bw * 0.5), y0 - h]], 1);
      blob(p, m, rmp, 1.2);
      p.set(x, y0 - h + 1, '#302820'); if (k >= 1.5) p.set(x + 1, y0 - h + 1, '#403428');
      p.set(x - bw + 1, y0, rmp[1]);
    }
  }
  PARTS.crown = (p, a, o) => {
    const T = TK();
    const st = o.style;
    if (st === 'leaf') return crownLeaf(p, a, o, T);
    if (st === 'nemes') return crownNemes(p, a, o, T);
    if (st === 'ice') return crownIce(p, a, o, T);
    if (st === 'feather') return crownFeather(p, a, o, T);
    if (st === 'barnacle') return crownBarnacle(p, a, o, T);
    return crownPlain(p, a, o, T);
  };

  // ---------------------------------------------------------------- tiara 小冠 (head)
  PARTS.tiara = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o);
    const rmp = T.metal(o.c || '#ffe070', 5);
    const w = T.clamp(Math.round(hw * 0.7), 6, 16);
    const rim = fitTop(a[1], Math.round(3 + 2 * k));
    const x0 = Math.round(a[0] - w / 2), x1 = Math.round(a[0] + w / 2);
    // a thin arched band
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0), arch = Math.round(Math.sin(t * Math.PI) * (k >= 1.5 ? 1.2 : 0.7));
      p.set(x, rim - arch, rmp[T.cyl(t, 5)]);
      if (k >= 1.8) p.set(x, rim - arch + 1, rmp[Math.max(0, T.cyl(t, 5) - 1)]);
    }
    // centre peak holding the gem, two small side points
    const ph = Math.round(1 + 1.5 * k);
    for (let j = 1; j <= ph; j++) { const hwid = Math.max(0, Math.round((ph - j) * 0.5)); for (let d = -hwid; d <= hwid; d++) p.set(a[0] + d, rim - 1 - j, rmp[d < 0 ? 3 : d > 0 ? 1 : 2]); }
    for (const s of [-1, 1]) { const sx = Math.round(a[0] + s * w * 0.3); p.set(sx, rim - 2, rmp[3]); o.fx.set(sx, rim - 3, rmp[4]); }
    gem(p, o.fx, a[0], rim - 1 - Math.round(ph * 0.5), o.gem || '#ff60c0', Math.min(k, 1.5));
  };

  // ---------------------------------------------------------------- helm かぶと (head)
  function dome(p, a, o, T, rx, ry, rmp) {
    const m = T.mask(p.w, p.h);
    m.ellipse(a[0], a[1], rx, ry, 1);
    for (let y = a[1] + 1; y < p.h; y++) for (let x = 0; x < p.w; x++) m.set(x, y, null);
    blob(p, m, rmp, Math.max(2, Math.round(rx * 0.5)), { global: 0.45 });
    return m;
  }
  PARTS.helm = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o), st = o.style || 'cap';
    o.eraseAt('head');
    const rmp = T.metal(o.c || '#9aa0b0', 5);
    const rx = Math.round(hw / 2 + (k >= 1.5 ? 2 : 1));
    const ry = Math.max(3, Math.min(Math.round(hw * 0.58), a[1] + (st === 'kabuto_big' ? -1 : 1)));
    const rim = fitTop(a[1], ry + 1);
    const A2 = [a[0], rim];
    dome(p, A2, o, T, rx, ry, rmp);
    // brim band
    const bh = k < 1.3 ? 1 : 2;
    for (let y = rim - bh + 1; y <= rim; y++) for (let x = a[0] - rx - (k >= 1.5 ? 1 : 0); x <= a[0] + rx + (k >= 1.5 ? 1 : 0); x++) {
      const t = (x - (a[0] - rx)) / (2 * rx);
      p.set(x, y, rmp[T.clamp(T.cyl(t, 5) - (y === rim ? 1 : 0), 0, 4)]);
    }
    // specular on the dome
    o.fx.set(a[0] - Math.round(rx * 0.45), rim - Math.round(ry * 0.6), rmp[4]);
    if (k >= 1.5) o.fx.set(a[0] - Math.round(rx * 0.45) + 1, rim - Math.round(ry * 0.6) - 1, '#ffffff');
    const topY = rim - ry;
    if (st === 'cap') {
      // a riveted ridge over the crown
      for (let y = topY + 1; y < rim - bh; y++) p.set(a[0], y, rmp[3]);
      for (const s of [-1, 1]) p.set(a[0] + s * Math.round(rx * 0.6), rim - bh, rmp[4]);
    } else if (st === 'horned') {
      const hr = T.ramp(o.c2 || '#e8e0d0', 5);
      const m = T.mask(p.w, p.h);
      for (const s of [-1, 1]) {
        const x0 = a[0] + s * (rx - 1), y0 = rim - Math.round(ry * 0.45);
        // horns curve outward when there is no room above the head (never clipped by the canvas top)
        const L = 3 + 3 * k, up = Math.min(L, Math.max(2, y0 - 1));
        T.tube(m, [[x0, y0], [x0 + s * L * 0.8, y0 - up * 0.1], [x0 + s * L * (up < L ? 1.1 : 0.9), y0 - up]], 1 + 0.35 * k, 0.35, 1, 14);
      }
      blob(p, m, hr, 1.4);
    } else if (st === 'plume') {
      const pr = T.ramp(o.c2 || '#c83030', 5, { dark: 0.6, light: 0.5 });
      const m = T.mask(p.w, p.h);
      const L = 4 + 4 * k;
      T.tube(m, [[a[0], topY + 1], [a[0] + L * 0.4, Math.max(0, topY - L * 0.45)], [a[0] + L, Math.max(1, topY + L * 0.3)]], 0.8 * k + 0.4, 1.2 * k, 1, 16);
      T.capsule(m, a[0], topY + 1, a[0], Math.max(0, topY - 1), 0.8 * k, 0.8 * k, 1);
      blob(p, m, pr, 1.5);
      // feather strands
      const b = T.bboxOf(m);
      if (b) for (let x = b.x0 + 2; x <= b.x1; x += 2) for (let y = b.y0; y <= b.y1; y++) if (m.get(x, y) != null && m.get(x, y + 1) == null) { p.set(x, y, pr[1]); break; }
      // a socket at the base
      p.set(a[0], topY + 1, rmp[2]); p.set(a[0], topY, rmp[3]);
    } else if (st === 'kabuto' || st === 'kabuto_big') {
      const big = st === 'kabuto_big';
      // kuwagata in gold, or in silver when the helmet itself is gold
      const hh = T.hsv(o.c || '#9aa0b0');
      const gr = T.metal(o.c2 || (hh[0] > 30 && hh[0] < 65 && hh[1] > 0.35 ? '#e0e4ec' : '#f0c840'), 5);
      // shikoro: stepped neck guard flaring out and down on both sides
      for (let s2 = 0; s2 < (k < 1.3 ? 2 : 3); s2++) {
        const y = rim + 1 + s2, ext = rx + 1 + s2;
        for (let x = a[0] - ext; x <= a[0] + ext; x++) {
          if (Math.abs(x - a[0]) < rx - 1) continue;
          const t = (x - (a[0] - ext)) / (2 * ext);
          p.set(x, y, s2 % 2 ? rmp[1] : rmp[T.cyl(t, 5)]);
        }
      }
      // fukigaeshi: little turned-back flaps
      for (const s of [-1, 1]) { const fx0 = a[0] + s * (rx + 1); p.set(fx0, rim - 1, rmp[3]); p.set(fx0, rim, rmp[2]); if (k >= 1.5) { p.set(fx0 + s, rim - 1, rmp[3]); p.set(fx0 + s, rim - 2, rmp[4]); } }
      // kuwagata: two gold horns rising in a U from the brow plate
      const m = T.mask(p.w, p.h);
      const hgt = Math.round((big ? 7 : 5) * k), spread = Math.round((big ? 0.7 : 0.45) * rx + 1);
      for (const s of [-1, 1]) {
        const x0 = a[0] + s, y0 = rim - 1;
        T.tube(m, [[x0, y0], [a[0] + s * spread * 1.2, y0 - hgt * 0.3], [a[0] + s * spread, Math.max(0, y0 - hgt)]], 0.55 + 0.25 * k, big ? 0.9 : 0.6, 1, 16);
      }
      p.blit(T.shade(m, gr, { depth: 1.2 }), 0, 0);
      // brow plate with the crest disc
      p.set(a[0], rim - 1, gr[4]); p.set(a[0] - 1, rim - 1, gr[3]); p.set(a[0] + 1, rim - 1, gr[2]);
      if (k >= 1.5) { p.set(a[0], rim - 2, gr[3]); o.fx.set(a[0], rim - 2, '#fff8d0'); }
      // lacing dots on the dome
      for (let x = a[0] - rx + 2; x <= a[0] + rx - 2; x += 2) p.set(x, rim - bh - 1, rmp[1]);
    } else if (st === 'fin') {
      const fr = T.ramp(o.c2 || T.mix(o.c || '#708090', '#80e0e0', 0.45), 5, { dark: 0.55, light: 0.6 });
      // a crest fin seen from the front: a raised ridge over the dome with spines
      for (let y = topY; y < rim - bh; y++) { p.set(a[0], y, fr[3]); if (k >= 1.5) p.set(a[0] + 1, y, fr[1]); }
      if (topY > 0) p.set(a[0], topY - 1, fr[4]);
      // big fan fins spreading sideways from the helmet, rays and webbing
      for (const s2 of [-1, 1]) {
        const bx = a[0] + s2 * (rx - Math.round(0.5 * k)), by = rim - Math.round(ry * 0.35);
        const m = T.mask(p.w, p.h);
        const L = 3 + 2.6 * k;
        const rays = [-0.95, -0.55, -0.15];
        const tips = rays.map((ang) => [bx + s2 * Math.cos(ang) * L, by + Math.sin(ang) * L]);
        m.poly([[bx, by + Math.round(k)]].concat(tips).concat([[bx, by - Math.round(k)]]), 1);
        p.blit(T.shade(m, fr, { depth: 1.2, amb: 0.25 }), 0, 0);
        for (const t of tips) T.line(p, bx, by, Math.round(t[0]), Math.round(t[1]), (x, y) => (m.get(x, y) != null ? fr[1] : null));
        for (const t of tips) o.fx.set(Math.round(t[0]), Math.round(t[1]), fr[4]);
      }
    }
  };

  // ---------------------------------------------------------------- hood 頭巾 (head)
  PARTS.hood = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o), an = o.anchors;
    const st = o.style;
    const rmp = T.ramp(o.c || '#6040a0', 5, { dark: 0.62, light: 0.5 });
    if (st === 'cobra') return hoodCobra(p, a, o, T, rmp);
    o.eraseAt('head');
    const ey = an.eyes[0][1], ex0 = Math.min(...an.eyes.map((e) => e[0])), ex1 = Math.max(...an.eyes.map((e) => e[0]));
    const my = an.mouth[1];
    const neckY = an.neck ? an.neck[1] : my + 3 * k;
    const rx = Math.round(hw / 2 + 1.5 * k);
    const up = st === 'witch' ? Math.min(a[1] + 1, Math.round(hw * 0.9 + 4 * k)) : Math.min(a[1] + 1, Math.round(hw * 0.32 + 1.5 * k));
    const m = T.mask(p.w, p.h);
    // the hood: a rounded cowl hugging the head, falling to the shoulders on both sides
    const cy = a[1] + Math.round(hw * 0.25);
    m.ellipse(a[0], cy, rx, Math.round(cy - (a[1] - up)), 1);
    for (let y = cy; y <= neckY + Math.round(2 * k); y++) {
      const t = (y - cy) / Math.max(1, neckY + 2 * k - cy);
      const half = Math.round(rx + t * t * 3 * k);
      for (let x = a[0] - half; x <= a[0] + half; x++) m.set(x, y, 1);
    }
    if (st === 'witch') {
      // a tall point bending back
      const tip = Math.max(0, a[1] - up);
      T.tube(m, [[a[0] - 1, cy - Math.round(hw * 0.2)], [a[0] + 1, tip + Math.round(up * 0.35)], [a[0] + Math.round(3 * k), tip]], Math.round(hw * 0.35), 0.5, 1, 18);
    }
    // face opening around the eyes and the mouth
    const fx0 = ex0 - Math.round(1.5 * k) - 1, fx1 = ex1 + Math.round(1.5 * k) + 1;
    const fy0 = ey - Math.round(2 * k) - 1, fy1 = my + Math.round(1.5 * k);
    const fcx = (fx0 + fx1) / 2, fcy = (fy0 + fy1) / 2, frx = (fx1 - fx0) / 2, fry = (fy1 - fy0) / 2;
    const shadow = [];
    m.each((x, y) => {
      const dx = (x - fcx) / (frx + 0.5), dy = (y - fcy) / (fry + 0.5);
      if (dx * dx + dy * dy <= 1 || (y > fcy && Math.abs(x - fcx) <= frx * 0.8 && y <= fy1 + 1)) return null;
      return undefined;
    });
    // only where it covers the head or hangs beside it: keep the cowl off the arms and body
    const bodyTop = neckY + Math.round(2 * k);
    m.each((x, y) => (y > bodyTop ? null : undefined));
    const shaded = T.shade(m, rmp, { depth: Math.max(2, Math.round(2 * k)), global: 0.4 });
    p.blit(shaded, 0, 0);
    // inner shadow ring on the face just inside the opening, and a fold line down the middle
    const base = o.base;
    for (let y = fy0 - 1; y <= fy1 + 1; y++) for (let x = fx0 - 1; x <= fx1 + 1; x++) {
      if (m.get(x, y) != null) continue;
      const nb = m.get(x - 1, y) != null || m.get(x + 1, y) != null || m.get(x, y - 1) != null;
      if (nb && base.get(x, y) != null) shadow.push([x, y]);
    }
    for (const [x, y] of shadow) p.set(x, y, T.dk(base.get(x, y), 0.5));
    for (let y = Math.max(0, a[1] - up + 2); y < fy0 - 1; y++) if (m.get(a[0], y) != null && (y % 3)) p.set(a[0] + 1, y, rmp[1]);
    // hem, and fold lines running down the drapes beside the face
    for (let x = 0; x < p.w; x++) for (let y = bodyTop; y >= bodyTop - 1; y--) if (m.get(x, y) != null && m.get(x, y + 1) == null) { p.set(x, y, rmp[0]); break; }
    for (const s2 of [-1, 1]) {
      const fx0 = Math.round(fcx + s2 * (frx + 1.5 * k + 1));
      for (let y = Math.round(fcy); y < bodyTop; y++) { const x = fx0 + s2 * Math.round(((y - fcy) / Math.max(1, bodyTop - fcy)) * 1.5 * k); if (m.get(x, y) != null && m.get(x + s2, y) != null) p.set(x, y, rmp[1]); }
    }
  }
  function hoodCobra(p, a, o, T, rmp) {
    // the cobra's flared neck: a spade of skin spreading behind the head, drawn only around the base
    const k = o.baseK, an = o.anchors, info = o.info;
    const nx = an.neck[0], ny = an.neck[1];
    const hx = an.head[0], hy = an.head[1];
    const cx = Math.round((nx * 2 + hx) / 3), cy = Math.round((ny * 2 + hy + 4 * k) / 3);
    const rx = Math.round(7 * k), ry = Math.round(9 * k);
    const m = T.mask(p.w, p.h);
    m.ellipse(cx, cy, rx, ry, 1);
    m.poly([[cx - rx * 0.6, cy + ry * 0.5], [cx + rx * 0.6, cy + ry * 0.5], [nx, ny + Math.round(10 * k)]], 1);
    // behind the head and body: keep only what is outside the base, plus a 1-px rim over its edge
    m.each((x, y) => (info.solid[y * info.w + x] ? null : undefined));
    const sh = T.shade(m, rmp, { depth: 2 });
    p.blit(sh, 0, 0);
    // spectacle marks and scale rows
    const b = T.bboxOf(m);
    if (!b) return;
    for (let y = b.y0 + 1; y <= b.y1; y += 2) for (let x = b.x0 + ((y >> 1) & 1); x <= b.x1; x += 3) if (m.get(x, y) != null && m.get(x, y - 1) != null) p.set(x, y, rmp[1]);
    for (const s of [-1, 1]) {
      const ex = cx + s * Math.round(rx * 0.6), ey = cy - Math.round(ry * 0.1);
      if (m.get(ex, ey) == null) continue;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (m.get(ex + i, ey + j) != null) p.set(ex + i, ey + j, i || j ? '#302818' : '#f0e0a0');
    }
    // light cream belly stripe on the inner edge of the flare
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) if (m.get(x, y) != null && info.on(x + 1, y) && x < cx) p.set(x, y, rmp[4]);
  }

  // ---------------------------------------------------------------- hat 帽子 (head)
  function brim(p, a, T, rmp, w, th) {
    for (let j = 0; j < th; j++) for (let x = Math.round(a[0] - w / 2); x <= Math.round(a[0] + w / 2); x++) {
      const t = (x - (a[0] - w / 2)) / w;
      const e = Math.abs(t - 0.5) * 2;
      if (j === 0 && e > 0.94) continue;
      p.set(x, a[1] - j, rmp[T.clamp(T.cyl(t, rmp.length) - (j === 0 ? 1 : 0), 0, rmp.length - 1)]);
    }
  }
  PARTS.hat = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o), st = o.style || 'wizard';
    const rmp = T.ramp(o.c || '#304890', 5, { dark: 0.62, light: 0.5 });
    if (['tophat', 'shako', 'miner', 'wizard', 'night'].includes(st)) o.eraseAt('head');
    if (st === 'wizard' || st === 'night') {
      const H = Math.min(Math.round(hw * 1.1 + 4 * k), 28);
      const rim = fitTop(a[1], Math.min(H, a[1] + 1));
      const hh = Math.min(H, rim + 1);
      const bw = Math.round(hw * (st === 'wizard' ? 1.45 : 1.05));
      const m = T.mask(p.w, p.h);
      const baseHalf = Math.round(hw * (st === 'wizard' ? 0.42 : 0.52));
      const tipX = a[0] + Math.round((st === 'wizard' ? 3 : 6) * k), tipY = Math.max(0, rim - hh + 1);
      const bend = st === 'night' ? Math.round(5 * k) : Math.round(2 * k);
      // cone as a bent tube, wide at the brim
      T.tube(m, [[a[0], rim - 1], [a[0] - Math.round(k), rim - hh * 0.6], [tipX + bend, tipY + (st === 'night' ? Math.round(hh * 0.35) : 0)]], baseHalf, 0.6, 1, 20);
      m.each((x, y) => (y > rim ? null : undefined));
      p.blit(T.shade(m, rmp, { depth: Math.max(2, baseHalf * 0.6), global: 0.45 }), 0, 0);
      if (st === 'wizard') {
        brim(p, [a[0], rim], T, rmp, bw, k < 1.3 ? 1 : 2);
        // band and a star buckle
        const bandR = T.ramp(o.c2 || '#d0b040', 4);
        for (let x = a[0] - baseHalf; x <= a[0] + baseHalf; x++) if (m.get(x, rim - (k < 1.3 ? 1 : 2)) != null) p.set(x, rim - (k < 1.3 ? 1 : 2), bandR[T.cyl((x - a[0] + baseHalf) / (2 * baseHalf), 4)]);
        const sx = a[0] + Math.round(baseHalf * 0.2), sy = rim - Math.round(hh * 0.45);
        if (m.get(sx, sy) != null) { p.set(sx, sy, bandR[3]); o.fx.set(sx, sy, '#fff8c0'); if (k >= 1.5) { p.set(sx - 1, sy, bandR[2]); p.set(sx + 1, sy, bandR[2]); p.set(sx, sy - 1, bandR[2]); p.set(sx, sy + 1, bandR[2]); } }
      } else {
        // nightcap: soft cuff and a pompom at the drooping tip
        const cuff = T.ramp(o.c2 || '#f0f0f0', 4, { dark: 0.35, light: 0.5 });
        for (let j = 0; j < (k < 1.3 ? 2 : 3); j++) for (let x = a[0] - baseHalf - 1; x <= a[0] + baseHalf + 1; x++) p.set(x, rim - j, cuff[T.clamp(T.cyl((x - a[0] + baseHalf + 1) / (2 * baseHalf + 2), 4) - (j === 0 ? 1 : 0), 0, 3)]);
        // stripes
        const b = T.bboxOf(m);
        for (let y = b.y0; y < rim - 2; y++) if ((y - b.y0) % Math.round(3 * k) === 0) for (let x = b.x0; x <= b.x1; x++) if (m.get(x, y) != null) p.set(x, y, T.mix(p.get(x, y), cuff[2], 0.55));
        const pm = T.mask(p.w, p.h);
        const px = tipX + bend, py = tipY + Math.round(hh * 0.35);
        pm.ellipse(px, py + 1, Math.max(1, Math.round(1.2 * k)), Math.max(1, Math.round(1.2 * k)), 1);
        blob(p, pm, cuff, 1.4);
      }
    } else if (st === 'lady') {
      const H = Math.round(3 + 2.5 * k), rim = fitTop(a[1], H + 1);
      const m = T.mask(p.w, p.h);
      m.ellipse(a[0], rim - 1, Math.round(hw * 0.45), H, 1);
      m.each((x, y) => (y > rim - 1 ? null : undefined));
      p.blit(T.shade(m, rmp, { depth: 2 }), 0, 0);
      // very wide brim (tilted: a thin ellipse)
      const bm = T.mask(p.w, p.h);
      bm.ellipse(a[0], rim, Math.round(hw * 0.95 + 2 * k), Math.max(1, Math.round(0.9 * k)), 1);
      p.blit(T.shade(bm, rmp, { depth: 1, global: 0.6 }), 0, 0);
      const rib = T.ramp(o.c2 || '#f080b0', 4);
      for (let x = a[0] - Math.round(hw * 0.45); x <= a[0] + Math.round(hw * 0.45); x++) p.set(x, rim - 1, rib[T.cyl((x - a[0] + hw * 0.45) / (hw * 0.9), 4)]);
      // a rose on the side
      const fx0 = a[0] + Math.round(hw * 0.38), fy0 = rim - 2;
      const fm = T.mask(p.w, p.h); fm.ellipse(fx0, fy0, Math.round(1.2 * k), Math.round(1.1 * k), 1);
      blob(p, fm, rib, 1.2); p.set(fx0, fy0, rib[0]);
    } else if (st === 'tricorn' || st === 'bicorne') {
      const tri = st === 'tricorn';
      const H = squash(a[1], Math.round(tri ? 3 + 2.5 * k : 3 + 3 * k)), rim = fitTop(a[1], H + 1);
      const w = Math.round(hw * (tri ? 1.35 : 1.6));
      const m = T.mask(p.w, p.h);
      if (tri) {
        // front view: turned-up brim with points left, right and a low point at the front
        m.poly([[a[0] - w / 2, rim - H * 0.7], [a[0] - w * 0.15, rim - H], [a[0] + w * 0.15, rim - H], [a[0] + w / 2, rim - H * 0.7], [a[0] + w * 0.35, rim], [a[0], rim + 1], [a[0] - w * 0.35, rim]], 1);
      } else {
        // bicorne worn athwart: a crescent with points at both ends
        m.poly([[a[0] - w / 2, rim + 1], [a[0] - w * 0.3, rim - H * 0.55], [a[0], rim - H], [a[0] + w * 0.3, rim - H * 0.55], [a[0] + w / 2, rim + 1], [a[0], rim - 1]], 1);
      }
      p.blit(T.shade(m, rmp, { depth: 2, global: 0.4 }), 0, 0);
      // trim along the upper edge
      const tr = T.metal(o.c2 || (tri ? '#c8a040' : '#f0e8c0'), 4);
      const b = T.bboxOf(m);
      for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) if (m.get(x, y) != null) { p.set(x, y, tr[T.cyl((x - b.x0) / (b.x1 - b.x0), 4)]); break; }
      if (!tri) {
        // cockade
        const cr = T.ramp(o.gem || '#c02030', 4);
        const cm = T.mask(p.w, p.h); cm.ellipse(a[0] + Math.round(w * 0.12), rim - Math.round(H * 0.45), Math.max(1, Math.round(k)), Math.max(1, Math.round(k)), 1);
        blob(p, cm, cr, 1.2); o.fx.set(a[0] + Math.round(w * 0.12), rim - Math.round(H * 0.45), '#ffffff');
      } else {
        // a small skull badge on the front
        const sx = a[0], sy = rim - Math.round(H * 0.5);
        p.set(sx, sy, '#f0ece0'); if (k >= 1.5) { p.set(sx - 1, sy, '#f0ece0'); p.set(sx + 1, sy, '#f0ece0'); p.set(sx, sy + 1, '#c8c4b8'); p.set(sx - 1, sy - 1, '#d8d4c8'); p.set(sx + 1, sy - 1, '#d8d4c8'); }
      }
    } else if (st === 'miner') {
      const rx = Math.round(hw / 2 + 1), ry = Math.max(3, Math.min(Math.round(hw * 0.5), a[1] + 1));
      const rim = fitTop(a[1], ry + 1);
      dome(p, [a[0], rim], o, T, rx, ry, T.ramp(o.c || '#d0a030', 5, { dark: 0.6, light: 0.6 }));
      const rr = T.ramp(o.c || '#d0a030', 5, { dark: 0.6, light: 0.6 });
      brim(p, [a[0], rim], T, rr, 2 * rx + Math.round(3 * k), 1);
      for (let y = rim - ry + 1; y < rim; y++) p.set(a[0] + Math.round(rx * 0.25), y, rr[4]);
      // the lamp: grey housing, glowing lens, short rays of light
      const lx = a[0], ly = rim - Math.round(ry * 0.45);
      const lm = T.mask(p.w, p.h); lm.ellipse(lx, ly, Math.max(1, Math.round(1.3 * k)), Math.max(1, Math.round(1.1 * k)), 1);
      p.blit(T.shade(lm, T.metal('#808890', 4), { depth: 1 }), 0, 0);
      p.set(lx, ly, '#fff8c0'); if (k >= 1.5) { p.set(lx - 1, ly, '#fff0a0'); p.set(lx, ly - 1, '#ffffff'); }
      o.fx.set(lx, ly, '#ffffff');
      for (const [dx, dy] of [[0, -1], [-1, -1], [1, -1]]) for (let r = Math.round(2 * k); r <= Math.round(3.5 * k); r++) if ((r + dx) % 2 === 0) o.fx.set(lx + dx * r, ly + dy * r - 1, '#fff4a0');
    } else if (st === 'tophat') {
      const hh = Math.min(Math.round(hw * 0.75 + 2 * k), a[1] + 1), rim = fitTop(a[1], hh + 1);
      const half = Math.round(hw * 0.4);
      const m = T.mask(p.w, p.h);
      m.rect(a[0] - half, rim - hh + 1, 2 * half + 1, hh, 1);
      cylFill(p, m, rmp, { top: true });
      // top ellipse rim, band, brim
      for (let x = a[0] - half; x <= a[0] + half; x++) p.set(x, rim - hh + 1, rmp[3]);
      const band = T.ramp(o.c2 || '#a02030', 4);
      for (let j = 1; j <= (k < 1.3 ? 1 : 2); j++) for (let x = a[0] - half; x <= a[0] + half; x++) p.set(x, rim - j, band[T.cyl((x - a[0] + half) / (2 * half), 4)]);
      brim(p, [a[0], rim], T, rmp, 2 * half + Math.round(4 * k), 1);
      o.fx.set(a[0] - half + 1, rim - hh + 2, rmp[4]);
    } else if (st === 'shako') {
      const hh = Math.min(Math.round(hw * 0.8 + 2 * k), a[1] + 1), rim = fitTop(a[1], hh + 1);
      const half = Math.round(hw * 0.42);
      const m = T.mask(p.w, p.h);
      m.poly([[a[0] - half, rim], [a[0] + half + 1, rim], [a[0] + half + 1 + Math.round(k * 0.5), rim - hh + 1], [a[0] - half - Math.round(k * 0.5), rim - hh + 1]], 1);
      cylFill(p, m, rmp, { top: true });
      const gold = T.metal(o.c2 || '#e0c050', 4);
      for (let x = a[0] - half - 1; x <= a[0] + half + 1; x++) p.set(x, rim - hh + 1, gold[T.cyl((x - a[0] + half + 1) / (2 * half + 2), 4)]);
      // black leather visor and chin strap
      for (let x = a[0] - half - 1; x <= a[0] + half + 1; x++) p.set(x, rim, '#282030');
      p.set(a[0] - half - 1, rim, '#403848');
      // gold badge and a white-red pompom plume
      const by = rim - Math.round(hh * 0.45);
      p.set(a[0], by, gold[3]); p.set(a[0], by + 1, gold[1]); if (k >= 1.5) { p.set(a[0] - 1, by, gold[2]); p.set(a[0] + 1, by, gold[2]); p.set(a[0], by - 1, gold[3]); }
      o.fx.set(a[0], by, '#fff8d0');
      const pm = T.mask(p.w, p.h); pm.ellipse(a[0], Math.max(1, rim - hh - Math.round(k)), Math.max(1, Math.round(k)), Math.max(1, Math.round(1.4 * k)), 1);
      blob(p, pm, T.ramp('#e84040', 4), 1.2);
      p.set(a[0], Math.max(0, rim - hh - Math.round(2 * k)), '#ffffff');
    }
  };

  // ---------------------------------------------------------------- halo 光輪 (head, back layer)
  PARTS.halo = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o);
    const rmp = T.ramp(o.c || '#fff4b0', 4, { dark: 0.3, light: 0.8 });
    const rx = Math.round(hw * 0.55 + 1), ry = Math.max(1, Math.round(rx * 0.3));
    const cy = Math.max(ry + 1, a[1] - Math.round(3 * k) - ry);
    // the far half of the ring goes behind the head, the near half in front of it
    const near = o.extra('front');
    const th = k >= 1.8 ? 2 : 1;
    for (let t = 0; t < 360; t += 1.5) {
      const r = (t * Math.PI) / 180;
      const front = Math.sin(r) > 0.05;
      const L = front ? near : p;
      for (let j = 0; j < th; j++) {
        const x = Math.round(a[0] + Math.cos(r) * (rx - j)), y = Math.round(cy + Math.sin(r) * ry);
        L.set(x, y, j ? rmp[3] : front ? rmp[2] : rmp[1]);
      }
    }
    near.fx.set(a[0] - Math.round(rx * 0.55), cy + Math.round(ry * 0.8), '#ffffff');
    near.fx.set(a[0] + Math.round(rx * 0.35), cy + ry, rmp[3]);
    o.fx.set(a[0] + Math.round(rx * 0.3), cy - ry, rmp[3]);
  };

  // ---------------------------------------------------------------- bandana バンダナ (head)
  PARTS.bandana = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o), info = o.info, an = o.anchors;
    const rmp = T.ramp(o.c || '#c03030', 5, { dark: 0.6, light: 0.5 });
    // the cloth hugs the top of the head: base pixels above the rim line, plus 1 px of fold on top
    const half = Math.round(hw / 2 + 1);
    const eyeY = Math.min(...an.eyes.map((e) => e[1]));
    const rim = Math.min(a[1] + Math.round(1.5 * k), eyeY - Math.max(1, Math.round(k)) - 1);
    const m = T.mask(p.w, p.h);
    for (let x = a[0] - half; x <= a[0] + half; x++) {
      const top = info.top[x] >= 0 ? info.top[x] : rim;
      const y0 = Math.max(0, Math.min(rim - 1, top) - (k >= 1.5 ? 1 : 0));
      const edge = Math.abs(x - a[0]) >= half - 1;
      for (let y = y0 + (edge ? 1 : 0); y <= rim; y++) if (info.on(x, y) || y <= top + 1) m.set(x, y, 1);
    }
    p.blit(T.shade(m, rmp, { depth: 2, global: 0.35 }), 0, 0);
    // hem line and polka dots
    for (let x = a[0] - half; x <= a[0] + half; x++) if (m.get(x, rim) != null) p.set(x, rim, rmp[1]);
    const dot = o.c2 || '#f8f0e0';
    const b = T.bboxOf(m);
    for (let y = b.y0 + 1; y < rim - 1; y += 3) for (let x = b.x0 + ((y / 3) & 1 ? 2 : 0) + 1; x < b.x1; x += 4) if (m.get(x, y) != null && m.get(x, y - 1) != null) p.set(x, y, dot);
    // knot and two tails on the picture-right side
    const kx = a[0] + half, ky = rim - Math.round(k);
    const km = T.mask(p.w, p.h);
    km.ellipse(kx, ky, Math.max(1, Math.round(1.2 * k)), Math.max(1, Math.round(1.1 * k)), 1);
    T.tube(km, [[kx, ky], [kx + 2 * k, ky + 2 * k], [kx + 2.5 * k, ky + 5 * k]], 0.8 * k, 0.5 * k, 1, 10);
    T.tube(km, [[kx, ky], [kx + 3 * k, ky + 1 * k], [kx + 4.5 * k, ky + 3.5 * k]], 0.7 * k, 0.4 * k, 1, 10);
    p.blit(T.shade(km, rmp, { depth: 1.2 }), 0, 0);
  };

  // ---------------------------------------------------------------- flower 花 (head)
  function bloom(p, fx, x, y, r, petal, center, T) {
    const pr = T.ramp(petal, 5, { dark: 0.5, light: 0.6 }), cr = T.ramp(center, 3, { dark: 0.45, light: 0.5 });
    const X = Math.round(x), Y = Math.round(y);
    if (r < 2) {
      // tiny: a plus of petals round a centre
      for (const [dx, dy, c] of [[0, -1, pr[3]], [-1, 0, pr[3]], [1, 0, pr[2]], [0, 1, pr[1]], [-1, 1, pr[2]], [1, 1, pr[1]]]) p.set(X + dx, Y + dy, c);
      p.set(X, Y, cr[1]); fx.set(X, Y, cr[2]);
      return;
    }
    // five petals, each its own lit ellipse, separated by darker creases, a ringed centre
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = x + Math.cos(ang) * r * 0.62, py = y + Math.sin(ang) * r * 0.62;
      const m = T.mask(p.w, p.h);
      m.ellipse(px, py, r * 0.5, r * 0.5, 1);
      m.each((xx, yy) => {
        const lit = (xx - px) * -0.6 + (yy - py) * -0.8;
        const edge = Math.hypot(xx - px, yy - py) > r * 0.5 - 0.3;
        p.set(xx, yy, edge ? pr[1] : lit > 0.3 ? pr[4] : lit > -0.6 ? pr[3] : pr[2]);
        return undefined;
      });
    }
    const cr0 = Math.max(0.8, r * 0.3);
    for (let yy = Math.floor(y - cr0); yy <= Math.ceil(y + cr0); yy++) for (let xx = Math.floor(x - cr0); xx <= Math.ceil(x + cr0); xx++) {
      const d = Math.hypot(xx - x, yy - y);
      if (d <= cr0 + 0.3) p.set(xx, yy, d > cr0 - 0.6 ? cr[0] : cr[1]);
    }
    fx.set(X - (r >= 3 ? 1 : 0), Y - (r >= 3 ? 1 : 0), cr[2]);
  }
  PARTS.flower = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o);
    const r = k < 1.3 ? 2.2 : k < 1.8 ? 2.6 : 3.4;
    const onHead = !(o.anchors.at && o.anchors.at.flower);
    const x = onHead ? a[0] + Math.round(hw * 0.28) : a[0], y = Math.max(Math.ceil(r), a[1] - Math.round(r * 0.6));
    const petal = o.c || '#ff90c0';
    const ph = T.hsv(petal);
    // a yellow flower gets a brown heart, every other colour a yellow one
    const center = o.c2 || (ph[0] > 35 && ph[0] < 70 && ph[1] > 0.3 ? '#b05828' : '#ffe060');
    bloom(p, o.fx, x, y, r, petal, center, T);
    if (k >= 1.3) bloom(p, o.fx, x - Math.round(r * 1.7), y + Math.round(r * 0.7), r * 0.7, petal, center, T);
    // two leaves under the blooms
    const lr = T.ramp('#58a040', 3);
    p.set(x + Math.round(r), y + Math.round(r), lr[1]); p.set(x + Math.round(r) + 1, y + Math.round(r), lr[2]);
    if (k >= 1.3) { p.set(x - Math.round(r * 2.4), y + Math.round(r * 1.4), lr[1]); p.set(x - Math.round(r * 2.4) - 1, y + Math.round(r * 1.4), lr[2]); }
  };

  // ---------------------------------------------------------------- beard ひげ (mouth)
  PARTS.beard = (p, a, o) => {
    const T = TK(), k = o.baseK, hw = headW(o);
    const rmp = T.ramp(o.c || '#f8f8f0', 5, { dark: 0.45, light: 0.5 });
    const m = T.mask(p.w, p.h);
    if (o.style === 'mustache') {
      const w = Math.round(hw * 0.35 + 2 * k), y = a[1] - Math.max(1, Math.round(k));
      for (const s of [-1, 1]) {
        T.tube(m, [[a[0], y], [a[0] + s * w * 0.6, y + 1.2 * k], [a[0] + s * w, y - 1.5 * k]], 1.1 * k, 0.45, 1, 14);
        T.capsule(m, a[0] + s * w, y - 1.5 * k, a[0] + s * (w - 1 * k), y - 2.6 * k, 0.5 * k, 0.4, 1);
      }
      p.blit(T.shade(m, rmp, { depth: 1.2 }), 0, 0);
      p.set(a[0], y, rmp[1]);
      return;
    }
    const w = Math.round(hw * 0.32 + 1.5 * k), L = Math.round(hw * 0.35 + 3 * k);
    const y0 = a[1];
    m.poly([[a[0] - w, y0 - Math.round(k)], [a[0] + w + 1, y0 - Math.round(k)], [a[0] + w * 0.55, y0 + L * 0.7], [a[0] + 1, y0 + L], [a[0] - w * 0.55, y0 + L * 0.7]], 1);
    // keep the mouth itself visible
    m.each((x, y) => (Math.abs(x - a[0]) <= Math.max(1, Math.round(k)) && y <= y0 && y >= y0 - Math.round(k) ? null : undefined));
    p.blit(T.shade(m, rmp, { depth: 2 }), 0, 0);
    // hair strands: darker grooves running down, wavy, and darker tips
    const b = T.bboxOf(m);
    if (b) m.each((x, y) => {
      const wave = Math.round(Math.sin((y - b.y0) * 0.8) * 0.6);
      if ((x + wave - a[0] + 100) % 2 === 0 && y > b.y0 + 1) p.set(x, y, rmp[y > b.y1 - 2 ? 0 : 1]);
      return undefined;
    });
  };

  // ---------------------------------------------------------------- eyepatch 眼帯 (eyes[0])
  PARTS.eyepatch = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, info = o.info;
    const rx = k < 1.3 ? 1.6 : k < 1.8 ? 2.2 : 3, ry = k < 1.3 ? 1.5 : k < 1.8 ? 2 : 2.6;
    const m = T.mask(p.w, p.h);
    m.ellipse(a[0], a[1], rx, ry, 1);
    p.blit(T.shade(m, ['#141018', '#221c28', '#342c3c', '#4c4458'], { depth: 1.5 }), 0, 0);
    // the string: from the patch to the top of the head on the far side, and out to the near edge
    const other = an.eyes[1] || [a[0] + 6 * k, a[1]];
    const hx = an.head[0] + Math.sign(other[0] - a[0]) * Math.round((an.headW || 10) * 0.25);
    const hy = topNear(info, hx, an.head[1]);
    T.line(p, a[0] + Math.round(rx * 0.7), a[1] - Math.round(ry * 0.7), hx, hy + 1, '#2a2430');
    let ex = a[0] - Math.round(rx) - 1;
    const dir = other[0] > a[0] ? -1 : 1;
    ex = a[0] + dir * Math.round(rx);
    let tx = ex;
    while (info.on(tx + dir, a[1] - 1) && Math.abs(tx - ex) < 10 * k) tx += dir;
    T.line(p, ex, a[1] - 1, tx, a[1] - 2, '#2a2430');
    o.fx.set(a[0] - Math.round(rx * 0.4), a[1] - Math.round(ry * 0.4), '#6a6078');
  };

  // ---------------------------------------------------------------- monocle 片眼鏡 (eyes[1])
  PARTS.monocle = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const rmp = T.metal(o.c || '#e0c050', 4);
    const r = k < 1.3 ? 2 : k < 1.8 ? 2.6 : 3.4;
    for (let t = 0; t < 360; t += 6) {
      const ang = (t * Math.PI) / 180;
      const x = Math.round(a[0] + Math.cos(ang) * r), y = Math.round(a[1] + Math.sin(ang) * r);
      p.set(x, y, rmp[Math.cos(ang) + Math.sin(ang) < 0 ? 3 : 1]);
    }
    // glass: brighten what is behind it a little, one glint
    const base = o.base;
    for (let y = Math.floor(a[1] - r + 1); y <= Math.ceil(a[1] + r - 1); y++) for (let x = Math.floor(a[0] - r + 1); x <= Math.ceil(a[0] + r - 1); x++) {
      if (Math.hypot(x - a[0], y - a[1]) > r - 0.8 || p.get(x, y) != null) continue;
      const c = base.get(x, y);
      if (c) o.fx.set(x, y, T.mix(c, '#e8f4ff', 0.3));
    }
    o.fx.set(Math.round(a[0] - r * 0.4), Math.round(a[1] - r * 0.4), '#ffffff');
    // chain: a dotted gold line hanging down and back
    const chain = [];
    for (let i = 1; i <= Math.round(6 * k); i++) chain.push([Math.round(a[0] + r + i * 0.35), Math.round(a[1] + r * 0.7 + i)]);
    chain.forEach(([x, y], i) => o.fx.set(x, y, i % 2 ? rmp[1] : rmp[3]));
  };

  // ---------------------------------------------------------------- goggles ゴーグル (eyes → forehead)
  PARTS.goggles = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, info = o.info;
    const eyes = Array.isArray(a[0]) ? a : [a];
    const fr = T.metal(o.c || '#a88040', 4), gl = T.ramp(o.c2 || '#70d0e8', 4, { dark: 0.4, light: 0.7 });
    const r = k < 1.3 ? 1.6 : k < 1.8 ? 2.2 : 3;
    const ey = Math.min(...eyes.map((e) => e[1]));
    const gy = Math.max(Math.ceil(r) + 1, Math.min(an.brow[1], ey - Math.round(r + 1.5 * k)));
    // strap across the forehead to both edges of the head
    const x0 = Math.min(...eyes.map((e) => e[0])), x1 = Math.max(...eyes.map((e) => e[0]));
    let l = x0, rgt = x1;
    while (info.on(l - 1, gy) && x0 - l < 12 * k) l--;
    while (info.on(rgt + 1, gy) && rgt - x1 < 12 * k) rgt++;
    for (let x = l; x <= rgt; x++) { p.set(x, gy, '#4a3428'); if (k >= 1.5) p.set(x, gy + 1, '#342418'); }
    for (const e of eyes) {
      const m = T.mask(p.w, p.h);
      m.ellipse(e[0], gy, r, r, 1);
      p.blit(T.shade(m, fr, { depth: 1 }), 0, 0);
      const g = T.mask(p.w, p.h);
      g.ellipse(e[0], gy, Math.max(0.6, r - 1), Math.max(0.6, r - 1), 1);
      p.blit(T.shade(g, gl, { depth: 1, light: [-0.7, -0.7, 0.3] }), 0, 0);
      o.fx.set(Math.round(e[0] - r * 0.4), Math.round(gy - r * 0.4), '#ffffff');
    }
  };

  // ---------------------------------------------------------------- eyes_glow 光る目 (eyes)
  PARTS.eyes_glow = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    const eyes = Array.isArray(a[0]) ? a : [a];
    const c = o.c || '#ff3030';
    const rmp = T.ramp(c, 4, { dark: 0.5, light: 0.75 });
    const st = o.style;
    if (st === 'spiral') {
      const r = Math.round(k < 1.3 ? 2 : k < 1.8 ? 3 : 4);
      for (const e of eyes) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d = Math.hypot(x, y);
          if (d > r + 0.3) continue;
          const ang = Math.atan2(y, x);
          const band = Math.floor(d + (ang / (2 * Math.PI)) * 2 + 10) % 2;
          p.set(e[0] + x, e[1] + y, band ? rmp[2] : '#201028');
        }
        p.set(e[0], e[1], rmp[3]);
        o.fx.set(e[0] - Math.round(r * 0.6), e[1] - Math.round(r * 0.6), '#ffffff');
      }
      return;
    }
    if (st === 'face') {
      // a face on a fireball: fierce brows, glowing eyes and a jagged grin
      for (const e of eyes) {
        const s = e[0] < an.body[0] ? -1 : 1;
        const w = k < 1.3 ? 1 : 2;
        for (let j = 0; j < (k < 1.3 ? 2 : 3); j++) for (let i = 0; i < w; i++) p.set(e[0] + i - (w >> 1), e[1] - 1 + j, j === 0 ? rmp[3] : c);
        o.fx.set(e[0], e[1] - 1, '#ffffff');
        // angry brow slanting down toward the middle
        const n = Math.round(2 * k) + 1;
        for (let i = 0; i < n; i++) {
          const tIn = s < 0 ? i / (n - 1) : 1 - i / (n - 1);
          p.set(e[0] - (n >> 1) + i, e[1] - 2 - Math.round(k * 0.5) + Math.round(tIn), T.INK);
        }
      }
      const mx = an.mouth[0], my = an.mouth[1];
      const hw2 = Math.round(2 + 1.5 * k);
      for (let x = -hw2; x <= hw2; x++) {
        const curve = Math.round((x * x) / (hw2 * hw2) * -1.2 * k);
        p.set(mx + x, my + curve, T.INK);
        p.set(mx + x, my + curve + 1, Math.abs(x) < hw2 ? (x % 2 ? c : rmp[2]) : T.INK);
        if (Math.abs(x) < hw2) p.set(mx + x, my + curve + 2, T.INK);
      }
      return;
    }
    // the glow fills the base's own eye: anchors.eyeR for bases with big eyes (the eyeball, the owl)
    const r = an.eyeR || (k < 1.3 ? 1 : k < 1.8 ? 1.5 : 2);
    const doEye = (e, small) => {
      const rr = small ? Math.max(0.5, r - 0.8) : r;
      for (let y = -Math.ceil(rr); y <= Math.ceil(rr); y++) for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
        if (Math.hypot(x, y * 1.1) > rr + 0.35) continue;
        p.set(e[0] + x, e[1] + y, x + y < 0 ? rmp[2] : rmp[1]);
      }
      p.set(e[0], e[1], rmp[3]);
      o.fx.set(e[0] + (small ? 0 : -Math.round(rr * 0.5)), e[1] - Math.round(rr), '#ffffff');
      // the glow: one lighter pixel out to the side on the body
      const gx = e[0] + Math.ceil(rr) + 1, gy = e[1];
      if (o.base.get(gx, gy) != null) o.fx.set(gx, gy, T.mix(o.base.get(gx, gy), c, 0.55));
    };
    for (const e of eyes) doEye(e, false);
    if (st === 'many') {
      // 4–6 more small glowing eyes clustered above the main pair
      const cx = eyes.reduce((s, e) => s + e[0], 0) / eyes.length, cy = Math.min(...eyes.map((e) => e[1]));
      const spread = Math.max(3, Math.abs((eyes[1] || eyes[0])[0] - eyes[0][0]) * 0.75 + 1);
      const extra = k < 1.3 ? 4 : 6;
      for (let i = 0; i < extra; i++) {
        const t = extra === 1 ? 0.5 : i / (extra - 1);
        const x = Math.round(cx - spread + t * 2 * spread), y = Math.round(cy - (1.6 + Math.sin(t * Math.PI) * 1.6) * k);
        if (o.base.get(x, y) == null) continue;
        p.set(x, y, rmp[2]); if (k >= 1.5) { p.set(x + 1, y, rmp[1]); o.fx.set(x, y, rmp[3]); }
      }
    }
  };

  // ---------------------------------------------------------------- eye3 第三の目 (brow)
  PARTS.eye3 = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const c = o.c || '#ff4040';
    const w = k < 1.3 ? 1 : k < 1.8 ? 1.5 : 2, h = k < 1.3 ? 2.5 : k < 1.8 ? 3.2 : 4.2;
    const base = o.base.get(a[0], a[1]) || '#806070';
    const lid = T.dk(base, 0.55);
    const iris = T.ramp(c, 4, { dark: 0.5, light: 0.7 });
    for (let y = -Math.ceil(h) - 1; y <= Math.ceil(h) + 1; y++) for (let x = -Math.ceil(w) - 1; x <= Math.ceil(w) + 1; x++) {
      const d = (x / (w + 0.5)) ** 2 + (y / (h + 0.5)) ** 2;
      const d2 = (x / (w + 1.4)) ** 2 + (y / (h + 1.2)) ** 2;
      if (d <= 1) p.set(a[0] + x, a[1] + y, Math.abs(x) <= Math.max(0, Math.round(w) - 1) || w < 1.3 ? (Math.abs(y) <= 0.6 * h ? iris[y < 0 ? 2 : 1] : '#f0e8e0') : '#f0e8e0');
      else if (d2 <= 1) p.set(a[0] + x, a[1] + y, lid);
    }
    // slit pupil and a glint
    for (let y = -Math.round(h * 0.45); y <= Math.round(h * 0.45); y++) p.set(a[0], a[1] + y, '#200810');
    o.fx.set(a[0] - (w >= 1.5 ? 1 : 0), a[1] - Math.round(h * 0.5), '#ffffff');
  };

  // ---------------------------------------------------------------- mask 面 (eyes)
  PARTS.mask = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, hw = headW(o);
    const eyes = Array.isArray(a[0]) ? a : [a];
    const ex0 = Math.min(...eyes.map((e) => e[0])), ex1 = Math.max(...eyes.map((e) => e[0]));
    const ey = Math.min(...eyes.map((e) => e[1]));
    const cx = Math.round((ex0 + ex1) / 2);
    const rmp = T.ramp(o.c || '#e8e0d0', 5, { dark: 0.5, light: 0.5 });
    const m = T.mask(p.w, p.h);
    if (o.style === 'bone') {
      // a skull face: domed brow, cheekbones, a narrowing jaw with teeth
      const w = Math.max(ex1 - ex0 + Math.round(4 * k), Math.round(hw * 0.75));
      const top = ey - Math.round(3 * k), bot = Math.max(an.mouth[1] + Math.round(1 * k), ey + Math.round(4 * k));
      m.ellipse(cx, ey, w / 2, Math.round(ey - top), 1);
      m.poly([[cx - w / 2, ey], [cx + w / 2 + 1, ey], [cx + w * 0.3 + 1, bot], [cx - w * 0.3, bot]], 1);
      p.blit(T.shade(m, rmp, { depth: 2, global: 0.35 }), 0, 0);
      // sockets
      for (const e of eyes) {
        const sr = k < 1.3 ? 1.2 : k < 1.8 ? 1.6 : 2.2;
        for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x / (sr + 0.4), y / sr) <= 1) p.set(e[0] + x, e[1] + y, y <= 0 ? '#201018' : '#382830');
        o.fx.set(e[0], e[1], '#ff6040');
      }
      // nose and teeth
      p.set(cx, ey + Math.round(2 * k), '#302028'); if (k >= 1.5) p.set(cx + 1, ey + Math.round(2 * k), '#302028');
      for (let x = Math.round(cx - w * 0.25); x <= Math.round(cx + w * 0.25); x++) { p.set(x, bot - 1, x % 2 ? rmp[4] : '#403038'); }
      // cracks
      p.set(Math.round(cx + w * 0.3), top + 1, rmp[1]); p.set(Math.round(cx + w * 0.3) - 1, top + 2, rmp[1]);
      return;
    }
    // a plain domino mask over the eyes
    const w = ex1 - ex0 + Math.round(5 * k), h = Math.round(2 + 1.5 * k);
    m.ellipse(cx, ey, w / 2, h / 2 + 0.5, 1);
    p.blit(T.shade(m, rmp, { depth: 1.5 }), 0, 0);
    for (const e of eyes) { p.set(e[0], e[1], '#100810'); if (k >= 1.5) p.set(e[0] + 1, e[1], '#100810'); }
  };

  // ---------------------------------------------------------------- ribbon リボン (head or neck)
  PARTS.ribbon = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, hw = headW(o);
    const rmp = T.ramp(o.c || '#ff70a0', 5, { dark: 0.55, light: 0.55 });
    const atNeck = o.style === 'neck';
    const x = atNeck ? an.neck[0] : a[0] + Math.round(hw * 0.3), y = atNeck ? an.neck[1] : Math.max(Math.round(2.5 * k), a[1] - Math.round(1 * k));
    const L = 2.2 * k;
    const m = T.mask(p.w, p.h);
    for (const s of [-1, 1]) {
      m.poly([[x, y], [x + s * L * 1.3, y - L * 0.8], [x + s * L * 1.4, y + L * 0.7]], 1);
      T.tube(m, [[x, y], [x + s * L * 0.5, y + L], [x + s * L * 0.8, y + L * 1.8]], 0.55 * k, 0.5 * k, 1, 8);
    }
    p.blit(T.shade(m, rmp, { depth: 1.2, amb: 0.2 }), 0, 0);
    // knot and the fold shadows inside the loops
    p.set(x, y, rmp[3]); if (k >= 1.5) { p.set(x, y + 1, rmp[1]); p.set(x - 1, y, rmp[2]); }
    for (const s of [-1, 1]) p.set(Math.round(x + s * L * 0.8), y, rmp[1]);
  };
})(window.RPG);
