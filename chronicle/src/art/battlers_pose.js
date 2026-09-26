// Party battle sprites (Part A8, DESIGN §11.4.4.4) — the pose tables.
// One skeleton per frame, in `normal`-build pixels, PRE-FLIP (facing right, +x =
// towards the enemy), feet centred on x 23 (→ 24 after the mirror), soles on row 38:
//   n  neck (the head's chin sits on n.y−1, the torso starts at n.y+1)
//   h  waist (pelvis centre)
//   fn / ff  ankle of the near (viewer-side, drawn over) / far leg; boots end on row 38
//   hn / hf  near / far hand. The near arm hangs from the back shoulder and is drawn
//            over the body; the far arm hangs from the front shoulder, behind the body.
//   w  the weapon: {dir, hand 'n'|'f', layer 'back'|'front'} (dir U FU F FD D BD B BU)
// Elbows and knees come from 2-bone IK. The build code (battlers.js) stretches
// the table to the other builds and heights. Hand positions depend on how the
// weapon is held (STYLE), so every pose is a function of the style.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const BT = (A._Battlers = A._Battlers || {});

  /** how each weapon family is held */
  BT.STYLE = {
    sword: 'one', katana: 'one', axe: 'one', club: 'one', greatsword: 'two', spear: 'spear',
    dagger: 'dagger', bow: 'bow', staff: 'staff', fist: 'fist', whip: 'whip',
  };

  const N0 = [22, 22], H0 = [22, 29], FN0 = [19, 36], FF0 = [26, 36];
  const add = (p, dx, dy) => (p ? [p[0] + dx, p[1] + dy] : p);
  /** frame from a base + overrides */
  const fr = (o) => Object.assign({ n: N0, h: H0, fn: FN0, ff: FF0 }, o);
  /** the same frame with the torso sunk by dy (breathing): neck, hands, weapon follow */
  function sink(f, dy, o) {
    const g = Object.assign({}, f, o || {});
    g.n = add(f.n, 0, dy);
    if (!f.planted) { g.hn = add(f.hn, 0, dy); g.hf = add(f.hf, 0, dy); }
    return g;
  }
  const W = (dir, layer, hand) => ({ dir, layer: layer || 'front', hand: hand || 'n' });

  // ------------------------------------------------------------ idle holds
  const IDLE = {
    one: { hn: [24, 28], hf: [26, 30], w: W('FU') },
    two: { hn: [23, 30], hf: null, w: W('FU') },
    spear: { hn: [21, 30], hf: null, w: W('FU') },
    dagger: { hn: [27, 29], hf: [27, 26], w: W('F') },
    bow: { hn: [20, 31], hf: [34, 29], w: W('U', 'front', 'f') },
    staff: { hn: [29, 29], hf: [24, 30], w: W('U') },
    fist: { hn: [25, 27], hf: [29, 25], w: null },
    whip: { hn: [21, 30], hf: [26, 30], w: W('U', 'front'), coil: true },
  };

  function idle(st) {
    const f0 = fr(Object.assign({ cape: 0 }, IDLE[st]));
    return [f0, sink(f0, 1, { cape: 1 })];
  }
  function walk(st) {
    const b = IDLE[st];
    const f0 = fr(Object.assign({}, b, { n: [23, 22], h: [23, 29], fn: [17, 36], ff: [29, 36], cape: 2 }));
    f0.hn = add(b.hn, 1, 0); f0.hf = add(b.hf, 1, 0);
    const f1 = fr(Object.assign({}, b, { n: [23, 21], h: [23, 28], fn: [22, 36], ff: [24, 36], cape: 1 }));
    f1.hn = add(b.hn, 1, -1); f1.hf = add(b.hf, 1, -1);
    return [f0, f1];
  }

  // ------------------------------------------------------------ attacks
  function slash(st) {
    const two = st === 'two' || st === 'spear';
    return [
      fr({ n: [20, 22], h: [21, 29], fn: [18, 36], ff: [27, 36], hn: two ? [19, 19] : [17, 20], hf: two ? null : [26, 27], w: W('BU', 'back'), cape: 2 }),
      fr({ n: [26, 23], h: [24, 29], fn: [18, 36], ff: [31, 36], hn: [31, 26], hf: two ? null : [20, 28], w: W('FD'), cape: 3 }),
      fr({ n: [26, 25], h: [24, 31], fn: [17, 36], ff: [31, 36], hn: [29, 30], hf: two ? null : [21, 30], w: W('FD'), cape: 3 }),
    ];
  }
  function thrust(st) {
    const two = st === 'two' || st === 'spear';
    const dg = st === 'dagger' || st === 'fist' || st === 'bow';
    const lng = st === 'spear' || st === 'staff'; // long shafts: hold further back so the head stays on the canvas
    return [
      fr({ n: [20, 22], h: [21, 29], fn: [18, 36], ff: [26, 36], hn: dg ? [21, 28] : lng ? [15, 29] : [19, 29], hf: two ? null : [25, 25], w: W(lng ? 'F' : 'F'), cape: 2 }),
      fr({ n: [25, 22], h: [24, 29], fn: [18, 36], ff: [30, 36], hn: dg ? [33, 26] : lng ? [23, 27] : [28, 27], hf: two ? null : [21, 28], w: W('F'), cape: 3 }),
      fr({ n: [25, 23], h: [24, 30], fn: [18, 36], ff: [30, 36], hn: dg ? [30, 27] : lng ? [22, 28] : [27, 28], hf: two ? null : [22, 29], w: W('F'), cape: 3 }),
    ];
  }
  function smash(st) {
    const two = st === 'two' || st === 'spear';
    return [
      fr({ n: [21, 22], h: [22, 29], fn: [19, 36], ff: [26, 36], hn: [21, 15], hf: two ? null : [24, 16], w: W('BU', 'back'), cape: 2 }),
      fr({ n: [25, 23], h: [24, 29], fn: [18, 36], ff: [30, 36], hn: [30, 24], hf: two ? null : [28, 25], w: W('FD'), cape: 3 }),
      fr({ n: [26, 25], h: [24, 31], fn: [18, 36], ff: [30, 36], hn: st === 'staff' ? [29, 27] : [30, 30], hf: two ? null : [28, 30], w: W(st === 'staff' ? 'FD' : 'F'), cape: 3 }),
    ];
  }
  function shoot(st) {
    if (st !== 'bow') {
      // a throw: the far hand flings forward, the weapon stays low in the near hand
      const low = lowHold(st);
      return [
        fr(Object.assign({}, low, { n: [21, 22], h: [22, 29], hf: [24, 20] })),
        fr(Object.assign({}, low, { n: [21, 22], h: [22, 29], hf: [22, 19] })),
        fr(Object.assign({}, low, { n: [24, 22], h: [23, 29], ff: [29, 36], hf: [32, 24] })),
      ];
    }
    const body = { n: [22, 22], h: [22, 29], fn: [18, 36], ff: [27, 36] };
    return [
      fr(Object.assign({}, body, { hf: [30, 26], hn: [27, 26], w: W('U', 'front', 'f'), string: 'hn', arrow: true })),
      fr(Object.assign({}, body, { n: [21, 22], hf: [30, 26], hn: [19, 25], w: W('U', 'front', 'f'), string: 'hn', arrow: true })),
      fr(Object.assign({}, body, { n: [21, 22], hf: [30, 26], hn: [17, 24], w: W('U', 'front', 'f'), open: true })),
    ];
  }
  function punch(st) {
    const low = st === 'fist' ? { w: null } : lowHold(st);
    return [
      fr(Object.assign({}, low, { hn: st === 'fist' ? [25, 27] : low.hn, hf: [28, 26] })),
      fr(Object.assign({}, low, { n: [25, 22], h: [24, 29], fn: [18, 36], ff: [30, 36], hn: st === 'fist' ? [26, 27] : low.hn, hf: [34, 25], fist: 'f', cape: 3 })),
      fr(Object.assign({}, low, { n: [24, 22], h: [23, 29], fn: [18, 36], ff: [29, 36], hn: st === 'fist' ? [25, 27] : low.hn, hf: [29, 26], cape: 2 })),
    ];
  }
  function lash(st) {
    const wh = st === 'whip';
    const two = st === 'two' || st === 'spear';
    return [
      fr({ n: [20, 22], h: [21, 29], fn: [18, 36], ff: [26, 36], hn: [18, 18], hf: two ? null : [26, 27], w: wh ? W('U', 'back') : W('BU', 'back'), coil: wh, cape: 2 }),
      fr({ n: [25, 23], h: [24, 29], fn: [18, 36], ff: [30, 36], hn: [29, 25], hf: two ? null : [21, 28], w: W(wh ? 'F' : 'F'), lash: wh ? 'up' : null, cape: 3 }),
      fr({ n: [25, 24], h: [24, 30], fn: [18, 36], ff: [30, 36], hn: [28, 29], hf: two ? null : [22, 30], w: W(wh ? 'F' : 'FD'), lash: wh ? 'down' : null, cape: 3 }),
    ];
  }

  // ------------------------------------------------------------ other poses
  /** the weapon kept low in the near hand (cast, throw, punch with a weapon) */
  function lowHold(st) {
    if (st === 'bow') return { hn: [20, 29], w: W('U', 'back') };
    if (st === 'fist') return { hn: [21, 30], w: null };
    if (st === 'two') return { hn: [20, 31], w: W('BD', 'back'), free: true };
    if (st === 'spear') return { hn: [20, 30], w: W('FU', 'back'), free: true };
    if (st === 'whip') return { hn: [20, 31], w: W('U', 'back'), coil: true };
    return { hn: [20, 31], w: W('BD', 'back') };
  }
  function cast(st) {
    if (st === 'staff') {
      return [
        fr({ hn: [23, 16], hf: [25, 17], w: W('U'), cape: 1 }),
        fr({ hn: [27, 24], hf: [29, 23], w: W('FU'), castHand: 'n', cape: 0 }),
        fr({ n: [24, 22], h: [23, 29], ff: [29, 36], hn: [30, 24], hf: [32, 23], w: W('FU'), castHand: 'n', cape: 3 }),
      ];
    }
    if (st === 'fist') {
      return [
        fr({ hn: [17, 13], hf: [27, 12], w: null, cape: 1 }),
        fr({ hn: [27, 25], hf: [29, 24], w: null, cape: 0 }),
        fr({ n: [24, 22], h: [23, 29], ff: [29, 36], hn: [29, 25], hf: [32, 24], w: null, cape: 3 }),
      ];
    }
    const low = lowHold(st);
    return [
      fr(Object.assign({}, low, { hf: [26, 18], cape: 1 })),
      fr(Object.assign({}, low, { hf: [30, 24], cape: 0 })),
      fr(Object.assign({}, low, { n: [24, 22], h: [23, 29], ff: [29, 36], hf: [33, 24], cape: 3 })),
    ];
  }
  function item() {
    return [
      fr({ hn: [19, 31], hf: [26, 30], w: null, pouch: true }),
      fr({ hn: [21, 30], hf: [30, 21], w: null, vial: true }),
    ];
  }
  function guard(st) {
    const body = { n: [22, 24], h: [22, 31], fn: [18, 36], ff: [27, 36] };
    const G = {
      one: { hn: [26, 28], hf: [27, 29], w: W('U') },
      two: { hn: [25, 30], hf: null, w: W('U') },
      spear: { hn: [25, 31], hf: null, w: W('U') },
      dagger: { hn: [26, 27], hf: [27, 29], w: W('U') },
      bow: { hn: [25, 29], hf: [29, 28], w: W('U', 'front', 'f') },
      staff: { hn: [26, 29], hf: [27, 27], w: W('U') },
      fist: { hn: [27, 26], hf: [28, 25], w: null, cross: true },
      whip: { hn: [26, 28], hf: [27, 29], w: W('U'), coil: true },
    };
    return [fr(Object.assign({}, body, G[st]))];
  }
  function hit(st) {
    const o = { n: [19, 24], h: [21, 29], fn: [18, 36], ff: [25, 36], hn: [16, 28], hf: [22, 29], w: W('BD'), cape: 2 };
    if (st === 'bow') { o.hn = [17, 29]; o.hf = [23, 29]; o.w = W('U', 'front', 'f'); }
    if (st === 'fist') o.w = null;
    if (st === 'whip') { o.w = W('BD'); o.coil = true; }
    if (st === 'two' || st === 'spear') o.free = true;
    return [fr(o)];
  }
  function weak(st) {
    const body = { n: [24, 27], h: [21, 32], fn: [16, 37], ff: [28, 36], kneel: 'n', planted: true };
    let o;
    if (st === 'bow') o = { hn: [33, 30], hf: [26, 33], w: W('U'), plant: true };
    else if (st === 'staff') o = { hn: [30, 29], hf: [26, 33], w: W('U'), plant: true };
    else if (st === 'fist') o = { hn: [29, 36], hf: [26, 33], w: null };
    else if (st === 'whip') o = { hn: [28, 31], hf: [26, 33], w: W('D'), coil: true };
    else o = { hn: [30, 29], hf: st === 'two' || st === 'spear' ? null : [28, 31], w: W('D'), plant: true };
    const f0 = fr(Object.assign({}, body, o));
    const f1 = Object.assign({}, f0, { n: [24, 26] });
    return [f0, f1];
  }
  function victory(st) {
    const o = { hn: [19, 13], hf: [25, 30], w: W('U'), raise: true };
    if (st === 'two' || st === 'spear') { o.hf = null; }
    if (st === 'fist') { o.w = null; o.hn = [16, 12]; o.fist = 'n'; }
    if (st === 'whip') { o.coil = 'up'; }
    if (st === 'bow') o.w = W('U', 'back'); // the head hides the string; the limbs show round it
    const f0 = fr(o);
    const f1 = Object.assign({}, f0, { n: [22, 21], h: [22, 28], hop: 1 });
    f1.hn = add(f0.hn, 0, -1); f1.hf = add(f0.hf, 0, -1);
    return [f0, f1];
  }
  /** ko is drawn from this standing figure, turned 90° (see battlers.js) */
  function ko(st) {
    return [fr({ n: [23, 22], h: [23, 29], fn: [22, 36], ff: [24, 36], hn: [21, 31], hf: [25, 31], w: null, ko: true })];
  }

  BT.POSE_FN = { idle, walk, slash, thrust, smash, shoot, punch, lash, cast, item, guard, hit, weak, ko, victory };
})(window.RPG);
