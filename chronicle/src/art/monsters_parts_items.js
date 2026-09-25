// Monster parts, held items (A14a mons-parts, DESIGN §9.4.4): sword spear axe staff bow club_iron pick bomb
// cannon baton quill parasol (hand), shield book (hand2), violin flute (hand), drum (body).
// Long items are drawn in a frame that follows the hand's direction (anchors.handDir, default: straight up
// leaning outward), so the same shapes work on any base. A base that already holds something clears it
// first (anchors.erase.hand / hand2), and bases without hands get the item floating beside the body.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const PARTS = (A.PARTS = A.PARTS || {});
  const TK = () => A.PartTK;
  const WOOD = '#8a6040', LEATHER = '#5a3424', GOLD = '#d8a830';

  /** direction of a held item in degrees (0 = right, -90 = up) */
  function handDir(o, hand, key) {
    const an = o.anchors;
    if (key === 'hand' && an.handDir != null) return an.handDir;
    if (key === 'hand2' && an.hand2Dir != null) return an.hand2Dir;
    return hand[0] < an.body[0] ? -104 : -76;
  }
  /**
   * Rasterise a shape given in the item's own frame: t along the handle (0 = the hand, + toward the tip),
   * s across it (+ = the lit side, toward the upper-left light). fn(t, s) → colour | null.
   */
  function frame(p, hx, hy, deg, tMin, tMax, sMax, fn) {
    const r = (deg * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r);
    let vx = -uy, vy = ux;
    if (vx * -0.6 + vy * -0.8 < 0) { vx = -vx; vy = -vy; }
    const R0 = Math.max(Math.abs(tMin), Math.abs(tMax)) + sMax + 2;
    for (let y = Math.floor(hy - R0); y <= Math.ceil(hy + R0); y++) for (let x = Math.floor(hx - R0); x <= Math.ceil(hx + R0); x++) {
      const dx = x - hx, dy = y - hy;
      const t = dx * ux + dy * uy, s = dx * vx + dy * vy;
      if (t < tMin - 0.5 || t > tMax + 0.5 || Math.abs(s) > sMax + 0.5) continue;
      const c = fn(t, s);
      if (c) p.set(x, y, c);
    }
    return { ux, uy, vx, vy, at: (t, s) => [Math.round(hx + ux * t + vx * s), Math.round(hy + uy * t + vy * s)] };
  }
  /** colour across a round shaft of half-width w: lit edge, body, shadow edge */
  const across = (rmp, s, w) => (s > w * 0.35 ? rmp[rmp.length - 2] : s < -w * 0.35 ? rmp[1] : rmp[Math.floor(rmp.length / 2)]);
  const L0 = (k) => Math.round(8 + 5 * k); // reference item length (s 13 / m 16 / l 18)
  function grip(o, key) { o.eraseAt(key); }

  // ---------------------------------------------------------------- sword 剣
  PARTS.sword = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const st = o.style;
    const great = st === 'great', ice = st === 'ice';
    const L = Math.round(L0(k) * (great ? 1.35 : 1) * (o.size === 's' && k > 1 ? 0.7 : 1));
    const bw = (k < 1.3 ? 0.8 : k < 1.8 ? 1.1 : 1.4) + (great ? 0.7 : 0);
    const blade = ice ? T.ramp(o.c || '#e0f8ff', 5, { dark: 0.35, light: 0.8 }) : T.metal(o.c || '#d0d4e0', 5);
    const guard = T.metal(o.c2 || (ice ? '#80c0e8' : GOLD), 4);
    const leather = T.ramp(LEATHER, 3);
    const g = Math.round(1.5 + k), gt = Math.max(1, Math.round(k * 0.8)), gw = bw + 1.2 + (great ? 0.8 : 0) * k;
    const f = frame(p, a[0], a[1], deg, -g - 1, L, gw + 1, (t, s) => {
      if (t < -g) return Math.abs(s) <= 0.8 ? guard[2] : null;                      // pommel
      if (t < 0) return Math.abs(s) <= 0.55 + (k >= 1.8 ? 0.3 : 0) ? leather[(Math.round(t) & 1) + 1] : null;
      if (t < gt) return Math.abs(s) <= gw ? (s > 0 ? guard[3] : guard[1]) : null; // cross guard
      const u = (t - gt) / (L - gt);
      let hw = u > 0.78 ? bw * (1 - (u - 0.78) / 0.22) : bw;
      if (ice) hw += Math.sin(t * 1.7) * 0.35;
      if (Math.abs(s) > hw + 0.25) return null;
      if (great && Math.abs(s) < 0.4 && u > 0.08 && u < 0.7) return blade[1];     // fuller
      return s > hw * 0.3 ? blade[4] : s < -hw * 0.3 ? blade[1] : blade[great ? 3 : 2];
    });
    const [tx, ty] = f.at(L, 0);
    o.fx.set(tx, ty, '#ffffff');
    const [mx, my] = f.at(Math.round(L * 0.45), bw * 0.5);
    o.fx.set(mx, my, '#ffffff');
    if (ice) for (let i = 0; i < 3; i++) { const [x, y] = f.at(gt + (L - gt) * (0.25 + i * 0.25), (i % 2 ? 1 : -1) * (bw + 1.5)); o.fx.set(x, y, '#e8ffff'); }
  };

  // ---------------------------------------------------------------- spear 槍
  PARTS.spear = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const L = Math.round(L0(k) * 1.25), head = Math.round(3 + 2 * k), sw = k < 1.3 ? 0.5 : 0.8;
    const wood = T.ramp(o.c2 || WOOD, 4), steel = T.metal(o.c || '#c0c4d0', 5);
    const f = frame(p, a[0], a[1], deg, -Math.round(L * 0.45), L + head, 2 * k, (t, s) => {
      if (t <= L) return Math.abs(s) <= sw ? across(wood, s, sw) : null;
      const u = (t - L) / head;
      const hw = u < 0.35 ? 0.6 + u * 3.4 * k * 0.6 : (1 - u) * 1.9 * k * 0.6 + 0.2;
      if (Math.abs(s) > hw) return null;
      return s > 0 ? steel[4] : s < -hw * 0.4 ? steel[1] : steel[2];
    });
    // binding under the head, a tassel
    const [bx, by] = f.at(L - 1, 0); p.set(bx, by, '#c03030');
    const [cx, cy] = f.at(L - 2, sw + 1); o.fx.set(cx, cy, '#e04040');
    const [tx, ty] = f.at(L + head, 0); o.fx.set(tx, ty, '#ffffff');
  };

  // ---------------------------------------------------------------- axe 斧
  PARTS.axe = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const L = Math.round(L0(k) * 0.95), sw = k < 1.3 ? 0.55 : 0.85;
    const wood = T.ramp(o.c2 || WOOD, 4), steel = T.metal(o.c || '#b8c0c8', 5);
    // the blade faces away from the body
    const r = (deg * Math.PI) / 180;
    let vx = -Math.sin(r), vy = Math.cos(r);
    if (vx * -0.6 + vy * -0.8 < 0) { vx = -vx; vy = -vy; }
    const outward = Math.sign((a[0] - an.body[0]) * vx + 0.001) || 1;
    const h0 = L * 0.62, h1 = L * 0.95, bl = 2.4 + 1.6 * k;
    frame(p, a[0], a[1], deg, -Math.round(L * 0.3), L, bl + 1, (t, s) => {
      const so = s * outward;
      if (t >= h0 && t <= h1 && so > 0) {
        const u = (t - h0) / (h1 - h0);
        const reach = bl * (0.55 + 0.45 * Math.sin(u * Math.PI)) + (u < 0.15 || u > 0.85 ? 0.8 : 0);
        if (so <= reach + 0.3) return so > reach - 0.9 ? steel[4] : u < 0.4 ? steel[3] : u > 0.75 ? steel[1] : steel[2];
      }
      if (t >= h0 + 1 && t <= h1 - 1 && so < 0 && so > -1.4 * k) return steel[1];           // back spike
      if (Math.abs(s) <= sw && t <= L) return t > h1 - 0.5 ? steel[3] : across(wood, s, sw);
      return null;
    });
  };

  // ---------------------------------------------------------------- staff 杖
  PARTS.staff = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const st = o.style;
    const L = Math.round(L0(k) * 1.15), sw = k < 1.3 ? 0.55 : 0.85;
    const shaft = T.ramp(o.c || WOOD, 4, { dark: 0.55, light: 0.45 });
    const gemC = o.gem || '#80ff80';
    const gemR = T.ramp(gemC, 4, { dark: 0.5, light: 0.7 });
    const f = frame(p, a[0], a[1], deg, -Math.round(L * 0.5), L, 1, (t, s) => (Math.abs(s) <= sw ? across(shaft, s, sw) : null));
    const [ex, ey] = f.at(L + (k < 1.3 ? 1 : 2), 0);
    if (st === 'coral') {
      // branching coral crown at the top
      const m = T.mask(p.w, p.h);
      const [bx, by] = f.at(L - 1, 0);
      for (const d of [-1, 0, 1]) {
        const ang = (deg * Math.PI) / 180 + d * 0.55;
        const l2 = (2.5 + 1.5 * k) * (d ? 0.8 : 1);
        T.tube(m, [[bx, by], [bx + Math.cos(ang) * l2 * 0.6, by + Math.sin(ang) * l2 * 0.6], [bx + Math.cos(ang + d * 0.3) * l2, by + Math.sin(ang + d * 0.3) * l2]], 0.6 * k, 0.4 * k, 1, 8);
      }
      p.blit(T.shade(m, T.ramp(o.c || '#e07080', 4), { depth: 1 }), 0, 0);
      const gm = T.mask(p.w, p.h); gm.ellipse(ex, ey + 1, 0.8 * k + 0.3, 0.8 * k + 0.3, 1);
      p.blit(T.shade(gm, gemR, { depth: 1 }), 0, 0); o.fx.set(ex, ey, '#ffffff');
      return;
    }
    if (st === 'coil') {
      // a copper coil wound round the top, a glowing ball and arcs of electricity
      const cop = T.metal('#c08040', 4);
      for (let t = Math.round(L * 0.55); t < L; t++) for (const s of [-sw - 0.6, sw + 0.6]) { const [x, y] = f.at(t, (t & 1 ? s : -s) * 0.9); p.set(x, y, (t & 1) ? cop[3] : cop[1]); }
      const gm = T.mask(p.w, p.h); gm.ellipse(ex, ey, 1.2 * k, 1.2 * k, 1);
      p.blit(T.shade(gm, gemR, { depth: 1.2 }), 0, 0); o.fx.set(ex - 1, ey - 1, '#ffffff');
      for (let i = 0; i < 3; i++) { const ang = o.rng() * Math.PI * 2; for (let r = Math.round(1.6 * k); r < 3.2 * k; r++) { const x = Math.round(ex + Math.cos(ang) * r + (r & 1)), y = Math.round(ey + Math.sin(ang) * r); o.fx.set(x, y, r & 1 ? gemR[3] : '#ffffff'); } }
      return;
    }
    // a claw of the shaft's wood holding an orb
    const gr = k < 1.3 ? 1 : k < 1.8 ? 1.4 : 1.9;
    const gm = T.mask(p.w, p.h); gm.ellipse(ex, ey, gr, gr, 1);
    p.blit(T.shade(gm, gemR, { depth: 1.2, amb: 0.25 }), 0, 0);
    o.fx.set(Math.round(ex - gr * 0.4), Math.round(ey - gr * 0.4), '#ffffff');
    for (const s of [-1, 1]) { const [x, y] = f.at(L + 1, s * (gr + 0.6)); p.set(x, y, shaft[2]); const [x2, y2] = f.at(L + gr + 1, s * (gr * 0.6)); p.set(x2, y2, shaft[3]); }
    // glow around the orb
    for (const [dx, dy] of [[-1, -1], [1, -1], [0, -2], [-2, 0], [2, 0]]) { const x = Math.round(ex + dx * gr), y = Math.round(ey + dy * gr); if (p.get(x, y) == null && !o.info.on(x, y)) o.fx.set(x, y, gemR[3]); }
  };

  // ---------------------------------------------------------------- bow 弓
  PARTS.bow = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand') + (a[0] < an.body[0] ? 10 : -10);
    const L = Math.round(L0(k) * 0.9), bulge = 2 + 1.2 * k;
    const wood = T.ramp(o.c || '#a08040', 4);
    const r = (deg * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r);
    // the limbs bend away from the body
    const side = a[0] < an.body[0] ? -1 : 1;
    let vx = -uy, vy = ux; if (vx * side < 0) { vx = -vx; vy = -vy; }
    const pt = (t, s) => [Math.round(a[0] + ux * t + vx * s), Math.round(a[1] + uy * t + vy * s)];
    let prev = null;
    for (let t = -L / 2; t <= L / 2; t += 0.25) {
      const u = (2 * t) / L;
      const s = bulge * (1 - u * u);
      const [x, y] = pt(t, s);
      p.set(x, y, Math.abs(u) < 0.2 ? LEATHER : wood[u < 0 ? 1 : 2]);
      if (k >= 1.5) { const [x2, y2] = pt(t, s + 0.8); p.set(x2, y2, wood[u < 0 ? 2 : 3]); }
      prev = [x, y];
    }
    void prev;
    // the string, and an arrow resting on it
    const [sx0, sy0] = pt(-L / 2, 0), [sx1, sy1] = pt(L / 2, 0);
    T.line(o.fx, sx0, sy0, sx1, sy1, '#e8e4d8');
    const [ax0, ay0] = pt(-1, -1), [ax1, ay1] = pt(-1, bulge + 2.5 * k);
    T.line(p, ax0, ay0, ax1, ay1, wood[3]);
    p.set(ax1, ay1, '#d0d4e0');
  };

  // ---------------------------------------------------------------- club_iron 金棒
  PARTS.club_iron = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const L = Math.round(L0(k) * 1.05);
    const iron = T.metal(o.c || '#505860', 5);
    const f = frame(p, a[0], a[1], deg, -Math.round(L * 0.22), L, 2.2 * k, (t, s) => {
      const u = (t + L * 0.22) / (L * 1.22);
      const hw = u < 0.25 ? 0.7 + (k >= 1.5 ? 0.3 : 0) : 0.8 + (u - 0.25) * 1.9 * k * 0.75;
      if (Math.abs(s) > hw) return null;
      if (u < 0.2) return Math.abs(s) < 0.5 ? LEATHER : '#3a2418';
      // facets: three bands across
      return s > hw * 0.4 ? iron[3] : s < -hw * 0.4 ? iron[1] : iron[2];
    });
    // studs
    for (let t = Math.round(L * 0.25); t <= L - 1; t += Math.round(1.5 + k * 0.7)) {
      const u = (t + L * 0.22) / (L * 1.22), hw = 0.8 + (u - 0.25) * 1.9 * k * 0.75;
      for (const s of [-hw * 0.6, hw * 0.6]) { const [x, y] = f.at(t, s + ((t & 1) ? 0.4 : -0.4)); p.set(x, y, iron[4]); }
    }
    const [tx, ty] = f.at(L, 0); p.set(tx, ty, iron[3]);
  };

  // ---------------------------------------------------------------- pick つるはし
  PARTS.pick = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand');
    const L = Math.round(L0(k) * 0.9), sw = k < 1.3 ? 0.55 : 0.85;
    const wood = T.ramp(o.c2 || WOOD, 4), steel = T.metal(o.c || '#c0c8d0', 5);
    const reach = 3 + 2.4 * k;
    frame(p, a[0], a[1], deg, -Math.round(L * 0.3), L + 1.5 * k, reach + 1, (t, s) => {
      // the head: a curved double point across the top of the haft
      const ht = L - Math.abs(s) * Math.abs(s) * 0.12;
      const thick = (1 - Math.abs(s) / reach) * (0.9 + 0.5 * k) + 0.3;
      if (Math.abs(s) <= reach && Math.abs(t - ht) <= thick) return t > ht ? steel[4] : Math.abs(s) > reach * 0.7 ? steel[3] : steel[2];
      if (Math.abs(s) <= sw && t < L) return across(wood, s, sw);
      return null;
    });
  };

  // ---------------------------------------------------------------- bomb 火薬玉
  PARTS.bomb = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const r = 1.6 + 1.1 * k;
    const cx = a[0], cy = a[1] - Math.round(r * 0.7);
    const m = T.mask(p.w, p.h); m.ellipse(cx, cy, r, r, 1);
    const blk = T.ramp(o.c || '#303030', 4, { dark: 0.5, light: 0.45 });
    p.blit(T.shade(m, blk, { depth: 2, amb: 0.2 }), 0, 0);
    o.fx.set(Math.round(cx - r * 0.45), Math.round(cy - r * 0.45), '#c8c8d0');
    // neck cap, fuse and the spark
    const top = Math.round(cy - r);
    p.set(cx, top, '#807060'); if (k >= 1.5) p.set(cx + 1, top, '#605040');
    const fz = [[cx + 1, top - 1], [cx + 1, top - 2], [cx + 2, top - 3]];
    if (k >= 1.5) fz.push([cx + 3, top - 3]);
    fz.forEach(([x, y]) => p.set(x, y, '#a07850'));
    const [sx, sy] = fz[fz.length - 1];
    o.fx.set(sx + 1, sy - 1, '#fff0a0'); o.fx.set(sx + 2, sy - 1, '#ff9030'); o.fx.set(sx + 1, sy - 2, '#ff9030'); o.fx.set(sx, sy - 1, '#ffd060');
  };

  // ---------------------------------------------------------------- cannon 大砲 (hand cannon, pointing outward)
  PARTS.cannon = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const out = a[0] < an.body[0] ? -1 : 1;
    const deg = out < 0 ? -160 : -20;
    const L = Math.round(L0(k) * 0.85), bw = 1 + 0.6 * k;
    const iron = T.metal(o.c || '#404048', 5);
    const f = frame(p, a[0], a[1], deg, -Math.round(L * 0.25), L, bw + 1.2, (t, s) => {
      const u = (t + L * 0.25) / (L * 1.25);
      let hw = bw * (1.15 - u * 0.25);
      if (u > 0.9) hw += 0.7;                      // muzzle swell
      if (t < -L * 0.18) hw = bw * 0.9;            // breech knob
      if (Math.abs(s) > hw) return null;
      const band = [0.15, 0.45, 0.9].some((b) => Math.abs(u - b) < 0.05);
      if (band) return s > 0 ? iron[4] : iron[2];
      return s > hw * 0.35 ? iron[3] : s < -hw * 0.35 ? iron[0] : iron[1];
    });
    const [mx, my] = f.at(L, 0); p.set(mx, my, '#100c10'); if (k >= 1.5) { const [m2x, m2y] = f.at(L, 0.8); p.set(m2x, m2y, '#100c10'); }
    // touch-hole wisp of smoke
    const [hx, hy] = f.at(-L * 0.1, bw + 1); o.fx.set(hx, hy, '#c0c0c0'); o.fx.set(hx, hy - 1, '#a0a0a0');
  };

  // ---------------------------------------------------------------- baton 指揮棒
  PARTS.baton = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand') + (a[0] < o.anchors.body[0] ? -20 : 20);
    const L = Math.round(L0(k) * 0.6);
    const wand = T.ramp(o.c || '#f0f0f0', 3, { dark: 0.3, light: 0.3 });
    const f = frame(p, a[0], a[1], deg, -2, L, 1, (t, s) => {
      if (t < 1) return Math.abs(s) <= 0.8 ? '#a07048' : null;
      return Math.abs(s) <= 0.45 ? wand[s > 0 ? 2 : 1] : null;
    });
    const [tx, ty] = f.at(L + 1, 0); o.fx.set(tx, ty, '#ffffff');
  };

  // ---------------------------------------------------------------- quill 羽ペン
  PARTS.quill = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand');
    const deg = handDir(o, a, 'hand') + (a[0] < o.anchors.body[0] ? 12 : -12);
    const L = Math.round(L0(k) * 1.15);
    const vane = T.ramp(o.c || '#ffffff', 4, { dark: 0.42, light: 0.4 });
    frame(p, a[0], a[1], deg, -Math.round(1.5 * k), L, 2 * k, (t, s) => {
      if (t < 0) return Math.abs(s) <= 0.5 ? '#302030' : null;               // nib
      const u = t / L;
      if (Math.abs(s) <= 0.35 && u < 0.97) return vane[1];                  // shaft
      const hw = u < 0.15 ? 0 : Math.sin(((u - 0.15) / 0.85) * Math.PI) * (1.3 + 0.75 * k);
      const hw2 = hw * (s > 0 ? 1 : 0.55);
      if (Math.abs(s) > hw2) return null;
      return (Math.round(t * 1.5) & 1) ? vane[2] : vane[s > 0 ? 3 : 2];     // barbs
    });
  };

  // ---------------------------------------------------------------- parasol 日傘
  PARTS.parasol = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const side = a[0] < an.body[0] ? -1 : 1;
    const cloth = T.ramp(o.c || '#e0d0f0', 5, { dark: 0.45, light: 0.5 });
    const lace = o.c2 || '#ffffff';
    const H = Math.round(L0(k) * 0.85);
    const top = [a[0] + side * Math.round(2 * k), Math.max(2, a[1] - H)];
    // shaft with a curved handle
    T.line(p, a[0], a[1] + Math.round(k), top[0], top[1] + 1, '#6a4a3a');
    p.set(a[0] - side, a[1] + Math.round(k) + 1, '#6a4a3a'); p.set(a[0] - side, a[1] + Math.round(k), '#6a4a3a');
    // canopy: a tilted dome with a scalloped rim and ribs
    const rx = Math.round(4 + 3 * k), ry = Math.round(2 + 1.5 * k);
    const cx = top[0], cy = top[1] + ry;
    const m = T.mask(p.w, p.h);
    m.ellipse(cx, cy, rx, ry, 1);
    m.each((x, y) => (y > cy ? null : undefined));
    for (let x = cx - rx; x <= cx + rx; x++) { const sc = Math.round(Math.abs(Math.sin(((x - cx) / rx) * Math.PI * 2)) * 1.2); for (let j = 0; j <= sc; j++) m.set(x, cy + j, 1); }
    p.blit(T.shade(m, cloth, { depth: 2, global: 0.4 }), 0, 0);
    const b = T.bboxOf(m);
    for (let x = b.x0; x <= b.x1; x++) for (let y = b.y1; y >= b.y0; y--) if (m.get(x, y) != null) { o.fx.set(x, y, (x & 1) ? lace : cloth[3]); break; }
    for (const d of [-0.6, 0, 0.6]) T.line(p, cx, top[1], Math.round(cx + d * rx), cy, (x, y) => (m.get(x, y) != null ? cloth[1] : null));
    p.set(cx, top[1] - 1, '#e0c060');
  };

  // ---------------------------------------------------------------- shield 盾 (hand2)
  PARTS.shield = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand2');
    const w = Math.round(k < 1.3 ? 7 : k < 1.8 ? 11 : 14), h = Math.round(w * 1.2);
    const x0 = a[0] - Math.floor(w / 2), y0 = a[1] - Math.round(h * 0.42);
    const face = T.ramp(o.c || '#6070a0', 5, { dark: 0.6, light: 0.5 });
    const rim = T.metal(o.c2 || T.mix(o.c || '#6070a0', '#d0d4e0', 0.6), 4);
    const m = T.mask(p.w, p.h);
    const inside = (x, y) => {
      const u = (x - x0 + 0.5) / w, v = (y - y0 + 0.5) / h;
      if (u < 0 || u > 1 || v < 0 || v > 1) return false;
      if (v < 0.55) return v > Math.abs(u - 0.5) * 0.12;
      const t = (v - 0.55) / 0.45;
      return Math.abs(u - 0.5) <= 0.5 * Math.sqrt(Math.max(0, 1 - t * t * 0.95)) * (1 - t * 0.35);
    };
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inside(x, y)) m.set(x, y, 1);
    const b = T.bboxOf(m);
    const rw = k < 1.3 ? 1 : 2;
    m.each((x, y) => {
      let edge = false;
      for (let d = 1; d <= rw; d++) if (m.get(x - d, y) == null || m.get(x + d, y) == null || m.get(x, y - d) == null || m.get(x, y + d) == null) edge = true;
      const t = (x - b.x0) / Math.max(1, b.x1 - b.x0);
      p.set(x, y, edge ? rim[T.clamp(T.cyl(t, 4), 0, 3)] : face[T.clamp(T.cyl(t, 5) + (y - b.y0 < h * 0.3 ? 1 : 0), 0, 4)]);
      return undefined;
    });
    // emblem: a cross in the rim metal, a boss in the middle
    const cx = a[0], cy = Math.round(y0 + h * 0.42);
    const arm = Math.round(w * 0.22);
    for (let d = -arm; d <= arm; d++) { if (m.get(cx + d, cy) != null) p.set(cx + d, cy, rim[2]); if (m.get(cx, cy + d) != null) p.set(cx, cy + d, rim[2]); }
    if (k >= 1.5) for (let d = -arm; d <= arm; d++) { if (m.get(cx + d, cy - 1) != null) p.set(cx + d, cy - 1, rim[3]); }
    p.set(cx, cy, rim[3]); o.fx.set(cx - 1, cy - 1, '#ffffff');
    o.fx.set(b.x0 + rw, b.y0 + rw, rim[3]);
  };

  // ---------------------------------------------------------------- book 本 (hand2)
  PARTS.book = (p, a, o) => {
    const T = TK(), k = o.baseK;
    grip(o, 'hand2');
    const cover = T.ramp(o.c || '#c04040', 5, { dark: 0.6, light: 0.45 });
    const w = Math.round(4 + 2.5 * k), h = Math.round(5 + 3 * k), d = Math.max(1, Math.round(1.2 * k));
    const x0 = a[0] - Math.floor(w / 2), y0 = a[1] - Math.round(h * 0.6);
    // page block seen on the right and bottom, then the cover over it
    for (let y = y0 + 1; y < y0 + h + d; y++) for (let x = x0 + 1; x < x0 + w + d; x++) p.set(x, y, (y + x) % 2 ? '#f0e8d0' : '#d8ccb0');
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const t = (x - x0) / Math.max(1, w - 1);
      p.set(x, y, x === x0 ? cover[0] : y === y0 ? cover[4] : cover[T.clamp(T.cyl(t, 5), 1, 4)]);
    }
    // spine bands, a gold corner and a clasp, an emblem on the cover
    for (const yy of [y0 + 1, y0 + h - 2]) p.set(x0, yy, '#e0c060');
    p.set(x0 + w - 1, y0, '#e0c060'); p.set(x0 + w - 1, y0 + h - 1, '#e0c060');
    const ex = x0 + Math.round(w / 2), ey = y0 + Math.round(h * 0.45);
    p.set(ex, ey, '#e0c060'); if (k >= 1.5) { p.set(ex - 1, ey, '#b09040'); p.set(ex + 1, ey, '#b09040'); p.set(ex, ey - 1, '#f0d880'); p.set(ex, ey + 1, '#b09040'); }
    o.fx.set(x0 + 1, y0, cover[4]);
  };

  // ---------------------------------------------------------------- violin バイオリン (hand)
  PARTS.violin = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const side = a[0] < an.body[0] ? -1 : 1;
    const wood = T.ramp(o.c || '#a05020', 5, { dark: 0.6, light: 0.55 });
    // body tucked between the hand and the chin, neck pointing out and up
    const cx = Math.round((a[0] * 2 + an.neck[0]) / 3), cy = Math.round((a[1] * 2 + an.neck[1]) / 3);
    const s = 1 + 0.9 * k;
    const m = T.mask(p.w, p.h);
    m.ellipse(cx, cy + s * 0.9, s * 1.25, s, 1);
    m.ellipse(cx, cy - s * 0.8, s * 1.05, s * 0.85, 1);
    p.blit(T.shade(m, wood, { depth: 1.6 }), 0, 0);
    // f-holes, bridge, strings, neck and scroll
    p.set(cx - 1, cy, '#301810'); p.set(cx + 1, cy, '#301810');
    const nx = cx + side * Math.round(2 * k), ny = cy - Math.round(s * 1.7);
    const tx = cx + side * Math.round(4.5 * k), ty = Math.max(1, cy - Math.round(s * 1.7 + 4 * k));
    T.line(p, nx, ny, tx, ty, '#402418');
    p.set(tx, ty, wood[3]); p.set(tx + side, ty, wood[2]);
    T.line(o.fx, cx, cy + Math.round(s), nx, ny, '#e0d8c0');
    // the bow across the strings
    const bx0 = cx - side * Math.round(4 * k), by0 = cy - Math.round(2 * k), bx1 = cx + side * Math.round(3 * k), by1 = cy + Math.round(3 * k);
    T.line(p, bx0, by0, bx1, by1, '#e8e0c8');
    p.set(bx0, by0, '#302018');
  };

  // ---------------------------------------------------------------- drum 太鼓 (body)
  PARTS.drum = (p, a, o) => {
    const T = TK(), k = o.baseK;
    const body = T.ramp(o.c || '#c03030', 5, { dark: 0.6, light: 0.45 });
    const rim = T.metal('#e0c060', 4), skin = T.ramp('#f0e4c8', 3, { dark: 0.25, light: 0.3 });
    const rx = Math.round(3 + 2.5 * k), h = Math.round(3 + 2.2 * k), ry = Math.max(1, Math.round(rx * 0.35));
    const cx = a[0], top = a[1] - Math.round(h * 0.2);
    const m = T.mask(p.w, p.h);
    m.rect(cx - rx, top, 2 * rx + 1, h, 1);
    m.ellipse(cx, top + h, rx, ry, 1);
    const b = T.bboxOf(m);
    m.each((x, y) => { p.set(x, y, body[T.cyl((x - b.x0) / Math.max(1, b.x1 - b.x0), 5)]); return undefined; });
    // zigzag cords
    for (let x = cx - rx + 1; x < cx + rx; x++) { const y = top + 1 + Math.round(((x - cx + rx) % 4 < 2 ? (x - cx + rx) % 4 : 4 - ((x - cx + rx) % 4)) * (h - 2) / 2); if (m.get(x, y) != null) p.set(x, y, '#f0f0e0'); }
    // skin on top, gold hoops
    for (let y = top - ry; y <= top + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const d = ((x - cx) / (rx + 0.5)) ** 2 + ((y - top) / (ry + 0.5)) ** 2;
      if (d <= 1) p.set(x, y, d > 0.6 ? rim[(x < cx) ? 3 : 1] : skin[(x + y) % 3 === 0 ? 2 : 1]);
    }
    for (let x = cx - rx; x <= cx + rx; x++) for (let y = b.y1; y >= top; y--) if (m.get(x, y) != null) { p.set(x, y, rim[x < cx ? 2 : 1]); break; }
    // a drumstick resting on the skin
    T.line(p, cx + Math.round(rx * 0.3), top - 1, cx + rx + Math.round(2 * k), top - Math.round(3 * k), '#d8c090');
    p.set(cx + Math.round(rx * 0.3), top - 1, '#f0e0b0');
  };

  // ---------------------------------------------------------------- flute 笛 (hand → mouth)
  PARTS.flute = (p, a, o) => {
    const T = TK(), k = o.baseK, an = o.anchors;
    grip(o, 'hand');
    const metal = T.metal(o.c || '#d0c080', 4);
    const [mx, my] = an.mouth;
    const side = a[0] < an.body[0] ? -1 : 1;
    const x0 = mx, y0 = my + 1, x1 = mx + side * Math.round(9 + 4 * k), y1 = my + Math.round(2 + 1.5 * k);
    T.line(p, x0, y0, x1, y1, (x, y) => metal[2]);
    if (k >= 1.5) T.line(p, x0, y0 + 1, x1, y1 + 1, (x, y) => metal[1]);
    T.line(o.fx, x0 + side, y0, x1, y1, (x, y) => ((x + y) % 3 === 0 ? metal[3] : null));
    // finger holes and the end caps
    for (let i = 2; i <= 5; i++) { const t = i / 7; p.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), '#3a2c20'); }
    p.set(x0, y0, metal[3]); p.set(x1, y1, metal[3]);
    // a little music note
    o.fx.set(x1 + side * 2, y1 - 4, '#ffffff'); o.fx.set(x1 + side * 2, y1 - 3, '#ffffff'); o.fx.set(x1 + side, y1 - 2, '#ffffff'); o.fx.set(x1 + side * 3, y1 - 4, '#ffffff');
  };
})(window.RPG);
