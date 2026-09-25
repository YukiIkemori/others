// 雪の村フロスト (northern snowfield, Lv 18–22) and its two house interiors.
// Map ids: frost_village frost_house_elder frost_house
// Village: the church (NW), the elder's house (N), the inn with its hearth (NE);
// the fenced skating pond, the plaza with the ice sculpture, the well and a soup
// stall, the shop hall (weapons / armor / items); a spring-fed stream that never
// freezes (three bridges); the explorer's house with its woodshed (SW), the
// woodyard (SE) and the south gate. Every map has a decor layer (DESIGN §7.1,
// legend R.DB.legends.decor in src/data/tiles.js).
// No hidden items: the old examine-to-find items are visible chests (same ids).
// Review: node tools/fixtures/towns/frost/check.js  (decor-aware reachability)
//         node tools/fixtures/towns/frost/render.js (whole-map PNGs)
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const GOLD = { item: 'gold_key' };

  R.DB.maps.frost_village = {
    name: '雪の村フロスト', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'frost', outside: 'T',
    exit: { to: 'world', spawn: 'frost_village' },
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TTT******************************TTT",
      "T*BBBBBBBBBBB**RRRRRRR*BBBBBBBBBBB*T",
      "T*B__Y_O_Y__B**RRRRRRR*Bb_b_b____B*T",
      "T*B___aaa_J_B**BBB<BBB*Bb_b_b____B*T",
      "T*B____+____BT****4*o**B_u_______B*T",
      "T*B____+____B*FFFF*****B_Ic_Q____B*T",
      "T*B____+____B*F******n*Bccc______B*T",
      "T*B____+____B*F*******TB______N__B*T",
      "T*BBBBBDBBBBB**********BBBBBBDBBBB*T",
      "T::::::::(::::::::::::::::::::[::::T",
      "T*************........*************T",
      "T*FFFFFFFFFFFF........BBBBBBBBBBBBBT",
      "T*FeeeeeeeeeeF...Y....B___B___BuuuBT",
      "T*FeeyeeeeeeeF...A....B_E_B_G_B_H_BT",
      "T*FeeeeeeeweeF........BcccBcccBcccBT",
      "T*FeeeeeeeeeeF.W...Z..B___________BT",
      "T*FFFFF**FFFFF........B________U__BT",
      "T*************........B_________j?BT",
      "TT************........BBBBBBDBBBBBBT",
      "T************T........**-**/****\\**T",
      "T::::::::::::::::::::::::::::::::::T",
      "T~~~~~~~~~|~~~~~~||~~~~~~~~~~|~~~~~T",
      "T~~~~~~~~~|~~~~~~||~~~~~~~~~~|~~~~~T",
      "T*********:******::****************T",
      "T*RRRRRRR*:***T**::*****FFFFFFFFFF*T",
      "T*RRRRRRR*:******::}*********RRRR**T",
      "T*BBB>BBB*:*$o***::**T****M**RRRR**T",
      "T***:5:::::******::**********BBBB**T",
      "T*T**********T***::***T*6**********T",
      "T********T******V::X*************T*T",
      "TTTTTTTTTTTTTTTTT@:TTTTTTTTTTTTTTTTT",
    ],
    decor: [
      "....................................",
      "....................................",
      "...W.B.c.B.W.............w.w.p..i...",
      "...Q.......Q.............y.y.Z.FU...",
      "...................i.........rrrr...",
      "......z........UU....q........nTn...",
      "....ee...ee.............C...........",
      "...............11..........z........",
      "...Z.......Z...ff..h....q.......Z...",
      "....w.i.i.w.........E....w..i...w...",
      ".........8....................7.....",
      "..............3......3..............",
      "........................x...c...k...",
      "................1.1....X.X.Y.Y......",
      ".......................O.....v.q.v..",
      "....................................",
      ".h............h......q.V..ZRRR...o..",
      "...................99U..a..RRR..z...",
      "....ee....ee.h.e.......Zee.RRR......",
      "...1.1...h..........................",
      ".......3..3...3......3..5..6....4.3.",
      "....................................",
      "....................................",
      "....................................",
      "............h...3..3................",
      "...........UU.........h.............",
      "...........UUq......e.....UUU.......",
      "...............h.........O..........",
      "...1................h...............",
      "........h......3....3......sME..M...",
      "...............................s....",
      "....................................",
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('elder_house', 'down', '*'),
      '5': spawn('house', 'down', ':'),
      '<': warp('frost_house_elder', 'entrance', 'D', 'up'),
      '>': warp('frost_house', 'entrance', 'D', 'up'),
      // church
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', '暖炉のない教会は、\n寒いでしょう？\fでも、神の愛は\nいつでも温かいのですよ。', { dir: 'down' }),
      '(': sign('フロスト教会\f凍えた旅人よ、\n遠慮なく扉をたたきなさい。', ':'),
      // inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 40, dir: 'down' }),
      N: say('inn_guest', 'man', '_', '炎の火山の中には、\n歩くだけでやけどする\n溶岩の床があるそうだ。\f時空術師の『浮遊の術』が\nあれば、平気らしいがな。', { dir: 'up' }),
      Q: say('inn_cat', 'cat', '_', 'ゴロゴロ……。\f暖炉のそばが\nお気に入りのようだ。', { move: 'wander' }),
      '[': sign('旅人の宿屋', ':'),
      // shop hall
      E: shop('weapon', '_', 'frost_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'frost_armor', { dir: 'down' }),
      H: shop('item', '_', 'frost_item', { dir: 'down' }),
      U: say('customer', 'woman', '_', '氷結の洞窟の魔物は、\n凍える息を吐いてくるの。\f霜よけの指輪があれば、\nずいぶん楽になるわよ。', { dir: 'up' }),
      '?': chest('frost_h1', 'nectar', 1, '_'), // formerly hidden in a barrel; now a visible chest
      '-': sign('武器屋', '*'),
      '/': sign('防具屋', '*'),
      '\\': sign('道具屋', '*'),
      // streets
      n: chat('hunter', 'man', '*', [
        { cond: 'game_clear', text: '魔王がいなくなってから、\n魔物もおとなしくなったな。\nこれで猟に精が出るぜ。' },
        { cond: GOLD, text: '金の鍵を手に入れたのか！\fそれなら、北東の島の火山にも、\n東の星見の塔にも\n入れるはずだ。\f火山の主は、氷や水の力に\n弱いと聞いたぞ。' },
      ], ['氷結の洞窟は、この雪国の\nずっと東にある。', '奥には氷河の巨人が\n眠っているらしい。\n炎の魔法がよく効くそうだぞ。'], { dir: 'left' }),
      y: say('skater_girl', 'girl', 'e', '氷の上を滑るの、\n楽しいよ！\fえ？　全然滑ってない？\n気分よ、気分！', { move: 'wander' }),
      w: say('skater_boy', 'boy', 'e', 'あの氷の像、見た？\nじいちゃんが彫ったんだ！\nすごいでしょ！', { move: 'wander' }),
      A: say('snowman_maker', 'old_man', '*', 'ほっほっ、この氷の像は\nわしの自慢の作品じゃ。\fこの村では、冬が一年じゅう\n続くのじゃよ。', { dir: 'up' }),
      Z: say('soup_vendor', 'woman', '*', '温かいスープはいかが？\f……と言いたいところだけど、\n今日の分は売り切れなの。\fこの小川にはね、山の温泉が\n流れ込んでいるから、\n冬でも凍らないのよ。', { dir: 'down' }),
      '6': say('snow_girl', 'girl', '*', '寒いけど、雪遊びは\nやめられないの！\f雪合戦する？\nえいっ！', { move: 'wander' }),
      M: say('woodcutter', 'dwarf', '*', '薪を割っておかないと、\n夜は凍えちまう。\fあんたたちも、しっかり\n宿で温まっていきな。', { dir: 'up' }),
      '$': chest('frost_c1', 'healing_aroma', 2, '*'),
      V: say('gate_l', 'soldier', '*', 'ようこそ、フロストの村へ。\n寒かったろう。', { dir: 'right' }),
      X: say('gate_r', 'soldier', '*', '雪の降る夜は、\n魔物も多くなる。\n気をつけて行くのだぞ。', { dir: 'left' }),
      '}': sign('雪の村フロスト\fはるか東に、\n氷結の洞窟あり。'),
    },
  };

  // the elder's house: hearth, study corner, kitchen, the elder's bed
  R.DB.maps.frost_house_elder = {
    name: '雪の村フロスト', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      "############",
      "#kk.......b#",
      "#.........b#",
      "#........v$#",
      "#.....E....#",
      "#.........?#",
      "#p....@...o#",
      "######<#####",
    ],
    decor: [
      "...P.i.i.w..",
      "...I..F.A...",
      ".....rrr....",
      ".Dn..rrr....",
      ".C..a....z..",
      ".K.....nTn..",
      "..q......U..",
      "............",
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('frost_village', 'elder_house', 'D', 'down'),
      E: chat('elder', 'elder', '.', [
        { cond: GOLD, text: ['金の鍵を手に入れたか。', '金の扉は、北東の島の\n炎の火山と、東の大陸の\n星見の塔にある。\fどちらにも、紋章が\n祀られておるはずじゃ。'] },
      ], ['よく来たな。\nわしがこの村の村長じゃ。', '金の鍵は昔、\n氷結の洞窟の奥に\n封印されたのじゃ。\f氷河の巨人が、\n今も鍵を守っておる。', '洞窟は、この村の\nずっと東。雪の深い道を\n進むのじゃ。'], { dir: 'down' }),
      v: say('elder_wife', 'old_woman', '.', '寒い中、よく来たねえ。\n暖炉にあたって\nいきなさいな。\fこの村じゃ、薪は\n何より大事な宝物なのさ。', { dir: 'left' }),
      '$': chest('frost_elder_c1', 'thunder_bomb', 2),
      '?': chest('frost_elder_h1', 'seed_int', 1), // formerly hidden in a pot; now a visible chest
    },
  };

  // the old explorer's house: two beds, hearth, kitchen, trophies of his travels
  R.DB.maps.frost_house = {
    name: '雪の村フロスト', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      "##########",
      "#b.b.....#",
      "#b.b.....#",
      "#....G..$#",
      "#........#",
      "#..w.....#",
      "#o..@...o#",
      "####>#####",
    ],
    decor: [
      "..w.i.i.k.",
      "..y..F.KS.",
      "....rrr.C.",
      "....rrr...",
      ".Y....nTn.",
      ".X..z.....",
      "..U....a..",
      "..........",
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('frost_village', 'house', 'D', 'down'),
      G: say('explorer', 'old_man', '.', [
        'わしは昔、冒険者\nでな……。',
        '氷河の巨人にやられた傷が、\n今でも痛むわい。\fあやつの力任せの攻撃は\n恐ろしい。ナイトの\n『かばいだて』で、\n弱い仲間を守るのじゃ。',
      ], { dir: 'down' }),
      w: say('grandson', 'boy', '.', 'じいちゃんの冒険の話、\nもう100回は聞いたよ。\fでも、巨人の話のときだけは、\nいつも本気の顔なんだ。', { move: 'wander' }),
      '$': chest('frost_house_c1', 'fire_ring', 1),
    },
  };
})(window.RPG);
