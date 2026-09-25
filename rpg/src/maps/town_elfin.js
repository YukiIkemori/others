// 森の村エルフィン (forest island, Lv 11–15): elves living among great trees,
// the sacred spring (free full heal) with a stream running south through the
// village, a stone chapel, the forest inn, the general store, a flower garden,
// the elder's house and a weaver's cottage; hints toward the water cave.
// Map ids: elfin_village elfin_house_elder elfin_house
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'elf', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, n, under) => ({ chest: { id, item, n: n || 1 }, under: under || '.' });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const WATER = { item: 'crest_water' };

  // ================================================================ village
  // local: T tree  ~ stream/pond  = bridge  : path  f flowers  F fence
  //        B house wall  R roof  # chapel stone  _ boards  + carpet
  // decor: R.DB.legends.decor (src/data/tiles.js)
  R.DB.maps.elfin_village = {
    name: '森の村エルフィン', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'elfin', outside: 'T',
    exit: { to: 'world', spawn: 'elfin_village' },
    // @gen village
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTT,f,Y?,Y,f,TT###########TT',
      'TTTRRRRRRRRRRT,f~~~~~~~~f,T###########TT',
      'TTTRRRRRRRRRRTf~~~~~~~~~~fT#____O____#TT',
      'TTTRRRRRRRRRRTf~~~~~~~~~~fT#____a__J_#TT',
      'TTTBBBBB<BBBB,,f~!!~~!!~f,T#____+____#TT',
      'TTT,,,,,4,,,,,[,:,,~~,,,,,T#____+____#TT',
      'TTT,,,,,:,,,,,,,:,n~~,,M,,T#____+____#TT',
      'TT,,,,,,:,,,,,,,:,,~~,,,,,,#####D#####TT',
      'TT,::::::::::::::::==:::::::::::::::::TT',
      'TT,,,,,,,,,,,,TT:,,~~,TTTT,,,,,,,,,,,,TT',
      'TTBBBBBBBBBBBBTT:,,~~,,TTTBBBBBBBBBBBBTT',
      'TTBb_b_b_____BT,:,,~~,,TTTB_______uu_BTT',
      'TTBb_b_b_____B,,:,,~~,,,,,B_E__G__H__BTT',
      'TTB______N___B,,:,,~~,,,,,BccccccccccBTT',
      'TTB_I________B,,:,,~~,W,,,B__________BTT',
      'TTBccc_______B,,:,,~~,,y,,B___V______BTT',
      'TTB_________oB,,:,,~~,,,,,BBBBBBDBBBBBTT',
      'TTBBBBBBDBBBBB,,:,,~~,,,,,,,),,,:,,,,,TT',
      'TT,o,,,,:],,,,,,:,,~~,,,,,,,,,,,:,,,,,TT',
      'TT,::::::::::::::::==:::::::::::::::::TT',
      'TT,,,,,:,,,,w,,,:,,~~,TTTT,RRRRRRRRR:,TT',
      'TT,FFFF:FFFF,,,,:,,~~TTTTT,RRRRRRRRR:,TT',
      'TT,Fff:f:ffF,,,,:,,~~TTTTT,RRRRRRRRR:,TT',
      'TT,Fff:f:ffF,,,,:,,~~,,,,,,BBBB>BBBB:,TT',
      'TT,F:::A:::F,,,,:::==::::::::::5:::::,TT',
      'TT,Fff:f:ffF,,,,:,,~~,,,,,,,,,,,,,,TTTTT',
      'TT,Fff:f:ffF,,,,:,,~~,,,,,,Q,,,,,,,TTTTT',
      'TT,FFFFFFFFF,,,,:,,~~,,,,,~~~~~~~~,TTTTT',
      'TTTTTT,,,,,,,z,,:,,~~~~|~~~~~~~~~~,TTTTT',
      'TTTTTT,,,,,,,,,,:,,~~,,,,,~~~~~~~~,,,,TT',
      'TTTTTT,,,,Z,,,,(:,,~~,,,,,~~~~~~~~,$,,TT',
      'TTTTTT,,,,,,,,,,:,,~~TTTT,~~~~~~~~TTTTTT',
      'TTTTTTTTTTTT,,,,:,,~~TTTT,TTTTTTTTTTTTTT',
      'TTTTTTTTTTTT,,,,:,,~~TTTT,TTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTT@TT~~TTTTTTTTTTTTTTTTTTT',
    ],
    decor: [
      '........................................',
      '...............f.......f................',
      '..............h..........h...W.iti.W....',
      '............................Z.Q...Q.Z...',
      '............................v.......v...',
      '.............................ee...ee....',
      '...h111...11h................ee...ee....',
      '......3...3....1.......e.h..Z.......Z...',
      '...2222...222.h3.......11...............',
      '........................................',
      '...11.h....1113...........3h.....8..h3..',
      '....p.k..i.i................x..c...k....',
      '....y.y..C.FV..h.3.........X.XY.Y...U...',
      '..........rrr.l......l.l.h.O..v..q..q...',
      '.........nTn............e...............',
      '...q.......................Z..rrrr..Z...',
      '.......rrr..Z.1............q.......qU...',
      '...Z...rrr....1..e....1.1...............',
      '..............1......3...h..5.6...4.1...',
      '....111..7.................1......h..3..',
      '........................................',
      '...1.3...3.1............................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '........................................',
      '............U.q.........................',
      '............E...........................',
      '.......YXM..............................',
      '........................................',
      '...............3.3......................',
      '........................................',
      '........................................',
      '........................................',
    ],
    // @gen end
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('elder_house', 'down', ':'),
      '5': spawn('house', 'down', ':'),
      '<': warp('elfin_house_elder', 'entrance', 'D', 'up'),
      '>': warp('elfin_house', 'entrance', 'D', 'up'),
      // the sacred spring: examine the water from its south shore
      '!': { event: { id: 'elfin_spring', trigger: 'examine' }, under: '~' },
      '[': sign('聖なる泉\f泉の恵みに感謝を。'),
      n: say('spring_elf', 'elf', ',', '聖なる泉の水は、\n疲れた体を\n癒やしてくれるわ。\f泉のほとりで、\n水を調べてごらんなさい。', { dir: 'down' }),
      '?': chest('elfin_h1', 'seed_mnd', 1, ','), // formerly hidden in a tree; now a visible chest
      M: say('stream_elf', 'elf', ',', 'ようこそ、エルフィンへ。\n人間が来るのは\n久しぶりね。', { move: 'wander' }),
      // chapel
      O: npc('priestess', 'elf', '_', { event: 'church', greet: '森の神のご加護を……。', dir: 'down' }),
      J: say('acolyte', 'elf', '_', '神の光は、エルフにも\n人間にも、等しく\n降りそそぐのです。', { dir: 'left' }),
      // inn
      I: npc('innkeeper', 'elf', '_', { event: 'inn', price: 24, dir: 'down' }),
      N: say('inn_guest', 'man', '_', '船で旅をするなら、\n覚えておくといい。\f『ワープ』や『旅鳥の羽』で\n港のある町へ飛べば、\n船もちゃんと\nついてくるんだ。', { dir: 'right' }),
      // general store
      E: shop('weapon', '_', 'elfin_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'elfin_armor', { dir: 'down' }),
      H: shop('item', '_', 'elfin_item', { dir: 'down' }),
      V: say('customer', 'woman', '_', '薬師のジョブは、\n道具の効果を\n高められるそうよ。\f魔法使いと盗賊を\n鍛えるとなれるんですって。', { dir: 'up' }),
      // garden, green, south
      A: say('gardener', 'elf', ':', '花たちが歌っているわ。\fあなたたちの中に、\n強い光が見える……。', { dir: 'down' }),
      Q: chat('lake_elf', 'elf', ',', [
        { cond: 'game_clear', text: '森の木々も、\n喜びの歌を\n歌っているわ。' },
        { cond: WATER, text: '水の紋章を\n取り戻したのね！\f大海蛇を倒すなんて、\nすごいわ！' },
      ], ['南東の湖のほとりに、\n水の洞窟があるの。', '奥には水の紋章が\n祀られているけど……\n今は大きな海蛇が\n住みついているそうよ。'], { dir: 'down' }),
      Z: say('elf_warrior', 'elf', ',', '海蛇のたぐいは、\n雷が苦手だというぞ。\fこの村の武器屋には、\n雷の槍もあるからな。', { dir: 'down' }),
      z: chat('trader', 'dwarf', ',', [
        { cond: WATER, text: '次は南西の砂漠か？\fサルバの町のそばの\nピラミッドには、\n銀の扉がたくさん\nあるそうだぞ。' },
      ], 'わしは旅の商人。\f南西の砂漠にある\nサルバの町では、\n珍しい武器が手に入るぞ。', { dir: 'down' }),
      y: say('elf_child', 'girl', ',', '人間って、耳が\n短いんだね！\nふしぎー！', { move: 'wander' }),
      w: say('elf_boy', 'boy', ',', '鋼ゼリーって知ってる？\fかたくて、攻撃が\nほとんど効かないんだ。\fでも、手数で押せば\n倒せることもあるよ！\n経験値がすごいんだって！', { move: 'wander' }),
      '$': chest('elfin_c1', 'wake_brooch', 1, ','),
      // signs
      '(': sign('森の村エルフィン\f北に聖なる泉あり。\n泉の水は、旅の疲れを\n癒やしてくれる。'),
      ']': sign('森の宿屋', ','),
      ')': sign('エルフィンのよろず屋\n武器・防具・道具', ','),
    },
  };

  // ================================================================ elder's house
  R.DB.maps.elfin_house_elder = {
    name: '森の村エルフィン', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
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
        { cond: WATER, text: ['水の紋章は、\nそなたたちに託そう。', '次は砂漠の町サルバを\n訪ねるとよい。\n大地の紋章のありかを\n知る者がいるはずじゃ。'] },
      ], ['わしがこの村の長じゃ。', '水の紋章は昔から、\nわれらエルフが\n守ってきた。', 'だが今は、洞窟に\n魔物が巣くっておる。\fたのむ。紋章を\n守ってくだされ。'], { dir: 'down' }),
      y: say('grandchild', 'girl', '.', 'おじいちゃんは300歳なの。\nでも、エルフの中では\nまだ若いほうなんだって。', { move: 'wander' }),
      '$': chest('elfin_elder_c1', 'healing_aroma', 1),
      '?': chest('elfin_elder_h1', 'all_cure', 1), // formerly hidden in a pot; now a visible chest
    },
  };

  // ================================================================ weaver's house
  R.DB.maps.elfin_house = {
    name: '森の村エルフィン', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
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
        'この村の布は、\n森の糸で織るのよ。',
        '盗賊の『レアハンター』を\nつけて魔物を倒すと、\n珍しい物が出やすいの。\fわたしも昔は、\nよくためしたものよ。',
      ], { dir: 'down' }),
    },
  };
})(window.RPG);
