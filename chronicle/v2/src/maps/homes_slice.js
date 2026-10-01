// CONTENT（戸口の直し）: 縦切りの町の「絵に戸が描いてある家」の中。描いた建物（v2/assets/env/*/bld）はどの家にも戸があるので、
// 押して開かない戸を残さない（オーナーの報告「最初の町、自分の家以外、扉が開かない」）。町のマップの側は戸口 door:{x, y, to} と
// 戻る所の spawn（<名>_door）を持つ。ここは中（小さな部屋・家具・住む人の短い話）だけ。
//   ロア      roa_home1〜6（roa_h1〜h6）・roa_hall_in（語り石の間。語り板を調べると roa_hall）
//   ファロス  pharos_home1〜6（ph_house1〜6）
//   フェルン  fern_home1〜3（fern_b_house1〜3）・fern_shed（fern_b_shed）
//   ユラ      yura_home_elder・yura_home1〜4（yura_b_elder・yura_b_h1〜h4）
// どれも K.room（上 2 行が壁、下の中ほどに 1 マスの戸口）。spawn は door（戸口の真上 = 内側）だけ。
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
      K.put(g, door.x, door.y, 'd');   // 戸口は 1 マス（外の扉の絵も 1 マス）
      K.def(id, {
        name: o.name, kind: 'interior', region: o.region, location: o.location,
        legend: K.ROOM_LEGEND(o.wallMat || 'wall_wood', o.floorMat || 'wood_floor'), rows: g, outside: o.wallMat || 'wall_wood',
        objects: K.furnish(o.floor, o.wall).concat(o.extra || []), npcs: o.npcs || [],
        spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 1, h: 1, to: { map: o.town, spawn: o.back } }],
        light: { ambient: o.ambient || '#7c5e4e', k: 0.82, mood: 'interior' }, bgm: o.bgm,
        meta: { sub: o.sub || '', minimap: false },
        optional: o.optional || undefined,
      });
    }
    const npc = (id, look, x, y, lines, o) => Object.assign({ id, look, x, y, dir: 's', move: 'still', talk: talk(...lines) }, o || {});

    // ---------------------------------------------------------------- ロア（丘の上の里）
    const ROA = { town: 'roa', region: 'prologue', location: 'roa', bgm: 'home' };
    // 家族の家（10×8）: 大きな寝台・食卓・台所の石の床
    home('roa_home1', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home1.name'), back: 'h1_door', w: 10, h: 8,
      wall: '..w..h..',
      floor: [
        'D-.R.lHJ',
        '.......V',
        '.cL-c...',
        'P......b',
        'p......x'],
      rugs: [[2, 3, 5, 3]], stone: [[6, 2, 3, 2]],
      npcs: [npc('mother', 'npc_woman_1', 6, 4, R.T('map.homes_slice.roa_home1.npcs.0.mother'), { name: R.T('map.homes_slice.roa_home1.npcs.0.mother.name') })] }));
    // 木こりの家（9×8）: 暖炉と薪、角の飾り・道具
    home('roa_home2', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home2.name'), back: 'h2_door', w: 9, h: 8,
      wall: '.a....o',
      floor: [
        'B.KF-g.',
        '......g',
        'cT...xg',
        's......',
        'k.....b'],
      rugs: [[2, 3, 3, 2]],
      npcs: [npc('woodman', 'npc_man_3', 4, 4, [R.T('map.homes_slice.roa_home2.npcs.0.woodman.0')], { name: R.T('map.homes_slice.roa_home2.npcs.0.woodman.name') })] }));
    // おばあさんの家（9×8）: 糸車・本棚・暖炉・絵
    home('roa_home3', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home3.name'), back: 'h3_door', w: 9, h: 8,
      wall: '..p..w.',
      floor: [
        'SJ.F-.B',
        'Q......',
        '..cT..P',
        '.......',
        'pk....V'],
      rugs: [[2, 3, 5, 3]],
      npcs: [npc('granny', 'npc_old_f_2', 5, 4, R.T('map.homes_slice.roa_home3.npcs.0.granny'), { name: R.T('map.homes_slice.roa_home3.npcs.0.granny.name') })] }));
    // 里の男の家（10×8）: 寝台 2 つ・燭台・壁掛け・かまど
    home('roa_home4', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home4.name'), back: 'h4_door', w: 10, h: 8,
      wall: 'w..y.w..',
      floor: [
        '.BB.C.KR',
        '.......H',
        '...cL-c.',
        'J......P',
        'b.....lp'],
      rugs: [[4, 3, 4, 3]], stone: [[7, 3, 2, 2]],
      npcs: [npc('father', 'npc_man_4', 2, 4, [R.T('map.homes_slice.roa_home4.npcs.0.father.0')], { name: R.T('map.homes_slice.roa_home4.npcs.0.father.name') })] }));
    // 畑の番小屋（8×7、板の間）: 干し草・道具・野菜かご
    home('roa_home5', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home5.name'), back: 'h5_door', w: 8, h: 7, plank: true,
      wall: '..o..h',
      floor: [
        'hh.bx.',
        'k....V',
        'sT...g',
        'l....k'],
      npcs: [npc('fieldkeeper', 'npc_old_m_3', 4, 3, [R.T('map.homes_slice.roa_home5.npcs.0.fieldkeeper.0')], { name: R.T('map.homes_slice.roa_home5.npcs.0.fieldkeeper.name') })] }));
    // 池のそばの家（9×7）: 大きな寝台・絵・窓 2 つ
    home('roa_home6', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_home6.name'), back: 'h6_door', w: 9, h: 7,
      wall: 'w..p..w',
      floor: [
        '.D-.KJ.',
        'P......',
        '...cTc.',
        'pl....V'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('pondwife', 'npc_woman_4', 2, 4, [R.T('map.homes_slice.roa_home6.npcs.0.pondwife.0')], { name: R.T('map.homes_slice.roa_home6.npcs.0.pondwife.name') })] }));
    // 語り石の間（12×9、石の壁）: 奥の壁ぎわに語り板。まん中の 2 枚を調べると roa_hall（語り直した伝承の文）
    home('roa_hall_in', Object.assign({}, ROA, { name: R.T('map.homes_slice.roa_hall_in.name'), sub: R.T('map.homes_slice.roa_hall_in.sub'), back: 'hall_door', w: 12, h: 9, wallMat: 'wall_stone', floorMat: 'stone_floor',
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
    home('pharos_home1', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home1.name'), back: 'house1_door', w: 9, h: 8,
      wall: '.m..w..',
      floor: [
        'B.K..HJ',
        '......Y',
        '.cL-c..',
        'P.....b',
        'm.....x'],
      rugs: [[2, 3, 4, 3]], stone: [[6, 2, 2, 2]],
      npcs: [npc('sailorwife', 'npc_woman_2', 6, 4, [R.T('map.homes_slice.pharos_home1.npcs.0.sailorwife.0')], { name: R.T('map.homes_slice.pharos_home1.npcs.0.sailorwife.name') })] }));
    // 網引きのおじいさんの家（9×8）: 暖炉・舵輪の飾り・網
    home('pharos_home2', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home2.name'), back: 'house2_door', w: 9, h: 8,
      wall: '..wv...',
      floor: [
        'SJ..F-B',
        '.......',
        'k..sT.m',
        'b......',
        'bx....r'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('oldnet', 'npc_old_m_1', 6, 3, [R.T('map.homes_slice.pharos_home2.npcs.0.oldnet.0')], { name: R.T('map.homes_slice.pharos_home2.npcs.0.oldnet.name') })] }));
    // 船乗りの家（10×7）: 樽と酒樽の台・海図・網
    home('pharos_home3', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home3.name'), back: 'house3_door', w: 10, h: 7,
      wall: '.w...m..',
      floor: [
        'B.bb..G-',
        'R.......',
        'cT....x.',
        'mr....kl'],
      rugs: [[1, 3, 3, 2]],
      npcs: [npc('landsailor', 'npc_sailor_3', 6, 3, [R.T('map.homes_slice.pharos_home3.npcs.0.landsailor.0')], { name: R.T('map.homes_slice.pharos_home3.npcs.0.landsailor.name') })] }));
    // 母と子の家（10×8）: 寝台 2 つ・かまど・絵・かご
    home('pharos_home4', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home4.name'), back: 'house4_door', w: 10, h: 8,
      wall: '..w...p.',
      floor: [
        'BB.K.H.J',
        '........',
        '.c.L-c..',
        'V......P',
        'Y......p'],
      rugs: [[2, 3, 6, 3]], stone: [[5, 2, 3, 1]],
      npcs: [npc('mom', 'npc_woman_3', 3, 3, [R.T('map.homes_slice.pharos_home4.npcs.0.mom.0')], { name: R.T('map.homes_slice.pharos_home4.npcs.0.mom.name') }),
        npc('kid', 'npc_child_1', 7, 5, [R.T('map.homes_slice.pharos_home4.npcs.1.kid.0')], { name: R.T('map.homes_slice.pharos_home4.npcs.1.kid.name'), dir: 'w', move: 'wander' })] }));
    // 書き物の好きな男の家（11×8）: 書き物机・本棚・暖炉
    home('pharos_home5', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home5.name'), back: 'house5_door', w: 11, h: 8,
      wall: '..w....p.',
      floor: [
        'SS.E.F-.K',
        '.........',
        '....cL-c.',
        'P........',
        'pb.....xk'],
      rugs: [[5, 3, 4, 3]],
      npcs: [npc('clerkfriend', 'npc_man_1', 4, 3, [R.T('map.homes_slice.pharos_home5.npcs.0.clerkfriend.0')], { name: R.T('map.homes_slice.pharos_home5.npcs.0.clerkfriend.name') })] }));
    // 果物好きのおばあさんの家（10×7）: 干した香草・野菜とパンのかご
    home('pharos_home6', Object.assign({}, PH, { name: R.T('map.homes_slice.pharos_home6.name'), back: 'house6_door', w: 10, h: 7,
      wall: 'w.h...w.',
      floor: [
        '.J.H.K.B',
        'V.......',
        'Y...cT..',
        'p.....Pl'],
      rugs: [[5, 3, 4, 2]], stone: [[3, 2, 3, 1]],
      npcs: [npc('fruitgran', 'npc_old_f_3', 6, 3, [R.T('map.homes_slice.pharos_home6.npcs.0.fruitgran.0')], { name: R.T('map.homes_slice.pharos_home6.npcs.0.fruitgran.name') })] }));

    // ---------------------------------------------------------------- フェルン（木の上の村）
    const FE = { town: 'fern', region: 'r_forest', location: 'fern', bgm: 'village', ambient: '#76688a', floorMat: 'bark_floor' };
    home('fern_home1', Object.assign({}, FE, { name: R.T('map.homes_slice.fern_home1.name'), back: 'house1', w: 10, h: 7,
      wall: '..w.h.w.',
      floor: [
        'D-.J.H.K',
        '......V.',
        'P...cL-c',
        'pQ.....l'],
      rugs: [[5, 3, 4, 2]],
      // 前は (7, 4) = 食卓（L、2 マス幅の右の半分）の上に立っていた。食卓の手前に立たせる
      npcs: [npc('worrier', 'npc_woman_2', 7, 5, [R.T('map.homes_slice.fern_home1.npcs.0.worrier.0')], { name: R.T('map.homes_slice.fern_home1.npcs.0.worrier.name'), dir: 'n' })] }));
    home('fern_home2', Object.assign({}, FE, { name: R.T('map.homes_slice.fern_home2.name'), back: 'house2_door', w: 9, h: 8, wallMat: 'wall_bark',
      wall: '.a..c..',
      floor: [
        'S.F-.BB',
        'S......',
        '..cT..P',
        'E......',
        'g.....b'],
      rugs: [[2, 3, 5, 2]],
      npcs: [npc('rootold', 'npc_old_m_2', 6, 4, [R.T('map.homes_slice.fern_home2.npcs.0.rootold.0')], { name: R.T('map.homes_slice.fern_home2.npcs.0.rootold.name') })] }));
    home('fern_home3', Object.assign({}, FE, { name: R.T('map.homes_slice.fern_home3.name'), back: 'house3_door', w: 10, h: 7,
      wall: '.w....y.',
      floor: [
        'B.K.HJ.x',
        'r.......',
        '...cTc..',
        'bk.....P'],
      rugs: [[4, 3, 3, 2]],
      npcs: [npc('swayman', 'npc_man_2', 2, 4, [R.T('map.homes_slice.fern_home3.npcs.0.swayman.0')], { name: R.T('map.homes_slice.fern_home3.npcs.0.swayman.name') })] }));
    home('fern_shed', Object.assign({}, FE, { name: R.T('map.homes_slice.fern_shed.name'), back: 'shed_door', w: 8, h: 7, plank: true,
      wall: '...o..',
      floor: [
        'xxb.hh',
        'k....l',
        'g....x',
        'r....b'],
      npcs: [npc('hider', 'npc_child_2', 5, 3, [R.T('map.homes_slice.fern_shed.npcs.0.hider.0')], { name: R.T('map.homes_slice.fern_shed.npcs.0.hider.name'), dir: 'w' })] }));

    // ---------------------------------------------------------------- ユラ（名を置いてきた者の里）
    const YU = { town: 'yura', region: 'r_forest', location: 'yura', bgm: 'sorrow', wallMat: 'wall_moss', ambient: '#6e6282', optional: true };
    home('yura_home_elder', Object.assign({}, YU, { name: R.T('map.homes_slice.yura_home_elder.name'), back: 'elder_door', w: 10, h: 8,
      wall: '..y.c.y.',
      floor: [
        'SS.C.E.K',
        '........',
        'P.cL-c.P',
        '........',
        'pk....bp'],
      rugs: [[3, 3, 4, 3]],
      npcs: [npc('aide', 'npc_yura_folk_2', 7, 3, [R.T('map.homes_slice.yura_home_elder.npcs.0.aide.0')], { name: R.T('map.homes_slice.yura_home_elder.npcs.0.aide.name') })] }));
    home('yura_home1', Object.assign({}, YU, { name: R.T('map.homes_slice.yura_home1.name'), back: 'h1_door', w: 9, h: 7,
      wall: '.w.c..w',
      floor: [
        'B.K.HJ.',
        '......P',
        'Q...cT.',
        'l.....p'],
      rugs: [[2, 3, 4, 2]],
      npcs: [npc('long', 'npc_yura_folk_1', 4, 3, [R.T('map.homes_slice.yura_home1.npcs.0.long.0')], { name: R.T('map.homes_slice.yura_home1.npcs.0.long.name') })] }));
    home('yura_home2', Object.assign({}, YU, { name: R.T('map.homes_slice.yura_home2.name'), back: 'h2_door', w: 9, h: 8,
      wall: '..p..w.',
      floor: [
        'D-.F-.J',
        '.......',
        'c.L-c..',
        '.......',
        'Vp...kb'],
      rugs: [[2, 3, 4, 3]],
      npcs: [npc('uncalled', 'npc_yura_folk_3', 6, 4, [R.T('map.homes_slice.yura_home2.npcs.0.uncalled.0')], { name: R.T('map.homes_slice.yura_home2.npcs.0.uncalled.name') })] }));
    home('yura_home3', Object.assign({}, YU, { name: R.T('map.homes_slice.yura_home3.name'), back: 'h3_door', w: 9, h: 7,
      wall: '.w.c..w',
      floor: [
        'B.B.KR.',
        '.......',
        'P...cT.',
        'p.....l'],
      rugs: [[1, 3, 4, 2]],
      npcs: [npc('dreamer', 'npc_yura_folk_4', 2, 3, [R.T('map.homes_slice.yura_home3.npcs.0.dreamer.0')], { name: R.T('map.homes_slice.yura_home3.npcs.0.dreamer.name') })] }));
    home('yura_home4', Object.assign({}, YU, { name: R.T('map.homes_slice.yura_home4.name'), back: 'h4_door', w: 10, h: 8,
      wall: '..w.p.w.',
      floor: [
        'BB.H.J.K',
        '........',
        '..e..cT.',
        'V.......',
        'rk....pP'],
      rugs: [[2, 3, 5, 3]],
      npcs: [npc('namekid', 'npc_child_3', 5, 4, [R.T('map.homes_slice.yura_home4.npcs.0.namekid.0')], { name: R.T('map.homes_slice.yura_home4.npcs.0.namekid.name') })] }));
  });
})(window.RPG);
