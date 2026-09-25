// Fixed story characters as NPC sprites (DESIGN §10.3 · §11.3.3):
//   npc:berna      the old storyteller who raised the hero
//   npc:rowell     the rival, a young Record Hall recorder (white coat, black notebook)
//   npc:fine       the girl in the grey hood (silver hair under it, pale skin)
//   npc:fine_fade  the same, her feet fading away (checker dither on the lowest 6 rows, 2 frames)
//   npc:lazaro     the Grand Scribe (white robe with silver embroidery, silver brush)
//   npc:scribe     a nameless white-robed scribe of the Record Hall (hood, round glasses, book crest)
//   npc:bartender  the tavern keeper (apron, moustache, rolled sleeves, bow tie)
// Figure specs reuse the party parts; the props below are drawn over the figure.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});
  const P = (CA.parts = CA.parts || {});
  const N = (CA.npcs = CA.npcs || {});
  const L = (y, g, x) => ({ y, g, x: x || 0 });
  P.over = P.over || {};

  // ------------------------------------------------------------ props
  // berna — a thin braid hanging at the left side of her white bun (viewer's right)
  P.over.braidSide = {
    down: L(8, ['.............23.', '.............32.', '.............23.', '.............32.', '.............H..']),
    up: L(8, ['.23.............', '.32.............', '.23.............', '.32.............', '..H.............']),
  };
  // rowell — the black hair tied into a short tail at the nape
  P.over.napeTail = {
    up: L(9, ['......2332......', '.......33.......', '.......32.......', '.......21.......']),
    right: L(9, ['..233...........', '..23............', '..12............']),
  };
  // rowell — the Record Hall coat's stand-up collar (main colours) round the neck
  P.over.collar = {
    down: L(10, ['...CB......BA...', '...CBB....BBA...']),
    up: L(10, ['...CBBBBBBBBA...', '...CBBBBBBBBA...']),
    right: L(10, ['...CBB..........', '...CBB..........']),
    attach: 'body',
  };
  // rowell — the black notebook in his right hand (sub colours, cream page edge)
  P.over.notebook = {
    down: L(15, ['.DEj............', '.DEj............', '.DEj............', '..D.............']),
    up: L(15, ['............jED.', '............jED.', '............jED.', '.............D..']),
    right: L(15, ['.......DEEj.....', '.......DEEj.....', '........DD......']),
    attach: 'body',
  };
  // lazaro — a silver writing brush held upright in his right hand
  P.over.brush = {
    down: L(10, ['.Z..............', '.Y..............', '.Y..............', '.X..............', '.Y..............', 'XZY.............', '.X..............', '.w..............']),
    up: L(10, ['..............Z.', '..............Y.', '..............Y.', '..............X.', '..............Y.', '.............XZY', '..............X.']),
    right: L(9, ['........Z.......', '........Y.......', '........Y.......', '........X.......', '........Y.......', '.......XZY......', '........X.......', '........w.......']),
    attach: 'body',
  };
  // scribe — the Record Hall crest (an open book) stitched on the chest in trim colours
  P.over.bookCrest = {
    down: L(13, ['......GHIG......', '......HIHI......', '.......GG.......']),
    right: L(13, ['.........GHI....', '.........HIH....']),
    attach: 'body',
  };
  // bartender — a small bow tie in trim colours
  P.over.bowtie = {
    down: L(12, ['......HGGH......']),
    right: L(12, ['..........HG....']),
    attach: 'body',
  };
  // bangs that show under a deep hood (fine, scribe, teller): fringe + two front locks
  P.hairHooded = {
    down: L(6, ['....2343343.....', '....3.2..2.3....', '...32......23...', '...2........2...', '...2........2...', '...1........1...']),
    right: L(6, ['........3433....', '..........32....', '...........2....']),
  };

  // ------------------------------------------------------------ NPC table
  const use = (p, o) => CA.use(p, o);
  const part = (n) => CA.part(n);
  const head = (face) => [P.head, part('face.' + face)];
  const SKIN = () => CA.SKIN, HAIR = () => CA.HAIR;
  // the NPC builder in chars.js reads n.pal; palettes that need CA.HAIR / CA.SKIN (defined in
  // chars.js, which loads after this file) are resolved when the sprite is first built
  const lazy = (type, spec, palFn) => { Object.defineProperty(N, type, { enumerable: true, configurable: true, get() { return { spec, pal: palFn() }; } }); };

  // berna: white bun with a thin side braid, an old mantle, a walking stick
  lazy('berna', () => ({
    capeBack: use(P.cape.mantle.back, {}), cape: P.cape.mantle, body: P.body.robe,
    head: head('old'), hair: P.hairBun, over: [P.over.braidSide, P.over.cane],
  }), () => ({ main: '#c8b890', sub: '#6a5a44', trim: '#8a3c2c', hair: HAIR().white, skin: SKIN().A, leather: '#6a4a30' }));

  // rowell: the Record Hall's white coat with the collar up, black hair tied back, black notebook
  lazy('rowell', () => ({
    body: P.body.coat, head: head('sharp'), hair: P.hairShort, over: [P.over.collar, P.over.napeTail, P.over.notebook],
  }), () => ({ main: '#f0f0ec', sub: '#303038', trim: '#d0b040', hair: HAIR().black, skin: SKIN().A, acc2: '#3c3c48', leather: '#3c3440' }));

  // fine: grey robe and deep grey hood, silver-white hair under it, pale skin
  const fineSpec = () => ({
    body: P.body.robe, head: head('gentle'), hair: P.hairHooded, hat: P.hat.hood,
  });
  const finePal = () => ({ main: '#8a8a94', sub: '#c8c8d0', trim: '#e8e0c0', hair: ['#c0c4d0', '#d8dce4', '#eceef4', '#ffffff'], skin: SKIN().pale, eye: '#3a3c58', leather: '#5a5a64' });
  lazy('fine', fineSpec, finePal);

  // fine_fade: npc:fine standing, the lowest 6 rows thinned by a checker dither whose phase
  // alternates between the 2 frames (she does not walk; she drifts)
  N.fine_fade = {
    build() {
      const n = N.fine, spec = n.spec();
      const pal = CA.palette(Object.assign({ acc2: '#44405c', acc: '#d83c5c' }, n.pal));
      const out = { down: [], up: [], left: [], right: [] };
      for (const d of ['down', 'up', 'right']) {
        const src = CA.figure(spec, pal, d, 0);
        for (const ph of [0, 1]) {
          const buf = src.map((c, i) => {
            const x = i % 16, y = Math.floor(i / 16);
            if (!c || y < 18) return c;
            if ((x + y + ph) % 2 === 0) return null;
            return y >= 21 ? c + 'a0' : c;
          });
          out[d].push(CA.toCanvas(buf));
        }
      }
      out.left = out.right.map((c) => R.Gfx.flipH(c));
      return out;
    },
  };

  // lazaro: white long robe with silver embroidery, grey hair and beard, a silver brush
  lazy('lazaro', () => ({
    body: P.body.robe, head: head('old'), hair: P.hairShort, beard: P.beard, over: [P.over.brush],
  }), () => ({ main: '#f4f4f0', sub: '#c0c4cc', trim: '#c0c8d8', hair: HAIR().grey, skin: SKIN().A, steel: '#b8c0d0' }));

  // scribe: white robe and hood, round glasses, the open-book crest on the chest
  lazy('scribe', () => ({
    body: P.body.robe, head: head('boy'), hair: P.hairHooded, hat: P.hat.hood, over: [P.over.glasses, P.over.bookCrest],
  }), () => ({ main: '#f0f0ec', sub: '#b8bcc8', trim: '#d0b040', hair: HAIR().brown, skin: SKIN().A, steel: '#9ca0b0' }));

  // bartender: dark red shirt, white apron, rolled sleeves, moustache and bow tie
  lazy('bartender', () => ({
    body: P.body.shop, head: head('boy'), hair: P.hairShort, beard: P.mustache, over: [P.over.bowtie],
  }), () => ({ main: '#6a2a30', sub: '#f4f0e4', trim: '#c8a868', hair: HAIR().black, skin: SKIN().A, acc2: '#2c2830' }));
})(window.RPG);
