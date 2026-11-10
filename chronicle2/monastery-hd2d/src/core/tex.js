// Pixel-art textures, drawn in code from the palette ramps at 32 texels per world unit.
// Every texture is painted as "tone" (a fractional index into a ramp) and then snapped to the ramp with a light ordered
// dither, so the result is real limited-palette pixel art in the same colour language as the hero sprite.
(function () {
  const HD = (window.HD = window.HD || {});
  const P = HD.P, hash2 = HD.hash2, fbm = HD.fbm, vnoise = HD.vnoise;
  const T = (HD.T = { canvases: {}, DITHER: 0.4 });      // DITHER scales every ordered-dither amount: low = clean flat tones (modern), high = busy 16-bit checker
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

  // paint(w, h, fn) : fn(x, y) returns [rampName, tone] or [rampName, tone, ditherAmount]; tone is a fractional ramp index.
  T.paint = function (w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h), d = im.data;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
      const r = fn(x, y); const ramp = P.ramp(r[0]);
      let t = r[1] + BAYER[(x & 3) + ((y & 3) << 2)] * (r[2] === undefined ? 0.9 : r[2]) * T.DITHER;
      t = Math.max(0, Math.min(ramp.length - 1, Math.round(t)));
      const col = ramp[t]; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = r[3] === undefined ? 255 : r[3];
    }
    g.putImageData(im, 0, 0); return c;
  };
  // wrap a canvas as a crisp, mip-mapped, repeating colour texture
  T.fromCanvas = function (c, opt) {
    opt = opt || {};
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.magFilter = opt.nearest ? THREE.NearestFilter : THREE.LinearFilter;   // the world shader does its own crisp-pixel sampling on a linear texture
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    t.flipY = false;               // canvas row 0 = texture v 0: "y grows down the canvas" = "v grows up the wall" is handled per generator
    t.needsUpdate = true; return t;
  };
  const wrap = (v, n) => ((v % n) + n) % n;

  // ---------------------------------------------------------------------------------------------------- coursed ashlar
  // Rows of dressed blocks. Canvas y grows downward; generators below are written so that row 0 is the TOP of a course
  // stack when the texture is used with v up (the world shader flips v), i.e. highlights sit on upper edges.
  function ashlar(opt) {
    const W = opt.w || 256, H = opt.h || 256, seed = opt.seed || 1, ramp = opt.ramp || 'stone';
    const base = opt.base === undefined ? 4.6 : opt.base, r = HD.rng(seed);
    // course heights that add up to H
    const hs = []; let acc = 0; const hmin = opt.hmin || 13, hmax = opt.hmax || 19;
    while (acc < H) { let h = r.int(hmin, hmax); if (H - acc - h < hmin) h = H - acc; hs.push(h); acc += h; }
    const rowOf = new Int16Array(H), rowY0 = [];
    { let y = 0; hs.forEach((h, k) => { rowY0.push(y); for (let j = 0; j < h; j++) rowOf[y + j] = k; y += h; }); }
    // blocks per course
    const lmin = opt.lmin || 22, lmax = opt.lmax || 44;
    const rows = hs.map((h, k) => { const xs = []; let x = r.int(0, lmax); const start = x; while (x < start + W) { let l = r.int(lmin, lmax); if (start + W - x - l < lmin) l = start + W - x; xs.push({ x0: x, l, tone: base + r.range(-0.5, 0.5), warm: r() < (opt.warm === undefined ? 0.06 : opt.warm), moss: r() < (opt.moss === undefined ? 0.16 : opt.moss) ? r.range(0.3, 1) : 0, crack: r() < 0.14, id: r.int(0, 9999) }); x += l; } return { xs, start }; });
    const blockAt = (x, k) => { const row = rows[k]; const xx = wrap(x - row.start, W) + row.start; for (const b of row.xs) if (xx >= b.x0 && xx < b.x0 + b.l) return [b, xx - b.x0]; return [row.xs[0], 0]; };
    return T.paint(W, H, (x, y) => {
      const k = rowOf[y], h = hs[k], ly = y - rowY0[k]; const [b, lx] = blockAt(x, k);
      // mortar: last row and last column of each block, plus knocked-off corners
      const edgeB = ly === h - 1, edgeR = lx === b.l - 1;
      const corner = (lx === 0 || lx === b.l - 2) && (ly === 0 || ly === h - 2) && hash2(b.id, lx + ly, 3) < 0.7;
      if (edgeB || edgeR || corner) return [ramp, edgeB && edgeR ? 0.8 : 1.3 + hash2(x, y, seed) * 0.8, 0.5];
      let t = b.tone;
      t += (fbm(x * 0.09 + b.id, y * 0.14, seed, 3) - 0.5) * 1.5;                   // soft mottling inside the block
      t += (hash2(x, y, seed + 5) - 0.5) * 0.55;                                    // grain
      if (ly === 0) t += 1.15; else if (ly === 1) t += 0.45;                        // lit upper arris
      if (lx === 0) t += 0.6;                                                       // lit left arris
      if (ly === h - 2) t -= 1.0; else if (ly === h - 3) t -= 0.35;                 // shade above the bed joint
      if (lx === b.l - 2) t -= 0.7;
      // pits: a dark pixel with a light pixel under it
      const pit = hash2(x, y, seed + 9); if (pit < 0.012) t -= 2.0; else if (hash2(x, y - 1, seed + 9) < 0.012) t += 0.9;
      // a crack wandering down some blocks
      if (b.crack) { const cx = b.l * 0.5 + Math.sin(ly * 0.9 + b.id) * 2.2 + (hash2(b.id, ly, 7) - 0.5) * 2; if (Math.abs(lx - cx) < 0.7 && ly > 1) t -= 2.2; else if (Math.abs(lx - cx - 1) < 0.7 && ly > 1) t += 0.5; }
      // moss creeping up from the bed joint
      if (b.moss) { const m = b.moss * (ly / h) * 1.5 + (fbm(x * 0.2, y * 0.2, seed + 3, 2) - 0.55) * 2; if (m > 0.75) return ['moss', 1.6 + (m - 0.75) * 3 + (hash2(x, y, 4) - 0.5) + (ly === h - 2 ? -1 : 0), 0.8]; }
      return [b.warm ? 'sand' : ramp, t, 0.85];
    });
  }

  // ------------------------------------------------------------------------------ irregular stones (rubble, flagging)
  function cells(opt) {
    const W = opt.w || 128, H = opt.h || 128, seed = opt.seed || 2, cs = opt.cell || 18, ramp = opt.ramp || 'stone';
    const base = opt.base === undefined ? 4.2 : opt.base, gap = opt.gap === undefined ? 1.4 : opt.gap;
    const nx = Math.round(W / cs), ny = Math.round(H / cs), sx = W / nx, sy = H / ny;
    const pt = (i, j) => { const ii = wrap(i, nx), jj = wrap(j, ny); return [(i + 0.5 + (hash2(ii, jj, seed) - 0.5) * 0.86) * sx, (j + 0.5 + (hash2(ii, jj, seed + 1) - 0.5) * 0.86) * sy, hash2(ii, jj, seed + 2), hash2(ii, jj, seed + 3)]; };
    const flat = !!opt.flat;      // flat = paving seen from above (even light); otherwise wall stones (lit from above)
    return T.paint(W, H, (x, y) => {
      const ci = Math.floor(x / sx), cj = Math.floor(y / sy); let d1 = 1e9, d2 = 1e9, best = null;
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const p = pt(i, j); const dx = (x - p[0]) * (opt.squash || 1), dy = y - p[1]; const d = Math.sqrt(dx * dx + dy * dy); if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d; }
      const e = d2 - d1;      // 0 on the joint
      if (e < gap) { if (opt.gapRamp && hash2(x, y, seed + 6) < (opt.gapFill || 0.6)) return [opt.gapRamp, 2.2 + hash2(x, y, 8) * 2.2, 0.9]; return [ramp, 1.1 + hash2(x, y, seed) * 0.9, 0.5]; }
      let t = base + (best[2] - 0.5) * 1.2;
      t += (fbm(x * 0.11 + best[3] * 50, y * 0.11, seed, 3) - 0.5) * 1.4 + (hash2(x, y, seed + 5) - 0.5) * 0.55;
      const dirY = (y - best[1]) / (sy * 0.5), dirX = (x - best[0]) / (sx * 0.5);
      if (flat) { if (e < gap + 1.2) t += dirY < 0 || dirX < 0 ? 0.7 : -0.8; }
      else { t += -dirY * 0.75 - dirX * 0.3; if (e < gap + 1.2) t += dirY < 0 ? 0.8 : -0.9; }
      const pit = hash2(x, y, seed + 9); if (pit < 0.012) t -= 1.8; else if (hash2(x, y - 1, seed + 9) < 0.012) t += 0.8;
      if (opt.moss && best[3] < opt.moss) { const m = fbm(x * 0.16, y * 0.16, seed + 4, 2) + (flat ? (1.6 - e * 0.25) * 0.25 : dirY * 0.25); if (m > 0.66) return ['moss', 1.8 + (m - 0.66) * 6 + (hash2(x, y, 4) - 0.5), 0.8]; }
      return [best[3] < (opt.warm || 0) ? 'sand' : ramp, t, 0.85];
    });
  }

  // ---------------------------------------------------------------------------------------------------- square pavers
  function pavers(opt) {
    const n = opt.n || 8, ts = opt.tile || 24, W = n * ts, seed = opt.seed || 3, ramp = opt.ramp || 'stone';
    return T.paint(W, W, (x, y) => {
      const i = Math.floor(x / ts), j = Math.floor(y / ts), lx = x - i * ts, ly = y - j * ts, id = hash2(i, j, seed), id2 = hash2(i, j, seed + 1);
      const chip = (lx < 2 || lx > ts - 4) && (ly < 2 || ly > ts - 4) && hash2(i * 7 + lx, j * 5 + ly, seed) < 0.55;
      if (lx === ts - 1 || ly === ts - 1 || chip) return [ramp, 1.2 + hash2(x, y, seed) * 0.8, 0.5];
      let t = (opt.base || 4.4) + (id - 0.5) * 1.3 + ((i + j) % 2 ? (opt.checker || 0) : 0);
      t += (fbm(x * 0.1, y * 0.1, seed, 3) - 0.5) * 1.5 + (hash2(x, y, seed + 5) - 0.5) * 0.5;
      if (ly === 0 || lx === 0) t += 0.8; if (ly === ts - 2 || lx === ts - 2) t -= 0.8;
      if (id2 < 0.22) { const cx = ts * 0.5 + Math.sin(ly * 0.5 + id * 40) * 4 + (ly - ts / 2) * (id - 0.5) * 1.5; if (Math.abs(lx - cx) < 0.6) t -= 2.3; }
      if (id2 > 0.8) { const m = fbm(x * 0.2, y * 0.2, seed + 3, 2) + Math.max(0, 3 - Math.min(lx, ly, ts - lx, ts - ly)) * 0.08; if (m > 0.7) return ['moss', 1.8 + (m - 0.7) * 6, 0.8]; }
      return [id2 > 0.45 && id2 < 0.5 ? 'sand' : ramp, t, 0.85];
    });
  }

  // ------------------------------------------------------------------------------------------------------ roof slates
  function slates(opt) {
    const W = opt.w || 128, H = opt.h || 120, seed = opt.seed || 4, rh = 10, tw = 12;
    return T.paint(W, H, (x, y) => {
      const j = Math.floor(y / rh), ly = y - j * rh, xo = x + (j % 2 ? tw / 2 : 0), i = Math.floor(wrap(xo, W) / tw), lx = wrap(xo, W) - i * tw, id = hash2(i, j, seed), id2 = hash2(i, j, seed + 1);
      // canvas y grows down the roof (toward the eave) after the shader's v flip, so the last rows of a slate are its exposed lower edge
      if (ly === rh - 1) return ['slate', 0.3, 0.3];
      if (lx === tw - 1) return ['slate', 0.9, 0.4];
      if (id2 < 0.05) return ['slate', 0.8 + hash2(x, y, 2) * 0.6, 0.5];                 // a missing slate: dark hole
      let t = 3.1 + (id - 0.5) * 2.0 + (hash2(x, y, seed + 5) - 0.5) * 0.5 + (fbm(x * 0.06, y * 0.06, seed, 2) - 0.5) * 1.2;
      if (ly === 0) t -= 1.0;            // shade cast by the slate above
      if (ly === rh - 2) t += 1.0;       // lit lower edge
      if (lx === 0) t += 0.4;
      if (id2 > 0.9) { const m = fbm(x * 0.2, y * 0.2, seed + 3, 2); if (m > 0.55) return ['moss', 1.5 + (m - 0.55) * 6, 0.8]; }
      return ['slate', t, 0.8];
    });
  }

  // ------------------------------------------------------------------------------------------------------- wood planks
  function planks(opt) {
    const W = opt.w || 128, H = opt.h || 128, seed = opt.seed || 5, pw = opt.plank || 16;
    return T.paint(W, H, (x, y) => {
      const i = Math.floor(x / pw), lx = x - i * pw, id = hash2(i, 0, seed);
      if (lx === pw - 1) return ['wood', 0.4, 0.3];
      let t = (opt.base || 3.4) + (id - 0.5) * 1.4;
      const g = Math.sin((y * 0.12 + Math.sin(y * 0.03 + id * 30) * 2.5 + lx * 0.9) + id * 20); t += g * 0.55 + (hash2(x, y, seed + 2) - 0.5) * 0.5;
      if (lx === 0) t += 0.8; if (lx === pw - 2) t -= 0.7;
      const ky = wrap(Math.floor(id * 97), H); const dk = Math.hypot(lx - pw / 2, (wrap(y - ky + 20, H) - 20) * 0.6); if (hash2(i, 1, seed) < 0.4 && dk < 2.2) t -= 2 - dk * 0.6;   // knots
      if (wrap(y, 64) === 0) t -= 1.6; else if (wrap(y, 64) === 1) t += 0.7;                                                                               // plank ends
      return ['wood', t, 0.8];
    });
  }

  // --------------------------------------------------------------------------------- plain dressed surfaces (trim etc.)
  function plain(opt) {
    const W = opt.w || 64, H = opt.h || 64, seed = opt.seed || 6, ramp = opt.ramp || 'sand', base = opt.base === undefined ? 5 : opt.base;
    return T.paint(W, H, (x, y) => {
      let t = base + (fbm(x * 0.12, y * 0.12, seed, 3) - 0.5) * (opt.amp || 1.6) + (hash2(x, y, seed + 5) - 0.5) * 0.5;
      const pit = hash2(x, y, seed + 9); if (pit < 0.01) t -= 1.8; else if (hash2(x, y - 1, seed + 9) < 0.01) t += 0.8;
      if (opt.joint) { const jx = wrap(x + (Math.floor(y / opt.joint) % 2) * opt.joint, opt.joint * 2); if (wrap(y, opt.joint) === opt.joint - 1 || jx === 0) t -= 2.2; else if (wrap(y, opt.joint) === 0) t += 0.6; }
      return [ramp, t, opt.dither === undefined ? 0.85 : opt.dither];
    });
  }

  // ------------------------------------------------------------------------------------------------- rough rock (cliff)
  function rock(opt) {
    const W = opt.w || 256, H = opt.h || 256, seed = opt.seed || 7;
    return T.paint(W, H, (x, y) => {
      // tileable-ish strata: use periodic noise by blending
      const n = (px, py) => fbm(px * 0.035, py * 0.07, seed, 4);
      const bx = x / W, by = y / H;
      let v = n(x, y) * (1 - bx) * (1 - by) + n(x - W, y) * bx * (1 - by) + n(x, y - H) * (1 - bx) * by + n(x - W, y - H) * bx * by;
      const strata = Math.abs(Math.sin((y + v * 60) * 0.11)); let t = 2.4 + v * 3.2 + (strata < 0.18 ? -1.6 : strata > 0.92 ? 0.8 : 0) + (hash2(x, y, seed) - 0.5) * 0.6;
      return ['stone', t, 0.9];
    });
  }

  // -------------------------------------------------------------------------------------------------------- the set
  const defs = {
    ashlar: () => ashlar({ seed: 11 }),                                                           // main walls
    ashlarDark: () => ashlar({ seed: 12, base: 3.5, moss: 0.3, warm: 0.05 }),                      // plinths, shaded or damp walls
    ashlarWarm: () => ashlar({ seed: 13, ramp: 'sand', base: 4.7, warm: 0, moss: 0.08, hmin: 12, hmax: 16, lmin: 18, lmax: 34 }),   // finer warm masonry (tower, chancel)
    rubble: () => cells({ seed: 21, cell: 16, base: 4.0, moss: 0.3, warm: 0.06, squash: 0.75, w: 128, h: 128 }),                       // boundary and field walls
    flag: () => cells({ seed: 22, cell: 30, base: 4.5, w: 240, h: 240, flat: true, gap: 1.6, moss: 0.2, warm: 0.07, gapRamp: 'moss', gapFill: 0.45 }),   // big flagstones (terrace, landings)
    cobble: () => cells({ seed: 23, cell: 11, base: 4.2, w: 132, h: 132, flat: true, gap: 1.2, warm: 0.06 }),
    paver: () => pavers({ seed: 31, checker: 0 }),                                                 // church floor
    paverChecker: () => pavers({ seed: 32, checker: -1.3, base: 4.9 }),                            // two-tone aisle
    slate: () => slates({ seed: 41 }),
    wood: () => planks({ seed: 51 }),
    woodDark: () => planks({ seed: 52, base: 2.3 }),
    sand: () => plain({ seed: 61, ramp: 'sand', base: 5.2 }),                                      // dressed warm stone: trim, tracery, capitals, crosses
    sandBlock: () => plain({ seed: 62, ramp: 'sand', base: 5.0, joint: 16 }),
    stonePlain: () => plain({ seed: 63, ramp: 'stone', base: 4.6 }),                               // dressed grey stone without joints
    stoneDark: () => plain({ seed: 64, ramp: 'stone', base: 2.6 }),
    rock: () => rock({ seed: 71 }),
    iron: () => plain({ seed: 81, ramp: 'iron', base: 2.4, amp: 1.2 }),
    bronze: () => plain({ seed: 82, ramp: 'gold', base: 2.4, amp: 1.6 }),
    moss: () => plain({ seed: 83, ramp: 'moss', base: 2.8, amp: 2.2 }),
    earth: () => plain({ seed: 84, ramp: 'dirt', base: 2.6, amp: 1.8 }),
    void: () => plain({ seed: 85, ramp: 'stone', base: 0.2, amp: 0.4, dither: 0.3 }),              // the dark inside doorways and windows
  };
  const texCache = {};
  T.names = Object.keys(defs);
  T.canvas = name => T.canvases[name] || (T.canvases[name] = defs[name]());
  T.get = name => texCache[name] || (texCache[name] = T.fromCanvas(T.canvas(name)));
  T.generators = { ashlar, cells, pavers, slates, planks, plain, rock };

  // soft round glow (for additive sprites)
  T.glow = function () {
    if (T._glow) return T._glow; const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, n, n); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (T._glow = t);
  };
})();
