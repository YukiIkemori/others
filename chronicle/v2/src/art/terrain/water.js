// TERRAIN: 水面（MODERN_UI §4.1-8・§7.2 F2・F6、STYLE_REFERENCE §6.3）
// 岸壁（硬い床の下が水）: 縁石＋石積みの面を水のマスの上に。桟橋（板の下が水）: 梁と杭、横の影。
// 光の地図を掛けた後: 月の照り返しの短い横線と、灯りの縦の揺れ（焼き込み。動く照り返しは FIELD の毎フレームの仕事）。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});

  const WOODY = { plank: 1, pier: 1, bridge: 1, deck: 1, ladder: 1 };

  /** 水の縁を dst に。C = マスの読み、cells = チャンクのマスの範囲 */
  T._waterEdges = function (dst, dw, X0, Y0, C, tile, cx0, cy0, cx1, cy1) {
    const U = T._u, dh = dst.length / dw, sh = T._shade, pn = U.pn, pick = U.pick, PAL = T._PAL;
    const quay = U.ramp(['#262426', '#403d40', '#5c5858', '#7c7670', '#9a9388', '#b4ab9c'], 8);
    const k = 32 / tile, faceH = Math.round(tile * 0.5), put = (lx, ly, c) => { if (lx >= 0 && ly >= 0 && lx < dw && ly < dh) dst[ly * dw + lx] = U.pack(c); };
    for (let y = cy0 - 1; y < cy1; y++) for (let x = cx0 - 1; x < cx1 + 1; x++) {
      const c = C(x, y);
      if (c.water || c.raised) continue;
      const hardLand = c.hard;
      if (!hardLand) continue;
      const px0 = x * tile - X0, py0 = y * tile - Y0, woody = WOODY[c.mat];
      // 下が水: 岸壁の面／桟橋の梁と杭
      if (C(x, y + 1).water) {
        for (let yy = 0; yy < faceH + 3; yy++) for (let xx = 0; xx < tile; xx++) {
          const lx = px0 + xx, ly = py0 + tile + yy; if (lx < 0 || ly < 0 || lx >= dw || ly >= dh) continue;
          const wx = (x * tile + xx) * k, e = yy * k;
          if (woody) {
            if (yy < 3) { put(lx, ly, pick(PAL.plank, yy === 0 ? 0.7 : 0.25)); continue; }
            const pp = (((x * tile + xx) % 16) + 16) % 16;
            if (pp >= 2 && pp < 6 && yy < faceH + 3) { put(lx, ly, pick(PAL.plank, 0.35 - yy * 0.012 + (pp === 2 ? 0.15 : 0))); continue; }
            dst[ly * dw + lx] = sh(dst[ly * dw + lx], -0.5 + yy / (faceH + 3) * 0.4);
          } else {
            if (yy >= faceH) { if (pn(wx, e, 2, 9) > 0.45) put(lx, ly, [150, 180, 190]); continue; }
            const row = Math.floor(e / 5), kk = Math.floor((wx + (row & 1) * 6) / 12), ex = (wx + (row & 1) * 6) % 12;
            if (ex < 1 || e % 5 < 1) { put(lx, ly, [20, 20, 24]); continue; }
            const col = pick(quay, 0.44 - e * 0.02 + (U.h3(((kk % 11) + 11) % 11, row + y * 3, 6) - 0.5) * 0.3);
            put(lx, ly, e > 10 ? U.mix(col, [30, 64, 64], 0.5) : col);
          }
        }
        // 縁石（床の側の下端）
        if (!woody) for (let yy = tile - 3; yy < tile; yy++) for (let xx = 0; xx < tile; xx++) {
          const lx = px0 + xx, ly = py0 + yy; if (lx < 0 || ly < 0 || lx >= dw || ly >= dh) continue;
          put(lx, ly, (((x * tile + xx) % 12) + 12) % 12 === 0 ? [26, 24, 26] : pick(quay, yy === tile - 3 ? 0.9 : 0.62));
        }
      }
      // 板の横が水: 暗い縁と、右の水に影（月は左上）
      if (woody) {
        if (C(x - 1, y).water) for (let yy = 0; yy < tile; yy++) for (let xx = 0; xx < 2; xx++) { const lx = px0 + xx, ly = py0 + yy; if (lx >= 0 && ly >= 0 && lx < dw && ly < dh) dst[ly * dw + lx] = sh(dst[ly * dw + lx], -0.45); }
        if (C(x + 1, y).water) for (let yy = 0; yy < tile; yy++) {
          const ly = py0 + yy; if (ly < 0 || ly >= dh) continue;
          for (let xx = tile - 2; xx < tile + 12; xx++) { const lx = px0 + xx; if (lx < 0 || lx >= dw) continue; dst[ly * dw + lx] = sh(dst[ly * dw + lx], xx < tile ? -0.5 : -0.45 * (1 - (xx - tile) / 12)); }
        }
      }
    }
  };

  /** 光の地図の後: 月の照り返しと灯りの縦の揺れ（ctx はチャンクの base、isWater(wx, wy) は世界の px） */
  T._waterGlints = function (ctx, X0, Y0, size, isWater, lights, seed) {
    const U = T._u, rng = R.rng('glint:' + seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = Math.round((size * size) / 300);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rng.next() * size), y = Math.floor(rng.next() * size);
      if (!isWater(X0 + x, Y0 + y)) continue;
      ctx.fillStyle = `rgba(150,180,230,${(0.06 + rng.next() * 0.14).toFixed(3)})`;
      ctx.fillRect(x, y, 3 + Math.floor(rng.next() * 6), 1);
    }
    // 灯りの照り返し（岸の灯り・船の灯り）: 光の下の水に縦に並ぶ暖色の短い線
    for (const L of lights) {
      if (L.r < 60) continue;
      const lr = R.rng('refl:' + Math.round(L.x) + ':' + Math.round(L.y));
      for (let i = 0; i < 28; i++) {
        const wy = L.y + 6 + Math.pow(lr.next(), 0.8) * 76, wx = L.x + (lr.next() - 0.5) * (8 + (wy - L.y) * 0.2);
        const w = 2 + Math.floor(lr.next() * 5), a = 0.5 * (1 - (wy - L.y) / 84);
        if (a <= 0 || !isWater(Math.floor(wx), Math.floor(wy))) continue;
        const lx = Math.floor(wx - X0), ly = Math.floor(wy - Y0);
        if (lx < -8 || ly < 0 || lx >= size || ly >= size) continue;
        ctx.fillStyle = `rgba(255,${(170 + lr.next() * 40) | 0},${(90 + lr.next() * 40) | 0},${a.toFixed(3)})`;
        ctx.fillRect(lx, ly, w, 1);
      }
    }
    ctx.restore();
  };
})(window.RPG);
