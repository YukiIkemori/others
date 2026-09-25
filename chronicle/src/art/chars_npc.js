// NPC field sprites ('npc:<type>', DESIGN §4): extra hair styles, beards,
// headgear, bodies and props, plus one figure spec + palette per NPC type.
// Humans reuse the party parts (chars_parts.js); animals, the ghost and the
// spirit have their own builders at the end.
(function (R) {
  'use strict';
  const A = (R.Art = R.Art || {});
  const CA = (A.Chars = A.Chars || {});
  const P = (CA.parts = CA.parts || {});
  const N = (CA.npcs = CA.npcs || {});
  const L = (y, g, x) => ({ y, g, x: x || 0 });
  for (const k of ['hat', 'body', 'over', 'cape']) P[k] = P[k] || {};

  // ------------------------------------------------------------ hair
  P.hairShort = {
    down: L(2, [
      '.....233332.....',
      '...2344443332...',
      '..234444333332..',
      '..234433333322..',
      '..233223333222..',
      '..22.2....2.22..',
      '..1..........1..',
    ]),
    up: L(2, [
      '.....233332.....',
      '...2344443332...',
      '..234444333332..',
      '..234433333322..',
      '..233333333222..',
      '..223333332222..',
      '..122222222221..',
      '...1122222211...',
      '....11111111....',
    ]),
    right: L(2, [
      '....233332......',
      '..2344443332....',
      '.234444333332...',
      '.2344333333322..',
      '.2333333233222..',
      '.2233332.2.2....',
      '.22332..........',
      '.12222..........',
      '..111...........',
    ]),
  };
  // a cowlick for the boy
  P.tuft = {
    down: L(0, ['.......3........', '......33........']),
    up: L(0, ['.......3........', '......33........']),
    right: L(0, ['......3.........', '.....33.........']),
  };
  // bald crown with a white fringe and bushy brows (old man, elder, innkeeper)
  P.hairBald = {
    down: L(3, [
      '....ttsssssd....',
      '...tssssssssd...',
      '..3tsssssssdd3..',
      '.34sssssssssd43.',
      '.33.33....33.33.',
      '.23..........32.',
      '..2..........2..',
    ]),
    up: L(3, [
      '....ttsssssd....',
      '...tssssssssd...',
      '..3sssssssssd3..',
      '.34333333333343.',
      '.23333333333332.',
      '..222222222222..',
      '...1111111111...',
    ]),
    right: L(3, [
      '....ttsssssd....',
      '...tssssssssd...',
      '..3tssssssssd...',
      '.343sssssssss...',
      '.333sss...33....',
      '.232............',
      '..2.............',
    ]),
  };
  // hair pulled into a bun (old woman)
  P.hairBun = {
    down: L(1, [
      '......2332......',
      '.....234432.....',
      '....22333322....',
      '...2344443332...',
      '..234444333332..',
      '..233333333332..',
      '..232.......32..',
      '..22........22..',
    ]),
    up: L(1, [
      '......2332......',
      '.....234432.....',
      '....22333322....',
      '...2344443332...',
      '..234444333332..',
      '..234333333332..',
      '..233333333322..',
      '..223333333222..',
      '...2222222222...',
      '....11111111....',
    ]),
    right: L(1, [
      '..2332..........',
      '.234432.........',
      '.2233322........',
      '..23444433......',
      '.23444433333....',
      '.233333333332...',
      '.2333332..32....',
      '.22332..........',
      '..222...........',
    ]),
  };
  // long straight hair with a centre part (woman, queen, princess, elf, dancer)
  P.hairLong = {
    down: L(2, [
      '.....234432.....',
      '...2344334432...',
      '..234443344432..',
      '.23444322344432.',
      '.23333.22.33332.',
      '.233........332.',
      '.23..........32.',
      '.23..........32.',
      '.22..........22.',
      '.12..........21.',
      '.12..........21.',
      '..1..........1..',
    ]),
    up: L(2, [
      '.....234432.....',
      '...2344334432...',
      '..234443344432..',
      '.23444333344432.',
      '.23333333333332.',
      '.23333333333332.',
      '.22333333333322.',
      '.22333333333322.',
      '.12233333333221.',
      '.12223333332221.',
      '.11222333322211.',
      '..112222222211..',
      '...1112222111...',
    ]),
    right: L(2, [
      '.....234432.....',
      '...2344334432...',
      '..23444444443...',
      '.2344444444332..',
      '.2333444333332..',
      '.23333333.3.2...',
      '.2333332........',
      '.223332.........',
      '.22333..........',
      '.12233..........',
      '.1222...........',
      '..1122..........',
      '...11...........',
    ]),
  };
  // pigtails tied with ribbons (girl)
  P.hairPig = {
    down: L(2, [
      '.....233332.....',
      '...2344443332...',
      '..234444433332..',
      '..234433333332..',
      '.Q233233233232Q.',
      '.P2..........2P.',
      '.32..........23.',
      '.32..........23.',
      '.2............2.',
    ]),
    up: L(2, [
      '.....233332.....',
      '...2344443332...',
      '..234444433332..',
      '..234433333332..',
      '.Q233333333332Q.',
      '.P233333333332P.',
      '.32122222222123.',
      '.32..........23.',
      '.2............2.',
    ]),
    right: L(2, [
      '....233332......',
      '..2344443332....',
      '.234444433332...',
      '.2344333333322..',
      '.Q3333333233222.',
      '.P2233332.2.2...',
      '.3222...........',
      '.32.............',
      '.2..............',
    ]),
  };
  // wild shaggy hair (bandit)
  P.hairWild = {
    down: L(1, [
      '....3..3..3.....',
      '...333.33.33.3..',
      '..2344343343332.',
      '.23444444333332.',
      '.2334333333332..',
      '.2232332332322..',
      '.22.2.2..2.2.22.',
      '..2..........2..',
    ]),
    up: L(1, [
      '....3..3..3.....',
      '...333.33.33.3..',
      '..2344343343332.',
      '.23444444333332.',
      '.23343333333332.',
      '.22333333333322.',
      '.12233333333221.',
      '..122323232221..',
      '...12.12.12.1...',
    ]),
    right: L(1, [
      '...3..3..3......',
      '..333.33.333....',
      '.23443433433....',
      '.2344444433332..',
      '233443333332322.',
      '2233332.3.2.2...',
      '.22332..........',
      '..2332..........',
      '...22...........',
    ]),
  };

  // ------------------------------------------------------------ beards
  // drawn after the hair, in hair colours
  P.beard = {
    down: L(9, [
      '..3..........3..',
      '..34.3443.4.43..',
      '...3444444443...',
      '....34444433....',
      '.....344433.....',
      '......3433......',
      '.......33.......',
    ]),
    up: null,
    right: L(9, [
      '.......3........',
      '.......34.444...',
      '.......344443...',
      '........34443...',
      '........3443....',
      '.........33.....',
    ]),
  };
  P.beardShort = {
    down: L(9, [
      '..3..........3..',
      '..34.3443.4.43..',
      '...3344444433...',
      '.....333333.....',
    ]),
    right: L(9, [
      '.......3........',
      '.......34.444...',
      '.......3344433..',
      '.........3333...',
    ]),
  };
  P.mustache = {
    down: L(10, ['.....23..32.....']),
    right: L(10, ['..........232...']),
  };

  // ------------------------------------------------------------ headgear
  P.hat.crown = {
    hairClip: 0,
    down: L(1, [
      '....I..I..I.....',
      '...HI.HI.HI.H...',
      '...HIHHIHHIHH...',
      '...GoHHOoHHoG...',
      '...GGGGGGGGGG...',
    ]),
    up: L(1, [
      '....I..I..I.....',
      '...HI.HI.HI.H...',
      '...HIHHIHHIHH...',
      '...GHHHHHHHHG...',
      '...GGGGGGGGGG...',
    ]),
    right: L(1, [
      '....I..I..I.....',
      '...HI.HI.HI.....',
      '...HIHHIHHIH....',
      '...GHHoHHOoG....',
      '...GGGGGGGGG....',
    ]),
  };
  P.hat.tiara = {
    hairClip: 0,
    down: L(3, [
      '.......I........',
      '......HOH.......',
      '...GHHIoIHHG....',
    ]),
    up: L(5, ['...GHHHHHHHG....']),
    right: L(3, [
      '..........I.....',
      '.........HOH....',
      '....GHHHHIoI....',
    ]),
  };
  // iron kettle helm (soldier)
  P.hat.kettle = {
    hairClip: 5,
    down: L(1, [
      '.....YZZZY......',
      '...XYZZZZZYX....',
      '..XYZZZZZZZYX...',
      '..XYYYYYYYYYX...',
      '.XXYYYYYYYYYYXX.',
    ]),
    up: L(1, [
      '.....YZZZY......',
      '...XYZZZZZYX....',
      '..XYZZZZZZZYX...',
      '..XYYYYYYYYYX...',
      '.XXYYYYYYYYYYXX.',
    ]),
    right: L(1, [
      '....YZZZY.......',
      '..XYZZZZZYX.....',
      '..XYZZZZZZZYX...',
      '..XYYYYYYYYYX...',
      '.XXYYYYYYYYYYXX.',
    ]),
  };
  // nun's veil — main cloth, trim band
  P.hat.veil = {
    hairClip: 12,
    down: L(2, [
      '.....BCCBA......',
      '...BCCBBBBBA....',
      '..BCCBBBBBBBA...',
      '..BCIIIIIIIIBA..',
      '..BI........IA..',
      '..BI........IA..',
      '..BA........AA..',
      '..BA........AA..',
      '..BBA......ABA..',
      '..BBBA....ABBA..',
      '..BBBBA..ABBBA..',
      '...ABB....BBA...',
    ]),
    up: L(2, [
      '.....BCCBA......',
      '...BCCBBBBBA....',
      '..BCCBBBBBBBA...',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..ABBBBBBBBBAA..',
      '...AABBBBBBAA...',
    ]),
    right: L(2, [
      '....BCCBA.......',
      '..BCCBBBBBA.....',
      '.BCCBBBBBBBA....',
      '.BCBBBBBBIIII...',
      '.BCBBBBBBI......',
      '.BCBBBBBBI......',
      '.BCBBBBBA.......',
      '.BCBBBBBA.......',
      '.BCBBBBBA.......',
      '.BCBBBBA........',
      '.ABBBBBA........',
      '..ABBBA.........',
    ]),
  };
  // small sailor cap — main cap, trim band
  P.hat.sailor = {
    hairClip: 3,
    down: L(1, [
      '.....BCCBA......',
      '....BCCBBBA.....',
      '...GHHHHHHHG....',
    ]),
    up: L(1, [
      '.....BCCBA......',
      '....BCCBBBA.....',
      '...GHHHHHHHG....',
      '.........HG.....',
      '.........G......',
    ]),
    right: L(1, [
      '....BCCBA.......',
      '...BCCBBBA......',
      '..GHHHHHHHG.....',
      '..HG............',
      '..G.............',
    ]),
  };
  // tricorn hat (captain) — main felt, trim edge
  P.hat.tricorn = {
    hairClip: 5,
    down: L(1, [
      '.....BCCBA......',
      '...BCCBBBBBA....',
      '.GBCCBBHBBBBAG..',
      '.HGBBBBBBBBAGH..',
      '..HGGGGGGGGGH...',
    ]),
    up: L(1, [
      '.....BCCBA......',
      '...BCCBBBBBA....',
      '.GBCCBBBBBBBAG..',
      '.HGBBBBBBBBAGH..',
      '..HGGGGGGGGGH...',
    ]),
    right: L(1, [
      '....BCCBA.......',
      '..BCCBBBBBA.....',
      '.GCCBBBBBBBBG...',
      'HGBBBBBBBBBGH...',
      '.HGGGGGGGGGH....',
    ]),
  };
  // square scholar's cap with a tassel — main cap, trim tassel
  P.hat.scholar = {
    hairClip: 4,
    down: L(1, [
      '.BCCCCBBBBBBBA..',
      '..AAABBBBBBAAH..',
      '....BCBBBBBA.H..',
      '...BCBBBBBBBA...',
    ]),
    up: L(1, [
      '.BCCCCBBBBBBBA..',
      '..HAABBBBBBAAA..',
      '..H.BCBBBBBA....',
      '...BCBBBBBBBA...',
    ]),
    right: L(1, [
      '.BCCCCBBBBBBBA..',
      '..HAABBBBBAAA...',
      '..H.BCBBBBBA....',
      '...BCBBBBBBBA...',
    ]),
  };
  // tall official's cap (minister) — main cap, trim band
  P.hat.official = {
    hairClip: 5,
    down: L(0, [
      '................',
      '.....BCCCBA.....',
      '.....BCBBBA.....',
      '.....BCBBBA.....',
      '....GHHIHHHG....',
      '...BCBBBBBBBA...',
    ]),
    up: L(0, [
      '................',
      '.....BCCCBA.....',
      '.....BCBBBA.....',
      '.....BCBBBA.....',
      '....GHHHHHHG....',
      '...BCBBBBBBBA...',
    ]),
    right: L(0, [
      '................',
      '....BCCCBA......',
      '....BCBBBA......',
      '....BCBBBA......',
      '...GHHHHIHG.....',
      '..BCBBBBBBBBA...',
    ]),
  };
  // cloth cap with a knot (merchant) — sub cloth
  P.hat.cap = {
    hairClip: 5,
    down: L(1, [
      '.......EF.......',
      '.....DEFFED.....',
      '...DEFFEEEEED...',
      '..DEFEEEEEEEED..',
      '..DDDDDDDDDDDD..',
    ]),
    up: L(1, [
      '.......EF.......',
      '.....DEFFED.....',
      '...DEFFEEEEED...',
      '..DEFEEEEEEEED..',
      '..DDDDDDDDDDDD..',
    ]),
    right: L(1, [
      '......EF........',
      '....DEFFED......',
      '..DEFFEEEEED....',
      '.DEFEEEEEEEED...',
      '.DDDDDDDDDDDDD..',
    ]),
  };
  // jewelled head chain with a veil (dancer) — trim chain, sub veil
  P.hat.circletVeil = {
    hairClip: 0,
    down: L(5, [
      '..GHHHHOoHHHHG..',
      '.E..........E...',
    ]),
    up: L(5, [
      '..GHHHHHHHHHHG..',
      '..EFFFEEEEEEED..',
      '..DEFEEEEEEEED..',
      '...DEEEEEEEED...',
      '....DDEEEEDD....',
    ]),
    right: L(5, [
      '.EGHHHHHHHHHOo..',
      'EFE.............',
      'DEE.............',
      '.DE.............',
    ]),
  };
  // demon horns
  P.hat.horns = {
    hairClip: 0,
    down: L(0, [
      '..j..........j..',
      '..ij........ji..',
      '...ij......ji...',
      '...iij....jii...',
    ]),
    up: L(0, [
      '..j..........j..',
      '..ij........ji..',
      '...ij......ji...',
      '...iij....jii...',
    ]),
    right: L(0, [
      '.......j........',
      '......ij........',
      '.....iij........',
      '.....ii.........',
    ]),
  };

  // ------------------------------------------------------------ bodies
  // long dress with a sash (woman, queen, princess, nun, dancer)
  P.body.dress = {
    walk: true,
    down: L(12, [
      '....BCBBBBBA....',
      '...CBCBHHBBAA...',
      '...tBCBBBBBAd...',
      '...sBCGHHGBAs...',
      '...BCBBBBBBBA...',
      '...BCBBBBBBBA...',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..ABBBBBBBBBAA..',
      '...LN...........',
    ]),
    up: L(12, [
      '....BCBBBBBA....',
      '...CBCBBBBBAA...',
      '...tBCBBBBBAd...',
      '...sBCGHHGBAs...',
      '...BCBBHHBBBA...',
      '...BCBBHBBBBA...',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..ABBBBBBBBBAA..',
      '...LN...........',
    ]),
    right: [
      L(12, [
        '.....BCBBB......',
        '....BCBBBBA.....',
        '....BCBtsBA.....',
        '....BGHssHG.....',
        '....BCBBBBBA....',
        '....BCBBBBBA....',
        '...BCBBBBBBBA...',
        '...BCBBBBBBBA...',
        '..BCBBBBBBBBBA..',
        '..ABBBBBBBBBAA..',
        '..LN.......LN...',
      ]),
      L(12, [
        '.....BCBBB......',
        '....BCBBBBA.....',
        '....BCBtsBA.....',
        '....BGHssHG.....',
        '....BCBBBBBA....',
        '....BCBBBBBA....',
        '...BCBBBBBBBA...',
        '...BCBBBBBBBA...',
        '..BCBBBBBBBBBA..',
        '..ABBBBBBBBBAA..',
        '.....LLN........',
      ]),
    ],
  };
  // dress with an apron (sub) — innkeeper's wife style, old woman
  P.body.apron = {
    walk: true,
    down: L(12, [
      '....BCBBBBBA....',
      '...CBEFFFEBAA...',
      '...tBEFFFEBAd...',
      '...sGHFFFHGAs...',
      '...BCEFFFEBBA...',
      '...BCEFFFEBBA...',
      '..BCBEFFFEBBBA..',
      '..BCBEEEEEBBBA..',
      '..BCBBBBBBBBBA..',
      '..ABBBBBBBBBAA..',
      '...LN...........',
    ]),
    up: L(12, [
      '....BCBBBBBA....',
      '...CBCBBBBBAA...',
      '...tBCBBBBBAd...',
      '...sBGHHHHGAs...',
      '...BCBBHHBBBA...',
      '...BCBBHBBBBA...',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..BCBBBBBBBBBA..',
      '..ABBBBBBBBBAA..',
      '...LN...........',
    ]),
    right: [
      L(12, [
        '.....BCBBB......',
        '....BCBBBEF.....',
        '....BCBtsEF.....',
        '....BGHssHG.....',
        '....BCBBBEF.....',
        '....BCBBBEFF....',
        '...BCBBBBEFF....',
        '...BCBBBBEEF....',
        '..BCBBBBBBBBA...',
        '..ABBBBBBBBAA...',
        '..LN......LN....',
      ]),
      L(12, [
        '.....BCBBB......',
        '....BCBBBEF.....',
        '....BCBtsEF.....',
        '....BGHssHG.....',
        '....BCBBBEF.....',
        '....BCBBBEFF....',
        '...BCBBBBEFF....',
        '...BCBBBBEEF....',
        '..BCBBBBBBBBA...',
        '..ABBBBBBBBAA...',
        '.....LLN........',
      ]),
    ],
  };
  // shirt + apron + trousers (merchant, innkeeper)
  P.body.shop = {
    walk: true,
    down: L(12, [
      '....BCBBBBBA....',
      '...BCEFFFFEBA...',
      '...BCEFFFFEBA...',
      '...sBEFFFFEAs...',
      '...sLMFFFFMLs...',
      '....BEFFFFEA....',
      '....VEFFFFEV....',
      '....VWEEEEWV....',
      '....LMN..LMN....',
      '....LMN..LLN....',
      '...LLMN.........',
    ]),
    up: L(12, [
      '....BCBBBBBA....',
      '...BCBBEEBBBA...',
      '...BCBBEEBBBA...',
      '...sBCBBEBBAs...',
      '...sLMMMMMMLs...',
      '....BCBBBBBA....',
      '....VWVVVWVV....',
      '....VWV..VWV....',
      '....LMN..LMN....',
      '....LMN..LLN....',
      '...LLMN.........',
    ]),
    right: [
      L(12, [
        '.....BCBBE......',
        '....BCBBBEF.....',
        '....BCBBBEF.....',
        '.....BssBEF.....',
        '....LMssMEF.....',
        '....BCBBBEFF....',
        '....VWVVVEFF....',
        '...VWV..VEEF....',
        '...LMN...LMN....',
        '..LMN....LMMN...',
        '..LLN.....LLLN..',
      ]),
      L(12, [
        '.....BCBBE......',
        '....BCBBBEF.....',
        '....BCBBBEF.....',
        '.....BssBEF.....',
        '....LMssMEF.....',
        '....BCBBBEFF....',
        '.....VWVVEFF....',
        '.....VWVWEEF....',
        '.....LMNMN......',
        '.....LMNMN......',
        '.....LLLLN......',
      ]),
    ],
  };
  // striped shirt (sailor) — main stripes on sub
  P.body.sailor = {
    walk: true,
    down: L(12, [
      '....GHIIHHHG....',
      '...BCBGHHGBBA...',
      '...EFEEEEEEED...',
      '...sCBBBBBBAs...',
      '...sEFEEEEEDd...',
      '....BCBBBBBA....',
      '....VWV..VWV....',
      '....VWV..VWV....',
      '....sst..sst....',
      '....LMN..LLN....',
      '...LLMN.........',
    ]),
    up: L(12, [
      '....GHHHHHHG....',
      '...BCBBBBBBBA...',
      '...EFEEEEEEED...',
      '...sCBBBBBBAs...',
      '...sEFEEEEEDd...',
      '....BCBBBBBA....',
      '....VWV..VWV....',
      '....VWV..VWV....',
      '....sst..sst....',
      '....LMN..LMN....',
      '...LLMN.........',
    ]),
    right: [
      L(12, [
        '.....GHIHH......',
        '....BCGHHBB.....',
        '....EFEEEEED....',
        '.....BssBBBB....',
        '....EFssEEED....',
        '....BCBBBBBA....',
        '....VWV..VW.....',
        '...VWV...VWV....',
        '...sst...sst....',
        '..LMN....LMMN...',
        '..LLN.....LLLN..',
      ]),
      L(12, [
        '.....GHIHH......',
        '....BCGHHBB.....',
        '....EFEEEEED....',
        '.....BssBBBB....',
        '....EFssEEED....',
        '....BCBBBBBA....',
        '.....VWVVWV.....',
        '.....VWVWV......',
        '.....sstst......',
        '.....LMNMN......',
        '.....LLLLN......',
      ]),
    ],
  };
  // leather vest over a bare chest (bandit)
  P.body.vest = {
    walk: true,
    down: L(12, [
      '....BCtssdBA....',
      '..tsBCsssdBAsd..',
      '..tsBCBtsBBAsd..',
      '..tsBCBBBBBAsd..',
      '..tsLMMHIMMLsd..',
      '....VWWVVWWV....',
      '....VWWVVWWV....',
      '....VWV..VWV....',
      '....LMN..LMN....',
      '....LMN..LLN....',
      '...LLMN.........',
    ]),
    up: L(12, [
      '....BCBBBBBA....',
      '..tsBCBBBBBAsd..',
      '..tsBCBBBBBAsd..',
      '..tsBCBBBBBAsd..',
      '..tsLMMMMMMLsd..',
      '....VWWVVWWV....',
      '....VWWVVWWV....',
      '....VWV..VWV....',
      '....LMN..LMN....',
      '....LMN..LLN....',
      '...LLMN.........',
    ]),
    right: [
      L(12, [
        '.....BCBts......',
        '....BCBBtsd.....',
        '....BCtsBBs.....',
        '....BCtsBBB.....',
        '....LMtsMML.....',
        '....VWWVVWV.....',
        '....VWWVVWV.....',
        '...VWV..VWV.....',
        '...LMN...LMN....',
        '..LMN....LMMN...',
        '..LLN.....LLLN..',
      ]),
      L(12, [
        '.....BCBts......',
        '....BCBBtsd.....',
        '....BCtsBBs.....',
        '....BCtsBBB.....',
        '....LMtsMML.....',
        '....VWWVVWV.....',
        '.....VWVVWV.....',
        '.....VWVWV......',
        '.....LMNMN......',
        '.....LMNMN......',
        '.....LLLLN......',
      ]),
    ],
  };
  // children: shorter body (the head is lowered by 3 px)
  P.body.kid = {
    walk: true,
    down: L(15, [
      '.....BCBBBBA....',
      '....sBCBBBBAs...',
      '....sBCBBBBAd...',
      '.....DEEEEED....',
      '.....DEF.ED.....',
      '.....tsd.sd.....',
      '.....LMN.LN.....',
      '....LLMN........',
    ]),
    up: L(15, [
      '.....BCBBBBA....',
      '....sBCBBBBAs...',
      '....sBCBBBBAd...',
      '.....DEEEEED....',
      '.....DEF.ED.....',
      '.....tsd.sd.....',
      '.....LMN.LN.....',
      '....LLMN........',
    ]),
    right: [
      L(15, [
        '......BCBB......',
        '.....BCBBBA.....',
        '......stBBA.....',
        '.....DEsEED.....',
        '....DEF..ED.....',
        '....tsd..tsd....',
        '...LMN....LMN...',
        '...LLN....LLLN..',
      ]),
      L(15, [
        '......BCBB......',
        '.....BCBBBA.....',
        '......stBBA.....',
        '.....DEsEED.....',
        '......DEFD......',
        '......tsd.......',
        '......LMN.......',
        '......LLLN......',
      ]),
    ],
  };
  P.body.kidF = {
    walk: true,
    down: L(15, [
      '.....BCBBBBA....',
      '....sBCHHBAs....',
      '....sBCBBBAd....',
      '....BCBBBBBA....',
      '...BCBBBBBBBA...',
      '.....tsd.sd.....',
      '.....LMN.LN.....',
      '....LLMN........',
    ]),
    up: L(15, [
      '.....BCBBBBA....',
      '....sBCBBBAs....',
      '....sBCBBBAd....',
      '....BCBBBBBA....',
      '...BCBBBBBBBA...',
      '.....tsd.sd.....',
      '.....LMN.LN.....',
      '....LLMN........',
    ]),
    right: [
      L(15, [
        '......BCBB......',
        '.....BCBBBA.....',
        '......stBBA.....',
        '.....BCsBBBA....',
        '....BCBBBBBBA...',
        '....tsd..tsd....',
        '...LMN....LMN...',
        '...LLN....LLLN..',
      ]),
      L(15, [
        '......BCBB......',
        '.....BCBBBA.....',
        '......stBBA.....',
        '.....BCsBBBA....',
        '....BCBBBBBBA...',
        '......tsd.......',
        '......LMN.......',
        '......LLLN......',
      ]),
    ],
  };
  // dwarf: squat and broad (head lowered by 3 px)
  P.body.dwarf = {
    walk: true,
    down: L(15, [
      '..BCCBBBBBBBA...',
      '.tsBCBBBBBBAsd..',
      '.tsBCBBBBBBAsd..',
      '..sLMMHIMMLs....',
      '...BCBBBBBBA....',
      '...VWWV.VWWV....',
      '...LMMN.LMMN....',
      '..LLLMN.........',
    ]),
    up: L(15, [
      '..BCCBBBBBBBA...',
      '.tsBCBBBBBBAsd..',
      '.tsBCBBBBBBAsd..',
      '..sLMMMMMMLs....',
      '...BCBBBBBBA....',
      '...VWWV.VWWV....',
      '...LMMN.LMMN....',
      '..LLLMN.........',
    ]),
    right: [
      L(15, [
        '....BCCBBBA.....',
        '...BCBBBBBBA....',
        '...BCtsBBBBA....',
        '...LMtsHMMML....',
        '...BCBBBBBBA....',
        '..VWWV..VWWV....',
        '..LMMN...LMMN...',
        '.LLLN.....LLLN..',
      ]),
      L(15, [
        '....BCCBBBA.....',
        '...BCBBBBBBA....',
        '...BCtsBBBBA....',
        '...LMtsHMMML....',
        '...BCBBBBBBA....',
        '....VWWVWWV.....',
        '....LMMNMMN.....',
        '....LLLLLLN.....',
      ]),
    ],
  };

  // ------------------------------------------------------------ props (drawn last)
  P.over.spear = {
    down: L(2, [
      '.Z..............',
      'YZX.............',
      '.Y..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.M..............',
      '.L..............',
    ], 1),
    up: L(2, [
      '..............Z.',
      '.............YZX',
      '..............Y.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............M.',
      '..............L.',
    ], -1),
    right: L(2, [
      '............Z...',
      '...........YZX..',
      '............Y...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............M...',
      '............L...',
    ]),
  };
  // walking stick / staff: the top knob uses trim (staff) or leather (cane)
  P.over.cane = {
    down: L(14, [
      '.............NM.',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............L..',
    ]),
    up: L(14, [
      '.MN.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..L.............',
    ]),
    right: L(14, [
      '..........MN....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........L.....',
    ]),
  };
  P.over.staff = {
    down: L(4, [
      '............HIH.',
      '............GoG.',
      '.............H..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............M..',
      '.............L..',
    ]),
    up: L(4, [
      '.HIH............',
      '.GoG............',
      '..H.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..M.............',
      '..L.............',
    ]),
    right: L(4, [
      '.........HIH....',
      '.........GoG....',
      '..........H.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........M.....',
      '..........L.....',
    ]),
  };
  P.over.glasses = {
    down: L(8, ['....XZX..XZX....']),
    right: L(8, ['.........XZX....']),
  };
  P.over.elfEars = {
    down: L(7, ['.s............s.', '.ts..........sd.']),
    up: L(7, ['.s............s.', '.ts..........sd.']),
    right: L(6, ['......s.........', '.....ts.........', '.....ss.........']),
  };
  P.over.mask = {
    down: L(10, ['...DEFFEEEED....', '....DEEEEED.....']),
    right: L(10, ['.......DEEEEE...', '........DEEE....']),
  };

  // ------------------------------------------------------------ NPC table
  const use = (p, o) => CA.use(p, o);
  const KID = 3;
  const kidPart = (p) => use(p, { dy: KID });
  const faceM = () => [P.head, P.face.boy];
  const faceF = () => [P.head, P.face.gentle];

  const skinA = ['#d8966a', '#f4c49c', '#fde2c8'];
  const skinB = ['#b87850', '#dca47c', '#f0c8a0'];
  const skinC = ['#8c5a3c', '#b8805c', '#d8a47c'];
  const hairOf = {
    brown: ['#2e1c14', '#553420', '#7c5030', '#a87848'],
    black: ['#141018', '#28242e', '#403a48', '#605a6c'],
    blond: ['#7c5418', '#b8862c', '#e0b850', '#f8e090'],
    red: ['#4c1810', '#88301c', '#b8502c', '#e08050'],
    grey: ['#4c4c58', '#80808c', '#b0b0bc', '#e0e0e8'],
    white: ['#707084', '#a8a8b8', '#d8d8e4', '#ffffff'],
    auburn: ['#3c1c18', '#6c3424', '#9c5634', '#c88050'],
    green: ['#1c3c2c', '#2c6a44', '#48a060', '#88d090'],
  };

  const def = (type, spec, pal) => { N[type] = { spec, pal }; };

  const capeMain = { D: 'A', E: 'B', F: 'C' };
  def('king', () => ({
    capeBack: use(P.cape.long.back, { map: capeMain }), cape: use(P.cape.long, { map: capeMain }), body: P.body.robe,
    head: faceM(), hair: P.hairShort, beard: P.beard, hat: P.hat.crown,
  }), { main: '#c83838', sub: '#f4f0e4', trim: '#f0c030', hair: hairOf.grey, skin: skinA });
  def('queen', () => ({
    capeBack: use(P.cape.long.back, {}), cape: P.cape.long, body: P.body.dress,
    head: faceF(), hair: P.hairLong, hat: P.hat.tiara,
  }), { main: '#7040b0', sub: '#c83850', trim: '#f0c030', hair: hairOf.blond, skin: skinA });
  def('princess', () => ({
    body: P.body.dress, head: faceF(), hair: P.hairLong, hat: P.hat.tiara,
  }), { main: '#f080a8', sub: '#f8d8e0', trim: '#f0c830', hair: hairOf.blond, skin: skinA });
  def('minister', () => ({
    body: P.body.robe, head: faceM(), hair: P.hairShort, beard: P.mustache, hat: P.hat.official,
  }), { main: '#3c5c9c', sub: '#e0d0a0', trim: '#d8b040', hair: hairOf.grey, skin: skinA });
  def('soldier', () => ({
    body: P.body.fighter, head: faceM(), hair: use(P.hairShort, { clipY: 5 }), hat: P.hat.kettle, over: P.over.spear,
  }), { main: '#3c64b0', sub: '#9ca4b8', trim: '#e8c850', steel: '#a8b0c0', hair: hairOf.brown, skin: skinA, acc2: '#3c3a54' });
  def('knight', () => ({
    capeBack: use(P.cape.long.back, {}), cape: P.cape.long, body: P.body.armor,
    head: faceM(), hair: use(P.hairShort, { clipY: 6 }), hat: P.hat.plume,
  }), { main: '#b8c0cc', sub: '#b83838', trim: '#e0c050', hair: hairOf.black, skin: skinA });
  def('old_man', () => ({
    body: P.body.robe, head: faceM(), hair: P.hairBald, beard: P.beard, over: P.over.cane,
  }), { main: '#7a6a52', sub: '#b8a680', trim: '#5a4a3a', hair: hairOf.white, skin: skinA });
  def('old_woman', () => ({
    body: P.body.apron, head: faceF(), hair: P.hairBun, over: P.over.cane,
  }), { main: '#6a5a8a', sub: '#e0dccc', trim: '#8a7aa0', hair: hairOf.grey, skin: skinA });
  def('man', () => ({
    body: P.body.light, head: faceM(), hair: P.hairShort,
  }), { main: '#4a7ab8', sub: '#6a4a30', trim: '#e8dcb8', hair: hairOf.brown, skin: skinB, acc2: '#4a4238' });
  def('woman', () => ({
    body: P.body.apron, head: faceF(), hair: P.hairLong,
  }), { main: '#c05848', sub: '#f0ead8', trim: '#e8b860', hair: hairOf.auburn, skin: skinA });
  def('boy', () => ({
    body: P.body.kid, head: [kidPart(P.head), kidPart(P.face.boy)], hair: [kidPart(P.hairShort), kidPart(P.tuft)],
  }), { main: '#3ca050', sub: '#5a4a8a', trim: '#e0c040', hair: hairOf.brown, skin: skinB });
  def('girl', () => ({
    body: P.body.kidF, head: [kidPart(P.head), kidPart(P.face.gentle)], hair: kidPart(P.hairPig),
  }), { main: '#e88830', sub: '#f0e0c0', trim: '#f8f0d8', hair: hairOf.red, skin: skinA, acc: '#3c8ce0' });
  def('merchant', () => ({
    body: P.body.shop, head: faceM(), hair: use(P.hairShort, { clipY: 5 }), beard: P.mustache, hat: P.hat.cap,
  }), { main: '#3c8a58', sub: '#e8b048', trim: '#f0e0b0', hair: hairOf.black, skin: skinB, acc2: '#4a3c30' });
  def('innkeeper', () => ({
    body: P.body.shop, head: faceM(), hair: P.hairShort, beard: P.mustache,
  }), { main: '#b86a38', sub: '#f4f0e4', trim: '#e0c890', hair: hairOf.auburn, skin: skinA, acc2: '#4a3c34' });
  def('priest', () => ({
    body: P.body.robe, head: faceM(), hair: use(P.hairShort, { clipY: 6 }), hat: P.hat.mitre,
  }), { main: '#f0ece0', sub: '#8a3cb0', trim: '#e0b040', hair: hairOf.brown, skin: skinA });
  def('nun', () => ({
    body: P.body.robe, head: faceF(), hair: use(P.hairLong, { clipY: 13 }), hat: P.hat.veil,
  }), { main: '#2c2838', sub: '#e8e4f0', trim: '#f4f4f8', hair: hairOf.brown, skin: skinA });
  def('sage', () => ({
    body: P.body.robe, head: faceM(), hair: use(P.hairShort, { clipY: 6 }), beard: P.beard, hat: P.hat.hood, over: P.over.staff,
  }), { main: '#4a5aa0', sub: '#e0d8a8', trim: '#e8c040', hair: hairOf.white, skin: skinA });
  def('elder', () => ({
    body: P.body.robe, head: faceM(), hair: P.hairBald, beard: P.beard, over: P.over.staff,
  }), { main: '#5a7a4a', sub: '#e0d8b8', trim: '#d8b040', hair: hairOf.white, skin: skinA });
  def('sailor', () => ({
    body: P.body.sailor, head: faceM(), hair: use(P.hairShort, { clipY: 3 }), hat: P.hat.sailor,
  }), { main: '#f4f4f8', sub: '#3050a8', trim: '#3050a8', hair: hairOf.black, skin: skinB, acc2: '#2c3c78' });
  def('captain', () => ({
    body: P.body.coat, head: faceM(), hair: use(P.hairShort, { clipY: 5 }), beard: P.beardShort, hat: P.hat.tricorn,
  }), { main: '#26305c', sub: '#f0ecdc', trim: '#e8c040', hair: hairOf.black, skin: skinB, acc2: '#2c2c40', leather: '#3c2c24' });
  def('bandit', () => ({
    body: P.body.vest, head: faceM(), hair: use(P.hairWild, { clipY: 5 }), hat: P.hat.bandana, over: P.over.mask,
  }), { main: '#6a2a30', sub: '#50443c', trim: '#c8a868', hair: hairOf.black, skin: skinB, leather: '#5a3a24', acc2: '#3c3834' });
  def('elf', () => ({
    body: P.body.lightF, head: faceF(), hair: P.hairLong, over: P.over.elfEars,
  }), { main: '#3c9c5c', sub: '#8a6a3c', trim: '#f0e4a8', hair: hairOf.blond, skin: ['#dca47c', '#fcdcc0', '#fff4e8'], acc2: '#2c5c3c' });
  def('dwarf', () => ({
    body: P.body.dwarf, head: [kidPart(P.head), kidPart(P.face.boy)], hair: kidPart(use(P.hairShort, { clipY: 5 })),
    beard: kidPart(P.beard), hat: kidPart(P.hat.horned),
  }), { main: '#8a4a2a', sub: '#6a6a78', trim: '#e0b040', steel: '#9ca4b0', hair: hairOf.red, skin: skinB, acc2: '#4a3c30' });
  def('scholar', () => ({
    body: P.body.robe, head: faceM(), hair: use(P.hairShort, { clipY: 4 }), hat: P.hat.scholar, over: P.over.glasses,
  }), { main: '#3a3a4c', sub: '#8a2c3c', trim: '#e0c040', hair: hairOf.brown, skin: skinA, steel: '#c0c0cc' });
  def('dancer', () => ({
    body: P.body.dress, head: faceF(), hair: P.hairLong, hat: P.hat.circletVeil,
  }), { main: '#d84888', sub: '#f8c8e0', trim: '#f0c830', hair: hairOf.black, skin: skinB });
  def('demon', () => ({
    capeBack: use(P.cape.long.back, {}), cape: P.cape.long, body: P.body.robe,
    head: [P.head, { down: L(8, ['.....o....o.....', '.....o....o.....']), right: L(8, ['..........o.....', '..........o.....']) }],
    hair: P.hairWild, hat: P.hat.horns,
  }), { main: '#3c2448', sub: '#8a1c2c', trim: '#c8a040', hair: hairOf.black, skin: ['#5a3c7c', '#8a64a8', '#b090cc'], extra: { o: '#ff4030' } });

  N.spirit = { build: () => ghostly('spirit') };
  N.ghost = { build: () => ghostly('ghost') };
  N.cat = { build: () => animal('cat') };
  N.dog = { build: () => animal('dog') };

  // ------------------------------------------------------------ spirit / ghost
  // The spirit is a robed maiden in pale light with a glowing (non-dark)
  // outline and a pulsing halo; the ghost is a floating sheet.
  const GHOST = {
    down: [
      '....wwwwww......',
      '..wwWWWWWWww....',
      '.wWWWWWWWWWWw...',
      '.wWWWWWWWWWWVw..',
      'wWWWkkWWkkWWVw..',
      'wWWWkkWWkkWWVw..',
      'wWWWWWWWWWWVVw..',
      'wWWWWWkkWWWVVw..',
      'wWWWWWkkWWVVVw..',
      'wWWWWWWWWVVVw...',
      '.wWWWWWWWVVVw...',
      '.wWWVWWVVVVw....',
      '..wVwVVwVVw.....',
      '...w..w..w......',
    ],
    up: [
      '....wwwwww......',
      '..wwWWWWWWww....',
      '.wWWWWWWWWWWw...',
      '.wWWWWWWWWWWVw..',
      'wWWWWWWWWWWWVw..',
      'wWWWWWWWWWWWVw..',
      'wWWWWWWWWWWVVw..',
      'wWWWWWWWWWWVVw..',
      'wWWWWWWWWWVVVw..',
      'wWWWWWWWWVVVw...',
      '.wWWWWWWWVVVw...',
      '.wWWVWWVVVVw....',
      '..wVwVVwVVw.....',
      '...w..w..w......',
    ],
    right: [
      '....wwwwww......',
      '..wwWWWWWWww....',
      '.wWWWWWWWWWWw...',
      '.wWWWWWWWWWWWw..',
      'wWWWWWWWkkWkWw..',
      'wWWWWWWWkkWkWw..',
      'wWWWWWWWWWWWVw..',
      'wWWWWWWWWkkWVw..',
      '.wWWWWWWWWWVVw..',
      '..wWWWWWWWVVw...',
      '...wWWWWVVVw....',
      '..wWWVVVVVw.....',
      '.wVVwwVVww......',
      '.w....w.........',
    ],
  };

  function ghostly(kind) {
    const G = R.Gfx;
    if (kind === 'ghost') {
      const pal = { w: '#5a6ab0', W: '#e8f0ff', V: '#a8b8e8', k: '#283060' };
      const out = { down: [], up: [], left: [], right: [] };
      for (const dir of ['down', 'up', 'right']) {
        for (let f = 0; f < 2; f++) {
          const p = G.pix(16, 24);
          p.grid(1, 5 + (f ? -1 : 0), GHOST[dir], pal);
          // soft transparency so tiles show through a little
          p.each((x, y, c) => c + 'e0');
          // shadow on the ground
          for (let x = 5; x <= 10; x++) p.set(x, 22, '#00000040');
          out[dir].push(p.toCanvas());
        }
      }
      out.left = out.right.map((c) => G.flipH(c));
      return out;
    }
    // spirit: compose a dress figure, then relight it
    const pal = CA.palette({
      main: '#bfe8ff', sub: '#ffffff', trim: '#fff4b0', hair: ['#5aa8d0', '#8cd0f0', '#c0ecff', '#f4ffff'],
      skin: ['#b8dcf0', '#e4f6ff', '#ffffff'],
    });
    pal.e = '#2c6c9c';
    const spec = { body: P.body.dress, head: [P.head, P.face.gentle], hair: P.hairLong, hat: P.hat.tiara, bob: [0, -1] };
    const out = { down: [], up: [], left: [], right: [] };
    for (const dir of ['down', 'up', 'right']) {
      for (let f = 0; f < 2; f++) {
        const buf = CA.figure(spec, pal, dir, f);
        // glowing outline instead of the dark one, fading skirt, halo on frame 1
        for (let i = 0; i < buf.length; i++) {
          if (buf[i] === CA.OUTLINE) buf[i] = f ? '#80d8ff' : '#58b8f0';
          else if (buf[i] && Math.floor(i / 16) >= 20) buf[i] = buf[i] + '90';
          else if (buf[i]) buf[i] = buf[i] + 'e8';
        }
        const glow = f ? '#c8f0ff50' : '#a0e0ff38';
        const src = buf.slice();
        for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) {
          if (src[y * 16 + x]) continue;
          const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < 16 && yy < 24 && src[yy * 16 + xx];
          if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) buf[y * 16 + x] = glow;
        }
        out[dir].push(CA.toCanvas(buf));
      }
    }
    out.left = out.right.map((c) => G.flipH(c));
    return out;
  }

  // ------------------------------------------------------------ animals
  // 16x24 frames, animal standing on the bottom rows. c = coat, C = light, a = dark,
  // n = nose/pads, e = eye, w = white patch, t = tongue
  const CAT = {
    down: [[
      '..a.........a...',
      '..aa.......aa...',
      '..aCa.....aCa...',
      '..aCCcccccCCa...',
      '..cCCCCcccccc...',
      '..cCeCCccecca...',
      '..cCCCnncccca...',
      '...cCCwwccca....',
      '....acccccaa....',
      '....cCCccca.....',
      '...cCCcccca.....',
      '...cCwccwca.....',
      '...cc.cc.ca.....',
    ], [
      '..a.........a...',
      '..aa.......aa...',
      '..aCa.....aCa...',
      '..aCCcccccCCa...',
      '..cCCCCcccccc...',
      '..cCeCCccecca...',
      '..cCCCnncccca...',
      '...cCCwwccca....',
      '....acccccaa....',
      '....cCCccca.a...',
      '...cCCcccca.a...',
      '...cCwccwcaa....',
      '...cc..cc.a.....',
    ]],
    up: [[
      '..a.........a...',
      '..aa.......aa...',
      '..aca.....aca...',
      '..acccccccca....',
      '..ccCCCccccca...',
      '..cCCCCcccccc...',
      '..cCCCcccccca...',
      '...cCCcccaaa....',
      '....acccccaa....',
      '....cCCccca.....',
      '...cCCcccca.....',
      '...cCcccccaa....',
      '...cc.cc.ca.a...',
    ], [
      '..a.........a...',
      '..aa.......aa...',
      '..aca.....aca...',
      '..acccccccca....',
      '..ccCCCccccca...',
      '..cCCCCcccccc...',
      '..cCCCcccccca...',
      '...cCCcccaaa....',
      '....acccccaa....',
      '....cCCccca.....',
      '...cCCcccca.....',
      '...cCcccccaa....',
      '...cc..cc.aa....',
    ]],
    right: [[
      '.........a..a...',
      '.........aa.aa..',
      '.........cCccca.',
      '........cCCCeca.',
      '........cCCCccnn',
      '..a.....cCCwwca.',
      '..a......cccca..',
      '...a.cCCCCccca..',
      '...acCCCCCcccca.',
      '....cCCccccccca.',
      '....cca.cca.ca..',
      '....cc..cc..cc..',
      '................',
    ], [
      '.........a..a...',
      '.........aa.aa..',
      '.........cCccca.',
      '........cCCCeca.',
      '........cCCCccnn',
      '.a......cCCwwca.',
      '..a......cccca..',
      '...a.cCCCCccca..',
      '...acCCCCCcccca.',
      '....cCCccccccca.',
      '....acc.cc.cca..',
      '.....cc..cccc...',
      '................',
    ]],
  };
  const DOG = {
    down: [[
      '...aa......aa...',
      '..acca....acca..',
      '..accCCCCCCcca..',
      '..acCCCCCCCcca..',
      '...cCeCCCCecc...',
      '...cCCwwwwccc...',
      '....cwwnnwwc....',
      '....cwwttwwc....',
      '.....cwwwwc.....',
      '....acCwwCca....',
      '...acCCwwCcca...',
      '...acCCCCccca...',
      '...cc.cc.cc.....',
      '...ww.ww.cc.....',
    ], [
      '...aa......aa...',
      '..acca....acca..',
      '..accCCCCCCcca..',
      '..acCCCCCCCcca..',
      '...cCeCCCCecc...',
      '...cCCwwwwccc...',
      '....cwwnnwwc....',
      '....cwwwwwwc....',
      '.....cwwwwc.....',
      '....acCwwCca....',
      '...acCCwwCcca...',
      '...acCCCCccca...',
      '.....cc.cc.cc...',
      '.....cc.ww.ww...',
    ]],
    up: [[
      '...aa......aa...',
      '..acca....acca..',
      '..accCCCCCCcca..',
      '..acCCCCCCCcca..',
      '...cCCCCCCccc...',
      '...cCCCCCCccc...',
      '....cCCCCccc....',
      '....acccccca....',
      '...acCCCCccca...',
      '...acCCCCccca...',
      '...acCCCCcccaa..',
      '....acCCccaaa...',
      '...cc.cc.cc.....',
      '...ww.ww.cc.....',
    ], [
      '...aa......aa...',
      '..acca....acca..',
      '..accCCCCCCcca..',
      '..acCCCCCCCcca..',
      '...cCCCCCCccc...',
      '...cCCCCCCccc...',
      '....cCCCCccc....',
      '....acccccca....',
      '...acCCCCccca...',
      '...acCCCCccca...',
      '..aacCCCCccca...',
      '...aaaCCccca....',
      '.....cc.cc.cc...',
      '.....cc.ww.ww...',
    ]],
    right: [[
      '................',
      '..........aa....',
      '.........acca...',
      '........acCCcc..',
      '........cCCCecc.',
      '........cCCCcwwn',
      '.a.......ccwwww.',
      '..a.....aCcwwt..',
      '..acCCCCCCCcca..',
      '...cCCCCCCCccc..',
      '...cCCcccccccc..',
      '...cc.cc..cc.cc.',
      '...ww.cc..ww.cc.',
      '................',
    ], [
      '................',
      '..........aa....',
      '.........acca...',
      '........acCCcc..',
      '........cCCCecc.',
      '........cCCCcwwn',
      '..a......ccwwww.',
      '..a.....aCcwww..',
      '..acCCCCCCCcca..',
      '...cCCCCCCCccc..',
      '...cCCcccccccc..',
      '....cc.cc.cc....',
      '....ww.ww.ww....',
      '................',
    ]],
  };
  function animal(kind) {
    const G = R.Gfx;
    const src = kind === 'cat' ? CAT : DOG;
    const pal = kind === 'cat'
      ? { c: '#e89a48', C: '#fcc888', a: '#a85c28', n: '#e87888', e: '#1c1830', w: '#fff4e4', t: '#e05060' }
      : { c: '#c8a070', C: '#ecd0a4', a: '#80603c', n: '#2c2024', e: '#1c1830', w: '#fff8ec', t: '#e05060' };
    const out = { down: [], up: [], left: [], right: [] };
    for (const dir of ['down', 'up', 'right']) {
      for (let f = 0; f < 2; f++) {
        const buf = new Array(16 * 24).fill(null);
        const g = src[dir][f];
        let last = g.length - 1;
        while (last > 0 && !/[^.]/.test(g[last])) last--;
        CA.stamp(buf, { y: 22 - last, g }, pal, false, 0);
        CA.outline(buf, CA.OUTLINE);
        out[dir].push(CA.toCanvas(buf));
      }
    }
    out.left = out.right.map((c) => G.flipH(c));
    return out;
  }
})(window.RPG);
