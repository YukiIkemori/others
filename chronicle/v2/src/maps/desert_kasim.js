// CONTENT（砂漠）: オアシスの町カシム（kasim、町 62×56）。WORLD_REDESIGN §5.5・§4.2、STORY_BIBLE §7.2・§8.3。
//   四角い家の並ぶ町ではない。砂丘に半ば埋もれて座る「名の削れた王の巨像」の足もとに開けた、泉の町（2026-09-27 に作り直し）:
//   北      : 巨像。顔は砂風で削れてのっぺり、台座の名の所も削り取られている（王墓の名なき王と同じ）。
//             台座の正面に 3 つの戸: 西の肩の下 = 道具屋、まん中（胸の下）= 占いの間、東の肩の下 = 地図屋（1 つの建物に店が 3 つ、戸はそれぞれ）。
//             台座の両脇に市場の武具の屋台と屋台のサルマ。
//   まん中  : 巨像から折れて落ちた「石の手」。上を向いた手のひらのくぼみが泉（枯れかけ。解決で水が戻る＝tilePatches）。
//             手首の側（南）から手のひらへ降りられる。指のあいだから泉の底の古い文字をのぞく。まわりは石畳の広場（日時計・掲示板）。
//   北西    : 宿「泉の星亭」= 丸屋根の寄り集まりと、星の灯を載せた風の塔。
//   北東    : 酒場「砂時計」= 砂に横倒しになった大きな素焼きのかめ（腹に戸）。 東: 井戸掘りの親方の丸屋根の家と、木の水くみ車。
//   南東    : 隊商ギルド = 砂から出た大きな獣の肋骨に、藍と茜の布を張った館。
//   南西    : 王墓の番アブルの家 = 文字を彫った砂岩の岩を掘った住まい。 南: 貯水の丸屋根・鳩の塔・穀物の丸屋根（戸は無い）。
//   道は曲がりくねった土の小道。町のふちは高い砂丘となつめやしの林（通れない）。門は西（隊商路・王墓へ）と東（灰の荒野へ）。
//   小物は壁や岩の際に少しだけ（持ち主の決まり: 町の小物は当たらないが、道・戸口の前には置かない）。宝箱は見える物 2 つ。隠し通路なし（A27）。
//   町の絵は 1 枚の下絵（v2/assets/env/desert/under/kasim*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const W = 62, H = 56, CX = 31, CY = 26;
    const g = K.grid(W, H, 'D');
    const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;

    // ---------------------------------------------------------------- 地面: 砂丘に囲まれたくぼ地（ふちはゆらぐ）
    K.blob(g, 31, 29, 27, 22, 's', 'kasim2_floor', ['D']);
    K.blob(g, 12, 16, 9, 8, 's', 'kasim2_nw', ['D']);
    K.blob(g, 50, 16, 9, 8, 's', 'kasim2_ne', ['D']);
    K.blob(g, 31, 47, 14, 6, 's', 'kasim2_s', ['D']);
    // ふちをならす（砂丘の中の 1 マスの穴・広場の中の 1 マスの砂丘を消す）
    for (let it = 0; it < 3; it++) {
      const c0 = g.map((r) => r.slice());
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && c0[y + j][x + i] === 's') n++;
        if (c0[y][x] === 'D' && n >= 5) g[y][x] = 's';
        else if (c0[y][x] === 's' && n <= 2) g[y][x] = 'D';
      }
    }
    // 門の脇の門番の立つ所と、井戸掘りの家の裏庭（井戸）
    K.rect(g, 3, 24, 3, 2, 's'); K.rect(g, 56, 23, 3, 3, 's');
    // なつめやしの林（通れない。絵の中の木）
    for (const [cx, cy, rx, ry, s] of [[5, 20, 2, 3, 'p1'], [57, 20, 2, 3, 'p2'], [20, 38, 2, 2, 'p3'], [43, 49, 3, 2, 'p4'], [9, 44, 2, 2, 'p5'], [53, 40, 2, 2, 'p6'], [16, 21, 1, 1, 'p7'], [46, 21, 1, 1, 'p8']]) K.blob(g, cx, cy, rx, ry, 'P', 'kasim2_' + s, ['s']);

    K.rect(g, 19, 37, 4, 4, 'P', ['s']);                                             // 下絵のなつめやしの林に合わせる
    // ---------------------------------------------------------------- 巨像（北のまん中。砂丘に埋もれて座る王）
    for (let y = 0; y < 17; y++) for (let x = 18; x < 45; x++) {
      const head = ell(x, y, 31, 5, 4.6, 4.4) < 1;
      const cloth = x >= 26 && x <= 36 && y >= 4 && y <= 10;                    // 頭布の垂れ
      const body = ell(x, y, 31, 13, 11.6, 6.2) < 1 && y <= 13;                  // 肩と胸
      const plinth = x >= 21 && x <= 41 && y >= 13 && y <= 16;                   // 台座（正面が 3 つの店）
      if (head || cloth || body || plinth) g[y][x] = 'X';
    }
    // 巨像の前庭（石畳）と、それに続く泉の広場
    K.rect(g, 19, 17, 25, 3, 'Q');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (ell(x, y, CX, CY, 11.6, 8.6) < 1 && 'sP'.includes(g[y][x])) g[y][x] = 'Q';
    }
    // 台座の両脇の屋台の場所（巨像の脇の砂）
    K.rect(g, 18, 13, 3, 4, 's'); K.rect(g, 42, 13, 3, 4, 's');

    // ---------------------------------------------------------------- 石の手（上を向いた手のひら = 泉。下絵に合わせた形: x = 指・縁、k = 手のひらのくぼみ、w = 水たまり、Q = 手首の石段）
    //   まん中の指のあいだ (31,21) から底をのぞく。手首の側（南、x 30〜31）の石段から手のひらへ降りる
    const HAND = [
      '     xx xx    ',   // y20
      '   x xx xx x  ',
      '   xxxxxxxxx  ',
      '  xxxxxxxxxxx ',
      '  xxxkkkkkxxx ',
      ' xxxxkkkkkxxx ',   // y25
      ' xxxkkwwwkkxx ',
      '  xxkkkkkkkxx ',
      '  xxxxQQxxxx  ',
      '   xxxQQxxx   ',
      '    xxQQxx    ',   // y30
    ];
    const HX = 24, HY = 20;
    K.stamp(g, HX, HY, HAND);
    const PALM_IN = (x, y) => { const r = HAND[y - HY]; return !!r && 'kw'.includes(r[x - HX] || ' '); };

    // ---------------------------------------------------------------- 建物（戸口は 1 マス、敷地のいちばん下の行。出て着くのはその真下）
    const O = [];
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const bld = (id, x, y, w, h, o) => {
      const b = Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'flat', mat: 'plaster', windows: 2, lamp: false }, o);
      O.push(b);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j] && 'DP'.includes(g[y + j][x + i])) g[y + j][x + i] = 's';
      if (b.door) g[b.door.y][b.door.x] = 'Q';
      return b;
    };
    // 巨像の台座の 3 つの店（台座の正面の帯 3 行 = 壁。上は巨像の胸）
    const bShop = bld('kasim_b_shop', 23, 14, 5, 3, { wall: 3, windows: 1, sign: 'item', lamp: true, door: door(25, 16, 'kasim_shop') });
    const bFort = bld('kasim_b_fortune', 29, 14, 5, 3, { wall: 3, windows: 0, door: door(31, 16, 'kasim_fortune') });
    const bMap = bld('kasim_b_mapshop', 35, 14, 5, 3, { wall: 3, windows: 1, sign: 'map', lamp: true, door: door(37, 16, 'kasim_mapshop') });
    // 宿「泉の星亭」（丸屋根の寄り集まりと風の塔）・酒場「砂時計」（横倒しの大がめ）・井戸掘りの家（丸屋根と水くみ車）
    const bInn = bld('kasim_b_inn', 6, 9, 10, 7, { wall: 3, windows: 3, sign: 'inn', lamp: true, door: door(10, 15, 'kasim_inn') });
    const bTav = bld('kasim_b_tavern', 46, 9, 10, 6, { wall: 2, windows: 2, sign: 'tavern', lamp: true, door: door(50, 14, 'kasim_tavern') });
    const bDig = bld('kasim_b_digger', 52, 17, 6, 5, { wall: 2, windows: 1, door: door(54, 21, 'kasim_digger') });
    // 隊商ギルド（獣の肋骨に布を張った館）・アブルの家（岩を掘った住まい）
    const bGuild = bld('kasim_b_guild', 42, 38, 11, 7, { wall: 3, windows: 2, sign: 'guild', lamp: true, door: door(47, 44, 'kasim_guild') });
    const bAbul = bld('kasim_b_abul', 4, 33, 6, 5, { wall: 2, windows: 1, door: door(6, 37, 'kasim_abul') });
    // 戸の無い物（貯水の丸屋根・鳩の塔・穀物の丸屋根・風の塔）
    bld('kasim_s_cistern', 15, 41, 5, 5, { wall: 2, windows: 0 });
    bld('kasim_s_dove', 24, 46, 3, 5, { wall: 2, windows: 0 });
    bld('kasim_s_granary', 33, 46, 7, 5, { wall: 2, windows: 0 });
    bld('kasim_s_wind', 56, 32, 3, 4, { wall: 2, windows: 0 });

    // 下絵に描かれて敷地からはみ出した所（大がめの首と口・水くみ車）も通れない
    K.rect(g, 56, 10, 2, 4, 'X'); K.rect(g, 58, 17, 1, 2, 'X');
    // ---------------------------------------------------------------- 道（土の小道。曲がりくねる。最後に引くので林や砂丘より勝つ）
    const lane = (pts, w) => K.path(g, pts, 'k', w || 2, ['s', 'D', 'P', 'u']);
    lane([[0, 26], [5, 26], [8, 24], [13, 24], [16, 26], [20, 26]], 3);             // 西の門 → 広場
    lane([[59, 26], [55, 26], [52, 28], [46, 28], [42, 26]], 3);                     // 東の門 → 広場
    lane([[13, 24], [13, 20], [10, 18], [10, 16]]);                                  // 宿へ
    lane([[46, 28], [47, 23], [49, 19], [50, 16], [50, 15]]);                        // 酒場へ
    lane([[49, 22], [54, 22]]);                                                      // 井戸掘りの家へ
    lane([[15, 27], [15, 33], [11, 38], [6, 38]]);                                   // アブルの家へ
    lane([[39, 33], [40, 36], [40, 45], [47, 45]]);                                  // 隊商ギルドへ
    lane([[31, 34], [29, 39], [30, 44], [31, 50]]);                                  // 南の丸屋根の路地
    lane([[29, 39], [23, 40]]);
    lane([[30, 44], [40, 45]]);
    // 門の口（外の砂丘の切れ目）
    K.rect(g, 0, 26, 3, 3, 'k'); K.rect(g, 59, 26, 3, 3, 'k');

    // ---------------------------------------------------------------- 広場の物: 日時計・掲示板・碑・井戸・かがり火
    O.push(K.prop('obelisk', 24, 31), K.exam(24, 31, 'kasim_sundial'));             // 砂に埋もれた日時計（lo_time_desert）
    O.push(K.exam(31, 22, 'kasim_spring_letters'));                                    // 指のあいだから、泉の底の古い文字
    O.push(K.prop('board', 38, 33), K.exam(38, 33, 'kasim_board'));                  // 隊商ギルドの掲示板（広場の南東）
    O.push(K.prop('broken_pillar', 54, 30), K.exam(54, 30, 'kasim_memorial'));       // 戦没者の碑（名が削れている）
    O.push(K.prop('dry_well', 58, 24), K.exam(58, 24, 'kasim_well'));                // 町の井戸（井戸掘りの家の脇）
    O.push(K.exam(21, 14, 'kasim_colossus'), K.exam(41, 14, 'kasim_colossus'));   // 巨像の台座の角（名の削れた所）
    // 灯り: 石の手の指先と手首の銅のかがり火（手の上なので道をふさがない）、戸口の脇の置き灯籠
    for (const [x, y] of [[26, 23], [36, 23], [25, 26], [36, 27], [29, 29], [32, 29]]) O.push(K.prop('copper_brazier', x, y));
    for (const [x, y] of [[22, 16], [28, 16], [34, 16], [40, 16], [9, 16], [12, 16], [49, 15], [52, 15], [46, 45], [49, 45], [5, 38], [8, 38], [53, 22]]) O.push(K.prop('lantern', x, y));
    // 解決のあと: 手のひらのまわりに花
    for (const [x, y] of [[25, 23], [37, 24], [27, 30], [35, 30]]) O.push(K.prop('flower_pot', x, y, { cond: 'cleared_r_desert' }));
    // 市場の屋台（巨像の台座の両脇）と、壁際の少しの荷
    O.push(K.prop('desert_stall', 19, 14), K.prop('carpet_rack', 43, 14));
    O.push(K.prop('clay_jars', 18, 15), K.prop('clay_jars', 44, 15), K.prop('tomb_urn', 18, 13));
    O.push(K.prop('cart_barrels', 14, 11), K.prop('clay_jars', 45, 11), K.prop('crate', 41, 40), K.prop('clay_jars', 10, 34));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('kasim_c1', 58, 16, { pool: 'p_T' }), K.chest('kasim_c2', 14, 44, { item: 'i_ether', n: 2 }));
    // 門の看板
    O.push(K.sign(4, 29, R.T('map.desert_kasim.sign')), K.sign(57, 29, R.T('map.desert_kasim.sign_2')));

    // ---------------------------------------------------------------- 人（話す見返り: 手がかり・依頼・値引き・ほのめかし・品・ボスの癖・近況）
    const L = K.L;
    const N = [
      // 広場（石の手のまわり）
      K.npc('fara', 'npc_fara', 34, 20, { name: R.T('map.desert_kasim.N.0.fara.name'), title: R.T('map.desert_kasim.N.0.fara.title'), dir: 's', talk: 'kasim_fara', reward: 'lead', cond: '!cleared_r_desert' }),
      K.npc('fara_after', 'npc_fara', 33, 31, { name: R.T('map.desert_kasim.N.1.fara_after.name'), title: R.T('map.desert_kasim.N.1.fara_after.title'), dir: 'n', talk: 'kasim_fara', reward: 'lead', cond: 'cleared_r_desert' }),
      K.npc('nadia', 'npc_nadia', 27, 32, { name: R.T('map.desert_kasim.N.2.nadia.name'), title: R.T('map.desert_kasim.N.2.nadia.title'), dir: 's', talk: 'kasim_nadia', reward: 'lead' }),
      K.npc('zaid_plaza', 'npc_zaid', 36, 31, { name: R.T('map.desert_kasim.N.3.zaid_plaza.name'), title: R.T('map.desert_kasim.N.3.zaid_plaza.title'), dir: 's', talk: 'kasim_zaid', reward: 'lead', cond: ['!desert_caravan_on', '!desert_camp3_done'] }),
      K.npc('zaid_after', 'npc_zaid', 36, 31, { name: R.T('map.desert_kasim.N.4.zaid_after.name'), title: R.T('map.desert_kasim.N.4.zaid_after.title'), dir: 's', talk: 'kasim_zaid', reward: 'discount', cond: 'cleared_r_desert' }),
      K.npc('child_dates', 'npc_desert_child', 21, 29, { name: R.T('map.desert_kasim.N.5.child_dates.name'), dir: 'e', talk: 'kasim_child', reward: 'side', move: 'still' }),
      K.npc('sundial_old', 'npc_desert_old_m', 24, 32, { name: R.T('map.desert_kasim.N.6.sundial_old.name'), dir: 'e', talk: 'kasim_old_man', reward: 'news' }),
      // 巨像の台座の脇の屋台
      K.npc('arms_vendor', 'npc_desert_man', 19, 15, { name: R.T('map.desert_kasim.N.7.arms_vendor.name'), title: R.T('map.desert_kasim.N.7.arms_vendor.title'), dir: 's', talk: 'kasim_arms', pushable: false, reward: null }),
      K.npc('bazaar', 'npc_desert_woman', 43, 15, { name: R.T('map.desert_kasim.N.8.bazaar.name'), title: R.T('map.desert_kasim.N.8.bazaar.title'), dir: 's', talk: 'kasim_bazaar', pushable: false, reward: 'discount' }),
      // 小道
      K.npc('dates_vendor', 'npc_desert_old_f', 17, 30, { name: R.T('map.desert_kasim.N.9.dates_vendor.name'), dir: 'e', talk: 'kasim_dates', reward: 'side' }),
      K.npc('salt_vendor', 'npc_caravan', 44, 30, { name: R.T('map.desert_kasim.N.10.salt_vendor.name'), dir: 'w', talk: 'kasim_salt', reward: 'side' }),
      K.npc('tadeo', 'npc_tadeo', 45, 22, { name: R.T('map.desert_kasim.N.11.tadeo.name'), title: R.T('map.desert_kasim.N.11.tadeo.title'), dir: 's', talk: 'kasim_tadeo', reward: 'side' }),
      K.npc('guard_w', 'npc_desert_man', 4, 25, { name: R.T('map.desert_kasim.N.12.guard_w.name'), dir: 's', talk: 'kasim_gate_w', reward: 'boss' }),
      K.npc('guard_e', 'npc_desert_man', 57, 25, { name: R.T('map.desert_kasim.N.13.guard_e.name'), dir: 's', talk: 'kasim_gate_e', reward: 'news' }),
      K.npc('woman_mid', 'npc_desert_woman', 22, 24, { name: R.T('map.desert_kasim.N.14.woman_mid.name'), dir: 'e', talk: 'kasim_water_woman', reward: 'item' }),
      K.npc('hawk_friend', 'npc_desert_man', 11, 23, { name: R.T('map.desert_kasim.N.15.hawk_friend.name'), dir: 'e', talk: 'kasim_hawk_friend', reward: 'hint' }),
      K.npc('rashid_memorial', 'npc_rashid', 54, 31, { name: R.T('map.desert_kasim.N.16.rashid_memorial.name'), title: R.T('map.desert_kasim.N.16.rashid_memorial.title'), dir: 'n', talk: 'kasim_rashid_memorial', reward: 'news', cond: ['cleared_r_desert', { choice: 'ch_desert_write', is: 'pain' }] }),
      K.npc('yura_returnee', 'npc_yura_woman', 38, 21, { name: R.T('map.desert_kasim.N.17.yura_returnee.name'), title: R.T('map.desert_kasim.N.17.yura_returnee.title'), dir: 's', talk: 'kasim_yura_dyer', reward: 'side' }),
      K.npc('pilgrim_kid', 'npc_desert_child', 38, 28, { name: R.T('map.desert_kasim.N.18.pilgrim_kid.name'), dir: 'w', move: 'wander', talk: 'kasim_kid', reward: 'hint' }),
      // 空気だけ（4 人まで）
      K.npc('camel_1', 'ani_camel', 43, 47, { name: R.T('map.desert_kasim.N.19.camel_1.name'), dir: 'w', talk: [L(R.T('map.desert_kasim.N.talk.0.L'))], reward: null }),
      K.npc('cat', 'ani_cat', 28, 42, { name: R.T('map.desert_kasim.N.20.cat.name'), dir: 's', move: 'wander', talk: [L(R.T('map.desert_kasim.N.talk.0.L_2'))], reward: null }),
      K.npc('woman_air', 'npc_desert_woman', 8, 27, { name: R.T('map.desert_kasim.N.21.woman_air.name'), dir: 'e', talk: [L(R.T('map.desert_kasim.N.talk.0.L_3')), L('cleared_r_desert', R.T('map.desert_kasim.N.talk.1.cleared_r_desert'))], reward: null }),
    ];

    const sp = (b) => ({ x: b.door.x, y: b.door.y + 1, dir: 's' });
    K.def('kasim', {
      name: R.T('map.desert_kasim.kasim.name'), kind: 'town', region: 'r_desert', location: 'kasim', theme: 'desert_town',
      legend: DK.LEGEND({
        D: { mat: 'dune_sand', solid: true, rise: 1, name: 'dune' },
        P: { mat: 'grass', solid: true, name: 'palms' },
      }),
      rows: g, outside: 'dune_sand',
      objects: O, npcs: N,
      spawns: {
        gate_w: { x: 2, y: 27, dir: 'e' },
        gate_e: { x: 59, y: 27, dir: 'w' },
        plaza: { x: 31, y: 32, dir: 'n' },
        inn: sp(bInn), tavern: sp(bTav), abul: sp(bAbul), shop: sp(bShop), mapshop: sp(bMap), fortune: sp(bFort), guild: sp(bGuild), digger: sp(bDig),
        spring: { x: 31, y: 30, dir: 'n' },
        warp: { x: 31, y: 35, dir: 'n' },
      },
      exits: [
        { x: 0, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'kasim' } },
        { x: 61, y: 26, w: 1, h: 3, to: { map: 'world', spawn: 'kasim_e' } },
      ],
      triggers: [{ id: 'arrival', on: 'enter', event: 'kasim_arrival' }],
      tilePatches: [
        // 解決のあと: 石の手のひらに水が戻る
        { cond: 'cleared_r_desert', rect: [HX, HY, HAND[0].length, HAND.length], rows: HAND.map((r, j) => [...r].map((c, i) => (PALM_IN(HX + i, HY + j) ? 'w' : ' ')).join('')) },
      ],
      zones: [],
      light: DK.LIGHT_TOWN,
      dark: false,
      bgm: 'kasim',
      meta: { sub: R.T('map.desert_kasim.kasim.meta.sub'), chestsInfo: false },
      // 町ぜんたいを 1 枚に描いた下絵（v2/assets/env/desert/under/kasim*、design/ENV_ASSETS.md §7）。地面・砂丘・巨像・石の手・建物・なつめやしはこの絵、
      // 当たり・戸口・人・灯り・ほかの物は上のデータのまま。絵が無ければマスから焼く
      art: { image: 'desert/under/kasim', emit: 'desert/under/kasim_emit', painted: [] },
    });
  });
})(window.RPG);
