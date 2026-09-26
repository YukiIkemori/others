#!/usr/bin/env node
// World map generator → src/maps/world.js (DESIGN §10.5). Owner: world (A18a).
//
//   node tools/gen_world.js             write src/maps/world.js
//   node tools/gen_world.js --dry       generate only (no write)
//   node tools/gen_world.js --ascii     print the finished map with coordinates
//   node tools/gen_world.js --dump f    on failure, write the unfinished map to f
//   node tools/gen_world.js --out f     write the map to f instead (tools/test_world.js compares)
//   node tools/gen_world.js --p2 | --no-p2
//                                       use the optional P2 world tiles (jungle deadforest river
//                                       cliff ruins loc_port loc_mine, §11.2.3) always / never.
//                                       Default: use each one only when the loaded world legend
//                                       (src/data/tiles*.js) defines it; otherwise its fallback
//                                       (forest forest sea mountain hills loc_town loc_cave).
// Then run `node tools/check_world.js` (loop-aware reachability, zones, patches; --png).
//
// Deterministic: seeded value noise + hand-authored geography, ported from the Crest generator
// (noise, signed-distance shapes, connectivity repair, zone rectangles) and rebuilt for
// エルセリア (§10.5.2): one ring-shaped continent around the エルセ内海, the ファロス半島 joined
// to it only by the drawbridge, ビブリア島 in the middle of the inner sea, and the マレア諸島 in
// the south-east ocean (ferry only). Inside the continent, each cell belongs to the region whose
// (noisy) claim shape is nearest; region layers paint forests, hills, ranges, lakes on top.
// Roads (RS1 街道) join the towns in a ring, bridging the rivers they cross. The world wraps
// (`wrap:true`): a sea border of BORDER tiles keeps the seam in open water.
// Hand-tweak the world HERE, never in the output.
'use strict';
const fs = require('fs');
const path = require('path');

const W = 128, H = 112, BORDER = 4;
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.resolve(__dirname, '..', 'src', 'maps', 'world.js');

// ------------------------------------------------------------------ tiles
// world legend chars (src/data/tiles.js + tiles_world.js, §11.11.2)
const CH = {
  sea: '~', reef: '^', grass: '.', plain: ',', forest: 'T', hills: 'n', mountain: 'M', desert: 'd', snow: '*',
  snowforest: 'f', swamp: 'x', beach: 'b', wasteland: 'k', magma: 'L', bridge_h: '=', bridge_v: '|',
  road: 'r', marsh: 'm', ash: 'a', fog: 'g', sandstorm: 'z', marsh_fog: 'e',
  jungle: 'j', deadforest: 't', river: 'u', cliff: 'c', ruins: 'o',
  loc_town: 'V', loc_village: 'v', loc_cave: 'O', loc_tower: 'I', loc_shrine: 'A', loc_pyramid: 'P',
  loc_volcano: 'Y', loc_forest: 'G', loc_manor: 'Q', loc_library: 'U', loc_port: 'W', loc_mine: 'N',
  secret_forest: '%', secret_rock: '&',
};
// optional (P2) tiles and what they become when the legend does not have them
const P2 = { jungle: 'forest', deadforest: 'forest', river: 'sea', cliff: 'mountain', ruins: 'hills', loc_port: 'loc_town', loc_mine: 'loc_cave' };
function detectP2() {
  if (argv.includes('--p2')) return new Set(Object.keys(P2));
  if (argv.includes('--no-p2')) return new Set();
  let legend = {};
  try {
    const R = require('./lib/load')({ quiet: true });
    legend = (R && R.DB && R.DB.legends && R.DB.legends.world) || {};
  } catch (e) { legend = {}; }
  return new Set(Object.keys(P2).filter((id) => legend[CH[id]] === id));
}
const P2ON = detectP2();
/** output char of a logical tile id (P2 ids fall back when unavailable) */
const T = {};
for (const id in CH) T[id] = P2[id] && !P2ON.has(id) ? CH[P2[id]] : CH[id];

const WALK_IDS = ['grass', 'plain', 'forest', 'hills', 'desert', 'snow', 'snowforest', 'swamp', 'beach', 'wasteland',
  'bridge_h', 'bridge_v', 'road', 'marsh', 'ash', 'sandstorm', 'marsh_fog', 'jungle', 'deadforest', 'ruins',
  'secret_forest', 'secret_rock'];
const ICON_IDS = Object.keys(CH).filter((k) => k.startsWith('loc_'));
const WALK = new Set(WALK_IDS.concat(ICON_IDS).map((k) => CH[k]));
const ICON = new Set(ICON_IDS.map((k) => CH[k]));
const WATER = new Set([CH.sea, CH.river]);
const SECRET = new Set([CH.secret_forest, CH.secret_rock]);
const walkable = (ch) => WALK.has(ch);
const isLand = (ch) => !WATER.has(ch) && ch !== CH.reef && ch !== CH.fog;
const isRock = (ch) => ch === CH.mountain || ch === CH.cliff || ch === CH.magma;

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
// Signed distance in tiles (negative inside), evaluated at cell coordinates.
const ell = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
/** axis-aligned rectangle covering the cells x0..x1 × y0..y1 */
const box = (x0, y0, x1, y1) => (x, y) => {
  const dx = Math.max(x0 - 0.5 - x, x - (x1 + 0.5)), dy = Math.max(y0 - 0.5 - y, y - (y1 + 0.5));
  if (dx <= 0 && dy <= 0) return Math.max(dx, dy);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
};
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
/** everywhere (layers that only use their density noise) */
const ALL = () => -1;
/** domain-warp a shape: bends straight edges into natural curves */
const warp = (f, amp, scale, seed) => (x, y) => f(x + amp * fbm(x, y, seed, scale, 2), y + amp * fbm(x, y, seed + 17, scale, 2));

// ------------------------------------------------------------ the grid
const G = [], OWN = [], MASS = [], PROTECT = [];
for (let y = 0; y < H; y++) {
  G.push(new Array(W).fill(CH.sea));
  OWN.push(new Array(W).fill(null)); // region id per land cell
  MASS.push(new Array(W).fill(null)); // landmass id per land cell
  PROTECT.push(new Array(W).fill(false)); // cells no later pass may change
}
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const get = (x, y) => (inb(x, y) ? G[y][x] : CH.sea);
const set = (x, y, ch) => { if (inb(x, y)) G[y][x] = ch; };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// ============================================================ geography
// Region ids (OWN) and their world encounter zones (§10.5.7).
const REGION_ZONE = {
  penin: 'zw_prologue', cross: 'zw_forest', forest: 'zw_forest', snow: 'zw_snow', mine: 'zw_mine', star: 'zw_star',
  marsh: 'zw_marsh', desert: 'zw_desert', ash: 'zw_ash', isles: 'zw_isles', biblia: 'zw_center', islet: 'zw_isles',
};
const DEFAULT_ZONE = 'zw_forest';

