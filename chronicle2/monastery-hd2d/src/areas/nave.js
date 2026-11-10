// The roofless abbey church: south portal, nave between two arcades, raised chancel under the great north window.
// Plan: walls on x = -10 / 10, z = -57 (north) / -29.6 (south), 1.2 thick; floor y 0.6; chancel y 1.2 north of z -51.5 (one tread at 0.9).
// South door x 0 (step y 0.3 outside), west door z -40 (step y 0.3 outside). Columns x +-4.2, z -33..-49; the one transverse arch at z -41.
// Lights: 2 (altar candles, cream under the glass). A camZone in the chancel tilts the camera up to the window.
// Local helpers (not in the kit): ragged/ensure/limit (authored broken tops), crown (core lumps and loose stones on wall heads), archAt/ring
// (whole or broken arch bands), arcadeWall (wall with arches cut in its foot), foil (cusped openings), statue, heap, pew.
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.nave = function (ctx) {
  const K = ctx.K, M = ctx.M, T = ctx.T, P = ctx.P, hash2 = HD.hash2, fbm = HD.fbm, PI = Math.PI;
  const B = ctx.batch(), B2 = ctx.batch();          // B: everything solid; B2: thin things that cast no shadow (cloth, flames)
  const FL = 0.6, CH = 1.2, tint = K.tint, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const S = (m, ...g) => B.add(m, ...g);

  // ------------------------------------------------------------------------------------------------ local helpers
  const lerpPts = pts => u => { if (u <= pts[0][0]) return pts[0][1]; for (let i = 0; i < pts.length - 1; i++) if (u <= pts[i + 1][0]) { const a = pts[i], b = pts[i + 1]; return a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0] || 1); } return pts[pts.length - 1][1]; };
  // ragged(u0, u1, f, seed, {amp, course, min, block}): a wall top broken down block by block, following the height curve f (function or [[u,h]..])
  function ragged(u0, u1, f, seed, o) { o = o || {}; const r = HD.rng(seed), course = o.course || 0.5, amp = o.amp === undefined ? 0.5 : o.amp, min = o.min === undefined ? 0.5 : o.min, pts = []; let u = u0;
    if (typeof f !== 'function') f = lerpPts(f);
    while (u < u1 - 1e-6) { let bl = r.range(0.55, 1.3) * (o.block || 1); if (u1 - u - bl < 0.45) bl = u1 - u; const um = u + bl / 2; let h = f(um) + (r() - 0.5) * 2 * amp; h = Math.max(min, Math.round(h / course) * course); pts.push([u, h], [u + bl, h]); u += bl; }
    pts[pts.length - 1][0] = u1; return pts; }
  const ensure = (top, ua, ub, h) => { for (let i = 0; i < top.length - 1; i += 2) if (top[i + 1][0] > ua && top[i][0] < ub && top[i][1] < h) top[i][1] = top[i + 1][1] = h; return top; };
  const limit = (top, ua, ub, h) => { for (let i = 0; i < top.length - 1; i += 2) if (top[i + 1][0] > ua && top[i][0] < ub && top[i][1] > h) top[i][1] = top[i + 1][1] = h; return top; };
  // point on a two-centred arch: s 0 = left springing, 0.5 = apex, 1 = right springing; off grows the curve outward
  const archAt = (cx, spring, w, rise, off, s) => { const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw, R2 = R + off, a1 = Math.acos(Math.min(1, c / R2));
    if (s <= 0.5) { const a = a1 * s * 2; return [cx + c - Math.cos(a) * R2, spring + Math.sin(a) * R2]; }
    const a = a1 * (1 - s) * 2; return [cx - c + Math.cos(a) * R2, spring + Math.sin(a) * R2]; };
  // ring(W, cx, spring, w, rise, {off0, off1, depth, at, s0, s1, j0, j1, n}): a voussoir band along an arch, whole or a broken stub (s0..s1), in wall coordinates
  function ring(W, cx, spring, w, rise, o) { o = o || {}; const n = o.n || 14, s0 = o.s0 || 0, s1 = o.s1 === undefined ? 1 : o.s1, j0 = o.j0 || 0, j1 = o.j1 || 0, off0 = o.off0 || 0, off1 = o.off1 === undefined ? 0.3 : o.off1, depth = o.depth || 0.3;
    const ss = (a, b) => { const out = []; for (let i = 0; i <= n; i++) out.push(clamp(a + (b - a) * i / n, 0, 1)); if (a < 0.5 && b > 0.5) out.push(0.5); out.sort((p, q) => p - q); return out.filter((v, i, arr) => i === 0 || v - arr[i - 1] > 1e-5); };
    const outer = ss(s0 - j0, s1 + j1).map(s => archAt(cx, spring, w, rise, off1, s)), inner = ss(s0 + j0, s1 - j1).map(s => archAt(cx, spring, w, rise, off0, s)).reverse();
    const g = K.extrude(outer.concat(inner), depth); g.translate(0, 0, o.at === undefined ? -depth / 2 : o.at); return W.put(g); }
  // a wall whose bottom edge is cut by arches springing from v = 0 (an arcade standing on capitals)
  function arcadeWall(W, u0, u1, arches, top, t, holes) { const pts = [[u0, 0]]; for (const a of arches) for (let i = 0; i <= 12; i++) pts.push(archAt(a.cx, 0, a.w, a.rise, 0, i / 12)); pts.push([u1, 0]);
    for (let i = top.length - 1; i >= 0; i--) pts.push(top[i]); const g = K.extrude(pts, t, holes); g.translate(0, 0, -t / 2); return W.put(g); }
  // crown(W, top, seed, {t, p, skip}): what is left on a broken wall head: lumps of the rubble core standing above the facing, and loose blocks
  function crown(W, top, seed, o) { o = o || {}; const r = HD.rng(seed), t = o.t || 0.66, skip = o.skip || [];
    for (let i = 0; i < top.length - 1; i += 2) { const ua = top[i][0], ub = top[i + 1][0], h = top[i][1], um = (ua + ub) / 2; if (ub - ua < 0.5 || skip.some(k => um > k[0] && um < k[1])) { r(); r(); continue; }
      const q = r(); if (q < (o.p || 0.5)) { const a = ua + r.range(0.02, 0.2), b = ub - r.range(0.02, 0.2), hh = r() < 0.35 ? 0.5 : 0.26; S(M.rubble, tint(K.wobble(W.box(a, b, h - 0.2, h + hh, -t / 2 + r.range(-0.08, 0.08), t / 2 + r.range(-0.08, 0.08)), 0.03, i + seed), r.range(0.85, 1.0))); }
      else if (q < (o.p || 0.5) + 0.2) { const c = W.pt(r.range(ua + 0.2, ub - 0.2), h + (W.y0 ? 0 : 0), r.range(-0.3, 0.3)); S(M.stone, K.chunk({ x: c.x, y: c.y, z: c.z, w: r.range(0.4, 0.7), h: r.range(0.22, 0.34), d: r.range(0.3, 0.5), seed: i + seed })); } } }
  const circle = (cx, cy, r, n) => { const a = []; for (let i = 0; i < n; i++) { const t = i / n * 2 * PI; a.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); } return a; };
  const foil = (cx, cy, r, k, depth, rot) => { const a = [], n = k * 8; for (let i = 0; i < n; i++) { const t = i / n * 2 * PI, rr = r * (1 - depth + depth * Math.sqrt(Math.abs(Math.cos(k * (t - rot) / 2)))); a.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); } return a; };
  const capital = r => K.merge([K.lathe([[r * 0.93, 0], [r * 1.1, 0.05], [r * 1.1, 0.13], [r * 0.96, 0.17], [r * 1.05, 0.34], [r * 1.5, 0.62], [r * 1.56, 0.66]], 10), K.boxc(0, 0.66, 0, r * 3.3, 0.29, r * 3.3)]);
  const beam = (x, y, z, len, o) => K.xform(tint(K.box(-len / 2, -0.15, -0.13, len / 2, 0.15, 0.13), o.t || 1), { x, y, z, ry: o.ry || 0, rz: o.rz || 0, rx: o.rx || 0 });
  // a robed figure for a niche, facing south; h about 2.4
  function statue(x, y, z, o) { o = o || {}; const gs = [K.lathe([[0.4, 0], [0.4, 0.1], [0.34, 0.14], [0.3, 0.9], [0.25, 1.45], [0.3, 1.72], [0.27, 1.86], [0.12, 1.98], [0.1, 2.04]], 8)];
    gs.push(K.xform(K.box(-0.33, 1.3, 0.0, -0.17, 1.8, 0.2), { rz: -0.12 }), K.xform(K.box(0.17, 1.3, 0.0, 0.33, 1.8, 0.2), { rz: 0.12 }), K.box(-0.2, 1.22, 0.14, 0.2, 1.42, 0.32));      // sleeves, hands joined
    if (!o.headless) { const hd = new THREE.IcosahedronGeometry(0.19, 1); hd.translate(0, 2.2, 0.02); gs.push(hd, K.lathe([[0.1, 1.98], [0.24, 2.06], [0.26, 2.24], [0.2, 2.4], [0, 2.46]], 8)); }
    return K.xform(K.merge(gs), { x, y, z, sz: 0.72, s: 1, sx: 1, sy: o.h ? o.h / 2.46 : 1, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 }); }
  const flameGeo = (x, y, z, s) => K.lathe([[0, 0], [0.055 * s, 0.05 * s], [0.07 * s, 0.12 * s], [0.04 * s, 0.24 * s], [0, 0.36 * s]], 6, { x, y, z });
  function candlestick(x, y, z, h, lit) { S(M.bronze, tint(K.lathe([[0.3, 0], [0.3, 0.06], [0.2, 0.12], [0.07, 0.22], [0.05, h * 0.34], [0.11, h * 0.37], [0.11, h * 0.41], [0.05, h * 0.44], [0.045, h * 0.86], [0.1, h * 0.9], [0.2, h * 0.97], [0.21, h], [0, h]], 8, { x, y, z }), 0.66, 0.62, 0.66));
    S(M.sand, tint(K.lathe([[0.06, 0], [0.06, 0.42], [0.02, 0.45], [0, 0.45]], 6, { x, y: y + h, z }), 1.12));
    if (lit) { B2.add(M.flame, flameGeo(x, y + h + 0.45, z, 1)); ctx.glow({ x, y: y + h + 0.62, z: z + 0.05, color: '#ffc070', size: 1.9, strength: 1.05 }); } }

  // ------------------------------------------------------------------------------------- floor, plinth and steps
  S(M.stoneDark, K.box(-10.6, -0.7, -57.6, 10.6, 0.3, -29.0));                                                     // the platform under everything
  S(M.earth, tint(K.box(-9.5, 0.3, -56.5, 9.5, 0.535, -30.1), 0.9));                                               // bedding earth: shows where pavers are lost
  const TS = 0.75, BURN = [2.75, -40.9];
  const lost = (i, j) => { const x = (i + 0.5) * TS, z = (j + 0.5) * TS; if (Math.abs(x) < 2.25) return hash2(i, j, 71) < 0.03 && Math.abs(x) > 1.4;
    const edge = Math.min((9.4 - x) * 0.75, (x + 9.4) * 1.2, (-30.2 - z) * 1.1), corner = Math.min(Math.hypot(x - 9, z + 31.2), Math.hypot(x + 9, z + 31.2) * 1.5, Math.hypot(x - 8.6, (z + 50.5) * 0.7));
    return fbm(x * 0.34 + 3.1, z * 0.34, 77, 3) + Math.max(0, 1.8 - edge) * 0.18 + Math.max(0, 3.6 - corner) * 0.07 > 0.69; };
  const lifted = (i, j) => hash2(i, j, 83) < 0.035 && Math.abs((i + 0.5) * TS) > 1.3;
  for (let j = -68; j <= -41; j++) { const za = Math.max(-50.9, j * TS), zb = Math.min(-30.1, (j + 1) * TS); let run = null;
    const flush = () => { if (run) { S(run.m, tint(K.box(run.x0, 0.5, za, run.x1, FL, zb), run.t)); run = null; } };
    for (let i = -13; i <= 12; i++) { const xa = Math.max(-9.5, i * TS), xb = Math.min(9.5, (i + 1) * TS), cx = (i + 0.5) * TS, cz = (j + 0.5) * TS;
      if (lost(i, j)) { flush(); continue; }
      const m = Math.abs(cx) < 2.25 ? M.paverChecker : M.paver, bd = Math.hypot(cx - BURN[0], cz - BURN[1]), t = bd < 1.5 ? 0.42 : bd < 2.3 ? 0.7 : 1;
      if (lifted(i, j)) { flush(); const r = HD.rng(i * 131 + j * 17 + 5); S(m, tint(K.xform(K.box(-TS / 2 + 0.015, -0.05, -TS / 2 + 0.015, TS / 2 - 0.015, 0.05, TS / 2 - 0.015), { x: cx, y: 0.575 + r.range(0, 0.05), z: cz, rx: r.range(-0.11, 0.11), rz: r.range(-0.11, 0.11), ry: r.range(-0.05, 0.05) }), t * 1.06)); continue; }
      if (run && (run.m !== m || run.t !== t)) flush();
      if (!run) run = { m, t, x0: xa, x1: xb }; else run.x1 = xb; }
    flush(); }
  // chancel: two risers of 0.3
  S(M.flag, K.box(-9.5, 0.3, -51.5, 9.5, 0.9, -50.9), K.box(-9.5, 0.3, -56.5, 9.5, CH, -51.5));
  for (const sx of [-1, 1]) S(M.sand, tint(K.box(sx * 1.04, 0.83, -50.95, sx * 9.45, 0.915, -50.84), 0.92), tint(K.box(sx * 1.04, 1.13, -51.55, sx * 9.45, 1.215, -51.44), 0.92));     // nosings
  S(M.sand, tint(K.box(-2.6, CH, -56.45, 2.6, 1.35, -54.0), 0.8), tint(K.box(-2.68, 1.27, -54.06, 2.68, 1.36, -53.96), 0.95));                                                    // footpace under the altar
  S(M.sand, tint(K.box(4.5, 1.15, -54.7, 5.9, 1.228, -52.3), 0.66)); S(M.stoneDark, tint(K.box(5.16, 1.2, -54.4, 5.24, 1.236, -52.6), 0.5), tint(K.box(4.85, 1.2, -54.0, 5.55, 1.236, -53.92), 0.5));   // a ledger stone with an incised cross
  ctx.floor(-9.4, -56.4, 9.4, -30.2, FL);
  ctx.floor(-9.4, -51.5, 9.4, -50.9, 0.9); ctx.floor(-9.4, -56.4, 9.4, -51.5, CH); ctx.floor(-2.6, -56.4, 2.6, -54.0, 1.35);
  { const led = (x, z, w, d, ry, sd) => { const g = [tint(K.box(-w / 2, 0, -d / 2, w / 2, 0.06, d / 2), 0.7)], c = [K.box(-0.04, 0.05, -d * 0.36, 0.04, 0.068, d * 0.36), K.box(-w * 0.28, 0.05, -d * 0.2, w * 0.28, 0.068, -d * 0.2 + 0.08)];
      S(M.sand, K.xform(K.merge(g), { x, y: FL - 0.035 + (sd ? 0.02 : 0), z, ry, rz: sd ? 0.03 : 0 })); S(M.stoneDark, tint(K.xform(K.merge(c), { x, y: FL - 0.035 + (sd ? 0.02 : 0), z, ry, rz: sd ? 0.03 : 0 }), 0.5)); };
    led(-7.1, -36.2, 1.3, 2.5, 0.02, 0); led(7.2, -34.6, 1.2, 2.3, -0.04, 1); led(-6.4, -47.6, 1.2, 2.3, 0.03, 1); }                                   // ledger stones let into the aisle floors
  // south door: threshold in the wall, one step down to the path
  S(M.sand, tint(K.box(-1.3, 0.2, -30.25, 1.3, FL, -28.98), 0.74), tint(K.wobble(K.box(-1.6, -0.5, -29.0, 1.6, 0.3, -28.3), 0.015, 4), 0.8));
  ctx.floor(-1.3, -30.2, 1.3, -29.0, FL); ctx.floor(-1.6, -29.0, 1.6, -28.3, 0.3);
  // west door to the cloister
  S(M.sand, tint(K.box(-10.62, 0.2, -41, -9.38, FL, -39), 0.74), tint(K.wobble(K.box(-11.4, -0.5, -41.2, -10.6, 0.3, -38.8), 0.015, 5), 0.8));
  ctx.floor(-10.6, -41, -9.4, -39, FL); ctx.floor(-11.4, -41.2, -10.6, -38.8, 0.3);

  // -------------------------------------------------------------------------------------------------- north wall
  const WN = K.wall([-10, -57], [10, -57], 0);
  const GW = { cx: 10, w: 5.5, sill: 4.7, spring: 9.4, rise: 4.6 }; GW.top = GW.spring + K.archTop(GW.w, GW.rise);
  const LCX = [-2.0175, -0.6725, 0.6725, 2.0175], LT = { w: 1.185, sill: 4.84, spring: 9.2, rise: 1.0 };
  const topNE = ragged(9.4, 20, [[9.4, 16.8], [11, 16.4], [13, 15.3], [14, 13.5], [15.5, 11.4], [17.4, 9.6], [18.6, 8.2], [20, 7.2]], 301, { amp: 0.35 });
  ensure(topNE, 9.4, 13.3, 15.2); ensure(topNE, 15.6, 17.6, 9.8);
  const topN = [[0, 13.2], [9.4, 17.9]].concat(topNE);
  const dadoX = [-7.95, -5.85, -2.85, -0.95, 0.95, 2.85, 5.85, 7.95], nicheU = [3.4, 16.6];
  { const holes = [K.arch(GW.cx, GW.sill, GW.w, GW.spring, GW.rise, 0, 12)];
    for (const x of dadoX) holes.push(K.arch(x + 10, 1.85, 1.4, 3.15, 0.85, 0, 5));
    for (const u of nicheU) holes.push(K.arch(u, 5.3, 1.5, 7.7, 1.0, 0, 6));
    S(M.stone, WN.solid({ t: 1.2, v0: -0.5, top: topN, holes })); crown(WN, topNE, 302, { p: 0.45 });
    { const cp = K.extrude([[-0.45, 12.98], [9.42, 17.92], [9.42, 18.2], [8.9, 18.2], [8.9, 17.94], [-0.45, 13.26]], 1.56); cp.translate(0, 0, -0.78); S(M.sand, tint(WN.put(cp), 0.95), WN.box(-0.5, 0.5, 12.5, 13.0, -0.8, 0.8)); }
    S(M.stoneDark, tint(WN.box(0.7, 19.3, 1.5, 4.2, 0.18, 0.3), 0.8)); for (const u of nicheU) S(M.stoneDark, tint(WN.box(u - 0.9, u + 0.9, 5.2, 8.9, -0.1, 0.02), 0.6));       // backs of the recesses
    S(M.stoneDark, WN.box(0.6, 19.4, CH - 0.2, 1.82, 0.6, 0.84));                                                                                                          // stone bench round the chancel
    S(M.sand, WN.box(0.6, 19.4, 1.82, 1.9, 0.6, 0.88), WN.box(0.6, 19.4, 4.36, 4.56, 0.6, 0.76), WN.box(6.9, 13.1, 4.56, 4.72, 0.6, 0.84), WN.box(0.6, 6.9, 9.28, 9.44, 0.6, 0.7), WN.box(13.1, 16.2, 9.28, 9.44, 0.6, 0.7), WN.box(0.6, 5.0, 12.9, 13.06, 0.6, 0.72));
    for (const x of dadoX) S(M.sand, WN.archTrim(x + 10, 1.9, 1.4, 3.15, 0.85, { band: 0.12, depth: 0.1, at: 0.6 }));
    // the great window: hood, lining, tracery
    S(M.sand, WN.archTrim(GW.cx, GW.sill, GW.w, GW.spring, GW.rise, { band: 0.32, depth: 0.15, at: 0.6 }), tint(WN.archTrim(GW.cx, GW.sill, GW.w, GW.spring, GW.rise, { inset: -0.07, band: 0.07, depth: 0.5, at: 0.15 }), 0.86));
    const th = []; for (const lc of LCX) th.push(K.arch(GW.cx + lc, LT.sill, LT.w, LT.spring, LT.rise, 0, 6));
    th.push(foil(GW.cx - 1.345, 11.05, 0.52, 4, 0.2, PI / 2), foil(GW.cx + 1.345, 11.05, 0.52, 4, 0.2, PI / 2), foil(GW.cx, 12.3, 1.1, 6, 0.2, PI / 2), circle(GW.cx, 10.55, 0.28, 10), circle(GW.cx - 1.6, 12.1, 0.17, 8), circle(GW.cx + 1.6, 12.1, 0.17, 8));
    const tr = K.extrude(K.arch(GW.cx, GW.sill, GW.w, GW.spring, GW.rise, 0, 14), 0.3, th); tr.translate(0, 0, -0.15); S(M.sand, WN.put(tr));
    { const q = K.extrude(circle(9.2, 15.75, 0.62, 18), 0.12, [foil(9.2, 15.75, 0.46, 3, 0.34, PI / 2)]); q.translate(0, 0, 0.6); S(M.sand, WN.put(q)); S(M.stoneDark, tint(WN.box(8.72, 9.68, 15.27, 16.23, 0.6, 0.63), 0.45)); }     // a blind trefoil in the gable
    // statue niches either side: corbel, canopy, figure
    nicheU.forEach((u, k) => { S(M.sand, WN.box(u - 0.62, u + 0.62, 5.06, 5.3, 0.5, 0.98), tint(WN.box(u - 0.42, u + 0.42, 4.82, 5.06, 0.6, 0.82), 0.9), WN.archTrim(u, 5.3, 1.5, 7.7, 1.0, { band: 0.14, depth: 0.2, at: 0.6 }));
      const gab = K.extrude([[u - 0.98, 7.72], [u, 9.95], [u + 0.98, 7.72], [u + 0.8, 7.72], [u, 9.56], [u - 0.8, 7.72]], 0.22); gab.translate(0, 0, 0.6); S(M.sand, WN.put(gab), WN.box(u - 0.1, u + 0.1, 9.9, 10.3, 0.62, 0.82), WN.box(u - 0.2, u + 0.2, 10.08, 10.2, 0.62, 0.82));
      S(M.sand, tint(statue(u - 10, 5.3, -56.58, { headless: k === 1, h: 2.5 }), 0.94)); });
    // wall shafts in line with the arcades, and buttresses on the outer face
    for (const x of [-4.2, 4.2]) S(M.sand, K.column({ x, z: -56.3, y: 1.82, h: 7.6, r: 0.24, sides: 8 }));
    S(M.stone, WN.buttress(5.6, { width: 1.3, side: -1, face: 0.6, v0: -0.5, stages: [[1.7, 5], [1.2, 9], [0.6, 12]] }), WN.buttress(14.4, { width: 1.3, side: -1, face: 0.6, v0: -0.5, stages: [[1.7, 5], [1.2, 9], [0.6, 11.4]] }));
  }
  ctx.block.rect(-10.6, -57.6, 10.6, -56.2);

  // stained glass: leaded quarries, two robed figures, the white and the black moon; drawn texel by texel (32 per unit)
  const glassCanvas = (function () { const Wd = Math.round(GW.w * 32), Hd = Math.round((GW.top - GW.sill) * 32), c = document.createElement('canvas'); c.width = Wd; c.height = Hd; const g2 = c.getContext('2d'), im = g2.createImageData(Wd, Hd), d = im.data;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], ink = P.rgb(P.ink), G = P.glass.map(P.rgb);
    const C = { teal: mix(G[5], ink, 0.2), tealD: mix(G[5], ink, 0.5), blue: mix(G[6], ink, 0.28), blueD: mix(G[6], ink, 0.58), wine: mix(G[1], ink, 0.2), wineD: mix(G[0], ink, 0.12), amber: mix(G[3], ink, 0.16), amberD: mix(G[2], ink, 0.32),
      pale: mix(G[4], P.rgb(P.sand[7]), 0.5), paleD: mix(G[4], P.rgb(P.sand[5]), 0.7), violet: mix(G[7], ink, 0.55), gone: [16, 13, 30] };
    const hw = GW.w / 2, R = (hw * hw + GW.rise * GW.rise) / GW.w, cc = R - hw; let col = C.gone;
    const inMain = (x, y) => Math.abs(x) <= hw && (y <= GW.spring || (Math.abs(x) + cc) * (Math.abs(x) + cc) + (y - GW.spring) * (y - GW.spring) <= R * R);
    const set = (id, k) => { col = C[k]; return id; };
    const cell = (x, y) => { let r = Math.hypot(x, y - 12.3);
      if (r < 1.16) { const m1 = Math.hypot(x + 0.27, y - 12.4), m2 = Math.hypot(x - 0.25, y - 12.2);                 // the rose: two moons on deep blue
        if (m2 < 0.41) return m2 > 0.34 ? set(101, 'amber') : set(102, 'violet');
        if (m1 < 0.44) return set(fbm(x * 5, y * 5, 5, 2) > 0.6 ? 104 : 103, fbm(x * 5, y * 5, 5, 2) > 0.6 ? 'paleD' : 'pale');
        const k = Math.floor((Math.atan2(y - 12.3, x) / (2 * PI) + 1.0417) * 12) % 12; if (r > 0.9) return set(110 + k, k % 2 ? 'amberD' : 'wine');
        if (hash2(Math.floor(x * 9), Math.floor(y * 9), 9) < 0.07) return set(140 + Math.floor(x * 9) * 7 + Math.floor(y * 9), 'pale');
        return set(120 + (k >> 1) + (r > 0.62 ? 6 : 0), (k >> 1) % 2 ? 'blue' : 'blueD'); }
      for (const s of [-1, 1]) { r = Math.hypot(x - s * 1.345, y - 11.05); if (r < 0.58) { if (r < 0.17) return set(150, 'amber'); const k = Math.floor((Math.atan2(y - 11.05, x - s * 1.345) / (2 * PI) + 1.125) * 4) % 4; return set(151 + k + (s > 0 ? 4 : 0), k % 2 ? 'wine' : 'teal'); } }
      if (Math.hypot(x, y - 10.55) < 0.36) return set(160, 'amber'); if (Math.hypot(Math.abs(x) - 1.6, y - 12.1) < 0.26) return set(161, 'teal');
      if (y > 10.45) return set(170, 'blueD');
      const i = x < -1.345 ? 0 : x < 0 ? 1 : x < 1.345 ? 2 : 3, lx = x - LCX[i], base = 200 + i * 400;
      if (i === 3 && y < 7.1 && fbm(x * 2.1, y * 2.1, 31, 3) > 0.56) return set(9999, 'gone');                             // panes blown out
      if (i === 0 && y > 8.3 && fbm(x * 3.1, y * 3.1, 33, 3) > 0.63) return set(9999, 'gone');
      if (Math.abs(lx) > 0.49) { const k = Math.floor(y / 0.3); return set(base + (k & 63) + (lx > 0 ? 64 : 0), k % 3 === 0 ? 'wine' : k % 3 === 1 ? 'amber' : 'tealD'); }           // border of small panes
      if (y < 5.3) { const k = Math.floor((lx + 0.6) / 0.2); return set(base + 130 + k, k % 2 ? 'amberD' : 'wine'); }
      if (i === 1 || i === 2) { const hd = Math.hypot(lx, y - 8.42), robe = i === 1 ? 'pale' : 'wine', robeD = i === 1 ? 'paleD' : 'wineD', mantle = i === 1 ? 'tealD' : 'amberD';
        if (hd < 0.13) return set(base + 140, 'pale'); if (hd < 0.2 && y > 8.34) return set(base + 141, mantle); if (hd < 0.32) return set(base + 142, 'amber');
        if (y < 8.24 && y > 5.42) { const hb = y > 7.8 ? 0.3 - (y - 7.8) * 0.5 : 0.41 - (y - 5.42) * 0.046;
          if (Math.abs(lx) < hb) { if (y > 7.35) return set(base + 143 + (lx > 0 ? 1 : 0), mantle); if (Math.hypot(lx, y - 7.12) < 0.1) return set(base + 145, 'pale');
            if (i === 2 && Math.abs(lx) < 0.12 && y < 7.02 && y > 6.72) return set(base + 146, 'amber');
            const k = lx < -0.14 ? 0 : lx < 0.14 ? 1 : 2; return set(base + 147 + k, k === 1 ? robe : robeD); } }
        if (y <= 5.42) return set(base + 150, 'tealD'); }
      else { const md = Math.hypot(lx, y - 7.55); if (md < 0.4) { if (md > 0.3) return set(base + 160, i === 0 ? 'amber' : 'pale'); return set(base + 161, i === 0 ? 'pale' : 'violet'); }
        if (Math.abs(lx) + Math.abs(y - 5.95) * 0.8 < 0.24) return set(base + 162, i === 0 ? 'wine' : 'amber'); }
      const qx = (x + 3) * 32, qy = y * 32, a = Math.floor((qx + qy) / 9), b = Math.floor((qx - qy) / 9), h = hash2(a, b, 41 + i);
      const fld = [['teal', 'tealD', 'blue'], ['wine', 'wineD', 'wine'], ['blue', 'blueD', 'blue'], ['teal', 'tealD', 'blue']][i];
      return set(2000 + ((a * 131 + b * 17) & 8191) * 4 + i, h < 0.035 ? 'gone' : h < 0.09 ? 'amberD' : h < 0.5 ? fld[0] : h < 0.85 ? fld[1] : fld[2]); };
    for (let py = 0, k = 0; py < Hd; py++) for (let px = 0; px < Wd; px++, k += 4) { const x = -hw + (px + 0.5) / 32, y = GW.top - (py + 0.5) / 32; d[k + 3] = 255;
      if (!inMain(x, y)) { d[k] = d[k + 1] = d[k + 2] = 0; continue; }
      const id = cell(x, y), c0 = col, lead = id !== cell(x + 1 / 32, y) || id !== cell(x, y - 1 / 32) || (y < 9.2 && py % 31 === 30);
      if (lead && id !== 9999) { d[k] = 12; d[k + 1] = 10; d[k + 2] = 18; continue; }
      let v = id === 9999 ? 1 : (0.78 + 0.36 * hash2(id, 3, 7)) * (0.82 + 0.18 * clamp((y - GW.sill) / 3, 0, 1)); if (hash2(px, py, 3) < 0.04) v *= 0.72;
      d[k] = Math.min(255, c0[0] * v); d[k + 1] = Math.min(255, c0[1] * v); d[k + 2] = Math.min(255, c0[2] * v); }
    g2.putImageData(im, 0, 0); return c; })();
  const glassMat = M.glass(glassCanvas, 1.55);
  ctx.add(new THREE.Mesh(WN.pane(GW.cx, GW.sill, GW.w, GW.spring, GW.rise, { at: -0.02 }), glassMat), { cast: false, receive: false });
  // moonlight through the glass: shafts along the true key direction, the window's colours thrown on the floor, haloes
  { const kd = HD.Light.KEY_DIR, zg = -57;
    const land = (x, y, yf) => {      // where the moon's ray through the window point (x, y) lands on a floor at height yf
      const h = y - yf; return [x - h * kd[0] / kd[1], yf, zg - h * kd[2] / kd[1]]; };
    const shaft = M.beam('#f6d2b4', 0.25), gW = [];
    LCX.forEach(lc => { const yb = 5.2, yt = 9.9, a = land(lc, yb, FL), b = land(lc, yt, FL); gW.push(K.quad(a, b, [lc, yt, zg + 0.5], [lc, yb, zg + 0.5]));
      const ym = 7.6, l = land(lc - 0.55, ym, FL), r = land(lc + 0.55, ym, FL); gW.push(K.quad(l, r, [lc + 0.55, ym, zg + 0.5], [lc - 0.55, ym, zg + 0.5])); });
    { const l = land(-0.9, 12.3, FL), r = land(0.9, 12.3, FL); gW.push(K.quad(l, r, [0.9, 12.3, zg + 0.5], [-0.9, 12.3, zg + 0.5])); }
    ctx.add(new THREE.Mesh(K.merge(gW), shaft), { cast: false, receive: false });
    // the projected window, in two pieces (chancel floor, nave floor)
    const dm = new THREE.MeshBasicMaterial({ map: glassMat.map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }); dm.color.setScalar(0.32);
    const piece = (ya, yb, yf) => { const g = K.quad(land(-hwG, ya, yf), land(hwG, ya, yf), land(hwG, yb, yf), land(-hwG, yb, yf)), va = (GW.top - ya) / (GW.top - GW.sill), vb = (GW.top - yb) / (GW.top - GW.sill);
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, va, 1, va, 1, vb, 0, va, 1, vb, 0, vb], 2)); return g; }, hwG = GW.w / 2;
    const ySplit = CH + (-51.5 - zg) / (-kd[2] / kd[1]), ySplit2 = FL + (-50.9 - zg) / (-kd[2] / kd[1]);
    const dec = new THREE.Mesh(K.merge([piece(GW.sill, ySplit, CH + 0.03), piece(ySplit2, GW.top, FL + 0.03)]), dm); dec.renderOrder = 2; ctx.add(dec, { cast: false, receive: false });
    // dust turning in the shafts: one small cloud of points, drifting in the shader
    { const r = HD.rng(909), N = 44, pos = new Float32Array(N * 3), ph = new Float32Array(N); for (let i = 0; i < N; i++) { const wx = r.range(-2.5, 2.5), wy = r.range(5.2, 12.6), f = land(wx, wy, FL + 0.6), t = r.range(0.08, 0.92); pos[i * 3] = wx + (f[0] - wx) * t; pos[i * 3 + 1] = wy + (f[1] - wy) * t; pos[i * 3 + 2] = zg + 0.6 + (f[2] - zg - 0.6) * t; ph[i] = r.range(0, 6.283); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
      const mm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { time: { value: 0 }, size: { value: 80 }, col: { value: new THREE.Color('#ffe2c0').convertSRGBToLinear().multiplyScalar(0.55) } },
        vertexShader: 'attribute float phase; uniform float time; uniform float size; varying float vA; void main(){ vec3 p = position + vec3(sin(time * 0.21 + phase) * 0.35, sin(time * 0.13 + phase * 1.7) * 0.3 - fract(time * 0.04 + phase) * 0.8, cos(time * 0.17 + phase * 0.6) * 0.3); vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = (0.35 + 0.65 * abs(sin(time * 0.5 + phase * 3.0))) * sin(3.14159 * fract(time * 0.04 + phase)); gl_PointSize = size / -mv.z; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 col; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(d)) * vA; gl_FragColor = vec4(col * a, 1.0); }' });
      const pts = new THREE.Points(g, mm); pts.frustumCulled = false; ctx.root.add(pts); ctx.onUpdate(t => { mm.uniforms.time.value = t; mm.uniforms.size.value = 0.16 * (ctx.renderer ? ctx.renderer.domElement.height : 540); }); }
    ctx.glow({ x: 0, y: 8.6, z: -56.2, color: '#ffdcb4', size: 12, strength: 0.18, flicker: 0 }); ctx.glow({ x: 0, y: 12.3, z: -56.2, color: '#e8c6ff', size: 4.2, strength: 0.3, flicker: 0 });
    ctx.glow({ x: -2, y: 7.4, z: -56.2, color: '#7fd0c0', size: 3.4, strength: 0.2, flicker: 0 }); ctx.glow({ x: 0.7, y: 7.2, z: -56.2, color: '#d0788a', size: 3.4, strength: 0.22, flicker: 0 });
    ctx.light({ x: 0, y: 5.6, z: -54.6, color: '#e9cfc0', intensity: 0.85, distance: 13, flicker: 0 });
  }

  // ---------------------------------------------------------------------------------------------------- west wall
  const WW = K.wall([-10, -29.6], [-10, -57], 0);          // u = -29.6 - z; +w = east (inside)
  const topW = ragged(0, 27.4, [[0, 3.2], [3, 3.6], [6, 4.3], [9, 5.2], [11.6, 6.4], [12.2, 8.6], [20.4, 9.3], [24, 11], [27.4, 12.8]], 311, { amp: 0.45 });
  limit(topW, 4.75, 6.05, 3.0); ensure(topW, 4.1, 4.7, 5.0); ensure(topW, 6.1, 6.6, 4.5); ensure(topW, 8.9, 11.9, 5.0); ensure(topW, 12.5, 14.7, 8.5); ensure(topW, 16.3, 18.5, 8.5); ensure(topW, 22.4, 26.4, 5);
  const lanW = [[13.6, 3.4, 1.5, 6.2, 1.5], [17.4, 3.4, 1.5, 6.3, 1.5]], sedU = [23.1, 24.25, 25.4];
  { const holes = [K.arch(10.4, FL, 2.0, 3.0, 1.3, 0, 7)]; for (const l of lanW) holes.push(K.arch(l[0], l[1], l[2], l[3], l[4], 0, 7)); for (const u of sedU) holes.push(K.arch(u, 2.0, 0.9, 3.3, 0.8, 0, 5));
    S(M.stone, WW.solid({ t: 1.2, v0: -0.5, top: topW, holes })); crown(WW, topW, 312, { skip: [[4.7, 6.1]] });
    // wall shafts answering the arcade columns: two still carry their capitals, the rest are snapped
    for (const c of [[3.4, 2.4, 1], [7.4, 3.6, 1], [15.4, 6.2, 0], [19.4, 6.2, 0]]) S(M.sand, tint(K.column({ x: -9.3, z: -29.6 - c[0], y: 1.0, h: c[1] - 0.4, r: 0.2, sides: 8, broken: !!c[2], seed: c[0] }), 0.95));
    S(M.sand, WW.archTrim(10.4, FL, 2.0, 3.0, 1.3, { band: 0.26, depth: 0.14, at: 0.6 }), tint(WW.archTrim(10.4, FL, 2.0, 3.0, 1.3, { inset: -0.06, band: 0.06, depth: 1.3, at: -0.65 }), 0.85));
    for (const l of lanW) S(M.sand, WW.archTrim(l[0], l[1], l[2], l[3], l[4], { band: 0.2, depth: 0.12, at: 0.6 }), WW.tracery(l[0], l[1], l[2], l[3], l[4], { lights: 2, bar: 0.11, depth: 0.2 }), WW.box(l[0] - 1.0, l[0] + 1.0, l[1] - 0.16, l[1], 0.6, 0.8));
    // the broken window of the south bay: jamb stones and sill
    S(M.sand, WW.box(4.55, 6.25, 2.86, 3.02, 0.55, 0.8), tint(WW.box(4.6, 4.76, 3.0, 4.6, -0.5, 0.66), 0.9), tint(WW.box(6.04, 6.2, 3.0, 4.2, -0.5, 0.66), 0.9));
    // sedilia: three seats in the chancel wall
    S(M.stoneDark, tint(WW.box(22.5, 26.0, 1.9, 4.2, 0.0, 0.12), 0.72)); S(M.sand, WW.box(22.45, 26.05, 1.86, 2.0, 0.1, 0.78), WW.box(22.3, 26.2, 4.34, 4.5, 0.6, 0.76));
    for (const u of sedU) S(M.sand, WW.archTrim(u, 2.0, 0.9, 3.3, 0.8, { band: 0.12, depth: 0.1, at: 0.6 }));
    S(M.sand, WW.box(12.3, 22.3, 2.94, 3.1, 0.6, 0.72)); S(M.stoneDark, WW.box(0, 9.4, FL - 0.1, 1.0, 0.6, 0.74), WW.box(11.4, 21.9, FL - 0.1, 1.0, 0.6, 0.74), WW.box(21.9, 26.8, CH - 0.1, 1.82, 0.6, 0.84));
    // outside: plinth and buttresses (seen edge-on from the cloister)
    S(M.stoneDark, WW.box(-0.85, 9.2, -0.6, 0.5, -0.86, -0.6), WW.box(11.6, 20.4, -0.6, 0.5, -0.86, -0.6), tint(WW.box(-0.72, 9.2, 0.5, 0.74, -0.72, -0.6), 1.08), tint(WW.box(11.6, 20.4, 0.5, 0.74, -0.72, -0.6), 1.08));
    const bt = [[3.4, [[0.85, 1.7], [0.5, 2.9]]], [7.4, [[0.85, 2.3], [0.5, 3.9]]], [12.3, [[0.9, 3], [0.65, 5.6], [0.4, 7.6]]], [15.5, [[0.9, 3], [0.65, 5.6], [0.4, 7.6]]], [19.4, [[0.9, 3], [0.65, 5.8], [0.4, 8]]]];
    for (const b of bt) S(M.stone, WW.buttress(b[0], { width: 1.0, side: -1, face: 0.6, v0: -0.6, stages: b[1] }));
  }
  ctx.block.rect(-10.6, -57.6, -9.4, -41); ctx.block.rect(-10.6, -39, -9.4, -29.0);

  // ---------------------------------------------------------------------------------------------------- east wall
  const WE = K.wall([10, -29.6], [10, -57], 0);            // +w = east (outside)
  const topE = ragged(0, 27.4, [[0, 2.4], [2, 1.7], [5, 2.3], [8, 1.5], [11, 2.5], [14, 1.9], [15.4, 2.6], [19.6, 2.6], [21, 1.9], [23.5, 3.2], [25.5, 5.2], [27.4, 7.2]], 321, { amp: 0.45, min: 1.0 });
  ensure(topE, 16.1, 18.7, 7.6); ensure(topE, 15.5, 16.1, 5.0); ensure(topE, 18.7, 19.2, 5.5); ensure(topE, 4.2, 4.7, 3.6); ensure(topE, 6.1, 6.5, 4.2); ensure(topE, 12.6, 13.0, 3.8);
  { const l = [17.4, 3.0, 1.6, 5.3, 1.5];
    S(M.stone, WE.solid({ t: 1.2, v0: -0.5, top: topE, holes: [K.arch(l[0], l[1], l[2], l[3], l[4], 0, 7)] })); crown(WE, topE, 322, { p: 0.55 });
    for (const c of [[3.4, 1.5], [7.4, 2.1], [11.4, 1.2], [15.4, 3.6], [19.4, 2.8]]) S(M.sand, tint(K.column({ x: 9.3, z: -29.6 - c[0], y: 0.95, h: c[1], r: 0.2, sides: 8, broken: true, seed: c[0] + 3 }), 0.95));
    S(M.sand, WE.archTrim(l[0], l[1], l[2], l[3], l[4], { band: 0.2, depth: 0.12, at: 0.6 }), WE.archTrim(l[0], l[1], l[2], l[3], l[4], { band: 0.2, depth: 0.12, at: -0.72 }), WE.tracery(l[0], l[1], l[2], l[3], l[4], { lights: 2, bar: 0.11, depth: 0.2 }), WE.box(l[0] - 1.05, l[0] + 1.05, l[1] - 0.16, l[1], -0.8, 0.8));
    // jamb stones standing on the stumps of the lost windows
    S(M.sand, tint(WE.box(4.72, 4.88, 2.9, K.topAt(topE, 4.5) + 0.02, -0.66, 0.66), 0.9), tint(WE.box(5.95, 6.11, 2.9, K.topAt(topE, 6.3) + 0.02, -0.66, 0.66), 0.9), tint(WE.box(13.0, 13.16, 2.6, K.topAt(topE, 12.8) + 0.02, -0.66, 0.66), 0.9));
    S(M.stoneDark, WE.box(0, 21.9, FL - 0.1, 0.95, -0.74, -0.6), WE.box(21.9, 26.8, CH - 0.1, 1.82, -0.84, -0.6));
    S(M.stoneDark, WE.box(-0.85, 28.25, -0.6, 0.5, 0.6, 0.86), tint(WE.box(-0.72, 28.1, 0.5, 0.74, 0.6, 0.72), 1.08));
    const bt = [[3.4, [[0.9, 1.3], [0.5, 2.0]]], [7.4, [[0.9, 1.5], [0.5, 2.4]]], [11.4, [[0.9, 1.2]]], [15.4, [[1.0, 2.4], [0.6, 4.4]]], [19.4, [[1.0, 2.6], [0.6, 4.8]]], [23.4, [[0.9, 1.6], [0.5, 2.8]]], [26.9, [[1.2, 3], [0.8, 5.6]]]];
    for (const b of bt) S(M.stone, WE.buttress(b[0], { width: 1.0, side: 1, face: 0.6, v0: -0.6, stages: b[1] }));
  }
  ctx.block.rect(9.4, -57.6, 10.6, -29.0);

  // ----------------------------------------------------------------------------------------- south front and portal
  const WS = K.wall([-10, -29.6], [10, -29.6], 0);         // u = x + 10; +w = south (the camera)
  const PT = { cx: 10, sill: FL, w: 2.6, spring: 3.5, rise: 1.7 };
  const topS = ragged(0, 20, [[0, 3.0], [1.2, 2.4], [3, 1.8], [5.2, 2.4], [5.9, 3.4], [6.4, 4.2], [13.6, 4.2], [14.2, 3.0], [15, 2.0], [17, 1.5], [18.6, 2.2], [20, 2.6]], 331, { amp: 0.4, min: 1.0 });
  // the standing panel round the portal, authored block by block: a tall shard of the gable on the west shoulder, low over the door so the hero is seen beyond
  { const pan = [[6.5, 5.5], [7.2, 6.5], [7.9, 7.5], [8.5, 7.0], [9.0, 6.5], [9.45, 6.0], [10.75, 6.5], [11.3, 7.0], [11.9, 6.0], [12.7, 5.0], [13.5, 0]], out = topS.filter(p => p[0] < 6.5 - 1e-6 || p[0] > 13.5 + 1e-6), a = [];
    for (const p of out) if (p[0] < 6.5) a.push(p); a.push([6.5, K.topAt(topS, 6.4)]);
    for (let i = 0; i < pan.length - 1; i++) a.push([pan[i][0], pan[i][1]], [pan[i + 1][0], pan[i][1]]);
    a.push([13.5, K.topAt(topS, 13.6)]); for (const p of out) if (p[0] > 13.5) a.push(p); topS.length = 0; for (const p of a) topS.push(p); }
  S(M.stone, WS.solid({ t: 1.2, v0: -0.5, top: topS, holes: [K.arch(PT.cx, PT.sill, PT.w, PT.spring, PT.rise, 0.5, 9)] })); crown(WS, topS, 332, { skip: [[9.2, 10.9]] });
  // pinnacles on the buttresses that frame the portal: the west one keeps its spirelet, the east one is a stump
  { const px = -3.25, pz = -29.6 + 0.66, pin = [tint(K.boxc(px, 5.0, pz, 0.5, 1.75, 0.5), 0.9), K.boxc(px, 6.75, pz, 0.66, 0.12, 0.66), K.spire({ x: px, y: 7.22, z: pz, r: 0.36, h: 1.9, sides: 4 }), K.boxc(px, 9.02, pz, 0.2, 0.1, 0.2), K.boxc(px, 9.12, pz, 0.12, 0.2, 0.12)];
    for (const a of [0, 1, 2, 3]) { const sn = Math.sin(a * PI / 2), cs = Math.cos(a * PI / 2); pin.push(K.xform(K.extrude([[-0.3, 0], [0.3, 0], [0, 0.62]], 0.08), { ry: a * PI / 2, x: px + sn * 0.25, y: 6.87, z: pz + cs * 0.25 }), tint(K.xform(K.box(-0.12, 5.3, 0.25, 0.12, 6.5, 0.27), { ry: a * PI / 2, x: px, z: pz }), 0.6)); }
    S(M.sand, pin, tint(K.wobble(K.boxc(3.25, 4.0, pz, 0.5, 1.1, 0.5), 0.03, 9), 0.9));
    // blind quatrefoils in the spandrels
    for (const c of [[7.75, 5.5], [12.25, 5.4]]) { const q = K.extrude(circle(c[0], c[1], 0.36, 16), 0.1, [foil(c[0], c[1], 0.26, 4, 0.3, PI / 4)]); q.translate(0, 0, 0.6); S(M.sand, WS.put(q)); S(M.stoneDark, tint(WS.box(c[0] - 0.27, c[0] + 0.27, c[1] - 0.27, c[1] + 0.27, 0.6, 0.63), 0.5)); } }
  // three orders stepping back into the wall, shafts with capitals in the angles, impost, hood and the foot of the gablet
  S(M.sand, WS.archTrim(PT.cx, PT.sill, PT.w, PT.spring, PT.rise, { inset: 0.5, band: 0.3, depth: 0.4, at: 0.34 }), tint(WS.archTrim(PT.cx, PT.sill, PT.w, PT.spring, PT.rise, { inset: 0.25, band: 0.26, depth: 1.06, at: -0.6 }), 0.9), tint(WS.archTrim(PT.cx, PT.sill, PT.w, PT.spring, PT.rise, { inset: 0, band: 0.26, depth: 0.82, at: -0.62 }), 0.78));
  for (const sx of [-1, 1]) { S(M.sand, K.column({ x: sx * 1.43, z: -29.6 + 0.33, y: FL, h: 2.92, r: 0.1, sides: 6 }), K.column({ x: sx * 1.68, z: -29.6 + 0.6, y: FL, h: 2.92, r: 0.1, sides: 6 }));
    S(M.sand, tint(WS.box(10 + sx * 1.3 - 0.02, 10 + sx * 2.12, 3.44, 3.6, -0.64, 0.78), 1.05)); }
  { const gl = K.extrude([[7.55, 4.3], [7.8, 4.3], [9.35, 6.42], [9.2, 6.5]], 0.14); gl.translate(0, 0, 0.6); const gr = K.extrude([[12.45, 4.3], [12.2, 4.3], [11.3, 5.55], [11.5, 5.62]], 0.14); gr.translate(0, 0, 0.6); S(M.sand, WS.put(gl), WS.put(gr)); }
  S(M.stone, WS.buttress(6.75, { width: 1.0, face: 0.6, v0: -0.6, stages: [[1.2, 2.4], [0.8, 4.2], [0.5, 5.0]] }), WS.buttress(13.25, { width: 1.0, face: 0.6, v0: -0.6, stages: [[1.2, 2.4], [0.8, 4.0]] }),
    WS.buttress(0.2, { width: 1.1, face: 0.6, v0: -0.6, stages: [[1.0, 1.6], [0.6, 2.6]] }), WS.buttress(19.8, { width: 1.1, face: 0.6, v0: -0.6, stages: [[1.0, 1.4], [0.6, 2.2]] }));
  S(M.stoneDark, WS.box(-0.85, 6.2, -0.6, 0.5, 0.6, 0.86), WS.box(13.8, 20.85, -0.6, 0.5, 0.6, 0.86), tint(WS.box(-0.72, 6.2, 0.5, 0.74, 0.6, 0.72), 1.08), tint(WS.box(13.8, 20.72, 0.5, 0.74, 0.6, 0.72), 1.08), WS.box(7.3, 8.4, -0.6, 0.62, 0.6, 0.8), WS.box(11.6, 12.7, -0.6, 0.62, 0.6, 0.8));
  S(M.stoneDark, WS.box(0.6, 8.0, FL - 0.1, 0.95, -0.74, -0.6), WS.box(12.0, 19.4, FL - 0.1, 0.95, -0.74, -0.6));
  ctx.block.rect(-10.6, -30.2, -1.3, -29.0); ctx.block.rect(1.3, -30.2, 10.6, -29.0);
  // one leaf of the old door, swung in against the wall and sagging on its top hinge
  { const pts = [[0, 0], [1.27, 0]]; for (let i = 6; i >= 0; i--) pts.push(archAt(1.3, 2.9, 2.6, 1.7, -0.03, i / 12)); const leaf = K.extrude(pts, 0.11); leaf.translate(0, 0, -0.055);
    const iron = [K.box(0.0, 0.5, -0.09, 1.1, 0.62, 0.09), K.box(0.0, 2.3, -0.09, 1.1, 2.42, 0.09), K.box(0.92, 1.5, 0.05, 1.06, 1.76, 0.12)];
    const place = g => K.xform(K.xform(g, { rz: -0.035 }), { ry: PI * 0.41, x: -1.28, y: FL + 0.06, z: -30.24 });
    S(M.woodDark, tint(place(leaf), 1.1)); S(M.iron, tint(place(K.merge(iron)), 1.4)); ctx.block.seg(-1.3, -30.3, -0.98, -31.35, 0.06); }

  // ------------------------------------------------------------------------------------------------------- arcades
  const COLZ = [-33, -37, -41, -45, -49], CR = 0.5, CAPY = FL + 6.2;
  const colMat = M.sand;
  // west: all five stand and carry three arches and the wreck of a fourth
  for (const z of COLZ) { S(colMat, tint(K.column({ x: -4.2, z, y: FL, h: 6.2, r: CR, sides: 12 }), 0.96)); ctx.block.circle(-4.2, z, 0.74); }
  const AW = K.wall([-4.2, -30.2], [-4.2, -51], CAPY);     // u = -30.2 - z; +w = east; v = height above the capitals
  { const top = ragged(2.15, 15.45, [[2.15, 1.5], [3.2, 3.6], [5, 4.6], [9, 5.2], [11.5, 4.4], [13.4, 3.6], [14.6, 2.6], [15.45, 1.4]], 341, { amp: 0.4 }); ensure(top, 3.3, 14.3, 3.5); ensure(top, 3.6, 10.0, 5.0);
    const tri = [4.36, 5.24, 8.36, 9.24];                                                           // paired triforium openings over the two southern arches
    S(M.stone, arcadeWall(AW, 2.15, 15.45, [{ cx: 4.8, w: 2.7, rise: 2.3 }, { cx: 8.8, w: 2.7, rise: 2.3 }, { cx: 12.8, w: 2.7, rise: 2.3 }], top, 0.9, tri.map(u => K.arch(u, 3.42, 0.56, 4.0, 0.46, 0, 4)))); crown(AW, top, 342, { t: 0.5, p: 0.4 });
    for (const u of tri) S(M.sand, AW.archTrim(u, 3.42, 0.56, 4.0, 0.46, { band: 0.09, depth: 0.08, at: 0.45 })); S(M.sand, K.column({ x: -4.2 + 0.4, z: -30.2 - 4.8, y: CAPY + 3.22, h: 0.9, r: 0.07, sides: 6 }), K.column({ x: -4.2 + 0.4, z: -30.2 - 8.8, y: CAPY + 3.22, h: 0.9, r: 0.07, sides: 6 }));
    for (const c of [4.8, 8.8, 12.8]) S(M.sand, ring(AW, c, 0, 2.7, 2.3, { off0: -0.05, off1: 0.3, depth: 1.02 }));
    S(M.sand, AW.box(3.0, 14.3, 3.06, 3.22, -0.53, 0.53));
    // the fourth arch has fallen: springers left on both capitals, and a stub towards the south wall
    S(M.sand, ring(AW, 16.8, 0, 2.7, 2.3, { off0: -0.05, off1: 0.3, depth: 1.02, s0: 0, s1: 0.2, j1: 0.035 }), ring(AW, 16.8, 0, 2.7, 2.3, { off0: -0.05, off1: 0.3, depth: 1.02, s0: 0.74, s1: 1, j0: 0.04 }), ring(AW, 0.8, 0, 2.7, 2.3, { off0: -0.05, off1: 0.3, depth: 1.02, s0: 0.8, s1: 1, j0: 0.04 }));
    S(M.stone, AW.solid({ t: 0.9, u0: 18.15, u1: 19.45, top: [[18.15, 1.5], [18.6, 1.5], [18.6, 2.5], [19.1, 2.5], [19.1, 1.0], [19.45, 1.0]] })); }
  // east: three stand, two are stumps with their drums on the floor
  for (const z of [-33, -41, -49]) { S(colMat, tint(K.column({ x: 4.2, z, y: FL, h: 6.2, r: CR, sides: 12 }), 0.96)); ctx.block.circle(4.2, z, 0.74); }
  S(colMat, tint(K.column({ x: 4.2, z: -37, y: FL, h: 2.5, r: CR, sides: 12, broken: true, seed: 5 }), 0.92), tint(K.column({ x: 4.2, z: -45, y: FL, h: 1.5, r: CR, sides: 12, broken: true, seed: 8 }), 0.92)); ctx.block.circle(4.2, -37, 0.74); ctx.block.circle(4.2, -45, 0.74);
  const AE = K.wall([4.2, -30.2], [4.2, -51], CAPY);
  { const stub = (u0, top, sd) => S(M.stone, K.wobble(AE.solid({ t: 0.86, u0, u1: u0 + 1.3, top }), 0.025, sd), tint(K.wobble(AE.box(u0 + 0.3, u0 + 0.9, top[2][1] - 0.1, top[2][1] + 0.3, -0.3, 0.28), 0.04, sd + 1), 0.9));
    stub(2.15, [[2.15, 0.9], [2.55, 0.9], [2.55, 1.4], [3.0, 1.4], [3.0, 2.1], [3.45, 2.1]], 51); stub(10.15, [[10.15, 1.6], [10.5, 1.6], [10.5, 2.6], [11.05, 2.6], [11.05, 2.1], [11.45, 2.1]], 53); stub(18.15, [[18.15, 1.5], [18.55, 1.5], [18.55, 1.0], [19.0, 1.0], [19.0, 0.5], [19.45, 0.5]], 55);
    const st = [[4.8, 0, 0.17], [0.8, 0.83, 1], [12.8, 0, 0.24], [8.8, 0.8, 1], [16.8, 0.86, 1], [20.8, 0, 0.12]];
    for (const s of st) S(M.sand, ring(AE, s[0], 0, 2.7, 2.3, { off0: -0.05, off1: 0.3, depth: 1.02, s0: s[1], s1: s[2], j0: s[1] > 0 ? 0.035 : 0, j1: s[2] < 1 ? 0.035 : 0 })); }
  // the one transverse arch that still spans the nave, from the west capital to the east one at z = -41
  const AT = K.wall([-4.2, -41], [4.2, -41], CAPY);
  const TR = 4.9;
  S(M.sand, ring(AT, 4.2, 0, 7.4, TR, { off0: 0, off1: 0.42, depth: 0.5, n: 22 }), tint(ring(AT, 4.2, 0, 7.4, TR, { off0: -0.14, off1: 0.02, depth: 0.26, n: 22 }), 0.86), tint(ring(AT, 4.2, 0, 7.4, TR, { off0: 0.4, off1: 0.5, depth: 0.66, n: 22, s0: 0, s1: 0.27, j1: 0.02 }), 1.05), tint(ring(AT, 4.2, 0, 7.4, TR, { off0: 0.4, off1: 0.5, depth: 0.66, n: 22, s0: 0.66, s1: 1, j0: 0.02 }), 1.05));
  { const top = K.archTop(7.4, TR, 0.42); S(M.sand, tint(AT.box(3.94, 4.46, top - 0.66, top + 0.1, -0.34, 0.34), 1.04)); }                    // the boss at the crown
  // vault springers: stubs of the diagonal ribs on the standing capitals
  { const dia = (x, z, tx, tz, s1) => { const Wd = K.wall([x, z], [tx, tz], CAPY); S(M.sand, tint(ring(Wd, Wd.L / 2, 0, Wd.L - 0.9, 4.9, { off0: 0, off1: 0.3, depth: 0.3, s0: 0, s1, j1: 0.012, n: 6 }), 0.95)); };
    dia(-4.2, -41, 4.2, -37, 0.17); dia(-4.2, -41, 4.2, -45, 0.12); dia(4.2, -41, -4.2, -37, 0.1); dia(4.2, -41, -4.2, -45, 0.15); dia(-4.2, -37, 4.2, -33, 0.1); dia(-4.2, -37, 4.2, -41, 0.14); dia(-4.2, -45, 4.2, -41, 0.13); dia(-4.2, -45, 4.2, -49, 0.09);
    dia(-4.2, -33, 4.2, -37, 0.12); dia(4.2, -33, -4.2, -37, 0.1); dia(-4.2, -49, 4.2, -45, 0.14); dia(4.2, -49, -4.2, -45, 0.1);
    const tr = (x, z, s) => { const Wd = K.wall([x, z], [-x, z], CAPY); S(M.sand, ring(Wd, 4.2, 0, 7.4, TR, { off0: 0, off1: 0.42, depth: 0.5, s0: 0, s1: s, j1: 0.012, n: 6 })); };
    tr(-4.2, -37, 0.12); tr(-4.2, -45, 0.16); tr(-4.2, -33, 0.08); tr(4.2, -33, 0.1); tr(-4.2, -49, 0.11); tr(4.2, -49, 0.07); }
  // responds against the south wall (stumps)
  S(colMat, tint(K.column({ x: -4.2, z: -30.42, y: FL, h: 2.3, r: 0.42, broken: true, seed: 11 }), 0.9), tint(K.column({ x: 4.2, z: -30.42, y: FL, h: 1.5, r: 0.42, broken: true, seed: 12 }), 0.9)); ctx.block.circle(-4.2, -30.5, 0.6); ctx.block.circle(4.2, -30.5, 0.6);

  // ------------------------------------------------------------------------------------ chancel: altar, cross, candles
  const fabric = M.make(T.paint(160, 768, (x, y) => {
    if (x < 64) { const rx = x < 32 ? x : 63 - x, eat = Math.max(0, (fbm(y * 0.04, x < 32 ? 0.5 : 9.5, 91, 3) - 0.5) * 34), wear = fbm(x * 0.07, y * 0.03, 93, 4) + 0.1 * (rx / 31);            // the runner (v along its length)
      const rip = Math.abs((y - 250) - (x - 30) * 1.5) < 2.5 + fbm(x * 0.2, y * 0.2, 94, 2) * 3 && x > 14 || Math.abs((y - 566) + (x - 20) * 0.9) < 2 + fbm(x * 0.2, y * 0.2, 95, 2) * 4 && x < 46;
      const a = rx < eat || wear > 0.73 || rip || y < 4 + hash2(x >> 1, 1, 96) * 9 || y > 762 - hash2(x >> 1, 2, 96) * 8 ? 0 : 255;
      if (wear > 0.6 && hash2(x, y, 5) < (wear - 0.58) * 7) return ['dirt', 2.4 + hash2(x, y, 6) * 1.6, 0.8, a];
      if (rx < 1) return ['autumn', 0.2, 0.3, a]; if (rx < 6) return ['gold', ((y >> 2) + rx) % 4 === 0 ? 0.5 : 1.45 + (hash2(x, y, 7) - 0.5) * 0.7, 0.6, a]; if (rx < 8) return ['autumn', 0.3, 0.3, a];
      const mx = 31.5 - rx, my = (y % 56) - 28, dd = mx * 0.95 + Math.abs(my) * 0.62, g = (fbm(x * 0.15, y * 0.15, 97, 2) - 0.5) * 1.1 + ((x + y) & 1 ? 0.12 : -0.12);
      if (dd < 8) return ['autumn', 2.9 + g, 0.8, a]; if (dd < 10) return ['gold', 1.1 + g * 0.5, 0.6, a]; if (rx === 10 || rx === 11) return ['autumn', 0.6, 0.4, a];
      return ['autumn', 1.55 + g, 0.8, a]; }
    const cx = x - 64, g = (fbm(cx * 0.14, y * 0.14, 98, 2) - 0.5) * 1.2, hem = 70 + fbm(cx * 0.08, 0.5, 99, 3) * 30 - 6;                                                                                    // the altar cloth (hem ragged below row ~70)
    const a = y > hem || fbm(cx * 0.21, y * 0.21, 100, 2) > 0.74 ? 0 : 255;
    if (cx < 3 || cx > 92 || (y > 60 && y < 64)) return ['gold', 1.3 + g * 0.4, 0.6, a];
    const m1 = Math.hypot(cx - 44, y - 53), m2 = Math.hypot(cx - 52, y - 53); if (y > 42 && (Math.abs(m1 - 5) < 0.9 || m2 < 5.2)) return ['gold', m2 < 5.2 ? 0.7 : 1.8, 0.5, a];
    return ['autumn', 0.95 + g + (((cx >> 2) + (y >> 2)) & 1 ? 0.22 : 0), 0.8, a]; }), { mode: 'uv', alphaTest: 0.5, side: THREE.DoubleSide, name: 'fabric' });
  const uvQuad = (p0, p1, p2, p3, u0, u1, v0, v1) => { const g = K.quad(p0, p1, p2, p3); g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2)); return g; };
  { // the runner: door -> up the chancel steps -> to the altar
    const path = [[FL, -31.0], [FL, -38.1], [FL + 0.09, -38.26], [FL + 0.01, -38.44], [FL + 0.07, -38.58], [FL, -38.76], [FL, -50.88], [0.9, -50.88], [0.9, -51.48], [CH, -51.48], [CH, -53.98], [1.35, -53.98], [1.35, -54.52]];
    let len = 0; const ls = [0]; for (let i = 1; i < path.length; i++) { len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); ls.push(len); }
    for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], dz = Math.abs(a[1] - b[1]) > 0.01 ? 0 : 0.018, dy = dz ? 0 : 0.016;
      B2.add(fabric, uvQuad([-1, a[0] + dy, a[1] + dz], [1, a[0] + dy, a[1] + dz], [1, b[0] + dy, b[1] + dz], [-1, b[0] + dy, b[1] + dz], 0, 0.4, ls[i] / len, ls[i + 1] / len)); } }
  { const AX = 1.5, Z0 = -55.75, Z1 = -54.62, AY = 1.35;           // the altar: a block with three blind arches in its front, a heavy mensa
    const WA = K.wall([-AX, (Z0 + Z1) / 2], [AX, (Z0 + Z1) / 2], AY), holes = [0.5, 1.5, 2.5].map(u => K.arch(u, 0.2, 0.7, 0.52, 0.36, 0, 5));
    S(M.sand, tint(WA.solid({ t: Z1 - Z0, h: 1.06, holes }), 0.88), tint(K.box(-AX - 0.08, AY, Z0 - 0.06, AX + 0.08, AY + 0.14, Z1 + 0.08), 0.95), tint(K.box(-AX - 0.16, AY + 1.06, Z0 - 0.1, AX + 0.16, AY + 1.24, Z1 + 0.16), 1.04));
    S(M.stoneDark, tint(WA.box(0.06, 2.94, 0.1, 1.0, -0.3, 0.38), 0.62));
    const top = AY + 1.24, zf = Z1 + 0.17;
    B2.add(fabric, uvQuad([-AX, top + 0.015, zf], [AX, top + 0.015, zf], [AX, top + 0.015, Z0 - 0.1], [-AX, top + 0.015, Z0 - 0.1], 0.4, 1, 42 / 768, 0), uvQuad([-AX, top - 1.3, zf + 0.09], [AX, top - 1.3, zf + 0.09], [AX, top + 0.015, zf], [-AX, top + 0.015, zf], 0.4, 1, 84 / 768, 42 / 768));
    // cross with trefoiled arms on a stepped foot
    const cz = -55.42, cy = top, cr = [K.boxc(0, cy, cz, 0.6, 0.12, 0.38), K.boxc(0, cy + 0.12, cz, 0.4, 0.12, 0.28), K.box(-0.08, cy + 0.24, cz - 0.07, 0.08, cy + 2.05, cz + 0.07), K.box(-0.56, cy + 1.36, cz - 0.07, 0.56, cy + 1.52, cz + 0.07)];
    for (const p of [[-0.56, 1.44], [0.56, 1.44], [0, 2.05]]) cr.push(K.xform(K.boxc(0, -0.13, 0, 0.26, 0.26, 0.15), { x: p[0], y: cy + p[1], z: cz, rz: PI / 4 }));
    { const rg = new THREE.TorusGeometry(0.3, 0.045, 4, 14); rg.translate(0, cy + 1.44, cz); cr.push(rg); }
    S(M.bronze, tint(K.merge(cr), 0.86, 0.8, 0.82));
    for (const sx of [-1, 1]) { candlestick(sx * 2.2, 1.35, -54.5, 2.2, true); ctx.block.circle(sx * 2.2, -54.5, 0.26);
      S(M.bronze, tint(K.lathe([[0.13, 0], [0.13, 0.04], [0.04, 0.1], [0.04, 0.3], [0.1, 0.36], [0, 0.36]], 6, { x: sx * 1.12, y: top + 0.02, z: -55.2 }), 0.68, 0.64, 0.68)); S(M.sand, tint(K.lathe([[0.045, 0], [0.045, 0.3 - (sx > 0 ? 0.1 : 0)], [0, 0.32 - (sx > 0 ? 0.1 : 0)]], 6, { x: sx * 1.12, y: top + 0.38, z: -55.2 }), 1.12));
      B2.add(M.flame, flameGeo(sx * 1.12, top + 0.7 - (sx > 0 ? 0.1 : 0), -55.2, 0.75)); ctx.glow({ x: sx * 1.12, y: top + 0.84 - (sx > 0 ? 0.1 : 0), z: -55.15, color: '#ffc070', size: 1.3, strength: 0.9 }); }
    ctx.light({ x: 0, y: 3.9, z: -54.1, color: '#ffc070', intensity: 1.35, distance: 10 });
    ctx.block.rect(-AX - 0.2, Z0 - 0.2, AX + 0.2, Z1 + 0.2);
    ctx.spot({ id: 'altar', x: 0, z: -53.6, r: 1.2, label: '鐘は、もう鳴らない', kind: 'read' }); }
  { // a toppled lectern and its book
    const g = K.merge([K.box(-0.08, 0, -0.08, 0.08, 1.7, 0.08), K.box(-0.4, 0, -0.07, 0.4, 0.1, 0.07), K.box(-0.07, 0, -0.4, 0.07, 0.1, 0.4), K.xform(K.box(-0.42, -0.04, -0.3, 0.42, 0.04, 0.3), { y: 1.78, rx: 0.5 }), K.box(-0.3, 1.5, -0.1, 0.3, 1.62, 0.1)]);
    S(M.woodDark, tint(K.xform(g, { x: -4.9, y: CH + 0.12, z: -53.3, rz: PI / 2 - 0.06, ry: 0.5 }), 1.3)); ctx.block.seg(-5.0, -53.3, -6.3, -52.7, 0.3);
    S(M.sand, tint(K.xform(K.box(-0.3, 0, -0.22, 0.0, 0.07, 0.22), { x: -3.5, y: CH + 0.02, z: -52.7, ry: 0.3, rz: -0.12 }), 1.12), tint(K.xform(K.box(0.0, 0, -0.22, 0.3, 0.07, 0.22), { x: -3.5, y: CH + 0.02, z: -52.7, ry: 0.3, rz: 0.12 }), 1.05));
    S(M.woodDark, K.xform(K.box(-0.33, 0, -0.25, 0.33, 0.03, 0.25), { x: -3.5, y: CH, z: -52.7, ry: 0.3 })); }
  // a statue that fell from its niche, in pieces under it
  S(M.sand, tint(statue(6.9, CH + 0.22, -55.3, { headless: true, h: 2.3, rx: PI / 2 - 0.1, ry: 0.5 }), 0.9)); ctx.block.circle(7.2, -54.7, 0.8);

  // ------------------------------------------------------------------------------------------------- font, pews
  { const x = -6.7, z = -32.9, o8 = (r, rot) => K.ngon(x, z, r, 8, rot === undefined ? PI / 8 : rot);
    S(M.sand, tint(K.poly(o8(1.05), FL, FL + 0.16), 0.82), tint(K.poly(o8(0.62), FL + 0.16, FL + 0.34), 0.9), K.poly(o8(0.36), FL + 0.34, FL + 0.95), tint(K.poly(o8(0.5), FL + 0.95, FL + 1.05), 0.95), tint(K.poly(o8(0.72), FL + 1.05, FL + 1.18), 0.9), K.poly(o8(0.86), FL + 1.18, FL + 1.62, [K.ngon(x, z, 0.68, 8, PI / 8)]), tint(K.poly(o8(0.9), FL + 1.56, FL + 1.66, [K.ngon(x, z, 0.7, 8, PI / 8)]), 1.08));
    S(M.stoneDark, tint(K.poly(o8(0.7), FL + 1.2, FL + 1.5), 0.45)); ctx.block.circle(x, z, 0.98); }
  function pew(x, z, kind, o) { o = o || {}; const hl = 0.85, gs = [], r = HD.rng(Math.round(x * 31 + z * 17) + 900), t = (o.t || 1) * (kind === 'burned' ? 0.36 : 1) * r.range(0.82, 1.0);
    // bench end: a shaped standard with a poppy-head; seat, low back with a book ledge, stretcher
    const prof = [[-0.44, 0], [0.38, 0], [0.38, 1.22], [0.42, 1.34], [0.36, 1.5], [0.3, 1.62], [0.24, 1.5], [0.18, 1.34], [0.22, 1.2], [0.2, 0.98], [-0.06, 0.9], [-0.36, 0.92], [-0.44, 0.84]];
    const end = sx => { const g = K.extrude(prof, 0.12); g.rotateY(-PI / 2); g.translate(sx + 0.06, 0, 0); return tint(g, t * 1.12); };
    gs.push(end(-hl)); if (kind !== 'lean' && kind !== 'burned') gs.push(end(hl));
    gs.push(tint(K.box(-hl, 0.68, -0.38, hl, 0.78, 0.24), t * 1.25), tint(K.box(-hl, 0.14, -0.3, hl, 0.24, -0.22), t * 0.8));
    if (kind !== 'burned') gs.push(tint(K.box(-hl, 0.4, 0.22, hl, 1.14, 0.29), t * 0.72), tint(K.box(-hl, 1.14, 0.18, hl, 1.24, 0.34), t * 1.3), tint(K.box(-hl + 0.1, 0.84, 0.29, hl - 0.1, 0.89, 0.46), t * 1.05));
    let g = K.merge(gs), ry = o.ry === undefined ? r.range(-0.04, 0.04) : o.ry;
    if (kind === 'lean' || kind === 'burned') { g = K.xform(g, { x: hl }); g = K.xform(g, { rz: -0.33 }); g = K.xform(g, { x: -hl, y: 0.02 }); }
    if (kind === 'tipped') g = K.xform(g, { rx: PI / 2 - 0.08, y: 0.36, z: 0.2 });
    { const cl = g.attributes.color; for (let i = 0; i < cl.count; i++) cl.setXYZ(i, cl.getX(i) * 0.9, cl.getY(i) * 0.92, cl.getZ(i) * 1.02); }
    S(M.woodDark, K.xform(g, { x, y: FL, z, ry })); const c = Math.cos(ry), s = Math.sin(ry);
    if (kind === 'tipped') { for (const bz of [0.25, 1.05]) ctx.block.seg(x - c * 0.45 + s * bz, z + s * 0.45 + c * bz, x + c * 0.45 + s * bz, z - s * 0.45 + c * bz, 0.45); } else ctx.block.seg(x - c * 0.5, z + s * 0.5, x + c * 0.5, z - s * 0.5, 0.4); }
  { const PX = 2.6, rows = [-33.75, -36.25, -37.75, -40.25, -41.75, -44.25, -45.75, -48.25];
    const west = ['ok', 'ok', 'ok', 'askew', 'ok', 'gone', 'shoved', 'ok'], east = ['ok', 'askew', 'lean', 'burned', 'burned2', 'lean', 'gone', 'tipped'];
    rows.forEach((z, i) => { const w = west[i], e = east[i];
      if (w === 'ok') pew(-PX, z, 'ok'); else if (w === 'askew') pew(-PX - 0.05, z + 0.1, 'ok', { ry: -0.2 }); else if (w === 'shoved') pew(-PX - 0.1, z - 0.55, 'lean', { ry: 0.42 });
      if (e === 'ok') pew(PX, z, 'ok'); else if (e === 'askew') pew(PX + 0.1, z + 0.1, 'ok', { ry: 0.24 }); else if (e === 'lean') pew(PX, z, 'lean', { ry: i === 2 ? -0.1 : 0.16 }); else if (e === 'burned') pew(PX, z, 'burned', { ry: 0.1 }); else if (e === 'burned2') pew(PX + 0.1, z + 0.15, 'tipped', { ry: -0.3, t: 0.3 }); else if (e === 'tipped') pew(PX, z + 0.3, 'tipped', { ry: 0.2 }); }); }
  { const TW = K.wall([-8.05, -43.6], [-8.05, -46.6], FL), hs = [0.5, 1.2, 1.9, 2.6].map(u => K.arch(u, 0.22, 0.46, 0.5, 0.26, 0, 4));      // a chest tomb against the west wall, its effigy worn smooth
    S(M.sand, tint(K.box(-9.42, FL, -46.75, -7.9, FL + 0.14, -43.45), 0.8), tint(TW.solid({ t: 0.16, h: 0.95, holes: hs, w: -0.08 }), 0.9), tint(K.box(-9.4, FL + 0.14, -46.6, -8.2, FL + 0.95, -43.6), 0.6), tint(K.box(-9.42, FL + 0.95, -46.72, -7.94, FL + 1.1, -43.48), 1.0));
    S(M.sand, tint(K.xform(statue(0, 0, 0, { h: 2.3 }), { rx: -PI / 2 + 0.03, x: -8.7, y: FL + 1.34, z: -43.85 }), 0.96), tint(K.box(-9.0, FL + 1.1, -46.5, -8.4, FL + 1.26, -46.05), 0.9));
    ctx.block.rect(-9.42, -46.78, -7.88, -43.42); }
  // the iron ring of the great candle-crown, fallen where the pews are broken
  { const cx = -2.85, cz = -44.9, tor = new THREE.TorusGeometry(1.0, 0.055, 5, 22); tor.rotateX(PI / 2); const gs = [tor], tor2 = new THREE.TorusGeometry(0.42, 0.04, 4, 12); tor2.rotateX(PI / 2); tor2.translate(0, 0.02, 0); gs.push(tor2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * PI; gs.push(K.lathe([[0.03, 0], [0.03, 0.1], [0.09, 0.16], [0.09, 0.2], [0, 0.2]], 5, { x: Math.cos(a) * 1.0, y: 0.03, z: Math.sin(a) * 1.0 })); if (i % 2 === 0) gs.push(K.tube([[Math.cos(a) * 0.42, 0.02, Math.sin(a) * 0.42], [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0]], 0.022, 4)); }
    S(M.iron, tint(K.xform(K.merge(gs), { x: cx, y: FL + 0.2, z: cz, rz: 0.16, rx: -0.1, ry: 0.3 }), 1.55), tint(K.tube([[cx + 0.3, FL + 0.12, cz - 0.2], [cx + 0.9, FL + 0.05, cz - 1.1], [cx + 0.5, FL + 0.04, cz - 1.9], [cx + 1.0, FL + 0.04, cz - 2.6]], 0.035, 4), 1.4));
    ctx.block.circle(cx, cz, 0.95); }

  // ---------------------------------------------------------------------------------- fallen masonry and timbers
  // heap(): a pile where masonry came down: a mound of core rubble, big facing blocks tumbled on it, small stuff spilling out, a pale moulded piece or two
  const heap = (x, z, n, spread, seed, o) => { o = o || {}; const y = o.y === undefined ? FL : o.y, r = HD.rng(seed * 13 + 1), big = o.big === undefined ? 1 : o.big;
    S(M.stone, tint(K.rubble({ x, z, y, n, spread, seed, size: o.size || [0.28, 0.8], sx: o.sx, sz: o.sz }), 1.06));
    if (big) { S(M.rubble, tint(K.rock({ x, y: y + 0.05, z, sx: spread * 0.5 * (o.sx || 1), sy: spread * 0.34 * big, sz: spread * 0.46 * (o.sz || 1), seed: seed + 3, detail: 1, ry: r.range(0, 3) }), 0.82));
      for (let i = 0; i < 4; i++) { const a = r.range(0, 6.283), d = r.range(0.1, 0.55) * spread, w = r.range(0.6, 1.0); S(i === 3 ? M.sand : M.stone, tint(K.chunk({ x: x + Math.cos(a) * d * (o.sx || 1), y: y + (0.55 - d / spread) * spread * 0.42 * big, z: z + Math.sin(a) * d * (o.sz || 1), w, h: r.range(0.4, 0.55), d: r.range(0.45, 0.7), seed: seed * 7 + i, rx: r.range(-0.5, 0.5), rz: r.range(-0.5, 0.5) }), i === 3 ? 0.92 : 1.1)); } }
    if (o.block !== 0) ctx.block.circle(x, z, o.block || spread * 0.62); };
  // east arcade: the two fallen columns
  S(colMat, tint(K.drum({ x: 5.9, y: FL, z: -36.3, r: 0.47, len: 1.3, ry: 0.5 }), 0.95), tint(K.drum({ x: 7.2, y: FL, z: -37.6, r: 0.47, len: 1.25, ry: -0.3 }), 0.9), tint(K.drum({ x: 6.0, y: FL + 0.86, z: -37.3, r: 0.47, len: 1.2, ry: 1.3, rz: 0.12 }), 1.0),
    tint(K.xform(capital(CR), { x: 7.9, y: FL + 0.5, z: -38.9, rz: 1.25, ry: 0.7 }), 0.95));
  heap(6.5, -37.2, 13, 1.9, 21, { block: 1.45 });
  S(colMat, tint(K.drum({ x: 5.7, y: FL, z: -45.6, r: 0.47, len: 1.3, ry: 0.15 }), 0.95), tint(K.drum({ x: 6.6, y: FL, z: -46.7, r: 0.47, len: 1.2, ry: 1.1 }), 0.9), tint(K.xform(capital(CR), { x: 6.3, y: FL + 0.42, z: -47.9, rz: -1.1, ry: 2.2 }), 0.95));
  heap(6.0, -46.2, 11, 1.7, 22, { block: 1.3 }); ctx.block.circle(6.3, -47.8, 0.7);
  S(M.woodDark, beam(6.4, FL + 0.95, -45.2, 5.2, { ry: 0.35, rz: 0.2, t: 0.8 }), beam(7.6, FL + 0.55, -38.0, 4.4, { ry: 1.2, rz: 0.12, t: 0.9 }), beam(5.5, FL + 0.3, -39.6, 3.2, { ry: -0.2, rz: 0.04, t: 0.6 }));
  ctx.block.seg(4.4, -39.5, 6.8, -39.9, 0.3);
  // lengths of fallen vault rib, still curved
  { const W0 = K.wall([0, 0], [1, 0], 0), rib = (s0, s1, x, y, z, ry, tilt) => { const g = ring(W0, 0, 0, 7.4, TR, { off0: 0, off1: 0.34, depth: 0.36, s0, s1, j0: 0.01, j1: 0.012, n: 6 }), c = archAt(0, 0, 7.4, TR, 0.17, (s0 + s1) / 2);
      g.translate(-c[0], -c[1], 0); S(M.sand, tint(K.xform(g, { rx: -PI / 2 + (tilt || 0), ry, x, y, z }), 0.93)); };
    rib(0.2, 0.36, -6.9, FL + 0.2, -37.4, 0.5, 0.06); rib(0.55, 0.66, 6.9, FL + 0.34, -41.2, 2.2, 0.2); rib(0.3, 0.4, 2.9, CH + 0.2, -52.6, 1.2, 0.05); rib(0.62, 0.72, -6.2, FL + 0.2, -50.0, 2.6, 0.1); }
  ctx.block.circle(2.9, -52.6, 0.55); ctx.block.circle(-6.9, -37.4, 0.75); ctx.block.circle(6.9, -41.2, 0.6); ctx.block.circle(-6.2, -50.0, 0.6);
  // corners and wall feet
  heap(8.1, -55.1, 14, 1.6, 23, { y: CH, block: 1.25, size: [0.3, 0.95] }); heap(8.2, -31.5, 12, 1.5, 24, { block: 1.2 }); heap(-8.6, -31.3, 6, 1.0, 25, { block: 0.8, size: [0.25, 0.6] });
  heap(8.7, -42.2, 8, 1.3, 26, { block: 0.8, sz: 1.8 }); heap(-8.5, -49.6, 7, 1.0, 27, { block: 0.8 }); heap(8.6, -50.3, 6, 0.9, 28, { block: 0.7 });
  S(M.woodDark, beam(8.3, FL + 1.0, -32.2, 4.6, { ry: 0.9, rz: 0.42, t: 0.85 }), beam(8.9, FL + 0.6, -33.6, 3.4, { ry: 1.5, rz: 0.2, t: 0.7 }), beam(-8.3, FL + 0.9, -48.2, 4.2, { ry: 1.45, rz: 0.4, t: 0.85 }), beam(8.6, CH + 1.1, -53.6, 4.4, { ry: 1.62, rz: 0.5, t: 0.8 }));
  ctx.block.seg(8.6, -34.6, 9.0, -32.4, 0.3); ctx.block.seg(-8.5, -50.0, -8.2, -46.4, 0.3);
  // outside: stones shed by the east wall and the south front
  heap(11.9, -37.5, 7, 1.2, 31, { y: 0, block: 0, sz: 2, big: 0.6 }); heap(12.0, -51.5, 8, 1.2, 32, { y: 0, block: 0, sz: 1.8, big: 0.6 }); heap(6.5, -28.2, 6, 1.2, 33, { y: 0, block: 0, sx: 2.2, sz: 0.6, big: 0 }); heap(-6.0, -28.1, 7, 1.3, 34, { y: 0, block: 0, sx: 2.4, sz: 0.6, big: 0 });
  S(M.stone, K.chunk({ x: 3.2, y: FL, z: -31.3, w: 0.9, h: 0.5, d: 0.6, seed: 41 }), K.chunk({ x: -3.1, y: FL, z: -34.9, w: 0.6, h: 0.4, d: 0.5, seed: 42 }), K.chunk({ x: -7.8, y: FL, z: -43.4, w: 0.8, h: 0.5, d: 0.55, seed: 43 }), K.chunk({ x: 3.6, y: CH, z: -53.4, w: 0.7, h: 0.45, d: 0.5, seed: 44 }));

  // ------------------------------------------------------------------------------------------------------ plants
  const rp = HD.rng(77);
  for (let j = -68; j <= -41; j += 1) for (let i = -13; i <= 12; i++) if (lost(i, j) && rp() < 0.3) ctx.plant('grass', { x: (i + 0.5) * TS, z: (j + 0.5) * TS, r: 0.5, n: 3, kind: rp() < 0.5 ? 'weed' : 'tuft', seed: i * 7 + j });
  for (const z of [-32, -35.5, -38, -43.5, -47, -50]) { ctx.plant('grass', { x: 8.9, z, r: 0.6, n: 5, kind: 'tall', seed: Math.round(-z) }); ctx.plant('grass', { x: -8.9, z: z - 0.8, r: 0.5, n: 3, kind: 'weed', seed: Math.round(-z) + 50 }); }
  ctx.plant('grass', { x: 6.4, z: -37.2, r: 1.8, n: 8, kind: 'weed', seed: 61 }); ctx.plant('grass', { x: 6.2, z: -46.3, r: 1.6, n: 7, kind: 'tall', seed: 62 }); ctx.plant('grass', { x: 0, z: -30.8, r: 1.0, n: 3, kind: 'tuft', seed: 63 });
  ctx.plant('ivy', { x: 9.38, y: 1.7, z: -35, nx: -1, nz: 0, w: 5.5, h: 2.0, density: 0.8, seed: 71 }); ctx.plant('ivy', { x: 9.38, y: 1.8, z: -42.5, nx: -1, nz: 0, w: 4.5, h: 2.2, density: 0.7, seed: 72 }); ctx.plant('ivy', { x: 9.38, y: 4.2, z: -47, nx: -1, nz: 0, w: 3.2, h: 6, density: 0.6, seed: 73 });
  ctx.plant('ivy', { x: -9.38, y: 7.4, z: -46, nx: 1, nz: 0, w: 8, h: 3.2, density: 0.6, seed: 74 }); ctx.plant('ivy', { x: -9.38, y: 3.2, z: -34, nx: 1, nz: 0, w: 6, h: 2.4, density: 0.6, seed: 75 });
  ctx.plant('ivy', { x: 7.6, y: 5.0, z: -56.38, nx: 0, nz: 1, w: 3.4, h: 7, density: 0.55, seed: 76 }); ctx.plant('ivy', { x: -4.2 + 0.47, y: 10.2, z: -38, nx: 1, nz: 0, w: 5, h: 2.4, density: 0.5, seed: 77 });
  ctx.plant('ivy', { x: 5.5, y: 2.2, z: -28.98, nx: 0, nz: 1, w: 5, h: 2.6, density: 0.6, seed: 78 }); ctx.plant('ivy', { x: 10.62, y: 1.6, z: -40, nx: 1, nz: 0, w: 9, h: 2.4, density: 0.6, seed: 79 });
  ctx.plant('tree', { x: 8.3, z: -53.6, kind: 'broadleaf', h: 4.6, seed: 81, lean: 0.12 }); ctx.block.circle(8.3, -53.6, 0.35); ctx.plant('bush', { x: 7.2, z: -55.4, r: 0.9, kind: 'shrub', seed: 82 }); ctx.plant('bush', { x: 8.6, z: -31.2, r: 0.8, kind: 'bramble', seed: 83 });
  ctx.plant('bush', { x: 8.9, z: -42.6, r: 0.7, kind: 'fern', seed: 84 }); ctx.plant('leaves', { x: 2.5, z: -34, r: 3, n: 30, kind: 'dry', y: FL + 0.02 }); ctx.plant('leaves', { x: -6, z: -45, r: 3, n: 26, kind: 'dry', y: FL + 0.02 }); ctx.plant('leaves', { x: 6.5, z: -50, r: 2.5, n: 20, kind: 'autumn', y: FL + 0.02 });

  // in the chancel the camera lifts its eyes to the window
  ctx.camZone({ x: 0, z: -53.4, r: 4.2, fall: 7, pitch: 24, dist: 40, lift: 6.0 });

  B.build(); B2.build({ cast: false });
}; })();
