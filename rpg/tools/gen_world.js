#!/usr/bin/env node
// Overworld generator → src/maps/world.js (DESIGN.md §7.1, §7.4).
//
//   node tools/gen_world.js            write src/maps/world.js
//   node tools/gen_world.js --dry      generate only (no write)
//   node tools/gen_world.js --dump f   on failure, write the unfinished map to f
// Then run `node tools/check_world.js` (progression, zones, docks; --png).
//
// Deterministic: seeded value noise + hand-authored geography. Every landmass
// is a union of ellipses/capsules, domain-warped and wobbled by fractal noise
// (natural coasts); biomes, mountain ranges, forests, rivers and lakes are
// painted on top from hand-placed shapes; location icons, the east gate, the
// demon island's barrier ring and the ship docks are placed exactly.
// Afterwards the generator repairs connectivity (a mountain on the only way to
// an icon becomes hills), picks docks, and splits the map into encounter-zone
// rectangles. Hand-tweak the world HERE, never in the output.
//
// East gate: the mountain wall between the start region and the east region has
// TWO shrine icons, one at each foot of the wall (4 mountain tiles between).
// The west icon warps to east_gate/'west' (world spawn east_gate_w sits on it),
// the east icon to east_gate/'east' (spawn east_gate_e). The icons are never
// adjacent, so crossing always goes through the gate map.
//
// Extra spawns beyond DESIGN §7.4: regnas_dock and milt_dock (teleporting to
// Regnas/Milt brings the ship along, like every other dock).
//
// Post-game (深淵の迷宮): a small rocky islet in the northern sea (ABYSS). Its
// centre stays plain ground until the flag game_clear; then the map's
// tilePatch shows a cave icon there and a step event (cond game_clear) warps
// into abyss_1. Spawns 'abyss_1' (that cell) and 'abyss_dock' (sea beside it).
'use strict';
const fs = require('fs');
const path = require('path');

const W = 128, H = 112, BORDER = 3;
const OUT = path.resolve(__dirname, '..', 'src', 'maps', 'world.js');

// ------------------------------------------------------------------ noise
function hash(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fractal noise in about [-1, 1] */
function fbm(x, y, s, scale = 8, oct = 3) {
  let sum = 0, amp = 1, f = 1 / scale, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, s + i * 7919);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return (sum / norm - 0.5) * 2.4;
}

// ------------------------------------------------------------ SDF shapes
// Signed distance in tiles (negative inside).
const ell = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
/** polyline capsule; radius interpolated from r0 to r1 along the line */
function cap(pts, r0, r1 = r0) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, at: total });
    total += len;
  }
  return (x, y) => {
    let best = Infinity;
    for (const s of segs) {
      const dx = s.bx - s.ax, dy = s.by - s.ay;
      const t = s.len ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / (s.len * s.len))) : 0;
      const d = Math.hypot(x - (s.ax + dx * t), y - (s.ay + dy * t));
      const r = r0 + (r1 - r0) * ((s.at + s.len * t) / (total || 1));
      best = Math.min(best, d - r);
    }
    return best;
  };
}
const union = (...fs) => (x, y) => { let m = Infinity; for (const f of fs) m = Math.min(m, f(x, y)); return m; };
const minus = (a, ...bs) => (x, y) => { let m = a(x, y); for (const b of bs) m = Math.max(m, -b(x, y)); return m; };
/** ring band around an ellipse outline, `w` tiles thick */
const ring = (cx, cy, rx, ry, w) => (x, y) => Math.abs(ell(cx, cy, rx, ry)(x, y)) - w / 2;

// ------------------------------------------------------------ the grid
const G = [];
for (let y = 0; y < H; y++) G.push(new Array(W).fill('~'));
const OWN = []; // landmass id per cell (null = sea)
for (let y = 0; y < H; y++) OWN.push(new Array(W).fill(null));
const PROTECT = []; // cells the connectivity repair must never touch
for (let y = 0; y < H; y++) PROTECT.push(new Array(W).fill(false));

