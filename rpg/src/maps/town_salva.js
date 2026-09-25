// 砂漠の町サルバ (south-west desert oasis, Lv 14–18): sandstone walls, an
// oasis, a bazaar and the chieftain's hall; hints toward the pyramid.
// Map ids: salva_town salva_house
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
  const EARTH = { item: 'crest_earth' };

  R.DB.maps.salva_town = {
    name: 'オアシスの まち サルバ', type: 'town', legend: 'local', theme: 'pyramid', bgm: 'town',
    location: 'salva', outside: 'd',
    exit: { to: 'world', spawn: 'salva_town' },
    rows: [
      '########################################',
      '#' + 'BBBBBBBBBBB' + 'dd' + 'BBBBBBBBBBB' + 'ddd' + 'BBBBBBBBBBB' + '#',
      '#' + 'Bb_b_b_b__B' + 'dd' + 'Bl___A___lB' + 'ddd' + 'Buuu___uuuB' + '#',
      '#' + 'Bb_b_b_b__B' + 'dd' + 'Bl__+++__lB' + 'ddd' + 'B_E_____G_B' + '#',
      '#' + 'B_________B' + 'dd' + 'B_M_+++_z_B' + 'ddd' + 'Bccc___cccB' + '#',
      '#' + 'B______I__B' + 'dd' + 'Bl__+++__lB' + 'ddd' + 'B_________B' + '#',
      '#' + 'B_____ccc_B' + 'dd' + 'B___+++___B' + 'ddd' + 'B____U____B' + '#',
      '#' + 'B_N_______B' + 'dd' + 'BY$_+++_%YB' + 'ddd' + 'Bjo_____ojB' + '#',
      '#' + 'BBBBBDBBBBB' + 'dd' + 'BBBBBDBBBBB' + 'ddd' + 'BBBBBDBBBBB' + '#',
      '#' + '::::::::::::::::::::::::::::::::::::::' + '#',
      '#' + 'ddd[dddddddddddddddddddddddddd]ddddddd' + '#',
      '#' + 'BBBBBBBBBB' + 'ddd' + 'dTddddddddTd' + 'dd' + 'BBBBBBBBBBB' + '#',
      '#' + 'B_Y_O__Y_B' + 'ddd' + 'dT,,,,y,,,Td' + 'dd' + 'Buuuuuuuuu' + 'B' + '#',
      '#' + 'B___aa___B' + 'ddd' + 'd,,~~~~~~,,d' + 'dd' + 'B____H____B' + '#',
      '#' + 'B___++___B' + 'ddd' + 'd,~~~~~~~~,d' + 'dd' + 'BcccccccccB' + '#',
      '#' + 'Bhh_++_hhB' + 'ddd' + 'd,~~~~~~~~,d' + 'dd' + 'B_________B' + '#',
      '#' + 'B___++_J_B' + 'ddd' + 'd,,~~~?~~,,d' + 'dd' + 'Bo!_____joB' + '#',
      '#' + 'Bhh_++_hhB' + 'ddd' + 'dT,,,,,,,,Td' + 'dd' + 'B_________B' + '#',
      '#' + 'BBBBDBBBBB' + 'ddd' + 'dTddddddddTd' + 'dd' + 'BBBBBDBBBBB' + '#',
      '#' + '::::::::::::::::::::::::::::::::::::::' + '#',
      '#' + 'dddddddddddddddddddddddddddddd{ddddddd' + '#',
      '#' + 'ddddddddddddd' + 'dddd' + 'd::d' + 'dddd' + 'RRRRRRRR' + 'ddddd' + '#',
      '#' + 'djQojdjXojddd' + 'dTdd' + 'd::d' + 'ddTd' + 'RRRRRRRR' + 'ddddd' + '#',
      '#' + 'dcccddcccdddd' + 'dddd' + 'd::d' + 'dddd' + 'BBB<BBBB' + 'ddddd' + '#',
      '#' + 'ddddddddddddd' + 'dddd' + 'd::d' + 'dddd' + 'ddd5dddd' + 'ddZdd' + '#',
      '#' + 'ddddnddddwddd' + 'dddd' + 'd::d' + 'dddd' + 'ddd:dddd' + 'ddddd' + '#',
      '#' + 'ddTdddddddTdd' + 'dddd' + 'd::d' + 'dddd' + 'ddd:dddd' + 'ddddd' + '#',
      '#' + 'dj7ojdjo8jddd' + 'dddd' + 'd:::' + '::::' + '::::dddd' + 'ddddd' + '#',
      '#' + 'dcccddcccdddd' + 'dTdd' + 'd::d' + 'ddTd' + 'RRRRRRRR' + 'dTddd' + '#',
      '#' + 'ddddddddddWdd' + 'dddd' + 'd::d' + 'dddd' + 'RRRRRRRR' + 'ddddT' + '#',
      '#' + 'dTddddddddddd' + 'ddd}' + 'd::d' + 'dddd' + 'BBBBBBBB' + 'ddTdd' + '#',
      '#' + 'ddddddddddddd' + 'dddV' + 'd::d' + 'vddd' + 'oddjdd9d' + 'ddddd' + '#',
      '###################@:###################',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '5': spawn('house', 'down', 'd'),
      '<': warp('salva_house', 'entrance', 'D', 'up'),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 30, dir: 'down' }),
      N: say('inn_guest', 'man', '_', 'ゆきぐにの フロストの むらでは\nしもよけの ゆびわを\nうって いるそうだ。\fさむさに よわい なら\nかって おくと いいぜ。', { dir: 'down' }),
      E: shop('weapon', '_', 'salva_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'salva_armor', { dir: 'down' }),
      U: say('customer', 'woman', '_', 'ぶとうかは すでで たたかうのが\nいちばん つよいんですって。\fせんしと そうりょを\nきたえると なれるそうよ。', { dir: 'up' }),
      H: shop('item', '_', 'salva_item', { dir: 'down' }),
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', 'たいようは まいにち のぼります。\nやみも いつかは あけるのです。', { dir: 'left' }),
      A: chat('chief', 'elder', 'K', [
        { cond: 'game_clear', text: ['おお まおうを たおしたか！', 'サルバの たみを だいひょうして\nれいを いうぞ。\nいつでも あそびに くるが よい。'] },
        { cond: EARTH, text: ['だいちの もんしょうを\nとりもどしたか！ みごとじゃ！', 'のこる もんしょうは\nこがねの とびらの おくに\nあると いう。\fきたの ゆきぐに フロストの むらを\nたずねるが よい。\nこがねの かぎの ことを\nしる ものが おるはずじゃ。'] },
      ], ['わしが サルバの おさ じゃ。', 'にしの すなの うみに\nいにしえの ピラミッドが ある。\fおくには だいちの もんしょうが\nまつられて おるが……\nぎんの とびらに まもられて おる。', 'しろがねの かぎを もって おれば\nとびらは ひらこう。'], { dir: 'down' }),
      M: say('hall_guard_l', 'soldier', '_', 'ピラミッドの まものは\nほのおに よわい やつが おおい。\fミイラの たぐいには\nひかりの ちからも きくぞ。', { dir: 'right' }),
      z: say('hall_guard_r', 'soldier', '_', 'ピラミッドの おくには\nスフィンクスが まちかまえて いると\nいう はなしだ。', { dir: 'left' }),
      Q: say('spice_seller', 'merchant', 'd', 'いらっしゃい！\n……と いいたい ところだが\nこいつは うりものじゃ ないんだ。\fさばくを あるくなら\nみずと やくそうは たっぷりとな！', { dir: 'down' }),
      X: say('fruit_seller', 'woman', 'd', 'さばくの まものは\nどくを もつ やつも おおいわ。\nげどくのみは わすれずにね！', { dir: 'down' }),
      n: say('traveler', 'man', 'd', 'ピラミッドの なかは\nまるで めいろだぜ。\f『みちびきのいと』を もって いけば\nいつでも そとに でられるからな。', { move: 'wander' }),
      w: say('kid', 'boy', 'd', 'ぼく しってる！\nさばくの すなは あつくて\nはだしじゃ あるけないんだよ！', { move: 'wander' }),
      y: say('oasis_girl', 'girl', ',', 'この オアシスの みずは\nいちども かれた ことが\nないんですって。', { dir: 'down' }),
      Z: say('dancer', 'dancer', 'd', 'サルバの おどりは\nたいようの かみさまに\nささげる おどりなの♪', { dir: 'down' }),
      V: say('gate_l', 'soldier', 'd', 'ようこそ オアシスの まち\nサルバへ。', { dir: 'right' }),
      v: say('gate_r', 'soldier', 'd', 'さばくでは サソリに\nきを つけろ。\nどくを もって いるぞ。', { dir: 'left' }),
      '7': say('rug_seller', 'merchant', 'd', 'この じゅうたんは そらを とぶ……\nわけ ないだろ！ はっはっは！', { dir: 'down' }),
      '8': say('water_seller', 'old_woman', 'd', 'さばくで いちばん たかく うれる\nものは なにか しってるかい？\fみずさ！ いっぱい 100ゴールド。\n……じょうだんだよ。', { dir: 'down' }),
      '$': chest('salva_hall_c1', 'courage_flute', 2, '_'),
      '%': chest('salva_hall_c2', 'healing_aroma', 1, '_'),
      '9': say('cat', 'cat', 'd', 'ニャーオ。\fねこは すずしい ひかげを\nよく しって いる。', { move: 'wander' }),
      '?': hidden('salva_h1', 'seed_str', '~'),
      '!': hidden('salva_h2', 'antidote', 'o'),
      '[': sign('たびびとの やどや'),
      ']': sign('ぶきと ぼうぐの みせ'),
      '{': sign('どうぐや'),
      '}': sign('オアシスの まち サルバ\fにしの さばくに\nピラミッド あり'),
    },
  };

  R.DB.maps.salva_house = {
    name: 'オアシスの まち サルバ', type: 'town', legend: 'local', theme: 'pyramid', bgm: 'town',
    rows: [
      '############',
      '#k.+++++.k$#',
      '#..+++++...#',
      '#..++A++...#',
      '#..+++++.p?#',
      '#..........#',
      '#oj..@...jo#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('salva_town', 'house', 'D', 'down'),
      A: npc('fortune_teller', 'sage', '+', { event: 'fortune', dir: 'down' }),
      '$': chest('salva_house_c1', 'maneki', 1),
      '?': hidden('salva_house_h1', 'seed_vit', 'p'),
    },
  };
})(window.RPG);
