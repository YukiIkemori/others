// RENDER: R.Hd.blur(canvas, r) → 新しい canvas（同じ大きさ）。ctx.filter を使わない（V2_PLAN §2.1、ART_REWORK 0.4）
// 横と縦の箱ぼかしを 3 回（ガウスに近い）。色は不透明度を掛けてからぼかす（縁が黒ずまない）。
// r が大きいときは先に縮めてからぼかし、滑らかに戻す（速さのため。r > 2.5 で 1/2、r > 10 で 1/4。ぼけた絵なので見分けがつかない）。UIK のすりガラスは 1/4 の絵をこれでぼかす。
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});

  // 3 回の箱の幅（ガウス σ に合わせる。Ivan Kutskir の boxesForGauss）
  function boxes(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
    let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    const wu = wl + 2;
    const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);
    const out = [];
    for (let i = 0; i < n; i++) out.push(i < m ? wl : wu);
    return out;
  }
  // 1 本の方向の箱ぼかし（src → dst、4 ch、r = 半径）
  function boxH(src, dst, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let ch = 0; ch < 4; ch++) {
        let ti = row + ch;
        const fv = src[row + ch], lv = src[row + (w - 1) * 4 + ch];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += src[row + Math.min(j, w - 1) * 4 + ch];
        for (let x = 0; x < w; x++) {
          const rx = x + r <= w - 1 ? src[row + (x + r) * 4 + ch] : lv;
          val += rx;
          dst[ti] = val * iarr;
          const lx = x - r >= 0 ? src[row + (x - r) * 4 + ch] : fv;
          val -= lx;
          ti += 4;
        }
      }
    }
  }
  function boxV(src, dst, w, h, r) {
    const iarr = 1 / (r + r + 1);
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < 4; ch++) {
        const col = x * 4 + ch;
        const fv = src[col], lv = src[(h - 1) * w * 4 + col];
        let val = (r + 1) * fv;
        for (let j = 0; j < r; j++) val += src[Math.min(j, h - 1) * w * 4 + col];
        for (let y = 0; y < h; y++) {
          const ry = y + r <= h - 1 ? src[(y + r) * w * 4 + col] : lv;
          val += ry;
          dst[y * w * 4 + col] = val * iarr;
          const ly = y - r >= 0 ? src[(y - r) * w * 4 + col] : fv;
          val -= ly;
        }
      }
    }
  }

  /** ImageData の data（Uint8ClampedArray）をその場でぼかす（半径 r ≈ σ）。縁は端の色を伸ばす */
  function blurData(data, w, h, r) {
    if (!(r > 0)) return data;
    const n = w * h * 4;
    let a = new Float32Array(n), b = new Float32Array(n);
    // 不透明度を掛ける
    for (let i = 0; i < n; i += 4) { const al = data[i + 3] / 255; a[i] = data[i] * al; a[i + 1] = data[i + 1] * al; a[i + 2] = data[i + 2] * al; a[i + 3] = data[i + 3]; }
    for (const bw of boxes(r, 3)) {
      const br = (bw - 1) >> 1;
      if (br <= 0) continue;
      boxH(a, b, w, h, br);
      boxV(b, a, w, h, br);
    }
    for (let i = 0; i < n; i += 4) {
      const al = a[i + 3];
      if (al > 0.5) { const k = 255 / al; data[i] = a[i] * k; data[i + 1] = a[i + 1] * k; data[i + 2] = a[i + 2] * k; } else { data[i] = data[i + 1] = data[i + 2] = 0; }
      data[i + 3] = al;
    }
    return data;
  }
  Hd._blurData = blurData;

  Hd.blur = function (canvas, r) {
    const w = canvas.width, h = canvas.height;
    const out = Hd.RZ.canvas(w, h);
    const ox = out.getContext('2d');
    r = +r || 0;
    if (r <= 0.3) { ox.drawImage(canvas, 0, 0); return out; }
    const f = r > 10 ? 4 : r > 2.5 ? 2 : 1;
    const sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f));
    const tmp = f === 1 ? out : Hd.RZ.canvas(sw, sh);
    const tx = tmp.getContext('2d');
    tx.imageSmoothingEnabled = true;
    tx.drawImage(canvas, 0, 0, sw, sh);
    const id = tx.getImageData(0, 0, sw, sh);
    blurData(id.data, sw, sh, r / f);
    tx.putImageData(id, 0, 0);
    if (f !== 1) {
      ox.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ox) ox.imageSmoothingQuality = 'high';
      ox.drawImage(tmp, 0, 0, w, h);
    }
    return out;
  };
})(window.RPG);
