// TERRAIN: ワールドの起伏（WORLD v3 の奥行き、2026-09-28。map.splat のマップ = ワールド）。オーナーの報告「フィールドが平坦でしょぼい」への答え（段 1: 絵を足さない）。
// マップの凡例から高さの場を作り（山・丘は高く、野は中、岸・水は低い。距離の場＋低い周波数のノイズでなめらかに）、チャンクを焼くときに
// 地面の画素へ陰影を焼き込む。毎フレームの仕事は無い（打ち寄せる波の線だけ FIELD が描く。T._foamDraw）。
//   陰影 = 左上からの光（日の当たる斜面は明るく、陰の斜面は暗く青く）＋曲がり（尾根は明るく、山の足もと・谷は暗い）＋森の縁の AO
//   ＋急な所の地肌（崖・がれ）＋大きな色のゆらぎ（地方の色のまま、広い所が 1 色にならない）＋水の深さ＋岸・川べりの濡れた砂と土。
//
//   T._relief(map) → {w, h, H: Float32Array（高さ、マス単位）, O: Uint8Array（森の覆い 0〜255）, ready} | null（ワールドでない）
//   T._reliefJob(map) → Job（prewarm が暗転の中で進める。step(ms)）
//   T._reliefApply(job)  チャンクの px（地面を焼いた直後）に陰影を掛ける（chunks.js の 'relief'）。job.wmask = splat の水の印
//   T._foamOf(job) → Path2D の組 | null（岸の打ち寄せる線。チャンクの結果に持たせる）、T._foamDraw(g, e, x, y, time)  FIELD が毎フレーム
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const U = () => T._u;

  // ------------------------------------------------------------------ 調整の値（見た目）
  const K = {
    light: [-0.62, -0.78, 0.9],   // 光の向き（左上・北西から。x 右、y 下、z 上）
    shade: 1,                     // 斜面の明暗の強さ
    z: 4,                       // 陰影を出すときの高さの誇張（高さの場は歩く所の見た目に合わせて低め）
    curv: 0.8,                   // 曲がり（尾根の明るさ・足もとの暗さ）
    occ: 0.3,                     // 森の縁の AO
    fMin: 0.45, fMax: 1.3,
    steep: [0.55, 1.25],          // この傾き（マスあたりの高さ）から地肌が出る
    macro: 0.6,                   // 大きな色のゆらぎの強さ
    deep: 0.3,                    // 水の深さの暗さ
    wet: 0.2,                     // 濡れた砂・土の暗さ
    faceMax: 0.42,                // 岸の崖の面のいちばん長い所（マス）
  };
  T._RELIEF_K = K;

  // ------------------------------------------------------------------ 凡例 → 種類
  // kind: 0 陸 1 水 2 山、fam: 色のゆらぎの組
  const FAM = { grass: 1, forest: 2, sand: 3, snow: 4, ash: 5, marsh: 6, rock: 7, road: 8, clay: 9 };
  function famOf(mat) {
    if (/snow|ice/.test(mat)) return FAM.snow;
    if (/ash|obsidian|lava/.test(mat)) return FAM.ash;
    if (/sand|dune/.test(mat)) return FAM.sand;
    if (/clay/.test(mat)) return FAM.clay;
    if (/peat|marsh|bog|reeds|mud/.test(mat)) return FAM.marsh;
    if (/forest|root|moss|undergrowth/.test(mat)) return FAM.forest;
    if (/rock|scree|cliff|wall/.test(mat)) return FAM.rock;
    if (/road|highway|dirt|path|plank|bridge/.test(mat)) return FAM.road;
    return FAM.grass;
  }
  function legendInfo(map) {
    const out = {}, L = map.legend || {};
    for (const ch of Object.keys(L)) {
      const e = L[ch], m = T._matInfo(e.mat) || {};
      const lava = /lava/.test(e.mat);
      const water = !!m.water && !lava;
      const mtn = !!e.solid && !!e.rise && /rock|cliff|wall_snow/.test(e.mat);
      const tree = m.tall === 'tree' || m.tall === 'canopy' || m.tall === 'bush' || /^(tree|forest_dark|bush)$/.test(e.mat);
      const under = tree && e.under ? e.under : e.mat;
      out[ch] = {
        kind: water ? 1 : mtn ? 2 : 0, lvl: mtn ? Math.max(1, e.rise || 1) : 0, tree, lava,
        deep: /deep/.test(e.mat) ? 1 : /shallow/.test(e.mat) ? -1 : 0, lake: /lake|marsh_water/.test(e.mat),
        sand: /sand|dune/.test(under), wf: (/deep/.test(e.mat) ? 4 : 0) | (/shallow/.test(e.mat) ? 8 : 0) | (/lake|marsh_water/.test(e.mat) ? 16 : 0), fam: tree && !e.under && e.mat === 'forest_dark' ? FAM.forest : famOf(under),
      };
    }
    return out;
  }

  // ------------------------------------------------------------------ 距離の場（面取り 10 / 14 の整数、2 回の走査。値は距離 × 10）
  function dist(src, w, h, cap) {
    const d = new Uint16Array(w * h), C = cap * 10;
    for (let i = 0; i < d.length; i++) d[i] = src[i] ? 0 : C;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const i = o + x; let v = d[i]; if (v === 0) continue; let q;
        if (x > 0) { q = d[i - 1] + 10; if (q < v) v = q; }
        if (y > 0) { q = d[i - w] + 10; if (q < v) v = q; if (x > 0) { q = d[i - w - 1] + 14; if (q < v) v = q; } if (x < w - 1) { q = d[i - w + 1] + 14; if (q < v) v = q; } }
        d[i] = v;
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const o = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const i = o + x; let v = d[i]; if (v === 0) continue; let q;
        if (x < w - 1) { q = d[i + 1] + 10; if (q < v) v = q; }
        if (y < h - 1) { q = d[i + w] + 10; if (q < v) v = q; if (x < w - 1) { q = d[i + w + 1] + 14; if (q < v) v = q; } if (x > 0) { q = d[i + w - 1] + 14; if (q < v) v = q; } }
        d[i] = v;
      }
    }
    return d;
  }
  /** 横と縦の箱のぼかし（半径 r）。端は端の値を伸ばす */
  function blur(a, w, h, r, tmp) {
    const n = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let k = -r; k <= r; k++) s += a[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) { tmp[o + x] = s / n; s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) { a[y * w + x] = s / n; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
    }
  }

  // ------------------------------------------------------------------ マップの高さの場（1 回だけ。暗転の中で区切って作る）
  // 高さは 2 × 2 マスで 1 つ（Q）。丘・山のすそは広いので足り、作る時間と量が 1/4（672×576 のワールドで 336×288 = 約 0.5 MB）。
  // 岸・川べりの細かい形は splat の水の印（画素ごと）で描くので、ここでは要らない。
  const Q = 2;
  const cache = new WeakMap();
  // 重い繰り返しは普通の関数に分ける（生成器の中の繰り返しは速くならない）
  /** 2 × 2 のマスの多い方: kind 0 陸 1 水 2 山（lvl = 山の高さ）、flag: 2 砂 4 深い 8 浅い 16 湖、tr = 木の割合。行 Y0〜Y1 */
  function classify(c, Y0, Y1) {
    const { rows, info, W0, H0, w, kind, lvl, flag, tr } = c;
    for (let Y = Y0; Y < Y1; Y++) {
      const r0 = rows[Math.min(H0 - 1, Y * Q)], r1 = rows[Math.min(H0 - 1, Y * Q + 1)];
      for (let X = 0; X < w; X++) {
        let nw = 0, nm = 0, nt = 0, ns = 0, lv = 0, fl = 0;
        for (let k = 0; k < 4; k++) {
          const f = info[(k < 2 ? r0 : r1).charAt(Math.min(W0 - 1, X * Q + (k & 1)))];
          if (!f) continue;
          if (f.kind === 1) { nw++; fl |= f.wf; } else if (f.kind === 2) { nm++; if (f.lvl > lv) lv = f.lvl; }
          if (f.tree) nt++;
          if (f.sand) ns++;
        }
        const i = Y * w + X, kd = nw >= 2 ? 1 : nm >= 2 ? 2 : 0;
        kind[i] = kd; lvl[i] = lv; tr[i] = nt / 4;
        flag[i] = (kd === 1 ? fl : 0) | (ns >= 2 ? 2 : 0);
      }
    }
  }
  /** 値のノイズ（u.vn と同じ形）を格子の表から直に足す */
  function noiseAdd(NZ, w, h, L, sd, amp, h3, ridge) {
    const gw = Math.ceil(w / L) + 2, gh = Math.ceil(h / L) + 2, lat = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) lat[j * gw + i] = h3(i, j, sd);
    for (let y = 0; y < h; y++) {
      const fy0 = y / L, j = fy0 | 0, ty = fy0 - j, sy = ty * ty * (3 - 2 * ty), o0 = j * gw, o1 = o0 + gw;
      for (let x = 0; x < w; x++) {
        const fx0 = x / L, i = fx0 | 0, tx = fx0 - i, sx = tx * tx * (3 - 2 * tx);
        const a = lat[o0 + i], b = lat[o0 + i + 1], c = lat[o1 + i], d = lat[o1 + i + 1];
        const v = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        NZ[y * w + x] += (ridge ? 1 - Math.abs(v * 2 - 1) : v) * amp;   // ridge = 尾根の筋（なだらかな丘に背を作る）
      }
    }
  }
  /** 高さ（マス単位）。距離は × 10 の高さの格子の単位なのでマスに直す（× Q / 10） */
  function heights(c, D, NZ, H) {
    const { kind, lvl, flag, tr, N } = c, q = Q / 10, dW = D.W, dL = D.L, dM = D.M, dI = D.I, dB = D.B;
    for (let i = 0; i < N; i++) {
      const k = kind[i], n = NZ[i] - 0.5;
      if (k === 1) {
        const dd = 1 - Math.exp(-dL[i] * q / 5), f = flag[i];
        H[i] = f & 8 ? -0.18 - dd * 0.3 : f & 16 ? -0.3 - dd * 0.7 : -0.3 - dd * (f & 4 ? 1.6 : 1.1);
        continue;
      }
      const dw = dW[i] * q, coast = 1 - Math.exp(-dw / 8), flat = Math.min(1, dB[i] * q / 7);
      let v = 0.2 + 1.2 * coast;
      v += n * 4.2 * Math.min(1, dw / 5) * (0.35 + 0.65 * flat);   // 丘（岸と町の近くは弱く）
      if (flag[i] & 2) v -= 0.25;                                   // 砂浜は低い
      else v += 0.95 * Math.exp(-dw / 3) * Math.max(0, Math.min(1, (NZ[i] - 0.42) * 4));   // 草の岸はところどころ高い崖（面は ledges が水の上に描く）
      if (k === 2) v += 1.7 + (lvl[i] - 1) * 1.3 + 1.6 * (1 - Math.exp(-dI[i] * q / 2.2)) + n * 0.8;   // 山: 縁から奥へ高く
      else v += 1.5 * Math.exp(-dM[i] * q / 4) + tr[i] * 0.15;     // 山のすそ・森はわずかに高い
      H[i] = v;
    }
  }
  function mask(src, N, fn) { const m = new Uint8Array(N); for (let i = 0; i < N; i++) m[i] = fn(src[i]) ? 1 : 0; return m; }
  function* build(map, out) {
    const u = U(), W0 = map.w, H0 = map.h, w = Math.ceil(W0 / Q), h = Math.ceil(H0 / Q), N = w * h, grid = R.MapUtil.grid(map);
    const rows = [];
    for (let y = 0; y < H0; y++) { const row = grid[y] || ''; rows.push(row.length === W0 ? row : [...row].join('')); }
    const c = { rows, info: out.info, W0, H0, w, h, N, kind: new Uint8Array(N), lvl: new Uint8Array(N), flag: new Uint8Array(N), tr: new Float32Array(N) };
    for (let Y = 0; Y < h; Y += 72) { classify(c, Y, Math.min(h, Y + 72)); yield; }
    const kind = c.kind, D = {};
    D.W = dist(mask(kind, N, (k) => k === 1), w, h, 60); yield;   // 陸 → 水までの距離（× 10、高さの格子の単位）
    D.L = dist(mask(kind, N, (k) => k !== 1), w, h, 60); yield;   // 水 → 陸まで
    D.M = dist(mask(kind, N, (k) => k === 2), w, h, 60); yield;   // 山まで
    D.I = dist(mask(kind, N, (k) => k !== 2), w, h, 60); yield;   // 山の中 → 山の外まで
    // 町・建物の周りは起伏を弱める（家が斜面に傾いて見えないように）
    const bm = new Uint8Array(N);
    for (const o of map.objects || []) if (o.type === 'building' && o.x != null) for (let y = o.y - 1; y < o.y + (o.h || 3) + 1; y++) for (let x = o.x - 1; x < o.x + (o.w || 3) + 1; x++) if (x >= 0 && y >= 0 && x < W0 && y < H0) bm[Math.floor(y / Q) * w + Math.floor(x / Q)] = 1;
    D.B = dist(bm, w, h, 30); yield;
    // 丘のノイズ: 大きいうねり（約 44 マス）＋尾根の筋（約 17 マス）。細かい段は入れない（雲の影のように見える）
    const NZ = new Float32Array(N);
    noiseAdd(NZ, w, h, 44 / Q, 911, 0.72, u.h3, false); noiseAdd(NZ, w, h, 17 / Q, 912, 0.28, u.h3, true);
    yield;
    const H = new Float32Array(N);
    heights(c, D, NZ, H); yield;
    const tmp = new Float32Array(N);
    blur(H, w, h, 1, tmp); yield;
    // 森の覆い（木のマスの割合をぼかした物）
    const tr = c.tr;
    blur(tr, w, h, 1, tmp);
    const O = new Uint8Array(N);
    for (let i = 0; i < N; i++) O[i] = Math.round(Math.min(1, tr[i]) * 255);
    out.w = w; out.h = h; out.H = H; out.O = O;
    out.ready = true;
    if (R.Hd && R.Hd.track) R.Hd.track('chunk', 'terrain:relief:' + map.id, N * 5);
  }
  function entry(map) {
    let r = cache.get(map);
    if (!r) { r = { w: 0, h: 0, ready: false, gen: null, info: legendInfo(map) }; cache.set(map, r); }
    return r;
  }
  T._relief = function (map) {
    if (!map || !map.splat) return null;
    const r = entry(map);
    if (!r.ready) { if (!r.gen) r.gen = build(map, r); while (!r.gen.next().done) { /* 焼く前に要る: 一度に作り切る */ } r.gen = null; }
    return r;
  };
  T._reliefJob = function (map) {
    const job = { kind: 'relief', done: false, result: null, ms: 0,
      step(ms) {
        const t0 = U().now(), deadline = t0 + (ms == null ? 3 : ms);
        if (!map || !map.splat) { job.done = true; return true; }
        const r = entry(map);
        if (!r.ready && !r.gen) r.gen = build(map, r);
        while (!r.ready) { if (r.gen.next().done) break; if (U().now() > deadline) break; }
        if (r.ready) { r.gen = null; job.done = true; job.result = r; }
        job.ms += U().now() - t0;
        return job.done;
      } };
    return job;
  };
  T._reliefForget = function (map) { if (map) cache.delete(map); };

  // ------------------------------------------------------------------ 色のゆらぎ（組ごとの 2 つの色の向き。昼の色に足す値）
  //   a = 大きいゆらぎ（約 40 マス）の向き、b = 中くらい（約 14 マス）の向き
  const TINT = {
    1: [[16, 8, -10], [-10, 6, 8]],      // 草: 乾いた黄緑 ↔ 青みの濃い緑
    2: [[10, 2, -8], [-8, 8, 0]],        // 森の地面: 茶 ↔ 苔
    3: [[12, 9, 4], [-10, -9, -6]],      // 砂: 明るい ↔ 湿った暗い
    4: [[-8, -2, 8], [6, 6, 2]],         // 雪: 青い影 ↔ 白
    5: [[12, 0, -6], [-6, -6, -2]],      // 灰: 赤茶 ↔ 灰
    6: [[8, 8, -8], [-8, -2, 4]],        // 湿原: 黄土 ↔ 青緑
    7: [[8, 4, 0], [-6, -4, 2]],         // 岩
    8: [[8, 4, -4], [-6, -4, 0]],        // 道
    9: [[12, 4, -6], [-8, -6, -2]],      // 粘土
  };
  // 急な所の地肌の色（組ごと。昼の色）
  const BARE = { 1: [92, 80, 62], 2: [70, 58, 44], 3: [150, 132, 104], 4: [150, 160, 178], 5: [70, 62, 60], 6: [80, 76, 58], 7: [96, 90, 96], 8: [110, 92, 70], 9: [120, 96, 74] };

  // ------------------------------------------------------------------ チャンクに掛ける
  // 標本は B px ごと（B = tile / 8、世界の座標の格子なので隣のチャンクと同じ値）。標本ごとに 3 次の B スプラインで高さ・傾き・曲がりを出し、
  // 画素ごとには標本の間を双一次でつなぐ。段（崖の面）を探すために、チャンクの上に EP px 分の行も数える（上のチャンクと同じ値）
  // 標本の組は仕事ごと（地面を焼く間に別の仕事が入る）。画素の段の一時の入れ物は 1 組を使い回す（apply は一度に終わる）
  const bufs = {};
  function buf(name, n, T8) { const k = name + n; return bufs[k] || (bufs[k] = new (T8 || Float32Array)(n)); }
  const spool = [];
  /** 標本を先に（地面を焼く前。splat が草の変化の絵を選ぶのに V を使う: 日の当たる尾根は乾いた色、陰の谷は濃い色） */
  T._reliefPrep = function (job) {
    const map = job.map, rf = T._relief(map);
    if (!rf || !rf.ready) return null;
    const u = U(), t = job.tile, S = job.size, X0 = job.X0, Y0 = job.Y0;
    const B = Math.max(2, t >> 3), N = Math.floor(S / B) + 1;
    const FH = Math.round(t * K.faceMax), E = Math.ceil((FH + 2) / B), EP = E * B, NR = N + E, NS = NR * N;   // 上に足す行（標本 E 行 = EP px）
    const w = rf.w, h = rf.h, H = rf.H, O = rf.O, info = rf.info, grid = R.MapUtil.grid(map), MW = map.w, MH = map.h, iq = 1 / Q;
    /** 世界の px の下のマスの凡例の種類（無ければ null） */
    const cellAt = (wx0, wy0) => { const ci = Math.floor(wx0 / t), cj = Math.floor(wy0 / t); if (ci < 0 || cj < 0 || ci >= MW || cj >= MH) return null; const row = grid[cj] || ''; return info[row.length === MW ? row.charAt(ci) : [...row][ci]] || null; };
    let rs = spool.pop();
    if (!rs || rs.NS !== NS) rs = { NS, F: new Float32Array(NS), Fw: new Float32Array(NS), DR: new Float32Array(NS), DG: new Float32Array(NS), DB: new Float32Array(NS), BA: new Float32Array(NS), HS: new Float32Array(NS), V: new Float32Array(NS) };
    Object.assign(rs, { N, NR, E, EP, FH, B, X0, Y0, S });
    const F = rs.F, Fw = rs.Fw, DR = rs.DR, DG = rs.DG, DB = rs.DB, BA = rs.BA, HS = rs.HS, V = rs.V;
    const Lx = K.light[0], Ly = K.light[1], Lz = K.light[2], Ll = Math.hypot(Lx, Ly, Lz), lx = Lx / Ll, ly = Ly / Ll, lz = Lz / Ll;
    const Hat = (x, y) => H[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
    const wx = new Float32Array(4), dx = new Float32Array(4), sx = new Float32Array(4), wy = new Float32Array(4), dy = new Float32Array(4), sy = new Float32Array(4);
    const basis = (f, W, D, S2) => {
      const f2 = f * f, f3 = f2 * f, g = 1 - f;
      W[0] = g * g * g / 6; W[1] = (3 * f3 - 6 * f2 + 4) / 6; W[2] = (-3 * f3 + 3 * f2 + 3 * f + 1) / 6; W[3] = f3 / 6;
      D[0] = -g * g / 2; D[1] = (3 * f2 - 4 * f) / 2; D[2] = (-3 * f2 + 2 * f + 1) / 2; D[3] = f2 / 2;
      S2[0] = g; S2[1] = 3 * f - 2; S2[2] = -3 * f + 1; S2[3] = f;
    };
    const hv = new Float32Array(16);
    for (let jj = 0; jj < NR; jj++) {
      const j = jj - E, py = Y0 + j * B, fy0 = (py / t) * iq - 0.5, cy = Math.floor(fy0);
      basis(fy0 - cy, wy, dy, sy);
      for (let i = 0; i < N; i++) {
        const px = X0 + i * B, fx0 = (px / t) * iq - 0.5, cx = Math.floor(fx0);
        basis(fx0 - cx, wx, dx, sx);
        for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) hv[b * 4 + a] = Hat(cx - 1 + a, cy - 1 + b);
        let hh = 0, hx = 0, hy = 0, hxx = 0, hyy = 0;
        for (let b = 0; b < 4; b++) {
          let r0 = 0, r1 = 0, r2 = 0;
          for (let a = 0; a < 4; a++) { const v = hv[b * 4 + a]; r0 += wx[a] * v; r1 += dx[a] * v; r2 += sx[a] * v; }
          hh += wy[b] * r0; hx += wy[b] * r1; hy += dy[b] * r0; hxx += wy[b] * r2; hyy += sy[b] * r0;
        }
        hx *= iq; hy *= iq; hxx *= iq * iq; hyy *= iq * iq;   // 高さの格子（Q マス）→ マスあたり
        const q = jj * N + i, sl = Math.sqrt(hx * hx + hy * hy);
        HS[q] = hh;
        if (j < 0) continue;
        // 明暗: 面の向き（Lambert、平らな所を 1 に。高さは K.z 倍に誇張）＋曲がり（尾根は明るく、足もと・谷は暗く）
        const zx = hx * K.z, zy = hy * K.z, nl = 1 / Math.sqrt(zx * zx + zy * zy + 1);
        const d = (-zx * lx - zy * ly + lz) * nl;
        let f = 1 + K.shade * (d / lz - 1);
        const lap = hxx + hyy;
        f -= K.curv * Math.max(-0.6, Math.min(0.6, lap)) * 0.5;
        const ce = cellAt(px, py);
        // 森の縁の AO（高さの格子で双一次）
        const ox = Math.max(0, Math.min(w - 2, cx)), oy = Math.max(0, Math.min(h - 2, cy));
        const ax = Math.max(0, Math.min(1, fx0 - ox)), ay = Math.max(0, Math.min(1, fy0 - oy)), o0 = oy * w + ox;
        f -= K.occ * (((O[o0] * (1 - ax) + O[o0 + 1] * ax) * (1 - ay) + (O[o0 + w] * (1 - ax) + O[o0 + w + 1] * ax) * ay) / 255);
        if (f < K.fMin) f = K.fMin; else if (f > K.fMax) f = K.fMax;
        F[q] = f;
        // 草の変化の絵の選び: 日なた・尾根 → 高い値、陰・谷 → 低い値（元のノイズも少し残す）
        V[q] = 0.5 + (f - 1) * 1.0 + (u.vn(px / t, py / t, 9, 961) - 0.5) * 0.45;
        // 水: 深さで暗く（溶岩は変えない）
        Fw[q] = ce && ce.kind === 1 ? 1 - K.deep * Math.max(0, Math.min(1, -hh / 1.6)) : 1;
        // 色のゆらぎ（地方の色の組ごと。大きい 40 マス・中 14 マス）
        const tt = TINT[ce ? ce.fam : 1] || TINT[1];
        const na = (u.vn(px / t, py / t, 40, 921) - 0.5) * 2, nb = (u.vn(px / t, py / t, 14, 922) - 0.5) * 2, mk = K.macro * (ce && ce.lava ? 0 : 1);
        // 高い所は少し冷たく、低い所は少し暖かく
        const lift = Math.max(-1, Math.min(1, (hh - 1.2) / 2.5));
        DR[q] = (tt[0][0] * na + tt[1][0] * nb) * mk - lift * 4;
        DG[q] = (tt[0][1] * na + tt[1][1] * nb) * mk + lift * 1;
        DB[q] = (tt[0][2] * na + tt[1][2] * nb) * mk + lift * 6;
        // 急な所の地肌（崖・がれ場）: 割合
        let ba = (sl - K.steep[0]) / (K.steep[1] - K.steep[0]);
        ba = ba <= 0 ? 0 : ba >= 1 ? 1 : ba * ba * (3 - 2 * ba);
        if (ce && ce.kind === 1) ba = 0;
        BA[q] = ba * 0.55;
      }
    }
    return rs;
  };
  /** 地面の画素に掛ける（地面を焼いた後。rs = T._reliefPrep の標本） */
  // 帯（RBANDS）に分けて呼ぶ（1 回の仕事を短く）。band = 0〜RBANDS-1、最後の帯の後で岸の崖の面。true = 全部済んだ
  const RBANDS = 3;
  T._reliefApply = function (job, band) {
    const rs = job.rs, map = job.map, rf = T._relief(map);
    if (!rs || !rf || !job.px) return true;
    if (band == null) { for (let b = 0; b < RBANDS; b++) T._reliefApply(job, b); return true; }
    const u = U(), t = job.tile, S = job.size, X0 = job.X0, Y0 = job.Y0, info = rf.info, grid = R.MapUtil.grid(map), MW = map.w, MH = map.h;
    const { N, NR, EP, FH, B, F, Fw, DR, DG, DB, BA, HS } = rs;
    const cellAt = (wx0, wy0) => { const ci = Math.floor(wx0 / t), cj = Math.floor(wy0 / t); if (ci < 0 || cj < 0 || ci >= MW || cj >= MH) return null; const row = grid[cj] || ''; return info[row.length === MW ? row.charAt(ci) : [...row][ci]] || null; };
    // 画素ごと（上の EP 行は高さ・水かだけ）
    const px8 = new Uint8ClampedArray(job.px.buffer, job.px.byteOffset, S * S * 4), wm = job.wmask;
    const SH = S + EP;
    if (!rs.PH || rs.PH.length !== SH * S) { rs.PH = new Float32Array(SH * S); rs.PW = new Uint8Array(SH * S); }
    const PH = rs.PH, PW = rs.PW;
    const hb = Math.ceil(S / RBANDS), yA = band === 0 ? 0 : EP + band * hb, yB = Math.min(SH, EP + (band + 1) * hb);
    const rF = buf('rF', N), rW = buf('rW', N), rR = buf('rR', N), rG = buf('rG', N), rB = buf('rB', N), rA = buf('rA', N), rH = buf('rH', N);
    const invB = 1 / B;
    const fmAt = (x, y) => { const c = cellAt(X0 + x, Y0 + y); return c ? c.fam : 1; };
    for (let yy = yA; yy < yB; yy++) {
      const y = yy - EP, gj = yy * invB, jj = Math.min(NR - 2, gj | 0), fy = gj - jj, gy = 1 - fy, r0 = jj * N, r1 = r0 + N, top = y < 0;
      for (let i = 0; i < N; i++) {
        rH[i] = HS[r0 + i] * gy + HS[r1 + i] * fy;
        if (top) continue;
        rF[i] = F[r0 + i] * gy + F[r1 + i] * fy; rW[i] = Fw[r0 + i] * gy + Fw[r1 + i] * fy;
        rR[i] = DR[r0 + i] * gy + DR[r1 + i] * fy; rG[i] = DG[r0 + i] * gy + DG[r1 + i] * fy; rB[i] = DB[r0 + i] * gy + DB[r1 + i] * fy;
        rA[i] = BA[r0 + i] * gy + BA[r1 + i] * fy;
      }
      const prow = yy * S;
      if (top) {
        // 上のチャンクの行: 水かはマスから（splat の岸のうねりとは少し違うが、段の面の長さを決めるだけ）
        let cw = -1, cwv = 0;
        for (let x = 0; x < S; x++) {
          const gi = x * invB, i = Math.min(N - 2, gi | 0), fx = gi - i, gx = 1 - fx;
          PH[prow + x] = rH[i] * gx + rH[i + 1] * fx;
          const ci = Math.floor((X0 + x) / t);
          if (ci !== cw) { cw = ci; const c = cellAt(X0 + x, Y0 + y); cwv = c && c.kind === 1 ? 1 : 0; }
          PW[prow + x] = cwv;
        }
        continue;
      }
      const row = y * S;
      let bare = null, bfm = -1;
      for (let x = 0; x < S; x++) {
        const gi = x * invB, i = Math.min(N - 2, gi | 0), fx = gi - i, gx = 1 - fx, k = row + x, q = k * 4;
        PH[prow + x] = rH[i] * gx + rH[i + 1] * fx;
        const m = wm ? wm[k] : 0;
        let r = px8[q], g = px8[q + 1], b = px8[q + 2];
        if (m >= 128) {
          // 水
          PW[prow + x] = 1;
          const fw = rW[i] * gx + rW[i + 1] * fx;
          px8[q] = r * fw; px8[q + 1] = g * fw; px8[q + 2] = b * (fw * 0.7 + 0.3);
          continue;
        }
        PW[prow + x] = 0;
        const f = rF[i] * gx + rF[i + 1] * fx;
        // 急な所の地肌
        const ba = rA[i] * gx + rA[i + 1] * fx;
        if (ba > 0.01) {
          const fmx = fmAt(x, y);
          if (fmx !== bfm) { bfm = fmx; bare = BARE[fmx] || BARE[1]; }
          const nz = u.h3((X0 + x) >> 1, (Y0 + y) >> 1, 931) * 0.5 + 0.75, a = Math.min(0.85, ba * nz);
          r += (bare[0] - r) * a; g += (bare[1] - g) * a; b += (bare[2] - b) * a;
        }
        const dr = rR[i] * gx + rR[i + 1] * fx, dg = rG[i] * gx + rG[i + 1] * fx, db = rB[i] * gx + rB[i + 1] * fx;
        // 岸・川べりの濡れた砂と土（splat の水の近さ 1〜127）
        if (m > 44) { const wv = Math.min(1, (m - 44) / 24), wt = wv * wv * (3 - 2 * wv) * K.wet; r *= 1 - wt; g *= 1 - wt * 0.9; b *= 1 - wt * 0.72; }
        // 陰は青く、日なたは少し暖かく
        const fb = f < 1 ? 1 - (1 - f) * 0.78 : f;
        const fr = f > 1 ? 1 + (f - 1) * 1.1 : f;
        px8[q] = r * fr + dr; px8[q + 1] = g * f + dg; px8[q + 2] = b * fb + db;
      }
    }
    if (band < RBANDS - 1) return false;
    ledges(px8, PH, PW, S, EP, FH, X0, Y0, fmAt, u);
    if (spool.length < 3) spool.push(rs);
    job.rs = null;
    return true;
  };
  T._RELIEF_BANDS = RBANDS;
  /** splat の草の変化の値（世界の px）: 標本の間を双一次。範囲の外は -1（元のノイズ） */
  T._reliefVar = function (rs, WX, WY) {
    const gx = (WX - rs.X0) / rs.B, gy = (WY - rs.Y0) / rs.B + rs.E, N = rs.N;
    if (gx < 0 || gy < rs.E || gx >= N - 1 || gy >= rs.NR - 1) return -1;
    const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, q = j * N + i, V = rs.V;
    return (V[q] * (1 - fx) + V[q + 1] * fx) * (1 - fy) + (V[q + N] * (1 - fx) + V[q + N + 1] * fx) * fy;
  };

  // ------------------------------------------------------------------ 岸の崖（段の面）
  // 南向き（画面の下が水）の岸で、陸が高い所だけ、水の上に崖の面（地肌の色、上は明るい縁、下へ暗く・すじ）と面の下の落ち影を描く。
  // 砂浜・山の岩（立ち上がりの面がある）には描かない。列ごとに上から下へ見るので、上のチャンクの行（EP）から数える（継ぎ目が出ない）

  const FACE = { 1: [98, 84, 60], 2: [76, 62, 46], 3: [160, 140, 108], 4: [170, 180, 196], 5: [74, 64, 60], 6: [86, 80, 60], 7: [104, 96, 104], 8: [112, 94, 70], 9: [128, 100, 76] };
  function ledges(px8, PH, PW, S, EP, FH, X0, Y0, fmAt, u) {
    const SH = S + EP;
    const paint = (k, c, a) => { const q = k * 4; px8[q] += (c[0] - px8[q]) * a; px8[q + 1] += (c[1] - px8[q + 1]) * a; px8[q + 2] += (c[2] - px8[q + 2]) * a; };
    const mul = (k, f) => { const q = k * 4; px8[q] *= f; px8[q + 1] *= f; px8[q + 2] *= f < 1 ? 1 - (1 - f) * 0.8 : f; };
    for (let x = 0; x < S; x++) {
      let prev = PW[x];
      for (let yy = 1; yy < SH; yy++) {
        const wv = PW[yy * S + x];
        if (wv === prev) continue;
        prev = wv;
        // 岸（陸 → 水、南向き）だけ面を描く。陸の中の段は面を描かない（歩ける所に崖を描くと当たりと食い違う）
        if (!wv) continue;
        const hu = PH[(yy - 1) * S + x], fm = fmAt(x, Math.max(0, yy - 1 - EP));
        if (fm === 7 || fm === 3) continue;   // 山の岩（立ち上がりの面がある）・砂浜は面なし
        // 陸が高いほど長い面（低い岸は無し）
        const a = Math.max(0, Math.min(1, (hu - 0.45) / 0.5)), fh = Math.round(FH * 0.75 * a);
        if (fh < 2) continue;
        const fc = FACE[fm] || FACE[1];
        // 上の縁（高い側の最後の 2 px）: 明るい
        for (let e = 1; e <= 2; e++) { const y = yy - e - EP; if (y >= 0) mul(y * S + x, 1 + (0.28 / e) * Math.min(1, a * 1.5)); }
        // 面（上から下へ暗く、細かいすじ）
        for (let e = 0; e < fh; e++) {
          const y = yy + e - EP;
          if (y < 0) continue;
          if (y >= S) break;
          const dd = e / fh, st = u.h3((X0 + x) >> 1, Math.floor((Y0 + y) / 3), 951);
          const sh = 0.95 - dd * 0.42 + (st - 0.5) * 0.14;
          const k = y * S + x;
          paint(k, [fc[0] * sh, fc[1] * sh, fc[2] * sh], 0.9);
        }
        // 面の下の落ち影（水にも）
        const sd = Math.round(fh * 0.7);
        for (let e = 0; e < sd; e++) { const y = yy + fh + e - EP; if (y < 0) continue; if (y >= S) break; mul(y * S + x, 1 - 0.3 * (1 - e / sd)); }
      }
    }
  }
  // ------------------------------------------------------------------ 打ち寄せる波の線（岸の泡。FIELD が毎フレーム、明るさだけ揺らして描く）
  // splat の水の印（水の画素 = 128 + 陸の重み）を G px の格子で読み、陸の重みの等高線（岸に近い線と少し沖の線）を
  // 四角の行進（marching squares）で線分にして Path2D に。チャンクごとに 2 本（数 KB）。
  const FOAM_LV = [0.34, 0.16];
  T._foamOf = function (job) {
    const wm = job.wmask, S = job.size;
    if (!wm || typeof Path2D === 'undefined') return null;
    let any = false;
    for (let i = 0; i < wm.length; i += 7) if (wm[i] >= 128) { any = true; break; }
    if (!any) return null;
    const G = Math.max(2, job.tile >> 3), n = Math.floor(S / G) + 1, val = new Float32Array(n * n);
    let land = false, water = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = Math.min(S - 1, i * G), y = Math.min(S - 1, j * G), m = wm[y * S + x];
      const v = m === 1 ? -1 : m >= 128 ? (m - 128) / 127 : 1;   // 1 = 硬い素材の表示のタイル（分からない: 線を引かない）
      val[j * n + i] = v;
      if (v >= 1) land = true; else if (v >= 0) water = true;
    }
    if (!land || !water) return null;
    const out = [];
    for (const lv of FOAM_LV) {
      const p = new Path2D();
      let segs = 0;
      const lerp = (a, b) => (lv - a) / (b - a);
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const a = val[j * n + i], b = val[j * n + i + 1], c = val[(j + 1) * n + i + 1], d = val[(j + 1) * n + i];
        if (a < 0 || b < 0 || c < 0 || d < 0) continue;
        const code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x0 = i * G, y0 = j * G;
        const T0 = [x0 + lerp(a, b) * G, y0], R0 = [x0 + G, y0 + lerp(b, c) * G], B0 = [x0 + lerp(d, c) * G, y0 + G], L0 = [x0, y0 + lerp(a, d) * G];
        const seg = (P, Qp) => { p.moveTo(P[0], P[1]); p.lineTo(Qp[0], Qp[1]); segs++; };
        switch (code) {
          case 1: case 14: seg(L0, B0); break;
          case 2: case 13: seg(B0, R0); break;
          case 3: case 12: seg(L0, R0); break;
          case 4: case 11: seg(T0, R0); break;
          case 6: case 9: seg(T0, B0); break;
          case 7: case 8: seg(L0, T0); break;
          case 5: seg(L0, T0); seg(B0, R0); break;
          case 10: seg(T0, R0); seg(L0, B0); break;
        }
      }
      if (segs) out.push({ p, lv, ph: ((job.cx * 7 + job.cy * 13) % 10) / 10 });
    }
    return out.length ? { lines: out, s: job.tile / 32 } : null;
  };
  /** 岸の泡を描く（FIELD の地面の後）。x, y = チャンクの左上の画面の位置、time = ms。reduce = 動きを減らす */
  T._foamDraw = function (g, foam, x, y, time, reduce) {
    const s = foam.s;
    g.save();
    g.translate(x, y);
    g.lineCap = 'round';
    for (let i = 0; i < foam.lines.length; i++) {
      const L = foam.lines[i];
      // 波: 岸に近い線と沖の線が交互に明るくなる（周期 3.2 秒。チャンクごとに少し位相をずらす）
      const k = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((time / 3200 + L.ph * 0.25 + i * 0.5) * Math.PI * 2);
      g.strokeStyle = 'rgb(190,208,232)';
      // 太く淡い帯の上に細い芯（くっきりした輪郭の線に見えないように）
      g.globalAlpha = ((i ? 0.04 : 0.06) + k * (i ? 0.06 : 0.07));
      g.lineWidth = (i ? 4 : 5) * s;
      g.stroke(L.p);
      g.globalAlpha = ((i ? 0.03 : 0.06) + k * (i ? 0.07 : 0.1));
      g.lineWidth = (i ? 1 : 1.3) * s;
      g.stroke(L.p);
    }
    g.restore();
  };
})(window.RPG);
