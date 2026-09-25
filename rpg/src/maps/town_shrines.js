// 光の神殿 (an island in the middle of the sea): five pedestals ring the
// altar in the sanctum; with all five crests the keeper performs the ceremony
// (event temple_altar → light_crest, flag barrier_broken). The nave in front
// holds the church; fountains and a pier outside.
// 最果ての祠 (inside the whirlpool ring, Lv 31+): the last inn, church and
// shops before the demon castle, with a small graveyard of those who never
// came back.
// Map ids: light_temple edge_shrine
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const glow = (id, under) => ({
    npc: { id, sprite: 'obj:crest_glow', cond: 'barrier_broken', fixedDir: true, text: '紋章が、あたたかな\n光を放っている。' },
    under,
  });
  const BROKEN = 'barrier_broken';

  // local: # marble  . tiles  + carpet  C pedestal  a altar  l pillar  Y statue
  //        ~ water  d sand  | pier ; decor: R.DB.legends.decor (src/data/tiles.js)
  R.DB.maps.light_temple = {
    name: '光の神殿', type: 'shrine', legend: 'local', theme: 'shrine', bgm: 'shrine',
    location: 'light_temple', outside: '~',
    exit: { to: 'world', spawn: 'light_temple' },
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~ddd#################ddd~',
      '~d,,#################,,d~',
      '~d,,#..l....4....l..#,,d~',
      '~d,f#~~.....A.....~~#f,d~',
      '~d,f#~~l.5..0..7.l~~#f,d~',
      '~d,f#~~.....+.....~~#f,d~',
      '~d,f#~~l....+....l~~#f,d~',
      '~d,f#~~...8.+.9...~~#f,d~',
      '~d,f#..l....+....l..#f,d~',
      '~d,f#######.+.#######f,d~',
      '~d,f#..N....+.......#f,d~',
      '~d,f#.......+....M..#f,d~',
      '~d,f#.......+.......#f,d~',
      '~d,,#.......+.....$.#,,d~',
      '~d,,########D########,,d~',
      '~d,T,,,,,,Y...Y,,,,,,T,d~',
      '~d,,,,,,,,,...,,,,,,,,,d~',
      '~dT,,,,,,,,...,,,,,,,,Td~',
      '~d,,,,,,,,,...,,,,,,,,,d~',
      '~d,,,,,,,,,...,,,,,,,,,d~',
      '~ddddddddddddddddddddddd~',
      '~~~~~~~~~~~~|~~~~~~~~~~~~',
      '~~~~~~~~~~~~@~~~~~~~~~~~~',
    ],
    decor: [
      '.........................',
      '.........................',
      '.......W.B..c..B.W.......',
      '.....Z...Q.....Q...Z..h..',
      '...........ddd...........',
      '..h.....a.......a........',
      '...........ooo...........',
      '...........ooo...........',
      '.........a.....a.........',
      '.....v....z........v..h..',
      '......i..B.....B..i......',
      '..h..Q.............Q.....',
      '.......D.ee...ee.........',
      '.........ee...ee.........',
      '.....Zv............Z.....',
      '.........B.i.i.B.........',
      '.....JJJ.........JJJ.....',
      '.....JJJ.........JJJ.....',
      '.....JJJ.1.....1.JJJ.....',
      '...1h...............h1...',
      '.........f.....f.........',
      '.........................',
      '.........................',
      '.........................',
    ],
    marks: {
      '@': spawn('entrance', 'up', '|'),
      A: npc('keeper', 'sage', '.', { event: 'temple_altar', dir: 'down' }),
      '0': { npc: { id: 'glow_light', sprite: 'obj:crest_glow', cond: BROKEN, fixedDir: true, text: '光の紋章の力が、\n祭壇に宿っている……。' }, under: 'a' },
      '4': glow('glow_wind', 'C'),
      '5': glow('glow_water', 'C'),
      '7': glow('glow_earth', 'C'),
      '8': glow('glow_fire', 'C'),
      '9': glow('glow_star', 'C'),
      N: npc('temple_nun', 'nun', '.', { event: 'church', greet: '光の神殿へようこそ。\nここで休み、\nお祈りをしていきなさい。', dir: 'down' }),
      M: chat('temple_monk', 'priest', '.', [
        { cond: BROKEN, text: '魔の渦が消えた今こそ、\n魔王を討つときです。\f神の光が、\nあなたたちとともに\nありますように。' },
      ], ['この神殿は100年前、\n勇者たちが光の紋章を\n生み出した場所。', '奥の祭壇を囲む\n五つの台座に、\n紋章を捧げるのです。'], { dir: 'left' }),
      '$': chest('light_temple_c1', 'light_drop', 1),
    },
  };

  R.DB.maps.edge_shrine = {
    name: '最果ての祠', type: 'shrine', legend: 'local', theme: 'shrine', bgm: 'shrine',
    location: 'edge_shrine', outside: '~',
    exit: { to: 'world', spawn: 'edge_shrine' },
    rows: [
      '##########################',
      '##########################',
      '#b.b.uI.#....O....#u.u.uj#',
      '#b.b.ccc#....a....#.E.G.H#',
      '#.......#l...+...l#cccccc#',
      '#.......#....+....#......#',
      '#.......D....+....D..v...#',
      '#.N.....#....+....#......#',
      '#......o#....+....#...?.o#',
      '#############D############',
      '~df,,,,,,,,Y...Y,,,,,,,fd~',
      '~df~~~,,,,,,...,,,,,~~~fd~',
      '~df~~~,,z,,,...,,y,,~~~fd~',
      '~df,,,,g%g,,...,,,,,,,,fd~',
      '~d,T,,,,,,,,...,,,T,,,T,d~',
      '~ddddddddddd.|.dddddddddd~',
      '~~~~~~~~~~~~~@~~~~~~~~~~~~',
    ],
    decor: [
      '..........................',
      '...i...w..W.BcB.W...x...k.',
      '..y.F..V.Z.QdddQ.Z..X.Y...',
      '..........................',
      '............a.a...........',
      '.RRR......ee...ee.........',
      '.RRR....................q.',
      '...Tn.....ee...ee.........',
      '.Z....q..v.......v.Z...U..',
      '..........B.i.i.B.........',
      '.....h..............h.....',
      '.......e..........e.......',
      '..........................',
      '...1.1....h3...3h...1.1...',
      '......f...f...............',
      '..........................',
      '..........................',
    ],
    marks: {
      '@': spawn('entrance', 'up', '|'),
      O: npc('priestess', 'nun', '.', { event: 'church', greet: '最果ての祠へようこそ。\nここが最後の、\n癒やしの場所です。', dir: 'down' }),
      I: npc('innkeeper', 'innkeeper', '.', { event: 'inn', price: 80, dir: 'down' }),
      E: shop('weapon', '.', 'edge_shrine_weapon', { dir: 'down' }),
      G: shop('armor', '.', 'edge_shrine_armor', { dir: 'down' }),
      H: shop('item', '.', 'edge_shrine_item', { dir: 'down' }),
      v: say('customer', 'woman', '.', 'ここまで来たら、\n惜しまずいい装備を\nそろえるのよ。\fお金を残しても、\n魔王はまけてくれないわ。', { dir: 'up' }),
      N: say('inn_guest', 'knight', '.', 'わしはレグナスの騎士。\f魔王城には、魔王のしもべ、\nふたりの将軍がおるという。\f黒い鎧の騎士と、\n闇の魔導師……。\n心して行くのだぞ。', { dir: 'right' }),
      z: say('traveler', 'old_man', ',', '魔王城は、この島の東。\n闇の力が\n渦巻いておる……。\f中は深く入り組んでおる。\nときどき戻って休むのじゃ。', { dir: 'down' }),
      y: chat('maiden', 'girl', ',', [
        { cond: 'game_clear', text: '魔王を倒して\nくださったのですね……！\nありがとうございます！' },
      ], ['わたしはこの祠の巫女。\fここの祈りは、魔王の闇から\n身を守る最後の光なのです。', '魔王は、光の力を\n何よりも恐れていると\n伝えられています。'], { dir: 'down' }),
      '?': chest('edge_shrine_h1', 'revive_feather', 1),
      '%': sign('魔王に挑み、\n帰らなかった勇敢な者たちが、\nここに眠る。'),
    },
  };
})(window.RPG);
