// 雪の村ユール (yule): the snow village of r_snow ノルデン雪原 (DESIGN §10.6.1, §10.8.0, §10.8.4, §11.2.6).
// Owner: R3 (reg3). Theme `town_snow` (snowy cobbles, ashlar, snow-laden slate roofs, heavy timber),
// BGM `village`, outside `T` (a fir forest ring: every tree inside the map stands on snow, so it is
// drawn as a snow-laden fir). 52×42 — larger than the widest field view (32×28), so no void shows.
//
// Layout (the rows are drafted with tools/fixtures/reg3/gen_yule.py):
//   north : 宿屋 (inn) · 集会所 (the meeting hall with the great hearth, yule_hearth) · 酒場 (tavern)
//   middle: the main street · 道具屋 · the plaza (白竜の像, the frozen well, a snowman) · 鍛冶屋
//           (weapon + armour counters and the forge)
//   south : 村長ヨルンの家 · 猟師ベックの小屋 · a family home · the frozen pond (ice fishing) ·
//           the sheep pen · the gate road (exit → world spawn `yule`)
// While the blizzard lasts (r_snow not cleared) the streets are snowed over (tilePatches) and the
// children stay indoors; after the clear the cobbles show again and the children play outside.
//
// Contracts (other areas rely on these):
//   spawns  entrance (the gate road, facing up) · inn (in front of the inn door, facing down)
//   NPC ids inn · tavern · shop_item / shop_weapon / shop_armor · folk_a / folk_b (story_rumor
//           yule_a / yule_b) · scribe (tier 4–6) · st_rival / st_fine / st_extra (§10.8.0-7:
//           inn +2 down / +2 down +2 right / +2 down +2 left, facing up) · jorn (村長ヨルン) ·
//           sonja (火守りの娘ソーニャ) · beck (猟師ベック) · hearth / hearth_lit (the great hearth)
//   events  onEnter yule_enter (the intro yule_intro, once: snow_start)
(function (R) {
  'use strict';
  const npc = (id, sprite, x, y, o) => Object.assign({ id, sprite: sprite.includes(':') ? sprite : 'npc:' + sprite, x, y, dir: 'down' }, o || {});
  const talk = (id, sprite, x, y, text, o) => npc(id, sprite, x, y, Object.assign({ text }, o || {}));
  const sign = (x, y, text, cond) => (cond != null ? { x, y, text, cond } : { x, y, text });
  const C = {
    clr: { cleared: 'r_snow' }, snow: { notCleared: 'r_snow' }, post: { postgame: true }, fog: 'final_open',
    t4: { tier: 4 }, flame: 'snow_flame',
  };
  // the blizzard: street cells snowed over until the region is cleared
  const DRIFT = [[3, 13, 15, 2], [35, 13, 14, 2], [3, 25, 22, 2], [27, 25, 22, 2], [25, 27, 2, 11], [24, 38, 4, 4], [19, 21, 2, 2], [31, 15, 2, 2]];

  const def = {
    name: '雪の村ユール', type: 'town', theme: 'town_snow', bgm: 'village',
    location: 'yule', region: 'r_snow', outside: 'T', respawnSpawn: 'inn',
    exit: { to: 'world', spawn: 'yule' },
    onEnter: 'yule_enter',
    decorLegend: { '|': 'forge', ':': 'cradle' },
    // @rows yule
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TTTT***********TTTBBBBBBBBBBBBBBBBB*TT**********TTTT',
      'TTTBBBBBBBBBBBB***BBBBBBBBBBBBBBBBB***BBBBBBBBBBBBTT',
      'TT*BBBBBBBBBBBB***B_u____ccc____u_B***BBBBBBBBBBBBTT',
      'TT*Bb_b____c__B*T*B_______________B***Bo_________BTT',
      'TT*Bb_b____c__B***B__h_h_____h_h__B*T*B_ccccc____BTT',
      'TT*B_______c__B***B__tttt___tttt__B***B__________BTT',
      'TT*B__________BT**B___h_h_____h_h_B***B_hth__hth_BTT',
      'TT*Bb_b___hth_B*T*B_______________BT**B__________BTT',
      'TT*Bb_b_______B***Bo_____________oB*T*B_hth____p_BTT',
      'TT*BBBBBDBBBBBB***B_p___________p_B***BBBBBDBBBBBBTT',
      'TT****************BBBBBBBBDBBBBBBBB***************TT',
      'TT*..............................................TTT',
      'TTT..............................................TTT',
      'TTT****************..............****************TTT',
      'TT*BBBBBBBBBB******..............****BBBBBBBBBBBBBTT',
      'TT*BBBBBBBBBB*RRRR*..............****BBBBBBBBBBBBBTT',
      'TT*Buu____uuB*RRRR*..............****B___________BTT',
      'TT*B__ccc___B*RRRR*..............****B_ccc___ccc_BTT',
      'TTTB________B*BBBB*..............****B___________BTT',
      'TTTBo______pB******..............****B___________BTT',
      'TT*B________B******..............****Bo_________oBTT',
      'TT*BBBBDBBBBB************..**********BBBBBBDBBBBBBTT',
      'TTT**********************..**********************TTT',
      'TTT..............................................TTT',
      'TTT..............................................TTT',
      'TTT**********************..********************T*TTT',
      'TT*BBBBBBBBBBB***********..**************eeeeeee**TT',
      'TT*BBBBBBBBBBB**BBBBBBBB*..**BBBBBBBBBT*eeeeeeeee*TT',
      'TT*Bb______kkB**BBBBBBBB*..T*BBBBBBBBB**eeee~eeee*TT',
      'TT*Bb________B**Bb____oB*..*TBb_b__kkB**eeeeeeeee*TT',
      'TT*B___hth___B**Bb_____B*..**Bb_b____B**eeeeeeee**TT',
      'TT*B_________BT*B______B*..**B_______B****eeeee***TT',
      'TT*B_______b_B*TB____t_B*..**B_th____B************TT',
      'TT*Bp______b_B**Bj_____B*..**B_______B**FFF**FFF*TTT',
      'TT*BBBBBDBBBBB**BBBDBBBB*..**BBBBDBBBB**F******F*TTT',
      'TTT**********************..*************F******F*TTT',
      'TTT***********T*********....*******T*T**F******F*TTT',
      'TTTT***********T******TT....TT******T***FFFFFFFF*TTT',
      'TTTTTTTTTTTTTTTTTTTTTTT*....*TTTTTTTTTTTTTTTTTTTTTTT',
      'TTTTTTTTTTTTTTTTTTTTTTTT....TTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    decor: [
      '....................................................',
      '....................................................',
      '....................................................',
      '...................w..^.w.b...b.w..^w...............',
      '....w.^.p.^.w.^.........................HHHHH.w.^...',
      '.........F...C.........%..r..%................NN....',
      '..........................r.........................',
      '........&.................r.....................Z...',
      '..........................r.........................',
      '.....y..............e.....r.....e...........&&......',
      '.............Z......eee...r...eee...................',
      '....................?.....r.....!...................',
      '...3...;..7.....M....^..........^.3.......^..j..3...',
      '....................................................',
      '....................................;...............',
      '....;......3...;...3............3...................',
      '................;....u.......;....;.................',
      '.....$..k.w....................;...;...x.x.w.c.c....',
      '...............%...................(..X....|....Y...',
      '...............%......e.......e.....................',
      '...........Z..U....;...........;;.%.................',
      '..............q%%..................(..X.........Y...',
      '....q.....q........3............3......O.......O....',
      '..................................U.................',
      '........4........3...............;3......5...6......',
      '....................................................',
      '....................................;...............',
      '....E........3;;.......]...........;..3;............',
      '....................................................',
      '....w.^.p.^.w.......................................',
      '......F..A.......w...^........w.^.p.^.%.............',
      '....................X.............K.................',
      '....................................................',
      '.....&&...........s................:................',
      '....V..................3%...3.........;.............',
      '.....Z................%........&&...?...............',
      '..........E.........................................',
      '....%.......%%........;.....];......................',
      '.....;;#................3..3........................',
      '....................................................',
      '....................................................',
      '....................................................',
    ],
    // @end yule
    spawns: {
      entrance: { x: 25, y: 39, dir: 'up' },
      inn: { x: 8, y: 12, dir: 'down' },
    },
    tilePatches: [
      { cond: { tier: 1 }, x: 23, y: 38, ch: 'm' }, // 記録院の立て札 (§10.9.1)
    ].concat(DRIFT.map(([x, y, w, h]) => ({ cond: C.snow, x, y, w, h, ch: '*' }))),
    npcs: [
      // --- the intro: the chief meets the traveller at the gate (yule_intro)
      npc('jorn_gate', 'elder', 25, 35, { event: 'yule_intro', cond: '!snow_start', fixed: true }),
      // --- 集会所 (the meeting hall)
      npc('statue', 'obj:r3_dragon_statue', 25, 18, { event: 'yule_statue', fixed: true }),
      npc('hearth', 'obj:r3_hearth_cold', 26, 4, { event: 'yule_hearth', cond: '!snow_flame', fixed: true }),
      npc('hearth_lit', 'obj:r3_hearth_lit', 26, 4, { event: 'yule_hearth', cond: 'snow_flame', fixed: true }),
      npc('sonja', 'girl', 24, 5, { event: 'yule_sonja', dir: 'down', fixed: true }),
      npc('jorn', 'elder', 28, 6, { event: 'yule_jorn', cond: 'snow_start', dir: 'down', fixed: true }),
      talk('hall_elder', 'old_man', 21, 6, [
        { cond: C.post, text: 'わしらの物語を、孫たちが\n覚えてくれた。\nもう忘れはせんよ。' },
        { cond: C.clr, text: '冬至の火の物語を、\n子どもらに語って聞かせた。\n……いいものじゃな。' },
        { text: '昔は、冬至の夜になると\n村じゅうでかまどを囲んで、\n竜の物語を語ったものじゃ。\fそれが……どうしても\n思い出せんのじゃ。' },
      ], { dir: 'down', push: true }),
      talk('hall_woman', 'woman', 30, 8, [
        { cond: C.fog, text: '内海の霧が晴れて、\n島に白い塔が見えるそうよ。\nこの村からは遠いけれど。' },
        { cond: C.clr, text: '吹雪がやんで、久しぶりに\n洗濯物が干せたの！' },
        { text: '集会所に集まっていれば、\n少しは寒さもしのげるから。\nみんな、ここで冬を越すの。' },
      ], { dir: 'up', push: true }),
      talk('hall_boy', 'boy', 22, 10, '外は吹雪で、遊べないんだ。\nつまんないの。', { cond: C.snow, move: 'wander', push: true }),
      // --- 宿屋
      npc('inn', 'innkeeper', 12, 6, { event: 'common_inn', dir: 'left', fixed: true }),
      talk('inn_guest', 'merchant', 7, 9, [
        { cond: C.t4, text: '記録院のお触れで、北の村まで\n本を集めに来るんだと。\n……物騒な話さ。' },
        { cond: C.clr, text: '吹雪がやんだ！\nやっと荷を運べるよ。' },
        { text: '吹雪で足止めされて、\nもうひと月になる。\n商売あがったりさ。' },
      ], { dir: 'right', push: true }),
      talk('inn_cat', 'cat', 5, 7, [{ cond: C.clr, text: 'ニャーン。' }, { text: 'ニャア……。' }], { move: 'wander', push: true }),
      // --- 酒場
      npc('tavern', 'bartender', 42, 5, { event: 'common_tavern', fixed: true }),
      talk('tav_hunter', 'man', 40, 8, [
        { cond: C.clr, text: '白竜さまが鎮まって、\n獲物が戻ってきた。\n今夜は乾杯だ！' },
        { text: '吹雪のせいで、猟に出られん。\nこうして飲んで待つしかない。' },
      ], { dir: 'right', push: true }),
      talk('tav_old', 'old_man', 47, 8, [
        { cond: C.t4, text: '記録院の書記が来て、\n古い本を持っていきおった。\n物騒な世の中じゃ。' },
        { cond: C.clr, text: '吹雪の晩の昔話を、\nまた酒のつまみにできるわい。' },
        { text: 'この酒場もな、昔は\n竜の歌で盛り上がったもんじゃ。' },
      ], { dir: 'left', push: true }),
      talk('tav_bard', 'bard', 45, 10, [
        { cond: C.clr, text: '白竜の歌を、また歌えるよ。\f♪　白き竜よ、北の峰に\n冬至の火を、道しるべに' },
        { text: '竜の歌の続きが、\nどうしても出てこない。\n吟遊詩人の名折れだよ。' },
      ], { dir: 'up', push: true }),
      // --- 道具屋
      npc('shop_item', 'merchant', 7, 18, { event: 'common_shop', shop: 'yule_item', fixed: true }),
      talk('shop_cust', 'woman', 5, 21, [
        { cond: C.clr, text: '日が差すと、雪がきらきら\nして、まぶしいわね。' },
        { text: '毛皮の手袋がないと、\n指がちぎれそうよ。' },
      ], { dir: 'up', push: true }),
      // --- 鍛冶屋 (weapons & armour)
      npc('shop_weapon', 'dwarf', 40, 18, { event: 'common_shop', shop: 'yule_weapon', fixed: true }),
      npc('shop_armor', 'merchant', 46, 18, { event: 'common_shop', shop: 'yule_armor', fixed: true }),
      talk('smith_boy', 'boy', 43, 21, [
        { cond: C.clr, text: '親方が言ってた。\n吹雪がやんだら、\n炉の火もよく燃えるって！' },
        { text: '槍と斧は、雪原の狩りに\n欠かせないんだ！' },
      ], { move: 'wander', push: true }),
      // --- the plaza
      npc('folk_a', 'man', 22, 21, { event: 'story_rumor', rumor: 'yule_a', move: 'wander', push: true }),
      npc('folk_b', 'woman', 29, 21, { event: 'story_rumor', rumor: 'yule_b', move: 'wander', push: true }),
      talk('scribe', 'scribe', 28, 16, '古い本はありませんか。\n記録院で、大切に保管\nいたします。', { cond: [C.t4, { tierBelow: 7 }], move: 'wander', push: true }),
      talk('snowman', 'obj:r3_snowman', 23, 17, [
        { cond: C.clr, text: '子どもたちが作った雪だるまだ。\n日の光で、少しとけかけている。' },
        { text: '子どもたちが作った雪だるまだ。\n半分、雪に埋もれている。' },
      ], { fixed: true }),
      talk('snow_kid', 'boy', 22, 17, '吹雪の中で作ったんだ。\nすぐ埋まっちゃうけど。', { cond: C.snow, dir: 'right', push: true }),
      talk('kid_boy', 'boy', 21, 18, '{hero}が白竜さまと\nお話ししたって、ほんと？', { cond: C.clr, move: 'wander', push: true }),
      talk('kid_girl', 'girl', 24, 20, '雪だるま、もうひとつ\n作るの！　手伝って！', { cond: C.clr, move: 'wander', push: true }),
      talk('dog', 'dog', 14, 25, [{ cond: C.clr, text: 'ワンワン！' }, { text: 'ワン！' }], { move: 'wander', push: true }),
      // --- 村長の家
      talk('jorn_wife', 'old_woman', 6, 32, [
        { cond: C.clr, text: 'うちの人、ずっと眠れなかったの。\nやっと、ぐっすり眠れるわ。' },
        { text: '村長のうちの人は、毎晩\nかまどの前で昔話を\n思い出そうとしているの。' },
      ], { dir: 'right', push: true }),
      // --- 猟師ベック
      talk('beck', 'man', 20, 38, [
        { cond: C.post, text: '峰の頂で、白竜さまを\n見かけたよ。空を悠々と\n飛んでいた。' },
        { cond: C.clr, text: '吹雪がやんで、狩りに出られる。\n今夜は肉を持っていくぜ。' },
        { cond: 'snow_mid', text: 'あの氷の巨人を倒したって？\n……たいしたもんだ。' },
        { text: '峰の2階に、でかい氷の巨人がいる。\f猟師のおれでも、あそこから\n先へは進めなかった。\f1階の奥も、分厚い氷の壁で\nふさがってる。' },
      ], { dir: 'up', push: true }),
      talk('woodcutter', 'man', 9, 38, [
        { cond: C.clr, text: 'まきはたっぷりある。\n冬至の火は、もう消させないさ。' },
        { cond: C.flame, text: 'まき割りは、村の男の仕事さ。\n冬至の火を絶やさないようにな。' },
        { text: 'まきはあるのに、\nかまどの火がつかないんだ。\n不思議な話さ。' },
      ], { dir: 'left', push: true }),
      // --- the family home
      talk('home_mother', 'woman', 34, 33, [
        { cond: C.clr, text: '娘が外で遊べるようになって、\nほっとしたわ。' },
        { text: '娘が、雪だるまを作りたいって\nきかないの。この吹雪じゃ……。' },
      ], { dir: 'left', push: true }),
      talk('home_girl', 'girl', 31, 33, 'お外で遊びたいなあ。', { cond: C.snow, move: 'wander', push: true }),
      // --- the pond, the pen, the gate
      talk('fisher', 'fisher', 44, 31, [
        { cond: C.clr, text: '氷の下の魚も、日の光を\n喜んでいるようだ。' },
        { text: '氷に穴を開けて、魚を釣る。\n吹雪でも、腹は減るからな。' },
      ], { dir: 'up', push: true }),
      talk('shepherd', 'farmer', 42, 34, [
        { cond: C.clr, text: '羊たちも、日なたぼっこさ。\n毛がよく乾くよ。' },
        { text: '羊の小屋が、雪で\nつぶれそうでね……。' },
      ], { dir: 'down', push: true }),
      talk('sheep_a', 'sheep', 42, 37, 'メエエ……。', { move: 'wander', push: true }),
      talk('sheep_b', 'sheep', 45, 37, 'メエエ……。', { move: 'wander', push: true }),
      talk('sheep_c', 'sheep', 44, 38, 'メエ。', { move: 'wander', push: true }),
      talk('gate_man', 'man', 27, 36, [
        { cond: C.post, text: '春の祭りの支度さ。\n{hero}さんも、\nゆっくりしていってくれ。' },
        { cond: C.clr, text: '雪かきも、もう終わりだ。\n春が来たみたいだよ。' },
        { text: '雪かきが追いつかない。\n村の入口が埋まっちまう。' },
      ], { dir: 'left', push: true }),
      // --- the story scene slots (§10.8.0-7): shown only during story_after_clear
      npc('st_rival', 'rowell', 8, 14, { dir: 'up', cond: 'st_show_rival', fixed: true }),
      npc('st_fine', 'fine', 10, 14, { dir: 'up', cond: 'st_show_fine', fixed: true }),
      npc('st_extra', 'scribe', 6, 14, { dir: 'up', cond: 'st_show_extra', fixed: true }),
    ],
    signs: [
      sign(23, 27, 'この先、北は集会所。\n南へ行けば、村の出口。'),
      sign(28, 37, 'ユールの村\f北西の峰は、白竜の峰。\n吹雪の日は近づくべからず。'),
      sign(21, 16, '古い井戸だ。\n水が凍りついている。'),
      sign(23, 38, '伝承をお持ちの方は、\n記録院の出張所へ。\n大切に保管いたします。', { tier: 1 }),
    ],
    chests: [
      { id: 'yule_c1', x: 22, y: 33, pool: 'p_supply' },
      { id: 'yule_c2', x: 46, y: 2, pool: 'p_gold' },
    ],
    events: [
      { id: 'yule_hearth', x: 25, y: 4, trigger: 'examine' },
      { id: 'yule_hearth', x: 27, y: 4, trigger: 'examine' },
    ],
  };
  R.DB.maps.yule = def;

  // ------------------------------------------------------------ art: the great hearth, the snowman
  // (the hall's 冬至の火, §11.2.11 「冬至の火（stove の赤い火を強く）」; drawn here because it is a
  // one-off set piece of this map. Keys are prefixed r3_ so they never meet another owner's.)
  const G = R.Gfx;
  function px(c, x, y, col, w, h) { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); }
  const hsh = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0; n = (n ^ (n >>> 13)) * 1274126177 >>> 0; return (n ^ (n >>> 16)) / 4294967296; };
  const STONE = ['#262a36', '#404657', '#5c6478', '#7a8299', '#9ea6bc', '#c4ccdc'];
  // the great hearth, 64×56: a chimney breast carved with the white dragon rising into the wall,
  // a wide mantel beam, carved jambs (the old story), the arched firebox and the hearthstones.
  // The lowest 16 px are exactly 48 wide (x 8..55) so it stands on its three cells.
  const HW = 64, HH = 56;
  const inBox = (x, y) => x >= 17 && x <= 46 && y >= 30 && (y >= 36 || ((x - 31.5) / 15) ** 2 + ((y - 36) / 7) ** 2 <= 1);
  const inBody = (x, y) => (y < 22 ? x >= 20 && x <= 43 : x >= 8 && x <= 55);
  function hearthBody(c, lit) {
    for (let y = 0; y < HH; y++) {
      for (let x = 0; x < HW; x++) {
        if (!inBody(x, y) || inBox(x, y)) continue;
        const row = Math.floor(y / 5), off = row % 2 ? 5 : 0;
        const jx = (x + off) % 10 === 0, jy = y % 5 === 0;
        let k = jx || jy ? 1 : 2 + Math.floor(hsh(Math.floor((x + off) / 10), row, 3) * 2.2);
        if (!jx && !jy && y % 5 === 1) k = Math.min(5, k + 1);
        if (x === 8 || x === 55 || (y < 22 && (x === 20 || x === 43))) k = 0;
        px(c, x, y, STONE[k]);
      }
    }
    // the white dragon carved on the chimney breast (pale relief)
    const RL = '#dfe4f0', RS = '#8e96ac';
    const dragon = [[31, 3], [32, 3], [30, 4], [33, 4], [29, 5], [34, 6], [33, 7], [32, 8], [31, 9], [30, 10], [30, 11], [31, 12], [32, 13], [33, 14], [34, 15],
      [34, 16], [33, 17], [26, 6], [25, 7], [24, 8], [25, 9], [27, 9], [28, 8], [36, 7], [37, 8], [38, 7], [37, 10], [38, 9], [32, 5], [29, 17], [30, 18], [31, 18]];
    for (const [x, y] of dragon) { px(c, x, y, RL); px(c, x + 1, y + 1, RS); }
    px(c, 31, 4, '#7ac8ff'); // its eye
    // the mantel beam
    for (let x = 4; x < 60; x++) { px(c, x, 22, '#6a4a2a'); px(c, x, 23, '#8e663a'); px(c, x, 24, '#7a5630'); px(c, x, 25, '#5a3c22'); px(c, x, 26, '#2e1e12'); }
    for (const x of [4, 59]) px(c, x, 22, '#2e1e12', 1, 5);
    for (let x = 6; x < 58; x += 7) px(c, x, 24, '#4a3018'); // pegs / carved knots
    // the carved story on the jambs: a flame, people around it, the dragon over the peak
    const carve = [[11, 30], [12, 29], [13, 30], [12, 31], [12, 32], [10, 36], [10, 37], [11, 38], [14, 36], [14, 37], [13, 38], [12, 35],
      [11, 42], [12, 41], [13, 42], [14, 43], [10, 43], [12, 46], [13, 45], [14, 46],
      [50, 29], [51, 30], [52, 29], [53, 30], [51, 32], [52, 32], [50, 36], [51, 35], [52, 36], [53, 37], [49, 37],
      [50, 42], [51, 41], [52, 42], [50, 44], [52, 44], [51, 46]];
    for (const [x, y] of carve) px(c, x, y, RL);
    // the firebox
    for (let y = 30; y < HH; y++) for (let x = 17; x <= 46; x++) {
      if (!inBox(x, y)) continue;
      px(c, x, y, lit ? (y > 48 ? '#3a1a0c' : '#1c0e08') : (y > 48 ? '#2a2c34' : '#0e1016'));
      if (!lit && y > 49 && hsh(x, y, 9) < 0.35) px(c, x, y, '#5a5c66');
    }
    for (let x = 16; x <= 47; x++) if (!inBox(x, 29) && inBox(x, 31)) px(c, x, 30, STONE[5]); // the arch's lit edge
    // hearthstones
    for (let x = 10; x <= 53; x++) { px(c, x, 53, STONE[4]); px(c, x, 54, STONE[3]); px(c, x, 55, STONE[1]); if (x % 7 === 3) px(c, x, 53, STONE[1], 1, 3); }
    if (!lit) {
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(hsh(i, 1, 5) * HW), y = Math.floor(hsh(i, 2, 5) * HH);
        if (inBody(x, y) && !inBox(x, y)) px(c, x, y, i % 3 ? '#e8f0ff' : '#b8c8e0');
      }
      for (let x = 4; x < 60; x++) if (hsh(x, 7, 1) < 0.65) px(c, x, 22, '#eef4ff');
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(70,100,160,0.18)'; c.fillRect(0, 0, HW, HH);
      c.globalCompositeOperation = 'source-over';
    } else {
      c.globalCompositeOperation = 'source-atop';
      const gr = c.createRadialGradient(32, 44, 4, 32, 44, 40);
      gr.addColorStop(0, 'rgba(255,150,60,0.6)');
      gr.addColorStop(0.6, 'rgba(255,120,40,0.18)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = gr; c.fillRect(0, 0, HW, HH);
      c.globalCompositeOperation = 'source-over';
    }
  }
  function logs(c, charred) {
    const L = charred ? ['#1a1210', '#2e221c', '#463630'] : ['#3a2212', '#6a4424', '#8e663a'];
    for (let x = 20; x <= 43; x++) { px(c, x, 49, L[2]); px(c, x, 50, L[1]); px(c, x, 51, L[0]); }
    for (let i = 0; i < 16; i++) { px(c, 22 + i, 47 - (i >> 2), L[1]); px(c, 22 + i, 48 - (i >> 2), L[0]); }
    for (let i = 0; i < 14; i++) { px(c, 41 - i, 46 - (i >> 2), L[2]); px(c, 41 - i, 47 - (i >> 2), L[0]); }
    px(c, 20, 49, L[0], 1, 3); px(c, 43, 49, L[0], 1, 3);
    if (charred) for (const [x, y] of [[24, 49], [30, 50], [36, 49], [27, 45], [38, 44]]) px(c, x, y, '#6a6c74');
  }
  function flames(c, f) {
    const FL = ['#8a1a08', '#d8401a', '#f4822a', '#ffc04a', '#fff2b0'];
    for (let x = 19; x <= 44; x++) {
      const hgt = 8 + Math.floor(12 * Math.sin((x - 19) / 25 * Math.PI) + 5 * hsh(x, f, 11));
      for (let i = 0; i < hgt; i++) {
        const y = 48 - i;
        if (!inBox(x, y)) continue;
        const k = i < 2 ? 1 : i >= hgt - 1 ? 0 : i >= hgt - 3 ? 1 : Math.min(4, 2 + Math.floor((hgt - i) / 5 * hsh(x, i + f * 7, 12) * 1.7));
        px(c, x, y, FL[k]);
      }
    }
    for (let i = 0; i < 8; i++) px(c, 20 + Math.floor(hsh(i, f, 13) * 24), 28 + Math.floor(hsh(i, f, 14) * 10), i % 2 ? '#ffe07a' : '#ff9a3a');
  }
  if (!G.has('obj:r3_hearth_cold')) G.def('obj:r3_hearth_cold', () => {
    const cv = G.makeCanvas(HW, HH), c = cv.getContext('2d');
    hearthBody(c, false); logs(c, true);
    return [cv];
  });
  if (!G.has('obj:r3_hearth_lit')) G.def('obj:r3_hearth_lit', () => [0, 1, 2].map((f) => {
    const cv = G.makeCanvas(HW, HH), c = cv.getContext('2d');
    hearthBody(c, true); logs(c, false); flames(c, f); logs(c, false);
    for (let x = 21; x <= 42; x++) if (hsh(x, f, 21) < 0.5) px(c, x, 48, '#ffc04a');
    return cv;
  }));
  // 白竜ネーヴェの像 (32×44): a seated stone dragon with folded wings on a snowy plinth
  if (!G.has('obj:r3_dragon_statue')) G.def('obj:r3_dragon_statue', () => {
    const cv = G.makeCanvas(32, 44), c = cv.getContext('2d');
    const S = ['#2e3342', '#4c5468', '#6c768c', '#8e98ae', '#b4bccc', '#dce2ec'];
    const shape = [
      '..............55................',
      '.............5443...............',
      '............54433..3............',
      '...........544332.43............',
      '..........544422.433............',
      '..........54420..332............',
      '...........4422.................',
      '.....5......4432................',
      '....543.....44322......55.......',
      '...5433....544322.....5443......',
      '...5433...5444322....54432......',
      '..54432..54443322...544332......',
      '..54432.544443322..5443322......',
      '..5443254444433221.54433221.....',
      '...543544444433221544433221.....',
      '....4454444443332254443322......',
      '.....44444444333222444332.......',
      '......4444444333322244321.......',
      '......44444443333222.431........',
      '.......4444433332221.3..........',
      '.......444443333222.............',
      '......5444433332221.............',
      '.....54444333332221...33........',
      '.....444443333322221.3223.......',
      '....5444433333222221.32231......',
      '....44444333332222211.2221......',
      '....44443333322222111.1211......',
      '...544433333222221111..11.......',
      '...4444333332222211111..........',
      '..544433333222222111111.........',
      '..44443333322222211111111.......',
    ];
    shape.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const k = row[x]; if (k !== '.') px(c, x, y + 1, S[+k]); } });
    px(c, 13, 4, '#7ac8ff'); // the eye
    // the plinth (16 wide at the bottom, snow on top)
    for (let y = 32; y < 44; y++) for (let x = 6; x < 26; x++) {
      const w = y < 35 ? [6, 25] : [8, 23];
      if (x < w[0] || x > w[1]) continue;
      let k = y === 32 || y === 35 ? 5 : x === w[0] || x === w[1] ? 1 : y > 40 ? 1 : 3;
      if (y > 35 && (x + y) % 6 === 0) k = 2;
      px(c, x, y, S[k]);
    }
    for (let x = 5; x < 27; x++) if (hsh(x, 3, 8) < 0.7) px(c, x, 31, '#f4f8ff');
    for (const [x, y] of [[13, 1], [14, 1], [12, 2], [4, 8], [5, 8], [23, 8], [24, 8], [3, 10]]) px(c, x, y, '#ffffff'); // snow on the crest
    px(c, 9, 38, '#2e3342', 14, 1); // the carved line
    return [cv];
  });
  if (!G.has('obj:r3_snowman')) G.def('obj:r3_snowman', () => {
    const cv = G.makeCanvas(16, 24), c = cv.getContext('2d');
    const S = ['#6a7a98', '#a8b8d0', '#dce6f2', '#ffffff'];
    const ball = (cx, cy, r) => {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = (x * x + y * y) / (r * r);
        if (d > 1.05) continue;
        const lit = (-x - y) / (r * 1.6);
        px(c, cx + x, cy + y, d > 0.8 ? S[0] : lit > 0.35 ? S[3] : lit > -0.2 ? S[2] : S[1]);
      }
    };
    ball(8, 18, 5); ball(8, 10, 4);
    px(c, 3, 9, '#5a3c22', 3, 1); px(c, 2, 8, '#5a3c22'); px(c, 11, 11, '#5a3c22', 3, 1); px(c, 13, 10, '#5a3c22'); // twig arms
    px(c, 4, 13, '#b8283a', 8, 2); px(c, 10, 15, '#b8283a', 2, 3); px(c, 4, 13, '#e0485a', 8, 1); // red scarf
    px(c, 6, 9, '#1a1a22'); px(c, 9, 9, '#1a1a22'); px(c, 8, 11, '#e87a1a', 2, 1); // eyes, carrot nose
    px(c, 8, 17, '#1a1a22'); px(c, 8, 19, '#1a1a22'); // coal buttons
    px(c, 5, 4, '#4a5a6a', 6, 3); px(c, 4, 6, '#34404c', 8, 1); px(c, 6, 4, '#6a7a8a', 2, 2); // a bucket for a hat
    px(c, 3, 23, 'rgba(40,50,80,0.35)', 10, 1);
    return [cv];
  });
})(window.RPG);
