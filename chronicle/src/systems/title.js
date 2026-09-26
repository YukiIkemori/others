// タイトル画面（担当 newgame A6。DESIGN §11.8.1・§3.3.12）。
// 夕暮れから夜へ変わる空、左の岬のファロス灯台（光の筋が回る）、右の沖の霧に包まれた島と塔、
// 開いた年代記と羽ペン、「ルミナス・クロニクル 〜八つの伝承〜」のロゴと © Studio Metem。
// コマンド: はじめから / つづきから / 冒険の合言葉 / 設定。
//   R.Title.start()
(function (R) {
  'use strict';
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Title = (R.Title = R.Title || {});

  const SKY = ['#0a0c24', '#101640', '#1a2256', '#28306a', '#3a3c78', '#5a4a84', '#806088', '#a87888'];
  const SEA = '#1c2a4a', WAVE = '#2c3c64';
  const HORIZON = 112;
  const LAMP = { x: 31, y: 57 }; // lamp room of the lighthouse
  const BOOK = { x: 80, y: 178, w: 96, h: 28 };
  const MENU = { x: 76, y: 108, w: 104, h: 64 };
  let bgCache = null, bookCache = null, logoCache = null, quillCache = null, fogCache = null;

  // ------------------------------------------------------------ static art (built once, reused)
  function buildBackground() {
    const W = R.W, H = R.H;
    const p = G().pix(W, H);
    // sky: 8 bands of 14px, SFC-style dithered seams
    for (let y = 0; y < HORIZON; y++) {
      const b = Math.floor(y / 14), r = y % 14;
      for (let x = 0; x < W; x++) {
        let c = SKY[b];
        if (b < SKY.length - 1 && r >= 12 && (x + y) % 2 === 0) c = SKY[b + 1];
        if (b > 0 && r === 0 && (x + y) % 2 === 1) c = SKY[b - 1];
        p.set(x, y, c);
      }
    }
    // far clouds catching the last light
    const cloud = (cx, cy, len, col) => {
      for (let i = 0; i < len; i++) {
        const t = i / len, w = Math.round(Math.sin(t * Math.PI) * 3);
        p.hline(cx + i * 2, cx + i * 2 + 3, cy - (w > 1 ? 1 : 0), col);
        if (w > 1) p.hline(cx + i * 2 - 1, cx + i * 2 + 2, cy, col);
      }
    };
    cloud(96, 88, 18, '#6e5688'); cloud(100, 89, 14, '#8a6a92');
    cloud(150, 80, 12, '#5a4a84'); cloud(20, 94, 16, '#8a6a92'); cloud(24, 95, 12, '#9a7890');
    // sea with a pale horizon: the dusk sheen near the horizon, deeper water toward the viewer
    p.rect(0, HORIZON, W, H - HORIZON, SEA);
    p.hline(0, W - 1, HORIZON, '#8a6c88');
    p.hline(0, W - 1, HORIZON + 1, '#4a4a78');
    for (let y = HORIZON + 2; y < HORIZON + 12; y++) {
      const k = (y - HORIZON - 2) / 10;
      for (let x = 0; x < W; x++) if (((x * 7 + y * 13) % 17) / 17 > 0.35 + k * 0.6 && (x + y) % 2 === 0) p.set(x, y, k < 0.5 ? '#3a3c6a' : '#2c3458');
    }
    for (let y = 196; y < H; y++) for (let x = (y % 2); x < W; x += 2) p.set(x, y, '#18243e');
    for (let y = 212; y < H; y++) for (let x = ((y + 1) % 2); x < W; x += 2) p.set(x, y, '#18243e');
    // the island offshore with the thin tower (Biblia's great library), dark against the dusk:
    // a rocky low spur, a hill carrying the library hall, and the tower rising out of it
    const IS = '#2a2c40', IS2 = '#222336', RIM = '#3c3a5a', WIN = '#ffe8a0', WIN2 = '#d8a850';
    p.poly([[158, HORIZON + 1], [163, 109], [170, 108], [176, 109], [181, HORIZON + 1]], IS);
    p.poly([[172, HORIZON + 1], [182, 107], [190, 104], [197, 100], [204, 97], [212, 96], [221, 97], [229, 100], [237, 104], [245, 107], [252, 109], [255, HORIZON + 1]], IS);
    p.poly([[221, 97], [229, 100], [237, 104], [245, 107], [252, 109], [255, HORIZON + 1], [226, HORIZON + 1], [224, 104]], IS2);
    for (const [x, y] of [[164, 109], [165, 108], [183, 106], [186, 105], [191, 103], [195, 101], [199, 99], [203, 97]]) p.hline(x, x + 2, y, RIM);
    // the library hall on the hilltop: a long roof with a gable, lit windows
    p.rect(197, 89, 26, 8, IS);
    p.poly([[195, 90], [203, 85], [217, 85], [225, 90]], IS);
    p.hline(196, 224, 90, RIM);
    p.rect(219, 89, 4, 8, IS2);
    for (const x of [200, 204, 216, 220]) { p.set(x, 92, WIN2); p.set(x, 93, WIN2); }
    p.rect(209, 91, 3, 5, '#3a3040'); p.set(210, 91, WIN);
    // the tower: three tiers with cornices, a lantern and a slim spire (its tip stays below the gold rule at y 49)
    p.rect(206, 72, 8, 17, IS); p.rect(214, 72, 1, 17, IS2);
    p.rect(205, 71, 10, 2, RIM);
    p.rect(207, 63, 6, 8, IS); p.rect(212, 63, 1, 8, IS2);
    p.rect(206, 62, 8, 1, RIM);
    p.rect(208, 57, 4, 5, IS);
    p.vline(209, 52, 56, IS); p.vline(210, 54, 56, IS); p.set(209, 51, RIM);
    p.set(209, 58, '#fff4c8'); p.set(210, 58, '#fff4c8'); p.set(209, 59, WIN); p.set(210, 59, WIN2);
    for (const [x, y] of [[208, 65], [210, 75], [208, 81]]) { p.set(x, y, WIN); p.set(x, y + 1, WIN2); }
    for (let x = 160; x < 255; x++) if (x % 3) p.set(x, HORIZON + 1, '#3a3c5a');
    // the cape (left) and the Pharos lighthouse
    const CP = '#141a30', CP2 = '#1c2440', CP3 = '#0c1022';
    p.poly([[0, 88], [14, 86], [30, 84], [44, 86], [58, 92], [68, 100], [76, 108], [82, HORIZON + 6], [0, HORIZON + 10]], CP);
    p.poly([[0, 92], [20, 90], [40, 92], [54, 98], [64, 106], [72, HORIZON + 6], [0, HORIZON + 10]], CP2);
    p.poly([[0, 100], [18, 100], [34, 104], [52, 108], [66, HORIZON + 8], [0, HORIZON + 12]], CP3);
    for (let x = 4; x < 66; x += 7) p.set(x, 93 + (x % 3), '#2a3454');
    // rocks at the waterline
    p.ellipse(78, HORIZON + 5, 4, 2, CP3); p.ellipse(88, HORIZON + 8, 3, 1, CP3);
    // lighthouse tower: tapering white stone with red bands
    const tx = LAMP.x;
    for (let y = 62; y < 86; y++) {
      const half = 3 + Math.floor((y - 62) / 8);
      for (let x = tx - half; x <= tx + half; x++) {
        const band = (y >= 69 && y <= 71) || (y >= 78 && y <= 80);
        const light = x < tx;
        p.set(x, y, band ? (light ? '#b8485a' : '#8a2e44') : light ? '#d8d4e4' : '#9a98b8');
      }
      p.set(tx + half, y, '#6a6888');
    }
    p.rect(tx - 7, 86, 15, 3, '#3a3e5c'); p.rect(tx - 8, 88, 17, 1, '#2a2e48');
    p.rect(tx - 5, 60, 11, 2, '#3a3e5c'); // gallery
    p.rect(tx - 3, 54, 7, 6, '#f8e8a8'); // lamp room glass
    p.rect(tx - 1, 55, 3, 4, '#fffcf0');
    p.set(tx - 3, 54, '#3a3e5c'); p.set(tx + 3, 54, '#3a3e5c');
    p.rect(tx - 4, 52, 9, 2, '#3a3e5c'); p.rect(tx - 2, 50, 5, 2, '#3a3e5c'); p.set(tx, 49, '#3a3e5c');
    p.set(tx - 1, 76, '#fff0b0'); p.set(tx + 1, 66, '#fff0b0');
    // cottage at the foot of the lighthouse
    p.rect(44, 84, 12, 6, '#1c2440'); p.poly([[42, 84], [50, 79], [58, 84]], '#241e38'); p.set(48, 86, '#ffcf5a'); p.set(52, 86, '#ffcf5a');
    return p.toCanvas();
  }
  function buildBook() {
    const { w, h } = BOOK;
    const p = G().pix(w, h);
    const cover = G().ramp('#5a3a1c', 4, 0.45), page = ['#b8a880', '#d0c29c', '#e8dcbc', '#f4ecd4'];
    // cover under the pages
    p.poly([[2, 10], [48, 14], [94, 10], [95, 24], [48, 27], [1, 24]], cover[1]);
    p.poly([[2, 23], [48, 26], [94, 23], [95, 25], [48, 28], [1, 25]], cover[0]);
    p.set(3, 23, cover[3]); p.set(92, 23, cover[3]);
    // two page blocks curving up from the spine
    const pageSide = (dir) => {
      for (let i = 0; i < 44; i++) {
        const x = 48 + dir * (i + 1) - (dir > 0 ? 1 : 0);
        const top = Math.round(12 - Math.sin((i / 44) * Math.PI * 0.9) * 6 + (i > 40 ? (i - 40) : 0));
        const bot = 23 - Math.round(i / 22);
        for (let y = top; y <= bot; y++) {
          let c = page[2];
          if (y === top) c = page[3];
          if (y >= bot - 1) c = page[0];
          if (i < 3) c = page[1];
          p.set(x, y, c);
        }
        // lines of writing
        if (i > 5 && i < 40 && i % 1 === 0) for (let k = 0; k < 4; k++) {
          const ly = top + 3 + k * 2;
          if (ly < bot - 2 && ((i * 7 + k * 13) % 11) > 2) p.set(x, ly, '#a8987a');
        }
      }
    };
    pageSide(-1); pageSide(1);
    // binding / spine
    p.vline(48, 11, 25, '#8a6a3c'); p.vline(47, 12, 24, '#a07c48');
    p.set(48, 26, cover[0]);
    // ribbon bookmark
    p.vline(60, 20, 27, '#b83c3c'); p.set(61, 27, '#8a2c2c');
    p.outline('#1c1420');
    return p.toCanvas();
  }
  /**
   * a bank of mist: a low band with a bumpy upper edge, flat underneath, a brighter crown and dithered
   * fringes (drawn at 50% over the island so its silhouette still reads through)
   */
  function buildWisp(w, h, seed) {
    const p = G().pix(w, h);
    let sd = seed;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    for (let x = 0; x < w; x++) {
      const env = Math.pow(Math.sin((Math.PI * (x + 0.5)) / w), 0.6);
      const bump = 0.6 + 0.25 * Math.sin(x / 5 + ph[0]) + 0.15 * Math.sin(x / 2.3 + ph[1]);
      const top = Math.round((h - 1) * (1 - env * bump));
      for (let y = top; y < h; y++) {
        const edge = y === top, bottom = y === h - 1;
        if ((edge || bottom) && (x + y) % 2 === 1) continue; // ragged, dithered fringe
        p.set(x, y, y <= top + 1 ? '#f0f2fc' : '#d8dcf0');
      }
    }
    return p.toCanvas();
  }
  function buildQuill() {
    if (R.Gfx.has('obj:quill')) return null; // art-chars' quill is used when registered
    const p = G().pix(16, 16);
    const rows = [
      '..............wW',
      '............wwWw',
      '..........wwwWw.',
      '.........wwwWw..',
      '........wwwWw...',
      '.......wwwWw....',
      '......wwwWw.....',
      '.....wwwWw......',
      '....wwgWw.......',
      '...wwgW.........',
      '...wgW..........',
      '..wgW...........',
      '..gW............',
      '.gk.............',
      '.k..............',
      'k...............',
    ];
    p.grid(0, 0, rows, { w: '#e8ecf8', W: '#ffffff', g: '#9ca4c0', k: '#3a3440' });
    p.outline('#1c1420');
    return p.toCanvas();
  }
  /** the logo at full device resolution: shadow, dark rim and a warm cream face */
  function buildLogo() {
    const S = R.SCALE, size = 64 / 3;
    const text = R.TITLE || 'ルミナス・クロニクル';
    const tmp = G().makeCanvas(8, 8).getContext('2d');
    tmp.font = size * S + 'px ' + G().FONT;
    const tw = Math.ceil(tmp.measureText(text).width / S);
    const pad = 4;
    const cv = G().makeCanvas((tw + pad * 2) * S, Math.ceil(size + pad * 2) * S);
    const c = cv.getContext('2d');
    c.scale(S, S);
    c.font = size + 'px ' + G().FONT;
    c.textBaseline = 'top';
    c.lineJoin = 'round';
    const x = pad, y = pad;
    c.fillStyle = '#1a1238';
    c.fillText(text, x + 1, y + 1.25);
    c.strokeStyle = '#3a2a60';
    c.lineWidth = 1.5;
    c.strokeText(text, x, y);
    const g = c.createLinearGradient(0, y + 2, 0, y + size);
    g.addColorStop(0, '#fffdf0'); g.addColorStop(0.45, '#fff4c8'); g.addColorStop(0.55, '#f8e4a8'); g.addColorStop(1, '#fff0c0');
    c.fillStyle = g;
    c.fillText(text, x, y);
    return { cv, w: cv.width / S, h: cv.height / S, pad };
  }
  const fontReady = () => {
    try { return typeof document === 'undefined' || !document.fonts || document.fonts.check('32px "DotGothic16"'); } catch (e) { return true; }
  };

  function makeStars() {
    const out = [];
    for (let i = 0; i < 70; i++) {
      const y = Math.floor(Math.pow(U.r(), 1.3) * 80);
      out.push({ x: U.ri(0, R.W - 1), y, b: U.r(), s: U.r() < 0.1 ? 2 : 1, ph: U.ri(0, 400), sp: U.ri(90, 240), c: U.r() < 0.4 ? '#c8d0ff' : '#ffffff' });
    }
    return out;
  }
  function makeWaves() {
    const out = [];
    for (let i = 0; i < 26; i++) {
      const y = HORIZON + 6 + Math.floor(Math.pow(U.r(), 1.2) * 104);
      const k = (y - HORIZON) / 112;
      out.push({ x: U.ri(0, 255), y, len: Math.round(4 + k * 14 + U.r() * 6), sp: 0.04 + k * 0.1 + U.r() * 0.03 });
    }
    return out;
  }

  // ------------------------------------------------------------ the layer
  class TitleLayer extends R.Layer {
    constructor() {
      super();
      this.busy = false;
      this.opaque = true;
      this.t = 0;
      this.stage = 'press';
      this.stars = makeStars();
      this.waves = makeWaves();
      this.motes = [];
      this.shoot = null;
      this.slots = null;
      this.list = null;
    }
    tick() {
      this.t++;
      if (!this.shoot && this.t > 120 && U.oneIn(420)) this.shoot = { x: U.ri(70, 200), y: U.ri(6, 36), t: 0 };
      if (this.shoot && ++this.shoot.t > 30) this.shoot = null;
      // eight motes of light drift up from the pages (the eight legends)
      if (this.motes.length < 8 && this.t % 37 === 0) {
        this.motes.push({ x: BOOK.x + 14 + U.ri(0, 68), y: BOOK.y + 10, vx: U.rf(-0.08, 0.08), life: 0, max: U.ri(150, 230), ph: U.r() * 6 });
      }
      for (const m of this.motes) { m.life++; m.y -= 0.12; m.x += m.vx + Math.sin((m.life + m.ph * 30) / 30) * 0.05; }
      this.motes = this.motes.filter((m) => m.life < m.max);
    }
    update() { if (!this.busy && !this.closed) this.input(); }
    flow(fn) {
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    input() {
      if (this.stage !== 'press') return;
      if (this.t > 20 && (In().pressed('a') || In().pressed('b') || In().pressed('y'))) {
        if (this.t < 70) { this.t = 70; return; } // the first press skips the fade-in
        R.sfx('confirm');
        R.bgm('title'); // the first press also unlocks audio
        this.stage = 'menu';
        this.flow(() => this.menu());
      }
    }
    async menu() {
      this.slots = await R.Save.list();
      const any = this.slots.some(Boolean);
      let last = any ? 1 : 0; // the cursor stays on the last choice
      for (;;) {
        this.stage = 'menu';
        const i = await R.Engine.run(new MenuLayer(this, any, last));
        if (i < 0) { this.stage = 'press'; return; }
        last = i;
        if (i === 0 && (await this.newGame())) return;
        if (i === 1 && (await this.continueGame())) return;
        if (i === 2 && (await this.codeGame())) return;
        if (i === 3 && R.Menu && R.Menu.settings) await R.Menu.settings();
      }
    }
    async newGame() {
      const ok = await R.UI.yesno('新しい冒険を始めますか？');
      R.UI.closeMessage();
      if (!ok) return false;
      R.sfx('confirm');
      this.stage = 'leave';
      if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(40);
      await R.Engine.fadeOut(40);
      this.close();
      R.State.newGame();
      const st = (R.DB.config && R.DB.config.start) || R.State.START || {};
      if (R.Field && R.Field.start) await R.Field.start(st.map, st.spawn);
      return true;
    }
    async continueGame() {
      const i = await R.Engine.run(new SlotPicker(this.slots));
      if (i == null || i < 0) return false;
      return this.boot(await R.Save.load(i));
    }
    async codeGame() {
      const code = R.Menu && R.Menu.codeOverlay ? await R.Menu.codeOverlay({ mode: 'import' }) : null;
      if (!code) return false;
      const data = await R.Save.importCode(code);
      if (!data || !data.game) { R.sfx('buzzer'); await R.UI.say('合言葉が正しくないようだ。'); R.UI.closeMessage(); return false; }
      return this.boot(data);
    }
    async boot(data) {
      if (!data || !R.State.deserialize(data)) { R.sfx('buzzer'); await R.UI.say('記録を読み込めなかった……。'); R.UI.closeMessage(); return false; }
      R.sfx('confirm');
      this.stage = 'leave';
      if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(40);
      await R.Engine.fadeOut(40);
      this.close();
      if (R.Field && R.Field.resume) await R.Field.resume();
      return true;
    }
    draw() {
      if (!bgCache) bgCache = buildBackground();
      if (!bookCache) { bookCache = buildBook(); quillCache = buildQuill(); }
      if (!logoCache || (!logoCache.ready && fontReady())) { logoCache = buildLogo(); logoCache.ready = fontReady(); }
      const g = G(), ctx = g.ctx, f = R.Engine.frame;
      g.draw(bgCache, 0, 0);
      // stars: slow twinkle in the upper 80px
      for (const s of this.stars) {
        const tw = Math.sin((f + s.ph) * (Math.PI * 2) / s.sp);
        ctx.globalAlpha = (0.25 + 0.75 * (0.5 + 0.5 * tw)) * (0.45 + 0.55 * s.b) * (s.y > 60 ? 0.6 : 1);
        g.rect(s.x, s.y, s.s === 2 ? 1 : 1, 1, s.c);
        if (s.s === 2 && tw > 0.75) { ctx.globalAlpha *= 0.6; g.rect(s.x - 1, s.y, 3, 1, s.c); g.rect(s.x, s.y - 1, 1, 3, s.c); }
      }
      ctx.globalAlpha = 1;
      if (this.shoot) {
        const sh = this.shoot, k = sh.t / 30;
        for (let i = 0; i < 12; i++) {
          ctx.globalAlpha = (1 - i / 12) * (1 - k) * 0.9;
          g.rect(Math.round(sh.x + sh.t * 3 - i * 2), Math.round(sh.y + sh.t * 1.1 - i * 0.7), 1, 1, '#ffffff');
        }
        ctx.globalAlpha = 1;
      }
      this.drawBeam(f);
      this.drawSea(f);
      this.drawFog(f);
      // lamp flicker
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(f / 9);
      g.rect(LAMP.x - 2, LAMP.y - 2, 5, 4, '#ffffff');
      ctx.globalAlpha = 1;
      // the chronicle and the quill, and eight motes of light
      g.draw(bookCache, BOOK.x, BOOK.y);
      const q = R.Gfx.has('obj:quill') ? R.Gfx.get('obj:quill') : quillCache;
      if (q) g.draw(Array.isArray(q) ? q[0] : q, BOOK.x + 66, BOOK.y - 7);
      for (const m of this.motes) {
        const a = Math.sin((m.life / m.max) * Math.PI);
        ctx.globalAlpha = a * 0.9;
        g.rect(Math.round(m.x), Math.round(m.y), 1, 1, '#fff4c8');
        ctx.globalAlpha = a * 0.35;
        g.rect(Math.round(m.x) - 1, Math.round(m.y), 3, 1, '#ffe890');
        g.rect(Math.round(m.x), Math.round(m.y) - 1, 1, 3, '#ffe890');
      }
      ctx.globalAlpha = 1;
      // logo, gold rule and subtitle fade in
      const fade = U.clamp((this.t - 10) / 60, 0, 1);
      ctx.globalAlpha = fade;
      const lx = 128 - logoCache.w / 2;
      g.draw(logoCache.cv, lx, 26 - logoCache.pad, { w: logoCache.w, h: logoCache.h });
      drawRule(128, 49);
      g.text(R.SUBTITLE || '', 128, 54, { align: 'center', color: '#e0d8ff', shadow: '#1a1238' });
      ctx.globalAlpha = 1;
      if (this.stage === 'press' && this.t > 70 && Math.floor(f / 32) % 2 === 0) {
        g.text('ボタンを押してください', 128, 150, { align: 'center', color: '#ffffff', shadow: '#10102a' });
      }
      g.text(R.COPYRIGHT || '© Studio Metem', 128, 210, { align: 'center', color: '#c8c8e0', shadow: '#0c1020' });
      g.text('ver ' + R.VERSION, 250, 214, { align: 'right', size: 16 / 3, color: '#8c8c9c' });
    }
    /** the lamp turns once every 8 seconds: seen from the side the beam sweeps out to the right,
     *  shortens as it swings toward the viewer (a flash at the lamp), then reaches out to the left */
    drawBeam(f) {
      const g = G(), ctx = g.ctx;
      const th = (f / 480) * Math.PI * 2;
      const dx = Math.cos(th), toward = Math.sin(th);
      const x0 = LAMP.x, y0 = LAMP.y;
      const L = 12 + Math.abs(dx) * 190;
      const dir = dx >= 0 ? 1 : -1;
      const tilt = -0.05;
      const spread = 0.05 + (1 - Math.abs(dx)) * 0.35;
      const beam = (len, sp, a) => {
        const ex = x0 + dir * Math.cos(tilt) * len, ey = y0 + Math.sin(tilt) * len;
        const grd = ctx.createLinearGradient(x0, y0, ex, ey);
        grd.addColorStop(0, 'rgba(255,244,200,' + a + ')');
        grd.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - 1);
        ctx.lineTo(ex, ey - len * sp);
        ctx.lineTo(ex, ey + len * sp);
        ctx.lineTo(x0, y0 + 1);
        ctx.closePath();
        ctx.fill();
      };
      const a = toward > 0 ? 0.35 + 0.25 * Math.abs(dx) : 0.18 + 0.2 * Math.abs(dx);
      beam(L, spread * 1.8, a * 0.45);
      beam(L * 0.85, spread * 0.8, a);
      // a flash while the lamp faces the viewer
      const flash = Math.max(0, toward) * Math.max(0, 1 - Math.abs(dx) * 3);
      if (flash > 0) {
        ctx.globalAlpha = flash * 0.8;
        g.rect(x0 - 4, y0 - 1, 9, 2, '#fff8e0'); g.rect(x0 - 1, y0 - 4, 2, 8, '#fff8e0');
        ctx.globalAlpha = flash * 0.35;
        g.rect(x0 - 7, y0, 15, 1, '#fff8e0'); g.rect(x0, y0 - 7, 1, 15, '#fff8e0');
        ctx.globalAlpha = 1;
      }
    }
    /** slow horizontal wave lines and the beam's glitter on the water */
    drawSea(f) {
      const g = G(), ctx = g.ctx;
      for (const w of this.waves) {
        const x = ((w.x + f * w.sp) % (R.W + 40)) - 20;
        const ph = Math.sin((f + w.x * 3) / 70);
        ctx.globalAlpha = 0.55 + 0.35 * ph;
        g.rect(Math.round(x), w.y, w.len, 1, WAVE);
        if (w.y < HORIZON + 30) g.rect(Math.round(x) + 2, w.y, Math.max(1, w.len - 5), 1, '#3a4a78');
      }
      // the beam glitters on the water while it points out to sea
      const dx = Math.cos((f / 480) * Math.PI * 2);
      if (dx > 0.2) {
        for (let k = 0; k < 14; k++) {
          const x = LAMP.x + 30 + ((k * 37 + Math.floor(f / 9) * 11) % Math.round(150 * dx));
          const y = HORIZON + 3 + ((k * 13) % 14);
          ctx.globalAlpha = (dx - 0.2) * (0.5 + 0.5 * Math.sin((f + k * 17) / 6));
          g.rect(x, y, 2 + (k % 3), 1, '#c8c0d8');
        }
      }
      // reflections of the island's lights
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(f / 23);
      for (let k = 0; k < 4; k++) g.rect(206 + ((k * 5 + Math.floor(f / 24)) % 6), HORIZON + 4 + k * 3, 2 + (k % 2), 1, '#7a6a70');
      ctx.globalAlpha = 1;
    }
    /** white mist around the island (#d8dcf0 at 50%): thin wisps drifting left and right at their own pace */
    drawFog(f) {
      const g = G(), ctx = g.ctx;
      if (!fogCache) fogCache = [buildWisp(84, 7, 7), buildWisp(52, 6, 19), buildWisp(46, 6, 31), buildWisp(34, 5, 43)];
      // [wisp, centre x, top y, sway (px), speed]: the waterline, the right slope, the left hill, the hall's foot
      const banks = [[0, 204, 106, 7, 1], [1, 238, 102, 6, -0.7], [2, 184, 101, 5, 0.8], [3, 216, 92, 4, -1.1]];
      banks.forEach(([i, x, y, amp, k], n) => {
        const ox = x + Math.sin((f / 190) * k + n * 1.9) * amp;
        ctx.globalAlpha = 0.5;
        g.draw(fogCache[i], Math.round(ox - fogCache[i].width / 2), y);
      });
      ctx.globalAlpha = 1;
    }
    onPush() { R.bgm('title'); }
  }
  /** the thin gold rule under the logo (200 wide), with small diamonds */
  function drawRule(cx, y) {
    const g = G();
    g.rect(cx - 100, y, 200, 1, '#c8a040');
    g.rect(cx - 80, y + 1, 160, 1, '#5a4420');
    for (const x of [cx - 100, cx, cx + 99]) {
      g.rect(x - 1, y - 1, 3, 3, '#c8a040'); g.rect(x, y - 2, 1, 5, '#c8a040'); g.rect(x, y, 1, 1, '#fff0b0');
    }
  }

  // ------------------------------------------------------------ the command window (76,108,104,64)
  class MenuLayer extends R.Layer {
    constructor(owner, any, initial) {
      super();
      this.owner = owner;
      const items = [
        { label: 'はじめから' },
        { label: 'つづきから', disabled: !any },
        { label: '冒険の合言葉' },
        { label: '設定' },
      ];
      this.list = new R.UI.List({ x: MENU.x, y: MENU.y, w: MENU.w, h: MENU.h, items, rows: 4, padY: 5, padX: 18, index: initial || 0 });
    }
    update() {
      const r = this.list.update();
      if (r === 'select') this.close(this.list.index);
      else if (r === 'cancel') this.close(-1);
    }
    draw() { this.list.draw(); }
  }

  // ------------------------------------------------------------ つづきから: どの記録から始めますか？
  class SlotPicker extends R.Layer {
    constructor(slots) {
      super();
      this.slots = slots;
      const n = slots.length;
      this.index = slots[R.Save.lastSlot || 0] ? (R.Save.lastSlot || 0) : Math.max(0, slots.findIndex(Boolean));
      this.n = n;
    }
    update() {
      const d = In().dirRepeat();
      if (d === 'up' || d === 'down') { this.index = (this.index + (d === 'up' ? this.n - 1 : 1)) % this.n; R.sfx('cursor'); }
      if (In().pressed('a')) {
        if (!this.slots[this.index]) { R.sfx('buzzer'); return; }
        R.sfx('confirm');
        this.close(this.index);
      } else if (In().pressed('b')) { R.sfx('cancel'); this.close(-1); }
    }
    draw() {
      const g = G();
      // an opaque night backdrop: half-covered logo letters must not peek out between the slot windows
      g.rect(0, 0, R.W, R.H, '#070818');
      g.window(40, 6, 176, 24);
      g.text('どの記録から始めますか？', 128, 12, { align: 'center' });
      for (let i = 0; i < this.n; i++) {
        const y = 34 + i * 60;
        if (R.Menu && R.Menu.drawSlot) R.Menu.drawSlot(i, this.slots[i], 4, y, 248, 56, { dim: !this.slots[i] });
        else drawSlot(i, this.slots[i], 4, y, 248, 56);
        if (i === this.index) g.cursor(4 + ((R.Menu && R.Menu.SLOT_CURSOR_DX) || 10), y + 7); // inside the window, like the save screen (§11.7.14)
      }
    }
  }
  /** fallback slot drawing (the menu owner's R.Menu.drawSlot is used when present) */
  function drawSlot(i, s, x, y, w, h) {
    const g = G(), C = g.C;
    g.window(x, y, w, h);
    g.text('記録' + (i + 1), x + 20, y + 6, { color: s ? C.yellow : C.gray });
    if (!s) { g.text('――　空き　――', x + w / 2, y + 24, { align: 'center', color: C.gray }); return; }
    const m = s.summary || {};
    const hero = typeof m.hero === 'object' ? m.hero : { name: m.hero, level: m.level };
    g.text((hero.name || '') + (hero.level != null ? '　Lv' + hero.level : ''), x + 60, y + 6);
    g.text(m.time || '', x + w - 10, y + 6, { align: 'right' });
    g.fitText(m.place || '', x + 16, y + 22, w - 26, { color: C.cyan });
    const ch = m.clear ? 'クリア' : m.tier ? '年代記　第' + m.tier + '章' : '年代記　序章';
    g.text(ch, x + 16, y + 36, { color: '#c8c8d8' });
    if (m.gold != null) g.text(m.gold + 'ゴールド', x + w - 10, y + 36, { align: 'right' });
  }

  /** show the title screen (clears everything else) */
  Title.start = function () {
    R.Engine.clear();
    if (R.Events && R.Events.reset) R.Events.reset();
    if (R.UI && R.UI.closeMessage) R.UI.closeMessage();
    R.Engine.fade(0, 0);
    R.Input.enabled = true;
    const L = new TitleLayer();
    R.Engine.push(L);
    return L;
  };
  Title._Layer = TitleLayer;
})(window.RPG);
