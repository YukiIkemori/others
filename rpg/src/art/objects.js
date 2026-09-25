// Field objects ('obj:*') and 8x8 menu icons ('icon:*', DESIGN §4).
//   obj:chest       [closed, open] 16x16
//   obj:ship        {down,up,left,right} x [f0,f1], 32x32 (waterline ≈ y27)
//   obj:sparkle     4 frames 16x16 (hidden-item twinkle)
//   obj:crest_glow  4 frames 16x16 (crest floating over a pedestal)
//   obj:shadow      14x5 soft ellipse
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const OUT = '#170f1f';

  /** grid → canvas with an automatic dark outline (4-neighbour) */
  function sprite(w, h, rows, pal, opts) {
    const o = opts || {};
    const p = G().pix(w, h);
    p.grid(o.x || 0, o.y || 0, rows, pal);
    if (o.outline !== false) p.outline(o.outlineColor || OUT);
    return p;
  }

  // ------------------------------------------------------------ chest
  const CHEST_PAL = {
    A: '#6c1818', B: '#b0302a', C: '#e05a44', D: '#f08a6c',
    G: '#9a6414', H: '#dca030', I: '#fce07c', k: '#1c1018', a: '#40181c', w: '#fff8d8',
  };
  const CHEST_CLOSED = [
    '....HIIIIIIH....',
    '...HCDDCGIDCCH..',
    '..HBCCCBGHBCCBH.',
    '..HBCCBBGHBBCBH.',
    '..HABBBBGHBBBAH.',
    '..GHHHHHHIHHHHG.',
    '..HABBGIIHGBBAH.',
    '..HBCCGkkaGCCBH.',
    '..HBCBBHkHBBCBH.',
    '..HBCBBGHGBBCBH.',
    '..HABBBBGBBBBAH.',
    '..GGGGGGGGGGGGG.',
  ];
  // open: the lid is tipped back (its dark underside shows above the box), the
  // box is an empty dark hole with the rim lit, and the lock plate is gone
  const CHEST_OPEN = [
    '...GHHHHHHHHG...',
    '..GaAAAAAAAAaG..',
    '..HaABBBBBBAaH..',
    '..GaAAAAAAAAaG..',
    '..GHHHHHHHHHHHG.',
    '..HkkkkkkkkkkkH.',
    '..HkkaaaaaaakkH.',
    '..GHHHHHHHHHHHG.',
    '..HBCCBBBBBCCBH.',
    '..HBCBBBBBBBCBH.',
    '..HABBBBBBBBBAH.',
    '..GGGGGGGGGGGGG.',
  ];
  R.Gfx.def('obj:chest', () => [
    sprite(16, 16, CHEST_CLOSED, CHEST_PAL, { y: 3, x: -1 }).toCanvas(),
    sprite(16, 16, CHEST_OPEN, CHEST_PAL, { y: 3, x: -1 }).toCanvas(),
  ]);

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
  for (const k in ICONS) R.Gfx.def('icon:' + k, () => R.Gfx.fromGrid(ICONS[k], IP));
})(window.RPG);
