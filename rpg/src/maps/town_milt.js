// ミルトの村 (north-east of Regnas, Lv 2–5): a farming village on a stream
// that runs from the pond past the church, the inn and the general store,
// with two house interiors; and 東の関所, the walled pass that opens once
// the party shows the wind crest.
// Map ids: milt_village milt_house_chief milt_house east_gate
(function (R) {
  'use strict';
  const npc = (id, sprite, under, o) => ({ npc: Object.assign({ id, sprite: 'npc:' + sprite }, o), under });
  const say = (id, sprite, under, text, o) => npc(id, sprite, under, Object.assign({ text }, o));
  const chat = (id, sprite, under, talk, text, o) => npc(id, sprite, under, Object.assign({ event: 'chat', talk, text }, o));
  const shop = (id, under, shopId, o) => npc(id, 'merchant', under, Object.assign({ event: 'shop', shop: shopId }, o));
  const sign = (text, under) => ({ sign: { text }, under: under || 'm' });
  const chest = (id, item, under, o) => ({ chest: Object.assign({ id, item, n: 1 }, o), under: under || '.' });
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const WIND = { item: 'crest_wind' };

  // ================================================================ Milt
  // local: # stone  B plaster/timber  R roof  _ boards  + carpet  ~ stream  = bridge
  // decor: see R.DB.legends.decor (src/data/tiles.js)
  R.DB.maps.milt_village = {
    name: 'ミルトの村', type: 'town', legend: 'local', theme: 'town', bgm: 'village',
    location: 'milt', outside: 'T',
    exit: { to: 'world', spawn: 'milt_village' },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT###########T,,,,,,,!,,T,,,,,,,,,,TTT',
      'TT###########T,RRRRRRRR,,,,,,~~~~~,,TT',
      'TT#____O__J_#,,RRRRRRRR,,,,,~~~~~~~,TT',
      'TT#____a____#,,RRRRRRRRT,,,~~~~~~~~,TT',
      'TT#____+____#,,BBB<BBBB,,,,~~~~~~~~,TT',
      'TT#____+____#,,,,,4:,,,,T,~~~~~~~~,fTT',
      'TT#____+____#,,,,,::,,,ff~~~~~Q,,A,,TT',
      'TT#####D#####,,,,,::,,,,,~~,,,,,,,,,TT',
      'TT,fff,:,,,,,,,,,,::,,,,,~~,,,,,,,,,TT',
      'TT:::::::::::::::::::::::==:::::::::TT',
      'TTBBBBBBBBBBBBo.z......,,~~BBBBBBBBBTT',
      'TTBBBBBBBBBBBBj....n...,,~~BBBBBBBBBTT',
      'TTBb_b_b__uI_B,........T,~~Bu_u_uujBTT',
      'TTBb_b_b__cccBT......M.,,~~B_E_G_H_BTT',
      'TTB______U___B,..XW....,,~~BcccccccBTT',
      'TTB_V________B,........,,~~B_______BTT',
      'TTB_________oBT.......oT,~~B__N____BTT',
      'TTB_________oB,......(.,,~~Bo_____?BTT',
      'TTBBBBBBDBBBBB,........,,~~BBBBDBBBBTT',
      'TT,,,,,,:[,,,,,........,,~~,,,,:],,,TT',
      'TT:::::::::::::::::::::::==:::::::::TT',
      'TT,,,,,,:,,,,,,,,,::,T,,T~~,RRRRRRR,TT',
      'TT,FFFFF:FFFFF,,,,::,,T,,~~,RRRRRRR,TT',
      'TT,F:::::::::F,,,,::,,,,,~~,BB>BBBB,TT',
      'TT,F::::Z::::F,,,,:::::::==:::5,,oj,TT',
      'TT,F:::::::::Ff,,,::,,,,,~~FF,FFFFFFTT',
      'TT,F:::::::::F,,,,::,,,,,~~F,,,,,,,FTT',
      'TT,F:::::::::F,,y,::,,,,,~~F,,,v,,,FTT',
      'TT,FFFFFFFFFFF,,,,::,wWT,~~F,,,,,,,FTT',
      'TT,,,,,,,,,,,,,ff}::,,,,,~~FFFFFFFFFTT',
      'TTTTTTTTTTTTTTTTTT@:TTTTT~~TTTTTTTTTTT',
    ],
    decor: [
      '......................................',
      '......................................',
      '....W.ici.W................h.......h..',
      '...Z.QdddQ.Z..........................',
      '...v.......v..........................',
      '....ee...ee...........................',
      '....ee...ee....h11..11h...............',
      '...............222..222...............',
      '.................3..3...........e.e...',
      '......8..11...........................',
      '......................................',
      '......................3...............',
      '...p..k..i.....999....E.......x..k....',
      '....y.y.ZF..V................X.Y......',
      '.................1.1..................',
      '........rr...........ee...............',
      '....nTn..........1.1........Z.....q...',
      '........nTn....U......................',
      '...Z.......q..........q..........U....',
      '...............11....11...............',
      '.........7.....3......3.......5.4.....',
      '......................................',
      '......................................',
      '..M...........h223..3.................',
      '..M.fffffffff.........................',
      '..............1..1....................',
      '....fffffffff..J......................',
      '..............1..1..UUq.M.............',
      '....fffffffff....................M....',
      '..............e.....h.......E.....M...',
      '....................3.................',
      '......................................',
    ],
    marks: {
      '@': spawn('entrance', 'up', ':'),
      '4': spawn('chief_house', 'down', ':'),
      '5': spawn('house', 'down', ':'),
      '<': warp('milt_house_chief', 'entrance', 'D', 'up'),
      '>': warp('milt_house', 'entrance', 'D', 'up'),
      // church
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: say('nun', 'nun', '_', '小さな教会ですが、\n神のご加護は\nどこでも同じですよ。', { dir: 'down' }),
      // inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 8, dir: 'left' }),
      V: say('inn_guest', 'man', '_', 'この村の宿は安いし、\n飯もうまい。\f旅の疲れを取るなら、\nやっぱりミルトだな。', { dir: 'right' }),
      U: say('inn_cat', 'cat', '_', 'ニャーン。\n暖炉の前で丸くなっている。', { move: 'wander' }),
      // general store
      E: shop('weapon', '_', 'milt_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'milt_armor', { dir: 'down' }),
      H: shop('item', '_', 'milt_item', { dir: 'down' }),
      N: say('customer', 'woman', '_', 'ここは村でたったひとつの\nよろず屋。\f武器も防具も道具も、\n全部そろっているのよ。', { dir: 'up' }),
      // plaza, pond, farm
      M: chat('plaza_old', 'old_man', '.', [
        { cond: 'game_clear', text: '世界に平和が\n戻ったんじゃなあ……。\n長生きはするもんじゃ。' },
        { cond: WIND, text: 'ゴブリンの親分を\n懲らしめてくれたそうじゃな！\nこれで畑も安心じゃ。' },
      ], ['この村の北西、\n山のふもとに\n風の洞窟があるんじゃ。', '近ごろゴブリンどもが住みついて、\n村の畑を\n荒らしに来るんじゃよ。'], { dir: 'down' }),
      z: chat('vendor', 'woman', '.', [
        { cond: WIND, text: '畑が元どおりになって、\n野菜をたくさん\n並べられるようになったわ。\fありがとうね、旅の人！' },
      ], 'とれたての野菜はいかが？\f……と言いたいところだけど、\nゴブリンに畑を荒らされて、\n今日はこれっぽっちなのよ。', { dir: 'down' }),
      X: say('well_woman', 'woman', '.', 'この井戸の水は、\n冷たくておいしいのよ。\f旅に出るなら、薬草は\n多めに持っていきなさいな。', { dir: 'right' }),
      Q: say('pond_woman', 'woman', ',', 'この池の水は、\nとってもきれいなの。\f池から流れる小川が、\n村の畑をうるおしているのよ。', { dir: 'up' }),
      A: say('pond_boy', 'boy', ',', 'ぼく、知ってるよ！\f盗賊の『目利き』をセットすると、\n魔物が落とす道具や\nゴールドが増えるんだって！', { dir: 'down' }),
      n: chat('hunter', 'man', '.', [
        { cond: 'gate_open', text: '関所が開いたって？\n向こうの魔物は強いぞ。\n装備を整えてから行けよ。' },
        { cond: WIND, text: '風の紋章があれば、\n東の関所を\n通してもらえるはずさ。\f関所はレグナス城の東だ。' },
      ], ['おれは狩人さ。', 'ゴブリンの親分は、\n手下をぞろぞろ連れてるらしい。\fまとめて攻撃できる技が\nあると楽だぜ。'], { move: 'wander' }),
      Z: chat('farmer', 'old_man', ':', [
        { cond: WIND, text: 'ゴブリンどもが来なくなって、\n畑仕事がはかどるわい。\f秋には、うまい野菜を\nたんと食わせてやるぞ。' },
      ], 'よう来たのう。\fゴブリンのやつら、\n畑の野菜を\nごっそり持っていきおった。\fまったく困ったもんじゃ。', { dir: 'down' }),
      v: say('dog', 'dog', ',', 'ワン！　ワン！', { move: 'wander' }),
      y: say('girl', 'girl', ',', '戦いに負けて全滅しても、\n経験値は減らないんだって。\fでも、持っているゴールドは\n半分になっちゃうから、\n気をつけてね！', { move: 'wander' }),
      w: say('boy', 'boy', ',', '逃げるのも大事なんだよ！\f逃げるのに失敗しても、\n何度もためせば、\nだんだん逃げやすくなるんだ。', { move: 'wander' }),
      // treasure (formerly hidden; now visible chests)
      '!': chest('milt_h1', 'seed_hp', ','),
      '?': chest('milt_h2', 'smelling_salts', '_'),
      // signs
      '[': sign('旅人の宿屋', ','),
      ']': sign('よろず屋\n武器・防具・道具、\nなんでもそろう！', ','),
      '(': sign('村からのお知らせ\fゴブリンが畑を荒らしに来ます。\n見かけたら、すぐに\n狩人のところへ知らせること。'),
      '}': sign('ミルトの村\f北西の山のふもとに\n風の洞窟あり。\n魔物に注意。'),
    },
  };

  R.DB.maps.milt_house_chief = {
    name: 'ミルトの村', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '##############',
      '#kk......#b..#',
      '#.E......#b..#',
      '#........#...#',
      '#...htth.....#',
      '#............#',
      '#....@......$#',
      '#####<########',
    ],
    decor: [
      '..P.w.p..c.w..',
      '...Q.F.VZ..vA.',
      '.I..rrrr....y.',
      '..Dnrrrr......',
      '..........RRR.',
      '.y..........Z.',
      '.Z.q....v.....',
      '..............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '<': warp('milt_village', 'chief_house', 'D', 'down'),
      E: chat('chief', 'elder', '.', [
        { cond: 'gate_open', text: '関所を越えていくのか。\nポルタは海の町。\nにぎやかなところじゃよ。' },
        { cond: WIND, text: 'おお、風の紋章！\nそなたたちがゴブリンを\n懲らしめてくれたのか。\f村を救ってくれた礼じゃ。\nそこの宝箱の物を\n持っていくがよい。' },
      ], ['わしがミルトの村長じゃ。', '風の洞窟は村の北西。\n奥には風の紋章が\n祀られておったが……\f今はゴブリンの親分が\n居座っておるそうじゃ。'], { dir: 'down' }),
      '$': chest('milt_chief_c1', 'iron_helm', '.', { cond: WIND }),
    },
  };

  R.DB.maps.milt_house = {
    name: 'ミルトの村', type: 'town', legend: 'local', theme: 'house', bgm: 'village',
    rows: [
      '############',
      '#....op..b.#',
      '#........b.#',
      '#.htth.....#',
      '#......G...#',
      '#o.........#',
      '#...@...p.?#',
      '####>#######',
    ],
    decor: [
      '..k.w..p.w..',
      '.CKSq...y.A.',
      '............',
      '..........Z.',
      '.......rrnq.',
      '.......rrr..',
      '.v..........',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '.'),
      '>': warp('milt_village', 'house', 'D', 'down'),
      G: say('grandma', 'old_woman', '.', [
        'まあまあ、よく来たね。\f宝箱の中身は、\n一度開けたらそれっきり。\n残さず開けておいきよ。',
        'それと、魔物が落とす\n珍しい道具……\nレアドロップっていうのかい？\f盗賊の『レアハンター』を\nつけると、出やすくなるそうだよ。',
      ], { dir: 'down' }),
      '?': chest('milt_house_h1', 'herb', '.'),
    },
  };

  // ================================================================ east gate
  // A walled pass through the mountains. The soldier blocks the road until the
  // party holds crest_wind, then steps up into the guard niche (flag gate_open);
  // gate_soldier_aside stands on that niche tile afterwards.
  R.DB.maps.east_gate = {
    name: '東の関所', type: 'castle', legend: 'local', theme: 'fort', bgm: 'castle',
    outside: 'r',
    rows: [
      'rrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrr##############rrrrrr',
      'rrrrrr##############rrrrrr',
      'rrrrrr#b.b..##k.N..#rrrrrr',
      'rrrrrr#bVb..##.....#rrrrrr',
      'rrrrrr#.....##.....#rrrrrr',
      'r,,,,r###D######D###rrrrrr',
      ',,,,,,#......#.....#,,,,,,',
      '<::::@D.....G......D0::::>',
      ',,,,,,#...o.##.....#,,,,,,',
      'rrrrrr###D######D###r,,,,r',
      'rrrrrr#.....##.....#rrrrrr',
      'rrrrrr#.....##...U.#rrrrrr',
      'rrrrrr#....o##oo...#rrrrrr',
      'rrrrrr##############rrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrr',
    ],
    decor: [
      '..........................',
      '..........................',
      '.......w.i.x....cB........',
      '........y..X...Q..Y.......',
      '................D.I.......',
      '.......q...U..Z...v.......',
      '........i.b.c..B.i........',
      '..h....Y.a.Y......Y....f..',
      '.......rrrrr..rrrrr.......',
      '...f...X.......za.X...h...',
      '........k.i...x..i........',
      '.......KS..C..UU.OG.......',
      '.......qLL........X.......',
      '........nnn.......q.......',
      '..........................',
      '..........................',
    ],
    spawns: { entrance: { x: 5, y: 8, dir: 'right' } },
    marks: {
      '@': spawn('west', 'right', ':'),
      '0': spawn('east', 'left', ':'),
      '<': warp('world', 'east_gate_w', ':', 'left'),
      '>': warp('world', 'east_gate_e', ':', 'right'),
      G: npc('gate_soldier', 'soldier', '.', { event: 'gate_soldier', dir: 'left', cond: '!gate_open' }),
      V: say('resting', 'soldier', '.', '休みの日は寝るにかぎる……。\fむにゃ……魔物なんか\n怖くないぞ……。', { dir: 'down' }),
      N: say('captain', 'knight', '.', 'わしがこの関所の隊長だ。\f東の地には、レグナスより\n強い魔物が出る。\n心して行くのだぞ。', { dir: 'down' }),
      U: say('guard_s', 'soldier', '.', 'この関所は昔から、\nレグナスを守ってきたのだ。\f腹が減っては戦はできぬ。\n食堂の飯は、なかなかいけるぞ。', { dir: 'down' }),
    },
    // the gate soldier's post once the gate is open (the niche he steps up to)
    npcs: [
      { id: 'gate_soldier_aside', x: 12, y: 7, sprite: 'npc:soldier', dir: 'down', event: 'gate_soldier', cond: 'gate_open' },
    ],

  };
})(window.RPG);
