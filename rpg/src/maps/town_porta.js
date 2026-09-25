// 港町ポルタ (east region, Lv 6–9): harbour, piers, the captain and his ship.
// Before flag bandits_defeated the port is blockaded; afterwards the captain
// gives the ship (event porta_captain → ev.giveShip('porta_dock'), flag has_ship).
// Map ids: porta_town porta_house
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
  const FREE = 'bandits_defeated';

  R.DB.maps.porta_town = {
    name: 'みなとまち ポルタ', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
    location: 'porta', outside: '~',
    exit: { to: 'world', spawn: 'porta_town' },
    rows: [
      '#################################~~~~~~~~~~~',
      '#BBBBBBBBBB,,RRRRRRRR,BBBBBBBBB..~~~~~~~~~~~',
      '#B_Y_O__Y_B,,RRRRRRRR,Bj$___%jB..~~~~~~~~~~~',
      '#B___aa___B,,BBB<BBBB,Bjo___ojB..~~~~~~~~~~~',
      '#B___++___B,,,,,4,,,,,BBBB1BBBB..~~~~~~~~~~~',
      '#Bhh_++_hhB,,,,,:,,,,,B__A____B..~~~~~~~~~~~',
      '#B___++_J_B,,f,,:,,f,,Bo_____jB..~~~~~~~~~~~',
      '#Bhh_++_hhB,,,,,:,,,,,Bjo___ojB..~~~~~~~~~~~',
      '#BBBBDBBBBB,,,,,:,,,,,BBBBDBBBB..~~~~~~~~~~~',
      '#::::::::::::::::::::::::::::::..~~~~~~~~~~~',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..=======n~~~',
      '#BBBBBBBBBBB,,,,,,,BBBBBBBBBBB,..~~~~~~~~~~~',
      '#Bb_b_b_b__B,,f,f,,Bouuuo_+++B,..~~~~~~~~~~~',
      '#Bb_b_b_b__B,,,,,,,B_Q____+Z+B,..~~~~~~~~~~~',
      '#B_________B,,,!,,,Bccc___+++B,..~~~~~~~~~~~',
      '#B______I__B,,,,,,,B__t_t____B,z.~~~~9~~~~~~',
      '#B_____ccc_B,M,,,,,B__h_hVX__B,..~~~~~~~~~~~',
      '#B_N_______B,,,,,,,B_________B,..~~~~~~~~~~~',
      '#BBBBBDBBBBB,,,,,,,BBBBBDBBBBB,..~~~~~~~~~~~',
      '@:::[::::::::::::::::::]:::::::..~~~~~~~~~~~',
      '#,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..=====v==~~~',
      '#BBBBBBBBB,BBBBBBBBBBBB,RRRRRR,..~~~~~~~~~~~',
      '#BuuuuuuuB,Buuuu__uuuuB,RRRRRR,..~~~~~~~~~~~',
      '#B___H___B,B_E______G_B,BBBBBB,..~~~~~~~~~~~',
      '#BcccccccB,Bccc____cccB,,,,,,,,..~~~~~~~~~~~',
      '#B_______B,B__________B,,y,,,,,..~~~~~~~~~~~',
      '#Bo?____jB,Bjo__U___ojB,,,,,,,,..~~~~~~~~~~~',
      '#BBBBDBBBB,BBBBBDDBBBBB,,,,,,,,..~~~~~~~~~~~',
      '#,,,{:,,,,,,,,,,::,},,,,,,,,,,,..~~~~~~~~~~~',
      '#::::::::::::::::::::::::::::::..~~~~~~~~~~~',
      '#dddddddddddddddddddddddddddwdddd~~~~~~~~~~~',
      '#ddddddddddddddddddddddddddd~~~~~~~~~~~~~~~~',
      '#ddddddddddddddddddddddd~~~~~~~~~~~~~~~~~~~~',
      '########################~~~~~~~~~~~~~~~~~~~~',
    ],
    marks: {
      '@': spawn('entrance', 'right', ':'),
      '4': spawn('captain_house', 'down', ':'),
      '<': warp('porta_house', 'entrance', 'D', 'up'),
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', 'うみの おとこたちの ぶじを\nまいにち いのって います。', { dir: 'left' }),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 15, dir: 'down' }),
      N: chat('inn_guest', 'man', '_', [
        { cond: FREE, text: 'やっと ふねが でるらしい！\nあんたたちの おかげだってな！' },
      ], 'ふねが でないんで\nもう みっかも ここに\nとまりっぱなしさ。', { dir: 'down' }),
      H: shop('item', '_', 'porta_item', { dir: 'down' }),
      E: shop('weapon', '_', 'porta_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'porta_armor', { dir: 'down' }),
      U: say('customer', 'woman', '_', 'ナイトの ジョブなら\nおもい よろいも かぶとも\nそうび できるのよね。\fそうび できるか どうかは\nみせの リストで わかるわ。', { dir: 'up' }),
      Q: chat('bartender', 'man', '_', [
        { cond: 'game_clear', text: 'まおうを たおした ゆうしゃさまの\nおでましだ！\nきょうは のみほうだいだぜ！' },
        { cond: FREE, text: 'きょうは おいわいだ！\nみなとが もとに もどったからな！\fさあ のんで いきな！\n……おっと こどもは ミルクだぜ。' },
      ], 'いらっしゃい。\nと いっても ふねが でないから\nきゃくも へる いっぽうさ。', { dir: 'down' }),
      Z: say('dancer', 'dancer', '+', [
        'あたしの おどりを みて\nげんきを だしてね♪',
        'ぎんゆうしじんの うたには\nふしぎな ちからが あるのよ。\fそうりょと とうぞくを きたえれば\nなれるって はなし。',
      ], { dir: 'down' }),
      V: say('patron', 'dwarf', '_', 'とうぞくの おかしらは\nとんでもない ちからもちだって\nはなしだ。\fくすりは たっぷり もって いけよ。', { dir: 'up' }),
      X: npc('lookout', 'bandit', '_', { text: 'へっへっへ……\nみなとの ふねは どこにも\nいけやしねえよ。\nおかしらが いる かぎりな！', dir: 'left', cond: '!' + FREE }),
      A: chat('worker', 'man', '_', [
        { cond: { item: 'silver_key' }, text: 'おお そいつは くらの かぎ！\nとうぞくから とりかえして\nくれたのか！\fなかの ものは おれいだ。\nえんりょなく もってけ！' },
      ], ['おくの くらには ぎんの とびらが\nあってな。', 'その かぎは むかし\nとうぞくどもに\nぬすまれちまったんだ。'], { dir: 'down' }),
      M: say('old_sailor', 'old_man', ',', [
        'わしは むかし ふなのりじゃった。',
        'うみの まんなかに\nひかりの しんでんと いう\nふしぎな しまが あるそうじゃ。',
      ], { move: 'wander' }),
      z: npc('captain', 'captain', '.', { event: 'porta_captain', dir: 'right' }),
      '9': npc('moored_ship', 'ship', '~', { sprite: 'obj:ship', dir: 'left', text: 'りっぱな ふねだ。', cond: '!has_ship' }),
      n: chat('sailor', 'sailor', '=', [
        { cond: FREE, text: 'うみは いいぞお！\nふねが あれば どこへだって いける！\fいちど いった まちへは\n『たびどりのはね』で\nひとっとびさ。' },
      ], 'とうぞくの ふねが おきで\nみはって やがる。\nこれじゃ りょうにも でられねえ。', { dir: 'right' }),
      v: say('fisher', 'old_man', '=', 'つれないねえ……。\fふねで うみに でれば\nうみの まものとも たたかう。\nあいつらは てごわいぞ。', { dir: 'down' }),
      y: chat('girl', 'girl', ',', [
        { cond: 'has_ship', text: 'おとうさんの ふね\nあなたたちに あげちゃったの？\nだいじに してね！' },
      ], 'おとうさんの ふね\nはやく うみに でられると\nいいな。', { move: 'wander' }),
      w: say('boy', 'boy', 'd', 'はまべで きれいな かいがらを\nひろったんだ！ みる？\fへへ あげないよーだ！', { move: 'wander' }),
      '$': chest('porta_c1', 'revive_feather', 2, '_'),
      '%': chest('porta_c2', 'cat_hood', 1, '_'),
      '!': hidden('porta_h1', 'seed_mp', 'W'),
      '?': hidden('porta_h2', 'numb_cure', 'o'),
      '[': sign('たびびとの やどや'),
      ']': sign('さかば 「うみねこ」'),
      '{': sign('どうぐや'),
      '}': sign('ぶきと ぼうぐの みせ'),
    },
  };

  R.DB.maps.porta_house = {
    name: 'みなとまち ポルタ', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#u.b.b..kk$#',
      '#..b.b.....#',
      '#..........#',
      '#.tt...G...#',
      '#.hh.....w.#',
      '#jo...@..p?#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('porta_town', 'captain_house', 'D', 'down'),
      G: chat('wife', 'woman', '.', [
        { cond: 'has_ship', text: 'うちの ひと ふねを\nあげちまったんだって？\fまったく…… でも あんたたちなら\nいいって いってたよ。\nだいじに つかってね。' },
      ], 'うちの ひとは みなとに いるよ。\nふねが だせなくて\nまいにち いらいら してるのさ。', { dir: 'down' }),
      w: say('son', 'boy', '.', 'ぼくも おおきく なったら\nとうちゃんみたいな\nせんちょうに なるんだ！', { move: 'wander' }),
      '$': chest('porta_house_c1', 'mana_drop', 1),
      '?': hidden('porta_house_h1', 'seed_agi', 'p'),
    },
  };
})(window.RPG);
