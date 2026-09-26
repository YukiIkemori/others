'use strict';
(function (G) {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const Q = new URLSearchParams(location.search);
  function sheet(scale) {
    const names = Q.get('poses') ? Q.get('poses').split(',') : ['idle', 'step', 'windup', 'slash', 'cast', 'hurt', 'kneel', 'ko', 'victory'];
    const who = Q.get('who') ? Q.get('who').split(',') : Object.keys(RIG.LOOKS);
    const z = +(Q.get('z') || 3), cw = +(Q.get('cw') || 150), rh = +(Q.get('rh') || 210);
    cv.width = Math.max(400, names.length * cw + 40); cv.height = who.length * rh + 40;
    ctx.fillStyle = Q.get('bg') || '#6c7a70'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = scale > 1;
    who.forEach((k, row) => names.forEach((n, col) => {
      const B = new RZ.Builder(); RIG.draw(B, RIG.LOOKS[k], RIG.pose(n));
      const r = RZ.render(B, { scale: scale || 1, ssaa: scale > 1 ? 2 : 1 });
      const s = z / (scale || 1);
      const x = 20 + col * cw + cw / 2, y = 20 + row * rh + rh * 0.85;
      ctx.drawImage(r.canvas, x - r.ox * s, y - r.oy * s, r.canvas.width * s, r.canvas.height * s);
    }));
  }
  function mons() {
    const z = +(Q.get('z') || 4);
    cv.width = 1400; cv.height = 460; ctx.fillStyle = Q.get('bg') || '#6c7a70'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    [['slime', 170], ['wolf', 620], ['goblin', 1150]].forEach(([n, x]) => {
      const B = new RZ.Builder(); MON.draw(n, B, 0, {});
      const r = RZ.render(B, { scale: n === 'goblin' ? 1.15 : 1 });
      ctx.drawImage(r.canvas, x - r.ox * z, 420 - r.oy * z, r.canvas.width * z, r.canvas.height * z);
    });
  }

  // =================== battle ===================
  const K = 2, HZ = 118, FIELD = 303, SPR = 1.3; // world px → screen ×2; horizon; bottom of battlefield (world)
  const CACHE = {};
  const PARTY = [
    { id: 'arun', row: '前', x: 350, y: 170, hp: 417, mhp: 452, mp: 47, mmp: 60, ph: 0.0 },
    { id: 'sylvan', row: '後', x: 424, y: 206, hp: 301, mhp: 330, mp: 38, mmp: 52, ph: 0.35 },
    { id: 'selma', row: '前', x: 362, y: 244, hp: 512, mhp: 540, mp: 22, mmp: 34, ph: 0.6 },
    { id: 'viola', row: '後', x: 438, y: 284, hp: 58, mhp: 268, mp: 86, mmp: 120, ph: 0.8 },
  ];
  const STATUS_ORDER = ['arun', 'selma', 'sylvan', 'viola'];
  const FOES = [
    { id: 'goblin', x: 100, y: 180, sc: 1.1, ph: 0.2 },
    { id: 'wolf', x: 176, y: 238, sc: 1.05, ph: 0.5 },
    { id: 'slime', x: 84, y: 288, sc: 1.2, ph: 0.1 },
  ];

  function meadowLayer() {
    const c = ENV.mk(512, 448), x = c.getContext('2d'), img = x.createImageData(512, 448), D = img.data;
    const gr = RZ.ramp(['#0c2412', '#163c16', '#24561c', '#3a7424', '#5a9230', '#88b440', '#c4d870'], 10);
    const dirt = RZ.ramp(['#2a1c14', '#4a3222', '#6c4c32', '#8e6a46', '#b28c60', '#d8b884'], 8);
    const haze = RZ.hex('#b8d0d8');
    for (let y = HZ; y < 448; y++) {
      const d = Math.min(1, (y - HZ) / (FIELD - HZ)), zf = 0.22 + d;
      const pc = HZ + 74 + (y - HZ) * 0;
      for (let X = 0; X < 512; X++) {
        const n1 = RZ.vnoise(X * 0.05 / zf, y * 0.16 / zf, 11), n2 = RZ.vnoise(X * 0.8 / zf, y * 0.22 / zf, 12), n3 = RZ.vnoise(X * 0.02, y * 0.06, 13);
        let lv = 0.5 + (n1 - 0.5) * 0.55 + (n3 - 0.5) * 0.35;
        // path
        const py = HZ + 62 + Math.sin(X * 0.011 + 0.8) * 16 + (X - 256) * 0.05;
        const hw = 3 + 26 * Math.max(0, Math.min(1, (py - HZ) / (FIELD - HZ))) * (0.8 + 0.4 * RZ.vnoise(X * 0.05, 1, 14));
        const edge = Math.abs(y - py) - hw + (RZ.vnoise(X * 0.3, y * 0.3, 15) - 0.5) * 6;
        let c;
        if (edge < 0) {
          let dl = 0.55 + (RZ.vnoise(X * 0.4 / zf, y * 0.8 / zf, 16) - 0.5) * 0.5 + (edge > -2 ? -0.2 : 0);
          if (RZ.vnoise(X * 0.9, y * 1.4, 17) > 0.82) dl += 0.3;
          c = dirt[RZ.clamp(Math.round(dl * 7), 0, 7)];
        } else c = gr[RZ.clamp(Math.round(lv * 9), 0, 9)];
        c = RZ.mix(c, haze, Math.pow(1 - d, 4) * 0.55);
        const q = (y * 512 + X) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; D[q + 3] = 255;
      }
    }
    // stamp small blade clusters (crisp pixel texture that shrinks with distance)
    const R = RZ.rng(99);
    const put = (X, Y, c) => { if (X < 0 || X >= 512 || Y < HZ || Y >= 448) return; const q = (Y * 512 + X) * 4; D[q] = c[0]; D[q + 1] = c[1]; D[q + 2] = c[2]; };
    for (let i = 0; i < 16000; i++) {
      const Y = Math.floor(HZ + 2 + Math.pow(R(), 0.75) * (448 - HZ)), X = Math.floor(R() * 512);
      const d = Math.min(1, (Y - HZ) / (FIELD - HZ));
      const q = (Y * 512 + X) * 4; const base = [D[q], D[q + 1], D[q + 2]];
      if (base[0] > base[1]) continue; // skip the dirt path
      const h = 1 + Math.round(d * 3 * R()), lighter = R() < 0.55;
      const n = RZ.vnoise(X * 0.05, Y * 0.16, 11);
      const cHi = RZ.mix(base, gr[Math.min(9, 5 + Math.round(n * 4))], 0.8), cLo = RZ.mix(base, gr[1], 0.5);
      for (let k = 0; k < h; k++) put(X + (k === h - 1 && R() < 0.5 ? (R() < 0.5 ? -1 : 1) : 0), Y - k, lighter ? (k === h - 1 ? cHi : RZ.mix(base, cHi, 0.5)) : cLo);
      if (lighter) put(X, Y + 1, cLo);
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function battleStatic() {
    if (CACHE.battle) return CACHE.battle;
    const L = {};
    const R = RZ.rng(7);
    // clouds
    { const c = ENV.mk(512, 448), x = c.getContext('2d');
      [[90, 62, 110], [320, 52, 150], [470, 80, 80], [215, 86, 60]].forEach(([cx, cy, w]) => {
        const B = new RZ.Builder(); ENV.cloud(B, 0, 0, w, R); const r = RZ.render(B, { outline: false, light: { key: [-0.6, -0.7, 0.4], rimC: RZ.hex('#fff0d0') } });
        ENV.blit(x, r, cx, cy, 1);
      }); L.clouds = c; }
    // mountains
    { const c = ENV.mk(512, 448), x = c.getContext('2d');
      ENV.ridge(x, 512, 448, { seed: 3, count: 6, base: HZ + 6, amp: 76, bottom: HZ + 4, ramp: ['#23305a', '#324478', '#44609a', '#6484bc', '#94acd8'], snow: ['#7c88b8', '#a8b6dc', '#dce6f8', '#ffffff'], snowDepth: 22, haze: '#a8c0e0', hazeK: 0.3, hazeBottom: 0.45 });
      L.mtnFar = c;
      const c2 = ENV.mk(512, 448), x2 = c2.getContext('2d');
      ENV.ridge(x2, 512, 448, { seed: 8, count: 9, base: HZ + 8, amp: 36, bottom: HZ + 6, ramp: ['#18302e', '#244840', '#35604c', '#4c7c58', '#78a070'], snow: null, snowDepth: 0, haze: '#9cbcc8', hazeK: 0.25, hazeBottom: 0.3 });
      L.mtnMid = c2; }
    // far treeline
    { const c = ENV.mk(512, 448), x = c.getContext('2d'); const B = new RZ.Builder();
      for (let i = 0; i < 70; i++) { const tx = R() * 540 - 14, ty = HZ + 2 + R() * 7, h = 12 + R() * 14; (R() < 0.6 ? ENV.conifer : ENV.roundTree)(B, tx, ty, h, R, ty); }
      const r = RZ.render(B, { outline: false }); ENV.blit(x, r, 0, 0, 1);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(150,185,200,0.42)'; x.fillRect(0, 0, 512, 448);
      L.trees = c; }
    L.meadow = meadowLayer();
    // side trees (frame) + ground decor
    { const c = ENV.mk(512, 448), x = c.getContext('2d'); const B = new RZ.Builder();
      ENV.conifer(B, 18, 150, 120, R, 150); ENV.roundTree(B, 58, 134, 110, R, 134); ENV.conifer(B, 494, 146, 130, R, 146); ENV.roundTree(B, 470, 132, 96, R, 132);
      ENV.conifer(B, 250, 124, 40, R, 124); ENV.roundTree(B, 290, 126, 34, R, 126);
      const r = RZ.render(B, {}); ENV.blit(x, r, 0, 0, 1);
      // decor
      const D = new RZ.Builder();
      ENV.rock(D, 30, 214, 11, R, 214, true); ENV.rock(D, 492, 236, 9, R, 236, true); ENV.rock(D, 236, 160, 5, R, 160, false); ENV.rock(D, 300, 296, 7, R, 296, true);
      for (let i = 0; i < 60; i++) {
        const y = HZ + 8 + Math.pow(R(), 0.8) * (FIELD - HZ + 10), d = (y - HZ) / (FIELD - HZ), tx = R() * 512;
        const py = HZ + 62 + Math.sin(tx * 0.011 + 0.8) * 16 + (tx - 256) * 0.05; if (Math.abs(y - py) < 3 + 26 * d) continue;
        ENV.tuft(D, tx, y, 3 + d * 6, R, y);
        if (R() < 0.35 && d > 0.2) ENV.flower(D, tx + 3, y + 1, [ENV.EM.petalW, ENV.EM.petalY, ENV.EM.petalP, ENV.EM.petalB][Math.floor(R() * 4)], y + 0.5);
      }
      const r2 = RZ.render(D, {}); ENV.blit(x, r2, 0, 0, 1);
      L.decor = c; }
    // foreground (top-left leaves, bottom grass) – will be blurred
    { const c = ENV.mk(512, 448), x = c.getContext('2d'); const B = new RZ.Builder();
      for (let i = 0; i < 26; i++) { const a = R() * 1.6, rr = 20 + R() * 60; B.ell(-10 + Math.cos(a) * rr * 1.4, -12 + Math.sin(a) * rr * 0.55, 9 + R() * 8, 7 + R() * 6, ENV.EM.leaf, R(), { bulge: 0.8 }); }
      for (let i = 0; i < 16; i++) { const a = R() * 1.4, rr = 10 + R() * 50; B.ell(520 - Math.cos(a) * rr * 1.2, -8 + Math.sin(a) * rr * 0.45, 8 + R() * 7, 6 + R() * 5, ENV.EM.leaf, R(), { bulge: 0.8 }); }
      const r = RZ.render(B, { light: { key: [-0.2, 0.5, 0.8] } }); ENV.blit(x, r, 0, 0, 1);
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(8,20,16,0.45)'; x.fillRect(0, 0, 512, 448); x.globalCompositeOperation = 'source-over';
      const G2 = new RZ.Builder();
      for (let i = 0; i < 22; i++) ENV.tuft(G2, R() * 540 - 14, FIELD + 6 + R() * 6, 16 + R() * 10, R, 1);
      const r2 = RZ.render(G2, {}); ENV.blit(x, r2, 0, 0, 1);
      L.fg = c; }
    return (CACHE.battle = L);
  }

  function drawLayer(c, blur, alpha) {
    ctx.save(); ctx.imageSmoothingEnabled = false; if (blur) ctx.filter = `blur(${blur}px)`; if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(c, 0, 0, 1024, 896); ctx.restore();
  }
  const LIGHT_DAY = { key: [-0.35, -0.62, 0.7], rimC: RZ.hex('#fff2cc'), rimK: 1.1 };

  function actorSprite(a, t, poseOverride) {
    const B = new RZ.Builder();
    if (a.foe) { MON.draw(a.id, B, t + a.ph, a.st || {}); return RZ.render(B, { scale: (a.sc || 1) * SPR, light: LIGHT_DAY }); }
    const p = poseOverride || RIG.pose(a.pose || 'idle', { br: t * 0.8 + a.ph, eyes: (Math.floor((t + a.ph) * 7 + 5) % 23 === 0) ? 0 : 1 });
    RIG.draw(B, RIG.LOOKS[a.id], p);
    return RZ.render(B, { flip: true, light: LIGHT_DAY, scale: SPR });
  }

  // hero attack timeline (seconds). returns {pose, dx}
  function heroAttack(t) {
    const P = RIG.pose;
    const tl = [
      [0.0, P('idle')], [0.25, P('step', { x: -10 })], [0.45, P('step', { x: -95, lN: -0.4, kN: -0.6, lF: 0.5, kF: -0.4 })], [0.62, P('ready', { x: -150 })],
      [0.78, P('windup', { x: -150 })], [0.88, P('slash', { x: -160 })], [1.02, P('follow', { x: -160 })], [1.3, P('follow', { x: -160 })],
      [1.5, P('step', { x: -100, lean: -0.1 })], [1.72, P('step', { x: -20, lean: -0.1, lN: -0.4, kN: -0.6, lF: 0.5, kF: -0.4 })], [1.9, P('idle')],
    ];
    return RIG.sample(tl, t);
  }

  async function battle(opt) {
    opt = opt || {};
    const t = opt.t || 0;
    cv.width = 1024; cv.height = 896;
    const L = battleStatic();
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, HZ * K);
    sky.addColorStop(0, '#2c5ca8'); sky.addColorStop(0.45, '#6ea4dc'); sky.addColorStop(0.85, '#c8def0'); sky.addColorStop(1, '#f6e8cc');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, HZ * K + 20);
    ENV.glow(ctx, 170, 70, 360, [255, 236, 190], 0.55);
    ENV.glow(ctx, 170, 70, 90, [255, 250, 230], 0.9);
    drawLayer(L.clouds, 1.2);
    drawLayer(L.mtnFar, 1.0);
    drawLayer(L.mtnMid, 0.6);
    // low mist band at the horizon
    { const g = ctx.createLinearGradient(0, (HZ - 14) * K, 0, (HZ + 10) * K); g.addColorStop(0, 'rgba(230,240,245,0)'); g.addColorStop(0.6, 'rgba(230,240,245,0.35)'); g.addColorStop(1, 'rgba(230,240,245,0)'); ctx.fillStyle = g; ctx.fillRect(0, (HZ - 14) * K, 1024, 24 * K); }
    drawLayer(L.trees, 0.4);
    drawLayer(L.meadow);
    // sun-dappled patches on the ground
    { const R = RZ.rng(21); ctx.save(); ctx.globalCompositeOperation = 'soft-light';
      for (let i = 0; i < 14; i++) { const x = R() * 1024, y = (HZ + 20 + R() * 170) * K; ENV.shadow(ctx, x, y, 60 + R() * 90, 18 + R() * 20, 0.55, [255, 240, 170]); }
      ctx.restore(); }
    // cast shadows of the framing trees (soft, cool)
    [[40, 152, 70], [470, 150, 70], [60, 138, 60]].forEach(([x, y, r]) => ENV.shadow(ctx, (x + 26) * K, (y + 8) * K, r * K, r * 0.3 * K, 0.35, [10, 26, 30]));
    drawLayer(L.decor);
    // actors: shadows then sprites, depth sorted
    const acts = [];
    PARTY.forEach((p) => acts.push(Object.assign({ foe: false }, p)));
    FOES.forEach((f) => acts.push(Object.assign({ foe: true }, f)));
    let heroPose = null;
    if (opt.act === 'attack') { heroPose = heroAttack(t); }
    if (opt.hurtWolf) { const w = acts.find((a) => a.id === 'wolf'); w.st = { bite: 0.3 }; }
    acts.sort((a, b) => a.y - b.y);
    for (const a of acts) {
      const dx = a.id === 'arun' && heroPose ? -heroPose.x : 0; // pose.x is in model space (flipped)
      const sw = a.foe ? (a.id === 'wolf' ? 44 : a.id === 'slime' ? 22 : 20) : 16;
      ENV.shadow(ctx, (a.x + dx * 0 + (a.id === 'wolf' ? -4 : 0)) * K, (a.y - 1) * K, sw * K, sw * 0.28 * K, 0.5, [14, 30, 20]);
    }
    for (const a of acts) {
      let r;
      if (a.id === 'arun' && heroPose) {
        const B = new RZ.Builder(); RIG.draw(B, RIG.LOOKS.arun, heroPose); r = RZ.render(B, { flip: true, light: LIGHT_DAY, scale: SPR });
      } else r = actorSprite(a, t);
      ctx.imageSmoothingEnabled = false;
      ENV.blit(ctx, r, a.x * K, a.y * K, K);
    }
    // slash smear + hit spark for the attack animation
    if (heroPose && heroPose.smear > 0.05) slashFX(ctx, (356 + heroPose.x * -1 * -1) * K, 176 * K, heroPose.smear);
    if (opt.act === 'attack' && t > 0.86 && t < 1.2) hitFX(ctx, 190 * K, 214 * K, (t - 0.86) / 0.34);
    // sun shafts + motes
    ENV.rays(ctx, 150, -40, [[0.95, 50, 700, 0.12], [1.12, 30, 650, 0.09], [0.78, 40, 600, 0.08]], [255, 240, 200]);
    ENV.motes(ctx, 26, [0, 120, 1024, 460], [255, 240, 190], 5 + Math.floor(t * 4));
    // foreground (blurred, DOF)
    drawLayer(L.fg, 5);
    ENV.post(ctx, { region: [0, 0, 1024, FIELD * K], dofTop: [0, 150], dofBot: [520, 606], dofPx: 3.5, bloom: 0.5, thr: 0.66, vig: 0.5 });
    if (opt.noUI) return;
    const byId = Object.fromEntries(PARTY.map((p) => [p.id, p]));
    UI.battle(ctx, { title: opt.title || '氷狼', actor: 'アルン', cmds: ['剣', '術', '防御', '道具'], sel: 0, cur: 0,
      party: STATUS_ORDER.map((id) => Object.assign({ name: RIG.LOOKS[id].name }, byId[id])) });
    // target cursor over the wolf
    ctx.save(); ctx.translate(176 * K + 14, 146 * K); ctx.rotate(Math.PI / 2); UI.cursor(ctx, 0, 0, 22); ctx.restore();
  }
  function slashFX(c, x, y, a) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.lineWidth = 14 - i * 4; c.strokeStyle = `rgba(${200 + i * 20},${230},255,${0.35 * a})`;
      c.arc(x + 30, y - 40, 90 - i * 6, Math.PI * 0.75, Math.PI * 1.35); c.stroke();
    }
    c.restore();
  }
  function hitFX(c, x, y, u) {
    const R = RZ.rng(3);
    ENV.glow(c, x, y, 140 * (1 - u * 0.5), [255, 240, 200], 0.9 * (1 - u));
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,250,220,${1 - u})`; c.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const a = R() * Math.PI * 2, r0 = 20 + u * 50, r1 = r0 + 30 + R() * 40 * (1 - u); c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); }
    c.restore();
  }

  G.SCENES = { sheet, mons, battle };
  const v = Q.get('view') || 'sheet';
  (async () => {
    try { await document.fonts.load('500 30px ZenMaru'); await document.fonts.load('700 30px ZenMaru');
      const o = Object.fromEntries(Q.entries()); if (o.t) o.t = +o.t; if (v === 'sheet') await G.SCENES.sheet(+(Q.get('scale') || 1)); else await G.SCENES[v](o); document.title = 'done'; }
    catch (e) { console.error(e.stack); document.title = 'err'; }
  })();
})(window);