const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const get = (x, y) => (inb(x, y) ? G[y][x] : '~');
const set = (x, y, ch) => { if (inb(x, y)) G[y][x] = ch; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

const WALK = new Set('.,TnbdfxkC=|VvOIAPYXH*'.split(''));
const ICON = new Set('CVvOIAPYXH'.split(''));
const WATER = new Set(['~', 'w']);
const walkable = (ch) => WALK.has(ch);
const isLand = (ch) => !WATER.has(ch) && ch !== '^';

// ------------------------------------------------------------ geography
/** domain-warp a shape: bends straight edges into natural curves */
/** everywhere (layer shapes that only use their density noise) */
const ALL = () => -1;
const warp = (f, amp, scale, seed) => (x, y) => f(x + amp * fbm(x, y, seed, scale, 2), y + amp * fbm(x, y, seed + 17, scale, 2));

// Land cells are painted with the landmass ground, then its layers in order:
// [char, shape, {amp, scale, seed, on, dens:[scale, threshold]}]
//   amp/scale : noise added to the shape's distance (ragged edges)
//   on        : chars the layer may overwrite (default: any land)
//   dens      : patchy fill, only where a second noise is above the threshold
const MEADOW = (seed) => [
  // small copses, hillocks and sunny fields sprinkled over open grass
  [',', ALL, { amp: 0, seed: seed + 1, on: '.', dens: [6, 0.66] }],
  ['T', ALL, { amp: 0, seed: seed + 2, on: '.,', dens: [2.2, 0.8] }],
  ['n', ALL, { amp: 0, seed: seed + 3, on: '.,', dens: [2.4, 0.84] }],
];
const DIVIDER = [[35, 24], [33, 32], [32, 40], [34, 47], [36, 53], [35, 60], [33, 67], [34, 74], [36, 82], [37, 90]];
const GATE_Y = 58;
// Post-game (深淵の迷宮, src/maps/abyss.js + src/events/postgame.js): a lone rocky islet in the
// northern sea. Its centre cell is plain ground until the demon king falls; then the world map's
// tilePatch (cond game_clear) raises a cave icon there and a step event (cond game_clear, warps
// have no cond) takes the party inside. World spawns: 'abyss_1' on that cell (escape / leaving
// the dungeon) and 'abyss_dock' on the sea beside the islet (reachable by ship from the start).
const ABYSS = { x: 72, y: 30, icon: 'O', event: 'abyss_entrance', cond: 'game_clear' };

const LANDS = [
  {
    // start continent: west region (castle, Milt, wind cave) | mountain wall | east region (Porta, fort)
    id: 'start', seed: 11, amp: 2.2, warp: [3.5, 14], ground: '.',
    body: minus(union(
      ell(18, 50, 12, 18),                        // west heartland
      ell(13, 35, 9, 5),                          // north-west highlands (wind cave)
      ell(21, 70, 10, 9),                         // south fields (castle)
      cap([[13, 74], [8, 80]], 4, 2.5),           // south-west cape
      cap([[25, 34], [27, 31]], 3, 2),            // north point
      cap(DIVIDER.slice(1, 8).concat([[35, 79]]), 5, 4), // land under the mountain wall
      ell(46, 46, 9, 15),                         // east region
      cap([[42, 36], [49, 32], [55, 31]], 4, 2.5), // north-east cape
      ell(45, 67, 8, 9),                          // bandit country
      cap([[45, 74], [50, 79]], 4, 3),            // south-east peninsula (fort)
    ), ell(3, 58, 3, 5), ell(28, 83, 4, 3), ell(58, 54, 3, 4), ell(39, 82, 3, 2)),
    layers: [
      [',', union(ell(19, 69, 9, 6), ell(46, 41, 5, 4)), { amp: 2.5, seed: 1, on: '.', dens: [5, 0.4] }],
      ...MEADOW(100),
      ['T', warp(union(ell(23, 39, 5, 4), ell(26, 60, 3.5, 7), ell(9, 56, 3, 4.5), ell(22, 74, 3, 2.5),
        ell(45, 56, 5, 5), ell(51, 69, 3, 5), ell(49, 34, 3, 2)), 2, 6, 3), { amp: 1.5, seed: 3 }],
      ['n', ell(13, 34, 9, 3.5), { amp: 1, seed: 5, on: '.,T', dens: [2.5, 0.3] }],
      ['n', cap(DIVIDER, 5.5), { amp: 1.5, seed: 7, on: '.,T', dens: [2.5, 0.42] }],
      ['n', ell(47, 76, 4, 3), { amp: 1, seed: 8, on: '.,T', dens: [2, 0.4] }],
      ['M', union(cap([[6, 31], [13, 29], [21, 31]], 2), ell(10, 78, 2.5, 1.8), ell(53, 32, 2, 1.6)), { amp: 1.2, seed: 9 }],
      ['M', union(cap(DIVIDER, 1.8), cap([[32, 40], [28, 37]], 1.1), cap([[33, 67], [29, 70]], 1), cap([[36, 50], [40, 48]], 1)), { amp: 1.2, scale: 4, seed: 13 }],
      ['M', cap(DIVIDER, 3.6), { amp: 1.5, scale: 5, seed: 14, dens: [3, 0.45] }],
      ['M', cap(DIVIDER.slice(2, 7), 4.5), { amp: 1.5, scale: 5, seed: 15, dens: [3, 0.5] }],
      ['x', union(ell(42, 72, 2.5, 2), ell(51, 78, 1.5, 1.2)), { amp: 1, seed: 17 }],
    ],
  },
  {
    // forest continent (south of Porta): Elfin in a clearing near the north shore, the water cave by the lake
    id: 'forest', seed: 21, amp: 2.2, warp: [3, 12], ground: '.',
    body: minus(union(ell(71, 91, 11, 10), ell(64, 80, 5.5, 4), ell(79, 81, 5, 4), ell(77, 101, 7, 5), cap([[61, 96], [56, 102]], 3.5, 2)),
      ell(71, 77, 3, 2.5), ell(57, 89, 3, 3.5), ell(87, 93, 3, 4), ell(68, 107, 3, 2)),
    layers: [
      ...MEADOW(200),
      ['T', ALL, { amp: 0, seed: 23, dens: [4, 0.3] }],
      ['.', ALL, { amp: 0, seed: 24, on: 'T', dens: [4, 0.82] }],
      ['T', warp(union(ell(68, 86, 6, 4), ell(66, 98, 5, 3), ell(80, 86, 4, 2.5), ell(77, 101, 4, 2.5)), 2, 6, 29), { amp: 1.5, seed: 29 }],
      ['.', union(ell(64, 80, 3.2, 2.4), ell(73, 88, 2.4, 1.6)), { amp: 0.8, seed: 43 }],
      ['M', union(cap([[80, 99], [83, 104]], 1.2), cap([[58, 88], [59, 94]], 1.1), cap([[75.5, 93.6], [78, 94]], 0.9)), { amp: 0.6, seed: 31 }],
      ['n', ell(82, 86, 3, 2), { amp: 1, seed: 37, dens: [2, 0.4] }],
      ['x', ell(67, 101, 3.5, 1.6), { amp: 1, seed: 41 }],
    ],
  },
  {
    // desert continent (far south-west): oasis town Salva on the east coast, the pyramid deep in the west
    id: 'desert', seed: 31, amp: 2.4, warp: [3.5, 14], ground: 'd',
    body: minus(union(ell(24, 98, 15, 7), ell(11, 94, 6, 5.5), ell(38, 94, 7, 5), cap([[30, 104], [36, 107]], 3, 2)), ell(20, 107, 4, 2.5)),
    layers: [
      ['.', ell(40, 92, 4.5, 3), { amp: 1.5, seed: 33 }],
      ['T', ell(42, 90.5, 1.6, 1.2), { amp: 0.6, seed: 34 }],
      ['n', ALL, { amp: 0, seed: 35, on: 'd', dens: [4.5, 0.74] }],
      ['M', union(cap([[19, 92], [24, 95], [27, 100]], 1.1), ell(9, 101, 1.8, 2.4), cap([[33, 103], [36, 105]], 1)), { amp: 1, seed: 39 }],
    ],
  },
  {
    id: 'temple', seed: 41, amp: 1, warp: [1.5, 6], ground: '.',
    body: union(ell(70, 52, 6, 4.5), ell(75, 48, 3, 2.5), ell(65, 50, 2.5, 2)),
    layers: [
      ['T', minus(ell(70, 51, 8, 6), ell(70, 52, 2.6, 2.2), cap([[70, 53], [70, 58]], 1)), { amp: 1, seed: 47 }],
      ['n', ell(75, 48, 2.5, 2), { amp: 0.8, seed: 48 }],
      ['M', ell(76, 47.5, 1.4, 1), { amp: 0.4, seed: 49 }],
    ],
  },
  {
    // snow continent: Frost on the south coast, the ice cave in the north-east peaks
    id: 'snow', seed: 51, amp: 2.2, warp: [3.5, 14], ground: '*',
    body: union(ell(38, 14, 12, 7), ell(56, 11, 11, 6.5), ell(76, 12, 12, 8), cap([[46, 18], [53, 21]], 3.5, 2), cap([[84, 7], [90, 6]], 3, 2),
      cap([[29, 11], [24, 7]], 3.5, 2.5), cap([[37, 17], [34, 20]], 3, 2)),
    layers: [
      ['f', warp(union(ell(44, 16, 4, 2.5), ell(69, 16, 5, 3), ell(26, 9, 3, 2.5), ell(78, 18, 3, 2), ell(56, 16, 3, 2), ell(40, 9, 3, 2)), 2.5, 6, 53), { amp: 1.5, seed: 53 }],
      ['f', ALL, { amp: 0, seed: 55, on: '*', dens: [4, 0.84] }],
      ['n', ALL, { amp: 0, seed: 56, on: '*', dens: [2.5, 0.84] }],
      ['M', union(cap([[30, 7], [36, 5], [46, 5], [56, 5], [61, 6]], 1.3), cap([[62, 6], [63, 10]], 1.5), cap([[63, 14], [61, 19]], 1.3),
        cap([[31, 10], [30, 14]], 1), cap([[46, 10], [51, 11], [54, 14]], 1.1), ell(85, 9, 4, 2.6), cap([[72, 6], [78, 7]], 1),
        cap([[74, 14], [79, 13]], 0.8), cap([[23, 6], [26, 5]], 1)), { amp: 1.1, seed: 59 }],
    ],
  },
  {
    // volcano island: a magma field around the crater
    id: 'volcano', seed: 61, amp: 1.8, warp: [2.5, 10], ground: 'k',
    body: union(ell(111, 12, 9.5, 7), ell(104, 17, 4, 3), cap([[118, 16], [121, 19]], 2.5)),
    layers: [
      ['n', ALL, { amp: 0, seed: 63, dens: [3, 0.62] }],
      ['M', cap([[104, 7], [110, 5], [117, 6], [120, 10]], 1.3), { amp: 1, seed: 65 }],
      ['L', minus(ell(112, 11, 5.5, 4.2), ell(112, 11, 1.5, 1.2)), { amp: 1.2, seed: 67 }],
      ['L', ell(118, 15, 1.8, 1.4), { amp: 0.8, seed: 68 }],
    ],
  },
  {
    // magic continent: Arcana in the western bay, the star tower on a walled plateau
    id: 'arcana', seed: 71, amp: 2.2, warp: [3.5, 14], ground: '.',
    body: minus(union(ell(108, 49, 11, 16), ell(116, 36, 7, 6), ell(102, 63, 7, 5), ell(100, 42, 5, 5)), ell(95, 51, 3, 3), ell(122, 56, 3, 4)),
    layers: [
      ...MEADOW(300),
      [',', ell(104, 56, 5, 4), { amp: 2, seed: 73, on: '.' }],
      ['T', warp(union(ell(112, 53, 4, 6), ell(106, 40, 3, 3), ell(101, 64, 4, 3)), 2, 6, 75), { amp: 1.5, seed: 75 }],
      ['n', ell(114, 42, 5, 2.5), { amp: 1, seed: 77, dens: [2, 0.4] }],
      ['n', cap([[99, 36], [103, 41], [106, 47]], 2.6), { amp: 1, seed: 78, on: '.,T', dens: [2.5, 0.4] }],
      ['M', cap([[100, 37], [103, 41], [105, 45]], 1.1), { amp: 1, seed: 76 }],
      ['M', minus(ell(117, 35, 6, 5.5), ell(117, 35, 3.2, 2.8), cap([[117, 38], [117, 43]], 1)), { amp: 0.8, seed: 79 }],
      ['x', ell(114, 62, 3, 2), { amp: 1, seed: 81 }],
    ],
  },
  {
    // demon island: wasteland, the castle inside a ring of peaks
    id: 'demon', seed: 81, amp: 1.8, warp: [2.5, 10], ground: 'k',
    body: union(ell(110, 93, 8.5, 8), ell(104, 99, 4, 3), ell(114, 99.5, 4, 2.6), cap([[106, 87], [102, 84]], 2.5, 1.8), cap([[116, 88], [117, 85]], 2.2, 1.6)),
    layers: [
      ['n', ALL, { amp: 0, seed: 83, dens: [3, 0.62] }],
      ['M', union(minus(ell(110, 93, 5.5, 4.5), ell(110, 93, 2.5, 2), cap([[108, 94], [102, 97]], 1)),
        cap([[117, 85], [119, 90]], 1), cap([[114, 101], [118, 100]], 0.9), cap([[104, 88], [106, 91]], 0.9)), { amp: 0.8, seed: 85 }],
      ['x', union(ell(103, 99, 3, 2), ell(118, 88, 2, 2), ell(104, 85, 1.6, 1.2), ell(113, 101, 2, 1)), { amp: 1, seed: 87 }],
    ],
  },
  {
    id: 'edge', seed: 91, amp: 0.5, warp: [0.5, 4], ground: '.',
    body: ell(95, 90, 2.6, 2.2),
    layers: [],
  },
  {
    // post-game islet (深淵の迷宮, see ABYSS below): bare rock and scree under a lone crag
    id: 'abyss', seed: 111, amp: 0.5, warp: [0.8, 4], ground: 'k',
    body: union(ell(ABYSS.x, ABYSS.y, 2.9, 2.2), ell(ABYSS.x + 1.5, ABYSS.y - 1.6, 1.8, 1.3)),
    layers: [
      ['n', ALL, { amp: 0, seed: 113, dens: [1.6, 0.62] }],
      ['M', ell(ABYSS.x + 1.6, ABYSS.y - 2, 1.3, 0.8), { amp: 0.3, seed: 115 }],
    ],
  },
  {
    // small uninhabited islands
    id: 'isle', seed: 101, amp: 1, warp: [1, 5], ground: '.',
    body: union(ell(6, 21, 2, 2.5), ell(61, 37, 2.2, 1.6), ell(87, 62, 2.2, 1.8), ell(90, 29, 1.8, 1.5), ell(51, 91, 2, 1.5), ell(61, 71, 1.6, 1.3), ell(81, 39, 2, 1.4), ell(79, 64, 1.5, 1.2)),
    layers: [['T', ALL, { amp: 0, seed: 103, dens: [2, 0.25] }], ['n', ALL, { amp: 0, seed: 104, on: '.', dens: [2, 0.7] }]],
  },
];

const ZONE_OF_LAND = {
  start: 'w_start', forest: 'w_forest', desert: 'w_desert', temple: 'w_forest', snow: 'w_snow',
  volcano: 'w_volcano', arcana: 'w_arcana', demon: 'w_demon', edge: 'w_demon', isle: null, abyss: 'w_demon',
};

// ------------------------------------------------------------- locations
// icon char, map id, landmass; `coast` slides the icon that way onto the shore
const ICONS = [
  { map: 'regnas_castle', ch: 'C', x: 15, y: 63, land: 'start' },
  { map: 'regnas_town', ch: 'V', x: 17, y: 63, land: 'start' },
  { map: 'milt_village', ch: 'v', x: 26, y: 42, land: 'start' },
  { map: 'wind_cave_1', ch: 'O', x: 13, y: 33, land: 'start' },
  { map: 'porta_town', ch: 'V', x: 53, y: 45, land: 'start', coast: 'e' },
  { map: 'bandit_fort_1', ch: 'C', x: 48, y: 77, land: 'start' },
  { map: 'elfin_village', ch: 'v', x: 64, y: 80, land: 'forest' },
  { map: 'water_cave_1', ch: 'O', x: 76, y: 95, land: 'forest' },
  { map: 'salva_town', ch: 'V', x: 40, y: 92, land: 'desert' },
  { map: 'pyramid_1', ch: 'P', x: 12, y: 97, land: 'desert' },
  { map: 'frost_village', ch: 'v', x: 36, y: 18, land: 'snow' },
  { map: 'ice_cave_1', ch: 'O', x: 84, y: 13, land: 'snow' },
  { map: 'volcano_1', ch: 'Y', x: 112, y: 11, land: 'volcano' },
  { map: 'arcana_city', ch: 'V', x: 100, y: 51, land: 'arcana', coast: 'w' },
  { map: 'star_tower_1', ch: 'I', x: 117, y: 35, land: 'arcana' },
  { map: 'light_temple', ch: 'H', x: 70, y: 52, land: 'temple' },
  { map: 'edge_shrine', ch: 'A', x: 95, y: 90, land: 'edge' },
  { map: 'demon_castle_1', ch: 'X', x: 110, y: 93, land: 'demon' },
];
// docks: sea spawn next to the coast, reachable on foot from `from`;
// `spawn:false` only guarantees a landing place (no spawn)
const DOCKS = [
  { name: 'porta_dock', from: 'porta_town', near: [57, 45] },
  { name: 'regnas_dock', from: 'regnas_castle', near: [9, 66] },
  { name: 'milt_dock', from: 'milt_village', near: [25, 30] },
  { name: 'elfin_dock', from: 'elfin_village', near: [63, 75] },
  { name: 'salva_dock', from: 'salva_town', near: [44, 91] },
  { name: 'frost_dock', from: 'frost_village', near: [36, 24] },
  { name: 'volcano_dock', from: 'volcano_1', near: [102, 19] },
  { name: 'arcana_dock', from: 'arcana_city', near: [96, 51] },
  { name: 'light_temple_dock', from: 'light_temple', near: [70, 57] },
  { name: 'edge_shrine_dock', from: 'edge_shrine', near: [95, 93], inRing: true },
  { name: 'demon_landing', from: 'demon_castle_1', near: [100, 95], inRing: true, spawn: false },
];
// rivers (1 tile wide, sea tiles) and the bridge spots on them
const RIVERS = [
  { pts: [[30, 46], [27, 47], [24, 49], [19, 49], [15, 48], [11, 50], [7, 51], [2, 51]], bridges: [[20, 49]] },
  { pts: [[112, 45], [116, 46], [120, 45], [125, 46]], bridges: [[118, 46]] },
  { pts: [[40, 51], [43, 52], [46, 52], [49, 51], [53, 52], [60, 52]], bridges: [[45, 52]] },
];
const LAKES = [
  { shape: ell(31, 45, 1.8, 1.3), amp: 0.3 },
  { shape: ell(72, 95, 2.8, 1.8), amp: 0.6 },
  { shape: ell(38, 93, 1.6, 1.2), amp: 0.3 },
  { shape: ell(51, 14, 2.5, 1.5), amp: 0.6 },
];
// demon island barrier ring
const RING = { cx: 106, cy: 93, rx: 17, ry: 14.5, w: 1.8 };
const REEFS = [
  ell(60, 42, 1.5, 1), ell(88, 44, 1.2, 1.6), ell(47, 88, 2, 1), ell(123, 26, 1, 2), ell(96, 22, 1.5, 1),
  ell(20, 25, 2, 1), ell(4, 86, 1, 2), ell(78, 66, 1.5, 1), ell(56, 104, 1.5, 1), ell(88, 76, 1.5, 1),
];

// ------------------------------------------------------------- painting
function paintLands() {
  const bodies = LANDS.map((L) => warp(L.body, L.warp[0], L.warp[1], L.seed + 500));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = null, bd = 0;
    LANDS.forEach((L, i) => {
      const d = bodies[i](x, y) + fbm(x, y, L.seed, 6) * L.amp;
      if (d < bd) { bd = d; best = L; }
    });
    if (best) { G[y][x] = best.ground; OWN[y][x] = best.id; }
  }
  for (const L of LANDS) {
    for (const [ch, shape, o] of L.layers) {
      const amp = o.amp == null ? 1 : o.amp, seed = o.seed || 1, scale = o.scale || 5;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (OWN[y][x] !== L.id || WATER.has(G[y][x])) continue;
        if (o.on && !o.on.includes(G[y][x])) continue;
        if (shape(x, y) + fbm(x, y, seed, scale) * amp >= 0) continue;
        if (o.dens && (fbm(x, y, seed + 1000, o.dens[0], 2) + 1) / 2 < o.dens[1]) continue;
        G[y][x] = ch;
      }
    }
  }
}

