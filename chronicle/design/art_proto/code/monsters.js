// Monsters, all facing RIGHT (toward the party). Model units = sprite px at scale 1, origin at the feet.
'use strict';
(function (G) {
  const { mat } = G.RZ; const { M } = G.RIG;
  const PI = Math.PI;
  const dir = (a) => [Math.sin(a), Math.cos(a)];

  const MM = {
    slime: mat({ keys: ['#03282e', '#075a58', '#0f9474', '#34c890', '#8cf0c0', '#e8fff4'], n: 8, spec: 1, specPow: 8, wrap: 0.6, amb: 0.3, rim: '#d0fff0', rimK: 0.8, alpha: 0.93 }),
    slimeCore: mat({ keys: ['#10382a', '#2c6a3a', '#6aa040', '#c8d060', '#fff4a0'], n: 6, wrap: 0.6, amb: 0.4, alpha: 0.93, ao: 0 }),
    slimeEye: mat({ keys: ['#021816', '#08302c'], n: 2, flat: true }),
    fur: mat({ keys: ['#101a34', '#26385c', '#4a6690', '#88a8cc', '#c8def0', '#f4fbff'], n: 8, wrap: 0.35, amb: 0.2, rim: '#fff4e0' }),
    furDk: mat({ keys: ['#0a1024', '#1a2848', '#34507a', '#6284b0', '#a0bcdc'], n: 7, wrap: 0.35, amb: 0.2 }),
    ice: mat({ keys: ['#0c2a4c', '#1c5a8c', '#3aa0d0', '#8ce0f8', '#dcfaff', '#ffffff'], n: 8, spec: 1, specPow: 5, wrap: 0.2, amb: 0.35, rim: '#ffffff', rimK: 0.8, sheen: [-0.9, -0.3] }),
    nose: mat({ keys: ['#06080e', '#1c2230', '#3a4458'], n: 4, spec: 1 }),
    wolfEye: mat({ keys: ['#60f0ff', '#e8ffff'], n: 2, flat: true, glow: '#80f0ff' }),
    gums: mat({ keys: ['#3a0c1c', '#7a2a3c'], n: 2, flat: true }),
    gSkin: mat({ keys: ['#10200c', '#24441a', '#44722c', '#76a844', '#b4d878', '#e8f8b8'], n: 8, wrap: 0.45, amb: 0.28, rim: '#fff0c0' }),
    gLeather: mat({ keys: ['#1a0e08', '#3a2014', '#62381e', '#8c5a30', '#b8844c'], n: 7 }),
    gCloth: mat({ keys: ['#1c0c0c', '#3c1a16', '#643024', '#8c4a34'], n: 6 }),
  };

  const GOBLIN = { name: '小鬼の斧兵', skin: MM.gSkin, face: 'goblin', ears: 'goblin', hairStyle: 'none', helm: true, hair: MM.gLeather,
    eye: MM.wolfEye, top: MM.gLeather, trim: MM.gCloth, pants: MM.gCloth, boots: M.leatherDk, belt: M.leatherDk,
    armor: 'pauldron', metal: M.iron, cape: null, weapon: 'axe' };

  function goblin(B, t, st) {
    const br = t;
    const base = { br, lean: 0.22, tilt: -0.05, aN: 0.9, eN: 1.0, w: 2.2, aF: 0.2, eF: 0.9, lN: 0.45, kN: -0.6, lF: -0.35, kF: -0.35, eyes: 1 };
    const atk = { lean: 0.45, aN: 1.7, eN: 0.2, w: 1.4, lN: 0.8, kN: -0.7 };
    const p = RIG.lerpPose(RIG.pose('idle', base), RIG.pose('idle', Object.assign({}, base, atk)), st && st.atk || 0);
    return RIG.draw(B, GOBLIN, p);
  }

  function slime(B, t, st) {
    const s = Math.sin(t * PI * 2) * 0.07, hop = st && st.hop || 0;
    const sx = 1 + s, sy = 1 - s;
    const y0 = -hop * 10;
    const g = B.group();
    B.ell(0, y0 - 12.5 * sy, 15.5 * sx, 12.5 * sy, MM.slime, 1, { g });
    B.ell(-1.5 * sx, y0 - 21 * sy, 9.5 * sx, 8 * sy, MM.slime, 1.01, { g, rot: -0.2 });
    B.ell(0, y0 - 3.5, 17 * sx, 3.8, MM.slime, 1.02, { g, bulge: 0.6 });
    B.ell(-5 * sx, y0 - 11 * sy, 5.6, 5, MM.slimeCore, 1.1, { g: B.group(), bulge: 0.7 });
    // bubbles
    [[-10, -9, 1.3], [-2, -5, 0.9], [6, -21, 1.0], [-7, -18, 0.8]].forEach(([x, y, r]) => B.ell(x * sx, y0 + y * sy, r, r, MM.slime, 1.2, { g: B.group(), shadeOff: 2, noAO: true }));
    // face
    [[5.5, 3.4, 2.1], [11.2, 2.8, 1.6]].forEach(([x, h, w], i) => {
      B.ell(x * sx, y0 - 13.5 * sy, w, h, MM.slimeEye, 1.3);
      B.rect(x * sx - w * 0.2, y0 - 13.5 * sy - h * 0.7, 1, 1, M.white, 1.31);
    });
    B.cap(6.5 * sx, y0 - 8.4 * sy, 10 * sx, y0 - 8.6 * sy, 0.55, 0.55, MM.slimeEye, 1.3);
    // gloss
    B.ell(-7 * sx, y0 - 22 * sy, 3.4, 1.7, M.white, 1.4, { rot: -0.5, noOutline: true });
    B.ell(-11.5 * sx, y0 - 17.5 * sy, 1.1, 1.1, M.white, 1.4);
  }

  function wolf(B, t, st) {
    st = st || {};
    const br = Math.sin(t * PI * 2), lg = st.lunge || 0;
    const X = lg * 8, bodyY = -br * 0.4 + lg * 2;
    const F = MM.fur, FD = MM.furDk, I = MM.ice;
    const hx = X, hy = bodyY;
    const P = (x, y) => [x + hx, y + hy];
    // tail (behind everything)
    const sw = Math.sin(t * PI * 2 + 1) * 2;
    const gt = B.group();
    B.strand([P(-24, -32), P(-36, -40 + sw), P(-44, -28 + sw)], 4.4, 1.2, F, 0.2, { g: gt, seg: 8 });
    B.strand([P(-26, -30), P(-38, -34 + sw), P(-42, -22 + sw)], 3.6, 0.8, F, 0.21, { g: B.group(), seg: 8, shadeOff: -1 });
    B.strand([P(-25, -33), P(-33, -44 + sw), P(-41, -38 + sw)], 2.6, 0.5, F, 0.22, { g: B.group(), seg: 6, shadeOff: 0.5 });
    // far legs
    const leg = (hip, ang, z, dk, front) => {
      const m = dk ? FD : F;
      const k = [hip[0] + (front ? 1.5 : 3.5), hip[1] + 10];
      const a = [k[0] + (front ? -0.5 : -5), hip[1] + 18];
      const pw = [a[0] + 2.5, -1.8];
      const g = B.group();
      B.cap(hip[0], hip[1], k[0], k[1], front ? 4.4 : 6.2, 3.1, m, z, { g });
      B.cap(k[0], k[1], a[0], a[1], 3.0, 2.3, m, z + 0.01, { g });
      B.cap(a[0], a[1], pw[0] - 1.2, pw[1] - 0.8, 2.3, 2.2, m, z + 0.02, { g });
      B.ell(pw[0], pw[1], 3.6, 2.0, m, z + 0.03, { g: B.group() });
      [[1.8, 0.5], [3.4, 0.3]].forEach(([dx, dy]) => B.rect(pw[0] + dx, pw[1] + dy, 1, 1, M.lash, z + 0.04));
    };
    leg(P(6, -24), 0, 0.5, true, true);
    leg(P(-20, -26), 0, 0.5, true, false);
    // body
    const gb = B.group();
    B.ell(...P(-16, -29), 10.5, 10, F, 1, { g: gb });
    B.ell(...P(-3, -28), 14, 9.5, F, 1.01, { g: gb });
    B.ell(...P(9, -28), 11, 11.5, F, 1.02, { g: gb });
    // belly shading fold + ribs
    B.fold(...P(-12, -21), ...P(4, -20), 1.4, gb, -1);
    B.fold(...P(-6, -33), ...P(-2, -24), 0.6, gb, -1);
    B.fold(...P(-1, -34), ...P(2, -24), 0.6, gb, -1);
    // near legs
    leg(P(11, -23), 0, 3, false, true);
    leg(P(-17, -25), 0, 3, false, false);
    // neck + head
    const gn = B.group();
    const hd = P(24 + lg * 3, -44 + lg * 5);
    B.cap(...P(10, -32), hd[0] - 4, hd[1] + 2, 9, 7, F, 1.5, { g: gn });
    // ruff: layered fur strands around the neck/chest
    for (let i = 0; i < 9; i++) {
      const a = -0.9 + i * 0.28, r = 8 + (i % 2);
      const o = P(12 + Math.cos(a) * 3, -32 + Math.sin(a) * 3);
      B.strand([o, [o[0] + Math.cos(a + 1.2) * r * 0.5, o[1] + Math.sin(a + 1.2) * r * 0.6 + 2], [o[0] + Math.cos(a + 1.6) * r * 0.9 - 2, o[1] + r * 0.9]], 2.6, 0.3, F, 1.6 + i * 0.01, { seg: 5, shadeOff: (i % 3) - 0.5 });
    }
    // back fur tufts
    for (let i = 0; i < 7; i++) {
      const bx = -22 + i * 5.2, by = -38.5 + Math.abs(i - 3) * 0.6 - (i > 4 ? 1.5 : 0);
      B.strand([P(bx + 2, by + 3), P(bx - 1, by - 1), P(bx - 5, by - 1.5)], 2.4, 0.3, F, 1.1 + i * 0.01, { seg: 4, shadeOff: 0.5 });
    }
    // belly fringe
    for (let i = 0; i < 5; i++) B.strand([P(-12 + i * 5, -21), P(-13 + i * 5, -17), P(-15 + i * 5, -15.5)], 2, 0.3, FD, 1.05, { seg: 4 });
    const gh = B.group();
    B.ell(hd[0], hd[1], 8, 7, F, 2, { g: gh });
    // ears
    B.poly([[hd[0] - 6, hd[1] - 3], [hd[0] - 1, hd[1] - 5], [hd[0] - 7, hd[1] - 15]], FD, 1.9, { bevel: 1.5 });
    B.poly([[hd[0] - 3.5, hd[1] - 4], [hd[0] + 2.5, hd[1] - 5], [hd[0] - 2, hd[1] - 15.5]], F, 2.05, { bevel: 2, g: B.group() });
    B.fold(hd[0] - 1, hd[1] - 6, hd[0] - 2, hd[1] - 12, 0.8, B.gid - 1, -2);
    // snout + jaw
    const op = st.bite || 0;
    const jaw = B.group();
    B.cap(hd[0] + 1, hd[1] + 4, hd[0] + 11, hd[1] + 5 + op * 3, 3.2, 2.0, FD, 1.95, { g: jaw });
    B.cap(hd[0] + 2, hd[1] + 3.5, hd[0] + 10, hd[1] + 4.5 + op * 2.6, 1.6, 1.0, MM.gums, 1.96, { g: jaw });
    const sn = B.group();
    B.cap(hd[0] + 2, hd[1] + 0.5, hd[0] + 13, hd[1] + 2.4, 4.4, 2.8, F, 2.1, { g: sn });
    B.fold(hd[0] + 4, hd[1] + 3.6, hd[0] + 12, hd[1] + 4.4, 0.7, sn, -2);
    B.ell(hd[0] + 13.4, hd[1] + 1.6, 1.9, 1.6, MM.nose, 2.2);
    // teeth
    for (let i = 0; i < 3; i++) B.rect(hd[0] + 6 + i * 2.2, hd[1] + 4.1, 1, 1.6 + (i === 0 ? 0.8 : 0), M.white, 2.15);
    B.rect(hd[0] + 9.3, hd[1] + 3.0 + op * 2.6, 1, 1.5, M.white, 1.97);
    // eye + brow
    B.fold(hd[0], hd[1] - 2.5, hd[0] + 6.5, hd[1] - 0.8, 1.0, gh, -2);
    B.poly([[hd[0] + 1.4, hd[1] - 1.8], [hd[0] + 5.8, hd[1] - 0.6], [hd[0] + 2, hd[1] + 0.4]], MM.wolfEye, 2.3, { bevel: 0.01 });
    B.fold(hd[0] - 5, hd[1] + 2, hd[0] + 3, hd[1] + 5, 1.4, gh, 1);
    // cheek fur
    B.strand([[hd[0] - 3, hd[1] + 1], [hd[0] - 7, hd[1] + 5], [hd[0] - 9, hd[1] + 9]], 2.6, 0.3, F, 2.02, { seg: 4 });
    B.strand([[hd[0] - 1, hd[1] + 3], [hd[0] - 3, hd[1] + 8], [hd[0] - 6, hd[1] + 11]], 2.2, 0.3, F, 2.03, { seg: 4, shadeOff: 1 });
    // ice crystals growing from the shoulders / back
    const shard = (x, y, a, len, w, z) => {
      const d = [Math.sin(a), -Math.cos(a)], n = [-d[1], d[0]];
      const b = P(x, y);
      const pts = [[b[0] - n[0] * w, b[1] - n[1] * w], [b[0] + d[0] * len * 0.75 - n[0] * w * 0.8, b[1] + d[1] * len * 0.75 - n[1] * w * 0.8], [b[0] + d[0] * len, b[1] + d[1] * len], [b[0] + d[0] * len * 0.7 + n[0] * w * 0.9, b[1] + d[1] * len * 0.7 + n[1] * w * 0.9], [b[0] + n[0] * w, b[1] + n[1] * w]];
      const g = B.group();
      B.poly(pts, I, z, { g, bevel: w * 0.9, nx: -0.3 });
      B.fold(b[0] + d[0] * 1, b[1] + d[1] * 1, b[0] + d[0] * len * 0.8, b[1] + d[1] * len * 0.8, w * 0.35, g, 2);
    };
    shard(6, -38, -0.35, 13, 2.6, 1.3);
    shard(10, -37, 0.15, 10, 2.1, 1.31);
    shard(1, -38, -0.7, 9, 2.0, 1.29);
    shard(-8, -37, -0.9, 8, 1.8, 1.28);
    shard(-15, -36, -1.1, 6, 1.5, 1.27);
    shard(15, -35, 0.6, 7, 1.6, 1.32);
    return { head: hd };
  }

  G.MON = {
    list: { slime: { draw: slime, name: 'スライム' }, wolf: { draw: wolf, name: '氷狼' }, goblin: { draw: goblin, name: '小鬼の斧兵' } },
    draw(name, B, t, st) { return this.list[name].draw(B, t || 0, st); },
    MM,
  };
})(window);
