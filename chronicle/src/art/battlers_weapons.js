// Party battle sprites (Part A8, DESIGN §11.4.4.6) — the weapon shapes: the 7 families (A19)
// plus the item-art shapes katana (a sword with art:'katana') and club (a mace-line
// axe with art:'club'); whip is kept but no item uses it any more.
// Each weapon is a few shapes in weapon-local pixels (origin = the grip, the tip
// towards −y, +x = the cutting edge / the front). They are rasterised once into
// letter grids for the two authored directions, U (straight up) and FU (forward-
// up 45°), and the other six come from exact 90° rotations of those grids
// (F = U turned once clockwise, FD = FU once, D / BD twice, B / BU three times), so
// no pixel is ever resampled. Pre-flip the figure faces right, so "forward" = +x.
// Letters: X Y Z steel · L M N leather/wood · G H I trim (gold for rare) ·
// Q q the staff orb's glow · w bow string / feather · P arrow head.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const BT = (A._Battlers = A._Battlers || {});

  // ------------------------------------------------------------------ shapes
  // band: {y:[y0,y1], x:[x0,x1], c: letter | (lx, ly) → letter, dx?: ly → x shift}
  // poly: {poly:[[x,y]…], c}   disc: {disc:[x,y,r], c}
  const alt = (a, b) => (lx, ly) => (Math.floor(ly) & 1 ? a : b);
  const side = (a, b, s) => (lx) => (lx < (s || 0) ? a : b);
  const W3 = (a, b, c) => (lx) => (lx < -0.5 ? a : lx < 0.5 ? b : c);

  const SHAPES = {
    sword: {
      tip: [0, -12],
      parts: [
        { y: [3, 4], x: [-1, 1], c: 'H' },
        { y: [-1, 3], x: [-0.5, 0.5], c: alt('L', 'M') },
        { y: [-2, -1], x: [-2.5, 2.5], c: (lx) => (Math.abs(lx) < 1 ? 'I' : Math.abs(lx) < 2 ? 'H' : 'G') },
        { y: [-11, -2], x: [-1, 1], c: side('Z', 'X') },
        { y: [-12, -11], x: [-0.5, 0.5], c: 'Z' },
      ],
    },
    katana: {
      tip: [-1, -18],
      parts: [
        { y: [3, 4], x: [-0.5, 0.5], c: 'L' },
        { y: [-1, 3], x: [-0.5, 0.5], c: alt('N', 'L') },
        { y: [-2, -1], x: [-1.5, 1.5], c: (lx) => (Math.abs(lx) < 0.5 ? 'I' : 'G') },
        // single-edged, slightly curved back towards the tip: bright edge in front
        { y: [-17, -2], x: [-1, 1], dx: (ly) => -Math.pow((-ly - 2) / 15, 2) * 1.6, c: side('Y', 'Z') },
        { y: [-18, -17], x: [-0.5, 0.5], dx: () => -1.4, c: 'Z' },
      ],
    },
    greatsword: {
      tip: [0, -19],
      grip2: [0, -2],
      parts: [
        { y: [3, 4], x: [-1.5, 1.5], c: W3('G', 'I', 'H') },
        { y: [-2, 3], x: [-0.5, 0.5], c: alt('L', 'M') },
        { y: [-3, -2], x: [-3.5, 3.5], c: (lx) => (Math.abs(lx) < 1 ? 'I' : Math.abs(lx) < 3 ? 'H' : 'G') },
        { y: [-4, -3], x: [-2, 2], c: (lx) => (Math.abs(lx) < 1 ? 'H' : 'G') },
        { y: [-18, -4], x: [-1.5, 1.5], c: W3('Z', 'Y', 'X') },
        { y: [-19, -18], x: [-0.5, 0.5], c: 'Z' },
      ],
    },
    dagger: {
      tip: [0, -6],
      parts: [
        { y: [2, 3], x: [-0.5, 0.5], c: 'H' },
        { y: [0, 2], x: [-0.5, 0.5], c: alt('L', 'M') },
        { y: [-1, 0], x: [-1.5, 1.5], c: (lx) => (Math.abs(lx) < 0.5 ? 'I' : 'G') },
        { y: [-5, -1], x: [-1, 1], c: side('Z', 'X') },
        { y: [-6, -5], x: [-0.5, 0.5], c: 'Z' },
      ],
    },
    axe: {
      tip: [5, -7],
      parts: [
        { y: [4, 5], x: [-0.5, 0.5], c: 'G' },
        { y: [-11, 4], x: [-0.5, 0.5], c: alt('L', 'M') },
        // back spike
        { poly: [[-0.5, -9], [-3, -8], [-0.5, -6.5]], c: 'X' },
        // crescent blade on the front
        { poly: [[0.5, -9.2], [2.6, -11], [4.8, -11.2], [4.2, -7.5], [4.8, -3.6], [2.6, -3.8], [0.5, -5.6]], c: (lx) => (lx < 1.6 ? 'X' : lx < 3.4 ? 'Y' : 'Z') },
        { y: [-12, -11], x: [-0.5, 0.5], c: 'M' },
      ],
    },
    spear: {
      tip: [0, -21],
      grip2: [0, -7],
      parts: [
        { y: [7, 8], x: [-0.5, 0.5], c: 'G' },
        { y: [-13, 7], x: [-0.5, 0.5], c: alt('L', 'M') },
        { y: [-15, -13], x: [-1.5, 1.5], c: (lx, ly) => (Math.abs(lx) < 0.5 ? 'I' : ly > -14 ? 'G' : 'H') },
        { poly: [[0, -21.6], [1.7, -17.5], [0.6, -15], [-0.6, -15], [-1.7, -17.5]], c: W3('Z', 'Y', 'X') },
      ],
    },
    club: {
      tip: [0, -9],
      parts: [
        { y: [3, 4], x: [-0.5, 0.5], c: 'G' },
        { poly: [[-0.8, 3.5], [0.8, 3.5], [2.7, -7], [2, -9.8], [0, -10.6], [-2, -9.8], [-2.7, -7]], c: (lx) => (lx < -0.8 ? 'L' : lx < 1.2 ? 'M' : 'N') },
        { disc: [-1, -7.5, 0.72], c: 'Z' },
        { disc: [1, -5, 0.72], c: 'Z' },
      ],
    },
    staff: {
      tip: [0, -20],
      parts: [
        { y: [-17, 5], x: [-0.5, 0.5], c: alt('M', 'N') },
        { y: [-18, -17], x: [-1.5, 1.5], c: W3('G', 'I', 'H') },
        { y: [-22, -18], x: [-2.6, -1.6], c: 'H' },
        { y: [-22, -18], x: [1.6, 2.6], c: 'G' },
        { disc: [0, -20.2, 1.55], c: (lx, ly) => (Math.hypot(lx - 0.3, ly + 20.6) < 0.8 ? 'Q' : 'q') },
      ],
    },
    whip: {
      // handle only; the lash (coil, curve) is drawn per pose (whipCoil / whipLash)
      tip: [0, -6],
      parts: [
        { y: [2, 3], x: [-1, 1], c: 'H' },
        { y: [-4, 2], x: [-0.5, 0.5], c: alt('L', 'M') },
        { y: [-5, -4], x: [-1, 1], c: 'G' },
      ],
    },
    bow: {
      tip: [3, 0],
      ends: [[-3, -10], [-3, 10]],
      parts: [
        { bow: true },
      ],
    },
  };
  BT.WSHAPES = SHAPES;

  function pip(pts, x, y) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  /** letter at a local point, or null */
  function sample(sh, lx, ly, thin) {
    let out = null;
    for (const p of sh.parts) {
      if (p.bow) {
        // limbs: centre curves back (−x) towards the tips; 2px near the grip, 1px at the ends
        if (ly < -10.5 || ly >= 10.5) continue;
        const cx = -3 * Math.pow(ly / 10.5, 2), hw = Math.abs(ly) < 5 ? 1 : 0.55;
        if (lx < cx - hw || lx >= cx + hw) continue;
        out = Math.abs(ly) < 2 ? (lx < cx ? 'G' : 'H') : Math.abs(ly) > 9 ? 'N' : lx < cx ? 'L' : 'M';
        continue;
      }
      let hit = false;
      if (p.poly) hit = pip(p.poly, lx, ly);
      else if (p.disc) hit = Math.hypot(lx - p.disc[0], ly - p.disc[1]) <= p.disc[2];
      else {
        // on the diagonal a band of width w covers w·√2 pixels per row: thin it back to w
        const sx = (lx - (p.dx ? p.dx(ly) : 0)) * (thin && p.x[1] - p.x[0] > 1.5 ? 1.35 : 1);
        hit = ly >= p.y[0] && ly < p.y[1] && sx >= p.x[0] && sx < p.x[1];
        if (hit) { out = typeof p.c === 'function' ? p.c(sx, ly) : p.c; continue; }
      }
      if (hit) out = typeof p.c === 'function' ? p.c(lx, ly) : p.c;
    }
    return out;
  }

  /** rasterise a weapon at angle deg (clockwise from up) → {w,h,g:[strings],grip,tip,grip2,ends} */
  function raster(sh, deg) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const toW = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
    const toL = (x, y) => [x * c + y * s, -x * s + y * c];
    // bounds from a generous local box
    const R0 = 32;
    const px = [];
    let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (let y = -R0; y <= R0; y++) for (let x = -R0; x <= R0; x++) {
      const l = toL(x, y);
      // nudge off exact half-pixel boundaries at 90° multiples
      const ch = sample(sh, l[0] + 1e-6, l[1] + 1e-6, deg % 90 !== 0);
      if (!ch) continue;
      px.push([x, y, ch]);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const g = [];
    for (let j = 0; j < h; j++) g.push(new Array(w).fill('.'));
    for (const [x, y, ch] of px) g[y - y0][x - x0] = ch;
    const pt = (p) => { if (!p) return null; const q = toW(p); return [Math.round(q[0]) - x0, Math.round(q[1]) - y0]; };
    return {
      w, h, g: g.map((r) => r.join('')), grip: [-x0, -y0],
      tip: pt(sh.tip), grip2: pt(sh.grip2), ends: sh.ends ? sh.ends.map(pt) : null,
    };
  }
  /** rotate a grid 90° clockwise, n times */
  function rot(gr, n) {
    let o = gr;
    for (let k = 0; k < n; k++) {
      const w = o.w, h = o.h, g = [];
      for (let y = 0; y < w; y++) { let row = ''; for (let x = 0; x < h; x++) row += o.g[h - 1 - x][y]; g.push(row); }
      const p = (q) => (q ? [h - 1 - q[1], q[0]] : null);
      o = { w: h, h: w, g, grip: p(o.grip), tip: p(o.tip), grip2: p(o.grip2), ends: o.ends ? o.ends.map(p) : null };
    }
    return o;
  }
  BT.DIRS = ['U', 'FU', 'F', 'FD', 'D', 'BD', 'B', 'BU'];
  const cache = {};
  /** the letter grid of weapon wtype pointing dir */
  BT.weaponGrid = function (wtype, dir) {
    const sh = SHAPES[wtype];
    if (!sh) return null;
    const k = wtype + ':' + dir;
    if (cache[k]) return cache[k];
    const i = BT.DIRS.indexOf(dir);
    const base = i % 2 === 0 ? (cache[wtype + ':U'] = cache[wtype + ':U'] || raster(sh, 0)) : (cache[wtype + ':FU'] = cache[wtype + ':FU'] || raster(sh, 45));
    return (cache[k] = rot(base, Math.floor(i / 2)));
  };
  /** two-handed families (the second hand goes to grip2) */
  BT.TWO_HANDED = { greatsword: 1, spear: 1 };

  /** weapon colour table for a figure palette and grade */
  BT.weaponPal = function (pal, grade) {
    const p = Object.assign({}, pal, { Q: '#e8fcff', q: '#58b8e8', w: '#f4f0e8', P: '#dce2ee' });
    if (grade === 'rare') {
      const r = R.Art.Chars.ramp('#e8c850');
      p.G = r[0]; p.H = r[1]; p.I = r[2];
    }
    return p;
  };

  /**
   * stamp weapon wtype (dir) so its grip lands on hand h → {tip, grip2, ends} in buffer coords.
   * o.sparkle: super grade pink glint on the blade
   */
  BT.drawWeapon = function (b, wtype, dir, h, pal, o) {
    const gr = BT.weaponGrid(wtype, dir);
    if (!gr) return null;
    o = o || {};
    const ox = Math.round(h[0]) - gr.grip[0], oy = Math.round(h[1]) - gr.grip[1];
    const cols = new Array(gr.w * gr.h).fill(null);
    for (let y = 0; y < gr.h; y++) for (let x = 0; x < gr.w; x++) {
      const ch = gr.g[y][x];
      if (ch !== '.') cols[y * gr.w + x] = pal[ch] || null;
    }
    BT.stampCols(b, cols, gr.w, gr.h, ox, oy, false);
    const P = (q) => (q ? [q[0] + ox, q[1] + oy] : null);
    const tip = P(gr.tip);
    if (o.sparkle && tip && wtype !== 'bow' && wtype !== 'whip') {
      // pink glint two pixels down the blade from the tip
      const g = P(gr.grip);
      const d = Math.hypot(tip[0] - g[0], tip[1] - g[1]) || 1;
      const sx = Math.round(tip[0] + ((g[0] - tip[0]) * 3) / d), sy = Math.round(tip[1] + ((g[1] - tip[1]) * 3) / d);
      if (sx >= 0 && sy >= 0 && sx < BT.W && sy < BT.H && BT.filled(b, sy * BT.W + sx)) { b.tn[sy * BT.W + sx] = null; b.col[sy * BT.W + sx] = '#ffb0dc'; }
    }
    return { tip, grip2: P(gr.grip2), ends: gr.ends ? gr.ends.map(P) : null };
  };

  // ------------------------------------------------------------------ bow string, arrow, whip
  /** 1px line of a colour (no body) */
  function cline(b, x0, y0, x1, y1, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (x >= 0 && y >= 0 && x < BT.W && y < BT.H) { const j = y * BT.W + x; b.tn[j] = null; b.col[j] = col; b.body[j] = 0; }
    }
  }
  BT.cline = cline;
  /** bow string from the two ends, through the drawing hand when given */
  BT.bowString = function (b, ends, hand, pal) {
    if (!ends) return;
    const [e0, e1] = ends;
    if (hand) { cline(b, e0[0], e0[1], hand[0], hand[1], pal.w); cline(b, hand[0], hand[1], e1[0], e1[1], pal.w); }
    else cline(b, e0[0], e0[1], e1[0], e1[1], pal.w);
  };
  /** a 12px arrow from the nock (x, y) forward (+x) → head point */
  BT.arrow = function (b, x, y, pal, len) {
    len = len || 12;
    cline(b, x + 1, y, x + len - 3, y, pal.M);
    b.col[(y - 1) * BT.W + x] = pal.w; b.tn[(y - 1) * BT.W + x] = null;
    b.col[y * BT.W + x] = pal.w; b.tn[y * BT.W + x] = null;
    cline(b, x + len - 2, y - 1, x + len - 2, y + 1, pal.X);
    cline(b, x + len - 1, y, x + len - 1, y, pal.Z);
    return [x + len - 1, y];
  };
  /** coiled whip hanging below the hand (a ring of leather) → tip */
  BT.whipCoil = function (b, h, pal) {
    const m = BT.Mask(), cx = h[0] + 1, cy = h[1] + 5;
    BT.mellipse(m, cx, cy, 3.2, 3);
    const hole = BT.mellipse(BT.Mask(), cx, cy, 1.3, 1.1);
    BT.msub(m, hole);
    const L = [pal.L, pal.L, pal.M, pal.N];
    BT.paint(b, m, L, { body: false });
    return [cx, cy + 3];
  };
  /** a short lash curve (14px) from the handle end p, heading dir (+1 forward), droop = rows it sags */
  BT.whipLash = function (b, p, pal, droop, lift) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      pts.push([p[0] + i, p[1] - Math.round((lift || 0) * Math.sin(t * Math.PI)) + Math.round(droop * t * t)]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (x < 0 || y < 0 || x >= BT.W || y >= BT.H) continue;
      const j = y * BT.W + x; b.tn[j] = null; b.col[j] = i < 6 ? pal.M : i < 11 ? pal.L : pal.N; b.body[j] = 0;
      // thicker near the handle
      if (i < 5 && y + 1 < BT.H) { const k = (y + 1) * BT.W + x; if (!BT.filled(b, k)) { b.col[k] = pal.L; b.body[k] = 0; } }
    }
    return pts[pts.length - 1];
  };
})(window.RPG);