// Landmasses. The continent is one ring around the inner sea (the 潮見 strait cuts it between
// the ash wastes and the marsh; the 潮見橋 spans the cut).
const MASSES = [
  {
    id: 'continent', seed: 11, amp: 2.2, warp: [3, 14],
    // big, slow wobble on the outer coast only (the inner sea's shores keep the blueprint)
    outer: { zone: box(24, 24, 98, 84), amp: 5.5, scale: 14, ramp: 8 },
    // a gentler bite into the inner sea's shores, kept clear of the roads
    inner: { amp: 3, scale: 9 },
    body: minus(union(
      box(6, 6, 121, 30),     // the north: ノルデン雪原 / ガルド山地 / オルビス高原
      box(6, 31, 51, 38),     // south of the snowfields and the crossroads north of the strait
      box(84, 31, 121, 34),   // Orbis's south shore
      box(6, 39, 30, 78),     // ヴェルダの森 (the west channel x 32..35 parts it from the peninsula)
      box(93, 35, 121, 74),   // グレイモア湿原
      box(6, 77, 86, 105),    // ザハラ砂漠 + 灰の荒野
      box(77, 71, 86, 76),    // the ash promontory reaching for the 潮見橋
      cap([[62, 30], [63, 34]], 2, 1.2), cap([[92, 63], [89, 65]], 1.8, 1.1), cap([[60, 78], [60, 76]], 2, 1.4), // capes into the inner sea
      cap([[71, 30], [72, 33]], 1.8, 1.2), cap([[80, 30], [79, 33]], 1.6, 1),
      cap([[93, 40], [90, 41.5]], 1.5, 1), cap([[93, 48], [90, 49]], 1.7, 1.1), // capes of the marsh's west shore
      ell(10, 10, 4, 3.5),    // the white peaks of 白竜の峰 stand on the north-west corner
      cap([[24, 105], [21, 107]], 2.6, 1.6), cap([[103, 34], [104, 37]], 1.6, 1), // a southern cape, a spit under Orbis
    ),
    // bays: the outer coast …
    ell(33, 4.5, 5, 3), ell(62, 4, 6.5, 3.4), ell(93, 4.5, 4.5, 3.6), ell(113, 4.5, 3.4, 2.6),
    ell(4.5, 37, 3.2, 3.6), ell(4.5, 64, 3.6, 5), ell(4.5, 92, 3, 4.2), ell(5, 80.5, 2, 2),
    ell(123.5, 26, 3.2, 4.4), ell(123.5, 50, 3.4, 5.5), ell(123, 68, 3, 3.2), ell(123.5, 11, 2.6, 3),
    ell(29, 108, 4, 2.4), ell(56, 107.5, 5, 3.8), ell(76, 107, 4, 2.6), ell(12, 107, 3.4, 2.4),
    // … and the inner sea's
    ell(94.5, 45.5, 1.8, 2.4), ell(70, 78.5, 3.2, 2), ell(44, 78, 2.6, 1.7), ell(93.5, 60.5, 1.8, 2.2)),
    // the continent never reaches into the inner sea's middle (the peninsula and ビブリア島 are there)
    clip: minus(ALL, box(32, 39, 75, 73), box(52, 33, 88, 69), box(76, 40, 88, 70)),
    regions: ['snow', 'cross', 'mine', 'star', 'forest', 'marsh', 'desert', 'ash'],
  },
  {
    id: 'penin', seed: 21, amp: 1.4, warp: [2, 9],
    body: minus(union(box(37, 44, 51, 65), box(38, 66, 52, 71), cap([[48, 64], [54, 66]], 2.4, 1.8)),
      ell(50.5, 58, 4, 2.3)), // the harbour bay of 港町ファロス
    clip: box(35, 44, 57, 72),
    regions: ['penin'],
  },
  {
    id: 'biblia', seed: 31, amp: 1.2, warp: [1.5, 7],
    body: minus(ell(71.5, 55.5, 7.5, 7.2), ell(70, 62, 2, 3.2)), // the southern landing of 書の都ビブリア
    clip: box(61, 46, 82, 65),
    regions: ['biblia'],
  },
  {
    id: 'isles', seed: 41, amp: 1.2, warp: [1.5, 8],
    body: minus(union(ell(110, 88.5, 11, 5), ell(112, 96, 8, 5), cap([[112, 99], [120, 99]], 2.6, 1.8)),
      ell(101, 90.5, 4.5, 2), ell(112.6, 94, 0.9, 1.3)), // Coral's harbour bay; the cove of 潮鳴りの洞窟
    clip: box(94, 82, 123, 105),
    regions: ['isles'],
  },
  {
    id: 'islets', seed: 51, amp: 0.4, warp: [0.6, 4],
    body: union(ell(95, 80, 1.8, 1.3), ell(68, 39.5, 2, 1.4), ell(108, 79.5, 2, 1.3), ell(61.5, 69.5, 1.8, 1.2), ell(87, 57.5, 2, 1.5)),
    regions: ['islet'],
  },
];

// Region claims inside a landmass: every land cell goes to the region with the smallest
// (noisy) claim distance, so the borders wander naturally between the blueprint's lines.
const REGIONS = {
  snow: { claim: union(box(6, 6, 39, 30), box(6, 31, 31, 35)), ground: 'snow', seed: 101 },
  cross: { claim: box(32, 31, 51, 38), ground: 'grass', seed: 111 },
  mine: { claim: box(40, 6, 83, 30), ground: 'plain', seed: 121 },
  star: { claim: box(84, 6, 121, 34), ground: 'plain', seed: 131 },
  forest: { claim: box(6, 36, 31, 76), ground: 'grass', seed: 141 },
  marsh: { claim: box(92, 35, 121, 74), ground: 'marsh', seed: 151 },
  desert: { claim: box(6, 77, 47, 105), ground: 'desert', seed: 161 },
  ash: { claim: union(box(48, 77, 86, 105), box(77, 71, 86, 76)), ground: 'ash', seed: 171 },
  penin: { claim: ALL, ground: 'grass', seed: 181 },
  biblia: { claim: ALL, ground: 'grass', seed: 191 },
  isles: { claim: ALL, ground: 'grass', seed: 201 },
  islet: { claim: ALL, ground: 'grass', seed: 211 },
};

