// 港町ポルタ (east region, Lv 6–9): a harbour town. Stone quay with three
// piers, a canal with bridges, the warehouse with its silver-door vault, the
// fish market, the sailors' tavern 「うみねこ」, inn, shops, church and a
// small sailors' cemetery; the captain's house is a separate interior.
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
  const warp = (to, spawn, under, dir) => ({ warp: { to, spawn, dir }, under });
  const spawn = (name, dir, under) => ({ spawn: name, dir, under });
  const FREE = 'bandits_defeated';

  // ================================================================ town
  // local: # stone  B plaster/timber  R roof  . cobbles  _ boards  + carpet
  //        ~ harbour / canal  = | piers & bridges  d sand
  // decor: see R.DB.legends.decor (src/data/tiles.js)
  R.DB.maps.porta_town = {
    name: '港町ポルタ', type: 'town', legend: 'local', theme: 'town', bgm: 'town',
    location: 'porta', outside: '~',
    exit: { to: 'world', spawn: 'porta_town' },
    rows: [
      '########################################~~~~~~~~',
      '############TRRRRRRRTT#####$_p_%#####.........~~',
      '##___YOY___#,RRRRRRR,T#####_____#####...~~~~~~~~',
      '##____a__J_#oRRRRRRRo,#######1#######o..~~~~~~~~',
      '##____+____#jBBB<BBBjo#__o______o__j#o..~~~~~~~~',
      '##____+____#T,,,4,,,T,#___________o_#...~~~~~~~~',
      '##____+____#,o,(:,,,,,#o_A________j_#...=====n~~',
      '##____+____#,,,,:,,,,,#j_________ooj#...~~~~~~~~',
      '######D#####FFFF:FFFF,##D############.8.~~~~~~~~',
      '#......-..........................o.....~~~~~~~~',
      '#.......................................~~~~~~~~',
      '#T,g,g,,g,g,:~~~|~~~~~~~|~~~~~~~~~~~~~|~~~~~~~~~',
      '#,,,,,0,,,,,:~~~|~~~~~~~|~~~~~~~~~~~~~|~~~~~~~~~',
      '#BBBBBBBBBBB.............TBBBBBBBBBBB...~~~~~~~~',
      '#BBBBBBBBBBB.........;.!..BBBBBBBBBBB...~~~~~~~~',
      '#B_p_H__uuoBT,,.......,,,.B__uE_Gu__B...~~~~~~~~',
      '#B__ccccc__B,,,.......,,T.B__ccccc__Bj..~~~~~~~~',
      '#Bo________B,,,.......,,,.B________oB...~~~~~~~~',
      '#Bj_______oB.............TBj_____U__B...~~~~~~~~',
      'iBBBBBDBBBBB......M.......BBBBBDBBBBB..z~~9~~~~~',
      '@......{......................}.}.......=======~',
      '........................................~~~~~~~~',
      'iBBBBBBBBBBB:BBBBBBBBBBBB...o.....j...y.~~~~~~~~',
      '#BBBBBBBBBBB:BBBBBBBBBBBB...5....6......~~~~~~~~',
      '#Bb_b____IkB:BooQuo__+Z+B...............~~~~~~~~',
      '#Bb_b___cccB:Bccccc__+++B...............~~~~~~~~',
      '#B_________B:B_V________B.o...7../..o...~~~~~~~~',
      '#Bb____htN_B:B______&_X_B.tt.........o..======~~',
      '#Bb_______oB:Bo________oB.o.............~~~~~.~~',
      '#BBBBBDBBBBB:BBBBBDBBBBBB...............~~~~~.~~',
      '#......[...........]....................~~~~~.~~',
      '#.......................................~~~~~.~~',
      '#TdFFFddddddddddddddddrddddddddddddrd...~~~~~.~~',
      '#d?ddddddrddddddddwdddddddddddrdddddd.......v.~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '.............................c..................',
      '...W..c..W..................G.G..............3..',
      '..Z.QdddQ.Z.................z........U..........',
      '..v......................k.i...i...w...3........',
      '...ee...ee.............UU.q....q.UU.............',
      '...ee...ee...11...11...Uq..........U.q..........',
      '...ee...ee.........e.......s..E..q.U............',
      '..Z.......v...f....f............U...............',
      '................................................',
      '.......8.........................U.q............',
      '..........3...1...1.ee.......3..................',
      '................................................',
      '...f.f..f.fh....................................',
      '.............3.........3........................',
      '...k..p..k......1...1.u.......x..c...q.3........',
      '..C....q......1..JJJ...h...XX.....YY.U..........',
      '.............h.e.JJJ.e..........................',
      '....rrr...Z...f..JJJ...f...O..rrr...............',
      '...q....v.......1...1..............X............',
      '............3...........3.......................',
      '.......4......................5.6...............',
      '................................................',
      '..........................Uq.U..U..q............',
      '...p.....k.....k..p..t...............q..........',
      '...y..F.C...........F......999..999....3........',
      '.....rrr.............Q.Q........................',
      '.....rrr.......nnn...................U..........',
      '....Z..........nTn..nTn.........999.U...........',
      '...v.......................q.E......qE..........',
      '.......................................3........',
      '.......7........................................',
      '..........3....ee......3....e....3..............',
      '......Uq..................h.....................',
      '.h...........h...............................3..',
      '................................................',
      '................................................',
    ],
    marks: {
      '@': spawn('entrance', 'right', '.'),
      '4': spawn('captain_house', 'down', ':'),
      '<': warp('porta_house', 'entrance', 'D', 'up'),
      // church
      O: npc('priest', 'priest', '_', { event: 'church', dir: 'down' }),
      J: chat('nun', 'nun', '_', [
        { cond: FREE, text: '港に船が戻ってきました。\n神様と、あなたたちの\nおかげですね。' },
      ], '海に出た人たちが、\n無事に帰ってこられるよう、\n毎日お祈りしています。', { dir: 'left' }),
      // inn
      I: npc('innkeeper', 'innkeeper', '_', { event: 'inn', price: 15, dir: 'down' }),
      N: chat('inn_guest', 'man', 'h', [
        { cond: FREE, text: 'やっと船が出るらしい！\nあんたたちのおかげだってな！' },
      ], '船が出ないもんだから、\nもう三日もこの宿に\n泊まりっぱなしさ。', { dir: 'left' }),
      // shops
      H: shop('item', '_', 'porta_item', { dir: 'down' }),
      E: shop('weapon', '_', 'porta_weapon', { dir: 'down' }),
      G: shop('armor', '_', 'porta_armor', { dir: 'down' }),
      U: say('customer', 'woman', '_', 'ナイトのジョブなら、\n重い鎧も兜も\n装備できるのよね。\f装備できるかどうかは、\nお店の品物の一覧で\nわかるわ。', { dir: 'up' }),
      // tavern 「うみねこ」
      Q: chat('bartender', 'man', '_', [
        { cond: 'game_clear', text: '魔王を倒した勇者さまの\nお出ましだ！\n今日は飲み放題だぜ！' },
        { cond: FREE, text: '今日はお祝いだ！\n港が元に戻ったからな！\fさあ、飲んでいきな！\n……おっと、子どもはミルクだぜ。' },
      ], 'いらっしゃい。\nと言っても、船が出ないから\n客は減る一方さ。', { dir: 'down' }),
      Z: say('dancer', 'dancer', '+', [
        'あたしの踊りを見て、\n元気を出してね♪',
        '吟遊詩人の歌には、\n不思議な力があるのよ。\f僧侶と盗賊を鍛えれば、\nなれるって話。',
      ], { dir: 'down' }),
      V: chat('patron', 'dwarf', '_', [
        { cond: FREE, text: 'あんたたちが、盗賊のお頭を\n懲らしめたんだってな！\f大したもんだ。\n一杯おごらせてくれ！' },
      ], '盗賊のお頭は、\nとんでもない力持ちだって\n話だ。\f薬はたっぷり持っていけよ。', { dir: 'up' }),
      X: npc('lookout', 'bandit', '_', { text: 'へっへっへ……。\n港の船は、どこにも\n行けやしねえよ。\nお頭がいるかぎりな！', dir: 'left', cond: '!' + FREE }),
      '&': chat('tavern_sailor', 'sailor', '_', [
        { cond: FREE, text: '盗賊どもがいなくなって、\n酒がうまいのなんの！\f船があれば、世界中の海へ\n行けるんだぜ。' },
      ], '盗賊どものねぐらは、\n南の岬の先にある砦さ。\fあそこへ行くなら、\n導きの糸を持っていきな。\n一瞬で外へ出られるからよ。', { dir: 'right' }),
      // warehouse
      A: chat('worker', 'man', '_', [
        { cond: { item: 'silver_key' }, text: 'おお、そいつは蔵の鍵！\n盗賊から取り返して\nくれたのか！\f中の物はお礼だ。\n遠慮なく持っていけ！' },
      ], ['奥の蔵には、銀の扉が\nあってな。', 'その鍵は昔、\n盗賊どもに\n盗まれちまったんだ。'], { dir: 'down' }),
      '8': chat('porter', 'man', '.', [
        { cond: FREE, text: '船が動き出して、\n荷運びで大忙しさ！' },
      ], '荷物が港に山積みさ。\n船が出なけりゃ、\nどこにも運べやしねえ。', { move: 'wander' }),
      // plaza
      M: say('old_sailor', 'old_man', '.', [
        'わしは昔、船乗りじゃった。',
        'ここから東の海に、\n光の神殿という\n不思議な島があるそうじゃ。\f船がなけりゃ、\n行けんがのう。',
      ], { move: 'wander' }),
      ';': say('well_woman', 'woman', '.', 'うちの人が砦の近くで、\n動くさびた鎧に\n出くわしたんだって。\f雷の魔法が、\nよく効いたって言ってたわ。', { dir: 'right' }),
      // fish market
      '5': chat('fishmonger', 'man', '.', [
        { cond: FREE, text: 'らっしゃい、らっしゃい！\n今朝とれたての魚だよ！\f港が元どおりになって、\n市場もにぎやかになったぜ。' },
      ], 'らっしゃい！\n……と言いたいところだが、\n盗賊のせいで漁に出られねえ。\f並んでるのは、\n干物ばかりさ。', { dir: 'down' }),
      '6': say('fish_wife', 'woman', '.', '海の魔物は、\n陸の魔物より手ごわいよ。\f船旅に出るなら、\n薬草も解毒の実も\nたっぷり積んでいきな。', { dir: 'down' }),
      '/': chat('shell_vendor', 'old_woman', '.', [
        { cond: FREE, text: '貝殻の首飾りはいかが？\f海の男たちのお守りさ。\n船旅の無事を祈ってね。' },
      ], '貝殻の首飾りはいかが？\f……おや、盗賊の砦へ行くのかい。\nあそこには、眠りの霧を使う\n魔導士がいるそうだよ。\f気付け薬を持っていけば、\n眠った仲間を起こせるからね。', { dir: 'down' }),
      '7': say('market_cat', 'cat', '.', 'ニャーオ。\f魚のにおいにつられて\n集まってきたらしい。', { move: 'wander' }),
      // harbour
      z: npc('captain', 'captain', '.', { event: 'porta_captain', dir: 'right' }),
      '9': npc('moored_ship', 'ship', '~', { sprite: 'obj:ship', dir: 'left', text: '立派な船だ。', cond: '!has_ship' }),
      n: chat('sailor', 'sailor', '=', [
        { cond: FREE, text: '海はいいぞお！\n船があれば、どこへだって行ける！\f一度行った町へは、\n旅鳥の羽で\nひとっ飛びさ。' },
      ], '盗賊の船が沖で\n見張ってやがる。\nこれじゃ漁にも出られねえ。', { dir: 'right' }),
      v: say('fisher', 'old_man', '.', '釣れないねえ……。\f船で海に出れば、\n海の魔物とも戦うことになる。\nあいつらは手ごわいぞ。', { dir: 'down' }),
      y: chat('girl', 'girl', '.', [
        { cond: 'has_ship', text: 'お父さんの船、\nあなたたちにあげちゃったの？\n大事にしてね！' },
      ], 'お父さんの船、\n早く海に出られると\nいいな。', { move: 'wander' }),
      w: say('boy', 'boy', 'd', '浜辺で、きれいな貝殻を\n拾ったんだ！　見る？\fへへ、あげないよーだ！', { move: 'wander' }),
      '(': say('yard_dog', 'dog', ',', 'ワン！　ワンワン！', { move: 'wander' }),
      // treasure
      '$': chest('porta_c1', 'revive_feather', 2, '_'),
      '%': chest('porta_c2', 'cat_hood', 1, '_'),
      '!': chest('porta_h1', 'seed_mp', 1, '.'),
      '?': chest('porta_h2', 'numb_cure', 1, 'd'),
      // signs
      '[': sign('旅人の宿屋', '.'),
      ']': sign('酒場「うみねこ」\f船乗りたちの憩いの場。'),
      '{': sign('道具屋', '.'),
      '}': sign('武器と防具の店', '.'),
      '-': sign('ポルタ教会', '.'),
      '0': sign('海に生き、海に眠る\n船乗りたちの墓。\f安らかに。'),
    },
  };

  // ================================================================ captain's house
  R.DB.maps.porta_house = {
    name: '港町ポルタ', type: 'town', legend: 'local', theme: 'house', bgm: 'town',
    rows: [
      '############',
      '#_______b_b#',
      '#___G___b_b#',
      '#_hth______#',
      '#__________#',
      '#o___w____$#',
      '#?____@___p#',
      '######<#####',
    ],
    decor: [
      '..k.w.p..w..',
      '.CKS...V.y..',
      '.q..........',
      '......RR....',
      '......RRDIA.',
      '........n...',
      '....Z....v..',
      '............',
    ],
    marks: {
      '@': spawn('entrance', 'up', '_'),
      '<': warp('porta_town', 'captain_house', 'D', 'down'),
      G: chat('wife', 'woman', '_', [
        { cond: 'has_ship', text: 'うちの人、船を\nあげちまったんだって？\fまったく……。\nでも、あんたたちなら\nいいって言ってたよ。\n大事に使ってね。' },
      ], 'うちの人は港にいるよ。\n船が出せなくて、\n毎日いらいらしてるのさ。', { dir: 'down' }),
      w: say('son', 'boy', '_', 'ぼくも大きくなったら、\n父ちゃんみたいな\n船長になるんだ！', { move: 'wander' }),
      '$': chest('porta_house_c1', 'mana_drop', 1, '_'),
      '?': chest('porta_house_h1', 'seed_agi', 1, '_'),
    },
  };
})(window.RPG);