/** landmasses must stay apart (at least two sea tiles between different lands) */
function checkSeparation() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = OWN[y][x];
    if (!a || !isLand(G[y][x])) continue;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const b = inb(x + i, y + j) && isLand(G[y + j][x + i]) ? OWN[y + j][x + i] : null;
      if (b && b !== a && !(a === 'isle' && b === 'isle')) throw new Error(`lands ${a} and ${b} nearly touch at ${x},${y}`);
    }
  }
}

function enforceBorder() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) { G[y][x] = '~'; OWN[y][x] = null; }
  }
}

/** smooth coasts: drop 1-tile spikes and fill 1-tile notches */
function smoothCoasts() {
  for (let pass = 0; pass < 2; pass++) {
    const flips = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const land = isLand(G[y][x]);
      let n = 0;
      for (const [dx, dy] of N4) if (isLand(G[y + dy][x + dx]) !== land) n++;
      if (n >= 3) flips.push([x, y, land]);
    }
    for (const [x, y, land] of flips) {
      if (land) { G[y][x] = '~'; OWN[y][x] = null; }
      else {
        const o = N4.map(([dx, dy]) => OWN[y + dy][x + dx]).find((v) => v);
        const L = LANDS.find((l) => l.id === o);
        G[y][x] = L ? L.ground : '.';
        OWN[y][x] = o || null;
      }
    }
  }
}

