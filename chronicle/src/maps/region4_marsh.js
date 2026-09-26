// 鐘沈みの沼 (bell_marsh_1): the outdoor bog maze where Melda sank the seven bells (DESIGN §10.6.2,
// §10.8.5 #5–#7). Owner: reg-4 (R4). Theme / battle backdrop `swamp` (outdoor; reeds for walls, dead
// trees for pillars), BGM `ghost`, zone `z_r_marsh_bog`, outside water `~`.
//
// Layout (58×48): islands of wet ground joined by strips of land and plank walks. From the entrance
// (south) the south junction branches west (west junction → bell A; the north-west junction → bell B
// and a dead end) and east (east junction → bell C → the north-east dead end with the p_rare; the
// south-east dead end). Of the seven bells only three still have their chains above the water:
// examining a chain (bell_marsh_1_bell_a/b/c) with 鐘の鍵 rings its bell (marsh_bells +1). The four
// other bells lie in the bog without chains. North of the south junction the fog gate (fog_wall,
// tilePatch {var marsh_bells ≥ 3}) closes the way to the antechamber (休息の灯, フィーネ) and the
// clearing where 霧食らい waits (bell_marsh_1_boss). Poison edges (14 cells) line three paths
// without ever crossing them.
//
// Contracts: spawns entrance (§10.6.2-2), escape → world bell_marsh_1, location 'bell_marsh',
// NPC ids rest · fine · boss · melda (scene) · the children (scene).
(function (R) {
  'use strict';
  const K = R.Reg4;
  const GATE = { var: 'marsh_bells', gte: 3 };
  const chain = (k, x, y) => [
    K.npc('chain_' + k, 'obj:marsh_chain', x, y, { event: 'bell_marsh_1_bell_' + k, cond: '!bell_marsh_1_bell_' + k, fixed: true }),
    K.talk('chain_' + k + '_open', 'obj:marsh_chain_open', x, y, '鐘の鎖だ。錠が外れて、\n水の中の鐘が\nかすかに光っている。', { cond: 'bell_marsh_1_bell_' + k, fixed: true }),
  ];

  const def = {
    name: '鐘沈みの沼', type: 'dungeon', theme: 'swamp', bgm: 'ghost', bbg: 'swamp',
    location: 'bell_marsh', region: 'r_marsh', escape: { to: 'world', spawn: 'bell_marsh_1' },
    encounter: 'z_r_marsh_bog', outside: 'w', // the bog's own water (the murky deep bog, not the blue lake water)
    decorLegend: { '|': 'sunken_bell' },
    // @rows bell_marsh_1
    rows: [
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwlwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwww......#####w#wwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwlT.z........T...wwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwT...z..z.........wwwwwwwwwwwwwwwwwwww',
      'wwwwwwwz##.rwwwwwwww#..z...........z...wwwwwwwwwwwwwwwwwww',
      'wwwww#....T..#wwwwww#.............z.r.zwwwwwwww###..wwwwww',
      'wwwwww.l.....#wwwwww...Tzz.....zz......wwwwwwww#z..z#wwwww',
      'wwww#r.z...z..zwwwwww#...z.zz.....z...rwwwwwww..z...#wwwww',
      'wwwww#z..z...#wwwwwwww.zz.....T....z.lwwwwwwww#T...z.wwwww',
      'wwwww##.....lwwwwwwwwwww###z.......zwwwwwwwwww#z...l.wwwww',
      'wwwwwww#...#wwwwwwwwwwwwwwww...wwwwwwwwwwwwwww#z....wwwwww',
      'wwwwwwww...wwwwwwwwwwwwwwwww...wwwwwwwwwwwwwwwwz.T..wwwwww',
      'wwwwwwwww.xwwwwwwwwwwwwwwwwwz..wwwwwwwwwwwwwwwwww||wwwwwww',
      'www.z.wwwz..wwwwwwwwwwwwwwww...wwwwwwwwwwwwwwwwww||wwwwwww',
      'ww#z...www..wwwwwwwwwwwwww.r...###wwwwwwwwwwwwwww||wwwwwww',
      'ww#....www...wwwwwwwwwww#T........#wwwwwwwwwwwwww||wwwwwww',
      'ww.......ww...T.lwwwwwww#........zz#wwwwwwwwwwwww||wwwwwww',
      'www......z..xx....wwwwww#......rz..wwwwwwwwwwwwww||wwwwwww',
      'wwwwwwww..........wwwwwwww##.....wwwwwwwwwwwwwwww||wwwwwww',
      'wwwwwwwwl.z.......wwwwwwwwww...wwwwwwwwwwwwwwwwwz.....wwww',
      'wwwwwwwwwz......l.wwwwwwwwww..zwwwwwwwwwwwwwwwwz..zzr.#www',
      'wwwwwwwwww.l.l....wwwwwwwwww...wwwwwwwwwwwwwww#.....l.#www',
      'wwwww..z.w.l....zwwwwwwwwwww..zwwwwwwwwwwwwww.T...z....www',
      'wwwwz...l.www||wwwwwwwwwwwwwGGGwwwwwwwwwwwwwww.T..z..z#www',
      'www#......www||wwwwwwwwwwwww..xwwwwwwwwwwwwwww#T.zzl..wwww',
      'www#......www||wwwwwwwwwwwww...wwwwwwwwwwwwwwww...###lwwww',
      'www......lwww||wwwwwwwwwwwwwx..wwwwwwwwwwwwwwww..zwwwwwwww',
      'wwww.....wwww||wwwwwwwwwwwwwx..wwwwwwwwwwwwwww...wwwwwwwww',
      'wwwww#.....ww||wwwwwwwwwwww......wwwwwwlz.##..z.wwwwwwwwww',
      'wwwwwww.xx..z..##.wwwwwww....z...#wwwww.z..z...wwwwwwwwwww',
      'wwwwwwwww........T..wwwww.....zz.....xx..zzzz.#wwwwwwwwwww',
      'wwwwwwwwwww#.z...z.z=====.....z.z.......z.....z#wwwwwwwwww',
      'wwwwwwwwwww#.....z..=====.........xx...........wwwwwwwwwww',
      'wwwwwwwwwww#.z..zz.#wwwwww.TT....#wwwwwl..z..#wwwwwwwwwwww',
      'wwwwwwwwwww.zz....r#wwwwww......zwwwwwww###..#wwwwwwwwwwww',
      'wwwwwwwwwwww####l.wwwwwwwwww.zxwwwwwwwwwwww.zwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwww..xwwwwwwwwwwwwz.wwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwww...z.zwwwwwwwwww..wwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwww.zr......wwwwwwww#..#.wwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwww.......z.l.wwwwwwz.zz..#wwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwww........zz#wwwwww.....T#wwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwww....z..rz.#wwwwww#.....#wwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwww.......l##wwwwwww.....wwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwww.z...rwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwww...wwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwwwwwwwwwww..wwwwwwwwwwwwwwwwwwwwwwwwwwww',
    ],
    decor: [
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '........................l.................................',
      '..........................................................',
      '................................*...**....................',
      '..........................................................',
      '................|.........*...............................',
      '.....|......*.............................................',
      '.................................l........................',
      '...........................*..............................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '...............................*..........................',
      '...............l..........................................',
      '..........................l...............................',
      '................*.........................................',
      '................*.........................................',
      '.....................................|....................',
      '.................*........................................',
      '......*................................................|..',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..|.......................................................',
      '..........................................................',
      '..........................................................',
      '..........................*.....*.........................',
      '...............ll.*.......*...............................',
      '..........................................................',
      '.............................................l.........|..',
      '.............................l............................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
      '.....................|....................................',
      '..........................................................',
      '..........................................................',
      '..........................................................',
    ],
    // @end bell_marsh_1
    spawns: {
      entrance: { x: 28, y: 46, dir: 'up' },
    },
    warps: [
      K.warp(28, 47, 'world', 'bell_marsh_1', { dir: 'down' }),
      K.warp(29, 47, 'world', 'bell_marsh_1', { dir: 'down' }),
    ],
    // the fog gate lifts when the three bells have rung (§10.8.5 #5)
    tilePatches: [{ cond: GATE, x: 28, y: 25, w: 3, ch: '.' }],
    npcs: [
      ...chain('a', 3, 28),
      ...chain('b', 6, 8),
      ...chain('c', 54, 24),
      // the antechamber: 休息の灯 and the girl in grey (§10.8.0-5)
      K.npc('rest', 'obj:lantern', 26, 18, { event: 'common_rest', fixed: true }),
      K.npc('fine', 'fine', 29, 17, { dir: 'down', cond: '!marsh_boss', fixed: true, event: 'bell_marsh_1_fine' }),
      // the clearing: 霧食らい (visible boss, §10.6.2-6)
      K.npc('boss', 'mon:boss_mistbeast', 29, 6, { event: 'bell_marsh_1_boss', cond: '!marsh_boss', fixed: true }),
      // scene only (shown by bell_marsh_1_boss after the battle)
      K.npc('melda', 'ghost', 29, 5, { dir: 'down', cond: 'marsh_scene_never', fixed: true, text: '……ありがとう。' }),
      K.npc('child_nico', 'boy', 27, 5, { dir: 'down', cond: 'marsh_scene_never', fixed: true, text: 'すう、すう……。' }),
      K.npc('child_lina', 'girl', 31, 5, { dir: 'down', cond: 'marsh_scene_never', fixed: true, text: 'すう、すう……。' }),
      K.npc('child_bram', 'boy', 29, 4, { dir: 'down', cond: 'marsh_scene_never', fixed: true, text: 'すう、すう……。' }),
      // after the clear: the bog is quiet; Melda comes to watch over the bells
      K.talk('melda_after', 'ghost', 29, 6, [
        { cond: { postgame: true }, text: '七つの鐘は、これからも\n霧を眠らせてくれるわ。\nあなたの語った歌でね。' },
        { text: '三つの鐘が鳴ったから、\n残りの鐘も、目を覚ましたわ。\f霧は、また沼の底で\n眠りについた。……ありがとう。' },
      ], { cond: { cleared: 'r_marsh' }, dir: 'down', fixed: true }),
    ],
    chests: [
      K.chest('bell_marsh_1_c1', 49, 9, 'p_rare'),
      K.chest('bell_marsh_1_c2', 4, 17, 'p_stone'),
      K.chest('bell_marsh_1_c3', 11, 8, 'p_gear'),
      K.chest('bell_marsh_1_c4', 44, 42, 'p_supply'),
      K.chest('bell_marsh_1_c5', 25, 42, 'p_supply'),
    ],
    events: [
      K.exam('bell_marsh_1_fog', 28, 25, { cond: { var: 'marsh_bells', lt: 3 } }),
      K.exam('bell_marsh_1_fog', 29, 25, { cond: { var: 'marsh_bells', lt: 3 } }),
      K.exam('bell_marsh_1_fog', 30, 25, { cond: { var: 'marsh_bells', lt: 3 } }),
      ...K.band('bell_marsh_1_fine', 28, 21, 30, 21, { once: 'marsh_fine', cond: '!marsh_boss' }),
      ...K.band('bell_marsh_1_boss', 28, 12, 30, 12, { cond: '!marsh_boss' }),
    ],
    signs: [
      K.sign(28, 45, '鐘沈みの沼\f「七つの鐘、沼に眠る。\n鐘の歌を知る者だけが、\n鎖を引くことができる」'),
    ],
  };
  R.DB.maps.bell_marsh_1 = def;
  if (R.onData) R.onData(() => K.checkRows('bell_marsh_1', def));
})(window.RPG);
