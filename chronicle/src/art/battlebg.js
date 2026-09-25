// Battle backdrops 'bbg:<id>' (256x144, DESIGN §4). DQ5-style layered scenes:
// banded sky, distant layer (mountains, dunes, trees, walls …), and a ground
// plane in perspective. The strip where monsters stand (y ≈ 110–140) is kept
// calm so sprites read clearly. Painted once on first use and cached.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;
  const W = 256, H = 144;

  // ------------------------------------------------------------ helpers
  /** colour along a gradient of stops [[t,col],…] */
  function grad(stops, t) {
    const T = tk();
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i];
        return T.mix(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
      }
    }
    return stops[stops.length - 1][1];
  }
  /** banded vertical gradient (n bands) with dithered seams, over rows y0..y1 */
  function sky(b, y0, y1, stops, n) {
    const T = tk();
    n = n || 8;
    const pal = [];
    for (let i = 0; i < n; i++) pal.push(grad(stops, i / (n - 1)));
    for (let y = y0; y < y1; y++) {
      const f = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (n - 1);
      const i = Math.floor(f), fr = f - i;
      for (let x = 0; x < W; x++) {
        let k = i;
        if (fr > 0.7 && T.bayer(x, y) < (fr - 0.7) / 0.3 * 0.5) k = i + 1;
        b.set(x, y, pal[Math.min(n - 1, k)]);
      }
    }
  }
  /** 1D smooth noise */
  function n1(x, seed) {
    const T = tk(), i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    return T.hash(i, 0, seed) * (1 - s) + T.hash(i + 1, 0, seed) * s;
  }
  function fbm1(x, seed, oct) {
    let v = 0, a = 0.5, fr = 1;
    for (let o = 0; o < (oct || 3); o++) { v += n1(x * fr, seed + o * 17) * a; a *= 0.5; fr *= 2.1; }
    return v / (1 - Math.pow(0.5, oct || 3));
  }
  /**
   * mountain range / hill band: heights from yBase upward by amp·fbm, filled to
   * the bottom of the image. ramp [dark..light]. o: {freq, seed, snow (0..1 of
   * amp that is snow-capped), haze:[col,k], peaks, round (rolling hills), strata}
   */
  function range(b, yBase, amp, ramp, o) {
    const T = tk();
    o = o || {};
    const freq = o.freq || 0.02, seed = o.seed || 1;
    const hs = new Float32Array(W + 8);
    for (let x = -4; x < W + 4; x++) {
      let v = fbm1((x + 400) * freq, seed, o.oct || 4);
      if (o.peaks) v = Math.pow(v, 1.4) * 1.25;
      hs[x + 4] = yBase - v * amp;
    }
    const h = (x) => hs[Math.max(0, Math.min(W + 7, x + 4))];
    const n = ramp.length;
    const snowY = yBase - amp * (o.snow || 0);
    for (let x = o.x0 || 0; x < (o.x1 || W); x++) {
      let top = Math.round(h(x));
      if (o.x1) { const e = Math.min(x - o.x0, o.x1 - 1 - x); top = Math.max(top, yBase - e * 0.8); } // taper island ends
      const sl = (h(x + 2) - h(x - 2)) / 4; // >0: ground falls to the right → lit face
      for (let y = top; y < H; y++) {
        const dy = y - top;
        let k;
        if (o.round) {
          k = dy < 1 ? n - 1 : dy < 3 ? n - 2 : dy < 7 ? n - 3 : n - 4;
          if (sl < -0.2 && dy >= 1) k--;
        } else {
          k = sl > 0.18 ? n - 1 : sl > 0.05 ? n - 2 : sl > -0.12 ? n - 3 : n - 4;
          if (Math.abs(sl - 0.05) < 0.05 || Math.abs(sl + 0.12) < 0.05) if (T.bayer(x, y) < 0.5) k--;
          const depth = (y - top) / Math.max(6, yBase + 6 - top);
          if (depth > 0.55) k--;
          if (depth > 0.8 && T.bayer(x, y) < 0.5) k--;
        }
        if (o.strata && (y + Math.round(x * 0.45)) % o.strata === 0 && dy > 2) k--;
        let col = ramp[Math.max(0, Math.min(n - 1, k))];
        if (o.snow) {
          const jag = n1(x * 0.3, seed + 5) * 5 + n1(x * 0.9, seed + 9) * 2;
          if (y < snowY + jag) {
            col = sl > 0.05 ? 0xffffff : sl > -0.12 ? 0xdce6f4 : 0xa8b8d4;
            if (y > snowY + jag - 2 && T.bayer(x, y) < 0.5) col = ramp[Math.max(0, Math.min(n - 1, k + 1))];
          }
        }
        if (o.haze) col = T.mix(col, o.haze[0], o.haze[1]);
        b.set(x, y, col);
      }
      if (o.rim && !o.snow) b.set(x, top, o.rim);
    }
  }
  /**
   * explicit mountain peaks: lit west faces, shaded east faces, snow caps.
   * o: {seed, n (peaks), hMin, hMax, snow (px below each summit), haze:[col,k], x0,x1}
   */
  function peaks(b, yBase, ramp, o) {
    const T = tk(), r = T.rng(o.seed || 1);
    const list = [];
    const n = o.n || 7;
    for (let i = 0; i < n; i++) {
      const x = (o.x0 || -20) + ((i + 0.3 + r() * 0.4) * ((o.x1 || W + 20) - (o.x0 || -20))) / n;
      const h = (o.hMin || 14) + r() * ((o.hMax || 36) - (o.hMin || 14));
      list.push({ x, h, wl: h * (1.1 + r() * 0.7), wr: h * (1.1 + r() * 0.7) });
    }
    list.sort((a, c) => a.h - c.h);
    const m = ramp.length;
    for (let x = 0; x < W; x++) {
      let best = null, top = 1e9;
      for (const p of list) {
        const d = x - p.x, w = d < 0 ? p.wl : p.wr;
        const tt = yBase - p.h + (Math.abs(d) / w) * p.h + (n1(x * 0.35, 7) - 0.5) * 2.2;
        if (tt < top) { top = tt; best = p; }
      }
      top = Math.round(top);
      const lit = x < best.x;
      for (let y = Math.max(0, top); y < H; y++) {
        const dy = y - top;
        let k = lit ? m - 1 : m - 3;
        if (lit && dy > 10 && T.bayer(x, y) < 0.3) k--;
        // creases running down from the summit
        const cr = Math.abs(x - (best.x - (y - (yBase - best.h)) * 0.35));
        if (lit && cr < 0.8 && y > yBase - best.h + 4) k = m - 3;
        if (!lit && dy > 14 && T.bayer(x, y) < Math.min(0.5, (dy - 14) / 20)) k = m - 4;
        if (y > yBase - 4) k = Math.min(k, m - 3);
        let col = ramp[Math.max(0, Math.min(m - 1, k))];
        if (o.snow) {
          const sd = o.snow * (best.h / (o.hMax || 36)) + n1(x * 0.5, 3) * 4 - 2;
          if (y < yBase - best.h + sd && best.h > (o.hMax || 36) * 0.45) {
            col = lit ? 0xffffff : 0xb4c2dc;
            if (y > yBase - best.h + sd - 2 && T.bayer(x, y) < 0.5) col = ramp[Math.max(0, Math.min(m - 1, k))];
          }
        }
        if (o.haze) col = T.mix(col, o.haze[0], o.haze[1]);
        b.set(x, y, col);
      }
    }
  }
  /** puffy cloud cluster; o: {w, h, cols:[shadow, mid, light]} */
  function cloud(b, cx, cy, w, cols) {
    const T = tk();
    const L = T.buf(W, H);
    const blobs = [[0, 0, 1], [-0.45, 0.15, 0.7], [0.45, 0.2, 0.75], [-0.2, -0.3, 0.6], [0.25, -0.25, 0.55], [-0.75, 0.3, 0.45], [0.75, 0.35, 0.45]];
    for (const [dx, dy, r] of blobs) L.ellipse(cx + dx * w, cy + dy * w * 0.45, r * w * 0.42, r * w * 0.3, cols[1]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (L.get(x, y) === T.NONE) continue;
      const up = L.get(x, y - 2) === T.NONE || L.get(x - 1, y - 2) === T.NONE;
      const low = y > cy + w * 0.12;
      L.set(x, y, up && !low ? cols[2] : low && T.bayer(x, y) < 0.7 ? cols[0] : cols[1]);
    }
    for (let x = 0; x < W; x++) for (let y = Math.floor(cy + w * 0.25); y < H; y++) if (L.get(x, y) !== T.NONE && y > cy + w * 0.2) L.set(x, y, cols[0]);
    b.blit(L, 0, 0);
  }
  /** stars on rows y0..y1 */
  function stars(b, y0, y1, n, seed) {
    const T = tk(), r = T.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W), y = y0 + Math.floor(r() * (y1 - y0)), big = r() < 0.12;
      b.set(x, y, big ? 0xffffff : r() < 0.5 ? 0xc8d0f0 : 0x8890c0);
      if (big) { b.set(x - 1, y, 0x8890c0); b.set(x + 1, y, 0x8890c0); b.set(x, y - 1, 0x8890c0); b.set(x, y + 1, 0x8890c0); }
    }
  }
  /** row of round trees (crowns) on baseline y; ramp dark→light */
  function treeRow(b, y, size, spacing, ramp, seed, o) {
    const T = tk(), r = T.rng(seed);
    o = o || {};
    for (let x = -size; x < W + size; x += spacing * (0.7 + r() * 0.6)) {
      const s = size * (0.75 + r() * 0.5);
      const cy = y - s * (o.lift || 0.9);
      if (o.trunk) b.rect(Math.round(x - 1), Math.round(cy + s * 0.6), 2, Math.round(s * 0.8), o.trunk);
      b.shadeEllipse(x, cy, s, s * (o.squash || 0.9), ramp, { dither: 0.8, amb: 0.3 });
    }
  }
  /** row of conifers on baseline y */
  function pineRow(b, y, hgt, spacing, cols, seed, snow) {
    const T = tk(), r = T.rng(seed);
    for (let x = -8; x < W + 8; x += spacing * (0.7 + r() * 0.6)) {
      const h = hgt * (0.7 + r() * 0.6), w = h * 0.36;
      const top = y - h;
      for (let yy = Math.floor(top); yy < y; yy++) {
        const k = (yy - top) / h;
        const hw = w * k + 0.5;
        const tier = ((yy - top) % Math.max(3, Math.round(h / 4)));
        const hw2 = hw * (0.75 + 0.25 * (tier / Math.max(3, Math.round(h / 4))));
        for (let xx = Math.round(x - hw2); xx <= Math.round(x + hw2); xx++) {
          let c = xx < x ? cols[1] : cols[0];
          if (snow && tier < 2 && xx < x + hw2 * 0.3) c = xx < x ? 0xf0f4fc : 0xb8c4dc;
          b.set(xx, yy, c);
        }
      }
      b.rect(Math.round(x), y - 1, 2, 2, 0x3c2814);
    }
  }
  /**
   * ground plane from horizon yh to the bottom; stripes spaced in perspective.
   * cols: [far, near-a, near-b]; o: {tex(x,y,z)→col|null, stripes}
   */
  function plane(b, yh, cols, o) {
    const T = tk();
    o = o || {};
    const n = o.stripes || 9;
    for (let y = yh; y < H; y++) {
      const z = (y - yh) / (H - yh);
      const band = Math.floor(Math.sqrt(z) * n);
      const base = T.mix(cols[0], band % 2 ? cols[1] : cols[2], Math.min(1, z * 2.2));
      for (let x = 0; x < W; x++) {
        let c = base;
        if (o.tex) { const t2 = o.tex(x, y, z, band); if (t2 != null) c = t2; }
        b.set(x, y, c);
      }
    }
  }
  /** perspective tiled floor: vanishing point (128, vy); grout lines are 1 px in screen space */
  function tiledFloor(b, yh, vy, cols, o) {
    const T = tk();
    o = o || {};
    const tw = o.tileW || 32, rh = o.rowH || 12, D = H - vy;
    const cell = (x, y) => {
      const dz = y - vy;
      return [Math.floor(((x - 128) * D) / (dz * tw) + 0.5), Math.floor((D * D) / (dz * rh))];
    };
    for (let y = yh; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [iu, iv] = cell(x, y);
        const [iuR] = cell(x + 1, y), [, ivD] = cell(x, y + 1);
        let c = (iu + iv) % 2 ? cols[1] : cols[2];
        if (iv !== ivD) c = cols[0];
        else if (iu !== iuR) c = cols[0];
        else {
          const [, ivU] = cell(x, y - 1), [iuL] = cell(x - 1, y);
          if (iv !== ivU || iu !== iuL) c = cols[3] || c;
        }
        if (o.fog) c = T.mix(c, o.fog, Math.max(0, 1 - (y - yh) / 26) * 0.7);
        if (o.tex) { const t2 = o.tex(x, y, c, iu, iv); if (t2 != null) c = t2; }
        b.set(x, y, c);
      }
    }
  }
  /** brick back wall rows y0..y1 */
  function brickWall(b, y0, y1, P, bw, bh, o) {
    const T = tk();
    o = o || {};
    for (let y = y0; y < y1; y++) {
      const row = Math.floor((y - y0) / bh), ry = (y - y0) % bh, off = row % 2 ? bw >> 1 : 0;
      for (let x = 0; x < W; x++) {
        const bx = (x + off) % bw, bi = Math.floor((x + off) / bw);
        let c = P[2];
        if (ry === bh - 1 || bx === bw - 1) c = P[0];
        else if (ry === 0 || bx === 0) c = P[3];
        else if (ry === bh - 2) c = P[1];
        else if (T.hash(bi, row, o.seed || 3) < 0.25) c = T.mix(P[2], P[1], 0.5);
        if (o.shadeY) c = T.mix(c, o.shadeY[0], Math.max(0, 1 - (y - y0) / o.shadeY[1]) * o.shadeY[2]);
        b.set(x, y, c);
      }
    }
  }
  /** a column: x centre, top/bottom, width, ramp; capitals/bases */
  function column(b, cx, y0, y1, w, P, o) {
    const T = tk();
    o = o || {};
    const x0 = Math.round(cx - w / 2);
    for (let y = y0; y < y1; y++) for (let i = 0; i < w; i++) {
      const u = i / (w - 1);
      const k = u < 0.15 ? 2 : u < 0.4 ? 4 : u < 0.6 ? 3 : u < 0.85 ? 2 : 1;
      let c = P[Math.min(P.length - 1, k)];
      if (o.flutes && i % 4 === 2 && u > 0.1 && u < 0.9) c = T.mix(c, P[1], 0.5);
      b.set(x0 + i, y, c);
    }
    b.vline(x0 - 1, y0, y1 - 1, P[0]); b.vline(x0 + w, y0, y1 - 1, P[0]);
    if (o.cap !== false) {
      b.rect(x0 - 3, y0 - 4, w + 6, 4, P[3]); b.hline(x0 - 3, x0 + w + 2, y0 - 4, P[4]); b.hline(x0 - 3, x0 + w + 2, y0 - 1, P[1]);
      b.rect(x0 - 3, y1, w + 6, 5, P[2]); b.hline(x0 - 3, x0 + w + 2, y1, P[4]); b.hline(x0 - 3, x0 + w + 2, y1 + 4, P[0]);
    }
  }
  /** torch with warm glow on the wall */
  function wallTorch(b, x, y, glow) {
    const T = tk();
    const R2 = glow || 16;
    for (let yy = y - R2; yy < y + R2; yy++) for (let xx = x - R2; xx < x + R2; xx++) {
      const d = Math.hypot(xx - x, (yy - y) * 1.1) / R2;
      if (d >= 1) continue;
      const c = b.get(xx, yy);
      if (c === T.NONE) continue;
      if (d < 0.5 || T.bayer(xx, yy) < (1 - d) * 1.2) b.set(xx, yy, T.mix(c, 0xffa040, (1 - d) * 0.35));
    }
    b.rect(x - 2, y + 3, 5, 2, 0x2a2a30); b.rect(x - 1, y + 5, 3, 5, 0x3a3a44); b.set(x - 1, y + 5, 0x6a6a78);
    b.rect(x - 1, y, 3, 3, 0x6c4622);
    const F = [[0, -6, 0xffe070], [0, -5, 0xffe070], [-1, -4, 0xff9c28], [0, -4, 0xfff4c0], [1, -4, 0xff9c28], [-1, -3, 0xff9c28], [0, -3, 0xffe070], [1, -3, 0xff8c20], [-2, -2, 0xe05818], [-1, -2, 0xff9c28], [0, -2, 0xffe070], [1, -2, 0xff9c28], [2, -2, 0xe05818], [-1, -1, 0xe05818], [0, -1, 0xff9c28], [1, -1, 0xe05818]];
    for (const [dx, dy, c] of F) b.set(x + dx, y + dy, c);
  }
  /** darkening toward the top and sides (interiors), in fine steps so no seams show */
  function vignette(b, k, top) {
    const T = tk();
    const STEPS = 16;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - 128) / 128, dy = top ? Math.max(0, 1 - y / top) : 0;
      const v = Math.min(0.85, Math.max(0, dx * dx * 0.8 + dy) * k);
      const i = Math.round(v * STEPS);
      if (i > 0) b.set(x, y, T.mul(b.get(x, y), 1 - i / STEPS));
    }
  }
  /** soft darker ellipse on the ground where monsters stand (helps sprites read) */
  function stageShadow(b, cy, rx, ry, k) {
    const T = tk();
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(128 - rx); x <= 128 + rx; x++) {
      const d = ((x - 128) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1 || y >= H) continue;
      if (d < 0.6 || T.bayer(x, y) < (1 - d) * 2) b.set(x, y, T.mul(b.get(x, y), k));
    }
  }

  /** irregular rock column from yTop to yBot (hourglass-ish), lit on the left */
  function formation(b, cx, yTop, yBot, wTop, wMid, wBot, ramp, seed, o) {
    const T = tk();
    o = o || {};
    const m = ramp.length;
    for (let y = Math.max(0, yTop); y < Math.min(H, yBot); y++) {
      const t = (y - yTop) / Math.max(1, yBot - yTop);
      const w = t < 0.5 ? wTop + (wMid - wTop) * (t / 0.5) ** 0.8 : wMid + (wBot - wMid) * ((t - 0.5) / 0.5) ** 1.6;
      const xl = Math.round(cx - w / 2 + (n1(y * 0.12, seed) - 0.5) * 6);
      const xr = Math.round(cx + w / 2 + (n1(y * 0.12, seed + 3) - 0.5) * 6);
      const ledge = n1(y * 0.25, seed + 5) > 0.78;
      for (let x = xl; x <= xr; x++) {
        const u = (x - xl) / Math.max(1, xr - xl);
        let k = u < 0.16 ? m - 1 : u < 0.42 ? m - 2 : u < 0.74 ? m - 3 : m - 4;
        if (ledge) k = Math.max(0, k - 1);
        if (x === xl || x === xr) k = 0;
        let c = ramp[Math.max(0, Math.min(m - 1, k))];
        if (o.haze) c = T.mix(c, o.haze[0], o.haze[1]);
        b.set(x, y, c);
      }
    }
  }
  /** hanging spikes (stalactites / icicles) along the ceiling band y0 */
  function spikes(b, y0, n, hMin, hMax, ramp, seed) {
    const T = tk(), r = T.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W), h = hMin + Math.floor(r() * (hMax - hMin)), w = 2 + Math.floor(r() * 4);
      b.poly([[x - w, y0], [x + w + 1, y0], [x + 0.5, y0 + h]], ramp[2]);
      b.line(x - w + 1, y0, x, y0 + h - 2, ramp[3]);
      b.line(x + w, y0, x + 1, y0 + h - 2, ramp[1]);
    }
  }
  /** rising spikes (stalagmites / crystals) standing on baseline y */
  function mounds(b, y, list, ramp) {
    for (const [x, h, w] of list) {
      b.poly([[x - w, y], [x + w + 1, y], [x + 1, y - h], [x, y - h]], ramp[2]);
      b.poly([[x - w, y], [x, y - h], [x + 0.5, y - h], [x - w + 2, y]], ramp[3]);
      b.line(x + 1, y - h + 1, x + w, y - 1, ramp[1]);
    }
  }
  // ------------------------------------------------------------ scenes
  const S = {};
  S.grass = (b) => {
    const T = tk();
    sky(b, 0, 92, [[0, 0x2c58c8], [0.55, 0x5c94e8], [0.85, 0x9cc8f4], [1, 0xd4ecfc]], 9);
    cloud(b, 40, 58, 34, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    cloud(b, 196, 66, 26, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    cloud(b, 128, 40, 20, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    peaks(b, 91, [0x3c5c8c, 0x4c6c9c, 0x5c7cac, 0x6c8cbc, 0x88a4cc], { seed: 3, n: 8, hMin: 10, hMax: 34, snow: 9, haze: [0xa8c8ec, 0.22] });
    range(b, 94, 8, [0x2c6c34, 0x347c3c, 0x3c8c44, 0x4c9c4c, 0x5cac54], { freq: 0.02, seed: 7, round: true, oct: 2 });
    treeRow(b, 98, 5, 9, [0x1c4c20, 0x2a6428, 0x387c30, 0x4c943c], 11, { lift: 0.6 });
    plane(b, 97, [0x5c9c40, 0x68b048, 0x5ca840], {
      stripes: 8,
      tex: (x, y, z) => {
        if (z > 0.28 && z < 0.72) return null; // calm stage
        const h = T.hash(x >> (z > 0.7 ? 1 : 0), y, 5);
        if (h < 0.06 + z * 0.04) return 0x3c8030;
        if (h > 0.97) return 0x9cd870;
        return null;
      },
    });
    stageShadow(b, 132, 110, 7, 0.9);
  };
  S.forest = (b) => {
    const T = tk();
    sky(b, 0, 100, [[0, 0x0c2410], [0.55, 0x1c3c1a], [1, 0x0a1a0c]], 6);
    // light shafts
    for (let x = 0; x < W; x++) for (let y = 0; y < 100; y++) if (((x + y * 0.5) % 64) < 5 && T.bayer(x, y) < 0.3) b.set(x, y, T.mix(b.get(x, y), 0xc8f0a0, 0.25));
    // background trunks
    const r = T.rng(21);
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(i * 23 + r() * 12), w = 5 + Math.floor(r() * 6);
      for (let y = 20; y < 100; y++) for (let k = 0; k < w; k++) b.set(x + k, y, k === 0 ? 0x3c2c18 : k < w / 2 ? 0x2c2010 : 0x1c140a);
    }
    treeRow(b, 30, 22, 20, [0x0c2c10, 0x184418, 0x245c20, 0x34742c, 0x48903c], 23, { lift: 0.2 });
    treeRow(b, 20, 18, 26, [0x0c2c10, 0x184418, 0x245c20, 0x34742c], 25, { lift: 0.1 });
    treeRow(b, 102, 12, 14, [0x0c2c10, 0x1c4c1c, 0x2c6424, 0x3c7c30, 0x549a40], 27, { lift: 0.5 });
    plane(b, 100, [0x2c3c18, 0x4c5a24, 0x42501c], {
      stripes: 7,
      tex: (x, y, z) => {
        const h = T.hash(x, y, 29);
        if (z > 0.3 && z < 0.72) return h < 0.03 ? 0x384818 : null;
        if (h < 0.08) return 0x2c3812;
        if (h > 0.95) return 0x7c8c38;
        return null;
      },
    });
    // dappled light on the floor
    for (const [x, y, w] of [[40, 124, 16], [170, 136, 22], [110, 110, 10], [220, 116, 12]]) {
      for (let yy = -3; yy <= 3; yy++) for (let xx = -w; xx <= w; xx++) if ((xx / w) ** 2 + (yy / 3) ** 2 < 1 && T.bayer(x + xx, y + yy) < 0.6) b.set(x + xx, y + yy, T.mix(b.get(x + xx, y + yy), 0xd8f090, 0.25));
    }
  };
  S.hills = (b) => {
    const T = tk();
    sky(b, 0, 90, [[0, 0x3c64cc], [0.6, 0x74a4ec], [1, 0xc8e4fc]], 8);
    cloud(b, 70, 56, 30, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    cloud(b, 210, 48, 22, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    range(b, 88, 18, [0x4c7c6c, 0x5c8c78, 0x6c9c84, 0x7cac90], { freq: 0.016, seed: 31, round: true, oct: 2, haze: [0xb0d0e8, 0.35] });
    range(b, 94, 16, [0x2c6428, 0x3c7c30, 0x4c9038, 0x5ca444, 0x74b854], { freq: 0.02, seed: 33, round: true, oct: 2 });
    treeRow(b, 86, 3, 30, [0x1c4c20, 0x2a6428, 0x387c30], 35, { lift: 0.6 });
    range(b, 102, 12, [0x3c7c28, 0x4c9030, 0x5ca43c, 0x70b84c, 0x88c860], { freq: 0.016, seed: 37, round: true, oct: 2 });
    plane(b, 104, [0x5ca43c, 0x6cb448, 0x62ac42], {
      stripes: 7,
      tex: (x, y, z) => {
        if (z > 0.25 && z < 0.75) return null;
        const h = T.hash(x, y, 39);
        return h < 0.07 ? 0x448c34 : h > 0.97 ? 0xa8dc78 : null;
      },
    });
    stageShadow(b, 132, 110, 7, 0.9);
  };
  S.desert = (b) => {
    const T = tk();
    sky(b, 0, 90, [[0, 0x4c7cd0], [0.5, 0x8cb8e8], [0.85, 0xe8e0c0], [1, 0xf8e8b8]], 9);
    // sun
    b.shadeEllipse(204, 62, 7, 7, [0xfff0b0, 0xfff8d8, 0xffffff], { amb: 0.9 });
    range(b, 88, 14, [0xb88850, 0xc89c60, 0xd8b070, 0xe8c888], { freq: 0.01, seed: 41, round: true, oct: 2, haze: [0xf0e0c0, 0.3] });
    // mesa on the left
    b.poly([[18, 90], [26, 66], [58, 66], [64, 90]], 0xb07848);
    b.rect(26, 66, 32, 3, 0xd09c68); b.poly([[18, 90], [26, 66], [30, 66], [24, 90]], 0xc8905c);
    range(b, 98, 12, [0xb0843c, 0xc89c50, 0xdcb468, 0xecc880, 0xf8dca0], { freq: 0.014, seed: 43, round: true, oct: 2 });
    plane(b, 100, [0xd8b068, 0xe4c07a, 0xe0bc76], {
      stripes: 4,
      tex: (x, y, z) => {
        // wind ripples: short broken strokes, sparser near the stage
        const w = Math.sin((y * (1.6 - z * 0.9) + Math.sin(x * 0.045 + y * 0.1) * 4) * 1.3);
        const on = n1(x * 0.12 + y * 7.3, 149) > 0.45;
        if (!on) return null;
        if (z > 0.3 && z < 0.74) return w > 0.99 ? 0xecd092 : null;
        if (w > 0.96) return 0xf6dea4;
        if (w < -0.985) return 0xc8a260;
        return null;
      },
    });
    stageShadow(b, 132, 110, 7, 0.92);
  };
  S.snow = (b) => {
    const T = tk();
    sky(b, 0, 90, [[0, 0x5c6c9c], [0.6, 0x9caccc], [1, 0xdce4f0]], 8);
    peaks(b, 93, [0x4c5c84, 0x64749c, 0x7c8cb4, 0x98a8c8, 0xb4c4dc], { seed: 52, n: 8, hMin: 16, hMax: 40, snow: 13 });
    pineRow(b, 98, 16, 11, [0x1c3c34, 0x2c5448], 53, true);
    plane(b, 97, [0xc8d4e8, 0xe8eef8, 0xdce4f4], {
      stripes: 7,
      tex: (x, y, z) => {
        if (z > 0.3 && z < 0.74) return null;
        const h = T.hash(x, y, 55);
        return h < 0.05 ? 0xb0bcd8 : h > 0.985 ? 0xffffff : null;
      },
    });
    // falling snow flecks in the sky band
    const r = T.rng(57);
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * W), y = 50 + Math.floor(r() * 50); b.set(x, y, 0xffffff); }
    stageShadow(b, 132, 110, 7, 0.9);
  };
  S.swamp = (b) => {
    const T = tk();
    sky(b, 0, 98, [[0, 0x1c2020], [0.45, 0x3c4438], [0.8, 0x646c50], [1, 0x7c8460]], 8);
    // far treeline in the mist
    treeRow(b, 92, 7, 10, [0x2c3426, 0x343e2c, 0x3c4832], 61, { lift: 0.5, squash: 1.2 });
    range(b, 94, 5, [0x262c20, 0x2c3424, 0x323c28, 0x384430], { freq: 0.03, seed: 61, round: true, oct: 2 });
    // dead trees
    const tree = (x, y, h, dir) => {
      const c0 = 0x14120c, c1 = 0x2a241a;
      for (let i = 0; i < 3; i++) b.line(x + i, y, x + dir * 3 + i, y - h, i ? c1 : c0);
      b.line(x + dir * 2, Math.round(y - h * 0.55), x + dir * 12, Math.round(y - h * 0.78), c0);
      b.line(x + dir * 12, Math.round(y - h * 0.78), x + dir * 15, Math.round(y - h * 0.7), c0);
      b.line(x + dir * 3, y - h, x - dir * 7, y - h - 7, c0);
      b.line(x - dir * 7, y - h - 7, x - dir * 9, y - h - 5, c0);
      b.line(x + dir * 7, Math.round(y - h * 0.68), x + dir * 9, y - h + 1, c0);
    };
    tree(28, 98, 40, 1); tree(222, 97, 36, -1); tree(170, 94, 18, 1); tree(76, 94, 14, -1);
    // mud flats and poisoned pools
    plane(b, 96, [0x3c3048, 0x4a3858, 0x443452], {
      stripes: 5,
      tex: (x, y, z) => {
        const v = T.fnoise(x, y * (6 - z * 3.5), 28, 256, 63);
        if (v < 0.34) {
          // pool surface: dark murky water with streaks of reflected sky
          if (T.hash(x >> 3, y, 67) < 0.08) return 0x8c80a8;
          return v < 0.3 ? 0x2a2040 : 0x32284a;
        }
        if (v < 0.36) return 0x5c4c70;
        const h = T.hash(x, y, 65);
        if (z > 0.3 && z < 0.72) return h < 0.02 ? 0x362a44 : null;
        if (h < 0.05) return 0x2c2438;
        if (h > 0.985) return 0x6c8c48;
        return null;
      },
    });
    // bubbles on the pools
    for (const [x, y] of [[60, 104], [190, 112], [140, 102], [36, 136], [226, 138]]) { b.set(x, y, 0xd8c8f0); b.set(x - 1, y + 1, 0x9c88c0); b.set(x + 1, y + 1, 0x9c88c0); b.set(x, y + 2, 0x6c5c84); }
    // reeds in the foreground corners
    const reeds = (x0, n, seed) => {
      const r = T.rng(seed);
      for (let i = 0; i < n; i++) {
        const x = x0 + Math.floor(r() * 26), h = 10 + Math.floor(r() * 16), lean = r() < 0.5 ? -1 : 1;
        b.line(x, 143, x + lean * 2, 143 - h, r() < 0.5 ? 0x3c4c24 : 0x546830);
        if (r() < 0.4) { b.rect(x + lean * 2, 143 - h - 3, 2, 4, 0x5c3c1c); }
      }
    };
    reeds(0, 12, 69); reeds(230, 12, 71);
    // low fog band
    for (let y = 86; y < 102; y++) for (let x = 0; x < W; x++) if (T.bayer(x, y) < 0.35 * (1 - Math.abs(y - 94) / 8)) b.set(x, y, T.mix(b.get(x, y), 0xa0a890, 0.45));
    stageShadow(b, 132, 110, 7, 0.9);
  };
  S.wasteland = (b) => {
    const T = tk();
    sky(b, 0, 96, [[0, 0x3c2448], [0.45, 0x8c4c48], [0.8, 0xd88c50], [1, 0xf0c070]], 9);
    // buttes
    const butte = (x0, x1, top, c) => {
      b.poly([[x0, 92], [x0 + 5, top], [x1 - 5, top], [x1, 92]], c[1]);
      b.poly([[x0, 92], [x0 + 5, top], [x0 + 10, top], [x0 + 6, 92]], c[2]);
      b.hline(x0 + 5, x1 - 5, top, c[3]);
      for (let y = top + 6; y < 92; y += 7) b.hline(x0 + 5, x1 - 4, y, c[0]);
    };
    butte(150, 206, 62, [0x5c2c24, 0x7c3c2c, 0x9c5438, 0xc07448]);
    butte(20, 60, 70, [0x5c2c24, 0x7c3c2c, 0x9c5438, 0xc07448]);
    range(b, 92, 8, [0x6c3c2c, 0x7c4c34, 0x8c5c3c, 0x9c6c48], { freq: 0.03, seed: 71, round: true, oct: 2 });
    plane(b, 95, [0x8c5c3c, 0xa87450, 0x9c6a48], {
      stripes: 6,
      tex: (x, y, z) => {
        if (z > 0.3 && z < 0.72) return T.hash(x, y, 73) < 0.03 ? 0x7c5034 : null;
        const cr = T.fnoise(x, y * 2.5, 10, 256, 75);
        if (Math.abs(cr - 0.5) < 0.02 + z * 0.02) return 0x5c3824;
        return T.hash(x, y, 77) < 0.05 ? 0x7c5034 : null;
      },
    });
    stageShadow(b, 132, 110, 7, 0.9);
  };
  S.sea = (b) => {
    const T = tk();
    sky(b, 0, 84, [[0, 0x2448b8], [0.6, 0x5c90e0], [1, 0xc0dcf8]], 8);
    cloud(b, 60, 60, 30, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    cloud(b, 190, 50, 36, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    cloud(b, 240, 72, 16, [0xa8bcdc, 0xe4ecf8, 0xffffff]);
    // far island
    range(b, 84, 7, [0x3c6c7c, 0x44748a, 0x4c7c8c, 0x5c8c9c], { freq: 0.05, seed: 81, round: true, x0: 56, x1: 100 });
    plane(b, 84, [0x3c70c8, 0x2854b0, 0x2c5cb8], {
      stripes: 10,
      tex: (x, y, z) => {
        const ph = Math.sin(x * (0.35 - z * 0.25) + y * 1.7) + T.hash(x >> 2, y, 83) * 0.8;
        if (ph > 1.45) return z < 0.3 ? 0x9cc8f8 : 0xe0f0ff;
        if (ph > 1.2) return 0x5c94e0;
        if (ph < -0.9 && z > 0.2) return 0x1c3c94;
        return null;
      },
    });
    // horizon glare
    b.hline(0, W - 1, 84, 0xd8ecfc);
  };
  S.cave = (b) => {
    const T = tk();
    const P = [0x140c08, 0x2c1e12, 0x44301c, 0x5c4428, 0x765a38, 0x8c6c44];
    sky(b, 0, 100, [[0, 0x080504], [0.6, 0x1c140c], [1, 0x34261a]], 6);
    const far = [0x1c140c, 0x2a1e12, 0x362818, 0x42301e];
    for (const [x, w] of [[40, 34], [96, 26], [162, 30], [214, 36]]) formation(b, x, -10, 100, w * 1.3, w * 0.6, w * 1.4, far, x);
    formation(b, 6, -10, 104, 60, 34, 56, P, 7);
    formation(b, 252, -10, 104, 64, 36, 60, P, 9);
    spikes(b, 0, 16, 10, 34, P, 93);
    mounds(b, 100, [[30, 22, 7], [52, 12, 4], [198, 26, 8], [222, 14, 5], [150, 9, 3], [96, 7, 3]], P);
    plane(b, 99, [0x2c2014, 0x4c3a26, 0x46351f], {
      stripes: 5,
      tex: (x, y, z) => {
        const h = T.hash(x >> (z > 0.6 ? 1 : 0), y >> (z > 0.6 ? 1 : 0), 95);
        if (z > 0.3 && z < 0.74) return h < 0.02 ? 0x3a2c1c : null;
        if (h < 0.06) return 0x2c2014;
        if (h > 0.975) return 0x6c5438;
        return null;
      },
    });
    vignette(b, 0.55, 0);
  };
  S.fort = (b) => {
    const T = tk();
    const St = [0x2a2622, 0x4c463e, 0x6a6258, 0x847c70, 0xa09888];
    brickWall(b, 0, 100, St, 22, 11, { seed: 101 });
    // timber frame
    const Wd = [0x2c180a, 0x4c2c14, 0x6c4420, 0x8c5c30];
    for (const x of [30, 118, 206]) { b.rect(x, 0, 10, 100, Wd[2]); b.vline(x, 0, 99, Wd[3]); b.vline(x + 9, 0, 99, Wd[0]); b.vline(x + 8, 0, 99, Wd[1]); }
    b.rect(0, 12, W, 8, Wd[2]); b.hline(0, W - 1, 12, Wd[3]); b.hline(0, W - 1, 19, Wd[0]);
    // shields/crossed axes decor
    const shield = (x, y) => { b.ellipse(x, y, 7, 8, 0x7c1c14); b.ellipse(x, y, 5, 6, 0xa02c1c); b.vline(x, y - 6, y + 6, 0xc0a040); b.hline(x - 5, x + 5, y, 0xc0a040); };
    shield(74, 66); shield(162, 66);
    wallTorch(b, 12, 58, 18); wallTorch(b, 244, 58, 18); wallTorch(b, 118 + 5, 64, 14);
    vignette(b, 0.8, 50);
    plane(b, 100, [0x3c3024, 0x5c4a36, 0x54432f], {
      stripes: 7,
      tex: (x, y, z) => {
        const h = T.hash(x, y, 103);
        if (z > 0.3 && z < 0.74) return h < 0.03 ? 0x4a3c2c : null;
        return h < 0.07 ? 0x3c3024 : h > 0.97 ? 0x7c6a50 : null;
      },
    });
    // barrels and a crate against the back wall
    const W2 = [0x2c180a, 0x4c2c14, 0x6c4420, 0x8c5c30, 0xac7840];
    const barrel = (x) => {
      for (let y = 88; y < 104; y++) for (let i = 0; i < 12; i++) b.set(x + i, y, W2[[1, 2, 3, 4, 4, 3, 3, 2, 2, 1, 1, 0][i]]);
      for (const y of [91, 99]) b.hline(x, x + 11, y, 0x3a3a44);
      b.ellipse(x + 5.5, 88, 5.5, 1.5, W2[3]);
    };
    barrel(14); barrel(228);
    b.rect(30, 92, 16, 12, W2[3]); b.hline(30, 45, 92, W2[4]); b.rect(30, 92, 1, 12, W2[4]); b.line(31, 93, 45, 103, W2[1]); b.hline(30, 45, 103, W2[0]);
    vignette(b, 0.4, 0);
  };
  S.watercave = (b) => {
    const T = tk();
    const P = [0x081420, 0x102c44, 0x1c4464, 0x285c80, 0x3c789c, 0x5894b8];
    sky(b, 0, 100, [[0, 0x040a12], [0.6, 0x0c2032], [1, 0x163450]], 6);
    const far = [0x0c1c2c, 0x12283c, 0x18344c, 0x1e405c];
    for (const [x, w] of [[30, 30], [78, 24], [182, 26], [228, 34]]) formation(b, x, -10, 100, w * 1.3, w * 0.6, w * 1.4, far, x + 1);
    // waterfall between the rocks
    for (let y = 0; y < 100; y++) for (let x = 108; x < 148; x++) {
      const edge = Math.min(x - 108, 147 - x);
      if (edge < 2 && T.bayer(x, y) < 0.5) continue;
      const s2 = (x * 7 + y * 3) % 11;
      b.set(x, y, s2 < 2 ? 0xe8f8ff : s2 < 5 ? 0x9cd4f0 : s2 < 8 ? 0x5ca4d8 : 0x3c80c0);
    }
    formation(b, 6, -10, 104, 60, 34, 56, P, 11);
    formation(b, 252, -10, 104, 64, 36, 60, P, 13);
    spikes(b, 0, 14, 10, 30, P, 115);
    // glowing crystals
    for (const [x, y, h] of [[34, 100, 16], [44, 100, 10], [214, 100, 18], [202, 100, 9]]) {
      b.poly([[x - 3, y], [x, y - h], [x + 3, y]], 0x5ce0e8); b.line(x - 1, y - 1, x - 1, y - h + 3, 0xd0ffff); b.line(x + 1, y - 1, x + 1, y - h + 4, 0x2c9cb0);
    }
    plane(b, 99, [0x1c3448, 0x2c4c64, 0x28465c], {
      stripes: 5,
      tex: (x, y, z) => {
        if (y < 107) return (x + y * 5) % 19 < 3 ? 0x8cd0f4 : y === 106 ? 0x5c8cb0 : 0x2c6ca0; // plunge pool
        const h = T.hash(x, y, 113);
        if (z > 0.3 && z < 0.74) return h < 0.02 ? 0x345870 : null;
        return h < 0.05 ? 0x18283a : h > 0.975 ? 0x6c9cc0 : null;
      },
    });
    vignette(b, 0.5, 0);
  };
  S.pyramid = (b) => {
    const T = tk();
    const P = [0x4c3214, 0x7c5628, 0xa47a3e, 0xc49a56, 0xdcba78];
    brickWall(b, 0, 100, P, 32, 14, { seed: 121 });
    // glyph band
    b.rect(0, 40, W, 14, 0x7c5628); b.hline(0, W - 1, 40, 0xdcba78); b.hline(0, W - 1, 53, 0x4c3214);
    for (let x = 4; x < W; x += 16) {
      const k = (x >> 4) % 4;
      if (k === 0) { b.ellipse(x + 4, 46, 3, 2, 0x2c4c9c); b.set(x + 4, 46, 0xf0e0b0); }
      else if (k === 1) { b.vline(x + 3, 43, 51, 0xa03020); b.hline(x + 1, x + 6, 44, 0xa03020); }
      else if (k === 2) { b.poly([[x + 1, 51], [x + 4, 43], [x + 7, 51]], 0x2c4c9c); }
      else { b.ellipse(x + 4, 47, 2, 3, 0xa03020); b.hline(x + 1, x + 7, 50, 0xa03020); }
    }
    const C = [0x4c3214, 0x7c5628, 0xa47a3e, 0xc49a56, 0xe8cc90];
    column(b, 48, 18, 96, 16, C, { flutes: true });
    column(b, 208, 18, 96, 16, C, { flutes: true });
    wallTorch(b, 90, 66, 16); wallTorch(b, 166, 66, 16);
    vignette(b, 0.7, 40);
    tiledFloor(b, 100, 60, [0x5c3e18, 0xae8646, 0xc8a05e, 0xdcb878], { tileW: 36, rowH: 12, fog: 0x3c2810 });
    vignette(b, 0.35, 0);
  };
  S.ice = (b) => {
    const T = tk();
    const P = [0x1c3460, 0x2c5088, 0x4474b0, 0x6c9cd4, 0x9cc8ec, 0xd8f0ff];
    sky(b, 0, 100, [[0, 0x0c1830], [0.6, 0x1c3460], [1, 0x3c64a0]], 6);
    const far = [0x223c68, 0x2c4c80, 0x365c94, 0x4470a8];
    for (const [x, w] of [[36, 30], [92, 22], [166, 26], [220, 32]]) formation(b, x, -10, 100, w * 1.2, w * 0.7, w * 1.3, far, x + 2);
    formation(b, 6, -10, 104, 58, 34, 56, P, 17);
    formation(b, 252, -10, 104, 62, 36, 58, P, 19);
    // glints on the ice
    for (let i = 0; i < 50; i++) { const x = Math.floor(T.hash(i, 1, 133) * W), y = Math.floor(T.hash(i, 2, 133) * 96); if (T.gg(b.get(x, y)) > 0x60) { b.set(x, y, 0xffffff); b.set(x + 1, y + 1, 0xc0e8ff); } }
    spikes(b, 0, 22, 8, 28, [0x2c5088, 0x6cb8e8, 0xa8d8f4, 0xf0fcff], 135);
    const crystal = (x, y, h, lean) => {
      b.poly([[x - 4, y], [x + lean, y - h], [x + 4, y]], 0x6cb8e8);
      b.poly([[x - 4, y], [x + lean, y - h], [x, y]], 0xc0ecff);
      b.line(x + lean, y - h, x, y, 0x3c80c0);
    };
    crystal(30, 100, 30, -2); crystal(42, 100, 18, 3); crystal(222, 100, 34, 2); crystal(208, 100, 16, -3); crystal(160, 100, 10, 1);
    tiledFloor(b, 100, 60, [0x5c88c0, 0x9cc4e8, 0xb4d8f4, 0xe0f4ff], {
      tileW: 44, rowH: 14, fog: 0x2c5088,
      tex: (x, y) => (T.hash(x, y, 137) < 0.012 ? 0xffffff : null),
    });
    for (let y = 101; y < 112; y++) for (let x = 20; x < 240; x++) if (T.bayer(x, y) < 0.25 && (x < 50 || x > 200)) b.set(x, y, T.mix(b.get(x, y), 0xffffff, 0.35));
    vignette(b, 0.3, 0);
  };
  S.volcano = (b) => {
    const T = tk();
    const P = [0x100606, 0x28100a, 0x401a10, 0x5c2818, 0x783822, 0x94482c];
    sky(b, 0, 100, [[0, 0x0a0404], [0.5, 0x2c0c08], [1, 0x6c1c0c]], 7);
    const fall = (x0, w) => {
      for (let y = 0; y < 100; y++) for (let x = x0; x < x0 + w; x++) {
        const s2 = (y * 2 + x * 5) % 13;
        b.set(x, y, s2 < 2 ? 0xfff0a0 : s2 < 6 ? 0xffb030 : s2 < 10 ? 0xf06818 : 0xc03810);
      }
    };
    fall(84, 10); fall(170, 14);
    const far = [0x1c0806, 0x2c100a, 0x3c1a10, 0x4c2416];
    for (const [x, w] of [[40, 34], [128, 40], [216, 36]]) formation(b, x, -10, 100, w * 1.3, w * 0.6, w * 1.4, far, x + 4);
    formation(b, 6, -10, 104, 60, 34, 56, P, 21);
    formation(b, 252, -10, 104, 64, 36, 60, P, 23);
    spikes(b, 0, 12, 8, 26, P, 149);
    // heat glow rising from the lava
    for (let y = 56; y < 100; y++) for (let x = 0; x < W; x++) {
      const k = ((y - 56) / 44) * 0.32;
      if (T.bayer(x, y) < k * 2) b.set(x, y, T.mix(b.get(x, y), 0xff5010, k));
    }
    plane(b, 99, [0x2c1410, 0x3c1c14, 0x341812], {
      stripes: 5,
      tex: (x, y, z) => {
        if (y < 104) return (x * 3 + y) % 11 < 4 ? 0xffc040 : 0xf06018; // lava river at the back
        if (y === 104) return 0x401008;
        const cr = T.fnoise(x, y * 2, 14, 256, 143);
        if (Math.abs(cr - 0.5) < 0.016 + z * 0.01) return z > 0.3 && z < 0.72 ? 0x902410 : 0xff7020;
        const h = T.hash(x, y, 145);
        return h < 0.04 ? 0x1c0c08 : h > 0.985 ? 0x6c3020 : null;
      },
    });
    const r = T.rng(147);
    for (let i = 0; i < 40; i++) b.set(Math.floor(r() * W), 50 + Math.floor(r() * 50), r() < 0.5 ? 0xffc040 : 0xff7020);
    vignette(b, 0.35, 0);
  };
  S.tower = (b) => {
    const T = tk();
    const P = [0x1c1a2c, 0x38344e, 0x524c6c, 0x6c6488, 0x8a82a6];
    brickWall(b, 0, 100, P, 20, 8, { seed: 151 });
    // arched windows with a starry night
    const win = (x0) => {
      for (let y = 30; y < 78; y++) for (let x = x0; x < x0 + 26; x++) {
        const dx = x - (x0 + 12.5), top = 30 + 13 - Math.sqrt(Math.max(0, 169 - dx * dx));
        if (y < top) continue;
        b.set(x, y, T.mix(0x0c0c2c, 0x2c2c6c, (y - 30) / 48));
      }
      for (let i = 0; i < 18; i++) { const x = x0 + 2 + Math.floor(T.hash(i, x0, 153) * 22), y = 34 + Math.floor(T.hash(i, x0 + 1, 153) * 40); if (b.get(x, y) !== T.NONE && T.gg(b.get(x, y)) < 0x40) b.set(x, y, i % 4 ? 0xc8d0f0 : 0xffffff); }
      // frame & sill
      for (let y = 30; y < 78; y++) for (let x = x0 - 2; x < x0 + 28; x++) {
        const dx = x - (x0 + 12.5), top = 30 + 13 - Math.sqrt(Math.max(0, 169 - dx * dx)), top2 = 30 + 13 - Math.sqrt(Math.max(0, 225 - dx * dx));
        if (y >= top2 - 1 && y < top && Math.abs(dx) <= 15) b.set(x, y, P[4]);
      }
      b.rect(x0 - 3, 78, 32, 3, P[4]); b.hline(x0 - 3, x0 + 28, 80, P[0]);
      b.vline(x0 + 12, 32, 77, P[1]); b.hline(x0, x0 + 25, 55, P[1]);
    };
    win(36); win(194);
    const C = [0x3c3450, 0x6c6488, 0x9890b0, 0xc4bcd8, 0xe8e4f4];
    column(b, 104, 14, 96, 12, C, { flutes: true });
    column(b, 152, 14, 96, 12, C, { flutes: true });
    wallTorch(b, 128, 62, 18);
    vignette(b, 0.6, 40);
    tiledFloor(b, 100, 62, [0x28243a, 0x625a80, 0x7e76a0, 0xa098c0], { tileW: 31, rowH: 12, fog: 0x1c1a2c });
    vignette(b, 0.35, 0);
  };
  S.shrine = (b) => {
    const T = tk();
    const P = [0x707888, 0x9ca4b4, 0xc0c8d6, 0xdce2ec, 0xf8faff];
    brickWall(b, 0, 100, P, 32, 16, { seed: 161 });
    // blue trim & arch
    b.rect(0, 22, W, 4, 0x2c4c9c); b.hline(0, W - 1, 22, 0x6c98e0);
    for (let y = 30; y < 100; y++) for (let x = 100; x < 156; x++) {
      const dx = x - 127.5, top = 30 + 28 - Math.sqrt(Math.max(0, 784 - dx * dx));
      if (y >= top) b.set(x, y, T.mix(0xe8f0ff, 0xb8c8e8, (y - 30) / 70));
    }
    // light rays from above
    for (let y = 0; y < 100; y++) for (let x = 0; x < W; x++) {
      const u = (x - 128 + y * 0.4) % 40;
      if (u > 0 && u < 8 && T.bayer(x, y) < 0.3) b.set(x, y, T.mix(b.get(x, y), 0xffffff, 0.35));
    }
    const C = [0x5c6070, 0x9094a4, 0xbcc0cc, 0xdcdee6, 0xfafaff];
    for (const x of [26, 74, 182, 230]) column(b, x, 30, 96, 14, C, { flutes: true });
    // hanging banners
    for (const x of [50, 206]) { b.rect(x - 6, 30, 12, 34, 0x2c4c9c); b.vline(x - 6, 30, 63, 0x6c98e0); b.poly([[x - 6, 64], [x + 6, 64], [x, 70]], 0x2c4c9c); b.rect(x - 2, 40, 4, 4, 0xe8b440); b.set(x - 1, 41, 0xfff4b0); }
    vignette(b, 0.25, 30);
    tiledFloor(b, 100, 60, [0x8c94a8, 0xd0d6e2, 0xe8ecf4, 0xffffff], { tileW: 33, rowH: 12, fog: 0xc0c8d6 });
  };
  S.castle = (b) => {
    const T = tk();
    const P = [0x34343e, 0x5a5c6a, 0x7e808e, 0xa2a4b0, 0xc6c8d2];
    brickWall(b, 0, 100, P, 24, 10, { seed: 171 });
    // banners
    for (const x of [64, 192]) {
      b.rect(x - 9, 30, 18, 46, 0xa8201e); b.vline(x - 9, 30, 75, 0xd0382c); b.vline(x + 8, 30, 75, 0x7c1418);
      b.poly([[x - 9, 76], [x + 9, 76], [x, 85]], 0xa8201e);
      b.rect(x - 11, 28, 22, 3, 0xe0b430); b.hline(x - 11, x + 10, 28, 0xf8dc60);
      // gold crest
      b.ellipse(x, 60, 5, 6, 0xe0b430); b.ellipse(x, 60, 3, 4, 0xa8201e); b.vline(x, 55, 66, 0xf8dc60); b.hline(x - 3, x + 3, 59, 0xf8dc60);
    }
    const C = [0x34343e, 0x6c6e7c, 0x9a9caa, 0xc4c6d0, 0xeceef4];
    column(b, 16, 14, 96, 14, C, { flutes: true });
    column(b, 128, 14, 96, 14, C, { flutes: true });
    column(b, 240, 14, 96, 14, C, { flutes: true });
    wallTorch(b, 100, 58, 16); wallTorch(b, 156, 58, 16);
    vignette(b, 0.55, 40);
    tiledFloor(b, 100, 60, [0x363a52, 0x717a9e, 0x8c94b6, 0xacb4d2], {
      tileW: 32, rowH: 12, fog: 0x2c2c3c,
      tex: (x, y) => {
        // red carpet down the middle, in perspective
        const half = 18 + (y - 100) * 1.1;
        if (Math.abs(x - 128) < half) return Math.abs(x - 128) > half - 3 ? 0xe0b430 : (x + y) % 7 === 0 ? 0xc0382c : 0xa8201e;
        return null;
      },
    });
    vignette(b, 0.3, 0);
  };
  S.demon = (b) => {
    const T = tk();
    const P = [0x0e0814, 0x20162c, 0x322444, 0x46345c, 0x5e4878];
    brickWall(b, 0, 100, P, 20, 9, { seed: 181 });
    for (let y = 0; y < 100; y++) for (let x = 0; x < W; x++) if (b.get(x, y) === P[0] && T.hash(x, y, 183) < 0.3) b.set(x, y, 0x4a0c18);
    // glowing windows (eyes)
    const eye = (x, y) => { b.poly([[x - 10, y], [x, y - 5], [x + 10, y], [x, y + 5]], 0x3c0808); b.poly([[x - 7, y], [x, y - 3], [x + 7, y], [x, y + 3]], 0xd02020); b.rect(x - 1, y - 2, 2, 5, 0x100404); b.set(x - 4, y - 1, 0xff8060); };
    eye(76, 62); eye(180, 62);
    const C = [0x120a18, 0x2a1c38, 0x3e2c52, 0x56406e, 0x7a5c96];
    for (const x of [24, 128, 232]) {
      column(b, x, 20, 96, 14, C, {});
      // spikes on the capitals
      for (const dx of [-8, 0, 8]) b.poly([[x + dx - 2, 16], [x + dx, 6], [x + dx + 2, 16]], 0x56406e);
    }
    // purple braziers
    const brazier = (x) => {
      b.rect(x - 5, 84, 10, 4, 0x3e2c52); b.rect(x - 2, 88, 4, 10, 0x2a1c38);
      for (const [dx, dy, c] of [[0, -14, 0xf0c0ff], [-1, -12, 0xd080ff], [0, -12, 0xffffff], [1, -11, 0xb060f0], [-2, -9, 0x9040d0], [0, -9, 0xe0a0ff], [2, -8, 0x9040d0], [-3, -6, 0x7020b0], [-1, -6, 0xc070f8], [1, -6, 0xc070f8], [3, -5, 0x7020b0], [-4, -3, 0x6010a0], [0, -3, 0xb060f0], [4, -2, 0x6010a0], [-2, -1, 0x9040d0], [2, -1, 0x9040d0]]) b.rect(x + dx * 1, 84 + dy, 2, 2, c);
    };
    brazier(76); brazier(180);
    vignette(b, 0.6, 40);
    tiledFloor(b, 100, 60, [0x3c0a10, 0x1a1224, 0x2a1e38, 0x4e3e60], { tileW: 31, rowH: 12, fog: 0x0e0814 });
    vignette(b, 0.35, 0);
  };
  S.throne = (b) => {
    const T = tk();
    const P = [0x0a0610, 0x1a1024, 0x281a38, 0x3a2850, 0x4e3a68];
    b.rect(0, 0, W, H, P[0]);
    brickWall(b, 0, 100, P, 28, 12, { seed: 191, shadeY: [0x000000, 100, 0.4] });
    // red glow behind the throne
    for (let y = 0; y < 100; y++) for (let x = 60; x < 196; x++) {
      const d = Math.hypot(x - 128, (y - 60) * 1.3) / 70;
      if (d < 1 && T.bayer(x, y) < (1 - d) * 1.3) b.set(x, y, T.mix(b.get(x, y), 0xc01830, (1 - d) * 0.5));
    }
    // giant throne silhouette
    const Th = [0x120810, 0x241424, 0x382038];
    b.rect(96, 18, 64, 80, Th[1]);
    b.poly([[96, 18], [104, 2], [112, 18]], Th[1]); b.poly([[144, 18], [152, 2], [160, 18]], Th[1]); b.poly([[120, 18], [128, 0], [136, 18]], Th[1]);
    b.rect(104, 24, 48, 50, 0x5a0c18); b.rect(108, 28, 40, 42, 0x7c1424); b.vline(108, 28, 69, 0x9c2030);
    b.rect(88, 64, 16, 34, Th[2]); b.rect(152, 64, 16, 34, Th[1]); b.hline(88, 103, 64, 0x6c4c70);
    b.ellipse(128, 40, 7, 8, 0xe0b430); b.ellipse(128, 40, 4, 5, 0x5a0c18); b.set(126, 38, 0xff4040); b.set(130, 38, 0xff4040);
    // dark pillars with purple flames
    const C = [0x08040c, 0x1c1228, 0x2c1e3c, 0x3e2c52, 0x56406e];
    for (const x of [30, 226]) column(b, x, 26, 96, 16, C, {});
    for (const x of [30, 226]) for (const [dx, dy, c] of [[0, -10, 0xf0c0ff], [-1, -8, 0xd080ff], [1, -7, 0xb060f0], [-2, -5, 0x9040d0], [0, -5, 0xffffff], [2, -4, 0x9040d0], [-3, -2, 0x7020b0], [3, -1, 0x7020b0]]) b.rect(x + dx * 2, 22 + dy, 2, 2, c);
    vignette(b, 0.7, 30);
    tiledFloor(b, 100, 58, [0x06040a, 0x180e22, 0x24182e, 0x3a2848], {
      tileW: 30, rowH: 12, fog: 0x0a0610,
      tex: (x, y) => {
        const half = 16 + (y - 100) * 1.2;
        if (Math.abs(x - 128) < half) return Math.abs(x - 128) > half - 2 ? 0xa08020 : (x + y) % 5 === 0 ? 0x6c0c1c : 0x500814;
        return null;
      },
    });
    vignette(b, 0.4, 0);
  };

  const IDS = ['grass', 'forest', 'hills', 'desert', 'snow', 'swamp', 'wasteland', 'sea', 'cave', 'fort', 'watercave',
    'pyramid', 'ice', 'volcano', 'tower', 'shrine', 'castle', 'demon', 'throne'];
  A.BBG_IDS = IDS;
  function make(id) {
    const T = tk();
    const b = T.buf(W, H, 0x000000);
    (S[id] || S.grass)(b);
    return b.toCanvas();
  }
  for (const id of IDS) R.Gfx.def('bbg:' + id, () => make(id));
})(window.RPG);
