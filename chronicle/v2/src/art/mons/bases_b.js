// BEAST: 魔物の土台（右向き・足元が原点・+x が前）その 2 — mushroom plant fairy wolf treant
// 形の約束は bases_a.js の先頭のとおり。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const BASES = (BZ.BASES = BZ.BASES || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;
  const EYE_ = () => ({ keys: ['#0e0a1c', '#1c1830'], n: 2, flat: true, fixed: true, noGold: true });
  const WHITE_ = () => ({ keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true });

  // ------------------------------------------------------------------ wolf オオカミ（M）。試作の氷狼（monsters.js）から氷を外した灰色の狼
  BASES.wolf = {
    tier: 'm', h: 50,
    pal: {
      fur: { keys: ['#141230', '#28284a', '#424462', '#62647c', '#8a8c9a', '#bcbab8'], n: 8, wrap: 0.22, amb: 0.12, rim: '#fff4e0', tex: 2.2, tsx: 0.35, tsy: 1.3 },
      furDk: { keys: ['#100e26', '#201e3c', '#363650', '#52526a', '#7a7a8e'], n: 7, wrap: 0.22, amb: 0.1, tex: 2.0, tsx: 0.35, tsy: 1.3 },
      belly: { keys: ['#262040', '#44405a', '#6a6678', '#9894a0', '#c8c4c0'], n: 7, wrap: 0.3, amb: 0.14, tex: 1.6, tsx: 0.35, tsy: 1.3 },
      nose: { keys: ['#0e0c1a', '#262434', '#46445a'], n: 4, spec: 1, fixed: true },
      eye: { keys: ['#e8a030', '#fff0a0'], n: 2, flat: true, glow: '#ffd070', fixed: true, noGold: true },
      gums: { keys: ['#3a0c1c', '#7a2a3c'], n: 2, flat: true, fixed: true },
      white: { keys: ['#e8e4dc', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true },
      claw: { keys: ['#1a1624', '#3a3444'], n: 2, flat: true, fixed: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), lg = st.atk || 0, hit = st.hit || 0, s2 = st.stage >= 2;
      const X = lg * 8 - hit * 5, bodyY = -br * 0.4 + lg * 2 + hit * 1;
      const F = P.fur, FD = P.furDk;
      const P_ = (x, y) => [x + X, y + bodyY];
      // 尾（いちばん奥）
      const sw = S(st.t * PI * 2 + 1) * 2 - hit * 3;
      B.strand([P_(-24, -32), P_(-36, -40 + sw), P_(-44, -28 + sw)], 4.4, 1.2, F, 0.2, { seg: 8 });
      B.strand([P_(-26, -30), P_(-38, -34 + sw), P_(-42, -22 + sw)], 3.6, 0.8, F, 0.21, { g: B.group(), seg: 8, shadeOff: -1 });
      B.strand([P_(-25, -33), P_(-33, -44 + sw), P_(-41, -38 + sw)], 2.6, 0.5, FD, 0.22, { g: B.group(), seg: 6, shadeOff: 0.5 });
      const leg = (hip, z, dk, front, reach) => {
        const m = dk ? FD : F;
        const k = [hip[0] + (front ? 1.5 : 3.5) + reach, hip[1] + 10];
        const a = [k[0] + (front ? -0.5 : -5) + reach * 0.5, hip[1] + 18];
        const pw = [a[0] + 2.5, -1.8];
        const g = B.group();
        B.cap(hip[0], hip[1], k[0], k[1], front ? 5.2 : 7, 3.5, m, z, { g });
        B.cap(k[0], k[1], a[0], a[1], 3.4, 2.6, m, z + 0.01, { g });
        B.cap(a[0], a[1], pw[0] - 1.2, pw[1] - 0.8, 2.3, 2.2, m, z + 0.02, { g });
        B.ell(pw[0], pw[1], 3.6, 2.0, m, z + 0.03, { g: B.group() });
        [[1.8, 0.5], [3.4, 0.3]].forEach(([dx, dy]) => B.rect(pw[0] + dx, pw[1] + dy, 1, 1, P.claw, z + 0.04));
      };
      leg(P_(4, -24), 0.5, true, true, lg * 3);
      leg(P_(-17, -26), 0.5, true, false, -lg * 2);
      const gb = B.group();
      B.ell(...P_(-13, -29), 10, 10, F, 1, { g: gb });
      B.ell(...P_(-3, -28.5), 12, 9.5, F, 1.01, { g: gb });
      B.ell(...P_(8, -28), 11.5, 12, F, 1.02, { g: gb });
      B.ell(...P_(-2, -21.5), 13, 4.5, P.belly, 1.03, { g: B.group(), bulge: 0.5 });
      B.fold(...P_(-12, -21), ...P_(4, -20), 1.4, gb, -1);
      B.fold(...P_(-6, -33), ...P_(-2, -24), 0.6, gb, -1);
      B.fold(...P_(-1, -34), ...P_(2, -24), 0.6, gb, -1);
      leg(P_(10, -23), 3, false, true, lg * 5);
      leg(P_(-14, -25), 3, false, false, -lg * 3);
      // 首と頭
      const hd = P_(23 + lg * 3 - hit * 2, -38 + lg * 5 - hit * 3);
      B.cap(...P_(10, -31), hd[0] - 4, hd[1] + 1, 10, 7.5, F, 1.5, { g: B.group() });
      for (let i = 0; i < 12; i++) {
        const a = -1.1 + i * 0.24, r = 9 + (i % 3);
        const o = P_(12 + C(a) * 3, -32 + S(a) * 3);
        B.strand([o, [o[0] + C(a + 1.2) * r * 0.5, o[1] + S(a + 1.2) * r * 0.6 + 2], [o[0] + C(a + 1.6) * r * 0.9 - 2, o[1] + r * 0.9]], 2.6, 0.3, i % 4 === 0 ? P.belly : F, 1.6 + i * 0.01, { seg: 5, shadeOff: (i % 3) - 0.5 });
      }
      for (let i = 0; i < 7; i++) {
        const bx = -22 + i * 5.2, by = -38.5 + Math.abs(i - 3) * 0.6 - (i > 4 ? 1.5 : 0);
        B.strand([P_(bx + 2, by + 3), P_(bx - 1, by - 1), P_(bx - 5, by - 1.5)], 2.4, 0.3, i % 2 ? FD : F, 1.1 + i * 0.01, { seg: 4, shadeOff: 0.5 });
      }
      for (let i = 0; i < 5; i++) B.strand([P_(-12 + i * 5, -21), P_(-13 + i * 5, -17), P_(-15 + i * 5, -15.5)], 2, 0.3, FD, 1.05, { seg: 4 });
      const gh = B.group();
      B.ell(hd[0], hd[1], 9.5, 8.4, F, 2, { g: gh });
      B.poly([[hd[0] - 7.5, hd[1] - 3], [hd[0] - 1.5, hd[1] - 6], [hd[0] - 9, hd[1] - 17 + hit * 4]], FD, 1.9, { bevel: 1.5 });
      const ge = B.group();
      B.poly([[hd[0] - 4.5, hd[1] - 5], [hd[0] + 3, hd[1] - 6], [hd[0] - 2.5, hd[1] - 18 + hit * 5]], F, 2.05, { bevel: 2, g: ge });
      B.fold(hd[0] - 1, hd[1] - 6, hd[0] - 2, hd[1] - 12, 0.8, ge, -2);
      const op = Math.max(st.bite || 0, lg * 0.9, hit * 0.4);
      const jaw = B.group();
      B.cap(hd[0] + 1, hd[1] + 4.5, hd[0] + 13, hd[1] + 5.5 + op * 3, 3.4, 2.0, FD, 1.95, { g: jaw });
      B.cap(hd[0] + 2, hd[1] + 3.5, hd[0] + 10, hd[1] + 4.5 + op * 2.6, 1.6, 1.0, P.gums, 1.96, { g: jaw });
      const sn = B.group();
      B.cap(hd[0] + 3, hd[1] + 0.8, hd[0] + 15, hd[1] + 2.6, 5, 3.0, F, 2.1, { g: sn });
      B.fold(hd[0] + 4, hd[1] + 4.2, hd[0] + 14, hd[1] + 4.8, 0.8, sn, -3);
      B.ell(hd[0] + 15.6, hd[1] + 1.8, 2.2, 1.8, P.nose, 2.2);
      const fang = s2 ? 1.2 : 0;
      for (let i = 0; i < 3; i++) B.rect(hd[0] + 7 + i * 2.4, hd[1] + 4.6, 1, 1.6 + (i === 0 ? 0.8 + fang : 0), P.white, 2.15);
      B.rect(hd[0] + 9.3, hd[1] + 3.0 + op * 2.6, 1, 1.5 + fang * 0.6, P.white, 1.97);
      B.fold(hd[0], hd[1] - 2.5, hd[0] + 6.5, hd[1] - 0.8, 1.0, gh, -2);
      if (hit > 0.5) B.cap(hd[0] + 1.6, hd[1] - 1.2, hd[0] + 6.5, hd[1] - 0.6, 0.5, 0.5, P.claw, 2.3);
      else B.poly([[hd[0] + 1.6, hd[1] - 2.2], [hd[0] + 7, hd[1] - 1], [hd[0] + 2.2, hd[1] + 0.6]], P.eye, 2.3, { bevel: 0.01 });
      B.fold(hd[0] - 5, hd[1] + 2, hd[0] + 3, hd[1] + 5, 1.4, gh, 1);
      B.strand([[hd[0] - 3, hd[1] + 1], [hd[0] - 7, hd[1] + 5], [hd[0] - 9, hd[1] + 9]], 2.6, 0.3, P.belly, 2.02, { seg: 4 });
      B.strand([[hd[0] - 1, hd[1] + 3], [hd[0] - 3, hd[1] + 8], [hd[0] - 6, hd[1] + 11]], 2.2, 0.3, F, 2.03, { seg: 4, shadeOff: 1 });
      return { head: [hd[0] + 4, hd[1] - 2], center: P_(-2, -28), fx: P_(6, -30), eye: [hd[0] + 4, hd[1] - 1], mouth: [hd[0] + 10, hd[1] + 5],
        back: P_(-4, -38), spine: [P_(9, -36), P_(4, -37), P_(-3, -37.5), P_(-10, -37), P_(-17, -36)], top: [hd[0] - 3, hd[1] - 17], u: 1.3, z: 1.35 };
    },
  };

  // ------------------------------------------------------------------ mushroom キノコ（S）
  BASES.mushroom = {
    tier: 's', h: 28,
    pal: {
      cap: { keys: ['#2a1030', '#5a1c34', '#923436', '#c05a3c', '#e08c5a', '#f4c08a'], n: 7, wrap: 0.35, amb: 0.18, spec: 0.5, specPow: 12, tex: 0.6, tsx: 0.5, tsy: 0.5 },
      gill: { keys: ['#2a1a2c', '#4c3440', '#76584e', '#9c7c64'], n: 5 },
      stem: { keys: ['#3a2a40', '#6a5a64', '#a4968c', '#d4c8b0', '#f4ecd4'], n: 6, wrap: 0.45, amb: 0.22, tex: 0.8, tsx: 0.3, tsy: 1.4 },
      dot: { keys: ['#8a7a70', '#e8dcc0', '#fff8e4'], n: 3, flat: true },
      eye: EYE_(), white: WHITE_(), gums: { keys: ['#3a1030', '#6a2444'], n: 2, flat: true, fixed: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2) * 0.06, atk = st.atk || 0, hit = st.hit || 0, s2 = st.stage >= 2;
      const X = atk * 4 - hit * 3, hop = atk * 3, sx = 1 + br - hit * 0.08 + atk * 0.05, sy = 1 - br + hit * 0.1 - atk * 0.05;
      const tilt = atk * 0.3 - hit * 0.3;
      const p = (x, y) => [X + x * sx + (-y) * tilt * 0.3, -hop + y * sy];
      // 足と手
      B.ell(X - 2.8 - atk, -1, 2.2, 1.3, P.stem, 0.8);
      B.ell(X + 3 + atk * 2, -1, 2.3, 1.3, P.stem, 1.3);
      B.cap(...p(-5, -8), ...p(-8, -4.5), 1.1, 0.9, P.stem, 0.7);
      // 柄（顔は右寄り）
      const gs = B.group();
      B.ell(...p(0, -7.5), 6.2, 7.5, P.stem, 1, { g: gs });
      B.fold(...p(-4, -3), ...p(4, -2.5), 1.2, gs, -1);
      B.cap(...p(5, -8), ...p(8.5 + atk * 2, -6 - atk * 2), 1.1, 0.9, P.stem, 1.2);
      const ex = X + 2.2, ey = -hop - 9 * sy;
      [[ex, 1.5, 1.9], [ex + 3.3, 1.25, 1.6]].forEach(([x, w, h], i) => {
        if (hit > 0.5) B.cap(x - w, ey, x + w, ey + 0.3, 0.4, 0.4, P.eye, 1.3);
        else { B.ell(x, ey, w, h, P.eye, 1.3); B.rect(x - w * 0.5, ey - h * 0.7, 1, 1, P.white, 1.31); }
      });
      if (atk > 0.5) B.ell(ex + 1.5, ey + 3.2, 1.4, 1.1, P.gums, 1.3);
      else B.cap(ex + 0.6, ey + 3, ex + 2.4, ey + 3.2, 0.4, 0.4, P.eye, 1.3);
      // 傘
      const cy = -hop - 17.5 * sy;
      const gc = B.group();
      B.ell(X - 0.5 + tilt * 3, cy + 3.2, 11.5 * sx, 2.4, P.gill, 1.5, { bulge: 0.4 });
      B.ell(X - 0.5 + tilt * 3, cy, 12.5 * sx, 8 * sy, P.cap, 1.6, { g: gc, rot: tilt * 0.5 });
      B.ell(X - 1 + tilt * 3, cy - 3, 9 * sx, 4.5 * sy, P.cap, 1.61, { g: gc, rot: tilt * 0.5, bulge: 0.7 });
      B.fold(X - 11 + tilt * 3, cy + 2.2, X + 11 + tilt * 3, cy + 2.2, 1.2, gc, -1);
      if (!s2) [[-5, -4, 1.6], [3, -5.5, 1.3], [7, -1.5, 1.1], [-8.5, 0, 1.0]].forEach(([dx, dy, r]) => B.ell(X + dx * sx + tilt * 3, cy + dy * sy, r * 1.2, r, P.dot, 1.65, { noAO: true }));
      return { head: [X + 3, cy], center: [X, -hop - 11], fx: [X + 1, -hop - 11], eye: [ex, ey], eyes: [[ex, ey, 1.3], [ex + 2.8, ey, 1.1]],
        cap: [X - 0.5 + tilt * 3, cy, 12.5 * sx, 8 * sy], top: [X, cy - 8], back: [X - 6, cy - 4], body: [X, -hop - 8, 6, 7.5], u: 0.9, z: 1.7 };
    },
  };

  // ------------------------------------------------------------------ plant かみつき花（M）
  BASES.plant = {
    tier: 'm', h: 42,
    pal: {
      stem: { keys: ['#2a1434', '#343048', '#2c5838', '#3e8040', '#68aa4c', '#a8d470'], n: 7, wrap: 0.35, amb: 0.16, tex: 0.7, tsx: 0.3, tsy: 1.4 },
      leaf: { keys: ['#2e1238', '#3a2c48', '#2c5c3a', '#3e8a44', '#6cb852', '#b0e07c'], n: 7, wrap: 0.4, amb: 0.18, tex: 1.0, tsx: 0.4, tsy: 1.2 },
      petal: { keys: ['#2c0e2c', '#5c1a44', '#962c5a', '#c84c70', '#e87e92', '#f8bcc0'], n: 7, wrap: 0.45, amb: 0.2 },
      mouth: { keys: ['#1e0a1a', '#3a0e22', '#5c1a2a', '#822a34'], n: 5, wrap: 0.3, fixed: true },
      tooth: { keys: ['#a89c8c', '#f4ecd8'], n: 2, flat: true, fixed: true, noGold: true },
      eye: { keys: ['#e8d040', '#fff8b0'], n: 2, flat: true, glow: '#fff080', fixed: true, noGold: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0;
      const sway = br * 1.2 + atk * 7 - hit * 5;
      const hx = 5 + sway, hy = -29 + atk * 4 + hit * 2 - br * 0.4;
      // 地面の葉
      [[-1, -10, 0.2], [1, 9, 0.25], [-1, -6, 0.9], [1, 12, 1.2]].forEach(([side, len, z], i) => {
        const b = [side * 1, -1], tip = [len, -3 - (i % 2) * 2];
        B.poly([b, [b[0] + tip[0] * 0.45, tip[1] - 3.5], tip, [b[0] + tip[0] * 0.55, 0.2]], P.leaf, z, { bevel: 2, ny: -0.5 });
      });
      // 茎
      const g = B.group();
      B.strand([[0, -1], [-2 + sway * 0.2, -12], [hx - 5, hy + 8], [hx - 2, hy + 3]], 3.0, 2.0, P.stem, 1, { g, seg: 10 });
      // 茎の葉
      B.poly([[-1, -12], [-9, -17 - br], [-12, -14 - br], [-6, -11]], P.leaf, 1.05, { bevel: 1.6, ny: -0.4 });
      B.poly([[0.5, -16], [7, -18 + br], [9.5, -15.5 + br], [4, -14]], P.leaf, 1.3, { bevel: 1.6, ny: -0.4 });
      // 花（花びらの輪は右を向く）
      const op = 0.35 + atk * 0.7 + hit * 0.1;
      const pr = [[-0.2, 1], [0.35, 0.95], [0.95, 0.85], [1.6, 0.9], [2.3, 0.95], [3.0, 1], [3.7, 1], [4.35, 0.95], [5.1, 0.9], [5.75, 0.9]];
      pr.forEach(([a, k], i) => {
        const back = C(a) < 0;
        const px = hx + C(a) * 4 * k, py = hy + S(a) * 9.5 * k;
        B.ell(px - 1.2, py, 4 * k, 6 * k, P.petal, back ? 1.4 : 1.8, { rot: a + PI / 2, bulge: 0.7, shadeOff: back ? -1 : 0 });
      });
      // 口（上あご・下あご）
      const gm = B.group();
      B.ell(hx + 1, hy, 5.5, 6.8, P.mouth, 1.6, { g: gm });
      const ja = 0.25 + op * 0.45;
      const gu = B.group(), gl = B.group();
      B.ell(hx + 4, hy - 2.8 - op * 1.4, 6.4, 3.0, P.petal, 1.9, { g: gu, rot: -ja });
      B.ell(hx + 4, hy + 3 + op * 1.4, 6.0, 2.8, P.petal, 1.9, { g: gl, rot: ja });
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const ux = hx + 1.5 + t * 7.5, uy = hy - 1.2 - op * 1.4 - t * 7.5 * S(ja) + 0.6;
        B.poly([[ux - 0.7, uy - 0.6], [ux + 0.7, uy - 0.6], [ux, uy + 1.6]], P.tooth, 1.95, { bevel: 0.2 });
        const lx = hx + 1.8 + t * 7, ly = hy + 1.4 + op * 1.4 + t * 7 * S(ja) - 0.4;
        B.poly([[lx - 0.7, ly + 0.6], [lx + 0.7, ly + 0.6], [lx, ly - 1.5]], P.tooth, 1.95, { bevel: 0.2 });
      }
      // 花の目（中に光る点 2 つ）
      if (!(hit > 0.5)) { B.rect(hx - 0.8, hy - 3.8, 1, 1, P.eye, 1.97); B.rect(hx + 1.2, hy - 4.2, 1, 1, P.eye, 1.97); }
      return { head: [hx + 3, hy - 2], center: [hx - 2, hy + 8], fx: [hx + 2, hy], eye: [hx, hy - 4], eyes: [[hx - 0.3, hy - 3.3, 0.8], [hx + 1.7, hy - 3.7, 0.8]], mouth: [hx + 5, hy],
        stem: [[0, -1], [-2 + sway * 0.2, -12], [hx - 5, hy + 8]], thornLines: [[[0, -2], [-1.5 + sway * 0.2, -12], [hx - 5, hy + 8]], [[-2, -12], [-11, -15]], [[1, -16], [9, -17]]],
        top: [hx, hy - 8], back: [hx - 4, hy - 6], body: [hx, hy, 6, 7], u: 1, z: 2.1 };
    },
  };

  // ------------------------------------------------------------------ fairy 妖精（S、飛ぶ）
  BASES.fairy = {
    tier: 's', h: 44, vis: 30, fly: true,
    pal: {
      skin: { keys: ['#4a2a3a', '#8a5058', '#c88a7c', '#eab89c', '#fadcc4'], n: 6, wrap: 0.45, amb: 0.3, rim: '#fff0d8', fixed: true },
      hair: { keys: ['#122c2a', '#1a4a32', '#267a3a', '#4cac44', '#90d860', '#d8f8a0'], n: 7, sheen: [-0.62, -0.28], wrap: 0.35, amb: 0.22, tex: 1.1, tsx: 0.25, tsy: 1.6 },
      dress: { keys: ['#2a1438', '#5a2450', '#8e3a68', '#c05a80', '#e890a4', '#fcc8c8'], n: 6, wrap: 0.35, amb: 0.2, tex: 0.5, tsx: 1.4, tsy: 0.3 },
      wing: { keys: ['#2e7890', '#5cb8cc', '#a8ecf0', '#effffc'], n: 4, wrap: 0.8, amb: 0.5, alpha: 0.62, ao: 0, spec: 1, specPow: 5, noGold: true },
      vein: { keys: ['#5a9aaa', '#9adcd8'], n: 2, flat: true, alpha: 0.7, noGold: true },
      eye: { keys: ['#1a1030', '#3a2a60', '#6a58a0'], n: 3, flat: true, fixed: true }, white: WHITE_(),
      mouth: { keys: ['#7a2c30', '#a8484a'], n: 2, flat: true, fixed: true },
      spark: { keys: ['#ffe890', '#fffff0'], n: 2, flat: true, glow: '#fff4a0', noGold: true },
    },
    draw(B, P, st) {
      const fl = st.t < 0.5 ? 0 : 1, atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 5 - hit * 4, Y = -22 + S(st.t * PI * 2) * 1.5 - atk * 1 + hit * 1.5;
      const p = (x, y) => [X + x, Y + y];
      const lean = atk * 0.35 - hit * 0.3;
      // 羽（奥）
      B.ell(...p(-3, -14), 8, 2.6, P.wing, 0.2, { rot: -1.25 + fl * 0.35, bulge: 0.2, noAO: true });
      B.ell(...p(-5, -6), 6, 2.2, P.wing, 0.21, { rot: -0.55 + fl * 0.3, bulge: 0.2, noAO: true });
      // 脚（ぶら下げ）
      B.cap(...p(-1, 3), X - 3 - hit, Y + 10, 1.0, 0.7, P.skin, 0.8);
      B.cap(...p(1.2, 3), X + 1.5 + atk * 2, Y + 9.5, 1.0, 0.7, P.skin, 1.2);
      // 服（葉のスカート）
      const gd = B.group();
      B.poly([p(-3.2, -5), p(3.2, -5), p(5, 3.5), p(2.5, 5), p(0, 3.8), p(-2.5, 5.2), p(-5, 3.5)], P.dress, 1, { g: gd, bevel: 2 });
      B.ell(...p(0, -3.5), 3.3, 3, P.dress, 1.01, { g: gd });
      // 腕
      const hand = p(5.5 + atk * 4, -3 - atk * 3 + hit * 2);
      B.cap(...p(2.5, -5.5), hand[0], hand[1], 1.0, 0.8, P.skin, 1.3);
      B.cap(...p(-2.5, -5.5), X - 5.5, Y - 1 + hit * 1, 1.0, 0.8, P.skin, 0.9);
      // 頭
      const hd = p(1.5 + lean * 3, -11);
      B.ell(hd[0] - 1.6, hd[1] - 1, 6.4, 6.2, P.hair, 1.5, { g: B.group() });
      B.strand([[hd[0] - 4, hd[1] + 1], [hd[0] - 6.5, hd[1] + 5], [hd[0] - 5, hd[1] + 8]], 2.2, 0.8, P.hair, 1.49);
      B.ell(hd[0], hd[1], 4.8, 4.7, P.skin, 1.6, { g: B.group() });
      // 前髪と跳ねた髪
      B.poly([[hd[0] - 4.5, hd[1] - 1], [hd[0] - 3, hd[1] - 5.5], [hd[0] + 2, hd[1] - 5.2], [hd[0] + 4.6, hd[1] - 2.2], [hd[0] + 1.5, hd[1] - 2.6], [hd[0] - 1, hd[1] - 1.5]], P.hair, 1.7, { bevel: 1.5 });
      B.strand([[hd[0] - 3, hd[1] - 4], [hd[0] - 7, hd[1] - 8], [hd[0] - 9, hd[1] - 5]], 1.4, 0.4, P.hair, 1.45);
      B.strand([[hd[0] - 1, hd[1] - 5], [hd[0] - 1, hd[1] - 9.5], [hd[0] + 2, hd[1] - 10]], 1.1, 0.3, P.hair, 1.72);
      // とがった耳
      B.poly([[hd[0] - 1, hd[1] - 0.5], [hd[0] - 5.5, hd[1] - 3.5], [hd[0] - 1.8, hd[1] + 1.5]], P.skin, 1.62, { bevel: 0.6 });
      // 顔（右向き 3/4）
      const ex = hd[0] + 1.6, ey = hd[1] + 0.3;
      if (hit > 0.5) { B.cap(ex - 1, ey, ex + 0.8, ey + 0.4, 0.35, 0.35, P.eye, 1.8); B.cap(ex + 2.2, ey, ex + 3.4, ey + 0.4, 0.35, 0.35, P.eye, 1.8); }
      else {
        B.ell(ex, ey, 1.0, 1.35, P.eye, 1.8); B.rect(ex - 0.5, ey - 1, 1, 1, P.white, 1.81);
        B.ell(ex + 2.8, ey, 0.8, 1.2, P.eye, 1.8); B.rect(ex + 2.4, ey - 0.9, 1, 1, P.white, 1.81);
      }
      B.cap(ex + 0.4, ey + 2.4, ex + 2.2, ey + 2.1 - (atk > 0.5 ? 0 : 0.4), 0.4, 0.4, P.mouth, 1.8);
      // 羽（手前）
      B.ell(...p(-7, -13), 8.5, 2.8, P.wing, 0.25, { rot: -0.85 + fl * 0.35, bulge: 0.2, noAO: true });
      B.ell(...p(-8, -5), 6.5, 2.3, P.wing, 0.26, { rot: -0.15 + fl * 0.3, bulge: 0.2, noAO: true });
      // 光の粉
      [[8, -14], [-9, 2], [10, 4]].forEach(([x, y], i) => B.rect(X + x + (i === 0 ? atk * 3 : 0), Y + y + (fl ? 1 : 0), 1, 1, P.spark, 2.1));
      return { head: [hd[0] + 2, hd[1] - 2], center: p(0, -3), fx: p(1, -5), eye: [ex, ey], eyes: [[ex, ey, 1.2], [ex + 2.8, ey, 1]], hand,
        top: [hd[0] - 1, hd[1] - 6], back: p(-3, -8), body: [X, Y - 4, 4, 8], u: 0.8, z: 2.2 };
    },
  };

  // ------------------------------------------------------------------ treant 木の魔物（L）
  BASES.treant = {
    tier: 'l', h: 64,
    pal: {
      bark: { keys: ['#1c1028', '#34203a', '#503446', '#704e4e', '#90705c', '#b4987a'], n: 7, wrap: 0.25, amb: 0.14, tex: 2.4, tsx: 0.25, tsy: 1.5 },
      barkDk: { keys: ['#160c20', '#2a1a30', '#402a3c', '#5a4046', '#765c52'], n: 6, wrap: 0.25, amb: 0.12, tex: 2.2, tsx: 0.25, tsy: 1.5 },
      leaf: { keys: ['#2c1236', '#3e2442', '#2e4a36', '#44703c', '#6a9a44', '#a4c862'], n: 7, tex: 3, tsx: 0.55, tsy: 0.55, wrap: 0.3, amb: 0.14, rim: '#fff0b0', rimK: 0.5 },
      moss: { keys: ['#1e2a1c', '#2e4a24', '#4a7430', '#78a044', '#a8c864'], n: 6, tex: 2.5, tsx: 0.8, tsy: 0.8 },
      hole: { keys: ['#120a18', '#22142a'], n: 2, flat: true, fixed: true },
      eye: { keys: ['#f0a030', '#ffe890'], n: 2, flat: true, glow: '#ffc060', fixed: true, noGold: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0;
      const lean = atk * 0.14 - hit * 0.12 + br * 0.015;
      const T = (x, y) => [x + (-y) * lean, y];   // 足元を軸に傾ける
      // 根の脚（奥）
      [[-4, -12, -2], [2, -7, -1]].forEach(([a, b], i) => B.strand([T(a, -5), T(a - 3 + i * 3, -2.5), [a - 8 + i * 5 + (i ? atk * 3 : 0), -0.8]], 3.2, 1.2, P.barkDk, 0.3, { seg: 5 }));
      // 奥の腕
      const far = T(-6, -38);
      B.strand([far, T(-13, -40 - br), T(-20, -36 - br), T(-24, -39 - br)], 3.4, 1.4, P.barkDk, 0.4, { seg: 7 });
      // 幹
      const gt = B.group();
      B.cap(...T(0, -4), ...T(-1, -38), 12.5, 10, P.bark, 1, { g: gt, zr: 1.2 });
      B.ell(...T(0, -5), 13, 5, P.bark, 1.01, { g: gt });
      for (let i = 0; i < 6; i++) { const x = -7 + i * 2.8; B.fold(...T(x, -6), ...T(x - 1 + (i % 2) * 2, -36), 0.55, gt, -2); }
      // 顔のうろ
      const face = T(4.5, -26);
      const eye = (x, y, w, h) => { B.ell(x, y, w, h, P.hole, 2.6); if (!(hit > 0.5)) B.ell(x + 0.4, y + 0.2, w * 0.45, h * 0.45, P.eye, 2.61); };
      eye(face[0] - 1.2, face[1] - 3, 2.4, 2.1);
      eye(face[0] + 4.8, face[1] - 2.6, 1.9, 1.9);
      B.ell(face[0] + 2.2, face[1] + 5 + atk, 3.4, 2.2 + atk * 1.6, P.hole, 2.6);
      B.fold(face[0] - 4, face[1] - 6, face[0] + 7, face[1] - 5.5, 0.9, gt, -2);
      // 苔
      B.ell(...T(-6, -16), 5, 2.4, P.moss, 1.2, { rot: 0.4, bulge: 0.6 });
      B.ell(...T(3, -38), 6, 2.2, P.moss, 1.21, { bulge: 0.6 });
      // 根の脚（手前）
      [[-6, -14], [3, 8], [8, 14]].forEach(([a, b], i) => B.strand([T(a, -6), T((a + b) / 2, -3), [b + (i === 2 ? atk * 4 : 0), -0.8]], 3.4, 1.2, P.bark, 1.4, { seg: 5 }));
      // 手前の腕（前へ振る）
      const sh = T(6, -34), ew = [sh[0] + 7 + atk * 6, sh[1] + 3 - atk * 5 + hit * 4], hd = [ew[0] + 6 + atk * 5, ew[1] + 5 - atk * 4 + hit * 3];
      B.strand([sh, ew, hd], 4, 2.2, P.bark, 2.7, { seg: 6 });
      [[3, 3], [4, -1], [1.5, 4.5]].forEach(([dx, dy]) => B.strand([hd, [hd[0] + dx * 0.6, hd[1] + dy * 0.6], [hd[0] + dx, hd[1] + dy]], 1.5, 0.6, P.bark, 2.71, { seg: 3 }));
      B.ell(ew[0] - 1, ew[1] - 2.8, 4, 2.8, P.leaf, 2.72, { bulge: 0.8 });
      // 冠の葉
      const cx = T(-3, -46)[0], cy = -47;
      const Rr = BZ.rz().rng(7);
      for (let i = 0; i < 26; i++) {
        const a = Rr() * PI * 2, rr = Math.sqrt(Rr()) * 15;
        const r = 5.5 + Rr() * 4;
        const px = cx + C(a) * rr * 1.35, py = cy + S(a) * rr * 0.8 - hit * 1.5;
        B.ell(px, py, r, r * 0.88, P.leaf, 1.7 + (py - cy + 20) * 0.001 + i * 0.0001, { bulge: 0.85 });
      }
      return { head: T(9, -34), center: T(0, -24), fx: T(4, -26), eye: [face[0] - 1.2, face[1] - 3], eyes: [[face[0] - 0.8, face[1] - 2.8, 1.1], [face[0] + 5.2, face[1] - 2.4, 0.9]], mouth: [face[0] + 2, face[1] + 5],
        thornLines: [[T(-9, -8), T(-10, -36)], [T(8, -10), T(7, -30)], [sh, ew, hd]], top: [cx, cy - 14], back: [cx - 6, cy - 6], body: [0, -22, 11, 20], u: 1.4, z: 2 };
    },
  };
})(window.RPG);