// Region layers: [tile, shape, {amp, scale, seed, on:[tiles it may overwrite], dens:[scale, threshold]}]
const L = (id, shape, o) => [id, shape, o || {}];
const LAYERS = {
  snow: [
    L('snowforest', warp(union(ell(27, 9, 4, 2), ell(15, 25, 5, 3), ell(33, 20, 3, 3.5), ell(9, 29, 3.5, 2.5), ell(24, 32, 3, 1.8)), 2, 6, 3), { amp: 1.5, seed: 3 }),
    L('snowforest', ALL, { amp: 0, seed: 5, on: ['snow'], dens: [4, 0.8] }),
    L('hills', ALL, { amp: 0, seed: 6, on: ['snow'], dens: [2.5, 0.93] }),
    L('hills', union(ell(13, 16, 4.5, 3), cap([[36, 9], [37, 25]], 2)), { amp: 1, seed: 7, on: ['snow', 'snowforest'], dens: [1.6, 0.7] }),
    // the white peaks around 白竜の峰 and the range on the Gard border (pass at y 14..18)
    L('mountain', union(ell(10.5, 7.5, 5.5, 2.3), ell(6.5, 12, 1.6, 3), cap([[15, 6.5], [22, 6.5]], 1), ell(15, 11, 1.6, 1.3), ell(19, 23, 1.3, 1)), { amp: 0.9, seed: 9 }),
    L('mountain', union(cap([[23, 6], [31, 7], [38, 6]], 1.2), cap([[38, 7], [39, 13]], 1.4), cap([[39, 19], [38, 27]], 1.4), ell(12, 20, 1.4, 1.1), ell(29, 30, 1.5, 1.1)), { amp: 1.1, seed: 11 }),
  ],
  cross: [
    L('plain', ALL, { amp: 0, seed: 13, on: ['grass'], dens: [5, 0.55] }),
    L('hills', ell(44, 33.5, 5.5, 2.8), { amp: 1, seed: 14, on: ['grass', 'plain'], dens: [2, 0.4] }),
    L('mountain', ell(44, 33.2, 3.4, 1.6), { amp: 0.6, seed: 15 }),
    L('forest', ALL, { amp: 0, seed: 16, on: ['grass', 'plain'], dens: [2.4, 0.84] }),
  ],
  mine: [
    // Dovan's valley: ringed by the northern crest, the eastern wall and the southern arc, open only
    // to the south-west (the crossroads) — so before the 抜け道 opens, Orbis is a long way round by the coast
    L('hills', ALL, { amp: 0, seed: 21, on: ['plain'], dens: [3, 0.5] }),
    L('grass', union(ell(57, 16, 3.5, 2.6), ell(63, 19, 3, 2), ell(54, 21, 3, 2)), { amp: 1.2, seed: 22, on: ['plain', 'hills'] }),
    L('forest', union(ell(61, 14.5, 2.2, 1.5), ell(66.5, 18.5, 1.6, 1.3), ell(47, 18, 1.6, 2)), { amp: 0.8, seed: 29, on: ['plain', 'hills', 'grass'] }),
    L('mountain', union(
      cap([[41, 7], [50, 6], [60, 5], [70, 6], [82, 6]], 1.4),     // the northern crest
      cap([[43, 11], [46, 14]], 1.2), ell(50, 11, 2.6, 1.7),         // knots at the valley's west side
      ell(66.5, 11, 3, 1.8), cap([[60, 9], [62, 11]], 0.9),          // the deep mine's hill
      cap([[52, 24], [56, 26.5], [61, 26], [66, 25.5], [69, 24]], 1.3, 1.9), ell(64, 25.5, 3.4, 2.4), // the southern arc (and its knot)
    ), { amp: 1, scale: 4, seed: 23 }),
    L('mountain', ALL, { amp: 0, seed: 24, on: ['hills'], dens: [2.6, 0.74] }),
    // the wall between Dovan and Orbis (the 抜け道 at y 20 opens after r_mine)
    L('mountain', union(cap([[76, 6], [75, 11], [77, 15], [75.5, 25]], 2.4, 2), ell(75, 20, 6.4, 2.6), cap([[69, 24.5], [74, 26]], 1.3)), { amp: 1.2, scale: 4, seed: 25 }),
    L('mountain', union(cap([[81, 8], [83, 13]], 1), ell(70, 13, 1.6, 1.2)), { amp: 0.8, seed: 28 }),
    L('hills', union(ell(68.5, 9.5, 1.6, 1.2), ell(84.5, 12, 1.4, 2.5), ell(84, 22, 1.3, 1.8)), { amp: 0.8, seed: 27, on: ['plain', 'grass'] }),
    // the coastal strip under the arc stays walkable
    L('plain', box(46, 27, 84, 30), { amp: 0.6, seed: 26, on: ['mountain'] }),
  ],
  star: [
    L('grass', ALL, { amp: 0, seed: 31, on: ['plain'], dens: [6, 0.62] }),
    L('hills', ALL, { amp: 0, seed: 32, on: ['plain', 'grass'], dens: [3, 0.7] }),
    L('hills', union(ell(112, 11, 6, 3), ell(116, 28, 5, 3)), { amp: 1, seed: 33, on: ['plain', 'grass'], dens: [2, 0.42] }),
    L('mountain', union(cap([[86, 6], [96, 5], [106, 6], [118, 6]], 1.2), cap([[119, 7], [120, 14]], 1.1), ell(90, 14, 1.8, 1.4)), { amp: 1, seed: 34 }),
    L('cliff', union(cap([[103, 10], [106, 10]], 0.5), cap([[114, 18], [118, 18]], 0.5), cap([[88, 29], [92, 29]], 0.5)), { amp: 0.2, seed: 35, on: ['plain', 'grass', 'hills'] }),
    L('ruins', union(ell(116, 24, 1.6, 1.1), ell(91, 11, 1, 0.8), ell(106, 30, 1, 0.8)), { amp: 0.3, seed: 36, on: ['plain', 'grass', 'hills'], dens: [1.2, 0.3] }),
    L('forest', union(ell(90, 20, 2.5, 2), ell(112, 31, 3, 1.5), ell(118.5, 27, 2, 2.6), ell(104, 7.5, 2, 1.2)), { amp: 1, seed: 37, on: ['plain', 'grass'] }),
  ],
  forest: [
    L('forest', ALL, { amp: 0, seed: 41, on: ['grass'], dens: [4, 0.26] }),
    L('forest', warp(union(ell(14, 43, 7, 5), ell(9, 56, 4, 6), ell(26, 64, 4, 5), ell(14, 70, 6, 3)), 2, 6, 42), { amp: 1.5, seed: 42 }),
    L('grass', union(ell(18, 51, 3.2, 2.6), ell(24, 48, 1.8, 1.4), ell(9, 50, 1.6, 1.2)), { amp: 0.8, seed: 43 }),
    L('hills', union(ell(22, 38, 7, 2.2), ell(28, 72, 3, 2)), { amp: 1, seed: 44, on: ['grass', 'forest'], dens: [2, 0.38] }),
    L('plain', box(6, 73, 31, 78), { amp: 1.5, seed: 45, on: ['grass', 'forest'], dens: [3, 0.35] }),
    L('mountain', union(ell(7, 44, 1.4, 2.6), ell(29, 45, 1.2, 1.5)), { amp: 0.7, seed: 46 }),
  ],
  marsh: [
    L('grass', union(box(93, 35, 121, 40), ell(97.5, 54, 2.2, 2.6)), { amp: 1.8, seed: 51, on: ['marsh'], dens: [4, 0.3] }),
    L('forest', union(ell(98.5, 57.5, 1.4, 1.1), ell(99, 51, 1.2, 1)), { amp: 0.5, seed: 57, on: ['marsh', 'grass'] }),
    L('forest', ALL, { amp: 0, seed: 52, on: ['marsh', 'grass'], dens: [3.5, 0.66] }),
    L('forest', warp(union(ell(117, 44, 4, 5), ell(104, 70, 5, 2.5)), 2, 5, 53), { amp: 1.2, seed: 53, on: ['marsh', 'grass'] }),
    L('deadforest', union(ell(110, 51, 5, 3.6), ell(114, 63, 4, 3)), { amp: 1.2, seed: 54, on: ['marsh', 'forest'], dens: [1.8, 0.4] }),
    L('deadforest', ALL, { amp: 0, seed: 55, on: ['marsh'], dens: [2.6, 0.86] }),
    L('hills', ell(119, 57, 2, 3), { amp: 0.8, seed: 56, on: ['marsh', 'grass'], dens: [2, 0.4] }),
  ],
  desert: [
    L('plain', union(ell(27, 85, 5.5, 3.8), ell(8, 81, 2.5, 2)), { amp: 1.5, seed: 61, on: ['desert'] }),
    L('forest', union(ell(29, 82.5, 2.8, 1.2), ell(31, 86.5, 1.4, 1.6)), { amp: 0.6, seed: 62, on: ['plain', 'desert'] }),
    L('hills', ALL, { amp: 0, seed: 63, on: ['desert'], dens: [4, 0.76] }),
    L('hills', cap([[46, 79], [46, 104]], 2.4), { amp: 1.2, seed: 64, on: ['desert', 'plain'], dens: [2, 0.35] }),
    L('mountain', union(ell(10, 90, 2.2, 1.6), ell(33.5, 94, 3.8, 3), cap([[20, 103], [26, 104]], 1), ell(33, 79.5, 1.6, 1.1), cap([[16, 84], [19, 85]], 0.9), ell(41, 84, 1.5, 1.1),
      cap([[46, 79], [47, 86]], 1.3), cap([[47, 93], [46, 104]], 1.3)), { amp: 0.9, seed: 65 }),
    L('ruins', ell(8.5, 82, 1.6, 1.2), { amp: 0.3, seed: 66, on: ['plain', 'desert'], dens: [1.2, 0.35] }),
  ],
  ash: [
    L('wasteland', ALL, { amp: 0, seed: 71, on: ['ash'], dens: [4, 0.55] }),
    L('deadforest', union(ell(60, 81, 5, 2.2), ell(84, 86, 2, 3)), { amp: 1, seed: 72, on: ['ash', 'wasteland'], dens: [1.8, 0.45] }),
    L('hills', ALL, { amp: 0, seed: 73, on: ['ash', 'wasteland'], dens: [3, 0.74] }),
    L('mountain', ALL, { amp: 0, seed: 78, on: ['hills'], dens: [2.2, 0.8] }),
    L('deadforest', ALL, { amp: 0, seed: 79, on: ['wasteland'], dens: [2.4, 0.86] }),
    L('mountain', union(ell(81, 98, 4.5, 3), cap([[74, 97], [76, 100]], 1), cap([[53, 80], [58, 79]], 1.1), cap([[62, 100], [67, 103]], 1.1),
      ell(56, 95, 1.6, 1.3), cap([[84, 78], [85, 83]], 0.9)), { amp: 1, seed: 74 }),
    // the crater and the lava running down to the sea (1 tile wide; the volcano's foot stays open)
    L('magma', ell(81, 97.6, 1.7, 1.1), { amp: 0.3, seed: 75, on: ['mountain'] }),
    L('magma', union(cap([[82, 99], [83.5, 101], [86, 103.5]], 0.95), cap([[79, 99.5], [75, 100]], 0.8), ell(86, 103.8, 1.6, 1.1)),
      { amp: 0.25, seed: 76, on: ['ash', 'wasteland', 'hills', 'deadforest', 'mountain'] }),
    L('wasteland', ell(80, 101, 5, 2.5), { amp: 1, seed: 77, on: ['ash'] }),
    // the fields round カルデラ are grey ash (not bare waste), so the r_ash thaw (§10.5.6) greens
    // a whole ragged disc instead of a few scattered cells
    L('ash', ell(70, 89.5, 6.4, 5.8), { amp: 1.1, seed: 70, on: ['wasteland', 'deadforest'] }),
  ],
  penin: [
    L('plain', ALL, { amp: 0, seed: 81, on: ['grass'], dens: [5, 0.72] }),
    L('forest', warp(union(ell(38, 48.5, 4, 3), ell(49, 47, 2.5, 2.2), ell(41, 68, 3.5, 2), ell(51, 69, 1.6, 1.2)), 1.5, 5, 82), { amp: 1.2, seed: 82, on: ['grass', 'plain'] }),
    L('forest', ALL, { amp: 0, seed: 83, on: ['grass', 'plain'], dens: [2.2, 0.85] }),
    L('hills', union(ell(49, 63, 2, 1.5), ell(38, 61, 1.8, 1.4)), { amp: 0.8, seed: 84, on: ['grass', 'plain'], dens: [2, 0.35] }),
  ],
  biblia: [
    L('plain', ALL, { amp: 0, seed: 91, on: ['grass'], dens: [4, 0.55] }),
    L('forest', union(ell(66.5, 52, 2.2, 2.4), ell(76, 59, 1.8, 2)), { amp: 0.8, seed: 92, on: ['grass', 'plain'] }),
    L('hills', ell(67, 58, 1.6, 1.3), { amp: 0.5, seed: 93, on: ['grass', 'plain'] }),
    L('ruins', ell(77.5, 52, 1, 0.9), { amp: 0.2, seed: 94, on: ['grass', 'plain'] }),
  ],
  isles: [
    L('jungle', ALL, { amp: 0, seed: 101, on: ['grass'], dens: [3.5, 0.5] }),
    L('jungle', warp(union(ell(112, 86, 4, 2), ell(116, 93, 3, 2)), 1.5, 5, 102), { amp: 1, seed: 102, on: ['grass'] }),
    L('hills', union(ell(116, 89, 2.5, 1.6), ell(104, 95, 1.6, 1.2)), { amp: 0.8, seed: 103, on: ['grass', 'jungle'], dens: [2, 0.35] }),
    L('mountain', ell(117, 88.5, 1.2, 1), { amp: 0.4, seed: 104 }),
  ],
  islet: [   // uninhabited isles nobody can land on (no ships): a crag, a copse, a strip of sand
    L('forest', ALL, { amp: 0, seed: 111, dens: [1.2, 0.45] }),
    L('hills', ALL, { amp: 0, seed: 112, dens: [1.3, 0.72] }),
  ],
};

