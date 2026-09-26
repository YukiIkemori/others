// Code-only sprite rasterizer (no image files, no image API).
// A sprite is a list of 2.5D primitives (ellipsoids, tapered capsules, bevelled polygons, rects) in
// model units (1 unit = 1 sprite pixel at scale 1). Each pixel resolves a z-buffer, gets a surface
// normal from its primitive, and is shaded per material ramp (quantised = crisp pixel-art bands),
// with ambient occlusion lines between overlapping parts, selective outline, rim light, specular
// glints and point lights from the scene. Same primitives render at scale 1 (fine pixel sprite) or
// scale 3-4 (smooth, supersampled).
'use strict';
(function (G) {
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Build a ramp of n colours from key colours (dark → light), hue-shifting shadows cool / lights warm.
  function ramp(keys, n) {
    const k = keys.map(hex), out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) * (k.length - 1), j = Math.min(k.length - 2, Math.floor(t));
      out.push(mix(k[j], k[j + 1], t - j));
    }
    return out;
  }
  function mat(o) {
    const m = Object.assign({ n: 7, spec: 0, specPow: 18, rim: '#ffe2b0', rimK: 0.55, wrap: 0.25, amb: 0.18, flat: false, outline: null, ao: 1 }, o);
    m.r = ramp(m.keys, m.n);
    m.rimC = hex(m.rim);
    m.ol = m.outline ? hex(m.outline) : m.r[0].map((v) => v * 0.45);
    if (m.glow) m.glowC = hex(m.glow);
    return m;
  }

  class Builder {
    constructor() { this.p = []; this.gid = 1; }
    group() { return this.gid++; }
    add(o) { if (o.g == null) o.g = this.gid++; o.z = o.z || 0; this.p.push(o); return o; }
    ell(x, y, rx, ry, m, z, o) { return this.add(Object.assign({ t: 'e', x, y, rx, ry, rot: 0, m, z, bulge: 1 }, o)); }
    cap(x1, y1, x2, y2, r1, r2, m, z, o) { return this.add(Object.assign({ t: 'c', x1, y1, x2, y2, r1, r2, m, z }, o)); }
    poly(pts, m, z, o) { return this.add(Object.assign({ t: 'p', pts, m, z, bevel: 2, nx: 0, ny: 0 }, o)); }
    rect(x, y, w, h, m, z, o) { return this.add(Object.assign({ t: 'r', x, y, w, h, m, z }, o)); }
    // bezier strand (quadratic or cubic) → chain of tapered capsules sharing one group
    strand(pts, w0, w1, m, z, o) {
      o = o || {}; const g = o.g != null ? o.g : this.gid++, N = o.seg || 6;
      const bz = (t) => {
        if (pts.length === 3) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * pts[0][0] + b * pts[1][0] + c * pts[2][0], a * pts[0][1] + b * pts[1][1] + c * pts[2][1]]; }
        const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
        return [a * pts[0][0] + b * pts[1][0] + c * pts[2][0] + d * pts[3][0], a * pts[0][1] + b * pts[1][1] + c * pts[2][1] + d * pts[3][1]];
      };
      let prev = bz(0);
      for (let i = 1; i <= N; i++) {
        const t = i / N, cur = bz(t);
        this.add(Object.assign({}, o, { t: 'c', x1: prev[0], y1: prev[1], x2: cur[0], y2: cur[1], r1: w0 + (w1 - w0) * (i - 1) / N, r2: w0 + (w1 - w0) * t, m, z: z + i * 0.001, g }));
        prev = cur;
      }
      return g;
    }
    // shade modifier: shifts ramp index for pixels of target group(s) that fall inside a capsule
    fold(x1, y1, x2, y2, r, target, d) { this.p.push({ t: 'c', x1, y1, x2, y2, r1: r, r2: r * 0.6, mod: true, target, d }); }
  }

  // ---- coverage / normal per primitive (model space point) → null or {nx,ny,nz}
  function hit(p, x, y, sc) {
    if (p.t === 'e') {
      let dx = x - p.x, dy = y - p.y;
      if (p.rot) { const c = Math.cos(-p.rot), s = Math.sin(-p.rot); const t = dx * c - dy * s; dy = dx * s + dy * c; dx = t; }
      const u = dx / p.rx, v = dy / p.ry, r2 = u * u + v * v;
      if (r2 > 1) return null;
      let nx = u * p.bulge, ny = v * p.bulge;
      if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot); const t = nx * c - ny * s; ny = nx * s + ny * c; nx = t; }
      return [nx, ny, Math.sqrt(Math.max(0, 1 - r2)) + (1 - p.bulge)];
    }
    if (p.t === 'c') {
      const vx = p.x2 - p.x1, vy = p.y2 - p.y1, L2 = vx * vx + vy * vy || 1e-6;
      const t = clamp(((x - p.x1) * vx + (y - p.y1) * vy) / L2, 0, 1);
      const qx = p.x1 + vx * t, qy = p.y1 + vy * t, r = p.r1 + (p.r2 - p.r1) * t;
      const dx = x - qx, dy = y - qy, d2 = dx * dx + dy * dy;
      if (d2 > r * r) return null;
      const k = 1 / Math.max(r, 1e-3);
      return [dx * k, dy * k, Math.sqrt(Math.max(0, 1 - d2 * k * k))];
    }
    if (p.t === 'r') {
      const hw = p.w / 2, hh = p.h / 2, dx = (x - p.x - hw) / hw, dy = (y - p.y - hh) / hh;
      if (sc > 1.5) { if (dx ** 4 + dy ** 4 > 1) return null; } else if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return null;
      return [dx * 0.3, dy * 0.3, 1];
    }
    if (p.t === 'p') {
      const pts = p.pts; let inside = false, best = 1e9, bx = 0, by = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
        const vx = xj - xi, vy = yj - yi, L2 = vx * vx + vy * vy || 1e-6;
        const t = clamp(((x - xi) * vx + (y - yi) * vy) / L2, 0, 1), qx = xi + vx * t, qy = yi + vy * t;
        const d = (x - qx) ** 2 + (y - qy) ** 2;
        if (d < best) { best = d; bx = x - qx; by = y - qy; }
      }
      if (!inside) return null;
      const d = Math.sqrt(best); let nx = p.nx, ny = p.ny;
      if (d < p.bevel && d > 1e-4) { const tl = (1 - d / p.bevel) * 0.85; nx -= bx / d * tl; ny -= by / d * tl; }
      const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
      return [nx, ny, nz];
    }
    return null;
  }
  function bbox(p) {
    if (p.t === 'e') { const r = Math.max(p.rx, p.ry); return [p.x - r, p.y - r, p.x + r, p.y + r]; }
    if (p.t === 'c') { const r = Math.max(p.r1, p.r2); return [Math.min(p.x1, p.x2) - r, Math.min(p.y1, p.y2) - r, Math.max(p.x1, p.x2) + r, Math.max(p.y1, p.y2) + r]; }
    if (p.t === 'r') return [p.x, p.y, p.x + p.w, p.y + p.h];
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const q of p.pts) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b, c, d];
  }

  const DEF_LIGHT = { key: [-0.55, -0.6, 0.58], rim: [0.8, -0.25, -0.55], mul: [1, 1, 1], pts: [], rimC: null, rimK: 1 };

  // render(builder, {scale, flip, light, outline, ssaa}) → {canvas, ox, oy}  (ox,oy = model origin in canvas px)
  function render(B, o) {
    o = Object.assign({ scale: 1, flip: false, outline: true, ssaa: 1, pad: 2, wx: 0, wy: 0 }, o);
    const L = Object.assign({}, DEF_LIGHT, o.light || {});
    const sc = o.scale * o.ssaa, fl = o.flip ? -1 : 1;
    const prims = B.p.filter((p) => !p.mod), mods = B.p.filter((p) => p.mod);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of prims) { const b = bbox(p); const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0]; x0 = Math.min(x0, ax); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, bx); y1 = Math.max(y1, b[3]); }
    const pad = o.pad * o.ssaa;
    const ox = Math.ceil(-x0 * sc) + pad, oy = Math.ceil(-y0 * sc) + pad;
    const W = Math.ceil((x1 - x0) * sc) + pad * 2 + 1, H = Math.ceil((y1 - y0) * sc) + pad * 2 + 1;
    const N = W * H;
    const zb = new Float32Array(N).fill(-1e9), pid = new Int32Array(N).fill(-1);
    const nxb = new Float32Array(N), nyb = new Float32Array(N), nzb = new Float32Array(N), dl = new Float32Array(N);
    prims.forEach((p, i) => {
      const b = bbox(p);
      const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0];
      const px0 = Math.max(0, Math.floor(ax * sc + ox) - 1), px1 = Math.min(W - 1, Math.ceil(bx * sc + ox) + 1);
      const py0 = Math.max(0, Math.floor(b[1] * sc + oy) - 1), py1 = Math.min(H - 1, Math.ceil(b[3] * sc + oy) + 1);
      for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
        const mx = fl * (px + 0.5 - ox) / sc, my = (py + 0.5 - oy) / sc;
        const n = hit(p, mx, my, sc); if (!n) continue;
        const k = py * W + px, z = p.z + (p.zr ? n[2] * p.zr : 0);
        if (z >= zb[k]) { zb[k] = z; pid[k] = i; nxb[k] = n[0] * fl; nyb[k] = n[1]; nzb[k] = n[2]; }
      }
    });
    // shade modifiers (folds, seams)
    for (const q of mods) {
      const b = bbox(q); const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0];
      for (let py = Math.max(0, Math.floor(b[1] * sc + oy)); py <= Math.min(H - 1, Math.ceil(b[3] * sc + oy)); py++)
        for (let px = Math.max(0, Math.floor(ax * sc + ox)); px <= Math.min(W - 1, Math.ceil(bx * sc + ox)); px++) {
          const k = py * W + px; if (pid[k] < 0) continue;
          const g = prims[pid[k]].g; if (q.target !== g && !(Array.isArray(q.target) && q.target.includes(g))) continue;
          if (hit(q, fl * (px + 0.5 - ox) / sc, (py + 0.5 - oy) / sc, sc)) dl[k] += q.d;
        }
    }
    // ambient occlusion lines: a pixel next to a nearer part of another group darkens
    const aoR = Math.max(1, Math.round(o.scale * o.ssaa * 0.6));
    const occl = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x; if (pid[k] < 0) continue; const p = prims[pid[k]]; if (!p.m.ao || p.m.flat) continue;
      let hitN = 0;
      for (let d = 1; d <= aoR && !hitN; d++) for (const [ddx, ddy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
        const xx = x + ddx, yy = y + ddy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const kk = yy * W + xx; if (pid[kk] < 0) continue; const q = prims[pid[kk]];
        if (q.g !== p.g && zb[kk] > zb[k] + 0.3 && !q.noAO) { hitN = 1; break; }
      }
      occl[k] = hitN;
    }
    const key = norm3(L.key), rim = norm3(L.rim);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'), img = cx.createImageData(W, H), D = img.data;
    const view = [0, 0, 1];
    for (let k = 0; k < N; k++) {
      if (pid[k] < 0) continue;
      const p = prims[pid[k]], m = p.m, n = [nxb[k], nyb[k], nzb[k]];
      let col;
      const R = m.r, nn = R.length;
      if (m.flat) { col = R[clamp(Math.round((p.shade != null ? p.shade : nn - 1) + dl[k]), 0, nn - 1)]; }
      else {
        let lam = (n[0] * key[0] + n[1] * key[1] + n[2] * key[2] + m.wrap) / (1 + m.wrap);
        lam = clamp(lam, 0, 1);
        let lv = m.amb + (1 - m.amb) * lam;
        if (m.metal) { // environment-ish banding for metal: sky above, ground below, dark horizon band
          const e = -n[1] * 0.5 + 0.5; lv = clamp(lv * 0.65 + (e > 0.62 ? 0.45 : e < 0.38 ? 0.08 : -0.12), 0, 1);
        }
        let idx = lv * (nn - 1) + dl[k] - occl[k] * (m.ao) + (p.shadeOff || 0);
        if (m.spec) {
          const d = 2 * (n[0] * key[0] + n[1] * key[1] + n[2] * key[2]);
          const rz = d * n[2] - key[2]; const s = Math.pow(Math.max(0, rz), m.specPow);
          if (s > 0.55) idx += m.spec * 3;
        }
        if (m.sheen) { const ny = n[1]; if (ny > m.sheen[0] && ny < m.sheen[1] && lam > 0.25) idx += 1.6; }
        idx = clamp(Math.round(idx), 0, nn - 1);
        col = R[idx];
        if (m.spec && idx === nn - 1 && m.spec > 0.8) col = mix(col, [255, 255, 250], 0.5);
        // rim light from behind
        const rd = n[0] * rim[0] + n[1] * rim[1];
        const rt = Math.pow(1 - clamp(n[2], 0, 1), 1.5) * Math.max(0, rd) * L.rimK;
        if (rt > 0.32 && !occl[k]) col = mix(col, L.rimC || m.rimC, m.rimK * (rt > 0.55 ? 1 : 0.6));
      }
      let r = col[0] * L.mul[0], g = col[1] * L.mul[1], b = col[2] * L.mul[2];
      if (m.glow) { r = Math.max(r, col[0]); g = Math.max(g, col[1]); b = Math.max(b, col[2]); }
      // point lights (world space): model px → world
      if (L.pts.length && !m.glow) {
        const alb = R[Math.floor(nn * 0.6)];
        const x = (k % W - ox) / sc, y = (Math.floor(k / W) - oy) / sc;
        for (const pl of L.pts) {
          let dx = pl.x - (o.wx + x * (o.wk || 1)), dy = pl.y - (o.wy + y * (o.wk || 1)), dz = pl.z || 20;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dist > pl.r) continue;
          dx /= dist; dy /= dist; dz /= dist;
          let a = 1 - dist / pl.r; a = a * a;
          let ld = clamp((n[0] * dx + n[1] * dy + n[2] * dz + 0.2) / 1.2, 0, 1);
          ld = Math.round(ld * 4) / 4; // keep it banded
          const f = a * ld * pl.i;
          r += alb[0] * pl.c[0] * f; g += alb[1] * pl.c[1] * f; b += alb[2] * pl.c[2] * f;
        }
      }
      const q = k * 4; D[q] = clamp(r, 0, 255); D[q + 1] = clamp(g, 0, 255); D[q + 2] = clamp(b, 0, 255); D[q + 3] = m.alpha != null ? m.alpha * 255 : 255;
    }
    // outline
    if (o.outline) {
      const ow = o.ssaa;
      const src = new Uint8ClampedArray(D);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const k = y * W + x; if (pid[k] >= 0) continue;
        let best = -1, bz = -1e9;
        for (let dy = -ow; dy <= ow; dy++) for (let dx = -ow; dx <= ow; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > ow) continue;
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const kk = yy * W + xx; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; }
        }
        if (best < 0) continue; const p = prims[pid[best]]; if (p.m.noOutline) continue;
        let c = p.m.ol;
        // lit side outline is a deeper version of the local colour (softer), shadow side dark
        const lit = (x - best % W) * key[0] + (y - Math.floor(best / W)) * key[1] > 0;
        if (lit) c = mix(c, [src[best * 4], src[best * 4 + 1], src[best * 4 + 2]], 0.35);
        const q = k * 4; D[q] = c[0] * L.mul[0] ** 0.5; D[q + 1] = c[1] * L.mul[1] ** 0.5; D[q + 2] = c[2] * L.mul[2] ** 0.5; D[q + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    if (o.ssaa > 1) {
      const c2 = document.createElement('canvas'); c2.width = Math.ceil(W / o.ssaa); c2.height = Math.ceil(H / o.ssaa);
      const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
      // downsample in halves for quality
      let cur = cv, cw = W, ch = H, f = o.ssaa;
      while (f > 1) { const n = document.createElement('canvas'); n.width = Math.ceil(cw / 2); n.height = Math.ceil(ch / 2); const nx = n.getContext('2d'); nx.imageSmoothingEnabled = true; nx.drawImage(cur, 0, 0, n.width, n.height); cur = n; cw = n.width; ch = n.height; f /= 2; }
      x2.drawImage(cur, 0, 0, c2.width, c2.height);
      return { canvas: c2, ox: ox / o.ssaa, oy: oy / o.ssaa };
    }
    return { canvas: cv, ox, oy };
  }
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  // deterministic RNG
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  G.RZ = { Builder, render, mat, ramp, hex, mix, clamp, rng };
})(window);
