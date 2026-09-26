// 水辺の町ロッホ (loch): the port town of region 4 グレイモア湿原 (DESIGN §10.6.1, §10.8.5).
// Owner: reg-4 (R4). Theme `town_marsh` (§11.2.6: plank boardwalks, dark board walls), BGM `town`.
//
// Layout (56×44): a town of boardwalks on the east shore of the inner sea. The land road comes in
// over the east bridge (exit → world spawn `loch`); the quay and three piers are on the west (the
// ferry pier is the middle one, in line with the main street, spawn `dock`). A canal runs across
// the town from the sea to the pond by the boat shed.
//   north row : 宿屋 (inn) · 酒場 (tavern) · 鐘楼 (the bell tower, 鐘つきトビアス)
//   middle    : the main street · the fish market · the plaza with the statue of the witch Melda
//   south row : 道具屋 · 武器と防具の店 · エマの家 · the boat shed
//   south     : the fisher's, the weaver's and the old man's houses, the laundry yard, the monument
//               of the seven bells, the shore walk
//
// Contracts (other areas rely on these):
//   spawns  entrance (east gate, facing left) · inn (in front of the inn door, facing down)
//           dock (the ferry pier)
//   NPC ids inn · tavern · shop_item / shop_weapon / shop_armor · ferry (ferryFrom 'loch')
//           folk_a / folk_b (story_rumor loch_a / loch_b) · scribe (tier 4–6)
//           st_rival (inn +2 down) · st_fine (+2 down +2 right) · st_extra (+2 down +2 left), all up
//           tobias (鐘つきトビアス) · emma / emma_gate (母親エマ) · the children after the clear
//   events  onEnter loch_intro (§10.8.5 #1) · loch_tobias (+ loch_tobias_reward) · loch_emma_gate
(function (R) {
  'use strict';
  const K = R.Reg4;
  const C = K.C;
  const CLEAR = C.clear;
  const NOT_CLEAR = { notCleared: 'r_marsh' };

  const def = {
    name: '水辺の町ロッホ', type: 'town', theme: 'town_marsh', bgm: 'town',
    location: 'loch', region: 'r_marsh', outside: '~', respawnSpawn: 'inn',
    exit: { right: { to: 'world', spawn: 'loch' } },
    onEnter: 'loch_intro',
    decorLegend: { '|': 'boat', ':': 'net_rack', ',': 'rope_coil', '/': 'washtub', '-': 'cradle' },
    // @rows loch
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~..zzz,f,,,,,,,,,,,,ff,,zzz,,,,f,,,#######,,~~~~~~',
      '~~~~~~~..BBBBBBBBBBBBB,,BBBBBBBBBBBBBB,T,#######,T,~~~~~',
      '~~~~~~~..BBBBBBBBBBBBBT,BBBBBBBBBBBBBB,,,#_____#,,,z~~~~',
      '~~~~~~~..Bb_b______kuB,,Bo__o________B,,,#_____#,,,z~~~~',
      '~~~~~~~..Bb_b__ccc___B,,Bccccc_______B,,,#_____#,,,z~~~~',
      '~~~~~~~..B___________B,,B____________B,,,#_____#,,,,~~~~',
      '~~~~~~~..Bb_b_____ht_B,TB_hth___ht___B,ff#o___j#,,,T~~~~',
      '~~~~~~~..Bb_b_______oB,,B____________B,,,###D###T,,,~~~~',
      '~~~~~~~..B___________BffBo_____hto__oB,,,,,,,,,,,,,,~~~~',
      '~~~~~~~m.BBBBBBDBBBBBB,,BBBBBBDBBBBBBB,,,,,,,,,,,,T,~~~~',
      '~~~~~~~.............................................~~~~',
      '=======.............................................====',
      '=======.............................................====',
      '~~~~~~~..,,f,....,f,,,,,f,,,..,,,,,,,f,,..,f,f,,....~~~~',
      '~~~~~~~...........oo.T,f,........f,,,,T,..f,,,,,,,f,~~~~',
      '~~~~~~~..............,,W,...Y....,,f,,f,..,,T,,,,,,f~~~~',
      '~~~~~~~.o............,,,,........,,,,,,,..,~~~~,,T,,~~~~',
      '~~~~~~~.........j....,f,,........,f,T,,f..,~~~~z,,,,~~~~',
      '~~~~~~~||~~~~||~~~~~~~~~~~~~||~~~~~~~~~~||~~~~~z,,,,~~~~',
      '~~~~~~~||~~~~||~~~~~~~~~~~~~||~~~~~~~~~~||~~~~~z,,,,~~~~',
      '~~~~~~~....................................~~~~,,,,,~~~~',
      '~~~~~~~..BBBBBBBBB..BBBBBBBBBBBBB..BBBBBBBB,,,RRRRR~~~~~',
      '~~~~~~~..BBBBBBBBB..BBBBBBBBBBBBB..BBBBBBBB,,,RRRRR~~~~~',
      '~~~~~~~..Bu_____uB..B___________B..Bb_____B,,,RRRRR~~~~~',
      '~~=====..B__ccc__B..B_ccc___ccc_B..Bb_____B,,,BBBBB~~~~~',
      '~~~~~~~..B_______B..B___________B..B___th_B,,,,,,,,~~~~~',
      '~~~~~~~..Bpo_____B..B___________B..B______B,,,,,,,,,~~~~',
      '~~~~~~~..BBBBDBBBB..BBBBBBDBBBBBB..BBBDBBBB,,T,,,,,,~~~~',
      '~~~~~~~..........................................,T,~~~~',
      '~~~~~~~..........................................,,,~~~~',
      '~~~~~~~..BBBBBBBB..BBBBBBBBB,,,,,,.BBBBBBBB,,,,,,,,z~~~~',
      '~~~~~~~..BBBBBBBB..BBBBBBBBB,,,,,,.BBBBBBBB,,,,,,,,z~~~~',
      '~~~~~~~..Bb____uB..B_____kbB,,,,,,.Bk__u_bB,,,fYf,,,~~~~',
      '~~=====..Bb_____B..B______bB,,,,,,.B_____bB,,,f,f,,~~~~~',
      '~~~~~~~..B__hth_B..Bth_____B,,,,,,.B_ht___B,T,,,,,,~~~~~',
      '~~~~~~~..B_____oB..B_______B,T,,,,.B______B,,,,,,T,z~~~~',
      '~~~~~~~..BBBDBBBB..BBBBDBBBB,,,,,,.BBBDBBBB,,,,,,,zz~~~~',
      '~~~~~~~............................................~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........U..................................w.w..........',
      '...........w.p...k.w......H.H..w.p.w..........@.........',
      '..................................000...................',
      '........,.............h...........000...................',
      '..........................................,.............',
      '.............rr.....................N...................',
      '.............rr.........................................',
      '....................Z.................h.................',
      '.......................N................................',
      '....|......7................j.............h.............',
      '........................................................',
      '........................................................',
      '.|........3..........3..............3.........3.........',
      '................U..................h....................',
      '..........999...........................................',
      '.................q...h.....1.1......h...................',
      '.....................3.........ee...........|...........',
      '..................................|.....................',
      '...........|............................................',
      '........................................................',
      '........................................................',
      '...........$..w.k.....x.w.c.w.x......w.p.$..............',
      '........,............X.........Y.....-...K.........|....',
      '.........................rrr............................',
      '.....|.........&.........rrr............................',
      '.......N........Z....X.........Y.....&...y...:.:.:......',
      '........................................................',
      '............4...3.......5...6...3...........3...........',
      '........................................................',
      '.............................................h...h......',
      '...........w.[.w.....w.t.w...........w.P.w..............',
      '...|................!.?......(..(.......................',
      '........................................................',
      '.............................../........................',
      '.......,................&........%.......V..............',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
    ],
    // @end loch
    spawns: {
      entrance: { x: 50, y: 15, dir: 'left' },
      inn: { x: 15, y: 13, dir: 'down' },
      dock: { x: 5, y: 14, dir: 'right' },
    },
    // 記録院の立て札 (tier 1~, §10.9.1): a notice board by the east gate
    tilePatches: [{ cond: C.t1, x: 48, y: 17, ch: 'm' }],
    npcs: [
      // --- the east gate
      K.talk('gatekeeper', 'soldier', 49, 13, [
        { cond: C.post, text: '平和になったもんだ。\n朝の鐘を聞くと、\n門番でもあくびが出るよ。' },
        { cond: C.fog, text: '内海の霧が晴れて、\n西の沖に白い塔が\n見えるようになった。' },
        { cond: CLEAR, text: '霧が晴れて、湿原の道が\nよく見えるようになった。\n子どもたちも無事だしな。' },
        { cond: C.t4, text: '記録院の書記が、門を\n通るたびに「古い本は\nないか」と聞いてくるんだ。' },
        { text: '霧の中へ行くなら、\n気をつけな。子どもが三人、\n戻っていないんだ。' },
      ], { dir: 'down', fixed: true }),
      K.npc('emma_gate', 'woman', 47, 15, { dir: 'right', cond: '!marsh_start', event: 'loch_emma_gate', fixed: true }),
      K.npc('angry_gate', 'man', 47, 13, { dir: 'right', cond: '!marsh_start', event: 'loch_emma_gate', fixed: true }),
      // --- the plaza and the market
      K.npc('folk_a', 'man', 34, 18, { event: 'story_rumor', rumor: 'loch_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 12, 19, { event: 'story_rumor', rumor: 'loch_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 25, 19, '古い本はありませんか。\n記録院で、大切に保管\nいたします。',
        { cond: [C.t4, { tierBelow: 7 }], move: 'wander', push: true }),
      K.talk('hugo', 'man', 29, 17, [
        { cond: C.post, text: 'メルダさまの像を\n毎朝みがくのが、\nおれの仕事になった。' },
        { cond: CLEAR, text: '……おれは、メルダさまを\n疑っちまった。\fあとで館へ謝りに行くよ。\n花を持ってな。' },
        { cond: C.key, text: '霧が魔女の姿をまねている？\n……そんな話、\n信じられるもんか。' },
        { text: '霧の館の魔女のしわざだ！\n子どもたちを返せってんだ。\fこの像も、いっそ\n沼に沈めちまえばいい。' },
      ], { dir: 'down', push: true }),
      K.talk('fishmonger', 'fisher', 11, 17, [
        { cond: CLEAR, text: '霧が晴れたら、魚が\nどっさり上がるように\nなったよ。安くしとくよ！' },
        { text: '霧のせいで、舟が\nろくに出せなくてね。\n今日は干物しかないよ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('market_wife', 'woman', 13, 20, [
        { cond: CLEAR, text: '子どもたちが戻って、\n市場も明るくなったわ。\n朝の鐘って、いいわね。' },
        { cond: C.t6, text: '子守歌の続きが出てこないの。\nこの町の子守歌は、\n鐘の歌と同じ節なのに。' },
        { text: '子どもたちは、みんな\n家の中に閉じこめてるの。\n霧が出るとこわくって。' },
      ], { dir: 'up', push: true }),
      K.talk('old_boatman', 'old_man', 19, 20, [
        { cond: CLEAR, text: 'わしの若いころは、毎朝\n鐘が七つ鳴ったもんじゃ。\nまた聞けて、うれしいのう。' },
        { text: '水路の水が、年々にごって\nきおる。鐘が鳴らなく\nなってからじゃ。' },
      ], { dir: 'down', push: true }),
      K.talk('plaza_girl', 'girl', 31, 20, [
        { cond: C.post, text: 'きのう、トビアスじいちゃんに\n鐘の歌を教わったの。\nもう、ぜんぶ歌えるよ！' },
        { text: 'ニコたちが帰ってきたの！\nまた、いっしょに\n水路で舟あそびするんだ。' },
      ], { move: 'wander', push: true, cond: CLEAR }),
      // the children, back home after the clear (§10.8.5 NPC)
      K.talk('nico', 'boy', 38, 32, [
        { cond: C.post, text: 'ぼくね、大きくなったら\n鐘つきになるんだ！\nトビアスじいちゃんみたいな。' },
        { text: '霧の中でね、メルダさまの\nふりをした、こわいのが\nいたんだ。\fでも、鐘が鳴ったら、\nぱあっと明るくなって……\nお兄ちゃんたちが来たの！' },
      ], { cond: CLEAR, move: 'wander', push: true }),
      K.talk('lina', 'girl', 27, 19, [
        { text: 'メルダさまの像に、\nお花をあげてるの。\n助けてくれたお礼よ。' },
      ], { cond: CLEAR, dir: 'up', push: true }),
      K.talk('bram', 'boy', 22, 32, [
        { text: '霧の中は、寒くて、\nずっと鐘の音が聞きたい\nって思ってた。\fだから、あの音が聞こえた\nとき、泣いちゃったんだ。' },
      ], { cond: CLEAR, move: 'wander', push: true }),
      K.talk('cat', 'cat', 40, 14, 'ニャーオ。', { move: 'wander', push: true }),
      K.talk('dog', 'dog', 26, 32, 'ワン！　ワン！', { move: 'wander', push: true }),
      // --- the inn
      K.npc('inn', 'innkeeper', 16, 6, { event: 'common_inn', fixed: true }),
      K.talk('inn_guest', 'sailor', 18, 9, [
        { cond: CLEAR, text: '霧が晴れたから、明日の\n定期船で帰れそうだ。\n長い足止めだったよ。' },
        { cond: C.t4, text: '記録院のお触れの話で、\n宿の客はもちきりさ。\n物騒な世の中だねえ。' },
        { text: '霧で舟が出せなくて、\nもう五日もこの宿さ。\n懐が寒くなる一方だよ。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 13, 8, [
        { cond: CLEAR, text: '朝の鐘で目が覚めるって、\n気持ちがいいわね。\nゆっくりしていってね。' },
        { text: '泊まっていくなら、\n主人に声をかけてね。\n霧の夜は冷えるから。' },
      ], { move: 'wander', push: true }),
      // --- the tavern
      K.npc('tavern', 'bartender', 27, 6, { event: 'common_tavern', fixed: true }),
      K.npc('bard', 'bard', 35, 6, { event: 'loch_bard', fixed: true }),
      K.talk('drinker', 'man', 26, 9, [
        { cond: CLEAR, text: '鐘の音で目が覚めて、\n鐘の音で飲み始める。\nこれがロッホの暮らしさ！' },
        { text: '霧の館の魔女を、\n町のみんなで追い出そう\nって話も出てるんだ。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_fisher', 'fisher', 32, 9, [
        { cond: CLEAR, text: '沼の霧が晴れて、\n漁場が広がったよ。\n湿原の東は、いい魚がとれる。' },
        { cond: C.fog, text: '内海の霧も晴れたってな。\nビブリア島の塔が、\nここからでも見えるそうだ。' },
        { text: '鐘沈みの沼には、\n七つの鐘が沈んでる\nって言い伝えがあってな。' },
      ], { dir: 'right', push: true }),
      K.talk('waitress', 'woman', 30, 8, [
        { cond: CLEAR, text: 'マスターに言えば、\n旅の仲間を紹介して\nくれるわよ。' },
        { text: 'いらっしゃい！\n霧の日は、みんな昼から\nここに集まっちゃうのよ。' },
      ], { move: 'wander', push: true }),
      // --- the bell tower
      K.npc('bell', 'obj:loch_bell', 44, 6, { cond: NOT_CLEAR, fixed: true, text: '鐘楼の鐘だ。\n長いあいだ鳴らされていない\nのか、緑のさびが浮いている。' }),
      K.npc('bell_ring', 'obj:loch_bell_ring', 44, 6, { cond: CLEAR, fixed: true, text: '毎朝、トビアスが\n鳴らしている鐘だ。\nよくみがかれている。' }),
      K.npc('tobias', 'old_man', 45, 8, { event: 'loch_tobias', dir: 'left', fixed: true }),
      // --- the shops
      K.npc('shop_item', 'merchant', 13, 26, { event: 'common_shop', shop: 'loch_item', fixed: true }),
      K.npc('shop_weapon', 'dwarf', 23, 26, { event: 'common_shop', shop: 'loch_weapon', fixed: true }),
      K.npc('shop_armor', 'merchant', 29, 26, { event: 'common_shop', shop: 'loch_armor', fixed: true }),
      K.talk('smith_customer', 'man', 26, 29, [
        { cond: CLEAR, text: '霧が晴れたら、\n鎧の手入れが楽になったよ。\nさびなくなったからな。' },
        { text: '湿原じゃ、剣も鎧も\nすぐさびる。油を\n切らさないことだ。' },
      ], { dir: 'up', push: true }),
      // --- homes
      K.talk('emma', 'woman', 38, 27, [
        { cond: C.post, text: 'ニコったら、毎朝\n鐘楼に通っているの。\n鐘つきになるんですって。' },
        { cond: CLEAR, text: 'ニコが帰ってきたの！\n本当に、ありがとう。\fあの子ったら、霧の中で\nきれいな鐘の音を聞いた、\nって言うのよ。' },
        { cond: C.key, text: '沼の鐘を鳴らせば、\n霧が晴れるの……？\nお願い、ニコを……。' },
        { cond: C.mid, text: '館の魔女が、子どもを\nさらったんじゃないの……？\nじゃあ、いったい誰が……。' },
        { text: 'ニコは、霧の出た朝に\n水路のそばで遊んでいたの。\n目を離したすきに……。' },
      ], { cond: { any: ['marsh_start', CLEAR] }, dir: 'down', push: true }),
      K.talk('nico_home', 'boy', 37, 28, [
        { cond: C.post, text: '鐘つきの練習をしてるんだ。\nゴーン、ゴーン！' },
        { text: 'お母さん、もう泣いてないよ。\nぼくが帰ってきたから！' },
      ], { cond: CLEAR, dir: 'up', push: true }),
      K.talk('fisher_wife', 'woman', 12, 37, [
        { cond: CLEAR, text: '夫が、久しぶりに\n沼の向こうまで舟を出したの。\n霧が晴れたおかげよ。' },
        { text: '霧が出ると、うちの子を\n外に出さないようにしてるの。\nかわいそうだけど……。' },
      ], { dir: 'right', push: true }),
      K.talk('fisher_girl', 'girl', 14, 36, [
        { cond: CLEAR, text: 'もう外で遊んでいいって！\nやったあ！' },
        { text: 'お外で遊びたいなあ。\nでも霧が出てるから、\nだめなんだって。' },
      ], { move: 'wander', push: true }),
      K.talk('weaver', 'old_woman', 23, 36, [
        { cond: C.post, text: '鐘の歌を、布に\n織りこんでいるのさ。\n忘れないようにね。' },
        { cond: CLEAR, text: '鐘の歌、思い出したよ。\n「鳴れよ七つの鐘」……\nそう、そういう歌さ。' },
        { cond: C.t6, text: '子守歌の続きが出てこない。\n鐘の歌も、子守歌も、\nみんな白くなっていくよ。' },
        { text: '昔は、機を織りながら\n鐘の歌を歌ったもんさ。\nでも、節しか出てこない。' },
      ], { dir: 'down', push: true }),
      K.talk('old_man', 'elder', 37, 36, [
        { cond: CLEAR, text: 'メルダさまは、霧を封じて\n町を守ってくださった。\nそれを忘れておったとは……。' },
        { cond: C.mid, text: '館で、メルダさまの幽霊に\n会った？　……わしの\n祖父も、会ったと言っておった。' },
        { text: '沼の霧から魔物が\nあふれた昔話を、\n聞いたことがあるかね。\f魔女のメルダさまが、\n七つの鐘を鋳て沈め、\n霧を封じたそうじゃ。' },
      ], { dir: 'down', push: true }),
      K.talk('laundry_woman', 'woman', 31, 36, [
        { cond: CLEAR, text: 'お日さまが出て、\n洗濯物がよく乾くの！\n霧の町とは思えないわ。' },
        { text: '霧のせいで、洗濯物が\nちっとも乾かないのよ。\nじめじめして、いやねえ。' },
      ], { move: 'wander', push: true }),
      // --- the quay and the piers
      K.npc('ferry', 'sailor', 2, 15, { event: 'common_ferry', ferryFrom: 'loch', dir: 'right', fixed: true }),
      K.talk('pier_fisher', 'fisher', 5, 27, [
        { cond: CLEAR, text: '霧が晴れて、内海の\n向こうまで見わたせる。\nいい釣り日よりだ。' },
        { text: '霧が濃くて、うきが\n見えやしない。\n……今日も坊主だな。' },
      ], { dir: 'left', push: true }),
      K.talk('pier_boy', 'boy', 5, 36, [
        { cond: CLEAR, text: 'ぼくの友だちが、\n霧の中から帰ってきたんだ！\nまた釣りに行くんだ。' },
        { text: '友だちのニコが、\n霧の中でいなくなっちゃった。\n……早く帰ってこないかな。' },
      ], { dir: 'left', push: true }),
      K.talk('quay_sailor', 'sailor', 8, 22, [
        { cond: CLEAR, text: '定期船は真ん中の桟橋だ。\nファロスにもコーラルにも\n行けるぜ。' },
        { text: '定期船なら、真ん中の\n桟橋から出ているぜ。\n霧の日でも、船は出すさ。' },
      ], { dir: 'down', push: true }),
      // --- the scene frames of story_after_clear (§10.8.0-7): inn +2 down, all facing up
      K.npc('st_rival', 'rowell', 15, 15, { dir: 'up', cond: 'st_show_rival', fixed: true }),
      K.npc('st_fine', 'fine', 17, 15, { dir: 'up', cond: 'st_show_fine', fixed: true }),
      K.npc('st_extra', 'scribe', 13, 15, { dir: 'up', cond: 'st_show_extra', fixed: true }),
    ],
    signs: [
      K.sign(28, 18, [
        { cond: CLEAR, text: '魔女メルダの像。\n足もとに、たくさんの花が\n供えられている。' },
        { text: '魔女メルダの像。\n泥が投げつけられて、\n顔がよごれている……。' },
      ]),
      K.sign(47, 35, '七つの鐘の碑\f「沼より霧のあふれし年、\n魔女メルダ、七つの鐘を鋳て\n沼に沈め、霧を封ず」'),
      K.sign(48, 17, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
      K.sign(7, 12, '定期船乗り場\nファロス・コーラル行き'),
    ],
    chests: [
      K.chest('loch_c1', 45, 9, 'p_supply'),
      K.chest('loch_c2', 40, 38, 'p_gold'),
    ],
    events: [],
  };
  R.DB.maps.loch = def;
  if (R.onData) R.onData(() => K.checkRows('loch', def));
})(window.RPG);
