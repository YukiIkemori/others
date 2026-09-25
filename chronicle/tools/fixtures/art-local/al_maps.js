// art-local (A16b) review maps: a port town on the isles theme (houses with the
// regional roofs, a tavern and a shop at DQ5 density with the new decor, a beach
// with palms, nets and boats), a mine gallery (timbering, rails, a cart, closed
// tiles, a secret passage) and a ghost-ship deck. Loaded only through
// `node tools/build.js --with tools/fixtures/art-local` → debug_art-local.html:
//   node tools/shot.js --html debug_art-local.html \
//     --eval "RPG.debug.quickStart({map:'al_town', spawn:'entrance', noEncounter:true})" --out x.png
// Any town theme can be swapped in: RPG.DB.maps.al_town.theme = 'town_snow' before quickStart.
(function (R) {
  'use strict';
  const DB = R.DB;
  const npc = (id, sprite, x, y, o) => Object.assign({ id, sprite: 'npc:' + sprite, x, y, dir: 'down', text: '……。', fixed: true }, o || {});

  // ---------------------------------------------------------------- the port town (30×24)
  DB.maps.al_town = {
    name: '港町（試験）', type: 'town', legend: 'local', theme: 'town_isle', bgm: 'town', outside: 'T',
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T,,,RRRRRRR,,,,,,,,,RRRRRRR,,T',
      'T,,,RRRRRRR,,f,,f,,,RRRRRRR,,T',
      'T,,,BBBDBBB,,,,,,,,,BBBDBBB,,T',
      'T,,,,,,.,,,,,,,,,,,,,,,.,,,,,T',
      'T,,.......................,,,T',
      'T,,...........W...........,,,T',
      'T,,,,,,,,,,,,...,,,,,,,,,,,,,T',
      'T##########D###,,#####D####,,T',
      'T#____________#,,#________#,,T',
      'T#____________#,,#________#,,T',
      'T#____________#,,#________#,,T',
      'T#____________#,,#cccc____#,,T',
      'T#____________#,,#________#,,T',
      'T##############,,##########,,T',
      'Tddddddddddddddddddddddddddd,T',
      'Tdddddddddddddddd__dddddddddd,',
      '~~~~~~~~~~~~~~~~~__~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~__~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '..............................',
      '..............................',
      '..............................',
      '....w....w............w...w...',
      '...3..7....1......1...3.4.h...',
      '........`.....................',
      '.......]..................(...',
      '..........j..."...............',
      '..H.$.w.[...H....k.}.w.[......',
      '..N.......0000....Z.....>.....',
      '..........0000....q.....v.U...',
      '.......n.T.n.......&&.........',
      '...&&....n....................',
      '..Q.n.T.n....Z..........%.....',
      '..............................',
      '.)..|...)..,.......)...|....).',
      '..............................',
      '...:.........................:',
      '..........:...................',
      '..............................',
    ],
    decorLegend: { '|': 'net_rack', ':': 'boat', ',': 'rope_coil', '"': 'arch_over', '`': 'leaves_over' },
    spawns: { entrance: { x: 14, y: 5, dir: 'down' }, tavern: { x: 7, y: 12, dir: 'up' }, beach: { x: 12, y: 15, dir: 'right' }, arch: { x: 14, y: 7, dir: 'down' } },
    npcs: [
      npc('bart', 'bartender', 3, 9), npc('dancer', 'dancer', 11, 9), npc('sailor1', 'sailor', 9, 12, { dir: 'left' }),
      npc('shop', 'merchant', 20, 11), npc('woman', 'woman', 18, 5, { move: 'wander' }), npc('fisher', 'sailor', 22, 16, { dir: 'up' }),
    ],
  };
  // counter row in the tavern (tile layer): the bar
  DB.maps.al_town.rows[11] = 'T#cccc________#,,#________#,,T';

  // ---------------------------------------------------------------- the mine gallery (26×14)
  DB.maps.al_mine = {
    name: '坑道（試験）', type: 'dungeon', legend: 'local', theme: 'mine', bgm: 'cave', outside: '#',
    rows: [
      '##########################',
      '#i###E####O######i###%####',
      '#........................#',
      '#.l.......l.......l......#',
      '#........................#',
      '#####%#######.############',
      '#......#.........#.......#',
      '#......#.........#...V...#',
      '#..S...%.........I.......#',
      '#......#.........#.......#',
      '#......#.........#...s...#',
      '##########################',
    ],
    decor: [
      '..........................',
      '..............@...........',
      '.@....................@...',
      '..........................',
      '.--------------------.....',
      '.............-............',
      '.............-.....|......',
      '..|..........-............',
      '.............-/...........',
      '.......................|..',
      '..........................',
      '..........................',
    ],
    decorLegend: { '|': 'ore_pile' },
    spawns: { entrance: { x: 3, y: 2, dir: 'down' }, gallery: { x: 11, y: 8, dir: 'up' } },
    npcs: [npc('miner', 'dwarf', 5, 7)],
  };

  // ---------------------------------------------------------------- the ghost-ship deck (22×14)
  DB.maps.al_ship = {
    name: '甲板（試験）', type: 'dungeon', legend: 'local', theme: 'ship', bgm: 'dungeon', outside: '~',
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~',
      '~####################~',
      '~#..................#~',
      '~#..................#~',
      '~#.o................#~',
      '~#..................#~',
      '~#..................#~',
      '~#.j..........S.....#~',
      '~#..................#~',
      '~#i####D####%######i#~',
      '~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '......................',
      '......................',
      '..|...+.......+....|..',
      '.........:............',
      '..N...........,.......',
      '..............=.......',
      '.....@...=............',
      '....|.............|...',
      '..........,...........',
      '......................',
      '......................',
    ],
    decorLegend: { '|': 'cannon', ':': 'helm_wheel', ',': 'rope_coil' },
    spawns: { entrance: { x: 10, y: 5, dir: 'down' } },
    npcs: [],
  };
})(window.RPG);
