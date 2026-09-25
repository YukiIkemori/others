// Tile definitions, map legends, visual themes and the decor layer.
// Owner: art-local (A16b, DESIGN §13.1). The overworld entries below are kept as
// the base set; art-world (A16a) extends/overrides them in src/data/tiles_world.js.
// NOTE on load order: src/data/tiles_world.js sorts BEFORE this file
// (localeCompare puts '_' before '.'), so everything here MERGES under what is
// already registered instead of replacing it: world tile props and the world
// legend written by tiles_world.js always win.
//
// A map row is a string; each character is looked up in the map's legend
// (R.DB.legends.world for the overworld, R.DB.legends.local for everything
// else) to get a tile id. Tile ids index R.DB.tiles.
//
// Tile props:
//   pass      : walkable on foot
//   ship      : sailable by ship
//   counter   : impassable, but you can talk to an NPC on the far side
//   damagePct : % of max HP lost per new cell entered by each living member
//               (never below 1 HP; DESIGN §3.3.10-10). Replaces Crest's fixed `damage`.
//   lock      : key item id that opens this door (door opens automatically if held).
//               Chronicle does not use it (closed tiles + tilePatches, §10.8.0-6).
//   enc       : encounter-rate multiplier (overworld), 0 = no encounters
//   bbg       : battle background id for random encounters on this tile (overworld)
//   themed    : art is looked up as 'tile:<theme>:<id>' first, then 'tile:<id>'
//   anim      : number of animation frames the art provides (array of canvases)
//   warpIcon  : overworld location icon (always walkable, never has encounters)
//   flagPass  : walkable/sailable only when this story flag is set
//   closed    : a closed passage (DESIGN §11.2.9): impassable until a tilePatch
//               replaces it (doors → 'D', walls → '.'); put an examine event on it
//   secret    : a secret passage (DESIGN §3.3.10-11, §10.6.4): drawn like the theme
//               wall with a faint hint, but walkable; the field records the first
//               visit in R.Game.secrets['<map>:<x>,<y>'] and the art then shows the
//               "found" look (R.Art.localTile reads R.Game.secrets)
(function (R) {
  'use strict';
  const T = R.DB.tiles;
  /** merge defs under what is already registered (earlier files win) */
  function base(defs) {
    for (const id in defs) T[id] = Object.assign({}, defs[id], T[id] || {});
  }

  // ------------------------------------------------------------- overworld
  // Base set (Crest). tiles_world.js (A16a) adds the Chronicle world tiles and
  // may override any of these props.
  base({
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
    swamp:      { name: '毒の沼', pass: true, enc: 1.2, bbg: 'swamp', damagePct: 2 },
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
    loc_pyramid:  { name: '王墓',     pass: true, enc: 0, warpIcon: true },
    loc_volcano:  { name: '火山',     pass: true, enc: 0, warpIcon: true },
    loc_demon:    { name: '魔王城',   pass: true, enc: 0, warpIcon: true },
    loc_temple:   { name: '神殿',     pass: true, enc: 0, warpIcon: true },
  });
  // Crest's fixed `damage` is replaced by `damagePct` (§3.3.10-10); drop a stale value.
  if (T.swamp && T.swamp.damagePct != null) delete T.swamp.damage;

  // ---------------------------------------------------- local (towns etc.)
  base({
    void:        { name: '闇', pass: false },
    floor:       { name: '床', pass: true, themed: true },
    wall:        { name: '壁', pass: false, themed: true },
    wall_torch:  { name: 'たいまつの壁', pass: false, themed: true, anim: 2 },
    lgrass:      { name: '草', pass: true },
    dirt:        { name: '土', pass: true },
    wood:        { name: '板張り', pass: true },
    carpet:      { name: 'じゅうたん', pass: true },
    sand:        { name: '砂', pass: true },
    snowfloor:   { name: '雪', pass: true },
    ice:         { name: '氷の床', pass: true },
    water:       { name: '水', pass: false, anim: 4 },
    lava:        { name: '溶岩', pass: true, damagePct: 4, anim: 2 },
    poison:      { name: '毒の床', pass: true, damagePct: 2, anim: 2 },
    tree:        { name: '木', pass: true }, // the party walks through trees (drawn under the sprites; brief A2)
    flowers:     { name: '花', pass: true },
    fence:       { name: '柵', pass: false },
    door:        { name: '扉', pass: true, themed: true },
    door_silver: { name: '銀の扉', pass: true, lock: 'silver_key', themed: true },
    door_gold:   { name: '金の扉', pass: true, lock: 'gold_key', themed: true },
    seal:        { name: '封印', pass: false, anim: 2, closed: true },
    counter:     { name: 'カウンター', pass: false, counter: true },
    table:       { name: 'テーブル', pass: false, counter: true },
    chair:       { name: '椅子', pass: true },
    bed:         { name: 'ベッド', pass: false },
    bookshelf:   { name: '本棚', pass: false },
    shelf:       { name: '商品棚', pass: false },
    pot:         { name: 'つぼ', pass: false },
    barrel:      { name: 'たる', pass: false },
    crate:       { name: '木箱', pass: false },
    throne:      { name: '玉座', pass: false },
    pillar:      { name: '柱', pass: false, themed: true },
    altar:       { name: '祭壇', pass: false, counter: true },
    stairs_up:   { name: '上り階段', pass: true, themed: true },
    stairs_down: { name: '下り階段', pass: true, themed: true },
    lbridge_h:   { name: '橋', pass: true },
    lbridge_v:   { name: '橋', pass: true },
    rock:        { name: '岩', pass: false, themed: true },
    statue:      { name: '像', pass: false },
    sign:        { name: '看板', pass: false },
    well:        { name: '井戸', pass: false },
    grave:       { name: '墓', pass: false },
    warp_pad:    { name: '転移の陣', pass: true, anim: 4 },
    pedestal:    { name: '台座', pass: false },
    housewall:   { name: '家の壁', pass: false },
    roof:        { name: '屋根', pass: false },
    pit:         { name: '穴', pass: true },
    // --- Chronicle (DESIGN §11.2.9): closed passages, story stones, marsh
    lockdoor:          { name: '閉じた扉', pass: false, themed: true, closed: true },
    vine_wall:         { name: 'つるの壁', pass: false, closed: true },
    ice_wall:          { name: '氷の壁', pass: false, closed: true },
    fog_wall:          { name: '霧の壁', pass: false, anim: 2, closed: true },
    rock_door:         { name: '岩戸', pass: false, themed: true, closed: true },
    story_stone:       { name: '語り石', pass: false },
    story_stone_blank: { name: '白紙の語り石', pass: false },
    bog:               { name: '深い沼', pass: false, anim: 4 },
    mud:               { name: 'ぬかるみ', pass: true },
    // --- secret passage (DESIGN §3.3.10-11, §10.6.4): looks like the theme wall
    secret_wall:       { name: '隠し通路', pass: true, themed: true, secret: true },
  });

  // ------------------------------------------------------------- legends
  // world: base chars; tiles_world.js (loaded first) adds the new ones and wins on conflicts
  R.DB.legends.world = Object.assign({
    '~': 'sea', '^': 'reef', 'w': 'barrier',
    '.': 'grass', ',': 'plain', 'T': 'forest', 'n': 'hills', 'M': 'mountain',
    'd': 'desert', '*': 'snow', 'f': 'snowforest', 'x': 'swamp', 'b': 'beach',
    'k': 'wasteland', 'L': 'magma', '=': 'bridge_h', '|': 'bridge_v',
    'C': 'loc_castle', 'V': 'loc_town', 'v': 'loc_village', 'O': 'loc_cave',
    'I': 'loc_tower', 'A': 'loc_shrine', 'P': 'loc_pyramid', 'Y': 'loc_volcano',
    'X': 'loc_demon', 'H': 'loc_temple',
  }, R.DB.legends.world || {});

  R.DB.legends.local = Object.assign(R.DB.legends.local || {}, {
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
    // Chronicle (DESIGN §11.11.2)
    'E': 'lockdoor', 'V': 'vine_wall', 'I': 'ice_wall', 'G': 'fog_wall', 'O': 'rock_door',
    'Q': 'story_stone', 'U': 'story_stone_blank', 'w': 'bog', 'z': 'mud',
    '%': 'secret_wall',
  });

  // Characters NOT in a legend are free for per-map object markers (map.marks).
  // Local (after §11.11.2 took E G I O Q U V w z %):
  //   @ 0 4 5 6 7 8 9 ! ? $ & < > { } [ ] ( ) ; " ' ` - / \  A H J M N X Z n v y
  const MARK_LOCAL_BASE = '@0456789!?$%&<>{}[]();"\'`-/\\AEGHIJMNOQUVXZnvwyz';
  const MARK_WORLD_BASE = '@0123456789!?$%&<>{}[]();-/EGJNQUWZaceghijlmopqrstuyz';
  // world secret passages (§3.3.10-11): '%' secret_forest, '&' secret_rock — reserved even
  // before tiles_world.js registers them
  const WORLD_RESERVED = '%&';
  function freeChars(baseStr, legend, reserved) {
    let out = '';
    for (const ch of baseStr) if (!(ch in legend) && !(reserved || '').includes(ch)) out += ch;
    return out;
  }
  function markChars() {
    R.MARK_CHARS_LOCAL = freeChars(MARK_LOCAL_BASE, R.DB.legends.local, '');
    // keep a narrower string art-world may have set, filtered by the final world legend
    const w = typeof R.MARK_CHARS_WORLD === 'string' && R.MARK_CHARS_WORLD ? R.MARK_CHARS_WORLD : MARK_WORLD_BASE;
    R.MARK_CHARS_WORLD = freeChars(w, R.DB.legends.world, WORLD_RESERVED);
  }
  markChars();
  // later files may still add legend chars: recompute once all data is in
  if (R.onData) R.onData(markChars);

  // --------------------------------------------------------------- themes
  // Visual themes for 'themed' local tiles (floor/wall/wall_torch/door/…).
  // Art: 'tile:<theme>:<tileId>' (src/art/tiles_theme*.js). `fallback` is the theme
  // whose art is used while a theme has no art of its own (R.Art.themeOf, §11.1.3).
  // Town themes (town, town_*) are outdoor: their floor is the paved street.
  Object.assign(R.DB.themes, {
    town:    { name: '町',         bbg: 'grass', town: true },
    castle:  { name: '城',         bbg: 'castle' },
    house:   { name: '屋内',       bbg: 'castle' },
    cave:    { name: '洞窟',       bbg: 'cave' },
    fort:    { name: '砦',         bbg: 'fort' },
    pyramid: { name: '王墓',       bbg: 'pyramid' },
    water:   { name: '水の洞窟',   bbg: 'watercave' },
    ice:     { name: '氷の洞窟',   bbg: 'ice' },
    volcano: { name: '火山',       bbg: 'volcano' },
    tower:   { name: '塔',         bbg: 'tower' },
    shrine:  { name: '神殿',       bbg: 'shrine' },
    demon:   { name: '魔の城',     bbg: 'demon' },
    // dungeons (DESIGN §11.2.8)
    forest:   { name: '森',     bbg: 'forest',   fallback: 'town', outdoor: true },
    tree:     { name: '千年樹', bbg: 'tree',     fallback: 'house' },
    snow:     { name: '雪山',   bbg: 'snow',     fallback: 'ice', outdoor: true },
    manor:    { name: '館',     bbg: 'manor',    fallback: 'castle' },
    swamp:    { name: '沼',     bbg: 'swamp',    fallback: 'cave', outdoor: true },
    ship:     { name: '船',     bbg: 'ship',     fallback: 'house' },
    mine:     { name: '坑道',   bbg: 'mine',     fallback: 'cave' },
    library:  { name: '書庫',   bbg: 'library',  fallback: 'castle' },
    oblivion: { name: '忘却',   bbg: 'oblivion', fallback: 'demon' },
    // towns (DESIGN §11.2.6)
    town_roa:    { name: '語り部の里', bbg: 'grass', fallback: 'town', town: true },
    town_forest: { name: '森の村',     bbg: 'grass', fallback: 'town', town: true },
    town_sand:   { name: '砂の町',     bbg: 'grass', fallback: 'town', town: true },
    town_snow:   { name: '雪の村',     bbg: 'grass', fallback: 'town', town: true },
    town_marsh:  { name: '水辺の町',   bbg: 'grass', fallback: 'town', town: true },
    town_isle:   { name: '島の町',     bbg: 'grass', fallback: 'town', town: true },
    town_mine:   { name: '鉱山の町',   bbg: 'grass', fallback: 'town', town: true },
    town_ash:    { name: '火の町',     bbg: 'grass', fallback: 'town', town: true },
    town_star:   { name: '星の町',     bbg: 'grass', fallback: 'town', town: true },
    town_white:  { name: '白い都',     bbg: 'grass', fallback: 'town', town: true },
  });

  R.TILE_THEMED = Object.keys(T).filter((k) => T[k].themed);
})(window.RPG);

