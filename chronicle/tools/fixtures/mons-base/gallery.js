// Fixture for area A14b mons-base: an in-engine gallery of the 14 new base sprites (DESIGN §9.4.2)
// and their lineage stages, drawn through the real build (bundled load order, R.Gfx at R.SCALE×,
// the engine's layer stack, real R.DB names and A14a's compose) with the shared battle-screen mock
// battle_screen.js (§11.5.1 windows, GROUND 130 layout and sinking of §11.4.2).
//
//   node tools/build.js --with tools/fixtures/mons-base      → debug_mons-base.html
//   node tools/shot.js --html debug_mons-base.html --eval "RPG.MonsBase.show(0)" --wait 400 --out x.png
//
// RPG.MonsBase.show(page) replaces every layer with the gallery; left/right flip pages.
// Page list: RPG.MonsBase.pages (each: backdrop id, group entries as in battle_screen.js:
// 'spriteId', 'spriteId*' golden, 'base', ['base', hsb]). Flying monsters (flag `flying`) bob ±2 px
// like in battle; golden ones use tint #ffd24a (§9.8).
(function (R) {
  'use strict';
  const PAGES = [
    { bg: 'forest', mons: ['fairy_1', 'treant_1', 'fairy_2', 'treant_4'] },
    { bg: 'swamp', mons: ['frog_1', 'doll_1', 'spider_1', 'frog_2*'] },
    { bg: 'snow', mons: ['owl_1', 'mammoth_1', 'owl_3'] },
    { bg: 'beach', mons: ['seabird_1', 'seabird_2', 'seabird_3', 'seabird_4*'] },
    { bg: 'mine', mons: ['beetle_1', 'mole_2', 'crystal_1', 'mirror_1'] },
    { bg: 'tower', mons: ['automaton_1', 'automaton_3', 'automaton_4'] },
    { bg: 'library', mons: ['book_1', 'scribe_1', 'book_2', 'scribe_3'] },
    { bg: 'manor', mons: ['b_doll_violin', 'b_doll_conductor', 'b_doll_drum', 'b_doll_flute'] },
    { bg: 'cave', mons: ['beetle', 'fairy', 'book', 'crystal', 'frog'] },
    { bg: 'cave', mons: ['doll', 'seabird', 'mole', 'automaton'] },
    { bg: 'cave', mons: ['scribe', 'owl', 'spider'] },
    { bg: 'cave', mons: ['treant', 'mammoth'] },
  ];

  class Gallery extends R.Layer {
    constructor(i) { super(); this.opaque = true; this.coversScreen = true; this.i = i || 0; this.t = 0; this.cache = {}; }
    update() {
      const I = R.Input;
      if (I.pressed('right')) this.i = (this.i + 1) % PAGES.length;
      if (I.pressed('left')) this.i = (this.i + PAGES.length - 1) % PAGES.length;
    }
    tick() { this.t++; }
    mons(i) {
      if (!this.cache[i]) this.cache[i] = PAGES[i].mons.map((e) => R.MonsBaseScreen.entry(e));
      return this.cache[i];
    }
    draw() {
      const G = R.Gfx, pg = PAGES[this.i];
      R.MonsBaseScreen.draw(G.ctx, R.SCALE, 0, { bg: pg.bg, mons: this.mons(this.i), frame: this.t });
      G.reset();
      // page tag above the command list
      const tag = (this.i + 1) + '/' + PAGES.length;
      const w = Math.ceil(G.textWidth(tag)) + 16;
      G.window(8, 130, w, 18);
      G.text(tag, 16, 133, { color: G.C.white });
    }
  }
  R.MonsBase = {
    pages: PAGES,
    show(i) { R.Engine.clear(); R.Engine.push(new Gallery(i)); return PAGES.length; },
  };
})(window.RPG);
