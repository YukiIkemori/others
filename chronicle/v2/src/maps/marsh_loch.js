// CONTENT（湿原）: 水辺の町ロッホ（loch、町 56×52）。WORLD_REDESIGN §5.7・§4.4、STORY_BIBLE §7.4・§8.5。
//   四角い家の並ぶ町ではない。浅い湖の上に、板の道がくねくねと小島と高床の家をつなぐ町（2026-09-28）:
//   北      : 「大鐘の館」= 昔、大聖堂の塔から湖に落ちた巨大な青銅の鐘。横倒しのまま緑青に覆われ、口を南に向けて湖に座る。
//             鐘の縁（口の輪）を板でふさぎ、戸が 3 つ: 西 = 道具屋、まん中 = 酒場「鐘の腹」、東 = 武具屋（1 つの建物に店が 3 つ、戸はそれぞれ）。
//             その前が石畳の小島の広場（掲示板・古い鐘の舌）。
//   西      : 集会所 = 高いくいの上の、青鷺の翼のような葦ぶきの大屋根の長い館（町の集会の場）。
//   東      : 鐘楼 = 小島に立つ四角い石の塔（鐘つきトビアス）。湖には細いくいの上の小さな鐘楼が 6 本立ち、町の 7 つの鐘楼になる（南東の 1 本は新しい）。
//   まん中  : 運河（深い水）が町を東西に横切る。石の太鼓橋が 1 本（夜にフィーネとすれ違う）、西にさおの渡し舟。
//   南      : 宿「霧笛亭」= 古い平底船を輪に舫って板を渡した丸い宿。町長の家 = 大きな柳の根に抱かれた家。エマの家 = 網を干した小さな高床の小屋。
//             人形師ベッポの店 = 細く背の高い、傾いた色あせた家。記録院ロッホ出張所 = 灰色の四角い石の箱（鉄の雨戸。町に似合わない）。
//             南東の湖にいかだをつないだ夜市の台（消灯の刻だけ屋台が出る）。
//   門は西の板の道（ワールドの湿原の道へ）と東の石の橋（霧の館の方へ）。
//   灯り: 湖の中のくいに掛けた鬼火の灯（wisp_lamp）。道・戸口の前・出入り口には置かない。消灯の刻（marsh_night）には落ちる。
//   小物は置かない（持ち主の決まり: 道をふさがない・散らかさない）。宝箱は見える物 2 つ。隠し通路なし（A27）。
//   町の絵は 1 枚の下絵（v2/assets/env/moss_village/under/loch*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, MK = R.Marsh.kit, L = K.L;
    const W = 56, H = 52;
    // 当たり（2026-09-29 の描き直し: 岸・小島・板の道をなめらかな形にした下絵に合わせた行。design/art_ref/gen/env/_tools/under/marsh/loch2/ の
    //   layout.py（形）→ 絵 → warp.py（縦のずれ）→ refit.py（絵の水に合わせる）の rows_fit。手で直すときは refit.py の方で）
    //   '~' 浅い湖・'=' 運河・'r' 葦原・'g' 小島・'c' 石畳・'p' 板の道・'b' 石の太鼓橋・'X' 大鐘とくいの鐘楼・'T' 柳
    const ROWS = [
      "rrrrrrrrrrrrrrrrrrrrrrrrrXXXXXXrrrrrrrrrrrrrrrrrrrrrrrrr",
      "rr~~rrrrrrrrrrrrrrr~~rXXXXXXXXXXXXrrrr~~rrrrrrrrr~rrrrrr",
      "rr~~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXXX~~~~~~~~~~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXXX~~~~~~~~~~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXXXXX~~~~~~~~~~~~~~~XX~rr",
      "rr~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXXXXX~~~~~~~~~~~~~~~XX~rr",
      "rrXX~~~~~~~~~~~~~~~~XXXXXXXXXXXXXXXX~~~~~~~~~~~~~~~~~~rr",
      "rrXX~~~~~~~~~~~~~~~~XXXXXXXXXXXXXXXX~~~~~~~~~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~gggggggggggggggggggg~~~~~~~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~gggggggggggggggggggg~~~~~ggggg~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~gggggggggggggggggggg~~~~~gggggggg~~~rr",
      "rr~~gggggggggg~~~~ggpggggggpgggggggpgg~~~~~ggggggggg~~rr",
      "rr~gggggggggggg~~~cccccccccccccccccccc~~~~gggggggggg~~rr",
      "rrggggggggggggg~~~cccccccccccccccccccc~~~~ggggggggTgg~rr",
      "rggggggggggggggg~~cccccccccccccccccccc~~~gggggggggggg~rr",
      "rggTgggggggggggg~~cccccccccccccccccccc~~~gggggggggggg~rr",
      "rggggggggggggggg~~cccccccccccccccccccc~~~ggggggggggg~~rr",
      "rgggggggggggggg~~~cccccccccccccccccccc~~~~gggpgggggg~~rr",
      "rgggggggpgggggg~ppppcccccccccccccccccpppppppgggggppppgrr",
      "r~~ggpppggppppppppppcccccccccccccccccpppppppgggggppppppr",
      "rr~pppppgppppppp~~~~~ccccccccccccc~~~~~~~~~~~~~~~~~ppppp",
      "pppppppp~~~~~~~~~~~~~~~~~~ccc~~~~~~~~~~~~~~~~~~~~~~~~ppp",
      "pppp~ppp~~~~~~~~~~~~~~~~~~ccc~~~~~~~~~~~~~~~~~~~~~~~~ggr",
      "rgg~~~pp~~~~~~XX~~~~~~~~~~ccc~~~~~~~~~~~~~~~~~~~~~~~~ggr",
      "rgg~~ppp~~~~~~XX~~~~~~~~~~bbb~~~~~~~~~~~~~~~~~~~~~~~~~gr",
      "rr~~~~pp~~~~~~~~~~~~~~~~~~bbb~~~~~~~~~~~~~~~~~~~~~~~~~rr",
      "==========================bbb===========================",
      "==========================bbb===========================",
      "==========================bbb===========================",
      "rr~~~~pp~~~~~~~~~~~~~~~~~~bbb~~~~~~~~~~~~~~~~~~~~~~~XXrr",
      "rr~~~~pp~~~gggg~~~~~~~~~~~bbbp~~~~~~~~~~~~~~~~ggggg~XXrr",
      "r~~~~~ppppppggggg~~~~~~~~pppppgggggg~~~~~~~~~~ggggg~~~rr",
      "r~~~~~gpppppggggg~~~~~~~ppp~~pgggggg~~~pppppp~ggggg~~~rr",
      "r~gggggggggggppgg~~~~~pppp~~~gggggggppppppppppggggggg~rr",
      "rggggggggggggpp~~~~~~pppp~~~ggggggggppp~~~~~ppggggggggrr",
      "rggggggggggggpp~~~~~ppp~~~~gggggpggggggg~~~~ppggpgggggrr",
      "rggggggggggggpp~~~pppp~~~~gggggggggggTg~~~~~ppggggggggrr",
      "rggggggggggggpp~~ppppp~~~~Tgggggggggggg~~~~~pppgggggg~rr",
      "rggggggggggggpppppp~pp~~~~~ggggggggppp~~~~~~pppp~~~~~~rr",
      "rrgggggpggggpppppp~~pp~~~~~~gppgggggppp~~~~~~~~~~~~~~~rr",
      "r~~gppppppppppppggggpp~~~~~~~pp~gg~~~ppp~~~~~~~~~~~~~~rr",
      "r~~~ppppppppppggggggpp~~~~~~~pp~~~~~~~gggggg~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~ggggggpp~~~~~~~pp~~~~~~ggggggg~~~~~~~~~~rr",
      "rr~~~~~~~~~~~~ggggggpp~~~~~~~~pp~~~~gggggggggg~~~~~~~~rr",
      "rr~~~~~~~~~~~~gggpggpp~~~~~ppppppppppggggggggg~~~~~XX~rr",
      "rr~~~~~~~~~~~~~gggppp~~~~~~ppppppppppgggpgggggg~~~~XX~rr",
      "rr~~~~~~~~~~~~~~~ppp~~~~~~~ppppppppppgggggggggg~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~~~~~~~~~~ppppppppppggggggggg~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~~~~~~XX~~~~~~~~~~~~~~gggggg~~~~~~~~~rr",
      "rr~~~~~~~~~~~~~~~~~~~~~XX~~~~~~~~~~~~~~~~~~~~~~~~~~~~~rr",
      "rrrrrrrrrrr~~rrrrrrrrrrr~~~rrrrrrrrrrrrr~~~~rrrrrrrrrrrr",
      "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    ];
    const g = ROWS.map((r) => r.split(''));

    // ---------------------------------------------------------------- 建物（戸口は 1 マス、敷地のいちばん下の行。出て着くのはその真下）
    const O = [];
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const bld = (id, x, y, w, h, o) => {
      const b = Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'log', windows: 2, lamp: false }, o);
      O.push(b);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j]) g[y + j][x + i] = 'g';
      if (b.door) { g[b.door.y][b.door.x] = 'p'; if ('~r'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'p'; }
      return b;
    };
    // 大鐘の館（横倒しの巨大な鐘。口の輪に 3 つの戸）: 西の肩 = 道具屋、まん中 = 酒場、東の肩 = 武具屋
    const bItems = bld('loch_bell_items', 18, 8, 6, 4, { wall: 3, windows: 1, sign: 'item', door: door(20, 11, 'loch_items') });
    const bTav = bld('loch_bell_tavern', 24, 8, 8, 4, { wall: 3, windows: 2, sign: 'tavern', door: door(27, 11, 'loch_tavern') });
    const bArms = bld('loch_bell_arms', 32, 8, 6, 4, { wall: 3, windows: 1, sign: 'weapon', door: door(35, 11, 'loch_arms') });
    const bHall = bld('loch_hall', 4, 11, 10, 8, { wall: 3, windows: 3, sign: 'guild', door: door(8, 18, 'loch_hall') });
    const bTower = bld('loch_tower', 43, 9, 5, 9, { wall: 3, windows: 1, door: door(45, 17, 'loch_tower') });   // 下絵の塔に合わせて 1 マス西
    const bInn = bld('loch_inn', 2, 33, 10, 7, { wall: 3, windows: 3, sign: 'inn', door: door(7, 39, 'loch_inn') });
    const bMayor = bld('loch_mayor', 30, 31, 6, 5, { wall: 2, windows: 2, door: door(32, 35, 'loch_mayor') });
    const bEmma = bld('loch_emma', 15, 41, 5, 4, { wall: 2, windows: 1, door: door(17, 44, 'loch_emma') });
    const bBeppo = bld('loch_beppo', 46, 30, 5, 6, { wall: 3, windows: 2, sign: 'shop', door: door(48, 35, 'loch_beppo') });
    const bKlaus = bld('loch_klaus', 38, 41, 6, 5, { wall: 2, windows: 2, door: door(40, 45, 'loch_klaus') });

    // ---------------------------------------------------------------- 物: 掲示板・鐘の舌・渡し舟・宝箱
    O.push(K.prop('crooked_sign', 23, 18), K.exam(23, 19, 'loch_board'));                 // 町の掲示板（広場の西の端）
    O.push(K.exam(31, 13, 'loch_bell_tongue'));                                           // 大鐘の舌（広場に落ちた古い鐘の舌）
    O.push(K.prop('mud_boat', 4, 27), K.exam(6, 26, 'loch_ferry', { side: 'n' }), K.exam(6, 28, 'loch_ferry', { side: 's' }));   // さおの渡し舟（運河の西）
    O.push(K.exam(14, 31, 'loch_footprints', { cond: 'marsh_night' }));                    // 夜: 光るこけを踏んだ小さな足あと（証拠 1）
    // 足あとの絵（夜だけ光る。宿の北東の運河の岸から南の沼の方へ。持ち主 2026-10-04「どこ？」→ 見つけやすく）
    for (const [x, y] of [[14, 31], [14, 32], [13, 33], [13, 34]]) O.push(K.prop('footprint', x, y, { cond: 'marsh_night' }));
    // 湖のくいの鬼火の灯（道・戸口の前・出入り口に置かない。消灯の刻には落ちる）
    const lamps = [[17, 14], [38, 14], [9, 23], [11, 21], [42, 21], [51, 22], [29, 25], [25, 25], [23, 36], [36, 42], [44, 40], [26, 47], [37, 48], [14, 45], [53, 38]];
    for (const [x, y] of lamps) O.push(K.prop('wisp_lamp', x, y, { cond: '!marsh_night' }));
    // 夜市の屋台（消灯の刻だけ）と、その灯り
    for (const [x, y] of [[26, 45], [33, 43], [36, 43]]) O.push(K.prop('lantern', x, y, { cond: 'marsh_night' }));   // いかだのまわりのくい
    // 【灯りを守る】運河の灯籠 3（くい。消灯の刻に油でともす。ともすと灯りがつく）
    for (const [n, x, y] of [[1, 8, 25], [2, 25, 29], [3, 44, 31]]) O.push(K.prop('stilt_posts', x, y), K.exam(x, y, 'loch_canal_lamp', { lamp: n }), K.prop('lantern', x, y, { cond: 'marsh_canal_lamp_' + n }));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('loch_c1', 51, 15, { pool: 'p_T' }), K.chest('loch_c2', 12, 32, { item: 'i_ether', n: 2 }));
    // 門の看板
    O.push(K.sign(1, 23, R.T('map.marsh_loch.sign')), K.sign(53, 22, R.T('map.marsh_loch.sign_2')));

    // ---------------------------------------------------------------- 人
    const N = [
      // 広場（大鐘の前）: 松明を持った人だかり（着いたとき。集会が済むまで）
      K.npc('mob_leader', 'npc_marsh_man', 27, 14, { name: R.T('map.marsh_loch.N.0.mob_leader.name'), dir: 's', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('mob_a', 'npc_marsh_woman', 25, 15, { name: R.T('map.marsh_loch.N.1.mob_a.name'), dir: 'e', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('mob_b', 'npc_marsh_old_m', 30, 15, { name: R.T('map.marsh_loch.N.2.mob_b.name'), dir: 'w', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('bard', 'npc_bard', 34, 17, { name: R.T('map.marsh_loch.N.3.bard.name'), dir: 'w', talk: 'loch_bard', reward: 'lead' }),
      K.npc('child_plaza', 'npc_marsh_child', 21, 15, { name: R.T('map.marsh_loch.N.4.child_plaza.name'), dir: 'e', talk: 'loch_child', reward: 'hint', cond: 'cleared_r_marsh' }),
      // 門
      K.npc('guard_w', 'npc_marsh_man', 4, 19, { name: R.T('map.marsh_loch.N.5.guard_w.name'), dir: 's', talk: 'loch_gate_w', reward: 'news' }),
      K.npc('guard_e', 'npc_marsh_man', 52, 18, { name: R.T('map.marsh_loch.N.6.guard_e.name'), dir: 's', talk: 'loch_gate_e', reward: 'boss' }),
      // 鐘楼の前（トビアスは鐘楼の中）・町の人
      K.npc('fisher', 'npc_marsh_old_m', 42, 18, { name: R.T('map.marsh_loch.N.7.fisher.name'), dir: 's', talk: 'loch_fisher', reward: 'hint' }),
      K.npc('laundress', 'npc_marsh_woman', 29, 36, { name: R.T('map.marsh_loch.N.8.laundress.name'), dir: 's', talk: 'loch_laundress', reward: 'news' }),
      K.npc('ferryman', 'npc_marsh_old_m', 7, 24, { name: R.T('map.marsh_loch.N.9.ferryman.name'), dir: 's', talk: 'loch_ferryman', reward: 'side', pushable: false }),
      K.npc('boy_south', 'npc_marsh_child', 29, 38, { name: R.T('map.marsh_loch.N.10.boy_south.name'), dir: 'n', talk: 'loch_boy', reward: 'hint' }),
      K.npc('lamp_keeper', 'npc_marsh_man', 36, 39, { name: R.T('map.marsh_loch.N.11.lamp_keeper.name'), dir: 'w', talk: 'loch_lampkeeper', reward: 'side' }),
      K.npc('yena', 'npc_yena', 18, 46, { name: R.T('map.marsh_loch.N.12.yena.name'), title: R.T('map.marsh_loch.N.12.yena.title'), dir: 'n', talk: 'loch_yena', reward: 'news', cond: ['marsh_emma_met', '!marsh_yena_done', '!cleared_r_marsh'] }),
      K.npc('klaus_out', 'npc_klaus', 40, 47, { name: R.T('map.marsh_loch.N.13.klaus_out.name'), title: R.T('map.marsh_loch.N.13.klaus_out.title'), dir: 'n', talk: 'loch_klaus', reward: 'lead', cond: 'cleared_r_marsh' }),
      // 夜（消灯の刻）だけ: 夜市の売り子・運河の灯籠守・迷い猫
      K.npc('night_vendor', 'npc_marsh_woman', 30, 46, { name: R.T('map.marsh_loch.N.14.night_vendor.name'), dir: 'n', talk: 'loch_night_market', reward: 'discount', cond: 'marsh_night', pushable: false }),
      K.npc('night_owl', 'npc_marsh_old_f', 34, 46, { name: R.T('map.marsh_loch.N.15.night_owl.name'), dir: 'n', talk: 'loch_night_owl', reward: 'hint', cond: 'marsh_night' }),
      K.npc('lost_cat', 'ani_cat', 44, 38, { name: R.T('map.marsh_loch.N.16.lost_cat.name'), dir: 'w', talk: 'loch_cat', reward: 'side', cond: ['marsh_night', 'q_marsh_cat_on', '!marsh_cat_found'] }),
      // 夜の運河の橋: 灰色のマントの少女（証拠が 2 つ以上、消灯の刻）
      K.npc('fine', 'fine', 27, 25, { name: R.T('map.marsh_loch.N.17.fine.name'), dir: 'n', talk: 'loch_bridge_fine', reward: null, cond: ['marsh_night', '!marsh_fine_seen', { var: 'marsh_evidence', gte: 2 }], pushable: false }),
      // 空気だけ
      K.npc('heron', 'ani_hen', 50, 16, { name: R.T('map.marsh_loch.N.18.heron.name'), dir: 'w', move: 'wander', talk: [L(R.T('map.marsh_loch.N.talk.0.L'))], reward: null }),
      K.npc('woman_air', 'npc_marsh_woman', 11, 20, { name: R.T('map.marsh_loch.N.19.woman_air.name'), dir: 'e', talk: [L(R.T('map.marsh_loch.N.talk.0.L_2')), L('cleared_r_marsh', R.T('map.marsh_loch.N.talk.1.cleared_r_marsh'))], reward: null }),
    ];

    const sp = MK.doorSpawn;
    K.def('loch', {
      name: R.T('map.marsh_loch.loch.name'), kind: 'town', region: 'r_marsh', location: 'loch', theme: 'moss_village',
      legend: MK.LEGEND(),
      rows: g, outside: 'marsh_water',
      objects: O, npcs: N,
      spawns: {
        gate_w: { x: 2, y: 21, dir: 'e' },
        gate_e: { x: 53, y: 20, dir: 'w' },
        plaza: { x: 27, y: 17, dir: 's' },
        items: sp(bItems), tavern: sp(bTav), arms: sp(bArms), hall: sp(bHall), tower: sp(bTower), inn: sp(bInn),
        mayor: sp(bMayor), emma: sp(bEmma), beppo: sp(bBeppo), klaus: sp(bKlaus),
        ferry_n: { x: 6, y: 24, dir: 's' }, ferry_s: { x: 6, y: 30, dir: 's' },
        bridge: { x: 27, y: 22, dir: 's' },
        warp: { x: 27, y: 19, dir: 's' },
      },
      exits: [
        { x: 0, y: 21, w: 1, h: 2, to: { map: 'world', spawn: 'loch' } },
        { x: 55, y: 20, w: 1, h: 2, to: { map: 'world', spawn: 'loch_e' } },
      ],
      triggers: [
        { id: 'arrival', on: 'enter', event: 'loch_arrival' },
        { id: 'fine', x: 26, y: 23, w: 3, h: 2, on: 'step', event: 'loch_bridge_fine', cond: ['marsh_night', '!marsh_fine_seen', { var: 'marsh_evidence', gte: 2 }] },
      ],
      zones: [],
      light: MK.LIGHT_TOWN,
      dark: false,
      bgm: 'marsh',
      meta: { sub: R.T('map.marsh_loch.loch.meta.sub'), chestsInfo: false },
      // 町ぜんたいを 1 枚に描いた下絵（v2/assets/env/moss_village/under/loch*、design/ENV_ASSETS.md §7）。湖・葦・板の道・小島・建物・大鐘・くいの鐘楼はこの絵、
      // 当たり・戸口・人・灯り・ほかの物は上のデータのまま。絵が無ければマスから焼く
      art: { image: 'moss_village/under/loch', emit: 'moss_village/under/loch_emit', painted: [] },
    });
  });
})(window.RPG);
