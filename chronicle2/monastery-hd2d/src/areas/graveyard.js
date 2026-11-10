// The graveyard: two plots of old graves in rough grass either side of the approach, the monks' rows up the east side of
// the church, and the sealed mausoleum. Everything here is built from a small library of monument builders (below); each
// builder makes one monument in LOCAL space (origin on the ground, front facing +z = south, toward the camera) as a list
// of [material, geometry] parts, and place() leans, sinks, turns and moves it into the world.
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.graveyard = function (ctx) {
  const K = ctx.K, M = ctx.M, L = ctx.L, T = ctx.T, THREE = ctx.THREE;
  const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const B = ctx.batch(), B2 = ctx.batch();          // B: solid masonry (casts shadows); B2: thin overlays and flames (no shadows)
  const stats = (ctx.graveyard = { monuments: 0, kinds: {} });
  const count = k => { stats.monuments++; stats.kinds[k] = (stats.kinds[k] || 0) + 1; };

  // ------------------------------------------------------------------------------------------------ carved lettering
  // A see-through texture of weathered incised lines of text (dark cut, pale lower edge). Laid as a flat card just proud
  // of a stone's face with UVs in world units, so the lines follow the stone however it leans. Row 0 = top of the tablet.
  const INS = (() => { const hash2 = HD.hash2, fbm = HD.fbm;
    const ink = (x, y) => { let gh, gw, ly, line; if (y < 7) { gh = 4; gw = 3; ly = y - 1; line = 0; } else { const k = Math.floor((y - 7) / 5); gh = 3; gw = 2; ly = y - 7 - k * 5; line = k + 1; }
      if (ly < 0 || ly >= gh) return false; const gp = gw + 1, ci = Math.floor(x / gp), lx = x - ci * gp; if (lx >= gw) return false;
      if (hash2(ci, line, 3) < (line % 4 === 3 ? 0.5 : 0.24)) return false;                         // word spaces
      return lx === 0 ? hash2(ci * 4 + ly, line, 4) < 0.9 : hash2(ci * 16 + lx * 4 + ly, line, 6) < 0.6; };
    const c = T.paint(128, 96, (x, y) => { const wear = clamp((fbm(x * 0.06, y * 0.09, 5, 2) - 0.33) * 5, 0, 1);
      if (ink(x, y)) return ['stone', 1.3, 0, Math.round(165 * wear)];
      if (y > 0 && ink(x, y - 1)) return ['stone', 7, 0, Math.round(70 * wear)];
      return ['stone', 1, 0, 0]; });
    const m = M.make(c, { mode: 'unit', name: 'inscription' }); m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2; return m; })();

  // ------------------------------------------------------------------------------------------------ geometry helpers
  const ext = (pts, d, holes, z0) => { const g = K.extrude(pts, d, holes); g.translate(0, 0, z0 === undefined ? -d / 2 : z0); return g; };   // profile in XY, pushed along z
  // tapered box: w0 x d0 at the bottom (y0), w1 x d1 at the top (y0 + h)
  const tbox = (cx, y0, cz, w0, d0, w1, d1, h) => { const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const top = p.getY(i) > 0; p.setXYZ(i, cx + p.getX(i) * (top ? w1 : w0), y0 + (top ? h : 0), cz + p.getZ(i) * (top ? d1 : d0)); }
    g.computeVertexNormals(); return g; };
  const face = (pts, z) => { const g = new THREE.ShapeGeometry(K.shape(pts)); g.translate(0, 0, z); return g; };           // flat face looking +z
  const circle = (cx, cy, R, n, a0) => { const a = []; for (let i = 0; i < n; i++) { const t = (a0 || 0) + i / n * PI * 2; a.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]); } return a; };
  const rect = (l, w) => [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]];
  // tone(geom, grey, lo, height): tint a piece, darker and a little greener toward the ground (damp, mossy feet)
  function tone(g, v, lo, hgt) { lo = lo === undefined ? 0.62 : lo; hgt = hgt || 1.1; const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const t = clamp(p.getY(i) / hgt, 0, 1), k = v * (lo + (1 - lo) * t), c = (1 - t) * (1 - lo) * 2.2; a[i * 3] = k * (1 - 0.07 * c); a[i * 3 + 1] = k; a[i * 3 + 2] = k * (1 - 0.1 * c); }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
  // a monument under construction: list of [material, geometry]
  function Mon() { const a = [];
    a.put = function (m, ...gs) { for (const g of gs.flat(Infinity)) if (g) a.push([m, g]); return a; };
    a.join = function (b, o) { for (const [m, g] of b) a.push([m, o ? K.xform(g, o) : g]); return a; };
    return a; }
  function place(P, o) { const y = (o.y === undefined ? L.terrain(o.x, o.z) : o.y) - (o.sink || 0), t = { x: o.x, y, z: o.z, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 };
    for (const [m, g] of P) (m === INS || m === M.lampGlass ? B2 : B).add(m, K.xform(g, t)); }
  // lettering cards
  function insQ(P, r, p0, p1, p2, p3, w, h) { if (w < 0.12 || h < 0.14) return; const g = K.quad(p0, p1, p2, p3), u0 = r.int(0, 127) / 32;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, -h, u0 + w, -h, u0 + w, 0, u0, -h, u0 + w, 0, u0, 0], 2)); K.tint(g, r.range(0.7, 1)); P.put(INS, g); }
  const insV = (P, r, x0, y0, x1, y1, z) => insQ(P, r, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], x1 - x0, y1 - y0);          // on a face looking +z
  const insH = (P, r, x0, z0, x1, z1, y) => insQ(P, r, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], x1 - x0, z1 - z0);          // on a top face, read from the south
  const pickStone = (r, sandBias) => r() < (sandBias === undefined ? 0.55 : sandBias) ? { m: M.sand, v: r.range(0.75, 1.06) } : { m: M.stonePlain, v: r.range(0.8, 1.1) };
  // low earth hump (local): unit dome scaled to sx, h, sz
  function moundG(r, sx, sz, h) { let g = K.lathe([[1.06, -1], [1, 0], [0.84, 0.55], [0.48, 0.92], [0, 1]], 7, { ry: r.range(0, 1) }); K.wobble(g, 0.055, r.int(1, 9999)); g = K.flat(g); return K.xform(g, { sx, sy: h, sz, ry: r.range(-0.2, 0.2) }); }
  function mound(r, x, z, sx, sz, h, grassy, ry) { const g = K.xform(moundG(r, sx, sz, h), { x, y: L.terrain(x, z) - 0.02, z, ry: ry || 0 }); const v = grassy ? r.range(1.15, 1.4) : r.range(0.5, 0.64); B.add(grassy ? M.moss : M.earth, grassy ? K.tint(g, v, v, v * 0.92) : K.tint(g, v, v * 0.97, v * 1.08)); }
  const mossBlob = (r, x, y, z, s) => K.tint(K.rock({ x, y, z, sx: s * r.range(0.8, 1.3), sy: s * 0.28, sz: s * r.range(0.6, 1), seed: r.int(1, 9999), detail: 0, ry: r.range(0, 3) }), r.range(0.9, 1.3));

  // --------------------------------------------------------------------------------------------- headstone profiles
  const HEADH = { round: 0.5, pointed: 0.78, camber: 0.17, shoulder: 0.32, gothic: 0.495, clip: 0.2, peak: 0.34, square: 0 };       // head height / width
  function headPts(style, w, h, y0, n) { n = n || 6; const hw = w / 2, pts = [[-hw, y0], [hw, y0]];
    const arc = (cx, cy, R, a0, a1, k, skip) => { for (let i = skip ? 1 : 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
    if (style === 'round') arc(0, h - hw, hw, 0, PI, n);
    else if (style === 'pointed') { const rise = w * 0.78, R = (hw * hw + rise * rise) / w, c = R - hw, a1 = Math.acos(c / R), k = n >> 1; arc(-c, h - rise, R, 0, a1, k); arc(c, h - rise, R, PI - a1, PI, k, true); }
    else if (style === 'camber') { const rise = w * 0.17, R = (hw * hw + rise * rise) / (2 * rise), A = Math.asin(hw / R); arc(0, h - R, R, PI / 2 - A, PI / 2 + A, Math.max(3, n - 2)); }
    else if (style === 'shoulder') { const hr = hw * 0.64, ys = h - hr; pts.push([hw, ys - 0.03]); arc(0, ys, hr, 0, PI, n); pts.push([-hw, ys - 0.03]); }
    else if (style === 'gothic') { const hr = hw * 0.66, rise = hr * 1.5, ys = h - rise, R = (hr * hr + rise * rise) / (2 * hr), c = R - hr, a1 = Math.acos(c / R), k = n >> 1; pts.push([hw, ys - 0.03]); arc(-c, ys, R, 0, a1, k); arc(c, ys, R, PI - a1, PI, k, true); pts.push([-hw, ys - 0.03]); }
    else if (style === 'clip') { const c = w * 0.2; pts.push([hw, h - c], [hw - c, h], [-hw + c, h], [-hw, h - c]); }
    else if (style === 'peak') pts.push([hw, h - w * 0.34], [0, h], [-hw, h - w * 0.34]);
    else pts.push([hw, h], [-hw, h]);
    return pts; }
  const reliefCross = (cx, cy, s, z, t) => K.merge([K.box(cx - s * 0.16, cy - s, z, cx + s * 0.16, cy + s * 0.75, z + t), K.box(cx - s * 0.62, cy + s * 0.08, z, cx + s * 0.62, cy + s * 0.4, z + t)]);
  const STYLES = ['round', 'round', 'round', 'pointed', 'pointed', 'shoulder', 'shoulder', 'gothic', 'gothic', 'camber', 'clip', 'peak'];
  const RELIEFS = ['panel', 'panel', 'panelCross', 'panelCross', 'panelCross', 'proud', 'cross', 'cross', 'roundel', 'roundel', 'plain'];

  // headstone(r, {style, w, h, d, stone, relief, base, cut, noText, finial}): an upright slab with a carved face
  function headstone(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r), v = st.v, style = o.style || r.pick(STYLES);
    const w = o.w || r.range(0.76, 1.08) * (style === 'shoulder' || style === 'gothic' ? 1.14 : 1), h = o.h || r.range(1.1, 1.62) + (style === 'pointed' ? 0.14 : 0), d = o.d || r.range(0.18, 0.28), zf = d / 2;
    const relief = o.relief || r.pick(RELIEFS), b = Math.max(0.065, w * 0.085), hasBase = o.base === undefined ? r() < 0.3 : o.base, yb = hasBase ? 0.3 : 0.15;
    P.w = w; P.h = h; P.d = d;
    P.put(st.m, tone(ext(headPts(style, w, h, o.cut ? 0 : -0.5), d), v, r.range(0.46, 0.62), h));
    if (hasBase) P.put(r() < 0.5 ? M.stone : M.stoneDark, tone(K.boxc(0, -0.4, 0, w + 0.32, 0.6, d + 0.3), r.range(0.84, 1.04), 0.62, 0.25));
    const cy = h - (style === 'pointed' ? 0.6 : Math.max(HEADH[style], 0.42)) * w, s = Math.min(0.3 * w, 0.32); let zt = zf, orn = false;
    if (relief === 'panel' || relief === 'panelCross') { const inner = headPts(style, w - 2 * b, h - b, yb);          // sunk panel inside a raised border
      P.put(st.m, tone(ext(headPts(style, w, h, yb - b), 0.045, [inner], zf), v * 1.06, 0.72, h));
      P.put(st.m, K.tint(face(inner, zf + 0.004), v * 0.72)); zt = zf + 0.004;
      if (relief === 'panelCross') { P.put(st.m, K.tint(reliefCross(0, cy, s * 0.9, zf, 0.042), v * 1.12)); orn = true; } }
    else if (relief === 'proud') { P.put(st.m, tone(ext(headPts(style, w - 2 * b, h - b, yb), 0.04, null, zf), v * 1.08, 0.76, h)); zt = zf + 0.04; }      // raised tablet
    else if (relief === 'cross') { P.put(st.m, K.tint(reliefCross(0, cy, s, zf, 0.04), v * 1.12)); orn = true; }
    else if (relief === 'roundel') { const yc = cy + s * 0.1;                                                               // wheel cross
      P.put(st.m, K.tint(ext(circle(0, yc, s * 0.66, 8, PI / 8), 0.035, [circle(0, yc, s * 0.42, 8, PI / 8)], zf), v * 1.12), K.tint(K.merge([K.box(-s * 0.5, yc - s * 0.09, zf, s * 0.5, yc + s * 0.09, zf + 0.03), K.box(-s * 0.09, yc - s * 0.5, zf, s * 0.09, yc + s * 0.5, zf + 0.03)]), v * 1.1)); orn = true; }
    if (!o.noText) { const top = orn ? cy - s - 0.07 : h - HEADH[style] * w - 0.03, hx = w / 2 - b - 0.05; insV(P, r, -hx, yb + 0.06, hx, top, zt + 0.008); }
    if (r() < 0.24) P.put(M.moss, mossBlob(r, r.range(-w * 0.12, w * 0.12), h - 0.035, 0, r.range(0.1, 0.16)));
    if (o.finial || (style === 'camber' && r() < 0.4)) { const fw = 0.11, fh = 0.44;                                         // a small cross standing on the top
      P.put(st.m, K.tint(K.box(-fw / 2, h - 0.03, -fw * 0.4, fw / 2, h + fh, fw * 0.4), v * 1.02), K.tint(K.box(-0.18, h + fh * 0.5, -fw * 0.36, 0.18, h + fh * 0.5 + fw, fw * 0.36), v * 1.05)); P.h = h + fh; }
    return P; }
  // a headstone snapped off low: {stump, top} (the top piece is built with its break at y = 0)
  function snappedStone(r) { const st = pickStone(r), v = st.v, style = r.pick(['round', 'pointed', 'shoulder', 'camber', 'gothic']), w = r.range(0.8, 1.02), h = r.range(1.3, 1.62), d = r.range(0.19, 0.27), hw = w / 2;
    const hb = r.range(0.28, 0.5), j = [[hw, hb + r.range(-0.1, 0.14)], [hw * 0.3, hb + r.range(-0.12, 0.12)], [-hw * 0.3, hb + r.range(-0.1, 0.16)], [-hw, hb + r.range(-0.12, 0.1)]];
    const stump = Mon().put(st.m, tone(ext([[-hw, -0.5], [hw, -0.5]].concat(j), d), v * 0.92, 0.6, 0.8));
    const tp = j.slice().reverse().concat(headPts(style, w, h, -0.5).slice(2)).map(p => [p[0], p[1] - hb]), top = Mon().put(st.m, K.tint(ext(tp, d), v));
    const cy = h - (style === 'pointed' ? 0.6 : Math.max(HEADH[style], 0.42)) * w - hb, s = Math.min(0.3 * w, 0.3);
    top.put(st.m, K.tint(reliefCross(0, cy, s, d / 2, 0.04), v * 1.12)); insV(top, r, -hw + 0.12, 0.2, hw - 0.12, cy - s - 0.06, d / 2 + 0.008);
    return { stump, top, w, h: h - hb, d }; }
  function footstone(r, st) { const P = Mon(), w = r.range(0.34, 0.46), h = r.range(0.3, 0.46); P.put(st.m, tone(ext(headPts(r.pick(['round', 'camber', 'square']), w, h, -0.3, 4), 0.12), st.v * 0.95, 0.6, 0.5)); P.w = w; return P; }

  // ---------------------------------------------------------------------------------------------------------- crosses
  // ringCross(r, {h, steps, stone, seg}): Celtic cross on a stepped plinth and a tapered die
  function ringCross(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r, 0.65), v = st.v, H = o.h || r.range(2.4, 3.1), s = H / 3, steps = o.steps === undefined ? r.int(1, 2) : o.steps, N = o.seg || 12;
    let y = 0, bw = 0.66 * s + steps * 0.36 * s + 0.16;
    for (let i = 0; i < steps; i++) { const hh = 0.2 * s + 0.03; P.put(i ? M.stone : M.stoneDark, tone(K.boxc(0, i ? y : -0.4, 0, bw, hh + (i ? 0 : 0.4), bw * 0.84, r.range(-0.04, 0.04)), r.range(0.84, 1.02), 0.66, 0.5)); y += hh; bw -= 0.36 * s; }
    const dh = 0.4 * s; P.put(st.m, tone(tbox(0, y, 0, bw, bw * 0.8, bw * 0.8, bw * 0.62, dh), v * 0.93, 0.6, H)); y += dh; P.base = 0.66 * s + steps * 0.36 * s + 0.16;
    const yc = H - 0.56 * s, sw0 = 0.36 * s, sw1 = 0.25 * s, sd0 = 0.26 * s, sd1 = 0.2 * s, at = 0.25 * s, ad = 0.2 * s, R = 0.43 * s, Ri = 0.31 * s, span = 0.56 * s;
    P.put(st.m, tone(tbox(0, y, 0, sw0, sd0, sw1, sd1, yc - y), v, 0.6, H));
    const fr = t => [(sw0 + (sw1 - sw0) * t) / 2 - 0.05 * s, (sd0 + (sd1 - sd0) * t) / 2 + 0.004, y + (yc - y) * t], a = fr(0.08), b = fr(0.8);                 // sunk panel down the shaft
    P.put(st.m, K.tint(K.quad([-a[0], a[2], a[1]], [a[0], a[2], a[1]], [b[0], b[2], b[1]], [-b[0], b[2], b[1]]), v * 0.74));
    insQ(P, r, [-a[0] + 0.02, a[2] + 0.03, a[1] + 0.006], [a[0] - 0.02, a[2] + 0.03, a[1] + 0.006], [b[0] - 0.02, b[2] - 0.03, b[1] + 0.006], [-b[0] + 0.02, b[2] - 0.03, b[1] + 0.006], a[0] * 2 - 0.04, b[2] - a[2] - 0.06);
    P.put(st.m, tone(ext(circle(0, yc, R, N), ad * 0.6, [circle(0, yc, Ri, N)]), v * 0.92, 0.6, H));
    P.put(st.m, tone(K.box(-span, yc - at / 2, -ad / 2, span, yc + at / 2, ad / 2), v * 1.04, 0.6, H), tone(tbox(0, yc + at / 2 - 0.01, 0, at, ad, at * 0.96, ad, span - at / 2 + 0.01), v * 1.02, 0.6, H));
    P.put(st.m, K.tint(K.xform(K.lathe([[0.1 * s, 0], [0.085 * s, 0.03 * s], [0.04 * s, 0.055 * s], [0, 0.06 * s]], 6, { flat: true }), { rx: PI / 2, y: yc, z: ad / 2 }), v * 1.14));
    P.h = H; return P; }
  // latinCross(r, {h, t, stone, base, cut}): a plain cross, slightly tapered, on a socket stone or straight in the ground
  function latinCross(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r, 0.5), v = st.v, H = o.h || r.range(1.5, 2.1), t = o.t || H * 0.115 + 0.035, d = t * 0.72, span = H * r.range(0.25, 0.3), ya = H * r.range(0.66, 0.72);
    let y = o.cut ? 0 : -0.5; const base = o.base === undefined ? r() < 0.6 : o.base;
    if (base) { const bw = t * 3.3; P.put(M.stone, tone(K.boxc(0, -0.4, 0, bw, 0.56, bw * 0.8), r.range(0.82, 1), 0.66, 0.3)); P.put(st.m, tone(tbox(0, 0.16, 0, bw * 0.72, bw * 0.58, t * 1.5, d * 1.5, 0.18), v * 0.94, 0.7, H)); y = 0.3; }
    P.put(st.m, tone(tbox(0, y, 0, t * 1.08, d * 1.08, t * 0.94, d * 0.94, H - y), v, 0.58, H));
    P.put(st.m, tone(K.box(-span, ya - t * 0.46, -d * 0.44, span, ya + t * 0.46, d * 0.44), v * 1.04, 0.58, H));
    if (o.roof) { const rl = span * 1.25, ra = 0.62; for (const sg of [-1, 1]) P.put(st.m, K.tint(K.xform(K.box(0, 0, -d * 0.62, rl, 0.045, d * 0.62), { rz: sg > 0 ? -ra : PI + ra, y: H + 0.12 + (sg > 0 ? 0 : 0.045) }), v * (sg > 0 ? 0.9 : 1.12))); }
    if (o.caps) { const e = t * 0.2; P.put(st.m, K.tint(K.merge([K.box(span - 0.02, ya - t * 0.46 - e, -d * 0.5, span + 0.07, ya + t * 0.46 + e, d * 0.5), K.box(-span - 0.07, ya - t * 0.46 - e, -d * 0.5, -span + 0.02, ya + t * 0.46 + e, d * 0.5), K.box(-t * 0.47 - e, H - 0.02, -d * 0.5, t * 0.47 + e, H + 0.07, d * 0.5)]), v * 1.08)); }
    P.h = H; return P; }
  // slender wrought-iron cross with a ring, set in a socket stone
  function ironCross(r) { const P = Mon(), H = r.range(1.5, 1.9), t = 0.055, ya = H * 0.72, sp = H * 0.22, v = 1.7, dia = (x, y) => K.xform(K.box(-0.05, -0.05, -0.02, 0.05, 0.05, 0.02), { rz: PI / 4, x, y });
    P.put(M.stone, tone(K.boxc(0, -0.3, 0, 0.36, 0.5, 0.3), 0.9, 0.7, 0.3));
    P.put(M.iron, K.tint(K.merge([K.boxc(0, 0.2, 0, t, H - 0.2, t), K.box(-sp, ya - t / 2, -t / 2, sp, ya + t / 2, t / 2), ext(circle(0, ya, sp * 0.64, 8, PI / 8), 0.03, [circle(0, ya, sp * 0.64 - 0.045, 8, PI / 8)]), dia(sp, ya), dia(-sp, ya), dia(0, H)]), v));
    P.h = H; return P; }

  // ------------------------------------------------------------------------------------------------- slabs and tombs
  // low coped (ridged) grave slab; its long axis is local z, head at -z
  function coped(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r), v = st.v, l = o.l || r.range(1.7, 2.1), w = r.range(0.62, 0.8), hs = r.range(0.12, 0.18), hr = hs + w * r.range(0.22, 0.3), y0 = 0.1;
    P.put(M.stone, tone(K.boxc(0, -0.3, 0, w + 0.2, 0.3 + y0, l + 0.2), r.range(0.82, 1), 0.72, 0.2));
    P.put(st.m, tone(ext([[-w / 2, y0], [w / 2, y0], [w / 2, y0 + hs], [0, y0 + hr], [-w / 2, y0 + hs]], l), v, 0.74, 0.5));
    P.put(st.m, K.tint(K.box(-0.035, y0 + hr - 0.02, -l / 2 + 0.1, 0.035, y0 + hr + 0.03, l / 2 - 0.1), v * 1.14));                                 // ridge roll
    const zc = -l / 2 + l * 0.28, sl = Math.atan2(hr - hs, w / 2);                                                                              // cross-bar of the ridge cross lying on both slopes
    P.put(st.m, K.tint(K.xform(K.box(0, -0.02, -0.04, w * 0.36, 0.025, 0.04), { rz: -sl, y: y0 + hr, z: zc }), v * 1.14), K.tint(K.xform(K.box(0, -0.025, -0.04, w * 0.36, 0.02, 0.04), { rz: PI + sl, y: y0 + hr, z: zc }), v * 1.14));
    if (o.head === undefined ? r() < 0.5 : o.head) P.put(st.m, tone(ext([[-w / 2 - 0.05, -0.3], [w / 2 + 0.05, -0.3], [w / 2 + 0.05, y0 + hs + 0.2], [0, y0 + hr + 0.32], [-w / 2 - 0.05, y0 + hs + 0.2]], 0.16, null, -l / 2 - 0.12), v * 0.96, 0.66, 0.6));
    P.l = l; P.w = w; return P; }
  // flat ledger slab with a long relief cross or lettering; long axis local z
  function ledger(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r), v = st.v, l = o.l || r.range(1.6, 1.95), w = r.range(0.72, 0.9), t = 0.13;
    P.put(st.m, tone(tbox(0, -0.12, 0, w, l, w - 0.07, l - 0.07, 0.12 + t), v, 0.78, 0.2));
    if (r() < 0.55) { P.put(st.m, K.tint(K.merge([K.box(-0.05, t, -l * 0.38, 0.05, t + 0.03, l * 0.38), K.box(-w * 0.27, t, -l * 0.2, w * 0.27, t + 0.03, -l * 0.2 + 0.1), K.box(-0.12, t, l * 0.38 - 0.08, 0.12, t + 0.03, l * 0.38)]), v * 1.12)); }
    else insH(P, r, -w / 2 + 0.1, -l / 2 + 0.14, w / 2 - 0.1, l / 2 - 0.2, t + 0.008);
    P.l = l; P.w = w; return P; }
  // chest tomb: plinth, panelled body (rails and stiles standing proud), moulded lid. open: the lid has slid off the back and the chest is dark inside.
  function chest(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r, 0.6), v = st.v, l = o.l || r.range(2.0, 2.4), w = o.w || r.range(0.95, 1.1), hb = o.hb || r.range(0.72, 0.9), y1 = 0.2, y2 = y1 + hb, pr = 0.035, pw = 0.15;
    P.put(M.stoneDark, tone(K.boxc(0, -0.4, 0, l + 0.36, 0.53, w + 0.36), r.range(0.82, 0.96), 0.7, 0.2));
    P.put(st.m, tone(tbox(0, 0.13, 0, l + 0.3, w + 0.3, l + 0.1, w + 0.1, 0.07), v * 0.92, 0.7, 0.3));
    if (o.open) { const hole = rect(l - 0.26, w - 0.26);
      P.put(st.m, tone(K.poly(rect(l, w), y1, y2 - 0.1, [hole]), v * 0.82, 0.66, y2), tone(K.poly(rect(l + pr * 2, w + pr * 2), y2 - 0.1, y2, [hole]), v * 1.02, 0.7, y2));
      P.put(M.void, K.quad([-l / 2 + 0.1, y2 - 0.4, w / 2 - 0.1], [l / 2 - 0.1, y2 - 0.4, w / 2 - 0.1], [l / 2 - 0.1, y2 - 0.4, -w / 2 + 0.1], [-l / 2 + 0.1, y2 - 0.4, -w / 2 + 0.1])); }
    else P.put(st.m, tone(K.boxc(0, y1, 0, l, hb, w), v * 0.82, 0.66, y2), tone(K.boxc(0, y2 - 0.1, 0, l + pr * 2, 0.1, w + pr * 2), v * 1.02, 0.7, y2));
    P.put(st.m, tone(K.boxc(0, y1, 0, l + pr * 2, 0.1, w + pr * 2), v, 0.7, y2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.put(st.m, tone(K.boxc(sx * (l / 2 - pw / 2 + pr), y1 + 0.1, sz * (w / 2 - pw / 2 + pr), pw, hb - 0.2, pw), v, 0.7, y2));
    const nmid = l > 2.2 ? 2 : 1, xs = []; for (let i = 1; i <= nmid; i++) { const x = -l / 2 + l * i / (nmid + 1); xs.push(x); for (const sz of [-1, 1]) P.put(st.m, tone(K.boxc(x, y1 + 0.1, sz * (w / 2 + pr / 2 - 0.02), 0.11, hb - 0.2, pr + 0.04), v, 0.7, y2)); }
    const xa = nmid === 2 ? xs[0] + 0.1 : -l / 2 + pw + 0.06, xb = nmid === 2 ? xs[1] - 0.1 : xs[0] - 0.1; insV(P, r, xa, y1 + 0.16, xb, y2 - 0.15, w / 2 + 0.008);
    const lid = Mon().put(st.m, K.tint(K.boxc(0, 0, 0, l + 0.14, 0.06, w + 0.14), v * 0.92), K.tint(K.boxc(0, 0.06, 0, l + 0.3, 0.11, w + 0.3), v * 1.06), K.tint(tbox(0, 0.17, 0, l + 0.3, w + 0.3, l + 0.04, w + 0.04, 0.07), v * 1.1));
    if (o.open) { P.join(lid, { x: l / 2 + 0.52, y: 0.78, z: -0.07, ry: 0.12, rz: -0.6 }); P.ext = 1.75; }
    else { P.join(lid, { y: y2 }); if (r() < 0.7) P.put(M.moss, mossBlob(r, r.range(-l * 0.3, l * 0.3), y2 + 0.235, r.range(-0.2, 0.1), 0.3)); }
    P.l = l; P.w = w; P.h = y2 + 0.24; return P; }
  // table tomb: a slab on turned legs over a ledger
  function tableTomb(r) { const P = Mon(), st = pickStone(r, 0.5), v = st.v, l = r.range(2.0, 2.3), w = r.range(0.95, 1.1), hl = r.range(0.62, 0.74);
    P.put(M.stone, tone(K.boxc(0, -0.3, 0, l + 0.1, 0.4, w + 0.1), r.range(0.82, 0.96), 0.75, 0.2));
    const leg = [[0.15, 0], [0.15, 0.07], [0.09, 0.12], [0.125, hl * 0.45], [0.085, hl - 0.14], [0.14, hl - 0.06], [0.14, hl]], xsL = l > 2.15 ? [-1, 0, 1] : [-1, 1];
    for (const sx of xsL) for (const sz of [-1, 1]) P.put(st.m, tone(K.lathe(leg, 6, { x: sx * (l / 2 - 0.24), y: 0.1, z: sz * (w / 2 - 0.2), flat: true }), v * 0.94, 0.7, 1));
    P.put(st.m, K.tint(K.boxc(0, 0.1 + hl, 0, l, 0.13, w), v * 1.05), K.tint(tbox(0, 0.23 + hl, 0, l, w, l - 0.16, w - 0.16, 0.05), v * 1.1));
    insH(P, r, -l / 2 + 0.25, -w / 2 + 0.22, l / 2 - 0.25, w / 2 - 0.2, 0.28 + hl + 0.008);
    P.put(M.moss, mossBlob(r, r.range(-0.5, 0.5), 0.285 + hl, -0.15, 0.26));
    P.l = l; P.w = w; P.h = 0.3 + hl; return P; }
  // pedestal shared by the obelisk, the urn and the statue: returns the height of its top
  function pedestal(P, r, st, o) { const v = st.v, w = o.w, dh = o.dh; let y = 0;
    P.put(M.stoneDark, tone(K.boxc(0, -0.4, 0, w + 0.8, 0.62, w + 0.8), 0.88, 0.72, 0.3)); y = 0.22;
    P.put(M.stone, tone(K.boxc(0, y, 0, w + 0.42, 0.2, w + 0.42, r.range(-0.03, 0.03)), 0.98, 0.8, 0.5)); y += 0.2;
    P.put(st.m, tone(tbox(0, y, 0, w + 0.22, w + 0.22, w + 0.06, w + 0.06, 0.1), v * 0.94, 0.8, 3)); y += 0.1;
    P.put(st.m, tone(K.boxc(0, y, 0, w, dh, w), v * 0.86, 0.74, 3));
    P.put(st.m, K.tint(K.box(-w / 2 + 0.1, y + 0.09, w / 2, w / 2 - 0.1, y + dh - 0.09, w / 2 + 0.03), v * 1.02)); insV(P, r, -w / 2 + 0.15, y + 0.13, w / 2 - 0.15, y + dh - 0.13, w / 2 + 0.038); y += dh;
    P.put(st.m, tone(tbox(0, y, 0, w, w, w + 0.2, w + 0.2, 0.08), v * 0.98, 1, 3), K.tint(K.boxc(0, y + 0.08, 0, w + 0.22, 0.08, w + 0.22), v * 1.06), K.tint(tbox(0, y + 0.16, 0, w + 0.18, w + 0.18, o.top || w * 0.7, o.top || w * 0.7, 0.1), v * 1.1)); y += 0.26;
    return y; }
  function obelisk(r, o) { o = o || {}; const P = Mon(), st = o.stone || pickStone(r, 0.4), v = st.v, H = o.h || r.range(3.1, 3.6), y = pedestal(P, r, st, { w: 0.74, dh: 0.62, top: 0.54 });
    P.put(st.m, tone(tbox(0, y, 0, 0.5, 0.5, 0.3, 0.3, H - y - 0.32), v, 0.8, H), K.tint(tbox(0, H - 0.32, 0, 0.3, 0.3, 0.02, 0.02, 0.32), v * 1.08)); P.h = H; return P; }
  function urnTomb(r) { const P = Mon(), st = pickStone(r, 0.75), v = st.v, y = pedestal(P, r, st, { w: 0.72, dh: 0.95, top: 0.4 });
    const pr = [[0.14, 0], [0.16, 0.04], [0.1, 0.08], [0.07, 0.16], [0.11, 0.2], [0.25, 0.34], [0.29, 0.48], [0.25, 0.6], [0.14, 0.66], [0.16, 0.7], [0.1, 0.74], [0.05, 0.8], [0.07, 0.84], [0, 0.88]];
    P.put(st.m, K.tint(K.lathe(pr, 8, { y, flat: true }), v * 1.0));
    // the drape: a cloth thrown over the urn, hanging down one side
    const dp = [[0.34, 0.2], [0.34, 0.47], [0.3, 0.62], [0.2, 0.7], [0.2, 0.75], [0.12, 0.86], [0.02, 0.91]].map(p => new THREE.Vector2(p[0], p[1]));
    let dr = new THREE.LatheGeometry(dp, 6, -1.1, 2.7); const q = dr.attributes.position; for (let i = 0; i < q.count; i++) if (q.getY(i) < 0.25) q.setY(i, 0.2 + (HD.hash2(Math.round(q.getX(i) * 40), Math.round(q.getZ(i) * 40), 7) - 0.3) * 0.3);
    dr = K.flat(dr); dr.translate(0, y, 0); P.put(st.m, K.tint(dr, v * 1.14));
    P.h = y + 0.9; return P; }
  // kerbed family plot: low kerb, corner posts with pyramid caps, iron rail with a gateway on the south side. Local centre = middle of the plot.
  function railRun(len, r, gap) { const P = [], t = 0.035, top = 0.6; P.push(K.box(0, top, -t / 2, len, top + t, t / 2), K.box(0, 0.24, -t / 2, len, 0.24 + t, t / 2));
    const n = Math.max(2, Math.round(len / 0.3)); for (let i = 1; i < n; i++) { if (r() < (gap || 0.05)) continue; const x = len * i / n; P.push(K.box(x - 0.017, 0.12, -0.017, x + 0.017, top + 0.12 + (i % 2 ? 0.06 : 0), 0.017)); }
    return K.tint(K.merge(P), 1.75); }
  function kerbPlot(r, o) { const P = Mon(), w = o.w, l = o.l, st = o.stone || pickStone(r, 0.7), kv = r.range(0.84, 0.98), ph = 0.84, pw = 0.26, hw = w / 2, hl = l / 2;
    for (const [x0, z0, x1, z1] of [[-hw, hl - 0.2, hw, hl], [-hw, -hl, hw, -hl + 0.2], [-hw, -hl + 0.2, -hw + 0.2, hl - 0.2], [hw - 0.2, -hl + 0.2, hw, hl - 0.2]]) P.put(M.stone, tone(K.box(x0, -0.3, z0, x1, 0.2, z1), kv * r.range(0.94, 1.04), 0.74, 0.2));
    const post = (x, z, h, k) => { const pv = st.v * r.range(0.94, 1.05), g = Mon().put(st.m, tone(K.boxc(0, -0.2, 0, pw, h + 0.2, pw), pv, 0.62, h), K.tint(K.boxc(0, h, 0, pw + 0.08, 0.06, pw + 0.08), pv * 1.05), K.tint(tbox(0, h + 0.06, 0, pw + 0.04, pw + 0.04, 0.03, 0.03, 0.17), pv * 1.1)); P.join(g, Object.assign({ x, z }, k || {})); };
    post(-hw + 0.1, -hl + 0.1, ph, { rz: r.range(-0.05, 0.05), rx: r.range(-0.04, 0.04) }); post(hw - 0.1, -hl + 0.1, ph, { rz: r.range(-0.05, 0.05) }); post(hw - 0.1, hl - 0.1, ph, { rz: r.range(-0.07, 0.07), rx: r.range(-0.05, 0.05) }); post(-hw + 0.1, hl - 0.1, ph, { rx: r.range(-0.05, 0.06) });
    post(-0.5, hl - 0.1, ph - 0.14, { rz: r.range(-0.04, 0.04) }); post(0.5, hl - 0.1, ph - 0.14, { rz: r.range(-0.08, 0.08) });                       // gate posts
    const run = (x, z, ry, len, k) => { if (k === 'gone') return; P.put(M.iron, K.xform(railRun(len, r, k === 'worn' ? 0.3 : 0.05), { x, z, ry, rx: k === 'lean' ? 0.4 : k === 'down' ? 1.45 : 0, y: k === 'down' ? 0.02 : 0 })); };
    const f = o.rails || {};
    run(-hw + 0.23, hl - 0.1, 0, hw - 0.23 - 0.63, f.s1); run(0.63, hl - 0.1, 0, hw - 0.23 - 0.63, f.s2);                 // south, either side of the gateway
    run(hw - 0.1, hl - 0.23, PI / 2, l - 0.46, f.e); run(hw - 0.23, -hl + 0.1, PI, w - 0.46, f.n); run(-hw + 0.1, -hl + 0.23, -PI / 2, l - 0.46, f.w);
    P.w = w; P.l = l; return P; }

  // ------------------------------------------------------------------------------------------------- focal monuments
  // the great ringed cross of the west plot: three steps, an inscribed die, a tall tapered shaft with a sunk panel, a ringed head with bosses
  function greatCross(r) { const P = Mon(), v = 1.02, m = M.sand, sw = [2.7, 2.1, 1.5]; let y = 0;
    for (let i = 0; i < 3; i++) { P.put(i === 0 ? M.stoneDark : M.stone, tone(K.boxc(r.range(-0.03, 0.03), i ? y : -0.5, r.range(-0.03, 0.03), sw[i], 0.27 + (i ? 0 : 0.5), sw[i] * 0.86, r.range(-0.035, 0.035)), 0.86 + i * 0.07, 0.74, 0.8)); y += 0.27; }
    P.put(m, tone(tbox(0, y, 0, 1.06, 0.9, 0.9, 0.76, 0.12), v * 0.9, 0.7, 5)); y += 0.12;
    P.put(m, tone(K.boxc(0, y, 0, 0.84, 0.62, 0.7), v * 0.86, 0.7, 5), K.tint(K.box(-0.31, y + 0.08, 0.35, 0.31, y + 0.54, 0.385), v * 1.0)); insV(P, r, -0.27, y + 0.11, 0.27, y + 0.51, 0.393); y += 0.62;
    P.put(m, tone(tbox(0, y, 0, 0.92, 0.78, 0.56, 0.42, 0.14), v * 0.98, 0.7, 5)); y += 0.14;
    const yc = 4.0, sw0 = 0.5, sw1 = 0.37, sd0 = 0.34, sd1 = 0.27, at = 0.37, ad = 0.27, span = 0.93, R = 0.76, Ri = 0.55;
    P.put(m, tone(tbox(0, y, 0, sw0, sd0, sw1, sd1, yc - y), v, 0.68, 5));
    const fr = t => [(sw0 + (sw1 - sw0) * t) / 2 - 0.075, (sd0 + (sd1 - sd0) * t) / 2 + 0.004, y + (yc - y) * t], a = fr(0.06), b = fr(0.82);
    P.put(m, K.tint(K.quad([-a[0], a[2], a[1]], [a[0], a[2], a[1]], [b[0], b[2], b[1]], [-b[0], b[2], b[1]]), v * 0.7));
    insQ(P, r, [-a[0] + 0.02, a[2] + 0.04, a[1] + 0.006], [a[0] - 0.02, a[2] + 0.04, a[1] + 0.006], [b[0] - 0.02, b[2] - 0.04, b[1] + 0.006], [-b[0] + 0.02, b[2] - 0.04, b[1] + 0.006], a[0] * 2 - 0.04, b[2] - a[2] - 0.08);
    P.put(m, tone(ext(circle(0, yc, R, 16), ad * 0.62, [circle(0, yc, Ri, 16)]), v * 0.92, 0.66, 5));
    P.put(m, tone(K.box(-span, yc - at / 2, -ad / 2, span, yc + at / 2, ad / 2), v * 1.04, 0.66, 5), tone(tbox(0, yc + at / 2 - 0.01, 0, at, ad, at * 0.97, ad, span - at / 2 + 0.01), v * 1.03, 0.66, 5));
    P.put(m, K.tint(K.merge([K.box(span - 0.02, yc - at / 2 - 0.05, -ad / 2 - 0.015, span + 0.1, yc + at / 2 + 0.05, ad / 2 + 0.015), K.box(-span - 0.1, yc - at / 2 - 0.05, -ad / 2 - 0.015, -span + 0.02, yc + at / 2 + 0.05, ad / 2 + 0.015), K.box(-at / 2 - 0.05, yc + span - 0.02, -ad / 2 - 0.015, at / 2 + 0.05, yc + span + 0.1, ad / 2 + 0.015)]), v * 1.1));
    const boss = (x, yy, s) => K.xform(K.lathe([[0.17 * s, 0], [0.15 * s, 0.05 * s], [0.08 * s, 0.1 * s], [0, 0.11 * s]], 8, { flat: true }), { rx: PI / 2, x, y: yy, z: ad / 2 });
    P.put(m, K.tint(K.merge([boss(0, yc, 1), boss(0.62, yc, 0.45), boss(-0.62, yc, 0.45), boss(0, yc + 0.62, 0.45), boss(0, yc - 0.66, 0.45)]), v * 1.16));
    P.put(M.moss, mossBlob(r, -0.9, 0.27, 0.75, 0.42), mossBlob(r, 0.75, 0.54, 0.5, 0.3), mossBlob(r, 1.0, 0.27, -0.5, 0.36));
    return P; }
  // the mourner: a hooded figure with bowed head and clasped hands holding a wreath, on a pedestal
  function statue(r) { const P = Mon(), st = { m: M.sand, v: 0.98 }, v = st.v, f0 = pedestal(P, r, st, { w: 1.0, dh: 1.0, top: 1.1 }), F = Mon(), V2 = p => new THREE.Vector2(p[0], p[1]);
    // the robe, fluted into folds toward the hem
    let robe = new THREE.LatheGeometry([[0.54, 0], [0.5, 0.1], [0.4, 0.55], [0.33, 1.0], [0.29, 1.25], [0.34, 1.46], [0.4, 1.6], [0.3, 1.7], [0.17, 1.76], [0.001, 1.78]].map(V2), 10);
    const q = robe.attributes.position; for (let i = 0; i < q.count; i++) { const y = q.getY(i); if (y < 1.25) { const k = Math.round(Math.atan2(q.getX(i), q.getZ(i)) / (PI / 5)); if (((k % 2) + 2) % 2 === 1) { const s = 1 - 0.24 * (1 - y / 1.25); q.setX(i, q.getX(i) * s); q.setZ(i, q.getZ(i) * s); } } }
    robe = K.flat(robe); robe.scale(1, 1, 0.8); F.put(M.sand, tone(robe, v, 0.7, 2.2));
    // a short cape over the shoulders
    let cape = K.flat(new THREE.LatheGeometry([[0.36, 1.3], [0.45, 1.34], [0.46, 1.5], [0.42, 1.62], [0.31, 1.71]].map(V2), 10)); cape.scale(1, 1, 0.84); F.put(M.sand, K.tint(cape, v * 1.05));
    // the bowed head inside a deep cowl: the front faces are cut away and a dark hollow shows inside
    const hp = [[0.2, -0.12], [0.27, 0.04], [0.29, 0.22], [0.25, 0.4], [0.15, 0.52], [0, 0.56]]; let hd = K.lathe(hp, 8, { flat: true, ry: PI / 8 });
    { const p = hd.attributes.position, keep = []; for (let i = 0; i < p.count; i += 3) { const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
        if (cz > 0 && Math.abs(cx) < 0.07 && cy > 0.04 && cy < 0.4) continue; for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); }
      hd = new THREE.BufferGeometry(); hd.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); hd.computeVertexNormals(); }
    const hood = Mon().put(M.sand, K.tint(hd, v * 1.05), K.tint(K.lathe(hp.map(q => [q[0] * 0.84, q[1] * 0.96]), 8, { flat: true, ry: PI / 8 }), 0.26));
    F.join(hood, { y: 1.67, z: 0.05, rx: 0.42 });
    // arms bent up in prayer, bell sleeves hanging from the forearms, the joined hands
    for (const sx of [-1, 1]) F.put(M.sand, K.tint(K.tube([[sx * 0.37, 1.53, 0.0], [sx * 0.43, 1.13, 0.12], [sx * 0.05, 1.4, 0.36]], [0.105, 0.07], 5, { flat: true }), v * (sx > 0 ? 1.04 : 0.95)), K.tint(tbox(sx * 0.27, 0.9, 0.24, 0.05, 0.06, 0.2, 0.15, 0.32), v * (sx > 0 ? 0.97 : 0.9)));
    F.put(M.sand, K.tint(K.xform(tbox(0, 0, 0, 0.13, 0.1, 0.05, 0.07, 0.24), { y: 1.36, z: 0.37, rx: 0.25 }), v * 1.1));
    F.put(M.moss, mossBlob(r, -0.32, 1.63, -0.04, 0.14));
    P.join(F, { y: f0 - 0.02, rx: 0.045 }); P.put(M.moss, mossBlob(r, 0.5, 0.42, 0.55, 0.3));
    P.put(M.moss, K.tint(K.xform(K.flat(new THREE.TorusGeometry(0.21, 0.055, 4, 9)), { rx: -0.28, x: 0.3, y: 0.66, z: 0.6 }), 1.0, 0.82, 0.6));        // a withered wreath laid against the pedestal
    P.h = f0 + 2.25; return P; }

  // ------------------------------------------------------------------------------------------ placement bookkeeping
  const occ = [], info = {};
  const free = (x, z, r) => { for (const o of occ) if (Math.hypot(x - o.x, z - o.z) < r + o.r) return false; return true; };
  const take = (x, z, r) => { occ.push({ x, z, r }); };
  const takeRect = (x, z, ex, ez) => { const rr = Math.min(ex, ez), n = Math.max(1, Math.ceil(Math.max(ex, ez) / rr)); for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) * 2 - 1) * (Math.max(ex, ez) - rr); take(x + (ex > ez ? t : 0), z + (ex > ez ? 0 : t), rr + 0.12); } };          // a row of circles covering a rectangle (half-extents ex, ez)
  const pathAbs = (x, z) => { const d = L.pathDist(x, z, info); return d * info.path.w; };                               // distance to the nearest path's centre line, in units
  const offPath = (x, z, r, k) => { k = k || 1.45; return L.pathDist(x, z) > k && L.pathDist(x - r, z) > k && L.pathDist(x + r, z) > k && L.pathDist(x, z - r) > k && L.pathDist(x, z + r) > k; };
  function inPlot(x, z, r) { if (Math.abs(x) + r > 25.9 || z + r > -11.5 || Math.abs(x) - r < 3.5) return false;
    if (x < 0) return z - r > -28;
    if (z - r < -56) return false; if (x - r < 11.5 && z - r < -28.5) return false;
    if (x + r > 18.8 && x - r < 24.2 && z + r > -20.9 && z - r < -14.3) return false;                                    // the mausoleum and its steps
    return true; }
  const siteOK = (x, z, r) => inPlot(x, z, r) && offPath(x, z, r) && free(x, z, r);
  // tallest thing allowed here without hiding the hero on a path to the north of it (the camera looks north and down)
  function maxH(x, z) { let m = 9; for (let dz = 0.4; dz <= 9; dz += 0.4) for (const dx of [-0.5, 0, 0.5]) if (L.pathDist(x + dx, z - dz) < 1) m = Math.min(m, dz < 1.3 ? 1.3 : dz < 4 ? 2.2 : 2.2 + (dz - 4) * 0.72); return m; }
  const grass = (r, x, z, rad, n, kind) => { if (L.pathDist(x, z) > 1.3) ctx.plant('grass', { x, z, r: rad, n, kind: kind || (r() < 0.6 ? 'tall' : 'weed'), seed: r.int(1, 99999) }); };
  const dbg = ctx.query && ctx.query.has('gvdebug');
  const chk = (name, x, z, r, h) => { if (!dbg) return; if (!inPlot(x, z, r)) console.warn('graveyard: ' + name + ' outside its plot'); if (!offPath(x, z, r)) console.warn('graveyard: ' + name + ' too close to a path'); if (h && h > maxH(x, z)) console.warn('graveyard: ' + name + ' too tall (' + h.toFixed(1) + ' > ' + maxH(x, z).toFixed(1) + ')'); if (!free(x, z, r * 0.8)) console.warn('graveyard: ' + name + ' overlaps at ' + x + ',' + z); };

  // candle stub with a flame, or a little iron grave lantern
  function candle(r, x, y, z) { const hh = r.range(0.12, 0.22); B.add(M.sand, K.tint(K.lathe([[0.045, 0], [0.04, hh], [0, hh]], 5, { x, y, z }), 1.3)); B2.add(M.lampGlass, K.lathe([[0, 0], [0.024, 0.03], [0, 0.1]], 4, { x, y: y + hh + 0.01, z }));
    ctx.glow({ x, y: y + hh + 0.08, z: z + 0.03, color: '#ffc070', size: 1.1, strength: 0.8, flicker: 0.2 }); }
  function graveLamp(x, y, z) { const pts = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(K.boxc(x + sx * 0.08, y + 0.04, z + sz * 0.08, 0.025, 0.26, 0.025));
    B.add(M.iron, K.tint(K.merge([K.boxc(x, y, z, 0.22, 0.04, 0.22), K.boxc(x, y + 0.3, z, 0.22, 0.03, 0.22), K.spire({ x, y: y + 0.33, z, r: 0.15, h: 0.13 })].concat(pts)), 1.7));
    B2.add(M.lampGlass, K.boxc(x, y + 0.05, z, 0.14, 0.24, 0.14)); ctx.glow({ x, y: y + 0.18, z: z + 0.05, color: '#ffb060', size: 1.6, strength: 0.95, flicker: 0.12 }); }

  // ------------------------------------------------------------------------------------------------- one lay grave
  // layGrave(r, x, z, {kind, ry}): pick a monument that fits the site, lean and sink it, and dress the grave (mound, footstone, weeds)
  function layGrave(r, x, z, o) { o = o || {}; const lim = maxH(x, z), ry = (o.ry === undefined ? 0.1 : o.ry) + r.range(-0.22, 0.22), fx = Math.sin(ry), fz = Math.cos(ry), gy = L.terrain(x, z);
    let k = o.kind; if (!k) { const u = r(); k = u < 0.42 ? 'head' : u < 0.51 ? 'latin' : u < 0.58 ? 'ring' : u < 0.7 ? 'coped' : u < 0.77 ? 'ledger' : u < 0.87 ? 'snapped' : 'fallen'; }
    if (!o.kind && lim <= 2.2 && (k === 'ring' || k === 'latin') && r() < 0.75) k = r() < 0.6 ? 'coped' : 'ledger';
    const low = lim < 1.4; if (low && (k === 'latin' || k === 'ring')) k = 'coped';                      // right at the south edge of a path: only low things
    if (k === 'ring' && (lim < 3.4 || !offPath(x, z, 0.9) || !free(x, z, 0.85))) k = lim > 2.6 ? 'latin' : 'head';
    const southFree = d => offPath(x + fx * d, z + fz * d, 0.5, 1.45) && free(x + fx * d, z + fz * d, 0.42) && z + fz * d < -11.9;
    const northFree = d => free(x - fx * d, z - fz * d, 0.5) && inPlot(x - fx * d, z - fz * d, 0.55) && offPath(x - fx * d, z - fz * d, 0.6);
    const sd = southFree(1.0) && southFree(1.9) ? 1 : northFree(1.0) && northFree(1.9) ? -1 : 0;          // which way a long slab can lie from here
    if ((k === 'coped' || k === 'ledger') && !sd) k = 'head';
    if (k === 'fallen' && !northFree(1.0) && !southFree(1.0)) k = 'head';
    const bad = r() < 0.14, rx = bad ? r.range(-0.32, 0.2) : r.range(-0.075, 0.06), rz = bad ? r.range(-0.3, 0.3) : r.range(-0.085, 0.085), sink = r.range(0, 0.1) + (bad ? 0.12 : 0);
    let st = null, upright = true, w = 0.9;
    if (k === 'head') { st = pickStone(r); let u = o.small || low ? 0 : r(); if (lim <= 2.2 && u >= 0.15 && u < 0.3) u = 0.5; const ho = { stone: st };
      if (u < 0.15) Object.assign(ho, { w: r.range(0.5, 0.66), h: r.range(0.62, 0.9), d: r.range(0.14, 0.18), relief: r.pick(['cross', 'plain', 'proud', 'roundel']), base: false });                 // a child's stone
      else if (u < 0.3) Object.assign(ho, { w: r.range(1.08, 1.3), h: r.range(1.7, 2.02), d: r.range(0.25, 0.32), relief: r.pick(['panelCross', 'panel', 'roundel', 'panelCross']) });               // a rich man's slab
      const P = headstone(r, ho); w = P.w; const u2 = r();
      if (u2 < 0.1) P.put(M.moss, K.tint(K.xform(K.flat(new THREE.TorusGeometry(0.2, 0.05, 4, 8)), { rx: -0.3, x: r.range(-0.12, 0.12), y: 0.27, z: P.d / 2 + 0.1 }), 1.0, 0.82, 0.6));                 // a withered wreath
      else if (u2 < 0.2) P.put(M.stoneDark, K.tint(K.lathe([[0.05, 0], [0.085, 0.06], [0.075, 0.15], [0.04, 0.18], [0.06, 0.21], [0, 0.21]], 6, { x: r.sign() * w * 0.3, y: 0.03, z: P.d / 2 + 0.2, flat: true }), 1.2));    // a jar for flowers
      place(P, { x, z, ry, rx, rz, sink }); ctx.block.circle(x, z, w / 2 + 0.05); }
    else if (k === 'latin') { st = pickStone(r, 0.5); const P = latinCross(r, { stone: st, h: Math.min(lim - 0.1, r.range(1.5, 2.3)), caps: r() < 0.4 }); w = 0.7; place(P, { x, z, ry, rx, rz, sink }); ctx.block.circle(x, z, 0.3); }
    else if (k === 'ring') { st = pickStone(r, 0.65); const P = ringCross(r, { stone: st, h: Math.min(lim - 0.2, r.range(2.4, 3.1)) }); w = P.base; place(P, { x, z, ry, rx: rx * 0.4, rz: rz * 0.4, sink: sink * 0.4 }); ctx.block.circle(x, z, P.base * 0.5); }
    else if (k === 'coped' || k === 'ledger') { upright = false; const P = k === 'coped' ? coped(r) : ledger(r), c = (P.l / 2 + 0.05) * sd, gx = fx * sd, gz = fz * sd; place(P, { x: x + fx * c, z: z + fz * c, ry, rx: r.range(-0.03, 0.03), rz: r.range(-0.05, 0.05), sink: r.range(0, 0.05) });
      ctx.block.seg(x + gx * 0.2, z + gz * 0.2, x + gx * (P.l - 0.1), z + gz * (P.l - 0.1), P.w / 2); take(x + gx * 1.4, z + gz * 1.4, 0.55); w = P.w; }
    else if (k === 'snapped') { const S = snappedStone(r); w = S.w; place(S.stump, { x, z, ry, rx: rx * 0.6, rz: rz * 0.6 }); ctx.block.circle(x, z, w / 2 + 0.05);
      B.add(M.stonePlain, K.tint(K.rubble({ x: x + r.range(-0.3, 0.3), z: z + 0.1, n: 3, spread: 0.55, size: [0.1, 0.22], seed: r.int(1, 9999), y: (a, b) => L.terrain(a, b) }), r.range(0.8, 1)));
      if (r() < 0.55 && northFree(0.9)) { place(S.top, { x: x - fx * 0.3 + r.range(-0.15, 0.15), z: z - fz * 0.3, y: gy + S.d / 2 - 0.04, rx: -PI / 2 + r.range(0, 0.09), ry: ry + r.range(-0.5, 0.5) }); take(x - fx * 0.9, z - fz * 0.9, 0.45); }
      else if (southFree(0.9)) { place(S.top, { x: x + fx * 0.32 + r.range(-0.15, 0.15), z: z + fz * 0.32, y: gy + S.d / 2 - 0.03, rx: PI / 2 - r.range(0, 0.08), ry: ry + r.range(-0.45, 0.45) }); take(x + fx * 0.9, z + fz * 0.9, 0.5); upright = false; }
      else place(S.top, { x: x + r.sign() * (w * 0.5 + 0.34), z: z + 0.08, y: gy + 0.1, rx: -0.2, rz: r.sign() * 1.25, ry: ry }); }                // propped on edge beside the stump
    else { upright = false; st = pickStone(r); const P = headstone(r, { stone: st, cut: true, base: false }); w = P.w;                                 // fallen flat: on its back behind its socket, or on its face over the grave
      B.add(M.stone, K.tint(K.chunk({ x, y: gy - 0.1, z, w: w + 0.2, h: 0.34, d: 0.5, seed: r.int(1, 9999), ry: ry, rx: 0.05, rz: 0.04 }), r.range(0.8, 1))); ctx.block.circle(x, z, 0.4);
      if (northFree(1.0)) { place(P, { x: x - fx * 0.32, z: z - fz * 0.32, y: gy + P.d / 2 - 0.05, rx: -PI / 2 + r.range(0, 0.07), ry: ry + r.range(-0.4, 0.4) }); take(x - fx * 1.0, z - fz * 1.0, 0.55); ctx.block.circle(x - fx * 0.95, z - fz * 0.95, 0.45); }
      else { place(P, { x: x + fx * 0.36, z: z + fz * 0.36, y: gy + P.d / 2 - 0.04, rx: PI / 2 - r.range(0, 0.07), ry: ry + r.range(-0.35, 0.35) }); take(x + fx * 1.0, z + fz * 1.0, 0.55); ctx.block.circle(x + fx * 0.95, z + fz * 0.95, 0.45); } }
    take(x, z, 0.62); count(k);
    if (upright && !o.small && r() < 0.5 && southFree(1.05)) { const mx = x + fx * 1.08, mz = z + fz * 1.08; mound(r, mx, mz, r.range(0.38, 0.5), r.range(0.76, 0.92), r.range(0.1, 0.18), r() < 0.7, ry); take(mx, mz, 0.32);
      if (st && r() < 0.4 && southFree(2.05)) { const F = footstone(r, st), px = x + fx * 2.08, pz = z + fz * 2.08; place(F, { x: px, z: pz, ry, rx: r.range(-0.15, 0.15), rz: r.range(-0.12, 0.12) }); ctx.block.circle(px, pz, 0.24); take(px, pz, 0.3); } }
    if (r() < 0.36) B.add(M.moss, K.xform(mossBlob(r, r.range(-w * 0.4, w * 0.4), 0.03, r.range(0.12, 0.28), r.range(0.2, 0.34)), { x, y: gy, z, ry }));
    if (r() < 0.62) grass(r, x + r.range(-0.3, 0.3), z - 0.12 + r.range(-0.15, 0.3), 0.55, r.int(3, 6));
    return k; }
  // one monk's grave: a small plain cross (some fallen, some leaning, a few of iron), a low mound
  function monkGrave(r, x, z) { const u = r(), ry = 0.06 + r.range(-0.07, 0.07), gy = L.terrain(x, z), kind = u < 0.09 ? 'none' : u < 0.2 ? 'fallen' : u < 0.29 ? 'iron' : 'cross', mh = r.range(0.08, 0.14);
    const stone = { m: r() < 0.45 ? M.sand : M.stonePlain, v: r.range(0.74, 0.98) }, h = r.range(1.15, 1.5);
    if (r() < 0.75) mound(r, x + 0.02, z + 0.98, r.range(0.34, 0.42), r.range(0.72, 0.85), mh, r() < 0.7, ry);
    if (kind === 'cross') { const bad = r() < 0.16; place(latinCross(r, { h, base: r() < 0.3, stone, roof: r() < 0.3 }), { x, z, ry, rx: bad ? r.range(-0.3, 0.25) : r.range(-0.05, 0.05), rz: bad ? r.range(-0.3, 0.3) : r.range(-0.06, 0.06), sink: r.range(0, 0.08) }); ctx.block.circle(x, z, 0.26); }
    else if (kind === 'iron') { place(ironCross(r), { x, z, ry, rx: r.range(-0.06, 0.06), rz: r.range(-0.1, 0.1) }); ctx.block.circle(x, z, 0.22); }
    else if (kind === 'fallen') { B.add(M.stone, K.tint(K.chunk({ x, y: gy - 0.08, z, w: 0.42, h: 0.3, d: 0.36, seed: r.int(1, 9999), ry }), r.range(0.8, 1)));
      place(latinCross(r, { h, base: false, cut: true, stone }), { x: x + r.range(-0.1, 0.1), z: z + 0.3, y: gy + 0.1 + mh * 0.5, rx: PI / 2 - 0.12, ry: ry + r.range(-0.6, 0.6) }); ctx.block.circle(x, z + 0.5, 0.45); }
    take(x, z, 0.6); if (kind !== 'none') count('monk-' + kind);
    if (r() < 0.45) grass(r, x + r.range(-0.2, 0.2), z + r.range(-0.2, 0.2), 0.4, r.int(2, 4)); }

  // =================================================================================================== THE MAUSOLEUM
  (function mausoleum() { const x0 = 19.4, x1 = 23.6, zs = -15.9, zn = -20.3, cx = 21.5, py = 0.5, wh = 3.0, rise = 2.6, t = 0.5, k = rise / 2.1, r = ctx.rng(4107);
    // stepped plinth, the landing before the door and one step down to the path
    B.add(M.stoneDark, K.tint(K.box(x0 - 0.3, -0.6, zn - 0.3, x1 + 0.3, 0.25, zs + 0.3), 0.86), K.tint(K.box(x0 - 0.15, 0.25, zn - 0.15, x1 + 0.15, py, zs + 0.15), 0.98));
    B.add(M.sand, K.tint(K.box(20.5, -0.4, zs + 0.15, 22.5, py, -15.25), 0.8), K.tint(K.box(20.38, -0.4, -15.3, 22.62, 0.25, -14.7), 0.72));
    ctx.floor(20.5, zs, 22.5, -15.25, py); ctx.floor(20.38, -15.25, 22.62, -14.7, 0.25);
    ctx.block.rect(x0 - 0.3, zn - 0.3, 20.5, zs + 0.3); ctx.block.rect(22.5, zn - 0.3, x1 + 0.3, zs + 0.3); ctx.block.rect(20.5, zn - 0.3, 22.5, zs);
    take(cx, -18, 3.4);
    // ---- south (door) front: two leaves of wall so the doorway steps back in two orders
    const W = K.wall([x0, zs - t / 2], [x1, zs - t / 2], py), top = [[0, wh + 0.3], [2.1, wh + rise + 0.3], [4.2, wh + 0.3]];
    const dw = 1.24, sp = 1.5, dr = 1.03, qy = wh + 0.92;
    const quatre = (qx, qyy, a, b, n) => { const pts = []; for (let i = 0; i < n; i++) { const tt = i / n * PI * 2; let R = 0; for (let j = 0; j < 4; j++) { const ca = Math.cos(j * PI / 2) * a, sa = Math.sin(j * PI / 2) * a, cd = ca * Math.cos(tt) + sa * Math.sin(tt), s = cd + Math.sqrt(cd * cd + b * b - a * a); if (s > R) R = s; } pts.push([qx + Math.cos(tt) * R, qyy + Math.sin(tt) * R]); } return pts; };
    B.add(M.stone, W.solid({ t: 0.22, w: 0.14, top, holes: [K.arch(2.1, 0, dw, sp, dr, 0.2), quatre(2.1, qy, 0.22, 0.25, 24)] }), K.tint(W.solid({ t: 0.28, w: -0.11, top, holes: [K.arch(2.1, 0, dw, sp, dr), quatre(2.1, qy, 0.22, 0.25, 24)] }), 0.8));
    B.add(M.void, W.pane(2.1, 0, dw, sp, dr, { at: -0.22 }), W.put(K.quad([1.5, qy - 0.6, -0.2], [2.7, qy - 0.6, -0.2], [2.7, qy + 0.6, -0.2], [1.5, qy + 0.6, -0.2])));
    // mouldings: outer order, hood mould with label stops, inner roll, jamb shafts, threshold
    B.add(M.sand, K.tint(W.archTrim(2.1, 0, dw, sp, dr, { band: 0.17, depth: 0.1, at: 0.25, inset: 0.2 }), 1.02), K.tint(W.archTrim(2.1, sp - 0.06, dw, sp, dr, { band: 0.1, depth: 0.17, at: 0.25, inset: 0.37 }), 1.1),
      K.tint(W.box(2.1 - 1.14, 2.1 - 0.92, sp - 0.24, sp - 0.04, 0.25, 0.44), 1.05), K.tint(W.box(2.1 + 0.92, 2.1 + 1.14, sp - 0.24, sp - 0.04, 0.25, 0.44), 1.05),
      K.tint(W.archTrim(2.1, 0, dw, sp, dr, { band: 0.09, depth: 0.07, at: 0.03 }), 0.92), K.tint(W.box(2.1 - 0.84, 2.1 + 0.84, -0.02, 0.07, 0.0, 0.3), 0.9));
    const shaft = [[0.1, 0], [0.1, 0.1], [0.065, 0.16], [0.065, sp - 0.2], [0.11, sp - 0.07], [0.11, sp]];
    for (const s of [-1, 1]) B.add(M.sand, K.tint(W.put(K.lathe(shaft, 6, { x: 2.1 + s * (dw / 2 + 0.1), y: 0, z: 0.13 })), 1.06));
    // quatrefoil plate in the gable
    B.add(M.sand, K.tint(W.put(ext(circle(2.1, qy, 0.62, 16), 0.1, [quatre(2.1, qy, 0.2, 0.225, 24)], 0.22)), 1.04));
    // plinth course, string course under the gable, kneelers, coping along the rake, apex stone and the gable cross
    B.add(M.stoneDark, K.tint(W.box(-0.06, 4.26, 0, 0.3, 0.25, 0.33), 1.05));
    B.add(M.sand, K.tint(W.box(0.58, 3.62, wh - 0.17, wh, 0.25, 0.33), 0.94), K.tint(W.box(-0.32, 0.18, wh - 0.16, wh + 0.52, -0.31, 0.33), 0.98), K.tint(W.box(4.02, 4.52, wh - 0.16, wh + 0.52, -0.31, 0.33), 0.98));
    const cop = [[-0.3, wh - 0.3 * k + 0.2], [2.1, wh + rise + 0.2], [4.5, wh - 0.3 * k + 0.2], [4.5, wh - 0.3 * k + 0.52], [2.1, wh + rise + 0.52], [-0.3, wh - 0.3 * k + 0.52]];
    B.add(M.sand, K.tint(W.put(ext(cop, 0.62)), 1.0), K.tint(W.box(1.88, 2.32, wh + rise + 0.36, wh + rise + 0.74, -0.2, 0.2), 1.04));
    const gc = wh + rise + 0.74, gcr = [W.box(2.03, 2.17, gc, gc + 0.9, -0.06, 0.06), W.box(1.8, 2.4, gc + 0.5, gc + 0.63, -0.055, 0.055), W.put(ext(circle(2.1, gc + 0.565, 0.24, 10), 0.08, [circle(2.1, gc + 0.565, 0.16, 10)]))];
    B.add(M.sand, K.tint(K.merge(gcr), 1.08));
    for (const u of [-0.07, 4.27]) B.add(M.sand, K.tint(W.put(K.boxc(u, wh + 0.52, 0.01, 0.34, 0.32, 0.4)), 1.0), K.tint(W.put(K.boxc(u, wh + 0.84, 0.01, 0.44, 0.07, 0.5)), 1.08), K.tint(W.put(K.spire({ x: u, y: wh + 0.91, z: 0.01, r: 0.27, h: 0.64 })), 1.05));      // pinnacles on the kneelers
    // corner buttresses with wider feet
    const bst = [[0.42, 1.7], [0.24, 2.72]];
    for (const u of [0.3, 3.9]) { B.add(M.stone, W.buttress(u, { width: 0.56, face: 0.25, stages: bst })); B.add(M.stoneDark, K.tint(W.box(u - 0.34, u + 0.34, 0, 0.3, 0.25, 0.75), 1.05)); B.add(M.sand, K.tint(W.box(u - 0.31, u + 0.31, 1.66, 1.74, 0.25, 0.7), 0.95)); }
    // iron grille: the west leaf shut, the east leaf standing ajar
    const Rg = (0.62 * 0.62 + dr * dr) / dw, cg = Rg - 0.62, headAt = u => sp + Math.sqrt(Math.max(0, Rg * Rg - Math.pow(Math.abs(u - 2.1) + cg, 2)));
    const leaf = (hinge, dir) => { const g = [], lw = 0.6; for (let i = 0; i <= 5; i++) { const x = 0.025 + i * (lw - 0.05) / 5, tp = Math.max(0.4, headAt(hinge + dir * x) - 0.07), th = i === 0 || i === 5 ? 0.05 : 0.03; g.push(K.box(x - th / 2, 0.05, -th / 2, x + th / 2, tp, th / 2)); }
      for (const y of [0.1, 0.95, 1.45]) g.push(K.box(0, y, -0.02, lw, y + 0.045, 0.02)); return K.merge(g); };
    B.add(M.iron, K.tint(W.put(K.xform(leaf(1.5, 1), { x: 1.5, z: -0.12 })), 1.9), K.tint(W.put(K.xform(leaf(2.7, -1), { x: 2.7, z: -0.12, ry: PI + 0.85 })), 2.1));
    // ---- side and back walls
    const WW = K.wall([x0 + t / 2, zn], [x0 + t / 2, zs - t], py), slit = [2.0, 1.2, 0.36, 2.05, 0.36];
    B.add(M.stone, WW.solid({ t, h: wh, holes: [K.arch(...slit)] }), WW.buttress(0.32, { width: 0.56, face: 0.25, stages: bst }), WW.buttress(4.1, { width: 0.56, face: 0.25, stages: bst }));
    B.add(M.void, WW.pane(...slit, { at: -0.05 }));
    B.add(M.sand, K.tint(WW.archTrim(...slit, { band: 0.11, depth: 0.07, at: 0.25 }), 1.02), K.tint(WW.box(1.66, 2.34, 1.1, 1.2, 0.25, 0.36), 1.0), K.tint(WW.box(0, WW.L, wh - 0.15, wh, 0.25, 0.33), 0.94));
    B.add(M.stoneDark, K.tint(WW.box(0, WW.L + 0.5, 0, 0.3, 0.25, 0.33), 1.05), K.tint(WW.box(-0.02, 0.66, 0, 0.3, 0.25, 0.75), 1.05), K.tint(WW.box(3.76, 4.44, 0, 0.3, 0.25, 0.75), 1.05));
    const WE = K.wall([x1 - t / 2, zs - t], [x1 - t / 2, zn], py);
    B.add(M.stone, WE.solid({ t, h: wh }), WE.buttress(-0.2, { width: 0.56, face: 0.25, stages: bst }), WE.buttress(3.58, { width: 0.56, face: 0.25, stages: bst }));
    B.add(M.sand, K.tint(WE.box(0, WE.L, wh - 0.15, wh, 0.25, 0.33), 0.94)); B.add(M.stoneDark, K.tint(WE.box(-0.5, WE.L, 0, 0.3, 0.25, 0.33), 1.05));
    const WN = K.wall([x1, zn + t / 2], [x0, zn + t / 2], py); B.add(M.stone, WN.solid({ t, top })); B.add(M.sand, K.tint(WN.put(ext(cop, 0.62)), 0.95));
    // ---- roof: steep slate, ridge north-south, a stone ridge roll
    B.add(M.slate, K.gable({ x0, x1, z0: zn + 0.68, z1: zs - 0.68, y: py + wh, rise, over: 0.28, thick: 0.2, axis: 'z' }));
    B.add(M.sand, K.tint(K.box(cx - 0.08, py + wh + rise - 0.04, zn + 0.4, cx + 0.08, py + wh + rise + 0.1, zs - 0.4), 0.95));
    // ---- the lamp in its bracket beside the door
    const lx = x0 + 0.78, ly = py + 2.0, lz = zs + 0.42;
    B.add(M.iron, K.tint(K.merge([K.box(lx - 0.03, ly + 0.5, zs, lx + 0.03, ly + 0.56, lz + 0.06), K.tube([[lx, ly + 0.14, zs + 0.02], [lx, ly + 0.3, zs + 0.2], [lx, ly + 0.5, lz - 0.04]], 0.02, 4), K.box(lx - 0.012, ly + 0.4, lz - 0.012, lx + 0.012, ly + 0.52, lz + 0.012),
      K.boxc(lx, ly + 0.02, lz, 0.24, 0.035, 0.24), K.boxc(lx, ly + 0.32, lz, 0.25, 0.03, 0.25), K.spire({ x: lx, y: ly + 0.35, z: lz, r: 0.17, h: 0.12 }),
      K.boxc(lx - 0.095, ly + 0.05, lz - 0.095, 0.025, 0.28, 0.025), K.boxc(lx + 0.095, ly + 0.05, lz - 0.095, 0.025, 0.28, 0.025), K.boxc(lx - 0.095, ly + 0.05, lz + 0.095, 0.025, 0.28, 0.025), K.boxc(lx + 0.095, ly + 0.05, lz + 0.095, 0.025, 0.28, 0.025)]), 1.9));
    B2.add(M.lampGlass, K.boxc(lx, ly + 0.055, lz, 0.165, 0.265, 0.165));
    ctx.light({ x: lx + 0.25, y: ly + 0.1, z: lz + 0.55, color: '#ffb060', intensity: 1.55, distance: 10, flicker: 0.1 });
    ctx.glow({ x: lx, y: ly + 0.18, z: lz + 0.1, color: '#ffb060', size: 2.6, strength: 1.25 });
    // weathering: moss on the plinth, a fallen coping stone and slates at the foot, ivy
    B.add(M.moss, mossBlob(r, x0 - 0.1, 0.25, -17.2, 0.4), mossBlob(r, x0 + 0.5, py, zs + 0.2, 0.3), mossBlob(r, x1 - 0.3, 0.25, zs + 0.24, 0.36), mossBlob(r, 20.6, 0.25, -14.86, 0.22));
    B.add(M.sand, K.tint(K.chunk({ x: 23.3, y: 0, z: -15.15, w: 0.6, h: 0.3, d: 0.4, seed: 8 }), 0.85)); B.add(M.stone, K.tint(K.rubble({ x: 24.5, z: -16.4, n: 5, spread: 0.7, size: [0.16, 0.34], seed: 12, y: (x, z) => L.terrain(x, z) }), 0.9));
    ctx.plant('ivy', { x: x0 - 0.02, y: py + 1.5, z: -18.9, nx: -1, nz: 0, w: 2.4, h: 2.8, density: 0.8, seed: 31 });
    ctx.plant('ivy', { x: 23.08, y: py + 1.6, z: zs + 0.02, nx: 0, nz: 1, w: 0.9, h: 3.0, density: 0.7, seed: 32 });
    ctx.plant('ivy', { x: x1 + 0.02, y: py + 1.3, z: -18.2, nx: 1, nz: 0, w: 2.6, h: 2.4, density: 0.6, seed: 33 });
    ctx.spot({ id: 'mausoleum', x: 21.5, z: -14.4, r: 1.1, label: '封じられた霊廟', kind: 'read' });
    count('mausoleum');
  })();

  // ================================================================================================== TREES (first: they claim their ground)
  const TREES = [['dead', -15.0, -14.0, 6.2, 0.06], ['dead', -23.4, -26.6, 5.6, -0.08], ['dead', 8.4, -27.0, 6.0, 0.05], ['dead', 13.7, -45.4, 5.8, -0.05],
    ['cypress', -24.6, -13.5, 7.8, 0], ['cypress', -24.9, -21.4, 6.8, 0.02], ['cypress', 25.1, -22.8, 7.8, -0.02], ['cypress', 23.2, -32.5, 7.4, 0]];
  TREES.forEach((t, i) => { ctx.plant('tree', { x: t[1], z: t[2], kind: t[0], h: t[3], lean: t[4], seed: 700 + i * 13 }); chk('tree' + i, t[1], t[2], 0.5); ctx.block.circle(t[1], t[2], t[0] === 'dead' ? 0.5 : 0.4); take(t[1], t[2], t[0] === 'dead' ? 1.0 : 1.2);
    if (t[0] === 'dead') ctx.plant('leaves', { x: t[1] + 0.4, z: t[2] + 0.6, r: 2.6, n: 26, kind: 'dry' }); });

  // a low broken kerb marks off the monks' plot from the lay graves
  { const r = ctx.rng(733), zk = -33.7; for (const [xa, xb] of [[12.0, 17.2], [21.3, 25.8]]) { let x = xa; while (x < xb - 0.5) { const len = Math.min(xb - x, r.range(0.8, 1.5)); if (r() < 0.86) { const z = zk + r.range(-0.06, 0.06), h = r.range(0.24, 0.4);
          B.add(M.stone, tone(K.xform(K.boxc(0, -0.3, 0, len - 0.04, h + 0.3, 0.32), { x: x + len / 2, y: L.terrain(x + len / 2, z), z, ry: r.range(-0.05, 0.05), rz: r.range(-0.04, 0.04), rx: r.range(-0.08, 0.08) }), r.range(0.8, 1.0), 0.75, 0.3));
          ctx.block.seg(x + 0.1, z, x + len - 0.1, z, 0.18); take(x + len * 0.25, z, 0.3); take(x + len * 0.75, z, 0.3); if (r() < 0.4) B.add(M.moss, mossBlob(r, x + len / 2, L.terrain(x, z) + h - 0.02, z, 0.2)); }
        else if (r() < 0.6) B.add(M.stone, K.tint(K.chunk({ x: x + len / 2, y: L.terrain(x, zk), z: zk + r.range(-0.4, 0.5), w: len * 0.6, h: 0.26, d: 0.3, seed: r.int(1, 999) }), 0.88));
        x += len; } } }

  // ============================================================================================ HAND-PLACED MONUMENTS
  const R = ctx.rng(20811);
  // --- west plot: the great cross where the west path leaves the approach
  { const x = -10.0, z = -17.2, gy = L.terrain(x, z); chk('greatCross', x, z, 1.5); place(greatCross(R), { x, z, ry: 0.14, rz: -0.035, rx: 0.02 }); ctx.block.rect(x - 1.4, z - 1.2, x + 1.4, z + 1.25); take(x, z, 2.0); count('greatCross');
    candle(R, x + 0.72, gy + 0.27, z + 1.0); candle(R, x + 0.95, gy + 0.27, z + 0.82); candle(R, x - 0.5, gy + 0.54, z + 0.83);
    B.add(M.stone, K.tint(K.chunk({ x: x - 1.75, y: gy, z: z + 0.9, w: 0.5, h: 0.24, d: 0.36, seed: 41 }), 0.9)); grass(R, x - 1.5, z - 0.4, 0.8, 6); grass(R, x + 1.6, z + 0.2, 0.7, 5); }
  // kerbed family plots (helper): the kerb with its stones inside
  function family(x, z, w, l, ry, rails, inside) { chk('family', x, z, Math.max(w, l) / 2); const P = kerbPlot(R, { w, l, rails });
    for (const it of inside) { const o = { x: it[1], z: it[2], ry: R.range(-0.1, 0.1), rx: R.range(-0.08, 0.06), rz: R.range(-0.1, 0.1), y: -R.range(0, 0.08) };
      if (it[0] === 'head') P.join(headstone(R, it[3] || {}), o); else if (it[0] === 'ring') P.join(ringCross(R, Object.assign({ steps: 1 }, it[3])), Object.assign(o, { rx: o.rx * 0.4, rz: o.rz * 0.4 }));
      else if (it[0] === 'coped') P.join(coped(R, it[3]), Object.assign(o, { rx: 0, rz: 0.02, y: 0 })); else if (it[0] === 'ledger') P.join(ledger(R, it[3]), Object.assign(o, { rx: 0, rz: -0.02, y: 0 }));
      else if (it[0] === 'mound') P.put(it[3] ? M.moss : M.earth, K.tint(K.xform(moundG(R, 0.42, 0.8, 0.15), { x: it[1], y: -0.02, z: it[2] }), it[3] ? 1.25 : 0.6));
      if (it[0] !== 'mound') count(it[0]); }
    place(P, { x, z, ry }); const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), ex = (w * c + l * s) / 2, ez = (w * s + l * c) / 2; ctx.block.rect(x - ex, z - ez, x + ex, z + ez); takeRect(x, z, ex, ez); count('family'); }
  family(-6.1, -14.2, 3.4, 2.9, 0.06, { s2: 'lean', e: 'worn' }, [['head', -0.85, -0.85, { style: 'gothic', h: 1.5, relief: 'panelCross' }], ['head', 0.05, -0.9, { style: 'round', h: 1.15, w: 0.7 }], ['head', 0.92, -0.85, { style: 'shoulder', h: 1.4 }], ['coped', 0.9, 0.35, { l: 1.5, head: false }], ['mound', -0.85, 0.3, 1]]);
  graveLamp(-6.1 - 0.02, L.terrain(-6.1, -13.4), -13.55);
  family(7.1, -14.3, 3.7, 2.9, -0.05, { s1: 'down', n: 'worn' }, [['ring', -1.0, -0.8, { h: 2.1 }], ['head', 0.15, -0.9, { style: 'pointed', h: 1.5, relief: 'panel' }], ['head', 1.15, -0.85, { style: 'round', h: 1.2 }], ['ledger', 0.15, 0.3, { l: 1.45 }], ['mound', 1.15, 0.3, 0]]);
  // chest and table tombs
  function tomb(kind, x, z, ry, o) { const P = kind === 'table' ? tableTomb(R) : chest(R, o); chk(kind, x, z, 1.0, P.h); place(P, { x, z, ry, rx: R.range(-0.025, 0.025), rz: R.range(-0.035, 0.035), sink: R.range(0, 0.06) });
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), ex = (P.l * c + P.w * s) / 2 + 0.15, ez = (P.l * s + P.w * c) / 2 + 0.15; ctx.block.rect(x - ex, z - ez, x + ex + (P.ext || 0), z + ez); takeRect(x, z, ex + 0.1, ez + 0.1); if (P.ext) take(x + ex + 0.8, z, 1.0); count(kind + (o && o.open ? '-open' : '')); grass(R, x - P.l / 2 - 0.2, z - 0.2, 0.5, 4); grass(R, x + P.l / 2 + 0.1, z + 0.3, 0.5, 4); return P; }
  { const P = tomb('chest', -5.6, -19.7, 0.07); candle(R, -5.6 - 0.5, L.terrain(-5.6, -19.7) + P.h + 0.0, -19.7 + 0.25); }
  tomb('chest', -13.1, -22.0, -0.1, { open: true, l: 2.3 }); B.add(M.stone, K.tint(K.rubble({ x: -14.5, z: -21.2, n: 4, spread: 0.6, size: [0.15, 0.3], seed: 77, y: (x, z) => L.terrain(x, z) }), 0.9));
  tomb('chest', -20.2, -13.7, 0.05); tomb('table', -22.2, -24.3, 0.12);
  tomb('table', 6.5, -22.5, -0.06); tomb('chest', 10.9, -24.8, 0.09); tomb('chest', 11.2, -14.9, -0.04); tomb('chest', 22.9, -24.5, 0.06);
  // obelisks, urn, further ringed crosses
  function tall(kind, x, z, ry, o) { const P = kind === 'obelisk' ? obelisk(R, o) : kind === 'urn' ? urnTomb(R) : kind === 'latin' ? latinCross(R, o) : ringCross(R, o); chk(kind, x, z, 0.8, P.h); const rad = kind === 'ring' ? P.base / 2 : kind === 'latin' ? 0.4 : 0.78;
    place(P, { x, z, ry, rx: R.range(-0.03, 0.03), rz: R.range(-0.045, 0.045), sink: R.range(0, 0.05) }); ctx.block.circle(x, z, rad); take(x, z, rad + 0.35); count(kind); grass(R, x + 0.5, z - 0.3, 0.7, 5); return P; }
  tall('obelisk', -17.7, -15.5, 0.1, { h: 3.5 }); tall('urn', -21.1, -19.3, 0.2); tall('ring', -5.1, -26.5, 0.12, { h: 3.0, steps: 2 }); tall('ring', -16.4, -19.2, 0.05, { h: 2.9, steps: 2 }); tall('ring', -24.3, -17.3, 0.2, { h: 2.6 });
  tall('ring', 5.2, -25.5, -0.08, { h: 3.3, steps: 2, seg: 14 }); tall('obelisk', 13.1, -27.2, -0.1, { h: 3.4 }); tall('urn', 16.9, -19.2, -0.15); tall('ring', 21.3, -22.9, -0.1, { h: 3.0, steps: 2 });
  tall('latin', -21.6, -15.4, 0.15, { h: 2.3, caps: true, base: true }); tall('latin', 24.5, -27.4, -0.1, { h: 2.2, base: true }); tall('latin', -7.6, -27.0, 0.1, { h: 2.4, caps: true, base: true }); tall('latin', 16.5, -12.4, 0, { h: 1.9, base: true });
  tall('latin', 14.7, -35.0, 0, { h: 2.7, t: 0.3, base: true, caps: true, stone: { m: M.stonePlain, v: 1.0 } });                              // the calvary at the head of the monks' rows
  // low slabs close beside the paths (they never hide the hero)
  function slab(kind, x, z, ry) { const P = kind === 'coped' ? coped(R, { head: R() < 0.6 }) : ledger(R); chk(kind, x, z, 0.9, 0.6); place(P, { x, z, ry, rx: R.range(-0.03, 0.03), rz: R.range(-0.05, 0.05), sink: R.range(0, 0.05) });
    const fx = Math.sin(ry) * (P.l / 2 - 0.1), fz = Math.cos(ry) * (P.l / 2 - 0.1); ctx.block.seg(x - fx, z - fz, x + fx, z + fz, P.w / 2); take(x - fx * 0.6, z - fz * 0.6, 0.55); take(x + fx * 0.6, z + fz * 0.6, 0.55); count(kind); grass(R, x + 0.6, z - 0.5, 0.5, 4); }
  slab('coped', -8.8, -21.3, 0.1); slab('ledger', -16.6, -24.3, -0.12); slab('coped', -4.5, -17.3, 0.04); slab('coped', -19.2, -20.9, 0.2);
  slab('ledger', 4.4, -14.9, 0.05); slab('coped', 8.8, -23.0, -0.1); slab('ledger', 20.7, -26.9, -0.2); slab('coped', 13.6, -13.5, 0.08);
  // the mourner, east of the path where it turns north
  { const x = 22.8, z = -29.5, gy = L.terrain(x, z); chk('statue', x, z, 1.0); place(statue(R), { x, z, ry: -0.32, rz: 0.02 }); ctx.block.rect(x - 0.95, z - 0.95, x + 0.95, z + 0.95); take(x, z, 1.5); count('statue');
    graveLamp(x - 0.55, gy + 0.22, z + 0.78); grass(R, x + 1.2, z + 0.3, 0.7, 6); grass(R, x - 1.3, z - 0.2, 0.6, 4, 'weed'); ctx.plant('grass', { x: x - 0.4, z: z + 1.7, r: 1.2, n: 9, kind: 'moonflower', seed: 91 }); }

  // ===================================================================================================== LAY GRAVES
  // 1. beside the paths: the richest groupings
  function alongPath(id, side, off, step, zMin, zMax, o) { const p = L.PATHS.find(q => q.id === id).pts; let carry = R.range(0, step);
    for (let i = 0; i < p.length - 1; i++) { const ax = p[i][0], az = p[i][1], dx = p[i + 1][0] - ax, dz = p[i + 1][1] - az, len = Math.hypot(dx, dz), nx = -dz / len * side, nz = dx / len * side;
      for (let s = carry; s < len; s += step * R.range(0.85, 1.2)) { const d = off + R.range(-0.25, 0.5), x = ax + dx * s / len + nx * d, z = az + dz * s / len + nz * d; carry = 0; if (z < zMin || z > zMax) continue; if (siteOK(x, z, 0.55)) layGrave(R, x, z, o); } } }
  take(10.6, -17.7, 1.1); // keep the wedge south of the east / mausoleum junction open: a stone there stands on the hero's feet
  alongPath('west', 1, 2.5, 2.0, -28, -11.5); alongPath('west', -1, 2.6, 2.0, -28, -11.5);
  alongPath('east', 1, 2.5, 2.0, -33, -11.5); alongPath('east', -1, 2.6, 2.0, -33, -11.5);
  alongPath('mausoleum', 1, 2.3, 2.6, -28, -11.5); alongPath('mausoleum', -1, 2.3, 2.6, -28, -11.5);
  alongPath('approach', 1, 4.4, 2.7, -27.6, -12.2); alongPath('approach', -1, 4.4, 2.7, -27.6, -12.2);
  // 2. loose rows filling the plots, thinning toward the walls
  function rows(x0, x1, zs, o) { o = o || {}; for (const zr of zs) { let x = x0 + R.range(0, 1.2); while (x < x1) { const z = zr + R.range(-0.3, 0.3), d = pathAbs(x, z);
        const p = clamp(1.12 - d / (o.fade || 17), 0.42, 1) * (0.6 + 0.8 * HD.fbm(x * 0.23 + 9, z * 0.23, 31, 2)); if (R() < p && siteOK(x, z, 0.55)) layGrave(R, x, z, o); x += R.range(1.4, 2.0); } } }
  rows(-25.3, -3.8, [-13.1, -15.7, -18.3, -20.9, -23.5, -26.0, -27.2]);
  rows(4, 25.4, [-13.0, -15.6, -18.2, -20.8, -23.4, -25.9, -27.5, -30.4]);

  // 3. small stones tucked in between, close to the paths (children's graves, markers)
  { let n = 0; for (let i = 0; i < 400 && n < 20; i++) { const west = R() < 0.45, x = west ? R.range(-25, -4) : R.range(4, 25.4), z = west ? R.range(-27.4, -12) : R.range(-31, -12); if (pathAbs(x, z) > 6.5 || !siteOK(x, z, 0.44)) continue; layGrave(R, x, z, { kind: 'head', small: true }); n++; } }

  // ==================================================================================================== MONKS' PLOT
  { const r = ctx.rng(5519); for (let j = 0; j < 9; j++) { const zr = -35.3 - j * 2.3; for (const cxm of [12.9, 14.7, 16.5, 21.8, 23.5, 25.2]) { const x = cxm + r.range(-0.07, 0.07), z = zr + r.range(-0.08, 0.08); if (siteOK(x, z, 0.45)) monkGrave(r, x, z); } } }

  // ======================================================================================================== PLANTS
  { const r = ctx.rng(88); const bush = (x, z, rad, kind) => { if (offPath(x, z, rad, 1.3)) ctx.plant('bush', { x, z, r: rad, kind, seed: r.int(1, 9999) }); };
    bush(-25.2, -12.3, 1.3, 'bramble'); bush(-23.2, -12.1, 1.0, 'bramble'); bush(-25.6, -17.6, 1.0, 'bramble'); bush(-25.5, -25.2, 1.2, 'bramble'); bush(-9.2, -12.2, 1.0, 'shrub'); bush(-16.2, -12.3, 1.1, 'shrub'); bush(-11.6, -12.6, 0.8, 'fern');
    bush(25.3, -12.4, 1.2, 'bramble'); bush(14.2, -12.2, 1.0, 'bramble'); bush(25.4, -17.2, 0.9, 'bramble'); bush(25.5, -19.6, 1.0, 'shrub'); bush(18.2, -12.1, 0.8, 'shrub'); bush(4.4, -12.2, 0.9, 'shrub'); bush(25.5, -26.2, 1.0, 'bramble');
    bush(25.4, -38.6, 1.0, 'bramble'); bush(25.5, -50.5, 1.1, 'bramble'); bush(12.4, -55.0, 1.0, 'shrub'); bush(25.3, -55.2, 1.2, 'bramble'); bush(12.3, -33.6, 0.8, 'fern'); bush(22.0, -21.3, 0.8, 'fern');
    for (const [x, z, rad, n] of [[-11.6, -20.4, 1.4, 9], [-19.6, -22.6, 1.5, 10], [16.6, -22.2, 1.2, 8], [8.6, -16.6, 1.1, 7], [14.6, -38.7, 1.3, 9], [23.4, -43.2, 1.2, 8], [-7.4, -26.9, 1.0, 6]]) if (n && L.pathDist(x, z) > 1.5) ctx.plant('grass', { x, z, r: rad, n, kind: 'moonflower', seed: r.int(1, 9999) });
    // rough grass through both plots, thicker away from the paths
    for (let i = 0; i < 150; i++) { const west = r() < 0.4, x = west ? r.range(-25.6, -3.8) : r.range(3.8, 25.6), z = west ? r.range(-27.6, -11.8) : r.range(-55.5, -11.8); if (!inPlot(x, z, 0.3) || L.pathDist(x, z) < 1.5) continue;
      ctx.plant('grass', { x, z, r: r.range(0.5, 1.1), n: r.int(4, 8), kind: r() < 0.5 ? 'tall' : r() < 0.6 ? 'weed' : 'tuft', seed: r.int(1, 99999) }); }
    for (const [x, z] of [[19.7, -17.6], [23.3, -20.5], [19.3, -20.2]]) ctx.plant('grass', { x: x - 0.5, z, r: 0.6, n: 5, kind: 'weed', seed: r.int(1, 9999) });
  }

  B.build({ name: undefined }); B2.build({ cast: false });
}; })();
