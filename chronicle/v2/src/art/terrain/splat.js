// TERRAIN: なめらかな地面（WORLD v3、2026-09-28。map.splat のマップ = ワールド）。オーナーの報告「マスごとの硬い継ぎ目がしょぼい」への答え。
// dual grid の表示のタイル（チャンクの継ぎ目が必ずつながる形）はそのまま、1 枚の中の画素ごとに素材の重みを
//   「近い 4×4 マスの B スプラインと 2×2 の双一次の平均」（2 マスほどの丸い場）＋素材ごとの世界の座標のノイズ
// で決め、上の 2 つを細い帯でまぜる（アルファ）。水の上は岸の近くほど浅瀬の色、陸と水の境に泡の線。
// 素材に変化の絵（<id>_b、env の mat）があれば、大きなノイズで A と B をまぜて周期を隠す。
// 硬い素材（板・橋・石畳など edge:'hard'）が角にある表示のタイルは、今までどおり T._dgTile（dualgrid.js）で描く。
//
//   T._dgSplat(dst, dw, X0, Y0, dx, dy, C, tile) → true（描いた）| false（硬い素材があるので呼んだ側が _dgTile で描く）
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const U = () => T._u;

  // ------------------------------------------------------------------ 重みの表（tile ごと）: 画素の位置 f ∈ [0,1) → 4 マスの重み
  const kern = {};
  function kernOf(tile) {
    if (kern[tile]) return kern[tile];
    const k = new Float32Array(tile * 4);
    for (let i = 0; i < tile; i++) {
      const f = (i + 0.5) / tile, f2 = f * f, f3 = f2 * f;
      // B スプライン（-1, 0, 1, 2）と双一次（0, 1）の平均
      const b0 = (1 - f) ** 3 / 6, b1 = (3 * f3 - 6 * f2 + 4) / 6, b2 = (-3 * f3 + 3 * f2 + 3 * f + 1) / 6, b3 = f3 / 6;
      k[i * 4] = b0 * 0.5; k[i * 4 + 1] = b1 * 0.5 + (1 - f) * 0.5; k[i * 4 + 2] = b2 * 0.5 + f * 0.5; k[i * 4 + 3] = b3 * 0.5;
    }
    return (kern[tile] = k);
  }
  // ------------------------------------------------------------------ ノイズの表（1 枚を全部の素材で使い回す。周期 16 マス、素材ごとにずらす）
  const noiseTab = {};
  function noiseOf(tile) {
    if (noiseTab[tile]) return noiseTab[tile];
    const u = U(), S = tile * 16, n = new Float32Array(S * S), k = 32 / tile, P = 512;
    // 周期 P（u）の値のノイズ 3 段（大きい形 ≈ 1.5 マス、中 ≈ 0.5 マス、細 ≈ 0.2 マス）
    const pn = (x, y, L, s) => {
      const nx = P / L, fx0 = x / L, fy0 = y / L, i = Math.floor(fx0), j = Math.floor(fy0), fx = fx0 - i, fy = fy0 - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const i0 = ((i % nx) + nx) % nx, j0 = ((j % nx) + nx) % nx, i1 = (i0 + 1) % nx, j1 = (j0 + 1) % nx;
      const a = u.h3(i0, j0, s), b = u.h3(i1, j0, s), c = u.h3(i0, j1, s), d = u.h3(i1, j1, s);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const X = (x + 0.5) * k, Y = (y + 0.5) * k;
      n[y * S + x] = pn(X, Y, 64, 501) * 0.55 + pn(X, Y, 16, 502) * 0.3 + pn(X, Y, 8, 503) * 0.15;
    }
    if (R.Hd && R.Hd.track) R.Hd.track('chunk', 'terrain:splatnoise:' + tile, S * S * 4);
    return (noiseTab[tile] = { S, n });
  }
  const offs = {};
  function offOf(id, S) {
    const k = id + '|' + S;
    if (offs[k]) return offs[k];
    const h = R.U.hash(id) >>> 0;   // hash は負のこともある（負のずれ → 表の外 → NaN）
    return (offs[k] = [(h % 997) * 37 % S, ((h >>> 10) % 991) * 53 % S]);
  }
  const infoC = {};
  function mi(id) {
    if (infoC[id]) return infoC[id];
    const m = T._matInfo(id);
    const splatAmp = m.splat != null ? m.splat : m.water ? 0.34 : /road|path|dirt|mud|plank/.test(id) ? 0.2 : 0.42;
    return (infoC[id] = { id, water: !!m.water, hard: m.edge === 'hard', pri: m.pri || 0, amp: splatAmp, halo: m.halo || 0, shallow: m.shallowTint || null });
  }
  T._splatReset = function () { for (const k of Object.keys(infoC)) delete infoC[k]; };

  const FOAM = [168, 196, 206], SHALLOW = [58, 118, 124];
  function mixPx(a, b, t) {
    const r = (a & 255) + (((b & 255) - (a & 255)) * t), g = ((a >>> 8) & 255) + ((((b >>> 8) & 255) - ((a >>> 8) & 255)) * t), bl = ((a >>> 16) & 255) + ((((b >>> 16) & 255) - ((a >>> 16) & 255)) * t);
    return ((255 << 24) | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
  }
  function tint(p, c, t) {
    const r = (p & 255) + (c[0] - (p & 255)) * t, g = ((p >>> 8) & 255) + (c[1] - ((p >>> 8) & 255)) * t, b = ((p >>> 16) & 255) + (c[2] - ((p >>> 16) & 255)) * t;
    return ((255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0)) >>> 0;
  }
  /** 素材の変化の絵（<id>_b があれば）: {a, b}（どちらも焼いた 1 枚） */
  function sheets(id, tile) {
    const a = T._sheet(id, tile);
    const hasB = T.Env && T.Env.has && T.Env.has('mat', id + '_b');
    return { a, b: hasB ? T._sheet(id + '_b', tile) : null };
  }
  const BAND = 0.1;

  T._dgSplat = function (dst, dw, X0, Y0, dx, dy, C, tile) {
    // 角の 4 マスに硬い素材 → 今までの形
    const corner = [C(dx, dy).mat, C(dx + 1, dy).mat, C(dx, dy + 1).mat, C(dx + 1, dy + 1).mat];
    for (const m of corner) if (mi(m).hard) return false;
    // 4×4 のマスの素材（硬い素材は一番近い角の素材として数える）
    const cell = new Array(16), ids = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      let m = C(dx - 1 + i, dy - 1 + j).mat;
      if (mi(m).hard) m = corner[(j < 2 ? 0 : 2) + (i < 2 ? 0 : 1)];
      cell[j * 4 + i] = m;
      if (ids.indexOf(m) < 0) ids.push(m);
    }
    const half = tile >> 1, wx = dx * tile + half, wy = dy * tile + half, lx0 = wx - X0, ly0 = wy - Y0, dh = dst.length / dw;
    const x0 = Math.max(0, lx0), y0 = Math.max(0, ly0), x1 = Math.min(dw, lx0 + tile), y1 = Math.min(dh, ly0 + tile);
    if (x1 <= x0 || y1 <= y0) return true;
    const NZ = noiseOf(tile), S = NZ.S, nz = NZ.n, K = kernOf(tile);
    const nM = ids.length, inf = ids.map(mi), sh = ids.map((id) => sheets(id, tile)), off = ids.map((id) => offOf(id, S));
    const vOff = offOf('variant', S);
    // 4×4 がすべて同じ素材: 写すだけ（変化の絵があるときだけ画素ごと）
    const MK = T._splatMask;
    RVS = T._splatRS || null;   // 起伏の標本（relief.js）: あれば変化の絵の選びを日なた・陰に合わせる   // 水の印（relief.js: 陸 = 水の重み 0〜127、水 = 128 + 陸の重み）
    if (ids.length === 1) {
      const sh0 = sh[0];
      if (MK && inf[0].water) for (let y = y0; y < y1; y++) MK.fill(128, y * dw + x0, y * dw + x1);
      if (!sh0.b) { T._blit(dst, dw, sh0.a, wx, wy, lx0, ly0, x0, y0, x1, y1); return true; }
      for (let y = y0; y < y1; y++) { const WY = wy + (y - ly0), row = y * dw; for (let x = x0; x < x1; x++) dst[row + x] = texel(sh0, wx + (x - lx0), WY, nz, S, vOff); }
      return true;
    }
    // 1 種類だけ（4×4 すべて同じ）: 写すだけ（変化の絵があればまぜる）
    const rows = new Float32Array(nM * 4), isW = inf.map((q) => q.water), amps = inf.map((q) => q.amp), nrow = new Int32Array(nM), arow = new Int32Array(nM);
    const anyWater = isW.some(Boolean), anyLand = isW.some((q) => !q);
    for (let y = y0; y < y1; y++) {
      const ty = y - ly0, ky = ty * 4;
      const by0 = K[ky], by1 = K[ky + 1], by2 = K[ky + 2], by3 = K[ky + 3];
      for (let m = 0; m < nM; m++) for (let i = 0; i < 4; i++) {
        const id = ids[m];
        rows[m * 4 + i] = (cell[i] === id ? by0 : 0) + (cell[4 + i] === id ? by1 : 0) + (cell[8 + i] === id ? by2 : 0) + (cell[12 + i] === id ? by3 : 0);
      }
      const WY = wy + ty, row = y * dw, nyRow = (((WY % S) + S) % S);
      // 行ごとの前計算: 素材ごとのノイズの行、絵の行（変化の絵が無いときは直に読む）
      for (let m = 0; m < nM; m++) {
        nrow[m] = ((nyRow + off[m][1]) % S) * S;
        const A = sh[m].a; arow[m] = ((((WY % A.S) + A.S) % A.S)) * A.S;
      }
      let wxm = ((((wx + (x0 - lx0)) % S) + S) % S);
      for (let x = x0; x < x1; x++, wxm = wxm + 1 === S ? 0 : wxm + 1) {
        const tx = x - lx0, kx = tx * 4, WX = wx + tx;
        const bx0 = K[kx], bx1 = K[kx + 1], bx2 = K[kx + 2], bx3 = K[kx + 3];
        let b1 = -9, b2 = -9, m1 = 0, m2 = 0, land = 0;
        for (let m = 0; m < nM; m++) {
          const r4 = m * 4, ww = rows[r4] * bx0 + rows[r4 + 1] * bx1 + rows[r4 + 2] * bx2 + rows[r4 + 3] * bx3;
          if (!isW[m]) land += ww;
          let qx = wxm + off[m][0]; if (qx >= S) qx -= S;
          const sc = ww + (nz[nrow[m] + qx] - 0.5) * amps[m];
          if (sc > b1) { b2 = b1; m2 = m1; b1 = sc; m1 = m; } else if (sc > b2) { b2 = sc; m2 = m; }
        }
        const s1 = sh[m1];
        let p = s1.b ? texel(s1, WX, WY, nz, S, vOff) : s1.a.px[arow[m1] + (((WX % s1.a.S) + s1.a.S) % s1.a.S)];
        const d = b1 - b2;
        if (d < BAND) {
          const s2 = sh[m2], q = s2.b ? texel(s2, WX, WY, nz, S, vOff) : s2.a.px[arow[m2] + (((WX % s2.a.S) + s2.a.S) % s2.a.S)], t = 0.5 - (0.5 * d) / BAND;
          p = mixPx(p, q, t);
          // 陸と水の境: 泡の線
          if (isW[m1] !== isW[m2] && d < 0.035) p = tint(p, FOAM, 0.45 * (1 - d / 0.035));
          // 高い素材の縁の影（草の縁の下の道・砂）
          else if (!isW[m1] && !isW[m2]) { const lo = inf[m1].pri < inf[m2].pri ? m1 : m2; if (lo === m1 && inf[m2].halo) p = tint(p, [8, 8, 20], -inf[m2].halo * 0.5 * (1 - d / BAND)); }
        }
        // 水: 岸の近く（陸の重み）ほど浅瀬の色
        if (anyWater && anyLand && isW[m1] && land > 0.02) p = tint(p, inf[m1].shallow || SHALLOW, Math.min(0.55, land * 1.1));
        if (MK) MK[row + x] = isW[m1] ? 128 + Math.min(127, (land * 127) | 0) : anyWater ? Math.min(127, ((1 - land) * 127) | 0) : 0;
        dst[row + x] = p;
      }
    }
    return true;
  };
  let RVS = null;
  function texel(s, WX, WY, nz, S, vo) {
    const A = s.a, SA = A.S, pa = A.px[(((WY % SA) + SA) % SA) * SA + (((WX % SA) + SA) % SA)];
    if (!s.b) return pa;
    // 変化の絵: 大きなノイズ（ずらした表を 4 倍に引き伸ばして読む）で A と B。起伏があれば日なた・尾根 = B、陰・谷 = A
    let v = RVS ? T._reliefVar(RVS, WX, WY) : -1;
    if (v < 0) { const qx = ((((WX >> 2) + vo[0]) % S) + S) % S, qy = ((((WY >> 2) + vo[1]) % S) + S) % S; v = nz[qy * S + qx]; }
    if (v < 0.44) return pa;
    const B = s.b, SB = B.S, pb = B.px[(((WY % SB) + SB) % SB) * SB + (((WX % SB) + SB) % SB)];
    if (v > 0.56) return pb;
    return mixPx(pa, pb, (v - 0.44) / 0.12);
  }
})(window.RPG);
