// Field objects ('obj:*') and 8x8 menu icons ('icon:*'), owner art-chars A13
// (DESIGN §3.1.2, §11.2.12, §11.3.6).
//   obj:chest       [closed, open] 16x16 (wood + iron straps; every tier chest)
//   obj:chest_rare  [closed, open] 16x16 (navy + gold + red gem; p_rare chests only)
//   obj:ship        {down,up,left,right} x [f0,f1], 32x32 (waterline ≈ y27; kept, unused)
//   obj:sparkle     4 frames 16x16
//   obj:crest_glow  4 frames 16x16 (crest floating over a pedestal)
//   obj:shadow      14x5 soft ellipse
//   obj:glimmer     2 frames 16x16 (閃きの電球)
//   obj:quill       16x16 (語り部の羽ペン)
//   obj:lantern     2 frames 16x24 (休息の灯; also answers .down/.up/.left/.right)
//   obj:page        4 frames 16x16 (glowing chronicle page)
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const A = (R.Art = R.Art || {});
  const OUT = '#1c1420'; // same ink as the figures' outline `k` (DESIGN §11.3.1)

  /** grid → canvas with an automatic dark outline (4-neighbour) */
  function sprite(w, h, rows, pal, opts) {
    const o = opts || {};
    const p = G().pix(w, h);
    p.grid(o.x || 0, o.y || 0, rows, pal);
    if (o.outline !== false) p.outline(o.outlineColor || OUT);
    return p;
  }

  // ------------------------------------------------------------ chests
  // obj:chest (DESIGN §11.2.12): a wooden chest with iron straps and a brass
  // lock, colours toned down for the RS1 field (every tier chest). obj:chest_rare
  // (§11.0 0.19, p_rare chests only): navy lacquer, gold edges and studs, a red
  // gem on the lid; open, the inside glows gold. Both [closed, open], 16x16.
  const CHEST_PAL = {
    A: '#4c2a1c', B: '#7c4a2c', C: '#a4683c', D: '#c4905c',
    X: '#2c2a34', Y: '#6c6a78', Z: '#a8a8b4',
    G: '#8a5c1c', H: '#c89838', I: '#f0d880', k: '#1c1018', a: '#2a1410', w: '#fff8d8',
  };
  const CHEST_CLOSED = [
    '...AYBBBBBBYA...',
    '..ADZCDCCCCZBA..',
    '..ACYCCCCCCYBA..',
    '..ABYBBBBBBYAA..',
    '..XXXXXGHXXXXX..',
    '..ACYCGIIHCYBA..',
    '..ADYCGkkHCYBA..',
    '..ABYBBGHBBYAA..',
    '..ACYCCCCCCYBA..',
    '..ABYBBBBBBYAA..',
    '..AAYAAAAAAYAA..',
    '..XXXXXXXXXXXX..',
  ];
  const CHEST_OPEN = [
    '...AYBBBBBBYA...',
    '..AaYAAAAAAYaA..',
    '..AAYAAAAAAYAA..',
    '..XXXXXXXXXXXX..',
    '..XZZZZZZZZZZX..',
    '..AkkkkkkkkkkA..',
    '..AkaaaaaaaakA..',
    '..ACYCCGHCCYBA..',
    '..ADYCCCCCCYBA..',
    '..ABYBBBBBBYAA..',
    '..AAYAAAAAAYAA..',
    '..XXXXXXXXXXXX..',
  ];
  R.Gfx.def('obj:chest', () => [
    sprite(16, 16, CHEST_CLOSED, CHEST_PAL, { y: 3 }).toCanvas(),
    sprite(16, 16, CHEST_OPEN, CHEST_PAL, { y: 3 }).toCanvas(),
  ]);
  const RARE_PAL = {
    A: '#10163a', B: '#1e2a66', C: '#304294', D: '#4c64bc',
    G: '#8a5410', H: '#dca030', I: '#fce684', g: '#5c3408',
    o: '#c01c38', O: '#ff8ca0', k: '#0c0818', a: '#0a0c24', y: '#ffd860', Y: '#fff4c0', W: '#ffffff',
  };
  const RARE_CLOSED = [
    '...GHHHHHHHHG...',
    '..GIDCCCCCCBIG..',
    '..HCDCCOoCCCBH..',
    '..HBBBBooBBBAH..',
    '..GHHHHIIHHHHG..',
    '..HCCCGIIgCCBH..',
    '..HDCCGkkgCCBH..',
    '..HBBBBGgBBBAH..',
    '..HCCCCCCCCCBH..',
    '..HBBBBBBBBBAH..',
    '..IAAAAAAAAAAI..',
    '..GGGGGGGGGGGG..',
  ];
  const RARE_OPEN = [
    '...GHHHHHHHHG...',
    '..GHaAAAAAAaHG..',
    '..HAAAAooAAAAH..',
    '..GHHHHHHHHHHG..',
    '..GIIIIIIIIIIG..',
    '..HyYYYWWYYYyH..',
    '..HgyyYYYYyygH..',
    '..HCCCGIIgCCBH..',
    '..HDCCCCCCCCBH..',
    '..HBBBBBBBBBAH..',
    '..IAAAAAAAAAAI..',
    '..GGGGGGGGGGGG..',
  ];
  R.Gfx.def('obj:chest_rare', () => {
    const shut = sprite(16, 16, RARE_CLOSED, RARE_PAL, { y: 3 });
    const open = sprite(16, 16, RARE_OPEN, RARE_PAL, { y: 3 });
    // gold light from inside: the lid's underside catches it, a few motes rise above (after the outline)
    for (let y = 4; y <= 5; y++) for (let x = 3; x <= 12; x++) {
      const c = open.get(x, y);
      if (c === RARE_PAL.A || c === RARE_PAL.a) open.set(x, y, G().mix(c, '#e0a830', y === 5 ? 0.45 : 0.25));
    }
    for (const [x, y, c] of [[6, 1, '#fff4c0c0'], [9, 0, '#fff4c090'], [8, 2, '#ffffffe0'], [4, 2, '#ffd86080'], [11, 1, '#ffd860a0']]) if (!open.get(x, y)) open.set(x, y, c);
    return [shut.toCanvas(), open.toCanvas()];
  });

  // ------------------------------------------------------------ ship
  const WOOD = ['#3c2014', '#6a3c20', '#96602e', '#c08c4c'];
  const SAIL = ['#b8b0a0', '#e0dac8', '#f8f4e8', '#ffffff'];
  const CREST = ['#1c3c8c', '#3c6cd0', '#f0c030'];
  const FOAM = '#f4fcff', FOAM2 = '#a8dcf8';

  function shipSide(f) {
    const p = G().pix(32, 32);
    // mast & yard
    p.vline(15, 2, 20, WOOD[1]); p.vline(16, 3, 20, WOOD[0]);
    p.hline(7, 24, 5, WOOD[1]); p.hline(8, 23, 4, WOOD[2]);
    // sail (billows forward: right edge bulges on frame 1)
    const bul = f ? 1 : 0;
    for (let y = 6; y <= 17; y++) {
      const t = (y - 6) / 11;
      const bulge = Math.round(Math.sin(t * Math.PI) * (2 + bul));
      const x0 = 8 + Math.round(Math.sin(t * Math.PI) * 1), x1 = 22 + bulge;
      for (let x = x0; x <= x1; x++) {
        const k = (x - x0) / Math.max(1, x1 - x0);
        p.set(x, y, k > 0.82 ? SAIL[0] : k > 0.55 ? SAIL[1] : k < 0.12 ? SAIL[3] : SAIL[2]);
      }
    }
    p.hline(8, 22 + bul, 17, SAIL[0]);
    // crest on the sail
    p.circle(15, 11, 3, CREST[1]); p.circle(15, 11, 2, CREST[0]);
    p.set(15, 9, CREST[2]); p.set(15, 10, CREST[2]); p.set(14, 11, CREST[2]); p.set(16, 11, CREST[2]); p.set(15, 11, CREST[2]); p.set(15, 12, CREST[2]);
    // pennant
    const fl = f ? [[14, 2], [13, 2], [12, 3], [11, 3]] : [[14, 2], [13, 2], [12, 2], [11, 3]];
    for (const [x, y] of fl) { p.set(x, y, '#d83838'); p.set(x, y + 1, '#982020'); }
    // hull
    p.poly([[2, 16], [7, 19], [25, 19], [31, 14], [29, 22], [25, 27], [8, 27], [4, 22]], WOOD[2]);
    for (let y = 19; y <= 27; y++) for (let x = 0; x < 32; x++) {
      if (!p.get(x, y)) continue;
      if (y >= 25) p.set(x, y, WOOD[0]);
      else if (y === 23 || y === 21) p.set(x, y, WOOD[1]);
    }
    p.hline(5, 26, 20, '#e0a830');
    p.hline(3, 6, 17, WOOD[3]); p.hline(26, 29, 16, WOOD[3]);
    // cabin windows
    p.set(7, 22, '#ffe070'); p.set(10, 22, '#ffe070'); p.set(13, 22, '#ffe070');
    // rail posts
    for (let x = 6; x <= 25; x += 3) p.set(x, 18, WOOD[1]);
    p.outline(OUT);
    // bow wave & wake
    const fo = f ? 1 : 0;
    p.hline(26 - fo, 31, 28, FOAM); p.hline(28, 31, 27, FOAM2);
    p.hline(1 + fo, 8 + fo, 28, FOAM); p.hline(0, 3, 29, FOAM2);
    p.hline(12 + fo * 2, 15 + fo * 2, 29, FOAM2);
    return p.toCanvas();
  }
  function shipFront(f, stern) {
    const p = G().pix(32, 32);
    // mast top & yard above the sail
    p.vline(15, 1, 5, WOOD[1]); p.vline(16, 1, 5, WOOD[0]);
    p.hline(5, 26, 4, WOOD[2]); p.hline(5, 26, 5, WOOD[1]);
    // sail seen face-on
    const bul = f ? 1 : 0;
    for (let y = 6; y <= 17 + bul; y++) {
      const t = (y - 6) / 11;
      const inset = y > 15 ? Math.round((y - 15) * 1.5) : 0;
      for (let x = 6 + inset; x <= 25 - inset; x++) {
        const k = (x - 6) / 19;
        let c = k < 0.15 ? SAIL[3] : k > 0.8 ? SAIL[0] : SAIL[2];
        if (!stern && Math.abs(t - 0.5) < 0.1 && k > 0.2 && k < 0.8) c = SAIL[1];
        if (stern) c = k < 0.15 ? SAIL[2] : k > 0.8 ? SAIL[0] : SAIL[1];
        p.set(x, y, c);
      }
    }
    if (!stern) {
      p.circle(15.5, 11, 3, CREST[1]); p.circle(15.5, 11, 2, CREST[0]);
      p.rect(15, 9, 2, 5, CREST[2]); p.rect(14, 11, 4, 1, CREST[2]);
    } else {
      p.vline(15, 6, 17, WOOD[1]); p.vline(16, 6, 17, WOOD[0]);
    }
    // pennant
    p.set(14, 1, '#d83838'); p.set(13, 1 + (f ? 1 : 0), '#d83838'); p.set(12, 1 + (f ? 1 : 0), '#982020');
    // hull
    if (!stern) {
      p.poly([[7, 17], [25, 17], [23, 24], [16, 30], [9, 24]], WOOD[2]);
      for (let y = 17; y <= 30; y++) for (let x = 0; x < 32; x++) {
        if (!p.get(x, y) || y < 18) continue;
        if (x >= 17) p.set(x, y, WOOD[1]);
        if (y >= 26) p.set(x, y, WOOD[0]);
      }
      p.hline(8, 24, 18, '#e0a830');
      p.vline(16, 19, 28, WOOD[0]);
    } else {
      p.poly([[7, 16], [25, 16], [25, 25], [21, 28], [11, 28], [7, 25]], WOOD[2]);
      for (let y = 16; y <= 28; y++) for (let x = 0; x < 32; x++) {
        if (!p.get(x, y) || y < 17) continue;
        if (x >= 20) p.set(x, y, WOOD[1]);
        if (y >= 25) p.set(x, y, WOOD[0]);
      }
      p.hline(8, 24, 17, '#e0a830');
      p.rect(10, 20, 3, 2, '#ffe070'); p.rect(15, 20, 3, 2, '#ffe070'); p.rect(20, 20, 3, 2, '#ffe070');
      p.hline(8, 24, 23, WOOD[1]);
    }
    p.outline(OUT);
    // water foam
    const fo = f ? 1 : 0;
    if (!stern) { p.hline(12 - fo, 20 + fo, 30, FOAM); p.set(11 - fo, 29, FOAM2); p.set(21 + fo, 29, FOAM2); }
    else { p.hline(9 + fo, 23 - fo, 29, FOAM); p.hline(11, 21, 30, FOAM2); }
    return p.toCanvas();
  }
  R.Gfx.def('obj:ship', () => {
    const right = [shipSide(0), shipSide(1)];
    return {
      down: [shipFront(0, false), shipFront(1, false)],
      up: [shipFront(0, true), shipFront(1, true)],
      right,
      left: right.map((c) => G().flipH(c)),
    };
  });

  // ------------------------------------------------------------ sparkle
  const SPARK = [
    ['........', '........', '........', '...w....', '........', '........', '........', '........'],
    ['........', '...y....', '...w....', '.ywWwy..', '...w....', '...y....', '........', '........'],
    ['...y....', '.y.w.y..', '..wWw...', 'ywWWWwy.', '..wWw...', '.y.w.y..', '...y....', '........'],
    ['........', '...y....', '..y.y...', '.y.W.y..', '..y.y...', '...y....', '........', '........'],
  ];
  R.Gfx.def('obj:sparkle', () => SPARK.map((g) => {
    const p = G().pix(16, 16);
    p.grid(4, 4, g, { w: '#fff6c0', W: '#ffffff', y: '#ffd040' });
    return p.toCanvas();
  }));

  // ------------------------------------------------------------ crest on a pedestal
  const PEDESTAL = [
    '....zzzzzzzz....',
    '...zYYZZZZYYz...',
    '....XYYZZYYX....',
    '.....XYZZYX.....',
    '.....XYZZYX.....',
    '....XXYZZYXX....',
    '...XYYYZZYYYX...',
  ];
  const CREST_G = [
    '...hH...',
    '..hHHg..',
    '.hHWHHg.',
    'hHWWHHgG',
    'gHHHHHGG',
    '.gHHHGG.',
    '..gHGG..',
    '...gG...',
  ];
  R.Gfx.def('obj:crest_glow', () => {
    const out = [];
    for (let f = 0; f < 4; f++) {
      const p = G().pix(16, 16);
      const lift = [0, -1, -1, 0][f];
      // glow halo
      const a = ['30', '48', '60', '48'][f];
      const r = [5.5, 6, 6.5, 6][f];
      for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - (6 + lift));
        if (d < r) p.set(x, y, '#fff0a0' + (d < r - 2 ? a : '20'));
      }
      p.grid(0, 9, PEDESTAL, { z: '#e8e4f0', Z: '#c8c4d4', Y: '#9894a8', X: '#646078' });
      const cp = G().pix(16, 16);
      cp.grid(4, 2 + lift, CREST_G, { h: '#fff8d0', H: '#f8d048', W: '#ffffff', g: '#c88c18', G: '#8c5a10' });
      cp.outline('#5a3808');
      p.blit(cp, 0, 0);
      // rays
      if (f === 2) { p.set(7, 0, '#ffffff'); p.set(2, 6 + lift, '#fff8c0'); p.set(13, 6 + lift, '#fff8c0'); }
      if (f === 1 || f === 3) { p.set(1, 3, '#fff8c080'); p.set(14, 7, '#fff8c080'); }
      out.push(p.toCanvas());
    }
    return out;
  });

  // ------------------------------------------------------------ shadow
  R.Gfx.def('obj:shadow', () => {
    const p = G().pix(14, 5);
    p.ellipse(6.5, 2, 6.5, 2, '#00000038');
    p.ellipse(6.5, 2, 4.5, 1.2, '#00000050');
    return p.toCanvas();
  });

  // ------------------------------------------------------------ glimmer bulb (閃き)
  // obj:glimmer 16x16 x2 (DESIGN §11.2.12, §11.5.7): a round yellow bulb with a white
  // highlight on a grey screw base; frame 0 has 4 short rays, frame 1 has 8 and is brighter.
  R.Gfx.def('obj:glimmer', () => [0, 1].map((f) => {
    const p = G().pix(16, 16);
    const Y = f ? ['#c89818', '#ffe45a', '#fff4a0', '#ffffff'] : ['#b88410', '#f0d040', '#ffe45a', '#fff8d0'];
    p.shadeEllipse(8, 6.5, 3.6, 3.6, Y, { light: [-0.7, -0.7] });
    p.set(6, 4, '#ffffff'); p.set(7, 4, '#ffffff'); p.set(6, 5, '#ffffff');
    p.hline(6, 10, 10, '#d8d8e0'); p.set(10, 10, '#9898a8');
    p.hline(6, 10, 11, '#8c8c9c'); p.hline(6, 10, 12, '#c8c8d4'); p.set(10, 12, '#8c8c9c');
    p.hline(7, 9, 13, '#6c6c7c');
    p.set(8, 14, '#4c4c5c');
    p.set(7, 9, Y[0]); p.set(9, 9, Y[0]); p.set(8, 9, Y[1]);
    p.outline(OUT);
    const ray = f ? '#fff8c0' : '#ffe890';
    const R4 = [[[1, 6], [2, 6]], [[14, 6], [13, 6]], [[3, 1], [4, 2]], [[13, 1], [12, 2]]];
    const R8 = R4.concat([[[8, 0], [8, 0]], [[1, 11], [2, 10]], [[14, 11], [13, 10]], [[5, 0], [5, 0]]]);
    for (const seg of (f ? R8 : R4)) for (const [x, y] of seg) p.set(x, y, ray);
    if (f) { p.set(11, 0, ray); p.set(0, 6, '#fff8c080'); p.set(15, 6, '#fff8c080'); }
    return p.toCanvas();
  }));

  // ------------------------------------------------------------ the storyteller's quill
  // obj:quill 16x16 (§11.2.12, §11.6.6): a white feather pen lying on the diagonal,
  // tip to the lower left, a gold nib.
  R.Gfx.def('obj:quill', () => {
    const p = G().pix(16, 16);
    const W = '#ffffff', w = '#e0e4ee', e = '#a8aec4', sh = '#c0c4d4';
    // shaft on the diagonal (13,1) → (4,10); vanes grow to the upper left (wide) and
    // lower right (narrow), with two barb notches on the wide side
    for (let k = 0; k <= 9; k++) {
      const x = 13 - k, y = 1 + k;
      const wl = [1, 2, 3, 2, 3, 3, 2, 3, 2, 1][k], wr = [0, 1, 1, 2, 2, 1, 2, 1, 1, 0][k];
      for (let i = 1; i <= wl; i++) p.set(x - i, y, i === wl ? w : W);
      for (let i = 1; i <= wr; i++) p.set(x + i, y, i === wr ? e : w);
      p.set(x, y, sh);
    }
    p.set(14, 0, W); p.set(13, 0, w);
    // bare quill and the gold nib
    p.set(3, 11, sh); p.set(3, 12, '#9a9eb4');
    p.set(2, 12, '#e0a830'); p.set(2, 13, '#fce07c'); p.set(1, 13, '#e0a830'); p.set(1, 14, '#9a6414');
    p.outline(OUT);
    return p.toCanvas();
  });

  // ------------------------------------------------------------ rest lantern (休息の灯)
  // obj:lantern 16x24 x2 (§11.2.12, §11.6.4): a square iron lantern with a white
  // flame on a short stone pillar; the flame and its glow sway between the frames.
  // The value is an array [f0, f1] that also answers .down/.up/.left/.right (NPC form).
  R.Gfx.def('obj:lantern', () => {
    const frames = [0, 1].map((f) => {
      const p = G().pix(16, 24);
      const S = ['#4c4a5c', '#747486', '#9c9cae', '#c4c4d0'];
      // pillar: capital, shaft of two courses, base
      p.rect(4, 12, 8, 2, S[2]); p.hline(4, 11, 12, S[3]); p.set(11, 13, S[1]);
      p.rect(5, 14, 6, 7, S[1]); p.vline(5, 14, 20, S[2]); p.vline(10, 14, 20, S[0]);
      p.hline(5, 10, 17, S[0]); p.set(7, 15, S[0]); p.set(8, 19, S[0]);
      p.rect(3, 21, 10, 2, S[1]); p.hline(3, 12, 21, S[2]); p.hline(3, 12, 22, S[0]);
      // lantern: iron frame, roof, glass with the flame
      const K = ['#241c28', '#403848', '#6a6070'];
      p.hline(6, 9, 1, K[2]); p.hline(5, 10, 2, K[1]); p.hline(4, 11, 3, K[1]); p.set(4, 3, K[2]); p.set(7, 0, K[2]);
      p.rect(4, 4, 8, 7, K[0]);
      // warm glass, brighter towards the flame
      for (let y = 4; y <= 9; y++) for (let x = 5; x <= 10; x++) p.set(x, y, Math.abs(x - 7.5) + Math.abs(y - 7) < 2.5 ? '#ffe9a0' : '#f0b850');
      p.set(5, 4, '#c88830'); p.set(10, 4, '#c88830'); p.set(5, 9, '#c88830'); p.set(10, 9, '#c88830');
      p.hline(4, 11, 10, K[1]); p.hline(5, 10, 11, K[0]);
      // white flame (swaying tip)
      const fl = f ? [[8, 4], [8, 5], [7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8]] : [[7, 4], [7, 5], [7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8]];
      for (const [x, y] of fl) p.set(x, y, '#fffae0');
      for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) p.set(x, y, '#ffffff');
      p.set(f ? 9 : 6, 7, '#fff0b0');
      p.outline(OUT);
      // soft light around the glass
      const glow = f ? '#fff4c048' : '#ffe8a038';
      for (let y = 2; y <= 12; y++) for (let x = 1; x <= 14; x++) {
        if (p.get(x, y)) continue;
        const d = Math.hypot(x - 7.5, y - 7);
        if (d < (f ? 6.8 : 6.2)) p.set(x, y, glow);
      }
      return p.toCanvas();
    });
    frames.down = frames.up = frames.left = frames.right = frames;
    return frames;
  });

  // ------------------------------------------------------------ chronicle page
  // obj:page 16x16 x4 (§11.6.6): a glowing page rising from a lore core — the
  // parchment bobs, the glow pulses and a mote circles it.
  R.Gfx.def('obj:page', () => [0, 1, 2, 3].map((f) => {
    const p = G().pix(16, 16);
    const lift = [0, -1, -1, 0][f];
    const PG = ['#b8a070', '#e8d8a8', '#f8f0d0', '#fffcf0'];
    const y0 = 3 + lift;
    // page with a curled corner
    p.rect(4, y0, 8, 10, PG[2]);
    p.vline(4, y0, y0 + 9, PG[3]); p.hline(4, 10, y0, PG[3]);
    p.vline(11, y0 + 1, y0 + 9, PG[1]); p.hline(5, 11, y0 + 9, PG[1]);
    p.set(11, y0, null); p.set(10, y0, PG[1]); p.set(11, y0 + 1, PG[0]);
    // lines of text
    for (let k = 0; k < 4; k++) p.hline(6, k === 3 ? 8 : 10 - (k % 2), y0 + 2 + k * 2, '#8a7a5c');
    p.outline('#6a5030');
    // glow
    const a = ['30', '48', '60', '48'][f];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (p.get(x, y)) continue;
      const d = Math.hypot(x - 7.5, y - (7.5 + lift));
      if (d < 7.5 && d > 4.5) p.set(x, y, '#fff4c0' + (d < 6 ? a : '20'));
    }
    const mote = [[2, 3], [13, 5], [12, 13], [3, 12]][f];
    p.set(mote[0], mote[1], '#ffffff');
    return p.toCanvas();
  }));

  // ------------------------------------------------------------ icons (8x8)
  const IP = {
    k: '#1c1420', W: '#ffffff', w: '#d8e0ec', X: '#98a4b8', x: '#5c6478',
    G: '#fce07c', H: '#e0a830', g: '#a06818',
    L: '#c08c4c', M: '#8a5a30', N: '#5a3620',
    r: '#e04040', R: '#901c28', b: '#58a0f0', B: '#2c58c0', v: '#b070e0', V: '#6a38a8',
    e: '#70d860', E: '#2c9040', s: '#f0f0f8', p: '#f0a0c8',
  };
  const ICONS = {
    sword: [
      '......wW',
      '.....wWx',
      '....wWx.',
      '.H.wWx..',
      '..HWx...',
      '..MHH...',
      '.MN..H..',
      'NN......',
    ],
    knife: [
      '........',
      '.....wW.',
      '....wWx.',
      '...wWx..',
      '..HWx...',
      '..MH....',
      '.MN.....',
      '.N......',
    ],
    axe: [
      '.wWWx...',
      'wWXXxM..',
      'wXxx.M..',
      '.x...M..',
      '......M.',
      '......M.',
      '.......N',
      '.......N',
    ],
    spear: [
      '......wW',
      '.....wWx',
      '.....Wx.',
      '....M...',
      '...M....',
      '..M.....',
      '.M......',
      'N.......',
    ],
    staff: [
      '....HGH.',
      '...HbBH.',
      '...gHHg.',
      '....M...',
      '...M....',
      '...M....',
      '..M.....',
      '..N.....',
    ],
    rod: [
      '.....G..',
      '....GrG.',
      '.....G..',
      '....H...',
      '...V....',
      '..V.....',
      '.V......',
      'V.......',
    ],
    bow: [
      '..MLs...',
      '.M..s...',
      'M...s...',
      'M...Ws..',
      'M...s...',
      'M...s...',
      '.M..s...',
      '..MLs...',
    ],
    claw: [
      '.W.W.W..',
      '.w.w.w..',
      '.x.x.x..',
      '.xXxXx..',
      '.MMMMM..',
      '..MLM...',
      '..MLM...',
      '...N....',
    ],
    katana: [
      '.......W',
      '......Ww',
      '.....Ww.',
      '....Ww..',
      '...Ww...',
      '.gHx....',
      '.kk.....',
      'kk......',
    ],
    harp: [
      'H......H',
      'HGGGGGGH',
      '.Hs.s.H.',
      '.Hs.s.H.',
      '.Hs.s.H.',
      '..HGGH..',
      '...gg...',
      '........',
    ],
    shield: [
      '.xXXXXx.',
      'xXBbbBXx',
      'XBbGGbBX',
      'XBGGGGBX',
      'XBbGGbBX',
      '.XBbbBX.',
      '..XBBX..',
      '...XX...',
    ],
    helm: [
      '...HH...',
      '..wWWx..',
      '.wWWWXx.',
      '.wWXXXx.',
      '.XXXXXx.',
      '.XkkkkX.',
      '.Xx..xX.',
      '.xx..xx.',
    ],
    hat: [
      '....V...',
      '...Vv...',
      '...Vvv..',
      '..VvvvV.',
      '..HGGHH.',
      'VVvvvvVV',
      '.VVVVVV.',
      '........',
    ],
    heavy: [
      '.xX..Xx.',
      'xWXXXXXx',
      'XWWXXXXx',
      '.XWXXXx.',
      '.XWXXXx.',
      '.XXHHXx.',
      '.XxXXxx.',
      '..x..x..',
    ],
    light: [
      '.M....M.',
      'MLM..MLM',
      'MLLMMLLM',
      '.MLLLLM.',
      '.MLLLLM.',
      '.MHHHHM.',
      '.MLLLLM.',
      '.NNNNNN.',
    ],
    robe: [
      '.V.GG.V.',
      'VvVGGVvV',
      'VvvGGvvV',
      '.VvGGvV.',
      '.VvGGvV.',
      '.VvvvvvV',
      'VvvvvvvV',
      'VVVVVVVV',
    ],
    acc: [
      '...rR...',
      '..HrrH..',
      '.H.RR.H.',
      'H......H',
      'G......H',
      '.G....H.',
      '..GHHg..',
      '........',
    ],
    herb: [
      '....e...',
      '...eEe..',
      '.e.eE.e.',
      'eEe.EeEe',
      '.eEeE.E.',
      '...EE...',
      '....M...',
      '....M...',
    ],
    potion: [
      '...MM...',
      '...ss...',
      '..s..s..',
      '.sbbbbs.',
      's.bBbBbs',
      'sbBbbbBs',
      'sbbBBbbs',
      '.ssssss.',
    ],
    key: [
      '.GHH....',
      'G..H....',
      'G..H....',
      '.HHg....',
      '...H....',
      '...HH...',
      '...H....',
      '...HHg..',
    ],
    feather: [
      '......Ww',
      '....WWwX',
      '...WWwX.',
      '..WwwX..',
      '..wwX...',
      '.wXX....',
      '.M......',
      'M.......',
    ],
    rope: [
      '..LLLL..',
      '.L.MM.L.',
      'L.M..M.L',
      'L.M.LM.L',
      'L..MM..L',
      '.L....L.',
      '..LLLL.L',
      '.......M',
    ],
    bomb: [
      '......G.',
      '.....H.r',
      '...xxM..',
      '..xXxxx.',
      '.xXxxxxx',
      '.xxxxxxx',
      '.xxxxxxk',
      '..xxxxk.',
    ],
    powder: [
      '..M..M..',
      '...MM...',
      '..LLLL..',
      '.LLLLLL.',
      'LLLGLLLL',
      'LLLLLLLL',
      '.LLLLLL.',
      '..MMMM..',
    ],
    seed: [
      '....E...',
      '...E....',
      '..LLL...',
      '.LLLLL..',
      '.LMLLL..',
      '.LLLML..',
      '..LLL...',
      '........',
    ],
    drop: [
      '....b...',
      '....b...',
      '...bbb..',
      '..bsbbb.',
      '..bsbbb.',
      '..bbbBb.',
      '...bbb..',
      '........',
    ],
    bell: [
      '...GG...',
      '..GHHG..',
      '..GHHG..',
      '.GHHHHG.',
      '.GHHHHG.',
      'GHHHHHHG',
      'gggggggg',
      '...gg...',
    ],
    flute: [
      '.......L',
      '......LM',
      '.....LM.',
      '....LM..',
      '...kM...',
      '..LM....',
      '.kM.....',
      'LM......',
    ],
  };
  // ---- Chronicle additions (DESIGN §11.3.6): the new weapon families, the armour
  // slots and the six elements (magic stones, spell book). dagger/head/body reuse
  // knife/helm/light as the spec says.
  Object.assign(ICONS, {
    // the broad two-edged blade of §11.3.6 (3px wide, so it never reads as icon:sword)
    greatsword: [
      '.....xwW',
      '....xwWw',
      '...xwWx.',
      '..xwWx..',
      '.HxWx...',
      '..HH....',
      '.MNH....',
      'NN......',
    ],
    club: [
      '.....MLL',
      '....MLGL',
      '...MLLM.',
      '..MLM...',
      '.MLM....',
      '.NM.....',
      'NN......',
      'N.......',
    ],
    fist: [
      '........',
      '.LLLL...',
      'LNLNLL..',
      'LwLwLLM.',
      'LLLLLLM.',
      '.LLLLM..',
      '.HHHH...',
      '........',
    ],
    whip: [
      '.LLL....',
      'L...L...',
      'L....L..',
      '.L...L..',
      '..L.L...',
      '...MN...',
      '...NN...',
      '....N...',
    ],
    hands: [
      '..L.L...',
      '.LMLML..',
      '.LLLLL.L',
      '.LLLLLLM',
      '.LLLLLM.',
      '..LLLM..',
      '..HHHH..',
      '..MMMM..',
    ],
    feet: [
      '..LM....',
      '..LM....',
      '..LM....',
      '..LLM...',
      '..LLLLM.',
      '.LLLLLLM',
      '.NNNNNNN',
      '........',
    ],
    el_fire: [
      '...r....',
      '..rr....',
      '..rrr.r.',
      '.rrGrrr.',
      '.rGGGr..',
      'rrGGGrr.',
      '.rrGrr..',
      '..rrr...',
    ],
    el_water: [
      '...b....',
      '...b....',
      '..bbb...',
      '.bbWbb..',
      '.bWbbb..',
      '.bbbbB..',
      '..bBB...',
      '........',
    ],
    el_wind: [
      '..eeee..',
      '.e....e.',
      '.e.ee.e.',
      '.e.e..e.',
      '.e..ee..',
      '..e.....',
      '...eeeE.',
      '........',
    ],
    el_earth: [
      '........',
      '...L....',
      '..LLM...',
      '..LGLM..',
      '.LLLLMM.',
      '.LLLMMM.',
      'LMMMMMMN',
      '........',
    ],
    el_light: [
      '...G....',
      '.G.G.G..',
      '..GGG...',
      'GGGWGGG.',
      '..GGG...',
      '.G.G.G..',
      '...G....',
      '........',
    ],
    el_dark: [
      '..vvv...',
      '.vv.....',
      'vv......',
      'vv......',
      'vv......',
      '.vv...V.',
      '..vvvV..',
      '........',
    ],
  });
  ICONS.dagger = ICONS.knife;
  ICONS.head = ICONS.helm;
  ICONS.body = ICONS.light;
  A.ICON_IDS = Object.keys(ICONS);
  for (const k in ICONS) R.Gfx.def('icon:' + k, () => R.Gfx.fromGrid(ICONS[k], IP));
})(window.RPG);
