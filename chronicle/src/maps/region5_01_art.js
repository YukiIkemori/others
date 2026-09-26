// Region 5 マレア諸島 — the region's own set-piece sprites (drawn procedurally; §11.2.11 見せ場の絵
// 「帆柱と舵輪、青白い灯」). Owner: reg-5 (R5). Used as NPC sprites on the region's maps:
//   obj:r5_ghost_ship    Glen's ship at the Nerei pier on the night of the song: torn sails, pale blue
//                        lanterns (2 frames, the lights flicker), mist at the waterline. 80×64, bow left.
//   obj:r5_ghost_wreck   the same hull after the clear, lying on the rocks: no lights, sails in rags,
//                        listing a little. 80×64.
//   obj:r5_beacon        岬の灯, the old stone beacon on the Nerei cape (16×32, 2 frames: the flame).
//   obj:r5_regnas_ship   the Regnas merchant ship at Coral after the clear: a sound, bright merchantman
//                        (oak hull, cream sails with the red Regnas band, gold trim). 80×64, 2 frames.
// The field draws obj: sprites bottom-aligned on their tile (the waterline sits on that tile's row).
(function (R) {
  'use strict';
  const G = R.Gfx;
  if (!G || !G.def) return;

  const HULL = ['#16141c', '#221e28', '#302a36', '#3e3644', '#4e4454'];
  const WRECK = ['#1a1612', '#28221c', '#383026', '#4a4032', '#5a4e3e'];
  const SAIL = ['#6e747e', '#8c929c', '#aab0b8', '#c8ccd2'];
  const RAG = ['#5a5a58', '#747270', '#8e8a84'];
  const WOOD = '#2c2428', WOOD_L = '#463a3c';
  const INK = '#0c0a10';

  /** a tiny deterministic noise so the tatters are the same every time */
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function hull(p, ramp, tilt) {
    const dy = (x) => Math.round((tilt || 0) * (x - 40) / 40);
    // hull body (bow left): keel line, bow rake, high stern castle
    const pts = [[4, 38], [12, 49], [22, 52], [62, 52], [72, 47], [77, 33], [77, 29], [60, 29], [60, 37], [16, 37], [8, 34]];
    p.poly(pts.map(([x, y]) => [x, y + dy(x)]), ramp[2]);
    // shading: planks (horizontal streaks) and a dark keel
    p.each((x, y, c) => {
      if (c !== ramp[2]) return undefined;
      const yy = y - dy(x);
      if (yy >= 48) return ramp[0];
      if (yy >= 45) return ramp[1];
      if (yy % 3 === 0) return ramp[1];
      if (yy <= 38 && yy % 3 === 1) return ramp[3];
      return undefined;
    });
    // gunwale and stern rail
    for (let x = 8; x <= 60; x++) p.set(x, 37 + dy(x), ramp[4]);
    for (let x = 60; x <= 77; x++) p.set(x, 29 + dy(x), ramp[4]);
    for (let x = 62; x <= 76; x += 3) p.vline(x, 26 + dy(x), 28 + dy(x), ramp[3]);
    for (let x = 12; x <= 58; x += 4) p.vline(x, 35 + dy(x), 36 + dy(x), ramp[3]);
    // stern windows
    for (const x of [64, 68, 72]) { p.rect(x, 32 + dy(x), 2, 2, ramp[0]); }
    // cannon ports
    for (const x of [22, 32, 42, 52]) p.rect(x, 41 + dy(x), 3, 2, ramp[0]);
    // bowsprit
    p.line(8, 34 + dy(8), 0, 27 + dy(0), WOOD_L);
  }
  function masts(p, tilt, broken) {
    const dy = (x) => Math.round((tilt || 0) * (x - 40) / 40);
    const lean = broken ? 1 : 0;
    p.line(28, 37 + dy(28), 28 + lean * 3, 3 + dy(28), WOOD, 2);
    if (!broken) p.line(50, 37 + dy(50), 50, 8 + dy(50), WOOD, 2);
    else p.line(50, 37 + dy(50), 51, 20 + dy(50), WOOD, 2);
    // yards
    p.hline(19 + lean, 38 + lean, 7 + dy(28), WOOD_L);
    p.hline(20 + lean, 37 + lean * 2, 20 + dy(28), WOOD_L);
    if (!broken) { p.hline(43, 57, 12 + dy(50), WOOD_L); p.hline(44, 56, 24 + dy(50), WOOD_L); }
    // rigging
    p.line(28, 4 + dy(28), 2, 28 + dy(2), '#3a3440');
    p.line(28, 4 + dy(28), 60, 29 + dy(60), '#3a3440');
    if (!broken) p.line(50, 9 + dy(50), 76, 28 + dy(76), '#3a3440');
  }
  function sail(p, x0, y0, x1, y1, ramp, seed, torn) {
    for (let y = y0; y <= y1; y++) {
      const bulge = Math.round(Math.sin(((y - y0) / Math.max(1, y1 - y0)) * Math.PI) * 2);
      for (let x = x0 - bulge; x <= x1 - bulge; x++) {
        const h = hash(x, y, seed);
        // ragged lower edge and holes
        if (y > y1 - 4 && h < torn * ((y - (y1 - 4)) / 4)) continue;
        if (h < torn * 0.34) continue;
        const k = x <= x0 - bulge + 1 ? 0 : x >= x1 - bulge - 1 ? 1 : (y - y0) % 5 === 0 ? 1 : 2 + (h > 0.7 ? 1 : 0);
        p.set(x, y, ramp[Math.min(ramp.length - 1, k)]);
      }
    }
  }
  function lantern(p, x, y, lit, f) {
    p.set(x, y - 2, WOOD_L);
    p.rect(x - 1, y - 1, 3, 3, '#2a3444');
    if (!lit) return;
    const core = f ? '#f4fcff' : '#d8f0ff', halo = f ? '#8cc8f4c0' : '#6aaee8a0', far = f ? '#5a9ad860' : '#4a88c840';
    for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
      const d = xx * xx + yy * yy;
      if (d > 16 || p.get(x + xx, y + yy)) continue;
      if (d > 8) { if ((xx + yy) & 1) p.set(x + xx, y + yy, far); } else p.set(x + xx, y + yy, halo);
    }
    p.set(x, y, core); p.set(x, y - 1, halo.slice(0, 7)); p.set(x - 1, y, halo.slice(0, 7)); p.set(x + 1, y, halo.slice(0, 7));
  }
  function mist(p, f, amt) {
    for (let y = 48; y < 64; y++) for (let x = 0; x < 80; x++) {
      const h = hash(x + f * 3, y, 7);
      const w = y < 54 ? 0.1 : y < 58 ? 0.35 : 0.2;
      if (h < w * amt && !p.get(x, y)) p.set(x, y, y < 56 ? '#cfd8e880' : '#dfe6f050');
    }
  }
  function ghost(f) {
    const p = new G.Pix(80, 64);
    // pennant
    const pen = f ? [[29, 1], [37, 2], [33, 3], [29, 4]] : [[29, 1], [36, 3], [31, 3], [29, 4]];
    p.poly(pen, '#3e5064');
    sail(p, 20, 8, 37, 19, SAIL, 1, 0.55);
    sail(p, 21, 21, 36, 33, SAIL, 2, 0.45);
    sail(p, 44, 13, 56, 23, SAIL, 3, 0.5);
    sail(p, 45, 25, 55, 34, SAIL, 4, 0.4);
    masts(p, 0, false);
    hull(p, HULL, 0);
    p.outline(INK);
    lantern(p, 74, 24, true, f); lantern(p, 11, 32, true, f ^ 1); lantern(p, 50, 19, true, f);
    // cold light on the stern windows
    for (const x of [64, 68, 72]) p.rect(x, 32, 2, 2, f ? '#9ad4ff' : '#76b8f0');
    mist(p, f, 1);
    return p.toCanvas();
  }
  function wreck() {
    const p = new G.Pix(80, 64);
    sail(p, 21, 8, 37, 17, RAG, 5, 0.9);
    sail(p, 22, 21, 36, 30, RAG, 6, 0.8);
    masts(p, 3, true);
    hull(p, WRECK, 3);
    p.outline(INK);
    lantern(p, 74, 27, false, 0); lantern(p, 11, 31, false, 0);
    // weed and barnacles along the keel, rocks at the bow and stern
    p.each((x, y, c) => (y >= 46 && y <= 52 && hash(x, y, 9) < 0.25 && c !== INK ? '#2e4a2c' : undefined));
    for (const [cx, cy, rx, ry] of [[10, 54, 9, 5], [70, 55, 10, 5], [40, 57, 6, 3]]) {
      p.shadeEllipse(cx, cy, rx, ry, ['#2a2a2e', '#3c3c42', '#55555c', '#707078']);
    }
    return p.toCanvas();
  }
  /** 岬の灯: the old stone beacon on the Nerei cape Marina lights every night. 16×32, 2 frames (the flame). */
  function beacon(f) {
    const p = new G.Pix(16, 32);
    const ST = ['#3a3834', '#56524a', '#747064', '#928c7e', '#b0a898'];
    // tapering stone column (y 13..31), lit from the left
    for (let y = 13; y <= 31; y++) {
      const half = 3 + Math.floor((y - 13) / 6);
      for (let x = 8 - half; x <= 7 + half; x++) {
        const edge = x === 8 - half ? 3 : x === 7 + half ? 1 : x >= 7 + half - 1 ? 1 : 2;
        const course = (y - 13) % 4 === 3;
        const joint = !course && ((Math.floor((y - 13) / 4) & 1) ? x === 6 : x === 9);
        p.set(x, y, course || joint ? ST[0 + (edge === 3 ? 1 : 0)] : ST[edge + (hash(x, y, 11) > 0.8 ? 1 : 0)]);
      }
    }
    // moss at the foot, a plinth
    for (let x = 1; x <= 14; x++) { p.set(x, 31, ST[1]); if (hash(x, 30, 12) < 0.5) p.set(x, 30, '#4e6a3a'); }
    // the lantern cage (y 4..12): cap, posts, glass with the flame
    p.poly([[4, 4], [8, 1], [11, 4]], '#2c2a30');
    p.hline(3, 12, 4, '#44404a');
    p.hline(4, 11, 12, '#44404a'); p.hline(3, 12, 13, '#2c2a30');
    p.rect(5, 5, 6, 7, f ? '#ffcf6a' : '#ffbe52');
    p.rect(6, 6, 4, 5, f ? '#fff2b8' : '#ffe08a');
    p.set(7, 7, '#ffffff'); p.set(8, 8, f ? '#ffffff' : '#fff6d0');
    p.vline(4, 5, 11, '#2c2a30'); p.vline(11, 5, 11, '#2c2a30'); p.vline(7, 5, 11, '#6a5e4a');
    p.outline(INK);
    // warm halo around the glass (translucent, outside the outline)
    for (let y = 1; y <= 16; y++) for (let x = 0; x < 16; x++) {
      if (p.get(x, y)) continue;
      const d = (x - 7.5) * (x - 7.5) + (y - 8) * (y - 8) * 1.3;
      if (d < 30) p.set(x, y, f ? '#ffd27a70' : '#ffc85a58');
      else if (d < 52 && ((x + y + f) & 1)) p.set(x, y, '#ffc86a30');
    }
    return p.toCanvas();
  }

  const two = (f0, f1) => ({ down: [f0, f1], up: [f0, f1], left: [f0, f1], right: [f0, f1] });
  G.def('obj:r5_beacon', () => two(beacon(0), beacon(1)));
  G.def('obj:r5_ghost_ship', () => two(ghost(0), ghost(1)));
  G.def('obj:r5_ghost_wreck', () => { const w = wreck(); return two(w, w); });
  // the Regnas merchant ship at Coral after the clear: the same build as Glen's ship, but sound and
  // bright — warm oak, full cream sails with a red band, gold trim, a red-gold pennant. 80×64, bow left.
  const OAK = ['#3a2416', '#58361e', '#7a4c2a', '#9a6436', '#c08a4c'];
  const CANVAS = ['#b89c78', '#d8c29c', '#eee0c0', '#fff6e2'];
  function regnas(f) {
    const p = new G.Pix(80, 64);
    const pen = f ? [[29, 0], [39, 2], [33, 3], [29, 4]] : [[29, 0], [38, 1], [34, 3], [29, 4]];
    p.poly(pen, '#c83a2a');
    p.hline(30, 33, 2, '#f0c040');
    sail(p, 19, 7, 37, 19, CANVAS, 1, 0);
    sail(p, 20, 21, 36, 33, CANVAS, 2, 0);
    sail(p, 43, 12, 57, 23, CANVAS, 3, 0);
    sail(p, 44, 25, 56, 34, CANVAS, 4, 0);
    // the red band of the Regnas houses across the lower sails
    p.each((x, y, c) => (CANVAS.includes(c) && ((y >= 27 && y <= 29 && x >= 20 && x <= 36) || (y >= 29 && y <= 31 && x >= 44 && x <= 56)) ? (c === CANVAS[0] ? '#8a2a20' : '#c8402e') : undefined));
    masts(p, 0, false);
    hull(p, OAK, 0);
    // gold trim along the gunwale and a painted stripe
    for (let x = 10; x <= 60; x++) p.set(x, 38, '#e0b040');
    for (let x = 62; x <= 76; x++) p.set(x, 30, '#e0b040');
    p.outline(INK);
    // warm lamplight in the stern windows, the bow lantern lit
    for (const x of [64, 68, 72]) p.rect(x, 32, 2, 2, f ? '#ffe08a' : '#ffd070');
    // a little wake at the waterline
    for (let x = 6; x < 76; x++) if (hash(x + f * 5, 53, 13) < 0.35 && !p.get(x, 53)) p.set(x, 53, '#e8f4ff90');
    return p.toCanvas();
  }
  G.def('obj:r5_regnas_ship', () => two(regnas(0), regnas(1)));
})(window.RPG);
