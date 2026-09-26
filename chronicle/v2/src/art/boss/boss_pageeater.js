// BEAST: ボス ページ食らい（序章・灯台。tr_b_pageeater）— hd:boss:boss_pageeater
// 開いた古い本がそのまま口になった魔物。表紙の上の大きな目 1 つが視線の的（赤い虹彩だけ彩度を上げる、STYLE_REFERENCE §4.2）。
// 予告の構え tele: 「紙を吸いこんでいる……」— 口を半ば開き、紙が口へ渦を巻いて吸い込まれ、目が光る。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  const spec = {
    tier: 'boss', at: 0.3, h: 98,
    pal: {
      cover: { keys: ['#1e0a1e', '#3e1426', '#62202e', '#8a3a36', '#aa5e44', '#c8865a'], n: 7, wrap: 0.3, amb: 0.15, tex: 1.2, tsx: 0.5, tsy: 0.5, spec: 0.4, specPow: 14 },
      page: { keys: ['#3a2a3a', '#6e5a58', '#a89478', '#d4c4a0', '#efe4c8', '#fbf6e6'], n: 7, wrap: 0.4, amb: 0.2 },
      brass: { keys: ['#2a1608', '#5e3c14', '#9a7030', '#d0a858', '#f6e2a0'], n: 6, metal: true, spec: 1, specPow: 10 },
      ink: { keys: ['#120a1e', '#221638', '#382a58', '#54447c', '#76669e'], n: 6, spec: 1, specPow: 7, wrap: 0.3, amb: 0.14 },
      maw: { keys: ['#12061a', '#2a0c26', '#46142e', '#661e34'], n: 5, wrap: 0.3, fixed: true },
      ribbon: { keys: ['#3a0a1a', '#7a1828', '#b82c38', '#e05850'], n: 5, wrap: 0.35 },
      sclera: { keys: ['#8a7a70', '#d8ccb8', '#f6f0e2'], n: 4, wrap: 0.6, amb: 0.4, fixed: true, noGold: true },
      iris: { keys: ['#6a0818', '#c01830', '#f04040', '#ff9a70'], n: 4, spec: 1, specPow: 4, fixed: true, noGold: true },
      irisGlow: { keys: ['#ff3040', '#ffb080'], n: 2, flat: true, glow: '#ff6050', fixed: true, noGold: true },
      pupil: { keys: ['#140810', '#2a0e1a'], n: 2, flat: true, fixed: true, noGold: true },
      white: { keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true },
      lid: { keys: ['#2a0e1e', '#4a1a2a', '#6a2c36'], n: 4, fixed: true },
    },
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0, tele = st.tele || 0;
      const open = 0.22 + br * 0.06 + atk * 0.8 + tele * 0.45 - hit * 0.12;
      const X = atk * 10 - hit * 6, bob = br * 1.2 - tele * 2;
      const H = [X - 18, -56 + bob];
      const tilt = -hit * 0.12 + atk * 0.08;
      const L = 58, T = 12;
      const au = -0.38 - open * 0.34 + tilt, al = 0.22 + open * 0.24 + tilt;
      const du = [C(au), S(au)], nu = [S(au), -C(au)];
      const dl = [C(al), S(al)], nl = [-S(al), C(al)];
      const P2 = (b, d, n, a, k) => [b[0] + d[0] * a + n[0] * k, b[1] + d[1] * a + n[1] * k];
      // 足（墨の触手）
      for (let i = 0; i < 5; i++) {
        const bx = H[0] - 4 + i * 6, by = H[1] + 12 + i * 1.5;
        const fx = X - 36 + i * 13 + (i === 4 ? atk * 6 : 0), sw = S(st.t * PI * 2 + i) * 2;
        B.strand([[bx, by], [bx - 4 + sw, by + 14], [fx + 4, -8 + sw * 0.5], [fx, -0.8]], 3.4 - i * 0.2, 1.0, P.ink, 0.3 + i * 0.01, { seg: 9 });
      }
      // 口の中
      B.poly([H, P2(H, du, nu, L * 0.85, 0), P2(H, dl, nl, L * 0.85, 0)], P.maw, 0.5, { bevel: 4 });
      // しおりの舌
      const tg = P2(H, dl, nl, L * 0.5, -2);
      B.strand([P2(H, du, nu, 8, -3), [tg[0] + 6 + atk * 6, tg[1] - 4], [tg[0] + 16 + atk * 8, tg[1] + 6 + br], [tg[0] + 14 + atk * 10, tg[1] + 16]], 1.8, 1.4, P.ribbon, 0.8, { seg: 8 });
      // あご（下・上）: 紙の束・表紙・紙の歯
      const jaw = (d, n, z, upper) => {
        const g = B.group();
        B.poly([P2(H, d, n, 0, 0), P2(H, d, n, L, 0), P2(H, d, n, L - 1, T), P2(H, d, n, 0, T)], P.page, z, { g, bevel: 2.5, nx: n[0] * 0.3, ny: n[1] * 0.3 });
        for (let k = 1; k < 5; k++) { const a = P2(H, d, n, 3, k * T / 5), b = P2(H, d, n, L - 2, k * T / 5); B.fold(a[0], a[1], b[0], b[1], 0.45, g, -1.5); }
        const gc = B.group();
        B.poly([P2(H, d, n, -3, T - 0.5), P2(H, d, n, L + 3, T - 0.5), P2(H, d, n, L + 2, T + 4), P2(H, d, n, -3, T + 4)], P.cover, z + 0.05, { g: gc, bevel: 2.2, nx: n[0] * 0.5, ny: n[1] * 0.5 });
        B.fold(...P2(H, d, n, 6, T + 3.4), ...P2(H, d, n, L - 4, T + 3.4), 0.7, gc, -1);
        // 角の金具
        B.poly([P2(H, d, n, L - 6, T - 0.5), P2(H, d, n, L + 3, T - 0.5), P2(H, d, n, L + 2, T + 4), P2(H, d, n, L - 5, T + 4)], P.brass, z + 0.06, { bevel: 1.2 });
        // 紙の歯
        for (let k = 0; k < 7; k++) {
          const a = 12 + k * 6.5, w = 2.2, len = 4.5 + (k % 2) * 2.2;
          B.poly([P2(H, d, n, a - w, 0.4), P2(H, d, n, a + w, 0.4), P2(H, d, n, a + (k % 3 - 1) * 0.6, -len)], P.page, z + 0.07, { bevel: 0.7, noAO: true });
        }
      };
      jaw(dl, nl, 1, false);
      // 背（とじ）と金の帯
      const gs = B.group();
      B.cap(H[0] - 3, H[1] - 8, H[0] - 3, H[1] + 10, 8.5, 8.5, P.cover, 1.2, { g: gs });
      [-4, 5].forEach((dy) => B.cap(H[0] - 11, H[1] + dy, H[0] + 4, H[1] + dy, 1.3, 1.3, P.brass, 1.25));
      jaw(du, nu, 1.5, true);
      // 目（上の表紙の上）
      const eb = P2(H, du, nu, L * 0.5, T + 4);
      const ec = [eb[0] + nu[0] * 4.5, eb[1] + nu[1] * 4.5];
      B.ell(ec[0], ec[1] + 1.5, 10, 8, P.cover, 1.9, { g: B.group(), bulge: 0.8 });
      if (hit > 0.5) {
        B.ell(ec[0], ec[1], 7.4, 6.2, P.lid, 2.0);
        B.cap(ec[0] - 6.5, ec[1] + 0.5, ec[0] + 6.5, ec[1] + 1.2, 0.8, 0.8, P.pupil, 2.05);
      } else {
        B.ell(ec[0], ec[1], 7.4, 6.2, P.sclera, 2.0);
        const lx = ec[0] + 1.6 + atk * 0.8, ly = ec[1] + 0.4;
        B.ell(lx, ly, 3.8, 4.4, tele ? P.irisGlow : P.iris, 2.05);
        B.ell(lx + 0.3, ly, 0.9 + (tele ? 0 : 0.4), 3.2, P.pupil, 2.1);
        B.rect(lx - 2.2, ly - 3, 1, 1, P.white, 2.12); B.rect(lx - 1.4, ly - 3, 1, 1, P.white, 2.12);
        B.cap(ec[0] - 8, ec[1] - 5.5 - tele * 1.5, ec[0] + 7.5, ec[1] - 3.2 + atk * 1.5, 1.6, 1.2, P.lid, 2.15);
      }
      // 舞う紙（予告の間は口へ渦を巻く）
      const n = 7 + Math.round(tele * 9) + Math.round(atk * 4);
      const Rr = BZ.rz().rng(11 + Math.round(st.t * 10));
      const mouth = P2(H, du, nu, L * 0.7, -T * 0.3);
      for (let i = 0; i < n; i++) {
        let x, y;
        if (tele) { const a = i * 0.9 + st.t * 6, r = 10 + i * 3.2; x = mouth[0] + 8 + C(a) * r; y = mouth[1] + 16 + S(a) * r * 0.6; }
        else if (atk) { x = mouth[0] + 10 + Rr() * 45; y = mouth[1] + 10 + (Rr() - 0.5) * 40; }
        else { x = X - 40 + Rr() * 90; y = -100 + Rr() * 70; }
        const a = Rr() * PI, w = 2.6 + Rr() * 1.4, h = 1.8 + Rr();
        const c = [C(a), S(a)];
        B.poly([[x - c[0] * w - c[1] * h, y - c[1] * w + c[0] * h], [x + c[0] * w - c[1] * h, y + c[1] * w + c[0] * h], [x + c[0] * w + c[1] * h, y + c[1] * w - c[0] * h], [x - c[0] * w + c[1] * h * 0.4, y - c[1] * w - c[0] * h]],
          P.page, 2.3 + i * 0.001, { bevel: 0.6, nx: (Rr() - 0.5) * 0.6, noAO: true });
      }
      return { head: ec, center: [H[0] + 16, H[1] + 4], fx: [H[0] + 22, H[1] - 4], eye: ec, eyes: [[ec[0], ec[1], 4]], mouth, top: [ec[0], ec[1] - 8], body: [H[0] + 14, H[1], 28, 30], u: 2, z: 2.2 };
    },
  };
  (BZ._bossDefs = BZ._bossDefs || []).push(['boss_pageeater', spec]);
})(window.RPG);
