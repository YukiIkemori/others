// Battle effects: procedural spell/attack animations, damage digits, status
// icons, monster dissolve frames. Every sprite is built once (R.Gfx.def 'bfx:*'
// keys or a cache on the source canvas); per frame we only blit.
//
// R.BattleFX.play(scene, fxId, ctx) starts an animation and returns the number
// of frames until its impact. ctx: {user: rect|null, targets:[rect], ab, kind}
// rect = {x,y,w,h,cx,cy,bottom,side:'mon'|'party'}. The scene owns the instance
// list (scene.addFx) and draws 'mid' instances above the monsters and 'top'
// instances above the status windows.
//
// fx ids (DESIGN-free vocabulary, matched by keyword, optional level digit 1–3):
//   slash pierce strike claw bite · fire ice thunder wind earth water holy dark
//   explosion breath(_fire/_ice/_poison/_dark) drain gravity death · heal mp cure
//   revive regen buff debuff dispel · sleep poison paralyze confuse silence blind
//   steal scan smoke song grow magic warp
(function (R) {
  'use strict';
  const U = R.U;
  const G = () => R.Gfx;

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
  const TW = { white: '#d8e8ff', green: '#6ee07a', cyan: '#6fd8ff', gold: '#ffd24a', purple: '#c38cff', red: '#ff5a4a', pink: '#ff8cc6', blue: '#4a78ff' };
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
  const DIGIT_COL = { white: ['#ffffff', '#c8c8d8'], green: ['#90ff9c', '#3cc05a'], cyan: ['#b0ecff', '#4aa8e8'], yellow: ['#fff4a0', '#ffc030'], red: ['#ffb0a0', '#ff4a3a'], purple: ['#e8c8ff', '#a060e0'], gray: ['#e0e0e0', '#a0a0a0'] };
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

  // ------------------------------------------------------------ status icons (8×8)
  const ICONS = {
    poison: [['..#.....', '.###....', '.####...', '######..', '#####...', '.###....', '........', '........'], '#b060e0', '#60d060'],
    sleep: [['####....', '..#.....', '.#......', '####.###', '.....#..', '....###.', '........', '........'], '#c8b0ff'],
    paralyze: [['....##..', '...##...', '..####..', '....##..', '...##...', '..##....', '..#.....', '........'], '#ffe45a'],
    confuse: [['.#...#..', '###.###.', '.#...#..', '...#....', '..###...', '...#....', '........', '........'], '#ff8cc6'],
    // silence: a speech bubble crossed out (white); blind: an eye (blue) — easy to tell apart at 8 px
    silence: [['.######.', '#......#', '#.#..#.#', '#..##..#', '#.#..#.#', '.######.', '.#......', '#.......'], '#f0f0f0'],
    blind: [['........', '..####..', '.#....#.', '#..##..#', '#..##..#', '.#....#.', '..####..', '........'], '#6fa8ff'],
    regen: [['..##....', '..##....', '######..', '######..', '..##....', '..##....', '........', '........'], '#6ee07a'],
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
  const BBG_COL = {
    grass: ['#5a9cff', '#bfe0ff', '#4caf3c', '#2e7a28'], forest: ['#3a7ad8', '#a8d0f0', '#2a7a30', '#1a4a1c'],
    hills: ['#5a9cff', '#c8e4ff', '#7a9c3a', '#4a6a24'], desert: ['#6ab0ff', '#fff0c8', '#e0c070', '#b08a40'],
    snow: ['#8ab0e0', '#e8f0ff', '#e8f0f8', '#a8b8d0'], swamp: ['#5a6a8a', '#a8a8c0', '#5a4a6a', '#3a2a4a'],
    wasteland: ['#b08a6a', '#f0c8a0', '#8a6a48', '#5a4028'], sea: ['#4a8ae0', '#c0e0ff', '#2a5cc8', '#1a3a8a'],
    cave: ['#18141c', '#302830', '#4a4038', '#2a241e'], fort: ['#1c1c24', '#3a3a44', '#5a5048', '#3a3028'],
    watercave: ['#101c30', '#203850', '#2a4a6a', '#1a2c44'], pyramid: ['#2a2014', '#5a4428', '#a08050', '#6a5030'],
    ice: ['#1a2a4a', '#4a6a9a', '#a8d0f0', '#6a90c0'], volcano: ['#3a0a08', '#8a2a10', '#5a2a1c', '#3a140c'],
    tower: ['#1a1a3a', '#4a4a7a', '#6a6a8a', '#40405a'], shrine: ['#2a2a4a', '#6a6a9a', '#a0a0c0', '#6a6a8a'],
    castle: ['#2a1a2a', '#5a3a4a', '#8a2a2a', '#5a1a1a'], demon: ['#140814', '#401a40', '#3a1a3a', '#1c0a1c'],
    throne: ['#1c0810', '#50182a', '#6a1a2a', '#3a0a14'],
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

  // ------------------------------------------------------------ effects
  const FX = {};
  const lvl = (id) => { const m = /(\d)\s*$/.exec(id || ''); return m ? U.clamp(+m[1], 1, 3) : 1; };
  const layerOf = (r) => (r.side === 'party' ? 'top' : 'mid');
  const ease = (x) => 1 - (1 - x) * (1 - x);
  function inst(scene, life, layer, draw) { scene.addFx({ life, layer, draw, t: 0 }); }


  FX.slash = (s, c) => {
    for (const r of c.targets) {
      const flip = c.kind === 'ability' && U.chance(0.5);
      inst(s, 16, layerOf(r), (g, t) => {
        const f = get('slash')[Math.min(2, Math.floor(t / 4))];
        g.draw(f, r.cx - 24, r.cy - 26, { flip });
        if (t >= 3 && t < 12) g.draw(get('spark'), r.cx - 9, r.cy - 9, { w: 18, h: 18, alpha: 1 - (t - 3) / 9 });
      });
    }
    return 8;
  };
  FX.pierce = (s, c) => {
    for (const r of c.targets) {
      inst(s, 16, layerOf(r), (g, t) => {
        const k = ease(Math.min(1, t / 5));
        const x0 = r.cx - 34 + 34 * k, y0 = r.cy + 34 - 34 * k;
        if (t < 9) for (let i = 0; i < 26; i++) g.rect(x0 - i, y0 + i - 1, 3, i < 6 ? 3 : 2, i < 6 ? '#ffffff' : i < 14 ? '#c8dcff' : '#7aa0e8');
        if (t >= 4) g.draw(get('spark'), r.cx - 9, r.cy - 9, { w: 18, h: 18, alpha: Math.max(0, 1 - (t - 4) / 10) });
      });
    }
    return 8;
  };
  FX.strike = (s, c) => {
    for (const r of c.targets) {
      inst(s, 14, layerOf(r), (g, t) => {
        const ri = RING_R[Math.min(RING_R.length - 1, Math.floor(t / 2))];
        g.draw(ring(ri, '#ffffff'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: Math.max(0, 1 - t / 14) });
        if (t < 8) g.draw(get('spark'), r.cx - 4, r.cy - 4);
      });
    }
    return 6;
  };
  FX.claw = (s, c) => {
    for (const r of c.targets) {
      inst(s, 16, layerOf(r), (g, t) => {
        const f = get('claw')[Math.min(2, Math.floor(t / 4))];
        g.draw(f, r.cx - 15, r.cy - 15);
      });
    }
    return 8;
  };
  FX.bite = (s, c) => {
    for (const r of c.targets) {
      inst(s, 18, layerOf(r), (g, t) => {
        const k = t < 8 ? ease(t / 8) : 1;
        const gap = 16 * (1 - k), alpha = t > 14 ? (18 - t) / 4 : 1;
        g.draw(get('fang'), r.cx - 14, r.cy - 10 - gap, { alpha });
        g.draw(get('fang_lo'), r.cx - 14, r.cy + gap, { alpha });
        if (t >= 8 && t < 14) g.draw(get('spark'), r.cx - 4, r.cy - 4);
      });
    }
    return 10;
  };

  /** projectile from a party caster's window to each target; returns travel frames (0 for monsters) */
  function travel(s, c, drawOrb, T) {
    const from = c.user;
    if (!from || from.side !== 'party' || !c.targets.length || c.targets[0].side === 'party') return 0;
    T = T || 10;
    for (const r of c.targets) {
      inst(s, T, 'top', (g, t) => {
        const k = t / T;
        const x = from.cx + (r.cx - from.cx) * k;
        const y = from.bottom + (r.cy - from.bottom) * k - Math.sin(k * Math.PI) * 12;
        drawOrb(g, x, y, t);
      });
    }
    return T;
  }

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
      for (let i = 0; i < 3 + L; i++) spikes.push({ x: r.cx + U.rf(-r.w * 0.3, r.w * 0.3), h: U.rf(0.8, 1.6), f: U.chance(0.5) });
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
    return d0 + 18;
  };
  FX.thunder = (s, c, L) => {
    R.Engine.flashScreen('#ffffff', 6);
    for (const r of c.targets) {
      const bolts = [];
      for (let b = 0; b < 1 + L; b++) {
        const pts = [];
        let x = r.cx + U.rf(-10, 10), y = -4;
        const ty = r.side === 'party' ? r.y + r.h : r.cy;
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
          g.draw(get('glow_gold'), r.cx - 16, (r.side === 'party' ? r.y + r.h : r.cy) - 16);
        }
      });
    }
    return 16;
  };
  FX.wind = (s, c, L) => {
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 12 + L * 5; i++) parts.push({ a0: U.rf(0, Math.PI * 2), h: U.rf(0, 1), d: U.rf(0, 8), s: U.chance(0.5) ? 2 : 1 });
      const gusts = [];
      for (let i = 0; i < 6; i++) gusts.push({ y: r.y + U.rf(0.1, 0.9) * r.h, d: U.rf(0, 14), len: U.rf(14, 30) });
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
          const x = r.x - 20 + (r.w + 40) * (a / 14);
          g.rect(Math.round(x - q.len), Math.round(q.y), Math.round(q.len), 1, 'rgba(255,255,255,0.8)');
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
      const top = r.side === 'party' ? -10 : Math.max(40, r.y - 30);
      inst(s, 40, layerOf(r), (g, t) => {
        const land = r.side === 'party' ? r.y + r.h - 6 : r.bottom - 4;
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
        const base = r.side === 'party' ? r.y + r.h : r.bottom;
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
  FX.holy = (s, c) => {
    R.Engine.flashScreen('#ffffff', 8);
    for (const r of c.targets) {
      const tws = [];
      for (let i = 0; i < 10; i++) tws.push({ x: r.cx + U.rf(-r.w * 0.5, r.w * 0.5), y: r.cy + U.rf(-r.h * 0.5, r.h * 0.4), d: U.rf(6, 18) });
      inst(s, 36, layerOf(r), (g, t) => {
        const k = t < 8 ? t / 8 : t > 26 ? Math.max(0, (36 - t) / 10) : 1;
        const top = r.side === 'party' ? r.y + r.h : r.bottom;
        g.draw(get('pillar'), r.cx - 12, top - 150, { alpha: k, h: 150 });
        for (const p of tws) { const a = t - p.d; if (a >= 0 && a < 12) g.draw(get('tw_white'), p.x - 3, p.y - a * 0.8 - 3, { alpha: 1 - a / 12 }); }
      });
    }
    return 20;
  };
  FX.dark = (s, c, L) => {
    R.Engine.flashScreen('#200030', 10);
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 10 + L * 4; i++) parts.push({ a: U.rf(0, Math.PI * 2), d: U.rf(0, 8), dist: U.rf(24, 44) });
      inst(s, 34, layerOf(r), (g, t) => {
        for (const p of parts) {
          const k = (t - p.d) / 18;
          if (k < 0 || k > 1) continue;
          const ang = p.a + k * 3;
          const dd = p.dist * (1 - k);
          g.draw(get('orb_purple'), r.cx + Math.cos(ang) * dd - 4, r.cy + Math.sin(ang) * dd * 0.7 - 4, { alpha: 0.4 + k * 0.6 });
        }
        if (t > 16 && t < 30) {
          const ri = RING_R[Math.min(RING_R.length - 1, Math.floor((t - 16) / 2))];
          g.draw(ring(ri, '#a060e0'), r.cx - ri - 1.5, r.cy - ri - 1.5, { alpha: (30 - t) / 14 });
        }
      });
    }
    return 20;
  };
  FX.explosion = (s, c, L) => {
    R.Engine.shake(16, 3);
    R.Engine.flashScreen('#ffe0a0', 8);
    for (const r of c.targets) {
      const parts = [];
      for (let i = 0; i < 10 + L * 4; i++) { const a = U.rf(0, Math.PI * 2); parts.push({ a, sp: U.rf(0.6, 1.6), d: U.rf(0, 4) }); }
      inst(s, 30, layerOf(r), (g, t) => {
        if (t < 16) g.draw(get('glow_gold'), r.cx - 32, r.cy - 32, { alpha: 1 - t / 16, w: 64, h: 64 });
        const fr = get('flame');
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a >= 16) continue;
          g.draw(fr[Math.floor(a / 4)], r.cx + Math.cos(p.a) * a * p.sp * 1.8 - 12, r.cy + Math.sin(p.a) * a * p.sp * 1.3 - 16, { w: 24, h: 24 });
        }
      });
    }
    return 16;
  };
  FX.breath = (s, c, L, variant) => {
    const V = {
      fire: { img: () => get('flame')[1], glow: 'glow_red', sfx: 'fire' },
      ice: { img: () => get('shard'), glow: 'glow_cyan', sfx: 'ice' },
      poison: { img: () => get('bubble_green'), glow: 'glow_green', sfx: 'poison' },
      dark: { img: () => get('orb_purple'), glow: 'glow_purple', sfx: 'dark' },
      none: { img: () => get('smoke')[0], glow: 'glow_white', sfx: 'breath' },
    }[variant || 'none'];
    const from = c.user || { cx: 128, cy: 90 };
    const parts = [];
    for (let i = 0; i < 40; i++) parts.push({ tx: U.rf(0, 256), ty: U.rf(10, 60), d: U.rf(0, 18), s: U.rf(0.8, 1.8) });
    inst(s, 42, 'top', (g, t) => {
      const img = V.img();
      for (const p of parts) {
        const a = (t - p.d) / 20;
        if (a < 0 || a > 1) continue;
        const x = from.cx + (p.tx - from.cx) * a, y = from.cy + (p.ty - from.cy) * a;
        const w = img.width * p.s * (0.6 + a), h = img.height * p.s * (0.6 + a);
        g.draw(img, x - w / 2, y - h / 2, { w, h, alpha: Math.min(1, (1 - a) * 3) });
      }
      if (t > 12 && t < 34) g.draw(get(V.glow), 0, 0, { w: 256, h: 70, alpha: 0.35 * Math.sin(((t - 12) / 22) * Math.PI) });
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
      inst(s, 30, layerOf(r), (g, t) => {
        if (o.glow && t < 22) g.draw(get('glow_' + o.glow), r.cx - 20, r.cy - 20, { w: 40, h: 40, alpha: Math.sin((t / 22) * Math.PI) * 0.7 });
        for (const p of parts) {
          const a = t - p.d;
          if (a < 0 || a > 18) continue;
          g.draw(get('tw_' + (o.alt && (a | 0) % 4 < 2 ? o.alt : color)), p.x - 3, p.y - a * p.v * (o.down ? -1 : 1) - 3, { alpha: Math.min(1, (18 - a) / 6) });
        }
      });
    }
    return 16;
  }
  FX.heal = (s, c) => sparkles(s, c, 'green', { alt: 'white', glow: 'green' });
  FX.mp = (s, c) => sparkles(s, c, 'cyan', { alt: 'blue', glow: 'cyan' });
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
        const top = r.side === 'party' ? r.y + r.h : r.bottom;
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
  FX.steal = (s, c) => {
    for (const r of c.targets) {
      inst(s, 18, layerOf(r), (g, t) => {
        const k = Math.min(1, t / 8);
        for (let i = 0; i < 20; i++) g.rect(r.cx - 30 + 60 * k - i * 2, r.cy - 4 + (i % 3), 2, 1, i < 4 ? '#ffffff' : '#9ac0ff');
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
  FX.magic = (s, c) => sparkles(s, c, 'white', { alt: 'cyan', n: 10 });
  FX.warp = (s, c) => sparkles(s, c, 'white', { n: 14 });
  /** caster sparkle (party member casting a spell) */
  FX.cast = (s, c) => {
    const r = c.user;
    if (!r) return 0;
    inst(s, 16, 'top', (g, t) => {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + t * 0.25;
        g.draw(get(i % 2 ? 'tw_white' : 'tw_gold'), r.cx + Math.cos(ang) * (22 - t) - 3, r.cy + Math.sin(ang) * (10 - t * 0.4) - 3, { alpha: Math.min(1, (16 - t) / 5) });
      }
    });
    return 10;
  };

  // keyword → effect (first match wins)
  const KEYWORDS = [
    ['breath', 'breath'], ['explo', 'explosion'], ['bomb', 'explosion'], ['meteor', 'explosion'], ['flare', 'explosion'],
    ['fire', 'fire'], ['flame', 'fire'], ['blaze', 'fire'], ['ice', 'ice'], ['frost', 'ice'], ['blizz', 'ice'],
    ['thunder', 'thunder'], ['bolt', 'thunder'], ['lightning', 'thunder'], ['spark', 'thunder'], ['wind', 'wind'], ['aero', 'wind'],
    ['tornado', 'wind'], ['earth', 'earth'], ['quake', 'earth'], ['rock', 'earth'], ['stone', 'earth'], ['water', 'water'],
    ['aqua', 'water'], ['wave', 'water'], ['holy', 'holy'], ['light', 'holy'], ['dark', 'dark'], ['shadow', 'dark'],
    ['drain', 'drain'], ['absorb', 'drain'], ['gravity', 'gravity'], ['death', 'death'], ['doom', 'death'],
    ['revive', 'revive'], ['raise', 'revive'], ['regen', 'regen'], ['heal', 'heal'], ['cure', 'cure'], ['esuna', 'cure'],
    ['mp', 'mp'], ['mana', 'mp'], ['ether', 'mp'], ['debuff', 'debuff'], ['down', 'debuff'], ['break', 'debuff'],
    ['buff', 'buff'], ['up', 'buff'], ['protect', 'buff'], ['haste', 'buff'], ['dispel', 'dispel'],
    ['sleep', 'sleep'], ['poison', 'poison'], ['paraly', 'paralyze'], ['stun', 'paralyze'], ['confus', 'confuse'],
    ['silen', 'silence'], ['mute', 'silence'], ['blind', 'blind'], ['dark', 'blind'], ['steal', 'steal'], ['mug', 'steal'],
    ['scan', 'scan'], ['libra', 'scan'], ['smoke', 'smoke'], ['song', 'song'], ['sing', 'song'], ['dance', 'song'],
    ['grow', 'grow'], ['seed', 'grow'], ['warp', 'warp'], ['slash', 'slash'], ['cut', 'slash'], ['sword', 'slash'],
    ['pierce', 'pierce'], ['spear', 'pierce'], ['arrow', 'pierce'], ['shot', 'pierce'], ['jump', 'pierce'], ['lance', 'pierce'],
    ['claw', 'claw'], ['scratch', 'claw'], ['bite', 'bite'], ['fang', 'bite'], ['strike', 'strike'], ['punch', 'strike'],
    ['kick', 'strike'], ['smash', 'strike'], ['hit', 'strike'], ['blow', 'strike'], ['magic', 'magic'], ['spell', 'magic'],
  ];
  const ELEM_FX = { fire: 'fire', ice: 'ice', thunder: 'thunder', wind: 'wind', earth: 'earth', water: 'water', holy: 'holy', dark: 'dark' };
  const SFX = {
    slash: 'attack', pierce: 'attack', strike: 'attack', claw: 'enemy_attack', bite: 'enemy_attack', fire: 'fire', ice: 'ice',
    thunder: 'thunder', wind: 'wind', earth: 'earth', water: 'water', holy: 'holy', dark: 'dark', explosion: 'fire', breath: 'breath',
    drain: 'dark', gravity: 'dark', death: 'death', heal: 'heal', mp: 'heal', cure: 'heal', revive: 'revive', regen: 'heal',
    buff: 'buff', debuff: 'debuff', dispel: 'magic', sleep: 'sleep', poison: 'poison', paralyze: 'status', confuse: 'status',
    silence: 'status', blind: 'status', steal: 'steal', scan: 'magic', smoke: 'escape', song: 'magic', grow: 'item', magic: 'magic', warp: 'warp',
  };

  /** fx id (+ the action's effects as a fallback) → {kind, level, variant} */
  function resolve(id, ab) {
    const s = String(id || '').toLowerCase();
    let kind = null;
    if (FX[s.replace(/\d+$/, '')]) kind = s.replace(/\d+$/, '');
    // whole words first ('jump' must not hit 'mp' / 'up'), then any substring
    if (!kind && s) { const toks = s.split(/[^a-z]+/).filter(Boolean); for (const [k, v] of KEYWORDS) if (toks.some((t) => t.startsWith(k))) { kind = v; break; } }
    if (!kind && s) for (const [k, v] of KEYWORDS) if (s.includes(k)) { kind = v; break; }
    const effs = (ab && ab.effects) || [];
    const dm = effs.find((e) => e.type === 'damage');
    if (!kind && effs.length) {
      if (dm && dm.formula === 'breath') kind = 'breath';
      else if (dm && dm.drain) kind = 'drain';
      else if (dm && dm.formula === 'percent') kind = 'gravity';
      else if (dm && dm.element) kind = ELEM_FX[dm.element];
      else if (dm && dm.formula === 'fixed') kind = 'explosion';
      else if (dm && dm.formula === 'magic') kind = 'magic';
      else if (dm) kind = 'slash';
      else {
        const e = effs[0];
        kind = { heal: 'heal', healMp: 'mp', revive: 'revive', cure: 'cure', regen: 'regen', dispel: 'dispel', steal: 'steal', scan: 'scan', escape: 'smoke', grow: 'grow' }[e.type] ||
          (e.type === 'buff' ? (e.stages > 0 ? 'buff' : 'debuff') : e.type === 'status' ? (FX[e.status] ? e.status : e.status === 'death' ? 'death' : 'magic') : 'magic');
      }
    }
    kind = kind || 'strike';
    let variant = null;
    if (kind === 'breath') {
      variant = /fire|flame|burn/.test(s) ? 'fire' : /ice|frost|cold|snow/.test(s) ? 'ice' : /poison|venom|toxic/.test(s) ? 'poison' : /dark|shadow/.test(s) ? 'dark' : null;
      if (!variant && dm && dm.element) variant = { fire: 'fire', ice: 'ice', dark: 'dark' }[dm.element] || null;
    }
    return { kind, level: lvl(s), variant };
  }

  /** start an effect; returns frames until impact. ctx: {user, targets, ab, kind} */
  function play(scene, id, ctx) {
    const r = resolve(id, ctx.ab);
    const fn = FX[r.kind] || FX.strike;
    R.sfx(SFX[r.kind] || 'magic');
    return fn(scene, ctx, r.level, r.variant) || 0;
  }

  R.BattleFX = { play, resolve, glyphs, dissolve, fallbackBg, ring, get, FX, SFX, icons: ICONS };
})(window.RPG);
