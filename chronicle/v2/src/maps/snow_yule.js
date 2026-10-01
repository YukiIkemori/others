// 雪の村ユール（yule）と、籠城の夜のユール（yule_night）。WORLD_REDESIGN §5.6・§4.3、STORY_BIBLE §7.3・§8.4、V2_PLAN §2.6.1
//   町 56×50。四角い家の並ぶ村ではない。深い雪の吹きだまりのあいだを、踏み固めた雪の道（トンネル）がうねってつなぐ。
//   北の中ほどに「竜の背の長屋」: 眠る白竜の背のように、こぶの並ぶ雪の屋根がうねって広場を抱く 1 棟の長い家。
//     戸口は 4 つ（西の端 = 竜の頭の道具屋・宿「雪あかり亭」・いちばん高いこぶ = 大かまどの集会所・東の武具屋）。尾は東の小道の脇で雪に沈む。
//   広場: 石を敷いた丸い「火の輪」。まん中に石組みの大かまど（冬至の火）。
//   住まいはどれも違う形: 村長ヨルンの丸い石の塔の家（北東）・火守りの家は氷のブロックの丸屋根（ソーニャ、北東）・
//     ブレンダばあさんの半地下の家（雪の丘に煙突だけ、南西）・狩人オラフの牙の小屋（マンモスの牙の骨組みに毛皮、南東）・
//     釣り小屋はそりの台に乗って凍った池の上（北西）・村はずれのノルデン分室の空き家だけが、よそ者の四角い灰色の石造り（南東の奥）。
//   ほか（戸なし）: 見張りの高い木の塔と鐘（北の門のわき。見張りの台 = 板の床）・高足の食料倉（北東）・そり犬の差しかけ小屋（南西）。
//   子どもの秘密基地は雪像の庭の東の吹きだまりの穴（戸は見えている。町なので隠し通路にはしない）。
//   灯りの形は「氷の灯籠」（WORLD §5.1）。祭の後（解決）は広場に冬至の火が大灯火として燃える（beacon）。
//   町の絵は 1 枚の下絵（v2/assets/env/snow/under/yule*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
//   yule_night は同じ形・同じ絵の、消灯の刻の版（籠城。門の前にバリケード、NPC は守り手だけ、吹雪。家には入らない）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit, L = K.L;
    const W = 56, H = 50;
    // ---------------------------------------------------------------- 地面（1 文字 = 1 マス）
    //   # 雪の吹きだまり（歩けない）・. 雪・, 踏み固めた雪の道・c 広場の敷石・i 池の氷（歩ける）・p 見張りの台の板・
    //   F 大かまどの石組み（歩けない）・Z 竜の背の長屋の胴（戸口の無い所。歩けない）
    const ROWS = [
      '###########################,,#####...###################',
      '###########################,,#pppp...###################',
      '##########################,,,ppppp...###################',
      '########.....#############,,,ppppp...######.....########',
      '#####...........#########,,,,##############.....########',
      '####.......iii...########,,,,,,,,,,########..........###',
      '###..ii....iiiii..######,,,,,,,,,,,,,,,,##...........###',
      '##..iii....iiiiii..####,,,,,######,,,,,,,,...........###',
      '##..iiiiiiiiiiiii..##,,,,,,###########,,,,,.........####',
      '##..iiiiiiiiiiiii..,,,,,,,##############,,,........#####',
      '###..iiiiiiiiiii.,,,,,,,,#################...,,....#####',
      '####...iiiiiii,,,,,,,,,,###################..,,,.....###',
      '#####.........,,,,,,,,Z...........###########,,,.....###',
      '######,,.....#,,,,,,##Z...........############,,.....###',
      '######,,######........Z...................####,,.....###',
      '#####,,,######........Z...................####,,.....###',
      '#####,,#######........Z...................ZZ#.,,..,,..##',
      '#####,,#######........Z...................ZZ##,,..,,.###',
      '#####,,######Z........Z...................ZZZ#,,,,,,.###',
      '#####,,#####ZZ........Z#.........#........ZZZ,,,...#####',
      '#####,,#.......###,,####.........####,,,#####,,,########',
      '#####,,#.......###,,,###.........###,,,,#####,,#########',
      '#####,,#.......####,,,###.......###,,,,#####,,,#########',
      '#####,,#.......####,,,,..ccccccc..,,,,######,,##########',
      '#####,,,.......#####,,,ccccccccccc,,########,,##########',
      '######,,###,,########..ccccFFFcccc..########,,##########',
      '######,,###,,########.cccccFFFccccc,,,,,,,,,,,,,########',
      '######,,,,,,,,,,,,,,,,,cccccccccccc,,,,,,,,,,,,,,,,#####',
      '#####,,,,,,,,,,,,,,,,,,cccccccccccc.#######,,,,,,,,,,,,,',
      ',,,,,,,,,,,,#########..ccccccccccc..##########,,,,,,,,,,',
      ',,,,,,,,,,############.ccccccccccc.#####################',
      '#####################,,..ccccccc..,,#......#############',
      '##############.....#,,,##...,,..##,,,......#############',
      '##############.....,,,######,,####,,,......#############',
      '##############.....,,#######,,#####,,......#############',
      '##############.....,########,,######,......#############',
      '###.....#####...,,,,########,,######,.......############',
      '###........#..,,,,,..######.,,######,,,,,....###########',
      '###.........,,,,,,..#####.......####....,,.........#####',
      '###.......,,,,,,...#####.........####...,,,.#......#####',
      '###......,,,,.#########...........##,####,,,#......#####',
      '###......,,,..#########..........,,,,,###,,,#......#####',
      '###...........#########...........########,,,......#####',
      '###...........##########.........##########,,,,,,..#####',
      '####.........############.......###########..,,,,...####',
      '######.....################...#############.........####',
      '############################################.......#####',
      '########################################################',
      '########################################################',
      '########################################################',
    ];
    const legend = S.LEGEND({
      F: { mat: 'cobble', solid: true, name: 'hearth' },
      Z: { mat: 'wall_wood', solid: true, rise: 2, name: 'longhouse' },
    });

    function build(night) {
      const g = ROWS.map((r) => [...r]);
      // 描いた下絵に合わせた当たり（2026-09-28）: 見張りの台は描いた手すり（3 行目）と左の板壁（29 列）が歩けない。台へは左上の角（29,1）から上がる。
      //   氷のドームの石の台座（15 行目、戸口の石段 50,15 の左右）も歩けない
      for (const [x, y] of [[29, 2], [29, 3], [30, 3], [31, 3], [32, 3], [33, 3], [48, 15], [49, 15], [51, 15], [52, 15]]) g[y][x] = '#';
      //   南西のそり犬の庭の下の縁（2026-10-01 持ち主「一番左下の宝箱の位置と当たりがおかしい」）: 描いた吹きだまりの斜めの縁（43 行目の 3 列から 45 行目の 6 列へ）の外は歩けない
      for (const [x, y] of [[3, 43], [4, 44], [5, 44], [6, 45]]) g[y][x] = '#';
      g[1][29] = 'p';
      const O = [];
      // ---------------------------------------------------------------- 建物（戸口は描いた扉のマス。出て着くのはその真下）
      const B = (id, x, y, w, h, o) => Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'log', windows: 2, lamp: true, chimney: true }, o || {});
      const door = (x, y, map) => (night ? null : { x, y, to: { map, spawn: 'door' } });
      const blds = [
        // 竜の背の長屋（1 棟に 4 つの戸口）
        B('yule_lh_hall', 23, 12, 11, 7, { wall: 3, windows: 3, sign: 'guild', door: door(29, 18, 'yule_hall') }),
        B('yule_lh_inn', 14, 14, 8, 6, { sign: 'inn', door: door(18, 19, 'yule_inn') }),
        B('yule_lh_items', 8, 20, 7, 5, { sign: 'item', door: door(11, 24, 'yule_items') }),
        B('yule_lh_arms', 34, 14, 8, 6, { sign: 'weapon', door: door(38, 19, 'yule_arms') }),
        // 住まい
        B('yule_jorn_tower', 43, 3, 5, 5, { roof: 'slate', mat: 'stone', door: door(45, 7, 'yule_jorn') }),
        B('yule_sonja_dome', 48, 11, 5, 4, { roof: 'ice', mat: 'ice', windows: 1, door: door(50, 14, 'yule_sonja') }),
        B('yule_brenda_pit', 14, 32, 5, 4, { wall: 1, roof: 'moss', mat: 'stone', windows: 1, door: door(16, 35, 'yule_brenda') }),
        B('yule_olaf_lodge', 37, 31, 6, 5, { roof: 'thatch', mat: 'log', door: door(39, 35, 'yule_hunter') }),
        B('yule_branch', 45, 38, 6, 5, { roof: 'slate', mat: 'stone', lamp: false, chimney: false, door: door(47, 42, 'yule_branch') }),
        B('yule_fishhut', 7, 5, 4, 3, { windows: 1, door: door(8, 7, 'yule_fishhut') }),
        // 戸の無い物（入らない。戸は描かない）
        B('yule_watch', 34, 0, 3, 4, { lamp: false, chimney: false, windows: 0 }),
        B('yule_cache', 50, 5, 3, 3, { wall: 1, lamp: false, chimney: false, windows: 0 }),
        B('yule_shed', 3, 36, 5, 3, { lamp: false, chimney: false, windows: 0 }),
      ];
      for (const b of blds) { if (!b.door) delete b.door; O.push(b); }
      // 籠城の夜は家に入らない: 戸を押すと一言（戸口は描いた扉のマス。調べる物で）
      if (night) {
        for (const [x, y] of [[29, 18], [18, 19], [11, 24], [38, 19], [45, 7], [50, 14], [16, 35], [39, 35], [47, 42], [8, 7]]) O.push(K.exam(x, y, 'yule_night_door'));
      } else {
        // 子どもの秘密基地の戸（雪の吹きだまりの穴。合言葉の後）
        O.push({ type: 'door', x: 36, y: 40, to: { map: 'yule_base', spawn: 'door' }, cond: 'snow_base_open' });
      }

      // ---------------------------------------------------------------- 広場の大かまど・祭の飾り
      // 大かまどの火は下絵に描いた炉の火。立つ火皿の絵は置かず、灯りだけ（copper_brazier を art.painted に入れて絵を出さない = 光だけの物）
      O.push(K.prop('copper_brazier', 28, 25), K.prop('copper_brazier', 28, 26));
      O.push(K.exam(28, 26, 'yule_hearth'), K.exam(27, 26, 'yule_hearth'), K.exam(29, 26, 'yule_hearth'));
      O.push(K.prop('beacon', 28, 25, { cond: 'cleared_r_snow' }));    // 冬至の火（大灯火の光の柱）
      for (const [x, y] of [[23, 24], [33, 24], [23, 30], [33, 30]]) O.push({ type: 'brazier', id: 'yule_fire_' + x + '_' + y, x, y, on: night || 'snow_festival_lit' });
      // 氷の灯籠（街灯。当たりは足もとだけ）: 吹きだまりの際・広い所だけ。道・戸口の前・門・1 マス幅の所には立てない（v2/tools/qa/check_lamps.js）
      for (const [x, y] of [[21,  26],  [23,  23],  [22,  30],  [34,  30],  [3,  31],  [52,  26],  [13,  4],  [31,  38],  [6,  38],  [44,  39]]) O.push(K.prop('snow_lamp', x, y));
      // 置き灯籠（当たりなし）: 戸口のわき・道の曲がり角
      for (const [x, y] of [[19,  21],  [10,  26],  [36,  21],  [27,  20],  [46,  9],  [48,  16],  [17,  37],  [38,  37],  [46,  44],  [9,  8],  [31,  4]]) O.push(K.prop('lantern', x, y));
      // 広場: 掲示板・行商の屋台・長椅子
      O.push(K.prop('board', 24, 19), K.exam(24, 19, 'yule_board'));
      O.push(K.prop('stall', 33, 25, { cond: '!snow_gate_n_broken' }));
      O.push(K.prop('bench', 25, 31), K.prop('bench', 31, 31));
      O.push(K.sign(31, 32, R.T('map.snow_yule.build.sign')));
      // 北: 凍った池と釣り
      for (const [x, y] of [[13, 8], [5, 9], [15, 10]]) O.push(K.prop('ice_hole', x, y));
      O.push(K.exam(13, 9, 'yule_pond'), K.exam(14, 9, 'yule_pond'));
      O.push(K.prop('ice_crystal', 3, 7), K.exam(3, 8, 'snow_mat', { mat: 'snow_mat_ice' }));   // 雪像の飾り: 澄んだ氷のかけら
      // 北の門と見張りの台
      O.push(K.exam(26, 1, 'yule_north_gate'), K.exam(29, 4, 'yule_burnt_gate'));   // 焼けた北門の柱（戦の傷 lo_war_snow）
      // そり犬の小屋（差しかけ小屋の前）
      O.push(K.prop('sled', 9, 37), K.prop('hay_sled', 4, 40));
      // 雪像の庭（依頼の像。作ったら見た目が変わる）
      O.push(K.exam(28, 41, 'yule_snowman'));
      O.push(K.prop('ice_crystal', 28, 41, { cond: { choice: 'ch_snow_statue', is: 'dragon' } }));
      O.push(K.prop('snow_rock', 28, 41, { cond: { choice: 'ch_snow_statue', is: 'wolf' } }));
      O.push(K.prop('frozen_well', 28, 41, { cond: { choice: 'ch_snow_statue', is: 'hearth' } }));
      // 小物は壁（吹きだまり）の際に少しだけ。道・広場・戸口の前には置かない（持ち主 2026-09-27。町の小物は当たらない）
      O.push(K.prop('firewood', 42, 36), K.prop('crate', 44, 9));
      // 町の宝箱（見える物だけ）
      O.push(K.chest('yule_c1', 49, 9, { pool: 'p_T' }), K.chest('yule_c2', 4, 42, { item: 'i_firepot', n: 2 }));   // そり犬の庭の西の際（描いた平らな雪の上）

      // ---------------------------------------------------------------- 籠城のしるし（夜の版）と、破られた門の跡（昼の版）
      if (night) {
        for (const [x, y] of [[27, 1], [28, 1], [1, 29], [1, 30], [54, 28], [54, 29]]) O.push(K.prop('snow_fence', x, y));
        O.push({ type: 'brazier', id: 'yule_n_gate_fire', x: 25, y: 4, on: true }, { type: 'brazier', id: 'yule_w_gate_fire', x: 8, y: 28, on: true }, { type: 'brazier', id: 'yule_e_gate_fire', x: 48, y: 27, on: true });
      } else {
        const broken = (gate, pts) => pts.forEach(([id, x, y]) => O.push(K.prop(id, x, y, { cond: 'snow_gate_' + gate + '_broken', variant: (x + y) % 2 })));
        broken('n', [['log', 26, 3], ['crate', 29, 7]]);
        broken('w', [['log', 3, 28], ['crate', 6, 31 - 1]]);
        broken('e', [['log', 52, 27], ['crate', 51, 30]]);
        // 守りきった門の家から礼（二日目。ティア宝箱）
        O.push(K.chest('yule_thanks_n', 24, 6, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_n_broken'] }));
        O.push(K.chest('yule_thanks_w', 5, 28, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_w_broken'] }));
        O.push(K.chest('yule_thanks_e', 47, 26, { pool: 'p_T', cond: ['snow_day2', '!snow_gate_e_broken'] }));
      }
      return { g, O };
    }

    // ---------------------------------------------------------------- 人（昼）
    const DAY = [
      K.npc('jorn', 'npc_jorn', 30, 21, { name: R.T('map.snow_yule.DAY.0.jorn.name'), title: R.T('map.snow_yule.DAY.0.jorn.title'), dir: 's', talk: 'yule_jorn', reward: 'lead', pushable: false }),
      K.npc('sonja', 'npc_sonja', 26, 27, { name: R.T('map.snow_yule.DAY.1.sonja.name'), title: R.T('map.snow_yule.DAY.1.sonja.title'), dir: 'n', talk: 'yule_sonja', reward: 'lead' }),
      K.npc('hald', 'npc_hald', 32, 2, { name: R.T('map.snow_yule.DAY.2.hald.name'), title: R.T('map.snow_yule.DAY.2.hald.title'), dir: 'n', talk: 'yule_hald', reward: 'lead', pushable: false }),
      K.npc('fine', 'fine', 31, 1, { name: R.T('map.snow_yule.DAY.3.fine.name'), dir: 'n', talk: [L('……')], cond: ['snow_siege_done', '!snow_fine_seen'], reward: null, pushable: false }),
      K.npc('watch_e', 'npc_snow_watch', 50, 27, { name: R.T('map.snow_yule.DAY.4.watch_e.name'), dir: 'w', talk: 'yule_watch_e', reward: 'boss' }),
      K.npc('sled_man', 'npc_snow_man', 8, 42, { name: R.T('map.snow_yule.DAY.5.sled_man.name'), title: R.T('map.snow_yule.DAY.5.sled_man.title'), dir: 'e', talk: 'yule_sled', reward: 'side' }),
      K.npc('sled_dog', 'ani_dog', 6, 43, { name: R.T('map.snow_yule.DAY.6.sled_dog.name'), dir: 'e', talk: 'yule_dog', cond: 'snow_dog_home', reward: null }),
      K.npc('sculptor', 'npc_snow_woman', 26, 40, { name: R.T('map.snow_yule.DAY.7.sculptor.name'), title: R.T('map.snow_yule.DAY.7.sculptor.title'), dir: 'e', talk: 'yule_sculptor', reward: 'side' }),
      K.npc('base_kid', 'npc_snow_child', 36, 41, { name: R.T('map.snow_yule.DAY.8.base_kid.name'), title: R.T('map.snow_yule.DAY.8.base_kid.title'), dir: 's', talk: 'yule_base_kid', reward: 'side', pushable: false, cond: '!snow_base_open' }),
      K.npc('kid_a', 'npc_snow_child', 24, 28, { name: R.T('map.snow_yule.DAY.9.kid_a.name'), dir: 'e', move: 'wander', talk: 'yule_kid_a', reward: 'hint' }),
      K.npc('kid_b', 'npc_snow_child', 32, 40, { name: R.T('map.snow_yule.DAY.10.kid_b.name'), dir: 'w', talk: 'yule_kid_b', reward: 'hint' }),
      K.npc('soup_woman', 'npc_snow_woman', 22, 28, { name: R.T('map.snow_yule.DAY.11.soup_woman.name'), dir: 'e', talk: 'yule_soup', reward: 'item' }),
      K.npc('fur_peddler', 'npc_merchant_2', 34, 25, { name: R.T('map.snow_yule.DAY.12.fur_peddler.name'), dir: 'w', talk: 'yule_fur', reward: null, pushable: false, cond: '!snow_gate_n_broken' }),
      K.npc('traveler', 'npc_traveler', 21, 25, { name: R.T('map.snow_yule.DAY.13.traveler.name'), dir: 'e', talk: 'yule_traveler', reward: 'lead' }),
      K.npc('tadeo', 'npc_oil_carrier', 46, 26, { name: R.T('map.snow_yule.DAY.14.tadeo.name'), title: R.T('map.snow_yule.DAY.14.tadeo.title'), dir: 's', talk: 'yule_tadeo', reward: 'news' }),
      K.npc('villager_m', 'npc_snow_man', 49, 19, { name: R.T('map.snow_yule.DAY.15.villager_m.name'), dir: 'w', talk: 'yule_woodsman', reward: 'lead' }),
      K.npc('old_m', 'npc_snow_old_m', 25, 20, { name: R.T('map.snow_yule.DAY.16.old_m.name'), dir: 's', talk: 'yule_oldman', reward: 'news' }),
      K.npc('scribe', 'npc_scribe', 45, 44, { name: R.T('map.snow_yule.DAY.17.scribe.name'), dir: 'e', talk: 'yule_scribe', reward: 'news', cond: { tier: { gte: 4 } } }),
      // 空気だけ（4 人まで）
      K.npc('dog', 'ani_dog', 30, 43, { name: R.T('map.snow_yule.DAY.18.dog.name'), dir: 'w', move: 'wander', talk: [L(R.T('map.snow_yule.DAY.talk.0.L'))], reward: null }),
      K.npc('child_c', 'npc_snow_child', 46, 15, { name: R.T('map.snow_yule.DAY.19.child_c.name'), dir: 's', move: 'wander', talk: [L(R.T('map.snow_yule.DAY.talk.0.L_2')), L('cleared_r_snow', R.T('map.snow_yule.DAY.talk.1.cleared_r_snow'))], reward: null }),
      K.npc('woman_b', 'npc_snow_woman', 20, 23, { name: R.T('map.snow_yule.DAY.20.woman_b.name'), dir: 'n', talk: [L(R.T('map.snow_yule.DAY.talk.0.L_3')), L('cleared_r_snow', R.T('map.snow_yule.DAY.talk.1.cleared_r_snow_2'))], reward: null }),
    ];
    // 籠城の夜（守り手だけ）
    const NIGHT = [
      K.npc('jorn', 'npc_jorn', 30, 28, { name: R.T('map.snow_yule.NIGHT.0.jorn.name'), title: R.T('map.snow_yule.NIGHT.0.jorn.title'), dir: 'w', talk: 'yule_siege_jorn', pushable: false }),
      K.npc('sonja', 'npc_sonja', 26, 27, { name: R.T('map.snow_yule.NIGHT.1.sonja.name'), title: R.T('map.snow_yule.NIGHT.1.sonja.title'), dir: 'e', talk: 'yule_siege_sonja', pushable: false }),
      K.npc('hald', 'npc_hald', 28, 5, { name: R.T('map.snow_yule.NIGHT.2.hald.name'), title: R.T('map.snow_yule.NIGHT.2.hald.title'), dir: 'n', talk: 'yule_siege_hald', pushable: false }),
      K.npc('guard_w', 'npc_snow_man', 3, 30, { name: R.T('map.snow_yule.NIGHT.3.guard_w.name'), dir: 'w', talk: 'yule_siege_guard', pushable: false }),
      K.npc('guard_e', 'npc_snow_watch', 52, 29, { name: R.T('map.snow_yule.NIGHT.4.guard_e.name'), dir: 'e', talk: 'yule_siege_guard', pushable: false }),
      K.npc('olaf_n', 'npc_snow_old_m', 26, 5, { name: R.T('map.snow_yule.NIGHT.5.olaf_n.name'), title: R.T('map.snow_yule.NIGHT.5.olaf_n.title'), dir: 'n', talk: 'yule_siege_guard', pushable: false, cond: { choice: 'ch_snow_tale', is: 'hunter' } }),
    ];

    const common = (night) => ({
      kind: 'town', region: 'r_snow', location: 'yule', theme: 'snow_town',
      legend, outside: 'wall_snow',
      spawns: {
        gate_n: { x: 27, y: 2, dir: 's' }, gate_w: { x: 2, y: 29, dir: 'e' }, gate_e: { x: 53, y: 28, dir: 'w' },
        plaza: { x: 28, y: 31, dir: 'n' }, hearth: { x: 28, y: 28, dir: 'n' },
        hall: { x: 29, y: 19, dir: 's' }, inn: { x: 18, y: 20, dir: 's' }, items: { x: 11, y: 25, dir: 's' }, arms: { x: 38, y: 20, dir: 's' },
        jorn: { x: 45, y: 8, dir: 's' }, sonja: { x: 50, y: 15, dir: 's' }, brenda: { x: 16, y: 36, dir: 's' }, hunter: { x: 39, y: 36, dir: 's' },
        branch: { x: 47, y: 43, dir: 's' }, fish: { x: 8, y: 8, dir: 's' }, base: { x: 36, y: 41, dir: 's' }, sled: { x: 9, y: 44, dir: 'n' },
        watch: { x: 30, y: 2, dir: 'n' }, snowman: { x: 28, y: 43, dir: 'n' },
        // 籠城の門（守る門の前）
        def_n: { x: 27, y: 4, dir: 'n' }, def_w: { x: 5, y: 29, dir: 'w' }, def_e: { x: 50, y: 28, dir: 'e' },
      },
      exits: night ? [] : [
        { x: 27, y: 0, w: 2, h: 1, to: { map: 'world', spawn: 'yule_n' } },
        { x: 0, y: 29, w: 1, h: 2, to: { map: 'world', spawn: 'yule_w' } },
        { x: 55, y: 28, w: 1, h: 2, to: { map: 'world', spawn: 'yule_e' } },
      ],
      zones: [],
      dark: false,
      // 村ぜんたいを 1 枚に描いた下絵（地面・吹きだまり・建物・池・広場）。当たり・戸口・人・灯り・ほかの物は上のデータのまま。絵が無ければマスから焼く
      art: { image: 'snow/under/yule', emit: 'snow/under/yule_emit', painted: ['copper_brazier'] },
    });

    const D1 = build(false);
    K.def('yule', Object.assign(common(false), {
      name: R.T('map.snow_yule.yule.name'), rows: D1.g, objects: D1.O, npcs: DAY,
      triggers: [{ id: 'arrival', on: 'enter', event: 'yule_arrival' }],
      light: { ambient: '#5a66a8', k: 0.5, poolK: 0.8, spillR: 0.9, mood: 'town_night' },
      bgm: 'yule', weather: 'snow', weatherCond: '!cleared_r_snow',
      meta: { sub: R.T('map.snow_yule.yule.meta.sub'), chestsInfo: false },
    }));
    const D2 = build(true);
    K.def('yule_night', Object.assign(common(true), {
      name: R.T('map.snow_yule.yule_night.name'), rows: D2.g, objects: D2.O, npcs: NIGHT,
      triggers: [],
      light: { ambient: '#3e4684', k: 0.42, poolK: 0.85, spillR: 0.9, mood: 'town_night' },
      bgm: 'siege', weather: 'blizzard',
      meta: { sub: R.T('map.snow_yule.yule_night.meta.sub'), chestsInfo: false, noWarp: true },
    }));
  });
})(window.RPG);
