// Chronicle local tiles (DESIGN §11.2.6, §11.2.9): closed passages (vine, ice
// and fog walls), the story stones, the marsh grounds (bog, mud), and the house
// walls and roofs of the regional town themes. Loads BEFORE tiles_local.js
// (localeCompare puts '_' before '.'), so it only registers A.LOCAL_EXT, which
// tiles_local.js merges into its own tables:
//   GROUND  ground painters (t, f) → 16x16 Buf        (bog is animated: f 0..3)
//   OBJ     object painters (floorBuf, ctx) → Buf      (drawn on the floor they stand on)
//   DEFAULT_FLOOR  floor under the plain 'tile:<id>'
//   ANIM    frame counts of animated objects
//   HOUSE   house-wall painters (o, th, t) → Buf       (th = the theme row)
//   ROOF    roof painters (o, P, th, t) → Buf          (P = 6-step roof ramp)
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const tk = () => A.TK;
  const INK = 0x1a1410;

  // ------------------------------------------------------------ grounds
  const MUD = [0x2e2418, 0x44362a, 0x5a4a38, 0x705e48, 0x86745c];
  const BOG = [0x1a2420, 0x24302a, 0x2e3c34, 0x3a4a40, 0x4a5c50, 0x6a7c6c]; // murky green-grey (PAL.marshwater family)
  const GROUND = {
    /** trampled mud: wet sheen, footprints, a puddle (walkable, no damage) */
    mud(t) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 701), h = t.hash(x, y, 703);
        if (h < 0.05) return MUD[1];
        if (h > 0.96) return MUD[4];
        return v < 0.34 ? MUD[1] : v > 0.7 ? MUD[3] : MUD[2];
      });
      // puddle (wrapped so it tiles)
      const PU = [0x2a3438, 0x3e4c52, 0x58686e, 0x8a9ca2];
      for (let y = -2; y <= 2; y++) for (let x = -4; x <= 4; x++) {
        const e = (x / 4.5) ** 2 + (y / 2.2) ** 2;
        if (e > 1) continue;
        b.wset(10 + x, 11 + y, e > 0.7 ? MUD[0] : y < 0 ? PU[1] : y === 0 ? PU[2] : PU[1]);
      }
      b.wset(8, 11, PU[3]); b.wset(9, 11, PU[2]);
      // footprints
      for (const [x, y] of [[2, 2], [4, 5], [2, 8], [4, 11]]) { b.wset(x, y, MUD[0]); b.wset(x + 1, y, MUD[0]); b.wset(x, y + 1, MUD[1]); b.wset(x + 1, y + 1, MUD[4]); }
      return b;
    },
    /** deep bog: murky green-grey water with slow bubbles (4 frames) */
    bog(t, f) {
      f = f || 0;
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x + f * 2, y, 8, 16, 711);
        if (v < 0.3) return BOG[1];
        if (v > 0.72) return BOG[3];
        return BOG[2];
      });
      // scum (duckweed specks) drifting slowly
      for (const [x, y] of [[3, 3], [4, 3], [12, 6], [7, 12], [8, 12], [1, 10]]) b.wset(x + (f >> 1), y, 0x4a6038);
      // a bubble rising and popping over the frames
      const B = [[5, 8], [11, 12], [9, 4]];
      const [bx, by] = B[f % 3];
      if (f < 3) { b.wset(bx, by, BOG[5]); b.wset(bx + 1, by, BOG[4]); b.wset(bx, by + 1, BOG[3]); }
      else { b.wset(bx - 1, by, BOG[4]); b.wset(bx + 2, by, BOG[4]); b.wset(bx, by - 1, BOG[4]); b.wset(bx + 1, by + 1, BOG[4]); }
      // faint light ripple lines
      for (let x = 0; x < 16; x += 1) if ((x + f * 3) % 7 === 0) b.wset(x, 6, BOG[4]);
      return b;
    },
  };

  // ------------------------------------------------------------ closed passages & stones
  const OBJ = {};
  const VINE = [0x10240e, 0x1c3a16, 0x2a5420, 0x3c6e2c, 0x56883a];
  const STEM = [0x2a1c10, 0x44301c, 0x5e4428];
  /** a mesh of thick vines blocking the way, thorns and small flowers */
  OBJ.vine_wall = (fl, ctx) => tk().stamp(fl, (L) => {
    const t = tk();
    ctx = ctx || {};
    // woody stems criss-crossing
    const stems = [[[0, 3], [5, 7], [9, 5], [16, 9]], [[0, 12], [4, 9], [10, 12], [16, 7]], [[3, 0], [5, 6], [3, 11], [5, 16]], [[12, 0], [10, 6], [13, 10], [11, 16]]];
    for (const s of stems) for (let k = 0; k + 1 < s.length; k++) {
      const [x0, y0] = s[k], [x1, y1] = s[k + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
        L.set(x, y, STEM[1]); L.set(x, y + 1, STEM[0]); L.set(x + 1, y, STEM[2]);
      }
    }
    // leaves in clusters
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = t.fnoise(x, y, 4, 16, 721);
      if (v > 0.56 && L.get(x, y) === t.NONE) L.set(x, y, v > 0.72 ? VINE[4] : v > 0.64 ? VINE[3] : VINE[2]);
      else if (v > 0.5 && L.get(x, y) === t.NONE && (x + y) % 2) L.set(x, y, VINE[1]);
    }
    // thorns
    for (const [x, y] of [[6, 6], [9, 11], [3, 9], [13, 4], [11, 8]]) { L.set(x, y, 0xd8c8a0); L.set(x + 1, y - 1, 0xa89870); }
    // small flowers
    for (const [x, y, c] of [[4, 3, 0xf0a0c0], [12, 12, 0xf8f0f0], [8, 8, 0xf0a0c0], [14, 1, 0xf8f0f0]]) { L.set(x, y, c); L.set(x + 1, y, t.mul(c, 0.8)); L.set(x, y + 1, 0xf8d860); }
    // free sides fray (the mesh is thinner where it ends)
    if (!ctx.l) for (let y = 0; y < 16; y++) if (t.hash(0, y, 727) < 0.5) L.set(0, y, null);
    if (!ctx.r) for (let y = 0; y < 16; y++) if (t.hash(15, y, 729) < 0.5) L.set(15, y, null);
  }, { outline: 0x0a1608, sx: 1, sy: 1, shadowK: 0.6 });

  const ICE = [0x2c5480, 0x4878a8, 0x6c9cc8, 0x94c0e0, 0xbcdcf0, 0xe8f6ff];
  // on a pale floor (the ice caves, snow, marble) the block is drawn in deep glacier blue with
  // a dark rim, so it reads as a wall standing on the ice and not as more ice floor (R3)
  const ICE_DEEP = [0x0e2446, 0x1a3e6c, 0x2a5c96, 0x4280bc, 0x72acdc, 0xd4eeff];
  const paleFloor = (fl) => {
    let lum = 0;
    for (let i = 0; i < 256; i++) { const c = fl.p[i]; lum += ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; }
    return lum / 256 > 150;
  };
  /** a block of blue-white ice filling the passage; bubbles and light streaks inside */
  OBJ.ice_wall = (fl, ctx) => {
    const pale = paleFloor(fl), I = pale ? ICE_DEEP : ICE;
    return tk().stamp(fl, (L) => {
      const t = tk();
      ctx = ctx || {};
      // joined blocks fill the corridor edge to edge; a free side rounds off
      const lx = ctx.l ? -1 : 0, rx = ctx.r ? 17 : 16;
      const pts = ctx.u ? [[lx, 15.5], [lx, -1], [rx, -1], [rx, 15.5]]
        : [[lx, 15.5], [lx, ctx.l ? 2 : 4], [ctx.l ? 0 : 2, 1], [6, 0], [10, 0.5], [ctx.r ? 16 : 14, ctx.r ? 1 : 2], [rx, ctx.r ? 2 : 5], [rx, 15.5]];
      L.poly(pts, I[3]);
      L.each((x, y) => {
        const facet = (x * 0.8 - y * 0.5 + 20) % 7;
        let c = x < 5 ? I[4] : x > 11 ? I[2] : I[3];
        if (facet < 1) c = I[5];
        if (y > 12) c = t.mix(c, I[1], pale ? 0.55 : 0.35);
        return c;
      });
      // a frosted top face where nothing is stacked above (the block has height)
      if (pale && !ctx.u) L.each((x, y, c) => (c !== t.NONE && y <= 3 && L.get(x, y - 1) === t.NONE ? 0xe8f6ff : c));
      // streaks of light and trapped bubbles
      L.line(3, 3, 6, 10, I[5]); L.line(4, 3, 7, 10, I[4]); L.line(10, 2, 12, 7, I[5]);
      for (const [x, y] of [[8, 9], [11, 11], [5, 13], [9, 5]]) { L.set(x, y, 0xffffff); L.set(x + 1, y + 1, I[2]); }
      // cracks
      L.line(7, 12, 10, 15, I[1]); L.line(12, 4, 14, 8, I[1]);
      if (!ctx.d) L.hline(ctx.l ? 0 : 1, ctx.r ? 15 : 14, 15, I[pale ? 0 : 1]);
    }, { outline: pale ? 0x08162c : 0x1c3450, sx: 1, sy: 1, shadowK: pale ? 0.55 : 0.7 });
  };

  /** a bank of thick white fog; dithered so the floor shows through, it drifts (2 frames) */
  OBJ.fog_wall = (fl, ctx) => {
    ctx = ctx || {};
    const t = tk(), f = ctx.f || 0, b = fl.clone();
    // on a pale floor (snow, marble, paper) the bank takes a cooler, deeper shading so
    // it still reads as a barrier and not as more floor
    let lum = 0;
    for (let i = 0; i < 256; i++) { const c = fl.p[i]; lum += ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; }
    const pale = lum / 256 > 170;
    const F = pale ? [0x6c7690, 0x8e98b0, 0xb4bccc, 0xe4e8f0, 0xfcfcfe] : [0xa8aebc, 0xc4c8d2, 0xdcdee6, 0xf0f0f4, 0xfcfcfe];
    // distance to an open side (a side without fog next to it): the bank thins out there
    const open = (x, y) => Math.min(ctx.l ? 99 : x + 0.5, ctx.r ? 99 : 15.5 - x, ctx.u ? 99 : y + 0.5, ctx.d ? 99 : 15.5 - y);
    const N = (x, y) => t.fnoise(x + f * 2, y, 8, 16, 731) * 0.7 + t.fnoise(x - f, y + f, 4, 16, 733) * 0.3;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // the same noise field in every cell (periodic 16), so joined banks are seamless
      const v = N(x, y);
      const edge = Math.min(1, open(x, y) / 5);
      const dens = (0.5 + v * 0.9) * (0.3 + 0.7 * edge);
      // puffs: lit where the field falls toward the upper left, shaded toward the lower right
      const lit = N(x - 1, y - 1) - N(x + 1, y + 1);
      const col = lit > 0.05 ? F[4] : lit > -0.02 ? F[3] : lit > -0.08 ? F[2] : F[1];
      if (dens > 0.9) b.set(x, y, col);
      else if (dens > 0.45) { if (t.bayer(x + f, y) < (dens - 0.45) / 0.45) b.set(x, y, col); else b.set(x, y, t.mix(b.get(x, y), F[2], 0.5)); }
      else if (dens > 0.25 && t.bayer(x, y + f) < 0.5) b.set(x, y, t.mix(b.get(x, y), F[1], 0.35));
    }
    // a soft grey underside where the bank meets the floor
    if (!ctx.d) for (let x = 0; x < 16; x++) if ((x + f) % 2 === 0) b.set(x, 15, t.mix(b.get(x, 15), F[0], 0.5));
    return b;
  };

  const STELE = [0x2e2e34, 0x4a4a52, 0x686872, 0x888890, 0xa6a6ae, 0xc6c6cc];
  /** a human-high standing stone with rows of carved script */
  function stele(fl, blank) {
    return tk().stamp(fl, (L) => {
      const t = tk();
      // mossy footing
      L.rect(2, 13, 12, 3, STELE[2]); L.hline(2, 13, 13, STELE[3]); L.hline(2, 13, 15, STELE[1]);
      L.set(2, 14, 0x4a6030); L.set(3, 13, 0x5a7038); L.set(12, 14, 0x4a6030);
      // slab with a rounded top
      for (let y = 0; y < 13; y++) for (let x = 3; x <= 12; x++) {
        if (y === 0 && (x < 5 || x > 10)) continue;
        if (y === 1 && (x < 4 || x > 11)) continue;
        const c = x === 3 || (y < 2 && x < 6) ? STELE[4] : x === 12 ? STELE[1] : x > 10 ? STELE[2] : STELE[3];
        L.set(x, y, c);
      }
      L.set(5, 0, STELE[5]); L.set(4, 1, STELE[5]);
      // carved lines of script: each line a row of short glyphs
      for (let row = 0; row < 4; row++) {
        const y = 3 + row * 2 + (row > 1 ? 1 : 0);
        const faded = blank || row >= 2; // the lower half is already white (§10.9.1)
        for (let x = 5; x <= 10; x++) {
          if (t.hash(x, row, blank ? 741 : 743) < 0.25) continue;
          if (faded) { L.set(x, y, 0xf4f4f0); }
          else { L.set(x, y, STELE[0]); L.set(x, y + 1, STELE[4]); }
        }
      }
      if (blank) for (let y = 2; y < 12; y++) for (let x = 4; x <= 11; x++) if ((x + y) % 3 === 0 && L.get(x, y) !== t.NONE) L.set(x, y, t.mix(L.get(x, y), 0xffffff, 0.35));
      // weather crack
      L.set(11, 4, STELE[1]); L.set(10, 5, STELE[1]); L.set(11, 6, STELE[1]);
    }, { outline: 0x1c1c22, sx: 2, sy: 1 });
  }
  OBJ.story_stone = (fl) => stele(fl, false);
  OBJ.story_stone_blank = (fl) => stele(fl, true);
  const DEFAULT_FLOOR = { vine_wall: 'dirt', ice_wall: 'ice', fog_wall: 'lgrass', story_stone: 'lgrass', story_stone_blank: 'lgrass' };
  const ANIM = { fog_wall: 2 };
  // objects that also get 'tile:<theme>:<id>' variants on each dungeon theme's floor
  const THEME_OBJS = ['vine_wall', 'ice_wall', 'fog_wall', 'story_stone', 'story_stone_blank'];

  // ------------------------------------------------------------ house walls
  const WOOD = [0x3c200c, 0x5c3416, 0x7c4c22, 0x9c6632, 0xbc8448, 0xd8a468];
  const GREYWOOD = [0x241c14, 0x3a2e22, 0x524232, 0x6a5842, 0x827054, 0x9c8a6c];
  const LOGS = [0x2a1a0e, 0x44301a, 0x5e4426, 0x7a5a34, 0x967446, 0xb0905c];
  const DARKTIMBER = [0x1c140e, 0x2e2218, 0x423224, 0x584432];
  const ADOBE = [0x6c5434, 0x947650, 0xb49668, 0xccb082, 0xe0c89e];
  const WHITE = [0x8a887e, 0xb8b6aa, 0xdcdad0, 0xf0eee6, 0xfcfaf4];
  const STONEW = [0x2a2a2e, 0x46464c, 0x646468, 0x828284, 0xa2a2a2, 0xc0c0bc];
  const WSTONE = [0x7a7e8a, 0xa4a8b2, 0xc8ccd4, 0xe0e2e8, 0xf4f6fa];
  const GLASS = [0x2c3c6c, 0x5878b0, 0x9cb4e0];
  /** glazed window with a frame ramp F; shutters (ramp) optional */
  function glazed(b, F, x0, y0, w, h, o) {
    o = o || {};
    b.rect(x0, y0, w, h, F[1]);
    b.rect(x0 + 1, y0 + 1, w - 2, h - 2, GLASS[0]);
    b.rect(x0 + 1, y0 + 1, Math.ceil((w - 2) / 2), 2, GLASS[1]); b.set(x0 + 1, y0 + 1, GLASS[2]);
    if (o.cross !== false) { b.vline(x0 + (w >> 1), y0 + 1, y0 + h - 2, F[2]); b.hline(x0 + 1, x0 + w - 2, y0 + (h >> 1), F[2]); }
    if (o.warm) { b.set(x0 + w - 3, y0 + h - 3, 0xf0c060); b.set(x0 + 2, y0 + h - 3, 0xd8a040); }
    if (o.shut) { const S = o.shut; for (let y = y0; y < y0 + h; y++) { b.set(x0 - 2, y, S[2]); b.set(x0 - 1, y, S[1]); b.set(x0 + w, y, S[2]); b.set(x0 + w + 1, y, S[1]); if (y % 2) { b.set(x0 - 2, y, S[3]); b.set(x0 + w, y, S[3]); } } }
    b.hline(x0 - 1, x0 + w, y0 + h, F[4] || F[3]); b.hline(x0 - 1, x0 + w, y0 + h + 1, F[2]);
  }
  /** shared finishing: eave shadow under a roof, or a cap line when open above */
  function eaveCap(b, o, t, capCol) {
    if (o.eave) { b.hline(0, 15, 0, 0x2c1c14); for (let x = 0; x < 16; x++) { b.set(x, 1, t.mul(b.get(x, 1), 0.55)); b.set(x, 2, t.mul(b.get(x, 2), 0.75)); } }
    else if (o.capTop) b.hline(0, 15, 0, capCol);
  }
  /** a house wall seen from above (thick walls): the wall material between two sills */
  function wallAbove(t, core, sill, e) {
    const b = t.tile(core[3]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 751) < 0.08) b.set(x, y, core[2]);
    for (let y = 0; y < 16; y++) { b.set(0, y, sill[1]); b.set(1, y, sill[3]); b.set(14, y, sill[2]); b.set(15, y, sill[1]); }
    for (let y = 3; y < 16; y += 8) b.hline(2, 13, y, core[1]);
    if (e.w) b.vline(0, 0, 15, sill[0]);
    if (e.e) b.vline(15, 0, 15, sill[0]);
    if (e.n) { b.hline(0, 15, 0, sill[0]); b.hline(1, 14, 1, sill[3]); }
    return b;
  }
  const HOUSE = {
    /** stacked logs (forest village) with notched corners and small shuttered windows */
    log(o, th, t) {
      const P = LOGS;
      if (o.top) return wallAbove(t, [P[1], P[2], P[3], P[4]], P, o.edges || {});
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ry = (y + 1) % 4;
        let c = ry === 0 ? P[5] : ry === 1 ? P[4] : ry === 2 ? P[3] : P[1];
        if (ry !== 3 && t.hash(x, y >> 2, 761) < 0.07) c = P[2];
        b.set(x, y, c);
      }
      for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) if ((x * 3 + y) % 5 === 0) b.set(x, y, 0x9c8c6c);
      if (o.window) glazed(b, [P[0], P[1], P[3], P[4], P[5]], 5, 4, 6, 6, { shut: [P[0], P[2], P[3], P[4]], warm: true });
      eaveCap(b, o, t, P[0]);
      return b;
    },
    /** sun-dried brick under a lime wash (desert); roof beams jut out, deep window holes */
    adobe(o, th, t) {
      const P = ADOBE;
      if (o.top) return wallAbove(t, P, [0x4a3420, 0x6a4c2c, 0x8a6a40, 0xa88658], o.edges || {});
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 771), h = t.hash(x, y, 773);
        if (h < 0.05) return P[2];
        return v < 0.35 ? P[2] : v > 0.7 ? P[4] : P[3];
      });
      // faint brick courses showing through the wash
      for (let y = 4; y < 16; y += 4) for (let x = 0; x < 16; x++) if (t.hash(x, y, 775) < 0.35) b.set(x, y, P[2]);
      // vigas (beam ends) under the roof line
      if (o.eave || o.capTop) for (const x of [2, 9]) { b.rect(x, 2, 3, 2, 0x6a4a2a); b.set(x, 2, 0x8a6a40); b.set(x + 2, 3, 0x4a3018); b.set(x, 4, t.mul(P[3], 0.8)); b.set(x + 1, 4, t.mul(P[3], 0.8)); }
      if (o.window) {
        // an arched opening with a turned-wood grille
        for (let y = 6; y <= 11; y++) for (let x = 5; x <= 10; x++) {
          if (y === 6 && (x === 5 || x === 10)) continue;
          b.set(x, y, 0x1c140c);
        }
        for (const x of [6, 8, 10]) b.vline(x, 7, 11, 0x7a5a34);
        b.hline(5, 10, 9, 0x7a5a34);
        b.hline(4, 11, 12, P[4]); b.hline(4, 11, 13, P[1]);
      }
      // weathered foot
      for (let x = 0; x < 16; x++) { b.set(x, 15, P[1]); if (t.hash(x, 15, 777) < 0.5) b.set(x, 14, P[2]); }
      if (o.eave) { for (let x = 0; x < 16; x++) { b.set(x, 0, t.mul(b.get(x, 0), 0.6)); b.set(x, 1, t.mul(b.get(x, 1), 0.8)); } }
      else if (o.capTop) b.hline(0, 15, 0, P[1]);
      return b;
    },
    /** heavy dark timbers with cream panels (snow village); a snow ledge on the beam */
    heavytimber(o, th, t) {
      const D = DARKTIMBER, C = [0x8c8474, 0xb8b0a0, 0xdcd4c2, 0xeee8d8];
      if (o.top) return wallAbove(t, C, [D[0], D[1], D[2], D[3]], o.edges || {});
      const b = t.tile(C[2]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.hash(x, y, 781) < 0.07) b.set(x, y, C[1]);
      b.rect(0, 0, 16, 3, D[2]); b.hline(0, 15, 0, D[1]); b.hline(0, 15, 2, D[0]);
      b.rect(0, 12, 16, 4, D[2]); b.hline(0, 15, 12, D[3]); b.hline(0, 15, 15, D[0]);
      b.rect(0, 3, 2, 9, D[2]); b.vline(0, 3, 11, D[3]); b.rect(14, 3, 2, 9, D[1]);
      // snow on the sill beam
      for (let x = 0; x < 16; x++) { b.set(x, 12, 0xf0f4f8); if (t.hash(x, 12, 783) < 0.55) b.set(x, 13, 0xd0d8e2); }
      if (o.window) glazed(b, [D[0], D[1], D[2], D[3], D[3]], 5, 4, 6, 6, { warm: true });
      else if (!o.plain) { b.line(2, 11, 7, 3, D[1]); b.line(13, 11, 8, 3, D[1]); b.line(2, 10, 7, 3, D[2]); }
      eaveCap(b, o, t, D[0]);
      return b;
    },
    /** vertical weathered boards (marsh town): gaps, a nail row, damp foot */
    planks(o, th, t) {
      const P = GREYWOOD;
      if (o.top) return wallAbove(t, [P[1], P[2], P[3], P[4]], P, o.edges || {});
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const bx = x % 4;
        let c = bx === 3 ? P[0] : bx === 0 ? P[4] : P[3];
        if (bx !== 3 && t.hash(x >> 2, y, 791) < 0.08) c = P[2];
        if (bx === 1 && (y + (x >> 2) * 5) % 11 === 0) c = P[2];
        b.set(x, y, c);
      }
      for (let x = 1; x < 16; x += 4) { b.set(x, 3, P[1]); b.set(x, 11, P[1]); }
      for (let x = 0; x < 16; x++) { b.set(x, 15, t.mix(P[1], 0x2c3a2a, 0.4)); b.set(x, 14, t.mix(b.get(x, 14), 0x3c4c34, 0.35)); }
      if (o.window) glazed(b, [P[0], P[1], P[3], P[4], P[5]], 5, 4, 6, 6, { warm: true });
      eaveCap(b, o, t, P[0]);
      return b;
    },
    /** white lime plaster (the isles) with blue shutters and a painted plinth */
    white(o, th, t) {
      const P = WHITE, S = th && th.wainscot ? th.wainscot : [0x1c3c64, 0x2c5a8c, 0x3c76b0, 0x5c96cc, 0x84b4e0];
      if (o.top) return wallAbove(t, P, [S[0], S[1], S[2], S[3]], o.edges || {});
      const b = t.tile(P[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const h = t.hash(x, y, 801); if (h < 0.06) b.set(x, y, P[2]); else if (h > 0.97) b.set(x, y, P[4]); }
      for (let x = 0; x < 16; x++) { b.set(x, 13, S[3]); b.set(x, 14, S[2]); b.set(x, 15, S[1]); }
      if (o.window) glazed(b, [S[0], S[1], S[2], S[3], S[4]], 5, 4, 6, 6, { shut: [S[0], S[1], S[2], S[4]] });
      eaveCap(b, o, t, P[1]);
      return b;
    },
    /** rough stone masonry (mining and fire towns); a deep window with a lintel */
    stone(o, th, t) {
      const P = (th && th.hwp) || STONEW;
      if (o.top) return wallAbove(t, [P[1], P[2], P[3], P[4]], P, o.edges || {});
      const b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 2, ry = y & 3, off = row % 2 ? 3 : 0;
        for (let x = 0; x < 16; x++) {
          const bx = (x + off + row * 2) % 6;
          let c = ry === 3 || bx === 5 ? P[0] : ry === 0 ? P[4] : bx === 0 ? P[3] : P[2];
          if (c === P[2] && t.hash((x + off) / 6 | 0, row, 811) < 0.35) c = t.mix(P[2], P[1], 0.45);
          b.set(x, y, c);
        }
      }
      if (o.window) {
        b.rect(4, 3, 8, 2, P[4]); b.hline(4, 11, 4, P[2]); // lintel
        glazed(b, [P[0], P[0], P[1], P[3], P[4]], 5, 5, 6, 6, { warm: true });
      }
      eaveCap(b, o, t, P[0]);
      return b;
    },
    /** dressed white stone (the star city, the white capital); arched window */
    whitestone(o, th, t) {
      const P = WSTONE;
      if (o.top) return wallAbove(t, P, [0x5c606c, 0x8a8e9a, 0xb2b6c2, 0xd6d8e0], o.edges || {});
      const b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 3, ry = y & 7, off = row ? 8 : 0;
        for (let x = 0; x < 16; x++) {
          const bx = (x + off) % 16;
          let c = ry === 7 || bx === 15 ? P[1] : ry === 0 || bx === 0 ? P[4] : P[3];
          if (c === P[3] && t.hash(x, y, 821) < 0.05) c = P[2];
          b.set(x, y, c);
        }
      }
      if (o.window) {
        const G = th && th.band === 0xc8a040 ? [0x5c4c20, 0xb49040, 0xf0d890] : [0x1c2448, 0x3c4c90, 0x8ca0e0];
        for (let y = 3; y <= 11; y++) for (let x = 5; x <= 10; x++) {
          const arch = y < 6 ? Math.hypot(x - 7.5, y - 6) <= 3 : true;
          if (!arch) continue;
          const inner = y < 6 ? Math.hypot(x - 7.5, y - 6) <= 2.1 : x > 5 && x < 10;
          b.set(x, y, inner ? (y < 7 ? G[1] : G[0]) : P[1]);
        }
        b.set(6, 6, G[2]); b.vline(7, 5, 11, P[2]); b.set(8, 7, G[2]);
        b.hline(4, 11, 12, P[4]); b.hline(4, 11, 13, P[1]);
      }
      eaveCap(b, o, t, P[1]);
      return b;
    },
  };

  // ------------------------------------------------------------ roofs
  /** chimney shared by all roofs (stone; flat roofs get a round clay vent instead) */
  function chimney(b, t, flat) {
    if (flat) {
      const C = [0x6a4c2c, 0x8c6a40, 0xb08a58, 0xcca870];
      for (let y = 2; y <= 7; y++) for (let x = 9; x <= 14; x++) {
        const d = Math.hypot(x - 11.5, (y - 5) * 1.2);
        if (d <= 3) b.set(x, y, d > 2.3 ? C[0] : x < 11 ? C[3] : C[2]);
      }
      b.set(11, 4, 0x2a1c10); b.set(12, 4, 0x2a1c10);
      return;
    }
    const B = [0x3c2a24, 0x6c4c40, 0x9a6c58, 0xbc8c74];
    b.rect(9, 0, 5, 7, B[2]); b.vline(9, 0, 6, B[3]); b.vline(13, 0, 6, B[1]);
    for (let y = 2; y < 7; y += 2) b.hline(10, 12, y, B[1]);
    b.rect(9, 0, 5, 2, B[3]); b.rect(10, 0, 3, 1, 0x1c1410);
    b.hline(9, 13, 7, 0x1c1410);
  }
  const ROOF = {
    /** thatch (the storytellers' village): straw bundles in courses, ragged eave, capped ridge */
    thatch(o, P, th, t) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ry = y % 5;
        const straw = t.hash(x, y >> 1, 831);
        let c = ry === 4 ? P[1] : straw < 0.3 ? P[2] : straw > 0.8 ? P[4] : P[3];
        if (ry === 0 && x % 2) c = P[4];
        if ((x + (y >> 1)) % 7 === 0 && ry < 4) c = P[2];
        b.p[y * 16 + x] = c;
      }
      if (o.ridge) { b.rect(0, 0, 16, 3, P[1]); b.hline(0, 15, 0, P[0]); b.hline(0, 15, 1, P[2]); for (let x = 2; x < 16; x += 5) { b.set(x, 1, P[4]); b.set(x, 2, P[0]); } b.hline(0, 15, 3, P[0]); }
      if (o.eave) for (let x = 0; x < 16; x++) { const d = 1 + ((x * 7) % 3 === 0 ? 1 : 0); for (let k = 0; k < d; k++) b.set(x, 15 - k, k ? P[2] : P[0]); b.set(x, 13, P[4]); }
      if (o.l) { b.vline(0, 0, 15, P[0]); b.vline(1, 0, 15, P[3]); }
      if (o.r) { b.vline(15, 0, 15, P[0]); b.vline(14, 0, 15, P[1]); }
      if (o.chimney) chimney(b, t);
      return b;
    },
    /** overlapping wooden shingles (forest, marsh); moss on the forest ones */
    shingle(o, P, th, t) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 2, ry = y & 3;
        for (let x = 0; x < 16; x++) {
          const bx = (x + row * 3 + (row % 2) * 2) % 5;
          let c = ry === 3 ? P[0] : ry === 0 ? P[4] : bx === 0 ? P[1] : ry === 1 ? P[3] : P[2];
          if (bx !== 0 && ry !== 3 && t.hash((x + row * 3) / 5 | 0, row, 841) < 0.3) c = t.mix(c, P[1], 0.4);
          b.p[y * 16 + x] = c;
        }
      }
      if (th && th.mossy) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = t.fnoise(x, y, 4, 16, 843);
        if (v > 0.66 && (y & 3) !== 3) b.p[y * 16 + x] = v > 0.76 ? 0x9ab464 : 0x7a9a4c;
      }
      if (o.ridge) { b.rect(0, 0, 16, 3, P[1]); b.hline(0, 15, 0, P[0]); b.hline(0, 15, 1, P[3]); b.hline(0, 15, 3, P[0]); }
      if (o.eave) { b.hline(0, 15, 14, P[3]); b.hline(0, 15, 15, P[0]); }
      if (o.l) { b.vline(0, 0, 15, P[0]); b.vline(1, 0, 15, P[4]); }
      if (o.r) { b.vline(15, 0, 15, P[0]); b.vline(14, 0, 15, P[1]); }
      if (o.chimney) chimney(b, t);
      return b;
    },
    /** flat earthen roof with a parapet (desert) */
    flat(o, P, th, t) {
      const b = t.tex(16, 16, (x, y) => {
        const v = t.fnoise(x, y, 8, 16, 851);
        return t.hash(x, y, 853) < 0.05 ? P[2] : v < 0.35 ? P[2] : v > 0.72 ? P[4] : P[3];
      });
      const par = (x, y, lit) => b.set(x, y, lit ? P[5] : P[1]);
      if (o.ridge) for (let x = 0; x < 16; x++) { par(x, 0, false); par(x, 1, true); b.set(x, 2, P[4]); b.set(x, 3, t.mul(P[3], 0.85)); }
      if (o.l) for (let y = 0; y < 16; y++) { b.set(0, y, P[1]); b.set(1, y, P[5]); b.set(2, y, P[4]); }
      if (o.r) for (let y = 0; y < 16; y++) { b.set(15, y, P[0]); b.set(14, y, P[2]); b.set(13, y, P[3]); }
      if (o.eave) {
        for (let x = 0; x < 16; x++) { b.set(x, 13, P[5]); b.set(x, 14, P[4]); b.set(x, 15, P[1]); }
        // a clay water spout
        b.set(7, 15, 0x7a4a2a); b.set(8, 15, 0x5a3418);
      }
      if (o.chimney) chimney(b, t, true);
      return b;
    },
    /** slates in staggered courses (mine, snow, the white capital); snow on the snowy ones */
    slate(o, P, th, t) {
      const b = t.tile();
      for (let y = 0; y < 16; y++) {
        const row = y >> 2, ry = y & 3;
        for (let x = 0; x < 16; x++) {
          const bx = (x + (row % 2) * 3) % 6;
          let c = ry === 3 ? P[0] : bx === 0 ? P[1] : ry === 0 ? P[4] : P[3];
          if (c === P[3] && t.hash((x + (row % 2) * 3) / 6 | 0, row, 861) < 0.35) c = P[2];
          if (ry === 1 && bx === 2) c = P[5];
          b.p[y * 16 + x] = c;
        }
      }
      if (th && th.roofSnow) {
        // snow lies along every course and heavily on the upper rows
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          if ((y & 3) === 0 && t.hash(x, y, 863) < 0.7) b.p[y * 16 + x] = 0xe8eef4;
          else if ((y & 3) === 1 && t.hash(x, y, 865) < 0.25) b.p[y * 16 + x] = 0xc8d4e0;
        }
      }
      if (o.ridge) {
        b.rect(0, 0, 16, 3, P[2]); b.hline(0, 15, 0, P[0]); b.hline(0, 15, 1, P[4]); b.hline(0, 15, 3, P[0]);
        if (th && th.roofSnow) for (let x = 0; x < 16; x++) { b.set(x, 0, 0xc8d4e0); b.set(x, 1, 0xffffff); b.set(x, 2, 0xf0f4f8); b.set(x, 3, t.hash(x, 3, 867) < 0.6 ? 0xdce4ee : P[0]); }
      }
      if (o.eave) {
        b.hline(0, 15, 14, P[3]); b.hline(0, 15, 15, P[0]);
        if (th && th.roofSnow) for (let x = 0; x < 16; x++) { b.set(x, 14, 0xf4f8fc); if (x % 5 === 2) { b.set(x, 15, 0xc8e0f0); } } // icicle hints
      }
      if (o.l) { b.vline(0, 0, 15, P[0]); b.vline(1, 0, 15, P[4]); }
      if (o.r) { b.vline(15, 0, 15, P[0]); b.vline(14, 0, 15, P[1]); }
      if (o.chimney) chimney(b, t);
      return b;
    },
  };

  A.LOCAL_EXT = { GROUND, OBJ, DEFAULT_FLOOR, ANIM, THEME_OBJS, HOUSE, ROOF, BOG, MUD };
})(window.RPG);
