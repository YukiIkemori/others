// Title screen: starry night sky over a castle silhouette, the crest emblem and
// the 「ルミナス・クレスト」 logo, then はじめから / つづきから / ふっかつのじゅもん / せってい.
//   R.Title.start()
(function (R) {
  'use strict';
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Title = (R.Title = R.Title || {});

  const SUB = '〜 ひかりの もんしょうと さんにんの ゆうしゃ 〜';
  let bgCache = null, crestCache = null, logoCache = null, glowCache = null;

  /** soft radial glow behind the crest */
  function buildGlow() {
    const cv = G().makeCanvas(120, 90), c = cv.getContext('2d');
    const g = c.createRadialGradient(60, 45, 4, 60, 45, 45);
    g.addColorStop(0, 'rgba(150,160,255,0.75)');
    g.addColorStop(0.45, 'rgba(100,110,255,0.3)');
    g.addColorStop(1, 'rgba(80,80,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 120, 90);
    return cv;
  }

  // ------------------------------------------------------------ art (cached)
  /** sky gradient, moon, mountains, castle silhouette with lit windows */
  function buildBackground() {
    const W = R.W, H = R.H;
    const cv = G().makeCanvas(W, H), c = cv.getContext('2d');
    // sky: deep indigo → violet near the horizon, banded like SFC gradients
    const bands = ['#05061a', '#070a24', '#0a0e2e', '#0e1238', '#131742', '#1a1c4c', '#221f55', '#2c235c', '#382761', '#452b63'];
    const bh = 150 / bands.length;
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, Math.floor(i * bh), W, Math.ceil(bh) + 1); });
    // faint milky way: soft scatter of dim dots along a diagonal band
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 700; i++) {
      const t = rnd() * 1.3 - 0.15;
      const off = (rnd() + rnd() + rnd() - 1.5) * 22;
      const x = Math.round(t * W), y = Math.round(10 + t * 110 + off);
      if (y < 0 || y > 140) continue;
      const a = 0.18 + rnd() * 0.3;
      c.fillStyle = rnd() < 0.3 ? 'rgba(170,150,255,' + a + ')' : 'rgba(120,140,255,' + a * 0.8 + ')';
      c.fillRect(x, y, 1, 1);
    }
    // moon
    const m = G().pix(24, 24);
    m.circle(12, 12, 10, '#f4ecc8');
    m.circle(9, 9, 2, '#e0d6a8'); m.circle(15, 14, 3, '#e0d6a8'); m.circle(10, 16, 1, '#e0d6a8');
    m.circle(17, 7, 9, null);
    c.drawImage(m.toCanvas(), 206, 18);
    // far mountains
    const mt = G().pix(W, 80);
    const ridge = (base, amp, seed, col) => {
      for (let x = 0; x < W; x++) {
        const h = base - Math.abs(Math.sin(x * 0.021 + seed) * amp) - Math.abs(Math.sin(x * 0.057 + seed * 2)) * amp * 0.45;
        mt.vline(x, Math.round(h), 79, col);
      }
    };
    ridge(52, 26, 1.3, '#1d1a40');
    ridge(64, 16, 4.1, '#15132f');
    c.drawImage(mt.toCanvas(), 0, 104);
    // castle silhouette on a hill (pixel buffer placed at y=100)
    const OY = 20;
    const k = G().pix(W, 124);
    const S = '#090816', L = '#ffcf5a', L2 = '#ff9a3a';
    k.ellipse(128, 104 + OY, 150, 30, S);
    const tower = (x, w, top, roof) => {
      k.rect(x, top + OY, w, 124 - top - OY, S);
      for (let i = 0; i < w; i += 3) k.rect(x + i, top + OY - 2, 2, 2, S); // battlements
      if (roof) k.poly([[x - 2, top + OY], [x + w / 2, top + OY - roof], [x + w + 2, top + OY]], S);
    };
    tower(92, 72, 58, 0);
    tower(80, 14, 44, 18);
    tower(162, 14, 44, 18);
    tower(106, 12, 36, 16);
    tower(138, 12, 36, 16);
    tower(119, 18, 22, 22);
    // banner on the central spire
    k.vline(128, OY - 8, OY + 2, S);
    k.rect(129, OY - 8, 6, 3, S); k.rect(135, OY - 7, 2, 2, S);
    // walls
    k.rect(40, 78 + OY, 176, 32, S);
    for (let i = 40; i < 216; i += 4) k.rect(i, 76 + OY, 2, 2, S);
    // lit windows
    const win = [[85, 54], [85, 64], [167, 54], [167, 64], [110, 46], [142, 46], [126, 32], [130, 32], [100, 70], [156, 70], [120, 62], [136, 62], [60, 88], [196, 88], [128, 48]];
    win.forEach(([x, y], i) => { k.rect(x, y + OY, 2, 3, i % 3 ? L : L2); });
    // gate
    k.rect(123, 92 + OY, 10, 18, '#1a1020');
    c.drawImage(k.toCanvas(), 0, 100);
    // ground / foreground
    c.fillStyle = '#07060f';
    c.fillRect(0, 214, W, 10);
    return cv;
  }

  /** the crest: a gold-rimmed shield with a radiant star and the five crest gems, with wings */
  function buildCrest() {
    const P = G().pix(88, 64);
    const gold = G().ramp('#e8b830', 5, 0.5);
    const blue = G().ramp('#2848b0', 5, 0.55);
    // wings
    for (const side of [-1, 1]) {
      for (let f = 0; f < 5; f++) {
        const x0 = 44 + side * 18, y0 = 18 + f * 6;
        const x1 = 44 + side * (40 - f * 3), y1 = 8 + f * 9;
        P.line(x0, y0, x1, y1, f % 2 ? '#d8d8f0' : '#ffffff', 3);
        P.line(x0, y0 + 2, x1, y1 + 3, '#9aa0c8', 1);
      }
    }
    // shield body
    const shield = [[26, 8], [62, 8], [62, 32], [58, 44], [44, 58], [30, 44], [26, 32]];
    P.poly(shield.map(([x, y]) => [x - 2, y - 2]).map(([x, y], i) => [x + (i === 0 || i === 6 || i === 5 ? 0 : 4), y]), gold[1]);
    P.poly([[24, 6], [64, 6], [64, 32], [60, 45], [44, 60], [28, 45], [24, 32]], gold[3]);
    P.poly([[27, 9], [61, 9], [61, 32], [57, 43], [44, 56], [31, 43], [27, 32]], blue[1]);
    P.poly([[29, 11], [59, 11], [59, 31], [55, 41], [44, 52], [33, 41], [29, 31]], blue[2]);
    // inner shading: lighter upper-left
    P.poly([[29, 11], [44, 11], [44, 30], [33, 30], [29, 26]], blue[3]);
    // radiant star
    const cx = 44, cy = 29;
    const star = (r1, r2, n, col, rot) => {
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i * Math.PI) / n;
        const r = i % 2 ? r2 : r1;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      P.poly(pts, col);
    };
    star(15, 4, 4, '#fff6c0', -Math.PI / 2);
    star(10, 3, 4, '#ffe890', -Math.PI / 4);
    star(7, 3, 4, '#ffffff', -Math.PI / 2);
    P.circle(cx, cy, 2, '#ffffff');
    // five crest gems along the rim (wind, water, earth, fire, star)
    const gems = [['#5ae07a', 30, 14], ['#4aa8ff', 58, 14], ['#d8a050', 34, 44], ['#ff5a4a', 54, 44], ['#d890ff', 44, 54]];
    for (const [col, x, y] of gems) {
      P.rect(x - 1, y - 2, 3, 5, col); P.rect(x - 2, y - 1, 5, 3, col);
      P.set(x - 1, y - 1, '#ffffff');
    }
    // top ornament
    P.rect(40, 1, 9, 4, gold[3]); P.rect(43, 0, 3, 1, gold[4]); P.set(44, 2, '#ff5a4a');
    P.outline('#120c20');
    return P.toCanvas();
  }

  /** logo text at full device resolution: outlined, gradient-filled */
  function buildLogo() {
    const S = R.SCALE;
    const size = 64; // device px → 4 device px per font pixel
    const text = R.TITLE || 'ルミナス・クレスト';
    const tmp = G().makeCanvas(8, 8).getContext('2d');
    tmp.font = size + 'px ' + G().FONT;
    const tw = Math.ceil(tmp.measureText(text).width);
    const pad = 12;
    const cv = G().makeCanvas(tw + pad * 2, size + pad * 2);
    const c = cv.getContext('2d');
    c.font = size + 'px ' + G().FONT;
    c.textBaseline = 'top';
    c.lineJoin = 'round';
    const x = pad, y = pad;
    // drop shadow
    c.fillStyle = '#05030c';
    c.fillText(text, x + 6, y + 6);
    // outline
    c.strokeStyle = '#1a0e38';
    c.lineWidth = 12;
    c.strokeText(text, x, y);
    c.strokeStyle = '#8a5a18';
    c.lineWidth = 5;
    c.strokeText(text, x, y);
    // banded gold gradient (SFC-style hard steps)
    const g = c.createLinearGradient(0, y, 0, y + size);
    const stops = ['#fff8d8', '#fff0a0', '#ffe070', '#ffc840', '#f0a828', '#ffd860', '#fff0b0'];
    stops.forEach((col, i) => { g.addColorStop(i / (stops.length - 1), col); });
    c.fillStyle = g;
    c.fillText(text, x, y);
    // highlight line through the upper third
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, y + size * 0.18, cv.width, 4);
    c.globalCompositeOperation = 'source-over';
    return { cv, w: cv.width / S, h: cv.height / S };
  }
  const fontReady = () => {
    try { return !document.fonts || document.fonts.check('32px "DotGothic16"'); } catch (e) { return true; }
  };

  // ------------------------------------------------------------ stars
  function makeStars() {
    const out = [];
    for (let i = 0; i < 90; i++) {
      const y = Math.floor(Math.pow(U.r(), 1.4) * 140);
      out.push({ x: U.ri(0, R.W - 1), y, b: U.r(), s: U.r() < 0.12 ? 2 : 1, ph: U.ri(0, 200), sp: U.ri(40, 120) });
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
      this.shoot = null;
      this.index = 0;
      this.slots = null;
    }
    tick() {
      this.t++;
      if (!this.shoot && this.t > 120 && U.oneIn(260)) this.shoot = { x: U.ri(40, 220), y: U.ri(8, 50), t: 0 };
      if (this.shoot && ++this.shoot.t > 28) this.shoot = null;
    }
    update() { if (!this.busy && !this.closed) this.input(); }
    flow(fn) {
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    draw() { this.render(); }
    input() {
      if (this.stage === 'press') {
        if (this.t > 20 && (In().pressed('a') || In().pressed('b'))) {
          if (this.t < 70) { this.t = 70; return; } // skip the fade-in first
          R.sfx('confirm');
          R.bgm('title'); // the first press also unlocks audio
          this.stage = 'menu';
          this.flow(() => this.menu());
        }
      }
    }
    async menu() {
      this.slots = await R.Save.list();
      const any = this.slots.some(Boolean);
      for (;;) {
        this.stage = 'menu';
        const items = [
          { label: 'はじめから' },
          { label: 'つづきから', disabled: !any },
          { label: 'ふっかつのじゅもん' },
          { label: 'せってい' },
        ];
        const i = await R.UI.choose(items, { x: 76, y: 132, w: 104, initial: any ? 1 : 0, cancel: true });
        if (i < 0) { this.stage = 'press'; return; }
        if (i === 0) { await this.newGame(); return; }
        if (i === 1 && (await this.continueGame())) return;
        if (i === 2 && (await this.codeGame())) return;
        if (i === 3) { await Menu().settings(); }
      }
    }
    async newGame() {
      R.sfx('confirm');
      this.stage = 'leave';
      R.Audio && R.Audio.stopBGM && R.Audio.stopBGM(40);
      await R.Engine.fadeOut(40);
      this.close();
      R.State.newGame();
      const st = R.State.START;
      if (R.Field && R.Field.start) await R.Field.start(st.map, st.spawn);
    }
    async continueGame() {
      const ok = await R.Engine.run(new SlotPicker(this.slots));
      if (ok == null || ok < 0) return false;
      const data = await R.Save.load(ok);
      return this.boot(data);
    }
    async codeGame() {
      const code = await Menu().codeOverlay({ mode: 'import' });
      if (!code) return false;
      const data = await R.Save.importCode(code);
      if (!data || !data.game) { R.sfx('buzzer'); await Menu().kit.msg('じゅもんが ちがいます。'); return false; }
      return this.boot(data);
    }
    async boot(data) {
      if (!data || !R.State.deserialize(data)) { R.sfx('buzzer'); await Menu().kit.msg('きろくを よみこめなかった……。'); return false; }
      R.sfx('confirm');
      this.stage = 'leave';
      R.Audio && R.Audio.stopBGM && R.Audio.stopBGM(40);
      await R.Engine.fadeOut(40);
      this.close();
      if (R.Field && R.Field.resume) await R.Field.resume();
      return true;
    }
    render() {
      if (!bgCache) bgCache = buildBackground();
      if (!crestCache) crestCache = buildCrest();
      if (!logoCache || (!logoCache.ready && fontReady())) { logoCache = buildLogo(); logoCache.ready = fontReady(); }
      const f = R.Engine.frame;
      G().draw(bgCache, 0, 0);
      // stars
      for (const s of this.stars) {
        const tw = Math.sin((f + s.ph) * (Math.PI * 2) / s.sp);
        const a = 0.35 + 0.65 * (0.5 + 0.5 * tw) * (0.4 + 0.6 * s.b);
        const col = s.b > 0.8 ? '#fff4c8' : s.b > 0.5 ? '#ffffff' : '#b8c8ff';
        G().ctx.globalAlpha = a;
        G().rect(s.x, s.y, s.s, s.s, col);
        if (s.s === 2 && tw > 0.8) { G().rect(s.x - 1, s.y + 0.5, 4, 1, col); G().rect(s.x + 0.5, s.y - 1, 1, 4, col); }
      }
      G().ctx.globalAlpha = 1;
      if (this.shoot) {
        const sh = this.shoot, k = sh.t / 28;
        for (let i = 0; i < 10; i++) {
          G().ctx.globalAlpha = (1 - i / 10) * (1 - k);
          G().rect(sh.x + sh.t * 3 - i * 2, sh.y + sh.t * 1.2 - i * 0.8, 1, 1, '#ffffff');
        }
        G().ctx.globalAlpha = 1;
      }
      // emblem + logo fade in
      const fadeIn = U.clamp((this.t - 10) / 60, 0, 1);
      const bob = Math.round(Math.sin(f / 40) * 1.5);
      G().ctx.globalAlpha = fadeIn;
      // glow behind the crest
      if (!glowCache) glowCache = buildGlow();
      G().ctx.globalAlpha = fadeIn * (0.55 + 0.25 * Math.sin(f / 25));
      G().draw(glowCache, 128 - 60, 0 + bob);
      G().ctx.globalAlpha = fadeIn;
      G().draw(crestCache, 128 - crestCache.width / 2, 12 + bob);
      G().draw(logoCache.cv, 128 - logoCache.w / 2, 72, { w: logoCache.w, h: logoCache.h });
      G().text(SUB, 128, 102, { align: 'center', size: 8, color: '#d8dcff', shadow: '#10082a' });
      G().ctx.globalAlpha = 1;
      if (this.stage === 'press' && this.t > 70 && Math.floor(f / 30) % 2 === 0) {
        G().text('Aボタンを おしてください', 128, 164, { align: 'center', color: '#ffffff', shadow: '#000' });
      }
      G().text('ver ' + R.VERSION, 252, 214, { align: 'right', size: 16 / 3 * 1.5, color: '#8088b0' });
    }
    onPush() { R.bgm('title'); }
  }

  // ------------------------------------------------------------ continue: slot picker
  class SlotPicker extends R.Layer {
    constructor(slots) {
      super();
      this.slots = slots;
      this.index = Math.max(0, slots.findIndex((s, i) => s && i === (R.Save.lastSlot || 0)));
      if (!slots[this.index]) this.index = Math.max(0, slots.findIndex(Boolean));
    }
    update() {
      const d = In().dirRepeat();
      if (d === 'up' || d === 'down') { this.index = (this.index + (d === 'up' ? 2 : 1)) % 3; R.sfx('cursor'); }
      if (In().pressed('a')) {
        if (!this.slots[this.index]) { R.sfx('buzzer'); return; }
        R.sfx('confirm');
        this.close(this.index);
      } else if (In().pressed('b')) { R.sfx('cancel'); this.close(-1); }
    }
    draw() {
      G().ctx.globalAlpha = 0.55;
      G().rect(0, 0, R.W, R.H, '#000010');
      G().ctx.globalAlpha = 1;
      G().window(62, 8, 132, 24);
      G().text('どの きろくから？', 128, 14, { align: 'center' });
      for (let i = 0; i < 3; i++) {
        const y = 36 + i * 60;
        Menu().drawSlot(i, this.slots[i], 4, y, 248, 56, { dim: !this.slots[i] });
        if (i === this.index) G().cursor(10, y + 8);
      }
    }
  }

  function Menu() { return R.Menu; }

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
})(window.RPG);
