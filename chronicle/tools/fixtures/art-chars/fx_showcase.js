// art-chars (A13) showcase fixture: a town square with every NPC type of
// CA.NPC_TYPES, both chest looks, a rest lantern and the fading girl, for the
// in-game check of the field sprites through the real field renderer:
//   node tools/build.js --with tools/fixtures/art-chars      → debug_art-chars.html
//   node tools/shot.js --html debug_art-chars.html --eval "RPG.debug.quickStart({map:'a13_square', spawn:'entrance', companions:['selma','zafira','dokka']})" --out x.png
// Never part of the game build.
(function (R) {
  'use strict';
  const DB = R.DB;
  const W = 34, H = 24;
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 'T' : x < 2 || y < 2 || x > W - 3 || y > H - 3 ? ',' : ':')));
  for (let x = 3; x < W - 3; x += 6) g[11][x] = 'f';
  g[20][16] = ':'; g[H - 1][16] = ':'; g[H - 1][17] = ':';
  const rows = g.map((r) => r.join(''));
  const types = (R.Art && R.Art.Chars && R.Art.Chars.NPC_TYPES) || [];
  const npcs = types.map((t, i) => ({
    id: 'a13_' + t, x: 3 + (i % 16) * 2 - (Math.floor(i / 16) % 2), y: 3 + Math.floor(i / 16) * 3,
    sprite: 'npc:' + t, dir: ['down', 'left', 'right', 'down'][i % 4], fixed: true, text: t,
  }));
  npcs.push({ id: 'rest', x: 22, y: 13, sprite: 'obj:lantern', dir: 'down', fixed: true, text: '休息の灯' });
  DB.maps.a13_square = {
    name: '人物の広場', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
    region: 'prologue', outside: 'T',
    rows,
    spawns: { entrance: { x: 16, y: 18, dir: 'up' }, square: { x: 16, y: 13, dir: 'up' } },
    npcs,
    chests: [{ id: 'a13_square_c1', x: 12, y: 13, pool: 'p_supply' }, { id: 'a13_square_c2', x: 14, y: 13, pool: 'p_rare' }],
    exit: { to: 'a13_square', spawn: 'entrance' },
  };
})(window.RPG);
