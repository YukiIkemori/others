// 鐘沈みの沼 (bell_marsh_1) — 58×48 outdoor swamp maze. Node-only; see lib/sync.js.
// Islands of wet ground joined by strips of land and plank walks; reeds on the shores make the
// walls, deep bog pools in the water, dead trees and rocks on the islands. Deterministic (seeded).
'use strict';
const { Grid } = require('./grid');

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

module.exports = function marsh() {
  const W = 58, H = 48;
  const T = new Grid(W, H, '~');
  const D = new Grid(W, H, '.');
  const P = new Grid(W, H, 0);     // protected cells (paths): never reeds / trees / rocks
  const r = rng(4417);
  const land = (x, y, prot) => { if (!T.in(x, y)) return; if (T.get(x, y) === '~') T.set(x, y, '.'); if (prot) P.set(x, y, 1); };
  const blob = (cx, cy, rx, ry) => {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      const d = dx * dx + dy * dy;
      if (d <= 1 || (d <= 1.25 && r() < 0.5)) land(x, y);
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) P.set(x, y, 1);
  };
  const strip = (x0, y0, x1, y1, w) => {   // straight or diagonal strip of protected land
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / (n || 1)), y = Math.round(y0 + ((y1 - y0) * i) / (n || 1));
      for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) land(x + j, y + k, true);
    }
  };
  const bridgeH = (x0, x1, y, w) => { for (let x = x0; x <= x1; x++) for (let j = 0; j < w; j++) { T.set(x, y + j, '='); P.set(x, y + j, 1); } };
  const bridgeV = (x, y0, y1, w) => { for (let y = y0; y <= y1; y++) for (let j = 0; j < w; j++) { T.set(x + j, y, '|'); P.set(x + j, y, 1); } };

  // ---- islands
  blob(29, 42, 5, 3);   // entrance
  blob(29, 33, 4, 3);   // south junction
  blob(15, 34, 4, 3);   // west junction
  blob(6, 27, 3, 3);    // bell A (west)
  blob(13, 21, 4, 3);   // north-west junction
  blob(4, 17, 2, 2);    // west dead end (chest)
  blob(9, 9, 4, 3);     // bell B (north-west)
  blob(42, 33, 4, 3);   // east junction
  blob(50, 24, 4, 3);   // bell C (east)
  blob(49, 10, 3, 3);   // north-east dead end (p_rare)
  blob(44, 42, 3, 2);   // south-east dead end (chest)
  blob(29, 18, 5, 2);   // antechamber (休息の灯, フィーネ)
  blob(29, 7, 9, 4);    // the clearing (霧食らい)
  // ---- land strips (protected)
  strip(28, 36, 28, 44, 3);     // entrance → south junction
  strip(28, 44, 28, 47, 2);     // entrance path to the map edge
  strip(9, 30, 12, 32, 2);      // west junction → bell A
  strip(6, 29, 9, 31, 2);
  strip(11, 18, 8, 12, 2);      // north-west → bell B
  strip(9, 19, 5, 17, 2);       // north-west → west dead end
  strip(33, 32, 38, 32, 3);     // south → east junction
  strip(45, 30, 48, 27, 2);     // east → bell C
  strip(43, 36, 43, 40, 2);     // east → south-east dead end
  strip(28, 21, 28, 30, 3);     // south junction → the fog gate → antechamber
  strip(28, 11, 28, 16, 3);     // antechamber → clearing
  // ---- plank walks over the water
  bridgeH(20, 24, 33, 2);       // west junction ↔ south junction
  bridgeV(13, 25, 30, 2);       // west junction ↔ north-west
  bridgeV(49, 14, 20, 2);       // bell C ↔ north-east dead end
  strip(49, 21, 49, 22, 2);
  // ---- keep the centre ring apart from the sides: water moat around antechamber/clearing
  for (let y = 0; y < 24; y++) for (let x = 0; x < W; x++) {
    const inCentre = x >= 18 && x <= 40 && y <= 21;
    if (!inCentre) continue;
    const dx = Math.min(Math.abs(x - 18), Math.abs(x - 40));
    if (dx <= 1 && !P.get(x, y)) T.set(x, y, '~');
  }
  // ---- reeds on the shores (walls), bog pools in the water, dead trees, rocks, mud
  const shore = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = T.get(x + dx, y + dy); return c === '~' || c === null; });
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push([x, y]);
  // reed beds grow in clumps along the shores (seeded, then two growth passes)
  for (const [x, y] of cells) if (T.get(x, y) === '.' && !P.get(x, y) && shore(x, y) && r() < 0.22) T.set(x, y, '#');
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (const [x, y] of cells) {
      if (T.get(x, y) !== '.' || P.get(x, y) || !shore(x, y)) continue;
      const nR = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => T.get(x + dx, y + dy) === '#').length;
      if (nR && r() < 0.5) add.push([x, y]);
    }
    for (const [x, y] of add) T.set(x, y, '#');
  }
  // the water of the bog is murky deep bog everywhere (the map's outside is bog too)
  for (const [x, y] of cells) if (T.get(x, y) === '~') T.set(x, y, 'w');
  for (const [x, y] of cells) {
    if (T.get(x, y) !== '.' || P.get(x, y)) continue;
    const q = r();
    if (q < 0.05) T.set(x, y, 'l'); else if (q < 0.08) T.set(x, y, 'T'); else if (q < 0.10) T.set(x, y, 'r'); else if (q < 0.24) T.set(x, y, 'z');
  }
  for (const [x, y] of cells) if (T.get(x, y) === '.' && P.get(x, y) && r() < 0.12) T.set(x, y, 'z');
  // ---- set pieces (fixed cells; the map file places the objects on them)
  // the three bell chains: pile on the shore (chain NPC) and the sunken bell in the bog beside it
  const BELLS = { a: { chain: [3, 28], bell: [2, 28], from: [6, 28] }, b: { chain: [6, 8], bell: [5, 8], from: [9, 9] }, c: { chain: [54, 24], bell: [55, 24], from: [50, 24] } };
  for (const k in BELLS) {
    const b = BELLS[k];
    strip(b.from[0], b.from[1], b.chain[0], b.chain[1], 1);
    T.set(b.chain[0], b.chain[1], '.');
    T.set(b.bell[0], b.bell[1], 'w'); D.set(b.bell[0], b.bell[1], '|');
  }
  // the four bells whose chains are gone (decor only)
  for (const [x, y] of [[21, 44], [37, 22], [16, 7], [55, 34]]) { T.set(x, y, 'w'); D.set(x, y, '|'); }
  // the fog gate (closed until the three bells ring; tilePatch in the map file)
  T.rect(28, 25, 3, 1, 'G');
  // poison edges beside the paths (§10.6.2-11: about 14 cells, never across a path)
  for (const [x, y] of [[30, 37], [30, 38], [34, 34], [35, 34], [37, 32], [38, 32], [28, 28], [28, 29], [30, 26], [8, 31], [9, 31], [12, 19], [13, 19], [10, 14]]) T.set(x, y, 'x');
  // tidy the fixed spots: stand-clear cells for NPCs, chests, spawns
  for (const [x, y] of [[26, 18], [29, 17], [29, 6], [27, 5], [31, 5], [29, 4], [29, 5], [28, 46], [29, 46], [28, 47], [29, 47],
    [4, 17], [49, 9], [44, 42], [11, 8], [25, 42], [27, 19], [30, 19]]) if (T.get(x, y) !== '.') T.set(x, y, '.');
  // decor: mushrooms, leaves on the islands
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (T.get(x, y) !== '.' || P.get(x, y) || D.get(x, y) !== '.') continue;
    const q = r();
    if (q < 0.04) D.set(x, y, '*'); else if (q < 0.08) D.set(x, y, 'l');
  }
  return { T, D, P, W, H, BELLS, decorLegend: { '|': 'sunken_bell' } };
};
