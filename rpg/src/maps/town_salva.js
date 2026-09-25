// 砂漠の町サルバ (south-west desert oasis, Lv 14–18) and the fortune teller's parlour.
// Map ids: salva_town salva_house
// Layout: the chief's sandstone palace (north, centre: throne room flanked by the
// treasury/records room and the chief's quarters), the inn (NW) and the weapon +
// armour shops (NE) along the main street; the church (W), the oasis with its palm
// island (centre) and the item shop + storeroom (E); south of the cross street the
// bazaar with its stalls, tea tables and well (SW), the canal-lined avenue to the
// gate, the fortune teller's house, a family home and the dancer's stage (SE).
// Every map has a decor layer (DESIGN §7.1). No hidden items: former hidden spots
// are visible chests (salva_h1 by the oasis, salva_h2 in the storeroom,
// salva_house_h1 in the parlour corner).
// Review: node tools/fixtures/towns/salva/check.js · node tools/fixtures/towns/salva/render.js
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
  const EARTH = { item: 'crest_earth' };

  R.DB.maps.salva_town = {
    name: '砂漠の町サルバ', type: 'town', legend: 'local', theme: 'pyramid', bgm: 'town',
    location: 'salva', outside: 'd',
    exit: { to: 'world', spawn: 'salva_town' },
    rows: [
      '############################################',
      '#TTddddddTdd###################ddTddddddTTT#',
      '#BBBBBBBBBBd#.$%.#...A...#.b..#dBBBBBBBBBBB#',
      '#Bb_b__u__Bd#p..p#.M...z.#.b..#dB____B____B#',
      '#Bb_b_uIc_Bd#....#.......#....#dB_E__B__G_B#',
      '#B____ccccBd#k...#.l...l.#....#dBccccBccccB#',
      '#B________Bd#k...D.......D.(..#dB____B____B#',
      '#BN_______Bd#k...#.......#....#dB____B_U__B#',
      '#B________Bd#....#.l...l.#....#dB____B____B#',
      '#BBBBDBBBBBd#....#.......#....#dBBBDBBBBDBB#',
      '#ddddddddddd#########D#########dddddddddddd#',
      '#::::::::::::::::::::::::::::::::::::::::::#',
      '#::::::::::::::::::::::::::::::::::::::::::#',
      '###########ddTT,,,,,,y,,f,,,,TTddBBBBBBBBBB#',
      '##..YOY...#ddT,,,~~~~~~~~~~,,,TddBu___uBjoB#',
      '##...aa...#dd,,~~~~~~~~~~~~~~,,ddB__H__B__B#',
      '##......J.#dd,~~~~~~~T,~~~~~~~,ddBcccccB__B#',
      '##........#dd,~~~~~~~,,~~~~~~~,ddB_____D__B#',
      '##........#dd,~~~~~~~~~~~~~~~~,ddB_____B__B#',
      '##........#dd,?~~~~~~~~~~~~~~,,ddB_____B_!B#',
      '##........#ddT,,,~~~~~~~~~~,,,TddB_____BpoB#',
      '#####DD####ddTT,,,,~,,,,~,,,,TTddBBBDBBBBBB#',
      '#::::::::::::::::::=::::=::::::::::::::::::#',
      '#::::::::::::::::::=::::=::::::::::::::::::#',
      '#dddddddddddddddddd~::::~ddddRRRRRRRRRddddd#',
      '#ddQddddXddddd0dddd~::::~ddddRRRRRRRRRddddd#',
      '#dddddddddddddddddd~::::~ddddBBBB<BBBBddddd#',
      '#dddddddddddddddddd~::::~dddddddd5d[ddddddT#',
      '#dddddddddddddWdddd=::::=dBBBBBBBdddddddddd#',
      '#dd7dddd8dpdddddddd~::::~dB___6bBdddddddddd#',
      '#dddddddddodddddddd~::::~dB_4__bBddddZddddd#',
      '#dddddddddddnddddTd~::::~dB_____Bdddddddddd#',
      '#ddddwddddddddddddd~}:::~dB_____Bddddd9dddd#',
      '#dddddddddddddddTdd~::::~dBBBDBBBdddddddddd#',
      '#dddddTdddddddddddddV::vddTddddddddddddddTd#',
      '#####################@:#####################',
    ],
    decor: [
      '............................................',
      '...UqMhZ......i.....i.....w.......hqU.M.....',
      '...p....k....G..G.Q.d.d.Q.A.......x.....i...',
      '...y..C.............ddd..........X..O.Y..Y..',
      '....................rrr....RRR..............',
      '....................rrr....RRR..............',
      '......rrr...........rrr.....................',
      '...nTnrrr......Dn...rrr.....Dn..............',
      '......rrr.........Y.rrr.Y...................',
      '....................rrr.....................',
      '....7.....3...w....b........w...3.5......6..',
      '............................................',
      '............................................',
      '..i.....W.......f..................k....i...',
      '..QZ....ZQ...........................C......',
      '............................................',
      '.....RR..................................U..',
      '..eeeRReee..................................',
      '.....RR............................rrr......',
      '..eeeRReee.........................rrr......',
      '.....RR.a..................f..........Z.....',
      '..w....i...3...e............e...3...........',
      '........8............................4......',
      '............................................',
      '..U.q....U..q...UE..3.....h............hM...',
      '............................................',
      '..999..999..999.............................',
      '..............................1.............',
      '.3.........e...............k................',
      '...........................K.C.....3ooo.....',
      '..999..999.nT.......................ooo.....',
      '.............................Tn.....ooo..h..',
      '..rrr..........T..................e.........',
      '..rrr.......................................',
      '..................................1.........',
      '............................................',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '5': spawn('house', 'down', 'd'),
      '<': warp('salva_house', 'entrance', 'D', 'up'),
      // inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 30, dir: 'down' }),
      N: say('inn_guest', 'man', '_', '雪の村フロストでは、\n霜よけの指輪を\n売っているそうだ。\f寒さに弱いなら、\n買っておくといいぜ。', { dir: 'right' }),
      // weapon + armor shops
      E: shop('weapon', '_', 'salva_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'salva_armor', { dir: 'down' }),
      U: say('customer', 'woman', '_', '武闘家は素手で戦うのが\nいちばん強いんですって。\f戦士と僧侶を鍛えると、\nなれるそうよ。', { move: 'wander' }),
      // item shop (+ storeroom)
      H: shop('item', '_', 'salva_item', { dir: 'down' }),
      '!': chest('salva_h2', 'antidote', 1, '_'),
      // church
      O: npc('priest', 'priest', '.', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '.', '太陽は毎日のぼります。\n闇もいつかは明けるのです。', { dir: 'left' }),
      // chief's palace
      A: chat('chief', 'elder', 'K', [
        { cond: 'game_clear', text: ['おお、魔王を倒したか！', 'サルバの民を代表して、\n礼を言うぞ。\nいつでも遊びに来るがよい。'] },
        { cond: EARTH, text: ['大地の紋章を\n取り戻したか！　見事じゃ！', '残る紋章は、\n金の扉の奥にあるという。\f北の雪国、フロストの村を\n訪ねるがよい。\n金の鍵のことを\n知る者がおるはずじゃ。'] },
      ], ['わしがサルバの長じゃ。', '西の砂の海に、\nいにしえのピラミッドがある。\f奥には大地の紋章が\n祀られておるが……\n銀の扉に守られておる。', '銀の鍵を持っておれば、\n扉は開こう。'], { dir: 'down' }),
      M: say('hall_guard_l', 'soldier', '.', 'ピラミッドの魔物は、\n聖なる力に弱いやつが多い。\fミイラのたぐいは、\n炎にもよく燃えるぞ。', { dir: 'down' }),
      z: say('hall_guard_r', 'soldier', '.', 'ピラミッドの奥には、\nスフィンクスが\n待ち構えているという話だ。', { dir: 'down' }),
      '$': chest('salva_hall_c1', 'courage_flute', 2, '.'),
      '%': chest('salva_hall_c2', 'healing_aroma', 1, '.'),
      '(': say('palace_maid', 'woman', '.', '長様は毎朝、オアシスの水を\nひと口飲んでから\nお仕事を始めるのですよ。\fこの町の命の水ですもの。', { move: 'wander' }),
      // oasis
      y: say('oasis_girl', 'girl', ',', 'このオアシスの水は、\n一度も枯れたことが\nないんですって。\f水路をたどって、\n町じゅうに流れているのよ。', { move: 'wander' }),
      '?': chest('salva_h1', 'seed_str', 1, ','),
      // bazaar
      Q: say('spice_seller', 'merchant', 'd', 'いらっしゃい！\n……と言いたいところだが、\nこいつは売り物じゃないんだ。\f砂漠を歩くなら、\n水と薬草はたっぷりとな！', { dir: 'down' }),
      X: say('fruit_seller', 'woman', 'd', '砂漠の魔物は、\n毒を持つやつも多いわ。\n解毒の実は忘れずにね！', { dir: 'down' }),
      '7': say('rug_seller', 'merchant', 'd', 'このじゅうたんは空を飛ぶ……\nわけないだろ！　はっはっは！', { dir: 'down' }),
      '8': say('water_seller', 'old_woman', 'd', '砂漠でいちばん高く売れる物は\n何か知ってるかい？\f水さ！　一杯100ゴールド。\n……冗談だよ。', { dir: 'down' }),
      n: say('traveler', 'man', 'd', 'ピラミッドの中は、\nまるで迷路だぜ。\f導きの糸を持っていけば、\nいつでも外に出られるからな。', { move: 'wander' }),
      '0': say('tea_seller', 'man', 'd', '冷たいミントのお茶はいかが？\n……と言っても、今日の分は\nもう売り切れなんだ。\f砂漠を越えるなら、\n頭には布を巻いておきな。\n防具屋のターバンがおすすめさ。', { dir: 'down' }),
      w: say('kid', 'boy', 'd', 'ぼく知ってる！\n砂漠の砂は熱くて、\nはだしじゃ歩けないんだよ！', { move: 'wander' }),
      // east quarter
      Z: say('dancer', 'dancer', 'd', 'サルバの踊りは、\n太陽の神様にささげる\n踊りなの♪', { dir: 'down' }),
      '9': say('cat', 'cat', 'd', 'ニャーオ。\f猫は涼しい日陰を\nよく知っている。', { move: 'wander' }),
      '4': say('housewife', 'woman', '_', '井戸の水は冷たくて\nおいしいのよ。\f昼は暑くて、夜は冷える。\nそれが砂漠の暮らしなの。', { move: 'wander' }),
      '6': say('grandpa', 'old_man', '_', '昔、ピラミッドの王は\n大地の紋章の力で\n砂漠に水を呼んだそうじゃ。\fこのオアシスも、\nその名残かもしれんのう。', { dir: 'left' }),
      '[': sign('占いの館\f星と砂が、あなたの\n行く末を語ります。'),
      // gate
      V: say('gate_l', 'soldier', ':', 'ようこそ、オアシスの町\nサルバへ。', { dir: 'down' }),
      v: say('gate_r', 'soldier', ':', '砂漠ではサソリに\n気をつけろ。\n毒を持っているぞ。\f水や氷の攻撃が\nよく効くらしい。', { dir: 'down' }),
      '}': sign('砂漠の町サルバ\f西の砂漠に\nピラミッドあり'),
    },
  };

  // ================================================================ 占いの館
  // The fortune teller's parlour behind the bazaar: she sits behind a crystal-ball
  // table on a low dais, with books, charts and her keepsakes around the room.
  R.DB.maps.salva_house = {
    name: '砂漠の町サルバ', type: 'town', legend: 'local', theme: 'pyramid', bgm: 'town',
    rows: [
      '############',
      '#kk.......$#',
      '#.....A...p#',
      '#.....t....#',
      '#..........#',
      '#..........#',
      '#?....@...o#',
      '######<#####',
    ],
    decor: [
      '.w....c....w',
      '...IQddQy...',
      '.....d.d....',
      '.Dn.........',
      '....rrrrr...',
      '....rrrrr...',
      '............',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('salva_town', 'house', 'D', 'down'),
      A: npc('fortune_teller', 'sage', '.', { event: 'fortune', dir: 'down' }),
      '$': chest('salva_house_c1', 'maneki', 1),
      '?': chest('salva_house_h1', 'seed_vit', 1),
    },
  };
})(window.RPG);
