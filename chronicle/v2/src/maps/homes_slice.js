// CONTENT（戸口の直し）: 縦切りの町の「絵に戸が描いてある家」の中。描いた建物（v2/assets/env/*/bld）はどの家にも戸があるので、
// 押して開かない戸を残さない（オーナーの報告「最初の町、自分の家以外、扉が開かない」）。町のマップの側は戸口 door:{x, y, to} と
// 戻る所の spawn（<名>_door）を持つ。ここは中（小さな部屋・家具・住む人の短い話）だけ。
//   ロア      roa_home1〜6（roa_h1〜h6）・roa_hall_in（語り石の間。語り板を調べると roa_hall）
//   ファロス  pharos_home1〜6（ph_house1〜6）
//   フェルン  fern_home1〜3（fern_b_house1〜3）・fern_shed（fern_b_shed）
//   ユラ      yura_home_elder・yura_home1〜4（yura_b_elder・yura_b_h1〜h4）
// どれも K.room（上 2 行が壁、下の中ほどに 2 マスの戸口）。spawn は door（戸口の内側）だけ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentP.kit;
    const P = K.prop;
    const talk = (...lines) => ({ lines: lines.map((text) => ({ text })) });

    // 家具の並べ方（部屋 12×9: 床は x 1〜10・y 2〜7、戸口 x 5〜6・y 8。戸口から上へ 2 列は空ける）
    const LAYOUT = {
      family: () => [P('bed', 1, 2), P('bed', 2, 2), P('cupboard', 4, 2), P('stove', 9, 2), P('shelf_jars', 10, 2),
        P('table', 8, 5), P('chair', 7, 5), P('chair', 9, 5), P('flower_pot', 1, 7), P('barrel', 10, 7), P('lantern', 3, 5)],
      craft: () => [P('bookshelf', 1, 2), P('bookshelf', 2, 2), P('stove', 7, 2), P('bed', 10, 2), P('bed', 10, 3),
        P('table', 2, 5), P('chair', 1, 5), P('stool', 3, 5), P('wash_tub', 9, 6), P('crate', 10, 7), P('house_plant', 1, 7)],
      small: () => [P('dresser', 1, 2), P('bed', 2, 2), P('stove', 8, 2), P('shelf_jars', 9, 2), P('table', 8, 5), P('chair', 9, 5),
        P('sack', 1, 6), P('barrel', 1, 7), P('lantern', 10, 4)],
      sailor: () => [P('bed', 1, 2), P('dresser', 2, 2), P('barrel', 9, 2), P('barrel', 10, 2), P('crate', 10, 3), P('table', 3, 5),
        P('chair', 2, 5), P('stool', 4, 5), P('rug_roll', 9, 6), P('lantern', 8, 4), P('flower_pot', 1, 7)],
      shed: () => [P('crate', 1, 2), P('crate', 2, 2), P('barrel', 9, 2), P('barrel', 10, 2), P('sack', 1, 3), P('hay', 10, 4),
        P('crate', 1, 7), P('sack', 10, 7), P('lantern', 4, 3)],
    };
    const RUG = { family: [4, 4, 3, 2], craft: [5, 3, 3, 3], small: [3, 4, 3, 2], sailor: [5, 4, 3, 2], shed: null };

    function home(id, o) {
      const w = o.w || 12, h = o.h || 9;
      const { g, door } = K.room(w, h);
      const rug = o.rug !== undefined ? o.rug : RUG[o.layout];
      if (rug) K.rect(g, rug[0], rug[1], rug[2], rug[3], 'c');
      K.def(id, {
        name: o.name, kind: 'interior', region: o.region, location: o.location,
        legend: K.ROOM_LEGEND(o.wall || 'wall_wood', o.floor || 'wood_floor'), rows: g, outside: o.wall || 'wall_wood',
        objects: (o.objects || LAYOUT[o.layout]()).concat(o.extra || []), npcs: o.npcs || [],
        spawns: { door: { x: door.x, y: door.y - 1, dir: 'n' } },
        exits: [{ x: door.x, y: door.y, w: 2, h: 1, to: { map: o.town, spawn: o.back } }],
        light: { ambient: o.ambient || '#8a6a58', k: 0.85, mood: 'interior' }, bgm: o.bgm,
        meta: { sub: o.sub || '', minimap: false },
        optional: o.optional || undefined,
      });
    }
    const npc = (id, look, x, y, lines, o) => Object.assign({ id, look, x, y, dir: 's', move: 'still', talk: talk(...lines) }, o || {});

    // ---------------------------------------------------------------- ロア（丘の上の里）
    const ROA = { town: 'roa', region: 'prologue', location: 'roa', bgm: 'home' };
    home('roa_home1', Object.assign({}, ROA, { name: '里の家', back: 'h1_door', layout: 'family',
      npcs: [npc('mother', 'npc_woman_1', 4, 5, ['いらっしゃい。\nうちの子なら、広場で\n遊んでいるよ。', 'ベルナさんの話は、\nいつ聞いても\n胸があたたかくなるね。'], { name: '里の母親' })] }));
    home('roa_home2', Object.assign({}, ROA, { name: '木こりの家', back: 'h2_door', layout: 'craft',
      npcs: [npc('woodman', 'npc_man_3', 5, 4, ['薪は十分に割ってある。\n今夜も冷えるからな。'], { name: '里の木こり' })] }));
    home('roa_home3', Object.assign({}, ROA, { name: '里の家', back: 'h3_door', layout: 'small',
      npcs: [npc('granny', 'npc_old_f_2', 5, 4, ['お茶でも飲んでいくかい。', 'おや、旅に出るのかい。\n気をつけて行くんだよ。'], { name: '里のおばあさん' })] }));
    home('roa_home4', Object.assign({}, ROA, { name: '里の家', back: 'h4_door', layout: 'family',
      npcs: [npc('father', 'npc_man_4', 6, 4, ['外の森は深い。\n門を出たら、道から\n外れないことだ。'], { name: '里の男' })] }));
    home('roa_home5', Object.assign({}, ROA, { name: '畑の番小屋', back: 'h5_door', layout: 'shed', w: 12, h: 9,
      npcs: [npc('fieldkeeper', 'npc_old_m_3', 5, 4, ['畑の番をして四十年。\n土は正直だよ。\n手をかけた分だけ育つ。'], { name: '畑の番人' })] }));
    home('roa_home6', Object.assign({}, ROA, { name: '池のそばの家', back: 'h6_door', layout: 'small',
      npcs: [npc('pondwife', 'npc_woman_4', 5, 4, ['池のほとりには、\n夜になると光る\nきのこが生えるの。'], { name: '里の女' })] }));
    // 語り石の間（16×11、石の壁）: 奥の壁ぎわに語り板。まん中の板を調べると roa_hall（語り直した伝承の文）
    home('roa_hall_in', Object.assign({}, ROA, { name: '語り石の間', sub: '語り部の里', back: 'hall_door', w: 16, h: 11, wall: 'wall_stone', floor: 'stone_floor',
      rug: [6, 4, 4, 5], ambient: '#6a6a8a',
      objects: [P('talestone', 3, 2), P('talestone', 5, 2), P('talestone', 7, 2), P('talestone', 8, 2), P('talestone', 10, 2), P('talestone', 12, 2),
        P('lamp_post', 1, 3), P('lamp_post', 14, 3), P('bench', 3, 6), P('bench', 12, 6), P('flower_pot', 1, 9), P('flower_pot', 14, 9),
        K.exam(7, 2, 'roa_hall'), K.exam(8, 2, 'roa_hall')] }));

    // ---------------------------------------------------------------- ファロス（港町）
    const PH = { town: 'pharos', region: 'prologue', location: 'pharos', bgm: 'town' };
    home('pharos_home1', Object.assign({}, PH, { name: '港の家', back: 'house1_door', layout: 'family',
      npcs: [npc('sailorwife', 'npc_woman_2', 4, 5, ['夫の船は、灯台が\n消えてから港を\n出られないの。'], { name: '船乗りの妻' })] }));
    home('pharos_home2', Object.assign({}, PH, { name: '港の家', back: 'house2_door', layout: 'craft',
      npcs: [npc('oldnet', 'npc_old_m_1', 5, 4, ['若いころは、わしも\n灯台の下で\n網を引いたもんじゃ。'], { name: '港のおじいさん' })] }));
    home('pharos_home3', Object.assign({}, PH, { name: '船乗りの家', back: 'house3_door', layout: 'sailor',
      npcs: [npc('landsailor', 'npc_sailor_3', 6, 4, ['陸の上は、どうも\n落ち着かねえな。\n早く海に出てえ。'], { name: '船乗り' })] }));
    home('pharos_home4', Object.assign({}, PH, { name: '港の家', back: 'house4_door', layout: 'family',
      npcs: [npc('mom', 'npc_woman_3', 4, 5, ['潮の香りがする\n町でしょう。\nわたしは好きよ。'], { name: '港の女' }),
        npc('kid', 'npc_child_1', 8, 6, ['灯台がまた光ったら、\nぼくも船に\n乗せてもらうんだ。'], { name: '港の子ども', dir: 'w', move: 'wander' })] }));
    home('pharos_home5', Object.assign({}, PH, { name: '港の家', back: 'house5_door', layout: 'small', w: 14,
      npcs: [npc('clerkfriend', 'npc_man_1', 6, 4, ['記録院の人たちが\n来てから、町が\n少し静かになった。'], { name: '港の男' })] }));
    home('pharos_home6', Object.assign({}, PH, { name: '港の家', back: 'house6_door', layout: 'craft',
      npcs: [npc('fruitgran', 'npc_old_f_3', 5, 4, ['夜市の果物は、\n朝に買うより\n安いんだよ。'], { name: '港のおばあさん' })] }));

    // ---------------------------------------------------------------- フェルン（木の上の村）
    const FE = { town: 'fern', region: 'r_forest', location: 'fern', bgm: 'village', ambient: '#8a7a9a' };
    home('fern_home1', Object.assign({}, FE, { name: '村の家', back: 'house1', layout: 'family', floor: 'bark_floor',
      npcs: [npc('worrier', 'npc_woman_2', 4, 5, ['森で帰らない人が\nいるの。無事だと\nいいのだけど。'], { name: '村の女' })] }));
    home('fern_home2', Object.assign({}, FE, { name: '村の家', back: 'house2_door', layout: 'craft', wall: 'wall_bark', floor: 'bark_floor',
      npcs: [npc('rootold', 'npc_old_m_2', 5, 4, ['千年樹の根は、\nこの村の下まで\n伸びているそうじゃ。'], { name: '村のおじいさん' })] }));
    home('fern_home3', Object.assign({}, FE, { name: '村の家', back: 'house3_door', layout: 'small', floor: 'bark_floor',
      npcs: [npc('swayman', 'npc_man_2', 5, 4, ['木の上の家は、\n風の日によく揺れる。\nもう慣れたがね。'], { name: '村の男' })] }));
    home('fern_shed', Object.assign({}, FE, { name: '物置小屋', back: 'shed_door', layout: 'shed', rug: null,
      npcs: [npc('hider', 'npc_child_2', 8, 5, ['しーっ。\nかくれんぼの\n最中なんだ。'], { name: '村の子ども', dir: 'w' })] }));

    // ---------------------------------------------------------------- ユラ（名を置いてきた者の里）
    const YU = { town: 'yura', region: 'r_forest', location: 'yura', bgm: 'sorrow', wall: 'wall_moss', ambient: '#8a7a9a', optional: true };
    home('yura_home_elder', Object.assign({}, YU, { name: '長老の家', back: 'elder_door', layout: 'craft',
      npcs: [npc('aide', 'npc_yura_folk_2', 5, 4, ['長老さまは、名を\n忘れても、里の者の\n顔は忘れない。'], { name: '長老の付き人' })] }));
    home('yura_home1', Object.assign({}, YU, { name: 'ユラの家', back: 'h1_door', layout: 'small',
      npcs: [npc('long', 'npc_yura_folk_1', 5, 4, ['この家に住んで\nどれだけたつのか、\nもう分からないの。'], { name: 'ユラの人' })] }));
    home('yura_home2', Object.assign({}, YU, { name: 'ユラの家', back: 'h2_door', layout: 'family',
      npcs: [npc('uncalled', 'npc_yura_folk_3', 4, 5, ['名前を呼ばれない\n暮らしにも、\nもう慣れました。'], { name: 'ユラの人' })] }));
    home('yura_home3', Object.assign({}, YU, { name: 'ユラの家', back: 'h3_door', layout: 'small',
      npcs: [npc('dreamer', 'npc_yura_folk_4', 5, 4, ['夢の中でだけ、\nだれかがわたしの\n名を呼ぶんです。'], { name: 'ユラの人' })] }));
    home('yura_home4', Object.assign({}, YU, { name: 'ユラの家', back: 'h4_door', layout: 'craft',
      npcs: [npc('namekid', 'npc_child_3', 5, 4, ['ねえ、きみの名前は\nなんていうの？\nいいなあ。'], { name: '名のない子' })] }));
  });
})(window.RPG);
