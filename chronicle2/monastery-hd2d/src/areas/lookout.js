// The lookout terrace on the north-east corner (where the monks watched the two moons), the whole north cliff
// (rock lip, rim outcrops, bedded faces down into the cloud sea, spurs and detached pinnacles), the bastion that
// carries the terrace's bay down the cliff, and the low ruined wall that closes the ledge behind the church.
// Plan: parapet lines x 12.5..26, z -63.5..-57.85; a bay x 17.5..23.5 projects to z -65.5 (the moon-dial stands in it);
// floor y 0.45 with two steps up from the east path at (18.6, -57.5..-56.2). The vista camera zone is at the bottom of the terrace part.
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.lookout = function (ctx) {
  const K = ctx.K, M = ctx.M, L = ctx.L, B = ctx.batch(), rng = ctx.rng;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), PI = Math.PI;
  const F = 0.45;                                              // terrace floor level (two shallow steps up from the path)
  const X0 = 12.5, X1 = 26, ZN = -63.5, ZS = -57.5, ZB = -65.5; // parapet lines; ZB = front of the bay that projects over the cliff
  const SW = [X0, -57.85], NW = [X0, ZN], b1 = [17.5, ZN], b2 = [18.7, ZB], b3 = [22.3, ZB], b4 = [23.5, ZN], NE = [X1, ZN], SE = [X1, -57.85];
  const DIAL = [20.5, -64.25], BRAZ = [15.35, -60.75];

  // ================================================================================================ local helpers
  function geom(pos) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; }
  // side faces between two rings of [x,y,z] (same count, listed with increasing plan angle), optional fan cap on the top ring (cap = rise of its centre)
  function frustum(pos, bot, top, cap) { const n = bot.length, n0 = pos.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; pos.push(...bot[i], ...top[j], ...bot[j], ...bot[i], ...top[i], ...top[j]); }
    if (cap !== undefined && cap !== false) fan(pos, top, cap === true ? 0 : cap);
    return (pos.length - n0) / 3; }
  function fan(pos, top, rise) { const n = top.length; let cx = 0, cy = 0, cz = 0; for (const p of top) { cx += p[0]; cy += p[1]; cz += p[2]; } cx /= n; cy /= n; cz /= n;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; pos.push(cx, cy + rise, cz, ...top[j], ...top[i]); } return n * 3; }
  // the same between two rings whose points alternate (top[i] lies between bot[i] and bot[i+1]): triangular facets
  function anti(pos, bot, top) { const n = bot.length, n0 = pos.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; pos.push(...bot[i], ...top[i], ...bot[j], ...bot[j], ...top[i], ...top[j]); } return (pos.length - n0) / 3; }
  // stack(o): a mass of bedded rock: irregular polygonal beds, each with a faceted, battered face and a weathered shoulder, each wider
  // than the one above (ledges), ribs running down through the beds, the beds wandering and tilting a little so ledges come and go.
  // {x,z, top,base, a0,b0 (half-sizes east-west / north-south at the top), a1,b1 (at the base), n, seed, th0 (top bed thickness), thk (growth),
  // th1 (max), drift:[dx,dz] of the centre from top to base, zmax: fn(x) -> largest z allowed, rough, dip:[dy/dx, dy/dz], tilt, ledgeP, pow, peak, wander}
  function stack(o) { const r = rng(o.seed || 1), n = o.n || 9, pos = [], col = [], rough = o.rough === undefined ? 0.2 : o.rough, bias = [], ang = [], rot = r.range(0, 6.283), half = PI / n;
    for (let i = 0; i < n; i++) { bias.push(1 + r.range(-rough, rough)); ang.push(rot + (i + r.range(-0.3, 0.3)) / n * 6.2832); }
    const ys = [o.top]; let y = o.top, th = o.th0 || 1.2;
    while (y - th * 1.5 > o.base) { y -= th * r.range(0.7, 1.3); ys.push(y); th = Math.min(o.th1 || 6, th * (o.thk || 1.35)); } ys.push(o.base);
    const m = ys.length - 1, inc = []; let sum = 0;
    for (let k = 0; k < m; k++) { const bat = (ys[k] - ys[k + 1]) * r.range(0.06, 0.2), led = k < m - 1 ? (r() < (o.ledgeP === undefined ? 0.45 : o.ledgeP) ? r.range(0.6, 1.5) : r.range(0.1, 0.32)) : 0; inc.push([bat, led]); sum += bat + led; }
    const pw = o.pow || 1, wd = o.wander === undefined ? 0.05 : o.wander, tl = o.tilt === undefined ? 0.05 : o.tilt; let f = 0, wx = 0, wz = 0, dx = 0, dz = 0;
    const ring = (ff, yy, jit, ph, kq, inset) => { const e = Math.pow(ff, pw), a0 = o.a0 + (o.a1 - o.a0) * e, b0 = o.b0 + (o.b1 - o.b0) * e, a = Math.max(a0 * 0.4, a0 - inset), b = Math.max(b0 * 0.4, b0 - inset),
      cx = o.x + (o.drift ? o.drift[0] * e : 0) + wx * a0, cz = o.z + (o.drift ? o.drift[1] * e : 0) + wz * b0, out = [];
      for (let i = 0; i < n; i++) { const q = bias[i] * kq[i], px = cx + Math.cos(ang[i] + ph) * a * q; let pz = cz + Math.sin(ang[i] + ph) * b * q; if (o.zmax) pz = Math.min(pz, o.zmax(px));
        out.push([px, yy + (jit ? r.range(-jit, jit) : 0) + (px - cx) * dx + (pz - cz) * dz, pz]); } return out; };
    const paint = (cnt, v) => { for (let i = 0; i < cnt * 3; i++) col.push(v); };
    for (let k = 0; k < m; k++) { const fT = f, fB = f + inc[k][0] / sum; f = fB + inc[k][1] / sum; const t = ys[k] - ys[k + 1], ph = r.range(-0.16, 0.16), kq = bias.map(() => 1 + r.range(-0.08, 0.08)), tone = r.range(0.84, 1.04);
      wx += r.range(-1, 1) * wd; wz += r.range(-1, 1) * wd; dx = 0; dz = 0;
      const sink = k < m - 1 ? 0.3 + (tl + (o.dip ? Math.abs(o.dip[0]) + Math.abs(o.dip[1]) : 0)) * Math.max(o.a0 + (o.a1 - o.a0) * Math.pow(fB, pw), o.b0 + (o.b1 - o.b0) * Math.pow(fB, pw)) : 0;
      const bot = ring(fB, ys[k + 1] - sink, 0, ph, kq, 0), cap = k === 0 ? (o.peak === undefined ? r.range(0.03, 0.14) : o.peak) : 0.001;
      dx = (o.dip ? o.dip[0] : 0) + r.range(-tl, tl); dz = (o.dip ? o.dip[1] : 0) + r.range(-tl, tl);
      if (ys[k] < -19 && k > 0) { const top = ring(fT, ys[k], Math.min(0.3, t * 0.1), ph + half, kq, 0); paint(anti(pos, bot, top), tone); paint(fan(pos, top, cap), tone); continue; }
      const ch = Math.min(0.6, t * 0.32) * r.range(0.6, 1.2), kq2 = kq.map(v => v * (1 + r.range(-0.06, 0.06))), mid = ring(fT, ys[k] - ch, Math.min(0.22, t * 0.1), ph + half, kq, 0), top = ring(fT, ys[k], Math.min(0.14, t * 0.08), ph + half, kq2, ch * r.range(0.8, 1.7));
      paint(anti(pos, bot, mid), tone); paint(frustum(pos, mid, top, cap), tone * 1.1); }
    const g = geom(pos); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; }
  // darker with depth (the faces sink into the haze and the cloud sea); keeps the tone a piece already has
  const deep = m => (x, y, z) => m * (y > -1 ? 1 : Math.max(0.5, 1 + (y + 1) * 0.019));
  const rock = (g, m) => { const p = g.attributes.position, c = g.attributes.color, fn = deep(m === undefined ? 1 : m); if (!c) { B.add(M.rock, K.shade(g, fn)); return g; }
    for (let i = 0; i < p.count; i++) { const v = fn(0, p.getY(i), 0) * c.getX(i); c.setXYZ(i, v, v, v); } B.add(M.rock, g); return g; };
  // a profile [[w,v]..] pushed along a wall from u0 to u1 (copings, mouldings)
  function prof(W, pts, u0, u1) { const g = K.extrude(pts, u1 - u0); g.rotateY(PI / 2); g.translate(u0, 0, 0); return W.put(g); }
  // tilt a finished piece about a foot point
  function lean(g, x, y, z, rx, rz, ry) { g.translate(-x, -y, -z); K.xform(g, { rx: rx || 0, rz: rz || 0, ry: ry || 0, x, y, z }); return g; }
  // outline of a small cusped (trefoil-headed) opening
  function cusp(cx, sill, w, h) { const a = w / 2, s = sill + h * 0.45, r = h * 0.55;
    const R = [[a, sill], [a, s + r * 0.2], [a * 0.5, s + r * 0.36], [a * 0.94, s + r * 0.58], [a * 0.5, s + r * 0.86], [0, s + r]];
    const pts = R.map(p => [cx + p[0], p[1]]); for (let i = R.length - 2; i >= 0; i--) pts.push([cx - R[i][0], R[i][1]]); return pts; }
  const BALL = [[0.13, 0], [0.16, 0.03], [0.09, 0.08], [0.09, 0.12], [0.19, 0.17], [0.27, 0.27], [0.28, 0.37], [0.23, 0.49], [0.13, 0.57], [0.05, 0.61], [0, 0.66]];
  const COPING = [[-0.29, 0.94], [0.29, 0.94], [0.29, 1.02], [0.21, 1.06], [0.21, 1.1], [0.1, 1.17], [-0.1, 1.17], [-0.21, 1.1], [-0.21, 1.06], [-0.29, 1.02]];

  // ================================================================================================ the terrace
  // plan outline of the platform (parapet lines grown by 0.3), with the bay
  const OUT = [[X0 - 0.3, ZS], [X1 + 0.3, ZS], [X1 + 0.3, ZN - 0.3], [23.67, ZN - 0.3], [22.47, ZB - 0.3], [18.53, ZB - 0.3], [17.33, ZN - 0.3], [X0 - 0.3, ZN - 0.3]];
  B.add(M.stone, K.tint(K.poly(OUT, -1.0, F - 0.08), 0.8));
  B.add(M.flag, K.poly(OUT, F - 0.08, F));
  B.add(M.sand, K.tint(K.box(X0 - 0.36, F - 0.17, ZS, X1 + 0.36, F, ZS + 0.07), 0.9));                 // nosing along the front edge
  B.add(M.stone, K.tint(K.box(X0 - 0.38, -0.4, ZS, X1 + 0.38, 0.13, ZS + 0.1), 0.68));                 // footing course
  // two splayed steps up from the path
  B.add(M.sand, K.tint(K.poly([[16.3, ZS], [16.9, ZS + 1.3], [20.5, ZS + 1.3], [21.1, ZS]], -0.3, 0.15), 0.78),
    K.tint(K.poly([[16.7, ZS], [17.1, ZS + 0.68], [20.3, ZS + 0.68], [20.7, ZS]], 0.15, 0.30), 0.86));
  ctx.floor(X0 - 0.3, ZN - 0.3, X1 + 0.3, ZS, F); ctx.floor(17.33, ZB - 0.3, 23.67, ZN - 0.3, F);
  ctx.floor(17.1, ZS + 0.68, 20.3, ZS + 1.3, 0.15); ctx.floor(17.1, ZS, 20.3, ZS + 0.68, 0.30);
  // a few heaved and sunken flags
  { const r = rng(311); for (let i = 0; i < 6; i++) { const x = r.range(16.5, 25), z = r.range(-62.6, -58.4); if (Math.hypot(x - 18.4, z + 60.4) < 1.2) continue;
      B.add(M.flag, K.tint(lean(K.boxc(x, F - 0.03, z, r.range(0.7, 1.2), 0.07, r.range(0.6, 0.9), r.range(-0.2, 0.2)), x, F, z, r.range(-0.05, 0.05), r.range(-0.05, 0.05)), r.range(0.9, 1.04))); } }

  // the standing place: a worn ring of pale stone let into the flags, the two moons marked on it (north-north-west and a little east of north)
  { const x = 18.3, z = -60.4, ring = K.poly(K.ngon(x, z, 1.18, 20, 0.1), F, F + 0.014, [K.ngon(x, z, 0.94, 20, 0.1)]);
    B.add(M.sand, K.tint(ring, 0.74), K.tint(K.poly(K.ngon(x - Math.sin(0.314) * 1.06, z - Math.cos(0.314) * 1.06, 0.2, 10), F, F + 0.024), 1.0));
    B.add(M.iron, K.poly(K.ngon(x + Math.sin(0.244) * 1.06, z - Math.cos(0.244) * 1.06, 0.17, 10), F, F + 0.024)); }

  // ---- parapet: plinth course, pierced panel (cusped openings), moulded coping
  function rail(a, b, o) { o = o || {}; const W = K.wall(a, b, F), u0 = o.u0 === undefined ? 0.3 : o.u0, u1 = o.u1 === undefined ? W.L - 0.3 : o.u1;
    for (const p of (o.plinth || [[0, W.L]])) B.add(M.stone, K.tint(W.box(p[0], p[1], 0, 0.2, -0.24, 0.24), 0.9));
    const h0 = o.h0 === undefined ? u0 : o.h0, h1 = o.h1 === undefined ? u1 : o.h1, n = Math.max(0, Math.round((h1 - h0 - 0.2) / 0.58)), holes = [];
    if (n > 0) { const st = (h1 - h0 - 0.2) / n; for (let i = 0; i < n; i++) holes.push(cusp(h0 + 0.1 + st * (i + 0.5), 0.3, Math.min(0.36, st - 0.2), 0.54)); }
    B.add(M.stone, W.solid({ t: 0.2, u0, u1, v0: 0.2, top: o.top || [[u0, 0.94], [u1, 0.94]], holes }));
    const c = o.cop || [u0 - 0.04, u1 + 0.04]; if (c[1] > c[0]) B.add(M.sand, K.tint(prof(W, COPING, c[0], c[1]), 0.9 + 0.12 * HD.hash2(Math.round(a[0] * 7 + b[0] * 3), Math.round(a[1] * 5 + b[1]), 2)));
    ctx.block.seg(a[0], a[1], b[0], b[1], 0.26); return W; }
  // pier(x, z, {s, h, top:'ball'|'pyr'|'flat'})
  function pier(x, z, o) { o = o || {}; const s = o.s || 0.74, h = o.h || 1.5, gs = [], gt = [];
    gs.push(K.tint(K.boxc(x, F, z, s + 0.16, 0.22, s + 0.16), 0.88), K.boxc(x, F + 0.22, z, s, h - 0.22, s));
    gt.push(K.tint(K.boxc(x, F + 0.94, z, s + 0.06, 0.08, s + 0.06), 0.85), K.boxc(x, F + h, z, s + 0.2, 0.1, s + 0.2), K.tint(K.boxc(x, F + h + 0.1, z, s + 0.08, 0.07, s + 0.08), 0.92));
    if (o.top === 'pyr') gt.push(K.spire({ x, y: F + h + 0.17, z, r: (s + 0.08) * 0.707, h: 0.46 }));
    else if (o.top !== 'flat') { gt.push(K.spire({ x, y: F + h + 0.17, z, r: (s + 0.08) * 0.707, h: 0.16 })); gt.push(K.lathe(BALL, 8, { x, y: F + h + 0.24, z, ry: 0.4 })); }
    let a = K.merge(gs), t = K.merge(gt); if (o.rx || o.rz) { lean(a, x, F, z, o.rx, o.rz); lean(t, x, F, z, o.rx, o.rz); }
    B.add(M.stone, a); B.add(M.sand, t); ctx.block.circle(x, z, s * 0.62); }

  rail(SW, NW, { u1: 2.55 }); rail(SW, NW, { u0: 3.15 });                                 // west return (a pier at mid length)
  rail(NW, b1); rail(b1, b2, { u0: 0.26, u1: 2.07 }); rail(b2, b3, { u0: 0.26, u1: 3.34 }); rail(b3, b4, { u0: 0.26, u1: 2.07 });
  // north-east stretch: broken away, the corner pier toppled
  { const W = rail(b4, NE, { u0: 0.28, u1: 1.5, h0: 0.28, h1: 0.96, top: [[0.28, 0.94], [0.96, 0.94], [0.96, 0.66], [1.24, 0.66], [1.24, 0.42], [1.5, 0.42]], cop: [0.24, 0.86], plinth: [[0, 1.72], [2.0, 2.5]] });
    B.add(M.stone, K.tint(W.box(1.98, 2.2, 0.2, 0.5, -0.1, 0.1), 0.95)); }
  { const Lw = Math.hypot(SE[0] - NE[0], SE[1] - NE[1]);
    rail(NE, SE, { u0: 0.3, u1: 2.52, h0: 1.12, top: [[0.3, 0.42], [0.72, 0.42], [0.72, 0.68], [1.1, 0.68], [1.1, 0.94], [2.52, 0.94]], cop: [1.22, 2.56] }); rail(NE, SE, { u0: 3.08, u1: Lw - 0.3 }); }
  // cheek walls ramping down from the front piers to a low scrolled stop (kept low: the camera looks over them from the south)
  for (const [a, b] of [[SW, [X0 + 1.9, SW[1]]], [SE, [X1 - 1.9, SE[1]]]]) { const W = K.wall(a, b, F);
    B.add(M.stone, K.tint(W.box(0, 1.9, 0, 0.2, -0.24, 0.24), 0.9), W.solid({ t: 0.2, u0: 0.3, u1: 1.55, v0: 0.2, top: [[0.3, 0.94], [0.5, 0.94], [1.55, 0.36]] }), K.tint(W.box(1.5, 1.92, 0.2, 0.5, -0.26, 0.26), 0.95));
    const cp = K.extrude([[0.28, 0.94], [0.52, 0.94], [1.58, 0.355], [1.58, 0.55], [0.56, 1.13], [0.28, 1.13]], 0.58); cp.translate(0, 0, -0.29);
    const sc = K.lathe([[0, -0.3], [0.2, -0.3], [0.24, -0.24], [0.24, 0.24], [0.2, 0.3], [0, 0.3]], 9); sc.rotateX(PI / 2); sc.translate(1.7, 0.56, 0);
    B.add(M.sand, W.put(cp), W.put(sc)); ctx.block.seg(a[0], a[1], b[0], b[1], 0.26); }
  pier(SW[0], SW[1], { rz: 0.02 }); pier(NW[0], NW[1]); pier(SE[0], SE[1], { rx: -0.015, rz: -0.025 });
  pier(X0, -60.7, { s: 0.58, h: 1.36, top: 'pyr' }); pier(X1, -60.7, { s: 0.58, h: 1.36, top: 'pyr', rz: -0.03 });
  pier(b1[0], b1[1], { s: 0.6, h: 1.4, top: 'pyr' }); pier(b4[0], b4[1], { s: 0.6, h: 1.4, top: 'pyr', rx: 0.02 });
  pier(b2[0], b2[1], { s: 0.56, h: 1.36 }); pier(b3[0], b3[1], { s: 0.56, h: 1.36 });
  // the toppled north-east corner pier: stump, the shaft and cap on the flags, the ball rolled away
  B.add(M.stone, K.tint(K.boxc(X1, F, ZN, 0.9, 0.22, 0.9), 0.88), K.chunk({ x: X1, y: F + 0.2, z: ZN, w: 0.74, h: 0.55, d: 0.74, seed: 5, ry: 0.06, rx: 0.07, rz: -0.06 }),
    K.chunk({ x: 24.95, y: F, z: -62.72, w: 1.05, h: 0.72, d: 0.72, seed: 8, ry: 0.42, rx: 0.04, rz: 0.07 }),
    K.rubble({ x: 24.3, z: -63.05, y: F, n: 7, spread: 0.95, size: [0.16, 0.4], seed: 31 }), K.rubble({ x: 25.4, z: -61.6, y: F, n: 4, spread: 0.6, size: [0.14, 0.3], seed: 37 }));
  B.add(M.sand, K.chunk({ x: 24.15, y: F, z: -62.25, w: 0.9, h: 0.17, d: 0.9, seed: 9, ry: 0.9, rx: 0.06, rz: 0.2 }),
    lean(K.lathe(BALL, 8, { x: 23.35, y: F + 0.27, z: -61.85 }), 23.35, F + 0.27, -61.85, 1.25, 0.5, 0.7),
    K.chunk({ x: 23.55, y: F, z: -62.95, w: 0.7, h: 0.2, d: 0.5, seed: 12, ry: 0.3 }));
  ctx.block.circle(X1, ZN, 0.55); ctx.block.circle(24.95, -62.72, 0.6); ctx.block.circle(24.15, -62.25, 0.42); ctx.block.circle(23.35, -61.85, 0.26);

  // ---- the moon-dial: octagonal dais, carved pedestal, bronze dial plate and armillary rings with the two moons
  { const x = DIAL[0], z = DIAL[1], y0 = F + 0.24, yt = y0 + 1.32, yc = yt + 0.8;
    B.add(M.sand, K.tint(K.poly(K.ngon(x, z, 1.0, 8, PI / 8), F, F + 0.13), 0.8), K.tint(K.poly(K.ngon(x, z, 0.74, 8, PI / 8), F + 0.13, y0), 0.88),
      K.lathe([[0.56, 0], [0.56, 0.12], [0.46, 0.18], [0.34, 0.3], [0.27, 0.5], [0.25, 0.75], [0.3, 0.95], [0.4, 1.04], [0.33, 1.08], [0.36, 1.12], [0.6, 1.24], [0.6, 1.32], [0, 1.32]], 8, { x, y: y0, z, ry: PI / 8, flat: true }));
    const ringG = (rad, tube, o) => { const pts = []; for (let i = 0; i <= 22; i++) { const a = i / 22 * PI * 2; pts.push([Math.cos(a) * rad, Math.sin(a) * rad, 0]); } return K.xform(K.tube(pts, tube, 5), Object.assign({ x, y: yc, z }, o)); };
    const ball = (bx, by, bz, s) => K.xform(new THREE.IcosahedronGeometry(s, 1), { x: x + bx, y: yc + by, z: z + bz });
    B.add(M.bronze, K.lathe([[0, 0], [0.5, 0], [0.52, 0.03], [0.5, 0.06], [0, 0.06]], 12, { x, y: yt, z }),                 // dial plate
      K.tube([[x - 0.12, yt + 0.05, z], [x - 0.12, yt + 0.16, z], [x, yt + 0.2, z], [x + 0.12, yt + 0.16, z], [x + 0.12, yt + 0.05, z]], 0.035, 5),   // cradle
      K.tube([[x, yt + 0.06, z], [x, yc - 0.66, z]], 0.05, 6),
      ringG(0.66, 0.045, { rx: -0.3 }), ringG(0.6, 0.04, { ry: PI / 2, rz: 0.42 }), ringG(0.54, 0.035, { rx: PI / 2 - 0.12, rz: 0.1 }), ringG(0.47, 0.03, { ry: 0.9, rx: 0.95 }),
      K.tube([[x - 0.25, yc - 0.7, z + 0.22], [x + 0.25, yc + 0.7, z - 0.22]], 0.022, 5), ball(0, 0, 0, 0.13));
    B.add(M.sand, ball(-0.17, -0.47, 0.15, 0.085)); B.add(M.iron, ball(0.19, 0.52, -0.17, 0.095));                        // the white moon and the black moon
    ctx.glow({ x: x - 0.17, y: yc - 0.47, z: z + 0.2, color: '#ffe6c0', size: 0.7, strength: 0.4, flicker: 0.04 });
    ctx.block.circle(x, z, 1.0); }

  // ---- curved stone bench: a quarter-round exedra in the north-west corner, gathered round the brazier
  { const cx = BRAZ[0], cz = BRAZ[1], a0 = 184 * PI / 180, a1 = 268 * PI / 180, N = 9;
    const arc = (r0, r1, s0, s1) => { const p = []; for (let i = 0; i <= N; i++) { const a = s0 + (s1 - s0) * i / N; p.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]); } for (let i = N; i >= 0; i--) { const a = s0 + (s1 - s0) * i / N; p.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]); } return p; };
    B.add(M.stone, K.tint(K.poly(arc(1.8, 2.5, a0, a1), F, F + 0.4), 0.8), K.poly(arc(2.24, 2.5, a0, a1), F + 0.4, F + 1.0));
    B.add(M.sand, K.tint(K.poly(arc(1.68, 2.3, a0 - 0.02, a1 + 0.02), F + 0.4, F + 0.53), 0.95), K.poly(arc(2.19, 2.55, a0 - 0.02, a1 + 0.02), F + 1.0, F + 1.1));
    for (const a of [a0, a1]) { const ex = cx + Math.cos(a) * 2.12, ez = cz + Math.sin(a) * 2.12;                         // scrolled end blocks
      B.add(M.sand, K.tint(K.boxc(ex, F, ez, 0.9, 0.74, 0.26, -a), 0.9), K.xform(K.lathe([[0, -0.21], [0.2, -0.15], [0.2, 0.15], [0, 0.21]], 8), { rx: PI / 2, ry: -a + PI / 2, x: ex - Math.cos(a) * 0.2, y: F + 0.76, z: ez - Math.sin(a) * 0.2 })); }
    for (let i = 0; i < 4; i++) { const s = a0 + (a1 - a0) * i / 4, e = a0 + (a1 - a0) * (i + 1) / 4; ctx.block.seg(cx + Math.cos(s) * 2.12, cz + Math.sin(s) * 2.12, cx + Math.cos(e) * 2.12, cz + Math.sin(e) * 2.12, 0.4); }
    // the dead corner behind it: a low kerbed bed gone to weeds
    B.add(M.stone, K.tint(K.poly([[X0 + 0.24, -61.35], [13.05, -61.5], [13.5, -62.6], [14.55, -63.05], [14.75, ZN + 0.24], [X0 + 0.24, ZN + 0.24]], F, F + 0.3), 0.74));
    ctx.plant('grass', { x: 13.3, z: -62.75, r: 0.5, n: 5, kind: 'moonflower', y: F + 0.3, seed: 71 }); ctx.plant('grass', { x: 13.2, z: -62.3, r: 0.6, n: 5, kind: 'weed', y: F + 0.3, seed: 72 });
    ctx.block.circle(13.35, -62.75, 0.7); }

  // ---- brazier on a turned stone stem: the one light of the terrace
  { const x = BRAZ[0], z = BRAZ[1];
    B.add(M.sand, K.tint(K.lathe([[0.4, 0], [0.4, 0.1], [0.28, 0.16], [0.15, 0.3], [0.12, 0.62], [0.18, 0.8], [0.12, 0.9], [0.14, 0.98], [0, 0.98]], 8, { x, y: F, z, flat: true }), 0.86));
    const legs = []; for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + 0.5, c = Math.cos(a), s = Math.sin(a); legs.push(K.tube([[x + c * 0.12, F + 0.72, z + s * 0.12], [x + c * 0.34, F + 0.92, z + s * 0.34], [x + c * 0.44, F + 1.2, z + s * 0.44], [x + c * 0.47, F + 1.5, z + s * 0.47], [x + c * 0.4, F + 1.6, z + s * 0.4]], 0.028, 4)); }
    B.add(M.iron, K.lathe([[0.1, 0.98], [0.3, 1.06], [0.43, 1.24], [0.46, 1.4], [0.41, 1.4], [0.36, 1.32], [0, 1.3]], 9, { x, y: F, z }), legs,
      K.lathe([[0.455, 1.18], [0.485, 1.2], [0.455, 1.22]], 9, { x, y: F, z }));
    B.add(M.lampGlass, K.lathe([[0.37, 1.33], [0.3, 1.42], [0.15, 1.48], [0, 1.49]], 8, { x, y: F, z, flat: true }));
    const fl = new THREE.Mesh(K.merge([K.spire({ x: 0, y: 0, z: 0, r: 0.17, h: 0.6, sides: 5, ry: 0.3 }), K.spire({ x: -0.13, y: -0.02, z: 0.05, r: 0.11, h: 0.36, sides: 5, ry: 1.1 }), K.spire({ x: 0.12, y: -0.02, z: -0.04, r: 0.1, h: 0.42, sides: 5, ry: 2 })]), M.flame);
    fl.position.set(x, F + 1.44, z); ctx.add(fl, { cast: false, receive: false });
    ctx.onUpdate(t => { fl.scale.set(1 + 0.08 * Math.sin(t * 11.3), 1 + 0.16 * Math.sin(t * 8.7) + 0.08 * Math.sin(t * 17.1), 1 + 0.08 * Math.sin(t * 9.9 + 1)); fl.rotation.y = t * 1.7; });
    ctx.light({ x, y: F + 2.05, z: z + 0.1, color: '#ffb060', intensity: 1.55, distance: 12, flicker: 0.14 });
    ctx.glow({ x, y: F + 1.75, z: z + 0.05, color: '#ffb060', size: 3.0, strength: 1.1 }); ctx.glow({ x, y: F + 1.6, z: z + 0.3, color: '#ffd9a0', size: 0.9, strength: 1.4 });
    ctx.block.circle(x, z, 0.42); }

  // ---- what holds it up: the terrace sits on the rock; a corbel table runs under the parapet and a bastion carries the bay down the cliff
  { const YB = -12.5, RM = [[X0 - 0.2, -62.3], [X1 + 0.2, -62.3], [X1 + 0.2, ZN - 0.2], [23.6, ZN - 0.2], [22.4, ZB - 0.2], [18.6, ZB - 0.2], [17.4, ZN - 0.2], [X0 - 0.2, ZN - 0.2]];
    const sh = m => (x, y, z) => m * clamp(1 + y * 0.03, 0.62, 1);
    B.add(M.stone, K.shade(K.poly(RM, YB, F - 0.3), sh(0.86)));
    const RC = [[X0 - 0.36, -62.3], [X1 + 0.36, -62.3], [X1 + 0.36, ZN - 0.36], [23.7, ZN - 0.36], [22.5, ZB - 0.36], [18.5, ZB - 0.36], [17.3, ZN - 0.36], [X0 - 0.36, ZN - 0.36]];
    B.add(M.sand, K.tint(K.poly(RC, F - 0.3, F - 0.08), 0.8));                                        // corbel table under the parapet
    const W = K.wall([X1 + 0.2, ZN - 0.2], [X0 - 0.2, ZN - 0.2], YB);                                 // walking west: the front faces north
    for (let u = 0.45; u < W.L; u += 0.62) { const x = X1 + 0.2 - u; if (x > 17.1 && x < 23.9) continue; B.add(M.sand, K.tint(W.box(u - 0.11, u + 0.11, F - 0.52 - YB, F - 0.3 - YB, 0, 0.13), 0.7)); }
    // under the bay a squared bastion stands out of the rock: battered foot, corner buttresses, three blind lancets
    const BX0 = 17.15, BX1 = 23.85, BZ = ZB - 0.45, BT = -1.0;
    B.add(M.stone, K.shade(K.box(BX0, YB, BZ, BX1, BT, -62.3), sh(0.9)));
    B.add(M.sand, K.tint(K.box(BX0 - 0.1, BT, BZ - 0.1, BX1 + 0.1, BT + 0.16, -62.3), 0.74));
    for (const sx of [-1, 1]) { const x0 = sx < 0 ? BX0 : 22.45, x1 = sx < 0 ? 18.55 : BX1;                             // weathered slopes over the corners the bay leaves
      B.add(M.sand, K.tint(K.poly([[x0, ZN - 0.3], [x1, ZN - 0.3], [x1, BZ], [x0, BZ]], BT + 0.16, BT + 0.3), 0.66)); }
    const Wb = K.wall([BX1, BZ], [BX0, BZ], YB), top = BT - YB, Lb = Wb.L, lan = [1.85, 3.35, 4.85];
    B.add(M.stone, K.shade(Wb.solid({ t: 0.26, w: 0.13, h: top, holes: lan.map(u => K.arch(u, 4.4, 0.95, 8.6, 1.0)) }), sh(0.97)), K.tint(Wb.box(1.2, 5.5, 4.3, 10.0, 0.005, 0.03), 0.4),
      K.shade(Wb.box(-0.25, Lb + 0.25, 0, 3.2, 0, 0.62), sh(0.8)), K.shade(Wb.box(-0.15, Lb + 0.15, 3.2, 3.4, 0, 0.45), sh(0.95)));
    B.add(M.sand, K.tint(Wb.box(1.1, 5.6, 4.16, 4.4, 0.2, 0.38), 0.7), lan.map(u => K.tint(Wb.archTrim(u, 4.4, 0.95, 8.6, 1.0, { band: 0.14, depth: 0.1, at: 0.26 }), 0.72)));
    for (const u of [0.5, Lb - 0.5]) B.add(M.stone, K.shade(Wb.buttress(u, { width: 1.0, face: 0.26, stages: [[1.5, 4.6], [1.0, 8.2], [0.5, 10.5]] }), sh(0.94))); }

  // ---- small life on the terrace
  ctx.plant('leaves', { x: 14.4, z: -61.6, r: 1.3, n: 14, kind: 'dry', y: F + 0.01 }); ctx.plant('leaves', { x: 13.8, z: -62.2, r: 0.7, n: 6, kind: 'dry', y: F + 0.54 }); ctx.plant('leaves', { x: 22.6, z: -59.2, r: 1.8, n: 12, kind: 'autumn', y: F + 0.01 });
  ctx.plant('leaves', { x: 24.6, z: -62.2, r: 1.2, n: 8, kind: 'dry', y: F + 0.01 }); ctx.plant('leaves', { x: 18.6, z: -56.6, r: 1.2, n: 6, kind: 'dry', y: 0.16 });
  for (const [x, z, n, kind] of [[13.3, -58.5, 2, 'tuft'], [25.3, -59.3, 3, 'weed'], [22.9, -63.0, 2, 'tuft'], [24.3, -63.0, 3, 'weed'], [16.4, -63.0, 2, 'weed'], [25.4, -61.9, 2, 'tuft'], [21.4, -58.0, 1, 'tuft']])
    ctx.plant('grass', { x, z, r: 0.35, n, kind, y: F, seed: Math.round(x * 13 + z * 7) });                                     // grass in the joints, at the edges only
  ctx.plant('grass', { x: 15.6, z: -56.9, r: 0.5, n: 3, kind: 'weed', seed: 3 }); ctx.plant('grass', { x: 21.9, z: -56.9, r: 0.5, n: 3, kind: 'tuft', seed: 4 });
  ctx.plant('grass', { x: 24.3, z: -57.1, r: 0.8, n: 4, kind: 'tall', seed: 5 }); ctx.plant('grass', { x: 13.4, z: -57.1, r: 0.7, n: 3, kind: 'tall', seed: 6 });
  ctx.plant('ivy', { x: 24.0, y: 0.24, z: ZS + 0.12, nx: 0, nz: 1, w: 2.4, h: 0.5, density: 0.7, seed: 21 }); ctx.plant('ivy', { x: X0, y: 1.0, z: -57.46, nx: 0, nz: 1, w: 0.8, h: 1.4, density: 0.6, seed: 22 });
  ctx.plant('ivy', { x: X0 - 0.32, y: 0.8, z: -62.0, nx: -1, nz: 0, w: 2.6, h: 1.7, density: 0.75, seed: 23 }); ctx.plant('ivy', { x: X1 + 0.32, y: 0.7, z: -59.6, nx: 1, nz: 0, w: 3, h: 1.6, density: 0.6, seed: 24 });

  // the vista: easing from the look-down to an almost level view north over the parapet
  ctx.spot({ id: 'lookout', x: 18.3, z: -60.4, r: 1.7, label: '二つの月を眺める', kind: 'look' });
  ctx.camZone({ x: 18.3, z: -61.8, r: 3.0, fall: 6, pitch: 1.5, dist: 28, lift: 6.0 });

  // ================================================================================================ the north cliff
  const cz = x => L.cliffZ(x), underT = x => x > X0 - 0.9 && x < X1 + 0.8;
  const topAt = x => Math.min(0, L.terrain(x, cz(x) + 1.2));                 // the plateau surface at the edge (falls away on the shoulders)
  // a continuous skin: the rock lip of the edge and a rough curtain down the face (so no terrain shows between the masses)
  { const pos = [], rows = [[0.5, -0.12], [0.45, 0.12], [-0.5, 0.1], [-0.85, -2], [-1.3, -7], [-1.8, -16], [-2.6, -37]], P = [];
    for (let x = -46; x <= 46.01; x += 1) { const t = topAt(x), jz = (HD.fbm(x * 0.7, 3.1, 5, 2) - 0.5) * 0.7; P.push(rows.map((rw, j) => [x + (j > 2 ? (HD.hash2(x * 7, j, 3) - 0.5) * 0.5 : 0), Math.max(-37, t + rw[1] + (j === 1 || j === 2 ? (HD.hash2(x * 5, j, 9) - 0.5) * 0.1 : 0)), cz(x) + rw[0] + (j < 2 ? jz : j > 2 ? (HD.hash2(x * 3, j, 4) - 0.5) * 0.6 : 0)])); }
    for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) { const a = P[i][j], b = P[i + 1][j], c = P[i][j + 1], d = P[i + 1][j + 1]; pos.push(...a, ...b, ...c, ...b, ...d, ...c); }
    rock(geom(pos), 0.82); }
  // the bedded masses of the face
  { const r = rng(7711); let i = 0;
    for (let x = -45; x < 45; i++) { const w = r.range(2.7, 3.9), cx = x + w / 2, t = topAt(cx), under = underT(cx), zo = r.range(0.1, 1.0); x += w;
      rock(stack({ x: cx, z: cz(cx) - 0.95, top: cx > 17.2 && cx < 23.8 ? -9.6 - r.range(0, 1.2) : under ? -0.25 : t + r.range(0.14, 0.42), base: -36, a0: w * 0.6 + 0.55, b0: r.range(1.45, 2.1), a1: w * 0.6 + r.range(1.6, 3.2), b1: r.range(5.5, 9.5), n: 10, seed: 100 + i * 7,
        th0: r.range(0.9, 1.5), thk: 1.38, th1: 6.5, drift: [r.range(-1, 1), -r.range(1.5, 4)], zmax: xx => cz(xx) + zo, rough: 0.22, tilt: 0.03 }), r.range(0.88, 1.04)); } }
  // the rock the terrace wall stands on
  rock(stack({ x: 19.4, z: -64.6, top: -11.6, base: -36, a0: 8.6, b0: 3.3, a1: 11.5, b1: 8.5, n: 12, seed: 61, th0: 2.2, thk: 1.3, th1: 7, drift: [0, -2.5], rough: 0.14 }), 0.95);
  // spurs: shoulders stepping down northward, low enough to be seen over the edge from the play camera
  const spurs = [
    { x: 30.2, z: -67.6, top: -3.4, a0: 2.3, b0: 3.6, a1: 6.5, b1: 9, seed: 71, drift: [1.2, -4] }, { x: 31.8, z: -75.2, top: -9.5, a0: 2.2, b0: 3.2, a1: 6, b1: 7, seed: 72, drift: [0.5, -3] },
    { x: 8.0, z: -67.2, top: -4.2, a0: 2.6, b0: 3.4, a1: 6.5, b1: 8.5, seed: 73, drift: [-1, -4] }, { x: 6.8, z: -72.4, top: -10.5, a0: 2.0, b0: 2.6, a1: 5.5, b1: 6, seed: 74, drift: [-0.5, -2] },
    { x: -24.5, z: -67.0, top: -3.8, a0: 2.8, b0: 3.2, a1: 6.5, b1: 8, seed: 75, drift: [-1, -4] }, { x: -4.0, z: -66.6, top: -6.5, a0: 2.4, b0: 2.8, a1: 6, b1: 7.5, seed: 76, drift: [0.6, -3.5] } ];
  for (const s of spurs) rock(stack(Object.assign({ base: -36, n: 10, th0: 1.5, thk: 1.32, th1: 6.5, rough: 0.22, ledgeP: 0.5 }, s)), 0.97);
  // detached pinnacles standing out of the clouds: each a cluster of a main spire, a lower companion and a broad foot
  const pins = [ { x: 6.4, z: -77.5, top: 3.2, s: 1, seed: 81 }, { x: 31.2, z: -81.5, top: 5.4, s: 1.15, seed: 82 }, { x: 26.6, z: -95, top: -0.8, s: 0.95, seed: 83 }, { x: -15.5, z: -76, top: 0.6, s: 1, seed: 84 } ];
  for (const p of pins) { const r = rng(p.seed), s = p.s, a = r.range(0, 6.28), d = 2.1 * s;
    rock(stack({ x: p.x, z: p.z, top: p.top, base: p.top - 17, a0: 0.5 * s, b0: 0.42 * s, a1: 2.5 * s, b1: 2.2 * s, n: 9, seed: p.seed, th0: 0.9, thk: 1.22, th1: 3.6, rough: 0.28, ledgeP: 0.4, pow: 1.3, drift: [r.range(-0.8, 0.8), r.range(-0.6, 0.6)], dip: [r.range(-0.12, 0.12), 0.04], peak: 0.5, wander: 0.09 }), 1.02);
    rock(stack({ x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, top: p.top - r.range(4.5, 7), base: p.top - 20, a0: 0.45 * s, b0: 0.5 * s, a1: 2.2 * s, b1: 2.0 * s, n: 8, seed: p.seed + 100, th0: 1.0, thk: 1.25, th1: 3.6, rough: 0.28, ledgeP: 0.4, pow: 1.2, dip: [0.1, -0.05], peak: 0.4, wander: 0.09 }), 0.96);
    rock(stack({ x: p.x - Math.cos(a) * d * 0.9, z: p.z - Math.sin(a) * d * 0.9 - 0.5, top: p.top - r.range(9, 11.5), base: p.top - 22, a0: 0.6 * s, b0: 0.5 * s, a1: 2.0 * s, b1: 1.8 * s, n: 8, seed: p.seed + 200, th0: 1.1, thk: 1.25, th1: 3.6, rough: 0.28, pow: 1.2, peak: 0.35 }), 0.94);
    rock(stack({ x: p.x + 0.4, z: p.z - 0.3, top: p.top - 13.5, base: -36, a0: 3.4 * s, b0: 3.0 * s, a1: 7 * s, b1: 6.4 * s, n: 10, seed: p.seed + 300, th0: 2.2, thk: 1.25, th1: 6.5, rough: 0.22, ledgeP: 0.5, wander: 0.06 }), 0.95); }

  // ---- the rim: weathered outcrops and boulders standing a little above the edge (low behind the church, none through the terrace)
  { const r = rng(4021);
    for (let x = -43; x < 43; ) { x += r.range(1.1, 2.6); if (underT(x)) continue;
      const g0 = topAt(x), env = x > -10.6 && x < X0 ? 0.62 : 1, h = (0.32 + r() * r() * 1.35) * env, z = cz(x) + r.range(-0.5, 0.35), seed = r.int(1, 99999), a = r.range(0.55, 1.1) + h * 0.4;
      rock(stack({ x, z, top: g0 + h, base: g0 - 0.8, a0: a * 0.7, b0: a * r.range(0.4, 0.6), a1: a + r.range(0.3, 0.6), b1: a * 0.75 + r.range(0.25, 0.5), n: 7, seed, th0: 0.2 + h * 0.35, thk: 1.2, th1: 1.0,
        dip: [r.range(-0.22, 0.22), r.range(-0.05, 0.16)], rough: 0.28, ledgeP: 0.6, peak: h * 0.15 }), r.range(0.94, 1.1));
      for (let j = r.int(0, 2); j > 0; j--) { const bx = x + r.range(-1.3, 1.3), bz = cz(bx) + r.range(-0.2, 0.7), s = r.range(0.3, 0.62) * (0.6 + env * 0.4); if (underT(bx)) continue;      // boulders leaning on it
        rock(K.rock({ x: bx, y: topAt(bx) + s * 0.3, z: bz, sx: s * r.range(1, 1.5), sy: s * r.range(0.7, 1.1), sz: s, seed: seed + j, detail: 1, ry: r.range(0, 3) }), r.range(0.95, 1.1)); }
      for (let j = r.int(0, 2); j > 0; j--) { const sx = x + r.range(-1.4, 1.4), sz = cz(sx) + r.range(0.3, 1.3), s = r.range(0.12, 0.26); if (underT(sx)) continue;
        rock(K.rock({ x: sx, y: topAt(sx) + s * 0.25, z: sz, sx: s * 1.2, sy: s, sz: s, seed: seed + j + 9, detail: 0, ry: r.range(0, 3) }), 1.06); } } }
  // the shoulders: crags over the slope at the north-east and north-west corners, and one tall crag each side to frame the view
  { const r = rng(5501);
    for (const sg of [1, -1]) {
      for (let i = 0; i < 11; i++) { const x = sg * (28.6 + r.range(0, 7.5)), z = Math.max(cz(x) + 0.9, -62.6 + r.range(0, 9.5)), t = L.terrain(x, z), a = r.range(1.2, 2.4);
        rock(stack({ x, z, top: t + r.range(0.5, 1.6), base: t - 4.5, a0: a, b0: a * r.range(0.6, 0.9), a1: a + 1.2, b1: a + 0.8, n: 8, seed: 300 + i * 3 + (sg > 0 ? 0 : 50), th0: 0.8, thk: 1.3, th1: 2.4, dip: [-sg * r.range(0.25, 0.5), r.range(-0.05, 0.1)], rough: 0.24 }), r.range(0.9, 1.05)); }
      const X = sg * 30.4, Z = sg > 0 ? -60.7 : -60.9;
      rock(stack({ x: X, z: Z, top: sg > 0 ? 4.4 : 3.3, base: -6, a0: 0.6, b0: 0.5, a1: 3.3, b1: 2.8, n: 10, seed: sg > 0 ? 401 : 402, th0: 0.55, thk: 1.17, th1: 1.9, dip: [sg * 0.12, 0.05], rough: 0.28, ledgeP: 0.5, drift: [sg * 0.8, 0.3], peak: 0.45, wander: 0.08, pow: 1.15 }), 1.04);
      rock(stack({ x: X + sg * 1.9, z: Z + 2.7, top: 1.5, base: -7, a0: 0.9, b0: 0.7, a1: 2.6, b1: 2.2, n: 8, seed: sg > 0 ? 403 : 404, th0: 0.7, thk: 1.25, th1: 2.2, dip: [-sg * 0.2, 0.05], rough: 0.26 }), 0.98);
      ctx.block.circle(X, Z, 2.2); } }

  // moss cushions at the foot of the rim rocks, in the damp corners of the terrace and along the ledge wall
  { const r = rng(6107), mo = (x, y, z, s) => K.tint(K.rock({ x, y, z, sx: s * r.range(1, 1.5), sy: s * 0.22, sz: s * r.range(0.7, 1.1), seed: r.int(1, 9999), detail: 0, ry: r.range(0, 3) }), r.range(0.85, 1.1));
    for (let x = -33; x < 34; x += r.range(1.6, 3.4)) { if (underT(x)) continue; const z = cz(x) + r.range(0.4, 1.5); B.add(M.moss, mo(x, Math.max(topAt(x), L.terrain(x, z)) + (z < cz(x) + 0.9 ? 0.34 : 0.03), z, r.range(0.35, 0.7))); }
    for (const [x, z] of [[13.2, -59.0], [25.5, -60.0], [22.9, -63.05], [16.9, -63.1], [25.3, -62.9], [14.4, -58.3], [19.2, -64.95]]) B.add(M.moss, mo(x, F + 0.02, z, r.range(0.25, 0.42)));
    for (const [x, z] of [[-8, -59.5], [-5.2, -59.7], [0.4, -59.6], [3.6, -59.4], [8, -59.5], [10.4, -59.6], [-1.2, -60.7], [7.4, -60.5]]) B.add(M.moss, mo(x, 0.04, z, r.range(0.3, 0.55))); }

  // ---- what clings to it
  ctx.plant('tree', { x: 29.0, z: -59.6, kind: 'pine', h: 6.4, seed: 11, lean: -0.18 }); ctx.plant('tree', { x: -29.2, z: -59.6, kind: 'dead', h: 5.5, seed: 12, lean: 0.2 });
  ctx.plant('tree', { x: 30.0, z: -68.6, y: -3.3, kind: 'pine', h: 4.2, seed: 13, lean: 0.3 }); ctx.plant('tree', { x: 8.2, z: -68.0, y: -4.1, kind: 'dead', h: 3.6, seed: 14, lean: -0.3 });
  ctx.plant('tree', { x: 6.6, z: -77.3, y: 3.1, kind: 'dead', h: 3.0, seed: 15, lean: 0.25 }); ctx.plant('tree', { x: 31.4, z: -81.3, y: 5.3, kind: 'pine', h: 3.4, seed: 16, lean: -0.3 });
  ctx.plant('tree', { x: -24.2, z: -67.6, y: -3.7, kind: 'pine', h: 4.0, seed: 17, lean: 0.3 }); ctx.plant('tree', { x: -3.6, z: -66.9, y: -6.4, kind: 'dead', h: 3.2, seed: 18, lean: 0.2 });
  for (const [x, dz, rr, kind] of [[27.4, 1.3, 0.8, 'bramble'], [10.6, 1.0, 0.55, 'shrub'], [2.5, 0.9, 0.5, 'fern'], [-6.5, 1.1, 0.6, 'shrub'], [-21.5, 1.2, 0.8, 'bramble'], [-27, 1.4, 0.9, 'shrub'], [32.2, 3.2, 0.9, 'shrub']])
    ctx.plant('bush', { x, z: cz(x) + dz, r: rr, kind, seed: Math.round(x * 3 + 50) });
  ctx.plant('bush', { x: 30.9, z: -67.2, y: -3.3, r: 0.8, kind: 'shrub', seed: 61 }); ctx.plant('bush', { x: 7.3, z: -66.4, y: -4.1, r: 0.7, kind: 'bramble', seed: 62 });
  for (let x = -32; x <= 32; x += 3.1) { if (underT(x)) continue; ctx.plant('grass', { x: x + 0.6, z: cz(x) + 1.5, r: 1.3, n: 5, kind: x > -10 && x < 12 ? 'tuft' : 'tall', seed: Math.round(x * 5 + 200) }); }

  // ================================================================================================ the ledge wall behind the church
  { const r = rng(881), smooth = t => t * t * (3 - 2 * t);
    const runs = [ { a: [-10.75, -58.95], b: [-9.6, -59.95], seed: 3, env: u => 0.9 }, { a: [-9.6, -59.95], b: [-3.7, -60.3], seed: 4, env: u => 1 - 0.85 * smooth(clamp((u - 0.7) / 0.3, 0, 1)) },
      { a: [-2.1, -60.25], b: [5.1, -59.9], seed: 6, env: u => smooth(clamp(u / 0.2, 0, 1)) * (1 - 0.9 * smooth(clamp((u - 0.75) / 0.25, 0, 1))) }, { a: [6.5, -59.95], b: [11.5, -60.12], seed: 9, env: u => 0.15 + 0.85 * smooth(clamp(u / 0.5, 0, 1)) } ];
    for (const q of runs) { const W = K.wall(q.a, q.b, -0.3), top = K.ruin(W.L, { seed: q.seed, lo: 0.8, hi: 1.9, course: 0.275, block: 0.7, scale: 2.6, env: q.env });
      B.add(M.rubble, W.solid({ t: 0.62, top }), K.tint(W.box(-0.1, W.L + 0.1, 0, 0.46, -0.43, 0.43), 0.8));
      for (let u = 0.15; u < W.L - 0.8; ) { const len = r.range(0.7, 1.15), h = K.topAt(top, u + len / 2); if (h >= 1.6 && Math.abs(K.topAt(top, u + 0.04) - h) < 0.01 && Math.abs(K.topAt(top, u + len - 0.08) - h) < 0.01 && r() < 0.8) B.add(M.stone, K.tint(W.box(u, u + len - 0.05, h, h + 0.13, -0.38, 0.38), r.range(0.9, 1.08))); u += len; }
      ctx.block.seg(q.a[0], q.a[1], q.b[0], q.b[1], 0.44);
      const mid = W.xz(W.L * 0.5, 0.33); ctx.plant('ivy', { x: mid[0], y: 0.7, z: mid[1], nx: W.nx, nz: W.nz, w: Math.min(3.2, W.L * 0.6), h: 1.3, density: 0.65, seed: q.seed + 40 });
      ctx.plant('grass', { x: mid[0], z: mid[1] + 0.7, r: W.L * 0.35, n: Math.round(W.L * 1.2), kind: 'weed', seed: q.seed + 60 }); }
    // the join with the terrace: a squared end pier with a weathered cap
    B.add(M.stone, K.tint(K.boxc(11.82, -0.3, -60.12, 0.84, 0.5, 0.96), 0.8), K.boxc(11.82, 0.2, -60.12, 0.7, 1.75, 0.82));
    B.add(M.sand, K.tint(K.boxc(11.82, 1.95, -60.12, 0.84, 0.1, 0.96), 0.9), K.xform(K.spire({ x: 0, y: 0, z: 0, r: 0.6, h: 0.3 }), { sx: 0.99, sz: 1.13, x: 11.82, y: 2.05, z: -60.12 }));
    ctx.block.rect(11.4, -60.6, 12.2, -59.64);
    // fallen stones at the gaps and along the foot
    B.add(M.rubble, K.rubble({ x: -2.9, z: -60.1, n: 10, spread: 1.3, size: [0.2, 0.5], seed: 51 }), K.rubble({ x: 5.8, z: -59.8, n: 9, spread: 1.2, size: [0.2, 0.5], seed: 52 }),
      K.rubble({ x: 1.5, z: -59.4, n: 4, spread: 0.9, size: [0.16, 0.36], seed: 53 }), K.rubble({ x: -7, z: -59.5, n: 4, spread: 1.0, size: [0.16, 0.36], seed: 54 }), K.rubble({ x: 9.2, z: -59.3, n: 4, spread: 0.9, size: [0.16, 0.36], seed: 55 }),
      K.rubble({ x: -10.4, z: -58.7, n: 4, spread: 0.6, size: [0.2, 0.4], seed: 56 }));
    ctx.block.circle(-2.9, -60.25, 0.8); ctx.block.circle(5.8, -59.9, 0.8); }

  B.build();
}; })();
