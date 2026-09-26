// Round 2 town: pixel facades as billboards standing on a perspective cobble plane (diorama look),
// golden-hour sun, long shadows across the street, tilt-shift DOF, haze, bloom, thin UI.
'use strict';
(function (G) {
  const { mat, hex, mix, clamp, rng, vnoise, ramp } = G.RZ;
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const mk = ENV.mk, K = 2;
  const BASE = 372, HZV = -420;                 // back-row street line (screen y), virtual horizon
  const sAt = (y) => (y - HZV) / (BASE - HZV);   // depth scale relative to the back row
  const STYLE = SCENES.STYLE2, LOOKS2 = SCENES.LOOKS2;
  const LIGHT = { key: [-0.55, -0.5, 0.65], rim: [-0.85, -0.35, -0.4], rimC: hex('#ffd8a0'), rimK: 1.3, mul: [0.96, 0.9, 0.84] };

  function facade(o) {
    const c = mk(512, 448), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0)';
    const px = new PLACES.PX(x); const emit = [];
    PLACES.house(px, Object.assign({ emit, day: true }, o)); px.done();
    return c;
  }
  function cobbleGround() {
    const W = 512, H = 448, c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
    const st = ramp(['#2a2626', '#433d3a', '#5e5550', '#7c7068', '#9c8e82', '#bcae9e'], 8), mortar = [34, 28, 26];
    const hs = (i, j, k) => { let h = Math.imul((i * 73856093) ^ (j * 19349663) ^ (k * 83492791), 1274126177); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
    for (let sy = Math.floor(BASE / K) - 2; sy < H; sy++) {
      const y = sy * K + 1, z = 1000 / (y - HZV);
      for (let sx = 0; sx < W; sx++) {
        const u = (sx * K + 1 - 512) * z / 300 * 10, v = z * 10;
        // cobbles: jittered rows in ground space
        const CU = 3.4, CV = 5.2;
        const row = Math.floor(v * CV), off = (row & 1) * 0.5;
        let d1 = 9, d2 = 9, id = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const r = row + dj, oo = (r & 1) * 0.5, cc = Math.floor(u * CU + oo) + di;
          const cx = (cc + 0.2 + hs(cc, r, 1) * 0.6 - oo) / CU, cy = (r + 0.25 + hs(cc, r, 2) * 0.5) / CV;
          const d = Math.hypot((u - cx) * CU, (v - cy) * CV);
          if (d < d1) { d2 = d1; d1 = d; id = cc * 977 + r; } else if (d < d2) d2 = d;
        }
        const far = clamp((v - 11) / 5, 0, 1);
        let c;
        if (d2 - d1 < 0.13 + far * 0.2) c = mix(mortar, [110, 96, 86], far * 0.6);
        else { const l = 0.55 + (hs(id, 0, 3) - 0.5) * 0.35 + (vnoise(u * 3, v * 3, 5) - 0.5) * 0.2 - (d2 - d1 < 0.25 ? 0.12 : 0) + (d1 < 0.25 ? 0.06 : 0); c = st[clamp(Math.round(l * 7), 0, 7)]; }
        // gutter / grass verge at the near edge of the street
        const verge = v < 8.9 + (vnoise(u * 0.8, 1, 9) - 0.5) * 0.4;
        if (verge) { const l = 0.45 + (vnoise(u * 4, v * 9, 7) - 0.5) * 0.6; c = ramp(['#262a14', '#3c4220', '#58602e', '#747a3e', '#90924e'], 6)[clamp(Math.round(l * 5), 0, 5)]; }
        c = mix(c, [236, 214, 180], Math.pow(far, 1.5) * 0.35);
        const q = (sy * W + sx) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; D[q + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  const CACHE = {};
  function statics() {
    if (CACHE.t) return CACHE.t;
    const s = {};
    s.houses = [
      { c: facade({ x0: 6, x1: 170, yb: 178, wall: 84, roof: 62, seed: 1, chimney: true, windows: [[22, 112, 18, 22], [124, 112, 18, 22]], door: [70, 24, 42], posts: [6, 58, 108, 166], braces: [[10, 54], [112, 162]] }), x0: 6, x1: 176 },
      { c: facade({ x0: 188, x1: 340, yb: 178, wall: 92, roof: 56, seed: 2, slate: true, windows: [[202, 106, 18, 24], [306, 106, 18, 24], [255, 100, 22, 14]], door: [252, 30, 46], posts: [188, 238, 290, 336] }), x0: 182, x1: 346 },
      { c: facade({ x0: 358, x1: 510, yb: 178, wall: 80, roof: 66, seed: 3, chimney: true, windows: [[378, 116, 18, 22], [470, 116, 18, 22]], door: [420, 24, 40], posts: [358, 408, 458, 506], braces: [[362, 404], [462, 502]] }), x0: 352, x1: 516 },
    ];
    s.ground = cobbleGround();
    // a near house on the left (foreground, will be blurred)
    s.near = facade({ x0: 10, x1: 190, yb: 300, wall: 150, roof: 90, seed: 7, windows: [[40, 200, 26, 32], [130, 200, 26, 32]], posts: [10, 96, 186], door: null });
    // far skyline (blurred): towers + trees
    { const c = mk(512, 448), x = c.getContext('2d'); const B = new RZ.Builder(), R = rng(8);
      for (let i = 0; i < 14; i++) ENV.roundTree(B, R() * 520, 60 + R() * 8, 40 + R() * 30, R, 60);
      const r = RZ.render(B, { outline: false, light: LIGHT, sat: 0.6 }); ENV.blit(x, r, 0, 0, 1);
      x.fillStyle = '#6a5e6a'; x.fillRect(236, 6, 22, 60); x.fillStyle = '#7a3a2e'; x.beginPath(); x.moveTo(230, 8); x.lineTo(247, -18); x.lineTo(264, 8); x.fill();
      s.sky = c; }
    // props on the street
    return (CACHE.t = s);
  }

  function billboard(c, sx0, sx1, sy0, sy1, baseX, baseY, s) {
    // draw sub-rect of a 512 canvas so that its bottom-left sits at (baseX, baseY) scaled by s*K
    ctx.drawImage(c, sx0, sy0, sx1 - sx0, sy1 - sy0, baseX, baseY - (sy1 - sy0) * s * K, (sx1 - sx0) * s * K, (sy1 - sy0) * s * K);
  }
  function silShadow(c, sx0, sx1, sy0, sy1, baseX, baseY, s, a, kx, ky) {
    const w = sx1 - sx0, h = sy1 - sy0, t = mk(w + 12, h + 12), x = t.getContext('2d');
    x.filter = 'blur(2px)'; x.drawImage(c, sx0, sy0, w, h, 6, 6, w, h); x.filter = 'none';
    x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(40,24,34)'; x.fillRect(0, 0, t.width, t.height);
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
    ctx.setTransform(s * K, 0, kx * s * K, -ky * s * K, baseX, baseY);
    ctx.drawImage(t, -6, -h - 6 + h, w + 12, h + 12, -6, -6 - 0, w + 12, h + 12);
    ctx.restore();
  }

  async function town2(opt) {
    opt = opt || {}; const t = opt.t || 0;
    cv.width = 1024; cv.height = 896;
    const S = statics();
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#7e98b8'); g.addColorStop(0.6, '#e2d2bc'); g.addColorStop(1, '#f6dcb4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 360);
    ENV.glow(ctx, 120, 40, 520, [255, 226, 180], 0.6);
    ctx.save(); ctx.filter = 'blur(4px)'; ctx.imageSmoothingEnabled = false; ctx.drawImage(S.sky, 0, 60, 1024, 896); ctx.restore();
    // ground
    ctx.imageSmoothingEnabled = false; ctx.drawImage(S.ground, 0, 0, 1024, 896);
    // back-row houses (billboards at scale 1) + their long shadows across the street (sun behind, upper-left)
    for (const h of S.houses) {
      ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgb(40,26,36)';
      // shadow of the facade: a skewed quad from its base toward the camera (soft)
      ctx.filter = 'blur(6px)'; ctx.beginPath();
      const x0 = h.x0 * K, x1 = h.x1 * K, y = BASE;
      ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1 + 150, y + 150); ctx.lineTo(x0 + 150, y + 150); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    for (const h of S.houses) { ctx.imageSmoothingEnabled = false; billboard(h.c, h.x0 - 6, h.x1 + 6, 0, 186, (h.x0 - 6) * K, BASE + 16, 1); }
    // props + actors, depth sorted
    const items = [];
    const P = (kind, x, y) => items.push({ kind, x, y });
    P('barrel', 360, 404); P('barrel', 392, 414); P('crate', 700, 402); P('crate', 726, 424); P('planter', 90, 384); P('planter', 560, 384); P('planter', 940, 386);
    P('lamp', 470, 470); P('lamp', 900, 600);
    items.push({ actor: 'arun', x: 560, y: 520, pose: RIG.pose('step', { br: t, aN: 0.2, eN: 0.3, w: 0.4, lean: 0.08, cape: 0.3, lN: 0.35, kN: -0.3, lF: -0.3, kF: -0.25 }), flip: false });
    items.push({ actor: 'viola', x: 488, y: 540, pose: RIG.pose('step', { br: t + 0.2, aN: 0.3, eN: 0.5, w: 2.4, lN: -0.3, kN: -0.3, lF: 0.3, kF: -0.25 }), flip: false });
    items.push({ actor: 'npc', x: 648, y: 512, pose: RIG.pose('idle', { br: t + 0.4, aN: 0.2, eN: 1.4, aF: 0.1, eF: 1.3, mouth: 2 }), flip: true });
    items.push({ actor: 'sylvan', x: 780, y: 640, pose: RIG.pose('idle', { br: t + 0.7 }), flip: true });
    items.sort((a, b) => a.y - b.y);
    const npcL = PLACES.npcLook();
    const rendered = items.map((it) => {
      const s = sAt(it.y), B = new RZ.Builder();
      if (it.actor) { const L = it.actor === 'npc' ? npcL : LOOKS2[it.actor]; RIG.draw(B, L, Object.assign({}, it.pose)); return [it, RZ.render(B, Object.assign({}, STYLE, { flip: it.flip, scale: 1.0 * s, light: LIGHT }))]; }
      PLACES.prop(B, it.kind, 0, 0); return [it, RZ.render(B, Object.assign({}, STYLE, { scale: 1.0 * s, light: LIGHT }))];
    });
    // long soft shadows toward the lower right
    for (const [it, r] of rendered) {
      const sil = mk(r.canvas.width + 8, r.canvas.height + 8), x = sil.getContext('2d');
      x.filter = 'blur(1.5px)'; x.drawImage(r.canvas, 4, 4); x.filter = 'none'; x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(38,24,34)'; x.fillRect(0, 0, sil.width, sil.height);
      ctx.save(); ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = true; ctx.setTransform(K, 0, -1.0 * K, -0.42 * K, it.x, it.y); ctx.drawImage(sil, -r.ox - 4, -r.oy - 4); ctx.restore();
      ENV.shadow(ctx, it.x, it.y, 22 * sAt(it.y), 6 * sAt(it.y), 0.5, [30, 18, 24]);
    }
    for (const [it, r] of rendered) { ctx.imageSmoothingEnabled = false; ENV.blit(ctx, r, it.x, it.y, K); }
    // market awning strip + hanging flags between houses (thin geometry, full-res)
    [[[40, 190], [980, 190], 40]].forEach(([a, b, sag]) => {
      ctx.save(); ctx.strokeStyle = 'rgba(40,28,24,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
      const Pq = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag];
      for (let u = 0; u <= 1.001; u += 0.02) { const q = Pq(u); u ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
      const cols = ['#8c4a3a', '#c8b08a', '#4e6a7a', '#9a8a52'];
      for (let u = 0.04, i = 0; u < 1; u += 0.05, i++) { const q = Pq(u); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(q[0] - 9, q[1]); ctx.lineTo(q[0] + 9, q[1]); ctx.lineTo(q[0], q[1] + 22); ctx.fill(); }
      ctx.restore();
    });
    // near foreground house (left), blurred heavily
    { const c = mk(512, 448), x = c.getContext('2d'), B = new RZ.Builder(), R = rng(21);
      ENV.roundTree(B, 30, 470, 190, R, 470); for (let i = 0; i < 10; i++) ENV.tuft(B, R() * 512, 452, 14 + R() * 14, R, 460);
      const fence = mat({ keys: ['#1e140e', '#3a281c', '#5a402c', '#7a5a40'], n: 5 });
      for (let i = 0; i < 9; i++) { const fx = 300 + i * 26; B.cap(fx, 452, fx, 408, 3, 3, fence, 450); } B.cap(290, 418, 520, 414, 2.4, 2.4, fence, 451); B.cap(290, 436, 520, 432, 2.4, 2.4, fence, 451);
      const r = RZ.render(B, Object.assign({}, STYLE, { light: LIGHT })); ENV.blit(x, r, 0, 0, 1);
      ctx.save(); ctx.filter = 'blur(6px)'; ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, 1024, 896); ctx.restore(); }
    // sun shafts from the upper left + warm haze
    ENV.rays(ctx, 60, -60, [[0.75, 60, 900, 0.14], [0.95, 40, 900, 0.11], [0.6, 50, 800, 0.08]], [255, 228, 180]);
    { const h = ctx.createLinearGradient(0, 0, 600, 500); h.addColorStop(0, 'rgba(255,236,205,0.4)'); h.addColorStop(1, 'rgba(255,236,205,0)'); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = h; ctx.fillRect(0, 0, 1024, 896); ctx.restore(); }
    ENV.motes(ctx, 24, [150, 150, 700, 400], [255, 226, 180], 5);
    ENV.post(ctx, { dofTop: [170, 360], dofBot: [700, 840], dofPx: 4.5, bloom: 0.55, thr: 0.7, vig: 0.62, grade: { sh: [6, -4, 10], hi: [20, 8, -14], sat: 1.04, con: 1.14 } });
    if (opt.noUI) return;
    // thin UI: location title + dialogue line
    const txt = (s, x, y, px, c, w, al) => { ctx.save(); ctx.font = UI.F(w || 500, px); ctx.textAlign = al || 'left'; ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4; ctx.fillStyle = c || '#f6f2ea'; ctx.fillText(s, x, y); ctx.restore(); };
    const line = (x0, y0, x1, y1, a) => { ctx.save(); ctx.strokeStyle = `rgba(236,230,214,${a})`; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); };
    txt('コーラルの町', 60, 64, 30, '#fbf6e8', 700); line(60, 78, 360, 78, 0.7); line(60, 82, 260, 82, 0.3);
    const dg = ctx.createLinearGradient(0, 700, 0, 896); dg.addColorStop(0, 'rgba(10,10,16,0)'); dg.addColorStop(0.35, 'rgba(10,10,16,0.62)'); dg.addColorStop(1, 'rgba(10,10,16,0.78)');
    ctx.fillStyle = dg; ctx.fillRect(0, 700, 1024, 196);
    line(120, 752, 904, 752, 0.5);
    txt('町の人', 124, 740, 22, '#f0d8a8', 700);
    txt('「灯台の火が消えてから、夜の海は荒れるばかりさ。', 124, 800, 28);
    txt('　あんたたち、行ってくれるのかい？」', 124, 846, 28);
  }
  SCENES.town2 = town2;
})(window);
