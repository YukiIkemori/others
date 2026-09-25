// 魔法都市アルカナ (eastern continent, Lv 25–30): the magic academy ({metem}'s
// school), the library of job lore, magic circles that teleport across the city,
// {metem}'s family home; hints toward the star tower.
// Map ids: arcana_city arcana_house_metem
//
// Layout (arcana_city, 44x37):
//   north   the academy: west classroom · headmaster's hall (dais, runner) · east laboratory,
//           flanked by the teleport garden (NW circle) and the stargazing terrace (NE)
//   middle  the inn (W) · the fountain plaza with two circles, a stall and the fortune teller ·
//           the magic shop hall (E: weapons / items / armour behind one long counter)
//   canal   a water channel across the city with three bridges
//   south   the library (SW) · the church (centre, facing the gate) · {metem}'s house and yard (SE,
//           third circle) · the south lawn and the gate
// Every map has a decor layer (DESIGN §7.1, legend R.DB.legends.decor in src/data/tiles.js).
// No hidden items: the old ones are visible chests now (library corner, the house kitchen corner).
// Review: node tools/fixtures/towns/arcana/check.js   (decor-aware reachability)
//         node tools/fixtures/towns/arcana/render.js  (whole-map PNGs with decor + NPCs)
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir, sfx: 'warp' }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const STAR = { item: 'crest_star' };
  const GOLD = { item: 'gold_key' };

  R.DB.maps.arcana_city = {
    name: '魔法都市アルカナ', type: 'town', legend: 'local', theme: 'tower', bgm: 'town',
    location: 'arcana', outside: '#',
    exit: { to: 'world', spawn: 'arcana_city' },
    rows: [
      '############################################',
      '#T,,,,,T###########################TT,,,,TT#',
      '#,,f,f,,#kk____kk#k..A..k#kk____k$#,,,~~~,,#',
      '#,,,,,,,#___M____#.......#________#,,,~~~,,#',
      '#,,,,,,,#_tt__tt_#.......#________#,,,,,,,,#',
      '#,f,,,f,#_hQ__hh_D.l...l.D_hZh____#,,,,,,,,#',
      '#,,,(,,,#_tt__tt_#.......#________#,,,0,,,,#',
      '#,f,,,f,#_hh__Nh_#.l...l.#____U___#,,,,,,,,#',
      '#,,,,,,,#________#.......#________#,f,,,,f,#',
      '#,,,,,,,#________#.......#________#,,,,,,,,#',
      '#T,,,,,T#############D#############T,,,,,,T#',
      '#..................Y....Y..................#',
      '#........9.......7.........................#',
      '############T..................T############',
      '##b_b___cuu#....................#u_______u##',
      '##b_b___cI_#....................#_E__H__G_##',
      '##______ccc#..<..............>..#ccccccccc##',
      '##_htn_____#....................#_________##',
      '##_________#....................#____V____##',
      '##_________#..4...........8..y..#_________##',
      '######D#####....................#####D######',
      '#......;............................"......#',
      '#~~~~~|~~~~~~~~~~~~~~||~~~~~~~~~~~~~~|~~~~~#',
      '#~~~~~|~~~~~~~~~~~~~~||~~~~~~~~~~~~~~|~~~~~#',
      '#..........................................#',
      '#############..#############..,RRRRRRRR,T,T#',
      '##k[kk_kk]kk#..#....YOY....#..,RRRRRRRR,,,,#',
      '##_________%#..#....aaa....#..,BBB/BBBB,f,f#',
      '##kk{k__tt__#..#...........#..,,,,6,,,,,,,,#',
      '##______wh__#..#...........#..,,,,:,,,5,,,,#',
      '##kk}k______#..#...........#..,,,,:,,,,,W,,#',
      '##__________#..#..........X#..,ff,:,,,,,,,,#',
      '##!_______J_#..#...........#..,ff,:,,,,,),,#',
      '######D######..######D######..,,,,:,,,,,,,,#',
      '#......&...................................#',
      '#,,,,,,,,,,,,,,,,,,-v..z,,,,,,,,,,,,,,,,,,,#',
      '#####################@.#####################',
    ],
    decor: [
      '............................................',
      '..h.1.....w....w.....c.....w....w.......1...',
      '............DDI....ddddd....C..Q............',
      '.222.222........z.QdddddQ................f..',
      '..................I.RRR.V..LLL..K...3.......',
      '....................RRR.....................',
      '..3.................RRR.............e...I...',
      '.....f..............RRR.....oo..............',
      '..e.................RRR.....oo.......1......',
      '.22...22...C..V.....RRR........y...222..222.',
      '..........W........B.........W..............',
      '..........1.................1...............',
      '....................oooo................3...',
      '...w.....w..........oooo..........x.....c...',
      '.....yF..........3.1......3.......X.C.C.....',
      '....................JJJJ...........O........',
      '..................e.JJJJ.e..................',
      '.......rrr..........JJJJ....................',
      '.......rrr..................RRR.............',
      '..A.........E...............R.RQ............',
      '....w........999q...........nT....w.....w...',
      '.......7............................5.......',
      '............................................',
      '............................................',
      '............................................',
      '...W.....i.......W.....B....................',
      '......Q.........ZQ.ddddd.QZ.................',
      '................................w.....w.....',
      '..........IZ........RRR.........1...........',
      '.................eeeRRReee....3..........h..',
      '.......RRRR.........RRR.............M.......',
      '.......RRRR......eeeRRReee.........2222.....',
      '.........D..........RRR.....................',
      '...w.....w.......W.....i..............e.....',
      '............................................',
      '..2222.....1..h..3.8.......1......h..2222...',
      '............................................',
    ],
    // the four circles: plaza west ↔ plaza east, academy garden (NW) ↔ {metem}'s yard (SE);
    // each spawn sits on its own circle, so arriving does not send the party straight back
    spawns: {
      pad_w: { x: 14, y: 16, dir: 'down' },
      pad_e: { x: 29, y: 16, dir: 'down' },
      pad_nw: { x: 4, y: 6, dir: 'down' },
      pad_se: { x: 40, y: 32, dir: 'up' },
    },
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '6': spawn('metem_house', 'down', ':'),
      '/': warp('arcana_house_metem', 'entrance', 'D', 'up'),
      '<': warp('arcana_city', 'pad_e', 'P'),
      '>': warp('arcana_city', 'pad_w', 'P'),
      '(': warp('arcana_city', 'pad_se', 'P'),
      ')': warp('arcana_city', 'pad_nw', 'P'),
      // ---- academy: headmaster's hall
      A: chat('headmaster', 'sage', '.', [
        { cond: 'game_clear', text: ['{metem}……よくやった。', 'おまえの名は、永遠に\nこの学院の歴史に\n刻まれるじゃろう。'] },
        { cond: STAR, text: ['星の紋章を手に入れたか。\nさすがは、わしの\n自慢の弟子じゃ。', '紋章が五つそろったら、\n光の神殿へゆくのじゃ。\n世界の真ん中の島にある。'] },
        { cond: GOLD, text: ['おお、{metem}！　よく戻ったのう。', '星見の塔は、町の北東じゃ。\n金の扉の先に、\n星の紋章が祀られておる。\f頂を守る星の守護神は、\n闇の力に弱いという。\n聖なる力は効かぬぞ。'] },
      ], ['おお、{metem}！　よく戻ったのう。', '星見の塔の扉は、\n金の鍵で閉ざされておる。\f鍵は、北の雪国にあると聞く。'], { dir: 'down' }),
      // ---- academy: west classroom
      M: say('teacher', 'scholar', '_', '魔法剣士には、\nナイト3と黒魔術師3で\nなれる。\f剣と魔法を合わせた技は、\n頼もしいぞ。', { move: 'wander' }),
      Q: say('student_a', 'boy', 'h', '{metem}先輩！\nおかえりなさい！\f先輩は、学院始まって以来の\n天才って言われてるんですよ！', { dir: 'up' }),
      N: say('student_c', 'boy', 'h', '時空術師には、\n黒魔術師4と吟遊詩人3で\nなれるんだ。\f時を操る魔法って、\nかっこいいよね！', { dir: 'up' }),
      // ---- academy: east laboratory
      Z: say('student_b', 'girl', 'h', '白魔術師と黒魔術師を、\nどちらもジョブレベル5まで\n鍛えると、賢者に\nなれるんですって。', { dir: 'up' }),
      U: say('student_d', 'girl', '_', 'わたし、{metem}先輩みたいに\nなりたいんです！\fだから毎日、\n本を読んでるんです！', { move: 'wander' }),
      '$': chest('arcana_academy_c1', 'magic_orb', 1, '_'),
      // ---- stargazing terrace
      '0': say('old_mage', 'sage', ',', '魔の渦の向こうの魔王城。\nあそこは、まさに地獄……。\f光の紋章がなければ、\n近づくこともできまい。', { dir: 'down' }),
      // ---- inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 60, dir: 'down' }),
      n: say('inn_guest', 'man', 'h', 'この町の魔法陣に乗ると、\n町の端から端まで\nひとっ飛びできるんだ。', { dir: 'left' }),
      ';': sign('旅人の宿屋', '.'),
      // ---- magic shop hall
      E: shop('weapon', '_', 'arcana_weapon', { dir: 'down' }),
      H: shop('item', '_', 'arcana_item', { dir: 'down' }),
      G: shop('armor', '_', 'arcana_armor', { dir: 'down' }),
      V: say('customer', 'woman', '_', '星くずの装備は、\nこの町でしか\n手に入らないのよ。', { dir: 'up' }),
      '"': sign('魔法の店\n武器・防具・道具', '.'),
      // ---- plaza
      y: npc('fortune_teller', 'sage', '.', { event: 'fortune', dir: 'down' }),
      '4': say('stall_keeper', 'man', '.', 'この露店では、\n星くずの砂を売ってるんだ。\f夜空にまくと、\nきらきら光ってきれいだよ。\n……戦いの役には立たないけどね。', { dir: 'down' }),
      '7': say('plaza_woman', 'woman', '.', '噴水の水は、学院の魔法で\nくみ上げているのよ。\f夜になると、水が\n青く光ってきれいなの。', { move: 'wander' }),
      '8': say('plaza_granny', 'old_woman', '.', 'あの{metem}ちゃんが、\n世界を救う旅に出るなんてねえ。\f小さいころは、よくこの噴水で\n水遊びをしていたのよ。', { move: 'wander' }),
      '9': say('avenue_scholar', 'scholar', '.', '図書館には、\n上級ジョブの本がそろっている。\f新しいジョブに迷ったら、\n行ってみるといい。', { move: 'wander' }),
      // ---- library
      J: say('librarian', 'woman', '_', 'ここはアルカナ図書館。\f本棚の本は、自由に\n読んでいいのよ。\nジョブのことも、詳しく\n書いてあるわ。', { dir: 'left' }),
      w: say('reader', 'scholar', 'h', 'しーっ！\n図書館では、お静かに！', { dir: 'up' }),
      '%': chest('arcana_library_c1', 'goddess_tear', 1, '_'),
      '!': chest('arcana_h1', 'seed_mp', 1, '_'), // formerly hidden in a bookshelf; now a visible chest
      '&': sign('アルカナ図書館'),
      '[': sign('『三段階目のジョブ　その1』\f魔法剣士：\nナイト3＋黒魔術師3\fパラディン：\nナイト5＋白魔術師4\f忍者：\n狩人4＋武闘家3', 'k'),
      ']': sign('『三段階目のジョブ　その2』\f賢者：\n白魔術師5＋黒魔術師5\f竜騎士：\nナイト4＋狩人4\f時空術師：\n黒魔術師4＋吟遊詩人3\f暗黒騎士：\n戦士6＋黒魔術師4', 'k'),
      '{': sign('『伝説の勇者』\fパラディンと魔法剣士を、\nともに5まで鍛えし者、\n勇者とならん。', 'k'),
      '}': sign('『星見の塔』\f古の魔法使いが、\n星を読むために建てた塔。\f最上階には、\n星の紋章が\n祀られている。', 'k'),
      // ---- church
      O: npc('priest', 'priest', '.', { event: 'church', dir: 'down' }),
      '-': sign('アルカナ教会\n旅の無事を、星に祈りましょう。', ','),
      X: say('nun', 'nun', '.', '星の光は、神のまなざし。\nいつも見守っていますよ。', { dir: 'left' }),
      // ---- {metem}'s yard
      '5': say('metem_cat', 'cat', ',', 'ニャーン。\f……{metem}の家の猫のようだ。', { move: 'wander' }),
      // ---- gate
      v: say('gate_l', 'soldier', ',', 'ようこそ、魔法都市アルカナへ。', { dir: 'right' }),
      z: say('gate_r', 'soldier', ',', '町の中の魔法陣は、\n誰でも使っていいぞ。', { dir: 'left' }),
    },
  };

  // {metem}'s family home: kitchen and dining corner (W), her old study corner (E).
  R.DB.maps.arcana_house_metem = {
    name: '魔法都市アルカナ', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#.....kk.b.#',
      '#...G....b.#',
      '#.........[#',
      '#..........#',
      '#.......E..#',
      '#..........#',
      '#?....@...$#',
      '######/#####',
    ],
    decor: [
      '..w.....p...',
      '.CK.F.....y.',
      '..........A.',
      '.nTn...RRRD.',
      '..n....RRR..',
      '............',
      '............',
      '............',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '/': warp('arcana_city', 'metem_house', 'D', 'down'),
      G: npc('metem_mother', 'woman', '.', { event: 'metem_mother', dir: 'down' }),
      E: say('metem_father', 'scholar', '.', '{metem}は小さいころから、\n星を見るのが好きでな。\fまさか、世界を救う旅に\n出るとは……。\fおふたりとも、娘を\nよろしく頼みます。', { dir: 'left' }),
      '$': chest('arcana_metem_c1', 'mana_crystal', 2),
      '?': chest('arcana_metem_h1', 'seed_int', 1), // formerly hidden in a pot; now a visible chest
      '[': sign('{metem}のノートだ。\f「星の地図を完成させる。\nそれがわたしの夢。」\f落書きで、猫の絵が\n描いてある……。', '.'),
    },
  };
})(window.RPG);
