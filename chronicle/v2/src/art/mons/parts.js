// BEAST: 魔物の部品（組み立て表の 3 列目 [[部品, {c, …}]]）。土台の点の表（head・eye・back・spine・top・body…）に付ける。
// R.Beast.PARTS[name](B, pts, o, ctx)  o = 表の値（c = 主の色）、ctx = {P, st, golden}
// 部品の色も 1 色から鍵を作って素材にする（金色の個体は金へ）。段が上がると部品が増える＝色だけの違いにしない（ART_REWORK §2.5）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const PARTS = (BZ.PARTS = BZ.PARTS || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  /** 部品の素材: 1 色 → 鍵 5 つ（金色の個体は金へ） */
  function pm(c, ctx, extra) {
    let keys = BZ.keysFrom(c || '#c0c0c0', extra && extra.shadowHue != null ? { shadowHue: extra.shadowHue } : null);
    if (ctx.golden && !(extra && extra.noGold)) keys = BZ.goldKeys(keys);
    const o = Object.assign({ keys, n: 6, wrap: 0.3, amb: 0.2 }, extra || {});
    delete o.shadowHue; delete o.noGold;
    return BZ.mat(o);
  }
  BZ.partMat = pm;
  const z0 = (pts) => pts.z || 1.5;

  // あわ（あわゼリー）: 体の中と周りに浮く泡
  PARTS.bubbles = function (B, pts, o, ctx) {
    const m = pm(o.c || '#c8f0ff', ctx, { spec: 1, specPow: 6, wrap: 0.8, amb: 0.45, alpha: 0.85, ao: 0 });
    const hi = BZ.mat({ keys: ['#ffffff', '#ffffff'], n: 2, flat: true });
    const b = pts.body || [0, -12, 14, 12], u = pts.u || 1, t = ctx.st.t || 0;
    const list = [[0.55, -0.55, 2.2], [-0.35, -0.9, 1.6], [0.95, -1.05, 1.3], [-0.85, -0.25, 1.4], [0.2, 0.15, 1.1], [1.15, -0.2, 1.0], [-0.1, -1.35, 1.2]];
    list.forEach(([fx, fy, r], i) => {
      const x = b[0] + fx * b[2] * 0.8, y = b[1] + fy * b[3] * 0.9 - S((t + i * 0.17) * PI * 2) * 0.8 * u;
      const rr = r * u;
      B.ell(x, y, rr, rr, m, z0(pts) + 0.05 + i * 0.001, { g: B.group(), noAO: true });
      B.rect(x - rr * 0.45, y - rr * 0.55, 1, 1, hi, z0(pts) + 0.06 + i * 0.001);
    });
  };

  // 霜（霜牙オオカミ）: 背すじに氷の結晶、口に白い息
  PARTS.frost = function (B, pts, o, ctx) {
    const I = pm(o.c || '#e8fcff', ctx, { spec: 1, specPow: 5, wrap: 0.2, amb: 0.35, rim: '#ffffff', rimK: 0.8, sheen: [-0.9, -0.3], shadowHue: -25 });
    const shard = (b, a, len, w, z) => {
      const d = [S(a), -C(a)], n = [-d[1], d[0]];
      const p = [[b[0] - n[0] * w, b[1] - n[1] * w], [b[0] + d[0] * len * 0.75 - n[0] * w * 0.8, b[1] + d[1] * len * 0.75 - n[1] * w * 0.8], [b[0] + d[0] * len, b[1] + d[1] * len],
        [b[0] + d[0] * len * 0.7 + n[0] * w * 0.9, b[1] + d[1] * len * 0.7 + n[1] * w * 0.9], [b[0] + n[0] * w, b[1] + n[1] * w]];
      const g = B.group();
      B.poly(p, I, z, { g, bevel: w * 0.9, nx: -0.3 });
      B.fold(b[0] + d[0], b[1] + d[1], b[0] + d[0] * len * 0.8, b[1] + d[1] * len * 0.8, w * 0.35, g, 2);
    };
    const sp = pts.spine || [pts.back || [0, -30]];
    const conf = [[0.2, 13, 2.8], [-0.3, 10, 2.4], [-0.75, 9, 2.2], [-0.95, 7, 2.0], [-1.15, 6, 1.7]];
    sp.forEach((p, i) => { const c = conf[i % conf.length]; shard(p, c[0], c[1] * (pts.u || 1) * 0.9, c[2], 1.3 + i * 0.001); });
    if (pts.mouth) {
      const mist = BZ.mat({ keys: ['#a8c8e8', '#e8f8ff'], n: 2, flat: true, alpha: 0.55, noOutline: true });
      const m = pts.mouth;
      B.ell(m[0] + 4, m[1] + 1, 2.4, 1.4, mist, 2.4, { noOutline: true });
      B.ell(m[0] + 7.5, m[1] - 0.5, 1.6, 1.0, mist, 2.4, { noOutline: true });
    }
  };

  // 光る目（毒牙ネズミ・血吸いコウモリ）: 目を光る色で塗り直し、にじみを 1 段
  PARTS.eyes_glow = function (B, pts, o, ctx) {
    if (ctx.st.hit > 0.5) return;
    const c = BZ.color.hex(o.c || '#ff4040');
    const lite = BZ.color.toHex(c.map((v) => Math.min(255, v + 110)));
    const m = BZ.mat({ keys: [o.c || '#ff4040', lite], n: 2, flat: true, glow: lite });
    const halo = BZ.mat({ keys: [o.c || '#ff4040', o.c || '#ff4040'], n: 2, flat: true, glow: o.c || '#ff4040', alpha: 0.45, noOutline: true });
    for (const e of pts.eyes || (pts.eye ? [[pts.eye[0], pts.eye[1], 1.2]] : [])) {
      const r = e[2] || 1.2;
      B.ell(e[0], e[1], r * 1.9, r * 1.5, halo, (pts.z || 2) + 0.4, { noAO: true, noOutline: true });
      B.ell(e[0], e[1], r * 0.95, r * 1.05, m, (pts.z || 2) + 0.5, { noAO: true });
      B.rect(e[0] - 0.4, e[1] - r * 0.6, 1, 1, BZ.mat({ keys: ['#ffffff', '#ffffff'], n: 2, flat: true }), (pts.z || 2) + 0.51);
    }
  };

  // 鉄の板（鉄甲ガニ）: 甲羅に鋲を打った板を 3 枚
  PARTS.armor_plates = function (B, pts, o, ctx) {
    const m = BZ.mat({ keys: ctx.golden ? BZ.goldKeys(['#141828', '#2a3244', '#465266', '#6a7688', '#9aa4b2']) : ['#141828', '#2a3244', '#465266', '#6a7688', '#9aa4b2'], n: 6, spec: 1, specPow: 14, wrap: 0.2, amb: 0.12 });
    const rivet = BZ.mat({ keys: ['#3a3848', '#e8e4dc'], n: 2, flat: true });
    const sh = pts.shell || pts.body || [0, -12, 12, 8];
    const [cx, cy, rx, ry] = sh;
    [[-0.55, 0.9], [0.05, 1.0], [0.6, 0.85]].forEach(([fx, k], i) => {
      const x = cx + fx * rx, y = cy - ry * 0.35 - (1 - Math.abs(fx)) * ry * 0.35;
      const w = rx * 0.42 * k, h = ry * 0.75 * k;
      const g = B.group();
      B.poly([[x - w, y + h * 0.5], [x - w * 0.8, y - h * 0.55], [x + w * 0.8, y - h * 0.7], [x + w, y + h * 0.4], [x, y + h * 0.75]], m, (pts.z || 1.5) - 0.3 + i * 0.01, { g, bevel: 1.4, ny: -0.35 });
      B.rect(x - w * 0.55, y - h * 0.2, 1, 1, rivet, (pts.z || 1.5) - 0.28 + i * 0.01);
      B.rect(x + w * 0.45, y - h * 0.3, 1, 1, rivet, (pts.z || 1.5) - 0.28 + i * 0.01);
    });
  };

  // 嵐（嵐カモメ）: 翼の上の小さな雨雲と、体の周りの稲光の筋
  PARTS.storm = function (B, pts, o, ctx) {
    const cloud = pm('#5a6078', ctx, { wrap: 0.7, amb: 0.35, ao: 0, shadowHue: -20 });
    const bolt = BZ.mat({ keys: [o.c || '#c0d8f0', '#ffffff'], n: 2, flat: true, glow: '#e8f4ff' });
    const t = ctx.st.t || 0;
    const top = pts.top || [0, -30];
    const c0 = [top[0] + 2, top[1] - 5 + S(t * PI * 2) * 0.8];
    [[0, 0, 5], [4.5, 1, 3.8], [-4.5, 1.2, 3.6], [1.5, -2.5, 3.6]].forEach(([dx, dy, r], i) => B.ell(c0[0] + dx, c0[1] + dy, r, r * 0.75, cloud, 3 + i * 0.001, { bulge: 0.8 }));
    const zig = (x, y, k) => [[x, y], [x + 1.5 * k, y + 3], [x - 0.5 * k, y + 3.5], [x + 1 * k, y + 7]];
    const z1 = zig(c0[0] - 1, c0[1] + 3, 1);
    for (let i = 0; i < z1.length - 1; i++) B.cap(z1[i][0], z1[i][1], z1[i + 1][0], z1[i + 1][1], 0.5, 0.5, bolt, 3.1, { noAO: true });
    if (pts.body) {
      const [bx, by, rx] = pts.body;
      const z2 = zig(bx - rx - 1, by + 1, -1);
      for (let i = 0; i < z2.length - 1; i++) B.cap(z2[i][0], z2[i][1], z2[i + 1][0], z2[i + 1][1], 0.45, 0.45, bolt, 3.1, { noAO: true });
    }
  };

  // 毒の針（毒針バチ）: 長く光る針としずく
  PARTS.stinger = function (B, pts, o, ctx) {
    if (!pts.stinger) return;
    const [b, d] = pts.stinger;
    const m = pm(o.c || '#a040c0', ctx, { spec: 1, specPow: 6, wrap: 0.4, amb: 0.3, shadowHue: -30 });
    const drop = BZ.mat({ keys: [o.c || '#a040c0', '#f0c8ff'], n: 2, flat: true, glow: '#e0a0ff' });
    const L = 7;
    const tip = [b[0] + d[0] * L, b[1] + d[1] * L];
    B.poly([[b[0] + 1.5, b[1] - 1.8], [tip[0], tip[1]], [b[0] + 1.8, b[1] + 1.2]], m, 1.0, { bevel: 0.8 });
    B.ell(tip[0] - 0.3, tip[1] + 1.8, 0.9, 1.2, drop, 1.01);
  };

  // まだら（まだらダケ）: 傘に黄の斑
  PARTS.spots = function (B, pts, o, ctx) {
    const cp = pts.cap; if (!cp) return;
    const m = BZ.mat({ keys: ctx.golden ? BZ.goldKeys(['#806020', o.c || '#f0e060', '#fff8c0']) : ['#806020', o.c || '#f0e060', '#fff8c0'], n: 3, flat: false, wrap: 0.6, amb: 0.4 });
    const [cx, cy, rx, ry] = cp;
    [[-0.45, -0.45, 0.2], [0.2, -0.7, 0.16], [0.6, -0.15, 0.13], [-0.75, 0.05, 0.12], [-0.05, -0.1, 0.14], [0.35, -0.95, 0.09], [-0.2, -0.95, 0.09]]
      .forEach(([fx, fy, r], i) => B.ell(cx + fx * rx, cy + fy * ry, r * rx * 0.9, r * rx * 0.62, m, 1.66 + i * 0.001, { bulge: 0.5, noAO: true }));
  };

  // いばら（いばら花・いばら木）: 茎・枝の線に沿ってとげ
  PARTS.thorns = function (B, pts, o, ctx) {
    const m = pm(o.c || '#402810', ctx, { wrap: 0.3, shadowHue: -30 });
    const u = pts.u || 1;
    const lines = pts.thornLines || [];
    lines.forEach((ln, li) => {
      for (let s = 0; s < ln.length - 1; s++) {
        const a = ln[s], b = ln[s + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const n = Math.max(1, Math.floor(L / (3.2 * u)));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n, x = a[0] + dx * t, y = a[1] + dy * t, side = (k + s + li) % 2 ? 1 : -1;
          const nx = -dy / L * side, ny = dx / L * side;
          const len = (1.8 + ((k * 7 + li) % 3) * 0.4) * u, w = 0.8 * u;
          B.poly([[x - dx / L * w, y - dy / L * w], [x + nx * len + dx / L * len * 0.4, y + ny * len + dy / L * len * 0.4], [x + dx / L * w, y + dy / L * w]], m, (pts.z || 2) + 0.05 + li * 0.001, { bevel: 0.4, noAO: true });
        }
      }
    });
  };

  // 花（花の妖精）: 頭に大きな花、手に小さな花
  PARTS.flower = function (B, pts, o, ctx) {
    const pet = pm(o.c || '#ff90c0', ctx, { wrap: 0.5, amb: 0.3, shadowHue: -35 });
    const mid = BZ.mat({ keys: ctx.golden ? BZ.goldKeys(['#8a5010', '#f0c040', '#fff0a0']) : ['#8a5010', '#f0c040', '#fff0a0'], n: 3, wrap: 0.5 });
    const fl = (x, y, r, z) => {
      for (let i = 0; i < 5; i++) { const a = i * PI * 2 / 5 - 0.3; B.ell(x + C(a) * r * 0.9, y + S(a) * r * 0.7, r * 0.75, r * 0.55, pet, z, { rot: a, bulge: 0.7, noAO: true }); }
      B.ell(x, y, r * 0.45, r * 0.4, mid, z + 0.01, { noAO: true });
    };
    const top = pts.top || [0, -30];
    fl(top[0] - 1.5, top[1] + 1, 3.2 * (pts.u || 1), (pts.z || 2) + 0.2);
    if (pts.hand) fl(pts.hand[0] + 0.5, pts.hand[1] - 1, 1.8 * (pts.u || 1), (pts.z || 2) + 0.21);
  };
})(window.RPG);
