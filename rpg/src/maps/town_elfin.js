// 森の村エルフィン (forest island, Lv 11–15): elves, the sacred spring (free
// full heal), a stream with bridges; hints toward the water cave.
// Map ids: elfin_village elfin_house_elder elfin_house
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'elf', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const hidden = (id, item, under) => ({ hidden: { id, item }, under });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const WATER = { item: 'crest_water' };

  R.DB.maps.elfin_village = {
    name: 'エルフィンの むら', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'elfin', outside: 'T',
    exit: { to: 'world', spawn: 'elfin_village' },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTT,,,,,,,,,,TTTTTTTTTTTTTT',
      'TTTTTTTTTTTT,,f,~~~~~~,f,,TTTTTTTTTTTT',
      'TTTTTTTTTTT,,,,~~~~~~~~,,,,TTTTTTTTTTT',
      'TTTTTTTTTTT,,f,~~~~~~~~,f,,TTTTTTTTTTT',
      'TTTTTTTTTTTT,,,,~!!~~~,,,,TTTTTTTTTTTT',
      'TTTTTTTTTTTT,,,[,n,~~,,,,,TTTTTTTTTTTT',
      'TT,,,,,,,,,,,,,,,,,~~,,,,,,,,,,,,,,,TT',
      'TT' + 'BBBBBBBBB' + ',,,,,,M,' + '~~' + ',,,' + 'RRRRRRRR' + ',,,,' + 'TT',
      'TT' + 'B_Y_O_Y_B' + ',,,,,,,,' + '~~' + ',,,' + 'RRRRRRRR' + ',,,,' + 'TT',
      'TT' + 'B___a___B' + ',,,,,,,,' + '~~' + ',,,' + 'BBB<BBBB' + ',,,,' + 'TT',
      'TT' + 'B___+___B' + ',,,,,,,,' + '~~' + ',z,' + ',,,4,,,,' + ',,,,' + 'TT',
      'TT' + 'Bhh_+_hhB' + '::::::::' + '==' + ':::::::::::::::' + 'TT',
      'TT' + 'B___+__JB' + ',,,,,,,,' + '~~' + ',,' + 'FFFFFFFFFFFF' + ',' + 'TT',
      'TT' + 'BBBBDBBBB' + ',,,,,,,,' + '~~' + ',,' + 'Ffffff,ffffF' + ',' + 'TT',
      'TT' + ',,,,:,,,,' + ',,,,,,,,' + '~~' + ',,' + 'Fff,,A,,fffF' + ',' + 'TT',
      'TT' + ',,,,:,,,,' + ',,,,,,,,' + '~~' + ',,' + 'Ffffff,ffffF' + ',' + 'TT',
      'TT' + ':::::::::::::::::' + '~~' + ',,' + 'FFFFF,,FFFFF' + ',' + 'TT',
      'TT' + 'BBBBBBBBBBB' + ',,,,,,' + '~~' + ',,,,,,,,,,,,,,,' + 'TT',
      'TT' + 'Bb_b_b_b__B' + ',Z,,,,' + '~~' + ',' + 'RRRRRR' + ',,' + 'RRRRRR' + 'TT',
      'TT' + 'Bb_b_b_b__B' + ',,,,,,' + '~~' + ',' + 'RRRRRR' + ',,' + 'RRRRRR' + 'TT',
      'TT' + 'B_________B' + ',,,,,,' + '~~' + ',' + 'BB>BBB' + ',,' + 'BBBBBB' + 'TT',
      'TT' + 'B______I__B' + ',,,,,,' + '~~' + ',' + ',,5,,,' + ',,' + ',f,,f,' + 'TT',
      'TT' + 'B_____ccc_B' + ',,,,,,' + '~~' + ',' + ',,:,,Q' + ',,' + ',,,,,,' + 'TT',
      'TT' + 'B_N_______B' + ',,,,,,' + '~~' + ',' + ',,:,,,' + ',,' + ',,w,,,' + 'TT',
      'TT' + 'BBBBBDBBBBB' + ',,,,,,' + '~~' + ',' + ',,:,,,' + ',,' + ',,,,,,' + 'TT',
      'TT' + ':::::::::::::::::' + '==' + ':::::::::::::::' + 'TT',
      'TT' + 'BBBBBBDBBBBBB' + ',:,,' + '~~' + ',,,,,,,,,,,,,,,' + 'TT',
      'TT' + 'B__________VB' + ',:,,' + '~~' + ',TT,,,,,f,,,TT,' + 'TT',
      'TT' + 'B___________B' + ',:,,' + '~~' + ',TT$,,,,,,,TT?,' + 'TT',
      'TT' + 'BcccccccccccB' + ',:,,' + '~~' + ',,,,,,y,,,,,,,,' + 'TT',
      'TT' + 'B_E__G___H__B' + ',:,,' + '~~' + ',,,,f,,,,,f,,,,' + 'TT',
      'TT' + 'Buuu_uuu_uuuB' + ',:,,' + '~~' + ',,T,,,,,,,,,T,,' + 'TT',
      'TT' + 'BBBBBBBBBBBBB' + ',:,,' + '~~' + ',TTT,,,,,,,TTT,' + 'TT',
      'TTTTTTTTTTTTTTTT' + '@' + 'TT' + '~~' + 'TTTTTTTTTTTTTTTTT',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('elder_house', 'down', ':'),
      '5': spawn('house', 'down', ','),
      '<': warp('elfin_house_elder', 'entrance', 'D', 'up'),
      '>': warp('elfin_house', 'entrance', 'D', 'up'),
      '!': { event: { id: 'elfin_spring', trigger: 'examine' }, under: '~' },
      O: npc('priestess', 'elf', '_', { event: 'church', greet: 'もりの かみの ごかごを……。', dir: 'down' }),
      J: say('acolyte', 'elf', '_', 'かみの ひかりは\nエルフにも にんげんにも\nひとしく ふりそそぐのです。', { dir: 'left' }),
      I: npc('innkeeper', 'elf', '_', { event: 'inn', price: 24, dir: 'down' }),
      N: say('inn_guest', 'man', '_', 'ふねで たびを するなら\nおぼえて おくと いい。\f『ワープ』や 『たびどりのはね』で\nみなとの ある まちへ とべば\nふねも ちゃんと ついて くるんだ。', { dir: 'down' }),
      E: shop('weapon', '_', 'elfin_weapon', { dir: 'up' }),
      G: shop('armor', '_', 'elfin_armor', { dir: 'up' }),
      H: shop('item', '_', 'elfin_item', { dir: 'up' }),
      V: say('customer', 'woman', '_', 'くすりしの ジョブは どうぐの\nこうかを たかめられるそうよ。\fまほうつかいと とうぞくを\nきたえると なれるんですって。', { dir: 'down' }),
      M: say('stream_elf', 'elf', ',', 'ようこそ エルフィンへ。\nにんげんが くるのは\nひさしぶりね。', { move: 'wander' }),
      n: say('spring_elf', 'elf', ',', 'せいなる いずみの みずは\nつかれた からだを\nいやして くれるわ。\fいずみの まえで\nAボタンを おして ごらんなさい。', { dir: 'down' }),
      Q: chat('lake_elf', 'elf', ',', [
        { cond: 'game_clear', text: 'もりの きたちも\nよろこびの うたを\nうたって いるわ。' },
        { cond: WATER, text: 'みずの もんしょうを\nとりもどしたのね！\nうみへびの ぬしを たおすなんて\nすごいわ！' },
      ], ['なんとうの みずうみの ほとりに\nみずの どうくつが あるの。', 'おくには みずの もんしょうが\nまつられて いるけど……\nいまは おおきな うみへびが\nすみついて いるそうよ。'], { dir: 'left' }),
      Z: say('elf_warrior', 'elf', ',', 'うみへびの たぐいは\nかみなりが にがて だと いうぞ。\fこの むらの ぶきやには\nいかずちの やりも あるからな。', { dir: 'down' }),
      z: chat('trader', 'dwarf', ',', [
        { cond: WATER, text: 'つぎは なんせいの さばくか？\nサルバの まちの そばの\nピラミッドには ぎんの とびらが\nたくさん あるそうだぞ。' },
      ], 'わしは たびの あきんど。\fなんせいの さばくに ある\nサルバの まちでは\nめずらしい ぶきが てに はいるぞ。', { dir: 'down' }),
      A: say('gardener', 'elf', ',', 'はなたちが うたって いるわ。\fあなたたちの なかに\nつよい ひかりが みえる……。', { dir: 'down' }),
      y: say('elf_child', 'girl', ',', 'にんげんって みみが\nみじかいんだね！\nふしぎー！', { move: 'wander' }),
      w: say('elf_boy', 'boy', ',', 'はがねゼリーって しってる？\fかたくて こうげきが\nほとんど きかないんだ。\fでも てかずで おせば\nたおせることも あるよ！\nけいけんちが すごいんだって！', { move: 'wander' }),
      '?': hidden('elfin_h1', 'seed_mnd', 'T'),
      '$': chest('elfin_c1', 'wake_brooch', 1, ','),
      '[': sign('せいなる いずみ\fいずみの めぐみに かんしゃを。'),
    },
  };

  R.DB.maps.elfin_house_elder = {
    name: 'エルフィンの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '############',
      '#kkkk.u.pp$#',
      '#..........#',
      '#.o..E...b.#',
      '#........b.#',
      '#.tt.....?.#',
      '#.hh..y..p.#',
      '#o....@...j#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('elfin_village', 'elder_house', 'D', 'down'),
      E: chat('elder', 'elder', '.', [
        { cond: WATER, text: ['みずの もんしょうは\nそなたたちに たくそう。', 'つぎは さばくの まち サルバを\nたずねると よい。\nだいちの もんしょうの ありかを\nしる ものが いるはずじゃ。'] },
      ], ['わしは この むらの おさ。', 'みずの もんしょうは むかしより\nわれら エルフが まもって きた。', 'だが いまは どうくつに\nまものが すくって おる。\fたのむ。 もんしょうを\nまもって くれ。'], { dir: 'down' }),
      y: say('grandchild', 'girl', '.', 'おじいちゃんは 300さい なの。\nでも エルフでは まだ\nわかい ほうなんだって。', { move: 'wander' }),
      '$': chest('elfin_elder_c1', 'healing_aroma', 1),
      '?': hidden('elfin_elder_h1', 'all_cure', 'p'),
    },
  };

  R.DB.maps.elfin_house = {
    name: 'エルフィンの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '##########',
      '#b.b..kk.#',
      '#b.b.....#',
      '#....G...#',
      '#.tt...p.#',
      '#.hh.....#',
      '#o..@..jo#',
      '####>#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('elfin_village', 'house', 'D', 'down'),
      G: say('weaver', 'elf', '.', [
        'この むらの ぬのは\nもりの いとで おるのよ。',
        'レアハンターを つけて\nまものを たおすと\nめずらしい ものが でやすいの。\fわたしも むかしは\nよく ためした ものよ。',
      ], { dir: 'down' }),
    },
  };
})(window.RPG);
