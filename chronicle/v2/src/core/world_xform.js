// CORE: ワールドの座標の変換（WORLD v3、2026-09-28。scratchpad の worldv3/DESIGN.md §1）
// 地方の生成器（tools/gen_world*.js）は古い 224×192 の「論理の座標 L」で描き、tools/world_scale.js が K 倍の「ワールドの座標 W」にする。
// 町・門・閉じ方などの塊（core）は平行移動だけ（中の並びはマスのまま）、その外は K 倍、あいだの帯は放射状に滑らかにつなぐ。
//   core i: 錨 a（整数）、L の枠 [x0..x1]×[y0..y1]、帯の幅 tau（core の大きさの何倍か）。v = w − K·a、ρ = max(vx/hx±, vy/hy±)（core の縁で 1）
//   G(w) = a + v·f(ρ)/ρ、f(ρ) = ρ（ρ ≤ 1: 平行移動）、1 + (ρ − 1)·s（帯）、ρ/K（ρ ≥ 1 + tau: K 倍）、s = ((1 + tau)/K − 1)/tau
//   帯どうしは重ならない（tools/world_scale.js が tau を決める）ので、折り返さず、逆も閉じた式。帯の外の 2 点の間は必ず K 倍。
//   小さな塊（野営地の入口・階段と spawn だけ…）は帯を作らず「島」: L の枠 [x0..x1]×[y0..y1] を整数 (dx, dy) だけ動かすだけ（islands）。
//
//   R.WorldXform.of(map)                → xf | null（map.meta.xform = {K, cores:[[x0,y0,x1,y1,ax,ay,tau]…], islands:[[x0,y0,x1,y1,dx,dy]…]}。無ければ null = そのまま）
//   R.WorldXform.toL(xf|map, wx, wy)    → [lx, ly]  W の点 → L の点（連続。マスの中心は +0.5）
//   R.WorldXform.toW(xf|map, lx, ly)    → [wx, wy]  L の点 → W の点
//   R.WorldXform.cell(xf|map, lx, ly)   → [x, y]    L のマス → W のマス（マスの中心どうし）
//   R.WorldXform.lcell(xf|map, x, y)    → [lx, ly]  W のマス → L のマス
//   R.WorldXform.band(xf|map, wx, wy)   → {i, t}    どの core の帯か（i = −1 は帯の外）、t = 0（core の中）〜 1（帯の外の縁）
// node の道具からは require('.../src/core/world_xform.js') でも使える（同じ関数）。
(function (root) {
  'use strict';
  function make(x) {
    if (!x || !(x.K > 1)) return null;
    if (x._c) return x;
    const K = x.K, c = [];
    for (const q of x.cores || []) {
      const [x0, y0, x1, y1, ax, ay, tau] = q;
      const hx0 = ax - x0, hx1 = x1 + 1 - ax, hy0 = ay - y0, hy1 = y1 + 1 - ay, T = 1 + tau;
      c.push({ ax, ay, hx0, hx1, hy0, hy1, tau, T, s: (T / K - 1) / tau,
        // 帯の外の縁（W と L）
        W: [K * ax - T * hx0, K * ay - T * hy0, K * ax + T * hx1, K * ay + T * hy1],
        L: [ax - (T / K) * hx0, ay - (T / K) * hy0, ax + (T / K) * hx1, ay + (T / K) * hy1] });
    }
    const is = (x.islands || []).map(([x0, y0, x1, y1, dx, dy]) => ({ x0, y0, x1: x1 + 1, y1: y1 + 1, dx, dy }));
    Object.defineProperty(x, '_c', { value: c, enumerable: false });
    Object.defineProperty(x, '_i', { value: is, enumerable: false });
    return x;
  }
  function of(m) {
    if (!m) return null;
    if (m.K) return make(m);
    return make(m.meta && m.meta.xform);
  }
  const rho = (c, vx, vy) => Math.max(vx >= 0 ? vx / c.hx1 : -vx / c.hx0, vy >= 0 ? vy / c.hy1 : -vy / c.hy0);
  function findW(xf, wx, wy) {
    const cs = xf._c;
    for (let i = 0; i < cs.length; i++) { const b = cs[i].W; if (wx > b[0] && wx < b[2] && wy > b[1] && wy < b[3]) return i; }
    return -1;
  }
  function findL(xf, lx, ly) {
    const cs = xf._c;
    for (let i = 0; i < cs.length; i++) { const b = cs[i].L; if (lx > b[0] && lx < b[2] && ly > b[1] && ly < b[3]) return i; }
    return -1;
  }
  /** W → L */
  function toL(xf, wx, wy) {
    xf = of(xf);
    if (!xf) return [wx, wy];
    for (const q of xf._i) if (wx >= q.x0 + q.dx && wx < q.x1 + q.dx && wy >= q.y0 + q.dy && wy < q.y1 + q.dy) return [wx - q.dx, wy - q.dy];
    const K = xf.K, i = findW(xf, wx, wy);
    if (i < 0) return [wx / K, wy / K];
    const c = xf._c[i], vx = wx - K * c.ax, vy = wy - K * c.ay, r = rho(c, vx, vy);
    if (r <= 1) return [wx - (K - 1) * c.ax, wy - (K - 1) * c.ay];
    const f = r >= c.T ? r / K : 1 + (r - 1) * c.s;
    return [c.ax + (vx * f) / r, c.ay + (vy * f) / r];
  }
  /** L → W（toL の逆） */
  function toW(xf, lx, ly) {
    xf = of(xf);
    if (!xf) return [lx, ly];
    for (const q of xf._i) if (lx >= q.x0 && lx < q.x1 && ly >= q.y0 && ly < q.y1) return [lx + q.dx, ly + q.dy];
    const K = xf.K, i = findL(xf, lx, ly);
    if (i < 0) return [lx * K, ly * K];
    const c = xf._c[i], ux = lx - c.ax, uy = ly - c.ay, q = rho(c, ux, uy);
    if (q <= 1) return [lx + (K - 1) * c.ax, ly + (K - 1) * c.ay];
    const r = q >= c.T / K ? q * K : 1 + (q - 1) / c.s;
    return [K * c.ax + (ux * r) / q, K * c.ay + (uy * r) / q];
  }
  function band(xf, wx, wy) {
    xf = of(xf);
    if (!xf) return { i: -1, t: 1 };
    for (let k = 0; k < xf._i.length; k++) { const q = xf._i[k]; if (wx >= q.x0 + q.dx && wx < q.x1 + q.dx && wy >= q.y0 + q.dy && wy < q.y1 + q.dy) return { i: -2 - k, t: 0 }; }
    const i = findW(xf, wx, wy);
    if (i < 0) return { i: -1, t: 1 };
    const c = xf._c[i], r = rho(c, wx - xf.K * c.ax, wy - xf.K * c.ay);
    return { i, t: r <= 1 ? 0 : Math.min(1, (r - 1) / c.tau) };
  }
  const cell = (xf, lx, ly) => { const p = toW(xf, lx + 0.5, ly + 0.5); return [Math.floor(p[0]), Math.floor(p[1])]; };
  const lcell = (xf, x, y) => { const p = toL(xf, x + 0.5, y + 0.5); return [Math.floor(p[0]), Math.floor(p[1])]; };
  const api = { of, make, toL, toW, cell, lcell, band };
  if (root && root.RPG) root.RPG.WorldXform = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
