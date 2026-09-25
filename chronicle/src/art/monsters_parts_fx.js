// Monster parts, effects (A14a mons-parts, DESIGN §9.4.4): embers bubbles sparks aura smoke mist storm flame.
// Light and vapour live mostly in opts.fx (never outlined, §11.4.2: opaque pixels only, "see-through" is a
// checker dither). Back-layer effects (aura, smoke, storm) are composited behind the base.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const PARTS = (A.PARTS = A.PARTS || {});
  const TK = () => A.PartTK;

  /** distance (in px, up to max) from (x,y) to the nearest solid pixel, via opts.solid */
  function distOut(o, x, y, max) {
    for (let r = 1; r <= max; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (dx * dx + dy * dy > r * r + r) continue;
        if (o.solid(x + dx, y + dy)) return r;
      }
    }
    return max + 1;
  }
  const around = (o) => o.info.bbox;

  // ---------------------------------------------------------------- embers 火の粉 (body)
  PARTS.embers = (p, a, o) => {
    const T = TK(), k = o.baseK, info = o.info, b = info.bbox;
    const c = o.c || '#ff7020';
    const hot = T.mix(c, '#fff0a0', 0.6), dim = T.dk(c, 0.55);
    // glowing cracks: short branching zigzags inside the body
    const n = k < 1.3 ? 3 : k < 1.8 ? 4 : 6;
    for (let i = 0; i < n; i++) {
      let x = Math.round(a[0] + (o.rng() - 0.5) * (b.x1 - b.x0) * 0.6), y = Math.round(a[1] + (o.rng() - 0.5) * (b.y1 - b.y0) * 0.45);
      if (!info.inner(x, y)) continue;
      const len = Math.round(3 + 2.5 * k);
      let dx = o.rng() < 0.5 ? -1 : 1;
      for (let j = 0; j < len; j++) {
        if (!info.inner(x, y) || !info.inner(x + 1, y) || !info.inner(x - 1, y)) break;
        p.set(x, y, j % 3 === 1 ? hot : c);
        if (k >= 1.5 && j % 2 === 0) p.set(x + 1, y, dim);
        y += 1; if (o.rng() < 0.55) x += dx; if (o.rng() < 0.2) dx = -dx;
      }
    }
    // floating sparks rising above the body
    const m = k < 1.3 ? 5 : 8;
    for (let i = 0; i < m; i++) {
      const x = Math.round(b.x0 + o.rng() * (b.x1 - b.x0)), y = Math.round(b.y0 - 1 + o.rng() * (b.y1 - b.y0) * 0.5);
      if (o.solid(x, y)) continue;
      o.fx.set(x, y, i % 3 === 0 ? '#fff0b0' : hot);
      if (i % 3 === 0 && k >= 1.5) o.fx.set(x, y + 1, c);
    }
  };

  // ---------------------------------------------------------------- bubbles 泡 (around)
  PARTS.bubbles = (p, a, o) => {
    const T = TK(), k = o.baseK, b = around(o), info = o.info;
    const c = o.c || '#c8f0ff';
    const rim = T.ramp(c, 3, { dark: 0.35, light: 0.6 });
    const ring = (x, y, r) => {
      if (r <= 1) { o.fx.set(x, y, rim[2]); o.fx.set(x + 1, y, rim[1]); o.fx.set(x, y + 1, rim[1]); o.fx.set(x + 1, y + 1, rim[0]); return; }
      for (let t = 0; t < 360; t += 8) {
        const ang = (t * Math.PI) / 180;
        o.fx.set(Math.round(x + Math.cos(ang) * r), Math.round(y + Math.sin(ang) * r), Math.cos(ang) + Math.sin(ang) < -0.3 ? rim[2] : rim[1]);
      }
      o.fx.set(x - Math.round(r * 0.45), y - Math.round(r * 0.45), '#ffffff');
    };
    const placed = [];
    const free = (x, y, r) => placed.every((q) => Math.hypot(q[0] - x, q[1] - y) >= q[2] + r + 1.5);
    // bubbles rising around the top of the body
    const nOut = 3 + Math.floor(o.rng() * 2);
    for (let i = 0, tries = 0; i < nOut && tries < 80; tries++) {
      const r = Math.max(1, Math.round((0.8 + o.rng() * 1.3) * k));
      const x = Math.round(b.x0 + r + o.rng() * (b.x1 - b.x0 - 2 * r)), y = Math.round(Math.max(r, b.y0 - 1 - o.rng() * 3 * k + (i % 2) * (b.y1 - b.y0) * 0.3));
      if (!free(x, y, r) || o.solid(x, y) || o.solid(x, y + r + 1)) continue;
      placed.push([x, y, r]); ring(x, y, r); i++;
    }
    // bubbles inside a soft body (jellies, water creatures): rings a shade lighter than the body
    const nIn = 2 + Math.floor(o.rng() * 2);
    for (let i = 0, tries = 0; i < nIn && tries < 80; tries++) {
      const r = Math.max(1, Math.round((0.7 + o.rng() * 0.9) * k));
      const x = Math.round(a[0] + (o.rng() - 0.5) * (b.x1 - b.x0) * 0.6), y = Math.round(a[1] + (o.rng() - 0.7) * (b.y1 - b.y0) * 0.5);
      let ok = free(x, y, r);
      for (let d = 0; d <= r + 1 && ok; d++) if (!info.inner(x + d, y) || !info.inner(x - d, y) || !info.inner(x, y + d) || !info.inner(x, y - d)) ok = false;
      if (!ok) continue;
      placed.push([x, y, r]); ring(x, y, r); i++;
    }
  };

  // ---------------------------------------------------------------- sparks 火花 (around)
  PARTS.sparks = (p, a, o) => {
    const T = TK(), k = o.baseK, b = around(o), info = o.info;
    const c = o.c || '#fff080';
    const core = T.mix(c, '#ffffff', 0.65), edge = T.dk(c, 0.7);
    // jagged bolts starting on the silhouette edge and crackling outward
    const pts = T.contour(info, 'any');
    const n = k < 1.3 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      const q = pts[Math.floor(((i + o.rng() * 0.6) / n) * pts.length) % pts.length];
      if (!q) break;
      let x = q.x + q.nx, y = q.y + q.ny;
      let dx = q.nx, dy = q.ny;
      const L = Math.round(3 + 3 * k);
      for (let j = 0; j < L; j++) {
        // turn sharply every 2 px: a zigzag
        if (j % 2 === 1) { const t = dx; dx = dx * 0.6 - dy * (j % 4 === 1 ? 0.8 : -0.8); dy = dy * 0.6 + t * (j % 4 === 1 ? 0.8 : -0.8); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
        x += dx; y += dy;
        const X = Math.round(x), Y = Math.round(y);
        if (o.solid(X, Y)) continue;
        o.fx.set(X, Y, j < L / 2 ? core : c);
        if (k >= 1.5 && j < L / 3) { const X2 = Math.round(x - dy), Y2 = Math.round(y + dx); if (!o.solid(X2, Y2)) o.fx.set(X2, Y2, edge); }
      }
      o.fx.set(Math.round(x), Math.round(y), '#ffffff');
    }
    // crackle on the body itself and loose sparks
    for (let i = 0; i < 3 + Math.round(2 * k); i++) {
      const x = Math.round(b.x0 + o.rng() * (b.x1 - b.x0)), y = Math.round(b.y0 + o.rng() * (b.y1 - b.y0));
      if (info.inner(x, y) && info.inner(x + 1, y)) { o.fx.set(x, y, core); o.fx.set(x + 1, y + (i & 1 ? 1 : -1), c); }
      else if (!o.solid(x, y)) o.fx.set(x, y, c);
    }
  };

  // ---------------------------------------------------------------- aura オーラ (outside the outline, back)
  PARTS.aura = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const c = o.c || '#c090ff';
    const outer = T.mix(c, '#000000', 0.25);
    const W = p.w, H = p.h;
    const thick = k < 1.3 ? 1 : 2;
    // o.solid covers the base and every part drawn so far plus the 1-px ring their outline will take,
    // so the glow always starts right outside the finished outline
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (o.solid(x, y)) continue;
      const d = distOut(o, x, y, thick + 1);
      if (d > thick + 1) continue;
      const far = d > thick || (thick > 1 && d === thick);
      if (far && (x + y) % 2) continue; // thinned toward the outside
      o.fx.set(x, y, d > thick ? outer : far ? T.mix(c, outer, 0.5) : c);
    }
    // a few motes drifting up from the glow
    const b = o.info.bbox;
    for (let i = 0; i < 3 + Math.round(k); i++) {
      const x = Math.round(b.x0 + o.rng() * (b.x1 - b.x0)), y = Math.round(Math.max(0, b.y0 - 1 + o.rng() * (b.y1 - b.y0) * 0.6));
      if (!o.solid(x, y) && distOut(o, x, y, 3) >= 3) o.fx.set(x, y, T.mix(c, '#ffffff', 0.4));
    }
  };

  // ---------------------------------------------------------------- smoke 煙 (around, back)
  PARTS.smoke = (p, a, o) => {
    const T = TK(), k = o.baseK, b = around(o), info = o.info;
    const rmp = T.ramp(o.c || '#a0a0a0', 4, { dark: 0.5, light: 0.45 });
    // puffs billowing out from behind the silhouette: centred just outside its sides and top
    const n = k < 1.3 ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const top = i === n - 1;
      const y = top ? Math.max(1, b.y0 + Math.round(1 * k)) : Math.round(b.y0 + (b.y1 - b.y0) * (0.15 + (i / n) * 0.6 + o.rng() * 0.08));
      const edge = top ? a[0] + Math.round((o.rng() - 0.5) * (b.x1 - b.x0) * 0.4) : side < 0 ? info.left[y] : info.right[y];
      if (edge < 0) continue;
      const cx = top ? edge : edge + side * Math.round(1 + 1.2 * k), cy = y;
      const puffs = [[0, 0, 1], [-1.1, 0.7, 0.8], [1.1, 0.6, 0.75], [0.2, -0.9, 0.7]];
      for (const [ox, oy, rs] of puffs) {
        const r = (1.1 + o.rng() * 0.7) * k * rs + 0.6;
        const px = cx + ox * r, py = cy + oy * r;
        for (let yy = Math.floor(py - r); yy <= Math.ceil(py + r); yy++) for (let xx = Math.floor(px - r); xx <= Math.ceil(px + r); xx++) {
          const d = Math.hypot(xx - px, yy - py);
          if (d > r) continue;
          if (d > r - 0.9 && (xx + yy) % 2) continue;
          const lit = (xx - px) * -0.6 + (yy - py) * -0.8;
          o.fx.set(xx, yy, lit > r * 0.35 ? rmp[3] : lit > -r * 0.2 ? rmp[2] : rmp[1]);
        }
      }
    }
  };

  // ---------------------------------------------------------------- mist 霧 (feet, front)
  PARTS.mist = (p, a, o) => {
    const T = TK(), k = o.baseK, b = around(o);
    const c = o.c || '#e0f0ff';
    const rmp = T.ramp(c, 3, { dark: 0.3, light: 0.4 });
    const y0 = Math.min(p.h - 2, a[1]);
    const w = Math.round((b.x1 - b.x0) * 0.62 + 4 * k), h = Math.round(2 + 1.5 * k);
    for (let y = y0 - h; y <= y0 + 1; y++) for (let x = a[0] - w; x <= a[0] + w; x++) {
      const t = (x - a[0]) / w;
      const top = y0 - h * (1 - t * t) - Math.round(Math.sin(x * 0.7 + o.seed) * 0.9);
      if (y < top) continue;
      const edge = y - top < 1 || Math.abs(t) > 0.85;
      if (edge && (x + y) % 2) continue;
      // see-through band: a checker in the middle rows so the feet show through
      if (!edge && y > top + 1 && (x + y) % 2 && y < y0) continue;
      o.fx.set(x, y, y - top < 1.5 ? rmp[2] : rmp[1]);
    }
    // wisps rising
    for (let i = 0; i < 3; i++) {
      const x = Math.round(a[0] + (o.rng() - 0.5) * w * 1.6), y = y0 - h - 1 - Math.round(o.rng() * 2 * k);
      o.fx.set(x, y, rmp[2]); o.fx.set(x + 1, y, rmp[1]);
    }
  };

  // ---------------------------------------------------------------- storm 風の渦 (around, back)
  PARTS.storm = (p, a, o) => {
    const T = TK(), k = o.baseK, b = around(o);
    const c = o.c || '#c0d8f0';
    const hi = T.mix(c, '#ffffff', 0.5), lo = T.dk(c, 0.72);
    // the half of a ring that passes in front of the body goes to a front layer (a wind wrapping round it)
    const F = o.extra('front').fx;
    if (o.style === 'whirl') {
      // a whirlpool round the feet: 4 spiralling rings of foam and dark water, the near half in front
      const fx = o.anchors.feet[0], fy = Math.min(p.h - 3, o.anchors.feet[1] - Math.round(2 * k));
      const R0 = (b.x1 - b.x0) * 0.6;
      for (let ring = 0; ring < 4; ring++) {
        const rx = R0 * (1 - ring * 0.19), ry = Math.max(2, rx * 0.24);
        const col = ring % 2 ? lo : ring === 0 ? hi : c;
        for (let t = 0; t < 360; t += 2) {
          if ((t + ring * 90) % 180 > 150) continue;
          const ang = (t * Math.PI) / 180;
          const x = Math.round(fx + Math.cos(ang) * rx), y = Math.round(fy + Math.sin(ang) * ry - (t / 360) * k);
          (Math.sin(ang) > 0 ? F : o.fx).set(x, y, col);
          if (k >= 1.5 && ring < 2) (Math.sin(ang) > 0 ? F : o.fx).set(x, y + 1, ring ? c : lo);
        }
      }
      for (let i = 0; i < 8; i++) { const ang = o.rng() * Math.PI * 2; F.set(Math.round(fx + Math.cos(ang) * R0 * 1.05), Math.round(fy + Math.sin(ang) * R0 * 0.26) - 1, '#ffffff'); }
      return;
    }
    // wind: streaks wrapping round the body (far half behind it, near half in front), 2 px thick on m / l,
    // dark tail → light head, broken into dashes, with a few leaves carried along
    const n = k < 1.3 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const cy = b.y0 + (b.y1 - b.y0) * (0.18 + (i / Math.max(1, n - 1)) * 0.66);
      const rx = (b.x1 - b.x0) * (0.55 + 0.08 * (i % 2)), ry = (b.y1 - b.y0) * (0.1 + 0.03 * (i % 3));
      const a0 = o.rng() * Math.PI, span = Math.PI * (1.3 + o.rng() * 0.3);
      for (let t = 0; t <= 1; t += 0.012) {
        if (Math.floor(t * 10 + i * 1.7) % 6 === 5) continue;
        const ang = a0 + span * t;
        const x = Math.round(a[0] + Math.cos(ang) * rx), y = Math.round(cy + Math.sin(ang) * ry);
        const L = Math.sin(ang) > 0 ? F : o.fx;
        L.set(x, y, t < 0.3 ? lo : t < 0.7 ? c : hi);
        if (k >= 1.5 && t > 0.2 && t < 0.85) L.set(x, y + 1, t < 0.5 ? lo : c);
      }
    }
    for (let i = 0; i < 2 + Math.round(k); i++) {
      const lx = Math.round(b.x0 + o.rng() * (b.x1 - b.x0)), ly = Math.round(b.y0 + o.rng() * (b.y1 - b.y0) * 0.8);
      if (o.solid(lx, ly)) continue;
      o.fx.set(lx, ly, hi); o.fx.set(lx + 1, ly - 1, c); if (k >= 1.5) o.fx.set(lx - 1, ly, lo);
    }
  };

  // ---------------------------------------------------------------- flame 炎 (head / back, or from the mouth)
  function tongue(p, x, y, h, w, dirx, ramp, T) {
    // a teardrop of fire pointing up (dirx leans the tip); ramp dark→white by height
    const m = T.mask(p.w, p.h);
    const tip = [x + dirx * h * 0.35, y - h];
    T.tube(m, [[x, y], [x - dirx * w * 0.4, y - h * 0.45], tip], w, 0.3, 1, 12);
    const n = ramp.length;
    m.each((xx, yy) => {
      const t = (y - yy) / h;
      const cen = Math.abs(xx - (x + (tip[0] - x) * t)) / Math.max(0.8, w * (1 - t * 0.7));
      const idx = T.clamp(Math.round((1 - cen) * (n - 1) * 0.8 + (1 - t) * 1.2), 0, n - 1);
      p.set(xx, yy, ramp[idx]);
      return undefined;
    });
  }
  PARTS.flame = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors, info = o.info;
    const c = o.c || '#ff8020';
    const ramp = [T.dk(c, 0.55), T.dk(c, 0.8), c, T.mix(c, '#ffe060', 0.55), T.mix(c, '#fff8d0', 0.8)];
    if (o.style === 'mouth') {
      // a cone of fire breathed out to the side the head faces
      const [mx, my] = an.mouth;
      const dir = mx < an.body[0] ? -1 : 1;
      const L = Math.round(6 + 4 * k);
      for (let i = 0; i < L; i++) {
        const x = mx + dir * i, spread = 0.6 + i * 0.35;
        for (let d = -Math.ceil(spread); d <= Math.ceil(spread); d++) {
          const y = my + d + Math.round(Math.sin(i * 0.9 + d) * 0.6);
          const t = Math.abs(d) / (spread + 0.5), u = i / L;
          if (t > 1 || (u > 0.75 && (x + y) % 2)) continue;
          const idx = T.clamp(Math.round((1 - t) * 3 + (1 - u) * 1.5) - 1, 0, 4);
          o.fx.set(x, y, ramp[idx]);
        }
      }
      o.fx.set(mx + dir, my, '#fffff0');
      return;
    }
    // a burning mane: tongues along the top of the head and the back
    const hx = an.head[0], hw = an.headW || Math.round(10 * k);
    const pts = T.contour(info, 'up').filter((q) => q.ny < -0.45 && Math.abs(q.x - hx) <= hw * 0.9 + 2 * k && q.y <= an.head[1] + 3 * k);
    const pick = [];
    pts.sort((p1, p2) => p1.x - p2.x);
    for (const q of pts) if (!pick.length || q.x - pick[pick.length - 1].x >= Math.round(1.6 + 1.2 * k)) pick.push(q);
    pick.forEach((q, i) => {
      const mid = 1 - Math.abs(q.x - hx) / (hw + 2);
      const h = Math.round((2.5 + 3 * k) * (0.55 + mid * 0.6) * (i % 2 ? 0.8 : 1));
      tongue(p, q.x, q.y + 1, Math.min(h, q.y + 1), 0.9 + 0.5 * k, q.x < hx ? -1 : 1, ramp, T);
    });
    // sparks above
    for (let i = 0; i < 3; i++) { const x = Math.round(hx + (o.rng() - 0.5) * hw * 1.4), y = Math.max(0, an.head[1] - Math.round((5 + o.rng() * 4) * k)); if (!o.solid(x, y)) o.fx.set(x, y, ramp[3]); }
  };
})(window.RPG);
