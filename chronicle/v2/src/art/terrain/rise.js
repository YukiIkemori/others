// TERRAIN: 立ち上がりの面（MODERN_UI §7.2 F2・F3）。岸壁・段差・崖・洞窟の壁・建物の無い石壁の「正面の面」と、その根元の AO。
// 面は壁のマス（solid の壁の素材）の中に描く（人の立てない所）。下のマスが床になる所から上へ rise マス分（legend の rise、既定 1）。
// 上端に明るい縁、下へ暗く、苔・蔦。面の絵は横に 4 マスで一周する 1 枚（隣のマス・チャンクとつながる）。
// 見つける前の隠し通路は壁と同じ扱いなので、面も周りの壁と同じ画素になる（check_secrets）。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});

  const RAMPS = () => {
    const u = T._u;
    return (RAMPS.c = RAMPS.c || {
      rock: u.ramp(['#1a1820', '#2c2934', '#423e4a', '#5a5462', '#76707c', '#948c96'], 8),
      cliff: u.ramp(['#1a1614', '#2c2622', '#403832', '#564c44', '#6e6258', '#8a7c6e'], 8),
      stone: u.ramp(['#2e2824', '#4c423a', '#6c5e52', '#8c7c6c', '#a89886', '#c0b09a'], 8),
      brick: u.ramp(['#34160e', '#562618', '#7a3a24', '#9c5434', '#bc724c'], 7),
      wood: u.ramp(['#1e120a', '#34200f', '#4e3219', '#6a4626', '#845c34'], 7),
      moss: u.ramp(['#242a22', '#3a4238', '#525c4e', '#6c7666', '#8a9282'], 7),
      bark: u.ramp(['#1c120c', '#301f14', '#48301e', '#62432a', '#7c5838'], 7),
      cave: u.ramp(['#1c1a26', '#2c2838', '#403a4e', '#565068', '#6e6882', '#88829a'], 8),
      grass: T._PAL.grass, leaf: T._PAL.moss,
    });
  };

  /** 面の画素（x は周期 128 u の横位置、e = 面の上端からの深さ px、H = 面の高さ px）→ [r,g,b] | null（透ける） */
  function faceColor(style, u, e, H, tile) {
    const U = T._u, rp = RAMPS(), k = 32 / tile, ee = e * k, HH = H * k, pn = U.pn, pick = U.pick;
    const lip = pn(u, 0, 8, 21) * 4;
    switch (style) {
      case 'cliff': {
        if (ee < 2 + lip * 0.6) return pick(rp.grass, 0.55 + (pn(u, ee, 4, 3) - 0.5) * 0.3);
        if (ee < 4 + lip * 0.6) return pick(rp.grass, 0.25);
      } // fallthrough: 岩の面
      case 'rock': case 'cave': {
        const R2 = style === 'cave' ? rp.cave : style === 'cliff' ? rp.cliff : rp.rock;
        const n = pn(u, ee, 8, 22, 32), c2 = pn(u, ee, 2, 23, 16), st = pn(u, ee, 32, 24, 4);
        let l = 0.55 + (n - 0.5) * 0.4 + (st - 0.5) * 0.2 - (ee / HH) * 0.38;
        if (c2 > 0.78) l -= 0.3;
        if (ee < 3) l += 0.3 - ee * 0.08;
        if (style === 'cave' && pn(u, ee, 4, 25, 64) > 0.72) l -= 0.18; // つららの筋
        return pick(R2, l);
      }
      case 'stone': case 'brick': case 'moss': {
        const R2 = style === 'brick' ? rp.brick : style === 'moss' ? rp.moss : rp.stone;
        const rh = style === 'brick' ? 5 : 8, bw = style === 'brick' ? 10.67 : 16;
        if (ee < 3) return pick(R2, 0.85 - ee * 0.12);
        const row = Math.floor((ee - 3) / rh), off = (row & 1) * bw * 0.5, col = Math.floor((u + off) / bw), ex = u + off - col * bw, ey = (ee - 3) - row * rh;
        if (ex < 1 || ey < 1) return style === 'brick' ? [40, 22, 18] : [30, 26, 24];
        const cw = ((col % Math.round(128 / bw)) + Math.round(128 / bw)) % Math.round(128 / bw);
        let l = 0.5 + (U.h3(cw, row, 7) - 0.5) * 0.35 + (pn(u, ee, 4, 5) - 0.5) * 0.2 - (ee / HH) * 0.25;
        if (ey < 2) l += 0.12; if (ey > rh - 2) l -= 0.12;
        if (style === 'moss' || style === 'stone') {
          const m = pn(u, 0, 8, 81);
          if (ee < 3 + m * (style === 'moss' ? 22 : 10) && pn(u, ee, 2, 82, 4) > (style === 'moss' ? 0.35 : 0.6)) return pick(rp.leaf, 0.35 + (pn(u, ee, 1, 83, 2) - 0.5) * 0.6);
        }
        return pick(R2, l);
      }
      case 'wood': {
        if (ee < 4) return pick(rp.wood, ee < 1 ? 0.9 : 0.6);
        const w = 8, kk = Math.floor(u / w), eu = u - kk * w;
        if (eu < 1) return [18, 10, 8];
        let l = 0.5 + (U.h3(((kk % 16) + 16) % 16, 3, 9) - 0.5) * 0.25 + (pn(u, ee, 8, 11, 32) - 0.5) * 0.3 - (ee / HH) * 0.2;
        if (eu < 2) l += 0.1; if (eu > w - 2) l -= 0.1;
        return pick(rp.wood, l);
      }
      case 'bark': {
        const n = pn(u, ee, 4, 31, 64), m = pn(u, ee, 16, 32, 32);
        let l = 0.5 + (n - 0.5) * 0.7 + (m - 0.5) * 0.25 - (ee / HH) * 0.3;
        if (n < 0.3) l -= 0.2;
        if (ee < 3) l += 0.25;
        return pick(rp.bark, l);
      }
      default: return pick(rp.stone, 0.5 - (ee / HH) * 0.3);
    }
  }

  // sheets[`${style}|${tile}|${h}`] = {S, H, px: Uint32Array}（横 S = 4 マス、縦 H = h マス）
  const sheets = {};
  function faceSheet(style, tile, h) {
    const key = style + '|' + tile + '|' + h;
    if (sheets[key]) return sheets[key];
    // 描いた面の画像（env.js）があればそれ（横の周期は画像の幅）
    const e = T.Env && T.Env.face ? T.Env.face(style, tile, h) : null;
    if (e) return (sheets[key] = e);
    const U = T._u, S = tile * 4, H = tile * h, px = new Uint32Array(S * H), k = 32 / tile;
    for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
      const c = faceColor(style, (x + 0.5) * k, y, H, tile);
      px[y * S + x] = c ? U.pack(c) : 0;
    }
    if (R.Hd && R.Hd.track) R.Hd.track('chunk', 'terrain:face:' + key, S * H * 4);
    return (sheets[key] = { S, H, px });
  }
  T._faceSheet = faceSheet;
  T._faceReset = function () { for (const k of Object.keys(sheets)) delete sheets[k]; };

  /**
   * 面と AO を dst に描く。C = チャンクのマスの読み（chunks.js の cellInfo）、X0, Y0 = チャンクの左上の px、cells = [x0, y0, x1, y1]
   */
  T._rise = function (dst, dw, X0, Y0, C, tile, cx0, cy0, cx1, cy1) {
    const dh = dst.length / dw, sh = T._shade;
    for (let y = cy0 - 1; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
      const c = C(x, y);
      if (!c.raised) continue;
      // 下へ何マスで床か
      let j = 1;
      while (j <= c.rise && C(x, y + j).raised) j++;
      if (j > c.rise) continue;
      const below = C(x, y + j);
      const fs = faceSheet(c.face, tile, c.rise), S = fs.S;
      const e0 = (c.rise - j) * tile; // 面の中のこのマスの上端
      const px0 = x * tile - X0, py0 = y * tile - Y0;
      const left = !C(x - 1, y).raised || C(x - 1, y + j).raised, right = !C(x + 1, y).raised || C(x + 1, y + j).raised;
      if (y >= cy0) for (let yy = 0; yy < tile; yy++) {
        const ly = py0 + yy; if (ly < 0 || ly >= dh) continue;
        const frow = (e0 + yy) * S, row = ly * dw;
        for (let xx = 0; xx < tile; xx++) {
          const lx = px0 + xx; if (lx < 0 || lx >= dw) continue;
          let p = fs.px[frow + (((x * tile + xx) % S) + S) % S];
          if (!p) continue;
          // 面の端（隣が面でない）: 縦の暗い線と明るい線
          if (left && xx < 2) p = sh(p, xx === 0 ? 0.25 : -0.1);
          else if (right && xx >= tile - 2) p = sh(p, xx === tile - 1 ? -0.45 : -0.2);
          dst[row + lx] = p;
        }
      }
      // 根元の AO（床の側に 10 px。水の上は water.js が岸の面を描く）
      if (below.water) continue;
      const aoH = Math.round(tile * 0.32);
      for (let k = 0; k < aoH; k++) {
        const ly = py0 + tile + k; if (ly < 0 || ly >= dh) continue;
        const f = -0.55 * (1 - k / aoH), row = ly * dw;
        for (let xx = 0; xx < tile; xx++) { const lx = px0 + xx; if (lx >= 0 && lx < dw) dst[row + lx] = sh(dst[row + lx], f); }
      }
    }
  };
})(window.RPG);