/** connected components of cells matching pred (4-neighbour) */
function components(pred) {
  const lab = [];
  for (let y = 0; y < H; y++) lab.push(new Int32Array(W).fill(-1));
  const comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (lab[y][x] >= 0 || !pred(G[y][x], x, y)) continue;
    const id = comps.length, cells = [[x, y]];
    lab[y][x] = id;
    for (let i = 0; i < cells.length; i++) {
      const [cx, cy] = cells[i];
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inb(nx, ny) || lab[ny][nx] >= 0 || !pred(G[ny][nx], nx, ny)) continue;
        lab[ny][nx] = id; cells.push([nx, ny]);
      }
    }
    comps.push(cells);
  }
  return { lab, comps };
}

/** remove land specks (< 5 cells) and fill enclosed sea pockets (lakes are painted later) */
function cleanSpecks() {
  const land = components((ch) => isLand(ch));
  for (const cells of land.comps) if (cells.length < 5) for (const [x, y] of cells) { G[y][x] = '~'; OWN[y][x] = null; }
  const sea = components((ch) => ch === '~');
  for (const cells of sea.comps) {
    if (cells.some(([x, y]) => x === 0 && y === 0)) continue;
    for (const [x, y] of cells) {
      const o = N4.map(([dx, dy]) => OWN[y + dy] && OWN[y + dy][x + dx]).find((v) => v);
      const L = LANDS.find((l) => l.id === o);
      G[y][x] = L ? L.ground : '.'; OWN[y][x] = o || null;
    }
  }
}

