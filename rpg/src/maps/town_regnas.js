// レグナス城 + 城下町 (start continent, Lv 1–3) and the town's house interiors.
// Map ids: regnas_castle regnas_town regnas_house_yuki regnas_house_elder regnas_storehouse
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const hidden = (id, item, under) => ({ hidden: { id, item }, under });
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
      '#__I_________#............#____________#',
      '#_________H__#.l........l.#___4________#',
      '######D#######...E....G...#____________#',
      '#b.b.........#............##############',
      '#b.b.........#.l........l.#.......#(..)#',
      '#............#............#..$...V#....#',
      '#....z.......######DD######.......1....#',
      '#bJb.........#............#....%..#....#',
      '#b.b.........D............D.......#pp..#',
      '######D#######.l........l.##############',
      '#....._______#........w...#.....O......#',
      '#.N..._______#............#.....aa.U...#',
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
      '...i..W....i...W.b.cc.b.W....m..P.c..W..',
      '.......V......Y.QddddddQ.Y..Ay.F.Z..yV..',
      '.................dd..dd...............Z.',
      '........RRR.I....dddddd........rrrrrr...',
      '.Z......RRR...Q....rr..z.Q..nTnrrrrrr...',
      '.Q....Tn.D..v......rr..........rrrrrr...',
      '..x.i.....b...v....rr....v.Z..y..v..ID..',
      '.......XYX.qU...z..rr.......c..i..c.ci..',
      '...................rr......Y.U.G.Y.GG...',
      '......nTn.....Z....rr....Z............v.',
      '.......n.......i..b..b..i..q..........G.',
      '............U.Y....rr....Y.U............',
      '...................rr.........q......qU.',
      '...k....p..i.......rr.......W.B.cc.B.W..',
      '.CKS.q.Q....Z.e...oooo...e.Q.Z......Z.Q.',
      '.......eeeee..e...oooo...e..............',
      '.q.....LLLLL.......rr.......eee.RR.eee..',
      '.......eeeee.......rr.......eee.RR.eee..',
      '...U..........Z....rr....Z.v....RR....v.',
      '..w.i.i..w.w...W.bi..ib.W...w.W.....W.w.',
      '........................................',
      '...22222.22222..13....31.X.Y...X.U.MM...',
      '........................................',
      '..................JJJJ............s.E...',
      '................e.JJJJ.e..Y........s.q..',
      '...22222.22222....JJJJ...............q..',
      '..h..........h............Y.............',
      '............e...13....31................',
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
        'JPがたまるとジョブレベルが上がり、\nメニューの『ジョブ』で\nアビリティを覚えられます。',
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
      v: say('castle_dog', 'dog', ',', 'ワンワン！', { move: 'wander' }),
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
  R.DB.maps.regnas_town = {
    name: 'レグナスの まち', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
    location: 'regnas', outside: ',',
    exit: { to: 'world', spawn: 'regnas_town' },
    rows: [
      '############################################',
      '#TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT#',
      '#TT,,,,,,,,,,,,,BBBBBBBBBBBB,,,,,,,,,,,,,TT#',
      '#TT' + 'RRRRRRRR' + ',f,f,' + 'BY___O____YB' + ',,,,,' + 'RRRRRRR' + ',' + 'TT#',
      '#TT' + 'RRRRRRRR' + ',,,,,' + 'B_l__aa__l_B' + ',g,g,' + 'RRRRRRR' + ',' + 'TT#',
      '#TT' + 'BBB<BBBB' + ',,!,,' + 'B____++____B' + ',,8,,' + 'BBB>BBB' + ',' + 'TT#',
      '#TT' + ',,,4,,,,' + ',,,,,' + 'Bhhh_++_hhhB' + ',g,g,' + ',,,5,,,' + ',' + 'TT#',
      '#TT' + ',,,:,,f,' + 'f,,,,' + 'B____++__J_B' + ',,,,,' + ',,,:,,,' + ',' + 'TT#',
      '#TT' + ',,,:,,,,' + ',A,,,' + 'Bhhh_++_hhhB' + ',,,,,' + ',,,:,,,' + ',' + 'TT#',
      '#TT' + ',,,:,,,,' + ',,,,,' + 'B____++____B' + ',,9,,' + ',,,:,,,' + ',' + 'TT#',
      '#TT' + ',,,:,,,,' + ',,,,,' + 'BBBBBDDBBBBB' + ',,,,,' + ',,,:,,,' + ',' + 'TT#',
      '#T' + ':::::::::::::::::::::::::::n::::::::::::' + 'T#',
      '#T' + 'BBBBBBBBBBBB' + ',,' + '.........Q.' + ',,,' + 'BBBBBBBBBBBB' + 'T#',
      '#T' + 'Buuuu__uuuuB' + ',,' + '.f.f...f.f.' + ',,,' + 'Bb_b_b_b_u_B' + 'T#',
      '#T' + 'B_E______G_B' + ',,' + '...~~~~~...' + ',,,' + 'Bb_b_b_b___B' + 'T#',
      '#T' + 'Bccc____cccB' + ',,' + '...~~Y~~...' + ',,,' + 'B______V___B' + 'T#',
      '#T' + 'B__________B' + ',,' + '.M.~~~~~...' + ',,,' + 'B_I________B' + 'T#',
      '#T' + 'Boj____N_joB' + ',,' + '.f.f...f.f.' + ',,,' + 'Bccc__th___B' + 'T#',
      '#T' + 'B__________B' + ',,' + '........z..' + ',,,' + 'B__________B' + 'T#',
      '#T' + 'BBBBBDDBBBBB' + '::' + ':::::::::::' + ':::' + 'BBBBBDBBBBBB' + 'T#',
      '#T' + ':::[:::::::::::::::::::::::::::]::::::::' + 'T#',
      '#T' + ',,,,,,,,,,' + ',,w,,,,,,' + '::' + ',,,,,,,,,,' + ',,,,,,,,,' + 'T#',
      '#T' + 'BBBBBBBBBB' + ',TT,,f,,,' + '::' + ',jo,,,,f,,' + 'RRRRRRRR,' + 'T#',
      '#T' + 'BuuuuuuuuB' + ',TTf,,,,,' + '::' + ',jj7,,,,,,' + 'RRRRRRRR,' + 'T#',
      '#T' + 'B___H____B' + ',,f,,,TT,' + '::' + ',,,,,TT,,,' + 'BBB/BBBB,' + 'T#',
      '#T' + 'Bcccccc__B' + ',,,,,fTT,' + '::' + ',,,,,TT,f,' + ',,,6,,,,,' + 'T#',
      '#T' + 'B________B' + ',,,,,,,f,' + '::' + ',f,,,,,,,,' + ',,,:,,,,,' + 'T#',
      '#T' + 'Bp?____joB' + ',TT,,,,,,' + '::' + ',,,,,f,,TT' + 'FFFFFFFFF' + 'T#',
      '#T' + 'BBBBBBDBBB' + ',TT,f,,,,' + '::' + ',TT,,,,,TT' + 'Ffff,fffF' + 'T#',
      '#T' + ',,,,,{:,,,' + ',,,,,,,,,' + '::' + ',TT,,f,,,,' + 'Fff,Z,ffF' + 'T#',
      '#T' + ',,,,,,:,,,' + ',,f,,,,,,' + '::' + ',,,,,,,,,,' + 'Fff,,,ffF' + 'T#',
      '#T' + ',,,,,,::::' + ':::::::::' + '::' + ',,,,,,,,,,' + 'FFFF,FFFF' + 'T#',
      '#T' + ',,,,,,,,,,' + 'f~~~~~f,,' + '::' + ',,,,,,,,,,' + ',,,,,,,,,' + 'T#',
      '#T' + ',,y,,,,,,,' + 'f~~~~~f,,' + '::' + ',,,,,,,,,,' + ',,,,v,,,,' + 'T#',
      '#T' + ',,,,,,,,,,' + ',,,,,,},X' + '::' + 'U,,,,,,,,,' + ',,,,,,,,,' + 'T#',
      '#####################@:#####################',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('yuki_house', 'down', ':'),
      '5': spawn('elder_house', 'down', ':'),
      '6': spawn('storehouse', 'down', ':'),
      '<': warp('regnas_house_yuki', 'entrance', 'D', 'up'),
      '>': warp('regnas_house_elder', 'entrance', 'D', 'up'),
      '/': warp('regnas_storehouse', 'entrance', '1', 'up'),
      E: shop('weapon', '_', 'regnas_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'regnas_armor', { dir: 'down' }),
      H: shop('item', '_', 'regnas_item', { dir: 'down' }),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 6, dir: 'down' }),
      O: npc('priest', 'priest', '_', { event: 'church', greet: 'おお ノンや。 よう かえって きたな。\nかみも およろこびじゃ。', dir: 'down' }),
      J: say('nun', 'nun', '_', 'ノン あなたが この しんでんで\nくらして いたのが\nきのうの ことの ようだわ。\fけがを したら いつでも\nもどって いらっしゃいね。', { dir: 'left' }),
      A: say('soldier', 'soldier', ',', 'たたかいで かてば JPが たまる。\nJPで アビリティを おぼえるのだ。\fジョブを かえても\nおぼえた アビリティは\nきえないから あんしんしろ。', { dir: 'down' }),
      '9': say('cat', 'cat', ',', 'ニャーン。', { move: 'wander' }),
      '8': say('grave_woman', 'old_woman', ',', 'ここには 100ねん まえ\nまおうと たたかった ひとびとが\nねむって いるのさ。\fあんたたちも きを つけてね。', { dir: 'down' }),
      n: chat('street_man', 'man', ':', [
        { cond: 'game_clear', text: 'ゆうしゃさまの おかえりだ！\nばんざーい！' },
        { cond: { item: 'crest_wind' }, text: 'かぜの どうくつの おやぶんを\nやっつけたんだって？\nすごいなあ！' },
      ], 'きたの かぜの どうくつには\nゴブリンの おやぶんが\nすみついたらしい。\nきを つけなよ。', { move: 'wander' }),
      Q: chat('plaza_woman', 'woman', '.', [
        { cond: 'game_clear', text: 'まおうが たおされたって\nほんとうなのね！\nあなたたちは まちの ほこりよ！' },
        { cond: 'gate_open', text: 'せきしょが ひらいたって ほんとう？\nひがしの みなとまち ポルタは\nにぎやかな まちなのよ。' },
      ], 'まちの ひがしの せきしょは\nいま とざされて いるそうよ。\nこまったわねえ。', { dir: 'down' }),
      M: say('plaza_old', 'old_man', '.', [
        'Aボタンで ひとと はなしたり\nものを しらべたり できるのじゃ。',
        'Bボタンを おすと メニューが ひらく。\nそこで つぎの もくてきも\nわかるぞい。',
      ], { dir: 'right' }),
      z: say('plaza_scholar', 'scholar', '.', [
        'まものは ときどき めずらしい\nたからを おとすのです。\nレアドロップと いうやつですな。',
        'メニューの 『ずかん』を みれば\nどの まものから なにを てにいれたか\nわかりますぞ。',
      ], { move: 'wander' }),
      N: say('customer', 'woman', '_', 'ぶきや ぼうぐは かうだけじゃ だめ。\nちゃんと そうび しなきゃね。\fみせで かった ときに\nその ばで そうび することも\nできるのよ。', { dir: 'left' }),
      V: say('inn_guest', 'man', '_', 'やどやに とまると\nHPも MPも ぜんかい するんだ。\fそれに もし ぜんめつしても\nさいごに とまった やどやか\nおいのり した きょうかいで\nめを さますのさ。\fおかねは はんぶんに なるけどな。', { dir: 'down' }),
      X: say('gate_l', 'soldier', ',', 'ようこそ レグナスの まちへ！', { dir: 'right' }),
      U: say('gate_r', 'soldier', ',', 'そとには まものが でるぞ。\nやくそうは もったか？', { dir: 'left' }),
      Z: say('farmer', 'old_man', ',', 'はたけしごとは いいぞお。\fミルトの むらは ここから きた。\nもりを ぬけた さきに ある。\nのどかな むらだよ。', { dir: 'down' }),
      y: say('girl', 'girl', ',', 'ノンおねえちゃん！\nいってらっしゃい！ またね！', { move: 'wander' }),
      v: say('dog', 'dog', ',', 'ワンワン！', { move: 'wander' }),
      '7': say('peddler', 'dwarf', ',', 'わしは たびの しょうにん。\fうみの むこうの まちには\nもっと つよい ぶきも あるぞ。\nいつか みせて やりたいのう。', { dir: 'down' }),
      w: say('boy', 'boy', ',', 'せっていで いつも はしるか\nあるくか えらべるんだって！\nぼくは いつも はしってるよ！', { move: 'wander' }),
      '?': hidden('regnas_town_h1', 'herb', 'p'),
      '!': hidden('regnas_town_h2', 'seed_luk', 'W'),
      '[': sign('ぶきと ぼうぐの みせ'),
      ']': sign('たびびとの やどや'),
      '{': sign('どうぐや'),
      '}': sign('ようこそ レグナスの まちへ\nきたは ミルトの むら\nひがしは せきしょ'),
    },
  };

  // ================================================================ interiors
  R.DB.maps.regnas_house_yuki = {
    name: 'レグナスの まち', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#k.u..b.b.[#',
      '#.....b.b..#',
      '#..........#',
      '#.tt.......#',
      '#.hh...M...#',
      '#..........#',
      '#po?..@..jo#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('regnas_town', 'yuki_house', 'D', 'down'),
      M: npc('mother', 'woman', '.', { event: 'yuki_mother', dir: 'down' }),
      '?': hidden('regnas_yuki_h1', 'antidote', 'p'),
      '[': sign('ちちの にっきだ。\f「きょう ユウキが うまれた。\nこの こには ふしぎな ひかりが\nやどって いる……。」', 'k'),
    },
  };

  R.DB.maps.regnas_house_elder = {
    name: 'レグナスの まち', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#kkk..b.b.u#',
      '#.....b.b..#',
      '#.$......O.#',
      '#...htth...#',
      '#..........#',
      '#.G........#',
      '#jo...@..pp#',
      '######>#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('regnas_town', 'elder_house', 'D', 'down'),
      G: say('old_adventurer', 'old_man', '.', [
        'わしも むかしは ぼうけんしゃ\nだったのじゃ。',
        'からだの かたい ゼリーを みたら\nねらって みるが よい。\nすぐ にげて しまうが\nたおせば たいそうな けいけんと\nJPが てに はいるのじゃ。',
        'それに まものは たまに\nめずらしい ものを おとす。\nおなじ まものでも\nねばって みるのも てじゃよ。',
      ], { dir: 'right' }),
      O: say('old_wife', 'old_woman', '.', 'うちの ひとったら まいにち\nむかしの じまんばなし ばかり。\fでも たまには やくに たつ\nことも あるのよ。', { dir: 'down' }),
      '$': chest('regnas_elder_c1', 'leather_hood', 1),
    },
  };

  R.DB.maps.regnas_storehouse = {
    name: 'レグナスの まち', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '##########',
      '#jj$..%jj#',
      '#o......o#',
      '#j..N...?#',
      '#oo....jj#',
      '#...@....#',
      '####/#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '/': warp('regnas_town', 'storehouse', '1', 'down'),
      N: say('storekeeper', 'old_man', '.', [
        'だ だれじゃ！？\f……なんと しろがねの かぎで\nはいって きたのか。',
        'ここの たからは いつか くる\nゆうしゃの ために のこされた もの。\nもって いくが よい。',
      ], { dir: 'down' }),
      '$': chest('regnas_store_c1', 'revive_feather', 1),
      '%': chest('regnas_store_c2', 'mana_drop', 2),
      '?': hidden('regnas_store_h1', 'seed_agi', 'o'),
    },
  };
})(window.RPG);
