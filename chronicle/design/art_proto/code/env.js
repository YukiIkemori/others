// Environment + atmosphere, all canvas code: parallax layers, trees/rocks/grass built with the same
// 2.5D sprite rasterizer, light glows, soft shadows, light shafts, bloom, tilt-shift depth-of-field,
// colour grading and vignette.
'use strict';
(function (G) {
  const { Builder, render, mat, hex, mix, clamp, rng, vnoise } = G.RZ;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  const EM = {
    leaf: mat({ keys: ['#0a1c14', '#123a20', '#1e5a28', '#3a7e2c', '#6aa436', '#b0d060'], n: 7, tex: 3, tsx: 0.55, tsy: 0.55, wrap: 0.3, amb: 0.12, rim: '#fff0b0', rimK: 0.5 }),
    pine: mat({ keys: ['#06140e', '#0c2a1c', '#164428', '#246034', '#3e7c3c', '#78a450'], n: 7, tex: 2.4, tsx: 0.9, tsy: 0.35, wrap: 0.2, amb: 0.12, rim: '#f0f0b0', rimK: 0.4 }),
    bark: mat({ keys: ['#120a08', '#2a1a12', '#4a3020', '#6c4c32', '#907050'], n: 6, tex: 2, tsx: 0.2, tsy: 1.4 }),
    grass: mat({ keys: ['#0e2410', '#1c4418', '#2e6a1e', '#4a8e26', '#7cb434', '#c0e060'], n: 7, wrap: 0.4, amb: 0.3, rim: '#fff8c0', rimK: 0.7, outline: '#0c2410' }),
    stone: mat({ keys: ['#161a22', '#2c323e', '#4c5460', '#747c84', '#a4aaa8', '#d8d8cc'], n: 7, tex: 2.2, tsx: 0.5, tsy: 0.5, wrap: 0.2, amb: 0.1 }),
    moss: mat({ keys: ['#142410', '#2a4a18', '#4a7424', '#7ca03a', '#b4cc5c'], n: 6, tex: 2.5, tsx: 0.8, tsy: 0.8 }),
    cloud: mat({ keys: ['#8a98c4', '#b0bcdc', '#d4dcee', '#f2f4fa', '#ffffff'], n: 6, wrap: 0.7, amb: 0.4, rim: '#fff4dc', rimK: 0.9, ao: 0 }),
    petalW: mat({ keys: ['#b0b4c8', '#ffffff'], n: 2, flat: true, noOutline: true }),
    petalY: mat({ keys: ['#c08010', '#ffe060'], n: 2, flat: true, noOutline: true }),
    petalP: mat({ keys: ['#c04868', '#ff9ab8'], n: 2, flat: true, noOutline: true }),
    petalB: mat({ keys: ['#3050b0', '#80b0ff'], n: 2, flat: true, noOutline: true }),
  };

  function blit(ctx, r, x, y, k) { ctx.drawImage(r.canvas, Math.round(x - r.ox * k), Math.round(y - r.oy * k), r.canvas.width * k, r.canvas.height * k); }

  // ---------- builders for scenery ----------
  function conifer(B, x, y, h, R, zb) {
    const tr = B.group();
    B.cap(x, y, x, y - h * 0.3, h * 0.05, h * 0.04, EM.bark, zb, { g: tr });
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const t0 = y - h * (0.18 + i * 0.16), w = h * (0.36 - i * 0.058) * (0.9 + R() * 0.2), th = h * 0.3;
      const pts = [[x - w, t0], [x - w * 0.55, t0 - th * 0.35], [x, t0 - th], [x + w * 0.55, t0 - th * 0.35], [x + w, t0], [x + w * 0.4, t0 - th * 0.08], [x, t0 + th * 0.06], [x - w * 0.45, t0 - th * 0.06]];
      B.poly(pts, EM.pine, zb + 0.1 + i * 0.01, { bevel: w * 0.7, ny: -0.25 });
    }
  }
  function roundTree(B, x, y, h, R, zb, m) {
    const tr = B.group();
    B.cap(x, y, x - h * 0.03, y - h * 0.55, h * 0.07, h * 0.045, EM.bark, zb, { g: tr });
    B.cap(x - h * 0.02, y - h * 0.4, x - h * 0.18, y - h * 0.6, h * 0.03, h * 0.02, EM.bark, zb, { g: tr });
    const n = 9 + Math.floor(R() * 5), cx = x, cy = y - h * 0.68;
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * h * 0.26;
      const r = h * (0.13 + R() * 0.08);
      const px = cx + Math.cos(a) * rr * 1.25, py = cy + Math.sin(a) * rr * 0.9;
      B.ell(px, py, r, r * 0.9, m || EM.leaf, zb + 0.2 + (py - cy + h) * 0.001 + (i * 0.0001), { bulge: 0.85 });
    }
  }
  function rock(B, x, y, s, R, zb, mossy) {
    const g = B.group();
    B.ell(x, y - s * 0.45, s, s * 0.62, EM.stone, zb, { g, bulge: 0.8 });
    B.ell(x + s * 0.55, y - s * 0.3, s * 0.6, s * 0.45, EM.stone, zb + 0.01, { g: B.group(), bulge: 0.8 });
    if (mossy) B.ell(x - s * 0.1, y - s * 0.85, s * 0.7, s * 0.25, EM.moss, zb + 0.02, { bulge: 0.6 });
  }
  function tuft(B, x, y, s, R, zb) {
    const n = 4 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.4 + (R() - 0.5) * 0.3, L = s * (0.6 + R() * 0.6);
      B.strand([[x + (i - n / 2) * s * 0.12, y], [x + Math.sin(a) * L * 0.4, y - L * 0.6], [x + Math.sin(a) * L, y - L * Math.cos(a) * 0.95]], s * 0.14, s * 0.02, EM.grass, zb + i * 0.001, { seg: 3, shadeOff: (R() - 0.3) * 2 });
    }
  }
  function flower(B, x, y, m, zb) {
    B.strand([[x, y], [x + 0.5, y - 2], [x, y - 4]], 0.45, 0.35, EM.grass, zb);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; B.ell(x + Math.cos(a) * 1.2, y - 4.5 + Math.sin(a) * 0.9, 1.1, 0.8, m, zb + 0.01); }
    B.rect(x - 0.5, y - 5, 1, 1, EM.petalY, zb + 0.02);
  }
  function cloud(B, x, y, w, R) {
    const n = Math.floor(w / 6);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), px = x + (t - 0.5) * w, bump = Math.sin(t * Math.PI);
      const r = w * (0.08 + bump * 0.1) * (0.8 + R() * 0.5);
      B.ell(px, y - bump * w * 0.08 - r * 0.3, r * 1.2, r, EM.cloud, 1 + R() * 0.2, { bulge: 0.8 });
    }
    B.ell(x, y + 1, w * 0.52, w * 0.07, EM.cloud, 0.9, { bulge: 0.5 });
  }

  // ---------- mountains: peaks with a sunlit (left) face and a shadow face, erosion gullies, snow caps ----------
  function ridge(ctx, W, H, o) {
    const img = ctx.getImageData(0, 0, W, H), D = img.data, R = rng(o.seed);
    const lit = o.ramp.map(hex), snow = o.snow ? o.snow.map(hex) : null, haze = hex(o.haze);
    const peaks = [];
    for (let i = 0; i < o.count; i++) peaks.push({ x: (i + 0.2 + R() * 0.6) / o.count * (W + 80) - 40, top: o.base - o.amp * (0.45 + R() * 0.55), s: 0.45 + R() * 0.5, s2: 0.45 + R() * 0.5 });
    for (let x = 0; x < W; x++) {
      // topmost surface = min over peaks
      for (let y = 0; y < Math.min(H, o.bottom); y++) {
        let best = null, bt = 1e9;
        for (const p of peaks) {
          const dx = x - p.x, sl = dx < 0 ? p.s : p.s2;
          const ty = p.top + Math.abs(dx) * sl + (vnoise(x * 0.08, p.x, o.seed) - 0.5) * 5 + (vnoise(x * 0.3, p.x, o.seed + 1) - 0.5) * 1.6;
          if (y >= ty && ty < bt) { bt = ty; best = p; }
        }
        if (!best) continue;
        const dx = x - best.x, dep = y - bt, fromTop = y - best.top;
        // spine wanders as it descends
        const spine = best.x + (vnoise(y * 0.06, best.x, o.seed + 2) - 0.5) * fromTop * 0.9;
        let l = x < spine ? 0.72 : 0.3;
        // gullies radiating from the peak
        const ang = Math.atan2(x - best.x, fromTop + 6);
        const gul = vnoise(ang * 9, fromTop * 0.05, o.seed + 4);
        l += (gul - 0.5) * 0.45 + (vnoise(x * 0.15, y * 0.15, o.seed + 5) - 0.5) * 0.15 - Math.min(0.2, dep * 0.004);
        if (dep < 1.2) l += x < spine ? 0.15 : 0.05; // bright ridge edge
        let c;
        const sd = o.snowDepth * best.s * 1.6 * (0.7 + vnoise(ang * 7, 0, o.seed + 6) * 0.6);
        if (snow && fromTop < sd && (fromTop < sd * 0.6 || gul > 0.45)) c = snow[clamp(Math.round(l * (snow.length - 1)), 0, snow.length - 1)];
        else c = lit[clamp(Math.round(l * (lit.length - 1)), 0, lit.length - 1)];
        const hz = clamp(o.hazeK + (y - (o.base - o.amp)) / (o.bottom - o.base + o.amp) * o.hazeBottom, 0, 1);
        c = mix(c, haze, hz);
        const q = (y * W + x) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; D[q + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- light helpers (full-res, drawn on the 1024 canvas) ----------
  function glow(ctx, x, y, r, c, a, mode) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(0.25, rgba(c, a * 0.45)); g.addColorStop(1, rgba(c, 0));
    ctx.save(); ctx.globalCompositeOperation = mode || 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function shadow(ctx, x, y, rx, ry, a, c) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    const col = c || [10, 20, 30];
    g.addColorStop(0, rgba(col, a)); g.addColorStop(0.55, rgba(col, a * 0.7)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function rays(ctx, x0, y0, list, c) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [ang, w, len, a] of list) {
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
      const g = ctx.createLinearGradient(x0, y0, x0 + dx * len, y0 + dy * len);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(0.6, rgba(c, a * 0.4)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(x0 + nx * w * 0.2, y0 + ny * w * 0.2); ctx.lineTo(x0 - nx * w * 0.2, y0 - ny * w * 0.2);
      ctx.lineTo(x0 + dx * len - nx * w, y0 + dy * len - ny * w); ctx.lineTo(x0 + dx * len + nx * w, y0 + dy * len + ny * w); ctx.fill();
    }
    ctx.restore();
  }
  function motes(ctx, n, box, c, seed) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = box[0] + R() * box[2], y = box[1] + R() * box[3], r = 1.5 + R() * 3.5;
      glow(ctx, x, y, r * 3, c, 0.35 + R() * 0.4);
      ctx.fillStyle = rgba([255, 255, 240], 0.7); ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // ---------- post-processing on the full-res canvas ----------
  function post(ctx, o) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    o = Object.assign({ bloom: 0.55, thr: 0.62, dofTop: [0, 140], dofBot: [520, 610], dofPx: 4, grade: {}, vig: 0.55, region: [0, 0, W, H] }, o);
    const [rx, ry, rw, rh] = o.region;
    const src = mk(W, H); src.getContext('2d').drawImage(ctx.canvas, 0, 0);
    // tilt-shift depth of field
    if (o.dofPx) {
      const bl = mk(W, H), bx = bl.getContext('2d');
      bx.filter = `blur(${o.dofPx}px)`; bx.drawImage(src, 0, 0); bx.filter = 'none';
      const m = mk(W, H), mx = m.getContext('2d');
      mx.drawImage(bl, 0, 0);
      const g = mx.createLinearGradient(0, 0, 0, H);
      const s = (y) => clamp(y / H, 0, 1);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(s(o.dofTop[0]), 'rgba(0,0,0,1)'); g.addColorStop(s(o.dofTop[1]), 'rgba(0,0,0,0)');
      g.addColorStop(s(o.dofBot[0]), 'rgba(0,0,0,0)'); g.addColorStop(s(o.dofBot[1]), 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      mx.globalCompositeOperation = 'destination-in'; mx.fillStyle = g; mx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip(); ctx.drawImage(m, 0, 0); ctx.restore();
    }
    // bloom: threshold at 1/4 res, blur at two radii, screen it back
    if (o.bloom) {
      const q = mk(W / 4, H / 4), qx = q.getContext('2d');
      qx.drawImage(ctx.canvas, 0, 0, W / 4, H / 4);
      const id = qx.getImageData(0, 0, W / 4, H / 4), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, k = clamp((l - o.thr) / (1 - o.thr), 0, 1);
        d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
      }
      qx.putImageData(id, 0, 0);
      const b1 = mk(W / 4, H / 4), b1x = b1.getContext('2d');
      b1x.filter = 'blur(3px)'; b1x.drawImage(q, 0, 0); b1x.filter = 'blur(10px)'; b1x.globalCompositeOperation = 'lighter'; b1x.drawImage(q, 0, 0);
      ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = o.bloom; ctx.imageSmoothingEnabled = true; ctx.drawImage(b1, 0, 0, W, H); ctx.restore();
    }
    // colour grade: split toning (cool shadows / warm highlights), gentle S-curve, saturation
    const gr = Object.assign({ sh: [-6, 4, 16], hi: [14, 6, -8], sat: 1.12, con: 1.08, lift: 0 }, o.grade);
    const id = ctx.getImageData(rx, ry, rw, rh), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      r = l + (r - l) * gr.sat; g = l + (g - l) * gr.sat; b = l + (b - l) * gr.sat;
      const s = (v) => clamp(0.5 + (v - 0.5) * gr.con, 0, 1);
      r = s(r); g = s(g); b = s(b);
      const ws = (1 - l) ** 2, wh = l * l;
      d[i] = clamp(r * 255 + gr.sh[0] * ws + gr.hi[0] * wh + gr.lift, 0, 255);
      d[i + 1] = clamp(g * 255 + gr.sh[1] * ws + gr.hi[1] * wh + gr.lift, 0, 255);
      d[i + 2] = clamp(b * 255 + gr.sh[2] * ws + gr.hi[2] * wh + gr.lift, 0, 255);
    }
    ctx.putImageData(id, rx, ry);
    // vignette
    if (o.vig) {
      const cx = rx + rw / 2, cy = ry + rh / 2;
      const g = ctx.createRadialGradient(cx, cy, Math.min(rw, rh) * 0.35, cx, cy, Math.hypot(rw, rh) * 0.58);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(4,6,16,${o.vig})`);
      ctx.save(); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh); ctx.restore();
    }
  }

  G.ENV = { EM, blit, conifer, roundTree, rock, tuft, flower, cloud, ridge, glow, shadow, rays, motes, post, mk, rgba };
})(window);
