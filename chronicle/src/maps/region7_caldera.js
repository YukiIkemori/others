// 炎の町カルデラ (caldera): the town of Region 7 灰の荒野 (DESIGN §10.6.1, §10.8.8, §11.2.6).
// Owner: reg7 (R7). Theme `town_ash` (basalt streets, red rock, red-black tiles), BGM `village`.
//
// Layout (52×40): a village in the floor of an old caldera, ringed by the crater wall. The only way out
// is the gate in the south wall (walking off the map → world spawn `caldera`).
//   north : 族長ドルガの家 · 火の神殿 (火の巫女カヤ, the firebird mural) · 語り婆の家
//   middle: 宿屋 · 酒場「残り火亭」 · the firebird statue · the hot spring rocks (caldera_spring)
//   south : 道具屋 · 鍛冶場 (武器屋・防具屋) · the ash-choked field · 灰かぶりの子どもの家
// Contracts (other areas rely on these):
//   spawns  entrance (south gate, facing up) · inn (in front of the inn door, facing down)
//   NPC ids inn · tavern · shop_item / shop_weapon / shop_armor · folk_a / folk_b (story_rumor caldera_a /
//           caldera_b) · scribe (tier 4–6) · st_rival / st_fine / st_extra (§10.8.0-7, 2 below `inn`)
//           · dorga · dorga_gate · kaya · kaya_after · ashkid
//   events  onEnter caldera_intro · caldera_kaya · caldera_kaya_reward · caldera_spring(_closed)
(function (R) {
  'use strict';
  const K = R.Reg7;
  const C = K.C;
  const ASH = { cond: C.before, fixed: true, text: '灰が厚く積もっている。\nこれでは、芽も出ないだろう。' };

  const def = {
    name: '炎の町カルデラ', type: 'town', theme: 'town_ash', bgm: 'village',
    location: 'caldera', region: 'r_ash', outside: '#', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'caldera' },
    onEnter: 'caldera_intro',
    decorLegend: { '|': 'hot_spring', ':': 'mural_firebird', ',': 'ash_pile' },
    // @rows caldera
    rows: [
      '####################################################',
      '####################################################',
      '##rrrrrrrrrrrrrrrBBBBBBBBBBBBBBBBBBrrrrrrrrrrrrrrr##',
      '##:BBBBBBBBBBB:::BBBBBBBBBBBBBBBBBB:::BBBBBBBBBBB:##',
      '##:BBBBBBBBBBB:::Bu..l...aa...l..uB:::BBBBBBBBBBB:##',
      '##:Bb_b__u__oB:::B.......++.......B:::Bb_b__kk_pB:##',
      '##:B_________B:::Bl......++......lB:::B_________B:##',
      '##:B__hth____B:::B.......++.......B:::B__hth____B:##',
      '##:B_________B:::Bl......++......lB:::B_________B:##',
      '##:Bp______joB:::B.......++.......B:::Bo_______jB:##',
      '##:BBBBBDBBBBB:::Bp.....l++l.....pB:::BBBBBDBBBBB:##',
      '##:::::::::::::::BBBBBBBBDDBBBBBBBB:::::::::::::::##',
      '##::::::::::::::::::::m:::::::::::::::::::::::::::##',
      '##::::::::::::::::::::::::::::::::::::::::::::::::##',
      '##::::::::::::::::::::::::::::::::::::::::::::::::##',
      '##:BBBBBBBBBBBB::BBBBBBBBBBBB:::::::::rrrrrrrrrr::##',
      '##:BBBBBBBBBBBBooBBBBBBBBBBBB::::::::rr~~~~~~~~rr:##',
      '##:Bb_b_b__u_uB::Bo________oB::::::::r~~~~~~~~~~r:##',
      '##:B__________B::B_____hth__B::::::::r~~~~r~~~~~r:##',
      '##:B______ccc_B::Bccc_______B:::Y::::r~~~~~~~~~~r:##',
      '##:B__________B::B__________B::::::::rr~~~~~~~~rr:##',
      '##:Boht_______B::B_____hth__B:::::::::rrr::::rrr::##',
      '##:B_______p_jB::Bj_______ooB::::::::m::::::::::::##',
      '##:BBBBBDBBBBBB::BBBBBDBBBBBB:::::::::::::::::::::##',
      '##::::::::::::::::::::::::::::::::::::::::::RRRRR:##',
      '##::::::::::::::::::::::::::::::::::::::::::RRRRR:##',
      '##:::::::::::::::::::::::::::::::::::::::::oBBBBB:##',
      '##:::::::::::::::::::::::::::::::::j::::::::::::::##',
      '##:BBBBBBBBB::BBBBBBBBBBBBBojFFFFFFFFF::BBBBBBBBB:##',
      '##:BBBBBBBBB::BBBBBBBBBBBBB::F:::::::F::BBBBBBBBB:##',
      '##:Bu__u__uB::B___________B::F:::::::F::Bb_b__u_B:##',
      '##:B_______B::B___________B::F:::::::F::B_______B:##',
      '##:B__ccc__B::Bccc_____cccB::F:::::::F::B__hth__B:##',
      '##:B_______B::B___________B::F:::::::F::B_______B:##',
      '##:Bp_____oB::Bo_________oB::FFFF:FFFFj:Bp_____oB:##',
      '##:BBBBDBBBB::BBBBBBDBBBBBB:::::::::::::BBBBDBBBB:##',
      '##:::::::::::::::::::m::::::::::::::::::::::::::::##',
      '##::::::::::::::::::::::::::::::::::::::::::::::::##',
      '######################::::::::######################',
      '######################::::::::######################',
    ],
    decor: [
      '....................................................',
      '....................................................',
      '....................................................',
      '..,................tb..i.:..i..bt................,..',
      '.....w..p..w...........Q....Q...........w...$.w.....',
      '........F.......,...Q..........Q....................',
      '......................r......r.......%..............',
      '..............%.....eee.Q..Q.eee..............!.....',
      '.......rrr............n......n.......,.....&.?......',
      '....................eee......eee....................',
      '....................v..........v....................',
      '...............3....................3...............',
      '...._......................_...................%....',
      '.........._..................u...........E.._.......',
      '....................................................',
      '....................................................',
      '.....w...p..w.....HHH...w.w..3.....3.........|......',
      '.....................N..................|...........',
      '............................................|.......',
      '..........................00..e...e....|......|.....',
      '..,.....rr...Z............00..............|.........',
      '....................................................',
      '...............................]......e........e....',
      '.................................................,..',
      '...........7...3........j.........._.......U........',
      '...................._...............................',
      '..q..............9q..........................w.w....',
      '..............................3.......3......U......',
      '....................................................',
      '.....w...$..,...x...w...x.................w...w.....',
      '...............X.X..F..Y.Y..................K.......',
      '.....n...n...%.......n................,..........%..',
      '....................................................',
      '..,....&.....,...s.....s..............q.............',
      '....................................................',
      '.................................................,..',
      '.....4......3....5......6..............3............',
      '......_.....................,..._............._.....',
      '....................................................',
      '....................................................',
    ],
    // @end caldera
    spawns: {
      entrance: { x: 25, y: 37, dir: 'up' },
      inn: { x: 8, y: 24, dir: 'down' },
    },
    tilePatches: [
      // 記録院の立て札 (tier 1~, §10.9.1)
      { cond: C.t1, x: 30, y: 36, ch: 'm' },
      // after the chapter: the ash is gone and the field turns green again
      { cond: C.clear, x: 30, y: 29, w: 7, h: 5, ch: ',' },
    ],
    npcs: [
      // --- 族長ドルガ: at the gate for the first visit (caldera_intro), then at home
      K.npc('dorga_gate', 'elder', 25, 36, { event: 'caldera_intro', cond: '!ash_start', fixed: true }),
      K.talk('dorga', 'elder', 10, 7, [
        { cond: C.post, text: '祭りの夜には、火の鳥が\n町の上を一回りするのだ。\n百年ぶりの、にぎやかさよ。' },
        { cond: C.fog, text: '内海の霧が晴れたそうだな。\n火の鳥も、北の空ばかり\n見ておる。何かあるのか……。' },
        { cond: [C.clear, C.t4], text: '記録院のお触れか。\n火の鳥の物語は、紙ではなく\nこの町の者の口で伝える。\fそれが、わしらの答えだ。' },
        { cond: C.clear, text: '空が、こんなに青かったとはな。\n火の鳥が、山の火を\nなだめてくれておる。\f畑も、また耕せる。\n{hero}、この恩は忘れんぞ。' },
        { cond: C.mid, text: '炎の番犬を倒したと？\n……おぬしなら、火口まで\nたどり着けるかもしれん。' },
        { text: '灰の火山は、町の南東だ。\n火口へは、山の中を\n上へ上へと登るしかない。\f壁画のことは、カヤに聞け。\n巫女の家系の者だからな。' },
      ], { dir: 'down', fixed: true }),
      K.talk('dorga_wife', 'old_woman', 6, 8, [
        { cond: C.clear, text: 'あの人ったら、毎朝\n空を見上げては\nにやにやしているのよ。' },
        { text: '灰で洗濯物が真っ黒よ。\nあの人も、族長として\n眠れない夜が続いてるわ。' },
      ], { dir: 'right', push: true }),

      // --- 火の神殿
      K.npc('kaya', 'priestess', 25, 5, { event: 'caldera_kaya', cond: C.before, fixed: true }),
      K.npc('kaya_after', 'priestess', 25, 5, { event: 'caldera_kaya_reward', cond: C.clear, fixed: true }),
      K.talk('temple_elder', 'old_woman', 30, 6, [
        { cond: C.post, text: '百年後の巫女のために、\n物語を書き残しておくことに\nしたよ。声と、紙と、両方でね。' },
        { cond: C.clear, text: 'カヤが祭壇の前で、\n火の鳥の物語を語ったよ。\n……いい声だった。' },
        { text: 'わたしは先代の巫女さ。\nでもね、物語の続きが\nどうしても出てこない。\f年のせいだと思っていたら、\nカヤまで同じなんだよ。' },
      ], { dir: 'left', fixed: true }),
      K.talk('pilgrim', 'man', 21, 7, [
        { cond: C.clear, text: '神殿の火が、前よりも\n明るく燃えている気がする。' },
        { text: '毎日ここで祈っているんだ。\n火の鳥さま、どうか\n目を覚ましてください……。' },
      ], { dir: 'up', push: true }),
      K.talk('temple_girl', 'girl', 30, 9, [
        { cond: C.clear, text: 'わたしも大きくなったら、\n巫女になるの！\n物語、もう覚えたもん。' },
        { text: '壁の絵はね、火の鳥の\n絵なんだって。\nでも、お話は知らないの。' },
      ], { move: 'wander', push: true }),

      // --- 語り婆の家
      K.talk('storyteller', 'old_woman', 43, 6, [
        { cond: C.t6, text: '子守歌の続きがね……。\n火の鳥の話は覚えているのに、\nおかしなものさ。' },
        { cond: C.clear, text: '火の鳥はね、百年ごとに\n灰になって、物語で\nよみがえるのさ。\fそうそう、それだよ。\nやっと思い出せた。' },
        { text: '火の鳥はね、百年ごとに\n灰になって……。\nそれから、どうなるんだっけ。\f昔は、何べんも\n孫に話してやったのにねえ。' },
      ], { dir: 'down', push: true }),
      K.talk('grandchild', 'boy', 41, 8, [
        { cond: C.clear, text: 'ばあちゃんがね、火の鳥の\nお話を最後までしてくれたよ！' },
        { text: 'ばあちゃんのお話、\nいつも途中で終わっちゃうんだ。' },
      ], { move: 'wander', push: true }),

      // --- 宿屋
      K.npc('inn', 'innkeeper', 11, 18, { event: 'common_inn', fixed: true }),
      K.talk('inn_guest', 'merchant', 5, 21, [
        { cond: C.clear, text: '灰がやんだから、商いを\n再開するよ。カルデラの\n火の石は、よく売れるんだ。' },
        { text: '灰で荷車が進まなくてね。\nもう何日も、この宿に\n足止めさ。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 6, 18, [
        { cond: C.clear, text: '温泉に入ってきた？\n旅の疲れが、すっと\n抜けるわよ。' },
        { text: '町の温泉も、灰でにごって\n入れないの。\nお客さんに申し訳なくて。' },
      ], { move: 'wander', push: true }),

      // --- 酒場「残り火亭」
      K.npc('tavern', 'bartender', 19, 18, { event: 'common_tavern', fixed: true, greet: '残り火亭へ、ようこそ。' }),
      K.talk('tavern_miner', 'miner', 23, 18, [
        { cond: C.clear, text: '火の石を掘りに、\nまた山へ入れるぜ。\n今夜は祝い酒だ！' },
        { text: '火山の石は、いい火種になる。\nだが、今の山は\n魔物だらけで近づけねえ。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_woman', 'woman', 25, 21, [
        { cond: C.t4, text: '記録院のお触れで、\n神殿の古い本まで\n持っていかれそうなの。' },
        { cond: C.clear, text: '火の鳥が飛んでいくのを\n見たの。赤い光の\n帯みたいだったわ。' },
        { text: '灰を吸うと、のどが\nいがいがするのよね。\nお酒で流すしかないわ。' },
      ], { dir: 'left', push: true }),
      K.talk('bard', 'bard', 27, 19, [
        { cond: C.clear, text: '♪　灰より生まれし\n小さき炎よ、\n翼となりて、空を焼け。\f新しい歌ができたんだ。\n君の物語さ。' },
        { text: '火の鳥の歌を作ろうと\nしてるんだけど、\n話の筋が思い出せなくてね。' },
      ], { dir: 'down', fixed: true }),

      // --- 広場と温泉
      K.talk('statue_man', 'old_man', 32, 21, [
        { cond: C.clear, text: '石像の灰を、子どもらと\n払ってやったんじゃ。\nほれ、見違えたじゃろう。' },
        { text: 'この石像はな、百年前の\n祭りのあとに彫られたそうじゃ。\n火の鳥の姿を忘れんようにと。' },
      ], { dir: 'up', push: true }),
      K.talk('spring_old', 'old_man', 39, 22, [
        { cond: C.clear, text: 'ああ、極楽じゃ。\nこの湯につかると、\n十は若返るわい。' },
        { text: '湯が灰でにごって、\n入れんのじゃ。\n年寄りには、こたえるわい。' },
      ], { dir: 'up', push: true }),
      K.talk('bath_keeper', 'woman', 46, 22, [
        { cond: C.clear, text: '温泉は、どなたでも無料よ。\n湯のそばで調べてみて。\n疲れがすっかり取れるわ。' },
        { text: '湯守をしてるんだけど、\n毎朝、灰をすくっても\nきりがないのよ。' },
      ], { dir: 'up', push: true }),
      K.talk('lookout', 'soldier', 49, 12, [
        { cond: C.fog, text: '山の上から見ると、\n内海の島に、白い塔が\nそびえているのが見えるぞ。' },
        { cond: C.clear, text: '火山は静かなもんだ。\n見張りも、今は\n星を数えるくらいさ。' },
        { text: '火山の見張り番だ。\n夜になると、火口が\n不気味に赤く光るんだ。' },
      ], { dir: 'left', fixed: true }),

      // --- 店
      K.npc('shop_item', 'merchant', 7, 31, { event: 'common_shop', shop: 'caldera_item', fixed: true }),
      K.npc('shop_weapon', 'dwarf', 16, 31, { event: 'common_shop', shop: 'caldera_weapon', fixed: true, greet: '火山の火で鍛えた品だ。\n切れ味は保証するぜ。' }),
      K.npc('shop_armor', 'woman', 24, 31, { event: 'common_shop', shop: 'caldera_armor', fixed: true }),
      K.talk('smith_boy', 'boy', 20, 33, [
        { cond: C.clear, text: '炉の火が、ごうごう\n燃えるようになったんだ！\n親方もごきげんさ。' },
        { text: '灰のせいで、炉の火が\nうまく燃えないんだって。\n親方がぼやいてたよ。' },
      ], { move: 'wander', push: true }),
      K.talk('shop_customer', 'man', 9, 33, [
        { cond: C.clear, text: '温泉の湯の花は、\nいい薬になるんだ。\nまた取れるようになった。' },
        { text: '灰を吸わないように、\n口に布を当てて歩いてるよ。' },
      ], { dir: 'up', push: true }),

      // --- 畑と家
      K.talk('farmer', 'farmer', 31, 35, [
        { cond: C.post, text: '今年は豊作だ！\n火山の灰は、雨に溶けると\nいい肥やしになるんだとさ。' },
        { cond: C.clear, text: '見てくれ、芽が出たんだ！\n灰がやんで、日が差して。\nまた一からやり直すさ。' },
        { text: '畑が灰に埋まって、\n麦も豆も全滅だ。\nこのままじゃ、冬を越せん。' },
      ], { dir: 'up', push: true }),
      K.npc('ash_a', 'decor:ash_pile', 31, 30, ASH),
      K.npc('ash_b', 'decor:ash_pile', 34, 31, ASH),
      K.npc('ash_c', 'decor:ash_pile', 32, 33, ASH),
      K.talk('mother', 'woman', 44, 31, [
        { cond: C.clear, text: 'うちの子ったら、\n灰で遊べなくなったって\nすねてるのよ。ふふ。' },
        { text: 'うちの子、灰の中で\n転げ回って、毎日\n真っ白なの。困ったわ。' },
      ], { dir: 'down', push: true }),
      K.talk('cat', 'cat', 42, 33, 'ニャーオ。', { move: 'wander', push: true }),
      K.talk('ashkid', 'boy', 30, 25, [
        { cond: C.clear, text: '空って、青いんだね！\nぼく、灰色だと思ってた！' },
        { text: 'ぼく、灰の山で遊ぶのが\n好きなんだ。\nでも、母ちゃんに怒られる。' },
      ], { move: 'wander', push: true }),
      K.talk('gate_guard', 'soldier', 20, 37, [
        { cond: C.clear, text: '灰がやんで、道がよく\n見えるようになった。\n門番も楽なもんだ。' },
        { text: '灰で前が見えなくてな。\n魔物が門のすぐ外まで\n来ることもある。気をつけろ。' },
      ], { dir: 'up', push: true }),

      // --- うわさ話 (§10.8.0-8) と 白衣の書記 (§10.9.5)
      K.npc('folk_a', 'man', 33, 13, { event: 'story_rumor', rumor: 'caldera_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 13, 26, { event: 'story_rumor', rumor: 'caldera_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 40, 13, '古い本はありませんか。\n記録院で、大切に保管\nいたします。',
        { cond: C.scribe, move: 'wander', push: true }),

      // --- 場面の枠 (§10.8.0-7: 2 below `inn`; story_after_clear shows them)
      K.npc('st_rival', 'rowell', 8, 26, { dir: 'up', cond: 'st_show_rival', fixed: true, text: '……' }),
      K.npc('st_fine', 'fine', 10, 26, { dir: 'up', cond: 'st_show_fine', fixed: true, text: '……' }),
      K.npc('st_extra', 'scribe', 6, 26, { dir: 'up', cond: 'st_show_extra', fixed: true, text: '……' }),
    ],
    signs: [
      K.sign(25, 3, [
        { cond: C.clear, text: '火の鳥の壁画だ。\n火の粉のような赤い色が、\nあざやかによみがえっている。' },
        { text: '火の鳥の壁画だ。\n灰をかぶって、絵の半分が\nかすんでいる。' },
      ]),
      K.sign(21, 36, '炎の町カルデラ\n「火の鳥の眠る山のふもと」'),
      K.sign(22, 12, '火の神殿\n「火は語りを待ち、\n語りは火を目覚めさせる」'),
      K.sign(37, 22, [
        { cond: C.clear, text: 'カルデラの湯\n「山の火のめぐみ。\nどなたでも、ご自由に」' },
        { text: 'カルデラの湯\n「灰が積もり、湯がにごったため、\nしばらく休みます」' },
      ]),
      K.sign(32, 19, [
        { cond: C.clear, text: '火の鳥の石像だ。\n翼の先が、夕日のように\n赤く輝いて見える。' },
        { text: '火の鳥の石像だ。\n灰をかぶって、\nすっかり白くなっている。' },
      ]),
      K.sign(30, 36, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
    ],
    chests: [
      K.chest('caldera_c1', 11, 6, 'p_supply'),
      K.chest('caldera_c2', 40, 8, 'p_gold'),
    ],
    events: [
      ...[41, 42, 43, 44].map((x) => K.exam('caldera_spring', x, 20, { cond: C.clear })),
      ...[41, 42, 43, 44].map((x) => K.exam('caldera_spring_closed', x, 20, { cond: C.before })),
    ],
  };
  R.DB.maps.caldera = K.checkRows('caldera', def);
})(window.RPG);
