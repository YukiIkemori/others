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
    const g = K.grid(W, H, '~');
    const ell = (cx, cy, rx, ry, ch, only) => {
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 && (!only || only.includes(K.at(g, x, y)))) K.put(g, x, y, ch);
      }
    };
    // ---------------------------------------------------------------- 湖のふちの葦原（外まわり。出入り口の所は空く）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      const wob = ((x * 7 + y * 13) % 5) / 5;
      if (d === 0 || (d === 1 && wob > 0.3) || (d === 2 && wob > 0.75)) g[y][x] = 'r';
    }
    // ---------------------------------------------------------------- 運河（深い水。町を東西に横切る）
    for (let x = 0; x < W; x++) for (let y = 26; y <= 28; y++) g[y][x] = '=';
    // ---------------------------------------------------------------- 小島
    ell(27.5, 16, 10, 4.2, 'c');                // 大鐘の前の石畳の広場
    ell(9, 16.5, 6.5, 4.2, 'g');                // 集会所の小島
    ell(46.5, 16, 5.5, 4.4, 'g');               // 鐘楼の小島
    ell(32.5, 36.5, 6.5, 3.6, 'g');             // 町長の柳の小島
    ell(41, 45.5, 5.5, 3.2, 'g');               // 出張所の小島
    ell(48.5, 35.5, 4.5, 3.2, 'g');             // ベッポの小島
    ell(13, 31.5, 3.5, 1.6, 'g');               // 運河の南岸の小さな泥の岸（夜の足あと）
    // 下絵に合わせる: 描いた岸が水になっている所
    for (const [x, y] of [[48, 12], [50, 38], [51, 38]]) K.put(g, x, y, '~');
    // 柳（大きな木。町長の家の上の柳の枝は絵の中）
    for (const [x, y] of [[37, 36], [26, 37], [50, 13], [3, 15]]) K.put(g, x, y, 'T');
    // ---------------------------------------------------------------- 板の道（くねくねと。幅 2）
    const walk = (pts, wd) => K.path(g, pts, 'p', wd || 2, ['~', 'r', 'g']);
    walk([[0, 21], [4, 21], [4, 20]]);                                    // 西の門 → 集会所の前
    walk([[4, 20], [8, 20], [8, 19]]);
    walk([[13, 19], [16, 19], [16, 18], [18, 18]]);                        // 集会所 → 広場
    walk([[37, 18], [40, 18], [40, 19], [43, 19]]);                        // 広場 → 鐘楼
    walk([[50, 19], [53, 19], [53, 20], [56, 20]]);                        // 鐘楼 → 東の門
    walk([[6, 21], [6, 25]]);                                              // 集会所 → 渡し舟の北の舟着き
    walk([[6, 29], [6, 31], [8, 31], [8, 33]]);                            // 渡し舟の南 → 宿へ（宿の戸の前は下で）
    walk([[27, 30], [27, 32], [24, 32], [24, 34], [20, 34], [20, 37], [17, 37], [17, 39]]);   // 橋のたもと → エマの家の方
    walk([[17, 39], [12, 39], [12, 41], [7, 41], [7, 40]]);               // → 宿の前
    walk([[13, 34], [13, 33], [11, 33]]);                                  // 運河の南岸の泥の岸へ
    walk([[13, 34], [13, 39]]);                                            // 泥の岸 → 宿の前の道
    walk([[27, 32], [27, 30]]);
    walk([[28, 31], [31, 31], [31, 33]]);                                  // 橋のたもと → 町長の家
    walk([[35, 38], [37, 38], [37, 41]]);                                  // 町長の小島 → 出張所の小島
    walk([[29, 40], [29, 43], [31, 43]]);                                  // 町長の小島 → 夜市のいかだ
    walk([[36, 33], [40, 33], [40, 32], [44, 32], [44, 37], [46, 37]]);    // → ベッポの店
    walk([[20, 37], [20, 45], [17, 45]]);                                  // → エマの家の前
    // 夜市のいかだ（板の台）
    K.rect(g, 27, 44, 10, 4, 'p');
    // 石の太鼓橋（運河を渡る。広場から南へ）
    K.rect(g, 26, 21, 3, 3, 'c');
    K.rect(g, 26, 24, 3, 7, 'b');
    // 西の渡し舟の舟着き（北と南。さおの舟で運河を渡る）
    K.rect(g, 5, 24, 3, 2, 'p'); K.rect(g, 5, 29, 3, 2, 'p');
    // ---------------------------------------------------------------- 7 つの鐘楼のうち、くいの上の小さな 6 本（湖の中。通れない）
    for (const [x, y] of [[2, 6], [51, 4], [14, 23], [52, 29], [23, 48], [51, 44]]) K.rect(g, x, y, 2, 2, 'X');

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
    for (let y = 1; y <= 8; y++) for (let x = 20; x <= 35; x++) if (((x - 27.5) / (6.5 + (y - 1) * 0.35)) ** 2 < 1) g[y][x] = 'X';   // 鐘の胴（上ほど細い）
    K.rect(g, 25, 0, 6, 2, 'X');                                                                                               // 鐘の頭の吊り手
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
    // 戸の前は板の道（出て着く所）
    for (const b of [bItems, bTav, bArms]) K.put(g, b.door.x, b.door.y + 1, 'c');
    K.put(g, bKlaus.door.x, bKlaus.door.y + 1, 'p');
    // 大鐘の戸の前の石畳（広場の北の縁）
    K.rect(g, 19, 12, 18, 1, 'c');
    // 出入り口の口（外の板の道）と、西の門の看板の小さな岸
    K.rect(g, 1, 23, 2, 1, 'g');
    K.rect(g, 0, 21, 2, 2, 'p'); K.rect(g, 54, 20, 2, 2, 'p');

    // ---------------------------------------------------------------- 物: 掲示板・鐘の舌・渡し舟・宝箱
    O.push(K.prop('crooked_sign', 23, 18), K.exam(23, 19, 'loch_board'));                 // 町の掲示板（広場の西の端）
    O.push(K.exam(31, 13, 'loch_bell_tongue'));                                           // 大鐘の舌（広場に落ちた古い鐘の舌）
    O.push(K.prop('mud_boat', 4, 27), K.exam(6, 26, 'loch_ferry', { side: 'n' }), K.exam(6, 28, 'loch_ferry', { side: 's' }));   // さおの渡し舟（運河の西）
    O.push(K.exam(14, 31, 'loch_footprints', { cond: 'marsh_night' }));                    // 夜: 光るこけを踏んだ小さな足あと（証拠 1）
    // 湖のくいの鬼火の灯（道・戸口の前・出入り口に置かない。消灯の刻には落ちる）
    const lamps = [[17, 14], [38, 14], [9, 23], [11, 21], [42, 21], [51, 22], [29, 25], [25, 25], [23, 36], [36, 42], [44, 40], [26, 47], [37, 48], [14, 45], [53, 35]];
    for (const [x, y] of lamps) O.push(K.prop('wisp_lamp', x, y, { cond: '!marsh_night' }));
    // 夜市の屋台（消灯の刻だけ）と、その灯り
    for (const [x, y] of [[26, 45], [33, 43], [36, 43]]) O.push(K.prop('lantern', x, y, { cond: 'marsh_night' }));   // いかだのまわりのくい
    // 【灯りを守る】運河の灯籠 3（くい。消灯の刻に油でともす。ともすと灯りがつく）
    for (const [n, x, y] of [[1, 8, 25], [2, 25, 29], [3, 44, 31]]) O.push(K.prop('stilt_posts', x, y), K.exam(x, y, 'loch_canal_lamp', { lamp: n }), K.prop('lantern', x, y, { cond: 'marsh_canal_lamp_' + n }));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('loch_c1', 51, 15, { pool: 'p_T' }), K.chest('loch_c2', 12, 32, { item: 'i_ether', n: 2 }));
    // 門の看板
    O.push(K.sign(1, 23, '水辺の町ロッホ\n西の板の道 → 湿原の道'), K.sign(53, 22, '東の橋 → 霧の館'));

    // ---------------------------------------------------------------- 人
    const N = [
      // 広場（大鐘の前）: 松明を持った人だかり（着いたとき。集会が済むまで）
      K.npc('mob_leader', 'npc_marsh_man', 27, 14, { name: '怒った町人', dir: 's', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('mob_a', 'npc_marsh_woman', 25, 15, { name: '松明を持った女', dir: 'e', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('mob_b', 'npc_marsh_old_m', 30, 15, { name: '松明を持った年寄り', dir: 'w', talk: 'loch_mob', reward: null, cond: '!marsh_assembly_done' }),
      K.npc('bard', 'npc_bard', 34, 17, { name: '広場の吟遊詩人', dir: 'w', talk: 'loch_bard', reward: 'lead' }),
      K.npc('child_plaza', 'npc_marsh_child', 21, 15, { name: '広場の子', dir: 'e', talk: 'loch_child', reward: 'hint', cond: 'cleared_r_marsh' }),
      // 門
      K.npc('guard_w', 'npc_marsh_man', 4, 19, { name: '西の門番', dir: 's', talk: 'loch_gate_w', reward: 'news' }),
      K.npc('guard_e', 'npc_marsh_man', 52, 18, { name: '東の門番', dir: 's', talk: 'loch_gate_e', reward: 'boss' }),
      // 鐘楼の前（トビアスは鐘楼の中）・町の人
      K.npc('fisher', 'npc_marsh_old_m', 42, 18, { name: '釣り人のオットマー', dir: 's', talk: 'loch_fisher', reward: 'hint' }),
      K.npc('laundress', 'npc_marsh_woman', 29, 36, { name: '洗濯の女', dir: 's', talk: 'loch_laundress', reward: 'news' }),
      K.npc('ferryman', 'npc_marsh_old_m', 7, 24, { name: '渡し守のグンター', dir: 's', talk: 'loch_ferryman', reward: 'side', pushable: false }),
      K.npc('boy_south', 'npc_marsh_child', 29, 38, { name: '町長の孫', dir: 'n', talk: 'loch_boy', reward: 'hint' }),
      K.npc('lamp_keeper', 'npc_marsh_man', 36, 39, { name: '灯籠守のヨスト', dir: 'w', talk: 'loch_lampkeeper', reward: 'side' }),
      K.npc('yena', 'npc_yena', 18, 46, { name: 'イェナ', title: '静夜会', dir: 'n', talk: 'loch_yena', reward: 'news', cond: ['marsh_emma_met', '!marsh_yena_done', '!cleared_r_marsh'] }),
      K.npc('klaus_out', 'npc_klaus', 40, 47, { name: 'クラウス', title: '記録院の記録官', dir: 'n', talk: 'loch_klaus', reward: 'lead', cond: 'cleared_r_marsh' }),
      // 夜（消灯の刻）だけ: 夜市の売り子・運河の灯籠守・迷い猫
      K.npc('night_vendor', 'npc_marsh_woman', 30, 46, { name: '夜市の売り子', dir: 'n', talk: 'loch_night_market', reward: 'discount', cond: 'marsh_night', pushable: false }),
      K.npc('night_owl', 'npc_marsh_old_f', 34, 46, { name: '夜更かしのばあさま', dir: 'n', talk: 'loch_night_owl', reward: 'hint', cond: 'marsh_night' }),
      K.npc('lost_cat', 'ani_cat', 44, 38, { name: '猫', dir: 'w', talk: 'loch_cat', reward: 'side', cond: ['marsh_night', 'q_marsh_cat_on', '!marsh_cat_found'] }),
      // 夜の運河の橋: 灰色のマントの少女（証拠が 2 つ以上、消灯の刻）
      K.npc('fine', 'fine', 27, 25, { name: '灰色のマントの少女', dir: 'n', talk: 'loch_bridge_fine', reward: null, cond: ['marsh_night', '!marsh_fine_seen', { var: 'marsh_evidence', gte: 2 }], pushable: false }),
      // 空気だけ
      K.npc('heron', 'ani_hen', 50, 16, { name: '白いアヒル', dir: 'w', move: 'wander', talk: [L('ガァ。')], reward: null }),
      K.npc('woman_air', 'npc_marsh_woman', 11, 20, { name: '集会所の前の女', dir: 'e', talk: [L('霧の晩には、子どもを\n外に出しちゃいけないよ。'), L('cleared_r_marsh', '霧が晴れたら、湖って\nこんなに広かったんだね。')], reward: null }),
    ];

    const sp = MK.doorSpawn;
    K.def('loch', {
      name: '水辺の町ロッホ', kind: 'town', region: 'r_marsh', location: 'loch', theme: 'moss_village',
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
      bgm: 'town',
      meta: { sub: '湖の上の、鐘の町', chestsInfo: false },
      // 町ぜんたいを 1 枚に描いた下絵（v2/assets/env/moss_village/under/loch*、design/ENV_ASSETS.md §7）。湖・葦・板の道・小島・建物・大鐘・くいの鐘楼はこの絵、
      // 当たり・戸口・人・灯り・ほかの物は上のデータのまま。絵が無ければマスから焼く
      art: { image: 'moss_village/under/loch', emit: 'moss_village/under/loch_emit', painted: [] },
    });
  });
})(window.RPG);