// Channels that must stay open sea (they part the peninsula from the continent, and the
// ash wastes from the marsh). Their cores are forced to sea and protected.
const CHANNELS = [
  box(33, 40, 57, 43),   // ファロス海峡 (the drawbridge spans it at x 42)
  box(54, 33, 58, 43),   // the inner sea's north-west corner (keeps the crossroads off the peninsula)
  box(33, 40, 34, 76),   // the west channel between the forest and the peninsula
  box(33, 73, 75, 75),   // the south channel between the peninsula and the desert/ash coast
  box(88, 69, 91, 79),   // the 潮見 strait (inner sea ↔ south-east ocean; the 潮見橋 spans it at y 74)
];
// Land that must stay land (bridge heads). [x0, y0, x1, y1, region]
const FORCE_LAND = [
  [41, 37, 43, 39, 'cross'], [41, 44, 43, 45, 'penin'],
  [85, 73, 87, 75, 'ash'], [92, 73, 94, 75, 'marsh'],
];
const BRIDGES = [
  { id: 'bridge_v', cells: [[42, 40], [42, 41], [42, 42], [42, 43]], name: 'drawbridge' },   // ファロスの跳ね橋
  { id: 'bridge_h', cells: [[88, 74], [89, 74], [90, 74], [91, 74]], name: 'shiomi' },       // 潮見橋
];

// lakes (sea tiles) and rivers (1-tile channels; roads that cross them get bridges)
const LAKES = [
  { shape: ell(29, 13.5, 2.2, 1.4), amp: 0.4 },   // a frozen lake north of Yule
  { shape: ell(30, 84.5, 1.5, 1), amp: 0.2 },     // the oasis of カシム
  { shape: ell(65.5, 86.5, 2.9, 2.1), amp: 0.3 }, // the hot spring pool north-west of カルデラ
  { shape: ell(106, 60, 1.8, 1.2), amp: 0.4 },    // a mere in the marsh
  { shape: ell(104.5, 26.5, 1.8, 1.1), amp: 0.3 }, // a tarn on the Orbis highland
  // harbours: every port town has open water beside its icon
  { shape: ell(91.8, 54, 2, 1.4), amp: 0 },       // 水辺の町ロッホ
  { shape: ell(101.2, 90.5, 4.5, 1.8), amp: 0 },  // 港町コーラル
  { shape: ell(50.5, 58, 4, 2.3), amp: 0 },       // 港町ファロス
  { shape: ell(70, 62, 2, 3.2), amp: 0 },         // 書の都ビブリア
];
const RIVERS = [
  // snow river: from the Gard range west past Yule to the western sea
  { pts: [[37, 22], [35, 24], [33, 26], [33, 27], [20, 27], [16, 29], [11, 29], [5, 31]] },
  // forest river: out of the woods east of Fern to the western sea
  { pts: [[27, 52], [25, 55], [25, 58], [16, 58], [12, 61], [8, 61], [4, 63]] },
  // marsh river: off the Orbis highland down to the inner sea north of Loch
  { pts: [[113, 32], [112, 35], [112, 38], [104, 38], [104, 43], [91, 43]] },
];

// Roads (街道): 4-connected polylines between the icons. Crossing a river puts a bridge there;
// crossing mountains cuts a pass. `patch` roads exist only while the cond holds (tilePatches).
const ROADS = [
  // ファロス半島
  { pts: [[42, 44], [42, 51], [46, 51], [46, 58]] },                      // drawbridge → 港町ファロス
  { pts: [[46, 58], [43, 58], [43, 55], [38, 55], [38, 54]] },            // → ロアの里
  { pts: [[46, 58], [46, 62], [50, 62], [50, 66], [54, 66]] },            // → ファロス灯台
  // the crossroads north of the drawbridge
  { pts: [[42, 39], [42, 37]] },
  { pts: [[42, 37], [33, 37]] },                                           // west toward the forest
  { pts: [[42, 37], [49, 37], [49, 23], [58, 23], [58, 22]] },            // → 鉱山都市ドヴァン (into the valley from the south-west)
  { pts: [[42, 37], [36, 37], [36, 31], [30, 31], [30, 23], [24, 23], [24, 19], [22, 19], [22, 18]] }, // → 雪の村ユール
  // ガルド山地 → オルビス高原 (around the wall by the coast)
  { pts: [[58, 22], [62, 22], [62, 20], [69, 20]] },                      // the 抜け道's west end (x 70..80 opens later)
  { pts: [[49, 28], [62, 28], [62, 29], [84, 29], [84, 23], [97, 23], [98, 22]] }, // → 学術都市オルビス (the coast road under the arc)
  { pts: [[81, 20], [84, 20], [84, 23]] },                                 // the 抜け道's east end
  // オルビス → グレイモア湿原 → 潮見橋
  { pts: [[98, 22], [98, 30], [100, 30], [100, 47], [95, 47], [95, 54], [94, 54]] }, // → 水辺の町ロッホ
  { pts: [[94, 54], [96, 54], [96, 58], [98, 58], [98, 69], [95, 69], [95, 72], [93, 72], [93, 74], [92, 74]] }, // → 潮見橋
  // 灰の荒野 → ザハラ砂漠 → ヴェルダの森
  { pts: [[87, 74], [83, 74], [83, 82], [73, 82], [73, 89], [70, 89], [70, 90]] }, // → 炎の町カルデラ
  { pts: [[70, 90], [70, 91], [59, 91], [59, 89], [40, 89], [40, 87], [27, 87], [27, 86], [26, 86]] }, // → オアシスの町カシム
  { pts: [[26, 86], [26, 76], [24, 76], [24, 66], [21, 66], [21, 53], [18, 53], [18, 50]] }, // → 森の村フェルン
  // ビブリア島・マレア諸島
  { pts: [[70, 58], [70, 54], [74, 54]] },                                 // 書の都 → 白の大書庫
  { pts: [[106, 90], [109, 90], [109, 97], [118, 97], [118, 98]] },       // 港町コーラル → 岬の村ネレイ
  // shortcuts opened by clearing a region (§10.5.6)
  { pts: [[33, 37], [28, 37], [28, 41], [24, 41], [24, 45], [20, 45], [20, 49], [18, 49], [18, 50]], patch: { cleared: 'r_forest' } },
  { pts: [[70, 20], [80, 20]], patch: { cleared: 'r_mine' }, through: true },
];

