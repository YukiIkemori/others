// ミルトの村 (north of Regnas, Lv 2–5) with two house interiors, and the
// east gate (東の関所) that opens once the party shows the wind crest.
// Map ids: milt_village milt_house_chief milt_house east_gate
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const hidden = (id, item, under) => ({ hidden: { id, item }, under });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const WIND = { item: 'crest_wind' };

  // ================================================================ Milt
  R.DB.maps.milt_village = {
    name: 'ミルトの むら', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'milt', outside: 'T',
    exit: { to: 'world', spawn: 'milt_village' },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,TT',
      'TT' + 'BBBBBBBBB' + ',,,' + 'RRRRRRRR' + ',,' + ',,,,,,,,,,' + 'TT',
      'TT' + 'B_Y_O_Y_B' + ',f,' + 'RRRRRRRR' + ',,' + ',,~~~~~~,,' + 'TT',
      'TT' + 'B___a___B' + ',,,' + 'BBB<BBBB' + ',,' + ',~~~~~~~~,' + 'TT',
      'TT' + 'B___+___B' + ',,,' + ',,,4,,,,' + ',Q' + ',~~~~~~~~,' + 'TT',
      'TT' + 'Bhh_+_hhB' + ',,,' + ',,,:,,,,' + ',,' + ',,~~~~~~A,' + 'TT',
      'TT' + 'B___+__JB' + ',f,' + ',,,:,,,,' + ',,' + ',,,,,,,,,,' + 'TT',
      'TT' + 'BBBBDBBBB' + ',,,' + ',,,:,,,,' + ',,' + ',,,f,,f,,,' + 'TT',
      'TT' + '::::::::::::::n:::::::::::::::::' + 'TT',
      'TT' + 'BBBBBBBBBBB' + ',,,,,,,,,' + 'BBBBBBBBBBBB' + 'TT',
      'TT' + 'Bb_b_b_b__B' + ',,f,,,f,,' + 'Buuu_uuu_uuB' + 'TT',
      'TT' + 'Bb_b_b_b__B' + ',,,,,,,,,' + 'B_E__G___H_B' + 'TT',
      'TT' + 'B_________B' + ',,,,!,,,,' + 'BccccccccccB' + 'TT',
      'TT' + 'B_______I_B' + ',,,,,,,,,' + 'B__________B' + 'TT',
      'TT' + 'B______cccB' + ',,M,,,,,,' + 'B_____N____B' + 'TT',
      'TT' + 'B_V_______B' + ',,,,,,,,,' + 'Bjo______?jB' + 'TT',
      'TT' + 'BBBBDBBBBBB' + ',,,,,,,,,' + 'BBBBBDDBBBBB' + 'TT',
      'TT' + '::::::::::::::::::::::::::::::::' + 'TT',
      'TT' + ',,,[,,,,,,,,,,,::,,,,,,,],,,,,,,' + 'TT',
      'TT' + 'FFFFFFFFFFFFF' + ',,' + '::' + ',,' + 'RRRRRR' + ',,' + 'RRRRR' + 'TT',
      'TT' + 'FfffffffffffF' + ',,' + '::' + ',,' + 'RRRRRR' + ',,' + 'RRRRR' + 'TT',
      'TT' + 'F:::::::::::F' + ',,' + '::' + ',,' + 'BB>BBB' + ',,' + 'BBBBB' + 'TT',
      'TT' + 'FfffffffffffF' + ',,' + '::' + ',,' + ',,5,,,' + ',,' + ',o,j,' + 'TT',
      'TT' + 'F:::::::::::F' + ',,' + '::' + ',,,,,,,,,,,,,,,' + 'TT',
      'TT' + 'FfffffZfffffF' + ',,' + '::' + ',,' + 'FFFFFFF' + ',,,,,,' + 'TT',
      'TT' + 'FFFFFF,FFFFFF' + ',,' + '::' + ',,' + 'F,v,,,F' + ',,,y,,' + 'TT',
      'TT' + ',,,,,,,,,,,,,' + ',,' + '::' + ',,' + 'FFF,FFF' + ',,,,,,' + 'TT',
      'TT' + ',,,,,w,,,,,,,' + ',}' + '::' + ',,' + ',,,,,,,,,,,,,' + 'TT',
      'TTTTTTTTTTTTTTTTT' + '@:' + 'TTTTTTTTTTTTTTTTT',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('chief_house', 'down', ':'),
      '5': spawn('house', 'down', ','),
      '<': warp('milt_house_chief', 'entrance', 'D', 'up'),
      '>': warp('milt_house', 'entrance', 'D', 'up'),
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', 'ちいさな きょうかいですが\nかみの ごかごは\nどこでも おなじですよ。', { dir: 'left' }),
      E: shop('weapon', '_', 'milt_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'milt_armor', { dir: 'down' }),
      H: shop('item', '_', 'milt_item', { dir: 'down' }),
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 8, dir: 'down' }),
      V: say('inn_guest', 'man', '_', 'この むらの やどは やすくて\nごはんも うまい。\fたびの つかれを とるなら\nやっぱり ミルトだな。', { dir: 'up' }),
      N: say('customer', 'woman', '_', 'ここは むらで ただ ひとつの\nよろずや。\fぶきも ぼうぐも どうぐも\nぜんぶ そろって いるのよ。', { dir: 'down' }),
      M: chat('plaza_old', 'old_man', ',', [
        { cond: 'game_clear', text: 'せかいに へいわが\nもどったんじゃなあ……。\nながいきは するもんじゃ。' },
        { cond: WIND, text: 'ゴブリンの おやぶんを\nこらしめて くれたそうじゃな！\nこれで はたけも あんしんじゃ。' },
      ], ['この むらの にし\nやまの ふもとに\nかぜの どうくつが ある。', 'ちかごろ ゴブリンどもが すみついて\nむらの はたけを\nあらしに くるんじゃ。'], { dir: 'down' }),
      Q: say('pond_woman', 'woman', ',', 'この いけの みずは\nとっても きれいなの。\nむらの じまんよ。', { dir: 'right' }),
      A: say('pond_boy', 'boy', ',', 'ぼく しってるよ！\fとうぞくの 『たからさがし』を\nセットすると かくれた どうぐが\nひかって みえるんだって！', { dir: 'down' }),
      n: chat('hunter', 'man', ':', [
        { cond: 'gate_open', text: 'せきしょが ひらいたって？\nむこうの まものは つよいぞ。\nそうびを ととのえて いけよ。' },
        { cond: WIND, text: 'かぜの もんしょうが あれば\nひがしの せきしょを\nとおして もらえるはずさ。\fせきしょは レグナスの\nしろの ひがしだ。' },
      ], ['おれは かりゅうどさ。', 'ゴブリンの おやぶんは\nてしたを ぞろぞろ つれてるらしい。\fまとめて たたける わざが\nあると らくだぜ。'], { move: 'wander' }),
      Z: say('farmer', 'old_man', 'f', 'よう きたのう。\fゴブリンの やつら\nはたけの やさいを\nごっそり もって いきおった。\fまったく こまったもんじゃ。', { dir: 'down' }),
      v: say('dog', 'dog', ',', 'ワン！ ワン！', { move: 'wander' }),
      y: say('girl', 'girl', ',', 'たたかいに まけて ぜんめつ\nしちゃっても けいけんちは\nへらないんだって。\fでも おかねは はんぶんに\nなっちゃうから きを つけてね！', { move: 'wander' }),
      w: say('boy', 'boy', ',', 'にげるのも だいじなんだよ！\nにげるのに しっぱいしても\nなんども ためせば\nだんだん にげやすく なるんだ。', { move: 'wander' }),
      '!': hidden('milt_h1', 'seed_hp', 'W'),
      '?': hidden('milt_h2', 'smelling_salts', 'o'),
      '[': sign('たびびとの やどや'),
      ']': sign('よろずや\nぶき ぼうぐ どうぐ なんでも そろう！'),
      '}': sign('ミルトの むら\fにしの やまの ふもと\nかぜの どうくつ あり\nまもの ちゅうい'),
    },
  };

  R.DB.maps.milt_house_chief = {
    name: 'ミルトの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '############',
      '#kkk.u..b.b#',
      '#.......b.b#',
      '#..htth....#',
      '#...E......#',
      '#.........$#',
      '#po...@..jo#',
      '######<#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('milt_village', 'chief_house', 'D', 'down'),
      E: chat('chief', 'elder', '.', [
        { cond: 'gate_open', text: 'せきしょを こえて いくのか。\nポルタは うみの まち。\nにぎやかな ところじゃよ。' },
        { cond: WIND, text: 'おお かぜの もんしょう！\nそなたたちが ゴブリンを\nこらしめて くれたのか。\fむらを すくって くれた れいじゃ。\nそこの たからばこの ものを\nもって いくが よい。' },
      ], ['わしが ミルトの むらおさじゃ。', 'かぜの どうくつは むらの にし。\nおくには かぜの もんしょうが\nまつられて おったが……\fいまは ゴブリンの おやぶんが\nいすわって おるそうじゃ。'], { dir: 'down' }),
      '$': { chest: { id: 'milt_chief_c1', item: 'iron_helm', n: 1, cond: WIND }, under: '.' },
    },
  };

  R.DB.maps.milt_house = {
    name: 'ミルトの むら', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '##########',
      '#u.b.b..k#',
      '#..b.b...#',
      '#.......p#',
      '#.tt..G..#',
      '#.hh.....#',
      '#o..@...?#',
      '####>#####',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('milt_village', 'house', 'D', 'down'),
      G: say('grandma', 'old_woman', '.', [
        'まあまあ よく きたね。\fたからばこの なかみは\nいちど あけたら それっきり。\nのこさず あけて おいきよ。',
        'それと まものが おとす\nめずらしい どうぐ……\nレアドロップって いうのかい？\fとうぞくの 『レアハンター』を\nつけると でやすく なるそうだよ。',
      ], { dir: 'down' }),
      '?': hidden('milt_house_h1', 'herb', 'p'),
    },
  };

  // ================================================================ east gate
  // A walled pass through the mountains. The soldier blocks the road until the
  // party holds crest_wind, then steps aside into the guard niche (flag gate_open).
  R.DB.maps.east_gate = {
    name: 'ひがしの せきしょ', type: 'castle', legend: 'local', theme: 'fort', bgm: 'castle',
    outside: 'r',
    rows: [
      'rrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrr###########rrrrrr',
      'rrrrrrr#b.b#u.N.u#rrrrrr',
      'rrrrrrr#.V.#.....#rrrrrr',
      'rrrrrrr##D####D###rrrrrr',
      'rrrrrrr#...###...#rrrrrr',
      ',,,,,,,#.o.#.#.j.#,,,,,,',
      '<:::::@D....G....D0::::>',
      ',,,,,,,#...###...#,,,,,,',
      'rrrrrrr#.j.###.U.#rrrrrr',
      'rrrrrrr##i#####i##rrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrr',
    ],
    spawns: { entrance: { x: 6, y: 7, dir: 'right' } },
    marks: {
      '@': spawn('west', 'right', ':'),
      '0': spawn('east', 'left', ':'),
      '<': warp('world', 'east_gate_w', ':', 'left'),
      '>': warp('world', 'east_gate_e', ':', 'right'),
      G: npc('gate_soldier', 'soldier', '.', { event: 'gate_soldier', dir: 'left', cond: '!gate_open' }),
      V: say('resting', 'soldier', '.', 'やすみの ひは ねるに かぎる……。\fむにゃ…… まものなんか\nこわく ないぞ……。', { dir: 'down' }),
      N: say('captain', 'knight', '.', 'わしが せきしょの たいちょうだ。\fひがしの ちには レグナスより\nつよい まものが でる。\nこころして いくのだぞ。', { dir: 'down' }),
      U: say('guard_s', 'soldier', '.', 'この せきしょは むかしから\nレグナスを まもって きたのだ。', { dir: 'up' }),
    },
  };
  // the soldier's post once the gate is open (same tile he walks to)
  R.DB.maps.east_gate.npcs = [
    { id: 'gate_soldier_aside', x: 12, y: 6, sprite: 'npc:soldier', dir: 'down', event: 'gate_soldier', cond: 'gate_open' },
  ];
})(window.RPG);
