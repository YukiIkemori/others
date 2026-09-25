// Tile definitions, map legends and visual themes.
//
// A map row is a string; each character is looked up in the map's legend
// (R.DB.legends.world for the overworld, R.DB.legends.local for everything
// else) to get a tile id. Tile ids index R.DB.tiles.
//
// Tile props:
//   pass     : walkable on foot
//   ship     : sailable by ship
//   counter  : impassable, but you can talk to an NPC on the far side
//   damage   : HP lost per step by each living member (0 = none)
//   lock     : key item id that opens this door (door opens automatically if held)
//   enc      : encounter-rate multiplier (overworld), 0 = no encounters
//   bbg      : battle background id for random encounters on this tile (overworld)
//   themed   : art is looked up as 'tile:<theme>:<id>' first, then 'tile:<id>'
//   anim     : number of animation frames the art provides (array of canvases)
//   warpIcon : overworld location icon (always walkable, never has encounters)
//   flagPass : walkable/sailable only when this story flag is set
//   dark     : (visual hint) drawn darker — unused by logic
(function (R) {
  'use strict';
  const T = R.DB.tiles;

  // ------------------------------------------------------------- overworld
  Object.assign(T, {
    sea:        { name: '海',     pass: false, ship: true, enc: 1.0, bbg: 'sea', anim: 4 },
    reef:       { name: '岩礁',   pass: false, ship: false },
    barrier:    { name: '魔の渦', pass: false, ship: false, flagPass: 'barrier_broken', shipWhenFlag: true, anim: 4 },
    grass:      { name: '草原',   pass: true, enc: 1.0, bbg: 'grass' },
    plain:      { name: '平原',   pass: true, enc: 0.9, bbg: 'grass' },
    forest:     { name: '森',     pass: true, enc: 1.3, bbg: 'forest' },
    hills:      { name: '丘',     pass: true, enc: 1.2, bbg: 'hills' },
    mountain:   { name: '山',     pass: false },
    desert:     { name: '砂漠',   pass: true, enc: 1.1, bbg: 'desert' },
    snow:       { name: '雪原',   pass: true, enc: 1.1, bbg: 'snow' },
    snowforest: { name: '雪の森', pass: true, enc: 1.3, bbg: 'snow' },
    swamp:      { name: '毒の沼', pass: true, enc: 1.2, bbg: 'swamp', damage: 2 },
    beach:      { name: '砂浜',   pass: true, enc: 0.9, bbg: 'grass' },
    wasteland:  { name: '荒野',   pass: true, enc: 1.2, bbg: 'wasteland' },
    magma:      { name: '溶岩',   pass: false, anim: 2 },
    bridge_h:   { name: '橋',     pass: true, enc: 0.3, bbg: 'grass' },
    bridge_v:   { name: '橋',     pass: true, enc: 0.3, bbg: 'grass' },
    // location icons (walkable; stepping onto one triggers the world map warp placed there)
    loc_castle:   { name: '城',       pass: true, enc: 0, warpIcon: true },
    loc_town:     { name: '町',       pass: true, enc: 0, warpIcon: true },
    loc_village:  { name: '村',       pass: true, enc: 0, warpIcon: true },
    loc_cave:     { name: '洞窟',     pass: true, enc: 0, warpIcon: true },
    loc_tower:    { name: '塔',       pass: true, enc: 0, warpIcon: true },
    loc_shrine:   { name: 'ほこら',   pass: true, enc: 0, warpIcon: true },
    loc_pyramid:  { name: 'ピラミッド', pass: true, enc: 0, warpIcon: true },
    loc_volcano:  { name: '火山',     pass: true, enc: 0, warpIcon: true },
    loc_demon:    { name: '魔王城',   pass: true, enc: 0, warpIcon: true },
    loc_temple:   { name: '神殿',     pass: true, enc: 0, warpIcon: true },
  });

  // ---------------------------------------------------- local (towns etc.)
  Object.assign(T, {
    void:        { name: '闇', pass: false },
    floor:       { name: '床', pass: true, themed: true },
    wall:        { name: '壁', pass: false, themed: true },
    wall_torch:  { name: '燭台の壁', pass: false, themed: true, anim: 2 },
    lgrass:      { name: '草', pass: true },
    dirt:        { name: '土', pass: true },
    wood:        { name: '板張り', pass: true },
    carpet:      { name: 'じゅうたん', pass: true },
    sand:        { name: '砂', pass: true },
    snowfloor:   { name: '雪', pass: true },
    ice:         { name: '氷の床', pass: true },
    water:       { name: '水', pass: false, anim: 4 },
    lava:        { name: '溶岩', pass: true, damage: 10, anim: 2 },
    poison:      { name: '毒の床', pass: true, damage: 3, anim: 2 },
    tree:        { name: '木', pass: false },
    flowers:     { name: '花', pass: true },
    fence:       { name: '柵', pass: false },
    door:        { name: '扉', pass: true, themed: true },
    door_silver: { name: 'ぎんのとびら', pass: true, lock: 'silver_key', themed: true },
    door_gold:   { name: 'きんのとびら', pass: true, lock: 'gold_key', themed: true },
    seal:        { name: '封印', pass: false, anim: 2 },
    counter:     { name: 'カウンター', pass: false, counter: true },
    table:       { name: 'テーブル', pass: false, counter: true },
    chair:       { name: 'いす', pass: true },
    bed:         { name: 'ベッド', pass: false },
    bookshelf:   { name: '本棚', pass: false },
    shelf:       { name: '商品棚', pass: false },
    pot:         { name: 'つぼ', pass: false },
    barrel:      { name: 'たる', pass: false },
    crate:       { name: '木箱', pass: false },
    throne:      { name: '玉座', pass: false },
    pillar:      { name: '柱', pass: false, themed: true },
    altar:       { name: '祭壇', pass: false, counter: true },
    stairs_up:   { name: 'のぼり階段', pass: true, themed: true },
    stairs_down: { name: 'くだり階段', pass: true, themed: true },
    lbridge_h:   { name: '橋', pass: true },
    lbridge_v:   { name: '橋', pass: true },
    rock:        { name: '岩', pass: false, themed: true },
    statue:      { name: '像', pass: false },
    sign:        { name: '看板', pass: false },
    well:        { name: '井戸', pass: false },
    grave:       { name: '墓', pass: false },
    warp_pad:    { name: '魔法陣', pass: true, anim: 4 },
    pedestal:    { name: '台座', pass: false },
    housewall:   { name: '家の壁', pass: false },
    roof:        { name: '屋根', pass: false },
    pit:         { name: '穴', pass: true },
  });

  // ------------------------------------------------------------- legends
  R.DB.legends.world = {
    '~': 'sea', '^': 'reef', 'w': 'barrier',
    '.': 'grass', ',': 'plain', 'T': 'forest', 'n': 'hills', 'M': 'mountain',
    'd': 'desert', '*': 'snow', 'f': 'snowforest', 'x': 'swamp', 'b': 'beach',
    'k': 'wasteland', 'L': 'magma', '=': 'bridge_h', '|': 'bridge_v',
    'C': 'loc_castle', 'V': 'loc_town', 'v': 'loc_village', 'O': 'loc_cave',
    'I': 'loc_tower', 'A': 'loc_shrine', 'P': 'loc_pyramid', 'Y': 'loc_volcano',
    'X': 'loc_demon', 'H': 'loc_temple',
  };

  R.DB.legends.local = {
    ' ': 'void', '.': 'floor', '#': 'wall', 'i': 'wall_torch',
    ',': 'lgrass', ':': 'dirt', '_': 'wood', '+': 'carpet', 'd': 'sand',
    '*': 'snowfloor', 'e': 'ice', '~': 'water', 'L': 'lava', 'x': 'poison',
    'T': 'tree', 'f': 'flowers', 'F': 'fence',
    'D': 'door', '1': 'door_silver', '2': 'door_gold', '3': 'seal',
    'c': 'counter', 't': 'table', 'h': 'chair', 'b': 'bed', 'k': 'bookshelf',
    'u': 'shelf', 'p': 'pot', 'o': 'barrel', 'j': 'crate', 'K': 'throne',
    'l': 'pillar', 'a': 'altar', 'S': 'stairs_up', 's': 'stairs_down',
    '=': 'lbridge_h', '|': 'lbridge_v', 'r': 'rock', 'Y': 'statue', 'm': 'sign',
    'W': 'well', 'g': 'grave', 'P': 'warp_pad', 'C': 'pedestal',
    'B': 'housewall', 'R': 'roof', 'q': 'pit',
  };
  // Characters NOT in the local legend are free for per-map object markers
  // (map.marks): @ 0 4 5 6 7 8 9 ! ? $ % & < > { } [ ] ( ) ; " ' ` - / \
  //              A E G H I J M N O Q U V X Z n v w y z
  R.MARK_CHARS_LOCAL = '@0456789!?$%&<>{}[]();"\'`-/\\AEGHIJMNOQUVXZnvwyz';
  // Overworld free marker chars:
  R.MARK_CHARS_WORLD = '@0123456789!?$%&<>{}[]();-/EGJNQUWZaceghijlmopqrstuyz';

  // --------------------------------------------------------------- themes
  // Visual themes for 'themed' local tiles (floor/wall/wall_torch/door/…).
  // Art agents provide 'tile:<theme>:<tileId>' for each themed tile id.
  Object.assign(R.DB.themes, {
    town:    { name: '町',         bbg: 'grass' },
    castle:  { name: '城',         bbg: 'castle' },
    house:   { name: '屋内',       bbg: 'castle' },
    cave:    { name: '洞窟',       bbg: 'cave' },
    fort:    { name: '砦',         bbg: 'fort' },
    pyramid: { name: 'ピラミッド', bbg: 'pyramid' },
    water:   { name: '水の洞窟',   bbg: 'watercave' },
    ice:     { name: '氷の洞窟',   bbg: 'ice' },
    volcano: { name: '火山',       bbg: 'volcano' },
    tower:   { name: '塔',         bbg: 'tower' },
    shrine:  { name: '神殿',       bbg: 'shrine' },
    demon:   { name: '魔王城',     bbg: 'demon' },
  });

  R.TILE_THEMED = Object.keys(T).filter((k) => T[k].themed);
})(window.RPG);
