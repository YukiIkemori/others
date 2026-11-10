// The bell tower (鐘楼): the landmark of the abbey whose bell does not ring. Footprint L.TOWER (8 x 8), door in the south face.
// Four stages of warm ashlar (strings at 7.9 / 12.2 / 16.0), a stepped buttress on the south-east corner, an octagonal stair
// turret on the south-west corner, an open belfry (16.4 .. 22) with the bronze bell, corbel table, pierced embattled parapet,
// corner pinnacles (the south-east one broken off) and a sagging slate spire with lucarnes and a leaning iron cross (tip about 30.5).
// Most detail is built once for the south face in "S coordinates" (u = x - X0 along the face, v = height) and turned about the
// tower's axis for the other faces.
(function () { const HD = window.HD; HD.areas = HD.areas || {};
HD.areas.tower = function (ctx) {
  const K = ctx.K, M = ctx.M, L = ctx.L, PI = Math.PI, B = ctx.batch(), rnd = ctx.rng(4711);
  const X0 = L.TOWER.x0, X1 = L.TOWER.x1, Z0 = L.TOWER.z0, Z1 = L.TOWER.z1, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2, DX = L.TOWER.door[0];
  const TW = 1.4, FW = TW / 2;                                   // wall thickness; face offset from the wall's centre plane
  const S1 = 7.9, S2 = 12.2, S3 = 16.0, BF = 16.4, HW = 22.0;    // string courses, belfry floor, wall head (under the cornice)
  const DW = 2.25, DSILL = 0.4, DSPR = 2.3, DRISE = 1.7;         // door opening (apex at 4.0)
  const BW = 3.6, BSILL = 17.0, BSPR = 18.3, BRISE = 2.7;        // belfry openings (apex at 21.0)

  // ------------------------------------------------------------------------------------------------------- helpers
  const FACE = { S: 0, E: PI / 2, N: PI, W: -PI / 2 };
  const turn = (g, a) => { if (a) { g.translate(-CX, 0, -CZ); g.rotateY(a); g.translate(CX, 0, CZ); } return g; };       // south-face geometry -> another face
  const turnAll = (gs, a) => gs.flat(Infinity).filter(Boolean).map(g => turn(g, a));
  const prismX = (pts, x0, x1) => { const g = K.extrude(pts.map(p => [-p[0], p[1]]), x1 - x0); g.rotateY(PI / 2); g.translate(x0, 0, 0); return g; };   // profile [[z,y]..] run along x
  const prismZ = (pts, z0, z1) => { const g = K.extrude(pts, z1 - z0); g.translate(0, 0, z0); return g; };                                               // profile [[x,y]..] run along z
  const tint = K.tint;
  const circle = (cu, cv, r, n, a0) => { const a = []; for (let i = 0; i < n; i++) { const t = (a0 || 0) + i / n * PI * 2; a.push([cu + Math.cos(t) * r, cv + Math.sin(t) * r]); } return a; };
  const archY = (w, spring, rise, dx) => { const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw, d = Math.abs(dx) + c; return spring + Math.sqrt(Math.max(0, R * R - d * d)); };   // intrados height at dx from the centre
  const archHalf = (w, spring, rise, y) => { if (y <= spring) return w / 2; const hw = w / 2, R = (hw * hw + rise * rise) / w, c = R - hw; return Math.max(0, Math.sqrt(Math.max(0, R * R - (y - spring) * (y - spring))) - c); };   // half-width of the opening at height y
  const ball = (x, y, z, r, d) => { const g = new THREE.IcosahedronGeometry(r, d === undefined ? 1 : d); g.translate(x, y, z); return g; };
  const quadP = (a, b, c, d) => K.quad(a, b, c, d);
  // outline of a quatrefoil: four lobes of radius r centred d from the middle
  const quatre = (cx, cy, r, d) => { const p = [], be = PI - Math.acos(Math.min(1, d / (Math.SQRT2 * r))) - PI / 4; for (let k = 0; k < 4; k++) for (let i = 1; i <= 5; i++) { const t = k * PI / 2 - be + 2 * be * i / 5; p.push([cx + Math.cos(k * PI / 2) * d + Math.cos(t) * r, cy + Math.sin(k * PI / 2) * d + Math.sin(t) * r]); } return p; };
  // slim shaft with a moulded base and a bell capital (door jambs)
  const colonnette = (x, z, y0, h, r, sides) => K.lathe([[r * 1.9, 0], [r * 1.9, 0.05], [r * 1.45, 0.09], [r * 1.7, 0.14], [r * 1.2, 0.2], [r, 0.24], [r * 0.95, h - 0.32], [r * 1.3, h - 0.29], [r * 1.3, h - 0.25], [r, h - 0.22], [r * 1.25, h - 0.11], [r * 1.95, h - 0.035], [r * 1.95, h], [0, h]], sides || 7, { x, y: y0, z });
  // a worn slab (step): the middle of the tread is dished
  const wornSlab = (x0, x1, y0, y1, z0, z1, dip, seed) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0, 6, 1, 3); const p = g.attributes.position, hw = (x1 - x0) / 2;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y > 0) { const k = 1 - Math.min(1, Math.abs(x) / (hw * 0.75)); p.setY(i, y - dip * k * k * (z > 0 ? 1.4 : 0.7) - (Math.abs(x) > hw * 0.98 && z > 0 ? 0.03 : 0)); } }
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); K.wobble(g, 0.012, seed || 5); return K.flat(g); };

  // S coordinates: the south wall, west -> east; front (+w) faces south. Face plane at w = +FW.
  const SW = K.wall([X0, Z1 - FW], [X1, Z1 - FW]);
  const inner = (x, z) => x > X0 + 0.2 && x < X1 - 0.2 && z > Z0 + 0.2 && z < Z1 - 0.2;
  const shadeWall = g => K.shade(g, (x, y, z) => (inner(x, z) ? 0.26 : 1));       // reveals darken toward the inside, the inside is nearly black

  // ---------------------------------------------------------------------------------------------------- the four walls
  const belfryHole = () => K.arch(4, BSILL, BW, BSPR, BRISE, 0, 9);
  const patchA = [[0.7, 5.2], [1.4, 5.2], [1.4, 5.6], [1.75, 5.6], [1.75, 6.4], [1.55, 6.4], [1.55, 7.2], [1.0, 7.2], [1.0, 6.8], [0.6, 6.8], [0.6, 6.0], [0.7, 6.0]];     // facing stones fallen: rubble core shows
  const patchB = [[5.1, 9.2], [5.9, 9.2], [5.9, 8.8], [6.5, 8.8], [6.5, 9.6], [6.3, 9.6], [6.3, 10.4], [5.7, 10.4], [5.7, 10.8], [5.2, 10.8], [5.2, 10.0], [5.0, 10.0], [5.0, 9.6], [5.1, 9.6]];
  const patchC = [[1.7, 5.4], [2.9, 5.4], [2.9, 6.2], [2.5, 6.2], [2.5, 7.0], [1.9, 7.0], [1.9, 6.2], [1.7, 6.2]];
  const patchD = [[2.2, 13.0], [3.3, 13.0], [3.3, 13.4], [3.6, 13.4], [3.6, 14.2], [2.6, 14.2], [2.6, 13.8], [2.2, 13.8]];
  B.add(M.stoneWarm, shadeWall(SW.solid({ t: TW, h: HW, holes: [K.arch(4, 0.3, DW, DSPR, DRISE, 0.66, 8), K.arch(4, 5.35, 1.05, 6.5, 0.75), K.arch(2.7, 5.55, 0.3, 6.6, 0.4), K.arch(5.3, 5.55, 0.3, 6.6, 0.4), K.arch(4, 8.9, 0.6, 10.6, 0.75), circle(4, 14.25, 0.92, 18), patchA, patchB, belfryHole()] })));
  B.add(M.stoneWarm, shadeWall(turn(SW.solid({ t: TW, h: HW, u0: TW, u1: 8 - TW, holes: [K.arch(3.0, 9.3, 0.4, 10.5, 0.5), K.arch(3.0, 13.2, 0.4, 14.4, 0.5), patchC, belfryHole()] }), FACE.W)));
  B.add(M.stoneWarm, shadeWall(turn(SW.solid({ t: TW, h: HW, u0: TW, u1: 8 - TW, holes: [patchD, belfryHole()] }), FACE.E)));
  B.add(M.stoneWarm, shadeWall(turn(SW.solid({ t: TW, h: HW, holes: [belfryHole()] }), FACE.N)));
  // what is behind the openings
  B.add(M.rubble, tint(SW.box(0.45, 1.9, 5.05, 7.35, 0.42, 0.54), 1.0, 0.86, 0.7), tint(SW.box(4.85, 6.65, 8.65, 10.95, 0.42, 0.54), 1.0, 0.86, 0.7),
    turnAll([tint(SW.box(1.55, 3.05, 5.25, 7.15, 0.42, 0.54), 1.0, 0.86, 0.7)], FACE.W), turnAll([tint(SW.box(2.05, 3.75, 12.85, 14.35, 0.42, 0.54), 1.0, 0.86, 0.7)], FACE.E));
  B.add(M.void, SW.box(3.4, 4.6, 8.7, 11.6, 0.2, 0.3), SW.box(2.4, 3.0, 5.4, 7.2, 0.36, 0.46), SW.box(5.0, 5.6, 5.4, 7.2, 0.36, 0.46), turnAll([SW.box(2.6, 3.4, 9.1, 11.2, 0.36, 0.46), SW.box(2.6, 3.4, 13.0, 15.1, 0.36, 0.46)], FACE.W));
  // a few loose core stones bulging out of the fallen patches
  B.add(M.rubble, K.rock({ x: X0 + 1.2, y: 5.5, z: Z1 - 0.12, sx: 0.22, sy: 0.16, sz: 0.14, seed: 3, detail: 0 }), K.rock({ x: X0 + 0.95, y: 6.3, z: Z1 - 0.13, sx: 0.2, sy: 0.15, sz: 0.12, seed: 8, detail: 0 }),
    K.rock({ x: X0 + 5.6, y: 9.5, z: Z1 - 0.12, sx: 0.24, sy: 0.17, sz: 0.14, seed: 12, detail: 0 }), K.rock({ x: X0 + 6.1, y: 9.05, z: Z1 - 0.13, sx: 0.2, sy: 0.14, sz: 0.12, seed: 15, detail: 0 }));
  // belfry floor and the head slab under the roof (keeps the shaft closed for shadows)
  B.add(M.woodDark, tint(K.box(X0 + TW - 0.05, BF, Z0 + TW - 0.05, X1 - TW + 0.05, BF + 0.22, Z1 - TW + 0.05), 0.5, 0.52, 0.6));
  B.add(M.stoneDark, tint(K.box(X0 + 0.1, HW - 0.1, Z0 + 0.1, X1 - 0.1, HW + 0.55, Z1 - 0.1), 0.55));

  // ------------------------------------------------------------------------------------------------ plinth and steps
  const plinthS = (xa, xb) => [tint(K.box(xa, -0.5, Z1 - 0.1, xb, 0.5, Z1 + 0.38), 1.15, 1.08, 1.0), tint(K.box(xa, 0.5, Z1 - 0.1, xb, 0.92, Z1 + 0.22), 1.3, 1.22, 1.12)];
  B.add(M.stoneDark, plinthS(X0 - 0.38, DX - 1.84), plinthS(DX + 1.84, X1 + 0.05),
    tint(K.box(X0 - 0.38, -0.5, Z0 - 0.38, X0 + 0.1, 0.5, Z1 + 0.38), 0.92), K.box(X0 - 0.22, 0.5, Z0 - 0.22, X0 + 0.1, 0.92, Z1 + 0.22),
    tint(K.box(X0 - 0.38, -0.5, Z0 - 0.38, X1 + 0.38, 0.5, Z0 + 0.1), 0.92), tint(K.box(X1 - 0.1, -0.5, Z0 - 0.38, X1 + 0.2, 0.5, Z1), 0.92));
  // chamfered top course of the plinth (pale, catches the moon)
  const chamfer = [[Z1 - 0.05, 0.92], [Z1 + 0.22, 0.92], [Z1 + 0.22, 0.98], [Z1 + 0.02, 1.16], [Z1 - 0.05, 1.16]];
  B.add(M.sand, tint(prismX(chamfer, X0 - 0.22, DX - 1.84), 0.9), tint(prismX(chamfer, DX + 1.84, X1 + 0.02), 0.9), turnAll([tint(prismX(chamfer, X0 - 0.22, X1 + 0.22), 0.9)], FACE.W));
  // two worn steps up to the threshold
  B.add(M.sand, tint(wornSlab(DX - 2.08, DX + 2.08, -0.4, 0.2, Z1 - 0.2, Z1 + 1.0, 0.05, 11), 0.74, 0.74, 0.8), tint(wornSlab(DX - 1.82, DX + 1.82, -0.2, 0.4, Z1 - 0.66, Z1 + 0.38, 0.06, 12), 0.82, 0.82, 0.87));

  // ------------------------------------------------------------------------------------------------------------ door
  // three stepped orders recessed into the wall, nook shafts with capitals, roll mouldings in the arch, a hood mould with stops
  const orders = [[0, 0.22, 0.78], [0.22, 0.5, 0.9], [0.44, 0.83, 1.0]];      // [inset, depth, tint]
  for (const [ins, dep, tn] of orders) B.add(M.sand, tint(SW.archTrim(4, 0.3, DW, DSPR, DRISE, { inset: ins, band: 0.22, at: -0.05, depth: dep }), tn));
  B.add(M.sand, SW.archTrim(4, DSPR - 0.12, DW, DSPR, DRISE, { inset: 0.66, band: 0.14, at: FW, depth: 0.15 }));                // hood mould
  for (const sd of [-1, 1]) {
    B.add(M.sand, colonnette(X0 + 4 + sd * (DW / 2 + 0.135), Z1 - FW + 0.255, DSILL, DSPR - DSILL, 0.08), tint(colonnette(X0 + 4 + sd * (DW / 2 + 0.355), Z1 - FW + 0.535, DSILL, DSPR - DSILL, 0.08), 1.05));
    B.add(M.sand, K.xform(K.rock({ x: 0, y: 0, z: 0, sx: 0.15, sy: 0.17, sz: 0.13, seed: 20 + sd, detail: 1 }), { x: X0 + 4 + sd * (DW / 2 + 0.74), y: DSPR - 0.2, z: Z1 + 0.1 }));        // worn head stops
  }
  for (const [off, w, tn] of [[0.135, 0.255, 0.86], [0.355, 0.535, 0.97]]) { const pts = K.arch(4, DSILL, DW, DSPR, DRISE, off, 8).slice(2).map(p => { const q = SW.pt(p[0], p[1], w); return [q.x, q.y, q.z]; }); B.add(M.sand, tint(K.tube(pts, 0.075, 6), tn)); }
  // the leaves: six heavy planks, iron strap hinges, studs, a ring
  const doorCv = HD.T.generators.planks({ w: 72, h: 128, seed: 57, plank: 12, base: 3.0 });
  const mDoor = M.make(doorCv, { name: 'towerDoor', ox: -(DX - DW / 2) * 32, oy: 32 });
  const zLeaf = Z1 - FW + 0.06;                                                  // front of the leaves
  for (let i = 0; i < 6; i++) { const a = -DW / 2 + i * DW / 6, b = a + DW / 6, pts = [[DX + a, DSILL - 0.1], [DX + b, DSILL - 0.1]]; for (let k = 0; k <= 3; k++) { const d = b + (a - b) * k / 3; pts.push([DX + d, archY(DW, DSPR, DRISE, d)]); }
    { const tn = [0.92, 1.0, 0.86, 0.95, 1.02, 0.88][i] * 0.74; B.add(mDoor, tint(prismZ(pts, zLeaf - 0.14, zLeaf - (i % 2 ? 0.014 : 0)), tn, tn * 0.97, tn * 1.02)); } }
  B.add(mDoor, tint(K.box(DX - 0.055, DSILL, zLeaf - 0.05, DX + 0.055, 3.96, zLeaf + 0.03), 0.55));       // closing stile
  const iron = [];
  for (const sd of [-1, 1]) for (const y of [1.0, 2.0, 3.0]) { const xe = archHalf(DW, DSPR, DRISE, y + 0.05) - 0.03, xi = 0.2;
    iron.push(K.box(DX + sd * xi, y - 0.045, zLeaf, DX + sd * xe, y + 0.045, zLeaf + 0.028));
    for (const s2 of [-1, 1]) { const g = new THREE.BoxGeometry(0.2, 0.05, 0.026); g.translate(-0.08 * sd, 0, 0); g.rotateZ(s2 * 0.75 * sd); g.translate(DX + sd * (xi + 0.02), y, zLeaf + 0.014); iron.push(g); } }
  for (let i = 0; i < 6; i++) { const x = -DW / 2 + (i + 0.5) * DW / 6; for (const y of [0.68, 1.5, 2.5, 3.38]) { if (archY(DW, DSPR, DRISE, x) < y + 0.25) continue; const g = new THREE.ConeGeometry(0.05, 0.05, 4); g.rotateX(PI / 2); g.rotateZ(PI / 4); g.translate(DX + x, y, zLeaf + 0.02); iron.push(g); } }
  { const g = new THREE.TorusGeometry(0.125, 0.022, 5, 12); g.translate(DX + 0.26, 1.7, zLeaf + 0.05); iron.push(g, K.box(DX + 0.21, 1.78, zLeaf, DX + 0.31, 1.92, zLeaf + 0.04), K.box(DX - 0.3, 1.62, zLeaf, DX - 0.2, 1.84, zLeaf + 0.025)); }
  B.add(M.iron, iron.map(g => tint(g, 1.5)));
  for (const sd of [-1, 1]) { const x = DX + sd * 1.42, y = 4.42; B.add(M.sand, tint(prismZ([[x - 0.2, y + 0.24], [x + 0.2, y + 0.24], [x + 0.2, y - 0.02], [x + 0.12, y - 0.17], [x, y - 0.26], [x - 0.12, y - 0.17], [x - 0.2, y - 0.02]], Z1, Z1 + 0.07), 1.04), tint(prismZ([[x - 0.13, y + 0.17], [x + 0.13, y + 0.17], [x + 0.13, y], [x, y - 0.17], [x - 0.13, y]], Z1 + 0.07, Z1 + 0.09), 0.78)); }       // worn shields in the spandrels
  { const an = []; for (const [u, v, a] of [[1.15, 9.7, 0.2], [5.55, 11.55, -0.15], [1.7, 13.45, 0], [5.75, 15.35, 0.3], [1.52, 17.5, 0], [6.5, 19.6, 0.1]]) for (const k of [-1, 1]) { const g = new THREE.BoxGeometry(0.62, 0.075, 0.035); g.rotateZ(a + k * 0.8); g.translate(X0 + u, v, Z1 + 0.018); an.push(tint(g, 1.6)); }
    B.add(M.iron, an); }                                                                                                                                 // iron tie-rod anchors: someone once tried to hold the cracked wall together
  // slim pinnacled shafts flanking the portal
  for (const sd of [-1, 1]) { const xs = DX + sd * 2.2;
    B.add(M.sand, tint(K.box(xs - 0.15, 0.9, Z1 - 0.02, xs + 0.15, 4.5, Z1 + 0.24), 0.93), K.box(xs - 0.2, 4.5, Z1 - 0.02, xs + 0.2, 4.62, Z1 + 0.29), prismZ([[xs - 0.2, 4.62], [xs + 0.2, 4.62], [xs, 5.02]], Z1 + 0.18, Z1 + 0.29),
      tint(K.box(xs - 0.19, 2.6, Z1 - 0.02, xs + 0.19, 2.72, Z1 + 0.28), 1.03), K.spire({ x: xs, y: 4.62, z: Z1 + 0.06, r: 0.25, h: 1.35 }), ball(xs, 6.02, Z1 + 0.06, 0.075, 0)); }

  // ------------------------------------------------------------------------------- the lantern beside the door (lit)
  const LX = X0 + 1.35, LZ = Z1 + 0.62;
  B.add(M.iron, [K.box(LX - 0.05, 3.3, Z1 - 0.01, LX + 0.05, 4.08, Z1 + 0.035), K.tube([[LX, 3.98, Z1], [LX, 4.02, Z1 + 0.32], [LX, 3.99, Z1 + 0.6], [LX, 3.9, Z1 + 0.69], [LX, 3.82, LZ]], 0.028, 5),
    K.tube([[LX, 3.36, Z1 + 0.02], [LX, 3.5, Z1 + 0.27], [LX, 3.76, Z1 + 0.4], [LX, 3.97, Z1 + 0.36]], 0.022, 5), K.tube([[LX, 3.84, LZ], [LX, 3.66, LZ]], 0.018, 4),
    K.spire({ x: LX, y: 3.54, z: LZ, r: 0.21, h: 0.15, sides: 4 }), ball(LX, 3.7, LZ, 0.035, 0), K.box(LX - 0.14, 3.13, LZ - 0.14, LX + 0.14, 3.18, LZ + 0.14), K.box(LX - 0.03, 3.05, LZ - 0.03, LX + 0.03, 3.13, LZ + 0.03),
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(c => K.box(LX + c[0] * 0.118 - 0.016, 3.18, LZ + c[1] * 0.118 - 0.016, LX + c[0] * 0.118 + 0.016, 3.55, LZ + c[1] * 0.118 + 0.016))].map(g => tint(g, 1.4)));
  B.add(M.lampGlass, K.box(LX - 0.105, 3.19, LZ - 0.105, LX + 0.105, 3.53, LZ + 0.105));
  ctx.light({ x: LX + 0.25, y: 3.25, z: LZ + 0.25, color: '#ffb060', intensity: 1.9, distance: 12 });
  ctx.glow({ x: LX, y: 3.36, z: LZ + 0.05, color: '#ffb060', size: 2.7, strength: 0.95 });
  ctx.glow({ x: LX, y: 3.36, z: LZ + 0.12, color: '#ffd9a0', size: 0.8, strength: 1.3 });

  // -------------------------------------------------------------------------------- niche and worn statue (stage 1)
  B.add(M.stoneDark, tint(K.box(DX - 0.62, 5.3, Z1 - 0.62, DX + 0.62, 7.4, Z1 - 0.42), 0.62));
  B.add(M.sand, SW.archTrim(4, 5.35, 1.05, 6.5, 0.75, { band: 0.13, depth: 0.1, at: FW }), tint(SW.archTrim(4, 5.35, 1.05, 6.5, 0.75, { inset: -0.07, band: 0.07, depth: 0.2, at: 0.36 }), 0.85),
    K.box(DX - 0.72, 5.22, Z1 - 0.3, DX + 0.72, 5.36, Z1 + 0.34), tint(K.box(DX - 0.55, 5.09, Z1, DX + 0.55, 5.22, Z1 + 0.24), 0.92), tint(K.box(DX - 0.36, 4.97, Z1, DX + 0.36, 5.09, Z1 + 0.14), 0.86),
    prismZ([[DX - 0.82, 6.82], [DX - 0.7, 6.82], [DX, 7.58], [DX, 7.76]], Z1, Z1 + 0.15), prismZ([[DX + 0.7, 6.82], [DX + 0.82, 6.82], [DX, 7.76], [DX, 7.58]], Z1, Z1 + 0.15), ball(DX, 7.8, Z1 + 0.09, 0.09, 0));
  { // the statue: a hooded monk, hands folded, features long since weathered away
    const gs = [K.lathe([[0.2, 0], [0.215, 0.08], [0.18, 0.45], [0.165, 0.82], [0.21, 1.0], [0.19, 1.08], [0.1, 1.15], [0.0, 1.16]], 8, { flat: true }), K.xform(K.rock({ x: 0, y: 0, z: 0, sx: 0.115, sy: 0.14, sz: 0.115, seed: 31, detail: 1 }), { y: 1.25 }),
      K.box(-0.15, 0.62, 0.1, 0.15, 0.8, 0.2), K.box(-0.24, 0.6, -0.08, -0.14, 1.0, 0.1), K.box(0.14, 0.6, -0.08, 0.24, 1.0, 0.1), K.box(-0.25, 0, -0.2, 0.25, 0.07, 0.2)];
    const g = K.merge(gs); K.wobble(g, 0.014, 9); B.add(M.sand, tint(K.xform(K.flat(g), { x: DX, y: 5.36, z: Z1 - 0.17, sz: 0.8, rz: 0.03 }), 0.9)); }

  // ----------------------------------------------------------------------- lancet (stage 2) and clock-less roundel (stage 3)
  for (const u of [2.7, 5.3]) B.add(M.sand, SW.archTrim(u, 5.55, 0.3, 6.6, 0.4, { band: 0.12, depth: 0.08, at: FW }), SW.box(u - 0.33, u + 0.33, 5.42, 5.55, 0.3, FW + 0.12));
  B.add(M.sand, SW.archTrim(4, 8.9, 0.6, 10.6, 0.75, { band: 0.16, depth: 0.1, at: FW }), tint(SW.archTrim(4, 8.9, 0.6, 10.6, 0.75, { inset: -0.08, band: 0.08, depth: 0.22, at: 0.3 }), 0.82), SW.box(3.48, 4.52, 8.74, 8.9, 0.3, FW + 0.16),
    turnAll([8.1, 12.0].map(d => [SW.archTrim(3.0, 9.3 + d - 8.1, 0.4, 10.5 + d - 8.1, 0.5, { band: 0.13, depth: 0.08, at: FW }), SW.box(2.62, 3.38, 9.16 + d - 8.1, 9.3 + d - 8.1, 0.3, FW + 0.12)]), FACE.W));
  { const ring = K.extrude(circle(4, 14.25, 1.16, 20), 0.14, [circle(4, 14.25, 0.92, 18)]); ring.translate(0, 0, FW); B.add(M.sand, SW.put(ring));
    B.add(M.sand, tint(SW.box(2.95, 5.05, 13.2, 15.3, 0.44, 0.54), 0.6, 0.6, 0.66));
    const bits = []; for (let i = 0; i < 12; i++) { const t = i / 12 * PI * 2, u = 4 + Math.sin(t) * 0.72, v = 14.25 + Math.cos(t) * 0.72, s = i % 3 === 0 ? 0.055 : 0.035; if (i === 4 || i === 7) continue; bits.push(SW.box(u - s, u + s, v - s, v + s, 0.54, 0.58)); }
    bits.push(SW.box(3.94, 4.06, 14.19, 14.31, 0.54, 0.74), SW.box(3.975, 4.025, 13.83, 14.2, 0.66, 0.7));       // the arbor and the stump of a hand, hanging at six
    B.add(M.iron, bits.map(g => tint(g, 1.5))); }

  // ----------------------------------------------------------------------------- putlog holes and the long crack (south)
  { const dark = []; for (const [u, v] of [[0.8, 2.9], [2.6, 8.6], [5.45, 8.6], [0.9, 10.4], [2.3, 12.9], [5.9, 12.9], [1.2, 15.0], [6.4, 15.0], [0.9, 18.3], [7.1, 18.3], [0.9, 20.6], [7.1, 20.6]]) dark.push(SW.box(u - 0.08, u + 0.08, v, v + 0.2, FW, FW + 0.012));
    turnAll([[2.0, 3.4], [4.6, 3.4], [4.6, 8.6], [1.9, 11.0], [5.0, 13.2], [2.0, 15.0], [0.9, 18.3], [7.1, 18.3], [0.9, 20.6], [7.1, 20.6]].map(p => SW.box(p[0] - 0.08, p[0] + 0.08, p[1], p[1] + 0.2, FW, FW + 0.012)), FACE.W).forEach(g => dark.push(g));
    const r = ctx.rng(77); let u = 5.95, v = 4.9; const inB = (a, b) => a > 4.9 && a < 6.6 && b > 8.6 && b < 11.0;                 // the crack climbs beside the buttress, stepping with the courses
    while (v < 15.7) { const dv = r.range(0.3, 0.55), w = 0.035 + r() * 0.035 * (1 - (v - 4.9) / 14); if (!inB(u, v + dv / 2)) dark.push(SW.box(u - w, u + w, v - 0.02, v + dv + 0.02, FW, FW + 0.011)); v += dv;
      if (r() < 0.75) { let du = r.range(0.12, 0.34) * (r() < 0.62 ? -1 : 1); if (u + du > 6.5) du = -Math.abs(du); if (u + du < (v < 7.4 ? 5.72 : 5.45)) du = Math.abs(du); if (v > 7.6 && v < 8.4) du = 0; if (!inB(u + du / 2, v)) dark.push(SW.box(Math.min(u, u + du) - w, Math.max(u, u + du) + w, v - 0.022, v + 0.022, FW, FW + 0.011)); u += du; } }
    B.add(M.void, dark); }

  // ---------------------------------------------------------------------------------------------- string courses
  const stringProfile = (y, p, h) => [[Z1 - 0.05, y], [Z1 + p * 0.55, y], [Z1 + p, y + h * 0.3], [Z1 + p, y + h * 0.62], [Z1 - 0.05, y + h]];
  for (const [y, p, h] of [[S1, 0.17, 0.3], [S2, 0.17, 0.3], [S3, 0.24, 0.4]]) for (const f of [FACE.S, FACE.W, FACE.E, FACE.N]) B.add(M.sand, tint(turn(prismX(stringProfile(y, p, h), X0 - p, X1 + p), f), 0.96));

  // ------------------------------------------------------------------------------- south-east buttress (four stages)
  { const bx0 = X1 - 1.35, bx1 = X1, stages = [[1.75, 4.3], [1.52, 8.6], [0.75, S2], [0.42, S3]]; let y0 = -0.5; const body = [], dress = [];
    for (let i = 0; i < stages.length; i++) { const d = stages[i][0], top = stages[i][1], nd = i + 1 < stages.length ? stages[i + 1][0] : 0, rise = (d - nd) * 0.95, zf = Z1 + d;
      body.push(tint(K.box(bx0, y0, Z1 - 0.1, bx1, top, zf), 0.97));
      dress.push(prismX([[Z1 + nd - 0.06, top - 0.13], [zf + 0.07, top - 0.13], [zf + 0.07, top + 0.02], [Z1 + nd - 0.06, top + rise + 0.06]], bx0 - 0.07, bx1 + 0.07));                 // weathering with a drip
      for (let y = Math.max(y0, 1.16), k = 0; y < top - 0.5; y += 0.42, k++) { const a = k % 2 ? 0.5 : 0.3, b = k % 2 ? 0.3 : 0.5;                                                       // quoins
        dress.push(tint(K.box(bx0 - 0.03, y, zf - b, bx0 + a, y + 0.38, zf + 0.03), 0.9 + 0.1 * rnd()), tint(K.box(bx1 - a, y, zf - b, bx1 + 0.03, y + 0.38, zf + 0.03), 0.9 + 0.1 * rnd())); }
      y0 = top; }
    body.push(tint(K.box(bx0 - 0.3, -0.5, Z1 - 0.1, bx1 + 0.05, 0.5, Z1 + 2.05), 1.15, 1.08, 1.0), tint(K.box(bx0 - 0.16, 0.5, Z1 - 0.1, bx1 + 0.05, 0.92, Z1 + 1.91), 1.3, 1.22, 1.12));                                    // its plinth
    B.add(M.stoneWarm, body.slice(0, 4)); B.add(M.stoneDark, body.slice(4)); B.add(M.sand, dress);
    B.add(M.sand, tint(prismX([[Z1 + 1.71, 0.92], [Z1 + 1.91, 0.92], [Z1 + 1.91, 0.98], [Z1 + 1.77, 1.16], [Z1 + 1.71, 1.16]], bx0 - 0.16, bx1 + 0.03), 0.9), tint(prismZ([[bx0 - 0.16, 0.92], [bx0 - 0.16, 0.98], [bx0 - 0.02, 1.16], [bx0 + 0.05, 1.16], [bx0 + 0.05, 0.92]], Z1 + 0.2, Z1 + 1.91), 0.9));
    // gableted set-off on the second stage
    const xm = (bx0 + bx1) / 2, zg = Z1 + stages[1][0];
    B.add(M.sand, prismZ([[bx0 - 0.05, 7.85], [bx1 + 0.05, 7.85], [bx1 + 0.05, 8.2], [xm, 9.1], [bx0 - 0.05, 8.2]], zg - 0.2, zg + 0.12), tint(prismZ([[xm - 0.2, 8.0], [xm + 0.2, 8.0], [xm + 0.2, 8.25], [xm, 8.55], [xm - 0.2, 8.25]], zg + 0.12, zg + 0.13), 0.45), ball(xm, 9.15, zg - 0.04, 0.08, 0));
    // the top stage dies into the belfry corner under a little gabled head
    B.add(M.sand, prismZ([[bx0 - 0.04, S3 + 0.3], [bx1 + 0.04, S3 + 0.3], [bx1 + 0.04, S3 + 0.75], [xm, S3 + 1.5], [bx0 - 0.04, S3 + 0.75]], Z1 + 0.1, Z1 + 0.34));
    ctx.block.rect(bx0 - 0.3, Z1 - 0.2, bx1 + 0.1, Z1 + 2.05);
  }
  // a plainer buttress on the west face at the north-west corner (seen obliquely from the cloister)
  { const WW = K.wall([X0, Z0], [X0, Z1]); B.add(M.stoneWarm, tint(WW.buttress(0.75, { width: 1.25, stages: [[1.3, 4.3], [1.0, S1], [0.7, S2], [0.4, S3]], slope: 0.95 }), 0.97)); }

  // --------------------------------------------------------------------------------------- stair turret (south-west)
  const TX = X0 - 0.4, TZ = Z1 - 1.0, TR = 1.5, TAP = TR * Math.cos(PI / 8), THEAD = 24.9;
  { const og = r => K.ngon(TX, TZ, r, 8, PI / 8);
    B.add(M.stoneDark, tint(K.poly(og(TR + 0.2), -0.5, 0.5), 1.15, 1.08, 1.0), tint(K.poly(og(TR + 0.1), 0.5, 0.92), 1.3, 1.22, 1.12));
    B.add(M.stoneWarm, tint(K.poly(og(TR), 0.92, THEAD), 0.93));
    B.add(M.sand, tint(K.poly(og(TR + 0.07), 0.92, 1.12), 0.9), ...[S1, S2, S3].map(y => tint(K.poly(og(TR + 0.13), y + 0.03, y + 0.27), 0.96)), tint(K.poly(og(TR + 0.17), HW - 0.05, HW + 0.36), 0.98), K.poly(og(TR + 0.12), THEAD - 0.1, THEAD + 0.1), tint(K.poly(og(TR + 0.24), THEAD + 0.1, THEAD + 0.32), 1.04));
    B.add(M.sand, tint(K.spire({ x: TX, y: THEAD + 0.32, z: TZ, r: TR + 0.2, h: 3.1, sides: 8, ry: PI / 8 }), 0.86));
    B.add(M.sand, K.lathe([[0.2, 0], [0.24, 0.06], [0.12, 0.14], [0.2, 0.3], [0.21, 0.4], [0.09, 0.52], [0.0, 0.54]], 6, { x: TX, y: THEAD + 3.22, z: TZ }));
    // little slit windows winding up with the stair
    const facet = th => K.wall([TX + Math.cos(th + PI / 8) * TR, TZ + Math.sin(th + PI / 8) * TR], [TX + Math.cos(th - PI / 8) * TR, TZ + Math.sin(th - PI / 8) * TR]);
    const FS = facet(PI / 2), FSW = facet(PI * 0.75), FWS = facet(PI), mid = TR * Math.sin(PI / 8);
    const slit = (W, v, h) => { const u = mid, wd = 0.15; B.add(M.void, W.box(u - wd / 2, u + wd / 2, v, v + h, 0, 0.014));
      B.add(M.sand, W.box(u - wd / 2 - 0.11, u + wd / 2 + 0.11, v - 0.1, v, 0, 0.075), W.box(u - wd / 2 - 0.09, u + wd / 2 + 0.09, v + h, v + h + 0.11, 0, 0.06), tint(W.box(u - wd / 2 - 0.07, u - wd / 2, v, v + h, 0, 0.045), 0.92), tint(W.box(u + wd / 2, u + wd / 2 + 0.07, v, v + h, 0, 0.045), 0.92)); };
    slit(FS, 3.0, 0.95); slit(FS, 9.4, 0.9); slit(FS, 14.2, 0.85); slit(FSW, 6.1, 0.9); slit(FSW, 13.0, 0.85); slit(FWS, 4.6, 0.9); slit(FWS, 10.9, 0.9); slit(FWS, 16.8, 0.8); slit(FS, 18.9, 0.85); slit(FSW, 20.6, 0.8); slit(FS, 23.2, 0.8); slit(FWS, 23.0, 0.8);
    ctx.block.circle(TX, TZ, TR + 0.1);
  }

  // --------------------------------------------------------------------------------------------------- belfry stage
  const rise2 = Math.sqrt(Math.pow((BW * BW / 4 + BRISE * BRISE) / BW - 0.18, 2) - Math.pow((BW * BW / 4 + BRISE * BRISE) / BW - BW / 2, 2));      // rise of the opening 0.18 inside the main arch
  // Y-tracery: two tall lancet lights and a quatrefoil in the head, light enough for the bell to show through
  const TLW = (BW - 0.36 - 3 * 0.18) / 2;
  const yTracery = () => { const g = K.extrude(K.arch(4, BSILL, BW - 0.36, BSPR, rise2, 0, 9), 0.26, [K.arch(4 - 0.09 - TLW / 2, BSILL + 0.16, TLW, BSPR - 0.1, 1.66, 0, 6), K.arch(4 + 0.09 + TLW / 2, BSILL + 0.16, TLW, BSPR - 0.1, 1.66, 0, 6), quatre(4, BSPR + rise2 - 0.62, 0.17, 0.16)]); g.translate(0, 0, 0.22); return SW.put(g); };
  const belfryFace = (f, slats) => {
    B.add(M.sand, turnAll([SW.archTrim(4, BSILL, BW, BSPR, BRISE, { band: 0.3, depth: 0.14, at: FW }), tint(SW.archTrim(4, BSILL, BW, BSPR, BRISE, { inset: -0.18, band: 0.18, depth: 0.36, at: 0.2 }), 0.88),
      tint(yTracery(), 0.94), SW.archTrim(4, BSPR - 0.25, BW, BSPR, BRISE, { inset: 0.3, band: 0.12, depth: 0.2, at: FW }),
      prismX([[Z1 - 0.75, BSILL + 0.22], [Z1 + 0.2, BSILL - 0.02], [Z1 + 0.2, BSILL - 0.2], [Z1 - 0.75, BSILL - 0.2]], X0 + 4 - BW / 2 - 0.42, X0 + 4 + BW / 2 + 0.42),
      colonnette(X0 + 4, Z1 - FW + 0.56, BSILL + 0.02, BSPR - BSILL + 0.05, 0.1, 7)], f));
    const lw = (BW - 0.36 - 3 * 0.18) / 2, gs = [];
    for (const [li, v, rz, cut] of slats) { const len = lw * (cut || 1), g = new THREE.BoxGeometry(len, 0.045, 0.42); g.rotateX(0.62); if (rz) { g.translate(len / 2, 0, 0); g.rotateZ(rz); g.translate(-len / 2, 0, 0); }
      g.translate(X0 + 4 + (li ? 1 : -1) * (0.09 + lw / 2) - (cut ? (1 - cut) * lw / 2 : 0), v, Z1 - FW + 0.02); gs.push(tint(g, 1.15)); }
    B.add(M.woodDark, turnAll(gs, f));
  };
  const fullSlats = miss => { const a = []; for (let li = 0; li < 2; li++) for (let k = 0; k < 6; k++) { if (miss.includes(li * 6 + k)) continue; a.push([li, 17.38 + k * 0.36, 0, 0]); } return a; };
  belfryFace(FACE.S, [[0, 17.38, 0, 0], [0, 17.74, -0.5, 0], [1, 17.38, 0, 0.55]]);         // south: the louvres have all but gone, so the bell shows
  belfryFace(FACE.W, fullSlats([4, 5, 9]).concat([[1, 18.4, -0.45, 0]]));
  belfryFace(FACE.E, fullSlats([2, 10, 11]));
  belfryFace(FACE.N, fullSlats([0, 1, 2, 3, 4, 5, 8, 9, 10, 11]));
  // clasping strips at the belfry corners that carry the pinnacles, corbel table, cornice
  for (const f of [FACE.S, FACE.W, FACE.E, FACE.N]) {
    B.add(M.stoneWarm, tint(turn(K.box(X0 - 0.16, BF, Z1 - 1.0, X0 + 1.0, HW, Z1 + 0.16), f), 0.95));
    { const qs = []; for (let y = BF + 0.1, k = 0; y < 21.2; y += 0.42, k++) { const a = k % 2 ? 0.62 : 0.36, b = k % 2 ? 0.36 : 0.62; qs.push(tint(K.box(X0 - 0.19, y, Z1 + 0.19 - b, X0 - 0.19 + a, y + 0.38, Z1 + 0.19), 0.9 + 0.1 * rnd())); } B.add(M.sand, turnAll(qs, f)); }
    const cb = []; for (let i = 0; i < 15; i++) { const x = X0 + 0.28 + i * (8 - 0.56) / 14; cb.push(tint(prismX([[Z1 - 0.02, 21.5], [Z1 + 0.22, 21.72], [Z1 + 0.3, 21.72], [Z1 + 0.3, HW], [Z1 - 0.02, HW]], x - 0.11, x + 0.11), 0.86)); }
    cb.push(prismX([[Z1 - 0.05, HW], [Z1 + 0.34, HW], [Z1 + 0.4, HW + 0.12], [Z1 + 0.4, HW + 0.3], [Z1 - 0.05, HW + 0.3]], X0 - 0.4, X1 + 0.4));
    B.add(M.sand, turnAll(cb, f));
  }

  // worn gargoyles under the cornice, spouting clear of the wall
  for (const [f, us] of [[FACE.S, [1.55, 6.45]], [FACE.W, [1.55, 4.7]], [FACE.E, [1.55]]]) for (const u of us) { const x = X0 + u;
    B.add(M.sand, turnAll([tint(K.tube([[x, 21.82, Z1 + 0.2], [x, 21.78, Z1 + 0.75], [x, 21.86, Z1 + 1.05]], [0.15, 0.1], 5, { flat: true }), 0.88), tint(K.rock({ x, y: 21.93, z: Z1 + 1.14, sx: 0.15, sy: 0.14, sz: 0.19, seed: 50 + u * 3, detail: 0 }), 0.92), tint(K.box(x - 0.2, 21.86, Z1 + 0.55, x + 0.2, 21.9, Z1 + 0.8), 0.8)], f)); }

  // ----------------------------------------------------------------------------------------------- the bell that does not ring
  const BX = CX, BZ = CZ + 0.45, BY = 17.5;      // axis of the bell; height of its lip
  { const prof = [[0, 1.72], [0.45, 1.68], [0.6, 1.45], [0.66, 1.1], [0.74, 0.75], [0.86, 0.45], [1.0, 0.2], [1.1, 0.05], [1.12, 0], [1.2, 0], [1.215, 0.05], [1.2, 0.11], [1.17, 0.15], [1.14, 0.17], [1.1, 0.2], [1.0, 0.36], [0.9, 0.56],
      [0.82, 0.8], [0.77, 1.05], [0.74, 1.3], [0.735, 1.42], [0.76, 1.44], [0.76, 1.48], [0.725, 1.5], [0.71, 1.62], [0.66, 1.74], [0.56, 1.84], [0.4, 1.92], [0.3, 1.95], [0.3, 2.04], [0, 2.06]];
    const bell = K.lathe(prof, 24, { x: BX, y: BY, z: BZ });
    { const p = bell.attributes.position, c = new Float32Array(p.count * 3);       // dulled bronze with verdigris running down from the shoulder
      for (let i = 0; i < p.count; i++) { const x = p.getX(i) - BX, y = p.getY(i) - BY, z = p.getZ(i) - BZ, a = Math.atan2(z, x), n = HD.fbm(a * 2.2 + 9, y * 0.9, 5, 3) + (y > 1.3 ? 0.08 : 0) - (y < 0.2 ? 0.1 : 0), w = Math.max(0, Math.min(1, (n - 0.5) * 6));
        const inside = i % prof.length < 9, k = inside ? 0.2 : 0.27 + 0.26 * Math.max(0, Math.min(1, (Math.hypot(x, z) - 0.8) / 0.4)) + (y > 1.8 ? 0.14 : 0);      // brighter toward the lip, where hands and weather have kept it clean
        c[i * 3] = k * (0.95 - 0.4 * w); c[i * 3 + 1] = k * (0.9 + 0.08 * w); c[i * 3 + 2] = k * (1.15 + 0.55 * w); }
      bell.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const canons = [0, 1, 2, 3].map(i => K.tube([[BX + Math.cos(i * PI / 2 + 0.4) * 0.28, BY + 2.02, BZ + Math.sin(i * PI / 2 + 0.4) * 0.28], [BX + Math.cos(i * PI / 2 + 0.4) * 0.36, BY + 2.2, BZ + Math.sin(i * PI / 2 + 0.4) * 0.36], [BX + Math.cos(i * PI / 2 + 0.4) * 0.2, BY + 2.3, BZ + Math.sin(i * PI / 2 + 0.4) * 0.2]], 0.07, 5));
    const mesh = new THREE.Mesh(K.merge([bell, canons.map(g => tint(g, 0.42, 0.4, 0.4))]), M.bronze); mesh.name = 'bell'; ctx.add(mesh, { cast: false, receive: false });      // not shadowed: the low moon rims its shoulder and west flank
    // clapper, straps and gudgeons
    B.add(M.iron, [K.tube([[BX, BY + 1.7, BZ], [BX + 0.05, BY + 0.6, BZ + 0.02], [BX + 0.1, BY + 0.02, BZ + 0.04]], [0.035, 0.06], 6), ball(BX + 0.1, BY - 0.04, BZ + 0.04, 0.17, 1), K.tube([[BX + 0.1, BY - 0.15, BZ + 0.04], [BX + 0.11, BY - 0.34, BZ + 0.04]], 0.05, 5),
      ...[-0.95, -0.34, 0.34, 0.95].map(d => K.box(BX + d - 0.05, BY + 2.16, BZ - 0.3, BX + d + 0.05, BY + 2.8, BZ + 0.3)), K.tube([[BX - 2.3, BY + 2.5, BZ], [BX + 2.3, BY + 2.5, BZ]], 0.07, 6)].map(g => tint(g, 1.5)));
    // headstock and the timber bell frame
    const fr = [tint(K.box(BX - 1.75, BY + 2.2, BZ - 0.27, BX + 1.75, BY + 2.76, BZ + 0.27), 1.25)];
    for (const sd of [-1, 1]) { const xt = BX + sd * 2.05;
      fr.push(K.box(xt - 0.16, BF + 0.2, BZ - 2.3, xt + 0.16, BF + 0.5, BZ + 1.95), K.box(xt - 0.14, BF + 0.5, BZ - 0.14, xt + 0.14, BY + 2.3, BZ + 0.14), K.box(xt - 0.2, BY + 2.26, BZ - 0.5, xt + 0.2, BY + 2.44, BZ + 0.5),
        prismX([[BZ + 1.85, BF + 0.5], [BZ + 1.5, BF + 0.5], [BZ + 0.1, BY + 2.26], [BZ + 0.4, BY + 2.26]], xt - 0.12, xt + 0.12), prismX([[BZ - 1.85, BF + 0.5], [BZ - 0.4, BY + 2.26], [BZ - 0.1, BY + 2.26], [BZ - 1.5, BF + 0.5]], xt - 0.12, xt + 0.12)); }
    fr.push(K.box(BX - 2.3, BF + 0.2, BZ + 1.6, BX + 2.3, BF + 0.48, BZ + 1.9), K.box(BX - 2.3, BF + 0.2, BZ - 2.2, BX + 2.3, BF + 0.48, BZ - 1.9));
    // the lever the rope once pulled
    fr.push(tint(prismX([[BZ + 0.2, BY + 2.62], [BZ + 0.2, BY + 2.42], [BZ + 1.34, BY + 2.2], [BZ + 1.34, BY + 2.32]], BX + 0.94, BX + 1.06), 1.2));
    B.add(M.woodDark, fr);
    // the rope, cut short and frayed; it stirs a little in the wind
    const rp = [K.tube([[0, 0, 0], [0.012, -0.45, 0], [-0.006, -0.9, 0.01], [0.014, -1.35, 0], [0, -1.7, 0]], 0.055, 6), K.tube([[0, 0.07, 0], [0, -0.12, 0]], 0.08, 6), K.tube([[0, -1.52, 0], [0, -1.64, 0]], 0.075, 6)];
    for (let i = 0; i < 5; i++) { const a = i * 1.26; rp.push(K.tube([[0, -1.66, 0], [Math.cos(a) * 0.07, -1.86, Math.sin(a) * 0.07], [Math.cos(a) * 0.14, -2.0 - (i % 2) * 0.07, Math.sin(a) * 0.14]], [0.024, 0.008], 3)); }
    const rope = new THREE.Mesh(tint(K.merge(rp), 1.05, 0.93, 0.72), M.sand); rope.name = 'bellRope'; rope.position.set(BX + 1.0, BY + 2.26, BZ + 1.3); ctx.add(rope, { cast: false, receive: false });
    ctx.onUpdate(t => { rope.rotation.z = 0.03 * Math.sin(t * 0.61) + 0.012 * Math.sin(t * 1.73 + 1); rope.rotation.x = 0.022 * Math.sin(t * 0.47 + 2); });
    ctx.glow({ x: BX - 0.78, y: BY + 0.09, z: BZ + 0.95, color: '#cfe0ff', size: 0.85, strength: 0.42, flicker: 0.04 });        // a cold glint on the lip
  }

  // ------------------------------------------------------------------------------------------ parapet and pinnacles
  const PY = HW + 0.3, PO = 0.3;      // parapet base; how far its face stands out from the wall face
  { const a = X0 + 0.85, b = X1 - 0.85, mw = 0.9, n = 4, cw = (b - a - n * mw) / (n + 1), top = [[X0 - PO, PY + 1.45]], caps = [];
    for (let k = 0; k < n; k++) { const m0 = a + cw + k * (mw + cw), m1 = m0 + mw; top.push([m0, PY + 1.45], [m0, PY + 2.05], [m1, PY + 2.05], [m1, PY + 1.45]); caps.push(K.box(m0 - 0.05, PY + 2.05, Z1 + PO - 0.42, m1 + 0.05, PY + 2.15, Z1 + PO + 0.05)); if (k) caps.push(tint(K.box(m0 - cw, PY + 1.45, Z1 + PO - 0.4, m0, PY + 1.52, Z1 + PO + 0.04), 0.94)); }
    top.push([X1 + PO, PY + 1.45]);
    const holes = []; for (let k = 0; k < 7; k++) holes.push(quatre(a + 0.36 + k * (b - a - 0.72) / 6, PY + 0.78, 0.2, 0.19));
    const outline = [[X0 - PO, PY], [X1 + PO, PY]].concat(top.slice().reverse());
    for (const f of [FACE.S, FACE.W, FACE.E, FACE.N]) { const g = K.extrude(outline, 0.36, holes); g.translate(0, 0, Z1 + PO - 0.36); B.add(M.stoneWarm, tint(turn(g, f), 1.02));
      B.add(M.sand, turnAll(caps.map(c => c.clone()), f), turn(K.box(X0 - PO - 0.03, PY + 0.28, Z1 + PO - 0.02, X1 + PO + 0.03, PY + 0.36, Z1 + PO + 0.04), f), turn(K.box(X0 - PO - 0.03, PY + 1.2, Z1 + PO - 0.02, X1 + PO + 0.03, PY + 1.27, Z1 + PO + 0.04), f)); }
  }
  const pinnacle = (f, broken) => { const px = X0 + 0.25, pz = Z1 - 0.25, st = [], sa = [];
    st.push(K.box(px - 0.62, HW + 0.3, pz - 0.62, px + 0.62, HW + 1.3, pz + 0.62));
    if (broken) { st.push(K.box(px - 0.5, HW + 1.3, pz - 0.5, px + 0.5, HW + 2.2, pz + 0.5)); const g = new THREE.BoxGeometry(0.9, 0.7, 0.8, 2, 2, 2); K.wobble(g, 0.12, 41); st.push(K.xform(K.flat(g), { x: px + 0.05, y: HW + 2.45, z: pz - 0.05, ry: 0.3, rz: 0.12 }));
      st.push(K.chunk({ x: px - 0.2, y: HW + 2.7, z: pz + 0.1, w: 0.45, h: 0.3, d: 0.4, seed: 5 })); sa.push(K.box(px - 0.68, HW + 1.3, pz - 0.68, px + 0.68, HW + 1.42, pz + 0.68)); }
    else { st.push(K.box(px - 0.5, HW + 1.3, pz - 0.5, px + 0.5, HW + 3.0, pz + 0.5));
      sa.push(K.box(px - 0.68, HW + 1.3, pz - 0.68, px + 0.68, HW + 1.42, pz + 0.68), K.box(px - 0.58, HW + 2.88, pz - 0.58, px + 0.58, HW + 3.0, pz + 0.58));
      for (let k = 0; k < 4; k++) { const g = prismZ([[-0.58, HW + 3.0], [0.58, HW + 3.0], [0, HW + 3.7]], 0.46, 0.6); g.rotateY(k * PI / 2); g.translate(px, 0, pz); sa.push(g);                              // gablets
        const p = prismZ([[-0.3, HW + 1.65], [0.3, HW + 1.65], [0.3, HW + 2.4], [0, HW + 2.72], [-0.3, HW + 2.4]], 0.5, 0.515); p.rotateY(k * PI / 2); p.translate(px, 0, pz); sa.push(tint(p, 0.62)); }         // sunk panels
      sa.push(tint(K.spire({ x: px, y: HW + 3.0, z: pz, r: 0.66, h: 2.7 }), 0.96));
      for (let k = 0; k < 4; k++) for (let i = 1; i <= 4; i++) { const t = i / 5.2, d = 0.47 * (1 - t), a = k * PI / 2 + PI / 4; sa.push(K.rock({ x: px + Math.cos(a) * (d + 0.05) * 1.414, y: HW + 3.0 + 2.7 * t, z: pz + Math.sin(a) * (d + 0.05) * 1.414, sx: 0.12 - 0.05 * t, sy: 0.14 - 0.05 * t, sz: 0.12 - 0.05 * t, seed: k * 7 + i, detail: 0 })); }      // crockets
      sa.push(K.lathe([[0.05, 0], [0.13, 0.07], [0.06, 0.15], [0.17, 0.27], [0.15, 0.36], [0.05, 0.44], [0.0, 0.47]], 6, { x: px, y: HW + 5.6, z: pz })); }
    B.add(M.stoneWarm, turnAll(st, f)); B.add(M.sand, turnAll(sa, f)); };
  pinnacle(FACE.W); pinnacle(FACE.N); pinnacle(FACE.E, true);       // none on the south-west corner (the turret takes it); the "east" turn of that corner is the south-east one: it fell

  // ------------------------------------------------------------------------------------------------ the slate spire
  const ROWS = [[3.8, HW + 0.5], [3.3, HW + 1.2], [2.62, HW + 2.5], [1.95, HW + 3.8], [1.3, HW + 5.1], [0.64, HW + 6.45], [0, HW + 7.8]];      // [half-width, height]: sprocketed eaves, a slight sag
  const hwAt = y => { for (let i = 0; i < ROWS.length - 1; i++) if (y <= ROWS[i + 1][1]) { const a = ROWS[i], b = ROWS[i + 1]; return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); } return 0; };
  const roofPt = (s, y, off) => { const h = hwAt(y); return [CX + s * h, y + (off || 0) * 0.5, CZ + h + (off || 0) * 0.87]; };      // a point on the south slope: s = -1 .. 1 across, lifted `off` off the slates
  { const pos = []; for (let j = 0; j < ROWS.length - 1; j++) { const h0 = ROWS[j][0], y0 = ROWS[j][1], h1 = ROWS[j + 1][0], y1 = ROWS[j + 1][1]; pos.push(CX - h0, y0, CZ + h0, CX + h0, y0, CZ + h0, CX + h1, y1, CZ + h1); if (h1 > 0) pos.push(CX - h0, y0, CZ + h0, CX + h1, y1, CZ + h1, CX - h1, y1, CZ + h1); }
    const slope = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    for (const f of [FACE.S, FACE.W, FACE.E, FACE.N]) { B.add(M.slate, tint(turn(slope(), f), 0.96, 0.82, 0.62)); B.add(M.slate, tint(turn(K.tube(ROWS.map(r => [CX - r[0], r[1] + 0.03, CZ + r[0]]), 0.065, 5), f), 1.5, 1.3, 1.0)); }      // hips dressed in lead
    B.add(M.slate, tint(K.spire({ x: CX, y: HW + 7.2, z: CZ, r: 0.38, h: 0.85, sides: 8 }), 1.5, 1.3, 1.0));
    // missing slates (battens show), slipped slates
    const patch = (f, s0, s1, y0, y1) => { B.add(M.void, turn(quadP(roofPt(s0, y0, 0.03), roofPt(s1, y0, 0.03), roofPt(s1 * 0.985, y1, 0.03), roofPt(s0 * 0.985, y1, 0.03)), f));
      for (let y = y0 + 0.12; y < y1 - 0.05; y += 0.3) B.add(M.woodDark, tint(turn(quadP(roofPt(s0, y, 0.045), roofPt(s1, y, 0.045), roofPt(s1, y + 0.07, 0.045), roofPt(s0, y + 0.07, 0.045)), f), 0.6, 0.58, 0.62)); };
    patch(FACE.S, 0.3, 0.62, HW + 2.5, HW + 3.3); patch(FACE.S, 0.44, 0.74, HW + 2.8, HW + 3.5); patch(FACE.S, -0.75, -0.3, HW + 3.9, HW + 4.6); patch(FACE.S, -0.1, 0.35, HW + 5.2, HW + 5.8);
    patch(FACE.W, -0.5, -0.05, HW + 2.5, HW + 3.3); patch(FACE.W, 0.2, 0.7, HW + 3.9, HW + 4.6); patch(FACE.E, -0.3, 0.3, HW + 3.9, HW + 4.8);
    const r = ctx.rng(31), slips = []; for (const f of [FACE.S, FACE.W, FACE.E]) for (let i = 0; i < 9; i++) { const y = HW + r.range(1.4, 6.2), s = r.range(-0.8, 0.8), h = hwAt(y), w = 0.2 / Math.max(0.3, h), a = r.range(-0.5, 0.5), dy = 0.34, sk = Math.sin(a) * 0.3;
      slips.push(K.tint(turn(quadP(roofPt(s - w, y - sk * 0.5, 0.035), roofPt(s + w, y + sk * 0.5, 0.035), roofPt(s + w, y + dy + sk * 0.5, 0.05), roofPt(s - w, y + dy - sk * 0.5, 0.05)), f), ...(t => [0.96 * t, 0.82 * t, 0.62 * t])(r.range(1.05, 1.4)))); }
    B.add(M.slate, slips);
    // lucarnes: small gabled dormers on three slopes
    const ys = HW + 2.6, zf = CZ + hwAt(ys) + 0.24, zb = CZ + hwAt(ys + 1.75) - 0.15, LW = K.wall([CX - 0.55, zf], [CX + 0.55, zf], ys);
    for (const f of [FACE.S, FACE.W, FACE.E]) {
      B.add(M.sand, turnAll([tint(prismZ([[CX - 0.55, ys - 0.5], [CX + 0.55, ys - 0.5], [CX + 0.55, ys + 0.95], [CX, ys + 1.65], [CX - 0.55, ys + 0.95]], zb, zf), 0.92), LW.archTrim(0.55, 0.14, 0.42, 0.62, 0.4, { band: 0.08, depth: 0.05, at: 0 }), LW.box(-0.06, 1.16, -0.16, -0.06, -0.3, 0.07)], f));
      B.add(M.void, turn(LW.pane(0.55, 0.14, 0.42, 0.62, 0.4, { at: 0.012 }), f));
      B.add(M.slate, tint(turn(K.gable({ x0: CX - 0.55, x1: CX + 0.55, z0: zb, z1: zf, y: ys + 0.95, rise: 0.72, over: 0.14, thick: 0.09, axis: 'z' }), f), 1.0, 0.86, 0.66)); }
    // leaning iron cross and weather vane
    const cr = [K.tube([[0, -0.2, 0], [0, 2.1, 0]], [0.055, 0.035], 6), K.lathe([[0.02, 0], [0.15, 0.06], [0.19, 0.17], [0.15, 0.28], [0.03, 0.34]], 8, { y: 0.42 }), K.box(-0.42, 1.62, -0.03, 0.42, 1.7, 0.03), K.box(-0.035, 1.3, -0.03, 0.035, 2.28, 0.03),
      ...[[-0.42, 1.66], [0.42, 1.66], [0, 2.28]].map(p => { const g = new THREE.BoxGeometry(0.15, 0.15, 0.05); g.rotateZ(PI / 4); g.translate(p[0], p[1], 0); return g; }),
      K.box(-0.62, 1.0, -0.015, 0.5, 1.04, 0.015), prismZ([[0.45, 0.9], [0.82, 1.02], [0.45, 1.14]], -0.015, 0.015), prismZ([[-0.62, 1.02], [-0.95, 1.22], [-0.82, 1.02], [-0.95, 0.82]], -0.015, 0.015)];
    B.add(M.iron, tint(K.xform(K.merge(cr), { x: CX, y: HW + 8.0, z: CZ, rz: -0.17, rx: 0.07 }), 1.5));
  }

  // ------------------------------------------------------------------------------------------ at the foot of the tower
  { // the fallen pinnacle lies in front of the buttress with its rubble
    const sp = K.spire({ x: 0, y: 0, z: 0, r: 0.52, h: 2.0 }), cro = []; for (let k = 0; k < 4; k++) for (let i = 1; i <= 3; i++) { const t = i / 4.2, d = 0.37 * (1 - t), a = k * PI / 2 + PI / 4; cro.push(K.rock({ x: Math.cos(a) * (d + 0.04) * 1.414, y: 2.0 * t, z: Math.sin(a) * (d + 0.04) * 1.414, sx: 0.1, sy: 0.11, sz: 0.1, seed: k * 5 + i, detail: 0 })); }
    B.add(M.sand, tint(K.xform(K.merge([sp, cro]), { x: X1 - 0.5, y: 0.33, z: Z1 + 2.5, rz: 1.45, ry: 0.1, rx: 0.5 }), 0.9));
    B.add(M.stoneWarm, K.chunk({ x: X1 - 2.6, y: 0, z: Z1 + 2.55, w: 0.62, h: 0.5, d: 0.6, seed: 8, ry: 0.5 }), K.rubble({ x: X1 - 1.4, z: Z1 + 2.75, n: 7, spread: 0.75, size: [0.14, 0.36], seed: 14 }), K.chunk({ x: X0 + 0.95, y: 0, z: Z1 + 0.42, w: 0.4, h: 0.26, d: 0.3, seed: 21, ry: 0.3 }), K.chunk({ x: X0 + 1.55, y: 0, z: Z1 + 0.5, w: 0.3, h: 0.2, d: 0.26, seed: 22 }));
    B.add(M.sand, K.rubble({ x: X1 - 2.0, z: Z1 + 2.85, n: 4, spread: 0.5, size: [0.12, 0.26], seed: 19 }));
    ctx.block.rect(X1 - 2.95, Z1 + 2.05, X1 + 0.1, Z1 + 2.95);
    // a stone trough beside the buttress, and old scaffold poles leaning in the corner above it
    const tr = K.poly([[-0.36, -0.65], [0.36, -0.65], [0.36, 0.65], [-0.36, 0.65]], 0, 0.62, [[[-0.24, -0.53], [0.24, -0.53], [0.24, 0.53], [-0.24, 0.53]]]); K.wobble(tr, 0.015, 3);
    const TRX = X1 - 2.1, TRZ = Z1 + 1.08;
    B.add(M.sand, tint(K.xform(K.flat(tr), { x: TRX, y: -0.04, z: TRZ, ry: 0.05 }), 0.72, 0.72, 0.78)); B.add(M.moss, tint(K.box(TRX - 0.26, 0.1, TRZ - 0.55, TRX + 0.26, 0.4, TRZ + 0.55), 0.7));
    const poles = [[[X1 - 2.75, 0, Z1 + 1.9], [X1 - 1.47, 4.5, Z1 + 0.1], 0.07], [[X1 - 2.95, 0, Z1 + 1.55], [X1 - 1.52, 3.9, Z1 + 0.09], 0.06], [[X1 - 2.5, 0, Z1 + 2.0], [X1 - 1.45, 3.3, Z1 + 0.14], 0.055]];
    B.add(M.woodDark, poles.map((p, i) => tint(K.tube([p[0], p[1]], [p[2] * 1.1, p[2] * 0.85], 6), 0.72 + i * 0.1, 0.7 + i * 0.1, 0.76 + i * 0.1)));
    B.add(M.woodDark, tint(K.xform(K.box(-0.62, 0, -0.11, 0.62, 0.06, 0.11), { x: TRX + 0.03, y: 0.6, z: TRZ - 0.1, ry: 0.35, rz: 0.02 }), 1.3));        // a plank left across the trough
    ctx.block.rect(X1 - 3.0, Z1 - 0.1, X1 - 1.3, Z1 + 1.95);
    // moss on the ledges that keep the damp
    const mo = (x, y, z, sx, sz, s) => K.rock({ x, y, z, sx, sy: 0.05, sz, seed: s, detail: 1 });
    B.add(M.moss, mo(X0 + 0.6, 0.93, Z1 + 0.12, 0.42, 0.12, 2), mo(X0 + 2.0, 0.51, Z1 + 0.3, 0.3, 0.1, 3), mo(X1 - 0.6, 0.93, Z1 + 1.8, 0.4, 0.1, 4), mo(X1 - 0.75, 4.42, Z1 + 1.66, 0.36, 0.08, 5), mo(X1 - 0.4, 9.0, Z1 + 1.1, 0.3, 0.12, 6),
      mo(DX - 1.75, 0.21, Z1 + 0.7, 0.3, 0.22, 7), mo(DX + 1.6, 0.41, Z1 + 0.2, 0.2, 0.14, 8), mo(TX - 0.3, 0.93, TZ + TAP + 0.06, 0.4, 0.1, 9), mo(X0 + 2.6, S1 + 0.3, Z1 + 0.07, 0.5, 0.1, 10), mo(X0 + 5.4, S2 + 0.3, Z1 + 0.07, 0.6, 0.1, 11));
  }

  B.build();

  // ---------------------------------------------------------------------------------------- collision, floors, spot
  ctx.block.rect(X0 - 0.3, Z0 - 0.3, X1 + 0.3, Z1 - FW);                        // the tower, leaving the door recess open
  ctx.block.rect(X0 - 0.3, Z1 - FW, DX - DW / 2, Z1 + 0.05);
  ctx.block.rect(DX + DW / 2, Z1 - FW, X1 + 0.3, Z1 + 0.05);
  ctx.floor(DX - 2.08, Z1 + 0.36, DX + 2.08, Z1 + 1.0, 0.2);                    // lower step
  ctx.floor(DX - 1.82, Z1 - 0.66, DX + 1.82, Z1 + 0.38, 0.4);                   // threshold
  ctx.spot({ id: 'tower', x: -14.6, z: -49.4, r: 1.0, label: '鐘楼の中へ', kind: 'exit' });
  // At the door the camera cranes back and looks up the shaft, so that the silent bell comes into the frame (the ordinary camera never
  // sees above y = 10 here). ?notowercam=1 switches it off.
  if (!ctx.query || !ctx.query.has('notowercam')) ctx.camZone({ x: DX, z: Z1 + 0.75, r: 1.3, fall: 4.6, pitch: 12, dist: 53, lift: 9.2 });

  // ------------------------------------------------------------------------------------------------------ plants
  ctx.plant('ivy', { x: X0 + 1.15, y: 4.6, z: Z1 + 0.02, nx: 0, nz: 1, w: 1.7, h: 8.4, density: 0.8, seed: 61 });                 // climbing the corner between turret and tower
  ctx.plant('ivy', { x: TX, y: 3.6, z: TZ + TAP + 0.02, nx: 0, nz: 1, w: 1.1, h: 6.6, density: 0.7, seed: 62 });
  ctx.plant('ivy', { x: TX - TAP * 0.707 - 0.02, y: 5.2, z: TZ + TAP * 0.707 + 0.02, nx: -0.707, nz: 0.707, w: 1.1, h: 9.5, density: 0.75, seed: 63 });
  ctx.plant('ivy', { x: X0 + 0.9, y: 11.5, z: Z1 + 0.02, nx: 0, nz: 1, w: 1.3, h: 5.5, density: 0.45, seed: 64 });
  ctx.plant('ivy', { x: X1 - 1.38, y: 2.6, z: Z1 + 0.95, nx: -1, nz: 0, w: 1.6, h: 4.2, density: 0.55, seed: 65 });               // west flank of the buttress
  ctx.plant('ivy', { x: X0 - 0.02, y: 7.0, z: Z0 + 3.4, nx: -1, nz: 0, w: 4.5, h: 13, density: 0.6, seed: 66 });                  // the west face
  ctx.plant('grass', { x: X0 + 1.2, z: Z1 + 0.5, r: 0.7, n: 7, kind: 'weed', seed: 71 });
  ctx.plant('grass', { x: X1 - 1.6, z: Z1 + 2.7, r: 0.9, n: 9, kind: 'weed', seed: 72 });
  ctx.plant('grass', { x: X1 - 2.6, z: Z1 + 0.5, r: 0.5, n: 4, kind: 'tall', seed: 73 });
  ctx.plant('grass', { x: TX - 0.9, z: TZ + 1.5, r: 0.6, n: 5, kind: 'tuft', seed: 74 });
  ctx.plant('grass', { x: DX + 2.3, z: Z1 + 0.6, r: 0.4, n: 3, kind: 'weed', seed: 75 });
  ctx.plant('leaves', { x: DX + 0.4, z: Z1 + 0.8, r: 1.6, n: 14, kind: 'dry', y: 0.22, seed: 76 });
}; })();
