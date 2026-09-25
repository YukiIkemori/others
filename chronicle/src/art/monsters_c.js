// Monster battle sprites, part C (DESIGN §9.4.2): the 14 new base sprites
// 'mon:<id>' of Chronicle, drawn the same way as the Crest bases in
// monsters_a.js / monsters_b.js: every sprite is a small 2.5-D scene
// (ellipsoids, tapered capsules, spline tubes and bevelled polygons in a
// z-buffer with real normals, R.Art.MonScene from monsters_b.js), lit from the
// top-left and quantised into hue-shifted ramps (shadows lean violet, lights
// lean yellow). Where two parts meet, the part behind gets a dark inner line
// leaning to INK #1c1420; faces, teeth and glints are stamped by hand; a 1-px
// outline #120c16 closes the silhouette. The feet stand on row H-2 (outline on
// H-1); floating bases (fairy, book, crystal) hover a few px above it.
//
// Every base is readable when the lineage table recolours it (§9.4.6: hue
// turns, sat 0..1.4, bri 0.4..1.3): forms read by value, not by hue, the
// outline and INK stay below luminance 0.09, and near-white / near-grey
// accents (eyes, teeth, claws, frills) keep their colour under hue turns.
//
// Registry: R.Gfx.def('mon:<id>') for the 14 ids, and
//   R.Art.monstersC = { ids, sizes, anchors }
// `anchors[id]` gives the part anchors of §9.4.3 in sprite pixels (x right,
// y down, both inside the canvas) for R.Art.MON_ANCHORS (A14a):
//   head  [x,y]  top of the skull at its centre (a crown/hat's brim sits here)
//   brow  [x,y]  forehead between the eyes (horns, a third eye)
//   eyes  [[x,y],...] eye centres, left of the picture first
//   mouth [x,y]  centre of the mouth     neck [x,y] throat / collar
//   back  [x,y]  between the shoulders (wings, capes are drawn behind it)
//   body  [x,y]  centre of the torso     tail [x,y] tail / rear end
//   hand  [x,y]  weapon hand (picture left)   hand2 [x,y] off hand (picture right)
//   feet  [x,y]  ground point under the sprite (row H-2)
//   plus headW (head width in px) and float (true = hovers above the ground).
// Factories run lazily through R.Gfx.get and are cached; the toolkit is looked
// up inside them (monsters_b.js may load in any order relative to this file).
(function (R) {
  'use strict';
  const OUT = '#120c16'; // outer outline (§9.4.2; near-neutral so palette variants keep it)
  const INK = '#1c1420'; // inner lines, pupils, mouths
  const WHITE = '#f8f8f4';
  const TS = () => R.Art.MonScene;

  // ------------------------------------------------------------ helpers
  /** material whose inner contour leans toward INK (the Crest B look, §9.4.2 line colour) */
  function M(base, o) {
    const T = TS();
    o = Object.assign({}, o);
    const m = T.mat(base || o.ramp[Math.floor(o.ramp.length / 2)], o);
    if (!o.line) m.line = T.mix(T.darken(m.r[0], 0.5), INK, 0.45);
    return m;
  }
  /** remove lone outline pixels that stick out (smoother silhouettes) */
  function shave(p) {
    const src = p.d.slice(), w = p.w, h = p.h;
    const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y) !== OUT) continue;
      let k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) != null) k++;
      if (k <= 1) p.d[y * w + x] = null;
    }
    return p;
  }
  /**
   * Close the sprite: outline + shave, then o.post(p) paints un-outlined extras
   * (sparkles, light streaks), then o.sheer(x,y) marks translucent pixels that
   * are thinned to a checker (see-through wings, §11.4.2: opaque pixels only).
   */
  function finish(p, o) {
    o = o || {};
    p.outline(OUT); shave(p);
    if (o.post) o.post(p);
    if (o.sheer) p.each((x, y, c) => (c != null && c !== OUT && o.sheer(x, y) && ((x + y) & 1) ? null : undefined));
    return p.toCanvas();
  }
  /** set a pixel only where the sprite already has one (details that must not grow the silhouette) */
  const over = (p, x, y, c) => { if (p.get(x, y) != null) p.set(x, y, c); };
  /** stamp a small grid; '.' transparent */
  const stamp2 = (p, x, y, rows, pal) => { p.grid(x, y, rows, pal); return p; };
  /** move every pixel of p by (dx, dy) in place (fine placement after drawing) */
  function shift(p, dx, dy) {
    const q = R.Gfx.pix(p.w, p.h);
    q.blit(p, dx, dy);
    p.d = q.d;
    return p;
  }
  /** darken existing pixels along a polyline (colour-preserving creases) */
  function crease(p, pts, k) {
    const T = TS();
    for (let s = 1; s < pts.length; s++) {
      const [x0, y0] = pts[s - 1], [x1, y1] = pts[s];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n), c = p.get(x, y);
        if (c && c !== OUT) p.set(x, y, T.darken(c, k));
      }
    }
    return p;
  }

  const S = {}, SIZES = {}, ANCHORS = {};

  // ================================================================ small (32)

  // Beetle: a horned shell beetle seen from the front and a little above: the
  // domed wing cases split by a seam with a bright band of gloss on each, the
  // shiny shield of the thorax in front, the low head with two small black
  // eyes, and one thick horn that sweeps up and forward from the head to a
  // forked tip; three short legs a side.
  SIZES.beetle = 32;
  ANCHORS.beetle = { head: [15, 22], brow: [15, 23], eyes: [[10, 24], [21, 24]], mouth: [15, 28], neck: [15, 21], back: [15, 9], body: [15, 14], hand: [3, 24], hand2: [28, 24], tail: [15, 4], feet: [15, 30], headW: 12 };
  S.beetle = () => {
    const T = TS(), W = 32, H = 32;
    const shell = M(null, { ramp: ['#2e1a1e', '#4a3028', '#6a5040', '#8c6a48', '#b08858', '#ecd4a0'], rim: 1, contrast: 0.8, bias: 0.04 });
    const pron = M(null, { ramp: ['#2a1618', '#42282a', '#5e4436', '#80603e', '#a88050', '#e4c690'], rim: 1, contrast: 0.9, bias: 0.05, spec: 0.9 });
    const headM = M(null, { ramp: ['#3a2420', '#5a3c2e', '#7c5a40', '#9c7650', '#c8a070'], bias: 0.12 });
    const horn = M(null, { ramp: ['#1a1010', '#302018', '#504030', '#6e5640', '#98805e', '#d8c49c'], spec: 0.88, contrast: 1.1 });
    const LEG = ['#141010', '#302820', '#54483a', '#786a58'];
    const sc = new T.Scene(W, H);
    // domed wing cases (the seam down the middle, a gloss band on each)
    sc.ell(15.5, 12.6, 11.4, 9.4, { m: shell, g: 'shell', rz: 10 });
    // the thorax shield in front of them, then the low head
    sc.ell(15.5, 20.8, 8.6, 4.6, { m: pron, g: 'pron', z: 6, rz: 5 });
    sc.ell(15.5, 25.3, 6.8, 3.2, { m: headM, g: 'head', z: 10, rz: 3 });
    // the great horn: thick at the root on the head, rising and bending toward
    // the viewer (so it narrows fast), forked at the tip
    sc.tube([[15.5, 26.6, 1.9, 13], [15.5, 22.4, 2, 15], [15.5, 17.4, 1.7, 17], [15.5, 13.8, 1.3, 18]], { m: horn, g: 'horn' });
    T.sym(W, (X) => sc.tube([[15.5, 13.8, 1.3, 18], [X(13.9), 11.4, 1, 18], [X(12.8), 9.2, 0.55, 18]], { m: horn, g: 'horn' }));
    // mandible stubs under the head
    T.sym(W, (X) => sc.tube([[X(13), 27.4, 0.9, 11], [X(13.8), 28.8, 0.45, 11]], { m: horn, g: 'mand' + X(0) }));
    // gloss bands, dimples, the rim of the shield
    T.sym(W, (X) => {
      sc.carve([[X(11), 4.6], [X(8.8), 7.4], [X(7.6), 11], [X(7.8), 14.4]], 2);
      sc.carve([[X(12.2), 5], [X(10), 7.8], [X(9), 11]], 1);
      for (const [x, y] of [[12.6, 12.4], [11.8, 15], [12.2, 17.6]]) sc.mark(X(x), y, -1);
    });
    sc.carve([[9.2, 18.6], [21.8, 18.6]], 1);
    const body = sc.render();
    // legs, drawn crisp (2 px: lit upper edge, dark lower edge): hind legs
    // behind the shell, middle and fore legs in front of it
    const p = R.Gfx.pix(W, H);
    const leg = (pts, lit) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        p.line(x0, y0 + 1, x1, y1 + 1, LEG[0]);
        p.line(x0, y0, x1, y1, i === 1 ? LEG[lit] : LEG[lit - 1]);
      }
    };
    T.sym(W, (X) => leg([[X(7), 15], [X(3), 13], [X(1), 18], [X(1), 24]], X(0) ? 2 : 3));
    p.blit(body, 0, 0);
    T.sym(W, (X) => {
      leg([[X(8), 21], [X(3), 22], [X(2), 27], [X(3), 29]], X(0) ? 2 : 3);
      leg([[X(11), 26], [X(8), 27], [X(7), 28], [X(8), 29]], X(0) ? 2 : 3);
    });
    // claw tips
    T.sym(W, (X) => { p.set(X(1), 25, LEG[2]); p.set(X(4), 30, LEG[1]); p.set(X(9), 30, LEG[1]); });
    // the seam between the wing cases, above the forked horn tip
    for (let y = 4; y <= 9; y++) over(p, 15, y, INK);
    for (let y = 4; y <= 8; y++) over(p, 16, y, shell.r[4]);
    // small black eyes with a glint, set in the corners of the head
    T.stampM(p, 10, 24, ['kk', 'kw'], { k: INK, w: '#f0e0c0' });
    T.sym(W, (X) => { over(p, X(9), 24, headM.r[3]); over(p, X(9), 25, headM.r[2]); over(p, X(10), 26, headM.r[1]); over(p, X(11), 26, headM.r[1]); });
    return finish(p);
  };

  // Fairy: a palm-sized sprite floating on four see-through butterfly wings,
  // a big head of fluffy hair, a leaf dress, bare toes together, one hand at
  // her mouth as she giggles; light motes on the wing rims.
  SIZES.fairy = 32;
  ANCHORS.fairy = { head: [15, 5], brow: [15, 9], eyes: [[13, 11], [18, 11]], mouth: [15, 14], neck: [15, 16], back: [15, 18], body: [15, 20], hand: [11, 21], hand2: [19, 14], tail: [15, 23], feet: [15, 29], headW: 13, float: true };
  S.fairy = () => {
    const T = TS(), W = 32, H = 32;
    const wing = M(null, { ramp: ['#6a98c8', '#98d0f0', '#c0f0ff', '#e0fcff', '#ffffff'], flat: true, bias: 0.12, contrast: 0.55 });
    const hair = M(null, { ramp: ['#a46428', '#d49a36', '#f0d060', '#f8ec9c', '#fffae0'], rim: 1 });
    const skin = M(null, { ramp: ['#c47a6a', '#e8b09a', '#f8d8c0', '#fff2e6'], bias: 0.14, contrast: 0.7 });
    const leaf = M(null, { ramp: ['#1e5030', '#3a8038', '#70c050', '#a8e070', '#e0f8b0'], rim: 1 });
    const sc = new T.Scene(W, H);
    // wings: upper pair large, lower pair small, fanned out behind the back
    const up = [[14, 15], [10, 9.5], [5.5, 4], [2, 3.5], [0.8, 7], [1.6, 11.5], [5, 14.8], [10, 16.5], [13.5, 17]];
    const lo = [[14, 17.5], [9, 17.2], [4.5, 18.8], [3, 22], [4.6, 24.8], [8, 24.6], [11.5, 22], [14, 19.5]];
    T.sym(W, (X, s) => {
      sc.poly(up.map(([x, y]) => [X(x), y]), { m: wing, g: 'wu' + s, z: -8, bevel: 1.5 });
      sc.poly(lo.map(([x, y]) => [X(x), y]), { m: wing, g: 'wl' + s, z: -9, bevel: 1.5 });
    });
    // bare legs: knees apart a little, toes together pointing down
    T.sym(W, (X, s) => sc.tube([[X(13.8), 23, 1.1, 1], [X(13.2), 25.4, 0.95, 2], [X(14.4), 27.8, 0.7, 3]], { m: skin, g: 'leg' + s }));
    // leaf dress: bodice + a skirt of pointed leaves
    sc.ell(15.5, 19.6, 3.2, 3, { m: leaf, g: 'dress', z: 3, rz: 3 });
    for (const [x0, x1, y1] of [[13, 10.8, 24.2], [15.5, 15.5, 25.2], [18, 20.2, 24.2], [14.2, 12.8, 24.8], [16.8, 18.2, 24.8]])
      sc.tube([[x0, 21, 1.8, 4], [x1, y1, 0.3, 4]], { m: leaf, g: 'dress' });
    // arms: left hangs at the waist, right raised to the mouth
    sc.tube([[12.6, 17.2, 1, 5], [11.2, 19.2, 0.95, 6], [11, 20.6, 0.9, 7]], { m: skin, g: 'armL' });
    sc.tube([[18.6, 17.2, 1, 6], [19.6, 15.8, 0.95, 9], [18.8, 14.2, 1, 13]], { m: skin, g: 'armR' });
    // fluffy hair behind the head, the head, the fringe
    sc.ell(15.5, 9.4, 7.4, 6.2, { m: hair, g: 'hairB', z: -2, rz: 5 });
    T.sym(W, (X) => {
      sc.ell(X(8.8), 12.4, 2.4, 3, { m: hair, g: 'hairB', z: -1, rz: 2 });
      sc.ell(X(9.8), 5, 2.6, 2.4, { m: hair, g: 'hairB', z: -1, rz: 2 });
    });
    sc.ell(15.5, 11, 5.3, 4.7, { m: skin, g: 'face', z: 4, rz: 4 });
    sc.ell(15.5, 6.4, 5.8, 2, { m: hair, g: 'fringe', z: 8, rz: 2.5 });
    for (const [x0, x1] of [[11, 10.6], [13.6, 13.2], [17.4, 17.8], [20, 20.4]]) sc.tube([[x0, 6.8, 1.3, 9], [x1, 8.4, 0.4, 9]], { m: hair, g: 'fringe' });
    sc.ell(15.5, 4.2, 2.6, 1.5, { m: hair, g: 'fringe', z: 7, rz: 2 });
    // the hand at her mouth (nearest)
    sc.ell(18.8, 13.3, 1.4, 1.2, { m: skin, g: 'handR', z: 14, rz: 1.2 });
    const p = sc.render();
    // wing veins: from the wing roots out to the rims
    const VN = '#6a98c8';
    T.sym(W, (X) => {
      for (const [a, b, c, d] of [[13, 15, 4, 5], [13, 16, 2, 10], [12, 16, 6, 15], [13, 18, 5, 21], [13, 19, 8, 24]]) p.line(X(a), b, X(c), d, VN);
      for (const [x, y] of [[3, 5], [2, 9], [4, 22]]) p.set(X(x), y, '#ffffff');
    });
    // happy closed eyes (giggling), rosy cheeks, the smile beside the hand
    T.stampM(p, 12, 10, ['.k.', 'k.k'], { k: INK });
    p.set(12, 12, '#f09090'); p.set(13, 12, '#f8b0a8'); p.set(19, 12, '#f09090'); p.set(18, 12, '#f8b0a8');
    p.set(15, 13, INK); p.set(16, 13, INK); p.set(16, 14, '#d86070');
    shift(p, 0, 1); // hover one px lower: head room for a flower or a tiara (§9.4.3)
    // see-through membrane: interior pixels of the wings (not the rim, veins or motes)
    const WR = new Set([wing.r[0], wing.r[1], wing.r[2], wing.r[3], wing.r[4]]);
    const isW = (x, y) => WR.has(p.get(x, y));
    const sheerSet = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (isW(x, y) && isW(x - 1, y) && isW(x + 1, y) && isW(x, y - 1) && isW(x, y + 1)) sheerSet.add(y * W + x);
    return finish(p, {
      sheer: (x, y) => sheerSet.has(y * W + x),
      post: (q) => {
        // light motes floating off the wing rims
        for (const [x, y] of [[1, 1], [30, 13], [1, 26]]) {
          q.set(x, y, '#ffffff');
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (q.get(x + dx, y + dy) == null) q.set(x + dx, y + dy, '#b8ecff');
        }
      },
    });
  };

  // Book: a thick leather-bound tome floating half open; its covers are the
  // jaws, white page-teeth line the gap, the two round clasps on the cover
  // glow like eyes and the bookmark ribbon lolls out like a tongue.
  SIZES.book = 32;
  ANCHORS.book = { head: [15, 3], brow: [15, 6], eyes: [[10, 7], [21, 7]], mouth: [15, 16], neck: [15, 12], back: [15, 5], body: [15, 15], hand: [2, 15], hand2: [29, 15], tail: [15, 23], feet: [15, 28], headW: 22, float: true };
  S.book = () => {
    const T = TS(), W = 32, H = 32;
    const leather = M(null, { ramp: ['#3a1a18', '#5c2c22', '#804830', '#9c6040', '#b87850', '#dca878'], rim: 1 });
    const gold = M(null, { ramp: ['#6a4818', '#a07828', '#e0c060', '#f4e098', '#fffbe0'], spec: 0.9 });
    const page = M(null, { ramp: ['#a89878', '#d0c4a4', '#f0e8d0', '#fcf8ec'], flat: true });
    const ribbon = M(null, { ramp: ['#601420', '#90202a', '#c03030', '#e86050'] });
    const sc = new T.Scene(W, H);
    // lower cover (its front edge shows under the lower page block)
    sc.poly([[3, 20], [28, 20], [28.5, 23], [27, 24.5], [4, 24.5], [2.5, 23]], { m: leather, g: 'lower', z: 2, bevel: 1.5 });
    // page blocks, upper and lower, and the dark gullet between them
    sc.poly([[4.5, 11], [26.5, 11], [26.5, 15], [4.5, 15]], { m: page, g: 'pageU', z: 4, n: [0, 0.3, 1] });
    sc.poly([[4.5, 17.5], [26.5, 17.5], [26.5, 21.5], [4.5, 21.5]], { m: page, g: 'pageL', z: 5, n: [0, -0.2, 1] });
    // upper cover lifted like a jaw: outer face toward the viewer
    sc.poly([[5, 2.5], [26, 2.5], [29, 10], [29.5, 12], [1.5, 12], [2, 10]], { m: leather, g: 'upper', z: 9, bevel: 2.2, bz: 2.5 });
    // round clasps (the eyes) and the corner fittings
    T.sym(W, (X, s) => {
      sc.ell(X(10), 7, 2.6, 2.4, { m: gold, g: 'clasp' + s, z: 13, rz: 2 });
      sc.poly([[X(1.5), 12], [X(5.5), 12], [X(2), 8.5]].map(([x, y]) => [x, y]), { m: gold, g: 'corner' + s, z: 12, bevel: 1 });
    });
    // brow boss between the eyes
    sc.poly([[15.5, 4], [17.5, 6.5], [15.5, 9], [13.5, 6.5]], { m: gold, g: 'brow', z: 12, bevel: 1 });
    // embossed frame on the cover
    sc.carve([[6, 4], [25, 4]], 1).carve([[3.5, 10.5], [27.5, 10.5]], -1);
    T.sym(W, (X) => sc.carve([[X(6), 4], [X(3.8), 10]], 1));
    // the ribbon tongue, lolling out of the right of the gap
    sc.tube([[18, 16.5, 1.3, 14], [19.5, 20, 1.3, 14], [18.6, 24.5, 1.2, 14], [19.6, 27.6, 1.2, 14]], { m: ribbon, g: 'ribbon' });
    const p = sc.render();
    // the gullet and the page-teeth
    for (let x = 5; x <= 26; x++) { p.set(x, 15, '#2a0810'); p.set(x, 16, '#4a0e1a'); p.set(x, 17, '#2a0810'); }
    for (let x = 5; x <= 25; x += 3) { p.set(x, 15, WHITE); p.set(x + 1, 15, '#d8d0bc'); p.set(x, 16, '#e8e2d2'); }
    for (let x = 6; x <= 26; x += 3) { p.set(x, 17, WHITE); p.set(x - 1, 17, '#d8d0bc'); }
    // page lines on the fore-edges
    for (const y of [12, 13.9, 19, 20.6]) for (let x = 5; x <= 26; x++) if ((x + Math.round(y)) % 4) over(p, x, Math.round(y), '#c8b898');
    // the ribbon over the teeth, forked end
    p.set(19, 28, null); p.set(20, 29, ribbon.r[1]); p.set(18, 29, ribbon.r[1]);
    // glowing clasp-eyes: bright core and a dark slit
    T.stampM(p, 9, 6, ['ww.', 'wyk', '.yk'], { w: '#fffbe0', y: '#f8e070', k: '#5a2a10' });
    // scuffs on the old leather
    for (const [x, y] of [[7, 5], [24, 9], [13, 10], [26, 22], [6, 23]]) over(p, x, y, leather.r[1]);
    // motes of magic drifting around the tome (un-outlined)
    return finish(p, { post: (q) => {
      for (const [x, y] of [[1, 5], [30, 14], [3, 27]]) q.set(x, y, '#fff4c0');
    } });
  };

  // Crystal: a floating cluster of hexagonal quartz (one big prism, two small
  // ones joined at the root); a round core glows inside the big one like an
  // eye; two thin beams of light run down from the root.
  SIZES.crystal = 32;
  ANCHORS.crystal = { head: [15, 3], brow: [15, 11], eyes: [[15, 15]], mouth: [15, 19], neck: [15, 9], back: [15, 13], body: [15, 16], hand: [5, 15], hand2: [26, 16], tail: [15, 25], feet: [15, 28], headW: 10, float: true };
  S.crystal = () => {
    const W = 32, H = 32, TK = R.Art.MonTK;
    const C = ['#2a4070', '#4670a4', '#6090b0', '#80c0e0', '#a0e0f0', '#c8f0f8', '#f0ffff'];
    const LINE = '#34507e';
    /** a hexagonal prism seen from the front, drawn into its own layer: axis from base b
     *  to tip t, half width w, tip length k, tone = index of the front face colour */
    const prism = (bx, by, tx, ty, w, k, tone) => {
      const q = R.Gfx.pix(W, H);
      const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      const at = (s, f) => [bx + ux * s + nx * f, by + uy * s + ny * f]; // s along the axis, f across (−w..w)
      const s1 = L - k, e = 0.3;
      const cl = (i) => C[Math.max(0, Math.min(6, i))];
      const faces = [
        { pts: [at(0, -w), at(s1, -w), at(s1, -w * e), at(0, -w * e)], hi: tone + 2, lo: tone + 1 },   // left (lit)
        { pts: [at(0, -w * e), at(s1, -w * e), at(s1, w * e), at(0, w * e)], hi: tone, lo: tone - 1 },   // front
        { pts: [at(0, w * e), at(s1, w * e), at(s1, w), at(0, w)], hi: tone - 2, lo: tone - 3 },         // right
        { pts: [at(s1, -w), at(L, 0), at(s1, -w * e)], hi: tone + 2, lo: tone + 2 },                      // tip facets
        { pts: [at(s1, -w * e), at(L, 0), at(s1, w * e)], hi: tone + 1, lo: tone + 1 },
        { pts: [at(s1, w * e), at(L, 0), at(s1, w)], hi: tone - 1, lo: tone - 1 },
      ];
      for (const f of faces) {
        const m = R.Gfx.pix(W, H); m.poly(f.pts, 1);
        // the lower part of each face a step darker, a lit sliver on the upper edge
        m.each((x, y) => { const sAx = (x - bx) * ux + (y - by) * uy; q.set(x, y, cl(sAx < s1 * 0.4 ? f.lo : f.hi)); });
      }
      // facet edges: pale on the lit ridge, darker on the shadow ridge, the rim of the tip
      const ln = (a, b, c) => q.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), c);
      ln(at(1, -w * e), at(s1, -w * e), cl(tone + 3));
      ln(at(1, w * e), at(s1, w * e), cl(tone - 3));
      ln(at(s1, -w), at(L - 0.6, 0), C[6]);
      ln(at(s1, w * e), at(L - 0.6, 0), cl(tone));
      return q;
    };
    const p = R.Gfx.pix(W, H);
    // root: a knot of dull crystal where the three prisms meet
    const root = R.Gfx.pix(W, H); root.ellipse(15.5, 24.2, 7.6, 2.5, 1);
    root.each((x, y) => p.set(x, y, y < 24 ? C[2] : y < 25 ? C[1] : C[0]));
    TK.put(p, prism(10.8, 25, 3.2, 10.5, 2.8, 3.6, 3), LINE);   // small left
    TK.put(p, prism(20.4, 25, 27.6, 12.8, 2.5, 3.4, 3), LINE);  // small right
    TK.put(p, prism(15.5, 26.2, 15.5, 1.6, 5.6, 6.4, 4), LINE); // the big one
    // the core: a glowing orb inside the big prism, like an eye
    const core = R.Gfx.pix(W, H); core.ellipse(15.5, 15.5, 3.5, 3.5, 1);
    core.each((x, y) => { const d = Math.hypot(x - 15.5, y - 15.5); p.set(x, y, d < 2 ? '#ffffff' : d < 3 ? '#e4fbff' : C[5]); });
    p.vline(15, 14, 17, '#2a4070'); p.vline(16, 14, 17, '#4670a4');
    p.set(14, 13, '#ffffff'); p.set(13, 14, '#ffffff');
    // internal glints
    p.line(12, 8, 13, 6, '#ffffff'); p.set(18, 21, C[6]); p.set(19, 20, C[5]);
    return finish(p, { post: (q) => {
      // two thin beams of light running down from the root
      for (const [x, y, c] of [[12, 27, '#f0ffff'], [12, 28, '#a0e0f0'], [12, 30, '#80c0e0'], [19, 27, '#f0ffff'], [19, 29, '#a0e0f0'], [19, 30, '#80c0e0']]) q.set(x, y, c);
      for (const [x, y] of [[4, 4], [28, 7], [26, 25]]) q.set(x, y, '#ffffff');
    } });
  };

  // ================================================================ medium (48)

  // Frog: a big toad squatting square to the viewer: a wide grin, bulging
  // golden eyes, a pale throat and belly, the fore feet together in front and
  // the hind legs braced out to the sides; warts along the back.
  SIZES.frog = 48;
  ANCHORS.frog = { head: [23, 16], brow: [23, 17], eyes: [[14, 15], [33, 15]], mouth: [23, 28], neck: [23, 31], back: [23, 21], body: [23, 35], hand: [15, 43], hand2: [32, 43], tail: [23, 41], feet: [23, 46], headW: 32 };
  S.frog = () => {
    const T = TS(), W = 48, H = 48;
    const skin = M(null, { ramp: ['#1e4228', '#326c30', '#58a040', '#74bc4c', '#90d060', '#d0f09c'], rim: 1 });
    const belly = M(null, { ramp: ['#8aa070', '#b8cc98', '#e0f0c0', '#f4fae0'], bias: 0.05, contrast: 0.8 });
    const eyeM = M(null, { ramp: ['#8a5a10', '#c08a18', '#f0d040', '#f8ec90', '#fffbe0'], bias: 0.06 });
    const sc = new T.Scene(W, H);
    // hind legs braced out to the sides (behind the body)
    T.sym(W, (X, s) => {
      sc.ell(X(8.5), 36.5, 6.6, 6, { m: skin, g: 'thigh' + s, z: -2, rz: 6 });
      sc.tube([[X(6), 40, 3, 0], [X(4), 43.5, 2.4, 1], [X(5), 45.6, 1.6, 2]], { m: skin, g: 'shin' + s });
      for (const [tx, ty] of [[1, 46.2], [4.2, 46.6], [8.4, 46.4]]) sc.tube([[X(5), 45, 1.2, 3], [X(tx), ty, 0.7, 3]], { m: skin, g: 'toe' + s });
    });
    // squat body and the wide head, one smooth mass
    sc.ell(23.5, 34, 14.2, 11.2, { m: skin, g: 'body', z: 0, rz: 10 });
    sc.ell(23.5, 24.5, 15.2, 8.6, { m: skin, g: 'body', z: 2, rz: 9 });
    // bulging eyes on top of the head
    T.sym(W, (X, s) => {
      sc.ell(X(14), 16.4, 5.4, 5, { m: skin, g: 'body', z: 6, rz: 5 });
      sc.ell(X(14), 15.8, 3.5, 3.4, { m: eyeM, g: 'eye' + s, z: 11, rz: 3 });
    });
    // warts on the crown and the shoulders
    for (const [x, y, r] of [[20, 18.5, 1.1], [27, 18.5, 1.1], [23.5, 17.4, 1], [10, 24, 1.1], [37, 24, 1.1], [12.5, 28.5, 0.9], [34.5, 28.5, 0.9], [9.5, 32, 1], [37.5, 32, 1]])
      sc.ell(x, y, r, r, { m: skin, g: 'body', z: 9, rz: 1.2, k: 1 });
    // pale throat and belly
    sc.ell(23.5, 37, 10.6, 8.4, { m: belly, g: 'belly', z: 9, rz: 5 });
    sc.ell(23.5, 30.6, 11, 3.2, { m: belly, g: 'belly', z: 10, rz: 3 });
    // fore legs down the sides of the belly, splayed fingers with round pads in front
    T.sym(W, (X, s) => {
      sc.tube([[X(13.2), 31, 2.6, 11], [X(13.8), 37.5, 2.2, 13], [X(15.4), 42.6, 1.9, 14]], { m: skin, g: 'arm' + s });
      for (const [tx, ty] of [[11.6, 45.8], [14.6, 46.6], [17.8, 46.4], [19.8, 45.2]]) {
        sc.tube([[X(15.4), 43.4, 1.1, 15], [X(tx), ty, 0.7, 15]], { m: skin, g: 'hand' + s });
        sc.ell(X(tx), ty, 0.9, 0.8, { m: skin, g: 'hand' + s, z: 16, rz: 0.8 });
      }
    });
    // belly creases
    for (const y of [38, 41]) sc.carve([[19, y], [28, y]], -1);
    const p = sc.render();
    // the wide mouth: a long curve with upturned corners
    for (let x = 9; x <= 38; x++) {
      const u = (x - 23.5) / 14.5, y = Math.round(27.2 + 1.8 * (1 - u * u) - (Math.abs(u) > 0.9 ? 1 : 0));
      p.set(x, y, INK);
      if (Math.abs(u) < 0.85) over(p, x, y + 1, skin.r[1]);
    }
    p.set(8, 25, INK); p.set(39, 25, INK);
    // nostrils
    stamp2(p, 21, 22, ['k..k'], { k: INK });
    // horizontal pupils with a glint
    T.stampM(p, 12, 15, ['kkkk', '.kk.'], { k: INK });
    T.stampM(p, 12, 14, ['w'], { w: WHITE });
    // warts: a lit top and a shaded foot on each bump
    for (const [x, y] of [[19, 19], [27, 19], [23, 18], [10, 23], [36, 23], [12, 27], [34, 27], [9, 31], [37, 31], [16, 21], [31, 21]]) {
      over(p, x, y, skin.r[5]); over(p, x, y + 1, skin.r[1]);
    }
    return finish(p);
  };

  // Doll: a porcelain-headed doll in a long frilled dress, standing just off
  // the ground; rosy cheeks, glass eyes, brown ringlets, ball-jointed hands;
  // a hairline crack on her left cheek.
  SIZES.doll = 48;
  ANCHORS.doll = { head: [23, 8], brow: [23, 12], eyes: [[20, 16], [27, 16]], mouth: [23, 20], neck: [23, 23], back: [23, 25], body: [23, 28], hand: [13, 34], hand2: [34, 34], tail: [23, 37], feet: [23, 44], headW: 17, float: true };
  S.doll = () => {
    const T = TS(), W = 48, H = 48;
    const china = M(null, { ramp: ['#a89ca8', '#d0c8cc', '#f4f0ec', '#fffcf8'], bias: 0.1, contrast: 0.75 });
    const hair = M(null, { ramp: ['#4a2418', '#723c24', '#a06040', '#c48458', '#e0b080'], rim: 1 });
    const dress = M(null, { ramp: ['#2e3a80', '#5068b8', '#80a0e0', '#a8c4f0', '#d8e8ff'], rim: 1 });
    const frill = M(null, { ramp: ['#9aa4c4', '#ccd4ea', '#f4f6fc', '#ffffff'], bias: 0.08, contrast: 0.8 });
    const shoe = M(null, { ramp: ['#1c1420', '#3a2a40', '#5a4868', '#8a78a0'] });
    const sc = new T.Scene(W, H);
    // hair mass behind the head and the ringlets down both sides
    sc.ell(23.5, 16.6, 8.4, 7.8, { m: hair, g: 'hairB', z: -4, rz: 6 });
    T.sym(W, (X, s) => {
      [[15, 19, 2.6], [14.4, 22.6, 2.4], [14.2, 26, 2.2], [14.6, 29.2, 1.9]].forEach(([x, y, r], k) =>
        sc.ell(X(x), y, r, r * 0.9, { m: hair, g: 'curl' + s + k, z: -2 + k * 0.3, rz: r, soft: true }));
    });
    // skirt: a bell of periwinkle with two white flounces
    sc.poly([[18, 28], [29, 28], [33, 34], [37.5, 42.5], [31, 44], [23.5, 44.5], [16, 44], [9.5, 42.5], [14, 34]], { m: dress, g: 'skirt', z: 2, bevel: 4, bz: 5 });
    sc.region((x, y) => sc.isG(x, y, 'skirt') && (y >= 42 || (y >= 35 && y <= 36)), frill);
    for (let x = 10; x <= 37; x += 3) sc.mark(x, 43, -1);
    // shoes peeking under the hem
    T.sym(W, (X, s) => sc.ell(X(20.4), 44.6, 2.4, 1.3, { m: shoe, g: 'shoe' + s, z: 0, rz: 1.5 }));
    // bodice, collar frill
    sc.ell(23.5, 27.5, 5.4, 4.4, { m: dress, g: 'bodice', z: 5, rz: 4 });
    sc.ell(23.5, 24.4, 6.4, 2, { m: frill, g: 'collar', z: 9, rz: 2 });
    // arms: puffed sleeves, porcelain forearms with ball joints, hands out a little
    T.sym(W, (X, s) => {
      sc.ell(X(16.4), 26.2, 3.1, 2.9, { m: dress, g: 'puff' + s, z: 8, rz: 3 });
      sc.tube([[X(15.8), 28.4, 1.5, 7], [X(15), 31, 1.4, 7]], { m: dress, g: 'upper' + s });
      sc.ell(X(15), 31.8, 1.7, 1.2, { m: frill, g: 'cuff' + s, z: 9, rz: 1.4 });
      sc.tube([[X(14.8), 32.6, 1.3, 10], [X(13.9), 34.4, 1.25, 10]], { m: china, g: 'fore' + s });
      sc.ell(X(13.5), 35.6, 1.8, 1.7, { m: china, g: 'hand' + s, z: 12, rz: 1.6 });
    });
    // the porcelain head and the fringe
    sc.ell(23.5, 17.6, 6.4, 6.3, { m: china, g: 'face', z: 4, rz: 6 });
    sc.ell(23.5, 11.4, 7.4, 2.6, { m: hair, g: 'fringe', z: 9, rz: 3 });
    T.sym(W, (X) => sc.tube([[X(17), 11.4, 1.6, 9], [X(16.4), 14.6, 0.6, 9]], { m: hair, g: 'fringe' }));
    for (const [x0, x1] of [[20.6, 20.2], [26.4, 26.8]]) sc.tube([[x0, 12, 1.4, 10], [x1, 13.6, 0.5, 10]], { m: hair, g: 'fringe' });
    sc.carve([[23.5, 9.5], [23.5, 12]], -1);
    const p = sc.render();
    // glass eyes: dark lash, blue iris, catch-light
    T.stampM(p, 19, 15, ['kkk', 'wbk', 'bbd', '.d.'], { k: INK, b: '#4a78d0', w: '#e8f4ff', d: '#2a3c80' });
    // round rosy cheeks, a small red mouth
    T.stampM(p, 18, 19, ['cc', 'cc'], { c: '#f0a8a8' });
    stamp2(p, 23, 21, ['rr'], { r: '#c04050' });
    // the hairline crack on her left cheek
    for (const [x, y] of [[28, 16], [29, 17], [28, 18]]) over(p, x, y, '#8a7c88');
    // joints: seams on the ball joints
    T.sym(W, (X) => { over(p, X(14), 31, china.r[0]); over(p, X(13), 35, china.r[1]); });
    shift(p, 0, -1); // she stands just off the ground
    return finish(p);
  };

  // Seabird: a gull perched on a breaking wave crest, wings half spread; white
  // head and breast, grey mantle and wings with black tips, a yellow bill with
  // a red spot, yellow feet, and a heavy-lidded, insolent stare.
  SIZES.seabird = 48;
  ANCHORS.seabird = { head: [22, 7], brow: [22, 10], eyes: [[19, 12], [25, 12]], mouth: [28, 16], neck: [23, 19], back: [23, 21], body: [23, 28], hand: [6, 24], hand2: [41, 24], tail: [23, 36], feet: [23, 46], headW: 12 };
  S.seabird = () => {
    const T = TS(), W = 48, H = 48;
    const white = M(null, { ramp: ['#8a90a8', '#c0c6d4', '#e8ecf0', '#f8f8f4', '#ffffff'], bias: 0.06, contrast: 0.8 });
    const grey = M(null, { ramp: ['#3e4458', '#687088', '#a0a8b8', '#c4cad6', '#e4e8ee'], rim: 1 });
    const tip = M(null, { ramp: ['#141418', '#24242a', '#303038', '#50505c'] });
    const bill = M(null, { ramp: ['#a06a10', '#d09a20', '#f0c030', '#f8e070', '#fff4c0'], bias: 0.05 });
    const leg = M(null, { ramp: ['#a07018', '#d0a028', '#f0c838', '#f8e478'] });
    const sea = M(null, { ramp: ['#103c5c', '#1c6488', '#2c8cb0', '#50b4d0', '#90dcec'] });
    const foam = M(null, { ramp: ['#8ab0c8', '#c0dcec', '#eef8fc', '#ffffff'], bias: 0.1, contrast: 0.7 });
    const sc = new T.Scene(W, H);
    // the wave crest it perches on (bottom of the picture): a swell breaking to the right
    sc.poly([[3.5, 47.5], [5, 45], [10, 42.6], [17, 41], [24, 39.8], [31, 39], [36, 38.6], [40, 39.4], [43, 41.6], [41.2, 43.4], [43.2, 45.6], [44.4, 47.5]], { m: sea, g: 'wave', z: -2, bevel: 4, bz: 5 });
    sc.tube([[15, 41.2, 1, 3], [22, 40, 1.3, 3], [29, 39.2, 1.5, 3], [35, 38.8, 1.6, 3], [39.5, 39.2, 1.6, 4], [42.6, 40.8, 1.4, 4], [43.2, 42.8, 0.9, 4], [41.8, 43.6, 0.5, 4]], { m: foam, g: 'foam' });
    // wings half spread: the arm raised to the wrist, coverts, primaries hanging from the wrist
    T.sym(W, (X, s) => {
      const base = [[5, 17], [6, 19.6], [7.6, 22.2], [9.8, 24.6]], tips = [[0.8, 24.5], [1.4, 29], [3.4, 32.4], [7, 34.4]];
      base.forEach((b0, k) => {
        const t = tips[k], mx = b0[0] + (t[0] - b0[0]) * 0.45, my = b0[1] + (t[1] - b0[1]) * 0.45;
        sc.tube([[X(b0[0]), b0[1], 2, -9 + k], [X(mx), my, 1.9, -9 + k]], { m: grey, g: 'pr' + k + s });
        sc.tube([[X(mx), my, 1.9, -9 + k], [X(t[0]), t[1], 0.6, -9 + k]], { m: tip, g: 'pr' + k + s });
      });
      sc.poly([[X(17.5), 20], [X(6), 15.6], [X(4.6), 18.5], [X(7), 25], [X(11.5), 29.5], [X(17), 31.5]], { m: grey, g: 'wing' + s, z: -3, bevel: 2.5 });
      sc.tube([[X(17.5), 21, 3.2, -1], [X(11), 17.4, 2.6, -1], [X(6), 15.4, 2.1, -1], [X(3.8), 16.8, 1.3, -1]], { m: grey, g: 'wing' + s });
      sc.carve([[X(8), 26.6], [X(12), 29.6], [X(16.5), 31]], 2);
      sc.carve([[X(9), 20.5], [X(15), 22.5]], -1).carve([[X(8.5), 23.5], [X(15.5), 26]], -1);
    });
    // feet gripping the crest
    T.sym(W, (X, s) => {
      sc.tube([[X(20.5), 35, 1.3, 2], [X(20), 39, 1.1, 3]], { m: leg, g: 'leg' + s });
      for (const tx of [17.5, 20, 22.5]) sc.tube([[X(20), 39, 0.9, 4], [X(tx), 40.4, 0.6, 4]], { m: leg, g: 'leg' + s });
    });
    // mantle behind the neck, white breast and belly
    sc.ell(23.5, 21, 8.4, 3.4, { m: grey, g: 'mantle', z: -1, rz: 3 });
    sc.ell(23.5, 28, 8, 9.2, { m: white, g: 'body', z: 2, rz: 8 });
    sc.ell(23.5, 35.5, 5, 2.4, { m: white, g: 'body', z: 1, rz: 2 });
    // head, turned a little to its left
    sc.ell(22.8, 13, 6.2, 5.8, { m: white, g: 'head', z: 6, rz: 6 });
    sc.ell(23.5, 18.4, 4.4, 2.6, { m: white, g: 'head', z: 5, rz: 3 });
    // the bill: yellow, hooked at the tip
    sc.tube([[26.8, 15.2, 1.7, 12], [30, 15.8, 1.4, 12], [32.6, 16.4, 1, 11]], { m: bill, g: 'bill' });
    sc.tube([[32.2, 15.8, 0.8, 11], [33.4, 17.4, 0.5, 11]], { m: bill, g: 'bill' });
    // feather lines: tertials, the white trailing edge
    T.sym(W, (X) => { sc.carve([[X(15), 23], [X(9), 22]], 1); sc.carve([[X(15), 25.5], [X(8), 25]], -1); });
    const p = sc.render();
    // red spot near the bill tip, the gape line
    p.set(31, 17, '#d03020'); p.set(30, 17, '#e05030');
    p.line(27, 16, 31, 16, T.darken(bill.r[0], 0.7));
    // insolent eyes: a heavy grey lid over a pale iris and a small pupil
    for (const ex of [18, 24]) {
      stamp2(p, ex, 11, ['kkkk', 'gyk.'], { k: '#3a3a48', g: '#707888', y: '#f0e070' });
      p.set(ex + 1, 12, INK);
    }
    // white spots ("mirrors") on the black wing tips
    T.sym(W, (X) => { over(p, X(2), 27, WHITE); over(p, X(4), 30, WHITE); });
    // the dark trough line and glints in the swell
    for (const [x0, y0, x1, y1] of [[8, 45, 14, 43], [20, 43, 27, 42], [30, 44, 36, 42], [16, 46, 22, 45]]) p.line(x0, y0, x1, y1, sea.r[4]);
    for (const [x, y] of [[36, 41], [38, 42], [39, 44], [27, 41], [11, 44]]) over(p, x, y, '#eef8fc');
    return finish(p, { post: (q) => {
      // spray off the crest
      for (const [x, y] of [[2, 37], [4, 35], [44, 40], [42, 38]]) q.set(x, y, '#eef8fc');
    } });
  };

  // Mole: a big mole standing on its hind legs: velvet black-brown fur, a
  // long pink nose, eyes almost lost in the fur, huge spade hands with five
  // white claws each, a paler belly.
  SIZES.mole = 48;
  ANCHORS.mole = { head: [23, 11], brow: [23, 15], eyes: [[19, 18], [28, 18]], mouth: [23, 29], neck: [23, 27], back: [23, 24], body: [23, 34], hand: [8, 28], hand2: [39, 28], tail: [23, 44], feet: [23, 46], headW: 18 };
  S.mole = () => {
    const T = TS(), W = 48, H = 48;
    const fur = M(null, { ramp: ['#1c1418', '#2e2222', '#403028', '#5a4436', '#705848', '#9a8070'], rim: 1, tex: T.texFur(0.1, 5) });
    const pale = M(null, { ramp: ['#4a3a32', '#6c5646', '#8e7460', '#b0967e', '#ceb8a0'], tex: T.texFur(0.08, 9) });
    const pink = M(null, { ramp: ['#9a4a5a', '#c86a7c', '#f090a0', '#f8b8c0', '#fff0f0'], bias: 0.05 });
    const palm = M(null, { ramp: ['#7a4a50', '#a8707a', '#d09aa0', '#ecc4c4'] });
    const claw = M(null, { ramp: ['#a89c8c', '#d4ccbc', '#f0e8d8', '#ffffff'], bias: 0.1 });
    const sc = new T.Scene(W, H);
    // hind feet
    T.sym(W, (X, s) => {
      sc.ell(X(17.5), 44.6, 4.2, 2.2, { m: palm, g: 'foot' + s, z: 4, rz: 2 });
      for (const tx of [14, 16.4, 18.8]) sc.tube([[X(tx + 0.6), 45, 0.8, 6], [X(tx), 46.6, 0.5, 6]], { m: claw, g: 'toe' + s + tx });
    });
    // pear body with a pale belly, round head, one mass
    sc.ell(23.5, 33.5, 11.8, 11.4, { m: fur, g: 'body', z: 0, rz: 10 });
    sc.ell(23.5, 20, 9.4, 8.6, { m: fur, g: 'body', z: 2, rz: 8 });
    sc.ell(23.5, 36, 7, 7.6, { m: pale, g: 'belly', z: 8, rz: 5, soft: true });
    // short arms out to the big spade hands, held up at the sides
    T.sym(W, (X, s) => {
      sc.tube([[X(15), 28, 3.4, 4], [X(11), 29, 3, 6]], { m: fur, g: 'arm' + s });
      sc.ell(X(8.6), 28.6, 5, 6.4, { m: palm, g: 'hand' + s, z: 8, rz: 3 });
      // five white claws fanned along the top of each hand
      [[4.2, 24.5, 2.4, 19.6], [6, 22.8, 5.2, 17.6], [8.4, 22.2, 8.4, 16.8], [10.8, 22.8, 11.6, 17.8], [12.6, 24.6, 14.4, 20.4]].forEach(([x0, y0, x1, y1], k) =>
        sc.tube([[X(x0), y0, 1.2, 10], [X(x1), y1, 0.5, 10]], { m: claw, g: 'claw' + s + k }));
      sc.carve([[X(6), 27], [X(6.5), 32]], -1).carve([[X(9), 26.5], [X(9), 32.5]], -1).carve([[X(11.5), 27], [X(11), 32]], -1);
    });
    // the long pink nose, pointing down toward the viewer
    sc.tube([[23.5, 20.5, 2.3, 10], [23.5, 24.5, 2.1, 12], [23.5, 27.4, 1.9, 13]], { m: pink, g: 'nose' });
    sc.ell(23.5, 28, 2.6, 2, { m: pink, g: 'nose', z: 15, rz: 2 });
    // fur crown ridge and shoulder tufts
    for (const [x0, y0, x1, y1] of [[20, 13, 18.6, 10.8], [23.5, 12.2, 23.5, 10.2], [27, 13, 28.4, 10.8]]) sc.tube([[x0, y0, 1.6, 7], [x1, y1, 0.4, 7]], { m: fur, g: 'body' });
    const p = sc.render();
    // nostrils, the little mouth under the nose
    stamp2(p, 22, 28, ['k.k'], { k: '#6a2a3a' });
    stamp2(p, 21, 31, ['k...k', '.kkk.'], { k: INK });
    // eyes almost lost in the fur: tiny glinting beads
    T.stampM(p, 18, 18, ['kk', 'kw'], { k: INK, w: '#b0a0a0' });
    return finish(p, { post: (q) => {
      // whiskers off the nose
      for (const [x0, y0, x1, y1] of [[21, 26, 16, 24], [21, 27, 16, 28], [26, 26, 31, 24], [26, 27, 31, 28]]) q.line(x0, y0, x1, y1, '#c8b8a8');
    } });
  };

  // Automaton: a brass clockwork soldier: a round head with one glass lens
  // glowing blue, a barrel chest with a hatch and a little gear window, arms
  // geared at every joint, a big wind-up key in its back, stubby round legs
  // and rows of rivets.
  SIZES.automaton = 48;
  ANCHORS.automaton = { head: [23, 9], brow: [23, 12], eyes: [[23, 15]], mouth: [23, 19], neck: [23, 22], back: [23, 24], body: [23, 30], hand: [10, 40], hand2: [37, 40], tail: [23, 36], feet: [23, 46], headW: 13 };
  S.automaton = () => {
    const T = TS(), W = 48, H = 48;
    const brass = M(null, { ramp: ['#4a3010', '#806020', '#b08438', '#c09040', '#dcb468', '#f0d890', '#fff6d8'], rim: 1, spec: 0.9 });
    const dark = M(null, { ramp: ['#2a1a08', '#4a3410', '#806020', '#a07c34'], spec: 0.94 });
    const steel = M(null, { ramp: ['#40485c', '#687088', '#a0a8b8', '#c8d0dc', '#f0f4f8'], spec: 0.88, rim: 1 });
    const lens = M(null, { glow: 0.8, ramp: ['#16407e', '#2270b8', '#3aa0e0', '#60d0ff', '#b8f0ff'] });
    const sc = new T.Scene(W, H);
    // the wind-up key in its back, showing over the right shoulder
    sc.tube([[29, 20, 1.3, -8], [36.5, 12.5, 1.2, -8]], { m: steel, g: 'keystem' });
    sc.ell(38.4, 10.6, 1.7, 1.7, { m: steel, g: 'keyhub', z: -6, rz: 1.5 });
    sc.ell(35.4, 7.4, 3.6, 3.4, { m: steel, g: 'keybow', z: -7, rz: 1.5 });
    sc.ell(41.6, 13.6, 3.4, 3.6, { m: steel, g: 'keybow', z: -7, rz: 1.5 });
    sc.cut((x, y) => Math.hypot(x - 35.2, y - 7.2) < 1.5 || Math.hypot(x - 41.8, y - 13.8) < 1.5);
    // stubby cylinder legs, round feet
    T.sym(W, (X, s) => {
      sc.cap(X(18.5), 38, X(18.5), 42.5, 3, 3, { m: brass, g: 'leg' + s, z: 0 });
      sc.ell(X(18), 44.8, 4.4, 2.2, { m: dark, g: 'foot' + s, z: 3, rz: 2 });
    });
    // barrel chest with bands, the neck
    sc.ell(23.5, 30, 10.6, 9.4, { m: brass, g: 'barrel', z: 0, rz: 9 });
    sc.cap(23.5, 20.5, 23.5, 22.5, 2.6, 2.6, { m: dark, g: 'neck', z: 2 });
    sc.region((x, y) => sc.isG(x, y, 'barrel') && (y === 22 || y === 23 || y === 37 || y === 38), dark);
    // chest hatch: a raised plate with a hinge and a round gear window
    sc.poly([[18, 25], [29, 25], [29, 34], [18, 34]], { m: brass, g: 'hatch', z: 11, bevel: 1.2 });
    sc.ell(23.5, 29.4, 3.1, 3.1, { m: dark, g: 'window', z: 13, rz: 0.5 });
    // shoulder gears, upper arms, elbow gears, forearms, clamp hands
    T.sym(W, (X, s) => {
      sc.ell(X(12.4), 23.6, 3.6, 3.6, { m: brass, g: 'sgear' + s, z: 6, rz: 2.5 });
      sc.tube([[X(11.6), 25.5, 2.2, 3], [X(9.6), 30.5, 2, 3]], { m: brass, g: 'upper' + s });
      sc.ell(X(9.4), 32, 2.6, 2.6, { m: brass, g: 'egear' + s, z: 7, rz: 2 });
      sc.tube([[X(9.4), 33.5, 1.9, 5], [X(9.8), 37.5, 1.8, 6]], { m: brass, g: 'fore' + s });
      sc.tube([[X(9), 38, 1, 8], [X(7.6), 41.2, 0.7, 8]], { m: dark, g: 'claw' + s });
      sc.tube([[X(10.8), 38, 1, 8], [X(11.8), 41.2, 0.7, 8]], { m: dark, g: 'claw' + s });
    });
    // round head, the lens housing and the lens
    sc.ell(23.5, 15.4, 6.4, 6.2, { m: brass, g: 'head', z: 4, rz: 6 });
    sc.ell(23.5, 15.6, 3.9, 3.9, { m: dark, g: 'rim', z: 9, rz: 1.2 });
    sc.ell(23.5, 15.6, 2.7, 2.7, { m: lens, g: 'lens', z: 11, rz: 2 });
    sc.carve([[18, 11], [21, 9.6]], 1);
    const p = sc.render();
    // gear teeth on the shoulder and elbow gears, a gear in the window
    const teeth = (cx, cy, r, c) => { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; over(p, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), c); } };
    T.sym(W, (X) => { teeth(X(12.4), 23.6, 3, brass.r[1]); p.set(Math.round(X(12.4)), 24, dark.r[0]); teeth(X(9.4), 32, 2, brass.r[1]); });
    stamp2(p, 21, 27, ['.y.y.', 'yyyyy', '.yky.', 'yyyyy', '.y.y.'], { y: '#e0b050', k: '#2a1a08' });
    // hinge on the hatch, rivets along the bands and the hatch
    p.vline(18, 26, 27, steel.r[2]); p.vline(18, 31, 32, steel.r[2]);
    for (let x = 15; x <= 32; x += 3) { over(p, x, 22, brass.r[5]); over(p, x, 38, brass.r[4]); }
    for (const [x, y] of [[20, 26], [27, 26], [20, 33], [27, 33]]) over(p, x, y, brass.r[6]);
    // mouth grille under the lens
    for (const x of [21, 23, 25]) over(p, x, 20, dark.r[0]);
    // the lens: a dark ring, the blue glass, a bright core and a catch-light
    for (let y = 12; y <= 19; y++) for (let x = 20; x <= 27; x++) {
      const d = Math.hypot(x - 23.5, y - 15.6);
      if (d < 1.3) p.set(x, y, '#e8fcff'); else if (d < 2.1) p.set(x, y, '#80dcff'); else if (d < 2.9) p.set(x, y, '#3aa0e0');
    }
    p.set(22, 14, '#ffffff'); p.set(22, 13, '#b8f0ff');
    return finish(p);
  };

  // Scribe: a scribe of the Archive in a white coat, the deep hood hiding the
  // face in shadow (only round spectacles glint), the Archive's open-book
  // badge on the chest, a thick ledger under the left arm, a great quill in
  // the right hand, the long skirts of the coat to the ground.
  SIZES.scribe = 48;
  ANCHORS.scribe = { head: [23, 4], brow: [23, 11], eyes: [[20, 14], [26, 14]], mouth: [23, 18], neck: [23, 21], back: [23, 22], body: [23, 29], hand: [11, 30], hand2: [35, 30], tail: [23, 40], feet: [23, 46], headW: 16 };
  S.scribe = () => {
    const T = TS(), W = 48, H = 48;
    const coat = M(null, { ramp: ['#6a7088', '#9094a8', '#b8bcc8', '#d8dae0', '#f0f0ec', '#ffffff'], rim: 1 });
    const inner = M(null, { ramp: ['#0c0810', '#1a1420', '#2a2234'], flat: true });
    const trim = M(null, { ramp: ['#4a4a68', '#6a6c90', '#9498b8', '#c0c4dc'] });
    const gold = M(null, { ramp: ['#6a5418', '#a08020', '#d0b040', '#f0dc80', '#fff6c8'], spec: 0.9 });
    const ledger = M(null, { ramp: ['#1a1010', '#2c201a', '#403028', '#5c4838', '#7c6450'] });
    const pageM = M(null, { ramp: ['#b0a488', '#e0d8c0', '#f4f0e0'], flat: true });
    const skin = M(null, { ramp: ['#8a7870', '#b8a498', '#d8c8bc'] });
    const quill = M(null, { ramp: ['#a8acc0', '#d8dce8', '#f4f6fa', '#ffffff'], bias: 0.08, contrast: 0.8 });
    const sc = new T.Scene(W, H);
    // the long coat to the ground, a trim down the front and on the hem
    sc.poly([[16, 18], [31, 18], [35, 30], [39.5, 45.5], [33, 46.6], [23.5, 46.2], [14, 46.6], [7.5, 45.5], [12, 30]], { m: coat, g: 'coat', z: 2, bevel: 5, bz: 6 });
    sc.region((x, y) => sc.isG(x, y, 'coat') && (y >= 45 || (Math.abs(x - 23.5) < 1 && y > 27)), trim);
    // the ledger held under the left arm (picture right)
    sc.poly([[29.5, 27], [38.5, 28.5], [38, 38], [29, 36.5]], { m: ledger, g: 'ledger', z: 16, bevel: 1.2 });
    sc.poly([[29, 36.5], [38, 38], [37.8, 39.6], [28.8, 38.2]], { m: pageM, g: 'lpages', z: 16.5, n: [0, 0.6, 0.8] });
    // sleeves: right arm raised holding the quill, left arm clamped over the ledger
    sc.tube([[16, 20, 3.2, 6], [13, 25, 3.6, 7], [11.2, 29.5, 3.8, 8]], { m: coat, g: 'sleeveR' });
    sc.ell(11, 30.6, 1.8, 1.8, { m: skin, g: 'handR', z: 14, rz: 1.5 });
    sc.tube([[31, 20, 3.2, 6], [33.8, 24.5, 3.4, 12], [34.4, 28, 3, 13]], { m: coat, g: 'sleeveL' });
    sc.ell(35.4, 29.4, 1.9, 1.6, { m: skin, g: 'handL', z: 19, rz: 1.5 });
    // the deep hood and the shadow inside it
    sc.ell(23.5, 18.4, 9.4, 3.4, { m: coat, g: 'hood', z: 5, rz: 4 });
    sc.ell(23.5, 12.2, 8, 8.2, { m: coat, g: 'hood', z: 6, rz: 8 });
    sc.ell(23.5, 14.2, 5.2, 5.4, { m: inner, g: 'face', z: 15, rz: 2 });
    sc.region((x, y) => sc.isG(x, y, 'hood') && ((x - 23.5) / 6.4) ** 2 + ((y - 14.2) / 6.6) ** 2 <= 1, trim);
    // the badge: an open book in gold
    // coat folds
    sc.carve([[19, 31], [17, 44]], -1).carve([[28, 31], [30, 44]], -1).carve([[14, 36], [11.5, 44]], -1);
    sc.carve([[18, 31], [16, 44]], 1).carve([[27, 31], [29, 44]], 1);
    const p = sc.render();
    // the quill: a long white feather held up in the fist, leaning outward so
    // its broad vane stands clear of the coat; the dark nib shows under the fist
    const q = R.Gfx.pix(W, H);
    const shaftAt = (t) => [11 - 7.4 * t - 1.3 * Math.sin(t * Math.PI), 30.4 - 24.6 * t];
    const Lp = [], Rp = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, [x, y] = shaftAt(t);
      const env = t < 0.16 ? 0 : Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.16) / 0.84)), 0.6);
      Lp.push([x - 2.7 * env, y + 0.5 * env]); Rp.push([x + 1.3 * env, y + 0.9 * env]);
    }
    q.poly(Lp.concat(Rp.slice().reverse()), quill.r[2]);
    // the outer half of the vane catches the light, the inner half is a step darker
    q.each((x, y) => { const [sx] = shaftAt(Math.max(0, Math.min(1, (30.4 - y) / 24.6))); return x > sx + 0.5 ? quill.r[1] : x < sx - 1.5 ? quill.r[3] : undefined; });
    // barbs: small notches in the outer edge, running up and out
    for (const t of [0.34, 0.5, 0.66, 0.8]) {
      const [x, y] = shaftAt(t), ex = Math.round(x - 2.7 * Math.pow(Math.sin(Math.PI * (t - 0.16) / 0.84), 0.6));
      q.set(ex, Math.round(y) + 1, null); q.set(ex + 1, Math.round(y) + 1, quill.r[1]);
    }
    // the shaft (rachis) and the nib
    for (let t = 0; t <= 1; t += 0.02) { const [x, y] = shaftAt(t); q.set(Math.round(x), Math.round(y), t < 0.14 ? '#8a8ea4' : '#b4b8c8'); }
    q.set(11, 31, '#6a6e88'); q.set(11, 32, '#40404c'); q.set(11, 33, INK);
    R.Art.MonTK.put(p, q, 'dark');
    // the fist closed over the shaft
    over(p, 10, 29, skin.r[2]); over(p, 12, 29, skin.r[1]); over(p, 10, 30, skin.r[1]); over(p, 12, 30, skin.r[0]); over(p, 11, 30, skin.r[1]);
    // the badge: the Archive's open book, in gold
    stamp2(p, 19, 23, ['.yy...yy.', 'ywwy.ywwy', 'ywwwywwwy', 'yyyyyyyyy', '....d....'], { y: '#d0b040', w: '#fff0b0', d: '#8a6a20' });
    // glinting round spectacles in the dark
    T.stampM(p, 18, 12, ['.gg.', 'gyyg', 'gyyg', '.gg.'], { g: '#c8b040', y: '#fff0a0' });
    p.hline(22, 25, 13, '#c8b040');
    p.set(19, 13, '#ffffff'); p.set(25, 13, '#ffffff');
    // ledger: a leather band across the cover and a brass clasp
    p.line(29, 32, 38, 33, ledger.r[4]); over(p, 38, 33, '#d0b040'); over(p, 37, 33, '#a08020');
    return finish(p);
  };

  // Owl: an owl perched face-on on a branch: round facial disc, huge golden
  // eyes, ear tufts, a barred breast, folded wings, talons gripping the
  // branch that runs along the bottom of the picture.
  SIZES.owl = 48;
  ANCHORS.owl = { head: [23, 8], brow: [23, 13], eyes: [[18, 17], [29, 17]], mouth: [23, 21], neck: [23, 25], back: [23, 24], body: [23, 32], hand: [11, 32], hand2: [36, 32], tail: [23, 41], feet: [23, 46], headW: 22 };
  S.owl = () => {
    const T = TS(), W = 48, H = 48;
    const feather = M(null, { ramp: ['#3e2a20', '#6a4a32', '#a07850', '#c0a078', '#e0c8a0', '#f8ecd0'], rim: 1 });
    const disc = M(null, { ramp: ['#a8906c', '#d0bc9c', '#f0e0c8', '#fcf4e4'], bias: 0.06, contrast: 0.8 });
    const breast = M(null, { ramp: ['#8a7050', '#b89c78', '#dcc6a0', '#f4e6c8'], bias: 0.04 });
    const eyeM = M(null, { ramp: ['#9a6a10', '#d09a20', '#f0c030', '#f8e070', '#fff6c0'], bias: 0.1, contrast: 0.8 });
    const beak = M(null, { ramp: ['#2a2020', '#4a3a34', '#6a5a50', '#9a8a7c'] });
    const bark = M(null, { ramp: ['#241810', '#3e2c1c', '#604830', '#806448', '#a48a68'], rim: 1, tex: T.texStone(4) });
    const talon = M(null, { ramp: ['#6a6040', '#a09060', '#c8b880', '#e8dcb0'] });
    const leaf = M(null, { ramp: ['#1e4a24', '#347034', '#50984a', '#80c068'] });
    const sc = new T.Scene(W, H);
    // the branch along the bottom, a twig with a leaf
    sc.tube([[0, 44.6, 2.6, 0], [16, 44, 2.5, 0], [32, 44.2, 2.5, 0], [47.5, 43.2, 2.2, 0]], { m: bark, g: 'branch' });
    sc.tube([[39, 42.5, 1, -1], [42, 39, 0.8, -1], [43.5, 37.5, 0.5, -1]], { m: bark, g: 'twig' });
    sc.ell(44.6, 36.6, 2.2, 1.3, { m: leaf, g: 'leaf', z: -1, rz: 1 });
    // tail over the branch
    sc.poly([[20, 38], [27, 38], [26, 44], [21, 44]], { m: feather, g: 'tail', z: 1, bevel: 1.5 });
    // body and the big round head, one mass
    sc.ell(23.5, 31, 11, 11, { m: feather, g: 'body', z: 0, rz: 10 });
    sc.ell(23.5, 17.4, 11.4, 9.2, { m: feather, g: 'body', z: 2, rz: 9 });
    // ear tufts
    T.sym(W, (X, s) => sc.tube([[X(16.5), 11, 2.4, 4], [X(13.4), 6.6, 1.6, 4], [X(12.2), 3.8, 0.5, 4]], { m: feather, g: 'tuft' + s }));
    // barred breast
    sc.ell(23.5, 32.4, 7.2, 8, { m: breast, g: 'breast', z: 8, rz: 5 });
    // folded wings down the sides with scalloped tips
    T.sym(W, (X, s) => {
      sc.ell(X(14), 30.6, 4.6, 9, { m: feather, g: 'wing' + s, z: 7, rz: 4 });
      for (const [x, y] of [[12, 39], [14.2, 39.8], [16.4, 39.2]]) sc.ell(X(x), y, 1.6, 1.8, { m: feather, g: 'wing' + s, z: 7, rz: 1.5 });
      sc.carve([[X(12), 25], [X(11), 36]], -1).carve([[X(15), 27], [X(15.5), 37]], -1);
    });
    // facial disc around each eye, the eyes, the beak
    T.sym(W, (X, s) => {
      sc.ell(X(18.4), 17.4, 5.4, 5.2, { m: disc, g: 'disc', z: 10, rz: 3 });
      sc.ell(X(18.4), 17.4, 3.4, 3.4, { m: eyeM, g: 'eye' + s, z: 13, rz: 2 });
    });
    sc.tube([[23.5, 19.6, 1.5, 16], [23.5, 22.4, 1.2, 16], [23.8, 23.6, 0.5, 16]], { m: beak, g: 'beak' });
    // talons over the branch
    T.sym(W, (X, s) => {
      for (const [x0, x1] of [[18, 16.8], [19.6, 19.4], [21.2, 21.8]]) sc.tube([[X(x0 + 0.3), 41.2, 0.9, 12], [X(x1), 43.4, 0.7, 12], [X(x1 + 0.3), 44.8, 0.45, 12]], { m: talon, g: 'tal' + s + x0 });
    });
    const p = sc.render();
    // the disc's dark rim and a V of feathers between the eyes
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2;
      T.sym(W, (X) => { const x = Math.round(X(18.4) + Math.cos(t) * 5.6), y = Math.round(17.4 + Math.sin(t) * 5.4); if (Math.abs(x - 23.5) > 1.6 && y < 23) over(p, x, y, feather.r[1]); });
    }
    stamp2(p, 21, 13, ['k....k', '.k..k.'], { k: feather.r[1] });
    // pupils, glints
    T.stampM(p, 17, 16, ['kk', 'kk', 'k.'], { k: INK });
    T.stampM(p, 16, 15, ['w'], { w: WHITE });
    T.stampM(p, 19, 19, ['y'], { y: '#fff6c0' });
    // bars on the breast
    for (const [y, x0] of [[26, 19], [29, 17], [32, 19], [35, 17], [38, 19]]) for (let x = x0; x <= 29; x += 4) {
      if (p.get(x, y) == null) continue;
      over(p, x, y, breast.r[0]); over(p, x + 1, y + 1, breast.r[0]); over(p, x + 2, y, breast.r[0]);
    }
    // dark claw tips over the branch
    T.sym(W, (X) => { for (const x of [17, 19, 22]) over(p, X(x), 45, '#3a3020'); });
    return finish(p);
  };

  // Spider: a great spider face-on: a round abdomen rising behind a smaller
  // head-thorax, eight legs spread wide with the knees bent high, six black
  // eyes (the front two large), two fangs, and a stipple of bristles.
  SIZES.spider = 48;
  ANCHORS.spider = { head: [23, 23], brow: [23, 25], eyes: [[21, 28], [26, 28]], mouth: [23, 34], neck: [23, 30], back: [23, 12], body: [23, 29], hand: [9, 30], hand2: [38, 30], tail: [23, 7], feet: [23, 46], headW: 16 };
  S.spider = () => {
    const T = TS(), W = 48, H = 48;
    const body = M(null, { ramp: ['#1e1414', '#3a2a22', '#604830', '#7c6044', '#9a7858', '#c4a484'], rim: 1, tex: T.texFur(0.1, 3) });
    const legM = M(null, { ramp: ['#1a1212', '#34261e', '#584230', '#7a5e44', '#9a7858', '#c0a080'], rim: 1 });
    const mark = M(null, { ramp: ['#5a3a20', '#8a6038', '#b88a50', '#dcb87c'] });
    const fangM = M(null, { ramp: ['#8a7868', '#c0b0a0', '#f0e0d0', '#fff8f0'] });
    const sc = new T.Scene(W, H);
    // legs: femur up to a high knee, tibia down to the ground; rear pairs behind
    const LEGS = [
      [[18, 23, 1.3], [11, 3.6, 1.05], [5.2, 19, 0.5], -8],
      [[17, 26.5, 1.45], [3.6, 9.8, 1.15], [0.8, 32, 0.5], -2],
      [[17, 30, 1.5], [6.2, 18.6, 1.2], [1.4, 46.6, 0.55], 4],
      [[18.6, 32.6, 1.45], [12.2, 25, 1.15], [7.4, 46.6, 0.55], 10],
    ];
    T.sym(W, (X, s) => {
      LEGS.forEach(([a, k, f, z], i) => {
        sc.tube([[X(a[0]), a[1], a[2], z], [X((a[0] + k[0]) / 2 + 0.6), (a[1] + k[1]) / 2 - 1.4, a[2] * 0.95, z], [X(k[0]), k[1], k[2], z]], { m: legM, g: 'fem' + i + s });
        sc.ell(X(k[0]), k[1], k[2] + 0.35, k[2] + 0.35, { m: legM, g: 'knee' + i + s, z: z + 1, rz: 1 });
        sc.tube([[X(k[0]), k[1], k[2] * 0.85, z], [X(k[0] + (f[0] - k[0]) * 0.5 - 0.6), k[1] + (f[1] - k[1]) * 0.5, k[2] * 0.72, z], [X(f[0]), f[1], f[2], z]], { m: legM, g: 'tib' + i + s });
      });
    });
    // the abdomen rising behind, with a pale chevron marking
    sc.ell(23.5, 16.6, 12.4, 10.6, { m: body, g: 'abd', z: -4, rz: 10 });
    sc.region((x, y) => sc.isG(x, y, 'abd') && Math.abs(Math.abs(x - 23.5) * 0.7 - (y - 9)) < 1.2 && y > 8 && y < 20, mark);
    sc.region((x, y) => sc.isG(x, y, 'abd') && Math.abs(Math.abs(x - 23.5) * 0.7 - (y - 14)) < 1 && y > 13 && y < 23, mark);
    // head-thorax
    sc.ell(23.5, 29.2, 8.2, 6.6, { m: body, g: 'ceph', z: 6, rz: 6 });
    // chelicerae and fangs
    T.sym(W, (X, s) => {
      sc.ell(X(21.2), 35, 2.3, 2.6, { m: body, g: 'chel' + s, z: 11, rz: 2 });
      sc.tube([[X(21), 36.8, 0.9, 13], [X(20.8), 39, 0.75, 13], [X(21.6), 40.8, 0.4, 13]], { m: fangM, g: 'fang' + s });
    });
    const p = sc.render();
    // banded legs: a pale ring at each knee and at the mid-shin joint, a claw tip
    T.sym(W, (X) => {
      LEGS.forEach(([a, k, f]) => {
        const mid = [k[0] + (f[0] - k[0]) * 0.52 - 0.3, k[1] + (f[1] - k[1]) * 0.52];
        for (const [cx, cy, r] of [[k[0], k[1], k[2] + 0.4], [mid[0], mid[1], k[2] * 0.8]]) {
          const dx = f[0] - k[0], dy = f[1] - k[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
          for (let t = -r; t <= r; t += 0.5) { over(p, Math.round(X(cx + nx * t)), Math.round(cy + ny * t), legM.r[4]); over(p, Math.round(X(cx + nx * t + dx / L)), Math.round(cy + ny * t + dy / L), legM.r[1]); }
        }
        over(p, Math.round(X(f[0])), Math.round(f[1]), legM.r[0]);
      });
    });
    // six black eyes: two big ones in front, four small above
    T.stampM(p, 19, 26, ['.kk', 'kwk', 'kkk', '.k.'], { k: '#200808', w: '#e8d0c0' });
    T.stampM(p, 18, 24, ['k'], { k: '#200808' });
    T.stampM(p, 21, 23, ['kk'], { k: '#200808' });
    // bristles: pale stipple on the legs and body
    const pale = body.r[5];
    for (const [x, y] of [[11, 9], [7, 16], [3, 22], [10, 22], [6, 30], [12, 35], [2, 34], [5, 40], [12, 41], [19, 12], [16, 18], [21, 7], [18, 30], [19, 33], [14, 6], [8, 12]]) {
      T.sym(W, (X) => over(p, X(x), y, pale));
    }
    return finish(p);
  };

  // ================================================================ large (64)

  // Treant: an old tree walking: a thick trunk with a face in the bark (two
  // hollow eyes with a green glow deep inside, a split mouth), two branches
  // reaching out like arms with twig fingers, a crown of leaves on top, and
  // three or four roots splayed like feet.
  SIZES.treant = 64;
  ANCHORS.treant = { head: [31, 11], brow: [31, 32], eyes: [[26, 36], [37, 36]], mouth: [31, 44], neck: [31, 29], back: [31, 22], body: [31, 42], hand: [6, 27], hand2: [57, 27], tail: [31, 55], feet: [31, 62], headW: 30 };
  S.treant = () => {
    const T = TS(), W = 64, H = 64;
    const barkTex = (x, y) => { const r = T.hash(x, Math.floor(y / 3), 11); return r < 0.16 ? -1 : r > 0.93 ? 1 : 0; };
    const bark = M(null, { ramp: ['#24160e', '#40291a', '#5a3e28', '#6a4a30', '#86603e', '#a07850', '#c4a070'], rim: 1, tex: barkTex });
    const leaf = M(null, { ramp: ['#16361c', '#26582a', '#3a7c32', '#4c9a3a', '#6cb044', '#8ac050', '#bce084'], rim: 1, tex: T.texStone(8) });
    const sc = new T.Scene(W, H);
    // roots splayed like feet
    for (const [pts, z] of [
      [[[25, 52, 4], [16, 58, 3], [9, 61.6, 1.8], [5, 62.4, 0.8]], 2],
      [[[29, 55, 3.4], [25, 60, 2.4], [22, 62.4, 1]], 5],
      [[[35, 55, 3.4], [39, 60, 2.4], [42, 62.4, 1]], 5],
      [[[39, 52, 4], [47, 58, 3], [54, 61.6, 1.8], [58.5, 62.4, 0.8]], 2],
    ]) sc.tube(pts.map((q) => q.concat([z])), { m: bark, g: 'roots' });
    // the trunk, a little bent
    sc.tube([[31.5, 57, 9.2, 0], [31, 46, 8.8, 0], [32, 35, 8.2, 0], [31.5, 28, 7.8, 0]], { m: bark, g: 'trunk' });
    // arm branches out of the sides of the trunk, reaching out and up below the
    // crown, the tips split into twig fingers
    sc.tube([[24.5, 39.5, 3.4, 3], [17, 37.4, 2.8, 3], [11, 33, 2.3, 3], [7, 28.4, 1.8, 3]], { m: bark, g: 'armL' });
    for (const [x, y] of [[1.6, 25.2], [2.6, 31.4], [5.6, 21.6]]) sc.tube([[7, 28.4, 1.5, 4], [(7 + x) / 2, (28.4 + y) / 2, 1, 4], [x, y, 0.5, 4]], { m: bark, g: 'armL' });
    sc.tube([[39, 39.5, 3.4, 3], [46.5, 37.4, 2.8, 3], [52.5, 33, 2.3, 3], [56.5, 28.4, 1.8, 3]], { m: bark, g: 'armR' });
    for (const [x, y] of [[61.8, 25.2], [60.8, 31.4], [57.8, 21.6]]) sc.tube([[56.5, 28.4, 1.5, 4], [(56.5 + x) / 2, (28.4 + y) / 2, 1, 4], [x, y, 0.5, 4]], { m: bark, g: 'armR' });
    // leaves sprouting on the arms
    for (const [x, y, r] of [[14.6, 33.6, 2.4], [49, 33.6, 2.4], [3.4, 21.6, 1.8], [60, 21.6, 1.8]]) sc.ell(x, y - 1.6, r, r * 0.8, { m: leaf, g: 'lv' + x, z: 6, rz: 2 });
    // crown of leaves: a heap of clumps, each shaded as its own ball (soft seams)
    const CL = [
      [31.5, 23, 15, 6.6, 0], [17.5, 23.4, 6.6, 5.8, 1], [45.5, 23.4, 6.6, 5.8, 1], [12.6, 25, 3.4, 3, 2], [50.4, 25, 3.4, 3, 2],
      [24, 17.4, 7, 6, 2], [39, 17.4, 7, 6, 2], [31.5, 15.2, 6, 4.6, 3], [18, 17.8, 4.2, 3.6, 0], [45, 17.8, 4.2, 3.6, 0],
      [22, 27.6, 5, 3, 4], [31.5, 28.4, 5.4, 3, 5], [41, 27.6, 5, 3, 4], [29, 11.8, 3.2, 2.2, 1], [35, 12, 3, 2.2, 1],
    ];
    CL.forEach(([x, y, rx, ry, z], i) => sc.ell(x, y, rx, ry, { m: leaf, g: 'clump' + i, z: z + 8, rz: Math.min(rx, ry), k: 0, soft: true }));
    // bark grooves and the brow ridges over the eyes
    for (const [x0, x1] of [[26, 25], [29.5, 29], [34, 34.5], [37.5, 38.5]]) sc.carve([[x0, 30], [x1, 56]], -1);
    for (const [x0, x1] of [[27.5, 27], [36, 36.5]]) sc.carve([[x0, 48], [x1, 55]], 1);
    T.sym(W, (X) => sc.carve([[X(23), 32], [X(26.5), 31.4], [X(29.5), 32.6]], 2));
    const p = sc.render();
    // hollow eyes with a green glow deep inside
    T.stampM(p, 24, 34, ['.kkk.', 'kkkkk', 'kkgkk', 'kkGkk', '.kkk.'], { k: '#201008', g: '#c0f060', G: '#6a8a28' });
    // the split mouth
    stamp2(p, 25, 42, [
      'k............k',
      'kk.kk.kk.kk.kk',
      '.kkkkkkkkkkkk.',
      '..kkkkkkkkkk..',
      '...k..kk..k...',
    ], { k: '#201008' });
    // foliage: leaf-shaped glints on the lit clumps, dark gaps between clumps
    const L = leaf.r;
    for (const [x, y] of [[21, 13], [27, 10], [33, 11], [37, 13], [15, 19], [42, 19], [29, 14], [11, 23], [20, 20], [35, 17], [48, 21]]) {
      over(p, x, y, L[6]); over(p, x + 1, y, L[5]); over(p, x, y + 1, L[5]);
    }
    return finish(p);
  };

  // Mammoth: a shaggy mammoth face-on: great white tusks curving out and up,
  // the trunk hanging down with its tip curled, small eyes, a domed crown,
  // long hair falling from the shoulders, legs like pillars.
  SIZES.mammoth = 64;
  ANCHORS.mammoth = { head: [31, 12], brow: [31, 22], eyes: [[24, 28], [39, 28]], mouth: [31, 41], neck: [31, 39], back: [31, 22], body: [31, 38], hand: [7, 37], hand2: [56, 37], tail: [31, 30], feet: [31, 62], headW: 26 };
  S.mammoth = () => {
    const T = TS(), W = 64, H = 64;
    const fur = M(null, { ramp: ['#2a1810', '#482a16', '#6a4020', '#8a5a30', '#a8784a', '#c09060', '#dcb888'], rim: 1, tex: T.texFur(0.12, 6) });
    const dark = M(null, { ramp: ['#1e120c', '#341e12', '#4c2e1a', '#6a4428', '#8a5e3a'], tex: T.texFur(0.1, 8) });
    const tusk = M(null, { ramp: ['#6a5c4c', '#9a8e7a', '#c4baa4', '#e4dcc8', '#f8f2e4', '#ffffff'], rim: 1, spec: 0.9 });
    const nail = M(null, { ramp: ['#6a6050', '#a09880', '#d0c8b4'] });
    const sc = new T.Scene(W, H);
    // rear legs (half hidden), front pillar legs, feet with toenails
    T.sym(W, (X, s) => {
      sc.tube([[X(12.5), 47, 5, -6], [X(12), 60, 4.6, -6]], { m: dark, g: 'rleg' + s });
      sc.ell(X(12), 61, 5, 2.2, { m: dark, g: 'rfoot' + s, z: -3, rz: 2 });
      sc.tube([[X(21.5), 44, 6, 4], [X(21.5), 59.5, 5.6, 4]], { m: fur, g: 'leg' + s });
      sc.ell(X(21.5), 60.6, 6.2, 2.6, { m: dark, g: 'foot' + s, z: 8, rz: 2.5 });
      for (const tx of [18, 21.5, 25]) sc.ell(X(tx), 61.8, 1.3, 0.9, { m: nail, g: 'nail' + s + tx, z: 11, rz: 1 });
    });
    // the great shaggy body behind the head, humped at the shoulders
    sc.ell(31.5, 34, 27, 15.5, { m: fur, g: 'body', z: -4, rz: 12 });
    sc.ell(31.5, 23, 20, 9, { m: fur, g: 'body', z: -3, rz: 8 });
    // long hair falling from the shoulders and flanks
    T.sym(W, (X, s) => {
      for (const [x0, y0, x1, y1, r] of [[7, 36, 5.5, 47, 2.6], [10, 40, 9, 51, 2.6], [14.5, 42, 14.5, 53, 2.4], [5.5, 30, 2.6, 39, 2], [17, 30, 16.4, 44, 2.6]])
        sc.tube([[X(x0), y0, r, 0], [X((x0 + x1) / 2), (y0 + y1) / 2, r * 0.8, 0], [X(x1), y1, 0.5, 0]], { m: fur, g: 'hair' + s + x0 });
    });
    // domed head
    sc.ell(31.5, 27, 12.4, 12.6, { m: fur, g: 'head', z: 4, rz: 11 });
    sc.ell(31.5, 18.4, 8.2, 6, { m: fur, g: 'head', z: 6, rz: 6 });
    // cheek hair
    T.sym(W, (X) => sc.tube([[X(21.5), 32, 2.4, 8], [X(20.8), 38, 1.8, 8], [X(21.6), 42, 0.5, 8]], { m: fur, g: 'head' }));
    // the trunk: hanging down, the tip curled up
    sc.tube([[31.5, 32, 4.6, 12], [31.5, 41, 4, 14], [31, 49, 3.2, 15], [32.6, 54.6, 2.6, 16], [35.6, 55.4, 2, 17], [36.6, 52.4, 1.4, 17]], { m: fur, g: 'trunk', k: 1.5 });
    for (let y = 36; y <= 52; y += 3) sc.carve([[28.5, y], [34, y]], -1);
    // tusks: out, down and up again
    T.sym(W, (X, s) => sc.tube([[X(25.8), 37.6, 2.3, 18], [X(20), 45.6, 2.1, 19], [X(13.4), 46.8, 1.8, 19], [X(9), 42.6, 1.3, 19], [X(8.6), 37.4, 0.5, 19]], { m: tusk, g: 'tusk' + s, steps: 8 }));
    const p = sc.render();
    // small dark eyes under a heavy brow
    T.stampM(p, 22, 26, ['ddddd', '.lkkd', '.lkw.', '..ll.'], { k: '#201810', w: '#f0e0c8', d: fur.r[1], l: fur.r[5] });
    // a crease of the brow and forelock hair on the dome
    for (const [x, y] of [[29, 14], [31, 13], [33, 14], [27, 17], [35, 17], [31, 16]]) over(p, x, y, fur.r[6]);
    // the shag: dark partings between the long locks of the flanks and the fringe
    T.sym(W, (X) => {
      for (const [x0, y0, x1, y1] of [[8, 37, 7, 46], [12, 40, 11.5, 50], [16, 43, 16, 52], [4, 31, 3, 38], [10, 26, 9, 33], [14, 24, 13, 30]]) crease(p, [[X(x0), y0], [X(x1), y1]], 0.72);
    });
    return finish(p);
  };

  // ================================================================ registry
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.monstersC = { ids: Object.keys(SIZES), sizes: SIZES, anchors: ANCHORS };
})(window.RPG);
