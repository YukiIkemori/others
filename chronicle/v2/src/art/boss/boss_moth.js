// BEAST: ボス ダストウィング（tr_b_moth）— hd:boss:boss_moth
// 灰と藤色のりん粉をまとった大きな蛾。手前の前翅の大きな目玉模様が視線の的（そこだけ彩度を上げる）。
// 予告の構え tele: 「羽が光る」— 翅を高く広げ、目玉模様と翅の縁が光り、りん粉が舞い上がる（次の手番に眠りのりん粉）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  const spec = {
    tier: 'boss', at: 0.45, h: 92, vis: 84, fly: true,
    pal: {
      wing: { keys: ['#241a3a', '#463a5c', '#6e6078', '#978a94', '#bcb0ac', '#ddd4c6'], n: 7, wrap: 0.5, amb: 0.22, tex: 1.6, tsx: 0.4, tsy: 0.4 },
      wingDk: { keys: ['#1a1230', '#2e2446', '#4a3c5c', '#6a5a70', '#8a7a86'], n: 6, wrap: 0.45, amb: 0.2, tex: 1.4, tsx: 0.4, tsy: 0.4 },
      band: { keys: ['#2a1a2a', '#5a3a44', '#8a6050', '#b8905c', '#dcc088'], n: 6, wrap: 0.45 },
      fuzz: { keys: ['#2a2036', '#4c4052', '#7a6c70', '#a89a8e', '#d4c8b4', '#f0e8d6'], n: 7, wrap: 0.45, amb: 0.22, tex: 2.6, tsx: 1.2, tsy: 1.2 },
      body: { keys: ['#1e1628', '#3a2e40', '#5c4c58', '#827070', '#a8968a'], n: 6, wrap: 0.35, amb: 0.16, tex: 1.2, tsx: 0.6, tsy: 1.4 },
      spot: { keys: ['#2a0c3a', '#6a1c6a', '#b04098', '#e878c0'], n: 5, wrap: 0.5, fixed: true },
      ring: { keys: ['#6a3a10', '#c07a1c', '#f0b640', '#ffe890'], n: 5, wrap: 0.5, fixed: true, noGold: true },
      core: { keys: ['#0a2a4a', '#1a6aa0', '#40b8e8', '#b0f0ff'], n: 5, spec: 1, specPow: 5, fixed: true, noGold: true },
      glow: { keys: ['#60e0ff', '#e8ffff'], n: 2, flat: true, glow: '#a0f4ff', fixed: true, noGold: true },
      dust: { keys: ['#c8b8f0', '#fff8ff'], n: 2, flat: true, glow: '#e0d0ff', noGold: true },
      eye: { keys: ['#0a0a1a', '#2a2a4a', '#5a5a8a', '#a0a0d0'], n: 4, spec: 1, specPow: 6, fixed: true },
      white: { keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true },
    },
    draw(B, P, st) {
      const atk = st.atk || 0, hit = st.hit || 0, tele = st.tele || 0;
      const fl = tele ? (st.t < 0.5 ? 0 : 0.25) : (st.t < 0.5 ? 0 : 1);
      const X = atk * 10 - hit * 6, Y = -54 + S(st.t * PI * 2) * 2 - tele * 5 + atk * 4;
      const p = (x, y) => [X + x, Y + y];
      const up = 1 - fl * 0.6 + tele * 0.25 - hit * 0.3;
      // 翅: 付け根 → 前縁 → 先 → 外縁（波）→ 後ろ
      const wing = (side, fore, z, m) => {
        const root = fore ? p(-2, -6) : p(-4, 0);
        const ang = fore ? (-1.95 + (1 - up) * 0.8 + side * 0.35) : (-2.6 + (1 - up) * 0.6 + side * 0.25);
        const L = fore ? 46 : 32;
        const tip = [root[0] + C(ang) * L, root[1] + S(ang) * L];
        const back = fore ? [root[0] - 26, root[1] + 10 - (1 - up) * 8] : [root[0] - 18, root[1] + 16];
        const mid = [(tip[0] + back[0]) / 2, (tip[1] + back[1]) / 2];
        const bulge = fore ? 9 : 8;
        const nx = -(back[1] - tip[1]), ny = back[0] - tip[0], nl = Math.hypot(nx, ny) || 1;
        const out = [mid[0] - nx / nl * bulge, mid[1] - ny / nl * bulge];
        const pts = [root, [root[0] + C(ang) * L * 0.5 + 2, root[1] + S(ang) * L * 0.5 - 3], tip, [tip[0] * 0.7 + out[0] * 0.3, tip[1] * 0.7 + out[1] * 0.3], out, [out[0] * 0.6 + back[0] * 0.4, out[1] * 0.6 + back[1] * 0.4 + 2], back, [root[0] - 6, root[1] + 6]];
        const g = B.group();
        B.poly(pts, m, z, { g, bevel: 4, nx: side * 0.15, ny: -0.2 });
        // 翅脈の帯
        B.fold(root[0], root[1], tip[0], tip[1], 1.2, g, -1.4);
        B.fold(root[0], root[1], out[0], out[1], 0.9, g, -1);
        B.fold(root[0], root[1], back[0] * 0.8 + root[0] * 0.2, back[1] * 0.8 + root[1] * 0.2, 0.9, g, -1);
        // 外縁の帯
        for (let k = 0; k < 4; k++) { const t = 0.2 + k * 0.2; const a = [tip[0] * (1 - t) + out[0] * t, tip[1] * (1 - t) + out[1] * t]; B.ell(a[0], a[1], 2.8, 1.8, P.band, z + 0.01, { noAO: true, rot: ang }); }
        return { root, tip, out, back, mid, ang };
      };
      // 奥の翅（後翅 → 前翅）
      wing(-1, false, 0.2, P.wingDk);
      const farF = wing(-1, true, 0.3, P.wingDk);
      // 触角（羽状）
      const hd = p(9 + atk * 3, -8 + hit * 2);
      [[0.3, -1], [1.3, 1]].forEach(([dx, k], i) => {
        const a0 = [hd[0] + dx, hd[1] - 3], a1 = [hd[0] + 6 + i * 3, hd[1] - 16 - i * 2], a2 = [hd[0] + 13 + i * 4, hd[1] - 20 - tele * 3];
        B.strand([a0, a1, a2], 0.7, 0.4, P.body, 1.2 + i);
        for (let j = 1; j < 6; j++) { const t = j / 6, x = a0[0] * (1 - t) * (1 - t) + 2 * a1[0] * (1 - t) * t + a2[0] * t * t, y = a0[1] * (1 - t) * (1 - t) + 2 * a1[1] * (1 - t) * t + a2[1] * t * t; B.cap(x, y, x - 2.2, y - 1.6, 0.45, 0.2, P.body, 1.21 + i); }
      });
      // 腹（節）
      const ga = B.group();
      const ab = p(-12 - atk * 2, 6 + hit * 2);
      B.ell(ab[0], ab[1], 13, 6.5, P.body, 1, { g: ga, rot: 0.35 });
      for (let k = 0; k < 4; k++) { const x = ab[0] + 7 - k * 5, y = ab[1] - 3 + k * 1.6; B.fold(x, y - 6, x - 1.5, y + 6, 0.9, ga, -1.5); }
      // 胸（毛）と首の毛
      B.ell(...p(0, 0), 9.5, 9, P.fuzz, 1.3, { g: B.group() });
      B.ell(...p(5, -5), 6.5, 6, P.fuzz, 1.35, { g: B.group(), shadeOff: 0.5 });
      // 脚
      for (let k = 0; k < 3; k++) B.strand([p(-1 + k * 3, 6), p(1 + k * 3, 12), p(3 + k * 4 + atk * 3, 17 - k)], 0.9, 0.5, P.body, 1.1 + k * 0.01);
      // 頭と目
      B.ell(hd[0], hd[1], 5.5, 5, P.fuzz, 1.6, { g: B.group() });
      B.ell(hd[0] + 2.5, hd[1] + 0.5, 3.4, 3.8, P.eye, 1.65);
      if (!(hit > 0.5)) { B.rect(hd[0] + 1.6, hd[1] - 1.8, 1, 1, P.white, 1.66); B.rect(hd[0] + 2.6, hd[1] - 1.8, 1, 1, P.white, 1.66); }
      B.strand([[hd[0] + 3, hd[1] + 3.5], [hd[0] + 5, hd[1] + 7], [hd[0] + 3.5, hd[1] + 9.5]], 0.6, 0.35, P.body, 1.64);
      // 手前の翅（後翅 → 前翅）と目玉模様
      wing(1, false, 2.0, P.wing);
      const F = wing(1, true, 2.2, P.wing);
      const sp = [F.root[0] * 0.38 + F.tip[0] * 0.3 + F.out[0] * 0.32, F.root[1] * 0.38 + F.tip[1] * 0.3 + F.out[1] * 0.32];
      B.ell(sp[0], sp[1], 8.5, 7.5, P.spot, 2.3, { rot: F.ang + PI / 2, noAO: true });
      B.ell(sp[0], sp[1], 6, 5.2, P.ring, 2.31, { rot: F.ang + PI / 2, noAO: true });
      B.ell(sp[0] + 0.5, sp[1], 3.6, 3.2, tele ? P.glow : P.core, 2.32, { noAO: true });
      B.rect(sp[0] - 1.4, sp[1] - 1.6, 1, 1, P.white, 2.33);
      // 翅の縁のりん粉の光（予告）
      if (tele) {
        [F.tip, F.out, farF.tip, farF.out].forEach((q, i) => B.ell(q[0], q[1], 2.6, 2.6, P.glow, 2.4 + i * 0.001, { noAO: true }));
      }
      // 舞うりん粉
      const Rr = BZ.rz().rng(21 + Math.round(st.t * 10) + (tele ? 5 : 0));
      const nd = 10 + tele * 16 + atk * 8;
      for (let i = 0; i < nd; i++) {
        const x = tele ? X - 30 + Rr() * 80 : atk ? X + 10 + Rr() * 50 : X - 40 + Rr() * 80;
        const y = tele ? Y - 50 + Rr() * 60 : Y - 20 + Rr() * 60;
        B.rect(x, y, 1, 1, P.dust, 2.5);
      }
      return { head: [hd[0] + 2, hd[1] - 2], center: p(-2, 0), fx: p(2, -2), eye: sp, eyes: [[hd[0] + 2.5, hd[1] + 0.5, 3]], top: F.tip, wings: [F.tip, farF.tip], body: [X - 4, Y, 12, 9], u: 2, z: 2.6 };
    },
  };
  (BZ._bossDefs = BZ._bossDefs || []).push(['boss_moth', spec]);
})(window.RPG);
