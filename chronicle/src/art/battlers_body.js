// Party battle sprites (Part A8, DESIGN §11.4.4.5) — one frame of a figure:
// the body base (gender × build × height), the outfit shape (from the field body
// type) in the field palette letters, the cape, the field head stamped 1:1, the
// weapon, and the anchors. Everything is drawn pre-flip (facing right) and
// mirrored at the end by BT.finish. See battlers_draw.js for the paint model and
// battlers_pose.js for the skeleton tables.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const BT = (A._Battlers = A._Battlers || {});
  const SOLE = 38;
  BT.SOLE = SOLE;

  // ------------------------------------------------------------------ builds
  // shoulder / waist width, leg rows (waist → sole), torso rows (neck → waist),
  // limb brushes (2 = 2px, 2.5 = 3px across the stroke, 3 = 3px round)
  const BUILD = {
    slim: { sw: 8, hw: 6, leg: 9, torso: 7, au: 2, af: 2, tt: 2.5, ts: 2 },
    normal: { sw: 10, hw: 7, leg: 9, torso: 7, au: 2.5, af: 2, tt: 3, ts: 2.5 },
    sturdy: { sw: 12, hw: 9, leg: 8, torso: 8, au: 3, af: 2.5, tt: 3, ts: 3, chest: 1 },
  };
  BT.BUILD = BUILD;
  /** build parameters for a look {build, height} and a gender */
  BT.buildParams = function (look, gender) {
    const b = Object.assign({}, BUILD[look.build] || BUILD.normal);
    b.fem = gender === 'f';
    if (b.fem) { b.sw -= 1; b.hw += 1; if (b.au > 2) b.au = 2; }
    b.ra = 1;
    if (look.height === 'youth') { b.leg -= 1; b.torso -= 1; b.ra = 0.9; }
    if (look.height === 'short') { b.leg -= 3; b.torso -= 1; b.ra = 0.78; }
    b.rl = b.leg / 9; b.rt = b.torso / 7;
    b.upper = 4 * b.ra; b.fore = 4 * b.ra;
    return b;
  };

  // ------------------------------------------------------------------ materials
  BT.materials = function (pal) {
    const CA = R.Art.Chars, K = CA.OUTLINE;
    const t = (a, b, c) => [CA.mix(pal[a], K, 0.45), pal[a], pal[b], pal[c]];
    return {
      main: t('A', 'B', 'C'), sub: t('D', 'E', 'F'), trim: t('G', 'H', 'I'), lea: t('L', 'M', 'N'),
      steel: t('X', 'Y', 'Z'), pants: t('U', 'V', 'W'), skin: t('d', 's', 't'),
      white: [CA.mix(pal.i, K, 0.3), pal.i, pal.j, pal.w],
      glass: ['#2c5c80', '#5ca8d8', '#a8e4f8', '#f4fcff'],
    };
  };

  // ------------------------------------------------------------------ outfits
  // Colours follow the field body parts letter for letter (chars_parts.js):
  //   fighter: main tunic, sub shoulders, leather belt with a trim buckle, acc2 (UVW) trousers, leather boots
  //   light:   main tunic with a trim collar, sub sash, acc2 trousers, leather boots
  //   armor:   main plate (chest, pauldron, greaves, sabatons), trim belt, sub tassets
  //   robe:    main robe to the ankles, sub stole, trim belt, leather shoes
  //   hakama:  main white top with wide sleeves, sub hakama, trim belt, white tabi
  //   coat:    main long coat (tails to the knee), sub shirt, leather belt, acc2 trousers, leather boots
  //   gi:      main top and trousers, open chest (skin), sub belt, trim ankle wraps, leather shoes
  //   dwarf:   main tunic, leather apron and belt, acc2 trousers, leather boots
  BT.OUTFIT_OF = { fighter: 'tunic', fighterF: 'tunic', light: 'light', lightF: 'light', armor: 'armor', robe: 'robe',
    hakama: 'hakama', coat: 'coat', gi: 'gi', dwarf: 'dwarf' };
  const OUT = {
    tunic: { torso: 'main', sleeve: 'main', legs: 'pants', boots: 'lea', belt: 'lea', buckle: 'trim', pad: 'sub', hem: 2 },
    light: { torso: 'main', sleeve: 'main', legs: 'pants', boots: 'lea', belt: 'sub', collar: 'trim', hem: 1 },
    armor: { torso: 'main', sleeve: 'main', legs: 'main', boots: 'main', belt: 'trim', pad: 'main', padTrim: true, tassets: 'sub', metal: true },
    robe: { torso: 'main', sleeve: 'main', legs: 'main', boots: 'lea', belt: 'trim', stole: 'sub', robe: true, wide: true },
    hakama: { torso: 'main', sleeve: 'main', legs: 'sub', boots: 'white', belt: 'trim', hakama: true, wide: true, collar: 'sub' },
    coat: { torso: 'main', sleeve: 'main', legs: 'pants', boots: 'lea', belt: 'lea', buckle: 'trim', shirt: 'sub', tails: true },
    gi: { torso: 'main', sleeve: 'main', legs: 'main', boots: 'lea', belt: 'sub', vneck: true, wraps: 'trim', baggy: true },
    dwarf: { torso: 'main', sleeve: 'main', legs: 'pants', boots: 'lea', belt: 'lea', buckle: 'trim', apron: 'lea' },
  };
  BT.OUT = OUT;

  // ------------------------------------------------------------------ head
  /** the field head (head, hair, beard, hat, over) facing right, standing frame, 16×24 colours */
  BT.headLayer = function (who, pal) {
    const CA = R.Art.Chars;
    const spec = CA.partySpec(Object.assign({}, who, { small: false }));
    const buf = new Array(16 * 24).fill(null);
    for (const slot of ['head', 'hair', 'beard', 'hat', 'over']) {
      let ps = spec[slot];
      if (!ps) continue;
      if (!Array.isArray(ps)) ps = [ps];
      for (const p of ps) {
        if (!p || p.attach === 'body') continue;
        const v = p.right;
        if (!v) continue;
        const layer = Array.isArray(v) ? v[1] || v[0] : v;
        CA.stamp(buf, layer, p.map ? CA.remap(pal, p.map) : p.pal || pal, false, p.dy || 0, p.clipY);
      }
    }
    let x0 = 16, y0 = 24, x1 = -1, y1 = -1;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) if (buf[y * 16 + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { buf, x0, y0, x1, y1 };
  };
  // the field head's chin centre (the neck point) in the 16×24 layer
  BT.HEAD_NECK = [8, 12];

  // ------------------------------------------------------------------ skeleton
  const r = Math.round;
  /** stretch a normal-build frame to the figure's build → absolute joints */
  function joints(F, B) {
    const h = [F.h[0], r(SOLE - (SOLE - F.h[1]) * B.rl)];
    const n = [r(h[0] + (F.n[0] - F.h[0]) * B.rt), r(h[1] + (F.n[1] - F.h[1]) * B.rt)];
    const sy = (p) => (p ? [p[0], r(SOLE - (SOLE - p[1]) * B.rl)] : null);
    const shN0 = [F.n[0] - 3, F.n[1] + 2], shF0 = [F.n[0] + 3, F.n[1] + 2];
    const half = B.sw / 2;
    const shN = [r(n[0] - half + 2), n[1] + 2], shF = [r(n[0] + half - 2), n[1] + 2];
    const arm = (hand, s0, s1) => (hand ? [r(s1[0] + (hand[0] - s0[0]) * B.ra), r(s1[1] + (hand[1] - s0[1]) * B.ra)] : null);
    const hn = F.planted && F.plant ? [F.hn[0], F.hn[1]] : arm(F.hn, shN0, shN);
    return {
      n, h, shN, shF, hn, hf: arm(F.hf, shF0, shF),
      fn: F.kneel === 'n' ? [F.fn[0], 37] : sy(F.fn), ff: sy(F.ff),
      hipN: [h[0] - Math.max(1, r(B.hw / 2 - 2)), h[1] + 1], hipF: [h[0] + Math.max(1, r(B.hw / 2 - 2)), h[1] + 1],
    };
  }
  BT.joints = joints;

  // ------------------------------------------------------------------ parts
  // battlers_draw.js loads after this file: reach its helpers at call time
  const Mask = () => BT.Mask(), mline = (...a) => BT.mline(...a), mpoly = (...a) => BT.mpoly(...a);
  const mrect = (...a) => BT.mrect(...a), paint = (...a) => BT.paint(...a), dot = (...a) => BT.dot(...a);
  const ik = (...a) => BT.ik(...a), rnd = (p) => BT.rnd(p), mset = (...a) => BT.mset(...a);
  function limb(a, b, t) { return mline(Mask(), a[0], a[1], b[0], b[1], t); }

  /** one leg: thigh, shin, boot. kneel: shin on the ground, toe behind */
  function leg(b, fig, J, which, shift) {
    const B = fig.B, o = fig.out, M = fig.M;
    const hip = which === 'n' ? J.hipN : J.hipF, ank = which === 'n' ? J.fn : J.ff;
    const kneel = which === 'n' && J.kneel;
    let knee;
    if (kneel) knee = [J.h[0] + 2, 36];
    else {
      const L = Math.max(2.5, (SOLE - 2 - (J.h0y + 1)) / 2 + 0.6);
      knee = rnd(ik(hip, ank, L, L, -1));
    }
    const legT = M[o.legs];
    const bootT = M[o.boots];
    const m = limb(hip, knee, o.baggy ? B.tt + 0.5 : B.tt);
    mline(m, knee[0], knee[1], ank[0], ank[1], o.baggy ? Math.max(B.ts, 2.5) : B.ts);
    if (o.hakama) {
      // wide pleated leg: a trapezoid from the hip to past the ankle
      const d = which === 'n' ? -1 : 1;
      mpoly(m, [[hip[0] - 2, hip[1] - 1], [hip[0] + 2, hip[1] - 1], [ank[0] + 3, Math.min(37, ank[1] + 1)], [ank[0] - 2 + (d < 0 ? -1 : 0), Math.min(37, ank[1] + 1)]]);
    }
    paint(b, m, legT, { shift, cast: which === 'n', inner: which === 'n', band: o.hakama ? (x) => (x & 1) === 0 : null });
    // knee plate / wraps
    if (o.metal && !kneel) dot(b, knee[0] + 1, knee[1], M.main, 3);
    // boot
    const bm = Mask();
    if (kneel) {
      mrect(bm, ank[0] - 2, 36, 3, 2);
      mset(bm, ank[0] - 3, 37);
    } else {
      const top = Math.min(36, ank[1]);
      const high = o.boots === 'lea' && !o.robe && !o.baggy;
      mrect(bm, ank[0] - 1, high ? top : Math.max(top, 36), 3, SOLE - (high ? top : Math.max(top, 36)) + 1);
      mset(bm, ank[0] + 2, SOLE); mset(bm, ank[0] + 2, SOLE - 1);
    }
    paint(b, bm, bootT, { shift, cast: which === 'n' });
    // sole
    if (!kneel) for (let x = ank[0] - 1; x <= ank[0] + 2; x++) dot(b, x, SOLE, bootT, Math.max(0, 1 + (shift || 0)));
    if (o.wraps && !kneel) { dot(b, ank[0] - 1, 36, M[o.wraps], 2); dot(b, ank[0], 36, M[o.wraps], 3); dot(b, ank[0] + 1, 36, M[o.wraps], 2); }
    if (o.boots === 'white' && !kneel) for (let x = ank[0] - 1; x <= ank[0] + 2; x++) dot(b, x, SOLE, M.lea, 1);
    return knee;
  }

  /** an arm: upper arm, forearm (sleeve), hand. returns the elbow */
  function arm(b, fig, J, which, shift, o2) {
    const B = fig.B, o = fig.out, M = fig.M;
    const sh = which === 'n' ? J.shN : J.shF, hand = which === 'n' ? J.hn : J.hf;
    if (!hand) return null;
    const el = rnd(ik(sh, hand, B.upper, B.fore, 1));
    const m = limb(sh, el, B.au);
    mline(m, el[0], el[1], hand[0], hand[1], o.wide ? Math.max(B.af, 2.5) : B.af);
    paint(b, m, M[o.sleeve], { shift, cast: which === 'n', inner: which === 'n' });
    if (o.wide) {
      // cuff of the wide sleeve (trim) one step before the hand
      const cx = r(el[0] + (hand[0] - el[0]) * 0.72), cy = r(el[1] + (hand[1] - el[1]) * 0.72);
      const cm = mline(Mask(), cx, cy, cx, cy, 2.5);
      paint(b, cm, M.trim, { shift });
    }
    if (o.pad && which === 'n') {
      // shoulder pad over the top of the near arm (fighter: sub, armor: main plate with a trim rim)
      const pm = BT.mellipse(Mask(), sh[0], sh[1] - 0.5, B.sw >= 11 ? 2.4 : 1.9, 1.6);
      paint(b, pm, M[o.pad], { inner: true });
      if (o.padTrim) for (let x = sh[0] - 2; x <= sh[0] + 2; x++) { const y = r(sh[1] + 1); if (pm[y * BT.W + x]) dot(b, x, y, M.trim, 2); }
    }
    if (!(o2 && o2.noHand)) handAt(b, fig, hand, shift, o2 && o2.fist);
    return el;
  }
  function handAt(b, fig, hand, shift, fist) {
    const M = fig.M;
    if (fig.wtype === 'fist') {
      // gauntlet: 3×3 leather block with skin knuckles on the front
      const m = mrect(Mask(), hand[0] - 1, hand[1] - 1, 3, 3);
      paint(b, m, M.lea, { shift });
      dot(b, hand[0] + 1, hand[1] - 1, M.skin, 3 + (shift || 0));
      dot(b, hand[0] + 1, hand[1], M.skin, 2 + (shift || 0));
      return;
    }
    const m = mrect(Mask(), hand[0] - 1, hand[1] - 1, 2, 2);
    if (fist) mset(m, hand[0] + 1, hand[1] - 1);
    paint(b, m, M.skin, { shift });
  }

  /** torso, pelvis, belt and the outfit's upper details */
  function torso(b, fig, J) {
    const B = fig.B, o = fig.out, M = fig.M;
    const { n, h } = J, half = B.sw / 2, hh = B.hw / 2;
    // neck
    paint(b, mrect(Mask(), n[0] - 1, n[1] - 1, B.fem ? 2 : 3, 2), M.skin, { flat: 1 });
    // pelvis (the tops of the legs)
    const pm = mpoly(Mask(), [[h[0] - hh, h[1]], [h[0] + hh - 0.5, h[1]], [h[0] + hh - 0.5, h[1] + 2], [h[0] - hh, h[1] + 2]]);
    paint(b, pm, M[o.legs], {});
    // chest
    const front = n[0] + half - 0.5 + (B.chest || 0) * 0.5;
    const pts = [
      [n[0] - half + 1.5, n[1] + 1], [n[0] + half - 1.5, n[1] + 1], [front, n[1] + 2], [front, n[1] + 4],
      [h[0] + hh - 0.5, h[1]], [h[0] - hh + 0.5, h[1]], [n[0] - half + 0.5, n[1] + 4], [n[0] - half + 0.5, n[1] + 2],
    ];
    const tm = mpoly(Mask(), pts);
    if (B.fem) { mset(tm, r(front) + 1, n[1] + 4); mset(tm, r(front) + 1, n[1] + 5); }
    // tunic hem / tassets / robe top go below the belt
    if (o.hem) mpoly(tm, [[h[0] - hh - 0.5, h[1]], [h[0] + hh, h[1]], [h[0] + hh + 0.5, h[1] + o.hem], [h[0] - hh - 1, h[1] + o.hem]]);
    paint(b, tm, M[o.torso], { shade2: B.sw >= 10 });
    const fx = r(front);
    // outfit details on the chest
    if (o.metal) {
      // plate: bright ridge down the front, dark under the chest
      for (let y = n[1] + 2; y <= n[1] + 4; y++) dot(b, fx - 1, y, M.main, 3);
      for (let x = r(n[0] - half + 2); x <= fx - 1; x++) if (BT.filled(b, (n[1] + 5) * BT.W + x)) dot(b, x, n[1] + 5, M.main, 1);
    }
    if (o.collar) for (let x = r(n[0] - 2); x <= r(n[0] + 2); x++) dot(b, x, n[1] + 1, M[o.collar], x === r(n[0] + 1) ? 3 : 2);
    if (o.vneck) { dot(b, fx - 1, n[1] + 1, M.skin, 3); dot(b, fx - 1, n[1] + 2, M.skin, 2); dot(b, fx - 2, n[1] + 1, M.skin, 2); dot(b, fx, n[1] + 1, M.skin, 2); }
    if (o.stole) { const sm = mpoly(Mask(), [[fx - 2, n[1] + 1], [fx - 1, n[1] + 1], [r(h[0] + hh - 1.5), h[1]], [r(h[0] + hh - 2.5), h[1]]]); paint(b, sm, M[o.stole], { flat: 2 }); }
    if (o.shirt) { const sm = mpoly(Mask(), [[fx - 1, n[1] + 1], [fx, n[1] + 1], [fx, n[1] + 4], [r(h[0] + hh - 0.5), h[1] - 1], [r(h[0] + hh - 1.5), h[1] - 1]]); paint(b, sm, M[o.shirt], { flat: 2 }); dot(b, fx - 1, n[1] + 1, M[o.shirt], 3); }
    // belt
    const by = h[1] - 1;
    const x0 = r(h[0] - hh + 0.5), x1 = r(h[0] + hh - 0.5);
    for (let x = x0; x <= x1; x++) dot(b, x, by, M[o.belt], x === x0 ? 1 : 2);
    if (o.buckle) { dot(b, x1 - 1, by, M[o.buckle], 3); dot(b, x1, by, M[o.buckle], 2); }
    if (o.tassets) {
      const tm2 = mpoly(Mask(), [[h[0] - hh, h[1]], [h[0] + hh, h[1]], [h[0] + hh + 0.5, h[1] + 3], [h[0] + 0.5, h[1] + 2], [h[0] - hh - 0.5, h[1] + 3]]);
      paint(b, tm2, M[o.tassets], {});
    }
    return fx;
  }

  /** robe skirt / apron / coat tails / short skirt (after the legs) */
  function lower(b, fig, J, kN, kF) {
    const B = fig.B, o = fig.out, M = fig.M, { h } = J, hh = B.hw / 2;
    if (o.robe) {
      const back = Math.min(J.fn[0], kN[0]) - 2, fwd = Math.max(J.ff[0], kF[0]) + 2;
      const bot = SOLE - 1;
      const m = mpoly(Mask(), [[h[0] - hh, h[1] - 1], [h[0] + hh, h[1] - 1], [fwd, bot], [back, bot]]);
      paint(b, m, M.main, { rim: true, band: (x, y) => y === bot });
      // the stole continues down the front of the robe
      if (o.stole) for (let y = h[1]; y <= bot - 1; y++) { const t = (y - h[1]) / Math.max(1, bot - h[1]); const x = r(h[0] + hh - 1 + (fwd - 2 - (h[0] + hh - 1)) * t); dot(b, x, y, M[o.stole], 2); dot(b, x - 1, y, M[o.stole], 1); }
    }
    if (fig.skirt) {
      const bot = fig.skirt === 'knee' ? Math.max(kN[1], kF[1]) + 1 : h[1] + 4;
      const m = mpoly(Mask(), [[h[0] - hh - 0.5, h[1]], [h[0] + hh, h[1]], [h[0] + hh + 1.5, bot], [h[0] - hh - 2, bot]]);
      paint(b, m, M.main, { rim: true });
    }
    if (o.apron) {
      const bot = Math.min(SOLE - 3, Math.max(kN[1], kF[1]) + 1);
      const m = mpoly(Mask(), [[h[0], h[1]], [h[0] + hh, h[1]], [h[0] + hh + 1, bot], [h[0] + 1, bot]]);
      paint(b, m, M[o.apron], { rim: true });
    }
    if (o.tails) {
      const bot = Math.max(kN[1], kF[1]) + 2;
      const sw = fig.flutter || 0;
      const m = mpoly(Mask(), [[h[0] - hh - 0.5, h[1] - 1], [h[0] + 1, h[1] - 1], [h[0] + 1.5, bot - 1], [h[0] - hh - 2 - sw, bot]]);
      paint(b, m, M.main, { rim: true });
    }
  }

  /** cape behind the body: long to the knees, mantle to the waist; flutter 0..3 pulls the hem back */
  function cape(b, fig, J, kind, flutter) {
    const B = fig.B, M = fig.M, { n, h } = J, half = B.sw / 2;
    const f = flutter || 0;
    const top = n[1] + 1;
    const long = kind === 'long';
    const bot = long ? Math.min(SOLE - 3, h[1] + 6) : h[1] - 1;
    const m = mpoly(Mask(), [
      [n[0] - half + 1, top], [n[0] + 1, top], [h[0] - 1, bot - (long ? 1 : 0)],
      [h[0] - B.hw / 2 - 2 - f, bot + (f > 1 ? -1 : 0)], [n[0] - half - 1 - (f > 1 ? 1 : 0), top + 3],
    ]);
    paint(b, m, M.sub, { shade2: true });
    if (long) {
      // trim hem along the bottom edge
      for (let x = 0; x < BT.W; x++) for (let y = bot - 1; y <= bot + 1; y++) {
        const i = y * BT.W + x;
        if (m[i] && !(y + 1 < BT.H && m[i + BT.W])) dot(b, x, y, M.trim, 2);
      }
    }
  }

  function stampHead(b, fig, J) {
    const hd = fig.head, [nx, ny] = BT.HEAD_NECK;
    const ox = J.n[0] - nx, oy = J.n[1] - ny;
    BT.stampCols(b, hd.buf, 16, 24, ox, oy, true);
    return [r(ox + (hd.x0 + hd.x1) / 2), oy + hd.y0];
  }

  function vial(b, fig, hand) {
    const M = fig.M;
    const m = mrect(Mask(), hand[0] - 1, hand[1] - 6, 3, 4);
    mset(m, hand[0], hand[1] - 7);
    paint(b, m, M.glass, { body: false });
    dot(b, hand[0], hand[1] - 8, M.lea, 2, false);
    dot(b, hand[0] - 1, hand[1] - 5, M.glass, 3, false);
  }
  function pouch(b, fig, J) {
    const hh = fig.B.hw / 2;
    const m = mrect(Mask(), r(J.h[0] - hh) - 2, J.h[1], 3, 3);
    paint(b, m, fig.M.lea, {});
  }

  // ------------------------------------------------------------------ one frame
  /**
   * Render frame F (pose table entry) of figure fig →
   * {px (colours, left-facing), body mask, anchors (left-facing)}.
   */
  BT.renderFrame = function (fig, F) {
    const b = BT.Buf();
    const J = joints(F, fig.B);
    J.kneel = F.kneel === 'n';
    J.h0y = SOLE - fig.B.leg; // standing waist row of this build
    const pal = fig.wpal;
    // ------------------------------------------------ weapon placement
    const w = F.w && fig.wtype !== 'fist' ? F.w : null;
    let wg = null, whand = null, wclip = null;
    if (w) {
      wg = BT.weaponGrid(fig.wtype, w.dir);
      whand = w.hand === 'f' ? J.hf : J.hn;
      if (F.raise && wg) {
        // lift the hand until the whole weapon stays on the canvas
        const need = wg.grip[1] + 1;
        if (whand[1] < need) whand[1] = need;
        else if (whand[1] > 14 + need) whand[1] = Math.max(need, 14);
      }
      if (F.plant && wg) {
        // stand the weapon on the ground
        const below = wg.h - 1 - wg.grip[1];
        whand[1] = SOLE - below;
        // a long blade or shaft pointing down: the hand stays at the shoulder line (never up at the
        // face) and the point sinks into the ground (clipped at the sole below)
        if (w.dir === 'D') whand[1] = Math.max(whand[1], J.n[1] + 2);
        wclip = SOLE;
      }
      if (w.dir === 'D' && F.plant) wclip = SOLE;
      if (wg && !F.plant) {
        // keep the whole weapon on the canvas (1px margin for the outline): slide the hand
        const top = whand[1] - wg.grip[1], left = whand[0] - wg.grip[0], right = left + wg.w - 1;
        if (top < 1) whand[1] += 1 - top;
        if (right > BT.W - 2) whand[0] -= right - (BT.W - 2);
        if (left < 1) whand[0] += 1 - left;
      }
      if (BT.TWO_HANDED[fig.wtype] && !F.free && wg && wg.grip2) {
        const gx = whand[0] - wg.grip[0], gy = whand[1] - wg.grip[1];
        J.hf = [wg.grip2[0] + gx, wg.grip2[1] + gy];
      }
    }
    const drawW = () => {
      if (!w || !wg) return null;
      if (fig.wtype === 'whip' && (F.coil || F.lash)) {
        const res = BT.drawWeapon(b, 'whip', w.dir, whand, pal);
        if (F.lash) res.tip = BT.whipLash(b, res.tip, pal, F.lash === 'down' ? 6 : 1, F.lash === 'up' ? 3 : 0);
        else if (F.coil === 'up') { res.tip = BT.whipCoil(b, [whand[0] - 1, whand[1] - 12], pal); }
        else res.tip = BT.whipCoil(b, whand, pal);
        return res;
      }
      const res = BT.drawWeapon(b, fig.wtype, w.dir, whand, pal, { sparkle: fig.sparkle && F.sparkle });
      // a resting bow's string belongs to the bow's own layer (a drawn string is added after the hands)
      if (fig.wtype === 'bow' && res && F.string !== 'hn') BT.bowString(b, res.ends, null, pal);
      if (wclip != null) for (let y = wclip + 1; y < BT.H; y++) for (let x = 0; x < BT.W; x++) { const i = y * BT.W + x; if (!b.body[i]) { b.col[i] = null; b.tn[i] = null; } }
      return res;
    };
    let wres = null;
    // ------------------------------------------------ back to front
    if (w && w.layer === 'back') wres = drawW();
    if (fig.cape) cape(b, fig, J, fig.cape, F.cape);
    if (!F.ko) arm(b, fig, J, 'f', -1, { fist: F.fist === 'f' });
    const kF = leg(b, fig, J, 'f', -1);
    const kN = leg(b, fig, J, 'n', 0);
    torso(b, fig, J);
    if (F.ko) arm(b, fig, J, 'f', -1);
    fig.flutter = F.cape || 0;
    lower(b, fig, J, kN, kF);
    if (F.pouch || F.vial) pouch(b, fig, J);
    // a wind-up (armBack): the near arm goes up BEHIND the head so it never crosses the face;
    // the gripping hand is still drawn on top after the weapon (below)
    if (F.armBack) arm(b, fig, J, 'n', 0, { noHand: true });
    const headTop = stampHead(b, fig, J);
    if (BT._probe) BT._probe(b, fig, F, 'head', J); // test hook (tools/test_battlers.js §10: nothing crosses the face)
    if (F.armBack && !(w && w.hand !== 'f')) handAt(b, fig, J.hn, 0, F.fist === 'n');
    if (!F.armBack) arm(b, fig, J, 'n', 0, { noHand: !!(w && w.hand !== 'f'), fist: F.fist === 'n' });
    if (w && w.layer !== 'back') wres = drawW();
    // gripping hands over the weapon
    if (w && w.hand !== 'f') handAt(b, fig, J.hn, 0);
    if (w && (w.hand === 'f' || (BT.TWO_HANDED[fig.wtype] && !F.free)) && J.hf) handAt(b, fig, J.hf, w.hand === 'f' ? 0 : -1);
    if (fig.wtype === 'bow' && w && wres && F.string === 'hn') {
      BT.bowString(b, wres.ends, J.hn, pal);
      handAt(b, fig, J.hn, 0);
    }
    let arrowHead = null;
    if (F.arrow && fig.wtype === 'bow') arrowHead = BT.arrow(b, J.hn[0], J.hn[1], pal, 12);
    if (F.vial) vial(b, fig, J.hf);
    if (BT._probe) BT._probe(b, fig, F, 'end');
    // ------------------------------------------------ anchors (pre-flip)
    const castHand = F.castHand === 'n' ? J.hn : J.hf || J.hn;
    let tip;
    if (arrowHead) tip = arrowHead;
    else if (fig.wtype === 'bow' && F.open) tip = [J.hf[0] + 3, J.hf[1]];
    else if (F.fist === 'f' && J.hf) tip = [J.hf[0] + 1, J.hf[1]];
    else if (wres && wres.tip) tip = wres.tip;
    else tip = (w && w.hand === 'f' ? J.hf : J.hn) || J.hf;
    const pre = {
      head: headTop,
      hit: [r((J.n[0] + J.h[0]) / 2), r((J.n[1] + J.h[1]) / 2 + 1)],
      hand: (w && w.hand === 'f' ? J.hf : J.hn) || J.hf,
      tip,
      cast: [castHand[0] + 4, castHand[1]],
    };
    return { b, pre };
  };
})(window.RPG);
