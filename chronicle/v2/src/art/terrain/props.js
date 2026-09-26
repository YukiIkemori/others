// TERRAIN: 物の絵（V2_PLAN §2.5.7 の hd:prop:<id>・hd:secret:<mat>、MODERN_UI §7.2 F4・§7.5、WORLD_REDESIGN §6.2・§6.3）
// design/art_proto/ui/art_town.js の PROPS と code/env.js の木・岩を R.Hd.RZ（RENDER のラスタライザ）で描く。
//
//   hd:prop:<id>  opts {s?: 倍率（tile / 32）, amb?: '#rrggbb'（焼くときに夜の環境光を掛ける＝FIELD が y の順に描く物）, v?: 変化, look?, color?}
//                 → Sheet（描く点 = 足もとの中央。anchors.light = 灯りの芯）。meta = R.DB.props[id]（K.propDef）
//   hd:secret:<mat> opts {floor, tile} → 見つけた後の隠し通路の 1 マス（床の素材＋壁の縁の細い印）
//   R.DB.props[id] = {solid?, soft?, light?, glow?, shadow?, footprint?, frames?, overChars?}
//
// light は {x, y, r, color, k, kind}（描く点からの相対。r は光だまりの半径 art px）。色と半径は R.Hd.STYLE.light から。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  /** R.Hd.def（RENDER の hd.js が先に読まれる。無ければデータの後処理で登録する） */
  T._hdDef = function (key, f, meta) {
    if (R.Hd && R.Hd.def) return R.Hd.def(key, f, meta);
    R.onData(() => { if (R.Hd && R.Hd.def && !R.Hd.has(key)) R.Hd.def(key, f, meta); });
    return true;
  };
  const SL = () => (R.Hd && R.Hd.STYLE && R.Hd.STYLE.light) || { lampColor: '#ffc27a', windowColor: '#ffcf86', crystalColor: '#bfe6ff', fireColor: '#ff9c4a', lampR: 110, fireMul: 1.3 };

  // ------------------------------------------------------------------ 素材（RZ.mat。R.Hd.RZ が読めるようになってから作る）
  let M = null;
  function mats() {
    if (M) return M;
    const { mat } = R.Hd.RZ;
    M = {
      iron: mat({ keys: ['#1a1c24', '#3a404c', '#646c7a', '#9ca4b0', '#e2e8ee'], n: 7, metal: true, spec: 0.8, specPow: 12 }),
      post: mat({ keys: ['#0c0c12', '#1c1e26', '#343844', '#5a6070'], n: 5, metal: true, spec: 0.6 }),
      gold: mat({ keys: ['#5a3a08', '#a8741c', '#e8b83c', '#ffe27a', '#fff8d0'], n: 7, metal: true, spec: 1, specPow: 8 }),
      silver: mat({ keys: ['#2a3040', '#58647a', '#98a8c0', '#d8e4f0', '#ffffff'], n: 7, metal: true, spec: 1, specPow: 8 }),
      wood: mat({ keys: ['#2a160c', '#5a341c', '#8c5a30', '#b8844c', '#e0b27a'], n: 6 }),
      stone: mat({ keys: ['#1e1c20', '#36343a', '#57545a', '#7c7876', '#a29d94', '#c4bdb0'], n: 7, tex: 1.6, tsx: 0.5, tsy: 0.5 }),
      stoneDk: mat({ keys: ['#16141a', '#2a282e', '#44424a', '#626068', '#807c84'], n: 6, tex: 1.4, tsx: 0.5, tsy: 0.3 }),
      barrel: mat({ keys: ['#1c1008', '#3c2412', '#62401e', '#8a6030', '#b4884c'], n: 7, tex: 1.5, tsx: 1.5, tsy: 0.2 }),
      crate: mat({ keys: ['#241408', '#4a2e14', '#74502a', '#9c7442', '#c8a068'], n: 7, tex: 1.2, tsx: 0.15, tsy: 1 }),
      chestLid: mat({ keys: ['#4a1208', '#7a2410', '#b23c1a', '#dc6228', '#f89048'], n: 7, tex: 0.6, tsx: 0.2, tsy: 1 }),
      chestBody: mat({ keys: ['#2a1208', '#4c240e', '#6e3818', '#925028'], n: 6, tex: 0.8, tsx: 0.15, tsy: 1 }),
      rareLid: mat({ keys: ['#10164a', '#1e2c7a', '#3446b0', '#5a70dc', '#96b0f8'], n: 7, tex: 0.5, tsx: 0.2, tsy: 1 }),
      rareBody: mat({ keys: ['#0c0e2a', '#1a1e48', '#2a3068', '#3e4688'], n: 6 }),
      dark: mat({ keys: ['#0a0608', '#160c0c', '#20140e'], n: 3, flat: true }),
      leaf: mat({ keys: ['#0a1c14', '#123a20', '#1e5a28', '#3a7e2c', '#6aa436', '#b0d060'], n: 7, tex: 3, tsx: 0.55, tsy: 0.55, wrap: 0.3, amb: 0.12, rim: '#fff0b0', rimK: 0.5 }),
      leafDk: mat({ keys: ['#08140e', '#0e2a18', '#184220', '#2a5e26', '#4a7e30', '#80a848'], n: 7, tex: 3, tsx: 0.55, tsy: 0.55, wrap: 0.3, amb: 0.12, rim: '#e8f0b0', rimK: 0.45 }),
      leafMoss: mat({ keys: ['#0c1a16', '#143428', '#1e4e36', '#2e6a44', '#4c8a54', '#86b070'], n: 7, tex: 3, tsx: 0.6, tsy: 0.6, wrap: 0.3, amb: 0.12, rim: '#c8f0d8', rimK: 0.45 }),
      pine: mat({ keys: ['#06140e', '#0c2a1c', '#164428', '#246034', '#3e7c3c', '#78a450'], n: 7, tex: 2.4, tsx: 0.9, tsy: 0.35, wrap: 0.2, amb: 0.12, rim: '#f0f0b0', rimK: 0.4 }),
      bark: mat({ keys: ['#120a08', '#2a1a12', '#4a3020', '#6c4c32', '#907050'], n: 6, tex: 2, tsx: 0.2, tsy: 1.4 }),
      barkPale: mat({ keys: ['#1a140e', '#3a2c1e', '#5c4830', '#806848', '#a48a64'], n: 6, tex: 2.2, tsx: 0.25, tsy: 1.2 }),
      moss: mat({ keys: ['#142410', '#2a4a18', '#4a7424', '#7ca03a', '#b4cc5c'], n: 6, tex: 2.5, tsx: 0.8, tsy: 0.8 }),
      water: mat({ keys: ['#0e2a3a', '#1c4a5e', '#2e6e84', '#5aa0b4', '#a8dce4'], n: 6, spec: 1, specPow: 20 }),
      spring: mat({ keys: ['#1a5a6a', '#3a9ab0', '#7ad4e0', '#c8f4f4', '#f4ffff'], n: 5, flat: true, glow: '#a0f4f0' }),
      glowW: mat({ keys: ['#c05a10', '#ff9a30', '#ffd070', '#fff4c8'], n: 4, flat: true, glow: '#ffd070' }),
      glowC: mat({ keys: ['#1a6a7a', '#40c0d0', '#a0f4f0', '#f0ffff'], n: 4, flat: true, glow: '#a0f4f0' }),
      glowOff: mat({ keys: ['#1a1a22', '#2c2c38', '#40404e', '#565666'], n: 4, flat: true }),
      flame: mat({ keys: ['#b03808', '#f07818', '#ffc040', '#fff0b0'], n: 4, flat: true, glow: '#ffb040', noOutline: true }),
      ember: mat({ keys: ['#2a0e06', '#5a1a08', '#8a2c0c'], n: 3, flat: true }),
      cloth: mat({ keys: ['#3a0e0e', '#5e1a18', '#862a24', '#a84436', '#c8664e'], n: 6, tex: 0.6, tsx: 1, tsy: 0.3 }),
      clothB: mat({ keys: ['#101a30', '#1c2c4a', '#2c4266', '#44608a', '#6a86ae'], n: 6, tex: 0.6, tsx: 1, tsy: 0.3 }),
      linen: mat({ keys: ['#4a4438', '#7a7262', '#a89e8a', '#d0c6ae', '#ece4d0'], n: 6, tex: 0.5, tsx: 0.3, tsy: 1.2 }),
      sack: mat({ keys: ['#3a2c1a', '#5e4a2e', '#86704a', '#ac946a', '#ccb48a'], n: 6, tex: 1.4, tsx: 0.6, tsy: 0.6 }),
      rope: mat({ keys: ['#3a2c1a', '#6a5634', '#9a8456', '#c4b07c'], n: 5 }),
      paper: mat({ keys: ['#6a6254', '#a8a090', '#d8d2c2', '#f6f2e8'], n: 5 }),
      fish: mat({ keys: ['#28323c', '#4a5a68', '#7a8c98', '#b8c8cc'], n: 5, metal: true, spec: 0.6 }),
      fruit: mat({ keys: ['#4a1408', '#8a2a10', '#c84a1c', '#f07a30'], n: 5 }),
      crystal: mat({ keys: ['#10304a', '#1e6a8a', '#40b0c8', '#9af0f0', '#e8ffff'], n: 7, spec: 1, specPow: 6, glow: '#8af0f0' }),
      mush: mat({ keys: ['#10304a', '#2a7a8a', '#60d0c8', '#b0fff0'], n: 4, flat: true, glow: '#80f0e0' }),
      mushStem: mat({ keys: ['#4a4a5a', '#8a8a9a', '#c8c8d0'], n: 3 }),
      petalP: mat({ keys: ['#c04868', '#ff9ab8'], n: 2, flat: true, noOutline: true }),
      petalY: mat({ keys: ['#c08010', '#ffe060'], n: 2, flat: true, noOutline: true }),
      petalW: mat({ keys: ['#b0b4c8', '#ffffff'], n: 2, flat: true, noOutline: true }),
      pot: mat({ keys: ['#34160e', '#562618', '#7a3a24', '#9c5434', '#bc724c'], n: 6 }),
      bedsheet: mat({ keys: ['#5a5a70', '#8a8aa4', '#b8b8cc', '#e0e0ec'], n: 5 }),
      book: mat({ keys: ['#3a1010', '#6a2a1a', '#2a3a5a', '#4a6a3a', '#8a6a2a'], n: 5, flat: true }),
      teal: mat({ keys: ['#0e3a3a', '#1a6a6a', '#3aa8a0', '#8ae8d8'], n: 4 }),
      rune: mat({ keys: ['#2a8a9a', '#7ae0f0', '#e0ffff'], n: 3, flat: true, glow: '#9af0ff', noOutline: true }),
      foot: mat({ keys: ['#3ab0a0', '#9af0e0', '#f0fff8'], n: 3, flat: true, glow: '#9af0e0', noOutline: true }),
      beam: mat({ keys: ['#ffd070', '#fff0c0', '#fffcf0'], n: 3, flat: true, glow: '#fff0c0', noOutline: true }),
    };
    return M;
  }
  const SW = { teal: ['#0e3a3a', '#1a6a6a', '#3aa8a0', '#8ae8d8'], red: ['#3a0e0e', '#6a1a18', '#a83a2a', '#e87a5a'], blue: ['#0e1a3a', '#1a2e6a', '#3a5ab0', '#8aa8f0'], gold: ['#3a2a08', '#7a5a14', '#c09a2c', '#f0d860'], green: ['#0e2a10', '#1e5a20', '#3a9a3a', '#8ae07a'] };

  // ------------------------------------------------------------------ 物の形（B = RZ.Builder、o = opts、f = コマの名前）→ {light:[x,y], cyan?, big?, small?}
  const DRAW = {
    barrel(B) { const m = mats(), g = B.group(); B.cap(0, -3, 0, -13, 6.5, 6.5, m.barrel, 0, { g }); B.ell(0, -16, 6.2, 2.4, m.barrel, 0.05, { g: B.group(), shadeOff: -1, bulge: 0.2 }); [-5, -13].forEach((by) => B.cap(-6.6, by, 6.6, by, 0.9, 0.9, m.iron, 0.02)); },
    crate(B) { const m = mats(); B.poly([[-8, 0], [8, 0], [8, -12], [-8, -12]], m.crate, 0, { bevel: 1.5 }); B.poly([[-8, -12], [8, -12], [6, -18], [-6, -18]], m.crate, 0.01, { bevel: 1.2, ny: -0.8, g: B.group() }); B.cap(-7, -1.5, 7, -10.5, 0.8, 0.8, m.crate, 0.02, { shadeOff: 1 }); },
    sack(B) { const m = mats(); B.ell(0, -5, 6, 5.5, m.sack, 0, { bulge: 0.9 }); B.ell(0, -10, 3, 2, m.sack, 0.1); B.cap(-2.5, -10, 2.5, -10, 0.6, 0.6, m.rope, 0.2); },
    bench(B) { const m = mats(); B.poly([[-12, -5], [12, -5], [12, -8], [-12, -8]], m.crate, 0.1, { bevel: 1 }); [-9, 9].forEach((x) => B.cap(x, 0, x, -5, 0.8, 0.8, m.iron, 0)); B.poly([[-12, -9], [12, -9], [12, -13], [-12, -13]], m.crate, 0.05, { bevel: 1, ny: -0.5 }); },
    chair(B) { const m = mats(); [-4, 4].forEach((x) => B.cap(x, 0, x, -6, 0.7, 0.7, m.wood, 0)); B.poly([[-5, -6], [5, -6], [5, -8], [-5, -8]], m.crate, 0.1, { bevel: 0.8 }); B.poly([[-5, -8], [5, -8], [5, -16], [-5, -16]], m.crate, 0.05, { bevel: 1, ny: -0.3 }); },
    table(B) { const m = mats(); B.ell(0, -9, 11, 5.5, m.crate, 0.1, { bulge: 0.4 }); B.cap(0, 0, 0, -9, 1.4, 1.4, m.wood, 0); B.ell(-4, -12, 2, 1.6, m.paper, 0.2); B.ell(4, -11, 1.1, 1.8, m.glowW, 0.2); return { light: [4, -12], small: true }; },
    bed(B) { const m = mats(); B.poly([[-11, 0], [11, 0], [11, -26], [-11, -26]], m.crate, 0, { bevel: 1.5, ny: -0.6 }); B.poly([[-10, -4], [10, -4], [10, -22], [-10, -22]], m.bedsheet, 0.1, { bevel: 2, ny: -0.8 }); B.ell(0, -21, 7, 3, m.linen, 0.2, { bulge: 0.6 }); B.poly([[-10, -4], [10, -4], [10, -13], [-10, -13]], m.clothB, 0.15, { bevel: 1.5, ny: -0.7 }); },
    bookshelf(B) { const m = mats(); B.poly([[-14, 0], [14, 0], [14, -34], [-14, -34]], m.crate, 0, { bevel: 1.5 }); for (let r = 0; r < 3; r++) { B.poly([[-12, -3 - r * 10], [12, -3 - r * 10], [12, -4 - r * 10], [-12, -4 - r * 10]], m.wood, 0.1); for (let i = 0; i < 9; i++) B.rect(-11 + i * 2.5, -11 - r * 10, 2, 7 - (i % 3), m.book, 0.12, { shade: (i + r) % 5 }); } },
    counter(B) { const m = mats(); B.poly([[-16, 0], [16, 0], [16, -12], [-16, -12]], m.crate, 0, { bevel: 1.2 }); B.poly([[-17, -12], [17, -12], [16, -18], [-16, -18]], m.wood, 0.05, { bevel: 1, ny: -0.8 }); B.ell(-8, -19, 2.5, 1.5, m.pot, 0.1); B.ell(6, -19, 3, 1.4, m.paper, 0.1); },
    stove(B) { const m = mats(); B.poly([[-12, 0], [12, 0], [12, -18], [-12, -18]], m.stoneDk, 0, { bevel: 2 }); B.poly([[-7, -2], [7, -2], [7, -11], [0, -14], [-7, -11]], m.dark, 0.1, { bevel: 0.5 }); B.ell(0, -5, 5, 3, m.flame, 0.2); B.cap(6, -18, 6, -30, 2.4, 2.2, m.stoneDk, 0.05); return { light: [0, -6], fire: true }; },
    lamp_post(B) { const m = mats(); B.ell(0, -1, 4, 2, m.post, 0); B.cap(0, -2, 0, -44, 1.7, 1.3, m.post, 0.1); B.cap(0, -40, 5, -42, 0.8, 0.8, m.post, 0.2); B.poly([[1.5, -50], [8.5, -50], [7.5, -41], [2.5, -41]], m.glowW, 0.3, { bevel: 0.1 }); B.poly([[0.5, -50], [9.5, -50], [5, -55]], m.post, 0.4, { bevel: 1 }); return { light: [5, -46] }; },
    lantern(B) { const m = mats(); B.cap(0, 0, 0, -3, 2.8, 2.4, m.post, 0); B.poly([[-3, -3], [3, -3], [2.5, -11], [-2.5, -11]], m.glowW, 0.1, { bevel: 0.2 }); B.poly([[-3.5, -11], [3.5, -11], [0, -14]], m.post, 0.2, { bevel: 0.8 }); return { light: [0, -7], small: true }; },
    fence(B) { const m = mats(); [-13, 0, 13].forEach((x) => B.cap(x, 0, x, -14, 1.3, 1.1, m.wood, 0.05)); [-5, -11].forEach((y) => B.cap(-16, y, 16, y, 1, 1, m.wood, 0.1)); },
    flower_pot(B) { const m = mats(); B.poly([[-5, 0], [5, 0], [6, -7], [-6, -7]], m.pot, 0, { bevel: 1 }); const r = R.Hd.RZ.rng(5); for (let i = 0; i < 6; i++) B.ell(-4 + i * 1.7, -9 - r() * 3, 2, 1.7, m.leaf, 0.1 + r() * 0.1); for (let i = 0; i < 4; i++) B.ell(-4 + i * 2.6, -11 - r() * 2, 1.2, 1, [m.petalP, m.petalY, m.petalW][i % 3], 0.3); },
    planter(B) { const m = mats(); B.poly([[-10, 0], [10, 0], [11, -7], [-11, -7]], m.pot, 0, { bevel: 1.2 }); const r = R.Hd.RZ.rng(9); for (let i = 0; i < 9; i++) B.ell(-9 + i * 2.2, -8 - r() * 3, 2.2, 1.8, m.leaf, 0.1 + r() * 0.1); for (let i = 0; i < 6; i++) B.ell(-8 + i * 3.2 + r(), -10 - r() * 3, 1.2, 1, [m.petalP, m.petalY, m.petalW][i % 3], 0.3); },
    well(B) { const m = mats(); B.ell(0, -3, 15, 7.5, m.stone, 0, { bulge: 0.6 }); B.ell(0, -9, 12, 5.5, mats().dark, 0.1, { bulge: 0.2 }); B.ell(0, -9.5, 9, 3.8, m.water, 0.12, { bulge: 0.1 }); [-12, 12].forEach((x) => B.cap(x, -6, x, -28, 1.3, 1.3, m.wood, 0.2)); B.poly([[-15, -27], [15, -27], [10, -35], [-10, -35]], m.crate, 0.3, { bevel: 1.2, ny: -0.8 }); B.cap(0, -26, 0, -14, 0.5, 0.5, m.rope, 0.25); B.ell(0, -13, 2.5, 2, m.barrel, 0.26); },
    signboard(B) { const m = mats(); B.cap(0, 0, 0, -16, 1.1, 1.1, m.wood, 0); B.poly([[-10, -12], [10, -12], [10, -22], [-10, -22]], m.crate, 0.1, { bevel: 1.2 }); B.rect(-7, -19, 14, 1, m.dark, 0.2); B.rect(-6, -16, 10, 1, m.dark, 0.2); },
    board(B) { const m = mats(); [-9, 9].forEach((x) => B.cap(x, 0, x, -26, 1.2, 1.2, m.wood, 0)); B.poly([[-12, -12], [12, -12], [12, -28], [-12, -28]], m.crate, 0.1, { bevel: 1.2 }); B.poly([[-13, -28], [13, -28], [10, -32], [-10, -32]], m.wood, 0.15, { bevel: 1 }); [[-8, -26, 7, 8], [1, -25, 8, 6], [-6, -17, 6, 4], [3, -18, 6, 5]].forEach(([x, y, w, h]) => B.rect(x, y, w, h, m.paper, 0.2)); },
    rock_small(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 7), s = 5 + r() * 2; B.ell(0, -s * 0.45, s, s * 0.62, m.stone, 0, { bulge: 0.8 }); B.ell(s * 0.55, -s * 0.3, s * 0.6, s * 0.45, m.stone, 0.01, { g: B.group(), bulge: 0.8 }); if (r() < 0.6) B.ell(-s * 0.1, -s * 0.85, s * 0.7, s * 0.25, m.moss, 0.02, { bulge: 0.6 }); },
    rock(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 11), s = 10 + r() * 4; B.ell(0, -s * 0.45, s, s * 0.62, m.stone, 0, { bulge: 0.8 }); B.ell(s * 0.55, -s * 0.3, s * 0.6, s * 0.45, m.stone, 0.01, { g: B.group(), bulge: 0.8 }); B.ell(-s * 0.1, -s * 0.85, s * 0.7, s * 0.25, m.moss, 0.02, { bulge: 0.6 }); },
    stump(B) { const m = mats(); B.cap(0, -1, 0, -7, 7, 6.5, m.bark, 0); B.ell(0, -8, 6.2, 2.8, m.barkPale, 0.1, { bulge: 0.2 }); B.ell(0, -8, 3, 1.3, m.bark, 0.12, { bulge: 0.1 }); },
    log(B) { const m = mats(); B.cap(-13, -4, 13, -4, 4.5, 4.5, m.bark, 0); B.ell(13, -4, 2.2, 4.4, m.barkPale, 0.1, { bulge: 0.2 }); },
    mushroom_glow(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 3); for (let i = 0; i < 3; i++) { const x = (i - 1) * 4 + r() * 2, h = 4 + r() * 4; B.cap(x, 0, x, -h, 0.9, 0.7, m.mushStem, 0.1 + i * 0.01); B.ell(x, -h - 1, 2.6 - i * 0.3, 1.6, m.mush, 0.2 + i * 0.01); } return { light: [0, -5], cyan: true, small: true }; },
    firefly(B) { const m = mats(); B.ell(0, -12, 1.2, 1.2, m.glowW, 0); return { light: [0, -12], small: true }; },
    rope_bridge(B) { const m = mats(); for (let i = 0; i < 8; i++) B.poly([[-14, -i * 4], [14, -i * 4], [14, -i * 4 - 3], [-14, -i * 4 - 3]], m.crate, 0.1, { bevel: 0.8, ny: -0.6 }); [-15, 15].forEach((x) => B.cap(x, 0, x, -32, 0.6, 0.6, m.rope, 0.2)); },
    leaves_over(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 13); for (let i = 0; i < 12; i++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 12; B.ell(Math.cos(a) * rr * 1.4, -16 + Math.sin(a) * rr, 5 + r() * 3, 4.5 + r() * 2, m.leafDk, 0.1 + i * 0.001, { bulge: 0.85 }); } },
    // --- 仕掛けの物（map.objects の type。FIELD が y の順に描く）
    chest(B, o, f) {
      const m = mats(), rare = /^rare/.test(f), open = /open$/.test(f), lid = rare ? m.rareLid : m.chestLid, body = rare ? m.rareBody : m.chestBody, band = rare ? m.silver : m.gold;
      B.poly([[-10, 0], [10, 0], [10, -10], [-10, -10]], body, 0, { bevel: 1.4 });
      if (open) {
        B.poly([[-10, -10], [10, -10], [9, -13], [-9, -13]], m.dark, 0.05);
        B.poly([[-10, -12], [10, -12], [10, -22], [-10, -22]], lid, 0.1, { bevel: 1.4, ny: 0.4 });
      } else {
        B.poly([[-10.5, -9], [10.5, -9], [10, -16], [7, -19], [-7, -19], [-10, -16]], lid, 0.1, { bevel: 2.5, ny: -0.5 });
        B.rect(-10.5, -10, 21, 2, m.gold, 0.2);
      }
      [-6.5, 6.5].forEach((x) => B.rect(x - 1.2, open ? -22 : -19, 2.4, open ? 22 : 19, band, 0.25));
      if (!open) B.rect(-2, -12, 4, 4.5, m.gold, 0.3);
    },
    spring(B, o, f) {
      const m = mats(), k = (+String(f).replace(/\D/g, '') || 0);
      B.ell(0, -3, 28, 13, m.stone, 0, { bulge: 0.5 }); B.ell(0, -7, 24, 10, m.stone, 0.05, { bulge: 0.3 });
      B.ell(0, -8, 20, 8, m.water, 0.1, { bulge: 0.15 });
      for (let i = 0; i < 3; i++) { const a = (i / 3 + k / 12) * Math.PI * 2; B.ell(Math.cos(a) * 11, -8 + Math.sin(a) * 4, 3.4, 1, m.spring, 0.12 + i * 0.001); }
      B.cap(0, -8, 0, -26, 4.5, 3.6, m.stone, 0.2); B.ell(0, -28, 8, 3.4, m.stone, 0.25, { bulge: 0.4 }); B.ell(0, -29, 6, 2.2, m.spring, 0.3, { bulge: 0.1 });
      B.ell(0, -31 - (k % 2), 1.6, 2.4, m.spring, 0.35);
      return { light: [0, -24], cyan: true, big: true };
    },
    brazier(B, o, f) {
      const m = mats(), on = f !== 'off', k = (+String(f).replace(/\D/g, '') || 0);
      B.cap(0, 0, 0, -12, 2.2, 1.6, m.iron, 0); B.ell(0, 0, 6, 2.4, m.iron, 0.01);
      [-5, 5].forEach((x) => B.cap(0, -6, x, -14, 0.7, 0.7, m.iron, 0.02));
      B.ell(0, -15, 8, 3.5, m.iron, 0.1, { bulge: 0.4 }); B.poly([[-8, -15], [8, -15], [6, -19], [-6, -19]], m.iron, 0.12, { bevel: 1.2 });
      B.ell(0, -19, 5.5, 2, m.ember, 0.15);
      if (on) { B.ell(0, -22 - k * 0.5, 4.2 - k * 0.3, 5 + k * 0.7, m.flame, 0.3); B.ell(-2 + k, -26 - k, 1.8, 3, m.flame, 0.31); B.ell(1.5 - k * 0.5, -21, 2, 2.4, m.beam, 0.32); }
      return on ? { light: [0, -22], fire: true } : null;
    },
    torch(B, o, f) { const m = mats(), on = f !== 'off'; B.cap(0, 0, 0, -8, 1.3, 1, m.iron, 0); B.ell(0, -10, 3, 2, m.iron, 0.1); if (on) B.ell(0, -13, 2.6, 3.4, m.flame, 0.2); return on ? { light: [0, -13], fire: true } : null; },
    waylamp(B, o, f) {
      const m = mats(), on = f !== 'off';
      B.ell(0, -1, 7, 3, m.stone, 0, { bulge: 0.5 }); B.poly([[-4, -1], [4, -1], [3.2, -24], [-3.2, -24]], m.stone, 0.05, { bevel: 1.5 });
      B.poly([[-6, -24], [6, -24], [5, -27], [-5, -27]], m.stoneDk, 0.1, { bevel: 1 });
      B.poly([[-4, -27], [4, -27], [4, -35], [-4, -35]], on ? m.glowW : m.glowOff, 0.15, { bevel: 0.3 });
      [-4, 4].forEach((x) => B.cap(x, -27, x, -35, 0.6, 0.6, m.post, 0.2));
      B.poly([[-6, -35], [6, -35], [0, -41]], m.stoneDk, 0.25, { bevel: 1.2 });
      return on ? { light: [0, -31] } : null;
    },
    switch(B, o, f) {
      const m = mats(), on = f === 'on', look = o.look || 'plate', col = R.Hd.RZ.mat({ keys: SW[o.color] || SW.teal, n: 4, flat: false });
      if (look === 'lever') { B.poly([[-6, 0], [6, 0], [6, -5], [-6, -5]], m.stone, 0, { bevel: 1 }); B.cap(0, -4, on ? 6 : -6, -14, 1, 0.8, m.iron, 0.1); B.ell(on ? 6 : -6, -14.5, 2, 2, col, 0.2); }
      else if (look === 'hole') { B.ell(0, -3, 8, 4, m.stone, 0, { bulge: 0.4 }); B.ell(0, -3.5, 5, 2.4, on ? col : m.dark, 0.1, { bulge: 0.1 }); }
      else { B.poly([[-9, 0], [9, 0], [9, -5], [-9, -5]], m.stone, 0, { bevel: 1.2 }); B.poly([[-7, on ? -2 : -4], [7, on ? -2 : -4], [7, on ? -4 : -7], [-7, on ? -4 : -7]], col, 0.1, { bevel: 1, ny: -0.8 }); }
      return on ? { light: [0, -5], cyan: true, small: true } : null;
    },
    songstone(B) { const m = mats(); B.ell(0, -1, 9, 3.5, m.stone, 0, { bulge: 0.4 }); B.poly([[-6, -1], [6, -1], [5, -26], [1, -32], [-4, -28], [-6, -18]], m.stoneDk, 0.1, { bevel: 2.5, nx: -0.1 }); [[-2, -22], [1, -17], [-1, -11]].forEach(([x, y]) => B.rect(x, y, 2.4, 3, m.rune, 0.2)); B.ell(-3, -6, 4, 2, m.moss, 0.15, { bulge: 0.6 }); return { light: [0, -18], cyan: true, small: true }; },
    footprint(B) { const m = mats(); B.ell(0, -3, 2.4, 3, m.foot, 0); [[-2.6, -7], [0, -7.8], [2.6, -7]].forEach(([x, y]) => B.ell(x, y, 1, 1.1, m.foot, 0.1)); return { light: [0, -4], cyan: true, small: true }; },
    beacon(B, o, f) {
      const m = mats(), k = (+String(f).replace(/\D/g, '') || 0);
      B.ell(0, -2, 15, 6, m.stone, 0, { bulge: 0.5 }); B.poly([[-11, -2], [11, -2], [11, -8], [-11, -8]], m.stone, 0.05, { bevel: 2 });
      B.cap(0, -8, 0, -40, 5.5, 4.5, m.stoneDk, 0.1);
      B.ell(0, -42, 9, 3.5, m.iron, 0.2, { bulge: 0.4 }); B.poly([[-9, -42], [9, -42], [6, -48], [-6, -48]], m.iron, 0.25, { bevel: 1.5 });
      B.ell(0, -50, 5.5 - k * 0.3, 4.5 + k * 0.5, m.flame, 0.3); B.ell(-1 + k, -55 - k, 3, 4, m.flame, 0.35); B.ell(0, -50, 2.5, 2.5, m.beam, 0.36);
      return { light: [0, -50], big: true, fire: true };
    },
    stairs_up(B) { const m = mats(); for (let i = 0; i < 4; i++) B.poly([[-14 + i, -i * 5], [14 - i, -i * 5], [14 - i, -i * 5 - 5], [-14 + i, -i * 5 - 5]], m.stone, i * 0.01, { bevel: 1, ny: -0.6 }); },
    stairs_down(B) { const m = mats(); B.poly([[-15, 0], [15, 0], [15, -26], [-15, -26]], m.stoneDk, 0, { bevel: 2 }); for (let i = 0; i < 4; i++) B.poly([[-12 + i * 1.5, -22 + i * 5], [12 - i * 1.5, -22 + i * 5], [12 - i * 1.5, -19 + i * 5], [-12 + i * 1.5, -19 + i * 5]], i === 3 ? m.dark : m.stone, 0.1 + i * 0.01, { bevel: 0.8, shadeOff: -i }); },
    door(B) { const m = mats(); B.poly([[-12, 0], [12, 0], [12, -26], [8, -31], [-8, -31], [-12, -26]], m.stoneDk, 0, { bevel: 2 }); B.poly([[-9, 0], [9, 0], [9, -24], [6, -28], [-6, -28], [-9, -24]], m.crate, 0.1, { bevel: 1 }); B.cap(-9, -9, 9, -9, 0.8, 0.8, m.iron, 0.2); B.cap(-9, -19, 9, -19, 0.8, 0.8, m.iron, 0.2); B.ell(5, -13, 1.2, 1.2, m.gold, 0.25); },
    // --- 町の飾り（CONTENT が prop として置ける）
    bollard(B) { const m = mats(); B.cap(0, -1, 0, -9, 3.2, 2.8, m.iron, 0); B.ell(0, -10, 3.4, 1.8, m.iron, 0.1); },
    stall(B) { const m = mats(); [-14, 14].forEach((x) => B.cap(x, 0, x, -26, 1, 1, m.wood, 0)); B.poly([[-17, -10], [17, -10], [17, -16], [-17, -16]], m.crate, 0.1, { bevel: 1.5 }); for (let i = 0; i < 5; i++) B.ell(-11 + i * 5.5, -18, 2.6, 1.6, i % 2 ? m.fish : m.fruit, 0.2 + i * 0.01); for (let i = 0; i < 6; i++) B.poly([[-18 + i * 6, -26], [-12 + i * 6, -26], [-12 + i * 6, -33], [-18 + i * 6, -33]], i % 2 ? m.cloth : m.linen, 0.3, { bevel: 1, ny: -0.6 }); },
    net(B) { const m = mats(); for (let i = 0; i < 6; i++) B.ell(-8 + i * 3, -2 - (i % 2), 4, 2, m.rope, 0.1 + i * 0.01, { bulge: 0.3 }); },
    rowboat(B) { const m = mats(); B.poly([[-24, -2], [22, -2], [28, -9], [20, -14], [-22, -14], [-28, -8]], m.barrel, 0, { bevel: 4, ny: -0.3 }); B.poly([[-19, -5], [18, -5], [22, -9], [17, -12], [-18, -12], [-22, -8]], m.dark, 0.1, { bevel: 2 }); [-8, 6].forEach((x) => B.rect(x, -13, 3, 9, m.crate, 0.2)); },
    ship(B) {
      const m = mats(), RZ = R.Hd.RZ;
      const hull = RZ.mat({ keys: ['#120a06', '#26160c', '#3e2616', '#583a22', '#724e30'], n: 6, tex: 1, tsx: 0.1, tsy: 1.4 });
      const deck = RZ.mat({ keys: ['#2c1c10', '#4a321e', '#6a4c30', '#8a6a46', '#a88660'], n: 6, tex: 1.4, tsx: 0.08, tsy: 1.2 });
      B.poly([[-66, 0], [50, 0], [78, -12], [58, -20], [-64, -20], [-74, -10]], hull, 0, { bevel: 5, ny: 0.5 });
      B.poly([[-66, -16], [52, -16], [80, -26], [56, -40], [-62, -40], [-74, -28]], deck, 0.1, { bevel: 3, ny: -0.8 });
      B.poly([[-48, -22], [-20, -22], [-20, -40], [-48, -40]], hull, 0.2, { bevel: 2, ny: 0.2 });
      B.poly([[-50, -40], [-18, -40], [-22, -48], [-46, -48]], m.stone, 0.25, { bevel: 1.5, ny: -0.8 });
      B.poly([[-40, -30], [-30, -30], [-30, -25], [-40, -25]], m.glowW, 0.26, { bevel: 0.2 });
      B.cap(14, -28, 14, -98, 2.2, 1.6, m.wood, 0.3); B.cap(-22, -76, 50, -80, 1.1, 1.1, m.wood, 0.31); B.cap(-18, -78, 46, -82, 3.4, 2.6, m.linen, 0.32);
      B.cap(14, -98, 72, -24, 0.35, 0.35, m.rope, 0.29); B.cap(14, -98, -60, -26, 0.35, 0.35, m.rope, 0.29);
      B.poly([[11, -90], [17, -90], [17, -83], [11, -83]], m.glowW, 0.34, { bevel: 0.2 });
      for (let i = 0; i < 3; i++) B.cap(-2 + i * 10, -26, -2 + i * 10, -33, 4.5, 4.5, m.barrel, 0.22 + i * 0.01);
      return { light: [14, -86] };
    },
    crystal(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 3); for (let i = 0; i < 5; i++) { const a = (r() - 0.5) * 1.2, h = 10 + r() * 16, x = (r() - 0.5) * 12; B.poly([[x - 3, 0], [x + 3, 0], [x + 2 + Math.sin(a) * h, -h * 0.8], [x + Math.sin(a) * h, -h], [x - 2 + Math.sin(a) * h, -h * 0.8]], m.crystal, 0.1 + i * 0.01, { bevel: 2 }); } return { light: [0, -12], cyan: true }; },
    tent(B) { const m = mats(); B.poly([[-18, 0], [18, 0], [0, -26]], m.linen, 0, { bevel: 3, ny: -0.2 }); B.poly([[-4, 0], [4, 0], [0, -12]], m.dark, 0.1); },
    grave(B) { const m = mats(); B.poly([[-6, 0], [6, 0], [6, -14], [3, -18], [-3, -18], [-6, -14]], m.stone, 0, { bevel: 2 }); },
    hay(B) { const m = mats(); B.ell(0, -6, 10, 7, m.sack, 0, { bulge: 0.9 }); B.ell(0, -11, 7, 3, m.sack, 0.1); },
    // --- 木（素材 tree・forest_dark の縁、テーマで種類を変える）。v = 形の変化、h = 高さ
    tree(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) * 131 + 3), h = o.h || 56, lf = o.leaf === 'moss' ? m.leafMoss : o.leaf === 'dk' ? m.leafDk : m.leaf; B.cap(0, 0, -h * 0.03, -h * 0.55, h * 0.07, h * 0.045, m.bark, 0); B.cap(-h * 0.02, -h * 0.4, -h * 0.18, -h * 0.6, h * 0.03, h * 0.02, m.bark, 0); const n = 9 + Math.floor(r() * 5), cy = -h * 0.68; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * h * 0.26, rad = h * (0.13 + r() * 0.08); const px = Math.cos(a) * rr * 1.25, py = cy + Math.sin(a) * rr * 0.9; B.ell(px, py, rad, rad * 0.9, lf, 0.2 + (py - cy + h) * 0.001 + i * 0.0001, { bulge: 0.85 }); } },
    pine(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) * 131 + 5), h = o.h || 56; B.cap(0, 0, 0, -h * 0.3, h * 0.05, h * 0.04, m.bark, 0); for (let i = 0; i < 5; i++) { const t0 = -h * (0.18 + i * 0.16), w = h * (0.36 - i * 0.058) * (0.9 + r() * 0.2), th = h * 0.3; B.poly([[-w, t0], [-w * 0.55, t0 - th * 0.35], [0, t0 - th], [w * 0.55, t0 - th * 0.35], [w, t0], [w * 0.4, t0 - th * 0.08], [0, t0 + th * 0.06], [-w * 0.45, t0 - th * 0.06]], m.pine, 0.1 + i * 0.01, { bevel: w * 0.7, ny: -0.25 }); } },
    tree_giant(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) * 131 + 7), h = o.h || 96; B.ell(0, -2, h * 0.2, h * 0.05, m.bark, 0, { bulge: 0.4 }); B.cap(0, 0, 0, -h * 0.5, h * 0.13, h * 0.09, m.bark, 0.05); [-1, 1].forEach((s) => B.cap(s * h * 0.12, -2, s * h * 0.2, 0, h * 0.04, h * 0.02, m.bark, 0.04)); const n = 14 + Math.floor(r() * 4), cy = -h * 0.7; for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * h * 0.3, rad = h * (0.11 + r() * 0.06); B.ell(Math.cos(a) * rr * 1.3, cy + Math.sin(a) * rr * 0.8, rad, rad * 0.85, m.leafMoss, 0.2 + i * 0.001, { bulge: 0.85 }); } },
    bush(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) * 17 + 5), lf = o.leaf === 'moss' ? m.leafMoss : m.leaf; for (let i = 0; i < 7; i++) B.ell((r() - 0.5) * 16, -5 - r() * 6, 5 + r() * 3, 4 + r() * 2, lf, 0.1 + i * 0.01, { bulge: 0.85 }); },
    roots(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) * 29 + 9); for (let i = 0; i < 4; i++) { const a = -0.6 + r() * 1.2, L = 12 + r() * 8; B.cap(-L * Math.cos(a), -2 - r() * 4, L * Math.cos(a), -6 - r() * 8, 3 + r() * 2, 2 + r(), m.bark, 0.1 + i * 0.01); } B.ell(0, -10, 5, 3, m.moss, 0.2, { bulge: 0.6 }); },
    // 地面の小さな飾り（テーマの散らし。内部用）
    dec_tuft(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 17); for (let i = 0; i < 5; i++) { const x = (i - 2) * 1.6 + (r() - 0.5), L = 3 + r() * 3; B.cap(x, 0, x + (r() - 0.5) * 3, -L, 0.7, 0.3, o.leaf === 'moss' ? m.leafMoss : m.leaf, 0.1 + i * 0.01); } },
    dec_flowers(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 19); for (let i = 0; i < 4; i++) { const x = (r() - 0.5) * 8, y = -(r() * 4); B.cap(x, y, x, y - 3, 0.4, 0.3, m.leaf, 0.1); B.ell(x, y - 4, 1.3, 1, [m.petalP, m.petalY, m.petalW][i % 3], 0.2); } },
    dec_pebbles(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 23); for (let i = 0; i < 3; i++) B.ell((r() - 0.5) * 8, -1 - r() * 2, 1.4 + r(), 1, m.stone, 0.1 + i * 0.01, { bulge: 0.7 }); },
    dec_mush(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 29); for (let i = 0; i < 2; i++) { const x = (i - 0.5) * 3 + r(), h = 2 + r() * 2; B.cap(x, 0, x, -h, 0.5, 0.4, m.mushStem, 0.1); B.ell(x, -h - 0.6, 1.6, 1, m.mush, 0.2); } return { light: [0, -3], cyan: true, small: true }; },
    dec_leaves(B, o) { const m = mats(), r = R.Hd.RZ.rng((o.v || 0) + 31); for (let i = 0; i < 4; i++) B.ell((r() - 0.5) * 10, -r() * 3, 1.6, 0.9, [m.fruit, m.pot, m.sack][i % 3], 0.1 + i * 0.01, { rot: r() * 3 }); },
  };

  // 物の meta（K.propDef）。仮の一覧（stub_art.js の PROPS）の id を全部、同じ意味で
  const L = (kind, r, extra) => Object.assign({ kind, r }, extra || {});
  const META = {
    barrel: { solid: true, shadow: 'blob' }, crate: { solid: true, shadow: 'blob' }, sack: { soft: true }, bench: { soft: true }, chair: { soft: true },
    table: { solid: true, light: L('candle', 40) }, bed: { solid: true }, bookshelf: { solid: true }, counter: { solid: true }, stove: { solid: true, light: L('fire', 70) },
    lamp_post: { solid: true, light: L('lamp', 'lampR'), glow: true, shadow: 'long' }, lantern: { soft: true, light: L('lamp', 60), glow: true }, fence: { solid: true },
    flower_pot: { soft: true }, well: { solid: true, shadow: 'blob' }, signboard: { solid: true }, rock_small: { soft: true }, stump: { solid: true }, log: { solid: true },
    mushroom_glow: { soft: true, glow: true, light: L('crystal', 34) }, firefly: { soft: true, glow: true },
    rope_bridge: { overChars: true }, leaves_over: { overChars: true },
    chest: { solid: true, frames: ['closed', 'open', 'rare_closed', 'rare_open'], glow: 'sparkle', light: L('chest', 34) },
    spring: { solid: true, light: L('spring', 150), glow: true, footprint: [2, 2], frames: ['f0', 'f1', 'f2', 'f3'] },
    brazier: { solid: true, frames: ['off', 'on'], light: L('fire', 'fire') }, waylamp: { solid: true, frames: ['off', 'on'], light: L('lamp', 'lampR') },
    switch: { soft: true, frames: ['off', 'on'] }, songstone: { solid: true, glow: true, light: L('crystal', 48) }, footprint: { soft: true, glow: true },
    beacon: { light: L('fire', 220), glow: true }, stairs_up: {}, stairs_down: {}, door: {},
    // 足した物
    board: { solid: true }, bollard: { solid: true }, stall: { solid: true }, net: { soft: true }, rowboat: { solid: true }, ship: { solid: true, light: L('lamp', 80) },
    crystal: { solid: true, glow: true, light: L('crystal', 90) }, torch: { solid: true, frames: ['off', 'on'], light: L('fire', 90) }, planter: { solid: true },
    tent: { solid: true }, grave: { solid: true }, hay: { solid: true }, rock: { solid: true, shadow: 'blob' },
    tree: { solid: true, shadow: 'long' }, pine: { solid: true, shadow: 'long' }, tree_giant: { solid: true, shadow: 'long' }, bush: { solid: true }, roots: { solid: true },
  };
  // 動く物（コマが時間で回る）: 泉・かがり火（on の間）・大灯火
  const ANIM = { spring: { poses: { f0: [0, 1, 2, 3] }, fps: { f0: 4 } }, brazier: { on: 3, fps: 8 }, torch: { on: 3, fps: 8 }, beacon: { poses: { f0: [0, 1, 2] }, fps: { f0: 6 } } };
  T._PROP_META = META;
  T._PROP_DRAW = DRAW;

  /** 灯りの仕様（meta.light）→ {r, color, k, kind}（R.Hd.STYLE.light の値から） */
  T._lightSpec = function (spec, cyan) {
    if (!spec) return null;
    const S = SL(), r = spec.r === 'lampR' ? S.lampR : spec.r === 'fire' ? Math.round(S.lampR * S.fireMul) : spec.r;
    const color = spec.kind === 'fire' ? S.fireColor : spec.kind === 'crystal' || spec.kind === 'spring' || cyan ? S.crystalColor : spec.kind === 'chest' ? S.windowColor : S.lampColor;
    const k = spec.kind === 'chest' ? 0.55 : spec.kind === 'crystal' ? 0.8 : spec.kind === 'candle' ? 0.6 : 1;
    return { r, color, k, kind: spec.kind };
  };

  for (const id of Object.keys(DRAW)) {
    if (/^dec_/.test(id)) continue;
    const meta = META[id] || {};
    const pub = {};
    for (const k of ['solid', 'soft', 'glow', 'shadow', 'footprint', 'frames', 'overChars']) if (meta[k] !== undefined) pub[k] = meta[k];
    if (meta.light) pub.light = { r: meta.light.r === 'lampR' ? 110 : meta.light.r === 'fire' ? 143 : meta.light.r, kind: meta.light.kind };
    R.def('props', id, pub);
  }

  // ------------------------------------------------------------------ 焼く
  const FL = () => ({ key: [-0.45, -0.55, 0.7], rim: [0.6, -0.5, -0.6], rimC: R.Hd.RZ.hex('#9fc0ff'), rimK: 0.9, mul: [1, 0.96, 0.9] });
  /** 夜の環境光を掛けるときの掛け算の色（見つけてほしい物なので環境光より明るく持ち上げる） */
  function ambMul(amb) {
    const c = R.Hd.RZ.hex(amb);
    return [0.42 + (c[0] / 255) * 0.62, 0.42 + (c[1] / 255) * 0.62, 0.42 + (c[2] / 255) * 0.62].map((v) => Math.min(1, v));
  }
  function frameNames(id) {
    const meta = META[id] || {};
    if (ANIM[id] && ANIM[id].on) return ['off', 'on0', 'on1', 'on2'];
    if (id === 'spring') return ['f0', 'f1', 'f2', 'f3'];
    if (id === 'beacon') return ['f0', 'f1', 'f2'];
    return meta.frames || ['default'];
  }
  function bakeProp(id, o) {
    if (!(R.Hd && R.Hd.RZ && R.Hd.RZ.Builder)) return null;   // ラスタライザがまだ無い → 後でまた
    const RZ = R.Hd.RZ, S = R.Hd.STYLE || {}, s = o.s || 1, names = frameNames(id);
    const light = FL();
    if (o.amb) light.mul = ambMul(o.amb);
    const frames = [], poses = {};
    let info = null, w = 0, h = 0;
    names.forEach((f, i) => {
      const B = new RZ.Builder();
      const r = DRAW[id](B, o, f) || null;
      if (r && !info) info = r;
      const out = RZ.render(B, { scale: s, light, tones: S.tones || 5, sat: S.sat || 0.9, olMix: S.olMix || 0.82 });
      const fr = RZ.frame(out);
      if (r && r.light) fr.anchors = { light: [r.light[0] * s, r.light[1] * s] };
      frames.push(fr);
      w = Math.max(w, out.canvas.width); h = Math.max(h, out.canvas.height);
      poses[f] = [i];
    });
    const fps = {};
    const an = ANIM[id];
    if (an && an.on) { poses.on = [1, 2, 3]; fps.on = an.fps; }
    if (an && an.poses) { Object.assign(poses, an.poses); Object.assign(fps, an.fps); }
    if (!poses.default) poses.default = [0];
    const meta = Object.assign({ id }, R.DB.props[id] || {});
    if (info) meta.emit = { light: info.light ? [info.light[0] * s, info.light[1] * s] : null, cyan: !!info.cyan, big: !!info.big, small: !!info.small, fire: !!info.fire };
    return { frames, poses, fps, anchors: { feet: [0, 0], light: info && info.light ? [info.light[0] * s, info.light[1] * s] : null }, w, h, meta };
  }
  for (const id of Object.keys(DRAW)) T._hdDef('hd:prop:' + id, (o) => bakeProp(id, o || {}), R.DB.props[id] || {});
  T._bakeProp = bakeProp;

  // 見つけた後の隠し通路（床の素材 + 壁の縁の細い印）。opts {floor, tile}
  for (const wall of ['rock', 'cliff', 'wall_stone', 'wall_brick', 'wall_wood', 'wall_moss', 'wall_bark', 'wall_cave', 'forest_dark', 'tree', 'bush', 'roots']) {
    T._hdDef('hd:secret:' + wall, (o) => {
      o = o || {};
      const tile = o.tile || 32, c = T._u.canvas(tile, tile);
      if (!c) return null;
      const g = c.getContext('2d');
      T.material(o.floor || 'cave_floor').bake(g, { x: 0, y: 0, w: tile, h: tile }, null, tile);
      T._secretMark(g, 0, 0, tile, wall);
      return { frames: [{ c, ox: 0, oy: 0 }], poses: { default: [0] }, anchors: {}, w: tile, h: tile, meta: { wall, floor: o.floor } };
    }, { secret: true });
  }
  /** 見つけた隠し通路の印: 左右に壁の色の細い縁（通れる所が壁の続きだったと分かる）と、足もとの割れ目 */
  T._secretMark = function (g, x, y, tile, wall) {
    const c = T.matColor(wall, true);
    g.save();
    g.fillStyle = c; g.globalAlpha = 0.9;
    g.fillRect(x, y, 2, tile); g.fillRect(x + tile - 2, y, 2, tile);
    g.globalAlpha = 0.5; g.fillStyle = 'rgba(12,10,20,1)';
    g.fillRect(x + 2, y, 1, tile); g.fillRect(x + tile - 3, y, 1, tile);
    g.globalAlpha = 0.35; g.fillStyle = 'rgba(160,220,230,1)';
    for (let i = 0; i < 3; i++) g.fillRect(x + tile * 0.3 + i * tile * 0.15, y + tile * 0.5 + (i % 2) * 3, 3, 1);
    g.restore();
  };
})(window.RPG);
