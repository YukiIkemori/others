// New boss battle sprites for Chronicle (DESIGN §9.11.6, owner art-boss A15a):
// 16 bosses + 2 small minions, 'mon:boss_*'. Same pipeline and toolkit as the
// Crest bosses in bosses.js (R.Art.BossTK: distance-field pillow shading with
// hue-shifted ramps, dark inner contours between layered parts, hand-placed
// detail, bold outline). This file loads before bosses.js (underscore names
// sort first), so the toolkit is only looked up when a sprite is first built.
// Opaque pixels only; "see-through" looks are checker dithers (§11.4.2). Faces
// and eyes sit at least 20 px below the top of the canvas (§9.11.6).
(function (R) {
  'use strict';

  // sprite sizes (§9.11.6) and the row of the face/eye line (for the §11.4.2 check)
  const SIZES = {
    boss_pageeater: [80, 64], boss_moth: [96, 80], boss_rooteater: [96, 80], boss_root: [48, 48],
    boss_whitedragon: [112, 96], boss_mistbeast: [96, 96], boss_tentacle: [48, 48], boss_hellhound: [96, 80],
    boss_stareater: [112, 96], boss_rowell: [64, 80], boss_bookgolem: [96, 96], boss_shade_sword: [64, 80],
    boss_shade_prayer: [64, 80], boss_shade_star: [64, 80], boss_lazaro: [80, 96], boss_nemrea1: [128, 112],
    boss_nemrea2: [128, 112], boss_ouroboros: [128, 112],
  };
  // top row of the eyes (what must stay below the battle's window band, §11.4.2)
  const FACE = {
    boss_pageeater: 44, boss_moth: 25, boss_rooteater: 25, boss_root: 6, boss_whitedragon: 24,
    boss_mistbeast: 29, boss_tentacle: 6, boss_hellhound: 32, boss_stareater: 27, boss_rowell: 18,
    boss_bookgolem: 27, boss_shade_sword: 11, boss_shade_prayer: 11, boss_shade_star: 13, boss_lazaro: 21,
    boss_nemrea1: 41, boss_nemrea2: 34, boss_ouroboros: 58,
  };

  let LIB = null;
  function lib() {
    if (LIB) return LIB;
    const T = R.Art.BossTK;
    const { G, OUT, INK, WHITE, mix, dk, ramp, rng, hash, mask, cap, bez, tube, curve, sym, both, bbox, edt, sphereN, cylN, shade, part, put, bump, on, stamp, glow, scales, edgeLight, star4, GOLD } = T;
    void [sym, bbox, cylN, scales, edgeLight, GOLD, hash, rng, dk, glow, star4];

    // -------------------------------------------------------------- extra helpers
    /**
     * Like BossTK.finish, with o.out (outline colour), o.after(p) run after the
     * outline (it may erase pixels: dithered see-through, dissolving feet) and
     * o.post(q) for un-outlined details (o.free lets them sit on empty pixels).
     */
    function close(p, o) {
      o = o || {};
      let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
      p.each((x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
      let dx = 0, dy = 0;
      if (x0 < 1) dx = 1 - x0;
      if (x1 + dx > p.w - 2) dx = p.w - 2 - x1;
      if (!o.float || y1 > p.h - 2) dy = p.h - 2 - y1;
      if (y0 + dy < 1 && y1 - y0 <= p.h - 3) dy = 1 - y0;
      if (dx || dy) { const q = G().pix(p.w, p.h); q.blit(p, dx, dy); p.d = q.d; }
      p.outline(o.out || OUT);
      if (o.after) o.after(p, dx, dy);
      if (o.post) {
        const q = G().pix(p.w, p.h);
        o.post(q);
        q.each((x, y, c) => { if (p.get(x + dx, y + dy) != null || o.free) p.set(x + dx, y + dy, c); });
      }
      return p.toCanvas();
    }
    /** faint script on paper: rows of short dashes (1-4 px, gaps 1-2) over pixels of p inside m */
    function script(p, m, x0, x1, y, col, seed, o) {
      o = o || {};
      const r = rng(seed);
      let x = x0 + Math.floor(r() * 2);
      while (x < x1) {
        const len = 1 + Math.floor(r() * (o.max || 4));
        for (let k = 0; k < len && x + k < x1; k++) if (!m || m.get(x + k, y) != null) on(p, x + k, y, col);
        if (o.ticks && r() < 0.35) on(p, x + Math.floor(len / 2), y - 1, col);
        x += len + 1 + Math.floor(r() * (o.gap || 2));
      }
    }
    /** a torn paper scrap: rotated quad (w x h) with a ragged edge and a line of script */
    function scrap(p, W, H, cx, cy, w, h, ang, paper, ink, seed, line) {
      const r = rng(seed), ca = Math.cos(ang), sa = Math.sin(ang);
      const pt = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
      const m = mask(W, H);
      const pts = [pt(-w / 2, -h / 2), pt(w / 2, -h / 2 + r() * 1.2), pt(w / 2 - r() * 1.5, h / 2), pt(0, h / 2 - 1 - r()), pt(-w / 2 + r(), h / 2)];
      m.poly(pts, 1);
      const s = shade(m, paper, { depth: 1, light: [-0.4, -0.8, 0.5], global: 0.6, bias: 0.12 });
      const a = pt(-w / 2 + 1, -0.5), b = pt(w / 2 - 1, -0.5);
      for (let t = 0; t <= 1; t += 0.12) if (r() < 0.7) on(s, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ink);
      put(p, s, line || 'dark');
    }
    /** checker see-through: erase pixels on odd (x+y) where keep(x,y,c) is false and the pixel is inside by ≥ 2 */
    function seeThrough(p, keep, o) {
      o = o || {};
      const src = p.d.slice(), w = p.w, h = p.h;
      const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] != null;
      const inset = o.inset == null ? 2 : o.inset;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        if (c == null || (x + y) % 2 === 0) continue;
        if (keep && keep(x, y, c)) continue;
        let deep = true;
        for (let k = 1; k <= inset && deep; k++) deep = solid(x - k, y) && solid(x + k, y) && solid(x, y - k) && solid(x, y + k);
        if (deep) p.d[y * w + x] = null;
      }
      return p;
    }
    /** a jointed thin leg: attach → knee → foot, shaded */
    function leg(p, W, H, a, k, f, r0, r1, rmp, L) {
      put(p, part(W, H, (g) => { tube(g, [a, k], r0, (r0 + r1) / 2, 1, 8); tube(g, [k, f], (r0 + r1) / 2, r1, 1, 10); }, rmp, { depth: 1, light: L }), 'dark');
    }

    const S = {};

    // ================================================================ page eater
    // A giant silverfish made of stacked paper: flat plated body receding up the
    // frame, eight thin legs a side splayed to the ground, long antennae and three
    // tail bristles, a round lamprey mouth of ink-black teeth rings, faded script
    // on every plate, torn scraps drifting round it. 80x64.
    S.boss_pageeater = () => {
      const W = 80, H = 64, cx = 40;
      const paper = ['#50546a', '#707690', '#9a9eb2', '#c8c0b0', '#dcd6c6', '#f4f0e4', '#fffcf2'];
      const legC = ['#3c4056', '#5a5e78', '#8a8ea4', '#b4b2b4', '#d4d0c4'];
      const TXT = '#9090a0', TXT2 = '#aeacb4';
      const OLD = ['#5a5462', '#7c7482', '#a89c98', '#c8b89c', '#dccca8', '#ece0c0', '#f8f0d8'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      const bodyN = sphereN(cx, 30, 26, 26);

      // --- tail bristles and antennae (behind everything)
      const brist = [[[cx, 11], [cx, 5], [cx, 1]], [[cx - 2, 11], [cx - 8, 6], [cx - 14, 2]], [[cx + 2, 11], [cx + 8, 6], [cx + 14, 2]]];
      for (const b of brist) put(p, part(W, H, (g) => tube(g, b, 1.1, 0.4, 1, 12), paper, { depth: 1, light: L, bias: 0.15 }), 'dark');
      both(W, (X) => {
        const ant = [[X(34), 42], [X(18), 34], [X(9), 20], [X(5), 4]];
        const m = mask(W, H); tube(m, ant, 0.8, 0.4, 1, 26);
        const a = shade(m, legC, { depth: 1, light: L, bias: 0.2 });
        for (let t = 0.1; t < 1; t += 0.09) { const q = bez(ant, t); on(a, q[0], q[1], legC[1]); }
        put(p, a, 'dark');
      });

      // --- legs: eight a side, fine jointed lines; femur up and out to a raised knee,
      // tibia down to the foot. Rear legs are darker and stand higher up the frame.
      const hwAt = (y) => Math.max(8, Math.min(17.5, 21.5 - ((40 - y) / 4.7) * 2.35));
      const lg = G().pix(W, H);
      both(W, (X, s) => {
        for (let i = 7; i >= 0; i--) {
          const ay = 47 - i * 3.3, ax = cx - hwAt(ay) + 3;
          const th = (118 + i * 14) * Math.PI / 180, dx = Math.cos(th), dy = Math.sin(th), len = 18 - i * 0.6;
          const kx = ax + dx * len * 0.45, ky = ay + dy * len * 0.45 - 3;
          const fx = ax + dx * len, fy = Math.min(62, ay + dy * len + 2.5);
          const c0 = mix(legC[1], '#262838', i * 0.07), c1 = mix(legC[3], '#5a5e78', i * 0.08);
          lg.line(Math.round(X(ax)), Math.round(ay), Math.round(X(kx)), Math.round(ky), c1);
          lg.line(Math.round(X(kx)), Math.round(ky), Math.round(X(fx)), Math.round(fy), c0);
          lg.set(Math.round(X(kx)), Math.round(ky), legC[4]);
          lg.set(Math.round(X(kx) + s), Math.round(ky), c1);
          lg.set(Math.round(X(fx)), Math.round(fy), legC[0]);
        }
      });
      put(p, lg);

      // --- body: seven stacked paper plates, back to front, torn front edges
      const r = rng(71);
      for (let i = 6; i >= 0; i--) {
        const y = 40 - i * 4.7, hw = 21.5 - i * 2.35;
        const m = mask(W, H);
        const pts = [[cx - hw + 1, y - 3.5], [cx + hw - 1, y - 3.5], [cx + hw + 0.5, y - 1]];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8, xx = cx + hw - t * hw * 2;
          pts.push([xx, y + 2.2 + Math.sin(t * Math.PI) * 2.6 + (k % 2 ? 1 : -0.2) * (0.4 + r() * 0.8)]);
        }
        pts.push([cx - hw - 0.5, y - 1]);
        m.poly(pts, 1);
        // a yellowed under-sheet sticking out on one side
        const us = mask(W, H), side = i % 2 ? 1 : -1;
        us.poly(pts.map(([x, yy]) => [x + side * 1.6, yy + 0.6]), 1);
        put(p, shade(us, OLD, { depth: 2, light: L, normal: bodyN, blend: 0.3, bias: -0.08, global: 0.4 }), 'dark');
        const pl = shade(m, paper, { depth: 3, light: L, normal: bodyN, blend: 0.3, bias: -0.1, global: 0.4 });
        // edges of the stacked pages along the front rim
        const D = edt(m);
        m.each((x, yy) => {
          const d = D[yy * W + x];
          if (d < 1 && yy > y) pl.set(x, yy, paper[2]);
          else if (d < 2 && yy > y + 1 && x % 3 !== 0) pl.set(x, yy, paper[4]);
        });
        // faded script rows on the plate
        script(pl, m, Math.round(cx - hw + 3), Math.round(cx + hw - 3), Math.round(y - 1.5), TXT2, 30 + i, { max: 3, gap: 3, ticks: true });
        if (hw > 12) script(pl, m, Math.round(cx - hw + 6), Math.round(cx + hw - 6), Math.round(y + 1), i % 3 ? TXT2 : TXT, 50 + i, { max: 2, gap: 4 });
        // a lifted page corner
        if (i % 2 === 0) { const s = i % 4 ? 1 : -1; on(pl, cx + s * (hw - 1), y - 3, paper[6]); on(pl, cx + s * (hw - 2), y - 3, paper[6]); on(pl, cx + s * (hw - 1), y - 2, paper[5]); }
        // eaten holes
        for (let k = 0; k < (hw > 10 ? 2 : 1); k++) {
          const hx = Math.round(cx + (r() - 0.5) * hw * 1.4), hy = Math.round(y + r() * 2 - 1);
          if (m.get(hx, hy) != null && m.get(hx + 1, hy) != null) { pl.set(hx, hy, paper[0]); pl.set(hx + 1, hy, paper[1]); pl.set(hx, hy - 1, paper[2]); }
        }
        put(p, pl, 'dark');
      }

      // --- head: blunt paper head with palps and bead eyes
      const hm = mask(W, H);
      hm.ellipse(cx, 49, 14.5, 9.5, 1);
      hm.ellipse(cx, 45, 17, 5, 1);
      const head = shade(hm, paper, { depth: 4, light: L, normal: sphereN(cx - 2, 46, 16, 12), blend: 0.3, rim: 1, bias: 0.12 });
      script(head, hm, cx - 12, cx + 12, 43, TXT2, 90, { max: 2, gap: 3 });
      put(p, head, 'dark');
      both(W, (X) => {
        // palps beside the mouth
        put(p, part(W, H, (g) => tube(g, [[X(29), 53], [X(26), 58], [X(28), 62]], 1.8, 0.8, 1, 10), paper, { depth: 1.2, light: L }), 'dark');
        // bead eyes
        stamp(p, Math.min(X(27), X(29)), 44, ['.kk.', 'kwkk', 'kkkk', '.kk.'].map((s) => (X(0) === 0 ? s : s.split('').reverse().join(''))), { k: '#1c1a28', w: '#e8ecff' });
      });

      // --- lamprey mouth: lit lip ring, pale gum ring set with ink teeth, dark throat, inner ring
      const mcx = cx, mcy = 51;
      const gum = ['#6a5664', '#94808c', '#bcaab2'];
      const mouth = G().pix(W, H);
      for (let y = mcy - 8; y <= mcy + 8; y++) for (let x = mcx - 9; x <= mcx + 9; x++) {
        const dx = (x - mcx) / 1.12, dy = y - mcy, d = Math.hypot(dx, dy);
        if (d > 7.6) continue;
        let c;
        if (d > 6.5) c = dx + dy < -1 ? paper[6] : dx + dy > 3 ? paper[2] : paper[4];
        else if (d > 3.6) c = dy < -1 ? gum[0] : dy > 2 ? gum[2] : gum[1];
        else if (d > 2.2) c = '#302030';
        else c = '#140a16';
        mouth.set(x, y, c);
      }
      put(p, mouth, 'dark');
      // outer ring of ink teeth pointing inward (base on the gum, tip toward the throat)
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2 - Math.PI / 2;
        const ca = Math.cos(a) * 1.12, sa = Math.sin(a);
        p.set(Math.round(mcx + ca * 5.6), Math.round(mcy + sa * 5.6), '#202028');
        p.set(Math.round(mcx + ca * 4.6), Math.round(mcy + sa * 4.6), '#202028');
        p.set(Math.round(mcx + ca * 5.5 + Math.sin(a)), Math.round(mcy + sa * 5.5 - Math.cos(a) * 0.6), '#3a3040');
      }
      // inner ring of smaller teeth glinting in the throat
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        p.set(Math.round(mcx + Math.cos(a) * 2.8 * 1.12), Math.round(mcy + Math.sin(a) * 2.8), '#7a6878');
      }
      p.set(mcx - 3, mcy - 6, WHITE); p.set(mcx - 4, mcy - 5, paper[6]);

      // --- torn scraps drifting round it
      const scraps = [[9, 15, 7, 5, -0.5], [71, 12, 6, 5, 0.4], [73, 36, 7, 4, -0.2], [7, 42, 6, 4, 0.6], [62, 3, 5, 4, 0.9], [18, 3, 5, 3, -0.8]];
      scraps.forEach(([x, y, w, h, a], k) => scrap(p, W, H, x, y, w, h, a, paper, TXT, 200 + k));
      return close(p);
    };

    // ================================================================ dust wing
    // A giant grey-brown moth with its wings spread wide: forewings with a pair of
    // yellow-ringed eye spots, rounded hindwings, feathery comb antennae, a shaggy
    // pale thorax, glossy black eyes, a banded abdomen and scale dust falling from
    // the wing edges like powder snow. Flies. 96x80.
    S.boss_moth = () => {
      const W = 96, H = 80, cx = 48;
      const wing = ['#3e3028', '#5a4838', '#76634e', '#8a7860', '#a8977a', '#c8b898', '#e0d4b8'];
      const fur = ['#6a5a48', '#8c7a64', '#b09c80', '#d8c8a8', '#ece0c8', '#faf4e4'];
      const dark = ['#140c0a', '#201810', '#342820', '#4a3a2c'];
      const DUST = '#f0e8d0';
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);

      // --- wings (both sides): hindwing first, then forewing over it
      both(W, (X, sd) => {
        // hindwing: rounded lobe below the forewing
        const hm = mask(W, H);
        hm.poly([[X(45), 40], [X(30), 40], [X(14), 45], [X(8), 53], [X(12), 62], [X(22), 69], [X(33), 70], [X(42), 63], [X(46), 52]].map(([x, y]) => [x, y]), 1);
        hm.ellipse(X(20), 58, 11, 10, 1);
        const hw = G().pix(W, H);
        const HD = edt(hm);
        hm.each((x, y) => {
          const r = Math.hypot(x - X(44), y - 46) / 36;
          let k = 1.5 + r * 3.2 + ((x + y) % 2 ? 0.25 : 0);
          if (HD[y * W + x] < 2.2) k = 1.5; // dark fringe band
          if (HD[y * W + x] < 1) k = 4.2; // pale scalloped edge
          hw.set(x, y, wing[Math.max(0, Math.min(6, Math.floor(k)))]);
        });
        // a dusky crescent band and a small dark spot
        for (let a = 0.2; a < 2.6; a += 0.05) { const x = X(24) + sd * -Math.cos(a) * 12, y = 57 + Math.sin(a) * 9; on(hw, x, y, wing[2]); on(hw, x, y + 1, wing[1]); }
        stamp(hw, Math.min(X(20), X(22)), 55, ['.kk.', 'kkkk', 'kkkk', '.kk.'], { k: dark[2] });
        for (const t of [0.25, 0.45, 0.65, 0.85]) curve(hw, [[X(44), 46], [X(44 - 20 * t), 46 + 8 * t], [X(38 - 28 * t), 50 + 16 * t]], wing[2]);
        put(p, hw, 'dark');

        // forewing: long triangle to the upper corner with a scalloped outer margin
        const fm = mask(W, H);
        const edge = [[X(3), 7], [X(1), 14], [X(2), 22], [X(4), 30], [X(7), 37], [X(11), 43], [X(16), 47]];
        fm.poly([[X(45), 29], [X(36), 20], [X(22), 11], ...edge, [X(30), 45], [X(44), 40]], 1);
        const fw = G().pix(W, H);
        const FD = edt(fm);
        fm.each((x, y) => {
          const r = Math.hypot(x - X(46), y - 32) / 46;
          let k = 1.2 + r * 3.6 + ((x * 3 + y) % 5 === 0 ? 0.6 : 0) + (hash(x >> 1, y >> 1, 7) - 0.5) * 0.5;
          const d = FD[y * W + x];
          if (d < 3.2 && d >= 1.2) k = Math.min(k, 2.4); // dark submarginal line
          if (d < 1.2) k = 5.3; // pale fringe
          fw.set(x, y, wing[Math.max(0, Math.min(6, Math.floor(k)))]);
        });
        // veins radiating from the wing root
        for (const [ex, ey] of [[6, 10], [4, 18], [5, 27], [8, 35], [13, 42], [22, 44]]) curve(fw, [[X(44), 32], [X((44 + ex) / 2 + 4), (32 + ey) / 2 - 2], [X(ex + 3), ey]], wing[2]);
        // scalloped margin: little notches between the vein tips
        for (const [x, y] of edge) { on(fw, x + sd, y, null); }
        // the eye spot: black ring, yellow ring, black pupil, white glint
        const ex = X(22), ey = 25;
        for (let y = ey - 8; y <= ey + 8; y++) for (let x = ex - 9; x <= ex + 9; x++) {
          const d = Math.hypot((x - ex) / 1.1, y - ey);
          if (d > 7.5 || fm.get(x, y) == null) continue;
          fw.set(x, y, d > 6.4 ? dark[1] : d > 4.2 ? (y - ey < -1 ? '#ffe070' : y - ey > 2 ? '#c88a20' : '#f0c040') : d > 3.4 ? dark[2] : dark[1]);
        }
        fw.set(ex - sd * 1, ey - 2, '#fffff0'); fw.set(ex - sd * 2, ey - 1, '#e8e0c8'); fw.set(ex - sd * 1, ey - 1, '#b8b0a0');
        // pale zig-zag band inside the margin
        for (let t = 0; t < 1; t += 0.03) { const y = 11 + t * 32, x = X(11 + t * 7 + Math.sin(t * 30) * 1.2); on(fw, x, y, wing[5]); }
        put(p, fw, 'dark');
      });

      // --- abdomen: tapering, banded, furry
      const am = mask(W, H);
      tube(am, [[cx, 42], [cx, 54], [cx, 66]], 6.5, 2.2, 1, 16);
      const ab = shade(am, fur, { depth: 4, light: L, normal: cylN(cx - 1, 7), blend: 0.5, bias: -0.05 });
      for (const y of [48, 53, 58, 62]) { for (let x = cx - 7; x <= cx + 7; x++) { on(ab, x, y, fur[1]); if ((x + y) % 2) on(ab, x, y + 1, fur[2]); } }
      bump(ab, fur, (x, y) => (hash(x, y, 3) < 0.18 ? 1 : 0));
      put(p, ab, 'dark');
      // small legs tucked under the thorax
      both(W, (X) => {
        for (const [a, b, c] of [[[X(44), 40], [X(38), 44], [X(36), 50]], [[X(45), 42], [X(40), 48], [X(40), 54]]]) {
          put(p, part(W, H, (g) => { tube(g, [a, b], 1.1, 0.9, 1, 6); tube(g, [b, c], 0.9, 0.5, 1, 6); }, dark.concat([wing[2]]), { depth: 1, light: L }), 'dark');
        }
      });

      // --- thorax: shaggy pale fur collar
      const tm = mask(W, H);
      tm.ellipse(cx, 37, 9.5, 8.5, 1);
      const th = shade(tm, fur, { depth: 5, light: L, normal: sphereN(cx - 2, 35, 10, 10), blend: 0.4, rim: 1 });
      put(p, th, 'dark');
      // fur tufts around the edge and down the middle
      const tf = G().pix(W, H);
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * Math.PI * 2, rr = 8.5 + (k % 2) * 1.5;
        const x0 = cx + Math.cos(a) * 6, y0 = 37 + Math.sin(a) * 5.5, x1 = cx + Math.cos(a) * rr * 1.1, y1 = 37 + Math.sin(a) * rr;
        tf.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), Math.cos(a) + Math.sin(a) < 0 ? fur[4] : fur[2]);
      }
      put(p, tf);
      for (let y = 32; y < 44; y += 2) { on(p, cx, y, fur[5]); on(p, cx - 1, y + 1, fur[2]); }

      // --- antennae: broad feathery combs sweeping up and out
      both(W, (X, sd) => {
        const pts = [[X(45), 25], [X(40), 14], [X(32), 6], [X(23), 3]];
        const m = G().pix(W, H);
        for (let i = 2; i <= 30; i++) {
          const t = i / 30, q = bez(pts, t), q2 = bez(pts, Math.min(1, t + 0.03));
          const nx = -(q2[1] - q[1]), ny = q2[0] - q[0], l = Math.hypot(nx, ny) || 1;
          const bl = 4.5 * Math.sin(Math.PI * Math.min(1, t * 1.15));
          for (const side of [-1, 1]) {
            const bx = q[0] + (nx / l) * bl * side * sd - 1.2 * (q2[0] - q[0]) / l * 3, by = q[1] + (ny / l) * bl * side * sd + 1.5;
            m.line(Math.round(q[0]), Math.round(q[1]), Math.round(bx), Math.round(by), i % 2 ? fur[3] : fur[2]);
          }
        }
        curve(m, pts, fur[1], 30);
        put(p, m);
      });

      // --- head: furry, big glossy black eyes, curled proboscis
      const hm = mask(W, H);
      hm.ellipse(cx, 27.5, 7.5, 5.5, 1);
      put(p, shade(hm, fur, { depth: 3, light: L, normal: sphereN(cx - 1, 26, 7, 7), blend: 0.4, bias: 0.05 }), 'dark');
      both(W, (X, sd) => {
        const em = mask(W, H);
        em.ellipse(X(42.2), 28, 3.3, 4, 1);
        const eye = shade(em, ['#0c0810', '#1c1420', '#2e2434', '#4a3e52', '#8a7e98'], { depth: 2.5, light: L, normal: sphereN(X(41.7), 27, 3.8, 4.4), blend: 0.3 });
        put(p, eye, 'dark');
        p.set(X(41.2), 26, '#f8f4ff'); p.set(X(42.2), 25.5, '#b8b0c8');
        // faint facet sparkle
        p.set(X(43), 30, '#5a4a66');
      });
      // brow tuft between the eyes and the curled proboscis
      for (const [x, y, c] of [[cx - 1, 24, fur[5]], [cx, 24, fur[4]], [cx, 25, fur[4]], [cx - 1, 26, fur[3]], [cx + 1, 26, fur[2]], [cx, 27, fur[3]], [cx, 29, fur[1]]]) p.set(x, y, c);
      curve(p, [[cx, 31], [cx + 1, 34], [cx - 1, 35]], dark[3]);

      return close(p, {
        float: true, free: true,
        post: (q) => {
          // scale dust falling from the wing edges like powder snow
          const r = rng(123);
          for (let k = 0; k < 70; k++) {
            const sd = r() < 0.5 ? -1 : 1;
            const x = Math.round(cx + sd * (6 + r() * 42)), y = Math.round(34 + r() * 46);
            if (y > 79) continue;
            if (p.get(x, y) != null && r() < 0.7) continue;
            q.set(x, y, r() < 0.3 ? '#ffffff' : DUST);
            if (r() < 0.12 && y < 78) q.set(x, y + 1, '#c8b898');
          }
        },
      });
    };

    // ================================================================ root eater
    // A huge bloated white grub coiled round two thick roots of the old tree: fat
    // papery segments (two torn open, hollow inside), a ring of crooked root-like
    // jaws round its mouth, small sickly-green eyes, and yellow-green sap running
    // down the body in streaks and drips. 96x80.
    /** perpendicular line across a bezier tube at t: half-length r, colour c, offset o along the normal */
    function across(p, pts, t, r, c, o) {
      const a = bez(pts, Math.max(0, t - 0.01)), b = bez(pts, Math.min(1, t + 0.01));
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const q = bez(pts, t), off = o || 0;
      for (let k = -r; k <= r; k += 0.5) on(p, q[0] + nx * k + (b[0] - a[0]) / l * off, q[1] + ny * k + (b[1] - a[1]) / l * off, c);
    }
    /** gnarled bark ramp texture along a root tube: grooves along the length */
    function bark(p, pts, r0, r1, rmp, seed) {
      const rr = rng(seed);
      for (let g = 0; g < 5; g++) {
        const off = (rr() - 0.5) * 1.4;
        for (let i = 0; i <= 40; i++) {
          const t = i / 40, a = bez(pts, Math.max(0, t - 0.01)), b = bez(pts, Math.min(1, t + 0.01));
          let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          const rad = (r0 + (r1 - r0) * t) * off, q = bez(pts, t);
          if (rr() < 0.85) on(p, q[0] + nx * rad, q[1] + ny * rad, rmp[1]);
          if (rr() < 0.4) on(p, q[0] + nx * (rad + 1), q[1] + ny * (rad + 1), rmp[4]);
        }
      }
    }
    S.boss_rooteater = () => {
      const W = 96, H = 80, cx = 48;
      const flesh = ['#6a6c64', '#8a8a80', '#a8a498', '#c4c0b2', '#d8d4c6', '#e8e4d8', '#f8f6ee'];
      const root = ['#241810', '#3a2818', '#503624', '#6a4a30', '#86603e', '#a07850', '#b8946a'];
      const jaw = ['#2a1c12', '#3e2a1a', '#604830', '#7c6040', '#98785a'];
      const SAP = ['#5a7018', '#86a824', '#b0d040', '#d8f070', '#f4ffb0'];
      const HOLE = ['#140e10', '#261c1c', '#3a2c26'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      const bodyN = sphereN(cx - 3, 50, 22, 30);

      // --- two thick roots behind in a V, and a third low one the tail wraps round
      const roots = [
        [[[0, 30], [22, 36], [34, 58], [36, 80]], 8, 6, 5],
        [[[96, 24], [74, 32], [64, 56], [62, 80]], 9, 6, 9],
        [[[96, 64], [84, 70], [76, 76], [72, 80]], 6, 5, 13],
      ];
      for (const [pts, r0, r1, sd] of roots) {
        const m = mask(W, H); tube(m, pts, r0, r1, 1, 36);
        const rt = shade(m, root, { depth: 5, light: L, bias: -0.04 });
        bark(rt, pts, r0, r1, root, sd);
        put(p, rt, 'dark');
      }
      for (const pts of [[[10, 30], [8, 22], [11, 14]], [[86, 26], [90, 18], [88, 10]], [[26, 42], [18, 46], [15, 54]], [[70, 40], [78, 44], [80, 52]]]) put(p, part(W, H, (g) => tube(g, pts, 1.8, 0.5, 1, 10), root, { depth: 1, light: L }), 'dark');

      // --- tail: curls out from behind the body, over the low root, tapering
      const tail = [[58, 66], [80, 72], [92, 60], [84, 50]];
      const tm = mask(W, H); tube(tm, tail, 9, 3, 1, 26);
      const tl = shade(tm, flesh, { depth: 5, light: L, rim: 1 });
      for (let i = 1; i < 9; i++) { const t = i / 9; across(tl, tail, t, 8.5 - t * 5.5, flesh[1], 0); across(tl, tail, t, 7.5 - t * 5, flesh[5], -1.4); }
      put(p, tl, 'dark');

      // --- the body rearing up toward us: bloated segments stacked bottom (far) to top (near)
      const segs = [[70, 21, 7.5], [61, 25, 7.5], [52, 26, 7.5], [44, 23, 7], [37, 18.5, 6.5]];
      segs.forEach(([y, hw, hh], k) => {
        const m = mask(W, H);
        m.ellipse(cx, y, hw, hh, 1);
        const sg = shade(m, flesh, { depth: 6, light: L, normal: sphereN(cx - 4, y - 2, hw + 2, hh + 3), blend: 0.4, bias: 0.3, rim: 1, global: 0.35 });
        // crease shadow along the lower rim, soft sheen on the bulge
        const D = edt(m);
        m.each((x, yy) => { if (yy > y + hh * 0.3 && D[yy * W + x] < 1.6) sg.set(x, yy, x > cx + hw * 0.4 ? flesh[1] : flesh[2]); });
        for (let x = cx - hw + 5; x < cx - 2; x++) if ((x + k) % 3) on(sg, x, Math.round(y - hh * 0.45 + Math.abs(x - cx + hw * 0.4) * 0.12), flesh[6]);
        // breathing pores along the sides
        for (const sd of [-1, 1]) { on(sg, cx + sd * (hw - 3), y, flesh[0]); on(sg, cx + sd * (hw - 3), y - 1, flesh[1]); }
        put(p, sg, 'dark');
      });
      // sap veins running down the body
      const veins = [[[cx - 12, 36], [cx - 16, 50], [cx - 11, 60], [cx - 15, 76]], [[cx + 9, 40], [cx + 15, 50], [cx + 12, 64], [cx + 17, 74]], [[cx + 1, 46], [cx - 2, 56], [cx + 2, 66], [cx - 1, 74]]];
      veins.forEach((v, k) => {
        for (let i = 0; i <= 60; i++) {
          const t = i / 60, q = bez(v, t), w = Math.sin(t * 17 + k * 2) * 1.2;
          if (hash(i, k, 5) < 0.12) continue;
          on(p, q[0] + w, q[1], i % 8 === 4 ? SAP[3] : SAP[1]);
          if (i % 3 === 0) on(p, q[0] + w - 1, q[1], SAP[2]);
        }
      });
      // torn-open segments: hollow dark inside, ragged papery lips
      for (const [hx, hy, rx, ry, sd] of [[cx + 12, 60, 5, 3.5, 11], [cx - 13, 52, 3.5, 3, 12]]) {
        const hm = mask(W, H), rr = rng(sd);
        const pts = [];
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, j = 0.7 + rr() * 0.5; pts.push([hx + Math.cos(a) * rx * j, hy + Math.sin(a) * ry * j]); }
        hm.poly(pts, 1);
        const hole = G().pix(W, H);
        hm.each((x, y) => hole.set(x, y, y < hy - ry * 0.3 ? HOLE[0] : y < hy + ry * 0.4 ? HOLE[1] : HOLE[2]));
        put(p, hole, 'dark');
        // curled lips: lit upper edge, a flap of skin folding over
        for (let x = Math.round(hx - rx); x <= Math.round(hx + rx); x++) for (let y = Math.round(hy - ry - 2); y < hy; y++) {
          if (hm.get(x, y) == null && hm.get(x, y + 1) != null) on(p, x, y, x < hx ? flesh[6] : flesh[5]);
        }
        on(p, hx - rx * 0.5, hy - ry * 0.7, flesh[5]); on(p, hx - rx * 0.5 + 1, hy - ry * 0.7, flesh[3]);
        p.set(Math.round(hx + rx * 0.2), Math.round(hy), flesh[2]); p.set(Math.round(hx + rx * 0.2), Math.round(hy + 1), flesh[1]);
      }
      // stubby legs under the neck
      both(W, (X) => {
        for (const [x, y] of [[33, 42], [30, 48]]) put(p, part(W, H, (g) => tube(g, [[X(x), y], [X(x - 4), y + 2], [X(x - 5), y + 6]], 1.5, 0.6, 1, 8), jaw, { depth: 1, light: L }), 'dark');
      });

      // --- crooked root-like jaws behind the head: they splay out round the face
      const cy = 27;
      const jaws = [
        [[cx - 6, cy + 5], [cx - 18, cy + 4], [cx - 27, cy - 4], [cx - 30, cy - 14]],
        [[cx - 7, cy + 7], [cx - 20, cy + 12], [cx - 32, cy + 10], [cx - 37, cy + 17]],
        [[cx + 6, cy + 5], [cx + 18, cy + 4], [cx + 28, cy - 5], [cx + 30, cy - 15]],
        [[cx + 7, cy + 7], [cx + 20, cy + 12], [cx + 31, cy + 9], [cx + 37, cy + 16]],
        [[cx - 3, cy - 6], [cx - 8, cy - 14], [cx - 14, cy - 18], [cx - 16, cy - 25]],
        [[cx + 3, cy - 6], [cx + 8, cy - 14], [cx + 13, cy - 19], [cx + 17, cy - 25]],
      ];
      jaws.forEach((pts, k) => {
        const m = mask(W, H); tube(m, pts, k < 4 ? 3 : 2.2, 0.5, 1, 26);
        const sd = pts[3][0] < cx ? -1 : 1;
        for (const t of [0.45, 0.72]) { const q = bez(pts, t); tube(m, [q, [q[0] + sd * 1.5, q[1] + (k < 4 ? 3 : -2)], [q[0] + sd * 1, q[1] + (k < 4 ? 6 : -4)]], 1.1, 0.4, 1, 8); }
        const j = shade(m, jaw, { depth: 1.8, light: L, bias: 0.06 });
        for (let t = 0.1; t < 0.9; t += 0.16) { const a = bez(pts, t); on(j, a[0], a[1] - 1, jaw[4]); }
        put(p, j, 'dark');
      });

      // --- head capsule: yellowed, with sutures, two pairs of small sickly eyes
      const hm = mask(W, H);
      hm.ellipse(cx, cy, 12.5, 10, 1);
      const hcol = ['#5c5642', '#7e765a', '#a09676', '#c0b890', '#d8d2ae', '#ece8cc'];
      const head = shade(hm, hcol, { depth: 5, light: L, normal: sphereN(cx - 2, cy - 2, 13, 11), blend: 0.35, rim: 1 });
      curve(head, [[cx, cy - 10], [cx - 1, cy - 5], [cx, cy - 1]], hcol[2]);
      curve(head, [[cx - 10, cy - 3], [cx - 5, cy - 6], [cx, cy - 5]], hcol[2]);
      curve(head, [[cx + 10, cy - 3], [cx + 5, cy - 6], [cx, cy - 5]], hcol[2]);
      put(p, head, 'dark');
      for (const [x, y, big] of [[cx - 6, cy, 1], [cx + 6, cy, 1], [cx - 10, cy + 3, 0], [cx + 9, cy + 3, 0]]) {
        if (big) stamp(p, x - 1, y - 1, ['kkk', 'kGk', 'kgk'], { k: '#1a1410', G: SAP[4], g: SAP[2] });
        else stamp(p, x, y, ['kk', 'gk'], { k: '#1a1410', g: SAP[3] });
      }
      // mouth: a dark maw ringed with little teeth, sap drooling
      const mm = mask(W, H);
      mm.ellipse(cx, cy + 7, 5.5, 3.5, 1);
      const mouth = G().pix(W, H);
      mm.each((x, y) => mouth.set(x, y, y < cy + 6 ? '#1a0e0c' : y < cy + 8 ? '#2a1a14' : '#3e2a20'));
      put(p, mouth, 'dark');
      for (const x of [cx - 4, cx - 2, cx, cx + 2, cx + 4]) p.set(x, cy + 4, '#e0d8b8');
      for (const x of [cx - 3, cx + 1, cx + 3]) p.set(x, cy + 10, '#c8c0a0');
      const drip = (x, y, n) => { for (let k = 0; k < n; k++) p.set(x, y + k, k === n - 1 ? SAP[3] : SAP[2]); p.set(x, y + n, SAP[1]); };
      drip(cx - 2, cy + 11, 5); drip(cx + 2, cy + 11, 3); drip(cx - 29, cy + 18, 3); drip(cx + 36, cy + 17, 2);
      return close(p, { post: (q) => { for (const [x, y] of [[44, 79], [52, 78], [30, 78]]) q.set(x, y, SAP[2]); } });
    };

    // ================================================================ root tendril (minion)
    // A thick root bursting from the ground and rearing like a snake: gnarled bark,
    // side rootlets, the tip sheathed in white papery skin split into a biting
    // mouth, two knot eyes, sap dripping. 48x48.
    S.boss_root = () => {
      const W = 48, H = 48;
      const root = ['#241810', '#3a2818', '#503624', '#6a4a30', '#86603e', '#a07850', '#c09a70'];
      const skin = ['#6a6c64', '#8a8a80', '#b0ac9e', '#d0ccbe', '#e8e4d8', '#f8f6ee'];
      const SAP = ['#5a7018', '#86a824', '#b0d040', '#d8f070'];
      const soil = ['#1c140e', '#2e2218', '#44321f', '#5c4630'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      // --- soil mound where it breaks out
      const sm = mask(W, H);
      sm.ellipse(21, 45, 15, 4, 1);
      const soilP = shade(sm, soil, { depth: 2, light: L, global: 0.5 });
      put(p, soilP, 'dark');
      // --- rootlets from the base
      for (const pts of [[[14, 43], [6, 42], [2, 46]], [[28, 44], [37, 43], [42, 46]], [[17, 38], [9, 33], [7, 27]]]) put(p, part(W, H, (g) => tube(g, pts, 1.8, 0.5, 1, 10), root, { depth: 1, light: L }), 'dark');
      // --- the rearing root
      const pts = [[20, 47], [8, 32], [36, 30], [29, 13]];
      const m = mask(W, H); tube(m, pts, 7, 4.6, 1, 30);
      const rt = shade(m, root, { depth: 4, light: L, rim: 1 });
      bark(rt, pts, 7, 4.6, root, 21);
      // knots
      for (const t of [0.3, 0.55]) { const q = bez(pts, t); stamp(rt, Math.round(q[0]) - 1, Math.round(q[1]) - 1, ['.a.', 'aba', '.a.'], { a: root[2], b: root[0] }); }
      put(p, rt, 'dark');
      // a side shoot off the neck
      put(p, part(W, H, (g) => tube(g, [[14, 33], [7, 26], [8, 18]], 2, 0.6, 1, 12), root, { depth: 1.2, light: L }), 'dark');
      // --- the head: white papery sheath over the tip, split into jaws
      const hm = mask(W, H);
      hm.poly([[22, 16], [23, 9], [28, 4], [34, 4], [38, 8], [37, 13], [33, 17], [26, 19]], 1);
      const hd = shade(hm, skin, { depth: 3, light: L, normal: sphereN(28, 9, 8, 7), blend: 0.4, rim: 1, bias: 0.1 });
      // torn lower edge of the sheath
      for (const [x, y] of [[24, 18], [27, 19], [30, 18], [33, 17]]) { on(hd, x, y, skin[1]); }
      put(p, hd, 'dark');
      // the open mouth: dark split with fibrous teeth
      const mm = mask(W, H);
      mm.poly([[31, 10], [41, 6], [45, 9], [44, 14], [36, 15]], 1);
      const mouth = G().pix(W, H);
      mm.each((x, y) => mouth.set(x, y, y < 10 ? '#3a2018' : y < 13 ? '#240e0c' : '#3a1c14'));
      put(p, mouth, 'dark');
      // lower jaw (bark)
      put(p, part(W, H, (g) => g.poly([[33, 14], [44, 13], [45, 16], [37, 19]], 1), root, { depth: 1.2, light: L, bias: 0.05 }), 'dark');
      // splintery fangs
      for (const [x, y, d] of [[35, 10, 1], [38, 9, 2], [41, 8, 1], [43, 9, 1], [37, 14, -1], [40, 14, -2], [43, 14, -1]]) {
        for (let k = 0; k < Math.abs(d); k++) p.set(x, y + Math.sign(d) * k, skin[5]);
        p.set(x, y + Math.sign(d) * Math.abs(d), skin[2]);
      }
      // knot eyes
      stamp(p, 26, 8, ['kk', 'kG'], { k: '#1a1410', G: SAP[3] });
      p.set(31, 6, '#1a1410'); p.set(32, 6, SAP[2]);
      // sap drips from the jaw and the neck
      for (const [x, y, n] of [[38, 17, 4], [34, 19, 2], [13, 30, 2]]) { for (let k = 0; k < n; k++) p.set(x, y + k, SAP[2]); p.set(x, y + n, SAP[3]); }
      return close(p);
    };

    // ================================================================ white dragon Neve
    // A pearl-scaled white dragon rearing with wings half open: the membranes pale
    // blue and see-through (checker), a mane of icicles down the neck, horns of
    // grown ice crystal, clouded pale eyes, a frozen heart of dark blue ice glowing
    // in the chest, a tail curled round with an ice fin, snow smoke at its feet.
    // Flies. 112x96.
    S.boss_whitedragon = () => {
      const W = 112, H = 96, cx = 56;
      const scale = ['#50608a', '#6c7ca4', '#8c9cc0', '#b8c8e0', '#d4e0f0', '#f4f8ff', '#ffffff'];
      const belly = ['#6a7a9c', '#8e9cb8', '#b4c0d6', '#d6e0ee', '#eef4fc', '#ffffff'];
      const memb = ['#5a88b8', '#7aa8d4', '#9cc8ec', '#c0e8ff', '#dcf4ff', '#f0fcff'];
      const ICE = T.ICE;
      const HEART = ['#101c48', '#1c2e70', '#3050a0', '#5070d0', '#80a0ff', '#c0d4ff', '#ffffff'];
      const L = [-0.45, -0.75, 0.55];
      const back = { L: [0.6, 0.6, 0.3], c: '#c8f0ff', t: 0.5, edge: 1.2 };
      const p = G().pix(W, H);
      const membSet = new Set(memb);

      // --- wings: bone arm to the wrist, four fingers fanning, scalloped see-through membrane
      both(W, (X) => {
        const S0 = [42, 46], E = [26, 26], Wr = [14, 12];
        const tips = [[2, 26], [2, 44], [8, 60], [22, 66]];
        const poly = [S0, E, Wr];
        for (let i = 0; i < tips.length; i++) {
          const t = tips[i], prev = i ? tips[i - 1] : Wr;
          poly.push([(prev[0] + t[0]) / 2 + 5, (prev[1] + t[1]) / 2 + 1], t);
        }
        poly.push([36, 62]);
        const m = mask(W, H);
        m.poly(poly.map(([x, y]) => [X(x), y]), 1);
        const wm = G().pix(W, H);
        const D = edt(m);
        m.each((x, y) => {
          const t = Math.hypot(x - X(Wr[0]), y - Wr[1]) / 60;
          let k = 3.6 - t * 2.8 + (D[y * W + x] < 1.5 ? 1 : 0) + ((x + y) % 2 ? 0.3 : 0);
          wm.set(x, y, memb[Math.max(0, Math.min(5, Math.floor(k)))]);
        });
        put(p, wm, 'dark');
        const bm = mask(W, H);
        cap(bm, X(S0[0]), S0[1], X(E[0]), E[1], 2.4, 1.9);
        cap(bm, X(E[0]), E[1], X(Wr[0]), Wr[1], 1.9, 1.5);
        for (const t of tips) tube(bm, [[X(Wr[0]), Wr[1]], [X((Wr[0] + t[0]) / 2 + 3), (Wr[1] + t[1]) / 2], [X(t[0]), t[1]]], 0.9, 0.35, 1, 14);
        put(p, shade(bm, scale, { depth: 1.8, light: L, bias: -0.06, back }), 'dark');
        // ice claws at the wrist and elbow
        T.shard(p, W, H, X(Wr[0]), Wr[1], X(Wr[0] + 5), Wr[1] - 8, 1.6);
        T.shard(p, W, H, X(E[0]), E[1] - 1, X(E[0] + 1), E[1] - 7, 1.4);
      });

      // --- tail: curls round to the right, ends in an ice fin
      const tp = [[64, 86], [86, 96], [106, 88], [104, 70]];
      const tl = mask(W, H); tube(tl, tp, 6.5, 2, 1, 30);
      const tail = shade(tl, scale, { depth: 4, light: L, back, bias: -0.08 });
      T.scales(tail, scale, 5, 4, { lit: 1 });
      put(p, tail, 'dark');
      T.shard(p, W, H, 104, 72, 108, 60, 3.2);
      T.shard(p, W, H, 103, 74, 97, 64, 2.2);

      // --- hind legs: crouched, clawed
      both(W, (X) => {
        const lm = mask(W, H);
        cap(lm, X(44), 76, X(34), 84, 9, 7); cap(lm, X(34), 84, X(38), 91, 6, 5);
        const lg = shade(lm, scale, { depth: 5, light: L, back, bias: -0.08 });
        T.scales(lg, scale, 5, 4, { lit: 1 });
        put(p, lg, 'dark');
        put(p, part(W, H, (g) => g.ellipse(X(38), 92, 7, 3, 1), scale, { depth: 2, light: L }), 'dark');
        for (const [x1, xc] of [[X(31), X(33)], [X(37), X(37)], [X(44), X(43)]]) put(p, part(W, H, (g) => tube(g, [[X(38), 92], [xc, 94], [x1, 95]], 1.4, 0.4, 1, 8), ICE, { depth: 1, light: L }), 'dark');
      });

      // --- torso with pearly belly plates
      const tm = mask(W, H);
      tm.ellipse(cx, 64, 17, 20, 1);
      tm.ellipse(cx, 50, 14, 8, 1);
      const torso = shade(tm, scale, { depth: 8, light: L, normal: sphereN(cx - 3, 58, 20, 26), blend: 0.35, back, bias: -0.1 });
      T.scales(torso, scale, 6, 4, { lit: 1 });
      put(p, torso, 'dark');
      const bp = mask(W, H);
      bp.poly([[cx - 9, 50], [cx + 9, 50], [cx + 10, 66], [cx + 7, 80], [cx - 7, 80], [cx - 10, 66]], 1);
      const bel = shade(bp, belly, { depth: 4, light: L, normal: cylN(cx - 1, 11), blend: 0.5, rim: 1 });
      for (const y of [55, 61, 67, 73, 78]) { curve(bel, [[cx - 11, y - 1], [cx, y + 1.5], [cx + 11, y - 1]], belly[1]); curve(bel, [[cx - 11, y], [cx, y + 2.5], [cx + 11, y]], belly[4]); }
      put(p, bel, 'dark');

      // --- the frozen heart: a cluster of dark blue ice crystals, glowing
      const hc = mask(W, H);
      hc.poly([[cx, 52], [cx + 6, 57], [cx + 5, 64], [cx, 67], [cx - 5, 64], [cx - 6, 57]], 1);
      const heart = G().pix(W, H);
      hc.each((x, y) => {
        const d = Math.hypot(x - cx + 1, y - 58) / 7;
        const facet = (x - cx) * 0.7 + (y - 59) > 0 ? 0 : 1;
        heart.set(x, y, HEART[Math.max(0, Math.min(6, Math.floor(5.2 - d * 3.6 + facet)))]);
      });
      heart.line(cx, 53, cx, 66, HEART[3]); heart.line(cx - 5, 58, cx + 5, 62, HEART[1]);
      put(p, heart, 'dark');
      for (const [x, y, c] of [[cx - 2, 56, HEART[6]], [cx - 3, 57, HEART[5]], [cx - 1, 55, HEART[5]], [cx + 2, 61, HEART[4]]]) p.set(x, y, c);
      // cold light spilling round the heart
      for (let a = 0; a < Math.PI * 2; a += 0.35) { const x = Math.round(cx + Math.cos(a) * 8.5), y = Math.round(59.5 + Math.sin(a) * 9.5); if (p.get(x, y) && !membSet.has(p.get(x, y))) p.set(x, y, a % 0.7 < 0.35 ? '#a8c8ff' : belly[4]); }

      // --- arms: from the shoulders down to clawed hands in front of the belly
      both(W, (X) => {
        const am = mask(W, H);
        cap(am, X(44), 50, X(36), 62, 5.5, 4.5); cap(am, X(36), 62, X(42), 70, 4.5, 3.8);
        const arm = shade(am, scale, { depth: 3.5, light: L, back, bias: -0.02 });
        T.scales(arm, scale, 4, 3, { lit: 1 });
        put(p, arm, 'dark');
        put(p, part(W, H, (g) => g.ellipse(X(43), 72, 4, 3, 1), scale, { depth: 2, light: L }), 'dark');
        for (const [x1, y1, xc, yc] of [[X(40), 78, X(40), 75], [X(44), 79, X(44), 76], [X(47), 77, X(47), 74]]) put(p, part(W, H, (g) => tube(g, [[X(43), 73], [xc, yc], [x1, y1]], 1.2, 0.35, 1, 8), ICE, { depth: 1, light: L }), 'dark');
      });

      // --- neck: S-curve up to the head, icicle mane down its back
      const np = [[cx, 52], [cx + 9, 42], [cx - 7, 34], [cx, 26]];
      const nm = mask(W, H); tube(nm, np, 7.5, 5.5, 1, 24);
      const neck = shade(nm, scale, { depth: 5, light: L, back, bias: -0.08 });
      T.scales(neck, scale, 4, 3, { lit: 1 });
      put(p, neck, 'dark');
      const fr = mask(W, H); tube(fr, np.map(([x, y]) => [x - 0.5, y + 1]), 4, 3, 1, 24);
      const front = shade(fr, belly, { depth: 2, light: L });
      for (let i = 1; i < 10; i++) { const q = bez(np, i / 10); on(front, q[0] - 2, q[1] + 1, belly[1]); on(front, q[0] + 2, q[1] + 1, belly[1]); }
      put(p, front, 'dark');
      // the mane: icicles hanging back off the neck's outer edge
      for (let i = 0; i < 9; i++) {
        const t = 0.08 + i * 0.1, q = bez(np, t), q2 = bez(np, t + 0.02);
        let nx = -(q2[1] - q[1]), ny = q2[0] - q[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const sd = i % 2 ? 1 : -1, len = 8 + (i % 3) * 2;
        T.shard(p, W, H, q[0] + nx * 5 * sd, q[1] + ny * 5 * sd, q[0] + nx * (5 + len) * sd, q[1] + ny * (5 + len) * sd + 4, 1.7);
      }

      // --- head: pearl skull, ice-crystal horns, heavy brows over clouded eyes
      const hy = 22;
      both(W, (X) => {
        T.shard(p, W, H, X(cx - 6), hy - 4, X(cx - 14), hy - 19, 2.8);
        T.shard(p, W, H, X(cx - 8), hy - 1, X(cx - 20), hy - 9, 2.1);
        T.shard(p, W, H, X(cx - 9), hy + 5, X(cx - 17), hy + 8, 1.6);
      });
      const hm = mask(W, H);
      hm.ellipse(cx, hy, 10, 7.5, 1);
      hm.poly([[cx - 8.5, hy + 1], [cx + 8.5, hy + 1], [cx + 6.5, hy + 10], [cx + 4, hy + 14], [cx - 4, hy + 14], [cx - 6.5, hy + 10]], 1);
      const head = shade(hm, scale, { depth: 4, light: L, normal: sphereN(cx - 2, hy + 1, 11, 12), blend: 0.35, rim: 1, bias: -0.04 });
      T.scales(head, scale, 3, 3, { lit: 1, mask: (() => { const q = mask(W, H); q.ellipse(cx, hy - 3, 7, 3, 1); return q; })() });
      put(p, head, 'dark');
      // snout ridge and muzzle plates
      for (let y = hy - 6; y <= hy + 11; y++) { on(p, cx, y, y % 3 ? scale[5] : scale[3]); on(p, cx + 1, y, scale[3]); }
      for (const y of [hy + 7, hy + 10]) curve(p, [[cx - 5, y], [cx, y + 1], [cx + 5, y]], scale[2]);
      both(W, (X, sd) => {
        // heavy brow over each eye
        put(p, part(W, H, (g) => cap(g, X(cx - 9), hy - 1, X(cx - 3), hy + 1.5, 2.2, 1.5), scale, { depth: 1.5, light: [-0.4, -0.9, 0.3], bias: 0.18 }), 'dark');
        // clouded pale eyes in dark sockets: milky white fading to pale blue, no pupil
        const ex = Math.min(X(cx - 8), X(cx - 4));
        stamp(p, ex, hy + 2, X(0) === 0 ? ['kkkkk', 'kwebk', '.kkk.'] : ['kkkkk', 'kbewk', '.kkk.'], { k: '#28345a', w: '#ffffff', e: '#d8f0ff', b: '#8cb8dc' });
      });
      // nostrils and a slightly open mouth with ice fangs
      p.set(cx - 3, hy + 12, INK); p.set(cx + 3, hy + 12, INK);
      p.hline(cx - 4, cx + 4, hy + 14, INK);
      for (const x of [cx - 3, cx + 3]) { p.set(x, hy + 15, ICE[6]); p.set(x, hy + 16, ICE[4]); }
      for (const x of [cx - 1, cx + 1]) p.set(x, hy + 15, ICE[5]);
      // frost breath curling from the jaw
      for (const [x, y] of [[cx - 6, hy + 16], [cx - 7, hy + 18], [cx + 6, hy + 17], [cx + 8, hy + 19]]) p.set(x, y, '#e8f8ff');

      return close(p, {
        float: true,
        after: (q, dx, dy) => { seeThrough(q, (x, y, c) => !membSet.has(c), { inset: 1 }); void dx; void dy; },
        free: true,
        post: (q) => {
          // snow smoke drifting round the feet
          const r = rng(77);
          for (let k = 0; k < 90; k++) {
            const x = Math.round(20 + r() * 76), y = Math.round(86 + r() * 9);
            if ((x + y) % 2 || y > 95) continue;
            q.set(x, y, r() < 0.5 ? '#ffffff' : '#e0f0ff');
          }
          for (let k = 0; k < 14; k++) { const x = Math.round(8 + r() * 96), y = Math.round(40 + r() * 50); q.set(x, y, '#ffffff'); }
        },
      });
    };

    // ================================================================ mist eater
    // Grey fog that shapes a hooded witch from the waist up (a mimic of the marsh
    // witch) and below the waist opens into one huge round mouth ringed with
    // needle teeth. Two white lantern eyes in the hood; fog trails streaming left
    // and right; a child's red ribbon caught in the mist. The fog is see-through
    // (checker); eyes, teeth, maw and ribbon are solid. 96x96.
    /** soft fog shading: brighter inside, swirling bands from noise */
    function fogFill(m, cols, seed, o) {
      o = o || {};
      const D = edt(m), out = G().pix(m.w, m.h), n = cols.length;
      m.each((x, y) => {
        const d = D[y * m.w + x];
        let t = Math.min(1, d / (o.depth || 6)) * 0.55 + 0.2;
        t += Math.sin(x * 0.23 + y * 0.11 + Math.sin(y * 0.19 + seed) * 1.7) * 0.12 + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.14;
        t += (o.lift || 0) * (1 - y / m.h) - (o.dark || 0) - (o.grad || 0) * (y / m.h - 0.5);
        const f = Math.max(0, Math.min(0.999, t)) * n;
        let k = Math.floor(f);
        if ((x + y) % 2 && f - k > 0.65) k++;
        out.set(x, y, cols[Math.min(n - 1, k)]);
      });
      return out;
    }
    S.boss_mistbeast = () => {
      const W = 96, H = 96, cx = 48;
      const fog = ['#4a5060', '#606878', '#7a828e', '#98a0aa', '#b8c0c8', '#d4dae0', '#eceff2'];
      const MAW = ['#0c0810', '#160e18', '#201828', '#2e2436', '#3e3448'];
      const NEEDLE = ['#8a8e9c', '#c8ccd6', '#f4f6fa'];
      const RIB = ['#801028', '#b01830', '#e03040', '#ff7080'];
      const p = G().pix(W, H);
      const fogSet = new Set(fog);

      // --- fog trails streaming out left and right along the ground
      const trails = G().pix(W, H);
      for (const [pts, r0, r1, sd] of [
        [[[36, 84], [18, 90], [8, 84], [1, 90]], 7, 2, 3],
        [[[60, 84], [78, 92], [88, 84], [95, 91]], 7, 2, 4],
        [[[40, 88], [26, 95], [14, 94], [5, 95]], 4, 1.5, 5],
        [[[56, 88], [70, 95], [82, 95], [92, 95]], 4, 1.5, 6],
      ]) { const m = mask(W, H); tube(m, pts, r0, r1, 1, 24); put(trails, fogFill(m, fog, sd, { depth: 4, dark: 0.08 })); }
      put(p, trails);

      // --- sleeves: fog arms flung out, long clawed fingers
      const arms = G().pix(W, H);
      for (const [pts, fingers, sd] of [
        [[[36, 44], [22, 44], [12, 36], [8, 24]], [[[8, 25], [3, 18], [2, 11]], [[9, 24], [7, 15], [8, 8]], [[10, 25], [12, 17], [15, 12]]], 7],
        [[[60, 44], [74, 46], [84, 42], [89, 32]], [[[89, 33], [94, 27], [95, 20]], [[88, 32], [90, 23], [89, 16]], [[87, 33], [84, 25], [81, 21]]], 8],
      ]) {
        const m = mask(W, H); tube(m, pts, 7, 3.5, 1, 20);
        // the sleeve hangs in ragged tatters under the arm
        for (let t = 0.2; t < 0.9; t += 0.18) { const q = bez(pts, t); tube(m, [q, [q[0] + (t - 0.5) * 3, q[1] + 8], [q[0] + (t - 0.5) * 6, q[1] + 13]], 2.4, 0.6, 1, 8); }
        put(arms, fogFill(m, fog, sd, { depth: 4 }));
        for (const f of fingers) put(arms, part(W, H, (g) => tube(g, f, 1.2, 0.4, 1, 10), fog.slice(1), { depth: 1, light: [-0.4, -0.8, 0.5], bias: 0.15 }), 'dark');
      }
      put(p, arms);

      // --- the body: witch's shoulders and hood above, the great mouth below
      const bm = mask(W, H);
      bm.ellipse(cx, 70, 26, 20, 1);
      bm.ellipse(cx, 48, 17, 9, 1);
      bm.poly([[31, 46], [65, 46], [70, 60], [26, 60]], 1);
      put(p, fogFill(bm, fog, 11, { depth: 7, lift: 0.1, grad: 0.35 }));
      // wisps curling off the silhouette
      for (const [pts, r0] of [[[[28, 58], [21, 60], [19, 55]], 2.2], [[[68, 58], [75, 61], [77, 56]], 2.2], [[[25, 76], [18, 78], [17, 73]], 2], [[[71, 77], [78, 79], [79, 74]], 2]]) {
        const m = mask(W, H); tube(m, pts, r0, 0.6, 1, 10); put(p, fogFill(m, fog, 13, { depth: 2, dark: 0.05 }));
      }
      // hood: pointed, the tip bent over to one side
      const hm = mask(W, H);
      hm.poly([[cx - 16, 44], [cx - 13, 30], [cx - 9, 18], [cx - 3, 10], [cx + 2, 5], [cx + 9, 2], [cx + 13, 5], [cx + 8, 8], [cx + 6, 14], [cx + 11, 22], [cx + 14, 31], [cx + 17, 44]], 1);
      const hood = fogFill(hm, fog, 12, { depth: 5, lift: 0.15 });
      // hood folds
      for (const f of [[[cx - 8, 20], [cx - 12, 32], [cx - 13, 43]], [[cx + 7, 18], [cx + 11, 30], [cx + 14, 43]]]) curve(hood, f, fog[1]);
      put(p, hood, 'dark');
      // the hood's opening: deep shadow with two white lantern eyes
      const om = mask(W, H);
      om.ellipse(cx, 32, 8.5, 8.5, 1);
      om.ellipse(cx, 38, 6.5, 5, 1);
      const open = G().pix(W, H);
      om.each((x, y) => { const d = Math.hypot(x - cx, (y - 33) * 1.1); open.set(x, y, d < 5 ? MAW[1] : d < 7 ? MAW[2] : MAW[3]); });
      put(p, open, 'dark');
      for (const ex of [cx - 4, cx + 4]) {
        // glow halo, lantern body, bright core
        for (const [dx, dy, c] of [[-1, -2, '#b8b490'], [1, -2, '#b8b490'], [-2, 0, '#8a8870'], [2, 0, '#8a8870'], [-1, 2, '#8a8870'], [1, 2, '#8a8870']]) p.set(ex + dx, 31 + dy, c);
        stamp(p, ex - 1, 29, ['.w.', 'wYw', 'wYw', '.w.'], { w: '#e8e4c0', Y: '#fffff0' });
      }

      // --- the great round mouth: fog lips, rings of needle teeth, a throat going down
      const mcx = cx, mcy = 71;
      const mm = mask(W, H);
      mm.ellipse(mcx, mcy, 19, 14, 1);
      const maw = G().pix(W, H);
      mm.each((x, y) => {
        const d = Math.hypot((x - mcx) / 19, (y - mcy) / 14);
        maw.set(x, y, MAW[Math.max(0, Math.min(4, Math.floor(d * 5.2 - (y - mcy) / 30)))]);
      });
      put(p, maw, 'dark');
      // lit lower lip, shadowed upper lip
      for (let a = 0; a < Math.PI * 2; a += 0.02) {
        const x = Math.round(mcx + Math.cos(a) * 20), y = Math.round(mcy + Math.sin(a) * 15);
        if (p.get(x, y) != null && fogSet.has(p.get(x, y))) p.set(x, y, Math.sin(a) > 0.2 ? fog[5] : fog[2]);
      }
      // needle teeth: an outer ring pointing inward, a second ring deeper in
      const needle = (a, r0, len, cols) => {
        for (let k = 0; k < len; k++) {
          const rr = r0 - k;
          const x = mcx + Math.cos(a) * rr * (19 / 14), y = mcy + Math.sin(a) * rr;
          p.set(Math.round(x), Math.round(y), cols[Math.min(cols.length - 1, k === 0 ? 0 : k < len - 1 ? 1 : 2)]);
        }
      };
      for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2; needle(a, 13.5, 4 + (k % 3 === 0 ? 2 : 0), NEEDLE); }
      for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + 0.1; needle(a, 8, 3, ['#4a4e5c', '#8a8e9c', '#b0b4c0']); }
      // throat
      stamp(p, mcx - 2, mcy - 1, ['.kk.', 'kkkk', '.kk.'], { k: '#050306' });

      // --- a child's red ribbon caught in the mist at the left of the mouth
      const rb = G().pix(W, H);
      stamp(rb, 24, 60, ['.rr...rr.', 'rRrr.rrRr', 'rRRrkrRRr', '.rrrkrrr.', '...rkr...', '..rr.rr..', '.rr...rr.', 'rr.....rr'], { r: RIB[1], R: RIB[3], k: RIB[0] });
      curve(rb, [[31, 67], [33, 74], [30, 80]], RIB[2]); curve(rb, [[32, 67], [34, 74], [31, 80]], RIB[1]);
      curve(rb, [[27, 67], [22, 72], [23, 78]], RIB[2]);
      put(p, rb, 'dark');
      const solid = new Set([...MAW, ...NEEDLE, ...RIB, '#e8e4c0', '#fffff0', '#050306', '#4a4e5c', '#8a8e9c', '#b0b4c0', '#b8b490', '#8a8870']);

      return close(p, {
        out: '#282c38',
        after: (q) => seeThrough(q, (x, y, c) => solid.has(c), { inset: 2 }),
      });
    };

    // ================================================================ great octopus arm (minion)
    // One thick octopus arm thrust up out of the water, the tip curled over, rows
    // of pale suckers along its underside, spray and ripples round the base. 48x48.
    S.boss_tentacle = () => {
      const W = 48, H = 48;
      const arm = ['#2e1a3a', '#462a56', '#5e3a70', '#704880', '#946aa2', '#c090c0', '#e0b8dc'];
      const SUCK = ['#8a5a82', '#c090b0', '#f0d0e0', '#fff0f8'];
      const water = ['#0c2a50', '#164070', '#205a90', '#3a80b8', '#6aa8d8', '#a8d4f0', '#c0e0ff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      // --- water surface ring behind
      const wm = mask(W, H);
      wm.ellipse(24, 43, 21, 4.5, 1);
      put(p, shade(wm, water, { depth: 2, light: [-0.3, -0.9, 0.4], global: 0.5, flat: 0.4 }), 'dark');
      // --- the arm: S-curve up from the water, curled tip
      const main = [[22, 45], [8, 28], [37, 26], [29, 11]];
      const curl = [[29, 11], [26, 3], [16, 4], [18, 11]];
      const m = mask(W, H);
      tube(m, main, 7.5, 4, 1, 30);
      tube(m, curl, 4, 1.6, 1, 20);
      const a = shade(m, arm, { depth: 4, light: L, rim: 1, back: { L: [0.6, 0.6, 0.3], c: '#e8b0e0', t: 0.55, edge: 1.2 } });
      // mottled skin
      bump(a, arm, (x, y) => (hash(x, y, 9) < 0.14 ? -1 : hash(x, y, 10) < 0.08 ? 1 : 0));
      put(p, a, 'dark');
      // --- suckers along the inner (lighter) side of the curve
      const suck = (pts, t0, t1, n, side, r0, r1) => {
        for (let i = 0; i <= n; i++) {
          const t = t0 + ((t1 - t0) * i) / n, q = bez(pts, t), q2 = bez(pts, Math.min(1, t + 0.02));
          let nx = -(q2[1] - q[1]), ny = q2[0] - q[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          const r = r0 + (r1 - r0) * (i / n), off = (r0 + 3) * side;
          const sx = q[0] + nx * off * 0.8, sy = q[1] + ny * off * 0.8;
          if (m.get(Math.round(sx), Math.round(sy)) == null) continue;
          const sm = mask(W, H); sm.ellipse(sx, sy, r, r * 0.85, 1);
          const sc = G().pix(W, H);
          sm.each((x, y) => { if (m.get(x, y) != null) sc.set(x, y, Math.hypot(x - sx, y - sy) < r * 0.45 ? SUCK[0] : (x - sx) + (y - sy) < 0 ? SUCK[3] : SUCK[2]); });
          put(p, sc, 'dark');
        }
      };
      suck(main, 0.12, 0.92, 8, -1, 2.2, 1.4);
      suck(curl, 0.1, 0.7, 3, 1, 1.2, 0.9);
      // --- splash: foam ring in front of the arm, droplets
      const fm = mask(W, H);
      fm.ellipse(22, 45, 11, 2.5, 1);
      const foam = shade(fm, water.slice(3), { depth: 1.5, light: [-0.3, -0.9, 0.4], global: 0.6, bias: 0.2 });
      put(p, foam, 'dark');
      for (const [x, y] of [[12, 42], [14, 40], [31, 41], [34, 39], [9, 44], [36, 44]]) { p.set(x, y, water[6]); p.set(x, y - 1, '#ffffff'); }
      return close(p, { post: (q) => { for (const [x, y] of [[6, 36], [40, 34], [38, 30], [10, 32], [42, 40]]) q.set(x, y, water[6]); }, free: true });
    };

    // ================================================================ hell hound
    // A huge black two-headed hound crouched to spring: lava light glowing through
    // cracks in its fur, both jaws open and dripping lava, manes of fire, burning
    // orange eyes, a chain collar on each neck with a snapped iron ring hanging
    // from it, a flame-tipped tail. 96x80.
    S.boss_hellhound = () => {
      const W = 96, H = 80, cx = 48;
      const fur = ['#080506', '#120c0c', '#1c1414', '#281c1a', '#382622', '#4c342c', '#624436'];
      const LAVA = ['#7a1408', '#c83810', '#ff6020', '#ffa030', '#ffd040', '#fff4b0'];
      const FL = ['#8a1a08', '#d04010', '#ff8030', '#ffb850', '#ffe080', '#fffae0'];
      const CHAIN = ['#1e1e24', '#34343c', '#50505a', '#707078', '#9a9aa4', '#c8c8d0'];
      const L = [-0.45, -0.75, 0.55];
      const fireRim = { L: [0.1, -0.95, 0.3], c: '#8a3420', t: 0.4, edge: 1.3 };
      const p = G().pix(W, H);
      const furSet = new Set(fur);

      // --- flame manes behind both heads, and the tail flame
      const fm = mask(W, H);
      for (const [bx, s2] of [[30, -1], [66, 1]]) {
        T.tongue(fm, bx, 36, bx + s2 * 2, 4, 6, -s2 * 3);
        T.tongue(fm, bx - 7, 38, bx - 12, 12, 4.5, -3);
        T.tongue(fm, bx + 7, 38, bx + 12, 11, 4.5, 3);
        T.tongue(fm, bx - 12, 44, bx - 19, 24, 3.4, -2);
        T.tongue(fm, bx + 12, 44, bx + 19, 23, 3.4, 2);
      }
      T.tongue(fm, 84, 50, 92, 26, 3.6, 4);
      put(p, T.fireFill(fm, 5, FL, { core: 0.6 }), 'dark');
      // tail
      put(p, part(W, H, (g) => tube(g, [[70, 56], [84, 56], [88, 44], [90, 36]], 4, 1.8, 1, 18), fur, { depth: 2.5, light: L, back: fireRim }), 'dark');

      // --- the body: low broad back, haunches at the sides
      const bm = mask(W, H);
      bm.ellipse(cx, 54, 30, 13, 1);
      bm.ellipse(17, 60, 12, 11, 1);
      bm.ellipse(79, 60, 12, 11, 1);
      const body = shade(bm, fur, { depth: 7, light: L, back: fireRim, bias: 0.04 });
      T.cracks(body, bm, 31, 6, 7, [LAVA[0], LAVA[1], LAVA[3]]);
      put(p, body, 'dark');
      // hind paws at the sides
      both(W, (X) => {
        put(p, part(W, H, (g) => g.ellipse(X(12), 74, 7, 4, 1), fur, { depth: 2, light: L }), 'dark');
        for (const x of [8, 12, 16]) { p.set(X(x), 77, '#a8a098'); p.set(X(x), 78, '#5a5258'); }
      });

      // --- front legs planted wide, heavy clawed paws
      both(W, (X) => {
        const lm = mask(W, H);
        cap(lm, X(36), 54, X(31), 68, 7.5, 6); cap(lm, X(31), 68, X(30), 74, 6, 5.5);
        const lg = shade(lm, fur, { depth: 4, light: L, back: fireRim });
        T.cracks(lg, lm, X(0) === 0 ? 41 : 42, 1, 6, [LAVA[0], LAVA[1], LAVA[3]]);
        put(p, lg, 'dark');
        put(p, part(W, H, (g) => g.ellipse(X(30), 75.5, 8, 4, 1), fur, { depth: 2.5, light: L }), 'dark');
        for (const x of [25, 30, 35]) { p.set(X(x), 77, '#b8b0a8'); p.set(X(x), 78, '#6a6268'); p.set(X(x) + 1, 77, '#8a8288'); }
      });

      // --- two necks and heads
      const head = (hx, hy, dir) => {
        const X = (x) => hx + dir * x;
        // neck up from the shoulder
        const nm = mask(W, H);
        cap(nm, cx + dir * 11, 52, X(0), hy + 4, 10, 8);
        const neck = shade(nm, fur, { depth: 5, light: L, back: fireRim });
        T.cracks(neck, nm, 50 + dir, 2, 6, [LAVA[0], LAVA[1], LAVA[3]]);
        // ruff strokes
        for (let k = 0; k < 14; k++) { const x = X(-7 + k), y = hy + 6 + (k % 3); neck.line(Math.round(x), y, Math.round(x + dir), y + 3, fur[k % 2 ? 4 : 1]); }
        put(p, neck, 'dark');
        // chain collar: a row of oval links round the neck, a snapped ring hanging
        const links = G().pix(W, H);
        for (let k = 0; k < 6; k++) {
          const t = k / 5, x = X(-9 + t * 18), y = hy + 13 + Math.sin(t * Math.PI) * 3;
          const lk = mask(W, H); lk.ellipse(x, y, 2.2, 1.6, 1);
          const sh = shade(lk, CHAIN, { depth: 1, light: L, spec: 0.85 });
          sh.set(Math.round(x), Math.round(y), k % 2 ? CHAIN[1] : null);
          put(links, sh, 'dark');
        }
        put(p, links, 'dark');
        const rx = X(3), ry = hy + 20;
        const rg = G().pix(W, H);
        for (let a = 0.5; a < Math.PI * 2 - 0.4; a += 0.08) { rg.set(Math.round(rx + Math.cos(a) * 3.6), Math.round(ry + Math.sin(a) * 3.6), Math.cos(a - 3.9) > 0.3 ? CHAIN[5] : Math.sin(a) > 0 ? CHAIN[1] : CHAIN[3]); }
        rg.set(rx, ry - 4, CHAIN[4]);
        put(p, rg, 'dark');
        // ears: tall, pointed, laid back and out
        for (const [bx, by, tx, ty] of [[X(-6), hy - 6, X(-12), hy - 15], [X(6), hy - 6, X(11), hy - 16]]) {
          put(p, part(W, H, (g) => g.poly([[bx - 3, by + 1], [bx + 3, by], [tx, ty]], 1), fur, { depth: 1.5, light: L, back: fireRim, bias: 0.1 }), 'dark');
          p.line(Math.round(bx), by - 1, Math.round(tx + (bx - tx) * 0.3), Math.round(ty + (by - ty) * 0.3), LAVA[0]);
        }
        // cheek ruffs: spiky fur at the sides of the head
        for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
          const bx = hx + sd * 7, by = hy + k * 3;
          put(p, part(W, H, (g) => g.poly([[bx, by - 2], [bx, by + 2], [bx + sd * (5 - k), by + 1 + k]], 1), fur, { depth: 1, light: L, back: fireRim }), 'dark');
        }
        // skull, long muzzle pushed toward us (turned a little outward)
        const mo = dir * 1.5;
        const hm = mask(W, H);
        hm.ellipse(hx, hy - 3, 8.5, 6.5, 1);
        hm.poly([[hx - 6 + mo, hy - 1], [hx + 6 + mo, hy - 1], [hx + 4 + mo, hy + 9], [hx - 4 + mo, hy + 9]], 1);
        const hd = shade(hm, fur, { depth: 4, light: L, normal: sphereN(hx - 1, hy - 2, 9, 10), blend: 0.35, back: fireRim, bias: 0.08 });
        // bridge of the muzzle
        for (let y = hy - 2; y <= hy + 6; y++) { on(hd, hx + mo, y, fur[5]); on(hd, hx + mo + 1, y, fur[3]); }
        put(p, hd, 'dark');
        // heavy angry brows over small burning eyes
        for (const sd of [-1, 1]) {
          const ex = hx + sd * 4 + mo * 0.3;
          p.line(Math.round(ex - 3), hy - 5 + (sd < 0 ? 0 : 1), Math.round(ex + 3), hy - 5 + (sd < 0 ? 1 : 0), INK);
          p.line(Math.round(ex - 3), hy - 6 + (sd < 0 ? 0 : 1), Math.round(ex + 3), hy - 6 + (sd < 0 ? 1 : 0), fur[4]);
          stamp(p, Math.round(ex) - 1, hy - 4, sd < 0 ? ['oYk', 'kok'] : ['kYo', 'kok'], { k: INK, o: FL[2], Y: FL[5] });
        }
        // nose at the tip of the muzzle
        stamp(p, Math.round(hx + mo) - 2, hy + 6, ['.kkk.', 'kkwkk', '.k.k.'], { k: '#0a0606', w: fur[5] });
        // snarl: wrinkled upper lip, open jaws with lava deep inside, fangs top and bottom
        const mm = mask(W, H);
        mm.poly([[hx - 5 + mo, hy + 9], [hx + 5 + mo, hy + 9], [hx + 4 + mo, hy + 14], [hx + mo, hy + 16], [hx - 4 + mo, hy + 14]], 1);
        const maw = G().pix(W, H);
        mm.each((x, y) => { const d = Math.hypot(x - hx - mo, y - (hy + 13)); maw.set(x, y, d < 1.6 ? LAVA[4] : d < 3 ? LAVA[2] : d < 4.4 ? '#5a0c08' : '#2a0606'); });
        put(p, maw, 'dark');
        for (const [x, y, n] of [[-4, 9, 3], [-1.5, 9, 1], [1.5, 9, 1], [4, 9, 3], [-3, 14, -2], [3, 14, -2]]) {
          for (let k = 0; k < Math.abs(n); k++) p.set(Math.round(hx + mo + x), hy + y + Math.sign(n) * k, k === Math.abs(n) - 1 ? '#c8b898' : '#f4ecd8');
        }
        put(p, part(W, H, (g) => g.poly([[hx - 4 + mo, hy + 15], [hx + 4 + mo, hy + 15], [hx + mo, hy + 18]], 1), fur, { depth: 1.2, light: L, bias: 0.05 }), 'dark');
        // lava drool
        for (const [x, y, n] of [[-1, 17, 5], [2, 17, 3], [-3, 15, 2]]) {
          for (let k = 0; k < n; k++) p.set(Math.round(hx + mo + x), hy + y + k, k === n - 1 ? LAVA[4] : k === 0 ? LAVA[1] : LAVA[2]);
          p.set(Math.round(hx + mo + x), hy + y + n, LAVA[5]);
        }
      };
      head(30, 36, -1);
      head(66, 36, 1);

      // fire light on the upper edges of the fur
      // lava light on the fur's outer edges: hot from below, warm at the sides, dimmer on top
      edgeLight(p, { src: (c) => furSet.has(c), nb: (c) => c == null, dirs: [{ d: [0, 1], c: '#d85a24' }, { d: [-1, 0], c: '#a8401c' }, { d: [1, 0], c: '#a8401c' }, { d: [0, -1], c: '#7a3018' }] });
      return close(p, { post: (q) => { for (const [x, y, c] of [[10, 20, FL[3]], [86, 14, FL[4]], [48, 8, FL[3]], [4, 34, FL[2]], [94, 30, FL[2]], [50, 20, FL[4]]]) q.set(x, y, c); }, free: true });
    };

    // ================================================================ star eater
    // A long cross of wolf and serpent like a hole cut in the night sky: pitch
    // black, outlined only by a violet rim, swallowed constellations glimmering
    // faintly inside; stars jammed between its fangs, stardust drool, three pale
    // white eyes; the thin tail rises and melts into the sky as scattered stars.
    // 112x96.
    S.boss_stareater = () => {
      const W = 112, H = 96;
      const VOID = ['#040408', '#080810', '#0c0c18', '#121222', '#1a1a30'];
      const NEB = ['#140e30', '#1e1444', '#2a1a58'];
      const RIM = '#8050c0', RIM2 = '#4a2c80', RIM3 = '#b890f0';
      const STAR = ['#303060', '#5a60a0', '#8890d8', '#c0c8ff', '#e8ecff', '#ffffff'];
      const EYE = ['#6a70b0', '#a8b0e8', '#e0e8ff', '#ffffff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      const voidSet = new Set([...VOID, ...NEB]);
      /** pitch-black part: barely-there shading, a faint nebula drifting inside */
      const dark = (m, seed) => {
        const q = shade(m, VOID, { depth: 6, light: L, bias: -0.12, global: 0.3 });
        const D = edt(m);
        m.each((x, y) => {
          if (D[y * W + x] < 2.5) return;
          const n = Math.sin(x * 0.17 + y * 0.09 + seed) + Math.sin(y * 0.21 - x * 0.05 + seed * 2) + (hash(x, y, seed) - 0.5) * 0.9;
          if (n > 1.25) q.set(x, y, (x + y) % 2 ? NEB[1] : NEB[0]);
          if (n > 1.7) q.set(x, y, (x + y) % 2 ? NEB[2] : NEB[1]);
        });
        return q;
      };
      const constellation = (pts) => {
        for (let i = 0; i + 1 < pts.length; i++) { const [a2, b2] = [pts[i], pts[i + 1]]; const n = Math.max(Math.abs(b2[0] - a2[0]), Math.abs(b2[1] - a2[1])); for (let k = 1; k < n; k++) { const x = Math.round(a2[0] + ((b2[0] - a2[0]) * k) / n), y = Math.round(a2[1] + ((b2[1] - a2[1]) * k) / n); if (voidSet.has(p.get(x, y)) && k % 2) p.set(x, y, STAR[0]); } }
        for (const [x, y, big] of pts) { if (!voidSet.has(p.get(x, y))) continue; p.set(x, y, big ? STAR[5] : STAR[3]); if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (voidSet.has(p.get(x + dx, y + dy))) p.set(x + dx, y + dy, STAR[1]); }
      };

      // --- tail: rises up the right edge and melts into the sky
      const tail = [[98, 84], [110, 62], [108, 32], [94, 12]];
      const tm = mask(W, H); tube(tm, tail, 6, 1, 1, 30);
      tm.each((x, y) => (y < 26 && hash(x, y, 3) < (26 - y) / 14 ? null : undefined));
      put(p, dark(tm, 1), RIM2);
      // --- the long serpent body: arches up behind the head, loops down and round
      const back = [[46, 52], [56, 22], [84, 24], [86, 56]];
      const coil = [[86, 56], [88, 88], [64, 98], [52, 86]];
      const low = [[84, 60], [86, 90], [96, 94], [100, 82]];
      for (const [pts, r0, r1, sd] of [[low, 8, 6, 2], [back, 9, 10, 3], [coil, 10, 7, 4]]) {
        const bm = mask(W, H); tube(bm, pts, r0, r1, 1, 30);
        put(p, dark(bm, sd), RIM2);
      }
      // --- front legs: wolf legs braced wide, hooked claws
      for (const [x0, x1, sd] of [[36, 24, 5], [48, 46, 6]]) {
        const lm = mask(W, H); cap(lm, x0, 58, x1, 82, 6, 4.2); cap(lm, x1, 82, x1 - 1, 90, 4.2, 4.5);
        lm.ellipse(x1 - 1, 91.5, 6, 3, 1);
        put(p, dark(lm, sd), RIM2);
        for (const dx of [-5, -2, 1, 4]) { p.set(x1 - 1 + dx, 94, STAR[3]); p.set(x1 - 2 + dx, 95, STAR[1]); }
      }
      // --- neck and chest
      const nm = mask(W, H); cap(nm, 46, 58, 38, 42, 12, 9);
      put(p, dark(nm, 7), RIM2);

      // --- head: long wolf skull thrust forward and down, jaws gaping wide
      const hx = 30, hy = 36;
      for (const [bx, by, tx, ty] of [[hx + 3, hy - 6, hx + 12, hy - 16], [hx + 8, hy - 3, hx + 19, hy - 9]]) {
        const em = mask(W, H); em.poly([[bx - 3, by + 1.5], [bx + 3, by - 1], [tx, ty]], 1); put(p, dark(em, 8), RIM2);
      }
      const hm = mask(W, H);
      hm.ellipse(hx + 2, hy - 1, 9.5, 7.5, 1);
      // upper jaw / snout reaching down-left
      hm.poly([[hx - 4, hy - 5], [hx + 5, hy + 2], [hx - 6, hy + 11], [hx - 15, hy + 13], [hx - 16, hy + 10], [hx - 8, hy + 2]], 1);
      put(p, dark(hm, 9), RIM2);
      // the maw between the jaws: deep violet, stars caught in it
      const mm = mask(W, H);
      mm.poly([[hx - 15, hy + 12], [hx - 5, hy + 10], [hx + 3, hy + 6], [hx + 2, hy + 14], [hx - 6, hy + 20], [hx - 14, hy + 19]], 1);
      const maw = G().pix(W, H);
      mm.each((x, y) => { const d = Math.hypot(x - (hx - 5), y - (hy + 14)); maw.set(x, y, d < 3 ? '#3a1c68' : d < 6 ? '#2a1450' : '#1a0c30'); });
      put(p, maw, RIM2);
      // lower jaw hanging open
      const lj = mask(W, H);
      lj.poly([[hx + 3, hy + 10], [hx + 1, hy + 16], [hx - 6, hy + 22], [hx - 15, hy + 23], [hx - 14, hy + 20], [hx - 6, hy + 18]], 1);
      put(p, dark(lj, 10), RIM2);
      // fangs down from the upper jaw, up from the lower
      for (const [x, y, n] of [[-14, 13, 3], [-11, 12, 2], [-8, 11, 3], [-4, 10, 2], [-13, 20, -3], [-9, 19, -2], [-5, 18, -3], [-1, 15, -2]]) for (let k = 0; k < Math.abs(n); k++) p.set(hx + x, hy + y + Math.sign(n) * k, k === Math.abs(n) - 1 ? '#9088c0' : '#d8d0f8');
      for (const [x, y] of [[hx - 10, hy + 16], [hx - 4, hy + 14], [hx - 7, hy + 18]]) T.star4(p, x, y, 1, [STAR[3], STAR[5]]);
      T.star4(p, hx - 1, hy + 11, 2, [STAR[2], STAR[3], STAR[4], STAR[5]]);
      // three pale eyes: two along the skull, one on the brow
      stamp(p, hx - 5, hy - 3, ['bw..', '.eeb', '..b.'], { b: EYE[0], w: EYE[1], e: EYE[3] });
      stamp(p, hx + 3, hy - 4, ['bwb.', '.eeb'], { b: EYE[0], w: EYE[1], e: EYE[3] });
      stamp(p, hx - 1, hy - 9, ['.b.', 'bwb', 'beb', '.b.'], { b: EYE[0], w: EYE[2], e: EYE[3] });
      p.set(hx - 16, hy + 10, STAR[2]); // nose

      // --- swallowed constellations glimmering inside the body
      constellation([[60, 90, 1], [66, 86, 0], [72, 92, 0], [80, 86, 1], [84, 76, 0]]);
      constellation([[52, 40, 0], [58, 30, 1], [66, 24, 0], [76, 26, 0], [82, 36, 1]]);
      constellation([[104, 64, 1], [106, 52, 0], [104, 42, 0], [100, 32, 1]]);
      constellation([[40, 60, 0], [44, 52, 1], [38, 46, 0]]);
      constellation([[90, 90, 0], [96, 88, 1]]);
      const r = rng(4242);
      for (let k = 0; k < 50; k++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (voidSet.has(p.get(x, y))) p.set(x, y, r() < 0.3 ? STAR[2] : STAR[1]); }

      edgeLight(p, { src: (c) => voidSet.has(c), nb: (c) => c == null, dirs: [{ d: [-1, 0], c: RIM3 }, { d: [0, -1], c: RIM3 }, { d: [1, 0], c: RIM }, { d: [0, 1], c: RIM2 }] });
      return close(p, {
        free: true,
        post: (q) => {
          for (const [x, y, n] of [[hx - 12, hy + 25, 8], [hx - 7, hy + 24, 5]]) for (let k = 0; k < n; k += 2) q.set(x, y + k, k % 4 ? STAR[3] : STAR[5]);
          for (const [x, y, big] of [[92, 12, 1], [86, 8, 0], [98, 8, 0], [82, 14, 0], [90, 3, 0], [102, 18, 1], [78, 6, 0], [96, 22, 0], [106, 26, 0]]) { if (big) T.star4(q, x, y, 2, [STAR[2], STAR[3], STAR[4], STAR[5]]); else q.set(x, y, STAR[3]); }
        },
      });
    };

    // ================================================================ Rowell (rival)
    // A young man of about twenty from the waist up, facing us: the white coat of
    // the Record Office with gold trim and a high standing collar, black hair tied
    // back, sharp eyes; an open black notebook in his left hand and a silver pen
    // held out like a rapier in his right. 64x80.
    S.boss_rowell = () => {
      const W = 64, H = 80, cx = 32;
      const coat = ['#5a5a6e', '#80808e', '#a4a4b2', '#c8c8d0', '#e0e0e6', '#f0f0f0', '#ffffff'];
      const hair = ['#08080c', '#121218', '#202028', '#30303c', '#464656', '#62627a'];
      const skin = ['#9a6450', '#c08468', '#dea284', '#f2c4a2', '#fcdcc0', '#fff0e2'];
      const trim = ['#6a4a10', '#9a7420', '#d0b040', '#f0d870', '#fff4c0'];
      const BOOK = ['#0a0a0c', '#161618', '#202020', '#34343a', '#50505a'];
      const PAGE = ['#a8a4a0', '#d8d4cc', '#f4f0e8', '#ffffff'];
      const PEN = ['#4a5060', '#7a8298', '#a0a8bc', '#c0c8d8', '#e4e8f4', '#ffffff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      const gold = (q, pts) => { curve(q, pts, trim[3]); curve(q, pts.map(([x, y]) => [x + 0.6, y + 1]), trim[1]); };

      // --- ponytail behind the head, falling past the right shoulder
      put(p, part(W, H, (g) => tube(g, [[38, 12], [46, 16], [47, 28], [44, 38]], 3.2, 1.6, 1, 16), hair, { depth: 1.8, light: L }), 'dark');
      // --- coat: shoulders and body down to the waist
      const cm = mask(W, H);
      cm.poly([[cx - 10, 32], [cx + 10, 32], [cx + 21, 37], [cx + 25, 44], [cx + 25, 79], [cx - 25, 79], [cx - 25, 44], [cx - 21, 37]], 1);
      const body = shade(cm, coat, { depth: 6, light: L, normal: sphereN(cx - 3, 50, 28, 34), blend: 0.4, bias: 0.06, rim: 1 });
      // folds, the front opening with gold trim, buttons, the Office's gold book badge
      for (const [x0, y0, x1, y1] of [[cx - 14, 50, cx - 17, 78], [cx + 13, 52, cx + 16, 78], [cx - 5, 60, cx - 6, 78]]) { body.line(x0, y0, x1, y1, coat[2]); body.line(x0 + 1, y0, x1 + 1, y1, coat[5]); }
      gold(body, [[cx + 1, 36], [cx + 1, 58], [cx + 2, 79]]);
      for (const y of [44, 52, 60, 68]) stamp(body, cx - 2, y, ['.g.', 'gGg', '.g.'], { g: trim[1], G: trim[3] });
      stamp(body, cx - 15, 42, ['gg.gg', 'gGgGg', 'gGgGg', '.ggg.'], { g: trim[1], G: trim[3] });
      gold(body, [[cx - 25, 78], [cx, 78], [cx + 25, 78]]);
      put(p, body, 'dark');
      // shoulder seams with gold piping
      both(W, (X) => { gold(p, [[X(cx - 11), 33], [X(cx - 18), 36], [X(cx - 23), 42]]); });

      // --- right arm (viewer's left): elbow out, hand before the chest gripping the pen
      const ra = mask(W, H);
      cap(ra, cx - 21, 40, cx - 26, 56, 5, 4.4); cap(ra, cx - 26, 56, cx - 16, 58, 4.4, 4);
      put(p, shade(ra, coat, { depth: 3.5, light: L, bias: 0.04 }), 'dark');
      gold(p, [[cx - 20, 55], [cx - 18, 59], [cx - 16, 62]]);
      // the silver pen, held like a rapier: shaft from the fist up and out, a fine nib
      const pen = mask(W, H);
      cap(pen, cx - 12, 62, cx - 27, 18, 1.4, 1);
      put(p, shade(pen, PEN, { depth: 1, light: L, spec: 0.8, flat: 0.3 }), 'dark');
      const nib = mask(W, H); nib.poly([[cx - 28, 20], [cx - 26, 19], [cx - 30, 8]], 1);
      put(p, shade(nib, PEN, { depth: 1, light: L, bias: 0.2 }), 'dark');
      p.set(cx - 29, 11, PEN[5]); p.set(cx - 27, 17, trim[3]); p.set(cx - 26, 18, trim[2]);
      for (let t = 0.2; t < 0.9; t += 0.2) p.set(Math.round(cx - 12 - 15 * t) + 1, Math.round(62 - 44 * t), PEN[5]);
      const fist = mask(W, H); fist.ellipse(cx - 15, 57, 3.6, 3.2, 1);
      put(p, shade(fist, skin, { depth: 1.5, light: L }), 'dark');
      p.hline(cx - 17, cx - 14, 57, skin[1]);

      // --- left arm (viewer's right): holding the open black notebook
      const la = mask(W, H);
      cap(la, cx + 21, 40, cx + 24, 56, 5, 4.4); cap(la, cx + 24, 56, cx + 15, 60, 4.4, 4);
      put(p, shade(la, coat, { depth: 3.5, light: L, bias: 0.02 }), 'dark');
      gold(p, [[cx + 17, 57], [cx + 16, 61], [cx + 15, 64]]);
      const bk = mask(W, H); bk.poly([[cx + 4, 52], [cx + 14, 49], [cx + 24, 52], [cx + 24, 66], [cx + 14, 64], [cx + 4, 67]], 1);
      put(p, shade(bk, BOOK, { depth: 1.5, light: L, global: 0.4 }), 'dark');
      const pg = mask(W, H); pg.poly([[cx + 5, 53], [cx + 14, 50.5], [cx + 23, 53], [cx + 23, 64], [cx + 14, 62], [cx + 5, 65]], 1);
      const pages = shade(pg, PAGE, { depth: 1, light: L, global: 0.5, bias: 0.1 });
      pages.line(cx + 14, 51, cx + 14, 62, PAGE[0]);
      for (const y of [54, 56, 58, 60]) { pages.hline(cx + 7, cx + 12, y + 1, BOOK[3]); pages.hline(cx + 16, cx + 21, y, BOOK[3]); }
      put(p, pages, 'dark');
      const lh = mask(W, H); lh.ellipse(cx + 16, 64, 3.4, 2.8, 1);
      put(p, shade(lh, skin, { depth: 1.5, light: L }), 'dark');

      // --- standing collar, neck, head
      const nk = mask(W, H); nk.rect(cx - 4, 26, 9, 8, 1);
      put(p, shade(nk, skin, { depth: 2, light: L, bias: -0.15 }), 'dark');
      both(W, (X) => {
        const cl = mask(W, H); cl.poly([[X(cx - 1), 36], [X(cx - 7), 36], [X(cx - 11), 32], [X(cx - 9), 24], [X(cx - 5), 27]], 1);
        const col = shade(cl, coat, { depth: 2, light: L, bias: 0.08 });
        gold(col, [[X(cx - 9), 25], [X(cx - 11), 32], [X(cx - 7), 36]]);
        put(p, col, 'dark');
      });
      const hm = mask(W, H);
      hm.ellipse(cx, 17, 8, 9, 1);
      hm.poly([[cx - 7, 19], [cx + 7, 19], [cx + 4, 26], [cx + 1, 28], [cx - 1, 28], [cx - 4, 26]], 1);
      const face = shade(hm, skin, { depth: 3, light: L, normal: sphereN(cx - 1.5, 15, 9, 12), blend: 0.3, bias: 0.3, global: 0.12 });
      put(p, face, 'dark');
      // ears
      both(W, (X) => put(p, part(W, H, (g) => g.ellipse(X(cx - 8), 19, 1.4, 2.4, 1), skin, { depth: 1, light: L, bias: 0.1 }), 'dark'));
      // hair: black, swept, sharp bangs; short at the sides, tied back behind
      const hr = mask(W, H);
      hr.ellipse(cx, 11, 9.5, 7.5, 1);
      hr.poly([[cx - 9.5, 11], [cx - 9, 19], [cx - 7.5, 15], [cx - 6, 13.5], [cx - 4, 16], [cx - 2, 13], [cx + 1, 16], [cx + 3, 13], [cx + 5, 15.5], [cx + 7, 13.5], [cx + 8.5, 18], [cx + 9.5, 11]], 1);
      const hs = shade(hr, hair, { depth: 3, light: L, normal: sphereN(cx - 2, 9, 10, 9), blend: 0.4, bias: 0.04 });
      for (const [a2, b2] of [[[cx - 6, 5], [cx - 7, 12]], [[cx - 2, 4], [cx - 3, 12]], [[cx + 3, 4], [cx + 3, 12]], [[cx + 6, 6], [cx + 7, 12]]]) curve(hs, [a2, [(a2[0] + b2[0]) / 2 - 1, (a2[1] + b2[1]) / 2], b2], hair[4]);
      curve(hs, [[cx - 6, 6], [cx - 1, 3.5], [cx + 4, 5]], hair[5]);
      put(p, hs, 'dark');
      p.set(cx + 9, 12, trim[2]); p.set(cx + 10, 13, trim[3]);
      // stern eyes: brows angled down to the nose, narrowed lids, dark grey-blue irises
      both(W, (X, sd) => {
        p.line(X(cx - 7), 15, X(cx - 2), 17, hair[1]); p.line(X(cx - 6), 16, X(cx - 3), 17, hair[2]);
        const ex = Math.min(X(cx - 6), X(cx - 2));
        stamp(p, ex, 18, sd > 0 ? ['kkkkk', 'wwBik', '.kkk.'] : ['kkkkk', 'kiBww', '.kkk.'], { k: INK, w: '#f8f4f0', B: '#3a5078', i: '#101420' });
        p.set(X(cx - 5), 21, skin[2]);
      });
      p.set(cx, 22, skin[2]); p.set(cx - 1, 23, skin[1]); p.set(cx, 23, skin[2]);
      p.hline(cx - 2, cx + 1, 25, '#9a5448'); p.set(cx + 2, 26, '#b07060'); p.set(cx - 3, 26, '#b07060');
      return close(p);
    };

    // ================================================================ the three shades of legend
    // White, see-through echoes of three heroes of old (a swordsman, a temple
    // maiden, a young mage). No faces: only light welling where a face would be.
    // Pale bodies are checker-dithered, with a light outline; weapons and the
    // light stay solid; the feet break up into motes of light. 64x80 each.
    const SH = ['#7a84b8', '#98a4d8', '#b8c4ec', '#d4dcf6', '#e8ecfc', '#f8f8ff', '#ffffff'];
    const GLOW = ['#e8d890', '#fff0b0', '#fff8d8', '#ffffff'];
    const SH_OUT = '#a0b0e0';
    const shL = [-0.45, -0.75, 0.55];
    const ghost = (W, H, fn, o) => shade((() => { const m = mask(W, H); fn(m); return m; })(), SH, Object.assign({ depth: 3, light: shL, bias: 0.12 }, o || {}));
    /** the glowing blank face: a pale oval with light welling in its middle */
    function blankFace(p, W, H, cx, cy, rx, ry) {
      const m = mask(W, H); m.ellipse(cx, cy, rx, ry, 1);
      const f = G().pix(W, H);
      m.each((x, y) => { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); f.set(x, y, d < 0.35 ? GLOW[3] : d < 0.6 ? GLOW[2] : d < 0.85 ? GLOW[1] : SH[4]); });
      put(p, f, SH[2]);
    }
    /** outline in light blue, dither the body, dissolve the feet into motes */
    function ghostClose(p, solid, feetY, seed) {
      const W = p.w, H = p.h;
      const keep = new Set([...solid, ...GLOW, SH[0], SH[1]]); // contour lines stay solid so the forms still read
      return close(p, {
        out: SH_OUT,
        after: (q) => {
          seeThrough(q, (x, y, c) => keep.has(c), { inset: 2 });
          const r = rng(seed);
          for (let y = feetY; y < H; y++) for (let x = 0; x < W; x++) {
            const c = q.get(x, y);
            if (c == null) continue;
            const t = (y - feetY) / (H - feetY);
            if (r() < 0.25 + t * 0.7) q.set(x, y, r() < 0.08 ? GLOW[1] : null);
          }
        },
        free: true,
        post: (q) => {
          const r = rng(seed + 1);
          for (let k = 0; k < 16; k++) { const x = Math.round(12 + r() * 40), y = Math.round(feetY - 6 + r() * (H - feetY + 5)); q.set(x, y, r() < 0.5 ? GLOW[1] : '#ffffff'); }
        },
      });
    }

    S.boss_shade_sword = () => {
      const W = 64, H = 80, cx = 32;
      const BLADE = ['#9aa8d0', '#c8d4f0', '#ffffff'];
      const p = G().pix(W, H);
      // short cape behind, stirring
      put(p, ghost(W, H, (m) => m.poly([[cx - 8, 24], [cx + 8, 24], [cx + 14, 40], [cx + 15, 56], [cx + 10, 53], [cx + 6, 57], [cx, 54], [cx - 6, 57], [cx - 10, 53], [cx - 15, 56], [cx - 14, 40]], 1), { bias: -0.05 }), SH[0]);
      // legs apart, boots
      for (const [x0, x1] of [[cx - 4, cx - 8], [cx + 4, cx + 8]]) put(p, ghost(W, H, (m) => { cap(m, x0, 46, x1, 62, 3.4, 3); cap(m, x1, 62, x1, 74, 3, 3.2); m.ellipse(x1 + (x1 < cx ? -1 : 1), 76, 4.2, 2.4, 1); }), SH[0]);
      // tunic: torso and a short skirt
      put(p, ghost(W, H, (m) => { m.poly([[cx - 8, 23], [cx + 8, 23], [cx + 7, 42], [cx + 10, 52], [cx - 10, 52], [cx - 7, 42]], 1); }, { normal: sphereN(cx - 2, 36, 12, 18), blend: 0.4 }), SH[0]);
      curve(p, [[cx - 7, 42], [cx, 43], [cx + 7, 42]], SH[1]); // belt
      // shield arm (viewer's right): round shield with a rim and boss
      put(p, ghost(W, H, (m) => cap(m, cx + 8, 25, cx + 12, 36, 3, 2.6)), SH[0]);
      const sm = mask(W, H); sm.circle(cx + 13, 40, 8.5, 1);
      const sh = shade(sm, SH, { depth: 2.5, light: shL, bias: 0.1, normal: sphereN(cx + 11, 38, 10, 10), blend: 0.3 });
      for (let a = 0; a < Math.PI * 2; a += 0.05) { on(sh, cx + 13 + Math.cos(a) * 7.5, 40 + Math.sin(a) * 7.5, SH[2]); }
      stamp(sh, cx + 12, 39, ['ww', 'ww'], { w: GLOW[2] });
      put(p, sh, 'dark');
      // sword arm (viewer's left) and the long sword held upright
      put(p, ghost(W, H, (m) => { cap(m, cx - 8, 25, cx - 12, 36, 3, 2.6); cap(m, cx - 12, 36, cx - 14, 42, 2.6, 2.4); }), SH[0]);
      const bl = mask(W, H); bl.poly([[cx - 16, 36], [cx - 13, 36], [cx - 13.5, 6], [cx - 14.5, 2], [cx - 15.5, 6]], 1);
      const blade = G().pix(W, H);
      bl.each((x, y) => blade.set(x, y, x <= cx - 15 ? BLADE[1] : x === cx - 14 ? BLADE[2] : BLADE[0]));
      put(p, blade, SH_OUT);
      put(p, part(W, H, (g) => g.rect(cx - 20, 36, 11, 2, 1), SH, { depth: 1, light: shL, bias: 0.2 }), SH_OUT); // crossguard
      put(p, part(W, H, (g) => g.rect(cx - 15, 38, 2, 6, 1), SH, { depth: 1, light: shL }), SH_OUT); // grip
      p.set(cx - 14, 45, GLOW[1]);
      const fist = mask(W, H); fist.ellipse(cx - 14, 41, 2.6, 2.4, 1);
      put(p, shade(fist, SH, { depth: 1, light: shL, bias: 0.15 }), SH[0]);
      // head: short spiky hair silhouette, the blank glowing face
      put(p, ghost(W, H, (m) => { m.rect(cx - 2, 18, 5, 6, 1); }), SH[0]);
      put(p, ghost(W, H, (m) => { m.ellipse(cx, 13, 6.5, 6.5, 1); m.poly([[cx - 7, 12], [cx - 9, 7], [cx - 5, 8], [cx - 4, 3], [cx, 6], [cx + 3, 2], [cx + 5, 7], [cx + 9, 6], [cx + 7, 12]], 1); }, { bias: 0.02 }), SH[0]);
      blankFace(p, W, H, cx, 15, 4.5, 5);
      return ghostClose(p, BLADE, 66, 31);
    };

    S.boss_shade_prayer = () => {
      const W = 64, H = 80, cx = 30;
      const p = G().pix(W, H);
      // long veil falling behind to the knees
      put(p, ghost(W, H, (m) => m.poly([[cx - 6, 8], [cx + 6, 8], [cx + 10, 18], [cx + 15, 40], [cx + 16, 62], [cx + 8, 60], [cx, 62], [cx - 8, 60], [cx - 16, 62], [cx - 15, 40], [cx - 10, 18]], 1), { bias: -0.08 }), SH[0]);
      // long robe to the ground, flared hem, wide sleeves
      put(p, ghost(W, H, (m) => m.poly([[cx - 7, 23], [cx + 7, 23], [cx + 9, 44], [cx + 14, 74], [cx + 10, 77], [cx, 76], [cx - 10, 77], [cx - 14, 74], [cx - 9, 44]], 1), { normal: sphereN(cx - 2, 44, 14, 30), blend: 0.4 }), SH[0]);
      for (const [x0, x1] of [[cx - 4, cx - 7], [cx + 3, cx + 6], [cx, cx]]) curve(p, [[x0, 46], [(x0 + x1) / 2, 60], [x1, 75]], SH[2]);
      curve(p, [[cx - 7, 37], [cx, 39], [cx + 7, 37]], SH[1]); // sash
      // both hands on the staff before her, held a little to her left
      put(p, ghost(W, H, (m) => { cap(m, cx - 7, 25, cx - 1, 37, 3.4, 3); m.poly([[cx - 4, 33], [cx + 5, 35], [cx + 4, 44], [cx - 6, 44]], 1); cap(m, cx + 7, 25, cx + 8, 35, 3.4, 3); }, { bias: 0.06 }), SH[0]);
      // the staff: from the ground up past her head, topped by a sun disk
      const sx = cx + 10;
      put(p, part(W, H, (g) => g.rect(sx - 1, 12, 2, 66, 1), SH, { depth: 1, light: shL, bias: 0.1 }), SH_OUT);
      const sun = G().pix(W, H);
      for (let y = 0; y < 22; y++) for (let x = sx - 11; x <= sx + 11; x++) {
        const d = Math.hypot(x - sx, y - 9);
        const a = Math.atan2(y - 9, x - sx);
        if (d <= 4.5) sun.set(x, y, d < 2 ? GLOW[3] : d < 3.4 ? GLOW[2] : GLOW[1]);
        else if (d <= 8.5 && Math.abs(Math.sin(a * 4)) > 0.86) sun.set(x, y, d < 6.5 ? GLOW[1] : GLOW[0]);
      }
      put(p, sun, SH_OUT);
      for (const hx of [sx - 1, sx]) { const hm = mask(W, H); hm.ellipse(hx, hx === sx ? 34 : 38, 2.6, 2.2, 1); put(p, shade(hm, SH, { depth: 1, light: shL, bias: 0.15 }), SH[0]); }
      // head under the veil, the blank glowing face
      put(p, ghost(W, H, (m) => { m.rect(cx - 2, 18, 5, 6, 1); }), SH[0]);
      put(p, ghost(W, H, (m) => { m.ellipse(cx, 14, 6, 7, 1); m.poly([[cx - 6, 10], [cx + 6, 10], [cx + 8, 22], [cx + 5, 24], [cx - 5, 24], [cx - 8, 22]], 1); }, { bias: 0.04 }), SH[0]);
      curve(p, [[cx - 6, 9], [cx, 7], [cx + 6, 9]], GLOW[1]); // the circlet
      blankFace(p, W, H, cx, 15, 3.8, 4.8);
      return ghostClose(p, [], 68, 41);
    };

    S.boss_shade_star = () => {
      const W = 64, H = 80, cx = 34;
      const p = G().pix(W, H);
      // long hair falling behind the shoulders
      put(p, ghost(W, H, (m) => m.poly([[cx - 7, 12], [cx + 7, 12], [cx + 9, 26], [cx + 7, 34], [cx - 7, 34], [cx - 9, 26]], 1), { bias: -0.08 }), SH[0]);
      // legs under a flared skirt, little boots
      for (const x of [cx - 4, cx + 4]) put(p, ghost(W, H, (m) => { cap(m, x, 58, x, 74, 2.6, 2.6); m.ellipse(x + (x < cx ? -1 : 1), 76, 3.6, 2.2, 1); }), SH[0]);
      put(p, ghost(W, H, (m) => m.poly([[cx - 6, 24], [cx + 6, 24], [cx + 7, 40], [cx + 15, 60], [cx + 8, 62], [cx, 61], [cx - 8, 62], [cx - 15, 60], [cx - 7, 40]], 1), { normal: sphereN(cx - 2, 42, 14, 24), blend: 0.4 }), SH[0]);
      for (const x0 of [cx - 8, cx - 3, cx + 3, cx + 8]) curve(p, [[cx + (x0 - cx) * 0.3, 42], [x0, 52], [x0 * 1.05 - cx * 0.05, 60]], SH[2]);
      curve(p, [[cx - 7, 38], [cx, 39.5], [cx + 7, 38]], SH[1]); // belt
      // the book at her hip (viewer's right)
      put(p, part(W, H, (g) => g.poly([[cx + 7, 40], [cx + 14, 38], [cx + 15, 48], [cx + 8, 50]], 1), SH, { depth: 1.5, light: shL, bias: -0.02 }), SH[0]);
      curve(p, [[cx + 8, 41], [cx + 13, 40], [cx + 14, 47]], SH[5]);
      // lowered arm (viewer's right)
      put(p, ghost(W, H, (m) => { cap(m, cx + 7, 25, cx + 10, 38, 2.8, 2.4); m.ellipse(cx + 10, 39, 2.4, 2.2, 1); }), SH[0]);
      // raised arm (viewer's left) holding the star staff up high
      put(p, ghost(W, H, (m) => { cap(m, cx - 7, 25, cx - 13, 18, 2.8, 2.4); cap(m, cx - 13, 18, cx - 16, 9, 2.4, 2.2); }), SH[0]);
      put(p, part(W, H, (g) => cap(g, cx - 13, 42, cx - 19, 2, 1, 0.9), SH, { depth: 1, light: shL, bias: 0.1 }), SH_OUT);
      const hand = mask(W, H); hand.ellipse(cx - 16, 10, 2.4, 2.2, 1);
      put(p, shade(hand, SH, { depth: 1, light: shL, bias: 0.15 }), SH[0]);
      // the five-pointed star at the staff's tip
      const st = G().pix(W, H), scx = cx - 19.5, scy = 5;
      const star = mask(W, H), pts = [];
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 2.3 : 5.4; pts.push([scx + Math.cos(a) * rr, scy + Math.sin(a) * rr]); }
      star.poly(pts, 1);
      star.each((x, y) => st.set(x, y, Math.hypot(x - scx, y - scy) < 2 ? GLOW[3] : GLOW[1]));
      put(p, st, SH_OUT);
      // head with the pointed hat, tip bent back; the blank glowing face
      put(p, ghost(W, H, (m) => { m.rect(cx - 2, 18, 5, 6, 1); }), SH[0]);
      put(p, ghost(W, H, (m) => m.ellipse(cx, 16, 5.5, 6, 1), { bias: 0.04 }), SH[0]);
      blankFace(p, W, H, cx, 17, 3.8, 4.4);
      put(p, ghost(W, H, (m) => { m.ellipse(cx, 11, 11, 2.4, 1); m.poly([[cx - 6, 11], [cx + 6, 11], [cx + 4, 4], [cx + 6, 0], [cx + 10, 1], [cx + 5, -1], [cx + 1, 0], [cx - 3, 4]], 1); }, { bias: 0.0 }), SH[0]);
      curve(p, [[cx - 5, 9], [cx, 10], [cx + 5, 9]], GLOW[1]); // hat band
      return ghostClose(p, [], 68, 51);
    };

    // ================================================================ Grand Scribe Lazaro
    // A man of about sixty, full figure: a long white robe worked in silver, a grey
    // beard, a calm and sorrowful face. Light flows in a white line from the silver
    // quill in his right hand; at his left the White Book hangs open in the air,
    // its pages streaming out in a ribbon. 80x96.
    S.boss_lazaro = () => {
      const W = 80, H = 96, cx = 38;
      const robe = ['#6a6e7c', '#8c909e', '#b0b4c0', '#c0c4cc', '#dcdee2', '#f4f4f0', '#ffffff'];
      const SILV = ['#6a7288', '#8890a8', '#c0c8d8', '#e8ecf4'];
      const skin = ['#8a5c4c', '#b07c66', '#d09c82', '#e8baa0', '#f6d4bc', '#fff0e2'];
      const grey = ['#4a4a52', '#6a6a74', '#8a8a94', '#a0a0a8', '#c0c0c8', '#e0e0e6'];
      const PAGE = ['#b0b4c4', '#d8dce8', '#f0f4fc', '#ffffff'];
      const LIGHT = ['#b8c8f0', '#e8f0ff', '#ffffff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);
      const emb = (q, pts) => { curve(q, pts, SILV[1]); curve(q, pts.map(([x, y]) => [x + 0.7, y + 0.7]), SILV[3]); };

      // --- the robe: long, flared to the ground
      const rm = mask(W, H);
      rm.poly([[cx - 8, 34], [cx + 8, 34], [cx + 13, 40], [cx + 15, 60], [cx + 19, 94], [cx - 19, 94], [cx - 15, 60], [cx - 13, 40]], 1);
      const rb = shade(rm, robe, { depth: 7, light: L, normal: cylN(cx - 3, 20), blend: 0.5, bias: 0.1, rim: 1 });
      for (const [x0, y0, x1, y1] of [[cx - 8, 56, cx - 13, 92], [cx + 7, 58, cx + 12, 92], [cx - 3, 64, cx - 4, 92], [cx + 3, 66, cx + 4, 92]]) { rb.line(x0, y0, x1, y1, robe[2]); rb.line(x0 + 1, y0, x1 + 1, y1, robe[5]); }
      // silver-embroidered front panel and hem
      emb(rb, [[cx - 4, 50], [cx - 5, 72], [cx - 6, 93]]); emb(rb, [[cx + 4, 50], [cx + 5, 72], [cx + 6, 93]]);
      for (let y = 56; y < 92; y += 7) stamp(rb, cx - 1, y, ['.s.', 'sSs', '.s.'], { s: SILV[1], S: SILV[3] });
      emb(rb, [[cx - 19, 91], [cx, 92], [cx + 19, 91]]);
      for (let x = cx - 17; x <= cx + 17; x += 4) { rb.set(x, 89, SILV[1]); rb.set(x + 1, 88, SILV[2]); }
      put(p, rb, 'dark');
      // sash at the waist
      put(p, part(W, H, (g) => g.poly([[cx - 12, 47], [cx + 12, 47], [cx + 12, 51], [cx - 12, 51]], 1), SILV, { depth: 1.2, light: L, flat: 0.3 }), 'dark');

      // --- the White Book floating at his left (viewer's right), pages streaming out of it
      const bx = 63, by = 52;
      const ribbon = [[bx + 2, by - 7], [bx + 16, by - 20], [bx + 4, by - 34], [bx - 10, by - 42]];
      for (let i = 0; i < 5; i++) {
        const t = 0.08 + i * 0.23, q = bez(ribbon, t), a2 = -0.5 + i * 0.7, sz = 3.6 - i * 0.35;
        const ca = Math.cos(a2), sa = Math.sin(a2);
        const P = (u, v) => [q[0] + u * ca - v * sa, q[1] + u * sa + v * ca];
        const pm = mask(W, H);
        pm.poly([P(-sz, -sz * 1.2), P(sz, -sz * 1.2), P(sz * 1.1, sz * 1.2), P(-sz * 0.9, sz * 1.2)], 1);
        const pg = shade(pm, PAGE, { depth: 1, light: L, global: 0.7, bias: 0.12 });
        for (const v of [-1, 1]) { const u0 = P(-sz + 1.5, v), u1 = P(sz - 1.5, v); pg.line(Math.round(u0[0]), Math.round(u0[1]), Math.round(u1[0]), Math.round(u1[1]), PAGE[1]); }
        put(p, pg, SILV[1]);
      }
      const bk = mask(W, H); bk.poly([[bx - 14, by - 1], [bx, by - 5], [bx + 14, by - 1], [bx + 13, by + 10], [bx, by + 7], [bx - 13, by + 10]], 1);
      put(p, shade(bk, ['#8890a8', '#b0b8cc', '#d8dcea', '#f0f2f8', '#ffffff'], { depth: 1.5, light: L, global: 0.5 }), 'dark');
      const pgm = mask(W, H); pgm.poly([[bx - 13, by - 2], [bx, by - 6], [bx + 13, by - 2], [bx + 12, by + 8], [bx, by + 5], [bx - 12, by + 8]], 1);
      const pages = shade(pgm, PAGE, { depth: 1, light: L, global: 0.4, bias: 0.2 });
      pages.line(bx, by - 5, bx, by + 5, PAGE[0]);
      for (const y of [-1, 1, 3, 5]) { pages.hline(bx - 11, bx - 3, by + y, PAGE[1]); pages.hline(bx + 2, bx + 10, by + y - 1, PAGE[1]); }
      put(p, pages, 'dark');

      // --- left arm (viewer's right): reaching toward the book, open palm
      const la = mask(W, H);
      cap(la, cx + 11, 38, cx + 17, 54, 5, 5.5); cap(la, cx + 17, 54, cx + 22, 60, 5.5, 5);
      const lsl = shade(la, robe, { depth: 3.5, light: L, bias: 0.08 });
      emb(lsl, [[cx + 17, 58], [cx + 21, 62], [cx + 25, 62]]);
      put(p, lsl, 'dark');
      const lh = mask(W, H); lh.ellipse(cx + 26, 62, 3.4, 2.4, 1);
      put(p, shade(lh, skin, { depth: 1.5, light: L, bias: 0.1 }), 'dark');

      // --- right arm (viewer's left): raised, the silver quill trailing a line of light
      const ra = mask(W, H);
      cap(ra, cx - 11, 38, cx - 18, 50, 5, 5.5); cap(ra, cx - 18, 50, cx - 17, 38, 5.5, 4.5);
      const rsl = shade(ra, robe, { depth: 3.5, light: L, bias: 0.08 });
      emb(rsl, [[cx - 21, 40], [cx - 17, 42], [cx - 13, 41]]);
      put(p, rsl, 'dark');
      const rh = mask(W, H); rh.ellipse(cx - 17, 35, 3, 2.8, 1);
      put(p, shade(rh, skin, { depth: 1.5, light: L, bias: 0.1 }), 'dark');
      // quill: a long pale feather with a silver shaft
      const qv = mask(W, H); qv.poly([[cx - 17, 33], [cx - 18, 26], [cx - 15, 17], [cx - 10, 7], [cx - 9, 13], [cx - 11, 22], [cx - 14, 31]], 1);
      const qf = shade(qv, ['#8890a8', '#b8c0d4', '#dce2ee', '#f4f6fc', '#ffffff'], { depth: 1.2, light: L, bias: 0.1 });
      for (let t = 0.1; t < 0.95; t += 0.12) { const x = cx - 16 + 6.5 * t, y = 32 - 24 * t; on(qf, x - 2, y + 1, '#b8c0d4'); on(qf, x + 2, y + 1, '#dce2ee'); }
      curve(qf, [[cx - 16, 33], [cx - 13, 22], [cx - 10, 9]], SILV[1]);
      put(p, qf, 'dark');
      p.line(cx - 18, 36, cx - 20, 40, SILV[2]); p.set(cx - 20, 41, SILV[3]);
      const trail = [[cx - 20, 42], [cx - 32, 50], [cx - 22, 64], [cx - 34, 78]];

      // --- neck, collar, head
      const nk = mask(W, H); nk.rect(cx - 3, 28, 7, 7, 1);
      put(p, shade(nk, skin, { depth: 1.5, light: L, bias: -0.05 }), 'dark');
      both(W, (X) => {
        const cl = mask(W, H); cl.poly([[X(cx), 40], [X(cx - 8), 34], [X(cx - 7), 29], [X(cx - 3), 33]], 1);
        const col = shade(cl, robe, { depth: 1.5, light: L, bias: 0.12 });
        emb(col, [[X(cx - 7), 30], [X(cx - 8), 34], [X(cx - 1), 39]]);
        put(p, col, 'dark');
      });
      // grey hair behind: a rim round the head, long at the back
      const hr = mask(W, H);
      hr.ellipse(cx, 20, 9, 9, 1);
      hr.poly([[cx - 9, 20], [cx + 9, 20], [cx + 8, 30], [cx - 8, 30]], 1);
      const hs = shade(hr, grey, { depth: 2.5, light: L, bias: 0.1 });
      for (const x of [cx - 8, cx - 6, cx + 6, cx + 8]) curve(hs, [[x, 18], [x + Math.sign(x - cx) * 0.5, 24], [x, 29]], grey[1]);
      put(p, hs, 'dark');
      const hm = mask(W, H);
      hm.ellipse(cx, 21, 7, 8.5, 1);
      const face = shade(hm, skin, { depth: 3, light: L, normal: sphereN(cx - 1.5, 20, 8, 10), blend: 0.3, bias: 0.3, global: 0.1 });
      for (const y of [15, 17]) { on(face, cx - 3, y, skin[2]); on(face, cx - 2, y, skin[2]); on(face, cx + 1, y, skin[2]); on(face, cx + 2, y, skin[2]); }
      put(p, face, 'dark');
      // thin hair swept back over the crown
      for (const x of [cx - 4, cx - 1, cx + 2, cx + 5]) { curve(p, [[x - 1, 13], [x, 12], [x + (x - cx) * 0.4, 11]], grey[3]); }
      both(W, (X) => put(p, part(W, H, (g) => g.ellipse(X(cx - 7), 22, 1.3, 2.2, 1), skin, { depth: 1, light: L, bias: 0.1 }), 'dark'));
      // calm, sorrowful eyes: brows raised in the middle, lids lowered
      both(W, (X, sd) => {
        p.line(X(cx - 5), 20, X(cx - 2), 19, grey[1]);
        const ex = Math.min(X(cx - 5), X(cx - 2));
        stamp(p, ex, 21, sd > 0 ? ['kkkk', '.wik', '....'] : ['kkkk', 'kiw.', '....'], { k: '#3a2a2a', w: '#f0ece8', i: '#40506a' });
        p.set(X(cx - 5), 23, skin[1]);
      });
      p.set(cx, 24, skin[1]); p.set(cx, 25, skin[2]);
      // the long grey beard and moustache
      const bd = mask(W, H);
      bd.poly([[cx - 6, 25], [cx - 3, 27], [cx + 3, 27], [cx + 6, 25], [cx + 6, 31], [cx + 4, 38], [cx + 1, 44], [cx - 1, 44], [cx - 4, 38], [cx - 6, 31]], 1);
      const bs = shade(bd, grey, { depth: 2.5, light: L, bias: 0.15 });
      for (const x of [cx - 4, cx - 2, cx, cx + 2, cx + 4]) curve(bs, [[x, 28], [x + (cx - x) * 0.1, 34], [x + (cx - x) * 0.5, 42]], grey[x === cx ? 4 : 2]);
      put(p, bs, 'dark');
      p.hline(cx - 2, cx + 1, 27, '#5a4040');
      return close(p, {
        free: true,
        post: (q) => {
          // the line of light written in the air from the nib; light rising off the open book
          for (let i = 0; i <= 60; i++) { const t = i / 60, e = bez(trail, t); q.set(Math.round(e[0]), Math.round(e[1]), i % 6 === 0 ? LIGHT[0] : LIGHT[2]); if (i % 2 === 0) q.set(Math.round(e[0]) + 1, Math.round(e[1]), LIGHT[1]); }
          for (const [x, y] of [[bx - 7, by - 9], [bx + 4, by - 10], [bx - 2, by - 13], [bx + 9, by - 7], [bx - 11, by - 6]]) q.set(x, y, LIGHT[2]);
        },
      });
    };

    // ================================================================ book golem
    // A stooped giant of thousands of books piled up and bound with chains: rows
    // of spines for a body, bookshelf boards for ribs, arms that are columns of
    // thick stacked tomes, and for a face one huge open book with two glowing
    // letters for eyes. Loose pages flap out of the gaps. 96x96.
    const MARK = ['#010000', '#020000', '#030000', '#040000', '#050000', '#060000', '#070000'];
    /** light level 0..6 for each pixel of m (shade() run on marker colours) */
    function lightMap(m, o) {
      const q = shade(m, MARK, o);
      const out = new Int8Array(m.w * m.h).fill(-1);
      q.each((x, y, c) => { out[y * m.w + x] = MARK.indexOf(c); });
      return out;
    }
    const SPINES = ['#804030', '#306040', '#304880', '#a08030', '#6a2a48', '#5a4a34'];
    const spineRamps = SPINES.map((c) => ramp(c, 7, { dark: 0.72, light: 0.55 }));
    /** a wall of upright book spines filling mask m: rows rowH tall, books 3-6 wide */
    function spineWall(m, seed, o) {
      o = o || {};
      const W = m.w, H = m.h, r = rng(seed), lm = lightMap(m, o.light || {});
      const out = G().pix(W, H), rowH = o.rowH || 7;
      for (let y0 = -((seed * 3) % rowH); y0 < H; y0 += rowH) {
        let x = -Math.floor(r() * 4);
        while (x < W) {
          const bw = 3 + Math.floor(r() * 4), rp = spineRamps[Math.floor(r() * spineRamps.length)], tall = rowH - (r() < 0.3 ? 1 + Math.floor(r() * 2) : 0);
          const band = r() < 0.6, title = r() < 0.5;
          for (let yy = y0 + rowH - tall; yy < y0 + rowH; yy++) for (let xx = x; xx < x + bw; xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const li = lm[yy * W + xx];
            if (li < 0) continue;
            let k = Math.round(li * 0.8) + (xx === x ? 1 : xx === x + bw - 1 ? -2 : 0);
            if (yy === y0 + rowH - 1) k -= 2; // the shelf shadow under each book
            let c = rp[Math.max(0, Math.min(6, k))];
            if (band && (yy === y0 + rowH - tall + 1 || yy === y0 + rowH - 2) && xx > x && xx < x + bw - 1) c = li > 2 ? '#e0b850' : '#a07828';
            if (title && yy === y0 + rowH - tall + 3 && xx > x && xx < x + bw - 1 && (xx - x) % 2) c = '#f0d890';
            out.set(xx, yy, c);
          }
          x += bw;
          if (r() < 0.12) x += 1; // a gap between books
        }
      }
      return out;
    }
    /** a column of books lying flat, stacked: covers in spine colours, cream page edges on one side */
    function tomeStack(m, seed, side, o) {
      const W = m.w, H = m.h, r = rng(seed), lm = lightMap(m, o || {});
      const out = G().pix(W, H);
      const bb = T.bbox(m); if (!bb) return out;
      let y = bb[1];
      while (y <= bb[3]) {
        const th = 3 + Math.floor(r() * 2), rp = spineRamps[Math.floor(r() * spineRamps.length)], off = Math.floor(r() * 3) - 1;
        for (let yy = y; yy < y + th; yy++) for (let xx = bb[0] - 1; xx <= bb[2] + 1; xx++) {
          const sx = xx - off;
          if (sx < 0 || sx >= W || yy >= H || m.get(sx, yy) == null) continue;
          const li = lm[yy * W + sx];
          const edge = side > 0 ? xx > bb[2] - 2 : xx < bb[0] + 2;
          let c;
          if (edge && yy > y && yy < y + th - 1) c = li > 2 ? '#f0e8d0' : '#b8ac94';
          else c = rp[Math.max(0, Math.min(6, li - (yy === y + th - 1 ? 2 : 0) + (yy === y ? 1 : 0)))];
          out.set(xx, yy, c);
        }
        y += th;
      }
      return out;
    }
    /** a chain of links along a bezier */
    function chainAlong(p, pts, n, cols) {
      const W = p.w, H = p.h;
      for (let i = 0; i <= n; i++) {
        const q = bez(pts, i / n), q2 = bez(pts, Math.min(1, i / n + 0.02));
        const ang = Math.atan2(q2[1] - q[1], q2[0] - q[0]);
        const lk = mask(W, H);
        const ex = i % 2 ? 1.1 : 2.3, ey = i % 2 ? 2 : 1.3;
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
          const u = x * Math.cos(ang) + y * Math.sin(ang), v = -x * Math.sin(ang) + y * Math.cos(ang);
          if ((u / ex) ** 2 + (v / ey) ** 2 <= 1.15) lk.set(Math.round(q[0] + x), Math.round(q[1] + y), 1);
        }
        const sh = shade(lk, cols, { depth: 1, light: [-0.45, -0.75, 0.55], spec: 0.85 });
        if (i % 2 === 0) sh.set(Math.round(q[0]), Math.round(q[1]), cols[0]);
        put(p, sh, 'dark');
      }
    }
    S.boss_bookgolem = () => {
      const W = 96, H = 96, cx = 48;
      const PAGE = ['#8a8070', '#b8ac94', '#d8ceb4', '#f0e8d0', '#fff8e8'];
      const WOOD = ['#2a1a10', '#422a18', '#5c3c22', '#7a5230', '#9a6c40', '#b88a58'];
      const CHAIN = ['#26262c', '#40404a', '#606068', '#808088', '#a8a8b0', '#d0d0d8'];
      const EYE = ['#c89840', '#fff0a0', '#ffffff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);

      // --- legs: short stacks of tomes
      both(W, (X, sd) => {
        const lm = mask(W, H); lm.rect(Math.min(X(28), X(42)), 72, 14, 23, 1);
        put(p, tomeStack(lm, sd > 0 ? 3 : 4, -sd, { light: L, depth: 4 }), 'dark');
      });
      // --- the hunched body: a great mound of spines
      const bm = mask(W, H);
      bm.ellipse(cx, 50, 30, 24, 1);
      bm.ellipse(cx, 36, 34, 12, 1); // high shoulders
      bm.poly([[cx - 24, 60], [cx + 24, 60], [cx + 20, 76], [cx - 20, 76]], 1);
      put(p, spineWall(bm, 7, { light: { depth: 10, light: L, normal: sphereN(cx - 4, 44, 34, 30), blend: 0.4 } }), 'dark');
      // bookshelf boards for ribs, curving across the chest
      for (const [y, w] of [[48, 22], [56, 21], [64, 19]]) {
        const rm = mask(W, H); tube(rm, [[cx - w, y + 3], [cx, y - 2], [cx + w, y + 3]], 1.6, 1.6, 1, 20);
        put(p, shade(rm, WOOD, { depth: 1.2, light: L, bias: 0.05 }), 'dark');
      }
      // a dark gap in the chest with a glow of loose pages inside
      const gm = mask(W, H); gm.ellipse(cx + 1, 56, 6, 3.5, 1);
      const gap = G().pix(W, H); gm.each((x, y) => gap.set(x, y, y < 55 ? '#140c08' : '#2a1c10'));
      put(p, gap, 'dark');
      for (const [x, y] of [[cx - 2, 57], [cx + 1, 56], [cx + 4, 57]]) p.set(x, y, PAGE[2]);

      // --- arms: columns of stacked tomes hanging to the ground, heavy book fists
      both(W, (X, sd) => {
        const am = mask(W, H);
        am.poly([[X(22), 30], [X(8), 36], [X(4), 60], [X(8), 82], [X(20), 82], [X(22), 60], [X(26), 42]], 1);
        put(p, tomeStack(am, sd > 0 ? 11 : 12, sd, { light: L, depth: 5, normal: cylN(X(14), 10), blend: 0.5 }), 'dark');
        const fm = mask(W, H); fm.rect(Math.min(X(2), X(22)), 80, 21, 15, 1);
        const fist = G().pix(W, H);
        // the fist: one enormous closed book, spine toward us, bands of gold
        const rp = spineRamps[sd > 0 ? 0 : 2], lmp = lightMap(fm, { depth: 4, light: L });
        fm.each((x, y) => {
          let k = lmp[y * W + x];
          if (y === 83 || y === 91) k = 6;
          const edge = x === Math.min(X(2), X(22)) || x === Math.max(X(2), X(22));
          fist.set(x, y, edge ? '#f0e8d0' : rp[Math.max(0, Math.min(6, k))]);
        });
        put(p, fist, 'dark');
        for (let x = Math.min(X(4), X(20)); x <= Math.max(X(4), X(20)); x += 2) p.set(x, 87, '#e0b850');
      });
      // --- chains binding it all: across the chest and round both arms
      chainAlong(p, [[cx - 30, 34], [cx - 6, 50], [cx + 14, 70], [cx + 26, 78]], 22, CHAIN);
      chainAlong(p, [[cx + 30, 36], [cx + 12, 44], [cx - 10, 42], [cx - 28, 48]], 18, CHAIN);
      both(W, (X) => chainAlong(p, [[X(5), 64], [X(12), 68], [X(20), 66]], 6, CHAIN));

      // --- the head: one huge open book set low between the shoulders
      const hx = cx, hy = 30;
      const cov = mask(W, H); cov.poly([[hx - 17, hy - 7], [hx, hy - 10], [hx + 17, hy - 7], [hx + 16, hy + 10], [hx, hy + 8], [hx - 16, hy + 10]], 1);
      put(p, shade(cov, spineRamps[0], { depth: 2, light: L, global: 0.4 }), 'dark');
      const pg = mask(W, H); pg.poly([[hx - 15, hy - 7], [hx, hy - 9], [hx + 15, hy - 7], [hx + 14, hy + 8], [hx, hy + 6], [hx - 14, hy + 8]], 1);
      const pages = shade(pg, PAGE, { depth: 1.5, light: L, global: 0.5, bias: 0.1 });
      pages.line(hx, hy - 8, hx, hy + 6, PAGE[0]); pages.line(hx + 1, hy - 8, hx + 1, hy + 6, PAGE[1]);
      for (const y of [hy - 5, hy - 2, hy + 1, hy + 4]) { script(pages, pg, hx - 13, hx - 2, y, PAGE[1], y, { max: 3 }); script(pages, pg, hx + 3, hx + 14, y - 1, PAGE[1], y + 50, { max: 3 }); }
      put(p, pages, 'dark');
      // two glowing letters for eyes
      for (const [ex, glyph] of [[hx - 8, ['.GG.', 'G..G', 'GGGG', 'G..G']], [hx + 5, ['GGG.', 'G..G', 'GGG.', 'G..G']]]) {
        // a warm glow on the page round each letter, then the letter itself burning bright
        for (let y = -2; y <= 5; y++) for (let x = -2; x <= 5; x++) { const d = Math.hypot(x - 1.5, y - 1.5); if (d < 3.6 && p.get(ex + x, hy - 3 + y) != null) p.set(ex + x, hy - 3 + y, d < 2.6 ? '#f8d070' : '#e8c890'); }
        stamp(p, ex, hy - 3, glyph.map((r2) => r2.replace(/\./g, 'o')), { G: EYE[1], o: '#d88a20' });
        stamp(p, ex, hy - 3, glyph, { G: EYE[1] });
        p.set(ex + 1, hy - 3, EYE[2]);
      }
      // a ragged bookmark ribbon hanging like a tongue
      for (let y = hy + 7; y < hy + 14; y++) { p.set(hx, y, '#a02030'); p.set(hx + 1, y, y % 2 ? '#c03040' : '#801828'); }

      return close(p, {
        free: true,
        post: (q) => {
          // loose pages flapping out of the gaps (drawn over the silhouette edge and beyond)
          void q;
        },
        after: (q) => {
          const pages2 = [[14, 22, 0.5], [82, 20, -0.4], [88, 52, 0.3], [6, 50, -0.6], [72, 12, 0.9], [24, 12, -0.9]];
          pages2.forEach(([x, y, a2], k) => scrap(q, W, H, x, y, 7, 5, a2, PAGE, PAGE[1], 300 + k));
          q.outline(OUT);
        },
      });
    };

    // ================================================================ the Hollow King (final boss, form 1)
    // A towering hooded shadow made of white paper scraps whirling round: a crown
    // on the hood, a hollow darkness inside it, Lazaro bound in the chest with his
    // eyes closed, huge hands of folded paper at either side, and the letters of
    // its outline peeling off and melting away white. 128x112.
    const PAPER = ['#5a6070', '#7880900', '#9098a8', '#b4bac6', '#d4d8e0', '#ecedee', '#f8f8f4'].map((c) => c.slice(0, 7));
    /** swirling paper strips: bands of paper spiralling round (sx, sy), lit by a light map */
    function swirl(m, sx, sy, seed, o) {
      o = o || {};
      const W = m.w, H = m.h, lm = lightMap(m, o.light || {}), out = G().pix(W, H), r = rng(seed);
      const twist = o.twist || 0.09, bands = o.bands || 7;
      const jitter = Array.from({ length: 64 }, () => r());
      m.each((x, y) => {
        const dx = x - sx, dy = (y - sy) * 1.2, rad = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const u = (ang / (Math.PI * 2)) * bands + rad * twist;
        const bi = Math.floor(u), f = u - bi;
        const j = jitter[((bi % 64) + 64) % 64];
        let k = lm[y * W + x] + Math.round((j - 0.5) * 2);
        if (f < 0.1) k -= 2; // the shadowed edge of each strip
        else if (f < 0.2) k += 1; // its lit rim
        out.set(x, y, PAPER[Math.max(0, Math.min(6, k))]);
      });
      return out;
    }
    /** a big hand of folded paper: palm + four angular fingers + thumb; side -1 = left of the image */
    function paperHand(p, W, H, hx, hy, side, seed) {
      const m = mask(W, H);
      m.poly([[hx - 8, hy - 4], [hx + 8, hy - 5], [hx + 9, hy + 8], [hx, hy + 12], [hx - 8, hy + 8]], 1);
      const fingers = [[-6, -3, -10, -20], [-2, -5, -4, -25], [2, -5, 3, -24], [6, -4, 10, -18]];
      for (const [bx, by, tx, ty] of fingers) {
        const x0 = hx + bx, y0 = hy + by, x1 = hx + tx * 0.55 + bx * 0.45, y1 = hy + ty * 0.55 + by * 0.45, x2 = hx + tx, y2 = hy + ty;
        cap(m, x0, y0, x1, y1, 2.4, 2.1); cap(m, x1, y1, x2, y2, 2.1, 1.4);
      }
      // thumb toward the body
      cap(m, hx - side * 7, hy + 4, hx - side * 15, hy - 3, 2.6, 1.8);
      const q = swirl(m, hx, hy + 4, seed, { light: { depth: 3, light: [-0.45, -0.75, 0.55] }, bands: 5, twist: 0.3 });
      // crease lines across the finger joints
      for (const [bx, by, tx, ty] of fingers) { const x1 = hx + tx * 0.55 + bx * 0.45, y1 = hy + ty * 0.55 + by * 0.45; for (let d = -2; d <= 2; d++) on(q, x1 + d, y1, PAPER[2]); }
      put(p, q, 'dark');
    }
    S.boss_nemrea1 = () => {
      const W = 128, H = 112, cx = 64, oy = 7;
      const CROWN = ['#4a4c5a', '#6c6e7e', '#9496a6', '#b8bac8', '#d0d0d8', '#ececf2', '#ffffff'];
      const HOLLOW = ['#0e0f16', '#16182a', '#20243a', '#2c3048'];
      const LAZ = ['#6a6e7c', '#8c909e', '#aeb2be', '#c8ccd4', '#e0e2e8'];
      const BAND = ['#8a8e9c', '#b8bcc8', '#ececf0', '#ffffff'];
      const LET = '#606878';
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);

      // --- the cloak of whirling paper: hood, shoulders, a vortex below
      const bm = mask(W, H);
      bm.poly([[cx, 12 + oy], [cx + 10, 18 + oy], [cx + 16, 34 + oy], [cx + 30, 42 + oy], [cx + 38, 56 + oy], [cx + 36, 76 + oy], [cx + 24, 92], [cx + 10, 104], [cx - 2, 110], [cx - 10, 106], [cx - 22, 94], [cx - 34, 78 + oy], [cx - 38, 56 + oy], [cx - 30, 42 + oy], [cx - 16, 34 + oy], [cx - 10, 18 + oy]], 1);
      for (const [pts, r0] of [[[[cx - 30, 84], [cx - 44, 92], [cx - 50, 86]], 4], [[[cx + 30, 84], [cx + 44, 94], [cx + 52, 90]], 4], [[[cx - 20, 96], [cx - 30, 104], [cx - 38, 102]], 3], [[[cx + 4, 106], [cx + 12, 110], [cx + 20, 106]], 2.6]]) tube(bm, pts, r0, 1, 1, 14);
      const cloak = swirl(bm, cx, 74 + oy, 17, { light: { depth: 10, light: L, normal: sphereN(cx - 6, 60 + oy, 40, 50), blend: 0.4 }, bands: 13, twist: 0.12 });
      put(p, cloak, 'dark');
      // scraps of paper caught in the whirl, following the spiral
      const rr = rng(501);
      for (let k = 0; k < 46; k++) {
        const rad = 8 + rr() * 36, ang = rr() * Math.PI * 2;
        const x = cx + Math.cos(ang) * rad, y = 74 + oy + Math.sin(ang) * rad * 0.85;
        if (bm.get(Math.round(x), Math.round(y)) == null || Math.hypot(x - cx, y - (70 + oy)) < 12) continue;
        scrap(p, W, H, x, y, 5 + rr() * 4, 3 + rr() * 2, ang + Math.PI / 2 + (rr() - 0.5) * 0.6, PAPER.slice(1), PAPER[2], 520 + k, PAPER[1]);
      }

      // --- the hood's opening: a hollow darkness, two faint pale glints
      const om = mask(W, H);
      om.ellipse(cx, 32 + oy, 10, 11, 1);
      om.poly([[cx - 9, 34 + oy], [cx + 9, 34 + oy], [cx + 6, 45 + oy], [cx - 6, 45 + oy]], 1);
      const hol = G().pix(W, H);
      om.each((x, y) => { const d = Math.hypot(x - cx, (y - 34 - oy) * 0.9); hol.set(x, y, HOLLOW[Math.max(0, Math.min(3, Math.floor(d / 3.4)))]); });
      put(p, hol, 'dark');
      for (let a2 = Math.PI * 1.02; a2 < Math.PI * 1.98; a2 += 0.03) { on(p, cx + Math.cos(a2) * 11, 32 + oy + Math.sin(a2) * 12, PAPER[6]); on(p, cx + Math.cos(a2) * 12, 32 + oy + Math.sin(a2) * 13, PAPER[4]); }
      for (const ex of [cx - 4, cx + 4]) { p.set(ex, 34 + oy, '#e8ecf4'); p.set(ex, 35 + oy, '#9098b0'); p.set(ex + (ex < cx ? -1 : 1), 34 + oy, '#5a6078'); }

      // --- the crown on the hood
      const cr = mask(W, H);
      cr.poly([[cx - 11, 21 + oy], [cx + 11, 21 + oy], [cx + 10, 16 + oy], [cx - 10, 16 + oy]], 1);
      for (const [x, t] of [[cx - 9, 8], [cx - 4.5, 10], [cx, 4], [cx + 4.5, 10], [cx + 9, 8]]) cr.poly([[x - 2.2, 17 + oy], [x + 2.2, 17 + oy], [x, t + oy]], 1);
      put(p, shade(cr, CROWN, { depth: 1.5, flat: 0.3, light: L, global: 0.5, spec: 0.92 }), 'dark');
      stamp(p, cx - 1, 17 + oy, ['.w.', 'wkw', '.w.'], { w: CROWN[5], k: HOLLOW[1] });

      // --- Lazaro bound in the chest: eyes closed, wrapped in white bands
      const lx = cx, ly = 60 + oy;
      const lzb = mask(W, H);
      lzb.poly([[lx - 8, ly + 2], [lx + 8, ly + 2], [lx + 10, ly + 24], [lx - 10, ly + 24]], 1);
      const lzs = shade(lzb, LAZ, { depth: 3, light: L, bias: 0.05 });
      for (const x of [lx - 4, lx + 4]) lzs.line(x, ly + 8, x + (x < lx ? -1 : 1), ly + 23, LAZ[1]);
      put(p, lzs, 'dark');
      const lzh = mask(W, H); lzh.ellipse(lx, ly - 3, 5, 5.5, 1);
      put(p, shade(lzh, LAZ, { depth: 2, light: L, bias: 0.15 }), 'dark');
      p.line(lx - 3, ly - 3, lx - 1, ly - 2, LAZ[0]); p.line(lx + 1, ly - 2, lx + 3, ly - 3, LAZ[0]);
      const bdm = mask(W, H); bdm.poly([[lx - 3.5, ly + 0], [lx + 3.5, ly + 0], [lx + 2.5, ly + 8], [lx, ly + 11], [lx - 2.5, ly + 8]], 1);
      put(p, shade(bdm, LAZ, { depth: 1.5, light: L, bias: 0.05 }), 'dark');
      for (const [x0, y0, x1, y1] of [[lx - 12, ly + 6, lx + 12, ly + 13], [lx + 12, ly + 14, lx - 12, ly + 20], [lx - 11, ly + 22, lx + 11, ly + 23]]) {
        const b2 = mask(W, H); cap(b2, x0, y0, x1, y1, 1.1, 1.1);
        put(p, shade(b2, BAND, { depth: 1, light: L, bias: 0.12, flat: 0.4 }), 'dark');
      }

      // --- the great paper hands at either side
      paperHand(p, W, H, 20, 68 + oy, -1, 21);
      paperHand(p, W, H, 108, 68 + oy, 1, 22);

      // --- where letters will peel off the outline
      const r = rng(88), edge = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.get(x, y) != null && (p.get(x - 1, y) == null || p.get(x + 1, y) == null || p.get(x, y - 1) == null)) edge.push([x, y]);
      const glyphs = [['kk', 'k.', 'kk'], ['k.k', '.k.'], ['kkk', '.k.'], ['k', 'k', 'k'], ['kk', '.k'], ['.k', 'kk', 'k.']];
      return close(p, {
        free: true,
        post: (q) => {
          for (let k = 0; k < 30; k++) {
            const [x, y] = edge[Math.floor(r() * edge.length)];
            const g = glyphs[Math.floor(r() * glyphs.length)];
            const ox = x < cx ? -3 - Math.floor(r() * 6) : 3 + Math.floor(r() * 6), oyy = -2 - Math.floor(r() * 6);
            stamp(q, x + ox, y + oyy, g, { k: r() < 0.55 ? LET : PAPER[3] });
          }
          const r2 = rng(89);
          for (let k = 0; k < 40; k++) { const x = Math.floor(r2() * W), y = 18 + Math.floor(r2() * 90); if (p.get(x, y) == null) q.set(x, y, r2() < 0.5 ? '#ffffff' : PAPER[5]); }
        },
      });
    };

    // ================================================================ Nemrea (final boss, true form)
    // The true form once given a name: a colossal figure of white marble with a
    // sleepy, quiet face; eight wings of pages on its back, each a different hue
    // (forest, sand, ice, mist, tide, iron, ash, star); glowing letters spreading
    // over half its body; a crown of broken quill pens; stars and swirls of ink
    // round it. 128x112.
    /** a long wing blade of layered pages from root to tip, tinted */
    function pageWing(p, W, H, root, tip, wd, tint, seed) {
      const rp = ramp(tint, 6, { dark: 0.5, light: 0.7, shift: 20 });
      const dx = tip[0] - root[0], dy = tip[1] - root[1], l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      const m = mask(W, H);
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10, w = wd * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.08)) * (1 - t * 0.35); pts.push([root[0] + dx * t + nx * w, root[1] + dy * t + ny * w]); }
      for (let i = 10; i >= 0; i--) { const t = i / 10, w = wd * 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.08)); pts.push([root[0] + dx * t - nx * w, root[1] + dy * t - ny * w]); }
      m.poly(pts, 1);
      const q = shade(m, rp, { depth: 2, light: [-0.45, -0.75, 0.55], global: 0.5, bias: 0.1 });
      // the stacked page edges: strips across the blade, a spine line along it
      const r = rng(seed);
      for (let t = 0.12; t < 0.95; t += 0.09 + r() * 0.03) {
        const x0 = root[0] + dx * t, y0 = root[1] + dy * t;
        for (let k = -wd; k <= wd; k += 0.5) on(q, x0 + nx * k + dx / l * k * 0.35, y0 + ny * k + dy / l * k * 0.35, rp[1]);
      }
      for (let t = 0.05; t < 0.95; t += 0.02) on(q, root[0] + dx * t + nx * wd * 0.1, root[1] + dy * t + ny * wd * 0.1, rp[5]);
      put(p, q, 'dark');
    }
    S.boss_nemrea2 = () => {
      const W = 128, H = 112, cx = 64;
      const MARBLE = ['#7c7a7e', '#a09c9c', '#c2beb8', '#dcd8d0', '#f0eee8', '#faf8f4', '#ffffff'];
      const TXT = ['#c09a40', '#e8c860', '#fff0a0', '#fffae0'];
      const INKC = ['#0e0e1c', '#1a1a30', '#2a2a4c', '#3c3c68'];
      const QUILL = ['#6a6a7a', '#a0a0b0', '#d8d8e4', '#ffffff'];
      const WINGS = ['#b0d0a0', '#e0c890', '#c0e8ff', '#c0c8d0', '#90d0e0', '#a0a0a8', '#b0a0a0', '#c0c0ff'];
      const L = [-0.45, -0.75, 0.55];
      const p = G().pix(W, H);

      // --- swirls of ink curling round its feet, studded with stars
      const ink = G().pix(W, H);
      const curl = (x0, y0, r0, turns, dir, th) => {
        const m = mask(W, H);
        let px = null;
        for (let i = 0; i <= 60; i++) {
          const t = i / 60, a2 = dir * t * turns * Math.PI * 2, rr = r0 * (1 - t * 0.8);
          const x = x0 + Math.cos(a2) * rr, y = y0 + Math.sin(a2) * rr * 0.6;
          if (px) cap(m, px[0], px[1], x, y, th * (1 - t * 0.6), th * (1 - t * 0.6));
          px = [x, y];
        }
        put(ink, shade(m, INKC, { depth: 2, light: L, bias: 0.08 }), 'dark');
      };
      curl(cx - 34, 98, 16, 1.1, 1, 3);
      curl(cx + 34, 98, 16, 1.1, -1, 3);
      curl(cx - 20, 106, 9, 0.9, -1, 2.2);
      curl(cx + 22, 105, 9, 0.9, 1, 2.2);
      for (const [x, y, rr] of [[cx - 52, 88, 2], [cx + 50, 86, 2.4], [cx - 44, 108, 1.6], [cx + 46, 108, 1.6]]) { const m = mask(W, H); m.circle(x, y, rr, 1); put(ink, shade(m, INKC, { depth: 1, light: L }), 'dark'); }
      put(p, ink, 'dark');

      // --- a thin ring of light behind the head
      const halo = G().pix(W, H);
      for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.012) {
        const x = Math.round(cx + Math.cos(a2) * 17), y = Math.round(33 + Math.sin(a2) * 17);
        halo.set(x, y, TXT[2]); halo.set(Math.round(cx + Math.cos(a2) * 16), Math.round(33 + Math.sin(a2) * 16), TXT[1]);
      }
      put(p, halo, 'dark');
      // --- eight page wings, four a side, fanned from the shoulders
      const wingDefs = [[[-4, 22], 9], [[-8, 44], 9], [[-6, 72], 8], [[6, 96], 7]];
      both(W, (X, sd) => {
        wingDefs.forEach(([tip, wd], i) => {
          const tint = WINGS[sd > 0 ? i : 7 - i];
          pageWing(p, W, H, [X(52), 50 + i * 3], [X(tip[0] + 2), tip[1]], wd, tint, 700 + i + (sd > 0 ? 0 : 10));
        });
      });

      // --- the robe falling away below into the ink
      const rm = mask(W, H);
      rm.poly([[cx - 18, 60], [cx + 18, 60], [cx + 24, 84], [cx + 28, 106], [cx, 110], [cx - 28, 106], [cx - 24, 84]], 1);
      const rb = shade(rm, MARBLE, { depth: 7, light: L, normal: cylN(cx - 4, 26), blend: 0.5, bias: 0.05 });
      for (const [x0, x1] of [[cx - 10, cx - 16], [cx - 3, cx - 5], [cx + 5, cx + 8], [cx + 12, cx + 18]]) { rb.line(x0, 70, x1, 106, MARBLE[2]); rb.line(x0 + 1, 70, x1 + 1, 106, MARBLE[5]); }
      put(p, rb, 'dark');
      // --- torso and shoulders
      const tm = mask(W, H);
      tm.poly([[cx - 8, 44], [cx + 8, 44], [cx + 18, 49], [cx + 20, 60], [cx + 16, 72], [cx - 16, 72], [cx - 20, 60], [cx - 18, 49]], 1);
      put(p, shade(tm, MARBLE, { depth: 6, light: L, normal: sphereN(cx - 3, 56, 22, 20), blend: 0.4, bias: 0.08 }), 'dark');
      // --- arms: hands folded before the chest, cradling a small star
      both(W, (X) => {
        const am = mask(W, H); cap(am, X(cx - 17), 50, X(cx - 20), 64, 4.5, 4); cap(am, X(cx - 20), 64, X(cx - 6), 66, 4, 3.6);
        put(p, shade(am, MARBLE, { depth: 3, light: L, bias: 0.06 }), 'dark');
      });
      // wide sleeves falling from the folded arms
      both(W, (X) => {
        const sm = mask(W, H);
        sm.poly([[X(cx - 12), 60], [X(cx - 24), 60], [X(cx - 34), 78], [X(cx - 30), 84], [X(cx - 24), 80], [X(cx - 18), 86], [X(cx - 10), 70]], 1);
        const sl = shade(sm, MARBLE, { depth: 4, light: L, bias: 0.02 });
        for (const k of [0, 1]) curve(sl, [[X(cx - 16 - k * 4), 64], [X(cx - 22 - k * 5), 72], [X(cx - 24 - k * 5), 82]], MARBLE[2]);
        put(p, sl, 'dark');
      });
      const hm2 = mask(W, H); hm2.ellipse(cx, 65, 7, 3.4, 1);
      put(p, shade(hm2, MARBLE, { depth: 2, light: L, bias: 0.12 }), 'dark');
      T.star4(p, cx, 61, 3, ['#8890d8', '#c0c8ff', '#e8ecff', '#ffffff']);

      // --- neck and head: a calm marble face, eyes almost closed
      const nk = mask(W, H); nk.rect(cx - 4, 38, 9, 8, 1);
      put(p, shade(nk, MARBLE, { depth: 2, light: L, bias: -0.05 }), 'dark');
      const hdm = mask(W, H);
      hdm.ellipse(cx, 34, 9.5, 11, 1);
      hdm.poly([[cx - 8, 37], [cx + 8, 37], [cx + 4, 44], [cx - 4, 44]], 1);
      put(p, shade(hdm, MARBLE, { depth: 4, light: L, normal: sphereN(cx - 2, 33, 10, 12), blend: 0.35, bias: 0.18 }), 'dark');
      // long hair of carved marble falling behind the shoulders
      both(W, (X) => put(p, part(W, H, (g) => tube(g, [[X(cx - 9), 27], [X(cx - 15), 36], [X(cx - 17), 52]], 3.2, 2, 1, 12), MARBLE, { depth: 2, light: L, bias: -0.02 }), 'dark'));
      // sleepy eyes: heavy lids, a faint line of the iris; brows soft; small closed mouth
      both(W, (X, sd) => {
        p.line(X(cx - 7), 31, X(cx - 3), 31, MARBLE[2]);
        const ex = Math.min(X(cx - 6), X(cx - 2));
        stamp(p, ex, 34, sd > 0 ? ['kkkkk', '.ggg.'] : ['kkkkk', '.ggg.'], { k: '#6a6668', g: '#b8b4b0' });
        p.set(X(cx - 5), 36, MARBLE[3]);
      });
      p.set(cx, 37, MARBLE[2]); p.set(cx, 38, MARBLE[3]);
      p.hline(cx - 2, cx + 1, 41, '#9a908c');
      // --- the crown of broken quill pens
      const quills = [[cx - 9, 25, cx - 15, 13, 0], [cx - 5, 23, cx - 7, 9, 1], [cx, 22, cx, 11, 0], [cx + 5, 23, cx + 8, 8, 1], [cx + 9, 25, cx + 16, 14, 0]];
      for (const [bx, by, tx, ty, broken] of quills) {
        const qm = mask(W, H);
        const mx = bx + (tx - bx) * (broken ? 0.6 : 1), my = by + (ty - by) * (broken ? 0.6 : 1);
        cap(qm, bx, by, mx, my, 1.8, broken ? 1.4 : 0.6);
        put(p, shade(qm, QUILL, { depth: 1, light: L, bias: 0.1 }), 'dark');
        if (broken) { p.set(Math.round(mx), Math.round(my) - 1, QUILL[3]); p.set(Math.round(mx) + 1, Math.round(my), QUILL[1]); }
      }
      put(p, part(W, H, (g) => g.ellipse(cx, 25, 10, 2.2, 1), MARBLE, { depth: 1, light: L, bias: 0.1 }), 'dark');

      // --- glowing letters spreading over half the body (viewer's right)
      const r = rng(909);
      const glyph = [['GG', 'G.', 'GG'], ['G.G', '.G.'], ['GGG', '.G.'], ['G', 'G'], ['GG', '.G'], ['.G', 'GG']];
      for (let k = 0; k < 70; k++) {
        const x = Math.round(cx + 1 + r() * 22), y = Math.round(30 + r() * 72);
        const reach = 22 - Math.abs(y - 60) * 0.12;
        if (x - cx > reach) continue;
        const g = glyph[Math.floor(r() * glyph.length)];
        let ok = true;
        for (let yy = 0; yy < g.length; yy++) for (let xx = 0; xx < g[yy].length; xx++) { const c = p.get(x + xx, y + yy); if (!c || !MARBLE.includes(c)) ok = false; }
        if (!ok) continue;
        stamp(p, x, y, g, { G: k % 5 === 0 ? TXT[3] : TXT[2] });
        p.set(x + g[0].length, y + g.length - 1, TXT[0]);
      }
      return close(p, {
        free: true,
        post: (q) => {
          const r2 = rng(910);
          for (let k = 0; k < 16; k++) { const x = 4 + Math.floor(r2() * 120), y = 20 + Math.floor(r2() * 88); if (p.get(x, y) == null) { if (k % 4 === 0) T.star4(q, x, y, 1, ['#c0c8ff', '#ffffff']); else q.set(x, y, '#c0c8ff'); } }
        },
      });
    };

    // ================================================================ Ouroboros, the ring dragon
    // A vast dragon biting its own tail in a perfect ring. Its scales pass from
    // gold to black once round the ring (day into night); inside the ring a galaxy
    // of pages and stars turns; rows of small wings line its back; its eye is a
    // golden ring like a clock face. 128x112.
    S.boss_ouroboros = () => {
      const W = 128, H = 112;
      const cx = 62, cy = 60, A = 45, B = 41, R0 = 8.5;
      const DAY = ['#5a3008', '#8a5410', '#b8801c', '#d8a028', '#f0c040', '#f8dc78', '#fff4c0'];
      const DUSK = ['#300818', '#58142c', '#882840', '#b04858', '#d07068', '#e8a088', '#f8d0b0'];
      const NIGHT = ['#08060c', '#181020', '#241a34', '#322648', '#443660', '#5c4c7c', '#7c6ca0'];
      const SPACE = ['#07061a', '#0e0a28', '#18123c', '#241a54', '#3a2a78', '#6040a0', '#8a68d0'];
      const STAR = ['#6a70b8', '#a0a8e8', '#c0c8ff', '#ffffff'];
      const PAGEC = ['#b8ac94', '#d8ceb4', '#f0e8d0', '#fff8e8'];
      const EYE = ['#6a4a10', '#c89830', '#ffe070', '#fff8c0'];
      const L = [-0.5, -0.7, 0.5];
      const ll = Math.hypot(L[0], L[1], L[2]);
      const p = G().pix(W, H);
      const HEAD = 0; // the head sits at the right of the ring (angle 0)
      /** scale colour at ring angle phi (0 = head) and light level k 0..6 */
      const scaleCol = (phi, k) => {
        let t = ((phi - HEAD) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
        t = Math.round(t * 12) / 12; // a few bands of colour round the ring, not a smooth blend
        k = Math.max(0, Math.min(6, k));
        if (t < 0.5) return mix(DAY[k], DUSK[k], t / 0.5);
        return mix(DUSK[k], NIGHT[k], Math.min(1, (t - 0.5) / 0.42));
      };

      // --- the galaxy inside the ring: deep space, spiral arms of haze, stars and pages
      const gm = mask(W, H); gm.ellipse(cx, cy, A - 6, B - 6, 1);
      const gal = G().pix(W, H);
      const r = rng(333);
      gm.each((x, y) => {
        const dx = (x - cx) / (A - 6), dy = (y - cy) / (B - 6), rad = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const arm = Math.cos(2 * (ang - rad * 4.2)) * (1 - rad) + (hash(x >> 1, y >> 1, 5) - 0.5) * 0.3;
        let k = Math.floor((1 - rad) * 2.2 + Math.max(0, arm) * 3.2 + ((x + y) % 2 ? 0.3 : 0));
        if (rad < 0.16) k = 6;
        gal.set(x, y, SPACE[Math.max(0, Math.min(6, k))]);
      });
      put(p, gal);
      for (let k = 0; k < 70; k++) {
        const t = r(), armN = r() < 0.5 ? 0 : Math.PI, rad = 0.12 + t * 0.8, ang = armN + rad * 4.2 + (r() - 0.5) * 0.5;
        const x = Math.round(cx + Math.cos(ang) * rad * (A - 7)), y = Math.round(cy + Math.sin(ang) * rad * (B - 7));
        if (gm.get(x, y) == null) continue;
        p.set(x, y, STAR[Math.floor(r() * 3) + (rad < 0.3 ? 1 : 0)]);
      }
      for (const [x, y] of [[cx, cy], [cx - 14, cy + 6], [cx + 16, cy - 8], [cx + 6, cy + 20], [cx - 10, cy - 18]]) T.star4(p, x, y, 2, STAR);
      // pages swirling along the arms
      for (let k = 0; k < 9; k++) {
        const rad = 0.3 + (k / 9) * 0.55, ang = (k % 2 ? Math.PI : 0) + rad * 4.2 + 0.3;
        const x = cx + Math.cos(ang) * rad * (A - 8), y = cy + Math.sin(ang) * rad * (B - 8);
        scrap(p, W, H, x, y, 4 + (k % 3), 3, ang + 1.2, PAGEC, PAGEC[0], 340 + k, SPACE[1]);
      }

      // --- small wings in a row along its back (the outer rim): bat-like, two fingers each
      for (let k = 0; k < 8; k++) {
        const phi = 0.6 + k * 0.7, ux = Math.cos(phi), uy = Math.sin(phi), px = -uy, py = ux;
        const P = (out, side) => [cx + ux * (A + R0 - 2 + out) + px * side, cy + uy * (B + R0 - 2 + out) + py * side];
        const wm = mask(W, H);
        wm.poly([P(0, 4.5), P(11, 6), P(14, 2.5), P(9, 1), P(12, -3), P(7, -3.5), P(0, -3.5)], 1);
        const wing = G().pix(W, H);
        wm.each((x, y) => { const d = Math.hypot(x - P(0, 0)[0], y - P(0, 0)[1]) / 12; wing.set(x, y, scaleCol(phi, Math.floor(4.2 - d * 2.4 + ((x + y) % 2 ? 0.3 : 0)))); });
        for (const [a2, b2] of [[P(0, 3), P(14, 2.5)], [P(1, 1), P(12, -3)]]) wing.line(Math.round(a2[0]), Math.round(a2[1]), Math.round(b2[0]), Math.round(b2[1]), scaleCol(phi, 1));
        put(p, wing, 'dark');
      }

      // --- the ring body: a torus lit from the upper left, scaled, gold to black
      const PHI0 = 0.22, PHI1 = Math.PI * 2 - 0.3; // from behind the head round to the tail tip
      const body = G().pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const phi = Math.atan2((y - cy) / B, (x - cx) / A);
        const ph = (phi + Math.PI * 2) % (Math.PI * 2);
        if (ph < PHI0 || ph > PHI1) continue;
        const t = (ph - PHI0) / (PHI1 - PHI0);
        const rr = R0 * (t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2 * 0.7);
        const Cx = cx + A * Math.cos(phi), Cy = cy + B * Math.sin(phi);
        const vx = x - Cx, vy = y - Cy, d = Math.hypot(vx, vy);
        if (d > rr) continue;
        const nx = vx / rr, ny = vy / rr, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        let lit = (nx * L[0] + ny * L[1] + nz * L[2]) / ll;
        lit = 0.1 + 0.9 * Math.max(0, lit);
        // scales: rows along the ring, offset every other row
        const along = ph * (A + B) / 2, across = d * Math.sign(vx * Math.cos(phi) / A + vy * Math.sin(phi) / B);
        const row = Math.floor((across + 20) / 3), u = ((along + (row % 2) * 2) % 4 + 4) % 4, v = ((across + 20) % 3 + 3) % 3;
        let k = Math.floor(lit * 6.2);
        if (u < 0.8 || v > 2.2) k -= 1;
        else if (u > 2.6 && v < 1) k += 1;
        body.set(x, y, scaleCol(ph, k));
      }
      put(p, body, 'dark');
      // a pale belly stripe along the inner edge
      for (let ph = PHI0 + 0.05; ph < PHI1 - 0.2; ph += 0.012) {
        const x = cx + (A - R0 + 1.5) * Math.cos(ph), y = cy + (B - R0 + 1.5) * Math.sin(ph);
        on(p, x, y, scaleCol(ph, 5));
      }

      // --- the head at the right, in profile, jaws closed on the tail tip
      const hx = cx + A + 2, hy = cy + 4;
      const tipPh = PHI1 + 0.08, tx0 = cx + A * Math.cos(tipPh), ty0 = cy + B * Math.sin(tipPh);
      const hm = mask(W, H);
      hm.ellipse(hx + 3, hy + 2, 9, 10, 1); // skull
      hm.poly([[hx - 3, hy - 4], [hx + 6, hy - 6], [hx + 2, hy - 18], [hx - 3, hy - 20], [hx - 6, hy - 12]], 1); // upper jaw / snout pointing up
      const head = shade(hm, DAY, { depth: 4, light: L, normal: sphereN(hx + 1, hy - 2, 11, 14), blend: 0.35, bias: 0.05 });
      T.scales(head, DAY, 3, 3, { lit: 1 });
      put(p, head, 'dark');
      const jm = mask(W, H); jm.poly([[hx - 6, hy - 2], [hx - 11, hy - 10], [hx - 12, hy - 16], [hx - 8, hy - 14], [hx - 4, hy - 8]], 1);
      put(p, shade(jm, DAY, { depth: 2, light: L, bias: -0.08 }), 'dark');
      // fangs biting into the tail
      for (const [x, y] of [[hx - 4, hy - 18], [hx - 2, hy - 16], [hx - 9, hy - 15], [hx - 7, hy - 12]]) { p.set(x, y, '#fff8e0'); p.set(x, y + 1, '#d8c8a0'); }
      p.set(Math.round(tx0), Math.round(ty0), NIGHT[4]);
      // horns swept back and a crest of spines
      for (const [bx, by, ex2, ey2, rr] of [[hx + 7, hy - 1, hx + 17, hy + 6, 1.9], [hx + 6, hy + 5, hx + 13, hy + 15, 1.6]]) put(p, part(W, H, (g) => tube(g, [[bx, by], [(bx + ex2) / 2 + 2, (by + ey2) / 2 - 1], [ex2, ey2]], rr, 0.4, 1, 10), ['#3a2408', '#6a4a14', '#a07830', '#d8b868', '#f8e8b0'], { depth: 1.2, light: L }), 'dark');
      // the mouth line along the snout, the tail's tip clamped between the jaws
      p.line(hx - 4, hy - 17, hx - 5, hy - 6, '#2a1206'); p.line(hx - 5, hy - 6, hx - 1, hy - 1, '#2a1206');
      stamp(p, Math.round(tx0) - 1, Math.round(ty0) - 1, ['.n.', 'nNn', '.n.'], { n: NIGHT[2], N: NIGHT[5] });
      // the clock-face eye: a gold ring with tick marks round a dark pupil
      const ex = hx + 3, ey = hy - 1;
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        const d = Math.hypot(x, y);
        if (d > 4.6) continue;
        p.set(ex + x, ey + y, d > 3.6 ? EYE[1] : d > 2.6 ? EYE[2] : d > 1.3 ? '#2a1a08' : EYE[3]);
      }
      for (let k = 0; k < 12; k++) { const a2 = (k / 12) * Math.PI * 2; p.set(Math.round(ex + Math.cos(a2) * 3.3), Math.round(ey + Math.sin(a2) * 3.3), k % 3 ? EYE[1] : EYE[0]); }
      p.line(ex, ey, ex, ey - 2, EYE[2]); p.line(ex, ey, ex + 2, ey + 1, EYE[2]);
      p.set(ex - 3, ey - 3, EYE[3]);
      // nostril and the brow ridge
      p.set(hx, hy - 17, '#2a1a08');
      p.line(hx - 1, ey - 5, hx + 7, ey - 6, DAY[1]);

      return close(p, {
        free: true,
        post: (q) => {
          const r2 = rng(334);
          for (let k = 0; k < 14; k++) { const a2 = r2() * Math.PI * 2, rad = 1.2 + r2() * 0.2; const x = Math.round(cx + Math.cos(a2) * A * rad), y = Math.round(cy + Math.sin(a2) * B * rad); if (y > 20 && p.get(x, y) == null) q.set(x, y, STAR[1 + Math.floor(r2() * 3)]); }
        },
      });
    };

    return (LIB = S);
  }

  const IDS = Object.keys(SIZES);
  for (const id of IDS) R.Gfx.def('mon:' + id, () => {
    const S = lib();
    if (!S[id]) throw new Error('boss sprite not drawn: ' + id);
    return S[id]();
  });
  R.Art = R.Art || {};
  R.Art.bossesB = { ids: IDS, sizes: SIZES, face: FACE };
})(window.RPG);
