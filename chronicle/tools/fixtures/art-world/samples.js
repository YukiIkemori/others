// Art review fixtures for tools/sheet_tiles.js (never part of the game build). Owner: A16a.
// World samples use the world legend of src/data/tiles_world.js (§11.11.2):
//   ~ sea  ^ reef  g fog  u river  . grass  , plain  r road  b beach  d desert  z sandstorm
//   * snow  m marsh  e marsh_fog  x swamp  k wasteland  a ash  L magma  T forest  f snowforest
//   j jungle  t deadforest  n hills  M mountain  c cliff  o ruins  % secret_forest  & secret_rock
//   = bridge_h  | bridge_v   C V v W O N G I U A H Q P Y X  location icons
// `actors` stand people on cells (contrast check, §11.2.2); `anim` is the crop [x,y,w,h]
// used by --only anim. The town / object samples are Crest's (for --only themes,town).
(function () {
  'use strict';
  const world = [
    {
      name: 'temperate: forest mass, roads & bridge, layered ranges, river to the sea, cliffs, ruins, hidden forest path (%)',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^~~~~',
        '~~~~bbbb~~~~~~~~~~~~MMMMMM~~~~~~~~~~~~^^~~~~',
        '~~~b....bb~~~~~~~~MMMMMMMMMM~~~~~~~~~~~~~~~~',
        '~~b..TTTT..b~~~~~.MMMMMMMMMMMM..~~~~~~~~~~~~',
        '~~b.TTTTTTTT.~~~..nMMMMMMMMMMMn...~~~~~~~~~~',
        '~~~.TTTTTTTTT...,,nnMMMuMMMMMn.....~~~~~~~~~',
        '~~~..TTTTTTT%T.,,,,,nMMuMMMMn...o...~~~~~~~~',
        '~~~~..TTTTTTT.,,,,,,,nnunnn..........~~~~~~~',
        '~~~~~..TTTT..V,,,,,,,,,u.......O.....~~~~~~~',
        '~~~~~~...rrrrrrrrrrrrrr=rrrrrrrrrrr...~~~~~~',
        '~~~~~~~..,,r,,,,,,,,,,,u..........r...~~~~~~',
        '~~~~~~~~.,,r,,,,,......u...TTTT...r...~~~~~~',
        '~~~~~~~~~..r...cccc....u..TTTTTT..v....~~~~~',
        '~~~~~~~~~~.r...n..n....uu..TTTT........~~~~~',
        '~~~~~~~~~~.rr...........uu...........MM~~~~~',
        '~~~~~~~~~~~.r............uu.......A..MMM~~~~',
        '~~~~~~~~~~~~r.............u........MMMMcc~~~',
        '~~~~~~~~~~~~I~~~~~~~~~~~~~u~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      actors: [[13, 10, 'party:hero_m_warrior'], [15, 10, 'npc:man'], [20, 11, 'npc:woman'], [26, 10, 'npc:soldier'], [9, 11, 'npc:old_man'], [6, 9, 'npc:girl'], [36, 12, 'npc:merchant']],
    },
    {
      name: 'desert with sandstorm around the tomb, road, snowfield with pines, snowy peaks, hidden rock passage (&)',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~dddddddddd~~~~~~~~***ff****MMM*~~~~~~~~~~',
        '~~dddddzzzdddd~~~~~~**ffff***MMMMM**~~~~~~~~',
        '~~dddnzzPzzddddd~~~***fff*v*MMMMMMM***~~~~~~',
        '~~dddzzzzzzdrrrrr~~~****rrr***MMMMM&M**~~~~~',
        '~~ddddzzzzzddr.,~~~***rrr*ff***MMMMMM**~~~~~',
        '~~~dddddddddrr,,~~~**rr***fff*****O*****~~~~',
        '~~~~ddddVrrrr,,,,,..rr******f***********~~~~',
        '~~~~~dddddd,,,,,,,,.r.,,,***************~~~~',
        '~~~~~~ddd...,,,,,,,,r,,,,,,,,****~~~~~~~~~~~',
        '~~~~~~~~bb..,,,,,,,,v,,,,,,,,,~~~~~~~~~~~~~~',
        '~~~~~~~~~~~bbbb~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      actors: [[10, 7, 'npc:man'], [21, 6, 'npc:old_woman'], [23, 8, 'npc:soldier']],
    },
    {
      name: 'marsh with marsh fog, dead trees, manor, poison mire; ash plain with magma, volcano, ash town',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~mmmmmmmmmm~~~~~~~~~~kkkkkkkaaaaaa~~~~~~~',
        '~~~mmmeeeeemmmm~~~~~~~kkkkkaaaaaaMMaaa~~~~~~',
        '~~mmmeeQeeeettmm~~~~~kkkkaaaLLLaaMMMaa~~~~~~',
        '~~mmmeeeeeeettmmm~~~~kkkaaaaLLLLaaYaaaa~~~~~',
        '~~mmmmeeetttmmmmmm~~~kkaaaaaaLLaaaaaaaa~~~~~',
        '~~~mmmmmmxxxmmmTTmm~~kkkaaaaaaaaaVaaaaa~~~~~',
        '~~~~mmmrmxxxxmTTTTm=rrrrrrraaaaaarraaaa~~~~~',
        '~~~~mmmrmmxxmmmTTmm~~kkkkkaaaaaaaaaaa~~~~~~~',
        '~~~~~mVrrrrmmmmmmm~~~~kkkkkkaaaaaaaa~~~~~~~~',
        '~~~~~~mmmmmmmmmmm~~~~~~~kkkkkkkkk~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      actors: [[7, 9, 'npc:man'], [10, 7, 'npc:woman'], [26, 7, 'npc:soldier'], [33, 7, 'npc:old_man']],
    },
    {
      name: 'isles: jungle island with a port and reefs; the fog ring around the library island',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~ggggggggg~~~~~~~~~',
        '~~~~bbbbbb~~~~~~~~~~~~~~ggggggggggggg~~~~~~~',
        '~~~bjjjjjjbb~~~^~~~~~~~ggggg....ggggg~~~~~~~',
        '~~bjjjjjjjj.b~~^^~~~~~gggg..TTT..gggg~~~~~~~',
        '~~bjjjjjjj...b~~~~~~~~ggg..TT.U..ggggg~~~~~~',
        '~~~bjjjj...W.b~~~~~~~~gggg..rrr..gggg~~~~~~~',
        '~~~~bb.....bb~~~~~~~~~~gggg..V..gggg~~~~~~~~',
        '~~~~~~bbbbb~~~~~^~~~~~~~ggggbbbggggg~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~ggggggggg~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
      anim: [20, 0, 20, 10],
      actors: [[9, 6, 'npc:sailor'], [30, 6, 'npc:scholar']],
    },
  ];

  const town = [
    {
      name: 'town (theme town): walls, houses with roofs, shop interior, inn, church, well, trees, flowers',
      legend: 'local', theme: 'town',
      rows: [
        '##########################',
        '#TTTTTTTTTT,,,TTTTTTTTTTT#',
        '#T,,,f,,,,,,:,,,,,,f,,,,T#',
        '#T,RRRRRR,,,:,,,RRRRRR,,T#',
        '#T,RRRRRR,,,:,,,RRRRRR,,T#',
        '#T,BBBDBB,,,:,,,BBDBBB,,T#',
        '#T,,,,:,,,,,:,,,,,:,,,,,T#',
        '#T,,,,::::::::::::::,,,,T#',
        '#T,f,,,,,,,,:,,,m,,,,,f,T#',
        '#T,,BBBBBBB,:,,BBBBBBB,,T#',
        '#T,,B_uuu_B,:,,B+++++B,,T#',
        '#T,,B_____B,W,,B+lal+B,,T#',
        '#T,,Bcccc_B,:,,B+++++B,,T#',
        '#T,,B__op_B,:,,B+hth+B,,T#',
        '#T,,BBBDBBB,:,,BBBDBBB,,T#',
        '#T,,,,,:::::::::::,,,,,,T#',
        '#T,g,g,,,,,,:,,,,,FFFFF,T#',
        '#T,,,,,,Y,,,:,,,,,F,,,F,T#',
        '#TTTTTTTTTT,:,TTTTTTTTTTT#',
        '###########D:D############',
      ],
    },
    {
      name: 'castle (theme castle): throne room, pillars, carpet, torches, stairs',
      legend: 'local', theme: 'castle',
      rows: [
        '#####i#####i#####i######',
        '#k.k#...........#bb..b.#',
        '#...#.l..+K+..l.#bb..b.#',
        '#...#....+++....#......#',
        '#.S.#.l..+++..l.#..t...#',
        '#...D....+++....D......#',
        '#####.l..+++..l.###D####',
        '#p.o#....+++....#......#',
        '#...D....+++....D..s...#',
        '#.j.#.l..+++..l.#......#',
        '#####i###D+D###i########',
      ],
    },
    {
      name: 'cave (theme cave): rock walls, water, bridge, stairs, chest room, silver door',
      legend: 'local', theme: 'cave',
      rows: [
        '######################',
        '#....i######......####',
        '#.S......###..r.......#',
        '##....r..###...~~~~...#',
        '###.......=====~~~~.s.#',
        '##..~~~~..###..~~~~...#',
        '#...~~~~..#####.......#',
        '#.........#####1#######',
        '###...#####...........#',
        '#....p#....o...q...P..#',
        '######################',
      ],
    },
    {
      name: 'dungeons: pyramid | ice | volcano | tower | shrine | demon (each 8x8)',
      legend: 'local', theme: 'pyramid',
      rows: [
        '########',
        '#i#..#i#',
        '#..l...#',
        '#.S..s.#',
        '#...2..#',
        '#.p..P.#',
        '#..C...#',
        '###D####',
      ],
    },
  ];
  // extra theme samples share the pyramid layout
  for (const t of ['ice', 'volcano', 'tower', 'shrine', 'demon', 'water', 'fort', 'house']) {
    town.push({ name: 'theme ' + t, legend: 'local', theme: t, rows: town[3].rows.map((r, i) =>
      i === 5 && t === 'volcano' ? '#.pLL.P#' : i === 5 && t === 'water' ? '#.p~~.P#' : i === 5 && t === 'demon' ? '#.3xx.P#' : r) });
  }

  const objects = ['counter', 'table', 'chair', 'bed', 'bookshelf', 'shelf', 'pot', 'barrel', 'crate', 'throne',
    'altar', 'statue', 'sign', 'well', 'grave', 'pedestal', 'warp_pad', 'seal', 'pit', 'tree', 'fence', 'flowers', 'carpet', 'water', 'lava', 'poison'];

  window.SAMPLES = Object.assign(window.SAMPLES || {}, { world, town, objects });
})();
