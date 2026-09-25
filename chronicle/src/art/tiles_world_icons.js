// Overworld location icons (RS1 look): R.Art.WORLD_ICONS[id](t, P, WP) → {buf, ox, oy, ink?}.
// Owner: A16a. Used by src/art/tiles_world.js (which outlines them and places
// them on their cell: buf pixel (0,0) lands at cell px (ox, oy)). Colours follow
// §11.2.2: walls and roofs 25–35 % less saturated and 5–10 % darker than Crest;
// only lights (lit windows, lava, gold points) stay bright.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});

  // muted material ramps (dark → light)
  const STONE = [0x3a3a42, 0x5e606a, 0x84868e, 0xa8a9ae, 0xcacacc];
  const ROOF_RED = [0x4e1c16, 0x6e2a20, 0x8e3e2c, 0xa85a42, 0xc07c62];
  const ROOF_BLUE = [0x1c2438, 0x2a3a58, 0x3c5478, 0x587098, 0x7c90b0];
  const ROOF_PORT = [0x4e1e14, 0x70301e, 0x92462c, 0xae6444, 0xc4845e]; // 赤茶の瓦
  const GOLD = [0x5a4418, 0x80622a, 0xa6843a, 0xc4a456, 0xdcc07a, 0xece0b0];
  const PLASTER = [0x5a4c3c, 0x8e7e64, 0xc0b092, 0xdcd0b4];
  const THATCH = [0x4e3a1c, 0x74582c, 0x987a44, 0xbca064];
  const WOOD = [0x2e1e10, 0x4a3220, 0x664830, 0x846244, 0xa07e5c];
  const WIN = 0x2a3448, DOOR = 0x3a2616, LIT = 0xecc868, LIT2 = 0xfff0b8;

  function wallBlock(b, x, y, w, h, ramp, o) {
    o = o || {};
    b.rect(x, y, w, h, ramp[2]);
    b.vline(x, y, y + h - 1, ramp[3]);
    b.vline(x + w - 1, y, y + h - 1, ramp[1]);
    if (o.bricks) for (let j = y + 2; j < y + h; j += 2) for (let i = x + 1 + ((j >> 1) % 2); i < x + w - 1; i += 3) b.set(i, j, ramp[1]);
    if (o.top !== false) b.hline(x, x + w - 1, y, ramp[4] || ramp[3]);
  }
  function cone(b, cx, top, hw, h, ramp) {
    b.poly([[cx + 0.5, top], [cx + hw + 1, top + h], [cx - hw, top + h]], ramp[2]);
    for (let y = top; y <= top + h; y++) for (let x = cx - hw; x <= cx + hw + 1; x++) {
      if (b.get(x, y) !== ramp[2]) continue;
      if (x > cx + 0.5) b.set(x, y, ramp[1]);
      else if (x < cx - 0.5 && (x + y) % 3 === 0) b.set(x, y, ramp[3]);
    }
  }
  /** gable house: walls w×4 under a pitched roof (roof ramp 4+) */
  function house(b, x, y, w, roof, wall, o) {
    o = o || {};
    b.rect(x, y + 4, w, 4, wall[2]); b.vline(x + w - 1, y + 4, y + 7, wall[1]); b.hline(x, x + w - 1, y + 7, wall[1]);
    if (o.timber) { b.vline(x + 1, y + 4, y + 6, WOOD[1]); b.vline(x + w - 2, y + 4, y + 6, WOOD[1]); }
    b.set(x + 1 + (o.timber ? 1 : 0), y + 5, WIN); b.set(x + w - 3, y + 5, o.lit ? LIT : WIN);
    b.rect(x + (w >> 1) - 1, y + 6, 2, 2, DOOR);
    b.poly([[x - 1, y + 4.5], [x + w / 2, y - 0.5], [x + w + 1, y + 4.5]], roof[2]);
    for (let yy = y; yy < y + 5; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (b.get(xx, yy) !== roof[2]) continue;
      if (xx >= x + w / 2) b.set(xx, yy, roof[1]);
      if ((yy - y) % 2 === 1 && xx < x + w / 2 && (xx + yy) % 2) b.set(xx, yy, roof[3]);
    }
    b.hline(x - 1, x + w, y + 4, roof[0]);
  }

  const ICONS = {
    loc_castle(t) {
      const b = t.buf(18, 21);
      wallBlock(b, 1, 11, 16, 9, STONE, { bricks: true });
      for (let x = 1; x < 17; x += 2) b.set(x, 10, STONE[3]);
      wallBlock(b, 0, 7, 4, 13, STONE); wallBlock(b, 14, 7, 4, 13, STONE);
      cone(b, 1, 2, 2, 5, ROOF_RED.slice(1)); cone(b, 15, 2, 2, 5, ROOF_RED.slice(1));
      wallBlock(b, 6, 5, 6, 8, STONE, { bricks: true });
      cone(b, 8, 0, 3, 5, ROOF_BLUE.slice(1));
      b.set(8, 0, GOLD[4]);
      b.rect(7, 15, 4, 5, 0x201818); b.hline(8, 9, 14, 0x201818); b.set(7, 15, STONE[2]); b.set(10, 15, STONE[2]);
      b.set(8, 8, 0x2a2230); b.set(9, 8, LIT); b.set(1, 10, 0x2a2230); b.set(16, 10, 0x2a2230);
      b.set(2, 13, 0x2a2230); b.set(15, 13, 0x2a2230);
      b.set(8, 1, 0x7a2a24); b.set(9, 1, 0x9a3a2c); // pennant
      return { buf: b, ox: -1, oy: -5 };
    },
    loc_town(t) {
      const b = t.buf(16, 16);
      house(b, 1, 1, 7, ROOF_RED, PLASTER, { timber: true });
      house(b, 9, 2, 6, ROOF_BLUE, PLASTER, { lit: true });
      house(b, 4, 8, 8, ROOF_RED, PLASTER, { timber: true });
      return { buf: b, ox: 0, oy: 0 };
    },
    loc_village(t, P, WP) {
      const b = t.buf(16, 16);
      const WL = [0x54402c, 0x80684a, 0xb49c78];
      const hut = (x, y, w) => {
        b.rect(x, y + 4, w, 4, WL[2]); b.vline(x + w - 1, y + 4, y + 7, WL[1]);
        b.rect(x + (w >> 1) - 1, y + 5, 2, 3, 0x33200e);
        b.poly([[x - 1, y + 4.5], [x + w / 2, y - 0.5], [x + w + 1, y + 4.5]], THATCH[2]);
        for (let yy = y; yy < y + 5; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
          if (b.get(xx, yy) !== THATCH[2]) continue;
          if (xx >= x + w / 2) b.set(xx, yy, THATCH[1]);
          else if ((xx * 2 + yy) % 3 === 0) b.set(xx, yy, THATCH[3]);
        }
        b.hline(x - 1, x + w, y + 4, THATCH[0]);
      };
      hut(1, 3, 7); hut(8, 7, 7);
      const F = WP.forest;
      b.shadeEllipse(12.5, 3.5, 3, 3, [F[2], F[3], F[4], F[5]]); b.rect(12, 6, 1, 2, WP.trunk[1]);
      b.set(3, 5, 0x6a6a70); b.set(3, 4, 0x8a8a90); // smoke stack stone
      return { buf: b, ox: 0, oy: 0 };
    },
    loc_port(t, P, WP) {
      // three red-brown roofs, a jetty and a moored boat with a furled sail (18×16)
      const b = t.buf(18, 16);
      house(b, 5, 0, 6, ROOF_PORT, PLASTER, { lit: true });
      house(b, 0, 4, 6, ROOF_PORT, PLASTER, { timber: true });
      house(b, 7, 6, 6, ROOF_PORT, PLASTER);
      // jetty
      for (let x = 11; x < 18; x++) { b.set(x, 13, WOOD[3]); b.set(x, 14, WOOD[1]); if (x % 3 === 0) b.set(x, 15, WOOD[0]); }
      b.set(11, 12, WOOD[4]); b.set(17, 12, WOOD[2]);
      // boat: hull, mast and the furled sail on the yard
      b.hline(13, 17, 11, WOOD[2]); b.hline(14, 16, 12, WOOD[1]); b.set(13, 10, WOOD[3]); b.set(17, 10, WOOD[3]);
      b.vline(15, 3, 10, WOOD[1]);
      b.hline(13, 17, 5, WOOD[2]);
      for (const [x, y] of [[13, 6], [14, 6], [15, 6], [16, 6], [17, 6], [14, 7], [16, 7]]) b.set(x, y, (x + y) % 2 ? 0xd8d0bc : 0xb8b0a0);
      b.set(15, 2, 0x8e3e2c);
      return { buf: b, ox: -1, oy: 0 };
    },
    loc_cave(t, P, WP) {
      const b = t.buf(18, 16), Rk = WP.rock;
      b.poly([[0, 15.5], [2, 8], [6, 3], [10, 2], [14, 5], [17, 10], [18, 15.5]], Rk[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 18; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const d = x - (9 + (y - 2) * 0.2);
        b.set(x, y, d > 3 ? Rk[2] : d > 0 ? Rk[3] : d < -5 ? Rk[3] : Rk[4]);
        if (t.hash(x, y, 5) < 0.1) b.set(x, y, Rk[2]);
      }
      b.line(4, 7, 6, 5, Rk[5]); b.line(10, 3, 12, 4, Rk[5]);
      b.ellipse(9, 13, 3.4, 4, 0x100a08); b.rect(6, 13, 7, 3, 0x100a08);
      b.hline(6, 12, 8, Rk[1]); b.set(5, 10, Rk[1]); b.set(13, 10, Rk[1]);
      return { buf: b, ox: -1, oy: 0 };
    },
    loc_mine(t, P, WP) {
      // rock face with a timber-framed adit, rails and a small ore cart (18×16)
      const b = t.buf(18, 16), Rk = WP.rock;
      b.poly([[0, 15.5], [1, 9], [4, 4], [9, 1], [13, 3], [17, 8], [18, 15.5]], Rk[3]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 18; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const d = x - (8 + (y - 2) * 0.25);
        b.set(x, y, d > 3 ? Rk[2] : d > 0 ? Rk[3] : Rk[4]);
        if (t.hash(x, y, 13) < 0.1) b.set(x, y, Rk[2]);
      }
      b.line(3, 7, 6, 4, Rk[5]); b.line(10, 2, 12, 3, Rk[5]);
      // adit
      b.rect(5, 8, 6, 8, 0x0e0a08);
      b.rect(4, 7, 2, 9, WOOD[2]); b.vline(4, 7, 15, WOOD[3]);
      b.rect(10, 7, 2, 9, WOOD[1]); b.vline(11, 7, 15, WOOD[0]);
      b.rect(3, 6, 10, 2, WOOD[3]); b.hline(3, 12, 6, WOOD[4]); b.hline(3, 12, 7, WOOD[1]);
      b.set(8, 10, LIT); // lamp deep inside
      // rails leaving the adit
      for (let y = 13; y < 16; y++) { b.set(6, y, 0x5a5c64); b.set(9, y, 0x5a5c64); }
      b.hline(6, 9, 14, WOOD[1]);
      // ore cart
      b.rect(12, 11, 5, 3, 0x4a4c56); b.hline(12, 16, 11, 0x7a7c86); b.vline(16, 11, 13, 0x34363e);
      b.set(13, 10, 0x8a6a4a); b.set(14, 10, 0xa08060); b.set(15, 10, 0x8a6a4a);
      b.set(13, 14, 0x1c1c20); b.set(15, 14, 0x1c1c20);
      return { buf: b, ox: -1, oy: 0 };
    },
    loc_forest(t, P, WP) {
      // two old trees leaning together into an arch; the way in is dark (18×18)
      const b = t.buf(18, 18), F = WP.forest, TR = WP.trunk;
      // the dark hollow first
      for (let y = 5; y < 18; y++) for (let x = 5; x < 13; x++) {
        const d = Math.abs(x - 8.5) / 4 + Math.max(0, 9 - y) / 7;
        if (d > 1) continue;
        b.set(x, y, y > 14 ? 0x1a2014 : d < 0.55 ? 0x06080a : 0x0e140e);
      }
      // path running in
      for (let y = 14; y < 18; y++) for (let x = 7; x < 11; x++) if ((x + y) % 3) b.set(x, y, y > 15 ? 0x6a5a3e : 0x4a4030);
      // trunks bending towards each other
      const trunk = (x0, dir) => {
        for (let y = 17; y >= 5; y--) {
          const x = Math.round(x0 + dir * Math.max(0, 11 - y) * 0.45);
          b.set(x, y, TR[2]); b.set(x + 1, y, TR[1]); b.set(x + 2, y, TR[0]);
          if (y > 13) { b.set(x - dir, y, TR[1]); }
        }
        b.set(x0 - dir * 2, 17, TR[1]); b.set(x0 + 3, 17, TR[0]); // roots
      };
      trunk(2, 1); trunk(13, -1);
      // canopies merging overhead
      const ramp = [F[1], F[2], F[3], F[4], F[5]];
      for (const [x, y, r] of [[3.5, 5, 3.6], [14.5, 5, 3.6], [6.5, 2.8, 3.4], [11.5, 2.8, 3.4], [9, 1.8, 3], [1.8, 8.5, 2.2], [16.2, 8.5, 2.2]]) b.shadeEllipse(x, y, r, r * 0.9, ramp, { dither: 0.6, amb: 0.25 });
      for (const [x, y] of [[4, 3], [7, 1], [12, 1], [13, 3], [9, 0]]) b.set(x, y, F[5]);
      for (const [x, y] of [[6, 5], [11, 5], [8, 4], [10, 4]]) b.set(x, y, F[1]);
      return { buf: b, ox: -1, oy: -2 };
    },
    loc_tower(t) {
      const b = t.buf(12, 25);
      const S = [0x38344a, 0x5e5a74, 0x86829a, 0xaeaabe, 0xd2cede], PU = [0x423250, 0x5c4a6c, 0x7a668a, 0x9a88a8];
      wallBlock(b, 2, 7, 8, 17, S, { bricks: true });
      wallBlock(b, 1, 5, 10, 3, S);
      for (let x = 1; x < 11; x += 2) b.set(x, 4, S[3]);
      cone(b, 5, 0, 3, 4, PU);
      b.set(5, 0, 0xeee2a8);
      for (const y of [9, 14, 19]) { b.set(5, y, 0x201830); b.set(6, y, 0x201830); b.set(5, y + 1, 0x201830); b.set(6, y + 1, 0x302040); }
      b.set(6, 9, LIT);
      b.rect(5, 21, 2, 3, 0x181020);
      return { buf: b, ox: 2, oy: -8 };
    },
    loc_library(t) {
      // white stone tower crowned by an open book (18×24)
      const b = t.buf(18, 24);
      const M = [0x7a7c88, 0xa0a2ae, 0xc4c6d0, 0xdcdee6, 0xf2f2f6];
      wallBlock(b, 4, 10, 10, 14, M, { bricks: true });
      b.rect(3, 22, 12, 2, M[1]); b.hline(3, 14, 22, M[3]);
      for (const y of [13, 18]) b.hline(4, 13, y, M[1]); // string courses
      // tall windows and the door
      for (const x of [6, 11]) { b.vline(x, 14, 16, 0x2a3048); b.set(x, 14, 0x3c4462); }
      b.vline(6, 19, 20, 0x2a3048); b.vline(11, 19, 20, 0x2a3048); b.set(11, 19, LIT);
      b.rect(8, 19, 2, 5, 0x3a3026); b.set(8, 19, 0x564838);
      // the open book: covers below, pages fanning up from the spine
      const COVER = [0x26304e, 0x3c4a78, 0x5a6aa0];
      b.poly([[0, 8.5], [8.5, 10.5], [8.5, 11.5], [0, 9.5]], COVER[1]);
      b.poly([[18, 8.5], [9.5, 10.5], [9.5, 11.5], [18, 9.5]], COVER[0]);
      b.poly([[0.5, 8], [3, 3.5], [8.5, 5.5], [8.5, 10.5]], 0xe6e0cc);
      b.poly([[17.5, 8], [15, 3.5], [9.5, 5.5], [9.5, 10.5]], 0xcac2ac);
      for (let k = 0; k < 3; k++) { b.line(2 + k, 7 - k * 0.6, 7, 8.5 - k * 1.2, 0x9a927e); b.line(16 - k, 7 - k * 0.6, 11, 8.5 - k * 1.2, 0x8a826e); }
      b.vline(9, 5, 10, 0x8a826e); b.vline(8, 5, 10, 0xf4f0e0);
      b.set(9, 4, GOLD[5]); // bookmark glint
      return { buf: b, ox: -1, oy: -8 };
    },
    loc_shrine(t) {
      const b = t.buf(16, 15);
      const S = [0x4c525e, 0x7c8290, 0xa8aeb8, 0xcfd3d8];
      b.rect(2, 7, 12, 7, S[2]); b.vline(13, 7, 13, S[1]); b.vline(2, 7, 13, S[3]);
      b.hline(1, 14, 14, S[1]);
      const roof = [0x16383a, 0x245658, 0x3a7676, 0x62999a];
      b.poly([[0, 7.5], [8, 1.5], [16, 7.5]], roof[2]);
      for (let y = 1; y < 8; y++) for (let x = 0; x < 16; x++) if (b.get(x, y) === roof[2] && x >= 8) b.set(x, y, roof[1]);
      b.hline(1, 14, 7, roof[0]);
      b.rect(7, 9, 2, 5, 0x1c1c28); b.set(7, 9, 0x302838);
      b.set(4, 9, 0x405070); b.set(11, 9, 0x405070);
      b.set(8, 0, GOLD[4]); b.set(8, 1, GOLD[3]);
      return { buf: b, ox: 0, oy: 1 };
    },
    loc_temple(t) {
      const b = t.buf(18, 16);
      const M = [0x626270, 0x9090a0, 0xbcbec8, 0xdcdde4, 0xf0f0f4];
      b.rect(0, 13, 18, 3, M[2]); b.hline(0, 17, 13, M[3]); b.hline(1, 16, 15, M[1]);
      b.rect(1, 5, 16, 2, M[3]);
      b.poly([[0, 5.5], [9, 0.5], [18, 5.5]], GOLD[3]);
      for (let y = 0; y < 6; y++) for (let x = 9; x < 18; x++) if (b.get(x, y) === GOLD[3]) b.set(x, y, GOLD[2]);
      b.set(9, 3, 0xf4f0e0);
      for (const x of [2, 6, 10, 14]) { b.rect(x, 7, 2, 6, M[3]); b.vline(x + 1, 7, 12, M[1]); }
      b.rect(7, 8, 3, 5, 0x505e84); b.set(8, 9, 0x8aa0d0);
      return { buf: b, ox: -1, oy: 0 };
    },
    loc_manor(t) {
      // grey manor with one spired tower; a single window glows (18×20)
      const b = t.buf(18, 20);
      const WL = [0x302c36, 0x4a4552, 0x645e6c, 0x7e7886, 0x98929e];
      const SL = [0x16141c, 0x24222c, 0x34313e, 0x464252];
      // main block and its roof
      wallBlock(b, 1, 10, 11, 10, WL);
      b.poly([[0, 10.5], [3, 5.5], [10, 5.5], [13, 10.5]], SL[2]);
      for (let y = 5; y <= 10; y++) for (let x = 0; x < 13; x++) if (b.get(x, y) === SL[2] && (x + y) % 2 === 0) b.set(x, y, SL[1]);
      b.hline(3, 10, 5, SL[3]); b.hline(0, 12, 10, SL[0]);
      b.rect(3, 3, 1, 3, WL[2]); b.set(3, 2, WL[3]); // chimney
      // tower with a pointed roof
      wallBlock(b, 12, 7, 5, 13, WL);
      b.poly([[11.5, 7.5], [14.5, -0.5], [17.5, 7.5]], SL[2]);
      for (let y = 0; y < 8; y++) for (let x = 11; x < 18; x++) if (b.get(x, y) === SL[2] && x > 14) b.set(x, y, SL[1]);
      b.set(14, 0, 0x7a7c86);
      // windows: all dark but one
      for (const [x, y] of [[3, 12], [6, 12], [9, 12], [3, 16], [9, 16], [14, 9]]) { b.set(x, y, 0x1a1822); b.set(x, y + 1, 0x14121a); }
      b.set(14, 13, LIT); b.set(14, 14, LIT2); b.set(15, 13, 0xb89048); b.set(15, 14, LIT);
      b.rect(5, 16, 3, 4, 0x221a16); b.set(6, 16, 0x3a2c22);
      return { buf: b, ox: -1, oy: -4 };
    },
    loc_pyramid(t) {
      const b = t.buf(20, 16);
      const lit = [0x9a7438, 0xbe9a58, 0xd6b87a, 0xe8d4a4], dark = [0x564020, 0x735630, 0x8e6c40];
      b.poly([[0, 15.5], [10, 0], [20, 15.5]], lit[2]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) {
        if (b.get(x, y) === t.NONE) continue;
        const right = x >= 10 + (y > 2 ? 0 : 1);
        let col = right ? dark[2] : lit[2];
        if (y % 3 === 1) col = right ? dark[1] : lit[1];
        b.set(x, y, col);
      }
      b.line(10, 1, 3, 12, lit[3]);
      b.vline(10, 1, 15, dark[0]);
      b.rect(9, 11, 3, 5, 0x241408); b.set(10, 10, 0x241408);
      b.set(10, 0, 0xf4ecd0);
      return { buf: b, ox: -2, oy: 0 };
    },
    loc_volcano(t) {
      const b = t.buf(20, 18), Rk = [0x221614, 0x3e2a22, 0x5a3c30, 0x76503e, 0x926a52];
      b.poly([[0, 17.5], [7, 4], [13, 4], [20, 17.5]], Rk[2]);
      for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
        if (b.get(x, y) === t.NONE) continue;
        b.set(x, y, x > 12 - (y - 4) * 0.2 ? Rk[1] : x < 8 ? Rk[3] : Rk[2]);
        if (t.hash(x, y, 9) < 0.08) b.set(x, y, Rk[1]);
      }
      b.hline(7, 12, 4, 0xffb840); b.hline(8, 11, 3, 0xf07020);
      b.line(9, 5, 8, 9, 0xe05818); b.line(8, 9, 6, 13, 0xa83810); b.set(9, 5, 0xffd060);
      b.line(12, 5, 13, 8, 0xa83810);
      const sm = [0x4a4450, 0x6a6470, 0x8c8692];
      b.shadeEllipse(10, 1.5, 2.2, 1.6, sm); b.shadeEllipse(13, 0.5, 1.6, 1.2, sm);
      return { buf: b, ox: -2, oy: -2 };
    },
    loc_demon(t) {
      const b = t.buf(20, 23);
      const S = [0x140c1c, 0x2a1e38, 0x403252, 0x58486c, 0x74668a];
      const spire = (cx, top, h) => { b.poly([[cx + 0.5, top], [cx + 2, top + h], [cx - 1, top + h]], S[2]); b.set(cx, top + h - 2, S[3]); };
      wallBlock(b, 1, 12, 18, 10, S, { bricks: true });
      for (let x = 1; x < 19; x += 2) b.set(x, 11, S[3]);
      wallBlock(b, 0, 7, 4, 15, S); wallBlock(b, 16, 7, 4, 15, S);
      spire(1, 1, 6); spire(17, 1, 6);
      wallBlock(b, 6, 4, 8, 10, S, { bricks: true });
      spire(9, 0, 4); spire(7, 1, 3); spire(12, 1, 3);
      b.rect(8, 16, 4, 6, 0x0a0408); b.hline(9, 10, 15, 0x0a0408);
      for (const [x, y] of [[8, 7], [11, 7], [2, 10], [17, 10], [4, 15], [15, 15]]) b.set(x, y, 0xd84040);
      b.set(9, 16, 0x701818); b.set(10, 16, 0x701818);
      return { buf: b, ox: -2, oy: -7, ink: 0x08040c };
    },
  };
  A.WORLD_ICONS = Object.assign(A.WORLD_ICONS || {}, ICONS);
})(window.RPG);
