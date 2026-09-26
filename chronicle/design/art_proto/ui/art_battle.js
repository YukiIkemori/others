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
  // long soft shadow on the ground; shear > 0 → falls to the lower-left, < 0 → lower-right
  function castShadow(ctx, r, fx, fy, a, shear) {
    const sil = silhouette(r, 'rgb(12,10,24)'), P = 6;
    const bl = mk(sil.width + P * 2, sil.height + P * 2), bx = bl.getContext('2d');
    bx.filter = 'blur(1.6px)'; bx.drawImage(sil, P, P);
    ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
    ctx.setTransform(K, 0, (shear == null ? 1.25 : shear) * K, -0.34 * K, fx, fy);
    ctx.drawImage(bl, -r.ox - P, -r.oy - P); ctx.restore();
  }
  // night light (BRIEF A25): warm key from the party's lantern, cold moon rim from behind
  const NIGHT_FOE = { key: [0.62, -0.35, 0.7], rim: [-0.5, -0.7, -0.5], rimC: hex('#a8c8ff'), rimK: 1.1, mul: [1.0, 0.86, 0.7] };
  const NIGHT_PARTY = { key: [-0.62, -0.35, 0.7], rim: [0.5, -0.7, -0.5], rimC: hex('#a8c8ff'), rimK: 1.1, mul: [1.0, 0.86, 0.7] };
  G.NIGHT_LIGHT = NIGHT_PARTY;
  function spriteFor(a, t) {
    const B = new RZ.Builder();
    if (a.foe) { MON.draw(a.id, B, t + (a.ph || 0), a.st || {}); return RZ.render(B, Object.assign({}, STYLE, { scale: a.sc * a.s, light: NIGHT_FOE, sat: 0.78 })); }
    RIG.draw(B, LOOKS[a.id], a.pose || RIG.pose('idle', { br: t * 0.8 + (a.ph || 0) }));
    return RZ.render(B, Object.assign({}, STYLE, { flip: true, scale: a.sc * a.s, light: NIGHT_PARTY }));
  }
  function lantern(x, y, s) {
    const B = new RZ.Builder();
    const iron = RIG.M.iron, glowM = mat({ keys: ['#ff9a30', '#ffe0a0', '#fffbe8'], n: 3, flat: true, glow: '#ffd070' });
    B.poly([[-5, 0], [5, 0], [4, -2], [-4, -2]], iron, 0, { bevel: 0.8 });
    B.poly([[-4, -2], [4, -2], [4, -13], [-4, -13]], glowM, 0.1, { bevel: 0.2 });
    [-4, 4].forEach((dx) => B.cap(dx, -2, dx, -13, 0.7, 0.7, iron, 0.2));
    B.poly([[-5.5, -13], [5.5, -13], [2.5, -17], [-2.5, -17]], iron, 0.3, { bevel: 1 });
    B.cap(-2.5, -17, 0, -21, 0.5, 0.5, iron, 0.2); B.cap(2.5, -17, 0, -21, 0.5, 0.5, iron, 0.2);
    return RZ.render(B, Object.assign({}, STYLE, { scale: s, light: NIGHT_PARTY }));
  }
  function tinted(c, col, a) {
    const t = mk(c.width, c.height), x = t.getContext('2d'); x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(c, 0, 0);
    if (a) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = a; x.fillRect(0, 0, t.width, t.height); }
    return t;
  }
  // night sky: gradient, stars, aurora curtains, moon + halo, moonlit clouds
  function nightSky(ctx, W, H, o) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05081a'); g.addColorStop(0.45, '#0c1636'); g.addColorStop(0.8, '#1c2a52'); g.addColorStop(1, '#30406a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = rng(o.seed || 5);
    for (let i = 0; i < W * H / 1400; i++) {
      const x = R() * W, y = Math.pow(R(), 1.3) * H, b = R();
      const a = (0.25 + b * 0.75) * (1 - y / H * 0.8);
      ctx.fillStyle = `rgba(${220 + b * 35},${225 + b * 30},255,${a})`;
      const s = b > 0.96 ? 3 : b > 0.8 ? 2 : 1.2; ctx.fillRect(x, y, s, s);
      if (b > 0.985) { ctx.fillStyle = `rgba(230,240,255,${a * 0.6})`; ctx.fillRect(x - 5, y + 1, 12, 1); ctx.fillRect(x + 1, y - 5, 1, 12); }
    }
    // aurora: soft vertical curtains along a wavy band
    if (o.aurora !== false) {
      const au = mk(W, H), ax = au.getContext('2d');
      const band = (t) => H * (o.auroraY || 0.22) + Math.sin(t * 5.2 + 1.1) * H * 0.06 + Math.sin(t * 13) * H * 0.02;
      for (let x = 0; x < W * (o.auroraW || 0.8); x += 3) {
        const t = x / W, y0 = band(t), hgt = H * (0.16 + 0.1 * Math.sin(t * 9 + 2) ** 2);
        const k = Math.pow(Math.sin(Math.PI * Math.min(1, t / (o.auroraW || 0.8))), 1.2) * (0.6 + 0.4 * Math.sin(t * 31) ** 2);
        const gg = ax.createLinearGradient(0, y0 - hgt, 0, y0 + 10);
        gg.addColorStop(0, 'rgba(120,90,220,0)'); gg.addColorStop(0.55, `rgba(80,220,190,${0.22 * k})`); gg.addColorStop(0.92, `rgba(150,255,210,${0.45 * k})`); gg.addColorStop(1, 'rgba(150,255,210,0)');
        ax.fillStyle = gg; ax.fillRect(x, y0 - hgt, 3, hgt + 10);
      }
      ctx.save(); ctx.filter = 'blur(6px)'; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(au, 0, 0); ctx.restore();
    }
    if (o.moon) {
      const [mx, my, mr] = o.moon;
      ENV.glow(ctx, mx, my, mr * 9, [150, 180, 255], 0.35); ENV.glow(ctx, mx, my, mr * 3, [210, 225, 255], 0.5);
      ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fbfcff'); mg.addColorStop(0.7, '#dfe6f6'); mg.addColorStop(1, '#b8c4e0'); ctx.fillStyle = mg; ctx.fill();
      ctx.clip(); const RR = rng(9); ctx.fillStyle = 'rgba(150,160,190,0.35)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(mx + (RR() - 0.5) * mr * 1.4, my + (RR() - 0.5) * mr * 1.4, mr * (0.08 + RR() * 0.18), 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // moonlit clouds
    { const R2 = rng(o.seed ? o.seed + 3 : 8); ctx.save(); ctx.filter = 'blur(10px)';
      for (let i = 0; i < W / 110; i++) { const cx = R2() * W, cy = H * (0.25 + R2() * 0.55), rw = 80 + R2() * 160, rh = 10 + R2() * 18;
        ctx.fillStyle = `rgba(40,52,90,${0.35 + R2() * 0.3})`; ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(170,190,240,${0.1 + R2() * 0.12})`; ctx.beginPath(); ctx.ellipse(cx, cy - rh * 0.6, rw * 0.8, rh * 0.45, 0, 0, 7); ctx.fill(); }
      ctx.restore(); }
  }
  // multiply the lower part by a blue ambient and add warm light pools (lightmap); returns nothing
  function lightmap(ctx, W, H, o) {
    const lm = mk(W, H), lx = lm.getContext('2d');
    const top = o.top || 0;
    const g = lx.createLinearGradient(0, top - (o.feather || 80), 0, top + (o.feather || 80));
    g.addColorStop(0, 'rgb(255,255,255)'); g.addColorStop(1, o.amb);
    lx.fillStyle = g; lx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'lighter';
    for (const L of o.lights) {
      const [x, y, r, c, k] = L, sy = L[5] || 1;
      lx.save(); lx.translate(x, y); lx.scale(1, sy);
      const rg = lx.createRadialGradient(0, 0, 0, 0, 0, r);
      rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${k})`); rg.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${k * 0.55})`); rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      lx.fillStyle = rg; lx.fillRect(-r, -r, r * 2, r * 2); lx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lm, 0, 0); ctx.restore();
  }
  function fireflies(ctx, n, box, seed, cols) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = box[0] + R() * box[2], y = box[1] + R() * box[3], c = cols[Math.floor(R() * cols.length)], r = 2 + R() * 3;
      ENV.glow(ctx, x, y, r * 5, c, 0.3 + R() * 0.35);
      ctx.fillStyle = `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)},0.95)`; ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
    }
  }
  function glowShrooms(ctx, g, n, seed) {
    const R = rng(seed);
    for (let i = 0; i < n; i++) {
      const y = g.GT + 40 + R() * (g.H - g.GT - 60), x = R() * g.W;
      const z = yToZ(g, y), u = (x - g.cx) * z / g.UD * 12, v = z * 12;
      if (1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) > -0.25) continue;
      const s = scaleAt(g, y) * 2;
      const cyan = R() < 0.7;
      const c = cyan ? [110, 240, 230] : [190, 150, 255];
      for (let k = 0; k < 3; k++) {
        const px = Math.round((x + (R() - 0.5) * 16 * s) / K) * K, py = Math.round((y + (R() - 0.5) * 5 * s) / K) * K;
        ctx.fillStyle = 'rgba(40,50,60,0.9)'; ctx.fillRect(px, py - 3 * s, K, 3 * s);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(px - K, py - 4 * s, K * 3, K * 1.5);
        ENV.glow(ctx, px, py - 4 * s, 14 * s, c, 0.45);
      }
    }
  }

  // formation tables (device px on the given stage) — MODERN_UI.md §2.3
  const FORM = {
    wide: {
      party: { arun: [1150, 676], sylvan: [1336, 722], selma: [1232, 790], viola: [1452, 850] },
      foes: [{ id: 'goblin', name: '小鬼の斧兵', x: 330, y: 664, sc: 1.45, ph: 0.2 }, { id: 'wolf', name: '氷狼', x: 660, y: 760, sc: 1.75, ph: 0.5 }, { id: 'slime', name: 'スライム', x: 380, y: 880, sc: 1.45, ph: 0.1 }],
      lantern: [1010, 770], moon: [640, 150, 44], geo: { clearRx: 17, clearU: 0 },
    },
    tall: {
      party: { arun: [700, 800], sylvan: [872, 846], selma: [770, 930], viola: [930, 990] },
      foes: [{ id: 'goblin', name: '小鬼の斧兵', x: 150, y: 792, sc: 1.3, ph: 0.2 }, { id: 'wolf', name: '氷狼', x: 380, y: 880, sc: 1.5, ph: 0.5 }, { id: 'slime', name: 'スライム', x: 170, y: 1000, sc: 1.3, ph: 0.1 }],
      lantern: [600, 900], moon: [300, 150, 40], geo: { sy: 1.25, clearRx: 9, clearU: 0 },
    },
  };

  // render the whole stage (no UI) → {canvas, actors:[{id, foe, x, y, top …}], g}
  function stage(o) {
    o = Object.assign({ W: 1920, H: 1080, layout: 'wide', t: 0, mode: 'cmd', noFoes: false }, o);
    const F = FORM[o.layout], g = geo(o.W, o.H, F.geo);
    const S = statics(g, o.layout + o.W + 'x' + o.H);
    if (!S.night) S.night = { far: tinted(S.far, '#3a4c86', 'rgba(60,80,140,0.25)'), left: tinted(S.left, '#28345e'), mid: tinted(S.mid, '#2c3864') };
    const c = mk(o.W, o.H), ctx = c.getContext('2d');
    const layer = (cc, blur, smooth) => { ctx.save(); ctx.imageSmoothingEnabled = !!smooth; if (blur) ctx.filter = `blur(${blur}px)`; ctx.drawImage(cc, 0, 0, cc.width * K, cc.height * K); ctx.restore(); };
    nightSky(ctx, o.W, 480 * g.sy, { moon: F.moon, auroraY: 0.3, auroraW: 0.75 });
    layer(S.night.far, 4); layer(S.night.left, 2.4); layer(S.night.mid, 1.8);
    { const h = ctx.createLinearGradient(0, 340 * g.sy, 0, 470 * g.sy); h.addColorStop(0, 'rgba(120,140,200,0)'); h.addColorStop(0.55, 'rgba(120,140,200,0.35)'); h.addColorStop(1, 'rgba(120,140,200,0)'); ctx.fillStyle = h; ctx.fillRect(0, 340 * g.sy, o.W, 130 * g.sy); }
    { const gc = mk(o.W, o.H), gx = gc.getContext('2d'); gx.imageSmoothingEnabled = false; gx.drawImage(S.ground, 0, 0, S.ground.width * K, S.ground.height * K);
      const m = gx.createLinearGradient(0, g.GT, 0, g.GT + 60 * g.sy); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
      gx.globalCompositeOperation = 'destination-in'; gx.fillStyle = m; gx.fillRect(0, 0, o.W, o.H); ctx.drawImage(gc, 0, 0); }

    const acts = [];
    for (const id in F.party) acts.push({ id, foe: false, sc: 1.3, x: F.party[id][0], y: F.party[id][1], ph: 0.3 });
    if (!o.noFoes) F.foes.forEach((f) => acts.push(Object.assign({ foe: true }, f)));
    acts.forEach((a) => { a.s = scaleAt(g, a.y); });
    const byId = (id) => acts.find((a) => a.id === id);
    if (o.mode === 'victory') acts.forEach((a) => { if (!a.foe) a.pose = RIG.pose('victory', { br: 0.3 }); });
    if (o.mode === 'cmd') { const h = byId('arun'); h.pose = RIG.pose('ready', { br: 0.2 }); }
    if (o.mode === 'glimmer') {
      const h = byId('arun'); h.pose = RIG.pose('slash', { br: 0.2, smear: 0.9 }); h.x -= 120; h.y += 6;
      const w = byId('wolf'); if (w) { w.st = { lunge: -0.9, bite: 0.8 }; w.flash = 0.55; }
      byId('viola').pose = RIG.pose('cast', { br: 0.4 });
    }
    acts.sort((a, b) => a.y - b.y);
    const rendered = acts.map((a) => [a, spriteFor(a, o.t)]);
    const [lx, ly] = F.lantern;
    for (const [a, r] of rendered) {
      // shadow away from the lantern; length grows with distance
      const d = Math.min(1.6, Math.abs(a.x - lx) / 260 + 0.5);
      castShadow(ctx, r, a.x, a.y, 0.6, (a.x < lx ? 1 : -1) * 1.1 * d);
      ENV.shadow(ctx, a.x, a.y, (a.foe ? 60 : 24) * a.s * (a.foe ? a.sc / 1.55 : 1), (a.foe ? 12 : 6.5) * a.s, 0.6, [12, 10, 22]);
    }
    const lr = lantern(lx, ly, 1.3 * scaleAt(g, ly));
    ENV.shadow(ctx, lx, ly, 18, 5, 0.6, [12, 10, 22]);
    ctx.imageSmoothingEnabled = false; ENV.blit(ctx, lr, lx, ly, K);
    for (const [a, r] of rendered) {
      ctx.imageSmoothingEnabled = false; ENV.blit(ctx, r, a.x, a.y, K);
      if (a.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a.flash; ENV.blit(ctx, r, a.x, a.y, K); ctx.restore(); }
      a.top = a.y - r.oy * K; a.left = a.x - r.ox * K; a.w = r.canvas.width * K; a.h = r.canvas.height * K;
    }
    // lightmap: moon-blue ambient on the ground and actors, the lantern's warm pool
    const lights = [[lx, ly - 20, 820 * g.sy, [255, 205, 140], 0.95, 0.55], [lx, ly - 10, 260 * g.sy, [255, 230, 190], 0.5, 0.6]];
    if (o.mode === 'glimmer') lights.push([byId('wolf').x + 60, byId('wolf').y - 90, 420, [255, 240, 210], 0.8, 0.8]);
    lightmap(ctx, o.W, o.H, { top: g.GT - 20 * g.sy, feather: 60 * g.sy, amb: 'rgb(78,88,140)', lights });
    ENV.glow(ctx, lx, ly - 18, 200 * g.sy, [255, 190, 110], 0.55); ENV.glow(ctx, lx, ly - 18, 40 * g.sy, [255, 240, 200], 0.9);
    if (o.mode === 'glimmer') {
      const h = byId('arun'), w = byId('wolf');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const x = h.x - 70, y = h.y - 120;
      const gg = ctx.createLinearGradient(x - 160, y - 40, x + 40, y + 160); gg.addColorStop(0, 'rgba(160,220,255,0)'); gg.addColorStop(0.5, 'rgba(190,230,255,0.6)'); gg.addColorStop(1, 'rgba(255,255,255,0.85)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y + 40, 150, Math.PI * 0.58, Math.PI * 1.25); ctx.arc(x + 24, y + 48, 128, Math.PI * 1.23, Math.PI * 0.62, true); ctx.closePath(); ctx.fill(); ctx.restore();
      const ix = w.x + 70, iy = w.y - 90;
      ENV.glow(ctx, ix, iy, 220, [200, 230, 255], 0.9);
      { const R = rng(3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 4;
        for (let i = 0; i < 12; i++) { const a = R() * 6.28, r0 = 40, r1 = r0 + 40 + R() * 70; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); ctx.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); ctx.stroke(); }
        // lightning crackle
        ctx.strokeStyle = 'rgba(200,230,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); let px = h.x - 60, py = h.y - 80; ctx.moveTo(px, py);
        for (let i = 0; i < 9; i++) { px += (ix - (h.x - 60)) / 9; py += (iy - (h.y - 80)) / 9 + (R() - 0.5) * 50; ctx.lineTo(px, py); } ctx.stroke();
        ctx.restore(); }
      const v = byId('viola'); ENV.glow(ctx, v.x - 40, v.y - 120, 90, [180, 150, 255], 0.7);
    }
    glowShrooms(ctx, g, Math.round(26 * g.W / 1024), 21);
    fireflies(ctx, Math.round(22 * o.W / 1024), [0, g.GT, o.W, o.H - g.GT - 80], 7, [[255, 200, 110], [140, 240, 220]]);
    layer(tinted(S.fg, '#232b48'), 7, true);
    ENV.post(ctx, { dofTop: [250 * g.sy, 400 * g.sy], dofBot: [(o.H - 126 * g.sy), o.H - 6], dofPx: 4, bloom: 0.7, thr: 0.55, vig: 0.7,
      grade: { sh: [-4, 2, 16], hi: [18, 8, -12], sat: 1.06, con: 1.12, lift: 0 } });
    return { canvas: c, actors: acts, g };
  }

  G.BATTLE_ART = { stage, LOOKS, NPC, LIGHT, NIGHT_PARTY, STYLE, K, nightSky, lightmap, fireflies, tinted, castShadow, lantern };
})(window);
