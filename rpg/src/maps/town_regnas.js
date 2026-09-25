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
  R.DB.maps.regnas_castle = {
    name: 'レグナスじょう', type: 'castle', legend: 'local', theme: 'castle', bgm: 'castle',
    location: 'regnas', outside: ',', onEnter: 'regnas_castle_enter',
    exit: { to: 'world', spawn: 'regnas_castle' },
    rows: [
      '#' + '##i####i##' + '#' + '##i##########i##' + '#' + '##i####i##' + '#',
      '#' + 'kk[kkkk]kk' + '#' + '....++++++++....' + '#' + 'p..(..)..p' + '#',
      '#' + '..........' + '#' + '....+M+AQ+++....' + '#' + '..........' + '#',
      '#' + '.tt....tt.' + '#' + '.l..+++0++++..l.' + '#' + 'j........j' + '#',
      '#' + '.hh....hh.' + '#' + '.......++.......' + '#' + '####1#####' + '#',
      '#' + '..........' + '#' + '...E...++...G...' + '#' + '..........' + '#',
      '#' + '.kkk..kkk.' + '#' + '.l.....++.....l.' + '#' + 'oo..V...jj' + '#',
      '#' + '..........' + '#' + '.......++.......' + 'D' + '..........' + '#',
      '#' + '.k{k..k}k.' + '#' + '.......++.......' + '#' + '.$......%.' + '#',
      '#' + '....H.....' + '#' + '.l.....++.....l.' + '#' + '..........' + '#',
      '#' + '.I........' + '#' + '.......++.......' + '#' + 'p........p' + '#',
      '#' + '####D#####' + '#' + '#######DD#######' + '#' + '##########' + '#',
      '#' + '..........' + '#' + '.l.....++.....l.' + '#' + '....O.....' + '#',
      '#' + '.b.b.b....' + 'D' + '.......++.......' + '#' + '..l.aa.l..' + '#',
      '#' + '.b.b.bJ...' + '#' + '.......++.......' + 'D' + '....++....' + '#',
      '#' + '..........' + '#' + '.......++....z..' + '#' + '.hh.++.hh.' + '#',
      '#' + '######D###' + '#' + 'Y......++......Y' + '#' + '....++..U.' + '#',
      '#' + 'uuu..o.j?.' + '#' + '.l.....++.....l.' + '#' + '.hh.++.hh.' + '#',
      '#' + '....N.....' + '#' + '.......++.......' + '#' + '....++....' + '#',
      '#' + '..ttt.....' + '#' + '.......++.......' + '#' + '.hh.++.hh.' + '#',
      '#' + '..hhh.....' + '#' + '...w...++.......' + '#' + '....++....' + '#',
      '#' + '..........' + '#' + '.l.....++.....l.' + '#' + '..........' + '#',
      '#################i#DD#i#################',
      '#' + 'TT,,,,,,,,,,,,,,Y,..,Y,,,,,,,,,,,,,,TT' + '#',
      '#' + 'T,fffYff,,,,,,,,,,..,,,,,,,,,,,,,,,,,T' + '#',
      '#' + 'T,f~~~~f,,,,,,,,,,..,,,,,,,,,W,,,,,,,T' + '#',
      '#' + 'T,f~~~~fn,,,,,,,,,..,,,,,,,,,,,,,,,,,T' + '#',
      '#' + 'T,ffffff,,,,,,,,,,..,,,,,,,,,,,,,,,,,T' + '#',
      '#' + 'T,,,,,,,,,,,,,,,,f..f,,,,,,,,,,,,,,,,T' + '#',
      '#' + 'T,,,,,,,,,,,,,,,,f..f,,,,,FFFFFFFF,,,T' + '#',
      '#' + 'T,,y,,,,,,,,,,,,,f..f,,,,,F,,v,,,F,,,T' + '#',
      '#' + 'T,,,,,,,,,,,,,,,,f..f,,,,,F,,,,,,F,,,T' + '#',
      '#' + 'T,,,,,,,,,,,,,,,,f..f,,,,,FFF,,FFF,,,T' + '#',
      '#' + 'TT,,,,,,,,,,,,,,,f..f,,,,,,,,,,,,,,,TT' + '#',
      '#' + 'TTT,,,,,,,,,,,,,,X..Z,,,,,,,,,,,,,,TTT' + '#',
      '###################@.###################',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '0': spawn('start', 'up', '+'),
      A: npc('king', 'king', 'K', { event: 'king_talk', dir: 'down' }),
      Q: chat('queen', 'queen', 'K', [
        { cond: 'game_clear', text: 'おかえりなさい。\nあなたたちは この くにの\nほこりですよ。' },
        { cond: 'barrier_broken', text: 'まのうずが きえたと ききました。\nどうか みんな ぶじに\nもどって きてね。' },
      ], 'わたくしは まいにち\nあなたたちの ぶじを\nいのって いますよ。', { dir: 'down' }),
      M: say('minister', 'minister', '+', [
        'こまった ときは Bボタンで\nメニューを ひらき\n『つぎの もくてき』を\nたしかめるのですぞ。',
        'また メニューの 『セーブ』で\nたたかいの さなか いがいなら\nいつでも きろくを のこせますぞ。',
      ], { dir: 'right' }),
      E: say('guard_l', 'soldier', '.', 'ここは レグナスじょう\nぎょくざの まで ある。\fおうさまに はなしかければ\nぼうけんの きろくを\nつけて いただけるぞ。', { dir: 'right' }),
      G: chat('guard_r', 'soldier', '.', [
        { cond: 'gate_open', text: 'せきしょの へいから きいたぞ。\nみごと かぜの もんしょうを\nてにいれた そうだな！' },
      ], 'ひがしの せきしょは まものが ふえて\nいまは かたく とざされて おる。', { dir: 'left' }),
      H: say('scholar', 'scholar', '.', [
        'ジョブの ことなら わたしに\nおまかせ ください。',
        'たたかいに かつと けいけんちの ほかに\nJPが もらえます。\nJPは いまの ジョブに たまるのです。',
        'JPが たまると ジョブレベルが あがり\nメニューの 『ジョブ』で\nアビリティを おぼえられます。',
        'ジョブレベルを あげると\nあたらしい ジョブに\nてんしょく できるように なります。',
        'おぼえた アビリティは 『セット』で\nほかの ジョブでも つかえますぞ。\nくわしくは ほんだなの ほんを\nよんで みなされ。',
      ], { dir: 'down' }),
      I: say('sage', 'sage', '.', [
        'わしは この しろの がくしゃ じゃ。',
        'まおう ヴァルザードは 100ねん まえ\nせかいを やみで おおった。',
        'ひかりの もんしょうを かかげた\nむかしの ゆうしゃたちが\nやつを ふうじたのじゃ。',
        'そなたたちが もんしょうの ひかりを\nやどして うまれたのも\nなにかの さだめかも しれんのう。',
      ], { dir: 'right' }),
      J: say('barracks', 'soldier', '.', 'くんれんの あとの ひるねは\nさいこう だぜ……。\fおっと！ いまのは たいちょうには\nないしょ だぞ。', { dir: 'left' }),
      N: say('cook', 'woman', '.', [
        'きょうの ゆうしょくは\nまものの にこみよ。\fうそよ うそ！ あはは。',
        'そうそう つぼや たるを しらべると\nなにか はいって いることも\nあるのよ。',
      ], { dir: 'down' }),
      O: npc('castle_priest', 'priest', '.', { event: 'church', dir: 'down' }),
      U: say('castle_nun', 'nun', '.', 'ノン あなたが ゆうしゃの ひとりに\nえらばれる なんて。\nしんでんの みんなも\nほこりに おもって いますよ。', { dir: 'left' }),
      V: chat('treasury_guard', 'soldier', '.', [
        { cond: { item: 'silver_key' }, text: 'しろがねの かぎを てにいれたのか！\nおくの ぎんの とびらも\nあけられるはずだ。' },
      ], ['ここは おしろの たからものこ。\nおうさまの おゆるしが でている。\nすきに もって いくが よい。', 'ただし おくの ぎんの とびらは\nしろがねの かぎが なければ\nひらかぬぞ。'], { dir: 'down' }),
      X: say('gate_l', 'soldier', ',', 'ここは レグナスじょう。\nじょうかまちは すぐ ひがしだ。', { dir: 'right' }),
      Z: say('gate_r', 'soldier', ',', 'たびの したくは じょうかまちで\nととのえると よい。\nやくそうを わすれるなよ。', { dir: 'left' }),
      n: say('gardener', 'old_man', ',', 'はなは いいのう……。\nまものが あふれても\nはなは かわらず さいて おる。', { dir: 'left' }),
      v: say('castle_dog', 'dog', ',', 'ワンワン！', { move: 'wander' }),
      y: say('castle_girl', 'girl', ',', 'わたし おおきく なったら\nメテムさま みたいな\nまほうつかいに なるの！', { move: 'wander' }),
      w: say('castle_boy', 'boy', '.', 'ユウキにいちゃん！\nこんど けんの けいこ\nつけてよね！', { move: 'wander' }),
      z: say('knight', 'knight', '.', 'ユウキ！ おまえの ちちうえも\nりっぱな けんしだった。\nおまえにも きたい して いるぞ！', { dir: 'left' }),
      '$': chest('regnas_castle_c1', 'herb', 3),
      '%': chest('regnas_castle_c2', 'wing', 2),
      '(': chest('regnas_castle_v1', 'gold_charm', 1),
      ')': chest('regnas_castle_v2', 'seed_hp', 1),
      '?': hidden('regnas_castle_h1', 'antidote', 'p'),
      '[': sign('『ジョブの てびき その1』\fせんし3 → ナイト\nそうりょ3 → しろまどうし\nまほうつかい3 → くろまどうし\nとうぞく3 → かりゅうど\f※すうじは ジョブレベルを あらわす。', 'k'),
      ']': sign('『ジョブの てびき その2』\fふたつの ジョブを きたえると\nあらたな ジョブが ひらかれる。\fせんし2＋そうりょ2 → ぶとうか\nそうりょ2＋とうぞく2\n → ぎんゆうしじん\nまほうつかい2＋とうぞく2 → くすりし', 'k'),
      '{': sign('『アビリティの セット』\fおぼえた アビリティは\n『セット』で つけかえられる。\fサブアクション リアクション\nサポート フィールドの\nよっつの わくが ある。\fほかの ジョブで おぼえた わざも\nサブアクションに すれば\nつかえるのだ。', 'k'),
      '}': sign('『まおう ヴァルザード』\f100ねん まえ せかいを やみに\nつつんだ まおう。\nひかりの もんしょうの ちからで\nふうじられたと いう。\fもんしょうは かぜ みず だいち\nほのお ほしの いつつに わかたれ\nせかいの ちに まつられた……。', 'k'),
    },
  };

  // after the last boss: the party returns to cheers (ending scene + post-game)
  R.DB.maps.regnas_castle.spawns = { ending: { x: 19, y: 9, dir: 'up' } };
  R.DB.maps.regnas_castle.npcs = [
    { id: 'cheer_1', x: 17, y: 7, sprite: 'npc:soldier', dir: 'right', cond: 'game_clear', text: 'ゆうしゃ ばんざい！\nレグナス ばんざい！' },
    { id: 'cheer_2', x: 22, y: 7, sprite: 'npc:soldier', dir: 'left', cond: 'game_clear', text: 'この ひを わすれは しないぞ！' },
    { id: 'cheer_3', x: 17, y: 9, sprite: 'npc:soldier', dir: 'right', cond: 'game_clear', text: 'まおうを たおすとは……\nわしも ほこりに おもうぞ！' },
    { id: 'cheer_4', x: 22, y: 9, sprite: 'npc:soldier', dir: 'left', cond: 'game_clear', text: 'くにじゅうで おまつりだ！' },
    { id: 'cheer_mother', x: 16, y: 4, sprite: 'npc:woman', dir: 'right', cond: 'game_clear', text: 'ユウキ…… よく がんばったね。\nとうさんも きっと\nよろこんで いるよ。' },
    { id: 'cheer_captain', x: 23, y: 4, sprite: 'npc:captain', dir: 'left', cond: 'game_clear', text: 'よう ゆうしゃさまがた！\nおれの ふねは やくに たったかい？\nがっはっは！' },
    { id: 'cheer_teacher', x: 24, y: 7, sprite: 'npc:sage', dir: 'left', cond: 'game_clear', text: 'メテムや よく やったのう。\nおまえは わしの じまんの\nでしじゃ。' },
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