// ------------------------------------------------------------ decor layer
// Maps may add `decor: [rows]` (same size as `rows`) drawn ON TOP of the base
// tile: wall hangings, rugs, furniture, town props. ' ' and '.' = nothing.
// Seats and small/soft props (stools, benches, rugs, straw, leaves, flowerbeds,
// bushes, haystacks, potted plants, palms, snow drifts, paper, mushrooms …) are
// walkable (brief A2); real furniture, stalls, carts, lamps and signs block.
// Props: pass (default false), counter (talk across), wall (meant for wall
// tiles), anim (frames), tall (art may be up to 32px high, bottom-aligned),
// auto (art joins with same-id neighbours: rugs, long tables, stalls, fountains).
// Art: 'decor:<id>' (canvas or frames) or R.Art.decorTile(map,x,y) when defined.
// Per-map legend: a map may add `decorLegend: {'|': 'tent', …}` (DESIGN §11.2.10,
// read by the field on top of R.DB.legends.decor). The ids marked "map legend"
// below have no global char; the spare chars '|' ':' ',' are meant for them.
(function (R) {
  'use strict';
  const D = (R.DB.decor = R.DB.decor || {});
  Object.assign(D, {
    // --- wall-mounted (place on wall / housewall tiles)
    banner_red:   { name: '赤い旗', wall: true },
    banner_blue:  { name: '青い旗', wall: true },
    tapestry:     { name: 'タペストリー', wall: true },
    window:       { name: '窓', wall: true },
    window_arch:  { name: 'アーチ窓', wall: true },
    sconce:       { name: '壁のたいまつ', wall: true, anim: 2 },
    painting:     { name: '絵画', wall: true },
    portrait:     { name: '肖像画', wall: true },
    emblem:       { name: '紋章', wall: true },
    swords:       { name: '交差した剣', wall: true },
    wall_shelf:   { name: '壁の棚', wall: true },
    mirror:       { name: '鏡', wall: true },
    // --- floor overlays (walkable)
    rug:          { name: 'じゅうたん', pass: true, auto: true },
    rug_blue:     { name: '青いじゅうたん', pass: true, auto: true },
    dais:         { name: '段差', pass: true, auto: true },
    crack:        { name: '床のひび割れ', pass: true },
    tile_alt:     { name: '色違いの床', pass: true },
    mosaic:       { name: 'モザイク', pass: true },
    grate:        { name: '格子', pass: true },
    straw:        { name: 'わら', pass: true },
    leaves:       { name: '落ち葉', pass: true },
    flowers_low:  { name: '草花', pass: true },
    stool:        { name: 'スツール', pass: true },
    // --- furniture (block movement, except the seats and plants marked pass)
    fireplace:    { name: '暖炉', anim: 3, tall: true },
    stove:        { name: 'かまど', anim: 2 },
    sink:         { name: '流し台', counter: true },
    cupboard:     { name: '食器棚', tall: true },
    wardrobe:     { name: '衣装だんす', tall: true },
    dresser:      { name: '整理だんす' },
    desk:         { name: '机', counter: true },
    table_round:  { name: '丸テーブル', counter: true },
    table_long:   { name: '長テーブル', counter: true, auto: true },
    bench:        { name: 'ベンチ', pass: true },
    plant:        { name: '鉢植え', tall: true, pass: true },
    vase:         { name: '花瓶' },
    sacks:        { name: '麦の袋' },
    crates:       { name: '積み荷', tall: true },
    armor_stand:  { name: '鎧飾り', tall: true },
    weapon_rack:  { name: '武器立て', tall: true },
    treasure:     { name: '財宝の山' },
    candelabra:   { name: 'ろうそく立て', anim: 2, tall: true },
    globe:        { name: '地球儀' },
    anvil:        { name: '金床' },
    clock:        { name: '柱時計', tall: true },
    // --- town exterior
    flowerbed:    { name: '花壇', pass: true },
    hedge:        { name: '生け垣', auto: true },
    lamp:         { name: '街灯', anim: 4, tall: true },
    sign_item:    { name: '道具屋の看板', tall: true },
    sign_weapon:  { name: '武器屋の看板', tall: true },
    sign_armor:   { name: '防具屋の看板', tall: true },
    sign_inn:     { name: '宿屋の看板', tall: true },
    sign_church:  { name: '聖堂の看板', tall: true },
    stall:        { name: '露店', counter: true, auto: true, tall: true },
    fountain:     { name: '噴水', anim: 4, auto: true, tall: true },
    cart:         { name: '荷車', tall: true },
    haystack:     { name: '干し草', pass: true, tall: true },
    bush:         { name: '茂み', pass: true },
    well_small:   { name: '井戸', tall: true },

    // === Chronicle, global legend (DESIGN §11.2.10)
    sign_tavern:  { name: '酒場の看板', tall: true },
    bar_shelf:    { name: '酒の棚', wall: true },
    kegs:         { name: '酒だるの山', tall: true },
    stage:        { name: '小さな舞台', pass: true, auto: true },
    loom:         { name: '機織り機' },
    spinwheel:    { name: '糸車' },
    herbs_hang:   { name: '干した薬草', wall: true },
    firewood:     { name: 'まき束' },
    rug_round:    { name: '丸い敷物', pass: true },
    sign_magic:   { name: '術具店の看板', tall: true },
    lectern:      { name: '書見台', counter: true },
    book_pile:    { name: '本の山' },
    scroll_rack:  { name: '巻物の棚', wall: true },
    map_wall:     { name: '壁の地図', wall: true },
    signpost:     { name: '道しるべ', tall: true },
    laundry:      { name: '物干し', tall: true, pass: true },
    palm:         { name: 'やしの木', tall: true, pass: true },
    snowpile:     { name: '雪だまり', pass: true },
    rails:        { name: '線路', pass: true, auto: true },
    minecart:     { name: 'トロッコ' },
    mast:         { name: '帆柱', tall: true },
    paper_drift:  { name: '舞う紙', pass: true, anim: 2, animRate: 20 },
    mushrooms:    { name: 'キノコ', pass: true },
    stump:        { name: '切り株' },
    cobweb:       { name: 'クモの巣', pass: true },
    ivy:          { name: 'つた', wall: true, pass: true },
    icicles:      { name: 'つらら', wall: true },
    ember:        { name: '火の粉の割れ目', pass: true, anim: 2, animRate: 18 },

    // === Chronicle, map legend only (DESIGN §11.2.10; chars per map in `decorLegend`)
    cradle:       { name: 'ゆりかご' },
    washtub:      { name: 'たらい' },
    telescope:    { name: '望遠鏡', tall: true },
    astrolabe:    { name: '天球儀' },
    boat:         { name: '小舟' },                        // on water tiles
    net_rack:     { name: '網干し', tall: true },
    tent:         { name: '天幕', tall: true },
    cannon:       { name: '大砲' },
    helm_wheel:   { name: '船のかじ' },
    rope_coil:    { name: '巻いた綱', pass: true },
    piano:        { name: '古いピアノ', tall: true },
    doll_shelf:   { name: '人形の棚', wall: true },
    broken_chair: { name: '壊れた椅子', pass: true },
    ash_pile:     { name: '灰だまり', pass: true },
    forge:        { name: '炉', tall: true, anim: 2 },
    ore_pile:     { name: '鉱石の山' },
    hot_spring:   { name: '湯けむり', pass: true, anim: 2, animRate: 20 }, // on water tiles
    // regional set pieces (§11.2.11, the "見せ場の絵" column)
    sunken_bell:  { name: '沈んだ鐘' },                    // on bog / water tiles (鐘沈みの沼)
    mural_firebird: { name: '火の鳥の壁画', wall: true },  // 灰の火山
  });

  R.DB.legends.decor = Object.assign(R.DB.legends.decor || {}, {
    // wall
    b: 'banner_red', B: 'banner_blue', t: 'tapestry', w: 'window', W: 'window_arch', i: 'sconce',
    p: 'painting', P: 'portrait', c: 'emblem', x: 'swords', k: 'wall_shelf', m: 'mirror',
    // floor
    r: 'rug', R: 'rug_blue', d: 'dais', z: 'crack', a: 'tile_alt', o: 'mosaic', g: 'grate',
    s: 'straw', l: 'leaves', f: 'flowers_low', n: 'stool',
    // furniture
    F: 'fireplace', K: 'stove', S: 'sink', C: 'cupboard', A: 'wardrobe', y: 'dresser', D: 'desk',
    T: 'table_round', L: 'table_long', e: 'bench', Z: 'plant', v: 'vase', q: 'sacks', U: 'crates',
    Y: 'armor_stand', X: 'weapon_rack', G: 'treasure', Q: 'candelabra', I: 'globe', O: 'anvil', V: 'clock',
    // town
    '1': 'flowerbed', '2': 'hedge', '3': 'lamp', '4': 'sign_item', '5': 'sign_weapon', '6': 'sign_armor',
    '7': 'sign_inn', '8': 'sign_church', '9': 'stall', J: 'fountain', E: 'cart', M: 'haystack', h: 'bush', u: 'well_small',
    // Chronicle (DESIGN §11.11.2). Spare for map legends: | : ,
    j: 'sign_tavern', H: 'bar_shelf', N: 'kegs', '0': 'stage', '!': 'loom', '?': 'spinwheel',
    $: 'herbs_hang', '%': 'firewood', '&': 'rug_round', '<': 'sign_magic', '>': 'lectern',
    '{': 'book_pile', '}': 'scroll_rack', '[': 'map_wall', ']': 'signpost', '(': 'laundry',
    ')': 'palm', ';': 'snowpile', '-': 'rails', '/': 'minecart', '+': 'mast', '=': 'paper_drift',
    '*': 'mushrooms', '#': 'stump', '@': 'cobweb', '~': 'ivy', '^': 'icicles', _: 'ember',
  });
  /** decor ids without a global legend char (use a map's decorLegend) */
  R.DECOR_MAP_ONLY = Object.keys(D).filter((id) => !Object.values(R.DB.legends.decor).includes(id));
  /** chars left for per-map decorLegend entries that do not shadow a global decor char */
  R.DECOR_SPARE_CHARS = '|:,';
})(window.RPG);
