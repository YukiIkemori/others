// TERRAIN: 境目（dual grid。MODERN_UI §7.2 F1、V2_PLAN §2.5.8）
// 表示のタイルはマスの中心から中心へ半マスずらした格子。1 枚の角 4 つ（= マス 4 つ）の素材の組み合わせ（16 通り）から境目の形を決める。
// やわらかい境（草・土・砂・水）は周期 4 マスのノイズで 7〜11 art px ずらし、硬い境（壁・板・敷石）はマスの線のまま。
// 形（マスク）は「素材 × tile × 16 通り × 位相 4 × 4」を先に焼いて使い回す（位相 = 表示のタイルの位置 mod 4。ノイズの周期と同じなので
// 隣の表示のタイル・隣のチャンクと境目が必ずつながる）。
//
//   マスクの値: 0 = 外、1 = 中、2 = 内側の縁（1 px。素材の rim で明暗）、3 = 外側のにじみ（2 px。下の素材を halo で明暗、水の上なら泡）
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const U = () => T._u;

  // 角の番号: bit0 = 左上、bit1 = 右上、bit2 = 左下、bit3 = 右下
  const masks = {}; // `${id}|${tile}` → Array(16*16)（combo * 16 + phase）

  /** 素材 id の境目の形（Uint8Array(tile*tile)）。phx, phy = 表示のタイルの位置 mod 4 */
  function mask(id, tile, combo, phx, phy) {
    const key = id + '|' + tile;
    const tab = (masks[key] = masks[key] || new Array(256));
    const m = T._matInfo(id), hard = m.edge === 'hard' || !m.amp;
    const k = combo * 16 + (hard ? 0 : (phy & 3) * 4 + (phx & 3));   // 硬い境は位相に依らない
    if (tab[k]) return tab[k];
    maskBytes += tile * tile;
    return (tab[k] = makeMask(id, m, tile, combo, phx & 3, phy & 3, hard));
  }
  let maskBytes = 0;
  T._maskBytes = () => maskBytes;
  // やわらかい境のしきい値の表（素材 × tile ごとに 1 回。周期 4 マス = 4 tile 四方）: thr = 0.5 + (ノイズ − 0.5) × 2 × amp
  const thrTabs = {};
  function thrTable(id, m, tile) {
    const key = id + '|' + tile;
    if (thrTabs[key]) return thrTabs[key];
    const u = U(), S = tile * 4, k = 32 / tile, amp = m.amp || 0, seed = (R.U.hash(m.name || 'm') % 997) + 11, t = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wu = (x + 0.5) * k, wv = (y + 0.5) * k;
      t[y * S + x] = 0.5 + ((u.pn(wu, wv, 16, seed) * 0.65 + u.pn(wu, wv, 8, seed + 1) * 0.35) - 0.5) * 2 * amp;
    }
    return (thrTabs[key] = t);
  }
  T._thrTable = function (id, tile) { const m = T._matInfo(id); if (m.edge !== 'hard' && m.amp) thrTable(id, m, tile); };
  function makeMask(id, m, tile, combo, phx, phy, hard) {
    const c00 = combo & 1, c10 = (combo >> 1) & 1, c01 = (combo >> 2) & 1, c11 = (combo >> 3) & 1;
    const E = tile + 6, inside = new Uint8Array(E * E), S = tile * 4, half = tile >> 1;
    const thr = hard ? null : thrTable(id, m, tile);
    for (let y = -3; y < tile + 3; y++) {
      const fv = (y + 0.5) / tile, Y = ((((phy * tile + half + y) % S) + S) % S) * S;
      for (let x = -3; x < tile + 3; x++) {
        const fu = (x + 0.5) / tile;
        let v;
        if (hard) { const qx = fu < 0.5 ? 0 : 1, qy = fv < 0.5 ? 0 : 1; v = qy ? (qx ? c11 : c01) : qx ? c10 : c00; }
        else {
          const f = c00 * (1 - fu) * (1 - fv) + c10 * fu * (1 - fv) + c01 * (1 - fu) * fv + c11 * fu * fv;
          v = f > thr[Y + ((((phx * tile + half + x) % S) + S) % S)] ? 1 : 0;
        }
        inside[(y + 3) * E + x + 3] = v;
      }
    }
    const out = new Uint8Array(tile * tile);
    for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
      const q = (y + 3) * E + x + 3;
      if (inside[q]) out[y * tile + x] = inside[q - 1] && inside[q + 1] && inside[q - E] && inside[q + E] ? 1 : 2;
      else out[y * tile + x] = inside[q - 1] || inside[q + 1] || inside[q - E] || inside[q + E] || inside[q - 2] || inside[q + 2] || inside[q - 2 * E] || inside[q + 2 * E] || inside[q - E - 1] || inside[q - E + 1] || inside[q + E - 1] || inside[q + E + 1] ? 3 : 0;
    }
    return out;
  }
  T._mask = mask;

  const rankCache = {};
  /** 境目で上に来る順（同じ pri は id で決める） */
  function rank(id) {
    if (rankCache[id] != null) return rankCache[id];
    const m = T._matInfo(id);
    return (rankCache[id] = (m.pri || 0) * 1000 + (R.U.hash(id) % 997));
  }
  T._rank = rank;

  // 明暗（Uint32 の画素 × (1 + f)）
  function shade(p, f) {
    const k = 1 + f;
    let r = (p & 255) * k, g = ((p >>> 8) & 255) * k, b = ((p >>> 16) & 255) * k;
    r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; b = b > 255 ? 255 : b;
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  const FOAM = [150, 178, 196];
  function foam(p, a) {
    const r = p & 255, g = (p >>> 8) & 255, b = (p >>> 16) & 255;
    return ((255 << 24) | ((b + (FOAM[2] - b) * a) << 16) | ((g + (FOAM[1] - g) * a) << 8) | (r + (FOAM[0] - r) * a)) >>> 0;
  }
  T._shade = shade;

  /**
   * 表示のタイル 1 枚を dst（チャンクの Uint32Array、幅 dw）に描く。
   * X0, Y0 = チャンクの左上（マップの論理 px）、dx, dy = 表示のタイルの左上の角のマス、mats = [左上, 右上, 左下, 右下] の地面の素材 id、
   * clip = チャンクの画素の範囲 [x0, y0, x1, y1]（dst の中の座標）
   */
  T._dgTile = function (dst, dw, X0, Y0, dx, dy, mats, tile) {
    const half = tile >> 1;
    const wx = dx * tile + half, wy = dy * tile + half; // 表示のタイルの左上（世界の px）
    let lx0 = wx - X0, ly0 = wy - Y0;
    const dh = dst.length / dw;
    const x0 = Math.max(0, lx0), y0 = Math.max(0, ly0), x1 = Math.min(dw, lx0 + tile), y1 = Math.min(dh, ly0 + tile);
    if (x1 <= x0 || y1 <= y0) return;
    const a = mats[0], b = mats[1], c = mats[2], d = mats[3];
    // 1 種類だけ: 写すだけ
    if (a === b && a === c && a === d) { blit(dst, dw, T._sheet(a, tile), wx, wy, lx0, ly0, x0, y0, x1, y1); return; }
    const uniq = [];
    for (const m of mats) if (uniq.indexOf(m) < 0) uniq.push(m);
    uniq.sort((p, q) => rank(p) - rank(q));
    blit(dst, dw, T._sheet(uniq[0], tile), wx, wy, lx0, ly0, x0, y0, x1, y1);
    const phx = ((dx % 4) + 4) % 4, phy = ((dy % 4) + 4) % 4;
    for (let li = 1; li < uniq.length; li++) {
      const id = uniq[li], rk = rank(id);
      const combo = (rank(a) >= rk ? 1 : 0) | (rank(b) >= rk ? 2 : 0) | (rank(c) >= rk ? 4 : 0) | (rank(d) >= rk ? 8 : 0);
      const M = mask(id, tile, combo, phx, phy), m = T._matInfo(id), sh = T._sheet(id, tile), S = sh.S, sp = sh.px;
      const rim = m.rim || 0, halo = m.halo || 0;
      // 下の層が水ならにじみは泡（やわらかい岸）。硬い岸は影
      const lower = T._matInfo(uniq[li - 1]), foamy = lower.water && !m.water && m.edge !== 'hard';
      for (let y = y0; y < y1; y++) {
        const my = (y - ly0) * tile, sy = (((wy + (y - ly0)) % S) + S) % S * S, row = y * dw;
        for (let x = x0; x < x1; x++) {
          const v = M[my + x - lx0];
          if (!v) continue;
          if (v === 3) {
            if (foamy) dst[row + x] = foam(dst[row + x], 0.28);
            else if (halo) dst[row + x] = shade(dst[row + x], halo * 0.6);
            continue;
          }
          const p = sp[sy + ((((wx + (x - lx0)) % S) + S) % S)];
          dst[row + x] = v === 2 && rim ? shade(p, rim) : p;
        }
      }
    }
  };
  function blit(dst, dw, sh, wx, wy, lx0, ly0, x0, y0, x1, y1) {
    const S = sh.S, sp = sh.px;
    for (let y = y0; y < y1; y++) {
      const sy = ((((wy + (y - ly0)) % S) + S) % S) * S, row = y * dw;
      let sx = (((wx + (x0 - lx0)) % S) + S) % S, x = x0;
      while (x < x1) {
        const n = Math.min(x1 - x, S - sx);
        dst.set(sp.subarray(sy + sx, sy + sx + n), row + x);
        x += n; sx = 0;
      }
    }
  }
  T._blit = blit;

  /** 16 通りの見本（テストと一覧表）: a を下、b を上にした combo の表示のタイル 1 枚を dst に */
  T._dgSample = function (a, b, combo, tile) {
    const dst = new Uint32Array(tile * tile), mats = [combo & 1 ? b : a, combo & 2 ? b : a, combo & 4 ? b : a, combo & 8 ? b : a];
    T._dgTile(dst, tile, tile >> 1, tile >> 1, 0, 0, mats, tile);
    return dst;
  };
})(window.RPG);
