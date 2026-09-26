// Chibi (~2.7 heads) humanoid rig. Model units = sprite px at scale 1; origin = between the feet,
// facing RIGHT (+x). Every body part is built from 2.5D primitives each frame from bone angles, so
// any pose / in-between is free and the whole cast shares one skeleton (looks are data).
'use strict';
(function (G) {
  const { mat } = G.RZ;
  const PI = Math.PI;

  // ---------- materials (ramps are dark → light, hue-shifted) ----------
  const M = {
    skin: mat({ keys: ['#5a2a2c', '#a4574a', '#dc8f72', '#f4c3a0', '#ffe6cf'], n: 7, rim: '#fff0d8', wrap: 0.45, amb: 0.3 }),
    skinDark: mat({ keys: ['#3a1e20', '#6e3a30', '#a86a4c', '#d49a74', '#f0c8a4'], n: 7, wrap: 0.45, amb: 0.3 }),
    white: mat({ keys: ['#ffffff', '#ffffff'], n: 2, flat: true }),
    lash: mat({ keys: ['#1a0e14', '#2c1820'], n: 2, flat: true }),
    mouth: mat({ keys: ['#7a2c30', '#a8484a'], n: 2, flat: true }),
    blush: mat({ keys: ['#f0907c', '#f0907c'], n: 2, flat: true }),
    // metals
    steel: mat({ keys: ['#1c2230', '#3e4a60', '#7c8ca4', '#c4d0de', '#ffffff'], n: 8, metal: true, spec: 1, specPow: 10, rim: '#ffe8c0' }),
    gold: mat({ keys: ['#3a1e08', '#7a4a14', '#c08a2c', '#f0c860', '#fff4c0'], n: 7, metal: true, spec: 1, specPow: 10 }),
    iron: mat({ keys: ['#16181e', '#2e323c', '#565c68', '#8c94a0', '#d6dce4'], n: 7, metal: true, spec: 0.8, specPow: 12 }),
    leather: mat({ keys: ['#24120c', '#4a2818', '#7a4428', '#a8683c', '#d49a64'], n: 7 }),
    leatherDk: mat({ keys: ['#140c0a', '#2c1a14', '#4a2c20', '#6c4430', '#946448'], n: 6 }),
    wood: mat({ keys: ['#2a160c', '#5a341c', '#8c5a30', '#b8844c', '#e0b27a'], n: 6 }),
  };
  const cloth = (keys, o) => mat(Object.assign({ keys, n: 7, wrap: 0.3 }, o));
  const hairM = (keys) => mat({ keys, n: 8, sheen: [-0.62, -0.28], wrap: 0.35, amb: 0.22 });
  const eyeM = (keys) => mat({ keys, n: 4, flat: true });

  // ---------- party looks (data only) ----------
  const LOOKS = {
    arun: { name: 'アルン', hair: hairM(['#1e0c0a', '#4a1c12', '#8a3a1c', '#c46a2c', '#f0a650', '#ffd89a']), hairStyle: 'spiky',
      eye: eyeM(['#10202c', '#1c4a6c', '#3a86b0', '#8cd0f0']), top: cloth(['#0e1430', '#1c2c64', '#2e4ea0', '#4c7cd0', '#8cb4f0']),
      trim: cloth(['#3a2008', '#7a5214', '#c89a38', '#f4d680']), pants: cloth(['#1a1410', '#34281e', '#56463a', '#7c6a58']),
      boots: M.leather, belt: M.leatherDk, armor: 'pauldron', metal: M.steel, cape: cloth(['#2a0808', '#5c1414', '#962420', '#c8402e', '#ec7a54']),
      scarf: null, weapon: 'sword' },
    selma: { name: 'セルマ', hair: hairM(['#200808', '#521410', '#942a1a', '#cc4c26', '#ee8040', '#ffc080']), hairStyle: 'braid',
      eye: eyeM(['#102010', '#205030', '#3c8c50', '#90d8a0']), top: cloth(['#10160e', '#223020', '#3a5032', '#5a744a', '#92a878']),
      trim: M.leather, pants: cloth(['#161210', '#2c241e', '#4a3e34', '#6c5e50']), boots: M.leatherDk, belt: M.leather,
      armor: 'plate', metal: M.iron, cape: null, weapon: 'spear' },
    sylvan: { name: 'シルヴァン', hair: hairM(['#1a1a10', '#484428', '#86804a', '#c4bc78', '#ece6ac', '#fffbe0']), hairStyle: 'long',
      eye: eyeM(['#0c1c14', '#1a4c34', '#34906a', '#90e8c0']), top: cloth(['#0a1a10', '#163220', '#265234', '#3c7a4a', '#76b07a']),
      trim: cloth(['#2a1a0c', '#5a3c1c', '#8c6434', '#c09454']), pants: cloth(['#14120c', '#2a261a', '#46402c', '#686044']),
      boots: M.leather, belt: M.leatherDk, armor: null, metal: M.gold, cape: cloth(['#0e1a10', '#1c3020', '#2e4a30', '#4a6a44', '#7a9a64']), hood: true, ears: 'elf', weapon: 'bow' },
    viola: { name: 'ヴィオラ', hair: hairM(['#140c1c', '#2c1a3c', '#4c2c64', '#76489a', '#a67ccc', '#dcc0f0']), hairStyle: 'bob',
      eye: eyeM(['#1c0c24', '#4c1c5c', '#9048a8', '#e0a0f0']), top: cloth(['#e0d8cc', '#ece6dc', '#f6f2ea', '#fffdf8', '#ffffff'].reverse().reverse(), { keys: ['#5a4c5c', '#8c8090', '#c0b8c0', '#e8e2e0', '#fffcf4'] }),
      trim: cloth(['#3a2008', '#7a5214', '#c89a38', '#f4d680']), pants: cloth(['#5a4c5c', '#8c8090', '#c0b8c0', '#e8e2e0']),
      boots: M.leatherDk, belt: cloth(['#200c30', '#40205c', '#60348c', '#8a5cb8']), armor: null, metal: M.gold, cape: null, robe: true, weapon: 'staff' },
  };
  LOOKS.viola.top = cloth(['#4a3e50', '#7c7084', '#b4acb8', '#e2dcdc', '#fffcf4']);

  // ---------- poses ----------
  const P0 = { x: 0, y: 0, rot: 0, lean: 0.04, tilt: 0, br: 0, aN: 0.45, eN: 0.9, aF: -0.15, eF: 0.55, lN: 0.28, kN: -0.25, lF: -0.22, kF: -0.12,
    w: 2.1, cape: 0, eyes: 1, mouth: 0, sq: 0, air: 0, glow: 0, smear: 0 };
  const POSES = {
    idle: {},
    ready: { lean: 0.12, aN: 0.7, eN: 0.8, w: 1.55, lN: 0.45, kN: -0.55, lF: -0.35, kF: -0.25 },
    step: { lean: 0.2, lN: 0.6, kN: -0.5, lF: -0.5, kF: -0.3, aF: -0.5, aN: 0.5, eN: 0.8, w: 1.9, cape: 0.8 },
    windup: { lean: -0.12, tilt: -0.08, aN: -2.4, eN: -0.3, w: -2.2, aF: 0.6, eF: 0.8, lN: 0.5, kN: -0.6, lF: -0.4, kF: -0.3, cape: 0.3 },
    slash: { lean: 0.38, tilt: 0.12, aN: 1.35, eN: 0.25, w: 1.35, aF: -0.6, eF: 0.4, lN: 0.8, kN: -0.7, lF: -0.55, kF: -0.1, cape: 1, smear: 1, sq: 0.5, mouth: 1 },
    follow: { lean: 0.3, aN: 0.5, eN: 0.35, w: 0.6, aF: -0.5, eF: 0.4, lN: 0.75, kN: -0.8, lF: -0.5, kF: -0.15, cape: 0.8, sq: 0.3 },
    cast: { lean: -0.06, tilt: -0.1, aN: 2.3, eN: 0.35, w: 2.8, aF: 1.6, eF: 0.4, lN: 0.2, kN: -0.15, lF: -0.2, kF: -0.1, cape: 0.6, glow: 1, eyes: 0.5 },
    hurt: { x: -3, lean: -0.35, tilt: -0.25, aN: -0.3, eN: 0.6, w: 2.8, aF: -0.9, eF: 0.3, lN: 0.35, kN: -0.3, lF: -0.5, kF: -0.3, cape: -0.6, eyes: 0, sq: 1, mouth: 1 },
    kneel: { y: 0, lean: 0.35, tilt: 0.3, aN: 0.1, eN: 0.25, w: 3.0, aF: 0.5, eF: 0.9, lN: 1.45, kN: -1.45, lF: -0.15, kF: -1.35, cape: -0.2, eyes: 0.5, sq: 0.6 },
    ko: { rot: -1.5, lean: -0.1, tilt: -0.1, aN: 0.3, eN: 0.2, w: 0.6, aF: -0.5, eF: 0.1, lN: 0.1, kN: -0.1, lF: -0.1, kF: -0.3, cape: -0.4, eyes: 0 },
    victory: { lean: -0.05, tilt: -0.15, aN: 2.9, eN: 0.2, w: 3.1, aF: -0.35, eF: 1.6, lN: 0.15, kN: -0.05, lF: -0.18, kF: -0.05, cape: 0.5, mouth: 2 },
  };
  function pose(name, extra) { return Object.assign({}, P0, POSES[name] || {}, extra || {}); }
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  function lerpPose(a, b, t) { const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? a[k] + ((b[k] ?? a[k]) - a[k]) * t : a[k]; return o; }
  // timeline: [[time, poseObj], ...] → pose at t (eased per segment)
  function sample(tl, t) {
    if (t <= tl[0][0]) return tl[0][1];
    for (let i = 1; i < tl.length; i++) if (t <= tl[i][0]) { const u = (t - tl[i - 1][0]) / (tl[i][0] - tl[i - 1][0]); return lerpPose(tl[i - 1][1], tl[i][1], (tl[i][2] || ease)(u)); }
    return tl[tl.length - 1][1];
  }

  // ---------- drawing ----------
  const dir = (a) => [Math.sin(a), Math.cos(a)];
  function draw(B, L, p, opt) {
    opt = opt || {};
    const SK = L.skin || M.skin;
    const br = Math.sin(p.br * PI * 2) * 0.5; // breathing -0.5..0.5
    // global transform (root offset + whole-body rotation for KO)
    const piv = [0, -9], cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    const Gt = (x, y) => { const dx = x - piv[0], dy = y - piv[1]; return [piv[0] + dx * cr - dy * sr + p.x, piv[1] + dx * sr + dy * cr + p.y]; };
    const out = []; // queued primitive specs (world-transformed at the end for auto-ground)
    const E = (x, y, rx, ry, m, z, o) => out.push(['e', [x, y], rx, ry, m, z, o || {}]);
    const C = (a, b, r1, r2, m, z, o) => out.push(['c', a, b, r1, r2, m, z, o || {}]);
    const Pl = (pts, m, z, o) => out.push(['p', pts, m, z, o || {}]);
    const R = (x, y, w, h, m, z, o) => out.push(['r', [x, y], w, h, m, z, o || {}]);
    const S = (pts, w0, w1, m, z, o) => out.push(['s', pts, w0, w1, m, z, o || {}]);
    const F = (a, b, r, tg, d) => out.push(['f', a, b, r, tg, d]);
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

    const legL = 7.4, thighR = 2.5;
    const hip = [0, -15.5 - br * 0.2];
    const lean = p.lean;
    const T = (x, y) => add(hip, rot([x, y * (1 + br * 0.03)], lean)); // torso frame: y up is negative
    const neck = T(0.4, -13.5);
    const headAng = lean * 0.5 + p.tilt;
    const hc = add(neck, rot([1.2, -10.2], headAng));
    const H = (x, y) => add(hc, rot([x, y], headAng));
    const knees = []; const g = {}; const grp = (k) => (g[k] = g[k] || B.group());

    // --- legs (far leg behind body, near in front) ---
    const leg = (side, a, k, z) => {
      const hp = T(side * -1.6, 0.5);
      const kn = add(hp, [dir(a)[0] * legL, dir(a)[1] * legL]);
      const an = add(kn, [dir(a + k)[0] * legL, dir(a + k)[1] * legL]);
      const gp = grp('leg' + side), gb = grp('boot' + side); knees.push(kn);
      C(hp, kn, thighR, 2.1, L.pants, z, { g: gp });
      C(kn, an, 2.25, 2.0, L.boots, z + 0.05, { g: gb });
      E(kn[0] + 0.3, kn[1] + 0.8, 2.6, 1.4, L.boots, z + 0.06, { g: gb, rot: a + k }); // boot cuff
      const fa = a + k;
      const fv = rot([2.4, 0.9], -Math.min(0.3, Math.max(-0.6, fa * 0.3)));
      E(an[0] + fv[0], an[1] + fv[1] + 0.2, 3.3, 1.7, L.boots, z + 0.04, { g: gb, rot: -fa * 0.25 });
      return an;
    };
    const aF = leg(-1, p.lF, p.kF, 2);
    const aN = leg(1, p.lN, p.kN, 4);

    // --- cape ---
    if (L.cape) {
      const sh = T(-3.5, -12.5), w = p.cape;
      const pts = [T(-1, -13.8), sh, T(-8 - w * 3, -1), T(-11 - w * 5, 7 + w), T(-5 - w * 3, 9 - w * 1.5), T(0, 5)];
      const gc = grp('cape');
      Pl(pts, L.cape, 0.5, { g: gc, bevel: 2.5, nx: -0.25 });
      F(T(-3, -8), T(-8 - w * 4, 7), 0.9, gc, -1);
      F(T(-5.5, -9), T(-10 - w * 4, 5), 0.7, gc, 1);
      F(T(-1.5, -6), T(-4 - w * 3, 8), 0.8, gc, -1);
      if (L.hood) E(T(-3.5, -14)[0], T(-3.5, -14)[1], 5.5, 3.5, L.cape, 9.4, { g: gc, rot: lean });
    }

    // --- torso ---
    const gt = grp('torso');
    E(T(0.3, -7.6)[0], T(0.3, -7.6)[1], 6.1, 8.2, L.top, 5, { g: gt, rot: lean });
    const flare = L.robe ? 9.5 : 7.2, hem = L.robe ? 14.2 : 4.6;
    const gs = grp('skirt');
    Pl([T(-5.6, -4), T(5.6, -4), T(flare - 0.4 + p.lean * 2, hem), T(0, hem + 0.8), T(-flare - 0.6, hem - 0.4)], L.top, 5.2, { g: gs, bevel: 3 });
    // hem trim + folds
    const gtr = grp('trim');
    C(T(-flare - 0.4, hem - 0.9), T(flare - 0.6 + p.lean * 2, hem - 0.5), 0.9, 0.9, L.trim, 5.3, { g: gtr });
    for (let i = -2; i <= 2; i++) F(T(i * 1.6, -1), T(i * (flare / 2.3), hem - 1), 0.6, gs, i % 2 ? -1 : 1);
    F(T(1.6, -12), T(3.4, -4), 0.6, gt, -1);
    if (L.robe) { C(T(1.8, -13), T(2.2, hem - 1), 0.7, 0.8, L.trim, 5.35, { g: grp('robeTrim') }); }
    // armour
    if (L.armor === 'plate') {
      const gp = grp('plate');
      Pl([T(-5.2, -13), T(5.2, -13.2), T(6, -7), T(4.4, -2.8), T(-4.6, -2.8), T(-5.8, -7)], L.metal, 5.6, { g: gp, bevel: 3.5 });
      F(T(0.6, -12.5), T(0.8, -3.4), 0.6, gp, 1.2);
      for (let i = 0; i < 3; i++) C(T(-4.4, -4.5 + i * 2.3), T(4.4, -4.6 + i * 2.3), 1.1, 1.1, L.metal, 5.62 + i * 0.01, { g: grp('tasset' + i) });
    }
    // belt
    const gbelt = grp('belt');
    C(T(-5.8, -3.2), T(5.9, -3.4), 1.25, 1.25, L.belt, 5.7, { g: gbelt });
    R(T(2.3, -4.6)[0], T(2.3, -4.6)[1], 2.4, 2.6, L.metal, 5.75, { g: grp('buckle') });
    // collar / scarf
    E(neck[0] + 0.4, neck[1] + 0.8, 4.2, 2.3, L.trim, 6, { g: grp('collar'), rot: lean });

    // --- far arm ---
    const arm = (side, a, e, z, hand) => {
      const sh = T(side > 0 ? -2.0 : 2.6, -11.8);
      const el = add(sh, [dir(a)[0] * 5.6, dir(a)[1] * 5.6]);
      const wr = add(el, [dir(a + e)[0] * 5.0, dir(a + e)[1] * 5.0]);
      const ga = grp('arm' + side), gg = grp('glove' + side);
      C(sh, el, 2.35, 2.0, L.top, z, { g: ga });
      C(el, wr, 2.0, 1.75, L.robe ? L.top : L.boots, z + 0.02, { g: gg });
      if (!L.robe) E(el[0], el[1], 2.3, 1.5, L.boots, z + 0.03, { g: gg, rot: a + e + PI / 2 });
      const hd = add(wr, [dir(a + e)[0] * 1.2, dir(a + e)[1] * 1.2]);
      E(hd[0], hd[1], 2.1, 2.1, L.robe ? SK : L.boots, z + 0.05, { g: grp('hand' + side) });
      if (L.armor && side > 0) E(sh[0] + 0.3, sh[1] + 0.3, 3.6, 3.1, L.metal, z + 0.1, { g: grp('pauld' + side), rot: lean });
      if (L.armor && side < 0) E(sh[0] + 0.3, sh[1] + 0.3, 3.2, 2.8, L.metal, z + 0.1, { g: grp('pauld' + side), rot: lean });
      return hd;
    };
    const hF = arm(-1, p.aF, p.eF, 1);

    // --- head ---
    const gh = grp('head'), ghair = grp('hairback');
    C(neck, add(neck, rot([0.6, -3], headAng)), 1.8, 1.8, SK, 5.8, { g: grp('neck') });
    E(hc[0], hc[1], 11.2, 10.4, SK, 10, { g: gh, rot: headAng, bulge: 0.9 });
    // jaw/cheek softness toward the front
    E(H(4.5, 3.8)[0], H(4.5, 3.8)[1], 6.2, 5.4, SK, 10.01, { g: gh });
    // face
    const blink = p.eyes;
    const eye = (ex, w, far) => {
      const [x, y] = H(ex, 0.4);
      if (blink < 0.25) { R(x - 0.2, y + 2.2, w + 0.6, 1, M.lash, 10.6); return; }
      const h = 4.6 * Math.min(1, blink + 0.2) - p.sq * 1.8;
      R(x - 0.4, y + 3.6 - h - 0.9, w + (far ? 0.4 : 1.0), 1.1, M.lash, 10.62);
      R(x, y + 3.6 - h, w, h, L.eye, 10.6, { shade: 1 });
      R(x, y + 3.6 - h * 0.45, w, h * 0.45, L.eye, 10.61, { shade: 2 });
      if (h > 2) R(x + w - 1.1, y + 3.6 - h + 0.2, 1, 1, M.white, 10.63);
    };
    if (L.face === 'goblin') {
      const ey = mat({ keys: ['#401800', '#c07000', '#ffd020', '#fff8b0'], n: 4, flat: true });
      [[1.0, 3.0], [7.8, 2.0]].forEach(([ex, w]) => { const [x, y] = H(ex, 1.2); R(x, y + 0.6, w, 2.4, ey, 10.6, { shade: 2 }); R(x + w * 0.45, y + 0.6, 1, 2.4, M.lash, 10.61); });
      C(H(-0.5, -0.6), H(4.5, 0.8), 0.8, 0.7, L.skinDk || SK, 10.64, { shadeOff: -3, g: grp('brow1') });
      C(H(6.8, 0.5), H(10, -0.4), 0.7, 0.6, L.skinDk || SK, 10.64, { shadeOff: -3, g: grp('brow2') });
      E(H(10.5, 4.2)[0], H(10.5, 4.2)[1], 3.4, 2.4, SK, 10.66, { g: grp('nose'), rot: headAng + 0.3 });
      R(H(3.2, 6.6)[0], H(3.2, 6.6)[1], 6.4, 1.8, M.mouth, 10.6, { shade: 0 });
      R(H(4.0, 5.8)[0], H(4.0, 5.8)[1], 1.2, 1.8, M.white, 10.62); R(H(7.6, 6.9)[0], H(7.6, 6.9)[1], 1.1, 1.6, M.white, 10.62);
    } else {
      eye(1.4, 2.8, false); eye(7.8, 1.9, true);
      // brows
      R(H(1.4, -1.8 - p.sq * 0.4)[0], H(1.4, -1.8)[1] - p.sq * 0.5, 3.2, 0.9, L.hair, 10.64, { shade: 1, noAO: true });
      R(H(7.2, -1.7)[0], H(7.2, -1.7)[1], 2.2, 0.9, L.hair, 10.64, { shade: 1 });
      // mouth
      if (p.mouth === 1) R(H(6.0, 6.2)[0], H(6.0, 6.2)[1], 1.8, 1.6, M.mouth, 10.6, { shade: 0 });
      else if (p.mouth === 2) R(H(5.4, 6.2)[0], H(5.4, 6.2)[1], 2.6, 1.3, M.mouth, 10.6, { shade: 0 });
      else R(H(5.8, 6.6)[0], H(5.8, 6.6)[1], 1.6, 0.7, M.mouth, 10.6, { shade: 0 });
      R(H(1.2, 4.6)[0], H(1.2, 4.6)[1], 2.2, 0.9, M.blush, 10.59);
    }
    // ear
    if (L.ears === 'goblin') { Pl([H(-1, -1), H(-3, 5), H(-17, 1), H(-19, -3)], SK, 10.15, { g: grp('ear'), bevel: 2.2 }); F(H(-4, 1), H(-15, -1), 0.8, g.ear, -1.5); }
    else if (L.ears === 'elf') { C(H(-2, 2.5), H(-8.5, -2.5), 1.8, 0.4, SK, 10.15, { g: grp('ear') }); }
    else E(H(-1.8, 2.4)[0], H(-1.8, 2.4)[1], 1.8, 2.4, SK, 10.15, { g: grp('ear') });

    // hair
    hair(L, H, headAng, grp, E, C, S, Pl, F, p);

    // --- near arm + weapon ---
    const hN = arm(1, p.aN, p.eN, 8);
    weapon(L, hN, p, E, C, Pl, F, R, grp, hF);

    // --- commit: global transform + auto ground ---
    const pts = [];
    const tf = (q) => Gt(q[0], q[1]);
    let maxY = -1e9;
    const recordY = (q) => { const t = tf(q); if (t[1] > maxY) maxY = t[1]; };
    // ground contact from feet only
    [aF, aN].forEach((a) => { recordY([a[0], a[1] + 2]); recordY([a[0] + 4, a[1] + 2]); }); knees.forEach((k) => recordY([k[0], k[1] + 2.4]));
    if (p.rot) out.forEach((s) => { if (s[0] === 'c' || s[0] === 'e') recordY(s[1]); });
    const dy = p.air ? 0 : -maxY + (p.rot ? -1.2 : 0);
    const W = (q) => { const t = tf(q); return [t[0], t[1] + dy]; };
    for (const s of out) {
      const [t] = s;
      if (t === 'e') { const q = W(s[1]); B.ell(q[0], q[1], s[2], s[3], s[4], s[5], Object.assign({}, s[6], { rot: (s[6].rot || 0) + p.rot })); }
      else if (t === 'c') { const a = W(s[1]), b = W(s[2]); B.cap(a[0], a[1], b[0], b[1], s[3], s[4], s[5], s[6], s[7]); }
      else if (t === 'p') B.poly(s[1].map(W), s[2], s[3], s[4]);
      else if (t === 'r') { if (p.rot) { const [x, y] = s[1], w = s[2], h = s[3]; B.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(W), s[4], s[5], Object.assign({ bevel: 0.01 }, s[6])); } else { const q = W(s[1]); B.rect(q[0], q[1], s[2], s[3], s[4], s[5], s[6]); } }
      else if (t === 's') B.strand(s[1].map(W), s[2], s[3], s[4], s[5], s[6]);
      else if (t === 'f') { const a = W(s[1]), b = W(s[2]); B.fold(a[0], a[1], b[0], b[1], s[3], s[4], s[5]); }
    }
    return { hand: W(hN), head: W(hc), dy };
  }

  function hair(L, H, ha, grp, E, C, S, Pl, F, p) {
    const SK = L.skin || M.skin;
    const hm = L.hair, st = L.hairStyle;
    const hb = grp('hairmass');
    // back/top mass
    if (st !== 'none') E(H(-1.8, -2.8)[0], H(-1.8, -2.8)[1], 12.4, 10.2, hm, 9.6, { g: hb, rot: ha });
    if (st !== 'none') E(H(0.5, -5.2)[0], H(0.5, -5.2)[1], 11.2, 6.8, hm, 10.3, { g: grp('haircap'), rot: ha - 0.12 });
    const z0 = 10.4;
    const s = (pts, w0, w1, z, sh) => S(pts.map((q) => H(q[0], q[1])), w0, w1, hm, z, { shadeOff: sh || 0 });
    if (st === 'spiky') {
      // back spikes
      s([[-4, -7], [-13, -8], [-18, -3]], 3.4, 0.4, 9.5);
      s([[-5, -3], [-13, 0], [-16, 6]], 3.2, 0.4, 9.52);
      s([[-5, 1], [-10, 5], [-11, 10]], 2.8, 0.4, 9.54);
      s([[-2, -9], [-7, -15], [-13, -15]], 3.2, 0.4, 10.35);
      s([[1, -10], [0, -16], [-5, -18]], 2.8, 0.4, 10.36);
      s([[4, -9], [6, -15], [3, -18]], 2.4, 0.3, 10.37);
      // bangs over the forehead
      s([[1, -8], [6, -6], [7, 0]], 2.6, 0.4, z0 + 0.3);
      s([[4, -9], [10, -6], [11, 1]], 2.5, 0.4, z0 + 0.35);
      s([[-1, -8], [2, -4], [2.4, 0.5]], 2.6, 0.4, z0 + 0.32, -0.5);
      s([[7, -8], [12, -5], [13, -1]], 1.8, 0.3, z0 + 0.36);
      s([[-4, -6], [-4, 0], [-2.5, 4.5]], 2.4, 0.5, z0 + 0.2, -0.5); // sideburn lock
    } else if (st === 'braid') {
      s([[1, -9], [6, -7], [8, -1]], 2.8, 0.5, z0 + 0.3);
      s([[4, -9], [10, -5], [11, 0]], 2.4, 0.4, z0 + 0.35);
      s([[-1, -9], [1, -4], [1.5, 0]], 2.6, 0.4, z0 + 0.32, -0.5);
      s([[-4, -6], [-4.5, 0], [-3, 5]], 2.3, 0.5, z0 + 0.2, -0.5);
      // braid: chain of beads down the back
      const pts = [[-9, 2], [-11, 7], [-11.5, 12], [-10.5, 17], [-9.5, 21]];
      pts.forEach((q, i) => { const c = H(q[0], q[1]); E(c[0], c[1], 2.6 - i * 0.15, 2.3 - i * 0.1, hm, 9.3 + i * 0.01, { g: grp('braid' + i), rot: ha }); });
      const tip = H(-9.2, 24); E(tip[0], tip[1], 1.4, 2.2, L.trim, 9.2, { g: grp('tie') });
    } else if (st === 'long') {
      s([[-6, -4], [-13, 6], [-12, 20]], 3.6, 1.0, 9.3);
      s([[-3, -2], [-9, 8], [-8, 20]], 3.2, 0.8, 9.32);
      s([[-9, -6], [-15, 2], [-15, 14]], 3.0, 0.6, 9.31);
      s([[1, -9], [7, -7], [9, 1]], 2.6, 0.4, z0 + 0.3);
      s([[4, -9], [11, -5], [12, 1]], 2.2, 0.4, z0 + 0.35);
      s([[-1, -8], [1, -3], [0.5, 2]], 2.6, 0.4, z0 + 0.32, -0.5);
      s([[-4, -5], [-4, 4], [-3, 10]], 2.4, 0.6, z0 + 0.25, -0.4);
    } else if (st === 'bob') {
      s([[-6, -6], [-12, 0], [-11, 8]], 3.6, 1.6, 9.5);
      s([[-2, -7], [-7, 2], [-6, 9]], 3.2, 1.2, 9.52);
      s([[0, -9], [5, -7], [6, 0]], 3.0, 0.6, z0 + 0.3);
      s([[4, -9], [10, -6], [11, 0]], 2.6, 0.5, z0 + 0.35);
      s([[-2, -8], [-0.5, -3], [0, 1]], 2.6, 0.5, z0 + 0.32, -0.5);
      s([[-4, -5], [-5, 3], [-3.5, 8]], 2.8, 1.2, z0 + 0.25, -0.4);
      // circlet
      const a = H(-10, -4), b = H(10.5, -5.2);
      C(a, b, 0.7, 0.7, M.gold, z0 + 0.5, { g: grp('circlet') });
      const gem = H(6.5, -6.3); E(gem[0], gem[1], 1.3, 1.3, mat({ keys: ['#400c30', '#a0206a', '#ff5ab0', '#ffd0f0'], n: 5, spec: 1 }), z0 + 0.52, { g: grp('gem') });
    }
    if (L.helm) {
      const gm = grp('helm');
      E(H(-1.2, -6.2)[0], H(-1.2, -6.2)[1], 12.4, 7.8, L.metal, 10.7, { g: gm, rot: ha });
      C(H(-12.8, -2.6), H(11.6, -3.8), 1.5, 1.5, L.metal, 10.72, { g: grp('helmrim'), shadeOff: -0.5 });
      for (let i = 0; i < 5; i++) { const q = H(-9 + i * 4.4, -3.3 - i * 0.1); E(q[0], q[1], 0.7, 0.7, M.gold, 10.74, { g: grp('rivet' + i) }); }
      C(H(9.8, -3.2), H(10.8, 1.2), 1.0, 0.7, L.metal, 10.73, { g: grp('nasal') });
      S([H(-3, -13.5), H(-4, -18), H(-7, -21)], 1.8, 0.3, L.metal, 10.69);
      F(H(-6, -10), H(6, -9), 0.8, gm, -1);
    }
    if (L.hood) {
      const gh = grp('hood');
      Pl([H(-13, -3), H(-8, -13), H(2, -14), H(11, -9.5), H(12.5, -3), H(8, -8), H(-2, -9), H(-8, -4), H(-10, 6)], L.cape, z0 + 0.6, { g: gh, bevel: 3 });
      F(H(-4, -12), H(-10, 2), 0.8, gh, -1);
    }
  }

  const MG = mat({ keys: ['#4a2080', '#8a50e0', '#d0a0ff', '#ffffff'], n: 5, glow: '#c090ff', flat: true, noOutline: true });
  function weapon(L, h, p, E, C, Pl, F, R, grp, hF) {
    const a = p.w; const d = [Math.sin(a), Math.cos(a)];
    const at = (t, o) => [h[0] + d[0] * t + d[1] * (o || 0), h[1] + d[1] * t - d[0] * (o || 0)];
    if (L.weapon === 'sword') {
      const g1 = grp('grip'), g2 = grp('guard'), gb = grp('blade');
      C(at(-2.4), at(1.8), 0.9, 0.9, M.leatherDk, 8.5, { g: g1 });
      E(at(-2.9)[0], at(-2.9)[1], 1.2, 1.2, M.gold, 8.51, { g: g1 });
      C(at(1.9, -3.6), at(1.9, 3.6), 0.95, 0.95, M.gold, 8.6, { g: g2 });
      Pl([at(2.3, -1.45), at(2.3, 1.45), at(17, 1.1), at(19.6, 0), at(17, -1.1)], M.steel, 8.55, { g: gb, bevel: 1.4 });
      F(at(3), at(17), 0.45, gb, 1.5);
    } else if (L.weapon === 'axe') {
      C(at(-6), at(16), 1.05, 1.0, M.wood, 8.5, { g: grp('haft') });
      for (let i = 0; i < 3; i++) C(at(-3 + i * 1.6, -1.2), at(-3 + i * 1.6, 1.2), 0.6, 0.6, M.leatherDk, 8.51, { g: grp('wrap' + i) });
      const gh = grp('axehead');
      Pl([at(10, -1.2), at(15.5, -1.2), at(19, -8.5), at(12.5, -10.5), at(11, -6)], M.iron, 8.55, { g: gh, bevel: 1.8 });
      C(at(19, -8.6), at(12.4, -10.6), 0.55, 0.55, M.steel, 8.56, { g: grp('edge') });
      Pl([at(11, 1), at(15, 1), at(14, 4.5), at(12, 4.5)], M.iron, 8.55, { g: grp('back'), bevel: 1 });
      E(at(16.6)[0], at(16.6)[1], 1.3, 1.3, M.iron, 8.57, { g: grp('cap') });
    } else if (L.weapon === 'spear') {
      const g = grp('shaft');
      C(at(-12), at(18), 0.85, 0.85, M.wood, 8.5, { g });
      Pl([at(17.5, -1.8), at(17.5, 1.8), at(21.5, 1.3), at(27, 0), at(21.5, -1.3)], M.iron, 8.55, { g: grp('tip'), bevel: 1.4 });
      C(at(16.5, -2.2), at(16.5, 2.2), 0.9, 0.9, M.gold, 8.56, { g: grp('ring') });
    } else if (L.weapon === 'staff') {
      const g = grp('staff');
      C(at(-9), at(15), 0.9, 0.8, M.wood, 8.5, { g });
      const o = at(17.5);
      C(at(14, -2), at(19, -2.6), 0.6, 0.4, M.gold, 8.52, { g: grp('claw1') });
      C(at(14, 2), at(19, 2.6), 0.6, 0.4, M.gold, 8.52, { g: grp('claw2') });
      E(o[0], o[1], 2.6, 2.6, mat({ keys: ['#1c0c40', '#4a2cb0', '#9a7cff', '#e8dcff'], n: 6, spec: 1, specPow: 6 }), 8.53, { g: grp('orb') });
    } else if (L.weapon === 'bow') {
      // bow held in the far (front-extended) hand: drawn with the near hand for simplicity
      const g = grp('bow'); const up = at(0, 0);
      const c1 = [up[0] + 1.5, up[1] - 12], c2 = [up[0] + 1.5, up[1] + 12];
      C(c1, [up[0] + 5, up[1] - 5], 0.7, 1.0, M.wood, 8.5, { g });
      C([up[0] + 5, up[1] - 5], [up[0] + 5.5, up[1] + 5], 1.0, 1.0, M.wood, 8.5, { g });
      C([up[0] + 5.5, up[1] + 5], c2, 1.0, 0.7, M.wood, 8.5, { g });
      C(c1, c2, 0.28, 0.28, mat({ keys: ['#c8c0a0', '#f0ecd8'], n: 2, flat: true, noOutline: true }), 8.4, { g: grp('string') });
      // quiver on back
      const q0 = [hF[0] - 6, hF[1] - 18];
    }
    if (p.glow > 0.01 && false) {
      const c = L.weapon === 'staff' ? at(17.5) : h;
      E(c[0], c[1], 3.5 * p.glow, 3.5 * p.glow, MG, 12, { g: grp('glow') });
    }
  }

  G.RIG = { LOOKS, POSES, pose, sample, lerpPose, draw, M, ease };
})(window);
