// オアシスの町カシム (kasim): the town of region 2 r_desert ザハラ砂漠 (DESIGN §10.6.1, §10.8.3).
// Owner: reg2 (R2). Theme `town_sand` (§11.2.6: sand paving, mud-brick walls, flat roofs), BGM `town`.
//
// Layout (52×44): a white-walled town around a spring, the gate in the south wall (exit → world
// spawn `kasim`; the road runs on south-west to the royal tomb).
//   north row  : 隊商宿 (the inn, NW) · 祈りの庭 (the court of the king's statue, where the town says
//                the evening prayer) · 酒場 (NE, a small stage for the dancer ナディア)
//   middle row : the bazaar (item shop stall + three stalls and the well, W) · the spring (dry until
//                the region is cleared: tilePatch sand → water, §10.8.3 クリア後) · weapon & armour
//                shops (E)
//   south row  : 墓守アブル's house · a family home · the south avenue to the gate · the caravan camp
//                of 隊商の長ザイード · the house of a man who copies old inscriptions (SE)
//
// Contracts (other areas rely on these):
//   spawns  entrance (just inside the gate, facing up) · inn (in front of the inn door, facing down)
//   NPC ids inn · tavern · shop_item / shop_weapon / shop_armor · folk_a / folk_b (story_rumor
//           kasim_a / kasim_b) · scribe (tier 4–6) · st_rival / st_fine / st_extra (§10.8.0-7, 2 below
//           `inn`, facing up; the cells between are bare floor) · zaid · abul · nadia
//   events  onEnter kasim_intro (§10.8.3 #1) · abul → kasim_abul (#2, the reward kasim_abul_reward)
//           · nadia → kasim_nadia (#3)
(function (R) {
  'use strict';
  const K = R.Region2;
  const C = K.C;
  const CLEAR = C.clear, NOT = C.notClear;

  const def = {
    name: 'オアシスの町カシム', type: 'town', theme: 'town_sand', bgm: 'town',
    location: 'kasim', region: 'r_desert', outside: 'd', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'kasim' },
    onEnter: 'kasim_intro',
    decorLegend: { '|': 'tent' },
    // @rows kasim
    rows: [
      'dddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'd##################################################d',
      'd#####i#########i##################i#########i#####d',
      'd#dddddddddddddddddddddddddddddddddddddddddddddddd#d',
      'd#dBBBBBBBBBBBBBddBBBBBBBBBBBBBBBddBBBBBBBBBBBBBBd#d',
      'd#dBBBBBBBBBBBBBddBBBBBBBBBBBBBBBddBBBBBBBBBBBBBBd#d',
      'd#dBu__o_b_b_b_BddBp..l..Y..l..pBddBo___j_______Bd#d',
      'd#dB___j_b_b_b_BddB.....+++.....BddB____________Bd#d',
      'd#dBccc________BddB.....+++.....BddBccccc_______Bd#d',
      'd#dB___________BddB.....+++.....BddB______hth___Bd#d',
      'd#dB_______hth_BddB.....+++.....BddB____________Bd#d',
      'd#dBo__________BddB.....+++.....BddBhth_____hthoBd#d',
      'd#dBBBBBBDBBBBBBddBl..l.+++.l..lBddBBBBBBDBBBBBBBd#d',
      'd#................................................#d',
      'd#................................................#d',
      'd#................................................#d',
      'd#dddddd.dddddddd....................ddddddddddddd#d',
      'd#dddddd.dddddddd.ddd,,,dddd,,,ddd...BBBBBBBBBBBBB#d',
      'd#dddddd.dddddWdd.dddddddddddddddd...BBBBBBBBBBBBB#d',
      'd#dddddd.dddddddd.,dddddddddddddd,...B_____B_____B#d',
      'd#dddddd.dddddddd.,dddddddddddddd,...B_ccc_B_ccc_B#d',
      'd#..............d.ddddddd~~ddddddd...B_____B_____B#d',
      'd#dddddd.dddddddd.dddddddddddddddd...B_____B_____B#d',
      'd#dddddd.dddddddd.,dddddddddddddd,...B____oB____jB#d',
      'd#dddddd.dddddddd.,dddddddddddddd,...BBBDBBBBBDBBB#d',
      'd#dddddd.dddddddd.dd,,,dddddd,,,dd................#d',
      'd#dddddd.dddddddd.................................#d',
      'd#................................................#d',
      'd#................................................#d',
      'd#dddddddddddddddddddddd....dddddddddddddddddddddd#d',
      'd#dBBBBBBBBBBdBBBBBBBBdd....dddddddddddddddddddddd#d',
      'd#dBBBBBBBBBBdBBBBBBBBdd....dddddddddddddBBBBBBBBd#d',
      'd#dBb_kk___pBdBbb__o_Bdd....dddddddddddddBBBBBBBBd#d',
      'd#dBb_______BdBbb____Bdd....dddddddddddddBkk__b_Bd#d',
      'd#dB________BdB______Bdd....ddddddddRRRRdB____b_Bd#d',
      'd#dB_Y___hthBdB_hth__Bdd....ddddddddRRRRdB______Bd#d',
      'd#dB________BdB______Bdd....doodddddBBBBdB______Bd#d',
      'd#dBo______jBdB_____pBdd....dddddddddddddB_____oBd#d',
      'd#dBBBBDBBBBBdBBBBDBBBdd....dddddFFFFddddBBBDBBBBd#d',
      'd#dddddddddddddddddddddd....mddddddddddddddddddddd#d',
      'd#::::::::::::::::::::::....::::::::::::::::::::::#d',
      'd#::::::::::::::::::::::....::::::::::::::::::::::#d',
      'd########################..########################d',
      'ddddddddddddddddddddddddd..ddddddddddddddddddddddddd',
    ],
    decor: [
      '...)......)........)............)........)......)...',
      '....................................................',
      '....................................................',
      '....................................................',
      '....................................................',
      '....$..w...w..w.)...t..c.W.c..t.....HHH...w..w......',
      '..........y.y........Q.......Q....)..N.......000....',
      '...........................................n........',
      '....................eee.....eee...............N.....',
      '.......&.......Z....................................',
      '....................eee.....eee........T............',
      '.........Z.rrr.....f...........f....................',
      '....................................................',
      '......7......1..3.................3.1......j........',
      '....................................................',
      '....................................................',
      '..)............)....................................',
      '...U.q....v.q......)..)......)..)...................',
      '.......................................x.x...c.m....',
      '...999....999.........................X...X.Y...Y...',
      '..................)..............)..................',
      '....4...............................................',
      '.......................................rrr...rrr....',
      '...999....999.....)..............)..................',
      '..............|.....................................',
      '...U.q....v.q........)........).......5.........6...',
      '...............)....................................',
      '..3..............................................3..',
      '....................................................',
      '.....................1........1.........)...........',
      '.......................3....3.......................',
      '....w..p..w.....w.$.w........U.|.q.|.q..............',
      '........v.............................U...[..w.}....',
      '..........>.........................................',
      '.......&............!..........rr.%........D........',
      '.......................3....3................n......',
      '......rrr.......&&...............q...w....{..rr..)..',
      '...............K.....................E..............',
      '......................)........M.......)............',
      '..)...........................|.....................',
      '....................................................',
      '....................................................',
      '....................................................',
      '........)............)........).............).......',
    ],
    // @end kasim
    spawns: {
      entrance: { x: 25, y: 41, dir: 'up' },
      inn: { x: 9, y: 13, dir: 'down' },
    },
    tilePatches: [
      // the spring fills again when the region is cleared (§10.8.3 クリア後: sand → water)
      { cond: CLEAR, x: 22, y: 18, w: 8, h: 1, ch: '~' },
      { cond: CLEAR, x: 20, y: 19, w: 12, h: 1, ch: '~' },
      { cond: CLEAR, x: 19, y: 20, w: 14, h: 3, ch: '~' },
      { cond: CLEAR, x: 20, y: 23, w: 12, h: 1, ch: '~' },
      { cond: CLEAR, x: 22, y: 24, w: 8, h: 1, ch: '~' },
      // 記録院の立て札 (tier 1~, §10.9.1) beside the gate road
      { cond: C.t1, x: 23, y: 39, ch: 'm' },
    ],
    npcs: [
      // --- the story spots below the inn (§10.8.0-7; story_after_clear shows them)
      K.npc('st_rival', 'rowell', 9, 15, { dir: 'up', cond: 'st_show_rival', fixed: true, text: '……' }),
      K.npc('st_fine', 'fine', 11, 15, { dir: 'up', cond: 'st_show_fine', fixed: true, text: '……' }),
      K.npc('st_extra', 'scribe', 7, 15, { dir: 'up', cond: 'st_show_extra', fixed: true, text: '……' }),

      // --- 隊商宿 (the inn)
      K.npc('inn', 'innkeeper', 5, 7, { event: 'common_inn', fixed: true, greet: '隊商宿へようこそ。\n砂を落として、\nゆっくり休んでいってください。' }),
      K.talk('inn_guest', 'nomad', 10, 10, [
        { cond: C.post, text: '昔話をたくさん思い出してね。\n今夜は、客どうしで\n語り合っているのさ。' },
        { cond: C.t4, text: '記録院のお触れで、\n宿の客もぴりぴりしてる。\n古い本を隠す者もいるよ。' },
        { cond: CLEAR, text: 'やっと砂嵐がやんだ！\n明日の朝には、北の街道へ\n出発できそうだ。' },
        { text: '砂嵐で足止めされて、\nもう十日になる。\n宿代ばかりかさんでいくよ。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 8, 9, [
        { cond: CLEAR, text: '泉に水が戻ったから、\nお客さんに冷たい水を\nお出しできるの。' },
        { text: '水は一日に、おけ一杯まで。\n泉の水が減ってるから、\n大事に使ってね。' },
      ], { move: 'wander', push: true }),

      // --- 祈りの庭 (the king's statue)
      K.talk('prayer_elder', 'elder', 25, 9, [
        { cond: C.post, text: '夕べの祈りのあとは、\nハザル王の話をするのが\n町の決まりになったのじゃ。' },
        { cond: CLEAR, text: ['ハザル王よ、今日の水を\nありがとうございます。', '……名を呼べるというのは、\nありがたいことじゃな。\n胸の奥が、すっと晴れる。'] },
        { cond: { var: 'desert_letters', gte: 3 }, text: 'ハザル……おお、そうじゃ、\nハザル王じゃ！\nどうして忘れておったのか。' },
        { text: ['夕べの祈りの言葉に、\nひとつだけ白い穴がある。', '王さまの名前が入る所じゃ。\nわしらは毎日、そこで\n黙りこんでしまうのじゃよ。'] },
      ], { dir: 'up', push: true }),
      K.talk('pray_a', 'woman', 21, 8, 'ハザル王、ハザル王……。\n民は、約束を忘れません。', { dir: 'up', cond: CLEAR, push: true }),
      K.talk('pray_b', 'man', 29, 10, 'ハザル王の水に、感謝を。\n……名前を呼ぶのは、\nこんなに気持ちがいいんだな。', { dir: 'up', cond: CLEAR, push: true }),
      K.talk('pray_c', 'girl', 22, 10, 'ハザルおうさま、\nおみずをありがとう！', { dir: 'up', cond: CLEAR, push: true }),
      K.talk('court_woman', 'old_woman', 29, 8, [
        { cond: { var: 'desert_letters', gte: 1 }, text: '王墓で、台座の文字を\n見つけたって？\n……早く、全部そろえておくれ。' },
        { text: '毎晩ここで祈るんだけど、\n王さまの名前のところで、\n声が出なくなるんだよ。' },
      ], { dir: 'up', cond: NOT, push: true }),

      // --- 酒場
      K.npc('tavern', 'bartender', 38, 7, { event: 'common_tavern', fixed: true, greet: '砂の町の酒場へようこそ。\n腕の立つ旅人なら、\nここで見つかるよ。' }),
      K.npc('nadia', 'dancer', 45, 6, { event: 'kasim_nadia', dir: 'down', fixed: true }),
      K.talk('tavern_bard', 'bard', 47, 6, [
        { cond: CLEAR, text: '王の名が戻って、\n祈りの歌も最後まで\n歌えるようになったよ。' },
        { text: '祈りの歌を弾いていると、\n王の名のところで、\n指が止まってしまうんだ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('tavern_drunk', 'man', 42, 9, [
        { cond: C.fog, text: '内海の霧が晴れたってな！\nよし、島の酒を飲みに\n行ってみるか。……ひっく。' },
        { cond: CLEAR, text: '泉に水が戻った祝いだ！\n今夜は飲むぞお。\n……ひっく。' },
        { text: '水が減って、酒まで\n値上がりしやがった。\n……砂嵐め、ひっく。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_traveler', 'scholar', 46, 11, [
        { cond: C.t4, text: '記録院の大書記ラザロ？\n古い本を集めて、何を\nするつもりなんだろうね。' },
        { cond: CLEAR, text: '王墓の砂嵐がやんだから、\n中の碑文を写しに\n行きたいんだけど……。\n魔物がまだ出るんだよね。' },
        { text: '王墓の魔物は、ミイラに\nサソリにヘビ……。\n毒よけの品は忘れずにね。' },
      ], { dir: 'left', push: true }),

      // --- the shops
      K.npc('shop_weapon', 'dwarf', 40, 19, { event: 'common_shop', shop: 'kasim_weapon', fixed: true }),
      K.npc('shop_armor', 'woman', 46, 19, { event: 'common_shop', shop: 'kasim_armor', fixed: true }),
      K.talk('shop_customer', 'nomad', 40, 22, [
        { cond: CLEAR, text: '隊商が出たら、北の町の\nいい武器も入ってくる。\n楽しみだな。' },
        { text: '砂漠の旅には、軽い防具が\nいちばんだ。重い鎧は、\n日に焼けて熱くなるからな。' },
      ], { move: 'wander', push: true }),

      // --- the bazaar
      K.npc('shop_item', 'merchant', 4, 18, { event: 'common_shop', shop: 'kasim_item', fixed: true }),
      K.talk('fruit_seller', 'woman', 11, 18, [
        { cond: CLEAR, text: '泉のそばのやしに、\nまた実がなりそうよ。\n来月には、売り物になるわ。' },
        { text: 'やしの実も、なつめも、\n泉が干上がりかけてから\nさっぱりなのよ。' },
      ], { fixed: true }),
      K.talk('cloth_seller', 'nomad', 4, 22, [
        { cond: C.post, text: 'この織物の模様はね、\nハザル王の物語なんだ。\n昔の職人は覚えていたんだな。' },
        { cond: CLEAR, text: '隊商が出るから、織物を\nたんまり積んでもらうのさ。\n北の町で高く売れるんだ。' },
        { text: '砂嵐のせいで、織物が\n一枚も売れやしない。\n隊商が出ないからね。' },
      ], { fixed: true }),
      K.talk('spice_seller', 'merchant', 11, 22, [
        { cond: C.t4, text: '記録院の書記が来てさ、\n香辛料の古い帳面まで\n持っていこうとしたんだよ。' },
        { cond: CLEAR, text: '香辛料の荷も、やっと\n北へ出せる。\nあんたにも一粒、おまけだ！' },
        { text: '香辛料は湿気が大敵でね。\n……もっとも、今のカシムに\n湿気なんて無いけどさ。' },
      ], { fixed: true }),
      K.talk('water_carrier', 'woman', 13, 19, [
        { cond: CLEAR, text: '井戸の水が、朝から\nあふれそうなのよ！\n泉と井戸は、根っこで\nつながってるのね。' },
        { text: '井戸の水も浅くなって、\nくみ上げるのがひと苦労さ。\n泉が干上がったら、\nこの町はおしまいだよ。' },
      ], { dir: 'right', push: true }),
      K.talk('market_boy', 'boy', 7, 24, [
        { cond: CLEAR, text: '泉で泳いだら、\n母さんにしかられたんだ。\nでも、冷たくて最高だった！' },
        { text: '泉がからっぽになったら、\nみんな町を出ていくの？\n……いやだなあ。' },
      ], { move: 'wander', push: true }),

      // --- the spring
      K.talk('oasis_girl', 'girl', 18, 22, [
        { cond: CLEAR, text: '泉に水が戻ったの！\nやしの木も、うれしそう。' },
        { text: '泉の水が、毎日少しずつ\n減っていくの。\nやしの木も、元気がないの。' },
      ], { move: 'wander', push: true }),
      K.talk('oasis_oldman', 'old_man', 33, 21, [
        { cond: C.post, text: '孫にハザル王の話を\nしてやったら、夜も\n眠らずに聞いておったわい。' },
        { cond: CLEAR, text: ['見なされ、この水を。\nわしの若いころと同じ、\n満々とした泉じゃ。', 'ハザル王が、名と引きかえに\nくだされた水じゃ。\n大事にせんといかんのう。'] },
        { text: 'この泉は、昔の大干ばつの年に\n王さまがくださったのだと、\n祖母から聞いたのじゃが……。\f王さまの名前が、\nどうしても出てこんのじゃ。' },
      ], { dir: 'left', push: true }),
      K.npc('folk_a', 'nomad', 24, 16, { event: 'story_rumor', rumor: 'kasim_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 30, 26, { event: 'story_rumor', rumor: 'kasim_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 27, 27, '古い本はありませんか。\n記録院で、大切に保管\nいたします。', { cond: C.scribe, move: 'wander', push: true }),
      K.talk('cat', 'cat', 12, 28, 'ニャア。', { move: 'wander', push: true }),

      // --- 墓守アブルの家
      K.npc('abul', 'old_man', 9, 33, { event: 'kasim_abul', dir: 'down', fixed: true }),
      // --- a family home
      K.talk('home_mother', 'woman', 18, 34, [
        { cond: C.t6, text: '子守歌の続きが、どうしても\n出てこないの。この子に\n歌ってあげたいのに……。' },
        { cond: CLEAR, text: 'ゆうべの祈りで、みんなで\nハザル王の名前を呼んだのよ。\n町じゅうが泣いていたわ。' },
        { text: '水をくみに行くたびに、\n泉が小さくなっていくの。\nこの子が大きくなるまで、\nもつのかしら……。' },
      ], { dir: 'down', push: true }),
      K.talk('weaver', 'old_woman', 19, 35, [
        { cond: CLEAR, text: '織物の模様に、王さまの\n名前を織りこんでいるのさ。\nもう二度と忘れないようにね。' },
        { text: '機を織りながら祈りの歌を\n口ずさむんだけど、\n名前のところで糸が切れる。' },
      ], { dir: 'right', push: true }),
      K.talk('home_boy', 'boy', 17, 36, [
        { cond: CLEAR, text: 'ハザル王って、泉を\nくれた王さまなんだって！\nぼく、もう覚えたよ！' },
        { text: '王墓には、ミイラが\nいるんだって。\nこわいから、ぼくは行かない。' },
      ], { move: 'wander', push: true }),
      // --- the man who copies inscriptions (hints; no progress needed)
      K.talk('copyist', 'scholar', 44, 35, [
        { cond: C.post, text: '王墓の碑文を、語り部の\n言葉で書き直しているんだ。\n写すのとは、まるで違うね。' },
        { cond: CLEAR, text: '王墓の奥には、王の間の\nほかにも小部屋があるらしい。\n宝が残っていればいいが。' },
        { text: ['王墓の二階には、崩れかけた\n行き止まりがあるんだ。', '壁のひびが、妙に\n気になってね……。\n押したら動きそうだったよ。'] },
      ], { dir: 'up', push: true }),

      // --- the caravan camp
      K.talk('zaid', 'merchant', 33, 33, [
        { cond: C.post, text: '年代記の語り部の話は、\n隊商の行く先々で\n語り継いでいるよ。' },
        { cond: C.fog, text: '内海の霧が晴れたそうだな。\n島の都へ荷を運ぶ話が、\nもう来ている。' },
        { cond: C.t4, text: '記録院の書記が、隊商の\n荷まであらためていく。\n古い本は無いか、とな。' },
        { cond: CLEAR, text: ['砂嵐がやんで、隊商は\n北の街道へ出発したよ。\nわたしは次の便で追いかける。', '{hero}、あんたのおかげだ。\n砂漠の道は、どこへでも\n続いている。'] },
        { text: ['砂嵐のせいで、隊商が出せない。\nこのままでは、町の品も\n尽きてしまう。', '嵐は、南西の王墓のあたりから\n吹いてくるようだ。\n墓守のアブルじいさんなら、\n何か知っているかもしれん。'] },
      ], { dir: 'down', fixed: true }),
      K.talk('caravan_a', 'nomad', 31, 33, 'ラクダたちも、砂嵐で\nおびえてしまってね。\n小屋から出ようとしないんだ。', { dir: 'right', cond: NOT, push: true }),
      K.talk('caravan_b', 'man', 35, 37, '荷はとっくに積み終わってる。\nあとは、嵐がやむのを\n待つだけなんだが……。', { dir: 'left', cond: NOT, push: true }),
      K.talk('caravan_kid', 'boy', 32, 35, '隊商のみんなは、北の街道へ\n出発したよ。\nぼくは次の便で行くんだ！', { move: 'wander', cond: CLEAR, push: true }),

      // --- the gate
      K.talk('gate_guard', 'soldier', 23, 41, [
        { cond: C.fog, text: '内海の霧が晴れたそうだ。\n砂漠の北の街道から、\n島の白い塔が見えたとさ。' },
        { cond: CLEAR, text: '砂嵐がやんで、門の見張りも\nずいぶん楽になった。\n砂漠は、本当はきれいなんだ。' },
        { text: '砂嵐がひどい日は、門を\n開けていられないんだ。\n王墓へ行くなら、南西だぞ。' },
      ], { dir: 'up', fixed: true }),
    ],
    signs: [
      K.sign(28, 39, 'オアシスの町カシム\n「水を分け合う者に、\n砂は道をゆずる」'),
      K.sign(23, 39, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
      K.sign(25, 6, [
        { cond: CLEAR, text: 'ハザル王の像だ。\n台座の名前が、はっきりと\n読めるようになっている。' },
        { text: '王の像だ。台座の名前が、\n白くかすれて読めない。' },
      ]),
      K.sign(26, 21, '泉の底に、わずかな水が\n残っているだけだ。', NOT),
    ],
    chests: [],
    events: [],
  };
  R.DB.maps.kasim = K.checkRows('kasim', def);
})(window.RPG);
