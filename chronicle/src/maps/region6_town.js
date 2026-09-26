// 鉱山都市ドヴァン (dovan): the town of region 6 ガルド山地 (DESIGN §10.6.1, §10.8.7). Owner: R6.
// Theme `town_mine` (dark slabs, rubble, slate roofs; §11.2.6), BGM `town`, outside rock.
//
// Layout (54×44): a mining town cut into a mountain valley; the road comes up from the south.
//   north row  : 宿屋 · 鍛冶神のほこら (the smith god's shrine) · the old shaft 第一坑 · 酒場「つるはし亭」
//   middle row : 道具屋 · ヘルガの鍛冶場 (dovan_weapon) · 防具屋 · 鉱山事務所 (鉱山長ボルグ)
//   south row  : three miners' homes (miner_a · ピップのおばあさん · miner_b), the square with the
//                well and 誓いの碑 (the oath stone), the ore depot where the rails end
// The rails run from the old shaft down the east lane to the depot.
//
// Contracts: spawns entrance (south road) · inn (in front of the inn door, facing down); the three
// scene spots st_rival / st_fine / st_extra 2 cells below it (§10.8.0-7); NPC ids inn · tavern ·
// shop_item / shop_weapon / shop_armor · folk_a / folk_b (story_rumor dovan_a / dovan_b) · scribe ·
// borg · helga · pip · miner_a · miner_b; onEnter dovan_intro (§10.8.7 #1).
(function (R) {
  'use strict';
  const K = R.Reg6;
  const C = K.C;

  const def = {
    name: '鉱山都市ドヴァン', type: 'town', theme: 'town_mine', bgm: 'town',
    location: 'dovan', region: 'r_mine', outside: 'r', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'dovan' },
    onEnter: 'dovan_intro',
    decorLegend: { '|': 'forge', ':': 'ore_pile', ',': 'cradle' },
    // @rows dovan  (drafted with tools/fixtures/reg6/drafts/draft_dovan.js)
    rows: [
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
      'rrBBBBBBBBBBBB...BBBBBBBBBBBBB..r.r.BBBBBBBBBBBBBBBBrr',
      'rrBBBBBBBBBBBBrr.BBBBBBBBBBBBBr.m...BBBBBBBBBBBBBBBBrr',
      'rrBb_b_b__ouuBr..B....lYl....B......Bo_______o____oBrr',
      'rrBb_b_b_____B...B.....a.....B......B_cccccc_______Brr',
      'rrB__________B...B.l..+++..l.B......B_h_h_h________Brr',
      'rrB______ccc_B...B....+++....B......B______hth_____Brr',
      'rrB__h_______B...B.l..+++..l.B......B__hth_________Brr',
      'rrB__t_______B...B....+++....B......B_______hth____Brr',
      'rrBBBBBBBBDBBB...BBBBBBDBBBBBB......BBBBBBBBDBBBBBBBrr',
      'rr.................................................rrr',
      'rrr................................................rrr',
      'rr..................................................rr',
      'rrBBBBBBBBBB..BBBBBBBBBBBBBB..BBBBBBBBBB.BBBBBBBBBBBBr',
      'rrBBBBBBBBBB..BBBBBBBBBBBBBB..BBBBBBBBBB.BBBBBBBBBBBBr',
      'rrBu_u___opB..B...........oB..B_____uu_B.Bkk_______bBr',
      'rrB________B..B............B..B________B.B_________bBr',
      'rrB_cccc___B..B......cccc..B..B___cccc_B.B_________oBr',
      'rrB________B..B............B..B________B.B__hth_____Br',
      'rrB_j____h_B..B.j.......j..B..B_h____j_B.B_________jBr',
      'rrBBBBDBBBBBj.B............B.jBBBBBDBBBB.B__________Br',
      'rrr...........BBBBBBBDBBBBBBo............BBBBBDBBBBBBr',
      'rrr................................................rrr',
      'rrr.........r..................................:...rrr',
      'rrrr...........................................:...rrr',
      'rr........................Ym..............:jj....jjrrr',
      'rrBBBBBBBBB..BBBBBBBBB.........BBBBBBBBB..::::::::::rr',
      'rrBBBBBBBBB..BBBBBBBBB.........BBBBBBBBB..:::::::o::rr',
      'rrBb_b____B..B____b_bB....W....B____b_bB..::::::::::rr',
      'rrBb_b____B..B____b_bB.........B____b_bB..::::::::::rr',
      'rrB___hth_B..B_hth___B.........B_hth___B..::::::::::rr',
      'rrB_______B..B_______B.........B_______B..:::::::o::rr',
      'rrBBBBDBBBBo.BBBBDBBBBj........BBBBDBBBBo.::::::::::rr',
      'rr........................................::::::::::rr',
      'rrr...,...................::..............:::,::::::rr',
      'rrrr,,........T...........::..........T.r.....,.,,,rrr',
      'rrrrr,,,,T,,,,,,,,,,T,,,,,::,,r,,T,,,,,,,,,,T,,,,,rrrr',
      'rrrrrr~~~~~~~~~~~~~~~~~~~~||~~~~~~~~~~~~~~~~~~~~~rrrrr',
      'rrrrrrrT,,,,r,,T,,,,,,T,,,::,,,,,,,T,,,,,,,T,,,rrrrrrr',
      'rrrrrrrrr,,T,,,,,,,T,,,,,,::,,,T,,,,r,,T,r,,,rrrrrrrrr',
      'rrrrrrrrrrr,,,,,,r,,,,,,,,::,,,,,,,,,,,,,,rrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrr,,,,,,,,::,,,,,rrrrrrrrrrrrrrrrrrrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrr,,::,,rrrrrrrrrrrrrrrrrrrrrrrr',
    ],
    decor: [
      '......................................................',
      '......................................................',
      '.................................-....................',
      '...w.p.w..$.w.....i.W..c..W.i....-/....HH...w..p..i...',
      '..................Q.........Q....-....N.........U.....',
      '.........&...........O...O.......-....................',
      '....&............................-....................',
      '..................e........e.....-....................',
      '.............Z...................-..............00....',
      '...n..............e........e.....-...Z................',
      '.................................-....................',
      '.......7...........]........h....-........j...........',
      '....1..........3.....1........3..--------......1......',
      '........................................-.............',
      '........................................-.............',
      '...$.w..k.w....x.k..w.x.w.x....w.c..w.k.-.[..w..}..w..',
      '...............|.....XX..:.....Y.Y......-....{..A.....',
      '.........q.....%O.......................-.....D.......',
      '..................g.....................-.............',
      '.......&.........n......:......&........-.......T.....',
      '...................g...n................-..&.....&....',
      '...............O..........%.............-.Z........Z..',
      '........4........................6......-.............',
      '...................5....................3..q..........',
      '...............3........................--------......',
      '................h......3.....3......h.E........-......',
      '...............................................-......',
      '...............................................-......',
      '...w..p..w....w.$..w.....aaa....w..p.w.........-......',
      '.........K....K.?.......ea.ae...C...........::.-......',
      '.........................aaa.....,.............-..:...',
      '........................1...1..................-..U...',
      '...&....y...........&...........&...........:..-......',
      '...........................................U...-..q...',
      '............3............................3...../......',
      '......................................................',
      '.........................3..3.........................',
      '.....f....f.....f......f..........f......f............',
      '......................................................',
      '..............................................h.......',
      '........h...............h....h........................',
      '.............h.......................h................',
      '......................................................',
      '......................................................',
    ],
    // @end dovan
    spawns: {
      entrance: { x: 26, y: 42, dir: 'up' },
      inn: { x: 10, y: 11, dir: 'down' },
    },
    // 記録院の立て札 (tier 1~, §10.9.1 / §10.9.5): a notice board by the road in
    tilePatches: [{ cond: C.t1, x: 22, y: 40, ch: 'm' }],
    npcs: [
      // ---------------------------------------------------------------- the road in
      // 鉱山長ボルグ meets the party at the town's edge the first time (dovan_intro, §10.8.7 #1)
      K.npc('borg_gate', 'dwarf', 26, 39, { cond: '!mine_start', dir: 'down', fixed: true, event: 'dovan_intro' }),
      K.talk('lookout', 'miner', 29, 40, [
        { cond: C.post, text: '見張りなんて、もういらねえ\nかもな。坑道はすっかり\n静かなもんだ。' },
        { cond: C.fog, text: '内海の霧が晴れたってな。\n山のてっぺんから、白い塔が\n小さく見えたぜ。' },
        { cond: C.clr, text: '鉄の化け物が、坑道から\nいなくなった。\nあんたのおかげだってな！' },
        { cond: 'mine_start', text: '深き坑道は、町の北東だ。\n山道を登った先に\n入口がある。' },
        { text: 'ここはドヴァン。鉱山の町だ。\n今は、ちょいと取りこみ中\nでな……。' },
      ], { dir: 'left', fixed: true }),
      // ---------------------------------------------------------------- the inn
      K.npc('inn', 'innkeeper', 10, 6, {
        event: 'common_inn', fixed: true,
        greet: 'ようこそ、つるはしの宿へ。\n鉱夫仕込みの、かたいベッドだが\nよく眠れるよ。',
      }),
      K.talk('inn_guest', 'merchant', 5, 8, [
        { cond: C.post, text: '鉱石の相場が、やっと\n元に戻ったよ。\n商売は、平和がいちばんだね。' },
        { cond: C.t4, text: '記録院の書記が、古い帳面まで\n集めて回ってる。\n商いの記録まで持っていく気かね。' },
        { cond: C.clr, text: '坑道が開いたって？\nじゃあ、また鉱石の\n買いつけができるな。' },
        { text: '鉱石の買いつけに来たんだが、\n坑道が閉じたままでね。\nもう五日も足止めさ。' },
      ], { dir: 'right', push: true }),
      K.talk('inn_maid', 'woman', 7, 7, [
        { cond: C.clr, text: '若い人たちが帰ってきて、\n町が明るくなったわ。\nゆっくりしていってね。' },
        { text: '泊まるなら、主人に\n声をかけてね。\n坑道帰りの人も大歓迎よ。' },
      ], { move: 'wander', push: true }),
      // the scene spots of §10.9.2 (2 cells below the inn spawn): hidden until a story scene
      K.talk('st_rival', 'rowell', 10, 13, '……', { cond: 'st_show_rival', dir: 'up', fixed: true }),
      K.talk('st_fine', 'fine', 12, 13, '……', { cond: 'st_show_fine', dir: 'up', fixed: true }),
      K.talk('st_extra', 'scribe', 8, 13, '……', { cond: 'st_show_extra', dir: 'up', fixed: true }),
      // ---------------------------------------------------------------- 鍛冶神のほこら
      K.talk('shrine_keeper', 'old_woman', 20, 5, [
        { cond: C.post, text: '祭りの夜には、町じゅうで\n誓いの歌を歌ったよ。\n鍛冶神さまも、お喜びさ。' },
        { cond: C.clr, text: '誓いの歌が、この町に\n戻ってきた。ありがとうよ。\f鍛冶神さまは、火と鉄を\nくださった。そのかわりに、\n山の奥を守れと言われたのさ。' },
        { text: 'ここは鍛冶神さまのほこら。\n山に火と鉄をくださった神さまさ。\f昔は、ハンマーを振るうたびに\n誓いを歌ったもんだが……\n若い者は、もう知らないねえ。' },
      ], { dir: 'right', fixed: true }),
      K.talk('shrine_visitor', 'woman', 26, 7, [
        { cond: C.clr, text: '息子が、無事に帰ってきました。\nお礼参りに来たんです。' },
        { text: '坑道に閉じこめられた子たちが、\nどうか無事でありますように……。' },
      ], { dir: 'up', push: true }),
      // ---------------------------------------------------------------- 酒場「つるはし亭」
      K.npc('tavern', 'bartender', 40, 4, {
        event: 'common_tavern', fixed: true,
        greet: 'つるはし亭へようこそ。\n腕っぷしの強い連中なら、\nいくらでもいるよ。',
      }),
      K.talk('tavern_miner', 'miner', 38, 6, [
        { cond: C.post, text: '今夜も誓いの歌で乾杯だ！\n七の層より下は、掘らねえぞー！' },
        { cond: C.clr, text: '見ろよ、このハンマー。\n柄に誓いを彫り直したんだ。\n親方に教わってな。' },
        { text: '坑道があの調子じゃ、\n仕事にならねえ。\n飲むしかねえんだよ……。' },
      ], { dir: 'up', push: true }),
      K.talk('tavern_old', 'old_man', 42, 6, [
        { cond: C.t6, text: '誓いの歌は、思い出した。\nじゃが、ばあさんの子守歌が\nどうにも出てこんのじゃ。' },
        { cond: C.clr, text: '♪　火をくれた神に誓う……\nそうじゃ、この歌じゃ。\n若いころは毎日歌ったわい。' },
        { text: 'わしが若いころは、ハンマーを\n振るうたびに歌ったもんじゃ。\n……はて、どんな歌じゃったか。' },
      ], { dir: 'up', push: true }),
      K.talk('tavern_pair_a', 'miner', 43, 7, [
        { cond: C.clr, text: 'ピップのやつ、帰ってくるなり\nじいさんのハンマーを\n見せびらかしてやがる。' },
        { text: '鉱山長も、無茶を\nさせたもんだぜ。七の層の下を\n掘らせるなんてよ。' },
      ], { dir: 'right', push: true }),
      K.talk('tavern_pair_b', 'man', 45, 7, [
        { cond: C.clr, text: '借金は、みんなで少しずつ\n返していくことにしたんだ。\n町の仲間だからな。' },
        { text: '借金が返せなきゃ、鉱山ごと\n取られちまうんだとさ。\n鉱山長も追いつめられてたんだ。' },
      ], { dir: 'left', push: true }),
      K.npc('tavern_bard', 'bard', 49, 7, { event: 'dovan_bard', dir: 'down', fixed: true }),
      K.talk('waitress', 'woman', 46, 5, [
        { cond: C.clr, text: '今夜は店じゅう大にぎわい！\n鉱夫さんたちが、ずっと\n歌ってるのよ。' },
        { text: 'いらっしゃい！\n仲間を探すなら、\nマスターに声をかけてね。' },
      ], { move: 'wander', push: true }),
      K.talk('tavern_cat', 'cat', 50, 9, 'ニャー。', { move: 'wander', push: true }),
      // ---------------------------------------------------------------- the shops
      K.npc('shop_item', 'merchant', 5, 17, {
        event: 'common_shop', shop: 'dovan_item', fixed: true,
        greet: '坑道に入るなら、\n傷薬と気つけの羽根は\n多めに持っていきな。',
      }),
      K.npc('shop_weapon', 'miner', 22, 17, {
        event: 'common_shop', shop: 'dovan_weapon', fixed: true,
        greet: 'ヘルガ親方の鍛冶場へ、ようこそ。\nおれは弟子だけど、\n品は親方の打ったものだよ。',
      }),
      K.npc('helga', 'dwarf', 17, 17, { event: 'dovan_helga', dir: 'left', fixed: true }),
      K.npc('shop_armor', 'man', 35, 17, {
        event: 'common_shop', shop: 'dovan_armor', fixed: true,
        greet: '坑道の落石から頭を守るなら、\nうちの兜がいちばんだ。',
      }),
      K.talk('armor_customer', 'miner', 32, 20, [
        { cond: C.clr, text: '新しい胸当てを買ったんだ。\nまた坑道に入れるからな！' },
        { text: '兜を新調しようと思ったが、\n坑道に入れないんじゃなあ。' },
      ], { dir: 'up', push: true }),
      // ---------------------------------------------------------------- 鉱山事務所
      K.npc('borg', 'dwarf', 46, 16, { cond: 'mine_start', event: 'dovan_borg', dir: 'down', fixed: true }),
      K.talk('clerk', 'scholar', 49, 19, [
        { cond: C.post, text: '帳面も、すっかり黒字です。\n鉱山長は、まず借金を\n返すんだと言っています。' },
        { cond: C.clr, text: '鉱山長が、七の層から下の\n坑道を、すべて埋めると\n決めました。' },
        { text: '借金の証文が山のようで……。\n七の層の下に、大きな鉱脈が\nあるはずだったんですが。' },
      ], { dir: 'left', push: true }),
      // ---------------------------------------------------------------- the homes
      // 家 A: miner_a (rescued on deep_mine_1)
      K.talk('miner_a', 'miner', 5, 31, [
        { cond: C.post, text: '坑道の奥で聞いた、あの\n低い声……。今は、静かに\n眠っているんだろうな。' },
        { cond: C.clr, text: '坑道は、もう静かだ。\n明日から、また仕事に\n戻るよ。ありがとうな！' },
        { text: 'あのときは、本当に\nもうだめかと思ったよ。\n助けてくれて、ありがとう。' },
      ], { cond: 'deep_mine_1_miner', dir: 'right', push: true }),
      K.talk('miner_a_wife', 'woman', 7, 30, [
        { cond: 'deep_mine_1_miner', text: 'うちの人を助けてくれて、\nありがとうございます。\nこの恩は、一生忘れません。' },
        { text: 'うちの人が、坑道から\n帰ってこないんです。\nどうか、どうか……。' },
      ], { dir: 'down', push: true }),
      K.talk('miner_a_kid', 'girl', 4, 32, [
        { cond: 'deep_mine_1_miner', text: 'お父さん、帰ってきたよ！\nお姉ちゃんたちのおかげ？' },
        { text: 'お父さん、いつ帰ってくるの？' },
      ], { move: 'wander', push: true }),
      // 家 B: ピップとおばあさん
      K.talk('pip_granny', 'old_woman', 14, 31, [
        { cond: C.post, text: 'ピップがね、あの人のハンマーで\n最初の鉄を打ったんだよ。\n立派なもんさ。' },
        { cond: 'deep_mine_2_pip', text: 'あの子のハンマーは、\nおじいさんの形見なんだよ。\n役に立ったのなら、うれしいねえ。' },
        { text: '孫のピップが、坑道から\n戻らないんだよ。\f出がけに、おじいさんの\nハンマーを持っていったんだ。\nお守りだと言ってね……。' },
      ], { dir: 'right', push: true }),
      K.talk('pip', 'boy', 18, 31, [
        { cond: C.post, text: 'じいちゃんのハンマーで、\n鉄を打ってみたんだ。\nいつか親方みたいになるよ！' },
        { cond: C.clr, text: '番人は、また眠ったんだって？\n誓いの歌、ぼくも覚えたよ。\nじいちゃんが歌ってた歌だ。' },
        { text: '助けてくれて、ありがとう！\nじいちゃんのハンマー、\nちゃんと役に立った？' },
      ], { cond: 'deep_mine_2_pip', move: 'wander', push: true }),
      // 家 C: miner_b (rescued on deep_mine_2)
      K.talk('miner_b', 'miner', 34, 31, [
        { cond: C.post, text: '坑道の中で、誓いの歌を\n歌いながら掘ってるんだ。\n不思議と、疲れないんだよな。' },
        { cond: C.clr, text: '鉱山長が、七の層の下は\nもう掘らないって誓ったんだ。\nそれでいい。それでいいんだ。' },
        { text: 'あの鉄の化け物……\n七の層の下から\n出てきたんだ。間違いない。' },
      ], { cond: 'deep_mine_2_miner', dir: 'left', push: true }),
      K.talk('miner_b_mother', 'old_woman', 37, 30, [
        { cond: 'deep_mine_2_miner', text: 'せがれが帰ってきたよ。\nあんたたちは、命の恩人だ。' },
        { text: 'せがれは、七の層の下を\n掘るのは嫌だと言ってたんだ。\nそれなのに……。' },
      ], { dir: 'down', push: true }),
      // ---------------------------------------------------------------- the square and the streets
      K.npc('folk_a', 'man', 23, 28, { event: 'story_rumor', rumor: 'dovan_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 29, 28, { event: 'story_rumor', rumor: 'dovan_b', move: 'wander', push: true }),
      K.talk('scribe', 'scribe', 30, 25, '古い本はありませんか。\n記録院で、大切に保管\nいたします。',
        { cond: [C.t4, { tierBelow: 7 }], move: 'wander', push: true }),
      K.talk('square_boy', 'boy', 25, 33, [
        { cond: C.clr, text: 'ぼくも大きくなったら\n鉱夫になるんだ！\n七の層より下は、掘らないよ！' },
        { text: '坑道には入っちゃだめだって。\n鉄のおばけが出るんだって！' },
      ], { move: 'wander', push: true }),
      K.talk('well_woman', 'woman', 27, 31, [
        { cond: C.fog, text: '内海の霧が晴れたそうね。\n今度、ファロスまで\n足をのばしてみようかしら。' },
        { cond: C.t4, text: '記録院の人が、ほこらの\n古い書き付けを欲しがったの。\nおばあさんが断ってたわ。' },
        { cond: C.clr, text: '井戸の水まで、なんだか\nおいしく感じるわ。\n町に笑い声が戻ったからかしら。' },
        { text: '坑道から、夜な夜な\nガシャン、ガシャンって\n音がするのよ……。' },
      ], { dir: 'up', push: true }),
      K.talk('bench_old', 'old_man', 13, 26, [
        { cond: C.post, text: '誓いの歌を、孫たちに\n教えておるところじゃ。\n忘れんようにな。' },
        { cond: C.clr, text: 'わしも若いころは、七の層まで\n降りたもんじゃ。その先は、\n誰も掘らなんだがな。' },
        { text: '七の層より下を掘るな――\nそう言われて育ったもんじゃ。\n理由は、とんと忘れたがの。' },
      ], { dir: 'down', push: true }),
      K.talk('cart_man', 'miner', 44, 30, [
        { cond: C.clr, text: 'トロッコが、また鉱石で\nいっぱいだ！\n腕が鳴るぜ！' },
        { text: 'トロッコは、どれも空っぽだ。\n坑道が閉じちまったからな。' },
      ], { dir: 'left', push: true }),
      K.talk('depot_boss', 'dwarf', 49, 30, [
        { cond: C.t4, text: '記録院の書記が来て、\n鉱山の古い帳面を持っていった。\n何に使うんだかな。' },
        { cond: C.clr, text: '鉱石置き場も、にぎやかに\nなってきたぜ。\n七の層より上だけでな。' },
        { text: '借金のかたに、鉱石を全部\n持っていかれちまった。\n置き場は、からっぽさ。' },
      ], { dir: 'down', push: true }),
      K.talk('street_girl', 'girl', 17, 25, [
        { cond: C.clr, text: 'お兄ちゃんが帰ってきたの！\nいっしょに歌を歌ったよ！' },
        { text: 'かあさんが言ってた。\n誓いを破ると、鉄の番人が\n目を覚ますんだって。' },
      ], { move: 'wander', push: true }),
      K.talk('dog', 'dog', 12, 37, 'ワン！　ワンワン！', { move: 'wander', push: true }),
      K.talk('forge_smith', 'miner', 25, 20, [
        { cond: C.clr, text: '親方の鍛冶場に、新しい品が\nずらりと並んだぜ。\n見ていってくれよ。' },
        { text: '炉の火は落とすなって、\n親方がうるさくてな。\n坑道が閉じてもこれだ。' },
      ], { dir: 'up', push: true }),
    ],
    signs: [
      // 誓いの碑 (the oath stone in the square)
      K.sign(27, 26, [
        { cond: C.clr, text: '誓いの碑\f「七の層より下を掘るな。\nそこに鉄の番人が眠る。\n火をくれた神に、われら誓う」\f文字が、新しく\n彫り直されている。' },
        { text: '誓いの碑\f「七の層より……を掘るな。\n……の番人が眠る」\f文字がすり減って、\nほとんど読めない。' },
      ]),
      K.sign(32, 3, '第一坑\n古い坑道。落盤のおそれあり。\n立ち入りを禁ず。'),
      K.sign(19, 11, '←宿屋・ほこら\n→酒場「つるはし亭」\n↓広場・鉱石置き場'),
      K.sign(22, 40, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
    ],
    chests: [
      K.chest('dovan_c1', 33, 2, 'p_supply'),
      K.chest('dovan_c2', 51, 34, 'p_gold'),
    ],
    events: [],
  };
  R.DB.maps.dovan = K.checkRows('dovan', def);
})(window.RPG);
