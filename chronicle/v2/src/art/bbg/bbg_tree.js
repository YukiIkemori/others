// BEAST: 戦闘背景 tree（千年樹の根元。z_elder、根食らい tr_b_rooteater の bg 'tree'）
// 奥いっぱいの巨木の幹と大きな根、光る苔と胞子（青緑）、上の枝の間から星。地面は苔の土に根が走る。mood tree。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const def = {
    mood: 'tree', ambient: 'rgb(96,120,146)', geo: { clearRx: 14, gt: 212 },
    *bake(g, L, c) {
      const { W, H, RZ } = c, R_ = RZ.rng(74), s = g.s, { vnoise, clamp, mix, ramp } = RZ;
      yield* K.tick();
      // ---- back: 夜空（梢の間）・奥の木々・巨木の幹と根
      const back = K.mk(W, H), bx = back.getContext('2d');
      K.nightSky(bx, W, g.GT, { aurora: false, seed: 17, clouds: false, stops: ['#040a14', '#08142a', '#10223a', '#1a3044'] });
      // 奥の木々の影
      { const cv = K.mk(W, H), cx = cv.getContext('2d'), B = new RZ.Builder();
        for (let i = 0; i < 18 * W / 960; i++) K.roundTree(B, R_() * W, g.GT + 2 * s, (50 + R_() * 40) * s, R_, 1 + i * 0.01);
        K.blit(cx, yield* K.renderG(B, { outline: false, light: K.LIGHT, sat: 0.6, tones: 5 }), 0, 0);
        bx.drawImage(yield* K.softenG(K.tint(cv, '#1e3446', 'rgba(40,80,100,0.2)'), 1.5), 0, 0); }
      // 巨木の幹（画素で: 縦の樹皮の筋・円柱の陰）
      const bark = ramp(['#120e16', '#221a22', '#34282c', '#4a3a36', '#604c42', '#786050'], 8);
      const cxT = W * 0.56, topW = 150 * s, botW = 230 * s;
      const trunk = bx.getImageData(0, 0, W, g.GT), D = trunk.data;
      for (let y = 0; y < g.GT; y++) {
        if ((y & 3) === 0) yield* K.tick();
        const t = y / g.GT, hw = (topW + (botW - topW) * Math.pow(t, 2.2)) / 2 + vnoise(y * 0.05, 0, 3) * 8 * s;
        for (let x = Math.max(0, Math.floor(cxT - hw)); x < Math.min(W, cxT + hw); x++) {
          const u = (x - cxT) / hw;
          const ridge = vnoise(x * 0.09, y * 0.012, 4) * 0.6 + vnoise(x * 0.3, y * 0.05, 5) * 0.3;
          let l = 0.62 - Math.abs(u + 0.25) * 0.5 + (ridge - 0.45) * 0.55;
          if (vnoise(x * 0.14, y * 0.02, 6) > 0.72) l -= 0.25;
          let cc = bark[clamp(Math.round(l * 7), 0, 7)];
          // 光る苔の筋
          const moss = vnoise(x * 0.06, y * 0.04, 7);
          if (moss > 0.66 && u < 0.4) cc = mix(cc, [60, 150, 120], (moss - 0.66) * 2.2);
          cc = mix(cc, [30, 50, 70], 0.3);
          const q = (y * W + x) * 4; D[q] = cc[0]; D[q + 1] = cc[1]; D[q + 2] = cc[2]; D[q + 3] = 255;
        }
      }
      bx.putImageData(trunk, 0, 0);
      // うろ（中ほどの暗い口）と垂れた根・つる
      { const B = new RZ.Builder(), barkM = K.EM('bark', { keys: ['#120e16', '#241a22', '#3a2c2e', '#54403a', '#6e5646'] }), moss = K.EM('moss', { keys: ['#10221e', '#1c3c30', '#2e6048', '#4a8a5e', '#7ab488'] });
        B.ell(cxT - 10 * s, g.GT * 0.55, 22 * s, 34 * s, K.EM('stone', { keys: ['#08060c', '#100c14', '#18121c', '#20182a'] }), 1.5, { bulge: 0.2 });
        // 大きな根（幹から地平へ）
        [[-1, 0.9], [-0.7, 0.4], [-0.35, 0.3], [0.3, 0.35], [0.65, 0.5], [1, 1.1]].forEach(([d, k], i) => {
          const x0 = cxT + d * botW * 0.42, x1 = cxT + d * botW * (0.75 + k * 0.5);
          B.strand([[x0, g.GT - 46 * s], [x0 + d * 24 * s, g.GT - 16 * s], [(x0 + x1) / 2 + d * 20 * s, g.GT - 4 * s], [x1, g.GT + 1 * s]], 17 * s * (0.6 + k * 0.4), 3 * s, barkM, 2 + i * 0.01, { seg: 14 });
        });
        for (let i = 0; i < 9; i++) { const x = R_() * W; B.strand([[x, -4], [x + (R_() - 0.5) * 12 * s, 40 * s + R_() * 40 * s], [x + (R_() - 0.5) * 20 * s, 60 * s + R_() * 70 * s]], 1.6 * s, 0.8 * s, moss, 3 + i * 0.01, { seg: 8 }); }
        const r = yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.7 });
        const cv = K.mk(W, H); K.blit(cv.getContext('2d'), r, 0, 0);
        bx.drawImage(K.tint(cv, '#3e4c66'), 0, 0); }
      // 梢（上の暗い葉の天蓋）
      { const cv = K.mk(W, H), cx = cv.getContext('2d'), B = new RZ.Builder(), lf = K.EM('leaf', { keys: ['#06120e', '#0c2218', '#163424', '#224a30', '#346a40', '#4e8a50'] });
        for (let i = 0; i < 40 * W / 960; i++) { const x = R_() * W, y = -10 * s + R_() * 50 * s, r = (16 + R_() * 18) * s; if (Math.abs(x - W * 0.3) < 70 * s && y > 10 * s && R_() < 0.8) continue; B.ell(x, y, r, r * 0.7, lf, 1 + i * 0.001, { bulge: 0.85 }); }
        K.blit(cx, yield* K.renderG(B, { outline: false, light: K.LIGHT, sat: 0.7, tones: 5 }), 0, 0);
        bx.drawImage(K.tint(cv, '#3a4c66'), 0, 0); }
      bx.clearRect(0, g.GT, W, H - g.GT);
      yield* K.tick();
      // ---- ground: 苔の土と根
      const ground = yield* K.groundG(g, { a: ['#1e2418', '#2e3a22', '#40522c', '#566a36', '#708444', '#8ea058'], b: ['#2c2418', '#463824', '#624e32', '#7e6644', '#9a8058', '#b49c70'], seed: 19, far: [70, 96, 110], farK: 0.6 });
      const gx = ground.getContext('2d');
      { const B = new RZ.Builder(), barkM = K.EM('bark', { keys: ['#1a1216', '#32242a', '#4c3834', '#6a5040', '#886a50'] });
        // 地を這う根
        [[0.05, 0.62, 0.35, 0.72], [0.7, 0.66, 1.02, 0.6], [0.8, 0.9, 1.05, 0.95], [-0.02, 0.88, 0.2, 0.98]].forEach(([a, b, c2, d], i) => {
          const x0 = W * a, y0 = H * b, x1 = W * c2, y1 = H * d;
          B.strand([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 8 * s], [x1, y1]], 7 * s * K.scaleAt(g, y0), 3 * s, barkM, 1 + i * 0.01, { seg: 10 });
        });
        for (let i = 0; i < 40 * W / 960; i++) { const y = g.GT + 10 * s + R_() * (H - g.GT), x = R_() * W; if (Math.abs(x - W * 0.5) < W * 0.25 && y < H * 0.85) continue; K.tuft(B, x, y, (2 + R_() * 3) * s * K.scaleAt(g, y), R_, y, K.EM('grass', { keys: ['#0e2418', '#1a4024', '#2a602e', '#40803a', '#62a44a', '#94c86a'] })); }
        K.blit(gx, yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.75 }), 0, 0); }
      const lr = K.lantern(1.3 * K.scaleAt(g, L.lantern.y) * s / 1.205);
      K.blit(gx, lr, L.lantern.x, L.lantern.y);
      yield* K.tick();
      // ---- front: 手前のしだと根（ぼかす）
      const front = K.mk(W, H), fx = front.getContext('2d');
      { const B = new RZ.Builder(), fern = K.EM('leaf', { keys: ['#0a1c14', '#12341e', '#1e5028', '#32703a', '#50944c', '#80bc66'] });
        for (let i = 0; i < 10 * W / 960; i++) { const x = R_() * (W + 20) - 10; if (Math.abs(x - W * 0.55) < W * 0.22) continue;
          for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.6 + (R_() - 0.5) * 0.3, len = (22 + R_() * 18) * s; B.strand([[x, H + 4], [x + Math.sin(a) * len * 0.5, H - len * 0.6], [x + Math.sin(a) * len, H - len * 0.7 + 10 * s]], 4 * s, 1 * s, fern, 1 + k * 0.01, { seg: 6 }); } }
        K.blit(fx, yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      yield* K.tick();
      // ---- post: 青緑の胞子・光る茸・苔の光・ランタン
      const post = K.mk(W, H), px = post.getContext('2d');
      K.fireflies(px, Math.round(46 * W / 960), [0, 20 * s, W, H - 60 * s], 23, [[120, 255, 200], [160, 230, 255], [210, 255, 170]], 0.8);
      for (let i = 0; i < 14; i++) { const x = cxT + (R_() - 0.5) * botW * 0.9, y = g.GT * (0.3 + R_() * 0.6); K.glow(px, x, y, 10 * s, [90, 220, 170], 0.25); }
      for (let i = 0; i < Math.round(16 * W / 960); i++) {
        const y = g.GT + 16 * s + R_() * (H - g.GT - 40 * s), x = R_() * W;
        if (Math.abs(x - W * 0.5) < W * 0.2) continue;
        const sc = K.scaleAt(g, y); px.fillStyle = K.rgba([140, 255, 210], 0.9); px.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 1); K.glow(px, x, y - 2, 8 * sc, [110, 240, 200], 0.4);
      }
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 100 * s, [255, 190, 110], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 20 * s, [255, 240, 200], 0.85);
      return { back, ground, front: yield* K.softenG(front, 4), post };
    },
  };
  (K._defs = K._defs || []).push(['tree', def]);
})(window.RPG);
