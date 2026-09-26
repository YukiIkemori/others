// art-local (A16b) review map: the ground of the regional towns. A block of a snow
// village painted with snow ground ('*') — trees, fences, a pond with a bridge, a
// lawn corner, a house, snowpiles and firewood. The same rows are reused for a
// desert town ('d' ground, town_sand) and an ash town (':' dirt, town_ash) by
// swapping the theme and ground char:
//   node tools/shot.js --html debug_art-local.html \
//     --eval "RPG.debug.quickStart({map:'al_snowtown', spawn:'entrance', noEncounter:true})" --out x.png
(function (R) {
  'use strict';
  const DB = R.DB;
  const rows = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T****RRRRRRR*********TT******T',
    'T****RRRRRRR**T**************T',
    'T****BBBDBBB*****,,,,,*******T',
    'T*******.*******,,f,,,,***T**T',
    'T*******.........,,,,,*******T',
    'T**T****.****..*****.*****~~~T',
    'T*******.****.*FFFFF.****~~~~T',
    'T*******.****.*.....*.**~~~~~T',
    'T*******......==.......*~~~~*T',
    'T****T*******.******FFF*****TT',
    'T************.***************T',
    'TTTTTTTTTTTTT.TTTTTTTTTTTTTTTT',
  ];
  const decor = [
    '..............................',
    '..............................',
    '..............................',
    '...;...........%..............',
    '......................;.......',
    '..;.......]...................',
    '.......;..........;...........',
    '..............................',
    '....%.......................;.',
    '..........;...........;.......',
    '..............................',
    '..;.................;.........',
    '..............................',
  ];
  const mk = (name, theme, ground, outside, dec) => ({
    name, type: 'town', legend: 'local', theme, bgm: 'village', outside,
    rows: rows.map((r) => r.replace(/\*/g, ground)),
    decor: dec || decor,
    spawns: { entrance: { x: 13, y: 11, dir: 'up' }, east: { x: 22, y: 8, dir: 'right' } },
    npcs: [],
  });
  DB.maps.al_snowtown = mk('雪の村（試験）', 'town_snow', '*', 'T');
  DB.maps.al_sandtown = mk('砂の町（試験）', 'town_sand', 'd', 'd', decor.map((r) => r.replace(/;/g, ')')));
  DB.maps.al_ashtown = mk('火の町（試験）', 'town_ash', ':', 'T', decor.map((r) => r.replace(/;/g, '_')));
  // the forest maze (theme forest, outside 'T', DESIGN §10.6.2-10): trees on the forest floor
  DB.maps.al_forestout = {
    name: '迷いの森（試験）', type: 'dungeon', legend: 'local', theme: 'forest', bgm: 'forest', outside: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTT',
      'T......TT........T',
      'T..T.......###...T',
      'T.....TTT..#i#.T.T',
      'T..............~~T',
      'TT...T...T....~~~T',
      'T................T',
      'TTTTTTTT..TTTTTTTT',
    ],
    decor: [
      '..................',
      '..*...........*...',
      '.........*........',
      '..................',
      '....*.............',
      '..................',
      '...........*......',
      '..................',
    ],
    spawns: { entrance: { x: 8, y: 6, dir: 'up' } },
    npcs: [],
  };
})(window.RPG);
