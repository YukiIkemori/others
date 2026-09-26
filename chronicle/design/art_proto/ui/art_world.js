// World field (night overworld) and dungeon (潮鳴りの洞窟) for the mocks, using the TOPDOWN kit.
'use strict';
(function (G) {
  const { mix, clamp, rng, vnoise, ramp } = G.RZ;
  const TD = G.TOPDOWN, TS = TD.TS, P = TD.P, pick = TD.pick, H3 = TD.H3;
  const mk = ENV.mk;

  const Q = {
    rock: ramp(['#1a1820', '#2c2934', '#423e4a', '#5a5462', '#76707c', '#948c96'], 8),
    rockTop: ramp(['#08080e', '#0e0e16', '#16161f', '#1e1e28', '#282833'], 6),
    caveFloor: ramp(['#1a1c22', '#2a2c34', '#3c3e48', '#50525c', '#666872'], 8),
    sand: ramp(['#3a3226', '#5a4e3a', '#7a6c50', '#9a8a68', '#b8a682'], 7),
    road: ramp(['#2a2016', '#403222', '#584632', '#705a42', '#8a7254'], 7),
    grassDk: ramp(['#101c0c', '#1a2c12', '#26401a', '#345424', '#466a30'], 7),
    cliff: ramp(['#1a1614', '#2c2622', '#403832', '#564c44', '#6e6258', '#8a7c6e'], 8),
  };
  function faceAt(x, y, e, h, seed, R) {
    // rock face: vertical cracks, strata, darker toward the bottom, lit lip at the top
    const n = vnoise(x * 0.12, y * 0.03, seed), c2 = vnoise(x * 0.5, y * 0.08, seed + 1), st = vnoise(x * 0.04, y * 0.4, seed + 2);
    let l = 0.55 + (n - 0.5) * 0.4 + (st - 0.5) * 0.2 - (e / h) * 0.35;
    if (c2 > 0.78) l -= 0.3; if (e < 3) l += 0.3 - e * 0.08;
    return pick(R, l);
  }

  // ================================================================== DUNGEON
  const DUN = [
    '##############################',
    '##############################',
    '#####.......#####......#######',
    '####.........###........######',
    '###.....o.....~~~.........####',
    '###..........~~~~~.........###',
    '##............~~~~.....c....##',
    '##.......................#..##',
    '###.....................##..##',
    '####..........######.......###',
    '####.........#######........##',
    '###..C........~~~............#',
    '##...........~~~~~.....o.....#',
    '##...........~~~~.......d....#',
    '###..........................#',
    '####.......#####.............#',
    '#####.....#######...........##',
    '######....########.........###',
    '#######...#########.......####',
    '#######....#######.......#####',
    '########....#####.......######',
    '########.....~~~........######',
    '#######.....~~~~~.......######',
    '######......~~~~.....o...#####',
    '######...................#####',
    '#######..........c......######',
    '########...............#######',
    '##########..........##########',
    '###########........###########',
    '############......############',
    '############......############',
    '############......############',
    '##############################',
  ];
  function dunTile(tx, ty) { const r = DUN[ty]; if (!r || tx < 0 || tx >= r.length) return '#'; const c = r[tx]; return c === '#' || c === '~' ? c : '.'; }
  const dunCache = {};
  function dungeon() {
    if (dunCache.c) return dunCache;
    const Wt = 30, Ht = DUN.length, W = Wt * TS, H = Ht * TS, buf = new TD.Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const jx = x + (vnoise(x * 0.07, y * 0.07, 3) - 0.5) * 16, jy = y + (vnoise(x * 0.07, y * 0.07, 4) - 0.5) * 12;
      const tr = dunTile(Math.floor(x / TS), Math.floor(y / TS)), tj = dunTile(Math.floor(jx / TS), Math.floor(jy / TS));
      const t = tr === '#' ? '#' : (tj === '#' ? '.' : tj);
      let c;
      if (t === '#') {
        // ceiling rock seen from above: very dark, subtle lumps
        const l = 0.45 + (vnoise(x * 0.05, y * 0.05, 7) - 0.5) * 0.5 + (vnoise(x * 0.3, y * 0.3, 8) - 0.5) * 0.2;
        c = pick(Q.rockTop, l);
        // rim where the rock top meets open floor at the sides
        const tx = Math.floor(x / TS), ty = Math.floor(y / TS), ex = x - tx * TS;
        if ((ex < 3 && dunTile(tx - 1, ty) !== '#') || (ex > TS - 4 && dunTile(tx + 1, ty) !== '#')) c = pick(Q.rock, 0.55);
        if (ty > 0 && y - ty * TS < 3 && dunTile(tx, ty - 1) !== '#') c = pick(Q.rock, 0.5);
      } else if (t === '~') {
        const n = vnoise(x * 0.04, y * 0.07, 9), r = vnoise(x * 0.1, y * 0.4, 10);
        c = mix([8, 30, 44], [20, 70, 84], n * 0.8); if (r > 0.72) c = mix(c, [120, 230, 230], 0.35);
      } else {
        // wet slab floor: large flat stones + puddle sheen + moss
        const cb = TD.cobbleAt(x, y, { cw: 30, ch: 20, ramp: Q.caveFloor, mortar: [14, 14, 18], flat: true });
        const f = 0.46 + (vnoise(x * 0.03, y * 0.04, 14) - 0.5) * 0.35 + (vnoise(x * 0.12, y * 0.12, 15) - 0.5) * 0.2 + (vnoise(x * 0.5, y * 0.5, 16) - 0.5) * 0.12;
        c = pick(Q.caveFloor, f);
        if (cb[0] === 14 && cb[2] === 18) c = mix(c, [10, 10, 16], 0.6); else c = mix(c, cb, 0.3);
        if (TD.H3(x >> 1, y >> 1, 17) > 0.985) c = pick(Q.caveFloor, 0.9);
        if (vnoise(x * 0.05, y * 0.05, 12) > 0.66) c = mix(c, [30, 60, 50], 0.4);
        if (vnoise(x * 0.04, y * 0.06, 13) > 0.75) c = mix(c, [60, 80, 110], 0.3);
      }
      const q = (y * W + x) * 4; buf.d[q] = c[0]; buf.d[q + 1] = c[1]; buf.d[q + 2] = c[2]; buf.d[q + 3] = 255;
    }
    // wall front faces: rock tiles with floor below get a 1-tile face drawn over the floor tile top
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      if (dunTile(tx, ty) !== '#' || dunTile(tx, ty + 1) === '#') continue;
      const x0 = tx * TS, y0 = (ty + 1) * TS - 6, h = 40;
      buf.fill(x0, y0, x0 + TS, y0 + h, (x, y) => { const lip = vnoise(x * 0.2, 0, 21) * 5; const e = y - y0 - lip; if (e < 0) return null; return faceAt(x, y, e, h, 22, Q.rock); });
      // floor AO under the face
      for (let x = x0; x < x0 + TS; x++) for (let k = 0; k < 10; k++) buf.set(x, y0 + h + k, [4, 4, 10], 0.55 * (1 - k / 10));
    }
    // pool rims
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) if (dunTile(tx, ty) === '~' && dunTile(tx, ty - 1) !== '~') {
      buf.fill(tx * TS, ty * TS - 2, tx * TS + TS, ty * TS + 6, (x, y) => { const e = y - ty * TS + 2; return e < 3 ? pick(Q.caveFloor, 0.8) : mix(buf.get(x, y), [2, 6, 12], 0.5); });
    }
    const c = buf.done(), ctx = c.getContext('2d');
    const list = [];
    const L = BATTLE_ART.LOOKS;
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      const ch = DUN[ty][tx];
      if (ch === 'o') TD.place(list, 'crystal', tx + 0.5, ty + 0.8, { seed: tx * 3 + ty });
      if (ch === 'c') TD.place(list, 'chest', tx + 0.5, ty + 0.8);
      if (ch === 'C') TD.place(list, 'chest', tx + 0.5, ty + 0.8, { open: true });
    }
    // healing spring (WORLD_REDESIGN §6.2) and torches on wall faces
    TD.place(list, 'spring', 9.5, 8.9, { scale: 1.25 });
    [[7.5, 2.3], [20.5, 2.3], [15.5, 10.2], [18.5, 10.2], [3.5, 15.3], [26.5, 7.3], [9.5, 14.3]].forEach(([x, y]) => TD.place(list, 'torch', x, y + 0.7));
    [[4.3, 5.5, 9], [27.2, 10.5, 12], [11.4, 14.6, 8], [19.6, 7.9, 10], [22, 16.6, 9]].forEach(([x, y, s], i) => TD.place(list, 'rock', x, y, { s, seed: i + 3, moss: i % 2 === 0 }));
    // stairs down
    const dx = 24 * TS, dy = 13 * TS;
    { const g = ctx.createRadialGradient(dx + 16, dy + 16, 2, dx + 16, dy + 16, 26); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(dx - 12, dy - 12, 56, 56);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgb(${60 - i * 12},${62 - i * 12},${70 - i * 12})`; ctx.fillRect(dx + 2 + i * 2, dy + 4 + i * 6, 28 - i * 4, 4); } }
    // party near the spring
    TD.person(list, L.arun, 'left', 0, 12.1, 8.9, { lantern: true, ldx: -4 });
    TD.person(list, L.selma, 'left', 1, 13.1, 8.9); TD.person(list, L.sylvan, 'left', 2, 14.1, 8.9); TD.person(list, L.viola, 'left', 0, 15.1, 8.9);
    const { lights, emits } = TD.composeScene(ctx, list, []);
    // pools glow faintly (bioluminescence)
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) if (dunTile(tx, ty) === '~' && H3(tx, ty, 5) > 0.5) lights.push({ x: tx * TS + 16, y: ty * TS + 16, r: 48, c: [60, 200, 200], k: 0.35 });
    TD.lightmap(ctx, W, H, 'rgb(46,54,92)', lights);
    TD.drawEmissive(ctx, emits);
    // spring: a column of light and rising motes
    { const sx = 9.5 * TS, sy = 8.9 * TS - 24; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, sy - 90, 0, sy); g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(1, 'rgba(120,230,255,0.35)'); ctx.fillStyle = g; ctx.fillRect(sx - 8, sy - 90, 16, 90); ctx.restore();
      const R = rng(4); for (let i = 0; i < 16; i++) { const x = sx + (R() - 0.5) * 30, y = sy - R() * 80; ENV.glow(ctx, x, y, 5, [160, 240, 255], 0.6); } }
    // glowing algae specks on the pools
    { const R = rng(9); for (let i = 0; i < 400; i++) { const x = R() * W, y = R() * H; if (dunTile(Math.floor(x / TS), Math.floor(y / TS)) !== '~') continue; ctx.fillStyle = `rgba(140,255,240,${0.3 + R() * 0.5})`; ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1); } }
    TD.fireflies(ctx, W, H, 30, 5, [[120, 240, 230], [180, 150, 255]]);
    Object.assign(dunCache, { c, W, H });
    return dunCache;
  }

  // ================================================================== WORLD FIELD
  const WLD = [
    'hhhhhhhhhhhhggfff~~fffggvvvvvvvfff',
    'hhhfhhhfhhhhgggff~~ffggvvvvvvvvvff',
    'hhffhhhhhhhhggggf~~fgggvvvvvvvvvgf',
    'hhfhhhhhhhhhggggg~~ggggvvvvvvvvvgg',
    'hhhhhhhhhhhhgggggg~~gggvvvvvvvvvgg',
    'hhhhhhhhhrhhhggggg~~ggggggrgggggff',
    'hhhhhhhhhrhhhgggggg~~gggggrggggfff',
    'gggggggggrgggggggggg~~ggggrggggfff',
    'ggfffggggrgggggggggg~~ggggrgggggff',
    'gfffffgggrrrrrrrrrrrbbrrrrrgggggff',
    'gfffffggggggggggggggg~~ggggrgggsss',
    'ggffffgggggggggggggggg~~gggrrgss~~',
    'gggfgggggggggggggfffgg~~ggggrrs~~~',
    'ggggggggggggggggffffggg~~gggsss~~~',
    'gggggggggggggggggffggggs~~sskkk~~~',
    'ffggggggggggggggggggggss~~~sskkk~~',
    'fffgggggggggggggggggss~~~~~~~kk~~~',
    'ffffgggggggggggggggs~~~~~~~~~~~~~~',
    'fffffggggggggggggss~~~~~~~~~~~~~~~',
    'ffffffgggggggggss~~~~~~~~~~~~~~~~~',
    'fffffgggggggggss~~~~~~~~~~~~~~~~~~',
    'ffffgggggggggss~~~~~~~~~~~~~~~~~~~',
    'fffggggggggggs~~~~~~~~~~~~~~~~~~~~',
    'ffgggggggggss~~~~~~~~~~~~~~~~~~~~~',
    'fgggggggggss~~~~~~~~~~~~~~~~~~~~~~',
    'fggggggggss~~~~~~~~~~~~~~~~~~~~~~~',
    'ggggggggss~~~~~~~~~~~~~~~~~~~~~~~~',
    'gggggggss~~~~~~~~~~~~~~~~~~~~~~~~~',
    'ggggggss~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'gggggss~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'ggggss~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'gggss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'ggss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'gss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    'ss~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    's~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ];
  function wT(tx, ty) { const r = WLD[Math.max(0, Math.min(WLD.length - 1, ty))]; return r[Math.max(0, Math.min(r.length - 1, tx))]; }
  const wCache = {};
  function world() {
    if (wCache.c) return wCache;
    const Wt = 34, Ht = WLD.length, W = Wt * TS, H = Ht * TS, buf = new TD.Buf(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const jx = x + (vnoise(x * 0.06, y * 0.06, 31) - 0.5) * 22, jy = y + (vnoise(x * 0.06, y * 0.06, 32) - 0.5) * 18;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS), t = wT(tx, ty), tj = wT(Math.floor(jx / TS), Math.floor(jy / TS));
      let c;
      const soft = tj === 'k' ? 'k' : (t === 'b' ? 'b' : tj);
      if (soft === '~') { c = TD.waterAt(x, y); }
      else if (soft === 'b') c = TD.plankAt(x, y, false);
      else if (soft === 's') c = pick(Q.sand, 0.5 + (vnoise(x * 0.1, y * 0.1, 5) - 0.5) * 0.4 + (vnoise(x * 0.8, y * 0.8, 6) - 0.5) * 0.15);
      else if (soft === 'k') c = pick(Q.cliff, 0.45 + (vnoise(x * 0.12, y * 0.12, 7) - 0.5) * 0.6);
      else if (soft === 'r') { const n = vnoise(x * 0.3, y * 0.3, 8); c = pick(Q.road, 0.5 + (n - 0.5) * 0.4); if (H3(x >> 1, y >> 1, 3) > 0.985) c = [150, 140, 120]; }
      else if (soft === 'v') c = TD.cobbleAt(x, y, { flat: true });
      else if (soft === 'h') c = pick(Q.grassDk, 0.45 + (vnoise(x * 0.06, y * 0.06, 21) - 0.5) * 0.4 + (vnoise(x * 0.9, y * 0.35, 22) - 0.5) * 0.3);
      else { c = TD.grassAt(x, y); c = mix(c, [c[1] * 0.7, c[1] * 0.78, c[1] * 0.9], 0.45); if (soft === 'f') c = mix(c, [6, 14, 8], 0.4); }
      // shore foam
      if (soft === '~' && wT(Math.floor(x / TS), Math.floor((y - 6) / TS)) !== '~' && vnoise(x * 0.2, y * 0.2, 9) > 0.4) c = mix(c, [140, 170, 190], 0.4);
      const q = (y * W + x) * 4; buf.d[q] = c[0]; buf.d[q + 1] = c[1]; buf.d[q + 2] = c[2]; buf.d[q + 3] = 255;
    }
    // plateau cliff faces
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      if (wT(tx, ty) !== 'h' || wT(tx, ty + 1) === 'h') continue;
      const x0 = tx * TS, y0 = (ty + 1) * TS - 2, h = 34;
      buf.fill(x0, y0, x0 + TS, y0 + h, (x, y) => { const lip = vnoise(x * 0.15, 0, 41) * 6; const e = y - y0 - lip; if (e < -2) return null; if (e < 1) return pick(P.grass, 0.55); return faceAt(x, y, e, h, 42, Q.cliff); });
      for (let x = x0; x < x0 + TS; x++) for (let k = 0; k < 10; k++) buf.set(x, y0 + h + k, [4, 6, 10], 0.5 * (1 - k / 10));
    }
    // road: ramp through the cliff (x 9)
    buf.fill(9 * TS + 4, 7 * TS - 2, 10 * TS - 4, 8 * TS + 2, (x, y) => pick(Q.road, 0.55 - ((y - 7 * TS) % 6 < 2 ? 0.2 : 0)));
    // river banks + bridge rails
    const c = buf.done(), ctx = c.getContext('2d');
    const list = [];
    for (let ty = 0; ty < Ht; ty++) for (let tx = 0; tx < Wt; tx++) {
      const t = wT(tx, ty), R = rng(tx * 131 + ty * 17);
      if (t === 'f' || (t === 'h' && R() < 0.22)) {
        const n = t === 'f' ? 2 : 1;
        for (let k = 0; k < n; k++) TD.place(list, R() < 0.65 ? 'pine' : 'tree', tx + 0.2 + R() * 0.6, ty + 0.4 + R() * 0.55, { h: 44 + Math.floor(R() * 4) * 8, seed: Math.floor(R() * 4) + 1 });
      } else if (t === 'g' && R() < 0.05) TD.place(list, 'bush', tx + 0.5, ty + 0.7, { seed: Math.floor(R() * 5) });
      else if (t === 'g' && R() < 0.03) TD.place(list, 'rock', tx + 0.5, ty + 0.7, { s: 6 + Math.floor(R() * 3) * 2, seed: Math.floor(R() * 5), moss: true });
    }
    // village (small houses), palisade lamps
    const blds = [
      { name: 'v1', tx: 23, ty: 0, tw: 4, th: 3, wall: 1, roof: 'terra', mat: 'plaster', door: { x: 64, h: 18 }, windows: [26, 104], winY: 6, chimney: 90, small: true },
      { name: 'v2', tx: 28, ty: 0, tw: 4, th: 3, wall: 1, roof: 'slate', mat: 'stone', door: { x: 40, h: 18 }, windows: [96], winY: 6, small: true },
      { name: 'v3', tx: 24, ty: 3, tw: 3, th: 2, wall: 1, roof: 'slate', mat: 'plaster', door: { x: 48, h: 18 }, windows: [20, 76], winY: 6, small: true, lamp: false },
      { name: 'v4', tx: 28, ty: 3, tw: 4, th: 2, wall: 1, roof: 'terra', mat: 'plank', door: { x: 90, h: 18 }, windows: [30], winY: 6, small: true },
    ].map(TD.building);
    [[25.8, 5.3], [27.2, 5.3], [22.5, 2.2], [32.5, 3.8]].forEach(([x, y]) => TD.place(list, 'lamp', x, y));
    // lanterns along the road (milestones), the campsite, the ruined tower, the lighthouse
    [[6, 9.9], [14, 9.9], [19.2, 8.9], [23.6, 8.9], [28.4, 11.9]].forEach(([x, y]) => TD.place(list, 'torch', x, y, { scale: 1.3 }));
    TD.place(list, 'tent', 5.2, 3.6); TD.place(list, 'torch', 6.8, 3.9, { scale: 1.1 });
    TD.place(list, 'tower', 6.5, 14.3); TD.place(list, 'lighthouse', 30.5, 16.1);
    // party on the road
    const L = BATTLE_ART.LOOKS;
    TD.person(list, L.arun, 'right', 1, 16.6, 9.75, { lantern: true, ldx: 8 });
    TD.person(list, L.selma, 'right', 2, 15.6, 9.75); TD.person(list, L.sylvan, 'right', 0, 14.6, 9.75); TD.person(list, L.viola, 'right', 1, 13.6, 9.75);
    const { lights, emits, moonMask } = TD.composeScene(ctx, list, blds);
    lights.push({ x: 6.8 * TS, y: 3.9 * TS, r: 90, c: [255, 170, 90], k: 0.8 });
    TD.lightmap(ctx, W, H, 'rgb(66,80,142)', lights, moonMask);
    // sea: moon glitter band + lighthouse beam
    const isW = (x, y) => wT(Math.floor(x / TS), Math.floor(y / TS)) === '~';
    TD.moonWater(ctx, W, H, isW, [], 11);
    { const R = rng(2); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 900; i++) { const y = 9 * TS + R() * (H - 9 * TS), x = 25 * TS + (R() - 0.5) * (80 + (y - 9 * TS) * 0.12); if (!isW(x, y)) continue; ctx.fillStyle = `rgba(200,215,255,${0.15 + R() * 0.35})`; ctx.fillRect(Math.floor(x), Math.floor(y), 2 + Math.floor(R() * 6), 1); } ctx.restore(); }
    TD.drawEmissive(ctx, emits);
    { const lx = 30.5 * TS, ly = 16.1 * TS - 78; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const beam = (a, len, w, k) => { const g = ctx.createLinearGradient(lx, ly, lx + Math.cos(a) * len, ly + Math.sin(a) * len); g.addColorStop(0, `rgba(255,236,190,${k})`); g.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a - w) * len, ly + Math.sin(a - w) * len); ctx.lineTo(lx + Math.cos(a + w) * len, ly + Math.sin(a + w) * len); ctx.closePath(); ctx.fill(); };
      ctx.filter = 'blur(3px)'; beam(Math.PI * 0.94, 760, 0.075, 0.28); beam(Math.PI * 0.94, 520, 0.03, 0.22); ctx.restore(); ENV.glow(ctx, lx, ly, 40, [255, 230, 170], 0.9); }
    // glow mushrooms in the forest, fireflies over the meadow
    { const R = rng(6); for (let i = 0; i < 260; i++) { const x = R() * W, y = R() * H, t = wT(Math.floor(x / TS), Math.floor(y / TS)); if (t !== 'f' && t !== 'h') continue; const cy = R() < 0.7; ENV.glow(ctx, x, y, 7, cy ? [110, 240, 230] : [190, 150, 255], 0.55); ctx.fillStyle = cy ? '#aef8f0' : '#dcc8ff'; ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1); } }
    TD.fireflies(ctx, W, H, 60, 3);
    Object.assign(wCache, { c, W, H });
    return wCache;
  }

  // extra props used by the world
  Object.assign(TD, { dungeon, world, dunTile, wT });
})(window);
