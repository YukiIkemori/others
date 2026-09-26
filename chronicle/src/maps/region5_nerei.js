// 岬の村ネレイ (nerei): the small fishing village on the south-east cape of the main island
// (DESIGN §10.8.6, §10.6.1). Owner: reg-5 (R5). Theme `town_isle`, BGM `village`. Inn and a general
// store only (no tavern, no folk_b, no scribe: §10.6.1, §10.9.3, §10.9.5).
//
// Layout (46×36): the road from Coral comes in on the west (spawn `entrance`, exit → world `nerei`);
// the village street runs east to the cape, where 岬の桟橋 reaches into the sea (spawn `pier`). The
// ghost ship comes alongside the pier on the night of the song (isles_ship) and, after the clear,
// lies on the rocks there (nerei_pier: board it again; the ghost_ship_* escape lands on `pier`).
//   north : inn, general store, Marina's cottage by the lane down to the pier
//   south : two fishers' houses (one with the net shed), the drying racks, the beach and the boats
//   cape  : the old beacon (岬の灯) Marina has kept for sixty years
//
// Contracts: spawns entrance · inn · pier; NPC ids inn · shop_item (nerei_item) · folk_a (nerei_a)
//   · marina (+ marina_song / marina_wait / marina_home by state) · marina_pier / glen_pier (scenes)
//   · ghostship / wreck (the ship at the pier); events nerei_pier (step, cond isles_ship).
(function (R) {
  'use strict';
  const K = R.Isles;
  const C = K.C;
  const REG = { cleared: 'r_isles' };
  const NOT = { notCleared: 'r_isles' };
  const SCENE = 'isles_scene'; // never set: scene NPCs are shown by the scripts (ev.npc(id).show())

  const def = {
    name: '岬の村ネレイ', type: 'town', theme: 'town_isle', bgm: 'village',
    location: 'nerei', region: 'r_isles', outside: '~', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'nerei' },
    decorLegend: { ':': 'boat', '|': 'net_rack', ',': 'rope_coil', '`': 'washtub' },
    // @rows nerei
    rows: [
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~dddddddddddddddddddddddd~~~~~~~~~~~~~~~~~~',
      '~~~~,,,,,,,,,,,,,,,,,,::,,,,~~d~~~~~~~~~~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,,::,,,,,,,,,~~~~~~~~~~~~~',
      ',,#########,,,#######,::,,,,,,,,,~~~~~~~~~~~~~',
      ',,#########,,,#######,::,#######,~~~~~~~~~~~~~',
      ',,#b_b____#,,,#u_u_u#,::,#######,~~~~~~~~~~~~~',
      ',,#_______#,,,#_____#,::,#b____#,~~~~~~~~~~~~~',
      ',,#___ccc_#,,,#ccc__#,::,#_____#,~~~~~~~~~~~~~',
      ',,#_______#,,,#_____#,::,#_____#,rd~~~~~~~~~~~',
      ',,#_______#,,,#_____#,::,#_____#,dd~~~~~~~~~~~',
      ',,#_______#,,,#_____#,::,#_____#,ddddr~~~~~~~~',
      ',,####D####,::###D###,::,###D###,ddddd~~~~~~~~',
      ',m,,,,,,,,,,::,,,,,,,,::,,,,,,,,,,,,dd~~~~~~~~',
      ':::::::::::::::::::::::::::::::::,m,dd~~~~~~~~',
      '::::::::W::::::::::::::::::::::::::::________~',
      ',,,,,,,,,,,,::,,,,,,,,::,,,,,,,,,::::________~',
      ',,,,,,,,,,,,::,,,,,,,,::,,,,,,,,,,,,dd~~~~_~~~',
      ',,########,,::,#######::,,,,,,,,,,,,dd~~~~_~~~',
      ',,########,,::,#######::,,,,,,,,,,,,dd~~~~~~~~',
      ',,#b_b___#,,::,#b____#::,,,,,,,,,,,,dd~~~~~~~~',
      ',,#______#,,::,#_____#::,,,,,,,,,,,,dddd~~~~~~',
      ',,#______#,,::,#_____#::,,,,,,,,,,,,ddrd~~~~~~',
      ',,#______#,,::,#_____#::,,,,,,,,,,,,dddd~~~~~~',
      ',,#______#,,::,#_____#::,,,,,,,,,,,,dddr~~~~~~',
      ',,#______#,,::,#_____#::,,,,,,,,,,,,dddd~~~~~~',
      ',,####D###,,::,###D###::,,,,,,,,,,,,dddd~~~~~~',
      ',,,:::::::::::::::::::::,,,,,,,,,ddmYddr~~~~~~',
      ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,ddddddd~~~~~~',
      'dddddddddddddddddddddddddddddddddddddddd~~~~~~',
      'ddrddddddddddddddddddddddddddddddddrdrrd~~~~~~',
      'ddddddddddddddddddddd~~~~~~~~~~~~~~~~~~~~~~~~~',
      'ddddddddddddddddddddd~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
    decor: [
      '..............................................',
      '..............................................',
      '..............................................',
      '....)....)...)....)...........................',
      '........................)....)................',
      '..............................................',
      '....w..w.[.....$.w.$..........................',
      '....y...k.................w.p.w...............',
      '...................q.......y..................',
      '...&..........................................',
      '...&....Z......U...v........T.................',
      '...v............q.........K...C...............',
      '..............................................',
      '...................................)..........',
      '.....7..........4.........................:...',
      '...........3..................................',
      '........................3.....................',
      '..........................|...|.3.............',
      ').........%.............(((...................',
      '....................................,.........',
      '...w..p.w..h....w.|.w........h............:...',
      '....y...A........y............................',
      '..........................hhh....)............',
      '.....T.&.........T............................',
      '...K...&............U...M.....................',
      '...`.......h....K..q..........................',
      '.........................11...h...............',
      '....................................3.........',
      '..............................................',
      '.)............................................',
      '....|...:..........|..........................',
      '...........)..:...........)...................',
      '..............................................',
      '..............................................',
      '..............................................',
      '..............................................',
    ],
    // @end nerei
    spawns: {
      entrance: { x: 1, y: 16, dir: 'right' },
      inn: { x: 6, y: 14, dir: 'down' },
      pier: { x: 38, y: 16, dir: 'right' },
    },
    tilePatches: [{ cond: C.t1, x: 3, y: 14, ch: 'm' }],
    npcs: [
      // --- the inn and the general store
      K.npc('inn', 'innkeeper', 7, 8, { event: 'common_inn', fixed: true }),
      K.folk('inn_guest', 'merchant', 4, 10, [
        { cond: REG, text: 'コーラルから来たんだが、\n夜の便が戻ってね。\n帰りは、舟歌を聞きながらさ。' },
        { text: 'コーラルからの夜の便が\n止まっていてね。しかたなく、\nここで足止めさ。' },
      ], { dir: 'right' }),
      K.npc('shop_item', 'merchant', 16, 8, { event: 'common_shop', shop: 'nerei_item', fixed: true,
        greet: 'ネレイの雑貨屋へようこそ。\n小さな店だけど、\n旅の支度ならそろうよ。' }),
      K.folk('store_girl', 'girl', 18, 11, [
        { cond: REG, text: 'マリナおばあちゃん、\n毎朝、桟橋で歌ってるの。\nとってもきれいな声なんだよ。' },
        { text: 'マリナおばあちゃんはね、\n毎晩、岬の灯をともすの。\nずっと、ずーっとだよ。' },
      ], { move: 'wander' }),
      // --- Marina's cottage (one NPC by state; the scripts pick the scene)
      K.npc('marina', 'old_woman', 28, 10, { event: 'nerei_marina', dir: 'down', cond: [{ notItem: 'k_shanty' }, NOT], fixed: true }),
      K.npc('marina_song', 'old_woman', 28, 10, { event: 'nerei_marina_song', dir: 'down', cond: [C.shell, '!isles_ship', NOT], fixed: true }),
      K.npc('marina_wait', 'old_woman', 28, 10, { event: 'nerei_marina', dir: 'down', cond: [C.shell, 'isles_ship', NOT], fixed: true }),
      K.npc('marina_home', 'old_woman', 28, 10, { event: 'nerei_marina_reward', dir: 'down', cond: REG, fixed: true }),
      // --- scene figures on the pier (never present by cond; shown by nerei_marina_song / ghost_ship_3_boss)
      K.npc('marina_pier', 'old_woman', 40, 17, { dir: 'right', cond: SCENE, fixed: true }),
      K.npc('glen_pier', 'ghost', 42, 17, { dir: 'left', cond: SCENE, fixed: true }),
      // --- the ship at the pier
      K.npc('ghostship', 'obj:r5_ghost_ship', 44, 21, { dir: 'left', cond: [C.ship, NOT], fixed: true,
        text: '幽霊船が、桟橋に横づけされている。\n青白い灯が、ゆらゆらと\n甲板を照らしている。' }),
      K.npc('wreck', 'obj:r5_ghost_wreck', 44, 21, { dir: 'left', cond: REG, fixed: true,
        text: 'グレン船長の船が、岬の岩場に\n静かに横たわっている。' }),
      // --- villagers
      K.npc('folk_a', 'fisher', 20, 16, { event: 'story_rumor', rumor: 'nerei_a', move: 'wander', push: true }),
      K.folk('pier_fisher', 'fisher', 44, 16, [
        { cond: C.fog, text: '内海の霧が晴れたそうだ。\nこのあたりの海も、\nずいぶん明るくなったよ。' },
        { cond: REG, text: 'あの船は、もう動かねえ。\nでもな、村の守り神みたいな\nもんだと思ってるよ。' },
        { cond: C.ship, text: 'ゆうべ、マリナばあさんの\n歌に呼ばれて、あの船が\n来たんだ……。\fおれは、ここで釣りを\nしながら見張ってるよ。' },
        { text: '霧の晩は、沖に青白い灯が\n見えるんだ。グレン船長の\n船だって、年寄りは言うよ。' },
      ], { dir: 'right' }),
      K.folk('beacon_keeper', 'old_man', 35, 27, [
        { cond: REG, text: 'マリナは、今でも毎晩\nこの灯をともしに来る。\n……もう、待つためじゃない。\n感謝のしるしだそうじゃ。' },
        { text: 'この岬の灯はな、マリナが\n六十年、一晩も欠かさず\nともしてきたんじゃ。\fグレンが帰る道を、\n照らすためにな。' },
      ], { dir: 'up' }),
      K.folk('laundry_woman', 'woman', 26, 19, [
        { cond: C.t4, text: '白い服の書記さんが来て、\nマリナさんの歌の本は\nないかって聞くのよ。\n……あるわけないわよね。' },
        { cond: REG, text: '洗濯物がよく乾くわ。\n霧の晩が減って、\n海の天気もいいのよ。' },
        { text: '霧が晴れないと、\n洗濯物が乾かないのよ。\nいやになっちゃう。' },
      ], { dir: 'up' }),
      K.folk('fisher_wife', 'woman', 5, 23, [
        { cond: C.t6, text: '子守歌が、途中で\n止まってしまうの。\nどうしてかしら……。' },
        { cond: REG, text: 'うちの人がね、夜の漁から\n大漁で帰ってきたの！\n舟歌を歌いながらね。' },
        { text: 'うちの人は漁師なの。\n霧の夜は、沖に出られない。\n幽霊船がこわいからね。' },
      ], { dir: 'right' }),
      K.folk('house_boy', 'boy', 7, 25, [
        { cond: REG, text: 'グレン船長って、\n英雄なんでしょ？\nぼくも船長になるんだ！' },
        { text: 'マリナばあちゃんの\n好きな人って、\n幽霊なの？' },
      ], { move: 'wander' }),
      K.folk('net_mender', 'old_man', 17, 23, [
        { cond: C.post, text: '孫に網の繕い方と、\n舟歌を教えておるんじゃ。\nどっちも、大事なことじゃ。' },
        { cond: REG, text: 'グレンはな、わしの\n兄貴分じゃった。\n……やっと、帰ってきたか。' },
        { text: 'グレンが帰らなかった嵐の\n夜のことは、よく覚えとる。\nじゃが、あいつの舟歌が、\nどうしても出てこんのじゃ。' },
      ], { dir: 'right' }),
      K.folk('shed_girl', 'girl', 19, 25, [
        { cond: REG, text: 'この網ね、わたしが\n繕ったんだよ！\nおじいちゃんにほめられたの。' },
        { text: '網の穴を数えてるの。\nひとつ、ふたつ……\nあれ、わかんなくなっちゃった。' },
      ], { move: 'wander' }),
      K.folk('beach_fisher', 'fisher', 10, 29, [
        { cond: REG, text: '舟を出すぞ！　今夜は\n霧が出ても平気だ。\n舟歌があるからな。' },
        { text: '舟は浜に上げたままさ。\n霧の夜に沖へ出たら、\n幽霊船に誘われちまう。' },
      ], { dir: 'down' }),
      K.folk('cat', 'cat', 30, 23, 'ニャー。', { move: 'wander' }),
      K.folk('chicken', 'chicken', 11, 22, 'コッコッ。', { move: 'wander' }),
    ],
    signs: [
      K.sign(1, 14, '岬の村ネレイ\n東の岬に、桟橋があります。'),
      K.sign(3, 14, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', C.t1),
      K.sign(34, 15, '岬の桟橋\n「霧の夜は、灯と歌を忘れずに」'),
      K.sign(35, 28, '岬の灯\n「帰る舟の、道しるべ」'),
      K.sign(36, 28, '古い石の灯台だ。\n小さな火が、静かに燃えている。'),
    ],
    chests: [
      K.chest('nerei_c1', 8, 26, 'p_supply'),
    ],
    events: [
      K.step('nerei_pier', 42, 19, { cond: C.ship }),
    ],
  };

  R.DB.maps.nerei = def;
})(window.RPG);
