// BEAST: 戦闘背景の道具（hd:bbg:<id>、V2_PLAN §2.11「戦闘背景」、MODERN_UI §2.1・§2.3・§4.1、試作 ui/art_battle.js の方式を夜にした物）
//
// hd:bbg:<id> は opts {w, h}（今の R.W・R.H）で焼き、K.bbgSheet を返す:
//   frames: 画面と同じ大きさの層（ox = oy = 0。R.Hd.draw(g, f, 0, 0)）
//   poses:  back（空と遠景。夜の色で焼き済み・光を掛けない）/ ground（地面。昼の色・環境光を掛ける）/
//           front（手前のぼけた岩や草。昼の色・環境光を掛ける）/ post（光る物のにじみ。加算 'lighter' で重ねる）
//   meta:   {mood（MOODS）, lantern:{x, y}（光だまりの中心・ランタンの足元）, horizon（地平の y）, lightTop（環境光を掛け始める y）,
//            feather, postMode:'lighter', layout, ambient（R.Hd.mood が無いときの控えの色）, foes:{x0, x1, y0, y1}（敵を置く所）, party:[[x, y]×4]}
// 描く順（BSCENE。R.Beast.stage が見本）: back → [層: ground → 影と人と敵（y の順）→ front → 層にだけ光（R.Light.map を層の不透明な所で切り抜いて multiply）] → post（lighter）→ R.Post.frame
// （空と遠景は夜の色で焼き済みなので光を掛けない。層ごと掛けるので、地平より上に出た大きいボスも光が途切れない。meta.light = 'layer'）
// 画素を作るのは焼くときだけ（毎フレームは置くだけ）。ctx.filter は使わない（ぼかしは縮小と拡大）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const PI = Math.PI;

  const mk = (w, h) => BZ.mkCanvas(Math.ceil(w), Math.ceil(h));
  K.mk = mk;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  K.rgba = rgba;

  /** 縮めて拡げるぼかし（ctx.filter を使わない。r ≈ ぼかしの半径 px） */
  K.soften = function (src, r) { return BZ.runSync(() => K.softenG(src, r)); };
  /** soften の切れ端版（縮めた後に一度止まれる）。bake の中は yield* K.softenG */
  K.softenG = function* (src, r) {
    if (r <= 0.5) return src;
    const f = Math.max(1.5, r * 0.9);
    const w = Math.max(1, Math.round(src.width / f)), h = Math.max(1, Math.round(src.height / f));
    const a = mk(w, h), ax = a.getContext('2d');
    ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = 'high';
    ax.drawImage(src, 0, 0, w, h);
    yield* K.tick();
    const b = mk(src.width, src.height), bx = b.getContext('2d');
    bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
    bx.drawImage(a, 0, 0, src.width, src.height);
    return b;
  };
  /** 純粋な黒を出さない（半透明のふちの (0,0,0) も。R.Hd.STYLE.noBlack の色へ） */
  K.noBlack = function (c) {
    const NB = BZ.color.hex(((R.Hd && R.Hd.STYLE) || {}).noBlack || '#070812');
    const x = c.getContext('2d'), id = x.getImageData(0, 0, c.width, c.height), d = id.data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] < 3 && d[i + 1] < 3 && d[i + 2] < 3) { if (d[i + 3] < 64) d[i + 3] = 0; else { d[i] = NB[0]; d[i + 1] = NB[1]; d[i + 2] = NB[2]; } n++; }
    if (n) x.putImageData(id, 0, 0);
    return n;
  };
  K.glow = function (ctx, x, y, r, c, a, mode) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(0.25, rgba(c, a * 0.45)); g.addColorStop(1, rgba(c, 0));
    ctx.save(); ctx.globalCompositeOperation = mode || 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  };
  K.blit = function (ctx, r, x, y) { ctx.drawImage(r.canvas, Math.round(x - r.ox), Math.round(y - r.oy)); };

  /** 舞台の形（論理 px）。tall は上の 55% が戦場（MODERN_UI §2.3 の縦持ち） */
  K.geo = function (W, H, o) {
    o = o || {};
    const tall = W / H < 1.2;
    const field = tall ? H * 0.55 : H;
    const s = field / 448;
    const GT = Math.round((o.gt || 196) * s);
    return { W, H, s, tall, field, cx: W / 2 + (o.cxOff || 0) * s, GT, HZV: -130 * s, Z0: 600 * s, UD: 260 * s, clearRx: o.clearRx || (tall ? 9 : 16), clearU: o.clearU || 0 };
  };
  K.yToZ = (g, y) => g.Z0 / (y - g.HZV);
  K.scaleAt = (g, y) => (y - g.HZV) / (310 * g.s - g.HZV);
  /** 配置（MODERN_UI §2.3。16:9 は 960×540 の値、縦は戦場の幅に合わせる） */
  K.layoutFor = function (g) {
    if (!g.tall) {
      const ox = (g.W - 960) / 2;
      return { lantern: { x: Math.round(505 + ox), y: Math.round(g.GT + 150 * g.s / 1.205) }, party: [[575, 338], [668, 361], [616, 395], [726, 425]].map(([x, y]) => [Math.round(x + ox), Math.round(y * g.s / 1.205)]),
        foes: { x0: Math.round(40 + ox), x1: Math.round(420 + ox), y0: Math.round(320 * g.s / 1.205), y1: Math.round(460 * g.s / 1.205) } };
    }
    const k = g.W / 540;
    return { lantern: { x: Math.round(300 * k), y: Math.round(g.GT + 170 * g.s / 1.205) }, party: [[350, 400], [436, 423], [385, 465], [465, 495]].map(([x, y]) => [Math.round(x * k), Math.round(y * g.s / 1.205)]),
      foes: { x0: Math.round(20 * k), x1: Math.round(250 * k), y0: Math.round(370 * g.s / 1.205), y1: Math.round(510 * g.s / 1.205) } };
  };

  // ------------------------------------------------------------------ 空（夜。R.Sky があればティアの色を少し混ぜる）
  K.nightSky = function (ctx, W, H, o) {
    const RZ = BZ.rz(), rng = RZ.rng;
    o = o || {};
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const st = o.stops || ['#05081a', '#0c1636', '#1c2a52', '#30406a'];
    g.addColorStop(0, st[0]); g.addColorStop(0.45, st[1]); g.addColorStop(0.8, st[2]); g.addColorStop(1, st[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R_ = rng(o.seed || 5);
    for (let i = 0; i < W * H / 700; i++) {
      const x = Math.floor(R_() * W), y = Math.floor(Math.pow(R_(), 1.3) * H), b = R_();
      const a = (0.25 + b * 0.75) * (1 - y / H * 0.8);
      ctx.fillStyle = `rgba(${220 + b * 35},${225 + b * 30},255,${a})`;
      ctx.fillRect(x, y, 1, 1);
      if (b > 0.985) { ctx.fillStyle = `rgba(230,240,255,${a * 0.5})`; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
    }
    if (o.aurora !== false) {
      const au = mk(W, H), ax = au.getContext('2d');
      const aw = o.auroraW || 0.8, ay = o.auroraY || 0.3;
      const band = (t) => H * ay + Math.sin(t * 5.2 + 1.1) * H * 0.06 + Math.sin(t * 13) * H * 0.02;
      for (let x = 0; x < W * aw; x += 2) {
        const t = x / W, y0 = band(t), hgt = H * (0.16 + 0.1 * Math.sin(t * 9 + 2) ** 2);
        const k = Math.pow(Math.sin(PI * Math.min(1, t / aw)), 1.2) * (0.6 + 0.4 * Math.sin(t * 31) ** 2) * (o.auroraK || 1);
        const gg = ax.createLinearGradient(0, y0 - hgt, 0, y0 + 6);
        gg.addColorStop(0, 'rgba(120,90,220,0)'); gg.addColorStop(0.55, `rgba(80,220,190,${0.22 * k})`); gg.addColorStop(0.92, `rgba(150,255,210,${0.45 * k})`); gg.addColorStop(1, 'rgba(150,255,210,0)');
        ax.fillStyle = gg; ax.fillRect(x, y0 - hgt, 2, hgt + 6);
      }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.drawImage(K.soften(au, 4), 0, 0); ctx.restore();
    }
    if (o.moon) {
      const [mx, my, mr] = o.moon;
      K.glow(ctx, mx, my, mr * 9, [150, 180, 255], 0.35); K.glow(ctx, mx, my, mr * 3, [210, 225, 255], 0.5);
      ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7);
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fbfcff'); mg.addColorStop(0.7, '#dfe6f6'); mg.addColorStop(1, '#b8c4e0'); ctx.fillStyle = mg; ctx.fill();
      ctx.clip(); const RR = rng(9); ctx.fillStyle = 'rgba(150,160,190,0.35)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(mx + (RR() - 0.5) * mr * 1.4, my + (RR() - 0.5) * mr * 1.4, mr * (0.08 + RR() * 0.18), 0, 7); ctx.fill(); }
      ctx.restore();
    }
    if (o.clouds !== false) {
      const cl = mk(W, H), cx = cl.getContext('2d'), R2 = rng((o.seed || 5) + 3);
      for (let i = 0; i < W / 70; i++) {
        const x = R2() * W, y = H * (0.25 + R2() * 0.55), rw = 40 + R2() * 90, rh = 5 + R2() * 9;
        cx.fillStyle = `rgba(40,52,90,${0.35 + R2() * 0.3})`; cx.beginPath(); cx.ellipse(x, y, rw, rh, 0, 0, 7); cx.fill();
        cx.fillStyle = `rgba(170,190,240,${0.1 + R2() * 0.12})`; cx.beginPath(); cx.ellipse(x, y - rh * 0.6, rw * 0.8, rh * 0.45, 0, 0, 7); cx.fill();
      }
      ctx.drawImage(K.soften(cl, 5), 0, 0);
    }
  };

  // ------------------------------------------------------------------ 遠近の地面（画素で焼く。昼の色）
  /**
   * o = {a: ramp の鍵（外側）, b: ramp の鍵（空き地・道）, seed, pebbles, far: 遠くの霞の色, clear(u, v) → >0 で空き地（既定は楕円）}
   */
  K.ground = function (g, o) { return BZ.runSync(() => K.groundG(g, o)); };
  K.groundG = function* (g, o) {
    const RZ = BZ.rz(), { ramp, clamp, mix, vnoise } = RZ, S = K._S;
    const W = Math.ceil(g.W), H = Math.ceil(g.H), c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
    const A = ramp(o.a, 8), Bm = ramp(o.b, 8), far = o.far || [236, 216, 184], sd = o.seed || 1;
    const clearF = o.clear || ((u, v, n2, n3) => 1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) + (n2 - 0.5) * 0.55 + (n3 - 0.5) * 0.2);
    for (let py = g.GT; py < H; py++) {
      if (S && (py & 3) === 0 && S.clk()) yield;
      const y = py + 0.5, z = K.yToZ(g, y);
      for (let px = 0; px < W; px++) {
        const u = (px + 0.5 - g.cx) * z / g.UD * 12, v = z * 12;
        const n1 = vnoise(u * 0.18, v * 0.3, sd), n2 = vnoise(u * 0.7, v * 1.1, sd + 1), n3 = vnoise(u * 2.2, v * 3.4, sd + 2), n4 = vnoise(u * 6, v * 9, sd + 3);
        const fr = clamp((v - 14) / 8, 0, 1);
        const cl = clearF(u, v, n2, n3);
        const l = 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.28 * (1 - fr * 0.6) + (n4 - 0.5) * 0.22 * (1 - fr);
        let col;
        if (cl > 0) col = Bm[clamp(Math.round((l - (cl < 0.08 ? 0.14 : 0)) * 7), 0, 7)];
        else { const bl = vnoise(u * 5, v * 1.2, sd + 7); col = A[clamp(Math.round((l + (bl - 0.5) * 0.35 * (1 - fr) + (cl > -0.08 ? -0.1 : 0)) * 7), 0, 7)]; }
        if (o.pebbles !== false) {
          const ci = Math.floor(u * 1.4), cj = Math.floor(v * 2.2);
          const hh = Math.imul((ci * 73856093) ^ (cj * 19349663) ^ sd, 1274126177) >>> 0, fx = (hh % 1000) / 1000, fz = ((hh >>> 10) % 1000) / 1000;
          if ((hh >>> 22) % 9 === 0) { const dx = u * 1.4 - ci - 0.25 - fx * 0.5, dz = v * 2.2 - cj - 0.25 - fz * 0.5; const d = Math.hypot(dx, dz * 1.3); if (d < 0.2) col = dz < 0 ? (o.pebHi || [206, 190, 160]) : (o.pebLo || [120, 100, 82]); else if (d < 0.26 && dz > 0) col = mix(col, [40, 26, 20], 0.5); }
        }
        if (o.pix) col = o.pix(col, u, v, cl, px, py) || col;
        col = mix(col, far, Math.pow(fr, 1.8) * (o.farK == null ? 0.6 : o.farK));
        const q = (py * W + px) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    if (o.wallShadow) {   // 屋内・洞窟: 壁の根元の接地の影（床の奥の端を暗く）
      const gr = x.createLinearGradient(0, g.GT, 0, g.GT + o.wallShadow * g.s);
      gr.addColorStop(0, 'rgba(10,8,20,0.75)'); gr.addColorStop(1, 'rgba(10,8,20,0)');
      x.fillStyle = gr; x.fillRect(0, g.GT, W, o.wallShadow * g.s);
    }
    return c;
  };

  // ------------------------------------------------------------------ 遠景の崖（画素）
  K.cliff = function (g, o) { return BZ.runSync(() => K.cliffG(g, o)); };
  K.cliffG = function* (g, o) {
    const RZ = BZ.rz(), { ramp, clamp, mix, hex, vnoise } = RZ, S = K._S;
    const W = Math.ceil(g.W), H = Math.ceil(g.H), c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data, R_ = RZ.rng(o.seed);
    const rock = ramp(o.rock, 8), top = ramp(o.top, 6), haze = hex(o.haze);
    const s = g.s, base = o.base * s;
    const prof = new Float32Array(W);
    for (let i = 0; i < W; i++) {
      const t = i / W; let h = (o.h0 + (o.h1 - o.h0) * Math.pow(t, o.curve || 1)) * s;
      h += (vnoise(i * 0.04, 0, o.seed) - 0.5) * o.amp * s + (vnoise(i * 0.18, 1, o.seed) - 0.5) * o.amp * 0.3 * s;
      prof[i] = Math.round(h / 3) * 3 + (vnoise(i * 0.6, 2, o.seed) - 0.5) * 1;
    }
    for (let i = 0; i < W; i++) for (let y = Math.max(0, Math.floor(base - prof[i])); y < base && y < H; y++) {
      if (S && y === Math.max(0, Math.floor(base - prof[i])) && (i & 15) === 0 && S.clk()) yield;
      const dy = y - (base - prof[i]);
      const yy = y + vnoise(i * 0.1, 3, o.seed) * 3;
      const band = Math.floor(yy / o.strata), bandT = (yy % o.strata) / o.strata;
      const block = vnoise(i * 0.24 + band * 3.1, band, o.seed + 4);
      let l = 0.45 + (block - 0.5) * 0.5 + (bandT < 0.22 ? 0.3 : bandT > 0.8 ? -0.25 : 0) + (i / W - 0.5) * (o.lightSlope || 0);
      if (vnoise(i * 1.6, y * 0.1, o.seed + 6) > 0.8) l -= 0.3;
      let col = rock[clamp(Math.round(l * 7), 0, 7)];
      if (dy < 2 || (bandT < 0.12 && vnoise(i * 0.4, band, o.seed + 8) > 0.55)) col = top[clamp(Math.round((0.6 + (vnoise(i, y * 2, 9) - 0.5) * 0.6) * 5), 0, 5)];
      col = mix(col, haze, clamp(o.hz + (y / base) * (o.hzGrad || 0), 0, 1));
      const q = (y * W + i) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (o.trees) {
      const B = new RZ.Builder(), nt = Math.round(o.trees * W / 480);
      for (let k = 0; k < nt; k++) { const i = Math.floor(R_() * W), y = base - prof[i] + 1; K.conifer(B, i, y, (5 + R_() * 7) * (o.treeS || 1) * s, R_, y); }
      K.blit(x, yield* K.renderG(B, { outline: false, light: K.LIGHT, sat: 0.7 }), 0, 0);
    }
    return { canvas: c, prof, base };
  };
  /** 夜の色に沈める（遠景は光を掛けないので、ここで夜にしておく） */
  K.tint = function (c, col, over) {
    const t = mk(c.width, c.height), x = t.getContext('2d'); x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(c, 0, 0);
    if (over) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = over; x.fillRect(0, 0, t.width, t.height); }
    return t;
  };

  // ------------------------------------------------------------------ 2.5D の小物（同じラスタライザ）
  K.LIGHT = { key: [0.2, -0.62, 0.76], rim: [0.9, -0.3, -0.4], rimC: [255, 216, 160], rimK: 1.25, mul: [0.94, 0.88, 0.84] };
  const EMd = {
    leaf: { keys: ['#0a1c14', '#123a20', '#1e5a28', '#3a7e2c', '#6aa436', '#b0d060'], n: 7, tex: 3, tsx: 0.55, tsy: 0.55, wrap: 0.3, amb: 0.12, rim: '#fff0b0', rimK: 0.5 },
    pine: { keys: ['#06140e', '#0c2a1c', '#164428', '#246034', '#3e7c3c', '#78a450'], n: 7, tex: 2.4, tsx: 0.9, tsy: 0.35, wrap: 0.2, amb: 0.12, rim: '#f0f0b0', rimK: 0.4 },
    bark: { keys: ['#120a08', '#2a1a12', '#4a3020', '#6c4c32', '#907050'], n: 6, tex: 2, tsx: 0.2, tsy: 1.4 },
    grass: { keys: ['#0e2410', '#1c4418', '#2e6a1e', '#4a8e26', '#7cb434', '#c0e060'], n: 7, wrap: 0.4, amb: 0.3, rim: '#fff8c0', rimK: 0.7, outline: '#0c2410' },
    stone: { keys: ['#161a22', '#2c323e', '#4c5460', '#747c84', '#a4aaa8', '#d8d8cc'], n: 7, tex: 2.2, tsx: 0.5, tsy: 0.5, wrap: 0.2, amb: 0.1 },
    moss: { keys: ['#142410', '#2a4a18', '#4a7424', '#7ca03a', '#b4cc5c'], n: 6, tex: 2.5, tsx: 0.8, tsy: 0.8 },
    iron: { keys: ['#1a1c24', '#3a404c', '#646c7a', '#9ca4b0', '#e2e8ee'], n: 7, metal: true, spec: 0.8, specPow: 12 },
    lampGlow: { keys: ['#ff9a30', '#ffe0a0', '#fffbe8'], n: 3, flat: true, glow: '#ffd070' },
  };
  K.EM = function (name, over) { return BZ.mat(Object.assign({}, EMd[name], over || {})); };
  K.conifer = function (B, x, y, h, R_, zb, m) {
    B.cap(x, y, x, y - h * 0.3, h * 0.05, h * 0.04, K.EM('bark'), zb);
    for (let i = 0; i < 5; i++) {
      const t0 = y - h * (0.18 + i * 0.16), w = h * (0.36 - i * 0.058) * (0.9 + R_() * 0.2), th = h * 0.3;
      const pts = [[x - w, t0], [x - w * 0.55, t0 - th * 0.35], [x, t0 - th], [x + w * 0.55, t0 - th * 0.35], [x + w, t0], [x + w * 0.4, t0 - th * 0.08], [x, t0 + th * 0.06], [x - w * 0.45, t0 - th * 0.06]];
      B.poly(pts, m || K.EM('pine'), zb + 0.1 + i * 0.01, { bevel: w * 0.7, ny: -0.25 });
    }
  };
  K.roundTree = function (B, x, y, h, R_, zb, m) {
    B.cap(x, y, x - h * 0.03, y - h * 0.55, h * 0.07, h * 0.045, K.EM('bark'), zb);
    const n = 9 + Math.floor(R_() * 5), cx = x, cy = y - h * 0.68;
    for (let i = 0; i < n; i++) {
      const a = R_() * PI * 2, rr = Math.sqrt(R_()) * h * 0.26, r = h * (0.13 + R_() * 0.08);
      B.ell(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.9, r, r * 0.9, m || K.EM('leaf'), zb + 0.2 + i * 0.0001, { bulge: 0.85 });
    }
  };
  K.rock = function (B, x, y, s, R_, zb, mossy, m) {
    B.ell(x, y - s * 0.45, s, s * 0.62, m || K.EM('stone'), zb, { bulge: 0.8 });
    B.ell(x + s * 0.55, y - s * 0.3, s * 0.6, s * 0.45, m || K.EM('stone'), zb + 0.01, { g: B.group(), bulge: 0.8 });
    if (mossy) B.ell(x - s * 0.1, y - s * 0.85, s * 0.7, s * 0.25, K.EM('moss'), zb + 0.02, { bulge: 0.6 });
  };
  K.tuft = function (B, x, y, s, R_, zb, m) {
    const n = 4 + Math.floor(R_() * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.4 + (R_() - 0.5) * 0.3, L = s * (0.6 + R_() * 0.6);
      B.strand([[x + (i - n / 2) * s * 0.12, y], [x + Math.sin(a) * L * 0.4, y - L * 0.6], [x + Math.sin(a) * L, y - L * Math.cos(a) * 0.95]], s * 0.14, s * 0.02, m || K.EM('grass'), zb + i * 0.001, { seg: 3, shadeOff: (R_() - 0.3) * 2 });
    }
  };
  /** 一行のランタン（光だまりの中心。地面に置く） */
  K.lantern = function (s) {
    const RZ = BZ.rz(), B = new RZ.Builder(), iron = K.EM('iron'), gl = K.EM('lampGlow');
    B.poly([[-5, 0], [5, 0], [4, -2], [-4, -2]], iron, 0, { bevel: 0.8 });
    B.poly([[-4, -2], [4, -2], [4, -13], [-4, -13]], gl, 0.1, { bevel: 0.2 });
    [-4, 4].forEach((dx) => B.cap(dx, -2, dx, -13, 0.7, 0.7, iron, 0.2));
    B.poly([[-5.5, -13], [5.5, -13], [2.5, -17], [-2.5, -17]], iron, 0.3, { bevel: 1 });
    B.cap(-2.5, -17, 0, -21, 0.5, 0.5, iron, 0.2); B.cap(2.5, -17, 0, -21, 0.5, 0.5, iron, 0.2);
    return RZ.render(B, { scale: s, light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.9 });
  };
  /** 光るキノコ・蛍などの粒（post に加算で描く） */
  K.fireflies = function (ctx, n, box, seed, cols, sz) {
    const R_ = BZ.rz().rng(seed);
    for (let i = 0; i < n; i++) {
      const x = box[0] + R_() * box[2], y = box[1] + R_() * box[3], c = cols[Math.floor(R_() * cols.length)], r = (1 + R_() * 1.5) * (sz || 1);
      K.glow(ctx, x, y, r * 5, c, 0.3 + R_() * 0.35);
      ctx.fillStyle = rgba(c.map((v) => Math.min(255, v + 60)), 0.95); ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };

  // ------------------------------------------------------------------ 光（RENDER の R.Light.compose が仮の間の控え。試作の lightmap）
  /** rect の中を環境光（掛け算）＋光だまり（足し算で光の地図に）で夜にする。o = {ambient, lights:[{x,y,r,color,k,sy}], top, feather} */
  /** 光の地図だけ（W×H の不透明な canvas）。R.Light.map が仮の実装のときの控え */
  BZ.lightMap = function (W, H, o) {
    const c = mk(W, H);
    BZ.stageLight(c.getContext('2d'), { x: 0, y: 0, w: W, h: H }, Object.assign({ top: -100, feather: 1 }, o), true);
    return c;
  };
  BZ.stageLight = function (g, rect, o, raw) {
    const W = Math.ceil(rect.w), H = Math.ceil(rect.h);
    const lm = mk(W, H), lx = lm.getContext('2d');
    const top = (o.top != null ? o.top : rect.y) - rect.y, fe = o.feather || 40;
    const gr = lx.createLinearGradient(0, top - fe, 0, top + fe);
    gr.addColorStop(0, 'rgb(255,255,255)'); gr.addColorStop(1, o.ambient || 'rgb(92,84,150)');
    lx.fillStyle = gr; lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    for (const L of o.lights || []) {
      const c = /rgb/.test(L.color) ? L.color.match(/\d+/g).map(Number) : BZ.color.hex(L.color);
      lx.save(); lx.translate(L.x - rect.x, L.y - rect.y); lx.scale(1, L.sy || 0.55);
      const rg = lx.createRadialGradient(0, 0, 0, 0, 0, L.r);
      const k = L.k == null ? 0.8 : L.k;
      rg.addColorStop(0, rgba(c, k)); rg.addColorStop(0.4, rgba(c, k * 0.55)); rg.addColorStop(1, rgba(c, 0));
      lx.fillStyle = rg; lx.fillRect(-L.r, -L.r, L.r * 2, L.r * 2); lx.restore();
    }
    if (raw) { g.drawImage(lm, rect.x, rect.y); return; }
    g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(lm, rect.x, rect.y); g.restore();
  };

  // ------------------------------------------------------------------ 切れ端で焼く（P2、§2.10）
  // 背景の bake は generator（*bake）。K._S は今 step している仕事の時計（S.clk() が true なら中で yield）。同期で焼くときは null
  K._S = null;
  K.renderG = function* (B, ro) { return yield* BZ.renderG(BZ.rz(), B, ro, K._S); };
  K.tick = function* () { if (K._S && K._S.clk()) yield; };

  // ------------------------------------------------------------------ 背景の登録
  K.IDS = [];
  /** def = {mood, ambient, bake(g, L, ctx) → {back, ground, front, post}} */
  K.define = function (id, def) {
    K.IDS.push(id);
    (BZ.BBG_IDS = BZ.BBG_IDS || []).push(id);
    (BZ._pending = BZ._pending || []).push(['hd:bbg:' + id, (opts) => K.bakeJob(id, def, opts || {}), { kind: 'bbg', owner: 'BEAST', mood: def.mood }]);
  };
  /** 同期で焼く（見本・テスト）。R.Hd の factory は bakeJob（切れ端で）。画素は同じ */
  K.bake = function (id, def, opts) { const j = K.bakeJob(id, def, opts); while (!j.done) j.step(1e9); return j.result; };
  K.bakeJob = function (id, def, opts) {
    let spent = 0, SS = null, a = 0;
    const j = BZ.job((S) => { SS = S; return bakeGen(id, def, opts, S, () => spent + (performance.now() - a)); }, 'bbg');
    const step = j.step;
    j.step = function (ms) {
      const prev = K._S; a = performance.now();
      K._S = SS;
      try { step(ms); } finally { K._S = prev; spent += performance.now() - a; }
    };
    return j;
  };
  function* bakeGen(id, def, opts, S, spentMs) {
    const W = Math.round(opts.w || R.W || 960), H = Math.round(opts.h || R.H || 540);
    const g = K.geo(W, H, def.geo);
    const L = K.layoutFor(g);
    const out = def.bake(g, L, { W, H, RZ: BZ.rz() });
    const layers = out && typeof out.next === 'function' ? yield* out : out;
    const frames = [], poses = {};
    for (const name of ['back', 'ground', 'front', 'post']) {
      const c = layers[name];
      if (!c) continue;
      yield* K.tick();
      K.noBlack(c);
      poses[name] = [frames.length];
      frames.push({ c, ox: 0, oy: 0 });
    }
    return {
      frames, poses, anchors: { lantern: L.lantern }, w: W, h: H,
      meta: { mood: def.mood, lantern: L.lantern, horizon: g.GT, lightTop: g.GT, feather: 0, light: 'layer', postMode: 'lighter', layout: g.tall ? 'tall' : 'wide',
        ambient: def.ambient, foes: L.foes, party: L.party, bakeMs: Math.round(spentMs() * 10) / 10, id },
    };
  }

  // ------------------------------------------------------------------ 見本の組み立て（BSCENE の描く順の見本。スクショと図鑑の試しに使う）
  const PARTY_COLORS = [['#2e4ea0', '#c46a2c'], ['#843a2c', '#cc4c26'], ['#3c7a4a', '#c4bc78'], ['#9486aa', '#76489a']];
  function partySprite(i, frame) {
    // CAST の戦闘の絵があればそれ（出撃中の 4 人の今の武器）。無ければ影絵の仮の人
    const looks = Object.keys(R.DB.looks || {});
    const W = ['sword', 'greatsword', 'dagger', 'bow', 'staff'];
    for (const lk of looks.slice(i * 3)) for (const w of W) { const k = `hd:btl:${lk}:${w}`; if (R.Hd.has(k)) { const sh = R.Hd.now(k, {}); if (sh) return { sh, frame: (sh.poses.idle || [0])[0] }; } }
    const key = 'bz_party_' + i;
    if (!K._ph) K._ph = {};
    if (!K._ph[key]) {
      const RZ = BZ.rz(), B = new RZ.Builder(), c = PARTY_COLORS[i];
      const cloth = BZ.mat({ keys: BZ.keysFrom(c[0]), n: 6, wrap: 0.3 }), hair = BZ.mat({ keys: BZ.keysFrom(c[1]), n: 6, wrap: 0.35 });
      const skin = BZ.mat({ keys: ['#46282a', '#84523f', '#bb866a', '#deb496', '#f4d8c0'], n: 6, wrap: 0.45, amb: 0.3 });
      B.cap(-2, -2, -3, -20, 3, 2.6, cloth, 0.5); B.cap(3, -2, 2, -20, 3, 2.6, cloth, 0.6);
      B.ell(0, -30, 8, 12, cloth, 1); B.ell(-1, -46, 8.5, 8, skin, 1.2); B.ell(0, -50, 9.2, 6.5, hair, 1.3, { rot: 0.2 });
      B.cap(-6, -34, -12, -26, 2.2, 1.8, cloth, 1.1);
      const r = RZ.render(B, { scale: 1.3, light: { key: [-0.5, -0.6, 0.6], rim: [0.6, -0.5, -0.5], rimC: [176, 204, 255], rimK: 1, mul: [1, 0.95, 0.9], pts: [] }, tones: 5, olMix: 0.82, sat: 0.9 });
      BZ.finish(r.canvas);
      K._ph[key] = { frames: [{ c: r.canvas, ox: Math.round(r.ox), oy: Math.round(r.oy) }], poses: { idle: [0] }, anchors: {}, w: r.canvas.width, h: r.canvas.height, meta: { placeholder: true } };
    }
    return { sh: K._ph[key], frame: 0 };
  }
  function silhouetteShadow(g, fr, x, y, lx, a) {
    const c = fr.c, P = 4;
    const sil = mk(c.width + P * 2, c.height + P * 2), sx = sil.getContext('2d');
    sx.drawImage(c, P, P); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgb(12,10,24)'; sx.fillRect(0, 0, sil.width, sil.height);
    const bl = K.soften(sil, 1.5);
    const d = Math.min(1.6, Math.abs(x - lx) / 130 + 0.5), shear = (x < lx ? 1 : -1) * 1.1 * d;
    g.save(); g.globalAlpha = a; g.setTransform(g.getTransform().multiply(new DOMMatrix([1, 0, shear, -0.34, x, y])));
    g.drawImage(bl, -fr.ox - P, -fr.oy - P); g.restore();
  }
  function footShadow(g, x, y, w, a) {
    g.save(); g.translate(x, y); g.scale(1, 0.26);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w);
    gr.addColorStop(0, `rgba(12,10,22,${a})`); gr.addColorStop(0.55, `rgba(12,10,22,${a * 0.7})`); gr.addColorStop(1, 'rgba(12,10,22,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w, 0, 7); g.fill(); g.restore();
  }
  /** 敵の置き場所（sheet の w で並べる。大きい物は奥の列） */
  K.foePlaces = function (box, list) {
    const n = list.length, out = [];
    const cx = (box.x0 + box.x1) / 2, ym = (box.y0 + box.y1) / 2;
    if (n === 1) return [[cx, ym + (box.y1 - ym) * 0.4]];
    const big = list.map((s) => (s ? s.w : 40));
    if (n === 2) return [[box.x0 + (box.x1 - box.x0) * 0.3, box.y0 + (box.y1 - box.y0) * 0.35], [box.x0 + (box.x1 - box.x0) * 0.72, box.y0 + (box.y1 - box.y0) * 0.8]];
    const mid = big.indexOf(Math.max(...big));
    for (let i = 0; i < n; i++) {
      if (i === mid) { out.push([box.x0 + (box.x1 - box.x0) * 0.62, box.y0 + (box.y1 - box.y0) * 0.6]); continue; }
      const k = out.filter((_, j) => j !== mid).length;
      out.push([box.x0 + (box.x1 - box.x0) * (0.18 + (k % 2) * 0.08), box.y0 + (box.y1 - box.y0) * (k % 2 ? 0.98 : 0.1)]);
    }
    return out;
  };
  /**
   * 見本の組み立て: o = {foes:['wolf_1'|'boss:boss_moth'|'mon:b_root'…], frame:'idle'|'tele'|…, W, H}
   * 返り値 {foes:[{key, x, y, w, h}], party:[[x, y]]}
   */
  BZ.stage = function (g, sh, o) {
    o = o || {};
    const m = sh.meta, W = sh.w, H = sh.h;
    const lay = (ctx, name, mode) => { for (const i of sh.poses[name] || []) { ctx.save(); if (mode) ctx.globalCompositeOperation = mode; R.Hd.draw(ctx, sh.frames[i], 0, 0); ctx.restore(); } };
    lay(g, 'back');
    // 地面・影・人と敵・手前を 1 枚の層に描き、その層にだけ光を掛ける（空と遠景は掛けない。人や大きいボスが地平より上に出ても光が途切れない）
    const Lc = K._layer && K._layer.width === W && K._layer.height === H ? K._layer : (K._layer = mk(W, H));
    const lx = Lc.getContext('2d');
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H);
    lay(lx, 'ground');
    const foes = (o.foes || []).map((id) => {
      const key = /^(boss|mon):/.test(id) ? 'hd:' + id : 'hd:mon:' + id;
      return { key, sh: R.Hd.now(key, {}) };
    });
    const places = K.foePlaces(m.foes, foes.map((f) => f.sh));
    const acts = [];
    foes.forEach((f, i) => {
      if (!f.sh) return;
      const pose = (o.frame && f.sh.poses[o.frame]) ? o.frame : 'idle';
      acts.push({ sh: f.sh, fi: f.sh.poses[pose][0], x: Math.round(places[i][0]), y: Math.round(places[i][1]), foe: true, key: f.key });
    });
    m.party.forEach(([x, y], i) => { const p = partySprite(i); acts.push({ sh: p.sh, fi: p.frame, x, y, foe: false }); });
    acts.sort((a, b) => a.y - b.y);
    const lxp = m.lantern.x;
    for (const a of acts) { const fr = a.sh.frames[a.fi]; silhouetteShadow(lx, fr, a.x, a.y, lxp, 0.55); footShadow(lx, a.x, a.y, Math.max(14, (a.sh.w || 40) * 0.42), 0.6); }
    for (const a of acts) R.Hd.draw(lx, a.sh.frames[a.fi], a.x, a.y);
    lay(lx, 'front');
    const amb = (() => { const bad = (R.Stubs.installed.Hd || []).includes('mood'); const md = !bad && R.Hd.mood(m.mood); return (md && md.ambient) || m.ambient || 'rgb(92,84,150)'; })();
    const lk = Math.min(W, H * 16 / 9);
    const lights = [{ x: lxp, y: m.lantern.y - 6, r: Math.round(lk * 0.34), color: 'rgb(255,200,130)', k: 0.8, sy: 0.55 }, { x: lxp, y: m.lantern.y - 4, r: Math.round(lk * 0.12), color: 'rgb(255,228,186)', k: 0.45, sy: 0.6 }];
    const realLight = !((R.Stubs.installed.Light || []).includes('map'));
    const map = realLight ? R.Light.map({ x: 0, y: 0, w: W, h: H }, { ambient: amb, k: 1, lights, mood: m.mood }) : BZ.lightMap(W, H, { ambient: amb, lights });
    const T = K._mask && K._mask.width === W && K._mask.height === H ? K._mask : (K._mask = mk(W, H));
    const tx = T.getContext('2d');
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, W, H); tx.imageSmoothingEnabled = true;
    tx.drawImage(map, 0, 0, W, H);
    tx.globalCompositeOperation = 'destination-in'; tx.drawImage(Lc, 0, 0);
    lx.globalCompositeOperation = 'multiply'; lx.drawImage(T, 0, 0); lx.globalCompositeOperation = 'source-over';
    g.drawImage(Lc, 0, 0);
    lay(g, 'post', m.postMode || 'lighter');
    if (!((R.Stubs.installed.Post || []).includes('frame'))) R.Post.frame(g, {});
    return { foes: acts.filter((a) => a.foe).map((a) => ({ key: a.key, x: a.x, y: a.y, w: a.sh.w, h: a.sh.h })), party: m.party, light: realLight ? 'R.Light.map' : 'fallback', ambient: amb };
  };
  // 背景のファイル（bbg_*.js）は名前順で kit.js より先に読まれるので、K._defs に積んだ物をここで登録する
  for (const [id, def] of K._defs || []) K.define(id, def);
  K._defs = { push: ([id, def]) => K.define(id, def) };
})(window.RPG);
