// Context tiles for local maps: R.Art.localTile(map, x, y).
// Looks at the neighbours to draw what a single tile id cannot:
//  * walls in 3/4 view — a face (with a lit cap when the floor is behind it)
//    where the wall meets walkable ground below, a top surface inside thick walls
//  * houses — roof ridge / eaves / gable edges, facades with windows, eave shadow
//  * carpets with gold borders, water/lava/poison with banks
//  * furniture on the floor it actually stands on; counters, tables, beds and
//    fences that join with their neighbours
//  * soft shadows on the floor from walls and furniture (decor layer), light
//    from the top-left; deterministic floor variety; tile_alt / crack decor
//    painted into the floor itself; grass fringes along paths
// Returns a canvas / frame array (cached per context signature) or null to let
// the caller use the plain 'tile:<theme>:<id>' / 'tile:<id>'.
// Map contract: map.tileAt(x, y) → tile id (outside → map.outside), map.theme.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;

  // wall-like cells: drawn in 3/4 view and seen as wall by their neighbours
  // (closed doors and secret passages look like the wall they are set in)
  const WALL = { wall: 1, wall_torch: 1, door: 1, door_silver: 1, door_gold: 1, lockdoor: 1, rock_door: 1, secret_wall: 1 };
  const DOORISH = { door: 1, door_silver: 1, door_gold: 1, lockdoor: 1, rock_door: 1 };
  const HOUSE = { housewall: 1, roof: 1 };
  // tiles that stand up and cast a shadow on the ground south/east of them
  const TALL = { wall: 1, wall_torch: 1, door: 1, door_silver: 1, door_gold: 1, housewall: 1, roof: 1, bookshelf: 1, shelf: 1, pillar: 1, statue: 1, tree: 1,
    lockdoor: 1, rock_door: 1, secret_wall: 1, vine_wall: 1, ice_wall: 1, story_stone: 1, story_stone_blank: 1 };
  const GROUND = { floor: 1, lgrass: 1, dirt: 1, wood: 1, carpet: 1, sand: 1, snowfloor: 1, ice: 1, flowers: 1, mud: 1 };
  const GRASSY = { lgrass: 1, flowers: 1 };
  const LIQUID = { water: 4, lava: 2, poison: 2, bog: 4 };
  const JOIN = { counter: 1, table: 1, bed: 1, fence: 1, vine_wall: 1, ice_wall: 1, fog_wall: 1 };
  const ANIM_OBJ = { warp_pad: 4, seal: 2, lbridge_h: 4, lbridge_v: 4, fog_wall: 2 };
  /** map column x reduced to the theme's wall-face period (faces vary along the wall) */
  const facePos = (theme, x) => { const p = (A.themeArt(theme).period) || 1; return ((x % p) + p) % p; };
  /** has the party already found the secret passage at (x,y)? (R.Game.secrets, §3.3.10-11) */
  function secretFound(m, x, y) {
    const G = R.Game;
    return !!(G && G.secrets && G.secrets[m.id + ':' + x + ',' + y]);
  }

  const OUTDOOR_G = { 'theme:forest': 1, 'theme:snow': 1, 'theme:swamp': 1 };
  /**
   * The theme of a cell: a map may paint areas in other themes with
   * def.themeAreas = [{x, y, w, h, theme}] (the last area containing the cell wins),
   * e.g. the patchwork forest of the Depths of Oblivion (§11.2.11). Else map.theme.
   */
  function themeAt(m, x, y) {
    const areas = m && m.def && m.def.themeAreas;
    if (areas && areas.length) for (let i = areas.length - 1; i >= 0; i--) {
      const a = areas[i];
      if (x >= a.x && y >= a.y && x < a.x + (a.w || 1) && y < a.y + (a.h || 1)) return a.theme;
    }
    return m && m.theme;
  }
  A.themeAt = (m, x, y) => (A.themeOf ? A.themeOf(themeAt(m, x, y)) : 'generic');
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
  // Natural ground of a theme: what a tree in the middle of a wood stands on, and
  // what the map's `outside` trees are drawn over. Towns: the lawn, except the
  // snow village (snow), the oasis town (sand) and the ash town (bare earth).
  const NAT_GROUND = { town_snow: 'snowfloor', town_sand: 'sand', town_ash: 'dirt' };
  function natGround(theme) {
    if (NAT_GROUND[theme]) return NAT_GROUND[theme];
    const d = theme && R.DB.themes && R.DB.themes[theme];
    if (!theme || theme === 'generic' || (d && d.town) || (A.isTownTheme && A.isTownTheme(theme))) return 'lgrass';
    return 'floor';
  }
  // tree species by theme: firs in the snow, scorched trees in the ash lands
  const FIR_THEMES = { town_snow: 1, snow: 1, ice: 1 };
  const ASH_THEMES = { town_ash: 1, volcano: 1 };
  const DEEP_THEMES = { forest: 1, tree: 1, swamp: 1 };
  function treeStyle(theme, gname) {
    if (gname === 'snowfloor' || gname === 'snow' || FIR_THEMES[theme]) return 'snow';
    if (ASH_THEMES[theme]) return 'ash';
    if (DEEP_THEMES[theme]) return 'deep';
    return '';
  }
  /** the ground an object stands on: weighted vote of the neighbours */
  function underGround(m, x, y, fallback) {
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
    return best || fallback || (m.theme ? 'floor' : 'wood');
  }

  // ------------------------------------------------------------ shading
  // Light comes from the top-left: walls, house walls and tall objects cast a
  // soft band on the floor south of them and a thin shadow on the floor east of
  // them; furniture from the decor layer (DESIGN §7.1) does the same, more
  // subtly. The same multipliers are exposed for opaque floor decor (rugs,
  // mosaics, dais tops) so shadows fall across them identically.
  const hasDecor = (m) => typeof m.decorAt === 'function' && !!m.decor;
  /** 'T' tall furniture, 'f' furniture, 'd' dais, '' nothing (walkable/wall pieces cast nothing) */
  function decorCaster(m, x, y) {
    const id = m.decorAt(x, y);
    if (!id) return '';
    if (id === 'dais') return 'd';
    const d = R.DB.decor && R.DB.decor[id];
    if (!d || d.pass || d.wall) return '';
    return d.tall ? 'T' : 'f';
  }
  /** shading signature of a floor cell: '' when unshaded */
  function shadeKey(m, x, y) {
    const n = TALL[m.tileAt(x, y - 1)] ? 1 : 0;
    const w = TALL[m.tileAt(x - 1, y)] ? 1 : 0;
    const nw = !n && !w && TALL[m.tileAt(x - 1, y - 1)] ? 1 : 0;
    let dn = '', dw = '';
    if (hasDecor(m)) {
      const self = m.decorAt(x, y);
      dn = n ? '' : decorCaster(m, x, y - 1);
      dw = w ? '' : decorCaster(m, x - 1, y);
      if (self === 'dais') { if (dn === 'd') dn = ''; if (dw === 'd') dw = ''; }
      if (dw === 'f') dw = '';
    }
    if (!n && !w && !nw && !dn && !dw) return '';
    return '' + n + w + nw + dn + '.' + dw;
  }
  const KCACHE = new Map();
  /** per-pixel brightness multipliers (Float32Array 256) for a shade key, or null */
  function shadeK(key) {
    if (!key) return null;
    let k = KCACHE.get(key);
    if (k) return k;
    k = new Float32Array(256).fill(1);
    const n = key[0] === '1', w = key[1] === '1', nw = key[2] === '1';
    const [dn, dw] = key.slice(3).split('.');
    const dim = (x, y, v) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) { const i = y * 16 + x; if (v < k[i]) k[i] = v; } };
    for (let i = 0; i < 16; i++) {
      if (n) { dim(i, 0, 0.56); dim(i, 1, 0.68); dim(i, 2, 0.8); if ((i + 3) % 2) dim(i, 3, 0.9); }
      if (w) { dim(0, i, 0.72); if (i % 2) dim(1, i, 0.86); }
      if (dn === 'T') { if (i >= 2) dim(i, 0, 0.72); if (i >= 3) dim(i, 1, 0.84); if (i >= 4 && i % 2) dim(i, 2, 0.92); }
      if (dn === 'f') { if (i >= 2) dim(i, 0, 0.82); if (i >= 3 && i % 2) dim(i, 1, 0.9); }
      if (dn === 'd') { dim(i, 0, 0.66); dim(i, 1, 0.82); if (i % 2) dim(i, 2, 0.92); }
      if (dw === 'T') { if (i >= 2) dim(0, i, 0.8); if (i >= 3 && i % 2) dim(1, i, 0.9); }
      if (dw === 'd') { if (i < 10) { dim(0, i, 0.74); if (i % 2) dim(1, i, 0.88); } else { dim(0, i, 0.66); dim(1, i, 0.8); } }
    }
    if (nw) { dim(0, 0, 0.62); dim(1, 0, 0.78); dim(0, 1, 0.78); dim(1, 1, 0.9); dim(2, 0, 0.9); dim(0, 2, 0.9); }
    KCACHE.set(key, k);
    return k;
  }
  A.floorShadeKey = shadeKey;
  A.floorShadeK = (m, x, y) => shadeK(shadeKey(m, x, y));

  // ------------------------------------------------------------ floor variety
  // Deterministic per cell (map id + position), so a room never looks like wallpaper.
  function salt(m) {
    if (m._artSalt != null) return m._artSalt;
    let h = 0;
    const s = String(m.id || '');
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    return (m._artSalt = h & 0xffff);
  }
  function variantAt(m, x, y, gname) {
    if (!A.floorVariant || !A.floorVaries || !A.floorVaries(gname)) return 0;
    const h = tk().hash(x, y, 7001 + salt(m));
    // outdoor dungeons (forest, snow, swamp) get more ground variety (DESIGN §11.2.8)
    const plain = gname === 'lgrass' ? 0.64 : gname === 'theme:cave' ? 0.3 : OUTDOOR_G[gname] ? 0.42 : 0.58;
    return h < plain ? 0 : h < plain + 0.2 ? 1 : h < plain + 0.32 ? 2 : 3;
  }
  /** floor decor this cell's floor paints itself: 'alt' | 'crack' | '' */
  function floorFx(m, x, y, gname) {
    if (!hasDecor(m) || !A.floorVariant) return '';
    const d = m.decorAt(x, y);
    if (d === 'tile_alt' && A.floorHasAlt && A.floorHasAlt(gname)) return 'alt';
    if (d === 'crack' && A.floorHasCrack && A.floorHasCrack(gname)) return 'crack';
    return '';
  }
  /** used by the decor art: does the floor at (x,y) already show this decor? */
  // grounds the outdoor tiler (tiles_local.js wraps localTile) paints itself: not ours
  const EXT_IDS = { lgrass: 1, flowers: 1, dirt: 1, sand: 1, snowfloor: 1, mud: 1 };
  const extTakes = (id, theme) => !!(A.localTile && A.localTile._exterior) && (EXT_IDS[id] || (id === 'floor' && A.isTownTheme && A.isTownTheme(theme)));
  A.floorHandlesDecor = function (m, x, y, kind) {
    const id = m.tileAt(x, y);
    if (!GROUND[id] || id === 'carpet') return false;
    const theme = A.themeOf ? A.themeOf(m.theme) : 'generic';
    if (extTakes(id, theme)) return false;
    return floorFx(m, x, y, groundName(id, theme)) === (kind === 'tile_alt' ? 'alt' : kind);
  };

  // ------------------------------------------------------------ ground
  /** shadows (walls, tall objects, furniture), floor variety, carpet borders, grass fringe */
  function groundTile(m, x, y, id, theme) {
    const gname = groundName(id, theme);
    const sk = shadeKey(m, x, y);
    let fringe = '';
    if (!GRASSY[id] && id !== 'carpet' && id !== 'wood') {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) fringe += GRASSY[m.tileAt(x + dx, y + dy)] ? '1' : '0';
    } else fringe = '0000';
    let carpet = '';
    if (id === 'carpet') {
      const c = (dx, dy) => (m.tileAt(x + dx, y + dy) === 'carpet' || m.tileAt(x + dx, y + dy) === 'throne' ? '1' : '0');
      carpet = c(0, -1) + c(0, 1) + c(-1, 0) + c(1, 0) + c(-1, -1) + c(1, -1) + c(-1, 1) + c(1, 1);
    }
    const fx = id === 'carpet' ? '' : floorFx(m, x, y, gname);
    const v = id === 'carpet' || fx === 'alt' ? 0 : variantAt(m, x, y, gname);
    if (!sk && fringe === '0000' && (!carpet || carpet === '11111111') && !v && !fx) return null;
    const key = 'g|' + id + '|' + theme + '|' + sk + '|' + fringe + '|' + carpet + '|' + v + '|' + fx;
    return cached(key, () => {
      const t = tk();
      const b = (fx ? A.floorVariant(gname, fx) : v ? A.floorVariant(gname, v) : A.floorBuf(gname)).clone();
      if (carpet) carpetBorder(b, carpet);
      if (fringe !== '0000') grassFringe(b, fringe);
      const k = shadeK(sk);
      if (k) for (let i = 0; i < 256; i++) if (k[i] < 1 && b.p[i] !== -1) b.p[i] = t.mul(b.p[i], k[i]);
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
    const cap = !wallish(up), px = facePos(theme, x);
    if (id === 'wall_torch') {
      return cached('wf|' + theme + '|' + cap + '|' + px + '|torch', () => tk().frames(2, (f) => A.themeTorch(theme, A.wallFace(theme, cap, px), f)));
    }
    return cached('wf|' + theme + '|' + cap + '|' + px, () => canvas(A.wallFace(theme, cap, px)));
  }
  /** a secret passage: exactly the wall it is set in (face or top); the found marks only once found (A15) */
  function secretTile(m, x, y, theme) {
    const up = m.tileAt(x, y - 1), down = m.tileAt(x, y + 1);
    const l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    const found = secretFound(m, x, y);
    if (wallish(down)) {
      const e = { n: !wallish(up), w: !wallish(l), e: !wallish(r) };
      return cached('sw|t|' + theme + '|' + +e.n + +e.w + +e.e + '|' + found, () => canvas(A.secretWallArt(theme, { top: true, edges: e, found })));
    }
    const cap = !wallish(up), px = facePos(theme, x);
    return cached('sw|f|' + theme + '|' + cap + '|' + px + '|' + found, () => canvas(A.secretWallArt(theme, { capTop: cap, x: px, found })));
  }
  function doorTile(m, x, y, id, theme) {
    const up = m.tileAt(x, y - 1), l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    if (l === 'housewall' || r === 'housewall') {
      const eave = up === 'roof';
      const cap = !eave && up !== 'housewall';
      const top = eave ? 3 : 2;
      return cached('hd|' + id + '|' + theme + '|' + eave + cap, () => {
        const b = A.drawDoor(A.houseWallArt({ eave, capTop: cap, plain: true }, theme), id === 'lockdoor' || id === 'rock_door' ? 'door' : id, top, 'wood');
        return canvas(id === 'lockdoor' ? A.lockOverlay(b, top, theme) : b);
      });
    }
    const cap = !wallish(up) && !HOUSE[up], px = facePos(theme, x);
    if (id === 'lockdoor') {
      // double doors (two lockdoor cells side by side): left / right leaf, lock on the seam
      const pair = r === 'lockdoor' && l !== 'lockdoor' ? 'L' : l === 'lockdoor' && r !== 'lockdoor' ? 'R' : '';
      return cached('ld|' + theme + '|' + cap + '|' + px + '|' + pair, () => canvas(A.lockDoorArt(theme, cap, px, pair)));
    }
    if (id === 'rock_door') return cached('rd|' + theme + '|' + cap + '|' + px, () => canvas(A.rockDoorArt(theme, cap, px)));
    return cached('wd|' + theme + '|' + id + '|' + cap + '|' + px, () => canvas(A.doorArt(theme, id, cap, null, px)));
  }

  // ------------------------------------------------------------ houses
  function houseWallTile(m, x, y, theme) {
    const up = m.tileAt(x, y - 1), down = m.tileAt(x, y + 1);
    const l = m.tileAt(x - 1, y), r = m.tileAt(x + 1, y);
    const hw = (id) => id === 'housewall' || !!DOORISH[id];
    if (down === 'housewall') {
      const e = { n: !(hw(up) || up === 'roof'), w: !hw(l), e: !hw(r) };
      return cached('hwt|' + theme + '|' + +e.n + +e.w + +e.e, () => canvas(A.houseWallArt({ top: true, edges: e }, theme)));
    }
    const eave = up === 'roof';
    const cap = !eave && up !== 'housewall';
    // windows on alternate facade cells, never right beside a door
    const nearDoor = !!DOORISH[l] || !!DOORISH[r];
    const window = !nearDoor && (x % 3 !== 0);
    return cached('hwf|' + theme + '|' + eave + cap + window, () => canvas(A.houseWallArt({ eave, capTop: cap, window }, theme)));
  }
  function roofTile(m, x, y, theme) {
    const isR = (id) => id === 'roof';
    const o = { ridge: !isR(m.tileAt(x, y - 1)), eave: !isR(m.tileAt(x, y + 1)), l: !isR(m.tileAt(x - 1, y)), r: !isR(m.tileAt(x + 1, y)) };
    o.chimney = o.ridge && !o.l && !o.r && tk().hash(x, y, 227) < 0.25;
    const key = 'rf|' + theme + '|' + +o.ridge + +o.eave + +o.l + +o.r + +o.chimney;
    return cached(key, () => canvas(A.roofArt(o, theme)));
  }

  // ------------------------------------------------------------ liquids
  /** water/lava/poison with banks: stone/earth lip where the ground is north, dark edges elsewhere */
  function liquidTile(m, x, y, id, theme) {
    const same = (dx, dy) => { const t = m.tileAt(x + dx, y + dy); return t === id || (id === 'water' && (t === 'lbridge_h' || t === 'lbridge_v')) || t === 'void'; };
    const N = same(0, -1), S = same(0, 1), W = same(-1, 0), E = same(1, 0);
    if (N && S && W && E) {
      // open mire: only the swamp's poison differs from the plain tile (themeAreas may paint it in)
      if (id === 'poison' && A.poisonKind && A.poisonKind(theme) !== 'base') return cached('lq|poison|open|' + A.poisonKind(theme), () => tk().frames(2, (f) => A.groundArt('poison', f, theme)));
      return null;
    }
    const bankId = !N ? m.tileAt(x, y - 1) : 'floor';
    const bank = GROUND[bankId] ? groundName(bankId, theme) : 'theme:' + (theme || 'generic');
    const pk = id === 'poison' && A.poisonKind ? A.poisonKind(theme) : '';
    const PP = pk && A.POISON_PAL ? A.POISON_PAL[pk] : null;
    const key = 'lq|' + id + '|' + bank + '|' + +N + +S + +W + +E + '|' + pk;
    return cached(key, () => {
      const t = tk(), nf = LIQUID[id];
      return t.frames(nf, (f) => {
        const b = A.groundArt(id, f, theme);
        const fl = A.floorBuf(bank);
        const lipCol = id === 'lava' ? 0x2a1410 : id === 'poison' ? (PP ? PP.lip : 0x1c0c24) : id === 'bog' ? 0x0e1410 : 0x0a1840;
        if (!N) {
          // the bank's edge and the shadowed wall of the basin
          for (let x0 = 0; x0 < 16; x0++) {
            b.set(x0, 0, fl.get(x0, 0)); b.set(x0, 1, t.mul(fl.get(x0, 1), 0.6));
            b.set(x0, 2, lipCol); b.set(x0, 3, t.mix(b.get(x0, 3), lipCol, 0.5));
          }
        }
        if (!W) for (let y0 = 0; y0 < 16; y0++) { b.set(0, y0, lipCol); b.set(1, y0, t.mix(b.get(1, y0), lipCol, 0.4)); }
        if (!E) for (let y0 = 0; y0 < 16; y0++) { b.set(15, y0, lipCol); }
        if (!S) for (let x0 = 0; x0 < 16; x0++) { b.set(x0, 15, id === 'water' ? ((x0 + f) % 3 ? 0xd0e8ff : 0x88b8f0) : id === 'lava' ? 0xffe070 : id === 'bog' ? ((x0 + f) % 4 ? 0x5a6c5c : 0x7a8c78) : PP ? ((x0 + f) % 4 ? PP.edge : PP.P[5]) : 0xc090e0); }
        return b;
      });
    });
  }

  // ------------------------------------------------------------ objects
  function objectTile(m, x, y, id, theme) {
    const g = underGround(m, x, y, id === 'tree' ? natGround(theme) : null);
    const gname = groundName(g, theme);
    const style = id === 'tree' ? treeStyle(theme, gname) : '';
    let ctx = '';
    if (JOIN[id]) {
      const s = (dx, dy) => (m.tileAt(x + dx, y + dy) === id ? '1' : '0');
      ctx = s(-1, 0) + s(1, 0) + s(0, -1) + s(0, 1);
    }
    const key = 'o|' + id + '|' + gname + '|' + ctx + '|' + style;
    return cached(key, () => {
      const c = ctx ? { l: ctx[0] === '1', r: ctx[1] === '1', u: ctx[2] === '1', d: ctx[3] === '1' } : {};
      if (gname === 'snowfloor' || gname === 'snow' || style === 'snow') c.snow = true;
      else if (style === 'ash') c.ash = true;
      else if (style === 'deep') c.deep = true;
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
    const theme = A.themeAt(map, x, y);
    if (id === 'secret_wall') return secretTile(map, x, y, theme);
    if (WALL[id]) return DOORISH[id] ? doorTile(map, x, y, id, theme) : wallTile(map, x, y, id, theme);
    if (GROUND[id]) return groundTile(map, x, y, id, theme);
    if (id === 'housewall') return houseWallTile(map, x, y, theme);
    if (id === 'roof') return roofTile(map, x, y, theme);
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
  A.natGround = natGround;
  A.treeStyle = treeStyle;

  // ------------------------------------------------------------ outside cells
  // The field draws cells beyond a map's edge with 'tile:<theme>:<outside>' when that
  // key exists, else the plain 'tile:<outside>' (field.js tileGfx). Walls, rocks and
  // other themed tiles already have themed keys and plain grounds / water are the
  // same in every theme; trees are not: register the art of a tree deep inside a
  // wood, drawn by this tiler, so the border continues what is inside the map:
  // snowy firs round the snow village, scorched trees round the ash town, trees on
  // sand in the oasis town and on the forest floor in the forest dungeons.
  const OUTSIDE_IDS = ['tree'];
  function solidMap(id, theme) {
    return {
      id: '~outside', theme, def: {}, w: 64, h: 64, isWorld: false,
      tileAt: () => id, decorAt: () => null, inBounds: () => true,
    };
  }
  /** art of a cell of tile `id` surrounded by the same tile, in `theme` (canvas | frames) */
  A.outsideTile = function (theme, id) {
    let g = null;
    try { g = A.localTile(solidMap(id, theme), 32, 32); } catch (e) { g = null; }
    return g || R.Gfx.get('tile:' + id);
  };
  function registerOutside() {
    const G = R.Gfx;
    if (!G || !R.DB.themes) return;
    for (const theme of Object.keys(R.DB.themes)) {
      for (const id of OUTSIDE_IDS) {
        const key = 'tile:' + theme + ':' + id;
        if (G.has(key) || !(id in R.DB.tiles)) continue;
        G.def(key, () => A.outsideTile(A.themeOf ? A.themeOf(theme) : theme, id));
      }
    }
  }
  registerOutside();
  if (R.onBoot) R.onBoot(registerOutside);
})(window.RPG);