/** 4-connected raster of a polyline */
function rasterLine(pts) {
  const out = [];
  const push = (x, y) => { const l = out[out.length - 1]; if (!l || l[0] !== x || l[1] !== y) out.push([x, y]); };
  for (let i = 0; i < pts.length - 1; i++) {
    let [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    push(x0, y0);
    while (x0 !== x1 || y0 !== y1) {
      const e2 = 2 * err;
      // step one axis at a time → 4-connected
      if (e2 > -dy && (dx >= dy || !(e2 < dx))) { err -= dy; x0 += sx; }
      else { err += dx; y0 += sy; }
      push(x0, y0);
    }
  }
  return out;
}

function paintWaters() {
  for (const lk of LAKES) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (lk.shape(x, y) + fbm(x, y, 777, 3) * lk.amp < 0 && isLand(G[y][x])) { G[y][x] = '~'; PROTECT[y][x] = true; }
    }
  }
  for (const rv of RIVERS) {
    const cells = rasterLine(rv.pts);
    for (const [x, y] of cells) if (inb(x, y)) { G[y][x] = '~'; PROTECT[y][x] = true; }
    for (const [bx, by] of rv.bridges) {
      if (get(bx, by) !== '~') throw new Error(`bridge ${bx},${by} is not on the river`);
      const ew = isLand(get(bx, by - 1)) && isLand(get(bx, by + 1)) && get(bx - 1, by) === '~' && get(bx + 1, by) === '~';
      const ns = isLand(get(bx - 1, by)) && isLand(get(bx + 1, by)) && get(bx, by - 1) === '~' && get(bx, by + 1) === '~';
      if (!ew && !ns) throw new Error(`bridge ${bx},${by}: river is not straight there`);
      // E-W flowing river → walk across north-south (vertical bridge)
      set(bx, by, ew ? '|' : '=');
      const [ax, ay, cx, cy] = ew ? [bx, by - 1, bx, by + 1] : [bx - 1, by, bx + 1, by];
      for (const [px, py] of [[ax, ay], [cx, cy]]) if (!walkable(get(px, py))) set(px, py, '.');
    }
  }
}

// divider wall + gate icons
let GATE = null;
function paintDivider() {
  const f = cap(DIVIDER, 0);
  // core: for each row, the two cells nearest the polyline (never opened up)
  const core = {};
  for (let y = 0; y < H; y++) {
    let bx = -1, bd = Infinity;
    for (let x = 20; x < 50; x++) { const d = f(x + 0.5, y); if (d < bd) { bd = d; bx = x; } }
    if (bd > 3) continue;
    core[y] = bx;
    for (const x of [bx - 1, bx]) {
      PROTECT[y][x] = true;
      if (isLand(G[y][x])) G[y][x] = 'M';
    }
  }
  const c = core[GATE_Y];
  if (c == null) throw new Error('gate row not on the divider');
  // the pass: a 4-wide wall with a gatehouse at each foot, cliffs above and below them
  GATE = { y: GATE_Y, w: c - 3, e: c + 2 };
  for (let dy = -1; dy <= 1; dy++) for (let x = c - 2; x <= c + 1; x++) { set(x, GATE_Y + dy, 'M'); PROTECT[GATE_Y + dy][x] = true; }
  for (const [x, dx] of [[GATE.w, -1], [GATE.e, 1]]) {
    set(x, GATE_Y, 'A');
    PROTECT[GATE_Y][x] = true;
    for (const dy of [-1, 1]) { set(x, GATE_Y + dy, 'M'); PROTECT[GATE_Y + dy][x] = true; }
    set(x + dx, GATE_Y, '.');
    PROTECT[GATE_Y][x + dx] = true;
    for (const dy of [-1, 1]) if (get(x + dx, GATE_Y + dy) === 'M') set(x + dx, GATE_Y + dy, 'n');
  }
}

const STEP = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] };
function paintIcons() {
  for (const ic of ICONS) {
    if (ic.coast) {
      // slide onto the shore: the icon ends on the last land cell before the open sea
      const [dx, dy] = STEP[ic.coast];
      while (!isLand(get(ic.x, ic.y))) { ic.x -= dx; ic.y -= dy; }
      while (isLand(get(ic.x + dx, ic.y + dy))) { ic.x += dx; ic.y += dy; }
    }
    if (!isLand(get(ic.x, ic.y)) || OWN[ic.y][ic.x] !== ic.land) throw new Error(`icon ${ic.map} at ${ic.x},${ic.y} is not on ${ic.land} (${get(ic.x, ic.y)})`);
    set(ic.x, ic.y, ic.ch);
    PROTECT[ic.y][ic.x] = true;
    // no swamp/magma/mountain right next to a town (caves & the volcano may sit in rock)
    const L = LANDS.find((l) => l.id === ic.land);
    for (const [dx, dy] of N8) {
      const ch = get(ic.x + dx, ic.y + dy);
      if (PROTECT[ic.y + dy][ic.x + dx]) continue;
      if (ch === 'x' || ch === 'L' || (ch === 'M' && !'OY'.includes(ic.ch))) set(ic.x + dx, ic.y + dy, ch === 'M' ? passChar(ic.land) : L.ground);
      // keep towns readable: no tree canopy over the icon
      else if ((ch === 'T' || ch === 'f') && !'OY'.includes(ic.ch)) set(ic.x + dx, ic.y + dy, L.ground === 'k' ? 'k' : ch === 'f' ? '*' : '.');
    }
  }
}

