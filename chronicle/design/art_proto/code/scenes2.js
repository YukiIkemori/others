// Round 2 (owner reference feedback): small crisp pixel sprites with a restrained palette, while the
// environment does the heavy lifting — perspective ground, layered blurred backdrop, sun flare/haze,
// long cast shadows, warm grade, tilt-shift DOF — and a thin, elegant UI.
'use strict';
(function (G) {
  const { mat, hex, mix, clamp, rng, vnoise, ramp } = G.RZ;
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const mk = ENV.mk;
  const K = 2;           // one sprite pixel = 2 screen pixels (crisp, nearest neighbour)
  const HZV = -260;      // virtual horizon of the ground plane (telephoto: weak perspective)
  const GROUND_TOP = 392;
  const SUN = [900, 60];

  // ---------- restrained palette looks (same rig, different data) ----------
  const cl = (keys, o) => mat(Object.assign({ keys, n: 6, wrap: 0.3, tex: 0.5, tsx: 1.4, tsy: 0.3 }, o));
  const hr = (keys) => mat({ keys, n: 6, sheen: [-0.62, -0.28], wrap: 0.35, amb: 0.22, tex: 1.1, tsx: 0.25, tsy: 1.6 });
  const skin = mat({ keys: ['#4a2a2a', '#83503f', '#b67c62', '#dcac8c', '#f2d2b4'], n: 6, rim: '#fff0d8', wrap: 0.45, amb: 0.3 });
  const brass = mat({ keys: ['#2e2010', '#5e4424', '#8e7040', '#bca068', '#e8d8a8'], n: 6, metal: true, spec: 1, specPow: 10 });
  const steel = mat({ keys: ['#22262e', '#454c58', '#727a86', '#a4acb4', '#dce0e2'], n: 6, metal: true, spec: 1, specPow: 10 });
  const leather = mat({ keys: ['#221610', '#3e2a1e', '#5c4030', '#7e5c44', '#a07e60'], n: 6, tex: 0.9, tsx: 0.8, tsy: 0.8 });
  const leatherDk = mat({ keys: ['#16100e', '#2a201a', '#40322a', '#58483c'], n: 5 });
  const base = G.RIG.LOOKS;
  const LOOKS2 = {
    arun: Object.assign({}, base.arun, { skin, hair: hr(['#1a120e', '#33221a', '#4e3526', '#6e4c36', '#93684a', '#b88c68']),
      top: cl(['#1a1e28', '#2c3444', '#434e62', '#5e6a7e', '#8490a0']), cape: cl(['#1c1014', '#34191e', '#4e262a', '#6c3a38', '#8c5448']),
      trim: brass, pants: cl(['#1c1814', '#302a24', '#48403a', '#625850']), boots: leather, belt: leatherDk, metal: steel,
      eye: mat({ keys: ['#101820', '#243848', '#46687c', '#8cb0c0'], n: 4, flat: true }) }),
    selma: Object.assign({}, base.selma, { skin, hair: hr(['#1e100c', '#3c1e14', '#5c2e1e', '#7c422c', '#9c5c40', '#bc805c']),
      top: cl(['#161a14', '#262c22', '#3a4232', '#525a46', '#727a62']), trim: leather, pants: cl(['#181412', '#2a2420', '#403830', '#585048']),
      boots: leatherDk, belt: leather, metal: steel, eye: mat({ keys: ['#101810', '#24382a', '#48684c', '#90b094'], n: 4, flat: true }) }),
    sylvan: Object.assign({}, base.sylvan, { skin, hair: hr(['#22201a', '#3e3a2e', '#5e5844', '#827a5e', '#a69e80', '#c8c2a4']),
      top: cl(['#161a14', '#262e22', '#384430', '#4e5c40', '#6c7a58']), cape: cl(['#14160f', '#22271a', '#343c28', '#4a5438', '#667052']),
      trim: leather, pants: cl(['#1a1812', '#2c2820', '#443e32', '#5e5646']), boots: leather, belt: leatherDk, metal: brass,
      eye: mat({ keys: ['#0e1814', '#1e3a2e', '#3e6a56', '#88b0a0'], n: 4, flat: true }) }),
    viola: Object.assign({}, base.viola, { skin, hair: hr(['#18121c', '#2c2232', '#44364a', '#5e4e64', '#7e6c84', '#a292a6']),
      top: cl(['#3c3630', '#665e54', '#8e8676', '#b6ae9a', '#d8d0ba']), pants: cl(['#3c3630', '#665e54', '#8e8676', '#b6ae9a']),
      trim: brass, belt: cl(['#1e1622', '#342638', '#4c3a52', '#66526c']), boots: leatherDk, metal: brass,
      eye: mat({ keys: ['#181020', '#382a48', '#66527c', '#a894b8'], n: 4, flat: true }) }),
  };
  const STYLE = { tones: 5, sat: 0.9, olMix: 0.82, tint: [6, -2, 10, 10, 4, -8] };
  const LIGHT = { key: [0.2, -0.62, 0.76], rim: [0.9, -0.3, -0.4], rimC: hex('#ffe4b0'), rimK: 1.6, mul: [1.02, 0.98, 0.92] };

  // ---------- ground plane ----------
  const yToZ = (y) => 1200 / (y - HZV);               // distance
  const scaleAt = (y) => (y - HZV) / (620 - HZV);      // sprite scale relative to y=620
  function groundLayer() {
    const W = 512, H = 448, c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
    const grass = ramp(['#2a2c18', '#43441f', '#5e5a2a', '#7a7138', '#978a4a', '#b6a664'], 8);
    const dirt = ramp(['#3a2618', '#5a3c24', '#7a5634', '#9a7248', '#b89060', '#d6b27c'], 8);
    const R = rng(4);
    for (let sy = GROUND_TOP / K; sy < H; sy++) {
      const y = sy * K + 1, z = yToZ(y);
      for (let sx = 0; sx < W; sx++) {
        const u = (sx * K + 1 - 512) * z / 520 * 12, v = z * 12;
        const n1 = vnoise(u * 0.18, v * 0.3, 1), n2 = vnoise(u * 0.7, v * 1.1, 2), n3 = vnoise(u * 2.2, v * 3.4, 3), n4 = vnoise(u * 6, v * 9, 4);
        const far = clamp((v - 14) / 8, 0, 1);
        // worn dirt clearing where the fight happens (ragged edge)
        const clear = 1 - Math.hypot((u + 0.5) / 10.5, (v - 16.8) / 3.6) + (n2 - 0.5) * 0.55 + (n3 - 0.5) * 0.2;
        let l = 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.28 * (1 - far * 0.6) + (n4 - 0.5) * 0.22 * (1 - far);
        let c;
        if (clear > 0) {
          const crack = false;
          c = dirt[clamp(Math.round((l - (clear < 0.08 ? 0.14 : 0) - (crack ? 0.16 : 0)) * 7), 0, 7)];
        } else {
          // grass: streaky blades toward camera, clumps
          const bl = vnoise(u * 5, v * 1.2, 7);
          c = grass[clamp(Math.round((l + (bl - 0.5) * 0.35 * (1 - far) + (clear > -0.08 ? -0.1 : 0)) * 7), 0, 7)];
        }
        // pebbles (cells in ground space)
        const ci = Math.floor(u * 1.4), cj = Math.floor(v * 2.2);
        const hh = Math.imul((ci * 73856093) ^ (cj * 19349663), 1274126177) >>> 0, fx = (hh % 1000) / 1000, fz = ((hh >>> 10) % 1000) / 1000;
        if ((hh >>> 22) % 9 === 0) { const dx = u * 1.4 - ci - 0.25 - fx * 0.5, dz = v * 2.2 - cj - 0.25 - fz * 0.5; const d = Math.hypot(dx, dz * 1.3); if (d < 0.2) c = dz < 0 ? [206, 190, 160] : [120, 100, 82]; else if (d < 0.26 && dz > 0) c = mix(c, [40, 26, 20], 0.5); }
        // aerial haze toward the far edge
        c = mix(c, [236, 216, 184], Math.pow(far, 1.8) * 0.6);
        const q = (sy * W + sx) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; D[q + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // grass tufts standing on the plane, scaled by depth (billboards through the rasterizer)
    const B = new RZ.Builder();
    for (let i = 0; i < 300; i++) {
      const y = GROUND_TOP + 10 + Math.pow(R(), 0.7) * (896 - GROUND_TOP - 10), s = scaleAt(y);
      const sx = R() * 1024, z = yToZ(y), u = (sx - 512) * z / 520 * 12, v = z * 12;
      if (1 - Math.hypot((u + 0.5) / 10.5, (v - 16.8) / 3.6) > -0.12) continue;
      ENV.tuft(B, sx / K, y / K, (3 + R() * 5) * s, R, y);
    }
    const r = RZ.render(B, Object.assign({}, STYLE, { light: LIGHT, sat: 0.45, tint: [10, 4, -6, 16, 8, -10] })); ENV.blit(x, r, 0, 0, 1);
    return c;
  }

  // ---------- cliffs: stratified rock layers, grassy ledges, pines ----------
  function cliffLayer(o) {
    const W = 512, H = 448, c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data, R = rng(o.seed);
    const rock = ramp(o.rock, 8), top = ramp(o.top, 6), haze = hex(o.haze);
    // height profile with plateau steps
    const prof = new Float32Array(W);
    for (let i = 0; i < W; i++) {
      const t = i / W; let h = o.h0 + (o.h1 - o.h0) * Math.pow(t, o.curve || 1);
      h += (vnoise(i * 0.02, 0, o.seed) - 0.5) * o.amp + (vnoise(i * 0.09, 1, o.seed) - 0.5) * o.amp * 0.3;
      prof[i] = Math.round(h / 6) * 6 + (vnoise(i * 0.3, 2, o.seed) - 0.5) * 2;
    }
    for (let i = 0; i < W; i++) for (let y = Math.max(0, Math.floor(o.base - prof[i])); y < o.base; y++) {
      const dy = y - (o.base - prof[i]);
      const band = Math.floor((y + vnoise(i * 0.05, 3, o.seed) * 6) / o.strata);
      const bandT = ((y + vnoise(i * 0.05, 3, o.seed) * 6) % o.strata) / o.strata;
      const block = vnoise(i * 0.12 + band * 3.1, band, o.seed + 4);
      let l = 0.45 + (block - 0.5) * 0.5 + (bandT < 0.22 ? 0.3 : bandT > 0.8 ? -0.25 : 0);
      l += (i - (o.lightX || 0)) * 0.0004;
      if (vnoise(i * 0.8, y * 0.05, o.seed + 6) > 0.8) l -= 0.3;   // vertical cracks
      let col = rock[clamp(Math.round(l * 7), 0, 7)];
      if (dy < 3 || (bandT < 0.12 && vnoise(i * 0.2, band, o.seed + 8) > 0.55)) col = top[clamp(Math.round((0.6 + (vnoise(i * 0.5, y, 9) - 0.5) * 0.6) * 5), 0, 5)];
      col = mix(col, haze, o.hz + (y / o.base) * (o.hzGrad || 0));
      const q = (y * W + i) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (o.trees) {
      const B = new RZ.Builder();
      for (let k = 0; k < o.trees; k++) { const i = Math.floor(R() * W), y = o.base - prof[i] + 2; ENV.conifer(B, i, y, 10 + R() * 14 * (o.treeS || 1), R, y); }
      const r = RZ.render(B, { outline: false, light: LIGHT, sat: 0.7 }); ENV.blit(x, r, 0, 0, 1);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = ENV.rgba(haze, o.hz * 0.9); x.fillRect(0, 0, W, H);
    }
    return c;
  }

  const CACHE = {};
  function statics() {
    if (CACHE.s) return CACHE.s;
    const s = {};
    s.far = cliffLayer({ seed: 11, base: 206, h0: 70, h1: 40, amp: 50, strata: 7, rock: ['#6c5a58', '#7e6a64', '#927c70', '#a88e7c', '#bca08a'], top: ['#6a6a4a', '#7e7c56', '#948e62'], haze: '#e8dcc8', hz: 0.55, trees: 40, treeS: 0.6 });
    s.mid = cliffLayer({ seed: 12, base: 214, h0: 40, h1: 190, curve: 1.8, amp: 40, strata: 9, lightX: 480, rock: ['#2c2020', '#4a3430', '#664a3e', '#86624e', '#a67e62', '#c49c78'], top: ['#3c4222', '#56602e', '#707a3c', '#8c9450'], haze: '#e0cdb0', hz: 0.08, hzGrad: 0.1, trees: 26 });
    s.left = cliffLayer({ seed: 13, base: 212, h0: 92, h1: 10, curve: 0.5, amp: 30, strata: 8, rock: ['#2a2224', '#44383a', '#5e4e4c', '#7a6660', '#968076'], top: ['#3a4424', '#526030', '#6a783e'], haze: '#d8d4cc', hz: 0.2, trees: 18 });
    s.ground = groundLayer();
    // blurred foreground rocks (bottom band)
    { const c = mk(512, 448), x = c.getContext('2d'), B = new RZ.Builder(), R = rng(31);
      for (let i = 0; i < 9; i++) ENV.rock(B, R() * 540 - 10, 452 + R() * 8, 18 + R() * 22, R, 450 + i, R() < 0.5);
      for (let i = 0; i < 14; i++) ENV.tuft(B, R() * 520, 448, 16 + R() * 16, R, 460);
      const r = RZ.render(B, Object.assign({}, STYLE, { light: LIGHT })); ENV.blit(x, r, 0, 0, 1); s.fg = c; }
    return (CACHE.s = s);
  }
  const layer = (c, blur, k, smooth) => { ctx.save(); ctx.imageSmoothingEnabled = !!smooth; if (blur) ctx.filter = `blur(${blur}px)`; ctx.drawImage(c, 0, 0, 1024, 896); ctx.restore(); };

  // ---------- sprites ----------
  function spriteFor(a, t) {
    const B = new RZ.Builder(); const s = a.s;
    if (a.foe) { MON.draw(a.id, B, t + a.ph, a.st || {}); return RZ.render(B, Object.assign({}, STYLE, { scale: a.sc * s, light: LIGHT, sat: 0.78 })); }
    RIG.draw(B, LOOKS2[a.id], a.pose || RIG.pose('idle', { br: t * 0.8 + a.ph }));
    return RZ.render(B, Object.assign({}, STYLE, { flip: true, scale: a.sc * s, light: LIGHT }));
  }
  function silhouette(r, col) {
    const c = mk(r.canvas.width, r.canvas.height), x = c.getContext('2d');
    x.drawImage(r.canvas, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c;
  }
  function castShadow(r, fx, fy, a) {
    const sil = silhouette(r, 'rgb(34,20,26)'), P = 6;
    const bl = mk(sil.width + P * 2, sil.height + P * 2), bx = bl.getContext('2d');
    bx.filter = 'blur(1.6px)'; bx.drawImage(sil, P, P);
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
    ctx.setTransform(K, 0, 1.25 * K, -0.34 * K, fx, fy);
    ctx.drawImage(bl, -r.ox - P, -r.oy - P); ctx.restore();
  }

  const PARTY = [
    { id: 'arun', row: '前', x: 604, y: 560, hp: 417, mhp: 452, mp: 47, mmp: 60, ph: 0 },
    { id: 'sylvan', row: '後', x: 742, y: 596, hp: 301, mhp: 330, mp: 38, mmp: 52, ph: 0.35 },
    { id: 'selma', row: '前', x: 664, y: 652, hp: 512, mhp: 540, mp: 22, mmp: 34, ph: 0.6 },
    { id: 'viola', row: '後', x: 818, y: 700, hp: 58, mhp: 268, mp: 86, mmp: 120, ph: 0.8 },
  ];
  const FOES = [
    { id: 'goblin', name: '小鬼の斧兵', x: 158, y: 548, sc: 1.3, ph: 0.2 },
    { id: 'wolf', name: '氷狼', x: 340, y: 628, sc: 1.55, ph: 0.5 },
    { id: 'slime', name: 'スライム', x: 196, y: 724, sc: 1.3, ph: 0.1 },
  ];

  async function battle2(opt) {
    opt = opt || {}; const t = opt.t || 0;
    cv.width = 1024; cv.height = 896;
    const S = statics();
    // sky: hazy, bright toward the sun (upper right)
    const g = ctx.createLinearGradient(0, 0, 1024, 420);
    g.addColorStop(0, '#6c8cb4'); g.addColorStop(0.45, '#b4c4d0'); g.addColorStop(0.8, '#f0e6d4'); g.addColorStop(1, '#fff6e6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 460);
    // soft clouds (full-res, painterly: blurred ellipses)
    { const R = rng(3); ctx.save(); ctx.filter = 'blur(14px)';
      for (let i = 0; i < 16; i++) { ctx.fillStyle = `rgba(255,250,240,${0.18 + R() * 0.25})`; ctx.beginPath(); ctx.ellipse(R() * 700, 60 + R() * 200, 80 + R() * 120, 20 + R() * 30, 0, 0, 6.3); ctx.fill(); }
      ctx.restore(); }
    layer(S.far, 5);
    layer(S.left, 2.6);
    layer(S.mid, 2.0);
    // haze band where the ground meets the cliffs
    { const h = ctx.createLinearGradient(0, 330, 0, 470); h.addColorStop(0, 'rgba(250,236,212,0)'); h.addColorStop(0.55, 'rgba(250,236,212,0.55)'); h.addColorStop(1, 'rgba(250,236,212,0)'); ctx.fillStyle = h; ctx.fillRect(0, 330, 1024, 140); }
    { const gc = mk(1024, 896), gx = gc.getContext('2d'); gx.imageSmoothingEnabled = false; gx.drawImage(S.ground, 0, 0, 1024, 896);
      const m = gx.createLinearGradient(0, GROUND_TOP, 0, GROUND_TOP + 60); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      gx.globalCompositeOperation = 'destination-in'; gx.fillStyle = m; gx.fillRect(0, 0, 1024, 896); ctx.drawImage(gc, 0, 0); }
    // actors
    const acts = [];
    PARTY.forEach((p) => acts.push(Object.assign({ foe: false, sc: 1.12 }, p)));
    FOES.forEach((f) => acts.push(Object.assign({ foe: true }, f)));
    acts.forEach((a) => { a.s = scaleAt(a.y); });
    if (opt.act === 'attack') {
      const hero = acts.find((a) => a.id === 'arun');
      hero.pose = SCENES._heroAttack(t);
      hero.pose.br = t * 0.8;
      const hitU = (t - 0.84) / 0.5, wlf = acts.find((a) => a.id === 'wolf');
      if (hitU >= 0 && hitU <= 1) { const k = Math.sin(Math.min(1, hitU * 1.4) * Math.PI); wlf.st = { lunge: -0.9 * k, bite: 0.8 * k }; wlf.flash = hitU < 0.25 ? 0.8 * (1 - hitU / 0.25) : 0; }
      acts.hitU = hitU;
    }
    acts.sort((a, b) => a.y - b.y);
    const rendered = acts.map((a) => [a, spriteFor(a, t)]);
    // long cast shadows (sun upper right → shadows fall lower left) + contact shadows
    for (const [a, r] of rendered) {
      const dx = a.pose ? -a.pose.x * a.s * a.sc * K : 0;
      castShadow(r, a.x + dx, a.y, a.foe ? 0.55 : 0.5);
      ENV.shadow(ctx, a.x + dx, a.y, (a.foe ? 60 : 22) * a.s, (a.foe ? 12 : 6) * a.s, 0.55, [30, 18, 20]);
    }
    for (const [a, r] of rendered) {
      ctx.imageSmoothingEnabled = false;
      ENV.blit(ctx, r, a.x, a.y, K);
      if (a.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a.flash; ENV.blit(ctx, r, a.x, a.y, K); ctx.restore(); }
    }
    if (opt.act === 'attack') {
      const hp = acts.find((a) => a.id === 'arun').pose, hitU = acts.hitU;
      if (hp.smear > 0.05) smear(604 - hp.x * scaleAt(560) * K - 30, 470, hp.smear);
      if (hitU >= 0 && hitU < 0.7) spark(420, 560, hitU / 0.7);
      if (hitU >= 0.05 && hitU < 1.6) { const u = Math.min(1, (hitU - 0.05) / 0.25), fade = hitU > 1.3 ? 1 - (hitU - 1.3) / 0.3 : 1; ctx.save(); ctx.globalAlpha = fade; UI.text(ctx, '128', 400, 470 - Math.sin(u * Math.PI) * 24 - u * 8, { px: 40, w: 700, align: 'center' }); ctx.restore(); }
    }
    // sun: flare + shafts + haze veil from the upper right
    ENV.glow(ctx, SUN[0], SUN[1], 700, [255, 236, 200], 0.55);
    ENV.glow(ctx, SUN[0], SUN[1], 200, [255, 250, 235], 0.8);
    ENV.rays(ctx, SUN[0], SUN[1], [[2.05, 70, 900, 0.16], [2.3, 50, 900, 0.12], [1.85, 60, 800, 0.1], [2.55, 40, 800, 0.08]], [255, 236, 200]);
    { const h = ctx.createLinearGradient(1024, 0, 560, 460); h.addColorStop(0, 'rgba(255,240,215,0.36)'); h.addColorStop(0.5, 'rgba(255,240,215,0.08)'); h.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = h; ctx.fillRect(0, 0, 1024, 896); ctx.restore(); }
    ENV.motes(ctx, 30, [300, 200, 724, 500], [255, 230, 190], 7 + Math.floor(t * 4));
    layer(S.fg, 7, 0, true);
    ENV.post(ctx, { dofTop: [250, 420], dofBot: [770, 890], dofPx: 4.5, bloom: 0.7, thr: 0.6, vig: 0.62,
      grade: { sh: [6, -4, 10], hi: [20, 8, -14], sat: 1.04, con: 1.16, lift: 0 } });
    // bottom-edge warm glow (foreground light bleed)
    ENV.glow(ctx, 760, 900, 300, [255, 190, 130], 0.35);
    if (opt.noUI) return;
    thinUI(opt);
  }
  function smear(x, y, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - 110, y - 90, x - 10, y + 110); g.addColorStop(0, 'rgba(160,220,255,0)'); g.addColorStop(0.5, `rgba(210,240,255,${0.7 * a})`); g.addColorStop(1, `rgba(255,255,255,${0.9 * a})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 130, Math.PI * 0.62, Math.PI * 1.32); ctx.arc(x + 20, y + 8, 110, Math.PI * 1.3, Math.PI * 0.66, true); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function spark(x, y, u) {
    ENV.glow(ctx, x, y, 130 * (1 - u * 0.5), [255, 240, 210], 0.9 * (1 - u));
    const R = rng(3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,248,225,${1 - u})`; ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) { const a = R() * 6.28, r0 = 18 + u * 44, r1 = r0 + 26 + R() * 34 * (1 - u); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- thin, elegant UI ----------
  const F = UI.F;
  function t2(s, x, y, o) { return UI.text(ctx, s, x, y, Object.assign({ sh: false }, o, { shadow: true })); }
  function txt(s, x, y, px, c, w, align) {
    ctx.save(); ctx.font = F(w || 500, px); ctx.textAlign = align || 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillStyle = c || '#f6f2ea'; ctx.fillText(s, x, y); ctx.restore();
  }
  function line(x0, y0, x1, y1, a, w) { ctx.save(); ctx.strokeStyle = `rgba(236,230,214,${a})`; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); }
  function diamond(x, y, r, fill, stroke) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.restore();
  }
  function thinBar(x, y, w, t, c) {
    ctx.save(); ctx.fillStyle = 'rgba(10,10,14,0.55)'; ctx.fillRect(x, y, w, 4);
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]); ctx.fillStyle = g; ctx.fillRect(x, y, Math.max(2, w * t), 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.max(2, w * t), 1); ctx.restore();
  }
  function thinUI(opt) {
    // top rule with target name
    diamond(56, 58, 26, 'rgba(40,52,78,0.55)', 'rgba(236,230,214,0.85)'); diamond(56, 58, 16, null, 'rgba(236,230,214,0.6)');
    line(86, 56, 600, 56, 0.7); line(86, 60, 600, 60, 0.3);
    txt('氷狼', 104, 46, 24, '#f6f2ea', 700);
    // party list (right), translucent fade from the right edge
    const pg = ctx.createLinearGradient(1024, 0, 740, 0); pg.addColorStop(0, 'rgba(12,12,20,0.55)'); pg.addColorStop(1, 'rgba(12,12,20,0)');
    ctx.fillStyle = pg; ctx.fillRect(700, 16, 324, 404);
    const order = ['arun', 'selma', 'sylvan', 'viola'];
    order.forEach((id, i) => {
      const p = PARTY.find((q) => q.id === id), y = 46 + i * 98, x = 790;
      if (i === 0) { diamond(760, y - 8, 11, 'rgba(140,210,230,0.95)', 'rgba(255,255,255,0.9)'); }
      txt(p.row, x, y, 18, p.row === '前' ? '#f0c088' : '#a8d0f0', 700);
      txt(LOOKS2[id].name, x + 26, y, 24, '#fbf8f0', 700);
      line(x, y + 9, 1004, y + 9, 0.35);
      const low = p.hp / p.mhp < 0.25;
      txt('HP', x + 12, y + 36, 16, '#d8d0c0', 700);
      txt(String(p.hp), x + 128, y + 36, 24, low ? '#ffcc66' : '#fbf8f0', 500, 'right'); txt('/ ' + p.mhp, x + 136, y + 36, 17, '#d0c8b8', 500);
      thinBar(x + 10, y + 42, 204, p.hp / p.mhp, low ? ['#b87a2a', '#f0c060'] : ['#4a7a4a', '#9cc48a']);
      txt('MP', x + 12, y + 70, 16, '#d8d0c0', 700);
      txt(String(p.mp), x + 128, y + 70, 24, '#fbf8f0', 500, 'right'); txt('/ ' + p.mmp, x + 136, y + 70, 17, '#d0c8b8', 500);
      thinBar(x + 10, y + 76, 204, p.mp / p.mmp, ['#3a5a82', '#8ab0d8']);
    });
    // command list beside the active hero
    const cx = 500, cy = 236, cmds = ['剣', '術', '防御', '道具'];
    const cg = ctx.createLinearGradient(cx, 0, cx + 150, 0); cg.addColorStop(0, 'rgba(12,12,20,0.62)'); cg.addColorStop(1, 'rgba(12,12,20,0.08)');
    ctx.fillStyle = cg; ctx.fillRect(cx, cy, 150, cmds.length * 40 + 12);
    line(cx, cy, cx + 150, cy, 0.6); line(cx, cy + cmds.length * 40 + 12, cx + 150, cy + cmds.length * 40 + 12, 0.6);
    cmds.forEach((c, i) => { const y = cy + 36 + i * 40; if (i === 0) { ctx.fillStyle = 'rgba(236,230,214,0.16)'; ctx.fillRect(cx + 2, y - 28, 146, 36); diamond(cx + 18, y - 9, 6, '#f0e2b8'); } txt(c, cx + 34, y, 24, i === 0 ? '#fff8e4' : '#e8e2d6', 500); });
    // enemy name tags (thin)
    FOES.forEach((f) => { const y = f.y + 26; line(f.x - 56, y - 18, f.x + 56, y - 18, 0.45); txt(f.name, f.x, y + 4, 18, '#f0ece2', 500, 'center'); });
    // target marker over the wolf
    diamond(360, 462, 9, 'rgba(250,236,190,0.95)', 'rgba(80,60,30,0.8)');
  }

  SCENES.battle2 = battle2;
  SCENES.LOOKS2 = LOOKS2;
  SCENES.STYLE2 = STYLE;
})(window);
