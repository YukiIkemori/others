// The hill steps, the gate and the boundary walls: the first picture of the map.
//   hill steps   x -1.75..1.75, top (y 0) at z -8.5, 24 treads down to z 3.5 (y -6), then 15 more out of sight to z 11
//   gate         wall mass x -3.2..3.2 on z -10 (1.3 thick), arch 3.2 wide / 4.4 to the apex, gable 7.15 + cross, east shoulder broken away
//   walls        field-stone, 0.9 thick: z -10 (x -27.4..-3.2 and 3.2..27.4), x -27.4 (z -10..-50), x 27.4 (z -10..-56)
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.gate = function (ctx) {
  const K = ctx.K, M = ctx.M, L = ctx.L, PI = Math.PI, rng = ctx.rng, tint = K.tint, B = ctx.batch();

  // ---------------------------------------------------------------------------------------------------------- terrain
  // The shared terrain starts to fall at z = -8.4 at the same pitch as the flight, so for the first six units it lies up to
  // 0.3 ABOVE the inner corners of the treads and the ground mesh would bury the top steps. Cut a trench under the flight,
  // strictly inside the parapets (ground vertices x -1.5..1.5, z -8.5..-2). Nothing outside the stair is changed.
  if (!L._gateTrench) { const t0 = L.terrain; L._gateTrench = true; L.terrain = (x, z) => t0(x, z) - (x > -1.9 && x < 1.9 && z > -8.75 && z < -1.75 ? 1.3 : 0); }
  const ground = (x, z) => L.terrain(x, z);

  // ---------------------------------------------------------------------------------------------------- local helpers
  // a loose stone: a 12-triangle box, knocked out of square
  const blk = (x, y, z, w, h, d, seed, ry, rx, rz) => K.xform(K.wobble(K.flat(new THREE.BoxGeometry(w, h, d)), Math.min(w, h, d) * 0.1, seed), { x, y: y + h * 0.46, z, ry: ry || 0, rx: rx || 0, rz: rz || 0 });
  // rotate a placed piece about a point
  const about = (g, cx, cy, cz, o) => { g.translate(-cx, -cy, -cz); return K.xform(g, Object.assign({ x: cx, y: cy, z: cz }, o)); };
  // saddle-back coping stone running along z (ry = PI/2 turns it along x); y is its bed
  const coping = (cx, y, zc, len, w, o) => { o = o || {}; const hw = w / 2, e = o.eave || 0.09, rd = o.ridge || 0.18; const g = K.extrude([[-hw, 0], [hw, 0], [hw, e], [0, rd], [-hw, e]], len); g.translate(0, 0, -len / 2); K.wobble(g, 0.012, o.seed || 1);
    return K.xform(g, { x: cx, y, z: zc, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 }); };
  const mossPad = (x, y, z, sx, sz, seed) => K.rock({ x, y, z, sx, sy: 0.07, sz, seed, detail: 0, ry: seed });
  // a stone cross (wayside cross, gable finial)
  const cross = o => { const t = o.t || 0.14, h = o.h, a = o.arm, ya = h - a * 0.95, e = t * 0.72; const gs = [K.box(-t / 2, 0, -t / 2, t / 2, h, t / 2), K.box(-a, ya - t / 2, -t * 0.45, a, ya + t / 2, t * 0.45),
      K.box(-a - 0.02, ya - e, -t * 0.5, -a + t * 0.55, ya + e, t * 0.5), K.box(a - t * 0.55, ya - e, -t * 0.5, a + 0.02, ya + e, t * 0.5), K.box(-e, h - t * 0.55, -t * 0.5, e, h + 0.02, t * 0.5)];
    if (o.ring) gs.push(K.lathe([[t * 0.9, -t * 0.4], [t * 1.05, 0], [t * 0.9, t * 0.4]], 8, { y: ya * 0.42 }));
    return K.xform(K.merge(gs), { x: o.x, y: o.y, z: o.z, ry: o.ry || 0, rx: o.rx || 0, rz: o.rz || 0 }); };
  const stonePile = (r, x, z, n, spread, size, mat, tn) => { for (let i = 0; i < n; i++) { const a = r.range(0, 6.283), d = Math.sqrt(r()) * spread, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, s = r.range(size[0], size[1]);
    if (L.pathDist(px, pz) < 1.45) continue; B.add(mat || M.stonePlain, tint(blk(px, ground(px, pz) - 0.04, pz, s * r.range(1, 1.7), s * r.range(0.5, 0.85), s * r.range(0.7, 1.1), r.int(1, 9999), a, r.range(-0.25, 0.25), r.range(-0.25, 0.25)), (tn || 0.9) + r.range(-0.14, 0.12))); } };

  // ====================================================================================================== hill steps
  const ST = L.STAIR, X0 = ST.x0, X1 = ST.x1, ZT = ST.zTop, NT = 40, ty = k => -ST.rise * (k + 1), sr = rng(4101);
  // the top landing: one flagged podium that also carries the gate piers
  B.add(M.flag, tint(K.box(-3.36, -0.7, -9.42, 3.36, 0.035, ZT), 0.96));
  for (let k = 0; k < NT; k++) { const z0 = ZT + 0.5 * k, z1 = z0 + 0.5, y = ty(k), tb = 0.84 + 0.2 * sr();
    B.add(M.stonePlain, tint(K.box(X0, y - 0.62, z0, X1, y - 0.08, z1), 0.5 + 0.1 * sr()));             // riser block, in the shade of the nosing
    const cuts = [X0]; let x = X0; for (;;) { x += sr.range(0.75, 1.5); if (x > X1 - 0.6) break; cuts.push(x); } cuts.push(X1);
    for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i] + 0.014, b = cuts[i + 1] - 0.014, zs = z0 + 0.008, zn = z1 + 0.045, xm = (a + b) / 2, u = sr(), y0 = y - 0.085;
      const tn = tb * (1 + sr.range(-0.07, 0.07)) + 0.07 * (1 - Math.min(1, Math.abs(xm) / 1.2)) - (Math.abs(xm) > 1.15 ? 0.08 : 0);   // feet have polished the middle; the edges stay damp
      if (u < 0.07 && k > 0) {            // sunk and tilted
        B.add(M.stonePlain, tint(about(K.poly([[a, zs], [b, zs], [b, zn], [a, zn]], y0 - 0.03, y - 0.035), xm, y, (zs + zn) / 2, { rz: sr.range(-0.04, 0.04), rx: sr.range(0.01, 0.05) }), tn * 0.92));
      } else if (u < 0.17) {              // cracked across
        const f = a + (b - a) * sr.range(0.3, 0.7), g = f + sr.range(-0.2, 0.2), d = 0.016, dy = sr.range(-0.03, -0.012);
        B.add(M.stonePlain, tint(K.poly([[a, zs], [f - d, zs], [g - d, zn], [a, zn]], y0, y), tn), tint(K.poly([[f + d, zs], [b, zs], [b, zn], [g + d, zn]], y0, y + dy), tn * 0.93));
      } else if (u < 0.4) {               // a corner of the nosing knocked off
        const c = sr.range(0.1, 0.24), c2 = c * sr.range(0.5, 1.1), left = sr() < 0.5;
        B.add(M.stonePlain, tint(K.poly(left ? [[a, zs], [b, zs], [b, zn], [a + c, zn], [a, zn - c2]] : [[a, zs], [b, zs], [b, zn - c2], [b - c, zn], [a, zn]], y0, y + sr.range(-0.012, 0.006)), tn));
      } else if (u < 0.47) {              // the nosing broken away along half the slab
        const f = a + (b - a) * sr.range(0.35, 0.65), c = sr.range(0.07, 0.13);
        B.add(M.stonePlain, tint(K.poly([[a, zs], [b, zs], [b, zn - c], [f + 0.06, zn - c * 0.8], [f, zn], [a, zn]], y0, y), tn));
      } else B.add(M.stonePlain, tint(K.poly([[a, zs], [b, zs], [b, zn], [a, zn]], y0, y + sr.range(-0.014, 0.006)), tn)); }
    // moss in the corners against the parapets and along the foot of the riser above
    for (const s of [-1, 1]) if (sr() < 0.5) B.add(M.moss, tint(mossPad(s * (1.75 - sr.range(0.06, 0.2)), y - 0.01, z0 + sr.range(0.08, 0.3), sr.range(0.1, 0.24), sr.range(0.1, 0.2), sr.int(1, 999)), sr.range(0.8, 1.15)));
    if (sr() < 0.42) { const xa = sr.range(X0 + 0.05, X1 - 0.9), ln = sr.range(0.25, 0.85); B.add(M.moss, tint(K.box(xa, y - 0.01, z0, xa + ln, y + 0.03, z0 + sr.range(0.04, 0.08)), sr.range(0.75, 1.1))); }
  }
  B.add(M.stone, tint(K.box(-2.27, ground(0, 12.1) - 1.5, 11.5, 2.27, ty(NT - 1), 12), 0.8));           // closes the flight below, out of sight

  // stepped parapets: thirteen level sections, each three treads long, each 0.75 lower than the last, with saddle-back copings
  const squarePier = (cx, cz, hw, yb, yt, o) => { o = o || {};
    B.add(M.stone, K.shade(K.box(cx - hw, yb, cz - hw, cx + hw, yt, cz + hw), (x, y) => (o.tint || 1) * (y > yt - 0.01 ? 1.04 : Math.max(0.55, 1.04 - 0.13 * (yt - yb)))));
    B.add(M.stoneDark, K.box(cx - hw - 0.09, yb, cz - hw - 0.09, cx + hw + 0.09, o.plinth, cz + hw + 0.09), tint(K.box(cx - hw - 0.045, o.plinth, cz - hw - 0.045, cx + hw + 0.045, o.plinth + 0.07, cz + hw + 0.045), 1.15));
    B.add(M.sand, tint(K.box(cx - hw - 0.07, yt, cz - hw - 0.07, cx + hw + 0.07, yt + 0.13, cz + hw + 0.07), 0.86));
    if (o.cap === 'pyr') B.add(M.sand, tint(K.spire({ x: cx, y: yt + 0.13, z: cz, r: (hw + 0.03) * 1.414, h: o.ch || 0.52 }), 0.95), tint(K.lathe([[0.0, 0], [0.09, 0.03], [0.12, 0.11], [0.09, 0.19], [0, 0.22]], 6, { x: cx, y: yt + 0.13 + (o.ch || 0.52) - 0.06, z: cz }), 1.0));
    else { const r = rng(o.seed || 7); for (let i = 0; i < 3; i++) B.add(M.stonePlain, tint(blk(cx + r.range(-hw, hw) * 0.6, yt + 0.13, cz + r.range(-hw, hw) * 0.6, r.range(0.2, 0.36), r.range(0.12, 0.2), r.range(0.18, 0.3), r.int(1, 999), r.range(0, 3)), r.range(0.8, 1.0))); } };
  const NS = 10, pr = rng(4202), PX = 2.01;
  for (const s of [-1, 1]) { const xa = s < 0 ? -2.27 : 1.75, xb = s < 0 ? -1.75 : 2.27, xc = s * PX;
    for (let j = 0; j < NS; j++) { const zA = ZT + 2 * j, zB = zA + 2, T = 0.7 - j, yb = ground(s * 2.7, zB) - 1.0, bed = T - 0.17;
      { const tn = 0.9 + 0.14 * pr(); B.add(M.stone, K.shade(K.box(xa, yb, zA, xb, bed, zB), (x, y) => tn * (y > bed - 0.01 ? 1 : Math.max(0.55, 1 - 0.13 * (bed - yb))))); }
      for (let i = 0; i < 3; i++) { if (i === 0 && j % 3 === 0 && j < 7) continue; const ln = 2 / 3, zc = zA + ln * (i + 0.5), u = pr(), sd = pr.int(1, 9999);
        if (u < 0.12 && j > 0) {         // this coping has gone over the side
          for (let q = 0; q < 2; q++) B.add(M.stonePlain, tint(blk(xc + pr.range(-0.12, 0.12), bed, zc + pr.range(-0.2, 0.2), pr.range(0.2, 0.32), pr.range(0.1, 0.16), pr.range(0.16, 0.26), sd + q, pr.range(0, 3)), pr.range(0.75, 0.95)));
          const fx = s * (2.27 + pr.range(0.45, 1.0)), fz = zc + pr.range(-0.2, 0.5); B.add(M.sand, tint(coping(fx, ground(fx, fz) + 0.1, fz, ln - 0.03, 0.66, { ry: pr.range(-1, 1), rz: s * pr.range(0.9, 1.4), rx: pr.range(-0.2, 0.2), seed: sd }), 0.66));
        } else { const loose = u < 0.3; B.add(M.sand, tint(coping(xc + (loose ? s * pr.range(0.03, 0.09) : 0), bed + (loose ? 0.015 : 0), zc + (i === 2 ? 0.025 : 0), ln - 0.025 + (i === 2 ? 0.05 : 0), 0.66,
            { ry: loose ? pr.range(-0.15, 0.15) : pr.range(-0.012, 0.012), rz: loose ? s * pr.range(0.03, 0.1) : 0, rx: loose ? pr.range(-0.05, 0.05) : 0, seed: sd, ridge: 0.17 }), 0.7 + 0.14 * pr()));
          if (pr() < 0.3) B.add(M.moss, tint(mossPad(xc + pr.range(-0.16, 0.16), bed + 0.1, zc + pr.range(-0.2, 0.2), pr.range(0.1, 0.2), pr.range(0.1, 0.18), sd), pr.range(0.8, 1.1))); } } }
    // newel pier at the head of the flight, and a pier every three sections down
    squarePier(xc, -8.04, 0.42, ground(s * 2.7, -7.6) - 1.0, 1.72, { plinth: 0.3, cap: s < 0 ? 'pyr' : 'broken', seed: 31 });
    squarePier(xc, -2.1, 0.4, ground(s * 2.7, -1.6) - 1.0, -0.8, { plinth: -2.95, cap: s < 0 ? 'broken' : 'pyr', seed: 32, ch: 0.42, tint: 0.95 });
    squarePier(xc, 3.9, 0.4, ground(s * 2.7, 4.4) - 1.0, -3.8, { plinth: -5.95, cap: 'pyr', ch: 0.42, tint: 0.92 });
    ctx.block.rect(xa, ZT, xb, 12); ctx.block.rect(xc - 0.52, -8.56, xc + 0.52, -7.52); }
  // the east newel has lost its cap: it lies in the grass below
  { const fx = 3.5, fz = -6.9; B.add(M.sand, tint(K.xform(K.spire({ r: 0.45 * 1.414, h: 0.52 }), { x: fx, y: ground(fx, fz) + 0.3, z: fz, rz: -1.75, ry: 0.7, rx: 0.2 }), 0.74)); }

  ctx.floor(X0, ZT, X1, ST.zFoot, (x, z) => -ST.rise * Math.min(ST.n, Math.floor((z - ZT) / 0.5 + 1e-6) + 1));
  ctx.floor(-2.6, -9.3, 2.6, ZT, 0);
  ctx.camZone({ x: 0, z: -5.5, r: 3.5, fall: 4, pitch: 32, lift: 3.4 });      // on the upper steps the camera tips up a little so the whole gate, cross and all, is in the frame
  ctx.spot({ id: 'stairs', x: 0, z: 2.4, r: 1.3, label: '丘のふもとへ', kind: 'exit' });

  // a leaning wayside cross west of the stair head, and an old way-marker stone to the east
  { const cx = -4.0, cz = -7.7, g0 = ground(cx, cz), r = rng(77);
    B.add(M.stoneDark, K.xform(K.box(-0.72, -0.9, -0.72, 0.72, 0.26, 0.72), { x: cx, y: g0 + 0.1, z: cz, ry: 0.12 }));
    B.add(M.stonePlain, tint(K.xform(K.box(-0.5, 0, -0.5, 0.5, 0.26, 0.5), { x: cx, y: g0 + 0.36, z: cz, ry: 0.2 }), 0.95));
    B.add(M.sand, tint(K.xform(K.merge([K.lathe([[0.26, 0], [0.26, 0.1], [0.17, 0.2], [0.15, 0.3]], 8), cross({ x: 0, y: 0.25, z: 0, h: 2.15, arm: 0.42, t: 0.17, ring: true })]), { x: cx + 0.02, y: g0 + 0.6, z: cz, ry: 0.22, rz: 0.085, rx: -0.04 }), 0.84));
    B.add(M.moss, mossPad(cx - 0.3, g0 + 0.36, cz + 0.42, 0.24, 0.16, 5), mossPad(cx + 0.36, g0 + 0.62, cz + 0.2, 0.16, 0.14, 6));
    stonePile(r, cx + 0.4, cz + 0.9, 4, 0.9, [0.16, 0.3]); ctx.block.circle(cx, cz, 0.8);
    ctx.plant('grass', { x: cx, z: cz, r: 1.5, n: 9, kind: 'tall', seed: 71 }); ctx.plant('grass', { x: cx + 0.9, z: cz + 0.6, r: 0.8, n: 4, kind: 'moonflower', seed: 72 });
    const mx = 3.35, mz = -7.75, g1 = ground(mx, mz), pts = [[-0.3, -0.5], [0.3, -0.5], [0.3, 0.62], [0.22, 0.78], [0.08, 0.86], [-0.08, 0.86], [-0.22, 0.78], [-0.3, 0.62]];
    const ms = K.extrude(pts, 0.26); ms.translate(0, 0, -0.13); K.wobble(ms, 0.015, 9); B.add(M.stonePlain, tint(K.xform(ms, { x: mx, y: g1, z: mz, ry: -0.3, rz: -0.12, rx: 0.07 }), 0.95));
    B.add(M.moss, mossPad(mx - 0.1, g1 + 0.02, mz + 0.24, 0.3, 0.16, 8)); ctx.block.circle(mx, mz, 0.4);
    ctx.plant('grass', { x: mx + 0.3, z: mz + 0.3, r: 1.1, n: 7, kind: 'weed', seed: 73 }); }

  // ============================================================================================================ gate
  const GW = K.wall([-3.2, -10], [3.2, -10]), AC = 3.2, AW = 3.2, SP = 2.2, RS = 2.2, V0 = -0.7;
  const WEST = [[0, 4.8], [0.5, 4.8], [0.5, 5.05], [3.0, 7.15], [3.4, 7.15], [3.9, 6.73]];
  const topF = WEST.concat([[3.9, 6.4], [4.25, 6.4], [4.25, 5.9], [4.7, 5.9], [4.7, 5.3], [5.0, 5.3], [5.0, 4.7], [5.45, 4.7], [5.45, 4.1], [5.9, 4.1], [5.9, 3.5], [6.4, 3.5]]);
  const topB = WEST.concat([[3.9, 6.1], [4.5, 6.1], [4.5, 5.6], [4.95, 5.6], [4.95, 5.0], [5.3, 5.0], [5.3, 4.4], [5.75, 4.4], [5.75, 3.8], [6.1, 3.8], [6.1, 3.2], [6.4, 3.2]]);
  const arc = (off, n) => K.arch(AC, 0, AW, SP, RS, off, n || 9).slice(2).reverse();        // left spring -> apex -> right spring
  const body = (off, t, w0, top, holes) => { const pts = [[0, V0], [AC - AW / 2 - off, V0]].concat(arc(off), [[AC + AW / 2 + off, V0], [6.4, V0]], top.slice().reverse()); const g = K.extrude(pts, t, holes); g.translate(0, 0, w0); return GW.put(g); };
  const niche = K.arch(3.2, 5.6, 0.72, 6.08, 0.55, 0, 5);
  B.add(M.stone, K.shade(body(0, 0.9, -0.65, topB), (x, y) => 0.8 + 0.028 * y), K.shade(body(0.42, 0.4, 0.25, topF, [niche]), (x, y) => 0.86 + 0.03 * y));
  // arch orders stepping back into the wall, hood mould standing proud of it
  // each order is built stone by stone: jamb blocks below the spring, voussoirs above, every stone its own shade
  const order = (inset, bw, depth, at, tn, seed, arcOnly) => { const r = rng(seed), o = K.arch(AC, 0, AW, SP, RS, inset + bw, 9).slice(2), i = K.arch(AC, 0, AW, SP, RS, inset, 9).slice(2), out = [];
    for (let k = 0; k < o.length - 1; k++) { const g = K.extrude([o[k], o[k + 1], i[k + 1], i[k]], depth + (r() < 0.3 ? r.range(-0.03, 0.02) : 0)); g.translate(0, 0, at); out.push(tint(GW.put(g), tn * r.range(0.76, 1.1))); }
    if (!arcOnly) for (const m of [0, 1]) { let v = 0; while (v < SP - 0.01) { const h = Math.min(SP - v, r.range(0.4, 0.62)), v1 = SP - v - h < 0.25 ? SP : v + h, a = AC - AW / 2 - inset - bw, b = a + bw;
      out.push(tint(m ? GW.box(6.4 - b, 6.4 - a, v, v1, at, at + depth) : GW.box(a, b, v, v1, at, at + depth + (r() < 0.3 ? r.range(-0.03, 0.02) : 0)), tn * r.range(0.76, 1.08))); v = v1; } }
    return out; };
  B.add(M.sand, order(0, 0.2, 0.16, 0.25, 0.84, 41), order(0.2, 0.22, 0.3, 0.25, 0.96, 42), order(0.42, 0.17, 0.13, 0.65, 1.04, 43, true));
  for (const m of [0, 1]) { const U = (a, b, v0, v1, w0, w1) => m ? GW.box(6.4 - b, 6.4 - a, v0, v1, w0, w1) : GW.box(a, b, v0, v1, w0, w1);
    B.add(M.sand, tint(U(1.37, 1.63, 2.04, 2.26, 0.25, 0.45), 1.05), tint(U(1.14, 1.4, 2.04, 2.26, 0.25, 0.6), 1.08), tint(U(1.4, 1.6, 2.0, 2.04, 0.25, 0.43), 0.7), tint(U(1.18, 1.4, 2.0, 2.04, 0.25, 0.57), 0.7),
      tint(U(0.96, 1.22, 2.0, 2.24, 0.65, 0.84), 1.0), tint(U(1.0, 1.18, 1.86, 2.0, 0.65, 0.78), 0.82));                                  // imposts, label stops
    B.add(M.stoneDark, tint(U(1.36, 1.64, V0, 0.44, 0.25, 0.47), 1.25), tint(U(1.13, 1.4, V0, 0.5, 0.25, 0.62), 1.3), U(-0.09, 1.19, V0, 0.52, 0.65, 1.55), tint(U(-0.05, 1.15, 0.52, 0.6, 0.65, 1.5), 1.2));   // bases, plinth round the buttress foot
    B.add(M.stoneDark, U(0, 1.6, V0, 0.3, -0.75, -0.65)); }
  // stepped buttress piers: the west one whole, the east one broken off with the shoulder
  B.add(M.stone, GW.buttress(0.55, { width: 1.1, face: 0.65, v0: V0, stages: [[0.8, 2.3], [0.52, 3.7], [0.26, 4.5]] }), tint(GW.buttress(5.85, { width: 1.1, face: 0.65, v0: V0, stages: [[0.8, 2.3], [0.5, 2.9]] }), 0.95));
  B.add(M.sand, tint(GW.box(-0.04, 1.14, 2.2, 2.3, 0.65, 1.49), 0.95), tint(GW.box(-0.04, 1.14, 3.6, 3.7, 0.65, 1.21), 0.95), tint(GW.box(-0.04, 1.14, 4.41, 4.5, 0.65, 0.95), 0.95), tint(GW.box(5.26, 6.44, 2.2, 2.3, 0.65, 1.49), 0.9));
  { const r = rng(55); for (let i = 0; i < 4; i++) B.add(M.stonePlain, tint(blk(2.65 + r.range(-0.4, 0.4), 3.55 + r.range(0, 0.1), -9.25 + r.range(-0.1, 0.5), r.range(0.22, 0.4), r.range(0.14, 0.24), r.range(0.2, 0.34), r.int(1, 999), r.range(0, 3)), r.range(0.8, 1.0))); }
  // string course, shoulder coping, raking copings of the gable, apex stone and the cross, a little askew
  B.add(M.sand, tint(GW.box(0.72, 4.98, 5.2, 5.33, 0.65, 0.77), 0.98), tint(GW.box(-0.06, 0.56, 4.8, 4.95, -0.74, 0.76), 0.92), tint(GW.box(0.38, 0.72, 4.95, 5.2, -0.72, 0.78), 0.88));
  const rake = (u0, v0, u1, v1, n, seed) => { const r = rng(seed), len = Math.hypot(u1 - u0, v1 - v0), a = Math.atan2(v1 - v0, u1 - u0), out = [];
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, slip = r() < 0.25 ? r.range(0.04, 0.1) : 0; const g = new THREE.BoxGeometry(len / n - 0.025, 0.17, 1.5); K.wobble(g, 0.012, seed + i); g.rotateZ(a + (slip ? r.range(-0.05, 0.05) : 0));
      g.translate(u0 + (u1 - u0) * f - Math.sin(a) * 0.085 - Math.cos(a) * slip, v0 + (v1 - v0) * f + Math.cos(a) * 0.085 - Math.sin(a) * slip, 0.02); out.push(tint(GW.put(g), 0.84 + 0.16 * r())); } return out; };
  B.add(M.sand, rake(0.62, 5.15, 2.96, 7.12, 4, 61), rake(3.44, 7.12, 3.92, 6.72, 1, 62), tint(GW.box(2.94, 3.46, 7.15, 7.4, -0.73, 0.75), 0.95), tint(GW.box(3.06, 3.34, 7.4, 7.52, -0.2, 0.2), 0.85));
  for (let i = 0; i < 5; i++) { const f = (i + 0.6) / 5.4, p = GW.pt(0.62 + 2.34 * f - 0.11, 5.15 + 1.97 * f + 0.2, 0.02); B.add(M.sand, tint(blk(p.x, p.y - 0.07, p.z, 0.17, 0.17, 0.26, 80 + i, 0, 0, 0.7), 0.9)); }
  B.add(M.sand, tint(cross({ x: 0.01, y: 7.5, z: -10, h: 1.02, arm: 0.34, t: 0.14, rz: -0.1, ry: 0.16, rx: 0.03 }), 0.98));
  // a pinnacle still stands on the west shoulder; its twin went down with the east one
  B.add(M.stone, tint(GW.box(0.05, 0.51, 4.95, 5.72, -0.23, 0.23), 0.98)); B.add(M.sand, tint(GW.box(0, 0.56, 5.72, 5.81, -0.28, 0.28), 0.9), tint(K.spire({ x: -2.92, y: 5.81, z: -10, r: 0.25 * 1.414, h: 1.0 }), 0.96),
    tint(K.lathe([[0, 0], [0.07, 0.03], [0.09, 0.1], [0.06, 0.17], [0, 0.19]], 6, { x: -2.92, y: 6.76, z: -10 }), 1.0));
  B.add(M.sand, tint(K.xform(K.spire({ r: 0.25 * 1.414, h: 1.0 }), { x: 5.3, y: 0.2, z: -11.6, rz: 1.72, ry: -0.5 }), 0.78));
  // niche over the arch with a weathered saint
  B.add(M.stoneDark, tint(GW.pane(3.2, 5.6, 0.72, 6.08, 0.55, { at: 0.262 }), 0.55));
  B.add(M.sand, tint(band2(), 1.0), tint(GW.box(2.74, 3.66, 5.46, 5.6, 0.25, 0.82), 0.98), tint(GW.box(2.84, 3.56, 5.36, 5.46, 0.25, 0.74), 0.8),
    tint(K.lathe([[0.17, 0], [0.18, 0.04], [0.13, 0.26], [0.115, 0.46], [0.14, 0.53], [0.075, 0.6], [0.09, 0.67], [0.07, 0.75], [0, 0.78]], 6, { x: 0, y: 5.6, z: -9.52 }), 0.9));
  function band2() { const o = K.arch(3.2, 5.6, 0.72, 6.08, 0.55, 0.11, 5), i = K.arch(3.2, 5.6, 0.72, 6.08, 0.55, 0, 5); const g = K.extrude([o[1]].concat(o.slice(2), [o[0], i[0]], i.slice(2).reverse(), [i[1]]), 0.09); g.translate(0, 0, 0.65); return GW.put(g); }
  // threshold, worn hollow in the middle
  B.add(M.stonePlain, tint(GW.box(1.6, 3.15, -0.5, 0.03, -0.66, 0.66), 0.82), tint(GW.box(3.17, 4.8, -0.5, 0.022, -0.66, 0.66), 0.9));
  ctx.block.rect(-3.2, -10.65, -1.6, -9.35); ctx.block.rect(1.6, -10.65, 3.2, -9.35); ctx.block.rect(-3.25, -9.35, -2.1, -8.5); ctx.block.rect(2.1, -9.35, 3.25, -8.5);
  // fallen from the broken shoulder: dressed blocks on the slope east of the stair head and inside the wall
  B.add(M.stone, tint(K.chunk({ x: 3.9, y: ground(3.9, -8.5), z: -8.5, w: 0.8, h: 0.42, d: 0.5, seed: 91 }), 0.95), tint(K.chunk({ x: 4.9, y: ground(4.9, -7.9), z: -7.9, w: 0.6, h: 0.36, d: 0.44, seed: 92 }), 0.85),
    tint(K.chunk({ x: 4.3, y: ground(4.3, -6.9) + 0.02, z: -6.9, w: 0.7, h: 0.34, d: 0.4, seed: 93 }), 0.8), tint(K.chunk({ x: 3.6, y: 0, z: -11.4, w: 0.75, h: 0.4, d: 0.5, seed: 94 }), 0.95), tint(K.chunk({ x: 4.5, y: 0, z: -11.1, w: 0.5, h: 0.34, d: 0.4, seed: 95 }), 0.9));
  B.add(M.sand, tint(K.chunk({ x: 5.4, y: ground(5.4, -8.7), z: -8.7, w: 0.85, h: 0.17, d: 0.6, seed: 96, rz: 0.3 }), 0.8));
  stonePile(rng(97), 4.3, -8.2, 9, 1.5, [0.16, 0.34]); stonePile(rng(98), 3.9, -11.2, 5, 0.9, [0.16, 0.3]);

  // iron gate leaves, standing open inward: the west one hangs half open and has dropped on its hinge, the east one is thrown right back
  const LEAF = 1.52, R0 = (AW * AW / 4 + RS * RS) / AW, C0 = R0 - AW / 2, headAt = d => SP + Math.sqrt(Math.max(0, R0 * R0 - (AW / 2 - d + C0) * (AW / 2 - d + C0))) - 0.5;   // height of the leaf at distance d from the hinge
  const leaf = seed => { const gs = [], r = rng(seed), bar = (x, y0, y1, t) => K.box(x - t / 2, y0, -t / 2, x + t / 2, y1, t / 2);
    gs.push(bar(0.04, 0.12, headAt(0.04), 0.09), bar(LEAF - 0.035, 0.12, headAt(LEAF - 0.035), 0.08), K.box(0, 0.2, -0.035, LEAF, 0.3, 0.035), K.box(0, 1.55, -0.03, LEAF, 1.63, 0.03), K.box(0, 0.86, -0.025, LEAF, 0.92, 0.025));
    const tops = []; for (let i = 1; i <= 7; i++) { const x = 0.04 + (LEAF - 0.075) * i / 8, h = headAt(x) - 0.12; gs.push(bar(x, 0.3, h + 0.1, 0.05), K.spire({ x, y: h + 0.1, z: 0, r: 0.065, h: 0.22, sides: 4, ry: 0 })); tops.push([x, h, 0]);
      const xm = x - (LEAF - 0.075) / 16; gs.push(bar(xm, 0.3, 0.86, 0.04), K.spire({ x: xm, y: 0.92, z: 0, r: 0.05, h: 0.14, sides: 4, ry: 0 })); }
    gs.push(K.tube([[0.04, headAt(0.04) - 0.12, 0]].concat(tops, [[LEAF - 0.035, headAt(LEAF - 0.035) - 0.12, 0]]), 0.036, 4));
    gs.push(K.tube([[0.06, 0.3, 0], [LEAF * 0.5, 0.95, 0.0], [LEAF - 0.05, 1.55, 0]], 0.03, 4), K.box(-0.07, 0.42, -0.05, 0.3, 0.52, 0.05), K.box(-0.07, 2.02, -0.05, 0.3, 2.12, 0.05), K.box(LEAF - 0.2, 1.3, -0.045, LEAF + 0.03, 1.5, 0.045));
    return K.merge(gs); };
  const hang = (hx, phi, sag, seed, east) => { const g = leaf(seed); K.xform(g, { rz: sag }); return K.xform(g, { x: hx, y: 0.04, z: -10.72, ry: east ? PI - phi : phi }); };
  { const pw = 1.26, pe = 1.83;
    B.add(M.iron, tint(hang(-1.56, pw, -0.035, 201, false), 1.15), tint(hang(1.56, pe, 0.012, 202, true), 1.15));
    for (const s of [-1, 1]) for (const y of [0.42, 2.02]) B.add(M.iron, K.box(s * 1.6 - 0.09, y - 0.03, -10.82, s * 1.6 + 0.09, y + 0.2, -10.62));       // hinge pintles on the north jambs
    ctx.block.seg(-1.56, -10.72, -1.56 + Math.cos(pw) * LEAF, -10.72 - Math.sin(pw) * LEAF, 0.07); ctx.block.seg(1.56, -10.72, 1.56 - Math.cos(pe) * LEAF, -10.72 - Math.sin(pe) * LEAF, 0.07); }

  // the lantern in the arch: lit, swaying a little on its chain
  { const LX = 0, LY = 3.44, LZ = -9.72, TOPY = 4.42, gi = [], gg = [], h = TOPY - LY;          // lamp centre; pivot at the soffit
    for (let i = 0; i < 6; i++) { const y0 = -0.095 * (i + 1); gi.push(i % 2 ? K.box(-0.012, y0, -0.035, 0.012, y0 + 0.11, 0.035) : K.box(-0.035, y0, -0.012, 0.035, y0 + 0.11, 0.012)); }
    const c = -h;                                                                               // lamp centre in pivot space
    gi.push(K.lathe([[0.03, 0], [0.05, 0.03], [0.03, 0.06]], 6, { y: c + 0.42 }), K.spire({ y: c + 0.24, r: 0.3, h: 0.2, sides: 4 }), K.box(-0.21, c + 0.21, -0.21, 0.21, c + 0.245, 0.21),
      K.box(-0.19, c - 0.25, -0.19, 0.19, c - 0.2, 0.19), K.xform(K.spire({ r: 0.16, h: 0.13, sides: 4 }), { y: c - 0.25, rx: PI }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gi.push(K.box(sx * 0.165 - 0.02, c - 0.2, sz * 0.165 - 0.02, sx * 0.165 + 0.02, c + 0.21, sz * 0.165 + 0.02));
    gi.push(K.box(-0.17, c - 0.01, -0.175, 0.17, c + 0.02, 0.175), K.box(-0.175, c - 0.01, -0.17, 0.175, c + 0.02, 0.17));
    gg.push(K.box(-0.15, c - 0.2, -0.15, 0.15, c + 0.21, 0.15));
    const grp = new THREE.Group(); grp.position.set(LX, TOPY, LZ); grp.add(new THREE.Mesh(tint(K.merge(gi), 1.3), M.iron), new THREE.Mesh(K.merge(gg), M.lampGlass)); grp.name = 'gate-lantern';
    ctx.add(grp, { cast: false, receive: false });
    // Two halos: a core on the lamp and a wide haze in front of the arch. The hero walks right behind them, and an additive halo washes his
    // sprite out, so they sink almost to nothing while he is in or just beyond the arch and come back once he is clear of it.
    const g1 = ctx.glow({ x: LX, y: LY, z: LZ + 0.2, size: 2.3, strength: 0.85 }), g2 = ctx.glow({ x: LX, y: LY - 0.2, z: -8.9, size: 7, strength: 0.16, flicker: 0.05 });
    const full = [g1.userData.base.clone(), g2.userData.base.clone()], sm = (a, b, v) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
    ctx.onUpdate(t => { grp.rotation.z = 0.03 * Math.sin(t * 0.83) + 0.012 * Math.sin(t * 2.1 + 1); grp.rotation.x = 0.018 * Math.sin(t * 0.61 + 2);
      const h = HD.hero; if (!h) return; const k = 1 - 0.93 * sm(-9.0, -10.4, h.z) * (1 - sm(-15.5, -17.5, h.z)) * (1 - sm(2.2, 3.4, Math.abs(h.x)));
      g1.userData.base.copy(full[0]).multiplyScalar(k); g2.userData.base.copy(full[1]).multiplyScalar(k); });
    // the one light stands in front of the arch, not in the lamp: it has to reach the south face and the top steps
    ctx.light({ x: 0, y: 3.3, z: -7.6, color: '#ffb060', intensity: 1.9, distance: 10.5 }); }

  // ivy and weeds on the gate
  ctx.plant('ivy', { x: -2.65, y: 1.3, z: -8.53, nx: 0, nz: 1, w: 1.1, h: 2.6, density: 0.9, seed: 301, top: 2.3 });
  ctx.plant('ivy', { x: -1.75, y: 5.3, z: -9.33, nx: 0, nz: 1, w: 2.4, h: 2.2, density: 0.7, seed: 302 });
  ctx.plant('ivy', { x: 2.5, y: 2.6, z: -9.33, nx: 0, nz: 1, w: 1.3, h: 3.4, density: 0.9, seed: 303, top: 4.1 });
  ctx.plant('ivy', { x: 2.65, y: 1.2, z: -8.53, nx: 0, nz: 1, w: 1.1, h: 2.2, density: 0.6, seed: 304, top: 2.3 });
  for (const s of [-1, 1]) { ctx.plant('grass', { x: s * 3.0, z: -7.2, r: 0.9, n: 7, kind: 'tall', seed: 310 + s }); ctx.plant('grass', { x: s * 2.9, z: -4.5, r: 1.0, n: 7, kind: 'weed', seed: 312 + s }); ctx.plant('grass', { x: s * 3.0, z: -1.0, r: 1.1, n: 8, kind: 'tall', seed: 314 + s });
    ctx.plant('grass', { x: s * 3.0, z: 2.6, r: 1.1, n: 8, kind: 'tuft', seed: 316 + s }); ctx.plant('bush', { x: s * 3.6, z: 1.2 - s, r: 0.9, kind: 'fern', seed: 318 + s }); ctx.plant('grass', { x: s * 2.6, z: -11.3, r: 0.7, n: 5, kind: 'weed', seed: 320 + s }); }
  ctx.plant('leaves', { x: 0.3, z: -9.0, r: 1.3, n: 10, kind: 'dry', y: 0.05 });

  // ================================================================================================ boundary walls
  // One ruined field-stone wall: a design height H(u) (stepped at the piers), eaten away stone by stone where the noise says so, never
  // above lim(u) (which goes to 0 in a breach). Where the full height survives the cap course survives too.
  const WT = 0.9, WV0 = -0.9, COURSE = 0.3;
  function boundary(a, b, o) { const W = K.wall(a, b), r = rng(o.seed), runs = []; let u = 0;
    while (u < W.L - 1e-6) { let bl = r.range(0.55, 1.2); if (W.L - u - bl < 0.5) bl = W.L - u; const um = u + bl / 2, H = o.H(um), lim = o.lim ? o.lim(um) : 99; let h = 0, cap = false;
      if (lim > 0.01) { const n = HD.fbm(um / 3.0 + o.seed * 3.1, 0.37, o.seed, 3), dmg = Math.max(0, (n - (o.thr === undefined ? 0.5 : o.thr)) / 0.22);
        h = Math.round((H - dmg * (o.depth || 1.5)) / COURSE) * COURSE; if (h >= H - 1e-6 && r() < 0.14) h = H - COURSE;
        h = Math.max(o.lo || 0.6, h); h = Math.min(h, H, Math.max(COURSE, Math.round(lim / COURSE) * COURSE)); cap = h >= H - 1e-6; }
      runs.push({ u0: u, u1: u + bl, um, h, H, cap }); u += bl; }
    const hAt = uu => { for (const q of runs) if (uu >= q.u0 && uu <= q.u1) return q.h; return 0; };
    // body pieces between breaches, with the footing course
    for (let i = 0; i < runs.length; i++) { if (runs[i].h <= 0) { B.add(M.rubble, tint(W.box(runs[i].u0, runs[i].u1, WV0, 0.1, -0.5, 0.5), 0.8)); continue; } let j = i; const top = [];
      while (j < runs.length && runs[j].h > 0) { top.push([runs[j].u0, runs[j].h], [runs[j].u1, runs[j].h]); j++; }
      const u0 = runs[i].u0, u1 = runs[j - 1].u1; B.add(M.rubble, K.shade(W.solid({ t: WT, top, u0, u1, v0: WV0 }), (x, y) => 0.8 + 0.1 * y)); B.add(M.stoneDark, W.box(u0 - 0.04, u1 + 0.04, WV0, 0.27, -0.57, 0.57)); i = j - 1; }
    for (const q of runs) { if (q.h <= 0) continue; const len = q.u1 - q.u0;
      if (q.cap) { const g = W.box(q.u0 + 0.012, q.u1 - 0.012, q.h, q.h + r.range(0.13, 0.17), -0.54 - r.range(0, 0.03), 0.54 + r.range(0, 0.03)); K.wobble(g, 0.014, r.int(1, 9999)); B.add(M.stonePlain, tint(g, 0.92 + 0.2 * r()));
        if (r() < 0.16) { const p = W.xz(q.um + r.range(-0.2, 0.2), r.range(-0.25, 0.25)); B.add(M.moss, tint(mossPad(p[0], q.h + 0.13, p[1], r.range(0.16, 0.3), r.range(0.14, 0.24), r.int(1, 999)), r.range(0.8, 1.1))); } }
      else { const n = r() < 0.55 ? 1 : r() < 0.5 ? 2 : 0; for (let k = 0; k < n; k++) { const p = W.xz(q.u0 + len * r.range(0.2, 0.8), r.range(-0.2, 0.2)), s = r.range(0.24, 0.42); B.add(M.stonePlain, tint(blk(p[0], q.h - 0.02, p[1], s * r.range(1, 1.5), s * r.range(0.45, 0.7), s * r.range(0.7, 1), r.int(1, 9999), r.range(0, 3.14), r.range(-0.12, 0.12), r.range(-0.12, 0.12)), r.range(0.72, 1.0))); }
        // what fell lies at the foot, mostly on the side given
        const lost = (q.H - q.h) / COURSE, m = Math.min(5, Math.round(lost * len * r.range(0.4, 0.95) * (o.spill === undefined ? 1 : o.spill)));
        for (let k = 0; k < m; k++) { const side = (r() < 0.78 ? 1 : -1) * (o.side || 1), d = 0.6 + Math.pow(r(), 1.6) * 1.15, p = W.xz(q.u0 + len * r(), side * d), s = r.range(0.18, 0.44); if (L.pathDist(p[0], p[1]) < 1.5 || (o.clear && o.clear(p[0], p[1]))) continue;
          if (r() < 0.13) { B.add(M.stonePlain, tint(K.chunk({ x: p[0], y: ground(p[0], p[1]) - 0.06, z: p[1], w: r.range(0.55, 0.8), h: r.range(0.3, 0.42), d: r.range(0.4, 0.55), seed: r.int(1, 9999) }), r.range(0.74, 0.95))); continue; }
          B.add(M.stonePlain, tint(blk(p[0], ground(p[0], p[1]) - 0.05, p[1], s * r.range(1, 1.6), s * r.range(0.5, 0.8), s * r.range(0.7, 1.05), r.int(1, 9999), r.range(0, 3.14), r.range(-0.3, 0.3), r.range(-0.3, 0.3)), r.range(0.7, 1.02))); } } }
    // piers: dressed stone, a stepped buttress on the front, a cap or a broken head
    for (const p of o.piers || []) { const c = W.xz(p.u, 0), h = p.h; B.add(M.stone, K.shade(W.box(p.u - 0.56, p.u + 0.56, WV0, h, -0.62, 0.62), (x, y) => 0.8 + 0.08 * y)); B.add(M.stoneDark, W.box(p.u - 0.64, p.u + 0.64, WV0, 0.44, -0.7, 0.7));
      if (p.butt !== false) { B.add(M.stone, tint(W.buttress(p.u, { width: 0.92, face: 0.62, v0: WV0, stages: h > 1.6 ? [[0.72, h * 0.48], [0.36, h * 0.8]] : [[0.5, h * 0.62]] }), 0.92)); B.add(M.stoneDark, W.box(p.u - 0.53, p.u + 0.53, WV0, 0.44, 0.62, 0.62 + (h > 1.6 ? 0.8 : 0.58))); }
      if (p.cap === 'pyr') B.add(M.sand, tint(W.box(p.u - 0.63, p.u + 0.63, h, h + 0.13, -0.69, 0.69), 0.84), tint(K.xform(K.spire({ r: 0.86, h: 0.4 }), { x: c[0], y: h + 0.13, z: c[1], sx: W.nx ? 1.1 : 1, sz: W.nx ? 1 : 1.1 }), 0.9));
      else if (p.cap === 'flat') B.add(M.sand, tint(K.wobble(W.box(p.u - 0.63, p.u + 0.63, h, h + 0.15, -0.69, 0.69), 0.015, p.u * 10 | 0), 0.84));
      else { for (let k = 0; k < 3; k++) B.add(M.stonePlain, tint(blk(c[0] + r.range(-0.3, 0.3), h - 0.02, c[1] + r.range(-0.3, 0.3), r.range(0.3, 0.5), r.range(0.16, 0.26), r.range(0.24, 0.36), r.int(1, 999), r.range(0, 3)), r.range(0.78, 1.0))); }
      ctx.block.circle(c[0] + W.nx * 0.3, c[1] + W.nz * 0.3, 0.85); }
    // ivy on the front face, weeds along both feet
    for (const iv of o.ivy || []) { const hh = hAt(iv.u), p = W.xz(iv.u, (iv.back ? -1 : 1) * (WT / 2 + 0.02)); if (hh < 0.6) continue; ctx.plant('ivy', { x: p[0], y: hh / 2, z: p[1], nx: (iv.back ? -1 : 1) * W.nx, nz: (iv.back ? -1 : 1) * W.nz, w: iv.w, h: hh, density: iv.d || 0.8, seed: o.seed + (iv.u * 7 | 0), top: hh + (hh >= o.H(iv.u) ? 0.15 : 0) }); }
    for (let uu = 1.2; uu < W.L - 1; uu += r.range(1.6, 3.2)) { const side = r() < 0.6 ? 1 : -1, p = W.xz(uu, side * r.range(0.8, 1.3)); if (L.pathDist(p[0], p[1]) < 1.5 || (o.clear && o.clear(p[0], p[1]))) continue;
      ctx.plant('grass', { x: p[0], z: p[1], r: r.range(0.7, 1.2), n: r.int(4, 8), kind: r.pick(['tall', 'tall', 'weed', 'tuft', 'weed']), seed: o.seed + (uu * 13 | 0) }); }
    ctx.block.seg(a[0], a[1], b[0], b[1], WT / 2 + 0.05); return { W, runs, hAt }; }
  // a breach: the wall has gone over in a spill of stones, brambles in it
  function breach(x, z, dx, dz, seed) { const r = rng(seed); B.add(M.rubble, tint(K.rock({ x, y: ground(x, z) - 0.1, z, sx: 1.7 + Math.abs(dz) * 0.5, sy: 0.6, sz: 1.7 + Math.abs(dx) * 0.5, seed, detail: 1 }), 0.85));
    for (let i = 0; i < 4; i++) { const px = x + r.range(-1.5, 1.5) + dx * r.range(0.5, 3), pz = z + r.range(-1.5, 1.5) + dz * r.range(0.5, 3); B.add(M.stonePlain, tint(K.chunk({ x: px, y: ground(px, pz) - 0.05, z: pz, w: r.range(0.6, 0.9), h: r.range(0.32, 0.45), d: r.range(0.42, 0.6), seed: seed + i }), r.range(0.75, 0.98))); }
    B.add(M.stonePlain, tint(K.rubble({ x: x + dx * 0.5, z: z + dz * 0.5, y: (px, pz) => ground(px, pz) - 0.04, n: 22, spread: 3.0, size: [0.22, 0.55], seed, sx: 1 + Math.abs(dx) * 0.4, sz: 1 + Math.abs(dz) * 0.4 }), 0.88));
    for (let i = 0; i < 12; i++) { const a = r.range(0, 6.283), d = Math.sqrt(r()) * 1.3, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, s = r.range(0.25, 0.5); B.add(M.stonePlain, tint(blk(px, ground(px, pz) + 0.42 * Math.max(0, 1 - d / 1.4), pz, s * 1.4, s * 0.7, s, r.int(1, 9999), a, r.range(-0.4, 0.4), r.range(-0.4, 0.4)), r.range(0.7, 1.0))); }
    ctx.plant('bush', { x: x - dz * 1.6 + dx * 0.4, z: z + dx * 1.6 + dz * 0.4, r: 0.9, kind: 'bramble', seed }); ctx.plant('bush', { x: x + dz * 1.5 - dx * 0.5, z: z - dx * 1.5 - dz * 0.5, r: 0.75, kind: 'bramble', seed: seed + 1 });
    ctx.plant('grass', { x: x + dx, z: z + dz, r: 1.8, n: 10, kind: 'tall', seed: seed + 2 }); }
  const gap = (c, half, k) => u => Math.max(0, Math.abs(u - c) - half) * (k || 1.1);

  // south wall, west of the gate (u = x + 27.4): breach at x -19.6
  boundary([-27.4, -10], [-3.2, -10], { seed: 511, side: -1, H: u => u > 21.6 ? 3.0 : u > 16.2 ? 2.7 : u < 5.4 ? 2.7 : 2.4, lim: gap(7.9, 1.55), thr: 0.5, depth: 1.5,
    piers: [{ u: 5.4, h: 2.9, cap: 'pyr' }, { u: 10.8, h: 2.3 }, { u: 16.2, h: 2.9, cap: 'pyr' }, { u: 21.6, h: 3.2, cap: 'flat' }], ivy: [{ u: 2.6, w: 2.6 }, { u: 13.4, w: 3.2 }, { u: 19, w: 2.4, d: 0.6 }, { u: 23.2, w: 1.8 }, { u: 14, w: 3, back: true, d: 0.5 }] });
  breach(-19.5, -10, 0, 0.6, 611);
  // south wall, east of the gate (u = x - 3.2): steps down at the piers, low (under 1.5) east of x = 12
  boundary([3.2, -10], [27.4, -10], { seed: 523, side: -1, H: u => u < 2.6 ? 3.0 : u < 8.0 ? 2.1 : 1.2, thr: 0.52, depth: 1.2, lo: 0.6,
    piers: [{ u: 2.6, h: 3.2, cap: 'pyr' }, { u: 8.0, h: 1.75, cap: 'flat' }, { u: 13.4, h: 1.2 }, { u: 18.8, h: 1.25, cap: 'flat' }], ivy: [{ u: 1.2, w: 2 }, { u: 5.2, w: 3 }, { u: 11, w: 3, d: 0.6 }, { u: 21.5, w: 3.4 }] });
  // west wall (u = -10 - z, front faces east = inside): a low gap at z -22.5, higher along the cloister
  boundary([-27.4, -10], [-27.4, -50], { seed: 537, side: 1, H: u => u > 21.6 ? 3.0 : u < 5.4 ? 2.7 : 2.4, lim: u => 0.6 + gap(12.6, 0.5, 1.0)(u), thr: 0.5, depth: 1.8, clear: (x, z) => z < -31.2,
    piers: [{ u: 5.4, h: 2.9, cap: 'pyr' }, { u: 10.8, h: 2.0 }, { u: 16.2, h: 2.6, cap: 'flat' }, { u: 21.6, h: 3.2, cap: 'pyr', butt: false }, { u: 27, h: 3.2, cap: 'flat', butt: false }, { u: 32.4, h: 2.7, butt: false }, { u: 37.8, h: 3.2, cap: 'pyr', butt: false }],
    ivy: [{ u: 3, w: 3 }, { u: 8, w: 2.6, d: 0.6 }, { u: 18.6, w: 3.4 }, { u: 24.4, w: 3 }, { u: 30, w: 3.6, d: 0.6 }, { u: 35.4, w: 3 }] });
  // east wall (u = z + 56, front faces west = inside): low at the lookout end, breach at z -34.4
  boundary([27.4, -56], [27.4, -10], { seed: 541, side: 1, H: u => u < 2.8 ? 0.9 : u < 8.2 ? 1.5 : u > 40.6 ? 2.7 : 2.4, lim: u => Math.min(gap(21.6, 1.5)(u), 0.5 + u * 0.5), thr: 0.5, depth: 1.7, lo: 0.5,
    piers: [{ u: 2.8, h: 1.1 }, { u: 8.2, h: 1.75, cap: 'flat' }, { u: 13.6, h: 2.6, cap: 'pyr' }, { u: 19.0, h: 2.0 }, { u: 24.4, h: 2.6, cap: 'flat' }, { u: 29.8, h: 2.6, cap: 'pyr' }, { u: 35.2, h: 2.2 }, { u: 40.6, h: 2.9, cap: 'pyr' }],
    ivy: [{ u: 5.4, w: 3, d: 0.6 }, { u: 11, w: 3.2 }, { u: 16.4, w: 3 }, { u: 27, w: 3.4 }, { u: 32.6, w: 3, d: 0.6 }, { u: 38, w: 3.4 }, { u: 43.4, w: 3 }] });
  breach(27.4, -34.4, -0.5, 0, 623);

  // octagonal piers at the two south corners: the west one keeps its stone cone, the east one has lost half its head
  for (const s of [-1, 1]) { const cx = s * 27.4, cz = -10, ht = s < 0 ? 3.1 : 2.5, rot = PI / 8;
    B.add(M.stone, K.poly(K.ngon(cx, cz, 1.14, 8, rot), -2.2, ht)); B.add(M.stoneDark, K.poly(K.ngon(cx, cz, 1.3, 8, rot), -2.2, 0.5), tint(K.poly(K.ngon(cx, cz, 1.22, 8, rot), 0.5, 0.6), 1.2));
    if (s < 0) { B.add(M.sand, tint(K.poly(K.ngon(cx, cz, 1.24, 8, rot), ht, ht + 0.15), 0.88), tint(K.poly(K.ngon(cx, cz, 1.17, 8, rot), ht - 0.75, ht - 0.65), 0.92));
      B.add(M.stonePlain, tint(K.spire({ x: cx, y: ht + 0.15, z: cz, r: 1.3, h: 1.35, sides: 8, ry: rot }), 1.02)); B.add(M.sand, tint(K.lathe([[0.1, 0], [0.16, 0.04], [0.2, 0.16], [0.14, 0.3], [0, 0.34]], 6, { x: cx, y: ht + 1.4, z: cz }), 0.95)); }
    else { const pts = K.ngon(cx, cz, 1.14, 8, rot); B.add(M.stone, tint(K.poly([pts[2], pts[3], pts[4], pts[5], pts[6]], ht, ht + 0.6), 0.95), tint(K.poly([pts[3], pts[4], pts[5]], ht + 0.6, ht + 0.9), 0.9)); B.add(M.sand, tint(K.poly(K.ngon(cx, cz, 1.17, 8, rot), ht - 0.75, ht - 0.65), 0.9));
      const r = rng(71); for (let i = 0; i < 4; i++) B.add(M.stonePlain, tint(blk(cx + r.range(-0.2, 0.7), ht - 0.02, cz + r.range(0, 0.7), r.range(0.3, 0.5), r.range(0.16, 0.26), r.range(0.24, 0.36), r.int(1, 999), r.range(0, 3)), r.range(0.78, 1.0)));
      stonePile(r, cx - 1.6, cz - 1.5, 7, 1.2, [0.2, 0.42]); B.add(M.stonePlain, tint(K.xform(K.spire({ r: 1.0, h: 0.9, sides: 8, ry: rot }), { x: cx - 2.2, y: ground(cx - 2.2, cz - 1.9) + 0.55, z: cz - 1.9, rz: 1.9, ry: 0.5 }), 0.85)); }
    ctx.block.circle(cx, cz, 1.3); ctx.plant('ivy', { x: cx - s * 0.5, y: 1.3, z: cz + 1.08, nx: 0, nz: 1, w: 1.5, h: 2.6, density: 0.7, seed: 700 + s }); ctx.plant('grass', { x: cx - s * 1.6, z: cz + 1.4, r: 1.2, n: 8, kind: 'tall', seed: 710 + s }); }

  B.build();
}; })();
