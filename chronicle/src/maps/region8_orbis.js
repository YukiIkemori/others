// 学術都市オルビス (orbis): the town of region 8 r_star オルビス高原 (DESIGN §10.6.1, §10.8.9, §11.2.6).
// Owner: R8 reg8. Theme `town_star` (diamond paving, marble walls, navy roofs), BGM `town`.
//
// Layout (56×44): a walled university town on the plateau. The south gate (spawn `entrance`)
// and a small west gate lead out to the world (`orbis`). Every building is roofless (§10.6.1):
//   north row  : 宿屋「星明かり亭」, 酒場「星見の杯亭」, 学院 (学長オクタヴィアの学舎)
//   middle row : 図書館 (the 書見台 with the old star chart at the back), 噴水の広場, 天文台
//   south row  : 道具屋, 武器と防具の店, 学院の術具店, 記録院の出張所, アルカナ帰りの老魔術師の家
//
// Contracts (other areas rely on these):
//   spawns  entrance (south gate, up) · inn (in front of the inn door, down)
//   NPC ids inn · tavern · shop_item / shop_weapon / shop_armor / shop_magic · folk_a / folk_b
//           (story_rumor orbis_a / orbis_b) · scribe (tier 4–6) · st_rival / st_fine / st_extra
//           (§10.8.0-7: inn + (0,2) / (+2,2) / (−2,2), facing up) · luca · luca_gate · octavia · arcana_mage
//   events  onEnter orbis_intro · examine orbis_library_chart (pedestal) · orbis_telescope
(function (R) {
  'use strict';
  const K = R.Reg8;
  const C = K.C;
  const CL = C.clear;

  const def = {
    name: '学術都市オルビス', type: 'town', theme: 'town_star', bgm: 'town',
    location: 'orbis', region: 'r_star', outside: 'T', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'orbis' },
    onEnter: 'orbis_intro',
    decorLegend: { '|': 'telescope', ':': 'astrolabe' },
    // @rows orbis
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT####i#######i#######i##########i#######i#######i####TT',
      'TT#..................................................#TT',
      'TT#.BBBBBBBBBBB..BBBBBBBBBBBBBB..BBBBBBBBBBBBBBBBBBBj#TT',
      'TT#.BBBBBBBBBBBo.BBBBBBBBBBBBBBo.BBBBBBBBBBBBBBBBBBBo#TT',
      'TT#.Bb_b______Bj.Bo___o_______B..Bkk+k+k+++++k+k+kkB.#TT',
      'TT#.Bb_b__ccc_B..B_cccc_______B..B+++++++++++++++++B.#TT',
      'TT#.B_________B..B___________oB..B+++++++++++++++++B.#TT',
      'TTi.Bb_b______B..B_hth___hth__B..B++t++t+++++t++t++B.iTT',
      'TT#.Bb_b___t__B..B____________B..B++h++h+++++h++h++B.#TT',
      'TT#.B_________B..Bo____hth____B.oB+++++++++++++++++B.#TT',
      ',,#.BBBBBDBBBBB..BBBBBBDBBBBBBB..BBBBBBBBBDBBBBBBBBB.#TT',
      '.....................................................#TT',
      '.....................................................#TT',
      '.....................................................#TT',
      ',,#..................................................#TT',
      'TT#.BBBBBBBBBBBBBB.T............T.BBBBBBBBBBBBBBBBBB.#TT',
      'TT#.BBBBBBBBBBBBBBo...............BBBBBBBBBBBBBBBBBB.#TT',
      'TT#.Bkkk__C___kkkB................Bkk__________kk_kB.#TT',
      'TT#.B____________B................B________________B.#TT',
      'TT#.Bkk_kk__kk_kkB................B________________B.#TT',
      'TT#.B____________B................B________________B.#TT',
      'TTi.B__________kkB................B________________B.iTT',
      'TT#.B____________B................B__t__________t__B.#TT',
      'TT#.Bccc______t__B................B__h__________h__B.#TT',
      'TT#.B_________h__B...............jBj______________oB.#TT',
      'TT#.BBBBBBDBBBBBBB.T............T.BBBBBBBBDBBBBBBBBB.#TT',
      'TT#..................................................#TT',
      'TT#..................................................#TT',
      'TT#..................................................#TT',
      'TTi.BBBBBBBB.BBBBBBBBBBB......BBBBBBBB.BBBBBB.BBBBBB.iTT',
      'TT#.BBBBBBBB.BBBBBBBBBBB......BBBBBBBB.BBBBBB.BBBBBB.#TT',
      'TT#.Bu____uB.B_________B......Bk____kB.Bk__kB.Bb___B.#TT',
      'TT#.Bccccc_B.Bccc___cccB......Bcccc__B.Bcc__B.Bb___B.#TT',
      'TT#.B______B.B_________B......B______B.B____B.B____B.#TT',
      'TT#.B______B.B_________B......B______B.B____B.B_t__B.#TT',
      'TT#.Bo_____B.B_________B......B______B.B____B.B_h__B.#TT',
      'TTi.B_____oBjBo_______oB......B_____pBoBj___BjB____B.iTT',
      'TT#.BBBBDBBB.BBBBBDBBBBB......BBBDBBBB.BBDBBB.BBDBBB.#TT',
      'TT#..................................................#TT',
      'TT#..................................................#TT',
      'TT########################....########################TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTT,....,TTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTT,....,TTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    decor: [
      '........................................................',
      '..........B.......B.........B........B.......B..........',
      '........................................................',
      '........................................................',
      '.....w...i...w.....H.H.H.i.w..H.....[..w.p.c.w..[.......',
      '........y...................00..........................',
      '............................00.........I..D..I..........',
      '.........................................RRR............',
      '.........&.h.............................RRR............',
      '.............Z....N...............Z......RRR......Z.....',
      '.............................Z..........................',
      '........................................................',
      '...31.......71.1........j....1.13...........]......1....',
      '........................................................',
      '........................................................',
      '.....3..1...1...3....3..h..h....3.....1..h..3...1...3...',
      '........................................................',
      '.....}.}.w.w.}.}...:.1.3....3.1.:...[.w.[.W.[.w.[.......',
      '.....................................{......{....{......',
      '..........RR........e..f...f...e.......{.RRRRR.I........',
      '...h......RR............JJJ..............RR|RR......h...',
      '..........RR.{.....1....JJJ.....1.....D..RRRRR..........',
      '..........RR............JJJ.........I.........DI:.......',
      '..........RR........e..f...f...e........................',
      '..........RR>{..Z.......................&D..{...........',
      '..........RR.........1.3....3.1.........................',
      '........................................................',
      '.....1.f....].h.1.....f......f.....1..h.....]...f.1.....',
      '........................................................',
      '...3..Uq..E...99.q..3............3..99.U....u...E...3...',
      '........................................................',
      '......$.w.$....x.w...x.w..e..e..}.w.}....}}.....p.w.....',
      '..............X.......Y...........Q.............y.......',
      '...h....................2....2....................V.h...',
      '..........Z.............2....2....................I.....',
      '.................&&.......1..1.I..&&....{&..............',
      '........&......n.....n..................&...............',
      '........................h....h..................&.......',
      '........................................................',
      '......4.........5...6.............<.....]...............',
      '...3....f.3..h....f...3........3...f..3..h...3...f..3...',
      '........................................................',
      '........................................................',
      '........................................................',
    ],
    // @end orbis
    spawns: {
      entrance: { x: 27, y: 40, dir: 'up' },
      inn: { x: 9, y: 12, dir: 'down' },
      west: { x: 1, y: 13, dir: 'right' },
    },
    // 記録院の立て札 (tier 1~, §10.9.1)
    tilePatches: [{ cond: C.t1, x: 23, y: 40, ch: 'm' }],
    npcs: [
      // ------------------------------------------------ the south gate
      K.npc('luca_gate', 'scholar', 27, 36, { dir: 'down', cond: '!star_start', fixed: true, event: 'orbis_intro' }),
      K.talk('guard_a', 'soldier', 25, 40, [
        { cond: C.post, text: '祭りの夜は、町じゅうの\n灯を消して星を見るんだ。\nあなたも見ていくといい。' },
        { cond: CL, text: '塔の上の星食らいを\n倒したのは、あなたか！\nこの町の恩人だ。' },
        { text: '学術都市オルビスへ\nようこそ。星読みの塔は、\n町を出て北東だ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('guard_b', 'soldier', 30, 40, [
        { cond: C.fog, text: '内海の霧が晴れたそうだ。\n天文台の望遠鏡なら、\n島の塔まで見えるらしいぞ。' },
        { cond: CL, text: '夜空が明るくなって、\n見張りが楽になったよ。' },
        { text: '近ごろ、夜は真っ暗でな。\n星明かりがないと、\n見張りも骨が折れる。' },
      ], { dir: 'down', fixed: true }),
      // ------------------------------------------------ the inn 「星明かり亭」
      K.npc('inn', 'innkeeper', 11, 5, { event: 'common_inn', fixed: true }),
      K.talk('inn_guest', 'merchant', 6, 7, [
        { cond: C.t4, text: '記録院のお触れのせいで、\n旅の帳面を持ち歩くのも\nびくびくものさ。' },
        { cond: CL, text: '星が戻って、夜道も\n安心して歩けるよ。\n星は旅人の道しるべだからね。' },
        { text: '夜に星が見えないと、\n旅人は道に迷うんだ。\n星は道しるべだからね。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 12, 9, [
        { cond: CL, text: 'ゆうべは、星がとても\nきれいだったわ。\n窓を開けたまま眠ったの。' },
        { text: '泊まっていくなら、\n主人に声をかけてね。\n疲れたら、無理は禁物よ。' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the tavern 「星見の杯亭」
      K.npc('tavern', 'bartender', 20, 5, { event: 'common_tavern', fixed: true }),
      K.talk('bard', 'bard', 28, 5, [
        { cond: CL, text: '♪　夜空に名を呼べば\n星はこたえて光る……\nさあ、もう一曲いこうか。' },
        { text: '星の歌を歌おうとしても、\n星の名前が出てこない。\n歌が途中で止まってしまう。' },
      ], { dir: 'down', fixed: true }),
      K.talk('tavern_dwarf', 'dwarf', 19, 8, [
        { cond: CL, text: '星が戻ったからな。\n明日の夜には山を越えて、\nドヴァンへ帰るとしよう。' },
        { text: '星が見えないと、山越えの\n道が分からん。\nおかげで足止めじゃ。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_student', 'man', 27, 8, [
        { cond: C.t4, text: '記録院の書記が、学院の\n本まで持っていこうとする。\n先生たちはかんかんさ。' },
        { cond: CL, text: '星の名前を、みんなで\n言い合ってるんだ。\n……今夜は、おれの勝ちさ。' },
        { text: '学院の先生たちまで、\n星の名前を忘れちまった。\n世も末だよ。' },
      ], { dir: 'left', push: true }),
      K.talk('waitress', 'woman', 24, 9, [
        { cond: CL, text: '星見のお客さんで、\n毎晩大にぎわいよ！' },
        { text: '夜空が寂しいと、\nお客さんも減るのよね。\n……いらっしゃい！' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the academy (学長オクタヴィア)
      K.npc('octavia', 'sage', 42, 5, { event: 'orbis_octavia', fixed: true }),
      K.talk('teacher', 'scholar', 37, 7, [
        { cond: C.t4, text: '記録院の書記が、学院の\n本まで納めよと言ってくる。\n困ったものだ。' },
        { cond: CL, text: '星の名を、子どもたちと\n一つずつ覚え直しているよ。\n今度は忘れないようにね。' },
        { text: '授業で星の名を\n教えようとしたら、\n名前が出てこなくてね。' },
      ], { dir: 'down', fixed: true }),
      K.talk('student_girl', 'girl', 36, 9, [
        { cond: CL, text: '思い出した！　あの星は、\nカペラさまが名付けた\n「道しるべの星」よ！' },
        { text: '北の空にあった大きな星、\nなんて名前だったっけ……。' },
      ], { dir: 'up', push: true }),
      K.talk('student_boy', 'boy', 45, 9, [
        { cond: CL, text: '宿題、ちゃんと出せたよ！\n星図を写すのは、\nすごく大変だった。' },
        { text: '星図の写しを取る宿題が\nあるのに、名簿がないんだ。\nどうしよう……。' },
      ], { dir: 'up', push: true }),
      K.talk('student_globe', 'boy', 48, 7, [
        { cond: CL, text: 'この地球儀で、星の見える\n方角を調べてるんだ。\n南の空の星がきれいだよ。' },
        { text: 'この地球儀は、海の向こうの\nアルカナから運んできた\nものなんだって。' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the library
      K.npc('chart', 'obj:r8_chart', 10, 18, { cond: ['star_start', '!star_chart'], event: 'orbis_library_chart', fixed: true }),
      K.talk('librarian', 'scholar', 6, 23, [
        { cond: C.t4, text: '記録院の書記が、また\n本を借りに来ました。\n返ってきたためしがない。' },
        { cond: CL, text: '星図の写しを、何枚も\n作っているところです。\nもう失くしませんよ。' },
        { text: 'ここはオルビスの図書館です。\n星の名簿は、記録院に\n持っていかれてしまって……。' },
      ], { dir: 'down', fixed: true }),
      K.talk('reader', 'girl', 14, 25, [
        { cond: CL, text: '伝記の最後のページに、\n星の名前がずらりと\n並んでいたのよ。' },
        { text: '賢者カペラの伝記を\n読んでいるの。\nとてもおもしろいのよ。' },
      ], { dir: 'up', push: true }),
      K.talk('old_scholar', 'elder', 12, 21, [
        { cond: CL, text: '塔のからくりたちも、\nすっかり静かになった\nそうですよ。' },
        { text: '星読みの塔は、町の北東に\nあります。からくりが\n動き回っていて、危ないですよ。' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the observatory
      K.talk('luca', 'scholar', 41, 21, [
        { cond: C.post, text: '夜空の星を、子どもたちに\n一つずつ教えているんだ。\nみんな、すぐに覚えるよ。' },
        { cond: C.fog, text: '望遠鏡で、内海の島を\n見てごらん。白い塔が\nはっきり見えるよ。' },
        { cond: CL, text: ['星が、ちゃんと戻ってきた！\nゆうべ数えたら、\nひとつも欠けていなかったよ。', '{hero}、ありがとう。\n星の名前は、もう二度と\n忘れないように書き残すよ。'] },
        { cond: 'star_chart', text: 'その星図があれば……！\n塔の頂の観測台で、\n星の名を読み上げてくれ。' },
        { text: ['記録院の人が、星の名簿を\n持っていったんだ。\n『保管のため』って……。', '写しが図書館に残っていると\nいいんだけど。学長さまにも\n聞いてみてくれ。'] },
      ], { cond: 'star_start', dir: 'right', fixed: true }),
      K.talk('assistant', 'girl', 37, 24, [
        { cond: CL, text: 'ルカ先生、ゆうべは\n一晩中、星を数えていたわ。\nうれしそうだった。' },
        { text: 'ルカ先生は、毎晩\n星を数えては、ため息を\nついているの。' },
      ], { dir: 'up', push: true }),
      K.talk('old_astronomer', 'old_man', 48, 24, [
        { cond: C.fog, text: '望遠鏡で、内海の島を\n見てごらん。白い塔が\nよく見えるぞ。' },
        { cond: CL, text: '星が戻った。\n長生きは、するもんじゃのう。' },
        { text: 'わしは五十年、星を見てきた。\nじゃが、星が消えるのを\n見るのは、初めてじゃ。' },
      ], { dir: 'up', push: true }),
      // ------------------------------------------------ the plaza
      K.npc('folk_a', 'man', 22, 24, { event: 'story_rumor', rumor: 'orbis_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 29, 18, { event: 'story_rumor', rumor: 'orbis_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 27, 24, '古い本はありませんか。\n記録院で、大切に保管\nいたします。', { cond: C.scribe, move: 'wander', push: true }),
      K.talk('teller', 'teller', 22, 19, [
        { cond: C.post, text: '星占いによると……\nあなたの物語は、まだまだ\n続くと出ているよ。' },
        { cond: C.t6, text: '星占いで、大きな白い闇が\n見えたよ。……気をつけて\nおくれ。' },
        { cond: CL, text: '今夜の星は、あなたの旅に\n幸いがあると言っているよ。' },
        { text: '星占いが、できないのさ。\n星が毎晩減っていく\nからね……。' },
      ], { dir: 'right', fixed: true }),
      K.talk('plaza_boy', 'boy', 30, 23, [
        { cond: CL, text: 'お星さま、帰ってきたよ！\nいっぱい、いっぱい！' },
        { text: 'お星さま、どこに\n行っちゃったの？' },
      ], { move: 'wander', push: true }),
      K.talk('cat', 'cat', 21, 21, 'ニャーン。', { move: 'wander', push: true }),
      K.talk('traveler', 'merchant', 4, 13, [
        { cond: C.t4, text: '記録院の書記に、荷の\n中身まで調べられたよ。\n古い本はないかってさ。' },
        { cond: CL, text: '星のおかげで、夜も\n街道を進めるようになった。' },
        { text: '西の街道から来たんだ。\n星が見えないから、\n夜は動けなくてね。' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the shops
      K.npc('shop_item', 'merchant', 7, 32, { event: 'common_shop', shop: 'orbis_item', fixed: true }),
      K.talk('shop_customer', 'woman', 8, 35, [
        { cond: CL, text: '星見のお祭りの準備で、\n買い物に来たのよ。' },
        { text: '塔へ行くなら、\n傷薬を多めにね。\n上へ行くほど手ごわいって。' },
      ], { dir: 'up', push: true }),
      K.npc('shop_weapon', 'dwarf', 15, 32, { event: 'common_shop', shop: 'orbis_weapon', fixed: true }),
      K.npc('shop_armor', 'merchant', 21, 32, { event: 'common_shop', shop: 'orbis_armor', fixed: true }),
      K.talk('apprentice', 'boy', 18, 35, [
        { cond: CL, text: '塔のからくりの部品で、\n新しい弓を作ってみたいな。' },
        { text: 'ここは杖や弓が多いんだ。\n学者さんの町だからね。' },
      ], { move: 'wander', push: true }),
      K.npc('shop_magic', 'teller', 32, 32, { event: 'common_shop', shop: 'orbis_magic', fixed: true }),
      // ------------------------------------------------ 記録院 オルビス出張所
      K.talk('clerk', 'scholar', 41, 32, [
        { cond: C.post, text: '記録院も、これからは\n語り継ぐことを\n学ぶそうです。' },
        { cond: C.t7, text: '本院から、急に呼び戻しの\n知らせが来たんです。\n何があったのでしょう。' },
        { cond: CL, text: '星の名簿を返してほしいと\n言われましても……。\nわたしの一存では……。' },
        { cond: C.t3, text: '各地から、古い本が次々に\n届くんです。整理が\n追いつきませんよ。' },
        { text: 'ここは記録院の\nオルビス出張所です。\n星の名簿は、本院で\n大切に保管しております。' },
      ], { fixed: true }),
      K.talk('books_a', 'decor:book_pile', 42, 35, '古い本が山積みになっている。\n各地から集められたらしい。', { cond: C.t3, fixed: true }),
      K.talk('books_b', 'decor:book_pile', 43, 36, '古い本が山積みになっている。\n各地から集められたらしい。', { cond: C.t3, fixed: true }),
      // ------------------------------------------------ the old mage's house
      K.talk('arcana_mage', 'old_man', 47, 34, [
        { cond: CL, text: ['わしの先祖は、海の向こうの\n魔法都市アルカナから\n来たのじゃよ。', 'カペラさまの星が戻って、\nご先祖も、きっと\n喜んでおるじゃろう。'] },
        { text: ['わしの先祖は、海の向こうの\n魔法都市アルカナから\n来たのじゃよ。', 'カペラさまは、星に名を\n付けた。名を呼ばれぬ星は、\n消えてしまうのじゃ……。'] },
      ], { dir: 'right', fixed: true }),
      K.talk('mage_girl', 'girl', 50, 36, [
        { cond: CL, text: 'おじいちゃん、星が戻って\n泣いていたの。\nうれし泣きだって。' },
        { text: 'おじいちゃんの話は、\nいつもアルカナの話ばかり。\nでも、おもしろいの。' },
      ], { move: 'wander', push: true }),
      // ------------------------------------------------ the scene spots (§10.8.0-7), inn = (9,12)
      K.npc('st_rival', 'rowell', 9, 14, { dir: 'up', cond: 'st_show_rival', fixed: true, text: '……' }),
      K.npc('st_fine', 'fine', 11, 14, { dir: 'up', cond: 'st_show_fine', fixed: true, text: '……' }),
      K.npc('st_extra', 'scribe', 7, 14, { dir: 'up', cond: 'st_show_extra', fixed: true, text: '……' }),
    ],
    signs: [
      K.sign(23, 40, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
      K.sign(12, 27, 'オルビス図書館\n「星の名は、読まれるたびに\n光を増す」'),
      K.sign(44, 27, 'オルビス天文台\n夜の見学は、ルカまで。'),
      K.sign(44, 12, 'オルビス学院\n学長　オクタヴィア'),
      K.sign(40, 39, '記録院オルビス出張所\n伝承の保管は、こちらへ。'),
    ],
    chests: [
      K.chest('orbis_c1', 49, 32, 'p_supply'),
      K.chest('orbis_c2', 52, 5, 'p_gold'),
    ],
    events: [
      K.exam('orbis_library_chart', 10, 18),
      K.exam('orbis_telescope', 43, 20),
    ],
  };
  R.DB.maps.orbis = K.checkRows('orbis', def);
})(window.RPG);
