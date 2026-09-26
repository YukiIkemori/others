// Party battle sprites for the side-view battle (Part A8, DESIGN §11.4.4. Owner SV-ART).
// Every party look (the hero in 2 genders × 5 types and the 20 companions) gets a
// 48×40, left-facing battle figure with 15 poses / 34 frames, generated from parts:
//   body base (gender × build × height) + the FIELD head parts 1:1 (hair, face,
//   hat, beard, overlays) + the outfit shape of the field body type + the field
//   palette letters + the cape + the weapon of the equipped weapon family.
// Nothing here touches R.Art.Chars (CA) at load time: chars*.js load after this
// file, so CA is only read inside functions.
//
//   R.Art.battler(who, opts) → BattlerSheet (cached in R.Gfx under battlerKey)
//   R.Art.battlerKey(who, opts) → 'btl:<lookId>:<wtype>[:<grade>]'
//   R.Art.battlerWtype(c, slot = 'weapon1') → wtype
//   R.Art.BATTLER = {W, H, FEET, POSES, FRAMES, HOLD, IMPACT, FAMILY, LOOK}
// Files: battlers.js (this: API, sheet, ko, anchors), battlers_body.js (body,
// outfits, head), battlers_draw.js (paint model), battlers_pose.js (skeletons),
// battlers_weapons.js (the 11 weapons). Contact sheets: tools/sheet_battlers.js;
// tests: tools/test_battlers.js.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const BT = (A._Battlers = A._Battlers || {});

  const POSES = ['idle', 'walk', 'slash', 'thrust', 'smash', 'shoot', 'punch', 'lash', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory'];
  const FRAMES = { idle: 2, walk: 2, slash: 3, thrust: 3, smash: 3, shoot: 3, punch: 3, lash: 3, cast: 3, item: 2, guard: 1, hit: 1, weak: 2, ko: 1, victory: 2 };
  const HOLD = {
    idle: [24, 24], walk: [4, 4], slash: [5, 3, 10], thrust: [5, 3, 10], smash: [6, 3, 10], shoot: [6, 4, 10], punch: [4, 3, 10],
    lash: [5, 3, 10], cast: [6, 10, 8], item: [6, 10], guard: [60], hit: [12], weak: [30, 30], ko: [60], victory: [12, 12],
  };
  const LOOPS = { idle: 1, walk: 1, guard: 1, weak: 1, ko: 1, victory: 1 };
  const IMPACT = { slash: 1, thrust: 1, smash: 1, shoot: 2, punch: 1, lash: 1, cast: 2, item: 1 };
  const FAMILY = {
    sword: 'slash', katana: 'slash', greatsword: 'slash', axe: 'smash', club: 'smash', staff: 'smash',
    spear: 'thrust', dagger: 'thrust', bow: 'shoot', fist: 'punch', whip: 'lash',
  };
  // §11.4.4.5: gender · build · height; outfit = the field body type's shape, cape = style.cape
  const LOOK = {
    selma: { gender: 'f', build: 'normal', height: 0, outfit: 'armor', cape: null },
    hagen: { gender: 'm', build: 'sturdy', height: 0, outfit: 'tunic', cape: 'mantle' },
    dokka: { gender: 'm', build: 'sturdy', height: 'short', outfit: 'dwarf', cape: null },
    basil: { gender: 'm', build: 'sturdy', height: 0, outfit: 'robe', cape: 'mantle' },
    bartolo: { gender: 'm', build: 'normal', height: 0, outfit: 'armor', cape: 'long' },
    viola: { gender: 'f', build: 'slim', height: 0, outfit: 'coat', cape: 'long' },
    shigure: { gender: 'm', build: 'slim', height: 0, outfit: 'gi', cape: null },
    rouga: { gender: 'm', build: 'sturdy', height: 0, outfit: 'gi', cape: null },
    titta: { gender: 'f', build: 'slim', height: 'youth', outfit: 'light', cape: null },
    brigitta: { gender: 'f', build: 'normal', height: 0, outfit: 'tunic', cape: null },
    sylvain: { gender: 'm', build: 'slim', height: 0, outfit: 'light', cape: null },
    zafira: { gender: 'f', build: 'slim', height: 0, outfit: 'light', cape: null },
    ferno: { gender: 'm', build: 'slim', height: 0, outfit: 'light', cape: 'mantle' },
    belladonna: { gender: 'f', build: 'normal', height: 0, outfit: 'coat', cape: null },
    boden: { gender: 'm', build: 'sturdy', height: 0, outfit: 'coat', cape: null },
    teo: { gender: 'm', build: 'slim', height: 'youth', outfit: 'robe', cape: null },
    ilse: { gender: 'f', build: 'slim', height: 0, outfit: 'robe', cape: 'mantle' },
    morga: { gender: 'f', build: 'normal', height: 0, outfit: 'robe', cape: null },
    marta: { gender: 'f', build: 'normal', height: 0, outfit: 'coat', cape: null },
    noela: { gender: 'f', build: 'slim', height: 0, outfit: 'hakama', cape: null },
  };
  const HERO = { warrior: ['tunic', null], ranger: ['light', null], mage: ['robe', null], spellblade: ['armor', 'long'], wanderer: ['coat', 'mantle'] };
  for (const g of ['m', 'f']) for (const t in HERO) LOOK['hero_' + g + '_' + t] = { gender: g, build: 'normal', height: 0, outfit: HERO[t][0], cape: HERO[t][1] };

  const BATTLER = (A.BATTLER = { W: 48, H: 40, FEET: [24, 39], POSES, FRAMES, HOLD, IMPACT, FAMILY, LOOK, LOOPS });
  const WTYPES = Object.keys(FAMILY);

  // ------------------------------------------------------------------ API
  const DB = () => R.DB || {};
  const lookOf = (who) => (typeof who === 'string' ? who : R.Party && R.Party.spriteId ? R.Party.spriteId(who) : 'hero_m_warrior');
  function itemOf(id) { const it = id && DB().items ? DB().items[id] : null; return it || null; }

  A.battlerWtype = function (c, slot) {
    slot = slot || 'weapon1';
    if (!c || typeof c === 'string' || !c.equip) return 'fist';
    const other = slot === 'weapon2' ? 'weapon1' : 'weapon2';
    for (const s of [slot, other]) {
      const it = itemOf(c.equip[s]);
      if (it && FAMILY[it.wtype]) return it.wtype;
    }
    return 'fist';
  };
  function gradeOf(who, opts) {
    if (opts && opts.grade) return opts.grade;
    if (!who || typeof who === 'string' || !who.equip) return 'normal';
    const it = itemOf(who.equip.weapon1) || itemOf(who.equip.weapon2);
    return (it && it.grade) || 'normal';
  }
  A.battlerKey = function (who, opts) {
    opts = opts || {};
    const wt = opts.wtype || A.battlerWtype(who);
    const g = gradeOf(who, opts);
    return 'btl:' + lookOf(who) + ':' + wt + (g && g !== 'normal' ? ':' + g : '');
  };
  A.battler = function (who, opts) {
    opts = opts || {};
    const look = lookOf(who);
    const wtype = FAMILY[opts.wtype] ? opts.wtype : A.battlerWtype(who);
    const grade = gradeOf(who, opts);
    const key = A.battlerKey(who, { wtype, grade });
    if (!R.Gfx.has(key)) R.Gfx.def(key, () => buildSafe(look, wtype, grade, key));
    return R.Gfx.get(key);
  };

  // ------------------------------------------------------------------ sheet
  function buildSafe(look, wtype, grade, key) {
    try {
      const s = buildSheet(look, wtype, grade);
      s.key = key;
      return s;
    } catch (e) {
      R.warn('battler: stand-in for', key, e && e.message);
      const s = fallbackSheet(look, wtype);
      s.key = key;
      return s;
    }
  }

  /** figure data shared by every frame of a sheet */
  function makeFig(look, wtype, grade) {
    const CA = A.Chars;
    const who = CA && CA.parts && CA.parts.party ? CA.parts.party[look] : null;
    const L = LOOK[look];
    if (!who || !L) throw new Error('no party look ' + look);
    const pal = CA.partyPalette(who);
    const st = who.style || {};
    const bodyName = st.variant || (who.gender === 'f' && st.bodyF) || st.body;
    const outfit = BT.OUTFIT_OF[bodyName] || L.outfit || 'tunic';
    return {
      look, who, pal, wtype, grade, style: BT.STYLE[wtype] || 'fist',
      B: BT.buildParams(L, who.gender || L.gender),
      M: BT.materials(pal),
      out: BT.OUT[outfit], outfit,
      skirt: bodyName === 'fighterF' ? 'short' : bodyName === 'lightF' ? 'knee' : null,
      cape: st.cape === 'long' || st.cape === 'mantle' ? st.cape : null,
      head: BT.headLayer(who, pal),
      wpal: BT.weaponPal(pal, grade),
      sparkle: grade === 'super',
    };
  }
  BT.makeFig = makeFig;

  function buildSheet(look, wtype, grade) {
    const fig = makeFig(look, wtype, grade);
    const OUTL = A.Chars.OUTLINE;
    const poses = {};
    for (const p of POSES) {
      const frames = BT.POSE_FN[p](fig.style).map((F, i) => {
        const Fx = Object.assign({}, F, { sparkle: (p === 'idle' && i === 0) || p === 'victory' });
        const res = p === 'ko' ? koFrame(fig, Fx) : BT.renderFrame(fig, Fx);
        return toFrame(res, OUTL);
      });
      poses[p] = { frames, hold: HOLD[p].slice(0, frames.length), loop: !!LOOPS[p], impact: p in IMPACT ? IMPACT[p] : null };
    }
    return sheetOf(look, wtype, poses, false);
  }
  BT.buildSheet = buildSheet;

  function sheetOf(look, wtype, poses, pending) {
    return {
      key: null, look, wtype, family: FAMILY[wtype] || 'punch', W: 48, H: 40, poses, pending,
      frame(pose, t) {
        const P = this.poses[pose] || this.poses.idle;
        const n = P.frames.length;
        if (n === 1) return P.frames[0];
        const total = P.hold.reduce((a, b) => a + b, 0) || 1;
        t = Math.max(0, Math.floor(t || 0));
        if (P.loop) t %= total;
        else if (t >= total) return P.frames[n - 1];
        for (let i = 0; i < n; i++) { if (t < P.hold[i]) return P.frames[i]; t -= P.hold[i]; }
        return P.frames[n - 1];
      },
    };
  }

  /** pixels + pre-flip anchors → Frame (left-facing) */
  function toFrame(res, outline) {
    const W = BT.W, H = BT.H;
    const fin = BT.finish(res.b, outline);
    const p = R.Gfx.pix(W, H);
    for (let i = 0; i < W * H; i++) p.d[i] = fin.px[i];
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fin.body[y * W + x] && fin.px[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const fl = (q) => [Math.max(0, Math.min(W - 1, W - 1 - Math.round(q[0]))), Math.max(0, Math.min(H - 1, Math.round(q[1])))];
    const a = res.pre;
    return {
      img: p.toCanvas(), feet: [24, 39], head: fl(a.head), hit: fl(a.hit), hand: fl(a.hand), tip: fl(a.tip), cast: fl(a.cast),
      box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    };
  }

  /** ko: the standing ko figure turned 90° counter-clockwise (head behind, feet in front), on its back */
  function koFrame(fig, F) {
    const W = BT.W, H = BT.H;
    const res = BT.renderFrame(fig, F);
    const b = res.b;
    const pts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!BT.filled(b, i)) continue;
      pts.push([y, W - 1 - x, BT.colorAt(b, i), b.body[i]]);
    }
    let x0 = 99, x1 = -99, y1 = -99;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    const dx = Math.round(23.5 - (x0 + x1) / 2), dy = BT.SOLE - y1;
    const rot = (q) => [q[1] + dx, W - 1 - q[0] + dy];
    const b2 = BT.Buf();
    // the dropped weapon lies on the ground beside the body (under it)
    if (fig.wtype !== 'fist') {
      const g = [Math.round(23.5 - 6), BT.SOLE - 1];
      if (fig.wtype === 'whip') BT.whipCoil(b2, [g[0] + 12, BT.SOLE - 7], fig.wpal);
      else BT.drawWeapon(b2, fig.wtype, fig.wtype === 'bow' ? 'F' : 'F', g, fig.wpal);
      for (let i = (BT.SOLE + 1) * W; i < W * H; i++) { b2.col[i] = null; b2.tn[i] = null; }
    }
    for (const p of pts) {
      const X = p[0] + dx, Y = p[1] + dy;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const i = Y * W + X;
      b2.tn[i] = null; b2.col[i] = p[2]; b2.body[i] = p[3];
    }
    const a = res.pre;
    const hd = rot(a.head);
    const hand = rot(a.hand);
    return { b: b2, pre: { head: [hd[0], Math.max(0, hd[1] - 4)], hit: rot(a.hit), hand, tip: hand, cast: [hand[0] + 4, hand[1]] } };
  }

  // ------------------------------------------------------------------ stand-in (§11.1.3)
  /** every frame = the field 'party:<id>' left[0] placed on the feet point; pending: true */
  function fallbackSheet(look, wtype) {
    const PENDING = (A.PENDING = A.PENDING || []);
    if (!PENDING.includes('btl:' + look)) PENDING.push('btl:' + look);
    let src = null;
    try { const sh = R.Gfx.has('party:' + look) ? R.Gfx.get('party:' + look) : null; src = sh && sh.left ? sh.left[0] : null; } catch (e) { src = null; }
    const cv = R.Gfx.makeCanvas(48, 40);
    if (src) cv.getContext('2d').drawImage(src, 16, 16);
    const fr = { img: cv, feet: [24, 39], head: [24, 16], hit: [24, 28], hand: [20, 30], tip: [16, 30], cast: [14, 28], box: { x: 16, y: 16, w: 16, h: 24 } };
    const poses = {};
    for (const p of POSES) poses[p] = { frames: new Array(FRAMES[p]).fill(fr), hold: HOLD[p].slice(), loop: !!LOOPS[p], impact: p in IMPACT ? IMPACT[p] : null };
    return sheetOf(look, wtype, poses, true);
  }
  BT.fallbackSheet = fallbackSheet;
  BT.WTYPES = WTYPES;
})(window.RPG);
