// CONTENT（灰の荒野）: 炎の町カルデラ（caldera、町 54×54）。WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8。
//   冷えた古い火口の内側に、段々が底へ下りていく町。段は四角い（縦横の道・まっすぐな崖。2026-10-01 に丸い輪から直した:
//   丸い輪を絵に合わせて引きのばした下絵が、全体に歪んで建物が斜めに見えた。持ち主の報告）:
//   縁の道  : 火口の縁をひと回りする四角い道（西の門・東の門）。いちばん上の北の岩に、火の神殿を彫りこむ（巫女カヤ。戸は縁の道に）。
//   段の崖  : 縁の道と下の段の間は、灰色のまっすぐな崖。石段が 3 か所（西・東・北の東より）。
//   家の段  : 北に「大卵殻」= 百年前にかえった火の鳥の卵の殻。家ほどの大きさの白金色の殻が割れたまま段に座り、
//             殻の割れ目をふさいで戸が 3 つ: 西 = 道具屋、まん中 = 酒場「殻の中」、東 = 武具屋（1 つの建物に店が 3 つ、戸はそれぞれ）。
//             西に宿「湯けむり亭」（石の湯屋）、東に族長ドルガの家（黒い石の塔の家）、南西に闘士の家、南に湯（温泉）。
//   溶岩の堀: 家の段の内側を、光る溶岩の四角い堀が回る。石の橋が 4 本（北・西・東・南。まっすぐ）。
//   底の広場: 堀の内側の敷石の広場。まん中に闘技場（丸い石の闘技場。戸は南）。
//   灯り: 溶岩の堀の照り返し（lava_glow、光だけ）と、崖・岩の上の鉄のかがり火（iron_brazier）。道・戸口の前・出入り口には置かない。
//   小物は道に置かない（持ち主の決まり）。宝箱は見える物 2 つ。隠し通路なし（A27）。
//   町の絵は 1 枚の下絵（v2/assets/env/ash/under/caldera*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;
    const W = 54, H = 54;
    const g = K.grid(W, H, 'M');
    // ---------------------------------------------------------------- 段（外から: 縁の道・崖・家の段・溶岩の堀・敷石の広場・闘技場）。どれも縦横にまっすぐ
    const inR = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let ch = 'M';
      if (inR(x, y, 2, 4, 51, 50)) ch = 'a';                                   // 縁の道（四角くひと回り）
      if (inR(x, y, 5, 6, 48, 48)) ch = 'F';                                   // 段の崖（縁の道の内側の 1 マスの帯）
      if (inR(x, y, 6, 7, 47, 47)) ch = 'a';                                   // 家の段
      if (inR(x, y, 16, 16, 38, 39)) ch = '%';                                 // 溶岩の堀（2 マス幅。描いた絵に合わせて東の帯は 37・38）
      if (inR(x, y, 18, 18, 36, 37)) ch = 'c';                                 // 敷石の広場
      if (Math.hypot(x + 0.5 - 27.5, y + 0.5 - 27.5) <= 7.8) ch = 'X';         // 闘技場の丸い壁（描いた物）
      g[y][x] = ch;
    }
    // 西の門・東の門（縁の道から外へ）
    K.rect(g, 0, 26, 2, 2, 'c'); K.rect(g, 52, 26, 2, 2, 'c');
    // 石段（縁の道 ↔ 家の段）: 西・東（門と同じ行）・北（東より。2 マス幅）
    K.rect(g, 5, 26, 1, 2, 'e'); K.rect(g, 48, 26, 1, 2, 'e'); K.rect(g, 41, 6, 2, 1, 'e');
    // 石の橋（溶岩の堀）: 北・西・東・南（2 マス幅、まっすぐ）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '%' && (x === 26 || x === 27 || y === 26 || y === 27)) g[y][x] = 'b';
    // 湯（温泉）: 家の段の南
    for (let y = 43; y <= 47; y++) for (let x = 20; x <= 34; x++) { const d = ((x - 27) / 6.4) ** 2 + ((y - 45) / 2.3) ** 2; if (d < 1 && K.at(g, x, y) === 'a') K.put(g, x, y, 'h'); }

    // ---------------------------------------------------------------- 建物（戸口は 1 マス、敷地のいちばん下の行。出て着くのはその真下）
    const O = [];
    const door = (x, y, map) => ({ x, y, to: { map, spawn: 'door' } });
    const bld = (id, x, y, w, h, o) => {
      const b = Object.assign({ type: 'building', id, x, y, w, h, wall: 2, roof: 'slate', mat: 'stone', windows: 2, lamp: false }, o);
      O.push(b);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j]) g[y + j][x + i] = 'a';
      if (b.door) { g[b.door.y][b.door.x] = 'c'; if ('FM%'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'a'; }
      return b;
    };
    // 大卵殻（百年前の火の鳥の卵の殻。割れ目に 3 つの戸）: 西 = 道具屋、まん中 = 酒場、東 = 武具屋
    const bItems = bld('caldera_shell_items', 19, 8, 5, 5, { wall: 2, windows: 1, sign: 'item', door: door(21, 12, 'caldera_items') });
    const bTav = bld('caldera_shell_tavern', 24, 7, 6, 6, { wall: 2, windows: 2, sign: 'tavern', door: door(26, 12, 'caldera_tavern') });
    const bArms = bld('caldera_shell_arms', 30, 8, 5, 5, { wall: 2, windows: 1, sign: 'weapon', door: door(32, 12, 'caldera_arms') });
    const bTemple = bld('caldera_temple', 22, 0, 10, 4, { wall: 2, windows: 0, sign: 'shrine', door: door(27, 3, 'caldera_temple') });
    const bInn = bld('caldera_inn', 6, 19, 7, 6, { wall: 2, windows: 2, sign: 'inn', door: door(9, 24, 'caldera_inn') });
    const bDorga = bld('caldera_dorga', 41, 18, 6, 6, { wall: 3, windows: 2, door: door(43, 23, 'caldera_dorga') });
    const bHouse = bld('caldera_house', 9, 33, 5, 4, { wall: 2, windows: 1, door: door(11, 36, 'caldera_house') });
    // 段の上の暮らし: 鍛冶場・灰よけの蔵・見習いの家（下絵の戸口に合わせた小さな屋内）
    const bForge = bld('caldera_forge', 40, 30, 5, 4, { wall: 2, windows: 1, door: door(42, 33, 'caldera_smithy') });
    const bStore = bld('caldera_store', 14, 12, 4, 3, { wall: 1, windows: 2, door: door(16, 14, 'caldera_granary') });
    const bHut = bld('caldera_hut', 40, 41, 4, 4, { wall: 2, windows: 2, door: door(41, 44, 'caldera_toto') });
    // 闘技場（丸い石の闘技場。戸は南。丸い壁は描いた物 X、戸のまわりだけ建物）
    const bArena = bld('caldera_arena', 24, 32, 7, 3, { wall: 3, windows: 0, sign: 'guild', door: door(27, 34, 'caldera_arena') });
    // 戸の前（出て着く所）
    for (const b of [bItems, bTav, bArms, bTemple, bInn, bDorga, bHouse, bArena, bForge, bStore, bHut]) if ('FMX%h'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'a';

    // ---------------------------------------------------------------- 下絵に合わせた当たり（design/ENV_ASSETS.md §7 の 6）: 描いた絵の崖・岩・溶岩・湯の縁のずれを直すマス
    //   （' ' = そのまま。design/art_ref/gen/env/_tools/under/field_ash/caldera.py fit が絵から作った）
    const FIT = [
      "                                                      ",
      "                                                      ",
      "                                                      ",
      "                                                      ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                               c                M  ",
      "  M                                                M  ",
      "                                                      ",
      "                                                      ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                   X                            M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                              a                 M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "  M                                                M  ",
      "                                                      ",
      "                                                      ",
      "                                                      ",
    ];
    FIT.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ' ') g[y][x] = ch; }));

    // ---------------------------------------------------------------- 物: 掲示板・湯・灯籠（依頼）・宝箱・かがり火・溶岩の照り返し
    // 飾りの小物（樽・岩・布など）は下絵に描く（持ち主の決まり 2026-09-28）。ここに置くのは働く物（調べる物・宝箱・灯り）だけ
    O.push(K.prop('board', 23, 33), K.exam(23, 33, 'caldera_board'));                  // 闘技場の壁の掲示板
    O.push(K.exam(26, 42, 'caldera_spa'), K.exam(27, 42, 'caldera_spa'), K.exam(28, 42, 'caldera_spa'));   // 町の湯（温泉。描いた湯の北の縁）
    // 【灯りを守る】崖の上の灯籠 3（冷えた灯籠 = 灰の道しるべの柱の消えた絵を下絵に描きこみ。ともすと、柱の上にかがり火の灯り。lift で柱の頭へ持ち上げる）
    //   西と東のまっすぐな崖の上（崖は縦に 1 マスの帯なので、柱の絵が歩けるマスにかからない）。家の段か縁の道から横向きに調べる
    for (const [n, x, y] of [[1, 5, 13], [2, 48, 13], [3, 5, 40]]) O.push(K.exam(x, y, 'caldera_lantern', { lamp: n }), K.prop('iron_brazier', x, y, { cond: 'ash_lantern_' + n, lift: 34 }));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('caldera_c1', 35, 5, { pool: 'p_T' }), K.chest('caldera_c2', 14, 42, { item: 'i_ether', n: 2 }));
    // かがり火（崖・岩の上。道・戸口の前・出入り口には置かない）と、溶岩の堀の照り返し（光だけ）
    for (const [x, y] of [[5, 33], [48, 33], [16, 3], [37, 3], [48, 40], [5, 17]]) O.push(K.prop('iron_brazier', x, y));
    for (const [x, y] of [[21, 16], [33, 16], [16, 16], [39, 16], [16, 21], [39, 21], [16, 33], [39, 33], [21, 39], [33, 39]]) O.push(K.prop('lava_glow', x, y));
    // 門の看板（門のわきの岩）
    O.push(K.sign(1, 25, R.T('map.ash_caldera.sign')), K.sign(52, 25, R.T('map.ash_caldera.sign_2')));

    // ---------------------------------------------------------------- 人
    const N = [
      K.npc('guard_w', 'npc_ash_fighter', 4, 28, { name: R.T('map.ash_caldera.N.0.guard_w.name'), dir: 'n', talk: 'caldera_gate_w', reward: 'news' }),
      K.npc('guard_e', 'npc_ash_fighter', 50, 28, { name: R.T('map.ash_caldera.N.1.guard_e.name'), dir: 'n', talk: 'caldera_gate_e', reward: 'boss' }),
      K.npc('apprentice', 'npc_ash_acolyte', 31, 5, { name: R.T('map.ash_caldera.N.2.apprentice.name'), dir: 's', talk: 'caldera_apprentice', reward: 'side' }),
      K.npc('oldman', 'npc_ash_old_m', 12, 29, { name: R.T('map.ash_caldera.N.3.oldman.name'), dir: 'e', talk: 'caldera_oldman', reward: 'lead' }),
      K.npc('woman', 'npc_ash_woman', 39, 14, { name: R.T('map.ash_caldera.N.4.woman.name'), dir: 's', talk: 'caldera_woman', reward: 'news' }),
      K.npc('child', 'npc_ash_child', 21, 41, { name: R.T('map.ash_caldera.N.5.child.name'), dir: 'e', talk: 'caldera_child', reward: 'hint' }),
      K.npc('spa_keeper', 'npc_ash_old_f', 33, 42, { name: R.T('map.ash_caldera.N.6.spa_keeper.name'), dir: 'w', talk: 'caldera_spa_keeper', reward: 'side' }),
      // 闘技場の前の列（大会のあいだ）・空気だけ
      K.npc('queue_a', 'npc_ash_fighter', 25, 36, { name: R.T('map.ash_caldera.N.7.queue_a.name'), dir: 'n', talk: [L(R.T('map.ash_caldera.N.talk.0.L')), L('ash_champion', R.T('map.ash_caldera.N.talk.1.ash_champion'))], reward: null, cond: '!cleared_r_ash' }),
      K.npc('queue_b', 'npc_ash_man', 29, 36, { name: R.T('map.ash_caldera.N.8.queue_b.name'), dir: 'n', talk: [L(R.T('map.ash_caldera.N.talk.0.L_2')), L('cleared_r_ash', R.T('map.ash_caldera.N.talk.1.cleared_r_ash'))], reward: null }),
      K.npc('dog', 'ani_dog', 40, 36, { name: R.T('map.ash_caldera.N.9.dog.name'), dir: 'w', move: 'wander', talk: [L(R.T('map.ash_caldera.N.talk.0.L_3'))], reward: null }),
    ];

    const sp = AK.doorSpawn;
    K.def('caldera', {
      name: R.T('map.ash_caldera.caldera.name'), kind: 'town', region: 'r_ash', location: 'caldera', theme: 'desert_town',
      legend: AK.TOWN(),
      rows: g, outside: 'rock',
      objects: O, npcs: N,
      spawns: {
        gate_w: { x: 2, y: 26, dir: 'e' },
        gate_e: { x: 51, y: 26, dir: 'w' },
        items: sp(bItems), tavern: sp(bTav), arms: sp(bArms), temple: sp(bTemple), inn: sp(bInn), dorga: sp(bDorga), house: sp(bHouse), arena: sp(bArena),
        forge: sp(bForge), store: sp(bStore), hut: sp(bHut),
        warp: { x: 27, y: 37, dir: 's' },
      },
      exits: [
        { x: 0, y: 26, w: 1, h: 2, to: { map: 'world', spawn: 'caldera' } },
        { x: 53, y: 26, w: 1, h: 2, to: { map: 'world', spawn: 'caldera_e' } },
      ],
      triggers: [{ id: 'arrival', on: 'enter', event: 'caldera_arrival' }],
      zones: [],
      light: AK.LIGHT_TOWN,
      dark: false,
      bgm: 'town',
      meta: { sub: R.T('map.ash_caldera.caldera.meta.sub'), chestsInfo: false },
      // 町ぜんたいを 1 枚に描いた下絵（v2/assets/env/ash/under/caldera*、design/ENV_ASSETS.md §7）。崖・段・溶岩の堀・建物・闘技場・大卵殻・湯はこの絵、
      // 当たり・戸口・人・灯り・働く物は上のデータ。lava_glow は光だけ（絵を持たない）
      art: { image: 'ash/under/caldera', emit: 'ash/under/caldera_emit', painted: ['lava_glow'] },
    });
  });
})(window.RPG);
