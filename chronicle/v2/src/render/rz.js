// RENDER: R.Hd.RZ — コードだけで描く 2.5D のラスタライザ（design/art_proto/code/raster.js から移した。V2_PLAN §1.2）
// 楕円体・先細りのカプセル・面取りの多角形・矩形を z バッファで塗り、画素ごとの法線で素材の色の段（ランプ）に量子化して陰を付ける。
// 重なりの陰の線（AO）・素材の暗い色の縁（olMix）・背中側のリム・金属の映り込み・髪のつや・部品の座標に固定したノイズ・場面の点光。
// 直したこと: window.RZ → R.Hd.RZ、canvas は RZ.canvas（読み込み時に document に触れない）、ctx.filter を使わない（縮小は drawImage の半分ずつ）、
// 純粋な黒を出さない（r+g+b < 3 の画素は R.Hd.STYLE.noBlack の色へ）。乱数は RZ.rng(種)、種は RZ.seed('キーの文字') で作る。
//   const { Builder, render, mat } = R.Hd.RZ;  const B = new Builder();  B.ell(0, -10, 6, 8, mat({keys:['#223','#88a']}), 1);
//   const r = render(B, {scale: 1, tones: R.Hd.STYLE.tones, olMix: R.Hd.STYLE.olMix});  →  R.Hd.RZ.frame(r) = {c, ox, oy}
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});

  /** 新しい canvas（ブラウザだけ。node では OffscreenCanvas も無いので例外） */
  function mk(w, h) {
    w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
    if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    throw new Error('R.Hd.RZ.canvas: no canvas in this environment');
  }
  const hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Build a ramp of n colours from key colours (dark → light), hue-shifting shadows cool / lights warm.
  function ramp(keys, n) {
    const k = keys.map(hex), out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) * (k.length - 1), j = Math.min(k.length - 2, Math.floor(t));
      out.push(mix(k[j], k[j + 1], t - j));
    }
    return out;
  }
  function mat(o) {
    const m = Object.assign({ tex: 0, tsx: 0.5, tsy: 0.5, n: 7, spec: 0, specPow: 18, rim: '#ffe2b0', rimK: 0.55, wrap: 0.25, amb: 0.18, flat: false, outline: null, ao: 1 }, o);
    m.r = ramp(m.keys, m.n);
    m.rimC = hex(m.rim);
    m.ol = m.outline ? hex(m.outline) : m.r[0].map((v) => v * 0.45);
    if (m.glow) m.glowC = hex(m.glow);
    return m;
  }

  class Builder {
    constructor() { this.p = []; this.gid = 1; }
    group() { return this.gid++; }
    add(o) { if (o.g == null) o.g = this.gid++; o.z = o.z || 0; this.p.push(o); return o; }
    ell(x, y, rx, ry, m, z, o) { return this.add(Object.assign({ t: 'e', x, y, rx, ry, rot: 0, m, z, bulge: 1 }, o)); }
    cap(x1, y1, x2, y2, r1, r2, m, z, o) { return this.add(Object.assign({ t: 'c', x1, y1, x2, y2, r1, r2, m, z }, o)); }
    poly(pts, m, z, o) { return this.add(Object.assign({ t: 'p', pts, m, z, bevel: 2, nx: 0, ny: 0 }, o)); }
    rect(x, y, w, h, m, z, o) { return this.add(Object.assign({ t: 'r', x, y, w, h, m, z }, o)); }
    // bezier strand (quadratic or cubic) → chain of tapered capsules sharing one group
    strand(pts, w0, w1, m, z, o) {
      o = o || {}; const g = o.g != null ? o.g : this.gid++, N = o.seg || 6;
      const bz = (t) => {
        if (pts.length === 3) { const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; return [a * pts[0][0] + b * pts[1][0] + c * pts[2][0], a * pts[0][1] + b * pts[1][1] + c * pts[2][1]]; }
        const a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
        return [a * pts[0][0] + b * pts[1][0] + c * pts[2][0] + d * pts[3][0], a * pts[0][1] + b * pts[1][1] + c * pts[2][1] + d * pts[3][1]];
      };
      let prev = bz(0);
      for (let i = 1; i <= N; i++) {
        const t = i / N, cur = bz(t);
        this.add(Object.assign({}, o, { t: 'c', x1: prev[0], y1: prev[1], x2: cur[0], y2: cur[1], r1: w0 + (w1 - w0) * (i - 1) / N, r2: w0 + (w1 - w0) * t, m, z: z + i * 0.001, g }));
        prev = cur;
      }
      return g;
    }
    // shade modifier: shifts ramp index for pixels of target group(s) that fall inside a capsule
    fold(x1, y1, x2, y2, r, target, d) { this.p.push({ t: 'c', x1, y1, x2, y2, r1: r, r2: r * 0.6, mod: true, target, d }); }
  }

  // ---- coverage / normal per primitive (model space point)
  // 速さ（P2、BEAST の依頼）: 部品を先に数に直し（compile）、当たりは配列を作らずに H0..H4 へ書く（ごみ集めを出さない）。
  // 行ごとに当たりうる x の範囲だけを見る（楕円・カプセル・多角形。範囲は広めに取り、判定そのものは前と同じ式なので画素は変わらない）。
  // z で負ける画素は当たりを計算しない。バッファは使い回す。
  let H0 = 0, H1 = 0, H2 = 0, H3 = 0, H4 = 0;
  const ET = 1, CT = 2, RT = 3, PT = 4;
  function compile(p) {
    const c = { p, t: 0, z: p.z, zr: p.zr || 0 };
    if (p.t === 'e') {
      c.t = ET; c.x = p.x; c.y = p.y; c.rx = p.rx; c.ry = p.ry; c.rot = p.rot; c.bulge = p.bulge;
      if (p.rot) { c.cr = Math.cos(-p.rot); c.sr = Math.sin(-p.rot); c.c2 = Math.cos(p.rot); c.s2 = Math.sin(p.rot); }
    } else if (p.t === 'c') {
      c.t = CT; c.x1 = p.x1; c.y1 = p.y1; c.x2 = p.x2; c.y2 = p.y2; c.r1 = p.r1; c.r2 = p.r2;
      c.vx = p.x2 - p.x1; c.vy = p.y2 - p.y1; c.L2 = c.vx * c.vx + c.vy * c.vy || 1e-6; c.sqL = Math.sqrt(c.L2); c.t0 = p.t0 || 0;
      c.rm = Math.max(p.r1, p.r2); c.Lr = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
    } else if (p.t === 'r') {
      c.t = RT; c.x = p.x; c.y = p.y; c.hw = p.w / 2; c.hh = p.h / 2;
    } else if (p.t === 'p') {
      c.t = PT; const n = p.pts.length; c.n = n; c.px = new Float64Array(n); c.py = new Float64Array(n);
      for (let i = 0; i < n; i++) { c.px[i] = p.pts[i][0]; c.py[i] = p.pts[i][1]; }
      c.nx = p.nx; c.ny = p.ny; c.bevel = p.bevel;
    }
    return c;
  }
  function hitE(c, x, y) {
    let dx = x - c.x, dy = y - c.y;
    if (c.rot) { const t = dx * c.cr - dy * c.sr; dy = dx * c.sr + dy * c.cr; dx = t; }
    const u = dx / c.rx, v = dy / c.ry, r2 = u * u + v * v;
    if (r2 > 1) return false;
    let nx = u * c.bulge, ny = v * c.bulge;
    if (c.rot) { const t = nx * c.c2 - ny * c.s2; ny = nx * c.s2 + ny * c.c2; nx = t; }
    H0 = nx; H1 = ny; H2 = Math.sqrt(Math.max(0, 1 - r2)) + (1 - c.bulge); H3 = dx; H4 = dy;
    return true;
  }
  function hitC(c, x, y) {
    const vx = c.vx, vy = c.vy, L2 = c.L2;
    const t = clamp(((x - c.x1) * vx + (y - c.y1) * vy) / L2, 0, 1);
    const qx = c.x1 + vx * t, qy = c.y1 + vy * t, r = c.r1 + (c.r2 - c.r1) * t;
    const dx = x - qx, dy = y - qy, d2 = dx * dx + dy * dy;
    if (d2 > r * r) return false;
    const k = 1 / Math.max(r, 1e-3);
    H0 = dx * k; H1 = dy * k; H2 = Math.sqrt(Math.max(0, 1 - d2 * k * k)); H3 = c.t0 + t * c.sqL; H4 = (dx * vy - dy * vx) / c.sqL;
    return true;
  }
  function hitR(c, x, y, sc) {
    const hw = c.hw, hh = c.hh, dx = (x - c.x - hw) / hw, dy = (y - c.y - hh) / hh;
    if (sc > 1.5) { if (dx ** 4 + dy ** 4 > 1) return false; } else if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return false;
    H0 = dx * 0.3; H1 = dy * 0.3; H2 = 1; H3 = x; H4 = y;
    return true;
  }
  function hitP(c, x, y) {
    const X = c.px, Y = c.py, n = c.n;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = X[i], yi = Y[i], xj = X[j], yj = Y[j];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    if (!inside) return false;
    let best = 1e9, bx = 0, by = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = X[i], yi = Y[i], xj = X[j], yj = Y[j];
      const vx = xj - xi, vy = yj - yi, L2 = vx * vx + vy * vy || 1e-6;
      const t = clamp(((x - xi) * vx + (y - yi) * vy) / L2, 0, 1), qx = xi + vx * t, qy = yi + vy * t;
      const d = (x - qx) ** 2 + (y - qy) ** 2;
      if (d < best) { best = d; bx = x - qx; by = y - qy; }
    }
    const d = Math.sqrt(best); let nx = c.nx, ny = c.ny;
    if (d < c.bevel && d > 1e-4) { const tl = (1 - d / c.bevel) * 0.85; nx -= bx / d * tl; ny -= by / d * tl; }
    H0 = nx; H1 = ny; H2 = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)); H3 = x - X[0]; H4 = y - Y[0];
    return true;
  }
  function hitAny(c, x, y, sc) { return c.t === ET ? hitE(c, x, y) : c.t === CT ? hitC(c, x, y) : c.t === RT ? hitR(c, x, y, sc) : c.t === PT ? hitP(c, x, y) : false; }
  /** 行 y（モデルの座標）で当たりうる x の範囲 → SA..SB。空なら false。広めでよい（判定は hit が決める） */
  let SA = 0, SB = 0;
  function span(c, y) {
    if (c.t === ET) {
      if (c.rot) { SA = -Infinity; SB = Infinity; return true; }
      const v = (y - c.y) / c.ry;
      if (v * v > 1) return false;
      const hw = c.rx * Math.sqrt(Math.max(0, 1 - v * v));
      SA = c.x - hw; SB = c.x + hw; return true;
    }
    if (c.t === CT) {
      const Rm = c.rm; let a = Infinity, b = -Infinity, d;
      d = y - c.y1; if (d * d <= Rm * Rm) { const h = Math.sqrt(Rm * Rm - d * d); a = Math.min(a, c.x1 - h); b = Math.max(b, c.x1 + h); }
      d = y - c.y2; if (d * d <= Rm * Rm) { const h = Math.sqrt(Rm * Rm - d * d); a = Math.min(a, c.x2 - h); b = Math.max(b, c.x2 + h); }
      const vx = c.vx, vy = c.vy;
      if (vy === 0) { if (Math.abs(y - c.y1) <= Rm) { a = Math.min(a, c.x1, c.x2); b = Math.max(b, c.x1, c.x2); } }
      else {
        const e = (y - c.y1) * vx, p0 = c.x1 + (e - Rm * c.Lr) / vy, p1 = c.x1 + (e + Rm * c.Lr) / vy;
        let lo = Math.min(p0, p1), hi = Math.max(p0, p1);
        const s = (y - c.y1) * vy;
        if (vx !== 0) { const q0 = c.x1 - s / vx, q1 = c.x1 + (c.L2 - s) / vx; lo = Math.max(lo, Math.min(q0, q1)); hi = Math.min(hi, Math.max(q0, q1)); }
        else if (s < 0 || s > c.L2) { lo = Infinity; hi = -Infinity; }
        if (lo <= hi) { a = Math.min(a, lo); b = Math.max(b, hi); }
      }
      if (!(a <= b)) return false;
      SA = a; SB = b; return true;
    }
    if (c.t === PT) {
      const X = c.px, Y = c.py, n = c.n; let a = Infinity, b = -Infinity;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = X[i], yi = Y[i], xj = X[j], yj = Y[j];
        if ((yi > y) !== (yj > y)) { const xc = (xj - xi) * (y - yi) / (yj - yi) + xi; if (xc < a) a = xc; if (xc > b) b = xc; }
      }
      if (!(a <= b)) return false;
      SA = a; SB = b; return true;
    }
    SA = -Infinity; SB = Infinity; return true;
  }
  function bbox(p) {
    if (p.t === 'e') { const r = Math.max(p.rx, p.ry); return [p.x - r, p.y - r, p.x + r, p.y + r]; }
    if (p.t === 'c') { const r = Math.max(p.r1, p.r2); return [Math.min(p.x1, p.x2) - r, Math.min(p.y1, p.y2) - r, Math.max(p.x1, p.x2) + r, Math.max(p.y1, p.y2) + r]; }
    if (p.t === 'r') return [p.x, p.y, p.x + p.w, p.y + p.h];
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const q of p.pts) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b, c, d];
  }

  const DEF_LIGHT = { key: [-0.35, -0.62, 0.7], rim: [0.8, -0.25, -0.55], mul: [1, 1, 1], pts: [], rimC: null, rimK: 1 };

  // 使い回すバッファ（POOL_PX 画素まで。大きい物はその回だけ作る）
  const POOL_PX = 400000;
  let pool = null, poolBusy = false;
  function buffers(N) {
    if (N > POOL_PX || poolBusy) return mkBuf(N);   // 大きい物・途中で止まっている仕事が使っている間は、その回だけ作る
    if (!pool || pool.cap < N) pool = mkBuf(Math.min(POOL_PX, Math.max(N, pool ? pool.cap * 2 : 65536)));
    poolBusy = true;
    return pool;
  }
  function release(buf) { if (buf === pool) poolBusy = false; }
  function mkBuf(n) { return { cap: n, zb: new Float32Array(n), pid: new Int32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n), dl: new Float32Array(n), tu: new Float32Array(n), tv: new Float32Array(n), occl: new Float32Array(n) }; }

  // render(builder, {scale, flip, light, outline, ssaa}) → {canvas, ox, oy}  (ox,oy = model origin in canvas px)
  function render(B, o) {
    const it = renderGen(B, o, null);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }
  /**
   * 切れ端で焼く（K.bakeJob の形）: RZ.job(B, o) → {kind, done, result, step(ms)}。result は render と同じ {canvas, ox, oy}（同じ画素）。
   * ボス・戦闘背景の大きい絵を R.Hd.pump の 1 フレーム 3 ms に収めるために使う
   */
  function job(B, o, kind) {
    const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    let deadline = 0;
    const S = { clk: () => clock() > deadline };
    const it = renderGen(B, o, S);
    const j = {
      kind: kind || 'other', done: false, result: null,
      step(ms) { if (j.done) return; deadline = clock() + Math.max(0.1, ms); const r = it.next(); if (r.done) { j.done = true; j.result = r.value; } },
    };
    return j;
  }
  function* renderGen(B, o, S) {
    o = Object.assign({ scale: 1, flip: false, outline: true, ssaa: 1, pad: 2, wx: 0, wy: 0 }, o);
    const L = Object.assign({}, DEF_LIGHT, o.light || {});
    const sc = o.scale * o.ssaa, fl = o.flip ? -1 : 1;
    const prims = B.p.filter((p) => !p.mod), mods = B.p.filter((p) => p.mod);
    const NP = prims.length;
    const boxes = prims.map(bbox);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of boxes) { const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0]; x0 = Math.min(x0, ax); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, bx); y1 = Math.max(y1, b[3]); }
    const pad = o.pad * o.ssaa;
    const ox = Math.ceil(-x0 * sc) + pad, oy = Math.ceil(-y0 * sc) + pad;
    const W = Math.ceil((x1 - x0) * sc) + pad * 2 + 1, H = Math.ceil((y1 - y0) * sc) + pad * 2 + 1;
    const N = W * H;
    const buf = S ? mkBuf(N) : buffers(N);   // 切れ端の仕事は自分のバッファ（途中で捨てられても使い回しの物を塞がない）
    const zb = buf.zb, pid = buf.pid, nxb = buf.nx, nyb = buf.ny, nzb = buf.nz, dl = buf.dl, tub = buf.tu, tvb = buf.tv, occl = buf.occl;
    zb.fill(-1e9, 0, N); pid.fill(-1, 0, N); dl.fill(0, 0, N);
    // 不透明な画素の外枠（AO・陰・縁の走査をここだけにする）
    let oX0 = W, oY0 = H, oX1 = -1, oY1 = -1;
    const cp = prims.map(compile);
    try {
    for (let i = 0; i < NP; i++) {
      if (S && S.clk()) yield;
      const c = cp[i], b = boxes[i], zr = c.zr, pz = c.z;
      const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0];
      const px0 = Math.max(0, Math.floor(ax * sc + ox) - 1), px1 = Math.min(W - 1, Math.ceil(bx * sc + ox) + 1);
      const py0 = Math.max(0, Math.floor(b[1] * sc + oy) - 1), py1 = Math.min(H - 1, Math.ceil(b[3] * sc + oy) + 1);
      const t = c.t;
      for (let py = py0; py <= py1; py++) {
        if (S && (py & 15) === 15 && S.clk()) yield;
        const my = (py + 0.5 - oy) / sc;
        if (!span(c, my)) continue;
        let xs = px0, xe = px1;
        if (SA !== -Infinity) {
          const pa = fl > 0 ? SA * sc + ox - 0.5 : -SB * sc + ox - 0.5, pb = fl > 0 ? SB * sc + ox - 0.5 : -SA * sc + ox - 0.5;
          xs = Math.max(px0, Math.floor(pa) - 2); xe = Math.min(px1, Math.ceil(pb) + 2);
        }
        const row = py * W;
        for (let px = xs; px <= xe; px++) {
          const k = row + px;
          if (!zr && pz < zb[k]) continue;
          const mx = fl * (px + 0.5 - ox) / sc;
          if (!(t === ET ? hitE(c, mx, my) : t === CT ? hitC(c, mx, my) : t === RT ? hitR(c, mx, my, sc) : t === PT ? hitP(c, mx, my) : false)) continue;
          const z = pz + (zr ? H2 * zr : 0);
          if (z >= zb[k]) {
            zb[k] = z; pid[k] = i; nxb[k] = H0 * fl; nyb[k] = H1; nzb[k] = H2; tub[k] = H3; tvb[k] = H4;
            if (px < oX0) oX0 = px; if (px > oX1) oX1 = px; if (py < oY0) oY0 = py; if (py > oY1) oY1 = py;
          }
        }
      }
    }
    // 部品ごとの値（画素ごとに prims[] の物を引かない）
    const G = new Float64Array(NP), NOAO = new Uint8Array(NP), AOK = new Uint8Array(NP);
    for (let i = 0; i < NP; i++) { const p = prims[i]; G[i] = p.g; NOAO[i] = p.noAO ? 1 : 0; AOK[i] = p.m.ao && !p.m.flat ? 1 : 0; }
    // shade modifiers (folds, seams)
    for (const q of mods) {
      if (S && S.clk()) yield;
      const b = bbox(q); const ax = fl > 0 ? b[0] : -b[2], bx = fl > 0 ? b[2] : -b[0];
      const cq = compile(q), arr = Array.isArray(q.target);
      for (let py = Math.max(0, Math.floor(b[1] * sc + oy)); py <= Math.min(H - 1, Math.ceil(b[3] * sc + oy)); py++)
        for (let px = Math.max(0, Math.floor(ax * sc + ox)); px <= Math.min(W - 1, Math.ceil(bx * sc + ox)); px++) {
          const k = py * W + px; if (pid[k] < 0) continue;
          const g = G[pid[k]]; if (q.target !== g && !(arr && q.target.includes(g))) continue;
          if (hitAny(cq, fl * (px + 0.5 - ox) / sc, (py + 0.5 - oy) / sc, sc)) dl[k] += q.d;
        }
    }
    // ambient occlusion lines: a pixel next to a nearer part of another group darkens
    const aoR = Math.max(1, Math.round(o.scale * o.ssaa * 0.6));
    for (let y = oY0; y <= oY1; y++) {
      if (S && (y & 7) === 0 && S.clk()) yield;
      for (let x = oX0; x <= oX1; x++) {
      const k = y * W + x, pi = pid[k]; if (pi < 0) continue;
      occl[k] = 0;
      if (!AOK[pi]) continue;
      const g = G[pi], zk = zb[k] + 0.3;
      let hitN = 0;
      for (let d = 1; d <= aoR && !hitN; d++) {
        let kk, qi;
        if (x + d < W) { kk = k + d; qi = pid[kk]; if (qi >= 0 && G[qi] !== g && zb[kk] > zk && !NOAO[qi]) { hitN = 1; break; } }
        if (x - d >= 0) { kk = k - d; qi = pid[kk]; if (qi >= 0 && G[qi] !== g && zb[kk] > zk && !NOAO[qi]) { hitN = 1; break; } }
        if (y + d < H) { kk = k + d * W; qi = pid[kk]; if (qi >= 0 && G[qi] !== g && zb[kk] > zk && !NOAO[qi]) { hitN = 1; break; } }
        if (y - d >= 0) { kk = k - d * W; qi = pid[kk]; if (qi >= 0 && G[qi] !== g && zb[kk] > zk && !NOAO[qi]) { hitN = 1; break; } }
      }
      occl[k] = hitN;
    }
    }
    const key = norm3(L.key), rim = norm3(L.rim);
    const k0 = key[0], k1 = key[1], k2 = key[2], rm0 = rim[0], rm1 = rim[1];
    const mul0 = L.mul[0], mul1 = L.mul[1], mul2 = L.mul[2], rimK = L.rimK, pts = L.pts, npl = pts.length, wk = o.wk || 1;
    const sat = o.sat, tint = o.tint, tones = o.tones;
    if (S && S.clk()) yield;
    const cv = mk(W, H);
    const cx = cv.getContext('2d'), img = cx.createImageData(W, H), D = img.data;
    for (let y = oY0; y <= oY1; y++) {
      if (S && (y & 7) === 0 && S.clk()) yield;
      for (let x = oX0; x <= oX1; x++) {
      const k = y * W + x, pi = pid[k];
      if (pi < 0) continue;
      const p = prims[pi], m = p.m, n0 = nxb[k], n1 = nyb[k], n2 = nzb[k];
      let c0, c1, c2;
      const RP = m.r, nn = RP.length;
      if (m.flat) { const cc = RP[clamp(Math.round((p.shade != null ? p.shade : nn - 1) + dl[k]), 0, nn - 1)]; c0 = cc[0]; c1 = cc[1]; c2 = cc[2]; }
      else {
        let lam = (n0 * k0 + n1 * k1 + n2 * k2 + m.wrap) / (1 + m.wrap);
        lam = clamp(lam, 0, 1);
        let lv = m.amb + (1 - m.amb) * lam;
        if (m.metal) { // environment-ish banding for metal: sky above, ground below, dark horizon band
          const e = -n1 * 0.5 + 0.5; lv = clamp(lv * 0.65 + (e > 0.62 ? 0.45 : e < 0.38 ? 0.08 : -0.12), 0, 1);
        }
        let idx = lv * (nn - 1) + dl[k] - occl[k] * (m.ao) + (p.shadeOff || 0);
        if (m.tex) idx += (vnoise(tub[k] * m.tsx, tvb[k] * m.tsy, (p.g * 7919) % 1000) - 0.5) * m.tex;
        if (m.spec) {
          const d = 2 * (n0 * k0 + n1 * k1 + n2 * k2);
          const rz = d * n2 - k2; const s = Math.pow(Math.max(0, rz), m.specPow);
          if (s > 0.55) idx += m.spec * 3;
        }
        if (m.sheen) { if (n1 > m.sheen[0] && n1 < m.sheen[1] && lam > 0.25) idx += 1.6; }
        if (tones && nn > tones) { const st = (nn - 1) / (tones - 1); idx = Math.round(clamp(idx, 0, nn - 1) / st) * st; }
        idx = clamp(Math.round(idx), 0, nn - 1);
        const cc = RP[idx]; c0 = cc[0]; c1 = cc[1]; c2 = cc[2];
        if (m.spec && idx === nn - 1 && m.spec > 0.8) { c0 = c0 + (255 - c0) * 0.5; c1 = c1 + (255 - c1) * 0.5; c2 = c2 + (250 - c2) * 0.5; }
        // rim light from behind
        const rd = n0 * rm0 + n1 * rm1;
        const rt = rd > 0 && !occl[k] ? Math.pow(1 - clamp(n2, 0, 1), 1.5) * rd * rimK : 0;
        if (rt > 0.32) { const rc = L.rimC || m.rimC, tt = m.rimK * (rt > 0.55 ? 1 : 0.6); c0 = c0 + (rc[0] - c0) * tt; c1 = c1 + (rc[1] - c1) * tt; c2 = c2 + (rc[2] - c2) * tt; }
      }
      if (sat != null && !m.glow) {
        const lu = c0 * 0.3 + c1 * 0.59 + c2 * 0.11, s = sat; c0 = lu + (c0 - lu) * s; c1 = lu + (c1 - lu) * s; c2 = lu + (c2 - lu) * s;
        if (tint) { const w = lu / 255; c0 = c0 + tint[0] * (1 - w) + tint[3] * w; c1 = c1 + tint[1] * (1 - w) + tint[4] * w; c2 = c2 + tint[2] * (1 - w) + tint[5] * w; }
      }
      let r = c0 * mul0, g = c1 * mul1, b = c2 * mul2;
      if (m.glow) { r = Math.max(r, c0); g = Math.max(g, c1); b = Math.max(b, c2); }
      // point lights (world space): model px → world
      if (npl && !m.glow) {
        const alb = RP[Math.floor(nn * 0.6)];
        const mx = (x - ox) / sc, my = (y - oy) / sc;
        for (let li = 0; li < npl; li++) {
          const pl = pts[li];
          let dx = pl.x - (o.wx + mx * wk), dy = pl.y - (o.wy + my * wk), dz = pl.z || 20;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dist > pl.r) continue;
          dx /= dist; dy /= dist; dz /= dist;
          let a = 1 - dist / pl.r; a = a * a;
          let ld = clamp((n0 * dx + n1 * dy + n2 * dz + 0.2) / 1.2, 0, 1);
          ld = Math.round(ld * 4) / 4; // keep it banded
          const f = a * ld * pl.i;
          r += alb[0] * pl.c[0] * f; g += alb[1] * pl.c[1] * f; b += alb[2] * pl.c[2] * f;
        }
      }
      const q = k * 4; D[q] = clamp(r, 0, 255); D[q + 1] = clamp(g, 0, 255); D[q + 2] = clamp(b, 0, 255); if (D[q] + D[q + 1] + D[q + 2] < 3) { D[q] = 7; D[q + 1] = 8; D[q + 2] = 18; } D[q + 3] = m.alpha != null ? m.alpha * 255 : 255;
    }
    }
    // outline（縁の画素は不透明な画素を読むだけで、不透明な画素は書き換えないので写しは要らない）
    if (o.outline && oX1 >= 0) {
      const ow = o.ssaa, sm0 = mul0 ** 0.5, sm1 = mul1 ** 0.5, sm2 = mul2 ** 0.5, olMix = o.olMix;
      const ya = Math.max(0, oY0 - ow), yb = Math.min(H - 1, oY1 + ow), xa = Math.max(0, oX0 - ow), xb = Math.min(W - 1, oX1 + ow);
      for (let y = ya; y <= yb; y++) {
        if (S && (y & 7) === 0 && S.clk()) yield;
        for (let x = xa; x <= xb; x++) {
        const k = y * W + x; if (pid[k] >= 0) continue;
        let best = -1, bz = -1e9;
        if (ow === 1) {   // よくある場合（上・左・右・下の順は下の一般の式と同じ）
          let kk;
          if (y > 0) { kk = k - W; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; } }
          if (x > 0) { kk = k - 1; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; } }
          if (x < W - 1) { kk = k + 1; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; } }
          if (y < H - 1) { kk = k + W; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; } }
        } else for (let dy = -ow; dy <= ow; dy++) for (let dx = -ow; dx <= ow; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > ow) continue;
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const kk = yy * W + xx; if (pid[kk] >= 0 && zb[kk] > bz) { bz = zb[kk]; best = kk; }
        }
        if (best < 0) continue; const p = prims[pid[best]]; if (p.m.noOutline) continue;
        const ol = p.m.ol; let c0 = ol[0], c1 = ol[1], c2 = ol[2];
        // lit side outline is a deeper version of the local colour (softer), shadow side dark
        const lit = (x - best % W) * k0 + (y - Math.floor(best / W)) * k1 > 0;
        const s0 = D[best * 4], s1 = D[best * 4 + 1], s2 = D[best * 4 + 2];
        if (olMix != null) { const t = olMix + (lit ? -0.2 : 0), a0 = ol[0] * 0.5, a1 = ol[1] * 0.4, a2 = ol[2] * 0.5; c0 = s0 + (a0 - s0) * t; c1 = s1 + (a1 - s1) * t; c2 = s2 + (a2 - s2) * t; }
        else if (lit) { c0 = c0 + (s0 - c0) * 0.35; c1 = c1 + (s1 - c1) * 0.35; c2 = c2 + (s2 - c2) * 0.35; }
        const q = k * 4; D[q] = c0 * sm0; D[q + 1] = c1 * sm1; D[q + 2] = c2 * sm2; D[q + 3] = 255; if (D[q] + D[q + 1] + D[q + 2] < 3) { D[q] = 7; D[q + 1] = 8; D[q + 2] = 18; }
        }
      }
    }
    if (S && S.clk()) yield;
    cx.putImageData(img, 0, 0);
    if (o.ssaa > 1) {
      const c2 = mk(Math.ceil(W / o.ssaa), Math.ceil(H / o.ssaa));
      const x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = true; x2.imageSmoothingQuality = 'high';
      // downsample in halves for quality
      let cur = cv, cw = W, ch = H, f = o.ssaa;
      while (f > 1) { const n = mk(Math.ceil(cw / 2), Math.ceil(ch / 2)); const nx = n.getContext('2d'); nx.imageSmoothingEnabled = true; nx.drawImage(cur, 0, 0, n.width, n.height); cur = n; cw = n.width; ch = n.height; f /= 2; }
      x2.drawImage(cur, 0, 0, c2.width, c2.height);
      return { canvas: c2, ox: ox / o.ssaa, oy: oy / o.ssaa };
    }
    return { canvas: cv, ox, oy };
    } finally { release(buf); }
  }
  function h2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  // deterministic RNG
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // deterministic RNG（数の種）。文字の種は seed(str) で数にする（同じキーなら同じ画素、§2.1）
  function seed(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h || 1; }
  /** render の結果 {canvas, ox, oy} → Sheet のコマ {c, ox, oy}（ox, oy は整数に丸める） */
  function frame(r, anchors) { const f = { c: r.canvas, ox: Math.round(r.ox), oy: Math.round(r.oy) }; if (anchors) f.anchors = anchors; return f; }

  Hd.RZ = { Builder, render, job, gen: renderGen, mat, ramp, hex, mix, clamp, rng, vnoise, seed, frame, canvas: mk, norm3 };
})(window.RPG);
