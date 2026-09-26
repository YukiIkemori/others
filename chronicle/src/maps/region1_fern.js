// 森の村フェルン (fern): the village of region 1 ヴェルダの森 (DESIGN §10.8.2, §10.6.1, §10.8.0).
// Owner: R1 (reg1). Theme `town_forest` (§11.2.6: mossy dirt, log walls, green shingles), BGM `village`.
//
// Layout (54×44): a clearing inside a log palisade; the only gate is in the south (exit → world
// spawn `fern`). A stream comes in from the north and bends east; two rope bridges and a third
// one over the bend link the west bank (the village proper) with the east bank.
//   west, north row : 宿屋「木漏れ日亭」 · 酒場「切り株亭」, the plaza with the well below them, the herb garden
//   west, middle row: 道具屋 · 武器と防具の店 · the vegetable garden
//   west, south row : ダンの家 · 木こり小屋 · the woodshed, the gate
//   east bank       : the song stone (千年樹の歌の碑) · 長老ハンナの家 · the grove · the sheep pen
//   south-east      : リタの家 on a wooden deck among great trunks (the tree-house)
//
// Contracts (§10.8.0-7/8, §10.6.1, §10.9.5, §10.13.10):
//   spawns  entrance (inside the gate, facing up) · inn (in front of the inn door, facing down)
//   NPCs    inn · tavern · shop_item / shop_weapon / shop_armor · folk_a / folk_b (fern_a / fern_b)
//           scribe (tier 4–6) · st_rival / st_fine / st_extra (2 below `inn`, ±2) · hanna · rita · dan
//   events  onEnter fern_enter (→ fern_intro once) · fern_hanna · fern_rita (talk)
(function (R) {
  'use strict';
  const K = R.Reg1;
  const C = K.C;
  const INN = { x: 9, y: 12 };
  const HANNA_HOME = { any: ['forest_start', 'forest_boss'] };

  const def = {
    name: '森の村フェルン', type: 'town', theme: 'town_forest', bgm: 'village',
    location: 'fern', region: 'r_forest', outside: 'T', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'fern' },
    onEnter: 'fern_enter',
    // @rows fern
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTTTTTTTTTT',
      'TT###############################~~~################TT',
      'TT#T,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~~TT,,,,,,,,TTTTT#TT',
      'TT#,BBBBBBBBBBBBTTBBBBBBBBBBBBBT,~~~T,,,,,,,,,TTTTT#TT',
      'TT#,BBBBBBBBBBBB,,BBBBBBBBBBBBB,T~~~,,,,::Q::,,TTTT#TT',
      'TT#,Bb_b_____u_B,,B_________ooBT,~~~,,,,:::::,,,TT,#TT',
      'TT#,Bb_b__ccc__B,,Bcccc_______B,,~~~,,,,:::::,,,,,,#TT',
      'TT#,B__________BT,B______t__t_B,,~~~,,,,:::::,,,,,,#TT',
      'TT#,Bb_______t_B,,B___t_______B::===::::::::,,,,,,,#TT',
      'TT#,Bb_________B,TB___________B::~~~,,,,,,,,,,,,,,,#TT',
      'TT#,BBBBBDBBBBBB,,BBBBBBDBBBBBB::~~~,,BBBBBBBBBBTTT#TT',
      'TT#,:::::::::::::::::::::::::::::~~~,,BBBBBBBBBBTTT#TT',
      'TT#,:::::::::::::::::::::::::::::~~~,,Bk_k___bbB,TT#TT',
      'TT#,,,,,,,,,,,::::::::::::::::,,,~~~,,B______bbBTTT#TT',
      'TT#,FFFFFFFF,T::::::::::::::::,,,~~~,,B____t___B,,,#TT',
      'TT#,F,,,,,,F,,::::::::W:::::::,,,~~~,,B________B,,,#TT',
      'TT#,F,,,,,,F,,::::::::::::::::,,,~~~,,BBBBDBBBBB,,,#TT',
      'TT#TFFF,FFFF,,:::::::::::::::::::~~~,,,,,,:,,,,,,,,#TT',
      'TT#T,,,,,,,,T,,,,,,,,,,,,,::,::::~~~,,,,,,:,,,FFFFF#TT',
      'TT#,BBBBBBBB,,BBBBBBBBBBBB::,,,::===:::::::::,F,,,F#TT',
      'TT#,BBBBBBBB,,BBBBBBBBBBBB:TFFFFF~~~,,,,,,,,:,F,,,F#TT',
      'TT#,B_____uB,,B__________B::F,,,F~~~TTT,,,,,:,FF,FF#TT',
      'TT#,Bccc___BT,Bccc____cccB::F,,,F~~~TT,,,,,,:,,,,,,#TT',
      'TT#,B______B,,B__________B::FF,FF~~~,,,,,,,,:,,,,,,#TT',
      'TT#TB______B,TB__________B::,,,,,~~~~~~~~~~~|~~~~~~~~~',
      'TT#,BBBDBBBB,,BBBBBDBBBBBB::,,,,,~~~~~~~~~~~|~~~~~~~~~',
      'TT#,:::::::::::::::::::::::::::::~~~~~~~~~~~|~~~~~~~~~',
      'TT#,:::::::::::::::::::::::::::::,,,FFFFFFFF_FFFFFF#TT',
      'TT#,,,,,,,,,,,,,,,,,,,,,,,::,,,,,,,,FloBBBBBBBBB__l#TT',
      'TT#,BBBBBBBBB,BBBBBBBBBB,,::RRRRRT,,Fl_BBBBBBBBB__l#TT',
      'TT#,BBBBBBBBB,BBBBBBBBBB,,::RRRRR,,,F__Bb______B___#TT',
      'TT#,Bb_b____B,B________BT,::RRRRR,T,F__Bb___t__B___#TT',
      'TT#,Bb_b__t_BTB________B,,::BBBBB,,,Fj_B_______B_o_#TT',
      'TT#,B_______B,Bb_______B,,::BBBBB,,,Fo_BBBBDBBBB___#TT',
      'TT#TB_______B,Bb_____o_B,T::,,,,,,,,_______________#TT',
      'TT#,BBBBDBBBB,BBBBDBBBBB,,::,,,,,T,,_______________#TT',
      'TT#,:::::::::::::::::::::::::::::,,,Fl____________l#TT',
      'TT#,:::::::::::::::::::::::::::::,,,Fl___________jl#TT',
      'TT#T,,,,,,,,,,,,,,,,,,,,,,::,,,T,,,,FFFFFFFFFFFFFFF#TT',
      'TT#,T,,,,,,,,,,,,,,,,,T,,,::,,,,T,,,,,,,,,,,,,,,,,,#TT',
      'TT#######################::::#######################TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTT::::TTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTT::::TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    decor: [
      '......................................................',
      '......................................................',
      '......................................................',
      '......................................................',
      '........................................11.11.........',
      '.....w.$.k..w.$....HH...w...p.........f.1...1.........',
      '..............y...........00..........................',
      '..........................00.........*................',
      '......&&................n....n.................*......',
      '......&&....n.n......n.......................e.f......',
      '..............Z....N.........Z........................',
      '......................................................',
      '...h........7..........j...............$.w..w.$.......',
      '......................................................',
      '..............1........e....1...............n.........',
      '........................................&&....!.......',
      '.....f1f.f1....3.............................Z........',
      '.....1f1.1f......................................*....',
      '..............1......e......1................h........',
      '.....h...h.....h....f...............3.h...............',
      '...............................................s.M....',
      '.....$.w.$.....x..w..w..m.......................s.....',
      '...................XY........1M1......................',
      '.............................111......................',
      '.......&..q.......&&.....3............................',
      '.......&..........&&..O...............................',
      '......................................................',
      '.........4.......5...6................................',
      '......................................................',
      '...*..................f%.............~................',
      '.............#..........#.............Z.w..$..w...~...',
      '.....w..$..w...x..w..w.$.e....................?.......',
      '...........K...F...........................n.....Z....',
      '.........n.......LLLL......#..........1..&&...........',
      '......&&...?.....nn.n............E......w.w...w$U.....',
      '.................................................f....',
      '............................3.........M.........e.....',
      '............(...........%......#........Z..f.(....~...',
      '....h........f................%...h..~.f.......1......',
      '......................................................',
      '............................].........................',
      '......................................................',
      '......................................................',
      '......................................................',
    ],
    // @end fern
    spawns: {
      entrance: { x: 26, y: 40, dir: 'up' },
      inn: { x: INN.x, y: INN.y, dir: 'down' },
    },
    // 記録院の立て札 (tier 1~, §10.9.1 / §10.9.5): a notice board appears beside the gate road
    tilePatches: [{ cond: C.t1, x: 24, y: 39, ch: 'm' }],
    npcs: [
      // --- the scene slots for story_after_clear (§10.8.0-7): shown only by the story's flags
      K.npc('st_rival', 'rowell', INN.x, INN.y + 2, { dir: 'up', cond: 'st_show_rival', fixed: true, text: '……' }),
      K.npc('st_fine', 'fine', INN.x + 2, INN.y + 2, { dir: 'up', cond: 'st_show_fine', fixed: true, text: '……' }),
      K.npc('st_extra', 'scribe', INN.x - 2, INN.y + 2, { dir: 'up', cond: 'st_show_extra', fixed: true, text: '……' }),

      // --- the gate: 長老ハンナ waits here on the first visit (fern_intro)
      K.npc('hanna_gate', 'old_woman', 26, 38, { dir: 'down', cond: ['!forest_start', '!forest_boss'], fixed: true, event: 'fern_intro' }),
      K.talk('watchman', 'man', 24, 40, [
        { cond: C.post, text: '森の魔物も、近ごろは\nおとなしいもんだ。\n門番は、ひなたぼっこさ。' },
        { cond: C.fog, text: '東の内海の霧が晴れたって、\n旅の人が話してたよ。\n世の中、動いてるねえ。' },
        { cond: C.clear, text: '森が静かになった。\n見張りも、少しは\n楽ができそうだ。' },
        { text: '森の魔物が、村の近くまで\n出るようになった。\n見張りが欠かせないよ。' },
      ], { dir: 'right', fixed: true }),

      // --- the plaza and the lanes
      K.npc('folk_a', 'man', 18, 15, { event: 'story_rumor', rumor: 'fern_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 24, 17, { event: 'story_rumor', rumor: 'fern_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 20, 14, '古い本はありませんか。\n記録院で、大切に保管\nいたします。',
        { cond: C.scribes, move: 'wander', push: true }),
      K.talk('plaza_girl', 'girl', 16, 17, [
        { cond: C.post, text: 'リタお姉ちゃんがね、\n新しい歌を作ってるの。\n語り部さんの歌だって！' },
        { cond: C.clear, text: 'リタお姉ちゃんの歌、\n最後まで聞けたよ！\nとってもきれいだった！' },
        { text: 'リタお姉ちゃんの歌、\nいつも途中で止まっちゃうの。\n続きを忘れたんだって。' },
      ], { move: 'wander', push: true }),
      K.talk('plaza_boy', 'boy', 28, 15, [
        { cond: C.clear, text: '大きくなったら、\n父ちゃんみたいな\n木こりになるんだ！' },
        { text: '森の中は、道が勝手に\n動くんだって。\n……こわいよね。' },
      ], { move: 'wander', push: true }),
      K.talk('dog', 'dog', 21, 18, 'ワン！　ワンワン！', { move: 'wander', push: true }),
      K.talk('herbalist', 'old_man', 8, 17, [
        { cond: C.post, text: '光るキノコの薬で、\n村の年寄りも元気じゃ。\nわしも、まだまだ現役よ。' },
        { cond: C.clear, text: '千年樹の根元に生える\n光るキノコは、よい薬に\nなるんじゃ。\f森の主さまの、\nおすそ分けじゃな。' },
        { text: '森のキノコは、よい薬になる。\nじゃが、今は森の奥へ\n入れんでな……。' },
      ], { dir: 'left', push: true }),

      // --- the inn 木漏れ日亭
      K.npc('inn', 'innkeeper', 11, 6, { event: 'common_inn', greet: 'ようこそ、木漏れ日亭へ。', fixed: true }),
      K.talk('inn_guest', 'merchant', 12, 10, [
        { cond: C.post, text: '森の道を通って、\n西の港まで行けるんだ。\n商いがはかどるよ。' },
        { cond: C.t4, text: '記録院のお触れを聞いたかい？\n古い本を持っていると、\nにらまれるそうだ。\f商人も、帳面の扱いには\n気をつけないとね。' },
        { cond: C.clear, text: '森の道が、元に戻ったそうだ。\nやっと荷を運べるよ。' },
        { text: '森を抜けて、商いに\n行くつもりだったんだが、\n道が毎日変わるんだとさ。\fしかたなく、ここで\n足止めを食っているよ。' },
      ], { dir: 'up', push: true }),
      K.talk('inn_maid', 'woman', 7, 8, [
        { cond: C.clear, text: '祭りのお客さんで、\n宿は大にぎわいよ！\nゆっくりしていってね。' },
        { text: '疲れたら、主人に\n声をかけてね。\n森の夜は冷えるから。' },
      ], { move: 'wander', push: true }),

      // --- the tavern 切り株亭
      K.npc('tavern', 'bartender', 20, 6, { event: 'common_tavern', greet: 'いらっしゃい。\n切り株亭へようこそ。', fixed: true }),
      K.talk('bard', 'bard', 26, 6, [
        { cond: C.post, text: '語り部さんの旅を、\n歌にしてみたんだ。\nいつか聞いておくれよ。' },
        { cond: C.clear, text: 'リタの歌を聞いたかい？\nあれこそ、この森の歌さ。\n吟遊詩人も、かなわないよ。' },
        { text: '千年樹の歌？\n……おれも探しているんだ。\n吟遊詩人の名折れだよ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('tavern_old', 'old_man', 21, 9, [
        { cond: C.fog, text: '内海の霧が晴れたそうじゃな。\n長生きはするもんじゃ。' },
        { cond: C.clear, text: '今年は夏至の祭りを開くぞ！\n千年樹の歌は、リタが\n歌ってくれるそうじゃ。' },
        { text: '夏至の祭りも、ここ何年か\n開かれておらん。\n歌える者がおらんのじゃ。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_wife', 'woman', 24, 8, [
        { cond: C.clear, text: 'うちの人も、無事に\n帰ってきたのよ。\n今夜は飲ませてあげるわ。' },
        { cond: 'forest_dan', text: 'ダンさんは帰ってきたのに、\nうちの人は、まだ……。\nどうか、無事でいて。' },
        { text: 'うちの人も木こりなの。\n森へ入ったきり、\n三日も帰ってこないのよ。' },
      ], { dir: 'down', push: true }),
      K.talk('waitress', 'girl', 27, 9, [
        { cond: C.clear, text: '祭りの支度で大忙し！\nお料理、たくさん作らなきゃ。' },
        { text: '木こりさんたちが帰らなくて、\nお店もさみしいの。' },
      ], { move: 'wander', push: true }),

      // --- the shops
      K.npc('shop_item', 'merchant', 6, 22, { event: 'common_shop', shop: 'fern_item', fixed: true }),
      K.npc('shop_weapon', 'dwarf', 16, 22, { event: 'common_shop', shop: 'fern_weapon', fixed: true }),
      K.npc('shop_armor', 'woman', 23, 22, { event: 'common_shop', shop: 'fern_armor', fixed: true }),
      K.talk('shop_boy', 'boy', 20, 24, [
        { cond: C.clear, text: '親方がね、森の道が戻ったら\n新しい弓を仕入れるって！' },
        { text: '森の狩人は、弓と短剣を\n持ち歩くんだ。\n槍は、つるに引っかかるからね。' },
      ], { move: 'wander', push: true }),

      // --- the garden
      K.talk('farmer', 'farmer', 31, 23, [
        { cond: C.clear, text: '見てくれ、この豆のつる！\n森が元気になったら、\n畑も元気になった。' },
        { text: '畑の作物が、ちっとも\n育たないんだ。\n森に元気がないせいかね。' },
      ], { dir: 'left', push: true }),
      K.talk('chicken_a', 'chicken', 29, 23, 'コッコッ。', { move: 'wander', push: true }),
      K.talk('chicken_b', 'chicken', 30, 22, 'コケーッ！', { move: 'wander', push: true }),

      // --- ダンの家 (the woodcutter's family)
      K.talk('dan_wife', 'woman', 9, 34, [
        { cond: C.post, text: 'あの人、森の主さまの話ばかり\nするのよ。\nもう、何べん聞いたかしら。' },
        { cond: C.clear, text: 'あの人ったら、帰るなり\n寝てばかりなのよ。\n……でも、よかった。' },
        { cond: 'forest_dan', text: '夫は帰ってきたけど、\nまた森へ行くって言うの。\n仲間を置いてはおけないって。' },
        { text: '夫のダンが、森から\n戻らないんです。\n……もう、三日になります。' },
      ], { dir: 'down', push: true }),
      K.talk('dan_kid', 'boy', 6, 35, [
        { cond: C.clear, text: '父ちゃんがね、森の主さまの\n話をしてくれたんだ！\n光る人なんだって！' },
        { cond: 'forest_dan', text: '父ちゃん、帰ってきた！\nでも、またすぐ森へ\n行っちゃうんだって。' },
        { text: '父ちゃん、いつ帰ってくるの？\nぼく、いい子にして\n待ってるのに。' },
      ], { move: 'wander', push: true }),
      K.talk('dan', 'man', 10, 35, [
        { cond: C.post, text: 'また森で迷ったら、\nあんたの年代記を\n読み返すとするよ。' },
        { text: '仲間の木こりたちも、\nみんな帰ってきた！\n{hero}、本当にありがとうな。\f森の中で、歌が聞こえたんだ。\nそしたら、帰り道が\nふっと見えてな。' },
      ], { dir: 'left', cond: C.clear, push: true }),

      // --- the woodcutters' lodge
      K.talk('dan_lodge', 'man', 18, 34, [
        { cond: 'forest_mid', text: 'あの羽虫を倒したって？\nたいしたもんだ！\f奥の道は、つるで\nふさがれてるんだろう？\n歌の石が、関わってるのかもな。' },
        { text: '助かったぜ、{hero}。\nあの羽虫がいる限り、\n仲間を探しに行けねえ。\f迷いの森の奥のほうだ。\n気をつけてな。' },
      ], { dir: 'down', cond: ['forest_dan', C.before], push: true }),
      K.talk('foreman', 'dwarf', 20, 32, [
        { cond: C.clear, text: '若い連中も、みんな\n無事に帰ってきた。\nあんたのおかげだ。' },
        { text: '親方のおれがこのざまだ。\n足をくじいて、森へ\n探しに行けねえ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('cutter_a', 'farmer', 17, 34, '千年樹の根元で、光る人を\n見たんだ。\n……夢だったのかな。', { dir: 'up', cond: C.clear, push: true }),
      K.talk('cutter_b', 'man', 20, 34, '三日も森をさまよって、\n腹ぺこだよ。\nさあ、飲むぞ！', { dir: 'up', cond: C.clear, push: true }),
      K.talk('lodge_wife', 'woman', 21, 34, 'うちの人も、木こりなの。\nまだ森の中……。\nみんなで、ここで待ってるの。', { dir: 'up', cond: C.before, push: true }),

      // --- the east bank: the song stone, 長老ハンナ
      K.npc('hanna', 'old_woman', 44, 15, { event: 'fern_hanna', cond: HANNA_HOME, dir: 'down', fixed: true }),
      K.talk('hanna_cat', 'cat', 46, 16, 'ニャア。', { move: 'wander', push: true }),
      K.talk('sheep_a', 'sheep', 48, 21, 'メエエ……。', { move: 'wander', push: true }),
      K.talk('sheep_b', 'sheep', 49, 20, 'メエ。', { move: 'wander', push: true }),
      K.talk('stone_keeper', 'elder', 44, 7, [
        { cond: C.post, text: '夏至の祭りの夜には、\n村じゅうで歌うのじゃ。\n千年樹まで届くようにな。' },
        { cond: C.clear, text: 'この碑の文字を、\n彫り直しておるのじゃ。\n二度と忘れぬようにな。' },
        { text: 'この碑には、千年樹の歌が\n刻まれておった。\nじゃが、今は読めん。\f文字が、白くかすれて\nしまったのじゃ。\n……いつの間にかのう。' },
      ], { dir: 'left', push: true }),
      K.talk('dancer_a', 'dancer', 40, 7, 'ランラン、ララン♪\n今夜は夏至の祭りよ！', { cond: C.clear, move: 'wander', push: true }),
      K.talk('fest_lamp_a', 'decor:lamp', 39, 5, '祭りの灯りがともっている。', { cond: C.clear, fixed: true }),
      K.talk('fest_lamp_b', 'decor:lamp', 45, 5, '祭りの灯りがともっている。', { cond: C.clear, fixed: true }),

      // --- リタの家 on the deck
      K.npc('rita', 'girl', 42, 36, { event: 'fern_rita', dir: 'down', fixed: true }),
      K.talk('rita_father', 'man', 45, 32, [
        { cond: C.clear, text: '娘の歌を聞いたかい？\n亡くなったおふくろに、\nそっくりの声なんだ。' },
        { text: 'おふくろは、村いちばんの\n歌い手だった。\nリタは、その声を継いだんだ。\fだが、歌の続きを\n誰も覚えていない。\n……おふくろも、もういない。' },
      ], { dir: 'down', push: true }),
    ],
    signs: [
      K.sign(42, 5, [
        { cond: C.clear, text: '千年樹の歌の碑。\n♪　眠れ森の主、千の年輪に\n♪　約束の歌を、葉ずれに乗せて\n♪　火の夜を忘れず、緑を守れ' },
        { text: '千年樹の歌の碑だ。\n文字の下半分が、白く\nかすれて読めない……。' },
      ]),
      K.sign(24, 39, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
    ],
    chests: [
      K.chest('fern_c1', 16, 32, 'p_supply'),
      K.chest('fern_c2', 49, 30, 'p_gold'),
    ],
    events: [],
  };
  R.DB.maps.fern = K.checkRows('fern', def);
})(window.RPG);
