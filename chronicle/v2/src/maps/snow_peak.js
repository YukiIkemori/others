// 白竜の峰（peak_1 峰の道・peak_top 頂）。WORLD_REDESIGN §4.3 の 5〜7・§6.5（今の 1・2 階を 1 枚に詰めて 58×48、頂は屋外）・§6.2、STORY_BIBLE §7.3
//   peak_1: 入口の台地 A → 氷の壁 1 → 温泉の湧く岩の間（泉 1）B → 東の道の氷の壁 2 → 巨人の氷壁の前（泉 2）C → 氷壁の巨人 → 頂への石段。
//           西の道は寄り道（氷の壁 3 → 西の岩棚のレアの箱）。氷の壁は冬至の火の火種（k_winter_flame）でとける。
//           祭で「火を盗んだ子ども」を語ると、氷の壁 1 は最初からとけている（snow_ice_1 が祭で立つ）。
//           隠し通路 1（入口の台地の西の雪の壁 → 小部屋。ユールの子どものうわさ）。一方通行: B の東から A の東の岩棚へ下る雪の斜面（南向きだけ）。
//   peak_top: 頂の手前の洞（泉 3）→ 吹きさらしの頂。竜の碑文（lo_snow_epitaph）。ネーヴェは頂の奥の氷の祭壇に舞い降りる。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, S = R.Snow.kit;

    // ================================================================ peak_1
    {
      const W = 58, H = 48;
      const g = K.grid(W, H, 'H');
      // A 入口の台地
      K.blob(g, 28, 40, 16, 5, '.', 'pk_a');
      K.rect(g, 26, 44, 5, 4, ',');
      K.blob(g, 10, 39, 5, 3, '.', 'pk_a1');        // 西のくぼみ
      K.blob(g, 45, 41, 6, 3, '.', 'pk_a2');        // 東の岩棚
      K.path(g, [[15, 40], [18, 40]], '.', 2);
      K.path(g, [[39, 41], [42, 41]], '.', 2);
      K.path(g, [[27, 36], [27, 31]], ',', 3);       // → 氷の壁 1
      // B 温泉の岩の間
      K.blob(g, 28, 25, 11, 6, '.', 'pk_b');
      K.blob(g, 28, 25, 3, 2, 'w', 'pk_bw', '.');   // 湯だまり（歩けない）
      K.blob(g, 12, 23, 6, 5, '.', 'pk_bw2');       // 西の道
      K.blob(g, 45, 23, 6, 5, '.', 'pk_be');        // 東の道
      K.path(g, [[17, 24], [18, 24]], ',', 2);
      K.path(g, [[39, 24], [40, 24]], ',', 2);
      K.path(g, [[47, 28], [47, 37]], ',', 2);       // 東の雪の斜面（一方通行: 南だけ）→ A の東の岩棚
      K.path(g, [[43, 18], [43, 11]], ',', 3);       // → 氷の壁 2
      K.path(g, [[12, 18], [12, 11]], ',', 3);       // → 氷の壁 3（寄り道）
      // 西の岩棚（寄り道）
      K.blob(g, 11, 9, 6, 4, '.', 'pk_w');
      // C 巨人の氷壁の前
      K.blob(g, 39, 9, 10, 4, '.', 'pk_c');
      K.rect(g, 38, 3, 7, 4, ',');                   // 頂への石段の前
      K.rect(g, 40, 0, 3, 3, ',');
      // 雪の岩のあいだの細い所（立ち上がり 1 の土手）
      K.soften(g, 'H', '.,', ['#', 'H'], 0.35, 'pk1');
      for (const [x, y] of [[20, 38], [36, 42], [22, 27], [33, 22], [9, 25], [48, 22], [35, 10], [44, 8], [14, 8]]) if (K.at(g, x, y) === '.') K.put(g, x, y, 'T');
      // 氷の壁（とけるまで固い氷）
      K.rect(g, 27, 32, 3, 2, 'I');
      K.rect(g, 43, 15, 3, 2, 'I');
      K.rect(g, 12, 15, 3, 2, 'I');
      // 隠し通路（入口の台地の西のくぼみ → 小部屋）
      K.put(g, 5, 39, 'S'); K.put(g, 4, 39, 'S');
      K.rect(g, 1, 37, 3, 4, '.');

      const O = [];
      O.push(K.spring('peak_1_s1', 30, 21));                       // 温泉の湧く岩の間（道のりの中ほど）
      O.push(K.spring('peak_1_s2', 34, 11));                       // 巨人の手前
      O.push(K.stairs(41, 1, { map: 'peak_top', spawn: 'south' }, { id: 'peak_1_up', look: 'up', cond: 'snow_giant' }));
      // 氷の壁（とけると消える）と、火種をかざす所
      const WALLS = [[1, 27, 32, 3, 28, 34], [2, 43, 15, 3, 44, 17], [3, 12, 15, 3, 13, 17]];
      for (const [n, x, y, w, ex, ey] of WALLS) {
        for (let i = 0; i < w; i++) O.push(K.prop('ice_crystal', x + i, y + 1, { cond: '!snow_ice_' + n, variant: i }));
        O.push(K.exam(ex, ey, 'peak_icewall', { wall: n }));
      }
      // 宝箱（見える所。隠し通路の先にレア）
      O.push(K.chest('peak_1_c1', 8, 38, { pool: 'p_T' }));
      O.push(K.chest('peak_1_c2', 48, 42, { pool: 'p_T' }));
      O.push(K.chest('peak_1_c3', 2, 38, { pool: 'p_rare' }));
      O.push(K.chest('peak_1_c4', 16, 21, { item: 'i_firepot', n: 3 }));
      O.push(K.chest('peak_1_c5', 49, 24, { pool: 'p_T' }));
      O.push(K.chest('peak_1_c6', 8, 8, { pool: 'p_rare' }));
      O.push(K.chest('peak_1_c7', 46, 10, { gold: 260 }));
      // 書き付け（ボスのほのめかし）・景色
      O.push(K.sign(31, 9, '――氷の巨人、白く光りて鎧をまとう。\n光る間に火をかざせ。\n鎧は張れず、張っても砕ける。\n（誰かの書き付け）'));
      O.push(K.sign(29, 43, '白竜の峰\nここより上、吹雪やまず。'));
      O.push(K.exam(46, 40, 'peak_overlook'));
      for (const [x, y] of [[22, 40], [34, 40], [24, 26], [34, 27], [37, 9], [45, 5]]) O.push(K.prop('ice_crystal', x, y));
      for (const [x, y] of [[26, 38], [30, 38], [41, 12]]) O.push(K.prop('snow_lamp', x, y));
      O.push(K.prop('firewood', 31, 36), K.prop('sled', 23, 42), K.prop('snow_rock', 12, 24), K.prop('snow_rock', 44, 26));
      const keep = new Set();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (K.at(g, x, y) === ',') keep.add(x + ',' + y);
      K.scatter(g, O, ['snow_rock', 'snow_bank', 'snow_fir'], 16, [2, 2, 54, 44], '.', 'pk1deco', { keep, gap: 4, variant: true });

      K.def('peak_1', {
        name: '白竜の峰', kind: 'dungeon', region: 'r_snow', location: 'peak', theme: 'snow',
        legend: S.LEGEND({
          I: { mat: 'ice', solid: true, name: 'ice_wall' },
          w: { mat: 'water', walk: false },
          S: { mat: 'wall_snow', solid: true, rise: 2, secret: true, floor: 'snow' },
        }),
        rows: g, outside: 'wall_snow',
        objects: O, npcs: [],
        spawns: { south: { x: 28, y: 45, dir: 'n' }, top: { x: 41, y: 3, dir: 's' }, spring: { x: 30, y: 23, dir: 's' } },
        exits: [{ x: 26, y: 47, w: 5, h: 1, to: { map: 'world', spawn: 'peak' } }],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'peak_arrive', once: true },
          { id: 'giant', x: 38, y: 5, w: 7, h: 2, on: 'step', event: 'peak_giant', cond: '!snow_giant' },
        ],
        tilePatches: [
          { cond: 'snow_ice_1', rect: [27, 32, 3, 2], rows: [',,,', ',,,'] },
          { cond: 'snow_ice_2', rect: [43, 15, 3, 2], rows: [',,,', ',,,'] },
          { cond: 'snow_ice_3', rect: [12, 15, 3, 2], rows: [',,,', ',,,'] },
        ],
        oneway: [{ x: 47, y: 30, dir: 's' }, { x: 48, y: 30, dir: 's' }],
        zones: [{ rect: [0, 0, 58, 44], zone: 'z_snow_peak' }],
        light: { ambient: '#56629e', k: 0.56, mood: 'night' },
        dark: false,
        bgm: 'ice', bbg: 'snow', weather: 'blizzard', weatherCond: '!cleared_r_snow', weatherElse: 'snow',
        meta: { chestsInfo: true, floor: '峰の道', sub: '吹雪の峰' },
      });
    }

    // ================================================================ peak_top（頂）40×30
    {
      const W = 40, H = 30;
      const g = K.grid(W, H, 'H');
      K.rect(g, 16, 23, 8, 6, 'c');                   // 頂の手前の洞（石の床）
      K.rect(g, 18, 29, 4, 1, 'c');
      K.blob(g, 20, 13, 13, 8, '.', 'pt_top');        // 吹きさらしの頂
      K.path(g, [[19, 22], [19, 18]], ',', 3);
      K.blob(g, 20, 6, 6, 3, 'i', 'pt_altar', '.');   // 氷の祭壇
      K.soften(g, 'H', '.,', ['#', 'H'], 0.3, 'pt');
      const O = [];
      O.push(K.spring('peak_top_s1', 21, 24));
      O.push(K.stairs(19, 28, { map: 'peak_1', spawn: 'top' }, { id: 'peak_top_down', look: 'down' }));
      O.push({ type: 'brazier', id: 'peak_top_b1', x: 17, y: 24, on: true }, { type: 'brazier', id: 'peak_top_b2', x: 23, y: 26, on: true });
      O.push(K.prop('snow_rock', 12, 12), K.exam(12, 13, 'peak_epitaph'));          // 竜の碑文
      for (const [x, y] of [[15, 6], [25, 6], [13, 9], [27, 9], [18, 4], [22, 4], [20, 3]]) O.push(K.prop('ice_crystal', x, y, { variant: (x + y) % 3 }));
      O.push(K.prop('beacon', 20, 7, { cond: 'cleared_r_snow' }));                  // 冬至の火（大灯火）
      O.push(K.exam(20, 8, 'peak_altar'));
      O.push(K.chest('peak_top_c1', 30, 14, { pool: 'p_T' }));
      O.push(K.chest('peak_top_c2', 9, 16, { item: 'i_elixir', n: 1 }));
      O.push(K.sign(22, 22, '――竜は、火と物語を受け取る。\n吹雪の息をためたら、身を伏せよ。\n（誰かの書き付け）'));
      K.scatter(g, O, ['snow_rock', 'snow_bank'], 8, [4, 4, 32, 18], '.', 'ptdeco', { gap: 4, variant: true, keep: new Set(['19,18', '20,18', '21,18', '20,9', '20,10', '19,10', '21,10']) });
      K.def('peak_top', {
        name: '白竜の峰', kind: 'dungeon', region: 'r_snow', location: 'peak', theme: 'snow',
        legend: S.LEGEND({}),
        rows: g, outside: 'wall_snow',
        objects: O,
        npcs: [],
        spawns: { south: { x: 19, y: 27, dir: 'n' }, altar: { x: 20, y: 11, dir: 'n' } },
        exits: [],
        triggers: [
          { id: 'arrive', on: 'enter', event: 'peak_top_arrive', once: true },
          { id: 'neve', x: 14, y: 9, w: 13, h: 3, on: 'step', event: 'peak_neve', cond: '!cleared_r_snow' },
        ],
        zones: [],
        light: { ambient: '#5a64a4', k: 0.55, mood: 'night' },
        dark: false,
        bgm: 'ice', bbg: 'snow', weather: 'blizzard', weatherCond: '!cleared_r_snow',
        meta: { chestsInfo: true, floor: '頂', sub: '吹きさらしの頂' },
      });
    }
  });
})(window.RPG);
