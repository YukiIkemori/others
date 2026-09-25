// Art review fixtures for tools/sheet_tiles.js (never part of the game build):
// a sample overworld region, a fake town / castle / dungeons, and the object
// list shown on every theme floor.
(function () {
  'use strict';
  const world = [
    {
      name: 'world: temperate continent, coasts, forest, mountains, bridge, reefs',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~~bbb~~~~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~',
        '~~~b...bbb~~~~~~~~~~~~~~~~~~~~^^~~~~~~~~~~~~~~~~',
        '~~b..TTT..b~~~~~.....~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~b.TTTTTT.~~~~..TTT..~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~.TTTTTTT....TTTTTTT..MMM~~~~~~~~~~~~~~~~~~~~~',
        '~~~..TTTTT..nn.TTTTTT..MMMMM.~~~~~~~~~~~~~~~~~~~',
        '~~~~..TT...nnnn..TTT..MMMMMMM..~~~~~~~~~~~~~~~~~',
        '~~~~~.....C...nn.....MMMMMMMMM..~~~~~~~~~~~~~~~~',
        '~~~~~~..........V....MMMMMMMM....~~~~~~~~~~~~~~~',
        '~~~~~~~..,,,,,.......MMMMMMM..O...~~~~~~~~~~~~~~',
        '~~~~~~~~.,,,,,,.nn....MMMM........~~~~~~~~~~~~~~',
        '~~~~~~~~~.,,,,..nnn......TT..v.....~~~~~~~~~~~~~',
        '~~~~~~~~~~..........TT..TTTT.......~~~~~~~~~~~~~',
        '~~~~~~~~~~~.....=====TTTTTTTT.....~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~....~~~~~~TTTTTT.....~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~..~~~~~~~~.TT.......~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~.........|~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~.......|~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~...A~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
    },
    {
      name: 'world: desert, snow, swamp, wasteland/volcano, barrier island',
      legend: 'world',
      rows: [
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
        '~~~dddddddd~~~~~~~~***ff***~~~~~~~~~~~~~~~~~~~~~',
        '~~ddddddddddd~~~~~*ffff****MM*~~~~~~wwwwww~~~~~~',
        '~~ddddMMdddddd~~~**fff**v**MMM*~~~~ww~~~~ww~~~~~',
        '~~dddMMMddPdddd~~~***I****MMMM*~~~ww~kkk~~ww~~~~',
        '~~ddddddddddVdd~~~****ff*****~~~~~w~kkXkk~~w~~~~',
        '~~~dddddnnddddd~~~~~****fff**~~~~~w~kkkkk~~w~~~~',
        '~~~~dddddddddd~~~~~~~~~~~~~~~~~~~~ww~kkk~~ww~~~~',
        '~~~~~ddddddd..xxx~~~~~~~~~~~~~~~~~~ww~~~~ww~~~~~',
        '~~~~~~~~dd....xxxx.~~~~~kkkkkk~~~~~~wwwwww~~~~~~',
        '~~~~~~~~~..TT.xxx..~~~kkkkMMkkk~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~.TTTT.x..~~~kkLLkMMkkk~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~..TT..H..~~~kLLLLkkYkk~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~.......~~~~kkLLkkkkk~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~...~~~~~~~kkkkk~~~~~~~~~~~~~~~~~~~~',
        '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      ],
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

  window.SAMPLES = { world, town, objects };
})();
