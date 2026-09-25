// Context tiles for local maps: R.Art.localTile(map, x, y).
// Looks at the neighbours to draw what a single tile id cannot:
//  * walls in 3/4 view — a face (with a lit cap when the floor is behind it)
//    where the wall meets walkable ground below, a top surface inside thick walls
//  * houses — roof ridge / eaves / gable edges, facades with windows, eave shadow
//  * carpets with gold borders, water/lava/poison with banks
//  * furniture on the floor it actually stands on; counters, tables, beds and
//    fences that join with their neighbours
//  * soft wall shadows on the floor and grass fringes along paths
// Returns a canvas / frame array (cached per context signature) or null to let
// the caller use the plain 'tile:<theme>:<id>' / 'tile:<id>'.
// Map contract: map.tileAt(x, y) → tile id (outside → map.outside), map.theme.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;

  const WALL = { wall: 1, wall_torch: 1, door: 1, door_silver: 1, door_gold: 1 };
  const HOUSE = { housewall: 1, roof: 1 };
  // tiles that stand up and cast a shadow on the ground south/east of them
  const TALL = { wall: 1, wall_torch: 1, door: 1, door_silver: 1, door_gold: 1, housewall: 1, roof: 1, bookshelf: 1, shelf: 1, pillar: 1, statue: 1, tree: 1 };
  const GROUND = { floor: 1, lgrass: 1, dirt: 1, wood: 1, carpet: 1, sand: 1, snowfloor: 1, ice: 1, flowers: 1 };
  const GRASSY = { lgrass: 1, flowers: 1 };
  const LIQUID = { water: 4, lava: 2, poison: 2 };
  const JOIN = { counter: 1, table: 1, bed: 1, fence: 1 };
  const ANIM_OBJ = { warp_pad: 4, seal: 2, lbridge_h: 4, lbridge_v: 4 };

  const CACHE = new Map();
  function cached(key, make) {
    let v = CACHE.get(key);
    if (v === undefined) { v = make(); CACHE.set(key, v); }
    return v;
  }
  const canvas = (b) => b.toCanvas();

  /** floor Buf name for a ground tile id on a themed map */
  function groundName(id, theme) {
    if (id === 'floor') return 'theme:' + (theme || 'generic');
    if (id === 'flowers') return 'lgrass';
    return id;
  }
  /** the ground an object stands on: weighted vote of the neighbours */
  function underGround(m, x, y) {
    const score = {};
    const vote = (dx, dy, w) => {
      let id = m.tileAt(x + dx, y + dy);
      if (!GROUND[id]) return;
      if (id === 'flowers') id = 'lgrass';
      score[id] = (score[id] || 0) + w;
    };
    vote(0, 1, 3); vote(-1, 0, 2); vote(1, 0, 2); vote(0, -1, 1.5);
    vote(-1, 1, 0.5); vote(1, 1, 0.5); vote(-1, -1, 0.25); vote(1, -1, 0.25);
    let best = null, bs = 0;
    for (const k in score) if (score[k] > bs) { bs = score[k]; best = k; }
    return best || (m.theme ? 'floor' : 'wood');
  }

  // ------------------------------------------------------------ ground
  /** shadows from tall neighbours (north / west / north-west) + grass fringe */
  function groundTile(m, x, y, id, theme) {
    const n = TALL[m.tileAt(x, y - 1)] ? 1 : 0;
    const w = TALL[m.tileAt(x - 1, y)] ? 1 : 0;
    const nw = TALL[m.tileAt(x - 1, y - 1)] ? 1 : 0;
    let fringe = '';
    if (!GRASSY[id] && id !== 'carpet' && id !== 'wood') {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) fringe += GRASSY[m.tileAt(x + dx, y + dy)] ? '1' : '0';
    } else fringe = '0000';
    let carpet = '';
    if (id === 'carpet') {
      const c = (dx, dy) => (m.tileAt(x + dx, y + dy) === 'carpet' || m.tileAt(x + dx, y + dy) === 'throne' ? '1' : '0');
      carpet = c(0, -1) + c(0, 1) + c(-1, 0) + c(1, 0) + c(-1, -1) + c(1, -1) + c(-1, 1) + c(1, 1);
    }
    if (!n && !w && !nw && fringe === '0000' && (!carpet || carpet === '11111111')) return null;
    const key = 'g|' + id + '|' + theme + '|' + n + w + nw + '|' + fringe + '|' + carpet;
    return cached(key, () => {
      const t = tk();
      const b = A.floorBuf(groundName(id, theme)).clone();
      if (carpet) carpetBorder(b, carpet);
      if (fringe !== '0000') grassFringe(b, fringe);
      // soft shadow: 3 rows under a wall to the north, 2 columns east of a west wall
      if (n) for (let x0 = 0; x0 < 16; x0++) { b.set(x0, 0, t.mul(b.get(x0, 0), 0.58)); b.set(x0, 1, t.mul(b.get(x0, 1), 0.7)); if ((x0 + y) % 2) b.set(x0, 2, t.mul(b.get(x0, 2), 0.85)); }
      if (w) for (let y0 = n ? 3 : 0; y0 < 16; y0++) { b.set(0, y0, t.mul(b.get(0, y0), 0.7)); if (y0 % 2) b.set(1, y0, t.mul(b.get(1, y0), 0.85)); }
      if (nw && !n && !w) { b.set(0, 0, t.mul(b.get(0, 0), 0.6)); b.set(1, 0, t.mul(b.get(1, 0), 0.75)); b.set(0, 1, t.mul(b.get(0, 1), 0.75)); }
      return canvas(b);
    });
  }
  function carpetBorder(b, c) {
    const G = [0x8c6414, 0xe0b430, 0xf8dc60];
    const [N, S, W, E, NW, NE, SW, SE] = c.split('').map(Number);
    const edge = (x, y, k) => b.set(x, y, G[k]);
    for (let i = 0; i < 16; i++) {
      if (!N) { edge(i, 0, 0); edge(i, 1, 2); edge(i, 2, 1); }
      if (!S) { edge(i, 15, 0); edge(i, 14, 1); edge(i, 13, 2); }
      if (!W) { edge(0, i, 0); edge(1, i, 2); edge(2, i, 1); }
      if (!E) { edge(15, i, 0); edge(14, i, 1); edge(13, i, 2); }
    }
    // inner corners where the diagonal is not carpet
    if (N && W && !NW) { edge(0, 0, 0); edge(1, 0, 2); edge(0, 1, 2); edge(2, 0, 1); edge(0, 2, 1); edge(1, 1, 1); }
    if (N && E && !NE) { edge(15, 0, 0); edge(14, 0, 2); edge(15, 1, 1); edge(13, 0, 1); edge(15, 2, 1); edge(14, 1, 1); }
    if (S && W && !SW) { edge(0, 15, 0); edge(1, 15, 1); edge(0, 14, 2); edge(0, 13, 1); edge(2, 15, 1); edge(1, 14, 1); }
    if (S && E && !SE) { edge(15, 15, 0); edge(14, 15, 1); edge(15, 14, 1); edge(15, 13, 1); edge(13, 15, 1); edge(14, 14, 1); }
  }
  function grassFringe(b, f) {
    const t = tk(), G = t.PAL.tgrass;
    const [N, S, W, E] = f.split('').map(Number);
    for (let i = 0; i < 16; i++) {
      const depth = 1 + Math.round(t.vnoise(i, 0, 4, 16, 211) * 2.4);
      if (N) for (let d = 0; d < depth; d++) b.set(i, d, d === depth - 1 ? G[2] : G[3]);
      if (S) { const dd = 1 + Math.round(t.vnoise(i, 0, 4, 16, 213) * 1.6); for (let d = 0; d < dd; d++) b.set(i, 15 - d, d === dd - 1 ? G[4] : G[3]); }
      if (W) { const dd = 1 + Math.round(t.vnoise(0, i, 4, 16, 215) * 2.2); for (let d = 0; d < dd; d++) b.set(d, i, d === dd - 1 ? G[2] : G[3]); }
      if (E) { const dd = 1 + Math.round(t.vnoise(0, i, 4, 16, 217) * 2.2); for (let d = 0; d < dd; d++) b.set(15 - d, i, d === dd - 1 ? G[2] : G[3]); }
    }
  }

  // ------------------------------------------------------------ walls
  const wallish = (id) => !!WALL[id] || id === 'void';
  function wallTile(m, x, y, id, theme) {
    const up = m.tileAt(x, y - 1), down = m.tileAt(x, y + 1);
    const l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    if (wallish(down)) {
      // interior of a thick wall: top surface, outlined where it meets floor
      const e = { n: !wallish(up), w: !wallish(l), e: !wallish(r) };
      const key = 'wt|' + theme + '|' + +e.n + +e.w + +e.e;
      return cached(key, () => canvas(A.wallTop(theme, e)));
    }
    const cap = !wallish(up);
    if (id === 'wall_torch') {
      return cached('wf|' + theme + '|' + cap + '|torch', () => tk().frames(2, (f) => { const b = A.wallFace(theme, cap); A.drawTorch(b, f); return b; }));
    }
    return cached('wf|' + theme + '|' + cap, () => canvas(A.wallFace(theme, cap)));
  }
  function doorTile(m, x, y, id, theme) {
    const up = m.tileAt(x, y - 1), l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    if (l === 'housewall' || r === 'housewall') {
      const eave = up === 'roof';
      const cap = !eave && up !== 'housewall';
      return cached('hd|' + id + '|' + eave + cap, () => canvas(A.drawDoor(A.houseWallArt({ eave, capTop: cap, plain: true }), id, eave ? 3 : 2, 'wood')));
    }
    const cap = !wallish(up) && !HOUSE[up];
    return cached('wd|' + theme + '|' + id + '|' + cap, () => canvas(A.doorArt(theme, id, cap)));
  }

  // ------------------------------------------------------------ houses
  function houseWallTile(m, x, y) {
    const up = m.tileAt(x, y - 1), down = m.tileAt(x, y + 1);
    const l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    const hw = (id) => id === 'housewall' || id === 'door' || id === 'door_silver' || id === 'door_gold';
    if (down === 'housewall') {
      const e = { n: !(hw(up) || up === 'roof'), w: !hw(l), e: !hw(r) };
      return cached('hwt|' + +e.n + +e.w + +e.e, () => canvas(A.houseWallArt({ top: true, edges: e })));
    }
    const eave = up === 'roof';
    const cap = !eave && up !== 'housewall';
    // windows on alternate facade cells, never right beside a door
    const nearDoor = /^door/.test(l) || /^door/.test(r);
    const window = !nearDoor && (x % 3 !== 0);
    return cached('hwf|' + eave + cap + window, () => canvas(A.houseWallArt({ eave, capTop: cap, window })));
  }
  function roofTile(m, x, y) {
    const isR = (id) => id === 'roof';
    const o = { ridge: !isR(m.tileAt(x, y - 1)), eave: !isR(m.tileAt(x, y + 1)), l: !isR(m.tileAt(x - 1, y)), r: !isR(m.tileAt(x + 1, y)) };
    o.chimney = o.ridge && !o.l && !o.r && tk().hash(x, y, 227) < 0.25;
    const key = 'rf|' + +o.ridge + +o.eave + +o.l + +o.r + +o.chimney;
    return cached(key, () => canvas(A.roofArt(o)));
  }

  // ------------------------------------------------------------ liquids
  /** water/lava/poison with banks: stone/earth lip where the ground is north, dark edges elsewhere */
  function liquidTile(m, x, y, id, theme) {
    const same = (dx, dy) => { const t = m.tileAt(x + dx, y + dy); return t === id || (id === 'water' && (t === 'lbridge_h' || t === 'lbridge_v')) || t === 'void'; };
    const N = same(0, -1), S = same(0, 1), W = same(-1, 0), E = same(1, 0);
    if (N && S && W && E) return null;
    const bankId = !N ? m.tileAt(x, y - 1) : 'floor';
    const bank = GROUND[bankId] ? groundName(bankId, theme) : 'theme:' + (theme || 'generic');
    const key = 'lq|' + id + '|' + bank + '|' + +N + +S + +W + +E;
    return cached(key, () => {
      const t = tk(), nf = LIQUID[id];
      return t.frames(nf, (f) => {
        const b = A.groundArt(id, f);
        const fl = A.floorBuf(bank);
        const lipCol = id === 'lava' ? 0x2a1410 : id === 'poison' ? 0x1c0c24 : 0x0a1840;
        if (!N) {
          // the bank's edge and the shadowed wall of the basin
          for (let x0 = 0; x0 < 16; x0++) {
            b.set(x0, 0, fl.get(x0, 0)); b.set(x0, 1, t.mul(fl.get(x0, 1), 0.6));
            b.set(x0, 2, lipCol); b.set(x0, 3, t.mix(b.get(x0, 3), lipCol, 0.5));
          }
        }
        if (!W) for (let y0 = 0; y0 < 16; y0++) { b.set(0, y0, lipCol); b.set(1, y0, t.mix(b.get(1, y0), lipCol, 0.4)); }
        if (!E) for (let y0 = 0; y0 < 16; y0++) { b.set(15, y0, lipCol); }
        if (!S) for (let x0 = 0; x0 < 16; x0++) { b.set(x0, 15, id === 'water' ? ((x0 + f) % 3 ? 0xd0e8ff : 0x88b8f0) : id === 'lava' ? 0xffe070 : 0xc090e0); }
        return b;
      });
    });
  }

  // ------------------------------------------------------------ objects
  function objectTile(m, x, y, id, theme) {
    const g = underGround(m, x, y);
    const gname = groundName(g, theme);
    let ctx = '';
    if (JOIN[id]) {
      const s = (dx, dy) => (m.tileAt(x + dx, y + dy) === id ? '1' : '0');
      ctx = s(-1, 0) + s(1, 0) + s(0, -1) + s(0, 1);
    }
    const key = 'o|' + id + '|' + gname + '|' + ctx;
    return cached(key, () => {
      const c = ctx ? { l: ctx[0] === '1', r: ctx[1] === '1', u: ctx[2] === '1', d: ctx[3] === '1' } : {};
      const nf = ANIM_OBJ[id] || 1;
      const fl = A.floorBuf(gname);
      if (nf > 1) return tk().frames(nf, (f) => A.objectArt(id, fl, Object.assign({ f }, c)));
      return canvas(A.objectArt(id, fl, c));
    });
  }
  function themedOnGround(m, x, y, id, theme, make) {
    const g = underGround(m, x, y);
    const gname = groundName(g, theme);
    if (gname === 'theme:' + theme) return null; // the themed tile already stands on this floor
    return cached('tg|' + id + '|' + theme + '|' + gname, () => canvas(make(gname)));
  }

  // ------------------------------------------------------------ public
  A.localTile = function (map, x, y) {
    const id = map.tileAt(x, y);
    const theme = map.theme && A.THEME_DEFS[map.theme] ? map.theme : 'generic';
    if (WALL[id]) return id.startsWith('door') ? doorTile(map, x, y, id, theme) : wallTile(map, x, y, id, theme);
    if (GROUND[id]) return groundTile(map, x, y, id, theme);
    if (id === 'housewall') return houseWallTile(map, x, y);
    if (id === 'roof') return roofTile(map, x, y);
    if (LIQUID[id]) return liquidTile(map, x, y, id, theme);
    if (id in A.DEFAULT_FLOOR) return objectTile(map, x, y, id, theme);
    if (id === 'pillar' || id === 'rock') {
      return themedOnGround(map, x, y, id, theme, (g) => {
        const b = id === 'pillar' ? A.pillarArt(theme, g) : A.rockArt(theme, g);
        return b;
      });
    }
    return null;
  };
  A.localTileCacheSize = () => CACHE.size;
})(window.RPG);