function paintRing() {
  const f = ring(RING.cx, RING.cy, RING.rx, RING.ry, RING.w);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (f(x, y) + fbm(x, y, 999, 4) * 0.35 < 0) {
      if (isLand(G[y][x])) throw new Error(`barrier ring hits land at ${x},${y}`);
      G[y][x] = 'w';
    }
  }
}

function paintReefs() {
  for (const r of REEFS) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (G[y][x] === '~' && r(x, y) < 0 && (x + y) % 2 === 0) G[y][x] = '^';
    }
  }
}

/** walkable specks walled in by mountains/magma (never reachable) become rock */
function sealPockets() {
  const seen = [];
  for (let y = 0; y < H; y++) seen.push(new Uint8Array(W));
  const q = [];
  const add = (x, y) => { if (!seen[y][x]) { seen[y][x] = 1; q.push([x, y]); } };
  add(SPAWNS.porta_dock.x, SPAWNS.porta_dock.y);
  for (const ic of ICONS) add(ic.x, ic.y);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i], sea = WATER.has(G[y][x]);
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const ch = G[ny][nx];
      if (walkable(ch) || (sea && WATER.has(ch))) add(nx, ny);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (walkable(G[y][x]) && !seen[y][x]) { G[y][x] = 'M'; PROTECT[y][x] = true; }
  }
}

/** hills/mountains take their ground colour from nearby plain cells (tiles_world
 *  resolveClass looks 2 cells around); on non-green land make sure there is one */
function fixDerived() {
  const plainLand = (ch) => isLand(ch) && ch !== 'n' && ch !== 'M' && !ICON.has(ch) && ch !== 'L';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const own = OWN[y][x];
    const L = own && LANDS.find((l) => l.id === own);
    if (!L || L.ground === '.' || (G[y][x] !== 'n' && G[y][x] !== 'M') || PROTECT[y][x]) continue;
    let ok = false;
    for (let j = -2; j <= 2 && !ok; j++) for (let i = -2; i <= 2; i++) if (plainLand(get(x + i, y + j))) { ok = true; break; }
    // swamp next to a hill would tint it green
    if (G[y][x] === 'n' && N8.some(([dx, dy]) => get(x + dx, y + dy) === 'x')) ok = false;
    if (!ok) G[y][x] = L.ground;
  }
}

/** sandy beaches on some stretches of open coast */
function paintBeaches() {
  const ocean = oceanMask(true);
  const marks = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = G[y][x];
    if (!'.,T'.includes(ch)) continue;
    const L = OWN[y][x];
    if (!['start', 'forest', 'temple', 'arcana', 'edge', 'isle'].includes(L)) continue;
    if (!N4.some(([dx, dy]) => inb(x + dx, y + dy) && ocean[y + dy][x + dx])) continue;
    const n = fbm(x, y, 4242, 7, 2);
    if (n > 0.1 || (L === 'edge') || (L === 'temple' && n > -0.3)) marks.push([x, y]);
  }
  for (const [x, y] of marks) G[y][x] = 'b';
}
/** sea cells connected to the open ocean (map corner); through the barrier ring if `barrier` */
function oceanMask(barrier) {
  const m = [];
  for (let y = 0; y < H; y++) m.push(new Array(W).fill(false));
  const q = [[0, 0]];
  m[0][0] = true;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || m[ny][nx] || !(G[ny][nx] === '~' || (barrier && G[ny][nx] === 'w'))) continue;
      m[ny][nx] = true; q.push([nx, ny]);
    }
  }
  return m;
}

// ------------------------------------------------------------- repairs
function bfsWalk(sx, sy) {
  const seen = [];
  for (let y = 0; y < H; y++) seen.push(new Uint8Array(W));
  const q = [[sx, sy]];
  seen[sy][sx] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || seen[ny][nx] || !walkable(G[ny][nx])) continue;
      seen[ny][nx] = 1; q.push([nx, ny]);
    }
  }
  return seen;
}
/** make (tx,ty) reachable from the region reached from (sx,sy): cheapest path
 *  through mountains/magma (never water, never protected cells) is opened up */
