// Town folk for the Chronicle towns (DESIGN §11.3.4): npc:bard farmer miner
// noble fisher teller nomad priestess, and the animals npc:sheep / npc:chicken.
// Humans reuse the party parts; the new headgear and props are below. The
// animals have their own 16x24 grids (standing on the bottom rows, like cat/dog).
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});
  const P = (CA.parts = CA.parts || {});
  const N = (CA.npcs = CA.npcs || {});
  const L = (y, g, x) => ({ y, g, x: x || 0 });
  for (const k of ['hat', 'over']) P[k] = P[k] || {};

  // ------------------------------------------------------------ headgear
  // flat straw hat with a wide brim and a sub-coloured band (farmer) — straw in trim colours
  P.hat.straw = {
    hairClip: 5,
    down: L(1, [
      '.....GHHHHG.....',
      '....GHIIHHHG....',
      '....DEEEEEED....',
      '.GGHHIHHHHHHHGG.',
      '..GGGGGGGGGGGG..',
    ]),
    up: L(1, [
      '.....GHHHHG.....',
      '....GHHIHHHG....',
      '....DEEEEEED....',
      '.GGHHHHHHHHHHGG.',
      '..GGGGGGGGGGGG..',
    ]),
    right: L(1, [
      '....GHHHHG......',
      '...GHIIHHHG.....',
      '...DEEEEEED.....',
      'GGHHIHHHHHHHGG..',
      '.GGGGGGGGGGGG...',
    ]),
  };
  // miner's leather cap with a brass lamp at the front (lamp glass w)
  P.hat.lampcap = {
    hairClip: 5,
    down: L(1, [
      '.....LMMMML.....',
      '....LMNNMMML....',
      '...LMMGwwGMML...',
      '..LMMMGHHGMMML..',
      '..LLLLLLLLLLLL..',
    ]),
    up: L(1, [
      '.....LMMMML.....',
      '....LMNNMMML....',
      '...LMNMMMMMML...',
      '..LMMMMMMMMMML..',
      '..LLLLLLLLLLLL..',
    ]),
    right: L(1, [
      '....LMMMML......',
      '...LMNNMMML.....',
      '..LMNMMMMMGwG...',
      '..LMMMMMMMGHG...',
      '.LLLLLLLLLLLLL..',
    ]),
  };

  // plain top hat in dark cloth (acc2) with a trim band (noble)
  P.hat.tophatPlain = {
    hairClip: 6,
    down: L(0, [
      '.....UVWWVVU....',
      '.....UVWVVVU....',
      '.....UVWVVVU....',
      '.....UVVVVVU....',
      '.....GHIHHHG....',
      '...UVVWVVVVVU...',
      '....UUUUUUUUU...',
    ]),
    up: L(0, [
      '....UVVVVWVU....',
      '....UVVVWVU.....',
      '....UVVVWVU.....',
      '....UVVVVVU.....',
      '....GHHHHHG.....',
      '...UVVVVVWVVU...',
      '....UUUUUUUUU...',
    ]),
    right: L(0, [
      '.....UVWWVU.....',
      '.....UVWVVU.....',
      '.....UVWVVU.....',
      '.....UVVVVU.....',
      '.....GHIHHG.....',
      '..UVVVWVVVVVVU..',
      '...UUUUUUUUUU...',
    ]),
  };

  // ------------------------------------------------------------ props
  // bard — a small lyre on the back (accent-coloured frame, white strings)
  P.over.lyre = {
    up: L(11, ['.....Q..Q.......', '.....QwwQ.......', '.....PwwP.......', '.....PwwP.......', '......PP........']),
    right: L(11, ['.Q..Q...........', '.QwwQ...........', '.PwwP...........', '..PP............']),
    attach: 'body',
  };
  // farmer — a hoe over the shoulder (leather shaft, steel blade)
  P.over.hoe = {
    down: L(6, ['..........XYY...', '...........YM...', '............M...', '............M...', '............M...', '............M...', '............M...', '............M...', '............M...', '............M...', '............M...', '............M...', '............L...']),
    up: L(6, ['...YYX..........', '...MY...........', '...M............', '...M............', '...M............', '...M............', '...M............', '...M............', '...M............', '...M............', '...M............', '...M............', '...L............']),
    right: L(6, ['..XYY...........', '...YM...........', '....M...........', '....M...........', '.....M..........', '.....M..........', '......M.........', '......M.........', '.......M........', '.......M........', '........M.......', '........L.......']),
    attach: 'body',
  };
  // miner — soot smudges on the cheeks and nose
  P.over.soot = {
    down: L(9, ['................', '...M.......M....', '....M..M........']),
    right: L(9, ['................', '.........M......', '..........M.M...']),
  };
  // miner — a pickaxe held at the side
  P.over.pick = {
    down: L(12, ['XYYYX...........', '..M.............', '..M.............', '..M.............', '..M.............', '..L.............']),
    up: L(12, ['...........XYYYX', '.............M..', '.............M..', '.............M..', '.............M..', '.............L..']),
    right: L(12, ['.......XYYX.....', '.........M......', '.........M......', '.........M......', '.........L......']),
    attach: 'body',
  };
  // fisher — a bundle of net over the shoulder (sub colours, knots in leather)
  P.over.net = {
    down: L(11, ['..........DEFE..', '..........EDEDE.', '..........DEDE..', '...........MD...']),
    up: L(11, ['..DEFE..........', '.EDEDE..........', '..DEDE..........', '...DM...........']),
    right: L(11, ['..DEFE..........', '.EDEDE..........', '.DEDED..........', '..DM............']),
    attach: 'body',
  };
  // teller — an old leather-bound book held in front (cream pages)
  P.over.book = {
    down: L(15, ['......LMMN......', '......LjjN......', '......LLMN......']),
    right: L(15, ['........LMN.....', '........Ljj.....', '........LLN.....']),
    attach: 'body',
  };
  // nomad — the cloth over the mouth (main colours) and a sash end
  P.over.veilMouth = {
    down: L(10, ['...ABBBBBBBBA...', '....ABBBBBBA....']),
    right: L(10, ['........ABBBBB..', '.........ABBB...']),
  };

  // ------------------------------------------------------------ NPC table
  const use = (p, o) => CA.use(p, o);
  const head = (face) => [P.head, CA.part('face.' + face)];
  const SKIN = () => CA.SKIN, HAIR = () => CA.HAIR;
  const lazy = (type, spec, palFn) => { Object.defineProperty(N, type, { enumerable: true, configurable: true, get() { return { spec, pal: palFn() }; } }); };

  // bard: long-haired troubadour in green with a plumed beret and a lyre on the back
  lazy('bard', () => ({
    body: P.body.light, head: head('gentle'), hair: use(P.hairLong, { clipY: 5 }), hat: P.hat.beret, over: [P.over.lyre],
  }), () => ({ main: '#5a8c2c', sub: '#c8602c', trim: '#f4f0e0', hair: HAIR().blond, skin: SKIN().A, acc2: '#6a3c2c', acc: '#e8b040' }));

  // farmer: vest, straw hat, hoe over the shoulder, sunburnt
  lazy('farmer', () => ({
    body: P.body.vest, head: head('boy'), hair: use(P.hairShort, { clipY: 5 }), hat: P.hat.straw, beard: P.beardShort, over: [P.over.hoe],
  }), () => ({ main: '#8a6a3c', sub: '#a83c2c', trim: '#e8c878', hair: HAIR().brown, skin: SKIN().B, acc2: '#4a5a7c', leather: '#7a5230' }));

  // miner: a human (not a dwarf) in a vest with a lamp cap, sooty face and a pickaxe
  lazy('miner', () => ({
    body: P.body.vest, head: head('boy'), hair: use(P.hairShort, { clipY: 5 }), hat: P.hat.lampcap, over: [P.over.soot, P.over.pick],
  }), () => ({ main: '#5a5a4a', sub: '#6a6a78', trim: '#e0b040', hair: HAIR().black, skin: SKIN().B, acc2: '#3c3a44', leather: '#6a4a30', steel: '#8c94a4' }));

  // noble: long coat with a long cape and a top hat (hat in dark cloth, gold band)
  lazy('noble', () => ({
    capeBack: use(P.cape.long.back, { map: { D: 'A', E: 'B', F: 'C' } }), cape: use(P.cape.long, { map: { D: 'A', E: 'B', F: 'C' } }),
    body: P.body.coat, head: head('sharp'), hair: use(P.hairShort, { clipY: 6 }), beard: P.mustache,
    hat: P.hat.tophatPlain,
  }), () => ({ main: '#4a2c6c', sub: '#f4f0e4', trim: '#e8c850', hair: HAIR().blond, skin: SKIN().A, acc2: '#2c2838' }));

  // fisher: striped jersey, cloth cap, a net bundle on the shoulder, stubble
  lazy('fisher', () => ({
    body: P.body.sailor, head: head('boy'), hair: use(P.hairShort, { clipY: 5 }), hat: P.hat.cap, beard: P.beardShort, over: [P.over.net],
  }), () => ({ main: '#e8dcc0', sub: '#7a5a3c', trim: '#5a7a9c', hair: HAIR().auburn, skin: SKIN().B, acc2: '#3c4a5c', leather: '#6a4a30' }));

  // teller: one of Roa's storytellers — brown robe and hood, cream stole, an old book
  lazy('teller', () => ({
    body: P.body.robe, head: head('old'), hair: P.hairHooded, hat: P.hat.hood, beard: P.beardShort, over: [P.over.book],
  }), () => ({ main: '#6a4a2c', sub: '#e8dcb8', trim: '#c8a040', hair: HAIR().grey, skin: SKIN().A, leather: '#5a3420' }));

  // nomad: desert traveller in a sand robe and turban, mouth veiled
  lazy('nomad', () => ({
    body: P.body.robe, head: head('sharp'), hair: use(P.hairShort, { clipY: 7 }), hat: P.hat.turban, over: [P.over.veilMouth],
  }), () => ({ main: '#c8a878', sub: '#f0e8d8', trim: '#e8c850', hair: HAIR().black, skin: SKIN().C, acc2: '#6a4a30' }));

  // priestess: shrine maiden — white top and scarlet hakama like noela, but hair tied low at the back
  lazy('priestess', () => ({
    body: P.body.hakama, head: head('gentle'), hair: P.hairTail,
  }), () => ({ main: '#f4f4f8', sub: '#c83c3c', trim: '#f4f4f8', hair: HAIR().brown, skin: SKIN().A }));

  // ------------------------------------------------------------ animals
  // W wool/feather light, w shade, v deep shade, a dark (face, legs), e eye, n nose/beak,
  // r comb (red), y legs (yellow). Rows are bottom-aligned on row 22 (outline on 23).
  const SHEEP = {
    down: [[
      '.....wWWWWw.....',
      '...wWWWWWWWWw...',
      '..wWWaaaaaaWWw..',
      '.aaWWaeaaeaWWaa.',
      '..wWWaaaaaaWWw..',
      '..wWWWaaaaWWWw..',
      '.wWWWWWanWWWWWw.',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWvw.',
      '.vwWWWWWWWWWwvv.',
      '..vwwwwwwwwwwv..',
      '...aa.aa..aa.aa.',
      '...aa.aa..aa.aa.',
    ], [
      '.....wWWWWw.....',
      '...wWWWWWWWWw...',
      '..wWWaaaaaaWWw..',
      '.aaWWaeaaeaWWaa.',
      '..wWWaaaaaaWWw..',
      '..wWWWaaaaWWWw..',
      '.wWWWWWanWWWWWw.',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWvw.',
      '.vwWWWWWWWWWwvv.',
      '..vwwwwwwwwwwv..',
      '..aa.aa..aa.aa..',
      '..aa.aa..aa.aa..',
    ]],
    up: [[
      '.....wWWWWw.....',
      '...wWWWWWWWWw...',
      '..wWWWWWWWWWWw..',
      '.aaWWWWWWWWWWaa.',
      '..wWWWWWWWWWWw..',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWvw.',
      '.wWWWWWWWWWWWvw.',
      '.vwWWWWWWWWWwvv.',
      '..vwwwwwwwwwwv..',
      '...aa.aa..aa.aa.',
      '...aa.aa..aa.aa.',
    ], [
      '.....wWWWWw.....',
      '...wWWWWWWWWw...',
      '..wWWWWWWWWWWw..',
      '.aaWWWWWWWWWWaa.',
      '..wWWWWWWWWWWw..',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWWw.',
      '.wWWWWWWWWWWWvw.',
      '.wWWWWWWWWWWWvw.',
      '.vwWWWWWWWWWwvv.',
      '..vwwwwwwwwwwv..',
      '..aa.aa..aa.aa..',
      '..aa.aa..aa.aa..',
    ]],
    right: [[
      '................',
      '..wWWWWWWWw.....',
      '.wWWWWWWWWWwaa..',
      'wWWWWWWWWWWaaaa.',
      'wWWWWWWWWWWaeaan',
      'wWWWWWWWWWWaaaa.',
      'wWWWWWWWWWWwaa..',
      'vWWWWWWWWWWw....',
      'vwWWWWWWWWwv....',
      '.vwwwwwwwwvv....',
      '..aa.aa..aa.aa..',
      '..aa.aa..aa.aa..',
    ], [
      '................',
      '..wWWWWWWWw.....',
      '.wWWWWWWWWWwaa..',
      'wWWWWWWWWWWaaaa.',
      'wWWWWWWWWWWaeaan',
      'wWWWWWWWWWWaaaa.',
      'wWWWWWWWWWWwaa..',
      'vWWWWWWWWWWw....',
      'vwWWWWWWWWwv....',
      '.vwwwwwwwwvv....',
      '...aa.aa.aa.aa..',
      '....aa.aa.aa.aa.',
    ]],
  };
  const CHICKEN = {
    down: [[
      '......rr........',
      '.....rrr........',
      '....wWWWw.......',
      '....WeWeW.......',
      '....WWnWW.......',
      '.....WrW........',
      '...wWWWWWw......',
      '..wWWWWWWWw.....',
      '..wWWWWWWWw.....',
      '..vwWWWWWwv.....',
      '...vwwwwwv......',
      '.....y.y........',
      '....yy.yy.......',
    ], [
      '......rr........',
      '.....rrr........',
      '....wWWWw.......',
      '....WeWeW.......',
      '....WWnWW.......',
      '.....WrW........',
      '...wWWWWWw......',
      '..wWWWWWWWw.....',
      '..wWWWWWWWw.....',
      '..vwWWWWWwv.....',
      '...vwwwwwv......',
      '.....y..y.......',
      '....yy..yy......',
    ]],
    up: [[
      '......rr........',
      '.....rrr........',
      '....wWWWw.......',
      '....WWWWW.......',
      '....wWWWw.......',
      '..vw.wWw.wv.....',
      '..vwwWWWwwv.....',
      '..wWWWWWWWw.....',
      '..wWWWWWWWw.....',
      '..vwWWWWWwv.....',
      '...vwwwwwv......',
      '.....y.y........',
      '....yy.yy.......',
    ], [
      '......rr........',
      '.....rrr........',
      '....wWWWw.......',
      '....WWWWW.......',
      '....wWWWw.......',
      '..vw.wWw.wv.....',
      '..vwwWWWwwv.....',
      '..wWWWWWWWw.....',
      '..wWWWWWWWw.....',
      '..vwWWWWWwv.....',
      '...vwwwwwv......',
      '.....y..y.......',
      '....yy..yy......',
    ]],
    right: [[
      '.........rr.....',
      '........rrr.....',
      '.......wWWWw....',
      '.......WWWeWnn..',
      '.v.....wWWWWr...',
      '.vv....wWWWr....',
      '.vwv..wWWWWw....',
      '..vwwWWWWWWW....',
      '..vwWWWWWWWW....',
      '...vwWWWWWWw....',
      '....vwwwwwv.....',
      '.......y.y......',
      '......yy.yy.....',
    ], [
      '................',
      '.........rr.....',
      '........rrr.....',
      '.......wWWWw....',
      '.v.....WWWeWnn..',
      '.vv....wWWWWr...',
      '.vwv..wWWWWw....',
      '..vwwWWWWWWW....',
      '..vwWWWWWWWW....',
      '...vwWWWWWWw....',
      '....vwwwwwv.....',
      '........y.......',
      '.......yyy......',
    ]],
  };
  function animal(src, pal, dx) {
    const out = { down: [], up: [], left: [], right: [] };
    for (const dir of ['down', 'up', 'right']) {
      for (let f = 0; f < 2; f++) {
        const buf = new Array(16 * 24).fill(null);
        const g = src[dir][f];
        let last = g.length - 1;
        while (last > 0 && !/[^.]/.test(g[last])) last--;
        CA.stamp(buf, { y: 22 - last, x: dir === 'right' ? 0 : dx || 0, g }, pal, false, 0);
        CA.closeEdges(buf);
        CA.outline(buf, CA.OUTLINE);
        out[dir].push(CA.toCanvas(buf));
      }
    }
    out.left = out.right.map((c) => R.Gfx.flipH(c));
    return out;
  }
  N.sheep = { build: () => animal(SHEEP, { W: '#f4f0e4', w: '#d0c8b8', v: '#9a9088', a: '#3c3438', e: '#f8f0d8', n: '#1c1418' }) };
  N.chicken = { build: () => animal(CHICKEN, { W: '#f8f4ec', w: '#d8d0c4', v: '#a8988c', r: '#d83c30', n: '#f0b830', e: '#1c1418', y: '#e8a830' }, 3) };
})(window.RPG);
