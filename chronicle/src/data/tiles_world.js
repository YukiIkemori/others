// Overworld tile definitions and the world legend (DESIGN §11.2.3, §11.11.2,
// §10.5.3, §3.3.10-11). Owner: art-world (A16a). The art is src/art/tiles_world.js.
//
// Load order: this file sorts BEFORE src/data/tiles.js (localeCompare puts
// "tiles_world.js" ahead of "tiles.js"), and tiles.js still assigns the Crest
// world entries and replaces R.DB.legends.world / R.MARK_CHARS_WORLD. So the
// table below is applied twice: once now (so the file works on its own) and
// again in an R.onData hook, which runs after every file has loaded (main.js
// before boot, tools/lib/load.js after loading). The hook wins.
//
// Tile props (same meaning as src/data/tiles.js):
//   pass, ship, enc (encounter multiplier, 0 = none), bbg (battle backdrop),
//   anim (distinct animation images the art provides), warpIcon (location icon),
//   flagPass / shipWhenFlag, damagePct (% of max HP per step, §3.3.10-10),
//   secret (hidden passage: looks like its neighbours, walkable, §3.3.10-11).
// Frame timing: the field shows frame floor(t / 16) % frames.length. The fog's
// 4 images change every 32 frames, so its art returns 8 entries (each image
// twice) while the sea underneath still steps every 16 frames.
(function (R) {
  'use strict';

  const WORLD = {
    // ---------------------------------------------------- water
    sea:        { name: '海',       pass: false, ship: true, enc: 1.0, bbg: 'sea', anim: 4 },
    reef:       { name: '岩礁',     pass: false, ship: false },
    barrier:    { name: '魔の渦',   pass: false, ship: false, flagPass: 'barrier_broken', shipWhenFlag: true, anim: 4 }, // Crest; unused, kept registered
    fog:        { name: '白い霧',   pass: false, ship: false, anim: 4 },
    river:      { name: '川',       pass: false, ship: false, anim: 4 },
    // ---------------------------------------------------- ground
    grass:      { name: '草原',     pass: true, enc: 1.0, bbg: 'grass' },
    plain:      { name: '平原',     pass: true, enc: 0.9, bbg: 'grass' },
    road:       { name: '街道',     pass: true, enc: 0.5, bbg: 'grass' },
    beach:      { name: '砂浜',     pass: true, enc: 0.9, bbg: 'beach' },
    desert:     { name: '砂漠',     pass: true, enc: 1.1, bbg: 'desert' },
    sandstorm:  { name: '砂嵐の砂漠', pass: true, enc: 1.3, bbg: 'desert', anim: 4 },
    snow:       { name: '雪原',     pass: true, enc: 1.1, bbg: 'snow' },
    marsh:      { name: '湿地',     pass: true, enc: 1.2, bbg: 'swamp' },
    marsh_fog:  { name: '霧の湿地', pass: true, enc: 1.3, bbg: 'swamp', anim: 2 },
    swamp:      { name: '毒の沼',   pass: true, enc: 1.2, bbg: 'swamp', damagePct: 2 },
    wasteland:  { name: '荒野',     pass: true, enc: 1.2, bbg: 'wasteland' },
    ash:        { name: '灰の地',   pass: true, enc: 1.2, bbg: 'ashland' },
    magma:      { name: '溶岩',     pass: false, anim: 2 },
    // ---------------------------------------------------- growth & relief
    forest:     { name: '森',       pass: true, enc: 1.3, bbg: 'forest' },
    snowforest: { name: '雪の森',   pass: true, enc: 1.3, bbg: 'snow' },
    jungle:     { name: '密林',     pass: true, enc: 1.3, bbg: 'jungle' },
    deadforest: { name: '枯れ木の森', pass: true, enc: 1.3, bbg: 'swamp' },
    hills:      { name: '丘',       pass: true, enc: 1.2, bbg: 'hills' },
    mountain:   { name: '山',       pass: false },
    cliff:      { name: '崖',       pass: false },
    ruins:      { name: '遺跡',     pass: true, enc: 1.0, bbg: 'grass' },
    // ---------------------------------------------------- hidden passages (Part A4)
    secret_forest: { name: '森',    pass: true, enc: 1.3, bbg: 'forest', secret: true },
    secret_rock:   { name: '岩山',  pass: true, enc: 1.2, bbg: 'hills', secret: true },
    // ---------------------------------------------------- bridges
    bridge_h:   { name: '橋',       pass: true, enc: 0.3, bbg: 'grass' },
    bridge_v:   { name: '橋',       pass: true, enc: 0.3, bbg: 'grass' },
    // ---------------------------------------------------- location icons (walkable; the warp placed there fires)
    loc_castle:  { name: '城',       pass: true, enc: 0, warpIcon: true },
    loc_town:    { name: '町',       pass: true, enc: 0, warpIcon: true },
    loc_village: { name: '村',       pass: true, enc: 0, warpIcon: true },
    loc_port:    { name: '港町',     pass: true, enc: 0, warpIcon: true },
    loc_cave:    { name: '洞窟',     pass: true, enc: 0, warpIcon: true },
    loc_mine:    { name: '坑道',     pass: true, enc: 0, warpIcon: true },
    loc_forest:  { name: '森の入口', pass: true, enc: 0, warpIcon: true },
    loc_tower:   { name: '塔',       pass: true, enc: 0, warpIcon: true },
    loc_library: { name: '大書庫',   pass: true, enc: 0, warpIcon: true },
    loc_shrine:  { name: 'ほこら',   pass: true, enc: 0, warpIcon: true },
    loc_temple:  { name: '神殿',     pass: true, enc: 0, warpIcon: true },
    loc_manor:   { name: '館',       pass: true, enc: 0, warpIcon: true },
    loc_pyramid: { name: '王墓',     pass: true, enc: 0, warpIcon: true },
    loc_volcano: { name: '火山',     pass: true, enc: 0, warpIcon: true },
    loc_demon:   { name: '魔の城',   pass: true, enc: 0, warpIcon: true }, // Crest; unused, kept registered
  };

  // Legend: the Crest characters are unchanged; the new ones are §11.11.2.
  const LEGEND = {
    '~': 'sea', '^': 'reef', 'w': 'barrier', 'g': 'fog', 'u': 'river',
    '.': 'grass', ',': 'plain', 'r': 'road', 'b': 'beach', 'd': 'desert', 'z': 'sandstorm',
    '*': 'snow', 'm': 'marsh', 'e': 'marsh_fog', 'x': 'swamp', 'k': 'wasteland', 'a': 'ash', 'L': 'magma',
    'T': 'forest', 'f': 'snowforest', 'j': 'jungle', 't': 'deadforest',
    'n': 'hills', 'M': 'mountain', 'c': 'cliff', 'o': 'ruins',
    '%': 'secret_forest', '&': 'secret_rock',
    '=': 'bridge_h', '|': 'bridge_v',
    'C': 'loc_castle', 'V': 'loc_town', 'v': 'loc_village', 'W': 'loc_port', 'O': 'loc_cave', 'N': 'loc_mine',
    'G': 'loc_forest', 'I': 'loc_tower', 'U': 'loc_library', 'A': 'loc_shrine', 'H': 'loc_temple',
    'Q': 'loc_manor', 'P': 'loc_pyramid', 'Y': 'loc_volcano', 'X': 'loc_demon',
  };
  // Crest's free marker characters for the overworld; the ones the legend now
  // uses are removed below (§11.11.2: r m a g z e j t u c o G Q U W N % &).
  const MARK_BASE = '@0123456789!?$%&<>{}[]();-/EGJNQUWZaceghijlmopqrstuyz';

  function apply() {
    const T = R.DB.tiles;
    for (const id in WORLD) T[id] = Object.assign({}, WORLD[id]); // whole entries (drops Crest's swamp.damage)
    const leg = Object.assign({}, R.DB.legends.world || {});
    // a character this table re-assigns must not keep another world id
    for (const ch in LEGEND) leg[ch] = LEGEND[ch];
    R.DB.legends.world = leg;
    R.MARK_CHARS_WORLD = MARK_BASE.split('').filter((ch) => !(ch in leg)).join('');
  }
  apply();
  R.onData(apply);

  /** read-only description of the world tile set (tests, tools, other areas) */
  R.TilesWorld = {
    ids: Object.keys(WORLD),
    legend: Object.assign({}, LEGEND),
    /** char for a world tile id (undefined when it has none) */
    charOf(id) { for (const ch in LEGEND) if (LEGEND[ch] === id) return ch; return undefined; },
    apply,
  };
})(window.RPG);