function connect(sx, sy, tx, ty, land) {
  const seen = bfsWalk(sx, sy);
  if (seen[ty][tx]) return 0;
  const dist = [], prev = [];
  for (let y = 0; y < H; y++) { dist.push(new Float64Array(W).fill(Infinity)); prev.push(new Int32Array(W).fill(-1)); }
  const heap = [];
  const push = (d, x, y) => { heap.push([d, x, y]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (seen[y][x]) { dist[y][x] = 0; push(0, x, y); }
  const cost = (x, y) => {
    const ch = G[y][x];
    if (x === tx && y === ty) return 1;
    if (PROTECT[y][x] || OWN[y][x] !== land) return Infinity;
    if (walkable(ch)) return 1;
    if (ch === 'M' || ch === 'L') return 6;
    return Infinity;
  };
  while (heap.length) {
    const [d, x, y] = pop();
    if (d > dist[y][x]) continue;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const c = cost(nx, ny);
      if (c === Infinity || d + c >= dist[ny][nx]) continue;
      dist[ny][nx] = d + c; prev[ny][nx] = y * W + x; push(d + c, nx, ny);
    }
  }
  if (dist[ty][tx] === Infinity) throw new Error(`cannot connect ${tx},${ty} on ${land}`);
  let n = 0, cur = prev[ty][tx];
  while (cur >= 0) {
    const x = cur % W, y = (cur / W) | 0;
    if (seen[y][x]) break;
    const ch = G[y][x];
    if (ch === 'M' || ch === 'L') { G[y][x] = passChar(land); n++; }
    cur = prev[y][x];
  }
  return n;
}
const iconOf = (map) => ICONS.find((i) => i.map === map);
/** what an opened-up mountain becomes: hills on green land, bare ground elsewhere */
function passChar(land) {
  const g = LANDS.find((l) => l.id === land).ground;
  return g === '.' ? 'n' : g;
}
function repairConnectivity() {
  const groups = [
    ['regnas_castle', 'regnas_town', 'milt_village', 'wind_cave_1', { gate: 'w' }],
    ['porta_town', 'bandit_fort_1', { gate: 'e' }],
    ['elfin_village', 'water_cave_1'],
    ['salva_town', 'pyramid_1'],
    ['frost_village', 'ice_cave_1'],
    ['arcana_city', 'star_tower_1'],
  ];
  for (const g of groups) {
    const a = iconOf(g[0]);
    for (const t of g.slice(1)) {
      const p = typeof t === 'string' ? iconOf(t) : { x: GATE[t.gate], y: GATE.y };
      const n = connect(a.x, a.y, p.x, p.y, a.land);
      if (n) console.log(`  opened ${n} tile(s) toward ${typeof t === 'string' ? t : 'gate ' + t.gate}`);
    }
  }
}

// ------------------------------------------------------------- docks
const SPAWNS = {};
/** sailable-without-barrier sea (ocean) and the sea inside the barrier ring */
function seaMasks() {
  const ocean = oceanMask(false), all = oceanMask(true);
  const inner = all.map((row, y) => row.map((v, x) => v && !ocean[y][x] && G[y][x] === '~'));
  return { ocean, inner };
}
/** make sure a stretch of shore near `near` is walkable and joined to the icon */
function openShore(d, masks) {
  const water = d.inRing ? masks.inner : masks.ocean;
  const ic = iconOf(d.from);
  let best = null, bd = Infinity;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (OWN[y][x] !== ic.land || !isLand(G[y][x]) || PROTECT[y][x] || ICON.has(G[y][x])) continue;
    if (!N4.some(([dx, dy]) => inb(x + dx, y + dy) && water[y + dy][x + dx])) continue;
    const dd = Math.hypot(x - d.near[0], y - d.near[1]);
    if (dd < bd) { bd = dd; best = [x, y]; }
  }
  if (!best) throw new Error(`no shore for ${d.name}`);
  const [x, y] = best;
  if (G[y][x] === 'M' || G[y][x] === 'L') G[y][x] = passChar(ic.land);
  const n = connect(ic.x, ic.y, x, y, ic.land);
  if (n) console.log(`  opened ${n} tile(s) from ${d.from} to the shore`);
}
function placeDocks() {
  const masks = seaMasks();
  for (const d of DOCKS) openShore(d, masks);
  for (const d of DOCKS) {
    if (d.spawn === false) continue;
    const water = d.inRing ? masks.inner : masks.ocean;
    const ic = iconOf(d.from);
    const seen = bfsWalk(ic.x, ic.y);
    let best = null, bd = Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!water[y][x]) continue;
      // open water around (the ship should not park in a river mouth)
      let open = 0;
      for (const [dx, dy] of N8) if (get(x + dx, y + dy) === '~') open++;
      if (open < 4) continue;
      const shore = N4.find(([dx, dy]) => inb(x + dx, y + dy) && seen[y + dy][x + dx] && !ICON.has(G[y + dy][x + dx]));
      if (!shore) continue;
      const dd = Math.hypot(x - d.near[0], y - d.near[1]);
      if (dd < bd) { bd = dd; best = { x, y, dir: dirAway(shore) }; }
    }
    if (!best) throw new Error(`no dock for ${d.name}`);
    SPAWNS[d.name] = best;
  }
}
// ------------------------------------------------------------- post-game islet
/** the abyss entrance cell (plain ground; a cave icon after game_clear) and the dock beside the islet */
function placeAbyss() {
  const { x, y } = ABYSS;
  if (OWN[y][x] !== 'abyss' || !isLand(G[y][x])) throw new Error(`abyss entrance ${x},${y} is not on the islet`);
  set(x, y, LANDS.find((l) => l.id === 'abyss').ground);
  PROTECT[y][x] = true;
  const seen = bfsWalk(x, y);
  const ocean = oceanMask(false);
  let best = null, bd = Infinity;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!ocean[j][i]) continue;
    let open = 0;
    for (const [dx, dy] of N8) if (get(i + dx, j + dy) === '~') open++;
    if (open < 4) continue;
    const shore = N4.find(([dx, dy]) => inb(i + dx, j + dy) && seen[j + dy][i + dx] && !(i + dx === x && j + dy === y));
    if (!shore) continue;
    const dd = Math.hypot(i - x, j - (y + 3)); // the south shore: the side ships come from
    if (dd < bd) { bd = dd; best = { x: i, y: j, dir: dirAway(shore) }; }
  }
  if (!best) throw new Error('no dock for the abyss islet');
  SPAWNS.abyss_dock = best;
}

/** facing on arrival at an icon: toward open ground (down preferred) */
function exitDir(x, y) {
  for (const [d, dx, dy] of [['down', 0, 1], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1]]) {
    const ch = get(x + dx, y + dy);
    if (walkable(ch) && !ICON.has(ch)) return d;
  }
  throw new Error(`icon at ${x},${y} has no open neighbour`);
}
const dirAway = ([dx, dy]) => (dx === 1 ? 'left' : dx === -1 ? 'right' : dy === 1 ? 'up' : 'down');

