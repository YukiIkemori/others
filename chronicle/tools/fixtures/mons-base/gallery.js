// Fixture for area A14b mons-base: an in-engine gallery of the 14 new base sprites
// (DESIGN §9.4.2) drawn through the real build (bundled load order, R.Gfx at R.SCALE×,
// the engine's layer stack), laid out like the battle scene of §11.4.2 / §11.11.3.
//
//   node tools/build.js --with tools/fixtures/mons-base      → debug_mons-base.html
//   node tools/shot.js --html debug_mons-base.html --eval "RPG.MonsBase.show(0)" --wait 400 --out x.png
//
// RPG.MonsBase.show(page) replaces every layer with the gallery; left/right flip pages.
// Page list: RPG.MonsBase.pages (each: backdrop id, label, sprites [id | [id, hsb]]).
// Flying bases bob ±2 px like in battle (§11.4.2); golden ones use tint #ffd24a (§9.8).
(function (R) {
  'use strict';
  const GOLD = { tint: '#ffd24a' };
  const PAGES = [
    { bg: 'forest', label: 'fairy / treant / spider', mons: ['fairy', 'treant', ['spider', { hue: 250, sat: 1.1 }], ['fairy', { hue: 300 }]] },
    { bg: 'swamp', label: 'frog / doll', mons: ['frog', 'doll', ['frog', { hue: 180, sat: 1.3 }], ['doll', { sat: 0.4, bri: 0.7 }]] },
    { bg: 'snow', label: 'owl / mammoth', mons: ['owl', 'mammoth', ['owl', { hue: 270, sat: 1.1 }]] },
    { bg: 'sea', label: 'seabird', mons: ['seabird', ['seabird', { sat: 0.3, bri: 0.75 }], ['seabird', { hue: 30, sat: 0.7 }], ['seabird', GOLD]] },
    { bg: 'cave', label: 'beetle / mole / crystal', mons: ['beetle', 'mole', 'crystal', ['beetle', { hue: -40, sat: 1.2 }], ['mole', GOLD]] },
    { bg: 'tower', label: 'automaton / crystal', mons: ['automaton', ['crystal', { hue: 250, sat: 1.3, bri: 0.85 }], ['automaton', { hue: 160, sat: 0.8 }]] },
    { bg: 'shrine', label: 'scribe / book', mons: ['book', 'scribe', ['book', { hue: 250, sat: 1.2, bri: 0.8 }], ['scribe', GOLD]] },
  ];
  const FLY = { fairy: 1, seabird: 1, owl: 1 };
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 }, GROUND = 130;

  class Gallery extends R.Layer {
    constructor(i) { super(); this.opaque = true; this.coversScreen = true; this.i = i || 0; this.t = 0; }
    update() {
      const I = R.Input;
      if (I.pressed('right')) this.i = (this.i + 1) % PAGES.length;
      if (I.pressed('left')) this.i = (this.i + PAGES.length - 1) % PAGES.length;
    }
    tick() { this.t++; }
    draw() {
      const G = R.Gfx, c = G.ctx, pg = PAGES[this.i];
      G.clear('#000');
      let b = G.has('bbg:' + pg.bg) ? G.get('bbg:' + pg.bg) : null;
      if (Array.isArray(b)) b = b[0];
      if (b) c.drawImage(b, 0, 0);
      const imgs = pg.mons.map((m) => (typeof m === 'string' ? G.get('mon:' + m) : G.variant('mon:' + m[0], m[1])));
      const total = imgs.reduce((a, im) => a + im.width, 0);
      const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
      let x = 128 - (total + gap * (imgs.length - 1)) / 2;
      imgs.forEach((im, k) => {
        const id = typeof pg.mons[k] === 'string' ? pg.mons[k] : pg.mons[k][0];
        let y = GROUND - im.height;
        if (FLY[id]) y += Math.round(Math.sin(this.t / 18 + k) * 2);
        c.drawImage(im, Math.round(x), y);
        x += im.width + gap;
      });
      for (const wx of WIN.xs) G.window(wx, WIN.y, WIN.w, WIN.h);
      G.window(8, 150, 240, 68);
      G.text((this.i + 1) + '/' + PAGES.length + '  ' + pg.label, 16, 158, { color: '#f0e8d0' });
      G.text('mon:<id> — DESIGN §9.4.2', 16, 172, { color: '#a0a8c0' });
    }
  }
  R.MonsBase = {
    pages: PAGES,
    show(i) { R.Engine.clear(); R.Engine.push(new Gallery(i)); return PAGES.length; },
  };
})(window.RPG);
