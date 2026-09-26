// 港町ファロス (lute): the prologue's port town (DESIGN §10.6.1, §10.7 P4–P7 · P10).
// Owner: prologue (A18b). Theme `town` (§11.2.6: cobbles, ashlar, red tiles), BGM `town`.
//
// Layout (56×44): a walled harbour town on the inner-sea shore. The land road comes in over
// the moat bridge on the west (exit → world spawn `lute`); the harbour with three piers is on
// the east (the ferry pier is the middle one, spawn `dock`).
//   north row  : inn (宿屋), tavern 「語らいの灯亭」, 記録院 ファロス出張所
//   middle row : item shop, weapon & armour shop, the fountain plaza, the lord's house
//   south row  : two homes, the memorial garden of the first lighthouse keeper, the warehouse
//   south      : lane and beach
//
// Contracts (other areas rely on these):
//   spawns  entrance (west gate, facing right) · inn (in front of the inn door, facing down)
//           dock (ferry pier) · scene spots used by lute_departure
//   NPC ids inn · tavern (common_tavern, after pro_party_chosen) · tavern_start (lute_tavern_start
//           before) · shop_item / shop_weapon / shop_armor · ferry (common_ferry, ferryFrom 'lute') · folk_a / folk_b (story_rumor lute_a / lute_b) · scribe (tier 4–6)
//           · otto · rowell · berna (only in the departure scene)
//   events  onEnter lute_arrival (P4; also resumes lute_departure P10 if it was cut short)
(function (R) {
  'use strict';
  const K = R.Prologue;
  const C = K.C;
  const SCENE = ['pro_boss', '!prologue_done']; // the departure morning (P10)

  const def = {
    name: '港町ファロス', type: 'town', theme: 'town', bgm: 'town',
    location: 'lute', region: 'prologue', outside: '~', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'lute' },
    onEnter: 'lute_arrival',
    decorLegend: { '|': 'boat', ':': 'net_rack', ',': 'rope_coil' },
    // @rows lute
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~############################################~~~~~~~~~~',
      '~~######i#######i#######i#######i#######i#####~~~~~~~~~~',
      '~~#.BBBBBBBBBBB..BBBBBBBBBBBBBBB............jo~~~~~~~~~~',
      '~~#.BBBBBBBBBBB..BBBBBBBBBBBBBBBooBBBBBBBBB..o~~~~~~~~~~',
      '~~#.Bb_b______BojB____c________B..BBBBBBBBB...~~~~~~~~~~',
      '~~i.Bb_b___cccB..Bo___c________B..Bkk___kkB...~~~~~~~~~~',
      '~~#.B_________B..Bccccc________B..B_______B...=======~~~',
      '~~#.B_________B..B_________hth_B..B_______B...~~~~~~~~~~',
      '~~#.Bb_b____htB..B_hth__hth____B..B_______B...~~~~~~~~~~',
      '~~#.Bb_b______B..B__________htoB..Bj_____oB...~~~~~~~~~~',
      '~~#.B_________Bo.Bohth_________Bj.B_______B...~~~~~~~~~~',
      '~~#.BBBBBDBBBBB..BBBBBBBDBBBBBBB..BBBBDBBBB...~~~~~~~~~~',
      '~~i..................................m........~~~~~~~~~~',
      '==............................................~~~~~~~~~~',
      '==............................................~~~~~~~~~~',
      '==............................................========~~',
      '~~i..T.......T.....T..........................~~~~~~~~~~',
      '~~#.BBBBBBBBB..BBBBBBBBBBBBB.T.....T.,,,,,,..m~~~~~~~~~~',
      '~~#.BBBBBBBBBo.BBBBBBBBBBBBB....m....RRRRRR...~~~~~~~~~~',
      '~~#.Bu_____uB..B___________B.........RRRRRR...~~~~~~~~~~',
      '~~#.B_ccccc_B..BcccccjcccccB.........RRRRRR...~~~~~~~~~~',
      '~~i.B_______B..B___________B.........RRRRRR...~~~~~~~~~~',
      '~~#.B_______B..B_o_______o_B.........RRRRRR...~~~~~~~~~~',
      '~~#.Bo_____pB..B___________B.........BBDBBB..o~~~~~~~~~~',
      '~~#.B_______B.jB___________B..................~~~~~~~~~~',
      '~~#.BBBBDBBBB..BBBBBBDBBBBBB.T.....T..........~~~~~~~~~~',
      '~~#...........................................~~~~~~~~~~',
      '~~#...........................................~~~~~~~~~~',
      '~~#.BBBBBBBB..BBBBBBBBB..T,,,,,,,T..BBBBBBBB..~~~~~~~~~~',
      '~~#.BBBBBBBBo.BBBBBBBBBj.,,f,,,f,,..BBBBBBBB..=======~~~',
      '~~i.Bb_____B..Bb_b____B..,,,,,,,,,..Bjj__o_B..~~~~~~~~~~',
      '~~#.Bb_____B..Bb_b____B..,,,,Y,,,,..B______B..~~~~~~~~~~',
      '~~#.B__th__B..B_______B..,,,m.,,,,..B______B..~~~~~~~~~~',
      '~~#.B______B..B__hth__B..,f,,.,,f,..Bo_____Bj.~~~~~~~~~~',
      '~~#.Bb_____B..B_______B..,,,,.,,,,..Bo___jjB..~~~~~~~~~~',
      '~~#.Bb_____B..Bo_____oB.oT,,,.,,,T..BBBDBBBB..~~~~~~~~~~',
      '~~#.BBBDBBBB..BBBBDBBBB..,,,,.,,,,............~~~~~~~~~~',
      '~~#...........................................~~~~~~~~~~',
      '~~dddddddddddddddddddddddddrdddddddddddddddddd~~~~~~~~~~',
      '~~ddddddddrdddddddddrddddddddddddddddddddrdddd~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '........................................................',
      '........................................................',
      '........................................................',
      '........................................................',
      '........p...k......HH...i...t...............N...........',
      '......y...V...k...N......F...00.....}.[.}.......|.......',
      '.............................00.......Q.....:...........',
      '.............................................,....,.....',
      '.........rrr.......................DD...>...............',
      '.........rrr.........................rr...........|.....',
      '.....................................rr.....U...........',
      '.............Z................Z.........................',
      '............................................U...........',
      '.....1..7...3...1......j...3...1..3.....................',
      '.........................................99.............',
      '........................................................',
      '.................................................,......',
      '........3.e.....3.....e...3..e......e...3...............',
      '.....................................2h22h2.............',
      '......$.k.$......x.x...B.B...3.....3.........,..........',
      '...h..v.........X........YY...1...1...................|.',
      '...............................JJJ......................',
      '.............................e.JJJ.e........:...........',
      '.......rr...........rrr........JJJ......................',
      '.......rr...........rrr.......1...1.....................',
      '...........Z.................3.....3.........U..........',
      '...h....................................................',
      '.......4....3.......5.6...3.......3.......3.............',
      '...E.............................N.............|........',
      '........................................................',
      '.......p.$......k...$.......1.1........k.[......,.......',
      '...h.....KC..........F..................................',
      '.....................?..................................',
      '..........v....:..........e.....e.....s.....:....|......',
      '......&&...............................s................',
      '......y............&&....(......(............N..........',
      '...h....................................................',
      '........................................................',
      '..........3....3............3......3.......3............',
      '......:............................:....................',
      '........................,...............................',
      '.............|..........................................',
      '...............................|........................',
      '........................................................',
    ],
    // @end lute
    spawns: {
      entrance: { x: 3, y: 15, dir: 'right' },
      inn: { x: 9, y: 13, dir: 'down' },
      dock: { x: 51, y: 16, dir: 'left' },
    },
    // 記録院の立て札 (tier 1~, §10.9.1): a notice board appears near the gate
    tilePatches: [{ cond: C.t1, x: 4, y: 17, ch: 'm' }],
    npcs: [
      // --- the gate
      K.talk('watchman', 'soldier', 3, 13, [
        { cond: C.post, text: '平和な海が戻ってきた。\n門番の仕事も、のんびりしたもんさ。' },
        { cond: C.fog, text: '内海の霧が晴れたそうだ。\n島へ渡る船が出るらしいぞ。' },
        { cond: C.t4, text: '記録院の書記が、毎日のように\n門を通っていく。……何を\n集めているんだか。' },
        { cond: C.done, text: '跳ね橋が下りて、北の大陸へ\n行けるようになった。\n{hero}、気をつけてな。' },
        { text: '灯台の火が消えているうちは、\n夜の見張りが欠かせないのさ。' },
      ], { dir: 'down', fixed: true }),
      // --- the main street and the plaza
      K.npc('folk_a', 'man', 30, 25, { event: 'story_rumor', rumor: 'lute_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 34, 25, { event: 'story_rumor', rumor: 'lute_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 33, 20, '古い本はありませんか。\n記録院で、大切に保管\nいたします。',
        { cond: [C.t4, { tierBelow: 7 }], move: 'wander', push: true }),
      K.talk('peddler', 'merchant', 13, 15, [
        { cond: C.post, text: '北の町へ、ひとっ走り\n商いに行ってきたところさ。\nやっぱり旅はいいねえ。' },
        { cond: C.t4, text: '記録院のお触れで、古い本が\n売れなくなってね。\n商売あがったりさ。' },
        { cond: C.done, text: '跳ね橋が下りたって？\nこれで北の町へ\n商いに出られるぞ！' },
        { text: '跳ね橋が上がったきりで、\n北の町へ商いに出られない。\n荷がたまる一方だよ。' },
      ], { move: 'wander', push: true }),
      K.talk('bench_man', 'old_man', 29, 22, [
        { cond: C.post, text: 'わしの孫が、灯台守の歌を\n覚えたんじゃ。いつかは、\nあんたの話も歌にするそうな。' },
        { cond: C.t6, text: '守り歌は覚えておる。\nじゃが、ばあさんの子守歌が\n思い出せんのじゃ……。' },
        { cond: C.done, text: '♪　海の果てまで、灯よ届け……\nそうじゃ、そういう歌じゃった。\nやっと思い出したわい。' },
        { text: '灯台の守り歌か……。\n子どものころは、毎晩\n聞いておったはずなんじゃが。\fどうしても、続きが\n出てこんのじゃ。' },
      ], { dir: 'right', push: true }),
      K.talk('plaza_girl', 'girl', 34, 23, [
        { cond: C.fog, text: '海の真ん中の島が見えたの！\n白い塔が、きらきらしてた！' },
        { cond: C.done, text: '灯台がまた光ってるの！\nもう、夜もこわくないよ。' },
        { text: '夜になると、海から\nへんな声がするの。\n灯台がまっくらだから……。' },
      ], { move: 'wander', push: true }),
      K.talk('dog', 'dog', 25, 15, 'ワン！　ワンワン！', { move: 'wander', push: true }),
      K.talk('manor_guard', 'soldier', 39, 25, [
        { cond: C.post, text: '領主さまは、あなたの話を\n聞きたがっておられる。\n……いつか、ゆっくりとな。' },
        { cond: C.fog, text: '領主さまが、島へ渡る船に\n護衛をつけるとおっしゃった。' },
        { cond: C.done, text: '領主さまのご命令で、\n跳ね橋を下ろした。\n灯台の火が戻ったからな。' },
        { text: '領主さまのご命令で、\n跳ね橋を上げてある。\n夜の魔物を町へ入れぬためだ。\fここは領主さまのお屋敷だ。\n今は、お通しできない。' },
      ], { dir: 'down', fixed: true }),
      // --- the inn
      K.npc('inn', 'innkeeper', 12, 5, { event: 'common_inn', fixed: true }),
      K.talk('inn_guest', 'sailor', 12, 9, [
        { cond: C.t4, text: '記録院のお触れの話で、\n宿の客はもちきりさ。\n本を持ってる客は、そわそわしてる。' },
        { cond: C.done, text: 'やっと船が出るそうだ。\n三日も足止めされたよ。' },
        { text: '船が出ないもんだから、\nもう三晩もこの宿さ。\n財布が軽くなる一方だよ。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 8, 7, [
        { cond: C.done, text: 'お客さんが増えて、\n大忙しよ！\nまた泊まっていってね。' },
        { text: '泊まっていくなら、\n主人に声をかけてね。\n疲れたら、無理は禁物よ。' },
      ], { move: 'wander', push: true }),
      // --- the tavern 語らいの灯亭
      K.npc('tavern_start', 'bartender', 20, 6, { event: 'lute_tavern_start', cond: '!pro_party_chosen', fixed: true }),
      K.npc('tavern', 'bartender', 20, 6, { event: 'common_tavern', cond: 'pro_party_chosen', fixed: true }),
      K.npc('bard', 'bard', 28, 5, { event: 'lute_bard', fixed: true }),
      K.npc('patron_hagen', 'party:hagen', 19, 9, { event: 'lute_patron', who: 'hagen', dir: 'right', cond: '!joined_hagen', fixed: true }),
      K.npc('patron_dokka', 'party:dokka', 21, 9, { event: 'lute_patron', who: 'dokka', dir: 'left', cond: '!joined_dokka', fixed: true }),
      K.npc('patron_shigure', 'party:shigure', 24, 9, { event: 'lute_patron', who: 'shigure', dir: 'right', cond: '!joined_shigure', fixed: true }),
      K.npc('patron_titta', 'party:titta', 26, 9, { event: 'lute_patron', who: 'titta', dir: 'left', cond: '!joined_titta', fixed: true }),
      K.npc('patron_ilse', 'party:ilse', 28, 10, { event: 'lute_patron', who: 'ilse', dir: 'right', cond: '!joined_ilse', fixed: true }),
      K.npc('patron_marta', 'party:marta', 21, 11, { event: 'lute_patron', who: 'marta', dir: 'left', cond: '!joined_marta', fixed: true }),
      K.talk('tavern_sailor', 'sailor', 19, 11, [
        { cond: C.done, text: '灯台に乾杯！\n……ひっく。\n今夜はおごりだぜえ。' },
        { text: '灯台の火が消えてから、\n漁に出られねえ。\n飲むしかねえんだよ……。' },
      ], { dir: 'right', push: true }),
      K.talk('waitress', 'woman', 24, 8, [
        { cond: 'pro_party_chosen', text: 'マスターに言えば、いつでも\n旅の仲間を紹介してくれるわ。\n入れ替えもできるのよ。' },
        { text: 'いらっしゃい！\n今夜は、腕に覚えのある人が\nたくさん集まってるわよ。' },
      ], { move: 'wander', push: true }),
      // --- 記録院 ファロス出張所
      K.npc('rowell', 'rowell', 40, 7, { event: 'lute_rowell', cond: '!pro_boss', fixed: true }),
      K.talk('clerk', 'scholar', 35, 7, [
        { cond: C.post, text: '記録院は、これからは\n書き写すだけでなく、\n語り継ぐことも学ぶそうです。' },
        { cond: C.fog, text: '本院のあるビブリア島の\n霧が、晴れたそうですね。\nぜひ一度、行ってみてください。' },
        { cond: C.t7, text: '本院から、急に呼び戻しの\n知らせが来たんです。\n何かあったんでしょうか。' },
        { cond: C.t3, text: '各地から、古い本が次々に\n届くんです。整理が\n追いつきませんよ。' },
        { cond: 'pro_boss', text: 'ロウェルさまなら、\nビブリアの本院へ\nお戻りになりました。' },
        { text: 'ここは記録院の\nファロス出張所です。\n伝承は、書物にすれば\nいつまでも残るのですよ。' },
      ], { fixed: true }),
      K.talk('books_a', 'decor:book_pile', 36, 10, '古い本が山積みになっている。\n各地から集められたらしい。', { cond: C.t3, fixed: true }),
      K.talk('books_b', 'decor:book_pile', 40, 10, '古い本が山積みになっている。\n各地から集められたらしい。', { cond: C.t3, fixed: true }),
      K.talk('books_c', 'decor:book_pile', 36, 11, '古い本が山積みになっている。\n各地から集められたらしい。', { cond: C.t3, fixed: true }),
      // --- the shops
      K.npc('shop_item', 'merchant', 8, 20, { event: 'common_shop', shop: 'lute_item', fixed: true }),
      K.talk('shop_customer', 'woman', 6, 23, [
        { cond: C.done, text: '北の町の品も、また\n入ってくるようになるわね。' },
        { text: '傷薬は、いくつあっても\n困らないわよ。\n旅に出るなら、なおさらね。' },
      ], { dir: 'up', push: true }),
      K.npc('shop_weapon', 'dwarf', 18, 20, { event: 'common_shop', shop: 'lute_weapon', fixed: true }),
      K.npc('shop_armor', 'merchant', 24, 20, { event: 'common_shop', shop: 'lute_armor', fixed: true }),
      K.talk('apprentice', 'boy', 21, 23, [
        { cond: C.done, text: '親方が言ってた。\n武器の熟練度が上がると、\nもっと強い技を閃くって！' },
        { text: '武器は2つまで持てるんだ。\n違う種類を持てば、\n閃ける技も増えるんだって！' },
      ], { move: 'wander', push: true }),
      // --- homes
      K.talk('mother', 'woman', 8, 33, [
        { cond: C.done, text: '灯台の火を、あなたが？\nありがとう。あの子も\n安心して眠れるわ。' },
        { text: '夫は漁師なの。\n灯台の火が消えてから、\n海に出られなくて……。' },
      ], { dir: 'left', push: true }),
      K.talk('home_boy', 'boy', 7, 35, [
        { cond: C.done, text: '灯台守のじいちゃん、\nすごく喜んでたよ！\nぼくも灯台守になるんだ！' },
        { text: 'ぼく、大きくなったら\n灯台守になるんだ！' },
      ], { move: 'wander', push: true }),
      K.talk('spinner', 'old_woman', 20, 33, [
        { cond: C.post, text: '子守歌をね、ひ孫に\n歌ってやったのさ。\n最後までちゃんと歌えたよ。' },
        { cond: C.t6, text: '子守歌の文句が、\nどうしても出てこないんだよ。\n年のせいかねえ……。' },
        { cond: C.done, text: '灯台の守り歌を、また\n聞けるなんてねえ。\n長生きはするもんだよ。' },
        { text: '糸車を回していると、\n昔の歌が口に出るもんだけど、\n近ごろは、それも出てこない。' },
      ], { dir: 'left', push: true }),
      K.talk('fisher_wife', 'woman', 16, 34, [
        { cond: C.done, text: '今朝は大漁だったのよ！\n灯台さまさまね。' },
        { text: '網の手入ればかりしてるわ。\n早く海に出たいのに。' },
      ], { dir: 'down', push: true }),
      K.talk('garden_girl', 'girl', 26, 35, [
        { cond: C.done, text: '灯台守さんのお墓にね、\n灯がともったよって\n報告しに来たの。' },
        { text: 'ここはね、いちばん最初の\n灯台守さんのお墓なんだって。' },
      ], { move: 'wander', push: true }),
      K.talk('porter', 'man', 40, 33, [
        { cond: C.done, text: '定期船が動き出して、\n荷運びで大忙しだ！' },
        { text: '船が出ないから、荷が\n倉庫にたまる一方さ。' },
      ], { move: 'wander', push: true }),
      // --- the harbour
      K.npc('otto', 'old_man', 44, 17, { event: 'lute_otto', dir: 'right', fixed: true }),
      K.npc('ferry', 'sailor', 53, 16, { event: 'common_ferry', ferryFrom: 'lute', dir: 'left', fixed: true }),
      K.talk('ship', 'obj:ship', 55, 16, '定期船だ。帆をたたんで、\n静かに揺れている。', { dir: 'left', fixed: true }),
      K.talk('pier_fisher', 'fisher', 51, 7, [
        { cond: C.done, text: '灯台の光が、また海を\n照らしてくれている。\nありがたいことだ。' },
        { text: '夜の海は、黒い水が\nうねっているようだ。\n魔物の声も聞こえる……。' },
      ], { dir: 'up', push: true }),
      K.talk('pier_sailor', 'sailor', 50, 30, [
        { cond: C.done, text: '定期船なら、真ん中の\n桟橋から出ているぜ。\nロッホにもコーラルにも行ける。' },
        { text: '東のロッホや、南のコーラルへ\n行く定期船も、止まったままだ。' },
      ], { dir: 'right', push: true }),
      K.talk('fishwife', 'woman', 41, 13, [
        { cond: C.done, text: 'とれたての魚はいかが？\n……なんて、旅の人には\n荷物になるわね。' },
        { text: '干物しかなくて、ごめんね。\n漁に出られないのよ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('cat', 'cat', 44, 28, 'ニャーオ。', { move: 'wander', push: true }),
      K.talk('shell_girl', 'girl', 20, 39, [
        { cond: C.done, text: '灯台の光で、夜の浜も\n明るいの。\n貝がら、たくさん拾えたよ。' },
        { text: '貝がらを集めてるの。\nほら、きれいでしょ？' },
      ], { move: 'wander', push: true }),
      // --- the departure morning (P10): shown only between pro_boss and prologue_done
      K.npc('berna', 'berna', 9, 15, { dir: 'up', cond: SCENE, fixed: true, event: 'lute_departure' }),
      K.talk('cheer_a', 'man', 7, 14, '灯台に火が戻ったぞ！', { dir: 'right', cond: SCENE, fixed: true }),
      K.talk('cheer_b', 'woman', 11, 14, '跳ね橋も下りたそうよ！', { dir: 'left', cond: SCENE, fixed: true }),
      K.talk('cheer_c', 'boy', 6, 16, '灯台、すごく明るいね！', { dir: 'up', cond: SCENE, fixed: true }),
      K.npc('master', 'bartender', 13, 16, { dir: 'up', cond: SCENE, fixed: true, text: 'ここに残った連中も、\nいつでも仲間にできるよ。\nどこの町の酒場でもね。' }),
    ],
    signs: [
      K.sign(32, 19, 'ファロスの広場\n「灯を絶やすな、歌を絶やすな」'),
      K.sign(28, 33, '初代の灯台守、ここに眠る。\f「海の果てまで灯を届け、\n帰る舟を迎えよ」'),
      K.sign(37, 13, '記録院ファロス出張所\n伝承の保管は、こちらへ。'),
      K.sign(45, 18, '定期船乗り場\nコーラル・ロッホ行き'),
      K.sign(4, 17, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
    ],
    chests: [
      K.chest('lute_c1', 10, 36, 'p_supply'),
      K.chest('lute_c2', 39, 31, 'p_gold'),
    ],
    events: [],
  };
  R.DB.maps.lute = K.checkRows('lute', def);
})(window.RPG);
