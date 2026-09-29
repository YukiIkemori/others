// CONTENT（灰の荒野）: 炎の町カルデラ（caldera、町 54×54）。WORLD_REDESIGN §5.11・§4.7、STORY_BIBLE §7.7・§8.8。
//   四角い家の並ぶ町ではない。冷えた古い火口の内側に、輪の段々が底へ下りていく町（2026-09-28）:
//   外の輪  : 火口の縁の道（西の門・東の門）。いちばん上の北の岩に、火の神殿を彫りこむ（巫女カヤ。戸は縁の道に）。
//   段の崖  : 縁の道と下の段の間は、灰色の崖。石段が 3 か所（西・東・北東）。
//   中の輪  : 家の段。北に「大卵殻」= 百年前にかえった火の鳥の卵の殻。家ほどの大きさの白金色の殻が割れたまま段に座り、
//             殻の割れ目をふさいで戸が 3 つ: 西 = 道具屋、まん中 = 酒場「殻の中」、東 = 武具屋（1 つの建物に店が 3 つ、戸はそれぞれ）。
//             西に宿「湯けむり亭」（段に食いこむ石の湯屋）、東に族長ドルガの家（黒い石の塔の家）、南西に闘士の家、南に湯（温泉）。
//   溶岩の堀: 中の輪の内側を、光る溶岩の堀が輪になって回る。石の橋が 4 本（北・西・東・南）。
//   底の輪  : 堀の内側の敷石の輪。まん中に闘技場（丸い石の闘技場。戸は南）。
//   灯り: 溶岩の堀の照り返し（lava_glow、光だけ）と、崖・岩の上の鉄のかがり火（iron_brazier）。道・戸口の前・出入り口には置かない。
//   小物は道に置かない（持ち主の決まり）。宝箱は見える物 2 つ。隠し通路なし（A27）。
//   町の絵は 1 枚の下絵（v2/assets/env/ash/under/caldera*、design/ENV_ASSETS.md §7）。当たり・戸口・人・灯り・物は下のデータ。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, AK = R.Ash.kit, L = K.L;
    const W = 54, H = 54, CX = 27, CY = 27, RAD = 26;
    const g = K.grid(W, H, 'M');
    const rr = (x, y) => Math.hypot(x + 0.5 - (CX + 0.5), y + 0.5 - (CY + 0.5)) / RAD;
    // ---------------------------------------------------------------- 輪（外から: 縁の道・崖・家の段・溶岩の堀・底の輪・闘技場）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const r = rr(x, y);
      let ch = 'M';
      if (r <= 0.3) ch = 'X';
      else if (r <= 0.43) ch = 'c';
      else if (r <= 0.5) ch = '%';
      else if (r <= 0.78) ch = 'a';
      else if (r <= 0.84) ch = 'F';
      else if (r <= 0.96) ch = 'a';
      g[y][x] = ch;
    }
    // 西の門・東の門（縁の道から外へ）
    K.rect(g, 0, 26, 4, 2, 'c'); K.rect(g, 50, 26, 4, 2, 'c');
    // 石段（縁の道 ↔ 家の段）: 西・東・北東（崖の輪を、その向きで 2 マス幅に切る）
    const ang = (x, y) => Math.atan2(y + 0.5 - (CY + 0.5), x + 0.5 - (CX + 0.5));
    const near = (a, b, w) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) <= w;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== 'F') continue;
      const a = ang(x, y);
      if (near(a, Math.PI, 0.05) || near(a, 0, 0.05) || near(a, -Math.PI / 4, 0.05)) g[y][x] = 'e';
    }
    // 石の橋（溶岩の堀）: 北・西・東・南（2 マス幅）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '%') continue;
      if ((x === 26 || x === 27) || (y === 26 || y === 27)) g[y][x] = 'b';
    }
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
    const bHut = bld('caldera_hut', 36, 40, 4, 4, { wall: 2, windows: 2, door: door(37, 43, 'caldera_toto') });
    // 闘技場（丸い石の闘技場。戸は南。丸い壁は描いた物 X、戸のまわりだけ建物）
    const bArena = bld('caldera_arena', 24, 32, 7, 3, { wall: 3, windows: 0, sign: 'guild', door: door(27, 34, 'caldera_arena') });
    // 戸の前（出て着く所）
    for (const b of [bItems, bTav, bArms, bTemple, bInn, bDorga, bHouse, bArena, bForge, bStore, bHut]) if ('FMX%h'.includes(g[b.door.y + 1][b.door.x])) g[b.door.y + 1][b.door.x] = 'a';

    // ---------------------------------------------------------------- 下絵に合わせた当たり（design/ENV_ASSETS.md §7 の 6）: 描いた輪は円より四角いので、
    //   縁の道・段の崖・外の岩のマスを絵に合わせる（' ' = そのまま。scratchpad の fit_town.py が絵から作った）
    const FIT = [
      "                                                      ",
      "                                                      ",
      "                                                      ",
      "                   a M          MMaa                  ",
      "                  MMM            MMM                  ",
      "                MMM      FFFF       MM                ",
      "              MMM     aa     aaaa    MMMM             ",
      "              MM   aaaaa       aaaa    MMM            ",
      "             F   aa                      M            ",
      "           FF    a                       MMM          ",
      "          F                                MM         ",
      "        MM                                  MMM       ",
      "        M                                    MM       ",
      "        M                                             ",
      "       MM                                     F M     ",
      "      MM                                       MM     ",
      "      M                                         MM    ",
      "     M                                       aa MM    ",
      "     M                                           MM   ",
      "    MM                                         a MM   ",
      "    M                                          a  M   ",
      "   MM                                             M   ",
      "   MM                                             MM  ",
      "   M                                               M  ",
      "   M                                               M  ",
      "      a                                         a     ",
      "                                                      ",
      "                                                      ",
      "   M                                              MM  ",
      "   M  a                                         a  M  ",
      "   M                                               M  ",
      "   M                                               M  ",
      "   M                                              MM  ",
      "   M                                               M  ",
      "    M                                             M   ",
      "    M                                            MM   ",
      "                                                 M    ",
      "     M                                           M    ",
      "     M                                           M    ",
      "      M                                         M     ",
      "      M                                        MM     ",
      "       M                                       M      ",
      "        M                                     M       ",
      "        MM                                    M       ",
      "         M                                   M        ",
      "          M                                 M         ",
      "          aM                                a         ",
      "            aF        aa       aa       F a           ",
      "             aF       aaaaaaaaaaa       Fa            ",
      "              aaF                      aa             ",
      "                aaF                 Faa               ",
      "                  a a             aaa                 ",
      "                            a                         ",
      "                                                      ",
    ];
    FIT.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ' ') g[y][x] = ch; }));

    // ---------------------------------------------------------------- 物: 掲示板・湯・灯籠（依頼）・宝箱・かがり火・溶岩の照り返し
    // 飾りの小物（樽・岩・布など）は下絵に描く（持ち主の決まり 2026-09-28）。ここに置くのは働く物（調べる物・宝箱・灯り）だけ
    O.push(K.prop('board', 23, 33), K.exam(23, 33, 'caldera_board'));                  // 闘技場の壁の掲示板
    O.push(K.exam(26, 43, 'caldera_spa'), K.exam(27, 43, 'caldera_spa'), K.exam(28, 43, 'caldera_spa'));   // 町の湯（温泉）
    // 【灯りを守る】崖の上の灯籠 3（冷えた石灯籠は下絵。ともすと、かがり火の灯り）
    for (const [n, x, y] of [[1, 9, 16], [2, 45, 16], [3, 21, 47]]) O.push(K.exam(x, y, 'caldera_lantern', { lamp: n }), K.prop('iron_brazier', x, y, { cond: 'ash_lantern_' + n }));
    // 町の宝箱 2（見える所だけ）
    O.push(K.chest('caldera_c1', 35, 5, { pool: 'p_T' }), K.chest('caldera_c2', 14, 42, { item: 'i_ether', n: 2 }));
    // かがり火（崖・岩の上。道・戸口の前・出入り口には置かない）と、溶岩の堀の照り返し（光だけ）
    for (const [x, y] of [[6, 30], [47, 31], [17, 4], [37, 4], [11, 40], [44, 40]]) O.push(K.prop('iron_brazier', x, y));
    for (const [x, y] of [[22, 15], [32, 15], [17, 19], [37, 19], [16, 23], [38, 30], [17, 35], [37, 35], [22, 38], [32, 38]]) O.push(K.prop('lava_glow', x, y));
    // 門の看板（門のわきの岩）
    O.push(K.sign(2, 25, R.T('map.ash_caldera.sign')), K.sign(51, 25, R.T('map.ash_caldera.sign_2')));

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
