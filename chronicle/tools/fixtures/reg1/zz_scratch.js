// R1 scratch map for art experiments (fixture only)
(function (R) {
  const rows = [
      '########################',
      '#......#rrrr#llll#BBBB##',
      '#......#rrrr#llll#BBBB##',
      '#......#....#....#....##',
      '#......#....#....#....##',
      '###..######.###.####.###',
      '#......................#',
      '#..S..s..l..r..i#..a...#',
      '#......................#',
      '########################',
    ];
  R.DB.maps.r1_test = { name: 'test', type: 'dungeon', theme: 'tree', outside: '#', location: 'verda_maze', region: 'r_forest',
    rows, spawns: { entrance: { x: 1, y: 8 } } };
  R.DB.maps.r1_test2 = Object.assign({}, R.DB.maps.r1_test, { theme: 'forest' });
})(window.RPG);
