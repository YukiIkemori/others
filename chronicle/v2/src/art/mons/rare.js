// BEAST: レア魔物 3（縦切り。V2_PLAN §3.6）— 宝石ウサギ rare_hare・花角の小鹿 rare_fawn・どんぐり王子 rare_acorn
// 小さく可愛く、ひと目で「当たり」と分かるよう、光る物（宝石・花・王冠）を 1 つ持たせる（彩度 0.8 まで許すのはそこだけ）。
// 形の約束は bases_a.js の先頭のとおり（右向き・足元が原点）。hd:mon:<id>、opts {golden}。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const RARE = (BZ.RARE = BZ.RARE || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;
  const EYE = { keys: ['#120c22', '#261c3a'], n: 2, flat: true, fixed: true, noGold: true };
  const WHITE = { keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true };

  // ------------------------------------------------------------------ 宝石ウサギ（M）
  RARE.rare_hare = {
    tier: 'm', h: 40,
    pal: {
      fur: { keys: ['#2a2048', '#4a4274', '#7a74a4', '#aaa8cc', '#d8d8ec', '#f8f6fc'], n: 7, wrap: 0.4, amb: 0.2, tex: 1.4, tsx: 0.5, tsy: 1.2 },
      inner: { keys: ['#5a2a4a', '#9a5070', '#d08898', '#f4c0c4'], n: 5, fixed: true },
      crys: { keys: ['#10406a', '#1a7ab0', '#40c0e8', '#a0f0ff', '#f0ffff'], n: 6, spec: 1, specPow: 5, wrap: 0.3, amb: 0.35, glow: '#80e8ff', noGold: true },
      gem: { keys: ['#6a0a28', '#c01848', '#f04a70', '#ffb0c0'], n: 5, spec: 1, specPow: 4, glow: '#ff5080', fixed: true, noGold: true },
      eye: EYE, white: WHITE,
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 6 - hit * 3, Y = -atk * 4 + hit * 0.5;
      const p = (x, y) => [X + x, Y + y];
      // 尾（水晶のふさ）
      B.ell(...p(-11.5, -9), 3.4, 3.2, P.fur, 0.6);
      B.poly([p(-13, -11), p(-16, -14), p(-13.5, -9)], P.crys, 0.61, { bevel: 0.6 });
      // 後ろ足
      B.ell(X - 2 - atk * 3, -1.4, 6.2, 1.9, P.fur, 0.9);
      // 体
      const gb = B.group();
      B.ell(...p(-4, -7.5), 8, 7.2, P.fur, 1, { g: gb });
      B.ell(...p(1, -10.5), 8.5, 8, P.fur, 1.01, { g: gb });
      B.ell(...p(6, -10), 4.6, 6, P.fur, 1.02, { g: B.group(), shadeOff: 1.2 });
      // 背の宝石の群れ
      [[-5, -16, 0.2, 5], [-1.5, -17.5, -0.2, 4], [-8, -13.5, 0.6, 3.5]].forEach(([x, y, a, L], i) => {
        const b = p(x, y), d = [S(a), -C(a)];
        B.poly([[b[0] - 1.6, b[1] + 0.5], [b[0] + d[0] * L - 0.4, b[1] + d[1] * L], [b[0] + d[0] * L + 0.8, b[1] + d[1] * L + 0.6], [b[0] + 1.6, b[1] + 0.6]], P.crys, 1.1 + i * 0.01, { bevel: 0.9, nx: -0.3 });
      });
      // 前足
      B.cap(...p(6, -5), X + 7.5 + atk * 2, -0.9, 1.6, 1.3, P.fur, 1.2);
      // 頭
      const hd = p(8 + atk * 1.5, -18 + hit * 1.5);
      const gh = B.group();
      B.ell(hd[0], hd[1], 6.2, 5.6, P.fur, 2, { g: gh });
      B.ell(hd[0] + 3.8, hd[1] + 1.8, 3.2, 2.7, P.fur, 2.05, { g: gh, shadeOff: 1 });
      B.rect(hd[0] + 6.4, hd[1] + 0.8, 1, 1, P.inner, 2.1);
      // 耳（奥・手前）。先が水晶
      const ea = hit * 0.9 + S(st.t * PI * 2 + 0.5) * 0.06;
      const ear = (bx, by, a, L, r, z) => {
        const tip = [bx + S(a) * L, by - C(a) * L];
        B.cap(bx, by, tip[0], tip[1], r, r * 0.75, P.fur, z, { g: B.group() });
        B.cap(bx + S(a) * 1.5, by - C(a) * 1.5, bx + S(a) * L * 0.8, by - C(a) * L * 0.8, r * 0.45, r * 0.35, P.inner, z + 0.01);
        B.poly([[tip[0] - r * 0.9, tip[1] + 1], [tip[0] + S(a) * 4, tip[1] - C(a) * 4], [tip[0] + r * 0.9, tip[1] + 1.2]], P.crys, z + 0.02, { bevel: 0.7 });
        return tip;
      };
      ear(hd[0] - 2.5, hd[1] - 4, -0.35 - ea, 12, 2.1, 1.9);
      const et = ear(hd[0] - 0.5, hd[1] - 4.5, -0.1 - ea * 0.8, 13, 2.5, 2.2);
      // 額の宝石
      const gm = [hd[0] + 2, hd[1] - 3.2];
      B.poly([[gm[0] - 1.6, gm[1]], [gm[0], gm[1] - 2], [gm[0] + 1.6, gm[1]], [gm[0], gm[1] + 1.8]], P.gem, 2.3, { bevel: 0.9 });
      B.rect(gm[0] - 0.6, gm[1] - 1, 1, 1, P.white, 2.31);
      // 目
      const ex = hd[0] + 2.6, ey = hd[1] + 0.2;
      if (hit > 0.5) B.cap(ex - 1.4, ey, ex + 1.2, ey + 0.5, 0.45, 0.45, P.eye, 2.3);
      else { B.ell(ex, ey, 1.4, 1.8, P.eye, 2.3); B.rect(ex - 0.7, ey - 1.2, 1, 1, P.white, 2.31); B.rect(ex + 0.3, ey + 0.6, 1, 1, P.crys, 2.31); }
      return { head: [hd[0] + 3, hd[1] - 2], center: p(0, -10), fx: p(3, -11), eye: [ex, ey], eyes: [[ex, ey, 1.6]], top: et, back: p(-4, -17), gem: gm, body: [X, Y - 10, 9, 8], u: 1, z: 2.4 };
    },
  };

  // ------------------------------------------------------------------ 花角の小鹿（M）
  RARE.rare_fawn = {
    tier: 'm', h: 50,
    pal: {
      fur: { keys: ['#2a1432', '#54284a', '#8a4e52', '#b87c5e', '#dcac7c', '#f4d8a8'], n: 7, wrap: 0.35, amb: 0.18, tex: 1.2, tsx: 0.5, tsy: 1.2 },
      light: { keys: ['#4a3446', '#8a7070', '#c4ac98', '#eadcc4', '#fcf4e4'], n: 6, wrap: 0.45, amb: 0.25 },
      hoof: { keys: ['#1a1224', '#34283a', '#54444e'], n: 4 },
      antler: { keys: ['#2e1c24', '#5a3c34', '#8c6a50', '#bea07a', '#e8d4b0'], n: 6, wrap: 0.35 },
      petal: { keys: ['#5a1a4a', '#a83a78', '#e070a8', '#ffb0d4', '#fff0f8'], n: 6, wrap: 0.5, amb: 0.3, glow: '#ffc0e0', noGold: true },
      leaf: { keys: ['#1a3a2a', '#2a6a3a', '#50a04c', '#90d070'], n: 5, wrap: 0.4 },
      mid: { keys: ['#8a5010', '#f0c040', '#fff0a0'], n: 3, fixed: true, noGold: true },
      eye: EYE, white: WHITE,
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 5 - hit * 3, Y = -br * 0.3 - atk * 1;
      const p = (x, y) => [X + x, Y + y];
      const leg = (hx, hy, fx, z, m, bend) => {
        const k = [hx + bend, hy + 8];
        B.cap(hx, hy, k[0], k[1], 2.2, 1.3, m, z);
        B.cap(k[0], k[1], X + fx, -2, 1.2, 0.9, m, z + 0.01);
        B.ell(X + fx + 0.4, -1, 1.4, 1.1, P.hoof, z + 0.02);
      };
      leg(...p(6, -19), 7 + atk * 3, 0.4, P.fur, -0.5);
      leg(...p(-8, -19), -9 - atk * 2, 0.4, P.fur, 1.5);
      // 体
      const gb = B.group();
      B.ell(...p(-1, -23), 11.5, 7, P.fur, 1, { g: gb, rot: -0.06 });
      B.ell(...p(0, -19.5), 9, 3, P.light, 1.02, { g: B.group(), bulge: 0.4 });
      // 背のまだら
      [[-6, -27], [-2, -28.5], [2, -27.5], [-4, -24.5], [0.5, -25], [-9, -24.5]].forEach(([x, y]) => B.ell(...p(x, y), 1.1, 0.8, P.light, 1.05, { noAO: true }));
      // 尾
      B.ell(...p(-12, -26), 2, 2.6, P.light, 0.95, { rot: 0.6 });
      leg(...p(7, -19), 8.5 + atk * 4, 1.2, P.fur, -0.8);
      leg(...p(-7, -19), -6.5 - atk * 3, 1.2, P.fur, 1.8);
      // 首と頭
      const hd = p(11 + atk * 2, -35 + atk * 3 + hit * 1.5);
      B.cap(...p(6, -26), hd[0] - 1.5, hd[1] + 2, 3.8, 2.8, P.fur, 1.5);
      const gh = B.group();
      B.ell(hd[0], hd[1], 4.4, 3.9, P.fur, 2, { g: gh });
      B.cap(hd[0] + 1.5, hd[1] + 1, hd[0] + 6.5, hd[1] + 2.3, 2.3, 1.4, P.fur, 2.02, { g: gh });
      B.ell(hd[0] + 6.8, hd[1] + 2.2, 0.9, 0.8, P.hoof, 2.05);
      // 耳
      B.ell(hd[0] - 3.8, hd[1] - 2, 3, 1.4, P.fur, 1.9, { rot: -0.5 - hit * 0.6 });
      B.ell(hd[0] - 2.5, hd[1] - 3, 3.2, 1.5, P.fur, 2.1, { rot: -0.7 - hit * 0.6, g: B.group() });
      // 角と花
      const antler = (bx, a, z) => {
        const t1 = [bx + S(a) * 6, hd[1] - 3 - C(a) * 6];
        B.cap(bx, hd[1] - 3, t1[0], t1[1], 0.8, 0.55, P.antler, z);
        const t2 = [t1[0] + S(a - 0.7) * 3.5, t1[1] - C(a - 0.7) * 3.5], t3 = [t1[0] + S(a + 0.7) * 3, t1[1] - C(a + 0.7) * 3];
        B.cap(...t1, ...t2, 0.55, 0.4, P.antler, z); B.cap(...t1, ...t3, 0.55, 0.4, P.antler, z);
        return [t2, t3, t1];
      };
      const tips = antler(hd[0] - 1.8, -0.3, 1.85).concat(antler(hd[0] - 0.2, 0.15, 2.15));
      const flower = (x, y, r, z) => {
        for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5 + 0.3; B.ell(x + C(a) * r * 0.8, y + S(a) * r * 0.7, r * 0.7, r * 0.5, P.petal, z, { rot: a, bulge: 0.7, noAO: true }); }
        B.ell(x, y, r * 0.4, r * 0.4, P.mid, z + 0.01, { noAO: true });
      };
      [[0, 2.2], [1, 1.8], [3, 2.4], [4, 1.8]].forEach(([i, r], k) => flower(tips[i][0], tips[i][1], r, 2.3 + k * 0.01));
      B.ell(tips[2][0] - 1.5, tips[2][1] + 1.2, 1.6, 0.8, P.leaf, 2.25, { rot: 0.5 });
      B.ell(tips[5][0] + 1.2, tips[5][1] + 1, 1.6, 0.8, P.leaf, 2.26, { rot: -0.5 });
      // 目
      const ex = hd[0] + 1.3, ey = hd[1] - 0.2;
      if (hit > 0.5) B.cap(ex - 1.2, ey, ex + 1, ey + 0.4, 0.4, 0.4, P.eye, 2.3);
      else { B.ell(ex, ey, 1.2, 1.5, P.eye, 2.3); B.rect(ex - 0.5, ey - 1, 1, 1, P.white, 2.31); }
      return { head: [hd[0] + 2, hd[1] - 2], center: p(0, -24), fx: p(3, -26), eye: [ex, ey], eyes: [[ex, ey, 1.4]], top: tips[4], back: p(-3, -30), body: [X - 1, Y - 23, 11, 7], u: 1, z: 2.4 };
    },
  };

  // ------------------------------------------------------------------ どんぐり王子（S）
  RARE.rare_acorn = {
    tier: 's', h: 33,
    pal: {
      nut: { keys: ['#2a1022', '#5a2428', '#8c4a2e', '#b8743a', '#dca45a', '#f4d090'], n: 7, spec: 1, specPow: 9, wrap: 0.3, amb: 0.18 },
      cap: { keys: ['#1e1224', '#3a2630', '#5e4234', '#86663e', '#a88a56'], n: 6, tex: 3.2, tsx: 1.1, tsy: 1.1, wrap: 0.3, amb: 0.15 },
      cape: { keys: ['#2a0a2a', '#5a1030', '#962038', '#c83a44', '#e87060'], n: 6, wrap: 0.35, amb: 0.18, tex: 0.5, tsx: 1.4, tsy: 0.3 },
      gold: { keys: ['#3a1e08', '#7a4a14', '#c08a2c', '#f0c860', '#fff4c0'], n: 6, metal: true, spec: 1, specPow: 10, fixed: true },
      jewel: { keys: ['#0a2a6a', '#2060d0', '#70b0ff', '#e0f0ff'], n: 4, spec: 1, glow: '#80c0ff', fixed: true, noGold: true },
      leg: { keys: ['#2a1a24', '#4a3234', '#6c5040'], n: 4 },
      leaf: { keys: ['#1a3a2a', '#2a6a3a', '#50a04c', '#90d070'], n: 5, wrap: 0.4 },
      blush: { keys: ['#e07868', '#f09a88'], n: 2, flat: true, fixed: true },
      eye: EYE, white: WHITE, mouth: { keys: ['#4a1420', '#7a2c34'], n: 2, flat: true, fixed: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2) * 0.05, atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 5 - hit * 3, hop = atk * 3 + Math.max(0, br) * 6;
      const tilt = atk * 0.25 - hit * 0.3;
      const p = (x, y) => [X + x - y * tilt * 0.3, -hop + y];
      // マント（後ろ）
      B.poly([p(-5, -18), p(3, -19), p(1, -6), p(-9, -3 - br * 10), p(-11, -8)], P.cape, 0.5, { bevel: 2 });
      // 足
      B.cap(...p(-2.5, -4), X - 3 - atk, -1.2 - hop * 0.2, 1.3, 1.1, P.leg, 0.8);
      B.cap(...p(2.5, -4), X + 3 + atk * 2, -1.2 - hop * 0.2, 1.3, 1.1, P.leg, 1.3);
      B.ell(X - 3.2 - atk, -0.8 - hop * 0.2, 1.8, 1, P.leg, 0.81);
      B.ell(X + 3.6 + atk * 2, -0.8 - hop * 0.2, 1.8, 1, P.leg, 1.31);
      // 実
      const gn = B.group();
      B.ell(...p(0, -12), 8, 9.5, P.nut, 1, { g: gn });
      B.poly([p(-2, -3.5), p(2, -3.5), p(0, -1.2)], P.nut, 1.01, { g: gn, bevel: 1 });
      // 顔（右寄り）
      const ex = p(3.2, -12)[0], ey = -hop - 12;
      [[ex, 1.2, 1.6], [ex + 3.2, 1.0, 1.4]].forEach(([x, w, h]) => {
        if (hit > 0.5) B.cap(x - w, ey, x + w, ey + 0.4, 0.4, 0.4, P.eye, 1.3);
        else { B.ell(x, ey, w, h, P.eye, 1.3); B.rect(x - w * 0.5, ey - h * 0.7, 1, 1, P.white, 1.31); }
      });
      B.ell(ex - 1.5, ey + 2.8, 1.3, 0.7, P.blush, 1.25, { noOutline: true });
      B.ell(ex + 4.8, ey + 2.6, 1.0, 0.6, P.blush, 1.25, { noOutline: true });
      if (atk > 0.5) B.ell(ex + 1.6, ey + 3.4, 1.2, 1, P.mouth, 1.3);
      else B.cap(ex + 0.8, ey + 3.2, ex + 2.6, ey + 3.4, 0.45, 0.45, P.mouth, 1.3);
      // 帽子（殻斗）と柄
      const gc = B.group();
      const cp = p(0, -20);
      B.ell(cp[0], cp[1], 9.2, 4.6, P.cap, 1.5, { g: gc, rot: tilt * 0.4 });
      B.ell(cp[0], cp[1] + 2.2, 8.6, 2.2, P.cap, 1.49, { g: gc, shadeOff: -1 });
      B.cap(cp[0] - 0.5, cp[1] - 4, cp[0] - 1.5, cp[1] - 7, 1.1, 0.8, P.leg, 1.55);
      // 小さな王冠
      const cr = [cp[0] + 2.5, cp[1] - 4.2];
      B.poly([[cr[0] - 3.2, cr[1] + 1.2], [cr[0] - 3.4, cr[1] - 2.2], [cr[0] - 1.7, cr[1] - 0.6], [cr[0], cr[1] - 3], [cr[0] + 1.7, cr[1] - 0.6], [cr[0] + 3.4, cr[1] - 2.2], [cr[0] + 3.2, cr[1] + 1.2]], P.gold, 1.7, { bevel: 0.8 });
      B.ell(cr[0], cr[1] - 0.2, 0.9, 0.9, P.jewel, 1.72);
      // しゃく（葉の付いた小枝）
      const hand = p(8 + atk * 3, -10 - atk * 2);
      B.cap(...p(5.5, -11), hand[0], hand[1], 1, 0.9, P.nut, 1.4);
      B.cap(hand[0], hand[1] + 3, hand[0] + 1 + atk * 2, hand[1] - 8 - atk, 0.6, 0.5, P.leg, 1.41);
      B.ell(hand[0] + 2.2 + atk * 2, hand[1] - 8.5 - atk, 1.8, 1, P.leaf, 1.42, { rot: -0.6 });
      return { head: [cp[0] + 3, cp[1] + 2], center: p(0, -12), fx: p(2, -12), eye: [ex, ey], eyes: [[ex, ey, 1.4], [ex + 3.2, ey, 1.2]], top: [cr[0], cr[1] - 3], back: p(-4, -20), hand, body: [X, -hop - 12, 8, 9.5], u: 0.9, z: 1.8 };
    },
  };

  BZ.RARE_IDS = ['hd:mon:rare_hare', 'hd:mon:rare_fawn', 'hd:mon:rare_acorn'];
  BZ.bakeRare = function (id, opts, asJob) {
    const b = RARE[id];
    if (!b) return null;
    opts = opts || {};
    const px = BZ.targetPx(b.tier, 1, 0.62);
    return BZ.bakeSheet({ draw: b.draw, pal: b.pal, golden: !!opts.golden, px, fly: !!b.fly, frames: BZ.monFrames(b),
      meta: { kind: 'mon', id, base: id, stage: 1, tier: b.tier, rare: true, golden: !!opts.golden, targetPx: Math.round(px) } }, asJob);
  };
  for (const id of Object.keys(RARE)) (BZ._pending = BZ._pending || []).push(['hd:mon:' + id, (opts) => BZ.bakeRare(id, opts, true), { kind: 'mon', owner: 'BEAST', rare: true }]);
})(window.RPG);
