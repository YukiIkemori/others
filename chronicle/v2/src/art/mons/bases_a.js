// BEAST: 魔物の土台（右向き・足元が原点・+x が前）その 1 — jelly rat seabird crab bat bee
// 土台 = {tier: 's'|'m'|'l', h: モデルの高さ, pal: 素材の組, draw(B, P, st) → 点の表}。
// st = {t: 待機の位相 0〜1, atk: 攻撃 0〜1（前へ伸びる）, hit: 被弾 0〜1（後ろへのけぞる）, stage: 系統の段, golden}。
// 点の表は部品（parts.js）と anchors（head・center・fx…）に使う。u は部品の大きさの目安（モデル単位）。
// 影の色相は明るい段から −30〜−60° ずらす（STYLE_REFERENCE §4.2・§4.3）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const BASES = (BZ.BASES = BZ.BASES || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  // 共通の小さな素材（色替え・金色の外）
  const EYE = { keys: ['#0e0a1c', '#1c1830'], n: 2, flat: true, fixed: true, noGold: true };
  const WHITE = { keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true };
  const GUMS = { keys: ['#4a1428', '#8a3044'], n: 2, flat: true, fixed: true };
  const TOOTH = { keys: ['#b8b0a0', '#fff8ea'], n: 2, flat: true, fixed: true, noGold: true };
  BZ.COMMON = { EYE, WHITE, GUMS, TOOTH };

  // ------------------------------------------------------------------ jelly ゼリー（S）
  BASES.jelly = {
    tier: 's', h: 30,
    pal: {
      body: { keys: ['#16123e', '#1a3a5e', '#1a6670', '#2a9084', '#52b89c', '#9ee0c4'], n: 8, spec: 1, specPow: 8, wrap: 0.5, amb: 0.25, rim: '#e0f8ff', rimK: 0.8, alpha: 0.94 },
      core: { keys: ['#1a1450', '#3c3c9c', '#7aa0e0', '#c8f0ff', '#ffffff'], n: 6, wrap: 0.6, amb: 0.4, alpha: 0.94, ao: 0 },
      hi: { keys: ['#c8f4e4', '#effff8'], n: 2, flat: true },
      eye: EYE, white: WHITE, mouth: { keys: ['#3a1030', '#6a2444'], n: 2, flat: true, fixed: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2) * 0.07, atk = st.atk || 0, hit = st.hit || 0;
      const sx = 1 + br + atk * 0.22 - hit * 0.12, sy = 1 - br - atk * 0.12 + hit * 0.12;
      const X = atk * 6 - hit * 5, Y = -atk * 3, lean = atk * 0.25 - hit * 0.2;
      const g = B.group();
      B.ell(X, Y - 12.5 * sy, 15.5 * sx, 12.5 * sy, P.body, 1, { g });
      B.ell(X - 1.5 * sx + lean * 10, Y - 21 * sy, 9.5 * sx, 8 * sy, P.body, 1.01, { g, rot: -0.2 + lean });
      B.ell(X, -3.5, 17 * sx, 3.8, P.body, 1.02, { g, bulge: 0.6 });
      B.ell(X + 1 * sx, Y - 6.5 * sy, 11 * sx, 4.2 * sy, P.body, 1.05, { g: B.group(), bulge: 0.2, shadeOff: 2, noAO: true });
      B.ell(X - 4 * sx, Y - 12 * sy, 3.2, 3, P.core, 1.1, { g: B.group(), bulge: 0.8 });
      [[-10, -9, 1.1], [7, -22, 0.8]].forEach(([x, y, r]) => B.ell(X + x * sx, Y + y * sy, r, r, P.body, 1.2, { g: B.group(), shadeOff: 2, noAO: true }));
      // 顔（右寄り＝前）
      const ey = Y - 13.5 * sy;
      [[4.5, 3.8, 2.4], [11.4, 3.2, 1.7]].forEach(([x, h, w]) => {
        const ex = X + x * sx;
        if (hit > 0.5) { B.cap(ex - w, ey - h * 0.2, ex + w, ey + h * 0.3, 0.6, 0.6, P.eye, 1.3); return; }
        B.ell(ex, ey, w, h, P.eye, 1.3);
        B.rect(ex - w * 0.2, ey - h * 0.7, 1, 1, P.white, 1.31);
        B.rect(ex - w * 0.1, ey + h * 0.35, 1, 1, P.hi, 1.31);
      });
      if (atk > 0.5) B.ell(X + 8.5 * sx, Y - 8 * sy, 2.2, 1.6, P.mouth, 1.3);
      else B.cap(X + 6.5 * sx, Y - 8.4 * sy, X + 10 * sx, Y - 8.6 * sy, 0.55, 0.55, P.eye, 1.3);
      // つや
      B.ell(X - 7 * sx, Y - 22 * sy, 3.4, 1.7, P.white, 1.4, { rot: -0.5, noOutline: true });
      B.ell(X - 11.5 * sx, Y - 17.5 * sy, 1.1, 1.1, P.white, 1.4);
      return { head: [X + 7 * sx, Y - 16 * sy], center: [X, Y - 12 * sy], fx: [X + 2, Y - 13 * sy], eye: [X + 4.5 * sx, ey], top: [X - 1.5 * sx, Y - 29 * sy],
        back: [X - 6 * sx, Y - 24 * sy], body: [X, Y - 12.5 * sy, 15.5 * sx, 12.5 * sy], u: 1.2, z: 1.5 };
    },
  };

  // ------------------------------------------------------------------ rat ネズミ（S）
  BASES.rat = {
    tier: 's', h: 23,
    pal: {
      fur: { keys: ['#1c1430', '#3a2a40', '#5e4a50', '#86705e', '#ac9676', '#d2c0a0'], n: 7, wrap: 0.3, amb: 0.14, tex: 1.8, tsx: 0.4, tsy: 1.2 },
      furDk: { keys: ['#161026', '#2e2034', '#4a3a44', '#6a5854', '#8c7a6a'], n: 6, wrap: 0.3, amb: 0.12, tex: 1.6, tsx: 0.4, tsy: 1.2 },
      belly: { keys: ['#3a2a3c', '#6a5860', '#9c8c84', '#c8bca8', '#ece2cc'], n: 6, wrap: 0.4, amb: 0.2 },
      pink: { keys: ['#4a1c34', '#86404e', '#bc6c6c', '#e4a094', '#f6ccbc'], n: 6, wrap: 0.4, amb: 0.2, fixed: true },
      eye: EYE, white: WHITE, tooth: TOOTH, gums: GUMS,
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0, s2 = st.stage >= 2;
      const X = atk * 4 - hit * 3, Y = -br * 0.35 - atk * 1.5;
      const p = (x, y) => [X + x, Y + y];
      // 尾
      const tw = S(st.t * PI * 2 + 1.3) * 1.5;
      B.strand([p(-11, -5), p(-20, -10 + tw), p(-27, -4 + tw), p(-31, -8 + tw)], 1.3, 0.45, P.pink, 0.3, { seg: 10 });
      // 奥の脚
      B.cap(...p(-4, -5), X - 3 - atk, -0.9, 2.2, 1.6, P.furDk, 0.5);
      B.ell(X + 5 + atk * 2, -1, 2.2, 1.1, P.pink, 0.51);
      // 体
      const gb = B.group();
      B.ell(...p(-5, -8), 8, 7, P.fur, 1, { g: gb });
      B.ell(...p(2, -9), 8, 6.5, P.fur, 1.01, { g: gb, rot: -0.15 });
      B.ell(...p(0, -4.5), 8, 3.2, P.belly, 1.02, { g: B.group(), bulge: 0.5 });
      B.fold(...p(-10, -13), ...p(3, -15), 1.2, gb, -1);
      // 手前の後ろ脚（もも）と足
      B.ell(...p(-7, -6.5), 5.2, 5, P.fur, 1.1, { g: B.group() });
      B.ell(X - 4 - atk * 2, -1, 3.6, 1.3, P.pink, 1.12);
      [[-1.5, 0], [0.5, -0.2]].forEach(([dx]) => B.rect(X - 2.2 - atk * 2 + dx, -1.2, 1, 1, P.furDk, 1.13));
      // 前脚
      B.cap(...p(6, -6), X + 7.5 + atk * 3, -1.2, 1.8, 1.3, P.fur, 1.15);
      B.ell(X + 8.3 + atk * 3, -0.9, 1.9, 1, P.pink, 1.16);
      // 頭
      const hd = p(10 + atk * 2 - hit, -12 + hit * 0.5);
      const gh = B.group();
      B.ell(hd[0], hd[1], 6, 5.2, P.fur, 2, { g: gh, rot: -0.2 });
      B.cap(hd[0] + 2, hd[1] + 0.5, hd[0] + 8, hd[1] + 2.2, 3.4, 1.6, P.fur, 2.05, { g: gh });
      B.ell(hd[0] + 1, hd[1] + 3, 4, 2.2, P.belly, 2.02, { g: B.group(), bulge: 0.4 });
      B.ell(hd[0] + 8.6, hd[1] + 2.1, 1.3, 1.1, P.pink, 2.2);
      // 耳（大きく丸い）
      const ea = hit * 0.6;
      B.ell(hd[0] - 3.5, hd[1] - 5, 3.4, 4.4, P.fur, 1.95, { rot: -0.4 - ea });
      B.ell(hd[0] - 1.2, hd[1] - 5.5, 3.6, 4.6, P.fur, 2.1, { g: B.group(), rot: -0.25 - ea });
      B.ell(hd[0] - 1.0, hd[1] - 5.3, 2.2, 3.1, P.pink, 2.11, { rot: -0.25 - ea });
      // 口と歯
      const op = Math.max(atk, hit * 0.3);
      if (op > 0.3) B.ell(hd[0] + 6, hd[1] + 4, 2.2, 1.2 + op, P.gums, 2.12);
      B.rect(hd[0] + 6.4, hd[1] + 3.4, 1, 1.4 + (s2 ? 1.2 : 0), P.tooth, 2.15);
      B.rect(hd[0] + 5.2, hd[1] + 3.4, 1, 1.2 + (s2 ? 0.8 : 0), P.tooth, 2.14);
      // 目
      const ex = hd[0] + 3.4, ey = hd[1] - 0.8;
      if (hit > 0.5) B.cap(ex - 1.3, ey, ex + 1.2, ey + 0.4, 0.45, 0.45, P.eye, 2.3);
      else { B.ell(ex, ey, 1.3, 1.5, P.eye, 2.3); B.rect(ex - 0.6, ey - 1, 1, 1, P.white, 2.31); }
      // ひげ
      [[-0.8, 0.2], [0.4, 0.6]].forEach(([dy, k]) => B.cap(hd[0] + 7, hd[1] + 1.4 + dy, hd[0] + 11.5, hd[1] + 0.4 + dy + k * 2, 0.28, 0.2, P.belly, 2.25, { noAO: true }));
      return { head: [hd[0] + 3, hd[1] - 2], center: p(-1, -8), fx: p(3, -9), eye: [ex, ey], eyes: [[ex, ey, 1.4]], mouth: [hd[0] + 6, hd[1] + 4],
        back: p(-3, -15), spine: [p(2, -15), p(-4, -15.5), p(-9, -14)], top: [hd[0] - 1, hd[1] - 10], body: [X - 2, Y - 8, 10, 7], u: 0.8, z: 2.4 };
    },
  };

  // ------------------------------------------------------------------ bat コウモリ（S、飛ぶ）
  BASES.bat = {
    tier: 's', h: 44, vis: 32, fly: true,
    pal: {
      fur: { keys: ['#1a1030', '#34203e', '#523046', '#76464e', '#9a6660', '#c09080'], n: 7, wrap: 0.3, amb: 0.16, tex: 1.6, tsx: 0.5, tsy: 1.2 },
      wing: { keys: ['#180e2a', '#2e1a3c', '#4a2a4c', '#6a3e5a', '#8c5a6c'], n: 6, wrap: 0.5, amb: 0.2, alpha: 0.97 },
      bone: { keys: ['#120a20', '#261634', '#3e2644', '#5a3a52'], n: 5, wrap: 0.3 },
      inner: { keys: ['#4a1c34', '#86404e', '#bc6c6c', '#e4a094'], n: 5, fixed: true },
      eye: { keys: ['#f0c040', '#fff4b0'], n: 2, flat: true, glow: '#ffd060', fixed: true, noGold: true },
      tooth: TOOTH, gums: GUMS,
    },
    draw(B, P, st) {
      const fl = st.hit ? 0.55 : st.atk ? 0.85 : (st.t < 0.25 || st.t >= 0.75 ? 0 : 1);   // 0 = 羽を上、1 = 下
      const atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 6 - hit * 4, Y = -26 + fl * 2 + atk * 4 - hit * 1;
      const p = (x, y) => [X + x, Y + y];
      // 羽: 肩 → ひじ → 指先 3 本、後ろの縁は波形
      const wing = (side, z) => {
        const sgn = side;   // 1 = 手前（右上）、-1 = 奥（左上）
        const up = 1 - fl;
        const sh = p(sgn * 2.5, -3);
        const el = p(sgn * 10, -9 - up * 6 + fl * 4);
        const tips = [p(sgn * 22, -16 - up * 8 + fl * 10), p(sgn * 24, -6 - up * 4 + fl * 12), p(sgn * 18, 2 + fl * 8)];
        const tail = p(sgn * 5, 5);
        const pts = [sh, el, tips[0], [(tips[0][0] + tips[1][0]) / 2 - sgn * 2.5, (tips[0][1] + tips[1][1]) / 2 + 1], tips[1],
          [(tips[1][0] + tips[2][0]) / 2 - sgn * 2.5, (tips[1][1] + tips[2][1]) / 2 + 1.5], tips[2], [(tips[2][0] + tail[0]) / 2, (tips[2][1] + tail[1]) / 2 + 1], tail];
        const g = B.group();
        B.poly(pts, P.wing, z, { g, bevel: 2.5, ny: -0.1, nx: -sgn * 0.15 });
        B.cap(sh[0], sh[1], el[0], el[1], 1.3, 1.0, P.bone, z + 0.01);
        tips.forEach((tp) => B.cap(el[0], el[1], tp[0], tp[1], 0.7, 0.4, P.bone, z + 0.01));
        B.poly([[el[0], el[1]], [el[0] + sgn * 1.5, el[1] - 2.5], [el[0] + sgn * 2.2, el[1] - 0.5]], P.bone, z + 0.02, { bevel: 0.5 });
      };
      wing(-1, 0.4);
      // 体
      const gb = B.group();
      B.ell(...p(0, 0), 6, 7, P.fur, 1, { g: gb });
      B.ell(...p(1, 2.5), 4, 4, P.fur, 1.01, { g: gb, shadeOff: 1 });
      // 足
      B.cap(...p(-1.5, 6), X - 2.5, Y + 9.5, 0.8, 0.6, P.bone, 0.9);
      B.cap(...p(1.5, 6), X + 1.5, Y + 9.8, 0.8, 0.6, P.bone, 0.9);
      // 頭と耳
      const hd = p(3.5 + atk * 1.5, -8 + hit * 1);
      B.poly([[hd[0] - 4, hd[1] - 2], [hd[0] - 6, hd[1] - 12 + hit * 3], [hd[0] - 0.5, hd[1] - 4]], P.fur, 1.4, { bevel: 1.2 });
      B.ell(hd[0], hd[1], 5, 4.6, P.fur, 1.5, { g: B.group() });
      const ge = B.group();
      B.poly([[hd[0] - 0.5, hd[1] - 3], [hd[0] + 2.5, hd[1] - 13 + hit * 3], [hd[0] + 4.5, hd[1] - 2.5]], P.fur, 1.6, { g: ge, bevel: 1.4 });
      B.poly([[hd[0] + 0.8, hd[1] - 3.5], [hd[0] + 2.5, hd[1] - 10.5 + hit * 3], [hd[0] + 3.4, hd[1] - 3.5]], P.inner, 1.61, { bevel: 0.8 });
      B.ell(hd[0] + 4, hd[1] + 1.2, 2.2, 1.8, P.fur, 1.62, { g: B.group() });
      const op = Math.max(atk, hit * 0.4);
      if (op > 0.3) B.ell(hd[0] + 4.3, hd[1] + 3, 1.6, 0.8 + op, P.gums, 1.63);
      B.rect(hd[0] + 3.4, hd[1] + 2.6, 1, 1.6, P.tooth, 1.66);
      B.rect(hd[0] + 5.0, hd[1] + 2.6, 1, 1.4, P.tooth, 1.66);
      const ex = hd[0] + 2.2, ey = hd[1] - 0.6;
      if (hit > 0.5) B.cap(ex - 1.1, ey, ex + 1.1, ey + 0.3, 0.4, 0.4, P.bone, 1.7);
      else B.ell(ex, ey, 1.2, 1.3, P.eye, 1.7);
      wing(1, 2);
      return { head: [hd[0] + 2, hd[1] - 2], center: p(0, 0), fx: p(1, -2), eye: [ex, ey], eyes: [[ex, ey, 1.3]], mouth: [hd[0] + 4, hd[1] + 3],
        back: p(-2, -4), top: [hd[0] + 2, hd[1] - 12], body: [X, Y, 6, 7], u: 0.8, z: 2.5 };
    },
  };

  // ------------------------------------------------------------------ bee ハチ（S、飛ぶ）
  BASES.bee = {
    tier: 's', h: 40, vis: 27, fly: true,
    pal: {
      yel: { keys: ['#3a1428', '#7a3a24', '#b8742a', '#e0a834', '#f4d060', '#fff0a8'], n: 7, wrap: 0.35, amb: 0.18 },
      fuzz: { keys: ['#2a1426', '#5a3024', '#96602c', '#c89040', '#ecc070', '#fce6b0'], n: 6, wrap: 0.4, amb: 0.2, tex: 2.2, tsx: 1.2, tsy: 1.2 },
      dark: { keys: ['#140e20', '#261a30', '#3a2a40', '#54404e'], n: 5, wrap: 0.3 },
      wing: { keys: ['#6a7ea8', '#a8c0e0', '#dceaf8', '#ffffff'], n: 4, wrap: 0.8, amb: 0.5, alpha: 0.55, ao: 0, fixed: true, noGold: true },
      eye: { keys: ['#120c22', '#281e40', '#443868', '#7a6aa0'], n: 4, spec: 1, specPow: 6, fixed: true },
      white: WHITE,
    },
    draw(B, P, st) {
      const fl = st.t < 0.5 ? 0 : 1, atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 5 - hit * 4, Y = -24 + S(st.t * PI * 2) * 1.2 - atk * 1 + hit;
      const p = (x, y) => [X + x, Y + y];
      const tilt = atk * 0.35 - hit * 0.2;
      // 奥の羽
      B.ell(...p(-2, -9 - fl * 1.5), 6.5, 2.6, P.wing, 0.3, { rot: -1.1 + fl * 0.5, bulge: 0.3, noAO: true });
      // 脚
      [[-1, 0.4], [1.5, 0.5], [3.5, 0.6]].forEach(([x], i) => B.strand([p(x, 3), p(x - 1, 6.5), p(x - 2 + i, 8.5)], 0.6, 0.4, P.dark, 0.8));
      // 腹（しま）と針
      const ga = B.group();
      const ab = p(-7.5 - atk * 1, 1.5 + atk * 1.5);
      B.ell(ab[0], ab[1], 8.2, 5.8, P.yel, 1, { g: ga, rot: 0.35 + tilt });
      [-3.8, -7.2, -10.6].forEach((dx) => { const c0 = p(dx + 2.5 - atk, -4), c1 = p(dx - 1.5 - atk, 7); B.fold(c0[0], c0[1], c1[0], c1[1], 1.25, ga, -4); });
      const sg = p(-15.5 - atk * 2, 5.5 + atk * 2.5);
      B.poly([[sg[0] + 2.5, sg[1] - 2.2], [sg[0] - 3.2 - atk * 2, sg[1] + 2 + atk], [sg[0] + 2.8, sg[1] + 0.8]], P.dark, 0.95, { bevel: 0.6 });
      // 胸（毛）
      B.ell(...p(1.5, -1.5), 5.2, 5.0, P.fuzz, 1.2, { g: B.group() });
      // 頭
      const hd = p(7 + atk * 1.5, -3 + hit);
      B.ell(hd[0], hd[1], 4.3, 4.2, P.yel, 1.4, { g: B.group() });
      B.ell(hd[0] + 1.6, hd[1] - 0.6, 2.4, 2.9, P.eye, 1.45);
      B.rect(hd[0] + 1.2, hd[1] - 2.2, 1, 1, P.white, 1.46);
      B.strand([[hd[0] - 0.5, hd[1] - 3.5], [hd[0] + 1, hd[1] - 8], [hd[0] + 4.5, hd[1] - 9.5]], 0.5, 0.4, P.dark, 1.3);
      B.strand([[hd[0] + 1, hd[1] - 3.2], [hd[0] + 3.5, hd[1] - 7], [hd[0] + 6.5, hd[1] - 7.2]], 0.5, 0.4, P.dark, 1.5);
      B.ell(hd[0] + 3.8, hd[1] + 3, 1.3, 0.9, P.dark, 1.47);
      // 手前の羽
      B.ell(...p(-0.5, -9.5 + fl * 1.5), 7.5, 3.0, P.wing, 2, { rot: -0.95 + fl * 0.55, bulge: 0.3, noAO: true });
      return { head: [hd[0] + 1, hd[1] - 2], center: p(-2, 0), fx: p(0, -1), eye: [hd[0] + 1.6, hd[1] - 0.6], eyes: [[hd[0] + 1.6, hd[1] - 0.6, 2]],
        stinger: [sg, [-1, 0.5]], back: p(-4, -6), top: p(0, -16), body: [ab[0], ab[1], 8, 6], u: 0.8, z: 2.2 };
    },
  };

  // ------------------------------------------------------------------ crab カニ（M）
  BASES.crab = {
    tier: 'm', h: 30,
    pal: {
      shell: { keys: ['#2a1030', '#581c34', '#8c3032', '#bc5638', '#de8a4c', '#f2bc80'], n: 7, spec: 0.6, specPow: 10, wrap: 0.25, amb: 0.14, tex: 0.8, tsx: 0.6, tsy: 0.6 },
      leg: { keys: ['#24102a', '#4a1a30', '#78302e', '#a8503a', '#cc7a4c'], n: 6, wrap: 0.3, amb: 0.14 },
      belly: { keys: ['#3a2032', '#6a4040', '#a07058', '#d0a47c', '#f0d4a8'], n: 6, wrap: 0.4 },
      eye: { keys: ['#120c1c', '#221a2e'], n: 2, flat: true, fixed: true }, white: WHITE, gums: GUMS,
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 3 - hit * 3, Y = -br * 0.5 + hit * 1;
      const p = (x, y) => [X + x, Y + y];
      const leg = (hx, hy, kx, ky, fx, z, m) => { const g = B.group(); B.cap(...p(hx, hy), ...p(kx, ky), 1.8, 1.4, m, z, { g }); B.cap(...p(kx, ky), X + fx, -0.4, 1.4, 0.6, m, z + 0.01, { g }); };
      // 奥の脚
      [[-8, -8, -14, -12, -17], [-3, -8, -8, -13, -10], [2, -8, 1, -12, -2]].forEach(([a, b, c, d, e]) => leg(a, b, c, d, e, 0.4, P.leg));
      // 奥のはさみ（小さく、上げている）
      const fc = p(12 + atk * 2, -20 - atk * 2);
      B.cap(...p(7, -13), fc[0] - 2, fc[1] + 3, 2.2, 1.8, P.leg, 0.5);
      B.ell(fc[0], fc[1], 4.2, 2.8, P.shell, 0.55, { g: B.group(), rot: -0.4 });
      B.ell(fc[0] + 2.5, fc[1] + 2.5, 2.6, 1.2, P.shell, 0.56, { g: B.group(), rot: 0.3 });
      // 甲羅
      const gs = B.group();
      B.ell(...p(0, -13), 14.5, 8.5, P.shell, 1, { g: gs });
      B.ell(...p(-1, -16.5), 11, 5, P.shell, 1.01, { g: gs, bulge: 0.7 });
      B.ell(...p(1, -7.5), 12, 3, P.belly, 1.02, { g: B.group(), bulge: 0.4 });
      B.fold(...p(-10, -18), ...p(9, -19), 0.9, gs, 1);
      // 目の柄と目
      const eh = hit * 3;
      [[6, 0], [10, 0.6]].forEach(([x, dz], i) => {
        const b0 = p(x, -19), t0 = p(x + 1 + i * 0.5, -25 + eh);
        B.cap(b0[0], b0[1], t0[0], t0[1], 0.9, 0.8, P.leg, 1.1 + dz);
        B.ell(t0[0], t0[1] - 0.6, 1.7, 1.8, P.eye, 1.2 + dz);
        if (!(hit > 0.5)) B.rect(t0[0] - 0.4, t0[1] - 1.6, 1, 1, P.white, 1.21 + dz);
      });
      // 口
      B.ell(...p(12.5, -11), 2, 1.3 + atk * 0.8, P.gums, 1.05);
      // 手前の脚
      [[-9, -7, -15, -9, -18.5], [-4, -6, -9, -10, -11.5], [1, -6, -1, -9, -3.5], [5, -6, 7, -9, 5.5]].forEach(([a, b, c, d, e]) => leg(a, b, c, d, e, 1.4, P.leg));
      // 手前のはさみ（大きい）
      const ang = -0.25 - atk * 0.5 + hit * 0.4, open = atk * 0.6 + 0.15;
      const arm = p(10, -10), el = [arm[0] + 5, arm[1] - 1.5 - atk * 2], cl = [el[0] + 5 + atk * 3, el[1] - 2 - atk * 1.5];
      B.cap(arm[0], arm[1], el[0], el[1], 2.4, 2.2, P.leg, 1.6);
      B.cap(el[0], el[1], cl[0] - 2, cl[1] + 1, 2.3, 2.4, P.leg, 1.61);
      const gcl = B.group();
      B.ell(cl[0], cl[1], 5.5, 4, P.shell, 1.7, { g: gcl, rot: ang });
      B.ell(cl[0] + 5 * C(ang - open), cl[1] + 5 * S(ang - open) - 1.2, 3.8, 1.8, P.shell, 1.72, { g: B.group(), rot: ang - open });
      B.ell(cl[0] + 4.5 * C(ang + open), cl[1] + 4.5 * S(ang + open) + 1.8, 3.4, 1.5, P.shell, 1.71, { g: B.group(), rot: ang + open });
      return { head: p(9, -20), center: p(0, -13), fx: p(4, -14), eye: p(10.5, -25.5 + eh), eyes: [[...p(6.5, -25.6 + eh), 1.6], [...p(11.3, -25.6 + eh), 1.6]],
        shell: [X, Y - 14, 14, 8.5], back: p(-3, -21), top: p(0, -21.5), claw: cl, body: [X, Y - 13, 14, 8], u: 1, z: 1.9 };
    },
  };

  // ------------------------------------------------------------------ seabird カモメ（M、飛ぶ）
  BASES.seabird = {
    tier: 'm', h: 48, vis: 40, fly: true,
    pal: {
      white: { keys: ['#2a2848', '#56587a', '#8c90a8', '#bcc0cc', '#e2e2e2', '#fbfaf2'], n: 7, wrap: 0.4, amb: 0.2, tex: 0.9, tsx: 0.5, tsy: 1.4 },
      grey: { keys: ['#1a1a34', '#34364e', '#54586c', '#7a7e8c', '#a2a6b0'], n: 6, wrap: 0.35, amb: 0.16, tex: 1.4, tsx: 0.4, tsy: 1.4 },
      tip: { keys: ['#120e22', '#221c34', '#383046', '#4c4458'], n: 5, wrap: 0.3 },
      beak: { keys: ['#5a2a10', '#a4641c', '#e0a830', '#f8d868'], n: 5, wrap: 0.4, amb: 0.3, fixed: true },
      foot: { keys: ['#5a2418', '#a45028', '#e08a40', '#f4b870'], n: 5, fixed: true },
      red: { keys: ['#7a1420', '#c83030'], n: 2, flat: true, fixed: true },
      eye: EYE, whiteF: WHITE,
    },
    draw(B, P, st) {
      const up = st.hit ? 0.4 : st.atk ? 0.2 : (st.t < 0.5 ? 1 : 0.35), atk = st.atk || 0, hit = st.hit || 0;
      const X = atk * 7 - hit * 4, Y = -30 + (1 - up) * 1.5 + atk * 5 - hit * 1;
      const p = (x, y) => [X + x, Y + y];
      const tilt = atk * 0.35 - hit * 0.25;
      const wing = (side, z) => {
        const sh = p(side * 1.5 - 1, -4);
        const el = p(-5 + side * 2, -12 - up * 6 + atk * 6);
        const tp = p(-16 + side * 4 + atk * 4, -20 - up * 12 + atk * 14 + hit * 6);
        const g = B.group();
        B.poly([sh, [el[0] + 4, el[1] - 1], [tp[0] + 2, tp[1]], tp, [tp[0] - 1, tp[1] + 5], [el[0] - 5, el[1] + 5], p(-8, -1)], P.grey, z, { g, bevel: 2.5, ny: -0.3 });
        B.poly([[tp[0] + 2, tp[1]], tp, [tp[0] - 1, tp[1] + 5], [tp[0] + 2.5, tp[1] + 3.5]], P.tip, z + 0.01, { bevel: 1 });
        for (let i = 0; i < 4; i++) B.cap(el[0] - 1 - i * 1.6, el[1] + 3 + i * 0.6, el[0] - 4 - i * 2.2, el[1] + 7 + i * 0.3, 1.0, 0.5, P.grey, z + 0.02, { shadeOff: -1 });
        B.cap(sh[0], sh[1], el[0] + 3, el[1], 2.0, 1.4, P.white, z + 0.03, { g: B.group(), shadeOff: 1 });
      };
      wing(-1, 0.4);
      // 足
      B.cap(...p(-2, 3), X - 3.5 - atk * 3, Y + 8, 0.7, 0.5, P.foot, 0.8);
      B.ell(X - 4 - atk * 3, Y + 8.3, 1.6, 0.8, P.foot, 0.81);
      // 尾
      B.poly([p(-9, -2), p(-17, -1 + tilt * 6), p(-16, 3 + tilt * 6), p(-8, 2)], P.white, 0.9, { bevel: 1.5 });
      B.poly([p(-14, -0.8 + tilt * 6), p(-17, -1 + tilt * 6), p(-16, 3 + tilt * 6), p(-14.2, 2.6 + tilt * 6)], P.tip, 0.91, { bevel: 0.6 });
      // 体
      const gb = B.group();
      B.ell(...p(-1, 0), 9.5, 5.8, P.white, 1, { g: gb, rot: -0.12 + tilt });
      B.ell(...p(-3, -3.5), 7, 3, P.grey, 1.01, { g: B.group(), rot: -0.1 + tilt, bulge: 0.5 });
      // 頭とくちばし
      const hd = p(8.5 + atk * 2, -5 + atk * 2 + hit * 1);
      B.ell(hd[0], hd[1], 4.6, 4.2, P.white, 1.3, { g: B.group() });
      const op = Math.max(atk * 0.8, hit * 0.3);
      B.cap(hd[0] + 3, hd[1] + 0.3, hd[0] + 9.5, hd[1] + 1.4 + atk * 1.5, 1.4, 0.55, P.beak, 1.35);
      B.cap(hd[0] + 3, hd[1] + 1.2 + op, hd[0] + 8.5, hd[1] + 2.2 + op * 2, 1.0, 0.45, P.beak, 1.34);
      B.rect(hd[0] + 7, hd[1] + 1.8 + op, 1, 1, P.red, 1.36);
      const ex = hd[0] + 1.5, ey = hd[1] - 1;
      if (hit > 0.5) B.cap(ex - 1, ey, ex + 1, ey + 0.4, 0.4, 0.4, P.eye, 1.4);
      else { B.ell(ex, ey, 1.0, 1.1, P.eye, 1.4); B.rect(ex - 0.4, ey - 0.9, 1, 1, P.whiteF, 1.41); }
      wing(1, 2);
      return { head: [hd[0] + 2, hd[1] - 2], center: p(-1, -2), fx: p(2, -2), eye: [ex, ey], eyes: [[ex, ey, 1.1]], mouth: [hd[0] + 7, hd[1] + 1.5],
        wings: [p(-12, -16), p(-8, -22)], back: p(-2, -6), top: p(-12, -26), body: [X - 1, Y, 9.5, 6], u: 1, z: 2.5 };
    },
  };
})(window.RPG);
