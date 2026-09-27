// 雪の林（snow_woods）。WORLD_REDESIGN §4.3 の 1「薪集め: 村の外の雪の森で、倒木を 3 本」・小さな依頼 2「迷子のそり犬」。
//   屋外の小さなダンジョン 50×42（ユールの東の門から南東へ 60 歩ほど）。入口の広場 → 中ほどのきこりの野営地（泉） → 三つの広場に倒木。
//   倒木 1（西の広場）・倒木 2（北の広場。雪男が寝そべっている → 戦う）・倒木 3（東の広場。凍った小川の丸木橋の先）。
//   北東の奥のくぼ地に迷子のそり犬（依頼を受けていれば連れて帰れる）。一方通行: 北の広場から西へ下る雪の斜面（西向きだけ）。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit;
    const W = 50, H = 42;
    const g = K.grid(W, H, 'T');
    K.border(g, 'H', 2);
    // 広場
    K.blob(g, 25, 36, 6, 3, '.', 'sw0');          // G0 入口
    K.rect(g, 23, 39, 4, 3, ',');
    K.blob(g, 25, 23, 7, 5, '.', 'sw1');          // G1 野営地（泉）
    K.blob(g, 9, 24, 6, 5, '.', 'sw2');           // G2 西（倒木 1）
    K.blob(g, 24, 8, 8, 4, '.', 'sw3');           // G3 北（倒木 2・雪男）
    K.blob(g, 41, 22, 5, 5, '.', 'sw4');          // G4 東（倒木 3）
    K.blob(g, 42, 7, 4, 3, '.', 'sw5');           // G5 北東のくぼ地（そり犬）
    K.blob(g, 9, 9, 5, 4, '.', 'sw6');            // G6 北西（宝箱）
    // 道
    K.path(g, [[24, 33], [24, 28]], ',', 2);
    K.path(g, [[18, 23], [14, 23]], ',', 2);
    K.path(g, [[25, 18], [25, 12]], ',', 2);
    K.path(g, [[32, 23], [36, 23]], ',', 2);
    K.blob(g, 34, 23, 1, 1, 'i', 'swice', ',');                // 凍った小川の上（氷は歩ける）
    K.path(g, [[33, 16], [33, 20]], '~', 1);                   // 凍りきっていない小川（北へ流れる）
    K.path(g, [[33, 26], [33, 31]], '~', 1);
    K.path(g, [[41, 17], [41, 8]], ',', 2);                   // 東 → 北東のくぼ地
    K.path(g, [[16, 8], [13, 8]], ',', 2);                     // 北 → 北西（一方通行の斜面）
    K.path(g, [[9, 11], [9, 19]], ',', 2);                     // 北西 → 西（一方通行の斜面で下りた人の帰り道）
    K.soften(g, 'T', '.,i', ['.', 'T'], 0.4, 'sw');
    for (const [x, y] of [[15, 7], [15, 10]]) K.put(g, x, y, 'T');   // 一方通行の斜面の脇の 1 マス（入ると戻れない）
    for (const [x, y] of [[22, 21], [29, 25], [7, 22], [12, 27], [21, 7], [29, 9], [40, 20], [44, 24], [11, 8]]) if (K.at(g, x, y) === '.') K.put(g, x, y, 'T');

    const O = [];
    O.push(K.prop('rock_small', 24, 21), K.prop('rock_small', 25, 22));   // 小石（泉は置かない。WORLD §6.2）
    O.push({ type: 'brazier', id: 'snow_woods_camp', x: 27, y: 24, on: true });
    O.push(K.prop('tent', 29, 21), K.prop('firewood', 21, 25), K.prop('sled', 28, 26), K.prop('log', 22, 24));
    // 倒木
    O.push(K.prop('log', 8, 23), K.prop('log', 9, 23), K.exam(8, 24, 'snow_woods_log', { log: 1 }));
    O.push(K.prop('log', 26, 7), K.prop('log', 27, 7), K.exam(27, 8, 'snow_woods_log', { log: 2 }));
    O.push(K.prop('log', 43, 21), K.prop('log', 44, 21), K.exam(43, 22, 'snow_woods_log', { log: 3 }));
    O.push(K.prop('stump', 10, 26), K.prop('stump', 23, 9), K.prop('stump', 40, 24));
    O.push(K.prop('bush', 38, 22, { variant: 2 }), K.exam(38, 23, 'snow_mat', { mat: 'snow_mat_berry' }));   // 雪像の飾り: 赤い実
    // 宝箱
    O.push(K.chest('snow_woods_c1', 7, 8, { pool: 'p_T' }));
    O.push(K.chest('snow_woods_c2', 42, 25, { item: 'i_firepot', n: 2 }));
    O.push(K.chest('snow_woods_c3', 44, 6, { pool: 'p_T' }));
    O.push(K.chest('snow_woods_c4', 13, 26, { gold: 110 }));
    O.push(K.sign(27, 35, '雪の林\n倒木は薪になる。――ユールの薪割り'));
    O.push(K.prop('snow_lamp', 20, 34), K.prop('snow_lamp', 30, 34));   // 入口の広場の両端（道の口をふさがない）
    const keep = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (K.at(g, x, y) === ',') keep.add(x + ',' + y);
    K.scatter(g, O, ['snow_rock', 'snow_bank', 'snow_fir'], 18, [2, 2, 46, 38], '.', 'swdeco', { keep, gap: 4, variant: true });

    const N = [
      K.npc('woods_hunter', 'npc_snow_man', 26, 25, { name: '薪割りの男', dir: 'w', talk: 'snow_woods_camp', reward: 'hint' }),
      K.npc('lost_dog', 'ani_dog', 43, 8, { name: 'そり犬', dir: 's', talk: 'snow_woods_dog', cond: ['!snow_dog_found', '!snow_dog_home'], reward: 'side' }),
    ];
    K.def('snow_woods', {
      name: '雪の林', kind: 'dungeon', region: 'r_snow', location: 'snow_woods', theme: 'snow',
      legend: S.LEGEND(), rows: g, outside: 'snow',
      objects: O, npcs: N,
      spawns: { south: { x: 24, y: 38, dir: 'n' }, camp: { x: 25, y: 26, dir: 'n' } },
      exits: [{ x: 23, y: 41, w: 4, h: 1, to: { map: 'world', spawn: 'snow_woods' } }],
      triggers: [
        { id: 'arrive', on: 'enter', event: 'snow_woods_arrive', once: true },
        { id: 'yeti', x: 22, y: 9, w: 7, h: 4, on: 'step', event: 'snow_woods_yeti', cond: '!snow_woods_yeti' },
      ],
      oneway: [{ x: 15, y: 8, dir: 'w' }, { x: 15, y: 9, dir: 'w' }],
      zones: [{ rect: null, zone: 'z_snow_woods' }],
      light: { ambient: '#5a64a4', k: 0.55, poolK: 0.7, spillR: 0.9, mood: 'night' },
      dark: false,
      bgm: 'ice', bbg: 'snow', weather: 'snow', weatherCond: '!cleared_r_snow',
      meta: { chestsInfo: true, sub: '倒木の林' },
    });
  });
})(window.RPG);
