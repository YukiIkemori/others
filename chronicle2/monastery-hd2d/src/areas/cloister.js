// Area: the cloister garth and the spring (x -27..-11, z -50..-32, west of the church).
// A walled garden gone wild: the spring basin in the middle with the two moons in its water, the surviving north side
// of the cloister walk (the hero passes behind its arches on the way to the tower), the closing wall behind it, the
// stumps of the south arcade, and the old tree that still turns red.
(function () {
  const HD = window.HD; HD.areas = HD.areas || {};

  HD.areas.cloister = function (ctx) {
    const T = THREE, K = ctx.K, M = ctx.M, L = ctx.L, P = HD.P;
    const B = ctx.batch();
    const TAU = Math.PI * 2, DEG = Math.PI / 180;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const gy = (x, z) => L.terrain(x, z);
    const PX = L.POOL.x, PZ = L.POOL.z, TX = L.RED_TREE.x, TZ = L.RED_TREE.z;
    const WATER_Y = 0.46, V0 = -0.3;                        // water level; how far masonry goes into the ground

    // ------------------------------------------------------------------------------------------------ local helpers
    // sweep(profile [[r,y]..] closed, cx, cz, a0, a1, steps, y0): a moulded ring segment (kerb stone, coping, curved seat):
    // the profile is turned about the vertical through (cx, cz) from plan angle a0 to a1 (0 = east, 90deg = south). Faceted.
    function sweep(prof, cx, cz, a0, a1, steps, y0) {
      let area = 0; for (let i = 0; i < prof.length; i++) { const p = prof[i], q = prof[(i + 1) % prof.length]; area += p[0] * q[1] - q[0] * p[1]; }
      if (area < 0) prof = prof.slice().reverse();
      const n = prof.length, pos = []; y0 = y0 || 0;
      const pt = (i, a) => { const p = prof[i % n]; return [cx + Math.cos(a) * p[0], y0 + p[1], cz + Math.sin(a) * p[0]]; };
      const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      for (let s = 0; s < steps; s++) { const A = a0 + (a1 - a0) * s / steps, C = a0 + (a1 - a0) * (s + 1) / steps;
        for (let i = 0; i < n; i++) { const p00 = pt(i, A), p10 = pt(i + 1, A), p01 = pt(i, C), p11 = pt(i + 1, C); tri(p00, p10, p11); tri(p00, p11, p01); } }
      const faces = T.ShapeUtils.triangulateShape(prof.map(p => new T.Vector2(p[0], p[1])), []);
      for (const f of faces) { const a = prof[f[0]], b = prof[f[1]], c = prof[f[2]]; const ccw = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) > 0; const i0 = f[0], i1 = ccw ? f[1] : f[2], i2 = ccw ? f[2] : f[1];
        tri(pt(i0, a1), pt(i1, a1), pt(i2, a1)); tri(pt(i0, a0), pt(i2, a0), pt(i1, a0)); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
    }
    const rectProf = (r0, r1, y0, y1) => [[r0, y0], [r1, y0], [r1, y1], [r0, y1]];
    // ragged(u0, u1, hf, seed, course, bmin, bmax, minAt): a wall top broken down block by block around the height hf(u);
    // minAt(u) (optional) is a height the top must stay above (the heads of openings).
    function ragged(u0, u1, hf, seed, course, bmin, bmax, minAt, jit) {
      const r = ctx.rng(seed), pts = []; let u = u0; jit = jit === undefined ? 0.6 : jit;
      while (u < u1 - 1e-6) { let bl = r.range(bmin, bmax); if (u1 - u - bl < bmin * 0.8) bl = u1 - u;
        let h = Math.round((hf(u + bl / 2) + r.range(-jit, jit) * course) / course) * course;
        if (minAt) { let m = 0; for (let k = 0; k <= 4; k++) m = Math.max(m, minAt(u + bl * k / 4)); if (m > 0) h = Math.max(h, Math.ceil(m / course - 1e-6) * course); }
        h = Math.max(course, h); pts.push([u, h], [u + bl, h]); u += bl; }
      pts[pts.length - 1][0] = u1; return pts;
    }
    const clean = pts => pts.filter((p, i) => { const q = pts[(i + pts.length - 1) % pts.length]; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > 1e-4; });
    // one point of a pointed arch: side +1 = the arc springing from the right jamb, -1 from the left; t 0 (spring) .. 1 (apex); off = distance outside the intrados
    function arcPt(cx, w, spring, rise, off, side, t) { const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw, a = Math.acos(c / R) * t; return [cx + side * (-c + Math.cos(a) * (R + off)), spring + Math.sin(a) * (R + off)]; }
    const archH = (u, cx, w, sp, rs) => { const hw = w / 2, d = Math.abs(u - cx); if (d >= hw) return 0; const R = (hw * hw + rs * rs) / w, c = R - hw; return sp + Math.sqrt(Math.max(0, R * R - (d + c) * (d + c))); };
    // a band of voussoirs along part of one arc (broken arches), in wall coordinates
    function archBand(W, cx, w, spring, rise, side, t0, t1, off0, off1, w0, w1) { const n = 5, pts = [];
      for (let i = 0; i <= n; i++) pts.push(arcPt(cx, w, spring, rise, off0, side, t0 + (t1 - t0) * i / n));
      for (let i = n; i >= 0; i--) pts.push(arcPt(cx, w, spring, rise, off1, side, t0 + (t1 - t0) * i / n));
      const g = K.extrude(pts, w1 - w0, null); g.translate(0, 0, w0); return W.put(g); }
    // prism(W, profile [[w,v]..], u0, u1): a moulding of constant section running along a wall (weathered copings and sills)
    function prism(W, prof, u0, u1) { const g = K.extrude(prof.map(p => [-p[0], p[1]]), u1 - u0, null); g.rotateY(Math.PI / 2); g.translate(u0, 0, 0); return W.put(g); }
    const coping = (hw, v, th) => [[-hw, v], [hw, v], [hw, v + th * 0.5], [hw - 0.07, v + th], [-hw + 0.07, v + th], [-hw, v + th * 0.5]];
    // colonnette: slender turned shaft with an attic base and a bell capital (or snapped off: broken)
    function colo(x, y, z, h, r, broken, sides) { const pr = [[r * 1.8, 0], [r * 1.8, 0.05], [r * 1.35, 0.08], [r * 1.62, 0.12], [r * 1.15, 0.16], [r, 0.2]];
      if (broken) pr.push([r * 0.94, h - 0.04], [r * 0.55, h + 0.03], [0, h - 0.02]);
      else pr.push([r * 0.9, h - 0.38], [r * 1.32, h - 0.36], [r * 1.32, h - 0.31], [r * 0.95, h - 0.29], [r * 1.05, h - 0.2], [r * 1.7, h - 0.06], [r * 2.0, h - 0.02], [r * 2.0, h], [0, h]);
      return K.lathe(pr, sides || 8, { x, y, z, ry: (x * 7.3 + z * 3.1) % 1 }); }
    // a pair of colonnettes across the wall thickness on a shared plinth, carrying one impost block. h = sill to the top of the impost.
    function pair(W, u, v, h, o) { o = o || {}; const r = o.r || 0.085, sp = o.sp === undefined ? 0.17 : o.sp, gs = [], a = W.xz(u, sp), b = W.xz(u, -sp), y = W.y0 + v;
      gs.push(W.box(u - 0.17, u + 0.17, v, v + 0.07, -sp - 0.17, sp + 0.17));
      gs.push(colo(a[0], y + 0.07, a[1], h - 0.2, r), colo(b[0], y + 0.07, b[1], h - 0.2, r));
      gs.push(W.box(u - 0.19, u + 0.19, v + h - 0.13, v + h - 0.08, -sp - 0.19, sp + 0.19), W.box(u - 0.22, u + 0.22, v + h - 0.08, v + h, -sp - 0.21, sp + 0.21));
      return gs; }
    // bar(p1, p2, w, h): a beam between two points
    function bar(p1, p2, w, h) { const a = new T.Vector3(p1[0], p1[1], p1[2]), b = new T.Vector3(p2[0], p2[1], p2[2]), d = b.clone().sub(a), g = new T.BoxGeometry(w, h, d.length(), 1, 1, 3);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), d.clone().normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); return g; }
    // moss cushions on the top of a broken wall (wall coordinates: between u0 and u1 at height h, within +-hw of the centre plane)
    const mossTop = (W, u0, u1, h, hw, r) => { const n = u1 - u0 > 0.85 ? 2 : 1, gs = []; for (let k = 0; k < n; k++) { const p = W.xz(r.range(u0 + 0.15, u1 - 0.15), r.range(-hw, hw));
      gs.push(K.tint(K.rock({ x: p[0], y: W.y0 + h + 0.008, z: p[1], sx: r.range(0.16, 0.3), sy: r.range(0.045, 0.07), sz: r.range(0.12, 0.19), seed: Math.round(p[0] * 91 + h * 13) + k, detail: 1, ry: r.range(0, 3) }), r.range(0.72, 0.95))); } return gs; };
    // local pieces built about the origin, then stood in the world together: at(o, [material, geom...], ...)
    const at = (o, ...sets) => { for (const s of sets) B.add(s[0], s.slice(1).flat(Infinity).filter(Boolean).map(g => K.xform(g, o))); };
    const grassLine = (ax, az, bx, bz, step, o) => { const len = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(len / step)); for (let i = 0; i <= m; i++) { const t = i / m, x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (L.pathDist(x, z) < 1.2) continue; ctx.plant('grass', Object.assign({ x, z, seed: Math.round(x * 13 + z * 29) + i }, o)); } };

    // ============================================================================================ the spring basin
    {
      const r = ctx.rng(57), NSEG = 24;
      // the basin wall: 24 stones on a chamfered plinth course
      const body = [[2.6, V0], [3.2, V0], [3.2, 0.1], [3.11, 0.19], [3.04, 0.19], [3.04, 0.56], [2.6, 0.56]];
      for (let i = 0; i < NSEG; i++) { const a0 = i / NSEG * TAU, a1 = (i + 1) / NSEG * TAU; B.add(M.stone, K.tint(sweep(body, PX, PZ, a0 + 0.005, a1 - 0.005, 1, r.range(-0.012, 0.012)), r.range(0.84, 1.04))); }
      // a low step round its foot, two stones missing
      for (let i = 0; i < 16; i++) { if (i === 2 || i === 9) continue; const a0 = (i + 0.3) / 16 * TAU, a1 = (i + 1.3) / 16 * TAU; B.add(M.stoneDark, K.tint(sweep([[3.16, V0], [3.42, V0], [3.42, 0.07], [3.385, 0.115], [3.16, 0.115]], PX, PZ, a0 + 0.006, a1 - 0.006, 2, r.range(-0.015, 0.01)), r.range(0.95, 1.2))); }
      // the moulded rim: twelve coping stones, breaking joint with the wall below. One has fallen out (south-east), one has slipped.
      const cop = [[2.53, 0.56], [3.1, 0.56], [3.14, 0.6], [3.14, 0.67], [3.09, 0.73], [3.0, 0.76], [2.62, 0.76], [2.55, 0.72]];
      for (let j = 0; j < 12; j++) { if (j === 1) continue; const a0 = (7.5 + 30 * j) * DEG, a1 = a0 + 30 * DEG; let cx = PX, cz = PZ, y = r.range(-0.008, 0.012);
        if (j === 9) { cx += 0.05; cz -= 0.03; y -= 0.03; }
        B.add(M.sand, K.tint(sweep(cop, cx, cz, a0 + 0.007, a1 - 0.007, 2, y), r.range(0.9, 1.07))); }
      { const a = 52 * DEG, g = sweep(cop, 0, 0, -14 * DEG, 14 * DEG, 2, -0.66); g.translate(-2.84, 0, 0);       // the fallen coping stone, leaning on the plinth
        B.add(M.sand, K.tint(K.xform(g, { x: PX + Math.cos(a) * 3.5, y: 0.3, z: PZ + Math.sin(a) * 3.5, ry: -a + 0.5, rz: 0.6, rx: 0.12 }), 0.95));
        for (let k = 0; k < 4; k++) { const b = (40 + k * 7.5 + r.range(-2, 2)) * DEG, rr = r.range(2.72, 2.98); B.add(M.stone, K.rock({ x: PX + Math.cos(b) * rr, y: 0.57, z: PZ + Math.sin(b) * rr, sx: r.range(0.07, 0.13), sy: 0.07, seed: 40 + k, detail: 0 })); } }
      // moss on the north side: it creeps over the rim and down the wall
      const mossCap = [[2.72, 0.5], [3.16, 0.5], [3.16, 0.68], [3.105, 0.748], [3.0, 0.778], [2.72, 0.778]], mossFoot = [[3.02, 0.02], [3.25, 0.02], [3.22, 0.16], [3.13, 0.24], [3.06, 0.4], [3.02, 0.4]];
      for (const s of [[206, 226], [232, 252], [287, 301], [306, 331], [338, 347]]) B.add(M.moss, K.tint(sweep(mossCap, PX, PZ, s[0] * DEG, s[1] * DEG, 2, 0), r.range(0.9, 1.1)));
      for (const s of [[198, 219], [236, 250], [290, 318], [326, 340]]) B.add(M.moss, K.tint(sweep(mossFoot, PX, PZ, s[0] * DEG, s[1] * DEG, 2, 0), r.range(0.8, 1.0)));
      for (let k = 0; k < 7; k++) { const a = r.range(195, 345) * DEG, rr = r.range(3.2, 3.42); B.add(M.moss, K.tint(K.rock({ x: PX + Math.cos(a) * rr, y: 0.12, z: PZ + Math.sin(a) * rr, sx: r.range(0.14, 0.24), sy: 0.06, sz: r.range(0.1, 0.16), seed: 60 + k, detail: 1, ry: a }), r.range(0.75, 0.95))); }

      // the flagging round the basin: two broken courses of big slabs, grass and earth in the gaps
      const fr = ctx.rng(311);
      const course = (r0, r1, aMin, aMax, skip) => { let a = fr.range(0, 0.4); const end = a + TAU;
        while (a < end - 0.04) { let da = fr.range(aMin, aMax); if (end - a - da < aMin * 0.7) da = end - a; const am = a + da / 2, x = PX + Math.cos(am) * (r0 + r1) / 2, z = PZ + Math.sin(am) * (r0 + r1) / 2;
          if (fr() > skip) { const sink = fr() < 0.2 ? -0.035 : 0; B.add(M.flag, K.tint(sweep(rectProf(r0 + fr.range(0.012, 0.04), r1 - fr.range(0.012, 0.07), V0, 0.075 + fr.range(0, 0.03) + sink), PX, PZ, a + 0.014, a + da - 0.014, 2, gy(x, z)), fr.range(0.86, 1.08))); }
          a += da; } };
      course(3.44, 4.06, 0.3, 0.5, 0.06); course(4.06, 4.72, 0.24, 0.4, 0.2);
      for (let k = 0; k < 9; k++) { const a = fr.range(0, TAU), rr = fr.range(4.85, 5.7), x = PX + Math.cos(a) * rr, z = PZ + Math.sin(a) * rr; if (Math.hypot(x - TX, z - TZ) < 2.2 || z < -43.4 && Math.abs(x - PX) < 1.2) continue;       // strays, half sunk in the grass
        const s = fr.range(0.3, 0.55), ry = fr.range(0, 3); B.add(M.flag, K.tint(K.xform(K.poly([[-s, -s * 0.7], [s * 0.8, -s * 0.8], [s, s * 0.5], [-s * 0.6, s * 0.75]], V0, 0.05), { x, y: gy(x, z), z, ry }), fr.range(0.8, 1.0))); }

      // the spring head: a gabled stone with a trefoiled niche, a worn mask and a stone spout, astride the north rim
      const SZ = -43.1, W = K.wall([PX - 0.7, SZ], [PX + 0.7, SZ], 0.42);
      B.add(M.stoneDark, K.box(PX - 0.86, V0, SZ - 0.5, PX + 0.86, 0.3, SZ + 0.36), K.tint(K.box(PX - 0.8, 0.3, SZ - 0.44, PX + 0.8, 0.42, SZ + 0.34), 1.08));
      B.add(M.stone, W.solid({ t: 0.62, h: 1.62, holes: [K.arch(0.7, 0.26, 0.82, 0.8, 0.62)] }), K.tint(W.box(0.2, 1.2, 0.2, 1.5, -0.31, 0.1), 0.62));
      B.add(M.sand, W.archTrim(0.7, 0.26, 0.82, 0.8, 0.62, { band: 0.1, depth: 0.05, at: 0.31 }), W.box(0.22, 1.18, 0.16, 0.26, 0.26, 0.4));
      for (const s of [-1, 1]) { const g = K.extrude([[0, 0], [0.15 * s, 0.07], [0.02 * s, 0.26]], 0.12, null); g.translate(0.7 - s * 0.41, 0.82, 0.19); B.add(M.sand, K.tint(W.put(g), 0.95)); }      // the cusps of the trefoil
      { const cap = K.extrude([[-0.84, 0], [0.84, 0], [0.84, 0.1], [0.1, 0.66], [-0.1, 0.66], [-0.84, 0.1]], 0.78, null); cap.translate(0.7, 1.62, -0.39); B.add(M.sand, K.tint(W.put(cap), 1.02));
        B.add(M.sand, K.tint(W.box(0.62, 0.78, 2.26, 2.62, -0.07, 0.07), 0.95), K.tint(K.xform(W.box(0.5, 0.74, 2.4, 2.52, -0.06, 0.06), {}), 0.9));       // the stump of a cross: one arm gone
        B.add(M.moss, K.tint(W.box(0.02, 0.5, 1.72, 1.76, -0.4, 0.2), 0.95), K.tint(W.box(-0.1, 0.5, 0.0, 0.03, 0.31, 0.45), 0.9)); }
      // mask: a round worn face with brow and muzzle; the water runs from its mouth along a stone spout
      { const fy = 0.42 + 0.9, fz = SZ + 0.1; const dome = K.lathe([[0.23, 0], [0.22, 0.07], [0.15, 0.13], [0.0, 0.16]], 8); dome.rotateX(Math.PI / 2); dome.translate(PX, fy, fz);
        B.add(M.sand, K.tint(dome, 0.98), K.tint(K.box(PX - 0.17, fy + 0.07, fz + 0.1, PX + 0.17, fy + 0.13, fz + 0.19), 1.05), K.tint(K.box(PX - 0.05, fy - 0.04, fz + 0.1, PX + 0.05, fy + 0.08, fz + 0.22), 1.0),
          K.tint(K.box(PX - 0.09, fy - 0.2, fz + 0.05, PX + 0.09, fy - 0.09, fz + 0.72), 0.94), K.tint(K.box(PX - 0.12, fy - 0.24, fz + 0.2, PX + 0.12, fy - 0.2, fz + 0.5), 0.85));
        B.add(M.stoneDeep, K.box(PX - 0.14, fy + 0.0, fz + 0.12, PX - 0.07, fy + 0.06, fz + 0.165), K.box(PX + 0.07, fy + 0.0, fz + 0.12, PX + 0.14, fy + 0.06, fz + 0.165), K.box(PX - 0.045, fy - 0.089, fz + 0.1, PX + 0.045, fy - 0.07, fz + 0.725)); }
      ctx.block.circle(PX, PZ, 3.25); ctx.block.rect(PX - 0.9, SZ - 0.55, PX + 0.9, SZ + 0.3);
      ctx.walkCircle(PX, PZ, 4.5);
    }
    const STREAM = { x: PX, z: -42.3, top: 1.2 };            // where the water leaves the spout and falls

    // ====================================================================================== the water (custom shader)
    {
      const lin = hex => new T.Color(hex).convertSRGBToLinear();
      const WR = 2.62, pos = [], kind = [], N = 40;
      for (let i = 0; i < N; i++) { const a0 = i / N * TAU, a1 = (i + 1) / N * TAU; pos.push(PX, WATER_Y, PZ, PX + Math.cos(a1) * WR, WATER_Y, PZ + Math.sin(a1) * WR, PX + Math.cos(a0) * WR, WATER_Y, PZ + Math.sin(a0) * WR); kind.push(0, 0, 0); }
      { const x = STREAM.x, z = STREAM.z, hw = 0.08, y0 = WATER_Y, y1 = STREAM.top; pos.push(x - hw, y0, z, x + hw, y0, z, x + hw, y1, z, x - hw, y0, z, x + hw, y1, z, x - hw, y1, z); kind.push(1, 1, 1, 1, 1, 1); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('kind', new T.Float32BufferAttribute(kind, 1));
      const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, {
        uTime: { value: 0 },
        uWater: { value: P.water.map(lin) },                                                    // the navy ramp, dark -> light (7)
        uDusk: { value: ['#0f0d22', '#1b1838', '#2b2843', '#443a5c', '#5d4a66', '#84607a', '#a9747a'].map(lin) },   // the sky ramp at the same steps: the mirrored dusk
        uMoonA: { value: lin('#fbe6c2') }, uMoonB: { value: lin('#ecc79a') },                    // white moon: lit face, maria
        uRimCol: { value: new T.Color(0.80, 0.46, 0.72) },                                      // black moon: its rose-violet rim (as in the sky)
        uPool: { value: new T.Vector3(PX, PZ, 2.55) },                                          // centre x, z and inner radius
        uSpring: { value: new T.Vector2(STREAM.x - PX, STREAM.z - PZ) },                         // where the spring falls in (pool-local x, z)
        uWhite: { value: new T.Vector4(-0.85, -0.72, 0.6, 1.5) },                                // white moon: local x, z, radius, brightness (> 1 blooms)
        uBlack: { value: new T.Vector4(1.3, -0.2, 0.47, 1.0) },                                   // black moon: local x, z, radius, rim brightness
        uStretch: { value: 1.5 },                                                                // discs are drawn this much longer north-south so they look round from the game camera
        uRefCam: { value: new T.Vector3(-19, 22.4, -14.6) }, uParallax: { value: 0.02 },         // reflections slide a little with the camera (0 at uRefCam)
        uRipple: { value: 1.0 }, uLevel: { value: 1.0 }, uStars: { value: 1.0 },                                         // ripple strength; overall brightness; star reflections (0 = none)
      }]);
      const mat = new T.ShaderMaterial({ name: 'springWater', uniforms, fog: true, side: T.DoubleSide,
        vertexShader: /* glsl */`
attribute float kind;
varying vec3 vW; varying float vKind;
#include <common>
#include <fog_pars_vertex>
void main() {
  vKind = kind;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
        fragmentShader: /* glsl */`
uniform float uTime, uStretch, uParallax, uRipple, uLevel, uStars;
uniform vec3 uWater[7]; uniform vec3 uDusk[7];
uniform vec3 uMoonA, uMoonB, uRimCol, uPool, uRefCam;
uniform vec2 uSpring; uniform vec4 uWhite, uBlack;
varying vec3 vW; varying float vKind;
#include <common>
#include <fog_pars_fragment>
const float B4[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
float hdBayer(vec2 c) { ivec2 i = ivec2(mod(c, 4.0)); return (B4[i.x + i.y * 4] + 0.5) / 16.0; }
float hdHash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 col;
  if (vKind > 0.5) {
    // the thread of water falling from the spout: dots on the world's 1/32 grid, running down
    vec2 c = floor(vW.xy * 32.0);
    float fall = floor(uTime * 26.0);
    float strand = hdHash(vec2(c.x + 7.0, floor((c.y + fall) / 3.0)));
    float h = hdHash(vec2(c.x, c.y + fall));
    float e = abs(c.x + 0.5 - (uPool.x + uSpring.x) * 32.0);
    if (strand > (e < 1.0 ? 0.86 : e < 2.0 ? 0.42 : 0.1)) discard;
    col = h > 0.7 ? uWater[6] * 1.45 : h > 0.3 ? uWater[5] * 1.1 : uWater[4];
  } else {
    // everything is computed at the centre of a 1/32 world cell, so the water is made of the same dots as the stone round it
    vec2 cell = floor(vW.xz * 32.0);
    vec2 p = (cell + 0.5) / 32.0 - uPool.xy;
    float r = length(p), R = uPool.z, by = hdBayer(cell);
    // rings spreading from where the spring falls in
    vec2 ds = p - uSpring; float d = length(ds); vec2 dir = ds / max(d, 0.04);
    float ph = d * 9.5 - uTime * 2.3;
    float env = uRipple / (1.0 + d * 0.8);
    float w1 = sin(ph), c1 = cos(ph);
    // now and then something small touches the surface: one slow ring that dies out
    float age = mod(uTime + 3.0, 11.0), d2 = length(p - vec2(-1.25, 1.35));
    float ring2 = exp(-pow((d2 - age * 0.3) / 0.05, 2.0)) * max(0.0, 1.0 - age / 4.5) * uRipple;
    // a slow cross-swell so the still parts stay alive
    float chop = sin(p.y * 21.0 + uTime * 0.8 + 1.7 * sin(p.x * 2.3 + uTime * 0.31));
    vec2 q = p + dir * c1 * env * 0.085 + vec2(chop * 0.03 * uRipple, 0.0);
    // the mirrored dusk: the far (north) side reflects the low glowing sky, the near side the dark zenith
    float g = clamp(0.5 - q.y / (2.0 * R), 0.0, 1.0);
    float tone = 0.7 + 3.4 * pow(g, 1.7) + w1 * env * 0.5 + chop * 0.16;
    float warm = smoothstep(0.5, 0.86, g);
    float crest = smoothstep(0.86, 0.97, w1) * env * 1.6 + ring2 * 1.3;
    tone += crest * 1.8;
    // the two moons
    vec2 par = clamp((cameraPosition.xz - uRefCam.xz) * uParallax, -0.3, 0.3);
    vec2 mw = uWhite.xy + par + 0.05 * vec2(sin(uTime * 0.23), 0.6 * cos(uTime * 0.17));
    vec2 mb = uBlack.xy + par + 0.04 * vec2(cos(uTime * 0.19 + 1.0), 0.6 * sin(uTime * 0.21));
    vec2 ew = (q - mw) / vec2(uWhite.z, uWhite.z * uStretch); float dw = length(ew);
    vec2 eb = (q - mb) / vec2(uBlack.z, uBlack.z * uStretch); float db = length(eb);
    tone += 1.8 * exp(-max(dw - 1.0, 0.0) * 1.7);                 // the white moon's glow lying on the water
    float cor = exp(-max(db - 1.0, 0.0) * 2.4);                    // the black moon's corona
    tone += 1.2 * cor; warm = max(warm, cor);
    // dark things standing over the water: the rim all round, the spring head to the north
    tone -= 1.8 * smoothstep(R - 0.32, R - 0.02, r);
    float s = (q.y + R) / 1.3, hw = 0.62 * min(1.0, (1.0 - s) / 0.4);
    if (s < 1.0 && abs(q.x) < hw) { tone = min(tone, 0.55 + crest); warm = 0.0; }
    int k = int(clamp(floor(tone + 0.5 + (by - 0.5) * 0.5), 0.0, 6.0));
    col = warm > 0.5 + (hdBayer(cell + vec2(2.0, 1.0)) - 0.5) * 0.9 ? uDusk[k] : uWater[k];
    // a few stars of the zenith in the dark near water; they wink as the ripples pass
    vec2 sc = floor((q + uPool.xy) * 32.0 / 3.0);
    if (uStars > 0.0 && g < 0.62 && tone < 2.6 && hdHash(sc) > 1.0 - 0.02 * uStars && mod(cell, 3.0) == vec2(1.0)) col = uWater[5] * (0.75 + 0.5 * sin(uTime * 1.7 + sc.x * 2.1 + sc.y));
    // white moon: a pale cream disc with maria, cut by the ripples, and a broken path of light toward the viewer
    if (dw < 1.0) {
      float mar = sin(ew.x * 2.9 + 0.8) * sin(ew.y * 2.3 - 0.4) + 0.5 * sin(ew.x * 5.3 - ew.y * 4.1);
      col = (mar > 0.45 ? uMoonB : uMoonA) * uWhite.w;
      if (dw > 0.9 && by > 0.45) col = uMoonB * uWhite.w * 0.8;
      if (crest > 0.3) col = uDusk[5];
    } else if (ew.y > 0.6 && ew.y < 3.3) {
      float f = (ew.y - 0.6) / 2.7;
      float st = floor(uTime * 1.3 + hdHash(vec2(cell.y, 3.0)) * 5.0);
      float h1 = hdHash(vec2(cell.y, st)), h2 = hdHash(vec2(st + 11.0, cell.y));
      float len = (0.12 + 0.55 * h2) * (1.0 - f), off = (h1 - 0.5) * (1.0 - 0.5 * f);
      if (h2 > 0.3 + 0.55 * f && abs(ew.x - off) < len) col = (f < 0.3 ? uMoonA : uMoonB) * uWhite.w * (0.85 - 0.5 * f);
    }
    // black moon: a black disc, a thin rose-violet rim that is fuller on the white moon's side
    vec2 tw = mw - mb; float lop = 0.5 + 0.5 * cos(atan(eb.y, eb.x) - atan(tw.y * uStretch, tw.x));
    float rimW = 0.07 + 0.11 * lop;
    if (db < 1.0 + rimW) col = mix(uRimCol, vec3(0.98, 0.76, 0.88) * 1.2, step(db, 1.0 + rimW * 0.5) * lop) * uBlack.w;
    if (db < 1.0) { col = vec3(0.003, 0.002, 0.006); if (crest > 0.4) col = uWater[1]; }
    // the splash where the spring falls in
    if (d < 0.26) { float f = hdHash(cell + floor(uTime * 10.0) * 7.0); col = d < 0.11 ? (f > 0.4 ? uWater[6] * 1.3 : uWater[5]) : (f > 0.6 ? uWater[5] : col); }
  }
  gl_FragColor = vec4(col * uLevel, 1.0);
  #include <fog_fragment>
  #include <encodings_fragment>
}` });
      const mesh = new T.Mesh(geo, mat); mesh.name = 'springWater'; ctx.add(mesh, { cast: false, receive: false });
      ctx.onUpdate(time => { uniforms.uTime.value = time; });
      HD.cloisterWater = mat;                                       // for tuning from the console: HD.cloisterWater.uniforms
      ctx.plant('leaves', { x: PX - 0.4, z: PZ + 0.9, r: 1.5, n: 7, kind: 'autumn', y: WATER_Y });
      ctx.plant('leaves', { x: PX - 1.5, z: PZ - 0.9, r: 0.8, n: 4, kind: 'autumn', y: WATER_Y });
      ctx.plant('leaves', { x: PX + 1.4, z: PZ - 1.2, r: 0.7, n: 2, kind: 'dry', y: WATER_Y });
      ctx.light({ x: PX, y: 1.5, z: PZ + 0.6, color: '#8fa6d8', intensity: 0.55, distance: 8.5, flicker: 0 });     // the one light: moonlight thrown up off the water
      ctx.spot({ id: 'spring', x: -19, z: -36.0, r: 1.3, label: '泉に、二つの月が映っている', kind: 'look' });
      ctx.camZone({ x: -19, z: -36.2, r: 1.2, fall: 3, pitch: 44, dist: 30 });
    }

    // ================================================================================================ north arcade
    // The surviving side of the cloister walk, on z = -47.4. u runs east from x = -27.2. Five bays: two lancets on paired
    // colonnettes, the walk-through arch (centred on x = -22: the `tower` path), one lancet, and a bay that has fallen in.
    const AX0 = -27.2, AZ = -47.4, AL = 10.4, AT = 0.7;
    {
      const W = K.wall([AX0, AZ], [AX0 + AL, AZ], 0), r = ctx.rng(91);
      const SILL = 0.72, SP = 3.05, RS = 1.25, AW = 1.4, A = [1.15, 2.9, 7.5, 9.25];          // lancets: sill, spring, rise, width, centres
      const DC = 5.2, DW = 2.3, DSP = 2.75, DRS = 1.75, dW = DC - DW / 2, dE = DC + DW / 2;  // the walk-through arch
      const UT = 8.3;                                                                         // the wall top survives west of this
      const openTop = u => Math.max(archH(u, A[0], AW, SP, RS), archH(u, A[1], AW, SP, RS), archH(u, A[2], AW, SP, RS), archH(u, DC, DW, DSP, DRS), u > 8.0 ? 4.3 : 0) + 0.3;
      const hf = u => 4.9 + (HD.fbm(u * 0.7, 3.1, 5, 2) - 0.5) * 0.9 - 1.25 * Math.exp(-Math.pow((u - 2.03) / 0.3, 2)) - 0.7 * Math.exp(-Math.pow((u - 6.58) / 0.22, 2)) + 0.3 * Math.exp(-Math.pow((u - DC) / 0.9, 2)) - 0.5 * clamp(u - 7.4, 0, 1);
      const minAt = u => Math.max(openTop(u), Math.abs(u - 2.03) < 0.5 ? 3.75 : 0, Math.abs(u - 6.58) < 0.4 ? 4.0 : 0);
      const top = ragged(0, UT, hf, 23, 0.3, 0.55, 1.15, minAt);
      const dArch = K.arch(DC, V0, DW, DSP, DRS), a3 = K.arch(A[2], 0, AW, SP, RS).slice(2).reverse(), a4 = [];
      for (let i = 0; i <= 5; i++) a4.push(arcPt(A[3], AW, SP, RS, 0, -1, 0.5 * i / 5));
      const outline = clean([[0, V0], dArch[0]].concat(dArch.slice(2).reverse(), [dArch[1], [AL, V0],
        [AL, 1.5], [AL - 0.2, 1.5], [AL - 0.2, 1.8], [9.95, 1.8], [9.95, SILL], [9.45, SILL], [9.45, 0.42], [8.95, 0.42], [8.95, SILL], [A[2] - AW / 2, SILL]],
        a3, [[A[3] - AW / 2, SP]], a4, [[8.5, 3.95], [8.5, 4.2], [UT, 4.2]], top.slice().reverse()));
      const holeW = clean([[A[0] - AW / 2, SILL], [A[1] + AW / 2, SILL]].concat(K.arch(A[1], 0, AW, SP, RS).slice(2), K.arch(A[0], 0, AW, SP, RS).slice(2)));
      const g = K.extrude(outline, AT, [holeW]); g.translate(0, 0, -AT / 2); W.put(g);
      B.add(M.stone, K.shade(g, (x, y) => 0.84 + 0.2 * clamp(y / 4.6, 0, 1)));
      // plinth course (not across the doorway), sills, the string course where the wall still stands to its full height
      B.add(M.stoneDark, W.box(-0.05, dW, V0, 0.2, -0.41, 0.43), W.box(dE, AL + 0.05, V0, 0.2, -0.41, 0.43));
      B.add(M.sand, K.tint(prism(W, coping(0.42, SILL, 0.1), A[0] - AW / 2, A[1] + AW / 2), 1.0), K.tint(prism(W, coping(0.42, SILL, 0.1), A[2] - AW / 2, 8.95), 0.97), K.tint(prism(W, coping(0.42, SILL, 0.1), 9.47, 9.95), 0.9));
      for (let i = 0; i < top.length; i += 2) { const u0 = top[i][0], u1 = top[i + 1][0], h = top[i][1]; if (h >= 4.8) B.add(M.sand, K.tint(W.box(u0, u1, 4.5, 4.6, 0.35, 0.43), r.range(0.84, 0.98)));
        if (r() < 0.55) B.add(M.moss, mossTop(W, u0, u1, h, 0.16, r)); }
      for (let u = 0.25; u < UT; u += 0.42) if (K.topAt(top, u - 0.1) >= 4.8 && K.topAt(top, u + 0.1) >= 4.8) B.add(M.sand, K.tint(W.box(u - 0.07, u + 0.07, 4.37, 4.5, 0.35, 0.41), 0.82));        // little corbels under it
      // the floor of the lost walk behind: what is left of its flagging, and the worn threshold of the walk-through arch
      { const fr = ctx.rng(417); for (let x = -26.9; x < -16.6; x += 0.96) for (const zc of [-48.32, -49.2]) { if (fr() < (x > -22.9 ? 0.5 : 0.3) || x > -17.9) continue; const w = fr.range(0.36, 0.45), d = fr.range(0.34, 0.41), cx = x + 0.48 + fr.range(-0.05, 0.05), cz = zc + fr.range(-0.04, 0.04);
          B.add(M.flag, K.tint(K.xform(K.box(-w, -0.2, -d, w, 0.045 + fr.range(0, 0.02), d), { x: cx, y: gy(cx, cz), z: cz, ry: fr.range(-0.06, 0.06) }), fr.range(0.82, 1.02))); }
        B.add(M.flag, K.tint(W.box(dW + 0.02, DC - 0.2, V0, 0.055, -0.36, 0.42), 1.0), K.tint(W.box(DC - 0.17, dE - 0.02, V0, 0.04, -0.36, 0.4), 0.9)); }
      // loose stones left lying on the broken top
      for (const u of [0.75, 3.1, 4.4, 6.1, 7.7]) { const h = K.topAt(top, u), p = W.xz(u, r.range(-0.1, 0.1)); if (Math.abs(K.topAt(top, u - 0.3) - h) > 0.01 || Math.abs(K.topAt(top, u + 0.3) - h) > 0.01) continue;
        B.add(M.stone, K.tint(K.chunk({ x: p[0], y: h - 0.02, z: p[1], w: r.range(0.4, 0.6), h: r.range(0.22, 0.3), d: r.range(0.35, 0.5), seed: Math.round(u * 37), ry: r.range(-0.5, 0.5), rx: r.range(-0.08, 0.08), rz: r.range(-0.1, 0.1) }), r.range(0.9, 1.08))); }
      // the supports: paired colonnettes between the lancets, half-engaged pairs against the piers
      const S = SILL + 0.1, PH = SP - S;
      for (const u of [2.025, 8.375]) B.add(M.sand, pair(W, u, S, PH).map(q => K.tint(q, 1.04)));
      for (const u of [A[0] - AW / 2 + 0.02, A[1] + AW / 2 - 0.02, A[2] - AW / 2 + 0.02]) B.add(M.sand, pair(W, u, S, PH).map(q => K.tint(q, 0.98)));
      { const a = W.xz(9.84, 0.17), b = W.xz(9.82, -0.17); B.add(M.sand, colo(a[0], S, a[1], 0.95, 0.085, true), colo(b[0], S, b[1], 0.5, 0.085, true)); }       // the fallen bay's east respond: two stumps
      // mouldings: a roll round each lancet, two orders and imposts on the walk-through arch
      for (let i = 0; i < 3; i++) B.add(M.sand, K.tint(W.archTrim(A[i], SP, AW, SP, RS, { band: 0.15, depth: 0.05, at: AT / 2 }), 0.97));
      B.add(M.sand, K.tint(archBand(W, A[3], AW, SP, RS, -1, 0, 0.5, 0, 0.15, AT / 2, AT / 2 + 0.05), 0.95));
      B.add(M.sand, W.archTrim(DC, V0, DW, DSP, DRS, { band: 0.13, depth: 0.11, at: AT / 2 }), K.tint(W.archTrim(DC, V0, DW, DSP, DRS, { band: 0.13, inset: 0.13, depth: 0.05, at: AT / 2 }), 0.92));
      for (const s of [-1, 1]) B.add(M.sand, K.tint(W.box(DC + s * (DW / 2 + 0.14) - 0.17, DC + s * (DW / 2 + 0.14) + 0.17, DSP - 0.14, DSP, AT / 2, AT / 2 + 0.15), 1.05),
        K.tint(W.box(DC + s * (DW / 2 + 0.14) - 0.15, DC + s * (DW / 2 + 0.14) + 0.15, V0, 0.34, AT / 2, AT / 2 + 0.14), 0.9));
      // the corner buttress at the west end, and a low one against the last pier
      B.add(M.stone, W.buttress(0.22, { width: 0.5, face: AT / 2, v0: V0, stages: [[0.75, 1.5], [0.48, 3.0], [0.22, 3.9]] }), K.tint(W.buttress(10.17, { width: 0.46, face: AT / 2, v0: V0, stages: [[0.5, 0.9]] }), 0.95));
      // what is left of the lean-to roof: one rotten beam still lying across from the arcade to the closing wall
      B.add(M.woodDark, K.wobble(bar([AX0 + 4.6, K.topAt(top, 4.6) + 0.1, AZ + 0.25], [AX0 + 6.1, 4.4, -50.0], 0.2, 0.24), 0.02, 4));
      B.add(M.woodDark, K.tint(K.wobble(bar([AX0 + 7.0, 0.16, AZ - 0.75], [AX0 + 8.6, 0.12, AZ - 0.6], 0.16, 0.18), 0.02, 9), 0.85));
      // fallen arcade stones, stacked and scattered south of the collapsed bay
      { const sx = -18.1, sz = -46.25, y = gy(sx, sz);
        B.add(M.stone, K.chunk({ x: sx, y, z: sz, w: 0.9, h: 0.42, d: 0.6, seed: 3, ry: 0.3, rx: 0, rz: 0.04 }), K.chunk({ x: sx + 0.75, y, z: sz + 0.1, w: 0.7, h: 0.4, d: 0.55, seed: 4, ry: -0.5 }), K.chunk({ x: sx + 0.25, y: y + 0.4, z: sz + 0.02, w: 0.75, h: 0.36, d: 0.5, seed: 5, ry: 0.9, rx: 0.05, rz: -0.12 }),
          K.rubble({ x: sx + 0.4, z: sz + 0.5, y, n: 9, spread: 1.3, size: [0.14, 0.34], seed: 12 }), K.rubble({ x: AX0 + 9.3, z: AZ - 0.75, y: gy(AX0 + 9.3, AZ - 0.75), n: 6, spread: 0.7, size: [0.14, 0.32], seed: 15 }));
        const vs = K.extrude([[-0.2, 0], [0.2, 0], [0.26, 0.36], [-0.26, 0.36]], 0.5, null); vs.translate(0, 0, -0.25);                    // voussoirs
        B.add(M.sand, K.tint(K.xform(vs.clone(), { x: sx - 0.75, y: y + 0.02, z: sz + 0.55, ry: 0.7, rx: -1.45 }), 0.96), K.tint(K.xform(vs.clone(), { x: sx + 0.45, y: y + 0.74, z: sz + 0.05, ry: 2.1, rz: 0.15 }), 1.02), K.tint(K.xform(vs, { x: sx + 1.25, y: y + 0.02, z: sz + 0.75, ry: -0.4, rx: 1.5 }), 0.9),
          K.drum({ x: sx - 0.2, y: y - 0.02, z: sz + 0.95, r: 0.09, len: 1.0, ry: 0.35 }), K.drum({ x: sx + 1.5, y: y - 0.02, z: sz - 0.35, r: 0.09, len: 0.6, ry: 1.3 }),
          K.xform(colo(0, 0, 0, 0.5, 0.085, false), { x: sx + 0.95, y: y + 0.2, z: sz + 1.15, rx: 1.75, ry: 0.8 }), K.xform(K.boxc(0, 0, 0, 0.44, 0.08, 0.8), { x: sx - 0.55, y: y + 0.03, z: sz - 0.35, ry: 1.1, rz: 0.1 })); }
      // collision: the masonry and dwarf walls on either side of the doorway
      ctx.block.rect(AX0 - 0.05, AZ - 0.4, AX0 + dW, AZ + 0.42); ctx.block.rect(AX0 + dE, AZ - 0.4, AX0 + AL + 0.05, AZ + 0.42);
      ctx.block.rect(AX0 - 0.05, AZ, AX0 + 0.5, AZ + 1.1); ctx.block.rect(AX0 + 9.9, AZ, AX0 + AL, AZ + 0.85); ctx.block.circle(-17.75, -46.2, 0.95);
      // ivy heavy on the standing masonry, weeds at the foot
      const iv = (u, v, w, h, d, s) => ctx.plant('ivy', { x: AX0 + u, y: v, z: AZ + AT / 2 + 0.02, nx: 0, nz: 1, w, h, density: d, seed: s });
      iv(0.25, 2.3, 0.9, 4.4, 1.0, 1); iv(2.03, 4.0, 1.5, 1.4, 0.9, 2); iv(1.2, 4.7, 2.2, 0.8, 0.8, 3); iv(3.82, 2.6, 0.55, 4.6, 0.85, 4); iv(3.3, 4.55, 1.6, 0.9, 0.7, 5);
      iv(6.58, 3.0, 0.5, 3.2, 0.7, 6); iv(7.5, 4.55, 1.5, 0.6, 0.6, 7); iv(8.4, 3.7, 0.5, 0.9, 0.6, 8); iv(10.15, 0.9, 0.5, 1.6, 0.8, 9); iv(1.6, 0.35, 2.6, 0.7, 0.6, 10); iv(7.6, 0.35, 1.8, 0.7, 0.5, 11);
      ctx.plant('ivy', { x: AX0 + 2.0, y: 3.2, z: AZ - AT / 2 - 0.02, nx: 0, nz: -1, w: 3.4, h: 3.0, density: 0.6, seed: 12 });
      grassLine(AX0 + 0.3, AZ + 0.65, AX0 + AL, AZ + 0.65, 0.8, { r: 0.45, n: 4, kind: 'weed' }); grassLine(AX0 + 0.6, AZ + 1.0, AX0 + AL, AZ + 1.0, 1.7, { r: 0.6, n: 3, kind: 'tall' });
      grassLine(AX0 + 0.4, AZ - 0.55, AX0 + AL, AZ - 0.55, 1.0, { r: 0.3, n: 3, kind: 'weed' });
    }

    // ================================================================================================ closing wall
    // On z = -50.2 from the west boundary wall to the tower's stair turret (which swallows its east end): the back of
    // the lost walk. Facing south: two blind arches, a blocked-up doorway seen through the west lancets, and on the axis
    // of the walk-through arch an abbot's wall tomb.
    {
      const CX1 = -19.7, W = K.wall([-27.4, -50.2], [CX1, -50.2], 0), CL = W.L, r = ctx.rng(133);
      const BL = [[0.62, 0.9, 0.84, 2.25, 0.75], [1.56, 0.9, 0.84, 2.25, 0.75]], DR = [3.1, 0.14, 1.5, 2.2, 1.25], TB = [5.4, 0.62, 1.9, 1.6, 1.15];      // [centre, sill, width, spring, rise]
      const all = BL.concat([DR, TB]), ar = (o, off) => K.arch(o[0], o[1], o[2], o[3], o[4], off || 0);
      const minAt = u => { let m = 0; for (const o of all) if (Math.abs(u - o[0]) < o[2] / 2 + 0.25) m = Math.max(m, o[3] + K.archTop(o[2], o[4]) + 0.45); return m; };
      const hf = u => 4.75 + (HD.fbm(u * 0.6, 7.7, 9, 2) - 0.5) * 1.1 - 2.7 * Math.exp(-Math.pow((u - 7.15) / 0.5, 2)) - 0.9 * Math.exp(-Math.pow((u - 2.2) / 0.3, 2));
      const top = ragged(0, CL, hf, 37, 0.3, 0.6, 1.25, minAt);
      B.add(M.stone, K.shade(W.solid({ t: 0.55, w: 0.175, top, v0: V0, holes: all.map(o => ar(o)) }), (x, y) => 0.84 + 0.18 * clamp(y / 5, 0, 1)));
      B.add(M.stoneDark, K.tint(W.solid({ t: 0.35, w: -0.275, top, v0: V0 }), 0.62), W.box(0, CL, V0, 0.28, 0.45, 0.53));
      for (const o of BL) { const g = K.extrude(ar(o), 0.36, null); g.translate(0, 0, -0.1); B.add(M.stone, K.tint(W.put(g), 0.8)); B.add(M.sand, K.tint(W.archTrim(o[0], o[1], o[2], o[3], o[4], { band: 0.09, depth: 0.05, at: 0.45 }), 0.9), K.tint(W.box(o[0] - 0.5, o[0] + 0.5, o[1] - 0.1, o[1], 0.43, 0.52), 0.9)); }
      { const g = K.extrude(ar(DR), 0.4, null); g.translate(0, 0, -0.1); B.add(M.rubble, K.tint(W.put(g), 0.92));                                          // the blocked doorway
        B.add(M.sand, K.tint(W.archTrim(DR[0], DR[1], DR[2], DR[3], DR[4], { band: 0.14, depth: 0.09, at: 0.45 }), 0.95), K.tint(W.archTrim(DR[0], DR[1], DR[2], DR[3], DR[4], { band: 0.08, inset: 0.14, depth: 0.04, at: 0.45 }), 0.88));
        B.add(M.stoneDark, K.tint(W.box(DR[0] - 0.95, DR[0] + 0.95, V0, 0.14, 0.45, 0.8), 1.1)); }
      { // the wall tomb: a chest with a panelled front under a low arch, the worn effigy of an abbot on it
        const u0 = TB[0] - 0.95, u1 = TB[0] + 0.95;
        B.add(M.sand, K.tint(W.archTrim(TB[0], TB[1], TB[2], TB[3], TB[4], { band: 0.14, depth: 0.09, at: 0.45 }), 0.97), K.tint(W.archTrim(TB[0], TB[1], TB[2], TB[3], TB[4], { band: 0.07, inset: 0.14, depth: 0.04, at: 0.45 }), 0.9),
          K.tint(prism(W, [[-0.08, 0.6], [0.6, 0.6], [0.62, 0.64], [0.62, 0.69], [0.57, 0.72], [-0.08, 0.72]], u0 - 0.1, u1 + 0.1), 1.03), K.tint(W.box(u0 - 0.02, u1 + 0.02, 0.24, 0.6, 0.45, 0.52), 0.9), K.tint(W.box(u0 - 0.07, u1 + 0.07, V0, 0.24, 0.45, 0.59), 0.84));
        for (let i = 0; i < 5; i++) { const c = u0 + 0.19 + i * 0.38; B.add(M.stoneDark, K.tint(W.put(K.extrude(K.arch(c, 0.29, 0.24, 0.44, 0.1), 0.016, null).translate(0, 0, 0.52)), 0.72)); }
        const eff = [K.xform(K.wobble(new T.BoxGeometry(1.12, 0.16, 0.38, 4, 1, 2), 0.022, 7), { x: 0.02, y: 0.08 }), K.rock({ x: -0.7, y: 0.14, z: 0, sx: 0.14, sy: 0.13, sz: 0.14, seed: 2 }), K.box(-0.9, 0, -0.18, -0.55, 0.07, 0.18), K.rock({ x: 0.64, y: 0.11, z: 0, sx: 0.1, sy: 0.15, sz: 0.16, seed: 5, detail: 0 }),
          K.tube([[-0.48, 0.2, 0.13], [0.58, 0.18, 0.16]], 0.022, 4), K.rock({ x: -0.53, y: 0.21, z: 0.13, sx: 0.05, sy: 0.05, sz: 0.05, seed: 8, detail: 0 })];
        const p = W.pt(TB[0], 0.72, 0.24); B.add(M.sand, eff.map(q => K.tint(K.xform(q, { x: p.x, y: p.y, z: p.z }), 0.93))); }
      // corbels of the lost roof, high on the wall
      for (let u = 0.45; u < CL - 0.3; u += 1.05) { if (K.topAt(top, u - 0.15) < 4.5 || K.topAt(top, u + 0.15) < 4.5) continue;
        B.add(M.sand, K.tint(W.box(u - 0.11, u + 0.11, 4.06, 4.28, 0.45, 0.78), 0.95), K.tint(W.box(u - 0.11, u + 0.11, 3.9, 4.06, 0.45, 0.62), 0.85)); }
      for (let i = 0; i < top.length; i += 2) if (r() < 0.6) B.add(M.moss, mossTop(W, top[i][0], top[i + 1][0], top[i][1], 0.24, r));
      B.add(M.stone, K.rubble({ x: -20.5, z: -49.5, y: gy(-20.5, -49.5), n: 7, spread: 0.7, sx: 1.2, sz: 0.3, size: [0.16, 0.4], seed: 31 }));
      ctx.block.seg(-27.4, -50.2, CX1, -50.2, 0.48);
      const iv = (u, v, w, h, d, s) => ctx.plant('ivy', { x: -27.4 + u, y: v, z: -49.74, nx: 0, nz: 1, w, h, density: d, seed: s });
      iv(1.1, 3.9, 2.2, 2.2, 1.0, 21); iv(2.2, 1.6, 0.5, 3.0, 0.8, 22); iv(4.15, 2.8, 0.5, 3.4, 0.85, 23); iv(3.1, 4.3, 1.4, 1.0, 0.7, 24); iv(6.75, 2.2, 0.6, 3.2, 0.9, 25); iv(5.4, 4.6, 2.0, 0.7, 0.6, 26); iv(7.3, 1.0, 0.7, 1.6, 0.7, 27);
      grassLine(-27.0, -49.6, CX1, -49.6, 0.9, { r: 0.25, n: 3, kind: 'weed' });
    }

    // ============================================================================================ south dwarf wall
    // The stumps of the south arcade on z = -32.2, with the gap where the `west` path comes in.
    {
      const SZ = -32.2, r = ctx.rng(171);
      const seg = (x0, x1, seed, hf, stumps) => { const W = K.wall([x0, SZ], [x1, SZ], 0), top = ragged(0, W.L, hf, seed, 0.2, 0.5, 1.05, null, 0.3);
        B.add(M.stone, K.shade(W.solid({ t: 0.56, top, v0: V0 }), (x, y) => 0.9 + 0.14 * clamp(y, 0, 1)));
        B.add(M.stoneDark, W.box(-0.04, W.L + 0.04, V0, 0.14, -0.34, 0.34));
        for (let i = 0; i < top.length; i += 2) { const h = top[i][1]; if (h > 0.79 && h < 0.81) B.add(M.sand, K.tint(prism(W, coping(0.34, h, 0.1), top[i][0] + 0.004, top[i + 1][0] - 0.004), r.range(0.9, 1.04))); else if (r() < 0.5) B.add(M.moss, mossTop(W, top[i][0], top[i + 1][0], h, 0.1, r)); }
        for (const s of stumps) { const h = K.topAt(top, s[0]) > 0.79 && K.topAt(top, s[0]) < 0.81 ? 0.9 : K.topAt(top, s[0]); for (const w of [0.16, -0.16]) { const hh = w > 0 ? s[1] : s[2]; if (hh <= 0) continue; const p = W.xz(s[0], w); B.add(M.sand, K.tint(colo(p[0], h, p[1], hh, 0.085, true), r.range(0.9, 1.05))); } }
        ctx.block.seg(x0, SZ, x1, SZ, 0.33);
        return { W, top }; };
      // west of the gap
      const a = seg(-26.6, -20.9, 51, u => u < 0.7 ? 1.2 : u > 5.0 ? 0.8 : Math.abs(u - 3.45) < 0.4 ? 0.2 : 0.72 + (HD.fbm(u * 0.9, 1.3, 3, 2) - 0.5) * 0.9, [[1.25, 0.55, 0.3], [2.6, 1.5, 0.9], [4.4, 0.35, 0]]);
      B.add(M.stone, K.rubble({ x: -23.1, z: -32.75, y: gy(-23.1, -32.75), n: 8, spread: 0.8, sx: 1.0, sz: 0.8, size: [0.16, 0.4], seed: 64 }));
      // east of the gap
      const b = seg(-17.1, -11.6, 52, u => u > 4.5 || u < 0.6 || Math.abs(u - 3.5) < 0.55 ? 0.8 : 0.66 + (HD.fbm(u * 0.9, 4.3, 4, 2) - 0.5) * 0.9, [[1.05, 0.9, 1.3], [2.5, 0, 0.45]]);
      // the piers of the gap: one keeps its cap, the other's lies beside it
      const pier = (x, h, cap) => { const y = V0; B.add(M.stone, K.tint(K.boxc(x, y, SZ, 0.66, h - y, 0.66), 0.97)); B.add(M.stoneDark, K.boxc(x, y, SZ, 0.76, 0.16 - y, 0.76));
        if (cap) B.add(M.sand, K.boxc(x, h, SZ, 0.78, 0.1, 0.78), K.spire({ x, y: h + 0.1, z: SZ, r: 0.5, h: 0.26 })); ctx.block.rect(x - 0.36, SZ - 0.36, x + 0.36, SZ + 0.36); };
      pier(-20.6, 1.3, true); pier(-17.4, 0.95, false);
      at({ x: -16.9, y: gy(-16.9, -31.3) + 0.24, z: -31.35, ry: 0.5, rx: 2.0, rz: 0.2 }, [M.sand, K.boxc(0, -0.05, 0, 0.78, 0.1, 0.78), K.spire({ x: 0, y: 0.05, z: 0, r: 0.5, h: 0.26 })]);
      // the one pair that still stands, with the springers of two arches on it, near the church end
      { const W = b.W, u = 4.95, SP = 0.9 + 2.25, RS = 1.25, AW = 1.4, cxE = u + 0.175 + AW / 2, cxW = u - 0.175 - AW / 2, pts = [[u - 0.175, SP], [u + 0.175, SP]];
        const tE = 0.62, tW = 0.45, oE = arcPt(cxE, AW, SP, RS, 0.34, -1, tE), oW = arcPt(cxW, AW, SP, RS, 0.34, 1, tW);
        for (let i = 0; i <= 6; i++) pts.push(arcPt(cxE, AW, SP, RS, 0, -1, tE * i / 6));
        pts.push(oE, [oE[0] - 0.09, oE[1] + 0.2], [u - 0.04, oE[1] + 0.2], [u - 0.04, oW[1] + 0.22], [oW[0] - 0.03, oW[1] + 0.22], oW);
        for (let i = 6; i >= 0; i--) pts.push(arcPt(cxW, AW, SP, RS, 0, 1, tW * i / 6));
        const g = K.extrude(clean(pts), 0.56, null); g.translate(0, 0, -0.28); B.add(M.stone, K.tint(W.put(g), 1.0));
        B.add(M.sand, pair(W, u, 0.9, 2.25, { sp: 0.15 }).map(q => K.tint(q, 1.03)), K.tint(archBand(W, cxE, AW, SP, RS, -1, 0, tE, 0, 0.14, 0.28, 0.33), 0.96), K.tint(archBand(W, cxW, AW, SP, RS, 1, 0, tW, 0, 0.14, 0.28, 0.33), 0.96));
        const p = W.xz(3.5, 0); B.add(M.sand, K.tint(colo(p[0] , 0.9, p[1] + 0.15, 2.05, 0.085, false), 0.97), K.tint(colo(p[0], 0.9, p[1] - 0.15, 1.1, 0.085, true), 0.92), K.tint(W.box(3.33, 3.67, 0.8, 0.9, -0.3, 0.3), 0.95));
        ctx.plant('ivy', { x: p[0] + 1.45, y: 2.1, z: SZ + 0.3, nx: 0, nz: 1, w: 0.5, h: 2.6, density: 0.5, seed: 41 }); }
      B.add(M.stone, K.rubble({ x: -23.4, z: -31.5, y: gy(-23.4, -31.5), n: 7, spread: 1.0, sx: 1.5, sz: 0.5, size: [0.15, 0.4], seed: 61 }), K.rubble({ x: -14.9, z: -32.9, y: gy(-14.9, -32.9), n: 6, spread: 0.9, sx: 1.4, sz: 0.4, size: [0.14, 0.36], seed: 62 }));
      B.add(M.sand, K.drum({ x: -22.2, y: gy(-22.2, -33.1) - 0.02, z: -33.1, r: 0.09, len: 1.1, ry: 0.4 }), K.drum({ x: -15.7, y: gy(-15.7, -31.4) - 0.02, z: -31.4, r: 0.09, len: 0.7, ry: -0.9 }));
      grassLine(-26.4, SZ + 0.5, -11.8, SZ + 0.5, 0.85, { r: 0.4, n: 4, kind: 'weed' }); grassLine(-26.4, SZ - 0.5, -11.8, SZ - 0.5, 0.9, { r: 0.4, n: 4, kind: 'tall' }); grassLine(-26.2, SZ + 0.9, -12, SZ + 0.9, 1.3, { r: 0.6, n: 3, kind: 'tuft' });
      ctx.plant('bush', { x: -25.6, z: -33.7, r: 1.35, kind: 'bramble', seed: 5 }); ctx.plant('bush', { x: -26.2, z: -35.3, r: 0.9, kind: 'bramble', seed: 6 }); ctx.plant('bush', { x: -12.0, z: -34.6, r: 0.6, kind: 'fern', seed: 7 });
    }

    // ============================================================================ the old tree that still turns red
    {
      ctx.plant('tree', { x: TX, z: TZ, kind: 'autumn', h: 8.5, seed: 7 });
      ctx.block.circle(TX, TZ, 0.9);
      for (const c of [[-1.5, 0.9, 0.62], [-1.62, 0.1, 0.7], [-1.55, -0.75, 0.7], [-1.25, -1.5, 0.62]]) ctx.walkCircle(TX + c[0], TZ + c[1], c[2]);            // the path squeezes past the trunk on the west: give it room
      // a curved stone seat on the side toward the spring (the path passes close on the other side)
      const r = ctx.rng(205), a0 = -13 * DEG, a1 = 63 * DEG, y = gy(TX + 1.3, TZ + 0.9);
      for (let i = 0; i < 4; i++) { const b0 = a0 + (a1 - a0) * i / 4, b1 = a0 + (a1 - a0) * (i + 1) / 4; B.add(M.stone, K.tint(sweep(rectProf(1.27, 1.8, V0, 0.37), TX, TZ, b0 + 0.01, b1 - 0.01, 1, y), r.range(0.88, 1.04))); }
      for (let i = 0; i < 3; i++) { const b0 = a0 - 0.03 + (a1 - a0 + 0.06) * i / 3, b1 = a0 - 0.03 + (a1 - a0 + 0.06) * (i + 1) / 3, lift = i === 0 ? 0.05 : 0;                                    // the seat slabs; a root has lifted the north one
        B.add(M.sand, K.tint(sweep([[1.2, 0.37], [1.88, 0.37], [1.9, 0.41], [1.9, 0.48], [1.86, 0.5], [1.2, 0.5]], TX + (i === 0 ? 0.03 : 0), TZ, b0 + 0.012, b1 - 0.012, 2, y + lift), r.range(0.92, 1.06))); }
      for (const e of [[a0 - 0.2, 1.5, 0.3], [a1 + 0.17, 1.5, 0.26], [a1 + 0.42, 1.42, 0.2]]) { const x = TX + Math.cos(e[0]) * e[1], z = TZ + Math.sin(e[0]) * e[1]; B.add(M.stone, K.chunk({ x, y: gy(x, z) - 0.04, z, w: 0.42, h: e[2], d: 0.36, seed: Math.round(e[0] * 50) + 9 })); }
      B.add(M.moss, K.tint(sweep([[1.24, 0.3], [1.3, 0.3], [1.3, 0.515], [1.24, 0.515]], TX, TZ, a0 + 0.1, a0 + 0.62, 2, y), 0.95));
      const am = (a0 + a1) / 2; ctx.block.seg(TX + Math.cos(a0) * 1.55, TZ + Math.sin(a0) * 1.55, TX + Math.cos(am) * 1.6, TZ + Math.sin(am) * 1.6, 0.34); ctx.block.seg(TX + Math.cos(am) * 1.6, TZ + Math.sin(am) * 1.6, TX + Math.cos(a1) * 1.55, TZ + Math.sin(a1) * 1.55, 0.34);
      // its leaves: drifts on the grass to the south-east, on the seat, on the rim of the basin
      ctx.plant('leaves', { x: TX + 1.9, z: TZ + 1.7, r: 2.3, n: 46, kind: 'autumn' }); ctx.plant('leaves', { x: TX - 0.3, z: TZ + 2.2, r: 1.6, n: 18, kind: 'autumn' }); ctx.plant('leaves', { x: TX + 3.4, z: TZ + 0.2, r: 1.5, n: 14, kind: 'autumn' });
      ctx.plant('leaves', { x: TX - 1.6, z: TZ - 1.6, r: 1.8, n: 16, kind: 'autumn' }); ctx.plant('leaves', { x: TX + 1.3, z: TZ + 0.75, r: 0.55, n: 6, kind: 'autumn', y: y + 0.5 });
      for (const a of [150, 172, 196, 118]) ctx.plant('leaves', { x: PX + Math.cos(a * DEG) * 2.85, z: PZ + Math.sin(a * DEG) * 2.85, r: 0.3, n: 3, kind: 'autumn', y: 0.77 });
      ctx.plant('leaves', { x: PX - 3.6, z: PZ - 1.6, r: 1.0, n: 10, kind: 'autumn', y: gy(PX - 3.6, PZ - 1.6) + 0.1 }); ctx.plant('leaves', { x: -21.6, z: -47.0, r: 1.0, n: 7, kind: 'dry' });
    }

    // =================================================================================================== furniture
    // a stone bench: two shaped supports and a seat slab; built about the origin, long axis x, facing +z
    const support = x => { const g = K.extrude([[-0.27, 0], [0.27, 0], [0.27, 0.07], [0.19, 0.13], [0.15, 0.29], [0.25, 0.39], [0.25, 0.43], [-0.25, 0.43], [-0.25, 0.39], [-0.15, 0.29], [-0.19, 0.13], [-0.27, 0.07]], 0.3, null); g.rotateY(Math.PI / 2); g.translate(x - 0.15, 0, 0); return g; };
    const seatSlab = (x0, x1) => K.merge([K.box(x0, 0.43, -0.33, x1, 0.53, 0.33), K.box(x0 + 0.02, 0.53, -0.3, x1 - 0.02, 0.57, 0.3)]);
    { // east bench, whole, turned to the pool
      const x = -13.9, z = -36.25, ry = -2.2;
      at({ x, y: gy(x, z) - 0.03, z, ry, rz: 0.015 }, [M.stone, support(-0.72), support(0.72)], [M.sand, seatSlab(-1.05, 1.05)]);
      ctx.block.seg(x - Math.cos(ry) * 0.95, z + Math.sin(ry) * 0.95, x + Math.cos(ry) * 0.95, z - Math.sin(ry) * 0.95, 0.3);
      ctx.plant('grass', { x: x + 0.8, z: z - 0.8, r: 0.6, n: 4, kind: 'tall', seed: 3 }); ctx.plant('grass', { x: x - 0.1, z: z + 0.5, r: 0.8, n: 5, kind: 'tuft', seed: 31 }); ctx.plant('leaves', { x: x - 0.2, z: z - 0.2, r: 0.5, n: 3, kind: 'dry', y: gy(x, z) + 0.56 });
    }
    { // west bench, broken: the slab has snapped, one half has slid to the ground, one support lies on its side
      const x = -25.6, z = -38.8, ry = 1.75, o = { x, y: gy(x, z) - 0.03, z, ry };
      const half = K.xform(seatSlab(-0.05, 1.05), { y: -0.48 }), fallen = K.xform(seatSlab(-0.45, 0.45), { y: -0.48 });
      at(o, [M.stone, support(0.72), K.xform(support(0), { x: -0.8, y: 0.14, z: 0.25, rx: Math.PI / 2 - 0.1, ry: 0.5 })],
        [M.sand, K.xform(half, { x: 0.05, y: 0.42, z: 0.0, rz: 0.2 }), K.xform(fallen, { x: -0.72, y: 0.3, z: 0.42, rz: -0.12, rx: 0.5, ry: 0.35 }), K.chunk({ x: -0.15, y: 0, z: 0.5, w: 0.26, h: 0.12, d: 0.2, seed: 5 })]);
      ctx.block.seg(x - Math.cos(ry) * 0.95, z + Math.sin(ry) * 0.95, x + Math.cos(ry) * 0.95, z - Math.sin(ry) * 0.95, 0.34);
      ctx.plant('grass', { x: x - 0.6, z: z - 1.2, r: 0.6, n: 4, kind: 'tall', seed: 4 }); ctx.plant('grass', { x: x + 0.5, z: z + 0.6, r: 0.7, n: 5, kind: 'weed', seed: 5 });
    }
    { // the unlit lantern post beside the end of the arcade
      const x = -16.4, z = -46.5, y = gy(x, z) - 0.04, o = { x, y, z, rz: -0.04, rx: 0.03 };
      const cage = [K.boxc(0, 0, 0, 0.3, 0.035, 0.3), K.boxc(0, 0.38, 0, 0.32, 0.035, 0.32), K.spire({ x: 0, y: 0.415, z: 0, r: 0.22, h: 0.16 })];
      for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cage.push(K.boxc(c[0] * 0.13, 0.03, c[1] * 0.13, 0.03, 0.36, 0.03));
      const lx = -0.62, ly = 2.42;
      at(o, [M.stoneDark, K.boxc(0, 0, 0, 0.62, 0.24, 0.62), K.tint(K.boxc(0, 0.24, 0, 0.46, 0.16, 0.46), 1.1)],
        [M.stone, K.lathe([[0.19, 0.4], [0.15, 0.5], [0.13, 2.5], [0.2, 2.56], [0.2, 2.66], [0.0, 2.88]], 8, { flat: true })],
        [M.iron, K.tube([[0, 2.55, 0], [0, 3.0, 0], [-0.22, 3.2, 0], [-0.5, 3.14, 0], [lx, 3.0, 0]], 0.03, 5), K.tube([[0, 2.72, 0], [-0.3, 3.08, 0]], 0.02, 4), K.tube([[lx, 3.0, 0], [lx, ly + 0.56, 0]], 0.012, 4),
          cage.map(g => K.xform(g, { x: lx, y: ly, z: 0, ry: 0.3, rz: 0.06 })), K.tint(K.xform(K.boxc(0, 0.04, 0, 0.22, 0.33, 0.22), { x: lx, y: ly, z: 0, ry: 0.3, rz: 0.06 }), 0.5)]);
      ctx.block.circle(x, z, 0.34);
      ctx.plant('grass', { x, z: z + 0.2, r: 0.6, n: 5, kind: 'weed', seed: 8 });
    }
    { // the sundial, east of the way in: its gnomon is bent and it no longer stands true
      const x = -16.3, z = -33.9, y = gy(x, z) - 0.03, o = { x, y, z, rz: 0.055, rx: -0.03, ry: 0.3 };
      at(o, [M.stoneDark, K.poly(K.ngon(0, 0, 0.66, 8, Math.PI / 8), 0, 0.15)],
        [M.stone, K.poly(K.ngon(0, 0, 0.48, 8, Math.PI / 8), 0.15, 0.28)],
        [M.sand, K.lathe([[0.27, 0.28], [0.29, 0.34], [0.17, 0.42], [0.13, 0.62], [0.2, 0.84], [0.15, 1.02], [0.17, 1.08], [0.3, 1.14], [0.33, 1.17]], 8, { flat: true }), K.wobble(K.poly(K.ngon(0, 0, 0.37, 8, Math.PI / 8), 1.17, 1.26), 0.012, 3)],
        [M.bronze, K.tint(K.lathe([[0.001, 1.26], [0.27, 1.26], [0.27, 1.285], [0.001, 1.285]], 12), 0.42), K.tint(K.xform(K.extrude([[0, 0], [0.22, 0], [0.03, 0.17]], 0.02, null), { x: -0.08, y: 1.285, z: 0.01, ry: 0.5, rz: 0.0, rx: 0.35 }), 0.6)]);
      ctx.block.circle(x, z, 0.5);
      ctx.plant('grass', { x, z, r: 0.9, n: 7, kind: 'tuft', seed: 9 }); ctx.plant('grass', { x: x + 0.5, z: z - 0.3, r: 0.5, n: 3, kind: 'moonflower', seed: 10 });
    }
    { // a statue's pedestal in the north-east corner: only the hem of the robe is left standing; the rest lies in the grass
      const x = -12.6, z = -45.6, y = gy(x, z) - 0.04, o = { x, y, z, ry: -0.2 };
      at(o, [M.stoneDark, K.boxc(0, 0, 0, 1.24, 0.22, 1.24), K.tint(K.boxc(0, 0.22, 0, 1.06, 0.12, 1.06), 1.08)],
        [M.stone, K.boxc(0, 0.34, 0, 0.9, 0.8, 0.9)],
        [M.sand, K.boxc(0, 1.14, 0, 1.0, 0.07, 1.0), K.boxc(0, 1.21, 0, 1.1, 0.1, 1.1), K.tint(K.boxc(0, 0.5, 0.455, 0.56, 0.44, 0.03), 0.9),
          K.wobble(K.lathe([[0.36, 1.31], [0.33, 1.5], [0.26, 1.78], [0.29, 1.86], [0.16, 1.96], [0.001, 1.9]], 8, { flat: true }), 0.03, 6),
          K.rock({ x: -1.0, y: 0.16, z: 0.8, sx: 0.3, sy: 0.26, sz: 0.62, seed: 14, ry: -0.5 }), K.rock({ x: -0.1, y: 0.12, z: 1.25, sx: 0.18, sy: 0.18, sz: 0.2, seed: 17 }), K.tube([[-1.3, 0.1, 0.15], [-1.5, 0.12, 0.5], [-1.5, 0.06, 0.75]], [0.09, 0.06], 5)]);
      ctx.block.rect(x - 0.7, z - 0.7, x + 0.7, z + 0.7); ctx.block.circle(x - 1.1, z + 0.65, 0.6);
      ctx.plant('grass', { x: x - 0.6, z: z + 1.0, r: 1.1, n: 7, kind: 'tuft', seed: 11 }); ctx.plant('grass', { x: x + 0.2, z: z - 0.9, r: 0.5, n: 3, kind: 'tall', seed: 14 });
    }
    { // the grave slab of an abbot, flat in the grass: a crozier and a border, worn nearly smooth (its own little texture)
      const TW = 76, TH = 32, fb = HD.fbm, h2 = HD.hash2;
      const can = HD.T.paint(TW, TH, (px, py) => { const x = px, y = TH - 1 - py;       // y up the screen (north)
        const ex = Math.min(x, TW - 1 - x), ey = Math.min(y, TH - 1 - y), e = Math.min(ex, ey), wear = fb(x * 0.11, y * 0.11, 31, 3), n = (h2(x, y, 3) - 0.5) * 0.6;
        let t = 4.7 + (fb(x * 0.06, y * 0.09, 12, 3) - 0.5) * 1.8 + n;
        if (e === 0) return ['stone', y === 0 || x === TW - 1 ? 2.2 : 6.2, 0.4];
        const mossy = fb(x * 0.13 + 9, y * 0.13, 21, 3) + Math.max(0, 5 - e) * 0.05 + (x > 58 ? 0.06 : 0); if (mossy > 0.67) return ['moss', 1.8 + (mossy - 0.67) * 9 + n, 0.8];
        const crack = Math.abs(x - (47 + (y - 16) * 0.35 + Math.sin(y * 0.9) * 1.2)); if (crack < 0.7) return ['stone', 1.6, 0.4]; if (crack < 1.7 && x > 47) t += 0.8;
        let cut = false;
        if ((e === 3 || (e === 4 && ey === 4 && ex > 4)) && wear > 0.36) cut = e === 3;                         // border line
        const dy = y - 15.5; if (Math.abs(dy) < 0.8 && x > 17 && x < 66) cut = true;                           // the staff
        const cr = Math.hypot(x - 14, y - 19.5); if (cr > 3.2 && cr < 4.6 && !(x > 14 && y < 19.5)) cut = true; if (Math.hypot(x - 15.5, y - 20.5) < 1.2) cut = true;   // the crook
        if (Math.abs(x - 62) < 0.8 && Math.abs(dy) < 3.5) cut = true;                                           // a cross-bar near the foot
        if (ey > 6 && ey < 9 && x > 22 && x < 60 && ((x * 7 + (y > 16 ? 3 : 0)) % 5 < 2) && h2(x >> 1, y >> 2, 5) < 0.7) cut = true;   // what is left of the lettering
        if (cut && wear > 0.33) return ['stone', 2.3 + n, 0.5];
        return ['stone', t, 0.8]; });
      const mat = M.make(can, { mode: 'uv', name: 'abbotSlab' });
      const x = -14.5, z = -43.9, y = gy(x, z), w = TW / 64, d = TH / 64, o = { x, y: y - 0.02, z, ry: 0.06, rz: 0.012 };
      at(o, [M.stoneDark, K.tint(K.box(-w, -0.3, -d, w, 0.1, d), 0.95)], [mat, K.quad([-w, 0.101, d], [w, 0.101, d], [w, 0.101, -d], [-w, 0.101, -d])]);
      ctx.plant('grass', { x: x - 0.9, z: z - 0.55, r: 0.5, n: 4, kind: 'tuft', seed: 12 }); ctx.plant('grass', { x: x + 1.2, z: z + 0.2, r: 0.4, n: 3, kind: 'moonflower', seed: 13 });
    }

    // the footings of the lost west walk: a broken line of stones in the grass along the boundary wall
    { const r = ctx.rng(733); for (let z = -45.7; z < -34.4; z += r.range(0.8, 1.35)) { if (r() < 0.36 || Math.abs(z + 38.8) < 1.5) continue; const x = -26.3 + r.range(-0.07, 0.07);
        B.add(M.stone, K.tint(K.chunk({ x, y: gy(x, z) - 0.13, z, w: r.range(0.55, 0.9), h: r.range(0.28, 0.44), d: r.range(0.4, 0.55), seed: r.int(1, 999), ry: Math.PI / 2 + r.range(-0.12, 0.12), rx: r.range(-0.06, 0.06), rz: r.range(-0.06, 0.06) }), r.range(0.78, 0.98))); }
      const p = [-26.3, -41.9]; B.add(M.sand, K.tint(colo(p[0], gy(p[0], p[1]) + 0.08, p[1], 0.42, 0.085, true), 0.9)); }

    // ====================================================================================================== plants
    // round the basin: reeds at the rim, moonflowers, grass coming up between the flags
    for (const a of [203, 219, 236, 304, 321, 338]) ctx.plant('grass', { x: PX + Math.cos(a * DEG) * 3.58, z: PZ + Math.sin(a * DEG) * 3.58, r: 0.16, n: 2, kind: 'reed', seed: a });      // reeds only on the far side: nothing tall between the camera and the water
    for (const a of [249, 291]) ctx.plant('grass', { x: PX + Math.cos(a * DEG) * 3.62, z: PZ + Math.sin(a * DEG) * 3.62, r: 0.24, n: 4, kind: 'reed', seed: a });
    for (const p of [[-15.0, -38.3, 0.7, 5], [-14.5, -41.6, 0.8, 6], [-22.9, -41.2, 0.6, 4], [-20.6, -45.0, 0.7, 5], [-17.3, -45.1, 0.6, 4], [-23.3, -36.0, 0.5, 3], [-21.2, -34.2, 0.5, 3]]) ctx.plant('grass', { x: p[0], z: p[1], r: p[2], n: p[3], kind: 'moonflower', seed: Math.round(p[0] * 7 + p[1]) });
    { const r = ctx.rng(77); for (let k = 0; k < 16; k++) { const a = r.range(0, TAU), rr = r.range(3.3, 4.75); ctx.plant('grass', { x: PX + Math.cos(a) * rr, z: PZ + Math.sin(a) * rr, r: 0.22, n: 2, kind: 'tuft', seed: 300 + k }); } }
    // the garth itself: rough grass everywhere off the paths, taller toward the walls
    { const r = ctx.rng(88); for (let k = 0; k < 46; k++) { const x = r.range(-26.6, -11.6), z = r.range(-46.6, -33); if (L.pathDist(x, z) < 1.35 || Math.hypot(x - PX, z - PZ) < 4.9 || ctx.blocked(x, z, 0.3)) continue;
      const edge = z < -44.8 || x < -25.6 || x > -12.6; ctx.plant('grass', { x, z, r: 0.8, n: 4, kind: edge && r() < 0.6 ? 'tall' : r() < 0.3 ? 'weed' : 'tuft', seed: 400 + k }); } }
    grassLine(-26.6, -34, -26.6, -46.5, 1.0, { r: 0.5, n: 5, kind: 'tall' }); grassLine(-11.9, -34, -11.9, -37.6, 1.0, { r: 0.4, n: 4, kind: 'tall' }); grassLine(-11.9, -42.4, -11.9, -47, 1.0, { r: 0.4, n: 4, kind: 'tall' });
    ctx.plant('bush', { x: -26.1, z: -45.6, r: 0.9, kind: 'fern', seed: 9 }); ctx.plant('bush', { x: -12.2, z: -42.6, r: 0.8, kind: 'fern', seed: 10 }); ctx.plant('bush', { x: -15.2, z: -47.0, r: 0.7, kind: 'shrub', seed: 11 });

    // ================================================================================================== fireflies
    // a handful of drifting, slowly blinking dots over the water and the moonflowers (one draw call, two world dots each)
    {
      const N = 6, r = ctx.rng(909), base = [], pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new T.Color('#c9dc7a').convertSRGBToLinear();
      for (let i = 0; i < N; i++) base.push([PX + r.range(-4.4, 4.4), r.range(1.0, 2.2), PZ + r.range(-3.2, 4.0), r.range(0, 6.28), r.range(0.55, 1.0)]);
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      const pts = new T.Points(g, new T.PointsMaterial({ size: 0.27, sizeAttenuation: true, vertexColors: true, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      pts.name = 'fireflies'; pts.frustumCulled = false; ctx.add(pts);
      const upd = t => { for (let i = 0; i < N; i++) { const b = base[i], a = t * 0.21 * b[4] + b[3], k = Math.max(0, Math.sin(t * 0.9 * b[4] + b[3] * 3)), s = k * k * 0.95;
          pos[i * 3] = b[0] + Math.sin(a) * 1.1 + Math.sin(a * 2.3) * 0.3; pos[i * 3 + 1] = b[1] + Math.sin(a * 1.7 + 1) * 0.35; pos[i * 3 + 2] = b[2] + Math.cos(a * 0.8) * 0.9;
          col[i * 3] = c.r * s; col[i * 3 + 1] = c.g * s; col[i * 3 + 2] = c.b * s; }
        g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; };
      upd(0); ctx.onUpdate(upd);
    }

    B.build();
  };
})();
