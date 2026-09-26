// ロアの里 (roa) and the master's house (roa_house): home of the storytellers (DESIGN §10.7 P1–P2,
// §10.9.3, §10.10.1, §10.11 E7). Owner: prologue (A18b). Theme `town_roa` (§11.2.6: dirt, rubble,
// thatch; falls back to `town`), BGM `home`.
//
// roa (44×36): a forest village inside a hedge ring. The only way out is the south gate path
// (exit → world spawn `roa`); `roa_gate` stops the hero there until the master has spoken (P2).
//   north : the storytellers' hall · the master ベルナ's house (door → roa_house) · ロアの道具屋
//   middle: the green with the 語り石 (story_stone, examine `roa_stone`; blank from tier 6)
//   south : the weaver's house · the pond · the farm · a family home · the elder's house
// roa_house (20×14, theme `house`): study + bedroom. Spawns `bed` (the new game starts here,
// DB.config.start) and `entrance`; the door leads back to roa `berna_house`.
//
// Contracts: spawns entrance (inside the gate, facing up) · berna_house · stone (in front of the
// story stone, facing up: the ending E7 and story scenes) · NPC slots st_fine / st_rival two tiles
// above `entrance` (§10.10.1, conds st_show_fine / st_show_rival) · NPC `elder` (里の長老, used by
// story_home_t6) · NPC `berna` in roa_house (event roa_berna) · folk_a / folk_b (roa_a / roa_b).
(function (R) {
  'use strict';
  const K = R.Prologue;
  const C = K.C;

  const roa = {
    name: 'ロアの里', type: 'town', theme: 'town_roa', bgm: 'home',
    location: 'roa', region: 'prologue', outside: 'T', respawnSpawn: 'berna_house',
    exit: { to: 'world', spawn: 'roa' },
    onEnter: 'roa_enter',
    // @rows roa
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT,,,,,,,,TT,,,,,,,,,,,,,TT,,,,,,,,,,,TTTT',
      'TTT,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,TTT',
      'TT,BBBBBBBBBBBB,,RRRRRRRRRR,,,BBBBBBBBBB,,TT',
      'TT,BBBBBBBBBBBB,,RRRRRRRRRR,,,BBBBBBBBBB,,TT',
      'TT,Bkk_kk_kk__B,,RRRRRRRRRR,,,Bu______uB,,TT',
      'TT,B__________B,,RRRRRRRRRR,,,B_ccccc__B,,TT',
      'TT,B__________B,,RRRRRRRRRR,,,B________B,,TT',
      'TT,B__________B,,BBBBBDBBBB,,,Bo_______B,,TT',
      'TT,B__________B,,ff::::ff,,,,,B________B,,TT',
      'TT,B__________B,,,,,,:::,,,T,,BBBBDBBBBB,,TT',
      'TT,BBBBBDBBBBBB,,,,,,:::,,,,,,::,,,,,,,T,,TT',
      'TT,,,,,,::::::::::::::::::::::::::::T,,,,,TT',
      'TT,,T,,,:::::::::::::::::::::::::::::,,,,,TT',
      'TT,,,,,::,,,T,,TT:::::::::::T,::,,::,,T,,,TT',
      'TT,,,T,::,,,,,,T,:::::Q:::::,,::,,::,,,,,,TT',
      'TT,,,,,::,,,,,,,,:::::::::::,,::,BBBBBBBB,TT',
      'TT,,,,,::,,,,,,,,::::::::::W,,::,BBBBBBBB,TT',
      'TT,,,,,::,,,,~~~~~,,::::::::,,::,Bk___bbB,TT',
      'TT,BBBBBBBBB~~~~~~~,,,,,,,,,,,::,B_____bB,TT',
      'TT,BBBBBBBBB~~~|~~~~,FFFFFFF,,::,B______B,TT',
      'TT,Bb_____pB~~~|~~~,,F,,,,,F,,::,B_th___B,TT',
      'TT,Bb______B,~~|~~,,,F,,,,,F,,::,B______B,TT',
      'TT,B_______B,,,:,,,,,F,,,,,F,,::,B______B,TT',
      'TT,B__th___B,,,,,,,,,F,,,,,F,,::,BBBDBBBB,TT',
      'TT,B_______B,,,,,,,,,F,,,,,F,,::,,::,,,,,,TT',
      'TT,B_______B,,,,,,,,,FFF:FFF,,::,,,,,,,,,,TT',
      'TT,BBBBDBBBB,,,,,,,,,,,,:,,,,,::,,RRRRRR,,TT',
      'TT,,,,,,,,,,,,,,,,,,T,,,:,,,,,::,,RRRRRR,,TT',
      'TT,,,,,,,:::::::::::::::::::::::,,RRRRRR,,TT',
      'TT,,,T,,,:::::::::::::::::::::::,,BBBBBB,,TT',
      'TTT,,,,,,,,,,,,,,,,,,,,,,,,,,::::,,,,,,,,TTT',
      'TTTT,,,,,,,,,,,,,,,,,,,,,,,,F::::F,,,,,,TTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTT::::TTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTT::::TTTTTTTTTTT',
    ],
    decor: [
      '............................................',
      '............................................',
      '..2222222222222222222222222222222222222222..',
      '..2......................................2..',
      '..2......................................2..',
      '..2..}.$.}..$...................$.$.$.k..2..',
      '..2.........{............................2..',
      '..2......................................2..',
      '..2..ee..>............................q..2..',
      '..2..............................rr......2..',
      '..2...ee&&.ee.....1....1.%............Z..2..',
      '..2.Q........Z...e........e..h...........2..',
      '..2.............h...................%....2..',
      '..2......................................2..',
      '..2......................................2..',
      '..2...............f.......f..............2..',
      '..2................e.....e...............2..',
      '..2.h.....%..h...........................2..',
      '..2.................e...e..........p...$.2..',
      '..2..............f.........f........F....2..',
      '..2......................................2..',
      '..2..$...k.............................V.2..',
      '..2..y..!.............MfMfM..............2..',
      '..2................h................&&...2..',
      '..2.......?...........fsfsf...........Z..2..',
      '..2......................................2..',
      '..2..&&...............ss.................2..',
      '..2......Z...............................2..',
      '..2......................................2..',
      '..2......................................2..',
      '..2........(.(............M..............2..',
      '..2..............................M......%2..',
      '..2......................................2..',
      '..22222222222222222222222222......22222222..',
      '............................................',
      '............................................',
    ],
    // @end roa
    spawns: {
      entrance: { x: 30, y: 32, dir: 'up' },
      berna_house: { x: 22, y: 10, dir: 'down' },
      stone: { x: 22, y: 17, dir: 'up' },
    },
    warps: [
      K.warp(22, 9, 'roa_house', 'entrance', { dir: 'up' }),
    ],
    // tier 6 → 8: the story stone turns blank until the final scene here (§10.9.1)
    tilePatches: [{ cond: [C.t6, '!final_roa'], x: 22, y: 16, ch: 'U' }],
    npcs: [
      // --- the storytellers' hall
      K.talk('teller_a', 'teller', 9, 7, [
        { cond: C.post, text: '{hero}の旅の話は、\nもう子どもたちの\nいちばん好きな話さ。' },
        { cond: ['st_t6', '!final_roa'], text: 'ベルナが、ああなってしまうとは。\n……語り部が物語を忘れる。\nこんなに恐ろしいことはない。' },
        { cond: C.done, text: 'おお、{hero}。\n年代記は進んでおるか？\nわしらにも聞かせておくれ。' },
        { text: '語り部はな、書くより\n語ることを重んじるんじゃ。\n覚えて、語り直す。\f字は消えても、声は\n人から人へ残る。\nそれが語り部の務めよ。' },
      ], { dir: 'down', fixed: true }),
      K.talk('teller_b', 'teller', 12, 7, [
        { cond: C.post, text: '白く抜けていた本の文字が、\nみんな戻ってきたんじゃ。\n長く生きてみるもんじゃな。' },
        { cond: C.t6, text: '本の文字が、ところどころ\n白く抜けておる。\nこれも白紙のせいかのう。' },
        { cond: C.done, text: '灯台の守り歌が戻ったと、\n風のうわさで聞いたよ。\nさすがはベルナの弟子だ。' },
        { text: '近ごろ、昔話の続きが\n思い出せんことがある。\n……わしだけではないらしい。' },
      ], { dir: 'left', fixed: true }),
      K.talk('hall_girl', 'girl', 6, 10, [
        { cond: C.post, text: '{hero}のお話、ぜんぶ\n覚えたよ！　今度は\nわたしが語ってあげる！' },
        { cond: C.t6, text: '子守歌の続き、\nだれも覚えてないの。\n……さみしいな。' },
        { cond: C.done, text: 'ねえ、灯台のお話して！\n……また今度？　約束よ！' },
        { text: '{hero}、どこか行くの？\nおみやげのお話、\n聞かせてね！' },
      ], { dir: 'up', push: true }),
      K.talk('hall_boy', 'boy', 12, 10, [
        { cond: C.done, text: '灯台のおばけを\n追い払ったって、ほんと？\nすっごーい！' },
        { text: 'ぼくも大きくなったら、\n語り部になるんだ！\n{hero}みたいに！' },
      ], { dir: 'up', push: true }),
      // --- the shop
      K.npc('shop_item', 'merchant', 33, 6, { event: 'common_shop', shop: 'roa_item', fixed: true }),
      // --- the green
      K.talk('stone_granny', 'old_woman', 19, 16, [
        { cond: C.post, text: '語り石の文字は、\n半分消えたままだけどね。\n物語は、みんなが覚えてるよ。' },
        { cond: [C.t6, '!final_roa'], text: '語り石が、真っ白に\nなっちまった……。\nこんなこと、初めてだよ。' },
        { text: 'この語り石には、里の始まりの\n物語が刻んであったんだよ。\n……半分、消えちまったけどね。' },
      ], { dir: 'right', push: true }),
      K.npc('folk_a', 'man', 19, 13, { event: 'story_rumor', rumor: 'roa_a', move: 'wander', push: true }),
      K.npc('folk_b', 'woman', 26, 13, { event: 'story_rumor', rumor: 'roa_b', move: 'wander', push: true }),
      K.talk('dog', 'dog', 29, 20, 'ワン！', { move: 'wander', push: true }),
      // --- the pond
      K.talk('angler', 'old_man', 15, 21, [
        { cond: C.done, text: '海の魚も、そろそろ\n釣れるようになったかのう。\nこの池の主は、まだまだじゃ。' },
        { text: 'この池の主は、わしの\n釣り針をずっと避けておる。\nかしこい魚じゃ。' },
      ], { dir: 'up', fixed: true }),
      // --- the weaver's house
      K.talk('weaver', 'woman', 8, 23, [
        { cond: C.post, text: '子守歌の続き、\nちゃんと思い出したのよ。\n今夜、あの子に歌ってあげるの。' },
        { cond: C.t6, text: '子守歌の続きが、\nどうしても出てこないの。\n母さんが歌ってくれたのに。' },
        { cond: C.done, text: '{hero}、立派になったわね。\nベルナさんも、きっと\n鼻が高いでしょうね。' },
        { text: '機を織りながら、\n昔の歌を口ずさむのよ。\n……あら、続きが出てこない。' },
      ], { dir: 'up', push: true }),
      K.talk('weaver_boy', 'boy', 5, 26, 'かあちゃんの機織り、\nカタン、カタンって、\nいい音がするんだ。', { move: 'wander', push: true }),
      // --- the farm
      K.talk('farmer', 'farmer', 23, 24, [
        { cond: C.t4, text: '記録院の書記が、畑の歌まで\n書き写していったよ。\n変わった連中だ。' },
        { cond: C.done, text: 'ファロスの港が開いたって？\nこれで野菜を\n売りに行けるな。' },
        { text: '今年も、よく育ってくれたよ。\n畑はうそをつかないからね。' },
      ], { move: 'wander', push: true }),
      K.talk('hen_a', 'chicken', 25, 23, 'コッコッコッ。', { move: 'wander', push: true }),
      K.talk('hen_b', 'chicken', 23, 26, 'コケッ。', { move: 'wander', push: true }),
      // --- the elder's house
      K.talk('elder', 'elder', 36, 22, [
        { cond: C.post, text: '里の者は、みな\nおまえを誇りに思っておる。\nいつでも帰っておいで。' },
        { cond: 'final_roa', text: 'ベルナが、おまえのことを\n思い出したそうじゃな。\n……よかった、よかった。' },
        { cond: 'st_berna_forgot', text: 'ベルナさんは、ひと月ほど前から\nあの調子でな……。\nおまえのことだけは、最後まで\n覚えておったんじゃが。' },
        { cond: C.done, text: '灯台に火を戻したそうじゃな。\n里の語り部の誉れじゃ。' },
        { text: 'わしはこの里の長老じゃ。\n語り石の文字が消えはじめて、\nみな心配しておる。\fベルナの言うとおり、\n世の中で何かが起きておる。\n気をつけて行くのじゃぞ。' },
      ], { dir: 'left', fixed: true }),
      // --- the gate
      K.talk('gatewoman', 'woman', 27, 32, [
        { cond: C.done, text: 'おかえり、{hero}。\nたまには里に顔を\n見せておくれよ。' },
        { cond: 'pro_berna_sent', text: 'ファロスは、里を出て\n南東へ行った所だよ。\n気をつけてね、{hero}。' },
        { text: '師匠に、あいさつして\nいかないのかい？' },
      ], { dir: 'right', push: true }),
      // --- story slots (§10.10.1): two tiles above `entrance`
      K.npc('st_fine', 'fine', 30, 30, { dir: 'down', cond: 'st_show_fine', fixed: true, text: '……。' }),
      K.npc('st_rival', 'rowell', 31, 30, { dir: 'down', cond: 'st_show_rival', fixed: true, text: '……。' }),
    ],
    signs: [
      K.sign(33, 32, 'ロアの里\n語り部の住む里'),
    ],
    chests: [],
    events: [
      K.exam('roa_stone', 22, 16),
      ...K.band('roa_gate', 29, 34, 32, 34, { cond: '!pro_berna_sent' }),
    ],
  };

  const house = {
    name: 'ロアの里', type: 'town', theme: 'house', bgm: 'home',
    location: 'roa', region: 'prologue', outside: '#', noRespawn: true,
    onEnter: 'roa_house_intro',
    enterDark: '!pro_start', // P1: black until the opening narration fades the room in
    // @rows roa_house
    rows: [
      '####################',
      '####################',
      '#kkk______kk#b____b#',
      '#___________#b____b#',
      '#___________#______#',
      '#__________________#',
      '#___________#______#',
      '#___tt______###_####',
      '#__htth_____#______#',
      '#___________#o_____#',
      '#___________#o___j_#',
      '#___________#______#',
      '#___________#__jj__#',
      '######D#############',
    ],
    decor: [
      '....................',
      '..w.$.}.$.w..p..w...',
      '.....F..Q......y.A..',
      '.y.D.....>..........',
      '...n...&&.....rrr...',
      '.......&&.....rrr.Z.',
      '..!.Z.....D.........',
      '....................',
      '........n.......U...',
      '.C........?...q.....',
      '....rrr.n...........',
      '..Z.rrr........%....',
      '........V..q........',
      '....................',
    ],
    // @end roa_house
    spawns: {
      bed: { x: 14, y: 3, dir: 'down' },
      entrance: { x: 6, y: 12, dir: 'up' },
    },
    warps: [
      K.warp(6, 13, 'roa', 'berna_house', { dir: 'down' }),
    ],
    npcs: [
      K.npc('berna', 'berna', 9, 4, { event: 'roa_berna', dir: 'down', fixed: true }),
      K.talk('cat', 'cat', 5, 3, 'ニャーオ。\n暖炉のそばが、お気に入りらしい。', { move: 'wander', push: true }),
    ],
    signs: [],
    chests: [],
    events: [],
  };

  R.DB.maps.roa = K.checkRows('roa', roa);
  R.DB.maps.roa_house = K.checkRows('roa_house', house);
})(window.RPG);
