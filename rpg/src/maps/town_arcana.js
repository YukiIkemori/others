// 魔法都市アルカナ (eastern continent, Lv 25–30): the magic academy (メテム's
// school), a library of job lore, magic circles that teleport across the city,
// メテム's family home; hints toward the star tower.
// Map ids: arcana_city arcana_house_metem
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const hidden = (id, item, under) => ({ hidden: { id, item }, under });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir, sfx: 'warp' }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const STAR = { item: 'crest_star' };
  const GOLD = { item: 'gold_key' };

  R.DB.maps.arcana_city = {
    name: 'まほうとし アルカナ', type: 'town', legend: 'local', theme: 'tower', bgm: 'town',
    location: 'arcana', outside: '#',
    exit: { to: 'world', spawn: 'arcana_city' },
    rows: [
      '############################################',
      '#' + ',,,,,,,' + '###i######i#####i######i###' + ',,,,,,,,' + '#',
      '#' + ',f,T,f,' + '#kkkkkkkkk_l_a_l_kkkkkkkkk#' + ',T,,,,T,' + '#',
      '#' + ',,,,,,,' + '#__________++A++_________$#' + ',,,,,,,,' + '#',
      '#' + ',f,,,f,' + '#__________+++++__________#' + ',,f,,f,,' + '#',
      '#' + ',,,,,,,' + '#_tt_tt_tt_+++++_tt_tt_tt_#' + ',,,,,,,,' + '#',
      '#' + ',,T,,,,' + '#_hh_hQ_hh_+++++_hh_hh_Zh_#' + ',,,0,,,,' + '#',
      '#' + ',,,(,,,' + '#_tt_tt_tt_+++++_tt_tt_tt_#' + ',,,,,,,,' + '#',
      '#' + ',,,,,,,' + '#_hh_hh_Nh_+++++_hh_hh_hh_#' + ',T,,,,T,' + '#',
      '#' + ',f,,,f,' + '#__________+++++___M______#' + ',,f,,f,,' + '#',
      '#' + ',,,,,,,' + '#_P________+++++________P_#' + ',,,,,,,,' + '#',
      '#' + ',,T,,,,' + '#___U______+++++__________#' + ',,,,,,,,' + '#',
      '#' + ',,,,,,,' + '#############D#############' + ',,,,,,,,' + '#',
      '#' + '..........................................' + '#',
      '#' + '..........................................' + '#',
      '#' + '##i###i####' + '..' + '................' + '..' + '##i###i####' + '#',
      '#' + '#b_b_b_b__#' + '..' + '.f.f..~~~~..f.f.' + '..' + '#uuu_u_uuu#' + '#',
      '#' + '#b_b_b_b__#' + '..' + '.....~~~~~~.....' + '..' + '#_E__H__G_#' + '#',
      '#' + '#_________#' + '..' + '.<...~~YY~~...>.' + '..' + '#ccccccccc#' + '#',
      '#' + '#______I__#' + '..' + '.....~~~~~~.....' + '..' + '#_________#' + '#',
      '#' + '#_____ccc_#' + '..' + '.f.f..~~~~..f.f.' + '..' + '#___V_____#' + '#',
      '#' + '#_n_______#' + '..' + '.............y..' + '..' + '#jo_____oj#' + '#',
      '#' + '#####D#####' + '..' + '................' + '..' + '#####D#####' + '#',
      '#' + '...;......................................' + '#',
      '#' + '......................................"...' + '#',
      '#' + '###i#####i###' + '..' + '##i#####i##' + '..' + 'RRRRRRRR' + ',,,,,,' + '#',
      '#' + '#kk[kkk]kkk!#' + '..' + '#_Y__O__Y_#' + '..' + 'RRRRRRRR' + ',T,,T,' + '#',
      '#' + '#_________%_#' + '..' + '#____a____#' + '..' + 'BBB/BBBB' + ',,,,,,' + '#',
      '#' + '#_tt__J__tt_#' + '..' + '#____+____#' + '..' + '...6....' + ',,f,,,' + '#',
      '#' + '#_hw_____hh_#' + '..' + '#hh__+__hh#' + '..' + '........' + ',,,,,,' + '#',
      '#' + '#k{k___k}kk_#' + '..' + '#____+__X_#' + '..' + '........' + ',T,,T,' + '#',
      '#' + '#___________#' + '..' + '#hh__+__hh#' + '..' + '........' + ',,,,,,' + '#',
      '#' + '######D######' + '..' + '#####D#####' + '..' + '........' + ',,,,,,' + '#',
      '#' + '..........................................' + '#',
      '#' + ',,,,,,,,,,,,,,,,,,,v..z,,,,,,,,,,,,,,,,,,,' + '#',
      '#' + ',,,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,)f,' + '#',
      '#####################@.#####################',
    ],
    spawns: {
      pad_w: { x: 15, y: 18, dir: 'down' },
      pad_e: { x: 28, y: 18, dir: 'down' },
      pad_nw: { x: 4, y: 7, dir: 'down' },
      pad_se: { x: 40, y: 35, dir: 'up' },
    },
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '6': spawn('metem_house', 'down', '.'),
      '/': warp('arcana_house_metem', 'entrance', 'D', 'up'),
      '<': warp('arcana_city', 'pad_e', 'P'),
      '>': warp('arcana_city', 'pad_w', 'P'),
      '(': warp('arcana_city', 'pad_se', 'P'),
      ')': warp('arcana_city', 'pad_nw', 'P'),
      A: chat('headmaster', 'sage', '+', [
        { cond: 'game_clear', text: ['メテム…… よく やった。', 'おまえの なは えいえんに\nこの がくいんの れきしに\nきざまれる じゃろう。'] },
        { cond: STAR, text: ['ほしの もんしょうを\nてにいれたか。\nさすがは わしの じまんの でしじゃ。', 'いつつ そろったら\nひかりの しんでんへ ゆくのじゃ。\nせかいの まんなかの しまに ある。'] },
        { cond: GOLD, text: ['おお メテム！ よく もどったのう。', 'ほしみの とうは まちの ほくとう。\nこがねの とびらの さきに\nほしの もんしょうが ある。\fいただきを まもる ほしの しゅごしんは\nやみの ちからに よわいと いう。\nひかりの まほうは きかぬぞ。'] },
      ], ['おお メテム！ よく もどったのう。', 'ほしみの とうの とびらは\nこがねの かぎで とざされて おる。\fかぎは きたの ゆきぐにに\nあると きく。'], { dir: 'down' }),
      Q: say('student_a', 'boy', 'h', 'メテムせんぱい！\nおかえりなさい！\fせんぱいは がくいん はじまって\nいらいの てんさいって\nいわれて いるんですよ！', { dir: 'up' }),
      Z: say('student_b', 'girl', 'h', 'しろまどうしと くろまどうしを\nどちらも ジョブレベル5まで\nきたえると けんじゃに\nなれるんですって。', { dir: 'up' }),
      N: say('student_c', 'boy', 'h', 'じくうまどうしは\nくろまどうし4と\nぎんゆうしじん3で なれるんだ。\fときを あやつる まほうって\nかっこいいよね！', { dir: 'up' }),
      M: say('teacher', 'scholar', '_', 'まほうけんしは\nナイト3と くろまどうし3。\fけんと まほうを あわせた\nわざは たのもしいぞ。', { move: 'wander' }),
      U: say('student_d', 'girl', '_', 'わたし メテムせんぱいみたいに\nなりたいんです！\fそれで まいにち\nほんを よんでるんです！', { move: 'wander' }),
      '0': say('old_mage', 'sage', ',', 'まのうずの むこうの まおうじょう。\nあそこは まさに じごく……。\fひかりの もんしょうが なければ\nちかづく ことも できまい。', { dir: 'down' }),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 60, dir: 'down' }),
      n: say('inn_guest', 'man', '_', 'この まちの まほうじんに のると\nまちの はしから はしへ\nひとっとび できるんだ。', { dir: 'down' }),
      E: shop('weapon', '_', 'arcana_weapon', { dir: 'down' }),
      H: shop('item', '_', 'arcana_item', { dir: 'down' }),
      G: shop('armor', '_', 'arcana_armor', { dir: 'down' }),
      V: say('customer', 'woman', '_', 'ほしくずの そうびは\nこの まちでしか\nてに はいらないのよ。', { dir: 'up' }),
      y: npc('fortune_teller', 'sage', '.', { event: 'fortune', dir: 'down' }),
      J: say('librarian', 'woman', '_', 'ここは アルカナ としょかん。\fほんだなの ほんは じゆうに\nよんで いいのよ。\nジョブの ことも くわしく\nかいて あるわ。', { dir: 'down' }),
      w: say('reader', 'scholar', 'h', 'しーっ！\nとしょかんでは おしずかに！', { dir: 'up' }),
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      X: say('nun', 'nun', '_', 'ほしの ひかりは かみの まなざし。\nいつも みまもって いますよ。', { dir: 'left' }),
      v: say('gate_l', 'soldier', ',', 'ようこそ まほうとし アルカナへ。', { dir: 'right' }),
      z: say('gate_r', 'soldier', ',', 'まちの なかの まほうじんは\nだれでも つかって いいぞ。', { dir: 'left' }),
      '$': chest('arcana_academy_c1', 'magic_orb', 1, '_'),
      '%': chest('arcana_library_c1', 'goddess_tear', 1, '_'),
      '!': hidden('arcana_h1', 'seed_mp', 'k'),
      '[': sign('『さんだんかいめの ジョブ その1』\fまほうけんし：\nナイト3 ＋ くろまどうし3\fパラディン：\nナイト5 ＋ しろまどうし4\fにんじゃ：\nかりゅうど4 ＋ ぶとうか3', 'k'),
      ']': sign('『さんだんかいめの ジョブ その2』\fけんじゃ：\nしろまどうし5 ＋ くろまどうし5\fりゅうきし：\nナイト4 ＋ かりゅうど4\fじくうまどうし：\nくろまどうし4 ＋ ぎんゆうしじん3\fあんこくきし：\nせんし6 ＋ くろまどうし4', 'k'),
      '{': sign('『でんせつの ゆうしゃ』\fパラディンと まほうけんしを\nともに 5まで きたえし もの\nゆうしゃと ならん。', 'k'),
      '}': sign('『ほしみの とう』\fいにしえの まほうつかいが\nほしを よむ ために たてた とう。\fさいじょうかいには\nほしの もんしょうが\nまつられて いる。', 'k'),
      ';': sign('たびびとの やどや'),
      '"': sign('まほうの みせ\nぶき ぼうぐ どうぐ'),
    },
  };

  R.DB.maps.arcana_house_metem = {
    name: 'まほうとし アルカナ', type: 'town', legend: 'local', theme: 'tower', bgm: 'town',
    rows: [
      '############',
      '#kkkk.b.b.$#',
      '#.....b.b..#',
      '#..........#',
      '#.tt...G...#',
      '#.hh.......#',
      '#.....E..k[#',
      '#po?..@..jo#',
      '######/#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '/': warp('arcana_city', 'metem_house', 'D', 'down'),
      G: npc('metem_mother', 'woman', '.', { event: 'metem_mother', dir: 'down' }),
      E: say('metem_father', 'scholar', '.', 'メテムは ちいさい ころから\nほしを みるのが すきでな。\fまさか せかいを すくう たびに\nでるとは……。\fふたりとも むすめを\nよろしく たのみます。', { dir: 'left' }),
      '$': chest('arcana_metem_c1', 'mana_crystal', 2),
      '?': hidden('arcana_metem_h1', 'seed_int', 'p'),
      '[': sign('メテムの ノートだ。\f「ほしの ちずを かんせい させる。\nそれが わたしの ゆめ。」\fらくがきで ねこの えが\nかいて ある……。', 'k'),
    },
  };
})(window.RPG);
