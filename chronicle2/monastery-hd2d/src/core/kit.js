// Geometry kit: the parts Gothic masonry is made of. Everything returns a THREE.BufferGeometry already placed in world
// space (x east, y up, z south). Collect geometries per material with ctx.batch() and build once.
// No UVs are needed for world materials (see mat.js). Colours: K.tint(geom, grey) darkens/lightens a piece (vertex colour).
(function () {
  const HD = (window.HD = window.HD || {});
  const K = (HD.K = {});
  const V3 = () => new THREE.Vector3();

  // ------------------------------------------------------------------------------------------------------- utilities
  // merge(list): one non-indexed geometry with position, normal, uv, color (missing attributes are filled in).
  K.merge = function (list) {
    list = list.flat(Infinity).filter(Boolean);
    let n = 0; const gs = list.map(g => { const q = g.index ? g.toNonIndexed() : g; if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return q; });
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1);
    let o = 0;
    for (const g of gs) { const c = g.attributes.position.count; pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3); nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2); if (g.attributes.color && g.attributes.color.itemSize === 3) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3); o += c; }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  };
  // tint(geom, r[, g, b]): multiply the texture by a grey (one number) or a colour, per piece. 1 = unchanged.
  K.tint = function (g, r, gg, b) { if (gg === undefined) { gg = r; b = r; } const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  // shade(geom, fn(x,y,z) -> grey): per-vertex tint, e.g. darker toward the ground.
  K.shade = function (g, fn) { const p = g.attributes.position, n = p.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i)); a[i * 3] = a[i * 3 + 1] = a[i * 3 + 2] = v; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  // xform(geom, {x,y,z, rx,ry,rz, s | sx,sy,sz}): scale, then rotate (order Y, X, Z), then move. Returns geom.
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  K.xform = function (g, o) { _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e); const s = o.s === undefined ? 1 : o.s;
    _m.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), _q, new THREE.Vector3(o.sx === undefined ? s : o.sx, o.sy === undefined ? s : o.sy, o.sz === undefined ? s : o.sz)); g.applyMatrix4(_m); return g; };
  // flat(geom): faceted shading (each face its own normal).
  K.flat = function (g) { const q = g.index ? g.toNonIndexed() : g; q.computeVertexNormals(); return q; };
  // wobble(geom, amount, seed): nudge every vertex by a hash of its position (shared vertices move together, so no cracks). Makes cut stone look hand-made.
  K.wobble = function (g, amt, seed, keepNormals) { const p = g.attributes.position; seed = seed || 1; const h = (x, y, z, s) => HD.hash2(Math.round(x * 53.1) + Math.round(z * 97.3), Math.round(y * 71.7) + Math.round(z * 13.9), s) - 0.5;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + h(x, y, z, seed) * 2 * amt, y + h(x, y, z, seed + 1) * 2 * amt, z + h(x, y, z, seed + 2) * 2 * amt); }
    if (!keepNormals) { if (g.index) g.computeVertexNormals(); else g.computeVertexNormals(); } return g; };

  // ------------------------------------------------------------------------------------------------------ primitives
  K.box = function (x0, y0, z0, x1, y1, z1) { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
  // boxc(cx, y0, cz, w, h, d[, ry]): box centred in plan, sitting on y0, optionally turned about the vertical.
  K.boxc = function (cx, y0, cz, w, h, d, ry) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(cx, y0, cz); return g; };
  // extrude(pts [[u,v]..], depth, holes [[[u,v]..]..]): shape in the XY plane pushed from z=0 to z=depth. Local use (see wall()).
  K.shape = function (pts, holes) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); (holes || []).forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))))); return s; };
  K.extrude = function (pts, depth, holes) { return new THREE.ExtrudeGeometry(K.shape(pts, holes), { depth, bevelEnabled: false, steps: 1 }); };
  // poly(pts [[x,z]..], y0, y1[, holes]): vertical prism standing on a plan polygon (polygonal towers, apses, plinths, kerbs).
  K.poly = function (pts, y0, y1, holes) { const g = K.extrude(pts.map(p => [p[0], -p[1]]), y1 - y0, (holes || []).map(h => h.map(p => [p[0], -p[1]]))); g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g; };
  // ngon(cx, cz, r, n[, rot]) -> plan points of a regular polygon (use with poly).
  K.ngon = function (cx, cz, r, n, rot) { const a = []; for (let i = 0; i < n; i++) { const t = (rot || 0) + i / n * Math.PI * 2; a.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]); } return a; };
  // lathe(profile [[r,y]..] bottom to top, sides, {x,y,z, ry, flat}): turned shape (column shafts, basins, urns, bells). r=0 at an end closes it.
  K.lathe = function (profile, sides, o) { o = o || {}; let g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(Math.max(p[0], 0.0001), p[1])), sides || 10);
    if (o.flat) g = K.flat(g); if (o.ry) g.rotateY(o.ry); g.translate(o.x || 0, o.y || 0, o.z || 0); return g; };
  // tube(pts [[x,y,z]..], radius | [r0, r1] | fn(t), sides): bent tapered tube through points (branches, roots, ribs, iron bars, ropes).
  K.tube = function (pts, rad, sides, o) { o = o || {}; sides = sides || 6; const n = pts.length, P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2])); const pos = [], idx = [];
    const rf = typeof rad === 'function' ? rad : Array.isArray(rad) ? t => rad[0] + (rad[1] - rad[0]) * t : () => rad;
    let nrm = null; const tan = V3(), bin = V3();
    for (let i = 0; i < n; i++) { tan.copy(P[Math.min(i + 1, n - 1)]).sub(P[Math.max(i - 1, 0)]).normalize();
      if (!nrm) { nrm = Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); }
      nrm.sub(tan.clone().multiplyScalar(nrm.dot(tan))).normalize(); bin.crossVectors(tan, nrm);
      const r = rf(i / (n - 1)); for (let k = 0; k < sides; k++) { const a = k / sides * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r; pos.push(P[i].x + nrm.x * c + bin.x * s, P[i].y + nrm.y * c + bin.y * s, P[i].z + nrm.z * c + bin.z * s); } }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) { const a = i * sides + k, b = i * sides + (k + 1) % sides, c = a + sides, d = b + sides; idx.push(a, b, c, b, d, c); }
    // end caps
    const c0 = pos.length / 3; pos.push(P[0].x, P[0].y, P[0].z); const c1 = c0 + 1; pos.push(P[n - 1].x, P[n - 1].y, P[n - 1].z);
    for (let k = 0; k < sides; k++) { idx.push(c0, (k + 1) % sides, k); idx.push(c1, (n - 1) * sides + k, (n - 1) * sides + (k + 1) % sides); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return o.flat ? K.flat(g) : g; };
  // spire({x,y,z, r, h, sides, ry}): pyramid/cone roof. For a square plan aligned to the axes with half-width a: r = a*1.414, sides 4, ry = PI/4.
  K.spire = function (o) { let g = new THREE.ConeGeometry(o.r, o.h, o.sides || 4, 1, false); g = K.flat(g); g.translate(0, o.h / 2, 0); g.rotateY(o.ry === undefined ? Math.PI / 4 : o.ry); g.translate(o.x || 0, o.y || 0, o.z || 0); return g; };
  // gable({x0,x1,z0,z1, y, rise, over, thick, axis}): two-slope roof shell. axis 'z' = ridge runs north-south (slopes face east/west); 'x' = ridge runs east-west (slopes face south/north).
  K.gable = function (o) { const over = o.over === undefined ? 0.35 : o.over, th = o.thick || 0.22; const ax = o.axis || 'x';
    const span = ax === 'x' ? (o.z1 - o.z0) : (o.x1 - o.x0), len = ax === 'x' ? (o.x1 - o.x0) : (o.z1 - o.z0), hw = span / 2 + over, k = o.rise / (span / 2), top = o.rise + over * 0 , drop = over * k;
    const pts = [[-hw, -drop], [0, top], [hw, -drop], [hw, -drop - th], [0, top - th * 1.15], [-hw, -drop - th]];
    const g = K.extrude(pts, len + over * 2, null); g.translate(0, 0, -over);
    if (ax === 'x') { g.rotateY(Math.PI / 2); g.translate(o.x0, o.y, (o.z0 + o.z1) / 2); } else { g.translate((o.x0 + o.x1) / 2, o.y, o.z0); }
    return g; };
  // steps({x0,x1, z0,z1, y0,y1, n, base}): a straight flight. z0 is the foot (height y0), z1 the head (height y1); works in either z direction.
  // along:'x' swaps the roles of x and z (then x0 is the foot and x1 the head, z0..z1 the width).
  K.steps = function (o) { const gs = [], n = o.n, base = o.base === undefined ? Math.min(o.y0, o.y1) - 0.6 : o.base; const dy = (o.y1 - o.y0) / n;
    for (let k = 0; k < n; k++) { const yt = o.y0 + dy * (k + 1);
      if (o.along === 'x') { const a = o.x0 + (o.x1 - o.x0) * k / n, b = o.x0 + (o.x1 - o.x0) * (k + 1) / n; gs.push(K.box(Math.min(a, b), base, o.z0, Math.max(a, b), yt, o.z1)); }
      else { const a = o.z0 + (o.z1 - o.z0) * k / n, b = o.z0 + (o.z1 - o.z0) * (k + 1) / n; gs.push(K.box(o.x0, base, Math.min(a, b), o.x1, yt, Math.max(a, b))); } }
    return K.merge(gs); };
  // rock({x,y,z, sx,sy,sz, seed, detail, ry}): irregular faceted boulder / broken stone.
  K.rock = function (o) { let g = new THREE.IcosahedronGeometry(1, o.detail === undefined ? 1 : o.detail); g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, s = o.seed || 1;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.72 + 0.5 * HD.hash2(Math.round(x * 31) + Math.round(z * 17), Math.round(y * 29) - Math.round(z * 11), s); p.setXYZ(i, x * k, Math.max(y * k, -0.35), z * k); }
    g.computeVertexNormals(); return K.xform(g, { x: o.x, y: o.y, z: o.z, sx: o.sx || 1, sy: o.sy || o.sx || 1, sz: o.sz || o.sx || 1, ry: o.ry || 0 }); };
  // chunk({x,y,z, w,h,d, seed}): a fallen dressed block, lying askew, slightly battered.
  K.chunk = function (o) { const r = HD.rng(o.seed || 1); const g = new THREE.BoxGeometry(o.w, o.h, o.d, 2, 1, 2); K.wobble(g, Math.min(o.w, o.h, o.d) * 0.07, o.seed || 1);
    return K.xform(K.flat(g), { x: o.x, y: (o.y || 0) + o.h * 0.42, z: o.z, ry: o.ry === undefined ? r.range(0, 6.28) : o.ry, rx: o.rx === undefined ? r.range(-0.22, 0.22) : o.rx, rz: o.rz === undefined ? r.range(-0.22, 0.22) : o.rz }); };
  // rubble({x,z,y, n, spread, size:[min,max], seed, flatness}): a scatter of fallen blocks and stones around a point. Returns one geometry.
  K.rubble = function (o) { const r = HD.rng(o.seed || 1), gs = [], sz = o.size || [0.25, 0.7];
    for (let i = 0; i < o.n; i++) { const a = r.range(0, 6.283), d = Math.abs(r.range(-1, 1) + r.range(-1, 1)) * 0.5 * o.spread, s = r.range(sz[0], sz[1]) * (1 - 0.4 * d / o.spread), x = o.x + Math.cos(a) * d * (o.sx || 1), z = o.z + Math.sin(a) * d * (o.sz || 1), y = typeof o.y === 'function' ? o.y(x, z) : (o.y || 0);
      gs.push(r() < 0.55 ? K.chunk({ x, y, z, w: s * r.range(1, 1.8), h: s * r.range(0.5, 0.9), d: s * r.range(0.7, 1.2), seed: r.int(1, 99999) }) : K.rock({ x, y: y + s * 0.2, z, sx: s * 0.7, sy: s * 0.5, sz: s * 0.6, seed: r.int(1, 99999), detail: 0, ry: a })); }
    return K.merge(gs); };
  // quad(p0,p1,p2,p3): one flat card with UVs (0,0)(1,0)(1,1)(0,1); points as [x,y,z]. For light beams, glass, signs.
  K.quad = function (p0, p1, p2, p3) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)); g.computeVertexNormals(); return g; };

  // --------------------------------------------------------------------------------------------------------- columns
  // column({x,z,y, h, r, sides, base, cap, broken, seed}): shaft with moulded base on a square plinth and a flared capital under a square abacus.
  // h is the full height including base and capital. broken:true leaves a snapped stump of height h without a capital.
  K.column = function (o) { const r = o.r || 0.45, h = o.h, y = o.y || 0, sides = o.sides || 10, gs = []; const base = o.base !== false, cap = o.cap !== false && !o.broken;
    const pr = []; let y0 = 0;
    if (base) { gs.push(K.boxc(0, 0, 0, r * 3.0, 0.32, r * 3.0)); pr.push([r * 1.42, 0.32], [r * 1.5, 0.40], [r * 1.42, 0.48], [r * 1.16, 0.52], [r * 1.24, 0.58], [r * 1.24, 0.62], [r * 1.02, 0.68]); y0 = 0.68; } else pr.push([r, 0]);
    const yc = cap ? h - 0.95 : h; pr.push([r * 0.93, yc]);
    if (cap) { pr.push([r * 1.1, yc + 0.05], [r * 1.1, yc + 0.13], [r * 0.96, yc + 0.17], [r * 1.05, yc + 0.34], [r * 1.5, yc + 0.62], [r * 1.56, yc + 0.66]); gs.push(K.boxc(0, yc + 0.66, 0, r * 3.3, 0.29, r * 3.3)); }
    else if (o.broken) { pr.push([r * 0.5, yc + 0.12], [0, yc + 0.05]); }
    else pr.push([0, yc]);
    gs.push(K.lathe(pr, sides));
    const g = K.merge(gs); if (o.broken) K.wobble(g, 0.03, o.seed || 3, true); return K.xform(g, { x: o.x, y, z: o.z, ry: o.ry || 0 }); };
  // drum({x,y,z, r, len, seed, ry}): a fallen column drum lying on its side.
  K.drum = function (o) { const g = new THREE.CylinderGeometry(o.r, o.r * 0.97, o.len, 10, 1); g.rotateZ(Math.PI / 2); return K.xform(g, { x: o.x, y: (o.y || 0) + o.r * 0.92, z: o.z, ry: o.ry || 0, rz: o.rz || 0 }); };

  // ----------------------------------------------------------------------------------------------------------- arches
  // arch(cx, sill, w, spring, rise[, off, n]) -> outline points [[u,v]..] of an opening: jambs from sill up to spring, then a two-centred
  // (pointed) arch whose apex is `rise` above the spring line. rise = w/2 is a round arch, 0.866*w the classic equilateral
  // pointed arch, more is a lancet. `off` grows the outline outward by that distance (used for mouldings); off never lowers the sill.
  K.arch = function (cx, sill, w, spring, rise, off, n) { off = off || 0; n = n || 7; const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw; const R2 = R + off, hw2 = hw + off;
    const pts = [[cx - hw2, sill], [cx + hw2, sill]]; const a1 = Math.acos(Math.min(1, c / R2));
    for (let i = 0; i <= n; i++) { const a = a1 * i / n; pts.push([cx - c + Math.cos(a) * R2, spring + Math.sin(a) * R2]); }
    for (let i = n - 1; i >= 0; i--) { const a = a1 * i / n; pts.push([cx + c - Math.cos(a) * R2, spring + Math.sin(a) * R2]); }
    return pts; };
  K.archTop = function (w, rise, off) { const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw, R2 = R + (off || 0); return Math.sqrt(Math.max(0, R2 * R2 - c * c)); };   // apex height above the spring line
  // ruin(L, {seed, lo, hi, scale, course, block, env}) -> top profile [[u,v]..] of a wall broken down stone by stone: stepped in courses
  // and block lengths, never a smooth curve. lo..hi is the height range; env(u01) -> 0..1 optionally shapes it (e.g. high at one end).
  K.ruin = function (L, o) { o = o || {}; const r = HD.rng(o.seed || 1), course = o.course || 0.5, lo = o.lo === undefined ? 1 : o.lo, hi = o.hi === undefined ? 4 : o.hi, sc = o.scale || 5; const pts = []; let u = 0, prev = null;
    while (u < L - 1e-6) { let bl = r.range(0.6, 1.5) * (o.block || 1); if (L - u - bl < 0.5) bl = L - u; const um = u + bl / 2; let t = HD.fbm(um / sc + (o.seed || 1) * 7.3, 0.5, o.seed || 1, 3); t = Math.min(1, Math.max(0, (t - 0.5) * 1.9 + 0.5)); if (o.env) t *= o.env(um / L);
      let h = lo + (hi - lo) * t; h = Math.max(lo, Math.round(h / course) * course); if (prev !== null && h === prev && r() < 0.3) h += (r() < 0.5 ? -1 : 1) * course; h = Math.max(course, h);
      pts.push([u, h], [u + bl, h]); prev = h; u += bl; }
    pts[pts.length - 1][0] = L; return pts; };
  // height of a ruin()/top profile at u
  K.topAt = function (top, u) { if (typeof top === 'number') return top; for (let i = 0; i < top.length - 1; i++) if (u >= top[i][0] && u <= top[i + 1][0]) { const a = top[i], b = top[i + 1]; return b[0] === a[0] ? Math.min(a[1], b[1]) : a[1] + (b[1] - a[1]) * (u - a[0]) / (b[0] - a[0]); } return top[top.length - 1][1]; };

  // ------------------------------------------------------------------------------------------------------------ walls
  // wall(a, b[, y0]) -> a builder for one straight wall line from plan point a=[x,z] to b=[x,z], base at height y0.
  // Local wall coordinates: u = distance along the wall from a, v = height above y0, w = distance out from the wall's centre plane.
  // +w is the FRONT: the right-hand side when walking from a to b. Draw walls west -> east and the front faces south (the camera);
  // draw them north -> south and the front faces west. All methods return world-space geometry.
  K.wall = function (a, b, y0) { y0 = y0 || 0; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const mat = new THREE.Matrix4().set(ux, 0, -uz, a[0], 0, 1, 0, y0, uz, 0, ux, a[1], 0, 0, 0, 1);
    const W = { L, a, b, y0, matrix: mat, nx: -uz, nz: ux };
    W.put = g => { g.applyMatrix4(mat); return g; };                               // local geometry -> world
    W.pt = (u, v, w) => new THREE.Vector3(u, v || 0, w || 0).applyMatrix4(mat);     // local point -> world Vector3
    W.xz = (u, w) => [a[0] + ux * u - uz * (w || 0), a[1] + uz * u + ux * (w || 0)];   // local (u,w) -> plan [x,z]
    // solid({t, h | top, holes, w, v0, u0, u1}): the wall body. t thickness; h a flat height, or top a profile from K.ruin (or any [[u,v]..] from u0 to u1);
    // holes: outlines from K.arch (or any [[u,v]..]) that must lie fully inside the wall face; w shifts the body off the centre plane; v0 base (default 0).
    W.solid = function (o) { const u0 = o.u0 || 0, u1 = o.u1 === undefined ? L : o.u1, v0 = o.v0 || 0; let top = o.top; if (top === undefined) top = [[u0, o.h], [u1, o.h]];
      const pts = [[u0, v0], [u1, v0]]; for (let i = top.length - 1; i >= 0; i--) pts.push([Math.min(u1, Math.max(u0, top[i][0] + (o.top && o.u0 ? 0 : 0))), top[i][1]]);
      const g = K.extrude(pts, o.t, o.holes); g.translate(0, 0, (o.w || 0) - o.t / 2); return W.put(g); };
    // box(u0, u1, v0, v1, w0, w1): a block in wall coordinates (string courses, sills, plinths, corbels, lintels).
    W.box = (u0, u1, v0, v1, w0, w1) => W.put(K.box(u0, v0, w0, u1, v1, w1));
    // archTrim(cx, sill, w, spring, rise, {band, depth, at, foot}): a moulding following an arched opening: a band `band` wide standing `depth`
    // proud, its back at w = at (use at = t/2 for the front face). Stack two or three (growing band, shrinking depth) for a stepped Gothic portal.
    W.archTrim = function (cx, sill, w, spring, rise, o) { o = o || {}; const band = o.band || 0.25, inner = K.arch(cx, sill, w, spring, rise, o.inset || 0), outer = K.arch(cx, sill, w, spring, rise, (o.inset || 0) + band);
      const pts = outer.slice(1).concat([outer[0]]).reverse();   // outer: from bottom-left over the top to bottom-right, reversed below
      const ring = []; ring.push(outer[1]); for (let i = 2; i < outer.length; i++) ring.push(outer[i]); ring.push(outer[0]); ring.push(inner[0]); for (let i = inner.length - 1; i >= 1; i--) ring.push(inner[i]);
      const g = K.extrude(ring, o.depth || 0.2, null); g.translate(0, 0, o.at || 0); return W.put(g); };
    // tracery(cx, sill, w, spring, rise, {lights, bar, depth, at}): stone window tracery filling an arched opening: mullions, a pointed head
    // over each light and (for 2 lights) a round oculus in the top. `at` is the w position of its back face (centre it in the wall: at = -depth/2).
    W.tracery = function (cx, sill, w, spring, rise, o) { o = o || {}; const N = o.lights || 2, bar = o.bar || 0.13, depth = o.depth || 0.2; const outer = K.arch(cx, sill, w, spring, rise, 0, 9), holes = [];
      const lw = (w - bar * (N + 1)) / N, R = (w * w / 4 + rise * rise) / w, c = R - w / 2; const headAt = x => { const d = Math.abs(x - cx) + c; return spring + Math.sqrt(Math.max(0, R * R - d * d)); };
      for (let i = 0; i < N; i++) { const lc = cx - w / 2 + bar + lw / 2 + i * (lw + bar); const mid = N === 3 && i === 1; let sp = spring - lw * 0.1 + (mid ? lw * 0.55 : 0), rs = lw * 0.85;
        const lim = Math.min(headAt(lc - lw * 0.3), headAt(lc + lw * 0.3)) - bar * 1.3; if (sp + rs * 0.75 > lim) sp = lim - rs * 0.75; holes.push(K.arch(lc, sill + bar, lw, sp, rs, 0, 5)); }
      if (N === 2) { const ro = Math.min(w * 0.17, rise * 0.24), cy = spring + rise - ro - bar * 1.7; const circ = []; for (let i = 0; i < 12; i++) { const t = i / 12 * 6.283; circ.push([cx + Math.cos(t) * ro, cy + Math.sin(t) * ro]); } holes.push(circ); }
      const g = K.extrude(outer, depth, holes); g.translate(0, 0, o.at === undefined ? -depth / 2 : o.at); return W.put(g); };
    // pane(cx, sill, w, spring, rise, {at}): the flat face of an arched opening with 0..1 UVs across its bounding box (u left->right, v bottom->top;
    // canvas row 0 is the top). Use with HD.M.glass(canvas) for stained glass, or HD.M.void for a dark opening.
    W.pane = function (cx, sill, w, spring, rise, o) { o = o || {}; const pts = K.arch(cx, sill, w, spring, rise, o.off || 0, 8), g = new THREE.ShapeGeometry(K.shape(pts)); const p = g.attributes.position, uv = g.attributes.uv, top = spring + K.archTop(w, rise, o.off || 0);
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - (cx - w / 2)) / w, (top - p.getY(i)) / (top - sill)); g.translate(0, 0, o.at || 0); return W.put(g); };
    // buttress(u, {width, stages:[[depth, height], ...], side, v0}): a stepped buttress against the wall at u, each stage shallower than the one
    // below, with sloped weatherings between and on top. side +1 = front (+w), -1 = back. Depths are measured from w0 (default: the wall face you pass as `face`).
    W.buttress = function (u, o) { const wd = o.width || 0.9, side = o.side || 1, face = o.face || 0, st = o.stages, v0 = o.v0 || 0, k = o.slope || 1.3; const pts = [[0, v0], [st[0][0], v0]];
      for (let i = 0; i < st.length; i++) { const d = st[i][0], h = st[i][1], nd = i + 1 < st.length ? st[i + 1][0] : 0; pts.push([d, h]); pts.push([nd, h + (d - nd) * k]); }
      const g = K.extrude(pts.map(p => [-p[0], p[1]]), wd, null); g.rotateY(Math.PI / 2); if (side < 0) g.scale(1, 1, -1); const out = side < 0 ? K.flipWinding(g) : g; out.translate(u - wd / 2, 0, face * side); return W.put(out); };
    return W; };
  K.flipWinding = function (g) { const q = g.index ? g.toNonIndexed() : g, p = q.attributes.position.array; for (let i = 0; i < p.length; i += 9) { for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; } } q.computeVertexNormals(); return q; };
})();
