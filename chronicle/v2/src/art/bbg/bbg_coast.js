// BEAST: 戦闘背景 coast（半島の夜の浜。zw_prologue・zw_peninsula）
// 月の照り返しの海・遠くの岬と灯台の影・波打ち際の濡れた砂。地面は昼の色の砂で、環境光（mood coast）を掛ける。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const def = {
    mood: 'coast', ambient: 'rgb(104,114,190)', geo: { clearRx: 18, gt: 200 },
    bake(g, L, c) {
      const { W, H, RZ } = c, R_ = RZ.rng(52), s = g.s, { vnoise, clamp, mix, ramp } = RZ;
      // ---- back: 空・海・岬と灯台
      const back = K.mk(W, H), bx = back.getContext('2d');
      const mx = W * 0.62, my = 58 * s;
      K.nightSky(bx, W, g.GT, { moon: [mx, my, 18 * s], auroraY: 0.26, auroraW: 0.5, auroraK: 0.6, seed: 8, stops: ['#050a1c', '#0c1a3a', '#1c2e58', '#34486e'] });
      // 岬（左奥）と灯台
      const cape = K.cliff(g, { seed: 21, base: 176, h0: 36, h1: 0, curve: 0.55, amp: 14, strata: 6, rock: ['#2a2432', '#3e3446', '#544656', '#6a5a66'], top: ['#2c3a2c', '#3a4c34', '#4c5e3e'], haze: '#8a9ac0', hz: 0.35 });
      bx.drawImage(K.tint(cape.canvas, '#39457a', 'rgba(60,80,140,0.2)'), 0, 0);
      { const lx = Math.round(W * 0.12), ly = Math.round(176 * s - 30 * s);
        bx.fillStyle = '#1c2038'; bx.fillRect(lx - 3, ly - 22 * s, 6, 22 * s); bx.fillRect(lx - 4, ly - 25 * s, 8, 3);
        bx.fillStyle = '#3a3050'; bx.fillRect(lx - 2, ly - 20 * s, 1, 18 * s); }
      // 海（地平から浜の縁まで）
      const seaTop = Math.round(g.GT - 20 * s), seaBot = g.GT;
      const sea = bx.createImageData(W, seaBot - seaTop), D = sea.data;
      const S_ = ramp(['#0a1230', '#12204a', '#1c3264', '#2c4a80', '#4a6a9c'], 6);
      for (let y = 0; y < seaBot - seaTop; y++) for (let x = 0; x < W; x++) {
        const t = y / (seaBot - seaTop), wv = vnoise(x * 0.05 / (0.3 + t), y * 0.6, 3) + vnoise(x * 0.2, y * 1.4, 4) * 0.4;
        let col = S_[clamp(Math.round((0.25 + t * 0.35 + (wv - 0.7) * 0.5) * 5), 0, 5)];
        const dm = Math.abs(x - mx) / (W * 0.03 + t * W * 0.1);
        if (dm < 1 && vnoise(x * 0.3, y * 2.2, 5) > 0.45 + dm * 0.4) col = mix(col, [230, 236, 255], 0.75 - dm * 0.4);
        if (vnoise(x * 0.12, y * 3, 6) > 0.86) col = mix(col, [180, 196, 230], 0.5);
        const q = (y * W + x) * 4; D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
      }
      bx.putImageData(sea, 0, seaTop);
      // ---- ground: 砂（波打ち際は濡れて暗く、泡の線）
      const ground = K.ground(g, {
        a: ['#5a4838', '#7a644c', '#9a8260', '#b8a07a', '#d0ba92', '#e6d4ae'], b: ['#6a5640', '#8a7456', '#a88e6a', '#c4aa82', '#dac49c', '#eedcb6'], seed: 9, far: [120, 128, 160], farK: 0.5,
        pebHi: [230, 220, 200], pebLo: [120, 104, 90],
        pix: (col, u, v, cl, px, py) => {
          const wet = clamp((v - 19.5 + vnoise(u * 0.3, 0, 7) * 1.2) / 1.2, 0, 1);
          if (wet > 0) col = mix(col, [70, 72, 92], wet * 0.7);
          const foam = Math.abs(v - 19.4 - vnoise(u * 0.4, 1, 8) * 1.2);
          if (foam < 0.07 && vnoise(u * 1.3, v * 2, 9) > 0.35) col = mix(col, [220, 228, 240], 0.45);
          return col;
        },
      });
      const gx = ground.getContext('2d');
      { const B = new RZ.Builder();
        // 流木と岩
        const drift = K.EM('bark', { keys: ['#2a2024', '#4a3a34', '#6c5a48', '#8e7a60', '#b0a080'] });
        B.cap(W * 0.1, H * 0.74, W * 0.24, H * 0.7, 3.5 * s, 2.5 * s, drift, 1);
        B.cap(W * 0.2, H * 0.71, W * 0.22, H * 0.66, 1.5 * s, 1 * s, drift, 1.01);
        K.rock(B, W * 0.86, H * 0.58, 12 * s, R_, 2, true);
        K.rock(B, W * 0.04, H * 0.6, 9 * s, R_, 2, false);
        for (let i = 0; i < 26 * W / 960; i++) { const x = R_() * W, y = g.GT + 60 * s + R_() * (H - g.GT - 60 * s); if (Math.abs(x - W * 0.5) < W * 0.28 && y < H * 0.9) continue; K.tuft(B, x, y, (3 + R_() * 3) * s * K.scaleAt(g, y), R_, y, K.EM('grass', { keys: ['#2a2a18', '#4a4a24', '#6e6a34', '#948a48', '#b8aa66', '#dccc90'] })); }
        K.blit(gx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.7 }), 0, 0); }
      const lr = K.lantern(1.3 * K.scaleAt(g, L.lantern.y) * s / 1.205);
      K.blit(gx, lr, L.lantern.x, L.lantern.y);
      // ---- front: 手前の砂丘の草（ぼかす）
      const front = K.mk(W, H), fx = front.getContext('2d');
      { const B = new RZ.Builder(), sand = K.EM('grass', { keys: ['#2a2a18', '#4a4a24', '#6e6a34', '#948a48', '#b8aa66', '#dccc90'] });
        for (let i = 0; i < 14 * W / 960; i++) { const x = R_() * (W + 8); if (Math.abs(x - W * 0.55) < W * 0.18) continue; K.tuft(B, x, H + 2, (10 + R_() * 9) * s, R_, 460, sand); }
        K.blit(fx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      // ---- post: 海のきらめき・灯台の灯・ランタン
      const post = K.mk(W, H), px = post.getContext('2d');
      for (let i = 0; i < 40; i++) { const x = mx + (R_() - 0.5) * W * 0.12, y = seaTop + R_() * (seaBot - seaTop); px.fillStyle = K.rgba([230, 240, 255], 0.5 + R_() * 0.4); px.fillRect(Math.round(x), Math.round(y), 1 + (R_() < 0.3 ? 1 : 0), 1); }
      K.glow(px, W * 0.12, 176 * s - 30 * s - 23 * s, 26 * s, [255, 220, 150], 0.6);
      K.glow(px, W * 0.12, 176 * s - 30 * s - 23 * s, 5 * s, [255, 250, 220], 0.9);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 100 * s, [255, 190, 110], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 20 * s, [255, 240, 200], 0.85);
      return { back, ground, front: K.soften(front, 3.5), post };
    },
  };
  (K._defs = K._defs || []).push(['coast', def]);
})(window.RPG);
