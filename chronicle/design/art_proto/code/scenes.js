'use strict';
(function (G) {
  const cv = document.getElementById('screen'), ctx = cv.getContext('2d');
  const Q = new URLSearchParams(location.search);
  const mat = RZ.mat;
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

  let SMOOTH = false;
  function drawLayer(c, blur, alpha) {
    ctx.save(); ctx.imageSmoothingEnabled = SMOOTH; ctx.imageSmoothingQuality = 'high'; if (blur) ctx.filter = `blur(${blur}px)`; if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(c, 0, 0, 1024, 896); ctx.restore();
  }
  const LIGHT_DAY = { key: [-0.35, -0.62, 0.7], rimC: RZ.hex('#fff2cc'), rimK: 1.1 };

  function rs(B, o) { if (!SMOOTH) return RZ.render(B, o); const r = RZ.render(B, Object.assign({}, o, { scale: o.scale * K, ssaa: 2 })); r.k = 1; return r; }
  function actorSprite(a, t, poseOverride) {
    const B = new RZ.Builder();
    if (a.foe) { MON.draw(a.id, B, t + a.ph, a.st || {}); return rs(B, { scale: (a.sc || 1) * SPR, light: LIGHT_DAY }); }
    const p = poseOverride || RIG.pose(a.pose || 'idle', { br: t * 0.8 + a.ph, eyes: (Math.floor((t + a.ph) * 7 + 5) % 23 === 0) ? 0 : 1 });
    RIG.draw(B, RIG.LOOKS[a.id], p);
    return rs(B, { flip: true, light: LIGHT_DAY, scale: SPR });
  }

  // hero attack timeline (seconds). returns {pose, dx}
  function heroAttack(t) {
    const P = RIG.pose;
    const tl = [
      [0.0, P('idle')], [0.22, P('step', { x: 6 })], [0.4, P('step', { x: 36, lN: -0.4, kN: -0.6, lF: 0.5, kF: -0.4 })], [0.56, P('ready', { x: 64 })],
      [0.74, P('windup', { x: 66 })], [0.84, P('slash', { x: 74 })], [0.98, P('follow', { x: 74 })], [1.28, P('follow', { x: 74 })],
      [1.46, P('step', { x: 44, lean: -0.1 })], [1.66, P('step', { x: 12, lean: -0.1, lN: -0.4, kN: -0.6, lF: 0.5, kF: -0.4 })], [1.84, P('idle')],
    ];
    return RIG.sample(tl, t);
  }

  async function battle(opt) {
    opt = opt || {};
    const t = opt.t || 0;
    SMOOTH = !!opt.smooth;
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
    let hitU = -1;
    if (opt.act === 'attack') {
      hitU = (t - 0.84) / 0.5;
      const wlf = acts.find((a) => a.id === 'wolf');
      if (hitU >= 0 && hitU <= 1) { const k = Math.sin(Math.min(1, hitU * 1.4) * Math.PI); wlf.st = { lunge: -0.9 * k, bite: 0.8 * k }; wlf.flash = hitU < 0.25 ? 0.8 * (1 - hitU / 0.25) : 0; wlf.shake = hitU < 0.4 ? Math.sin(t * 90) * 2 : 0; }
    }
    acts.sort((a, b) => a.y - b.y);
    for (const a of acts) {
      const dx = a.id === 'arun' && heroPose ? -heroPose.x : 0; // pose.x is in model space (flipped)
      const sw = a.foe ? (a.id === 'wolf' ? 44 : a.id === 'slime' ? 22 : 20) : 16;
      const hx = a.id === 'arun' && heroPose ? a.x - heroPose.x * SPR : a.x;
      ENV.shadow(ctx, (hx + (a.id === 'wolf' ? -4 : 0)) * K, (a.y - 1) * K, sw * K, sw * 0.28 * K, 0.5, [14, 30, 20]);
    }
    for (const a of acts) {
      let r;
      if (a.id === 'arun' && heroPose) {
        const B = new RZ.Builder(); RIG.draw(B, RIG.LOOKS.arun, heroPose); r = rs(B, { flip: true, light: LIGHT_DAY, scale: SPR });
      } else r = actorSprite(a, t);
      ctx.imageSmoothingEnabled = false;
      const ox = (a.shake || 0), kk = r.k || K;
      ENV.blit(ctx, r, (a.x + ox) * K, a.y * K, kk);
      if (a.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a.flash; ENV.blit(ctx, r, (a.x + ox) * K, a.y * K, kk); ENV.blit(ctx, r, (a.x + ox) * K, a.y * K, kk); ctx.restore(); }
    }
    // slash smear + hit spark for the attack animation
    if (heroPose && heroPose.smear > 0.05) slashFX(ctx, (350 - heroPose.x * SPR - 18) * K, 128 * K, heroPose.smear);
    if (hitU >= 0 && hitU < 0.7) hitFX(ctx, 214 * K, 196 * K, hitU / 0.7);
    if (hitU >= 0.05 && hitU < 1.6) { const u = Math.min(1, (hitU - 0.05) / 0.25), fade = hitU > 1.3 ? 1 - (hitU - 1.3) / 0.3 : 1;
      ctx.save(); ctx.globalAlpha = fade; UI.text(ctx, '128', 206 * K, 150 * K - Math.sin(u * Math.PI) * 26 - u * 8, { px: 44, w: 700, c: '#ffffff', align: 'center' }); ctx.restore(); }
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
    // crescent smear: filled lune between two arcs, additive
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(x - 120, y - 100, x - 20, y + 120); g.addColorStop(0, `rgba(160,220,255,0)`); g.addColorStop(0.5, `rgba(200,240,255,${0.75 * a})`); g.addColorStop(1, `rgba(255,255,255,${0.95 * a})`);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 150, Math.PI * 0.62, Math.PI * 1.32); c.arc(x + 22, y + 8, 128, Math.PI * 1.3, Math.PI * 0.66, true); c.closePath(); c.fill();
    c.restore();
  }
  function hitFX(c, x, y, u) {
    const R = RZ.rng(3);
    ENV.glow(c, x, y, 140 * (1 - u * 0.5), [255, 240, 200], 0.9 * (1 - u));
    c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,250,220,${1 - u})`; c.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const a = R() * Math.PI * 2, r0 = 20 + u * 50, r1 = r0 + 30 + R() * 40 * (1 - u); c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); }
    c.restore();
  }


  // =================== town (night) ===================
  function lightmap(amb, lights, extra) {
    const c = ENV.mk(1024, 896), x = c.getContext('2d');
    x.fillStyle = `rgb(${amb.join(',')})`; x.fillRect(0, 0, 1024, 896);
    x.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const g = x.createRadialGradient(l.x * K, l.y * K, 0, l.x * K, l.y * K, l.r * K);
      const c0 = l.c.map((v) => v * l.i | 0);
      g.addColorStop(0, `rgba(${c0.join(',')},1)`); g.addColorStop(0.35, `rgba(${c0.join(',')},0.55)`); g.addColorStop(1, `rgba(${c0.join(',')},0)`);
      x.save(); if (l.sy) { x.translate(l.x * K, l.y * K); x.scale(1, l.sy); x.translate(-l.x * K, -l.y * K); }
      x.fillStyle = g; x.fillRect(0, 0, 1024, 896 / (l.sy || 1) * 2); x.restore();
    }
    if (extra) extra(x);
    return c;
  }
  function castShadow(c, x, y, lx, ly, len, w, a) {
    const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    c.save(); c.translate(x * K, y * K); c.rotate(Math.atan2(uy, ux));
    const L = len * K * (0.6 + Math.min(1.2, 60 / d));
    const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, `rgba(8,8,20,${a})`); g.addColorStop(1, 'rgba(8,8,20,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(L * 0.45, 0, L * 0.55, w * K, 0, 0, Math.PI * 2); c.fill(); c.restore();
  }

  async function town(opt) {
    opt = opt || {}; const t = opt.t || 0;
    cv.width = 1024; cv.height = 896;
    const wc = ENV.mk(512, 448), w = wc.getContext('2d');
    const px = new PLACES.PX(w);
    // distant roofs/trees behind (night sky gradient)
    px.fill(0, 0, 512, 180, (x, y) => y < 60 ? RZ.mix(RZ.hex('#0a1030'), RZ.hex('#243a6a'), y / 60) : null);
    // alleys between houses: receding dark walls + ground
    PLACES.blocks(px, 160, 40, 200, 180, { rh: 6, bw: 9, keys: ['#0c0c14', '#1a1a24', '#2a2a36', '#3a3a48'], mortar: '#060608', seed: 30 });
    PLACES.blocks(px, 330, 40, 370, 180, { rh: 6, bw: 9, keys: ['#0c0c14', '#1a1a24', '#2a2a36', '#3a3a48'], mortar: '#060608', seed: 31 });
    PLACES.cobbles(px, 0, 176, 512, 448, { keys: ['#24222a', '#403d46', '#5e5a62', '#827c7a', '#aaa294'], mortar: '#141218', seed: 4, tint: '#7a5a48', cw: 10, ch: 7 });
    PLACES.blocks(px, 0, 176, 512, 196, { rh: 10, bw: 18, keys: ['#2a282e', '#4a4850', '#6c6a6e', '#908c88', '#b4ae a0'.replace(' ', '')], mortar: '#18161c', seed: 9 });
    const emit = [];
    PLACES.house(px, { x0: 6, x1: 170, yb: 178, wall: 84, roof: 62, seed: 1, chimney: true, windows: [[22, 112, 18, 22], [124, 112, 18, 22]], door: [70, 24, 42], posts: [6, 58, 108, 166], braces: [[10, 54], [112, 162]], emit });
    PLACES.house(px, { x0: 188, x1: 340, yb: 178, wall: 92, roof: 56, seed: 2, slate: true, windows: [[202, 106, 18, 24], [306, 106, 18, 24], [255, 100, 22, 14]], door: [252, 30, 46], posts: [188, 238, 290, 336], emit });
    PLACES.house(px, { x0: 358, x1: 520, yb: 178, wall: 80, roof: 66, seed: 3, chimney: true, windows: [[378, 116, 18, 22], [470, 116, 18, 22]], door: [420, 24, 40], posts: [358, 408, 458, 516], braces: [[362, 404], [462, 512]], emit });
    // low stone wall in the foreground
    PLACES.blocks(px, 0, 404, 512, 448, { rh: 9, bw: 16, keys: ['#1e1c22', '#3a3840', '#5a5860', '#7e7a78', '#a09a8e'], mortar: '#121016', seed: 12, moss: RZ.ramp(['#1a2a14', '#34521e', '#56782c', '#86a444'], 5) });
    px.done();
    const R = RZ.rng(5);
    // props (rasterized, lit later by the light map)
    const B = new RZ.Builder();
    PLACES.prop(B, 'barrel', 150, 206); PLACES.prop(B, 'barrel', 164, 214); PLACES.prop(B, 'crate', 348, 212); PLACES.prop(B, 'crate', 360, 226);
    PLACES.prop(B, 'planter', 32, 190); PLACES.prop(B, 'planter', 136, 190); PLACES.prop(B, 'planter', 478, 192);
    PLACES.prop(B, 'lamp', 196, 262); PLACES.prop(B, 'lamp', 430, 330);
    PLACES.prop(B, 'sign', 318, 124);
    ENV.roundTree(B, 486, 410, 120, R, 410);
    for (let i = 0; i < 16; i++) ENV.tuft(B, R() * 512, 404 + R() * 4, 7 + R() * 6, R, 405);
    const pr = RZ.render(B, {}); ENV.blit(w, pr, 0, 0, 1);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(wc, 0, 0, 1024, 896);
    // light map: moonlit blue ambient + lamps + window spill
    const flick = 1 + Math.sin(t * 17) * 0.03 + Math.sin(t * 29) * 0.02;
    const lamps = [{ x: 201, y: 218, r: 150, c: [255, 170, 90], i: 1.0 * flick }, { x: 435, y: 286, r: 140, c: [255, 170, 90], i: 0.95 * flick }];
    const spill = emit.map(([x, y, ww]) => ({ x, y: 196, r: 46 + ww, c: [255, 160, 80], i: 0.55, sy: 0.6 }));
    const winGlow = emit.map(([x, y, ww]) => ({ x, y, r: 22 + ww * 0.6, c: [255, 180, 90], i: 0.8 }));
    const LM = lightmap([62, 74, 124], lamps.concat(spill, winGlow));
    // prop shadows (from the nearest lamp) before multiplying
    const nearestLamp = (x, y) => lamps.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
    [[150, 206, 7], [164, 214, 7], [348, 212, 9], [360, 226, 9], [486, 410, 20]].forEach(([x, y, s]) => { const l = nearestLamp(x, y); castShadow(ctx, x, y, l.x, l.y + 40, s * 3, s * 0.7, 0.55); });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(LM, 0, 0); ctx.restore();
    // actors lit by the lamps (point lights on normals) + contact & cast shadows
    const amb = [0.36, 0.42, 0.66];
    const pl = lamps.map((l) => ({ x: l.x, y: l.y - 30, z: 30, r: l.r * 1.1, c: [1.0, 0.72, 0.42], i: 1.3 }));
    const light = { mul: amb, pts: pl, rimC: RZ.hex('#ffc070'), rimK: 1.2, key: [-0.2, -0.6, 0.75] };
    const hero = { L: RIG.LOOKS.arun, x: 246, y: 292, p: RIG.pose('step', { br: t, aN: 0.2, eN: 0.3, w: 0.4, lean: 0.08, cape: 0.3, lN: 0.35, kN: -0.3, lF: -0.3, kF: -0.25 }) };
    const npc = { L: PLACES.npcLook(), x: 298, y: 286, p: RIG.pose('idle', { br: t + 0.4, aN: 0.2, eN: 1.4, aF: 0.1, eF: 1.3, lean: -0.02, flip: true, mouth: 2 }) };
    const comp = { L: RIG.LOOKS.viola, x: 214, y: 300, p: RIG.pose('step', { br: t + 0.2, aN: 0.3, eN: 0.5, w: 2.4, lN: -0.3, kN: -0.3, lF: 0.3, kF: -0.25 }) };
    [comp, hero, npc].sort((a, b) => a.y - b.y).forEach((a) => {
      const l = nearestLamp(a.x, a.y);
      castShadow(ctx, a.x, a.y, l.x, l.y + 40, 30, 7, 0.5);
      ENV.shadow(ctx, a.x * K, a.y * K, 30, 8, 0.6, [6, 6, 16]);
    });
    [comp, hero, npc].sort((a, b) => a.y - b.y).forEach((a) => { const r = PLACES.actor(a.L, a.p, a.x, a.y, light, 1.15); ENV.blit(ctx, r, a.x * K, a.y * K, K); });
    // festival string lights across the street (catenary, glowing bulbs)
    [[[-10, 118], [520, 124], 34], [[-10, 150], [520, 142], 22]].forEach(([a, b, sag], j) => {
      ctx.save(); ctx.strokeStyle = 'rgba(20,14,10,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
      const P = (u) => [(a[0] + (b[0] - a[0]) * u) * K, (a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag) * K];
      for (let u = 0; u <= 1.001; u += 0.02) { const q = P(u); u ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); ctx.restore();
      for (let u = 0.03; u < 1; u += 0.045) { const q = P(u); const c = [[255, 200, 110], [255, 150, 90], [255, 230, 160]][Math.floor(u * 40 + j) % 3]; ENV.glow(ctx, q[0], q[1] + 5, 26, c, 0.55); ctx.fillStyle = `rgb(${c.join(',')})`; ctx.fillRect(q[0] - 2, q[1] + 2, 4, 5); }
    });
    // emissive: windows + lamp flames + moths
    emit.forEach(([x, y, ww]) => ENV.glow(ctx, x * K, y * K, ww * 3.2, [255, 190, 110], 0.5));
    lamps.forEach((l) => { ENV.glow(ctx, l.x * K, (l.y - 0) * K, 70, [255, 220, 150], 0.9 * flick); ENV.glow(ctx, l.x * K, l.y * K, 260, [255, 160, 80], 0.28 * flick); });
    ENV.motes(ctx, 10, [330, 360, 140, 140], [255, 210, 150], 3);
    ENV.motes(ctx, 8, [340, 480, 120, 140], [255, 210, 150], 8);
    // ground fog near the foreground wall
    { const g = ctx.createLinearGradient(0, 700, 0, 896); g.addColorStop(0, 'rgba(90,110,170,0)'); g.addColorStop(1, 'rgba(90,110,170,0.25)'); ctx.fillStyle = g; ctx.fillRect(0, 700, 1024, 196); }
    ENV.post(ctx, { dofTop: [0, 170], dofBot: [700, 820], dofPx: 3.5, bloom: 0.7, thr: 0.55, vig: 0.62, grade: { sh: [-8, 0, 20], hi: [18, 6, -10], sat: 1.1, con: 1.1 } });
    if (opt.noUI) return;
    UI.win(ctx, 24, 20, 250, 60, { a: 0.72 }); UI.text(ctx, 'コーラルの町', 149, 61, { px: 28, w: 700, align: 'center', c: '#ffe8a8' });
    UI.win(ctx, 24, 690, 976, 182);
    UI.tab(ctx, '町の人', 44, 664);
    UI.text(ctx, '「灯台の火が消えてから、夜の海は荒れる', 70, 760, { px: 32 });
    UI.text(ctx, '　ばかりさ。あんたたち、行ってくれるのかい？」', 70, 812, { px: 32 });
    ctx.save(); ctx.translate(960, 846); ctx.rotate(Math.PI / 2); UI.cursor(ctx, 0, 0, 16); ctx.restore();
  }

  // =================== dungeon ===================
  async function dungeon(opt) {
    opt = opt || {}; const t = opt.t || 0;
    cv.width = 1024; cv.height = 896;
    const wc = ENV.mk(512, 448), w = wc.getContext('2d');
    const px = new PLACES.PX(w);
    px.fill(0, 0, 512, 448, () => [6, 6, 12]);
    // back wall (big blocks) with a top ledge
    const moss = RZ.ramp(['#10200e', '#223a18', '#3a5a24', '#5a7c34'], 5);
    PLACES.blocks(px, 0, 34, 512, 170, { rh: 17, bw: 30, keys: ['#141620', '#262a38', '#3c4252', '#58606e', '#7a8290', '#9aa0a8'], mortar: '#0a0a10', seed: 21, moss, crack: true });
    PLACES.blocks(px, 0, 26, 512, 34, { rh: 8, bw: 40, keys: ['#1c1e28', '#343a48', '#525a68', '#747c88'], mortar: '#0a0a10', seed: 22 });
    // doorway arch in the back wall
    px.fill(222, 70, 290, 170, (x, y) => { const cx = 256, r = 34; if (y < 104 && Math.hypot(x - cx, (y - 104) * 1.0) > r) return null; const d = (y - 70) / 100; return RZ.mix([4, 4, 8], [16, 18, 30], Math.max(0, 1 - d) * 0.4); });
    for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += 0.02) { for (let k = 0; k < 6; k++) px.set(256 + Math.cos(a) * (34 + k), 104 + Math.sin(a) * (34 + k), PLACES.pick(RZ.ramp(['#20242e', '#3a404c', '#5a6270', '#8a92a0'], 6), k < 2 ? 0.8 : (Math.floor(a * 6) % 2 ? 0.45 : 0.35))); }
    // floor flagstones
    PLACES.blocks(px, 0, 170, 512, 448, { rh: 26, bw: 30, keys: ['#141410', '#26261e', '#3a3a2e', '#525040', '#6c6852', '#8a8468'], mortar: '#060604', seed: 23, crack: true, moss });
    // skirting course at the wall foot
    PLACES.blocks(px, 0, 158, 512, 172, { rh: 14, bw: 44, keys: ['#0e1016', '#1c2028', '#2e343e', '#444c58', '#5c6470'], mortar: '#060608', seed: 24 });
    // wet patches (darker, glossy)
    px.fill(0, 170, 512, 448, (x, y) => { const n = RZ.vnoise(x * 0.03, y * 0.05, 31); if (n < 0.66) return null; const c = px.get(x, y); return RZ.mix(c, [10, 14, 26], 0.45); });
    // wall base shadow
    px.fill(0, 172, 512, 186, (x, y) => RZ.mix(px.get(x, y), [4, 4, 10], (186 - y) / 16));
    px.done();
    const R = RZ.rng(9);
    const B = new RZ.Builder();
    const stone = mat({ keys: ['#101218', '#22262e', '#3a404a', '#586070', '#7c8494', '#a4acb8'], n: 8, tex: 2, tsx: 0.4, tsy: 0.6 });
    // pillars
    [[92, 250], [420, 250]].forEach(([x, y]) => {
      const g = B.group(); B.cap(x, y - 6, x, 20, 13, 13, stone, y, { g });
      for (let i = 0; i < 10; i++) B.fold(x - 14, y - 16 - i * 22, x + 14, y - 16 - i * 22, 0.8, g, -2);
      B.poly([[x - 17, y], [x + 17, y], [x + 16, y - 12], [x - 16, y - 12]], stone, y + 0.01, { bevel: 2 });
    });
    // chest
    { const x = 330, y = 262; const wood = mat({ keys: ['#1c0e06', '#3c2010', '#643a1c', '#8c5a30', '#b4804c'], n: 7, tex: 1.2, tsx: 0.15, tsy: 1 });
      B.poly([[x - 13, y], [x + 13, y], [x + 13, y - 12], [x - 13, y - 12]], wood, y, { bevel: 1.5 });
      B.cap(x - 11, y - 15, x + 11, y - 15, 6, 6, wood, y + 0.01, { g: B.group() });
      [x - 8, x + 8].forEach((bx) => { B.poly([[bx - 1.6, y], [bx + 1.6, y], [bx + 1.6, y - 13], [bx - 1.6, y - 13]], RIG.M.gold, y + 0.02, { bevel: 1 }); B.cap(bx, y - 12, bx, y - 18, 1.7, 1.7, RIG.M.gold, y + 0.025); });
      B.cap(x - 13.5, y - 12, x + 13.5, y - 12, 1, 1, RIG.M.gold, y + 0.022);
      B.rect(x - 2, y - 14, 4, 5, RIG.M.gold, y + 0.03); }
    // ice crystals (cold light)
    const I = MON.MM.ice;
    [[62, 330, 0, 34, 6.5], [50, 334, -0.5, 22, 4.5], [76, 334, 0.45, 24, 5], [68, 338, 0.9, 14, 3.5], [40, 338, -1, 12, 3]].forEach(([x, y, a, l, wd]) => {
      const d = [Math.sin(a), -Math.cos(a)], n = [-d[1], d[0]];
      B.poly([[x - n[0] * wd, y - n[1] * wd], [x + d[0] * l * 0.8 - n[0] * wd * 0.8, y + d[1] * l * 0.8 - n[1] * wd * 0.8], [x + d[0] * l, y + d[1] * l], [x + d[0] * l * 0.8 + n[0] * wd, y + d[1] * l * 0.8 + n[1] * wd], [x + n[0] * wd, y + n[1] * wd]], I, y + a, { bevel: wd, g: B.group() });
    });
    // rubble + bones
    for (let i = 0; i < 14; i++) { const x = R() * 512, y = 190 + R() * 240; if (Math.abs(x - 256) < 60) continue; B.ell(x, y - 2, 2 + R() * 4, 1.5 + R() * 2.5, stone, y, { bulge: 0.8 }); }
    // torches on the wall
    // brazier on the floor
    { const x = 392, y = 352; B.cap(x - 12, y - 16, x + 12, y - 16, 4, 4, RIG.M.iron, y + 0.1); B.poly([[x - 11, y - 14], [x + 11, y - 14], [x + 5, y - 6], [x - 5, y - 6]], RIG.M.iron, y + 0.05, { bevel: 2 });
      B.cap(x, y - 6, x, y, 2, 2, RIG.M.iron, y); [-7, 0, 7].forEach((dx) => B.cap(x, y - 2, x + dx, y, 1, 1, RIG.M.iron, y + 0.01)); }
    // bones + skull
    { const bone = mat({ keys: ['#4a4436', '#8a806a', '#c4b89c', '#ece2c8'], n: 5 });
      B.cap(150, 372, 166, 368, 1.4, 1.4, bone, 372); B.cap(160, 376, 171, 380, 1.2, 1.2, bone, 376); B.ell(144, 366, 5, 4.4, bone, 373); B.rect(142, 366, 2, 2, mat({ keys: ['#0a0806', '#0a0806'], n: 2, flat: true }), 374); B.rect(146, 366, 2, 2, mat({ keys: ['#0a0806', '#0a0806'], n: 2, flat: true }), 374); }
    const torches = [[150, 104], [362, 104]];
    const tor = mat({ keys: ['#0c0806', '#22160e', '#3e2a1a', '#5e4430'], n: 5 });
    torches.forEach(([x, y]) => { B.cap(x, y + 16, x + 1, y, 2, 2.6, tor, 200); B.cap(x - 4, y + 12, x + 4, y + 12, 1, 1, RIG.M.iron, 200.1); });
    const pr = RZ.render(B, {}); ENV.blit(w, pr, 0, 0, 1);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(wc, 0, 0, 1024, 896);
    const fl = (k) => 1 + Math.sin(t * 13 + k) * 0.06 + Math.sin(t * 31 + k * 2) * 0.04;
    const tl = torches.map(([x, y], k) => ({ x, y: y + 10, r: 190, c: [255, 150, 70], i: 1.05 * fl(k) }));
    const floorSpill = torches.map(([x, y], k) => ({ x, y: 210, r: 150, c: [255, 140, 60], i: 0.55 * fl(k), sy: 0.55 }));
    const cold = { x: 64, y: 320, r: 150, c: [80, 150, 255], i: 0.9 };
    const braz = { x: 392, y: 330, r: 200, c: [255, 150, 70], i: 1.1 * fl(3) };
    tl.push(braz);
    const LM = lightmap([40, 44, 70], tl.concat(floorSpill, [cold, { x: 256, y: 120, r: 60, c: [40, 60, 120], i: 0.4 }]));
    // pillar/chest shadows away from torches
    [[92, 250, 16], [420, 250, 16], [330, 262, 12]].forEach(([x, y, s]) => torches.forEach(([lx, ly]) => castShadow(ctx, x, y, lx, ly + 60, s * 4, s * 0.9, 0.45)));
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(LM, 0, 0); ctx.restore();
    // actors
    const pts = tl.map((l) => ({ x: l.x, y: l.y, z: 40, r: 230, c: [1, 0.62, 0.32], i: 1.3 * (l.i) })).concat([{ x: 64, y: 310, z: 20, r: 200, c: [0.35, 0.6, 1], i: 1.3 }]);
    const light = { mul: [0.22, 0.25, 0.42], pts, rimC: RZ.hex('#ff9c50'), rimK: 1.2, key: [-0.1, -0.7, 0.7] };
    const hero = { L: RIG.LOOKS.arun, x: 280, y: 322, p: RIG.pose('ready', { br: t, lean: 0.06, w: 1.7, aN: 0.55, eN: 0.9 }) };
    const sel = { L: RIG.LOOKS.sylvan, x: 226, y: 310, p: RIG.pose('idle', { br: t + 0.3 }) };
    [sel, hero].forEach((a) => { torches.forEach(([lx, ly]) => castShadow(ctx, a.x, a.y, lx, ly + 60, 26, 7, 0.4)); ENV.shadow(ctx, a.x * K, a.y * K, 30, 8, 0.7, [4, 4, 10]); });
    [sel, hero].sort((a, b) => a.y - b.y).forEach((a) => { const r = PLACES.actor(a.L, a.p, a.x, a.y, light, 1.15); ENV.blit(ctx, r, a.x * K, a.y * K, K); });
    // flames, crystal glow, embers, chest glint
    torches.forEach(([x, y], k) => flame(ctx, x * K, (y - 2) * K, t + k, fl(k)));
    flame(ctx, 392 * K, 334 * K, t + 3, fl(3) * 1.6);
    ENV.glow(ctx, 64 * K, 318 * K, 150, [90, 170, 255], 0.55); ENV.glow(ctx, 64 * K, 312 * K, 40, [200, 240, 255], 0.6);
    ENV.glow(ctx, 336 * K, 246 * K, 26, [255, 240, 180], 0.7);
    ENV.motes(ctx, 14, [260, 120, 120, 120], [255, 170, 90], 4 + Math.floor(t * 5));
    ENV.motes(ctx, 10, [680, 120, 120, 120], [255, 170, 90], 7 + Math.floor(t * 5));
    ENV.motes(ctx, 10, [60, 560, 160, 120], [140, 200, 255], 11);
    // low fog
    { const g = ctx.createLinearGradient(0, 520, 0, 896); g.addColorStop(0, 'rgba(60,80,140,0)'); g.addColorStop(1, 'rgba(60,80,140,0.22)'); ctx.fillStyle = g; ctx.fillRect(0, 520, 1024, 376); }
    ENV.post(ctx, { dofTop: [0, 120], dofBot: [740, 880], dofPx: 3, bloom: 0.8, thr: 0.5, vig: 0.75, grade: { sh: [-4, 2, 22], hi: [20, 6, -12], sat: 1.12, con: 1.12 } });
    if (opt.noUI) return;
    UI.win(ctx, 24, 20, 300, 60, { a: 0.72 }); UI.text(ctx, '古い灯台 地下1階', 174, 61, { px: 28, w: 700, align: 'center', c: '#ffe8a8' });
  }
  function flame(c, x, y, t, f) {
    ENV.glow(c, x, y, 180 * f, [255, 140, 60], 0.35);
    ENV.glow(c, x, y - 6, 50, [255, 200, 120], 0.8);
    c.save(); c.globalCompositeOperation = 'lighter';
    const layers = [[18, 26, '255,120,40', 0.9], [12, 20, '255,190,80', 0.95], [6, 12, '255,250,210', 1]];
    for (const [w, h, col, a] of layers) {
      const sw = Math.sin(t * 11) * 2, hh = h * (0.9 + Math.sin(t * 17) * 0.1) * f;
      c.fillStyle = `rgba(${col},${a})`; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w / 2, y - hh * 0.5, x + sw, y - hh); c.quadraticCurveTo(x + w / 2, y - hh * 0.5, x + w / 2, y); c.quadraticCurveTo(x, y + w * 0.3, x - w / 2, y); c.fill();
    }
    c.restore();
  }

  G.SCENES = { sheet, mons, battle, town, dungeon };
  const v = Q.get('view') || 'sheet';
  (async () => {
    try { await document.fonts.load('500 30px ZenMaru'); await document.fonts.load('700 30px ZenMaru');
      const o = Object.fromEntries(Q.entries()); if (o.t) o.t = +o.t; if (v === 'sheet') await G.SCENES.sheet(+(Q.get('scale') || 1)); else await G.SCENES[v](o); document.title = 'done'; }
    catch (e) { console.error(e.stack); document.title = 'err'; }
  })();
})(window);
