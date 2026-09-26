// Fixture for area A14a mons-parts: an in-engine gallery of the 211 composed regular monsters
// (DESIGN §9.4.6), one lineage per page on a backdrop of its region, laid out like the battle scene
// (feet on GROUND = 130, total width ≤ 244, gap ≤ 8, §11.4.2), drawn through the bundled build
// (real load order, R.Gfx at R.SCALE×), with the name of each stage under it.
//
//   node tools/build.js --with tools/fixtures/mons-parts      → debug_mons-parts.html
//   node tools/shot.js --html debug_mons-parts.html --eval "RPG.MonsParts.show(0)" --wait 300 --out x.png
//
// RPG.MonsParts.show(page | lineageId) → number of pages; left / right flip pages in the page itself.
// Page 0 is the gold page: one stage of eight lineages tinted #ffd24a (§9.8, the battle's golden look).
(function (R) {
  'use strict';
  const GROUND = 130;
  const BG = {
    jelly: 'grass', rat: 'grass', bat: 'cave', paper: 'shrine', crab: 'beach', seabird: 'beach', bee: 'forest', mushroom: 'forest',
    plant: 'forest', fairy: 'forest', treant: 'tree', scorpion: 'desert', snake: 'desert', mummy: 'pyramid', cactus: 'desert',
    sandworm: 'desert', wolf: 'snow', yeti: 'snow', frostling: 'snow', owl: 'snow', mammoth: 'snow', ghost: 'swamp', wisp: 'swamp',
    frog: 'swamp', doll: 'manor', lizardman: 'swamp', spider: 'manor', merman: 'watercave', kraken: 'sea', skeleton: 'ship',
    golem: 'mine', mole: 'mine', beetle: 'mine', crystal: 'mine', goblin: 'cave', salamander: 'volcano', imp: 'volcano',
    gargoyle: 'tower', orc: 'wasteland', chimera: 'wasteland', eyeball: 'tower', darkmage: 'tower', automaton: 'tower', armor: 'castle',
    wyvern: 'hills', scribe: 'library', book: 'library', mimic: 'cave', void: 'oblivion', chaos: 'oblivion', demon: 'throne',
    quicksilver: 'grass', mirror: 'mine', platinum: 'shrine',
  };
  const GOLD = ['jelly_2', 'rat_1', 'bat_1', 'wolf_2', 'goblin_1', 'mummy_1', 'crab_1', 'imp_2'];
  function pages() {
    const ids = Object.keys((R.Art && R.Art.MON_COMPOSE_MOBS) || {});
    const by = {};
    for (const id of ids) { const k = id.replace(/_\d+$/, ''); (by[k] = by[k] || []).push(id); }
    return [{ lineage: 'gold', bg: 'grass', ids: GOLD, gold: true }].concat(Object.keys(by).map((k) => ({ lineage: k, bg: BG[k] || 'grass', ids: by[k] })));
  }
  const imgOf = (id, gold) => {
    let v = gold ? R.Gfx.variant('mon:' + id, { tint: '#ffd24a' }) : R.Gfx.get('mon:' + id);
    return Array.isArray(v) ? v[0] : v;
  };
  class Gallery extends R.Layer {
    constructor(i) { super(); this.opaque = true; this.coversScreen = true; this.P = pages(); this.i = i || 0; this.t = 0; }
    update() {
      const I = R.Input;
      if (I.pressed('right')) this.i = (this.i + 1) % this.P.length;
      if (I.pressed('left')) this.i = (this.i + this.P.length - 1) % this.P.length;
    }
    tick() { this.t++; }
    draw() {
      const G = R.Gfx, C = G.C, pg = this.P[this.i];
      G.rect(0, 0, 256, 224, '#000');
      let b = G.has('bbg:' + pg.bg) ? G.get('bbg:' + pg.bg) : null;
      if (Array.isArray(b)) b = b[0];
      if (b) G.ctx.drawImage(b, 0, 0, 256, 144); else G.rect(0, 0, 256, 144, '#3a5a3a');
      const imgs = pg.ids.map((id) => imgOf(id, pg.gold));
      const total = imgs.reduce((s, im) => s + im.width, 0);
      const gap = imgs.length > 1 ? Math.min(8, (244 - total) / (imgs.length - 1)) : 0;
      let x = 128 - (total + gap * (imgs.length - 1)) / 2;
      const M = (R.DB && R.DB.monsters) || {};
      imgs.forEach((im, k) => {
        const d = M[pg.ids[k]] || {};
        const fly = (d.flags || []).includes('flying');
        const bob = fly ? Math.round(Math.sin(this.t / 18 + k) * 2) : 0;
        G.ctx.drawImage(im, Math.round(x), GROUND - im.height + bob);
        x += im.width + gap;
      });
      // names of the stages in the lower window, like the enemy list of the battle screen
      G.window(8, 150, 240, 68);
      pg.ids.forEach((id, k) => {
        const d = M[id] || {};
        const name = pg.gold ? d.goldName || (d.name && d.name.length <= 5 ? '金色の' : '金の') + (d.name || id) : d.name || id;
        G.fitText(name, 16 + (k % 2) * 116, 158 + Math.floor(k / 2) * 14, 110, { color: pg.gold ? C.gold : C.white });
      });
      const tag = (this.i + 1) + '/' + this.P.length + ' ' + pg.lineage;
      G.window(8, 128, Math.ceil(G.textWidth(tag)) + 16, 18);
      G.text(tag, 16, 131, { color: C.white });
    }
  }
  R.MonsParts = {
    pages,
    show(i) {
      const P = pages();
      const at = typeof i === 'string' ? Math.max(0, P.findIndex((p) => p.lineage === i)) : i || 0;
      R.Engine.clear(); R.Engine.push(new Gallery(at));
      return P.length;
    },
  };
})(window.RPG);
