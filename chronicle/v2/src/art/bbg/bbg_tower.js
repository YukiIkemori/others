// BEAST: 戦闘背景 tower（灯台の中・見張りの塔。z_lighthouse、ページ食らい・ダストウィング）
// 丸い石の部屋: 湾曲した石積みの壁、夜空の見えるアーチの窓、壁の燭台（暖色）、敷石の床。mood tower。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const def = {
    mood: 'tower', ambient: 'rgb(108,98,172)', geo: { clearRx: 13, gt: 206 },
    bake(g, L, c) {
      const { W, H, RZ } = c, R_ = RZ.rng(63), s = g.s, { vnoise, clamp, mix, ramp, hex } = RZ;
      // ---- back: 湾曲した石の壁（夜の色で焼く。窓の外だけ空）
      const back = K.mk(W, H), bx = back.getContext('2d');
      const sky = K.mk(W, g.GT), sx = sky.getContext('2d');
      K.nightSky(sx, W, g.GT, { moon: [W * 0.3, 70 * s, 12 * s], aurora: false, seed: 12, clouds: true });
      const win = { x: W * 0.3, y: 40 * s, w: 46 * s, h: 110 * s };
      const inWin = (x, y) => { const dx = (x - win.x) / (win.w / 2); if (Math.abs(dx) > 1) return false; const top = win.y + win.w / 2 * (1 - Math.sqrt(1 - dx * dx)); return y >= top && y <= win.y + win.h; };
      const img = bx.createImageData(W, g.GT), D = img.data;
      const stone = ramp(['#16121e', '#241e2e', '#342c3e', '#463c4e', '#5a4e5e', '#706272'], 8);
      const skyD = sx.getImageData(0, 0, W, g.GT).data;
      for (let y = 0; y < g.GT; y++) for (let x = 0; x < W; x++) {
        const q = (y * W + x) * 4;
        if (inWin(x, y)) { D[q] = skyD[q]; D[q + 1] = skyD[q + 1]; D[q + 2] = skyD[q + 2]; D[q + 3] = 255; continue; }
        const th = (x - W / 2) / W * 2.2;                       // 壁の丸み（中ほどが手前）
        const u = Math.sin(th) * 180 + 200, bh = 9 * s;
        const row = Math.floor(y / bh), off = (row % 2) * 0.5;
        const bw = 22 * s * (0.55 + Math.cos(th) * 0.45);
        const col = Math.floor(u / (22 * s) * 1 + off);
        const fy = (y % bh) / bh, fxu = ((u / (22 * s) + off) % 1);
        const mortar = fy < 0.12 || fxu < 0.06 * (1 / (0.55 + Math.cos(th) * 0.45));
        const n = vnoise(col * 3.1, row * 1.7, 2) * 0.5 + vnoise(x * 0.15, y * 0.15, 3) * 0.3;
        let l = 0.25 + Math.cos(th) * 0.35 + n * 0.35 - (y / g.GT) * 0.1;
        if (mortar) l -= 0.35;
        if (y > g.GT - 12 * s) l = 0.18 + n * 0.2 - (y > g.GT - 3 * s ? 0.15 : 0);   // 壁の根元の石の帯
        // 窓の縁の光（月明かり）
        const dxw = x - win.x;
        if (Math.abs(dxw) < win.w / 2 + 5 * s && y > win.y - 6 * s && y < win.y + win.h + 5 * s && !inWin(x, y)) l += 0.18;
        let cc = stone[clamp(Math.round(l * 7), 0, 7)];
        cc = mix(cc, [40, 44, 90], 0.25);
        D[q] = cc[0]; D[q + 1] = cc[1]; D[q + 2] = cc[2]; D[q + 3] = 255;
      }
      bx.putImageData(img, 0, 0);
      // 窓の格子と窓台、壁の燭台、石の段（奥）
      { const B = new RZ.Builder(), iron = K.EM('iron'), stoneM = K.EM('stone', { keys: ['#1a1622', '#2c2636', '#443c4c', '#5e5464', '#7a6e7c', '#9a8e98'] });
        B.rect(win.x - 1.2 * s, win.y + 4 * s, 2.4 * s, win.h - 4 * s, iron, 2);
        B.rect(win.x - win.w / 2, win.y + win.h * 0.55, win.w, 2.4 * s, iron, 2);
        B.rect(win.x - win.w / 2 - 5 * s, win.y + win.h, win.w + 10 * s, 5 * s, stoneM, 2.1);
        for (const sxp of [W * 0.62, W * 0.9]) {
          const y0 = 120 * s;
          B.poly([[sxp - 4 * s, y0], [sxp + 4 * s, y0], [sxp + 2.5 * s, y0 + 8 * s], [sxp - 2.5 * s, y0 + 8 * s]], iron, 2.2, { bevel: 1 });
          B.cap(sxp, y0 + 8 * s, sxp, y0 + 16 * s, 1 * s, 1 * s, iron, 2.2);
          B.poly([[sxp - 2 * s, y0], [sxp + 2 * s, y0], [sxp, y0 - 7 * s]], K.EM('lampGlow'), 2.3, { bevel: 0.5 });
        }
        // 奥のらせん階段（右の壁に沿う段）
        for (let i = 0; i < 7; i++) { const x = W * 0.72 + i * 14 * s, y = g.GT - 8 * s - i * 12 * s; B.rect(x, y, 16 * s, 5 * s, stoneM, 2.4 + i * 0.01); }
        K.blit(bx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      bx.globalCompositeOperation = 'multiply'; bx.fillStyle = 'rgb(150,140,190)'; bx.fillRect(0, 0, W, g.GT);
      bx.globalCompositeOperation = 'source-over';
      // ---- ground: 敷石（放射と同心の目地）
      const ground = K.ground(g, {
        a: ['#3a3440', '#524a56', '#6c626c', '#877c84', '#a2969a', '#bcb0b0'], b: ['#4a3e3c', '#665650', '#846e62', '#a08874', '#b8a08a', '#d0bca4'], seed: 14, far: [70, 64, 96], farK: 0.75, pebbles: false, wallShadow: 26,
        pix: (col, u, v) => {
          const r = Math.hypot(u * 0.9, (v - 16) * 2.4), a = Math.atan2(v - 16, u);
          const ring = r / 3.4, seg = a / (PI2 / (8 + Math.floor(ring) * 3));
          const joint = Math.abs(ring - Math.round(ring)) < 0.06 || Math.abs(seg - Math.round(seg)) < 0.03 * (1 + ring * 0.6);
          return joint ? mix(col, [40, 34, 46], 0.35) : col;
        },
        clear: (u, v, n2, n3) => 1 - Math.hypot(u / 6.5, (v - 16) / 2.6) + (n2 - 0.5) * 0.2,
      });
      const gx = ground.getContext('2d');
      { const B = new RZ.Builder();
        const wood = K.EM('bark', { keys: ['#24160e', '#46301e', '#6a4a2e', '#8e6a44', '#b08c60'] });
        // 樽と木箱（左右の奥）
        const barrel = (x, y, k) => { B.cap(x, y - 2 * k, x, y - 16 * k, 7 * k, 7 * k, wood, 1); [4, 12].forEach((d) => B.cap(x - 7 * k, y - d * k, x + 7 * k, y - d * k, 0.9 * k, 0.9 * k, K.EM('iron'), 1.1)); };
        barrel(W * 0.08, g.GT + 34 * s, s * 1.1); barrel(W * 0.93, g.GT + 50 * s, s * 1.2);
        B.rect(W * 0.14, g.GT + 20 * s, 18 * s, 14 * s, wood, 1);
        K.blit(gx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      const lr = K.lantern(1.3 * K.scaleAt(g, L.lantern.y) * s / 1.205);
      K.blit(gx, lr, L.lantern.x, L.lantern.y);
      // ---- front: 手前の石柱の影（左右の端、ぼかす）
      const front = K.mk(W, H), fx = front.getContext('2d');
      { const B = new RZ.Builder(), st = K.EM('stone', { keys: ['#161220', '#261e30', '#3a3044', '#52465a', '#6c5e70', '#8a7c8a'] });
        B.cap(-6 * s, H + 10, -10 * s, -10, 20 * s, 20 * s, st, 1);
        B.cap(W + 8 * s, H + 10, W + 10 * s, -10, 18 * s, 18 * s, st, 1);
        K.blit(fx, RZ.render(B, { light: K.LIGHT, tones: 5, olMix: 0.82, sat: 0.8 }), 0, 0); }
      // ---- post: 燭台の灯・窓の月明かりの筋・舞う埃・ランタン
      const post = K.mk(W, H), px = post.getContext('2d');
      for (const sxp of [W * 0.62, W * 0.9]) { K.glow(px, sxp, 120 * s - 3 * s, 60 * s, [255, 180, 100], 0.55); K.glow(px, sxp, 120 * s - 3 * s, 8 * s, [255, 240, 200], 0.9); }
      { px.save(); px.globalCompositeOperation = 'lighter';
        const gr = px.createLinearGradient(win.x, win.y, win.x + 140 * s, g.GT + 120 * s);
        gr.addColorStop(0, 'rgba(150,170,255,0.16)'); gr.addColorStop(1, 'rgba(150,170,255,0)');
        px.fillStyle = gr; px.beginPath(); px.moveTo(win.x - win.w / 2, win.y + win.h * 0.3); px.lineTo(win.x + win.w / 2, win.y + win.h * 0.2);
        px.lineTo(win.x + 190 * s, g.GT + 140 * s); px.lineTo(win.x + 40 * s, g.GT + 160 * s); px.closePath(); px.fill(); px.restore(); }
      K.fireflies(px, 18, [W * 0.2, 40 * s, W * 0.4, g.GT + 80 * s], 13, [[200, 210, 255], [255, 230, 190]], 0.6);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 100 * s, [255, 190, 110], 0.5);
      K.glow(px, L.lantern.x, L.lantern.y - 9 * s, 20 * s, [255, 240, 200], 0.85);
      return { back, ground, front: K.soften(front, 4), post };
    },
  };
  const PI2 = Math.PI * 2;
  (K._defs = K._defs || []).push(['tower', def]);
})(window.RPG);
