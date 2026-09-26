// Battle stage for 16:9 (and a portrait crop), reusing the approved round-2 direction
// (design/art_proto/code/scenes2.js → mock2_battle.png): crisp pixel sprites (1 art px = 2 device px),
// perspective ground, layered hazy cliffs, sun flare, long cast shadows, tilt-shift DOF, warm grade.
// Differences from scenes2: the stage size is a parameter (1920×1080, 1080×1300 …), the actor
// formation comes from a per-layout table, sprites are baked a little larger (scale 1.3) so the
// characters keep the same share of the screen height as the approved 8:7 mock.
'use strict';
(function (G) {
  const { mat, hex, mix, clamp, rng, vnoise, ramp } = G.RZ;
  const mk = ENV.mk;
  const K = 2;

  // ---------- cast (same data as scenes2 LOOKS2) ----------
  const cl = (keys, o) => mat(Object.assign({ keys, n: 6, wrap: 0.3, tex: 0.5, tsx: 1.4, tsy: 0.3 }, o));
  const hr = (keys) => mat({ keys, n: 6, sheen: [-0.62, -0.28], wrap: 0.35, amb: 0.22, tex: 1.1, tsx: 0.25, tsy: 1.6 });
  const skin = mat({ keys: ['#46282a', '#84523f', '#bb866a', '#deb496', '#f4d8c0'], n: 6, rim: '#fff0d8', wrap: 0.45, amb: 0.3 });
  const brass = mat({ keys: ['#2e2010', '#5e4424', '#8e7040', '#bca068', '#e8d8a8'], n: 6, metal: true, spec: 1, specPow: 10 });
  const steel = mat({ keys: ['#22262e', '#454c58', '#727a86', '#a4acb4', '#dce0e2'], n: 6, metal: true, spec: 1, specPow: 10 });
  const leather = mat({ keys: ['#221610', '#3e2a1e', '#5c4030', '#7e5c44', '#a07e60'], n: 6, tex: 0.9, tsx: 0.8, tsy: 0.8 });
  const leatherDk = mat({ keys: ['#16100e', '#2a201a', '#40322a', '#58483c'], n: 5 });
  const base = G.RIG.LOOKS;
  const LOOKS = {
    arun: Object.assign({}, base.arun, { skin, hair: hr(['#140c0a', '#261813', '#3a241a', '#523424', '#6e4a32', '#8e6446']),
      top: cl(['#1a1e28', '#2c3444', '#434e62', '#5e6a7e', '#8490a0']), cape: cl(['#1c1014', '#34191e', '#4e262a', '#6c3a38', '#8c5448']),
      trim: brass, pants: cl(['#1c1814', '#302a24', '#48403a', '#625850']), boots: leather, belt: leatherDk, metal: steel,
      eye: mat({ keys: ['#101820', '#243848', '#46687c', '#8cb0c0'], n: 4, flat: true }) }),
    selma: Object.assign({}, base.selma, { skin, hair: hr(['#1a0c0a', '#321410', '#4e2016', '#6c3020', '#8a4430', '#a85e44']),
      top: cl(['#161a14', '#262c22', '#3a4232', '#525a46', '#727a62']), trim: leather, pants: cl(['#181412', '#2a2420', '#403830', '#585048']),
      boots: leatherDk, belt: leather, metal: steel, eye: mat({ keys: ['#101810', '#24382a', '#48684c', '#90b094'], n: 4, flat: true }) }),
    sylvan: Object.assign({}, base.sylvan, { skin, hair: hr(['#22201a', '#3e3a2e', '#5e5844', '#827a5e', '#a69e80', '#c8c2a4']),
      top: cl(['#161a14', '#262e22', '#384430', '#4e5c40', '#6c7a58']), cape: cl(['#14160f', '#22271a', '#343c28', '#4a5438', '#667052']),
      trim: leather, pants: cl(['#1a1812', '#2c2820', '#443e32', '#5e5646']), boots: leather, belt: leatherDk, metal: brass,
      eye: mat({ keys: ['#0e1814', '#1e3a2e', '#3e6a56', '#88b0a0'], n: 4, flat: true }) }),
    viola: Object.assign({}, base.viola, { skin, hair: hr(['#120c16', '#221828', '#34263c', '#4a3a52', '#64526c', '#806c88']),
      top: cl(['#3c3630', '#665e54', '#8e8676', '#b6ae9a', '#d8d0ba']), pants: cl(['#3c3630', '#665e54', '#8e8676', '#b6ae9a']),
      trim: brass, belt: cl(['#1e1622', '#342638', '#4c3a52', '#66526c']), boots: leatherDk, metal: brass,
      eye: mat({ keys: ['#181020', '#382a48', '#66527c', '#a894b8'], n: 4, flat: true }) }),
  };
  LOOKS.arun.name = 'アルン'; LOOKS.selma.name = 'セルマ'; LOOKS.sylvan.name = 'シルヴァン'; LOOKS.viola.name = 'ヴィオラ';
  for (const k in LOOKS) LOOKS[k].headScale = 0.88;
  // townsfolk (field / dialogue)
  function npc(o) {
    const L = Object.assign({}, base.selma, { skin, name: o.name, hairStyle: o.hairStyle || 'bob', circlet: false, weapon: null, armor: null, cape: null, robe: !!o.robe, hood: false, ears: null,
      hair: hr(o.hair), top: cl(o.top), trim: cl(o.trim || ['#5a5046', '#a09280', '#d8ccb4', '#f4ecd8']), belt: cl(o.belt || ['#2a1c14', '#4a3424', '#6a4c36', '#8a6a4e']),
      pants: cl(o.pants || ['#2a2420', '#403830', '#585048', '#70685e']), boots: leatherDk, metal: brass,
      eye: mat({ keys: ['#101820', '#243848', '#46687c', '#8cb0c0'], n: 4, flat: true }) });
    L.headScale = 0.88; return L;
  }
  const NPC = {
    innkeeper: npc({ name: 'ロザンナ', hairStyle: 'bob', robe: true, hair: ['#1a0e08', '#3a2014', '#5e3620', '#84522e', '#a8744a', '#c89868'], top: ['#3a1c1c', '#5c2c2a', '#80403a', '#a45a4e', '#c47e6c'], trim: ['#6a6254', '#a8a090', '#d8d2c2', '#f6f2e8'] }),
    sailor: npc({ name: '船乗り', hairStyle: 'spiky', hair: ['#0c0a0a', '#1e1a18', '#322c28', '#4a423c', '#645a50', '#80766a'], top: ['#10182a', '#1c2a46', '#2e4266', '#4a6288', '#7a92b0'], pants: ['#3a3630', '#5a544a', '#7a7264', '#9a9280'] }),
    girl: npc({ name: '町の子', hairStyle: 'braid', hair: ['#2a1206', '#58280e', '#8a4a1c', '#b87030', '#dc9a4c', '#f4c47a'], top: ['#2a3a1e', '#3e5a2a', '#58783a', '#7a9a50', '#a4c07a'] }),
    merchant: npc({ name: '商人', hairStyle: 'long', robe: true, hair: ['#1a1a1c', '#303036', '#4a4a52', '#66666e', '#8a8a92', '#b0b0b6'], top: ['#2a2212', '#4a3a1c', '#6e5628', '#94763a', '#baa060'] }),
  };

  const STYLE = { tones: 5, sat: 0.9, olMix: 0.82, tint: [6, -2, 10, 10, 4, -8] };
  const LIGHT = { key: [0.2, -0.62, 0.76], rim: [0.9, -0.3, -0.4], rimC: hex('#ffd8a0'), rimK: 1.25, mul: [0.94, 0.88, 0.84] };
  G.ART_LIGHT = LIGHT;

  // ---------- stage geometry (device px) ----------
  function geo(W, H, o) {
    const sy = o.sy || H / 896;
    return { W, H, sy, cx: o.cx != null ? o.cx : W / 2, GT: 392 * sy, HZV: -260 * sy, Z0: 1200 * sy, UD: 520 * sy, clearRx: o.clearRx || 10.5, clearU: o.clearU || -0.5 };
  }
  const yToZ = (g, y) => g.Z0 / (y - g.HZV);
  const scaleAt = (g, y) => (y - g.HZV) / (620 * g.sy - g.HZV);

  function groundLayer(g) {
    const W = Math.ceil(g.W / K), H = Math.ceil(g.H / K), c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data;
    const grass = ramp(['#2a2c18', '#43441f', '#5e5a2a', '#7a7138', '#978a4a', '#b6a664'], 8);
    const dirt = ramp(['#3a2618', '#5a3c24', '#7a5634', '#9a7248', '#b89060', '#d6b27c'], 8);
    const R = rng(4);
    for (let sy = Math.floor(g.GT / K); sy < H; sy++) {
      const y = sy * K + 1, z = yToZ(g, y);
      for (let sx = 0; sx < W; sx++) {
        const u = (sx * K + 1 - g.cx) * z / g.UD * 12, v = z * 12;
        const n1 = vnoise(u * 0.18, v * 0.3, 1), n2 = vnoise(u * 0.7, v * 1.1, 2), n3 = vnoise(u * 2.2, v * 3.4, 3), n4 = vnoise(u * 6, v * 9, 4);
        const far = clamp((v - 14) / 8, 0, 1);
        const clear = 1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) + (n2 - 0.5) * 0.55 + (n3 - 0.5) * 0.2;
        const l = 0.5 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.3 + (n3 - 0.5) * 0.28 * (1 - far * 0.6) + (n4 - 0.5) * 0.22 * (1 - far);
        let c;
        if (clear > 0) c = dirt[clamp(Math.round((l - (clear < 0.08 ? 0.14 : 0)) * 7), 0, 7)];
        else { const bl = vnoise(u * 5, v * 1.2, 7); c = grass[clamp(Math.round((l + (bl - 0.5) * 0.35 * (1 - far) + (clear > -0.08 ? -0.1 : 0)) * 7), 0, 7)]; }
        const ci = Math.floor(u * 1.4), cj = Math.floor(v * 2.2);
        const hh = Math.imul((ci * 73856093) ^ (cj * 19349663), 1274126177) >>> 0, fx = (hh % 1000) / 1000, fz = ((hh >>> 10) % 1000) / 1000;
        if ((hh >>> 22) % 9 === 0) { const dx = u * 1.4 - ci - 0.25 - fx * 0.5, dz = v * 2.2 - cj - 0.25 - fz * 0.5; const d = Math.hypot(dx, dz * 1.3); if (d < 0.2) c = dz < 0 ? [206, 190, 160] : [120, 100, 82]; else if (d < 0.26 && dz > 0) c = mix(c, [40, 26, 20], 0.5); }
        c = mix(c, [236, 216, 184], Math.pow(far, 1.8) * 0.6);
        const q = (sy * W + sx) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; D[q + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    const B = new RZ.Builder();
    const n = Math.round(300 * (g.W / 1024) * (g.H / 896));
    for (let i = 0; i < n; i++) {
      const y = g.GT + 10 + Math.pow(R(), 0.7) * (g.H - g.GT - 10), s = scaleAt(g, y);
      const sx = R() * g.W, z = yToZ(g, y), u = (sx - g.cx) * z / g.UD * 12, v = z * 12;
      if (1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) > -0.12) continue;
      ENV.tuft(B, sx / K, y / K, (3 + R() * 5) * s, R, y);
    }
    const r = RZ.render(B, Object.assign({}, STYLE, { light: LIGHT, sat: 0.45, tint: [10, 4, -6, 16, 8, -10] })); ENV.blit(x, r, 0, 0, 1);
    return c;
  }

  function cliffLayer(g, o) {
    const W = Math.ceil(g.W / K), H = Math.ceil(g.H / K), c = mk(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), D = img.data, R = rng(o.seed);
    const rock = ramp(o.rock, 8), top = ramp(o.top, 6), haze = hex(o.haze);
    const s = g.sy, base = o.base * s;
    const prof = new Float32Array(W);
    for (let i = 0; i < W; i++) {
      const t = i / W; let h = (o.h0 + (o.h1 - o.h0) * Math.pow(t, o.curve || 1)) * s;
      h += (vnoise(i * 0.02, 0, o.seed) - 0.5) * o.amp * s + (vnoise(i * 0.09, 1, o.seed) - 0.5) * o.amp * 0.3 * s;
      prof[i] = Math.round(h / 6) * 6 + (vnoise(i * 0.3, 2, o.seed) - 0.5) * 2;
    }
    for (let i = 0; i < W; i++) for (let y = Math.max(0, Math.floor(base - prof[i])); y < base; y++) {
      const dy = y - (base - prof[i]);
      const band = Math.floor((y + vnoise(i * 0.05, 3, o.seed) * 6) / o.strata);
      const bandT = ((y + vnoise(i * 0.05, 3, o.seed) * 6) % o.strata) / o.strata;
      const block = vnoise(i * 0.12 + band * 3.1, band, o.seed + 4);
      let l = 0.45 + (block - 0.5) * 0.5 + (bandT < 0.22 ? 0.3 : bandT > 0.8 ? -0.25 : 0);
      l += (i - (o.lightX || 0) * (W / 512)) * 0.0004 * (512 / W);
      if (vnoise(i * 0.8, y * 0.05, o.seed + 6) > 0.8) l -= 0.3;
      let col = rock[clamp(Math.round(l * 7), 0, 7)];
      if (dy < 3 || (bandT < 0.12 && vnoise(i * 0.2, band, o.seed + 8) > 0.55)) col = top[clamp(Math.round((0.6 + (vnoise(i * 0.5, y, 9) - 0.5) * 0.6) * 5), 0, 5)];
      col = mix(col, haze, o.hz + (y / base) * (o.hzGrad || 0));
      const q = (y * W + i) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    if (o.trees) {
      const B = new RZ.Builder();
      const nt = Math.round(o.trees * W / 512);
      for (let k = 0; k < nt; k++) { const i = Math.floor(R() * W), y = base - prof[i] + 2; ENV.conifer(B, i, y, 10 + R() * 14 * (o.treeS || 1), R, y); }
      const r = RZ.render(B, { outline: false, light: LIGHT, sat: 0.7 }); ENV.blit(x, r, 0, 0, 1);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = ENV.rgba(haze, o.hz * 0.9); x.fillRect(0, 0, W, H);
    }
    return c;
  }

  const statCache = {};
  function statics(g, key) {
    if (statCache[key]) return statCache[key];
    const s = {};
    const mirror = g.W / g.H < 1.2; // portrait: the big mid cliff is pulled toward the centre
    s.far = cliffLayer(g, { seed: 11, base: 206, h0: 70, h1: 40, amp: 50, strata: 7, rock: ['#6c5a58', '#7e6a64', '#927c70', '#a88e7c', '#bca08a'], top: ['#6a6a4a', '#7e7c56', '#948e62'], haze: '#e8dcc8', hz: 0.55, trees: 40, treeS: 0.6 });
    s.mid = cliffLayer(g, { seed: 12, base: 214, h0: 40, h1: mirror ? 150 : 190, curve: mirror ? 1.3 : 1.8, amp: 40, strata: 9, lightX: 480, rock: ['#2c2020', '#4a3430', '#664a3e', '#86624e', '#a67e62', '#c49c78'], top: ['#3c4222', '#56602e', '#707a3c', '#8c9450'], haze: '#e0cdb0', hz: 0.08, hzGrad: 0.1, trees: 26 });
    s.left = cliffLayer(g, { seed: 13, base: 212, h0: 92, h1: 10, curve: 0.5, amp: 30, strata: 8, rock: ['#2a2224', '#44383a', '#5e4e4c', '#7a6660', '#968076'], top: ['#3a4424', '#526030', '#6a783e'], haze: '#d8d4cc', hz: 0.2, trees: 18 });
    s.ground = groundLayer(g);
    { const c = mk(Math.ceil(g.W / K), Math.ceil(g.H / K)), x = c.getContext('2d'), B = new RZ.Builder(), R = rng(31), W = g.W / K, Hh = g.H / K;
      const nr = Math.round(9 * W / 512);
      for (let i = 0; i < nr; i++) ENV.rock(B, R() * (W + 28) - 10, Hh + 4 + R() * 8, 18 + R() * 22, R, 450 + i, R() < 0.5);
      for (let i = 0; i < nr * 1.5; i++) ENV.tuft(B, R() * (W + 8), Hh, 16 + R() * 16, R, 460);
      const r = RZ.render(B, Object.assign({}, STYLE, { light: LIGHT })); ENV.blit(x, r, 0, 0, 1); s.fg = c; }
    return (statCache[key] = s);
  }

  function silhouette(r, col) {
    const c = mk(r.canvas.width, r.canvas.height), x = c.getContext('2d');
    x.drawImage(r.canvas, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c;
  }
  function castShadow(ctx, r, fx, fy, a) {
    const sil = silhouette(r, 'rgb(34,20,26)'), P = 6;
    const bl = mk(sil.width + P * 2, sil.height + P * 2), bx = bl.getContext('2d');
    bx.filter = 'blur(1.6px)'; bx.drawImage(sil, P, P);
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
    ctx.setTransform(K, 0, 1.25 * K, -0.34 * K, fx, fy);
    ctx.drawImage(bl, -r.ox - P, -r.oy - P); ctx.restore();
  }
  function spriteFor(a, t) {
    const B = new RZ.Builder();
    if (a.foe) { MON.draw(a.id, B, t + (a.ph || 0), a.st || {}); return RZ.render(B, Object.assign({}, STYLE, { scale: a.sc * a.s, light: LIGHT, sat: 0.78 })); }
    RIG.draw(B, LOOKS[a.id], a.pose || RIG.pose('idle', { br: t * 0.8 + (a.ph || 0) }));
    return RZ.render(B, Object.assign({}, STYLE, { flip: true, scale: a.sc * a.s, light: LIGHT }));
  }

  // formation tables (device px on the given stage) — MODERN_UI.md §2.3
  const FORM = {
    wide: {
      party: { arun: [1150, 676], sylvan: [1336, 722], selma: [1232, 790], viola: [1452, 850] },
      foes: [{ id: 'goblin', name: '小鬼の斧兵', x: 330, y: 664, sc: 1.45, ph: 0.2 }, { id: 'wolf', name: '氷狼', x: 660, y: 760, sc: 1.75, ph: 0.5 }, { id: 'slime', name: 'スライム', x: 380, y: 880, sc: 1.45, ph: 0.1 }],
      sun: [1700, 70], geo: { clearRx: 17, clearU: 0 },
    },
    tall: {
      party: { arun: [700, 800], sylvan: [872, 846], selma: [770, 930], viola: [930, 990] },
      foes: [{ id: 'goblin', name: '小鬼の斧兵', x: 150, y: 792, sc: 1.3, ph: 0.2 }, { id: 'wolf', name: '氷狼', x: 380, y: 880, sc: 1.5, ph: 0.5 }, { id: 'slime', name: 'スライム', x: 170, y: 1000, sc: 1.3, ph: 0.1 }],
      sun: [960, 60], geo: { sy: 1.25, clearRx: 9, clearU: 0 },
    },
  };

  // render the whole stage (no UI) → {canvas, actors:[{id, foe, x, y, head, name}], g}
  function stage(o) {
    o = Object.assign({ W: 1920, H: 1080, layout: 'wide', t: 0, mode: 'cmd', noFoes: false }, o);
    const F = FORM[o.layout], g = geo(o.W, o.H, F.geo);
    const S = statics(g, o.layout + o.W + 'x' + o.H);
    const c = mk(o.W, o.H), ctx = c.getContext('2d');
    const layer = (cc, blur, smooth) => { ctx.save(); ctx.imageSmoothingEnabled = !!smooth; if (blur) ctx.filter = `blur(${blur}px)`; ctx.drawImage(cc, 0, 0, cc.width * K, cc.height * K); ctx.restore(); };
    const sun = F.sun;
    const gr = ctx.createLinearGradient(0, 0, o.W, 420 * g.sy);
    gr.addColorStop(0, '#6c8cb4'); gr.addColorStop(0.45, '#b4c4d0'); gr.addColorStop(0.8, '#f0e6d4'); gr.addColorStop(1, '#fff6e6');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, o.W, 470 * g.sy);
    { const R = rng(3); ctx.save(); ctx.filter = 'blur(14px)';
      for (let i = 0; i < 16 * o.W / 1024; i++) { ctx.fillStyle = `rgba(255,250,240,${0.18 + R() * 0.25})`; ctx.beginPath(); ctx.ellipse(R() * o.W * 0.72, (60 + R() * 200) * g.sy, 80 + R() * 120, 20 + R() * 30, 0, 0, 6.3); ctx.fill(); }
      ctx.restore(); }
    layer(S.far, 5); layer(S.left, 2.6); layer(S.mid, 2.0);
    { const h = ctx.createLinearGradient(0, 330 * g.sy, 0, 470 * g.sy); h.addColorStop(0, 'rgba(250,236,212,0)'); h.addColorStop(0.55, 'rgba(250,236,212,0.55)'); h.addColorStop(1, 'rgba(250,236,212,0)'); ctx.fillStyle = h; ctx.fillRect(0, 330 * g.sy, o.W, 140 * g.sy); }
    { const gc = mk(o.W, o.H), gx = gc.getContext('2d'); gx.imageSmoothingEnabled = false; gx.drawImage(S.ground, 0, 0, S.ground.width * K, S.ground.height * K);
      const m = gx.createLinearGradient(0, g.GT, 0, g.GT + 60 * g.sy); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      gx.globalCompositeOperation = 'destination-in'; gx.fillStyle = m; gx.fillRect(0, 0, o.W, o.H); ctx.drawImage(gc, 0, 0); }
    ENV.glow(ctx, sun[0], sun[1], 700 * g.sy, [255, 236, 200], 0.55);
    ENV.glow(ctx, sun[0], sun[1], 200 * g.sy, [255, 250, 235], 0.8);
    ENV.rays(ctx, sun[0], sun[1], [[2.05, 70, 900, 0.16], [2.3, 50, 900, 0.12], [1.85, 60, 800, 0.1], [2.55, 40, 800, 0.08]].map((r) => [r[0], r[1] * g.sy, r[2] * g.sy, r[3]]), [255, 236, 200]);
    { const h = ctx.createLinearGradient(o.W, 0, o.W - 460 * g.sy, 460 * g.sy); h.addColorStop(0, 'rgba(255,240,215,0.36)'); h.addColorStop(0.5, 'rgba(255,240,215,0.08)'); h.addColorStop(1, 'rgba(255,240,215,0)');
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = h; ctx.fillRect(0, 0, o.W, o.H); ctx.restore(); }

    const acts = [];
    for (const id in F.party) acts.push({ id, foe: false, sc: 1.3, x: F.party[id][0], y: F.party[id][1], ph: Math.random() });
    if (!o.noFoes) F.foes.forEach((f) => acts.push(Object.assign({ foe: true }, f)));
    acts.forEach((a) => { a.s = scaleAt(g, a.y); });
    const byId = (id) => acts.find((a) => a.id === id);
    if (o.mode === 'victory') acts.forEach((a) => { if (!a.foe) a.pose = RIG.pose('victory', { br: 0.3 }); });
    if (o.mode === 'cmd') { const h = byId('arun'); h.pose = RIG.pose('ready', { br: 0.2 }); }
    if (o.mode === 'glimmer') {
      const h = byId('arun'); h.pose = RIG.pose('slash', { br: 0.2, smear: 0.9 }); h.x += 60; h.y += 6;
      const w = byId('wolf'); if (w) { w.st = { lunge: -0.9, bite: 0.8 }; w.flash = 0.55; }
      byId('viola').pose = RIG.pose('cast', { br: 0.4 });
    }
    acts.sort((a, b) => a.y - b.y);
    const rendered = acts.map((a) => [a, spriteFor(a, o.t)]);
    for (const [a, r] of rendered) {
      castShadow(ctx, r, a.x, a.y, a.foe ? 0.55 : 0.5);
      ENV.shadow(ctx, a.x, a.y, (a.foe ? 60 : 24) * a.s * (a.foe ? a.sc / 1.55 : 1), (a.foe ? 12 : 6.5) * a.s, 0.55, [30, 18, 20]);
    }
    for (const [a, r] of rendered) {
      ctx.imageSmoothingEnabled = false; ENV.blit(ctx, r, a.x, a.y, K);
      if (a.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a.flash; ENV.blit(ctx, r, a.x, a.y, K); ctx.restore(); }
      a.top = a.y - r.oy * K; a.left = a.x - r.ox * K; a.w = r.canvas.width * K; a.h = r.canvas.height * K;
    }
    if (o.mode === 'glimmer') {
      const h = byId('arun'), w = byId('wolf');
      // blade smear + impact
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const x = h.x - 70, y = h.y - 120;
      const gg = ctx.createLinearGradient(x - 160, y - 40, x + 40, y + 160); gg.addColorStop(0, 'rgba(160,220,255,0)'); gg.addColorStop(0.5, 'rgba(210,240,255,0.6)'); gg.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y + 40, 150, Math.PI * 0.58, Math.PI * 1.25); ctx.arc(x + 24, y + 48, 128, Math.PI * 1.23, Math.PI * 0.62, true); ctx.closePath(); ctx.fill(); ctx.restore();
      const ix = w.x + 70, iy = w.y - 90;
      ENV.glow(ctx, ix, iy, 220, [255, 240, 210], 0.9);
      { const R = rng(3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,248,225,0.85)'; ctx.lineWidth = 4;
        for (let i = 0; i < 12; i++) { const a = R() * 6.28, r0 = 40, r1 = r0 + 40 + R() * 70; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); ctx.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); ctx.stroke(); }
        ctx.restore(); }
      // Viola's spell glow
      const v = byId('viola'); ENV.glow(ctx, v.x - 40, v.y - 120, 90, [200, 170, 255], 0.6);
    }
    ENV.motes(ctx, Math.round(30 * o.W / 1024), [o.W * 0.28, 200 * g.sy, o.W * 0.6, 500 * g.sy], [255, 230, 190], 7);
    layer(S.fg, 7, true);
    ENV.post(ctx, { dofTop: [250 * g.sy, 420 * g.sy], dofBot: [(o.H - 126 * g.sy), o.H - 6], dofPx: 4.5, bloom: 0.55, thr: 0.7, vig: 0.55,
      grade: { sh: [6, -4, 10], hi: [20, 8, -14], sat: 1.04, con: 1.16, lift: 0 } });
    ENV.glow(ctx, o.W * 0.74, o.H + 4, 300 * g.sy, [255, 190, 130], 0.35);
    return { canvas: c, actors: acts, g };
  }

  G.BATTLE_ART = { stage, LOOKS, NPC, LIGHT, STYLE, K };
})(window);
