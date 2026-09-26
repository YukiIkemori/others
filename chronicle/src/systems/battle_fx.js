// Battle effects: procedural spell/attack animations, damage digits, status
// icons, monster dissolve frames. Every sprite is built once (R.Gfx.def 'bfx:*'
// keys or a cache on the source canvas); per frame we only blit.
// Owner: SV-SCENE (was bui A3). Spec: DESIGN §11.5.6 (digits), §11.3.6 (status icons),
// §11.5.12 / §6.2.6 (fx ids and their directions, Part A8), §7.3.4-7 (fx arrays — chained by the scene).
//
// R.BattleFX.play(scene, fxId, ctx) starts an animation and returns the number
// of frames until its impact. ctx: {user: rect|null, targets:[rect], ab, kind, rate, dir}
// rect = {x,y,w,h,cx,cy,bottom,side:'mon'|'party'} (+ for members, Part A8 side view: feet head hand tip cast
// points of the battle sprite). dir (§11.5.12 Part A8): −1 party → enemy (leftward), +1 enemy → party
// (rightward), 0 same side / self. Every instance is 'mid' (inside the battlefield, clipped to y < 152 by the
// scene). ctx.rate > 1 plays the effect faster (the 2nd+ fx of an fx array run at 60 % length: rate = 1 / 0.6).
//
// fx ids — data writes them EXACTLY (DESIGN §11.5.12); an optional trailing digit 1–3 is the size:
//   slash pierce strike claw bite arrow lash stance · fire ice thunder wind earth water holy dark
//   explosion breath(_fire/_ice/_poison/_dark) drain gravity death · heal mp cure revive regen
//   buff debuff dispel · sleep poison paralyze confuse silence blind burn freeze stun veil nimble
//   steal scan smoke song grow magic warp cast
// KEYWORDS below only map old/loose ids (compatibility) and match on word boundaries.
(function (R) {
  'use strict';
  const U = R.U;
  const G = () => R.Gfx;
  const DB = R.DB;

  // ---------------------------------------------------------------- sprites
  const px = (w, h) => G().pix(w, h);
  const def = (k, f) => G().def('bfx:' + k, f);
  const get = (k) => G().get('bfx:' + k);

  // teardrop flame shape into p
  function flame(p, cx, by, r, cols) {
    p.ellipse(cx, by - r, r, r, cols[0]);
    p.poly([[cx - r * 0.8, by - r * 1.2], [cx + r * 0.8, by - r * 1.2], [cx + 0.5, by - r * 3.1]], cols[0]);
    if (r > 2) flame1(p, cx, by - 1, r - 1.6, cols.slice(1));
  }
  function flame1(p, cx, by, r, cols) { if (!cols.length || r < 1) return; flame(p, cx, by, r, cols); }
  def('flame', () => {
    const out = [];
    const C = ['#c8281c', '#ff7a1c', '#ffd23c', '#fff6c8'];
    const specs = [[2.6, C.slice(1)], [4.2, C], [4.6, ['#a81c14', '#f05a18', '#ffb030']], [3.6, ['#6a2418', '#8a3a24']]];
    specs.forEach(([r, cols], i) => {
      const p = px(16, 16);
      flame(p, 8, 15, r, cols);
      if (i === 2) { p.set(4, 5, '#ffb030'); p.set(12, 4, '#f05a18'); }
      if (i === 3) p.each((x, y) => ((x + y) % 2 ? null : undefined));
      out.push(p.toCanvas());
    });
    return out;
  });
  def('spark', () => {
    const p = px(9, 9);
    for (let i = 0; i <= 4; i++) { p.set(4, i, '#ffe45a'); p.set(4, 8 - i, '#ffe45a'); p.set(i, 4, '#ffe45a'); p.set(8 - i, 4, '#ffe45a'); }
    p.set(2, 2, '#fff2a0'); p.set(6, 2, '#fff2a0'); p.set(2, 6, '#fff2a0'); p.set(6, 6, '#fff2a0');
    p.rect(3, 3, 3, 3, '#ffffff'); p.set(4, 1, '#ffffff'); p.set(4, 7, '#ffffff'); p.set(1, 4, '#ffffff'); p.set(7, 4, '#ffffff');
    return p.toCanvas();
  });
  const TW = { white: '#d8e8ff', green: '#6ee07a', cyan: '#6fd8ff', gold: '#ffd24a', purple: '#c38cff', red: '#ff5a4a', pink: '#ff8cc6', blue: '#4a78ff', orange: '#ffa53c' };
  for (const k in TW) {
    def('tw_' + k, () => {
      const p = px(7, 7);
      p.hline(0, 6, 3, TW[k]); p.vline(3, 0, 6, TW[k]);
      p.hline(2, 4, 3, '#ffffff'); p.vline(3, 2, 4, '#ffffff');
      return p.toCanvas();
    });
    def('orb_' + k, () => {
      const p = px(9, 9);
      p.shadeEllipse(4, 4, 3.6, 3.6, G().ramp(TW[k], 4, 0.5));
      p.set(3, 3, '#ffffff');
      return p.toCanvas();
    });
    def('glow_' + k, () => {
      const p = px(32, 32);
      const c = TW[k].slice(0, 7);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5) / 16;
        if (d >= 1) continue;
        const a = Math.round((1 - d) * (1 - d) * 150);
        p.set(x, y, c + a.toString(16).padStart(2, '0'));
      }
      return p.toCanvas();
    });
  }
  def('shard', () => {
    const p = px(7, 13);
    p.poly([[3.5, 0], [7, 6.5], [3.5, 13], [0, 6.5]], '#8ad8ff');
    p.poly([[3.5, 0], [3.5, 13], [0, 6.5]], '#e0f8ff');
    p.vline(3, 2, 10, '#ffffff');
    p.outline('#2a6ab0');
    return p.toCanvas();
  });
  def('rock', () => {
    const p = px(11, 10);
    p.shadeEllipse(5, 5, 4.5, 4, ['#3c2a1c', '#6a4a2c', '#96704a', '#c09a6a']);
    p.set(3, 3, '#e0c090'); p.set(7, 6, '#3c2a1c'); p.set(6, 7, '#3c2a1c');
    p.outline('#20160e');
    return p.toCanvas();
  });
  def('drop', () => {
    const p = px(6, 8);
    p.ellipse(2.5, 5, 2.2, 2.2, '#3a8aff'); p.poly([[1, 4], [4, 4], [2.5, 0]], '#3a8aff');
    p.set(2, 4, '#c8ecff'); p.set(1, 5, '#8ac8ff');
    return p.toCanvas();
  });
  def('bubble', () => {
    const p = px(8, 8);
    p.ellipse(3.5, 3.5, 3, 3, '#8ad0ff');
    p.each((x, y) => (Math.hypot(x - 3.5, y - 3.5) < 2.2 ? null : undefined));
    p.set(2, 2, '#ffffff');
    return p.toCanvas();
  });
  def('bubble_green', () => G().hsvShift(get('bubble'), -80, 1.1, 0.95));
  def('leaf', () => {
    const p = px(11, 6);
    for (let x = 0; x < 11; x++) {
      const y = Math.round(3 - Math.sin((x / 10) * Math.PI) * 2.5);
      p.set(x, y + 1, '#9af0c0'); p.set(x, y + 2, x > 2 && x < 9 ? '#ffffff' : '#9af0c0');
    }
    return p.toCanvas();
  });
  def('smoke', () => {
    const out = [];
    for (let f = 0; f < 3; f++) {
      const p = px(20, 20);
      const r = 5 + f * 2;
      p.shadeEllipse(10, 11, r, r - 1, ['#5a5a66', '#7c7c88', '#a0a0ac', '#c8c8d0']);
      p.shadeEllipse(6, 12, r * 0.6, r * 0.5, ['#6a6a76', '#9a9aa6', '#c0c0cc']);
      p.shadeEllipse(14, 12, r * 0.6, r * 0.5, ['#6a6a76', '#9a9aa6', '#c0c0cc']);
      if (f === 2) p.each((x, y) => ((x * 3 + y) % 4 === 0 ? null : undefined));
      out.push(p.toCanvas());
    }
    return out;
  });
  def('slash', () => {
    const out = [];
    const S = 48;
    for (let f = 0; f < 3; f++) {
      const p = px(S, S);
      const from = f === 2 ? 0.4 : 0, to = f === 0 ? 0.6 : 1;
      for (let i = 0; i <= 90; i++) {
        const q = from + ((to - from) * i) / 90;
        const x = (1 - q) * (1 - q) * (S - 3) + 2 * (1 - q) * q * (S * 0.78) + q * q * 3;
        const y = (1 - q) * (1 - q) * 2 + 2 * (1 - q) * q * (S * 0.78) + q * q * (S - 3);
        const head = f === 2 ? 0 : Math.max(0, 1 - Math.abs(q - to) * 4);
        const th = f === 2 ? 1.5 : 1.5 + Math.sin(q * Math.PI) * 3;
        const col = f === 2 ? '#8ab8ff' : head > 0.3 ? '#ffffff' : q > to - 0.45 ? '#e0ecff' : '#9ac0ff';
        p.rect(Math.round(x - th / 2), Math.round(y - th / 2), Math.ceil(th), Math.ceil(th), col);
      }
      if (f === 2) p.each((x, y) => ((x + y) % 2 ? null : undefined));
      out.push(p.toCanvas());
    }
    return out;
  });
  // golden variant of the slash arc (slash3 finisher)
  def('slash_gold', () => get('slash').map((c) => G().mapColors(c, (r, g, b) => [Math.min(255, r + 30), Math.min(255, g + 10), Math.max(0, b - 90)])));
  def('geyser', () => {
    const p = px(24, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 24; x++) {
      const d = Math.abs(x - 11.5) / 12;
      if (d > 0.95 - (y < 6 ? (6 - y) * 0.1 : 0)) continue;
      const stripe = (x * 3 + y * 5) % 11 < 2;
      const col = d < 0.3 ? (stripe ? '#ffffff' : '#bfe8ff') : d < 0.65 ? (stripe ? '#e0f4ff' : '#6ab8ff') : '#3a7ae8';
      p.set(x, y, col + 'd0');
    }
    return p.toCanvas();
  });
  def('claw', () => {
    const out = [];
    for (let f = 0; f < 3; f++) {
      const p = px(30, 30);
      const len = [0.45, 1, 1][f];
      for (let k = 0; k < 3; k++) {
        const ox = k * 7;
        for (let i = 0; i <= 30 * len; i++) {
          const x = 3 + ox + i * 0.55, y = 2 + i * 0.9;
          const th = Math.sin((i / 30) * Math.PI) * 2 + 1;
          p.rect(Math.round(x), Math.round(y), Math.ceil(th), 2, f === 2 ? '#ff8a7a' : i > 30 * len - 5 ? '#ffffff' : '#ffd0c8');
        }
      }
      if (f === 2) p.each((x, y) => ((x + y) % 2 ? null : undefined));
      out.push(p.toCanvas());
    }
    return out;
  });
  def('fang', () => {
    const p = px(28, 10);
    p.rect(0, 0, 28, 3, '#e8e0d0');
    for (let i = 0; i < 6; i++) p.poly([[i * 4.6 + 0.5, 2], [i * 4.6 + 4.5, 2], [i * 4.6 + 2.5, i === 0 || i === 5 ? 9.5 : 7]], '#fffaf0');
    p.outline('#5a2020');
    return p.toCanvas();
  });
  def('fang_lo', () => {
    const src = get('fang'), out = G().makeCanvas(src.width, src.height), x = out.getContext('2d');
    x.translate(0, src.height); x.scale(1, -1); x.drawImage(src, 0, 0);
    return out;
  });
  const RING_R = [4, 7, 10, 14, 18, 23, 28, 34];
  function ring(r, col) {
    const k = 'ring' + r + col;
    if (!G().has('bfx:' + k)) def(k, () => {
      const n = Math.ceil(r) * 2 + 3, c = n / 2 - 0.5;
      const p = px(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const d = Math.hypot(x - c, y - c); if (d <= r + 0.6 && d >= r - 0.6) p.set(x, y, col); }
      return p.toCanvas();
    });
    return get(k);
  }
  def('arrow_up', () => {
    const p = px(9, 11);
    p.poly([[4.5, 0], [9, 5], [6, 5], [6, 11], [3, 11], [3, 5], [0, 5]], '#6ab8ff');
    p.vline(4, 2, 10, '#d8f0ff');
    p.outline('#1a3a8a');
    return p.toCanvas();
  });
  def('arrow_down', () => {
    const c = G().flipH(get('arrow_up'));
    const out = G().makeCanvas(c.width, c.height), x = out.getContext('2d');
    x.translate(0, c.height); x.scale(1, -1); x.drawImage(c, 0, 0);
    return G().hsvShift(out, 150, 1.2, 1);
  });
  def('note', () => G().fromGrid([
    '...##.', '...###', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'], { '#': '#ffe45a' }));
  def('zzz', () => G().fromGrid([
    '######', '....##', '...##.', '..##..', '.##...', '######'], { '#': '#d0b0ff' }));
  def('skull', () => {
    const p = G().pix(11, 11);
    p.grid(0, 0, [
      '..#######..', '.#########.', '###########', '##..###..##', '##..###..##', '###########',
      '.####.####.', '..#######..', '..#.#.#.#..', '..#######..', '...........'], { '#': '#e8e8f0', '.': null });
    p.outline('#301830');
    return p.toCanvas();
  });
  def('pillar', () => {
    const p = px(24, 150);
    for (let y = 0; y < 150; y++) for (let x = 0; x < 24; x++) {
      const d = Math.abs(x - 11.5) / 12;
      const fade = Math.min(1, y / 40);
      const a = Math.round((1 - d * d) * 200 * fade);
      if (a < 12) continue;
      const col = d < 0.25 ? '#ffffff' : d < 0.55 ? '#fff4c0' : '#ffd24a';
      p.set(x, y, col + a.toString(16).padStart(2, '0'));
    }
    return p.toCanvas();
  });
  // stun stars (5-point, 7×7)
  def('star', () => G().fromGrid(['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'], { '#': '#ffe45a' }));
  def('star_w', () => G().fromGrid(['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'], { '#': '#ffffff' }));
  // veil: small hexagon plate
  def('hex', () => {
    const p = px(9, 9);
    p.poly([[4.5, 0], [9, 2.5], [9, 6.5], [4.5, 9], [0, 6.5], [0, 2.5]], '#9ce8ff');
    p.poly([[4.5, 1.5], [7.5, 3], [7.5, 6], [4.5, 7.5], [1.5, 6], [1.5, 3]], '#e8fbff');
    p.set(3, 3, '#ffffff');
    return p.toCanvas();
  });
  // glimmer bulb fallback (obj:glimmer belongs to art-chars; used only while it is not registered)
  def('bulb', () => {
    const out = [];
    for (let f = 0; f < 2; f++) {
      const p = px(16, 16);
      const ray = f ? '#fff6b0' : '#ffe45a';
      const rays = f ? [[8, 0], [8, 1], [2, 2], [14, 2], [1, 7], [15, 7], [3, 12], [13, 12], [3, 3], [13, 3], [0, 7]] : [[8, 0], [8, 1], [1, 7], [15, 7], [2, 2], [14, 2]];
      for (const [x, y] of rays) p.set(x, y, ray);
      p.shadeEllipse(8, 7, 4, 4, ['#d8a018', '#ffd23c', '#ffe45a', '#fff6c0']);
      p.set(6, 5, '#ffffff'); p.set(7, 4, '#ffffff'); p.set(6, 6, '#ffffff');
      p.rect(6, 11, 5, 1, '#9a9aa8'); p.rect(6, 12, 5, 1, '#6c6c7c'); p.rect(7, 13, 3, 1, '#9a9aa8'); p.rect(7, 14, 3, 1, '#4c4c5c');
      p.outline('#3a2a10');
      out.push(p.toCanvas());
    }
    return out;
  });

  // ------------------------------------------------------------ digits
  const GLYPH = {
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  };
  // colours of the 7×9 digits (DESIGN §11.5.6): damage white, crit yellow, poison purple, burn / WP orange,
  // MP cyan, heal green, miss / cost gray
  const DIGIT_COL = {
    white: ['#ffffff', '#c8c8d8'], green: ['#90ff9c', '#3cc05a'], cyan: ['#b0ecff', '#4aa8e8'], yellow: ['#fff4a0', '#ffc030'],
    red: ['#ffb0a0', '#ff4a3a'], purple: ['#e8c8ff', '#a060e0'], gray: ['#e0e0e0', '#a0a0a0'], orange: ['#ffd49a', '#ffa53c'],
  };
  function glyphs(color) {
    const k = 'digits_' + color;
    if (!G().has('bfx:' + k)) def(k, () => {
      const out = {};
      const [hi, lo] = DIGIT_COL[color] || DIGIT_COL.white;
      for (const ch in GLYPH) {
        const p = px(7, 9);
        GLYPH[ch].forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '#') p.set(x + 1, y + 1, y < 3 ? hi : lo); });
        p.outline('#101018', { diag: true });
        out[ch] = p.toCanvas();
      }
      return out;
    });
    return get(k);
  }

  // ------------------------------------------------------------ status icons (8×8, one colour '#')
  // DESIGN §11.3.6. The window shows them in DB.statuses order, then up / down (scene: iconOrder()).
  const ICONS = {
    poison: [['..#.....', '.###....', '.####...', '######..', '#####...', '.###....', '........', '........'], '#b060e0'],
    burn: [['...#....', '..##....', '..###.#.', '.#####..', '.######.', '.##..##.', '..####..', '........'], '#ff8a30'],
    sleep: [['####....', '..#.....', '.#......', '####.###', '.....#..', '....###.', '........', '........'], '#c8b0ff'],
    paralyze: [['....##..', '...##...', '..####..', '....##..', '...##...', '..##....', '..#.....', '........'], '#ffe45a'],
    freeze: [['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'], '#a8ecff'],
    stun: [['.#####..', '#.....#.', '#.###.#.', '#.#.#.#.', '#.#...#.', '#.####..', '#.......', '........'], '#ffe45a'],
    confuse: [['.#...#..', '###.###.', '.#...#..', '...#....', '..###...', '...#....', '........', '........'], '#ff8cc6'],
    // silence: a speech bubble crossed out (white); blind: an eye (blue) — easy to tell apart at 8 px
    silence: [['.######.', '#......#', '#.#..#.#', '#..##..#', '#.#..#.#', '.######.', '.#......', '#.......'], '#f0f0f0'],
    blind: [['........', '..####..', '.#....#.', '#..##..#', '#..##..#', '.#....#.', '..####..', '........'], '#6fa8ff'],
    regen: [['..##....', '..##....', '######..', '######..', '..##....', '..##....', '........', '........'], '#6ee07a'],
    veil: [['.######.', '#......#', '.######.', '........', '...#....', '..###...', '...#....', '........'], '#9ce8ff'],
    counter: [['#.....#.', '.#...#..', '..#.#...', '...#....', '..#.#...', '.#...#..', '#.....#.', '........'], '#ff9c5a'],
    nimble: [['......#.', '....###.', '..####..', '.####...', '####....', '.#......', '#.......', '........'], '#b8ffb0'],
    cover: [['.######.', '#.####.#', '#.####.#', '#.####.#', '.#.##.#.', '..#..#..', '...##...', '........'], '#d8c8ff'],
    up: [['...#....', '..###...', '.#####..', '...#....', '...#....', '........', '........', '........'], '#6ab8ff'],
    down: [['...#....', '...#....', '.#####..', '..###...', '...#....', '........', '........', '........'], '#ff6a5a'],
  };
  for (const k in ICONS) def('icon_' + k, () => G().fromGrid(ICONS[k][0], { '#': ICONS[k][1] }));

  // ------------------------------------------------------------ dissolve
  /** 12 frames of a monster canvas breaking up (cached on the canvas) */
  function dissolve(img) {
    if (img._bfxDiss) return img._bfxDiss;
    const w = img.width, h = img.height;
    const tmp = G().makeCanvas(w, h), tc = tmp.getContext('2d', { willReadFrequently: true });
    tc.drawImage(img, 0, 0);
    const src = tc.getImageData(0, 0, w, h);
    const frames = [];
    const th = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // noisy threshold, slightly biased so the top dissolves last
      th[y * w + x] = Math.random() * 0.75 + (1 - y / h) * 0.25;
    }
    const N = 12;
    for (let f = 1; f <= N; f++) {
      const cut = f / N;
      const cv = G().makeCanvas(w, h), c = cv.getContext('2d');
      const out = c.createImageData(w, h), d = out.data, s = src.data;
      for (let i = 0; i < w * h; i++) {
        if (!s[i * 4 + 3] || th[i] < cut) continue;
        const k = Math.min(1, cut * 1.4);
        // fade toward a pale violet as it breaks up
        d[i * 4] = s[i * 4] + (220 - s[i * 4]) * k * 0.6;
        d[i * 4 + 1] = s[i * 4 + 1] + (190 - s[i * 4 + 1]) * k * 0.6;
        d[i * 4 + 2] = s[i * 4 + 2] + (255 - s[i * 4 + 2]) * k * 0.6;
        d[i * 4 + 3] = s[i * 4 + 3];
      }
      c.putImageData(out, 0, 0);
      frames.push(cv);
    }
    img._bfxDiss = frames;
    return frames;
  }

  // ------------------------------------------------------------ fallback backdrop
  // Only used when bbg:<id> is not registered at all (art-tiles registers every id with its own fallback).
  const BBG_COL = {
    grass: ['#5a9cff', '#bfe0ff', '#4caf3c', '#2e7a28'], forest: ['#3a7ad8', '#a8d0f0', '#2a7a30', '#1a4a1c'],
    hills: ['#5a9cff', '#c8e4ff', '#7a9c3a', '#4a6a24'], desert: ['#6ab0ff', '#fff0c8', '#e0c070', '#b08a40'],
    snow: ['#8ab0e0', '#e8f0ff', '#e8f0f8', '#a8b8d0'], swamp: ['#5a6a6a', '#a8b0a8', '#4a5a48', '#2a3a2a'],
    wasteland: ['#b08a6a', '#f0c8a0', '#8a6a48', '#5a4028'], sea: ['#4a8ae0', '#c0e0ff', '#2a5cc8', '#1a3a8a'],
    cave: ['#18141c', '#302830', '#4a4038', '#2a241e'], fort: ['#1c1c24', '#3a3a44', '#5a5048', '#3a3028'],
    watercave: ['#101c30', '#203850', '#2a4a6a', '#1a2c44'], pyramid: ['#2a2014', '#5a4428', '#a08050', '#6a5030'],
    ice: ['#1a2a4a', '#4a6a9a', '#a8d0f0', '#6a90c0'], volcano: ['#3a0a08', '#8a2a10', '#5a2a1c', '#3a140c'],
    tower: ['#1a1a3a', '#4a4a7a', '#6a6a8a', '#40405a'], shrine: ['#2a2a4a', '#6a6a9a', '#a0a0c0', '#6a6a8a'],
    castle: ['#2a1a2a', '#5a3a4a', '#8a2a2a', '#5a1a1a'], demon: ['#140814', '#401a40', '#3a1a3a', '#1c0a1c'],
    throne: ['#1c0810', '#50182a', '#6a1a2a', '#3a0a14'],
    tree: ['#10200e', '#2a4a1e', '#4a3a22', '#2a2014'], manor: ['#1a1a28', '#3a3a52', '#4a3a3a', '#2a2020'],
    ship: ['#0a1020', '#2a3a5a', '#5a4430', '#3a2c1e'], mine: ['#140e0a', '#3a2a1a', '#4a3a2a', '#2a2018'],
    library: ['#c8c8d0', '#f0f0f4', '#b8b4a8', '#8a8478'], oblivion: ['#000000', '#303038', '#e8e8ec', '#b0b0b8'],
    ashland: ['#5a2a24', '#a86a50', '#6a6a6a', '#3a3a3a'], jungle: ['#4a9ce0', '#c8f0ff', '#3a8a3a', '#1e5a24'],
    beach: ['#4a9cff', '#d0eeff', '#f0e0b0', '#c8b080'], peak: ['#0a1030', '#3a4a8a', '#e8f0ff', '#a8b8d8'],
    hollow: ['#f0f0f0', '#ffffff', '#e0e0e4', '#c8c8cc'], ring: ['#101838', '#6a88c8', '#403a60', '#20183a'],
  };
  function fallbackBg(id) {
    const k = 'bbg_fallback_' + id;
    if (!G().has('bfx:' + k)) def(k, () => {
      const [s0, s1, g0, g1] = BBG_COL[id] || BBG_COL.grass;
      const cv = G().makeCanvas(256, 144), c = cv.getContext('2d');
      let gr = c.createLinearGradient(0, 0, 0, 96);
      gr.addColorStop(0, s0); gr.addColorStop(1, s1);
      c.fillStyle = gr; c.fillRect(0, 0, 256, 96);
      gr = c.createLinearGradient(0, 96, 0, 144);
      gr.addColorStop(0, g1); gr.addColorStop(1, g0);
      c.fillStyle = gr; c.fillRect(0, 96, 256, 48);
      c.fillStyle = 'rgba(0,0,0,0.15)';
      for (let y = 98; y < 144; y += 4) c.fillRect(0, y, 256, 1);
      return cv;
    });
    return get(k);
  }

  // ------------------------------------------------------------ small drawing helpers
  /** 1-px line of rects from (x0,y0) to (x1,y1) (crisp at any canvas scale) */
  function pixLine(g, x0, y0, x1, y1, col, th) {
    th = th || 1;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      g.rect(Math.round(x - (th - 1) / 2), Math.round(y - (th - 1) / 2), th, th, col);
    }
  }
  /** a twinkling cross (+) of radius r; core pixel white */
  function twinkle(g, x, y, r, col, core) {
    x = Math.round(x); y = Math.round(y);
    if (r <= 0) return;
    g.rect(x, y - r, 1, r * 2 + 1, col);
    g.rect(x - r, y, r * 2 + 1, 1, col);
    if (r >= 2) { g.rect(x - 1, y - 1, 3, 3, col); }
    g.rect(x, y, 1, 1, core || '#ffffff');
  }

  // ------------------------------------------------------------ effects
  const FX = {};
  const lvl = (id) => { const m = /(\d)\s*$/.exec(id || ''); return m ? U.clamp(+m[1], 1, 3) : 1; };
  const layerOf = () => 'mid'; // side view: every fx is on the battlefield (§11.5.12)
  const ease = (x) => 1 - (1 - x) * (1 - x);
  let RATE = 1; // playback rate of the effect being started (fx arrays: 2nd+ at 60 % length)
  function inst(scene, life, layer, draw) { scene.addFx({ life, layer: layer === 'under' ? 'under' : 'mid', draw, t: 0, rate: RATE }); } // 'under': below the sprites (magic circles)
  /** the direction of an effect: −1 leftward (party → enemy), +1 rightward (enemy → party), 0 none */
  const dirOf = (c) => (c && (c.dir === 1 || c.dir === -1) ? c.dir : 0);

  FX.slash = (s, c, L) => {
    for (const r of c.targets) {
      const n = L >= 3 ? 3 : L;
      for (let k = 0; k < n; k++) {
        // 1st arc: party → enemy from upper right to lower left (unflipped), enemy → party from upper left
        // (flipped); the 2nd the other way; never random (§11.5.12)
        const first = dirOf(c) === 1;
        const flip = k % 2 === 1 ? !first : first;
        const d = k * 4, dx = k === 2 ? 0 : (k ? 4 : 0), gold = L >= 3 && k === 2;
        inst(s, 16 + d, layerOf(r), (g, t) => {
          const a = t - d;
          if (a < 0) return;
          const f = get(gold ? 'slash_gold' : 'slash')[Math.min(2, Math.floor(a / 4))];
          const sc = gold ? 1.35 : 1;
          g.draw(f, r.cx - 24 * sc + dx, r.cy - 26 * sc, { flip, w: 48 * sc, h: 48 * sc });
          if (a >= 3 && a < 12) g.draw(get('spark'), r.cx - 9 * sc, r.cy - 9 * sc, { w: 18 * sc, h: 18 * sc, alpha: 1 - (a - 3) / 9 });
        });
      }
      if (L >= 3) inst(s, 20, layerOf(r), (g, t) => { if (t >= 10 && t < 18) g.draw(get('glow_gold'), r.cx - 30, r.cy - 30, { w: 60, h: 60, alpha: (18 - t) / 8 }); });
    }
    if (L >= 3) R.Engine.flashScreen('#ffffff', 5);
    return 8 + (L >= 2 ? 4 : 0) + (L >= 3 ? 4 : 0);
  };
  FX.pierce = (s, c, L) => {
    const n = L >= 3 ? 5 : L >= 2 ? 3 : 1;
    const dir = dirOf(c); // the thrust travels from the user's side toward the target (−1: right → left)
    // a member who stepped in holds the weapon against the target: the thrust starts at its tip, not 34 px back
    // (which would be behind the member's own back — §11.5.12)
    const tip = c.user && c.user.tip;
    for (const r of c.targets) {
      for (let k = 0; k < n; k++) {
        const d = k * 3, ox = k ? U.rf(-6, 6) : 0;
        const reach = dir && tip ? U.clamp(Math.round(dir * (r.cx + ox - tip[0])), 8, 34) : 34;
        const edge = reach < 34 ? r.cx + ox - dir * reach : null; // nothing is drawn past the tip
        // stepped in: the weapon goes in level at the tip's height (kept on the target's body); else the body's middle
        const cy = edge != null ? U.clamp(tip[1], r.y + 4, r.y + r.h - 4) : r.cy;
        const oy = k ? U.rf(edge != null ? -4 : -8, edge != null ? 4 : 8) : 0, slope = edge != null ? U.ri(-1, 1) : U.ri(-4, 4);
        inst(s, 16 + d, layerOf(r), (g, t) => {
          const a = t - d;
          if (a < 0) return;
          const q = ease(Math.min(1, a / 5));
          if (a < 9) {
            if (dir) {
              // a thrust from the user's side, level (±4 slope): the head leads toward the target (§11.5.12)
              const hx = r.cx + ox - dir * reach * (1 - q), hy = cy + oy - slope * (1 - q);
              for (let i = 0; i < 26; i++) {
                const x = Math.round(hx - dir * i);
                if (edge != null && dir * (edge - x) > 0) break;
                g.rect(x, Math.round(hy - (slope * i) / 26) - 1, 2, i < 6 ? 3 : 2, i < 6 ? '#ffffff' : i < 14 ? '#c8dcff' : '#7aa0e8');
              }
            } else {
              const x0 = r.cx + ox - 34 + 34 * q, y0 = r.cy + oy + 34 - 34 * q;
              for (let i = 0; i < 26; i++) g.rect(x0 - i, y0 + i - 1, 3, i < 6 ? 3 : 2, i < 6 ? '#ffffff' : i < 14 ? '#c8dcff' : '#7aa0e8');
            }
          }
          if (a >= 4) g.draw(get('spark'), r.cx + ox - 9, cy + oy - 9, { w: 18, h: 18, alpha: Math.max(0, 1 - (a - 4) / 10) });
        });
      }
      const ringY = dir && tip && dir * (r.cx - tip[0]) < 34 ? U.clamp(tip[1], r.y + 4, r.y + r.h - 4) : r.cy;
      if (L >= 3) inst(s, 30, layerOf(r), (g, t) => {
        if (t < 14 || t > 28) return;
        const ri = RING_R[Math.min(RING_R.length - 1, Math.floor((t - 14) / 2))];
        g.draw(ring(ri, '#c8dcff'), r.cx - ri - 1.5, ringY - ri - 1.5, { alpha: (28 - t) / 14 });
      });
    }
    return 8 + (n - 1) * 3;
  };
  FX.strike = (s, c, L) => {
    if (L >= 2) R.Engine.shake(L >= 3 ? 14 : 8, L >= 3 ? 3 : 2);
    if (L >= 3) R.Engine.flashScreen('#ffffff', 5);
    for (const r of c.targets) {
      const rings = L;
      for (let k = 0; k < rings; k++) {
        const d = k * 3;
        inst(s, 14 + d, layerOf(r), (g, t) => {
          const a = t - d;
          if (a < 0) return;
          const ri = RING_R[Math.min(RING_R.length - 1, Math.floor(a / 2) + (L >= 3 ? 1 : 0))];
          g.draw(ring(ri, k ? '#ffe8a0' : '#ffffff'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: Math.max(0, 1 - a / 14) });
          if (a < 8 && k === 0) { const sc = L >= 2 ? 2 : 1; g.draw(get('spark'), r.cx - 4.5 * sc, r.cy - 4.5 * sc, { w: 9 * sc, h: 9 * sc }); }
        });
      }
      if (L >= 3) {
        const bits = [];
        for (let i = 0; i < 8; i++) bits.push({ a: U.rf(0, Math.PI * 2), sp: U.rf(1.2, 2.4) });
        inst(s, 18, layerOf(r), (g, t) => {
          for (const b of bits) g.rect(Math.round(r.cx + Math.cos(b.a) * t * b.sp), Math.round(r.cy + Math.sin(b.a) * t * b.sp), 2, 2, t < 10 ? '#ffffff' : '#ffe8a0');
        });
      }
    }
    return 6 + (L - 1) * 3;
  };
  FX.claw = (s, c, L) => {
    const n = L >= 3 ? 3 : L;
    for (const r of c.targets) {
      for (let k = 0; k < n; k++) {
        // the 1st rake follows dir (the sprite rakes left → right: enemy → party unflipped), the 2nd the other way
        const firstFlip = dirOf(c) === -1;
        const d = k * 5, flip = k % 2 === 1 ? !firstFlip : firstFlip, ox = k === 2 ? 6 : 0;
        inst(s, 16 + d, layerOf(r), (g, t) => {
          const a = t - d;
          if (a < 0) return;
          const f = get('claw')[Math.min(2, Math.floor(a / 4))];
          g.draw(f, r.cx - 15 + ox, r.cy - 15, { flip });
        });
      }
    }
    return 8 + (n - 1) * 5;
  };
  FX.bite = (s, c, L) => {
    const sc = L >= 3 ? 1.8 : L >= 2 ? 1.4 : 1;
    for (const r of c.targets) {
      inst(s, 18, layerOf(r), (g, t) => {
        const k = t < 8 ? ease(t / 8) : 1;
        const gap = 16 * sc * (1 - k), alpha = t > 14 ? (18 - t) / 4 : 1;
        if (L >= 2 && t >= 8 && t < 16) g.draw(get('glow_red'), r.cx - 20 * sc, r.cy - 20 * sc, { w: 40 * sc, h: 40 * sc, alpha: (16 - t) / 8 });
        g.draw(get('fang'), r.cx - 14 * sc, r.cy - 10 * sc - gap, { alpha, w: 28 * sc, h: 10 * sc });
        g.draw(get('fang_lo'), r.cx - 14 * sc, r.cy + gap, { alpha, w: 28 * sc, h: 10 * sc });
        if (t >= 8 && t < 14) g.draw(get('spark'), r.cx - 4, r.cy - 4);
      });
    }
    if (L >= 2) R.Engine.shake(8, 2);
    return 10;
  };

  /** where a member's projectile starts: a spell from the cast point, a tech (staff…) from the weapon tip (§11.5.12) */
  function originOf(c) {
    const u = c.user;
    const spell = c.ab && (c.ab.kind === 'spell' || c.ab.magic);
    const p = (spell ? u.cast || u.tip : u.tip || u.cast) || [u.cx, u.cy];
    return { x: p[0], y: p[1] };
  }
  /** projectile from a party caster to each enemy target; returns travel frames (0 for monsters / allies) */
  function travel(s, c, drawOrb, T) {
    const from = c.user;
    if (!from || from.side !== 'party' || !c.targets.length || c.targets[0].side === 'party') return 0;
    T = T || 10;
    const o = originOf(c);
    for (const r of c.targets) {
      inst(s, T, 'mid', (g, t) => {
        const k = t / T;
        const x = o.x + (r.cx - o.x) * k;
        const y = o.y + (r.cy - o.y) * k - Math.sin(k * Math.PI) * 12;
        drawOrb(g, x, y, t);
      });
    }
    return T;
  }

  // ---- arrows (bow: arrow / arrow2 three arrows / arrow3 a rain of shining arrows). DESIGN §11.5.12
  /** one arrow whose tip is at (x,y), flying along (dx,dy) (normalised inside) */
  function drawArrow(g, x, y, dx, dy, glow) {
    const d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const len = 15;
    const tx = x - ux * len, ty = y - uy * len;
    if (glow) g.draw(get('glow_gold'), x - ux * 6 - 10, y - uy * 6 - 10, { w: 20, h: 20, alpha: 0.8 });
    else pixLine(g, tx, ty + 1, x - ux * 2, y - uy * 2 + 1, '#2a1a10'); // a dark underside keeps it readable on any backdrop
    pixLine(g, tx, ty, x - ux * 3, y - uy * 3, glow ? '#fff2b0' : '#b07a42');
    // head (3 px wide) and fletching
    const nx = -uy, ny = ux;
    pixLine(g, x - ux * 3 + nx, y - uy * 3 + ny, x, y, glow ? '#ffffff' : '#e8f0ff');
    pixLine(g, x - ux * 3 - nx, y - uy * 3 - ny, x, y, glow ? '#ffffff' : '#e8f0ff');
    g.rect(Math.round(x - ux * 2), Math.round(y - uy * 2), 1, 1, '#ffffff');
    pixLine(g, tx, ty, tx - ux * 3 + nx * 2, ty - uy * 3 + ny * 2, glow ? '#ffe45a' : '#f0f0f0');
    pixLine(g, tx, ty, tx - ux * 3 - nx * 2, ty - uy * 3 - ny * 2, glow ? '#ffe45a' : '#f0f0f0');
  }
  function arrowShot(s, c, r, delay, T, glow, off) {
    // from the bow's tip for a member, from the middle of the sprite for a monster (§11.5.12)
    const from = c.user && c.user !== r ? (c.user.side === 'party' && c.user.tip ? { x: c.user.tip[0], y: c.user.tip[1] } : { x: c.user.cx, y: c.user.cy }) : { x: r.cx + 70 * (dirOf(c) || -1) * -1, y: r.cy - 30 };
    const tx = r.cx + (off ? off[0] : 0), ty = r.cy + (off ? off[1] : 0);
    inst(s, delay + T + 12, 'mid', (g, t) => {
      const a = t - delay;
      if (a < 0) return;
      if (a < T) {
        const k = a / T;
        const x = from.x + (tx - from.x) * k, y = from.y + (ty - from.y) * k - Math.sin(k * Math.PI) * 10;
        const k2 = Math.min(1, (a + 1) / T);
        const x2 = from.x + (tx - from.x) * k2, y2 = from.y + (ty - from.y) * k2 - Math.sin(k2 * Math.PI) * 10;
        drawArrow(g, x2, y2, x2 - x || (tx - from.x), y2 - y || (ty - from.y), glow);
      } else {
        const b = a - T;
        if (b < 8) g.draw(get('spark'), tx - 6, ty - 6, { w: 12, h: 12, alpha: 1 - b / 8 });
        if (b < 12) for (let i = 0; i < 4; i++) g.rect(Math.round(tx + Math.cos(i * 1.7 + 0.4) * b * 1.2), Math.round(ty + Math.sin(i * 1.7 + 0.4) * b * 1.2 + b * 0.3), 1, 1, glow ? '#ffe45a' : '#f0e0c0');
      }
    });
  }
  FX.arrow = (s, c, L) => {
    const T = 8;
    if (L >= 3) {
      // a rain of shining arrows from the user's side, above (party → enemy: from the upper right. §11.5.12)
      R.Engine.flashScreen('#fff4c0', 6);
      const dir = dirOf(c) || -1;
      let last = 0;
      for (const r of c.targets) {
        for (let i = 0; i < 9; i++) {
          const d = i * 2 + U.ri(0, 2), ox = U.rf(-r.w * 0.4, r.w * 0.4), oy = U.rf(-r.h * 0.3, r.h * 0.3);
          const tx = r.cx + ox, ty = r.cy + oy;
          const sx = tx - dir * 40, sy = ty - 90;
          inst(s, d + T + 12, 'mid', (g, t) => {
            const a = t - d;
            if (a < 0) return;
            if (a < T) { const k = (a + 1) / T; drawArrow(g, sx + (tx - sx) * k, sy + (ty - sy) * k, tx - sx, ty - sy, true); }
            else if (a - T < 8) g.draw(get('spark'), tx - 6, ty - 6, { w: 12, h: 12, alpha: 1 - (a - T) / 8 });
          });
          last = Math.max(last, d + T);
        }
      }
      return last;
    }
    const n = L >= 2 ? 3 : 1;
    for (const r of c.targets) for (let k = 0; k < n; k++) arrowShot(s, c, r, k * 3, T, false, k ? [U.rf(-8, 8), U.rf(-8, 6)] : null);
    return T + (n - 1) * 3;
  };

  // ---- whip (lash / lash2 twice / lash3 a shining thorn whip). DESIGN §11.5.12
  /** one crack of the whip; flip = it starts on the right of the target (the party's side) */
  function lashOnce(s, r, delay, flip, glow) {
    const dir = flip ? -1 : 1;
    // bezier from above one side to the target, with a swinging control point
    const p0 = { x: r.cx - dir * Math.max(28, r.w * 0.7), y: r.cy - Math.max(26, r.h * 0.6) };
    const p2 = { x: r.cx + dir * 6, y: r.cy + 2 };
    const thorns = glow ? [0.3, 0.45, 0.6, 0.75, 0.88] : [];
    inst(s, delay + 22, layerOf(r), (g, t) => {
      const a = t - delay;
      if (a < 0) return;
      const draw = Math.min(1, (a + 1) / 6); // the curve extends over 6 frames
      const sway = a < 6 ? (1 - a / 6) * 18 : 0;
      const p1 = { x: r.cx + dir * (10 + sway), y: r.cy - 40 + sway * 0.5 };
      const fade = a > 12 ? Math.max(0, 1 - (a - 12) / 8) : 1;
      if (fade <= 0) return;
      const N = 28;
      let lx = p0.x, ly = p0.y;
      const pts = [[p0.x, p0.y]];
      for (let i = 1; i <= N * draw; i++) {
        const q = i / N;
        pts.push([(1 - q) * (1 - q) * p0.x + 2 * (1 - q) * q * p1.x + q * q * p2.x, (1 - q) * (1 - q) * p0.y + 2 * (1 - q) * q * p1.y + q * q * p2.y]);
      }
      // dark outline pass first (readable over any backdrop), then the leather / light
      if (fade > 0.35) for (let i = 1; i < pts.length; i++) pixLine(g, pts[i - 1][0], pts[i - 1][1] + 1, pts[i][0], pts[i][1] + 1, glow ? '#6a4a10' : '#3a2010', i / N < 0.3 ? 3 : 2);
      for (let i = 1; i < pts.length; i++) {
        const q = i / N, x = pts[i][0], y = pts[i][1];
        const col = glow ? (q > 0.8 ? '#ffffff' : '#ffe45a') : q > 0.85 ? '#ffffff' : '#d8a868';
        const th = q < 0.3 ? 2 : 1;
        if (fade > 0.35 || i % 2) pixLine(g, lx, ly, x, y, col, th);
        if (glow && thorns.some((tq) => Math.abs(tq - q) < 0.5 / N)) {
          const nx = -(y - ly), ny = x - lx, d = Math.hypot(nx, ny) || 1;
          pixLine(g, x, y, x + (nx / d) * 3, y + (ny / d) * 3, '#fff6c0');
          pixLine(g, x, y, x - (nx / d) * 3, y - (ny / d) * 3, '#fff6c0');
        }
        lx = x; ly = y;
      }
      // the tip cracks: a small burst star
      if (a >= 5 && a < 14) {
        const b = a - 5, rr = glow ? 3 + b : 2 + b * 0.6;
        twinkle(g, p2.x, p2.y, Math.round(Math.min(glow ? 7 : 5, rr)), glow ? '#ffe45a' : '#ffffff');
        if (glow) g.draw(get('glow_gold'), p2.x - 16, p2.y - 16, { alpha: (14 - a) / 9 });
      }
    });
  }
  FX.lash = (s, c, L) => {
    // the swing starts on the user's side (party → enemy: upper right), the 2nd from the other side (§11.5.12)
    const fromRight = dirOf(c) !== 1;
    for (const r of c.targets) {
      lashOnce(s, r, 0, fromRight, L >= 3);
      if (L >= 2) lashOnce(s, r, 8, !fromRight, L >= 3);
    }
    if (L >= 3) R.Engine.flashScreen('#fff4c0', 5);
    return L >= 2 ? 14 : 6;
  };

  // ---- stance (反撃の構え・かばう): four light corners close in round the sprite (the scene flashes it white)
  FX.stance = (s, c) => {
    const r = c.user || c.targets[0];
    if (!r) return 0;
    inst(s, 26, 'mid', (g, t) => {
      if (t < 10 && r.side !== 'party') g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 'rgba(255,255,255,' + (0.5 * (1 - t / 10)).toFixed(3) + ')');
      const k = Math.min(1, t / 8), off = Math.round(8 * (1 - k)), L = 6;
      const alpha = t > 18 ? Math.max(0, (26 - t) / 8) : 1;
      if (alpha <= 0) return;
      const col = (t | 0) % 4 < 2 ? '#ffffff' : '#ffe45a';
      const x0 = r.x - off - 1, y0 = r.y - off - 1, x1 = r.x + r.w + off, y1 = r.y + r.h + off;
      const cv = G().ctx, a0 = cv.globalAlpha;
      cv.globalAlpha = a0 * alpha;
      for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        g.rect(dx > 0 ? cx : cx - L + 1, cy, L, 1, col);
        g.rect(cx, dy > 0 ? cy : cy - L + 1, 1, L, col);
      }
      cv.globalAlpha = a0;
    });
    return 12;
  };

  FX.fire = (s, c, L) => {
    const d0 = travel(s, c, (g, x, y, t) => {
      g.draw(get('glow_red'), x - 14, y - 14, { w: 28, h: 28 });
      g.draw(get('flame')[1 + (Math.floor(t / 2) % 2)], x - 8, y - 12);
    });
    for (const r of c.targets) {
      const n = 6 + L * 4, parts = [];
      const sp = Math.max(8, r.w * 0.34);
      for (let i = 0; i < n; i++) parts.push({ x: r.cx + U.rf(-sp, sp), y: r.bottom - U.rf(0, r.h * 0.45), d: U.rf(0, 10 + L * 3), s: L >= 3 ? 3 : U.chance(0.35) ? 1 : 2 });
      inst(s, d0 + 36, layerOf(r), (g, t) => {
        const a0 = t - d0;
        if (a0 < 0) return;
        if (a0 < 22) g.draw(get('glow_red'), r.cx - 36, r.cy - 36, { alpha: 0.75 * (1 - a0 / 22), w: 72, h: 72 });
        const fr = get('flame');
        for (const p of parts) {
          const a = a0 - p.d;
          if (a < 0 || a >= 16) continue;
          const w = 16 * p.s;
          g.draw(fr[Math.floor(a / 4)], p.x - w / 2, p.y - a * 1.3 - w * 0.9, { w, h: w });
        }
      });
    }
    if (L >= 3) R.Engine.flashScreen('#ffb060', 6);
    return d0 + 16;
  };
  FX.ice = (s, c, L) => {
    const d0 = travel(s, c, (g, x, y, t) => {
      g.draw(get('glow_cyan'), x - 12, y - 12, { w: 24, h: 24 });
      g.draw(get('shard'), x - 3, y - 6, { flip: Math.floor(t / 3) % 2 === 1 });
    });
    for (const r of c.targets) {
      const n = 6 + L * 2, parts = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + U.rf(-0.2, 0.2); parts.push({ a, d: U.rf(0, 4), dist: U.rf(30, 46), s: U.chance(0.5) ? 2 : 1.5 }); }
      const spikes = [];
      for (let i = 0; i < 3 + L; i++) spikes.push({ x: r.cx + U.rf(-r.w * 0.3, r.w * 0.3), h: U.rf(0.8, 1.6) * (L >= 3 ? 1.3 : 1), f: U.chance(0.5) });
      inst(s, d0 + 36, layerOf(r), (g, t) => {
        const a0 = t - d0;
        if (a0 < 0) return;
        for (const p of parts) {
          const k = (a0 - p.d) / 10;
          if (k < 0) continue;
          if (k < 1) {
            const dd = p.dist * (1 - ease(k));
            const w = 7 * p.s, h = 13 * p.s;
            g.draw(get('shard'), r.cx + Math.cos(p.a) * dd - w / 2, r.cy + Math.sin(p.a) * dd * 0.8 - h / 2, { w, h });
          } else if (k < 2.4) {
            const q = (k - 1) / 1.4;
            g.draw(get('tw_cyan'), r.cx + Math.cos(p.a) * q * 22 - 3, r.cy + Math.sin(p.a) * q * 16 - 3, { alpha: 1 - q });
          }
        }
        if (a0 >= 10 && a0 < 24) {
          const k = Math.min(1, (a0 - 10) / 4), fade = a0 > 18 ? (24 - a0) / 6 : 1;
          for (const sp of spikes) { const h = 13 * 2 * sp.h * k; g.draw(get('shard'), sp.x - 7, r.bottom - h, { w: 14, h, alpha: fade, flip: sp.f }); }
          g.draw(get('glow_cyan'), r.cx - 24, r.cy - 24, { w: 48, h: 48, alpha: fade });
        }
      });
    }
    if (L >= 3) R.Engine.flashScreen('#e0f8ff', 6);
    return d0 + 18;
  };
  FX.thunder = (s, c, L) => {
    R.Engine.flashScreen('#ffffff', 6);
    for (const r of c.targets) {
      const bolts = [];
      for (let b = 0; b < 1 + L; b++) {
        const pts = [];
        let x = r.cx + U.rf(-10, 10), y = -4;
        const ty = r.cy;
        while (y < ty) { pts.push([x, y]); y += U.rf(6, 12); x += U.rf(-7, 7) + (r.cx - x) * 0.18; }
        pts.push([r.cx, ty]);
        bolts.push({ pts, d: b * 5 });
      }
      inst(s, 26, layerOf(r), (g, t) => {
        for (const b of bolts) {
          const a = t - b.d;
          if (a < 0 || a > 8 || (a > 3 && a < 5)) continue;
          for (let i = 0; i + 1 < b.pts.length; i++) {
            const [x0, y0] = b.pts[i], [x1, y1] = b.pts[i + 1];
            const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
            for (let k = 0; k < n; k++) {
              const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
              g.rect(Math.round(x) - 1, Math.round(y), 3, 1, '#fff8a0');
              g.rect(Math.round(x), Math.round(y), 1, 1, '#ffffff');
            }
          }
          g.draw(get('glow_gold'), r.cx - 16, r.cy - 16);
        }
      });
    }
    return 16;
  };
  FX.wind = (s, c, L) => {
    const dir = dirOf(c) || 1; // the gusts blow the way the spell goes (party → enemy: right to left)
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 12 + L * 5; i++) parts.push({ a0: U.rf(0, Math.PI * 2), h: U.rf(0, 1), d: U.rf(0, 8), s: U.chance(0.5) ? 2 : 1 });
      const gusts = [];
      for (let i = 0; i < 6 + L * 2; i++) gusts.push({ y: r.y + U.rf(0.1, 0.9) * r.h, d: U.rf(0, 14), len: U.rf(14, 30) });
      inst(s, 36, layerOf(r), (g, t) => {
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 26) continue;
          const ang = p.a0 + a * 0.4;
          const rad = (1 - a / 34) * Math.max(16, r.w * 0.5);
          const y = r.bottom - 4 - (p.h * 0.7 + a / 34) * r.h;
          g.draw(get('leaf'), r.cx + Math.cos(ang) * rad - 5.5 * p.s, y + Math.sin(ang) * rad * 0.25 - 3 * p.s, { w: 11 * p.s, h: 6 * p.s, alpha: Math.min(1, (26 - a) / 8), flip: Math.sin(ang) < 0 });
        }
        for (const q of gusts) {
          const a = t - q.d;
          if (a < 0 || a > 14) continue;
          const x = dir > 0 ? r.x - 20 + (r.w + 40) * (a / 14) : r.x + r.w + 20 - (r.w + 40) * (a / 14);
          g.rect(Math.round(dir > 0 ? x - q.len : x), Math.round(q.y), Math.round(q.len), 1, 'rgba(255,255,255,0.8)');
        }
      });
    }
    return 22;
  };
  FX.earth = (s, c, L) => {
    R.Engine.shake(22, 2);
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 4 + L * 2; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.4, r.w * 0.4), d: U.rf(0, 12), s: U.chance(0.5) ? 2 : 1.5, spin: U.chance(0.5) });
      const top = r.side === 'party' ? r.y - 40 : Math.max(40, r.y - 30);
      inst(s, 40, layerOf(r), (g, t) => {
        const land = r.side === 'party' ? r.bottom - 2 : r.bottom - 4;
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0) continue;
          const fall = 9;
          const w = 11 * p.s, h = 10 * p.s;
          if (a < fall) g.draw(get('rock'), p.x - w / 2, top + (land - top) * (a / fall) * (a / fall) - h, { w, h, flip: p.spin && Math.floor(a / 2) % 2 === 0 });
          else if (a < fall + 8) g.draw(get('rock'), p.x - w / 2 + (a - fall) * (p.spin ? 1 : -1), land - h - Math.sin(((a - fall) / 8) * Math.PI) * 6, { w, h, alpha: (fall + 8 - a) / 8 });
          if (a >= fall && a < fall + 12) g.draw(get('smoke')[Math.min(2, Math.floor((a - fall) / 4))], p.x - 15, land - 22, { w: 30, h: 30, alpha: 0.85 });
        }
      });
    }
    return 24;
  };
  FX.water = (s, c, L) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 10 + L * 4; i++) parts.push({ x: r.cx + U.rf(-8, 8), d: U.rf(6, 16), vx: U.rf(-2, 2), vy: U.rf(2.5, 4.2), bub: U.chance(0.35) });
      const colH = Math.max(40, r.h + 12);
      inst(s, 38, layerOf(r), (g, t) => {
        const base = r.bottom;
        const k = t < 8 ? ease(t / 8) : t < 20 ? 1 : Math.max(0, 1 - (t - 20) / 8);
        if (k > 0) {
          const h = colH * k, w = 20 + L * 6;
          g.draw(get('geyser'), r.cx - w / 2, base - h, { w, h, sh: Math.max(1, Math.round(64 * Math.min(1, h / colH))) });
          g.draw(get('glow_blue'), r.cx - 28, base - h - 20, { w: 56, h: 40, alpha: 0.6 * k });
        }
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 18) continue;
          const y0 = base - colH;
          if (p.bub) g.draw(get('bubble'), p.x + p.vx * a * 2 - 4, base - a * 3, { alpha: Math.min(1, (18 - a) / 6) });
          else g.draw(get('drop'), p.x + p.vx * a - 3, y0 - a * p.vy + a * a * 0.3, { w: 9, h: 12 });
        }
      });
    }
    return 22;
  };
  FX.holy = (s, c, L) => {
    R.Engine.flashScreen('#ffffff', L >= 3 ? 12 : 8);
    for (const r of c.targets) {
      const tws = [];
      for (let i = 0; i < 10 + L * 4; i++) tws.push({ x: r.cx + U.rf(-r.w * 0.5, r.w * 0.5), y: r.cy + U.rf(-r.h * 0.5, r.h * 0.4), d: U.rf(6, 18) });
      const cols = L >= 3 ? [0, -14, 14, -26, 26] : L >= 2 ? [0, -12, 12] : [0];
      inst(s, 36, layerOf(r), (g, t) => {
        const k = t < 8 ? t / 8 : t > 26 ? Math.max(0, (36 - t) / 10) : 1;
        const top = r.bottom;
        cols.forEach((ox, i) => { const kk = Math.max(0, Math.min(1, (t - i * 2) / 8)) * (i ? 0.7 : 1); if (kk > 0) g.draw(get('pillar'), r.cx - 12 + ox, top - 150, { alpha: Math.min(k, kk), h: 150 }); });
        for (const p of tws) { const a = t - p.d; if (a >= 0 && a < 12) g.draw(get('tw_white'), p.x - 3, p.y - a * 0.8 - 3, { alpha: 1 - a / 12 }); }
      });
    }
    return 20;
  };
  FX.dark = (s, c, L) => {
    R.Engine.flashScreen('#200030', 10 + L * 2);
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 10 + L * 4; i++) parts.push({ a: U.rf(0, Math.PI * 2), d: U.rf(0, 8), dist: U.rf(24, 44) });
      inst(s, 34, layerOf(r), (g, t) => {
        if (L >= 3 && t < 24) g.draw(get('glow_purple'), r.cx - 34, r.cy - 34, { w: 68, h: 68, alpha: Math.sin((t / 24) * Math.PI) * 0.8 });
        for (const p of parts) {
          const k = (t - p.d) / 18;
          if (k < 0 || k > 1) continue;
          const ang = p.a + k * 3;
          const dd = p.dist * (1 - k);
          g.draw(get('orb_purple'), r.cx + Math.cos(ang) * dd - 4, r.cy + Math.sin(ang) * dd * 0.7 - 4, { alpha: 0.4 + k * 0.6 });
        }
        for (let n = 0; n < (L >= 2 ? 2 : 1); n++) {
          const b = t - 16 - n * 4;
          if (b < 0 || b >= 14) continue;
          const ri = RING_R[Math.min(RING_R.length - 1, Math.floor(b / 2) + (L >= 3 ? 1 : 0))];
          g.draw(ring(ri, '#a060e0'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: (14 - b) / 14 });
        }
      });
    }
    return 20;
  };
  FX.explosion = (s, c, L) => {
    R.Engine.shake(16 + L * 4, L >= 2 ? 4 : 3);
    R.Engine.flashScreen('#ffe0a0', 8);
    for (const r of c.targets) {
      const bursts = L >= 2 ? 2 : 1;
      for (let b = 0; b < bursts; b++) {
        const parts = [], d = b * 7, ox = b ? U.rf(-10, 10) : 0, oy = b ? U.rf(-8, 8) : 0;
        for (let i = 0; i < 10 + L * 4; i++) { const a = U.rf(0, Math.PI * 2); parts.push({ a, sp: U.rf(0.6, 1.6), d: U.rf(0, 4) }); }
        inst(s, 30 + d, layerOf(r), (g, t) => {
          const a0 = t - d;
          if (a0 < 0) return;
          if (a0 < 16) g.draw(get('glow_gold'), r.cx + ox - 32, r.cy + oy - 32, { alpha: 1 - a0 / 16, w: 64, h: 64 });
          const fr = get('flame');
          for (const p of parts) {
            const a = a0 - p.d;
            if (a < 0 || a >= 16) continue;
            g.draw(fr[Math.floor(a / 4)], r.cx + ox + Math.cos(p.a) * a * p.sp * 1.8 - 12, r.cy + oy + Math.sin(p.a) * a * p.sp * 1.3 - 16, { w: 24, h: 24 });
          }
        });
      }
    }
    return 16;
  };
  FX.breath = (s, c, L, variant) => {
    const V = {
      fire: { img: () => get('flame')[1], glow: 'glow_red' },
      ice: { img: () => get('shard'), glow: 'glow_cyan' },
      poison: { img: () => get('bubble_green'), glow: 'glow_green' },
      dark: { img: () => get('orb_purple'), glow: 'glow_purple' },
      none: { img: () => get('smoke')[0], glow: 'glow_white' },
    }[variant || 'none'];
    // from the monster's mouth (cx, y + h × 0.35) in a cone to random points of the targets (§11.5.12 Part A8)
    const u = c.user;
    const from = u ? { x: u.cx, y: u.side === 'mon' ? u.y + u.h * 0.35 : u.cy } : { x: 88, y: 100 };
    const tg = c.targets.length ? c.targets : [{ x: 190, y: 100, w: 40, h: 40 }];
    const parts = [];
    for (let i = 0; i < 40; i++) {
      const r = tg[i % tg.length];
      parts.push({ tx: r.x + U.rf(-0.1, 1.1) * r.w, ty: r.y + U.rf(0, 1) * r.h, d: U.rf(0, 18), s: U.rf(0.8, 1.8) });
    }
    const band = tg[0].side === 'party' ? [170, 56, 86, 96] : [0, 40, 176, 110];
    inst(s, 42, 'mid', (g, t) => {
      const img = V.img();
      for (const p of parts) {
        const a = (t - p.d) / 20;
        if (a < 0 || a > 1) continue;
        const x = from.x + (p.tx - from.x) * a, y = from.y + (p.ty - from.y) * a;
        const w = img.width * p.s * (0.6 + a), h = img.height * p.s * (0.6 + a);
        g.draw(img, x - w / 2, y - h / 2, { w, h, alpha: Math.min(1, (1 - a) * 3) });
      }
      if (t > 12 && t < 34) g.draw(get(V.glow), band[0], band[1], { w: band[2], h: band[3], alpha: 0.35 * Math.sin(((t - 12) / 22) * Math.PI) });
    });
    return 26;
  };
  FX.drain = (s, c) => {
    const to = c.user;
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 10; i++) parts.push({ ox: U.rf(-10, 10), oy: U.rf(-10, 10), d: i * 1.6 });
      inst(s, 36, 'top', (g, t) => {
        for (const p of parts) {
          const k = (t - p.d) / 16;
          if (k < 0 || k > 1 || !to) continue;
          const x = r.cx + p.ox + (to.cx - r.cx - p.ox) * ease(k), y = r.cy + p.oy + (to.cy - r.cy - p.oy) * k - Math.sin(k * Math.PI) * 18;
          g.draw(get('orb_red'), x - 4, y - 4);
        }
      });
    }
    return 14;
  };
  FX.gravity = (s, c) => {
    for (const r of c.targets) {
      inst(s, 28, layerOf(r), (g, t) => {
        const k = Math.min(1, t / 18);
        const sz = 48 * (1 - k) + 8;
        g.draw(get('glow_purple'), r.cx - sz / 2, r.cy - sz / 2, { w: sz, h: sz, alpha: 0.9 });
        g.draw(get('orb_purple'), r.cx - 4, r.cy - 4);
        const ri = RING_R[Math.max(0, RING_R.length - 1 - Math.floor(t / 3))];
        if (t < 24) g.draw(ring(ri, '#c38cff'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: 0.8 });
      });
    }
    return 18;
  };
  FX.death = (s, c) => {
    R.Engine.flashScreen('#000000', 12);
    for (const r of c.targets) {
      inst(s, 36, layerOf(r), (g, t) => {
        const a = t < 8 ? t / 8 : Math.max(0, (36 - t) / 20);
        g.draw(get('glow_purple'), r.cx - 24, r.cy - 24, { w: 48, h: 48, alpha: a * 0.8 });
        g.draw(get('skull'), r.cx - 11, r.cy - 11 - t * 0.3, { w: 22, h: 22, alpha: a });
      });
    }
    return 22;
  };
  function sparkles(s, c, color, opts) {
    const o = opts || {};
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < (o.n || 12); i++) parts.push({ x: r.cx + U.rf(-r.w * 0.45, r.w * 0.45), y: r.bottom - U.rf(0, r.h * 0.6), d: U.rf(0, 12), v: U.rf(0.6, 1.3) });
      const gs = o.glowSize || 40;
      inst(s, 30, layerOf(r), (g, t) => {
        if (o.glow && t < 22) g.draw(get('glow_' + o.glow), r.cx - gs / 2, r.cy - gs / 2, { w: gs, h: gs, alpha: Math.sin((t / 22) * Math.PI) * 0.7 });
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 18) continue;
          g.draw(get('tw_' + (o.alt && (a | 0) % 4 < 2 ? o.alt : color)), p.x - 3, p.y - a * p.v * (o.down ? -1 : 1) - 3, { alpha: Math.min(1, (18 - a) / 6) });
        }
      });
    }
    return 16;
  }
  FX.heal = (s, c, L) => sparkles(s, c, 'green', { alt: 'white', glow: 'green', n: 12 + (L - 1) * 8, glowSize: 40 + (L - 1) * 16 });
  FX.mp = (s, c, L) => sparkles(s, c, 'cyan', { alt: 'blue', glow: 'cyan', n: 12 + (L - 1) * 6 });
  FX.cure = (s, c) => {
    for (const r of c.targets) {
      inst(s, 28, layerOf(r), (g, t) => {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + t * 0.2;
          const rad = Math.max(10, r.w * 0.4) * (1 - t / 40);
          g.draw(get(i % 2 ? 'tw_white' : 'tw_cyan'), r.cx + Math.cos(ang) * rad - 3, r.cy + Math.sin(ang) * rad * 0.6 - 3, { alpha: Math.min(1, (28 - t) / 8) });
        }
      });
    }
    return 16;
  };
  FX.revive = (s, c) => {
    for (const r of c.targets) {
      inst(s, 40, layerOf(r), (g, t) => {
        const k = t < 10 ? t / 10 : Math.max(0, (40 - t) / 16);
        const top = r.bottom;
        g.draw(get('pillar'), r.cx - 12, top - 150, { alpha: k, h: 150 });
      });
    }
    sparkles(s, c, 'gold', { alt: 'white', n: 16 });
    return 24;
  };
  FX.regen = (s, c) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.4, r.w * 0.4), d: U.rf(0, 14) });
      inst(s, 32, layerOf(r), (g, t) => {
        for (const p of parts) { const a = t - p.d; if (a >= 0 && a < 18) g.draw(get('icon_regen'), p.x - 4, r.bottom - 8 - a * 1.2, { alpha: Math.min(1, (18 - a) / 5) }); }
      });
    }
    return 16;
  };
  function arrows(s, c, up) {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 5; i++) parts.push({ x: r.cx - 16 + i * 8 + U.rf(-2, 2), d: i * 2 + U.rf(0, 3) });
      inst(s, 30, layerOf(r), (g, t) => {
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 18) continue;
          const y = up ? r.bottom - 10 - a * 2 : r.y + a * 2;
          g.draw(get(up ? 'arrow_up' : 'arrow_down'), p.x - 4, y, { alpha: Math.min(1, (18 - a) / 6) });
        }
      });
    }
    return 16;
  }
  FX.buff = (s, c) => arrows(s, c, true);
  FX.debuff = (s, c) => arrows(s, c, false);
  FX.dispel = (s, c) => {
    for (const r of c.targets) {
      inst(s, 24, layerOf(r), (g, t) => {
        for (let k = 0; k < 2; k++) {
          const i = RING_R.length - 1 - Math.floor((t + k * 6) / 3);
          if (i < 0 || i >= RING_R.length) continue;
          const ri = RING_R[i];
          g.draw(ring(ri, '#ffffff'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: 0.9 });
        }
      });
    }
    return 16;
  };
  const STATUS_FX = {
    sleep: { key: 'zzz', tw: 'purple' }, poison: { key: 'bubble_green', tw: 'green' }, paralyze: { key: 'icon_paralyze', tw: 'gold' },
    confuse: { key: 'icon_confuse', tw: 'pink' }, silence: { key: 'icon_silence', tw: 'white' }, blind: { key: 'icon_blind', tw: 'blue' },
  };
  function statusPuff(s, c, st) {
    const S = STATUS_FX[st] || STATUS_FX.confuse;
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.35, r.w * 0.35), y: r.cy + U.rf(-6, 10), d: U.rf(0, 10) });
      inst(s, 36, layerOf(r), (g, t) => {
        const sm = get('smoke');
        if (t < 15) g.draw(sm[Math.min(2, Math.floor(t / 5))], r.cx - 20, r.cy - 22, { w: 40, h: 40, alpha: 0.75 });
        g.draw(get('glow_' + S.tw), r.cx - 20, r.cy - 20, { w: 40, h: 40, alpha: Math.max(0, 0.6 - t / 40) });
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 24) continue;
          const img = get(S.key);
          const w = img.width * 2, h = img.height * 2;
          g.draw(img, p.x - w / 2 + Math.sin(a * 0.4) * 4, p.y - a * 1.1 - h / 2, { w, h, alpha: Math.min(1, (24 - a) / 6) });
        }
      });
    }
    return 16;
  }
  for (const st in STATUS_FX) FX[st] = (s, c) => statusPuff(s, c, st);
  // やけど: small flames lick up around the target
  FX.burn = (s, c) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.4, r.w * 0.4), y: r.bottom - U.rf(2, r.h * 0.5), d: U.rf(0, 12) });
      inst(s, 32, layerOf(r), (g, t) => {
        if (t < 20) g.draw(get('glow_orange'), r.cx - 22, r.cy - 22, { w: 44, h: 44, alpha: 0.6 * Math.sin((t / 20) * Math.PI) });
        const fr = get('flame');
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a >= 16) continue;
          g.draw(fr[Math.floor(a / 4)], p.x - 6, p.y - a * 0.9 - 12, { w: 12, h: 12 });
        }
      });
    }
    return 14;
  };
  // 凍結: ice crystals close in and a frost glaze flashes over the target
  FX.freeze = (s, c) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; parts.push({ a, dist: Math.max(18, r.w * 0.55) }); }
      inst(s, 34, layerOf(r), (g, t) => {
        for (const p of parts) {
          const k = Math.min(1, t / 10);
          const dd = p.dist * (1 - ease(k)) + 6;
          if (t < 22) g.draw(get('shard'), r.cx + Math.cos(p.a) * dd - 3.5, r.cy + Math.sin(p.a) * dd * 0.8 - 6.5, { alpha: t > 16 ? (22 - t) / 6 : 1 });
        }
        if (t >= 8 && t < 26) g.draw(get('glow_cyan'), r.cx - 26, r.cy - 26, { w: 52, h: 52, alpha: (26 - t) / 18 });
        if (t >= 10 && t < 22 && (t | 0) % 4 < 2) twinkle(g, r.cx + 8, r.cy - 10, 3, '#e0f8ff');
      });
    }
    return 16;
  };
  // 気絶: stars circle above the target's head
  FX.stun = (s, c) => {
    for (const r of c.targets) {
      inst(s, 40, layerOf(r), (g, t) => {
        const a = t < 30 ? 1 : (40 - t) / 10;
        for (let i = 0; i < 3; i++) {
          const ang = t * 0.25 + (i / 3) * Math.PI * 2;
          const x = r.cx + Math.cos(ang) * Math.max(12, r.w * 0.3), y = r.y + 6 + Math.sin(ang) * 3;
          g.draw(get(i % 2 ? 'star_w' : 'star'), x - 3.5, y - 3.5, { alpha: a });
        }
      });
    }
    return 16;
  };
  // 加護: hexagon plates form a dome
  FX.veil = (s, c) => {
    for (const r of c.targets) {
      inst(s, 34, layerOf(r), (g, t) => {
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a = Math.PI + (i / (n - 1)) * Math.PI, k = Math.min(1, Math.max(0, (t - i * 1.5) / 8));
          if (k <= 0) continue;
          const rad = Math.max(16, r.w * 0.5);
          const x = r.cx + Math.cos(a) * rad, y = r.cy + 6 + Math.sin(a) * rad * 0.8;
          g.draw(get('hex'), x - 4.5, y - 4.5, { alpha: k * (t > 26 ? (34 - t) / 8 : 1) });
        }
        if (t > 8 && t < 28) g.draw(get('glow_cyan'), r.cx - 24, r.cy - 20, { w: 48, h: 44, alpha: 0.5 * Math.sin(((t - 8) / 20) * Math.PI) });
      });
    }
    return 16;
  };
  // 身軽: light green streaks rise past the target
  FX.nimble = (s, c) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 8; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.45, r.w * 0.45), d: U.rf(0, 12), len: U.ri(5, 10) });
      inst(s, 30, layerOf(r), (g, t) => {
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 16) continue;
          const y = r.bottom - 4 - a * 2.4;
          g.rect(Math.round(p.x), Math.round(y), 1, p.len, 'rgba(184,255,176,' + (1 - a / 16).toFixed(2) + ')');
          g.rect(Math.round(p.x), Math.round(y), 1, 2, '#ffffff');
        }
        if (t < 18) g.draw(get('leaf'), r.cx - 5 + Math.sin(t * 0.4) * 10, r.bottom - 10 - t * 1.6, { alpha: 1 - t / 18 });
      });
    }
    return 14;
  };
  FX.counter = (s, c) => FX.stance(s, c);
  FX.cover = (s, c) => FX.stance(s, c);
  FX.steal = (s, c) => {
    const dir = dirOf(c) || 1; // the streak comes from the thief's side (party → enemy: right to left)
    for (const r of c.targets) {
      inst(s, 18, layerOf(r), (g, t) => {
        const k = Math.min(1, t / 8);
        for (let i = 0; i < 20; i++) g.rect(r.cx - dir * (30 - 60 * k - i * 2), r.cy - 4 + (i % 3), 2, 1, i < 4 ? '#ffffff' : '#9ac0ff');
        if (t > 6) g.draw(get('tw_gold'), r.cx - 3, r.cy - 3 - (t - 6), { alpha: Math.max(0, 1 - (t - 6) / 12) });
      });
    }
    return 10;
  };
  FX.scan = (s, c) => {
    for (const r of c.targets) {
      inst(s, 26, layerOf(r), (g, t) => {
        const k = 1 - Math.min(1, t / 14);
        const w = r.w + 20 * k, h = r.h + 16 * k;
        const x = r.cx - w / 2, y = r.cy - h / 2;
        const col = (t | 0) % 4 < 2 ? '#6fd8ff' : '#ffffff';
        for (const [ax, ay, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
          g.rect(Math.min(ax, ax + dx * 6), ay, 6, 1, col); g.rect(ax, Math.min(ay, ay + dy * 6), 1, 6, col);
        }
      });
    }
    return 16;
  };
  FX.smoke = (s) => {
    const parts = [];
    for (let i = 0; i < 18; i++) parts.push({ x: U.rf(0, 256), y: U.rf(40, 150), d: U.rf(0, 12), s: U.rf(1.5, 3) });
    inst(s, 40, 'top', (g, t) => {
      const sm = get('smoke');
      for (const p of parts) {
        const a = t - p.d;
        if (a < 0 || a > 28) continue;
        const w = 20 * p.s;
        g.draw(sm[Math.min(2, Math.floor(a / 10))], p.x - w / 2, p.y - w / 2 - a * 0.4, { w, h: w, alpha: Math.min(1, (28 - a) / 8) * 0.9 });
      }
    });
    return 24;
  };
  FX.song = (s, c) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push({ x: r.cx + U.rf(-r.w * 0.4, r.w * 0.4), d: U.rf(0, 14) });
      inst(s, 34, layerOf(r), (g, t) => {
        for (const p of parts) { const a = t - p.d; if (a >= 0 && a < 20) g.draw(get('note'), p.x + Math.sin(a * 0.3) * 4 - 3, r.bottom - 10 - a * 1.4, { alpha: Math.min(1, (20 - a) / 6) }); }
      });
    }
    return 18;
  };
  FX.grow = (s, c) => sparkles(s, c, 'gold', { alt: 'white', glow: 'gold', n: 10 });
  FX.magic = (s, c, L) => {
    const h = sparkles(s, c, 'white', { alt: 'cyan', n: 10 + (L - 1) * 6, glow: L >= 2 ? 'cyan' : null, glowSize: 36 + L * 8 });
    if (L >= 3) {
      R.Engine.flashScreen('#e0f0ff', 6);
      for (const r of c.targets) inst(s, 24, layerOf(r), (g, t) => {
        const ri = RING_R[Math.min(RING_R.length - 1, Math.floor(t / 2))];
        g.draw(ring(ri, '#c8f0ff'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: Math.max(0, 1 - t / 24) });
      });
    }
    return h;
  };
  FX.warp = (s, c) => sparkles(s, c, 'white', { n: 14 });
  /**
   * a member casting a spell (§11.5.12 Part A8): a magic circle in the element's colour turns at the feet (a dotted
   * 24×6 ellipse, 10 frames) while six motes gather at the cast point
   */
  FX.cast = (s, c) => {
    const r = c.user;
    if (!r) return 0;
    const els = elementsOf(c.ab);
    const order = Object.keys((DB && DB.elements) || {});
    const el = order.find((e) => els.includes(e)) || els[0];
    const col = (el && DB.elements && DB.elements[el] && DB.elements[el].color) || '#e8e8ff';
    const lite = G().mix ? G().mix(col, '#ffffff', 0.6) : '#ffffff';
    const deep = G().shade ? G().shade(col, -0.25) : col;
    const glow = { fire: 'red', water: 'blue', wind: 'green', earth: 'orange', light: 'gold', dark: 'purple' }[el] || 'white';
    const feet = r.feet || [r.cx, r.bottom];
    const cp = r.cast || [r.cx - 8, r.cy];
    const RX = 14, RY = 4;
    inst(s, 20, 'under', (g, t) => {
      const grow = Math.min(1, (t + 1) / 4), fade = t > 14 ? Math.max(0, (20 - t) / 6) : 1;
      if (fade <= 0) return;
      const cv = g.ctx, a0 = cv.globalAlpha;
      cv.globalAlpha = a0 * fade;
      const rx = RX * grow, ry = RY * grow;
      g.draw(get('glow_' + glow), feet[0] - rx * 2, feet[1] - ry * 3, { w: rx * 4, h: ry * 6, alpha: 0.55 });
      // the outer ring: solid in the element's colour, a bright arc turning round it
      const N = 44;
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const lit = ((i - Math.floor(t * 2.5)) % N + N) % N < 10;
        g.rect(Math.round(feet[0] + Math.cos(ang) * rx), Math.round(feet[1] + Math.sin(ang) * ry), 1, 1, lit ? '#ffffff' : i % 2 ? col : deep);
      }
      // the inner ring (counter-turning dashes) and four rune points
      for (let i = 0; i < 20; i++) {
        if ((i + Math.floor(t)) % 4 === 0) continue;
        const ang = (i / 20) * Math.PI * 2 - t * 0.3;
        g.rect(Math.round(feet[0] + Math.cos(ang) * rx * 0.6), Math.round(feet[1] + Math.sin(ang) * ry * 0.6), 1, 1, lite);
      }
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2 + t * 0.12;
        const x = Math.round(feet[0] + Math.cos(ang) * rx * 0.82), y = Math.round(feet[1] + Math.sin(ang) * ry * 0.82);
        g.rect(x - 1, y, 3, 1, lite); g.rect(x, y - 1, 1, 3, lite); g.rect(x, y, 1, 1, '#ffffff');
      }
      // light rising from the ring
      for (let k = 0; k < 5; k++) {
        const ph = (t * 0.9 + k * 7) % 12;
        const ang = k * 1.9 + 0.5;
        const x = Math.round(feet[0] + Math.cos(ang) * rx * 0.9), y0 = feet[1] + Math.sin(ang) * ry * 0.9;
        const h = 3 + Math.round(ph);
        g.rect(x, Math.round(y0 - h - ph), 1, h, k % 2 ? lite : col);
      }
      cv.globalAlpha = a0;
    });
    inst(s, 20, 'mid', (g, t) => {
      // motes gathering at the hand
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, t / 12), ang = (i / 6) * Math.PI * 2 + t * 0.2;
        const x = cp[0] + Math.cos(ang) * 14 * (1 - k), y = cp[1] + Math.sin(ang) * 10 * (1 - k) + (feet[1] - cp[1]) * (1 - k) * 0.5;
        g.draw(get(i % 2 ? 'tw_white' : 'tw_' + (glow === 'white' ? 'gold' : glow)), x - 3, y - 3, { alpha: k < 1 ? 1 : 0.6 });
      }
      if (t >= 8 && t < 14) twinkle(g, cp[0], cp[1], t < 11 ? 2 : 1, lite);
    });
    return 10;
  };

  // loose-id keywords (old data / saves only; new data writes exact ids). Matched per word: a keyword of
  // 4+ letters may start a word ('explo' → 'explosion'), a shorter one must BE the word ('mp', 'up', 'ice'),
  // so 'jump' is not 'mp', 'slice' is not 'ice' and 'uppercut' is not 'up'.
  const KEYWORDS = [
    ['breath', 'breath'], ['explo', 'explosion'], ['bomb', 'explosion'], ['meteor', 'explosion'], ['flare', 'explosion'],
    ['fire', 'fire'], ['flame', 'fire'], ['blaze', 'fire'], ['ice', 'ice'], ['frost', 'ice'], ['blizz', 'ice'],
    ['thunder', 'thunder'], ['bolt', 'thunder'], ['lightning', 'thunder'], ['wind', 'wind'], ['aero', 'wind'],
    ['tornado', 'wind'], ['earth', 'earth'], ['quake', 'earth'], ['rock', 'earth'], ['stone', 'earth'], ['water', 'water'],
    ['aqua', 'water'], ['wave', 'water'], ['holy', 'holy'], ['light', 'holy'], ['dark', 'dark'], ['shadow', 'dark'],
    ['drain', 'drain'], ['absorb', 'drain'], ['gravity', 'gravity'], ['death', 'death'], ['doom', 'death'],
    ['revive', 'revive'], ['raise', 'revive'], ['regen', 'regen'], ['heal', 'heal'], ['cure', 'cure'],
    ['mp', 'mp'], ['mana', 'mp'], ['ether', 'mp'], ['wp', 'mp'], ['debuff', 'debuff'], ['down', 'debuff'], ['break', 'debuff'],
    ['buff', 'buff'], ['up', 'buff'], ['protect', 'buff'], ['haste', 'buff'], ['dispel', 'dispel'],
    ['sleep', 'sleep'], ['poison', 'poison'], ['paraly', 'paralyze'], ['stun', 'stun'], ['confus', 'confuse'],
    ['silen', 'silence'], ['mute', 'silence'], ['blind', 'blind'], ['burn', 'burn'], ['freeze', 'freeze'], ['steal', 'steal'], ['mug', 'steal'],
    ['scan', 'scan'], ['smoke', 'smoke'], ['song', 'song'], ['sing', 'song'], ['dance', 'song'],
    ['grow', 'grow'], ['seed', 'grow'], ['warp', 'warp'], ['slash', 'slash'], ['cut', 'slash'], ['sword', 'slash'],
    ['pierce', 'pierce'], ['spear', 'pierce'], ['arrow', 'arrow'], ['shot', 'arrow'], ['jump', 'pierce'], ['lance', 'pierce'],
    ['lash', 'lash'], ['whip', 'lash'], ['stance', 'stance'], ['guard', 'stance'],
    ['claw', 'claw'], ['scratch', 'claw'], ['bite', 'bite'], ['fang', 'bite'], ['strike', 'strike'], ['punch', 'strike'],
    ['kick', 'strike'], ['smash', 'strike'], ['hit', 'strike'], ['blow', 'strike'], ['magic', 'magic'], ['spell', 'magic'],
  ];
  const wordHit = (tok, k) => (k.length >= 4 ? tok.startsWith(k) : tok === k);
  // Crest element ids (ice/thunder/holy) kept for old data; the six Chronicle elements come from DB.elements[el].fx
  const ELEM_FX = { fire: 'fire', water: 'water', wind: 'wind', earth: 'earth', light: 'holy', dark: 'dark', ice: 'ice', thunder: 'thunder', holy: 'holy' };
  const elemFx = (el) => (el && DB.elements && DB.elements[el] && DB.elements[el].fx) || ELEM_FX[el] || null;
  const SFX = {
    slash: 'attack', pierce: 'attack', strike: 'attack', claw: 'enemy_attack', bite: 'enemy_attack', arrow: 'arrow', lash: 'lash', stance: 'buff',
    fire: 'fire', ice: 'ice', thunder: 'thunder', wind: 'wind', earth: 'earth', water: 'water', holy: 'holy', dark: 'dark', explosion: 'fire', breath: 'breath',
    drain: 'dark', gravity: 'dark', death: 'death', heal: 'heal', mp: 'heal', cure: 'heal', revive: 'revive', regen: 'heal',
    buff: 'buff', debuff: 'debuff', dispel: 'magic', sleep: 'sleep', poison: 'poison', paralyze: 'status', confuse: 'status',
    silence: 'status', blind: 'status', burn: 'burn', freeze: 'freeze', stun: 'status', veil: 'buff', nimble: 'buff', counter: 'buff', cover: 'buff',
    steal: 'steal', scan: 'magic', smoke: 'escape', song: 'magic', grow: 'item', magic: 'magic', warp: 'warp', cast: 'magic',
  };

  /** the elements an action carries (spells: action.elements; techs / monster skills: the damage effect's element) */
  function elementsOf(ab) {
    if (!ab) return [];
    if (Array.isArray(ab.elements) && ab.elements.length) return ab.elements;
    const dm = (ab.effects || []).find((e) => e.type === 'damage' && e.element);
    if (!dm) return [];
    return Array.isArray(dm.element) ? dm.element : [dm.element];
  }

  /** fx id (+ the action's effects as a fallback) → {kind, level, variant} */
  function resolve(id, ab) {
    const s = String(id || '').toLowerCase();
    let kind = null;
    const bare = s.replace(/\d+$/, '');
    if (FX[bare]) kind = bare;
    else if (bare.startsWith('breath')) kind = 'breath';
    if (!kind && s) {
      const toks = s.split(/[^a-z]+/).filter(Boolean);
      for (const [k, v] of KEYWORDS) if (toks.some((t) => wordHit(t, k))) { kind = v; break; }
    }
    const effs = (ab && ab.effects) || [];
    const dm = effs.find((e) => e.type === 'damage');
    if (!kind && effs.length) {
      const els = elementsOf(ab);
      if (dm && dm.formula === 'breath') kind = 'breath';
      else if (dm && dm.drain) kind = 'drain';
      else if (dm && dm.formula === 'percent') kind = 'gravity';
      else if (dm && els.length && elemFx(els[0])) kind = elemFx(els[0]);
      else if (dm && dm.formula === 'fixed') kind = 'explosion';
      else if (dm && dm.formula === 'magic') kind = 'magic';
      else if (dm) kind = 'slash';
      else {
        const e = effs[0];
        kind = { heal: 'heal', healMp: 'mp', revive: 'revive', cure: 'cure', regen: 'regen', dispel: 'dispel', steal: 'steal', scan: 'scan', escape: 'smoke', grow: 'grow', cover: 'stance' }[e.type] ||
          (e.type === 'buff' ? (e.stages > 0 ? 'buff' : 'debuff') : e.type === 'status' ? (FX[e.status] ? e.status : e.status === 'death' ? 'death' : 'magic') : 'magic');
      }
    }
    kind = kind || 'strike';
    let variant = null;
    if (kind === 'breath') {
      variant = /fire|flame|burn/.test(s) ? 'fire' : /ice|frost|cold|snow|water/.test(s) ? 'ice' : /poison|venom|toxic/.test(s) ? 'poison' : /dark|shadow/.test(s) ? 'dark' : null;
      if (!variant) { const el = elementsOf(ab)[0]; variant = { fire: 'fire', ice: 'ice', water: 'ice', dark: 'dark' }[el] || null; }
    }
    return { kind, level: lvl(s), variant };
  }

  /** sound for an fx kind: the element's own sfx first (DB.elements[el].sfx — light → 'light'), then SFX */
  function sfxFor(kind, ab) {
    for (const el of elementsOf(ab)) {
      const e = DB.elements && DB.elements[el];
      if (e && e.sfx && (e.fx || ELEM_FX[el]) === kind) return e.sfx;
    }
    if (kind === 'holy' && ab && ab.kind) return 'light'; // light spells / techs (audio falls back to 'holy')
    return SFX[kind] || 'magic';
  }

  /** start an effect; returns frames until impact. ctx: {user, targets, ab, kind, rate} */
  function play(scene, id, ctx) {
    if (Array.isArray(id)) id = id[0]; // fx arrays are chained by the scene (battle_scene.js playFx)
    ctx = Object.assign({ targets: [] }, ctx);
    ctx.targets = (ctx.targets || []).filter(Boolean);
    const r = resolve(id, ctx.ab);
    const fn = FX[r.kind] || FX.strike;
    R.sfx(sfxFor(r.kind, ctx.ab));
    RATE = ctx.rate && ctx.rate > 0 ? ctx.rate : 1;
    try {
      const hold = fn(scene, ctx, r.level, r.variant) || 0;
      return RATE !== 1 ? Math.ceil(hold / RATE) : hold;
    } finally { RATE = 1; }
  }

  /** every fx id this module draws (exact ids data may write, with the level digits) */
  const IDS = (() => {
    const out = [];
    for (const k of Object.keys(FX)) { out.push(k); if (['slash', 'pierce', 'strike', 'claw', 'bite', 'arrow', 'lash', 'fire', 'ice', 'thunder', 'wind', 'earth', 'water', 'holy', 'dark', 'explosion', 'heal', 'magic', 'mp'].includes(k)) out.push(k + '2', k + '3'); }
    out.push('breath_fire', 'breath_ice', 'breath_poison', 'breath_dark');
    return out;
  })();

  R.BattleFX = { play, resolve, sfxFor, elementsOf, glyphs, dissolve, fallbackBg, ring, get, twinkle, pixLine, FX, SFX, IDS, icons: ICONS, ICON_KEYS: Object.keys(ICONS) };
})(window.RPG);
