// レグナス城 + 城下町レグナス (start continent, Lv 1–3) and the town's house interiors.
// Map ids: regnas_castle regnas_town regnas_house_yuki regnas_house_elder regnas_storehouse
// Every map has a decor layer (DESIGN §7.1, legend R.DB.legends.decor in src/data/tiles.js):
// wall hangings on the wall rows, rugs / dais / inlays / cracks on the floors, furniture,
// and in the town lamps, shop signs, stalls, hedges, flowerbeds and the fountain.
// Review: node tools/fixtures/towns/regnas/check.js (decor-aware reachability) and
//         node tools/fixtures/towns/regnas/render.js (whole-map PNGs with decor + NPCs).
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

  // ================================================================ castle
  // Throne room (north, centre) with the royal chamber (east) and the library
  // (west) off the dais; below it the great hall, flanked by the guard room +
  // barracks, the treasury (silver-door vault), the kitchen + dining hall and
  // the chapel; the garden courtyard with the fountain and the dog run in front.
  // Contracts: king (19,2) on the throne, spawn 'start' (19,3) right below him,
  // spawn 'ending' (19,9) six steps down the runner (src/systems/ending.js).
  R.DB.maps.regnas_castle = {
    name: 'レグナス城', type: 'castle', legend: 'local', theme: 'castle', bgm: 'castle',
    location: 'regnas', outside: ',', onEnter: 'regnas_castle_enter',
    exit: { to: 'world', spawn: 'regnas_castle' },
    rows: [
      '########################################',
      '#k[k]k__k{k}k#...++++++...#_______bb___#',
      '#____________D...+MAQ++...D_______bb___#',
      '#_kkkk_______#...++0+++...#____________#',
      '#______I_____#............#____________#',
      '#_________H__#.l........l.#___4________#',
      '######D#######...E....G...#____________#',
      '#b.b.........#............##############',
      '#b.b.........#.l........l.#..$.%..#(..)#',
      '#............#............#......V#....#',
      '#....z.......######DD######.......1....#',
      '#bJb.........#............#.......#....#',
      '#b.b.........D............D.......#pp..#',
      '######D#######.l........l.##############',
      '#....._______#........w...#....YOY.....#',
      '#.N..._______#............#..U..aa.....#',
      '#....._______#.l........l.D............#',
      '#o...._______#............#............#',
      '#o?..._______#...5........#............#',
      '#####D#############DD###########DD######',
      '#......................................#',
      '#T,,,,,,,,,,,,,,........,:::::::::::::T#',
      '#T,fffffffffff,,........,:::::::::::::T#',
      '#T,......................:::::::::::::T#',
      '#T,fffffnfffff,,........,::::6:7::::::T#',
      '#T,,,,,,,,,,,,,,........,::::::::v::::T#',
      '#T,,,,,,,,,,,,,,........,:::::::::::::T#',
      '#T,f~~~~~~,f,,,,........,FFFFF,FFFFF,,T#',
      '#T,f~~~~~~f,,,TT,,,..,,,TT,y,,,,,,,,,,T#',
      '#TTT,,,,,,,,,,,,,,X..Z,,,,,,,,,,,,,,TTT#',
      '###################@.###################',
    ],
    decor: [
      '...i.......i.....b....b......m....c.....',
      '.......V......Y.QddddddQ.Y..Ay.F....y...',
      '.................dd..dd.................',
      '........RRR.I....dddddd........rrrrrr...',
      '........RRR........rr..z....nTnrrrrrr...',
      '.Q.nTn...D.........rr..........rrrrrr...',
      '..x.......b.......arr................D..',
      '..y....XY..........rr.......c.....c.....',
      '...................rr......Y.....Y..GG..',
      '......nTn.....Z....rr....Z..............',
      '.......n.......i.....b.......RRR........',
      '..............Y....rr....Y...RRR........',
      '........eee........rr...................',
      '...k....p..........rr.......W....c......',
      '.CK.........Z.e...oooo...e.Q.Z......Z.Q.',
      '........eeee..e...oooo...e..............',
      '........LLLL................eee.RR.eee..',
      '........eeee................eee.RR.eee..',
      '...U..........Z..........Z......RR......',
      '..w......w.....W.....i......w.......W...',
      '........z...z..................8........',
      '...22222.22222..13.....1.X.Y.....U.M....',
      '........................................',
      '..................JJJJ..............E...',
      '................e.JJJJ.e.............q..',
      '...22222.22222....JJJJ..................',
      '..h..........h............Y.............',
      '........................................',
      '.................................h......',
      '........................................',
      '........................................',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '0': spawn('start', 'up', '+'),
      // throne room
      A: npc('king', 'king', 'K', { event: 'king_talk', dir: 'down' }),
      Q: chat('queen', 'queen', 'K', [
        { cond: 'game_clear', text: 'おかえりなさい。\nあなたたちは、この国の\n誇りですよ。' },
        { cond: 'barrier_broken', text: '魔の渦が消えたと聞きました。\nどうか、みんな無事に\n帰ってきてね。' },
      ], 'わたくしは毎日、\nあなたたちの無事を\n祈っていますよ。', { dir: 'down' }),
      M: say('minister', 'minister', '+', [
        '困ったときは、Bボタンで\nメニューを開き、\n『次の目的』を\n確かめるのですぞ。',
        'また、メニューの『セーブ』で、\n戦闘中以外なら、いつでも\n記録を残せますぞ。',
      ], { dir: 'right' }),
      E: say('guard_l', 'soldier', '.', 'ここはレグナス城、\n玉座の間である。\f王様に話しかければ、\n冒険の記録を\nつけていただけるぞ。', { dir: 'right' }),
      G: chat('guard_r', 'soldier', '.', [
        { cond: 'gate_open', text: '関所の兵から聞いたぞ。\n見事、風の紋章を\n手に入れたそうだな！' },
      ], '東の関所は、魔物が増えて、\n今は固く閉ざされておる。', { dir: 'left' }),
      // library
      H: say('scholar', 'scholar', '_', [
        'ジョブのことなら、\nわたしにお任せください。',
        '戦いに勝つと、経験値のほかに\nJPがもらえます。\nJPは、今のジョブにたまるのです。',
        'JPを使えば、メニューの『ジョブ』で\nアビリティを覚えられます。\nJPがたまると、\nジョブレベルも上がります。',
        'ジョブレベルを上げると、\n新しいジョブに\n転職できるようになります。',
        '覚えたアビリティは『セット』で、\nほかのジョブでも使えますぞ。\f詳しくは、本棚の本を\n読んでみなされ。',
      ], { dir: 'left' }),
      I: say('sage', 'sage', '_', [
        'わしはこの城の学者じゃ。',
        '魔王ヴァルザードは100年前、\n世界を闇で覆った。',
        '光の紋章を掲げた\n昔の勇者たちが、\nやつを封じたのじゃ。',
        'そなたたちが紋章の光を\n宿して生まれたのも、\n何かの定めかもしれんのう。',
      ], { dir: 'down' }),
      '[': sign('『ジョブの手引き　その1』\f戦士3 → ナイト\n僧侶3 → 白魔術師\n魔法使い3 → 黒魔術師\n盗賊3 → 狩人\f※数字はジョブレベルを表す。', 'k'),
      ']': sign('『ジョブの手引き　その2』\f二つのジョブを鍛えると、\n新たなジョブが開かれる。\f戦士2＋僧侶2 → 武闘家\n僧侶2＋盗賊2 → 吟遊詩人\n魔法使い2＋盗賊2 → 薬師', 'k'),
      '{': sign('『アビリティのセット』\f覚えたアビリティは、\n『セット』でつけかえられる。\fサブアクション、リアクション、\nサポート、フィールドの\n四つの枠がある。\fほかのジョブで覚えた技も、\nサブアクションにすれば\n使えるのだ。', 'k'),
      '}': sign('『魔王ヴァルザード』\f100年前、世界を闇に\n包んだ魔王。\n光の紋章の力で\n封じられたという。\f紋章は風・水・大地・炎・星の\n五つに分かたれ、\n世界の各地に祀られた……。', 'k'),
      // royal chamber
      '4': say('maid', 'woman', '_', '王様と王妃様のお部屋です。\nお静かに願いますね。\f……王様ったら、夜ふけまで\n世界の地図を眺めては、\nあなたたちの旅を\n案じておられるのですよ。', { move: 'wander' }),
      // guard room + barracks
      z: say('knight', 'knight', '.', '{yuki}！　おまえの父上も\n立派な剣士だった。\nおまえにも期待しているぞ！', { dir: 'down' }),
      J: say('barracks', 'soldier', '.', '訓練のあとの昼寝は\n最高だぜ……。\fおっと！　今のは隊長には\n内緒だぞ。', { dir: 'down' }),
      // treasury
      V: chat('treasury_guard', 'soldier', '.', [
        { cond: { item: 'silver_key' }, text: '銀の鍵を手に入れたのか！\n奥の銀の扉も、\n開けられるはずだ。' },
      ], ['ここは城の宝物庫。\n王様のお許しが出ている。\n好きに持っていくがよい。', 'ただし、奥の銀の扉は、\n銀の鍵がなければ\n開かぬぞ。'], { dir: 'down' }),
      '$': chest('regnas_castle_c1', 'herb', 3),
      '%': chest('regnas_castle_c2', 'wing', 2),
      '(': chest('regnas_castle_v1', 'gold_charm', 1),
      ')': chest('regnas_castle_v2', 'seed_hp', 1),
      // great hall
      '5': say('hall_guard', 'soldier', '.', '城下町には、武器屋、防具屋、\n道具屋がそろっておる。\f旅立つ前に、\n装備を整えていくのだぞ。', { dir: 'down' }),
      w: say('castle_boy', 'boy', '.', '{yuki}兄ちゃん！\n今度、剣の稽古\nつけてよね！', { move: 'wander' }),
      // kitchen + dining hall
      N: say('cook', 'woman', '.', [
        '今日の夕食は、\n魔物の煮込みよ。\fうそよ、うそ！　あはは。',
        '宝物庫なら、大広間の\n東の扉の先よ。\n王様のお許しが出てるから、\n遠慮なく持っていきなさい。',
      ], { dir: 'up' }),
      '?': chest('regnas_castle_h1', 'antidote', 1), // formerly hidden in a pot; now a visible chest
      // chapel
      O: npc('castle_priest', 'priest', '.', { event: 'church', dir: 'down' }),
      U: say('castle_nun', 'nun', '.', '{non}、あなたが勇者の\nひとりに選ばれるなんて。\f神殿のみんなも、\n誇りに思っていますよ。', { dir: 'down' }),
      // courtyard
      X: say('gate_l', 'soldier', ',', 'ここはレグナス城。\n城下町は、すぐ東だ。', { dir: 'right' }),
      Z: say('gate_r', 'soldier', ',', '旅の支度は、城下町で\n整えるとよい。\n薬草を忘れるなよ。', { dir: 'left' }),
      n: say('gardener', 'old_man', ',', '花はいいのう……。\n魔物があふれても、\n花は変わらず咲いておる。', { dir: 'right' }),
      '6': say('trainee_a', 'soldier', ':', 'えいっ！　やあっ！\f……ふう。\n戦いでは『防御』すると、\nその間に受けるダメージが\n半分になるんだ。\f敵の大技が来そうなときは、\n守りを固めるのも手だぞ。', { dir: 'right' }),
      '7': say('trainee_b', 'soldier', ':', '並び順も大事だぞ。\n先頭に立つ者ほど、\n魔物に狙われやすいんだ。\fメニューの『並び替え』で、\n打たれ強い者を前に出すといい。', { dir: 'left' }),
      v: say('castle_dog', 'dog', ':', 'ワンワン！', { move: 'wander' }),
      y: say('castle_girl', 'girl', ',', 'わたし、大きくなったら、\n{metem}さまみたいな\n魔法使いになるの！', { move: 'wander' }),
    },
  };

  // after the last boss: the party returns to cheers (ending scene + post-game)
  R.DB.maps.regnas_castle.spawns = { ending: { x: 19, y: 9, dir: 'up' } };
  R.DB.maps.regnas_castle.npcs = [
    { id: 'cheer_1', x: 17, y: 7, sprite: 'npc:soldier', dir: 'right', cond: 'game_clear', text: '勇者、万歳！\nレグナス、万歳！' },
    { id: 'cheer_2', x: 22, y: 7, sprite: 'npc:soldier', dir: 'left', cond: 'game_clear', text: 'この日を忘れはしないぞ！' },
    { id: 'cheer_3', x: 17, y: 9, sprite: 'npc:soldier', dir: 'right', cond: 'game_clear', text: '魔王を倒すとは……\nわしも誇りに思うぞ！' },
    { id: 'cheer_4', x: 22, y: 9, sprite: 'npc:soldier', dir: 'left', cond: 'game_clear', text: '国じゅうでお祭りだ！' },
    { id: 'cheer_mother', x: 16, y: 4, sprite: 'npc:woman', dir: 'right', cond: 'game_clear', text: '{yuki}……よくがんばったね。\n父さんも、きっと\n喜んでいるよ。' },
    { id: 'cheer_captain', x: 23, y: 4, sprite: 'npc:captain', dir: 'left', cond: 'game_clear', text: 'よう、勇者さまがた！\nおれの船は役に立ったかい？\nがっはっは！' },
    { id: 'cheer_teacher', x: 24, y: 6, sprite: 'npc:sage', dir: 'left', cond: 'game_clear', text: '{metem}や、よくやったのう。\nおまえは、わしの自慢の\n弟子じゃ。' },
  ];

  // ================================================================ town
  // The royal capital: a canal with three bridges splits the walled town.
  // North bank: ユウキ's house, the temple-church and its graveyard, the elder's
  // house. South bank: the weapon and armor shops, the market plaza with the
  // fountain, the inn; further south the item shop, the park pond, the
  // storehouse behind the silver door and the farm; the gate at the bottom.
  R.DB.maps.regnas_town = {
    name: '城下町レグナス', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
    location: 'regnas', outside: ',',
    exit: { to: 'world', spawn: 'regnas_town' },
    rows: [
      '############################################',
      '#TRRRRRRRTTTTTTT############TTTTTTTRRRRRRRT#',
      '#,RRRRRRR,T,,,,T#___YOY____#,FFFFF,RRRRRRRT#',
      '#,BBB<BBB,,,,,!,#____aa____#,Fg:gF,BBB>BBBT#',
      '#,,,,4,,,,,,,,,,#_______J__#,F:::F,,,,5,,TT#',
      '#,,,,:,,,,,,W,,T#__________#,Fg:gFT,,,:FFFF#',
      '#,T,f::::F,v,w,,#__________#,F8::F,,,,:F:::#',
      '#,,f,::::F,,,,,,#__________#,FF:FFT,,,:::::#',
      '#,T,,:FFFFT,,,,,#####DD#####,,,,,,,,,,:FFFF#',
      '#,,,,:,,,,,,,,,,,.......)..,,,,,,,,,,,:,,,,#',
      '#..........................................#',
      '#~~~~|~~~~~~~~~~~~~~~||~~~~~~~~~~~~~~~|~~~~#',
      '#~~~~|~~~~~~~~~~~~~~~||~~~~~~~~~~~~~~~|~~~~#',
      '#......................A...................#',
      '#,BBBBBBBBBBBBB,.7........&.,BBBBBBBBBBBBBB#',
      '#,B_____B_____B,............,B_u_____b.b.bB#',
      '#,B__E__B__G__B,...z........,BuIc____b.b.bB#',
      '#,BcccccBcccccB,............,Bccc_________B#',
      '#,B_____B_____B,............,B______V_____B#',
      '#,BN____B_____B,.........M..,B____________B#',
      '#,BBBDBBBBBDBBB,..Q.........,BBBBBDBBBBBBBB#',
      '#,....[.....(..,............,......].......#',
      '#,,,,,,,,,,,,,,,............,,,,,9,,,,,,,,,#',
      '#..........................................#',
      '#,BBBBBBBBB,,,,,,,,,,..,,,,,,,,,,,,,,,,,,,,#',
      '#,Buuuu__?B,T,,,,,T,,..,oRRRRRRR,,FFF:FFFF,#',
      '#,Bp_Hp___B,,~~~~f,,,.n,oRRRRRRR,,F::::::F,#',
      '#,Bccccc__B,f~~~~;,,,..,,BBB/BBB,,F::::::F,#',
      '#,B_______B,,~~~~,,T,..,,:::6::::,F::Z:::F,#',
      '#,B_______B,Tf,,f,y,,..,BBDBBBBBB,F::::::F,#',
      '#,BBBBDBBBB,,,,,,,,,,..,B_____b_B,F::::::F,#',
      '#,.....{...::::::::::..,B_____b_B,F::::::F,#',
      '#,,,f,,,f,,,,.....,},..,B__$____B,FFFFFFFF,#',
      '#,T,,f,f,,T,,.."..,.....B____%__B,,,,,,,,,,#',
      '#,,T,,f,,T,,,.....,.X..UBBBBBBBBB,,T,,,,,TT#',
      '#####################@.#####################',
    ],
    decor: [
      '............................................',
      '..................W....c....................',
      '.................Q.dddddd.Q.................',
      '...........2.....Z........Z.................',
      '..U1....q.2..........RR.............1.......',
      '.................eee.RR.eee.................',
      '..............h..eee.RR.eee.....l.........f.',
      '.......f...1.........RR.............e.......',
      '...........e......W....i....................',
      '...3.........3..........8.1...3..........3..',
      '............................................',
      '............................................',
      '............................................',
      '............................................',
      '.....x.....c...................p....w....i..',
      '...X.....Y...Y...99......99...C...FV..y.....',
      '...O........................................',
      '....................JJJJ.........nTn........',
      '..................1.JJJJ.1........n..rrrr...',
      '....................JJJJ.............rrrr...',
      '............................................',
      '......5.....6..f3..e.......3.......7........',
      '..1.........................f...........1...',
      '............................................',
      '....k...........h...........................',
      '.......U....................................',
      '................................UE.M....M...',
      '........................q.......q.......f...',
      '....................l.......................',
      '...Z................3.......................',
      '..............e..........C.KF...............',
      '.......4...........................f........',
      '.....h......21....2.........Tn..............',
      '............2.....2.........n...............',
      '............................................',
      '............................................',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '4': spawn('yuki_house', 'down', ':'),
      '5': spawn('elder_house', 'down', ':'),
      '6': spawn('storehouse', 'down', ':'),
      '<': warp('regnas_house_yuki', 'entrance', 'D', 'up'),
      '>': warp('regnas_house_elder', 'entrance', 'D', 'up'),
      '/': warp('regnas_storehouse', 'entrance', '1', 'up'),
      // shops (the hanging signs are readable)
      E: shop('weapon', '_', 'regnas_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'regnas_armor', { dir: 'down' }),
      H: shop('item', '_', 'regnas_item', { dir: 'down' }),
      N: say('customer', 'woman', '_', '武器や防具は、買うだけじゃ\nだめ。ちゃんと装備しなきゃね。\fお店で買ったときに、\nその場で装備することも\nできるのよ。', { dir: 'up' }),
      '[': sign('武器屋', '.'),
      '(': sign('防具屋', '.'),
      '{': sign('道具屋', '.'),
      '?': chest('regnas_town_h1', 'herb', 1, '_'), // formerly hidden in a pot; now a visible chest
      // inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 6, dir: 'down' }),
      V: say('inn_guest', 'man', '_', '宿屋に泊まると、\nHPもMPも全回復するんだ。\fそれに、もし全滅しても、\n最後に立ち寄った町や、\n泊まった宿屋で\n目を覚ますのさ。\fお金は半分になるけど、\n経験値は減らないぜ。', { dir: 'left' }),
      ']': sign('旅人の宿屋', '.'),
      '9': say('cat', 'cat', ',', 'ニャーン。', { move: 'wander' }),
      // temple-church + graveyard
      O: npc('priest', 'priest', '_', { event: 'church', greet: 'おお、{non}や。\nよう帰ってきたな。\n神もお喜びじゃ。', dir: 'down' }),
      J: say('nun', 'nun', '_', '{non}、あなたがこの神殿で\n暮らしていたのが、\n昨日のことのようだわ。\fけがをしたら、いつでも\n戻っていらっしゃいね。', { dir: 'left' }),
      ')': sign('レグナス神殿\f傷ついた旅人よ、\nいつでも扉をたたきなさい。', '.'),
      '8': say('grave_woman', 'old_woman', ':', 'ここには100年前、\n魔王と戦った人々が\n眠っているのさ。\fあんたたちも、気をつけてね。', { dir: 'up' }),
      // plaza + streets
      A: say('soldier', 'soldier', '.', '戦いに勝てばJPがたまる。\nJPでアビリティを覚えるのだ。\fジョブを変えても、\n覚えたアビリティは\n消えないから安心しろ。', { dir: 'down' }),
      n: chat('street_man', 'man', '.', [
        { cond: 'game_clear', text: '勇者さまのお帰りだ！\n万歳！' },
        { cond: { item: 'crest_wind' }, text: '風の洞窟の親分を\nやっつけたんだって？\nすごいなあ！' },
      ], '北の風の洞窟には、\nゴブリンの親分が\n住みついたらしい。\n気をつけなよ。', { move: 'wander' }),
      Q: chat('plaza_woman', 'woman', '.', [
        { cond: 'game_clear', text: '魔王が倒されたって、\n本当なのね！\nあなたたちは町の誇りよ！' },
        { cond: 'gate_open', text: '関所が開いたって本当？\n関所の向こうの港町ポルタは、\nにぎやかな町なのよ。' },
      ], '町の東の関所は、\n今、閉ざされているそうよ。\n困ったわねえ。', { dir: 'right' }),
      M: say('plaza_old', 'old_man', '.', [
        'Aボタンで人と話したり、\n宝箱を開けたり、\n看板を読んだりできるのじゃ。',
        'Bボタンを押すとメニューが開く。\nそこで次の目的も\nわかるぞい。',
      ], { dir: 'left' }),
      z: say('plaza_scholar', 'scholar', '.', [
        '魔物は時々、珍しい宝を\n落とすのです。\nレアドロップというやつですな。',
        'メニューの『図鑑』を見れば、\nどの魔物から何を手に入れたか\nわかりますぞ。',
        'それに、ごくまれに、\n見たこともない珍しい魔物が\n現れるという噂も……。\f出会えたら幸運ですな。',
      ], { move: 'wander' }),
      '7': say('peddler', 'dwarf', '.', 'わしは旅の商人。\f海の向こうの町には、\nもっと強い武器もあるぞ。\nいつか見せてやりたいのう。', { dir: 'down' }),
      '&': say('fruit_seller', 'woman', '.', 'いらっしゃい！\n旅のお供に、\n旅鳥の羽はいかが？\f……なんてね、うちは果物屋。\n羽なら道具屋さんよ。\f一度行った町へ、\nひとっ飛びで戻れるんだって。', { dir: 'down' }),
      ';': say('fisherman', 'man', ',', 'この水路は、お城の堀から\n引いた水なんだ。\f魚はさっぱり釣れないけど、\nぼんやりするには最高さ。', { dir: 'left' }),
      // homes, park, farm, gate
      y: say('girl', 'girl', ',', '{non}お姉ちゃん！\nいってらっしゃい！　またね！', { move: 'wander' }),
      w: say('boy', 'boy', ',', '『設定』の『常にダッシュ』で、\n走るか歩くか選べるんだって！\nぼくはいつも走ってるよ！', { move: 'wander' }),
      v: say('dog', 'dog', ',', 'ワンワン！', { move: 'wander' }),
      Z: say('farmer', 'old_man', ':', '畑仕事はいいぞお。\fミルトの村は、\nここからずっと北じゃ。\nのどかな、いい村じゃよ。', { dir: 'down' }),
      '$': say('housewife', 'woman', '_', 'うちの子ったら、また\n水路で遊んでるのよ。\f……勇者さまたちも、\nちゃんとご飯を食べてね。', { dir: 'right' }),
      '%': say('grandpa', 'old_man', '_', 'わしの若いころはのう、\nこの城下町も、もっと\n小さかったもんじゃ。\f水路ができてからは、\nずいぶんにぎやかになったわい。', { dir: 'up' }),
      '"': sign('『勇者の像』\f100年前、光の紋章を掲げ、\n魔王ヴァルザードを封じた\n勇者たちをたたえる像。', 'Y'),
      '!': chest('regnas_town_h2', 'seed_luk', 1, ','), // formerly hidden at the well; now a visible chest
      X: say('gate_l', 'soldier', '.', 'ようこそ、城下町レグナスへ！', { dir: 'right' }),
      U: say('gate_r', 'soldier', '.', '外には魔物が出るぞ。\n薬草は持ったか？', { dir: 'left' }),
      '}': sign('ようこそ、城下町レグナスへ。\f北へ行けばミルトの村。\n東には関所がある。'),
    },
  };

  // ================================================================ interiors
  // {yuki}'s home: kitchen, hearth, the family's beds and the late father's
  // sword, portrait, armor and diary.
  R.DB.maps.regnas_house_yuki = {
    name: '城下町レグナス', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#.....[.b.b#',
      '#.......b.b#',
      '#..........#',
      '#...M......#',
      '#..........#',
      '#..........#',
      '#p?...@...o#',
      '######<#####',
    ],
    decor: [
      '...w.....P..',
      '.CK..F...y..',
      '....rrr.....',
      '....rrr.....',
      '.nTn......A.',
      '..n.........',
      '............',
      '............',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('regnas_town', 'yuki_house', 'D', 'down'),
      M: npc('mother', 'woman', '.', { event: 'yuki_mother', dir: 'down' }),
      '?': chest('regnas_yuki_h1', 'antidote', 1), // formerly hidden in a pot; now a visible chest
      '[': sign('父の日記だ。\f「今日、{yuki}が生まれた。\nこの子には、不思議な光が\n宿っている……。」', 'k'),
    },
  };

  // the old adventurer's house: trophies of his travels
  R.DB.maps.regnas_house_elder = {
    name: '城下町レグナス', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#kk......bb#',
      '#........bb#',
      '#..........#',
      '#$......O..#',
      '#..........#',
      '#..G.......#',
      '#.p...@..o.#',
      '######>#####',
    ],
    decor: [
      '.....x....c.',
      '...I.F.Xy...',
      '....rrr.....',
      '....rrr.....',
      '............',
      '......nTn...',
      '............',
      '............',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('regnas_town', 'elder_house', 'D', 'down'),
      G: say('old_adventurer', 'old_man', '.', [
        'わしも昔は、\n冒険者だったのじゃ。',
        '体の硬いゼリーを見たら、\nねらってみるがよい。\fすぐ逃げてしまうが、\n倒せば、たいそうな経験値と\nJPが手に入るのじゃ。',
        'それに魔物は、たまに\n珍しい物を落とす。\f同じ魔物でも、\nねばってみるのも手じゃよ。',
      ], { dir: 'right' }),
      O: say('old_wife', 'old_woman', '.', 'うちの人ったら、毎日\n昔の自慢話ばかり。\fでも、たまには役に立つ\nこともあるのよ。', { dir: 'down' }),
      '$': chest('regnas_elder_c1', 'leather_hood', 1),
    },
  };

  // behind the silver door: stores kept for the heroes to come
  R.DB.maps.regnas_storehouse = {
    name: '城下町レグナス', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '##########',
      '#uu$..%jj#',
      '#.......o#',
      '#...N...?#',
      '#p.......#',
      '#p..@...o#',
      '####/#####',
    ],
    decor: [
      '..k....k..',
      '....UG....',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '/': warp('regnas_town', 'storehouse', '1', 'down'),
      N: say('storekeeper', 'old_man', '.', [
        'だ、誰じゃ！？\f……なんと、銀の鍵で\n入ってきたのか。',
        'ここの宝は、いつか来る\n勇者のために\n残されたもの。\n持っていくがよい。',
      ], { dir: 'down' }),
      '$': chest('regnas_store_c1', 'revive_feather', 1),
      '%': chest('regnas_store_c2', 'mana_drop', 2),
      '?': chest('regnas_store_h1', 'seed_agi', 1), // formerly hidden in a barrel; now a visible chest
    },
  };
})(window.RPG);
