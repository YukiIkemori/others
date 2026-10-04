// BEAST: 戦闘背景 cave（洞窟・旅人の古井戸。z_well）
// 層の見える岩の壁、上から垂れる鍾乳石、青白く光る結晶の群れ、上の井戸の口から落ちる月明かりの筋。地面は岩と水たまり。mood cave。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const def = {
    mood: 'cave', ambient: 'rgb(122,106,188)', geo: { clearRx: 13, gt: 204 },
    *bake(g, L, c) {
      const { W, H, RZ } = c, R_ = RZ.rng(85), s = g.s, { vnoise, clamp, mix, ramp } = RZ;
      yield* K.tick();
      // ---- back: 岩の壁（画素。層・割れ目・奥ほど暗い）
      const back = K.mk(W, H), bx = back.getContext('2d');
      const rock = ramp(['#0e0c16', '#1a1624', '#282234', '#382f44', '#4a3e54', '#5e5066'], 8);
      const img = bx.createImageData(W, g.GT), D = img.data;
      const shaftX = W * 0.36;
      let CRY = [];
      for (let y = 0; y < g.GT; y++) { if ((y & 3) === 0) yield* K.tick(); for (let x = 0; x < W; x++) {
        const yy = y + vnoise(x * 0.008, 0, 3) * 40 * s + vnoise(x * 0.04, y * 0.01, 9) * 12 * s;
        const bhh = (9 + vnoise(0, Math.floor(yy / (14 * s)), 10) * 8) * s;
        const band = Math.floor(yy / bhh), bt = (yy % bhh) / bhh;
        const blk = vnoise(x * 0.018 + band * 2.7, band * 0.7, 4);
        let l = 0.3 + (blk - 0.5) * 0.5 + (bt < 0.14 ? 0.16 : bt > 0.88 ? -0.16 : 0) + (vnoise(x * 0.012, y * 0.02, 11) - 0.5) * 0.35 + vnoise(x * 0.25, y * 0.25, 5) * 0.12;
        if (vnoise(x * 0.09, y * 0.03, 6) > 0.84) l -= 0.22;
        l -= Math.max(0, (y - (g.GT - 30 * s)) / (30 * s)) * 0.25;
        // 井戸の口の下は月明かりで明るい
        const sh = Math.max(0, 1 - Math.abs(x - shaftX - (y - 0) * 0.25) / (46 * s));
        l += sh * 0.25 * (1 - y / g.GT);
        l -= Math.pow(Math.abs(x / W - 0.5) * 2, 2) * 0.1;
        let cc = rock[clamp(Math.round(l * 7), 0, 7)];
        cc = mix(cc, [36, 40, 86], 0.2);
        const q = (y * W + x) * 4; D[q] = cc[0]; D[q + 1] = cc[1]; D[q + 2] = cc[2]; D[q + 3] = 255;
      } }
      bx.putImageData(img, 0, 0);
      // 井戸の口（上の丸い穴から夜空）
      { const ox = shaftX, oy = 0, rw = 40 * s, rh = 16 * s;
        bx.save(); bx.beginPath(); bx.ellipse(ox, oy, rw, rh, 0, 0, Math.PI * 2); bx.clip();
        K.nightSky(bx, W, rh * 2, { aurora: false, clouds: false, seed: 31 }); bx.restore(); }
      // 鍾乳石・結晶・奥の岩の塊（2.5D）
      { const B = new RZ.Builder(), st = K.EM('stone', { keys: ['#120e1a', '#221c2c', '#342a40', '#483c54', '#5e5068', '#7a6c80'] });
        const crys = K.EM('lampGlow', { keys: ['#1a4a8a', '#3c8ad0', '#7ac8f0', '#d0f4ff'], n: 5, flat: false, spec: 1, specPow: 5, glow: '#90e0ff', wrap: 0.3, amb: 0.4 });
        for (let i = 0; i < 16 * W / 960; i++) {
          const x = R_() * W; if (Math.abs(x - shaftX) < 50 * s) continue;
          const len = (16 + R_() * 40) * s, w = (4 + R_() * 6) * s;
          B.poly([[x - w, -2], [x + w, -2], [x + w * 0.3, len * 0.7], [x, len], [x - w * 0.4, len * 0.6]], st, 2 + i * 0.01, { bevel: w * 0.8 });
        }
        const cluster = (x, y, k) => { for (let j = 0; j < 5; j++) { const a = -0.8 + j * 0.4 + (R_() - 0.5) * 0.3, len = (10 + R_() * 12) * k, w = (2.5 + R_() * 1.5) * k, b = [x + (j - 2) * 3 * k, y];
          B.poly([[b[0] - w, b[1]], [b[0] + Math.sin(a) * len - w * 0.3, b[1] - Math.cos(a) * len + 1], [b[0] + Math.sin(a) * len * 1.08, b[1] - Math.cos(a) * len * 1.08], [b[0] + Math.sin(a) * len + w * 0.3, b[1] - Math.cos(a) * len + 1], [b[0] + w, b[1]]], crys, 3 + j * 0.01, { bevel: w * 0.6, nx: -0.3 }); } };
        CRY = [[W * 0.12, g.GT - 4 * s, s * 1.2], [W * 0.84, g.GT - 10 * s, s * 1.5], [W * 0.66, g.GT - 30 * s, s * 0.8]];
        CRY.forEach(([x, y, k]) => cluster(x, y, k));
        K.rock(B, W * 0.94, g.GT + 2 * s, 34 * s, R_, 2.5, false, st);
        K.rock(B, W * 0.02, g.GT + 4 * s, 28 * s, R_, 2.5, false, st);
        const r = yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 });
        const cv = K.mk(W, H); K.blit(cv.getContext('2d'), r, 0, 0);
        bx.drawImage(K.tint(cv, '#8a88c0'), 0, 0); }
      bx.clearRect(0, g.GT, W, H - g.GT);
      yield* K.tick();
      // ---- ground: 岩の床と水たまり
      const ground = yield* K.groundG(g, {
        a: ['#2a2430', '#3c3440', '#504652', '#665a64', '#7c707a', '#948892'], b: ['#342e34', '#4a4046', '#60545a', '#786a6e', '#908284', '#a89a9a'], seed: 24, far: [70, 66, 110], farK: 0.6, wallShadow: 26,
        pebHi: [170, 160, 170], pebLo: [60, 52, 64],
        pix: (col, u, v) => {
          const w = vnoise(u * 0.35, v * 0.9, 29);
          if (w > 0.74) { const k = Math.min(1, (w - 0.74) * 6); col = mix(col, [60, 70, 120], 0.75 * k); if (vnoise(u * 4, v * 8, 30) > 0.8) col = mix(col, [170, 190, 240], 0.5 * k); }
          return col;
        },
      });
      const gx = ground.getContext('2d');
      { const B = new RZ.Builder(), st = K.EM('stone', { keys: ['#1a1622', '#2c2636', '#443c4c', '#5e5464', '#7a6e7c', '#9a8e98'] });
        for (let i = 0; i < 18 * W / 960; i++) { const y = g.GT + 14 * s + R_() * (H - g.GT - 14 * s), x = R_() * W; if (Math.abs(x - W * 0.5) < W * 0.24 && y < H * 0.9) continue; K.rock(B, x, y, (3 + R_() * 5) * s * K.scaleAt(g, y), R_, y, false, st); }
        K.blit(gx, yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      const lr = K.lantern(1.3 * K.scaleAt(g, L.lantern.y) * s / 1.205);
      K.blit(gx, lr, L.lantern.x, L.lantern.y);
      yield* K.tick();
      // ---- front: 手前の石筍（ぼかす）
      const front = K.mk(W, H), fx = front.getContext('2d');
      { const B = new RZ.Builder(), st = K.EM('stone', { keys: ['#120e1a', '#221c2c', '#342a40', '#483c54', '#5e5068', '#7a6c80'] });
        [[0.02, 60], [0.08, 36], [0.96, 70], [0.9, 30]].forEach(([fxp, h], i) => { const x = W * fxp, w = (10 + h * 0.15) * s; B.poly([[x - w, H + 4], [x - w * 0.3, H - h * s * 0.7], [x, H - h * s], [x + w * 0.4, H - h * s * 0.6], [x + w, H + 4]], st, 1 + i * 0.01, { bevel: w * 0.8 }); });
        K.blit(fx, yield* K.renderG(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      yield* K.tick();
      // ---- post: 月明かりの筋・結晶の光・しずく・ランタン
      const post = K.mk(W, H), px = post.getContext('2d');
      { px.save(); px.globalCompositeOperation = 'lighter';
        const gr = px.createLinearGradient(0, 0, 0, g.GT + 100 * s);
        gr.addColorStop(0, 'rgba(160,180,255,0.3)'); gr.addColorStop(1, 'rgba(160,180,255,0)');
        px.fillStyle = gr; px.beginPath(); px.moveTo(shaftX - 38 * s, 0); px.lineTo(shaftX + 38 * s, 0); px.lineTo(shaftX + 120 * s, g.GT + 100 * s); px.lineTo(shaftX - 10 * s, g.GT + 100 * s); px.closePath(); px.fill(); px.restore(); }
      CRY.forEach(([x, y, k]) => { K.glow(px, x, y - 12 * k, 44 * k, [120, 200, 255], 0.45); K.glow(px, x, y - 12 * k, 8 * k, [220, 245, 255], 0.6); });
      K.fireflies(px, 16, [shaftX - 30 * s, 10 * s, 110 * s, g.GT], 41, [[190, 210, 255]], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 100 * s, [255, 190, 110], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 20 * s, [255, 240, 200], 0.85);
      return { back, ground, front: yield* K.softenG(front, 4), post };
    },
  };
  K.caveDef = def;   // 洞窟の地方の背景（bbg_regions.js の like: 'cave'）が画像の読めないあいだの控えに使う
  (K._defs = K._defs || []).push(['cave', def]);
})(window.RPG);
