// The 17 new rare-monster battle sprites of Chronicle (DESIGN §9.10.3): 'mon:rare_*'.
// Same rules as the six kept from Crest (rare_monsters.js, postgame.js): original
// designs that read as "rare" at a glance, always with a jewel, gold, a rainbow or
// light points, faceted jewels with a white glint and a few loose sparkles round
// the silhouette. Sizes s 32 / m 48 / l 64; the lowest body pixel stands on the
// second-to-last row and the outline closes on the last.
//
// Built with the toolkit exported by rare_monsters.js (R.Art.RareTK: a small
// z-buffered 2.5-D scene of ellipsoids, tapered capsules, spline tubes and
// bevelled polygons, lit from the top-left and quantised into hue-shifted ramps,
// with a dark contour where parts overlap). This file sorts before
// rare_monsters.js, so the toolkit is only looked up inside the factories.
// Deterministic; each sprite is built lazily once through R.Gfx.get.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  let TK = null;
  const kit = () => TK || (TK = R.Art.RareTK);
  const S = {};

  // ================================================================ rare_fawn
  // 花角の小鹿: a white-spotted fawn standing with its front hooves together, its
  // round face turned to the viewer. The antlers are young branches in blossom
  // (pink and white flowers with golden hearts, a few leaves, a jewel dewdrop),
  // the eyes big and glossy; petals drift round its feet. 48x48.
  S.rare_fawn = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, INK, WHITE, PINK, SAPH } = kit();
    const W = 48, H = 48;
    const FUR = ['#4a2418', '#7a4428', '#a86c40', '#c89060', '#dcb07c', '#f0d8b0', '#fff4e0'];
    const fur = mat('', { ramp: FUR, rim: 3, bias: 0.06 });
    const furD = mat('', { ramp: FUR, bias: -0.1 });
    const CREAM = ['#b08c70', '#d4b494', '#ecd8bc', '#f8ecdc', '#fffaf2'];
    const cream = mat('', { ramp: CREAM, bias: 0.12, contrast: 0.8 });
    const inner = mat('#f0a0a8', { n: 4, dark: 0.45, bias: 0.1, contrast: 0.7 });
    const TWIG = ['#2e1a12', '#54341e', '#7e5632', '#a8804e', '#ccaa74'];
    const twig = mat('', { ramp: TWIG, bias: 0.05 });
    const hoof = mat('#4a3440', { n: 4, dark: 0.5, bias: 0.05 });
    const LEAF = ['#1a4418', '#2e7426', '#56a83a', '#8cd45c', '#cff49a'];
    const leaf = mat('', { ramp: LEAF, bias: 0.08 });
    const sc = new Scene(W, H);
    // far legs behind the body
    sc.tube([[33.5, 35, 2.2, -6], [33.8, 40, 1.5, -6], [33.8, 44.6, 1.4, -6]], { m: furD, g: 'legFH' });
    sc.tube([[25, 35, 2, -4], [25.2, 40, 1.4, -4], [25.3, 44.6, 1.3, -4]], { m: furD, g: 'legFF' });
    sc.ell(34, 45.3, 1.8, 1.1, { m: hoof, g: 'hoofFH', z: -4, rz: 1 });
    sc.ell(25.4, 45.3, 1.7, 1.1, { m: hoof, g: 'hoofFF', z: -2, rz: 1 });
    // flicked-up tail with a pale underside
    sc.tube([[40, 28.5, 2.2, -2], [42.5, 25.5, 1.8, -2], [43.2, 23.2, 1, -2]], { m: fur, g: 'tail' });
    sc.ell(42.8, 25.2, 1.1, 1.5, { m: cream, g: 'tailU', z: 0, rz: 1, soft: true });
    // body: a round little barrel seen three-quarters, pale belly
    sc.ell(31, 32, 10.4, 6.6, { m: fur, g: 'body', z: 0, rz: 7 });
    // chest and near legs: front hooves together, hind leg with a round haunch
    sc.ell(21.2, 31.6, 4.2, 4.4, { m: cream, g: 'chest', z: 6, rz: 4.5 });
    sc.tube([[20, 34, 2.1, 8], [19.8, 40, 1.5, 8], [19.8, 44.6, 1.4, 8]], { m: fur, g: 'legNF' });
    sc.tube([[22.8, 34.5, 2, 9], [22.8, 40, 1.4, 9], [22.7, 44.6, 1.3, 9]], { m: fur, g: 'legNF2' });
    sc.ell(37.5, 33.5, 4.4, 4.2, { m: fur, g: 'haunch', z: 5, rz: 4 });
    sc.tube([[38, 36, 2.5, 7], [39, 40.5, 1.5, 7], [38.6, 44.6, 1.4, 7]], { m: fur, g: 'haunch' });
    sc.ell(19.8, 45.4, 1.9, 1.1, { m: hoof, g: 'hoofA', z: 10, rz: 1 });
    sc.ell(22.8, 45.4, 1.8, 1.1, { m: hoof, g: 'hoofB', z: 11, rz: 1 });
    sc.ell(38.7, 45.4, 1.9, 1.1, { m: hoof, g: 'hoofH', z: 9, rz: 1 });
    // ears: long leaves of fur sweeping out, pink inside
    sc.tube([[10, 17.5, 2.8, 5], [6, 14.8, 2.6, 5], [1.8, 13.6, 1, 5]], { m: fur, g: 'earL' });
    sc.tube([[9.2, 17, 1.4, 7], [6, 15, 1.3, 7], [3.2, 14.2, 0.4, 7]], { m: inner, g: 'innerL', soft: true });
    sc.tube([[23, 17.5, 2.8, 5], [27, 14.8, 2.6, 5], [31.2, 13.6, 1, 5]], { m: fur, g: 'earR' });
    sc.tube([[23.8, 17, 1.4, 7], [27, 15, 1.3, 7], [29.8, 14.2, 0.4, 7]], { m: inner, g: 'innerR', soft: true });
    // antler branches rising from the brow, forking, with leaves
    sc.tube([[13.5, 13.5, 1.4, 9], [12.4, 9.5, 1.2, 9], [11, 5.5, 0.9, 9], [10.4, 3, 0.5, 9]], { m: twig, g: 'antL' });
    sc.tube([[12.2, 9, 0.9, 9], [8.8, 7.2, 0.7, 9], [6.6, 5.2, 0.4, 9]], { m: twig, g: 'antL' });
    sc.tube([[19.5, 13.5, 1.4, 9], [20.6, 9.5, 1.2, 9], [22, 5.5, 0.9, 9], [22.8, 2.6, 0.5, 9]], { m: twig, g: 'antR' });
    sc.tube([[20.8, 8.8, 0.9, 9], [24.2, 7.4, 0.7, 9], [26.6, 5.6, 0.4, 9]], { m: twig, g: 'antR' });
    sc.tube([[11.6, 7.6, 0.5, 10], [9.8, 9.2, 1, 10], [7.6, 10, 0.2, 10]], { m: leaf, g: 'leafL' });
    sc.tube([[21.6, 6.8, 0.5, 10], [23.6, 9, 1, 10], [25.8, 9.8, 0.2, 10]], { m: leaf, g: 'leafR' });
    sc.tube([[22.4, 4, 0.5, 10], [24.4, 3, 0.8, 10], [26.2, 3.2, 0.2, 10]], { m: leaf, g: 'leafR2' });
    // head: round and turned to the viewer, full cheeks, a cream muzzle, a curl on the crown
    sc.ell(16.5, 19.2, 8.2, 7, { m: fur, g: 'head', z: 8, rz: 7 });
    sc.ell(12, 22.4, 3.8, 3.2, { m: fur, g: 'head', z: 10, rz: 3.4 });
    sc.ell(21, 22.4, 3.8, 3.2, { m: fur, g: 'head', z: 10, rz: 3.4 });
    sc.ell(16.5, 24, 3.8, 2.8, { m: cream, g: 'muzzle', z: 14, rz: 3, soft: true });
    sc.tube([[16.5, 13, 1.5, 12], [15.4, 11.4, 1.1, 12], [16.8, 10.8, 0.5, 12]], { m: fur, g: 'head' });
    const p = sc.render({ ground: 0.02 });
    // white spots scattered over the back
    const SPOT = '#fff8e8', SPOT2 = '#f0dcc0';
    for (const [x, y] of [[26, 27], [30, 26], [34, 26], [38, 27.5], [28, 30], [32, 29], [36, 30.5], [30, 33], [34, 33.5], [40, 31]]) {
      if (!p.get(x, y)) continue;
      on(p, x, y, SPOT); on(p, x + 1, y, SPOT); on(p, x, y + 1, SPOT2); on(p, x + 1, y + 1, SPOT2);
    }
    // eyes: big, dark and glossy with two highlights and a rim of reflected light
    const eye = { k: INK, d: '#1c1434', m: '#302c5c', l: '#6a78c0', w: WHITE, W: '#e8f0ff' };
    stamp(p, 10, 16, ['.kkkk.', 'kwwddk', 'kwwddk', 'kddmdk', 'kdmldk', '.kWlk.', '..kk..'], eye);
    stamp(p, 17, 16, ['.kkkk.', 'kwwddk', 'kwwddk', 'kddmdk', 'kdmldk', '.kWlk.', '..kk..'], eye);
    // lashes, blush, nose and a small smile
    p.set(9, 16, INK); p.set(8, 15, INK); p.set(23, 16, INK); p.set(24, 15, INK);
    for (const [x, y] of [[9, 23], [10, 23], [23, 23], [24, 23]]) p.set(x, y, '#f09a94');
    stamp(p, 15, 22, ['kkk', '.k.'], { k: '#2a1a24' });
    p.set(15, 22, '#6a5060');
    stamp(p, 14, 24, ['k...k', '.kkk.'], { k: '#8a5a48' });
    // blossoms on the antler tips and forks, a jewel dewdrop hanging from a leaf
    const BL = ['.aAa.', 'Aahab', '.abb.', '.b.b.'];
    const bloom = (x, y, a, b) => stamp(p, x - 2, y - 1, BL, { a, A: '#ffffff', b, h: '#ffd040' });
    bloom(10.5, 2, '#ff90c0', '#d05890');
    bloom(22.8, 1.6, '#f8f4ff', '#d8c0e0');
    bloom(6.4, 4.4, '#f8f4ff', '#d8c0e0');
    bloom(26.8, 4.8, '#ff90c0', '#d05890');
    jewel(p, 26.8, 12.4, 1, 1.5, SAPH, { shape: 'drop' });
    jewel(p, 16.5, 13.6, 1.4, 1.2, PINK, { shape: 'kite' });
    return finish(p, (q) => {
      // petals drifting round the hooves
      for (const [x, y, c, c2] of [[8, 42, '#ff90c0', '#ffc4e0'], [44, 38, '#f8f4ff', '#ffc4e0'], [29, 44, '#ff90c0', '#f8f4ff'], [4, 34, '#ffc4e0', '#ff90c0']]) {
        q.set(x, y, c); q.set(x + 1, y, c2); q.set(x + 1, y - 1, c);
      }
      sparkle(q, 3, 6, 'star', 'p');
      sparkle(q, 31, 3, 'small', 'y');
      sparkle(q, 45, 18, 'small', 'y');
      sparkle(q, 44, 30, 'dot');
      sparkle(q, 3, 25, 'dot');
    });
  };

  // ================================================================ rare_glassmoth
  // ガラスアゲハ: a great swallowtail facing the viewer, wings spread. Each wing is a
  // stained-glass window: black lead cames radiate from the wing root and cross
  // it, every pane is red, blue, green or yellow glass lit from the top-left with
  // its own bright point; ruby eye-spots set above the tails, a slender silver
  // body, antennae tipped with motes of light, and coloured glints of light
  // falling below. 48x48.
  S.rare_glassmoth = () => {
    const { Scene, mat, sparkle, finish, jewel, INK, WHITE, RUBY } = kit();
    const W = 48, H = 48;
    const p = G().pix(W, H);
    const GLASS = [
      ['#4a0a1e', '#8e1830', '#d0304a', '#f8707a', '#ffc4bc'], // red
      ['#0a1850', '#16389a', '#2a6cd8', '#62acfc', '#c4eaff'], // blue
      ['#08362a', '#107446', '#28b468', '#74e49c', '#ccfcdc'], // green
      ['#4e3208', '#9a6410', '#e8a820', '#fcdc5c', '#fff6c0'], // yellow
    ];
    const LEAD = '#1a1226', LEAD2 = '#3a3050';
    /**
     * One stained-glass wing (left side; mirrored after). pts: outline polygon,
     * root: where the cames radiate from, cuts: angle limits (deg, 0 = straight
     * out to the left, + = downward), bands: radial limits, order: glass per cell.
     */
    const wing = (pts, root, cuts, bands, order, bend) => {
      const m = G().pix(W, H); m.poly(pts, 1);
      const cell = (x, y) => {
        const dx = root[0] - x, dy = y - root[1], d = Math.hypot(dx, dy);
        const a = (Math.atan2(dy, dx) * 180) / Math.PI + d * (bend || 0);
        let s = 0; while (s < cuts.length && a > cuts[s]) s++;
        let b = 0; while (b < bands.length && d > bands[b]) b++;
        return s * 8 + b;
      };
      const C = new Map();
      m.each((x, y) => { C.set(y * W + x, cell(x, y)); return undefined; });
      // bounding box per cell (for the per-pane light)
      const bb = {};
      for (const [i, c] of C) {
        const x = i % W, y = (i / W) | 0, b = bb[c] || (bb[c] = [x, y, x, y, 0, 0, 0]);
        b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); b[4] += x; b[5] += y; b[6]++;
      }
      const inside = (x, y) => C.has(y * W + x);
      for (const [i, c] of C) {
        const x = i % W, y = (i / W) | 0;
        // cames: where the pane changes (right / down neighbour), and the rim of the wing
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const seam = (inside(x + 1, y) && C.get(i + 1) !== c) || (inside(x, y + 1) && C.get(i + W) !== c);
        if (edge || seam || Math.hypot(x - root[0], y - root[1]) < 4.2) { p.set(x, y, edge ? LEAD : LEAD2); continue; }
        const b = bb[c];
        const u = (x - b[0]) / Math.max(1, b[2] - b[0]), v = (y - b[1]) / Math.max(1, b[3] - b[1]);
        const g = GLASS[order[Object.keys(bb).indexOf(String(c)) % order.length]];
        // lit from the top-left inside each pane: a pale bevel along the pane's upper-left
        // cames, then two body steps, darker toward the lower right
        const nearLit = (inside(x - 1, y) && C.get(i - 1) !== c) || (inside(x, y - 1) && C.get(i - W) !== c) || !inside(x - 1, y) || !inside(x, y - 1);
        const k = nearLit ? 3 : u + v < 0.8 ? 3 : u + v < 1.35 ? 2 : 1;
        p.set(x, y, g[k]);
      }
      // a bright point in each pane (upper left of its centre)
      for (const c in bb) {
        const b = bb[c];
        if (b[6] < 6) continue;
        const cx = Math.round(b[4] / b[6] - 0.8), cy = Math.round(b[5] / b[6] - 0.8);
        if (inside(cx, cy) && p.get(cx, cy) !== LEAD && p.get(cx, cy) !== LEAD2) {
          p.set(cx, cy, WHITE);
          if (b[6] > 16 && inside(cx + 1, cy) && p.get(cx + 1, cy) !== LEAD2) p.set(cx + 1, cy, '#e8f4ff');
        }
      }
      return m;
    };
    // forewing: long and pointed, hindwing: rounded with a swallowtail
    const fore = [[22, 12.5], [15, 6.5], [8, 2.5], [2.5, 2], [0.5, 5], [1.5, 11], [4, 16.5], [8.5, 20.5], [15, 21.5], [22, 20]];
    const hind = [[22.5, 20.5], [14, 22], [6.5, 23], [4.5, 27], [6, 32.5], [9.5, 36.5], [11, 41], [11.5, 46.5], [14.5, 45.5], [15, 40], [17.5, 36.5], [21.5, 33], [23, 27]];
    wing(fore, [22.5, 16], [-17, 6], [10.5], [0, 1, 3, 2, 1, 0], -0.3);
    wing(hind, [22.5, 24], [18, 40], [9.5], [2, 3, 1, 0, 2, 3], 0.25);
    // ruby eye-spot above each tail, gold-rimmed
    jewel(p, 12.2, 37.6, 1.4, 1.4, RUBY);
    // mirror the left wings onto the right
    for (let y = 0; y < H; y++) for (let x = 0; x < 24; x++) { const c = p.get(x, y); if (c != null) p.set(W - 1 - x, y, c); }
    // body: slender, silver, segmented; head with two big dark eyes
    const SIL = ['#1e2034', '#464c6a', '#7e88a8', '#b8c2dc', '#e8eeff', '#ffffff'];
    const sil = mat('', { ramp: SIL, spec: 0.93, bias: 0.06 });
    const sc = new Scene(W, H);
    sc.tube([[23.5, 18, 1.9, 4], [23.5, 25, 1.6, 4], [23.5, 31, 1, 4], [23.5, 34.5, 0.5, 4]], { m: sil, g: 'abd' });
    sc.ell(23.5, 14.6, 2.3, 3.4, { m: sil, g: 'thorax', z: 5, rz: 2.3 });
    sc.ell(23.5, 10, 2.2, 1.9, { m: sil, g: 'head', z: 6, rz: 2 });
    for (const y of [21, 24, 27, 30]) sc.carve([[22.5, y], [24.5, y]], -1);
    const b = sc.render();
    b.each((x, y, c) => { p.set(x, y, c); return undefined; });
    for (const y of [22, 25, 28]) { p.set(23, y, '#ffffff'); }
    p.set(22, 9, INK); p.set(25, 9, INK); p.set(22, 10, '#4a3a8a'); p.set(25, 10, '#4a3a8a');
    // antennae curling out, tipped with motes of light
    for (const [x, y] of [[22, 8], [21, 7], [20, 6], [19, 5], [18, 4], [17, 3], [16, 3]]) { p.set(x, y, SIL[1]); p.set(W - 1 - x, y, SIL[1]); }
    for (const x of [15, 32]) { p.set(x, 2, '#fff0a0'); p.set(x, 3, '#ffd870'); }
    return finish(p, (q) => {
      for (const x of [15, 32]) { q.set(x, 1, WHITE); q.set(x - 1, 2, '#fff6c0'); q.set(x + 1, 2, '#fff6c0'); }
      // coloured glints of light falling from the panes
      for (const [x, y, c] of [[4, 39, '#f8707a'], [8, 44, '#62acfc'], [19, 41, '#fcdc5c'], [28, 43, '#74e49c'], [39, 39, '#62acfc'], [43, 44, '#fcdc5c'], [34, 46, '#f8707a']]) {
        q.set(x, y, c); q.set(x, y - 1, WHITE);
      }
      sparkle(q, 5, 23, 'star', 'c');
      sparkle(q, 43, 24, 'small', 'y');
      sparkle(q, 24, 3, 'small', 'w');
      sparkle(q, 45, 12, 'dot');
    });
  };

  // ================================================================ rare_acorn
  // どんぐり王子: a plump, glossy acorn on short legs, its scaly cap worn like a
  // beret under a little crown of two leaves on a gold band with a ruby. Bright
  // round eyes, red cheeks, and a twig sceptre topped with a golden acorn. 32x32.
  S.rare_acorn = () => {
    const { Scene, mat, stamp, jewel, sparkle, finish, INK, WHITE, RUBY, GOLD } = kit();
    const W = 32, H = 32;
    const NUT = ['#5a2a12', '#8a4a22', '#b07038', '#c88a4c', '#e0a868', '#f0c890', '#fff0d0'];
    const nut = mat('', { ramp: NUT, spec: 0.93, rim: 3, bias: 0.1 });
    const CAP = ['#2a1a10', '#4a3220', '#6a4a2e', '#806040', '#a08058', '#c4a47a'];
    const cap = mat('', { ramp: CAP, bias: 0.02, tex: (x, y) => ((x + y) % 3 === 0 || (x - y + 99) % 3 === 0 ? -1 : (x + y) % 3 === 1 && (x - y + 99) % 3 === 1 ? 1 : 0) });
    const capRim = mat('', { ramp: CAP, bias: 0.1 });
    const LEAF = ['#1a4418', '#2e7426', '#58a83c', '#70c050', '#a8e07a', '#e0ffc0'];
    const leaf = mat('', { ramp: LEAF, bias: 0.06 });
    const gold = mat('', { ramp: GOLD, spec: 0.9, bias: 0.12 });
    const TWIG = ['#2e1a12', '#54341e', '#7e5632', '#a8804e'];
    const twig = mat('', { ramp: TWIG, bias: 0.05 });
    const shoe = mat('#6a3a24', { n: 4, dark: 0.55, bias: 0.05 });
    const sc = new Scene(W, H);
    // stubby legs and little shoes
    sc.tube([[12.5, 26, 1.8, 0], [12.3, 28.6, 1.5, 0]], { m: nut, g: 'legL' });
    sc.tube([[19.5, 26, 1.8, 0], [19.7, 28.6, 1.5, 0]], { m: nut, g: 'legR' });
    sc.ell(11.6, 29.4, 2.6, 1.3, { m: shoe, g: 'shoeL', z: 3, rz: 1.2 });
    sc.ell(20.4, 29.4, 2.6, 1.3, { m: shoe, g: 'shoeR', z: 3, rz: 1.2 });
    // the nut: round and glossy, a little wider at the bottom
    sc.ell(16, 19.6, 8.8, 8.2, { m: nut, g: 'nut', z: 0, rz: 8 });
    sc.ell(16, 22.4, 8.2, 5.2, { m: nut, g: 'nut', z: 1, rz: 6 });
    // arms: the left one waving, the right one holding the sceptre
    sc.tube([[8, 19.5, 1.6, 4], [5, 20.5, 1.3, 5], [3.6, 18.8, 1.3, 5]], { m: nut, g: 'armL' });
    sc.tube([[23.5, 20, 1.6, 4], [26.5, 19.5, 1.3, 6]], { m: nut, g: 'armR' });
    sc.tube([[27, 25, 0.8, 8], [27.4, 16, 0.8, 8], [27.6, 10.5, 0.7, 8]], { m: twig, g: 'staff' });
    sc.ell(26.8, 19.6, 1.6, 1.4, { m: nut, g: 'hand', z: 9, rz: 1.4 });
    sc.ell(27.6, 8.8, 1.7, 1.9, { m: gold, g: 'knob', z: 9, rz: 1.8 });
    sc.ell(27.6, 7.2, 1.9, 1, { m: gold, g: 'knobcap', z: 10, rz: 1 });
    // the cap: a scaly cupule with a rolled rim, a stem nub on top
    sc.ell(16, 9.8, 9.6, 4.4, { m: cap, g: 'cap', z: 6, rz: 5 });
    sc.tube([[6.8, 11.6, 1.2, 8], [11, 13, 1.3, 9], [16, 13.4, 1.3, 9], [21, 13, 1.3, 9], [25.2, 11.6, 1.2, 8]], { m: capRim, g: 'cap' });
    // crown: a gold band with two upswept leaves and a jewel between them
    sc.tube([[11, 6.2, 1, 12], [16, 5.2, 1.1, 12], [21, 6.2, 1, 12]], { m: gold, g: 'band' });
    sc.tube([[14.6, 5, 1.1, 11], [12, 2.4, 1.6, 11], [9.6, 1.2, 0.3, 11]], { m: leaf, g: 'leafL' });
    sc.tube([[17.4, 5, 1.1, 11], [20, 2.4, 1.6, 11], [22.4, 1.2, 0.3, 11]], { m: leaf, g: 'leafR' });
    sc.carve([[14, 4.4], [11, 2]], 1).carve([[18, 4.4], [21, 2]], 1);
    const p = sc.render({ ground: 0.03 });
    // face: big bright eyes, rosy cheeks, a happy open smile
    const eye = { k: INK, w: WHITE, b: '#3a2a4a', l: '#8a70c0' };
    stamp(p, 10, 16, ['.kk.', 'kwwk', 'kwbk', 'kbbk', 'kblk', '.kk.'], eye);
    stamp(p, 18, 16, ['.kk.', 'kwwk', 'kwbk', 'kbbk', 'kblk', '.kk.'], eye);
    for (const [x, y] of [[8, 22], [9, 22], [22, 22], [23, 22]]) p.set(x, y, '#f06a6a');
    p.set(8, 23, '#e05858'); p.set(23, 23, '#e05858');
    stamp(p, 14, 22, ['kkkk', '.rr.'], { k: '#4a1c14', r: '#e0605a' });
    // gloss on the nut, jewel in the crown, a ruby on the sceptre knob
    for (const [x, y] of [[9, 16], [9, 17], [10, 24]]) p.set(x, y, NUT[6]);
    jewel(p, 16, 4.4, 1.3, 1.5, RUBY, { bezel: GOLD, shape: 'kite' });
    p.set(27, 8, WHITE);
    return finish(p, (q) => {
      sparkle(q, 3, 4, 'star', 'y');
      sparkle(q, 5, 26, 'small', 'y');
      sparkle(q, 30, 3, 'dot');
      sparkle(q, 29, 28, 'dot');
    });
  };

  // ================================================================ rare_icefox
  // 氷尾ギツネ: a white fox sitting side-on, its head turned back over its shoulder
  // to eye the party. Five tails fan out behind it; each turns to clear ice toward
  // the end and finishes in a faceted crystal glowing blue. A pale-blue diamond on
  // the brow, narrow golden eyes, two blue foxfires at its paws. 48x48.
  S.rare_icefox = () => {
    const { Scene, mat, gradMat, stamp, on, jewel, crystal, crystalEdges, sparkle, finish, INK, WHITE, SAPH } = kit();
    const W = 48, H = 48;
    const FUR = ['#343c6c', '#5c68a0', '#8e9cd0', '#b8c6ec', '#dce4fa', '#f0f4ff', '#ffffff'];
    const fur = mat('', { ramp: FUR, rim: 3, bias: 0.12 });
    const furD = mat('', { ramp: FUR, bias: 0.02 });
    const ICEF = ['#2a4a8a', '#4a7ec8', '#7ab8ec', '#a8e0fa', '#d4f6ff', '#f0fcff', '#ffffff'];
    const tail = gradMat([FUR, ICEF], (x, y) => (Math.hypot(x - 30, y - 38) - 14) / 12, { rim: 3, bias: 0.12, dither: 0.18 });
    const ICE = ['#1a3a88', '#2e6cd0', '#50a8f0', '#8ad8ff', '#c8f4ff', '#ffffff'];
    const ice = mat('', { ramp: ICE, contrast: 1.4, bias: 0.02, line: '#14285e' });
    const inner = mat('#a8b8f0', { n: 4, dark: 0.45, bias: 0.1, contrast: 0.7 });
    const nose = mat('#3a3050', { n: 3, dark: 0.4 });
    const sc = new Scene(W, H);
    // the fan of five tails rising behind the body (outer ones furthest back)
    const FAN = [30, 38];
    const TAILS = [[221, 27, -9], [250, 32, -10], [278, 34, -11], [304, 27, -12], [330, 17.5, -13]];
    const tips = [];
    TAILS.forEach(([deg, L, z], i) => {
      const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      // a gentle S along each tail; fluffy tufts on the outer edge sweep back toward the base
      const bend = 2.2;
      const pt = (t, r) => [FAN[0] + ca * L * t - sa * Math.sin(t * Math.PI * 1.2) * bend, FAN[1] + sa * L * t + ca * Math.sin(t * Math.PI * 1.2) * bend, r, z];
      sc.tube([pt(0.14, 2.4), pt(0.38, 4.3), pt(0.6, 4.1), pt(0.78, 2.6)], { m: tail, g: 'tail' + i, steps: 7 });
      for (const [t, side, r] of [[0.3, 1, 4], [0.5, 1, 4.1], [0.66, 1, 3.4], [0.42, -1, 4.1], [0.6, -1, 3.7]]) {
        const q = pt(t, 0), nx = -sa * side, ny = ca * side;
        const x0 = q[0] + nx * (r - 1.4), y0 = q[1] + ny * (r - 1.4);
        sc.tube([[x0, y0, 1.5, z], [x0 + nx * 1.8 - ca * 2.4, y0 + ny * 1.8 - sa * 2.4, 0.3, z]], { m: tail, g: 'tail' + i });
      }
      const b = pt(0.74, 0), t = pt(1.02, 0);
      tips.push(crystal(sc, b[0], b[1], t[0], t[1], 2.2, { m: ice, g: 'tip' + i, z: z + 1, shoulder: 0.45 }));
    });
    // body: sitting side-on facing left, haunch at the back, the far foreleg behind
    sc.tube([[18.5, 36, 1.8, -2], [18.6, 41, 1.4, -2], [18.8, 44.6, 1.3, -2]], { m: furD, g: 'legF' });
    sc.ell(29, 38.5, 8.2, 7.2, { m: fur, g: 'body', z: 0, rz: 7 });
    sc.ell(19.5, 34, 5.2, 7, { m: fur, g: 'body', z: 3, rz: 5.5 });
    sc.ell(31.5, 44.6, 4.6, 1.8, { m: fur, g: 'hind', z: 5, rz: 1.8 });
    sc.tube([[15.5, 37, 2, 7], [15, 41, 1.6, 7], [14.8, 44.6, 1.5, 7]], { m: fur, g: 'legN' });
    sc.ell(14, 45, 2.4, 1.3, { m: fur, g: 'pawN', z: 9, rz: 1.2 });
    sc.ell(19.4, 45, 2.2, 1.2, { m: furD, g: 'pawF', z: 1, rz: 1.1 });
    // ruff of chest fur
    for (const [x0, y0, x1, y1] of [[14.5, 29, 12, 32], [15, 32, 12.6, 35.5]]) sc.tube([[x0, y0, 1.6, 6], [x1, y1, 0.4, 6]], { m: fur, g: 'body' });
    // head turned back over the shoulder: the face toward the viewer, snout to the right
    sc.ell(16.5, 22.5, 6.4, 5.6, { m: fur, g: 'head', z: 8, rz: 6 });
    sc.tube([[19, 25, 3.2, 11], [22, 26.4, 2.1, 12], [23.8, 27, 1.1, 12]], { m: fur, g: 'head' });
    sc.tube([[11, 25, 1.8, 9], [8, 27, 0.4, 9]], { m: fur, g: 'head' });
    sc.tube([[12.5, 19, 2.8, 7], [10.8, 14.5, 1.8, 7], [10, 10.5, 0.4, 7]], { m: fur, g: 'earL' });
    sc.tube([[12.4, 18.4, 1.3, 9], [11.2, 14.8, 0.8, 9], [10.6, 12.4, 0.3, 9]], { m: inner, g: 'innerL', soft: true });
    sc.tube([[18.8, 18.4, 2.8, 7], [20.4, 14, 1.8, 7], [21.2, 10.2, 0.4, 7]], { m: fur, g: 'earR' });
    sc.tube([[18.9, 17.8, 1.3, 9], [20, 14.2, 0.8, 9], [20.6, 12, 0.3, 9]], { m: inner, g: 'innerR', soft: true });
    sc.ell(24, 26.8, 1, 0.9, { m: nose, g: 'nose', z: 14, rz: 1 });
    const p = sc.render({ ground: 0.03 });
    tips.forEach((c) => crystalEdges(p, c, ICE));
    // narrow golden eyes, slanted
    stamp(p, 16, 21, ['kk...', 'kyyyk', '.kbkk'], { k: INK, y: '#f8c840', b: '#8a4a10' });
    p.set(18, 22, '#fff4b0');
    stamp(p, 11, 21, ['k...', 'kyyk', '.kkk'], { k: INK, y: '#e0a830' });
    // mouth line
    p.line(19, 28, 22, 27.8, '#6a70a0');
    // the brow mark: a pale-blue diamond
    jewel(p, 15.6, 18.4, 1.3, 1.8, SAPH.map((c, i) => (i < 2 ? c : SAPH[Math.min(5, i + 1)])), { shape: 'kite' });
    // a faint icy sheen on the tails near the crystals
    for (const c of tips) on(p, c.base[0], c.base[1], '#ffffff');
    return finish(p, (q) => {
      // two blue foxfires at its paws
      const FF = { a: '#1e48a8', b: '#3a86e8', c: '#60c0ff', d: '#b8ecff', w: WHITE };
      stamp(q, 5, 38, ['..a..', '.aba.', '.bcb.', 'abdca', 'bcwdb', '.cdc.', '..b..'], FF);
      stamp(q, 40, 39, ['..a.', '.ab.', 'abcb', 'bdwc', '.cdb', '..b.'], FF);
      sparkle(q, 6, 6, 'star', 'c');
      sparkle(q, 44, 8, 'small', 'c');
      sparkle(q, 34, 27, 'dot');
      sparkle(q, 3, 22, 'dot');
    });
  };

  // ================================================================ rare_lotus
  // はすの精: on a broad lotus pad, inside an open pink lotus, a tiny sprite with
  // green hair sits hugging her knees. A crown of water drops (an aquamarine drop
  // in the middle), leaf-veined wings of light behind her, and beads of water
  // shining along the rim of the pad. 32x32.
  S.rare_lotus = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, WHITE } = kit();
    const W = 32, H = 32;
    const PET = ['#8a2856', '#c8508a', '#f080b0', '#ffa0c8', '#ffc8dc', '#fff0f4', '#ffffff'];
    const petal = mat('', { ramp: PET, bias: 0.1, rim: 3 });
    const petalB = mat('', { ramp: PET, bias: 0.06, line: '#8a2856' });
    const PAD = ['#123a22', '#1e5c34', '#2e7c44', '#50a060', '#7cc47c', '#b4e8a4'];
    const pad = mat('', { ramp: PAD, bias: 0.04, tex: (x, y) => (Math.abs(((Math.atan2(y - 27.4, (x - 16) / 4) * 180) / Math.PI + 360) % 30 - 15) < 1.4 ? 1 : 0) });
    const HAIR = ['#1e5a44', '#38906c', '#5cc090', '#80e0a0', '#b8f4c8', '#eafff2'];
    const hair = mat('', { ramp: HAIR, bias: 0.08, rim: 3 });
    const SKIN = ['#9a6058', '#d08c78', '#f0bca4', '#f8d8c0', '#fff0e4'];
    const skin = mat('', { ramp: SKIN, bias: 0.12, contrast: 0.8 });
    const WING = ['#3a8a8a', '#6ac4c0', '#a8ecdc', '#dcfff4', '#ffffff'];
    const wing = mat('', { ramp: WING, bias: 0.14, contrast: 0.7, flat: true });
    const sc = new Scene(W, H);
    // the pad: a wide, flat round leaf seen at an angle, a notch at the front right
    sc.ell(16, 27.4, 15, 3.6, { m: pad, g: 'pad', z: -10, rz: 1.4 });
    sc.cut((x, y) => y > 27 && x > 20 && x < 24 && y - 27 > (x - 20) * 0.4 && y - 27 > (24 - x) * 0.4);
    // wings of light behind her (leaf-shaped, veined), peeking out above the petals
    for (const s0 of [-1, 1]) sc.tube([[16 + s0 * 3, 11, 1.2, -12], [16 + s0 * 7, 7.5, 2.4, -12], [16 + s0 * 10, 5, 1.4, -12], [16 + s0 * 11.5, 3.8, 0.3, -12]], { m: wing, g: 'wing' + s0 });
    // back petals fanned behind the sprite
    const petalAt = (deg, len, wid, z, m, g) => {
      const a = (deg * Math.PI) / 180, bx = 16, by = 25;
      const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
      sc.tube([[bx + Math.cos(a) * 2, by + Math.sin(a) * 2, wid * 0.55, z], [bx + Math.cos(a) * len * 0.55, by + Math.sin(a) * len * 0.55, wid, z], [tx, ty, 0.3, z]], { m, g });
    };
    petalAt(-128, 14.5, 3.2, -6, petalB, 'pb1');
    petalAt(-52, 14.5, 3.2, -6, petalB, 'pb2');
    petalAt(-156, 13, 3, -5, petalB, 'pb3');
    petalAt(-24, 13, 3, -5, petalB, 'pb4');
    petalAt(-90, 15, 2.6, -7, petalB, 'pb0');
    // the sprite: a big chibi head of hair over a round face, a leaf-green shift, and
    // her knees drawn up under her chin with both arms wrapped round them
    const DRESS = ['#1e5a3a', '#2e7c4c', '#4ea464', '#78c880', '#b0e8a8'];
    const dress = mat('', { ramp: DRESS, bias: 0.06 });
    sc.ell(16, 10.6, 6.4, 5.6, { m: hair, g: 'hair', z: 2, rz: 5 });
    sc.tube([[10.6, 11, 2, 3], [9.8, 14.5, 1.7, 3], [10.4, 17.4, 0.7, 3]], { m: hair, g: 'hair' });
    sc.tube([[21.4, 11, 2, 3], [22.2, 14.5, 1.7, 3], [21.6, 17.4, 0.7, 3]], { m: hair, g: 'hair' });
    sc.ell(16, 12.6, 4.6, 3.9, { m: skin, g: 'face', z: 6, rz: 3.6 });
    sc.tube([[11.8, 9.4, 2, 8], [16, 8, 2.3, 8], [20.2, 9.4, 2, 8]], { m: hair, g: 'fringe' });
    sc.ell(16, 19.6, 4.4, 3, { m: dress, g: 'dress', z: 3, rz: 3 });
    sc.ell(14.2, 19.8, 2, 1.9, { m: dress, g: 'knees', z: 6, rz: 1.8 });
    sc.ell(17.8, 19.8, 2, 1.9, { m: dress, g: 'knees', z: 6, rz: 1.8 });
    sc.tube([[11.6, 18.6, 0.8, 7], [12.8, 21, 0.8, 9], [15.2, 21.6, 0.9, 10]], { m: skin, g: 'armL' });
    sc.tube([[20.4, 18.6, 0.8, 7], [19.2, 21, 0.8, 9], [16.8, 21.6, 0.9, 10]], { m: skin, g: 'armR' });
    // front petals cupping her
    petalAt(-176, 10.5, 2.6, 4, petal, 'pf0');
    petalAt(-4, 10.5, 2.6, 4, petal, 'pf1');
    petalAt(-140, 9, 2.8, 8, petal, 'pf2');
    petalAt(-40, 9, 2.8, 8, petal, 'pf3');
    sc.ell(16, 24.6, 5, 2.2, { m: petal, g: 'pf4', z: 10, rz: 2 });
    const p = sc.render({ ground: 0.02, depth: 0.05 });
    // a dotted, see-through look on the wings, and their veins
    p.each((x, y, c) => (WING.includes(c) && (x + y) % 2 === 0 && c !== WING[4] ? WING[Math.min(4, WING.indexOf(c) + 1)] : undefined));
    for (const s0 of [-1, 1]) for (let k = 5; k <= 10; k++) on(p, 16 + s0 * k, Math.round(10.5 - k * 0.55), WING[1]);
    // petal tips blush white
    for (const [x, y] of [[7, 13], [24, 13], [4, 19], [28, 19]]) on(p, x, y, PET[6]);
    // face: big shining eyes, rosy cheeks, a small smile
    const eye = { k: '#1e3a34', g: '#3a9a7a', w: WHITE };
    stamp(p, 12, 12, ['kk', 'wk', 'gk'], eye);
    stamp(p, 19, 12, ['kk', 'wk', 'gk'], eye);
    p.set(11, 12, '#1e3a34'); p.set(21, 12, '#1e3a34');
    for (const x of [11, 12, 20, 21]) p.set(x, 15, '#f4a0a0');
    stamp(p, 15, 15, ['k.k', '.k.'], { k: '#b04860' });
    // the crown of water drops
    jewel(p, 16, 5.8, 1.3, 1.9, ['#0c3a5a', '#1a6a9a', '#3aaad8', '#80e0f8', '#d0faff', '#ffffff'], { shape: 'drop', bezel: ['#1a4a4a', '#3a8a7a', '#78c8b0', '#b8f0e0', '#e8fff8'] });
    for (const x of [13, 19]) { on(p, x, 8, '#b8f4ff'); p.set(x, 7, '#e8ffff'); }
    // beads of water along the rim of the pad
    for (const [x, y] of [[3, 27], [6, 29], [10, 30], [25, 30], [29, 27]]) { if (p.get(x, y) == null) continue; p.set(x, y, '#e0ffff'); p.set(x, y - 1, WHITE); }
    return finish(p, (q) => {
      sparkle(q, 3, 3, 'star', 'c');
      sparkle(q, 28, 2, 'small', 'p');
      sparkle(q, 29, 17, 'dot');
      sparkle(q, 2, 18, 'dot');
    });
  };

  // ================================================================ rare_teapot
  // おばけ茶器: a white porcelain teapot painted with blue flowers, floating. Its
  // lid has lifted a little and two round glowing eyes peer out of the dark gap;
  // steam curls from the spout, gold lines the rims, a sapphire tops the lid, and
  // two cups on their saucers bob in the air beside it. 32x32.
  S.rare_teapot = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, WHITE, SAPH, GOLD } = kit();
    const W = 32, H = 32;
    const POR = ['#5a6280', '#9098b8', '#c8cce0', '#e8eaf2', '#f4f4f0', '#ffffff'];
    const por = mat('', { ramp: POR, spec: 0.93, rim: 2, bias: 0.12, line: '#3a4068' });
    const gold = mat('', { ramp: GOLD.slice(1), spec: 0.9, bias: 0.1 });
    const dark = mat('#1c1430', { n: 3, dark: 0.3, flat: true, line: '#0c0818' });
    const sc = new Scene(W, H);
    // handle loop (behind the body), a slim spout curving up, the round body; the pot
    // hangs in the air well above the ground line
    sc.tube([[21.5, 13, 1, -2], [25, 12.5, 1, -2], [27, 15, 1, -2], [26.2, 18.5, 1, -2], [22.5, 20.1, 0.9, -2]], { m: por, g: 'handle' });
    sc.ell(15, 17.3, 8.4, 6.2, { m: por, g: 'body', z: 0, rz: 7 });
    sc.tube([[8.6, 19, 1.8, 3], [5.6, 17.5, 1.2, 4], [4, 14.5, 1, 4], [3, 11.5, 1, 4], [2, 10.1, 1.2, 4]], { m: por, g: 'spout' });
    sc.ell(15, 23.5, 5.2, 1.4, { m: gold, g: 'foot', z: 3, rz: 1.2 });
    // the dark gap under the lid, lifted clear of the pot, then the lid and its knob
    sc.ell(15, 10.4, 5.6, 2.6, { m: dark, g: 'gap', z: 2, rz: 1 });
    sc.ell(15.4, 6, 5.6, 2.6, { m: por, g: 'lid', z: 6, rz: 2.4 });
    sc.ell(15.4, 7.8, 5.8, 0.9, { m: gold, g: 'lidrim', z: 7, rz: 0.8 });
    // two cups on their saucers bobbing in the air at different heights: one low under
    // the spout, one higher under the handle
    const CUPS = [[5, 27.6, 'cupL'], [27.2, 23.2, 'cupR']];
    for (const [cx, cy, g] of CUPS) {
      sc.ell(cx, cy + 1.9, 3.8, 1, { m: por, g: g + 's', z: 10, rz: 1 });
      sc.ell(cx, cy, 2.4, 1.9, { m: por, g, z: 11, rz: 2 });
      sc.cut((x, y) => sc.isG(x, y, g) && y < cy - 1.2);
    }
    const p = sc.render({ ground: 0.02, depth: 0.08 });
    // blue floral pattern: two flowers on the front, leaves and a band round the shoulder
    const B = '#4060c0', B2 = '#7894e8', B3 = '#2a3a88';
    stamp(p, 10, 16, ['.b.b.', 'bbwbb', '.bwb.', 'bbwbb', '.b.b.'], { b: B, w: B2 });
    stamp(p, 17, 18, ['.b.', 'bwb', '.b.'], { b: B, w: B2 });
    for (const [x, y] of [[15, 18], [16, 19], [14, 20], [13, 21], [20, 17], [21, 16], [9, 20], [19, 21]]) on(p, x, y, B3);
    for (let x = 8; x <= 22; x++) if ((x & 1) === 0) on(p, x, 14, B);
    for (const [x, y] of [[3, 14], [4, 14], [26, 15], [27, 15]]) on(p, x, y, B);
    on(p, 9, 15, WHITE); on(p, 10, 15, WHITE); on(p, 9, 16, POR[4]);
    // two round glowing eyes peeping out of the dark gap
    // (warm ghost-light, 3x2 each, filling the two rows of the gap so they read at 1x)
    const EYE = ['yWy', 'oko'];
    const EP = { y: '#ffe890', W: '#ffffff', o: '#f0b040', k: '#1a1030' };
    stamp(p, 11, 9, EYE, EP);
    stamp(p, 17, 9, EYE, EP);
    // the knob: a sapphire in a gold setting; blue rims on the cups
    jewel(p, 15.4, 2.6, 1.4, 1.4, SAPH, { bezel: GOLD });
    for (const [cx, cy] of CUPS) {
      const x0 = Math.round(cx), y0 = Math.round(cy);
      for (let dx = -2; dx <= 2; dx++) on(p, x0 + dx, y0 - 1, dx === -1 ? B2 : B);
      on(p, x0 - 1, y0, WHITE);
      on(p, x0 + 1, y0 + 1, B3);
    }
    return finish(p, (q) => {
      // steam curling up from the spout
      const ST = ['#e0e8ff', '#ffffff', '#c8d4f0'];
      for (const [x, y, k] of [[3, 8, 0], [2, 7, 0], [2, 6, 2], [3, 5, 0], [4, 4, 1], [5, 4, 0], [6, 5, 2], [6, 6, 0], [5, 6, 2], [4, 2, 0], [3, 1, 2], [7, 1, 0], [8, 2, 1]]) q.set(x, y, ST[k]);
      // tea drips falling from the spout and a ripple of sparkle under the floating pot
      q.set(1, 12, '#c89050'); q.set(1, 14, '#e0b070');
      sparkle(q, 27, 5, 'star', 'y');
      sparkle(q, 20, 29, 'small', 'c');
      sparkle(q, 13, 29, 'dot');
      sparkle(q, 30, 18, 'dot');
      sparkle(q, 11, 31, 'dot');
    });
  };

  // ================================================================ rare_bellsnail
  // 鐘カタツムリ: a snail that carries an old bronze bell instead of a shell, its
  // mouth turned backward so the dark inside and the golden clapper show. The
  // bronze is blotched with verdigris, the body is a pale translucent green, the
  // eye stalks end in gold, and the trail it leaves glitters. 48x48.
  S.rare_bellsnail = () => {
    const { Scene, mat, on, jewel, sparkle, finish, clamp, INK, WHITE, GOLD } = kit();
    const W = 48, H = 48;
    const SN = ['#2e5a40', '#58946a', '#86c08e', '#a8dca8', '#c0e8c0', '#e0fce0', '#ffffff'];
    const body = mat('', { ramp: SN, spec: 0.95, rim: 4, bias: 0.1, contrast: 0.85 });
    const BRZ = ['#2e1a0e', '#5a361a', '#88582a', '#b08040', '#cfa45c', '#ecd08a', '#fff2c4'];
    const PAT = ['#163a34', '#2e6a5a', '#4e9480', '#72b89c', '#a4dcc4', '#d8fff0'];
    // verdigris blotches (value noise) over the bronze, sharing its light steps
    const blot = (x, y) => {
      const h = (a, b) => { let v = (a * 374761393 + b * 668265263) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
      const X = x / 4, Y = y / 4, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
      const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
    const bell = mat('', { ramp: BRZ, spec: 0.93, bias: -0.04, contrast: 1.15, rim: 4, col: (k, x, y) => (blot(x, y) > 0.62 && k < 6 ? PAT[clamp(k - 1, 0, 5)] : BRZ[k]) });
    const band = mat('', { ramp: BRZ, spec: 0.88, bias: 0.16 });
    const sc = new Scene(W, H);
    // the foot: a long soft body along the ground, head raised at the front
    sc.tube([[42, 44, 1.6, 0], [36, 42.8, 3.4, 0], [26, 41.6, 4.6, 0], [16, 41.4, 4.4, 1], [10, 39.4, 3.6, 3], [7, 34, 3, 5], [7.4, 29.6, 3.4, 6]], { m: body, g: 'body', steps: 7 });
    sc.ell(7.6, 28.8, 3.8, 3.4, { m: body, g: 'body', z: 7, rz: 3.4 });
    // eye stalks (gold-tipped) and two short feelers
    sc.tube([[6.2, 26.6, 1.1, 8], [4.4, 22.6, 0.8, 8], [3.2, 19.4, 0.7, 8]], { m: body, g: 'stalkL' });
    sc.tube([[9.2, 26.6, 1.1, 9], [11, 22.4, 0.8, 9], [12.4, 19.2, 0.7, 9]], { m: body, g: 'stalkR' });
    sc.tube([[5.4, 31, 0.8, 9], [3.2, 32.8, 0.4, 9]], { m: body, g: 'feelL' });
    sc.tube([[9.4, 31.4, 0.8, 10], [11.4, 33.2, 0.4, 10]], { m: body, g: 'feelR' });
    // the bell on its back: crown forward and up, mouth turned back and down
    const C = [18.5, 12.5], L = [33.5, 30];
    const dx = L[0] - C[0], dy = L[1] - C[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const along = (t, r, z) => [C[0] + dx * t, C[1] + dy * t, r, z];
    sc.tube([along(0, 3.6, 6), along(0.3, 5, 6), along(0.62, 6.6, 6), along(0.88, 8.8, 6), along(1, 9.8, 6)], { m: bell, g: 'bell', steps: 6, k: 2 });
    sc.tube([[C[0] - ux * 1.2 + nx * 1.4, C[1] - uy * 1.2 + ny * 1.4, 0.9, 12], [C[0] - ux * 3.2, C[1] - uy * 3.2, 1.1, 12], [C[0] - ux * 1.2 - nx * 1.4, C[1] - uy * 1.2 - ny * 1.4, 0.9, 12]], { m: band, g: 'canon' });
    const p = sc.render({ ground: 0.02, depth: 0.1 });
    // raised rings round the bell's waist and lip
    for (const [t, r] of [[0.28, 5.1], [0.84, 8.6]]) {
      const cx = C[0] + dx * t, cy = C[1] + dy * t;
      for (let s = -r; s <= r; s += 0.5) {
        const x = cx + nx * s, y = cy + ny * s;
        on(p, x, y, s < -r * 0.2 ? BRZ[5] : BRZ[4]);
        on(p, x + ux, y + uy, BRZ[1]);
      }
    }
    // the mouth: a dark rim-lit ellipse seen at an angle, the golden clapper inside
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - L[0], py = y - L[1];
      const u = (px * nx + py * ny) / 9.6, v = (px * ux + py * uy) / 3.8;
      const d = u * u + v * v;
      if (d > 1) continue;
      p.set(x, y, d > 0.72 ? (u < 0 ? BRZ[5] : BRZ[3]) : d > 0.5 ? '#2a1608' : '#140a06');
    }
    jewel(p, L[0] - ux * 0.6 + nx * 0.8, L[1] - uy * 0.6 + ny * 0.8, 1.8, 1.8, GOLD);
    // the see-through body: a paler core line and a few glints
    for (let x = 12; x <= 38; x += 1) { const y = Math.round(40 + (x > 26 ? (x - 26) * 0.1 : 0)); if (p.get(x, y) && (x & 1)) p.set(x, y, SN[5]); }
    for (const [x, y] of [[8, 26], [6, 33], [15, 38], [22, 38]]) on(p, x, y, WHITE);
    // eyes: gold beads on the stalks, a sleepy little mouth
    jewel(p, 3, 18.4, 1.3, 1.3, GOLD);
    jewel(p, 12.6, 18.2, 1.3, 1.3, GOLD);
    p.set(8, 31, INK); p.set(9, 31, INK); p.set(7, 30, INK);
    return finish(p, (q) => {
      // the glittering trail behind it
      for (let x = 30; x <= 47; x++) { q.set(x, 46, (x % 5 === 0 ? WHITE : '#e0fff0')); if (x % 3 === 0) q.set(x, 45, '#c8f4e0'); }
      sparkle(q, 44, 42, 'small', 'c');
      sparkle(q, 36, 7, 'star', 'y');
      sparkle(q, 44, 18, 'small', 'y');
      sparkle(q, 16, 4, 'dot');
      sparkle(q, 2, 12, 'dot');
    });
  };

  // ================================================================ rare_hermit
  // 財宝ヤドカリ: a red hermit crab living in a great golden goblet set with rubies
  // and sapphires. The goblet lies tilted on its back, mouth up, heaped with gold
  // coins that spill over the lip; a pearl necklace hangs down its side, and one
  // raised claw pinches a gold coin, ready to throw. 48x48.
  S.rare_hermit = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, INK, WHITE, GOLD, RUBY, SAPH } = kit();
    const W = 48, H = 48;
    const gold = mat('', { ramp: GOLD, spec: 0.9, rim: 5, bias: 0.06, contrast: 1.15 });
    const goldD = mat('', { ramp: GOLD, spec: 0.94, bias: -0.04 });
    const RED = ['#3e0c08', '#761c10', '#b0361c', '#d05030', '#ec7a4c', '#ffb888'];
    const shell = mat('', { ramp: RED, spec: 0.95, rim: 4, bias: 0.08 });
    const leg = mat('', { ramp: RED, bias: 0.02 });
    const sc = new Scene(W, H);
    // far legs (behind), then the goblet: foot and stem jutting back, the round bowl
    for (const [x0, y0, x1, y1, x2, y2] of [[24, 36, 29, 38, 31, 45.6], [21, 37, 24, 40, 25, 45.6]]) sc.tube([[x0, y0, 1.4, -6], [x1, y1, 1.2, -6], [x2, y2, 0.7, -6]], { m: leg, g: 'legB' + x0 });
    sc.tube([[31, 29.5, 2.2, -2], [36, 33, 1.7, -2], [38.6, 35, 1.8, -2]], { m: goldD, g: 'stem' });
    sc.ell(38.8, 35.4, 1.9, 2.2, { m: goldD, g: 'stem', z: -1, rz: 2 });
    sc.ell(41.5, 37.6, 3.2, 5, { m: goldD, g: 'foot', z: -3, rz: 1.6 });
    sc.ell(27.5, 22.5, 11, 9.4, { m: gold, g: 'bowl', z: 0, rz: 9 });
    // the mouth of the goblet faces up and to the left: slice the bowl along the rim plane
    const RC = [22, 15.5], RU = [0.8, -0.6], RN = [-0.6, -0.8];
    sc.cut((x, y) => (x - RC[0]) * RN[0] + (y - RC[1]) * RN[1] > 0 && sc.isG(x, y, 'bowl'));
    // the crab: carapace under the lip of the goblet, legs, eye stalks, big claws
    sc.ell(15.5, 32.5, 6.4, 4.6, { m: shell, g: 'crab', z: 8, rz: 4.6 });
    for (const [x0, y0, x1, y1, x2, y2, z] of [[11, 35, 7, 37.5, 5.5, 45.6, 9], [14, 36.5, 11.5, 40, 11, 45.6, 10], [18, 36.5, 18.5, 40.5, 18.5, 45.6, 10]]) sc.tube([[x0, y0, 1.5, z], [x1, y1, 1.3, z], [x2, y2, 0.7, z]], { m: leg, g: 'leg' + x0 });
    sc.tube([[13.5, 29, 0.9, 10], [12.4, 25.4, 0.8, 10]], { m: shell, g: 'stalkL' });
    sc.tube([[17, 28.6, 0.9, 10], [18, 25, 0.8, 10]], { m: shell, g: 'stalkR' });
    sc.ell(12.3, 24.8, 1.5, 1.5, { m: shell, g: 'eyeL', z: 11, rz: 1.4 });
    sc.ell(18.1, 24.4, 1.5, 1.5, { m: shell, g: 'eyeR', z: 11, rz: 1.4 });
    // the raised claw (holding a coin) and the smaller resting claw
    sc.tube([[10.5, 32, 1.8, 11], [7, 29.5, 1.8, 12], [5.6, 26, 2.2, 12]], { m: shell, g: 'armL' });
    sc.ell(5, 23.4, 3, 3.4, { m: shell, g: 'clawL', z: 13, rz: 3 });
    sc.tube([[3.4, 21.6, 1.4, 14], [2.6, 17.6, 0.6, 14]], { m: shell, g: 'clawL' });
    sc.tube([[6.4, 21, 1.1, 14], [7.2, 17.4, 0.5, 14]], { m: shell, g: 'pinch' });
    sc.tube([[20.5, 34.5, 1.6, 12], [23.5, 37.5, 1.5, 12]], { m: shell, g: 'armR' });
    sc.ell(25.4, 38.6, 2.8, 2.2, { m: shell, g: 'clawR', z: 13, rz: 2.2 });
    sc.tube([[27.2, 37.6, 1, 14], [29.4, 36.8, 0.4, 14]], { m: shell, g: 'clawR' });
    const p = sc.render({ ground: 0.03, depth: 0.1 });
    // the mouth: a dark inside, a bright gold lip, and a heap of coins piled above it
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - RC[0], py = y - RC[1];
      const u = (px * RU[0] + py * RU[1]) / 10.2, v = (px * RN[0] + py * RN[1]) / 3.2;
      const d = u * u + v * v;
      if (d <= 1) p.set(x, y, d > 0.66 ? (v > 0 ? GOLD[6] : GOLD[4]) : '#4a2208');
    }
    const COIN = ['.eee.', 'eWCce', 'eCccd', '.ddd.'];
    for (let k = 3; k >= 0; k--) {
      const n = 5 - k;
      for (let j = 0; j < n; j++) {
        const t = (j - (n - 1) / 2) * 4.1 + (k & 1 ? 0.6 : 0);
        const x = RC[0] + RU[0] * t + RN[0] * (1.2 + k * 2.4), y = RC[1] + RU[1] * t + RN[1] * (1.2 + k * 2.4);
        const hi = (j + k) % 3 === 0;
        stamp(p, Math.round(x) - 2, Math.round(y) - 1, COIN, { e: GOLD[1], W: hi ? WHITE : GOLD[6], C: GOLD[5], c: GOLD[4], d: GOLD[2] });
      }
    }
    // jewels set in the bowl, a gold band with rivets round its belly
    for (let t = -1; t <= 1; t += 0.05) { const x = 27.5 + t * 10, y = 24 + (1 - t * t) * 3.5 - t * 3; on(p, x, y, GOLD[2]); on(p, x, y - 1, GOLD[5]); }
    jewel(p, 27, 26, 2.2, 2, RUBY, { bezel: GOLD.slice(1) });
    jewel(p, 34.5, 21, 1.6, 1.8, SAPH, { bezel: GOLD.slice(1) });
    jewel(p, 20, 27.6, 1.3, 1.3, SAPH);
    jewel(p, 37, 28, 1.2, 1.2, RUBY);
    // a pearl necklace hanging over the lip and down the side
    for (let t = 0; t <= 1; t += 0.085) {
      const x = 30 + t * 7 - Math.sin(t * Math.PI) * 1.5, y = 12 + t * 14 + Math.sin(t * Math.PI) * 3;
      stamp(p, Math.round(x), Math.round(y), ['wp', 'pd'], { w: WHITE, p: '#f8f0f0', d: '#c8b8c8' });
    }
    // a gold coin in the raised claw
    stamp(p, 3, 15, ['.cc.', 'cCWc', 'cCCc', '.dd.'], { c: GOLD[4], C: GOLD[5], W: WHITE, d: GOLD[2] });
    // eyes and a mouth
    stamp(p, 11, 24, ['kk', 'kk'], { k: INK }); stamp(p, 17, 23, ['kk', 'kk'], { k: INK });
    p.set(11, 24, WHITE); p.set(17, 23, WHITE);
    stamp(p, 14, 33, ['k..k', '.kk.'], { k: '#4a1008' });
    return finish(p, (q) => {
      // a coin tumbling off the heap, two more on the ground
      stamp(q, 32, 6, ['.c.', 'cWc', '.d.'], { c: GOLD[4], W: WHITE, d: GOLD[2] });
      for (const [x, y] of [[1, 44], [35, 45]]) stamp(q, x, y, ['.cc.', 'cWCc', '.dd.'], { c: GOLD[4], W: WHITE, C: GOLD[5], d: GOLD[2] });
      sparkle(q, 26, 3, 'star', 'y');
      sparkle(q, 44, 16, 'small', 'y');
      sparkle(q, 9, 8, 'small', 'w');
      sparkle(q, 45, 30, 'dot');
      sparkle(q, 3, 36, 'dot');
    });
  };

  // ================================================================ rare_hedgehog
  // 宝石ハリネズミ: a round hedgehog standing up with its front paws raised, every
  // spine a long faceted gem (ruby, sapphire, emerald, amethyst, clear quartz)
  // fanned round its back like a crown, each with a white point of light at the
  // tip. Round black eyes, a little button nose, a cream belly. 32x32.
  S.rare_hedgehog = () => {
    const { Scene, mat, stamp, on, sparkle, finish, INK, WHITE } = kit();
    const W = 32, H = 32;
    const FUR = ['#4a2e20', '#7a563c', '#a8805c', '#c8a080', '#e0c4a4', '#f6e8d2'];
    const fur = mat('', { ramp: FUR, rim: 3, bias: 0.08 });
    const BELLY = ['#a88c70', '#d0b89c', '#f0e0c8', '#fcf4e6', '#ffffff'];
    const belly = mat('', { ramp: BELLY, bias: 0.1, contrast: 0.8 });
    // gem ramps dark → light: ruby, sapphire, emerald, amethyst, clear quartz
    const GEMS = [
      ['#4a0818', '#a8183a', '#ff4060', '#ff9aa8'],
      ['#0a1e5a', '#1c58c0', '#40a0ff', '#a8dcff'],
      ['#083e26', '#169450', '#40e080', '#b0fcd0'],
      ['#320856', '#7a24c0', '#c060ff', '#e8bcff'],
      ['#3a5470', '#86aed0', '#d0f0ff', '#f4fcff'],
    ];
    const p = G().pix(W, H);
    const owner = new Int16Array(W * H).fill(-1);
    /**
     * One faceted gem spine from its root (bx,by) to its tip: widest a third of the way,
     * a lit left facet, a mid ridge, a dark right facet, dark seams where it crosses an
     * earlier spine, and a white point of light at the tip.
     */
    const spine = (k, bx, by, tx, ty, w, rmp) => {
      const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
      for (let y = Math.floor(Math.min(by, ty) - w - 1); y <= Math.ceil(Math.max(by, ty) + w + 1); y++) for (let x = Math.floor(Math.min(bx, tx) - w - 1); x <= Math.ceil(Math.max(bx, tx) + w + 1); x++) {
        const px = x - bx, py = y - by, t = (px * ux + py * uy) / L, sd = px * nx + py * ny;
        if (t < 0 || t > 1) continue;
        const hw = w * (t < 0.3 ? 0.75 + t / 1.2 : Math.pow((1 - t) / 0.7, 0.8)) + 0.2;
        if (Math.abs(sd) > hw) continue;
        const q = sd / hw, i = y * W + x;
        const seam = Math.abs(q) > 0.62 && owner[i] >= 0 && owner[i] !== k;
        const c = seam ? rmp[0] : t > 0.9 ? rmp[3] : q < -0.25 ? rmp[3] : q < 0.3 ? rmp[2] : rmp[1];
        if (x >= 0 && y >= 0 && x < W && y < H) { p.set(x, y, c); owner[i] = k; }
      }
      p.set(Math.round(tx), Math.round(ty), WHITE);
    };
    // the spiny back behind the gems: a dark brown hood round the head
    const back = new Scene(W, H);
    back.ell(16, 18.5, 10.5, 9, { m: mat('', { ramp: FUR, bias: -0.18, contrast: 0.8 }), g: 'back', z: 0, rz: 8 });
    back.render({ ground: 0 }).each((x, y, c) => { p.set(x, y, c); return undefined; });
    for (let y = 9; y <= 27; y++) for (let x = 5; x <= 27; x++) if (p.get(x, y) && (x * 3 + y * 5) % 7 === 0) p.set(x, y, FUR[0]);
    // the fan: long gems behind, shorter ones between them, colours never side by side
    let k = 0;
    for (const [N, d0, span, long, w, c0] of [[7, 176, 188, 15.6, 2.1, 0], [6, 192, 156, 12.4, 1.8, 3]]) for (let i = 0; i < N; i++) {
      const a = ((d0 + (i * span) / (N - 1)) * Math.PI) / 180;
      spine(k++, 16 + Math.cos(a) * 4.5, 21 + Math.sin(a) * 4.5, 16 + Math.cos(a) * long, 21 + Math.sin(a) * long * 0.97, w, GEMS[(i * 2 + c0) % 5]);
    }
    // body, belly, face; feet and raised paws, drawn over the roots of the spines
    const sc = new Scene(W, H);
    sc.ell(12.6, 28.6, 2.6, 1.4, { m: fur, g: 'footL', z: 2, rz: 1.2 });
    sc.ell(19.4, 28.6, 2.6, 1.4, { m: fur, g: 'footR', z: 2, rz: 1.2 });
    sc.ell(16, 22.4, 6.8, 6.4, { m: fur, g: 'body', z: 0, rz: 6.5 });
    sc.ell(16, 24, 4.4, 4.2, { m: belly, g: 'belly', z: 5, rz: 4, soft: true });
    sc.ell(16, 17.6, 4.8, 3.9, { m: belly, g: 'face', z: 6, rz: 4 });
    sc.ell(16, 19.6, 2.3, 1.7, { m: belly, g: 'face', z: 9, rz: 2 });
    sc.ell(11.6, 14.2, 1.6, 1.5, { m: fur, g: 'earL', z: 3, rz: 1.4 });
    sc.ell(20.4, 14.2, 1.6, 1.5, { m: fur, g: 'earR', z: 3, rz: 1.4 });
    sc.tube([[11, 23.5, 1.4, 8], [9.8, 20.8, 1.3, 9]], { m: fur, g: 'pawL' });
    sc.tube([[21, 23.5, 1.4, 8], [22.2, 20.8, 1.3, 9]], { m: fur, g: 'pawR' });
    const body = sc.render({ ground: 0.03, depth: 0.06 });
    // a dark contour where the body meets the spines, then the body on top
    body.each((x, y) => {
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (body.get(x + ax, y + ay) == null && p.get(x + ax, y + ay) != null) { p.set(x + ax, y + ay, '#1c1224'); }
      return undefined;
    });
    body.each((x, y, c) => { p.set(x, y, c); return undefined; });
    // round black eyes with a shine, a button nose, blush
    stamp(p, 12, 16, ['.k.', 'kwk', 'kkk'], { k: INK, w: WHITE });
    stamp(p, 18, 16, ['.k.', 'kwk', 'kkk'], { k: INK, w: WHITE });
    stamp(p, 15, 19, ['kk', 'kk'], { k: '#2a1a22' });
    p.set(15, 19, '#6a5060');
    on(p, 11, 20, '#f0a0a0'); on(p, 21, 20, '#f0a0a0');
    // little claws on the raised paws
    for (const x of [9, 22]) { on(p, x, 19, '#fff4e8'); on(p, x + (x < 16 ? 1 : -1), 19, '#fff4e8'); }
    return finish(p, (q) => {
      sparkle(q, 3, 5, 'star', 'w');
      sparkle(q, 29, 8, 'small', 'p');
      sparkle(q, 28, 26, 'dot');
      sparkle(q, 3, 26, 'dot');
    });
  };

  // ================================================================ rare_monkey
  // 湯けむり猿: a red-faced monkey soaking in a wooden tub bound with brass hoops,
  // a white towel folded on its head, eyes narrowed in bliss, one hand holding up
  // an onsen egg. Hot water brims over the rim, steam curls up in wisps and a
  // little rainbow shows in the steam. 48x48.
  S.rare_monkey = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, INK, WHITE, GOLD, RUBY } = kit();
    const W = 48, H = 48;
    const FUR = ['#4a3020', '#7a5a40', '#a08060', '#c0a080', '#dcc4a4', '#f4e6d0'];
    const fur = mat('', { ramp: FUR, rim: 3, bias: 0.06, tex: (x, y) => ((x * 3 + y * 5) % 11 === 0 ? -1 : 0) });
    const FACE = ['#7a2418', '#b8402e', '#e0604c', '#f07060', '#f8a088', '#ffd0b8'];
    const face = mat('', { ramp: FACE, bias: 0.1, contrast: 0.8 });
    const WOOD = ['#3a2210', '#5e3a1c', '#80542c', '#a07040', '#c09058', '#dcb47c'];
    const wood = mat('', { ramp: WOOD, bias: 0.02, tex: (x) => (x % 4 === 0 ? -1 : x % 4 === 1 ? 1 : 0) });
    const hoop = mat('', { ramp: GOLD, spec: 0.88, bias: 0.1 });
    const TOW = ['#8890b0', '#b8c0d8', '#e0e4f0', '#f8f8fc', '#ffffff'];
    const towel = mat('', { ramp: TOW, bias: 0.12, contrast: 0.8 });
    const EGG = ['#a09078', '#d0c4ac', '#f0e8d8', '#fcf8f0', '#ffffff'];
    const egg = mat('', { ramp: EGG, spec: 0.92, bias: 0.1 });
    const WAT = ['#2a6090', '#4a8cc0', '#80c0e0', '#b0e0f4', '#e0f8ff'];
    const water = mat('', { ramp: WAT, flat: true, bias: 0.05 });
    const sc = new Scene(W, H);
    // the monkey: shoulders and chest above the water, head, ears
    sc.ell(24, 28, 10, 6.5, { m: fur, g: 'body', z: 0, rz: 6 });
    sc.ell(15.2, 17.5, 2.6, 2.8, { m: fur, g: 'earL', z: 2, rz: 2 });
    sc.ell(32.8, 17.5, 2.6, 2.8, { m: fur, g: 'earR', z: 2, rz: 2 });
    sc.ell(24, 17, 8, 7, { m: fur, g: 'head', z: 4, rz: 7 });
    sc.ell(24, 19, 5.6, 4.8, { m: face, g: 'face', z: 9, rz: 4.5, soft: true });
    sc.ell(24, 21.4, 3.4, 2.2, { m: face, g: 'muzzle', z: 12, rz: 2.2, soft: true });
    // the towel folded on its head
    sc.poly([[17.5, 11], [30.5, 11], [31, 8.5], [28, 7.4], [20, 7.4], [17, 8.5]], { m: towel, g: 'towel', z: 12, bevel: 1.6 });
    // the tub: rim, water, staves and brass hoops
    sc.ell(24, 30.5, 17, 4.2, { m: wood, g: 'rim', z: 6, rz: 2 });
    sc.ell(24, 30.2, 15, 3.1, { m: water, g: 'water', z: 7.5, rz: 0.6 });
    sc.cut((x, y) => sc.isG(x, y, 'body') && y > 30);
    sc.poly([[7, 31], [41, 31], [39.5, 45.6], [8.5, 45.6]], { m: wood, g: 'tub', z: 8, bevel: 3, n: [0, 0.1, 1] });
    for (const y of [35, 42]) sc.tube([[7.6, y - 0.2, 1, 12], [24, y + 1.2, 1, 13], [40.4, y - 0.2, 1, 12]], { m: hoop, g: 'hoop' + y });
    // arms: the left one resting on the rim, the right one holding up an egg
    sc.tube([[15.5, 26, 2.4, 6], [11.5, 29, 2.2, 10], [9, 29.6, 2, 11]], { m: fur, g: 'armL' });
    sc.tube([[31.5, 25.5, 2.4, 6], [35.5, 22, 2, 8], [37, 17.5, 1.9, 8]], { m: fur, g: 'armR' });
    sc.ell(37.4, 13.6, 2.6, 3.2, { m: egg, g: 'egg', z: 10, rz: 2.6 });
    sc.ell(37.2, 16.8, 2.2, 1.7, { m: fur, g: 'hand', z: 11, rz: 1.6 });
    const p = sc.render({ ground: 0.02, depth: 0.08 });
    // narrowed, blissful eyes, blush, a contented smile
    stamp(p, 19, 17, ['.kk.', 'k..k'], { k: INK });
    stamp(p, 25, 17, ['.kk.', 'k..k'], { k: INK });
    for (const [x, y] of [[19, 20], [20, 20], [28, 20], [29, 20]]) on(p, x, y, '#ff90a0');
    stamp(p, 22, 22, ['k...k', '.kkk.'], { k: '#5a1a14' });
    p.set(23, 21, '#8a3020'); p.set(24, 21, '#8a3020');
    // towel folds; ripples and light on the water; hoop rivets; water brimming over the rim
    for (const x of [21, 25, 29]) on(p, x, 9, TOW[1]);
    for (const [x, y] of [[12, 30], [14, 29], [33, 29], [35, 30], [18, 31], [30, 31]]) on(p, x, y, WAT[4]);
    for (const [x, y] of [[13, 30], [34, 30]]) on(p, x, y, WHITE);
    for (const y of [35, 42]) for (const x of [10, 17, 24, 31, 38]) on(p, x, y + (x === 24 ? 1 : 0), GOLD[6]);
    for (const [x, y0, n] of [[9, 32, 5], [16, 33, 3], [36, 32, 6], [30, 33, 2]]) for (let k = 0; k < n; k++) on(p, x, y0 + k, k === n - 1 ? WAT[4] : WAT[3]);
    // a ruby pin in the towel, the egg's shine
    jewel(p, 29, 8.6, 1.1, 1.1, RUBY);
    on(p, 36, 12, WHITE); on(p, 36, 13, EGG[4]);
    return finish(p, (q) => {
      // wisps of steam, and a little rainbow in the steam at the top left
      const ST = ['#e8eef8', '#ffffff', '#d0dae8'];
      for (const [x, y, k] of [[6, 26, 0], [5, 25, 2], [5, 24, 0], [6, 23, 1], [7, 22, 0], [7, 21, 2], [6, 20, 0], [5, 19, 0], [5, 18, 2], [6, 17, 1],
        [42, 26, 0], [43, 25, 2], [43, 24, 0], [42, 23, 1], [41, 22, 0], [41, 21, 2], [42, 20, 0], [43, 19, 1], [43, 18, 0],
        [12, 16, 0], [11, 15, 2], [11, 14, 0], [12, 13, 1], [13, 12, 0]]) q.set(x, y, ST[k]);
      // three neat bands: each pixel of the upper half-ring takes the band of its radius
      for (let y = 3; y <= 10; y++) for (let x = 2; x <= 17; x++) {
        const r = Math.hypot((x - 9.5) / 1.25, y - 10.5);
        if (y > 10 || r < 3.6 || r >= 6.6) continue;
        q.set(x, y, ['#b8a4ff', '#8cd8ff', '#9cf09c', '#ffe080', '#ff9c9c'][Math.min(4, Math.floor((r - 3.6) / 0.6))]);
      }
      sparkle(q, 44, 6, 'star', 'y');
      sparkle(q, 3, 36, 'small', 'c');
      sparkle(q, 45, 34, 'dot');
      sparkle(q, 20, 3, 'dot');
    });
  };

  // ================================================================ rare_turtle
  // 火山ガメ: a tortoise whose shell is a little volcano of dark rock. The crater at
  // the top glows red, a thin plume of smoke rises from it, veins of lava run down
  // the slopes and ruby crystals glint in the cracks. It stretches its neck out
  // toward the viewer on four stout legs. 48x48.
  S.rare_turtle = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, hash, INK, WHITE, RUBY } = kit();
    const W = 48, H = 48;
    const ROCK = ['#1e1418', '#34282a', '#504040', '#6a5854', '#8a7870', '#b0a094'];
    const rock = mat('', { ramp: ROCK, rim: 3, bias: 0.04, tex: (x, y) => (hash(x >> 1, y >> 1, 3) < 0.18 ? -1 : hash(x, y, 5) < 0.06 ? 1 : 0) });
    const SKIN = ['#3a2c1c', '#5e4a32', '#807050', '#a09070', '#c8b894', '#ece0c4'];
    const skin = mat('', { ramp: SKIN, rim: 3, bias: 0.06, tex: (x, y) => ((x + y * 2) % 7 === 0 ? -1 : 0) });
    const PLAST = ['#4a3420', '#7a5a34', '#a8844e', '#c8a870', '#e4cc98'];
    const plast = mat('', { ramp: PLAST, bias: 0.04 });
    const claw = mat('#e8dcc8', { n: 4, dark: 0.5 });
    const sc = new Scene(W, H);
    // far legs, then the volcano shell (a rounded cone) with a rim of plastron at its base
    sc.tube([[21, 39, 2.8, -4], [21.5, 42, 2.6, -4], [21.6, 44.6, 2.6, -4]], { m: skin, g: 'legFF' });
    sc.tube([[33, 39, 2.8, -5], [33.5, 42, 2.6, -5], [33.6, 44.6, 2.6, -5]], { m: skin, g: 'legFH' });
    sc.tube([[43, 38, 1.6, -2], [46, 39.5, 0.6, -2]], { m: skin, g: 'tail' });
    sc.ell(27, 32, 17.5, 9.6, { m: rock, g: 'shell', z: 0, rz: 9 });
    sc.tube([[27, 26, 8.6, 4], [27, 21, 6, 4], [27, 16.8, 4.4, 4]], { m: rock, g: 'shell', steps: 6, rzk: 0.8 });
    sc.ell(27, 38.6, 17, 2.8, { m: plast, g: 'plast', z: 6, rz: 2 });
    // near legs, stout, with pale claws
    sc.tube([[15.5, 39, 3.4, 8], [14.6, 42, 3.2, 9], [14.6, 44.4, 3.2, 9]], { m: skin, g: 'legNF' });
    sc.tube([[38, 39, 3.4, 8], [39, 42, 3.2, 9], [39.2, 44.4, 3.2, 9]], { m: skin, g: 'legNH' });
    for (const [fx, z] of [[14.6, 12], [39.2, 12]]) for (const d of [-2, 0, 2]) sc.ell(fx + d, 45.6, 0.9, 0.7, { m: claw, g: 'claw' + fx, z, rz: 0.6 });
    // neck stretched out toward the viewer, head facing front
    sc.tube([[16, 37, 3.6, 7], [12.5, 35, 3.2, 10], [10, 33.5, 3.2, 12]], { m: skin, g: 'head' });
    sc.ell(8.6, 31.6, 5, 4.4, { m: skin, g: 'head', z: 13, rz: 4.4 });
    sc.ell(8.6, 34, 3.4, 2, { m: skin, g: 'head', z: 16, rz: 2 });
    const p = sc.render({ ground: 0.03, depth: 0.08 });
    // the crater: a glowing rim round a pool of lava at the summit
    const LAVA = ['#5a0a08', '#a82010', '#ff6020', '#ffa030', '#ffd040', '#fff4b0'];
    for (let y = 12; y <= 19; y++) for (let x = 20; x <= 34; x++) {
      const d = Math.hypot((x - 27) / 4.4, (y - 15.4) / 1.7);
      if (d > 1) continue;
      p.set(x, y, d > 0.78 ? (x < 27 ? ROCK[4] : ROCK[3]) : d > 0.55 ? LAVA[2] : d > 0.3 ? LAVA[4] : LAVA[5]);
    }
    // veins of lava running down the slopes, brightest near the top
    const vein = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) {
          const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
          if (p.get(x, y) == null) continue;
          p.set(x, y, y < 20 ? LAVA[4] : y < 27 ? LAVA[3] : LAVA[2]);
          on(p, x + 1, y, LAVA[1]);
        }
      }
    };
    vein([[24, 17], [22, 21], [23, 24], [18, 28], [15, 32]]);
    vein([[30, 17], [32, 21], [31, 24], [36, 28], [39, 32]]);
    vein([[27, 18], [27, 22], [26, 26], [28, 30]]);
    // ruby crystals glinting in the cracks
    // hexagonal scutes on the dome, then the ruby crystals glinting in the cracks
    for (const [cx, cy] of [[20, 32], [34, 32], [27, 34], [13, 34], [41, 34]]) {
      for (let a = 0; a < 6; a++) {
        const a0 = (a * Math.PI) / 3, a1 = ((a + 1) * Math.PI) / 3;
        const n = 5;
        for (let k = 0; k <= n; k++) on(p, cx + Math.cos(a0 + ((a1 - a0) * k) / n) * 4.2, cy + Math.sin(a0 + ((a1 - a0) * k) / n) * 2.6, ROCK[1]);
      }
    }
    jewel(p, 20, 27.5, 1.4, 1.6, RUBY, { shape: 'kite' });
    jewel(p, 34.5, 26.5, 1.3, 1.5, RUBY, { shape: 'kite' });
    jewel(p, 27, 33.5, 1.2, 1.4, RUBY, { shape: 'kite' });
    jewel(p, 40, 33, 1.1, 1.2, RUBY);
    jewel(p, 14, 33.5, 1, 1, RUBY);
    // scute rim on the plastron edge
    for (let x = 12; x <= 42; x += 4) { on(p, x, 39, PLAST[0]); on(p, x, 40, PLAST[0]); }
    // face: two round eyes looking at the viewer, a wide beak-like mouth
    stamp(p, 5, 29, ['kk', 'wk'], { k: INK, w: WHITE });
    stamp(p, 10, 29, ['kk', 'kw'], { k: INK, w: WHITE });
    stamp(p, 6, 34, ['kkkkk'], { k: '#2a1c10' });
    p.set(5, 33, '#2a1c10'); p.set(11, 33, '#2a1c10');
    return finish(p, (q) => {
      // a thin plume of smoke with a few embers
      const SM = ['#8a8490', '#aaa4b0', '#cac4d0', '#e8e4ee'];
      for (const [x, y, k] of [[27, 11, 0], [27, 10, 1], [26, 9, 1], [26, 8, 2], [27, 7, 2], [28, 6, 3], [28, 5, 2], [27, 4, 3], [29, 8, 1], [25, 6, 3], [28, 3, 3], [29, 2, 2]]) q.set(x, y, SM[k]);
      for (const [x, y] of [[23, 9], [31, 7], [30, 11]]) q.set(x, y, LAVA[4]);
      sparkle(q, 41, 13, 'star', 'y');
      sparkle(q, 6, 16, 'small', 'p');
      sparkle(q, 45, 26, 'dot');
      sparkle(q, 3, 40, 'dot');
    });
  };

  // ================================================================ rare_sheep
  // 月見ヒツジ: a sheep of cloud-soft white wool drifting in the air, legs dangling.
  // A single golden crescent moon grows from its brow, a little silver bell hangs
  // at its throat, tiny stars twinkle down in the wool, and its dusky night-blue
  // face wears a sleepy, half-closed look. 48x48.
  S.rare_sheep = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, hash, INK, WHITE, GOLD } = kit();
    const W = 48, H = 48;
    const WOOL = ['#5a5a94', '#8a90c8', '#b4bcec', '#d4daf8', '#eceffe', '#f8f8ff', '#ffffff'];
    const wool = mat('', { ramp: WOOL, rim: 3, bias: 0.16, contrast: 0.9 });
    const FACE = ['#1e1c40', '#302e5e', '#46467e', '#5c5e98', '#7e82b8', '#a8acd8'];
    const face = mat('', { ramp: FACE, bias: 0.08 });
    const legm = mat('', { ramp: FACE, bias: -0.02 });
    const horn = mat('', { ramp: GOLD.slice(1), spec: 0.9, bias: 0.16 });
    const BELL = ['#48506a', '#7a8498', '#a8b2c4', '#d0d8e0', '#f0f4f8', '#ffffff'];
    const bell = mat('', { ramp: BELL, spec: 0.9, bias: 0.08 });
    const rib = mat('#6a78d8', { n: 4, dark: 0.5, bias: 0.05 });
    const sc = new Scene(W, H);
    // legs dangling below the fleece
    for (const [x, z] of [[18, -4], [31, -5]]) sc.tube([[x, 36, 1.5, z], [x + 0.3, 41, 1.3, z], [x + 0.2, 44.4, 1.3, z]], { m: legm, g: 'legF' + x });
    for (const [x, z] of [[14, 6], [36, 5]]) sc.tube([[x, 36, 1.6, z], [x - 0.3, 41, 1.4, z], [x - 0.2, 44.6, 1.4, z]], { m: legm, g: 'legN' + x });
    // the fleece: a cloud of overlapping puffs that blend into one another
    for (const [x, y, r] of [[25, 27, 11], [16, 28, 7], [34, 28, 7.5], [20, 19.5, 6.5], [30, 19, 6.5], [38.5, 24, 5], [11, 25, 5], [24, 35, 7], [14, 34, 5], [35, 34.5, 5.5], [25, 16, 5]]) {
      sc.ell(x, y, r, r * 0.92, { m: wool, g: 'wool', z: 0, rz: r, k: 3 });
    }
    // the face at the front left, floppy ears, a tuft of wool on the crown
    sc.tube([[9.5, 22, 1.8, 7], [5.6, 23.6, 1.6, 7], [3.4, 24.8, 0.8, 7]], { m: face, g: 'earL' });
    sc.tube([[21, 22, 1.8, 7], [24.6, 23.4, 1.6, 7], [26.6, 24.6, 0.8, 7]], { m: face, g: 'earR' });
    sc.ell(15.4, 25, 5.4, 5.6, { m: face, g: 'face', z: 10, rz: 5 });
    sc.ell(15.4, 28.8, 3.4, 2.4, { m: face, g: 'face', z: 13, rz: 2.4 });
    for (const [x, y, r] of [[12.6, 19.4, 2.6], [15.4, 18.4, 3], [18.2, 19.4, 2.6]]) sc.ell(x, y, r, r * 0.9, { m: wool, g: 'tuft', z: 14, rz: r });
    // the crescent-moon horn rising from the brow
    const hornPts = [];
    for (let t = 0; t <= 1; t += 0.1) { const a = Math.PI * (0.75 + t * 0.9); hornPts.push([15.6 + Math.cos(a) * 5.4 + 3.6, 12 + Math.sin(a) * 5.4 + 1.2, 0.5 + Math.sin(t * Math.PI) * 1.8, 16]); }
    sc.tube(hornPts, { m: horn, g: 'horn', steps: 3 });
    // a silver bell on a blue ribbon at the throat
    sc.tube([[12, 31.6, 0.9, 14], [15.4, 32.6, 0.9, 15], [19, 31.6, 0.9, 14]], { m: rib, g: 'ribbon' });
    sc.ell(15.4, 34.4, 2, 2, { m: bell, g: 'bell', z: 16, rz: 2 });
    const p = sc.render({ ground: 0.02, depth: 0.08 });
    // small stars twinkling down in the wool
    const woolSet = new Set(WOOL);
    for (const [x, y] of [[28, 13], [36, 19], [30, 25], [40, 28], [23, 30], [33, 36], [26, 40], [8, 30], [20, 36], [37, 32]]) {
      if (!woolSet.has(p.get(x, y))) continue;
      p.set(x, y, WHITE);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (woolSet.has(p.get(x + dx, y + dy))) p.set(x + dx, y + dy, '#fff0a8');
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash(i, 3, 7) * W), y = Math.floor(hash(i, 4, 7) * 40);
      if (woolSet.has(p.get(x, y)) && p.get(x, y) !== WOOL[0]) p.set(x, y, '#fff8c0');
    }
    // sleepy half-closed eyes, a soft nose and mouth
    stamp(p, 11, 24, ['kkk', '.ll'], { k: INK, l: FACE[4] });
    stamp(p, 17, 24, ['kkk', 'll.'], { k: INK, l: FACE[4] });
    p.set(11, 23, FACE[4]); p.set(19, 23, FACE[4]);
    stamp(p, 14, 28, ['k.k', '.k.'], { k: FACE[0] });
    on(p, 10, 27, '#b890c8'); on(p, 20, 27, '#b890c8');
    // the bell's clapper slot and shine; a glint on the horn
    p.set(15, 35, BELL[0]); p.set(16, 35, BELL[0]); p.set(14, 33, WHITE);
    jewel(p, 22.6, 7.4, 0.9, 0.9, ['#806020', '#c09030', '#f0d060', '#fff4b0', '#ffffff']);
    return finish(p, (q) => {
      sparkle(q, 5, 8, 'star', 'y');
      sparkle(q, 42, 8, 'small', 'c');
      sparkle(q, 44, 40, 'dot');
      sparkle(q, 3, 40, 'small', 'y');
      sparkle(q, 30, 3, 'dot');
    });
  };

  // ================================================================ rare_clockbird
  // ぜんまい鳥: a little clockwork bird of brass. A clock face on its breast, a
  // big steel winding key in its back, wings of overlapping thin brass plates,
  // red glass-bead eyes, a fan tail of plates, and a cog or two whirling loose
  // in the air beside it. 32x32.
  S.rare_clockbird = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, INK, WHITE, RUBY } = kit();
    const W = 32, H = 32;
    const BR = ['#40240c', '#6e4a1c', '#a07430', '#d0a040', '#e6c264', '#f0d890', '#fff6d8'];
    const brass = mat('', { ramp: BR, spec: 0.9, rim: 3, bias: 0.06, contrast: 1.1 });
    const brassD = mat('', { ramp: BR, spec: 0.94, bias: -0.06 });
    const STEEL = ['#2c3040', '#565e74', '#8088a0', '#a0a8b8', '#c8d0dc', '#f0f4f8'];
    const steel = mat('', { ramp: STEEL, spec: 0.9, bias: 0.08 });
    const DIAL = ['#a89878', '#d8ccb0', '#f0e8d4', '#f8f0e0', '#ffffff'];
    const dial = mat('', { ramp: DIAL, bias: 0.12, contrast: 0.6 });
    const sc = new Scene(W, H);
    // the winding key behind the back (its bow up at the right), the fan of tail plates
    sc.tube([[19, 13, 1, -6], [23.6, 8.2, 1, -6]], { m: steel, g: 'key' });
    sc.ell(24.4, 5.2, 2.4, 1.7, { m: steel, g: 'keyA', z: -6, rz: 1 });
    sc.ell(27.4, 8.2, 1.7, 2.4, { m: steel, g: 'keyB', z: -6, rz: 1 });
    for (const [x1, y1, i] of [[25.5, 28.5, 0], [28, 25.5, 1], [6.5, 28.5, 2], [4, 25.5, 3]]) sc.tube([[16 + (x1 > 16 ? 3 : -3), 22, 1.6, -3], [x1, y1, 1.1, -3]], { m: i & 1 ? brass : brassD, g: 'tail' + i });
    // legs and feet
    sc.tube([[14, 25, 0.7, 0], [13.6, 28.4, 0.6, 0]], { m: steel, g: 'legL' });
    sc.tube([[18, 25, 0.7, 0], [18.4, 28.4, 0.6, 0]], { m: steel, g: 'legR' });
    sc.tube([[11.6, 29.2, 0.6, 1], [15.2, 29.2, 0.6, 1]], { m: steel, g: 'footL' });
    sc.tube([[16.8, 29.2, 0.6, 1], [20.4, 29.2, 0.6, 1]], { m: steel, g: 'footR' });
    // body facing the viewer with the dial on its breast, round head, short beak, a crest
    sc.ell(16, 19.2, 7.2, 6.8, { m: brass, g: 'body', z: 0, rz: 6.4 });
    sc.ell(16, 20, 4.2, 4.2, { m: dial, g: 'dial', z: 6, rz: 1.2 });
    sc.ell(16, 10, 5, 4.4, { m: brass, g: 'head', z: 4, rz: 4.4 });
    sc.tube([[16, 11.8, 1.3, 9], [16, 14, 0.4, 10]], { m: steel, g: 'beak' });
    sc.tube([[16, 6, 0.9, 5], [15, 3.6, 0.7, 5], [16.6, 2.4, 0.4, 5]], { m: brass, g: 'crest' });
    // the folded wings: one sheet of brass down each side, engraved into overlapping plates
    for (const s0 of [-1, 1]) {
      const x0 = 16 + s0 * 5.8;
      sc.tube([[x0, 14.5, 2.2, 8], [x0 + s0 * 2.6, 18.5, 2.6, 8], [x0 + s0 * 3.2, 23, 1.8, 8], [x0 + s0 * 2.4, 26.4, 0.5, 8]], { m: brass, g: 'wing' + s0 });
      for (const y of [17.6, 20.6, 23.4]) sc.carve([[x0 + s0 * 0.6, y - 1.2], [x0 + s0 * 2.4, y], [x0 + s0 * 4.6, y - 0.6]], -2);
    }
    const p = sc.render({ ground: 0.02, depth: 0.06 });
    // the clock face: rim ticks, two hands, a centre pin
    for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; on(p, 16 + Math.cos(a) * 3.3, 20 + Math.sin(a) * 3.3, k % 3 === 0 ? BR[1] : DIAL[0]); }
    p.set(16, 19, INK); p.set(16, 18, INK); p.set(17, 20, INK); p.set(18, 21, INK); p.set(16, 20, BR[0]);
    // red glass-bead eyes, rivets, the key's shine
    stamp(p, 13, 8, ['rR', 'dr'], { r: RUBY[3], R: WHITE, d: RUBY[1] });
    stamp(p, 18, 8, ['rR', 'dr'], { r: RUBY[3], R: WHITE, d: RUBY[1] });
    for (const [x, y] of [[10, 15], [22, 15], [8, 19], [24, 19]]) on(p, x, y, BR[6]);
    on(p, 23, 4, WHITE); on(p, 27, 7, STEEL[5]);
    jewel(p, 16.6, 2.2, 0.9, 0.9, RUBY);
    const gear = (q, cx, cy, r, c) => {
      for (let a = 0; a < 16; a++) {
        const t = (a * Math.PI) / 8, rr = a % 2 ? r : r + 1;
        q.set(Math.round(cx + Math.cos(t) * rr), Math.round(cy + Math.sin(t) * rr), c[a % 2 ? 1 : 0]);
      }
      q.set(cx, cy, c[2]);
    };
    return finish(p, (q) => {
      // cogs whirling loose in the air
      gear(q, 27, 27, 2, [BR[4], BR[2], BR[6]]);
      gear(q, 4, 22, 1.5, [BR[5], BR[3], WHITE]);
      sparkle(q, 3, 4, 'star', 'y');
      sparkle(q, 29, 2, 'small', 'y');
      sparkle(q, 22, 30, 'dot');
    });
  };

  // ================================================================ rare_bookworm
  // 本の虫: a plump green caterpillar in round gold spectacles, sprawled on an open
  // book it has been eating: bite holes in the page edge, a scrap of paper still
  // in its mouth, little letters printed on every segment of its back. Gold
  // corners on the red binding and a ruby bookmark. 32x32.
  S.rare_bookworm = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, INK, WHITE, GOLD, RUBY } = kit();
    const W = 32, H = 32;
    const GR = ['#1e4a1a', '#3a7a2c', '#60a040', '#90d060', '#b8ec84', '#e4ffc0'];
    const body = mat('', { ramp: GR, rim: 3, bias: 0.1, spec: 0.95 });
    const belly = mat('', { ramp: ['#6a8a3a', '#98b860', '#c4e090', '#e4f8c0', '#f8ffe8'], bias: 0.1 });
    const PAGE = ['#8a7c64', '#c0b294', '#e0d4b8', '#f0e8d0', '#fcf8ec'];
    const page = mat('', { ramp: PAGE, bias: 0.14, contrast: 0.6, flat: true });
    const COVER = ['#3a0c10', '#701a20', '#a02c30', '#c04040', '#e07068'];
    const cover = mat('', { ramp: COVER, bias: 0.04 });
    const sc = new Scene(W, H);
    // the open book: red binding under two fanned pages
    sc.poly([[1, 25], [15.5, 27.5], [16.5, 27.5], [31, 25], [31, 28], [16.5, 30.4], [15.5, 30.4], [1, 28]], { m: cover, g: 'cover', z: -6, bevel: 1 });
    sc.poly([[2, 20.5], [9, 19.5], [15.5, 21.5], [15.5, 27.5], [2, 25]], { m: page, g: 'pageL', z: -4, bevel: 1.2, n: [-0.25, -0.5, 0.83] });
    sc.poly([[16.5, 21.5], [23, 19.5], [30, 20.5], [30, 25], [16.5, 27.5]], { m: page, g: 'pageR', z: -4, bevel: 1.2, n: [0.2, -0.5, 0.84] });
    // the caterpillar: fat segments arching over the pages, head raised at the left
    const SEG = [[26.6, 18.4, 3], [23, 16.4, 3.7], [19, 15.2, 4.1], [14.8, 14.8, 4.2]];
    SEG.forEach(([x, y, r], i) => {
      sc.ell(x, y, r, r * 0.95, { m: body, g: 'seg' + i, z: i, rz: r });
      sc.ell(x - 0.4, y + r * 0.8, r * 0.5, 1, { m: belly, g: 'leg' + i, z: i + 2, rz: 1 });
    });
    sc.ell(9.8, 10.6, 5.6, 5.2, { m: body, g: 'head', z: 6, rz: 5 });
    sc.ell(9.6, 13.8, 3.4, 2, { m: belly, g: 'chin', z: 9, rz: 1.8, soft: true });
    sc.tube([[7.4, 6, 0.7, 5], [6, 2.8, 0.5, 5]], { m: body, g: 'antL' });
    sc.tube([[12, 5.8, 0.7, 5], [13.6, 2.6, 0.5, 5]], { m: body, g: 'antR' });
    const p = sc.render({ ground: 0.02, depth: 0.06 });
    // text lines on the pages, bite holes along the right page's edge
    for (let y = 21; y <= 26; y += 2) for (let x = 3; x <= 29; x++) {
      if (x > 14 && x < 18) continue;
      const pc = p.get(x, y);
      if (PAGE.includes(pc) && (x * 7 + y * 3) % 5 !== 0) p.set(x, y, '#a8a098');
    }
    for (const [x, y] of [[30, 21], [29, 21], [30, 22], [30, 24], [29, 25], [30, 25]]) p.set(x, y, null);
    // gold corners on the binding, a ruby bookmark hanging out below
    for (const x of [1, 2, 29, 30]) { on(p, x, 27, GOLD[5]); on(p, x, 26, GOLD[4]); }
    stamp(p, 16, 26, ['r', 'R', 'r'], { r: RUBY[2], R: RUBY[3] });
    // little letters printed on each segment
    for (const [x, y] of [[26, 17], [22, 14], [18, 13], [14, 12.6]]) stamp(p, x, Math.round(y), ['k.k', '.k.'], { k: GR[1] });
    // round gold spectacles, eyes behind them, a scrap of paper in the mouth
    const G = { g: GOLD[4], G: GOLD[6], d: GOLD[2], k: INK, w: WHITE, l: '#c8f0ff' };
    stamp(p, 4, 8, ['.gg.', 'glwg', 'gkkd', 'gkkd', '.dd.'], G);
    stamp(p, 10, 8, ['.gG.', 'gwlg', 'dkkg', 'dkkg', '.dd.'], G);
    p.set(8, 9, GOLD[5]); p.set(9, 9, GOLD[5]);
    stamp(p, 7, 14, ['pPp', '.pp'], { p: '#f0e8d0', P: '#ffffff' });
    p.set(10, 14, INK); p.set(6, 14, INK);
    jewel(p, 13.6, 2.4, 0.8, 0.8, RUBY);
    return finish(p, (q) => {
      // a torn scrap drifting down
      stamp(q, 3, 19, ['pp', '.p'], { p: '#f0e8d0' });
      sparkle(q, 27, 12, 'star', 'y');
      sparkle(q, 3, 4, 'small', 'y');
      sparkle(q, 20, 7, 'dot');
      sparkle(q, 30, 3, 'dot');
    });
  };

  // ================================================================ rare_quill
  // 黄金の羽ペン: the legendary pen of the first storyteller: a great golden quill
  // floating aslant, writing by itself. From its nib a ribbon of golden ink loops
  // away in three or four glowing letters; a pair of small white wings flutters at
  // the root of the feather. 32x32.
  S.rare_quill = () => {
    const { Scene, mat, stamp, sparkle, finish, clamp, INK, WHITE, GOLD } = kit();
    const W = 32, H = 32;
    const FEA = ['#5a3208', '#9a6410', '#d09820', '#f0c030', '#f8dc70', '#fff4b0', '#ffffff'];
    const WG = ['#8890b8', '#b8c0e0', '#dce2f6', '#f4f6ff', '#ffffff'];
    const wing = mat('', { ramp: WG, bias: 0.16, contrast: 0.8 });
    const sc = new Scene(W, H);
    const A = [5.5, 27.5], B = [30.4, 0.8];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const at = (t, s) => [A[0] + dx * t + nx * s, A[1] + dy * t + ny * s];
    // (the pair of small white wings is stamped by hand below, crisp at this size)
    const p0 = sc.render({ ground: 0, depth: 0.1 });
    const p = G().pix(W, H);
    // the vane: slender, fuller on the upper side, pointed at the tip, barbs raked back
    const halfW = (t, s) => {
      const u = (t - 0.2) / 0.8;
      if (u < 0 || u > 1) return 0;
      const env = Math.min(1, u * 5) * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 0.55);
      return env * (s < 0 ? 4.6 : 3.3);
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x - A[0], py = y - A[1], t = (px * ux + py * uy) / L, s = px * nx + py * ny;
      const w = halfW(t, s);
      if (w <= 0.3 || Math.abs(s) > w) continue;
      const q = Math.abs(s) / w;
      const barb = Math.floor(t * L - Math.abs(s) * 0.9) % 2 === 0;
      let k = s < 0 ? (q < 0.8 ? 4 : 5) : q < 0.7 ? 3 : 2;
      if (barb) k -= 1;
      p.set(x, y, FEA[clamp(k, 1, 5)]);
    }
    // the shaft: bright along its length, bare below the vane
    for (let t = 0.1; t <= 0.97; t += 0.012) {
      const [x, y] = at(t, 0);
      p.set(x, y, t < 0.2 ? FEA[4] : t > 0.6 ? FEA[6] : FEA[5]);
    }
    // the nib: a darker gold point with a slit
    for (let t = 0; t < 0.11; t += 0.01) for (let sft = -1.2; sft <= 1.2; sft += 0.4) {
      if (Math.abs(sft) > t * 12) continue;
      const [x, y] = at(t, sft);
      p.set(x, y, sft < 0 ? GOLD[4] : GOLD[2]);
    }
    { const [x, y] = at(0.05, 0); p.set(x, y, INK); const [x2, y2] = at(0.09, 0); p.set(x2, y2, GOLD[1]); }
    p0.each((x, y, c) => { p.set(x, y, c); return undefined; });
    // a pair of small white wings at the root of the vane, one each side of the shaft
    const WP = { W: WG[4], w: WG[2], s: WG[1] };
    stamp(p, 3, 16, ['w......', 'wWw....', '.wWWw..', 'wwWWWW.', '.swWWW.', '..sww..'], WP);
    stamp(p, 12, 23, ['.wWw...', 'wWWWWw.', '.sWWWWw', '..swWWw', '...sw.w'], WP);
    return finish(p, (q) => {
      // a ribbon of glowing golden ink looping away from the nib in four letters
      const INKL = { a: '#ffe070', b: '#fff8d0', w: WHITE };
      // three glowing letters rising up the right-hand side like a ribbon, joined to the nib by
      // a golden stroke that runs under the lower wing (post coordinates: finish() moves this
      // layer with the sprite, 1 left and 3 down, so the stroke lands on the last row)
      stamp(q, 20, 23, ['..a.', '.a.a', '.aa.', 'a...', '.aab'], INKL);
      stamp(q, 24, 18, ['.ab.', 'a..a', '.aw.', 'a..a', '.aa.'], INKL);
      stamp(q, 28, 13, ['.aaw', 'a...', '.ab.', '...a', 'baa.'], INKL);
      for (const [x, y, c] of [[8, 28, 'a'], [9, 28, 'b'], [10, 28, 'a'], [11, 28, 'a'], [12, 28, 'b'], [13, 28, 'a'], [14, 28, 'a'], [17, 28, 'a'], [19, 28, 'a']]) q.set(x, y, INKL[c]);
      // a warm amber drop shadow under the letters (down-right, only on empty pixels) so the
      // pale ink still reads on the light backdrops (library floor, snow, clouds)
      const INKC = new Set([INKL.a, INKL.b, INKL.w]);
      const ink = [];
      for (let y = 12; y < H; y++) for (let x = 5; x < W; x++) if (INKC.has(q.get(x, y))) ink.push([x, y]);
      for (const [x, y] of ink) if (q.get(x + 1, y + 1) == null) q.set(x + 1, y + 1, '#a86a10');
      // a soft golden glow of loose motes round the feather
      for (const [x, y] of [[20, 4], [26, 10], [15, 11], [29, 6], [18, 16], [24, 16], [12, 16], [31, 3]]) q.set(x, y, (x + y) % 2 ? '#fff4c0' : '#ffe890');
      sparkle(q, 23, 12, 'star', 'y');
      sparkle(q, 3, 5, 'small', 'y');
      sparkle(q, 16, 3, 'dot');
      sparkle(q, 30, 22, 'dot');
    });
  };

  // ================================================================ rare_goldfish
  // 記憶の金魚: a goldfish with a long frilled tail swimming inside a great bubble.
  // The bubble is clear (only its rim is drawn, rainbow-tinted and lit at the top
  // left), and on its lower curve drift faint reflections of a remembered scene:
  // a house, a tree, two small figures. Kind black eyes; little bubbles float
  // round it. 32x32.
  S.rare_goldfish = () => {
    const { Scene, mat, stamp, sparkle, finish, OUT, INK, WHITE, GOLD } = kit();
    const W = 32, H = 32, CX = 15.5, CY = 15, RR = 13.4;
    const FISH = ['#7a1c0c', '#c04018', '#ff8040', '#ffa860', '#ffd098', '#fff4d8'];
    const fish = mat('', { ramp: FISH, spec: 0.94, rim: 2, bias: 0.12 });
    const FIN = ['#c06030', '#f0a060', '#ffd8a0', '#fff0c0', '#fffaf0'];
    const fin = mat('', { ramp: FIN, bias: 0.16, contrast: 0.7 });
    const sc = new Scene(W, H);
    // the frilled tail fanning behind, dorsal and belly fins, then the body facing left
    sc.tube([[18.5, 15, 1.4, -2], [22.5, 11.5, 2.2, -2], [25.5, 9, 1.8, -2], [27, 8.4, 0.6, -2]], { m: fin, g: 'tailA' });
    sc.tube([[18.5, 15.5, 1.4, -1], [23, 16.5, 2.4, -1], [26.4, 17.5, 1.6, -1], [27.6, 18.6, 0.5, -1]], { m: fin, g: 'tailB' });
    sc.tube([[18, 16, 1.2, -3], [21.6, 20, 2, -3], [23.8, 23, 1.2, -3], [24.6, 24.2, 0.4, -3]], { m: fin, g: 'tailC' });
    sc.tube([[13, 11.6, 1.1, -1], [15.6, 9.2, 1.4, -1], [18, 9.4, 0.4, -1]], { m: fin, g: 'dorsal' });
    sc.tube([[13.5, 18.6, 0.9, 3], [14.6, 21, 0.9, 3], [15.8, 21.6, 0.3, 3]], { m: fin, g: 'belly' });
    sc.ell(14.4, 15, 5.4, 4, { m: fish, g: 'body', z: 2, rz: 4 });
    sc.ell(10.8, 15.2, 2.8, 2.6, { m: fish, g: 'body', z: 4, rz: 2.4 });
    const p = sc.render({ ground: 0, depth: 0.1 });
    const fishPx = new Set();
    p.each((x, y) => { fishPx.add(y * W + x); return undefined; });
    // scales, a kind dark eye, a small mouth
    for (const [x, y] of [[14, 13], [16, 13], [15, 15], [17, 15], [14, 17], [16, 17]]) if (p.get(x, y)) p.set(x, y, FISH[4]);
    stamp(p, 9, 13, ['wk', 'kk'], { k: INK, w: WHITE });
    p.set(8, 13, FISH[5]);
    p.set(7, 16, FISH[1]); p.set(8, 16, FISH[1]);
    // fin rays and orange-tipped frills
    const finSet = new Set(FIN);
    p.each((x, y, c) => {
      if (!finSet.has(c)) return undefined;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => p.get(x + ax, y + ay) == null);
      if (edge && x > 20) return FISH[3];
      return (x + y) % 3 === 0 ? FIN[1] : undefined;
    });
    // the bubble rim: a clear ring, rainbow-tinted, bright at the upper left
    const RIM = ['#9ce4fa', '#c0f0ff', '#e0faff', '#ffffff'];
    const TINT = ['#ffd0f0', '#fff0b0', '#c8ffd8', '#d0d8ff'];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - CX, y - CY);
      if (d > RR || d < RR - 1.2) continue;
      const a = Math.atan2(y - CY, x - CX), lit = Math.cos(a + 2.4);
      let c = lit > 0.55 ? RIM[3] : lit > 0 ? RIM[2] : lit > -0.6 ? RIM[1] : RIM[0];
      const band = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16);
      if (lit < 0.3 && band % 4 === 1) c = TINT[(band >> 2) % 4];
      p.set(x, y, c);
    }
    return finish(p, (q) => {
      // faint reflections of a remembered scene on the lower curve of the bubble
      const SC = '#a0b0c0', SC2 = '#b8c4d4';
      const house = ['....a....', '...aaa...', '..aaaaa..', '.aaaaaaa.', '..a.a.a..', '..aaaaa..', '..a...a..'];
      const tree = ['.aaa.', 'aaaaa', 'aaaaa', '.aaa.', '..a..', '..a..'];
      const fig = ['.a.', 'aaa', '.a.', 'a.a'];
      const dither = (x0, y0, rows) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'a' && ((x0 + i + y0 + j) & 1) === 0) q.set(x0 + i, y0 + j, j < 2 ? SC2 : SC); }));
      dither(4, 19, house); dither(21, 20, tree); dither(13, 23, fig); dither(17, 23, fig);
      // a curved sheen inside the rim, and little bubbles floating round
      for (let t = 0; t <= 1; t += 0.08) { const a = Math.PI * (1.08 + t * 0.34); q.set(Math.round(CX + Math.cos(a) * (RR - 3)), Math.round(CY + Math.sin(a) * (RR - 3)), t > 0.4 && t < 0.7 ? WHITE : RIM[2]); }
      for (const [x, y, r] of [[29, 27, 1.6], [2, 26, 1.2], [29, 3, 1.1], [26, 30, 0.8]]) {
        for (let a = 0; a < 12; a++) q.set(Math.round(x + Math.cos((a * Math.PI) / 6) * r), Math.round(y + Math.sin((a * Math.PI) / 6) * r), a === 8 ? WHITE : RIM[1]);
      }
      sparkle(q, 4, 5, 'star', 'c');
      sparkle(q, 27, 12, 'dot');
      q.set(24, 5, GOLD[5]);
    }, { after: (pp, dx, dy) => {
      // clear the outline the ring threw inward (the bubble is see-through), keep the fish's
      // and the ring's outer outline
      pp.each((x, y, c) => {
        if (c !== OUT) return undefined;
        const d = Math.hypot(x - dx - CX, y - dy - CY);
        if (d >= RR - 1) return undefined;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (fishPx.has((y - dy + ay) * W + (x - dx + ax))) return undefined;
        return null;
      });
    } });
  };

  // ================================================================ rare_tapir
  // 夢食いバク: a tapir whose body is the night sky (deep navy scattered with white
  // stars) and whose back is white and glows softly like the moon. Eyes closed in
  // contentment, it draws a rainbow-rimmed dream bubble into its long trunk; two
  // more dream bubbles drift round it, one holding a tiny castle, one a flower and
  // one a crescent moon. 64x64.
  S.rare_tapir = () => {
    const { Scene, mat, stamp, on, jewel, sparkle, finish, hash, INK, WHITE, GOLD, SAPH } = kit();
    const W = 64, H = 64;
    const NAVY = ['#0c1030', '#18204a', '#283060', '#36447c', '#5060a0', '#7c8cc8'];
    const navy = mat('', { ramp: NAVY, rim: 4, bias: 0.06 });
    const navyD = mat('', { ramp: NAVY, bias: -0.08 });
    const MOON = ['#6a78b8', '#9aa8dc', '#c4d0f4', '#e0e8ff', '#f4f8ff', '#ffffff'];
    const moon = mat('', { ramp: MOON, bias: 0.06, contrast: 1.05, rim: 2 });
    const sc = new Scene(W, H);
    // far legs, stubby tail
    sc.tube([[29, 50, 3.6, -6], [29.2, 56, 3.2, -6], [29.2, 60.6, 3.2, -6]], { m: navyD, g: 'legFF' });
    sc.tube([[46, 50, 3.8, -7], [46.6, 56, 3.4, -7], [46.8, 60.6, 3.4, -7]], { m: navyD, g: 'legFH' });
    sc.tube([[55.5, 38, 1.8, -2], [58, 41, 1.2, -2]], { m: navy, g: 'tail' });
    // body: a heavy rounded barrel; the moonlit saddle wraps its middle and rear
    sc.ell(38.5, 42, 18, 11.8, { m: navy, g: 'body', z: 0, rz: 11 });
    sc.ell(49, 43, 8, 10, { m: navy, g: 'body', z: 1, rz: 9 });
    sc.region((x, y) => sc.isG(x, y, 'body') && x > 30 + Math.max(0, y - 44) * 0.5 && x < 53 - Math.max(0, y - 40) * 0.4 && y < 51, moon, 'saddle');
    // near legs, short and stout
    sc.tube([[23.5, 49, 4.2, 8], [23, 55, 3.8, 9], [23, 60.6, 3.8, 9]], { m: navy, g: 'legNF' });
    sc.tube([[51, 49, 4.6, 7], [52, 55, 3.8, 8], [52, 60.6, 3.8, 8]], { m: navy, g: 'legNH' });
    for (const [x, z] of [[23, 12], [52, 11]]) for (const d of [-2.4, 0, 2.4]) sc.ell(x + d, 61.6, 1.2, 0.8, { m: moon, g: 'toe' + x, z, rz: 0.6 });
    // head turned toward the viewer, round ears, the long trunk curling up to a bubble
    sc.ell(17.5, 38.5, 9, 8, { m: navy, g: 'head', z: 6, rz: 7.5 });
    sc.ell(12.6, 43, 6, 4.6, { m: navy, g: 'head', z: 9, rz: 4.4 });
    sc.ell(21, 30.6, 2.8, 3, { m: navy, g: 'earR', z: 3, rz: 2 });
    sc.ell(12.4, 31.6, 2.6, 2.8, { m: navy, g: 'earL', z: 4, rz: 2 });
    sc.tube([[9, 45, 2.7, 11], [5.4, 44, 2, 12], [3.6, 40, 1.6, 12], [3.8, 35.6, 1.4, 12], [5.4, 32.6, 1.4, 12]], { m: navy, g: 'trunk', steps: 6 });
    const p = sc.render({ ground: 0.03, depth: 0.1 });
    // stars scattered over the navy (not the moonlit back), a few of them four-pointed
    const navySet = new Set(NAVY);
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(hash(i, 1, 21) * W), y = Math.floor(hash(i, 2, 21) * H);
      const c = p.get(x, y);
      if (!navySet.has(c) || c === NAVY[5] || c === NAVY[0] || (x > 9 && x < 26 && y > 32 && y < 41)) continue;
      p.set(x, y, i % 5 === 0 ? '#fff4c0' : i % 7 === 0 ? '#c8e8ff' : WHITE);
    }
    for (const [x, y, gold] of [[25, 45, 0], [28, 41, 1], [28, 50, 1], [55, 47, 0], [8, 44, 1], [23, 56, 0], [52, 56, 1], [21, 45, 0]]) {
      if (!navySet.has(p.get(x, y))) continue;
      stamp(p, x - 1, y - 1, ['.s.', 'sws', '.s.'], gold ? { s: GOLD[4], w: GOLD[6] } : { s: '#c8d8ff', w: WHITE });
    }
    // the moonlit back glows: a pale rim of light along its top edge
    p.each((x, y, c) => (MOON.includes(c) && p.get(x, y - 1) == null ? MOON[5] : undefined));
    // closed, contented eyes; the trunk tip's opening
    stamp(p, 12, 36, ['k...k', '.kkk.'], { k: MOON[3] });
    stamp(p, 19, 35, ['k...k', '.kkk.'], { k: MOON[3] });
    on(p, 12, 38, '#c890d8'); on(p, 24, 37, '#c890d8');
    p.set(5, 31, INK); p.set(6, 31, INK);
    // white-rimmed round ears
    for (const [cx, cy, r] of [[21, 30.6, 2.8], [12.4, 31.6, 2.6]]) for (let a = Math.PI * 0.9; a < Math.PI * 2.1; a += 0.25) on(p, cx + Math.cos(a) * (r - 0.4), cy + Math.sin(a) * (r - 0.4), MOON[4]);
    jewel(p, 17, 31.4, 1.5, 1.5, SAPH, { bezel: GOLD.slice(1) });
    return finish(p, (q) => {
      /** a dream bubble: rainbow-rimmed, clear, with something small dreamt inside */
      const RB = ['#ff6ab0', '#ffc848', '#70e070', '#50b8ff', '#a878ff'];
      const bubble = (cx, cy, r, inside) => {
        for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r + 0.5 || d < r - 0.5) continue;
          const a = Math.atan2(y - cy, x - cx);
          q.set(x, y, Math.cos(a + 2.3) > 0.7 ? WHITE : RB[Math.floor(((a + Math.PI) / (Math.PI * 2)) * 10) % 5]);
        }
        q.set(Math.round(cx - r * 0.45), Math.round(cy - r * 0.5), WHITE);
        inside(Math.round(cx), Math.round(cy));
      };
      bubble(7, 24.5, 5.6, (x, y) => stamp(q, x - 3, y - 2, ['.a.a.', '.aaa.', 'aaaaa', 'a.a.a', 'aa.aa'], { a: '#e0e4f8' })); // a castle
      bubble(32, 14, 6.4, (x, y) => stamp(q, x - 2, y - 2, ['.p.p.', 'ppyp.', '.pgp.', '..g..', '.gg..'].map((r) => r), { p: '#ffb0d8', y: '#ffe070', g: '#80d080' })); // a flower
      bubble(54, 22, 5.8, (x, y) => stamp(q, x - 2, y - 3, ['.yy..', 'yy...', 'y....', 'y....', 'yy...', '.yy..'], { y: GOLD[5] })); // a crescent moon
      // the dream being drawn into the trunk: a trail of rainbow motes
      for (const [x, y, k] of [[6, 30, 0], [7, 29, 2], [5, 29, 4]]) q.set(x, y, RB[k]);
      sparkle(q, 20, 6, 'star', 'y');
      sparkle(q, 46, 8, 'small', 'c');
      sparkle(q, 60, 34, 'small', 'p');
      sparkle(q, 3, 46, 'dot');
      sparkle(q, 42, 24, 'dot');
    });
  };

  // ------------------------------------------------------------ registry
  const SIZES = { rare_fawn: 48, rare_glassmoth: 48, rare_acorn: 32, rare_icefox: 48, rare_lotus: 32, rare_teapot: 32, rare_bellsnail: 48, rare_hermit: 48, rare_hedgehog: 32, rare_monkey: 48, rare_turtle: 48, rare_sheep: 48, rare_clockbird: 32, rare_bookworm: 32, rare_quill: 32, rare_goldfish: 32, rare_tapir: 64 };
  for (const id in S) R.Gfx.def('mon:' + id, S[id]);
  const A = (R.Art = R.Art || {});
  A.rareMonstersB = { ids: Object.keys(SIZES), sizes: SIZES };
})(window.RPG);