// ------------------------------------------------------------- locations (§10.5.3)
// map id (= world spawn name), icon tile, cell, landmass region; `port`: needs sea beside it
const ICONS = [
  { map: 'roa', icon: 'loc_village', x: 38, y: 54, land: 'penin' },
  { map: 'lute', icon: 'loc_port', x: 46, y: 58, land: 'penin', port: true },
  { map: 'lighthouse_1', icon: 'loc_tower', x: 54, y: 66, land: 'penin' },
  { map: 'fern', icon: 'loc_village', x: 18, y: 50, land: 'forest' },
  { map: 'verda_maze_1', icon: 'loc_forest', x: 14, y: 42, land: 'forest', wild: true },
  { map: 'kasim', icon: 'loc_town', x: 26, y: 86, land: 'desert' },
  { map: 'sand_tomb_1', icon: 'loc_pyramid', x: 14, y: 98, land: 'desert' },
  { map: 'yule', icon: 'loc_village', x: 22, y: 18, land: 'snow' },
  { map: 'frost_peak_1', icon: 'loc_cave', x: 10, y: 10, land: 'snow', rock: true },
  { map: 'loch', icon: 'loc_port', x: 94, y: 54, land: 'marsh', port: true },
  { map: 'mist_manor_1', icon: 'loc_manor', x: 110, y: 50, land: 'marsh', wild: true },
  { map: 'bell_marsh_1', icon: 'loc_shrine', x: 114, y: 66, land: 'marsh', wild: true },
  { map: 'coral', icon: 'loc_port', x: 106, y: 90, land: 'isles', port: true },
  { map: 'nerei', icon: 'loc_village', x: 118, y: 98, land: 'isles' },
  { map: 'tide_cave_1', icon: 'loc_cave', x: 114, y: 94, land: 'isles', rock: true },
  { map: 'dovan', icon: 'loc_town', x: 58, y: 22, land: 'mine' },
  { map: 'deep_mine_1', icon: 'loc_mine', x: 66, y: 14, land: 'mine', rock: true },
  { map: 'caldera', icon: 'loc_town', x: 70, y: 90, land: 'ash' },
  { map: 'ash_volcano_1', icon: 'loc_volcano', x: 78, y: 102, land: 'ash', rock: true },
  { map: 'orbis', icon: 'loc_town', x: 98, y: 22, land: 'star' },
  { map: 'stargaze_1', icon: 'loc_tower', x: 110, y: 14, land: 'star' },
  { map: 'biblia', icon: 'loc_port', x: 70, y: 58, land: 'biblia', port: true },
  { map: 'archive_1', icon: 'loc_library', x: 74, y: 54, land: 'biblia' },
];
const iconOf = (map) => ICONS.find((i) => i.map === map);

// Hidden passages on the world (§10.6.4): a pocket walled in by rock, reached only through a
// 1–2 tile secret tile that looks like the forest / the rock face. The chest is a tier chest
// (no chestTier: the current tier). `entry` is the ordinary cell in front of the passage.
const SECRETS = [
  { id: 'world_c1', pool: 'p_gear', tile: 'secret_forest', region: 'penin',   // ロアの里の北の森
    pocket: [[37, 47], [38, 47]], chest: [37, 47], path: [[38, 48]], entry: [38, 49], wall: 'mountain' },
  { id: 'world_c2', pool: 'p_gold', tile: 'secret_rock', region: 'desert',    // ザハラ砂漠の岩山
    pocket: [[33, 93], [34, 93]], chest: [34, 93], path: [[33, 94], [33, 95]], entry: [33, 96], wall: 'mountain' },
  { id: 'world_c3', pool: 'p_rare', tile: 'secret_rock', region: 'mine',      // ガルド山地の山すそ (the arc's foot by the coast road)
    pocket: [[63, 25], [64, 25]], chest: [63, 25], path: [[64, 26], [64, 27]], entry: [64, 28], wall: 'mountain' },
];

// ============================================================ painting
function paintLands() {
  const bodies = MASSES.map((M) => warp(M.body, M.warp[0], M.warp[1], M.seed + 500));
  const roadDist = union(...ROADS.map((r) => cap(r.pts, 0)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = null, bd = 0;
    MASSES.forEach((M, i) => {
      if (M.clip && M.clip(x, y) >= 0) return;
      let d = bodies[i](x, y) + fbm(x, y, M.seed, 6) * M.amp;
      // (it may carve deep bays but only push the coast out a little: the border must not clip it)
      if (M.outer) d += Math.max(-1.5, fbm(x, y, M.seed + 77, M.outer.scale, 2) * M.outer.amp) * Math.max(0, Math.min(1, M.outer.zone(x, y) / M.outer.ramp));
      if (M.inner) d += Math.max(0, fbm(x, y, M.seed + 99, M.inner.scale, 2) * M.inner.amp) * Math.max(0, Math.min(1, (roadDist(x, y) - 2.5) / 3));
      if (d < bd) { bd = d; best = M; }
    });
    if (!best) continue;
    let reg = best.regions[0], rd = Infinity;
    if (best.regions.length > 1) {
      for (const r of best.regions) {
        const R = REGIONS[r];
        const d = R.claim(x, y) + fbm(x, y, R.seed, 7) * 2.6;
        if (d < rd) { rd = d; reg = r; }
      }
    }
    MASS[y][x] = best.id; OWN[y][x] = reg;
    G[y][x] = CH[REGIONS[reg].ground];
  }
  for (const reg of Object.keys(LAYERS)) {
    for (const [id, shape, o] of LAYERS[reg]) {
      const amp = o.amp == null ? 1 : o.amp, seed = o.seed || 1, scale = o.scale || 5;
      const on = o.on ? new Set(o.on.map((k) => T[k])) : null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (OWN[y][x] !== reg || WATER.has(G[y][x])) continue;
        if (on && !on.has(G[y][x])) continue;
        if (shape(x, y) + fbm(x, y, seed, scale) * amp >= 0) continue;
        if (o.dens && (fbm(x, y, seed + 1000, o.dens[0], 2) + 1) / 2 < o.dens[1]) continue;
        G[y][x] = T[id];
      }
    }
  }
}
function clearCell(x, y) { G[y][x] = CH.sea; OWN[y][x] = null; MASS[y][x] = null; }
function enforceBorder() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) clearCell(x, y);
  }
}
/** smooth coasts: drop 1-tile spikes and fill 1-tile notches */
function smoothCoasts() {
  for (let pass = 0; pass < 2; pass++) {
    const flips = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (PROTECT[y][x]) continue;
      const land = isLand(G[y][x]);
      let n = 0;
      for (const [dx, dy] of N4) if (isLand(G[y + dy][x + dx]) !== land) n++;
      if (n >= 3) flips.push([x, y, land]);
    }
    for (const [x, y, land] of flips) {
      if (land) clearCell(x, y);
      else {
        const k = N4.map(([dx, dy]) => [x + dx, y + dy]).find(([i, j]) => OWN[j][i]);
        if (!k) continue;
        OWN[y][x] = OWN[k[1]][k[0]]; MASS[y][x] = MASS[k[1]][k[0]];
        G[y][x] = CH[REGIONS[OWN[y][x]].ground === 'mountain' ? 'hills' : REGIONS[OWN[y][x]].ground];
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
/** remove land specks (< 5 cells); fill enclosed sea pockets (lakes are painted later) */
function cleanSpecks() {
  const land = components((ch) => isLand(ch));
  for (const cells of land.comps) if (cells.length < 5) for (const [x, y] of cells) clearCell(x, y);
  const sea = components((ch) => !isLand(ch));
  for (const cells of sea.comps) {
    if (cells.some(([x, y]) => x === 0 && y === 0)) continue;
    for (const [x, y] of cells) {
      const k = N4.map(([dx, dy]) => [x + dx, y + dy]).find(([i, j]) => inb(i, j) && OWN[j][i]);
      if (!k) continue;
      OWN[y][x] = OWN[k[1]][k[0]]; MASS[y][x] = MASS[k[1]][k[0]];
      G[y][x] = CH[REGIONS[OWN[y][x]].ground];
    }
  }
}
/** different landmasses keep at least two sea tiles between them */
function checkSeparation() {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = MASS[y][x];
    if (!a || !isLand(G[y][x])) continue;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const b = inb(x + i, y + j) && isLand(G[y + j][x + i]) ? MASS[y + j][x + i] : null;
      if (b && b !== a && !(a === 'islets' && b === 'islets')) throw new Error(`landmasses ${a} and ${b} nearly touch at ${x},${y}`);
    }
  }
}
function paintChannels() {
  for (const f of CHANNELS) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y) < 0) { clearCell(x, y); PROTECT[y][x] = true; }
  }
  for (const [x0, y0, x1, y1, reg] of FORCE_LAND) {
    const mass = MASSES.find((M) => M.regions.includes(reg)).id;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      G[y][x] = CH[REGIONS[reg].ground]; OWN[y][x] = reg; MASS[y][x] = mass; PROTECT[y][x] = true;
    }
  }
  for (const b of BRIDGES) for (const [x, y] of b.cells) { set(x, y, CH[b.id]); PROTECT[y][x] = true; }
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
      if (e2 > -dy && (dx >= dy || !(e2 < dx))) { err -= dy; x0 += sx; }
      else { err += dx; y0 += sy; }
      push(x0, y0);
    }
  }
  return out;
}
const RIVER_CELLS = new Set();
function paintWaters() {
  for (const lk of LAKES) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (lk.shape(x, y) + fbm(x, y, 777, 3) * lk.amp < 0 && isLand(G[y][x]) && !PROTECT[y][x]) { G[y][x] = CH.sea; PROTECT[y][x] = true; }
    }
  }
  for (const rv of RIVERS) {
    for (const [x, y] of rasterLine(rv.pts)) {
      if (!inb(x, y) || PROTECT[y][x] || !isLand(G[y][x])) continue;
      G[y][x] = T.river; PROTECT[y][x] = true; RIVER_CELLS.add(y * W + x);
    }
  }
}

