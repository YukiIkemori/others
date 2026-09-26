// BEAST: 戦闘背景 forest（夜の森の空き地。ヴェルダの森の原野・街道・迷いの森）— MODERN_UI の見本 battle.png の方向
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const def = {
    mood: 'forest_night', ambient: 'rgb(86,92,152)', geo: { clearRx: 16 },
    bake(g, L, c) {
      const { W, H, RZ } = c, R_ = RZ.rng(41), s = g.s;
      // ---- back: 空・遠くの尾根・森の縁（夜の色で焼き済み）
      const back = K.mk(W, H), bx = back.getContext('2d');
      K.nightSky(bx, W, g.GT + 20 * s, { moon: [W * 0.33, 64 * s, 20 * s], auroraY: 0.32, auroraW: 0.75, seed: 5 });
      const far = K.cliff(g, { seed: 11, base: 186, h0: 60, h1: 38, amp: 40, strata: 7, rock: ['#6c5a58', '#7e6a64', '#927c70', '#a88e7c', '#bca08a'], top: ['#6a6a4a', '#7e7c56', '#948e62'], haze: '#e8dcc8', hz: 0.55, trees: 60, treeS: 0.8 });
      bx.drawImage(K.soften(K.tint(far.canvas, '#3a4c86', 'rgba(60,80,140,0.25)'), 2), 0, 0);
      // 森の縁（針葉樹の列 2 段）
      for (const [row, n, h0, dy, tint] of [[0, 34, 26, 0, '#2c3a66'], [1, 26, 38, 8, '#232e56']]) {
        const cv = K.mk(W, H), cx = cv.getContext('2d'), B = new RZ.Builder();
        for (let i = 0; i < n * W / 960; i++) {
          const x = (i + R_() * 0.8) / (n * W / 960) * (W + 40) - 20;
          const skip = Math.abs(x - W * 0.5) < W * (row ? 0.06 : 0.02) && R_() < 0.6;
          if (skip) continue;
          K.conifer(B, x, g.GT - (row ? 1 : 5) * s - R_() * 2 * s, (h0 + R_() * h0 * 0.7) * s, R_, 1 + row);
        }
        K.blit(cx, RZ.render(B, { outline: false, light: K.LIGHT, sat: 0.7, tones: 5 }), 0, 0);
        bx.drawImage(K.soften(K.tint(cv, tint, row ? null : 'rgba(70,90,150,0.18)'), row ? 0.8 : 1.6), 0, 0);
      }
      // 地平の霞
      const hz = bx.createLinearGradient(0, g.GT - 40 * s, 0, g.GT);
      hz.addColorStop(0, 'rgba(120,140,200,0)'); hz.addColorStop(1, 'rgba(120,140,200,0.3)');
      bx.fillStyle = hz; bx.fillRect(0, g.GT - 40 * s, W, 40 * s);
      bx.clearRect(0, g.GT, W, H - g.GT);
      // ---- ground: 草地と空き地（昼の色）
      const ground = K.ground(g, { a: ['#2a2c18', '#43441f', '#5e5a2a', '#7a7138', '#978a4a', '#b6a664'], b: ['#3a2618', '#5a3c24', '#7a5634', '#9a7248', '#b89060', '#d6b27c'], seed: 4, far: [150, 160, 186], farK: 0.7 });
      const gx = ground.getContext('2d');
      { const B = new RZ.Builder(), n = Math.round(260 * W / 960 * H / 540);
        for (let i = 0; i < n; i++) {
          const y = g.GT + 6 * s + Math.pow(R_(), 0.7) * (H - g.GT - 6 * s), x = R_() * W, z = K.yToZ(g, y), u = (x - g.cx) * z / g.UD * 12, v = z * 12;
          if (1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) > -0.12) continue;
          K.tuft(B, x, y, (2 + R_() * 3) * K.scaleAt(g, y) * s, R_, y);
        }
        K.blit(gx, RZ.render(B, { light: K.LIGHT, sat: 0.45, tint: [10, 4, -6, 16, 8, -10], tones: 5, olMix: 0.82 }), 0, 0); }
      // ランタン
      const lr = K.lantern(1.3 * K.scaleAt(g, L.lantern.y) * s / 1.205);
      K.blit(gx, lr, L.lantern.x, L.lantern.y);
      // ---- front: 下の手前の岩と草（ぼかす）
      const front = K.mk(W, H), fx = front.getContext('2d');
      { const B = new RZ.Builder(), nr = Math.round(8 * W / 960);
        for (let i = 0; i < nr; i++) { const x = R_() * (W + 20) - 10; if (Math.abs(x - W * 0.55) < W * 0.2) continue; K.rock(B, x, H + 2 + R_() * 4, (9 + R_() * 11) * s, R_, 450 + i, R_() < 0.5); }
        for (let i = 0; i < nr * 1.6; i++) { const x = R_() * (W + 8); if (Math.abs(x - W * 0.55) < W * 0.16) continue; K.tuft(B, x, H, (8 + R_() * 8) * s, R_, 460); }
        K.blit(fx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.9 }), 0, 0); }
      const frontB = K.soften(front, 3.5);
      // ---- post: 光る茸・蛍・ランタンの芯とにじみ（加算）
      const post = K.mk(W, H), px = post.getContext('2d');
      for (let i = 0; i < Math.round(22 * W / 960); i++) {
        const y = g.GT + 20 * s + R_() * (H - g.GT - 30 * s), x = R_() * W, z = K.yToZ(g, y), u = (x - g.cx) * z / g.UD * 12, v = z * 12;
        if (1 - Math.hypot((u - g.clearU) / g.clearRx, (v - 16.8) / 3.6) > -0.25) continue;
        const sc = K.scaleAt(g, y), col = R_() < 0.7 ? [110, 240, 230] : [190, 150, 255];
        for (let k = 0; k < 3; k++) {
          const qx = Math.round(x + (R_() - 0.5) * 8 * sc), qy = Math.round(y + (R_() - 0.5) * 3 * sc);
          px.fillStyle = K.rgba(col, 0.9); px.fillRect(qx - 1, qy - 2, 2, 1);
          K.glow(px, qx, qy - 2, 7 * sc, col, 0.4);
        }
      }
      K.fireflies(px, Math.round(22 * W / 960), [0, g.GT, W, H - g.GT - 40 * s], 7, [[255, 200, 110], [140, 240, 220]]);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 100 * s, [255, 190, 110], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 20 * s, [255, 240, 200], 0.85);
      return { back, ground, front: frontB, post };
    },
  };
  (K._defs = K._defs || []).push(['forest', def]);
})(window.RPG);
