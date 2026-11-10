// The ground: one terrain mesh with one hand-painted (in code) pixel-art texture at 32 texels per unit, so footpaths,
// flagstones, worn earth along walls and grass are all drawn at the hero's dot size. Also the walk grid.
(function () {
  const HD = (window.HD = window.HD || {});
  const G = (HD.Ground = {});
  const TX = 32, CS = 0.25;      // texels per unit; coarse field / walk grid cell

  function field(B, fn) {        // sample fn on the coarse grid, return a bilinear lookup
    const nx = Math.ceil((B.x1 - B.x0) / CS) + 1, nz = Math.ceil((B.z1 - B.z0) / CS) + 1, a = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) a[j * nx + i] = fn(B.x0 + i * CS, B.z0 + j * CS);
    return function (x, z) { let fx = (x - B.x0) / CS, fz = (z - B.z0) / CS; fx = Math.max(0, Math.min(nx - 1.001, fx)); fz = Math.max(0, Math.min(nz - 1.001, fz)); const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * nx + i;
      return a[k] * (1 - u) * (1 - v) + a[k + 1] * u * (1 - v) + a[k + nx] * (1 - u) * v + a[k + nx + 1] * u * v; };
  }

  G.paint = function (ctx) {
    const L = ctx.L, B = L.BOUNDS, P = HD.P, hash2 = HD.hash2, fbm = HD.fbm;
    const W = Math.round((B.x1 - B.x0) * TX), H = Math.round((B.z1 - B.z0) * TX);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
    const info = {};
    const fPath = field(B, (x, z) => Math.min(3, L.pathDist(x, z)));
    const flagDist = (x, z) => { let best = 3; for (const p of L.PATHS) { if (p.kind !== 'flag') continue; const pts = p.pts; for (let i = 0; i < pts.length - 1; i++) { const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz) / p.w); } } return best; };
    const fFlag = field(B, flagDist);
    // nearness to anything built: 0 touching a wall/floor edge, 1 at 1.6 units away
    const fNear = field(B, (x, z) => { let m = 1.6; for (let r = 0.4; r <= 1.6; r += 0.4) { if (ctx.blocked(x, z, r) || ctx.onFloor(x - r, z) || ctx.onFloor(x + r, z) || ctx.onFloor(x, z - r) || ctx.onFloor(x, z + r)) { m = r - 0.4; break; } } return m / 1.6; });
    const fLow = field(B, (x, z) => fbm(x * 0.16, z * 0.16, 11, 3));
    const fMid = field(B, (x, z) => fbm(x * 0.9, z * 0.9, 12, 3));
    const fEdge = field(B, (x, z) => fbm(x * 1.4, z * 1.4, 13, 2));
    const fPatch = field(B, (x, z) => fbm(x * 0.33 + 40, z * 0.33, 14, 3));
    const walkExtra = field(B, (x, z) => { for (const w of ctx.walks) { if (w.t === 'r' ? (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) : Math.hypot(x - w.x, z - w.z) <= w.r) return 1; } return 0; });
    const flag = HD.T.canvas('flag'), fd = flag.getContext('2d').getImageData(0, 0, flag.width, flag.height).data, FW = flag.width, FH = flag.height;
    const R = { grass: P.ramp('grass'), dirt: P.ramp('dirt'), moss: P.ramp('moss'), stone: P.ramp('stone') };
    const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
    const put = (i, ramp, t, x, y, dz) => { t += BAY[(x & 3) + ((y & 3) << 2)] * (dz === undefined ? 0.9 : dz) * HD.T.DITHER; const n = ramp.length - 1; t = t < 0 ? 0 : t > n ? n : Math.round(t); const col = ramp[t]; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
    for (let py = 0, i = 0; py < H; py++) { const z = B.z0 + (py + 0.5) / TX;
      for (let px = 0; px < W; px++, i += 4) { const x = B.x0 + (px + 0.5) / TX;
        const edge = fEdge(x, z), mid = fMid(x, z), low = fLow(x, z), near = fNear(x, z), h1 = hash2(px, py, 1), h2 = hash2(px, py >> 1, 2);
        let pd = fPath(x, z) + (edge - 0.5) * 0.36 + (mid - 0.5) * 0.14; if (walkExtra(x, z) > 0.5) pd = Math.min(pd, 0.9 - walkExtra(x, z) * 0.3 + (edge - 0.5) * 0.3);
        const out = Math.max(Math.max(0, z + 8.2) / 5, Math.max(0, Math.abs(x) - 27.8) / 3);        // off the plateau: under the trees
        const cliff = L.cliffZ(x) - z;                                                              // > 0 beyond the north edge
        if (cliff > -0.9 + (edge - 0.5) * 0.8) { put(i, R.stone, 2.4 + (mid - 0.5) * 3 + (h1 - 0.5) * 0.8 - Math.max(0, cliff) * 0.5, px, py); continue; }
        if (pd < 1) {
          if (fFlag(x, z) + (edge - 0.5) * 0.3 < 0.84) {      // flagged approach: big worn slabs with moss in the joints
            const k = ((py % FH) * FW + (px % FW)) * 4; d[i] = fd[k]; d[i + 1] = fd[k + 1]; d[i + 2] = fd[k + 2]; d[i + 3] = 255; continue; }
          // trodden earth: paler along the middle, pebbles, faint ruts
          let t = 3.5 + (1 - pd) * 0.9 + (low - 0.5) * 1.6 + (mid - 0.5) * 1.3 + (h1 - 0.5) * 0.7;
          const pb = hash2(px >> 1, py >> 1, 5); if (pb < 0.016) { put(i, R.stone, (py & 1) ? 3.2 : 6.0, px, py, 0.3); continue; }
          if (hash2(px, py, 6) < 0.02) t -= 1.6;
          put(i, R.dirt, t, px, py); continue;
        }
        if (pd < 1.16) {                           // the ragged shoulder: darker soil, grass creeping in
          if (h2 < (pd - 1) / 0.16 * 0.8) put(i, R.grass, 2.8 + (low - 0.5) * 2 + (h1 - 0.5) * 1.2, px, py); else put(i, R.dirt, 2.3 + (mid - 0.5) * 1.2 + (h1 - 0.5) * 0.8, px, py); continue; }
        // grass: soft large drifts, small clumps, and blade strokes a few dots tall so it never reads as flat fill
        const col = hash2(px, 0, 31), blade = hash2(px, Math.floor((py + col * 7) / (3 + (col * 3 | 0))), 32), clump = HD.vnoise(px / 9, py / 6, 33) + HD.vnoise(px / 3.5, py / 2.5, 34) * 0.5;
        let t = 3.9 + (low - 0.5) * 2.0 + (mid - 0.5) * 1.5 + (clump - 0.75) * 1.5 + (blade - 0.5) * 1.5 + (h1 - 0.5) * 0.4 - out * 1.5;
        if (blade > 0.93) t += 1.3; else if (blade < 0.07) t -= 1.2;
        if (near < 0.55) {                         // bare, damp earth and moss against masonry
          const k = (0.55 - near) / 0.55; if (h1 < k * 0.85) { if (hash2(px >> 1, py >> 1, 7) < 0.4) put(i, R.moss, 1.4 + (mid - 0.5) * 2 + (1 - k) * 1.2, px, py); else put(i, R.dirt, 1.0 + (1 - k) * 1.3 + (mid - 0.5) * 1.2, px, py); continue; }
          t -= k * 1.4; }
        const patch = fPatch(x, z); if (patch > 0.62 && h2 > 0.35) { put(i, R.moss, 2.2 + (patch - 0.62) * 9 + (h1 - 0.5), px, py); continue; }     // clover / moss drifts
        if (patch < 0.3 && h1 < 0.5) t -= 0.9;                                                                                                // thin, dry places
        put(i, R.grass, t, px, py);
      } }
    g.putImageData(im, 0, 0); return c;
  };

  G.build = function (ctx) {
    const L = ctx.L, B = L.BOUNDS, step = 0.5;
    const canvas = G.paint(ctx); G.canvas = canvas;
    const tex = HD.T.fromCanvas(canvas, { clamp: true }); tex.anisotropy = 8;
    const mat = HD.M.make(tex, { mode: 'uv', name: 'ground' });
    const nx = Math.round((B.x1 - B.x0) / step), nz = Math.round((B.z1 - B.z0) / step);
    const geo = new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.max(-40, L.terrain(x, z))); uv.setXY(i, (x - B.x0) / (B.x1 - B.x0), (z - B.z0) / (B.z1 - B.z0)); }
    geo.computeVertexNormals(); HD.K.tint(geo, 1);
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'ground'; ctx.root.add(mesh);
    // the hill beyond the painted area: a coarse apron under the forest
    const R0 = 120, s2 = 3, n2 = Math.round(R0 * 2 / s2), cx = 0, cz = (B.z0 + B.z1) / 2;
    const g2 = new THREE.PlaneGeometry(R0 * 2, R0 * 2, n2, n2); g2.rotateX(-Math.PI / 2); g2.translate(cx, 0, cz); const p2 = g2.attributes.position;
    for (let i = 0; i < p2.count; i++) { const x = p2.getX(i), z = p2.getZ(i); const inside = x > B.x0 + 1 && x < B.x1 - 1 && z > B.z0 + 1 && z < B.z1 - 1; p2.setY(i, Math.max(-40, L.terrain(x, z)) - (inside ? 3 : 0.05)); }
    g2.computeVertexNormals(); HD.K.tint(g2, 0.8);
    const apronTex = HD.T.fromCanvas(HD.T.generators.plain({ ramp: 'grass', base: 2.3, amp: 2.4, seed: 91, w: 128, h: 128 }));
    const apron = new THREE.Mesh(g2, HD.M.make(apronTex, { name: 'apron' })); apron.receiveShadow = true; ctx.root.add(apron);
    return mesh;
  };

  // ------------------------------------------------------------------------------------------------------ walk grid
  // A cell is walkable if it is on a path, a declared walk area or a floor, not inside a block (padded by the hero's
  // radius), and reachable from the spawn without a step higher than STEP.
  G.walkGrid = function (ctx) {
    const L = ctx.L, B = L.BOUNDS, STEP = 0.42, PAD = 0.34;
    const nx = Math.round((B.x1 - B.x0) / CS), nz = Math.round((B.z1 - B.z0) / CS), ok = new Uint8Array(nx * nz), hgt = new Float32Array(nx * nz);
    const inWalk = (x, z) => { for (const w of ctx.walks) { if (w.t === 'r' ? (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) : Math.hypot(x - w.x, z - w.z) <= w.r) return true; } return false; };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = B.x0 + (i + 0.5) * CS, z = B.z0 + (j + 0.5) * CS; hgt[j * nx + i] = ctx.heightAt(x, z);
      if ((ctx.onFloor(x, z) || L.pathDist(x, z) < 1.0 || inWalk(x, z)) && !ctx.blocked(x, z, PAD)) ok[j * nx + i] = 1; }
    const reach = new Uint8Array(nx * nz), cell = (x, z) => { const i = Math.floor((x - B.x0) / CS), j = Math.floor((z - B.z0) / CS); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
    let s = cell(L.SPAWN[0], L.SPAWN[1]);
    if (s < 0 || !ok[s]) { let best = 1e9; for (let k = 0; k < ok.length; k++) if (ok[k]) { const x = B.x0 + (k % nx + 0.5) * CS, z = B.z0 + ((k / nx | 0) + 0.5) * CS, dd = Math.hypot(x - L.SPAWN[0], z - L.SPAWN[1]); if (dd < best) { best = dd; s = k; } } }
    const q = [s]; if (s >= 0) reach[s] = 1;
    while (q.length) { const k = q.pop(), i = k % nx, j = k / nx | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const m = b * nx + a; if (!ok[m] || reach[m] || Math.abs(hgt[m] - hgt[k]) > STEP) continue; reach[m] = 1; q.push(m); } }
    const grid = { nx, nz, reach, hgt, cs: CS, x0: B.x0, z0: B.z0, start: s >= 0 ? [B.x0 + (s % nx + 0.5) * CS, B.z0 + ((s / nx | 0) + 0.5) * CS] : L.SPAWN.slice(),
      can(x, z) { const k = cell(x, z); return k >= 0 && reach[k] === 1; },
      // can the hero move from (x0,z0) to (x1,z1)?
      step(x0, z0, x1, z1) { const k = cell(x1, z1); if (k < 0 || !reach[k]) return false; const k0 = cell(x0, z0); return k0 < 0 || Math.abs(hgt[k] - hgt[k0]) <= STEP; } };
    return grid;
  };
  // debug overlay of the walkable cells
  G.walkOverlay = function (ctx, grid) { const pos = []; for (let j = 0; j < grid.nz; j++) for (let i = 0; i < grid.nx; i++) if (grid.reach[j * grid.nx + i]) pos.push(grid.x0 + (i + 0.5) * grid.cs, grid.hgt[j * grid.nx + i] + 0.08, grid.z0 + (j + 0.5) * grid.cs);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x60ffc0, size: 2.5, sizeAttenuation: false, depthTest: false, fog: false })); m.renderOrder = 999; ctx.root.add(m); return m; };
})();
