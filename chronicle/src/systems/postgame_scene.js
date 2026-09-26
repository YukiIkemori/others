// The side chapter's closing picture (外伝『円環の竜』, DESIGN §10.12): after 円環竜オウロボラ falls, one
// illustrated panel painted procedurally — the party seen from behind on a clifftop of ビブリア島 under an aurora,
// a ring of stars where the dragon now sleeps, and the white tower of the great archive glowing across the inner
// sea — with a short epilogue, the earned 称号 (R.Game.title, '大語り部') and 「おしまい」. Plays BGM 'ending',
// then restores the BGM that was playing. Owner: story (A19); the oblivion owner's last scene calls it.
//
//   await R.Postgame.bonusScene()            // opts (all optional):
//     title      称号 shown (default R.Game.title; '' skips the 称号 screen)
//     pages      epilogue pages (default R.Postgame.PAGES)
//     fadeBack   false: stay faded to black on return (the caller warps, then fades in)
//     bgm        BGM to play on return (default: the one playing before; null = silence)
//
// A / B advance the text (A while typing shows the page at once); at the end any button closes. The layer is
// opaque; it fades in from black and fades out back to whatever is underneath (normally the field).
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const W = 256, H = 224;

  // epilogue pages (STYLE_JA: 1 line ≤ 20, 4 lines a page, the hero only as {hero})
  const PAGES = [
    '円環竜オウロボラは、\n長い長い眠りについた。',
    '終わらない物語は、\nようやく「おしまい」を\n迎えることができた。',
    'その夜、内海の空には、\n星がひとつの輪を描いて\n並んでいたという。',
    '{hero}は、年代記の\n最後の余白に、\n小さく書き添えた。',
    '「物語は、終わる。\nだから、また新しく\n語りはじめられる」',
    '忘れられた物語の底まで\n旅をした語り部は、\nのちに「大語り部」と\n呼ばれることになる――',
  ];

  // ------------------------------------------------------------ palette
  const SKY = ['#03050d', '#050817', '#080d21', '#0c132d', '#101a3a', '#152147', '#1b2a55', '#223462', '#2a406e'];
  const AUR_G = ['#0c3038', '#10584c', '#169066', '#34c882', '#86f4b8', '#e2fff0'];
  const AUR_V = ['#1c1648', '#34247a', '#5a3ab0', '#8e66e0', '#c8a8ff'];
  const SEA = ['#04070f', '#070c1a', '#0a1225', '#0e1a32', '#132240'];
  const ROCK = ['#05060c', '#0a0c18', '#111526', '#191e34', '#232a44', '#2f3856'];
  const GRASS = ['#07140f', '#0c2418', '#133822', '#1c502e', '#2a6c3c', '#4a9c5a'];
  const LIT = '#7ef0b0'; // aurora light on edges
  const WARM = ['#8a4a10', '#e09030', '#ffd070', '#fff4c8'];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // deterministic noise (the painting is the same every time)
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y, c, s) {
    const X = x / c, Y = y / c, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), d = hash(x0, y0 + 1, s), e = hash(x0 + 1, y0 + 1, s);
    return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
  }

  // ------------------------------------------------------------ geometry
  const HORIZON = 118; // sea horizon line
  const GROUND = 150; // clifftop where the heroes stand
  /** clifftop profile: y of the ground at column x (Infinity = no cliff) */
  function cliffTop(x) {
    if (x > 196) return Infinity;
    const edge = x > 170 ? (x - 170) * (x - 170) * 0.09 : 0; // falls away toward the sea
    return GROUND - 3 + Math.round(Math.sin(x / 13) * 1.5 + Math.sin(x / 5.3) * 0.8 + (x < 40 ? (40 - x) * 0.18 : 0) + edge);
  }
  /** far shore: ビブリア島 with the archive's hill (right) and low hills (left) */
  function farLand(x) {
    const hill = 10 * Math.exp(-Math.pow((x - 206) / 24, 2)) + 4 * Math.exp(-Math.pow((x - 236) / 14, 2));
    const left = x < 90 ? 6 * Math.exp(-Math.pow((x - 30) / 30, 2)) + 3 * Math.sin(x / 7) * Math.exp(-Math.pow((x - 30) / 30, 2)) : 0;
    const h = Math.max(hill, left);
    return h > 0.8 ? HORIZON - Math.round(h) : null;
  }
  /** the ring of stars where the dragon sleeps (centre, radius) */
  const RING = { x: 150, y: 38, r: 17, n: 13 };

  // ------------------------------------------------------------ static painting
  function paintBack() {
    const p = G().pix(W, H);
    // sky: dithered gradient, a touch of teal haze near the horizon
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) {
      const t = Math.pow(y / HORIZON, 1.15) * (SKY.length - 1) + (x - 128) / 900;
      const k = Math.floor(t + bayer(x, y) - 0.5 + 0.5);
      p.set(x, y, SKY[Math.max(0, Math.min(SKY.length - 1, k))]);
    }
    // the milky way: a faint diagonal band of dust and tiny stars
    for (let y = 0; y < HORIZON - 6; y++) for (let x = 0; x < W; x++) {
      const d = Math.abs((x - 20) * 0.42 - y + 8) / 20;
      if (d > 1) continue;
      const n = vnoise(x, y, 6, 3) * 0.7 + vnoise(x, y, 2.5, 5) * 0.3;
      const v = (1 - d) * n;
      if (v > 0.42 && bayer(x, y) < (v - 0.42) * 2.2) p.set(x, y, v > 0.62 ? '#3a4a80' : '#26325e');
      if (hash(x, y, 9) < 0.03 * (1 - d)) p.set(x, y, hash(x, y, 10) < 0.5 ? '#8a98c8' : '#c8d0f0');
    }
    // dim fixed stars
    for (let y = 0; y < HORIZON - 4; y++) for (let x = 0; x < W; x++) {
      const h = hash(x, y, 1);
      if (h < 0.006) p.set(x, y, h < 0.002 ? '#c0c8e8' : '#6c78a8');
    }
    // crescent moon
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y), d2 = Math.hypot(x - 3, y - 2);
      if (d <= 6.5 && d2 > 5.6) p.set(226 + x, 24 + y, d > 5.6 ? '#e8d8a0' : x < -3 ? '#fff8dc' : '#fbeec0');
    }
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
      const d = Math.hypot(x, y);
      if (d > 7 && d < 10 && bayer(226 + x, 24 + y) < (10 - d) / 9 && p.get(226 + x, 24 + y) !== '#fff8dc') p.set(226 + x, 24 + y, '#2a3a6a');
    }
    // a faint halo where the ring of stars stands
    for (let y = -RING.r - 6; y <= RING.r + 6; y++) for (let x = -RING.r - 6; x <= RING.r + 6; x++) {
      const d = Math.abs(Math.hypot(x, y) - RING.r);
      if (d < 4 && bayer(RING.x + x, RING.y + y) < (4 - d) / 14) p.set(RING.x + x, RING.y + y, '#26325e');
    }
    return p.toCanvas();
  }

  /** far shore: the island's hill, the great archive's white tower with lit windows, distant hills */
  function paintLand() {
    const p = G().pix(W, H);
    for (let x = 0; x < W; x++) {
      const top = farLand(x);
      if (top == null) continue;
      for (let y = top; y < HORIZON + 1; y++) p.set(x, y, y === top ? '#1c3450' : y - top < 2 ? '#101c34' : '#0a1226');
    }
    // the white tower of 白の大書庫 on its hill, the town of ビブリア at its feet
    const C = { dark: '#1a2238', mid: '#5a6480', lit: '#c8d0e8', edge: '#8a9ab8', roof: '#3a4260' };
    const rect = (x, y, w, h, c) => p.rect(x, y, w, h, c);
    const cx = 206, base = HORIZON - 9;
    rect(cx - 16, base - 6, 32, 7, C.dark);                       // the terraces of the town
    for (let x = cx - 16; x < cx + 16; x += 4) rect(x, base - 9, 3, 3, C.dark);
    rect(cx - 6, base - 18, 12, 13, C.mid);                        // the archive's lower hall
    rect(cx - 4, base - 44, 8, 27, C.mid);                         // the tower
    rect(cx - 5, base - 30, 10, 2, C.edge);                        // a gallery ring
    p.poly([[cx - 5.5, base - 44], [cx + 5.5, base - 44], [cx, base - 54]], C.roof);
    p.vline(cx, base - 58, base - 54, C.lit);
    for (const sx of [cx - 13, cx + 10]) {                         // two small spires
      rect(sx, base - 14, 3, 9, C.mid);
      p.poly([[sx - 0.5, base - 14], [sx + 3.5, base - 14], [sx + 1.5, base - 19]], C.roof);
    }
    // a faint warm haze over the living town and castle
    for (let y = HORIZON - 60; y <= HORIZON; y++) for (let x = cx - 44; x <= cx + 44; x++) {
      const d = Math.hypot((x - cx) / 44, (y - (HORIZON - 12)) / 34);
      if (d >= 1 || p.get(x, y) != null) continue;
      if (bayer(x, y) < (1 - d) * 0.34) p.set(x, y, d < 0.55 ? '#3a3050' : '#2a2848');
    }
    // lit windows (static base; some flicker at runtime)
    const WIN = [[cx - 3, base - 15], [cx + 2, base - 15], [cx, base - 40], [cx, base - 35], [cx, base - 25], [cx - 12, base - 4], [cx - 6, base - 3], [cx + 6, base - 3], [cx + 12, base - 4]];
    for (const [x, y] of WIN) { p.set(x, y, WARM[2]); p.set(x, y + 1, WARM[1]); }
    // the town at the castle's feet: rows of little lights along the shore
    const TOWN = [];
    for (let i = 0; i < 22; i++) {
      const x = 184 + Math.floor(hash(i, 1, 4) * 46), y = HORIZON - 1 - Math.floor(hash(i, 2, 4) * 4);
      if (p.get(x, y) != null) { p.set(x, y, hash(i, 3, 4) < 0.4 ? WARM[3] : WARM[2]); TOWN.push([x, y]); }
    }
    return { canvas: p.toCanvas(), windows: WIN, town: TOWN };
  }

  /** sea below the horizon (the cliff covers its lower-left part) */
  function paintSea() {
    const p = G().pix(W, H);
    for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (y - HORIZON) / (H - HORIZON) * (SEA.length - 1);
      const k = Math.floor(SEA.length - 1 - t + bayer(x, y) - 0.5 + 0.35);
      p.set(x, y, SEA[Math.max(0, Math.min(SEA.length - 1, k))]);
    }
    p.hline(0, W - 1, HORIZON, '#1e3050');
    return p.toCanvas();
  }

  /**
   * The clifftop meadow the heroes stand on: grass lit by the aurora along the
   * ridge and darkening toward the viewer, flowers, tall dark grass framing the
   * bottom edge, a sliver of rock face where it drops to the sea on the right,
   * and a lone pine on the left.
   */
  function paintCliff() {
    const p = G().pix(W, H);
    const edgeX = (y) => 168 + (y - GROUND) * 0.5; // meadow edge line (rock face to its right)
    for (let x = 0; x < W; x++) {
      const top = cliffTop(x);
      if (top === Infinity || top >= H) continue;
      for (let y = top; y < H; y++) {
        const d = y - top;
        if (x > edgeX(y)) {
          // rock face dropping to the sea: dark strata, the outer edge lit
          const n = vnoise(x * 2, y, 4, 7);
          let c = ROCK[Math.max(0, Math.min(4, Math.floor(n * 3.4 + bayer(x, y) - 0.3)))];
          if ((y + Math.floor(n * 5)) % 7 === 0) c = ROCK[0];
          p.set(x, y, c);
          continue;
        }
        // meadow: lit along the ridge, darker toward the viewer, clumpy
        const clump = vnoise(x, y * 1.6, 7, 3) - 0.5;
        const t = 4.1 - d / 13 + clump * 1.6 + (x > 150 ? -0.4 : 0);
        const k = Math.floor(t + bayer(x, y) - 0.5);
        p.set(x, y, GRASS[Math.max(0, Math.min(4, k))]);
      }
      // grass blades: short strokes a shade lighter, tips lit near the ridge
      for (let y = top + 2; y < H; y += 3) {
        if (x > edgeX(y) - 1 || hash(x, y, 18) > 0.4) continue;
        const cur = p.get(x, y), i = GRASS.indexOf(cur);
        if (i < 0) continue;
        const len = 2 + Math.floor(hash(x, y, 19) * 3);
        for (let k = 0; k < len; k++) p.set(x, y - k, GRASS[Math.min(5, i + (k === len - 1 && y - top < 14 ? 2 : 1))]);
      }
      // tufts on the ridge line, tips lit by the aurora
      if (x < edgeX(top) && hash(x, 0, 5) < 0.6) {
        const hgt = 1 + Math.floor(hash(x, 1, 5) * 3);
        for (let k = 1; k <= hgt; k++) p.set(x, top - k, k === hgt ? (hash(x, 2, 5) < 0.5 ? LIT : GRASS[5]) : GRASS[4]);
      }
    }
    // the rock face's outer edge catches the aurora
    for (let y = GROUND - 8; y < H; y++) {
      let x = W - 1;
      while (x > 0 && p.get(x, y) == null) x--;
      if (x <= 0 || x > 200 || x < edgeX(y)) continue;
      p.set(x, y, hash(x, y, 14) < 0.6 ? '#2c6a5c' : '#3e8a70');
      if (hash(x, y, 15) < 0.5) p.set(x - 1, y, '#1c3a40');
    }
    // the meadow's edge above the drop: a lit lip of grass
    for (let y = GROUND; y < H; y++) {
      const x = Math.floor(edgeX(y));
      if (p.get(x, y) != null && hash(x, y, 20) < 0.7) p.set(x, y, GRASS[4]);
    }
    // flowers: tiny on the ridge, bigger toward the viewer
    for (let i = 0; i < 60; i++) {
      const x = 4 + Math.floor(hash(i, 7, 6) * 186), top = cliffTop(x);
      if (top === Infinity) continue;
      const y = top + 1 + Math.floor(Math.pow(hash(i, 8, 6), 1.6) * (H - top - 4));
      if (x > edgeX(y) - 2) continue;
      const col = hash(i, 9, 6) < 0.45 ? ['#e8f0ff', '#9aa8d0'] : hash(i, 9, 6) < 0.8 ? ['#b0c8ff', '#5a6ab0'] : ['#ffd8f0', '#a07098'];
      p.set(x, y, col[0]);
      if (y - top > 30) { p.set(x + 1, y, col[1]); p.set(x, y + 1, col[1]); p.set(x - 1, y, col[1]); p.set(x, y - 1, col[0]); p.set(x, y + 2, GRASS[2]); }
    }
    // tall dark grass framing the bottom edge, a few blades lit
    for (let x = 0; x < W; x++) {
      if (hash(x, 3, 22) > 0.55) continue;
      const base = H, hgt = 5 + Math.floor(Math.pow(hash(x, 4, 22), 2) * 16) - (x > 150 && x < 200 ? 6 : 0);
      const lean = (hash(x, 5, 22) - 0.5) * 0.5;
      for (let k = 0; k < hgt; k++) {
        const X = Math.round(x + lean * k), Y = base - 1 - k;
        if (X < 0 || X >= W) continue;
        p.set(X, Y, k === hgt - 1 && hash(x, 6, 22) < 0.25 ? '#2a6a48' : '#030806');
      }
    }
    // lone pine at the left edge: layered boughs, the right edges lit
    const tx = 18, tb = cliffTop(tx) + 1;
    p.rect(tx - 1, tb - 16, 3, 16, '#0a0806');
    for (let k = 0; k < 7; k++) {
      const yb = tb - 12 - k * 9, w = 15 - k * 1.9;
      p.poly([[tx - w, yb], [tx + w + 1, yb], [tx + 0.5, yb - 14]], '#06100c');
      for (let x = Math.round(tx - w); x <= Math.round(tx + w); x++) if (hash(x, yb, 12) < 0.4) p.set(x, yb, '#06100c');
    }
    p.each((x, y, c) => {
      if (c !== '#06100c') return undefined;
      if (p.get(x + 1, y) == null && y < tb - 8) return hash(x, y, 13) < 0.7 ? '#1c5a44' : LIT;
      if (p.get(x, y - 1) == null) return '#0e2a20';
      return undefined;
    });
    return p.toCanvas();
  }

  /** a party member's back view (a CharState), darkened for the night and rim-lit by the aurora */
  function heroSprite(c) {
    const key = c && R.Party && R.Party.spriteKey ? R.Party.spriteKey(c) : null;
    const s = key && G().has(key) ? G().get(key) : null;
    if (!s) return null;
    const f = s.getContext ? s : (Array.isArray(s.up) ? s.up[0] : s.up || (Array.isArray(s.down) ? s.down[0] : s.down));
    if (!f) return null;
    const w = f.width, h = f.height;
    const cv = G().makeCanvas(w, h), cx = cv.getContext('2d');
    cx.drawImage(f, 0, 0);
    const id2 = cx.getImageData(0, 0, w, h), d = id2.data;
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
    const src = new Uint8ClampedArray(d);
    const sa = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!a(x, y)) continue;
      // night tint: darker, cooler
      d[i] = d[i] * 0.52 + 6; d[i + 1] = d[i + 1] * 0.58 + 10; d[i + 2] = d[i + 2] * 0.66 + 30;
      // aurora rim light on the upper-left edges
      if (!sa(x, y - 1) || !sa(x - 1, y)) { d[i] = d[i] * 0.4 + 0x7e * 0.6; d[i + 1] = d[i + 1] * 0.4 + 0xf0 * 0.6; d[i + 2] = d[i + 2] * 0.4 + 0xb0 * 0.6; }
    }
    cx.putImageData(id2, 0, 0);
    return cv;
  }

  // ------------------------------------------------------------ aurora (animated)
  function makeAurora() {
    const cv = G().makeCanvas(W, HORIZON), ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, HORIZON), d = img.data;
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const G6 = AUR_G.map(rgb), V5 = AUR_V.map(rgb);
    /** curtain: bottom edge yb(x), height hh(x), strength st(x) */
    const curtains = [
      { ramp: V5, base: 30, amp: 10, len: 30, f: 0.021, sp: 0.011, ph: 1.7, x0: 60, x1: 256, st: 0.7 },
      { ramp: G6, base: 66, amp: 16, len: 44, f: 0.017, sp: 0.014, ph: 0, x0: 0, x1: 256, st: 1 },
      { ramp: G6, base: 48, amp: 8, len: 22, f: 0.03, sp: 0.02, ph: 3.1, x0: 110, x1: 256, st: 0.55 },
    ];
    return {
      canvas: cv,
      render(t) {
        d.fill(0);
        for (const c of curtains) {
          const n = c.ramp.length;
          for (let x = c.x0; x < c.x1; x++) {
            const fade = Math.min(1, (x - c.x0) / 40, (c.x1 - x) / 40 + 0.4);
            const yb = c.base - x * 0.16 + c.amp * Math.sin(x * c.f + t * c.sp + c.ph) + 4 * Math.sin(x * c.f * 3.1 - t * c.sp * 1.7);
            // vertical rays: brightness ripples along x and drifts over time
            const ray = 0.55 + 0.45 * Math.sin(x * 0.19 + t * c.sp * 3 + Math.sin(x * 0.05 + t * 0.004) * 3);
            const st = c.st * fade * (0.6 + 0.4 * ray);
            const len = c.len * (0.7 + 0.3 * ray);
            const y0 = Math.max(0, Math.floor(yb - len)), y1 = Math.min(HORIZON - 1, Math.floor(yb + 2));
            // fine vertical folds of the curtain, drifting slowly sideways
            const fold = 0.5 + 0.5 * Math.sin(x * 0.62 + Math.sin(x * 0.11 + t * 0.006) * 2.6 + t * 0.01);
            for (let y = y0; y <= y1; y++) {
              const u = (yb - y) / len; // 0 at the bottom edge, 1 at the top
              let v = u < 0 ? 1 + u * 1.5 : Math.pow(Math.max(0, 1 - u), 1.6);
              v *= st * (u > 0.12 ? 0.55 + 0.6 * fold : 1);
              if (v <= 0.04) continue;
              if (bayer(x, y) > v * 1.35) continue;
              const k = Math.max(0, Math.min(n - 1, Math.floor(v * (n - 0.01) + (u < 0.08 ? 1 : 0))));
              const [r, g, b] = c.ramp[k], i = (y * W + x) * 4;
              if (d[i + 3] && k <= d[i + 3] / 40) continue; // keep the brighter curtain on top
              d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 40 * k + 40;
            }
          }
        }
        for (let i = 3; i < d.length; i += 4) if (d[i]) d[i] = 255;
        ctx.putImageData(img, 0, 0);
      },
    };
  }

  // ------------------------------------------------------------ the layer
  class BonusLayer extends R.Layer {
    constructor(opts) {
      super();
      this.opaque = true;
      this.t = 0;
      this.phase = 'paint'; // paint → text → title → end
      this.pages = (opts && opts.pages) || PAGES;
      this.title = opts && opts.title != null ? opts.title : (R.Game && R.Game.title) || '';
      this.page = -1;
      this.shown = 0;
      this.phaseT = 0;
      this.done = null;
      this.back = paintBack();
      const land = paintLand();
      this.land = land.canvas; this.windows = land.windows; this.town = land.town;
      this.sea = paintSea();
      this.cliff = paintCliff();
      this.aurora = makeAurora();
      this.aurora.render(0);
      this.heroes = (R.Game && R.Game.party ? R.Game.party : []).map((c) => heroSprite(c));
      this.stars = [];
      for (let i = 0; i < 46; i++) {
        this.stars.push({ x: Math.floor(hash(i, 1, 21) * W), y: Math.floor(hash(i, 2, 21) * (HORIZON - 14)), p: hash(i, 3, 21) * 6.28, s: 0.02 + hash(i, 4, 21) * 0.05, big: hash(i, 5, 21) < 0.2, c: hash(i, 6, 21) < 0.3 ? '#fff0c8' : hash(i, 6, 21) < 0.6 ? '#c8e4ff' : '#ffffff' });
      }
      this.motes = [];
      for (let i = 0; i < 12; i++) this.motes.push({ x: 20 + hash(i, 1, 31) * 170, y: GROUND - hash(i, 2, 31) * 40, v: 0.08 + hash(i, 3, 31) * 0.12, p: hash(i, 4, 31) * 6.28 });
      this.shoot = null;
    }
    tick() {
      this.t++; this.phaseT++;
      if (this.t % 2 === 0) this.aurora.render(this.t);
      for (const m of this.motes) {
        m.y -= m.v; m.x += Math.sin(this.t * 0.02 + m.p) * 0.15;
        if (m.y < HORIZON - 30) { m.y = GROUND - 2; m.x = 20 + ((m.x * 7.3) % 170); }
      }
      if (!this.shoot && this.t % 260 === 120) this.shoot = { x: 60 + (this.t * 37) % 140, y: 8 + (this.t * 13) % 30, k: 0 };
      if (this.shoot && ++this.shoot.k > 26) this.shoot = null;
      if (this.phase === 'text' && this.page >= 0) {
        const len = R.Text ? R.Text.fmt(this.pages[this.page]).length : this.pages[this.page].length;
        const sp = [0.5, 1, 2, 999][R.Settings ? R.Settings.msgSpeed : 2] || 2;
        if (this.shown < len) this.shown = Math.min(len, this.shown + sp);
      }
    }
    update() {
      const a = In().pressed('a'), b = In().pressed('b');
      if (this.phase === 'paint') {
        if (this.phaseT > 150 || ((a || b) && this.phaseT > 40)) { this.phase = 'text'; this.page = 0; this.shown = 0; this.phaseT = 0; }
        return;
      }
      if (this.phase === 'text') {
        const len = R.Text.fmt(this.pages[this.page]).length;
        if (this.shown < len) { if (a) this.shown = len; return; }
        if (a || b) {
          R.sfx('confirm_soft');
          if (this.page < this.pages.length - 1) { this.page++; this.shown = 0; this.phaseT = 0; }
          else { this.phase = this.title ? 'title' : 'end'; this.phaseT = 0; if (this.title) R.sfx('item'); }
        }
        return;
      }
      if (this.phase === 'title') {
        if (this.phaseT > 60 && (a || b)) { R.sfx('confirm_soft'); this.phase = 'end'; this.phaseT = 0; }
        return;
      }
      if (this.phase === 'end' && this.phaseT > 90 && (a || b) && this.done) {
        R.sfx('confirm');
        const r = this.done; this.done = null; r();
      }
    }
    draw() {
      const g = G(), t = this.t;
      g.draw(this.back, 0, 0);
      // twinkling bright stars (behind the aurora)
      for (const s of this.stars) {
        const k = 0.5 + 0.5 * Math.sin(s.p + t * s.s);
        if (k < 0.25) continue;
        g.rect(s.x, s.y, 1, 1, s.c);
        if (s.big && k > 0.7) { g.ctx.globalAlpha = (k - 0.7) * 2.5; g.rect(s.x - 1, s.y, 3, 1, s.c); g.rect(s.x, s.y - 1, 1, 3, s.c); g.ctx.globalAlpha = 1; }
      }
      if (this.shoot) {
        const sh = this.shoot;
        for (let i = 0; i < 8; i++) {
          const x = sh.x + (sh.k - i) * 3, y = sh.y + (sh.k - i) * 1.2;
          if (i > sh.k) break;
          g.ctx.globalAlpha = (1 - i / 8) * Math.min(1, (26 - sh.k) / 8);
          g.rect(Math.round(x), Math.round(y), 1, 1, i ? '#b8d8ff' : '#ffffff');
        }
        g.ctx.globalAlpha = 1;
      }
      g.draw(this.aurora.canvas, 0, 0);
      // the ring of stars (the sleeping dragon), turning very slowly
      for (let i = 0; i < RING.n; i++) {
        const a = (i / RING.n) * Math.PI * 2 + t * 0.0008;
        const x = Math.round(RING.x + Math.cos(a) * RING.r), y = Math.round(RING.y + Math.sin(a) * RING.r * 0.9);
        const k = 0.6 + 0.4 * Math.sin(t * 0.04 + i * 1.7);
        g.ctx.globalAlpha = k;
        g.rect(x, y, 1, 1, '#fffbe8');
        if (i % 2 === 0) { g.ctx.globalAlpha = k * 0.6; g.rect(x - 1, y, 3, 1, '#ffe8a8'); g.rect(x, y - 1, 1, 3, '#ffe8a8'); }
      }
      g.ctx.globalAlpha = 1;
      g.draw(this.sea, 0, 0);
      // the aurora and the town lights mirrored on the sea as shimmering streaks
      for (let y = HORIZON + 2; y < H; y += 2) {
        const dy = y - HORIZON;
        for (let k = 0; k < 3; k++) {
          const x = Math.floor((hash(y, k, 41) * W + Math.sin(t * 0.03 + y * 0.4 + k) * 3 + W) % W);
          const w = 2 + Math.floor(hash(y, k, 42) * 6) - Math.floor(dy / 30);
          if (w < 1) continue;
          g.ctx.globalAlpha = Math.max(0, 0.55 - dy / 140);
          g.rect(x, y, w, 1, k === 2 ? AUR_V[2] : AUR_G[k + 2]);
        }
      }
      g.ctx.globalAlpha = 1;
      for (const [x] of this.windows.concat(this.town)) {
        for (let y = HORIZON + 2; y < HORIZON + 22; y += 2) {
          if ((y + Math.floor(t / 8)) % 5 === 0) continue;
          g.ctx.globalAlpha = 0.35 * (1 - (y - HORIZON) / 24);
          g.rect(x + Math.round(Math.sin(t * 0.05 + y) * 0.8), y, 1, 1, WARM[2]);
        }
      }
      g.ctx.globalAlpha = 1;
      g.draw(this.land, 0, 0);
      // a few windows flicker
      this.windows.forEach(([x, y], i) => { if (Math.sin(t * 0.03 + i * 2.1) > 0.85) g.rect(x, y, 1, 2, WARM[1]); });
      g.draw(this.cliff, 0, 0);
      // the heroes, seen from behind at 2x, standing at the cliff's edge
      const n = this.heroes.length;
      this.heroes.forEach((img, i) => {
        if (!img) return;
        const x = 104 + (i - (n - 1) / 2) * 30, fy = cliffTop(Math.round(x)) + 2;
        const w = img.width * 2, h = img.height * 2;
        // backlit: a soft shadow falls toward the viewer
        g.ctx.globalAlpha = 0.45; g.rect(Math.round(x - 10), fy - 1, 20, 3, '#020604'); g.rect(Math.round(x - 7), fy + 2, 14, 2, '#020604'); g.ctx.globalAlpha = 1;
        g.draw(img, Math.round(x - w / 2), fy - h, { w, h });
      });
      // light motes drifting up from the grass
      for (const m of this.motes) {
        const k = 0.5 + 0.5 * Math.sin(t * 0.05 + m.p * 3);
        g.ctx.globalAlpha = 0.3 + 0.7 * k;
        g.rect(Math.round(m.x), Math.round(m.y), 1, 1, k > 0.7 ? '#e8fff0' : LIT);
      }
      g.ctx.globalAlpha = 1;
      this.drawText();
    }
    drawText() {
      const g = G();
      const band = (k) => {
        // dark band at the bottom, fading upward
        for (let i = 0; i < 18; i++) { g.ctx.globalAlpha = (i + 1) / 18 * 0.8 * k; g.rect(0, 158 + i, W, 1, '#02030a'); }
        g.ctx.globalAlpha = 0.8 * k; g.rect(0, 176, W, H - 176, '#02030a'); g.ctx.globalAlpha = 1;
      };
      if (this.phase === 'text' && this.page >= 0) {
        band(1);
        const lines = R.Text.fmt(this.pages[this.page]).split('\n');
        let left = Math.floor(this.shown);
        const y0 = 166 + Math.max(0, (4 - lines.length) * 7);
        lines.forEach((l, i) => {
          if (left <= 0) return;
          const s = l.slice(0, left); left -= l.length;
          const x = Math.round(W / 2 - g.textWidth(l) / 2);
          g.text(s, x, y0 + i * 14, { color: '#eef2ff', shadow: '#000' });
        });
        const len = R.Text.fmt(this.pages[this.page]).length;
        if (this.shown >= len) g.moreArrow(W / 2 - 3, 216);
      }
      if (this.phase === 'title') {
        g.ctx.globalAlpha = 0.72 * Math.min(1, this.phaseT / 20); g.rect(0, 0, W, H, '#02030a'); g.ctx.globalAlpha = 1;
        const k = Math.min(1, this.phaseT / 40);
        g.ctx.globalAlpha = k;
        g.text('称号', W / 2, 78, { align: 'center', color: '#b8c4ff', shadow: '#000' });
        const tw = g.textWidth(this.title, 16);
        g.window(Math.round(W / 2 - tw / 2 - 14), 96, Math.round(tw + 28), 32);
        g.text(this.title, W / 2, 103, { align: 'center', size: 16, color: '#ffe890', shadow: '#402000' });
        g.text('を手に入れた！', W / 2, 138, { align: 'center', color: '#eef2ff', shadow: '#000' });
        // a few sparkles round the plate
        for (let i = 0; i < 6; i++) {
          const a = this.t * 0.03 + i * 1.05, x = W / 2 + Math.cos(a) * (tw / 2 + 24), y = 112 + Math.sin(a * 1.3) * 22;
          g.rect(Math.round(x), Math.round(y), 1, 1, i % 2 ? '#ffe890' : '#ffffff');
        }
        g.ctx.globalAlpha = 1;
      }
      if (this.phase === 'end') {
        // the painting stays in view; 「おしまい」 settles into the band below it
        band(1);
        const k = Math.min(1, this.phaseT / 70);
        g.ctx.globalAlpha = k;
        g.text('おしまい', W / 2, 172, { align: 'center', size: 21, color: '#ffffff', shadow: '#1a1040' });
        if (this.title) g.text('称号：' + this.title, W / 2, 198, { align: 'center', size: 8, color: '#ffe890', shadow: '#000' });
        g.ctx.globalAlpha = 1;
        if (this.phaseT > 90 && Math.floor(this.t / 30) % 2 === 0) g.moreArrow(W / 2 - 3, 214);
      }
    }
  }

  let current = null;

  R.Postgame = R.Postgame || {};
  Object.assign(R.Postgame, {
    PAGES,
    /** play the bonus scene; resolves after it has faded back out */
    async bonusScene(opts) {
      const prevBgm = R.Audio && R.Audio.current;
      await R.Engine.fadeOut(40);
      if (R.UI && R.UI.closeMessage) R.UI.closeMessage();
      const L = new BonusLayer(opts);
      current = L;
      R.Engine.push(L);
      R.Input.consume();
      R.bgm('ending');
      await R.Engine.fadeIn(80);
      await new Promise((res) => { L.done = res; });
      await R.Engine.fadeOut(80);
      R.Engine.remove(L);
      current = null;
      const back = opts && 'bgm' in opts ? opts.bgm : prevBgm || (R.Field && R.Field.map && R.Field.map.bgm) || null;
      if (back) R.bgm(back); else if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(30);
      R.Input.consume();
      if (!opts || opts.fadeBack !== false) await R.Engine.fadeIn(40);
    },
    /** current phase of the running scene ('paint'|'text'|'title'|'end'), for tools */
    _state() { return current ? current.phase : null; },
  });
})(window.RPG);
