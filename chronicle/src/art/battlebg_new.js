// Chronicle battle backdrops (§11.2.13): tree manor ship mine library oblivion
// ashland jungle beach peak hollow ring, and the redrawn swamp (§11.0 0.15).
// Owner: A16a. Registered into R.Art.BBG_SCENES; src/art/battlebg.js (loaded
// after this file) merges them and defines 'bbg:<id>'. The shared helpers
// (R.Art.BBG) are looked up when a scene is painted, never at load time.
// Rules (as in battlebg.js): horizon y 84–104, the strip y 110–140 stays calm
// (monsters stand on y 130), a stage shadow under the group, nothing important
// in the top 56 px (status windows). Colours stay SFC-bright (§11.0 0.1).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const S = (A.BBG_SCENES = A.BBG_SCENES || {});
  const tk = () => A.TK, BB = () => A.BBG;
  const W = 256, H = 144;

  // ------------------------------------------------------------ local helpers
  /** soft light pool: mixes col in, strongest at the centre, dithered so no bands show */
  function glow(b, cx, cy, rx, ry, col, k) {
    const T = tk();
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (!b.in(x, y)) continue;
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      const a = (1 - d) * (1 - d) * k;
      const q = Math.floor(a * 10 + T.bayer(x, y)) / 10;
      if (q > 0) b.set(x, y, T.mix(b.get(x, y), col, Math.min(1, q)));
    }
  }
  /** points along a quadratic bezier */
  function bez(p0, p1, p2, n) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], t]);
    }
    return out;
  }
  /** a rounded limb (root, branch, frond stem) along pts with width w(t), lit on top */
  function limb(b, pts, w0, w1, ramp) {
    const n = ramp.length;
    for (const pass of [0, 1, 2]) for (const [x, y, t] of pts) {
      const w = w0 + (w1 - w0) * t;
      if (pass === 0) b.ellipse(x, y, w + 0.8, w * 0.8 + 0.8, ramp[0]);
      else if (pass === 1) b.ellipse(x, y + 0.3, w, w * 0.8, ramp[Math.min(n - 1, 2)]);
      else b.ellipse(x - w * 0.2, y - w * 0.35, Math.max(0.5, w * 0.45), Math.max(0.5, w * 0.3), ramp[n - 1]);
    }
  }
  /** a sheet of paper: centre, size, rotation; cols [edge, shade, face, line] */
  function paper(b, cx, cy, w, h, ang, cols, lines) {
    const T = tk(), c = Math.cos(ang), s = Math.sin(ang);
    const R2 = Math.ceil(Math.hypot(w, h) / 2) + 1;
    for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
      const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
      if (Math.abs(u) > w / 2 || Math.abs(v) > h / 2) continue;
      let col = cols[2];
      if (Math.abs(u) > w / 2 - 1 || Math.abs(v) > h / 2 - 1) col = cols[0];
      else if (v > h / 2 - 2 || u > w / 2 - 2) col = cols[1];
      else if (lines && Math.round(v + h / 2) % 3 === 2 && Math.abs(u) < w / 2 - 2) col = cols[3];
      if (b.in(x, y)) b.set(x, y, col);
      void T;
    }
  }
  /** twinkling star field with a few crosses */
  function starfield(b, y0, y1, n, seed, cols) {
    const T = tk(), r = T.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(r() * W), y = y0 + Math.floor(r() * (y1 - y0)), big = r() < 0.1;
      b.set(x, y, big ? cols[0] : r() < 0.5 ? cols[1] : cols[2]);
      if (big) { b.set(x - 1, y, cols[2]); b.set(x + 1, y, cols[2]); b.set(x, y - 1, cols[2]); b.set(x, y + 1, cols[2]); }
    }
  }
  /** reed clump rising from baseline y */
  function reeds(b, x0, w, y, n, seed, cols) {
    const T = tk(), r = T.rng(seed);
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.floor(r() * w), h = 8 + Math.floor(r() * 18), lean = (r() - 0.5) * 6;
      const c = cols[Math.floor(r() * (cols.length - 1))];
      b.line(x, y, x + lean, y - h, c);
      if (r() < 0.5) b.line(x + 1, y, x + lean + 1, y - h + 2, cols[cols.length - 1]);
      if (r() < 0.35) b.rect(Math.round(x + lean) - 1, y - h - 3, 2, 4, 0x6a4a28); // seed head
    }
  }
  /** dead tree silhouette: trunk from (x,y) up h px, bending by dir */
  function deadTree(b, x, y, h, dir, c0, c1) {
    for (let i = 0; i < 3; i++) b.line(x + i, y, x + dir * 3 + i, y - h, i ? c1 : c0);
    b.line(x + dir * 2, Math.round(y - h * 0.55), x + dir * 12, Math.round(y - h * 0.78), c0);
    b.line(x + dir * 12, Math.round(y - h * 0.78), x + dir * 15, Math.round(y - h * 0.7), c0);
    b.line(x + dir * 3, y - h, x - dir * 7, y - h - 7, c0);
    b.line(x - dir * 7, y - h - 7, x - dir * 9, y - h - 5, c0);
    b.line(x + dir * 7, Math.round(y - h * 0.68), x + dir * 9, y - h + 1, c0);
    b.line(x + dir * 1, Math.round(y - h * 0.3), x - dir * 6, Math.round(y - h * 0.42), c0);
  }
  /** low mist band: dithered mix toward col around row yc (half height hh), stronger at the sides */
  function mist(b, yc, hh, col, k, sides) {
    const T = tk();
    for (let y = Math.floor(yc - hh); y <= yc + hh; y++) for (let x = 0; x < W; x++) {
      if (!b.in(x, y)) continue;
      const d = 1 - Math.abs(y - yc) / hh;
      if (d <= 0) continue;
      const side = sides ? 0.45 + 0.55 * Math.min(1, Math.abs(x - 128) / 110) : 1;
      const wav = 0.75 + 0.25 * Math.sin(x * 0.07 + y * 0.3);
      if (T.bayer(x, y) < d * k * side * wav) b.set(x, y, T.mix(b.get(x, y), col, 0.55));
    }
  }
  /** calm the ground where the group stands (y 110–142): pull each pixel toward the
   *  3×3 average by up to k, feathered out towards the sides so no edge shows */
  function calm(b, k, x0, x1) {
    const T = tk(), src = b.p.slice();
    x0 = x0 == null ? 14 : x0; x1 = x1 == null ? 242 : x1;
    const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    for (let y = 108; y < 143; y++) for (let x = x0; x < x1; x++) {
      const f = Math.min(1, (1 - Math.abs(x - cx) / hw) * 3) * Math.min(1, (y - 108) / 4, (143 - y) / 3);
      if (f <= 0) continue;
      let r = 0, g = 0, bl = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = src[(y + j) * W + x + i]; r += (c >> 16) & 255; g += (c >> 8) & 255; bl += c & 255; }
      b.p[y * W + x] = T.mix(src[y * W + x], T.rgb(r / 9, g / 9, bl / 9), k * f);
    }
  }
  /** palm tree: curved trunk from (x,y) with fronds; dir leans */
  function palm(b, x, y, h, dir, cols) {
    const T = tk();
    const bark = [0x3c2a18, 0x5a4428, 0x7a6040, 0x9a7c54];
    let tx = x, ty = y;
    for (let i = 0; i <= h; i++) {
      const t = i / h;
      tx = x + dir * t * t * h * 0.35; ty = y - i;
      const w = 3.2 - t * 1.2;
      for (let k = -w; k <= w; k++) {
        const u = (k + w) / (2 * w);
        b.set(tx + k, ty, bark[i % 5 === 0 ? 0 : u < 0.3 ? 3 : u < 0.7 ? 2 : 1]);
      }
    }
    const fronds = [-2.9, -2.4, -1.9, -1.2, -0.6, -0.1, 0.35];
    for (const a0 of fronds) {
      const a = a0 + dir * 0.1;
      const len = 22 + T.hash(Math.round(a0 * 10), x, 5) * 10;
      for (let s = 0; s <= len; s++) {
        const px = tx + Math.cos(a) * s, py = ty + Math.sin(a) * s * 0.7 + (s * s) / len * 0.35 * 1.6;
        const half = Math.max(0.5, 3.2 * Math.sin((s / len) * Math.PI));
        // leaflets hang below the rib
        for (let k = 0; k <= half * 2; k++) {
          const lx = px + Math.cos(a + 1.3) * k * 0.4, ly = py + k * 0.9;
          b.set(lx, ly, k < 1 ? cols[4] : k < half ? cols[3] : cols[2]);
        }
        b.set(px, py, cols[4]);
      }
    }
    b.ellipse(tx, ty + 1, 2.5, 2, cols[0]);
    b.set(tx - 1, ty + 2, 0x6a5020); b.set(tx + 2, ty + 2, 0x5a4018);
  }
  /** broad-leaf bush: fan of big leaves on baseline */
  function leafBush(b, cx, y, size, cols, seed) {
    const T = tk(), r = T.rng(seed);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (i + 0.5) * (Math.PI / n) + (r() - 0.5) * 0.2;
      const len = size * (0.7 + r() * 0.4);
      const ex = cx + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.8;
      // leaf: ellipse along the direction
      for (let s = 0; s <= 1; s += 0.04) {
        const px = cx + (ex - cx) * s, py = y + (ey - y) * s;
        const wd = Math.sin(s * Math.PI) * size * 0.28;
        b.ellipse(px, py, wd, wd * 0.7, s < 0.5 ? cols[2] : cols[3]);
      }
      b.line(cx, y, ex, ey, cols[4]); // midrib
    }
    b.ellipse(cx, y, size * 0.25, size * 0.12, cols[0]);
  }

  // ------------------------------------------------------------ tree (千年樹のうろ)
  S.tree = (b) => {
    const T = tk(), B = BB();
    const BK = [0x120a05, 0x1e140a, 0x2e1f10, 0x422e18, 0x5a4022, 0x74562e, 0x92703e];
    const cx = 128, cy = 64;
    for (let y = 0; y < 104; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / 1.3, dy = y - cy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      if (r < 20) { const q = Math.floor((Math.pow(r / 20, 1.3) + (T.bayer(x, y) - 0.5) * 0.12) * 6) / 6; b.set(x, y, T.mix(0xe4f4b0, 0x6a9a40, Math.max(0, Math.min(1, q)))); continue; }
      const rid = Math.sin(th * 24 + B.n1(r * 0.07, 5) * 5);
      const light = Math.max(0, 1 - (r - 20) / 120);
      let v = 0.18 + light * 0.62 + rid * 0.13;
      const ring = ((r * 0.09 + B.n1(th * 2.5 + 7, 9) * 0.8) % 1 + 1) % 1;
      if (ring < 0.07) v -= 0.14; else if (ring < 0.12) v += 0.05;
      const i = Math.max(0, Math.min(BK.length - 1, Math.floor(v * BK.length + (T.bayer(x, y) - 0.5) * 0.9)));
      b.set(x, y, BK[i]);
    }
    // green light spilling out of the far opening
    glow(b, cx, cy, 70, 52, 0x9cd070, 0.35);
    for (let a = 0; a < Math.PI * 2; a += 0.02) { const x = cx + Math.cos(a) * 26, y = cy + Math.sin(a) * 20; if (T.hash(Math.round(a * 50), 1, 9) < 0.6) b.set(x, y, 0xb8d880); }
    // floor of packed bark and moss
    B.plane(b, 100, [0x3a2a16, 0x543c20, 0x4a341c], {
      stripes: 6,
      tex: (x, y, z) => {
        const h = T.hash(x, y, 11);
        if (z > 0.28 && z < 0.72 && Math.abs(x - 128) < 120) return h < 0.03 ? 0x40301a : null;
        if (T.fnoise(x, y * 3, 16, 256, 13) > 0.66) return h < 0.5 ? 0x4a5a24 : 0x5a6a2c;
        return h < 0.07 ? 0x2c2010 : h > 0.97 ? 0x7a603a : null;
      },
    });
    // light pool on the floor under the opening
    glow(b, 128, 104, 60, 7, 0xb0d070, 0.3);
    // roots crawling over the floor from both sides towards the back
    const RT = [0x160e06, 0x3a2812, 0x5a4020, 0x7a5a30, 0x9a7a48];
    limb(b, bez([-6, 128], [40, 104], [96, 99], 40), 7, 2, RT);
    limb(b, bez([262, 134], [214, 106], [158, 99], 40), 8, 2, RT);
    limb(b, bez([-4, 104], [20, 96], [54, 96], 24), 4, 1.5, RT);
    limb(b, bez([260, 108], [236, 98], [200, 97], 24), 4, 1.5, RT);
    limb(b, bez([30, 146], [22, 132], [4, 124], 18), 5, 3, RT);
    limb(b, bez([226, 146], [238, 134], [254, 126], 18), 5, 3, RT);
    // glowing sap: streaks down the walls and drops
    const SAP = [0x6aa038, 0xa8d860, 0xe8ffb0];
    for (const [x, y0, len] of [[62, 30, 34], [196, 26, 40], [96, 46, 18], [168, 44, 22], [30, 50, 28], [226, 52, 26]]) {
      for (let k = 0; k < len; k++) { const y = y0 + k; b.set(x + Math.round(Math.sin(k * 0.3)), y, k > len - 3 ? SAP[2] : SAP[1]); }
      b.ellipse(x, y0 + len + 2, 1, 1.5, SAP[2]); b.set(x, y0 + len + 5, SAP[1]);
      glow(b, x, y0 + len, 8, 8, 0xa8e070, 0.25);
    }
    // motes of green light
    const r = T.rng(17);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(r() * W), y = 56 + Math.floor(r() * 56);
      b.set(x, y, SAP[2]); if (r() < 0.4) { b.set(x - 1, y, SAP[0]); b.set(x + 1, y, SAP[0]); b.set(x, y - 1, SAP[0]); b.set(x, y + 1, SAP[0]); }
    }
    B.stageShadow(b, 132, 110, 7, 0.86);
    B.vignette(b, 0.55, 0);
  };

  // ------------------------------------------------------------ manor (霧の館の広間)
  S.manor = (b) => {
    const T = tk(), B = BB();
    // faded striped wallpaper with peeling patches
    const WPp = [0x3a3242, 0x4c4256, 0x5e546a, 0x6e6478], PL = [0x5c5650, 0x716a60];
    for (let y = 0; y < 82; y++) for (let x = 0; x < W; x++) {
      const stripe = (x % 12) < 6;
      let c = stripe ? WPp[2] : WPp[1];
      if (x % 12 === 3 && (y % 6) < 3) c = WPp[3]; // small motif
      if (x % 12 === 9 && (y % 6) >= 3) c = WPp[0];
      const peel = T.fnoise(x, y * 1.4, 14, 256, 31) * 0.7 + T.fnoise(x, y, 5, 256, 33) * 0.3;
      if (peel > 0.74) c = peel > 0.77 ? PL[0] : T.mix(PL[0], WPp[0], 0.5);
      else if (peel > 0.72) c = WPp[0];
      c = T.mix(c, 0x14101a, Math.max(0, 1 - y / 82) * 0.35); // darker near the ceiling
      b.set(x, y, c);
    }
    // moulding and dark wainscot
    const WD = [0x1c120c, 0x2e1e14, 0x42301e, 0x5a4228, 0x745834];
    b.rect(0, 80, W, 3, WD[3]); b.hline(0, W - 1, 80, WD[4]); b.hline(0, W - 1, 82, WD[1]);
    for (let y = 83; y < 100; y++) for (let x = 0; x < W; x++) {
      const px = x % 32;
      let c = WD[2];
      if (px === 0 || px === 31) c = WD[1];
      else if (px === 3 || y === 86) c = WD[3];
      else if (px === 28 || y === 96) c = WD[1];
      b.set(x, y, c);
    }
    // two tilted portraits
    const portrait = (cx, cy, ang, hue) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 16; x <= cx + 16; x++) {
        const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
        if (Math.abs(u) > 12 || Math.abs(v) > 16) continue;
        let col;
        if (Math.abs(u) > 10 || Math.abs(v) > 14) col = Math.abs(u) > 11 || Math.abs(v) > 15 ? 0x4a3a18 : (u + v < 0 ? 0xb89848 : 0x806428);
        else {
          // dark oil ground and a pale sitter
          const head = Math.hypot(u / 3.4, (v + 5) / 4.2) < 1, body = v > 2 && Math.abs(u) < 7 - (14 - v) * 0.15;
          col = head ? T.mix(0xa89880, hue, 0.2) : body ? T.mix(0x2a2230, hue, 0.4) : T.mix(0x201a1c, hue, 0.15);
          if (head && u > 1.5) col = T.mix(col, 0x3a3030, 0.4);
        }
        b.set(x, y, col);
      }
      b.set(cx, cy - 20, 0x2a2018); b.line(cx - 6, cy - 16, cx, cy - 21, 0x2a2018); b.line(cx + 6, cy - 16, cx, cy - 21, 0x2a2018); // hanging cord
    };
    portrait(76, 56, 0.12, 0x6a3040); portrait(180, 58, -0.16, 0x304a6a);
    // candelabra stands with blue flames
    const stand = (x) => {
      const M = [0x2a2a30, 0x4c4c56, 0x7a7a86];
      b.rect(x - 1, 70, 3, 30, M[1]); b.vline(x - 1, 70, 99, M[2]);
      b.rect(x - 5, 98, 11, 2, M[1]); b.rect(x - 8, 68, 17, 2, M[1]); b.hline(x - 8, x + 8, 68, M[2]);
      for (const dx of [-8, 0, 8]) {
        b.rect(x + dx - 1, 63, 3, 5, 0xc8c4b8); b.vline(x + dx - 1, 63, 67, 0xe8e4dc);
        for (const [fx, fy, c] of [[0, -6, 0xe0f4ff], [0, -5, 0xa8e0ff], [-1, -4, 0x5aa0f0], [0, -4, 0xe8f8ff], [1, -4, 0x5aa0f0], [-1, -3, 0x3a70d0], [0, -3, 0x9ad0ff], [1, -3, 0x3a70d0], [0, -2, 0x5aa0f0]]) b.set(x + dx + fx, 63 + fy, c);
        glow(b, x + dx, 58, 14, 14, 0x78b0f0, 0.35);
      }
    };
    stand(24); stand(232);
    B.vignette(b, 0.75, 50);
    // parquet floor
    B.tiledFloor(b, 100, 58, [0x1e140e, 0x4a3224, 0x5a3e2c, 0x6c4c36], { tileW: 22, rowH: 9, fog: 0x14100c });
    // ground mist, thicker at the sides and far back
    mist(b, 102, 6, 0xb8bccc, 0.8, false);
    calm(b, 0.75);
    for (const [x0, x1] of [[0, 40], [216, 256]]) for (let y = 106; y < 144; y++) for (let x = x0; x < x1; x++) {
      const d = x0 === 0 ? 1 - x / 40 : (x - 216) / 40;
      if (T.bayer(x, y) < d * 0.6 * (0.7 + 0.3 * Math.sin(y * 0.4 + x * 0.1))) b.set(x, y, T.mix(b.get(x, y), 0xa8acbc, 0.5));
    }
    B.stageShadow(b, 132, 110, 7, 0.88);
    B.vignette(b, 0.35, 0);
  };

  // ------------------------------------------------------------ ship (幽霊船の甲板)
  S.ship = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 84, [[0, 0x06081a], [0.5, 0x141a3a], [0.85, 0x2a3458], [1, 0x485478]], 8);
    starfield(b, 0, 70, 50, 41, [0xffffff, 0xc8d0f0, 0x7880b0]);
    // moon and halo
    glow(b, 190, 66, 36, 30, 0x8c98c0, 0.45);
    b.shadeEllipse(190, 66, 9, 9, [0xa8b0c8, 0xd0d4e4, 0xeef0f8, 0xffffff], { amb: 0.8, lx: 0.4, ly: -0.3 });
    b.set(187, 64, 0xb8bcd0); b.set(192, 69, 0xc0c4d4); b.set(188, 69, 0xc8ccd8);
    // misty sea with the moon's path
    B.plane(b, 84, [0x2a3452, 0x141c34, 0x18203c], {
      stripes: 8,
      tex: (x, y, z) => {
        const band = Math.abs(x - 190) < 6 + z * 30;
        const ph = Math.sin(x * (0.4 - z * 0.25) + y * 1.9) + T.hash(x >> 2, y, 43) * 0.8;
        if (band && ph > 0.9) return 0xb8c4e0;
        if (ph > 1.5) return 0x3c4a70;
        return null;
      },
    });
    mist(b, 86, 5, 0x8890b0, 0.9, false);
    // bulwark (railing) across the scene
    const WD = [0x140e0a, 0x241a12, 0x36281c, 0x4a3828, 0x5e4a36];
    b.rect(0, 88, W, 12, WD[2]);
    for (let x = 0; x < W; x++) { b.set(x, 88, WD[4]); b.set(x, 89, WD[3]); b.set(x, 99, WD[0]); if (x % 14 < 2) b.vline(x, 90, 98, WD[1]); }
    for (let x = 6; x < W; x += 14) { b.rect(x, 91, 4, 7, WD[1]); b.set(x, 91, WD[3]); } // gun ports / balusters
    // masts, yards, torn sails and rigging
    const mast = (x, dir) => {
      b.rect(x - 4, 0, 9, 100, WD[2]); b.vline(x - 4, 0, 99, WD[3]); b.vline(x + 4, 0, 99, WD[0]); b.vline(x - 3, 0, 99, WD[4]);
      b.rect(x - 34 * (dir < 0 ? 0 : 1) - 4, 14, 38 + 4, 4, WD[2]); b.hline(x - 38, x + 38, 14, WD[3]);
      // torn sail hanging from the yard, billowing a little; ragged hem and holes
      const SL = [0x4a4c56, 0x686a74, 0x8a8c94, 0xa8a8ae, 0xc4c4c6];
      for (let y = 18; y < 84; y++) for (let k = -32; k <= 32; k++) {
        const bulge = Math.sin(((y - 18) / 66) * Math.PI) * 5 * dir;
        const sx = x + k + Math.round(bulge * (1 - Math.abs(k) / 40));
        const hem = 78 - Math.abs(k + dir * 6) * 0.35 - B.n1((k + 40) * 0.35, 51 + x) * 16 - (T.hash(k + 40, 1, 52 + x) < 0.2 ? 5 : 0);
        if (y > hem) continue;
        if (T.fnoise(k + 40, y * 1.4, 16, 256, 53 + x) > 0.72) continue; // holes
        const u = (k + 32) / 64, fold = Math.sin(k * 0.45 + y * 0.05);
        let c = SL[fold > 0.55 ? 3 : fold < -0.55 ? 1 : 2];
        if (u < 0.08 || u > 0.92) c = SL[1];
        if (y < 21) c = SL[4];
        if (y > hem - 1.5) c = SL[0];
        b.set(sx, y, c);
      }
      // ropes
      b.line(x, 16, x + dir * 80, 88, 0x2a2018); b.line(x, 30, x + dir * 50, 88, 0x2a2018); b.line(x, 8, x - dir * 20, 88, 0x201810);
      // pale lantern
      b.rect(x + dir * 8 - 2, 46, 5, 7, 0x3a3a40); b.rect(x + dir * 8 - 1, 47, 3, 5, 0xc8f0e8);
      glow(b, x + dir * 8, 50, 18, 16, 0x90e0d0, 0.45);
    };
    mast(26, 1); mast(230, -1);
    // wet planks in perspective
    B.plane(b, 100, [0x2a2018, 0x4a3a2a, 0x42332a], {
      stripes: 7,
      tex: (x, y, z) => {
        const u = (x - 128) / (0.35 + z * 1.2);
        if ((((u % 18) + 18) % 18) < 1.2) return 0x221a14;
        // moonlight glinting on the wet far deck (short streaks, none near the group)
        if (z < 0.26 && Math.abs(x - 190) < 26 && (y + (x >> 3)) % 3 === 0 && T.hash(x >> 2, y, 57) < 0.5) return 0x5e5a66;
        return T.hash(x, y, 55) < 0.04 ? 0x30261c : null;
      },
    });
    mist(b, 104, 5, 0x9098b8, 0.5, true);
    B.stageShadow(b, 132, 110, 7, 0.85);
    B.vignette(b, 0.4, 0);
  };

  // ------------------------------------------------------------ mine (深き坑道)
  S.mine = (b) => {
    const T = tk(), B = BB();
    const RK = [0x0e0a08, 0x1c1610, 0x2c231a, 0x3c3024, 0x4e3f2e, 0x62503a];
    const vx = 128, vy = 70;
    // rock around a receding tunnel
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - vx) / 1.4, dy = y - vy, r = Math.hypot(dx, dy);
      const v = 0.18 + Math.min(0.5, r / 260) + (T.fnoise(x, y, 12, 256, 61) - 0.5) * 0.45;
      b.set(x, y, RK[Math.max(0, Math.min(5, Math.floor(v * 6 + (T.bayer(x, y) - 0.5) * 0.7)))]);
    }
    // the dark far end
    for (let y = vy - 12; y < vy + 12; y++) for (let x = vx - 12; x < vx + 12; x++) { const d = Math.max(Math.abs(x - vx) / 12, Math.abs(y - vy - 2) / 11); if (d < 1) b.set(x, y, T.mix(0x040302, b.get(x, y), d * d)); }
    // floor
    for (let y = 92; y < H; y++) {
      const z = (y - 76) / (H - 76);
      for (let x = 0; x < W; x++) {
        const edge = Math.abs(x - vx) / (z * 190 + 8);
        if (edge > 1) continue;
        const h = T.hash(x, y, 63);
        let c = h < 0.06 ? 0x2a2218 : h > 0.97 ? 0x6a5a44 : T.mix(0x3a3024, 0x544432, Math.min(1, z * 1.2));
        if (edge > 0.93) c = 0x221a12;
        b.set(x, y, c);
      }
    }
    // timber frames receding to the vanishing point
    const WD = [0x1a1008, 0x2e1e10, 0x46301a, 0x604428, 0x7c5c38];
    const frames = [];
    for (let k = 0; k < 7; k++) frames.push(1.25 / (0.42 + k * 0.42));
    frames.reverse().forEach((s, k) => {
      const hw = 104 * s, top = vy - 70 * s, bot = vy + 60 * s, t = Math.max(2, Math.round(10 * s));
      const lit = Math.min(1, s * 1.2);
      const colL = T.mix(WD[1], WD[4], lit), colM = T.mix(WD[0], WD[3], lit), colD = T.mix(WD[0], WD[2], lit * 0.7);
      for (const side of [-1, 1]) {
        const x0 = Math.round(vx + side * hw - (side > 0 ? t : 0));
        for (let y = Math.round(top); y < Math.round(bot); y++) for (let i = 0; i < t; i++) b.set(x0 + i, y, i === 0 ? colL : i === t - 1 ? colD : colM);
      }
      for (let y = Math.round(top) - t; y < Math.round(top); y++) for (let x = Math.round(vx - hw - t * 0.5); x < vx + hw + t * 0.5; x++) b.set(x, y, y === Math.round(top) - t ? colL : y === Math.round(top) - 1 ? colD : colM);
      // lamps on alternate frames
      if (k % 2 === 1 && s > 0.3) {
        const lx = Math.round(vx - hw + t + 3 * s), ly = Math.round(top + 10 * s);
        glow(b, lx, ly + 4 * s, 34 * s + 8, 30 * s + 8, 0xff9a38, 0.55);
        b.rect(lx - 1, ly, Math.max(2, Math.round(3 * s)), Math.max(3, Math.round(5 * s)), 0x3a3028);
        b.rect(lx, ly + 1, Math.max(1, Math.round(2 * s)), Math.max(2, Math.round(3 * s)), 0xffd070);
      }
    });
    // rails and sleepers along the left of the floor, low contrast near the stage
    for (let y = 96; y < H; y++) {
      const z = (y - 76) / (H - 76);
      const cx = vx - 38 * z * 1.9;
      const g = Math.round(12 * z) + 2;
      const stage = y > 106 && y < 142;
      if (stage) continue; // the track runs out of sight behind the group
      if (Math.round((1 / z) * 14) % 3 === 0) b.hline(Math.round(cx - g - 2 * z), Math.round(cx + g + 2 * z), y, 0x4a3620);
      b.set(Math.round(cx - g), y, 0x8a8c94); b.set(Math.round(cx + g), y, 0x8a8c94);
    }
    calm(b, 0.6);
    B.stageShadow(b, 132, 110, 7, 0.86);
    B.vignette(b, 0.45, 0);
  };

  // ------------------------------------------------------------ library (白の大書庫)
  S.library = (b) => {
    const T = tk(), B = BB();
    const ST = [0x7a7c88, 0xa0a2ae, 0xc4c6d0, 0xdcdee6, 0xf2f2f6];
    const SPINE = [[0x8a605a, 0xa8807a], [0x5e7262, 0x7c907e], [0x5a6680, 0x7a86a0], [0x84705a, 0xa08c74], [0x746076, 0x927e94], [0xa8a8b0, 0xc8c8d0]];
    b.rect(0, 0, W, 100, ST[1]);
    // shelf stacks: back wall (small), sides (large) — rows of book spines between white stone ledges
    const shelf = (x0, x1, y0, y1, rowH, bookW, seed) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const ry = (y - y0) % rowH;
        if (ry < 2) { b.set(x, y, ry === 0 ? ST[4] : ST[2]); continue; }
        if (ry === rowH - 1) { b.set(x, y, ST[0]); continue; }
        const bi = Math.floor((x - x0) / bookW), row = Math.floor((y - y0) / rowH);
        const h = T.hash(bi, row, seed), sp = SPINE[Math.floor(h * SPINE.length)];
        const bx = (x - x0) % bookW;
        const topGap = Math.floor(T.hash(bi, row, seed + 1) * 3);
        if (ry < 2 + topGap) { b.set(x, y, 0x3a3a44); continue; }
        b.set(x, y, bx === 0 ? 0x2a2a30 : bx === 1 ? sp[1] : sp[0]);
        if (ry === 4 + topGap && bx > 0 && T.hash(bi, row, seed + 2) < 0.5) b.set(x, y, 0xd8c070); // gilt band
      }
    };
    shelf(58, 198, 8, 98, 11, 4, 71);
    // stone pilasters framing the back shelves
    for (const x of [56, 196]) { b.rect(x - 3, 0, 8, 100, ST[3]); b.vline(x - 3, 0, 99, ST[4]); b.vline(x + 4, 0, 99, ST[1]); }
    // tall window at the top centre and light shafts
    for (let y = 0; y < 40; y++) for (let x = 108; x < 148; x++) { const dx = x - 127.5; if (y > 14 - Math.sqrt(Math.max(0, 400 - dx * dx)) * 0.7) b.set(x, y, T.mix(0xfffff4, 0xdcecff, y / 40)); }
    b.rect(126, 0, 3, 40, ST[2]); b.rect(108, 20, 40, 2, ST[2]);
    // side shelves in perspective (big, near)
    for (const side of [-1, 1]) {
      for (let x = 0; x < 58; x++) {
        const xx = side < 0 ? x : W - 1 - x, t = x / 58; // 0 at the edge → 1 near the back
        const y0 = Math.round(0 + t * 8), y1 = Math.round(118 - t * 20);
        const rowH = Math.round(17 - t * 6);
        for (let y = 0; y < y1; y++) {
          if (y < y0) { b.set(xx, y, ST[2]); continue; }
          const ry = (y - y0) % rowH;
          if (ry < 3) { b.set(xx, y, ry === 0 ? ST[4] : ST[3]); continue; }
          if (ry === rowH - 1) { b.set(xx, y, ST[0]); continue; }
          const bw = Math.max(2, Math.round(7 - t * 4)), bi = Math.floor(x / bw), row = Math.floor((y - y0) / rowH);
          const sp = SPINE[Math.floor(T.hash(bi, row, 81 + side) * SPINE.length)];
          const bx = x % bw;
          b.set(xx, y, bx === 0 ? 0x26262c : bx === 1 ? sp[1] : sp[0]);
        }
        b.set(xx, y1, ST[0]); b.set(xx, y1 + 1, ST[0]);
      }
      // stone end of the stack
      const ex = side < 0 ? 58 : W - 59;
      for (let y = 0; y < 100; y++) { b.set(ex, y, ST[4]); b.set(ex + side, y, ST[3]); }
    }
    // marble floor
    B.tiledFloor(b, 100, 60, [0xb4b6c2, 0xdcdee6, 0xe8eaf0, 0xf8f8fc], { tileW: 30, rowH: 12, fog: 0xc4c6d0 });
    // light shafts slanting down from the window
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x - 128) - (y - 20) * 0.35;
      const wdt = 16 + y * 0.12;
      if (Math.abs(u) < wdt) { const a = (1 - Math.abs(u) / wdt) * 0.3; if (y > 108) b.set(x, y, T.mix(b.get(x, y), 0xfffff0, a * 0.7)); else if (T.bayer(x, y) < a * 1.2) b.set(x, y, T.mix(b.get(x, y), 0xfffff0, 0.5)); }
    }
    calm(b, 1);
    // drifting pages
    const PC = [0x8a8a96, 0xc8c8d2, 0xf6f6f8, 0xb0b0bc];
    const r = T.rng(83);
    for (let i = 0; i < 16; i++) {
      const x = 12 + r() * 232, y = 58 + r() * 50;
      if (Math.abs(x - 128) < 60 && y > 96) continue;
      paper(b, x, y, 5 + r() * 4, 3 + r() * 3, r() * 3, PC, false);
    }
    B.stageShadow(b, 132, 112, 7, 0.86);
    B.vignette(b, 0.25, 0);
  };

  // ------------------------------------------------------------ oblivion (忘却の底)
  S.oblivion = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 94, [[0, 0x040406], [0.6, 0x0e0e14], [1, 0x1c1c24]], 6);
    // fragments of white letters floating in the ink
    const r = T.rng(91);
    const stroke = (x, y, kind, s, c) => {
      if (kind === 0) b.hline(x, x + s, y, c);
      else if (kind === 1) b.vline(x, y, y + s, c);
      else if (kind === 2) { b.line(x, y, x + s, y + s, c); }
      else if (kind === 3) { b.hline(x, x + s, y, c); b.vline(x + s, y, y + s, c); }
      else if (kind === 4) { b.line(x + s, y, x, y + s, c); b.hline(x, x + (s >> 1), y + s, c); }
      else { b.vline(x, y, y + s, c); b.hline(x, x + s, y + (s >> 1), c); b.set(x + s, y, c); }
    };
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * W), y = 4 + Math.floor(r() * 82), s = 2 + Math.floor(r() * 5);
      const c = r() < 0.3 ? 0xf8f6ee : r() < 0.6 ? 0xb8b6ae : 0x6c6a66;
      stroke(x, y, Math.floor(r() * 6), s, c);
      if (r() < 0.4) stroke(x + s + 2, y + 1, Math.floor(r() * 6), s - 1, c);
    }
    // the shore: ink lapping onto a beach of white paper
    const shore = (x) => 92 + Math.round(B.n1(x * 0.06, 93) * 6 - 3);
    const PW = [0x8a8880, 0xbcbab2, 0xdcdad2, 0xecebe4, 0xf8f6ee];
    for (let x = 0; x < W; x++) {
      const s0 = shore(x);
      for (let y = s0; y < H; y++) {
        const z = (y - s0) / (H - s0);
        let c = z < 0.08 ? PW[2] : PW[3 + (z > 0.5 ? 1 : 0)];
        if (z > 0.2 && Math.round(y + x * 0.02) % 9 === 0 && !(y > 110 && y < 140 && Math.abs(x - 128) < 110)) c = PW[2]; // faint ruled lines
        const tear = T.fnoise(x, y * 2, 20, 256, 95);
        if (tear > 0.76 && z > 0.15) c = PW[1];
        b.set(x, y, c);
      }
      // wet ink edge and a wash that thins onto the paper
      b.set(x, s0, 0x1c1c22); b.set(x, s0 + 1, 0x3a3a40);
      for (let k = 2; k < 7; k++) if (T.bayer(x, s0 + k) < 0.5 - k * 0.08) b.set(x, s0 + k, T.mix(b.get(x, s0 + k), 0x2a2a30, 0.45));
    }
    // ink pools and streaks on the paper at the edges
    for (const [x, y, rx, ry] of [[18, 124, 16, 4], [238, 130, 18, 5], [46, 108, 8, 2], [214, 106, 10, 2]]) {
      for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) { const d = (xx / rx) ** 2 + (yy / ry) ** 2 + (T.hash(xx, yy, 97) - 0.5) * 0.3; if (d < 1) b.set(x + xx, y + yy, d < 0.6 ? 0x16161c : 0x44444a); }
    }
    // half-written pages lying on the beach
    paper(b, 34, 138, 16, 10, -0.2, [0x8a8880, 0xcac8c0, 0xf8f6ee, 0x9a9890], true);
    paper(b, 224, 116, 12, 8, 0.35, [0x8a8880, 0xcac8c0, 0xf8f6ee, 0x9a9890], true);
    B.stageShadow(b, 132, 110, 7, 0.9);
    calm(b, 0.85);
  };

  // ------------------------------------------------------------ swamp (霧の湿原, redrawn)
  S.swamp = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 96, [[0, 0x2a322c], [0.5, 0x4a5448], [0.85, 0x707a66], [1, 0x88907a]], 8);
    // far treeline in the mist, then dead trees
    B.treeRow(b, 90, 8, 11, [0x3a4438, 0x44503f, 0x4e5a46], 61, { lift: 0.5, squash: 1.2 });
    B.range(b, 93, 4, [0x343e32, 0x3a4436, 0x40493a, 0x46503f], { freq: 0.03, seed: 62, round: true, oct: 2 });
    mist(b, 86, 8, 0xa8b0a0, 0.7, false);
    deadTree(b, 26, 98, 40, 1, 0x1a1e16, 0x2c3226);
    deadTree(b, 224, 96, 34, -1, 0x1a1e16, 0x2c3226);
    deadTree(b, 172, 94, 16, 1, 0x2e3428, 0x3c4434);
    deadTree(b, 78, 94, 13, -1, 0x2e3428, 0x3c4434);
    // grey-green water with tussocks and a muddy stage
    B.plane(b, 96, [0x46564c, 0x3a4a42, 0x3e4e45], {
      stripes: 6,
      tex: (x, y, z) => {
        const land = T.fnoise(x, y * (5 - z * 3), 30, 256, 63) + (1 - Math.min(1, Math.abs(x - 128) / 150)) * 0.35 * Math.min(1, z * 2.5);
        if (land > 0.72) {
          const h = T.hash(x, y, 65);
          if (z > 0.3 && z < 0.74 && Math.abs(x - 128) < 115) return h < 0.03 ? 0x484e2e : 0x505a34;
          return h < 0.08 ? 0x3a4226 : h > 0.95 ? 0x6c7a44 : 0x525c36;
        }
        if (land > 0.69) return 0x2c3424;
        // water: sky reflections in streaks
        if (T.hash(x >> 3, y, 67) < 0.08) return 0x8a947e;
        return T.hash(x, y, 68) < 0.3 ? 0x40504a : null;
      },
    });
    // reeds in the corners and the middle distance
    const RC = [0x2c3a1c, 0x3c4c24, 0x566630, 0x74844a];
    reeds(b, 0, 30, 143, 16, 69, RC); reeds(b, 226, 30, 143, 16, 71, RC);
    reeds(b, 40, 30, 101, 8, 73, [0x3a4430, 0x485438, 0x5a6844]); reeds(b, 190, 26, 100, 8, 75, [0x3a4430, 0x485438, 0x5a6844]);
    // low mist over the water
    mist(b, 100, 5, 0xb4bca8, 0.7, false);
    calm(b, 0.95, 30, 226);
    for (const [x0, x1] of [[0, 44], [212, 256]]) for (let y = 104; y < 144; y++) for (let x = x0; x < x1; x++) {
      const d = x0 === 0 ? 1 - x / 44 : (x - 212) / 44;
      if (T.bayer(x, y) < d * 0.45) b.set(x, y, T.mix(b.get(x, y), 0xa8b09c, 0.5));
    }
    B.stageShadow(b, 132, 110, 7, 0.88);
  };

  // ------------------------------------------------------------ ashland (灰の荒野)
  S.ashland = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 94, [[0, 0x1c1012], [0.45, 0x4a2220], [0.8, 0x8c4430], [1, 0xb8683c]], 9);
    // smoking volcano in the distance
    const vx = 176;
    for (let y = 50; y < 94; y++) {
      const hw = 8 + (y - 50) * 1.35;
      for (let x = Math.round(vx - hw); x <= vx + hw; x++) {
        const lit = x < vx - hw * 0.2;
        b.set(x, y, T.mix(lit ? 0x5a3a34 : 0x3a2626, 0x8c5040, 0.25 + (y - 50) / 180));
      }
    }
    b.hline(vx - 7, vx + 7, 50, 0xff8a30); b.hline(vx - 5, vx + 5, 51, 0xc84818);
    glow(b, vx, 50, 24, 12, 0xff7030, 0.5);
    // plume
    const SM = [0x3a3034, 0x524448, 0x6a5a5c, 0x827274];
    for (let i = 0; i < 9; i++) {
      const y = 44 - i * 6, x = vx - i * 7 + Math.sin(i) * 3, r = 6 + i * 2.2;
      b.shadeEllipse(x, y, r, r * 0.7, SM, { amb: 0.4, dither: 0.8 });
    }
    // far ridges
    B.range(b, 94, 10, [0x2a1e1e, 0x342626, 0x3e2e2c, 0x483634], { freq: 0.018, seed: 101, oct: 3 });
    // black rocks and the grey ash plain
    const RK = [0x0e0c0c, 0x1c1818, 0x2a2626, 0x3a3434, 0x4c4644];
    B.plane(b, 97, [0x5a524e, 0x7a706a, 0x70665f], {
      stripes: 7,
      tex: (x, y, z) => {
        const h = T.hash(x, y, 103);
        if (z > 0.28 && z < 0.72 && Math.abs(x - 128) < 118) return h < 0.03 ? 0x625a55 : h > 0.996 ? 0xe06a30 : null;
        const cr = T.fnoise(x, y * 2.5, 12, 256, 105);
        if (Math.abs(cr - 0.5) < 0.018 + z * 0.02) return 0x3e3834;
        if (h > 0.992) return 0xd05a28;
        return h < 0.06 ? 0x56504b : null;
      },
    });
    for (const [x, y, w, h] of [[20, 108, 18, 14], [44, 100, 10, 7], [232, 112, 20, 16], [206, 101, 9, 6], [96, 97, 6, 4], [150, 96, 7, 4]]) {
      b.poly([[x - w, y], [x - w * 0.6, y - h * 0.8], [x - w * 0.1, y - h], [x + w * 0.5, y - h * 0.7], [x + w, y]], RK[2]);
      b.poly([[x - w, y], [x - w * 0.6, y - h * 0.8], [x - w * 0.1, y - h], [x - w * 0.2, y - h * 0.4], [x - w * 0.5, y]], RK[4]);
      b.line(Math.round(x - w * 0.1), y - h, Math.round(x + w * 0.5), Math.round(y - h * 0.7), RK[3]);
      b.hline(Math.round(x - w), Math.round(x + w), y, RK[0]);
    }
    // embers in the air
    const r = T.rng(107);
    for (let i = 0; i < 30; i++) b.set(Math.floor(r() * W), 56 + Math.floor(r() * 44), r() < 0.5 ? 0xffb050 : 0xe06a30);
    B.stageShadow(b, 132, 110, 7, 0.88);
  };

  // ------------------------------------------------------------ jungle (諸島の密林)
  S.jungle = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 90, [[0, 0x2a70d8], [0.6, 0x64a8f0], [1, 0xc0e4fc]], 8);
    B.cloud(b, 90, 60, 26, [0xa8c4e4, 0xe8f2fc, 0xffffff]);
    B.cloud(b, 170, 52, 20, [0xa8c4e4, 0xe8f2fc, 0xffffff]);
    // layered jungle canopy
    B.treeRow(b, 88, 12, 13, [0x1a4a24, 0x24642c, 0x2e7e34, 0x40963e], 111, { lift: 0.5 });
    B.treeRow(b, 96, 10, 11, [0x14401c, 0x1e5a26, 0x2a742e, 0x3a8c38, 0x58a848], 113, { lift: 0.4 });
    const LV = [0x103a18, 0x1c5424, 0x2a7030, 0x3e8c3a, 0x68b050];
    leafBush(b, 40, 100, 20, LV, 115); leafBush(b, 218, 100, 22, LV, 117); leafBush(b, 96, 98, 12, LV, 119); leafBush(b, 164, 98, 13, LV, 121);
    // damp ground with moss and puddles
    B.plane(b, 99, [0x3a3a1c, 0x544c26, 0x4c4622], {
      stripes: 7,
      tex: (x, y, z) => {
        const h = T.hash(x, y, 123), m = T.fnoise(x, y * 3, 18, 256, 125);
        if (z > 0.28 && z < 0.72 && Math.abs(x - 128) < 115) return m > 0.7 ? 0x4a5a26 : null;
        if (m > 0.66) return h < 0.4 ? 0x3e5a24 : 0x4e6c2c;
        if (m < 0.2 && z > 0.2) return h < 0.3 ? 0x8ab4d8 : 0x5a7890; // puddle with sky
        return h < 0.07 ? 0x2a2a14 : null;
      },
    });
    // palms at the sides, fronds hanging into the top corners
    const PC = [0x0e3016, 0x1a4c20, 0x2a6a2a, 0x3c8a34, 0x62aa4a];
    palm(b, 14, 118, 90, 1, PC); palm(b, 244, 122, 96, -1, PC);
    leafBush(b, 8, 144, 24, LV, 127); leafBush(b, 250, 144, 26, LV, 129);
    B.stageShadow(b, 132, 110, 7, 0.86);
  };

  // ------------------------------------------------------------ beach (諸島の浜)
  S.beach = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 80, [[0, 0x2a64d0], [0.6, 0x5c9ae8], [1, 0xc4e2fa]], 8);
    B.cloud(b, 54, 62, 28, [0xa8c4e4, 0xe8f2fc, 0xffffff]);
    B.cloud(b, 200, 58, 22, [0xa8c4e4, 0xe8f2fc, 0xffffff]);
    // sea up to the horizon
    B.plane(b, 80, [0x4a86d0, 0x2a64b8, 0x3070c0], {
      stripes: 10,
      tex: (x, y, z) => {
        const ph = Math.sin(x * (0.35 - z * 0.22) + y * 1.7) + T.hash(x >> 2, y, 131) * 0.8;
        if (ph > 1.45) return z < 0.3 ? 0xa8d0f8 : 0xe4f2ff;
        if (ph > 1.2) return 0x6aa4e8;
        return null;
      },
    });
    b.hline(0, W - 1, 80, 0xd8ecfc);
    // sea stacks
    const RK = [0x2a2a30, 0x4a4a54, 0x6a6a76, 0x8c8c98, 0xb0b0ba];
    B.formation(b, 22, 58, 100, 14, 22, 34, RK, 133);
    B.formation(b, 236, 64, 102, 12, 20, 36, RK, 135);
    B.formation(b, 198, 84, 96, 6, 9, 14, RK, 137);
    // wet sand and foam at the waterline, dry white sand for the stage
    for (let y = 92; y < H; y++) {
      const z = (y - 92) / (H - 92);
      for (let x = 0; x < W; x++) {
        const wl = 96 + Math.sin(x * 0.045) * 2 + Math.sin(x * 0.13 + 1) * 1;
        if (y < wl - 2) continue;
        let c;
        if (y < wl) c = (x + y) % 3 ? 0xf4faff : 0xc8e4f8;         // foam
        else if (y < wl + 5) c = T.mix(0xb8a478, 0xd8c8a0, (y - wl) / 5); // wet sand
        else {
          const h = T.hash(x, y, 139);
          c = T.mix(0xe4d6b0, 0xf2e8cc, Math.min(1, z * 1.4));
          if (!(y > 110 && y < 140 && Math.abs(x - 128) < 115)) { if (h < 0.05) c = 0xc8b88c; else if (h > 0.985) c = 0xfff8e8; }
          else if (h < 0.015) c = 0xd8c8a0;
        }
        b.set(x, y, c);
      }
    }
    // rocks on the sand at the edges
    for (const [x, y, rx, ry] of [[12, 132, 12, 8], [246, 138, 14, 9], [40, 112, 5, 3], [222, 110, 6, 3]]) b.shadeEllipse(x, y, rx, ry, [RK[0], RK[1], RK[2], RK[3], RK[4]], { dither: 0.6 });
    B.stageShadow(b, 132, 110, 7, 0.9);
  };

  // ------------------------------------------------------------ peak (白竜の峰の頂上)
  S.peak = (b) => {
    const T = tk(), B = BB();
    B.sky(b, 0, 96, [[0, 0x04081c], [0.5, 0x101c44], [0.85, 0x2a3c70], [1, 0x5a6c9c]], 9);
    starfield(b, 0, 80, 90, 141, [0xffffff, 0xd0d8f8, 0x8090c8]);
    // a sea of clouds with far peaks poking through
    B.peaks(b, 90, [0x3a4a78, 0x4a5a88, 0x5a6c98, 0x7888b0, 0x98a8c8], { seed: 143, n: 6, hMin: 8, hMax: 26, snow: 10, haze: [0x5a6c9c, 0.35] });
    for (let y = 84; y < 100; y++) for (let x = 0; x < W; x++) {
      const v = B.fbm1(x * 0.03 + 3, 145, 3) * 10 + 86;
      if (y > v) b.set(x, y, y - v < 2 ? 0xf4f8ff : T.mix(0xdce4f4, 0x9aaccc, Math.min(1, (y - v) / 12)));
    }
    // the summit: rocky outcrops at the sides, snow for the stage
    const RK = [0x1c2234, 0x2e364c, 0x444e68, 0x5c6884, 0x7a86a0];
    B.formation(b, 10, 70, 110, 10, 30, 52, RK, 147);
    B.formation(b, 248, 76, 112, 8, 28, 50, RK, 149);
    B.plane(b, 100, [0xb8c4dc, 0xe4ecf8, 0xd8e2f2], {
      stripes: 6,
      tex: (x, y, z) => {
        if (z > 0.28 && z < 0.72 && Math.abs(x - 128) < 115) return null;
        const h = T.hash(x, y, 151);
        return h < 0.06 ? 0xa8b4cc : h > 0.985 ? 0xffffff : null;
      },
    });
    for (let x = 0; x < W; x++) { const y = 100 + Math.round(B.n1(x * 0.08, 153) * 3); b.set(x, y, 0xf8fbff); b.set(x, y + 1, 0xc8d4e8); }
    // snow blowing up off the summit edges: soft plumes that thin as they rise
    for (let i = 0; i < 2; i++) {
      const dir = i ? -1 : 1, x0 = i ? W - 6 : 6;
      for (let k = 0; k < 14; k++) {
        const t = k / 13, x = x0 + dir * (8 + t * 64), y = 104 - t * 46 + Math.sin(t * 5) * 3;
        glow(b, x, y, 7 + t * 12, 4 + t * 6, 0xf0f6ff, 0.75 - t * 0.5);
      }
      const r = T.rng(155 + i);
      for (let k = 0; k < 40; k++) { const t = r(), px = Math.round(x0 + dir * (10 + t * 70) + (r() - 0.5) * 14), py = Math.round(104 - t * 50 + (r() - 0.5) * 12); if (b.in(px, py)) b.set(px, py, 0xffffff); }
    }
    B.stageShadow(b, 132, 110, 7, 0.88);
  };

  // ------------------------------------------------------------ hollow (虚ろの王)
  S.hollow = (b) => {
    const T = tk(), B = BB();
    // pure white space, the faintest grey toward the edges
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 128) / 150, (y - 70) / 100);
      const v = Math.min(1, d);
      b.set(x, y, T.mix(0xfbfaf6, 0xcfcdc6, Math.floor((v * v + (T.bayer(x, y) - 0.5) * 0.08) * 8) / 8));
    }
    // a vortex of pages spiralling out from the centre
    const PC = [0x7c7a76, 0xbab8b2, 0xf8f7f2, 0xa8a6a0];
    const pts = [];
    for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 26; k++) {
      const t = k / 26, a = arm * (Math.PI * 2 / 3) + t * 5.2, r = 8 + t * 150;
      pts.push([128 + Math.cos(a) * r * 1.2, 68 + Math.sin(a) * r * 0.62, 3 + t * 9, a + 0.8, t]);
    }
    pts.sort((p, q) => p[4] - q[4]);
    for (const [x, y, sz, a, t] of pts) if (x > -10 && x < 266 && y > -10 && y < 150) {
      if (y > 106 && y < 142 && Math.abs(x - 128) < 90) continue; // keep the stage clear
      paper(b, x, y, sz * 1.3, sz, a, PC, sz > 7);
      if (t > 0.3) for (let k = 1; k < 4; k++) b.set(Math.round(x - Math.cos(a - 0.8) * (sz + k * 3)), Math.round(y - Math.sin(a - 0.8) * (sz + k * 3) * 0.6), 0xd8d6d0); // motion trail
    }
    // a hole of pure white at the centre
    glow(b, 128, 68, 26, 18, 0xffffff, 0.9);
    // no floor: only a shadow falls under the monsters
    B.stageShadow(b, 132, 96, 8, 0.88);
    B.stageShadow(b, 132, 70, 5, 0.9);
    calm(b, 0.9);
  };

  // ------------------------------------------------------------ ring (円環竜)
  S.ring = (b) => {
    const T = tk(), B = BB();
    const cx = 128, cy = 66;
    // concentric bands of night and day sky turning around the centre
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / 1.35, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const q = (r + a * (26 / Math.PI)) / 26 + 8; // +2 bands per turn: the day/night parity joins across the seam
      const day = Math.floor(q) % 2 === 0;
      const u = ((q % 1) + 1) % 1;
      let c = day ? T.mix(0x5c9ae8, 0xc0e0fa, u) : T.mix(0x0a1030, 0x283c7a, u);
      if (u < 0.05 || u > 0.95) c = 0xfff0b0; // the gold seam between night and day
      else if (u < 0.09 || u > 0.91) c = T.mix(c, 0xffd870, 0.5);
      if (!day && T.hash(x, y, 161) < 0.012) c = 0xffffff;
      if (day && T.fnoise(x, y, 24, 256, 163) > 0.74) c = T.mix(c, 0xffffff, 0.6);
      b.set(x, y, c);
    }
    glow(b, cx, cy, 30, 22, 0xfff4d0, 0.8);
    // below the horizon the turning sky sinks into a pale haze the group stands on
    for (let y = 98; y < H; y++) { const k = Math.min(0.6, (y - 98) / 16 * 0.6); for (let x = 0; x < W; x++) b.set(x, y, T.mix(b.get(x, y), 0x5c78b4, k)); }
    // a whirl of pages underfoot (flattened spiral)
    const PC = [0x7a7870, 0xc4c2b8, 0xf8f6ee, 0xa8a69c];
    for (let arm = 0; arm < 2; arm++) for (let k = 0; k < 40; k++) {
      const t = k / 40, a = arm * Math.PI + t * 7, rr = 16 + t * 140;
      const x = 128 + Math.cos(a) * rr * 1.1, y = 128 + Math.sin(a) * rr * 0.16;
      if (y < 104 || x < -8 || x > 264) continue;
      if (Math.abs(x - 128) < 70 && y > 116 && y < 140) continue;
      paper(b, x, y, 4 + t * 7, 2 + t * 3, a + 1.2, PC, t > 0.5);
    }
    calm(b, 0.85, 24, 232);
    B.stageShadow(b, 132, 110, 7, 0.78);
  };
})(window.RPG);