// ------------------------------------------------------------- zones
// Every walkable cell gets the land zone of its region, every sailable cell a
// sea zone. Land rectangles (listed first) never contain sailable cells; the
// sea is covered by two big rectangles + the default zone.
const SEA_RECTS = [
  { x: 92, y: 24, w: W - 92, h: H - 24, zone: 'w_sea3' },  // east: arcana, the demon ring
  { x: 0, y: 0, w: W, h: 26, zone: 'w_sea2' },             // north: snow continent, volcano island
];
const DEFAULT_ZONE = 'w_sea1';                               // home waters: start, forest, desert, light temple
function landZoneMap() {
  const Z = [];
  for (let y = 0; y < H; y++) Z.push(new Array(W).fill(null));
  const west = bfsWalk(iconOf('regnas_castle').x, iconOf('regnas_castle').y);
  const east = bfsWalk(iconOf('porta_town').x, iconOf('porta_town').y);
  const { comps } = components((ch) => walkable(ch));
  for (const cells of comps) {
    const [x0, y0] = cells[0];
    let zone;
    if (west[y0][x0]) zone = 'w_start';
    else if (east[y0][x0]) zone = 'w_east';
    else {
      const cnt = {};
      for (const [x, y] of cells) { const o = OWN[y][x]; if (o) cnt[o] = (cnt[o] || 0) + 1; }
      const own = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      zone = own === 'start' ? (x0 < GATE.w + 1 ? 'w_start' : 'w_east') : ZONE_OF_LAND[own];
      if (!zone) zone = seaZoneAt(x0, y0).replace('w_sea1', 'w_east').replace('w_sea2', 'w_forest').replace('w_sea3', 'w_arcana');
    }
    for (const [x, y] of cells) Z[y][x] = zone;
  }
  return Z;
}
function seaZoneAt(x, y) {
  for (const r of SEA_RECTS) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r.zone;
  return DEFAULT_ZONE;
}
function buildZones() {
  const Z = landZoneMap();
  const sail = (x, y) => WATER.has(G[y][x]);
  const covered = [];
  for (let y = 0; y < H; y++) covered.push(new Uint8Array(W));
  const rects = [];
  // a cell is compatible with zone z if it is not sailable and not land of another zone
  const ok = (x, y, z) => inb(x, y) && !sail(x, y) && (Z[y][x] === null || Z[y][x] === z);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Z[y][x];
    if (!z || covered[y][x]) continue;
    // try growing right-then-down and down-then-right; keep the one covering more new cells
    const cands = [];
    {
      let w = 0; while (ok(x + w, y, z)) w++;
      let h = 1; while (row(x, y + h, w, z)) h++;
      cands.push({ w, h });
    }
    {
      let h = 0; while (ok(x, y + h, z)) h++;
      let w = 1; while (col(x + w, y, h, z)) w++;
      cands.push({ w, h });
    }
    let best = null, bn = -1;
    for (const c of cands) {
      let n = 0;
      for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) if (Z[y + j][x + i] === z && !covered[y + j][x + i]) n++;
      if (n > bn) { bn = n; best = c; }
    }
    for (let j = 0; j < best.h; j++) for (let i = 0; i < best.w; i++) covered[y + j][x + i] = 1;
    rects.push({ x, y, w: best.w, h: best.h, zone: z });
  }
  function row(x, y, w, z) { for (let i = 0; i < w; i++) if (!ok(x + i, y, z)) return false; return true; }
  function col(x, y, h, z) { for (let j = 0; j < h; j++) if (!ok(x, y + j, z)) return false; return true; }
  return rects.concat(SEA_RECTS);
}

// ------------------------------------------------------------- main
function generate() {
  paintLands();
  enforceBorder();
  smoothCoasts();
  cleanSpecks();
  checkSeparation();
  paintWaters();
  paintDivider();
  paintIcons();
  paintRing();
  paintReefs();
  repairConnectivity();
  paintBeaches();
  enforceBorder();
  placeDocks();
  placeAbyss();
  fixDerived();
  sealPockets();
  for (const ic of ICONS) SPAWNS[ic.map] = { x: ic.x, y: ic.y, dir: exitDir(ic.x, ic.y) };
  SPAWNS.abyss_1 = { x: ABYSS.x, y: ABYSS.y, dir: exitDir(ABYSS.x, ABYSS.y) };
  SPAWNS.east_gate_w = { x: GATE.w, y: GATE.y, dir: 'left' };
  SPAWNS.east_gate_e = { x: GATE.e, y: GATE.y, dir: 'right' };
  const warps = ICONS.map((ic) => ({ x: ic.x, y: ic.y, to: ic.map, spawn: 'entrance' }));
  warps.push({ x: GATE.w, y: GATE.y, to: 'east_gate', spawn: 'west' });
  warps.push({ x: GATE.e, y: GATE.y, to: 'east_gate', spawn: 'east' });
  const zones = buildZones();
  return { rows: G.map((r) => r.join('')), spawns: SPAWNS, warps, zones };
}

function emit(res) {
  const q = (s) => "'" + s + "'";
  const L = [];
  L.push('// Overworld (128x112). GENERATED by tools/gen_world.js — do not edit by hand;');
  L.push('// change the generator and run `node tools/gen_world.js`, then `node tools/check_world.js`.');
  L.push("(function (R) {\n  'use strict';\n  R.DB.maps.world = {");
  L.push("    name: 'せかい', type: 'world', legend: 'world', bgm: 'overworld', outside: '~',");
  L.push('    rows: [');
  for (const r of res.rows) L.push('      ' + q(r) + ',');
  L.push('    ],');
  L.push('    marks: {},');
  L.push('    spawns: {');
  for (const k of Object.keys(res.spawns)) { const s = res.spawns[k]; L.push(`      ${k}: { x: ${s.x}, y: ${s.y}, dir: '${s.dir}' },`); }
  L.push('    },');
  L.push('    warps: [');
  for (const w of res.warps) L.push(`      { x: ${w.x}, y: ${w.y}, to: '${w.to}', spawn: '${w.spawn}' },`);
  L.push('    ],');
  L.push('    // encounter zones: land rectangles first (they never contain sea), then the sea');
  L.push('    zones: [');
  for (let i = 0; i < res.zones.length; i += 3) {
    L.push('      ' + res.zones.slice(i, i + 3).map((z) => `{ x: ${z.x}, y: ${z.y}, w: ${z.w}, h: ${z.h}, zone: '${z.zone}' }`).join(', ') + ',');
  }
  L.push('    ],');
  L.push(`    defaultZone: '${DEFAULT_ZONE}',`);
  L.push('    // post-game: the entrance of 深淵の迷宮 appears on the northern islet once the demon king falls');
  L.push(`    tilePatches: [{ cond: '${ABYSS.cond}', x: ${ABYSS.x}, y: ${ABYSS.y}, ch: '${ABYSS.icon}' }],`);
  L.push(`    events: [{ x: ${ABYSS.x}, y: ${ABYSS.y}, id: '${ABYSS.event}', trigger: 'step', cond: '${ABYSS.cond}' }],`);
  L.push('  };');
  L.push('})(window.RPG);');
  return L.join('\n') + '\n';
}

let res;
try { res = generate(); } catch (e) {
  // --dump <file>: write the half-finished map for inspection
  const di = process.argv.indexOf('--dump');
  if (di > 0) fs.writeFileSync(process.argv[di + 1], G.map((r, y) => String(y).padStart(3) + ' ' + r.join('')).join('\n') + '\n');
  console.error('gen_world: ' + e.message);
  process.exit(1);
}
const src = emit(res);
console.log(`world: ${W}x${H}, ${res.zones.length} zone rects, ${Object.keys(res.spawns).length} spawns, ${res.warps.length} warps`);
if (!process.argv.includes('--dry')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src);
  console.log('wrote', path.relative(process.cwd(), OUT));
}
