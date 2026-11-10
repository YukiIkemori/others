// Vegetation kit: HD.Veg.create() -> V. Pixel-art foliage (alpha-tested cards and low-poly clumps drawn from the HD.P
// ramps at 32 texels per unit) on simple 3D trunks, batched into a few meshes per call, with a shared wind uniform.
// Everything is designed for the fixed game camera (looks north, 36 degrees down): cards are wound to face it, and
// foliage normals point up and outward from the clump centre so tops catch the key light and undersides fall to shade.
//
//   V.trees(list, opt)   [{ x, y, z, h, kind, seed, lean }]  kind 'pine' | 'broadleaf' | 'autumn' | 'dead' | 'cypress'
//   V.bushes(list)       [{ x, y, z, r, seed, kind }]        kind 'shrub' | 'bramble' | 'fern'
//   V.grass(list, opt)   [{ x, y, z, s, kind, seed }]        kind 'tuft' | 'tall' | 'weed' | 'moonflower' | 'reed'
//   V.ivy(list)          [{ x, y, z, nx, nz, w, h, seed, density, top }]
//   V.leaves(list)       [{ x, y, z, seed, kind, s }]        kind 'autumn' | 'dry'
//   V.update(time)       advances the wind (seconds)
//   V.textures           { foliage, grass, grassGlow, bark } canvases
// Each call returns an Object3D for the caller to add. opt.cell (every list call) splits a list into grid cells for culling.
// No ink outlines (the hero has none): silhouettes are edged underneath with the darkest step of their own ramp.
(function () {
  'use strict';
  const HD = (window.HD = window.HD || {});
  const T = THREE, P = HD.P, V3 = T.Vector3;
  const TPU = 32;                                                      // texels per unit
  const PITCH = 36 * Math.PI / 180;
  const CAM = new V3(0, Math.sin(PITCH), Math.cos(PITCH));             // direction from the world towards the camera
  const Y = new V3(0, 1, 0);
  const KEY = new V3().fromArray((HD.Light && HD.Light.KEY_DIR) || [-0.40, 0.66, -0.64]).normalize();
  const hexi = h => parseInt(h.slice(1), 16);
  const ramp = n => P[n].map(hexi);
  const INK = hexi(P.ink);
  const G = ramp('grass'), M = ramp('moss'), A = ramp('autumn'), W = ramp('wood'), S = ramp('stone'), SD = ramp('sand'), D = ramp('dirt');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------------------------------------ pixel buffers
  function Pix(w, h, wrap) { this.w = w; this.h = h; this.wrap = !!wrap; this.d = new Int32Array(w * h).fill(-1); this.g = null; }
  Pix.prototype.idx = function (x, y) {
    x = Math.round(x); y = Math.round(y);
    if (this.wrap) x = ((x % this.w) + this.w) % this.w;
    return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? -1 : y * this.w + x;
  };
  Pix.prototype.set = function (x, y, c) { const i = this.idx(x, y); if (i >= 0) this.d[i] = c; };
  Pix.prototype.get = function (x, y) { const i = this.idx(x, y); return i < 0 ? -1 : this.d[i]; };
  Pix.prototype.glow = function (x, y, c) { const i = this.idx(x, y); if (i < 0) return; if (!this.g) this.g = new Int32Array(this.w * this.h).fill(-1); this.g[i] = c; };
  // shaded under-edge: the darkest ramp step along the bottom and right of the silhouette only (the lit top-left edge
  // stays open, so there is no outline ring; the hero sprite has no black outlines either)
  Pix.prototype.under = function (col) {
    const w = this.w, h = this.h, src = this.d.slice();
    const at = (x, y) => { if (this.wrap) x = ((x % w) + w) % w; return (x < 0 || y < 0 || x >= w || y >= h) ? -1 : src[y * w + x]; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] >= 0) continue;
      if (at(x, y - 1) >= 0 || (at(x - 1, y) >= 0 && at(x - 1, y - 1) >= 0)) this.d[y * w + x] = col;
    }
  };

  function Atlas(W, H, pad, bg) {
    this.W = W; this.H = H; this.pad = pad;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    const d = this.img.data; for (let i = 0; i < d.length; i += 4) { d[i] = (bg >> 16) & 255; d[i + 1] = (bg >> 8) & 255; d[i + 2] = bg & 255; d[i + 3] = 0; }
    this.glowImg = null; this.x = 0; this.y = 0; this.rowH = 0;
  }
  Atlas.prototype.add = function (px) {
    const pad = this.pad, W = this.W, cw = px.w + pad * 2, ch = px.h + pad * 2;
    if (this.x + cw > W) { this.x = 0; this.y += this.rowH; this.rowH = 0; }
    if (this.y + ch > this.H) throw new Error('HD.Veg: atlas full');
    // cell = sprite + padding; transparent texels get the colour of the nearest leaf texel so mip levels have no dark halo
    const cell = new Int32Array(cw * ch).fill(-1), solid = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let sx = x - pad; const sy = y - pad;
      if (px.wrap) sx = ((sx % px.w) + px.w) % px.w;
      if (sx < 0 || sy < 0 || sx >= px.w || sy >= px.h) continue;
      const c = px.d[sy * px.w + sx]; if (c >= 0) { cell[y * cw + x] = c; solid[y * cw + x] = 1; }
    }
    let front = []; for (let i = 0; i < cell.length; i++) if (cell[i] >= 0) front.push(i);
    while (front.length) {
      const next = [];
      for (const i of front) {
        const x = i % cw, y = (i / cw) | 0, c = cell[i];
        if (x > 0 && cell[i - 1] < 0) { cell[i - 1] = c; next.push(i - 1); }
        if (x < cw - 1 && cell[i + 1] < 0) { cell[i + 1] = c; next.push(i + 1); }
        if (y > 0 && cell[i - cw] < 0) { cell[i - cw] = c; next.push(i - cw); }
        if (y < ch - 1 && cell[i + cw] < 0) { cell[i + cw] = c; next.push(i + cw); }
      }
      front = next;
    }
    const d = this.img.data;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = cell[y * cw + x]; if (c < 0) continue;
      const o = ((this.y + y) * W + this.x + x) * 4;
      d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = solid[y * cw + x] ? 255 : 0;
    }
    if (px.g) {
      if (!this.glowImg) { this.glowImg = this.ctx.createImageData(W, this.H); const g = this.glowImg.data; for (let i = 3; i < g.length; i += 4) g[i] = 255; }
      const g = this.glowImg.data;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const c = px.g[y * px.w + x]; if (c < 0) continue;
        const o = ((this.y + pad + y) * W + this.x + pad + x) * 4; g[o] = (c >> 16) & 255; g[o + 1] = (c >> 8) & 255; g[o + 2] = c & 255;
      }
    }
    const x0 = this.x + pad, y0 = this.y + pad;
    const rect = { x: x0, y: y0, w: px.w, h: px.h, u0: x0 / W, u1: (x0 + px.w) / W, v0: 1 - (y0 + px.h) / this.H, v1: 1 - y0 / this.H };
    this.x += cw; this.rowH = Math.max(this.rowH, ch);
    return rect;
  };
  Atlas.prototype.finish = function () {
    this.ctx.putImageData(this.img, 0, 0);
    if (this.glowImg) { this.glowCanvas = document.createElement('canvas'); this.glowCanvas.width = this.W; this.glowCanvas.height = this.H; this.glowCanvas.getContext('2d').putImageData(this.glowImg, 0, 0); }
  };
  function mkTex(canvas, repeatS) {
    const t = new T.CanvasTexture(canvas);
    t.magFilter = T.NearestFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (repeatS) t.wrapS = T.RepeatWrapping;
    return t;
  }

  // ------------------------------------------------------------------------------------------------ pixel-art sprites
  // leaf "dabs": h = one tone lighter, m = the local tone, d = one tone darker (the shadow under each leaf)
  const DAB_ROUND = [['.hh.', 'hmmm', 'mmmd', '.dd.'], ['.hh..', 'hhmm.', 'mmmmd', '.mdd.'], ['.hm.', 'hmmd', '.dd.'], ['hh.', 'mmd', '.d.'], ['.hhm.', 'hmmmd', '.mdd.']];
  const DAB_AUT = [['..h..', '.hhm.', 'hmmmd', '.mmd.', '..d..'], ['.hh.', 'hmmd', 'mmdd', '.d..'], ['.h.', 'hmd', 'mmd', '.d.'], ['hh..', 'mmmd', '.mdd'], ['.hh.', 'hmmm', '.mmd', '..d.']];
  const DAB_NEEDLE = [['h...', '.m..', '..m.', '...d'], ['...h', '..m.', '.m..', 'd...'], ['.h.', '.m.', '.m.', '.d.'], ['h..', 'mm.', '.md', '..d'], ['..h', '.mm', 'md.', 'd..']];
  const DAB_FLAME = [['.h.', 'hm.', 'hmd', '.md', '.d.'], ['.h', 'hm', 'md', 'md', '.d'], ['h.', 'hm', 'mm', 'md', '.d'], ['.h.', 'hmd', 'hmd', '.d.']];
  const DAB_TINY = [['hm', 'md'], ['.h.', 'mmd', '.d.'], ['hm.', '.md'], ['h.', 'md']];

  function stamp(px, shape, x, y, ch) {
    const hh = shape.length;
    for (let j = 0; j < hh; j++) { const row = shape[j]; for (let i = 0; i < row.length; i++) { const c = ch[row[i]]; if (c !== undefined) px.set(x + i - (row.length >> 1), y + j - (hh >> 1), c); } }
  }
  // light value field of a lumpy blob made of overlapping lobes; -9 outside. Light comes from the top left.
  function lobeMask(w, h, r, o) {
    const m = 3, cx = w / 2, cy = h / 2 + 0.5;
    let lobes = o.lobeList;
    if (!lobes) {
      lobes = [{ x: cx, y: cy, rx: (w / 2 - m) * 0.66, ry: (h / 2 - m) * 0.7 }];
      const nl = o.lobes || 6;
      for (let i = 0; i < nl; i++) {
        const a = (i + r()) / nl * 6.2832, rr = r.range(0.2, 0.29) * Math.min(w, h);
        const ex = w / 2 - m - rr, ey = h / 2 - m - rr;
        lobes.push({ x: cx + Math.cos(a) * ex * r.range(0.8, 1), y: cy + Math.sin(a) * ey * r.range(0.8, 1), rx: rr, ry: rr * r.range(0.8, 1) });
      }
    }
    const ns = r.int(1, 9999), rag = o.rag == null ? 0.55 : o.rag;
    return function (x, y) {
      let best = -9, bx = 0, by = 0;
      for (let k = 0; k < lobes.length; k++) { const l = lobes[k], dx = (x + 0.5 - l.x) / l.rx, dy = (y + 0.5 - l.y) / l.ry, q = 1 - dx * dx - dy * dy; if (q > best) { best = q; bx = dx; by = dy; } }
      if (best + (HD.vnoise(x * 0.31, y * 0.31, ns) - 0.5) * rag <= 0) return -9;
      const z = Math.sqrt(Math.max(0, best));
      return -bx * 0.3 - by * 0.5 + z * 0.22 - (y - cy) / h * 0.75 - (x - cx) / w * 0.3;
    };
  }
  // generic leafy sprite: a mask with a light field, filled with dabs whose tone follows the light.
  // tones[0] is the outline colour, tones[1..] go dark -> light.
  function foliage(w, h, tones, seed, o) {
    o = o || {};
    const px = new Pix(w, h, o.wrap), r = HD.rng(seed), nT = tones.length - 1;
    const L = new Float32Array(w * h).fill(-9);
    const mask = o.mask ? o.mask(w, h, r) : lobeMask(w, h, r, o);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = mask(x, y);
    const sample = (x, y) => { if (o.wrap) x = ((x % w) + w) % w; return (x < 0 || y < 0 || x >= w || y >= h) ? -9 : L[y * w + x]; };
    const tone = (lv, j) => 1 + clamp(Math.floor((lv + 0.62 + j) / 1.5 * nT), 0, nT - 1);
    if (!o.sparse) for (let i = 0; i < L.length; i++) if (L[i] > -9) px.d[i] = tones[Math.max(1, tone(L[i], 0) - 1)];
    const dabs = o.dabs || DAB_ROUND, st = o.step || 4, fill = o.fill == null ? 1 : o.fill, holes = o.holes || 0;
    for (let gy = h + st; gy >= -st; gy -= st) for (let gx = -st; gx < w + st; gx += st) {
      const x = Math.round(gx + r.range(-1.6, 1.6)), y = Math.round(gy + r.range(-1.6, 1.6)), q = r(), q2 = r(), q3 = r();
      if (q > fill) continue;
      let lv = sample(x, y);
      if (lv <= -9) {                                                   // leaves that stick out of the silhouette
        if (o.wrap && (y < 0 || y >= h)) continue;
        lv = sample(x + Math.sign(w / 2 - x) * 2, y + Math.sign(h / 2 - y) * 2);
        if (lv <= -9 || q2 < 0.4) continue;
        if (x < 2 || y < 2 || x > w - 3 || y > h - 3) continue;
      }
      if (q3 < holes) { const c = tones[q2 < 0.5 ? 0 : 1]; px.set(x, y, c); px.set(x + 1, y, c); px.set(x, y + 1, c); if (q2 < 0.3) px.set(x + 1, y + 1, c); continue; }
      const ti = tone(lv, (q2 - 0.5) * 0.36);
      let hi = tones[Math.min(nT, ti + 1)];
      if (o.hl !== undefined && ti === nT && q2 > (o.hlAt == null ? 0.6 : o.hlAt)) hi = o.hl;
      if (o.alt && q > fill * o.altP) { const al = o.alt; stamp(px, dabs[Math.floor(q3 * 977) % dabs.length], x, y, { h: al[Math.min(al.length - 1, ti + 1)], m: al[ti], d: tones[ti - 1] }); continue; }
      stamp(px, dabs[Math.floor(q3 * 977) % dabs.length], x, y, { h: hi, m: tones[ti], d: tones[ti - 1] });
    }
    if (o.clip) for (let i = 0; i < L.length; i++) if (L[i] <= -9) px.d[i] = -1;
    if (!o.noOutline) px.under(tones[0]);
    if (o.opaque) for (let i = 0; i < px.d.length; i++) if (px.d[i] < 0) px.d[i] = tones[1];
    return px;
  }
  // a tier of drooping pine boughs: solid on top (hidden under the tier above), ragged hanging fingers below; tiles in x
  function pineMask(w, h, r) {
    const nf = 5, f = [], ys = h * 0.6, ns = r.int(1, 999);
    for (let i = 0; i < nf; i++) f.push({ x: (i + 0.5 + r.range(-0.22, 0.22)) * w / nf, hw: w / nf * r.range(0.56, 0.8), tip: h - 2 - r.range(0, h * 0.16) });
    return function (x, y) {
      let lv = -9;
      if (y < ys + 3) lv = -0.8 + (y / ys) * 0.75 + (HD.vnoise(x * 0.2, y * 0.2, ns) - 0.5) * 0.55;       // dark under the tier above
      for (let k = 0; k < nf; k++) {
        const g = f[k]; let dx = x - g.x; dx -= Math.round(dx / w) * w;
        const t = (y - ys * 0.85) / (g.tip - ys * 0.85); if (t >= 1) continue;
        const hw = g.hw * Math.pow(1 - Math.max(0, t), 0.55) * (1 - 0.22 * ((y % 4) / 3));               // serrated, needle-tufted edges
        if (Math.abs(dx) < hw) { const v = 0.12 - dx / g.hw * 0.75 + Math.max(0, t) * 0.25 + (y < ys ? (y / ys - 1) * 0.9 : 0); if (v > lv) lv = v; }
      }
      return lv;
    };
  }
  function tileMask(bias) { return (w, h, r) => { const ns = r.int(1, 999); return (x, y) => (HD.fbm(x / 18, y / 18, ns, 3) - 0.5) * 1.5 + bias; }; }

  function twigSprite(seed, tn) {                                        // bare twigs fanning up from the bottom centre
    const w = 48, h = 48, px = new Pix(w, h), r = HD.rng(seed);
    (function grow(x, y, a, len, d) {
      const n = Math.round(len);
      for (let i = 0; i < n; i++) {
        a += r.range(-0.24, 0.24); x += Math.sin(a); y -= Math.cos(a);
        if (d === 0 || (d === 1 && i < n * 0.5)) { px.set(x + 1, y, tn[0]); px.set(x, y, tn[1]); } else px.set(x, y, (d === 1 || r() < 0.3) ? tn[1] : tn[0]);
        if (d > 0 && d < 3 && i > 2 && r() < 0.05) grow(x, y, a + r.sign() * r.range(0.5, 1.1), len * 0.4, 3);
      }
      if (d >= 3) return;
      const k = d === 0 ? 3 : 2, s0 = r.sign();
      for (let j = 0; j < k; j++) grow(x, y, a + (j === 2 ? r.range(-0.2, 0.2) : (j ? -s0 : s0) * r.range(0.35, 0.95)), len * r.range(0.6, 0.8), d + 1);
    })(w / 2, h - 1, r.range(-0.25, 0.25), 12, 0);
    return px;
  }
  function brambleSprite(seed) {                                         // arching thorny canes, a few rust leaves
    const w = 64, h = 44, px = new Pix(w, h), r = HD.rng(seed), n = 7;
    for (let c = 0; c < n; c++) {
      let x = w / 2 + r.range(-9, 9), y = h - 1, vx = r.range(0.25, 1.15) * (c % 2 ? 1 : -1), vy = -r.range(0.9, 1.35);
      const len = r.int(26, 46), back = c < 3, cane = back ? SD[0] : SD[1], lit = back ? SD[1] : SD[3];
      for (let i = 0; i < len; i++) {
        const l = Math.hypot(vx, vy); x += vx / l; y += vy / l; vy += 0.045; vx += r.range(-0.05, 0.05);
        if (y >= h || y < 1 || x < 1 || x > w - 2) break;
        px.set(x, y, cane); if (i < len * 0.45) px.set(x, y - 1, lit);
        if (i % 4 === 2) px.set(x + (i % 8 === 2 ? 1 : -1), y - 1, lit);                         // thorns
        if (i > 6 && r() < 0.11) {
          const rust = r() < 0.3, tn = rust ? [A[0], A[1], A[1], A[2]] : [G[1], M[1], M[2], M[3]], k = r.int(1, 3);
          stamp(px, r.pick(DAB_ROUND), x + r.sign() * 2, y - 2, { h: tn[Math.min(3, k + 1)], m: tn[k], d: tn[k - 1] });
        }
      }
    }
    return px;
  }
  function fernSprite(seed) {                                            // one frond along +x (base at the left)
    const w = 56, h = 22, px = new Pix(w, h), r = HD.rng(seed), cy = h / 2;
    for (let x = 1; x < w - 1; x++) {
      const t = x / w, ry = cy + Math.sin(t * 3 + seed) * 1.2;
      if (x % 3 === 1 && x > 3) {
        const len = Math.round((cy - 2) * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.8) * r.range(0.85, 1));
        for (let k = 1; k <= len; k++) {
          const xx = x + k * 0.45, e = k === len;
          px.set(xx, ry - k, e ? M[5] : M[4]); px.set(xx + 1, ry - k, M[3]);
          px.set(xx, ry + k, e ? M[4] : M[3]); px.set(xx + 1, ry + k, M[2]);
        }
      }
      px.set(x, ry, t < 0.5 ? M[1] : M[2]);
    }
    return px;
  }
  const IVY = [
    ['..x...x..', '.xxx.xxx.', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'],
    ['.x...x.', 'xxx.xxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
    ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'],
  ];
  const IVYT = [[M[0], M[1], M[2], M[3]], [M[0], M[2], M[3], M[4]], [M[1], M[3], M[4], M[5]], [D[0], D[1], D[2], D[2]], [G[1], M[0], M[1], M[2]]];   // edge, base, light, vein
  function ivyLeaf(px, cx, cy, mask, rot, tn) {
    const n = mask.length, c = (n - 1) / 2, cs = Math.cos(rot), sn = Math.sin(rot), R = Math.ceil(n * 0.75);
    const at = (sx, sy) => sx >= 0 && sy >= 0 && sx < n && sy < n && mask[sy][sx] === 'x';
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const sx = Math.round(c + dx * cs + dy * sn), sy = Math.round(c - dx * sn + dy * cs);
      if (!at(sx, sy)) continue;
      const edge = !at(sx - 1, sy) || !at(sx + 1, sy) || !at(sx, sy - 1) || !at(sx, sy + 1);
      let col = tn[1];
      if (edge) col = (dx + dy > -1) ? tn[0] : tn[1];
      else if (sx === Math.round(c) && sy < n * 0.72) col = tn[3];
      else if (dx + dy < -1) col = tn[2];
      px.set(cx + dx, cy + dy, col);
    }
  }
  function ivySprite(size, count, seed, o) {
    o = o || {};
    const px = new Pix(size, size), r = HD.rng(seed), c = size / 2;
    if (o.mass) {                                                        // dark under-layer so a mass is not see-through
      const m = lobeMask(size, size, r, { lobes: 6, rag: 0.7 });
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m(x, y) > -9 && r() < 0.93) px.set(x, y, r() < 0.5 ? M[0] : G[1]);
    }
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1), big = count === 1 ? (size >= 12 ? 0 : 1) : r.int(0, 2), n = IVY[big].length;
      const lim = Math.max(0, c - n * 0.62 - 1), a = r.range(0, 6.283), d = Math.sqrt(r()) * lim;
      let tn = IVYT[t < 0.2 ? (o.mass ? 4 : 0) : t < 0.5 ? (o.mass ? 0 : 1) : (r() < 0.55 ? 1 : 2)];
      if (o.tone != null) tn = IVYT[o.tone];
      ivyLeaf(px, Math.round(c + Math.cos(a) * d), Math.round(c + Math.sin(a) * d), IVY[big], count === 1 ? r.range(-0.3, 0.3) : r.range(-0.9, 0.9), tn);
    }
    px.under(M[0]);
    return px;
  }
  function stemSprite(seed) {
    const w = 8, h = 32, px = new Pix(w, h), r = HD.rng(seed);
    for (let y = 0; y < h; y++) { const x = 3 + Math.round(Math.sin(y * 0.4 + seed) * 0.8); px.set(x, y, W[1]); px.set(x + 1, y, SD[1]); if (r() < 0.14) px.set(x + (r() < 0.5 ? -1 : 2), y, W[0]); }
    return px;
  }
  function blade(px, x0, y0, len, bend, cols, wide) {
    let x = x0, y = y0;
    for (let k = 0; k <= len; k++) {
      const t = k / len; x = x0 + bend * t * t * len; y = y0 - k;
      px.set(x, y, t > 0.72 ? cols[2] : t > 0.3 ? cols[1] : cols[0]);
      if (wide && t < 0.55) px.set(x + 1, y, cols[0]);
    }
    return [Math.round(x), Math.round(y)];
  }
  function tuftSprite(seed) {
    const w = 32, h = 16, px = new Pix(w, h), r = HD.rng(seed);
    for (let i = 0; i < 15; i++) {
      const back = i < 7, x0 = r.range(8, 23);
      blade(px, x0, h - 1, r.range(back ? 8 : 5, back ? 14 : 11), (x0 - 15.5) / 26 + r.range(-0.22, 0.22), back ? [G[2], G[3], G[4]] : [G[3], G[4], r() < 0.35 ? G[6] : G[5]], !back);
    }
    for (let x = 9; x < 23; x++) if (r() < 0.8) px.set(x, h - 1, G[2]);
    return px;
  }
  function tallSprite(seed) {
    const w = 32, h = 44, px = new Pix(w, h), r = HD.rng(seed);
    for (let i = 0; i < 16; i++) {
      const back = i < 8, x0 = r.range(10, 21), len = r.range(back ? 22 : 12, back ? 38 : 26), bend = (x0 - 15.5) / 60 + r.range(-0.13, 0.13);
      const tip = blade(px, x0, h - 1, len, bend, back ? [G[2], G[3], G[4]] : [G[3], G[4], G[5]], !back);
      if (len > 24 && r() < 0.6) {                                       // seed head
        const dx = bend > 0 ? 1 : -1;
        for (let k = 0; k < 5; k++) { px.set(tip[0] + (k > 2 ? dx : 0), tip[1] + 2 - k, k % 2 ? SD[4] : SD[5]); px.set(tip[0] + 1 + (k > 2 ? dx : 0), tip[1] + 2 - k, k === 2 ? SD[6] : SD[3]); }
      }
    }
    for (let x = 10; x < 22; x++) px.set(x, h - 1, G[2]);
    return px;
  }
  function broadLeaf(px, x0, y0, ang, len, wid, cols) {                  // cols: edge, base, light, rib
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    for (let k = 0; k <= len * 2; k++) {
      const t = k / (len * 2), hw = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.7);
      const cx = x0 + dx * t * len, cy = y0 + dy * t * len + t * t * len * 0.3;
      for (let s = -hw; s <= hw; s += 0.5) {
        const x = cx - dy * s, y = cy + dx * s, e = Math.abs(s) > hw - 0.8;
        px.set(x, y, e ? (dx * s > 0 || t > 0.9 ? cols[0] : cols[2]) : Math.abs(s) < 0.4 ? cols[3] : (dx * s > 0 ? cols[1] : cols[2]));
      }
    }
  }
  function weedSprite(seed) {
    const w = 32, h = 22, px = new Pix(w, h), r = HD.rng(seed), n = r.int(5, 7);
    const order = []; for (let i = 0; i < n; i++) order.push((i + 0.5) / n * 2.7 - 1.35 + r.range(-0.12, 0.12));
    order.sort((a, b) => Math.abs(b) - Math.abs(a));
    for (const a of order) {
      const dark = r() < 0.4;
      broadLeaf(px, w / 2 + a * 1.5, h - 1, a, r.range(10, 14.5) * (1 - Math.abs(a) * 0.12), r.range(2.2, 3.2), dark ? [M[1], M[2], M[3], M[4]] : [M[2], M[3], M[4], M[5]]);
    }
    return px;
  }
  function moonSprite(seed) {
    const w = 32, h = 30, px = new Pix(w, h), r = HD.rng(seed);
    for (let i = 0; i < 7; i++) { const x0 = r.range(10, 22); blade(px, x0, h - 1, r.range(4, 9), (x0 - 16) / 22 + r.range(-0.2, 0.2), [M[1], M[2], M[3]], false); }
    const n = r.int(3, 5);
    for (let i = 0; i < n; i++) {
      const x0 = 9 + (i + r.range(0.1, 0.9)) * 14 / n, tip = blade(px, x0, h - 1, r.range(11, 24), (x0 - 16) / 70 + r.range(-0.08, 0.08), [M[2], M[3], M[3]], false);
      const x = tip[0], y = tip[1], kind = r.int(0, 2), c = SD[8], c2 = SD[7], sh = SD[5];
      const dot = (xx, yy, col) => { px.set(xx, yy, col); px.glow(xx, yy, col === sh ? 0x2a2620 : col === c2 ? 0x4a4438 : 0x6a6252); };
      if (kind === 0) { dot(x, y - 1, c); dot(x - 1, y, c); dot(x + 1, y, c2); dot(x, y, c2); dot(x, y + 1, sh); }
      else if (kind === 1) { dot(x, y, c); dot(x + 1, y, c); dot(x, y + 1, c2); dot(x + 1, y + 1, sh); dot(x - 1, y, c2); }
      else { dot(x - 1, y - 1, c); dot(x, y - 1, c); dot(x + 1, y - 1, c2); dot(x - 1, y, c); dot(x, y, c2); dot(x + 1, y, sh); dot(x, y + 1, sh); }
    }
    return px;
  }
  function reedSprite(seed) {
    const w = 24, h = 80, px = new Pix(w, h), r = HD.rng(seed);
    for (let i = 0; i < 7; i++) {
      const back = i < 3, x0 = r.range(8, 15);
      blade(px, x0, h - 1, r.range(44, 74), (x0 - 11.5) / 110 + r.range(-0.07, 0.07), back ? [G[2], G[3], M[3]] : [G[3], M[4], r() < 0.5 ? SD[4] : G[5]], true);
    }
    const nc = r.int(1, 2);
    for (let i = 0; i < nc; i++) {
      const x0 = r.range(8, 15), tip = blade(px, x0, h - 1, r.range(58, 72), r.range(-0.04, 0.04), [G[2], M[3], M[3]], false), x = tip[0], y = tip[1];
      for (let k = 0; k < 4; k++) px.set(x, y - k + 3, D[3]);
      for (let k = 0; k < 10; k++) { px.set(x - 1, y + 4 + k, SD[3]); px.set(x, y + 4 + k, SD[2]); px.set(x + 1, y + 4 + k, SD[1]); }
      px.set(x, y + 3, SD[1]); px.set(x, y + 14, SD[1]);
    }
    return px;
  }
  function fallenLeaf(seed, tn) {                                        // 8x8 single leaf; tn: edge, base, light
    const px = new Pix(8, 8), r = HD.rng(seed), a = r.range(0, 3.1416), cs = Math.cos(a), sn = Math.sin(a), L = r.range(2.6, 3.4), Wd = r.range(1.2, 1.9), curl = r() < 0.35;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const dx = x - 3.5, dy = y - 3.5, u = dx * cs + dy * sn, v = -dx * sn + dy * cs, q = (u * u) / (L * L) + (v * v) / (Wd * Wd * (1 - u / L * 0.5));
      if (q > 1 || (curl && v > 0.6)) continue;
      px.set(x, y, q > 0.62 ? (dx + dy > 0 ? tn[0] : tn[1]) : Math.abs(v) < 0.5 ? tn[2] : tn[1]);
    }
    return px;
  }
  // bark: three bands (oak, pine, dead) of 64x64, tiling around the trunk (u wraps), mirrored along it
  function barkCanvas() {
    const w = 64, bh = 64, sets = [[INK, SD[0], SD[1], SD[2], SD[3], SD[4]], [INK, W[0], SD[0], SD[1], SD[2], SD[3]], [INK, S[0], S[1], S[2], S[3], S[5]]];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = bh * sets.length;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, cv.height), d = img.data;
    sets.forEach((tn, b) => {
      const px = new Pix(w, bh, true), r = HD.rng(911 + b * 13), per = (x, y, s) => { const a = HD.vnoise(x, y, s), c = HD.vnoise(x - w * 0.42, y, s), t = (x / (w * 0.42)); return a * (1 - t) + c * t; };
      for (let y = 0; y < bh; y++) for (let x = 0; x < w; x++) { const n = per(x * 0.42, y * 0.07, 31 + b) + (HD.hash2(x, y, b) - 0.5) * 0.16; px.set(x, y, tn[n < 0.36 ? 1 : n < 0.68 ? 2 : 3]); }
      for (let c = 0; c < 11; c++) {                                     // fissures with a lit ridge on their right
        let x = r.int(0, w - 1), y = r.int(-10, bh - 8); const len = r.int(14, 46);
        for (let i = 0; i < len; i++, y++) {
          if (r() < 0.3) x += r.sign();
          px.set(x, y, tn[0]); if (r() < 0.75) px.set(x + 1, y, tn[4]); if (r() < 0.15) px.set(x + 2, y, tn[5]); if (r() < 0.5) px.set(x - 1, y, tn[1]);
        }
      }
      for (let k = 0; k < 2; k++) { const x = r.int(6, w - 7), y = r.int(8, bh - 9); for (let a = 0; a < 12; a++) px.set(x + Math.cos(a * 0.524) * 3, y + Math.sin(a * 0.524) * 2, tn[a < 6 ? 0 : 4]); px.set(x, y, tn[1]); }
      for (let y = 0; y < bh; y++) for (let x = 0; x < w; x++) { const c = px.d[y * w + x], o = ((b * bh + y) * w + x) * 4; d[o] = (c >> 16) & 255; d[o + 1] = (c >> 8) & 255; d[o + 2] = c & 255; d[o + 3] = 255; }
    });
    ctx.putImageData(img, 0, 0);
    return { canvas: cv, bands: sets.length };
  }

  function buildSprites() {
    const at = new Atlas(1024, 512, 4, G[1]), ga = new Atlas(256, 256, 4, G[3]);
    const SPR = {}, add = px => at.add(px);
    // tones[0] = shaded edge / deepest gap, then dark -> light. No ink: the darkest ramp steps do the outlining.
    const species = {
      green: { dabs: DAB_ROUND, lit: [G[2], G[3], G[4], G[5], G[6]], mid: [G[1], G[2], G[3], G[4], G[5]], shade: [G[1], G[1], G[2], G[3], M[3]], hl: G[7], seed: 100 },
      // rust, not orange: the bright autumn steps are only sparks, and a share of the leaves are dull brown
      autumn: { dabs: DAB_AUT, lit: [A[1], A[1], A[2], A[2], A[3]], mid: [A[0], A[1], A[1], A[2], A[2]], shade: [A[0], A[0], A[1], A[1], A[2]], hl: A[4], hlAt: 0.8,    // a few amber sparks on the lit clumps only
        alt: { lit: [A[1], D[1], D[2], D[2], D[3]], mid: [A[0], D[1], D[1], D[2], D[2]], shade: [A[0], D[0], D[0], D[1], D[1]] }, seed: 200 },
      shrub: { dabs: DAB_TINY, lit: [M[1], M[2], M[3], M[4], M[5]], mid: [M[0], M[1], M[2], M[3], M[4]], shade: [M[0], M[0], M[1], M[2], M[3]], hl: M[5], seed: 300, step: 3 },
    };
    // big opaque tiles for the dark canopy cores first (tallest shelf)
    SPR.tile = {
      green: add(foliage(128, 128, [G[1], G[1], G[2], G[3], M[3]], 71, { mask: tileMask(-0.2), opaque: true, noOutline: true, holes: 0.1 })),
      autumn: add(foliage(128, 128, [A[0], A[0], A[1], A[1], A[2]], 72, { mask: tileMask(-0.2), dabs: DAB_AUT, opaque: true, noOutline: true, holes: 0.1 })),
      dark: add(foliage(128, 128, [G[0], G[0], M[0], G[1], M[1]], 73, { mask: tileMask(-0.25), dabs: DAB_FLAME, opaque: true, noOutline: true, holes: 0.08 })),
    };
    const pineT = [G[0], G[1], G[1], G[2], M[2], G[3], G[4]];
    SPR.pine = [0, 1].map(i => add(foliage(96, 80, pineT, 400 + i, { wrap: true, mask: pineMask, dabs: DAB_NEEDLE, clip: true, hl: G[5], holes: 0.04 })));
    for (const k in species) {
      const sp = species[k], S0 = (SPR[k] = {});
      const w = k === 'shrub' ? 48 : 64, h = k === 'shrub' ? 40 : 56;
      for (const tone of ['lit', 'mid', 'shade']) S0[tone] = [0, 1, 2].map(i => add(foliage(w, h, sp[tone], sp.seed + i * 7 + tone.length * 31, { dabs: sp.dabs, step: sp.step, hl: tone === 'lit' ? sp.hl : undefined, hlAt: sp.hlAt, holes: tone === 'shade' ? 0.12 : 0.06, alt: sp.alt && sp.alt[tone], altP: 0.84 })));
      S0.sparse = [0, 1, 2].map(i => add(foliage(w, h, i === 2 ? sp.shade : sp.mid, sp.seed + 50 + i, { dabs: sp.dabs, step: sp.step, sparse: true, fill: 0.62, rag: 1.1, alt: sp.alt && sp.alt[i === 2 ? 'shade' : 'mid'], altP: 0.84 })));
    }
    const flame = (w, h) => ({ lobeList: [{ x: w / 2, y: h * 0.62, rx: w * 0.4, ry: h * 0.33 }, { x: w / 2 - 1, y: h * 0.34, rx: w * 0.27, ry: h * 0.3 }, { x: w / 2 + 1, y: h * 0.17, rx: w * 0.13, ry: h * 0.14 }, { x: w / 2 - 5, y: h * 0.78, rx: w * 0.26, ry: h * 0.17 }, { x: w / 2 + 6, y: h * 0.74, rx: w * 0.24, ry: h * 0.2 }], dabs: DAB_FLAME, rag: 0.7 });
    SPR.cyp = {
      lit: [0, 1].map(i => add(foliage(40, 64, [G[0], G[1], M[1], G[2], M[2], G[3]], 500 + i, Object.assign(flame(40, 64), { hl: G[4] })))),
      shade: [0, 1].map(i => add(foliage(40, 64, [G[0], G[0], M[0], G[1], M[1], G[2]], 510 + i, flame(40, 64)))),
    };
    SPR.twig = [0, 1, 2].map(i => add(twigSprite(600 + i, [INK, S[1], S[3]])));
    SPR.bramble = [0, 1, 2].map(i => add(brambleSprite(620 + i)));
    SPR.fern = [0, 1].map(i => add(fernSprite(640 + i)));
    SPR.ivy = {
      mass: [0, 1].map(i => add(ivySprite(48, 30, 660 + i, { mass: true }))),
      cluster: [0, 1, 2, 3].map(i => add(ivySprite(28, 7, 670 + i))),
      leaf: [0, 1, 2, 1, 2, 3].map((tn, i) => add(ivySprite(i < 3 ? 12 : 10, 1, 680 + i, { tone: tn }))),
      stem: [0, 1].map(i => add(stemSprite(690 + i))),
    };
    at.finish();
    const GS = {};
    GS.reed = [0, 1, 2].map(i => ga.add(reedSprite(700 + i)));
    GS.tall = [0, 1, 2].map(i => ga.add(tallSprite(710 + i)));
    GS.moonflower = [0, 1, 2].map(i => ga.add(moonSprite(720 + i)));
    GS.weed = [0, 1, 2].map(i => ga.add(weedSprite(730 + i)));
    GS.tuft = [0, 1, 2, 3].map(i => ga.add(tuftSprite(740 + i)));
    GS.autumn = [0, 1, 2, 3, 4, 5].map(i => ga.add(fallenLeaf(750 + i, i % 3 === 0 ? [A[0], A[1], A[2]] : i % 3 === 1 ? [A[1], A[2], A[3]] : [A[1], D[2], D[3]])));
    GS.dry = [0, 1, 2, 3, 4, 5].map(i => ga.add(fallenLeaf(770 + i, i % 3 === 0 ? [W[1], D[2], D[3]] : i % 3 === 1 ? [SD[1], SD[3], SD[4]] : [D[1], D[3], D[4]])));
    ga.finish();
    return { at, ga, SPR, GS, bark: barkCanvas() };
  }

  // ------------------------------------------------------------------------------------------------ wind shader
  const WIND_GLSL = [
    'uniform float hdTime;',
    'attribute float hdSway;',
    'vec3 hdWind( vec3 wp, float w ) {',
    '  float gust = 0.55 + 0.45 * sin( hdTime * 0.37 + wp.x * 0.045 + wp.z * 0.06 );',
    '  gust *= 0.75 + 0.25 * sin( hdTime * 0.83 + wp.x * 0.11 - wp.z * 0.07 + 2.0 );',
    '  float a = sin( hdTime * 1.15 + wp.x * 0.33 + wp.z * 0.21 );',
    '  float b = sin( hdTime * 2.3 + wp.x * 0.9 - wp.z * 0.7 + 1.3 );',
    '  float s = ( 0.3 + 0.65 * a + 0.25 * b ) * gust;',
    '  return vec3( s * 0.92, - abs( s ) * 0.14, s * 0.38 ) * w;',
    '}', ''].join('\n');
  // the sway is added in model space (these meshes are built in world coordinates, so that is world space) and only
  // uses modelMatrix / modelViewMatrix, which three also sets for the depth material in the shadow pass
  const PROJECT_GLSL = [
    'vec4 mvPosition = vec4( transformed, 1.0 );',
    '#ifdef USE_INSTANCING',
    '  mvPosition = instanceMatrix * mvPosition;',
    '  vec3 hdAnchor = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;',
    '  float hdW = hdSway * length( instanceMatrix[ 1 ].xyz );',
    '#else',
    '  vec3 hdAnchor = ( modelMatrix * mvPosition ).xyz;',
    '  float hdW = hdSway;',
    '#endif',
    'mvPosition.xyz += hdWind( hdAnchor, hdW );',
    'mvPosition = modelViewMatrix * mvPosition;',
    'gl_Position = projectionMatrix * mvPosition;'].join('\n');

  // ------------------------------------------------------------------------------------------------ geometry builder
  function Builder() { this.p = []; this.n = []; this.u = []; this.c = []; this.s = []; this.i = []; this.nv = 0; this.ox = 0; this.oy = 0; this.oz = 0; this.lx = 0; this.lz = 0; this.hh = 1; }
  Builder.prototype.origin = function (x, y, z, lx, lz, h) { this.ox = x; this.oy = y; this.oz = z; this.lx = lx || 0; this.lz = lz || 0; this.hh = h || 1; };
  Builder.prototype.vert = function (p, n, u, v, col, cm, sway) {
    const k = p.y > 0 ? p.y * (0.45 + 0.55 * Math.min(1, p.y / this.hh)) : 0;
    this.p.push(this.ox + p.x + this.lx * k, this.oy + p.y, this.oz + p.z + this.lz * k);
    this.n.push(n.x, n.y, n.z); this.u.push(u, v); this.c.push(col[0] * cm, col[1] * cm, col[2] * cm); this.s.push(sway);
    return this.nv++;
  };
  const _e1 = new V3(), _e2 = new V3(), _gn = new V3();
  // a (bottom left), b (bottom right), c (top right), d (top left) as seen from the front. uv: [ua,va, ub,vb, uc,vc, ud,vd].
  // nf(p) -> shading normal. face: reference direction the front must face (winding is flipped if it does not).
  Builder.prototype.quad = function (a, b, c, d, uv, nf, col, cb, ct, sb, st, face) {
    _e1.subVectors(b, a); _e2.subVectors(d, a); _gn.crossVectors(_e1, _e2);
    const flip = face && _gn.dot(face) < 0;
    const ia = this.vert(a, nf(a), uv[0], uv[1], col, cb, sb), ib = this.vert(b, nf(b), uv[2], uv[3], col, cb, sb);
    const ic = this.vert(c, nf(c), uv[4], uv[5], col, ct, st), id = this.vert(d, nf(d), uv[6], uv[7], col, ct, st);
    if (flip) this.i.push(ia, ic, ib, ia, id, ic); else this.i.push(ia, ib, ic, ia, ic, id);
  };
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
  // card centred at c along R, starting anchor*h below c along U
  Builder.prototype.card = function (c, R, U, w, h, anchor, spr, nf, col, cb, ct, sb, st, face, flip) {
    _a.copy(c).addScaledVector(R, -w / 2).addScaledVector(U, -h * anchor); _b.copy(_a).addScaledVector(R, w);
    _c.copy(_b).addScaledVector(U, h); _d.copy(_a).addScaledVector(U, h);
    this.quad(_a, _b, _c, _d, sprUV(spr, flip), nf, col, cb, ct, sb, st, face);
  };
  Builder.prototype.geometry = function () {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute('hdSway', new T.Float32BufferAttribute(this.s, 1));
    g.setIndex(this.nv > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  };
  function sprUV(s, flip) { const a = flip ? s.u1 : s.u0, b = flip ? s.u0 : s.u1; return [a, s.v0, b, s.v0, b, s.v1, a, s.v1]; }
  // frame of a card whose normal is nc: U is "up" in the card plane, R to the right as seen from the front
  function frame(nc, roll, R, U) {
    U.copy(Y).addScaledVector(nc, -nc.y);
    if (U.lengthSq() < 0.03) { U.set(0, 0, -1); U.addScaledVector(nc, -U.dot(nc)); }
    U.normalize(); R.crossVectors(U, nc).normalize();
    if (roll) { const cs = Math.cos(roll), sn = Math.sin(roll); _e1.copy(R).multiplyScalar(cs).addScaledVector(U, sn); U.multiplyScalar(cs).addScaledVector(R, -sn); R.copy(_e1); }
  }

  // low-poly bent tube with bark. pts: [{x,y,z,r}]. band: bark band index. sw(p) -> sway weight. col(p) -> brightness.
  const _t = new V3(), _nrm = new V3(), _bin = new V3(), _q = new V3(), _pn = new V3();
  function tube(B, pts, sides, band, bands, o) {
    o = o || {};
    const n = pts.length, rep = Math.max(1, Math.round(6.2832 * pts[0].r * TPU / 64)), base = B.nv, tint = o.tint || [1, 1, 1];
    const twist = o.twist || 0, bump = o.bump || 0, r = o.rnd;
    let v = o.v0 || 0, dir = 1;
    _nrm.set(1, 0, 0);
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      _t.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      _nrm.addScaledVector(_t, -_nrm.dot(_t)); if (_nrm.lengthSq() < 1e-4) _nrm.set(0, 0, 1).addScaledVector(_t, -_t.z); _nrm.normalize();
      _bin.crossVectors(_t, _nrm);
      if (i > 0) { const q = pts[i - 1], seg = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) * TPU / 64; v += seg * dir; if (v > 1) { v = 1; dir = -1; } else if (v < 0) { v = 0; dir = 1; } }
      const vv = 1 - (band + (0.5 + v * 63) / 64) / bands;
      for (let j = 0; j <= sides; j++) {
        const ang = (j % sides) / sides * 6.2832 + twist * i, cs = Math.cos(ang), sn = Math.sin(ang);
        const rr = p.r * (1 + (bump && r ? (HD.hash2(i * 7 + (o.salt || 0), j % sides, 5) - 0.5) * 2 * bump : 0));
        _pn.copy(_nrm).multiplyScalar(cs).addScaledVector(_bin, sn);
        _q.set(p.x, p.y, p.z).addScaledVector(_pn, rr);
        B.vert(_q, _pn, j / sides * rep + twist * i * 0.16, vv, tint, o.col ? o.col(_q) : 1, o.sw ? o.sw(_q) : 0);
      }
    }
    const row = sides + 1;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
      const A0 = base + i * row + j, B0 = A0 + 1, C0 = A0 + row + 1, D0 = A0 + row;
      B.i.push(A0, B0, C0, A0, C0, D0);
    }
  }
  // a wandering limb: returns points from p0 along dir
  function limb(r, p0, dir, len, r0, r1, segs, kink, up, zflat) {
    const pts = [{ x: p0.x, y: p0.y, z: p0.z, r: r0 }], d = new V3(dir.x, dir.y, dir.z).normalize(), p = new V3(p0.x, p0.y, p0.z);
    for (let i = 1; i <= segs; i++) {
      d.x += r.range(-1, 1) * kink; d.y += r.range(-1, 1) * kink * 0.6 + up; d.z += r.range(-1, 1) * kink * (zflat || 0.7); d.normalize();
      p.addScaledVector(d, len / segs);
      pts.push({ x: p.x, y: p.y, z: p.z, r: r0 + (r1 - r0) * Math.pow(i / segs, 0.8) });
    }
    pts.dir = d;
    return pts;
  }
  // icosahedron (unit), for the dark opaque cores inside canopies
  const ICO = (function () {
    const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(a => new V3(a[0], a[1], a[2]).normalize());
    const f = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
    return { v, f };
  })();
  const _n = new V3(), _m = new V3(), _p = new V3(), _R = new V3(), _U = new V3(), _nc = new V3(), _dd = new V3();
  // shading normals: outward from the blob centre and from the whole canopy centre, pushed upward
  function canopyNormal(C, rad, canC, upBias) {
    return function (p) {
      _n.set((p.x - C.x) / rad.x, (p.y - C.y) / rad.y, (p.z - C.z) / rad.z).normalize().multiplyScalar(0.55);
      _m.set(p.x - canC.x, p.y - canC.y, p.z - canC.z).normalize(); _n.addScaledVector(_m, 0.45); _n.y += upBias;
      if (_n.y < -0.12) _n.y = -0.12;
      return _n.normalize();
    };
  }
  function core(B, C, rad, tile, nf, col, cm, sw, scale) {
    const base = B.nv, tw = tile.u1 - tile.u0, th = tile.v1 - tile.v0, k = TPU / 128;
    for (let i = 0; i < 12; i++) {
      const v = ICO.v[i]; _p.set(C.x + v.x * rad.x * scale, C.y + v.y * rad.y * scale, C.z + v.z * rad.z * scale);
      const su = clamp(0.5 + (_p.x - C.x) * k, 0.02, 0.98), sv = clamp(0.5 + ((_p.y - C.y) * CAM.z - (_p.z - C.z) * CAM.y) * k, 0.02, 0.98);   // planar from the camera
      B.vert(_p, nf(_p), tile.u0 + su * tw, tile.v0 + sv * th, col, cm * (0.75 + 0.25 * (v.y * 0.5 + 0.5)), sw(_p));
    }
    for (let i = 0; i < 60; i++) B.i.push(base + ICO.f[i]);
  }
  // a clump: an opaque dark core wrapped in a shell of leaf cards laid like shingles on the camera side
  function blob(B, r, C, rad, o) {
    const nf = canopyNormal(C, rad, o.canC, o.up == null ? 0.38 : o.up), set = o.set, n = o.n, sw = o.sw;
    if (o.tile) core(B, C, rad, o.tile, nf, o.col, o.coreTone || 0.72, sw, o.coreScale || 0.6);
    const off = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const yv = 1 - (i + 0.5) / n * 1.8, rr = Math.sqrt(Math.max(0, 1 - yv * yv)), a = i * 2.39996 + off;      // fibonacci, upper 86% of the sphere
      _dd.set(Math.cos(a) * rr + r.range(-0.15, 0.15), yv + r.range(-0.1, 0.1), Math.sin(a) * rr + r.range(-0.15, 0.15)).normalize();
      const facing = _dd.dot(CAM);
      if (facing < -0.3 && (i % 3)) continue;                            // the far side is never seen: a few cards only, for shadow and silhouette
      _nc.copy(_dd).addScaledVector(CAM, 0.85).normalize();
      frame(_nc, r.range(-0.1, 0.1), _R, _U);
      const dist = r.range(0.78, 1);
      _p.set(C.x + _dd.x * rad.x * dist, C.y + _dd.y * rad.y * dist, C.z + _dd.z * rad.z * dist);
      const nn = nf(_p), lv = nn.dot(KEY) * 0.7 + (_p.y - o.canC.y) / o.canR * 0.3 + _dd.y * 0.34 + r.range(-0.14, 0.14) + (o.lightBias || 0);
      let list = lv > 0.5 ? set.lit : lv > 0.02 ? set.mid : set.shade;
      const edge = facing < 0.15 && Math.abs(_dd.x) > 0.7;
      if (edge && set.sparse && r() < (o.sparse == null ? 0.3 : o.sparse)) list = set.sparse;
      const spr = list[r.int(0, list.length - 1)], s = (o.size || 1) * r.range(0.86, 1.1), w = spr.w / TPU * s, h = spr.h / TPU * s;
      const hf = clamp((_p.y - o.canC.y) / o.canR * 0.5 + 0.5, 0, 1), cm = (0.8 + 0.3 * hf + r.range(-0.05, 0.05)) * (0.8 + 0.26 * _dd.y);
      B.card(_p, _R, _U, w, h, 0.55, spr, nf, o.col, cm * 0.9, cm, sw(_p) + 0.01, sw(_p) + (o.flutter || 0.04), CAM, r() < 0.5);
    }
  }

  // ------------------------------------------------------------------------------------------------ trees
  const BAND = { oak: 0, pine: 1, dead: 2 };
  function roots(TB, r, bands, band, R0, n, tint, spread) {
    for (let k = 0; k < n; k++) {
      const az = (k + r.range(-0.3, 0.3)) / n * 6.2832, cx = Math.cos(az), cz = Math.sin(az), L = spread * r.range(0.8, 1.25), wob = r.range(-0.5, 0.5);
      const px = -cz * wob, pz = cx * wob, rr = R0 * r.range(0.4, 0.58);
      const pts = [
        { x: cx * R0 * 0.35, y: R0 * 1.7, z: cz * R0 * 0.35, r: rr * 0.9 },
        { x: cx * R0 * 1.25, y: R0 * 0.75, z: cz * R0 * 1.25, r: rr },
        { x: cx * (R0 * 1.3 + L * 0.45) + px * 0.4, y: 0.14, z: cz * (R0 * 1.3 + L * 0.45) + pz * 0.4, r: rr * 0.72 },
        { x: cx * (R0 * 1.3 + L * 0.8) + px, y: 0.02, z: cz * (R0 * 1.3 + L * 0.8) + pz, r: rr * 0.45 },
        { x: cx * (R0 * 1.3 + L) + px * 1.4, y: -0.2, z: cz * (R0 * 1.3 + L) + pz * 1.4, r: rr * 0.15 },
      ];
      tube(TB, pts, 4, band, bands, { tint, col: p => 0.72 + 0.28 * clamp(p.y / 0.5, 0, 1), salt: k * 31, rnd: r, bump: 0.12 });
    }
  }
  function leafTree(c, it, r, aut) {
    const TB = c.TB, FB = c.FB, SPR = c.SPR, h = it.h || 8.5, bands = c.bands;
    const R0 = h * (aut ? 0.06 : 0.048), hf = h * (aut ? 0.35 : 0.4);
    const tint = aut ? [1.05, 0.98, 0.95] : [0.95, 1, 0.98];
    const swT = aut ? 0.07 : 0.09, sw = p => swT * Math.pow(clamp(p.y / h, 0, 1), 2);
    const trunkCol = p => (0.62 + 0.38 * clamp(p.y / 1.2, 0, 1)) * (1 - 0.3 * clamp((p.y - hf * 0.7) / (hf * 0.5), 0, 1));
    // trunk: S-bend, flared foot
    const segs = aut ? 7 : 5, ph = r.range(0, 6.28), amp = h * (aut ? 0.05 : 0.03), pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, y = -0.4 + (hf + 0.4) * t, rad = R0 * (0.72 + 0.28 * (1 - t)) * (1 + 0.85 * Math.exp(-Math.max(0, y) / 0.45));
      pts.push({ x: Math.sin(t * 4.2 + ph) * amp * t, y, z: Math.cos(t * 3.1 + ph) * amp * 0.5 * t, r: rad });
    }
    tube(TB, pts, aut ? 8 : 7, BAND.oak, bands, { tint, col: trunkCol, sw, twist: aut ? 0.3 : 0.12, bump: 0.1, rnd: r });
    roots(TB, r, bands, BAND.oak, R0 * 1.35, aut ? 6 : 5, tint, h * (aut ? 0.12 : 0.09));
    const top = pts[segs], blobs = [], set = aut ? SPR.autumn : SPR.green;
    const nb = aut ? 6 : 4;
    const branchCol = p => 0.62 + 0.2 * clamp((hf * 1.6 - p.y) / hf, 0, 1);
    for (let k = 0; k < nb; k++) {
      // boughs fan from west round by the north to east: seen from the south the canopy then sits above the trunk like a
      // side view, and the fork stays visible. cen = 1 for the boughs in the middle of the picture (they rise steeper).
      const f = k / (nb - 1), az = 3.0 + (f + r.range(-0.07, 0.07)) * 3.42, cen = Math.sin(f * Math.PI);
      const el = 0.36 + 0.5 * cen + r.range(-0.08, 0.1);
      const dir = new V3(Math.cos(az), el, Math.sin(az) * 0.8).normalize();
      const len = h * r.range(0.3, 0.37) * (aut ? 1.2 : 0.92) * (1 - 0.15 * cen);
      const bp = limb(r, top, dir, len, R0 * 0.56, R0 * 0.15, 4, 0.24, 0.1);
      tube(TB, bp, 5, BAND.oak, bands, { tint, col: branchCol, sw, salt: k * 9, rnd: r, bump: 0.08 });
      const e = bp[4]; blobs.push({ x: e.x, y: e.y + h * 0.04, z: e.z, r: h * ((aut ? 0.14 : 0.155) + 0.035 * cen + r.range(0, 0.025)) });
      const s = r.sign() * r.range(0.6, 1.05), cs = Math.cos(s), sn = Math.sin(s), m = bp[2];
      const d2 = new V3(dir.x * cs - dir.z * sn, dir.y + 0.25, dir.x * sn + dir.z * cs).normalize();
      const sp = limb(r, m, d2, len * 0.62, R0 * 0.3, R0 * 0.1, 3, 0.26, 0.12);
      tube(TB, sp, 4, BAND.oak, bands, { tint, col: branchCol, sw, salt: k * 9 + 4 });
      const e2 = sp[3]; blobs.push({ x: e2.x, y: e2.y + h * 0.03, z: e2.z, r: h * r.range(aut ? 0.12 : 0.135, aut ? 0.155 : 0.17) });
    }
    const lp = limb(r, top, new V3(r.range(-0.2, 0.2), 1, r.range(-0.25, 0)), h * (aut ? 0.4 : 0.38), R0 * 0.6, R0 * 0.14, 4, 0.2, 0.15);
    tube(TB, lp, 5, BAND.oak, bands, { tint, col: branchCol, sw, salt: 77 });
    blobs.push({ x: lp[4].x, y: lp[4].y + h * 0.02, z: lp[4].z, r: h * 0.2 });
    blobs.push({ x: lp[2].x + r.range(-0.8, 0.8), y: lp[3].y, z: lp[2].z - h * 0.14, r: h * 0.19 });
    // keep an arch open over the fork: clumps that would hang in front of it (on screen) are lifted
    const sClear = hf * CAM.z + h * 0.08;
    for (const b of blobs) {
      const wgt = clamp(1 - (Math.abs(b.x) - h * 0.13) / (h * 0.18), 0, 1), bottom = b.y * CAM.z - b.z * CAM.y - b.r * 1.25;
      if (bottom < sClear) b.y += (sClear - bottom) * wgt / CAM.z;
    }
    // canopy
    const canC = new V3(); let ymin = 1e9, ymax = -1e9;
    for (const b of blobs) { canC.x += b.x; canC.y += b.y; canC.z += b.z; ymin = Math.min(ymin, b.y - b.r * 0.8); ymax = Math.max(ymax, b.y + b.r * 0.8); }
    canC.multiplyScalar(1 / blobs.length); canC.y = (ymin + ymax) / 2 - h * 0.05;
    const canR = (ymax - ymin) / 2, col = aut ? [0.94, 0.95, 0.97] : [0.96, 1, 0.97];
    const tv = r.range(0.92, 1.06); col[0] *= tv; col[1] *= tv; col[2] *= tv;
    for (const b of blobs) {
      blob(FB, r, new V3(b.x, b.y, b.z), new V3(b.r * 1.15, b.r * 0.82, b.r), { canC, canR, set, n: aut ? 18 : 15, tile: aut ? SPR.tile.autumn : SPR.tile.green, col, sw, size: clamp(b.r / 1.55, 0.85, 1.12), flutter: 0.05 });
    }
  }
  function deadTree(c, it, r) {
    const TB = c.TB, FB = c.FB, SPR = c.SPR, h = it.h || 6, bands = c.bands, R0 = h * 0.06, tint = [1, 1, 1];
    const sw = p => 0.03 * Math.pow(clamp(p.y / h, 0, 1), 2);
    const sides = [7, 5, 4, 3], segn = [6, 4, 3, 2];
    const nfTwig = () => _n.set(-0.25, 0.75, 0.2).normalize(), twigCol = [0.95, 0.95, 1];
    const twig = (p, d, s) => {
      _nc.copy(CAM).multiplyScalar(0.75).add(_m.set(0, 0, 0.4)).normalize();
      _U.copy(d).addScaledVector(_nc, -d.dot(_nc)); if (_U.lengthSq() < 0.01) _U.copy(Y); _U.normalize(); _R.crossVectors(_U, _nc).normalize();
      const spr = SPR.twig[r.int(0, 2)], w = spr.w / TPU * s;
      FB.card(_p.set(p.x, p.y, p.z), _R, _U, w, w, 0.04, spr, nfTwig, twigCol, 0.9, 1, sw(p), sw(p) + 0.03, CAM, r() < 0.5);
    };
    (function grow(p0, dir, len, r0, depth, salt) {
      const last = depth === 3, pts = limb(r, p0, dir, len, r0, r0 * (last ? 0.12 : 0.58), segn[depth], depth === 0 ? 0.2 : 0.36, depth === 0 ? 0.05 : 0.07, 0.45);
      if (depth === 0) { pts[0].r *= 1.7; pts[1].r *= 1.15; }
      tube(TB, pts, sides[depth], BAND.dead, bands, { tint, col: p => 0.7 + 0.3 * clamp(p.y / 1, 0, 1), sw, twist: depth === 0 ? 0.45 : 0.2, bump: depth < 2 ? 0.14 : 0, rnd: r, salt });
      const e = pts[pts.length - 1], ed = pts.dir;
      if (last) { twig(e, ed, r.range(0.85, 1.15)); return; }
      const kids = depth === 0 ? 3 : 2;
      for (let k = 0; k < kids; k++) {
        const side = (k % 2 ? 1 : -1) * (depth === 0 && k === 2 ? 0.25 : 1), sp = r.range(0.45, 1.0) * side, lift = r.range(-0.15, 0.5);
        const cs = Math.cos(sp), sn = Math.sin(sp);
        const d = new V3(ed.x * cs - ed.y * sn, ed.x * sn + ed.y * cs + lift * 0.3, ed.z * 0.6 + r.range(-0.4, 0.4));   // fan out in the screen plane so the silhouette reads
        if (d.y < 0.05) d.y = 0.05 + r() * 0.2;
        d.normalize();
        grow(e, d, len * r.range(0.56, 0.78), e.r * 0.92, depth + 1, salt * 3 + k + 1);
      }
      if (depth > 0 && depth < 3 && r() < 0.7) {                         // a side shoot from the middle
        const m = pts[Math.floor(pts.length / 2)], d = new V3(-ed.x + r.range(-0.4, 0.4), Math.abs(ed.y) * 0.6 + 0.4, r.range(-0.5, 0.5)).normalize();
        grow(m, d, len * 0.5, m.r * 0.6, 3, salt * 5 + 2);
      }
      if (depth === 2) twig(e, ed, r.range(0.8, 1.05));
    })(new V3(0, -0.4, 0), new V3(r.range(-0.25, 0.25), 1, r.range(-0.08, 0.08)), h * 0.42, R0, 0, 1);
    roots(TB, r, bands, BAND.dead, R0 * 1.3, 5, tint, h * 0.12);
    // a broken stub low on the trunk
    const sd = new V3(r.sign() * 0.9, 0.5, 0.2).normalize(), st = limb(r, new V3(0, h * 0.2, 0), sd, h * 0.14, R0 * 0.5, R0 * 0.22, 2, 0.2, 0, 0.4);
    tube(TB, st, 4, BAND.dead, bands, { tint, salt: 99 });
  }
  function cypress(c, it, r) {
    const TB = c.TB, FB = c.FB, SPR = c.SPR, h = it.h || 7.5, bands = c.bands, Rm = h * r.range(0.1, 0.122);
    const sw = p => 0.11 * Math.pow(clamp(p.y / h, 0, 1), 2.2);
    tube(TB, [{ x: 0, y: -0.3, z: 0, r: 0.2 }, { x: 0, y: h * 0.12, z: 0, r: 0.14 }, { x: 0, y: h * 0.45, z: 0, r: 0.06 }], 5, BAND.pine, bands, { sw, col: p => 0.6 + 0.3 * clamp(p.y, 0, 1) });
    const y0 = h * 0.06, span = h - y0, bendA = r.range(-0.12, 0.12);
    const prof = t => Rm * (0.2 * (1 - t) + Math.pow(Math.sin(Math.PI * Math.pow(clamp(t, 0, 1), 0.58)), 0.85));
    const ax = t => bendA * t * t * h * 0.25;
    const canC = new V3(0, y0 + span * 0.45, 0), nfAt = (t) => canopyNormal(new V3(ax(t), y0 + span * t, 0), new V3(1, 1.6, 1), canC, 0.3);
    const col = [1, 1, 1]; const tv = r.range(1.02, 1.18); col[0] = col[1] = col[2] = tv;
    // core spindle
    const ts = [0, 0.1, 0.3, 0.55, 0.8, 1], tile = SPR.tile.dark, tw = tile.u1 - tile.u0, th = tile.v1 - tile.v0, base = FB.nv, sd = 6;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i], rr = i === ts.length - 1 ? 0.03 : prof(t) * 0.72, nf = nfAt(t);
      for (let j = 0; j <= sd; j++) {
        const a = j / sd * 6.2832; _p.set(ax(t) + Math.cos(a) * rr, y0 + span * t, -Math.sin(a) * rr);
        FB.vert(_p, nf(_p), tile.u0 + clamp(0.5 + _p.x * TPU / 128, 0.02, 0.98) * tw, tile.v0 + ((t * span * CAM.z * TPU / 128) % 0.96 + 0.02) * th, col, 0.7 + 0.2 * t, sw(_p));
      }
    }
    for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < sd; j++) { const A0 = base + i * (sd + 1) + j, B0 = A0 + 1, C0 = A0 + sd + 2, D0 = A0 + sd + 1; FB.i.push(A0, B0, C0, A0, C0, D0); }
    // shell of upright flame cards
    const levels = Math.round(h * 1.5);
    for (let l = 0; l < levels; l++) {
      const t = 0.03 + 0.85 * l / (levels - 1), pr = prof(t), nf = nfAt(t);
      const azs = l % 2 ? [-0.95, 0.15, 1.05] : [-0.5, 0.6, 2.6 + l];
      for (let k = 0; k < azs.length; k++) {
        const az = azs[k] + r.range(-0.2, 0.2), back = Math.abs(az) > 2;
        const spr = (az < -0.2 && !back && r() < 0.85 ? SPR.cyp.lit : SPR.cyp.shade)[r.int(0, 1)];
        const s = clamp(pr / 0.62, 0.62, 1.12) * r.range(0.92, 1.08), w = spr.w / TPU * s, hh = spr.h / TPU * s;
        _p.set(ax(t) + Math.sin(az) * pr * 0.62, y0 + span * t, Math.cos(az) * pr * 0.62);
        _nc.set(Math.sin(az * 0.55), 0.22, Math.cos(az * 0.55)).normalize(); if (back) _nc.set(Math.sin(az), 0.1, Math.abs(Math.cos(az))).normalize();
        frame(_nc, r.range(-0.06, 0.06), _R, _U);
        const cm = 0.82 + 0.25 * t + r.range(-0.05, 0.05);
        FB.card(_p, _R, _U, w, hh, 0.3, spr, nf, col, cm * 0.88, cm, sw(_p), sw(_p) + 0.03, CAM, r() < 0.5);
      }
    }
    const spr = SPR.cyp.lit[r.int(0, 1)], nf = nfAt(0.95);                // the tip
    _p.set(ax(0.97), h - spr.h / TPU * 0.75, 0.05); _nc.set(0, 0.2, 1).normalize(); frame(_nc, 0, _R, _U);
    FB.card(_p, _R, _U, spr.w / TPU * 0.8, spr.h / TPU * 0.8, 0, spr, nf, col, 1, 1.1, sw(_p), sw(_p) + 0.05, CAM, false);
  }
  function pine(c, it, r) {
    const TB = c.TB, FB = c.FB, SPR = c.SPR, h = it.h || 12, bands = c.bands;
    const nT = clamp(Math.round(h * 0.5), 4, 7), sides = 6, y0 = h * r.range(0.12, 0.17), th = (h - y0) / nT, Rmax = h * r.range(0.16, 0.195) + 0.3;
    const sw = p => 0.16 * Math.pow(clamp(p.y / h, 0, 1), 2.2);
    tube(TB, [{ x: 0, y: -0.4, z: 0, r: h * 0.026 + 0.1 }, { x: 0, y: h * 0.25, z: 0, r: h * 0.02 + 0.05 }, { x: 0, y: h * 0.55, z: 0, r: 0.05 }], 5, BAND.pine, bands, { sw, col: p => 0.55 + 0.35 * clamp(p.y / 1.5, 0, 1) });
    const tv = r.range(0.86, 1.06), col = [tv * r.range(0.96, 1.04), tv, tv * r.range(0.96, 1.06)];
    const hemR = k => Rmax * Math.pow(1 - k / nT, 0.85) + 0.22;
    const ring = [], ringT = [], uvq = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < nT; k++) {
      const lastT = k === nT - 1, yh = y0 + th * k, yt = lastT ? h : yh + th * 1.4, Rh = hemR(k), Rt = lastT ? 0.02 : hemR(k + 1) * 0.5;
      const cx = r.range(-0.1, 0.1), cz = r.range(-0.1, 0.1), a0 = r() * 6.28, spr = SPR.pine[r.int(0, 1)];
      for (let j = 0; j < sides; j++) {
        const a = a0 + j / sides * 6.2832, rr = Rh * r.range(0.86, 1.14);
        ring[j] = new V3(cx + Math.cos(a) * rr, yh + r.range(-0.22, 0.1) * th, cz - Math.sin(a) * rr);
        ringT[j] = new V3(cx * 0.5 + Math.cos(a) * Rt, yt, cz * 0.5 - Math.sin(a) * Rt);
      }
      const nfk = function (p) { const up = clamp((p.y - yh) / (yt - yh), 0, 1), l = Math.hypot(p.x - cx, p.z - cz) || 1; return _n.set((p.x - cx) / l * (0.9 - 0.55 * up), 0.3 + 0.6 * up, (p.z - cz) / l * (0.9 - 0.55 * up)).normalize(); };
      const cmB = 0.8 + 0.28 * k / nT, pw = (spr.u1 - spr.u0) / spr.w, ph = (spr.v1 - spr.v0) / spr.h;
      for (let j = 0; j < sides; j++) {
        const A0 = ring[j], B0 = ring[(j + 1) % sides], C0 = ringT[(j + 1) % sides], D0 = ringT[j];
        const wb = Math.min(spr.w, A0.distanceTo(B0) * TPU), wt = Math.min(wb, D0.distanceTo(C0) * TPU);
        const sl = Math.min(spr.h - 1, _e1.copy(A0).add(B0).multiplyScalar(0.5).distanceTo(_e2.copy(D0).add(C0).multiplyScalar(0.5)) * TPU);
        const u0 = spr.u0 + r.range(0, spr.w - wb) * pw, um = u0 + wb * pw * 0.5;
        uvq[0] = u0; uvq[1] = spr.v0; uvq[2] = u0 + wb * pw; uvq[3] = spr.v0; uvq[4] = um + wt * pw * 0.5; uvq[5] = spr.v0 + sl * ph; uvq[6] = um - wt * pw * 0.5; uvq[7] = uvq[5];
        const fx = (A0.x + B0.x) * 0.5 - cx, fz = (A0.z + B0.z) * 0.5 - cz, fl = Math.hypot(fx, fz) || 1, rim = 1 + 0.42 * Math.max(0, -fx / fl) - 0.12 * Math.max(0, fx / fl);   // baked rim on the faces turned to the key
        FB.quad(A0, B0, C0, D0, uvq, nfk, col, cmB * rim, cmB * rim * 0.62, sw(A0) + 0.035, sw(D0), null);
      }
    }
  }
  const TREE = { pine, cypress, dead: deadTree, broadleaf: (c, it, r) => leafTree(c, it, r, false), autumn: (c, it, r) => leafTree(c, it, r, true) };

  // ------------------------------------------------------------------------------------------------ factory
  HD.Veg = {
    create: function () {
      const tex = buildSprites(), SPR = tex.SPR, GS = tex.GS;
      const uTime = { value: 0 };
      const folTex = mkTex(tex.at.canvas), grassTex = mkTex(tex.ga.canvas), barkTex = mkTex(tex.bark.canvas, true);
      const glowTex = tex.ga.glowCanvas ? mkTex(tex.ga.glowCanvas) : null;
      function patch(mat, o) {
        o = o || {};
        mat.onBeforeCompile = function (sh) {
          sh.uniforms.hdTime = uTime;
          let vs = WIND_GLSL + (o.uvRect ? 'attribute vec4 hdUv;\n' : '') + sh.vertexShader.replace('#include <project_vertex>', PROJECT_GLSL);
          if (o.cut && HD.M && HD.M.CUT) {
            const S = HD.M.shared; sh.uniforms.hdHero = S.hdHero; sh.uniforms.hdCut = S.hdCut; sh.uniforms.hdK = S.hdK;
            vs = 'varying vec3 hdWP;\n' + vs.replace('mvPosition = modelViewMatrix * mvPosition;', 'hdWP = ( modelMatrix * mvPosition ).xyz;\nmvPosition = modelViewMatrix * mvPosition;');
            sh.fragmentShader = 'varying vec3 hdWP;\n' + HD.M.CUT_DECL + '\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + HD.M.CUT);
          }
          if (o.uvRect) vs = vs.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\n\tvUv = hdUv.xy + vUv * hdUv.zw;\n#endif');
          sh.vertexShader = vs;
          if (o.soft) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_begin>', T.ShaderChunk.lights_fragment_begin.split('receiveShadow ) ? getShadow( directionalShadowMap[ i ]').join('receiveShadow ) ? ' + o.soft.toFixed(3) + ' + ' + (1 - o.soft).toFixed(3) + ' * getShadow( directionalShadowMap[ i ]'));
          if (o.noflip) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', 'float faceDirection = 1.0;\nvec3 normal = normalize( vNormal );\nvec3 geometryNormal = normal;');
        };
        mat.customProgramCacheKey = function () { return 'hdveg' + (o.cut ? 'C' : '') + (o.uvRect ? 'U' : '') + (o.noflip ? 'N' : '') + (o.soft || ''); };
        return mat;
      }
      const matBark = patch(new T.MeshPhongMaterial({ map: barkTex, specular: 0x000000, shininess: 0, vertexColors: true, flatShading: true }), { cut: true });
      const depBark = patch(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }));
      const matFol = patch(new T.MeshPhongMaterial({ map: folTex, specular: 0x000000, shininess: 0, vertexColors: true, alphaTest: 0.5, side: T.FrontSide, shadowSide: T.DoubleSide }), { noflip: true, soft: 0.4, cut: true });
      const depFol = patch(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: folTex, alphaTest: 0.5 }));
      const matGrass = patch(new T.MeshPhongMaterial({ map: grassTex, specular: 0x000000, shininess: 0, vertexColors: true, alphaTest: 0.45, side: T.DoubleSide }), { noflip: true, uvRect: true });
      const matMoon = patch(new T.MeshPhongMaterial({ map: grassTex, specular: 0x000000, shininess: 0, vertexColors: true, alphaTest: 0.45, side: T.DoubleSide, emissive: 0xffffff, emissiveMap: glowTex }), { noflip: true, uvRect: true });

      const V = { textures: { foliage: tex.at.canvas, grass: tex.ga.canvas, grassGlow: tex.ga.glowCanvas, bark: tex.bark.canvas }, materials: { bark: matBark, foliage: matFol, grass: matGrass, moonflower: matMoon }, sprites: SPR, wind: uTime };
      function folMesh(B, name) {
        const m = new T.Mesh(B.geometry(), matFol); m.customDepthMaterial = depFol; m.castShadow = true; m.receiveShadow = true; m.name = name; return m;
      }

      // optional spatial batching: opt.cell = size of a square grid cell in units; each cell becomes its own batch so the
      // renderer can frustum-cull it (more draw calls, fewer triangles). Without it, one batch for the whole list.
      function cells(list, opt, build, name) {
        const cell = opt && opt.cell;
        if (!cell) return build(list);
        const by = new Map();
        for (const it of list) { const k = Math.floor((it.x || 0) / cell) + ':' + Math.floor((it.z || 0) / cell); if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
        const grp = new T.Group(); grp.name = name;
        by.forEach(l => grp.add(build(l)));
        return grp;
      }

      // trees(list, opt): [{ x, y, z, h, kind, seed, lean }]; kind 'pine' | 'broadleaf' | 'autumn' | 'dead' | 'cypress'.
      // lean = radians of tilt towards +x (east), or [leanX, leanZ]. Returns a Group: one trunk mesh + one foliage mesh.
      V.trees = function (list, opt) {
        return cells(list, opt, function (list) {
          const grp = new T.Group(); grp.name = 'veg-trees';
          const c = { TB: new Builder(), FB: new Builder(), SPR, bands: tex.bark.bands };
          for (let i = 0; i < list.length; i++) {
            const it = list[i], fn = TREE[it.kind] || TREE.pine, r = HD.rng((it.seed == null ? i * 131 + 7 : it.seed) + 1);
            const h = it.h || { pine: 12, broadleaf: 8.5, autumn: 8.5, dead: 6, cypress: 7.5 }[it.kind] || 10;
            const lx = Array.isArray(it.lean) ? Math.tan(it.lean[0]) : Math.tan(it.lean || 0), lz = Array.isArray(it.lean) ? Math.tan(it.lean[1]) : 0;
            c.TB.origin(it.x || 0, it.y || 0, it.z || 0, lx, lz, h); c.FB.origin(it.x || 0, it.y || 0, it.z || 0, lx, lz, h);
            fn(c, Object.assign({}, it, { h }), r);
          }
          if (c.TB.nv) { const m = new T.Mesh(c.TB.geometry(), matBark); m.customDepthMaterial = depBark; m.castShadow = true; m.receiveShadow = true; m.name = 'veg-trunks'; grp.add(m); }
          if (c.FB.nv) grp.add(folMesh(c.FB, 'veg-foliage'));
          return grp;
        }, 'veg-trees');
      };

      // bushes(list): [{ x, y, z, r, seed, kind }]; kind 'shrub' | 'bramble' | 'fern'
      V.bushes = function (list, opt) { return cells(list, opt, bushBatch, 'veg-bushes'); };
      function bushBatch(list) {
        const B = new Builder(), R = new V3(), U = new V3(), nc = new V3(), p = new V3(), q = new V3();
        for (let i = 0; i < list.length; i++) {
          const it = list[i], r = HD.rng((it.seed == null ? i * 57 + 3 : it.seed) + 11), rad = it.r || 1, kind = it.kind || 'shrub';
          B.origin(it.x || 0, it.y || 0, it.z || 0, 0, 0, 1);
          const tv = r.range(0.9, 1.08), col = [tv, tv, tv];
          if (kind === 'shrub') {
            const n = 1 + (rad > 1.3 ? r.int(1, 2) : 0), canC = new V3(0, rad * 0.35, 0);
            for (let k = 0; k <= n; k++) {
              const br = k === 0 ? rad : rad * r.range(0.55, 0.75), a = r() * 6.28, d = k === 0 ? 0 : rad * 0.65;
              const C = new V3(Math.cos(a) * d, br * 0.5, Math.sin(a) * d * 0.7);
              blob(B, r, C, new V3(br, br * 0.78, br * 0.9), { canC, canR: rad * 0.8, set: SPR.shrub, n: Math.round(8 + br * br * 5), tile: SPR.tile.dark, col, sw: pp => 0.03 * clamp(pp.y / rad, 0, 1), size: clamp(br * 0.95, 0.7, 1.15), flutter: 0.03, sparse: 0.3, coreScale: 0.6 });
            }
          } else if (kind === 'bramble') {
            const n = Math.round(4 + rad * 3.5);
            for (let k = 0; k < n; k++) {
              const a = r() * 6.28, d = Math.sqrt(r()) * rad * 0.6, yaw = r.range(-0.9, 0.9), lean = r.range(-0.1, 0.4), spr = SPR.bramble[r.int(0, 2)];
              const s = clamp(rad * 0.85, 0.65, 1.2) * r.range(0.8, 1.15), w = spr.w / TPU * s, h = spr.h / TPU * s;
              nc.set(Math.sin(yaw) * Math.cos(lean), Math.sin(lean), Math.cos(yaw) * Math.cos(lean)); frame(nc, 0, R, U);
              p.set(Math.cos(a) * d, -0.03, Math.sin(a) * d * 0.8);
              const cx = p.x, cz = p.z, nf = pp => _n.set((pp.x - cx) * 0.5, 0.85, (pp.z - cz) * 0.5 + 0.15).normalize();
              B.card(p, R, U, w, h, 0, spr, nf, col, 0.82, 1.05, 0, 0.05, CAM, r() < 0.5);
            }
          } else {                                                       // fern: a rosette of arching fronds
            const n = r.int(8, 11), a0 = r() * 6.28;
            for (let k = 0; k < n; k++) {
              const a = a0 + (k + r.range(-0.25, 0.25)) / n * 6.2832, dx = Math.cos(a), dz = Math.sin(a), L = rad * r.range(0.8, 1.15), wd = L * 0.4, spr = SPR.fern[r.int(0, 1)];
              // width axis: horizontal, rolled a little towards the camera so side fronds show their faces
              const wx = -dz, wz = dx, roll = dx * 0.5, wy = Math.abs(roll) * 0.6;
              const pts = [[0.02, 0.05], [0.5, 0.62 + r.range(-0.08, 0.08)], [1, 0.38 + r.range(-0.2, 0.12)]];
              const um = (spr.u0 + spr.u1) / 2, cm = r.range(0.85, 1.1), nf = pp => _n.set(pp.x * 0.35, 1, pp.z * 0.35 + 0.1).normalize();
              for (let s = 0; s < 2; s++) {
                const p0 = pts[s], p1 = pts[s + 1], hw0 = wd * (s === 0 ? 0.3 : 0.5), hw1 = wd * (s === 0 ? 0.5 : 0.2);
                const a_ = new V3(dx * p0[0] * L - wx * hw0, p0[1] * L - wy * hw0 * Math.sign(roll || 1), dz * p0[0] * L - wz * hw0);
                const b_ = new V3(dx * p0[0] * L + wx * hw0, p0[1] * L + wy * hw0 * Math.sign(roll || 1), dz * p0[0] * L + wz * hw0);
                const c_ = new V3(dx * p1[0] * L + wx * hw1, p1[1] * L + wy * hw1 * Math.sign(roll || 1), dz * p1[0] * L + wz * hw1);
                const d_ = new V3(dx * p1[0] * L - wx * hw1, p1[1] * L - wy * hw1 * Math.sign(roll || 1), dz * p1[0] * L - wz * hw1);
                const ua = s === 0 ? spr.u0 : um, ub = s === 0 ? um : spr.u1;
                B.quad(a_, b_, c_, d_, [ua, spr.v0, ua, spr.v1, ub, spr.v1, ub, spr.v0], nf, col, cm * (s === 0 ? 0.75 : 0.95), cm * (s === 0 ? 0.95 : 1.08), s === 0 ? 0 : 0.03, s === 0 ? 0.03 : 0.08, CAM);
              }
            }
          }
        }
        return folMesh(B, 'veg-bushes');
      }

      // ivy(list): [{ x, y, z, nx, nz, w, h, seed, density, top }]. A patch on a vertical wall whose outward normal is
      // (nx, nz), centred at (x, y, z), about w x h. top (optional) = world y of the wall head: tendrils that reach it
      // creep over and lie on it, and nothing grows above it.
      V.ivy = function (list, opt) { return cells(list, opt, ivyBatch, 'veg-ivy'); };
      function ivyBatch(list) {
        const B = new Builder(), R = new V3(), U = new V3(), nc = new V3(), p = new V3(), face = new V3(), a_ = new V3(), b_ = new V3(), c_ = new V3(), d_ = new V3();
        for (let i = 0; i < list.length; i++) {
          const it = list[i], r = HD.rng((it.seed == null ? i * 91 + 5 : it.seed) + 23);
          const n = new V3(it.nx || 0, 0, it.nz == null ? 1 : it.nz).normalize(), t = new V3(n.z, 0, -n.x);
          const w = it.w || 4, h = it.h || 3, dens = it.density == null ? 1 : it.density, topY = it.top == null ? Infinity : it.top, ns = r.int(1, 9999);
          B.origin(0, 0, 0, 0, 0, 1);
          face.copy(n).addScaledVector(Y, 0.35).normalize();
          const P3 = (u, v, off, out) => out.set(it.x + t.x * u + n.x * off, it.y + v, it.z + t.z * u + n.z * off);
          const nfLeaf = () => _n;
          // height of the leafy body above the patch bottom at u: ragged, with rounded shoulders at both ends
          const prof = u => h * clamp(0.3 + 0.9 * HD.fbm(u * 0.42 + 3.1, 0.5, ns, 2) + 0.7 * Math.max(0, HD.vnoise(u * 1.3, 7.7, ns) - 0.45) + 0.25 * (HD.vnoise(u * 2.6, 1.7, ns) - 0.5), 0.15, 1.02) * (1 - 0.8 * Math.pow(Math.abs(u) / (w / 2), 3));
          // kind: 0 mass, 1 cluster, 2 single leaf, 3 leaf lying on the wall head (v = distance in from the edge)
          const leaf = (u, v, vn, kind) => {
            const big = kind === 0, flat = kind === 3;
            const spr = big ? SPR.ivy.mass[r.int(0, 1)] : kind === 1 ? SPR.ivy.cluster[r.int(0, 3)] : SPR.ivy.leaf[r.int(0, 5)];
            const s = r.range(0.88, 1.15), sz = spr.w / TPU * s, tilt = big ? r.range(0.04, 0.14) : r.range(0.15, 0.75), yaw = r.range(-0.5, 0.5), roll = r.range(-0.6, 0.6);
            // hinged near the wall at the top edge; the tip hangs down and out, so the leaf faces up and outward
            const cy = Math.cos(yaw), sy = Math.sin(yaw);
            R.copy(t).multiplyScalar(cy).addScaledVector(n, sy);
            if (flat) { U.copy(n).multiplyScalar(-1); nc.copy(Y); } else { U.copy(Y).multiplyScalar(Math.cos(tilt)).addScaledVector(n, -Math.sin(tilt)).addScaledVector(t, sy * 0.2).normalize(); nc.crossVectors(R, U).normalize(); R.crossVectors(U, nc).normalize(); }
            const cr = Math.cos(roll), sr = Math.sin(roll); _e1.copy(R).multiplyScalar(cr).addScaledVector(U, sr); U.multiplyScalar(cr).addScaledVector(R, -sr); R.copy(_e1);
            const lift = big ? 0.04 : 0.05 + r() * 0.09;
            if (flat) p.set(it.x + t.x * u - n.x * v, topY + 0.03 + r() * 0.03, it.z + t.z * u - n.z * v);
            else P3(u, v, lift + Math.sin(tilt) * sz * 0.5, p);
            _n.copy(nc).multiplyScalar(0.45).addScaledVector(n, 0.3).addScaledVector(Y, 0.55); _n.x += r.range(-0.25, 0.25); _n.z += r.range(-0.25, 0.25); _n.normalize();
            const cm = (0.8 + 0.25 * vn + lift * 1.6) * r.range(0.86, 1.1) * (big ? 0.82 : 1), cl = [cm, cm, cm];
            B.card(p, R, U, sz, sz, 0.5, spr, nfLeaf, cl, 0.88, 1.06, flat ? 0 : 0.02, 0, flat ? Y : face, r() < 0.5);
          };
          // the body: a jittered grid under the ragged profile, denser low down, thinning to single leaves at the edge
          const du = 0.27, dv = 0.22;
          for (let v0 = 0; v0 < h; v0 += dv) for (let u0 = -w / 2; u0 < w / 2; u0 += du) {
            const u = u0 + r.range(0, du), vv = v0 + r.range(0, dv), rel = (prof(u) - vv) / h, q = r(), q2 = r();
            if (rel < 0 || it.y - h / 2 + vv > topY - 0.12) continue;
            if (q > dens * (0.45 + 0.55 * Math.min(1, rel * 5)) * (1.08 - 0.4 * vv / h)) continue;
            leaf(u, vv - h / 2, vv / h, rel < 0.05 ? 2 : (q2 < 0.22 && rel > 0.16 && vv / h < 0.55) ? 0 : q2 < 0.78 ? 1 : 2);
          }
          // tendrils: stems that climb out of the body, leaves alternating along them
          const walk = (u, v, ang, vTop, depth) => {
            const step = 0.2; let guard = 0, sv = r(), side = r.sign();
            while (v < vTop && guard++ < 120) {
              ang = clamp(ang * 0.86 + r.range(-0.45, 0.45), -1.3, 1.3);
              let u2 = u + Math.sin(ang) * step; const v2 = v + Math.cos(ang) * step;
              if (Math.abs(u2) > w / 2) { ang = -ang; u2 = u; }
              const vn = clamp((v + h / 2) / h, 0, 1.2);
              const sx = Math.cos(ang) * 0.055, sy2 = -Math.sin(ang) * 0.055, sp = SPR.ivy.stem[depth % 2], vs0 = sp.v0 + (sp.v1 - sp.v0) * (sv % 1) * 0.74, vs1 = vs0 + (sp.v1 - sp.v0) * 0.2;
              P3(u - sx, v - sy2, 0.025, a_); P3(u + sx, v + sy2, 0.025, b_); P3(u2 + sx, v2 + sy2, 0.025, c_); P3(u2 - sx, v2 - sy2, 0.025, d_);
              _n.copy(n).multiplyScalar(0.7).addScaledVector(Y, 0.6).normalize();
              B.quad(a_, b_, c_, d_, [sp.u0, vs0, sp.u1, vs0, sp.u1, vs1, sp.u0, vs1], nfLeaf, [0.95, 0.95, 0.95], 1, 1, 0, 0, face);
              sv += 0.27;
              if (r() < 0.8 * Math.min(1, dens + 0.3)) { side = -side; leaf(u + Math.cos(ang) * side * 0.13, v + r.range(-0.05, 0.05) - Math.sin(ang) * side * 0.13, vn, r() < 0.2 ? 1 : 2); }
              if (depth < 2 && r() < 0.07) walk(u, v, ang + r.sign() * r.range(0.6, 1.2), v + (vTop - v) * r.range(0.3, 0.8), depth + 1);
              u = u2; v = v2;
              if (it.y + v > topY - 0.1) {                               // over the top: a few leaves lying on the wall head
                const creep = r.range(0.15, 0.55); for (let k = 0; k < 3; k++) leaf(u + r.range(-0.3, 0.3), r.range(0.04, creep), 1, 3);
                break;
              }
            }
          };
          const tend = Math.max(2, Math.round(w * 1.4 * dens));
          for (let s = 0; s < tend; s++) {
            const u = ((s + r.range(0.1, 0.9)) / tend - 0.5) * w * 0.94, top = prof(u);
            walk(u, -h / 2 + Math.max(0, top - 0.35), r.range(-0.5, 0.5), Math.min(h * 1.08, top + r.range(0.35, 1.2) * (r() < 0.35 ? 2 : 1)) - h / 2, 0);
          }
        }
        return folMesh(B, 'veg-ivy');
      }

      // ---------------------------------------------------------------------------------------------- instanced cards
      const GRASS = {
        tuft: { amp: 0.11, rows: 1, cards: [[0, 0, 0, 0.3, 0], [-0.3, -0.16, 0.5, 0.42, 1], [0.3, 0.13, -0.55, 0.18, 0]] },
        tall: { amp: 0.17, rows: 1, cards: [[0, 0, 0, 0.16, 0], [-0.22, -0.14, 0.45, 0.28, 1], [0.24, 0.12, -0.5, 0.1, 0]] },
        weed: { amp: 0.04, rows: 1, cards: [[0, 0, 0, 0.5, 0], [-0.16, -0.2, 0.6, 0.75, 1], [0.18, 0.16, -0.6, 0.3, 0]] },
        moonflower: { amp: 0.11, rows: 1, cards: [[0, 0, 0, 0.12, 0], [-0.2, -0.16, 0.4, 0.2, 1], [0.22, 0.14, -0.45, 0.06, 0]] },
        reed: { amp: 0.1, rows: 3, cards: [[0, 0, 0, 0.06, 0], [-0.16, -0.12, 0.45, 0.12, 1], [0.18, 0.1, -0.5, 0.02, 0]] },
      };
      const baseGeo = {};
      function grassBase(kind) {
        if (baseGeo[kind]) return baseGeo[kind];
        const def = GRASS[kind], spr = GS[kind][0], w = spr.w / TPU, h = spr.h / TPU, pos = [], nor = [], uv = [], col = [], sw = [], idx = [];
        for (const cd of def.cards) {
          const cs = Math.cos(cd[2]), sn = Math.sin(cd[2]), base = pos.length / 3;
          for (let j = 0; j <= def.rows; j++) for (let i = 0; i < 2; i++) {
            const t = j / def.rows, lx = (i - 0.5) * w, ly = Math.cos(cd[3]) * h * t, lz = -Math.sin(cd[3]) * h * t - t * t * 0.08 * h;
            pos.push(cd[0] * w + lx * cs + lz * sn, ly, cd[1] - lx * sn + lz * cs);
            nor.push(lx * 0.25, 1, 0.2); uv.push(cd[4] ? 1 - i : i, t); const cm = 0.8 + 0.25 * t; col.push(cm, cm, cm);
            sw.push(def.amp * Math.pow(t, 1.6) * h);
          }
          for (let j = 0; j < def.rows; j++) { const a = base + j * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
        }
        return (baseGeo[kind] = { pos: new T.Float32BufferAttribute(pos, 3), nor: new T.Float32BufferAttribute(nor, 3), uv: new T.Float32BufferAttribute(uv, 2), col: new T.Float32BufferAttribute(col, 3), sw: new T.Float32BufferAttribute(sw, 1), idx: new T.Uint16BufferAttribute(idx, 1), r: Math.max(w, h) });
      }
      function leafBase() {
        if (baseGeo.leaf) return baseGeo.leaf;
        const s = 0.14;
        return (baseGeo.leaf = { pos: new T.Float32BufferAttribute([-s, 0, s, s, 0, s, s, 0, -s, -s, 0, -s], 3), nor: new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3), uv: new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2), col: new T.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 3), sw: new T.Float32BufferAttribute([0, 0, 0, 0], 1), idx: new T.Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1), r: 0.3 });
      }
      const _mat = new T.Matrix4(), _quat = new T.Quaternion(), _eul = new T.Euler(), _scl = new V3(), _pos = new V3(), _colr = new T.Color();
      function instanced(base, mat, items, name, fill) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', base.pos); g.setAttribute('normal', base.nor); g.setAttribute('uv', base.uv); g.setAttribute('color', base.col); g.setAttribute('hdSway', base.sw); g.setIndex(base.idx);
        const n = items.length, rects = new Float32Array(n * 4), m = new T.InstancedMesh(g, mat, n), box = new T.Box3();
        for (let i = 0; i < n; i++) {
          const it = items[i], spr = fill(it, i, _mat, _colr);
          m.setMatrixAt(i, _mat); m.setColorAt(i, _colr);
          rects[i * 4] = spr.u0; rects[i * 4 + 1] = spr.v0; rects[i * 4 + 2] = spr.u1 - spr.u0; rects[i * 4 + 3] = spr.v1 - spr.v0;
          box.expandByPoint(_pos.set(it.x || 0, it.y || 0, it.z || 0));
        }
        g.setAttribute('hdUv', new T.InstancedBufferAttribute(rects, 4));
        g.boundingSphere = new T.Sphere(); box.getBoundingSphere(g.boundingSphere); g.boundingSphere.radius += base.r * 3 + 1;
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.castShadow = false; m.receiveShadow = true; m.name = name;
        return m;
      }

      // grass(list, opt): [{ x, y, z, s, kind, seed }]; kind 'tuft' | 'tall' | 'weed' | 'moonflower' | 'reed'. One InstancedMesh
      // per kind (per cell, if opt.cell is given).
      V.grass = function (list, opt) { return cells(list, opt, grassBatch, 'veg-grass'); };
      function grassBatch(list) {
        const grp = new T.Group(); grp.name = 'veg-grass';
        const by = {};
        for (let i = 0; i < list.length; i++) { const k = GRASS[list[i].kind] ? list[i].kind : 'tuft'; (by[k] || (by[k] = [])).push(list[i]); }
        for (const kind in by) {
          const sprs = GS[kind];
          grp.add(instanced(grassBase(kind), kind === 'moonflower' && glowTex ? matMoon : matGrass, by[kind], 'veg-grass-' + kind, function (it, i, mat, colr) {
            const r = HD.rng((it.seed == null ? HD.hash2(Math.round((it.x || 0) * 64), Math.round((it.z || 0) * 64), i) * 1e6 : it.seed) + 3);
            const s = (it.s || 1) * r.range(0.85, 1.15), mir = r() < 0.5 ? -1 : 1;
            _quat.setFromEuler(_eul.set(0, r.range(-0.4, 0.4), 0));
            mat.compose(_pos.set(it.x || 0, (it.y || 0) - 0.02, it.z || 0), _quat, _scl.set(s * mir, s * r.range(0.88, 1.12), s));
            const v = r.range(0.84, 1.1), hs = r.range(-0.06, 0.06);
            colr.setRGB(v * (1 + hs), v, v * (1 - hs * 0.6));
            return sprs[r.int(0, sprs.length - 1)];
          }));
        }
        return grp;
      }

      // leaves(list): [{ x, y, z, seed, kind }]; kind 'autumn' | 'dry'. Flat on the ground or on water; one InstancedMesh.
      V.leaves = function (list, opt) { return cells(list, opt, leafBatch, 'veg-leaves'); };
      function leafBatch(list) {
        return instanced(leafBase(), matGrass, list, 'veg-leaves', function (it, i, mat, colr) {
          const r = HD.rng((it.seed == null ? HD.hash2(Math.round((it.x || 0) * 64), Math.round((it.z || 0) * 64), i) * 1e6 : it.seed) + 5);
          const s = (it.s || 1) * r.range(0.9, 1.35);
          _quat.setFromEuler(_eul.set(r.range(-0.12, 0.12), r.range(0, 6.2832), r.range(-0.12, 0.12)));
          mat.compose(_pos.set(it.x || 0, (it.y || 0) + 0.03 + r() * 0.02, it.z || 0), _quat, _scl.set(s, s, s));
          const v = r.range(0.85, 1.1); colr.setRGB(v, v, v);
          const sprs = it.kind === 'dry' ? GS.dry : GS.autumn;
          return sprs[r.int(0, sprs.length - 1)];
        });
      }

      V.update = function (time) { uTime.value = time; };
      return V;
    },
  };
})();