// roads
const ROAD_CELLS = new Set(); // base road cells
const PATCHES = []; // {cond, cells:[[x,y]], tile}
function paintRoads() {
  for (const rd of ROADS) {
    const cells = rasterLine(rd.pts);
    const out = [];
    for (let i = 0; i < cells.length; i++) {
      const [x, y] = cells[i];
      const ch = get(x, y);
      if (ICON.has(ch) || BRIDGES.some((b) => b.cells.some(([bx, by]) => bx === x && by === y))) continue;
      if (RIVER_CELLS.has(y * W + x)) {
        if (rd.patch) throw new Error(`patch road crosses a river at ${x},${y}`);
        // the road steps across: the river must run straight here, perpendicular to the road
        const [px, py] = cells[i - 1] || [], [qx, qy] = cells[i + 1] || [];
        const ns = px === x && qx === x, ew = py === y && qy === y;
        const riverEW = RIVER_CELLS.has(y * W + x - 1) && RIVER_CELLS.has(y * W + x + 1);
        const riverNS = RIVER_CELLS.has((y - 1) * W + x) && RIVER_CELLS.has((y + 1) * W + x);
        if (ns && riverEW && !riverNS) set(x, y, CH.bridge_v);
        else if (ew && riverNS && !riverEW) set(x, y, CH.bridge_h);
        else throw new Error(`road crosses the river at ${x},${y} where it is not straight`);
        RIVER_CELLS.delete(y * W + x);
        continue;
      }
      if (!isLand(ch)) throw new Error(`road ${JSON.stringify(rd.pts[0])}… runs into the sea at ${x},${y}`);
      if (rd.patch) { out.push([x, y]); continue; }
      set(x, y, CH.road); PROTECT[y][x] = true; ROAD_CELLS.add(y * W + x);
    }
    if (rd.patch) PATCHES.push({ cond: rd.patch, cells: out, tile: 'road', through: !!rd.through });
  }
}
/** the 抜け道 of Dovan stays solid rock in the base map; its neighbours too */
function sealThrough() {
  for (const p of PATCHES) {
    if (!p.through) continue;
    for (const [x, y] of p.cells) {
      for (const dy of [-1, 0, 1]) {
        const c = get(x, y + dy);
        if (dy && ROAD_CELLS.has((y + dy) * W + x)) continue;
        if (isLand(c) && !ICON.has(c)) { set(x, y + dy, CH.mountain); PROTECT[y + dy][x] = true; }
      }
    }
  }
}

const STEP = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] };
function paintIcons() {
  for (const ic of ICONS) {
    const own = OWN[ic.y] && OWN[ic.y][ic.x];
    if (!isLand(get(ic.x, ic.y)) || own !== ic.land) throw new Error(`icon ${ic.map} at ${ic.x},${ic.y} is not on ${ic.land} (${get(ic.x, ic.y)} / ${own})`);
    set(ic.x, ic.y, T[ic.icon]);
    PROTECT[ic.y][ic.x] = true;
    const ground = CH[REGIONS[ic.land].ground];
    for (const [dx, dy] of N8) {
      const x = ic.x + dx, y = ic.y + dy, ch = get(x, y);
      if (PROTECT[y][x] || !isLand(ch)) continue;
      // towns stand in the open; caves and the volcano may sit in rock; wild spots keep their woods
      if (ch === CH.magma || ch === CH.swamp || (isRock(ch) && !ic.rock)) set(x, y, ic.land === 'mine' ? CH.plain : ground === CH.mountain ? CH.hills : ground);
      else if (!ic.wild && !ic.rock && (ch === CH.forest || ch === CH.snowforest || ch === T.jungle || ch === T.deadforest)) set(x, y, ground);
    }
    if (ic.port && !N4.some(([dx, dy]) => WATER.has(get(ic.x + dx, ic.y + dy)))) throw new Error(`port ${ic.map} at ${ic.x},${ic.y} has no sea beside it`);
  }
}
function paintSecrets() {
  for (const s of SECRETS) {
    const mass = MASSES.find((M) => M.regions.includes(s.region)).id;
    const ground = CH[REGIONS[s.region].ground];
    const inner = s.pocket.concat(s.path);
    const key = (x, y) => y * W + x;
    const innerSet = new Set(inner.map(([x, y]) => key(x, y)));
    const entryKey = key(s.entry[0], s.entry[1]);
    for (const [x, y] of inner) {
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (innerSet.has(key(nx, ny)) || key(nx, ny) === entryKey) continue;
        if (PROTECT[ny][nx] && !isRock(get(nx, ny)) && isLand(get(nx, ny))) throw new Error(`secret ${s.id}: wall cell ${nx},${ny} is protected (${get(nx, ny)})`);
        if (isLand(get(nx, ny))) { set(nx, ny, CH[s.wall]); OWN[ny][nx] = s.region; MASS[ny][nx] = mass; }
        PROTECT[ny][nx] = true;
      }
    }
    for (const [x, y] of s.pocket) { set(x, y, ground === CH.snow ? CH.snow : ground); OWN[y][x] = s.region; MASS[y][x] = mass; PROTECT[y][x] = true; }
    for (const [x, y] of s.path) { set(x, y, CH[s.tile]); OWN[y][x] = s.region; MASS[y][x] = mass; PROTECT[y][x] = true; }
    const [ex, ey] = s.entry;
    if (!walkable(get(ex, ey)) || ICON.has(get(ex, ey))) { set(ex, ey, ground); OWN[ey][ex] = s.region; MASS[ey][ex] = mass; }
    PROTECT[ey][ex] = true;
  }
}
function paintReefs() {
  const REEFS = [ell(98, 84, 1.6, 1.2), ell(122, 92, 1, 2), ell(103, 102.5, 2, 1), ell(96, 97, 1.2, 1.6), ell(58, 70, 1.4, 1), ell(86, 44, 1, 1.2), ell(20, 106, 2, 0.8), ell(64, 106, 2, 0.8), ell(122, 50, 0.8, 2)];
  for (const r of REEFS) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (G[y][x] === CH.sea && !PROTECT[y][x] && r(x, y) < 0 && (x + y) % 2 === 0 && x >= BORDER && y >= BORDER && x < W - BORDER && y < H - BORDER) G[y][x] = CH.reef;
    }
  }
}

// ------------------------------------------------------------- repairs
function bfsWalk(starts) {
  const seen = [];
  for (let y = 0; y < H; y++) seen.push(new Uint8Array(W));
  const q = [];
  for (const [sx, sy] of starts) if (!seen[sy][sx]) { seen[sy][sx] = 1; q.push([sx, sy]); }
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
/** make (tx,ty) reachable from (sx,sy): the cheapest path through rock (never water, never
 *  protected cells, never another landmass) is opened up; → number of opened cells */
function connect(sx, sy, tx, ty, mass) {
  const seen = bfsWalk([[sx, sy]]);
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
    if (MASS[y][x] !== mass) return Infinity;
    if (walkable(ch)) return 1;
    if (PROTECT[y][x]) return Infinity;
    if (isRock(ch)) return 6;
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
  if (dist[ty][tx] === Infinity) throw new Error(`cannot connect ${tx},${ty} on ${mass}`);
  let n = 0, cur = prev[ty][tx];
  while (cur >= 0) {
    const x = cur % W, y = (cur / W) | 0;
    if (seen[y][x]) break;
    if (isRock(G[y][x])) { G[y][x] = passChar(OWN[y][x]); n++; }
    cur = prev[y][x];
  }
  return n;
}
/** what an opened-up mountain becomes */
function passChar(reg) {
  const g = REGIONS[reg] ? REGIONS[reg].ground : 'grass';
  return g === 'grass' || g === 'plain' || g === 'mountain' ? CH.hills : CH[g];
}
const GROUPS = [
  { mass: 'penin', from: [46, 58], to: ['roa', 'lighthouse_1', [42, 44], [38, 49]] },
  { mass: 'continent', from: [42, 37], to: ['fern', 'verda_maze_1', 'kasim', 'sand_tomb_1', 'yule', 'frost_peak_1', 'loch', 'mist_manor_1', 'bell_marsh_1',
    'dovan', 'deep_mine_1', 'caldera', 'ash_volcano_1', 'orbis', 'stargaze_1', [42, 39], [87, 74], [92, 74], [69, 20], [81, 20], [33, 96], [64, 28]] },
  { mass: 'isles', from: [106, 90], to: ['nerei', 'tide_cave_1'] },
  { mass: 'biblia', from: [70, 58], to: ['archive_1'] },
];
function repairConnectivity() {
  for (const g of GROUPS) {
    for (const t of g.to) {
      const p = typeof t === 'string' ? iconOf(t) : { x: t[0], y: t[1] };
      const n = connect(g.from[0], g.from[1], p.x, p.y, g.mass);
      if (n && !argv.includes('--quiet')) console.log(`  opened ${n} tile(s) toward ${typeof t === 'string' ? t : t.join(',')}`);
    }
  }
}

// sandy beaches on stretches of open coast
function paintBeaches() {
  const marks = [];
  const OK = { penin: 0.05, biblia: -0.2, isles: -0.35, forest: 0.35, marsh: 9, cross: 0.4, desert: 9, star: 0.55, mine: 9, snow: 9, ash: 9, islet: -0.1 };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = G[y][x];
    if (PROTECT[y][x] || !(ch === CH.grass || ch === CH.plain || ch === CH.forest || ch === T.jungle)) continue;
    const reg = OWN[y][x];
    if (!reg || OK[reg] > 1) continue;
    const shore = N4.some(([dx, dy]) => { const c = get(x + dx, y + dy); return c === CH.sea && !RIVER_CELLS.has((y + dy) * W + x + dx); });
    if (!shore) continue;
    if (fbm(x, y, 4242, 7, 2) > OK[reg]) marks.push([x, y]);
  }
  for (const [x, y] of marks) G[y][x] = CH.beach;
}
/** hills/mountains on non-green land take their colour from nearby ground (the art looks two
 *  cells around); a hill with no ground class near it becomes ground */
