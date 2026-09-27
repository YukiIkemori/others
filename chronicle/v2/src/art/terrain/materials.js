// TERRAIN: 素材（V2_PLAN §2.5.8・§2.6.1、MODERN_UI §7.2 F0）。design/art_proto/ui/art_town.js・art_world.js の画素の生成器を
// 「素材 × 変化」の先に焼くタイルに分けた物。
//
//   R.Terrain.material(id) → {bake(ctx, rect, rng, tile), edge:'soft'|'hard', walk}   契約（K.material）
//   R.DB.materials[id] = {name, edge, walk, theme?}                                   契約（K.materialDef。node で id を確かめる用）
//   R.Terrain.matColor(id, solid) → css                                              素材の代表の色（小地図・仮の FIELD の箱）
//
// 素材の絵は「4 × 4 マスで一周する」模様（周期 128 u。u = 画素 × 32 / tile）として 1 枚に焼き（= 16 の変化）、マップの画素 (X, Y) は
// その 1 枚の (X mod S, Y mod S) を写すだけにする（S = 4 × tile）。隣のマス・隣のチャンクと模様が必ずつながる。
// 下地は昼の色で描く（夜は光の地図の掛け算。MODERN_UI §4.1）。純粋な黒は使わない。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});

  // ------------------------------------------------------------------ 小道具（TERRAIN の中だけで使う。T._u）
  const hex = (h) => { h = String(h).replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function ramp(keys, n) {
    const k = keys.map(hex), out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * (k.length - 1), j = Math.min(k.length - 2, Math.floor(t));
      out.push(mix(k[j], k[j + 1], t - j).map(Math.round));
    }
    return out;
  }
  const pick = (r, l) => r[clamp(Math.round(l * (r.length - 1)), 0, r.length - 1)];
  /** 整数 3 つ → [0, 1) */
  function h3(i, j, k) {
    let h = Math.imul(i * 73856093 ^ j * 19349663 ^ k * 83492791, 1274126177);
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  const P = 128; // 模様の周期（u）
  const sm = (t) => t * t * (3 - 2 * t);
  /** 周期 P の値のノイズ。L は格子の間隔（P を割り切る数）、Ly を渡すと縦だけ別の間隔 */
  function pn(u, v, L, s, Ly) {
    Ly = Ly || L;
    const nx = P / L, ny = P / Ly, x = u / L, y = v / Ly;
    const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    const i0 = ((i % nx) + nx) % nx, j0 = ((j % ny) + ny) % ny, i1 = (i0 + 1) % nx, j1 = (j0 + 1) % ny;
    const a = h3(i0, j0, s), b = h3(i1, j0, s), c = h3(i0, j1, s), d = h3(i1, j1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  /** 周期の無い値のノイズ（世界の座標の大きなゆらぎ・印の置き場所） */
  function vn(x, y, L, s) {
    x /= L; y /= L;
    const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    const a = h3(i, j, s), b = h3(i + 1, j, s), c = h3(i, j + 1, s), d = h3(i + 1, j + 1, s);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  /** little-endian の RGBA（Uint32Array に書く形） */
  const pack = (c) => ((255 << 24) | (clamp(c[2] | 0, 0, 255) << 16) | (clamp(c[1] | 0, 0, 255) << 8) | clamp(c[0] | 0, 0, 255)) >>> 0;
  const unpack = (p) => [p & 255, (p >>> 8) & 255, (p >>> 16) & 255];
  function canvas(w, h) {
    if (R.Hd && R.Hd.RZ && R.Hd.RZ.canvas) { try { return R.Hd.RZ.canvas(w, h); } catch (e) { return null; } }
    return R.Gfx && R.Gfx.canvas2d ? R.Gfx.canvas2d(w, h) : null;
  }
  const css = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  T._u = { hex, mix, clamp, ramp, pick, h3, pn, vn, pack, unpack, canvas, css, now, P };

  // ------------------------------------------------------------------ 色の段（昼の色。STYLE_REFERENCE §6.1・ART_REWORK §2.1）
  const PAL = {
    grass: ramp(['#16240e', '#223a14', '#34521c', '#4a6a26', '#628434', '#7e9c46'], 8),
    grassDk: ramp(['#0e180c', '#172612', '#22381a', '#304a22', '#40602c'], 7),
    moss: ramp(['#141c10', '#1e2c18', '#2c4022', '#3c562c', '#527038', '#6a8a44'], 8),
    dirt: ramp(['#2a1e14', '#42301e', '#5c442a', '#76583a', '#8e6e4a'], 7),
    road: ramp(['#2e2418', '#463626', '#5e4a34', '#786046', '#927a58'], 7),
    sand: ramp(['#3a3226', '#5a4e3a', '#7a6c50', '#9a8a68', '#b8a682'], 7),
    // 縦切りの外の雪原・灰の荒野（CONTENT-P の依頼、P2）
    snow: ramp(['#5a6072', '#7c8498', '#a0a8ba', '#c4cad8', '#e2e6ee', '#f4f6fa'], 8),
    ash: ramp(['#1c1a1c', '#2e2a2a', '#44403c', '#5c5650', '#766e66'], 7),
    cobble: ramp(['#262422', '#3e3a36', '#5a534c', '#776d62', '#93877a', '#ad9f8e'], 8),
    flag: ramp(['#34302c', '#524c44', '#70685c', '#8e8474', '#aa9f8c'], 8),
    plank: ramp(['#241610', '#40281a', '#5c3e28', '#7a5838', '#96744c', '#b08e62'], 8),
    floor: ramp(['#2c1c12', '#4a3020', '#684630', '#865e40', '#a07852', '#b89266'], 8),
    water: ramp(['#08121e', '#0e1e2e', '#15293c', '#1e384c', '#2c4c60', '#446a7c'], 8),
    deep: ramp(['#060e18', '#0a1624', '#0f2032', '#152a40', '#1e3a52'], 7),
    shallow: ramp(['#10262c', '#1a3a40', '#285056', '#3a686a', '#56847e'], 7),
    cave: ramp(['#1e2028', '#30323c', '#444652', '#5a5c68', '#727480'], 8),
    bark: ramp(['#302016', '#4a3622', '#664a30', '#846442', '#a07c52'], 8),
    root: ramp(['#1e160e', '#322416', '#4a3620', '#62482c', '#7a5c38'], 7),
    carpet: ramp(['#3a0e12', '#5a1a1e', '#7c2a2a', '#9c3e36', '#b85848'], 7),
    canopy: ramp(['#0c1810', '#16281a', '#203a26', '#2c4e30', '#3c643a', '#507a44'], 8),
    rockTop: ramp(['#0e0e16', '#16161f', '#1e1e28', '#282833', '#34343f'], 6),
    stoneTop: ramp(['#16141a', '#221e24', '#2e2a30', '#3c373c', '#4a444a'], 6),
    woodTop: ramp(['#1a120e', '#261a12', '#34241a', '#443022'], 5),
    mossTop: ramp(['#10160e', '#182214', '#22301c', '#2e4024'], 5),
    barkTop: ramp(['#1e140e', '#2c1e14', '#3c2a1c', '#4c3624'], 5),
    caveTop: ramp(['#100e1a', '#191624', '#221e30', '#2c273c', '#363048'], 6),
  };
  T._PAL = PAL;
  const MORTAR = [26, 24, 24], FLAG_MORTAR = [30, 27, 25];

  // ------------------------------------------------------------------ 模様の作り方（u, v は 0..128 の周期の座標）
  // ボロノイの石（石畳・敷石・洞窟の床の板石）。nc × nr の格子（nr は偶数）で周期がつながる
  function stones(o) {
    const nc = o.nc, nr = o.nr, cw = P / nc, ch = P / nr, rs = o.ramp, mortar = o.mortar, s = o.seed || 1;
    return function (u, v) {
      const j = Math.floor(v / ch);
      let d1 = 1e9, d2 = 1e9, sx = 0, sy = 0, id = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj, oo = (((jj % nr) + nr) % nr & 1) * cw * 0.5, ib = Math.floor((u + oo) / cw);
        const jw = ((jj % nr) + nr) % nr;
        for (let di = -1; di <= 1; di++) {
          const ii = ib + di, iw = ((ii % nc) + nc) % nc;
          const cx = ii * cw - oo + cw * (0.3 + h3(iw, jw, s) * 0.4), cy = jj * ch + ch * (0.3 + h3(iw, jw, s + 1) * 0.4);
          const d = Math.hypot((u - cx) * (ch / cw), v - cy);
          if (d < d1) { d2 = d1; d1 = d; sx = cx; sy = cy; id = iw * 7919 + jw; } else if (d < d2) d2 = d;
        }
      }
      if (d2 - d1 < (o.gap || 0.9)) return mortar;
      const nx = (u - sx) / (cw * 0.5), ny = (v - sy) / (ch * 0.5), fl = o.flat ? 0.35 : 1;
      let l = 0.52 - (nx * 0.16 + ny * 0.28) * fl + (pn(u, v, 4, s + 3) - 0.5) * 0.22 + (h3(id, 0, s + 5) - 0.5) * 0.3 * (o.flat ? 0.7 : 1);
      if (d2 - d1 < 1.8) l -= o.flat ? 0.08 : 0.16;
      if (o.flat && d2 - d1 < 2.6 && ny < 0) l += 0.06;
      if (o.moss && pn(u, v, 16, s + 9) > 0.62) return mix(pick(rs, l), [52, 78, 40], 0.35);
      return pick(rs, l + (o.lift || 0));
    };
  }
  // 板（桟橋・床・足場）。vertical = 板が縦に並ぶ（筋は縦）
  function planks(o) {
    const rs = o.ramp, w = o.w || 8, s = o.seed || 4, vert = !!o.vertical, nb = P / w;
    return function (x, y) {
      const u = vert ? x : y, v = vert ? y : x;
      const k = Math.floor(u / w), kw = ((k % nb) + nb) % nb, eu = u - k * w;
      const c1 = h3(kw, 1, s) * P, len = 44 + h3(kw, 2, s) * 40;
      const pos = (((v - c1) % P) + P) % P, seg = pos < len ? 0 : 1, ev = seg ? pos - len : pos, sl = seg ? P - len : len;
      if (eu < 1) return [16, 10, 8];
      if (ev < 1) return [26, 16, 10];
      let l = 0.5 + (h3(kw, 7 + seg, s) - 0.5) * 0.3 + (pn(u, v, 8, s + 1, 32) - 0.5) * 0.35 + (pn(u, v, 2, s + 2, 8) - 0.5) * 0.12;
      if (eu < 2) l += 0.1; if (eu > w - 2) l -= 0.12;
      if ((Math.floor(ev) === 3 || Math.floor(ev) === Math.floor(sl) - 4) && Math.floor(eu) === 3) l = 0.9;
      return pick(rs, l + (o.lift || 0));
    };
  }
  function grassGen(o) {
    const rs = o.ramp || PAL.grass, s = o.seed || 21;
    return function (u, v) {
      const n = pn(u, v, 32, s), b = pn(u, v, 2, s + 1, 4), c = pn(u, v, 8, s + 2);
      let l = 0.45 + (n - 0.5) * 0.4 + (b - 0.5) * (o.blades || 0.35) + (c - 0.5) * 0.2 + (o.lift || 0);
      if (o.tall) { const st = pn(u, v, 2, s + 5, 8); if (st > 0.62) l += 0.2; else if (st < 0.3) l -= 0.15; }
      const col = pick(rs, l);
      const cell = h3(Math.floor(u / 3) % 43, Math.floor(v / 3) % 43, s + 7);
      if (o.flowers && cell > 0.93) { const f = [[210, 96, 120], [232, 204, 110], [238, 232, 214], [150, 120, 214]][Math.floor(h3(Math.floor(u / 3), Math.floor(v / 3), s + 8) * 4)]; return f; }
      if (cell > 0.992) return [180, 176, 140];
      return col;
    };
  }
  function earthGen(o) {
    const rs = o.ramp, s = o.seed || 31;
    return function (u, v) {
      let l = 0.5 + (pn(u, v, 16, s) - 0.5) * 0.4 + (pn(u, v, 4, s + 1) - 0.5) * 0.25 + (pn(u, v, 1, s + 2) - 0.5) * 0.12 + (o.lift || 0);
      if (o.ruts) { const r = Math.abs(((v % 16) + 16) % 16 - 8); if (r < 1.2 && pn(u, v, 8, s + 4) > 0.4) l -= 0.12; }
      if (o.moss && pn(u, v, 16, s + 5) > 0.55) return mix(pick(rs, l), pick(PAL.moss, 0.55 + (pn(u, v, 2, s + 6) - 0.5) * 0.4), 0.7);
      if (o.roots) { const rr = Math.abs(pn(u, v, 16, s + 8) - 0.5); if (rr < 0.035) return pick(PAL.bark, 0.55 + (0.035 - rr) * 8); if (rr < 0.05) l -= 0.15; }
      const cell = h3(Math.floor(u / 2) % 64, Math.floor(v / 2) % 64, s + 3);
      if (cell > 0.985) return pick(rs, 0.95);
      if (cell < 0.01) return pick(rs, 0.1);
      return pick(rs, l);
    };
  }
  function waterGen(o) {
    const rs = o.ramp || PAL.water, s = o.seed || 41;
    return function (u, v) {
      const n = pn(u, v, 64, s, 32), r = pn(u, v, 16, s + 1, 4), r2 = pn(u, v, 8, s + 2, 2);
      let l = 0.32 + (n - 0.5) * 0.25 + (o.lift || 0);
      if (r > 0.7 && r2 > 0.45) l += 0.22; else if (r < 0.25) l -= 0.1;
      if (o.sandy && pn(u, v, 16, s + 3) > 0.6) return mix(pick(rs, l), pick(PAL.sand, 0.5), 0.3);
      return pick(rs, l);
    };
  }
  function carpetGen() {
    // 織りの目（細かい市松）＋ 16 u ごとの帯に菱形の模様（金糸）
    return function (u, v) {
      const b = ((Math.floor(u) + Math.floor(v)) & 1) ? 0.04 : -0.04;
      const l = 0.5 + b + (pn(u, v, 16, 61) - 0.5) * 0.2;
      const band = ((v % 32) + 32) % 32, cx = ((u % 16) + 16) % 16;
      if (band < 2 || (band >= 14 && band < 16)) return pick(PAL.carpet, l + 0.28);
      const d = Math.abs(cx - 8) + Math.abs(band - 8);
      if (band >= 3 && band < 13 && d < 3.5) return d < 1.6 ? [206, 168, 96] : pick(PAL.carpet, l + 0.18);
      return pick(PAL.carpet, l);
    };
  }
  function barkFloorGen() {
    return function (u, v) {
      const w = pn(u, v, 32, 71) * 24, ring = ((u + w * 0.6 + v * 0.15) % 6 + 6) % 6;
      let l = 0.5 + (pn(u, v, 8, 72) - 0.5) * 0.3 + (ring < 1 ? -0.2 : ring < 2 ? 0.08 : 0);
      if (pn(u, v, 16, 73) > 0.7) l -= 0.1;
      return pick(PAL.bark, l + 0.05);
    };
  }
  /** 上から見た壁・天井（暗い。ゆるい塊） */
  function topGen(o) {
    const rs = o.ramp, s = o.seed || 7;
    return function (u, v) {
      let l = 0.45 + (pn(u, v, 16, s) - 0.5) * 0.5 + (pn(u, v, 4, s + 1) - 0.5) * 0.2;
      if (o.lines) { const k = ((v % 8) + 8) % 8; if (k < 1) l -= 0.25; }
      if (o.cross) { const k = ((u % 16) + 16) % 16; if (k < 1) l -= 0.18; }
      if (o.speck && h3(Math.floor(u) % 128, Math.floor(v) % 128, s + 3) > 0.985) l += 0.4;
      return pick(rs, l);
    };
  }
  /** 森の天蓋（葉の塊を上から。左上の月で明るく） */
  function canopyGen() {
    // 葉の塊を上から（大小 2 つの塊の重なり、左上の月で塊の上が明るい。目地の線は出さない）
    const big = stones({ nc: 8, nr: 8, ramp: PAL.canopy, mortar: PAL.canopy[1], seed: 91, gap: 0.15 });
    const small = stones({ nc: 16, nr: 16, ramp: PAL.canopy, mortar: PAL.canopy[1], seed: 95, gap: 0.15 });
    return function (u, v) {
      const a = big(u, v), b = small(u, v);
      const leaf = pn(u, v, 2, 92), m = pn(u, v, 32, 93);
      let c = mix(a, b, 0.4);
      c = mix(c, pick(PAL.canopy, 0.35 + (leaf - 0.5) * 0.7 + (m - 0.5) * 0.3), 0.35);
      if (leaf > 0.8) c = mix(c, PAL.canopy[5], 0.35);
      return c;
    };
  }

  // ------------------------------------------------------------------ 素材の一覧
  // pri = 境目で上に来る順（大きいほど上）、edge = soft（ずらす）| hard（まっすぐ）、amp = ずらしの量（マスの割合。0.25 ≈ 8 art px）、
  // rim = 内側の縁 1 px の明暗、halo = 外側 2 px（下の素材）の明暗、face = 立ち上がりの面の種類（rise.js）、
  // tall = 上に立つ物（木・藪・根）、under = 立つ物の下の地面（'ground' はテーマの地面）、macro = 大きなゆらぎの強さ
  const MATS = {
    // --- 床・地面
    grass: { name: '草地', gen: () => grassGen({}), pri: 30, edge: 'soft', amp: 0.28, walk: true, rim: 0.08, halo: -0.1, macro: 0.14 },
    tall_grass: { name: '深い草', gen: () => grassGen({ tall: true, lift: -0.05, blades: 0.5 }), pri: 32, edge: 'soft', amp: 0.32, walk: true, rim: 0.12, halo: -0.14, macro: 0.12 },
    flowers: { name: '花畑', gen: () => grassGen({ flowers: true, lift: 0.03 }), pri: 31, edge: 'soft', amp: 0.3, walk: true, rim: 0.06, halo: -0.08, macro: 0.1 },
    moss_earth: { name: '苔の土', gen: () => earthGen({ ramp: PAL.dirt, moss: true, seed: 33, lift: 0.02 }), pri: 28, edge: 'soft', amp: 0.3, walk: true, halo: -0.08, macro: 0.14 },
    dirt: { name: '土', gen: () => earthGen({ ramp: PAL.dirt, seed: 34 }), pri: 20, edge: 'soft', amp: 0.26, walk: true, halo: -0.06, macro: 0.12 },
    road: { name: '土の道', gen: () => earthGen({ ramp: PAL.road, ruts: true, seed: 35, lift: 0.04 }), pri: 22, edge: 'soft', amp: 0.24, walk: true, rim: -0.06, halo: -0.1, macro: 0.08 },
    cobble: { name: '石畳', gen: () => stones({ nc: 14, nr: 18, ramp: PAL.cobble, mortar: MORTAR, flat: true, seed: 2 }), pri: 40, edge: 'soft', amp: 0.12, walk: true, rim: -0.2, halo: -0.14, macro: 0.06 },
    snow: { name: '雪原', gen: () => earthGen({ ramp: PAL.snow, seed: 38, lift: 0.04 }), pri: 12, edge: 'soft', amp: 0.34, walk: true, halo: -0.05, macro: 0.12 },
    ash: { name: '灰の荒野', gen: () => earthGen({ ramp: PAL.ash, seed: 39, ruts: true }), pri: 11, edge: 'soft', amp: 0.3, walk: true, halo: -0.06, macro: 0.12 },
    sand: { name: '砂', gen: () => earthGen({ ramp: PAL.sand, seed: 36 }), pri: 10, edge: 'soft', amp: 0.3, walk: true, halo: -0.04, macro: 0.1 },
    plank: { name: '板', gen: () => planks({ ramp: PAL.plank }), pri: 50, edge: 'hard', walk: true, rim: -0.3, halo: -0.25 },
    deck: { name: '足場', gen: () => planks({ ramp: PAL.plank, lift: 0.05, seed: 5 }), pri: 50, edge: 'hard', walk: true, rim: -0.3, halo: -0.25 },
    bridge: { name: '橋', gen: () => planks({ ramp: PAL.plank, vertical: true, seed: 6, lift: 0.04 }), pri: 52, edge: 'hard', walk: true, rim: -0.35, halo: -0.3 },
    pier: { name: '桟橋', gen: () => planks({ ramp: PAL.plank, vertical: true, seed: 7 }), pri: 51, edge: 'hard', walk: true, rim: -0.35, halo: -0.3 },
    ladder: { name: 'はしご', gen: () => planks({ ramp: PAL.plank, seed: 8, lift: -0.05 }), pri: 53, edge: 'hard', walk: true, rim: -0.3 },
    stone_floor: { name: '敷石', gen: () => stones({ nc: 5, nr: 8, ramp: PAL.flag, mortar: FLAG_MORTAR, flat: true, seed: 12 }), pri: 42, edge: 'hard', walk: true, rim: -0.2, halo: -0.18 },
    wood_floor: { name: '木の床', gen: () => planks({ ramp: PAL.floor, w: 8, seed: 9 }), pri: 45, edge: 'hard', walk: true, rim: -0.25, halo: -0.2 },
    carpet: { name: '敷物', gen: carpetGen, pri: 46, edge: 'hard', walk: true, rim: 0.35, halo: -0.25 },
    cave_floor: { name: '洞窟の床', gen: () => { const M = [14, 14, 18], st = stones({ nc: 4, nr: 6, ramp: PAL.cave, mortar: M, flat: true, seed: 14 }); return (u, v) => { const c = st(u, v), f = pick(PAL.cave, 0.46 + (pn(u, v, 32, 15) - 0.5) * 0.35 + (pn(u, v, 8, 16) - 0.5) * 0.2); let o = c === M ? mix(f, [10, 10, 16], 0.6) : mix(f, c, 0.35); if (pn(u, v, 16, 17) > 0.66) o = mix(o, [30, 60, 50], 0.35); return o; }; }, pri: 25, edge: 'soft', amp: 0.18, walk: true, halo: -0.1, macro: 0.08 },
    bark_floor: { name: '樹の床', gen: barkFloorGen, pri: 26, edge: 'soft', amp: 0.2, walk: true, halo: -0.1, macro: 0.06 },
    root_floor: { name: '根の床', gen: () => earthGen({ ramp: PAL.root, roots: true, seed: 37 }), pri: 27, edge: 'soft', amp: 0.26, walk: true, halo: -0.08, macro: 0.1 },
    // --- 壁・崖（solid と rise は legend の側。ここは上の面と立ち上がりの面の絵）
    rock: { name: '岩', gen: () => topGen({ ramp: PAL.rockTop, seed: 101 }), pri: 90, edge: 'hard', walk: false, face: 'rock', rim: 0.35 },
    cliff: { name: '崖', gen: () => grassGen({ ramp: PAL.grassDk, seed: 102 }), pri: 88, edge: 'hard', walk: false, face: 'cliff', rim: 0.2 },
    wall_stone: { name: '石の壁', gen: () => topGen({ ramp: PAL.stoneTop, seed: 103, lines: true }), pri: 92, edge: 'hard', walk: false, face: 'stone', rim: 0.4 },
    wall_brick: { name: '煉瓦の壁', gen: () => topGen({ ramp: PAL.stoneTop, seed: 104, lines: true, cross: true }), pri: 92, edge: 'hard', walk: false, face: 'brick', rim: 0.4 },
    wall_wood: { name: '板の壁', gen: () => topGen({ ramp: PAL.woodTop, seed: 105, cross: true }), pri: 92, edge: 'hard', walk: false, face: 'wood', rim: 0.4 },
    wall_moss: { name: '苔の壁', gen: () => topGen({ ramp: PAL.mossTop, seed: 106 }), pri: 92, edge: 'hard', walk: false, face: 'moss', rim: 0.35 },
    wall_bark: { name: '樹の壁', gen: () => topGen({ ramp: PAL.barkTop, seed: 107, cross: true }), pri: 92, edge: 'hard', walk: false, face: 'bark', rim: 0.35 },
    wall_cave: { name: '洞窟の壁', gen: () => topGen({ ramp: PAL.caveTop, seed: 108, speck: true }), pri: 92, edge: 'hard', walk: false, face: 'cave', rim: 0.3 },
    tree: { name: '木', under: 'ground', tall: 'tree', pri: 29, edge: 'soft', walk: false },
    forest_dark: { name: '深い森', gen: canopyGen, pri: 86, edge: 'soft', amp: 0.34, walk: false, tall: 'canopy', rim: 0.12, halo: -0.35 },
    bush: { name: '藪', under: 'ground', tall: 'bush', pri: 29, edge: 'soft', walk: false },
    roots: { name: '根', under: 'root_floor', tall: 'roots', pri: 29, edge: 'soft', walk: false },
    // --- 水
    water: { name: '水', gen: () => waterGen({}), pri: 2, edge: 'soft', amp: 0.26, walk: false, water: true, rim: 0.3 },
    sea: { name: '海', gen: () => waterGen({ seed: 44 }), pri: 1, edge: 'soft', amp: 0.3, walk: false, water: true, rim: 0.3 },
    deep_water: { name: '深い水', gen: () => waterGen({ ramp: PAL.deep, seed: 45 }), pri: 0, edge: 'soft', amp: 0.3, walk: false, water: true },
    shallow: { name: '浅瀬', gen: () => waterGen({ ramp: PAL.shallow, sandy: true, seed: 46, lift: 0.08 }), pri: 5, edge: 'soft', amp: 0.28, walk: true, water: true, rim: 0.2 },
  };
  T._MATS = MATS;
  for (const id of Object.keys(MATS)) {
    const m = MATS[id];
    R.def('materials', id, { name: m.name, edge: m.edge, walk: m.walk });
  }

  /** 素材の表（知らない id でも名前から作る。仮の stub_* も） */
  const extra = {};
  function info(id) {
    if (MATS[id]) return MATS[id];
    if (extra[id]) return extra[id];
    const h = R.U.hash(String(id));
    const d = R.DB.materials[id] || {};
    const walk = d.walk !== false && !/tree|wall|rock|cliff|water/.test(id);
    const water = /water|sea/.test(id);
    const base = water ? PAL.water : walk ? [PAL.dirt, PAL.grass, PAL.road, PAL.moss][h % 4] : PAL.stoneTop;
    extra[id] = water ? Object.assign({}, MATS.water, { name: id })
      : /tree/.test(id) ? Object.assign({}, MATS.tree, { name: id })
      : { name: id, gen: () => earthGen({ ramp: base, seed: 50 + (h % 97) }), pri: walk ? 24 : 80, edge: d.edge || (walk ? 'soft' : 'hard'), amp: 0.24, walk, face: walk ? null : 'stone' };
    return extra[id];
  }
  T._matInfo = info;

  // ------------------------------------------------------------------ 焼いた素材の 1 枚（周期の 4 × 4 マス）
  // sheets[tile][id] = {S, px: Uint32Array(S*S), row, done, fn}。行ごとに少しずつ焼ける（焼く列の 3 ms を守る）
  const sheets = {};
  function sheetOf(id, tile) {
    const byT = (sheets[tile] = sheets[tile] || {});
    let s = byT[id];
    if (!s) {
      // 描いた素材の画像（env.js、v2/design/ENV_ASSETS.md）があればそれ。周期は画像の幅（256 = 8 マス）。無ければコードで描く
      const e = T.Env && T.Env.mat ? T.Env.mat(id, tile) : null;
      if (e) return (byT[id] = { id, S: e.S, tile, px: e.px, row: e.S, done: true, fn: null, env: true });
      const m = info(id);
      const S = tile * 4;
      s = byT[id] = { id, S, tile, px: new Uint32Array(S * S), row: 0, done: false, fn: null, gen: m.gen ? m : info(underOf(id, null)) };
    }
    return s;
  }
  /** 素材の 1 枚を deadline（performance.now の値）まで焼く。焼き終わっていれば true */
  function bakeSheet(s, deadline) {
    if (s.done) return true;
    if (!s.fn) s.fn = s.gen.gen();
    const S = s.S, k = 32 / s.tile, px = s.px, fn = s.fn;
    while (s.row < S) {
      const y = s.row, v = (y + 0.5) * k, o = y * S;
      for (let x = 0; x < S; x++) px[o + x] = pack(fn((x + 0.5) * k, v));
      s.row++;
      if (deadline && (s.row & 3) === 0 && now() > deadline) break;
    }
    if (s.row >= S) { s.done = true; s.fn = null; if (R.Hd && R.Hd.track) R.Hd.track('chunk', `terrain:mat:${s.tile}:${s.id}`, S * S * 4); }
    return s.done;
  }
  T._sheet = function (id, tile, deadline) { const s = sheetOf(id, tile); bakeSheet(s, deadline); return s; };
  T._sheetReady = function (id, tile) { const b = sheets[tile]; return !!(b && b[id] && b[id].done); };
  /** 画像を読み終えたとき（env.js）: コードで焼いた素材と代表の色を捨てる */
  T._envReset = function () { for (const k of Object.keys(sheets)) delete sheets[k]; for (const k of Object.keys(colorCache)) delete colorCache[k]; };

  /** 立つ物（木・藪・根）の下の地面の素材 */
  function underOf(id, theme) {
    const m = info(id);
    if (!m.under) return id;
    if (m.under === 'ground') return (theme && theme.ground) || 'grass';
    return m.under;
  }
  T._underOf = underOf;

  // ------------------------------------------------------------------ 契約の口
  T.material = function (id) {
    const m = info(id);
    return {
      edge: m.edge === 'hard' ? 'hard' : 'soft',
      walk: !!m.walk,
      /** ctx の rect に素材を敷く（rect はマップの論理 px。模様は世界の座標でつながる）。rng は使わない（模様は座標で決まる） */
      bake(ctx, rect, rng, tile) {
        tile = tile || 32;
        const s = T._sheet(id, tile);
        const w = Math.max(1, rect.w | 0), h = Math.max(1, rect.h | 0);
        const img = ctx.createImageData(w, h), d32 = new Uint32Array(img.data.buffer), S = s.S;
        for (let y = 0; y < h; y++) {
          const sy = ((((rect.y | 0) + y) % S) + S) % S;
          for (let x = 0; x < w; x++) d32[y * w + x] = s.px[sy * S + (((((rect.x | 0) + x) % S) + S) % S)];
        }
        ctx.putImageData(img, rect.x | 0, rect.y | 0);
      },
    };
  };
  const colorCache = {};
  /** 素材の代表の色（昼の色の中ほど。小地図・地図・仮の FIELD） */
  T.matColor = function (id, solid) {
    const k = id + (solid ? '|s' : '');
    if (colorCache[k]) return colorCache[k];
    const m = info(id);
    let c;
    const em = !m.tall && T.Env && T.Env.meanColor ? T.Env.meanColor(m.gen ? id : underOf(id)) : null;
    if (em) return (colorCache[k] = em);
    if (m.tall === 'tree' || m.tall === 'bush') c = PAL.canopy[4];
    else if (m.tall === 'roots') c = PAL.root[3];
    else {
      const fn = (m.gen ? m : info(underOf(id))).gen();
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 4; y < 128; y += 16) for (let x = 4; x < 128; x += 16) { const q = fn(x, y); r += q[0]; g += q[1]; b += q[2]; n++; }
      c = [r / n, g / n, b / n];
    }
    return (colorCache[k] = css(c));
  };
})(window.RPG);
