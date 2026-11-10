// Palette. Every colour in the world comes from these ramps (dark -> light), built in the same colour language as the
// 96-dot hero: shadows lean navy/violet, lights lean warm cream, outlines are near-black violet.
(function () {
  const HD = (window.HD = window.HD || {});
  const P = (HD.P = {
    ink: '#17131f',          // deepest joint colour (the sprite has no black outlines: neither does the world)
    stone:  ['#17131f', '#262234', '#38354b', '#4e4b63', '#69667c', '#878294', '#a8a0a6', '#cbbfb4', '#e6d8c2'],   // cool grey-violet ashlar
    sand:   ['#201a20', '#332a30', '#4a3f44', '#655759', '#84736f', '#a39184', '#c0ae9a', '#d9c9b0', '#ebdfc8'],   // warm dressed stone (trim, tracery, crosses)
    slate:  ['#0a0e1a', '#131a2e', '#1c2944', '#293759', '#3b4c76', '#566b96', '#7c8fb4', '#a9b6d0'],              // roof slate, the hero's cape blues
    grass:  ['#10131a', '#181f24', '#222d2c', '#2e3d34', '#3e4f3c', '#536346', '#6f7a54', '#8f9468', '#b3b086'],   // dusk-lit grass: muted olive, never vivid green
    dirt:   ['#211920', '#352a2e', '#4b3d3b', '#64534a', '#7e6b5a', '#98856e', '#b09d84', '#c7b69c'],              // footpaths
    wood:   ['#170b0b', '#2d1913', '#44261a', '#5d3722', '#7c4c2f', '#9a603a', '#ba7e4c', '#dba266'],              // doors, pews, beams (hero's leather browns)
    moss:   ['#11171a', '#1b2623', '#28382c', '#3a4c36', '#525f42', '#727a54'],
    autumn: ['#2a1416', '#451c17', '#6a2c1c', '#8f4424', '#b5683a', '#cf8e58', '#e6b47a', '#f3d6ac'],              // the tree that still turns red; lantern oranges
    water:  ['#070a16', '#0d1428', '#152040', '#1f3058', '#2f4878', '#4a6aa0', '#7a9ac8'],
    iron:   ['#07070c', '#12131c', '#1f222e', '#303544', '#474d5e'],
    gold:   ['#3d2412', '#6a3f18', '#9a6520', '#c99332', '#f0c659', '#fff0a8'],                                     // bell bronze, candle flame
    glass:  ['#5a1830', '#a02a3a', '#d8663a', '#f0b040', '#f8e890', '#3a8a78', '#2a5a9a', '#6a3a9a', '#c05a9a'],    // stained glass (not a ramp: a set)
    sky:    ['#0f0d22', '#1b1838', '#2b2843', '#443a5c', '#5d4a66', '#84607a', '#a9747a', '#d09a84', '#ecc79a', '#fbe6c2'], // zenith -> horizon glow
  });
  // helpers ---------------------------------------------------------------------------------------------------------
  P.rgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const cache = {};
  P.ramp = name => cache[name] || (cache[name] = P[name].map(P.rgb));
  // deterministic random: const r = HD.rng(123); r() -> [0,1)
  HD.rng = function (seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    const f = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.sign = () => (f() < 0.5 ? -1 : 1);
    return f;
  };
  // hash / value noise used by textures and geometry alike (2D, tile-free)
  HD.hash2 = function (x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  HD.vnoise = function (x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = HD.hash2(xi, yi, s), b = HD.hash2(xi + 1, yi, s), c = HD.hash2(xi, yi + 1, s), d = HD.hash2(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  HD.fbm = function (x, y, s, oct) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < (oct || 4); i++) { v += a * HD.vnoise(x * f, y * f, (s | 0) + i * 17); n += a; a *= 0.5; f *= 2; } return v / n; };
})();
