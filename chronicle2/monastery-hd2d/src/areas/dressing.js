// Planting pass. Runs after every other area, so all blocks, floors, walk areas and plant requests are known.
//  (a) plants everything the areas asked for with ctx.plant (trees, bushes, ivy, grass, leaves), batched per type;
//  (b) adds the plateau's own ground cover: a soft fringe of grass along the outside edge of every footpath (this is
//      what makes the walkable path read), drifts across the open grass, weeds and ferns in the shade at the feet of
//      walls and tombs, a few moonflower drifts in the graveyards and the cloister;
//  (c) falls back to the red tree at L.RED_TREE, with its fallen leaves, if no area asked for it.
// Never on footpaths, floors or walk areas, never inside blocks. Tall grass is kept off the south side of paths, where
// it would stand between the camera and the hero's feet.
(function () {
  const HD = window.HD; HD.areas = HD.areas || {};
  HD.areas.dressing = function (ctx) {
    const V = ctx.V; if (!V) return;
    const L = ctx.L, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const inWalk = (x, z) => { for (const w of ctx.walks) { if (w.t === 'r' ? (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) : Math.hypot(x - w.x, z - w.z) <= w.r) return true; } return false; };
    const trees = [], bushes = [], ivy = [], grass = [], leaves = [];
    const num = v => typeof v === 'number' && isFinite(v);
    const yAt = (p, x, z) => (num(p.y) ? p.y : ctx.heightAt(x, z));

    // ------------------------------------------------------------------------------------------- (a) the requests
    // scatter n items within r of the request; spots inside a block or on a footpath are tried again elsewhere
    // (a request with an explicit y was placed on something on purpose: a pool, a ledge, a bench; it is taken as it is)
    function scatter(p, out, seedSalt) {
      const n = Math.max(1, Math.round(num(p.n) ? p.n : 1)), rad = num(p.r) ? p.r : 0, fixed = num(p.y);
      const rr = ctx.rng((num(p.seed) ? p.seed : 17) * 31 + Math.round(p.x * 13 + p.z * 7) + seedSalt);
      for (let i = 0; i < n; i++) for (let t = 0; t < 6; t++) {
        const a = rr() * 6.2832, d = Math.sqrt(rr()) * rad, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
        if (!fixed && (ctx.blocked(x, z, 0.04) || L.pathDist(x, z) < 1.05)) continue;
        out.push({ x, y: yAt(p, x, z), z, kind: p.kind, s: p.s }); break;
      }
    }
    let hasAutumn = false;
    for (const p of ctx.plants) {
      if (!p || !num(p.x) || !num(p.z)) continue;
      if (p.type === 'tree') { if (p.kind === 'autumn') hasAutumn = true; trees.push({ x: p.x, y: yAt(p, p.x, p.z), z: p.z, h: p.h, kind: p.kind, seed: p.seed, lean: p.lean }); }
      else if (p.type === 'bush') bushes.push({ x: p.x, y: yAt(p, p.x, p.z), z: p.z, r: p.r || 1, kind: p.kind, seed: p.seed });
      else if (p.type === 'ivy') { if (num(p.y) && num(p.w) && num(p.h) && (p.nx || p.nz)) ivy.push({ x: p.x, y: p.y, z: p.z, nx: p.nx || 0, nz: p.nz || 0, w: p.w, h: p.h, seed: p.seed, density: p.density, top: p.top }); }
      else if (p.type === 'grass') scatter(p, grass, 1000);
      else if (p.type === 'leaves') scatter(p, leaves, 2000);
    }
    const askedGrass = grass.length;

    // ---------------------------------------------------------------------------------------- (c) the red tree
    if (!hasAutumn && L.RED_TREE) {
      const t = L.RED_TREE; trees.push({ x: t.x, y: ctx.heightAt(t.x, t.z), z: t.z, h: 8.5, kind: 'autumn', seed: 7 });
      scatter({ x: t.x + 0.8, z: t.z + 1.4, r: 4.6, n: 90, kind: 'autumn', seed: 5 }, leaves, 2000);
    }

    // --------------------------------------------------------------------------------------- (b) ground cover
    const r = ctx.rng(8128), G = 0.42, own = [];
    const X1 = L.WALL_X + 0.8, Z1 = L.GATE_Z - 0.55;          // inside the walls; the slopes outside belong to the woods
    const fernMax = 46; let ferns = 0;
    for (let gz = L.CLIFF_Z - 2.5; gz < Z1; gz += G) for (let gx = -X1; gx < X1; gx += G) {
      const q1 = r(), q2 = r(), q3 = r(), q4 = r(), q5 = r();
      const x = gx + q1 * G, z = gz + q2 * G;
      if (z < L.cliffZ(x) + 0.5) continue;
      const pd = L.pathDist(x, z);
      if (pd < 1.05 || ctx.onFloor(x, z) || inWalk(x, z) || ctx.blocked(x, z, 0.14)) continue;
      const drift = HD.fbm(x * 0.2, z * 0.2, 5, 3), fine = HD.vnoise(x * 1.25, z * 1.25, 9);
      const southOfPath = pd < 2.6 && L.pathDist(x, z - 0.9) < pd - 0.05;      // the path lies just north: keep it low here
      let p, kind;
      if (pd < 1.62) {                                          // the fringe along a path: continuous, never even
        p = (pd < 1.3 ? 0.78 : 0.56) * (0.5 + 0.95 * fine) * (0.75 + 0.5 * drift);
        kind = q4 < 0.08 ? 'weed' : (!southOfPath && drift > 0.5 && q4 > 0.62) ? 'tall' : 'tuft';
      } else if (ctx.blocked(x, z, 0.6)) {                      // the foot of a wall, a tomb, a trunk
        const shade = ctx.blocked(x, z - 0.7, 0.05);            // masonry just to the north: this spot is on its shaded south side
        p = shade ? 0.6 : 0.34;
        kind = q4 < (shade ? 0.62 : 0.4) ? 'weed' : (q4 > 0.84 && !southOfPath) ? 'tall' : 'tuft';
        if (shade && q5 < 0.035 && ferns < fernMax && pd > 1.9) { bushes.push({ x, y: ctx.heightAt(x, z), z, r: 0.5 + q3 * 0.35, kind: 'fern', seed: 5000 + ferns * 3 }); ferns++; continue; }
      } else {                                                  // open grass: drifts with thin places between
        p = drift > 0.57 ? 0.36 : drift > 0.48 ? 0.11 : 0.03;
        kind = (drift > 0.6 && q4 > 0.72 && !southOfPath) ? 'tall' : q4 < 0.05 ? 'weed' : 'tuft';
      }
      if (q3 > p) continue;
      own.push({ x, y: ctx.heightAt(x, z), z, s: (kind === 'tall' ? 0.72 : 0.82) + q5 * 0.4, kind });
    }
    // a few moonflower drifts: graveyards and cloister, away from the ones the areas placed themselves
    const r2 = ctx.rng(8129), askedMoon = ctx.plants.filter(p => p && p.type === 'grass' && p.kind === 'moonflower');
    const okSpot = (x, z) => !ctx.blocked(x, z, 0.25) && !ctx.onFloor(x, z) && !inWalk(x, z) && L.pathDist(x, z) > 1.25;
    const drifts = [];
    for (const [rect, want] of [[L.GRAVES_W, 2], [L.GRAVES_E, 3], [L.CLOISTER, 1]]) {
      if (!rect) continue;
      for (let k = 0, got = 0; k < 40 && got < want; k++) {
        const x = rect.x0 + 1.5 + r2() * (rect.x1 - rect.x0 - 3), z = rect.z0 + 1.5 + r2() * (rect.z1 - rect.z0 - 3);
        if (!okSpot(x, z) || L.pathDist(x, z) < 1.8 || ctx.blocked(x, z, 0.9)) continue;
        if (askedMoon.some(p => Math.hypot(p.x - x, p.z - z) < 3.8) || drifts.some(d => Math.hypot(d[0] - x, d[1] - z) < 9)) continue;
        drifts.push([x, z]); got++;
        const n = 8 + Math.floor(r2() * 6);
        for (let i = 0; i < n; i++) for (let t = 0; t < 5; t++) {
          const a = r2() * 6.2832, d = Math.sqrt(r2()) * 1.5, fx = x + Math.cos(a) * d * 1.3, fz = z + Math.sin(a) * d * 0.8;
          if (!okSpot(fx, fz)) continue;
          own.push({ x: fx, y: ctx.heightAt(fx, fz), z: fz, s: 0.8 + r2() * 0.3, kind: 'moonflower' }); break;
        }
      }
    }
    for (const g of own) grass.push(g);

    // ------------------------------------------------------------------------------------------------ plant it
    if (trees.length) ctx.add(V.trees(trees));
    if (bushes.length) ctx.add(V.bushes(bushes));
    if (ivy.length) ctx.add(V.ivy(ivy, { cell: 40 }));
    if (grass.length) ctx.add(V.grass(grass, { cell: 36 }));
    if (leaves.length) ctx.add(V.leaves(leaves));
    ctx.dressing = { trees: trees.length, bushes: bushes.length, ivy: ivy.length, grass: grass.length, askedGrass, ownGrass: own.length, ferns, leaves: leaves.length, drifts: drifts.length };
  };
})();