function fixDerived() {
  const derived = (ch) => ch === CH.hills || ch === CH.mountain || ICON.has(ch) || ch === CH.bridge_h || ch === CH.bridge_v || SECRET.has(ch);
  const plainLand = (ch) => isLand(ch) && !derived(ch) && ch !== CH.magma;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const reg = OWN[y][x];
    if (!reg || G[y][x] !== CH.hills || PROTECT[y][x]) continue;
    const g = REGIONS[reg].ground;
    if (g === 'grass' || g === 'plain' || g === 'mountain') continue;
    let ok = false;
    for (let j = -2; j <= 2 && !ok; j++) for (let i = -2; i <= 2; i++) if (plainLand(get(x + i, y + j))) { ok = true; break; }
    if (!ok) G[y][x] = CH[g];
  }
}
/** walkable cells no one can ever reach become rock */
function sealPockets() {
  const seeds = ICONS.map((ic) => [ic.x, ic.y]);
  for (const b of BRIDGES) seeds.push(...b.cells);
  const seen = bfsWalk(seeds);
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (MASS[y][x] === 'islets') continue; // scenery out at sea, never walked on
    if (walkable(G[y][x]) && !seen[y][x]) { G[y][x] = CH.mountain; PROTECT[y][x] = true; n++; }
  }
  return n;
}

// ------------------------------------------------------------- patches (§10.5.6)
/** the cells within r of (cx,cy), with a ragged edge (never past r: the edge only frays inward) */
const disc = (cx, cy, r, seed = 1) => (x, y) => Math.hypot(x - cx, y - cy) <= r + 0.01 - Math.max(0, fbm(x, y, 3100 + seed, 2.6, 2)) * 2.4;
function cellsWhere(pred) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pred(x, y)) out.push([x, y]);
  return out;
}
function worldPatches() {
  const list = [];
  // the drawbridge is up until the prologue ends
  list.push({ cond: '!prologue_done', cells: BRIDGES[0].cells.slice(), tile: 'sea' });
  // the white fog around ビブリア島: 2 tiles off its coast, 2 more from tier 4 on (sea cells only)
  const isle = cellsWhere((x, y) => MASS[y][x] === 'biblia' && isLand(G[y][x]));
  const distToIsle = (x, y) => { let d = Infinity; for (const [i, j] of isle) d = Math.min(d, Math.hypot(x - i, y - j)); return d; };
  const DIST = [];
  for (let y = 40; y < 72; y++) for (let x = 56; x < 88; x++) if (G[y][x] === CH.sea) DIST.push([x, y, distToIsle(x, y)]);
  list.push({ cond: '!final_open', cells: DIST.filter((c) => c[2] <= 2.5).map((c) => [c[0], c[1]]), tile: 'fog' });
  list.push({ cond: [{ tier: 4 }, '!final_open'], cells: DIST.filter((c) => c[2] > 2.5 && c[2] <= 4.6).map((c) => [c[0], c[1]]), tile: 'fog' });
  // the forest road (近道) once r_forest is cleared
  for (const p of PATCHES) if (p.cond.cleared === 'r_forest') list.push({ cond: p.cond, cells: p.cells, tile: 'road' });
  // the sandstorm around 砂の王墓 until r_desert is cleared
  const tomb = iconOf('sand_tomb_1');
  list.push({ cond: { notCleared: 'r_desert' }, cells: cellsWhere((x, y) => G[y][x] === CH.desert && disc(tomb.x, tomb.y, 5, 1)(x, y)), tile: 'sandstorm' });
  // the thaw around ユール once r_snow is cleared
  const yule = iconOf('yule');
  list.push({ cond: { cleared: 'r_snow' }, cells: cellsWhere((x, y) => G[y][x] === CH.snow && disc(yule.x, yule.y, 6, 2)(x, y)), tile: 'plain' });
  // the marsh fog around 霧の館 and 鐘沈みの沼 until r_marsh is cleared
  const manor = iconOf('mist_manor_1'), bell = iconOf('bell_marsh_1');
  list.push({ cond: { notCleared: 'r_marsh' }, cells: cellsWhere((x, y) => G[y][x] === CH.marsh && (disc(manor.x, manor.y, 5, 3)(x, y) || disc(bell.x, bell.y, 5, 4)(x, y))), tile: 'marsh_fog' });
  // the 抜け道 of Dovan once r_mine is cleared
  for (const p of PATCHES) if (p.cond.cleared === 'r_mine') list.push({ cond: p.cond, cells: p.cells, tile: 'road' });
  // the ash turns to grass around カルデラ once r_ash is cleared
  const cal = iconOf('caldera');
  list.push({ cond: { cleared: 'r_ash' }, cells: cellsWhere((x, y) => G[y][x] === CH.ash && disc(cal.x, cal.y, 6, 5)(x, y)), tile: 'grass' });
  return list;
}
/** cells → horizontal runs {x, y, w} */
function runs(cells) {
  const byRow = {};
  for (const [x, y] of cells) (byRow[y] = byRow[y] || []).push(x);
  const out = [];
  for (const y of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
    const xs = byRow[y].sort((a, b) => a - b);
    let s = xs[0], p = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i < xs.length && xs[i] === p + 1) { p = xs[i]; continue; }
      out.push({ x: s, y, w: p - s + 1 });
      if (i < xs.length) { s = xs[i]; p = xs[i]; }
    }
  }
  return out;
}

// ------------------------------------------------------------- zones
function zoneMap(patches) {
  const Z = [];
  for (let y = 0; y < H; y++) Z.push(new Array(W).fill(null));
  const walkSomewhen = new Set();
  for (const p of patches) if (['road', 'grass', 'plain', 'sandstorm', 'marsh_fog'].includes(p.tile)) for (const [x, y] of p.cells) walkSomewhen.add(y * W + x);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = G[y][x];
    if (!(walkable(ch) || walkSomewhen.has(y * W + x)) || ICON.has(ch)) continue;
    let reg = OWN[y][x];
    if (!reg) { // bridges: the land they lead to
      if (BRIDGES[0].cells.some(([bx, by]) => bx === x && by === y)) reg = 'cross';
      else if (BRIDGES[1].cells.some(([bx, by]) => bx === x && by === y)) reg = 'marsh';
      else { const k = N8.map(([dx, dy]) => [x + dx, y + dy]).find(([i, j]) => inb(i, j) && OWN[j][i]); reg = k ? OWN[k[1]][k[0]] : 'forest'; }
    }
    Z[y][x] = REGION_ZONE[reg];
  }
  // a few cells of one region cut off inside another (noisy borders, the far side of a range)
  // walk with their neighbours: small pieces take the zone around them
  for (let pass = 0; pass < 3; pass++) {
    const lab = [];
    for (let y = 0; y < H; y++) lab.push(new Int32Array(W).fill(-1));
    let changed = false, id = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!Z[y][x] || lab[y][x] >= 0) continue;
      const z = Z[y][x], cells = [[x, y]];
      lab[y][x] = id;
      for (let i = 0; i < cells.length; i++) {
        const [cx, cy] = cells[i];
        for (const [dx, dy] of N4) {
          const nx = cx + dx, ny = cy + dy;
          if (!inb(nx, ny) || lab[ny][nx] >= 0 || Z[ny][nx] !== z) continue;
          lab[ny][nx] = id; cells.push([nx, ny]);
        }
      }
      id++;
      if (cells.length >= 30) continue;
      const cnt = {};
      for (const [cx, cy] of cells) for (const [dx, dy] of N4) {
        const nz = inb(cx + dx, cy + dy) ? Z[cy + dy][cx + dx] : null;
        if (nz && nz !== z) cnt[nz] = (cnt[nz] || 0) + 1;
      }
      const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      if (best) { for (const [cx, cy] of cells) Z[cy][cx] = best; changed = true; }
    }
    if (!changed) break;
  }
  return Z;
}
/** greedy rectangles over the zoned cells (the default zone's cells need none); a rectangle may
 *  include unwalkable cells (sea, rock) but never a walkable cell of another zone */
