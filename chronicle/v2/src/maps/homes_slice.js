// CONTENT（戸口の直し）: 縦切りの町の「絵に戸が描いてある家」の中。描いた建物（v2/assets/env/*/bld）はどの家にも戸があるので、
// 押して開かない戸を残さない（オーナーの報告「最初の町、自分の家以外、扉が開かない」）。町のマップの側は戸口 door:{x, y, to} と
// 戻る所の spawn（<名>_door）を持つ。ここは中（小さな部屋・家具・住む人の短い話）だけ。
//   ロア      roa_home1〜6（roa_h1〜h6）・roa_hall_in（語り石の間。語り板を調べると roa_hall）
//   ファロス  pharos_home1〜6（ph_house1〜6）
//   フェルン  fern_home1〜3（fern_b_house1〜3）・fern_shed（fern_b_shed）
//   ユラ      yura_home_elder・yura_home1〜4（yura_b_elder・yura_b_h1〜h4）
// どれも K.room（上 2 行が壁、下の中ほどに 2 マスの戸口）。spawn は door（戸口の内側）だけ。
// 部屋の広さは外の建物に合わせた小さな部屋（幅 8〜10）。家具は K.furnish の文字の絵（床の行 y = 2 から、wall = 上の壁に掛ける物）。
// 家ごとに並べ方を変える（同じ部屋を作らない）。灯り: 卓の燭台・かまど・暖炉・燭台・壁の燭台・ランタン。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const talk = (...lines) => ({ lines: lines.map((text) => ({ text })) });

    /**
     * o: {w, h, floor:[行], wall:'…', rugs:[[x,y,w,h]], stone:[[x,y,w,h]], plank:true, extra:[物], wallMat, floorMat, …}
     */
    function home(id, o) {
      const w = o.w, h = o.h;
      const { g, door } = K.room(w, h);
      if (o.plank) K.rect(g, 1, 2, w - 2, h - 3, 'p');
      for (const r of o.stone || []) K.rect(g, r[0], r[1], r[2], r[3], 'k');
      for (const r of o.rugs || []) K.rect(g, r[0], r[1], r[2], r[3], 'c');
      K.put(g, door.x, door.y, 'd'); K.put(g, door.x + 1, door.y, 'd');
      K.def(id, {
        name: o.name, kind: 'interior', region: o.region, location: o.location,
        legend: K.ROOM_LEGEND(o.wallMat || 'wall_wood', o.floorMat || 'wood_floor'), rows: g, outside: o.wallMat || 'wall_wood',
        objects: K.furnish(o.floor, o.wall).concat(o.extra || []), npcs: o.npcs || [],
        spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 2, h: 1, to: { map: o.town, spawn: o.back } }],
        light: { ambient: o.ambient || '#7c5e4e', k: 0.82, mood: 'interior' }, bgm: o.bgm,
        meta: { sub: o.sub || '', minimap: false },
        optional: o.optional || undefined,
      });
    }
    const npc = (id, look, x, y, lines, o) => Object.assign({ id, look, x, y, dir: 's', move: 'still', talk: talk(...lines) }, o || {});

    // ---------------------------------------------------------------- ロア（丘の上の里）
    const ROA = { town: 'roa', region: 'prologue', location: 'roa', bgm: 'home' };
    // 家族の家（10×8）: 大きな寝台・食卓・台所の石の床
    home('roa_home1', Object.assign({}, ROA, { name: '里の家', back: 'h1_door', w: 10, h: 8,
      wall: '..w..h..',
      floor: [
        'D-.R.lHJ',
        '.......V',
        '.cL-c...',
        'P......b',
        'p......x'],
      rugs: [[2, 3, 5, 3]], stone: [[6, 2, 3, 2]],
      npcs: [npc('mother', 'npc_woman_1', 6, 4, ['いらっしゃい。\nうちの子なら、広場で\n遊んでいるよ。', 'ベルナさんの話は、\nいつ聞いても\n胸があたたかくなるね。'], { name: '里の母親' })] }));
    // 木こりの家（9×8）: 暖炉と薪、角の飾り・道具
    home('roa_home2', Object.assign({}, ROA, { name: '木こりの家', back: 'h2_door', w: 9, h: 8,
      wall: '.a....o',
      floor: [
        'B.KF-g.',
        '......g',
        'cT...xg',
        's......',
        'k.....b'],
      rugs: [[2, 3, 3, 2]], stone: [[4, 3, 2, 1]],
      npcs: [npc('woodman', 'npc_man_3', 4, 4, ['薪は十分に割ってある。\n今夜も冷えるからな。'], { name: '里の木こり' })] }));
    // おばあさんの家（9×8）: 糸車・本棚・暖炉・絵
    home('roa_home3', Object.assign({}, ROA, { name: '里の家', back: 'h3_door', w: 9, h: 8,
      wall: '..p..w.',
      floor: [
        'SJ.F-.B',
        'Q......',
        '..cT..P',
        '.......',
        'pk....V'],
      rugs: [[2, 3, 5, 3]],
      npcs: [npc('granny', 'npc_old_f_2', 5, 4, ['お茶でも飲んでいくかい。', 'おや、旅に出るのかい。\n気をつけて行くんだよ。'], { name: '里のおばあさん' })] }));
    // 里の男の家（10×8）: 寝台 2 つ・燭台・壁掛け・かまど
    home('roa_home4', Object.assign({}, ROA, { name: '里の家', back: 'h4_door', w: 10, h: 8,
      wall: 'w..y.w..',
      floor: [
        '.BB.C.KR',
        '.......H',
        '...cL-c.',
        'J......P',
        'b.....lp'],
      rugs: [[4, 3, 4, 3]], stone: [[7, 3, 2, 2]],
      npcs: [npc('father', 'npc_man_4', 2, 4, ['外の森は深い。\n門を出たら、道から\n外れないことだ。'], { name: '里の男' })] }));
    // 畑の番小屋（8×7、板の間）: 干し草・道具・野菜かご
    home('roa_home5', Object.assign({}, ROA, { name: '畑の番小屋', back: 'h5_door', w: 8, h: 7, plank: true,
      wall: '..o..h',
      floor: [
        'hh.bx.',
        'k....V',
        'sT...g',
        'l....k'],
      npcs: [npc('fieldkeeper', 'npc_old_m_3', 4, 3, ['畑の番をして四十年。\n土は正直だよ。\n手をかけた分だけ育つ。'], { name: '畑の番人' })] }));
    // 池のそばの家（9×7）: 大きな寝台・絵・窓 2 つ
    home('roa_home6', Object.assign({}, ROA, { name: '池のそばの家', back: 'h6_door', w: 9, h: 7,
      wall: 'w..p..w',
      floor: [
        '.D-.KJ.',
        'P......',
        '...cTc.',
        'pl....V'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('pondwife', 'npc_woman_4', 2, 4, ['池のほとりには、\n夜になると光る\nきのこが生えるの。'], { name: '里の女' })] }));
    // 語り石の間（12×9、石の壁）: 奥の壁ぎわに語り板。まん中の 2 枚を調べると roa_hall（語り直した伝承の文）
    home('roa_hall_in', Object.assign({}, ROA, { name: '語り石の間', sub: '語り部の里', back: 'hall_door', w: 12, h: 9, wallMat: 'wall_stone', floorMat: 'stone_floor',
      ambient: '#5e5e7e',
      wall: '.y.c..c.y.',
      floor: [
        'C.t.tt.t.C',
        '..........',
        '..e....e..',
        '..........',
        'P........P',
        'o........o'],
      rugs: [[4, 3, 4, 5]],
      extra: [K.exam(5, 2, 'roa_hall'), K.exam(6, 2, 'roa_hall')] }));

    // ---------------------------------------------------------------- ファロス（港町）
    const PH = { town: 'pharos', region: 'prologue', location: 'pharos', bgm: 'town' };
    // 船乗りの妻の家（9×8）: 海図・網・食卓
    home('pharos_home1', Object.assign({}, PH, { name: '港の家', back: 'house1_door', w: 9, h: 8,
      wall: '.m..w..',
      floor: [
        'B.K..HJ',
        '......Y',
        '.cL-c..',
        'P.....b',
        'm.....x'],
      rugs: [[2, 3, 4, 3]], stone: [[6, 2, 2, 2]],
      npcs: [npc('sailorwife', 'npc_woman_2', 6, 4, ['夫の船は、灯台が\n消えてから港を\n出られないの。'], { name: '船乗りの妻' })] }));
    // 網引きのおじいさんの家（9×8）: 暖炉・舵輪の飾り・網
    home('pharos_home2', Object.assign({}, PH, { name: '港の家', back: 'house2_door', w: 9, h: 8,
      wall: '..wv...',
      floor: [
        'SJ..F-B',
        '.......',
        'k..sT.m',
        'b......',
        'bx....r'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('oldnet', 'npc_old_m_1', 6, 3, ['若いころは、わしも\n灯台の下で\n網を引いたもんじゃ。'], { name: '港のおじいさん' })] }));
    // 船乗りの家（10×7）: 樽と酒樽の台・海図・網
    home('pharos_home3', Object.assign({}, PH, { name: '船乗りの家', back: 'house3_door', w: 10, h: 7,
      wall: '.w...m..',
      floor: [
        'B.bb..G-',
        'R.......',
        '..cT..x.',
        'mr....kl'],
      rugs: [[3, 3, 3, 2]],
      npcs: [npc('landsailor', 'npc_sailor_3', 6, 3, ['陸の上は、どうも\n落ち着かねえな。\n早く海に出てえ。'], { name: '船乗り' })] }));
    // 母と子の家（10×8）: 寝台 2 つ・かまど・絵・かご
    home('pharos_home4', Object.assign({}, PH, { name: '港の家', back: 'house4_door', w: 10, h: 8,
      wall: '..w...p.',
      floor: [
        'BB.K.H.J',
        '........',
        '.c.L-c..',
        'V......P',
        'Y......p'],
      rugs: [[2, 3, 6, 3]], stone: [[5, 2, 3, 1]],
      npcs: [npc('mom', 'npc_woman_3', 3, 3, ['潮の香りがする\n町でしょう。\nわたしは好きよ。'], { name: '港の女' }),
        npc('kid', 'npc_child_1', 7, 5, ['灯台がまた光ったら、\nぼくも船に\n乗せてもらうんだ。'], { name: '港の子ども', dir: 'w', move: 'wander' })] }));
    // 書き物の好きな男の家（11×8）: 書き物机・本棚・暖炉
    home('pharos_home5', Object.assign({}, PH, { name: '港の家', back: 'house5_door', w: 11, h: 8,
      wall: '..w....p.',
      floor: [
        'SS.E.F-.K',
        '.........',
        '....cL-c.',
        'P........',
        'pb.....xk'],
      rugs: [[5, 3, 4, 3]],
      npcs: [npc('clerkfriend', 'npc_man_1', 4, 3, ['記録院の人たちが\n来てから、町が\n少し静かになった。'], { name: '港の男' })] }));
    // 果物好きのおばあさんの家（10×7）: 干した香草・野菜とパンのかご
    home('pharos_home6', Object.assign({}, PH, { name: '港の家', back: 'house6_door', w: 10, h: 7,
      wall: 'w.h...w.',
      floor: [
        '.J.H.K.B',
        'V.......',
        'Y.cT....',
        'p.....Pl'],
      rugs: [[3, 3, 4, 2]], stone: [[3, 2, 3, 1]],
      npcs: [npc('fruitgran', 'npc_old_f_3', 6, 3, ['夜市の果物は、\n朝に買うより\n安いんだよ。'], { name: '港のおばあさん' })] }));

    // ---------------------------------------------------------------- フェルン（木の上の村）
    const FE = { town: 'fern', region: 'r_forest', location: 'fern', bgm: 'village', ambient: '#76688a', floorMat: 'bark_floor' };
    home('fern_home1', Object.assign({}, FE, { name: '村の家', back: 'house1', w: 10, h: 7,
      wall: '..w.h.w.',
      floor: [
        'D-.J.H.K',
        '......V.',
        'P.cL-c..',
        'pQ.....l'],
      rugs: [[3, 3, 4, 2]],
      npcs: [npc('worrier', 'npc_woman_2', 7, 4, ['森で帰らない人が\nいるの。無事だと\nいいのだけど。'], { name: '村の女' })] }));
    home('fern_home2', Object.assign({}, FE, { name: '村の家', back: 'house2_door', w: 9, h: 8, wallMat: 'wall_bark',
      wall: '.a..c..',
      floor: [
        'S.F-.BB',
        'S......',
        '..cT..P',
        'E......',
        'g.....b'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('rootold', 'npc_old_m_2', 6, 4, ['千年樹の根は、\nこの村の下まで\n伸びているそうじゃ。'], { name: '村のおじいさん' })] }));
    home('fern_home3', Object.assign({}, FE, { name: '村の家', back: 'house3_door', w: 10, h: 7,
      wall: '.w....y.',
      floor: [
        'B.K.HJ.x',
        'r.......',
        '...cTc..',
        'bk.....P'],
      rugs: [[4, 3, 3, 2]],
      npcs: [npc('swayman', 'npc_man_2', 2, 4, ['木の上の家は、\n風の日によく揺れる。\nもう慣れたがね。'], { name: '村の男' })] }));
    home('fern_shed', Object.assign({}, FE, { name: '物置小屋', back: 'shed_door', w: 8, h: 7, plank: true,
      wall: '...o..',
      floor: [
        'xxb.hh',
        'k....l',
        'g....x',
        'r....b'],
      npcs: [npc('hider', 'npc_child_2', 5, 3, ['しーっ。\nかくれんぼの\n最中なんだ。'], { name: '村の子ども', dir: 'w' })] }));

    // ---------------------------------------------------------------- ユラ（名を置いてきた者の里）
    const YU = { town: 'yura', region: 'r_forest', location: 'yura', bgm: 'sorrow', wallMat: 'wall_moss', ambient: '#6e6282', optional: true };
    home('yura_home_elder', Object.assign({}, YU, { name: '長老の家', back: 'elder_door', w: 10, h: 8,
      wall: '..y.c.y.',
      floor: [
        'SS.C.E.K',
        '........',
        'P.cL-c.P',
        '........',
        'pk....bp'],
      rugs: [[3, 3, 4, 3]],
      npcs: [npc('aide', 'npc_yura_folk_2', 7, 3, ['長老さまは、名を\n忘れても、里の者の\n顔は忘れない。'], { name: '長老の付き人' })] }));
    home('yura_home1', Object.assign({}, YU, { name: 'ユラの家', back: 'h1_door', w: 9, h: 7,
      wall: '.w.c..w',
      floor: [
        'B.K.HJ.',
        '......P',
        'Q...cT.',
        'l.....p'],
      rugs: [[2, 3, 4, 2]],
      npcs: [npc('long', 'npc_yura_folk_1', 4, 3, ['この家に住んで\nどれだけたつのか、\nもう分からないの。'], { name: 'ユラの人' })] }));
    home('yura_home2', Object.assign({}, YU, { name: 'ユラの家', back: 'h2_door', w: 9, h: 8,
      wall: '..p..w.',
      floor: [
        'D-.F-.J',
        '.......',
        'c.L-c..',
        '.......',
        'Vp...kb'],
      rugs: [[2, 3, 4, 3]],
      npcs: [npc('uncalled', 'npc_yura_folk_3', 6, 4, ['名前を呼ばれない\n暮らしにも、\nもう慣れました。'], { name: 'ユラの人' })] }));
    home('yura_home3', Object.assign({}, YU, { name: 'ユラの家', back: 'h3_door', w: 9, h: 7,
      wall: '.w.c..w',
      floor: [
        'B.B.KR.',
        '.......',
        'P...cT.',
        'p.....l'],
      rugs: [[1, 3, 4, 2]],
      npcs: [npc('dreamer', 'npc_yura_folk_4', 2, 3, ['夢の中でだけ、\nだれかがわたしの\n名を呼ぶんです。'], { name: 'ユラの人' })] }));
    home('yura_home4', Object.assign({}, YU, { name: 'ユラの家', back: 'h4_door', w: 10, h: 8,
      wall: '..w.p.w.',
      floor: [
        'BB.H.J.K',
        '........',
        '..e..cT.',
        'V.......',
        'rk....pP'],
      rugs: [[2, 3, 5, 3]],
      npcs: [npc('namekid', 'npc_child_3', 5, 4, ['ねえ、きみの名前は\nなんていうの？\nいいなあ。'], { name: '名のない子' })] }));
  });
})(window.RPG);
