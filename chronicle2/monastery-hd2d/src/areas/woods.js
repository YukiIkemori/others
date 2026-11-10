// The forest ring: dark pines (a few broadleaf among them) on the slopes all round the plateau, with shrubs, ferns and
// rough grass on the top of the slope. Everything stands on the terrain, which falls away steeply outside the walls, so
// from the game camera the ring is a wall of treetops below and around the abbey.
//
// Sight lines (the camera looks north, 36 degrees down, so whatever stands south of a thing covers it):
//  - south slope: a tree's top may not rise above the line of sight to the foot of the boundary wall; close under the
//    wall that leaves only shrubs, ferns and young pines, and the tall pines start further down where the ground is lower;
//  - the corridor of the hill steps stays clear (nothing within 4.5 of the stair axis, undergrowth only out to 7);
//  - east and west: trunks start 3.4 outside the walls, so no crown hangs over the plateau.
// Reacts to what the other areas declared (ctx.blocks, ctx.floors, ctx.walks, ctx.plants): nothing is planted on those.
(function () {
  const HD = window.HD; HD.areas = HD.areas || {};
  HD.areas.woods = function (ctx) {
    const V = ctx.V; if (!V) return;
    const L = ctx.L, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const CY = Math.sin(36 * Math.PI / 180), CZ = Math.cos(36 * Math.PI / 180);
    const EDGE = L.WALL_X + 1.2;                       // 28.6: just outside the east / west boundary walls
    const ZS = L.STAIR.zTop;                           // -8.5: the south slope starts here
    const SX = (L.STAIR.x0 + L.STAIR.x1) / 2;          // stair axis
    const TOP = 5.9;                                   // sight-line limit for treetops on the south slope (screen height of the wall foot)
    const ground = (x, z) => Math.max(-40, L.terrain(x, z));
    const steep = (x, z) => Math.hypot(ground(x + 0.6, z) - ground(x - 0.6, z), ground(x, z + 0.6) - ground(x, z - 0.6)) / 1.2;
    const inWalk = (x, z) => { for (const w of ctx.walks) { if (w.t === 'r' ? (x >= w.x0 && x <= w.x1 && z >= w.z0 && z <= w.z1) : Math.hypot(x - w.x, z - w.z) <= w.r) return true; } return false; };
    const clear = (x, z, pad) => !ctx.blocked(x, z, pad) && !ctx.onFloor(x, z) && !ctx.onFloor(x - pad, z) && !ctx.onFloor(x + pad, z) && !ctx.onFloor(x, z - pad) && !ctx.onFloor(x, z + pad) && !inWalk(x, z);
    const asked = ctx.plants.filter(p => p && (p.type === 'tree' || p.type === 'bush'));
    const nearAsked = (x, z, d) => { for (const p of asked) if (Math.hypot(p.x - x, p.z - z) < (p.type === 'tree' ? d : d * 0.45)) return true; return false; };
    // outside-ness of a spot: ex > 0 beyond the east / west walls, sz > 0 on the south slope
    const zone = (x, z) => { const ex = Math.abs(x) - EDGE, sz = z - ZS; return { ex, sz, d: Math.max(ex, sz), south: ex < 1 && sz > 0 }; };

    // ---------------------------------------------------------------------------------------------------- trees
    const r = ctx.rng(4711), trees = [], G = 3.2;
    let nBroad = 0;
    for (let gz = -64; gz <= 47; gz += G) for (let gx = -62; gx <= 62; gx += G) {
      const q1 = r(), q2 = r(), q3 = r(), q4 = r(), q5 = r();          // always five draws a cell, so a change in one place does not reshuffle the rest
      const x = gx + (q1 - 0.5) * G * 0.82, z = gz + (q2 - 0.5) * G * 0.82, zo = zone(x, z);
      if (zo.ex < 0 && zo.sz < 0) continue;                             // the plateau itself
      if (z < L.cliffZ(x) + 1.5) continue;                              // beyond the cliff
      if (zo.sz > -1 && Math.abs(x - SX) < (zo.sz > 14 ? 5.5 : 7)) continue;    // the ride of the hill steps (undergrowth only: see below)
      if (zo.south ? zo.sz < 3.0 : zo.ex < 2.2) continue;               // the strip under the walls belongs to the undergrowth
      // thick close to the walls; the south slope stays thick further down (the view from the foot of the steps looks onto it)
      let p = zo.d < 11 ? 0.84 : zo.d < 20 ? (zo.south ? 0.62 : 0.34) : 0.03 + 0.17 * HD.fbm(x * 0.06, z * 0.06, 77, 2);
      if (z < -50) p *= clamp((z + 66) / 15, 0.12, 1);                  // thinning towards the shoulders by the cliff
      if (q3 > p) continue;
      if (!clear(x, z, 1.7) || nearAsked(x, z, 3.6)) continue;
      const gy = ground(x, z);
      let h = (!zo.south && zo.d < 5) ? 8 + q4 * 3.5 : zo.d < 11 ? 9.5 + q4 * 4.5 : zo.d < 20 ? 11 + q4 * 5 : 12 + q4 * 4, kind = 'pine';
      if (zo.south) { const allowed = (TOP + z * CY) / CZ - gy; if (allowed < 4.8) continue; if (h > allowed) h = allowed * (0.86 + 0.14 * q5); }
      if (zo.d < 10 && h >= 8 && q5 < 0.04 && nBroad < 7) { kind = 'broadleaf'; h = clamp(h * 0.72, 6.5, 9.5); nBroad++; }
      trees.push({ x, y: gy - Math.min(1.1, steep(x, z) * 0.45), z, h, kind, seed: 1000 + trees.length * 7, lean: (q5 - 0.5) * 0.09 });
    }

    // ---------------------------------------------------------------------------------------------- undergrowth
    // shrubs, brambles and ferns on the strip under the walls and beside the steps (low: they never reach the sight line)
    const r2 = ctx.rng(4712), bushes = [], G2 = 2.1;
    for (let gz = -62; gz <= 8; gz += G2) for (let gx = -33; gx <= 33; gx += G2) {
      const q1 = r2(), q2 = r2(), q3 = r2(), q4 = r2(), q5 = r2();
      const x = gx + (q1 - 0.5) * G2 * 0.85, z = gz + (q2 - 0.5) * G2 * 0.85, zo = zone(x, z), ax = Math.abs(x - SX);
      if (zo.ex < 0 && zo.sz < 0.5) continue;
      if (z < L.cliffZ(x) + 2) continue;
      let p = 0;
      if (zo.south) { if (ax < 2.9) continue; p = ax < 7 ? (zo.sz < 13 ? 0.6 : 0) : zo.sz < 7.5 ? 0.5 : zo.sz < 12 ? 0.16 : 0; }
      else p = zo.ex > 0.7 && zo.ex < 3.4 ? 0.36 : zo.ex < 8 ? 0.08 : 0;
      if (q3 > p || !clear(x, z, 1.0) || nearAsked(x, z, 2.5)) continue;
      const kind = q4 < 0.36 ? 'fern' : q4 < 0.76 ? 'shrub' : 'bramble', rad = kind === 'shrub' ? 0.75 + q5 * 0.85 : kind === 'fern' ? 0.65 + q5 * 0.5 : 0.8 + q5 * 0.5;
      bushes.push({ x, y: ground(x, z) - Math.min(0.5, steep(x, z) * rad * 0.3), z, r: rad, kind, seed: 3000 + bushes.length * 5 });
    }

    // rough grass on the top of the slope: it joins the plateau's ground cover to the forest floor
    const r3 = ctx.rng(4713), grass = [], G3 = 0.8;
    for (let gz = -62; gz <= 7; gz += G3) for (let gx = -32; gx <= 32; gx += G3) {
      const q1 = r3(), q2 = r3(), q3 = r3(), q4 = r3();
      const x = gx + (q1 - 0.5) * G3, z = gz + (q2 - 0.5) * G3, zo = zone(x, z);
      if (Math.abs(x) < L.WALL_X + 0.8 && z < L.GATE_Z - 0.55) continue;      // the plateau inside the walls (dressing covers it)
      if (z < L.cliffZ(x) + 1 || (zo.sz > 0 && Math.abs(x - SX) < 2.5)) continue;
      const p = (zo.south ? (zo.sz < 9 ? 0.5 : 0.2) : zo.ex < 4 ? 0.4 : 0) * (0.5 + 0.9 * HD.vnoise(x * 0.6, z * 0.6, 21));
      if (q3 > p || !clear(x, z, 0.3)) continue;
      grass.push({ x, y: ground(x, z), z, s: 0.85 + q4 * 0.45, kind: q4 > 0.68 ? 'tall' : 'tuft' });
    }

    // trees in four big cells (east / west, slope / flanks) so the far side of the ring is culled; the undergrowth and
    // the grass are small enough to go as one batch each (fewer draw calls)
    ctx.add(V.trees(trees, { cell: 62 }));
    if (bushes.length) ctx.add(V.bushes(bushes));
    if (grass.length) ctx.add(V.grass(grass));
    ctx.woods = { trees: trees.length, broadleaf: nBroad, bushes: bushes.length, grass: grass.length, list: trees };
  };
})();
