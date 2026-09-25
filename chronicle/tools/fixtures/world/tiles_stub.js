// Stand-in world tiles for the world checks (A18a). Real definitions: src/data/tiles_world.js (A16a).
// Loaded after the sources by tools/check_world.js and tools/test_world.js (and built into
// debug_world.html). It only FILLS IN what is missing (so the checks run while the art-world file
// is absent or broken); it never overrides a definition that exists. §11.2.3, §11.11.2.
(function (R) {
  'use strict';
  const TILES = {
    road: { name: '街道', pass: true, enc: 0.5, bbg: 'grass' },
    marsh: { name: '湿地', pass: true, enc: 1.2, bbg: 'swamp' },
    ash: { name: '灰の地', pass: true, enc: 1.2, bbg: 'wasteland' },
    fog: { name: '白い霧', pass: false, ship: false, anim: 4 },
    sandstorm: { name: '砂嵐の砂漠', pass: true, enc: 1.3, bbg: 'desert', anim: 4 },
    marsh_fog: { name: '霧の湿地', pass: true, enc: 1.3, bbg: 'swamp', anim: 2 },
    jungle: { name: '密林', pass: true, enc: 1.3, bbg: 'forest' },
    deadforest: { name: '枯れ木の森', pass: true, enc: 1.3, bbg: 'swamp' },
    river: { name: '川', pass: false, ship: false, anim: 4 },
    cliff: { name: '崖', pass: false },
    ruins: { name: '遺跡', pass: true, enc: 1.0, bbg: 'grass' },
    secret_forest: { name: '森', pass: true, enc: 1.3, bbg: 'forest', secret: true },
    secret_rock: { name: '岩山', pass: true, enc: 1.2, bbg: 'hills', secret: true },
    loc_forest: { name: '森の入口', pass: true, enc: 0, warpIcon: true },
    loc_manor: { name: '館', pass: true, enc: 0, warpIcon: true },
    loc_library: { name: '大書庫', pass: true, enc: 0, warpIcon: true },
    loc_port: { name: '港町', pass: true, enc: 0, warpIcon: true },
    loc_mine: { name: '坑道', pass: true, enc: 0, warpIcon: true },
  };
  const LEGEND = {
    r: 'road', m: 'marsh', a: 'ash', g: 'fog', z: 'sandstorm', e: 'marsh_fog', j: 'jungle', t: 'deadforest', u: 'river',
    c: 'cliff', o: 'ruins', G: 'loc_forest', Q: 'loc_manor', U: 'loc_library', W: 'loc_port', N: 'loc_mine', '%': 'secret_forest', '&': 'secret_rock',
  };
  function fill() {
    for (const id in TILES) if (!R.DB.tiles[id]) R.DB.tiles[id] = Object.assign({}, TILES[id]);
    const leg = R.DB.legends.world = R.DB.legends.world || {};
    for (const ch in LEGEND) if (!leg[ch]) leg[ch] = LEGEND[ch];
  }
  fill();
  R.onData(fill);
})(window.RPG);
