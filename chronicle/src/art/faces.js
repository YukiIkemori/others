// Minimal face icons (DESIGN §3.1.2, §11.3.5 — P3, optional): 'face:<spriteId>'
// is a 32x32 bust made from the character's own field sprite: the top 16 rows of
// the down-facing frame 0, enlarged with Scale2x (EPX) so outlines stay crisp but
// diagonals are smoothed. Transparent background (drawn on the window's fill).
// Registered for the 30 party sprites and the fixed story characters.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});

  /** Scale2x of a w×h colour array (null = transparent) → 2w×2h array */
  function scale2x(src, w, h) {
    const out = new Array(4 * w * h).fill(null), W2 = 2 * w;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : src[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (c === a && c !== d && a !== b) e0 = a;
      if (a === b && a !== c && b !== d) e1 = b;
      if (d === c && d !== b && c !== a) e2 = c;
      if (b === d && b !== a && d !== c) e3 = d;
      out[2 * y * W2 + 2 * x] = e0; out[2 * y * W2 + 2 * x + 1] = e1;
      out[(2 * y + 1) * W2 + 2 * x] = e2; out[(2 * y + 1) * W2 + 2 * x + 1] = e3;
    }
    return out;
  }
  CA.scale2x = scale2x;

  /** 32x32 bust from a 16x24 frame buffer: 16 rows from just above the head top */
  function bust(buf) {
    let top = 0;
    while (top < 8 && !buf.slice(top * 16, top * 16 + 16).some(Boolean)) top++;
    top = Math.max(0, Math.min(8, top - 1));
    const crop = buf.slice(top * 16, (top + 16) * 16);
    const big = scale2x(crop, 16, 16);
    const p = R.Gfx.pix(32, 32);
    for (let i = 0; i < big.length; i++) p.d[i] = big[i];
    return p.toCanvas();
  }
  CA.bust = bust;

  CA.FACE_IDS = [];
  for (const id of CA.PARTY_IDS || []) {
    CA.FACE_IDS.push(id);
    R.Gfx.def('face:' + id, () => {
      const who = CA.parts.party[id];
      return who ? bust(CA.figure(CA.partySpec(who), CA.partyPalette(who), 'down', 0)) : R.Gfx.placeholder(32, 32);
    });
  }
  for (const t of ['berna', 'rowell', 'fine', 'lazaro']) {
    CA.FACE_IDS.push(t);
    R.Gfx.def('face:' + t, () => {
      const n = CA.npcs[t];
      if (!n || !n.spec) return R.Gfx.placeholder(32, 32);
      const pal = CA.palette(Object.assign({ acc2: '#44405c', acc: '#d83c5c' }, n.pal));
      return bust(CA.figure(n.spec(), pal, 'down', 0));
    });
  }
})(window.RPG);
