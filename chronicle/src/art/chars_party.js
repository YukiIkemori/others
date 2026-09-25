// Party looks (DESIGN §5.2.8 · §5.3.7 · §11.3.2): the 20 companions and the
// hero (2 genders × 5 types) as CA.parts.party[id]. chars.js registers every
// entry at load time as 'party:<id>'. Parts are named ('hairPony', 'face.old',
// over 'quill') so a missing part falls back to its stand-in (§5.3.8).
// The values are the tables of §5.2.8 / §5.3.7 verbatim (tools/test_art-chars.js
// checks them); hair colours are CA.HAIR names or 4 hex values, skins CA.SKIN names.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});
  const P = (CA.parts = CA.parts || {});
  const L = (y, g, x) => ({ y, g, x: x || 0 });
  P.body = P.body || {};
  P.party = P.party || {};

  // ------------------------------------------------------------ extra bodies
  // hakama: white kimono top with a red under-collar and wide sleeves, scarlet
  // pleated hakama tied high, white tabi (noela, npc:priestess). Main = top, sub = hakama.
  P.body.hakama = {
    down: [
      L(12, [
        '....BCEFFEBA....',
        '...BCBBEEBBBA...',
        '..BCCBBBEBBBAA..',
        '..BCBBBBBBBBAA..',
        '..BCBBBBBBBBBA..',
        '..ssDFFGGFFDsd..',
        '...DEFEEDEEFD...',
        '...DEFEDDEEFD...',
        '..DEEFEDDEEEFD..',
        '..DDEEDD.DEEDD..',
        '...jjN....jjN...',
      ]),
      L(12, [
        '....BCEFFEBA....',
        '...BCBBEEBBBA...',
        '..BCCBBBEBBBAA..',
        '..BCBBBBBBBBAA..',
        '..BCBBBBBBBBBA..',
        '..ssDFFGGFFDsd..',
        '...DEFEEDEEFD...',
        '...DEFEDDEEFD...',
        '..DEFEEDDEEEFD..',
        '..DDEEDD.DDEDD..',
        '....jjN..jjN....',
      ]),
    ],
    up: [
      L(12, [
        '....BCBBBBBA....',
        '...BCBBBBBBBA...',
        '..BCCBBBBBBBAA..',
        '..BCBBBBBBBBAA..',
        '..BCBBBBBBBBBA..',
        '..sdDFGHHGFDsd..',
        '...DEFEGGEEFD...',
        '...DEFEDDEEFD...',
        '..DEEFEDDEEEFD..',
        '..DDEEDD.DEEDD..',
        '...jjN....jjN...',
      ]),
      L(12, [
        '....BCBBBBBA....',
        '...BCBBBBBBBA...',
        '..BCCBBBBBBBAA..',
        '..BCBBBBBBBBAA..',
        '..BCBBBBBBBBBA..',
        '..sdDFGHHGFDsd..',
        '...DEFEGGEEFD...',
        '...DEFEDDEEFD...',
        '..DEFEEDDEEEFD..',
        '..DDEEDD.DDEDD..',
        '....jjN..jjN....',
      ]),
    ],
    right: [
      L(12, [
        '.....BCBBEF.....',
        '....BCBBBBEB....',
        '....BCCBBBBB....',
        '...BCBBBCBBB....',
        '...BCBBBCBBA....',
        '...ABDFGssFE....',
        '....DEFEEEFE....',
        '....DEDEEEEFE...',
        '...DEEDEEEEFE...',
        '...DDED...DEED..',
        '...jjN.....jjN..',
      ]),
      L(12, [
        '.....BCBBEF.....',
        '....BCBBBBEB....',
        '....BCCBBBBB....',
        '...BCBBBCBBB....',
        '...BCBBBCBBA....',
        '...ABDFGssFE....',
        '....DEFEEEFE....',
        '....DEDEEEEE....',
        '....DEEDEEEFE...',
        '.....DEEDDEE....',
        '.....jjjjN......',
      ]),
    ],
  };

  // ------------------------------------------------------------ companions (§5.3.7)
  // hatMap SUB draws a main-coloured hat in the sub colours where hat and hair or
  // hat and clothes would otherwise merge (sylvain's cap on green hair, teo's hat on a red robe).
  const SUB = { A: 'D', B: 'E', C: 'F' };
  const T = {
    selma: { gender: 'f', skin: 'A', hairPart: 'hairPony', hair: 'blond', face: 'sharp',
      style: { body: 'armor', hat: 'circlet' }, outfit: { main: '#c4ccd8', sub: '#2c7c9c', trim: '#e8c850' } },
    hagen: { gender: 'm', skin: 'B', hairPart: 'hairWild', hair: 'auburn', face: 'sharp', over: ['eyepatch'], beard: 'beardShort',
      style: { body: 'fighter', cape: 'mantle' }, outfit: { main: '#6a3c2c', sub: '#8c94a4', trim: '#c8a060' }, colors: { steel: '#8c94a4' } },
    dokka: { gender: 'm', skin: 'B', hairPart: 'hairShort', hair: 'red', face: 'old', beard: 'beard', small: true,
      style: { body: 'dwarf', hat: 'goggles' }, outfit: { main: '#4a5a3c', sub: '#6a6a78', trim: '#e0b040' }, colors: { leather: '#6a4a30' } },
    basil: { gender: 'm', skin: 'A', hairPart: 'hairBald', hair: 'brown', face: 'gentle',
      style: { body: 'robe', cape: 'mantle' }, outfit: { main: '#7a5a3a', sub: '#e8dcc0', trim: '#c8a040' } },
    bartolo: { gender: 'm', skin: 'A', hairPart: 'hairShort', hair: 'white', face: 'old', beard: 'mustache',
      style: { body: 'armor', hat: 'plume', cape: 'long' }, outfit: { main: '#9ca0a8', sub: '#6c1a2c', trim: '#d8b040' } },
    viola: { gender: 'f', skin: 'A', hairPart: 'hairCurly', hair: ['#6c3c30', '#a86c50', '#d8a070', '#f8d8a8'], face: 'sharp',
      style: { body: 'coat', cape: 'long' }, outfit: { main: '#8c2c3c', sub: '#f0ecdc', trim: '#e8c850' } },
    shigure: { gender: 'm', skin: 'A', hairPart: 'hairTail', hair: 'black', face: 'narrow',
      style: { body: 'gi' }, outfit: { main: '#3c4a6c', sub: '#e8e4d8', trim: '#9c2c2c' } },
    rouga: { gender: 'm', skin: 'B', hairPart: 'hairCrop', hair: 'black', face: 'boy',
      style: { body: 'gi', hat: 'headband' }, outfit: { main: '#c83c2c', sub: '#3a2c20', trim: '#f0e0a8' } },
    titta: { gender: 'f', skin: 'A', hairPart: 'hairPig', hair: 'red', face: 'boy', over: ['freckles'],
      style: { body: 'lightF', hat: 'bandana' }, outfit: { main: '#3e7a44', sub: '#5a4030', trim: '#e8d8a8' } },
    brigitta: { gender: 'f', skin: 'A', hairPart: 'hairBraid', hair: 'auburn', face: 'sharp',
      style: { body: 'fighterF' }, outfit: { main: '#5a6a3c', sub: '#9ca4b8', trim: '#c89040' } },
    sylvain: { gender: 'm', skin: 'forest', hairPart: 'hairLong', hair: 'green', face: 'narrow', eye: '#1c3020', over: ['elfEars'],
      style: { body: 'light', hat: 'feather', hatMap: SUB }, outfit: { main: '#2c5c4c', sub: '#8a6a3c', trim: '#e0d8a0' } },
    zafira: { gender: 'f', skin: 'C', hairPart: 'hairWave', hair: ['#2c1024', '#5a2448', '#8a3c6c', '#b86c94'], face: 'gentle', over: ['earrings'],
      style: { body: 'lightF', hat: 'circlet' }, outfit: { main: '#e8a030', sub: '#8c2c6c', trim: '#f0d060' } },
    ferno: { gender: 'm', skin: 'A', hairPart: 'hairShort', hair: 'brown', face: 'gentle',
      style: { body: 'light', hat: 'beret', cape: 'mantle' }, outfit: { main: '#3c6c9c', sub: '#e8dcb0', trim: '#c84868' } },
    belladonna: { gender: 'f', skin: 'A', hairPart: 'hairBun', hair: ['#142c1c', '#24483a', '#3c6c54', '#6c9c80'], face: 'sharp',
      style: { body: 'coat', hat: 'wide' }, outfit: { main: '#5a3c6c', sub: '#e0d8c0', trim: '#6aa04a' }, colors: { leather: '#6a4a30' } },
    boden: { gender: 'm', skin: 'A', hairPart: 'hairBald', hair: 'grey', face: 'old', over: ['glasses'], beard: 'beard',
      style: { body: 'coat', hat: 'kettle' }, outfit: { main: '#8c6a3c', sub: '#4a4a58', trim: '#e0b040' } },
    teo: { gender: 'm', skin: 'A', hairPart: ['hairShort', 'tuft'], hair: 'red', face: 'boy',
      style: { body: 'robe', hat: 'witch', hatMap: SUB }, outfit: { main: '#b83c2c', sub: '#2c2450', trim: '#f0d060' } },
    ilse: { gender: 'f', skin: 'A', hairPart: 'hairSide', hair: ['#141c3c', '#2c3c6c', '#4c64a0', '#8ca0d0'], face: 'gentle', eye: '#1c2450', over: ['glasses'],
      style: { body: 'robe', cape: 'mantle' }, outfit: { main: '#26305c', sub: '#e8e4f0', trim: '#f0d060' } },
    morga: { gender: 'f', skin: 'pale', hairPart: 'hairLong', hair: ['#100818', '#281838', '#402a58', '#604880'], face: 'narrow', eye: '#3a1030',
      style: { body: 'robe', hat: 'hood' }, outfit: { main: '#2c2838', sub: '#6c1a4c', trim: '#a0a4b0' } },
    marta: { gender: 'f', skin: 'A', hairPart: 'hairMetem', hair: 'brown', face: 'gentle',
      style: { body: 'coat' }, outfit: { main: '#f0ece0', sub: '#3c6cc0', trim: '#c83c3c' } },
    noela: { gender: 'f', skin: 'A', hairPart: ['hairHime', 'ribbon'], hair: 'black', face: 'gentle', colors: { acc: '#f4f4f8' },
      style: { body: 'robe', variant: 'hakama' }, outfit: { main: '#f4f4f8', sub: '#c83c3c', trim: '#f0c830' } },
  };

  // ------------------------------------------------------------ the hero (§5.2.8)
  // 10 looks: hair hairHeroM / hairHeroF in chestnut, skin A, face boy / gentle,
  // the storyteller's white quill over the right ear on every type.
  const HERO_TYPE = {
    warrior: { body: 'fighter', bodyF: 'fighterF', hat: null, cape: null, main: '#2c5cd0', sub: '#9ca4b8', trim: '#e8c850' },
    ranger: { body: 'light', bodyF: 'lightF', hat: 'feather', cape: null, main: '#4a7a3a', sub: '#7a5a34', trim: '#e8dcb8' },
    mage: { body: 'robe', hat: 'hood', cape: null, main: '#3a4a9c', sub: '#e8dcc0', trim: '#e0b040' },
    spellblade: { body: 'armor', hat: null, cape: 'long', main: '#5a3c9c', sub: '#c0c8d8', trim: '#e8c850' },
    wanderer: { body: 'coat', hat: null, cape: 'mantle', main: '#8a6a3c', sub: '#e8e0c8', trim: '#3c8a78' },
  };
  CA.HERO_TYPE_LOOK = HERO_TYPE;
  for (const g of ['m', 'f']) {
    for (const type in HERO_TYPE) {
      const t = HERO_TYPE[type];
      const style = { body: t.body };
      if (t.bodyF) style.bodyF = t.bodyF;
      if (t.hat) style.hat = t.hat;
      if (t.cape) style.cape = t.cape;
      T['hero_' + g + '_' + type] = {
        gender: g, skin: 'A', hair: 'chestnut', face: g === 'f' ? 'gentle' : 'boy',
        hairPart: g === 'f' ? 'hairHeroF' : 'hairHeroM', over: g === 'f' ? ['heroBraid', 'quill'] : ['quill'], hero: true, type,
        style, outfit: { main: t.main, sub: t.sub, trim: t.trim },
      };
    }
  }

  Object.assign(P.party, T);
})(window.RPG);
