// R3 fixture: a tile/decor sampler map per theme (visual reference only; never in src/).
(function (R) {
  'use strict';
  const rows = [
    'TTTTTTTTTTTTTTTTTTTT',
    'T....**..ee..,,..::T',
    'T....**..ee..,,..::T',
    'T.BBBBBB..RRRRRR...T',
    'T.BBBBBB..RRRRRR...T',
    'T.B____B..RRRRRR...T',
    'T.B_th_B..BBBBBB...T',
    'T.BBBDBB..BBDBBB...T',
    'T...................T'.slice(0, 20),
    'T..##i##..#IIE#O#..T',
    'T..#...#..#.%.#....T',
    'T..#.s.#..#rlp#....T',
    'T..#####..#####....T',
    'TTTTTTTTTTTTTTTTTTTT',
  ];
  const decor = [
    '....................',
    '..;..%...^..u..J....',
    '...(...]..M.h..E....',
    '....................',
    '..^.^.^.............',
    '...F.K...w..........',
    '....................',
    '.......7.......4....',
    '..;;..%%..hh..1122..',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
  ];
  for (const th of ['town_snow', 'ice', 'snow']) {
    R.DB.maps['r3t_' + th] = { name: th, type: th.startsWith('town') ? 'town' : 'dungeon', theme: th, outside: 'T', rows, decor, spawns: { entrance: { x: 5, y: 8, dir: 'down' } } };
  }
})(window.RPG);