function buildZones(Z) {
  const covered = [];
  for (let y = 0; y < H; y++) covered.push(new Uint8Array(W));
  const ok = (x, y, z) => inb(x, y) && (Z[y][x] === null || Z[y][x] === z);
  const rects = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Z[y][x];
    if (!z || z === DEFAULT_ZONE || covered[y][x]) continue;
    const row = (x0, y0, w) => { for (let i = 0; i < w; i++) if (!ok(x0 + i, y0, z)) return false; return true; };
    const col = (x0, y0, h) => { for (let j = 0; j < h; j++) if (!ok(x0, y0 + j, z)) return false; return true; };
    const cands = [];
    { let w = 0; while (ok(x + w, y, z)) w++; let h = 1; while (row(x, y + h, w)) h++; cands.push({ w, h }); }
    { let h = 0; while (ok(x, y + h, z)) h++; let w = 1; while (col(x + w, y, h)) w++; cands.push({ w, h }); }
    let best = null, bn = -1;
    for (const c of cands) {
      let n = 0;
      for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) if (Z[y + j][x + i] === z && !covered[y + j][x + i]) n++;
      if (n > bn) { bn = n; best = c; }
    }
    // trim unwalkable margins so the rectangle hugs its cells
    let { w, h } = best, x0 = x, y0 = y;
    const has = (xa, ya, wa, ha) => { for (let j = 0; j < ha; j++) for (let i = 0; i < wa; i++) if (Z[ya + j][xa + i] === z) return true; return false; };
    while (h > 1 && !has(x0, y0 + h - 1, w, 1)) h--;
    while (w > 1 && !has(x0 + w - 1, y0, 1, h)) w--;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) covered[y0 + j][x0 + i] = 1;
    rects.push({ x: x0, y: y0, w, h, zone: z });
  }
  return rects;
}

// ------------------------------------------------------------- spawns
/** facing on arrival at an icon: toward open ground (down preferred) */
function exitDir(x, y) {
  for (const [d, dx, dy] of [['down', 0, 1], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1]]) {
    const ch = get(x + dx, y + dy);
    if (walkable(ch) && !ICON.has(ch) && !SECRET.has(ch)) return d;
  }
  throw new Error(`icon at ${x},${y} has no open neighbour`);
}

// ------------------------------------------------------------- main
function generate() {
  paintLands();
  enforceBorder();
  smoothCoasts();
  cleanSpecks();
  paintChannels();
  smoothCoasts();
  checkSeparation();
  paintWaters();
  paintRoads();
  sealThrough();
  paintIcons();
  paintSecrets();
  repairConnectivity();
  paintBeaches();
  paintReefs();
  enforceBorder();
  fixDerived();
  const sealed = sealPockets();
  if (sealed && !argv.includes('--quiet')) console.log(`  sealed ${sealed} unreachable walkable cell(s)`);
  const spawns = {};
  for (const ic of ICONS) spawns[ic.map] = { x: ic.x, y: ic.y, dir: exitDir(ic.x, ic.y) };
  const warps = ICONS.map((ic) => ({ x: ic.x, y: ic.y, to: ic.map, spawn: 'entrance' }));
  const patches = worldPatches();
  const zones = buildZones(zoneMap(patches));
  const events = [{ x: 42, y: 44, id: 'world_bridge_closed', trigger: 'step', cond: '!prologue_done' }];
  const chests = SECRETS.map((s) => ({ id: s.id, x: s.chest[0], y: s.chest[1], pool: s.pool }));
  return { rows: G.map((r) => r.join('')), spawns, warps, zones, patches, events, chests };
}

function emit(res) {
  const q = (s) => "'" + s + "'";
  const cond = (c) => (typeof c === 'string' ? q(c) : JSON.stringify(c).replace(/"([a-zA-Z_]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', '));
  const L = [];
  L.push('// World map エルセリア (128x112, wraps). GENERATED by tools/gen_world.js — do not edit by hand;');
  L.push('// change the generator and run `node tools/gen_world.js`, then `node tools/check_world.js`.');
  L.push('// DESIGN §10.5. Owner: world (A18a). P2 tiles used: ' + ([...P2ON].sort().join(' ') || 'none (fallbacks)') + '.');
  L.push("(function (R) {\n  'use strict';\n  R.DB.maps.world = {");
  L.push("    name: 'エルセリア', type: 'world', legend: 'world', bgm: 'overworld', outside: '~', wrap: true,");
  L.push('    rows: [');
  for (const r of res.rows) L.push('      ' + q(r) + ',');
  L.push('    ],');
  L.push('    marks: {},');
  L.push('    // world spawns: the name is the map id the icon leads into (DB.locations[*].spawn)');
  L.push('    spawns: {');
  for (const k of Object.keys(res.spawns)) { const s = res.spawns[k]; L.push(`      ${k}: { x: ${s.x}, y: ${s.y}, dir: '${s.dir}' },`); }
  L.push('    },');
  L.push('    warps: [');
  for (const w of res.warps) L.push(`      { x: ${w.x}, y: ${w.y}, to: '${w.to}', spawn: '${w.spawn}' },`);
  L.push('    ],');
  L.push(`    // encounter zones (§10.5.7): first match wins; cells in no rectangle use defaultZone (${DEFAULT_ZONE})`);
  L.push('    zones: [');
  for (let i = 0; i < res.zones.length; i += 3) {
    L.push('      ' + res.zones.slice(i, i + 3).map((z) => `{ x: ${z.x}, y: ${z.y}, w: ${z.w}, h: ${z.h}, zone: '${z.zone}' }`).join(', ') + ',');
  }
  L.push('    ],');
  L.push(`    defaultZone: '${DEFAULT_ZONE}',`);
  L.push('    // world tilePatches (§10.5.6): all of them only change the look or open a shortcut');
  L.push('    tilePatches: [');
  for (const p of res.patches) {
    L.push(`      // ${p.tile} while ${typeof p.cond === 'string' ? p.cond : JSON.stringify(p.cond)}`);
    const rs = runs(p.cells);
    for (let i = 0; i < rs.length; i += 3) {
      L.push('      ' + rs.slice(i, i + 3).map((r) => `{ cond: ${cond(p.cond)}, x: ${r.x}, y: ${r.y}${r.w > 1 ? ', w: ' + r.w : ''}, tile: '${p.tile}' }`).join(', ') + ',');
    }
  }
  L.push('    ],');
  L.push('    events: [');
  for (const e of res.events) L.push(`      { x: ${e.x}, y: ${e.y}, id: '${e.id}', trigger: '${e.trigger}', cond: ${cond(e.cond)} },`);
  L.push('    ],');
  L.push('    // hidden passages (§10.6.4): tier chests behind secret_forest / secret_rock');
  L.push('    chests: [');
  for (const c of res.chests) L.push(`      { id: '${c.id}', x: ${c.x}, y: ${c.y}, pool: '${c.pool}' },`);
  L.push('    ],');
  L.push('  };');
  L.push('})(window.RPG);');
  return L.join('\n') + '\n';
}

let res;
try { res = generate(); } catch (e) {
  const di = argv.indexOf('--dump');
  if (di >= 0) fs.writeFileSync(argv[di + 1], G.map((r, y) => String(y).padStart(3) + ' ' + r.join('')).join('\n') + '\n');
  console.error('gen_world: ' + e.message);
  process.exit(1);
}
if (argv.includes('--ascii')) {
  const hdr = (d) => '    ' + Array.from({ length: W }, (_, x) => (d === 10 ? Math.floor(x / 10) % 10 : x % 10)).join('');
  console.log(hdr(10)); console.log(hdr(1));
  res.rows.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + r));
}
const src = emit(res);
console.log(`world: ${W}x${H}, ${res.zones.length} zone rects, ${Object.keys(res.spawns).length} spawns, ${res.warps.length} warps, ` +
  `${res.patches.reduce((n, p) => n + runs(p.cells).length, 0)} patch runs, P2: ${[...P2ON].sort().join(' ') || 'none'}`);
if (!argv.includes('--dry')) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src);
  console.log('wrote', path.relative(process.cwd(), OUT));
}
