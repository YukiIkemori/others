// The map's layout (shared numbers every area builds to) and the build context handed to each area: ctx.
(function () {
  const HD = (window.HD = window.HD || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------------------------------------------------- layout
  // Plan coordinates are three.js x (east) and z (south). North is -z. The plateau is level at y = 0.
  const L = (HD.Layout = {
    BOUNDS: { x0: -34, x1: 34, z0: -67, z1: 15 },          // painted ground
    GATE_Z: -10,                                           // boundary wall and gate arch
    STAIR: { x0: -1.75, x1: 1.75, zTop: -8.5, zFoot: 3.5, n: 24, rise: 0.25 },   // hill steps: top (y 0) at z -8.5, each step 0.5 deep, foot y -6 at z 3.5
    NAVE: { x0: -10, x1: 10, z0: -57, z1: -29.6, floor: 0.6, door: 2.6 },        // church walls on these centre lines; door in the south wall (z1) at x 0
    CHANCEL: { z: -51.5, floor: 1.2 },                      // raised east end... here the north end: floor steps up north of this z
    TOWER: { x0: -18.6, x1: -10.6, z0: -58, z1: -50, door: [-14.6, -50] },       // bell tower footprint; door in its south face
    CLOISTER: { x0: -27, x1: -11, z0: -50, z1: -32 },       // garth west of the nave
    POOL: { x: -19, z: -40, r: 3.1 },                       // the spring basin
    RED_TREE: { x: -23.6, z: -43.6 },
    GRAVES_W: { x0: -26, x1: -3, z0: -28, z1: -11.5 },      // graveyard west of the approach
    GRAVES_E: { x0: 3, x1: 26, z0: -56, z1: -11.5 },        // graveyard east of the approach and beside the nave
    MAUSOLEUM: { x: 21.5, z: -18.0, door: [21.5, -15.6] },  // small house tomb; its door is in the SOUTH face
    LOOKOUT: { x0: 12.5, x1: 26, z0: -63.5, z1: -57.5, stand: [18.3, -60.4] },   // flagged terrace on the cliff, north-east
    CLIFF_Z: -62.2,                                         // north edge of the plateau (ragged: see cliffZ)
    WALL_X: 27.4,                                           // east/west boundary walls at x = +-27.4
    SPAWN: [0, -6.2],                                        // on the hill steps, just below the gate
    // footpaths: [points [x,z], half-width, surface]. The hero can only walk on paths and on floors that areas declare.
    PATHS: [
      { id: 'approach', pts: [[0, -8.2], [0, -13], [0.3, -20], [0, -28.4]], w: 1.7, kind: 'flag' },                      // gate -> church door
      { id: 'west', pts: [[0, -22], [-7, -23.6], [-14, -26.5], [-19, -31.2], [-19, -35.2]], w: 1.15, kind: 'dirt' },      // -> cloister gap -> pool
      { id: 'east', pts: [[0, -18], [8, -19], [15, -23.5], [19, -31], [19.5, -44], [18.6, -57.6]], w: 1.15, kind: 'dirt' }, // -> through the graves -> lookout
      { id: 'cloisterDoor', pts: [[-16.2, -36.4], [-13.5, -40], [-10.9, -40]], w: 1.0, kind: 'dirt' },                    // pool -> side door of the nave
      { id: 'tower', pts: [[-19, -35.2], [-23.6, -37.4], [-24.4, -43.6], [-22, -46.0], [-22, -48.7], [-14.6, -48.9], [-14.6, -49.7]], w: 1.0, kind: 'dirt' },  // round the pool -> through the cloister arcade (arch at x -22, z -47.4) -> tower door
      { id: 'mausoleum', pts: [[11.2, -20.6], [15.5, -16.4], [19.2, -13.9], [21.5, -14.1]], w: 0.9, kind: 'dirt' },                     // east path -> round to the mausoleum door
    ],
  });
  // normalised distance to the nearest path (< 1 = on the path), and which path
  L.pathDist = function (x, z, out) { let best = 1e9, which = null;
    for (const p of L.PATHS) { const pts = p.pts; for (let i = 0; i < pts.length - 1; i++) { const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az; const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1); const d = Math.hypot(x - ax - t * dx, z - az - t * dz) / p.w; if (d < best) { best = d; which = p; } } }
    if (out) out.path = which; return best; };
  // the ragged north cliff line: z of the plateau edge at x
  L.cliffZ = x => L.CLIFF_Z - 0.2 + Math.sin(x * 0.41 + 0.7) * 0.55 + Math.sin(x * 1.13) * 0.3 - clamp((x - 11) * 0.5, 0, 1) * clamp((27 - x) * 0.5, 0, 1) * 1.4;
  // terrain height: level plateau with a little roll off the paths, the hill falling away south of the gate and outside the east/west walls,
  // and a sheer drop beyond the north cliff.
  L.terrain = function (x, z) {
    let und = 0.11 * Math.sin(x * 0.33 + 1.3) * Math.cos(z * 0.25 - 0.4) + 0.05 * Math.sin(x * 0.8 - z * 0.6);
    und *= 1 - clamp(1.35 - L.pathDist(x, z), 0, 1);
    const s = Math.max(0, z + 8.4), e = Math.max(0, Math.abs(x) - 28.0), n = Math.max(0, L.cliffZ(x) - z);
    return und - 0.5 * s - 0.012 * s * s - 0.8 * e - 0.07 * e * e - Math.min(60, n * n * 9);
  };

  // ------------------------------------------------------------------------------------------------------------- ctx
  HD.World = { create(scene) {
    const root = new THREE.Group(); root.name = 'world'; scene.add(root);
    const ctx = { scene, root, THREE, K: HD.K, M: HD.M, T: HD.T, P: HD.P, L, rng: HD.rng,
      blocks: [], floors: [], walks: [], lights: [], glows: [], spots: [], zones: [], updaters: [], plants: [] };

    // batch(): collect geometry per material, then build() merges into one mesh per material and adds it to the world.
    ctx.batch = function () { const map = new Map(); const B = {
      add(mat, ...geoms) { if (!mat) throw new Error('batch.add: material is undefined'); let a = map.get(mat); if (!a) map.set(mat, (a = [])); a.push(...geoms.flat(Infinity).filter(Boolean)); return B; },
      build(o) { o = o || {}; const out = []; for (const [mat, gs] of map) { if (!gs.length) continue; const m = new THREE.Mesh(HD.K.merge(gs), mat); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; m.name = o.name || mat.name; (o.parent || root).add(m); out.push(m); } map.clear(); return out; } }; return B; };
    // add(object, {cast, receive}): add any Object3D you built yourself.
    ctx.add = function (obj, o) { o = o || {}; obj.traverse(m => { if (m.isMesh) { if (o.cast !== undefined) m.castShadow = o.cast; if (o.receive !== undefined) m.receiveShadow = o.receive;
      if (m.material && m.material.vertexColors && !m.geometry.attributes.color) HD.K.tint(m.geometry, 1); } }); root.add(obj); return obj; };

    // --- where the hero can and cannot go -------------------------------------------------------------------------
    // Walkable ground = footpaths (Layout.PATHS) + walk areas + floors, minus blocks. Declare everything solid you build.
    ctx.block = {
      rect(x0, z0, x1, z1) { ctx.blocks.push({ t: 'r', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); },
      circle(x, z, r) { ctx.blocks.push({ t: 'c', x, z, r }); },
      seg(ax, az, bx, bz, half) { ctx.blocks.push({ t: 's', ax, az, bx, bz, r: half }); },          // a wall line with half-thickness
    };
    // floor(x0, z0, x1, z1, h): a built, walkable surface at height h (a number, or fn(x, z) for ramps and stairs). Later floors override earlier ones.
    ctx.floor = function (x0, z0, x1, z1, h) { ctx.floors.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h }); };
    // walk(x0, z0, x1, z1): extra walkable ground at terrain height (a clearing, a forecourt). walkCircle(x, z, r) likewise.
    ctx.walk = function (x0, z0, x1, z1) { ctx.walks.push({ t: 'r', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); };
    ctx.walkCircle = function (x, z, r) { ctx.walks.push({ t: 'c', x, z, r }); };
    ctx.heightAt = function (x, z) { for (let i = ctx.floors.length - 1; i >= 0; i--) { const f = ctx.floors[i]; if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return typeof f.h === 'function' ? f.h(x, z) : f.h; } return L.terrain(x, z); };
    ctx.onFloor = function (x, z) { for (let i = ctx.floors.length - 1; i >= 0; i--) { const f = ctx.floors[i]; if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return true; } return false; };
    ctx.blocked = function (x, z, pad) { pad = pad || 0; for (const b of ctx.blocks) {
      if (b.t === 'r') { if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true; }
      else if (b.t === 'c') { if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return true; }
      else { const dx = b.bx - b.ax, dz = b.bz - b.az, t = clamp(((x - b.ax) * dx + (z - b.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (Math.hypot(x - b.ax - t * dx, z - b.az - t * dz) < b.r + pad) return true; } } return false; };

    // --- light, glow, life ----------------------------------------------------------------------------------------
    // light({x,y,z, color, intensity, distance, flicker}): a small warm point light (no shadows). Keep the total under about 10 for the whole map.
    ctx.light = function (o) { const l = new THREE.PointLight(o.color || '#ffb060', o.intensity === undefined ? 1.2 : o.intensity, o.distance || 9, o.decay === undefined ? 1.6 : o.decay); l.position.set(o.x, o.y, o.z); l.userData.base = l.intensity; l.userData.flicker = o.flicker === undefined ? 0.12 : o.flicker; l.userData.phase = ctx.lights.length * 1.7; root.add(l); ctx.lights.push(l); return l; };
    // glow({x,y,z, color, size, strength}): an additive soft halo sprite (lantern glass, candle flame, window, firefly). Cheap; use freely.
    ctx.glow = function (o) { const m = new THREE.SpriteMaterial({ map: HD.T.glow(), color: new THREE.Color(o.color || '#ffb060').convertSRGBToLinear().multiplyScalar(o.strength === undefined ? 1.2 : o.strength), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const s = new THREE.Sprite(m); s.position.set(o.x, o.y, o.z); s.scale.setScalar(o.size || 2); s.userData.base = m.color.clone(); s.userData.flicker = o.flicker === undefined ? 0.1 : o.flicker; s.userData.phase = ctx.glows.length * 2.3; root.add(s); ctx.glows.push(s); return s; };
    // spot({id, x, z, r, label, kind}): a place the hero can interact with; a prompt shows while standing within r. kind 'exit' | 'look' | 'read'.
    ctx.spot = function (o) { ctx.spots.push(o); return o; };
    // camZone({x, z, r, pitch, dist, lift, fall}): inside the circle the camera eases toward this pitch (degrees down), distance and look-at lift.
    ctx.camZone = function (o) { ctx.zones.push(o); return o; };
    // plant(type, {...}): ask for vegetation; a later pass plants it with the vegetation kit. Types and fields:
    //   'tree'  {x, z, kind:'pine'|'broadleaf'|'autumn'|'dead'|'cypress', h, seed, lean}      'bush' {x, z, r, kind:'shrub'|'bramble'|'fern', seed}
    //   'ivy'   {x, y, z, nx, nz, w, h, density, seed}  a patch on a wall face: centre point, outward horizontal normal (nx, nz), width and height
    //   'grass' {x, z, r, n, kind:'tuft'|'tall'|'weed'|'moonflower'|'reed', seed}   n plants scattered within r      'leaves' {x, z, r, n, kind:'autumn'|'dry', y}
    ctx.plant = function (type, o) { ctx.plants.push(Object.assign({ type }, o)); };
    // onUpdate(fn(time, dt)): called every frame (animated water, swaying bell rope, flicker of your own).
    ctx.onUpdate = function (fn) { ctx.updaters.push(fn); };
    return ctx;
  } };
})();
