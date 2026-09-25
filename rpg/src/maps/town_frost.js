// 雪の村フロスト (northern snowfield, Lv 18–22): snow ground, a frozen pond with
// skating children, a snowman; hints toward the ice cave (gold key), the
// volcano and the star tower.
// Map ids: frost_village frost_house_elder frost_house
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
  const GOLD = { item: 'gold_key' };

  R.DB.maps.frost_village = {
    name: 'フロストの むら', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'frost', outside: 'T',
    exit: { to: 'world', spawn: 'frost_village' },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT' + '********************************' + 'TT',
      'TT' + 'BBBBBBBBB' + '**' + 'RRRRRRRR' + '***' + 'BBBBBBBBBB' + 'TT',
      'TT' + 'B_Y_O_Y_B' + '**' + 'RRRRRRRR' + '***' + 'Bb_b_b___B' + 'TT',
      'TT' + 'B___a___B' + '**' + 'BBB<BBBB' + '***' + 'Bb_b_b___B' + 'TT',
      'TT' + 'B___+___B' + '**' + '***4****' + '***' + 'B________B' + 'TT',
      'TT' + 'Bhh_+_hhB' + '**' + '***:****' + '***' + 'B_____I__B' + 'TT',
      'TT' + 'B___+_J_B' + '*n' + '***:****' + '***' + 'B____ccc_B' + 'TT',
      'TT' + 'Bhh_+_hhB' + '**' + '***:****' + '***' + 'B_N______B' + 'TT',
      'TT' + 'BBBBDBBBB' + '**' + '***:****' + '***' + 'BBBBBDBBBB' + 'TT',
      'TT' + '::::::::::::::::::::::::::::::::' + 'TT',
      'TT' + '*************************[******' + 'TT',
      'TT' + '*' + 'FFFFFFFFFFFF' + '******' + 'BBBBBBBBBBBBB' + 'TT',
      'TT' + '*' + 'FeeeeeeeeeeF' + '****T*' + 'Buuu_uuu_uuuB' + 'TT',
      'TT' + '*' + 'FeeeyeeeeeeF' + '**Y***' + 'B_E__G___H__B' + 'TT',
      'TT' + '*' + 'FeeeeeeeweeF' + '******' + 'BcccccccccccB' + 'TT',
      'TT' + '*' + 'FeeeeeeeeeeF' + '*A****' + 'B___________B' + 'TT',
      'TT' + '*' + 'FFFFF**FFFFF' + '******' + 'B_U_______?oB' + 'TT',
      'TT' + '*' + '************' + '*T****' + 'Bjo_______ojB' + 'TT',
      'TT' + '*' + '*****M******' + '******' + 'BBBBBBDBBBBBB' + 'TT',
      'TT' + '::::::::::::::::::::::::::::::::' + 'TT',
      'TT' + '*******************}************' + 'TT',
      'TT' + '*' + 'RRRRRRR' + '***************' + 'RRRRRRRR' + '*' + 'TT',
      'TT' + '*' + 'RRRRRRR' + '*******:*******' + 'RRRRRRRR' + '*' + 'TT',
      'TT' + '*' + 'BBBBBBB' + '*******:*******' + 'BBB>BBBB' + '*' + 'TT',
      'TT' + '*' + '*oj$***' + '*******:*******' + '***5****' + '*' + 'TT',
      'TT' + '*' + '*******' + '*******::::::::' + '::::****' + '*' + 'TT',
      'TT' + '*' + '**T****' + '*****6*:*******' + '******T*' + '*' + 'TT',
      'TT' + '*' + '*******' + '*****V*:X******' + '********' + '*' + 'TT',
      'TTTTTTTTTTTTTTTTT' + '@:' + 'TTTTTTTTTTTTTTTTT',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('elder_house', 'down', '*'),
      '5': spawn('house', 'down', '*'),
      '<': warp('frost_house_elder', 'entrance', 'D', 'up'),
      '>': warp('frost_house', 'entrance', 'D', 'up'),
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', 'だんろの ない きょうかいは\nさむいでしょう？\fでも かみの あいは\nいつでも あたたかいのですよ。', { dir: 'left' }),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 40, dir: 'down' }),
      N: say('inn_guest', 'man', '_', 'ほのおの かざんの なかには\nあるくだけで やけどする\nようがんの ゆかが あるそうだ。\fじくうまどうしの\n『ふゆうのじゅつ』が あれば\nへっちゃら らしいがな。', { dir: 'down' }),
      E: shop('weapon', '_', 'frost_weapon', { dir: 'up' }),
      G: shop('armor', '_', 'frost_armor', { dir: 'up' }),
      H: shop('item', '_', 'frost_item', { dir: 'up' }),
      U: say('customer', 'woman', '_', 'ひょうけつの どうくつの\nまものは こおりの いきを\nはいて くるの。\fしもよけの ゆびわが あれば\nずいぶん らくに なるわよ。', { dir: 'down' }),
      n: chat('hunter', 'man', '*', [
        { cond: 'game_clear', text: 'まおうが いなくなってから\nまものも おとなしく なったな。\nこれで りょうに せいが でるぜ。' },
        { cond: GOLD, text: 'こがねの かぎを てにいれたのか！\fそれなら ほくとうの かざんにも\nひがしの ほしみの とうにも\nはいれるはずだ。\fかざんの ぬしは みずの ちからに\nよわいと きいたぞ。' },
      ], ['ひょうけつの どうくつは\nこの ゆきぐにの ずっと ひがし。', 'おくには こおりの きょじんが\nねむって いるらしい。\nほのおの まほうが\nよく きくそうだぞ。'], { dir: 'right' }),
      y: say('skater_girl', 'girl', 'e', 'こおりの うえを すべるの\nたのしいよ！\fえ？ ぜんぜん すべってない？\nきぶんよ きぶん！', { move: 'wander' }),
      '6': say('snow_girl', 'girl', '*', 'さむいけど ゆきあそびは\nやめられないの！\fゆきがっせん する？\nえいっ！', { move: 'wander' }),
      w: say('skater_boy', 'boy', 'e', 'ゆきだるま みた？\nぼくが つくったんだ！', { move: 'wander' }),
      A: say('snowman_maker', 'old_man', '*', 'ほっほっ ゆきだるまは\nわしの じまんの さくひん\nなのじゃ。\fこの むらでは ふゆは\nいちねんじゅう つづくのじゃよ。', { dir: 'up' }),
      M: say('woodcutter', 'dwarf', '*', 'まきを わって おかないと\nよるは こごえちまう。\fあんたたちも しっかり\nやどで あたたまって いきな。', { dir: 'down' }),
      V: say('gate_l', 'soldier', '*', 'ようこそ フロストの むらへ。\nさむかったろう。', { dir: 'right' }),
      X: say('gate_r', 'soldier', '*', 'ゆきの ふる よるは\nまものも おおくなる。\nきを つけて いくのだぞ。', { dir: 'left' }),
      '?': hidden('frost_h1', 'nectar', 'o'),
      '$': chest('frost_c1', 'healing_aroma', 2, '*'),
      '[': sign('たびびとの やどや'),
      '}': sign('フロストの むら\fひがしの はて\nひょうけつの どうくつ あり'),
    },
  };

  R.DB.maps.frost_house_elder = {
    name: 'フロストの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '############',
      '#kkk.u..b.$#',
      '#.......b..#',
      '#..htth....#',
      '#....E.....#',
      '#.........?#',
      '#oj...@..jo#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('frost_village', 'elder_house', 'D', 'down'),
      E: chat('elder', 'elder', '.', [
        { cond: GOLD, text: ['こがねの かぎを てにいれたか。', 'こがねの とびらは\nほくとうの しまの ほのおの かざんと\nひがしの たいりくの\nほしみの とうに ある。\fどちらにも もんしょうが\nまつられて おるはずじゃ。'] },
      ], ['よく きたな。 わしが むらおさじゃ。', 'こがねの かぎは むかし\nひょうけつの どうくつの おくへ\nふういん されたのじゃ。\fこおりの きょじんが\nいまも かぎを まもって おる。', 'どうくつは この むらの\nずっと ひがし。 ゆきの ふかい\nみちを すすむのじゃ。'], { dir: 'down' }),
      '$': chest('frost_elder_c1', 'thunder_bomb', 2),
      '?': hidden('frost_elder_h1', 'seed_int', 'p'),
    },
  };

  R.DB.maps.frost_house = {
    name: 'フロストの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '##########',
      '#b.b..u$.#',
      '#b.b.....#',
      '#........#',
      '#.tt..G..#',
      '#.hh.....#',
      '#o..@..jo#',
      '####>#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('frost_village', 'house', 'D', 'down'),
      G: say('explorer', 'old_man', '.', [
        'わしは むかし ぼうけんしゃ\nでな……。',
        'こおりの きょじんに やられた\nきずが いまでも いたむわい。\fあやつは ちからまかせの\nこうげきが おそろしい。\nナイトの 『かばいだて』で\nよわい なかまを まもるのじゃ。',
      ], { dir: 'down' }),
      '$': chest('frost_house_c1', 'fire_ring', 1),
    },
  };
})(window.RPG);
